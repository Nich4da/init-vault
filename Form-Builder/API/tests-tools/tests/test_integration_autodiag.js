'use strict'

const assert = require('assert')
const http = require('http')
const {
  classifyLabAgent,
  classifyLabOrderProcess,
  classifyLabResult,
  classifyXrayAck,
  renderMarkdown,
  runProfile,
  sanitize,
  validateLabOrder,
  validateLabResult,
  validateXrayDispatch,
  validateXrayOrder,
  validateXrayResult,
} = require('../scripts/integration_autodiag')

const labOrder = () => ({
  order_no: 'WORK-TEST-001',
  labno: '109999990001',
  hn: 'HN-TEST-001',
  visit_id: 'VN-TEST-001',
  ordered_at: '20260923100000',
  requested_at: '20260923095500',
  priority: 'R',
  sex: 'M',
  items: [{
    seq: 1,
    test_code: 'TEST-CODE',
    test_name: 'Integration test only',
    specimen_code: 'TEST',
    received_at: '20260923100500',
    receiver: 'AUTODIAG',
  }],
})

const labResult = () => ({
  order_no: 'WORK-TEST-001',
  filler_order_no: '109999990001',
  hn: 'HN-TEST-001',
  visit_id: 'VN-TEST-001',
  result_uid: 'RESULT-AUTODIAG-001',
  report_seq: '1',
  stage: 'partial',
  overall_status: 'in_progress',
  reported_at: '2026-09-23T10:10:00+07:00',
  reported_by: { source_id: 'AUTODIAG', source_name: 'Autodiag test identity' },
  items: [{
    obs_code: 'TEST-CODE',
    obs_name: 'Integration test only',
    value: 'TEST',
    obx_status: 'P',
    change_kind: 'new',
    receipt_seq: '1',
    result_version: '1',
    is_critical: false,
  }],
})

const xrayOrder = () => ({
  Hn: 'HN-TEST-001',
  PatientFName: 'ทดสอบ',
  PatientGender: 'U',
  PatientDob: '2000-01-01',
  PatientClassUid: 'O',
  VisitNo: 'VN-TEST-001',
  AccessionNo: 'SM20990101DX001',
  ExamUid: 'TEST-EXAM',
  ExamName: 'Integration test only',
})

const xrayResult = () => ({
  Hn: 'HN-TEST-001',
  AccessionNo: 'SM20990101DX001',
  ExamUid: 'TEST-EXAM',
  ExamName: 'Integration test only',
  RadiologistUid: 'AUTODIAG',
  ResultText: 'AUTODIAG TEST ONLY - NOT FOR CLINICAL USE',
  ResultDateTime: '2099-01-01 10:00:00',
})

async function withServer(handler, callback) {
  const server = http.createServer(handler)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  try {
    return await callback(`http://127.0.0.1:${address.port}/test`)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

async function run() {
  assert.deepStrictEqual(validateLabOrder(labOrder()), [])
  assert(validateLabOrder({}).some(message => message.includes('order_no')))
  const nullSpecimenTime = labOrder()
  nullSpecimenTime.items[0].collected_at = null
  assert(validateLabOrder(nullSpecimenTime).some(message => message.includes('collected_at')))

  assert.deepStrictEqual(validateLabResult(labResult()), [])
  const criticalWithoutDecision = labResult()
  delete criticalWithoutDecision.items[0].is_critical
  criticalWithoutDecision.items[0].critical_low_rule = 'test rule'
  assert(validateLabResult(criticalWithoutDecision).some(message => message.includes('explicit is_critical')))

  assert.deepStrictEqual(validateXrayDispatch({
    order_id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    item_ids: ['bbbbbbbbbbbbbbbbbbbbbbbb'],
  }), [])
  assert(validateXrayDispatch({ order_id: 'bad', item_ids: [] }).length >= 2)
  assert.deepStrictEqual(validateXrayOrder(xrayOrder()), [])
  assert.deepStrictEqual(validateXrayResult(xrayResult()), [])

  let checks = classifyLabAgent({
    status: 202,
    ms: 10,
    data: { ok: true, duplicate: false, order_no: labOrder().order_no, dispatch_id: 44 },
  }, labOrder(), false)
  assert(checks.some(row => row.code === 'AGENT_QUEUED' && row.level === 'PASS'))

  checks = classifyLabAgent({
    status: 202,
    ms: 10,
    data: { ok: true, duplicate: false, order_no: 'WRONG', dispatch_id: 44 },
  }, labOrder(), false)
  assert(checks.some(row => row.code === 'ORDER_NO_MISMATCH' && row.level === 'FAIL'))

  checks = classifyLabOrderProcess({
    status: 200,
    ms: 8,
    data: { data: { success: false, error: 'invalid_payload' } },
  }, {}, true)
  assert(checks.some(row => row.code === 'NO_WRITE_SMOKE_REACHED_PROCESS'))

  checks = classifyLabResult({
    status: 200,
    ms: 8,
    data: { data: { success: true, code: 'PROCESSED', data: { result_uid: labResult().result_uid, receipt_status: 'processed' } } },
  }, labResult(), false)
  assert(checks.some(row => row.code === 'RESULT_UID_CORRELATED' && row.level === 'PASS'))

  checks = classifyXrayAck({
    status: 200,
    ms: 7,
    data: { data: { AcknowledgementCode: 'AA', AccessionNo: xrayResult().AccessionNo, TextMessage: 'Result inserted' } },
  }, xrayResult(), false, 'xray-result')
  assert(checks.some(row => row.code === 'XRAY_ACK_AA' && row.level === 'PASS'))
  assert(checks.some(row => row.code === 'XRAY_RESULT_ORDER_LINK_NOT_PROVEN' && row.level === 'WARN'))

  const clean = sanitize({
    token: 'secret-token',
    Hn: 'HN-123',
    ResultText: 'private result',
    message: 'https://example.test/a?token=secret-token',
  })
  assert.strictEqual(clean.token, '[REDACTED]')
  assert.strictEqual(clean.Hn, '[REDACTED]')
  assert.strictEqual(clean.ResultText, '[REDACTED]')
  assert(!JSON.stringify(clean).includes('secret-token'))

  await withServer((request, response) => {
    let raw = ''
    request.on('data', chunk => { raw += chunk })
    request.on('end', () => {
      assert.strictEqual(request.headers['x-api-key'], 'test-secret')
      assert.deepStrictEqual(JSON.parse(raw), { params: {} })
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ data: { code: 'INVALID_PAYLOAD', success: false } }))
    })
  }, async url => {
    const report = await runProfile('lab-result', {}, null, {
      smoke: true,
      send: true,
      confirmWrite: false,
      timeout: 2000,
      env: {
        LAB_RESULT_URL: url,
        LAB_RESULT_API_KEY: 'test-secret',
      },
    })
    assert.strictEqual(report.summary.status, 'PASS')
    assert(report.checks.some(row => row.code === 'NO_WRITE_SMOKE_REACHED_PROCESS'))
  })

  let called = false
  await withServer((request, response) => {
    called = true
    response.writeHead(500)
    response.end('{}')
  }, async url => {
    const report = await runProfile('xray-result', xrayResult(), null, {
      smoke: false,
      send: true,
      confirmWrite: false,
      timeout: 2000,
      env: { XRAY_RESULT_URL: url, XRAY_RESULT_TOKEN: 'test-token' },
    })
    assert(report.checks.some(row => row.code === 'WRITE_CONFIRMATION_REQUIRED'))
  })
  assert.strictEqual(called, false, 'valid request without --confirm-write must not leave the process')

  const markdown = renderMarkdown({
    run_id: 'test-run',
    generated_at: '2026-09-23T00:00:00.000Z',
    summary: { status: 'FAIL' },
    reports: [{
      label: 'Test',
      mode: 'dry-run',
      summary: { status: 'FAIL' },
      checks: [{ level: 'FAIL', code: 'BROKEN', message: 'จุดผิด' }],
    }],
  })
  assert(markdown.includes('BROKEN'))
  assert(markdown.includes('จุดผิด'))

  console.log('Integration auto-diagnostic tests passed')
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})

