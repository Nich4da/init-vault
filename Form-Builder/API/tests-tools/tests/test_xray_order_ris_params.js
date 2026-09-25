/*
 * ตรวจว่าชุด parameter ทดสอบ RIS Order ยังตรงกับสัญญาในฟอร์มจริง
 * สัญญาถูก "อ่านสด" จาก Form-Builder/SDForm/X-ray/xray_order.json ทุกครั้ง
 * ถ้าฟอร์มถูกแก้ (เพิ่ม/ลดฟิลด์ เปลี่ยน required เปลี่ยน format) เทสต์นี้จะพัง
 * ก่อนที่ payload ผิดสัญญาจะถูกยิงเข้า RIS จริง
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))

const ORDER_FORM_PATH = 'Form-Builder/SDForm/X-ray/xray_order.json'
const form = read(ORDER_FORM_PATH)
const fixture = read('Form-Builder/SDForm/tests-tools/fixtures/xray_order_ris_params.json')

/* ── derive the contract from the form itself ───────────────────────────── */
const fields = []
const walk = node => {
  const options = node.options || {}
  if (options.name && node.component !== 'vue-ui') {
    fields.push({
      name: options.name,
      component: node.component,
      fieldType: node.fieldType,
      required: options.required === true,
      valueFormat: options.valueFormat || '',
    })
  }
  ;(node.cols || []).forEach(walk)
  ;(node.fields || []).forEach(walk)
}
;(form.fields || []).forEach(walk)

const byName = Object.fromEntries(fields.map(field => [field.name, field]))
const required = fields.filter(field => field.required).map(field => field.name)
const numberFields = fields.filter(field => field.component === 'number-input').map(field => field.name)
const dateFields = fields.filter(field => field.component === 'date-input').map(field => field.name)

/* ── the fixture must not drift from the form ───────────────────────────── */
assert.deepStrictEqual(
  [...fixture.contract.required].sort(),
  [...required].sort(),
  'the fixture required list no longer matches xray_order.json',
)
assert.deepStrictEqual(
  [...fixture.contract.number_fields].sort(),
  [...numberFields].sort(),
  'number fields drifted from the form',
)
assert.deepStrictEqual(Object.keys(fixture.contract.date_fields).sort(), [...dateFields].sort())
dateFields.forEach(name => {
  assert.strictEqual(
    fixture.contract.date_fields[name],
    byName[name].valueFormat,
    name + ' must use the valueFormat the form declares',
  )
})
assert.strictEqual(fixture.contract.source, ORDER_FORM_PATH, 'the fixture must name the folder the form actually lives in')
assert.strictEqual(fixture.contract.limits.AccessionNo, 16)

/* ทุกฟิลด์ที่ fixture ใช้ ต้องมีอยู่จริงในฟอร์ม — กันสะกดผิดเงียบ ๆ */
fixture.cases.forEach(testCase => {
  Object.keys(testCase.params).forEach(name => {
    assert(byName[name], testCase.name + ' uses a field the form does not define: ' + name)
  })
})
Object.keys(fixture.source_mapping_proposal).forEach(name => {
  if (name.startsWith('_')) return
  assert(byName[name], 'the mapping proposal names a field the form does not define: ' + name)
})

/* ── validator ที่บังคับสัญญา ───────────────────────────────────────────── */
const ENUMS = fixture.contract.enums
const isBlank = value => value === undefined || value === null || String(value).trim() === ''

/* ตัดสินด้วยรายการบังคับของ **API** ไม่ใช่ของฟอร์ม — ทีมผ่อน AdmissionNo/PatientSsn
   เป็น optional แล้ว 2026-09-01 ฟอร์มยังไม่ได้แก้ตาม เวลาส่งจริง API เป็นตัวตัดสิน */
const enforcedRequired = fixture.server_logic.required
const validate = params => {
  const errors = []
  enforcedRequired.forEach(name => {
    if (isBlank(params[name])) errors.push('missing:' + name)
  })
  Object.keys(ENUMS).forEach(name => {
    if (isBlank(params[name])) return
    const allowed = Object.keys(ENUMS[name])
    if (!allowed.includes(String(params[name]))) errors.push('enum:' + name)
  })
  dateFields.forEach(name => {
    if (isBlank(params[name])) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(params[name]))) errors.push('format:' + name)
  })
  numberFields.forEach(name => {
    if (isBlank(params[name])) return
    if (!Number.isFinite(Number(params[name]))) errors.push('number:' + name)
  })
  Object.entries(fixture.contract.limits).forEach(([name, limit]) => {
    if (isBlank(params[name])) return
    if (String(params[name]).length > limit) errors.push('length:' + name)
  })
  return errors
}

let accepted = 0
let rejected = 0
fixture.cases.forEach(testCase => {
  const errors = validate(testCase.params)
  if (testCase.expect === 'accept') {
    assert.deepStrictEqual(errors, [], testCase.name + ' should pass the contract but got ' + errors.join(','))
    accepted++
  } else if (testCase.expect === 'reject') {
    assert(errors.length > 0, testCase.name + ' should fail the contract but passed')
    rejected++
  } else {
    assert.fail(testCase.name + ' has an unknown expect value: ' + testCase.expect)
  }
})
assert(accepted >= 8, 'keep enough accepted cases to be useful')
assert(rejected >= 8, 'keep enough rejected cases to be useful')

/* ── ทุกกรณีบังคับต้องมีตัวที่ขาดฟิลด์นั้นอย่างน้อยหนึ่งเคสหรือมีเหตุผลกำกับ ── */
const coveredEnums = new Set()
fixture.cases.forEach(testCase => {
  Object.keys(ENUMS).forEach(name => {
    if (!isBlank(testCase.params[name])) coveredEnums.add(name + ':' + testCase.params[name])
  })
})
;['PatientClassUid:O', 'PatientClassUid:I', 'PatientClassUid:E',
  'Priority:R', 'Priority:S', 'Priority:U',
  'Status:N', 'Status:A'].forEach(pair => {
  assert(coveredEnums.has(pair), 'no case exercises ' + pair)
})

/* ── เลขจากตัวออก accession ของเราต้องอยู่ในลิมิตของ RIS ────────────────── */
const generated = ['20260831CT001', '20260831VCUG001', '20260831MG005']
generated.forEach(accession => {
  assert(
    accession.length <= fixture.contract.limits.AccessionNo,
    accession + ' exceeds the RIS AccessionNo limit',
  )
})

/* ── ห้ามมีข้อมูลผู้ป่วยจริงหลุดเข้ามาในไฟล์ทดสอบ ──────────────────────── */
const raw = fs.readFileSync(
  path.join(root, 'Form-Builder/SDForm/tests-tools/fixtures/xray_order_ris_params.json'),
  'utf8',
)
fixture.cases.forEach(testCase => {
  /* เคสลบจงใจส่งค่าว่าง/ตัดฟิลด์ทิ้ง จึงตรวจเฉพาะตอนที่มีค่า */
  if (!isBlank(testCase.params.Hn)) {
    assert(
      String(testCase.params.Hn).startsWith('TEST-'),
      testCase.name + ' must use a synthetic HN',
    )
  }
  if (!isBlank(testCase.params.PatientSsn)) {
    assert(
      /^0{13}$/.test(String(testCase.params.PatientSsn)),
      testCase.name + ' must use a synthetic national ID',
    )
  }
  ;['VisitNo', 'AdmissionNo'].forEach(name => {
    if (isBlank(testCase.params[name])) return
    assert(
      String(testCase.params[name]).startsWith('TEST-'),
      testCase.name + ' must use a synthetic ' + name,
    )
  })
})
assert(!/@(gmail|hotmail|yahoo)\./i.test(raw), 'no real mailbox may appear in the fixture')

/* ── transport + ACK contract ที่บันทึกจากการยิงจริง ───────────────────── */
assert(fixture.transport, 'the fixture must record how the payload is transported')
assert.strictEqual(fixture.transport.method, 'POST')
assert.strictEqual(fixture.transport.content_type, 'application/json')
assert.strictEqual(fixture.transport.process_id, '6a8f1ef87632d182ef6914fe')
const rawFixture = fs.readFileSync(
  path.join(root, 'Form-Builder/SDForm/tests-tools/fixtures/xray_order_ris_params.json'),
  'utf8',
)
assert(!/eyJhbGciOi/.test(rawFixture), 'no JWT may be committed to the fixture')
assert(!/https?:\/\/[a-z0-9.-]*softmax/i.test(rawFixture), 'no environment URL may be committed')

const ack = fixture.response_contract
assert(ack, 'the fixture must record the ACK contract')
assert.strictEqual(ack.observed_example.AcknowledgementCode, 'AE')
assert.deepStrictEqual(ack.observed_example.ReceivedRootKeys, [])

/* รายชื่อฟิลด์บังคับที่ RIS ตอบกลับ ต้องตรงกับ required ที่ derive จากฟอร์ม
   ถ้าวันหนึ่งไม่ตรง แปลว่าฟอร์มกับ validator ฝั่ง RIS หลุดจากกันแล้ว */
const risRequired = ack.observed_example.TextMessage
  .split(':')[1]
  .split(',')
  .map(name => name.trim())
  .filter(Boolean)
assert.deepStrictEqual(
  [...risRequired].sort(),
  [...required].sort(),
  'the required list the RIS reports no longer matches xray_order.json',
)

/* ── ล็อกกับซอร์ส API ของทีม ─────────────────────────────────────────────
   ถ้าทีมแก้ validation หรือวิธีแกะ payload แล้วฟิกซ์เจอร์ยังเขียนแบบเดิม เทสต์นี้จะแดง */
const serverLogic = fixture.server_logic
assert(serverLogic, 'fixture must carry a server_logic section')
const teamApiPath = 'Form-Builder/API/api-factory/xray_api_order.js'
if (fs.existsSync(path.join(root, teamApiPath))) {
  const teamApi = fs.readFileSync(path.join(root, teamApiPath), 'utf8')

  assert(serverLogic._source.includes(teamApiPath), 'server_logic must name the file it was read from')
  assert(teamApi.includes("const FORM_ID = '" + serverLogic.form_id + "'"))
  assert(teamApi.includes("const FORM_TABLE = '" + serverLogic.table + "'"))

  /* ทีมผ่อน AdmissionNo/PatientSsn เป็น optional เมื่อ 2026-09-01 ⇒ ฟอร์มกับ API
     ไม่เท่ากันโดยตั้งใจ · API เป็นตัวตัดสินตอนส่งจริง
     กฎที่ยังต้องจริงเสมอ: API ห้ามบังคับฟิลด์ที่ฟอร์มไม่ได้ประกาศ และส่วนต่าง
     ต้องเท่ากับรายการที่บันทึกว่าผ่อนไว้เป๊ะๆ ไม่งั้นแปลว่ามี drift รอบใหม่ */
  const teamRequired = (teamApi.match(/const required = \[([\s\S]*?)\];/) || [])[1]
  assert(teamRequired, 'cannot find the required list in the team API')
  const teamRequiredNames = (teamRequired.match(/'([A-Za-z]+)'/g) || []).map(x => x.replace(/'/g, ''))

  assert.deepStrictEqual(
    [...teamRequiredNames].sort(),
    [...serverLogic.required].sort(),
    'the team API required list changed — update server_logic.required in the fixture',
  )
  teamRequiredNames.forEach(name => {
    assert(required.includes(name), 'the API requires a field the form never declares: ' + name)
  })
  assert.deepStrictEqual(
    required.filter(name => !teamRequiredNames.includes(name)).sort(),
    [...serverLogic.relaxed_2026_09_01].sort(),
    'form-vs-API difference no longer matches the recorded relaxation',
  )
  ;['AdmissionNo', 'PatientSsn'].forEach(name => {
    assert(!teamRequiredNames.includes(name), name + ' must stay optional')
  })

  /* วิธีแกะ payload — ตัดสินว่าเราต้องส่ง body ทรงไหน
     เทียบรายชื่อ wrapper แบบตรงตัว ถ้าทีมเพิ่ม/ลบชื่อใด ฟิกซ์เจอร์ต้องตามทันที */
  const wrapperList = (teamApi.match(/const wrapped = \[([^\]]*)\]/) || [])[1]
  assert(wrapperList, 'cannot find the unwrap list in the team API')
  const wrapperKeys = (wrapperList.match(/'([^']+)'/g) || []).map(x => x.replace(/'/g, ''))
  assert.deepStrictEqual(
    wrapperKeys,
    fixture.transport.unwrap_keys,
    'the team API unwrap list changed — our body shape may no longer arrive',
  )
  assert(!wrapperKeys.includes('input'), 'params.input is not a supported wrapper')
  assert(teamApi.includes('depth < ' + fixture.transport.unwrap_depth), 'unwrap depth')

  /* validation ที่ฟิกซ์เจอร์อ้าง ต้องมีอยู่จริง */
  assert(!teamApi.includes('/^\\d{13}$/'), 'the SSN 13-digit rule was removed 2026-09-01 — do not reintroduce it silently')
  assert(teamApi.includes('.length > 16'), 'AccessionNo 16-char rule')
  assert(teamApi.includes("['M', 'F', 'U']") && teamApi.includes("['O', 'I', 'E']"))
  assert(teamApi.includes("['R', 'S', 'U']"), 'Priority enum')
  assert(teamApi.includes("['N', 'A', 'C']"), 'Status enum — the form only declares N and A')
  assert(
    Object.keys(fixture.contract.enums.Status).sort().join('') === 'ACN',
    'the fixture Status enum must cover what the API actually accepts',
  )

  /* AccessionNo เป็นกุญแจธุรกิจตัวเดียว ⇒ ยิงซ้ำได้ */
  assert(teamApi.includes('`AccessionNo` = :accessionNo'), 'lookup is by AccessionNo')
  assert(teamApi.includes("'Order updated'") && teamApi.includes("'Order created'"))
  assert(serverLogic.business_key === 'AccessionNo')
  assert(serverLogic.retry_safety.includes('ไม่เกิดใบซ้ำ'))

  /* AA/AR ที่ฟิกซ์เจอร์บันทึกไว้ ต้องตรงกับซอร์ส */
  assert(teamApi.includes("reply(\n  'AA',") || teamApi.includes("'AA'"), 'AA exists')
  assert(!/'AR'/.test(teamApi), 'the fixture says AR is never returned — keep that true')
}

/* ── transport ที่ตรวจกับ endpoint จริงแล้ว ต้องไม่ถูกแก้กลับโดยไม่มีหลักฐาน ──── */
assert(fixture.transport.auth_header.startsWith('Authorization: Bearer'), 'auth slot')
assert(fixture.transport.gateway_body_rule.includes('params'), 'gateway body rule')
assert(fixture.transport.body_primary.startsWith('{"params"'), 'body must wrap in params')
assert(Array.isArray(fixture.pending_on_team) && fixture.pending_on_team.length,
  'the fixture must carry what is still waiting on the team')
assert(
  fixture.resolved.some(item => item.includes('AdmissionNo') && item.includes('optional')),
  'the AdmissionNo/PatientSsn relaxation shipped — it belongs in resolved, not pending',
)
assert(
  !fixture.pending_on_team.some(item => item.includes('AdmissionNo')),
  'a shipped change must not stay in pending_on_team',
)
assert(!/eyJhbGciOi/.test(rawFixture), 'no JWT may be committed')
assert(!/https?:\/\/[a-z0-9.-]*softmax/i.test(rawFixture), 'no environment URL may be committed')

console.log(
  'X-ray RIS Order parameter fixture tests passed (' +
  accepted + ' accept / ' + rejected + ' reject)',
)
