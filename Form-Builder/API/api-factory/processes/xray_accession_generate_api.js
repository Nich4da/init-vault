/*
 * initCraft API Factory Process
 * Name: X-ray - Generate and assign Accession No. per CPOE Item
 * Deployed Process ID: 6a95cd58422c1ca959829e8d   (ผู้ใช้แจ้ง 2026-09-01)
 *
 * Input:  { item_id: '<zdata_cpoe_order_item _id>' }
 * Output: { success, data: { item_id, accession_no, prefix, modality_code,
 *                            modality_source, date_key, sequence, remaining,
 *                            already_assigned }, message, warning }
 *
 * รูปแบบเลข (ผู้ใช้ยืนยัน 2026-09-01) — ยาวคงที่ 15 ตัวเสมอ:
 *
 *   SM   2026   09   01   DX   001
 *   │    │      │    │    │    └── running 3 หลัก แยกตาม (prefix + วัน + modality)
 *   │    │      │    │    └─────── modality 2 ตัวเสมอ (VCUG ย่อเป็น VC · decision X18)
 *   │    │      │    └──────────── วันที่ตอน "ออกเลข" ไม่ใช่ตอนสั่ง (decision X20)
 *   │    │      └───────────────── เดือน
 *   │    └──────────────────────── ปี ค.ศ. 4 หลัก (ต่างจาก LAB NO. ที่ใช้ พ.ศ.)
 *   └───────────────────────────── prefix โรงพยาบาล
 *
 * ยาว 15 ตัว < ลิมิต AccessionNo 16 ตัวของ RIS (xray_order.json) ทุกเครื่อง
 *
 * กุญแจของ counter = ฟิลด์ที่ปรากฏในเลขเป๊ะๆ (prefix + วัน + modality) เท่านั้น
 *   ห้ามแยก counter ด้วยอะไรที่ไม่ได้พิมพ์ลงในเลข เช่น Section หรือ Organization
 *   เพราะสองหน่วยงานจะออก SM20260901DX001 พร้อมกันแล้วเลขซ้ำทันที
 *
 * ขึ้นวันใหม่เริ่ม 001 เอง เพราะวันอยู่ใน _id ของ counter
 * ครบ 999 แล้ว **ไม่วนกลับ** — รายการที่ 1000 หยุดและแจ้ง error (decision X19)
 *   เลขซ้ำใน PACS = ผลอ่านเกาะผิดเคส แก้ย้อนหลังไม่ได้ จึงเลือกพังแบบดังไว้ก่อน
 *   เตือนล่วงหน้าตั้งแต่ลำดับ 950 ผ่าน field `warning` ของ response
 *
 * **MongoDB ของระบบนี้เป็น standalone** — เปิด transaction ไม่ได้ (แก้ 2026-09-01)
 *   replica set ใช้ mongoTxn ตามเดิม · standalone ตกมาใช้เส้นทางไม่มี session
 *   แบบเดียวกับ lab_no_generate_api.js เป๊ะ ๆ:
 *     · counter เพิ่มด้วย findOneAndUpdate ซึ่ง atomic ต่อเอกสารอยู่แล้ว
 *     · ตัวล็อก idempotent คือเงื่อนไข "accession_no ยังว่าง" บน item เอง
 *     · ล้มกลางคันได้แค่ "เลขข้าม" ซึ่งปลอดภัย — เลขที่จองแล้วไม่ถูกใช้ซ้ำเด็ดขาด
 *   เดิมเรียก mongoTxn ตรง ๆ ทำให้ทุก request ล้มด้วย
 *   "Transaction numbers are only allowed on a replica set member or mongos"
 *   ⇒ ปุ่มส่งเข้าเครื่องไม่เคยได้เลขเลย (อาการที่ผู้ใช้เจอ 2026-09-01)
 *
 * เรียกซ้ำด้วย item_id เดิมจะได้เลขเดิม (idempotent ต่อ Item)
 * 1 order มีได้หลาย item ⇒ หลาย accession · เลขเก็บที่ระดับ item
 *
 * Process นี้ออกเลขอย่างเดียว **ไม่บันทึกการรับและไม่เรียก Agent**
 * ลำดับเต็มของการส่งเข้าเครื่องเป็นหน้าที่ของ xray-cpoe-dispatch (decision X3)
 */

const ITEM_COLLECTION = 'zdata_cpoe_order_item'
const ITEM_MASTER_COLLECTION = 'zdata_master_item_order'
const SECTION_COLLECTION = 'zdata_section'
const COUNTER_COLLECTION = 'zdata_xray_accession_counter'
const XRAY_SERVICE_TYPE = 'xray'
const WAITING_STATUS = 'sent'
const FINANCE_READY_STATUS = 'ready'

/* กลุ่ม "รับเข้าห้องรังสีแล้ว" ทั้งชุด — ต้องตรงกับ bucket active ของ
   STATUS_VOCABULARY ใน xray_cpoe_worklist_api.js และ s.itemState ของฟอร์ม
   เปิดให้ออกเลขย้อนหลังได้ทั้งกลุ่ม เพราะ "รับแล้วแต่ไม่มีเลข" = ยังไม่เสร็จเสมอ
   ไม่ว่า CPOE จะเขียนสถานะเป็นคำไหนในกลุ่มนี้ */
const RECEIVED_STATUSES = ['accepted', 'prepared', 'dispensed', 'dispatched', 'in_progress']
const ASSIGNABLE_STATUSES = [FINANCE_READY_STATUS].concat(RECEIVED_STATUSES)

/* ── รูปแบบเลข · แก้ที่นี่ที่เดียว ─────────────────────────────────────────── */
const ACCESSION_PREFIX = 'SM'
const MAX_SEQUENCE = 999
const SEQUENCE_DIGITS = 3
const WARN_FROM_SEQUENCE = 950
const MODALITY_SEGMENT_LENGTH = 2
const ACCESSION_LENGTH = ACCESSION_PREFIX.length + 8 + MODALITY_SEGMENT_LENGTH + SEQUENCE_DIGITS

/* code ที่ยาวเกิน 2 ตัวต้องมีตัวย่อที่กำหนดไว้ชัดเจนเท่านั้น
   ห้ามตัดคำอัตโนมัติ เพราะ code คนละตัวอาจย่อชนกันแล้วเลขซ้ำโดยไม่มีใครรู้ */
const MODALITY_SEGMENT_ALIAS = {
  VCUG: 'VC'
}

/* หน่วยงานรังสีที่เข้าหน้าจอนี้ได้ — ต้องตรงกันทั้งสาม Process ของ X-ray
   ผู้ใช้ยืนยันผัง 2026-09-01:
     m0900 กลุ่มงานรังสีวิทยา (xray)  = กลุ่มแม่
       ├─ m0901 งานรังสีวิทยา (clinic) = X-ray ธรรมดา
       └─ CT    CT scan / CT-MRI SCAN  = CT/MRI
   นี่เป็น "ประตู" เท่านั้น ไม่ได้กรองข้อมูล — ทุก org ที่ผ่านเข้ามาเห็นรายการรังสี
   ทั้งหมดเหมือนกัน (ผู้ใช้ยืนยัน 2026-09-01 ว่ายังไม่ต้องแยกตาม org) */
const XRAY_ORGANIZATION_CODES = ['m0900', 'm0901', 'CT']

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
const text = value => valueText(value).trim()

/* standalone MongoDB โยน error สองแบบนี้เมื่อขอ session — ไม่ใช่ความผิดของข้อมูล
   ข้อความมาจาก driver ตรง ๆ ใช้ชุดเดียวกับ lab_no_generate_api.js */
const transactionUnsupported = error => {
  const message = text((error && error.message) || error).toLowerCase()
  return message.includes('transaction numbers are only allowed on a replica set member or mongos') ||
    message.includes('transaction support is not available')
}

/* service_type เก็บได้ทั้ง { value: 'xray' } และ 'xray' ตรง ๆ แล้วแต่ชุดข้อมูล
   worklist/dispatch อ่านได้ทั้งสองทรง ตัวนี้ก็ต้องอ่านได้เท่ากัน ไม่งั้นจะมีรายการ
   ที่ worklist มองเห็นแต่ออกเลขไม่ได้ โดยไม่มีใครเดาสาเหตุถูก */
const serviceTypeOf = item => text(
  (item && item.service_type && item.service_type.value != null)
    ? item.service_type.value
    : (item && item.service_type)
).toLowerCase()

const itemId = text(params.item_id)
if (!/^[a-f0-9]{24}$/i.test(itemId)) {
  return { success: false, message: 'item_id ไม่ถูกต้อง' }
}

if (!app.isAuth(userInfo.roles || [])) {
  return { success: false, message: 'ไม่มีสิทธิ์สร้าง Accession No.' }
}

const organizationCode = text(userInfo.unit && userInfo.unit.code).toUpperCase()
const allowedOrganizations = XRAY_ORGANIZATION_CODES
  .map(code => String(code).trim().toUpperCase())
  .filter(Boolean)
if (!organizationCode || !allowedOrganizations.includes(organizationCode)) {
  return {
    success: false,
    message: 'Organization "' + (organizationCode || '-') + '" ไม่ใช่หน่วยงานรังสี จึงออก Accession No. ไม่ได้'
  }
}

/* วัน/เวลาอ่านครั้งเดียวแล้วใช้ต่อทั้ง process เพื่อไม่ให้ข้ามเที่ยงคืนกลางคัน
   แล้วได้ date_key คนละวันกับ counter ที่เพิ่งเพิ่มไป */
const now = text(app.curDate('YYYY-MM-DD HH:mm:ss'))
const nowMatch = /^(\d{4})-(\d{2})-(\d{2})[ T]\d{2}:\d{2}:\d{2}$/.exec(now)
if (!nowMatch) {
  return { success: false, message: 'อ่านวันที่ปัจจุบันจากระบบไม่สำเร็จ' }
}
const gregorianYear = Number(nowMatch[1])
/* กันกรณี server ตั้งเป็น พ.ศ. — ปล่อยผ่านจะได้ SM25690901DX001 ที่ผิดถาวร */
if (!Number.isInteger(gregorianYear) || gregorianYear < 2000 || gregorianYear > 2199) {
  return {
    success: false,
    message: 'ปีที่อ่านได้จากระบบคือ ' + nowMatch[1] + ' ซึ่งไม่ใช่ปี ค.ศ. — Accession No. ต้องใช้ ค.ศ. เท่านั้น'
  }
}
const dateKey = nowMatch[1] + nowMatch[2] + nowMatch[3]

const actor = text(userInfo.username || (userInfo.account && userInfo.account.name))
const itemObjectId = app.dbObjectId(itemId)

/* คืนค่าชุดเดียวกันไม่ว่าจะเจอเลขเดิมตอนไหน — ตอนเริ่ม หรือตอนแพ้ race บน standalone */
const existingResult = item => {
  const existingSequence = Number(item.accession_sequence || 0) || null
  return {
    item_id: itemId,
    accession_no: text(item.accession_no),
    prefix: text(item.accession_prefix) || ACCESSION_PREFIX,
    modality_code: text(item.accession_modality_code).toUpperCase(),
    modality_source: text(item.accession_modality_source).toUpperCase(),
    date_key: text(item.accession_date_key),
    sequence: existingSequence,
    remaining: existingSequence ? MAX_SEQUENCE - existingSequence : null,
    already_assigned: true
  }
}

const assignAccession = async session => {
  const sessionOptions = session ? { session } : {}
  const itemCollection = app.db.collection(ITEM_COLLECTION)
  const masterCollection = app.db.collection(ITEM_MASTER_COLLECTION)
  const sectionCollection = app.db.collection(SECTION_COLLECTION)
  const counterCollection = app.db.collection(COUNTER_COLLECTION)

  const item = await itemCollection.findOne(
    { _id: itemObjectId, xrstatx: { $nin: [0, 3] } },
    sessionOptions
  )
  if (!item) throw new Error('ITEM_NOT_FOUND')
  if (serviceTypeOf(item) !== XRAY_SERVICE_TYPE) throw new Error('ITEM_NOT_XRAY')

  /* idempotent — เรียกซ้ำต้องได้เลขเดิม ห้ามออกเลขใหม่ให้ item เดิมเด็ดขาด */
  if (text(item.accession_no)) return existingResult(item)

  /* รับได้สองกลุ่ม:
       ready           — ทางปกติ Finance ผ่านแล้ว จึงกดส่งเข้าเครื่องครั้งแรกได้
       รับแล้วทั้งกลุ่ม — ครึ่งทางจากบั๊ก standalone (2026-09-01): ถูก mark ว่ารับ/ส่งแล้ว
                        แต่ไม่เคยได้เลขและ RIS ไม่เคยรู้เรื่อง ⇒ ต้องออกเลขย้อนหลังได้
     สถานะอื่น (ออกผลแล้ว/ยกเลิก/ปฏิเสธ) ห้ามออกเลขเด็ดขาด
     เงื่อนไข "accession_no ยังว่าง" ด้านบนกันไม่ให้เลขเดิมถูกทับอยู่แล้ว */
  const currentStatus = text(item.current_status).toLowerCase()
  if (currentStatus === WAITING_STATUS) throw new Error('PAYMENT_NOT_READY')
  if (ASSIGNABLE_STATUSES.indexOf(currentStatus) < 0) {
    throw new Error('ITEM_NOT_WAITING_DISPATCH:' + (currentStatus || '(ว่าง)'))
  }

  let master = null
  if (item.item_data_id) {
    master = await masterCollection.findOne(
      { _id: item.item_data_id, xrstatx: { $nin: [0, 3] } },
      sessionOptions
    )
  }

  /* เครื่องมาจาก master.xray_item.modality เป็นทางหลัก (ผู้ใช้ยืนยัน 2026-08-31)
     ทางสำรองเดียวกับ xray_cpoe_worklist_api.js เพื่อให้สองที่อ่านค่าเดียวกันเสมอ */
  const xrayItem = (master && master.xray_item) || {}
  let modalitySource = text(xrayItem.modality || xrayItem.modality_type)

  if (!modalitySource) {
    let section = item.section_snapshot ||
      (item.xray_context_snapshot && item.xray_context_snapshot.section) ||
      (master && master.section) || {}
    if (!text(section.modality_type) && section.value) {
      const sectionId = typeof section.value === 'string'
        ? app.dbObjectId(section.value)
        : section.value
      const foundSection = await sectionCollection.findOne(
        { _id: sectionId, xrstatx: { $nin: [0, 3] }, enable: { $ne: false } },
        sessionOptions
      )
      if (foundSection) section = foundSection
    }
    modalitySource = text(section.modality_type)
  }

  /* ไม่มีเครื่องผูกไว้ = ไม่ออกเลข (ผู้ใช้ยืนยัน 2026-09-01)
     ปล่อยเป็น UN จะได้เลขที่แก้ย้อนหลังไม่ได้เมื่อส่งเข้า PACS แล้ว */
  if (!modalitySource) throw new Error('MODALITY_MISSING')
  if (!/^[A-Za-z0-9]{1,8}$/.test(modalitySource)) throw new Error('MODALITY_INVALID')
  modalitySource = modalitySource.toUpperCase()

  const modalityCode = MODALITY_SEGMENT_ALIAS[modalitySource] || modalitySource
  if (modalityCode.length !== MODALITY_SEGMENT_LENGTH) throw new Error('MODALITY_SEGMENT_UNDEFINED:' + modalitySource)

  /* running แยกตาม prefix + วัน + modality — ตรงกับฟิลด์ที่พิมพ์ลงในเลขพอดี
     วันอยู่ใน _id อยู่แล้ว ขึ้นวันใหม่จึงเริ่ม 001 เองโดยไม่ต้องมี job ล้าง */
  const counterId = ['xray_accession', ACCESSION_PREFIX, dateKey, modalityCode].join(':')
  const counterResult = await counterCollection.findOneAndUpdate(
    { _id: counterId },
    [
      {
        $set: {
          prefix: ACCESSION_PREFIX,
          modality_code: modalityCode,
          date_key: dateKey,
          sequence: { $add: [{ $ifNull: ['$sequence', 0] }, 1] },
          created_at: { $ifNull: ['$created_at', now] },
          updated_at: now,
          updated_by: actor
        }
      }
    ],
    Object.assign({ upsert: true, returnDocument: 'after' }, sessionOptions)
  )
  const counter = counterResult && (counterResult.value || counterResult)
  const sequence = Number(counter && counter.sequence)
  if (!Number.isInteger(sequence) || sequence < 1) throw new Error('COUNTER_INVALID')

  /* ครบ 999 แล้วหยุด ไม่วนกลับ 001 (decision X19)
     บน replica set การ throw ทำให้ transaction rollback ⇒ counter ไม่ถูกเผาทิ้ง
     บน standalone counter ค้างอยู่ที่ค่าที่เกินแล้ว ซึ่งไม่เป็นไร เพราะจุดประสงค์
     คือ "หยุดออกเลขของวันนี้" อยู่แล้ว และการค้างทำให้หยุดค้างไว้จริง ๆ */
  if (sequence > MAX_SEQUENCE) throw new Error('SEQUENCE_EXHAUSTED')

  const accessionNo = ACCESSION_PREFIX + dateKey + modalityCode +
    String(sequence).padStart(SEQUENCE_DIGITS, '0')
  if (accessionNo.length !== ACCESSION_LENGTH) throw new Error('ACCESSION_LENGTH_INVALID')

  /* counter ถูกแก้มือหรือ restore ทับ อาจทำให้เลขชนของเดิมได้ — กันไว้อีกชั้น */
  const duplicate = await itemCollection.findOne(
    {
      _id: { $ne: itemObjectId },
      accession_no: accessionNo,
      xrstatx: { $nin: [0, 3] }
    },
    Object.assign({ projection: { _id: 1 } }, sessionOptions)
  )
  if (duplicate) throw new Error('ACCESSION_COLLISION')

  const saved = await itemCollection.updateOne(
    {
      _id: itemObjectId,
      xrstatx: { $nin: [0, 3] },
      current_status: { $in: ASSIGNABLE_STATUSES },
      $or: [
        { accession_no: { $exists: false } },
        { accession_no: null },
        { accession_no: '' }
      ]
    },
    {
      $set: {
        accession_no: accessionNo,
        accession_prefix: ACCESSION_PREFIX,
        accession_modality_code: modalityCode,
        accession_modality_source: modalitySource,
        accession_date_key: dateKey,
        accession_sequence: sequence,
        accession_generated_at: now,
        accession_generated_by: actor,
        updated_at: now,
        updated_by: actor
      }
    },
    sessionOptions
  )
  if (!saved || Number(saved.matchedCount) !== 1) {
    /* บน standalone สองคำขอพร้อมกันอาจจองคนละเลข แล้วมีคนเดียวที่เขียนสำเร็จ
       ตัวที่แพ้ต้องคืน "เลขของผู้ชนะ" ไม่ใช่ error และไม่ใช่เลขที่ตัวเองจองไว้
       เลขที่จองแล้วไม่ได้ใช้จะกลายเป็นช่องว่างในลำดับ ซึ่งยอมรับได้ (เหมือน LAB NO.) */
    if (!session) {
      const raced = await itemCollection.findOne({ _id: itemObjectId, xrstatx: { $nin: [0, 3] } })
      if (raced && text(raced.accession_no)) return existingResult(raced)
    }
    throw new Error('ITEM_ASSIGN_CONFLICT')
  }

  return {
    item_id: itemId,
    accession_no: accessionNo,
    prefix: ACCESSION_PREFIX,
    modality_code: modalityCode,
    modality_source: modalitySource,
    date_key: dateKey,
    sequence,
    remaining: MAX_SEQUENCE - sequence,
    already_assigned: false
  }
}

let assigned
try {
  try {
    assigned = await this.mongoTxn(
      session => assignAccession(session),
      { name: 'generateXrayAccession', maxRetry: 5, timeoutMs: 15000 }
    )
  } catch (error) {
    if (!transactionUnsupported(error)) throw error
    assigned = await assignAccession(null)
  }
} catch (error) {
  const raw = text((error && error.message) || error)
  const code = raw.split(':')[0]
  const detail = raw.slice(code.length + 1)
  const messages = {
    ITEM_NOT_FOUND: 'ไม่พบ CPOE Item ที่ต้องการออก Accession No.',
    ITEM_NOT_XRAY: 'ออก Accession No. ได้เฉพาะรายการทางรังสี',
    PAYMENT_NOT_READY: 'ยังไม่ผ่านการเงิน จึงยังออก Accession No. และรับเข้าห้องรังสีไม่ได้',
    ITEM_NOT_WAITING_DISPATCH: 'ออก Accession No. ไม่ได้ — รายการนี้อยู่สถานะ "' + detail +
      '" ซึ่งออกผล/ยกเลิก/ปฏิเสธไปแล้ว · ออกได้เฉพาะรายการที่ผ่านการเงิน หรือรับแล้วแต่ยังไม่ได้เลข',
    MODALITY_MISSING: 'รายการนี้ยังไม่มีเครื่องผูกไว้ใน master จึงออก Accession No. ไม่ได้ — แจ้งผู้ดูแลตรวจสอบ item master',
    MODALITY_INVALID: 'รหัสเครื่องของรายการนี้ไม่อยู่ในรูปแบบที่ใช้ประกอบเลข Accession ได้',
    MODALITY_SEGMENT_UNDEFINED: 'รหัสเครื่อง "' + detail + '" ยาวไม่เท่า ' + MODALITY_SEGMENT_LENGTH +
      ' ตัว และยังไม่ได้กำหนดตัวย่อไว้ — เพิ่มที่ MODALITY_SEGMENT_ALIAS ก่อนจึงออกเลขได้',
    COUNTER_INVALID: 'ลำดับ Accession No. ไม่ถูกต้อง',
    SEQUENCE_EXHAUSTED: 'เครื่องนี้ออกเลขครบ ' + MAX_SEQUENCE + ' รายการแล้วสำหรับวันนี้ ' +
      'ระบบหยุดออกเลขเพื่อไม่ให้เลขซ้ำ — แจ้งผู้ดูแลระบบทันที',
    ACCESSION_LENGTH_INVALID: 'เลข Accession ที่สร้างได้ยาวไม่ตรงรูปแบบ จึงไม่บันทึก',
    ACCESSION_COLLISION: 'เลข Accession ที่จะออกถูกใช้ไปแล้ว จึงไม่ออกเลขซ้ำ — ตรวจสอบ counter ของเครื่องนี้',
    ITEM_ASSIGN_CONFLICT: 'รายการถูกเปลี่ยนแปลงระหว่างออก Accession No. กรุณาลองใหม่'
  }
  return { success: false, message: messages[code] || 'ออก Accession No. ไม่สำเร็จ: ' + raw }
}

const warning = (!assigned.already_assigned && Number(assigned.sequence) >= WARN_FROM_SEQUENCE)
  ? ('เครื่อง ' + assigned.modality_code + ' ใช้เลขวันนี้ไปแล้ว ' + assigned.sequence +
     ' จาก ' + MAX_SEQUENCE + ' — เหลืออีก ' + assigned.remaining + ' รายการจะหยุดออกเลข')
  : ''

return {
  success: true,
  data: assigned,
  warning,
  message: assigned.already_assigned ? 'รายการนี้มี Accession No. แล้ว' : 'ออก Accession No. แล้ว'
}
