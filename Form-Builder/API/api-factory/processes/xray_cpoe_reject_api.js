/*
 * initCraft API Factory Process
 * Name: X-ray - Reject one CPOE Item
 * Deployed Process ID: (ยังไม่ deploy — paste แล้วแจ้ง id กลับมาเพื่อใส่ใน
 *                       REJECT_PROCESS_ID ของ build_xray_cpoe_worklist_ui.js)
 *
 * Input:
 *   {
 *     action: 'reject_item',
 *     item_id: '<zdata_cpoe_order_item _id>',
 *     rejection_record_id: '<เอกสารฟอร์มเหตุผลที่เพิ่งบันทึก>',
 *     order_id?: '<zdata_cpoe_order _id>',
 *     order_number?: '<เลขที่ใบสั่ง>'
 *   }
 * Output: { success, data: { item_id, rejected_at, rejected_by,
 *           reject_reason_code, reject_reason_detail, audit_sync_pending }, message }
 *
 * โครงเดียวกับ LAB (Lab_Reject_Specimen.js · 6a79ff46d5218a5b6a26bebc):
 *   ฟอร์มเหตุผลคือ "หลักฐาน" · Process นี้แค่เปลี่ยนสถานะให้ตรงกับหลักฐานนั้น
 *   CPOE ยังเป็น read-only จากมุมของห้องรังสี — แตะเฉพาะฟิลด์สถานะของ item
 *
 * ปฏิเสธได้เฉพาะรายการที่ยัง "รอรับ" (current_status = sent) เท่านั้น
 *   รายการที่ส่งเข้าเครื่องไปแล้วมีใบสั่งนอนอยู่ฝั่ง RIS/PACS แล้ว การยกเลิกต้อง
 *   ยิง IsDeleted กลับไปด้วย ซึ่งยังเป็น decision ที่ยังไม่ได้ยืนยันกับทีม RIS
 *   ⇒ ปฏิเสธเงียบ ๆ ฝั่งเราอย่างเดียวจะทำให้สองระบบไม่ตรงกัน จึงบล็อกไว้ก่อน
 *
 * MongoDB เป็น standalone — ห้ามใช้ transaction
 *   การเปลี่ยนสถานะเป็น compare-and-set บนเอกสารเดียว ซึ่ง atomic อยู่แล้ว
 *   ลำดับ: ตรวจหลักฐาน → เปลี่ยนสถานะ item → ประทับ applied บนหลักฐาน
 *   ถ้าประทับไม่ผ่าน สถานะยังถูกต้อง แค่คืน audit_sync_pending ให้ตามเก็บ (เหมือน LAB)
 */

const ITEM_COLLECTION = 'zdata_cpoe_order_item'
const ORDER_COLLECTION = 'zdata_cpoe_order'

/* คอลเลกชันของฟอร์มเหตุผลการปฏิเสธฝั่งรังสี
   แนะนำให้แยกจาก LAB (zdata_lab_receive) เพราะเหตุผลคนละชุดกันทั้งหมด
   ถ้าภายหลังตัดสินใจใช้ฟอร์มร่วมกับ LAB ให้แก้ค่านี้ค่าเดียว */
const REJECTION_COLLECTION = 'zdata_xray_reject'

const XRAY_SERVICE_TYPE = 'xray'
const WAITING_STATUS = 'sent'
const REJECTED_STATUS = 'rejected'

/* หน่วยงานรังสีที่เข้าหน้าจอนี้ได้ — ต้องตรงกันทุก Process ของ X-ray */
const XRAY_ORGANIZATION_CODES = ['m0900', 'm0901', 'CT']

const valueText = value => {
  if (value == null) return ''
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return String(value.toHexString())
    if (value.$oid != null) return String(value.$oid)
    if (value._id != null) return valueText(value._id)
    if (value.id != null) return valueText(value.id)
    if (value.value != null && typeof value.value !== 'object') return String(value.value)
    if (value.label != null && typeof value.label !== 'object') return String(value.label)
    if (value.code != null) return String(value.code)
  }
  return String(value)
}
const text = value => valueText(value).trim()
const isObjectId = value => /^[a-f0-9]{24}$/i.test(value)

/* service_type เก็บได้ทั้ง { value: 'xray' } และ 'xray' — อ่านให้ได้ทั้งสองทรง */
const serviceTypeOf = item => text(
  (item && item.service_type && item.service_type.value != null)
    ? item.service_type.value
    : (item && item.service_type)
).toLowerCase()

const action = text(params.action || 'reject_item').toLowerCase()
if (action !== 'reject_item') {
  return { success: false, message: 'ไม่รองรับ action นี้' }
}

const itemId = text(params.item_id)
if (!isObjectId(itemId)) {
  return { success: false, message: 'item_id ไม่ถูกต้อง' }
}
const rejectionRecordId = text(params.rejection_record_id)
if (!isObjectId(rejectionRecordId)) {
  return { success: false, message: 'กรุณาบันทึกฟอร์มเหตุผลการปฏิเสธก่อน' }
}

if (!app.isAuth(userInfo.roles || [])) {
  return { success: false, message: 'ไม่มีสิทธิ์ปฏิเสธรายการทางรังสี' }
}

const organizationCode = text(userInfo.unit && userInfo.unit.code).toUpperCase()
const allowedOrganizations = XRAY_ORGANIZATION_CODES
  .map(code => String(code).trim().toUpperCase())
  .filter(Boolean)
if (!organizationCode || !allowedOrganizations.includes(organizationCode)) {
  return {
    success: false,
    message: 'Organization "' + (organizationCode || '-') + '" ไม่ใช่หน่วยงานรังสี จึงปฏิเสธรายการไม่ได้'
  }
}

const now = text(app.curDate('YYYY-MM-DD HH:mm:ss'))
const actor = text(userInfo.username || (userInfo.account && userInfo.account.name))
const actorAudit = userInfo.account || { name: actor }
const itemObjectId = app.dbObjectId(itemId)

const itemCollection = app.db.collection(ITEM_COLLECTION)
const orderCollection = app.db.collection(ORDER_COLLECTION)
const rejectionCollection = app.db.collection(REJECTION_COLLECTION)

/* ── 1. ตรวจรายการ ─────────────────────────────────────────────────────── */
const item = await itemCollection.findOne({ _id: itemObjectId, xrstatx: { $nin: [0, 3] } })
if (!item) return { success: false, message: 'ไม่พบรายการตรวจที่ต้องการปฏิเสธ' }
if (serviceTypeOf(item) !== XRAY_SERVICE_TYPE) {
  return { success: false, message: 'ปฏิเสธได้เฉพาะรายการทางรังสี' }
}

const currentStatus = text(item.current_status).toLowerCase()
if (currentStatus === REJECTED_STATUS) {
  /* กดซ้ำ = ไม่ใช่ error · คืนสถานะเดิมให้หน้าจอวาดตรงกับของจริง */
  return {
    success: true,
    data: {
      item_id: itemId,
      rejected_at: text(item.rejected_at),
      rejected_by: item.rejected_by || '',
      reject_reason_code: text(item.reject_reason_code),
      reject_reason_detail: text(item.reject_reason_detail),
      audit_sync_pending: false,
      already_rejected: true
    },
    message: 'รายการนี้ถูกปฏิเสธไปแล้ว'
  }
}
if (currentStatus !== WAITING_STATUS) {
  return {
    success: false,
    message: 'ปฏิเสธได้เฉพาะรายการที่ยังไม่ได้ส่งเข้าเครื่อง — รายการนี้อยู่สถานะ "' +
      (currentStatus || '-') + '" ต้องยกเลิกที่ RIS ก่อน (ยังไม่เปิดใช้ · รอ contract ยกเลิกจากทีม RIS)'
  }
}

/* ── 2. ตรวจหลักฐาน — ต้องเป็นฟอร์มของ item ใบนี้และต้องมีเหตุผล ────────── */
let rejection = null
try {
  rejection = await rejectionCollection.findOne({ _id: app.dbObjectId(rejectionRecordId) })
} catch (error) {
  rejection = null
}
if (!rejection || Number(rejection.xrstatx) === 3) {
  return { success: false, message: 'ไม่พบฟอร์มเหตุผลการปฏิเสธที่เพิ่งบันทึก' }
}
const recordSource = text(rejection.source_item_id || rejection.source_order_id)
if (recordSource && recordSource !== itemId) {
  return { success: false, message: 'ฟอร์มเหตุผลไม่ตรงกับรายการตรวจที่เลือก' }
}
const rejectReasonCode = text(rejection.reject_reason_code)
const rejectReasonDetail = text(rejection.reject_reason_detail)
if (!rejectReasonCode && !rejectReasonDetail) {
  return { success: false, message: 'กรุณาเลือกเหตุผลการปฏิเสธ' }
}

/* order_id ที่ส่งมาต้องเป็นใบเดียวกับที่ item ผูกอยู่จริง ไม่งั้นแปลว่าหน้าจอเพี้ยน */
const requestedOrderId = text(params.order_id)
if (requestedOrderId) {
  const itemOrderId = text(item.order_ref_id || item.xparentx)
  if (itemOrderId && itemOrderId !== requestedOrderId) {
    return { success: false, message: 'รายการที่เลือกไม่ได้อยู่ในใบสั่งนี้' }
  }
}

/* ── 3. เปลี่ยนสถานะแบบ compare-and-set ────────────────────────────────── */
const rejectPatch = {
  current_status: REJECTED_STATUS,
  rejected_at: now,
  rejected_by: actorAudit,
  reject_reason_code: rejectReasonCode,
  reject_reason_detail: rejectReasonDetail,
  reject_reason: rejectReasonDetail || rejectReasonCode,
  rejection_record_id: rejectionRecordId,
  rejected_organization_code: organizationCode,
  updated_at: now,
  updated_by: actor
}

let saved
try {
  saved = await itemCollection.updateOne(
    { _id: itemObjectId, xrstatx: { $nin: [0, 3] }, current_status: WAITING_STATUS },
    { $set: rejectPatch }
  )
} catch (error) {
  return { success: false, message: 'บันทึกการปฏิเสธไม่สำเร็จ' }
}
if (!saved || Number(saved.matchedCount) !== 1) {
  return { success: false, message: 'รายการถูกเปลี่ยนสถานะระหว่างปฏิเสธ กรุณาโหลดใหม่แล้วลองอีกครั้ง' }
}

/* ── 4. ประทับหลักฐานว่าใช้ไปแล้ว — พลาดได้ สถานะยังถูกต้อง ─────────────── */
let auditSyncPending = false
try {
  const stamped = await rejectionCollection.updateOne(
    { _id: app.dbObjectId(rejectionRecordId), rejection_status: { $ne: 'void' } },
    {
      $set: {
        rejection_status: 'applied',
        applied_item_id: itemId,
        applied_order_id: requestedOrderId || text(item.order_ref_id || item.xparentx),
        applied_order_number: text(params.order_number),
        applied_at: now,
        applied_by: actor
      }
    }
  )
  auditSyncPending = !stamped || Number(stamped.matchedCount) !== 1
} catch (error) {
  auditSyncPending = true
}

/* ใบสั่งไม่ถูกแตะ — สถานะระดับใบเป็นผลรวมของ item ที่ worklist คำนวณเอง
   ผู้ใช้ยืนยัน 2026-09-01 ว่าใบจะ "ออกผลครบ" ก็ต่อเมื่อทุก item มีผลแล้วเท่านั้น */
void orderCollection

return {
  success: true,
  data: {
    item_id: itemId,
    rejected_at: now,
    rejected_by: actorAudit,
    reject_reason_code: rejectReasonCode,
    reject_reason_detail: rejectReasonDetail,
    audit_sync_pending: auditSyncPending,
    already_rejected: false
  },
  message: auditSyncPending
    ? 'ปฏิเสธรายการแล้ว แต่ยังประทับสถานะบนฟอร์มเหตุผลไม่สำเร็จ — แจ้งผู้ดูแลตรวจสอบ'
    : 'ปฏิเสธรายการแล้ว'
}
