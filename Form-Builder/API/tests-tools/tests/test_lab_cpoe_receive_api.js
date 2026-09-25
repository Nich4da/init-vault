const assert = require('assert')
const fs = require('fs')
const path = require('path')

const apiBody = fs.readFileSync(path.join(__dirname, '../../api-factory/processes/lab_cpoe_receive_api.js'), 'utf8')
const agentApiBody = fs.readFileSync(path.join(__dirname, '../../api-factory/processes/lab_agent_order_submit_api.js'), 'utf8')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const Process = new AsyncFunction('params', 'userInfo', 'app', apiBody)
const AgentProcess = new AsyncFunction('params', 'userInfo', 'app', agentApiBody)

const ids = {
  item: '111111111111111111111111',
  item2: '222222222222222222222222',
  order: '333333333333333333333333',
  master: '444444444444444444444444',
  master2: '555555555555555555555555',
  visit: '666666666666666666666666'
}
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value))

const makeHarness = ({
  itemPatch = {},
  orderPatch = {},
  workPatch = null,
  generatorFailure = false,
  generatorEnvelope = true,
  standalone = false,
  cancellation = null,
  agentResult = null,
  agentThrows = false,
  patientPrename = 'ด.ช.',
  patientBirthDate = '2020-01-02',
  visitBirthDate = null,
  visitGenderCode = '1'
} = {}) => {
  const item = {
    _id: ids.item,
    xrstatx: 1,
    // 2026-09-23 user requirement: Finance changes the Item to `ready`
    // before LAB may receive its specimen.
    current_status: 'ready',
    service_type: { value: 'lab' },
    item_data_id: ids.master,
    order_id: { value: ids.order },
    item_code: 'CHEM-GLU',
    item_name: 'Glucose',
    item_no: 1,
    lab_data: { spec_source: 'Clotted blood', spec_source_code: 'CD' },
    ...clone(itemPatch)
  }
  const originalItem = clone(item)
  const item2 = {
    ...clone(item),
    _id: ids.item2,
    item_data_id: ids.master2,
    item_code: 'CHEM-CRE',
    item_name: 'Creatinine',
    item_no: 2
  }
  const items = new Map([[ids.item, item], [ids.item2, item2]])
  const order = {
    _id: ids.order,
    xrstatx: 1,
    order_number: 'R2608310001',
    priority: 'R',
    created_at: '2026-08-31 08:00:00',
    status_stage: [{ stage_status: 'sent', stage_at: '2026-08-31 08:05:00' }],
    vid: {
      value: ids.visit,
      vn: 'VN0001',
      pid: {
        hn: 'HN0001',
        prename: clone(patientPrename),
        p_fname: 'ทดสอบ',
        p_lname: 'ระบบ',
        ...(patientBirthDate == null ? {} : { birth_date: patientBirthDate })
      },
      ...(visitBirthDate == null ? {} : { birth_date: visitBirthDate }),
      visit_clinic: { code: 'OPD', name: 'OPD Clinic' },
      gender_text: 'ชาย'
    },
    ...clone(orderPatch)
  }
  const master = {
    _id: ids.master,
    xrstatx: 1,
    item_name: 'Glucose',
    lab_item: { his_lab_code: '1087CD', specimen: { code: 'CD', name: 'Clotted blood' } }
  }
  const master2 = {
    _id: ids.master2,
    xrstatx: 1,
    item_name: 'Creatinine',
    lab_item: { his_lab_code: '1088CD', specimen: { code: 'CD', name: 'Clotted blood' } }
  }
  const masters = new Map([[ids.master, master], [ids.master2, master2]])
  const workItems = new Map()
  if (workPatch) {
    workItems.set(ids.item, {
      _id: ids.item,
      xrstatx: 1,
      source_specimen_record_id: ids.item,
      source_order_id: ids.order,
      source_order_number: order.order_number,
      lab_no: '106908310001',
      section_code: 'BC',
      section_name: 'Biochemistry',
      work_status: 'waiting_receive',
      patient_hn: 'HN0001',
      patient_name: 'ด.ช. ทดสอบ ระบบ',
      ...clone(workPatch)
    })
  }
  const outboundRows = new Map()
  const cancellations = new Map()
  if (cancellation) cancellations.set(ids.order, { _id: ids.order, xrstatx: 1, cancel_status: 'applied', ...clone(cancellation) })
  let currentNow = '2026-08-31 08:20:00'
  const active = row => row && ![0, 3].includes(Number(row.xrstatx))
  const matches = (row, query) => {
    if (!active(row)) return false
    if (query._id != null && String(row._id) !== String(query._id)) return false
    if (query.source_specimen_record_id != null && row.source_specimen_record_id !== query.source_specimen_record_id) return false
    if (query.work_item_id != null && row.work_item_id !== query.work_item_id) return false
    if (query.order_no != null && row.order_no !== query.order_no) return false
    if (query.work_status != null && row.work_status !== query.work_status) return false
    if (query.is_current_attempt && '$ne' in query.is_current_attempt && row.is_current_attempt === query.is_current_attempt.$ne) return false
    if (query.hl7_status && query.hl7_status.$in && !query.hl7_status.$in.includes(row.hl7_status)) return false
    if (typeof query.hl7_status === 'string' && row.hl7_status !== query.hl7_status) return false
    if (query.attempt_count != null && Number(row.attempt_count || 0) !== Number(query.attempt_count)) return false
    if (query.current_status && query.current_status.$nin && query.current_status.$nin.includes(row.current_status)) return false
    if (query.lab_no != null && row.lab_no !== query.lab_no) return false
    if (query.$or && !query.$or.some(part => matches(row, { ...part, xrstatx: query.xrstatx }))) return false
    return true
  }
  const mapCollection = map => ({
    findOne: async query => {
      for (const row of map.values()) if (matches(row, query)) return clone(row)
      return null
    },
    insertOne: async doc => {
      if (map.has(String(doc._id))) throw new Error('duplicate key')
      map.set(String(doc._id), clone(doc))
      return { insertedId: doc._id }
    },
    updateOne: async (query, update) => {
      for (const [key, row] of map.entries()) {
        if (!matches(row, query)) continue
        Object.assign(row, clone(update.$set || {}))
        map.set(key, row)
        return { matchedCount: 1, modifiedCount: 1 }
      }
      return { matchedCount: 0, modifiedCount: 0 }
    }
  })
  const workCollection = mapCollection(workItems)
  const outboundCollection = mapCollection(outboundRows)
  const cancellationCollection = mapCollection(cancellations)
  const itemCollection = {
    findOne: async query => {
      const row = items.get(String(query._id))
      return active(row) ? clone(row) : null
    },
    updateOne: async (query, update) => {
      const row = items.get(String(query._id))
      if (!active(row)) return { matchedCount: 0, modifiedCount: 0 }
      if (query.current_status && query.current_status.$nin && query.current_status.$nin.includes(row.current_status)) {
        return { matchedCount: 0, modifiedCount: 0 }
      }
      Object.assign(row, clone(update.$set || {}))
      return { matchedCount: 1, modifiedCount: 1 }
    }
  }
  let generatorCalls = 0
  let agentCalls = 0
  const agentPayloads = []
  const agentAuditFlags = []
  let unexpectedSubprocessCalls = 0
  const app = {
    isAuth: () => true,
    curDate: () => currentNow,
    dbObjectId: value => String(value),
    db: {
      collection: name => ({
        zdata_cpoe_order_item: itemCollection,
        zdata_cpoe_order: { findOne: async query => String(query._id) === ids.order ? clone(order) : null },
        zdata_visit: { findOne: async query => String(query._id) === ids.visit ? { pid: { p_gender: visitGenderCode } } : null },
        zdata_master_item_order: { findOne: async query => clone(masters.get(String(query._id)) || null) },
        zdata_lab_work_item: workCollection,
        zdata_lab_outband_order: outboundCollection,
        zdata_lab_order_cancellation: cancellationCollection
      })[name]
    },
    subProcess: async (processId, processParams) => {
      if (processId === '6a9468c7422c1ca959829d6a') {
        agentCalls += 1
        agentPayloads.push(clone(processParams.payload))
        agentAuditFlags.push(processParams.audit_managed_by_receive)
        if (agentThrows) throw new Error('agent subprocess unavailable')
        const result = agentResult || {
          success: true,
          data: {
            http_status: 202,
            hl7_status: 'queued',
            order_no: processParams.payload.order_no,
            labno: processParams.payload.labno,
            duplicate: false,
            dispatch_id: 'DISPATCH-1',
            order_ref: 'ORDER-REF-1',
            routed_to: ['rax-file']
          },
          message: 'Agent รับ Order เข้าคิวแล้ว'
        }
        return { success: true, message: 'API run success', data: clone(result), error: '' }
      }
      if (processId !== '6a94f1ed422c1ca959829d6e') {
        unexpectedSubprocessCalls += 1
        throw new Error('unexpected subprocess ' + processId)
      }
      generatorCalls += 1
      const wrapGeneratorResult = result => generatorEnvelope
        ? { success: true, message: 'API run success', data: result, error: '' }
        : result
      if (generatorFailure) return wrapGeneratorResult({ success: false, message: 'counter failed' })
      const generatedIds = Array.isArray(processParams.item_ids) && processParams.item_ids.length
        ? processParams.item_ids
        : [processParams.item_id]
      const receiptBatchId = generatedIds.slice().sort()[0]
      for (const generatedId of generatedIds) {
        const existingWork = workItems.get(generatedId)
        if (existingWork) {
          if (existingWork.retest_pending_lab_no === true && !existingWork.lab_no) {
            Object.assign(existingWork, {
              receipt_batch_id: receiptBatchId,
              batch_item_count: generatedIds.length,
              lab_no: '106908310001',
              work_status: 'waiting_receive',
              retest_pending_lab_no: false
            })
          }
          continue
        }
        workItems.set(generatedId, {
          _id: generatedId,
          xrstatx: 1,
          source_specimen_record_id: generatedId,
          source_order_id: ids.order,
          source_order_number: order.order_number,
          receipt_batch_id: receiptBatchId,
          batch_item_count: generatedIds.length,
          lab_no: '106908310001',
          section_code: 'BC',
          section_name: 'Biochemistry',
          work_status: 'waiting_receive',
          patient_hn: 'HN0001',
          patient_name: 'ด.ช. ทดสอบ ระบบ'
        })
      }
      return wrapGeneratorResult({
        success: true,
        data: {
          item_id: generatedIds[0],
          item_ids: generatedIds,
          work_item_id: receiptBatchId,
          receipt_batch_id: receiptBatchId,
          batch_item_count: generatedIds.length,
          lab_no: '106908310001'
        }
      })
    }
  }
  return {
    app,
    context: {
      mongoTxn: async fn => {
        if (standalone) throw new Error('Transaction numbers are only allowed on a replica set member or mongos')
        return fn({ id: 'mock-session' })
      }
    },
    userInfo: { roles: ['lab'], username: '120170', fullname: 'Receiver One', unit: { code: 'M1001' } },
    item,
    items,
    originalItem,
    workItems,
    outboundRows,
    cancellations,
    setNow: value => { currentNow = value },
    calls: () => ({ generatorCalls, agentCalls, agentPayloads, agentAuditFlags, unexpectedSubprocessCalls })
  }
}

;(async () => {
  {
    const result = await Process({ cross_section: true }, {}, {})
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'cross_section_read_only')
  }

  {
    const harness = makeHarness({ itemPatch: { current_status: 'sent' } })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'payment_not_ready')
    assert.strictEqual(result.message, 'ยังไม่ผ่านการเงิน')
    assert.strictEqual(harness.calls().generatorCalls, 0, 'unpaid Item must fail before LAB NO. generation')
    assert.strictEqual(harness.workItems.size, 0)
    assert.strictEqual(harness.outboundRows.size, 0)
  }

  {
    const harness = makeHarness()
    harness.items.get(ids.item2).current_status = 'sent'
    const result = await Process.call(
      harness.context,
      { item_id: ids.item, item_ids: [ids.item, ids.item2] },
      harness.userInfo,
      harness.app
    )
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'payment_not_ready')
    assert.strictEqual(result.message, 'ยังไม่ผ่านการเงิน')
    assert.strictEqual(harness.calls().generatorCalls, 0, 'mixed ready/unpaid batch must fail before LAB NO. generation')
    assert.strictEqual(harness.workItems.size, 0)
  }

  {
    const harness = makeHarness()
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.current_status, 'accepted')
    assert.strictEqual(result.data.work_status, 'received')
    assert.strictEqual(result.data.lab_no, '106908310001')
    assert.strictEqual(result.data.outbound_readiness, 'ready')
    assert.deepStrictEqual(harness.item, { ...harness.originalItem, current_status: 'accepted' })
    assert.strictEqual(harness.workItems.get(ids.item).work_status, 'received')
    assert.strictEqual(harness.workItems.get(ids.item).visit_id, 'VN0001')
    assert.strictEqual(harness.outboundRows.size, 1)
    const outbound = harness.outboundRows.get(ids.item)
    assert.strictEqual(outbound.hl7_status, 'queued')
    assert.strictEqual(outbound.attempt_count, 1)
    assert.strictEqual(outbound.agent_http_status, 202)
    assert.strictEqual(outbound.retryable, false)
    assert.strictEqual(outbound.dispatch_id, 'DISPATCH-1')
    assert.strictEqual(outbound.order_ref, 'ORDER-REF-1')
    assert.deepStrictEqual(JSON.parse(outbound.routed_to_json), ['rax-file'])
    assert.strictEqual(outbound.work_item_id, ids.item)
    assert.strictEqual(outbound.source_cpoe_item_id, ids.item)
    assert.strictEqual(outbound.last_error_code, '')
    const noCollectionPayload = JSON.parse(outbound.request_payload_json)
    assert.strictEqual(noCollectionPayload.labno, '106908310001')
    assert.strictEqual(noCollectionPayload.sex, 'M', 'coded Visit gender 1 must be sent as M')
    assert.strictEqual(noCollectionPayload.patient_prefix, 'ด.ช.', 'plain-text prefix must remain supported')
    assert.strictEqual(noCollectionPayload.birth_date, '20200102', 'existing vid.pid.birth_date mapping must remain supported')
    assert.strictEqual(noCollectionPayload.items[0].received_at, '2026-08-31T08:20:00+07:00')
    assert.strictEqual(Object.prototype.hasOwnProperty.call(noCollectionPayload.items[0], 'collected_at'), false)
    const noCollectionContract = await AgentProcess(
      { payload: noCollectionPayload },
      harness.userInfo,
      { isAuth: () => true }
    )
    assert.strictEqual(noCollectionContract.error, 'not_configured', 'collected_at must be optional for Agent dispatch')
    assert.strictEqual(harness.calls().generatorCalls, 1)
    assert.strictEqual(harness.calls().agentCalls, 1)
    assert.strictEqual(harness.calls().agentPayloads[0].order_no, ids.item)
    assert.strictEqual(harness.calls().agentAuditFlags[0], true, 'Receive must remain the sole audit owner')
    assert.strictEqual(harness.calls().unexpectedSubprocessCalls, 0)
    assert.strictEqual(result.data.agent_send_success, true)
    assert.strictEqual(result.data.agent_transport_state, 'queued')
    assert.strictEqual(result.data.transport_deferred, false)

    harness.setNow('2026-08-31 09:45:00')
    const repeated = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(repeated.success, true)
    assert.strictEqual(repeated.data.already_received, true)
    assert.strictEqual(repeated.data.received_at, '2026-08-31 08:20:00')
    assert.strictEqual(harness.outboundRows.size, 1)
    const repeatedPayload = JSON.parse(harness.outboundRows.get(ids.item).request_payload_json)
    assert.strictEqual(
      repeatedPayload.items[0].received_at,
      '2026-08-31T08:20:00+07:00',
      'idempotent retry must preserve the Work Item receipt timestamp'
    )
    assert.strictEqual(harness.calls().generatorCalls, 1)
    assert.strictEqual(harness.calls().agentCalls, 1, 'already queued retry must not send Agent twice')
    assert.strictEqual(repeated.data.agent_transport_state, 'already_queued')
  }

  {
    const harness = makeHarness({ patientPrename: { value: '001', label: 'ด.ช.', prename_full_name: 'เด็กชาย' } })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, true)
    const payload = JSON.parse(harness.outboundRows.get(ids.item).request_payload_json)
    assert.strictEqual(payload.patient_prefix, 'ด.ช.', 'single-item payload must use prefix text, not the stored code')
    assert.strictEqual(harness.calls().agentPayloads[0].patient_prefix, 'ด.ช.')
  }

  {
    // Live CPOE shape verified 2026-09-10: DOB is stored on vid.birth_date.
    // Add this source path without changing the existing vid.pid fallback.
    const harness = makeHarness({
      workPatch: {},
      patientBirthDate: null,
      visitBirthDate: '2020-03-04'
    })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, true)
    const payload = JSON.parse(harness.outboundRows.get(ids.item).request_payload_json)
    assert.strictEqual(payload.birth_date, '20200304')
    assert.strictEqual(harness.calls().agentPayloads[0].birth_date, '20200304')
  }

  {
    // Display text is not a trusted Agent code. Unknown source codes keep the
    // specimen receipt but prevent outbound dispatch until corrected.
    const harness = makeHarness({ workPatch: {}, visitGenderCode: '9' })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.outbound_readiness, 'awaiting_outbound_data')
    assert.strictEqual(harness.calls().agentCalls, 0)
    assert.strictEqual(harness.workItems.get(ids.item).work_status, 'received')
    assert.strictEqual(JSON.parse(harness.outboundRows.get(ids.item).request_payload_json).sex, '')
  }

  {
    /* 2026-09-08 user-approved behavior: Worklist receipt must return the
       committed LAB NO. without waiting for Agent transport. Default sync is
       still covered above for backward-compatible callers. */
    const harness = makeHarness({ workPatch: {} })
    const result = await Process.call(
      harness.context,
      { item_id: ids.item, dispatch_mode: 'deferred' },
      harness.userInfo,
      harness.app
    )
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.lab_no, '106908310001')
    assert.strictEqual(result.data.current_status, 'accepted')
    assert.strictEqual(result.data.work_status, 'received')
    assert.strictEqual(result.data.transport_deferred, true)
    assert.strictEqual(result.data.agent_dispatch_queued, true)
    assert.strictEqual(result.data.agent_transport_state, 'pending_dispatch')
    assert.strictEqual(result.data.agent_send_success, false)
    assert.strictEqual(harness.calls().agentCalls, 0, 'deferred receipt must not wait for Agent')
    const outbound = harness.outboundRows.get(ids.item)
    assert(outbound, 'deferred receipt must persist its Outbound snapshot first')
    assert.strictEqual(outbound.hl7_status, 'new')
    assert.strictEqual(outbound.attempt_count, 0)
  }

  {
    // 2026-09-09 LIS contract: two selected tests with the same specimen must
    // share one LAB NO. and one Outbound payload containing both items.
    const harness = makeHarness({
      patientPrename: { value: '001', label: 'ด.ช.', prename_full_name: 'เด็กชาย' },
      patientBirthDate: null,
      visitBirthDate: '2020-03-04',
      visitGenderCode: '2'
    })
    const selectedIds = [ids.item, ids.item2]
    const deferred = await Process.call(
      harness.context,
      { item_id: ids.item, item_ids: selectedIds, dispatch_mode: 'deferred' },
      harness.userInfo,
      harness.app
    )
    assert.strictEqual(deferred.success, true, deferred.message)
    assert.strictEqual(deferred.data.batch_item_count, 2)
    assert.strictEqual(deferred.data.items.length, 2)
    assert.strictEqual(deferred.data.lab_no, '106908310001')
    assert.strictEqual(harness.items.get(ids.item).current_status, 'accepted')
    assert.strictEqual(harness.items.get(ids.item2).current_status, 'accepted')
    assert.strictEqual(harness.workItems.get(ids.item).lab_no, '106908310001')
    assert.strictEqual(harness.workItems.get(ids.item2).lab_no, '106908310001')
    assert.strictEqual(harness.outboundRows.size, 1)
    const outbound = harness.outboundRows.get(ids.item)
    const payload = JSON.parse(outbound.request_payload_json)
    assert.strictEqual(outbound.item_count, 2)
    assert.deepStrictEqual(JSON.parse(outbound.source_cpoe_item_ids_json), selectedIds)
    assert.strictEqual(payload.order_no, ids.item)
    assert.strictEqual(payload.labno, '106908310001')
    assert.strictEqual(payload.birth_date, '20200304')
    assert.strictEqual(payload.sex, 'F', 'batch payload must use coded Visit gender 2')
    assert.strictEqual(payload.patient_prefix, 'ด.ช.', 'batch payload must use prefix text, not the stored code')
    assert.deepStrictEqual(payload.items.map(row => row.test_code), ['1087CD', '1088CD'])
    assert.strictEqual(harness.calls().agentCalls, 0)

    const dispatched = await Process.call(
      harness.context,
      { item_id: ids.item, item_ids: selectedIds, dispatch_mode: 'sync' },
      harness.userInfo,
      harness.app
    )
    assert.strictEqual(dispatched.success, true, dispatched.message)
    assert.strictEqual(dispatched.data.agent_send_success, true)
    assert.strictEqual(harness.calls().agentCalls, 1)
    assert.strictEqual(harness.calls().agentPayloads[0].items.length, 2)
    assert.strictEqual(harness.calls().agentPayloads[0].birth_date, '20200304')
    assert.strictEqual(harness.calls().agentPayloads[0].sex, 'F')
    assert.strictEqual(harness.calls().agentPayloads[0].patient_prefix, 'ด.ช.')
    assert.strictEqual(harness.outboundRows.size, 1, 'batch retry must reuse the same Outbound')
  }

  {
    const harness = makeHarness({ workPatch: {} })
    const result = await Process.call(
      harness.context,
      { item_id: ids.item, dispatch_mode: 'invalid' },
      harness.userInfo,
      harness.app
    )
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'invalid_dispatch_mode')
    assert.strictEqual(harness.calls().agentCalls, 0)
    assert.strictEqual(harness.outboundRows.size, 0)
  }

  {
    const harness = makeHarness({
      itemPatch: { current_status: 'completed' },
      workPatch: { work_status: 'received', received_at: '2026-08-31 08:20:00' }
    })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.current_status, 'completed')
    assert.strictEqual(result.data.cpoe_terminal_preserved, true, 'receive must not downgrade completed CPOE Item')
    assert.strictEqual(harness.item.current_status, 'completed')
  }

  {
    const harness = makeHarness({
      workPatch: { work_status: 'received', received_at: '2026-08-31 08:20:00' }
    })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.already_received, true)
    assert.strictEqual(harness.workItems.get(ids.item).visit_id, 'VN0001', 'retry must backfill callback identity')
    assert.strictEqual(harness.workItems.get(ids.item).received_at, '2026-08-31 08:20:00')
  }

  {
    const harness = makeHarness({
      itemPatch: { lab_data: {
        spec_source: 'Clotted blood',
        spec_source_code: 'CD',
        specimen_at: '2026-08-31 08:10:00',
        specimen_by: 'COLLECTOR-1'
      } },
      workPatch: {}
    })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.outbound_readiness, 'ready')
    const outbound = harness.outboundRows.get(ids.item)
    const payload = JSON.parse(outbound.request_payload_json)
    assert.strictEqual(payload.order_no, ids.item)
    assert.strictEqual(payload.items[0].test_code, '1087CD')
    assert.strictEqual(payload.items[0].collected_at, '2026-08-31T08:10:00+07:00')
    assert.strictEqual(outbound.last_error_code, '')
    assert.strictEqual(harness.calls().generatorCalls, 0)
    const contractCheck = await AgentProcess(
      { payload },
      harness.userInfo,
      { isAuth: () => true }
    )
    assert.strictEqual(contractCheck.error, 'not_configured', 'ready snapshot must pass Agent schema validation')
  }

  {
    const harness = makeHarness({ orderPatch: { priority: '1' }, workPatch: {} })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.outbound_readiness, 'ready')
    assert.strictEqual(result.data.missing_fields.includes('priority'), false)
    assert.strictEqual(JSON.parse(harness.outboundRows.get(ids.item).request_payload_json).priority, 'R')
  }

  {
    const harness = makeHarness({ orderPatch: { priority: '' }, workPatch: {} })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, true, 'missing Agent-only data must not roll back specimen receipt')
    assert.strictEqual(result.data.outbound_readiness, 'awaiting_outbound_data')
    assert.strictEqual(result.data.agent_send_success, false)
    assert.strictEqual(result.data.agent_transport_state, 'awaiting_data')
    assert.strictEqual(result.data.transport_deferred, true)
    assert.strictEqual(harness.calls().agentCalls, 0)
    assert.strictEqual(harness.workItems.get(ids.item).work_status, 'received')
  }

  {
    const harness = makeHarness({
      workPatch: {},
      agentResult: {
        success: false,
        error: 'agent_unreachable',
        retryable: true,
        hl7_status: 'new',
        message: 'เชื่อมต่อ Agent ไม่สำเร็จ'
      }
    })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, true, 'Agent failure must not turn a committed receipt into a receive failure')
    assert.strictEqual(result.data.current_status, 'accepted')
    assert.strictEqual(result.data.agent_send_success, false)
    assert.strictEqual(result.data.agent_transport_state, 'failed')
    assert.strictEqual(result.data.agent_retryable, true)
    const outbound = harness.outboundRows.get(ids.item)
    assert.strictEqual(outbound.hl7_status, 'new')
    assert.strictEqual(outbound.attempt_count, 1)
    assert.strictEqual(outbound.last_error_code, 'agent_unreachable')
    assert.strictEqual(outbound.retryable, true)
  }

  {
    const harness = makeHarness({
      workPatch: {},
      agentResult: {
        success: true,
        data: {
          http_status: 200,
          hl7_status: 'queued',
          order_no: ids.item,
          labno: '106908310001',
          duplicate: true,
          dispatch_id: 'DISPATCH-OLD'
        },
        message: 'Agent มี Order นี้แล้ว; ถือว่าส่งสำเร็จ'
      }
    })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.agent_send_success, true)
    assert.strictEqual(result.data.agent_transport_state, 'duplicate')
    assert.strictEqual(result.data.agent_http_status, 200)
    assert.strictEqual(result.data.agent_duplicate, true)
    assert.strictEqual(harness.outboundRows.get(ids.item).hl7_status, 'queued')
  }

  for (const [sourcePriority, expectedPriority] of [['2', 'A'], ['3', 'S'], ['4', 'S'], ['5', 'S'], ['routine', 'R'], ['urgent', 'A'], ['stat', 'S']]) {
    const harness = makeHarness({ orderPatch: { priority: sourcePriority }, workPatch: {} })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.outbound_readiness, 'ready')
    assert.strictEqual(JSON.parse(harness.outboundRows.get(ids.item).request_payload_json).priority, expectedPriority)
  }

  {
    const harness = makeHarness({ workPatch: { work_status: 'resulted' } })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'invalid_status')
  }

  {
    const harness = makeHarness({ cancellation: { cancel_reason: 'แพทย์ยกเลิกคำสั่ง' } })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'order_cancelled')
    assert.strictEqual(harness.calls().generatorCalls, 0)
    assert.strictEqual(harness.workItems.size, 0)
    assert.strictEqual(harness.outboundRows.size, 0)
  }

  {
    const harness = makeHarness({ generatorFailure: true })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'lab_no_failed')
    assert.strictEqual(result.message, 'counter failed')
    assert.strictEqual(harness.outboundRows.size, 0)
  }

  {
    const harness = makeHarness({ generatorEnvelope: false })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, true, 'direct subprocess response must remain supported')
    assert.strictEqual(result.data.lab_no, '106908310001')
  }

  {
    const harness = makeHarness({ workPatch: {}, standalone: true })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, true, 'standalone MongoDB must persist receipt without a transaction')
    assert.strictEqual(harness.workItems.get(ids.item).work_status, 'received')
    assert.strictEqual(harness.outboundRows.size, 1)
  }

  {
    // ตรวจใหม่หลังรอบก่อนเคยส่ง Agent: เก็บ attempt/history เดิม แต่ rebuild payload ด้วย LAB NO. ใหม่
    const harness = makeHarness({
      workPatch: { lab_no: '', work_status: 'waiting_receive', retest_pending_lab_no: true },
    })
    harness.outboundRows.set(ids.item, {
      _id: ids.item,
      xrstatx: 1,
      work_item_id: ids.item,
      source_cpoe_item_id: ids.item,
      order_no: ids.item,
      lab_no: '',
      hl7_status: 'new',
      retest_pending_outbound: true,
      retryable: true,
      attempt_count: 2,
      request_payload_json: '',
      attempt_history_json: JSON.stringify([{ attempt: 1 }, { attempt: 2 }])
    })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, true, result.message)
    const outbound = harness.outboundRows.get(ids.item)
    assert.strictEqual(outbound.lab_no, '106908310001')
    assert.strictEqual(outbound.retest_pending_outbound, false)
    assert.strictEqual(outbound.attempt_count, 3, 'new Agent attempt continues the audit sequence')
    assert.strictEqual(JSON.parse(outbound.request_payload_json).labno, '106908310001')
    assert.strictEqual(JSON.parse(outbound.attempt_history_json).length, 3)
    assert.strictEqual(harness.calls().agentPayloads[0].labno, '106908310001')
  }

  {
    // Runtime regression 2026-09-03: Process `this` may omit mongoTxn.
    // Receipt must retain the existing idempotent standalone behavior.
    const harness = makeHarness({ workPatch: {} })
    const result = await Process.call({}, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, true, 'missing mongoTxn helper must not abort receipt')
    assert.strictEqual(harness.workItems.get(ids.item).work_status, 'received')
    assert.strictEqual(harness.outboundRows.size, 1)
  }

  {
    // ตรวจใหม่ 2026-09-04: มี Work Item เดิมแต่เลขถูกล้างและมี marker
    // Receive ต้องเรียก Generator ใหม่ แล้วจึงเดิน receipt/Outbound เส้นเดิม
    const harness = makeHarness({
      workPatch: { lab_no: '', work_status: 'waiting_receive', retest_pending_lab_no: true },
    })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, true, result.message)
    assert.strictEqual(result.data.lab_no, '106908310001')
    assert.strictEqual(result.data.current_status, 'accepted')
    assert.strictEqual(harness.calls().generatorCalls, 1)
    assert.strictEqual(harness.workItems.get(ids.item).work_status, 'received')
    assert.strictEqual(harness.outboundRows.size, 1)
  }

  {
    // Item-level retest receives against the new Work Item identity. The old
    // rejected attempt and its transport identity must remain untouched.
    const harness = makeHarness()
    const currentWorkId = '999999999999999999999991'
    harness.workItems.set(ids.item, {
      _id: ids.item,
      xrstatx: 1,
      source_specimen_record_id: ids.item,
      source_order_id: ids.order,
      work_status: 'rejected',
      lab_no: '106908300001',
      attempt_no: 1,
      is_current_attempt: false,
    })
    harness.workItems.set(currentWorkId, {
      _id: currentWorkId,
      dataid: currentWorkId,
      xparentx: ids.item,
      xrstatx: 1,
      source_specimen_record_id: ids.item,
      source_order_id: ids.order,
      source_order_number: 'R2608310001',
      work_status: 'waiting_receive',
      lab_no: '106908310099',
      section_code: 'BC',
      section_name: 'Biochemistry',
      attempt_no: 2,
      is_current_attempt: true,
      retest_pending_lab_no: false,
    })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, true, result.message)
    assert.strictEqual(result.data.work_item_id, currentWorkId)
    assert.strictEqual(harness.workItems.get(ids.item).work_status, 'rejected')
    assert.strictEqual(harness.workItems.get(currentWorkId).work_status, 'received')
    assert.strictEqual(harness.outboundRows.size, 1)
    const outbound = harness.outboundRows.get(currentWorkId)
    assert(outbound, 'new attempt must own a new Outbound identity')
    assert.strictEqual(outbound.work_item_id, currentWorkId)
    assert.strictEqual(outbound.order_no, currentWorkId)
    assert.strictEqual(JSON.parse(outbound.request_payload_json).order_no, currentWorkId)
  }

  {
    const harness = makeHarness({ workPatch: {}, standalone: true })
    const [first, second] = await Promise.all([
      Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app),
      Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    ])
    assert.strictEqual(first.success, true)
    assert.strictEqual(second.success, true)
    assert.strictEqual(harness.workItems.get(ids.item).work_status, 'received')
    assert.strictEqual(harness.outboundRows.size, 1, 'concurrent receive must keep one Outbound row')
  }

  assert(apiBody.includes("const OUTBOUND_COLLECTION = 'zdata_lab_outband_order'"))
  assert(apiBody.includes("const AGENT_SUBMIT_PROCESS_ID = '6a9468c7422c1ca959829d6a'"))
  assert(apiBody.indexOf('await dispatchAgent()') > apiBody.indexOf("name: 'receiveLabWorkItemAndQueueOutbound'"), 'Agent dispatch must occur after receipt persistence')
  assert(apiBody.includes("syncCpoeItemStatus(txItemCollection, 'accepted'"))
  assert(apiBody.includes("current_status: targetStatus === 'accepted' ? 'ready'"), 'Receive compare-and-set must require Finance-ready CPOE status')
  console.log('LAB CPOE receive + Agent dispatch API tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
