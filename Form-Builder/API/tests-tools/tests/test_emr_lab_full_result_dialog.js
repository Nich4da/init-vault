const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../../../..')
const PROCESS = path.join(ROOT, 'Form-Builder/API/api-factory/processes/emr-lab-board-get.js')
const EVENTS = [
  path.join(ROOT, 'Form-Builder/API/form-factory/events/treat-summary-onCreated-FULL-v1.js'),
  path.join(ROOT, 'Form-Builder/API/form-factory/events/treat-summary-lab-xray-oncreated-v1.js'),
]
const TEMPLATES = [
  path.join(ROOT, '02-his/form-factory/treat-summary-template-FULL-v1.html'),
  path.join(ROOT, '02-his/form-factory/treat-summary-lab-xray-template-v1.html'),
]

const VISIT_ID = '222222222222222222222222'
const ORDER_ID = '333333333333333333333333'
const ITEM_ID = '444444444444444444444444'
const CURRENT_RESULT_ID = '555555555555555555555555'
const PREVIOUS_RESULT_ID = '666666666666666666666666'
const REPORT_ID = '777777777777777777777777'

const currentResult = {
  _id: CURRENT_RESULT_ID,
  hn: '6900023',
  visit_id: '6900317',
  order_no: ITEM_ID,
  filler_order_no: '226909240001',
  result_report_id: REPORT_ID,
  obs_code: '220102EB',
  obs_name: 'Hb F',
  result_value: '2.0',
  result_comment: 'Comment from LIS',
  units: '%',
  ref_range: '0-1.2',
  interpretation_code: 'H',
  result_status: 'final',
  entered_at: '2026-09-24 15:30:43',
  created_at: '2026-09-24 15:30:43',
}

const previousResult = {
  _id: PREVIOUS_RESULT_ID,
  hn: '6900023',
  visit_id: '6800999',
  order_no: '888888888888888888888888',
  obs_code: '220102EB',
  obs_name: 'Hb F',
  result_value: '1.0',
  units: '%',
  ref_range: '0-1.2',
  interpretation_code: 'N',
  result_status: 'final',
  entered_at: '2026-08-01 10:00:00',
  created_at: '2026-08-01 10:00:00',
}

const report = {
  _id: REPORT_ID,
  order_no: ITEM_ID,
  reported_at: '2026-09-24 15:30:43',
  reported_by_source_name: 'ทนพญ.ปรัศนีย์ บุญภิญโญ ท.น.15190',
  verified_at: '2026-09-24 15:30:43',
  verified_by_source_name: 'ทนพญ.ปรัศนีย์ บุญภิญโญ ท.น.15190',
  result_attachments: [{ uid: 'file-1', name: 'hemoglobin.pdf', url: '/files/hemoglobin.pdf', size: 1024 }],
}

const dataFor = request => {
  const { collection, query = {} } = request.nosql
  if (collection === 'zdata_visit') return [{ _id: VISIT_ID, vn: '6900317', visit_date: '2026-09-24 08:00:00', pid: { hn: '6900023' } }]
  if (collection === 'zdata_cpoe_order_item') {
    if (query._id) return [{ _id: ITEM_ID, item_name: 'Hemoglobin typing' }]
    return [{ _id: ITEM_ID, order_id: { value: ORDER_ID }, service_type: { value: 'lab' }, item_name: 'Hemoglobin typing', current_status: { value: 'completed' } }]
  }
  if (collection === 'zdata_cpoe_order') return [{ _id: ORDER_ID, order_number: 'R2609240004', created_at: '2026-09-24 15:05:00' }]
  if (collection === 'zdata_lab_work_item') return [{ _id: ITEM_ID, source_order_id: ORDER_ID, source_order_number: 'R2609240004', visit_id: '6900317', lab_no: '226909240001', section_code: 'HM', section_name: 'Hematology', work_status: 'completed', received_at: '2026-09-24 15:10:00' }]
  if (collection === 'zdata_lab_result_item') {
    if (query.visit_id) return [currentResult]
    if (query.hn && query.created_at) return [currentResult]
    if (query.hn) return [currentResult, previousResult]
    return []
  }
  if (collection === 'zdata_lab_report_manual_entry') return [report]
  return []
}

const app = {
  dbObjectId: value => value,
  dbFindAll: async request => ({ success: true, reply: { data: dataFor(request) } }),
}

;(async () => {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  const body = fs.readFileSync(PROCESS, 'utf8')
  const run = new AsyncFunction('params', 'userInfo', 'app', body)
  const payload = await run({ visit_id: VISIT_ID, hn: '6900023' }, { username: 'test' }, app)

  assert.strictEqual(payload.lab_orders.length, 1)
  const order = payload.lab_orders[0]
  assert.strictEqual(order.items.length, 1)
  assert.strictEqual(order.items[0].result_comment, 'Comment from LIS')
  assert.strictEqual(order.items[0].group_id, ITEM_ID)
  assert.strictEqual(order.items[0].group_name, 'Hemoglobin typing')
  assert.strictEqual(order.patient_hn, '6900023')
  assert.strictEqual(order.items[0].previous.value, '1.0')
  assert.strictEqual(order.reported_by_source_name, report.reported_by_source_name)
  assert.strictEqual(order.verified_by_source_name, report.verified_by_source_name)
  assert.deepStrictEqual(order.attachments, report.result_attachments)
  assert.strictEqual(Object.prototype.hasOwnProperty.call(order, 'view_form_id'), false)

  for (const file of EVENTS) {
    const source = fs.readFileSync(file, 'utf8')
    assert.match(source, /s\.tsLabDialog = \{ visible: false, order: null \}/)
    assert.match(source, /s\.tsLabDialog = \{ visible: true, order: o \}/)
    assert.match(source, /result_groups: resultGroups/)
    assert.match(source, /s\.tsResultGroupIsProfile/)
    assert.match(source, /s\.tsResultSourceText/)
    assert.doesNotMatch(source, /s\.tsOpen\(t\.f, t\.d\)/)
    const context = { vueState: { tsLoad: () => {} }, getFormRef: () => null }
    const executable = file.includes('FULL') ? source : `const s=this.vueState; const field=this;\n${source}`
    new Function(executable).call(context)
    const profileItems = ['220101EB', '220102EB', '220103EB', '220104EB', '220105EB'].map((code, index) => ({
      ...order.items[0],
      result_item_id: String(index + 1),
      code,
      name: index ? `Result ${index + 1}` : 'Hemoglobin typing',
    }))
    context.vueState.tsAbsorb({ current_vn: '6900317', lab_orders: [{ ...order, items: profileItems }], xray_results: [] })
    const viewOrder = context.vueState.tsLgVisit[0]
    assert.strictEqual(viewOrder.result_groups.length, 1)
    assert.strictEqual(viewOrder.result_groups[0].test_name, 'Hemoglobin typing')
    assert.strictEqual(viewOrder.result_groups[0].results.length, 5)
    context.vueState.tsOpenOrder(viewOrder)
    assert.strictEqual(context.vueState.tsResultGroupExpanded(viewOrder.result_groups[0], 0), true)
    assert.strictEqual(context.vueState.tsResultRowNumber(viewOrder.result_groups[0], 0, 4), '1.5')
  }

  for (const file of TEMPLATES) {
    const source = fs.readFileSync(file, 'utf8')
    assert.match(source, /v-model="tsLabDialog\.visible"/)
    assert.match(source, /ค่าก่อนหน้า/)
    assert.match(source, /Reported by:/)
    assert.match(source, /Approve name:/)
    assert.match(source, /ไฟล์แนบผลตรวจ/)
    assert.match(source, /หมายเหตุผลตรวจ/)
    assert.match(source, /class="lab-result-dialog"/)
    assert.match(source, /class="lab-result-profile-row"/)
    assert.match(source, /class="lab-result-value-row"/)
    assert.match(source, /โหมดดูอย่างเดียว/)
    assert.match(source, /กาง Profile ทั้งหมด/)
    assert.doesNotMatch(source, /append-to-body/)
    // แถวผลบน Card ต้องแยกเป็น 3 บรรทัด: ชื่อ → รหัส → ค่าปกติ
    assert.match(source, /\{\{ r\.name \}\}<\/span>\s*<small v-if="r\.code" style="display:block/)
    assert.match(source, /\{\{ r\.code \}\}<\/small>\s*<small v-if="r\.ref" style="display:block[^>]*>ปกติ \{\{ r\.ref \}\}/)
    assert.doesNotMatch(source, /\{\{ r\.name \}\}<small v-if="r\.code"/)
    assert.doesNotMatch(source, /o\.time_text[^\n]*<el-tag/)
  }

  console.log('EMR LAB full-result dialog tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
