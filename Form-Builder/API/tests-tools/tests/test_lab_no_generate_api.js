const assert = require('assert')
const fs = require('fs')
const path = require('path')

const apiBody = fs.readFileSync(path.join(__dirname, '../../api-factory/processes/lab_no_generate_api.js'), 'utf8')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const Process = new AsyncFunction('params', 'userInfo', 'app', apiBody)

const ids = {
  bc1: '111111111111111111111111',
  bc2: '222222222222222222222222',
  hm1: '333333333333333333333333',
  order: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  overflow: '777777777777777777777777'
}
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value))

const makeHarness = ({ date = '2026-08-31', counters = {}, standalone = false, cancelled = false } = {}) => {
  const item = (id, code) => ({
    _id: id,
    xrstatx: 1,
    current_status: 'sent',
    service_type: { value: 'lab' },
    order_id: { value: ids.order },
    item_code: 'TEST-' + id.slice(0, 2),
    item_name: 'Test ' + code,
    item_no: 1,
    section_snapshot: { code, name: code + ' Lab' },
    lab_data: {}
  })
  const items = new Map([
    [ids.bc1, item(ids.bc1, 'BC')],
    [ids.bc2, item(ids.bc2, 'BC')],
    [ids.hm1, item(ids.hm1, 'HM')],
    [ids.overflow, item(ids.overflow, 'BC')]
  ])
  const originalItems = clone(Array.from(items.entries()))
  const workItems = new Map()
  const counterRows = new Map(Object.entries(counters).map(([key, value]) => [key, clone(value)]))
  const cancellation = cancelled
    ? { _id: ids.order, xrstatx: 1, cancel_status: 'applied', cancel_reason: 'แพทย์ยกเลิกคำสั่ง' }
    : null
  const order = {
    _id: ids.order,
    xrstatx: 1,
    order_number: 'R2608310001',
    created_at: date + ' 08:00:00',
    vid: { vn: 'VN0001', pid: { hn: 'HN0001', prename: 'ด.ช.', p_fname: 'ทดสอบ', p_lname: 'ระบบ' }, visit_clinic: 'OPD' }
  }

  const active = row => row && ![0, 3].includes(Number(row.xrstatx))
  const workMatches = (row, query) => {
    if (!active(row)) return false
    if (query._id != null && row._id !== query._id) return false
    if (query.source_specimen_record_id != null && row.source_specimen_record_id !== query.source_specimen_record_id) return false
    if (query.lab_no != null && row.lab_no !== query.lab_no) return false
    if (query.$or && !query.$or.some(part => workMatches(row, { ...part, xrstatx: query.xrstatx }))) return false
    return true
  }
  const workCollection = {
    findOne: async query => {
      for (const row of workItems.values()) if (workMatches(row, query)) return clone(row)
      return null
    },
    insertOne: async doc => {
      if (workItems.has(String(doc._id))) throw new Error('duplicate key')
      workItems.set(String(doc._id), clone(doc))
      return { insertedId: doc._id }
    }
  }
  const counterCollection = {
    findOneAndUpdate: async query => {
      const current = counterRows.get(query._id) || { _id: query._id, sequence: 0 }
      const dailyLimitReached = Number(current.sequence || 0) >= 9999
      const next = { ...current, daily_limit_reached: dailyLimitReached, sequence: dailyLimitReached ? 9999 : Number(current.sequence || 0) + 1 }
      counterRows.set(query._id, next)
      return { value: clone(next) }
    }
  }
  const app = {
    isAuth: () => true,
    curDate: () => date + ' 10:00:00',
    dbObjectId: id => String(id || 'bbbbbbbbbbbbbbbbbbbbbbbb'),
    db: {
      collection: name => ({
        zdata_cpoe_order_item: { findOne: async query => clone(items.get(String(query._id)) || null) },
        zdata_cpoe_order: { findOne: async query => String(query._id) === ids.order ? clone(order) : null },
        zdata_master_item_order: { findOne: async () => null },
        zdata_section: { findOne: async () => null },
        zdata_lab_work_item: workCollection,
        zdata_lab_no_counter: counterCollection,
        zdata_lab_order_cancellation: { findOne: async query => cancellation && String(query._id) === ids.order ? clone(cancellation) : null }
      })[name]
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
    items,
    originalItems,
    workItems,
    counterRows
  }
}

const userAt = code => ({ roles: ['auth'], username: 'lab-test', fullname: 'Lab Tester', unit: { code } })

;(async () => {
  {
    const harness = makeHarness()
    const first = await Process.call(harness.context, { item_id: ids.bc1 }, userAt('10'), harness.app)
    assert.strictEqual(first.success, true)
    assert.strictEqual(first.data.lab_no, '106908310001')
    assert.strictEqual(first.data.work_item_id, ids.bc1)
    assert.strictEqual(first.data.section_code, 'BC')
    assert.strictEqual(first.data.sequence, 1)
    const work = harness.workItems.get(ids.bc1)
    assert.strictEqual(work.lab_no, '106908310001')
    assert.strictEqual(work.work_status, 'waiting_receive')
    assert.strictEqual(work.source_specimen_record_id, ids.bc1)
    assert.strictEqual(work.patient_hn, 'HN0001')
    assert.strictEqual(work.visit_id, 'VN0001')

    const second = await Process.call(harness.context, { item_id: ids.bc2 }, userAt('10'), harness.app)
    assert.strictEqual(second.data.lab_no, '106908310002')

    const repeated = await Process.call(harness.context, { item_id: ids.bc1 }, userAt('10'), harness.app)
    assert.strictEqual(repeated.data.lab_no, '106908310001')
    assert.strictEqual(repeated.data.already_assigned, true)
    assert.strictEqual(harness.counterRows.get('lab_no:BC:2026-08-31').sequence, 2)
    assert.deepStrictEqual(Array.from(harness.items.entries()), harness.originalItems, 'CPOE must remain unchanged')
  }

  {
    const harness = makeHarness({ date: '2026-09-01' })
    const result = await Process.call(harness.context, { item_id: ids.bc1 }, userAt('10'), harness.app)
    assert.strictEqual(result.data.lab_no, '106909010001')
  }

  {
    const harness = makeHarness({ standalone: true })
    const result = await Process.call(harness.context, { item_id: ids.bc1 }, userAt('10'), harness.app)
    assert.strictEqual(result.success, true, 'standalone MongoDB must use the atomic non-transaction fallback')
    assert.strictEqual(result.data.lab_no, '106908310001')
    assert.strictEqual(harness.workItems.get(ids.bc1).work_status, 'waiting_receive')
  }

  {
    const harness = makeHarness({ standalone: true })
    const [first, second] = await Promise.all([
      Process.call(harness.context, { item_id: ids.bc1 }, userAt('10'), harness.app),
      Process.call(harness.context, { item_id: ids.bc1 }, userAt('10'), harness.app)
    ])
    assert.strictEqual(first.success, true)
    assert.strictEqual(second.success, true)
    assert.strictEqual(first.data.lab_no, second.data.lab_no, 'concurrent retry must return the winning LAB NO.')
    assert.strictEqual(harness.workItems.size, 1)
    assert.strictEqual(harness.counterRows.get('lab_no:BC:2026-08-31').sequence, 2, 'unused sequence remains a safe gap')
  }

  {
    const harness = makeHarness({ counters: {
      'lab_no:BC:2026-08-31': { _id: 'lab_no:BC:2026-08-31', sequence: 9999 }
    } })
    const result = await Process.call(harness.context, { item_id: ids.overflow }, userAt('10'), harness.app)
    assert.strictEqual(result.success, false)
    assert(result.message.includes('9999'))
    assert.strictEqual(harness.workItems.size, 0)
  }

  {
    const harness = makeHarness()
    const result = await Process.call(harness.context, { item_id: ids.hm1 }, userAt('10'), harness.app)
    assert.strictEqual(result.success, false)
    assert(result.message.includes('Section'))
  }

  {
    const harness = makeHarness({ cancelled: true })
    const result = await Process.call(harness.context, { item_id: ids.bc1 }, userAt('10'), harness.app)
    assert.strictEqual(result.success, false)
    assert(result.message.includes('ยกเลิก'))
    assert.strictEqual(harness.workItems.size, 0)
    assert.strictEqual(harness.counterRows.size, 0, 'cancelled Order must not consume a LAB NO. counter')
  }

  assert(!apiBody.includes('itemCollection.updateOne'))
  assert(apiBody.includes("const WORK_ITEM_COLLECTION = 'zdata_lab_work_item'"))
  console.log('LAB NO. Work Item generator API tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
