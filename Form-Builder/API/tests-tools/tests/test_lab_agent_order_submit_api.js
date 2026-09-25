const assert = require('assert')
const fs = require('fs')
const path = require('path')

const source = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/lab_agent_order_submit_api.js'),
  'utf8',
)
const configuredSource = source
  .replace("const AGENT_URL = '__CONFIGURE_AGENT_URL__'", "const AGENT_URL = 'http://agent.test:8080/api/orders'")
  .replace("const AGENT_KEY = '__CONFIGURE_AGENT_KEY__'", "const AGENT_KEY = 'test-only-key'")
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const Process = new AsyncFunction('params', 'userInfo', 'app', configuredSource)
const UnconfiguredProcess = new AsyncFunction('params', 'userInfo', 'app', source)

assert(!source.includes('validateStatus'), 'Agent Submit must not pass validateStatus through initCraft HTTP proxy')

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
const clone = value => JSON.parse(JSON.stringify(value))
const appWith = handler => {
  const outboundRows = new Map()
  let generatedId = 0
  const matches = (row, query) => {
    if (query._id != null && String(row._id) !== String(query._id)) return false
    if (query.order_no != null && row.order_no !== query.order_no) return false
    if (query.xrstatx != null && row.xrstatx !== query.xrstatx) return false
    if (query.attempt_count != null && Number(row.attempt_count || 0) !== Number(query.attempt_count)) return false
    if (query.hl7_status && query.hl7_status.$in && !query.hl7_status.$in.includes(row.hl7_status)) return false
    if (typeof query.hl7_status === 'string' && row.hl7_status !== query.hl7_status) return false
    return true
  }
  const collection = {
    findOne: async query => {
      for (const row of outboundRows.values()) if (matches(row, query)) return clone(row)
      return null
    },
    insertOne: async document => {
      const row = clone(document)
      row._id = row._id || `OUTBOUND-${++generatedId}`
      if (outboundRows.has(String(row._id))) throw new Error('duplicate key')
      outboundRows.set(String(row._id), row)
      return { insertedId: row._id }
    },
    updateOne: async (query, update) => {
      for (const [key, row] of outboundRows.entries()) {
        if (!matches(row, query)) continue
        Object.assign(row, clone(update.$set || {}))
        outboundRows.set(key, row)
        return { matchedCount: 1, modifiedCount: 1 }
      }
      return { matchedCount: 0, modifiedCount: 0 }
    },
  }
  return {
    isAuth: () => true,
    curDate: () => '2026-09-03 20:00:00',
    dbObjectId: value => String(value),
    db: { collection: name => name === 'zdata_lab_outband_order' ? collection : null },
    axios: { post: handler },
    outboundRows,
  }
}

;(async () => {
  {
    const calls = []
    const testApp = appWith(async (...args) => {
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
    })
    const result = await Process({ payload: payload() }, userInfo, testApp)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.hl7_status, 'queued')
    assert.strictEqual(result.data.duplicate, false)
    assert.strictEqual(calls.length, 1)
    assert.strictEqual(calls[0][0], 'http://agent.test:8080/api/orders')
    assert.strictEqual(calls[0][2].timeout, 5000)
    assert.strictEqual(calls[0][2].headers['X-Agent-Key'], 'test-only-key')
    assert.strictEqual(calls[0][1].items[0].test_code, 'HIS-CODE-001')
    assert.strictEqual(calls[0][1].items[0].lab_code, 'CHEM')
    assert.strictEqual(testApp.outboundRows.size, 1, 'Gateway submit must persist one Outbound record')
    const outbound = [...testApp.outboundRows.values()][0]
    assert.strictEqual(outbound.hl7_status, 'queued')
    assert.strictEqual(outbound.attempt_count, 1)
    assert.strictEqual(outbound.agent_http_status, 202)
    assert.strictEqual(outbound.dispatch_id, 'DISPATCH-UAT')
    assert.strictEqual(result.data.outbound_order_id, outbound._id)
    assert.strictEqual(result.data.attempt_count, 1)
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
    const testApp = appWith(async () => {
      called = true
      throw new Error('must not call an already queued order')
    })
    testApp.outboundRows.set('OUTBOUND-QUEUED', {
      _id: 'OUTBOUND-QUEUED',
      xrstatx: 1,
      order_no: 'ORDER-UAT-001',
      lab_no: '6908310001',
      hl7_status: 'queued',
      attempt_count: 1,
      agent_http_status: 202,
      dispatch_id: 'DISPATCH-UAT',
      routed_to_json: '["CHEM"]',
    })
    const result = await Process({ payload: payload() }, userInfo, testApp)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.outbound_order_id, 'OUTBOUND-QUEUED')
    assert.strictEqual(result.data.attempt_count, 1)
    assert.strictEqual(called, false)
  }

  {
    let sentSex = ''
    const female = payload()
    female.sex = 'F'
    const result = await Process({ payload: female }, userInfo, appWith(async (_url, body) => {
      sentSex = body.sex
      return { status: 202, data: { ok: true, order_no: female.order_no, duplicate: false } }
    }))
    assert.strictEqual(result.success, true)
    assert.strictEqual(sentSex, 'F')
  }

  for (const invalidSex of ['ชาย', 'หญิง', '1', '2', 'm', 'f', '']) {
    let called = false
    const bad = payload()
    bad.sex = invalidSex
    const testApp = appWith(async () => { called = true; return { status: 202, data: {} } })
    const result = await Process({ payload: bad }, userInfo, testApp)
    assert.strictEqual(result.error, 'invalid_payload')
    assert(result.errors.some(error => error.includes('payload.sex')))
    assert.strictEqual(called, false)
    assert.strictEqual(testApp.outboundRows.size, 0)
  }
  {
    const bad = payload()
    delete bad.sex
    const result = await Process({ payload: bad }, userInfo, appWith(async () => { throw new Error('must not send') }))
    assert.strictEqual(result.error, 'invalid_payload')
    assert(result.errors.some(error => error.includes('payload.sex')))
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
    const testApp = appWith(async () => {
      const error = new Error('timeout')
      error.code = 'ECONNABORTED'
      throw error
    })
    const result = await Process({ payload: payload() }, userInfo, testApp)
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'agent_unreachable')
    assert.strictEqual(result.retryable, true)
    assert.strictEqual(result.hl7_status, 'new')
    assert.strictEqual(result.network_code, 'ECONNABORTED')
    assert.strictEqual(result.network_message, 'timeout')
    assert.deepStrictEqual(result.detail, {
      code: 'ECONNABORTED',
      message: 'timeout',
      timeout_ms: 5000,
    })
    const outbound = [...testApp.outboundRows.values()][0]
    assert.strictEqual(outbound.hl7_status, 'new')
    assert.strictEqual(outbound.attempt_count, 1)
    assert.strictEqual(outbound.last_error_code, 'agent_unreachable')
    assert.strictEqual(outbound.retryable, true)
    assert.strictEqual(result.outbound_order_id, outbound._id)
  }

  {
    let collectionCalled = false
    const testApp = appWith(async () => ({
      status: 202,
      data: { ok: true, order_no: 'ORDER-UAT-001', duplicate: false },
    }))
    testApp.db.collection = () => {
      collectionCalled = true
      throw new Error('Receive owns the audit')
    }
    const result = await Process(
      { payload: payload(), audit_managed_by_receive: true },
      userInfo,
      testApp,
    )
    assert.strictEqual(result.success, true)
    assert.strictEqual(collectionCalled, false, 'Receive-owned audit must not be written twice')
  }

  {
    let called = false
    const testApp = appWith(async () => {
      called = true
      return { status: 202, data: {} }
    })
    testApp.db.collection = () => ({
      findOne: async () => null,
      insertOne: async () => { throw new Error('database unavailable') },
    })
    const result = await Process({ payload: payload() }, userInfo, testApp)
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'outbound_persistence_failed')
    assert.strictEqual(result.reason, 'outbound_write_failed')
    assert.strictEqual(called, false, 'must not send an Order that was not persisted')
  }

  {
    const result = await Process({ payload: payload() }, userInfo, appWith(async () => {
      const error = new Error('connect failed at http://agent.test:8080/api/orders using test-only-key')
      error.code = 'ETIMEDOUT'
      throw error
    }))
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.network_code, 'ETIMEDOUT')
    assert(result.network_message.includes('[redacted]'))
    assert(!result.network_message.includes('agent.test'))
    assert(!result.network_message.includes('test-only-key'))
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
