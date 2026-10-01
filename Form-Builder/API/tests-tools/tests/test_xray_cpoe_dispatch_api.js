const assert = require('assert')
const fs = require('fs')
const path = require('path')

const apiBody = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/xray_cpoe_dispatch_api.js'),
  'utf8',
)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const Process = new AsyncFunction('params', 'userInfo', 'app', apiBody)
/* token ถูกเก็บว่างไว้ในรีโปเสมอ · เทสจึงสร้าง Process อีกตัวที่ใส่ token จำลอง
   เพื่อพิสูจน์เส้นทางสำรอง โดยไม่ต้องมี token จริงอยู่ในไฟล์ */
const withToken = token => new AsyncFunction(
  'params', 'userInfo', 'app',
  apiBody.replace("const RIS_ORDER_PUBLIC_TOKEN = ''", "const RIS_ORDER_PUBLIC_TOKEN = '" + token + "'"),
)

/* ── สถานะต้องตรงกันทั้งสามไฟล์ ────────────────────────────────────────────
   worklist กำหนดคำศัพท์ · dispatch/accession ตัดสินใจ · ฟอร์มวาดปุ่ม
   เคยหลุดกัน: API เช็ค 'dispatched' ตรงตัว ฟอร์มเช็คทั้งกลุ่ม ⇒ ติ๊กได้แต่ส่งไม่ได้
   (ผู้ใช้เจอ 2026-09-01) เทสนี้ทำให้หลุดกันอีกไม่ได้ */
{
  const read = rel => fs.readFileSync(path.join(__dirname, rel), 'utf8')
  const worklist = read('../../api-factory/processes/xray_cpoe_worklist_api.js')
  const accession = read('../../api-factory/processes/xray_accession_generate_api.js')
  const formGen = read('../../../seed/tests-tools/scripts/build_xray_cpoe_worklist_ui.js')

  /* ปรับ assertion 2026-09-18: ทีม RIS ผ่อน required เหลือ AccessionNo แล้ว
     แต่ preflight ฝั่งเรายังคุม 9 ฟิลด์เพื่อไม่ส่ง Order คนไข้/Exam ไม่ครบ
     จึงตรวจทั้งสองสัญญาแยกกัน ไม่ลดการป้องกันเดิม */
  const teamApi = read('../../api-factory/xray_api_order.js')
  assert(teamApi.includes("reply('AE', 'AccessionNo is required')"), 'team API must reject missing AccessionNo')
  const oursBlock = apiBody.slice(apiBody.indexOf('const RIS_REQUIRED_FIELDS = ['))
  const ours = oursBlock.slice(oursBlock.indexOf('[') + 1, oursBlock.indexOf(']'))
    .split(',').map(part => part.trim().replace(/^'|'$/g, '')).filter(Boolean)
  assert.deepStrictEqual(ours, [
    'Hn', 'PatientFName', 'PatientGender', 'PatientDob', 'PatientClassUid',
    'VisitNo', 'AccessionNo', 'ExamUid', 'ExamName',
  ], 'HIS preflight must still protect all nine required clinical/order fields')
  ours.forEach(name => assert(
    apiBody.includes(name + ':'),
    'a required field the payload never sets: ' + name,
  ))

  const vocabulary = worklist.slice(worklist.indexOf('const STATUS_VOCABULARY'))
  /* ปรับ assertion 2026-09-18: worklist แยก waiting/pending แทน active เดิม;
     ชุด RECEIVED_STATUSES ต้องยังเท่ากับ pending ทั้งหมด และ sent อยู่ waiting */
  const waitingStatuses = (vocabulary.slice(0, vocabulary.indexOf('}')).match(/^\s*(\w+): 'waiting'/gm) || [])
    .map(line => line.trim().split(':')[0])
  const activeStatuses = (vocabulary.slice(0, vocabulary.indexOf('}')).match(/^\s*(\w+): 'pending'/gm) || [])
    .map(line => line.trim().split(':')[0])
  assert(waitingStatuses.includes('sent'), 'the vocabulary must still contain sent')
  const expected = activeStatuses
  assert(expected.length >= 5, 'unexpectedly small active bucket: ' + expected.join(','))

  const listOf = (source, label) => {
    const line = source.split('\n').find(row => row.includes('RECEIVED_STATUSES = ['))
    assert(line, label + ' must declare RECEIVED_STATUSES')
    return line.slice(line.indexOf('[') + 1, line.indexOf(']')).split(',')
      .map(part => part.trim().replace(/^'|'$/g, '')).filter(Boolean)
  }
  assert.deepStrictEqual(listOf(apiBody, 'dispatch'), expected, 'dispatch drifted from the worklist vocabulary')
  assert.deepStrictEqual(listOf(accession, 'accession'), expected, 'accession drifted from the worklist vocabulary')

  /* ฟอร์มจัดกลุ่มด้วย s.itemState — รายชื่อต้องเป็นชุดเดียวกัน */
  const uiLine = formGen.split('\n').find(row => row.includes("].indexOf(x)>=0)return 'dispatched'"))
  assert(uiLine, 'the form must map the received bucket in s.itemState')
  const uiList = uiLine.slice(uiLine.indexOf('[') + 1, uiLine.indexOf(']')).split(',')
    .map(part => part.trim().replace(/^'|'$/g, '')).filter(Boolean)
  assert.deepStrictEqual(uiList.slice().sort(), expected.slice().sort(), 'the form drifted from the API')
}

const DEPLOYED_PROCESS_ID = '6a967029422c1ca959829edc'
const ACCESSION_PROCESS_ID = '6a95cd58422c1ca959829e8d'
const RIS_ORDER_PROCESS_ID = '6a8f1ef87632d182ef6914fe'

const ids = {
  opd: '111111111111111111111111',
  ipd: '222222222222222222222222',
  done: '333333333333333333333333',
  failed: '444444444444444444444444',
  lab: '555555555555555555555555',
  missing: '000000000000000000000000',
}

/* id ของ item ต้องเป็น 24-hex เหมือนของจริง — API คัดค่าที่ผิดรูปแบบทิ้ง */
const ITEM_1 = 'aaaaaaaaaaaaaaaaaaaaaaa1'
const ITEM_2 = 'aaaaaaaaaaaaaaaaaaaaaaa2'
const ITEM_3 = 'aaaaaaaaaaaaaaaaaaaaaaa3'
const ITEM_MISSING = 'bbbbbbbbbbbbbbbbbbbbbbb9'

const clone = value => JSON.parse(JSON.stringify(value))

const visit = ({ an = '', gender = 'ชาย', dob = '1990-01-01', selectObjects = false } = {}) => ({
  vn: 'VN-0001',
  an,
  gender_text: gender,
  visit_doctor: 'ศิรชัย ปิยะชน',
  visit_clinic: selectObjects ? { value: '19.p', label: '19.p คลินิกวัคซีน' } : 'OPD',
  pid: {
    hn: 'HN-0001',
    prename: selectObjects ? { value: '001', label: 'ด.ช.' } : 'นาย',
    p_fname: 'ทดสอบ',
    p_lname: 'ระบบ',
    birth_date: dob,
  },
})

/* บาง snapshot ของ CPOE ใช้ชื่อฟิลด์อีกชุด — payload ต้องยังเติมได้ครบ */
const altVisit = ({ an = '', dob = '1990-01-01' } = {}) => ({
  visit_no: 'VN-0001',
  an,
  visit_doctor: 'ศิรชัย ปิยะชน',
  visit_clinic: 'OPD',
  pid: { hn: 'HN-0001', title: 'นาย', first_name: 'ทดสอบ', last_name: 'ระบบ', dob, sex: 'ชาย' },
})

const makeHarness = ({
  itemStatus = 'ready',
  accession = '',
  transport = null,
  an = '',
  gender = 'ชาย',
  dob = '1990-01-01',
  serviceType = 'xray',
  ackCode = 'AA',
  ackByExam = {},
  risThrows = false,
  accessionFails = false,
  modality = 'CT',
  extraItem = false,
  thirdItem = false,
  linkAsString = false,
  plainServiceType = false,
  orphanLink = false,
  standalone = false,
  permissionDenied = false,
  publicToken = '',
  httpStatus = 200,
  altPatientKeys = false,
  dobAtVisit = false,
  /* ค่าที่ xray_api_order ส่งกลับมาจากขา Envision (เพิ่ม 2026-09-09) */
  forwardAck = null,
  selectObjects = false,
  cancelStatus = '',
} = {}) => {
  const visitSnapshot = altPatientKeys
    ? altVisit({ an, dob })
    : visit({ an, gender, dob, selectObjects })
  if (dobAtVisit) {
    visitSnapshot.birth_date = dob
    delete visitSnapshot.pid.birth_date
    delete visitSnapshot.pid.dob
  }
  const orders = new Map([
    [ids.opd, { _id: ids.opd, xrstatx: 1, order_number: 'ORD-0001', priority: '1',
      order_comment: 'สงสัยปอดอักเสบ',
      vid: visitSnapshot }],
  ])
  const makeItem = (id, code, name) => {
    const row = {
      _id: id,
      xrstatx: 1,
      order_ref_id: linkAsString ? String(ids.opd) : ids.opd,
      service_type: plainServiceType ? serviceType : { value: serviceType },
      current_status: itemStatus,
      item_code: code,
      item_name: name,
      item_data_id: 'MASTER-1',
      quantity: 1,
    }
    if (accession) row.accession_no = accession
    if (transport) row.transport = transport
    return row
  }
  /* 1 order มีได้หลาย test (ผู้ใช้ยืนยัน 2026-09-01) — harness จึงมีสองรายการเสมอ */
  const item = makeItem(ITEM_1, 'XR-CHEST-PA', 'Chest PA')
  if (orphanLink) item.order_ref_id = 'SOME-OTHER-ORDER'
  const second = makeItem(ITEM_2, 'XR-NECK-LAT', 'Lateral neck')
  const third = makeItem(ITEM_3, 'XR-HAND-BOTH', 'Both hand AP and lateral')
  const itemRows = [[ITEM_1, item]]
  if (extraItem || thirdItem) itemRows.push([ITEM_2, second])
  if (thirdItem) itemRows.push([ITEM_3, third])
  const items = new Map(itemRows)
  const masters = new Map([['MASTER-1', {
    _id: 'MASTER-1', xrstatx: 1, xray_item: { modality: modality, modality_name: 'CT-Computed Tomography' },
  }]])

  const calls = []
  const runProcess = async (id, payload) => {
    calls.push({ id, payload: clone(payload) })
    if (id === ACCESSION_PROCESS_ID) {
      if (accessionFails) return { success: true, reply: { data: { success: false, message: 'รายการนี้ยังไม่มีเครื่องผูกไว้ใน master' } } }
      const row = items.get(payload.item_id)
      const base = payload.item_id === ITEM_3
        ? 'SM20260901CT003'
        : (payload.item_id === ITEM_2 ? 'SM20260901CT002' : 'SM20260901CT001')
      /* ออกเลขให้ item เดิมรอบที่สอง (ส่งตรวจซ้ำ · กติกาใหม่ 2026-09-03) ต้องได้ **เลขใหม่**
         ถ้า fake คืนเลขเดิมทุกครั้ง เทสต์จะผ่านทั้งที่ระบบจริงยังใช้เลขเดิมอยู่
         นับรอบจาก accession_history ที่ Process เพิ่งเขียนไว้ตอนล้างเลขเดิม */
      const round = ((row && Array.isArray(row.accession_history)) ? row.accession_history.length : 0) + 1
      const number = round === 1
        ? base
        : base.replace(/(\d+)$/, digits => String(Number(digits) + 10 * (round - 1)).padStart(digits.length, '0'))
      if (row) row.accession_no = number
      return { success: true, reply: { data: { success: true, data: { accession_no: number } } } }
    }
    if (id === RIS_ORDER_PROCESS_ID) {
      /* แพลตฟอร์มไม่ยอมให้ Process เรียกข้าม Process — เคสที่ต้องมีทางสำรอง */
      if (permissionDenied) return { success: false, permissionDenied: true }
      if (risThrows) throw new Error('socket hang up')
      const itemAck = ackByExam[payload.ExamUid] || ackCode
      return { success: true, reply: { data: {
        AcknowledgementCode: itemAck,
        TextMessage: itemAck === 'AA' ? 'Order created' : 'RIS rejected this exam',
        Operation: itemAck === 'AA' ? 'insert' : null,
        ...(forwardAck || {}),
      } } }
    }
    return null
  }

  const matchesLive = query => row => {
    if (!row) return false
    if (query.current_status && row.current_status !== query.current_status) return false
    return true
  }

  /* จำลอง find ให้ตรงกับที่ API ใช้จริง: $or ระหว่าง order_ref_id กับ xparentx และ $in หลายทรง */
  const matchesLink = (row, query) => {
    if (!query.$or) return true
    return query.$or.some(cond => {
      const [field, rule] = Object.entries(cond)[0]
      const wanted = (rule && rule.$in) || [rule]
      return wanted.some(value => String(row[field]) === String(value))
    })
  }
  const itemCollection = {
    find: query => ({
      toArray: async () => [...items.values()].filter(row => matchesLink(row, query)).map(clone),
    }),
    updateOne: async (query, update) => {
      const row = items.get(query._id)
      if (!matchesLive(query)(row)) return { matchedCount: 0, modifiedCount: 0 }
      Object.assign(row, clone(update.$set || {}))
      /* รองรับ $push เพิ่ม 2026-09-03 — ส่งตรวจซ้ำเก็บเลข Accession เดิมไว้ที่
         accession_history[] ถ้า fake ไม่รองรับ เทสต์จะมองไม่เห็นว่าเลขเดิมถูกเก็บไว้จริง */
      Object.keys(update.$push || {}).forEach(field => {
        if (!Array.isArray(row[field])) row[field] = []
        row[field].push(clone(update.$push[field]))
      })
      return { matchedCount: 1, modifiedCount: 1 }
    },
  }

  /* app.axios คือช่องทาง HTTP จริงของรันไทม์นี้ (ยืนยันจาก lab_agent_order_submit_api.js) */
  const httpCalls = []
  const app = {
    isAuth: () => true,
    curDate: () => '2026-09-01 09:30:00',
    dbObjectId: id => String(id),
    runProcess,
    axios: {
      post: async (url, body) => {
        httpCalls.push({ url, body: clone(body) })
        if (httpStatus !== 200) {
          const error = new Error('Request failed with status code ' + httpStatus)
          error.response = { status: httpStatus, data: null }
          throw error
        }
        return {
          status: 200,
          data: { AcknowledgementCode: 'AA', TextMessage: 'Order created', Operation: 'insert' },
        }
      },
    },
    db: {
      collection: name => ({
        zdata_cpoe_order_item: itemCollection,
        zdata_cpoe_order: { findOne: async query => clone(orders.get(query._id) || null) },
        zdata_master_item_order: { findOne: async query => clone(masters.get(query._id) || null) },
        zdata_xray_order_cancellation: {
          findOne: async () => cancelStatus ? { cancel_status: cancelStatus, xrstatx: 1 } : null,
        },
      })[name],
    },
  }
  /* standalone MongoDB ปฏิเสธ session — ต้องพิสูจน์ว่ามีเส้นทางสำรองจริง
     ข้อความเดียวกับที่ driver โยนออกมา เพราะโค้ดจับด้วยข้อความนี้ */
  const context = {
    mongoTxn: async fn => {
      if (standalone) throw new Error('Transaction numbers are only allowed on a replica set member or mongos')
      return fn({ id: 'mock-session' })
    },
  }
  return { app, context, items, calls, httpCalls }
}

const radiologyUser = { roles: ['auth'], username: 'xray-test', unit: { code: 'm0901' }, account: { name: 'xray-test' } }
const otherUser = { roles: ['auth'], username: 'ward', unit: { code: '19.P' } }

const risCall = h => h.calls.find(call => call.id === RIS_ORDER_PROCESS_ID)

;(async () => {
  /* ── Finance gate เหมือน LAB: sent เลือก/ปฏิเสธได้ แต่ยังรับเข้าไม่ได้ ── */
  {
    const h = makeHarness({ itemStatus: 'sent' })
    const out = await Process.call(h.context, { order_id: ids.opd, item_id: ITEM_1 }, radiologyUser, h.app)
    assert.strictEqual(out.success, false)
    assert.strictEqual(out.error, 'payment_not_ready')
    assert.strictEqual(out.message, 'ยังไม่ผ่านการเงิน')
    assert.strictEqual(h.calls.length, 0, 'Finance must fail before accession generation and RIS transport')
    assert.strictEqual(h.items.get(ITEM_1).current_status, 'sent')
    assert.strictEqual(h.items.get(ITEM_1).accession_no, undefined)
  }

  {
    const h = makeHarness({ extraItem: true })
    h.items.get(ITEM_2).current_status = 'sent'
    const out = await Process.call(
      h.context,
      { order_id: ids.opd, item_ids: [ITEM_1, ITEM_2] },
      radiologyUser,
      h.app,
    )
    assert.strictEqual(out.success, false)
    assert.strictEqual(out.error, 'payment_not_ready')
    assert.strictEqual(h.calls.length, 0, 'a mixed ready/unpaid batch must fail before any accession is issued')
    assert.strictEqual(h.items.get(ITEM_1).current_status, 'ready')
    assert.strictEqual(h.items.get(ITEM_2).current_status, 'sent')
  }

  /* ── ลำดับที่ห้ามสลับ: ออกเลข → รับ → ส่ง RIS ────────────────────────── */
  {
    const h = makeHarness()
    const out = await Process.call(h.context, { order_id: ids.opd }, radiologyUser, h.app)
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(out.accession_no, 'SM20260901CT001')
    assert.strictEqual(out.transport.status, 'ok')

    assert.deepStrictEqual(
      h.calls.map(call => call.id),
      [ACCESSION_PROCESS_ID, RIS_ORDER_PROCESS_ID],
      'accession must be issued before the order reaches RIS',
    )

    const row = h.items.get(ITEM_1)
    assert.strictEqual(row.current_status, 'dispatched')
    assert.strictEqual(row.dispatched_at, '2026-09-01 09:30:00')
    assert.strictEqual(row.transport.status, 'ok')
    assert.strictEqual(row.transport.ack, 'AA')
    assert.strictEqual(row.transport.attempts, 1)
    assert.strictEqual(row.transport_failed, false)
  }

  /* เพิ่ม 2026-09-18: pending cancel กันใบ IsDeleted:false ทับ RIS;
     reopened จากปุ่มตรวจใหม่ยังต้องส่งเข้าเครื่องได้เหมือนเดิม */
  {
    const pending = makeHarness({ cancelStatus: 'ris_pending' })
    const blocked = await Process.call(pending.context, { order_id: ids.opd }, radiologyUser, pending.app)
    assert.strictEqual(blocked.success, false)
    assert(blocked.message.includes('กำลังยกเลิก'), blocked.message)
    assert.strictEqual(pending.calls.length, 0)

    const reopened = makeHarness({ cancelStatus: 'reopened' })
    const out = await Process.call(reopened.context, { order_id: ids.opd }, radiologyUser, reopened.app)
    assert.strictEqual(out.success, true, out.message)
    assert(risCall(reopened), 'reopened order must keep the existing dispatch path')
  }

  /* ── mapping ที่ผู้ใช้ยืนยัน 2026-09-01 ──────────────────────────────── */
  {
    const h = makeHarness({ an: '' })
    await Process.call(h.context, { order_id: ids.opd }, radiologyUser, h.app)
    const sent = risCall(h).payload
    assert.strictEqual(sent.PatientClassUid, 'O', 'no AN ⇒ OPD')
    assert.strictEqual(sent.ExamUid, 'XR-CHEST-PA', 'ExamUid is the CPOE item_code')
    assert.strictEqual(sent.ExamName, 'Chest PA')
    assert.strictEqual(sent.ModalityTypeUid, 'CT', 'ModalityTypeUid is the code, not a RIS uid')
    assert.strictEqual(sent.AccessionNo, 'SM20260901CT001')
    assert.strictEqual(sent.PatientGender, 'M')
    assert.strictEqual(sent.PatientDob, '1990-01-01')
    assert.strictEqual(sent.VisitNo, 'VN-0001')
    assert.strictEqual(sent.Hn, 'HN-0001')
    assert.strictEqual(sent.Status, 'A')
    assert.strictEqual(sent.IsDeleted, false)
    assert.strictEqual(sent.RequestNo, 'ORD-0001')

    /* ฟิลด์ที่ทีมผ่อนเป็น optional — ห้ามส่งค่าปลอมเมื่อไม่มีข้อมูล */
    assert(!('AdmissionNo' in sent), 'OPD must not send an empty or fake AdmissionNo')
    assert(!('PatientSsn' in sent), 'a patient without an id must not get a fake SSN')

    /* ทุกฟิลด์ที่ส่งต้องมีค่า ไม่มีค่าว่างไปรกใบสั่ง */
    Object.entries(sent).forEach(([name, value]) => {
      if (typeof value === 'boolean') return
      assert(value !== '' && value !== null && value !== undefined, name + ' must not be sent empty')
    })
  }

  /* Select object ต้องส่งข้อความ label ไม่ใช่ internal code */
  {
    const h = makeHarness({ selectObjects: true })
    await Process.call(h.context, { order_id: ids.opd }, radiologyUser, h.app)
    const sent = risCall(h).payload
    assert.strictEqual(sent.PatientTitle, 'ด.ช.')
    assert.strictEqual(sent.ReferenceUnitUid, '19.p')
    assert.strictEqual(sent.ReferenceUnitName, '19.p คลินิกวัคซีน')
  }

  /* IPD = มี AN */
  {
    const h = makeHarness({ an: 'AN-0001' })
    await Process.call(h.context, { order_id: ids.opd }, radiologyUser, h.app)
    const sent = risCall(h).payload
    assert.strictEqual(sent.PatientClassUid, 'I', 'an AN ⇒ IPD')
    assert.strictEqual(sent.AdmissionNo, 'AN-0001', 'when an AN exists it is sent')
  }

  /* E ถูกตัดออกตามที่ผู้ใช้สั่ง — ห้ามมีทางไหนสร้างค่า E */
  assert(!/'E'/.test(apiBody.split('buildRisPayload')[1] || ''), 'ER class must not be produced')

  /* เพศและวันเกิด */
  {
    const cases = [
      ['หญิง', 'F'], ['ชาย', 'M'], ['', 'U'], ['ไม่ระบุ', 'U'], ['Female', 'F'],
    ]
    for (const [text, expected] of cases) {
      const h = makeHarness({ gender: text })
      await Process.call(h.context, { order_id: ids.opd }, radiologyUser, h.app)
      assert.strictEqual(risCall(h).payload.PatientGender, expected, 'gender ' + text)
    }
    /* วันเกิดที่เก็บเป็น พ.ศ. ต้องถูกแปลงเป็น ค.ศ. ก่อนส่ง */
    const buddhist = makeHarness({ dob: '2533-01-01' })
    await Process.call(buddhist.context, { order_id: ids.opd }, radiologyUser, buddhist.app)
    assert.strictEqual(risCall(buddhist).payload.PatientDob, '1990-01-01', 'พ.ศ. 2533 ⇒ ค.ศ. 1990')

    /* Order จริงบางใบเก็บวันเกิดที่ vid.birth_date ไม่ได้ซ้ำใต้ vid.pid */
    const visitLevel = makeHarness({ dob: '2019-03-14', dobAtVisit: true })
    await Process.call(visitLevel.context, { order_id: ids.opd }, radiologyUser, visitLevel.app)
    assert.strictEqual(risCall(visitLevel).payload.PatientDob, '2019-03-14')

    /* อ่านวันเกิดไม่ออก = หยุดตั้งแต่ก่อนยิง ไม่ใช่ส่งค่าว่างไปให้ RIS ตอบ AE */
    const unreadable = makeHarness({ dob: 'ไม่ทราบ' })
    const blocked = await Process.call(unreadable.context, { order_id: ids.opd }, radiologyUser, unreadable.app)
    assert.strictEqual(blocked.transport.status, 'failed')
    assert(!risCall(unreadable), 'an unreadable birth date must never be guessed nor sent')
  }

  /* ── RIS ล้มเหลวห้าม rollback การรับ (spec §4.2 ข้อ 5) ───────────────── */
  {
    const h = makeHarness({ ackCode: 'AE' })
    const out = await Process.call(h.context, { order_id: ids.opd }, radiologyUser, h.app)
    assert.strictEqual(out.success, true, 'the receive succeeded — this is a partial success, not a failure')
    assert.strictEqual(out.transport.status, 'failed')
    const row = h.items.get(ITEM_1)
    assert.strictEqual(row.current_status, 'dispatched', 'the receive must stay committed')
    assert.strictEqual(row.accession_no, 'SM20260901CT001', 'the number must not be given back')
    assert.strictEqual(row.transport.status, 'failed')
    assert.strictEqual(row.transport_failed, true)
    assert(out.message.includes('กดส่งใหม่ได้'))
  }

  /* เครือข่ายพังก็เหมือนกัน */
  {
    const h = makeHarness({ risThrows: true })
    const out = await Process.call(h.context, { order_id: ids.opd }, radiologyUser, h.app)
    assert.strictEqual(h.items.get(ITEM_1).current_status, 'dispatched')
    assert.strictEqual(out.transport.status, 'failed')
    assert(out.transport.error.includes('socket hang up'))
  }

  /* ── ยิงซ้ำ: ใช้เลขเดิม ไม่ออกเลขใหม่ ไม่แตะสถานะ ────────────────────── */
  {
    const h = makeHarness({
      itemStatus: 'dispatched',
      accession: 'SM20260901CT001',
      transport: { status: 'failed', attempts: 1, message: 'RIS timeout' },
    })
    const out = await Process.call(h.context, { order_id: ids.opd }, radiologyUser, h.app)
    assert.strictEqual(out.success, true)
    assert.strictEqual(out.accession_no, 'SM20260901CT001')
    assert(!h.calls.some(call => call.id === ACCESSION_PROCESS_ID), 'a retry must never issue a new number')
    assert(risCall(h), 'a retry must resend to RIS')
    assert.strictEqual(risCall(h).payload.AccessionNo, 'SM20260901CT001',
      'the same AccessionNo is what makes the RIS upsert instead of duplicating')
    assert.strictEqual(h.items.get(ITEM_1).transport.attempts, 2, 'attempts must count up')
  }

  /* retry_only ต้องไม่แตะรายการที่ยังไม่เคยส่ง */
  {
    const h = makeHarness({ itemStatus: 'sent' })
    const out = await Process.call(h.context, { order_id: ids.opd, retry_only: true }, radiologyUser, h.app)
    assert.strictEqual(h.calls.length, 0, 'retry_only must not dispatch a fresh item')
    assert.strictEqual(out.transport.status, 'skipped')
  }

  /* ── ส่งตรวจซ้ำ: Order เดิม แต่ **ออกเลข Accession ใหม่** ────────────────
     เปลี่ยนตามคำสั่งผู้ใช้ 2026-09-03 — เดิม (ยืนยัน 2026-09-02) ใช้เลขเดิมซ้ำเพื่อให้
     RIS upsert ทับใบเดิม · ผู้ใช้สั่งให้ล้างเลขเดิมแล้ว gen ใหม่ตอนกดส่งเข้าเครื่อง
     สิ่งที่ assertion เดิมปกป้องยังอยู่ครบ: ไม่สร้าง Order ใหม่ · เวลาส่งเลื่อนเป็นรอบนี้ ·
     ยิง RIS อีกรอบ · นับ attempts ต่อ · และเพิ่มข้อใหม่ว่าเลขเดิมต้องไม่หายไปเฉย ๆ */
  {
    const h = makeHarness({
      itemStatus: 'dispatched',
      accession: 'SM20260901CT001',
      transport: { status: 'ok', attempts: 1 },
    })
    const out = await Process.call(h.context, { order_id: ids.opd, item_id: ITEM_1 }, radiologyUser, h.app)
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(out.accession_no, 'SM20260901CT011', 'a repeat exam gets a fresh accession')
    assert.strictEqual(out.items[0].resent, true)
    assert(out.message.includes('ส่งตรวจซ้ำ'), out.message)

    /* ต้องเรียกตัวออกเลขอีกครั้ง และ RIS ต้องได้ใบของรอบนี้ด้วยเลขใหม่ */
    assert(h.calls.some(call => call.id === ACCESSION_PROCESS_ID), 'a repeat exam issues a new number')
    assert.strictEqual(risCall(h).payload.AccessionNo, 'SM20260901CT011', 'RIS gets this round as its own order')

    const row = h.items.get(ITEM_1)
    assert.strictEqual(row.accession_no, 'SM20260901CT011')
    assert.strictEqual(row.current_status, 'dispatched')
    assert.strictEqual(row.dispatched_at, '2026-09-01 09:30:00', 'the send time moves to this round')
    assert.strictEqual(row.resent_at, '2026-09-01 09:30:00')
    assert.strictEqual(row.transport.attempts, 2)

    /* เลขเดิมห้ามหายไปเฉย ๆ — ผลอ่านรอบก่อนใน zdata_xray_result ยังผูกกับเลขนั้น */
    assert.deepStrictEqual(
      (row.accession_history || []).map(entry => entry.accession_no), ['SM20260901CT001'],
      'the previous accession is kept for traceability',
    )
    assert.strictEqual((row.accession_history || [])[0].reason, 'resend')
    assert.strictEqual(row.accession_cleared_at, '2026-09-01 09:30:00')

    /* Order เดิมและเลข Order เดิมห้ามเปลี่ยน (หัวใจของคำสั่งผู้ใช้ 2026-09-03)
       RequestNo ที่ส่งให้ RIS คือเลข Order — ต้องเป็นใบเดิม ไม่ใช่ใบใหม่ */
    assert.strictEqual(risCall(h).payload.RequestNo, 'ORD-0001', 'the same order number is reused')
    assert.strictEqual(h.calls.filter(call => call.id === ACCESSION_PROCESS_ID)[0].payload.item_id, ITEM_1)
  }

  /* transport ล้มเหลวค้างอยู่ = RIS ยังไม่เคยได้ใบ ⇒ ยังต้องใช้เลขเดิม ห้ามออกเลขใหม่ */
  {
    const h = makeHarness({
      itemStatus: 'dispatched',
      accession: 'SM20260901CT001',
      transport: { status: 'failed', attempts: 1, message: 'RIS timeout' },
    })
    const out = await Process.call(h.context, { order_id: ids.opd, item_id: ITEM_1 }, radiologyUser, h.app)
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(out.accession_no, 'SM20260901CT001', 'a failed send keeps its number')
    assert(!h.calls.some(call => call.id === ACCESSION_PROCESS_ID), 'no new number for a transport retry')
    assert.deepStrictEqual(h.items.get(ITEM_1).accession_history, undefined, 'nothing was cleared')
  }

  /* รายการที่ออกผลแล้วส่งซ้ำได้ และต้องกลับไปเป็น "รอผลอ่าน" ของรอบใหม่ */
  {
    const h = makeHarness({
      itemStatus: 'resulted',
      accession: 'SM20260901CT001',
      transport: { status: 'ok', attempts: 1 },
    })
    const out = await Process.call(h.context, { order_id: ids.opd, item_id: ITEM_1 }, radiologyUser, h.app)
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(
      h.items.get(ITEM_1).current_status, 'dispatched',
      'a repeat exam waits for its own result again',
    )
  }

  /* ยกเลิก/ปฏิเสธไปแล้ว ส่งซ้ำไม่ได้ — ต้องสั่งใหม่จาก CPOE */
  {
    for (const status of ['cancelled', 'rejected', 'returned', 'reversed']) {
      const h = makeHarness({ itemStatus: status, accession: 'SM20260901CT001' })
      const out = await Process.call(h.context, { order_id: ids.opd, item_id: ITEM_1 }, radiologyUser, h.app)
      assert.strictEqual(out.success, false, status + ' must not be resendable')
      assert.strictEqual(h.calls.length, 0)
      assert.strictEqual(h.items.get(ITEM_1).current_status, status)
    }
  }

  /* ── ออกเลขไม่สำเร็จ = ห้ามรับ ห้ามส่ง ──────────────────────────────── */
  {
    const h = makeHarness({ accessionFails: true })
    const out = await Process.call(h.context, { order_id: ids.opd }, radiologyUser, h.app)
    assert.strictEqual(out.success, false)
    assert(!risCall(h), 'nothing may reach RIS without an accession number')
    assert.strictEqual(h.items.get(ITEM_1).current_status, 'ready', 'the item must stay untouched')
    assert(out.message.includes('master'))
  }

  /* ── Batch: 1 Order ส่งหลาย item ในคำขอเดียว (ผู้ใช้เปลี่ยน requirement 2026-09-07) ── */

  /* หลายรายการพร้อมส่งแต่ไม่ได้ระบุมา = ห้ามเดา ห้ามส่งทั้งใบ */
  {
    const h = makeHarness({ extraItem: true })
    const out = await Process.call(h.context, { order_id: ids.opd }, radiologyUser, h.app)
    assert.strictEqual(out.success, false)
    assert(out.message.includes('ระบุ item_ids'), out.message)
    assert.strictEqual(h.calls.length, 0, 'an ambiguous request must not touch anything')
    assert.strictEqual(h.items.get(ITEM_1).current_status, 'ready')
    assert.strictEqual(h.items.get(ITEM_2).current_status, 'ready')
  }

  /* ระบุสามรายการ = ออก accession และส่ง RIS ทีละ flat payload ตามลำดับ */
  {
    const h = makeHarness({ thirdItem: true })
    const requested = [ITEM_3, ITEM_1, ITEM_2]
    const out = await Process.call(h.context, { order_id: ids.opd, item_ids: requested }, radiologyUser, h.app)
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(out.requested, 3)
    assert.strictEqual(out.delivered, 3)
    assert.strictEqual(out.failed, 0)
    assert.strictEqual(out.partial, false)
    assert.deepStrictEqual(out.accession_nos, [
      'SM20260901CT003', 'SM20260901CT001', 'SM20260901CT002',
    ])
    assert.deepStrictEqual(out.items.map(row => row.item_id), requested, 'batch preserves caller order')
    const risCalls = h.calls.filter(call => call.id === RIS_ORDER_PROCESS_ID)
    assert.strictEqual(risCalls.length, 3, 'RIS still receives one flat order per item')
    assert.deepStrictEqual(
      risCalls.map(call => call.payload.ExamUid),
      ['XR-HAND-BOTH', 'XR-CHEST-PA', 'XR-NECK-LAT'],
    )
    risCalls.forEach(call => assert(!Array.isArray(call.payload.items), 'RIS contract must remain flat'))
    requested.forEach(id => assert.strictEqual(h.items.get(id).current_status, 'dispatched'))
    assert(out.message.includes('3/3'), out.message)
  }

  /* RIS ปฏิเสธหนึ่งรายการไม่ rollback รายการก่อนหน้า และรายการถัดไปยังถูกส่ง */
  {
    const h = makeHarness({ thirdItem: true, ackByExam: { 'XR-CHEST-PA': 'AE' } })
    const out = await Process.call(
      h.context,
      { order_id: ids.opd, item_ids: [ITEM_1, ITEM_2, ITEM_3] },
      radiologyUser,
      h.app,
    )
    assert.strictEqual(out.success, true, 'all three were received even though one RIS transport failed')
    assert.strictEqual(out.partial, true)
    assert.strictEqual(out.delivered, 2)
    assert.strictEqual(out.failed, 1)
    assert.strictEqual(out.items[0].ack, 'AE')
    assert.strictEqual(h.calls.filter(call => call.id === RIS_ORDER_PROCESS_ID).length, 3)
    assert.strictEqual(h.items.get(ITEM_1).current_status, 'dispatched', 'failed transport stays received')
    assert.strictEqual(h.items.get(ITEM_2).transport.status, 'ok')
    assert.strictEqual(h.items.get(ITEM_3).transport.status, 'ok')
  }

  /* ถ้ามี id นอก Order ปนมา ต้องหยุดทั้งชุดก่อนออกเลข/เปลี่ยนสถานะ */
  {
    const h = makeHarness({ extraItem: true })
    const out = await Process.call(
      h.context,
      { order_id: ids.opd, item_ids: [ITEM_1, ITEM_MISSING] },
      radiologyUser,
      h.app,
    )
    assert.strictEqual(out.success, false)
    assert(out.message.includes('ยังไม่มีรายการใดถูกส่ง'), out.message)
    assert.deepStrictEqual(out.data.missing_item_ids, [ITEM_MISSING])
    assert.strictEqual(h.calls.length, 0)
    assert.strictEqual(h.items.get(ITEM_1).current_status, 'ready')
    assert.strictEqual(h.items.get(ITEM_2).current_status, 'ready')
  }

  /* ทรงใหม่ item_id เดี่ยว = ทางที่ฟอร์มใช้จริง */
  {
    const h = makeHarness({ extraItem: true })
    const out = await Process.call(h.context, { order_id: ids.opd, item_id: ITEM_1 }, radiologyUser, h.app)
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(out.items.length, 1)
    assert.strictEqual(out.items[0].item_id, ITEM_1)
    assert.strictEqual(out.accession_no, 'SM20260901CT001')
    assert.strictEqual(h.items.get(ITEM_2).current_status, 'ready', 'the other test stays untouched')
    assert.strictEqual(h.items.get(ITEM_2).accession_no, undefined)
  }

  /* กดส่งรายการที่สองต่อในใบเดิม = ได้เลขของตัวเอง คนละใบฝั่ง RIS */
  {
    const h = makeHarness({ extraItem: true })
    await Process.call(h.context, { order_id: ids.opd, item_id: ITEM_1 }, radiologyUser, h.app)
    const out = await Process.call(h.context, { order_id: ids.opd, item_id: ITEM_2 }, radiologyUser, h.app)
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(out.accession_no, 'SM20260901CT002', 'each test gets its own accession')
    const sent = h.calls.filter(call => call.id === RIS_ORDER_PROCESS_ID)
    assert.deepStrictEqual(
      sent.map(call => call.payload.ExamUid),
      ['XR-CHEST-PA', 'XR-NECK-LAT'],
      'one RIS order per test, in the order the user pressed them',
    )
    assert.strictEqual(h.items.get(ITEM_1).current_status, 'dispatched')
    assert.strictEqual(h.items.get(ITEM_2).current_status, 'dispatched')
  }

  /* ── MongoDB standalone: ห้ามล้มเพราะเปิด transaction ไม่ได้ ─────────── */
  {
    const h = makeHarness({ standalone: true })
    const out = await Process.call(h.context, { order_id: ids.opd, item_id: ITEM_1 }, radiologyUser, h.app)
    assert.strictEqual(out.success, true, 'standalone MongoDB must still dispatch: ' + out.message)
    assert.strictEqual(out.accession_no, 'SM20260901CT001')
    const row = h.items.get(ITEM_1)
    assert.strictEqual(row.current_status, 'dispatched', 'the receive still commits without a transaction')
    assert.strictEqual(row.transport.status, 'ok')
  }

  /* ติ๊กเฉพาะรายการเดียว = อีกรายการต้องไม่ถูกแตะเลย */
  {
    const h = makeHarness({ extraItem: true })
    const out = await Process.call(h.context, { order_id: ids.opd, item_ids: [ITEM_2] }, radiologyUser, h.app)
    assert.strictEqual(out.success, true)
    assert.strictEqual(out.items.length, 1)
    assert.strictEqual(out.items[0].item_id, ITEM_2)
    assert.strictEqual(h.items.get(ITEM_2).current_status, 'dispatched')
    assert.strictEqual(h.items.get(ITEM_1).current_status, 'ready', 'an unticked item must stay untouched')
    assert.strictEqual(h.items.get(ITEM_1).accession_no, undefined, 'and must not get a number')
    const sent = h.calls.filter(call => call.id === RIS_ORDER_PROCESS_ID)
    assert.strictEqual(sent.length, 1)
    assert.strictEqual(sent[0].payload.ExamUid, 'XR-NECK-LAT')
  }

  /* id ที่ไม่อยู่ในใบนี้ = บอกให้ชัด ไม่ใช่เงียบว่าไม่มีรายการ */
  {
    const h = makeHarness({ extraItem: true })
    const out = await Process.call(h.context, { order_id: ids.opd, item_ids: [ITEM_MISSING] }, radiologyUser, h.app)
    assert.strictEqual(out.success, false)
    assert(out.message.includes('ไม่พบรายการที่เลือก'))
    assert.strictEqual(h.calls.length, 0)
  }

  /* ติ๊กรายการที่ส่งไปแล้ว = ส่งตรวจซ้ำ ไม่ใช่ปฏิเสธ · อีกรายการต้องไม่ถูกแตะ */
  {
    const h = makeHarness({
      extraItem: true,
      itemStatus: 'dispatched',
      accession: 'SM20260901CT001',
      transport: { status: 'ok', attempts: 1 },
    })
    const out = await Process.call(h.context, { order_id: ids.opd, item_ids: [ITEM_1] }, radiologyUser, h.app)
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(out.items[0].item_id, ITEM_1)
    assert.strictEqual(h.items.get(ITEM_2).dispatch_count, undefined, 'the unticked item stays untouched')
  }

  /* id ที่รูปแบบผิดทั้งหมด = ปฏิเสธ ห้ามตีความว่า "ไม่เลือก" แล้วส่งทั้งใบ */
  {
    const h = makeHarness({ extraItem: true })
    const out = await Process.call(h.context, { order_id: ids.opd, item_ids: ['nope'] }, radiologyUser, h.app)
    assert.strictEqual(out.success, false)
    assert(out.message.includes('item_id'))
    assert.strictEqual(h.calls.length, 0, 'a bad selection must never dispatch the whole order')
  }

  /* id ผิดปนกับ id จริงก็ต้องหยุดทั้ง batch ไม่ใช่ทิ้งค่าผิดแล้วส่งบางรายการ */
  {
    const h = makeHarness({ extraItem: true })
    const out = await Process.call(
      h.context,
      { order_id: ids.opd, item_ids: [ITEM_1, 'nope'] },
      radiologyUser,
      h.app,
    )
    assert.strictEqual(out.success, false)
    assert(out.message.includes('ยังไม่มีรายการใดถูกส่ง'), out.message)
    assert.strictEqual(h.calls.length, 0)
    assert.strictEqual(h.items.get(ITEM_1).current_status, 'ready')
  }

  /* ── การปฏิเสธ ──────────────────────────────────────────────────────── */
  {
    const h = makeHarness()
    /* ทั้งสามหน่วยของกลุ่มรังสีส่งเข้าเครื่องได้ (ผู้ใช้ยืนยันผัง 2026-09-01) */
    for (const code of ['m0900', 'm0901', 'CT']) {
      const scoped = makeHarness()
      const user = { roles: ['auth'], username: 'xray-test', unit: { code }, account: { name: 'xray-test' } }
      const out = await Process.call(scoped.context, { order_id: ids.opd }, user, scoped.app)
      assert.strictEqual(out.success, true, code + ' must be allowed to dispatch')
      assert.strictEqual(
        risCall(scoped).payload.OrganizationUid, code.toUpperCase(),
        'the sending organization travels with the order',
      )
    }

    const wrongOrg = await Process.call(h.context, { order_id: ids.opd }, otherUser, h.app)
    assert.strictEqual(wrongOrg.success, false)
    assert(wrongOrg.message.includes('ไม่ใช่หน่วยงานรังสี'))
    assert.strictEqual(h.calls.length, 0)
    assert.strictEqual(h.items.get(ITEM_1).current_status, 'ready')

    const badId = await Process.call(h.context, { order_id: 'nope' }, radiologyUser, h.app)
    assert.strictEqual(badId.success, false)
    assert(badId.message.includes('order_id'))

    const missing = await Process.call(h.context, { order_id: ids.missing }, radiologyUser, h.app)
    assert.strictEqual(missing.success, false)
    assert(missing.message.includes('ไม่พบ Order'))
  }

  /* รายการ LAB ในใบเดียวกันต้องไม่ถูกส่งเข้า RIS รังสี */
  {
    const h = makeHarness({ serviceType: 'lab' })
    const out = await Process.call(h.context, { order_id: ids.opd }, radiologyUser, h.app)
    assert.strictEqual(out.success, false)
    assert(out.message.includes('ไม่มีรายการทางรังสี'))
    assert.strictEqual(h.calls.length, 0)
  }

  /* ── ทรงข้อมูลที่ต่างกันต้องไม่ทำให้หา item ไม่เจอ ──────────────────────
     worklist join ด้วย $lookup ซึ่งยอมทรงเดียว · dispatch ใช้ find จึงต้องรับทั้งคู่
     เจอจริงตอน UAT 2026-09-01: ปุ่มตอบ "Order นี้ไม่มีรายการทางรังสี" ทั้งที่ worklist เห็น */
  {
    const h = makeHarness({ linkAsString: true })
    const out = await Process.call(h.context, { order_id: ids.opd }, radiologyUser, h.app)
    assert.strictEqual(out.success, true, 'order_ref_id stored as a string must still match')
  }
  {
    const h = makeHarness({ plainServiceType: true })
    const out = await Process.call(h.context, { order_id: ids.opd }, radiologyUser, h.app)
    assert.strictEqual(out.success, true, "service_type stored as a plain string must still match")
  }

  /* หา item ไม่เจอเลย = ต้องบอกว่าลิงก์ผิด ไม่ใช่ "ไม่มีรายการทางรังสี" ลอยๆ */
  {
    const h = makeHarness({ orphanLink: true })
    const out = await Process.call(h.context, { order_id: ids.opd }, radiologyUser, h.app)
    assert.strictEqual(out.success, false)
    assert(out.message.includes('order_ref_id'), 'the message names the field to check')
    assert.strictEqual(out.data.items_found, 0)
  }

  /* เจอ item แต่เป็นของ LAB = บอกว่า service_type เป็นอะไร จะได้ไม่ต้องเดา */
  {
    const h = makeHarness({ serviceType: 'lab' })
    const out = await Process.call(h.context, { order_id: ids.opd }, radiologyUser, h.app)
    assert.strictEqual(out.success, false)
    assert(out.message.includes('service_type'), 'the message names what was seen')
    assert(out.message.includes('lab'))
    assert.deepStrictEqual(out.data.service_types, ['lab'])
  }

  /* ── ค่าคงที่ต้องตรงกับ Process ที่ deploy แล้ว ─────────────────────── */
  assert(
    apiBody.includes('Deployed Process ID: ' + DEPLOYED_PROCESS_ID),
    'the process header must record the deployed Process ID',
  )
  assert(apiBody.includes("const ACCESSION_PROCESS_ID = '" + ACCESSION_PROCESS_ID + "'"))
  assert(apiBody.includes("const RIS_ORDER_PROCESS_ID = '" + RIS_ORDER_PROCESS_ID + "'"))
  assert(apiBody.includes("const XRAY_ORGANIZATION_CODES = ['m0900', 'm0901', 'CT']"), 'scope must match the other two Processes')
  assert(!/eyJhbGciOi/.test(apiBody), 'no token may be embedded')
  /* ผู้ใช้สั่งเพิ่มเส้นทางสำรอง HTTP 2026-09-02 ("แก้ให้ใช้ได้เลย") — URL ของ endpoint
     จึงมีได้ **หนึ่งตัวเท่านั้น** แต่กฎเดิมที่ห้าม token หลุดลงรีโปยังต้องคุมเข้มเหมือนเดิม
     และทางหลักต้องยังเป็น app.runProcess ไม่ใช่ HTTP */
  assert.strictEqual(
    (apiBody.match(/https?:\/\//g) || []).length, 1,
    'exactly one endpoint URL: the RIS public fallback, nothing else',
  )
  assert(
    apiBody.includes("const RIS_PUBLIC_URL = 'https://apihis.softmax-one.com/api/v1/process/public'"),
    'the fallback points at the RIS public endpoint',
  )
  assert(
    apiBody.includes("const RIS_ORDER_PUBLIC_TOKEN = ''"),
    'the token constant must stay empty in the repo — it is filled in API Factory only',
  )
  assert(
    apiBody.indexOf('app.runProcess(RIS_ORDER_PROCESS_ID') < apiBody.indexOf('app.axios.post'),
    'runProcess stays the primary route; HTTP is only the fallback',
  )

  /* ── ซ่อมรายการที่ค้างครึ่งทาง ────────────────────────────────────────
     บั๊ก standalone (2026-09-01) ทิ้งรายการที่ขึ้นว่า "ส่งเครื่องแล้ว" แต่ไม่มีเลข
     และ RIS ไม่เคยเห็น ⇒ กดส่งอีกครั้งต้องทำต่อจนจบ ไม่ใช่บอกว่าส่งไปแล้ว */
  for (const status of ['accepted', 'prepared', 'dispensed', 'dispatched', 'in_progress']) {
    const h = makeHarness({ itemStatus: status })
    const stuck = h.items.get(ITEM_1)
    delete stuck.accession_no
    delete stuck.transport

    const out = await Process.call(h.context, { order_id: ids.opd, item_id: ITEM_1 }, radiologyUser, h.app)
    assert.strictEqual(out.success, true, status + ' with no accession must be repairable: ' + out.message)
    assert.strictEqual(out.accession_no, 'SM20260901CT001')
    assert.strictEqual(out.transport.status, 'ok')
    assert(risCall(h), 'the repaired item must finally reach RIS')
    assert.strictEqual(risCall(h).payload.AccessionNo, 'SM20260901CT001')

    const row = h.items.get(ITEM_1)
    assert.strictEqual(row.current_status, status, 'the repair must not rewind the status')
    assert.strictEqual(row.dispatched_at, undefined, 'and the original receipt stamp is not overwritten')
    assert.strictEqual(row.transport.status, 'ok')
  }

  /* ข้อความปฏิเสธยังต้องบอกสถานะจริง — ใช้รายการที่ยกเลิกไปแล้วเป็นตัวอย่าง */
  {
    const h = makeHarness({
      itemStatus: 'cancelled',
      accession: 'SM20260901CT001',
      transport: { status: 'ok', attempts: 1 },
    })
    const out = await Process.call(h.context, { order_id: ids.opd, item_id: ITEM_1 }, radiologyUser, h.app)
    assert.strictEqual(out.success, false)
    assert(out.message.includes('cancelled'), out.message)
    assert(out.message.includes('SM20260901CT001'), out.message)
    assert.strictEqual(out.data.items[0].current_status, 'cancelled')
    assert.strictEqual(out.data.items[0].transport_status, 'ok')
    assert.strictEqual(h.calls.length, 0)
  }

  /* ── ข้อมูลคนไข้ไม่ครบ = ไม่ยิงเสียเที่ยว บอกเป็นภาษาคนว่าขาดอะไร ────── */
  {
    const h = makeHarness({ dob: '' })
    const out = await Process.call(h.context, { order_id: ids.opd, item_id: ITEM_1 }, radiologyUser, h.app)
    /* รับไว้แล้วจริง (มีเลขแล้ว) แต่ยังไม่ถึง RIS ⇒ partial เหมือนกรณี RIS ปฏิเสธ */
    assert.strictEqual(out.transport.status, 'failed')
    assert(!risCall(h), 'a payload we know RIS will reject must not be sent')
    assert(out.message.includes('วันเกิด'), out.message)
    assert(out.message.includes('PatientDob'), out.message)
    assert.deepStrictEqual(out.items[0].missing_fields, ['PatientDob'])

    /* เลขที่ออกแล้วต้องอยู่ครบ กดใหม่หลังแก้ทะเบียนผู้ป่วยได้เลย */
    const row = h.items.get(ITEM_1)
    assert.strictEqual(row.accession_no, 'SM20260901CT001')
    assert.strictEqual(row.current_status, 'dispatched')
    assert.strictEqual(row.transport.status, 'failed')
    assert.deepStrictEqual(row.transport.missing_fields, ['PatientDob'])
    assert(row.transport.message.includes('วันเกิด'), 'the row carries the real reason, not a generic retry line')
  }

  /* ── วันเกิดที่ HIS เก็บคนละทรง ต้องอ่านออกทุกทรงที่เจอจริง ─────────── */
  {
    const cases = [
      ['1990-01-05', '1990-01-05'],
      ['2533-01-05', '1990-01-05'],
      ['05/01/1990', '1990-01-05'],
      ['05/01/2533', '1990-01-05'],
      ['5/1/2533', '1990-01-05'],
      ['19900105', '1990-01-05'],
      ['1990-01-05T00:00:00', '1990-01-05'],
      ['1990/01/05', '1990-01-05'],
    ]
    for (const [stored, expected] of cases) {
      const h = makeHarness({ dob: stored })
      const out = await Process.call(h.context, { order_id: ids.opd, item_id: ITEM_1 }, radiologyUser, h.app)
      assert.strictEqual(out.success, true, stored + ' must be readable: ' + out.message)
      assert.strictEqual(risCall(h).payload.PatientDob, expected, 'wrong conversion for ' + stored)
    }

    /* อ่านไม่ออกจริง ๆ ห้ามเดา — ต้องหยุดและบอก ไม่ใช่ส่งวันมั่ว */
    for (const bad of ['ไม่ทราบ', '00/00/0000', '1990-13-05', '90-01-05']) {
      const h = makeHarness({ dob: bad })
      const out = await Process.call(h.context, { order_id: ids.opd, item_id: ITEM_1 }, radiologyUser, h.app)
      assert.strictEqual(out.transport.status, 'failed', bad + ' must not be guessed')
      assert(out.items[0].missing_fields.includes('PatientDob'), bad + ' must be reported as a missing birth date')
      assert(!risCall(h), bad + ' must never reach RIS')
    }
  }

  /* ── เส้นทางสำรอง HTTP เมื่อ runProcess ถูกปฏิเสธ (ผู้ใช้สั่ง 2026-09-02) ── */
  {
    /* token ว่าง = สำรองปิด · ต้องบอกให้ชัดว่าต้องไปเติมอะไรที่ไหน ไม่ใช่เงียบ */
    const h = makeHarness({ permissionDenied: true })
    const out = await Process.call(h.context, { order_id: ids.opd, item_id: ITEM_1 }, radiologyUser, h.app)
    assert.strictEqual(out.transport.status, 'failed')
    assert(out.items[0].message.includes('RIS_ORDER_PUBLIC_TOKEN'), out.items[0].message)
    assert(!h.httpCalls.length, 'no HTTP is attempted while the token is empty')
    /* รับไว้แล้วจริง เลขไม่หาย กดส่งซ้ำได้เมื่อเติม token แล้ว */
    assert.strictEqual(h.items.get(ITEM_1).accession_no, 'SM20260901CT001')
    assert.strictEqual(h.items.get(ITEM_1).current_status, 'dispatched')
  }

  {
    /* มี token แล้ว: runProcess ถูกปฏิเสธ ⇒ ตกไปทาง HTTP และต้องสำเร็จได้ */
    const h = makeHarness({ permissionDenied: true, publicToken: 'TEST-TOKEN' })
    const out = await withToken('TEST-TOKEN').call(h.context, { order_id: ids.opd, item_id: ITEM_1 }, radiologyUser, h.app)
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(out.transport.status, 'ok')
    assert.strictEqual(h.httpCalls.length, 1, 'exactly one fallback call')

    const call = h.httpCalls[0]
    assert(call.url.startsWith('https://apihis.softmax-one.com/api/v1/process/public?token='), call.url)
    assert(call.url.includes('TEST-TOKEN'))
    /* gateway ตรวจ property ชื่อ params ก่อนตรวจ token — body ต้องห่อไว้เสมอ */
    assert(call.body && call.body.params, 'the payload must be wrapped in params')
    assert.strictEqual(call.body.params.AccessionNo, 'SM20260901CT001')
    assert.strictEqual(h.items.get(ITEM_1).transport.route, 'public', 'the route is recorded')
  }

  {
    /* ทางหลักผ่าน = ห้ามยิง HTTP ซ้ำ */
    const h = makeHarness({ publicToken: 'TEST-TOKEN' })
    const out = await withToken('TEST-TOKEN').call(h.context, { order_id: ids.opd, item_id: ITEM_1 }, radiologyUser, h.app)
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(h.httpCalls.length, 0, 'the fallback must not fire when runProcess worked')
    assert.strictEqual(h.items.get(ITEM_1).transport.route, 'process')
  }

  {
    /* ทางสำรองก็ล้ม = ต้องรายงานทั้งสองเหตุผล ไม่ใช่กลืนอันแรก */
    const h = makeHarness({ permissionDenied: true, publicToken: 'TEST-TOKEN', httpStatus: 401 })
    const out = await withToken('TEST-TOKEN').call(h.context, { order_id: ids.opd, item_id: ITEM_1 }, radiologyUser, h.app)
    assert.strictEqual(out.transport.status, 'failed')
    const note = out.items[0].message
    assert(note.includes('ไม่มีสิทธิ์เรียก RIS Order API'), note)
    assert(note.includes('401'), note)
  }

  /* ── ฟิลด์บังคับต้องหาเจอแม้ snapshot ใช้ชื่ออื่น ────────────────────── */
  {
    const h = makeHarness({ altPatientKeys: true })
    const out = await Process.call(h.context, { order_id: ids.opd, item_id: ITEM_1 }, radiologyUser, h.app)
    assert.strictEqual(out.success, true, 'alternate field names must still fill the payload: ' + out.message)
    const sent = risCall(h).payload
    assert.strictEqual(sent.PatientFName, 'ทดสอบ')
    assert.strictEqual(sent.PatientLName, 'ระบบ')
    assert.strictEqual(sent.PatientDob, '1990-01-01')
    assert.strictEqual(sent.PatientGender, 'M')
  }

  /* ── ฟิลด์เสริมที่เพิ่มเข้ามา ต้องไม่ทำของเดิมเปลี่ยนความหมาย ────────── */
  {
    const h = makeHarness()
    await Process.call(h.context, { order_id: ids.opd, item_id: ITEM_1 }, radiologyUser, h.app)
    const sent = risCall(h).payload
    assert.strictEqual(sent.ReferenceUnitName, 'OPD', 'แผนกส่งตรวจมาจาก visit')
    assert.strictEqual(sent.MessageControlId, 'XRSM20260901CT001')
    /* หมอมาเป็นข้อความล้วน ⇒ ต้องอยู่ที่ FName ทั้งก้อนเหมือนเดิม ห้ามเดาว่าคำไหนนามสกุล */
    assert.strictEqual(sent.ReferringDoctorFName, 'ศิรชัย ปิยะชน')
    assert(!('ReferringDoctorLName' in sent), 'never guess a surname out of a plain string')
  }

  /* ── ผลของขา API ทีม → Envision (เพิ่ม 2026-09-09) ────────────────────────
     ของเดิมเก็บแค่ AcknowledgementCode/TextMessage ⇒ เวลา forward พังเห็นแค่
     "Order saved locally, but forwarding failed" แยกไม่ออกว่าไปไม่ถึงหรือโดนปฏิเสธ
     (ผู้ใช้เจอจริง 2026-09-09 · Envision ตอบ 401 แต่หน้าจอไม่บอก) */
  {
    /* ถึงแล้วแต่ auth ไม่ผ่าน — ต้องเห็นเลข HTTP และคำใบ้ว่าไปดู credential */
    const h = makeHarness({ ackCode: 'AE', forwardAck: {
      TextMessage: 'Order saved locally, but forwarding failed',
      LocalSaved: true, ForwardHttpStatus: 401, ForwardError: null,
    } })
    const out = await Process.call(h.context, { order_id: ids.opd }, radiologyUser, h.app)
    const row = h.items.get(ITEM_1)
    assert.strictEqual(row.transport.status, 'failed')
    assert.strictEqual(row.transport.forward_http_status, 401, 'the HTTP status must be kept')
    assert.strictEqual(row.transport.local_saved, true, 'a locally saved order must say so')
    assert(row.transport.message.includes('401'), 'the screen message must carry the status')
    assert(row.transport.message.includes('ยืนยันตัวตน'), '401 must be explained, not just numbered')
    assert(out.items[0].message.includes('401'), 'the reply shown to the user carries it too')
  }
  {
    /* ไปไม่ถึงเลย — ต้องบอกคนละอย่างกับกรณีโดนปฏิเสธ */
    const h = makeHarness({ ackCode: 'AE', forwardAck: {
      TextMessage: 'Order saved locally, but forwarding failed',
      LocalSaved: true, ForwardHttpStatus: null, ForwardError: 'ETIMEDOUT',
    } })
    await Process.call(h.context, { order_id: ids.opd }, radiologyUser, h.app)
    const row = h.items.get(ITEM_1)
    assert.strictEqual(row.transport.forward_error, 'ETIMEDOUT')
    assert.strictEqual(row.transport.forward_http_status, null, 'no status when it never arrived')
    assert(row.transport.message.includes('ETIMEDOUT'), 'the row names the network failure')
    assert(!row.transport.message.includes('HTTP'), 'do not claim an HTTP reply that never came')
  }
  {
    /* ทีมเวอร์ชันเก่าไม่ส่งฟิลด์พวกนี้มา — ข้อความต้องเท่าเดิมเป๊ะ ห้ามมี ' · ' ห้อยท้าย */
    const h = makeHarness({ ackCode: 'AE' })
    await Process.call(h.context, { order_id: ids.opd }, radiologyUser, h.app)
    const row = h.items.get(ITEM_1)
    assert.strictEqual(row.transport.message, 'RIS rejected this exam',
      'with no forward data the message must be byte-identical to before')
    assert.strictEqual(row.transport.forward_http_status, null)
    assert.strictEqual(row.transport.forward_error, '')
  }
  {
    /* ใบที่สำเร็จต้องไม่ถูกแตะเลย — ไม่มีคำอธิบายห้อยท้าย status ยัง ok */
    const h = makeHarness({ forwardAck: { LocalSaved: true, ForwardHttpStatus: 200 } })
    await Process.call(h.context, { order_id: ids.opd }, radiologyUser, h.app)
    const row = h.items.get(ITEM_1)
    assert.strictEqual(row.transport.status, 'ok')
    assert.strictEqual(row.transport.ack, 'AA')
    assert(!row.transport.message.includes('HTTP'), 'a delivered order gets no diagnostic suffix')
  }

  console.log('X-ray CPOE dispatch API tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
