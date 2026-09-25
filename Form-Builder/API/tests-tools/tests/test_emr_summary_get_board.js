const assert = require('assert')
const fs = require('fs')
const path = require('path')

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const PROCESS_DIR = path.join(__dirname, '../../api-factory/processes')
const SOURCES = [
  'emr-summary-get-READY-v2.js',
  'emr-summary-get-CALLS-BOARD-v1.js',
]

const BOARD_ID = '6ab3be31cec3020e8562a2c9'
const PERSON_ID = '111111111111111111111111'
const VISIT_ID = '222222222222222222222222'

const boardPayload = {
  success: true,
  current_vn: 'VN-TEST',
  lab_orders: [{ order_id: 'ORDER-1', status: 'ready', items: [] }],
  xray_results: [{ key: 'XR-1' }],
  lab_trends: [{ name: 'Creatinine', series: [{ value: 1 }, { value: 2 }] }],
}

const makeApp = wrapper => ({
  dbObjectId: value => value,
  dbFindAll: async () => ({ success: true, reply: { data: [] } }),
  runProcess: async (id, params) => {
    assert.strictEqual(id, BOARD_ID)
    assert.deepStrictEqual(params, {
      person_id: PERSON_ID,
      hn: 'HN-TEST',
      visit_id: VISIT_ID,
    })
    return wrapper
  },
  log: { warn: () => {} },
})

const run = async (sourceName, wrapper) => {
  const body = fs.readFileSync(path.join(PROCESS_DIR, sourceName), 'utf8')
  const Process = new AsyncFunction('params', 'userInfo', 'app', body)
  return Process(
    { person_id: PERSON_ID, hn: 'HN-TEST', visit_id: VISIT_ID },
    { username: 'test' },
    makeApp(wrapper),
  )
}

;(async () => {
  for (const sourceName of SOURCES) {
    const wrapped = await run(sourceName, {
      success: true,
      permissionDenied: false,
      reply: { status: 200, message: 'OK', data: boardPayload },
    })
    assert.deepStrictEqual(wrapped.lab_orders, boardPayload.lab_orders, sourceName + ' must unwrap reply.data.lab_orders')
    assert.deepStrictEqual(wrapped.xray_results, boardPayload.xray_results, sourceName + ' must unwrap reply.data.xray_results')
    assert.deepStrictEqual(wrapped.lab_trends, boardPayload.lab_trends, sourceName + ' must unwrap reply.data.lab_trends')
    assert.strictEqual(wrapped.current_vn, boardPayload.current_vn, sourceName + ' must unwrap reply.data.current_vn')

    const direct = await run(sourceName, boardPayload)
    assert.deepStrictEqual(direct.lab_orders, boardPayload.lab_orders, sourceName + ' must keep direct-payload compatibility')

    const failed = await run(sourceName, {
      success: true,
      reply: { status: 200, data: { success: false, message: 'board unavailable' } },
    })
    assert.deepStrictEqual(failed.lab_orders, [], sourceName + ' must fail open when the child Process fails')
  }

  console.log('emr-summary-get board unwrap tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
