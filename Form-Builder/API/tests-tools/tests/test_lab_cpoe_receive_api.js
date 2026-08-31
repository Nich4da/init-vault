const assert = require('assert')
const fs = require('fs')
const path = require('path')

const apiBody = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/lab_cpoe_receive_api.js'),
  'utf8',
)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const Process = new AsyncFunction('params', 'userInfo', 'app', apiBody)
const senderBody = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/lab_agent_order_submit_api.js'),
  'utf8',
)
  .replace(
    /const AGENT_ORDER_URL\s*=\s*['"][^'"]*['"]/,
    "const AGENT_ORDER_URL = 'http://agent.test:8080/api/orders'",
  )
  .replace(
    /const AGENT_KEY\s*=\s*['"][^'"]*['"]/,
    "const AGENT_KEY = 'test-only-key'",
  )
const SenderProcess = new AsyncFunction('params', 'userInfo', 'app', senderBody)

const ids = {
  item: '111111111111111111111111',
  sibling: '222222222222222222222222',
  order: '333333333333333333333333',
  master: '444444444444444444444444',
}

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value))

const makeHarness = ({
  itemPatch = {},
  sibling = null,
  senderResult = null,
  masterPatch = {},
  orderPatch = {},
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
    lab_data: {
      spec_source: 'Plasma',
      spec_source_code: 'PLASMA',
      specimen_at: '2026-08-31 08:10:00',
      specimen_by: { value: '120164', label: 'Collector One' },
    },
    ...clone(itemPatch),
  }
  const items = new Map([[ids.item, item]])
  if (sibling) items.set(ids.sibling, {
    _id: ids.sibling,
    xrstatx: 1,
    current_status: 'accepted',
    service_type: { value: 'lab' },
    order_id: { value: ids.order },
    ...clone(sibling),
  })

  const order = {
    _id: ids.order,
    xrstatx: 1,
    order_number: 'R2608310001',
    current_status: 'sent',
    priority: '3',
    created_at: '2026-08-31 08:00:00',
    status_stage: [{ stage_status: 'sent', stage_at: '2026-08-31 08:05:00' }],
    cosign_user: { value: 'doctor-id', label: 'พญ. แพทย์ ทดสอบ' },
    vid: {
      vn: 'VN69000001',
      visit_type: { value: 'OPD', label: 'ผู้ป่วยนอก' },
      visit_clinic: { value: 'CL01', code: 'CL01', label: 'คลินิกทดสอบ' },
      pid: {
        hn: '69000001',
        prename: { value: 'MR', label: 'นาย' },
        p_fname: 'สมชาย',
        p_lname: 'ทดสอบ',
        birth_date: '2000-01-02',
        gender_text: 'ชาย',
      },
    },
    ...clone(orderPatch),
  }
  const master = {
    _id: ids.master,
    xrstatx: 1,
    item_name: 'Glucose',
    section: { code: 'BC', name: 'Biochemistry' },
    lab_item: { his_lab_code: 'BC001', c_test: 'GLU', seq: 1 },
    ...clone(masterPatch),
  }

  const matchesItem = (row, query) => {
    if (!row) return false
    if (typeof query._id === 'string' && row._id !== query._id) return false
    if (query._id && query._id.$ne != null && row._id === query._id.$ne) return false
    if (query.current_status && row.current_status !== query.current_status) return false
    if (query.lab_no != null && row.lab_no !== query.lab_no) return false
    if (query.hl7_status != null && row.hl7_status !== query.hl7_status) return false
    if (query.$or) {
      const any = query.$or.some(condition => {
        if (condition['order_id.value'] != null) return row.order_id && row.order_id.value === condition['order_id.value']
        if (condition.xparentx != null) return row.xparentx === condition.xparentx
        return false
      })
      if (!any) return false
    }
    return true
  }

  const itemCollection = {
    findOne: async query => {
      for (const row of items.values()) if (matchesItem(row, query)) return clone(row)
      return null
    },
    updateOne: async (query, update) => {
      const row = items.get(query._id)
      if (!matchesItem(row, query)) return { matchedCount: 0, modifiedCount: 0 }
      Object.assign(row, clone(update.$set || {}))
      if (update.$push) {
        for (const [key, pushed] of Object.entries(update.$push)) {
          if (!Array.isArray(row[key])) row[key] = []
          row[key].push(clone(pushed))
        }
      }
      return { matchedCount: 1, modifiedCount: 1 }
    },
  }

  let generatorCalls = 0
  let senderCalls = 0
  let sentPayload = null
  const app = {
    isAuth: () => true,
    curDate: () => '2026-08-31 08:20:00',
    dbObjectId: value => String(value),
    db: {
      collection: name => ({
        zdata_cpoe_order_item: itemCollection,
        zdata_cpoe_order: { findOne: async query => query._id === ids.order ? clone(order) : null },
        zdata_master_item_order: { findOne: async query => query._id === ids.master ? clone(master) : null },
        zdata_section: { findOne: async () => null },
      })[name],
    },
    subProcess: async (processId, params) => {
      if (processId === '6a94f1ed422c1ca959829d6e') {
        generatorCalls += 1
        const row = items.get(params.item_id)
        if (!row.lab_no) row.lab_no = '1069000001'
        return { success: true, data: { item_id: params.item_id, lab_no: row.lab_no, section_code: 'BC' } }
      }
      if (processId === '6a9468c7422c1ca959829d6a') {
        senderCalls += 1
        sentPayload = clone(params.payload)
        return senderResult || {
          success: true,
          data: {
            http_status: 202,
            hl7_status: 'queued',
            order_no: params.payload.order_no,
            labno: params.payload.labno,
            duplicate: false,
            order_ref: 'agent-order-ref',
            routed_to: ['mlab'],
            dispatch_id: 'dispatch-001',
          },
        }
      }
      throw new Error('unexpected subprocess ' + processId)
    },
  }
  const context = { mongoTxn: async fn => fn({ id: 'mock-session' }) }
  const userInfo = {
    roles: ['lab'],
    username: '120170',
    fullname: 'Receiver One',
    unit: { code: 'M1001' },
  }
  return {
    app,
    context,
    userInfo,
    item,
    calls: () => ({ generatorCalls, senderCalls, sentPayload }),
  }
}

;(async () => {
  {
    const harness = makeHarness()
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    const calls = harness.calls()
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.current_status, 'accepted')
    assert.strictEqual(result.data.hl7_status, 'queued')
    assert.strictEqual(result.data.lab_no, '1069000001')
    assert.strictEqual(result.data.collected_at_source, 'specimen_at')
    assert.strictEqual(harness.item.current_status, 'accepted')
    assert.strictEqual(harness.item.received_at, '2026-08-31 08:20:00')
    assert.strictEqual(harness.item.received_by, '120170')
    assert.strictEqual(harness.item.agent_collected_at_source, 'specimen_at')
    assert.strictEqual(harness.item.hl7_status, 'queued')
    assert.strictEqual(harness.item.agent_dispatch_id, 'dispatch-001')
    assert.strictEqual(calls.generatorCalls, 1)
    assert.strictEqual(calls.senderCalls, 1)
    assert.deepStrictEqual(calls.sentPayload, {
      order_no: 'R2608310001',
      labno: '1069000001',
      hn: '69000001',
      ordered_at: '20260831080500',
      priority: 'S',
      items: [{
        seq: 1,
        test_code: 'BC001',
        test_name: 'Glucose',
        specimen_code: 'PLASMA',
        collected_at: '20260831081000',
        received_at: '20260831082000',
        receiver: '120170',
        specimen_name: 'Plasma',
        collector_code: '120164',
        collector_name: 'Collector One',
        lab_code: 'BC',
      }],
      visit_id: 'VN69000001',
      requested_at: '20260831080000',
      patient_prefix: 'นาย',
      patient_first_name: 'สมชาย',
      patient_last_name: 'ทดสอบ',
      birth_date: '20000102',
      sex: 'ชาย',
      visit_type: 'ผู้ป่วยนอก',
      doctor_name: 'พญ. แพทย์ ทดสอบ',
      clinic_code: 'CL01',
      clinic_name: 'คลินิกทดสอบ',
      mongo_data_id: ids.item,
    })

    // The exact payload produced by Receive must also pass the real sender's
    // contract validator before its mocked network boundary is reached.
    let senderNetworkCalls = 0
    const senderValidation = await SenderProcess(
      { payload: calls.sentPayload },
      harness.userInfo,
      {
        isAuth: () => true,
        axios: {
          post: async (url, payload) => {
            senderNetworkCalls += 1
            return {
              status: 202,
              data: {
                ok: true,
                order_no: payload.order_no,
                order_ref: 'validated-order-ref',
                duplicate: false,
                routed_to: ['BC'],
                dispatch_id: 'validated-dispatch',
              },
            }
          },
        },
      },
    )
    assert.strictEqual(senderValidation.success, true)
    assert.strictEqual(senderValidation.data.hl7_status, 'queued')
    assert.strictEqual(senderNetworkCalls, 1)
  }

  {
    const harness = makeHarness({
      senderResult: {
        success: false,
        error: 'agent_unreachable',
        retryable: true,
        hl7_status: 'new',
        message: 'Agent unavailable',
      },
    })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.received, true)
    assert.strictEqual(result.retryable, true)
    assert.strictEqual(harness.item.current_status, 'accepted')
    assert.strictEqual(harness.item.hl7_status, 'new')
    assert.strictEqual(harness.item.agent_transport_state, 'failed')
  }

  {
    const harness = makeHarness({
      itemPatch: { lab_data: { spec_source: 'Plasma' } },
      orderPatch: { priority: '' },
    })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    const calls = harness.calls()
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.received, true)
    assert.strictEqual(result.data.current_status, 'accepted')
    assert.strictEqual(result.data.hl7_status, 'new')
    assert.strictEqual(result.data.collected_at_source, '')
    assert.strictEqual(result.data.collection_time_pending, true)
    assert.strictEqual(result.data.agent_transport_state, 'awaiting_collection')
    assert(result.data.agent_missing_fields.includes('order.priority'))
    assert(result.data.agent_missing_fields.includes('item.lab_data.spec_source_code'))
    assert(result.data.agent_missing_fields.includes('item.lab_data.specimen_at'))
    assert.strictEqual(harness.item.current_status, 'accepted')
    assert.strictEqual(harness.item.agent_collected_at_source, '')
    assert.strictEqual(harness.item.agent_transport_state, 'awaiting_collection')
    assert.strictEqual(harness.item.agent_error, 'collection_time_pending')
    assert(harness.item.agent_missing_fields.includes('order.priority'))
    assert.strictEqual(calls.generatorCalls, 1)
    assert.strictEqual(calls.senderCalls, 0)
    assert.strictEqual(calls.sentPayload, null)
  }

  {
    const harness = makeHarness({ itemPatch: { current_status: 'accepted', lab_no: '1069000001', hl7_status: 'queued' } })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.already_submitted, true)
    assert.strictEqual(harness.calls().generatorCalls, 0)
    assert.strictEqual(harness.calls().senderCalls, 0)
  }

  {
    const harness = makeHarness({ sibling: { hl7_status: 'queued' } })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.received, true)
    assert.strictEqual(result.data.agent_transport_state, 'awaiting_agent_append')
    assert.strictEqual(harness.item.current_status, 'accepted')
    assert.strictEqual(harness.item.agent_error, 'agent_order_dedupe_conflict')
    assert.strictEqual(harness.calls().generatorCalls, 1)
    assert.strictEqual(harness.calls().senderCalls, 0)
  }

  {
    const harness = makeHarness({ masterPatch: { lab_item: { c_test: 'GLU', seq: 1 } } })
    const result = await Process.call(harness.context, { item_id: ids.item }, harness.userInfo, harness.app)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.received, true)
    assert.strictEqual(result.data.agent_transport_state, 'awaiting_outbound_data')
    assert(result.data.agent_missing_fields.includes('master.lab_item.his_lab_code'))
    assert.strictEqual(harness.item.current_status, 'accepted')
    assert.strictEqual(harness.item.agent_transport_state, 'awaiting_outbound_data')
    assert.strictEqual(harness.calls().generatorCalls, 1)
    assert.strictEqual(harness.calls().senderCalls, 0)
  }

  console.log('LAB CPOE receive API tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
