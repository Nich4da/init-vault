const fs = require('fs')
const assert = require('assert')

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const source = fs.readFileSync('specimen-collection-status-api.js', 'utf8')
const runProcess = new AsyncFunction('params', 'userInfo', 'app', source)

const clone = value => JSON.parse(JSON.stringify(value))

const makeRuntime = row => {
  const state = clone(row)
  const updates = []
  const app = {
    curDate: () => '2026-08-17 04:15:00',
    dbObjectId: value => String(value),
    dbFindOne: async request => {
      const wanted = String(request.params.orderNumber)
      return {
        success: true,
        reply: { data: String(state.order_number) === wanted ? clone(state) : null }
      }
    },
    sdformSetOne: async (formId, id, patch) => {
      assert.equal(formId, '6a7daa3e8d398c11cf2fe869')
      assert.equal(String(id), String(state._id))
      Object.assign(state, clone(patch))
      updates.push(clone(patch))
      return { success: true, id }
    }
  }
  return { app, state, updates }
}

const baseRow = {
  _id: '6a820e21ebe955d6977ec9d1',
  order_number: '1069000005',
  section_code: '10',
  section_name: 'Biochemistry',
  specimen_status: 'sent',
  work_status: 'waiting_receive',
  patient_hn: '61406455',
  patient_name: 'น.ส. ณิชชาวีณ์ ไชยอัครารัตน์',
  selected_items: '[]',
  specimens: '[]'
}

const userInfo = { username: 'Earn_admin', account: { name: 'Earn_admin' } }

async function main () {
  const fresh = makeRuntime(baseRow)
  const receiveResult = await runProcess({
    action: 'mark_received_once',
    order_number: '1069000005'
  }, userInfo, fresh.app)
  assert.equal(receiveResult.success, true)
  assert.equal(receiveResult.work_status, 'received')
  assert.equal(fresh.state.work_status, 'received')
  assert.equal(fresh.state.received_at, '2026-08-17 04:15:00')
  assert.equal(fresh.state.received_by, 'Earn_admin')

  const earlyWaiting = makeRuntime({ ...baseRow, specimen_status: 'waiting', work_status: '' })
  const earlyReceive = await runProcess({
    action: 'mark_received_once',
    order_number: '1069000005'
  }, userInfo, earlyWaiting.app)
  assert.equal(earlyReceive.success, true)
  assert.equal(earlyReceive.work_status, 'received')
  assert.equal(earlyWaiting.state.work_status, 'received')

  const normalStart = await runProcess({
    action: 'update_work_status',
    order_number: '1069000005',
    work_status: 'processing'
  }, userInfo, fresh.app)
  assert.equal(normalStart.success, true)
  assert.equal(fresh.state.work_status, 'processing')
  assert.equal(fresh.state.processing_at, '2026-08-17 04:15:00')

  const oldStamp = '2026-08-17 02:34:00'
  const existingReceive = makeRuntime({ ...baseRow, received_at: oldStamp, received_by: 'Earn_admin' })
  const existingResult = await runProcess({
    action: 'mark_received_once',
    order_number: '1069000005'
  }, userInfo, existingReceive.app)
  assert.equal(existingResult.success, true)
  assert.equal(existingResult.first_received, false)
  assert.equal(existingResult.work_status, 'received')
  assert.equal(existingReceive.state.work_status, 'received')
  assert.equal(existingReceive.state.received_at, oldStamp)

  const legacy = makeRuntime({ ...baseRow, received_at: oldStamp, received_by: 'Earn_admin' })
  const legacyStart = await runProcess({
    action: 'update_work_status',
    order_number: '1069000005',
    work_status: 'processing'
  }, userInfo, legacy.app)
  assert.equal(legacyStart.success, true)
  assert.equal(legacy.state.work_status, 'processing')
  assert.equal(legacy.state.received_at, oldStamp)

  const notReceived = makeRuntime(baseRow)
  const blockedStart = await runProcess({
    action: 'update_work_status',
    order_number: '1069000005',
    work_status: 'processing'
  }, userInfo, notReceived.app)
  assert.equal(blockedStart.success, false)
  assert.match(blockedStart.message, /ไม่สามารถเปลี่ยนสถานะ/)
  assert.equal(notReceived.updates.length, 0)

  const alreadyProcessing = makeRuntime({ ...baseRow, work_status: 'processing', received_at: oldStamp })
  const repeatedReceive = await runProcess({
    action: 'mark_received_once',
    order_number: '1069000005'
  }, userInfo, alreadyProcessing.app)
  assert.equal(repeatedReceive.success, true)
  assert.equal(repeatedReceive.work_status, 'processing')
  assert.equal(alreadyProcessing.state.work_status, 'processing')
  assert.equal(alreadyProcessing.updates.length, 0)

  process.stdout.write('PASS: receive persists received, start persists processing, legacy stamped rows recover, and unreceived rows cannot skip ahead\n')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
