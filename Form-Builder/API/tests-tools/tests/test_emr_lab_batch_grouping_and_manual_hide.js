#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../../../..')
const PROCESS = path.join(ROOT, 'Form-Builder/API/api-factory/processes/emr-lab-board-get.js')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

const VISIT_ID = '111111111111111111111111'
const ORDER_ID = '222222222222222222222222'
const REPORT_ID = '333333333333333333333333'
const itemIds = {
  sodium: '444444444444444444444441',
  potassium: '444444444444444444444442',
  chloride: '444444444444444444444443',
  co2: '444444444444444444444444',
  glucose: '444444444444444444444445',
  creatinine: '444444444444444444444446',
  bun: '444444444444444444444447',
}
const masterIds = Object.fromEntries(Object.keys(itemIds).map((key, index) => [key, `55555555555555555555555${index + 1}`]))

const definitions = [
  ['sodium', 'C25.1-CD', 'Sodium (Na) จาก Clotted blood', '102501CD', 'C25-CD'],
  ['potassium', 'C25.2-CD', 'Potassium (K) จาก Clotted blood', '102502CD', 'C25-CD'],
  ['chloride', 'C25.3-CD', 'Chloride (Cl) จาก Clotted blood', '102503CD', 'C25-CD'],
  ['co2', 'C25.4-CD', 'Total Carbondioxide (tCO2) จาก Clotted blood', '102504CD', 'C25-CD'],
  ['glucose', 'C23', 'Sugar (Glucose) (BS)', '1023CD', ''],
  ['creatinine', 'C21', 'Creatinine', '100802CD', ''],
  ['bun', 'C20', 'BUN', '100801CD', ''],
]

const cpoeItems = definitions.map(([key, itemCode, itemName], index) => ({
  _id: itemIds[key],
  item_data_id: masterIds[key],
  item_no: index + 1,
  item_code: itemCode,
  item_name: itemName,
  order_id: { value: ORDER_ID, xtbxlv2_xfx_id: VISIT_ID },
  service_type: { value: 'lab' },
  current_status: { value: 'completed' },
  ...(key === 'potassium'
    ? { is_hide_result: true, result_visibility_action: 'hide', result_visibility_reason: 'กำลังตรวจสอบผล' }
    : {}),
}))

const masters = definitions.map(([key, itemCode, itemName, resultCode, parentCode]) => ({
  _id: masterIds[key],
  item_code: itemCode,
  item_name: itemName,
  is_hide_result: false,
  lab_parent: parentCode ? { value: parentCode, label: `C25-CD Electrolyte จาก Clotted blood (สปสช.)` } : null,
  lab_item: { his_lab_code: resultCode, value: resultCode },
  xrstatx: 1,
})).concat([{ _id: '666666666666666666666666', item_code: 'C25-CD', item_name: 'Electrolyte จาก Clotted blood (สปสช.)', xrstatx: 1 }])

const selectedItems = definitions.map(([key, itemCode, itemName, resultCode], index) => ({
  seq: index + 1,
  source_item_id: itemIds[key],
  item_code: itemCode,
  item_name: itemName,
  test_code: resultCode,
}))

const result = (id, code, name, value, sequence) => ({
  _id: id,
  hn: '6900031',
  visit_id: '6900256',
  // Aggregate receipt stores every row under the first Work Item.
  order_no: itemIds.sodium,
  result_report_id: REPORT_ID,
  filler_order_no: '106909100001',
  obs_code: code,
  obs_name: name,
  test_code: code,
  test_name: name,
  result_value: value,
  units: 'mmol/L',
  ref_range: '-',
  interpretation_code: 'N',
  result_status: 'final',
  result_sequence: String(sequence),
  entered_at: '2026-09-10T21:15:56.902+07:00',
  created_at: '2026-09-10 21:15:56',
})

const results = [
  result('777777777777777777777771', '100801CD', 'BUN', '25.00', 1),
  result('777777777777777777777772', '100802CD', 'Creatinine', '0.45', 2),
  result('777777777777777777777773', '101120CD', 'eGFR', '27.33', 3),
  result('777777777777777777777774', '1023CD', 'Glucose', '88', 4),
  result('777777777777777777777775', '102501CD', 'Sodium', '136', 5),
  result('777777777777777777777776', '102502CD', 'Potassium', 'secret-potassium', 6),
  result('777777777777777777777777', '102503CD', 'Chloride', '95', 7),
  result('777777777777777777777778', '102504CD', 'Carbondioxide', '28.0', 8),
]

const dataFor = request => {
  const { collection, query = {} } = request.nosql
  if (collection === 'zdata_visit') return [{ _id: VISIT_ID, vn: '6900256', visit_date: '2026-09-10 08:00:00', pid: { hn: '6900031' } }]
  if (collection === 'zdata_cpoe_order_item') return cpoeItems
  if (collection === 'zdata_master_item_order') return masters
  if (collection === 'zdata_cpoe_order') return [{ _id: ORDER_ID, order_number: 'R2609100005', created_at: '2026-09-10 17:14:31' }]
  if (collection === 'zdata_lab_work_item') return [{
    _id: itemIds.sodium,
    source_order_id: ORDER_ID,
    source_order_number: 'R2609100005',
    source_specimen_record_id: itemIds.sodium,
    receipt_batch_id: itemIds.sodium,
    selected_items_json: JSON.stringify(selectedItems),
    visit_id: '6900256',
    lab_no: '106909100001',
    section_code: 'BC',
    section_name: 'Biochemistry',
    work_status: 'completed',
    received_at: '2026-09-10 17:20:00',
  }]
  if (collection === 'zdata_lab_result_item') {
    if (query.visit_id || query.hn) return results
    return []
  }
  return []
}

const app = {
  dbObjectId: value => value,
  dbFindAll: async request => ({ success: true, reply: { data: dataFor(request) } }),
}

;(async () => {
  const run = new AsyncFunction('params', 'userInfo', 'app', fs.readFileSync(PROCESS, 'utf8'))
  const payload = await run({ visit_id: VISIT_ID }, { username: 'doctor.test' }, app)

  assert.strictEqual(payload.lab_orders.length, 1, 'aggregate batch children must stay in one LAB order/section')
  const order = payload.lab_orders[0]
  assert.strictEqual(order.items.length, 8)
  assert.strictEqual(order.ordered_items.length, definitions.length, 'EMR must preserve every CPOE Item for item-level MLab navigation')
  assert.deepStrictEqual(order.ordered_items.map(item => item.item_code), definitions.map(([, itemCode]) => itemCode))

  const potassium = order.items.find(item => item.name === 'Potassium (K) จาก Clotted blood')
  assert(potassium, 'manual-hidden CPOE Item must remain visible by name')
  assert.strictEqual(potassium.visibility.state, 'hidden')
  assert.strictEqual(potassium.visibility.manual_hidden, true)
  assert.strictEqual(potassium.group_id, 'panel:C25-CD')
  for (const forbidden of ['value', 'unit', 'ref', 'flag', 'critical', 'result_item_id', 'result_comment', 'previous', 'previous_values']) {
    assert.strictEqual(Object.prototype.hasOwnProperty.call(potassium, forbidden), false, `${forbidden} leaked from manual-hidden row`)
  }

  const creatinineRows = order.items.filter(item => item.group_id === itemIds.creatinine)
  assert.deepStrictEqual(creatinineRows.map(item => item.name), ['Creatinine', 'eGFR'])
  const electrolyteRows = order.items.filter(item => item.group_id === 'panel:C25-CD')
  assert.strictEqual(electrolyteRows.length, 4)
  assert(electrolyteRows.every(item => item.group_name === 'Electrolyte จาก Clotted blood (สปสช.)'))

  assert.strictEqual(JSON.stringify(payload).includes('secret-potassium'), false, 'manual-hidden value must not reach the EMR response')
  assert.strictEqual(payload.summary_lab.some(item => item.name === 'Potassium'), false, 'summary/trend surface must not leak a manually hidden value')

  console.log('ok - EMR resolves aggregate LAB rows to CPOE items, mirrors LAB Profile grouping, and redacts manual hide')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
