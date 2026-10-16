/* X-ray pre-dispatch seed matrix
 *
 * ขอบเขต: จำลองใน memory เท่านั้น ตั้งแต่ Order เข้าคิวจนถึงก่อนกด "ส่งเข้าเครื่อง"
 * - ไม่เรียกการเงินจริง
 * - ไม่เรียก xray-cpoe-dispatch
 * - ไม่ออก Accession และไม่ส่ง RIS
 * - รัน logic จริงจาก Form JSON เพื่อยืนยัน enable/disable ของปุ่ม
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const readText = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const form = JSON.parse(readText('Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json'))
const worklistApi = readText('Form-Builder/API/api-factory/processes/xray_cpoe_worklist_api.js')
const dispatchApi = readText('Form-Builder/API/api-factory/processes/xray_cpoe_dispatch_api.js')

const WORKLIST_PROCESS_ID = '6a957009422c1ca959829e45'
const DISPATCH_PROCESS_ID = '6a967029422c1ca959829edc'
const CENTRAL_CALL_PROCESS_ID = '6a4b942bac48023662b1b42a'

const walk = (value, fn) => {
  if (!value || typeof value !== 'object') return
  fn(value)
  ;(Array.isArray(value) ? value : Object.values(value)).forEach(item => walk(item, fn))
}

const widgetNamed = name => {
  let hit = null
  walk(form, value => {
    if (value.name === name && typeof value.onCreated === 'string') hit = value
  })
  assert(hit, 'missing widget ' + name)
  return hit
}

const flush = () => new Promise(resolve => setImmediate(resolve))

const bootWorklist = () => {
  const processCalls = []
  const field = {
    vueState: {},
    globalUserState: {
      user: { unit: { code: 'RA-301' }, room: { code: 'US1' } },
      runProcess: (id, params, ok) => {
        processCalls.push({ id, params })
        ok({ data: { success: true, data: { orders: [], total: 0, counts: {} } } })
      },
      crudGetAll: (request, ok) => ok({ data: [] }),
    },
    getFormRef: () => ({ formParams: { xsitex: 'SEED-ONLY' }, getFieldRef: () => null }),
    notify: () => {},
    alert: () => {},
  }
  new Function(widgetNamed('xray_cpoe_worklist').onCreated).call(field)
  return { s: field.vueState, processCalls }
}

const item = (id, status, extra = {}) => Object.assign({
  item_id: id,
  item_code: 'XR-' + id,
  item_name: 'X-ray seed ' + id,
  current_status: status,
  accession_no: '',
  modality: { code: 'CR', label: 'CR' },
}, extra)

const order = (id, items, finance = {}) => ({
  order_id: id,
  order_number: id,
  requested_at: '2026-10-06T09:00:00+07:00',
  priority: '1',
  patient: { hn: 'HN-' + id, first_name: 'Seed', last_name: 'Test' },
  visit: { visit_id: 'VISIT-' + id, vn: 'VN-' + id, clinic: 'OPD' },
  finance: Object.assign({ total_amount: 100, paid_amount: 0, coverage: [] }, finance),
  requester: {},
  emr_context: { visit_id: 'VISIT-' + id, vn: 'VN-' + id },
  items,
})

const buildCase = (s, seed) => {
  s.selected = Object.fromEntries((seed.selected || []).map(id => [id, true]))
  const row = s.buildRow(order(seed.name, seed.items, seed.finance))
  assert.strictEqual(row.dispatch_ready, seed.enabled, seed.name + ': dispatch_ready')
  assert.strictEqual(row.dispatch_disabled_reason, seed.reason, seed.name + ': disabled reason')
  if (seed.financePassed !== undefined) {
    assert.strictEqual(row.finance_passed, seed.financePassed, seed.name + ': finance badge/gate')
  }
  return row
}

const bootQueue = user => {
  const processCalls = []
  const alerts = []
  const statuses = { 'VISIT-SENT': 'sent', 'VISIT-READY': 'ready' }
  const ctx = {
    vueState: {},
    notify: () => {},
    alert: (message, type) => alerts.push({ message: String(message), type }),
    getFormRef: () => ({ getFieldRef: () => null }),
    getFieldRef: () => null,
    globalUserState: {
      user,
      runProcess: (id, params, ok) => {
        processCalls.push({ id, params })
        if (id === DISPATCH_PROCESS_ID) throw new Error('seed test must never call dispatch')
        ok({ data: { success: true, data: { already_called: false, rows: [], total: 0, counts: {} } } })
      },
      connectWebSocket: () => ({ wsDisconnect: () => {} }),
    },
  }
  new Function(widgetNamed('xray_queue_unit').onCreated).call(ctx)
  return { s: ctx.vueState, processCalls, alerts, statuses }
}

const queueRow = visitId => ({
  visit_id: visitId,
  vn: visitId.replace('VISIT-', 'VN-'),
  hn: visitId.replace('VISIT-', 'HN-'),
  patient_name: 'Seed Queue',
  item_count: 1,
  order_count: 1,
  requested_at: '2026-10-06T09:00:00+07:00',
})

const run = async () => {
  const { s, processCalls } = bootWorklist()

  const cases = [
    {
      name: 'sent-unpaid-selected', items: [item('S1', 'sent')], selected: ['S1'],
      finance: { total_amount: 100, paid_amount: 0 }, enabled: false,
      reason: 'ยังไม่ผ่านการเงิน', financePassed: false,
    },
    {
      name: 'sent-paid-amount-selected', items: [item('S2', 'sent')], selected: ['S2'],
      finance: { total_amount: 100, paid_amount: 100 }, enabled: false,
      reason: 'ยังไม่ผ่านการเงิน', financePassed: false,
    },
    {
      name: 'ready-zero-amount-selected', items: [item('R1', 'ready')], selected: ['R1'],
      finance: { total_amount: 100, paid_amount: 0 }, enabled: true,
      reason: '', financePassed: true,
    },
    {
      name: 'ready-no-selection', items: [item('R2', 'ready')], selected: [],
      enabled: false, reason: 'เลือกรายการที่จะส่งเข้าเครื่อง', financePassed: true,
    },
    {
      name: 'sent-no-selection', items: [item('S3', 'sent')], selected: [],
      enabled: false, reason: 'ยังไม่ผ่านการเงิน', financePassed: false,
    },
    {
      name: 'mixed-ready-selected-sent-unselected',
      items: [item('R3', 'ready'), item('S4', 'sent')], selected: ['R3'],
      enabled: true, reason: '', financePassed: false,
    },
    {
      name: 'mixed-ready-and-sent-selected',
      items: [item('R4', 'ready'), item('S5', 'sent')], selected: ['R4', 'S5'],
      enabled: false, reason: 'ยังไม่ผ่านการเงิน', financePassed: false,
    },
    {
      name: 'all-ready-selected',
      items: [item('R5', 'ready'), item('R6', 'ready')], selected: ['R5', 'R6'],
      enabled: true, reason: '', financePassed: true,
    },
    {
      name: 'ready-and-cancelled-selected',
      items: [item('R7', 'ready'), item('C1', 'cancelled')], selected: ['R7', 'C1'],
      enabled: false, reason: 'ส่งเข้าเครื่องได้เฉพาะรายการที่พร้อมส่ง', financePassed: true,
    },
  ]

  const rows = cases.map(seed => buildCase(s, seed))
  assert.strictEqual(rows[0].items[0].finance_blocked, true)
  assert.strictEqual(rows[1].items[0].finance_blocked, true, 'amount fields never override sent')
  assert.strictEqual(rows[2].items[0].finance_ready, true)
  assert.strictEqual(rows[5].items.find(value => value.id === 'S4').finance_blocked, true)
  assert.strictEqual(rows[5].dispatch_ready, true, 'only the selected ready item is eligible for partial dispatch')

  const content = widgetNamed('xray_cpoe_worklist').content
  assert(
    content.includes(':disabled="row.dispatching||row.rejecting||row.retesting||!row.dispatch_ready"'),
    'the real button must bind its disabled state to dispatch_ready',
  )
  assert(dispatchApi.includes("const WAITING_STATUS = 'sent'"))
  assert(dispatchApi.includes("const FINANCE_READY_STATUS = 'ready'"))
  assert(dispatchApi.includes("error: 'payment_not_ready'"), 'server must keep the same Finance gate')
  assert.strictEqual(
    processCalls.filter(call => call.id === DISPATCH_PROCESS_ID).length,
    0,
    'the seed matrix stops before dispatch',
  )

  assert(worklistApi.includes("sent: 'waiting'") && worklistApi.includes("ready: 'waiting'"))
  assert(worklistApi.includes("const queueActiveOrderStatuses = statusVocabulary"),
    'Order aggregation keeps both sent and ready visible without changing the Finance gate')

  const missingRoom = bootQueue({ unit: { code: 'RA-301' }, room: null })
  missingRoom.s.callNextQueue()
  assert.strictEqual(
    missingRoom.processCalls.filter(call => call.id === CENTRAL_CALL_PROCESS_ID).length,
    0,
    'missing Room blocks central call-next',
  )
  assert.deepStrictEqual(missingRoom.alerts, [
    { message: 'เลือกห้องตรวจก่อนเรียกคิว (มุมขวาบน)', type: 'warning' },
  ])

  const withRoom = bootQueue({ unit: { code: 'RA-301' }, room: { code: 'US1' } })
  const beforeStatuses = Object.assign({}, withRoom.statuses)
  withRoom.s.callNextQueue()
  await flush()
  const queueCalls = withRoom.processCalls.filter(call => call.id === CENTRAL_CALL_PROCESS_ID)
  assert.strictEqual(queueCalls.length, 1, 'central FIFO owns selection of the next Visit')
  queueCalls.forEach(call => {
    assert.strictEqual(call.params.unit_to, 'RA-301')
    assert.strictEqual(call.params.room.value, 'US1')
    assert(!('visit_id' in call.params))
  })
  assert.deepStrictEqual(withRoom.statuses, beforeStatuses, 'central call-next must not change CPOE current_status')
  assert.strictEqual(
    withRoom.processCalls.filter(call => call.id === DISPATCH_PROCESS_ID).length,
    0,
    'queue tests never call dispatch',
  )

  console.log('X-ray pre-dispatch seed matrix passed: ' + cases.length + ' Finance cases + 3 queue cases')
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
