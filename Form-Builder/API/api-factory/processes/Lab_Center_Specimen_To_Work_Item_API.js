/*
 * initCraft API Factory Process
 * Name: Lab Center Specimen - Emit Lab Work Item
 *
 * Call only after Lab Center Specimen has successfully changed the source row
 * to `sent`. The operation is idempotent: the same source specimen + section
 * updates its existing work item instead of creating a duplicate.
 *
 * Input:
 * { source_record: <one row returned by Lab Center Specimen action:list> }
 */

const WORK_ITEM_FORM_ID = '6a7e818b8d398c11cf2fe8d4'

if (!app.isAuth(userInfo.roles || [])) {
  return { success: false, message: 'คุณไม่มีสิทธิ์สร้างงานห้องปฏิบัติการ' }
}

const source = params.source_record && typeof params.source_record === 'object'
  ? params.source_record
  : null

if (!source) {
  return { success: false, message: 'ต้องระบุ source_record จาก Lab Center Specimen' }
}

const sourceRecordId = String(source._id || source.id || source.order_number || '').trim()
const sectionCode = String(source.section_code || source.lab_section || '').trim().toUpperCase()
const sectionName = String(source.section_name || sectionCode || '').trim()

if (!sourceRecordId || !sectionCode) {
  return {
    success: false,
    message: 'ข้อมูล Lab Center Specimen ต้องมี source record และ section_code'
  }
}

const asArray = (value) => {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}

const now = app.curDate('YYYY-MM-DD HH:mm:ss')
const actor = String(
  userInfo.username ||
  (userInfo.account && (userInfo.account.name || userInfo.account.username)) ||
  ''
)

const selectedItems = asArray(source.selected_items || source.selected_items_json)
const specimens = asArray(source.specimens || source.specimen_json)
const provider = {
  providerId: WORK_ITEM_FORM_ID,
  providerType: 'FORM',
  params: { source_specimen_record_id: sourceRecordId, section_code: sectionCode },
  options: {
    where: 'source_specimen_record_id = :source_specimen_record_id AND section_code = :section_code',
    limit: 1
  }
}

let existing = null
try {
  const found = await app.sdformGetAll(provider, false, userInfo)
  existing = found && Array.isArray(found.data) ? found.data[0] : null
} catch (error) {
  return { success: false, message: 'ค้นหา Lab Work Item เดิมไม่สำเร็จ' }
}

const data = {
  source_order_id: String(source.source_order_id || source.order_id || source.order_number || ''),
  source_order_number: String(source.order_number || ''),
  source_specimen_record_id: sourceRecordId,
  lab_no: String(source.lab_no || ''),
  section_code: sectionCode,
  section_name: sectionName,
  work_status: 'waiting_receive',
  patient_hn: String(source.patient_hn || ''),
  patient_name: String(source.patient_name || ''),
  ward_clinic: String(source.ward_clinic || ''),
  ordered_at: String(source.ordered_at || source.created_at || ''),
  specimen_json: JSON.stringify(specimens),
  selected_items_json: JSON.stringify(selectedItems),
  central_checked_at: String(source.checked_at || source.central_checked_at || ''),
  central_checked_by: String(source.checked_by || source.central_checked_by || ''),
  central_forwarded_at: String(source.sent_at || source.central_forwarded_at || now),
  central_forwarded_by: String(source.sent_by || source.central_forwarded_by || actor)
}

try {
  const saved = await app.sdformSetOne(
    WORK_ITEM_FORM_ID,
    existing && existing._id ? String(existing._id) : '',
    data,
    2,
    userInfo
  )

  if (!saved || saved.success === false) {
    return { success: false, message: (saved && saved.message) || 'บันทึก Lab Work Item ไม่สำเร็จ' }
  }

  return {
    success: true,
    data: {
      work_item_id: saved.id || (saved.data && saved.data._id) || (existing && existing._id) || '',
      action: existing ? 'updated' : 'created',
      source_specimen_record_id: sourceRecordId,
      section_code: sectionCode,
      work_status: 'waiting_receive'
    },
    message: existing ? 'อัปเดตงานห้องปฏิบัติการแล้ว' : 'สร้างงานห้องปฏิบัติการแล้ว'
  }
} catch (error) {
  return { success: false, message: 'บันทึก Lab Work Item ไม่สำเร็จ' }
}
