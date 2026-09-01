const assert = require('assert')
const fs = require('fs')
const path = require('path')

const source = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/Lab_Reject_Specimen.js'),
  'utf8',
)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const Process = new AsyncFunction('params', 'userInfo', 'app', source)
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value))

const ids = {
  item: '111111111111111111111111',
  order: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  master: 'bbbbbbbbbbbbbbbbbbbbbbbb',
  rejection: 'cccccccccccccccccccccccc',
}

const userInfo = {
  _id: 'dddddddddddddddddddddddd',
  roles: ['lab'],
  username: 'Earn_admin',
  fullname: 'Earn Admin',
  unit: { code: '10' },
  site: { code: 'HIS' },
}

const makeHarness = ({
  itemStatus = 'sent',
  itemPatch = {},
  sectionCode = 'BC',
  workItem = null,
  outbound = null,
  cancellation = null,
  rejection = null,
  auditFails = false,
  insertRace = null,
} = {}) => {
  const item = {
    _id: ids.item,
    xrstatx: 1,
    current_status: itemStatus,
    service_type: { value: 'lab' },
    order_id: { value: ids.order },
    item_data_id: ids.master,
    item_no: 1,
    item_code: '1034CD',
    item_name: 'Gamma GT',
    lab_data: { spec_source_code: 'CD', spec_source: 'Clotted blood' },
    ...clone(itemPatch),
  }
  const order = {
    _id: ids.order,
    xrstatx: 1,
    order_number: 'R2608310004',
    created_at: '2026-08-31 18:44:02',
    xparentx: 'eeeeeeeeeeeeeeeeeeeeeeee',
    vid: {
      vn: '6900206',
      visit_clinic: '19.p คลินิกวัคซีน',
      pid: { hn: '6900001', prename: 'น.ส.', p_fname: 'ดำ', p_lname: 'ใจดี' },
    },
  }
  const master = {
    _id: ids.master,
    xrstatx: 1,
    item_name: 'Gamma GT',
    section: { code: sectionCode, name: sectionCode + ' Lab' },
    lab_item: { his_lab_code: '1034CD', specimen: { code: 'CD', name: 'Clotted blood' } },
  }
  const rejectionRow = rejection || {
    _id: ids.rejection,
    xrstatx: 1,
    source_order_id: ids.item,
    order_group_id: order.order_number,
    lab_section: sectionCode,
    reject_reason_code: 'specimen_insufficient',
    reject_reason_detail: 'ปริมาณไม่พอสำหรับตรวจ',
    rejection_status: 'recorded',
  }
  const workItems = new Map()
  if (workItem) workItems.set(String(workItem._id || ids.item), clone({ xrstatx: 1, source_specimen_record_id: ids.item, ...workItem }))
  const rejections = new Map([[ids.rejection, clone(rejectionRow)]])
  const outboundRows = outbound ? [clone(outbound)] : []
  const originalItem = clone(item)
  const originalOrder = clone(order)

  const workMatches = (row, query) => {
    if (!row || [0, 3].includes(Number(row.xrstatx))) return false
    if (query._id != null && String(row._id) !== String(query._id)) return false
    if (query.source_specimen_record_id != null && String(row.source_specimen_record_id) !== String(query.source_specimen_record_id)) return false
    if (query.work_status != null && row.work_status !== query.work_status) return false
    if (query.$or && !query.$or.some(part => workMatches(row, part))) return false
    return true
  }
  const workCollection = {
    findOne: async query => {
      for (const row of workItems.values()) if (workMatches(row, query)) return clone(row)
      return null
    },
    insertOne: async doc => {
      if (insertRace) {
        workItems.set(ids.item, clone(insertRace))
        throw new Error('duplicate key')
      }
      if (workItems.has(String(doc._id))) throw new Error('duplicate key')
      workItems.set(String(doc._id), clone(doc))
      return { insertedId: doc._id }
    },
    findOneAndUpdate: async (query, update) => {
      for (const [key, row] of workItems.entries()) {
        if (!workMatches(row, query)) continue
        const next = { ...row, ...clone(update.$set || {}) }
        workItems.set(key, next)
        return { value: clone(next) }
      }
      return { value: null }
    },
  }
  const app = {
    isAuth: () => true,
    dbObjectId: value => String(value),
    curDate: () => '2026-09-01 12:34:56',
    dbFindById: async (id, collection) => ({
      success: true,
      reply: { data: collection === 'zdata_lab_receive' ? clone(rejections.get(String(id)) || null) : null },
    }),
    dbUpdate: async (patch, collection, ignoredUser, filter) => {
      if (collection !== 'zdata_lab_receive' || auditFails) return { success: false }
      const row = rejections.get(String(filter._id))
      if (!row || row.source_order_id !== filter.source_order_id) return { success: false }
      Object.assign(row, clone(patch))
      return { success: true }
    },
    db: {
      collection: name => ({
        zdata_cpoe_order_item: { findOne: async query => String(query._id) === ids.item ? clone(item) : null },
        zdata_cpoe_order: { findOne: async query => String(query._id) === ids.order ? clone(order) : null },
        zdata_master_item_order: { findOne: async query => String(query._id) === ids.master ? clone(master) : null },
        zdata_section: { findOne: async () => null },
        zdata_lab_work_item: workCollection,
        zdata_lab_outband_order: {
          findOne: async query => outboundRows.find(row =>
            String(row._id) === ids.item || String(row.work_item_id) === ids.item,
          ) || null,
        },
        zdata_lab_order_cancellation: {
          findOne: async query => cancellation && String(query._id) === ids.order
            ? clone(cancellation)
            : null,
        },
      })[name],
    },
  }
  return { app, item, order, originalItem, originalOrder, workItems, rejections }
}

const run = (harness, overrides = {}) => Process({
  action: 'reject_item',
  item_id: ids.item,
  rejection_record_id: ids.rejection,
  order_id: ids.order,
  order_number: 'R2608310004',
  section_code: 'BC',
  ...overrides,
}, userInfo, harness.app)

;(async () => {
  {
    const harness = makeHarness()
    const result = await run(harness)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.created_work_item, true)
    assert.strictEqual(result.data.work_status, 'rejected')
    assert.strictEqual(result.data.lab_no, '')
    assert.strictEqual(result.data.cpoe_unchanged, true)
    assert.strictEqual(result.data.outbound_unchanged, true)
    const saved = harness.workItems.get(ids.item)
    assert.strictEqual(saved._id, ids.item)
    assert.strictEqual(saved.source_specimen_record_id, ids.item)
    assert.strictEqual(saved.work_status, 'rejected')
    assert.strictEqual(saved.lab_no, '', 'pre-receipt rejection must not allocate a LAB NO.')
    assert.strictEqual(saved.rejection_record_id, ids.rejection)
    assert.strictEqual(saved.reject_reason_code, 'specimen_insufficient')
    assert.strictEqual(harness.rejections.get(ids.rejection).rejection_status, 'applied')
    assert.deepStrictEqual(harness.item, harness.originalItem, 'CPOE Item must stay read-only')
    assert.deepStrictEqual(harness.order, harness.originalOrder, 'CPOE Order must stay read-only')
  }

  for (const itemStatus of ['accepted', 'prepared', 'ready', 'dispensed']) {
    const harness = makeHarness({ itemStatus })
    const result = await run(harness)
    assert.strictEqual(result.success, true, `legacy ${itemStatus} without LAB receipt evidence is effectively waiting`)
    assert.strictEqual(result.data.created_work_item, true)
    assert.strictEqual(result.data.work_status, 'rejected')
  }

  {
    const harness = makeHarness({ itemStatus: 'accepted', itemPatch: { received_at: '2026-09-01 10:00:00' } })
    const result = await run(harness)
    assert.strictEqual(result.success, false, 'accepted with receipt evidence must remain fail-closed')
    assert.strictEqual(result.error, 'item_not_waiting_receive')
    assert.strictEqual(harness.workItems.size, 0)
  }

  {
    const harness = makeHarness({ itemStatus: 'accepted', itemPatch: { lab_no: '106909010001' } })
    const result = await run(harness)
    assert.strictEqual(result.success, false, 'accepted with LAB NO. must remain fail-closed')
    assert.strictEqual(result.error, 'item_not_waiting_receive')
    assert.strictEqual(harness.workItems.size, 0)
  }

  {
    const harness = makeHarness({ workItem: {
      _id: ids.item,
      work_status: 'waiting_receive',
      lab_no: '106909010099',
      section_code: 'BC',
    } })
    const result = await run(harness)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.created_work_item, false)
    assert.strictEqual(harness.workItems.get(ids.item).work_status, 'rejected')
    assert.strictEqual(harness.workItems.get(ids.item).lab_no, '106909010099')
  }

  {
    const harness = makeHarness({ workItem: {
      _id: ids.item,
      work_status: 'rejected',
      rejected_at: '2026-09-01 12:00:00',
      rejected_by: { name: 'Earn Admin' },
      rejection_record_id: ids.rejection,
      reject_reason_code: 'specimen_insufficient',
    } })
    const result = await run(harness)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.already_rejected, true)
    assert.strictEqual(result.data.audit_sync_pending, false)
    assert.strictEqual(harness.rejections.get(ids.rejection).rejection_status, 'applied')
  }

  {
    const harness = makeHarness({ workItem: { _id: ids.item, work_status: 'received', lab_no: '106909010001' } })
    const result = await run(harness)
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'invalid_work_status')
  }

  {
    const harness = makeHarness({ outbound: { _id: ids.item, xrstatx: 1, work_item_id: ids.item } })
    const result = await run(harness)
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'outbound_exists')
    assert.strictEqual(harness.workItems.size, 0)
  }

  {
    const harness = makeHarness({ cancellation: {
      _id: ids.order,
      xrstatx: 1,
      order_id: ids.order,
      cancel_status: 'applied',
      cancel_reason: 'ผู้สั่งยกเลิกการตรวจทั้ง Order',
    } })
    const result = await run(harness)
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'order_cancelled')
    assert.strictEqual(harness.workItems.size, 0)
  }

  {
    const harness = makeHarness({ sectionCode: 'HM' })
    const result = await run(harness, { section_code: 'HM' })
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'section_forbidden')
  }

  {
    const harness = makeHarness({ rejection: {
      _id: ids.rejection,
      xrstatx: 1,
      source_order_id: ids.item,
      order_group_id: 'R2608310004',
      lab_section: 'BC',
      reject_reason_code: '',
    } })
    const result = await run(harness)
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'reject_reason_missing')
  }

  {
    const raced = {
      _id: ids.item,
      xrstatx: 1,
      source_specimen_record_id: ids.item,
      work_status: 'rejected',
      rejection_record_id: ids.rejection,
      rejected_at: '2026-09-01 12:34:56',
      rejected_by: { name: 'Earn Admin' },
      reject_reason_code: 'specimen_insufficient',
    }
    const harness = makeHarness({ insertRace: raced })
    const result = await run(harness)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.created_work_item, false)
    assert.strictEqual(harness.workItems.size, 1)
  }

  {
    const harness = makeHarness({ auditFails: true })
    const result = await run(harness)
    assert.strictEqual(result.success, true, 'Work Item rejection remains authoritative if audit sync temporarily fails')
    assert.strictEqual(result.data.audit_sync_pending, true)
    assert(result.message.includes('reconcile'))
  }

  {
    const harness = makeHarness()
    const result = await run(harness, { action: 'recheck' })
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'unsupported_action')
    assert.strictEqual(harness.workItems.size, 0)
  }

  assert(source.includes("const WORK_ITEM_COLLECTION = 'zdata_lab_work_item'"))
  assert(source.includes("const OUTBOUND_COLLECTION = 'zdata_lab_outband_order'"))
  assert(!source.includes('itemCollection.updateOne'), 'CPOE Item must remain read-only')
  assert(!source.includes('orderCollection.updateOne'), 'CPOE Order must remain read-only')
  console.log('LAB Item rejection API tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
