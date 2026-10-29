const assert = require('assert')
const fs = require('fs')
const path = require('path')

const API_PATH = path.join(
  __dirname,
  '../../api-factory/processes/xray_uat_seed_api.js'
)
const source = fs.readFileSync(API_PATH, 'utf8')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const processApi = new AsyncFunction('params', 'app', 'userInfo', source)

assert(!source.includes('app.axios'), 'UAT seed must never call HTTP/Agent/RIS')
assert(!source.includes('zdata_fa_bill'), 'UAT seed must never create or update finance bills')
assert(!source.includes('zdata_fa_bill_item'), 'UAT seed must never create or update finance bill items')
assert(!source.includes('zdata_fa_receipt'), 'UAT seed must never create or update receipts')
assert(source.includes("const ACCESSION_PROCESS_ID = '6a95cd58422c1ca959829e8d'"), 'must reuse deployed accession process')
assert(source.includes('accession_counter_reused: false'), 'cleanup must explicitly preserve burned accession numbers')

const ORDER_ID = 'aaaaaaaaaaaaaaaaaaaaaaa1'
const ITEM_1 = 'bbbbbbbbbbbbbbbbbbbbbbb1'
const ITEM_2 = 'bbbbbbbbbbbbbbbbbbbbbbb2'
const HN = '6900031'

const clone = value => JSON.parse(JSON.stringify(value))
const get = (object, dotted) => dotted.split('.').reduce((value, key) => value == null ? undefined : value[key], object)
const set = (object, dotted, value) => {
  const keys = dotted.split('.')
  let cursor = object
  keys.slice(0, -1).forEach(key => {
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {}
    cursor = cursor[key]
  })
  cursor[keys[keys.length - 1]] = clone(value)
}
const unset = (object, dotted) => {
  const keys = dotted.split('.')
  let cursor = object
  keys.slice(0, -1).forEach(key => { cursor = cursor && cursor[key] })
  if (cursor) delete cursor[keys[keys.length - 1]]
}
const scalarEqual = (left, right) => String(left) === String(right)
const matches = (document, filter) => Object.entries(filter || {}).every(([key, condition]) => {
  if (key === '$or') return condition.some(branch => matches(document, branch))
  const value = get(document, key)
  if (condition && typeof condition === 'object' && !Array.isArray(condition) && !(condition instanceof RegExp)) {
    if ('$in' in condition && !condition.$in.some(candidate => scalarEqual(value, candidate))) return false
    if ('$nin' in condition && condition.$nin.some(candidate => scalarEqual(value, candidate))) return false
    if ('$exists' in condition && (value !== undefined) !== Boolean(condition.$exists)) return false
    if ('$regex' in condition && !(new RegExp(condition.$regex).test(String(value || '')))) return false
    const operatorKeys = ['$in', '$nin', '$exists', '$regex']
    if (!Object.keys(condition).some(candidate => operatorKeys.includes(candidate))) return scalarEqual(value, condition)
    return true
  }
  if (condition instanceof RegExp) return condition.test(String(value || ''))
  return scalarEqual(value, condition)
})

const makeState = () => ({
  zdata_cpoe_order: [{
    _id: ORDER_ID,
    xrstatx: 1,
    order_number: 'R2610199999',
    vid: { pid: { hn: HN, prename: 'ด.ช.', p_fname: 'ทดสอบ', p_lname: 'ระบบ ไม่ใช่คนจริง' } }
  }],
  zdata_cpoe_order_item: [
    {
      _id: ITEM_1,
      xrstatx: 1,
      order_id: { value: ORDER_ID },
      service_type: { value: 'xray' },
      item_code: 'RD020',
      item_name: 'Skull AP',
      current_status: 'sent',
      updated_at: 'before-1',
      updated_by: 'before-user'
    },
    {
      _id: ITEM_2,
      xrstatx: 1,
      order_id: { value: ORDER_ID },
      service_type: { value: 'xray' },
      item_code: 'RD101',
      item_name: 'Chest PA Upright',
      current_status: 'sent',
      updated_at: 'before-2',
      updated_by: 'before-user'
    }
  ],
  zdata_xray_order: [],
  zdata_xray_result: [],
  zdata_zdata_xray_result_log: [],
  zdata_xray_uat_seed_run: []
})

const makeApp = state => {
  let accessionSequence = 0
  let insertedSequence = 0
  const collection = name => {
    if (!state[name]) state[name] = []
    const rows = state[name]
    return {
      findOne: async filter => rows.find(row => matches(row, filter)) || null,
      find: filter => ({ toArray: async () => rows.filter(row => matches(row, filter)) }),
      updateOne: async (filter, update) => {
        const row = rows.find(candidate => matches(candidate, filter))
        if (!row) return { matchedCount: 0, modifiedCount: 0 }
        Object.entries((update && update.$set) || {}).forEach(([key, value]) => set(row, key, value))
        Object.keys((update && update.$unset) || {}).forEach(key => unset(row, key))
        return { matchedCount: 1, modifiedCount: 1 }
      },
      updateMany: async (filter, update) => {
        const selected = rows.filter(candidate => matches(candidate, filter))
        selected.forEach(row => {
          Object.entries((update && update.$set) || {}).forEach(([key, value]) => set(row, key, value))
          Object.keys((update && update.$unset) || {}).forEach(key => unset(row, key))
        })
        return { matchedCount: selected.length, modifiedCount: selected.length }
      }
    }
  }
  return {
    isAdmin: () => true,
    isSuper: () => false,
    curDate: () => '2026-10-19 12:00:00',
    dbObjectId: value => String(value),
    db: { collection },
    dbInsert: async (record, name) => {
      insertedSequence += 1
      state[name].push(Object.assign({ _id: 'seed' + String(insertedSequence).padStart(20, '0') }, clone(record)))
      return { success: true }
    },
    runProcess: async (processId, params) => {
      assert.strictEqual(processId, '6a95cd58422c1ca959829e8d')
      const item = state.zdata_cpoe_order_item.find(row => row._id === params.item_id)
      assert(item, 'accession target exists')
      assert.strictEqual(item.current_status, 'ready', 'accession may be issued only after finance-ready seed')
      accessionSequence += 1
      const accession = 'SM20261019DX' + String(accessionSequence).padStart(3, '0')
      Object.assign(item, {
        accession_no: accession,
        accession_prefix: 'SM',
        accession_modality_code: 'DX',
        accession_modality_source: 'DX',
        accession_date_key: '20261019',
        accession_sequence: accessionSequence,
        accession_generated_at: '2026-10-19 12:00:00',
        accession_generated_by: 'uat-admin'
      })
      return { reply: { data: { success: true, data: { accession_no: accession, already_assigned: false } } } }
    }
  }
}

const userInfo = { username: 'uat-admin', roles: ['admin'], unit: { code: 'RA-309' } }
const run = (state, params, context) => processApi.call(
  context || { genUUID: () => '00000000-0000-4000-8000-000000000001' },
  params,
  makeApp(state),
  userInfo
)

;(async () => {
  {
    const state = makeState()
    const before = clone(state)
    const result = await run(state, {
      action: 'preview', order_id: ORDER_ID, item_ids: [ITEM_1], expected_hn: 'WRONG', confirm: 'XRAY_UAT_ONLY'
    })
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'hn_mismatch')
    assert.deepStrictEqual(state, before, 'HN mismatch must not write anything')
  }

  {
    const state = makeState()
    const app = makeApp(state)
    const context = { genUUID: () => '00000000-0000-4000-8000-000000000002' }
    const params = {
      action: 'seed_finance', order_id: ORDER_ID, item_ids: [ITEM_1], expected_hn: HN, confirm: 'XRAY_UAT_ONLY'
    }
    const seeded = await processApi.call(context, params, app, userInfo)
    assert.strictEqual(seeded.success, true)
    assert.strictEqual(state.zdata_cpoe_order_item[0].current_status, 'ready')
    assert.strictEqual(seeded.data.finance_record_created, false)
    assert.strictEqual(seeded.data.calls_agent_or_ris, false)
    assert.strictEqual(state.zdata_xray_order.length, 0)

    const cleaned = await processApi.call(context, {
      action: 'cleanup', seed_run_id: seeded.data.seed_run_id, confirm: 'XRAY_UAT_ONLY'
    }, app, userInfo)
    assert.strictEqual(cleaned.success, true)
    assert.strictEqual(state.zdata_cpoe_order_item[0].current_status, 'sent')
    assert.strictEqual(state.zdata_cpoe_order_item[0].uat_finance_seed, undefined)
  }

  {
    const state = makeState()
    const app = makeApp(state)
    const context = { genUUID: () => '00000000-0000-4000-8000-000000000003' }
    const seeded = await processApi.call(context, {
      action: 'seed_manual_result', order_id: ORDER_ID, item_ids: [ITEM_2], expected_hn: HN,
      confirm: 'XRAY_UAT_ONLY'
    }, app, userInfo)
    assert.strictEqual(seeded.success, true)
    assert.strictEqual(state.zdata_cpoe_order_item[1].current_status, 'dispatched')
    assert(state.zdata_cpoe_order_item[1].accession_no)
    assert.strictEqual(state.zdata_cpoe_order_item[1].transport.ris_called, false)
    assert.strictEqual(state.zdata_xray_order.length, 0)
    const accession = state.zdata_cpoe_order_item[1].accession_no

    state.zdata_xray_result.push({
      _id: 'ccccccccccccccccccccccc1', xrstatx: 1, AccessionNo: accession,
      MessageControlId: 'HIS-MANUAL-request-0001', ResultText: 'Normal'
    })
    state.zdata_zdata_xray_result_log.push({
      _id: 'ddddddddddddddddddddddd1', xrstatx: 1, AccessionNo: accession,
      MessageControlId: 'HIS-MANUAL-request-0001', ResultText: 'Normal'
    })

    const cleaned = await processApi.call(context, {
      action: 'cleanup', seed_run_id: seeded.data.seed_run_id, confirm: 'XRAY_UAT_ONLY'
    }, app, userInfo)
    assert.strictEqual(cleaned.success, true)
    assert.strictEqual(state.zdata_cpoe_order_item[1].current_status, 'sent')
    assert.strictEqual(state.zdata_cpoe_order_item[1].accession_no, undefined)
    assert.strictEqual(state.zdata_xray_result[0].xrstatx, 3)
    assert.strictEqual(state.zdata_zdata_xray_result_log[0].xrstatx, 3)
    assert.strictEqual(cleaned.data.accession_counter_reused, false)
  }

  {
    const state = makeState()
    const app = makeApp(state)
    const context = { genUUID: () => '00000000-0000-4000-8000-000000000004' }
    const seeded = await processApi.call(context, {
      action: 'seed_manual_result', order_id: ORDER_ID, item_ids: [ITEM_2], expected_hn: HN,
      confirm: 'XRAY_UAT_ONLY'
    }, app, userInfo)
    const accession = state.zdata_cpoe_order_item[1].accession_no
    state.zdata_xray_order.push({ _id: 'eeeeeeeeeeeeeeeeeeeeeee1', xrstatx: 1, AccessionNo: accession })
    const blocked = await processApi.call(context, {
      action: 'cleanup', seed_run_id: seeded.data.seed_run_id, confirm: 'XRAY_UAT_ONLY'
    }, app, userInfo)
    assert.strictEqual(blocked.success, false)
    assert.strictEqual(blocked.error, 'real_outbound_order_detected')
    assert.strictEqual(state.zdata_cpoe_order_item[1].current_status, 'dispatched')
  }

  console.log('test_xray_uat_seed_api: OK')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
