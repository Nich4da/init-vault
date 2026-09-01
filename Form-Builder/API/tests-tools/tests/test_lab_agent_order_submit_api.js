const assert = require('assert')
const fs = require('fs')
const path = require('path')

const source = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/lab_agent_order_submit_api.js'),
  'utf8',
)
const configuredSource = source
  .replace("const AGENT_URL = '__CONFIGURE_AGENT_URL__'", "const AGENT_URL = 'http://agent.test:8080'")
  .replace("const AGENT_KEY = '__CONFIGURE_AGENT_KEY__'", "const AGENT_KEY = 'test-only-key'")
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const Process = new AsyncFunction('params', 'userInfo', 'app', configuredSource)
const UnconfiguredProcess = new AsyncFunction('params', 'userInfo', 'app', source)

const payload = () => ({
  order_no: 'ORDER-UAT-001',
  labno: '6908310001',
  hn: 'HN-UAT-001',
  visit_id: 'VN-UAT-001',
  ordered_at: '2026-08-31T08:00:00+07:00',
  requested_at: '20260831080000',
  priority: 'R',
  patient_prefix: 'ด.ช.',
  patient_first_name: 'ผู้ป่วย',
  patient_last_name: 'ทดสอบ',
  birth_date: '20200101',
  sex: 'M',
  visit_type: 'OP',
  doctor_code: 'DOC-UAT',
  doctor_title: 'นพ.',
  doctor_name: 'แพทย์ ทดสอบ',
  clinic_code: 'UAT',
  clinic_name: 'คลินิกทดสอบ',
  station: 'LAB UAT',
  station_seq: '1',
  special_request: 'none',
  diagnosis: 'UAT only',
  antimicrobial_used: 'none',
  underlying_disease: 'none',
  mongo_form_id: 'FORM-UAT',
  mongo_data_id: 'DATA-UAT',
  items: [{
    seq: 1,
    test_code: 'HIS-CODE-001',
    test_name: 'Test UAT',
    specimen_code: 'CD',
    specimen_name: 'Clotted blood',
    collector_code: 'COL-UAT',
    collector_name: 'Collector UAT',
    lab_code: 'CHEM',
    collected_at: '2026-08-31T08:10:00+07:00',
    received_at: '2026-08-31T08:20:00+07:00',
    receiver: 'LAB-UAT',
  }],
})

const userInfo = { roles: ['auth'], username: 'lab-uat' }
const appWith = handler => ({
  isAuth: () => true,
  axios: { post: handler },
})

;(async () => {
  {
    const calls = []
    const result = await Process({ payload: payload() }, userInfo, appWith(async (...args) => {
      calls.push(args)
      return {
        status: 202,
        data: {
          ok: true,
          order_no: 'ORDER-UAT-001',
          order_ref: 'ORDER-REF-UAT',
          duplicate: false,
          routed_to: ['CHEM'],
          dispatch_id: 'DISPATCH-UAT',
        },
      }
    }))
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.hl7_status, 'queued')
    assert.strictEqual(result.data.duplicate, false)
    assert.strictEqual(calls.length, 1)
    assert.strictEqual(calls[0][0], 'http://agent.test:8080/api/orders')
    assert.strictEqual(calls[0][2].timeout, 5000)
    assert.strictEqual(calls[0][2].headers['X-Agent-Key'], 'test-only-key')
    assert.strictEqual(calls[0][1].items[0].test_code, 'HIS-CODE-001')
    assert.strictEqual(calls[0][1].items[0].lab_code, 'CHEM')
  }

  {
    const result = await Process({ payload: payload() }, userInfo, appWith(async () => ({
      status: 200,
      data: { ok: true, order_no: 'ORDER-UAT-001', duplicate: true },
    })))
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.duplicate, true)
    assert.strictEqual(result.data.hl7_status, 'queued')
  }

  {
    let called = false
    const bad = payload()
    bad.items[0].collected_at = ''
    bad.extra_field = 'not allowed'
    const result = await Process({ payload: bad }, userInfo, appWith(async () => {
      called = true
      return { status: 202, data: {} }
    }))
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'invalid_payload')
    assert(result.errors.some(error => error.includes('extra_field')))
    assert(result.errors.some(error => error.includes('collected_at')))
    assert.strictEqual(called, false)
  }

  {
    let called = false
    const oversized = payload()
    oversized.diagnosis = 'ก'.repeat(400000)
    const result = await Process({ payload: oversized }, userInfo, appWith(async () => {
      called = true
      return { status: 202, data: {} }
    }))
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'payload_too_large')
    assert(result.body_bytes > 1024 * 1024)
    assert.strictEqual(called, false)
  }

  {
    const bad = payload()
    bad.ordered_at = '2026-08-31T01:00:00Z'
    const result = await Process({ payload: bad }, userInfo, appWith(async () => {
      throw new Error('must not call')
    }))
    assert.strictEqual(result.success, false)
    assert(result.errors.some(error => error.includes('+07:00')))
  }

  {
    const result = await Process({ payload: payload() }, userInfo, appWith(async () => ({
      status: 422,
      data: { ok: false, error: 'mapping_failed', reason: 'unknown test_code' },
    })))
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.retryable, false)
    assert.strictEqual(result.hl7_status, 'new')
    assert.strictEqual(result.error, 'mapping_failed')
  }

  {
    const result = await Process({ payload: payload() }, userInfo, appWith(async () => ({
      status: 503,
      data: { ok: false, error: 'draining', reason: 'maintenance' },
    })))
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.retryable, true)
    assert.strictEqual(result.hl7_status, 'new')
  }

  {
    const result = await Process({ payload: payload() }, userInfo, appWith(async () => {
      const error = new Error('timeout')
      error.code = 'ECONNABORTED'
      throw error
    }))
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'agent_unreachable')
    assert.strictEqual(result.retryable, true)
    assert.strictEqual(result.hl7_status, 'new')
  }

  {
    const result = await Process({ payload: payload() }, userInfo, appWith(async () => ({
      status: 202,
      data: { ok: true, order_no: 'OTHER-ORDER', duplicate: false },
    })))
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'invalid_agent_response')
    assert.strictEqual(result.retryable, true)
  }

  {
    const result = await Process({ payload: payload() }, userInfo, appWith(async () => ({
      status: 202,
      data: { ok: true, order_no: 'ORDER-UAT-001' },
    })))
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'invalid_agent_response')
    assert.strictEqual(result.retryable, true)
  }

  {
    const result = await UnconfiguredProcess({ payload: payload() }, userInfo, appWith(async () => {
      throw new Error('must not call')
    }))
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'not_configured')
  }

  {
    const noAuthApp = appWith(async () => ({ status: 202, data: {} }))
    noAuthApp.isAuth = () => false
    const result = await Process({ payload: payload() }, userInfo, noAuthApp)
    assert.strictEqual(result.success, false)
    assert(result.message.includes('ไม่มีสิทธิ์'))
  }

  console.log('LAB Agent order submit API tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
