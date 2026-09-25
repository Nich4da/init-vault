/*
 * ยิง Result callback ไปที่ External API action `lis.receive`
 *
 *   node Form-Builder/API/tests-tools/scripts/post_lis_receive_case.js --list
 *   node ... partial                      ← พิมพ์ body เฉย ๆ ไม่ติดต่อระบบภายนอก
 *   node ... invalid --send               ← ยิง payload ที่ตั้งใจให้ผิด (ไม่เขียนข้อมูล)
 *   node ... partial --send               ← ยิงของจริง (เขียนข้อมูล)
 *
 * ความลับอ่านจาก env เท่านั้น ไม่เก็บลงรีโป:
 *   export LIS_RECEIVE_APIKEY='<api key>'
 *   export LIS_RECEIVE_HEADER='x-api-key'   # ชื่อ header (ค่าเริ่มต้น x-api-key)
 *   export LIS_RECEIVE_ACTION='lis.receive' # ค่าเริ่มต้น lis.receive
 *   export LIS_RECEIVE_URL='https://.../api/v1/external/lis.receive' # optional
 *
 * ค่าเริ่มต้นคือ dry-run เสมอ ต้องเติม --send จึงจะออกเน็ต
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const examples = path.join(root, 'Form-Builder/SDForm/api-factory/examples')

/* invalid = ตั้งใจให้ตกที่ validation ของ Process ก่อนถึงการเขียนข้อมูล
   hl7_result_upsert_api.js ตอบ INVALID_PAYLOAD ก่อนสร้าง Receipt เสมอ
   จึงใช้พิสูจน์ "ยิงถึง Process แล้ว" ได้โดยไม่ทิ้งข้อมูลค้าง */
const CASES = {
  invalid: {
    expect: 'INVALID_PAYLOAD',
    reason: 'ตกที่ validation ก่อนเขียนข้อมูล — ใช้พิสูจน์ว่า auth/transport ผ่านแล้ว',
    build: () => ({}),
  },
  partial: {
    expect: 'PROCESSED',
    reason: 'ผล partial ของจริง — เขียน Receipt/Report/Item',
    build: () => JSON.parse(fs.readFileSync(path.join(examples, 'agent_result_partial.json'), 'utf8')),
  },
  final: {
    expect: 'PROCESSED',
    reason: 'ผล final ของจริง — ต้องมี items ครบทุก selected_items',
    build: () => JSON.parse(fs.readFileSync(path.join(examples, 'agent_result_final.json'), 'utf8')),
  },
  corrected: {
    expect: 'PROCESSED',
    reason: 'Agent resend แบบ corrected — เขียนค่าปัจจุบันโดยไม่ส่ง corrected_by/corrected_at',
    build: () => {
      const payload = JSON.parse(fs.readFileSync(path.join(examples, 'agent_result_final.json'), 'utf8'))
      payload.result_uid = 'RESULT-TEST-CORRECTED-003'
      payload.report_seq = '3'
      payload.stage = 'corrected'
      payload.overall_status = 'corrected'
      payload.reported_at = '2026-08-25T10:20:00+07:00'
      delete payload.verified_at
      delete payload.verified_by
      payload.items = [{
        ...payload.items[0],
        value: '137',
        obx_status: 'C',
        change_kind: 'corrected',
        receipt_seq: '3',
        result_version: '3',
      }]
      return payload
    },
  },
  'legacy-corrector': {
    expect: 'INVALID_PAYLOAD',
    reason: 'no-write smoke — corrected_by/corrected_at เป็น audit ของดินสอ HIS ไม่ใช่ Agent contract',
    build: () => {
      const payload = JSON.parse(fs.readFileSync(path.join(examples, 'agent_result_final.json'), 'utf8'))
      payload.corrected_at = '2026-08-25T10:20:00+07:00'
      payload.corrected_by = { source_id: 'OLD-CONTRACT', source_name: 'Must be rejected' }
      return payload
    },
  },
}

const args = process.argv.slice(2)
const flags = new Set(args.filter(a => a.startsWith('--')))
const caseName = args.find(a => !a.startsWith('--'))

if (flags.has('--list') || !caseName) {
  console.log('เคสที่มี:')
  for (const [name, row] of Object.entries(CASES)) {
    console.log('  ' + row.expect.padEnd(17) + name.padEnd(18) + '— ' + row.reason)
  }
  process.exit(caseName || flags.has('--list') ? 0 : 1)
}

const testCase = CASES[caseName]
if (!testCase) {
  console.error('ไม่พบเคสชื่อ "' + caseName + '" · ดูรายชื่อด้วย --list')
  process.exit(1)
}

const action = process.env.LIS_RECEIVE_ACTION || 'lis.receive'
const params = testCase.build()

/* External API รุ่นใหม่ใช้ action เป็น path parameter และส่งเฉพาะ Process
   parameters ใน body.params: POST /api/v1/external/:action */
const body = { params }

console.log('# case   : ' + caseName + '  (expect ' + testCase.expect + ')')
console.log('# reason : ' + testCase.reason)
console.log('# action : ' + action)
console.log(JSON.stringify(body, null, 2))

if (!flags.has('--send')) {
  console.log('\n(dry-run — เติม --send เมื่อพร้อมยิงจริง)')
  process.exit(0)
}

const defaultBaseUrl = 'https://apihis.softmax-one.com/api/v1/external/'
const url = process.env.LIS_RECEIVE_URL || defaultBaseUrl + encodeURIComponent(action)
const key = process.env.LIS_RECEIVE_APIKEY
if (!key) {
  console.error('\nต้องตั้ง LIS_RECEIVE_APIKEY ก่อน (เก็บใน environment เท่านั้น)')
  process.exit(1)
}

const headerName = process.env.LIS_RECEIVE_HEADER || 'x-api-key'
const post = async () => {
  const started = Date.now()
  try {
    const res = await globalThis.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [headerName]: key },
      body: JSON.stringify(body),
    })
    const raw = await res.text()
    let parsed = null
    try { parsed = JSON.parse(raw) } catch (error) { /* keep raw */ }
    return { status: res.status, ms: Date.now() - started, raw, parsed }
  } catch (error) {
    return { status: 0, ms: Date.now() - started, raw: String(error && error.message || error), parsed: null }
  }
}

/* ตัวชี้ขาด: ข้อความของ gateway บอกว่า "ยังไม่ถึง Process"
   ส่วนโค้ดของ Process (INVALID_PAYLOAD ฯลฯ) บอกว่า "ถึงแล้ว" */
const verdict = result => {
  const text = (result.raw || '').toLowerCase()
  if (result.status === 0) return 'NETWORK   ' + result.raw
  if (text.includes('missing token header')) return 'GATEWAY   ไม่เห็น token ในตำแหน่งนี้'
  if (text.includes('token not valid') || text.includes('invalid api key') || text.includes('unauthorized')) {
    return 'GATEWAY   อ่านค่าแล้วแต่ปฏิเสธ'
  }
  if (text.includes("required property 'params'")) return 'GATEWAY   ยังไม่ถึง Process (body schema)'
  const code = result.parsed && (result.parsed.code || (result.parsed.data && result.parsed.data.code))
  if (code) return 'PROCESS   code=' + code
  return 'UNKNOWN   ตรวจ body ด้านล่างเอง'
}

const processResult = result => result.parsed && result.parsed.data && typeof result.parsed.data === 'object'
  ? result.parsed.data
  : result.parsed || {}

;(async () => {
  const result = await post()
  console.log('\n--- POST ' + url + ' (' + headerName + ') ---')
  console.log('HTTP ' + result.status + '  ' + result.ms + 'ms')
  console.log(verdict(result))
  console.log(result.raw.slice(0, 1200))
  const inner = processResult(result)
  if (inner.code !== testCase.expect) {
    console.error('\nFAIL: expected Process code ' + testCase.expect + ' but received ' + String(inner.code || '(none)'))
    process.exitCode = 2
  }
  if (caseName === 'invalid' && Array.isArray(inner.errors) && inner.errors.some(message => String(message).includes('xpartnerx'))) {
    console.error('\nFAIL: xpartnerx leaked into clinical schema validation')
    process.exitCode = 2
  }
})()
