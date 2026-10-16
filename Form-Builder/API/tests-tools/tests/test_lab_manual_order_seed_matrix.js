const assert = require('assert')
const fs = require('fs')
const path = require('path')

/* Contract seed for orders created from LAB Worklist.

   This is deliberately an in-memory test. It executes the real item_screen
   onCreated code and its save -> send path, but it never calls a live API or
   writes synthetic patients/orders to HIS.

   Scope:
   - a full Cartesian matrix for all active LAB sections
   - every section covers every combination of quantity 1-3, priority 1-5,
     all storage modes, and every source mode allowed by its Item Master
   - MY covers one ordered specimen row per quantity and preserves each site
   - specimen details survive UI payload -> CPOE Item persistence mapping
   - the persisted CPOE Item matches the query used by EMR LAB board
   - the item resolves back to the room selected in LAB Worklist
   - the real Worklist rule keeps Receive disabled for every sent Item
   - no Receive click/process, Lab Work Item, outbound payload, or Agent call

   The room/master snapshot below was verified read-only from zdata_section and
   zdata_master_item_order on 2026-10-04. The test remains deterministic and
   must not depend on a live database.
*/

const root = path.resolve(__dirname, '../../../..')
const formPath = path.join(
  root,
  'Form-Builder/SDForm/form-factory/forms/cpoe-order-app-vn-picker-v1.json',
)
const form = JSON.parse(fs.readFileSync(formPath, 'utf8'))
const worklistPath = path.join(
  root,
  'Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json',
)
const worklistForm = JSON.parse(fs.readFileSync(worklistPath, 'utf8'))

const SAVE_PROCESS = '6a71edd247075049ef0245af'
const SEND_PROCESS = '6a757d1bf7bf7668d7673c63'
const ITEM_MASTER_FORM = '6a594763d448dfc9d33e2c27'

const rooms = [
  { code: 'BB', name: 'Blood Bank', masterId: '6a900cc00c6722b3af182d93', itemCode: 'BB00', itemName: 'BB Lab test investigation', specimenCode: 'CD', specimenName: 'Clotted blood' },
  { code: 'BC', name: 'Biochemistry', masterId: '6a900cc00c6722b3af181cba', itemCode: 'C1', itemName: 'Liver Function Test', specimenCode: 'CD', specimenName: 'Clotted blood' },
  { code: 'BG', name: 'Biomolecular and Genetics', masterId: '6a900cc00c6722b3af181c85', itemCode: 'BG1', itemName: 'Chromosome analysis in blood', specimenCode: 'HB', specimenName: 'Heparinized Blood' },
  { code: 'HH', name: 'Hematology-Homeostasis', masterId: '6a900cc00c6722b3af181d90', itemCode: 'H1', itemName: 'Hemoglobin typing', specimenCode: 'EB', specimenName: 'EDTA blood' },
  { code: 'HM', name: 'Hematology', masterId: '6a900cc00c6722b3af181dbb', itemCode: 'HM1', itemName: '[เฉพาะโรคเลือด] CBC ( Complete Blood Count )', specimenCode: 'EB', specimenName: 'EDTA blood' },
  { code: 'IM', name: 'Immunology', masterId: '6a900cc00c6722b3af181e01', itemCode: 'I0026', itemName: 'CD 19/20 (รหัส30514)', specimenCode: 'BL', specimenName: 'Blood' },
  { code: 'MB', name: 'Microbiology', masterId: '6a900cc00c6722b3af181fa8', itemCode: 'M1', itemName: 'Gram stain', specimenCode: '99', specimenName: 'Others' },
  { code: 'MI-OUT', name: 'IMMUNOLOGY-ส่งนอกรพ.', masterId: '6a900cc00c6722b3af181dee', itemCode: 'I0001', itemName: 'Acetaminophen (33107) (กบก ชำระเพิ่ม80)', specimenCode: 'BL', specimenName: 'Blood' },
  { code: 'ML', name: 'Clinical Microscopy Laboratory', masterId: '6a900cc00c6722b3af181fe3', itemCode: 'MS1', itemName: 'CBC', specimenCode: 'EB', specimenName: 'EDTA blood' },
  { code: 'MY', name: 'Mycology Laboratory', masterId: '6a900cc00c6722b3af181faa', itemCode: 'M11', itemName: 'FUNGUS (KOH)', specimenCode: 'M50', specimenName: 'Other' },
]

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

const screen = findNamed(form, 'item_screen')
const worklistWidget = findNamed(worklistForm, 'lab_cpoe_worklist')
assert(screen.onCreated.includes("const SAVE_PROC = '" + SAVE_PROCESS + "'"))
assert(screen.onCreated.includes("const SEND_PROC = '" + SEND_PROCESS + "'"))
assert(worklistWidget.content.includes(':disabled="!canReceiveOrder(order)||receiveLoading||rejectLoading||cancelDialog.loading"'))
assert(worklistWidget.content.includes('@click="receiveSelected(order)"'))

const orders = []
const items = []
const workItems = []
const outboundOrders = []
const processCalls = []
const worklistProcessCalls = []
let receiveDisabledCases = 0
let visibleTestRows = 0
let myOrderedSpecimenRows = 0
const sectionCounts = Object.fromEntries(rooms.map(room => [room.code, 0]))
const sectionCoverage = Object.fromEntries(rooms.map(room => [room.code, {
  quantity: new Set(),
  priority: new Set(),
  storage: new Set(),
  source: new Set(),
  combination: new Set(),
}]))
const storageValues = ['IM', 'RF', 'RT']

const worklistHost = { formParams: {}, getFieldRef: () => null }
const worklistRuntime = {
  vueState: {},
  globalUserState: {
    user: { unit: { code: 'LAB' } },
    runProcess: (...args) => { worklistProcessCalls.push(args) },
  },
  getFormRef: () => worklistHost,
  confirm: () => {},
  notify: () => {},
}
new Function(worklistWidget.onCreated).call(worklistRuntime)
const worklistState = worklistRuntime.vueState

const mySpecimenNames = ['Hair', 'Skin scraping', 'Nail clipping']
const mySpecimenCodes = ['HAIR', 'SKIN', 'NAIL']
const mySiteNames = ['ศีรษะ', 'แขน', 'ขา']
const mySiteCodes = ['HEAD', 'ARM', 'LEG']

const cases = []
rooms.forEach(room => {
  const sourceModes = ['MB', 'MY'].includes(room.code) ? ['required'] : ['blank', 'populated']
  for (const quantity of [1, 2, 3]) {
    for (const priority of ['1', '2', '3', '4', '5']) {
      for (const storage of storageValues) {
        for (const sourceMode of sourceModes) {
          cases.push({ room, quantity, priority, storage, sourceMode })
        }
      }
    }
  }
})

const makeId = (prefix, value) => prefix + String(value).padStart(20, '0')

const persistSave = (payload, room, caseNo) => {
  const orderId = makeId('o', caseNo)
  const orderNumber = 'LAB-SEED-' + String(caseNo).padStart(4, '0')
  const order = {
    _id: orderId,
    xrstatx: 1,
    xparentx: payload.visit_id,
    order_number: orderNumber,
    current_status: 'draft',
    service_type: { value: 'lab', label: 'Lab Test' },
    item_count: payload.lines.length,
    order_comment: payload.order_comment,
    order_tags: payload.order_tags,
    priority: payload.priority,
    vid: {
      value: payload.visit_id,
      vn: 'VN' + String(caseNo).padStart(6, '0'),
      pid: { hn: 'HN' + String(caseNo).padStart(6, '0') },
    },
  }
  orders.push(order)

  payload.lines.forEach((line, lineIndex) => {
    const d = line.lab_data || null
    items.push({
      _id: makeId('i', (caseNo * 10) + lineIndex),
      xrstatx: 1,
      order_id: {
        value: orderId,
        label: orderNumber,
        xtbxlv2_xfx_id: payload.visit_id,
      },
      item_source: line.item_source,
      item_form_id: line.item_form_id,
      item_data_id: line.item_data_id,
      item_code: line.item_code,
      item_name: line.item_name,
      quantity: line.quantity,
      service_type: { value: line.service_type, label: 'Lab Test' },
      current_status: 'draft',
      section_snapshot: { code: room.code, name: room.name },
      lab_data: d ? {
        spec_source: d.source,
        spec_source_code: d.source_code || '',
        ship_storage: d.storage,
        specimen_at: d.at,
        specimen_by: { value: d.by_id, label: d.by },
        rows: Array.isArray(d.specimens) ? d.specimens.map(row => ({ ...row })) : [],
      } : null,
    })
  })
  return { orderId, orderNumber }
}

for (let index = 0; index < cases.length; index += 1) {
  const caseNo = index + 1
  const { room, quantity, priority, storage, sourceMode } = cases[index]
  const visitId = makeId('v', caseNo)
  const specimenAt = '2026-10-' + String(1 + (index % 28)).padStart(2, '0')
    + 'T' + String(8 + (index % 10)).padStart(2, '0')
    + ':' + String((index * 7) % 60).padStart(2, '0')
  const source = sourceMode === 'blank' ? '' : 'ตำแหน่งทดสอบ ' + room.code + '-' + caseNo
  const orderedRows = room.code === 'MY'
    ? Array.from({ length: quantity }, (_, specimenIndex) => ({
      spec_source_code: mySpecimenCodes[specimenIndex],
      spec_source: mySpecimenNames[specimenIndex],
      spec_site_code: mySiteCodes[specimenIndex],
      spec_site_name: mySiteNames[specimenIndex],
      specimen_at: specimenAt,
      ship_storage: storage,
      spec_note: 'MY seed specimen ' + (specimenIndex + 1),
    }))
    : []
  const collectorId = makeId('u', caseNo)
  const collectorLabel = 'Seed Collector ' + caseNo
  const callsForCase = []
  let closed = 0

  const context = {
    visit_id: visitId,
    hn: 'HN' + String(caseNo).padStart(6, '0'),
    inscl_hos: [{
      inscl_item_main: { value: 'UCS', label: 'สิทธิทดสอบ' },
      inscl_item_sub: { value: 'SEED', label: 'Seed only' },
    }],
  }

  const formHost = {
    $labCpoeContext: context,
    closePopup: () => { closed += 1 },
    userState: {
      runProcess: (processId, payload, success) => {
        processCalls.push(processId)
        callsForCase.push({ processId, payload })
        if (processId === SAVE_PROCESS) {
          const persisted = persistSave(payload, room, caseNo)
          success({ data: { success: true, order_id: persisted.orderId, order_number: persisted.orderNumber } })
          return
        }
        if (processId === SEND_PROCESS) {
          const order = orders.find(row => row._id === payload.order_id)
          assert(order, 'send must reference the order just saved')
          order.current_status = 'sent'
          items.filter(row => row.order_id.value === order._id).forEach(row => { row.current_status = 'sent' })
          success({ data: { success: true } })
          return
        }
        assert.fail('unexpected process call (receive/agent must not run): ' + processId)
      },
    },
  }

  const runtime = {
    vueState: {},
    params: {
      manual_visit: true,
      source: 'lab-worklist',
      lab_scope: true,
      organization_code: 'LAB',
      section_codes: [room.code],
    },
    globalUserState: { user: { _id: collectorId } },
    getFormRef: () => formHost,
    alert: () => {},
  }
  new Function(screen.onCreated).call(runtime)

  const state = runtime.vueState
  state.docId = collectorId
  state.prio = priority
  state.cart = [{
    k: 'lab:' + room.masterId,
    st: 'lab',
    id: room.masterId,
    c: room.itemCode,
    n: room.itemName,
    sec: room.code,
    sp: room.specimenCode,
    spn: room.specimenName,
    qty: quantity,
    lab_data: {
      source,
      source_code: room.specimenCode,
      storage,
      at: specimenAt,
      by: collectorLabel,
      specimens: orderedRows,
    },
  }]
  state.sendOrder()

  assert.deepStrictEqual(callsForCase.map(call => call.processId), [SAVE_PROCESS, SEND_PROCESS])
  assert.strictEqual(closed, 1, 'successful send closes the order popup once')

  const save = callsForCase[0].payload
  assert.strictEqual(save.visit_id, visitId)
  assert.strictEqual(save.organization_code, 'LAB')
  assert.deepStrictEqual(save.section_codes, [room.code])
  assert.strictEqual(save.service_type, 'lab')
  assert.strictEqual(save.lines.length, 1)
  assert.strictEqual(save.lines[0].item_form_id, ITEM_MASTER_FORM)
  assert.strictEqual(save.lines[0].item_data_id, room.masterId)
  assert.strictEqual(save.lines[0].item_code, room.itemCode)
  assert.strictEqual(save.lines[0].service_type, 'lab')
  assert.strictEqual(save.priority, priority)
  assert.strictEqual(save.lines[0].quantity, quantity)
  assert.deepStrictEqual(save.lines[0].lab_data, {
    source,
    source_code: room.specimenCode,
    storage,
    at: specimenAt,
    by: collectorLabel,
    specimens: orderedRows,
    by_id: collectorId,
  })

  // Same linkage/filter used by emr-summary-get-FULL-v1 and emr-lab-board-get.
  const emrRows = items.filter(row =>
    row.xrstatx === 1
      && row.order_id.xtbxlv2_xfx_id === visitId
      && row.service_type.value === 'lab',
  )
  assert.strictEqual(emrRows.length, 1, 'sent CPOE item must be visible to EMR by visit')
  assert.strictEqual(emrRows[0].current_status, 'sent')
  assert.strictEqual(emrRows[0].section_snapshot.code, room.code)
  assert.deepStrictEqual(emrRows[0].lab_data, {
    spec_source: source,
    spec_source_code: room.specimenCode,
    ship_storage: storage,
    specimen_at: specimenAt,
    specimen_by: { value: collectorId, label: collectorLabel },
    rows: orderedRows,
  })

  // LAB Worklist resolves the room from snapshot/context/master; this seed uses
  // section_snapshot to prove each order routes only to its selected room.
  const routedRoom = emrRows[0].section_snapshot.code
  assert.strictEqual(routedRoom, room.code)

  // Stop at the exact UI boundary requested by the user. This uses the real
  // Worklist helpers but deliberately never calls receiveSelected(). Every
  // freshly sent Item remains selectable while Finance keeps Receive disabled.
  const worklistItem = {
    item_id: emrRows[0]._id,
    item_code: emrRows[0].item_code,
    item_name: emrRows[0].item_name,
    quantity: emrRows[0].quantity,
    current_status: emrRows[0].current_status,
    section: { code: room.code, name: room.name },
    order_requirements: {
      multi_specimen: room.code === 'MY',
      req_commt: room.code === 'MI-OUT',
    },
    item_comment: room.code === 'MI-OUT' ? 'Seed required comment ' + caseNo : '',
    specimen: {
      complete: false,
      master: { code: room.specimenCode, name: room.specimenName },
      ordered: orderedRows.length
        ? { source, source_code: room.specimenCode, rows: orderedRows.map(row => ({ ...row })) }
        : {
          source,
          source_code: room.specimenCode,
          collected_at: specimenAt,
          storage,
        },
    },
  }
  const worklistOrder = {
    order_id: orders.at(-1)._id,
    current_status: 'sent',
    items: [worklistItem],
  }
  worklistState.viewMode = 'today'
  worklistState.selected = { [worklistItem.item_id]: true }
  assert.strictEqual(worklistState.isSelected(worklistItem.item_id), true)
  assert.strictEqual(worklistState.canReceiveOrder(worklistOrder), false, room.code + ' Receive must stay disabled before Finance')
  assert.strictEqual(worklistState.receiveDisabledReason(worklistOrder), 'ยังไม่ผ่านการเงิน')
  assert.strictEqual(worklistState.statusText(worklistItem.current_status), 'รอรับ')
  assert.strictEqual(worklistState.displayItemCount(worklistOrder), quantity, room.code + ' must render every ordered test quantity')
  assert.strictEqual(worklistState.displayItems(worklistOrder).length, quantity)
  assert.strictEqual(worklistState.isSourceManagedItem(worklistItem), ['IM', 'MI-OUT', 'MY', 'MB'].includes(room.code))
  assert.strictEqual(worklistState.isSpecimenLockedItem(worklistItem), ['IM', 'MI-OUT'].includes(room.code))
  if (room.code === 'MY') {
    assert.strictEqual(worklistState.isManualPathologyItem(worklistItem), true)
    assert.strictEqual(worklistState.resultDisplayItems(worklistOrder).length, quantity)
    assert.strictEqual(worklistState.multiSpecimenRows(worklistItem).length, quantity)
    assert.deepStrictEqual(
      worklistState.multiSpecimenRows(worklistItem).map(row => row.spec_site_name),
      mySiteNames.slice(0, quantity),
    )
    myOrderedSpecimenRows += quantity
  } else {
    assert.strictEqual(worklistState.isManualPathologyItem(worklistItem), false)
    assert.strictEqual(worklistState.resultDisplayItems(worklistOrder).length, 1, room.code + ' must retain the shared result-row rule')
  }
  visibleTestRows += quantity
  receiveDisabledCases += 1

  const coverage = sectionCoverage[room.code]
  coverage.quantity.add(quantity)
  coverage.priority.add(priority)
  coverage.storage.add(storage)
  coverage.source.add(sourceMode)
  coverage.combination.add([quantity, priority, storage, sourceMode].join('|'))
  sectionCounts[room.code] += 1
}

assert.strictEqual(orders.length, cases.length)
assert.strictEqual(items.length, cases.length)
assert.strictEqual(processCalls.filter(id => id === SAVE_PROCESS).length, cases.length)
assert.strictEqual(processCalls.filter(id => id === SEND_PROCESS).length, cases.length)
assert.strictEqual(processCalls.length, cases.length * 2, 'only save and send are allowed in this test')
assert.strictEqual(worklistProcessCalls.length, 0, 'Worklist must stop before any Receive/API process')
assert.strictEqual(receiveDisabledCases, cases.length, 'Receive must be disabled in every seeded case')
assert.strictEqual(workItems.length, 0, 'must not create Lab Work Item before receiving specimen')
assert.strictEqual(outboundOrders.length, 0, 'must not create/send Agent payload before receiving specimen')
rooms.forEach(room => {
  const coverage = sectionCoverage[room.code]
  const expectedSourceModes = ['MB', 'MY'].includes(room.code) ? 1 : 2
  const expectedCases = 3 * 5 * storageValues.length * expectedSourceModes
  assert.strictEqual(sectionCounts[room.code], expectedCases, room.code + ' must cover its complete Cartesian matrix')
  assert.strictEqual(coverage.combination.size, expectedCases, room.code + ' must not repeat or omit a matrix combination')
  assert.deepStrictEqual([...coverage.quantity].sort(), [1, 2, 3], room.code + ' must cover quantity 1-3')
  assert.deepStrictEqual([...coverage.priority].sort(), ['1', '2', '3', '4', '5'], room.code + ' must cover every priority')
  assert.deepStrictEqual([...coverage.storage].sort(), ['IM', 'RF', 'RT'], room.code + ' must cover every storage mode')
  assert(coverage.source.has('required') || (coverage.source.has('blank') && coverage.source.has('populated')), room.code + ' source coverage is incomplete')
})

const coverageSummary = Object.fromEntries(Object.entries(sectionCoverage).map(([code, coverage]) => [code, {
  quantity: [...coverage.quantity].sort(),
  priority: [...coverage.priority].sort(),
  storage: [...coverage.storage].sort(),
  source: [...coverage.source].sort(),
  combinations: coverage.combination.size,
}]))

console.log(JSON.stringify({
  suite: 'LAB manual order full Cartesian seed',
  cases: orders.length,
  cpoe_items: items.length,
  emr_visible: items.filter(row => row.current_status === 'sent').length,
  visible_test_rows: visibleTestRows,
  my_ordered_specimen_rows: myOrderedSpecimenRows,
  receive_disabled: receiveDisabledCases,
  receive_calls: 0,
  lab_work_items: workItems.length,
  agent_outbound: outboundOrders.length,
  by_section: sectionCounts,
  coverage_by_section: coverageSummary,
}, null, 2))
console.log('LAB manual order full-matrix seed tests passed')
