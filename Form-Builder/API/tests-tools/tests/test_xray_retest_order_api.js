const assert = require('assert')
const fs = require('fs')
const path = require('path')

/* action `retest_order` — ตรวจใหม่เฉพาะ X-ray item ที่เลือก (2026-09-18)
   กติกาที่ผู้ใช้กำหนด 2026-09-03:
     "กดปุ๊บย้าย order กลับไปหน้ารอรับ หากมีเลข accession no ให้ล้าง
      แล้วค่อยให้เขากดส่งเข้าเครื่อง + เจนเลขใหม่ ส่วนเลข order เดิม"
   แทนกติกาเดิมใน Xray_design.md ที่ให้สร้าง Order ใหม่ลิงก์กลับ */
const apiBody = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/xray_cpoe_worklist_api.js'),
  'utf8',
)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const Process = new AsyncFunction('params', 'userInfo', 'app', apiBody)

assert(apiBody.includes("action === 'retest_order'"), 'retest lives in the worklist Process')
assert(apiBody.includes("action === 'retest_items'"), 'new action cannot be misrouted to legacy whole-order retest')
assert(!apiBody.includes('mongoTxn'), 'MongoDB standalone — ห้ามเปิด transaction ที่นี่')

const ORDER = 'aaaaaaaaaaaaaaaaaaaaaaa1'
const ITEM_A = 'bbbbbbbbbbbbbbbbbbbbbbb1'
const ITEM_B = 'bbbbbbbbbbbbbbbbbbbbbbb2'
const ITEM_LAB = 'bbbbbbbbbbbbbbbbbbbbbbb3'

const clone = value => JSON.parse(JSON.stringify(value))
const radiologyUser = {
  roles: ['auth'], username: 'xray-test', employee_code: 'XR01',
  unit: { code: 'M0901' }, account: { name: 'xray-test' }, fullname: 'เจ้าหน้าที่ รังสี',
}
const wardUser = { roles: ['auth'], username: 'ward', employee_code: 'W1', unit: { code: '19.P' } }

const makeHarness = ({ items = null, cancellation = null } = {}) => {
  const rows = items || [
    {
      _id: ITEM_A, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
      current_status: 'cancelled', item_code: 'RD015', item_name: 'Neck AP',
      /* รอบก่อนออกเลขและส่งเข้าเครื่องไปแล้ว ก่อนจะถูกยกเลิก */
      accession_no: 'SM20260901DX001',
      dispatched_at: '2026-09-01 09:00:00', dispatched_by: { name: 'คนกดส่ง เดิม' },
      transport: { status: 'ok', attempts: 1 }, transport_failed: false,
      cancel_reason: 'แพทย์ยกเลิกคำสั่ง', cancelled_at: '2026-09-01 19:00:00',
      cancelled_by: { name: 'หมอ ก' }, cancellation_record_id: ORDER,
      cancel_type: 'xray_order_cancelled',
    },
    {
      _id: ITEM_B, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
      current_status: 'cancelled', item_code: 'RD016', item_name: 'Lateral neck',
      /* ยกเลิกก่อนออกเลข — ไม่มีอะไรให้ล้าง */
      cancel_reason: 'แพทย์ยกเลิกคำสั่ง', cancelled_at: '2026-09-01 19:00:00',
    },
    { _id: ITEM_LAB, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'lab' }, current_status: 'cancelled' },
  ]
  const itemMap = new Map(rows.map(row => [row._id, clone(row)]))
  const orders = new Map([[ORDER, { _id: ORDER, xrstatx: 1, order_number: 'R2609010003' }]])
  const cancellations = new Map([[ORDER, clone(cancellation || {
    _id: ORDER, xrstatx: 1, cancel_status: 'applied', cancel_reason: 'แพทย์ยกเลิกคำสั่ง',
    cancelled_at: '2026-09-01 19:00:00', item_ids: [ITEM_A, ITEM_B],
  })]])

  const matchesLink = (row, query) => {
    if (!query.$or) return true
    return query.$or.some(cond => {
      const [field, rule] = Object.entries(cond)[0]
      const wanted = (rule && rule.$in) || [rule]
      const actual = field === 'order_id.value' ? (row.order_id && row.order_id.value) : row[field]
      return wanted.some(value => String(actual) === String(value))
    })
  }
  const applyUpdate = (row, update) => {
    Object.assign(row, clone(update.$set || {}))
    Object.keys(update.$push || {}).forEach(field => {
      if (!Array.isArray(row[field])) row[field] = []
      row[field].push(clone(update.$push[field]))
    })
  }
  const itemCollection = {
    find: query => ({ toArray: async () => [...itemMap.values()].filter(row => matchesLink(row, query)).map(clone) }),
    findOne: async query => clone(itemMap.get(String(query._id)) || null),
    updateOne: async (query, update) => {
      const row = itemMap.get(String(query._id))
      if (!row) return { matchedCount: 0, modifiedCount: 0 }
      /* compare-and-set: ถ้าสถานะเปลี่ยนไปแล้วต้องไม่แมตช์ */
      if (query.current_status && row.current_status !== query.current_status) {
        return { matchedCount: 0, modifiedCount: 0 }
      }
      applyUpdate(row, update)
      return { matchedCount: 1, modifiedCount: 1 }
    },
  }
  const cancellationCollection = {
    findOne: async query => clone(cancellations.get(String(query._id)) || null),
    insertOne: async doc => { cancellations.set(String(doc._id), clone(doc)); return { insertedId: doc._id } },
    updateOne: async (query, update) => {
      const row = cancellations.get(String(query._id))
      if (!row) return { matchedCount: 0, modifiedCount: 0 }
      if (query.cancel_status && query.cancel_status.$in &&
        !query.cancel_status.$in.includes(row.cancel_status)) {
        return { matchedCount: 0, modifiedCount: 0 }
      }
      applyUpdate(row, update)
      return { matchedCount: 1, modifiedCount: 1 }
    },
  }

  const app = {
    isAuth: () => true,
    curDate: () => '2026-09-03 12:00:00',
    dbObjectId: id => String(id),
    dbFindAll: async () => ({ success: true, reply: { data: [] } }),
    db: {
      collection: name => ({
        zdata_cpoe_order_item: itemCollection,
        zdata_cpoe_order: { findOne: async query => clone(orders.get(String(query._id)) || null) },
        zdata_xray_order_cancellation: cancellationCollection,
      })[name],
    },
  }
  return { app, items: itemMap, cancellations, orders }
}

const retest = (h, extra, user) => Process(
  Object.assign({ action: 'retest_order', order_id: ORDER, item_ids: [ITEM_A, ITEM_B] }, extra || {}),
  user || radiologyUser,
  h.app,
)

;(async () => {
  /* ── เคสหลัก: กลับไปรอรับ · ล้างเลข Accession · Order เดิม ─────────────── */
  {
    const h = makeHarness()
    const out = await retest(h)
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(out.data.order_number, 'R2609010003', 'เลข Order เดิมไม่เปลี่ยน')
    assert.strictEqual(out.data.current_status, 'sent')
    assert.strictEqual(out.data.reopened_item_count, 2, 'รายการรังสีสองตัวกลับมา')
    assert.deepStrictEqual(out.data.item_ids, [ITEM_A, ITEM_B])
    assert.strictEqual(out.data.cleared_accession_count, 1, 'ตัวที่มีเลขเท่านั้นที่ถูกล้าง')
    assert.strictEqual(out.data.audit_sync_pending, false)
    assert(out.message.includes('กดส่งเข้าเครื่อง'), out.message)

    const a = h.items.get(ITEM_A)
    assert.strictEqual(a.current_status, 'sent', 'กลับไปหน้ารอรับ')
    assert.strictEqual(a.accession_no, '', 'เลขเดิมถูกล้าง — เลขใหม่จะออกตอนกดส่งเข้าเครื่อง')
    /* เลขเดิมต้องตามกลับได้ ผลอ่านรอบก่อนผูกกับเลขนั้น */
    assert.deepStrictEqual(
      a.accession_history.map(entry => [entry.accession_no, entry.reason]),
      [['SM20260901DX001', 'retest']],
    )
    /* ร่องรอยของรอบก่อนต้องถูกล้าง ไม่งั้นหน้าจอจะอ่านว่ารอบนี้เคยส่งไปแล้ว */
    assert.strictEqual(a.dispatched_at, '')
    assert.strictEqual(a.dispatched_by, '')
    assert.strictEqual(a.transport, '')
    assert.strictEqual(a.transport_failed, false)
    assert.strictEqual(a.cancel_reason, '')
    assert.strictEqual(a.cancelled_at, '')
    assert.strictEqual(a.cancellation_record_id, '')
    assert.strictEqual(a.retest_at, '2026-09-03 12:00:00')
    assert.strictEqual(a.retest_by.name, 'เจ้าหน้าที่ รังสี')
    assert.deepStrictEqual(
      a.retest_log.map(entry => [entry.from_status, entry.to_status, entry.cleared_accession_no]),
      [['cancelled', 'sent', 'SM20260901DX001']],
    )

    const b = h.items.get(ITEM_B)
    assert.strictEqual(b.current_status, 'sent')
    assert.strictEqual(b.accession_history, undefined, 'ไม่มีเลขก็ไม่ต้องมีประวัติหลอก ๆ')
    assert.strictEqual(b.retest_log.length, 1)

    /* รายการ LAB ในใบเดียวกันห้ามถูกแตะ */
    assert.strictEqual(h.items.get(ITEM_LAB).current_status, 'cancelled')

    /* บันทึกการยกเลิกต้องยังอยู่ — เป็นหลักฐานของรอบก่อน แค่ประทับว่าเปิดกลับมาแล้ว */
    const record = h.cancellations.get(ORDER)
    assert.strictEqual(record.cancel_status, 'reopened')
    assert.strictEqual(record.reopened_at, '2026-09-03 12:00:00')
    assert.strictEqual(record.cancel_reason, 'แพทย์ยกเลิกคำสั่ง', 'เหตุผลเดิมห้ามหาย')
    assert.strictEqual(record.reopen_log.length, 1)
    assert.strictEqual(record.reopen_log[0].reopened_item_count, 2)
    assert.deepStrictEqual(record.reopen_log[0].item_ids, [ITEM_A, ITEM_B])
  }

  /* 2026-09-18: ใบเดียวมีหลายรายการ ตรวจใหม่ A ต้องไม่ปลุก B หรือล้างเลข B */
  {
    const h = makeHarness()
    assert.strictEqual((await retest(h, { item_ids: undefined })).error, 'invalid_item_ids', 'old Form fails closed on new Process')
    const out = await retest(h, { action: 'retest_items', item_ids: [ITEM_A] })
    assert.strictEqual(out.success, true, out.message)
    assert.deepStrictEqual(out.data.item_ids, [ITEM_A])
    assert.strictEqual(h.items.get(ITEM_B).current_status, 'cancelled')
  }
  {
    const h = makeHarness()
    h.items.get(ITEM_B).accession_no = 'SM20260901CT002'
    const beforeB = clone(h.items.get(ITEM_B))
    const first = await retest(h, { item_ids: [ITEM_A] })
    assert.strictEqual(first.success, true, first.message)
    assert.deepStrictEqual(first.data.item_ids, [ITEM_A])
    assert.strictEqual(first.data.reopened_item_count, 1)
    assert.deepStrictEqual(h.items.get(ITEM_B), beforeB, 'ยกเลิก B คงเดิมทุกฟิลด์')
    assert.strictEqual(h.cancellations.get(ORDER).cancel_status, 'applied', 'ยังมี B ยกเลิกอยู่')
    assert.deepStrictEqual(h.cancellations.get(ORDER).reopen_log[0].item_ids, [ITEM_A])
    const second = await retest(h, { item_ids: [ITEM_B] })
    assert.strictEqual(second.success, true, second.message)
    assert.strictEqual(h.cancellations.get(ORDER).cancel_status, 'reopened')
    assert.strictEqual(h.items.get(ITEM_B).accession_history[0].accession_no, 'SM20260901CT002')
    assert.strictEqual(h.items.get(ITEM_A).retest_log.length, 1, 'ครั้งที่สองไม่แตะ A')
  }

  /* Form เก่าที่ไม่ส่ง item_ids และการเลือกผิดชุดต้องหยุดก่อนแตะรายการใด ๆ */
  {
    const h = makeHarness()
    for (const ids of [undefined, [], [ITEM_A, ITEM_A], [ITEM_A, 'bad']]) {
      assert.strictEqual((await retest(h, { item_ids: ids })).error, 'invalid_item_ids')
    }
    assert.strictEqual((await retest(h, { item_ids: [ITEM_A, ITEM_LAB] })).error, 'item_not_in_order')
    assert.strictEqual((await retest(h, { item_ids: [ITEM_A, 'cccccccccccccccccccccccc'] })).error, 'item_not_in_order')
    h.items.get(ITEM_B).current_status = 'resulted'
    assert.strictEqual((await retest(h, { item_ids: [ITEM_A, ITEM_B] })).error, 'item_not_retestable')
    assert.strictEqual(h.items.get(ITEM_A).current_status, 'cancelled')
    assert.strictEqual(h.items.get(ITEM_A).retest_log, undefined)
  }
  {
    const h = makeHarness({ cancellation: {
      _id: ORDER, xrstatx: 1, cancel_status: 'ris_pending', item_ids: [ITEM_A],
    } })
    assert.strictEqual((await retest(h, { item_ids: [ITEM_A] })).error, 'cancel_audit_pending')
    assert.strictEqual(h.items.get(ITEM_A).current_status, 'cancelled')
  }

  /* ── ยกเลิกซ้ำหลังตรวจใหม่ต้องประทับ applied ได้ตามปกติ ───────────────── */
  {
    const h = makeHarness()
    await retest(h)
    /* ผู้ใช้ยืนยัน 2026-09-18: แม้เลือกยกเลิกทั้งสองรายการหลังตรวจใหม่
       ต้องระบุ item_ids เพื่อไม่ให้ Process เผลอยกเลิก sibling */
    const out = await Process(
      { action: 'cancel_order', order_id: ORDER, item_ids: [ITEM_A, ITEM_B], cancel_reason: 'ยกเลิกอีกรอบ' },
      radiologyUser, h.app,
    )
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(out.data.audit_sync_pending, false, 'สถานะ reopened ต้องไม่ทำให้ค้าง reconcile')
    assert.strictEqual(h.items.get(ITEM_A).current_status, 'cancelled')
    assert.strictEqual(h.cancellations.get(ORDER).cancel_status, 'applied')
  }

  /* ── ไม่มีอะไรให้ตรวจใหม่ ────────────────────────────────────────────── */
  {
    const h = makeHarness({
      items: [{
        _id: ITEM_A, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
        current_status: 'sent', item_code: 'RD015',
      }],
    })
    const out = await retest(h, { item_ids: [ITEM_A] })
    assert.strictEqual(out.error, 'item_not_retestable')
    assert.strictEqual(h.items.get(ITEM_A).current_status, 'sent', 'ของที่ยังไม่ยกเลิกห้ามถูกแตะ')
  }

  /* ── ของที่ต้องปฏิเสธ ───────────────────────────────────────────────── */
  {
    const h = makeHarness()
    assert.strictEqual((await retest(h, {}, wardUser)).success, false, 'หน่วยงานที่ไม่ใช่รังสีทำไม่ได้')
    assert.strictEqual(h.items.get(ITEM_A).current_status, 'cancelled')

    assert.strictEqual((await retest(h, { order_id: 'not-an-id' })).error, 'invalid_order_id')
    assert.strictEqual((await retest(h, { order_id: 'cccccccccccccccccccccccc' })).error, 'order_not_found')
  }

  /* ── ออกผลไปแล้วไม่ใช่งานของปุ่มนี้ — ใช้ "ส่งตรวจซ้ำ" ในแท็บ order ──── */
  {
    const h = makeHarness({
      items: [{
        _id: ITEM_A, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
        current_status: 'resulted', accession_no: 'SM20260901DX001', item_code: 'RD015',
      }],
    })
    const out = await retest(h, { item_ids: [ITEM_A] })
    assert.strictEqual(out.error, 'item_not_retestable')
    assert.strictEqual(h.items.get(ITEM_A).accession_no, 'SM20260901DX001', 'เลขของใบที่ออกผลแล้วห้ามถูกล้าง')
  }

  console.log('X-ray retest_order API tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
