/*
 * initCraft API Factory Process
 * Name: X-ray - UAT Seed (Finance-ready + Manual Result)
 * Suggested Process name: xray_uat_seed
 *
 * Purpose
 *   สร้างสถานะทดสอบ X-ray โดยไม่แตะโมดูลการเงินจริง และไม่เรียก Agent/RIS
 *   ใช้เฉพาะผู้ป่วยทดสอบเพื่อทดสอบ Worklist ก่อนส่งเข้าเครื่องและลงผล manual
 *
 * Actions
 *   preview
 *     อ่านอย่างเดียว ตรวจว่ารายการพร้อม seed หรือไม่
 *
 *   seed_finance
 *     จำลอง “ผ่านการเงิน” โดยเปลี่ยน CPOE item จาก sent -> ready เท่านั้น
 *     ไม่สร้าง Bill / Bill Item / Receipt และไม่แตะคิวกลาง
 *
 *   seed_manual_result
 *     ทำ seed_finance (ถ้าจำเป็น) -> เรียก Process ออก Accession เดิม ->
 *     mark item เป็น dispatched แบบ local UAT โดยไม่เรียก Agent/RIS
 *     หลังจากนั้นใช้ปุ่มบันทึกผล manual ใน Worklist ได้ตาม flow จริง
 *
 *   cleanup
 *     soft-delete เฉพาะผล manual ที่ผูกกับ Accession ของ seed run และคืนค่าฟิลด์
 *     CPOE item ตาม snapshot ก่อน seed; ไม่ลด/ย้อน Accession counter เพราะเลขห้าม reuse
 *
 * Input examples
 *   {
 *     action: 'preview',
 *     order_id: '<zdata_cpoe_order _id>',
 *     item_ids: ['<zdata_cpoe_order_item _id>'],
 *     expected_hn: '6900031',
 *     confirm: 'XRAY_UAT_ONLY'
 *   }
 *
 *   {
 *     action: 'seed_finance', // หรือ seed_manual_result
 *     order_id: '<zdata_cpoe_order _id>',
 *     item_ids: ['<item id 1>', '<item id 2>'],
 *     expected_hn: '6900031',
 *     confirm: 'XRAY_UAT_ONLY',
 *     note: 'UAT case: unpaid -> finance ready'
 *   }
 *
 *   {
 *     action: 'cleanup',
 *     seed_run_id: '<ค่าที่ API คืนตอน seed>',
 *     confirm: 'XRAY_UAT_ONLY'
 *   }
 *
 * Guardrails
 *   - admin/super หรือ role XRAY_UAT เท่านั้น
 *   - expected_hn ต้องตรง และชื่อ/ข้อมูล order ต้องมี marker ทดสอบ
 *   - สูงสุด 20 item ต่อ run, X-ray เท่านั้น, status sent/ready เท่านั้น
 *   - ห้ามมี Accession/ผล/การยกเลิก/การปฏิเสธเดิม
 *   - ไม่เรียก xray_api_order, xray_cpoe_dispatch, Agent, RIS หรือ HTTP ใด ๆ
 *   - cleanup หยุดทันทีถ้าพบ outbound xray_order หรือผลจาก RIS จริง
 */

const ORDER_COLLECTION = 'zdata_cpoe_order'
const ITEM_COLLECTION = 'zdata_cpoe_order_item'
const RIS_ORDER_COLLECTION = 'zdata_xray_order'
const RESULT_COLLECTION = 'zdata_xray_result'
const RESULT_LOG_COLLECTION = 'zdata_zdata_xray_result_log'
const SEED_RUN_COLLECTION = 'zdata_xray_uat_seed_run'
const ACCESSION_PROCESS_ID = '6a95cd58422c1ca959829e8d'

const CONFIRM_TEXT = 'XRAY_UAT_ONLY'
const XRAY_SERVICE_TYPE = 'xray'
const FINANCE_WAITING_STATUS = 'sent'
const FINANCE_READY_STATUS = 'ready'
const SEEDED_DISPATCH_STATUS = 'dispatched'
const MAX_ITEMS = 20
const ACTIVE = { $nin: [0, 3] }

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
const lower = value => text(value).toLowerCase()
const validId = value => /^[a-f0-9]{24}$/i.test(text(value))
const actor = text(
  userInfo.employee_code || userInfo.username ||
  (userInfo.account && (userInfo.account.code || userInfo.account.name))
)
const now = text(app.curDate && app.curDate('YYYY-MM-DD HH:mm:ss')) || new Date().toISOString()

const roles = Array.isArray(userInfo.roles) ? userInfo.roles : []
const roleNames = roles.map(role => lower(role && (role.code || role.name || role.value || role)))
const privileged = Boolean(
  (app.isSuper && app.isSuper(roles)) ||
  (app.isAdmin && app.isAdmin(roles)) ||
  roleNames.includes('xray_uat')
)

if (!privileged) {
  return { success: false, error: 'permission_denied', message: 'UAT Seed ใช้ได้เฉพาะผู้ดูแลระบบหรือ role XRAY_UAT' }
}
if (text(params.confirm) !== CONFIRM_TEXT) {
  return {
    success: false,
    error: 'confirmation_required',
    message: 'กรุณาส่ง confirm: "' + CONFIRM_TEXT + '" เพื่อยืนยันว่าเป็นข้อมูลทดสอบ'
  }
}

const action = lower(params.action) || 'preview'
const allowedActions = ['preview', 'seed_finance', 'seed_manual_result', 'cleanup']
if (!allowedActions.includes(action)) {
  return { success: false, error: 'action_invalid', message: 'action ไม่ถูกต้อง' }
}

const serviceTypeOf = item => lower(
  item && item.service_type && item.service_type.value != null
    ? item.service_type.value
    : item && item.service_type
)

const orderRefOf = item => text(
  (item && item.order_id && item.order_id.value) ||
  (item && item.order_ref_id) ||
  (item && item.xparentx)
)

const unwrapProcess = result => {
  if (!result || typeof result !== 'object') return null
  const reply = result.reply || {}
  const candidates = [reply.data, result.data, reply, result]
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]
    if (candidate && typeof candidate === 'object' && typeof candidate.success === 'boolean') return candidate
  }
  return null
}

const runIdValue = () => {
  let uuid = ''
  try {
    if (this && typeof this.genUUID === 'function') uuid = text(this.genUUID())
  } catch (error) {
    uuid = ''
  }
  if (!uuid) uuid = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 12)
  return 'XRAY-UAT-' + uuid.replace(/[^A-Za-z0-9_-]/g, '')
}

const SNAPSHOT_FIELDS = [
  'current_status',
  'accession_no',
  'accession_prefix',
  'accession_modality_code',
  'accession_modality_source',
  'accession_date_key',
  'accession_sequence',
  'accession_generated_at',
  'accession_generated_by',
  'dispatched_at',
  'dispatched_by',
  'resent_at',
  'dispatch_count',
  'transport',
  'transport_failed',
  'updated_at',
  'updated_by',
  'uat_finance_seed',
  'uat_seed'
]

const makeSnapshot = item => {
  const snapshot = {}
  SNAPSHOT_FIELDS.forEach(field => {
    snapshot[field] = Object.prototype.hasOwnProperty.call(item, field)
      ? { exists: true, value: item[field] }
      : { exists: false }
  })
  return snapshot
}

const restoreItemFromSnapshot = async (entry, seedRunId) => {
  const setValues = {}
  const unsetValues = {}
  SNAPSHOT_FIELDS.forEach(field => {
    const saved = entry.before && entry.before[field]
    if (saved && saved.exists) setValues[field] = saved.value
    else unsetValues[field] = ''
  })
  const update = { $set: setValues }
  if (Object.keys(unsetValues).length) update.$unset = unsetValues
  return app.db.collection(ITEM_COLLECTION).updateOne(
    {
      _id: app.dbObjectId(entry.item_id),
      xrstatx: ACTIVE,
      $or: [
        { 'uat_seed.run_id': seedRunId },
        { 'uat_finance_seed.run_id': seedRunId }
      ]
    },
    update
  )
}

const updateRun = async (seedRunId, patch) => {
  const update = Object.assign({}, patch, { updated_at: now, updated_by: actor })
  await app.db.collection(SEED_RUN_COLLECTION).updateOne(
    { run_id: seedRunId, xrstatx: ACTIVE },
    { $set: update }
  )
}

/* cleanup แยกก่อน เพราะอ้าง seed_run_id ไม่ต้องส่ง order/item ซ้ำ */
if (action === 'cleanup') {
  const seedRunId = text(params.seed_run_id)
  if (!seedRunId || !/^XRAY-UAT-[A-Za-z0-9_-]{8,120}$/.test(seedRunId)) {
    return { success: false, error: 'seed_run_id_invalid', message: 'seed_run_id ไม่ถูกต้อง' }
  }

  const run = await app.db.collection(SEED_RUN_COLLECTION).findOne({ run_id: seedRunId, xrstatx: ACTIVE })
  if (!run) {
    return { success: false, error: 'seed_run_not_found', message: 'ไม่พบ UAT seed run นี้' }
  }
  if (lower(run.status) === 'cleaned') {
    return {
      success: true,
      data: { seed_run_id: seedRunId, already_cleaned: true },
      message: 'Seed run นี้ cleanup แล้ว'
    }
  }
  if (!Array.isArray(run.items) || !run.items.length) {
    return { success: false, error: 'seed_run_invalid', message: 'Seed run ไม่มี snapshot ของรายการ' }
  }

  /* preflight ทั้ง run ก่อนเปลี่ยนข้อมูลแม้แต่แถวเดียว */
  const cleanupPlan = []
  for (let index = 0; index < run.items.length; index += 1) {
    const entry = run.items[index]
    const item = await app.db.collection(ITEM_COLLECTION).findOne({
      _id: app.dbObjectId(entry.item_id),
      xrstatx: ACTIVE
    })
    if (!item) {
      return { success: false, error: 'cleanup_item_missing', message: 'ไม่พบ item ' + entry.item_id + ' จึงยังไม่ cleanup' }
    }
    const ownsSeed = text(item.uat_seed && item.uat_seed.run_id) === seedRunId ||
      text(item.uat_finance_seed && item.uat_finance_seed.run_id) === seedRunId
    if (!ownsSeed) {
      return {
        success: false,
        error: 'cleanup_conflict',
        message: 'item ' + entry.item_id + ' ถูกเปลี่ยนหลัง seed หรือไม่ได้เป็นของ run นี้ จึงยังไม่ cleanup'
      }
    }

    const accessionNo = text(entry.accession_no || item.accession_no)
    if (accessionNo) {
      const outbound = await app.db.collection(RIS_ORDER_COLLECTION).findOne({
        AccessionNo: accessionNo,
        xrstatx: ACTIVE
      })
      if (outbound) {
        return {
          success: false,
          error: 'real_outbound_order_detected',
          message: 'พบ xray_order ของ Accession ' + accessionNo + ' แล้ว — ห้าม cleanup อัตโนมัติเพราะอาจส่ง RIS จริง'
        }
      }

      const currentResults = await app.db.collection(RESULT_COLLECTION).find({
        AccessionNo: accessionNo,
        xrstatx: ACTIVE
      }).toArray()
      const resultLogs = await app.db.collection(RESULT_LOG_COLLECTION).find({
        AccessionNo: accessionNo,
        xrstatx: ACTIVE
      }).toArray()
      const allResults = currentResults.concat(resultLogs)
      const nonManual = allResults.find(result => !text(result.MessageControlId).startsWith('HIS-MANUAL-'))
      if (nonManual) {
        return {
          success: false,
          error: 'real_ris_result_detected',
          message: 'พบผลที่ไม่ใช่ manual ของ Accession ' + accessionNo + ' — ห้าม cleanup อัตโนมัติ'
        }
      }
      cleanupPlan.push({ entry, accession_no: accessionNo })
    } else {
      cleanupPlan.push({ entry, accession_no: '' })
    }
  }

  let deletedCurrentResults = 0
  let deletedResultLogs = 0
  let restoredItems = 0
  for (let index = 0; index < cleanupPlan.length; index += 1) {
    const plan = cleanupPlan[index]
    if (plan.accession_no) {
      const cleanupMark = {
        xrstatx: 3,
        deleted_at: now,
        deleted_by: actor,
        uat_seed_cleanup: { run_id: seedRunId, at: now, by: actor }
      }
      const resultDelete = await app.db.collection(RESULT_COLLECTION).updateMany(
        {
          AccessionNo: plan.accession_no,
          MessageControlId: { $regex: '^HIS-MANUAL-' },
          xrstatx: ACTIVE
        },
        { $set: cleanupMark }
      )
      const logDelete = await app.db.collection(RESULT_LOG_COLLECTION).updateMany(
        {
          AccessionNo: plan.accession_no,
          MessageControlId: { $regex: '^HIS-MANUAL-' },
          xrstatx: ACTIVE
        },
        { $set: cleanupMark }
      )
      deletedCurrentResults += Number(resultDelete && resultDelete.modifiedCount) || 0
      deletedResultLogs += Number(logDelete && logDelete.modifiedCount) || 0
    }
    const restored = await restoreItemFromSnapshot(plan.entry, seedRunId)
    restoredItems += Number(restored && restored.modifiedCount) || 0
  }

  await updateRun(seedRunId, {
    status: 'cleaned',
    cleaned_at: now,
    cleaned_by: actor,
    cleanup_summary: {
      restored_items: restoredItems,
      deleted_current_results: deletedCurrentResults,
      deleted_result_logs: deletedResultLogs,
      accession_counter_reused: false
    }
  })

  return {
    success: true,
    data: {
      seed_run_id: seedRunId,
      restored_items: restoredItems,
      deleted_current_results: deletedCurrentResults,
      deleted_result_logs: deletedResultLogs,
      accession_counter_reused: false
    },
    message: 'Cleanup UAT seed แล้ว — เลข Accession ที่เคยจองจะไม่ถูกนำกลับมาใช้ซ้ำ'
  }
}

const orderId = text(params.order_id)
if (!validId(orderId)) {
  return { success: false, error: 'order_id_invalid', message: 'order_id ไม่ถูกต้อง' }
}

const rawItemIds = []
if (params.item_id != null) rawItemIds.push(params.item_id)
if (Array.isArray(params.item_ids)) params.item_ids.forEach(value => rawItemIds.push(value))
const itemIds = []
rawItemIds.forEach(value => {
  const id = text(value)
  if (id && !itemIds.includes(id)) itemIds.push(id)
})
if (!itemIds.length || itemIds.some(id => !validId(id))) {
  return { success: false, error: 'item_ids_invalid', message: 'กรุณาส่ง item_id หรือ item_ids ที่ถูกต้อง' }
}
if (itemIds.length > MAX_ITEMS) {
  return { success: false, error: 'too_many_items', message: 'Seed ได้สูงสุด ' + MAX_ITEMS + ' รายการต่อครั้ง' }
}

const orderObjectId = app.dbObjectId(orderId)
const order = await app.db.collection(ORDER_COLLECTION).findOne({ _id: orderObjectId, xrstatx: ACTIVE })
if (!order) {
  return { success: false, error: 'order_not_found', message: 'ไม่พบ CPOE Order นี้' }
}

const hn = text(order && order.vid && order.vid.pid && order.vid.pid.hn)
const expectedHn = text(params.expected_hn)
if (!expectedHn || expectedHn !== hn) {
  return {
    success: false,
    error: 'hn_mismatch',
    message: 'expected_hn ไม่ตรงกับผู้ป่วยของ Order — ยังไม่มีข้อมูลถูกเปลี่ยน'
  }
}

const pid = (order && order.vid && order.vid.pid) || {}
const testMarkerText = lower([
  hn,
  pid.prename,
  pid.prefix,
  pid.p_fname,
  pid.p_lname,
  pid.first_name,
  pid.last_name,
  pid.name,
  order.patient_name,
  order.order_comment,
  order.note
].map(text).join(' '))
const testMarkers = ['ทดสอบ', 'ไม่ใช่คนจริง', 'test', 'uat', 'demo', 'dummy']
if (!testMarkers.some(marker => testMarkerText.includes(marker))) {
  return {
    success: false,
    error: 'test_patient_required',
    message: 'UAT Seed ใช้ได้เฉพาะผู้ป่วยที่มี marker ทดสอบ/UAT/Test/Demo เท่านั้น'
  }
}

const itemObjectIds = itemIds.map(id => app.dbObjectId(id))
const items = await app.db.collection(ITEM_COLLECTION).find({
  _id: { $in: itemObjectIds },
  xrstatx: ACTIVE
}).toArray()
if (items.length !== itemIds.length) {
  return { success: false, error: 'item_not_found', message: 'พบ CPOE Item ไม่ครบตามที่เลือก' }
}

const orderedItems = itemIds.map(id => items.find(item => text(item._id) === id))
const checks = []
for (let index = 0; index < orderedItems.length; index += 1) {
  const item = orderedItems[index]
  const itemId = itemIds[index]
  const reasons = []
  const status = lower(item.current_status)
  if (orderRefOf(item) !== orderId) reasons.push('ไม่ใช่ item ของ order นี้')
  if (serviceTypeOf(item) !== XRAY_SERVICE_TYPE) reasons.push('ไม่ใช่รายการ X-ray')
  if (![FINANCE_WAITING_STATUS, FINANCE_READY_STATUS].includes(status)) reasons.push('สถานะ ' + (status || '(ว่าง)') + ' seed ไม่ได้')
  if (text(item.accession_no)) reasons.push('มี Accession No. แล้ว')
  if (item.uat_seed || item.uat_finance_seed) reasons.push('มี UAT seed run เดิมค้างอยู่')
  if (text(item.rejection_reason || item.reject_reason || item.cancel_reason)) reasons.push('ถูกปฏิเสธหรือยกเลิกแล้ว')
  checks.push({
    item_id: itemId,
    item_code: text(item.item_code),
    item_name: text(item.item_name),
    current_status: status,
    ready: reasons.length === 0,
    reasons
  })
}

const blocked = checks.filter(check => !check.ready)
if (action === 'preview') {
  return {
    success: blocked.length === 0,
    data: {
      order_id: orderId,
      order_number: text(order.order_number),
      hn,
      item_count: checks.length,
      items: checks,
      finance_simulation: 'CPOE item current_status sent -> ready only',
      creates_finance_bill_or_receipt: false,
      calls_agent_or_ris: false
    },
    error: blocked.length ? 'seed_preflight_failed' : '',
    message: blocked.length ? 'มีรายการที่ยัง seed ไม่ได้' : 'รายการพร้อมสำหรับ UAT seed'
  }
}
if (blocked.length) {
  return {
    success: false,
    error: 'seed_preflight_failed',
    data: { items: checks },
    message: 'ยังไม่ seed เพราะมีรายการที่ไม่ผ่าน preflight'
  }
}

const seedRunId = runIdValue()
const runItems = orderedItems.map((item, index) => ({
  item_id: itemIds[index],
  item_code: text(item.item_code),
  item_name: text(item.item_name),
  status_before: lower(item.current_status),
  before: makeSnapshot(item),
  finance_seeded: false,
  accession_no: '',
  dispatch_seeded: false
}))
const runRecord = {
  run_id: seedRunId,
  mode: action,
  status: 'preparing',
  order_id: orderId,
  order_number: text(order.order_number),
  hn,
  item_ids: itemIds,
  items: runItems,
  note: text(params.note).slice(0, 1000),
  safety: {
    finance_record_created: false,
    outbound_order_created: false,
    agent_called: false,
    ris_called: false
  },
  created_at: now,
  created_by: actor,
  updated_at: now,
  updated_by: actor,
  xrstatx: 1
}
await app.dbInsert(runRecord, SEED_RUN_COLLECTION, userInfo)

const rollbackSeed = async (message, code) => {
  let restored = 0
  for (let index = 0; index < runItems.length; index += 1) {
    try {
      const result = await restoreItemFromSnapshot(runItems[index], seedRunId)
      restored += Number(result && result.modifiedCount) || 0
    } catch (error) {
      /* เก็บ run ไว้ให้ cleanup ซ้ำได้ ห้ามกลบ error ต้นทาง */
    }
  }
  await updateRun(seedRunId, {
    status: restored === runItems.length ? 'failed_rolled_back' : 'rollback_required',
    items: runItems,
    failure: { code, message, at: now },
    rollback_restored_items: restored
  })
  return {
    success: false,
    error: code,
    data: { seed_run_id: seedRunId, restored_items: restored },
    message
  }
}

/* ขั้นที่ 1 — จำลอง Finance-ready ที่ CPOE item เท่านั้น */
for (let index = 0; index < orderedItems.length; index += 1) {
  const item = orderedItems[index]
  const itemId = itemIds[index]
  const financeMark = {
    run_id: seedRunId,
    simulated: true,
    finance_record_created: false,
    at: now,
    by: actor
  }
  const changed = await app.db.collection(ITEM_COLLECTION).updateOne(
    {
      _id: app.dbObjectId(itemId),
      xrstatx: ACTIVE,
      current_status: item.current_status,
      $or: [
        { accession_no: { $exists: false } },
        { accession_no: null },
        { accession_no: '' }
      ]
    },
    {
      $set: {
        current_status: FINANCE_READY_STATUS,
        uat_finance_seed: financeMark,
        updated_at: now,
        updated_by: actor
      }
    }
  )
  if (!changed || Number(changed.matchedCount) !== 1) {
    return rollbackSeed('item ' + itemId + ' ถูกเปลี่ยนระหว่าง seed จึงยกเลิกทั้ง run', 'finance_seed_conflict')
  }
  runItems[index].finance_seeded = true
}

await updateRun(seedRunId, { status: 'finance_seeded', items: runItems })

if (action === 'seed_finance') {
  await updateRun(seedRunId, { status: 'active', items: runItems })
  return {
    success: true,
    data: {
      seed_run_id: seedRunId,
      order_id: orderId,
      hn,
      item_count: runItems.length,
      items: runItems.map(item => ({ item_id: item.item_id, current_status: FINANCE_READY_STATUS })),
      finance_record_created: false,
      calls_agent_or_ris: false
    },
    message: 'จำลองผ่านการเงินแล้ว — refresh Worklist เพื่อทดสอบ flow ก่อนส่งเข้าเครื่อง'
  }
}

/* ขั้นที่ 2 — ใช้ตัวออก Accession เดิม แต่ไม่เรียก dispatch/RIS */
for (let index = 0; index < runItems.length; index += 1) {
  const entry = runItems[index]
  let issued = null
  try {
    issued = unwrapProcess(await app.runProcess(
      ACCESSION_PROCESS_ID,
      { item_id: entry.item_id },
      userInfo
    ))
  } catch (error) {
    return rollbackSeed('ออก Accession No. ไม่สำเร็จ: ' + text(error && error.message), 'accession_process_failed')
  }
  if (!issued || issued.success !== true || !issued.data || !text(issued.data.accession_no)) {
    return rollbackSeed(
      'ออก Accession No. ไม่สำเร็จ: ' + text(issued && issued.message),
      'accession_process_failed'
    )
  }

  entry.accession_no = text(issued.data.accession_no)
  entry.accession_already_assigned = issued.data.already_assigned === true
  const dispatchSeed = {
    run_id: seedRunId,
    mode: 'manual_result',
    outbound: false,
    agent_called: false,
    ris_called: false,
    at: now,
    by: actor
  }
  const dispatched = await app.db.collection(ITEM_COLLECTION).updateOne(
    {
      _id: app.dbObjectId(entry.item_id),
      xrstatx: ACTIVE,
      current_status: FINANCE_READY_STATUS,
      accession_no: entry.accession_no,
      'uat_finance_seed.run_id': seedRunId
    },
    {
      $set: {
        current_status: SEEDED_DISPATCH_STATUS,
        dispatched_at: now,
        dispatched_by: actor,
        dispatch_count: 1,
        transport_failed: false,
        transport: {
          status: 'seeded',
          route: 'uat_seed',
          outbound: false,
          local_saved: false,
          agent_called: false,
          ris_called: false,
          at: now,
          by: actor,
          message: 'UAT seed only — not sent to Agent/RIS'
        },
        uat_seed: dispatchSeed,
        updated_at: now,
        updated_by: actor
      }
    }
  )
  if (!dispatched || Number(dispatched.matchedCount) !== 1) {
    return rollbackSeed('mark UAT dispatch ของ item ' + entry.item_id + ' ไม่สำเร็จ', 'dispatch_seed_conflict')
  }
  entry.dispatch_seeded = true
  await updateRun(seedRunId, { status: 'seeding_dispatch', items: runItems })
}

await updateRun(seedRunId, { status: 'active', items: runItems })
return {
  success: true,
  data: {
    seed_run_id: seedRunId,
    order_id: orderId,
    hn,
    item_count: runItems.length,
    items: runItems.map(item => ({
      item_id: item.item_id,
      accession_no: item.accession_no,
      current_status: SEEDED_DISPATCH_STATUS
    })),
    finance_record_created: false,
    outbound_order_created: false,
    calls_agent_or_ris: false,
    next_step: 'เปิด Worklist แล้วบันทึกผล manual ตาม Accession ที่ seed'
  },
  message: 'Seed สำหรับลงผล manual สำเร็จ — ไม่มีข้อมูลถูกส่งไป Agent/RIS'
}
