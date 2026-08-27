/*
 * initCraft API Factory Process body
 * Suggested name: Lab - Prepare Manual Result Items
 *
 * Paste only this file's contents inside Process(params, userInfo).
 * Input: { status_record_id: '<Lab Order Item Status _id>' }
 */

const STATUS_COLLECTION = 'zdata_specimen_collection_status'
const RESULT_ITEM_FORM_ID = '6a7aa641935ed08882467374'

const valueText = value => {
  if (value == null) return ''
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return String(value.toHexString())
    if (value.$oid != null) return String(value.$oid)
    if (value._id != null) return valueText(value._id)
    if (value.id != null && typeof value.id !== 'object') return String(value.id)
    if (value.value != null && typeof value.value !== 'object') return String(value.value)
    if (value.code != null) return String(value.code)
    if (value.label != null) return String(value.label)
  }
  return String(value)
}

const asArray = value => {
  let parsed = value
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (Array.isArray(parsed)) return parsed
    if (typeof parsed !== 'string') return []
    try {
      parsed = JSON.parse(parsed || '[]')
    } catch (error) {
      return []
    }
  }
  return Array.isArray(parsed) ? parsed : []
}

const firstText = values => {
  for (const value of values) {
    const text = valueText(value).trim()
    if (text) return text
  }
  return ''
}

const isObjectId = value => /^[a-f\d]{24}$/i.test(String(value || ''))

const statusRecordId = valueText(
  params.status_record_id || params.order_status_id || params.source_order_id
).trim()

if (!statusRecordId || !isObjectId(statusRecordId)) {
  return { success: false, message: 'status_record_id ต้องเป็น record id ของ Lab Status' }
}

if (!app.isAuth(userInfo.roles || [])) {
  return { success: false, message: 'คุณไม่มีสิทธิ์เตรียมรายการผลตรวจ' }
}

let statusRow = null
try {
  const found = await app.dbFindById(
    app.dbObjectId(statusRecordId),
    STATUS_COLLECTION
  )
  statusRow = found && found.reply && found.reply.data
} catch (error) {
  return { success: false, message: 'อ่าน Lab Status ไม่สำเร็จ' }
}

if (!statusRow || Number(statusRow.xrstatx) === 3) {
  return { success: false, message: 'ไม่พบ Lab Status ที่เลือก' }
}

const workStatus = valueText(statusRow.work_status).trim().toLowerCase()
if (['rejected', 'cancelled', 'canceled'].includes(workStatus)) {
  return { success: false, message: 'รายการที่ปฏิเสธหรือยกเลิกแล้วไม่สามารถลงผลได้' }
}

const selectedItems = asArray(statusRow.selected_items || statusRow.selected_items_json)
if (!selectedItems.length) {
  return { success: false, message: 'Lab Status นี้ไม่มีรายการสั่งตรวจ' }
}

const labNo = firstText([statusRow.order_number, statusRow.lab_no])
const sectionCode = firstText([statusRow.section_code, statusRow.lab_section]).toUpperCase()
const sectionName = firstText([statusRow.section_name, sectionCode])
const specimens = asArray(statusRow.specimens || statusRow.specimen_records_json)
const specimenDisplay = specimens
  .map(item => firstText([
    item && item.label,
    item && item.specimen_name,
    item && item.specimen_code,
    item && item.code,
  ]))
  .filter((value, index, all) => value && all.indexOf(value) === index)
  .join(' · ')

const existingProvider = {
  providerId: RESULT_ITEM_FORM_ID,
  providerType: 'FORM',
  params: { statusRecordId },
  options: {
    where: 'order_status_id = :statusRecordId AND xrstatx NOT IN (0,3)',
    orderBy: [{ column: 'result_sequence', sort: 'ASC' }],
    limit: 1000,
    page: 1,
  },
}

let existingRows = []
try {
  const found = await app.sdformGetAll(existingProvider, false, userInfo)
  if (!found || found.success === false) {
    return {
      success: false,
      message: (found && found.message) || 'ค้นหารายการผลตรวจเดิมไม่สำเร็จ',
    }
  }
  existingRows = Array.isArray(found.data) ? found.data : []
} catch (error) {
  return { success: false, message: 'ค้นหารายการผลตรวจเดิมไม่สำเร็จ' }
}

const specimenOf = item => {
  const source = item && (item.c_specimen || item.specimen)
  return source && typeof source === 'object' ? source : {}
}

const itemTestCode = item => firstText([
  item && item.item_code,
  item && item.code,
  item && item.test_code,
  item && item.obs_code,
])

const itemSpecimenCode = item => {
  const specimen = specimenOf(item)
  return firstText([
    item && item.specimen_code,
    specimen.specimen_code,
    specimen.code,
    specimen.value,
  ])
}

const itemSourceId = item => {
  const direct = firstText([
    item && item.id,
    item && item.source_item_id,
    item && item.master_id,
  ])
  if (direct) return direct
  return [sectionCode, itemTestCode(item), itemSpecimenCode(item) || '-'].join(':')
}

const fallbackKey = item => [
  itemTestCode(item),
  itemSpecimenCode(item),
].join('|')

const existingBySource = new Map()
const existingByFallback = new Map()
for (const row of existingRows) {
  const sourceId = valueText(row && row.source_item_id).trim()
  if (sourceId && !existingBySource.has(sourceId)) existingBySource.set(sourceId, row)
  const fallback = [
    valueText(row && (row.test_code || row.obs_code)).trim(),
    valueText(row && row.specimen_code).trim(),
  ].join('|')
  if (fallback !== '|' && !existingByFallback.has(fallback)) {
    existingByFallback.set(fallback, row)
  }
}

const seenSourceIds = new Set()
let createdCount = 0
let existingCount = 0
const createdIds = []

for (let index = 0; index < selectedItems.length; index += 1) {
  const item = selectedItems[index] || {}
  const sourceItemId = itemSourceId(item)
  if (!sourceItemId || seenSourceIds.has(sourceItemId)) continue
  seenSourceIds.add(sourceItemId)

  const testCode = itemTestCode(item)
  const specimenCode = itemSpecimenCode(item)
  const current = existingBySource.get(sourceItemId) || existingByFallback.get(fallbackKey(item))
  if (current) {
    existingCount += 1
    continue
  }

  const resultItem = {
    order_status_id: statusRecordId,
    lab_no: labNo,
    lab_section: sectionCode,
    source_item_id: sourceItemId,
    specimen_code: specimenCode,
    result_sequence: index + 1,
    test_code: testCode,
    obs_code: testCode,
    test_name: firstText([
      item.name,
      item.master_item_name,
      item.test_name,
      item.label,
      testCode,
    ]),
    result_value: '',
    unit_symbol_snapshot: firstText([
      item.unit_symbol,
      item.units,
      item.unit,
    ]),
    reference_range_snapshot: firstText([
      item.reference_range_snapshot,
      item.reference_range,
      item.ref_range,
    ]),
    result_comment: '',
    result_status: 'pending',
    result_source: 'manual',
    interpretation_code: 'N',
    is_critical: false,
    critical_comment: '',
  }

  try {
    const draft = await app.insertData(RESULT_ITEM_FORM_ID, userInfo)
    const draftId = valueText(
      draft && (
        draft.id ||
        (draft.data && (draft.data._id || draft.data.id)) ||
        (draft.reply && (draft.reply.id || (draft.reply.data && draft.reply.data._id)))
      )
    ).trim()

    if (!draft || draft.success === false || !draftId) {
      return {
        success: false,
        message: (draft && draft.message) || 'สร้าง draft รายการผลตรวจไม่สำเร็จ',
        data: {
          order_status_id: statusRecordId,
          created_count: createdCount,
          existing_count: existingCount,
        },
      }
    }

    const saved = await app.sdformSetOne(
      RESULT_ITEM_FORM_ID,
      draftId,
      resultItem,
      1,
      userInfo
    )
    if (!saved || saved.success === false) {
      return {
        success: false,
        message: (saved && saved.message) || 'สร้างรายการผลตรวจไม่สำเร็จ',
        data: {
          order_status_id: statusRecordId,
          created_count: createdCount,
          existing_count: existingCount,
        },
      }
    }
    createdCount += 1
    const savedId = valueText(
      saved.id || (saved.data && (saved.data._id || saved.data.id))
    ).trim()
    if (savedId) createdIds.push(savedId)
  } catch (error) {
    return {
      success: false,
      message: 'สร้างรายการผลตรวจไม่สำเร็จ: ' + valueText(error && error.message || error),
      data: {
        order_status_id: statusRecordId,
        created_count: createdCount,
        existing_count: existingCount,
      },
    }
  }
}

return {
  success: true,
  message: createdCount
    ? 'เตรียมรายการผลตรวจแล้ว ' + createdCount + ' รายการ'
    : 'รายการผลตรวจถูกเตรียมไว้แล้ว',
  data: {
    order_status_id: statusRecordId,
    lab_no: labNo,
    patient_hn: valueText(statusRow.patient_hn).trim(),
    patient_name: valueText(statusRow.patient_name).trim(),
    visit_id: firstText([statusRow.visit_vn, statusRow.visit_id]),
    visit_record_id: valueText(statusRow.visit_id).trim(),
    lab_section: sectionName || sectionCode,
    section_code: sectionCode,
    section_name: sectionName,
    specimen: specimenDisplay,
    work_status: workStatus,
    selected_count: seenSourceIds.size,
    created_count: createdCount,
    existing_count: existingCount,
    created_ids: createdIds,
  },
}
