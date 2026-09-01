/*
 * initCraft API Factory Process
 * API id: 6a79ff46d5218a5b6a26bebc
 * Name: LAB - Reject one CPOE Item into Lab Work Item
 *
 * Input:
 *   {
 *     action: 'reject_item',
 *     item_id: '<zdata_cpoe_order_item _id>',
 *     rejection_record_id: '<zdata_lab_receive _id>',
 *     order_id: '<optional zdata_cpoe_order _id>',
 *     order_number: '<optional source order number>',
 *     section_code: '<optional LAB section code>'
 *   }
 *
 * The saved rejection form is the audit record. CPOE is read-only. A reject
 * before specimen receipt creates a rejected Lab Work Item without allocating
 * a LAB NO. If a waiting Work Item already exists, the status transition uses
 * compare-and-set so a concurrent receive cannot be overwritten.
 */

const ITEM_COLLECTION = 'zdata_cpoe_order_item'
const ORDER_COLLECTION = 'zdata_cpoe_order'
const ITEM_MASTER_COLLECTION = 'zdata_master_item_order'
const SECTION_COLLECTION = 'zdata_section'
const WORK_ITEM_COLLECTION = 'zdata_lab_work_item'
const OUTBOUND_COLLECTION = 'zdata_lab_outband_order'
const REJECTION_COLLECTION = 'zdata_lab_receive'
const ORDER_CANCELLATION_COLLECTION = 'zdata_lab_order_cancellation'

const ORGANIZATION_SECTION_CODES = {
  M1000: ['BC', 'IM', 'BB', 'MB', 'HM', 'MY', 'HH', 'MI-OUT', 'BG', 'ML'],
  M1001: ['BC'], M1002: ['BB'], M1003: ['ML'], M0104: ['HM', 'HH'],
  M1004: ['HM', 'HH'], M1005: ['MB', 'MY'], M1006: ['IM', 'MI-OUT'],
  M1007: ['BG'], '10': ['BC'], '20': ['HM'], '20-22': ['HM', 'HH'],
  '21': ['ML'], '22': ['HH'], '30': ['IM'], '31': ['MI-OUT'],
  '40': ['MB'], '41': ['MY'], '50': ['BB'], '70': ['BG']
}

const valueText = value => {
  if (value == null) return ''
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return String(value.toHexString())
    if (value.$oid != null) return String(value.$oid)
    if (value._id != null) return valueText(value._id)
    if (value.id != null) return valueText(value.id)
    if (value.code != null) return String(value.code)
    if (value.value != null && typeof value.value !== 'object') return String(value.value)
    if (value.label != null) return String(value.label)
  }
  return String(value)
}
const text = value => valueText(value).trim()
const lower = value => text(value).toLowerCase()
const isObjectId = value => /^[a-f\d]{24}$/i.test(text(value))
const orderReference = item => item && item.order_id && item.order_id.value
  ? item.order_id.value
  : item && item.xparentx
const active = { $nin: [0, 3] }

const action = lower(params && params.action || 'reject_item')
const itemId = text(params && (params.item_id || params.source_order_id))
const rejectionRecordId = text(params && params.rejection_record_id)

if (!['reject_item', 'reject'].includes(action)) {
  return { success: false, error: 'unsupported_action', message: 'Process นี้เปิดใช้เฉพาะการปฏิเสธ Lab Item' }
}
if (!isObjectId(itemId)) {
  return { success: false, error: 'invalid_item_id', message: 'item_id ต้องเป็น ObjectId ของ CPOE Item' }
}
if (!isObjectId(rejectionRecordId)) {
  return { success: false, error: 'invalid_rejection_record_id', message: 'กรุณาบันทึกฟอร์มเหตุผลการปฏิเสธก่อน' }
}
if (!app.isAuth(userInfo.roles || [])) {
  return { success: false, error: 'forbidden', message: 'ไม่มีสิทธิ์ปฏิเสธ LAB Item' }
}

const organizationCode = text(userInfo.unit && userInfo.unit.code).toUpperCase()
const allowedSections = ORGANIZATION_SECTION_CODES[organizationCode] || []
if (!allowedSections.length) {
  return { success: false, error: 'organization_not_lab', message: 'Organization ปัจจุบันไม่ได้ผูกกับห้อง LAB' }
}

const actorCode = text(userInfo.employee_code || userInfo.username || userInfo.account && (userInfo.account.code || userInfo.account.name))
const actorName = text(userInfo.fullname || userInfo.display_name || userInfo.account && (userInfo.account.label || userInfo.account.name) || actorCode)
const actorId = userInfo._id || userInfo.id || userInfo.account && (userInfo.account._id || userInfo.account.id) || ''
const actorAudit = { id: actorId, name: actorName || actorCode }
const now = text(app.curDate('YYYY-MM-DD HH:mm:ss'))
const itemObjectId = app.dbObjectId(itemId)
if (!actorCode) return { success: false, error: 'actor_missing', message: 'ไม่พบผู้ปฏิเสธจากบัญชีผู้ใช้' }

let rejection = null
try {
  const found = await app.dbFindById(app.dbObjectId(rejectionRecordId), REJECTION_COLLECTION)
  rejection = found && found.reply && found.reply.data
} catch (error) {
  return { success: false, error: 'rejection_record_not_found', message: 'ไม่พบฟอร์มเหตุผลการปฏิเสธที่เพิ่งบันทึก' }
}
if (!rejection || Number(rejection.xrstatx) === 3) {
  return { success: false, error: 'rejection_record_not_found', message: 'ไม่พบฟอร์มเหตุผลการปฏิเสธที่เพิ่งบันทึก' }
}
if (text(rejection.source_order_id) !== itemId) {
  return { success: false, error: 'rejection_record_mismatch', message: 'ฟอร์มเหตุผลไม่ตรงกับ CPOE Item ที่เลือก' }
}
const rejectReasonCode = text(rejection.reject_reason_code)
const rejectReasonDetail = text(rejection.reject_reason_detail)
if (!rejectReasonCode) {
  return { success: false, error: 'reject_reason_missing', message: 'กรุณาเลือกเหตุผลการปฏิเสธ' }
}
const syncRejectionAudit = async (rejectedAt, rejectedBy) => {
  try {
    const auditSaved = await app.dbUpdate(
      {
        rejected_at: text(rejectedAt) || now,
        rejected_by: text(rejectedBy && typeof rejectedBy === 'object' ? (rejectedBy.name || rejectedBy.label || rejectedBy.username) : rejectedBy) || actorName || actorCode,
        rejection_status: 'applied'
      },
      REJECTION_COLLECTION,
      userInfo,
      { _id: app.dbObjectId(rejectionRecordId), source_order_id: itemId, rejection_status: { $ne: 'void' } }
    )
    return !auditSaved || auditSaved.success === false
  } catch (error) {
    return true
  }
}

const itemCollection = app.db.collection(ITEM_COLLECTION)
const orderCollection = app.db.collection(ORDER_COLLECTION)
const masterCollection = app.db.collection(ITEM_MASTER_COLLECTION)
const sectionCollection = app.db.collection(SECTION_COLLECTION)
const workCollection = app.db.collection(WORK_ITEM_COLLECTION)
const outboundCollection = app.db.collection(OUTBOUND_COLLECTION)
const cancellationCollection = app.db.collection(ORDER_CANCELLATION_COLLECTION)

const item = await itemCollection.findOne({ _id: itemObjectId, xrstatx: active })
if (!item) return { success: false, error: 'item_not_found', message: 'ไม่พบ CPOE Item ที่ต้องการปฏิเสธ' }
if (lower(item.service_type && item.service_type.value) !== 'lab') {
  return { success: false, error: 'item_not_lab', message: 'ปฏิเสธได้เฉพาะ LAB Item' }
}

const orderRef = orderReference(item)
if (!orderRef) return { success: false, error: 'order_reference_missing', message: 'Item ไม่มีข้อมูลเชื่อม CPOE Order' }
const order = await orderCollection.findOne({ _id: orderRef, xrstatx: active })
if (!order) return { success: false, error: 'order_not_found', message: 'ไม่พบ CPOE Order ของ Item นี้' }
const cancellationQuery = {
  _id: order._id,
  xrstatx: active,
  cancel_status: { $in: ['pending', 'applied'] }
}
if (await cancellationCollection.findOne(cancellationQuery)) {
  return { success: false, error: 'order_cancelled', message: 'Order นี้ถูกยกเลิกแล้ว จึงปฏิเสธ Item ซ้ำไม่ได้' }
}

const orderId = text(order._id)
const orderNumber = text(order.order_number)
const requestedOrderId = text(params && params.order_id)
const requestedOrderNumber = text(params && params.order_number)
if (requestedOrderId && requestedOrderId !== orderId) {
  return { success: false, error: 'order_mismatch', message: 'CPOE Order ไม่ตรงกับ Item ที่เลือก' }
}
if (requestedOrderNumber && requestedOrderNumber !== orderNumber) {
  return { success: false, error: 'order_number_mismatch', message: 'เลขที่ใบสั่งไม่ตรงกับ Item ที่เลือก' }
}
if (text(rejection.order_group_id) && text(rejection.order_group_id) !== orderNumber && text(rejection.order_group_id) !== orderId) {
  return { success: false, error: 'rejection_order_mismatch', message: 'ฟอร์มเหตุผลไม่ตรงกับ CPOE Order ของ Item' }
}

let master = null
if (item.item_data_id) master = await masterCollection.findOne({ _id: item.item_data_id, xrstatx: active })
let section = item.section_snapshot || item.lab_context_snapshot && item.lab_context_snapshot.section || master && master.section || {}
if (!text(section.code) && section.value) {
  const sectionId = typeof section.value === 'string' ? app.dbObjectId(section.value) : section.value
  const foundSection = await sectionCollection.findOne({ _id: sectionId, xrstatx: active, enable: { $ne: false } })
  if (foundSection) section = foundSection
}
const sectionCode = text(section.code).toUpperCase()
const sectionName = text(section.name_th || section.name || section.label || sectionCode)
if (!sectionCode) return { success: false, error: 'section_missing', message: 'ไม่พบห้อง LAB ของ Item นี้' }
if (!allowedSections.includes(sectionCode)) {
  return { success: false, error: 'section_forbidden', message: 'Item นี้ไม่ได้อยู่ใน Section ของ Organization ปัจจุบัน' }
}
const requestedSectionCode = text(params && (params.section_code || params.lab_section)).toUpperCase()
if (requestedSectionCode && requestedSectionCode !== sectionCode) {
  return { success: false, error: 'section_mismatch', message: 'ห้อง LAB ไม่ตรงกับ Item ที่เลือก' }
}
if (text(rejection.lab_section) && text(rejection.lab_section).toUpperCase() !== sectionCode) {
  return { success: false, error: 'rejection_section_mismatch', message: 'ห้อง LAB ในฟอร์มเหตุผลไม่ตรงกับ Item ที่เลือก' }
}

let workItem = await workCollection.findOne({
  xrstatx: active,
  $or: [{ _id: itemObjectId }, { source_specimen_record_id: itemId }]
})
if (workItem && lower(workItem.work_status) === 'rejected') {
  const auditSyncPending = await syncRejectionAudit(workItem.rejected_at, workItem.rejected_by)
  return {
    success: true,
    data: {
      item_id: itemId,
      work_item_id: text(workItem._id),
      order_id: orderId,
      order_number: orderNumber,
      section_code: sectionCode,
      work_status: 'rejected',
      rejection_record_id: text(workItem.rejection_record_id || rejectionRecordId),
      rejected_at: text(workItem.rejected_at),
      rejected_by: workItem.rejected_by || '',
      reject_reason_code: text(workItem.reject_reason_code),
      reject_reason_detail: text(workItem.reject_reason_detail),
      already_rejected: true,
      audit_sync_pending: auditSyncPending
    },
    message: auditSyncPending ? 'LAB Item นี้ถูกปฏิเสธแล้ว แต่ Log ยังรอ reconcile' : 'LAB Item นี้ถูกปฏิเสธแล้ว'
  }
}

const outbound = await outboundCollection.findOne({
  xrstatx: active,
  $or: [{ _id: itemObjectId }, { work_item_id: itemId }]
})
if (outbound) {
  return { success: false, error: 'outbound_exists', message: 'Item นี้มี Outbound Order แล้ว จึงไม่อนุญาตให้ปฏิเสธจากหน้ารอรับ' }
}

const currentItemStatus = lower(item.current_status)
// Keep rejection eligibility identical to the Worklist's effective-status rule.
// Some legacy CPOE Items say accepted/prepared/ready/dispensed even though LAB
// has never received them. Without a Work Item, LAB NO., or received_at, the
// Worklist intentionally presents those Items as sent (รอรับ), so Reject must
// accept the same effective state instead of failing on the stale CPOE value.
const legacyWaitingStatuses = ['accepted', 'prepared', 'ready', 'dispensed']
const hasLegacyReceiptEvidence = Boolean(text(item.received_at) || text(item.lab_no))
const effectiveItemStatus = !workItem && legacyWaitingStatuses.includes(currentItemStatus) && !hasLegacyReceiptEvidence
  ? 'sent'
  : currentItemStatus
if (!workItem && effectiveItemStatus !== 'sent') {
  return { success: false, error: 'item_not_waiting_receive', message: 'ปฏิเสธได้เฉพาะ Item ที่อยู่ในสถานะรอรับ specimen' }
}
if (workItem && lower(workItem.work_status) !== 'waiting_receive') {
  return { success: false, error: 'invalid_work_status', message: 'ปฏิเสธไม่ได้ในสถานะ ' + (lower(workItem.work_status) || 'ไม่ทราบสถานะ') }
}
if (await cancellationCollection.findOne(cancellationQuery)) {
  return { success: false, error: 'order_cancelled', message: 'Order นี้ถูกยกเลิกระหว่างทำรายการ กรุณาโหลดใหม่' }
}

const patient = order.vid && order.vid.pid || {}
const patientHn = text(patient.hn)
const patientName = [text(patient.prename), text(patient.p_fname || patient.first_name), text(patient.p_lname || patient.last_name)]
  .filter(Boolean).join(' ') || patientHn
const labData = item.lab_data && typeof item.lab_data === 'object' ? item.lab_data : {}
const masterLab = master && master.lab_item && typeof master.lab_item === 'object' ? master.lab_item : {}
const masterSpecimen = masterLab.specimen && !Array.isArray(masterLab.specimen) ? masterLab.specimen : {}
const rejectionPatch = {
  work_status: 'rejected',
  rejection_record_id: rejectionRecordId,
  rejected_at: now,
  rejected_by: actorAudit,
  reject_reason_code: rejectReasonCode,
  reject_reason_detail: rejectReasonDetail,
  updated_at: now,
  updated_by: actorAudit
}

let created = false
if (!workItem) {
  const workItemDoc = {
    _id: itemObjectId,
    xparentx: itemObjectId,
    xsitex: userInfo.site || {},
    xunitx: { code: sectionCode, name: sectionName },
    xrstatx: 1,
    xversionx: 'v1',
    xerrorx: null,
    dataid: itemId,
    created_by: actorAudit,
    created_at: now,
    source_order_id: orderId,
    source_order_number: orderNumber,
    source_specimen_record_id: itemId,
    lab_no: '',
    section_code: sectionCode,
    section_name: sectionName,
    patient_hn: patientHn,
    visit_id: text(order.vid && (order.vid.vn || order.vid.value) || order.xparentx),
    patient_name: patientName,
    ward_clinic: text(order.vid && (order.vid.ward || order.vid.visit_clinic)),
    ordered_at: text(order.created_at),
    specimen_json: JSON.stringify({
      code: text(labData.spec_source_code || masterSpecimen.code),
      name: text(labData.spec_source || labData.source || masterSpecimen.name),
      collected_at: text(labData.specimen_at || labData.at),
      collected_by: text(labData.specimen_by || labData.by)
    }),
    selected_items_json: JSON.stringify([{
      seq: Number(item.item_no || 1),
      source_item_id: itemId,
      item_code: text(item.item_code),
      item_name: text(item.item_name || master && master.item_name),
      test_code: text(masterLab.his_lab_code),
      specimen_code: text(labData.spec_source_code || masterSpecimen.code)
    }]),
    ...rejectionPatch
  }
  try {
    await workCollection.insertOne(workItemDoc)
    workItem = workItemDoc
    created = true
  } catch (error) {
    workItem = await workCollection.findOne({
      xrstatx: active,
      $or: [{ _id: itemObjectId }, { source_specimen_record_id: itemId }]
    })
    if (!workItem || lower(workItem.work_status) !== 'rejected') {
      return { success: false, error: 'reject_race_lost', message: 'สถานะ Item เปลี่ยนระหว่างบันทึก กรุณาโหลดรายการใหม่' }
    }
  }
} else {
  const updateResult = await workCollection.findOneAndUpdate(
    { _id: workItem._id, xrstatx: active, work_status: 'waiting_receive' },
    { $set: rejectionPatch },
    { returnDocument: 'after' }
  )
  const updated = updateResult && (updateResult.value || updateResult)
  if (!updated || lower(updated.work_status) !== 'rejected') {
    return { success: false, error: 'reject_race_lost', message: 'สถานะ Item เปลี่ยนระหว่างบันทึก กรุณาโหลดรายการใหม่' }
  }
  workItem = updated
}

const auditSyncPending = await syncRejectionAudit(workItem.rejected_at, workItem.rejected_by)

return {
  success: true,
  data: {
    item_id: itemId,
    work_item_id: text(workItem._id),
    order_id: orderId,
    order_number: orderNumber,
    section_code: sectionCode,
    work_status: 'rejected',
    lab_no: text(workItem.lab_no),
    rejection_record_id: rejectionRecordId,
    rejected_at: text(workItem.rejected_at) || now,
    rejected_by: workItem.rejected_by || actorAudit,
    reject_reason_code: text(workItem.reject_reason_code) || rejectReasonCode,
    reject_reason_detail: text(workItem.reject_reason_detail) || rejectReasonDetail,
    created_work_item: created,
    audit_sync_pending: auditSyncPending,
    cpoe_unchanged: true,
    outbound_unchanged: true
  },
  message: auditSyncPending
    ? 'ปฏิเสธ LAB Item แล้ว แต่ Log ยังรอ reconcile'
    : 'ปฏิเสธ LAB Item แล้ว'
}
