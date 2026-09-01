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
  return {
    data,
    findOne: async query => {
      for (const row of data.values()) if (matches(row, query)) return clone(row)
      return null
    },
    find: query => ({
      toArray: async () => [...data.values()].filter(row => matches(row, query)).map(clone),
    }),
    insertOne: async doc => {
      const key = String(doc._id)
      if (data.has(key)) throw new Error('duplicate key')
      data.set(key, clone(doc))
      return { insertedId: doc._id }
    },
    updateOne: async (query, update) => {
      for (const [key, row] of data.entries()) {
        if (!matches(row, query)) continue
        data.set(key, { ...row, ...clone(update.$set || {}) })
        return { matchedCount: 1, modifiedCount: 1 }
      }
      return { matchedCount: 0, modifiedCount: 0 }
    },
  }
}

const makeHarness = ({
  itemStatuses = ['sent', 'sent'],
  itemSections = ['BC', 'BC'],
  workItems = [],
  outboundRows = [],
  outboundRace = false,
} = {}) => {
  const order = {
    _id: ids.order,
    xrstatx: 1,
    order_number: 'R2609010001',
    created_at: '2026-09-01 09:00:00',
    xparentx: 'eeeeeeeeeeeeeeeeeeeeeeee',
    vid: {
      vn: '6900001',
      visit_clinic: 'OPD',
      pid: { hn: '6900001', prename: 'น.ส.', p_fname: 'ทดสอบ', p_lname: 'ระบบ' },
    },
  }
  const items = [
    {
      _id: ids.item1,
      xrstatx: 1,
      current_status: itemStatuses[0],
      service_type: { value: 'lab' },
      order_id: { value: ids.order },
      item_data_id: ids.master1,
      item_no: 1,
      item_code: 'BC001',
      item_name: 'Glucose',
      lab_data: { spec_source_code: 'CD', spec_source: 'Clotted blood' },
    },
    {
      _id: ids.item2,
      xrstatx: 1,
      current_status: itemStatuses[1],
      service_type: { value: 'lab' },
      order_id: { value: ids.order },
      item_data_id: ids.master2,
      item_no: 2,
      item_code: 'BC002',
      item_name: 'Creatinine',
      lab_data: { spec_source_code: 'CD', spec_source: 'Clotted blood' },
    },
  ]
  const masters = [
    { _id: ids.master1, xrstatx: 1, item_name: 'Glucose', section: { code: itemSections[0], name: itemSections[0] }, lab_item: { his_lab_code: 'BC001' } },
    { _id: ids.master2, xrstatx: 1, item_name: 'Creatinine', section: { code: itemSections[1], name: itemSections[1] }, lab_item: { his_lab_code: 'BC002' } },
  ]
  const collections = {
    zdata_cpoe_order: mapCollection([order]),
    zdata_cpoe_order_item: mapCollection(items),
    zdata_master_item_order: mapCollection(masters),
    zdata_section: mapCollection([]),
    zdata_lab_work_item: mapCollection(workItems.map(row => ({ xrstatx: 1, ...row }))),
    zdata_lab_outband_order: mapCollection(outboundRows.map(row => ({ xrstatx: 1, ...row }))),
    zdata_lab_order_cancellation: mapCollection([]),
  }
  if (outboundRace) {
    const originalUpdate = collections.zdata_lab_outband_order.updateOne
    let raced = false
    collections.zdata_lab_outband_order.updateOne = async (query, update) => {
      if (!raced) {
        raced = true
        const row = collections.zdata_lab_outband_order.data.get(ids.item1)
        collections.zdata_lab_outband_order.data.set(ids.item1, {
          ...row,
          attempt_count: 1,
          hl7_status: 'sent',
          sent_at: '2026-09-01 12:59:59',
        })
      }
      return originalUpdate(query, update)
    }
  }
  const originalOrder = clone(order)
  const originalItems = clone(items)
  const app = {
    isAuth: () => true,
    dbObjectId: value => String(value),
    curDate: () => '2026-09-01 13:00:00',
    dbFindAll: async provider => {
      assert.strictEqual(provider.from, 'zdata_section')
      return {
        success: true,
        reply: { data: [{ _id: 'SECTION-BC', xrstatx: 1, enable: true, code: 'BC', name: 'Biochemistry' }] },
      }
    },
    db: { collection: name => collections[name] },
  }
  return { app, collections, order, items, originalOrder, originalItems }
}

const run = (harness, overrides = {}) => Process({
  action: 'cancel_order',
  organization_code: '10',
  order_id: ids.order,
  order_number: 'R2609010001',
  cancel_reason: 'แพทย์ยกเลิกการตรวจทั้ง Order',
  ...overrides,
}, userInfo, harness.app)

;(async () => {
  {
    const harness = makeHarness()
    const result = await run(harness)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.cancelled_item_count, 2)
    assert.strictEqual(result.data.preserved_terminal_item_count, 0)
    assert.strictEqual(result.data.cpoe_unchanged, true)
    assert.strictEqual(harness.collections.zdata_lab_order_cancellation.data.size, 1)
    const cancellation = harness.collections.zdata_lab_order_cancellation.data.get(ids.order)
    assert.strictEqual(cancellation.cancel_status, 'applied')
    assert.strictEqual(cancellation.cancel_type, 'lab_order_cancelled')
    assert.strictEqual(cancellation.cancel_reason, 'แพทย์ยกเลิกการตรวจทั้ง Order')
    assert.deepStrictEqual(cancellation.item_ids, [ids.item1, ids.item2])
    assert.strictEqual(harness.collections.zdata_lab_work_item.data.get(ids.item1).work_status, 'cancelled')
    assert.strictEqual(harness.collections.zdata_lab_work_item.data.get(ids.item2).work_status, 'cancelled')
    assert.deepStrictEqual(harness.order, harness.originalOrder, 'CPOE Order must remain read-only')
    assert.deepStrictEqual(harness.items, harness.originalItems, 'CPOE Items must remain read-only')

    const retry = await run(harness, { cancel_reason: 'เหตุผลใหม่ต้องไม่ทับ audit เดิม' })
    assert.strictEqual(retry.success, true)
    assert.strictEqual(retry.data.already_cancelled, true)
    assert.strictEqual(retry.data.cancel_reason, 'แพทย์ยกเลิกการตรวจทั้ง Order')
    assert.strictEqual(harness.collections.zdata_lab_order_cancellation.data.size, 1)
    assert.strictEqual(harness.collections.zdata_lab_work_item.data.size, 2)
  }

  {
    const harness = makeHarness({
      workItems: [{ _id: ids.item1, source_specimen_record_id: ids.item1, work_status: 'rejected' }],
    })
    const result = await run(harness)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.cancelled_item_count, 1)
    assert.strictEqual(result.data.preserved_terminal_item_count, 1)
    assert.strictEqual(harness.collections.zdata_lab_work_item.data.get(ids.item1).work_status, 'rejected')
    assert.strictEqual(harness.collections.zdata_lab_work_item.data.get(ids.item2).work_status, 'cancelled')
  }

  {
    const harness = makeHarness({
      workItems: [
        { _id: ids.item1, source_specimen_record_id: ids.item1, work_status: 'received', lab_no: '106909010001' },
        { _id: ids.item2, source_specimen_record_id: ids.item2, work_status: 'waiting_receive', lab_no: '' },
      ],
      outboundRows: [{ _id: ids.item1, work_item_id: ids.item1, attempt_count: 0, hl7_status: 'new' }],
    })
    const result = await run(harness)
    assert.strictEqual(result.success, true)
    assert.strictEqual(harness.collections.zdata_lab_work_item.data.get(ids.item1).work_status, 'cancelled')
    assert.strictEqual(harness.collections.zdata_lab_outband_order.data.get(ids.item1).hl7_status, 'cancelled')
    assert.strictEqual(harness.collections.zdata_lab_outband_order.data.get(ids.item1).retryable, false)
  }

  {
    const harness = makeHarness({
      workItems: [{ _id: ids.item1, source_specimen_record_id: ids.item1, work_status: 'received', lab_no: '106909010001' }],
      outboundRows: [{ _id: ids.item1, work_item_id: ids.item1, attempt_count: 1, hl7_status: 'sent', sent_at: '2026-09-01 12:00:00' }],
    })
    const result = await run(harness)
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'lis_cancel_required')
    assert.strictEqual(harness.collections.zdata_lab_order_cancellation.data.size, 0)
    assert.strictEqual(harness.collections.zdata_lab_work_item.data.get(ids.item1).work_status, 'received')
  }

  {
    const harness = makeHarness({
      workItems: [{ _id: ids.item1, source_specimen_record_id: ids.item1, work_status: 'received', lab_no: '106909010001' }],
      outboundRows: [{ _id: ids.item1, work_item_id: ids.item1, attempt_count: 0, hl7_status: 'new' }],
      outboundRace: true,
    })
    const result = await run(harness)
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'cancel_race_lost')
    assert.strictEqual(harness.collections.zdata_lab_order_cancellation.data.get(ids.order).cancel_status, 'conflict')
    assert.strictEqual(harness.collections.zdata_lab_work_item.data.get(ids.item1).work_status, 'received')
  }

  {
    const harness = makeHarness({
      workItems: [{ _id: ids.item1, source_specimen_record_id: ids.item1, work_status: 'resulted' }],
    })
    const result = await run(harness)
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'item_not_cancellable')
    assert.strictEqual(harness.collections.zdata_lab_order_cancellation.data.size, 0)
  }

  {
    const harness = makeHarness({ itemSections: ['BC', 'HM'] })
    const result = await run(harness)
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'section_forbidden')
    assert.strictEqual(harness.collections.zdata_lab_order_cancellation.data.size, 0)
  }

  {
    const harness = makeHarness()
    const result = await run(harness, { cancel_reason: '   ' })
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'cancel_reason_missing')
    assert.strictEqual(harness.collections.zdata_lab_order_cancellation.data.size, 0)
  }

  assert(source.includes("const ORDER_CANCELLATION_COLLECTION = 'zdata_lab_order_cancellation'"))
  assert(!source.includes('orderCollection.updateOne'), 'CPOE Order must remain read-only')
  assert(!source.includes('itemCollection.updateOne'), 'CPOE Items must remain read-only')
  console.log('LAB CPOE cancel Order API tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
