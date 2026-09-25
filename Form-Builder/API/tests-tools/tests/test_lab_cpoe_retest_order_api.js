const assert = require('assert')
const fs = require('fs')
const path = require('path')

const source = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/lab_cpoe_worklist_api.js'),
  'utf8',
)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const Process = new AsyncFunction('params', 'userInfo', 'app', source)
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value))

const ids = {
  order: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  item1: '111111111111111111111111',
  item2: '222222222222222222222222',
  master1: 'bbbbbbbbbbbbbbbbbbbbbbbb',
  master2: 'cccccccccccccccccccccccc',
}

const userInfo = {
  _id: 'dddddddddddddddddddddddd',
  roles: ['lab'],
  username: 'Earn_admin',
  fullname: 'Earn Admin',
  unit: { code: '10', name: 'Biochemistry' },
  site: { code: 'HIS' },
}

const getPath = (row, dotted) => dotted.split('.').reduce((value, key) => value == null ? undefined : value[key], row)
const equal = (left, right) => String(left) === String(right)
const matches = (row, query) => {
  if (!row) return false
  return Object.entries(query || {}).every(([key, expected]) => {
    if (key === '$or') return expected.some(part => matches(row, part))
    const actual = getPath(row, key)
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('$in' in expected) return expected.$in.some(value => equal(actual, value))
      if ('$nin' in expected) return !expected.$nin.some(value => equal(actual, value))
      if ('$ne' in expected) return !equal(actual, expected.$ne)
    }
    return equal(actual, expected)
  })
}

const mapCollection = rows => {
  const data = new Map(rows.map(row => [String(row._id), clone(row)]))
  let insertSequence = 1
  return {
    data,
    findOne: async query => {
      for (const row of data.values()) if (matches(row, query)) return clone(row)
      return null
    },
    find: query => ({
      toArray: async () => [...data.values()].filter(row => matches(row, query)).map(clone),
    }),
    updateOne: async (query, update) => {
      for (const [key, row] of data.entries()) {
        if (!matches(row, query)) continue
        const next = { ...row, ...clone(update.$set || {}) }
        for (const [field, value] of Object.entries(update.$push || {})) {
          next[field] = Array.isArray(next[field]) ? next[field].slice() : []
          next[field].push(clone(value))
        }
        data.set(key, next)
        return { matchedCount: 1, modifiedCount: 1 }
      }
      return { matchedCount: 0, modifiedCount: 0 }
    },
    insertOne: async doc => {
      const insertedId = doc._id || String(insertSequence++).padStart(24, '9')
      if (data.has(String(insertedId))) throw new Error('duplicate key')
      data.set(String(insertedId), clone({ ...doc, _id: insertedId }))
      return { insertedId }
    },
  }
}

const makeHarness = ({
  itemStatuses = ['rejected', 'cancelled'],
  itemSections = ['BC', 'BC'],
  workItems,
  outboundRows,
  cancellation = true,
} = {}) => {
  const order = {
    _id: ids.order,
    xrstatx: 1,
    order_number: 'R2609040001',
    created_at: '2026-09-04 08:00:00',
    xparentx: 'eeeeeeeeeeeeeeeeeeeeeeee',
    vid: { vn: '6900001', pid: { hn: '6900001' } },
  }
  const items = [
    {
      _id: ids.item1,
      xrstatx: 1,
      current_status: itemStatuses[0],
      service_type: { value: 'lab' },
      order_id: { value: ids.order },
      item_data_id: ids.master1,
      item_code: 'BC001',
      item_name: 'Glucose',
      lab_no: '106909030001',
      received_at: '2026-09-03 09:00:00',
      cancellation_record_id: ids.order,
    },
    {
      _id: ids.item2,
      xrstatx: 1,
      current_status: itemStatuses[1],
      service_type: { value: 'lab' },
      order_id: { value: ids.order },
      item_data_id: ids.master2,
      item_code: 'BC002',
      item_name: 'Creatinine',
      cancellation_record_id: ids.order,
    },
  ]
  const masters = [
    { _id: ids.master1, xrstatx: 1, section: { code: itemSections[0], name: itemSections[0] } },
    { _id: ids.master2, xrstatx: 1, section: { code: itemSections[1], name: itemSections[1] } },
  ]
  const defaultWorkItems = [
    {
      _id: ids.item1,
      xrstatx: 1,
      source_specimen_record_id: ids.item1,
      work_status: 'rejected',
      lab_no: '106909030001',
      received_at: '2026-09-03 09:00:00',
      received_by: 'LAB-OLD',
      rejection_record_id: 'ffffffffffffffffffffffff',
    },
    {
      _id: ids.item2,
      xrstatx: 1,
      source_specimen_record_id: ids.item2,
      work_status: 'cancelled',
      lab_no: '',
      cancellation_record_id: ids.order,
    },
  ]
  const defaultOutboundRows = [{
    _id: ids.item1,
    xrstatx: 1,
    source_cpoe_item_id: ids.item1,
    work_item_id: ids.item1,
    lab_no: '106909030001',
    attempt_count: 0,
    hl7_status: 'cancelled',
    retryable: false,
    request_payload_json: '{"old":true}',
  }]
  const cancellationRows = cancellation ? [{
    _id: ids.order,
    xrstatx: 1,
    source_order_id: ids.order,
    cancel_status: 'applied',
    section_codes: ['BC'],
  }] : []
  const collections = {
    zdata_cpoe_order: mapCollection([order]),
    zdata_cpoe_order_item: mapCollection(items),
    zdata_master_item_order: mapCollection(masters),
    zdata_section: mapCollection([]),
    zdata_lab_work_item: mapCollection(workItems === undefined ? defaultWorkItems : workItems),
    zdata_lab_outband_order: mapCollection(outboundRows === undefined ? defaultOutboundRows : outboundRows),
    zdata_lab_order_cancellation: mapCollection(cancellationRows),
  }
  const originalOrder = clone(order)
  const app = {
    isAuth: () => true,
    dbObjectId: value => String(value),
    curDate: () => '2026-09-04 10:30:00',
    dbFindAll: async provider => {
      assert.strictEqual(provider.from, 'zdata_section')
      return { success: true, reply: { data: [
        { _id: 'SECTION-BC', xrstatx: 1, enable: true, code: 'BC', name: 'Biochemistry' },
      ] } }
    },
    db: { collection: name => collections[name] },
  }
  return { app, collections, originalOrder }
}

const run = (harness, overrides = {}) => Process({
  action: 'retest_order',
  organization_code: '10',
  section_codes: ['BC'],
  order_id: ids.order,
  order_number: 'R2609040001',
  ...overrides,
}, userInfo, harness.app)

const runItem = (harness, overrides = {}) => Process({
  action: 'retest_item',
  organization_code: '10',
  section_codes: ['BC'],
  item_id: ids.item1,
  order_id: ids.order,
  order_number: 'R2609040001',
  retest_reason: 'ปฏิเสธผิดรายการ',
  ...overrides,
}, userInfo, harness.app)

;(async () => {
  {
    const harness = makeHarness()
    const result = await run(harness)
    assert.strictEqual(result.success, true, result.message)
    assert.strictEqual(result.data.reopened_item_count, 2)
    assert.strictEqual(result.data.cleared_lab_no_count, 1)
    assert.strictEqual(result.data.pending_lab_no_count, 2)
    assert.strictEqual(result.data.current_status, 'sent')
    assert.strictEqual(result.data.work_status, 'waiting_receive')

    const item1 = harness.collections.zdata_cpoe_order_item.data.get(ids.item1)
    const item2 = harness.collections.zdata_cpoe_order_item.data.get(ids.item2)
    assert.strictEqual(item1.current_status, 'sent')
    assert.strictEqual(item2.current_status, 'sent')
    assert.strictEqual(item1.lab_no, '')
    assert.strictEqual(item1.received_at, '')
    assert.strictEqual(item1.retest_log[0].from_status, 'rejected')

    const work1 = harness.collections.zdata_lab_work_item.data.get(ids.item1)
    const work2 = harness.collections.zdata_lab_work_item.data.get(ids.item2)
    assert.strictEqual(work1.work_status, 'waiting_receive')
    assert.strictEqual(work2.work_status, 'waiting_receive')
    assert.strictEqual(work1.lab_no, '')
    assert.strictEqual(work2.lab_no, '')
    assert.strictEqual(work1.retest_pending_lab_no, true)
    assert.strictEqual(work2.retest_pending_lab_no, true)
    assert.deepStrictEqual(work1.lab_no_history.map(row => row.lab_no), ['106909030001'])
    assert.strictEqual(work1.received_at, '')
    assert.strictEqual(work1.rejection_record_id, '')

    const outbound = harness.collections.zdata_lab_outband_order.data.get(ids.item1)
    assert.strictEqual(outbound.hl7_status, 'new')
    assert.strictEqual(outbound.lab_no, '')
    assert.strictEqual(outbound.request_payload_json, '', 'Receive will rebuild the payload with its new receipt time')
    assert.strictEqual(outbound.retryable, true)
    assert.strictEqual(outbound.retest_pending_outbound, true)
    assert.strictEqual(outbound.attempt_count, 0)
    assert.strictEqual(outbound.retest_log[0].previous_hl7_status, 'cancelled')

    const cancellation = harness.collections.zdata_lab_order_cancellation.data.get(ids.order)
    assert.strictEqual(cancellation.cancel_status, 'reopened')
    assert.strictEqual(cancellation.reopen_log[0].section_code, 'BC')
    assert.deepStrictEqual(harness.collections.zdata_cpoe_order.data.get(ids.order), harness.originalOrder,
      'CPOE Order header remains read-only')
  }

  {
    const harness = makeHarness({ workItems: [], outboundRows: [] })
    const result = await run(harness)
    assert.strictEqual(result.success, true, result.message)
    assert.strictEqual(result.data.reopened_item_count, 2)
    assert.strictEqual(result.data.pending_lab_no_count, 0,
      'Items without an existing Work Item keep the normal Receive → Lab No. Generator path')
    assert.strictEqual(harness.collections.zdata_cpoe_order_item.data.get(ids.item1).current_status, 'sent')
    assert.strictEqual(harness.collections.zdata_lab_work_item.data.size, 0)
  }

  {
    const harness = makeHarness({
      workItems: [{ _id: ids.item1, xrstatx: 1, source_specimen_record_id: ids.item1, work_status: 'rejected', lab_no: '106909030001' }],
      outboundRows: [{ _id: ids.item1, xrstatx: 1, source_cpoe_item_id: ids.item1, work_item_id: ids.item1, lab_no: '106909030001', attempt_count: 1, hl7_status: 'sent', sent_at: '2026-09-03 09:01:00' }],
    })
    const result = await run(harness)
    assert.strictEqual(result.success, true, result.message)
    const outbound = harness.collections.zdata_lab_outband_order.data.get(ids.item1)
    assert.strictEqual(outbound.hl7_status, 'new')
    assert.strictEqual(outbound.retest_pending_outbound, true)
    assert.strictEqual(outbound.attempt_count, 1, 'history counter from the prior Agent round must be preserved')
    assert.strictEqual(outbound.sent_at, '')
    assert.strictEqual(outbound.retest_log[0].previous_hl7_status, 'sent')
    assert.strictEqual(outbound.retest_log[0].previous_attempt_count, 1)
    assert.strictEqual(harness.collections.zdata_cpoe_order_item.data.get(ids.item1).current_status, 'sent')
  }

  {
    const harness = makeHarness({
      itemStatuses: ['completed', 'completed'],
      workItems: [
        { _id: ids.item1, xrstatx: 1, source_specimen_record_id: ids.item1, work_status: 'cancelled', lab_no: '106909030001' },
        { _id: ids.item2, xrstatx: 1, source_specimen_record_id: ids.item2, work_status: 'cancelled', lab_no: '106909030002' },
      ],
      outboundRows: [],
    })
    const result = await run(harness)
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'nothing_to_retest', 'completed CPOE Items must never be reopened')
  }

  {
    const harness = makeHarness()
    const result = await run(harness, { order_number: 'WRONG' })
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'order_number_mismatch')
  }

  {
    const harness = makeHarness()
    const result = await runItem(harness)
    assert.strictEqual(result.success, true, result.message)
    assert.strictEqual(result.data.item_id, ids.item1)
    assert.strictEqual(result.data.previous_work_item_id, ids.item1)
    assert.strictEqual(result.data.attempt_no, 2)
    assert.strictEqual(result.data.current_status, 'sent')
    assert.notStrictEqual(result.data.work_item_id, ids.item1)

    const previous = harness.collections.zdata_lab_work_item.data.get(ids.item1)
    const reopened = harness.collections.zdata_lab_work_item.data.get(result.data.work_item_id)
    assert.strictEqual(previous.work_status, 'rejected')
    assert.strictEqual(previous.lab_no, '106909030001')
    assert.strictEqual(previous.is_current_attempt, false)
    assert.strictEqual(previous.replaced_by_work_item_id, result.data.work_item_id)
    assert.strictEqual(reopened.work_status, 'waiting_receive')
    assert.strictEqual(reopened.lab_no, '')
    assert.strictEqual(reopened.is_current_attempt, true)
    assert.strictEqual(reopened.retest_pending_lab_no, true)
    assert.strictEqual(reopened.retest_of_work_item_id, ids.item1)
    assert.strictEqual(reopened.source_specimen_record_id, ids.item1)
    assert.strictEqual(harness.collections.zdata_cpoe_order_item.data.get(ids.item1).current_status, 'sent')
    assert.strictEqual(harness.collections.zdata_lab_outband_order.data.get(ids.item1).hl7_status, 'cancelled')
    assert.deepStrictEqual(harness.collections.zdata_cpoe_order.data.get(ids.order), harness.originalOrder)
  }

  {
    const harness = makeHarness({
      workItems: [{ _id: ids.item1, xrstatx: 1, source_specimen_record_id: ids.item1, work_status: 'rejected', lab_no: '106909030001' }],
      outboundRows: [{ _id: ids.item1, xrstatx: 1, work_item_id: ids.item1, order_no: ids.item1, hl7_status: 'sent', attempt_count: 1, sent_at: '2026-09-03 09:01:00' }],
    })
    const result = await runItem(harness)
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'lis_cancel_required')
    assert.strictEqual(harness.collections.zdata_lab_work_item.data.size, 1)
    assert.strictEqual(harness.collections.zdata_cpoe_order_item.data.get(ids.item1).current_status, 'rejected')
  }

  {
    const harness = makeHarness({
      workItems: [{ _id: ids.item1, xrstatx: 1, source_specimen_record_id: ids.item1, work_status: 'rejected', lab_no: '106909030001', resulted_at: '2026-09-03 10:00:00' }],
      outboundRows: [],
    })
    const result = await runItem(harness)
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'result_exists')
  }

  assert(source.includes("action === 'retest_order'"))
  assert(source.includes("action === 'retest_item'"))
  assert(source.includes("work_status: 'waiting_receive'"))
  assert(source.includes("current_status: 'sent'"))
  assert(!source.includes('orderCollection.updateOne'), 'the retest action must not modify the CPOE Order header')
  console.log('LAB CPOE retest_order + retest_item API tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
