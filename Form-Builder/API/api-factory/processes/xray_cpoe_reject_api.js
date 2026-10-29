/*
 * initCraft API Factory Process
 * Name: X-ray - Reject one CPOE Item
 * Deployed Process ID: 6ad4b03c481c196fbb339007
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
 * ปฏิเสธได้เฉพาะรายการที่ยัง "รอรับ" เท่านั้น:
 *   - sent  = ส่งจาก CPOE แล้ว แต่ยังไม่ผ่านการเงิน
 *   - ready = ผ่านการเงินแล้ว แต่ยังไม่ได้รับเข้ากระบวนการรังสี
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
const ORGANIZATION_COLLECTION = 'zdata_organization'
const ROOM_COLLECTION = 'zdata_room'
const VISIT_TRAN_COLLECTION = 'zdata_visit_tran'
const REASON_SETTINGS_COLLECTION = 'zdata_xray_reject_reason_settings'

/* คอลเลกชันของฟอร์มเหตุผลการปฏิเสธฝั่งรังสี
   แนะนำให้แยกจาก LAB (zdata_lab_receive) เพราะเหตุผลคนละชุดกันทั้งหมด
   ถ้าภายหลังตัดสินใจใช้ฟอร์มร่วมกับ LAB ให้แก้ค่านี้ค่าเดียว */
const REJECTION_COLLECTION = 'zdata_xray_reject'

const XRAY_SERVICE_TYPE = 'xray'
const REJECTABLE_STATUSES = ['sent', 'ready']
const REJECTED_STATUS = 'rejected'

/* หน่วยงานรังสีที่เข้าหน้าจอนี้ได้ — ใช้ root และขยายลูก/ห้องจาก master
   แบบเดียวกับ Worklist เพื่อให้หน่วยใหม่ เช่น RA-309 ใช้ปุ่มปฏิเสธได้ด้วย */
const XRAY_ORGANIZATION_CODES = ['m0900', 'm0901', 'CT']
const XRAY_ORGANIZATION_ROOT_CODES = ['m0900']

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

const readOrganizationRows = async () => {
  if (!app.dbFindAll) return []
  try {
    const found = await app.dbFindAll({
      from: ORGANIZATION_COLLECTION,
      nosql: {
        type: 'query',
        collection: ORGANIZATION_COLLECTION,
        query: { xrstatx: { $nin: [0, 3] }, enable: { $ne: false } },
        projection: { _id: 1, unit_code: 1, unit_parent: 1, enable: 1 }
      }
    }, false, false)
    return found && found.success !== false && found.reply && Array.isArray(found.reply.data)
      ? found.reply.data
      : []
  } catch (error) {
    return []
  }
}

const readRoomRows = async organizationIds => {
  if (!app.dbFindAll || !organizationIds.length) return []
  try {
    const found = await app.dbFindAll({
      from: ROOM_COLLECTION,
      nosql: {
        type: 'query',
        collection: ROOM_COLLECTION,
        query: {
          xrstatx: { $nin: [0, 3] },
          enable: { $ne: false },
          'unit_id.value': { $in: organizationIds }
        },
        projection: { _id: 1, code: 1, unit_id: 1, enable: 1 }
      }
    }, false, false)
    return found && found.success !== false && found.reply && Array.isArray(found.reply.data)
      ? found.reply.data
      : []
  } catch (error) {
    return []
  }
}

/* ถ้าอ่าน master ไม่ได้ ให้เหลือเฉพาะ explicit codes เดิม (fail-closed)
   ห้ามอนุญาตจากชื่อหน่วยงาน เพราะชื่อแก้ได้และอาจเปิดสิทธิ์ผิดกลุ่ม */
const radiologyOrganizationContext = async () => {
  const allowed = new Set(XRAY_ORGANIZATION_CODES.concat(XRAY_ORGANIZATION_ROOT_CODES)
    .map(code => String(code).trim().toUpperCase())
    .filter(Boolean))
  const organizations = (await readOrganizationRows()).filter(row => row && row.enable !== false)
  const codeById = new Map()
  organizations.forEach(row => {
    const id = text(row && row._id).toUpperCase()
    const code = text(row && row.unit_code).toUpperCase()
    if (id && code) codeById.set(id, code)
  })

  /* รองรับลูกหลายชั้น ไม่จำกัดแค่หน่วยที่ติด root โดยตรง */
  for (let pass = 0; pass < organizations.length; pass += 1) {
    let changed = false
    organizations.forEach(row => {
      const code = text(row && row.unit_code).toUpperCase()
      const parent = row && row.unit_parent
      const parentId = text(parent && parent.value).toUpperCase()
      const parentCode = (codeById.get(parentId) || text(
        parent && (parent.unit_code || parent.code || parent.label || parent)
      )).toUpperCase()
      if (code && parentCode && allowed.has(parentCode) && !allowed.has(code)) {
        allowed.add(code)
        changed = true
      }
    })
    if (!changed) break
  }

  const allowedOrganizationIds = organizations
    .filter(row => allowed.has(text(row && row.unit_code).toUpperCase()))
    .map(row => row && row._id)
    .filter(Boolean)
  const rooms = (await readRoomRows(allowedOrganizationIds)).filter(row => row && row.enable !== false)
  const roomParentByCode = new Map()
  const roomParentById = new Map()
  rooms.forEach(row => {
    const parentId = text(row && row.unit_id && row.unit_id.value).toUpperCase()
    const parentCode = codeById.get(parentId) || ''
    if (allowed.has(parentCode)) {
      const roomCode = text(row && row.code).toUpperCase()
      const roomId = text(row && row._id).toUpperCase()
      if (roomCode) {
        allowed.add(roomCode)
        roomParentByCode.set(roomCode, parentCode)
      }
      if (roomId) roomParentById.set(roomId, parentCode)
    }
  })
  return { allowed, codeById, roomParentByCode, roomParentById }
}

const normalizeActionUnit = (raw, context) => {
  let code = text(raw).toUpperCase()
  if (!code) return ''
  code = context.codeById.get(code) || context.roomParentById.get(code) || code
  return context.roomParentByCode.get(code) || code
}

const referenceActionUnit = (reference, context) => {
  if (!reference) return ''
  if (typeof reference === 'object') {
    const explicit = text(reference.code || reference.unit_code)
    if (explicit) return normalizeActionUnit(explicit, context)
    const id = text(reference.value || reference._id || reference.id)
    if (id) return normalizeActionUnit(id, context)
  }
  return normalizeActionUnit(reference, context)
}

const orderCreatorUnit = (order, context) => referenceActionUnit(order && order.xunitx, context)
const orderVisitId = order => text(order && order.xparentx)

const latestQueueUnit = async (order, context) => {
  const visitId = orderVisitId(order)
  if (!visitId) return ''
  const ids = [visitId]
  if (isObjectId(visitId)) ids.push(app.dbObjectId(visitId))
  let rows = []
  try {
    rows = await app.db.collection(VISIT_TRAN_COLLECTION).find({
      xrstatx: { $nin: [0, 3] },
      vtran_status: { $in: ['waiting', 'called', 'in_progress'] },
      'vid.value': { $in: ids }
    }).sort({ checkin_at: -1, updated_at: -1, _id: -1 }).toArray()
  } catch (error) {
    rows = []
  }
  const latest = rows[0] || null
  return referenceActionUnit(latest && (latest.room_to || latest.unit_to), context) ||
    referenceActionUnit(latest && latest.unit_to, context)
}

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
const organizationContext = await radiologyOrganizationContext()
const allowedOrganizations = organizationContext.allowed
if (!organizationCode || !allowedOrganizations.has(organizationCode)) {
  return {
    success: false,
    message: 'Organization "' + (organizationCode || '-') + '" ไม่ใช่หน่วยงานรังสี จึงปฏิเสธรายการไม่ได้'
  }
}
const currentActionUnit = normalizeActionUnit(organizationCode, organizationContext)

const now = text(app.curDate('YYYY-MM-DD HH:mm:ss'))
const actor = text(userInfo.username || (userInfo.account && userInfo.account.name))
const actorAudit = userInfo.account || { name: actor }
const itemObjectId = app.dbObjectId(itemId)

const itemCollection = app.db.collection(ITEM_COLLECTION)
const orderCollection = app.db.collection(ORDER_COLLECTION)
const rejectionCollection = app.db.collection(REJECTION_COLLECTION)
const reasonSettingsCollection = app.db.collection(REASON_SETTINGS_COLLECTION)

/* ── 1. ตรวจรายการ ─────────────────────────────────────────────────────── */
const item = await itemCollection.findOne({ _id: itemObjectId, xrstatx: { $nin: [0, 3] } })
if (!item) return { success: false, message: 'ไม่พบรายการตรวจที่ต้องการปฏิเสธ' }
if (serviceTypeOf(item) !== XRAY_SERVICE_TYPE) {
  return { success: false, message: 'ปฏิเสธได้เฉพาะรายการทางรังสี' }
}

const linkedOrderId = text(
  (item.order_id && item.order_id.value) || item.order_ref_id || item.xparentx
)
const order = isObjectId(linkedOrderId)
  ? await orderCollection.findOne({ _id: app.dbObjectId(linkedOrderId), xrstatx: { $nin: [0, 3] } })
  : null
if (!order) return { success: false, message: 'ไม่พบ Order ของรายการตรวจที่เลือก' }
const creatorActionUnit = orderCreatorUnit(order, organizationContext)
const queueActionUnit = await latestQueueUnit(order, organizationContext)
if (!currentActionUnit || (currentActionUnit !== creatorActionUnit && currentActionUnit !== queueActionUnit)) {
  const facts = []
  if (queueActionUnit) facts.push('คิวของ HN ' + (text(order && order.vid && order.vid.pid && order.vid.pid.hn) || '-') + ' อยู่ที่ ' + queueActionUnit)
  if (creatorActionUnit) facts.push('Order นี้ถูกสร้างที่ ' + creatorActionUnit)
  return {
    success: false,
    error: 'action_unit_denied',
    message: (facts.length ? facts.join(' · ') + ' · ' : '') + 'ห้องนี้ดูข้อมูลได้อย่างเดียว จึงปฏิเสธรายการไม่ได้'
  }
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
if (!REJECTABLE_STATUSES.includes(currentStatus)) {
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

/* Select เก็บ reason_code เพื่อ audit; คอลัมน์ Worklist ต้องแสดง reason_text จาก Master
   ไม่ใช้รายละเอียดเพิ่มเติมแทนชื่อเหตุผล และไม่เขียนรหัส Auto Number ให้ผู้ใช้เห็น */
let rejectReasonText = ''
if (rejectReasonCode && reasonSettingsCollection) {
  try {
    const reasonSetting = await reasonSettingsCollection.findOne({
      reason_code: rejectReasonCode,
      xrstatx: { $nin: [0, 3] }
    })
    rejectReasonText = text(reasonSetting && reasonSetting.reason_text)
  } catch (error) {
    rejectReasonText = ''
  }
}

/* order_id ที่ส่งมาต้องเป็นใบเดียวกับที่ item ผูกอยู่จริง ไม่งั้นแปลว่าหน้าจอเพี้ยน */
const requestedOrderId = text(params.order_id)
if (requestedOrderId) {
  const itemOrderId = linkedOrderId
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
  reject_reason: rejectReasonText || rejectReasonDetail || rejectReasonCode,
  rejection_record_id: rejectionRecordId,
  rejected_organization_code: organizationCode,
  updated_at: now,
  updated_by: actor
}

let saved
try {
  saved = await itemCollection.updateOne(
    { _id: itemObjectId, xrstatx: { $nin: [0, 3] }, current_status: { $in: REJECTABLE_STATUSES } },
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
