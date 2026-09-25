const assert = require('assert')
const fs = require('fs')
const path = require('path')

const apiBody = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/xray_cpoe_worklist_api.js'),
  'utf8',
)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

/* ต้นฉบับผูกกับ m0901 (งานรังสีวิทยา) แล้ว — เทสต์ compile สองแบบ:
   Configured = ตามต้นฉบับ · Process = จำลองกรณีที่ยังไม่ได้ตั้งค่า เพื่อทดสอบ diagnostic */
const CONFIGURED = "const XRAY_ORGANIZATION_CODES = ['m0900', 'm0901', 'CT']"
assert(apiBody.includes(CONFIGURED), 'the three radiology organizations must stay wired')

/* ── สถานะที่ RIS แจ้งกลับ (เพิ่ม 2026-09-09 · ผู้ใช้เลือกตัวเลือก A) ────────
   xray_order_status_change เป็นขา **เข้า**: RIS เรียกมาอัปเดต zdata_xray_order เอง
   เราแค่อ่านมาแสดง · เทสนี้กันไม่ให้มันกลายเป็นขาออก และกันไม่ให้ทำแถวหาย */
assert(
  apiBody.includes("const XRAY_RIS_ORDER_COLLECTION = 'zdata_xray_order'"),
  'the RIS order status source must stay wired',
)
assert(apiBody.includes("from: XRAY_RIS_ORDER_COLLECTION"), 'the status lookup must stay')
assert(
  apiBody.includes("{ $sort: { updated_at: -1, _id: -1 } }"),
  'one accession can have several rows — the newest must win',
)
assert(
  apiBody.includes("{ $addFields: { ris_order: { $arrayElemAt: [{ $ifNull: ['$_ris_order', []] }, 0] } } },"),
  'read it with $arrayElemAt — an $unwind here could drop items that RIS never reported',
)
assert(
  apiBody.includes("ris_order_status: { $ifNull: ['$ris_order.Status', ''] },"),
  'the item must carry the RIS status',
)
/* 🔴 หัวใจของกฎ: ค่านี้ต้องเป็น "ข้อมูลแสดงผล" เท่านั้น
   ถ้าวันไหนมันไปโผล่ในนิยาม effective_status หรือ bucket แปลว่าเริ่มเปลี่ยน
   พฤติกรรมเดิมของ chip/ตัวนับ ซึ่งต้องขออนุญาตผู้ใช้ก่อน (§14d) */
const effectiveBlock = apiBody.slice(
  apiBody.indexOf('effective_status:'),
  apiBody.indexOf('$lookup', apiBody.indexOf('effective_status:')),
)
assert(
  !effectiveBlock.includes('ris_order'),
  'the RIS status must never feed effective_status',
)
assert(
  !apiBody.includes("cond: { $eq: ['$ris_order.Status'"),
  'the RIS status must never be used as a filter',
)
const Configured = new AsyncFunction('params', 'userInfo', 'app', apiBody)
const Process = new AsyncFunction(
  'params', 'userInfo', 'app',
  apiBody.replace(CONFIGURED, 'const XRAY_ORGANIZATION_CODES = []'),
)

/* visit_id ต้องเป็น 24-hex ของจริง — API คัดค่าที่ผิดรูปแบบทิ้งก่อนไปถาม Diagnosis */
const VISIT_1 = 'aaaaaaaaaaaaaaaaaaaaaaa1'
const VISIT_2 = 'aaaaaaaaaaaaaaaaaaaaaaa2'

const facetResult = {
  rows: [{
    order_id: 'ORDER-1',
    order_number: '20260831011',
    requested_at: '2026-08-31 08:10:00',
    patient: { hn: 'HN-001' },
    emr_context: { visit_id: VISIT_1 },
    items: [{ item_id: 'ITEM-1', item_code: 'XR-CHEST', modality: { code: 'CR' } }],
    item_count: 1,
    /* ข้อมูลดิบที่ join มาให้แถบเตือนแพ้ยา/COVID (ผู้ใช้ขอ 2026-09-03) */
    diagnosis: { value: 'U07.1', label: 'COVID-19, virus identified' },
    _allergy_main: [
      { allergy_item: { value: 'D001', label: 'Penicillin' }, allergy_type: { label: 'ยา' } },
      { allergy_item: { value: 'D002', label: 'Sulfa' } },
    ],
    _drug_allergy: 'ปฏิเสธการแพ้ยา',
    _food_allergy: 'กุ้ง',
  }, {
    order_id: 'ORDER-2',
    order_number: '20260831012',
    requested_at: '2026-08-31 08:20:00',
    patient: { hn: 'HN-002' },
    emr_context: { visit_id: VISIT_2 },
    diagnosis: { value: 'J18.9', label: 'Pneumonia, unspecified' },
    items: [{ item_id: 'ITEM-2', item_code: 'XR-ODD', modality: { code: 'zz' } }],
    item_count: 1,
  }],
  meta: [{ total: 2 }],
  buckets: [{ _id: 'waiting', total: 1 }, { _id: 'pending', total: 1 }, { _id: 'complete', total: 1 }, { _id: 'cancelled', total: 1 }],
  modality_counts: [
    { _id: 'CR', total: 3 },
    { _id: 'CT', total: 1 },
    { _id: 'ZZ', total: 1 },
    { _id: '', total: 2 },
  ],
}

const reportItemId = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const reportMasterId = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const reportOrderId = 'cccccccccccccccccccccccc'
const labItemId = 'dddddddddddddddddddddddd'
const noAccessionItemId = 'eeeeeeeeeeeeeeeeeeeeeeee'

const makeApp = (captures, options = {}) => ({
  isAuth: () => options.auth !== false,
  dbObjectId: id => String(id),
  dbFindById: async (id, from) => {
    if (from === 'zdata_cpoe_order_item' && String(id) === reportItemId) {
      return { success: true, reply: { data: {
        _id: reportItemId,
        xrstatx: 1,
        current_status: 'resulted',
        service_type: { value: 'xray' },
        item_data_id: reportMasterId,
        order_id: { value: reportOrderId },
        item_code: 'XR-CHEST',
        item_name: 'Chest PA',
        accession_no: '20260831CR001',
        dispatched_at: '2026-08-31 09:00:00',
      } } }
    }
    if (from === 'zdata_cpoe_order_item' && String(id) === noAccessionItemId) {
      return { success: true, reply: { data: {
        _id: noAccessionItemId, xrstatx: 1, current_status: 'sent',
        service_type: { value: 'xray' }, item_data_id: reportMasterId,
        order_id: { value: reportOrderId }, item_code: 'XR-CHEST', item_name: 'Chest PA',
      } } }
    }
    if (from === 'zdata_cpoe_order_item' && String(id) === labItemId) {
      return { success: true, reply: { data: {
        _id: labItemId, xrstatx: 1, service_type: { value: 'lab' }, item_code: 'CBC',
      } } }
    }
    if (from === 'zdata_master_item_order' && String(id) === reportMasterId) {
      return { success: true, reply: { data: {
        _id: reportMasterId,
        item_name: 'Chest PA',
        xray_item: { modality: 'cr', body_path: 'Chest' },
      } } }
    }
    if (from === 'zdata_cpoe_order' && String(id) === reportOrderId) {
      return { success: true, reply: { data: { _id: reportOrderId, xrstatx: 1, order_number: '20260831011', xparentx: 'VISIT-1', vid: { vn: 'VN-1', pid: { hn: 'HN-001' } } } } }
    }
    return { success: true, reply: { data: null } }
  },
  dbFindAll: async provider => {
    captures.push(provider)
    if (provider.from === 'zdata_cpoe_order_item') {
      /* คืนสำเนาใหม่ทุกครั้งเหมือน DB จริง — Process แปลงข้อมูลในแถวที่ได้รับ
         (เติม label เครื่อง · สรุป alerts · ลบข้อมูลดิบทิ้ง) ถ้าใช้ object เดิมซ้ำ
         การเรียกครั้งถัดไปจะได้ข้อมูลที่ถูกแก้ไปแล้ว แล้วเทสต์จะหลอกตัวเอง (เจอจริง 2026-09-03) */
      return { success: true, reply: { data: [JSON.parse(JSON.stringify(facetResult))] } }
    }
    if (provider.from === 'zdata_organization') {
      if (options.organizations === null) throw new Error('ORG_LOOKUP_FAILED')
      return { success: true, reply: { data: options.organizations || organizations } }
    }
    throw new Error('Unexpected collection ' + provider.from)
  },
  sdformGetAll: async provider => {
    captures.push({ type: 'sdformGetAll', provider })
    return { success: true, data: options.resultRows || [] }
  },
  /* ผลอ่านอ่านตรงจาก zdata_xray_result ด้วย AccessionNo (D-X6 · 2026-09-02)
     mock เก็บ query/sort ไว้ให้เทสตรวจว่า join ด้วยเลขที่ถูกต้องและเรียงถูกทาง */
  db: {
    collection: name => ({
      find: query => {
        captures.push({ type: 'resultFind', collection: name, query })
        /* ประวัติผลอ่านย้ายไปอ่านตาราง log 2026-09-16 (ทีมแยกสองชั้นตั้งแต่ 09-09)
           ไม่ตั้ง options.logRows = คืนชุดเดียวกับตารางผลอ่าน ⇒ เคสเดิมทุกเคสได้ผลเท่าเดิม
           ตั้ง logRows เมื่อไหร่ = จำลองว่า log มีหลายฉบับแต่ตารางผลอ่านมีแถวเดียว */
        const rows = name === 'zdata_zdata_xray_result_log'
          ? (options.logRows || options.resultRows || [])
          : (options.resultRows || [])
        const chain = {
          sort: order => { captures.push({ type: 'resultSort', collection: name, order }); return chain },
          limit: () => chain,
          toArray: async () => rows,
        }
        return chain
      },
    }),
  },
  curDate: () => '2026-08-31 10:20:30',
})

/* Organization master — ค่าจริงที่ผู้ใช้อ่านมาจากหน้าจอ 2026-08-31 */
const organizations = [
  { unit_code: '19.P', unit_name: 'คลินิกวัคซีน', unit_parent: { unit_code: 'OPD', unit_name: 'ผู้ป่วยนอก' } },
  { unit_code: 'm0900', unit_name: 'กลุ่มงานรังสีวิทยา', unit_parent: { unit_code: '', unit_name: '' } },
  { unit_code: 'm0901', unit_name: 'งานรังสีวิทยา', unit_parent: { unit_code: 'm0900', unit_name: 'กลุ่มงานรังสีวิทยา' } },
  { unit_code: 'CT', unit_name: 'CT scan / CT-MRI SCAN', unit_parent: { unit_code: 'm0900', unit_name: 'กลุ่มงานรังสีวิทยา' } },
  /* ชื่อสื่อถึงรังสีแต่ไม่ได้อยู่ใน XRAY_ORGANIZATION_CODES — ต้องยังถูกปฏิเสธ */
  { unit_code: 'm0950', unit_name: 'งานรังสีรักษา', unit_parent: { unit_code: '', unit_name: '' } },
]

const userInfo = { roles: ['user'], unit: { code: 'm0901' } }
const groupUser = { roles: ['user'], unit: { code: 'm0900' } }
const ctUser = { roles: ['user'], unit: { code: 'CT' } }
const lookalikeUser = { roles: ['user'], unit: { code: 'm0950' } }
const labUser = { roles: ['user'], unit: { code: '19.P' } }
const stage = (pipeline, key) => pipeline.filter(step => Object.prototype.hasOwnProperty.call(step, key))
const lastPipeline = captures => captures.filter(c => c.from === 'zdata_cpoe_order_item').pop().nosql.pipeline

;(async () => {
    /* ── ใบร่างต้องไม่โผล่ในห้องรังสี (ผู้ใช้ยืนยัน 2026-09-01) ────────────
     ตัดที่ STATUS_VOCABULARY ⇒ ไม่เข้าทั้ง chip และตาราง ไม่ใช่เห็นแต่กดไม่ได้ */
  assert(!/^\s+draft: '/m.test(apiBody), 'draft must not be part of the radiology vocabulary')
  assert(apiBody.includes("  sent: 'waiting',"), 'sent is the waiting status before dispatch')
  assert(apiBody.includes("  ready: 'waiting',"), 'Finance-ready stays in the waiting bucket until radiology receives it')
  assert(apiBody.includes("  accepted: 'pending',"), 'accepted starts the pending-result status')

/* ── permission ───────────────────────────────────────────────────── */
  let captures = []
  let out = await Configured({}, userInfo, makeApp(captures, { auth: false }))
  assert.strictEqual(out.success, false)
  assert(out.message.includes('ไม่มีสิทธิ์'))

  /* ตัวพิมพ์ไม่ต้องตรง — master เขียน m0901 ตัวเล็ก แต่ runtime อาจส่งตัวใหญ่ */
  out = await Configured({}, { roles: ['user'], unit: { code: 'M0901' } }, makeApp([]))
  assert.strictEqual(out.success, true)
  assert.strictEqual(out.data.organization_code, 'M0901')
  assert(out.data.orders.length > 0, 'an uppercase organization code still matches')

  /* ทั้งสามหน่วยของกลุ่มรังสีเข้าได้ (ผู้ใช้ยืนยันผัง 2026-09-01)
     m0900 = กลุ่มแม่ · m0901 = X-ray · CT = CT/MRI */
  for (const allowed of [groupUser, ctUser]) {
    captures = []
    out = await Configured({}, allowed, makeApp(captures))
    assert.strictEqual(out.success, true, allowed.unit.code + ' must be allowed')
    assert(out.data.orders.length > 0, allowed.unit.code + ' must see the worklist')
    assert(
      captures.filter(c => c.from === 'zdata_cpoe_order_item').length > 0,
      allowed.unit.code + ' actually queries the worklist',
    )
  }

  /* หน่วยที่ "ชื่อ" สื่อถึงรังสีแต่ไม่ได้อยู่ในรายการ ต้องยังถูกปฏิเสธ
     คำใบ้จากชื่อไม่ใช่เกณฑ์ให้สิทธิ์ */
  captures = []
  out = await Configured({}, lookalikeUser, makeApp(captures))
  assert.strictEqual(out.success, true)
  assert.strictEqual(out.data.orders.length, 0)
  assert(out.message.includes('ไม่ใช่หน่วยงานรังสี'))
  assert.strictEqual(
    captures.filter(c => c.from === 'zdata_cpoe_order_item').length,
    0,
    'a name that looks like radiology never grants access on its own',
  )

  out = await Configured({ organization_code: 'OTHER' }, userInfo, makeApp([]))
  assert.strictEqual(out.success, false)
  assert(out.message.includes('Organization'))

  out = await Configured({}, { roles: ['user'], unit: {} }, makeApp([]))
  assert.strictEqual(out.success, false, 'a user without an organization must be refused')

  /* สร้างรายการใหม่: ค้น Visit วันนี้ด้วย HN หรือเลขบัตรโดยไม่แตะรายการเดิม */
  {
    const visit = { _id: 'VISIT-40', vn: '6900231', visit_date: '2026-08-31 09:00:00',
      pid: { value: 'PERSON-40', hn: '6900040', p_fname: 'ตัวอย่าง' } }
    const reads = []
    const app = makeApp([])
    app.dbFindAll = async provider => {
      reads.push(provider)
      if (provider.from === 'zdata_person') return { success: true, reply: { data: [{ hn: '6900040' }] } }
      if (provider.from === 'zdata_visit_tran') return { success: true, reply: { data: [{ vid: { value: 'VISIT-40' } }] } }
      if (provider.from === 'zdata_visit') return { success: true, reply: { data: [visit] } }
      throw new Error('Unexpected collection ' + provider.from)
    }
    let resolved = await Configured({ action: 'resolve_open_visit', hn: '6900040' }, userInfo, app)
    assert.strictEqual(resolved.success, true)
    assert.strictEqual(resolved.data.visit.vn, '6900231')
    assert.strictEqual(resolved.data.hn, '6900040')
    assert(!reads.some(x => x.from === 'zdata_person'), 'HN lookup does not read identity records')
    assert.strictEqual(reads.find(x => x.from === 'zdata_visit').nosql.query['pid.hn'], '6900040')
    reads.length = 0
    resolved = await Configured({ action: 'resolve_open_visit', citizen_id: '1234567890123' }, userInfo, app)
    assert.strictEqual(resolved.data.visit.vn, '6900231')
    assert(!JSON.stringify(resolved).includes('1234567890123'), 'citizen ID must not be returned')
    assert.strictEqual(reads.find(x => x.from === 'zdata_person').nosql.query.p_cid, '1234567890123')
    resolved = await Configured({ action: 'resolve_open_visit', hn: '6900040' }, labUser, app)
    assert.strictEqual(resolved.success, false, 'organization scope also guards Visit lookup')
    resolved = await Configured({ action: 'resolve_open_visit', hn: '6900040', citizen_id: '1234567890123' }, userInfo, app)
    assert.strictEqual(resolved.success, false, 'ambiguous identity is rejected')
    const absentApp = makeApp([])
    absentApp.dbFindAll = async provider => ({ success: true, reply: { data: [] } })
    resolved = await Configured({ action: 'resolve_open_visit', hn: '6900999' }, userInfo, absentApp)
    assert.strictEqual(resolved.success, true)
    assert.strictEqual(resolved.data.visit, null, 'no VN today returns no patient context')
    const fallbackApp = makeApp([])
    fallbackApp.dbFindAll = async provider => {
      if (provider.from === 'zdata_visit_tran') return { success: true, reply: { data: [] } }
      if (provider.from === 'zdata_visit') {
        assert(provider.nosql.query.visit_date.$gte, 'fallback remains scoped to today')
        return { success: true, reply: { data: [visit] } }
      }
      throw new Error('Unexpected collection ' + provider.from)
    }
    resolved = await Configured({ action: 'resolve_open_visit', hn: '6900040' }, userInfo, fallbackApp)
    assert.strictEqual(resolved.data.visit.vn, '6900231', 'Visit without an active queue row still resolves like LAB')
  }

  /* ── Diagnosis: ต้อง join แบบเดียวกับ LAB ที่ใช้งานได้จริง ──────────────
     เดารอบแรกผิดทั้ง collection และฟิลด์ลิงก์ (vid เป็น object ต้องเทียบ vid.value)
     เทสต์นี้จึงล็อกเส้นทางไว้กับของจริง ไม่ใช่กับสมมติฐาน */
  {
    captures = []
    out = await Configured({}, userInfo, makeApp(captures))
    assert.strictEqual(out.success, true)

    const rowsStage = stage(lastPipeline(captures), '$facet').pop().$facet.rows
    const lookup = rowsStage.filter(step => step.$lookup)[0]
    assert(lookup, 'the rows facet must join the diagnosis')
    assert.strictEqual(lookup.$lookup.from, 'zdata_diagnosis', 'the real collection, not a guess')
    assert.deepStrictEqual(lookup.$lookup.let, { visit_id: '$_diagnosis_visit_id' })

    const match = lookup.$lookup.pipeline[0].$match
    assert.deepStrictEqual(
      match.$expr, { $eq: ['$vid.value', '$$visit_id'] },
      'vid is an object — matching vid itself finds nothing',
    )
    assert.deepStrictEqual(match.xrstatx, { $nin: [0, 3] }, 'deleted diagnoses excluded')
    assert.deepStrictEqual(
      lookup.$lookup.pipeline[1].$sort, { updated_at: -1, created_at: -1 },
      'newest diagnosis wins',
    )
    assert.strictEqual(lookup.$lookup.pipeline[2].$limit, 1)

    /* join หลัง skip/limit เท่านั้น ไม่งั้นอ่าน visit ของทั้งชุดผลลัพธ์ */
    const limitIndex = rowsStage.findIndex(step => step.$limit)
    const lookupIndex = rowsStage.findIndex(step => step.$lookup)
    assert(limitIndex >= 0 && lookupIndex > limitIndex, 'the join must come after $limit')

    assert(rowsStage.some(step => step.$addFields && step.$addFields.diagnosis === '$diagnosis_record.primary_dx'))
    const finalProject = rowsStage.filter(step => step.$project).pop().$project
    assert.strictEqual(finalProject._diagnosis_visit_id, 0, 'the join key must not leak to the client')
    assert.strictEqual(finalProject.diagnosis_record, 0)

    /* projection ต้องพก visit id ดิบไว้ให้ join ใช้ — toString แล้วจะเทียบชนิดไม่ตรง */
    const project = stage(lastPipeline(captures), '$project').pop().$project
    assert.strictEqual(project._diagnosis_visit_id, '$order.xparentx')
  }

  /* ── แถบเตือนแพ้ยา / COVID (ผู้ใช้ขอ 2026-09-03) ──────────────────────────
     UI ห้ามคิดเอง — API สรุปมาให้ชุดเดียวที่ patient.alerts
     COVID อ่านจาก Diagnosis ของ visit (ผู้ใช้เลือกแหล่งนี้) ไม่ใช่ฟิลด์เดา ๆ */
  {
    captures = []
    out = await Configured({}, userInfo, makeApp(captures))
    assert.strictEqual(out.success, true)

    const alerts = out.data.orders[0].patient.alerts
    assert.strictEqual(alerts.covid, true, 'ICD U07.1 = COVID')
    assert.strictEqual(alerts.covid_label, 'COVID')
    assert.deepStrictEqual(
      alerts.allergies, ['Penicillin', 'Sulfa', 'กุ้ง'],
      'ชื่อที่แพ้ต้องเป็น label ที่อ่านรู้เรื่อง ไม่ใช่ id ของ master',
    )
    assert(
      alerts.allergies.indexOf('ปฏิเสธการแพ้ยา') < 0,
      '"ปฏิเสธการแพ้ยา" แปลว่าไม่แพ้ — ยกขึ้นกล่องแดงจะกลายเป็นเตือนกลับด้าน',
    )

    const clean = out.data.orders[1].patient.alerts
    assert.strictEqual(clean.covid, false, 'Diagnosis อื่นต้องไม่ติดธง COVID')
    assert.deepStrictEqual(clean.allergies, [], 'ไม่มีข้อมูล = ไม่มีอะไรให้เตือน')
    assert.strictEqual(clean.covid_label, '')

    /* ข้อมูลดิบที่ใช้คำนวณต้องไม่หลุดไปหา client */
    assert(!('_allergy_main' in out.data.orders[0]), 'ข้อมูลดิบต้องถูกลบก่อนตอบกลับ')
    assert(!('_drug_allergy' in out.data.orders[0]))
    assert(!('_food_allergy' in out.data.orders[0]))

    /* join ทั้งสองตัวต้องอยู่ใน rows facet หลัง $limit เหมือน Diagnosis */
    const rowsStage = stage(lastPipeline(captures), '$facet').pop().$facet.rows
    const lookups = rowsStage.filter(step => step.$lookup).map(step => step.$lookup.from)
    assert.deepStrictEqual(
      lookups, ['zdata_diagnosis', 'zdata_person', 'zdata_patient_assessment'],
      'ประวัติการแพ้ยาอยู่ที่ person · แบบประเมินราย visit อยู่ที่ patient_assessment',
    )
    const limitIndex = rowsStage.findIndex(step => step.$limit)
    rowsStage.forEach((step, index) => {
      if (step.$lookup) assert(index > limitIndex, 'ทุก join ต้องอยู่หลัง $limit')
    })

    const personLookup = rowsStage.filter(step => step.$lookup && step.$lookup.from === 'zdata_person')[0]
    assert.deepStrictEqual(
      personLookup.$lookup.pipeline[0].$match.$expr,
      { $eq: [{ $toString: '$_id' }, { $toString: '$$person_id' }] },
      'เทียบเป็น string ทั้งสองฝั่ง เพราะ pid.value อาจเป็น ObjectId หรือ string',
    )
    assert.deepStrictEqual(personLookup.$lookup.pipeline[0].$match.xrstatx, { $nin: [0, 3] })

    const finalProject = rowsStage.filter(step => step.$project).pop().$project
    assert.strictEqual(finalProject.person_record, 0, 'เอกสารดิบห้ามหลุดออกไป')
    assert.strictEqual(finalProject.assessment_record, 0)
    assert.strictEqual(finalProject._person_id, 0)
  }

  /* ── ขอบเขต = Organization ของหน่วยรังสี (ผู้ใช้เลือก 2026-08-31) ──── */
  captures = []
  out = await Process({}, labUser, makeApp(captures))
  assert.strictEqual(out.success, true)
  const orgCall = captures.find(c => c.from === 'zdata_organization')
  assert(orgCall, 'the process reads the Organization master itself')
  assert.deepStrictEqual(orgCall.nosql.query, { xrstatx: { $nin: [0, 3] } })
  assert.deepStrictEqual(Object.keys(orgCall.nosql.projection).sort(), ['_id', 'enable', 'unit_code', 'unit_name', 'unit_parent'])
  assert.strictEqual(out.data.orders.length, 0)
  assert(out.message.includes('XRAY_ORGANIZATION_CODES'), 'an unset list must say how to fix it')
  assert(out.message.includes('"19.P"'), 'the message must name the current organization code')
  assert(out.message.includes('คลินิกวัคซีน'), 'and its name, read from the Organization master')
  assert(out.message.includes('m0901 (งานรังสีวิทยา)'), 'and the units that look like radiology')
  assert(out.message.includes('m0900'))
  assert.strictEqual(
    captures.filter(c => c.from === 'zdata_cpoe_order_item').length,
    0,
    'no patient data is queried before the organization is allowed',
  )
  assert.deepStrictEqual(out.data.organization_current, {
    code: '19.P', name: 'คลินิกวัคซีน', parent_code: 'OPD', parent_name: 'ผู้ป่วยนอก',
  })
  assert.deepStrictEqual(
    out.data.organization_candidates.map(row => row.code),
    ['m0900', 'm0901', 'CT', 'm0950'],
    'the hint lists every radiology-looking unit, granted or not',
  )

  /* อ่าน Organization master ไม่ได้ ต้องยังตอบได้ ไม่ใช่ล้ม */
  out = await Process({}, labUser, makeApp([], { organizations: null }))
  assert.strictEqual(out.success, true)
  assert(out.message.includes('"19.P"'))
  assert.deepStrictEqual(out.data.organization_candidates, [])

  /* dropdown ต้องใช้งานได้แม้ยังไม่ผ่านขอบเขต — รายการเครื่องไม่ใช่ข้อมูลผู้ป่วย */
  assert.strictEqual(out.data.modalities.length, 11)
  assert.deepStrictEqual(out.data.modalities[0], { code: 'DX', label: 'DX-Digital Radiography', count: 0 })

  captures = []
  out = await Configured({}, labUser, makeApp(captures))
  assert.strictEqual(out.success, true)
  assert.strictEqual(out.data.orders.length, 0)
  /* แก้ 2026-09-10 ตามคำสั่งผู้ใช้ ("เปลี่ยนเป็น ห้องนี้ไม่ใช่หน่วยงานรังสี
     กรุณาเปลี่ยนห้องที่มุมขวาบน") — ข้อความที่เจ้าหน้าที่เห็นต้องสั้นและบอกว่าต้องทำอะไร
     จึงไม่มีรหัสห้องต่อท้ายอีกแล้ว · สิ่งที่ assert เดิมปกป้องคือ "ยังบอกได้ว่าถูกปฏิเสธ
     ที่ห้องไหน" ⇒ ย้ายไปเช็คที่ data.organization_current ซึ่งยังส่งกลับครบเหมือนเดิม */
  assert(out.message.includes('ไม่ใช่หน่วยงานรังสี'))
  assert(out.message.includes('เปลี่ยนห้องที่มุมขวาบน'), 'the message must say what to do next')
  assert(!/XRAY_ORGANIZATION_CODES|Organization ปัจจุบัน/.test(out.message),
    'no variable names or diagnostics in the message staff read')
  assert.strictEqual(out.data.organization_current.code, '19.P',
    'the rejected organization is still identifiable from the payload')
  assert.strictEqual(
    captures.filter(c => c.from === 'zdata_cpoe_order_item').length,
    0,
    'an out-of-scope organization never reaches patient data',
  )

  /* ── list ─────────────────────────────────────────────────────────── */
  captures = []
  out = await Configured({ action: 'list' }, userInfo, makeApp(captures))
  assert.strictEqual(out.success, true)
  let pipeline = lastPipeline(captures)
  assert.strictEqual(pipeline[0].$match['service_type.value'], 'xray')
  assert(
    !stage(pipeline, '$match').some(step => step.$match['resolved_section.code']),
    'scope is no longer narrowed by radiology sections',
  )

  /* เครื่องมาจาก master.xray_item.modality เป็นทางหลัก พร้อมทางสำรอง */
  const modalityRaw = stage(pipeline, '$addFields').find(step => step.$addFields.modality_raw).$addFields.modality_raw
  assert.strictEqual(modalityRaw.$ifNull[0], '$master.xray_item.modality.value')
  assert.strictEqual(modalityRaw.$ifNull[1].$ifNull[0], '$master.xray_item.modality')
  assert.strictEqual(modalityRaw.$ifNull[1].$ifNull[1].$ifNull[0], '$master.xray_item.modality_type')
  assert.strictEqual(modalityRaw.$ifNull[1].$ifNull[1].$ifNull[1].$ifNull[0], '$resolved_section.modality_type')

  /* ค่าที่ไม่ใช่ string ต้องกลายเป็นค่าว่าง ไม่ใช่ทำ pipeline พัง */
  const modalityCode = stage(pipeline, '$addFields').find(step => step.$addFields.modality_code).$addFields.modality_code
  assert.deepStrictEqual(modalityCode.$let.in.$cond[0], { $eq: [{ $type: '$$raw' }, 'string'] })
  assert.strictEqual(modalityCode.$let.in.$cond[2], '')

  /* dropdown = enum ของ master ทั้ง 11 ค่า พร้อมจำนวนจริง */
  assert.deepStrictEqual(out.data.modalities.slice(0, 11).map(m => m.code), [
    'DX', 'MG', 'US', 'CT', 'RF', 'CR', 'VCUG', 'MR', 'IO', 'UN', 'OT',
  ])
  assert.strictEqual(out.data.modalities.find(m => m.code === 'CR').count, 3)
  assert.strictEqual(out.data.modalities.find(m => m.code === 'CT').count, 1)
  assert.strictEqual(out.data.modalities.find(m => m.code === 'MG').count, 0)
  /* code นอก enum ต้องยังเลือกได้ ไม่หายเงียบ */
  assert.deepStrictEqual(out.data.modalities.at(-1), { code: 'ZZ', label: 'ZZ', count: 1 })
  /* รายการที่ยังไม่ผูกเครื่องต้องถูกรายงาน ไม่ใช่ปล่อยผ่าน (design §5.4) */
  assert.strictEqual(out.data.modality_unmapped, 2)
  /* แก้ 2026-09-10 ตามคำสั่งผู้ใช้ ("เอาประโยคนี้ออกไปเลย ไม่ต้องมี log แสดงข้อความนี้")
     — อ่านสำเร็จแล้วต้องไม่มีข้อความใด ๆ กลับไป เพราะฟอร์มเอา message ไปขึ้นเป็นแถบเตือน
     เดิม assert ว่าข้อความบอกจำนวนรายการที่ยังไม่ผูกเครื่อง ซึ่งเป็นแค่ *ช่องทางส่ง*
     สัญญาจริงคือ "ผู้ใช้ต้องได้รู้จำนวนนั้น" ซึ่งยังคุมอยู่สองชั้นและไม่ได้หายไป:
       · บรรทัดเหนือนี้ — data.modality_unmapped ต้องเป็น 2
       · test_xray_cpoe_worklist_form.js — view.dataNote ต้องขึ้นข้อความนั้นให้ผู้ใช้เห็น */
  assert.strictEqual(out.message, '', 'a successful read must stay silent')

  /* label ของเครื่องถูกเติมให้ทุก item */
  assert.deepStrictEqual(out.data.orders[0].items[0].modality, { code: 'CR', label: 'CR-Computed Radiography' })
  assert.deepStrictEqual(out.data.orders[1].items[0].modality, { code: 'ZZ', label: 'ZZ' })

  assert.deepStrictEqual(out.data.counts, { all: 4, waiting: 1, pending: 1, complete: 1, cancelled: 1, active: 2 })

  /* ── เลือกหลายเครื่องพร้อมกัน (ผู้ใช้ขอ 2026-09-02) ─────────────────── */
  {
    for (const input of [['ct', 'dx'], 'ct,dx']) {
      captures = []
      const many = await Configured({ action: 'list', modality: input }, userInfo, makeApp(captures))
      /* ตัวกรองเครื่องอยู่ใน facet ของ rows/meta/buckets ไม่ใช่ pipeline ชั้นบน */
      const rows = stage(lastPipeline(captures), '$facet').pop().$facet.rows
      const picked = rows.find(step => step.$match && step.$match.modality_codes)
      assert.deepStrictEqual(
        picked.$match.modality_codes, { $in: ['CT', 'DX'] },
        'array and CSV must both work: ' + JSON.stringify(input),
      )
      assert.deepStrictEqual(many.data.modality_codes, ['CT', 'DX'])
      assert.strictEqual(many.data.modality, 'CT,DX', 'the legacy field echoes them joined')
    }

    /* ไม่เลือกเครื่องเลย = ไม่มีตัวกรองเครื่อง เหมือนเดิมทุกประการ */
    captures = []
    const none = await Configured({ action: 'list', modality: '' }, userInfo, makeApp(captures))
    assert(
      !stage(lastPipeline(captures), '$facet').pop().$facet.rows
        .some(step => step.$match && step.$match.modality_codes),
      'an empty selection must not filter by modality',
    )
    assert.strictEqual(none.data.modality, '')
    assert.deepStrictEqual(none.data.modality_codes, [])

    /* dropdown ต้องยังโชว์ทุกเครื่องพร้อมจำนวน แม้เลือกไปแล้วหลายตัว */
    captures = []
    await Configured({ action: 'list', modality: ['CT', 'DX'] }, userInfo, makeApp(captures))
    const facets = stage(lastPipeline(captures), '$facet').pop().$facet
    assert(
      !facets.modality_counts.some(step => step.$match && step.$match.modality_codes),
      'the dropdown keeps every machine and its count after several are picked',
    )
  }

  /* ── คิวประจำวัน — ค่าเริ่มต้นเห็นเฉพาะวันปัจจุบัน ─────────────────────
     🔴 กลับคำตัดสินเดิมของ 2026-09-02 ("งานค้างข้ามวันต้องติดมาด้วยเสมอ")
     ตามคำสั่งผู้ใช้ 2026-09-08: "รายการในวันนั้นจะต้องรีทุกวันตาม patient"
     ให้ตรงกับ LAB ที่ผู้ใช้สั่งไว้ก่อนหน้า (lab_cpoe_worklist_api.js · 2026-09-07)
     ⇒ ใบที่สั่งเมื่อวานแล้วยังไม่ได้ถ่ายจะ **ไม่** อยู่บนจอเช้าวันถัดไปอีกแล้ว

     สิ่งที่ assertion เดิมปกป้อง (ใบค้างต้องยังหาเจอ ไม่ใช่หายไปเฉย ๆ) ยังถูกตรวจอยู่
     ในรูปแบบใหม่ด้านล่าง: ค้นด้วย HN ข้ามวันได้ และเลือกช่วงวันที่เองได้เป๊ะ */
  {
    captures = []
    await Configured({ action: 'list' }, userInfo, makeApp(captures))
    const steps = lastPipeline(captures)
    const dateStep = steps.find(step => step.$match && step.$match.status_date)
    assert(dateStep, 'the default scope filters by status_date')
    assert(
      !steps.some(step => step.$match && step.$match.$or &&
        step.$match.$or.some(cond => cond.bucket === 'active')),
      'the cross-day backlog escape hatch must be gone',
    )

    /* เลือกช่วงวันเอง = ยึดตามที่เลือกเป๊ะ ๆ ห้ามแถมงานค้างเข้าไป */
    captures = []
    const picked = await Configured(
      { action: 'list', date_from: '2026-08-01', date_to: '2026-08-31' },
      userInfo,
      makeApp(captures),
    )
    const pickedSteps = lastPipeline(captures)
    const exact = pickedSteps.find(step => step.$match && step.$match.status_date)
    assert(exact, 'an explicit range still filters by status_date')
    assert.deepStrictEqual(exact.$match.status_date, { $gte: '2026-08-01', $lte: '2026-08-31' })

    /* ทางออกของงานค้าง #1 — ค้นด้วย HN แบบตรงตัวยังข้ามวันให้เหมือนเดิม
       ถ้าวันหนึ่งข้อนี้หลุด ใบค้างจะหายไปโดยไม่มีทางตามหาเลย */
    captures = []
    await Configured({ action: 'list', hn: 'HN-001' }, userInfo, makeApp(captures))
    assert(
      !lastPipeline(captures).some(step => step.$match && step.$match.status_date),
      'an exact HN search still crosses days',
    )
    assert(
      !pickedSteps.some(step => step.$match && step.$match.$or &&
        step.$match.$or.some(cond => cond.bucket === 'active')),
      'an explicit range must not smuggle the backlog back in',
    )
    assert.strictEqual(picked.data.date_scope.include_backlog, false)
  }

  /* ── facets: เครื่องกรอง rows/meta/buckets · modality_counts ไม่ถูกกรอง ── */
  const facetOf = p => stage(p, '$facet').pop().$facet
  const hasModality = steps => steps.some(step => step.$match && step.$match.modality_codes)
  /* กรองด้วย effective_status — สถานะที่รวมผลอ่านจาก RIS แล้ว (2026-09-02)
     ถ้ากลับไปกรองด้วย current_status ดิบ chip กับตารางจะไม่ตรงกันทันทีที่ผลแรกเข้ามา */
  const hasStatus = steps => steps.some(step => step.$match && step.$match['items.effective_status'])
  assert(
    !JSON.stringify(pipeline).includes("'items.current_status'"),
    'the status filter must use effective_status, never the raw CPOE status',
  )
  let f = facetOf(pipeline)
  assert.strictEqual(hasStatus(f.rows), true)
  assert.strictEqual(hasStatus(f.buckets), false, 'chip counts must not be filtered by the selected chip')
  assert.strictEqual(hasModality(f.modality_counts), false)

  captures = []
  out = await Configured({ action: 'list', modality: 'ct' }, userInfo, makeApp(captures))
  f = facetOf(lastPipeline(captures))
  /* เลือกได้หลายเครื่องแล้ว (ผู้ใช้ขอ 2026-09-02) ⇒ ตัวกรองเป็น $in เสมอ
     ค่าเดี่ยวต้องยังกรองได้ผลเท่าเดิม และ data.modality ยังคืนค่าเดิมให้ผู้เรียกเก่า */
  assert.deepStrictEqual(
    f.rows.find(step => step.$match && step.$match.modality_codes).$match.modality_codes,
    { $in: ['CT'] },
  )
  assert.strictEqual(hasModality(f.meta), true)
  assert.strictEqual(hasModality(f.buckets), true, 'chip counts follow the modality filter')
  assert.strictEqual(hasModality(f.modality_counts), false, 'the dropdown keeps every machine after one is picked')
  assert.strictEqual(out.data.modality, 'CT')

  /* ── filters ──────────────────────────────────────────────────────── */
  captures = []
  out = await Configured(
    { action: 'list', hn: 'HN-001', date_from: '2026-08-01', date_to: '2026-08-31' },
    userInfo,
    makeApp(captures),
  )
  pipeline = lastPipeline(captures)
  const orderMatch = stage(pipeline, '$match').find(step => step.$match['order.xrstatx'])
  assert.strictEqual(orderMatch.$match['order.vid.pid.hn'], 'HN-001', 'HN is matched exactly, never as a regex')
  assert(!('order.created_at' in orderMatch.$match), 'the date axis is the status time, not the creation time')
  assert.deepStrictEqual(
    stage(pipeline, '$match').find(step => step.$match.status_date).$match.status_date,
    { $gte: '2026-08-01', $lte: '2026-08-31' },
  )
  assert.deepStrictEqual(out.data.date_scope, {
    from: '2026-08-01', to: '2026-08-31', defaulted: false,
    include_backlog: false, axis: 'status_time',
  })

  const statusAt = stage(pipeline, '$addFields').find(step => step.$addFields.status_at).$addFields.status_at.$switch
  /* 2026-09-18: ตรวจใหม่ใน Order เก่าใช้ retest_at ของรอบนี้; หลังส่งใหม่ใช้
     dispatched_at ที่ใหม่กว่า โดยไม่ถูกเวลาเก่าของ sibling ดึงกลับไปวันเดิม */
  assert.deepStrictEqual(statusAt.branches.map(b => Object.keys(b.then)[0]), ['$max', '$max', '$max', '$min'])
  const retestBranch = statusAt.branches[2]
  assert.deepStrictEqual(retestBranch.case, { $gt: [{ $max: '$items.retest_at' }, null] })
  assert.deepStrictEqual(retestBranch.then, {
    $max: [{ $max: '$items.retest_at' }, { $max: '$items.dispatched_at' }],
  })
  const groupedItems = stage(pipeline, '$group').find(step => step.$group.items)
  assert.strictEqual(groupedItems.$group.items.$push.retest_at, '$retest_at')
  assert.deepStrictEqual(pipeline.find(step => step.$facet).$facet.rows.find(step => step.$sort).$sort, {
    status_at: -1, requested_at: -1, order_number: -1,
  })
  assert.strictEqual(statusAt.default, '$requested_at')

  captures = []
  out = await Configured({ action: 'list' }, userInfo, makeApp(captures))
  assert.deepStrictEqual(out.data.date_scope, {
    from: '2026-08-31', to: '2026-08-31', defaulted: true,
    /* คิวประจำวันแล้ว ไม่แถมงานค้างข้ามวัน (ผู้ใช้สั่ง 2026-09-08)
       คีย์นี้ยังต้องอยู่ในคำตอบเพื่อไม่ให้ผู้อ่าน response เดิมพัง */
    include_backlog: false, axis: 'status_time',
  })

  captures = []
  out = await Configured({ action: 'list', hn: 'HN-001' }, userInfo, makeApp(captures))
  assert.strictEqual(out.data.date_scope.defaulted, false)
  assert.strictEqual(
    stage(lastPipeline(captures), '$match').some(step => step.$match.status_date),
    false,
    'an exact HN search must not be capped to today',
  )

  out = await Configured({ action: 'list', date_from: '31-08-2026' }, userInfo, makeApp([]))
  assert.strictEqual(out.success, false)
  assert(out.message.includes('YYYY-MM-DD'))

  captures = []
  out = await Configured({ action: 'list', q: 'a.*b' }, userInfo, makeApp(captures))
  /* ค่าเริ่มต้นของช่วงวันก็เป็น $or แล้ว (งานค้างข้ามวัน) จึงต้องเจาะจงตัวที่เป็นคำค้น */
  const queryMatch = stage(lastPipeline(captures), '$match')
    .find(step => Array.isArray(step.$match.$or) && step.$match.$or[0] && step.$match.$or[0].order_number)
  assert.strictEqual(queryMatch.$match.$or[0].order_number.$regex, 'a\\.\\*b')
  assert.deepStrictEqual(
    queryMatch.$match.$or.map(clause => Object.keys(clause)[0]),
    ['order_number', 'patient.hn', 'visit.vn', 'visit.an', 'items.item_code', 'items.item_name', 'items.accession_no', '$expr'],
  )
  assert.deepStrictEqual(queryMatch.$match.$or[3]['visit.an'], { $regex: 'a\\.\\*b', $options: 'i' },
    'inpatient Admission No. uses the existing escaped free-text search')
  assert(!lastPipeline(captures).some(step => step.$lookup && step.$lookup.from === 'zdata_person'),
    'ordinary searches must not add a pre-pagination person join')

  /* คำค้นตัวเลขจากช่องเดิมพก hn มาด้วย: ให้ AN/CID ผ่าน แต่ HN ที่ตรงกันยัง match แบบ exact;
     โหมดสแกนที่ส่ง hn อย่างเดียวต้องยังใช้ prefilter เดิม */
  captures = []
  await Configured({ action: 'list', q: 'AN-0001', hn: 'AN-0001' }, userInfo, makeApp(captures))
  pipeline = lastPipeline(captures)
  assert(!stage(pipeline, '$match').some(step => step.$match['order.vid.pid.hn'] === 'AN-0001'))
  const anSearch = stage(pipeline, '$match').find(step => step.$match.$or && step.$match.$or[0].order_number)
  assert.strictEqual(anSearch.$match.$or[1]['patient.hn'], 'AN-0001')
  assert.strictEqual(anSearch.$match.$or[3]['visit.an'].$regex, 'AN-0001')

  captures = []
  await Configured({ action: 'list', q: '1234567890123', hn: '1234567890123' }, userInfo, makeApp(captures))
  pipeline = lastPipeline(captures)
  const cidLookupIndex = pipeline.findIndex(step => step.$lookup && step.$lookup.from === 'zdata_person')
  const facetIndex = pipeline.findIndex(step => step.$facet)
  assert(cidLookupIndex >= 0 && cidLookupIndex < facetIndex, 'citizen ID joins before counts and pagination')
  const cidLookup = pipeline[cidLookupIndex].$lookup
  assert.deepStrictEqual(cidLookup.let, { person_id: '$_person_id', patient_hn: '$patient.hn' })
  assert.strictEqual(cidLookup.pipeline[0].$match.p_cid, '1234567890123')
  assert.deepStrictEqual(cidLookup.pipeline[0].$match.$expr,
    { $or: [
      { $eq: [{ $toString: '$_id' }, { $toString: '$$person_id' }] },
      { $and: [
        { $ne: ['$$patient_hn', ''] },
        { $eq: ['$hn', '$$patient_hn'] },
      ] },
    ] },
    'CPOE snapshots without pid.value must still find the person by exact HN')
  assert.strictEqual(cidLookup.pipeline[1].$limit, 1)
  const cidSearch = pipeline[cidLookupIndex + 1].$match.$or
  assert.deepStrictEqual(cidSearch.find(clause => clause['_citizen_search_person.0']),
    { '_citizen_search_person.0': { $exists: true } })
  assert.strictEqual(pipeline[facetIndex].$facet.rows.at(-1).$project._citizen_search_person, 0,
    'the person lookup must not reach the UI')

  /* พิมพ์เลขบัตรใน Search ปกติส่ง q อย่างเดียว: ต้องค้นข้ามวันได้โดยไม่แปลงเป็น HN */
  captures = []
  out = await Configured({ action: 'list', q: '1234567890123' }, userInfo, makeApp(captures))
  pipeline = lastPipeline(captures)
  assert.strictEqual(out.data.date_scope.defaulted, false)
  assert(!stage(pipeline, '$match').some(step => step.$match.status_date),
    'an exact citizen ID query must not be capped to today')
  assert(!stage(pipeline, '$match').some(step => step.$match['order.vid.pid.hn']),
    'a citizen ID typed in Search must not become an HN prefilter')
  assert(pipeline.some(step => step.$lookup && step.$lookup.from === 'zdata_person'),
    'the ordinary Search path must reach the citizen ID lookup')

  /* สแกนเลขบัตรใช้ parameter แบบ exact และตัดวันที่ แต่ HN scan เดิมไม่เปลี่ยน */
  captures = []
  out = await Configured({ action: 'list', citizen_id: '1234567890123' }, userInfo, makeApp(captures))
  pipeline = lastPipeline(captures)
  assert.strictEqual(out.data.date_scope.defaulted, false)
  assert(!stage(pipeline, '$match').some(step => step.$match.status_date))
  assert(!stage(pipeline, '$match').some(step => step.$match['order.vid.pid.hn']))
  assert(stage(pipeline, '$match').some(step => step.$match['_citizen_search_person.0'] && step.$match['_citizen_search_person.0'].$exists),
    'scanner mode must require the exact citizen ID hit')

  captures = []
  await Configured({ action: 'list', hn: 'HN-001' }, userInfo, makeApp(captures))
  assert.strictEqual(stage(lastPipeline(captures), '$match')
    .find(step => step.$match['order.xrstatx']).$match['order.vid.pid.hn'], 'HN-001',
    'the existing exact HN scan stays unchanged')

  out = await Configured({ action: 'list', statuses: ['resulted', 'not_a_status'] }, userInfo, makeApp([]))
  assert.deepStrictEqual(out.data.statuses, ['resulted'])
  out = await Configured({ action: 'list', statuses: ['not_a_status'] }, userInfo, makeApp([]))
  assert.strictEqual(out.success, false)

  captures = []
  out = await Configured({ action: 'list', page: 3, limit: 500 }, userInfo, makeApp(captures))
  assert.strictEqual(out.data.page, 3)
  assert.strictEqual(out.data.limit, 100, 'limit is capped')
  const rows = facetOf(lastPipeline(captures)).rows
  assert.strictEqual(rows.find(step => '$skip' in step).$skip, 200)
  assert.strictEqual(rows.find(step => '$limit' in step).$limit, 100)

  /* ── get_report ───────────────────────────────────────────────────── */
  out = await Configured({ action: 'get_report', item_id: 'not-an-id' }, userInfo, makeApp([]))
  assert.strictEqual(out.success, false)
  assert(out.message.includes('item_id'))

  out = await Configured({ action: 'get_report', item_id: labItemId }, userInfo, makeApp([]))
  assert.strictEqual(out.success, false)
  assert(out.message.includes('ไม่ใช่รายการทางรังสี'))

  out = await Configured({ action: 'get_report', item_id: reportItemId }, labUser, makeApp([]))
  assert.strictEqual(out.success, false, 'an organization outside radiology cannot read reports')

  captures = []
  out = await Configured({ action: 'get_report', item_id: reportItemId }, userInfo, makeApp(captures))
  assert.strictEqual(out.success, true)
  assert.strictEqual(out.data.has_report, false)
  assert.strictEqual(out.data.accession_no, '20260831CR001')
  assert.deepStrictEqual(out.data.modality, { code: 'CR', label: 'CR-Computed Radiography' })
  assert.strictEqual(out.data.body_part, 'Chest')
  assert(out.message.includes('รอ RIS'), out.message)

  /* ต้องหาผลด้วย AccessionNo ใน zdata_xray_result เท่านั้น ห้ามกลับไปเดาฟอร์มเดิม */
  const lookup = captures.find(c => c.type === 'resultFind')
  assert(lookup, 'get_report must query the RIS result collection')
  assert.strictEqual(lookup.collection, 'zdata_xray_result')
  assert.strictEqual(lookup.query.AccessionNo, '20260831CR001')
  assert.deepStrictEqual(lookup.query.xrstatx, { $nin: [0, 3] })
  const sorted = captures.find(c => c.type === 'resultSort' && c.collection === 'zdata_xray_result')
  assert.strictEqual(sorted.order.ResultDateTime, -1, 'the newest report wins')
  assert(!captures.some(c => c.type === 'sdformGetAll'), 'the guessed result form is gone')

  /* RIS ส่งผลมาเป็นข้อความก้อนเดียว และ insert ทุกครั้ง ⇒ ต้องหยิบฉบับล่าสุด
     พร้อมบอกจำนวนฉบับให้หน้าจอเตือนผู้ใช้ได้ */
  out = await Configured(
    { action: 'get_report', item_id: reportItemId },
    userInfo,
    makeApp([], { resultRows: [
      {
        ResultText: 'Normal chest radiograph.',
        ResultDateTime: '2026-08-31 10:30:00',
        RadiologistUid: 'RAD-007',
        SeverityUid: 'N',
        ImageCapturedDateTime: '2026-08-31 09:45:00',
        Status: 'C',
      },
      { ResultText: 'ฉบับเก่า', ResultDateTime: '2026-08-31 09:00:00' },
    ] }),
  )
  assert.strictEqual(out.data.has_report, true)
  assert.strictEqual(out.data.result_text, 'Normal chest radiograph.', 'the newest row wins')
  assert.strictEqual(out.data.reported_at, '2026-08-31 10:30:00')
  assert.strictEqual(out.data.performed_at, '2026-08-31 09:45:00', 'ImageCapturedDateTime beats dispatched_at')
  assert.strictEqual(out.data.radiologist_uid, 'RAD-007', 'the code travels as-is; never guess a name')
  assert.strictEqual(out.data.severity_uid, 'N')
  assert.strictEqual(out.data.result_versions, 2)
  assert(out.message.includes('2 ฉบับ'), out.message)

  /* ── ประวัติผลอ่านทุกฉบับ (เพิ่ม 2026-09-15) ────────────────────────────
     assertion ด้านบนทั้งหมดคือ "ฉบับล่าสุดชนะ" ซึ่งยังต้องจริงเหมือนเดิม —
     ของใหม่เป็นการ **เพิ่ม** ช่องทางดูฉบับเก่า ไม่ใช่เปลี่ยนว่าอันไหนเป็นฉบับหลัก */
  assert(Array.isArray(out.data.versions), 'get_report ต้องคืนประวัติทุกฉบับ')
  assert.strictEqual(out.data.versions.length, 2)
  assert.strictEqual(out.data.versions[0].latest, true, 'versions[0] คือฉบับล่าสุดเสมอ')
  assert.strictEqual(out.data.versions[0].no, 2, 'ฉบับล่าสุดคือฉบับที่ 2 จาก 2')
  assert.strictEqual(out.data.versions[0].result_text, 'Normal chest radiograph.')
  assert.strictEqual(out.data.versions[0].radiologist_uid, 'RAD-007')
  assert.strictEqual(out.data.versions[0].result_status, 'C')
  assert.strictEqual(out.data.versions[0].performed_at, '2026-08-31 09:45:00')
  assert.strictEqual(out.data.versions[1].latest, false)
  assert.strictEqual(out.data.versions[1].no, 1, 'ฉบับเก่าสุดคือฉบับที่ 1')
  assert.strictEqual(out.data.versions[1].result_text, 'ฉบับเก่า')
  assert.strictEqual(out.data.versions[1].reported_at, '2026-08-31 09:00:00')
  /* ฉบับเก่าไม่มีรหัสรังสีแพทย์ในแถวของมันเอง ⇒ ต้องว่าง ห้ามยืมของฉบับล่าสุดมาเติม
     ไม่งั้นประวัติจะโกหกว่าใครเป็นคนอ่านครั้งนั้น */
  assert.strictEqual(out.data.versions[1].radiologist_uid, '')
  assert.strictEqual(out.data.versions_capped, false, 'ยังไม่ชน limit 20')
  /* ฉบับล่าสุดใน versions ต้องเป็นตัวเดียวกับฟิลด์ระดับบนสุดเสมอ ห้ามหลุดจากกัน */
  assert.strictEqual(out.data.versions[0].result_text, out.data.result_text)
  assert.strictEqual(out.data.versions[0].reported_at, out.data.reported_at)
  assert.strictEqual(out.data.versions[0].radiologist_uid, out.data.radiologist_uid)

  /* ── ตัวแปรใน $lookup.let ต้องถูกอ้างด้วย $$ (บั๊กจริง 2026-09-17) ──────────
     `let: { accession: '$accession_no' }` แล้วในไปป์ไลน์เขียน '$accession'
     ดอลลาร์เดียว = อ้าง "ฟิลด์ชื่อ accession ในตารางปลายทาง" ซึ่งไม่มีอยู่จริง
     ⇒ เงื่อนไขเป็นเท็จเสมอ ⇒ lookup ไม่ match สักแถว **โดยไม่มี error ใด ๆ**
     ผลที่ผู้ใช้เห็น: ตารางไม่เคยขึ้น "ออกผลแล้ว" · ช่องเวลาออกผลว่าง ทั้งที่มีผลจริง
     (ยืนยันกับฐานข้อมูลจริง 2026-09-17: เวอร์ชันเดิม match 0 แถวทุกใบ ·
      หลังแก้ได้ ResultText 258 และ 346 ตัวอักษรของ DX001/DX003)
     กติกาที่เทสนี้บังคับ: **ทุกตัวแปรที่ประกาศใน let ต้องถูกใช้เป็น $$ชื่อ จริง**
     และห้ามมี '$ROOT' ดอลลาร์เดียวหลงอยู่ที่ไหนเลย */
  {
    const walk = (node, visit) => {
      if (Array.isArray(node)) { node.forEach(child => walk(child, visit)); return }
      if (!node || typeof node !== 'object') return
      visit(node)
      Object.keys(node).forEach(key => walk(node[key], visit))
    }
    /* ต้องยิง list เองในบล็อกนี้ — captures ตรงนี้เป็นของ get_report ซึ่งไม่มีไปป์ไลน์ */
    const lookupCaptures = []
    await Configured({ action: 'list' }, userInfo, makeApp(lookupCaptures))
    const pipeline = lastPipeline(lookupCaptures)
    const lookups = []
    walk(pipeline, node => { if (node.$lookup && node.$lookup.let) lookups.push(node.$lookup) })
    assert(lookups.length >= 2, 'ต้องมี $lookup ที่ใช้ let อยู่จริง ไม่งั้นเทสนี้เฝ้าอากาศ')
    lookups.forEach(lookup => {
      const text = JSON.stringify(lookup.pipeline || [])
      Object.keys(lookup.let).forEach(name => {
        assert(
          text.indexOf('$$' + name) >= 0,
          'ตัวแปร let "' + name + '" ของ lookup ปลายทาง ' + lookup.from +
            ' ไม่ถูกอ้างด้วย $$ — lookup นี้จะไม่ match อะไรเลยแบบเงียบ ๆ',
        )
      })
    })
    /* $$ROOT เขียนผิดเป็น $ROOT แล้ว latest จะเป็น null ทั้งที่นับ versions ได้ */
    assert(
      JSON.stringify(pipeline).indexOf('"$ROOT"') < 0,
      'พบ $ROOT ดอลลาร์เดียวในไปป์ไลน์ — ต้องเป็น $$ROOT',
    )
    /* เจาะจงตัวที่เคยพัง: ผลอ่านต้อง join ด้วยเลข Accession ของแถวนั้นจริง ๆ */
    const resultLookup = lookups.filter(l => l.from === 'zdata_xray_result')[0]
    assert(resultLookup, 'ต้องยัง join ตารางผลอ่านอยู่')
    const expr = JSON.stringify(resultLookup.pipeline[0].$match.$expr)
    assert(expr.indexOf('"$$accession"') >= 0, expr)
    assert(expr.indexOf('"$AccessionNo"') >= 0, 'ต้องเทียบกับฟิลด์ AccessionNo ของตารางผลอ่าน')
  }

  /* ไม่มีผลอ่านเลย = versions ว่าง ไม่ใช่ undefined — หน้าจอจะได้ .length ได้เสมอ */
  out = await Configured({ action: 'get_report', item_id: reportItemId }, userInfo, makeApp([]))
  assert.deepStrictEqual(out.data.versions, [])
  assert.strictEqual(out.data.versions_capped, false)

  /* ── ประวัติย้ายไปอ่าน zdata_zdata_xray_result_log (2026-09-16) ────────────
     ทีมแยกตารางตั้งแต่ 2026-09-09: ตารางผลอ่านถูก upsert ทับเหลือแถวเดียวต่อ accession
     ส่วนทุกฉบับไปกองที่ log พร้อม ResultId ⇒ จำลองเคสจริงของ SM20260910DX003:
     result 1 แถว · log 2 ฉบับ (ResultId 6 → 13) */
  captures = []
  out = await Configured(
    { action: 'get_report', item_id: reportItemId },
    userInfo,
    makeApp(captures, {
      resultRows: [
        { ResultText: 'ฉบับล่าสุด (ทับแล้ว)', ResultDateTime: '2026-08-31 10:30:00', RadiologistUid: 'RAD-007' },
      ],
      logRows: [
        {
          ResultId: 13, ResultText: 'ฉบับล่าสุด (ทับแล้ว)', ResultDateTime: '2026-08-31 10:30:00',
          RadiologistUid: 'RAD-007', Status: 'C', MessageControlId: 'MSG-13',
        },
        {
          ResultId: 6, ResultText: 'ฉบับแรก', ResultDateTime: '2026-08-31 09:00:00',
          RadiologistUid: 'RAD-001', Status: 'F', MessageControlId: 'MSG-6',
        },
      ],
    }),
  )
  /* ฉบับปัจจุบันยังมาจากตารางผลอ่านเดิมทุกฟิลด์ — ห้ามเปลี่ยนแหล่ง */
  assert.strictEqual(out.data.result_text, 'ฉบับล่าสุด (ทับแล้ว)')
  assert.strictEqual(out.data.radiologist_uid, 'RAD-007')
  /* ประวัติมาจาก log ⇒ ได้ 2 ฉบับ ทั้งที่ตารางผลอ่านมีแถวเดียว */
  assert.strictEqual(out.data.versions.length, 2, 'ประวัติต้องมาจาก log ไม่ใช่ตารางผลอ่าน')
  assert.strictEqual(out.data.result_versions, 2)
  assert.strictEqual(out.data.versions[0].result_id, '13', 'เรียงด้วย ResultId ฉบับล่าสุดมาก่อน')
  assert.strictEqual(out.data.versions[0].latest, true)
  assert.strictEqual(out.data.versions[1].result_id, '6')
  assert.strictEqual(out.data.versions[1].result_text, 'ฉบับแรก')
  assert.strictEqual(out.data.versions[1].radiologist_uid, 'RAD-001', 'คนอ่านของแต่ละฉบับต้องไม่ปนกัน')
  assert(out.message.includes('2 ฉบับ'), out.message)

  const logFind = captures.find(c => c.type === 'resultFind' && c.collection === 'zdata_zdata_xray_result_log')
  assert(logFind, 'ต้องไปอ่านตาราง log ด้วย')
  assert.strictEqual(logFind.query.AccessionNo, '20260831CR001', 'ค้นด้วย Accession เดียวกัน')
  assert.deepStrictEqual(logFind.query.xrstatx, { $nin: [0, 3] }, 'แถวที่ถูกลบต้องไม่ติดมา')
  const logSort = captures.find(c => c.type === 'resultSort' && c.collection === 'zdata_zdata_xray_result_log')
  assert.strictEqual(logSort.order.ResultId, -1, 'เรียงด้วย ResultId เป็นหลัก')
  assert.strictEqual(logSort.order.ResultDateTime, -1, 'แล้วค่อยตกไปที่เวลา')
  /* ตารางผลอ่านเดิมยังถูกอ่านอยู่ — ห้ามเผลอเลิกอ่าน */
  assert(
    captures.some(c => c.type === 'resultFind' && c.collection === 'zdata_xray_result'),
    'ฉบับปัจจุบันยังต้องอ่านจาก zdata_xray_result',
  )

  /* log อ่านไม่ได้/ยังไม่มีข้อมูล = ตกกลับไปใช้ตารางผลอ่านเดิม (พฤติกรรมก่อน 2026-09-16) */
  out = await Configured(
    { action: 'get_report', item_id: reportItemId },
    userInfo,
    makeApp([], {
      resultRows: [
        { ResultText: 'A', ResultDateTime: '2026-08-31 10:30:00' },
        { ResultText: 'B', ResultDateTime: '2026-08-31 09:00:00' },
      ],
      logRows: [],
    }),
  )
  assert.strictEqual(out.data.versions.length, 2, 'ไม่มี log = ใช้ตารางผลอ่านเหมือนเดิม')
  assert.strictEqual(out.data.versions[0].result_id, '', 'ตารางผลอ่านไม่มี ResultId ⇒ ปล่อยว่าง')
  assert.strictEqual(out.data.result_versions, 2)

  /* ยังไม่ได้ส่งเข้าเครื่อง = ไม่มีเลข ⇒ ไม่ต้องไปหาผล และต้องบอกเหตุผลให้ตรง */
  out = await Configured(
    { action: 'get_report', item_id: noAccessionItemId },
    userInfo,
    makeApp([]),
  )
  assert.strictEqual(out.success, true)
  assert.strictEqual(out.data.has_report, false)
  assert(out.message.includes('ยังไม่ได้ส่งเข้าเครื่อง'), out.message)

  /* ── read-only ────────────────────────────────────────────────────── */
  out = await Configured({ action: 'dispatch', item_id: reportItemId }, userInfo, makeApp([]))
  assert.strictEqual(out.success, false)
  assert(out.message.includes('ไม่รองรับ action'))
  assert(!apiBody.includes('dbUpdate'), 'this process is read-only')
  assert(!apiBody.includes('dbInsert'), 'this process is read-only')

  console.log('X-ray CPOE worklist API tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
