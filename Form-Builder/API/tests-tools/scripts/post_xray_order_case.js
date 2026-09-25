/*
 * ยิงเคสจาก xray_order_ris_params.json ไปที่ RIS Order endpoint
 *
 *   node Form-Builder/API/tests-tools/scripts/post_xray_order_case.js <case_name>
 *   node ... <case_name> --send            ← ยิงจริง
 *   node ... <case_name> --send --input    ← ห่อฟิลด์ไว้ใต้ params.input
 *   node ... --list
 *
 * endpoint และ token อ่านจาก env เท่านั้น ไม่เก็บลงรีโป:
 *   export XRAY_RIS_URL='https://.../api/v1/process/public'
 *   export XRAY_RIS_TOKEN='<token>'
 *
 * ไม่ใส่ --send = พิมพ์ body ออกมาเฉย ๆ ไม่ติดต่อระบบภายนอก
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const fixturePath = path.join(root, 'Form-Builder/SDForm/tests-tools/fixtures/xray_order_ris_params.json')
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))

const args = process.argv.slice(2)
const flags = new Set(args.filter(arg => arg.startsWith('--')))
const caseName = args.find(arg => !arg.startsWith('--'))

if (flags.has('--list') || !caseName) {
  console.log('เคสที่มี:')
  fixture.cases.forEach(row => {
    console.log('  ' + row.expect.padEnd(7) + row.name + '  — ' + row.reason)
  })
  if (!caseName) process.exit(flags.has('--list') ? 0 : 1)
  process.exit(0)
}

const testCase = fixture.cases.find(row => row.name === caseName)
if (!testCase) {
  console.error('ไม่พบเคสชื่อ "' + caseName + '" · ดูรายชื่อด้วย --list')
  process.exit(1)
}

const payload = flags.has('--input')
  ? { params: { input: testCase.params } }
  : { params: testCase.params }

console.log('# case   : ' + testCase.name + '  (expect ' + testCase.expect + ')')
console.log('# reason : ' + testCase.reason)
if (testCase.note) console.log('# note   : ' + testCase.note)
console.log(JSON.stringify(payload, null, 2))

if (!flags.has('--send')) {
  console.log('\n(ไม่ได้ยิงจริง — เติม --send เมื่อพร้อม)')
  process.exit(0)
}

const url = process.env.XRAY_RIS_URL
const token = process.env.XRAY_RIS_TOKEN
if (!url || !token) {
  console.error('\nต้องตั้ง XRAY_RIS_URL และ XRAY_RIS_TOKEN ก่อนจึงจะ --send ได้')
  process.exit(1)
}

/* ตรวจสอบกับ endpoint จริงเมื่อ 2026-09-01:
   - gateway บังคับให้ body มี property `params` ที่ระดับบนสุด ตรวจ "ก่อน" ตรวจ token
     (`{}` ตอบ "body must have required property 'params'")
   - token ต้องส่งทาง **Authorization: Bearer** เท่านั้น
     ?token= / token: / x-token: ทั้งสามแบบตอบ "Missing token header"
     ส่วน Authorization ตอบ "Token not valid" คือ gateway อ่านค่าแล้วแต่ปฏิเสธ
   ยังส่ง ?token= ติดไปด้วยเผื่อ deployment เก่าที่รับแบบ query */
;(async () => {
  const target = url + (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token)
  const response = await fetch(target, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify(payload),
  })
  const text = await response.text()
  console.log('\n# HTTP ' + response.status)
  try {
    const json = JSON.parse(text)
    console.log(JSON.stringify(json, null, 2))
    const ack = (json && json.data) || {}
    if (ack.AcknowledgementCode) {
      console.log('\n# AcknowledgementCode = ' + ack.AcknowledgementCode +
        (ack.TextMessage ? ' · ' + ack.TextMessage : ''))
    }
    if (Array.isArray(ack.ReceivedRootKeys)) {
      console.log('# ReceivedRootKeys  = ' + JSON.stringify(ack.ReceivedRootKeys))
      console.log('# ReceivedInputKeys = ' + JSON.stringify(ack.ReceivedInputKeys || []))
    }
    if (json && json.error === 'Unauthorized') {
      console.log('\n# token ใช้ไม่ได้ — สร้าง public token ใหม่ของ Process นี้แล้วตั้ง XRAY_RIS_TOKEN ใหม่')
    }
    if (json && /required property 'params'/.test(String(json.message || ''))) {
      console.log('\n# body ต้องมี params ที่ระดับบนสุดเสมอ — gateway ตรวจข้อนี้ก่อน token')
    }
  } catch (error) {
    console.log(text)
  }
})().catch(error => {
  console.error('ยิงไม่สำเร็จ: ' + ((error && error.message) || error))
  process.exit(1)
})
