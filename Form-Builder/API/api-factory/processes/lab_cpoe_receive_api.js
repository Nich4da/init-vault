/*
 * initCraft API Factory Process
 * Name: LAB CPOE - Receive specimen and queue an Agent outbound snapshot
 * Deployed Process ID: 6a94f634422c1ca959829d70
 *
 * Input: { item_id: '<zdata_cpoe_order_item _id>' }
 *
 * CPOE is read-only. Receipt is persisted in zdata_lab_work_item and the
 * transport snapshot is persisted in the actual DB collection name
 * zdata_lab_outband_order. No network call occurs inside this process. Replica
 * sets use mongoTxn; standalone MongoDB uses idempotent compare-and-set writes.
 */

const ITEM_COLLECTION = 'zdata_cpoe_order_item'
const ORDER_COLLECTION = 'zdata_cpoe_order'
const ITEM_MASTER_COLLECTION = 'zdata_master_item_order'
const WORK_ITEM_COLLECTION = 'zdata_lab_work_item'
const OUTBOUND_COLLECTION = 'zdata_lab_outband_order'
const ORDER_CANCELLATION_COLLECTION = 'zdata_lab_order_cancellation'
const WORK_ITEM_FORM_ID = '6a95c750422c1ca959829e8a'
const LAB_NO_PROCESS_ID = '6a94f1ed422c1ca959829d6e'
const PRIORITY_MAP = {
  R: 'R', ROUTINE: 'R', '1': 'R',
  A: 'A', URGENT: 'A', '2': 'A',
  S: 'S', STAT: 'S', '3': 'S', '4': 'S', '5': 'S'
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
const transactionUnsupported = error => {
  const message = lower(error && error.message || error)
  return message.includes('transaction numbers are only allowed on a replica set member or mongos') ||
    message.includes('transaction support is not available')
}
const processResult = value => {
  const result = value && value.result && typeof value.result === 'object'
    ? value.result
    : value || {}
  if (
    result.data &&
    typeof result.data === 'object' &&
    Object.prototype.hasOwnProperty.call(result.data, 'success')
  ) {
    return result.data
  }
  return result
}
const orderReference = item => item && item.order_id && item.order_id.value
  ? item.order_id.value
  : item && item.xparentx
const toThaiIso = value => {
  const raw = text(value)
  if (/^\d{14}$/.test(raw)) return raw
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+07:00$/.test(raw)) return raw
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(raw)
  return match ? match[1] + 'T' + match[2] + '+07:00' : ''
}
const birthDate = value => {
  const digits = text(value).replace(/\D/g, '')
  return digits.length >= 8 ? digits.slice(0, 8) : ''
}
const lastSentAt = order => {
  const stages = Array.isArray(order && order.status_stage) ? order.status_stage : []
  for (let index = stages.length - 1; index >= 0; index -= 1) {
    if (lower(stages[index] && stages[index].stage_status) === 'sent') return text(stages[index].stage_at)
  }
  return text(order && order.created_at)
}

const active = { $nin: [0, 3] }
const itemId = text(params && params.item_id)
if (!/^[a-f0-9]{24}$/i.test(itemId)) {
  return { success: false, error: 'invalid_item_id', message: 'item_id ไม่ถูกต้อง' }
}
if (!app.isAuth(userInfo.roles || [])) {
  return { success: false, error: 'forbidden', message: 'ไม่มีสิทธิ์รับ specimen' }
}

const actorCode = text(userInfo.employee_code || userInfo.username || userInfo.account && (userInfo.account.code || userInfo.account.name))
const actorName = text(userInfo.fullname || userInfo.display_name || userInfo.account && (userInfo.account.label || userInfo.account.name) || actorCode)
const organizationCode = text(userInfo.unit && userInfo.unit.code).toUpperCase()
const now = text(app.curDate('YYYY-MM-DD HH:mm:ss'))
const receivedIso = toThaiIso(now)
const itemObjectId = app.dbObjectId(itemId)
if (!actorCode) return { success: false, error: 'receiver_missing', message: 'ไม่พบรหัสผู้รับ specimen จากบัญชีผู้ใช้' }

const itemCollection = app.db.collection(ITEM_COLLECTION)
const orderCollection = app.db.collection(ORDER_COLLECTION)
const masterCollection = app.db.collection(ITEM_MASTER_COLLECTION)
const workCollection = app.db.collection(WORK_ITEM_COLLECTION)
const cancellationCollection = app.db.collection(ORDER_CANCELLATION_COLLECTION)

const item = await itemCollection.findOne({ _id: itemObjectId, xrstatx: active })
if (!item) return { success: false, error: 'item_not_found', message: 'ไม่พบ CPOE Item ที่ต้องการรับ specimen' }
if (lower(item.service_type && item.service_type.value) !== 'lab') {
  return { success: false, error: 'item_not_lab', message: 'รับ specimen ได้เฉพาะ LAB Item' }
}
const orderRef = orderReference(item)
if (!orderRef) return { success: false, error: 'order_reference_missing', message: 'Item ไม่มีข้อมูลเชื่อม CPOE Order' }
const order = await orderCollection.findOne({ _id: orderRef, xrstatx: active })
if (!order) return { success: false, error: 'order_not_found', message: 'ไม่พบ CPOE Order ของ Item นี้' }
const orderObjectId = order._id
const cancellationQuery = {
  _id: orderObjectId,
  xrstatx: active,
  cancel_status: { $in: ['pending', 'applied'] }
}
if (await cancellationCollection.findOne(cancellationQuery)) {
  return { success: false, error: 'order_cancelled', message: 'Order นี้ถูกยกเลิกแล้ว จึงรับ specimen ไม่ได้' }
}

let workItem = await workCollection.findOne({
  xrstatx: active,
  $or: [{ _id: itemObjectId }, { source_specimen_record_id: itemId }]
})
if (!workItem) {
  let generated
  try {
    generated = processResult(await app.subProcess(LAB_NO_PROCESS_ID, { item_id: itemId }, userInfo))
  } catch (error) {
    return { success: false, error: 'lab_no_process_failed', message: 'เรียก API สร้าง LAB NO. ไม่สำเร็จ' }
  }
  if (!generated || generated.success !== true || !text(generated.data && generated.data.lab_no)) {
    return { success: false, error: 'lab_no_failed', message: text(generated && generated.message) || 'สร้าง LAB NO. ไม่สำเร็จ' }
  }
  workItem = await workCollection.findOne({
    xrstatx: active,
    $or: [{ _id: itemObjectId }, { source_specimen_record_id: itemId }]
  })
  if (!workItem) {
    return { success: false, error: 'work_item_missing', message: 'สร้าง LAB NO. แล้วแต่ไม่พบ Lab Work Item กรุณาให้ผู้ดูแลตรวจสอบ' }
  }
}

const workStatus = lower(workItem.work_status)
if (!['waiting_receive', 'received'].includes(workStatus)) {
  return { success: false, error: 'invalid_status', message: 'รับ specimen ไม่ได้ในสถานะ ' + (workStatus || 'ไม่ทราบสถานะ') }
}
const labNo = text(workItem.lab_no)
if (!labNo) return { success: false, error: 'lab_no_missing', message: 'Lab Work Item ไม่มี LAB NO.' }

let master = null
if (item.item_data_id) master = await masterCollection.findOne({ _id: item.item_data_id, xrstatx: active })
const labData = item.lab_data && typeof item.lab_data === 'object' ? item.lab_data : {}
const masterLab = master && master.lab_item && typeof master.lab_item === 'object' ? master.lab_item : {}
const masterSpecimen = masterLab.specimen && !Array.isArray(masterLab.specimen) ? masterLab.specimen : {}
const patient = order.vid && order.vid.pid || {}
const visit = order.vid || {}
const rawPriority = text(order.priority && (order.priority.code || order.priority.value) || order.priority).toUpperCase()
const priority = PRIORITY_MAP[rawPriority] || ''
const collectedAt = toThaiIso(labData.specimen_at || labData.at)
const testCode = text(masterLab.his_lab_code)
const specimenCode = text(labData.spec_source_code || masterSpecimen.code)
const orderedAt = toThaiIso(lastSentAt(order))
const sectionCode = text(workItem.section_code).toUpperCase()
const workItemId = text(workItem._id)
const buildPayload = stableReceivedIso => {
  const payload = {
    order_no: workItemId,
    labno: labNo,
    hn: text(patient.hn),
    visit_id: text(visit.vn || order.xparentx),
    ordered_at: orderedAt,
    priority,
    note: text(order.order_comment) || null,
    patient_prefix: text(patient.prename),
    patient_first_name: text(patient.p_fname || patient.first_name),
    patient_last_name: text(patient.p_lname || patient.last_name),
    birth_date: birthDate(patient.birth_date),
    sex: text(visit.gender_text || patient.gender_text),
    visit_type: text(visit.visit_type),
    doctor_code: text(visit.visit_doctor && (visit.visit_doctor.code || visit.visit_doctor.value)),
    doctor_title: text(visit.visit_doctor && visit.visit_doctor.title),
    doctor_name: text(visit.visit_doctor && (visit.visit_doctor.name || visit.visit_doctor.label)),
    clinic_code: text(visit.visit_clinic && (visit.visit_clinic.code || visit.visit_clinic.value)),
    clinic_name: text(visit.visit_clinic && (visit.visit_clinic.name || visit.visit_clinic.label) || visit.ward),
    station: text(visit.ward || visit.visit_clinic && (visit.visit_clinic.name || visit.visit_clinic.label)),
    mongo_form_id: WORK_ITEM_FORM_ID,
    mongo_data_id: workItemId,
    items: [{
      seq: Number(item.item_no || 1),
      test_code: testCode,
      test_name: text(item.item_name || master && master.item_name || item.item_code),
      specimen_code: specimenCode,
      specimen_name: text(labData.spec_source || labData.source || masterSpecimen.name),
      collector_code: text(labData.specimen_by || labData.by),
      collector_name: text(labData.specimen_by_name),
      lab_code: sectionCode,
      collected_at: collectedAt,
      received_at: stableReceivedIso,
      receiver: actorCode
    }]
  }
  if (!payload.birth_date) delete payload.birth_date
  if (!collectedAt) delete payload.items[0].collected_at
  return payload
}

const missingOutbound = []
if (!orderedAt) missingOutbound.push('ordered_at')
if (!priority) missingOutbound.push('priority')
if (!testCode) missingOutbound.push('items[0].test_code')
if (!specimenCode) missingOutbound.push('items[0].specimen_code')
const readinessCode = missingOutbound.length ? 'awaiting_outbound_data' : ''

const persistReceive = async session => {
    const sessionOptions = session ? { session } : {}
    const txWorkCollection = app.db.collection(WORK_ITEM_COLLECTION)
    const outboundCollection = app.db.collection(OUTBOUND_COLLECTION)
    const txCancellationCollection = app.db.collection(ORDER_CANCELLATION_COLLECTION)
    const cancellation = await txCancellationCollection.findOne(cancellationQuery, sessionOptions)
    if (cancellation) throw new Error('ORDER_CANCELLED')
    let current = await txWorkCollection.findOne({ _id: workItem._id, xrstatx: active }, sessionOptions)
    if (!current) throw new Error('WORK_ITEM_NOT_FOUND')
    if (text(current.lab_no) !== labNo) throw new Error('LAB_NO_CONFLICT')
    let currentStatus = lower(current.work_status)
    if (!['waiting_receive', 'received'].includes(currentStatus)) throw new Error('WORK_ITEM_RECEIVE_CONFLICT')
    let alreadyReceived = currentStatus === 'received'

    const identityFields = {
      source_order_id: text(order._id),
      source_order_number: text(order.order_number),
      source_specimen_record_id: itemId,
      patient_hn: text(patient.hn),
      visit_id: text(visit.vn || order.xparentx),
      updated_at: now,
      updated_by: { id: userInfo._id || userInfo.id || '', name: actorName || actorCode }
    }

    let outbound = await outboundCollection.findOne({
      xrstatx: active,
      $or: [{ _id: itemObjectId }, { work_item_id: workItemId }]
    }, sessionOptions)

    if (currentStatus === 'waiting_receive') {
      const receiptFields = {
        ...identityFields,
        work_status: 'received',
        received_at: now,
        received_by: actorCode,
      }
      const saved = await txWorkCollection.updateOne(
        { _id: current._id, xrstatx: active, work_status: 'waiting_receive', lab_no: labNo },
        { $set: receiptFields },
        sessionOptions
      )
      if (!saved || Number(saved.matchedCount) !== 1) {
        if (session) throw new Error('WORK_ITEM_RECEIVE_CONFLICT')
        const raced = await txWorkCollection.findOne({ _id: current._id, xrstatx: active })
        if (!raced || lower(raced.work_status) !== 'received') throw new Error('WORK_ITEM_RECEIVE_CONFLICT')
        if (text(raced.lab_no) !== labNo) throw new Error('LAB_NO_CONFLICT')
        current = raced
        currentStatus = 'received'
        alreadyReceived = true
      } else {
        current = { ...current, ...receiptFields }
        currentStatus = 'received'
      }
    }

    if (currentStatus === 'received' && !text(current.visit_id)) {
      const backfilled = await txWorkCollection.updateOne(
        { _id: current._id, xrstatx: active, work_status: 'received', lab_no: labNo },
        { $set: identityFields },
        sessionOptions
      )
      if (!backfilled || Number(backfilled.matchedCount) !== 1) throw new Error('WORK_ITEM_IDENTITY_BACKFILL_FAILED')
      current = { ...current, ...identityFields }
    }

    const stableReceivedIso = toThaiIso(text(current.received_at) || now) || receivedIso
    const requestPayloadJson = JSON.stringify(buildPayload(stableReceivedIso))

    if (!outbound) {
      const outboundDoc = {
        _id: itemObjectId,
        xparentx: itemObjectId,
        xsitex: userInfo.site || {},
        xunitx: { code: sectionCode, name: text(current.section_name || sectionCode) },
        xrstatx: 1,
        xversionx: 'v1',
        xerrorx: null,
        dataid: itemId,
        work_item_id: workItemId,
        source_cpoe_order_id: text(order._id),
        source_cpoe_item_id: itemId,
        order_no: workItemId,
        lab_no: labNo,
        section_code: sectionCode,
        patient_hn: text(patient.hn),
        visit_id: text(visit.vn || order.xparentx),
        item_count: 1,
        hl7_status: 'new',
        transport_channel: 'agent_http',
        schema_version: '1.0',
        agent_http_status: null,
        agent_duplicate: false,
        retryable: readinessCode ? false : true,
        attempt_count: 0,
        first_attempt_at: '',
        last_attempt_at: '',
        next_retry_at: '',
        queued_at: '',
        sent_at: '',
        last_success_at: '',
        last_status_at: now,
        created_by: actorCode,
        updated_by: actorCode,
        created_at: now,
        updated_at: now,
        last_error_code: readinessCode,
        last_error_at: readinessCode ? now : '',
        last_error_http_status: '',
        last_error_reason: readinessCode ? 'ข้อมูลยังไม่พร้อมส่ง Agent' : '',
        last_error_detail_json: readinessCode ? JSON.stringify({ missing_fields: missingOutbound }) : '',
        request_payload_hash: '',
        response_payload_hash: '',
        request_payload_json: requestPayloadJson,
        response_payload_json: '',
        attempt_history_json: '[]'
      }
      try {
        await outboundCollection.insertOne(outboundDoc, sessionOptions)
        outbound = outboundDoc
      } catch (error) {
        if (session) throw error
        outbound = await outboundCollection.findOne({
          xrstatx: active,
          $or: [{ _id: itemObjectId }, { work_item_id: workItemId }]
        })
        if (!outbound) throw error
      }
    } else if (lower(outbound.hl7_status) === 'new' && Number(outbound.attempt_count || 0) === 0) {
      await outboundCollection.updateOne(
        { _id: outbound._id, xrstatx: active, hl7_status: 'new', attempt_count: 0 },
        { $set: {
          request_payload_json: requestPayloadJson,
          retryable: readinessCode ? false : true,
          last_status_at: now,
          updated_at: now,
          updated_by: actorCode,
          last_error_code: readinessCode,
          last_error_at: readinessCode ? now : '',
          last_error_reason: readinessCode ? 'ข้อมูลยังไม่พร้อมส่ง Agent' : '',
          last_error_detail_json: readinessCode ? JSON.stringify({ missing_fields: missingOutbound }) : ''
        } },
        sessionOptions
      )
    }

    return {
      alreadyReceived,
      workItemId,
      outboundOrderId: text(outbound._id),
      receivedAt: text(current.received_at) || now,
      receivedBy: text(current.received_by) || actorCode
    }
}

let receive
try {
  try {
    receive = await this.mongoTxn(
      session => persistReceive(session),
      { name: 'receiveLabWorkItemAndQueueOutbound', maxRetry: 5, timeoutMs: 15000 }
    )
  } catch (error) {
    if (!transactionUnsupported(error)) throw error
    receive = await persistReceive(null)
  }
} catch (error) {
  const code = text(error && error.message || error)
  const messages = {
    WORK_ITEM_NOT_FOUND: 'ไม่พบ Lab Work Item ระหว่างบันทึกรับ specimen',
    WORK_ITEM_RECEIVE_CONFLICT: 'Lab Work Item ถูกเปลี่ยนสถานะระหว่างรับ specimen กรุณาโหลดใหม่',
    WORK_ITEM_IDENTITY_BACKFILL_FAILED: 'อัปเดตข้อมูลอ้างอิงของ Lab Work Item ไม่สำเร็จ',
    LAB_NO_CONFLICT: 'LAB NO. ของ Work Item เปลี่ยนระหว่างรับ specimen',
    ORDER_CANCELLED: 'Order นี้ถูกยกเลิกแล้ว จึงรับ specimen ไม่ได้'
  }
  return { success: false, error: lower(code), message: messages[code] || 'บันทึกรับ specimen ไม่สำเร็จ: ' + code }
}

return {
  success: true,
  received: true,
  data: {
    item_id: itemId,
    work_item_id: receive.workItemId,
    outbound_order_id: receive.outboundOrderId,
    source_order_no: text(order.order_number),
    order_no: workItemId,
    lab_no: labNo,
    current_status: 'accepted',
    work_status: 'received',
    hl7_status: 'new',
    outbound_readiness: readinessCode || 'ready',
    missing_fields: missingOutbound,
    received_at: receive.receivedAt,
    received_by: receive.receivedBy,
    already_received: Boolean(receive.alreadyReceived),
    transport_deferred: true
  },
  message: receive.alreadyReceived
    ? 'Item นี้รับ specimen และมี Outbound Order แล้ว'
    : readinessCode
      ? 'รับ specimen แล้ว; Outbound Order รอข้อมูลก่อนส่ง Agent'
      : 'รับ specimenแล้ว; Outbound Order พร้อมทดสอบส่ง Agent'
}
