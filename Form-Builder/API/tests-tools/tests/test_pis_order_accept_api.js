/* Regression for R2610060007: Pharmacy must never accept X-ray/LAB Items merely
   because they share the Visit. The deployed process used to update every sent Order. */
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const apiBody = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/pis_order_accept_api.js'),
  'utf8',
)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const Process = new AsyncFunction('params', 'userInfo', 'app', apiBody)

const VISIT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const MED_ORDER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const XRAY_ORDER_ID = 'cccccccccccccccccccccccc'
const MIXED_ORDER_ID = 'dddddddddddddddddddddddd'
const NOW = '2026-10-06 16:00:00'
const userInfo = {
  username: 'pharmacy-user',
  account: { id: 'eeeeeeeeeeeeeeeeeeeeeeee', name: 'Pharmacy User' },
}

const order = (id, number) => ({
  _id: id,
  order_number: number,
  order_to_location: { value: 'm01.p', label: 'ห้องยาพรีเมี่ยม' },
  current_status: 'sent',
})
const item = (orderId, service) => ({
  _id: orderId + '-' + service,
  order_id: { value: orderId },
  service_type: { value: service },
  current_status: 'sent',
  xrstatx: 1,
})

const makeApp = ({ waiting, items }) => {
  const captures = []
  const collections = {
    sdform_manage: {
      findOne: async query => {
        captures.push({ op: 'findOne', collection: 'sdform_manage', query })
        const id = String(query._id)
        return { form_table: id.endsWith('218') ? 'zdata_cpoe_order' : 'zdata_cpoe_order_item' }
      },
    },
    zdata_cpoe_order: {
      find: (query, options) => {
        captures.push({ op: 'find', collection: 'zdata_cpoe_order', query, options })
        return { toArray: async () => waiting }
      },
      findOneAndUpdate: async (filter, update, options) => {
        captures.push({ op: 'findOneAndUpdate', collection: 'zdata_cpoe_order', filter, update, options })
        const row = waiting.find(candidate => String(candidate._id) === String(filter._id))
        return row ? { ...row, current_status: 'accepted' } : null
      },
    },
    zdata_cpoe_order_item: {
      find: (query, options) => {
        captures.push({ op: 'find', collection: 'zdata_cpoe_order_item', query, options })
        return { toArray: async () => items }
      },
      updateMany: async (filter, update) => {
        captures.push({ op: 'updateMany', collection: 'zdata_cpoe_order_item', filter, update })
        const orderIds = filter.$or[0]['order_id.value'].$in.map(String)
        return { modifiedCount: items.filter(row =>
          orderIds.includes(String(row.order_id.value)) &&
          row.service_type.value === filter['service_type.value']
        ).length }
      },
    },
  }
  const app = {
    dbObjectId: id => String(id),
    curDate: () => NOW,
    optCacheInvalidate: async collection => captures.push({ op: 'invalidate', collection }),
    log: { info: message => captures.push({ op: 'log', message }) },
    db: { collection: name => collections[name] },
  }
  return { app, captures }
}

const run = async () => {
  /* One medication Order and one X-ray Order share the Visit: only medication moves. */
  {
    const waiting = [order(MED_ORDER_ID, 'M2610060001'), order(XRAY_ORDER_ID, 'R2610060007')]
    const items = [item(MED_ORDER_ID, 'med'), item(XRAY_ORDER_ID, 'xray')]
    const { app, captures } = makeApp({ waiting, items })
    const out = await Process({ visit_id: VISIT_ID }, userInfo, app)

    assert.strictEqual(out.success, true)
    assert.strictEqual(out.accepted, 1)
    assert.strictEqual(out.item_updated, 1)
    assert.strictEqual(out.skipped_non_med, 1)
    assert.deepStrictEqual(out.orders, [{ order_id: MED_ORDER_ID, order_number: 'M2610060001' }])

    const headerWrites = captures.filter(row => row.op === 'findOneAndUpdate')
    assert.deepStrictEqual(headerWrites.map(row => row.filter._id), [MED_ORDER_ID])
    const itemWrites = captures.filter(row => row.op === 'updateMany')
    assert.strictEqual(itemWrites.length, 1)
    assert.strictEqual(itemWrites[0].filter['service_type.value'], 'med')
    assert(!JSON.stringify(itemWrites).includes(XRAY_ORDER_ID), 'X-ray Order must remain untouched')
  }

  /* A mixed Order is fail-closed: accepting its medication child would leave header/item
     status inconsistent, so the whole Order stays unchanged until CPOE splits it. */
  {
    const waiting = [order(MIXED_ORDER_ID, 'MIXED-1')]
    const items = [item(MIXED_ORDER_ID, 'med'), item(MIXED_ORDER_ID, 'lab')]
    const { app, captures } = makeApp({ waiting, items })
    const out = await Process({ visit_id: VISIT_ID }, userInfo, app)

    assert.strictEqual(out.accepted, 0)
    assert.strictEqual(out.skipped_non_med, 1)
    assert(!captures.some(row => ['findOneAndUpdate', 'updateMany'].includes(row.op)))
  }

  /* No sent header remains idempotent and performs no Item read/write. */
  {
    const { app, captures } = makeApp({ waiting: [], items: [] })
    const out = await Process({ visit_id: VISIT_ID }, userInfo, app)
    assert.strictEqual(out.accepted, 0)
    assert.strictEqual(out.skipped_non_med, 0)
    assert(!captures.some(row => row.collection === 'zdata_cpoe_order_item'))
  }

  console.log('PIS order accept API tests passed')
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
