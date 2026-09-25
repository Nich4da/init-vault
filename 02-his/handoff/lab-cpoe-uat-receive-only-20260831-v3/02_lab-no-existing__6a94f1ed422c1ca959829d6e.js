/*
 * initCraft API Factory Process
 * Name: LAB - Generate and assign LAB NO. per CPOE Item
 * Deployed Process ID: 6a94f1ed422c1ca959829d6e
 * Process creation reported by the user on 2026-08-31; deployed body/UAT not yet verified.
 *
 * Input: { item_id: '<zdata_cpoe_order_item _id>' }
 * Output LAB NO.: SSYY######
 *   SS     = approved two-digit LAB section prefix
 *   YY     = last two digits of Buddhist Era year
 *   ###### = six-digit sequence, isolated by section + full BE year
 *
 * The generated number and counter increment are committed in one MongoDB
 * transaction. Repeating the same item_id returns its existing LAB NO.
 */

const ITEM_COLLECTION = 'zdata_cpoe_order_item'
const ITEM_MASTER_COLLECTION = 'zdata_master_item_order'
const SECTION_COLLECTION = 'zdata_section'
const COUNTER_COLLECTION = 'zdata_lab_no_counter'

const MAX_SEQUENCE = 999999

const SECTION_PREFIX = {
  BC: '10',
  HM: '20',
  ML: '21',
  HH: '22',
  IM: '30',
  'MI-OUT': '31',
  MB: '40',
  MY: '41',
  BB: '50',
  BG: '70'
}

const ORGANIZATION_SECTION_CODES = {
  M1000: ['BC', 'IM', 'BB', 'MB', 'HM', 'MY', 'HH', 'MI-OUT', 'BG', 'ML'],
  M1001: ['BC'],
  M1002: ['BB'],
  M1003: ['ML'],
  M0104: ['HM', 'HH'],
  M1004: ['HM', 'HH'],
  M1005: ['MB', 'MY'],
  M1006: ['IM', 'MI-OUT'],
  M1007: ['BG'],
  '10': ['BC'],
  '20': ['HM'],
  '20-22': ['HM', 'HH'],
  '21': ['ML'],
  '22': ['HH'],
  '30': ['IM'],
  '31': ['MI-OUT'],
  '40': ['MB'],
  '41': ['MY'],
  '50': ['BB'],
  '70': ['BG']
}

const valueText = value => {
  if (value == null) return ''
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return String(value.toHexString())
    if (value.$oid != null) return String(value.$oid)
    if (value._id != null) return valueText(value._id)
    if (value.value != null && typeof value.value !== 'object') return String(value.value)
    if (value.code != null) return String(value.code)
  }
  return String(value)
}

const itemId = valueText(params.item_id).trim()
if (!/^[a-f0-9]{24}$/i.test(itemId)) {
  return { success: false, message: 'item_id ไม่ถูกต้อง' }
}

if (!app.isAuth(userInfo.roles || [])) {
  return { success: false, message: 'ไม่มีสิทธิ์สร้าง LAB NO.' }
}

const organizationCode = valueText(userInfo.unit && userInfo.unit.code).trim().toUpperCase()
const allowedSections = ORGANIZATION_SECTION_CODES[organizationCode] || []
if (!allowedSections.length) {
  return { success: false, message: 'Organization ปัจจุบันไม่ได้ผูกกับห้อง LAB' }
}

const gregorianYear = Number(app.curDate('YYYY'))
if (!Number.isInteger(gregorianYear) || gregorianYear < 1900 || gregorianYear > 9999) {
  return { success: false, message: 'อ่านปีปัจจุบันจากระบบไม่สำเร็จ' }
}
const buddhistYear = gregorianYear + 543
const buddhistYearTwoDigits = String(buddhistYear % 100).padStart(2, '0')
const now = app.curDate('YYYY-MM-DD HH:mm:ss')
const actor = valueText(userInfo.username || userInfo.account && userInfo.account.name).trim()
const itemObjectId = app.dbObjectId(itemId)

let assigned
try {
  assigned = await this.mongoTxn(async session => {
    const itemCollection = app.db.collection(ITEM_COLLECTION)
    const masterCollection = app.db.collection(ITEM_MASTER_COLLECTION)
    const sectionCollection = app.db.collection(SECTION_COLLECTION)
    const counterCollection = app.db.collection(COUNTER_COLLECTION)

    const item = await itemCollection.findOne(
      { _id: itemObjectId, xrstatx: { $nin: [0, 3] } },
      { session }
    )
    if (!item) throw new Error('ITEM_NOT_FOUND')
    if (valueText(item.service_type && item.service_type.value).trim().toLowerCase() !== 'lab') {
      throw new Error('ITEM_NOT_LAB')
    }

    const existingLabNo = valueText(item.lab_no).trim()
    if (existingLabNo) {
      return {
        item_id: itemId,
        lab_no: existingLabNo,
        section_code: valueText(item.lab_no_section_code).trim().toUpperCase(),
        section_prefix: valueText(item.lab_no_section_prefix).trim(),
        buddhist_year: Number(item.lab_no_buddhist_year || 0) || null,
        sequence: Number(item.lab_no_sequence || 0) || null,
        already_assigned: true
      }
    }

    if (valueText(item.current_status).trim().toLowerCase() !== 'sent') {
      throw new Error('ITEM_NOT_WAITING_RECEIVE')
    }

    let master = null
    if (item.item_data_id) {
      master = await masterCollection.findOne(
        { _id: item.item_data_id, xrstatx: { $nin: [0, 3] } },
        { session }
      )
    }

    let section = item.section_snapshot ||
      (item.lab_context_snapshot && item.lab_context_snapshot.section) ||
      (master && master.section) || {}
    if (!valueText(section.code).trim() && section.value) {
      const sectionId = typeof section.value === 'string'
        ? app.dbObjectId(section.value)
        : section.value
      const foundSection = await sectionCollection.findOne(
        { _id: sectionId, xrstatx: { $nin: [0, 3] }, enable: { $ne: false } },
        { session }
      )
      if (foundSection) section = foundSection
    }

    const sectionCode = valueText(section.code).trim().toUpperCase()
    if (!allowedSections.includes(sectionCode)) throw new Error('SECTION_FORBIDDEN')
    const sectionPrefix = SECTION_PREFIX[sectionCode]
    if (!sectionPrefix) throw new Error('SECTION_PREFIX_MISSING')

    const counterId = ['lab_no', sectionCode, buddhistYear].join(':')
    const counterResult = await counterCollection.findOneAndUpdate(
      { _id: counterId },
      [
        {
          $set: {
            section_code: sectionCode,
            section_prefix: sectionPrefix,
            buddhist_year: buddhistYear,
            year_two_digits: buddhistYearTwoDigits,
            sequence: {
              $let: {
                vars: { current: { $ifNull: ['$sequence', 0] } },
                in: {
                  $cond: [
                    { $gte: ['$$current', MAX_SEQUENCE] },
                    1,
                    { $add: ['$$current', 1] }
                  ]
                }
              }
            },
            created_at: { $ifNull: ['$created_at', now] },
            updated_at: now,
            updated_by: actor
          }
        }
      ],
      { upsert: true, returnDocument: 'after', session }
    )
    const counter = counterResult && (counterResult.value || counterResult)
    const sequence = Number(counter && counter.sequence)
    if (!Number.isInteger(sequence) || sequence < 1 || sequence > MAX_SEQUENCE) {
      throw new Error('COUNTER_INVALID')
    }

    const labNo = sectionPrefix + buddhistYearTwoDigits + String(sequence).padStart(6, '0')
    const duplicate = await itemCollection.findOne(
      {
        _id: { $ne: itemObjectId },
        lab_no: labNo,
        xrstatx: { $nin: [0, 3] }
      },
      { projection: { _id: 1 }, session }
    )
    if (duplicate) throw new Error('LAB_NO_COLLISION')

    const saved = await itemCollection.updateOne(
      {
        _id: itemObjectId,
        xrstatx: { $nin: [0, 3] },
        current_status: 'sent',
        $or: [
          { lab_no: { $exists: false } },
          { lab_no: null },
          { lab_no: '' }
        ]
      },
      {
        $set: {
          lab_no: labNo,
          lab_no_section_code: sectionCode,
          lab_no_section_prefix: sectionPrefix,
          lab_no_buddhist_year: buddhistYear,
          lab_no_year_two_digits: buddhistYearTwoDigits,
          lab_no_sequence: sequence,
          lab_no_generated_at: now,
          lab_no_generated_by: actor,
          updated_at: now,
          updated_by: actor
        }
      },
      { session }
    )
    if (!saved || Number(saved.matchedCount) !== 1) throw new Error('ITEM_ASSIGN_CONFLICT')

    return {
      item_id: itemId,
      lab_no: labNo,
      section_code: sectionCode,
      section_prefix: sectionPrefix,
      buddhist_year: buddhistYear,
      year_two_digits: buddhistYearTwoDigits,
      sequence,
      already_assigned: false
    }
  }, { name: 'generateLabNo', maxRetry: 5, timeoutMs: 15000 })
} catch (error) {
  const code = valueText(error && error.message || error)
  const messages = {
    ITEM_NOT_FOUND: 'ไม่พบ CPOE Item ที่ต้องการสร้าง LAB NO.',
    ITEM_NOT_LAB: 'สร้าง LAB NO. ได้เฉพาะ LAB Item',
    ITEM_NOT_WAITING_RECEIVE: 'สร้าง LAB NO. ใหม่ได้เฉพาะ Item ที่ยังรอรับ specimen',
    SECTION_FORBIDDEN: 'Item นี้ไม่ได้อยู่ใน Section ของ Organization ปัจจุบัน',
    SECTION_PREFIX_MISSING: 'Section นี้ยังไม่มีรหัส 2 หลักสำหรับสร้าง LAB NO.',
    COUNTER_INVALID: 'ลำดับ LAB NO. ไม่ถูกต้อง',
    LAB_NO_COLLISION: 'ลำดับ LAB NO. วนครบแล้ว แต่เลข 000001 ถูกใช้อยู่ จึงไม่สร้างเลขซ้ำ',
    ITEM_ASSIGN_CONFLICT: 'Item ถูกเปลี่ยนแปลงระหว่างสร้าง LAB NO. กรุณาลองใหม่'
  }
  return { success: false, message: messages[code] || 'สร้าง LAB NO. ไม่สำเร็จ: ' + code }
}

return {
  success: true,
  data: assigned,
  message: assigned.already_assigned ? 'Item นี้มี LAB NO. แล้ว' : 'สร้าง LAB NO. แล้ว'
}
