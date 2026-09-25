/* test_xray_ris_team_apis.js — คุมสัญญาของ Process ฝั่งทีม RIS
 *
 * ก่อนหน้านี้ไฟล์ของทีมสามตัวนี้ไม่มีเทสคุมเลย ทั้งที่เป็นทางเข้า/ออกของข้อมูลคลินิก
 * เทสนี้เขียนพร้อมกับการแก้ 2026-09-07 (ผู้ใช้สั่ง "แก้จริงตามเราให้ทำงานได้")
 * และล็อกทั้ง **สิ่งที่แก้** และ **สิ่งที่ต้องเหมือนเดิม**
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../../..')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const load = relative => new AsyncFunction(
  'params', 'userInfo', 'app',
  fs.readFileSync(path.join(ROOT, relative), 'utf8'),
)

const Order = load('Form-Builder/API/api-factory/xray_api_order.js')
const Schedule = load('Form-Builder/API/api-factory/processes/xray-api-ris-schedule.js')
const ResultReset = load('Form-Builder/API/api-factory/processes/xray_resultreset.js')
const Result = load('Form-Builder/API/api-factory/processes/xray-api-ris-result.js')

const userInfo = { roles: ['auth'], username: 'ris-test' }

/* app ปลอม — เก็บทุกการเขียนไว้ตรวจ · `existing` = แถวที่ sdformGetOne จะเจอ
   `findRows` = ผลของ dbFindAll (ตั้ง null เพื่อจำลอง runtime ที่ไม่มี dbFindAll) */
const makeApp = ({ existing = null, findRows = [], noFindAll = false } = {}) => {
  const writes = []
  const app = {
    dbObjectId: id => String(id),
    sdformGetOne: async () => (existing
      ? { success: true, data: existing }
      : { success: false, data: null }),
    dbInsert: async (data, table) => {
      writes.push({ op: 'insert', table, data })
      return { success: true, reply: { data: { ...data, _id: 'NEW-ID' } } }
    },
    dbUpdate: async (data, table, _user, filter) => {
      writes.push({ op: 'update', table, data, filter })
      return { success: true, reply: { data } }
    },
    wsSend: () => {},
  }
  if (!noFindAll) {
    app.dbFindAll = async provider => {
      writes.push({ op: 'find', from: provider.from, nosql: provider.nosql })
      return { success: true, reply: { data: findRows } }
    }
  }
  return { app, writes }
}

const orderInput = extra => ({
  Hn: '6900001',
  PatientFName: 'ทดสอบ',
  PatientGender: 'F',
  PatientDob: '2018-07-19',
  PatientClassUid: 'O',
  VisitNo: 'VN-1',
  AccessionNo: 'CX2609070001',
  ExamUid: 'EX-1',
  ExamName: 'Chest PA',
  ...extra,
})

const scheduleInput = extra => ({
  AccessionNo: 'CX2609070001',
  Hn: '6900001',
  PatientFName: 'ทดสอบ',
  PatientGender: 'F',
  PatientDob: '2018-07-19',
  PatientClassUid: 'O',
  VisitNo: 'VN-1',
  StartDateTime: '2026-09-08 09:00:00',
  EndDateTime: '2026-09-08 09:30:00',
  ModalityUid: 'MOD-1',
  ExamUid: 'EX-1',
  ExamName: 'Chest PA',
  ...extra,
})

const resetInput = extra => ({
  Hn: '6900001',
  AccessionNo: 'CX2609070001',
  ExamUid: 'EX-1',
  ExamName: 'Chest PA',
  RadiologistUid: 'RAD-1',
  ...extra,
})

const run = async () => {
  /* ══════════ xray_api_order ══════════ */

  // ── เหมือนเดิม: ack shape · required · enum ───────────────────────────────
  {
    const { app } = makeApp()
    const out = await Order({ params: {} }, userInfo, app)
    assert.strictEqual(out.AcknowledgementCode, 'AE')
    assert(out.TextMessage.includes('Missing required field(s)'))
    assert(out.TextMessage.includes('Hn'), out.TextMessage)
  }
  {
    const { app } = makeApp()
    const out = await Order({ params: orderInput({ PatientGender: 'X' }) }, userInfo, app)
    assert.strictEqual(out.AcknowledgementCode, 'AE')
    assert.strictEqual(out.TextMessage, 'PatientGender must be M, F, or U')
  }
  {
    // แกะ wrapper หลายชั้น + คีย์แบบ params[Field] ต้องยังทำงานเหมือนเดิม
    const { app, writes } = makeApp()
    const flat = {}
    Object.entries(orderInput()).forEach(([k, v]) => { flat[`params[${k}]`] = v })
    const out = await Order(flat, userInfo, app)
    assert.strictEqual(out.AcknowledgementCode, 'AA', out.TextMessage)
    assert.strictEqual(writes.find(w => w.op === 'insert').data.Hn, '6900001')
  }

  // ── insert ใหม่: xrstatx = 1 และ IsDeleted ตั้งต้น false (เหมือนเดิม) ──────
  {
    const { app, writes } = makeApp()
    const out = await Order({ params: orderInput() }, userInfo, app)
    assert.strictEqual(out.AcknowledgementCode, 'AA')
    assert.strictEqual(out.Operation, 'insert')
    const insert = writes.find(w => w.op === 'insert')
    assert.strictEqual(insert.table, 'zdata_xray_order')
    assert.strictEqual(insert.data.xrstatx, 1, 'แถวใหม่ยังต้องตั้ง xrstatx = 1')
    assert.strictEqual(insert.data.IsDeleted, false, 'แถวใหม่ยังตั้งต้น IsDeleted = false')
  }

  /* ── 🔴 แก้ 2026-09-07: update ที่ไม่ได้ส่ง IsDeleted ต้องไม่แตะค่าเดิม ──
     เดิมเขียน false ทับเสมอ ⇒ ใบที่ยกเลิกแล้วฟื้นคืนเงียบ ๆ */
  {
    const existing = { _id: 'ORDER-1', AccessionNo: 'CX2609070001', IsDeleted: true, xrstatx: 1 }
    const { app, writes } = makeApp({ existing })
    const out = await Order({ params: orderInput() }, userInfo, app)
    assert.strictEqual(out.Operation, 'update')
    const update = writes.find(w => w.op === 'update')
    assert.strictEqual('IsDeleted' in update.data, false,
      'ไม่ส่ง IsDeleted มา ⇒ ห้ามเขียนทับ ไม่งั้นใบที่ยกเลิกแล้วจะฟื้น')
    assert.strictEqual('xrstatx' in update.data, false,
      'update ห้ามตั้ง xrstatx ⇒ ไม่ปลุกแถวที่ถูกลบไปแล้ว')
    assert.deepStrictEqual(update.filter, { _id: 'ORDER-1' })
  }

  // ── ส่ง IsDeleted มา ต้อง normalize เหมือนเดิมทุกรูปแบบ ───────────────────
  for (const [raw, expected] of [[true, true], [1, true], ['true', true], ['TRUE', true],
    [false, false], [0, false], ['false', false], ['', false]]) {
    const existing = { _id: 'ORDER-1', AccessionNo: 'CX2609070001', xrstatx: 1 }
    const { app, writes } = makeApp({ existing })
    await Order({ params: orderInput({ IsDeleted: raw }) }, userInfo, app)
    assert.strictEqual(writes.find(w => w.op === 'update').data.IsDeleted, expected,
      `IsDeleted=${JSON.stringify(raw)} ต้องได้ ${expected}`)
  }

  // ยกเลิกใบด้วย IsDeleted:true แล้วส่ง update ตามมา ใบต้องยังยกเลิกอยู่
  {
    const existing = { _id: 'ORDER-1', AccessionNo: 'CX2609070001', IsDeleted: true, xrstatx: 1 }
    const { app, writes } = makeApp({ existing })
    await Order({ params: orderInput({ ExamName: 'Chest PA (แก้ชื่อ)' }) }, userInfo, app)
    const update = writes.find(w => w.op === 'update')
    assert.strictEqual(update.data.ExamName, 'Chest PA (แก้ชื่อ)', 'ยังแก้ฟิลด์อื่นได้ตามปกติ')
    assert.strictEqual('IsDeleted' in update.data, false, 'ใบต้องยังยกเลิกอยู่')
  }

  /* ══════════ xray-api-ris-schedule ══════════ */

  /* ── 🔴 แก้ 2026-09-07: ไม่บังคับ PatientSsn / AdmissionNo อีกต่อไป ──
     ผู้ป่วยนอกไม่มี AdmissionNo ⇒ เดิมนัด OPD ไม่ได้เลย */
  {
    const { app, writes } = makeApp()
    const out = await Schedule({ params: scheduleInput() }, userInfo, app)
    assert.strictEqual(out.AcknowledgementCode, 'AA', out.TextMessage)
    assert.strictEqual(out.Operation, 'insert')
    assert.strictEqual(writes.find(w => w.op === 'insert').table, 'zdata_xray_schedule')
  }
  {
    // required ที่เหลือยังบังคับอยู่ครบ
    const { app } = makeApp()
    const input = scheduleInput()
    delete input.StartDateTime
    const out = await Schedule({ params: input }, userInfo, app)
    assert.strictEqual(out.AcknowledgementCode, 'AE')
    assert(out.TextMessage.includes('StartDateTime'), out.TextMessage)
  }
  {
    // ส่ง PatientSsn มาผิดรูปแบบ ยังต้องถูกปฏิเสธเหมือนเดิม
    const { app } = makeApp()
    const out = await Schedule({ params: scheduleInput({ PatientSsn: '123' }) }, userInfo, app)
    assert.strictEqual(out.AcknowledgementCode, 'AE')
    assert.strictEqual(out.TextMessage, 'PatientSsn must contain 13 digits')
  }
  {
    // ส่งมาถูกรูปแบบก็ต้องผ่าน
    const { app } = makeApp()
    const out = await Schedule({ params: scheduleInput({ PatientSsn: '1234567890123' }) }, userInfo, app)
    assert.strictEqual(out.AcknowledgementCode, 'AA', out.TextMessage)
  }
  {
    // enum เดิมยังคุมอยู่
    const { app } = makeApp()
    const out = await Schedule({ params: scheduleInput({ PatientClassUid: 'Z' }) }, userInfo, app)
    assert.strictEqual(out.AcknowledgementCode, 'AE')
    assert.strictEqual(out.TextMessage, 'PatientClassUid must be O, I, or E')
  }
  {
    // IsDeleted / xrstatx กติกาเดียวกับ order
    const existing = { _id: 'SCH-1', AccessionNo: 'CX2609070001', IsDeleted: true, xrstatx: 1 }
    const { app, writes } = makeApp({ existing })
    await Schedule({ params: scheduleInput() }, userInfo, app)
    const update = writes.find(w => w.op === 'update')
    assert.strictEqual('IsDeleted' in update.data, false)
    assert.strictEqual('xrstatx' in update.data, false)
  }

  /* ══════════ xray_resultreset ══════════ */

  /* ── 🔴 แก้ 2026-09-07: ต้องถอน "ฉบับล่าสุด" ไม่ใช่ฉบับไหนก็ได้ ──
     xray-api-ris-result insert ใหม่ทุกครั้ง ⇒ หนึ่ง AccessionNo มีได้หลายฉบับ */
  {
    const findRows = [{ _id: 'RESULT-LATEST', AccessionNo: 'CX2609070001', ResultDateTime: '2026-09-07 10:00:00' }]
    const { app, writes } = makeApp({
      existing: { _id: 'RESULT-OLDEST', AccessionNo: 'CX2609070001' },
      findRows,
    })
    const out = await ResultReset({ params: resetInput() }, userInfo, app)
    assert.strictEqual(out.AcknowledgementCode, 'AA', out.TextMessage)

    const find = writes.find(w => w.op === 'find')
    assert(find, 'ต้องค้นหาแถวผลอ่านเอง ไม่พึ่ง sdformGetOne อย่างเดียว')
    assert.strictEqual(find.from, 'zdata_xray_result')
    assert.deepStrictEqual(find.nosql.query, {
      AccessionNo: 'CX2609070001',
      xrstatx: { $nin: [0, 3] },
    }, 'ต้องกรองแถวที่ถูกลบออก')
    assert.deepStrictEqual(find.nosql.sort, { ResultDateTime: -1, xupdatx: -1, _id: -1 },
      'ลำดับต้องตรงกับที่หน้าจอเราใช้เลือกผลล่าสุด')
    assert.strictEqual(find.nosql.limit, 1)

    const update = writes.find(w => w.op === 'update')
    assert.strictEqual(update.table, 'zdata_xray_result')
    assert.deepStrictEqual(update.filter, { _id: 'RESULT-LATEST' },
      'ต้องถอนฉบับล่าสุด ไม่ใช่ฉบับที่ sdformGetOne บังเอิญคืนมา')
    assert.strictEqual(update.data.Status, 'C', 'ยังต้อง set Status = C เหมือนเดิม')
  }

  // ── เหมือนเดิม: บันทึก audit ก่อนเสมอ และเป็นตารางคนละตัว ─────────────────
  {
    const { app, writes } = makeApp({ findRows: [{ _id: 'RESULT-1' }] })
    await ResultReset({ params: resetInput() }, userInfo, app)
    const order = writes.filter(w => w.op === 'insert' || w.op === 'update')
    assert.strictEqual(order[0].op, 'insert')
    assert.strictEqual(order[0].table, 'zdata_xray_resultreset', 'audit ต้องลงก่อน')
    assert.strictEqual(order[0].data.xrstatx, 1)
    assert.strictEqual(order[0].data.Status, 'C')
    assert.strictEqual(order[1].op, 'update')
    assert.strictEqual(order[1].table, 'zdata_xray_result')
  }

  // ── ไม่มีผลอ่านของ accession นี้ ⇒ AE เหมือนเดิม ─────────────────────────
  {
    const { app } = makeApp({ findRows: [] })
    const out = await ResultReset({ params: resetInput() }, userInfo, app)
    assert.strictEqual(out.AcknowledgementCode, 'AE')
    assert.strictEqual(out.TextMessage, 'no accession_no')
  }

  // ── runtime ที่ไม่มี dbFindAll ⇒ ตกไปใช้ sdformGetOne เหมือนเดิม ──────────
  {
    const { app, writes } = makeApp({
      existing: { _id: 'RESULT-FALLBACK', AccessionNo: 'CX2609070001', xrstatx: 1 },
      noFindAll: true,
    })
    const out = await ResultReset({ params: resetInput() }, userInfo, app)
    assert.strictEqual(out.AcknowledgementCode, 'AA', out.TextMessage)
    assert.deepStrictEqual(writes.find(w => w.op === 'update').filter, { _id: 'RESULT-FALLBACK' })
  }
  {
    // fallback ต้องไม่หยิบแถวที่ถูกลบแล้ว
    const { app } = makeApp({
      existing: { _id: 'RESULT-DELETED', AccessionNo: 'CX2609070001', xrstatx: 3 },
      noFindAll: true,
    })
    const out = await ResultReset({ params: resetInput() }, userInfo, app)
    assert.strictEqual(out.AcknowledgementCode, 'AE')
  }

  // ── required เดิมของ resultreset ยังบังคับครบ ────────────────────────────
  {
    const { app } = makeApp()
    const input = resetInput()
    delete input.RadiologistUid
    const out = await ResultReset({ params: input }, userInfo, app)
    assert.strictEqual(out.AcknowledgementCode, 'AE')
    assert(out.TextMessage.includes('RadiologistUid'), out.TextMessage)
  }

  /* ══════════ xray-api-ris-result — ตั้งใจไม่แก้ ══════════
     ยัง insert ใหม่ทุกครั้ง เพื่อไม่ให้ประวัติผลอ่านหาย · ฝั่งเราเลือกฉบับล่าสุดเอง
     เทสนี้ล็อกไว้ว่าพฤติกรรมนี้ยังเหมือนเดิม ถ้าจะเปลี่ยนเป็น upsert ต้องตั้งใจจริง ๆ */
  {
    const { app, writes } = makeApp({ existing: { _id: 'RESULT-1' } })
    const out = await Result({
      params: {
        AccessionNo: 'CX2609070001', Hn: '6900001', ExamUid: 'EX-1', ExamName: 'Chest PA',
        RadiologistUid: 'RAD-1', ResultText: 'Normal chest', ResultDateTime: '2026-09-07 10:00:00',
      },
    }, userInfo, app)
    assert.strictEqual(out.AcknowledgementCode, 'AA')
    assert.strictEqual(out.TextMessage, 'Result inserted')
    assert.strictEqual(writes.filter(w => w.op === 'update').length, 0, 'ยังไม่ upsert ตามเดิม')
    const insert = writes.find(w => w.op === 'insert')
    assert.strictEqual(insert.table, 'zdata_xray_result')
    assert.strictEqual(insert.data.xrstatx, 1)
  }
  {
    const { app } = makeApp()
    const out = await Result({ params: { Hn: '6900001' } }, userInfo, app)
    assert.strictEqual(out.AcknowledgementCode, 'AE')
    assert.strictEqual(out.TextMessage, 'no accession_no')
  }

  console.log('X-ray RIS team API tests passed')
}

run().catch(error => { console.error(error); process.exit(1) })
