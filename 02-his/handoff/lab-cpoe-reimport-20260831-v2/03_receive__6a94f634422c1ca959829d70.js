/*
 * initCraft API Factory Process
 * Name: LAB CPOE - Receive specimen and submit Item to Agent
 *
 * Input: { item_id: '<zdata_cpoe_order_item _id>' }
 *
 * Deploy this file as a new API Factory process, then put the resulting Process
 * ID in the LAB Worklist UI.  Agent URL/Key remain only in the protected
 * LAB Agent Order Submit process; this process calls it as a subprocess.
 *
 * Important contract decisions for v1:
 * - Receive is Item-level and accepts exactly one item_id per call.
 * - LAB NO. is generated per Item by the dedicated generator process.
 * - Agent test_code is master.lab_item.his_lab_code only.  There is no silent
 *   fallback to c_test because those identifiers are not interchangeable.
 * - Physical receipt is independent from Agent readiness. Missing collection
 *   time or outbound fields park the accepted Item until source data arrives.
 * - The physical receive commit is never rolled back when Agent transport fails.
 * - Agent currently deduplicates by the root order_no. A later Item of the same
 *   CPOE Order is accepted but parked until item append is supported.
 */

const ITEM_COLLECTION = 'zdata_cpoe_order_item'
const ORDER_COLLECTION = 'zdata_cpoe_order'
const ITEM_MASTER_COLLECTION = 'zdata_master_item_order'
const SECTION_COLLECTION = 'zdata_section'

const LAB_NO_PROCESS_ID = '6a94f1ed422c1ca959829d6e'
const AGENT_SUBMIT_PROCESS_ID = '6a9468c7422c1ca959829d6a'
const TEST_CODE_SOURCE = 'his_lab_code'

const PRIORITY_MAP = {
  '1': 'R',
  '2': 'A',
  '3': 'S',
  '4': 'S',
  '5': 'S'
}

const valueText = value => {
  if (value == null) return ''
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return String(value.toHexString())
    if (value.$oid != null) return String(value.$oid)
    if (value._id != null) return valueText(value._id)
    if (value.code != null) return String(value.code)
    if (value.value != null && typeof value.value !== 'object') return String(value.value)
    if (value.label != null) return String(value.label)
  }
  return String(value)
}

const text = value => valueText(value).trim()
const lower = value => text(value).toLowerCase()
const selectCode = value => text(value && (value.code != null ? value.code : value.value))
const selectName = value => text(value && (value.label || value.name || value.name_th))
const addText = (target, key, value) => {
  const normalized = text(value)
  if (normalized) target[key] = normalized
}

const processResult = value => {
  if (value && value.result && typeof value.result === 'object') return value.result
  if (value && value.data && value.success == null && typeof value.data === 'object') return value.data
  return value || {}
}

const toAgentDateTime = value => {
  const source = text(value)
  if (!source) return ''
  if (/^\d{14}$/.test(source)) return source
  const local = source.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (local) return local.slice(1).join('')
  return ''
}

const toBirthDate = value => {
  const source = text(value)
  const matched = source.match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})/)
  return matched ? matched.slice(1).join('') : ''
}

const latestSentAt = order => {
  const stages = Array.isArray(order && order.status_stage) ? order.status_stage : []
  const sent = stages.filter(stage => lower(stage && stage.stage_status) === 'sent')
  return text(sent.length && sent[sent.length - 1].stage_at || order && order.created_at)
}

const orderReference = item => item && item.order_id && item.order_id.value
  ? item.order_id.value
  : item && item.xparentx

const active = { $nin: [0, 3] }
const itemId = text(params && params.item_id)

if (!/^[a-f0-9]{24}$/i.test(itemId)) {
  return { success: false, error: 'invalid_item_id', message: 'item_id ไม่ถูกต้อง' }
}

if (!app.isAuth(userInfo.roles || [])) {
  return { success: false, error: 'forbidden', message: 'ไม่มีสิทธิ์รับ specimen' }
}

const actorCode = text(
  userInfo.employee_code ||
  userInfo.username ||
  userInfo.account && (userInfo.account.code || userInfo.account.name)
)
const actorName = text(
  userInfo.fullname ||
  userInfo.display_name ||
  userInfo.account && (userInfo.account.label || userInfo.account.name) ||
  actorCode
)
const organizationCode = text(userInfo.unit && userInfo.unit.code).toUpperCase()
const now = app.curDate('YYYY-MM-DD HH:mm:ss')
const receivedAgentAt = toAgentDateTime(now)
const itemObjectId = app.dbObjectId(itemId)

if (!actorCode) {
  return { success: false, error: 'receiver_missing', message: 'ไม่พบรหัสผู้รับ specimen จากบัญชีผู้ใช้' }
}
if (!receivedAgentAt) {
  return { success: false, error: 'system_time_invalid', message: 'เวลา server ไม่ตรงรูปแบบที่ Agent รองรับ' }
}

const itemCollection = app.db.collection(ITEM_COLLECTION)
const orderCollection = app.db.collection(ORDER_COLLECTION)
const masterCollection = app.db.collection(ITEM_MASTER_COLLECTION)
const sectionCollection = app.db.collection(SECTION_COLLECTION)

const loadContext = async () => {
  const item = await itemCollection.findOne({ _id: itemObjectId, xrstatx: active })
  if (!item) throw new Error('ITEM_NOT_FOUND')
  if (lower(item.service_type && item.service_type.value) !== 'lab') throw new Error('ITEM_NOT_LAB')

  const ref = orderReference(item)
  if (!ref) throw new Error('ORDER_REFERENCE_MISSING')
  const order = await orderCollection.findOne({ _id: ref, xrstatx: active })
  if (!order) throw new Error('ORDER_NOT_FOUND')

  const master = item.item_data_id
    ? await masterCollection.findOne({ _id: item.item_data_id, xrstatx: active })
    : null
  if (!master) throw new Error('MASTER_NOT_FOUND')

  let section = item.section_snapshot ||
    item.lab_context_snapshot && item.lab_context_snapshot.section ||
    master.section || {}
  if (!text(section.code) && section.value) {
    const sectionId = typeof section.value === 'string' ? app.dbObjectId(section.value) : section.value
    const found = await sectionCollection.findOne({ _id: sectionId, xrstatx: active, enable: { $ne: false } })
    if (found) section = found
  }
  if (!text(section.code)) throw new Error('SECTION_MISSING')
  return { item, order, master, section, orderRef: ref }
}

const makePayload = (context, labNo) => {
  const item = context.item
  const order = context.order
  const master = context.master
  const section = context.section
  const labData = item.lab_data || {}
  const patient = order.vid && order.vid.pid || {}
  const clinic = order.vid && order.vid.visit_clinic || {}
  const doctor = order.cosign_user || order.vid && order.vid.visit_doctor || {}
  const specimenCode = text(labData.spec_source_code || labData.source_code)
  const specimenName = text(labData.spec_source || labData.source)
  const specimenCollectedAt = toAgentDateTime(labData.specimen_at || labData.at)
  const payloadReceivedAt = toAgentDateTime(item.received_at) || receivedAgentAt
  const orderedAt = toAgentDateTime(latestSentAt(order))
  const requestedAt = toAgentDateTime(order.created_at)
  const testCode = text(master.lab_item && master.lab_item[TEST_CODE_SOURCE])
  const priority = PRIORITY_MAP[text(order.priority)]

  const missing = []
  if (!text(order.order_number)) missing.push('order.order_number')
  if (!text(labNo)) missing.push('item.lab_no')
  if (!text(patient.hn)) missing.push('order.vid.pid.hn')
  if (!orderedAt) missing.push('order.status_stage.sent.stage_at')
  if (!priority) missing.push('order.priority')
  if (!testCode) missing.push('master.lab_item.' + TEST_CODE_SOURCE)
  if (!text(item.item_name || master.item_name)) missing.push('item.item_name')
  if (!specimenCode) missing.push('item.lab_data.spec_source_code')
  if (!specimenCollectedAt) missing.push('item.lab_data.specimen_at')
  if (missing.length) {
    const error = new Error('OUTBOUND_DATA_INCOMPLETE')
    error.fields = missing
    throw error
  }

  const payload = {
    order_no: text(order.order_number),
    labno: text(labNo),
    hn: text(patient.hn),
    ordered_at: orderedAt,
    priority,
    items: [{
      seq: Number(master.lab_item && master.lab_item.seq || item.item_no || 1),
      test_code: testCode,
      test_name: text(item.item_name || master.item_name),
      specimen_code: specimenCode,
      collected_at: specimenCollectedAt,
      received_at: payloadReceivedAt,
      receiver: actorCode
    }]
  }

  addText(payload, 'visit_id', order.vid && order.vid.vn)
  if (requestedAt) payload.requested_at = requestedAt
  addText(payload, 'patient_prefix', selectName(patient.prename) || patient.prename_full_name)
  addText(payload, 'patient_first_name', patient.p_fname)
  addText(payload, 'patient_last_name', patient.p_lname)
  addText(payload, 'birth_date', toBirthDate(patient.birth_date))
  addText(payload, 'sex', patient.gender_text || order.vid && order.vid.gender_text)
  addText(payload, 'visit_type', selectName(order.vid && order.vid.visit_type) || selectCode(order.vid && order.vid.visit_type))
  addText(payload, 'doctor_name', selectName(doctor))
  addText(payload, 'clinic_code', selectCode(clinic))
  addText(payload, 'clinic_name', selectName(clinic))
  addText(payload, 'note', order.order_comment)
  addText(payload, 'mongo_data_id', itemId)
  addText(payload.items[0], 'specimen_name', specimenName)
  addText(payload.items[0], 'collector_code', selectCode(labData.specimen_by || labData.by))
  addText(payload.items[0], 'collector_name', selectName(labData.specimen_by || labData.by))
  addText(payload.items[0], 'lab_code', section.code)
  if (!Number.isInteger(payload.items[0].seq) || payload.items[0].seq < 1) payload.items[0].seq = 1
  return payload
}

const saveTransport = async (transport, payload) => {
  const result = processResult(transport)
  const data = result.data || {}
  const queued = result.success === true && text(data.hl7_status) === 'queued'
  const set = {
    hl7_status: queued ? 'queued' : 'new',
    agent_transport_state: queued ? 'queued' : 'failed',
    agent_last_attempt_at: now,
    agent_last_attempt_by: actorCode,
    agent_test_code_source: TEST_CODE_SOURCE,
    agent_http_status: data.http_status != null ? data.http_status : result.http_status != null ? result.http_status : null,
    agent_retryable: queued ? false : Boolean(result.retryable),
    agent_error: queued ? '' : text(result.error),
    agent_error_reason: queued ? '' : text(result.reason || result.message),
    updated_at: now,
    updated_by: actorCode
  }
  if (queued) {
    set.agent_order_no = text(data.order_no || payload.order_no)
    set.agent_order_ref = text(data.order_ref)
    set.agent_dispatch_id = text(data.dispatch_id)
    set.agent_routed_to = Array.isArray(data.routed_to) ? data.routed_to.map(valueText) : []
    set.agent_duplicate = Boolean(data.duplicate)
    set.agent_queued_at = now
  }
  await itemCollection.updateOne({ _id: itemObjectId, xrstatx: active }, { $set: set })
  return { result, queued }
}

let context
try {
  context = await loadContext()
} catch (error) {
  const messages = {
    ITEM_NOT_FOUND: 'ไม่พบ CPOE Item ที่ต้องการรับ specimen',
    ITEM_NOT_LAB: 'รับ specimen ได้เฉพาะ LAB Item',
    ORDER_REFERENCE_MISSING: 'Item ไม่มีข้อมูลเชื่อม CPOE Order',
    ORDER_NOT_FOUND: 'ไม่พบ CPOE Order ของ Item นี้',
    MASTER_NOT_FOUND: 'ไม่พบ Item Master สำหรับสร้างข้อมูลส่ง Agent',
    SECTION_MISSING: 'Item Master ยังไม่ได้กำหนด LAB Section'
  }
  const code = text(error && error.message || error)
  return { success: false, error: lower(code), message: messages[code] || 'อ่านข้อมูลรับ specimen ไม่สำเร็จ: ' + code }
}

if (!['sent', 'accepted'].includes(lower(context.item.current_status))) {
  return { success: false, error: 'invalid_status', message: 'รับ specimen ได้เฉพาะ Item สถานะ sent' }
}

if (lower(context.item.current_status) === 'accepted' && lower(context.item.hl7_status) === 'queued') {
  const persistedCollectedAt = toAgentDateTime(
    context.item.lab_data && (context.item.lab_data.specimen_at || context.item.lab_data.at)
  )
  return {
    success: true,
    data: {
      item_id: itemId,
      order_no: text(context.order.order_number),
      lab_no: text(context.item.lab_no),
      current_status: 'accepted',
      hl7_status: 'queued',
      received_at: text(context.item.received_at),
      received_by: text(context.item.received_by),
      collected_at_source: text(context.item.agent_collected_at_source) ||
        (persistedCollectedAt ? 'specimen_at' : ''),
      already_received: true,
      already_submitted: true
    },
    message: 'Item นี้รับ specimen และส่ง Agent แล้ว'
  }
}

// Whole-order Agent idempotency currently makes a second Item with the same
// order_no unsafe to submit. Physical receipt must still be allowed, so remember
// the conflict and park transport after the receive commit.
const siblingQueued = await itemCollection.findOne({
  _id: { $ne: itemObjectId },
  xrstatx: active,
  $or: [
    { 'order_id.value': context.orderRef },
    { xparentx: context.orderRef }
  ],
  hl7_status: 'queued'
})

let generated
try {
  generated = processResult(await app.subProcess(LAB_NO_PROCESS_ID, { item_id: itemId }, userInfo))
} catch (error) {
  return { success: false, error: 'lab_no_process_failed', message: 'เรียก API สร้าง LAB NO. ไม่สำเร็จ' }
}
if (!generated || generated.success !== true || !text(generated.data && generated.data.lab_no)) {
  return {
    success: false,
    error: 'lab_no_failed',
    message: text(generated && generated.message) || 'สร้าง LAB NO. ไม่สำเร็จ'
  }
}

const labNo = text(generated.data.lab_no)
let receive
try {
  receive = await this.mongoTxn(async session => {
    const current = await itemCollection.findOne({ _id: itemObjectId, xrstatx: active }, { session })
    if (!current) throw new Error('ITEM_NOT_FOUND')
    const status = lower(current.current_status)
    if (status === 'accepted') {
      const persistedCollectedAt = toAgentDateTime(
        current.lab_data && (current.lab_data.specimen_at || current.lab_data.at)
      )
      return {
        alreadyReceived: true,
        receivedAt: text(current.received_at),
        receivedBy: text(current.received_by),
        collectedAtSource: text(current.agent_collected_at_source) ||
          (persistedCollectedAt ? 'specimen_at' : ''),
        item: current
      }
    }
    if (status !== 'sent') throw new Error('ITEM_RECEIVE_CONFLICT')
    if (text(current.lab_no) !== labNo) throw new Error('LAB_NO_CONFLICT')

    const persistedCollectedAt = toAgentDateTime(
      current.lab_data && (current.lab_data.specimen_at || current.lab_data.at)
    )
    const collectedAtSource = persistedCollectedAt ? 'specimen_at' : ''
    const saved = await itemCollection.updateOne(
      { _id: itemObjectId, xrstatx: active, current_status: 'sent', lab_no: labNo },
      {
        $set: {
          current_status: 'accepted',
          received_at: now,
          received_by: actorCode,
          received_by_name: actorName,
          received_organization_code: organizationCode,
          agent_collected_at_source: collectedAtSource,
          hl7_status: 'new',
          agent_transport_state: persistedCollectedAt ? 'pending' : 'awaiting_collection',
          updated_at: now,
          updated_by: actorCode
        },
        $push: {
          status_stage: {
            stage_status: 'accepted',
            stage_at: now,
            stage_by: actorCode,
            stage_by_name: actorName,
            stage_location: organizationCode,
            source: 'lab_cpoe_receive_api'
          }
        }
      },
      { session }
    )
    if (!saved || Number(saved.matchedCount) !== 1) throw new Error('ITEM_RECEIVE_CONFLICT')
    return {
      alreadyReceived: false,
      receivedAt: now,
      receivedBy: actorCode,
      collectedAtSource,
      item: { ...current, current_status: 'accepted', lab_no: labNo }
    }
  }, { name: 'receiveLabCpoeItem', maxRetry: 5, timeoutMs: 15000 })
} catch (error) {
  const code = text(error && error.message || error)
  const messages = {
    ITEM_NOT_FOUND: 'ไม่พบ CPOE Item ระหว่างบันทึกรับ specimen',
    ITEM_RECEIVE_CONFLICT: 'Item ถูกเปลี่ยนสถานะระหว่างรับ specimen กรุณาโหลดใหม่',
    LAB_NO_CONFLICT: 'LAB NO. ของ Item เปลี่ยนระหว่างรับ specimen'
  }
  return { success: false, error: lower(code), message: messages[code] || 'บันทึกรับ specimen ไม่สำเร็จ: ' + code }
}

// Reload after the receive commit so the payload and audit response reflect the
// persisted LAB NO. and receive state.  Transport is deliberately outside txn.
context.item = await itemCollection.findOne({ _id: itemObjectId, xrstatx: active }) || context.item
if (siblingQueued) {
  await itemCollection.updateOne(
    { _id: itemObjectId, xrstatx: active },
    {
      $set: {
        hl7_status: 'new',
        agent_transport_state: 'awaiting_agent_append',
        agent_retryable: false,
        agent_error: 'agent_order_dedupe_conflict',
        agent_error_reason: 'รอ Agent รองรับ item append สำหรับ order_no เดียวกัน',
        updated_at: now,
        updated_by: actorCode
      }
    }
  )
  return {
    success: true,
    received: true,
    data: {
      item_id: itemId,
      order_no: text(context.order.order_number),
      lab_no: labNo,
      current_status: 'accepted',
      hl7_status: 'new',
      received_at: receive.receivedAt || now,
      received_by: receive.receivedBy || actorCode,
      collected_at_source: receive.collectedAtSource || '',
      agent_transport_state: 'awaiting_agent_append',
      already_received: Boolean(receive.alreadyReceived)
    },
    message: 'รับ specimen แล้ว; รอ Agent รองรับ Item เพิ่มเติมของ Order เดิมก่อนส่ง'
  }
}
let payload
try {
  payload = makePayload(context, labNo)
} catch (error) {
  if (text(error && error.message) === 'OUTBOUND_DATA_INCOMPLETE') {
    const missingFields = Array.isArray(error.fields) ? error.fields : []
    const collectionPending = missingFields.includes('item.lab_data.specimen_at')
    const waitingState = collectionPending ? 'awaiting_collection' : 'awaiting_outbound_data'
    const waitingError = collectionPending ? 'collection_time_pending' : 'outbound_data_incomplete'
    const waitingReason = collectionPending
      ? 'รอเวลาเก็บ specimen และข้อมูลที่จำเป็นจากต้นทางก่อนส่ง Agent'
      : 'รอข้อมูลที่จำเป็นจากต้นทางก่อนส่ง Agent'
    await itemCollection.updateOne(
      { _id: itemObjectId, xrstatx: active },
      {
        $set: {
          hl7_status: 'new',
          agent_transport_state: waitingState,
          agent_collected_at_source: collectionPending ? '' : receive.collectedAtSource || 'specimen_at',
          agent_retryable: false,
          agent_error: waitingError,
          agent_error_reason: waitingReason,
          agent_missing_fields: missingFields,
          updated_at: now,
          updated_by: actorCode
        }
      }
    )
    return {
      success: true,
      received: true,
      data: {
        item_id: itemId,
        order_no: text(context.order.order_number),
        lab_no: labNo,
        current_status: 'accepted',
        hl7_status: 'new',
        received_at: receive.receivedAt || now,
        received_by: receive.receivedBy || actorCode,
        collected_at_source: collectionPending ? '' : receive.collectedAtSource || 'specimen_at',
        collection_time_pending: collectionPending,
        agent_transport_state: waitingState,
        agent_missing_fields: missingFields,
        already_received: Boolean(receive.alreadyReceived)
      },
      message: collectionPending
        ? 'รับ specimen แล้ว; รอเวลาเก็บ specimen จากต้นทางก่อนส่ง Agent'
        : 'รับ specimen แล้ว; รอข้อมูลจากต้นทางก่อนส่ง Agent'
    }
  }
  await saveTransport({
    success: false,
    error: 'payload_build_failed_after_receive',
    retryable: false,
    message: 'รับ specimen แล้ว แต่สร้าง payload หลังบันทึกไม่สำเร็จ'
  }, { order_no: text(context.order.order_number) })
  return {
    success: false,
    error: 'payload_build_failed_after_receive',
    received: true,
    retryable: false,
    data: {
      item_id: itemId,
      lab_no: labNo,
      current_status: 'accepted',
      hl7_status: 'new',
      received_at: receive.receivedAt || now,
      received_by: receive.receivedBy || actorCode,
      collected_at_source: receive.collectedAtSource || 'specimen_at'
    },
    message: 'รับ specimen แล้ว แต่ยังส่ง Agent ไม่ได้ กรุณาตรวจข้อมูลและ reconcile'
  }
}

let submitted
try {
  submitted = await app.subProcess(AGENT_SUBMIT_PROCESS_ID, { payload }, userInfo)
} catch (error) {
  submitted = {
    success: false,
    error: 'agent_submit_process_failed',
    retryable: true,
    hl7_status: 'new',
    message: 'เรียก API ส่ง Agent ไม่สำเร็จ'
  }
}

const transport = await saveTransport(submitted, payload)
if (!transport.queued) {
  return {
    success: false,
    error: text(transport.result.error) || 'agent_submit_failed',
    received: true,
    retryable: Boolean(transport.result.retryable),
    data: {
      item_id: itemId,
      order_no: payload.order_no,
      lab_no: labNo,
      current_status: 'accepted',
      hl7_status: 'new',
      received_at: receive.receivedAt || now,
      received_by: receive.receivedBy || actorCode,
      collected_at_source: receive.collectedAtSource || 'specimen_at',
      test_code_source: TEST_CODE_SOURCE,
      http_status: transport.result.http_status == null ? null : transport.result.http_status
    },
    message: text(transport.result.message) || 'รับ specimen แล้ว แต่ยังส่ง Agent ไม่สำเร็จ; รอ reconcile'
  }
}

return {
  success: true,
  data: {
    item_id: itemId,
    order_no: payload.order_no,
    lab_no: labNo,
    current_status: 'accepted',
    hl7_status: 'queued',
    received_at: receive.receivedAt || now,
    received_by: receive.receivedBy || actorCode,
    collected_at_source: receive.collectedAtSource || 'specimen_at',
    already_received: Boolean(receive.alreadyReceived),
    test_code_source: TEST_CODE_SOURCE,
    agent: transport.result.data || {}
  },
  message: receive.alreadyReceived
    ? 'Item นี้รับ specimen แล้วและส่ง Agent เข้าคิวแล้ว'
    : 'รับ specimen และส่ง Agent เข้าคิวแล้ว'
}
