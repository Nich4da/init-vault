/*
 * initCraft API Factory Process
 * API id: 6a79ff46d5218a5b6a26bebc
 * Name: Multi Lab - Reject Specimen
 *
 * source_order_id is the _id of zdata_specimen_collection_status.
 * rejection_record_id is the saved _id from form 6a7713fdcc7d0a8451130331
 * (zdata_lab_receive).  The form remains the rejection audit record; this
 * process changes only the matching Multi Lab Status row.
 */

const STATUS_COLLECTION = 'zdata_specimen_collection_status'
const REJECTION_COLLECTION = 'zdata_lab_receive'

const valueText = value => {
  if (value == null) return ''
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return String(value.toHexString())
    if (value.$oid != null) return String(value.$oid)
    if (value._id != null) return valueText(value._id)
    if (value.id != null) return valueText(value.id)
    if (value.value != null && typeof value.value !== 'object') return String(value.value)
  }
  return String(value)
}

const sourceOrderId = valueText(params.source_order_id).trim()
const rejectionRecordId = valueText(params.rejection_record_id).trim()
const action = valueText(params.action || 'reject').trim().toLowerCase()
const isObjectId = value => /^[a-f\d]{24}$/i.test(value)

if (!sourceOrderId || !isObjectId(sourceOrderId)) {
  return { success: false, message: 'source_order_id ต้องเป็น record id ของ Lab Status' }
}

if (!app.isAuth(userInfo.roles || [])) {
  return { success: false, message: 'คุณไม่มีสิทธิ์เปลี่ยนสถานะใบสั่งตรวจ' }
}

let order
try {
  const found = await app.dbFindById(app.dbObjectId(sourceOrderId), STATUS_COLLECTION)
  order = found && found.reply && found.reply.data
} catch (error) {
  return { success: false, message: 'ไม่พบ Lab Status ที่ต้องการปฏิเสธ' }
}

if (!order || Number(order.xrstatx) === 3) {
  return { success: false, message: 'ไม่พบ Lab Status ที่ต้องการปฏิเสธ' }
}

const orderNumber = valueText(order.order_number || order.lab_no).trim()
const sectionCode = valueText(order.section_code).trim()
const requestedOrderNumber = valueText(params.order_number).trim()
const requestedSectionCode = valueText(params.section_code || params.lab_section).trim()

if (requestedOrderNumber && requestedOrderNumber !== orderNumber) {
  return { success: false, message: 'LAB NO. ไม่ตรงกับ Lab Status ที่เลือก' }
}

if (requestedSectionCode && requestedSectionCode !== sectionCode) {
  return { success: false, message: 'ห้อง Lab ไม่ตรงกับ Lab Status ที่เลือก' }
}

const currentStatus = valueText(order.work_status || 'waiting_receive').trim().toLowerCase()
const now = app.curDate('YYYY-MM-DD HH:mm:ss')
const actor = valueText(
  userInfo.username ||
  (userInfo.account && (userInfo.account.name || userInfo.account.username)) ||
  ''
)

if (action === 'recheck') {
  if (currentStatus !== 'rejected') {
    return { success: false, message: 'เฉพาะรายการที่ปฏิเสธแล้วเท่านั้นที่ส่งตรวจใหม่ได้' }
  }

  const saved = await app.dbUpdate(
    {
      work_status: 'waiting_receive',
      received_at: now,
      received_by: actor,
      rechecked_at: now,
      rechecked_by: actor
    },
    STATUS_COLLECTION,
    userInfo,
    { _id: app.dbObjectId(sourceOrderId) }
  )
  if (!saved || !saved.success) {
    return { success: false, message: (saved && saved.message) || 'ย้ายรายการกลับหน้ารอรับไม่สำเร็จ' }
  }

  return {
    success: true,
    data: {
      order_id: sourceOrderId,
      order_number: orderNumber,
      section_code: sectionCode,
      work_status: 'waiting_receive',
      received_at: now,
      received_by: actor,
      rechecked_at: now,
      rechecked_by: actor
    },
    message: 'ย้ายรายการกลับหน้ารอรับแล้ว'
  }
}

let rejection = null
if (rejectionRecordId) {
  if (!isObjectId(rejectionRecordId)) {
    return { success: false, message: 'rejection_record_id ไม่ถูกต้อง' }
  }
  try {
    const found = await app.dbFindById(app.dbObjectId(rejectionRecordId), REJECTION_COLLECTION)
    rejection = found && found.reply && found.reply.data
  } catch (error) {
    return { success: false, message: 'ไม่พบแบบฟอร์มเหตุผลการปฏิเสธที่เพิ่งบันทึก' }
  }
  if (!rejection) {
    return { success: false, message: 'ไม่พบแบบฟอร์มเหตุผลการปฏิเสธที่เพิ่งบันทึก' }
  }
  if (valueText(rejection.source_order_id).trim() !== sourceOrderId) {
    return { success: false, message: 'แบบฟอร์มปฏิเสธไม่ตรงกับ Lab Status ที่เลือก' }
  }
}

const rejectReasonCode = valueText(
  (rejection && rejection.reject_reason_code) || params.reject_reason_code
).trim()
const rejectReasonDetail = valueText(
  (rejection && rejection.reject_reason_detail) || params.reject_reason_detail
).trim()

if (!rejectReasonCode) {
  return { success: false, message: 'กรุณาเลือกเหตุผลการปฏิเสธ' }
}

if (currentStatus === 'rejected') {
  return {
    success: true,
    data: {
      order_id: sourceOrderId,
      order_number: orderNumber,
      section_code: sectionCode,
      work_status: 'rejected',
      already_rejected: true
    },
    message: 'รายการนี้ถูกปฏิเสธแล้ว'
  }
}

if (['processing', 'resulted', 'completed', 'cancelled'].includes(currentStatus)) {
  return { success: false, message: 'ไม่สามารถปฏิเสธรายการที่กำลังตรวจ/ออกผล/ยกเลิกแล้ว' }
}

const saved = await app.dbUpdate(
  {
    work_status: 'rejected',
    rejected_at: now,
    rejected_by: actor,
    reject_reason_code: rejectReasonCode,
    reject_reason_detail: rejectReasonDetail
  },
  STATUS_COLLECTION,
  userInfo,
  { _id: app.dbObjectId(sourceOrderId) }
)
if (!saved || !saved.success) {
  return { success: false, message: (saved && saved.message) || 'อัปเดตสถานะปฏิเสธสิ่งส่งตรวจไม่สำเร็จ' }
}

if (rejectionRecordId) {
  await app.dbUpdate(
    {
      rejected_at: now,
      rejected_by: actor,
      rejection_status: 'applied'
    },
    REJECTION_COLLECTION,
    userInfo,
    { _id: app.dbObjectId(rejectionRecordId) }
  )
}

return {
  success: true,
  data: {
    order_id: sourceOrderId,
    order_number: orderNumber,
    section_code: sectionCode,
    work_status: 'rejected',
    rejection_record_id: rejectionRecordId,
    rejected_at: now,
    rejected_by: actor
  },
  message: 'ปฏิเสธสิ่งส่งตรวจแล้ว'
}
