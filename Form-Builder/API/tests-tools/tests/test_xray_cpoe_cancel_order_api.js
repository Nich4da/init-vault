const assert = require('assert')
const fs = require('fs')
const path = require('path')

const apiBody = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/xray_cpoe_worklist_api.js'),
  'utf8',
)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const Process = new AsyncFunction('params', 'userInfo', 'app', apiBody)
const dispatchBody = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/xray_cpoe_dispatch_api.js'),
  'utf8',
)
const Dispatch = new AsyncFunction('params', 'userInfo', 'app', dispatchBody)

/* ยกเลิกทั้งใบอยู่ใน Process worklist ตัวเดิม (ทรงเดียวกับ LAB) — ไม่มี Process ID ใหม่
   ถ้าใครย้ายออกไปเป็น Process แยก ต้องแก้ฟอร์มด้วย ไม่งั้นปุ่มจะยิงผิดที่ */
assert(apiBody.includes("action === 'cancel_order'"), 'cancel lives in the worklist Process')
/* MongoDB standalone — ห้ามใช้ transaction ที่นี่เช่นกัน */
assert(!apiBody.includes('mongoTxn'), 'cancel must not open a transaction on standalone MongoDB')

const ORDER = 'aaaaaaaaaaaaaaaaaaaaaaa1'
const OTHER_ORDER = 'aaaaaaaaaaaaaaaaaaaaaaa2'
const ITEM_A = 'bbbbbbbbbbbbbbbbbbbbbbb1'
const ITEM_B = 'bbbbbbbbbbbbbbbbbbbbbbb2'
const ITEM_LAB = 'bbbbbbbbbbbbbbbbbbbbbbb3'

const clone = value => JSON.parse(JSON.stringify(value))
const radiologyUser = {
  roles: ['auth'], username: 'xray-test', employee_code: 'XR01',
  unit: { code: 'M0901' }, account: { name: 'xray-test' },
}
const wardUser = { roles: ['auth'], username: 'ward', employee_code: 'W1', unit: { code: '19.P' } }

const makeHarness = ({ items = null, cancellation = null, raceOn = '', risOrders = [],
  risResults = [], risReplies = [] } = {}) => {
  const rows = items || [
    { _id: ITEM_A, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
      current_status: 'sent', item_code: 'RD015', item_name: 'Neck AP' },
    { _id: ITEM_B, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
      current_status: 'sent', item_code: 'RD016', item_name: 'Lateral neck' },
    { _id: ITEM_LAB, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'lab' },
      current_status: 'sent', item_code: 'CBC' },
  ]
  const itemMap = new Map(rows.map(row => [row._id, clone(row)]))
  const orders = new Map([[ORDER, { _id: ORDER, xrstatx: 1, order_number: 'R2609010003' }]])
  const cancellations = new Map(cancellation ? [[ORDER, clone(cancellation)]] : [])
  const risRows = risOrders.map(clone)
  const resultRows = risResults.map(clone)
  const risCalls = []
  const replies = risReplies.slice()

  const matchesLink = (row, query) => {
    if (!query.$or) return true
    return query.$or.some(cond => {
      const [field, rule] = Object.entries(cond)[0]
      const wanted = (rule && rule.$in) || [rule]
      const actual = field === 'order_id.value' ? (row.order_id && row.order_id.value) : row[field]
      return wanted.some(value => String(actual) === String(value))
    })
  }
  const itemCollection = {
    find: query => ({ toArray: async () => [...itemMap.values()].filter(row => matchesLink(row, query)).map(clone) }),
    updateOne: async (query, update) => {
      const row = itemMap.get(query._id)
      if (!row) return { matchedCount: 0, modifiedCount: 0 }
      /* จำลอง race: มีคนเปลี่ยนสถานะไปก่อนเราเขียน ⇒ compare-and-set ต้องพลาด */
      if (raceOn === query._id) return { matchedCount: 0, modifiedCount: 0 }
      if (query.current_status && row.current_status !== query.current_status) {
        return { matchedCount: 0, modifiedCount: 0 }
      }
      Object.assign(row, clone(update.$set || {}))
      return { matchedCount: 1, modifiedCount: 1 }
    },
  }
  const cancellationCollection = {
    findOne: async query => clone(cancellations.get(String(query._id)) || null),
    insertOne: async doc => {
      if (cancellations.has(String(doc._id))) throw new Error('E11000 duplicate key')
      cancellations.set(String(doc._id), clone(doc))
      return { insertedId: doc._id }
    },
    updateOne: async (query, update) => {
      const row = cancellations.get(String(query._id))
      if (!row) return { matchedCount: 0, modifiedCount: 0 }
      if (query.cancel_status && query.cancel_status.$in &&
        !query.cancel_status.$in.includes(row.cancel_status)) {
        return { matchedCount: 0, modifiedCount: 0 }
      }
      Object.assign(row, clone(update.$set || {}))
      return { matchedCount: 1, modifiedCount: 1 }
    },
  }

  const app = {
    isAuth: () => true,
    curDate: () => '2026-09-01 19:00:00',
    dbObjectId: id => String(id),
    dbFindAll: async () => ({ success: true, reply: { data: [] } }),
    db: {
      collection: name => ({
        zdata_cpoe_order_item: itemCollection,
        zdata_cpoe_order: { findOne: async query => clone(orders.get(String(query._id)) || null) },
        zdata_xray_order_cancellation: cancellationCollection,
        zdata_xray_order: { findOne: async query => clone(
          risRows.find(row => row.AccessionNo === query.AccessionNo && row.xrstatx !== 0 && row.xrstatx !== 3) || null
        ) },
        zdata_xray_result: { findOne: async query => clone(
          resultRows.find(row => row.AccessionNo === query.AccessionNo && row.ResultText) || null
        ) },
      })[name],
    },
    runProcess: async (id, payload) => {
      risCalls.push({ id, payload: clone(payload) })
      const reply = replies.length ? replies.shift() : {
        AcknowledgementCode: 'AA', ForwardHttpStatus: 200,
        ForwardResponse: { AcknowledgementCode: 'AA', AccessionNo: payload.AccessionNo }
      }
      return { success: true, reply: { data: reply } }
    },
  }
  return { app, items: itemMap, cancellations, risCalls, replies }
}

const RIS_SOURCE = {
  _id: 'ccccccccccccccccccccccc1', xrstatx: 1,
  Hn: 'TEST-HN', PatientTitle: 'Mr', PatientFName: 'Test', PatientLName: 'Person',
  PatientGender: 'M', PatientDob: '2000-01-01', PatientClassUid: 'O', VisitNo: 'TEST-VN',
  AccessionNo: 'SM20260901DX001', ExamUid: 'RD015', ExamName: 'Neck AP',
  Priority: 'R', Status: 'C', IsDeleted: false, RequestNo: 'R2609010003',
  MessageControlId: 'XRSM20260901DX001', created_at: '2026-09-01 12:00:00'
}

/* ผู้ใช้ยืนยัน 2026-09-18: แม้เลือกครบทั้งใบก็ต้องระบุ item_ids ชัดเจน;
   คำขอเก่าที่ไม่มี selection ต้องถูกปฏิเสธเพื่อไม่ให้ยกเลิก sibling โดยบังเอิญ */
const cancel = (h, extra, user) => Process(
  Object.assign({ action: 'cancel_order', order_id: ORDER, cancel_reason: 'แพทย์ยกเลิกคำสั่ง',
    item_ids: [...h.items.values()].filter(row =>
      (row.service_type && row.service_type.value) === 'xray').map(row => row._id) }, extra || {}),
  user || radiologyUser,
  h.app,
)

;(async () => {
  /* ── ยกเลิกสำเร็จ ────────────────────────────────────────────────────── */
  {
    const h = makeHarness()
    const out = await cancel(h, { order_number: 'R2609010003' })
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(out.data.cancelled_item_count, 2, 'both X-ray items cancel; the LAB item is untouched')
    assert.strictEqual(out.data.item_count, 2)
    assert.strictEqual(out.data.already_cancelled, false)
    assert.strictEqual(out.data.audit_sync_pending, false)

    assert.strictEqual(h.items.get(ITEM_A).current_status, 'cancelled')
    assert.strictEqual(h.items.get(ITEM_A).cancel_reason, 'แพทย์ยกเลิกคำสั่ง')
    assert.strictEqual(h.items.get(ITEM_A).cancel_type, 'xray_item_cancelled')
    assert.strictEqual(h.items.get(ITEM_A).cancelled_at, '2026-09-01 19:00:00')
    assert.strictEqual(h.items.get(ITEM_B).current_status, 'cancelled')
    assert.strictEqual(h.items.get(ITEM_LAB).current_status, 'sent', 'a LAB item in the same order must never be touched')

    const log = h.cancellations.get(ORDER)
    assert.strictEqual(log.cancel_status, 'applied')
    assert.strictEqual(log.source_order_number, 'R2609010003')
    assert.deepStrictEqual(log.item_ids, [ITEM_A, ITEM_B])
  }

  /* ── กดซ้ำ = ไม่เกิดใบยกเลิกซ้ำ และไม่ error ────────────────────────── */
  {
    const h = makeHarness()
    await cancel(h)
    const again = await cancel(h)
    assert.strictEqual(again.success, true, again.message)
    assert.strictEqual(again.data.already_cancelled, true)
    assert.strictEqual(again.data.cancelled_item_count, 0, 'nothing left to cancel the second time')
    assert(again.message.includes('ถูกยกเลิกแล้ว'))
    assert.strictEqual(h.cancellations.size, 1)
  }

  /* ── ออกเลขแต่ไม่มี JSON ต้นทาง = ห้ามยกเลิกข้างเดียว (คง guard เดิม) ──── */
  {
    const h = makeHarness({
      items: [
        { _id: ITEM_A, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
          current_status: 'dispatched', item_code: 'RD015', accession_no: 'SM20260901DX001' },
        { _id: ITEM_B, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
          current_status: 'sent', item_code: 'RD016' },
      ],
    })
    const out = await cancel(h)
    assert.strictEqual(out.success, false)
    assert.strictEqual(out.error, 'ris_cancel_required')
    assert(out.message.includes('SM20260901DX001'), out.message)
    assert(out.message.includes('RIS'), out.message)
    /* หยุดก่อนแตะอะไรเลย — ห้ามยกเลิกครึ่งใบ */
    assert.strictEqual(h.items.get(ITEM_A).current_status, 'dispatched')
    assert.strictEqual(h.items.get(ITEM_B).current_status, 'sent')
    assert.strictEqual(h.cancellations.size, 0, 'a refused cancel must not leave a log behind')
  }

  /* ── ผู้ใช้ยืนยัน 2026-09-18: ส่ง Order เดิม + IsDeleted:true ไป Process เดิม ─ */
  {
    const h = makeHarness({
      items: [
        { _id: ITEM_A, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
          current_status: 'dispatched', item_code: 'RD015', accession_no: RIS_SOURCE.AccessionNo },
        { _id: ITEM_B, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
          current_status: 'sent', item_code: 'RD016' },
      ],
      risOrders: [RIS_SOURCE],
    })
    const out = await cancel(h)
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(h.risCalls.length, 1)
    assert.strictEqual(h.risCalls[0].id, '6a8f1ef87632d182ef6914fe')
    assert.strictEqual(h.risCalls[0].payload.AccessionNo, RIS_SOURCE.AccessionNo)
    assert.strictEqual(h.risCalls[0].payload.IsDeleted, true)
    assert.strictEqual(h.risCalls[0].payload.Status, 'A', 'C means Completed, not Cancel')
    assert.strictEqual(h.risCalls[0].payload.Hn, RIS_SOURCE.Hn)
    assert.strictEqual(h.risCalls[0].payload.ExamUid, RIS_SOURCE.ExamUid)
    assert(!('_id' in h.risCalls[0].payload), 'never forward DB metadata')
    assert(!('created_at' in h.risCalls[0].payload), 'never forward audit metadata')
    assert.strictEqual(h.items.get(ITEM_A).current_status, 'cancelled')
    assert.strictEqual(h.items.get(ITEM_B).current_status, 'cancelled')
    assert.strictEqual(h.cancellations.get(ORDER).ris_cancel.status, 'confirmed')
    assert.strictEqual(h.cancellations.get(ORDER).cancel_status, 'applied')
    await cancel(h)
    assert.strictEqual(h.risCalls.length, 1, 'repeated click must not create another RIS request')
  }

  /* ผู้ใช้ยืนยัน 2026-09-18: item_ids คือขอบเขตการยกเลิก; ผลของ sibling
     ต้องไม่ขวางรายการที่เลือก และห้ามส่ง IsDeleted ของ sibling ไป RIS */
  {
    const resultedAccession = 'SM20260901DX002'
    const h = makeHarness({
      items: [
        { _id: ITEM_A, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
          current_status: 'dispatched', item_code: 'RD015', accession_no: RIS_SOURCE.AccessionNo },
        { _id: ITEM_B, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
          current_status: 'dispatched', item_code: 'RD016', accession_no: resultedAccession },
      ],
      risOrders: [RIS_SOURCE, { ...RIS_SOURCE, _id: 'ccccccccccccccccccccccc2',
        AccessionNo: resultedAccession, ExamUid: 'RD016', ExamName: 'Lateral neck' }],
      risResults: [{ AccessionNo: resultedAccession, ResultText: 'Final report', xrstatx: 1 }],
    })
    const out = await cancel(h, { item_ids: [ITEM_A] })
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(out.data.current_status, 'partially_cancelled')
    assert.strictEqual(out.data.cancelled_item_count, 1)
    assert.deepStrictEqual(out.data.item_ids, [ITEM_A])
    assert.strictEqual(h.risCalls.length, 1)
    assert.strictEqual(h.risCalls[0].payload.AccessionNo, RIS_SOURCE.AccessionNo)
    assert.strictEqual(h.risCalls[0].payload.IsDeleted, true)
    assert.strictEqual(h.items.get(ITEM_A).current_status, 'cancelled')
    assert.strictEqual(h.items.get(ITEM_B).current_status, 'dispatched')
    assert.strictEqual(h.items.get(ITEM_B).cancelled_at, undefined)
    assert.deepStrictEqual(h.cancellations.get(ORDER).item_ids, [ITEM_A])
    assert.strictEqual(h.cancellations.get(ORDER).cancel_scope, 'items')

    const retry = await cancel(h, { item_ids: [ITEM_A] })
    assert.strictEqual(retry.success, true, retry.message)
    assert.strictEqual(retry.data.already_cancelled, true)
    assert.strictEqual(h.risCalls.length, 1)
    const blockedSibling = await cancel(h, { item_ids: [ITEM_B] })
    assert.strictEqual(blockedSibling.error, 'item_not_cancellable')
    assert.strictEqual(h.risCalls.length, 1)
  }

  /* หลังยกเลิก subset แรกแล้ว ยกเลิก subset ที่สองด้วยเหตุผลใหม่ได้
     และ history ต้องเก็บ audit ของ subset แรกไว้ */
  {
    const h = makeHarness()
    const first = await cancel(h, { item_ids: [ITEM_A], cancel_reason: 'เหตุผล A' })
    assert.strictEqual(first.success, true, first.message)
    assert.strictEqual(h.items.get(ITEM_B).current_status, 'sent')
    const oldClient = await Process({ action: 'cancel_order', order_id: ORDER,
      cancel_reason: 'เหตุผลเดิม' }, radiologyUser, h.app)
    assert.strictEqual(oldClient.error, 'invalid_item_ids',
      'an old client cannot silently cancel the remaining sibling using the first item reason')
    const second = await cancel(h, { item_ids: [ITEM_B], cancel_reason: 'เหตุผล B' })
    assert.strictEqual(second.success, true, second.message)
    assert.strictEqual(h.items.get(ITEM_A).cancel_reason, 'เหตุผล A')
    assert.strictEqual(h.items.get(ITEM_B).cancel_reason, 'เหตุผล B')
    const audit = h.cancellations.get(ORDER)
    assert.deepStrictEqual(audit.item_ids, [ITEM_B])
    assert.deepStrictEqual(audit.history[0].item_ids, [ITEM_A])
    assert.strictEqual(audit.history[0].cancel_reason, 'เหตุผล A')
  }

  /* รายการที่เลือกยังไม่มี Accession: HIS-only แม้ sibling มีผลอ่านแล้ว */
  {
    const h = makeHarness({
      items: [
        { _id: ITEM_A, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
          current_status: 'sent', item_code: 'RD015' },
        { _id: ITEM_B, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
          current_status: 'resulted', item_code: 'RD016', accession_no: 'SM20260901DX002' },
      ],
    })
    const out = await cancel(h, { item_ids: [ITEM_A] })
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(h.risCalls.length, 0)
    assert.strictEqual(h.items.get(ITEM_A).current_status, 'cancelled')
    assert.strictEqual(h.items.get(ITEM_B).current_status, 'resulted')
  }

  /* เลือกสอง Accession ในคำสั่งเดียว: ส่งเฉพาะสอง tombstone และคง sibling */
  {
    const ITEM_C = 'bbbbbbbbbbbbbbbbbbbbbbb4'
    const secondSource = { ...RIS_SOURCE, _id: 'ccccccccccccccccccccccc2',
      AccessionNo: 'SM20260901DX002', ExamUid: 'RD016', ExamName: 'Lateral neck' }
    const h = makeHarness({
      items: [
        { _id: ITEM_A, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
          current_status: 'dispatched', item_code: 'RD015', accession_no: RIS_SOURCE.AccessionNo },
        { _id: ITEM_B, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
          current_status: 'dispatched', item_code: 'RD016', accession_no: secondSource.AccessionNo },
        { _id: ITEM_C, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
          current_status: 'resulted', item_code: 'RD017', accession_no: 'SM20260901CT001' },
      ],
      risOrders: [RIS_SOURCE, secondSource],
    })
    const out = await cancel(h, { item_ids: [ITEM_A, ITEM_B] })
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(out.data.cancelled_item_count, 2)
    assert.deepStrictEqual(h.risCalls.map(call => call.payload.AccessionNo),
      [RIS_SOURCE.AccessionNo, secondSource.AccessionNo])
    assert.strictEqual(h.items.get(ITEM_C).current_status, 'resulted')
  }

  /* ไม่มี selection / ID ปนใบอื่นต้องหยุดก่อนส่งหรือเขียน */
  {
    const h = makeHarness()
    const omitted = await Process({ action: 'cancel_order', order_id: ORDER,
      cancel_reason: 'แพทย์ยกเลิกคำสั่ง' }, radiologyUser, h.app)
    assert.strictEqual(omitted.error, 'invalid_item_ids')
    assert.strictEqual((await cancel(h, { item_ids: [] })).error, 'invalid_item_ids')
    assert.strictEqual((await cancel(h, { item_ids: [OTHER_ORDER] })).error, 'item_order_mismatch')
    assert.strictEqual(h.cancellations.size, 0)
    assert.strictEqual(h.risCalls.length, 0)
  }

  /* ── API Order รับไว้แล้ว แม้ Envision 401: HIS ยกเลิกได้ตามขอบเขตที่ยืนยัน 09-18 ── */
  {
    const h = makeHarness({
      items: [
        { _id: ITEM_A, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
          current_status: 'dispatched', item_code: 'RD015', accession_no: RIS_SOURCE.AccessionNo },
        { _id: ITEM_B, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
          current_status: 'completed', item_code: 'RD016', accession_no: 'SM20260901DX002' },
      ],
      risOrders: [RIS_SOURCE],
      risReplies: [{ AcknowledgementCode: 'AE', AccessionNo: RIS_SOURCE.AccessionNo,
        LocalSaved: true, ForwardHttpStatus: 401,
        TextMessage: 'Order saved locally, but forwarding failed' }],
    })
    const out = await cancel(h, { item_ids: [ITEM_A] })
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(out.data.upstream_delivery_issue, true)
    assert(out.message.includes('HTTP 401'), out.message)
    assert.strictEqual(h.risCalls.length, 1)
    assert.strictEqual(h.risCalls[0].payload.IsDeleted, true)
    assert.strictEqual(h.risCalls[0].payload.AccessionNo, RIS_SOURCE.AccessionNo)
    assert.strictEqual(h.items.get(ITEM_A).current_status, 'cancelled')
    assert.strictEqual(h.items.get(ITEM_B).current_status, 'completed')
    assert.strictEqual(h.cancellations.get(ORDER).cancel_status, 'applied')
    assert.strictEqual(h.cancellations.get(ORDER).ris_cancel.status, 'accepted_local')
    assert.strictEqual(h.cancellations.get(ORDER).ris_cancel.items[0].forward_http_status, 401)
    const again = await cancel(h, { item_ids: [ITEM_A] })
    assert.strictEqual(again.success, true)
    assert.strictEqual(h.risCalls.length, 1, 'confirmed local request must not be resent by HIS')
  }

  /* Process ไม่ยืนยันว่าเก็บจริง หรือยืนยัน Accession ผิด: ยังไม่ยกเลิก HIS */
  for (const reply of [
    { AcknowledgementCode: 'AE', AccessionNo: RIS_SOURCE.AccessionNo, LocalSaved: false,
      ForwardHttpStatus: 401 },
    { AcknowledgementCode: 'AE', AccessionNo: 'OTHER-ACCESSION', LocalSaved: true,
      ForwardHttpStatus: 401 },
  ]) {
    const h = makeHarness({
      items: [{ _id: ITEM_A, xrstatx: 1, order_ref_id: ORDER,
        service_type: { value: 'xray' }, current_status: 'dispatched',
        item_code: 'RD015', accession_no: RIS_SOURCE.AccessionNo }],
      risOrders: [RIS_SOURCE], risReplies: [reply],
    })
    const out = await cancel(h)
    assert.strictEqual(out.success, false)
    assert.strictEqual(h.items.get(ITEM_A).current_status, 'dispatched')
  }

  /* ── API Order ไม่รับคำขอ = HIS ไม่ยกเลิก; กดซ้ำด้วย Accession เดิมได้ ─ */
  {
    const h = makeHarness({
      items: [{ _id: ITEM_A, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
        current_status: 'dispatched', item_code: 'RD015', accession_no: RIS_SOURCE.AccessionNo }],
      risOrders: [RIS_SOURCE],
      risReplies: [
        { AcknowledgementCode: 'AE', ForwardHttpStatus: 503 },
        { AcknowledgementCode: 'AA', ForwardHttpStatus: 200,
          ForwardResponse: { AcknowledgementCode: 'AA', AccessionNo: RIS_SOURCE.AccessionNo } },
      ],
    })
    const first = await cancel(h)
    assert.strictEqual(first.success, false)
    assert.strictEqual(first.error, 'ris_cancel_failed')
    assert.strictEqual(h.items.get(ITEM_A).current_status, 'dispatched')
    assert.strictEqual(h.cancellations.get(ORDER).cancel_status, 'ris_pending')
    assert.strictEqual(h.cancellations.get(ORDER).ris_cancel.status, 'failed')
    const second = await cancel(h)
    assert.strictEqual(second.success, true, second.message)
    assert.strictEqual(h.risCalls.length, 2)
    assert.deepStrictEqual(h.risCalls[0].payload, h.risCalls[1].payload)
    assert.strictEqual(h.cancellations.get(ORDER).ris_cancel.attempts, 2)
    assert.strictEqual(h.items.get(ITEM_A).current_status, 'cancelled')
  }

  /* ── HTTP 200 แต่ไม่มี ACK และไม่ยืนยัน local save ยังไม่ถือว่าสำเร็จ ─ */
  {
    const h = makeHarness({
      items: [{ _id: ITEM_A, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
        current_status: 'dispatched', item_code: 'RD015', accession_no: RIS_SOURCE.AccessionNo }],
      risOrders: [RIS_SOURCE],
      risReplies: [{ AcknowledgementCode: 'AA', ForwardHttpStatus: 200, ForwardResponse: {} }],
    })
    const out = await cancel(h)
    assert.strictEqual(out.success, false)
    assert.strictEqual(out.error, 'ris_cancel_failed')
    assert.strictEqual(h.items.get(ITEM_A).current_status, 'dispatched')
  }

  /* ── RIS มีผลอ่านแล้วแต่ CPOE status ยัง dispatched: server ต้องกันเอง ─── */
  {
    const h = makeHarness({
      items: [{ _id: ITEM_A, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
        current_status: 'dispatched', item_code: 'RD015', accession_no: RIS_SOURCE.AccessionNo }],
      risOrders: [RIS_SOURCE],
      risResults: [{ AccessionNo: RIS_SOURCE.AccessionNo, ResultText: 'Final report', xrstatx: 1 }],
    })
    const out = await cancel(h)
    assert.strictEqual(out.success, false)
    assert.strictEqual(out.error, 'item_not_cancellable')
    assert.strictEqual(h.risCalls.length, 0)
    assert.strictEqual(h.cancellations.size, 0)
  }

  /* ── Accession ชนกับ JSON ของ Exam อื่น ห้ามส่ง tombstone ผิดใบ ──────── */
  {
    const h = makeHarness({
      items: [{ _id: ITEM_A, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
        current_status: 'dispatched', item_code: 'RD015', accession_no: RIS_SOURCE.AccessionNo }],
      risOrders: [{ ...RIS_SOURCE, ExamUid: 'OTHER-EXAM' }],
    })
    const out = await cancel(h)
    assert.strictEqual(out.error, 'ris_cancel_order_mismatch')
    assert.strictEqual(h.risCalls.length, 0)
    assert.strictEqual(h.items.get(ITEM_A).current_status, 'dispatched')
  }

  /* ── หลายรายการ: RIS ยืนยันไม่ครบ ห้ามเปลี่ยน CPOE ครึ่งใบ ──────────── */
  {
    const secondSource = { ...RIS_SOURCE, _id: 'ccccccccccccccccccccccc2',
      AccessionNo: 'SM20260901DX002', ExamUid: 'RD016', ExamName: 'Lateral neck' }
    const h = makeHarness({
      items: [
        { _id: ITEM_A, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
          current_status: 'dispatched', item_code: 'RD015', accession_no: RIS_SOURCE.AccessionNo },
        { _id: ITEM_B, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
          current_status: 'dispatched', item_code: 'RD016', accession_no: secondSource.AccessionNo },
      ],
      risOrders: [RIS_SOURCE, secondSource],
      risReplies: [
        { AcknowledgementCode: 'AA', ForwardHttpStatus: 200,
          ForwardResponse: { AcknowledgementCode: 'AA', AccessionNo: RIS_SOURCE.AccessionNo } },
        { AcknowledgementCode: 'AA', ForwardHttpStatus: 200,
          ForwardResponse: { AcknowledgementCode: 'AR', AccessionNo: secondSource.AccessionNo } },
      ],
    })
    const first = await cancel(h)
    assert.strictEqual(first.success, false)
    assert.strictEqual(h.items.get(ITEM_A).current_status, 'dispatched')
    assert.strictEqual(h.items.get(ITEM_B).current_status, 'dispatched')
    assert.strictEqual(h.cancellations.get(ORDER).cancel_status, 'ris_pending')
    const retry = await cancel(h)
    assert.strictEqual(retry.success, true, retry.message)
    assert.strictEqual(h.risCalls.length, 4, 'retry sends the same two Accession tombstones')
    assert.strictEqual(h.items.get(ITEM_A).current_status, 'cancelled')
    assert.strictEqual(h.items.get(ITEM_B).current_status, 'cancelled')
  }

  /* ── ระหว่างรอ RIS ห้าม dispatch ส่ง IsDeleted:false ไปฟื้นใบ ───────── */
  {
    const h = makeHarness({
      items: [{ _id: ITEM_A, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
        current_status: 'dispatched', item_code: 'RD015', accession_no: RIS_SOURCE.AccessionNo }],
      risOrders: [RIS_SOURCE],
      risReplies: [{ AcknowledgementCode: 'AE', ForwardHttpStatus: 503 }],
    })
    await cancel(h)
    const baseCollection = h.app.db.collection
    h.app.db.collection = name => name === 'zdata_master_item_order'
      ? { findOne: async () => null }
      : baseCollection(name)
    const out = await Dispatch.call({}, { order_id: ORDER, item_id: ITEM_A }, radiologyUser, h.app)
    assert.strictEqual(out.success, false)
    assert(out.message.includes('กำลังยกเลิก'), out.message)
    assert.strictEqual(h.risCalls.length, 1, 'dispatch must not send another normal Order')
  }

  /* pending ของ item A ห้ามบล็อกการส่ง item B ซึ่งไม่ได้เลือก */
  {
    const h = makeHarness({
      items: [
        { _id: ITEM_A, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
          current_status: 'dispatched', item_code: 'RD015', accession_no: RIS_SOURCE.AccessionNo },
        { _id: ITEM_B, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
          current_status: 'sent', item_code: 'RD016' },
      ],
      risOrders: [RIS_SOURCE],
      risReplies: [{ AcknowledgementCode: 'AE', ForwardHttpStatus: 503 }],
    })
    assert.strictEqual((await cancel(h, { item_ids: [ITEM_A] })).error, 'ris_cancel_failed')
    const baseCollection = h.app.db.collection
    h.app.db.collection = name => name === 'zdata_master_item_order'
      ? { findOne: async () => null } : baseCollection(name)
    const blocked = await Dispatch.call({}, { order_id: ORDER, item_id: ITEM_A }, radiologyUser, h.app)
    assert(blocked.message.includes('กำลังยกเลิก'), blocked.message)
    const sibling = await Dispatch.call({}, { order_id: ORDER, item_id: ITEM_B }, radiologyUser, h.app)
    assert(!sibling.message.includes('กำลังยกเลิก'), sibling.message)
  }

  /* ── ออกผลแล้ว = ยกเลิกไม่ได้ ───────────────────────────────────────── */
  {
    const h = makeHarness({
      items: [
        { _id: ITEM_A, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
          current_status: 'resulted', item_code: 'RD015' },
      ],
    })
    const out = await cancel(h)
    assert.strictEqual(out.success, false)
    assert.strictEqual(out.error, 'item_not_cancellable')
    assert(out.message.includes('ออกผลอ่านไปแล้ว'), out.message)
    assert.strictEqual(h.items.get(ITEM_A).current_status, 'resulted')
  }

  /* ── รายการที่ปฏิเสธไปแล้ว ข้ามไป ไม่บล็อกทั้งใบ ────────────────────── */
  {
    const h = makeHarness({
      items: [
        { _id: ITEM_A, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
          current_status: 'rejected', item_code: 'RD015' },
        { _id: ITEM_B, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
          current_status: 'sent', item_code: 'RD016' },
      ],
    })
    const out = await cancel(h)
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(out.data.cancelled_item_count, 1)
    assert.strictEqual(out.data.preserved_terminal_item_count, 1)
    assert.strictEqual(h.items.get(ITEM_A).current_status, 'rejected', 'a rejected item keeps its own reason')
    assert.strictEqual(h.items.get(ITEM_B).current_status, 'cancelled')
  }

  /* ── รายการที่รับเข้าห้องแล้วแต่ยังไม่มีเลข ยังยกเลิกได้ ─────────────── */
  {
    for (const status of ['accepted', 'prepared', 'ready', 'dispensed', 'dispatched', 'in_progress']) {
      const h = makeHarness({
        items: [{ _id: ITEM_A, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'xray' },
          current_status: status, item_code: 'RD015' }],
      })
      const out = await cancel(h)
      assert.strictEqual(out.success, true, status + ' with no accession must be cancellable: ' + out.message)
      assert.strictEqual(h.items.get(ITEM_A).current_status, 'cancelled')
    }
  }

  /* ── สถานะเปลี่ยนระหว่างยกเลิก = หยุดและบันทึก conflict ─────────────── */
  {
    const h = makeHarness({ raceOn: ITEM_B })
    const out = await cancel(h)
    assert.strictEqual(out.success, false)
    assert.strictEqual(out.error, 'cancel_race_lost')
    assert.strictEqual(h.cancellations.get(ORDER).cancel_status, 'conflict')
    assert.strictEqual(h.cancellations.get(ORDER).conflict_item_id, ITEM_B)

    /* เคย conflict แล้วต้องไม่ปล่อยให้กดซ้ำเงียบ ๆ ต้องให้คนไปตรวจก่อน */
    const retry = await cancel(h)
    assert.strictEqual(retry.success, false)
    assert.strictEqual(retry.error, 'cancel_conflict')
  }

  /* ── input ที่ไม่ถูกต้อง ─────────────────────────────────────────────── */
  {
    const h = makeHarness()

    const noReason = await cancel(h, { cancel_reason: '   ' })
    assert.strictEqual(noReason.error, 'cancel_reason_missing')

    const longReason = await cancel(h, { cancel_reason: 'x'.repeat(1001) })
    assert.strictEqual(longReason.error, 'cancel_reason_too_long')

    const badId = await cancel(h, { order_id: 'nope' })
    assert.strictEqual(badId.error, 'invalid_order_id')

    const wrongNumber = await cancel(h, { order_number: 'R-OTHER' })
    assert.strictEqual(wrongNumber.error, 'order_number_mismatch')

    const missingOrder = await cancel(h, { order_id: OTHER_ORDER })
    assert.strictEqual(missingOrder.error, 'order_not_found')

    assert.strictEqual(h.items.get(ITEM_A).current_status, 'sent', 'no bad input may change anything')
    assert.strictEqual(h.cancellations.size, 0)
  }

  /* ── ใบที่ไม่มีรายการรังสีเลย ────────────────────────────────────────── */
  {
    const h = makeHarness({
      items: [{ _id: ITEM_LAB, xrstatx: 1, order_ref_id: ORDER, service_type: { value: 'lab' },
        current_status: 'sent', item_code: 'CBC' }],
    })
    const out = await cancel(h)
    assert.strictEqual(out.success, false)
    assert.strictEqual(out.error, 'xray_items_not_found')
  }

  /* ── นอกหน่วยงานรังสี = ยกเลิกไม่ได้ ────────────────────────────────── */
  {
    const h = makeHarness()
    const out = await cancel(h, {}, wardUser)
    assert.strictEqual(out.success, false)
    assert(out.message.includes('ไม่ใช่หน่วยงานรังสี'), out.message)
    assert.strictEqual(h.items.get(ITEM_A).current_status, 'sent')
  }

  console.log('X-ray CPOE cancel order API tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
