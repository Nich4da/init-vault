const assert = require('assert')
const fs = require('fs')
const path = require('path')

/* MY manual lifecycle seed contract.

   This test is deliberately in-memory. It executes the real CPOE order UI and
   the real LAB Worklist/MY popup helpers, but it never writes to HIS and never
   calls Receive. Result branches seed an accepted Work Item + synthetic LAB NO.
   directly so Finance/Receive remain untouched while Manual result behavior is
   exercised from Partial through Final and corrected Final.
*/

const root = path.resolve(__dirname, '../../../..')
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'))
const cpoeForm = read('Form-Builder/SDForm/form-factory/forms/cpoe-order-app-vn-picker-v1.json')
const worklistForm = read('Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json')

const findNamed = (node, name) => {
  let hit = null
  const walk = value => {
    if (!value || typeof value !== 'object') return
    if (value.name === name) hit = value
    if (Array.isArray(value)) value.forEach(walk)
    else Object.values(value).forEach(walk)
  }
  walk(node)
  assert(hit, 'field not found: ' + name)
  return hit
}

const orderScreen = findNamed(cpoeForm, 'item_screen')
const worklistWidget = findNamed(worklistForm, 'lab_cpoe_worklist')
const SAVE_PROCESS = '6a71edd247075049ef0245af'
const SEND_PROCESS = '6a757d1bf7bf7668d7673c63'
const RECEIVE_PROCESS = '6a94f634422c1ca959829d70'
const MY_MASTER_ID = '6a900cc00c6722b3af181faa'
const MY_ITEM_CODE = 'M11'
const MY_ITEM_NAME = 'FUNGUS (KOH)'
const storageValues = ['IM', 'RF', 'RT']
const specimenNames = ['Hair', 'Skin scraping', 'Nail clipping']
const specimenCodes = ['HAIR', 'SKIN', 'NAIL']
const siteNames = ['ศีรษะ', 'แขน', 'ขา']
const siteCodes = ['HEAD', 'ARM', 'LEG']

const baseCases = []
for (const quantity of [1, 2, 3]) {
  for (const priority of ['1', '2', '3', '4', '5']) {
    for (const storage of storageValues) baseCases.push({ quantity, priority, storage })
  }
}
assert.strictEqual(baseCases.length, 45)

let idSequence = 1
const hexId = () => (0x100000 + idSequence++).toString(16).padStart(24, '0')
const cpoeCalls = []
const lifecycleCalls = []
const orders = new Map()
const resultLedger = new Map()
const financeByOrder = new Map()
const notifications = []
let orderSequence = 0
let resultSequence = 0

const orderedSpecimens = (quantity, storage, seedNo) => Array.from({ length: quantity }, (_, index) => ({
  spec_source_code: specimenCodes[index],
  spec_source: specimenNames[index],
  spec_site_code: siteCodes[index],
  spec_site_name: siteNames[index],
  specimen_at: '2026-10-' + String(1 + (seedNo % 28)).padStart(2, '0') + 'T09:' + String(seedNo % 60).padStart(2, '0'),
  ship_storage: storage,
  spec_note: 'MY lifecycle seed ' + seedNo + '-' + (index + 1),
}))

const seedCpoeOrder = (baseCase, branch) => {
  orderSequence += 1
  const seedNo = orderSequence
  const orderId = hexId()
  const itemId = hexId()
  const visitId = hexId()
  const orderNumber = 'MY-SEED-' + String(seedNo).padStart(4, '0')
  const source = 'ตำแหน่งพยาธิ seed ' + seedNo
  const specimens = orderedSpecimens(baseCase.quantity, baseCase.storage, seedNo)
  const calls = []
  let closed = 0

  const host = {
    $labCpoeContext: {
      visit_id: visitId,
      hn: 'MYHN' + String(seedNo).padStart(6, '0'),
      inscl_hos: [{
        inscl_item_main: { value: 'TEST', label: 'สิทธิทดสอบ' },
        inscl_item_sub: { value: 'SEED', label: 'Seed only' },
      }],
    },
    closePopup: () => { closed += 1 },
    userState: {
      runProcess: (processId, payload, success) => {
        cpoeCalls.push({ processId, payload, branch })
        calls.push({ processId, payload })
        if (processId === SAVE_PROCESS) {
          success({ data: { success: true, order_id: orderId, order_number: orderNumber } })
          return
        }
        if (processId === SEND_PROCESS) {
          assert.strictEqual(payload.order_id, orderId)
          success({ data: { success: true } })
          return
        }
        assert.fail('unexpected CPOE process: ' + processId)
      },
    },
  }
  const runtime = {
    vueState: {},
    params: {
      manual_visit: true,
      source: 'lab-worklist',
      lab_scope: true,
      organization_code: 'MY',
      section_codes: ['MY'],
    },
    globalUserState: { user: { _id: hexId() } },
    getFormRef: () => host,
    alert: () => {},
  }
  new Function(orderScreen.onCreated).call(runtime)
  runtime.vueState.docId = runtime.globalUserState.user._id
  runtime.vueState.prio = baseCase.priority
  runtime.vueState.cart = [{
    k: 'lab:' + MY_MASTER_ID,
    st: 'lab',
    id: MY_MASTER_ID,
    c: MY_ITEM_CODE,
    n: MY_ITEM_NAME,
    sec: 'MY',
    sp: 'M50',
    spn: 'Other',
    qty: baseCase.quantity,
    lab_data: {
      source,
      source_code: 'M50',
      storage: baseCase.storage,
      at: specimens[0].specimen_at,
      by: 'MY Seed Collector',
      specimens,
    },
  }]
  runtime.vueState.sendOrder()

  assert.deepStrictEqual(calls.map(call => call.processId), [SAVE_PROCESS, SEND_PROCESS])
  assert.strictEqual(closed, 1)
  const saved = calls[0].payload
  assert.strictEqual(saved.priority, baseCase.priority)
  assert.strictEqual(saved.lines.length, 1)
  assert.strictEqual(saved.lines[0].quantity, baseCase.quantity)
  assert.deepStrictEqual(saved.lines[0].lab_data.specimens, specimens)

  const item = {
    item_id: itemId,
    item_code: MY_ITEM_CODE,
    item_name: MY_ITEM_NAME,
    quantity: baseCase.quantity,
    current_status: 'sent',
    work_status: 'sent',
    section: { code: 'MY', name: 'Mycology Laboratory' },
    order_requirements: { multi_specimen: true, req_commt: false },
    specimen: {
      complete: false,
      master: { code: 'M50', name: 'Other' },
      ordered: { source, source_code: 'M50', rows: specimens },
    },
  }
  const order = {
    order_id: orderId,
    order_number: orderNumber,
    section_code: 'MY',
    current_status: 'sent',
    items: [item],
    patient: { hn: host.$labCpoeContext.hn, first_name: 'Seed', last_name: branch },
    visit: { vn: 'MYVN' + String(seedNo).padStart(6, '0'), clinic: 'MY Seed' },
  }
  orders.set(orderId, order)
  return { order, item, specimens, baseCase, branch }
}

const worklistHost = { formParams: {}, getFieldRef: () => null }
const worklistField = {
  vueState: {},
  globalUserState: {
    user: { unit: { code: 'MY' }, fname: 'MY', lname: 'Seed Tester' },
    runProcess: () => { assert.fail('Worklist must use the in-memory processCall stub') },
  },
  getFormRef: () => worklistHost,
  confirm: (message, callback) => callback(),
  notify: (...args) => { notifications.push(args) },
}
new Function(worklistWidget.onCreated).call(worklistField)
const state = worklistField.vueState
state.viewMode = 'today'
state.loadPathologySiteMaster = () => {}
state.loadOrders = () => {}
state.refreshCounts = () => {}
state.refreshWorklist = () => {}

const ledgerFor = itemId => {
  if (!resultLedger.has(itemId)) {
    resultLedger.set(itemId, {
      result_report_id: hexId(),
      results: [],
      revisions: [],
      reported_at: '',
      reported_by_source_name: '',
      verified_by_source_name: '',
    })
  }
  return resultLedger.get(itemId)
}

state.processCall = async (processId, params) => {
  lifecycleCalls.push({ processId, params: JSON.parse(JSON.stringify(params)) })
  assert.notStrictEqual(processId, RECEIVE_PROCESS, 'Receive must never run in this seed')

  if (params.action === 'get_reason_options') {
    return { success: true, data: { options: [{ value: 'seed_cancel', label: 'ยกเลิกเพื่อทดสอบ MY' }] } }
  }
  if (params.action === 'check_cancel_finance') {
    const blocked = financeByOrder.get(params.order_id) === 'blocked'
    return { success: true, data: {
      can_cancel: !blocked,
      finance_status: blocked ? 'paid_receipt_active' : 'unpaid',
      finance_message: blocked ? 'กรุณาให้การเงินถอนใบเสร็จก่อน' : 'ยกเลิกได้',
      receipt_numbers: blocked ? ['MY-SEED-RECEIPT'] : [],
    } }
  }
  if (params.action === 'cancel_order') {
    assert.strictEqual(financeByOrder.get(params.order_id), 'allowed')
    return { success: true, message: 'ยกเลิก MY seed แล้ว', data: {
      cancel_type: 'lab_order_cancelled',
      cancel_reason: params.cancel_reason,
      cancelled_at: '2026-10-05 10:00:00',
      cancelled_by: { id: 'MY-SEED', name: 'MY Seed Tester' },
    } }
  }
  if (params.action === 'get_manual_result') {
    const ledger = ledgerFor(params.item_id)
    return { success: true, data: {
      item_id: params.item_id,
      section_code: 'MY',
      result_report_id: ledger.result_report_id,
      results: ledger.results.map(row => ({ ...row, correction_history: row.correction_history.slice() })),
      result_attachments: [],
      reported_at: ledger.reported_at,
      reported_by_source_name: ledger.reported_by_source_name,
      verified_by_source_name: ledger.verified_by_source_name,
    } }
  }
  if (params.action === 'save_pathology_results') {
    const ledger = ledgerFor(params.item_id)
    const order = [...orders.values()].find(candidate => candidate.items.some(item => item.item_id === params.item_id))
    const item = order.items.find(candidate => candidate.item_id === params.item_id)
    assert(['accepted', 'resulted', 'completed'].includes(item.current_status), 'manual result must start after the seeded accepted boundary')
    params.pathology_results.forEach(input => {
      let row = ledger.results.find(candidate => candidate.result_item_id === input.result_item_id)
      if (!row) {
        row = {
          result_item_id: hexId(),
          correction_history: [],
        }
        ledger.results.push(row)
      }
      const before = row.result_value == null ? '' : String(row.result_value)
      const after = input.result_value == null ? '' : String(input.result_value)
      if (item.current_status === 'completed' && before !== after) {
        const eventId = params.request_id + ':' + row.result_item_id
        row.correction_history.push({
          event_id: eventId,
          request_id: params.request_id,
          correction_group_id: params.request_id,
          reason: params.correction_reason,
          corrected_by_name: 'MY Seed Tester',
          corrected_at: '2026-10-05 11:' + String(resultSequence++ % 60).padStart(2, '0') + ':00',
          test_code: MY_ITEM_CODE,
          test_name: MY_ITEM_NAME,
          actual_site_name: input.actual_site_name,
          changed_fields: ['result_value'],
          before: { result_value: before },
          after: { result_value: after },
        })
      }
      Object.assign(row, input, {
        result_item_id: row.result_item_id,
        result_status: item.current_status === 'completed' ? 'final' : 'entered',
        result_source: 'manual',
      })
    })
    if (item.current_status !== 'completed') {
      item.current_status = 'resulted'
      item.work_status = 'resulted'
    }
    ledger.reported_at = '2026-10-05 10:30:00'
    ledger.reported_by_source_name = 'MY Seed Tester'
    return { success: true, message: 'บันทึกผลห้อง MY แล้ว', data: { result_status: 'entered' } }
  }
  if (params.action === 'finalize_manual_results') {
    const order = orders.get(params.order_id)
    assert(order, 'finalize must reference a seeded order')
    const itemIds = []
    order.items.forEach(item => {
      const ledger = ledgerFor(item.item_id)
      assert(ledger.results.length > 0)
      assert(ledger.results.every(row => String(row.result_value || '').trim()), 'Final must not accept an empty MY result')
      item.current_status = 'completed'
      item.work_status = 'completed'
      item.completed_at = '2026-10-05 10:45:00'
      ledger.results.forEach(row => { row.result_status = 'final' })
      ledger.verified_by_source_name = 'MY Seed Verifier'
      itemIds.push(item.item_id)
    })
    return { success: true, message: 'ยืนยันออกผลครบแล้ว', data: {
      item_ids: itemIds,
      completed_at: '2026-10-05 10:45:00',
      verified_by_source_name: 'MY Seed Verifier',
    } }
  }
  assert.fail('unexpected Worklist action: ' + String(params.action || '(list)'))
}

const metrics = {
  base_cases: baseCases.length,
  orders: 0,
  cancel_allowed: 0,
  cancel_blocked_by_finance: 0,
  result_orders: 0,
  direct_accepted_seeds: 0,
  partial_results: 0,
  finalized_results: 0,
  corrected_final_results: 0,
  corrected_rows: 0,
}

;(async () => {
  for (const baseCase of baseCases) {
    for (const seededStatus of ['sent', 'accepted']) {
      for (const financeState of ['allowed', 'blocked']) {
        const seeded = seedCpoeOrder(baseCase, 'cancel-' + seededStatus + '-' + financeState)
        metrics.orders += 1
        seeded.item.current_status = seededStatus
        seeded.item.work_status = seededStatus
        if (seededStatus === 'accepted') {
          seeded.item.lab_no = 'MY-SEED-CANCEL-' + String(metrics.orders).padStart(4, '0')
          seeded.item.received_at = '2026-10-05 10:00:00'
          metrics.direct_accepted_seeds += 1
        }
        financeByOrder.set(seeded.order.order_id, financeState)
        assert.strictEqual(state.canCancelOrder(seeded.order), true)
        await state.openCancelOrder(seeded.order)
        assert.strictEqual(state.cancelDialog.visible, true)
        assert.strictEqual(state.cancelDialog.financeChecked, true)
        state.cancelDialog.reason = 'seed_cancel'
        const cancelCallsBefore = lifecycleCalls.filter(call => call.params.action === 'cancel_order').length
        await state.submitCancelOrder()
        const cancelCallsAfter = lifecycleCalls.filter(call => call.params.action === 'cancel_order').length
        if (financeState === 'blocked') {
          assert.strictEqual(cancelCallsAfter, cancelCallsBefore, 'active receipt must block the cancel write')
          assert.strictEqual(seeded.item.current_status, seededStatus)
          metrics.cancel_blocked_by_finance += 1
          state.cancelDialog = state.emptyCancelDialog()
        } else {
          assert.strictEqual(cancelCallsAfter, cancelCallsBefore + 1)
          assert.strictEqual(seeded.item.current_status, 'cancelled')
          assert.strictEqual(seeded.item.cancel_reason, 'ยกเลิกเพื่อทดสอบ MY')
          metrics.cancel_allowed += 1
        }
      }
    }

    const seeded = seedCpoeOrder(baseCase, 'manual-result')
    metrics.orders += 1
    metrics.result_orders += 1
    metrics.direct_accepted_seeds += 1
    seeded.item.current_status = 'accepted'
    seeded.item.work_status = 'accepted'
    seeded.item.lab_no = 'MY-SEED-RESULT-' + String(metrics.result_orders).padStart(4, '0')
    seeded.item.received_at = '2026-10-05 10:15:00'
    seeded.item.specimen.complete = true

    await state.openPathologyResults(seeded.order)
    assert.strictEqual(state.pathologyItems().length, baseCase.quantity)
    assert.strictEqual(state.pathologyRows().length, baseCase.quantity)
    state.startPathologyEdit()
    const firstSpecimen = state.pathology.groups[0].specimens[0]
    state.addPathologySub(state.pathology.groups[0], firstSpecimen)
    const initialRows = state.pathologyRows()
    assert.strictEqual(initialRows.length, baseCase.quantity + 1)
    initialRows.forEach((row, index) => {
      if (!row.actual_site_name) row.actual_site_name = index === 1 ? 'หนังศีรษะ' : siteNames[Math.min(index, 2)]
      row.actual_site_detail = 'seed จุดย่อย ' + (index + 1)
      row.result_value = index === 0 ? 'พบเชื้อระยะแรก' : ''
    })
    await state.savePathologyResults()
    assert.strictEqual(seeded.item.current_status, 'resulted')
    assert.strictEqual(state.pathologyStatusText(), 'ออกผลบางส่วน')
    assert.strictEqual(state.canFinalizePathologyResults(), false)
    metrics.partial_results += 1

    state.startPathologyEdit()
    state.pathologyRows().forEach((row, index) => {
      if (!row.result_value) row.result_value = 'ไม่พบเชื้อ ' + (index + 1)
    })
    await state.savePathologyResults()
    assert.strictEqual(state.pathologyStatusText(), 'รอยืนยันออกผลครบ')
    assert.strictEqual(state.canFinalizePathologyResults(), true)
    await state.finalizePathologyResults()
    assert.strictEqual(seeded.item.current_status, 'completed')
    assert.strictEqual(state.pathologyStatusText(), 'ออกผลครบ')
    metrics.finalized_results += 1

    state.startPathologyEdit()
    assert.strictEqual(state.pathology.editing, true)
    const rowsBeforeCorrection = state.pathologyRows().map(row => row.result_value)
    state.pathology.correctionReason = 'แก้ผลหลังยืนยัน MY seed'
    state.pathologyRows().forEach((row, index) => {
      row.result_value = 'ผลแก้ไขครั้งสุดท้าย ' + (index + 1)
    })
    await state.savePathologyResults()
    assert.strictEqual(seeded.item.current_status, 'completed', 'correction must not downgrade Final')
    assert.strictEqual(state.pathologyStatusText(), 'ออกผลครบ')
    assert.strictEqual(state.pathologyRevisionCount(), 1, 'one correction save must create one revision set')
    const revision = state.pathologyRevisions()[0]
    assert.strictEqual(revision.reason, 'แก้ผลหลังยืนยัน MY seed')
    assert.strictEqual(revision.changes.length, baseCase.quantity + 1)
    assert.deepStrictEqual(revision.changes.map(change => change.before_result_value), rowsBeforeCorrection)
    assert.deepStrictEqual(
      revision.changes.map(change => change.after_result_value),
      state.pathologyRows().map(row => row.result_value),
    )
    metrics.corrected_final_results += 1
    metrics.corrected_rows += revision.changes.length
  }

  assert.strictEqual(metrics.orders, 225)
  assert.strictEqual(metrics.cancel_allowed, 90)
  assert.strictEqual(metrics.cancel_blocked_by_finance, 90)
  assert.strictEqual(metrics.result_orders, 45)
  assert.strictEqual(metrics.partial_results, 45)
  assert.strictEqual(metrics.finalized_results, 45)
  assert.strictEqual(metrics.corrected_final_results, 45)
  assert.strictEqual(metrics.corrected_rows, 135)
  assert.strictEqual(cpoeCalls.filter(call => call.processId === SAVE_PROCESS).length, metrics.orders)
  assert.strictEqual(cpoeCalls.filter(call => call.processId === SEND_PROCESS).length, metrics.orders)
  assert.strictEqual(cpoeCalls.length, metrics.orders * 2)
  assert.strictEqual(lifecycleCalls.filter(call => call.processId === RECEIVE_PROCESS).length, 0)
  assert.strictEqual(lifecycleCalls.filter(call => call.params.action === 'save_pathology_results').length, 135)
  assert.strictEqual(lifecycleCalls.filter(call => call.params.action === 'finalize_manual_results').length, 45)

  console.log(JSON.stringify({
    suite: 'MY manual lifecycle full seed matrix',
    ...metrics,
    cpoe_save_calls: cpoeCalls.filter(call => call.processId === SAVE_PROCESS).length,
    cpoe_send_calls: cpoeCalls.filter(call => call.processId === SEND_PROCESS).length,
    pathology_save_calls: lifecycleCalls.filter(call => call.params.action === 'save_pathology_results').length,
    finalize_calls: lifecycleCalls.filter(call => call.params.action === 'finalize_manual_results').length,
    receive_calls: 0,
    live_database_writes: 0,
  }, null, 2))
  console.log('MY manual lifecycle seed matrix tests passed')
})().catch(error => {
  console.error(error)
  process.exitCode = 1
})
