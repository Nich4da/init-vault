const assert = require('assert')
const fs = require('fs')
const path = require('path')

const apiBody = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/lab_no_generate_api.js'),
  'utf8',
)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const Process = new AsyncFunction('params', 'userInfo', 'app', apiBody)

const ids = {
  bc1: '111111111111111111111111',
  bc2: '222222222222222222222222',
  hm1: '333333333333333333333333',
  bcNextYear: '444444444444444444444444',
  bcWrap: '555555555555555555555555',
}

const clone = value => JSON.parse(JSON.stringify(value))

const makeHarness = ({ year = 2026, counters = {} } = {}) => {
  const items = new Map([
    [ids.bc1, { _id: ids.bc1, xrstatx: 1, current_status: 'sent', service_type: { value: 'lab' }, section_snapshot: { code: 'BC' } }],
    [ids.bc2, { _id: ids.bc2, xrstatx: 1, current_status: 'sent', service_type: { value: 'lab' }, section_snapshot: { code: 'BC' } }],
    [ids.hm1, { _id: ids.hm1, xrstatx: 1, current_status: 'sent', service_type: { value: 'lab' }, section_snapshot: { code: 'HM' } }],
    [ids.bcNextYear, { _id: ids.bcNextYear, xrstatx: 1, current_status: 'sent', service_type: { value: 'lab' }, section_snapshot: { code: 'BC' } }],
    [ids.bcWrap, { _id: ids.bcWrap, xrstatx: 1, current_status: 'sent', service_type: { value: 'lab' }, section_snapshot: { code: 'BC' } }],
  ])
  const counterRows = new Map(Object.entries(counters).map(([key, value]) => [key, clone(value)]))

  const matches = (row, query) => {
    if (!row) return false
    if (query._id && typeof query._id === 'object' && query._id.$ne != null && row._id === query._id.$ne) return false
    if (typeof query._id === 'string' && row._id !== query._id) return false
    if (query.lab_no != null && row.lab_no !== query.lab_no) return false
    if (query.current_status && row.current_status !== query.current_status) return false
    if (query.$or && !query.$or.some(condition => {
      if (condition.lab_no && condition.lab_no.$exists === false) return !Object.prototype.hasOwnProperty.call(row, 'lab_no')
      if (Object.prototype.hasOwnProperty.call(condition, 'lab_no')) return row.lab_no === condition.lab_no
      return false
    })) return false
    return true
  }

  const itemCollection = {
    findOne: async query => {
      if (typeof query._id === 'string') return clone(items.get(query._id) || null)
      for (const row of items.values()) if (matches(row, query)) return clone(row)
      return null
    },
    updateOne: async (query, update) => {
      const row = items.get(query._id)
      if (!matches(row, query)) return { matchedCount: 0, modifiedCount: 0 }
      Object.assign(row, clone(update.$set || {}))
      return { matchedCount: 1, modifiedCount: 1 }
    },
  }

  const counterCollection = {
    findOneAndUpdate: async query => {
      const current = counterRows.get(query._id) || { _id: query._id, sequence: 0 }
      const nextSequence = Number(current.sequence || 0) >= 999999 ? 1 : Number(current.sequence || 0) + 1
      const parts = query._id.split(':')
      const section = parts[1]
      const beYear = Number(parts[2])
      const prefix = { BC: '10', HM: '20' }[section]
      const next = {
        ...current,
        section_code: section,
        section_prefix: prefix,
        buddhist_year: beYear,
        year_two_digits: String(beYear % 100).padStart(2, '0'),
        sequence: nextSequence,
      }
      counterRows.set(query._id, next)
      return { value: clone(next) }
    },
  }

  const emptyCollection = { findOne: async () => null }
  const app = {
    isAuth: () => true,
    curDate: format => format === 'YYYY' ? String(year) : year + '-08-31 10:00:00',
    dbObjectId: id => String(id),
    db: {
      collection: name => ({
        zdata_cpoe_order_item: itemCollection,
        zdata_master_item_order: emptyCollection,
        zdata_section: emptyCollection,
        zdata_lab_no_counter: counterCollection,
      })[name],
    },
  }
  const context = {
    mongoTxn: async fn => fn({ id: 'mock-session' }),
  }
  return { app, context, items, counterRows }
}

const userAt = code => ({ roles: ['auth'], username: 'lab-test', unit: { code } })

;(async () => {
  {
    const harness = makeHarness()
    const first = await Process.call(harness.context, { item_id: ids.bc1 }, userAt('10'), harness.app)
    assert.strictEqual(first.success, true)
    assert.strictEqual(first.data.lab_no, '1069000001')
    assert.strictEqual(first.data.section_code, 'BC')
    assert.strictEqual(first.data.buddhist_year, 2569)
    assert.strictEqual(first.data.sequence, 1)

    const second = await Process.call(harness.context, { item_id: ids.bc2 }, userAt('10'), harness.app)
    assert.strictEqual(second.data.lab_no, '1069000002')

    const repeated = await Process.call(harness.context, { item_id: ids.bc1 }, userAt('10'), harness.app)
    assert.strictEqual(repeated.data.lab_no, '1069000001')
    assert.strictEqual(repeated.data.already_assigned, true)
    assert.strictEqual(harness.counterRows.get('lab_no:BC:2569').sequence, 2)
  }

  {
    const harness = makeHarness()
    const hm = await Process.call(harness.context, { item_id: ids.hm1 }, userAt('20'), harness.app)
    assert.strictEqual(hm.success, true)
    assert.strictEqual(hm.data.lab_no, '2069000001')
    assert.strictEqual(harness.counterRows.get('lab_no:HM:2569').sequence, 1)
  }

  {
    const harness = makeHarness({ year: 2027 })
    const nextYear = await Process.call(harness.context, { item_id: ids.bcNextYear }, userAt('10'), harness.app)
    assert.strictEqual(nextYear.success, true)
    assert.strictEqual(nextYear.data.lab_no, '1070000001')
    assert.strictEqual(harness.counterRows.get('lab_no:BC:2570').sequence, 1)
  }

  {
    const harness = makeHarness({ counters: {
      'lab_no:BC:2569': { _id: 'lab_no:BC:2569', sequence: 999999 },
    } })
    const wrapped = await Process.call(harness.context, { item_id: ids.bcWrap }, userAt('10'), harness.app)
    assert.strictEqual(wrapped.success, true)
    assert.strictEqual(wrapped.data.lab_no, '1069000001')
    assert.strictEqual(wrapped.data.sequence, 1)
  }

  {
    const harness = makeHarness()
    const forbidden = await Process.call(harness.context, { item_id: ids.hm1 }, userAt('10'), harness.app)
    assert.strictEqual(forbidden.success, false)
    assert(forbidden.message.includes('Section'))
  }

  console.log('LAB NO. generator API tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
