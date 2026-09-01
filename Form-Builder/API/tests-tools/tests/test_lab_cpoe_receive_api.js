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
  order: '333333333333333333333333',
  master: '444444444444444444444444'
}
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value))

const makeHarness = ({
  itemPatch = {},
  orderPatch = {},
  workPatch = null,
  generatorFailure = false,
  generatorEnvelope = true,
  standalone = false,
  cancellation = null
} = {}) => {
  const item = {
    _id: ids.item,
    xrstatx: 1,
    current_status: 'sent',
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
  const order = {
    _id: ids.order,
    xrstatx: 1,
    order_number: 'R2608310001',
    priority: 'R',
    created_at: '2026-08-31 08:00:00',
    status_stage: [{ stage_status: 'sent', stage_at: '2026-08-31 08:05:00' }],
    vid: {
      vn: 'VN0001',
      pid: { hn: 'HN0001', prename: 'ด.ช.', p_fname: 'ทดสอบ', p_lname: 'ระบบ', birth_date: '2020-01-02' },
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
    if (query.work_status != null && row.work_status !== query.work_status) return false
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
  let generatorCalls = 0
  let unexpectedSubprocessCalls = 0
  const app = {
    isAuth: () => true,
    curDate: () => currentNow,
    dbObjectId: value => String(value),
    db: {
      collection: name => ({
        zdata_cpoe_order_item: { findOne: async query => String(query._id) === ids.item ? clone(item) : null },
        zdata_cpoe_order: { findOne: async query => String(query._id) === ids.order ? clone(order) : null },
        zdata_master_item_order: { findOne: async query => String(query._id) === ids.master ? clone(master) : null },
        zdata_lab_work_item: workCollection,
        zdata_lab_outband_order: outboundCollection,
        zdata_lab_order_cancellation: cancellationCollection
      })[name]
    },
    subProcess: async (processId, processParams) => {
      if (processId !== '6a94f1ed422c1ca959829d6e') {
        unexpectedSubprocessCalls += 1
        throw new Error('unexpected subprocess ' + processId)
      }
      generatorCalls += 1
      const wrapGeneratorResult = result => generatorEnvelope
        ? { success: true, message: 'API run success', data: result, error: '' }
        : result
      if (generatorFailure) return wrapGeneratorResult({ success: false, message: 'counter failed' })
      workItems.set(ids.item, {
        _id: ids.item,
        xrstatx: 1,
        source_specimen_record_id: processParams.item_id,
        source_order_id: ids.order,
        source_order_number: order.order_number,
        lab_no: '106908310001',
        section_code: 'BC',
        section_name: 'Biochemistry',
        work_status: 'waiting_receive',
        patient_hn: 'HN0001',
        patient_name: 'ด.ช. ทดสอบ ระบบ'
      })
      return wrapGeneratorResult({
        success: true,
        data: { item_id: ids.item, work_item_id: ids.item, lab_no: '106908310001' }
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
    originalItem,
    workItems,
    outboundRows,
    cancellations,
    setNow: value => { currentNow = value },
    calls: () => ({ generatorCalls, unexpectedSubprocessCalls })
  }
}

;(async () => {
  {
    const harness = makeHarness()
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.current_status, 'accepted')
    assert.strictEqual(result.data.work_status, 'received')
    assert.strictEqual(result.data.lab_no, '106908310001')
    assert.strictEqual(result.data.outbound_readiness, 'ready')
    assert.deepStrictEqual(harness.item, harness.originalItem, 'CPOE must remain unchanged')
    assert.strictEqual(harness.workItems.get(ids.item).work_status, 'received')
    assert.strictEqual(harness.workItems.get(ids.item).visit_id, 'VN0001')
    assert.strictEqual(harness.outboundRows.size, 1)
    const outbound = harness.outboundRows.get(ids.item)
    assert.strictEqual(outbound.hl7_status, 'new')
    assert.strictEqual(outbound.work_item_id, ids.item)
    assert.strictEqual(outbound.source_cpoe_item_id, ids.item)
    assert.strictEqual(outbound.last_error_code, '')
    const noCollectionPayload = JSON.parse(outbound.request_payload_json)
    assert.strictEqual(noCollectionPayload.labno, '106908310001')
    assert.strictEqual(noCollectionPayload.items[0].received_at, '2026-08-31T08:20:00+07:00')
    assert.strictEqual(Object.prototype.hasOwnProperty.call(noCollectionPayload.items[0], 'collected_at'), false)
    const noCollectionContract = await AgentProcess(
      { payload: noCollectionPayload },
      harness.userInfo,
      { isAuth: () => true }
    )
    assert.strictEqual(noCollectionContract.error, 'not_configured', 'collected_at must be optional for Agent dispatch')
    assert.strictEqual(harness.calls().generatorCalls, 1)
    assert.strictEqual(harness.calls().unexpectedSubprocessCalls, 0)

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
  assert(!apiBody.includes('AGENT_SUBMIT_PROCESS_ID'))
  assert(!apiBody.includes('itemCollection.updateOne'))
  console.log('LAB CPOE receive persistence API tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
