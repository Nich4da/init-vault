/*
 * ล็อกชุด parameter ทดสอบตัวออกเลข Accession ให้ตรงกับ Process จริงเสมอ
 * ทุกข้อความคาดหวังในฟิกซ์เจอร์ต้องมีอยู่จริงใน xray_accession_generate_api.js
 * ถ้าใครแก้ข้อความหรือรูปแบบเลขในโค้ดแล้วลืมแก้ฟิกซ์เจอร์ เทสต์นี้จะแดง
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')

const FIXTURE_PATH = 'Form-Builder/SDForm/tests-tools/fixtures/xray_accession_params.json'
const rawFixture = read(FIXTURE_PATH)
const fixture = JSON.parse(rawFixture)
const api = read('Form-Builder/API/api-factory/processes/xray_accession_generate_api.js')

/* ── ฟิกซ์เจอร์ต้องชี้ไปที่ Process ตัวจริง ─────────────────────────────── */
assert.strictEqual(fixture.contract.process_id, '6a95cd58422c1ca959829e8d')
assert(api.includes('Deployed Process ID: ' + fixture.contract.process_id))
assert.strictEqual(fixture.contract.source, 'Form-Builder/API/api-factory/processes/xray_accession_generate_api.js')
assert(fs.existsSync(path.join(root, fixture.contract.source)), 'the named source file must exist')

/* ── รูปแบบเลขต้องตรงกับค่าคงที่ในโค้ด ไม่ใช่เขียนไว้เฉยๆ ──────────────── */
const format = fixture.number_format
assert(api.includes("const ACCESSION_PREFIX = 'SM'"), 'prefix in code')
assert(format.shape.startsWith('SM + YYYYMMDD'), 'fixture prefix must match the code')
assert(api.includes('const MAX_SEQUENCE = 999'))
assert(format.exhaustion.includes('999') && format.exhaustion.includes('1000'))
assert(api.includes('const WARN_FROM_SEQUENCE = 950'))
assert.strictEqual(Number(format.warning_from), 950)
assert(api.includes('const MODALITY_SEGMENT_LENGTH = 2'))
assert.strictEqual(format.modality_alias.VCUG, 'VC')
assert(api.includes("VCUG: 'VC'"), 'the alias must exist in the code')
assert.strictEqual(format.length, 15, 'SM + 8 + 2 + 3')
assert(format.length <= 16, 'must fit the RIS AccessionNo limit')
assert(new RegExp('^SM\\d{8}[A-Z0-9]{2}\\d{3}$').test(format.example), 'the example must match its own shape')
assert(format.counter_key.includes('xray_accession:SM:'), 'counter key shape')
assert(api.includes("['xray_accession', ACCESSION_PREFIX, dateKey, modalityCode].join(':')"))

/* ── input contract ─────────────────────────────────────────────────────── */
assert(api.includes("/^[a-f0-9]{24}$/i.test(itemId)"), 'the 24-hex rule the fixture documents')
assert.deepStrictEqual(Object.keys(fixture.contract.input), ['item_id'], 'the Process takes item_id and nothing else')

/* ── ทุกข้อความคาดหวังต้องมีอยู่จริงในโค้ด ─────────────────────────────── */
const expectedMessages = []
fixture.cases.forEach(testCase => {
  assert(testCase.name && testCase.why, 'every case states what it is for: ' + testCase.name)
  assert(['accept', 'reject'].includes(testCase.expect), 'expect must be accept or reject')
  assert(testCase.params && typeof testCase.params === 'object', 'every case carries a params object')
  if (testCase.expect_message) expectedMessages.push(testCase.expect_message)
  if (testCase.expect_message_contains) expectedMessages.push(testCase.expect_message_contains)
})
expectedMessages.forEach(message => {
  assert(api.includes(message), 'the API must actually be able to return: ' + message)
})
Object.keys(fixture.failure_messages_reference).forEach(fragment => {
  assert(api.includes(fragment), 'unknown failure fragment in the reference table: ' + fragment)
})

/* ── เคสที่ต้องมี ─────────────────────────────────────────────────────── */
const names = fixture.cases.map(c => c.name)
;['happy_path', 'idempotent_repeat', 'bad_item_id_format', 'item_not_found',
  'lab_item_rejected', 'resulted_item', 'half_dispatched_item_repair',
  'no_modality_in_master', 'wrong_organization']
  .forEach(required => assert(names.includes(required), 'missing case: ' + required))
assert.strictEqual(new Set(names).size, names.length, 'case names must be unique')

/* ── ห้ามมี id จริง credential หรือ URL ของ environment หลุดลงไฟล์ ─────── */
assert(!/eyJhbGciOi/.test(rawFixture), 'no JWT may be committed to the fixture')
assert(!/https?:\/\/[a-z0-9.-]*softmax/i.test(rawFixture), 'no environment URL may be committed')
fixture.cases.forEach(testCase => {
  const id = String(testCase.params.item_id || '')
  if (!id) return
  const isPlaceholder = id.startsWith('REPLACE_WITH_')
  const isObviouslySynthetic = /^0{24}$/.test(id) || !/^[a-f0-9]{24}$/i.test(id)
  assert(
    isPlaceholder || isObviouslySynthetic,
    'a real-looking database id must never be committed: ' + testCase.name,
  )
})

/* ── ขั้นตอนหา item_id ต้องชี้ไปที่ worklist Process ตัวจริง ───────────── */
const how = fixture.how_to_get_item_id
assert.strictEqual(how.step_1_process_id, '6a957009422c1ca959829e45')
const worklist = read('Form-Builder/API/api-factory/processes/xray_cpoe_worklist_api.js')
assert(worklist.includes('Deployed Process ID: ' + how.step_1_process_id))
assert(worklist.includes("item_id: { $toString: '$_id' }"), 'the worklist really does return item_id as a string')

/* ── Process นี้ต้องไม่แตะสถานะ — ฟิกซ์เจอร์บอกไว้ ต้องจริงด้วย ────────── */
assert(
  fixture.contract.side_effects.some(effect => effect.includes('ไม่แตะ current_status')),
  'the fixture must state that this Process does not change status',
)
assert(
  !/\$set:[\s\S]{0,400}current_status:/.test(api),
  'the accession Process must never write current_status — that belongs to dispatch (X3)',
)

console.log('X-ray accession parameter fixture tests passed (' + fixture.cases.length + ' cases)')
