const fs = require('fs')
const vm = require('vm')
const path = require('path')

const FILE = path.join(__dirname, 'Lab_Workbench_Tab_List_OPD_Draft.json')
const form = JSON.parse(fs.readFileSync(FILE, 'utf8'))
const errors = []

const assert = (condition, message) => { if (!condition) errors.push(message) }
const nodes = []
function walk(value) {
  if (!value || typeof value !== 'object') return
  if (!Array.isArray(value) && value.component) nodes.push(value)
  if (Array.isArray(value)) value.forEach(walk)
  else Object.values(value).forEach(walk)
}
walk(form.fields)

const tab = nodes.find(n => n.component === 'tab')
const panes = nodes.filter(n => n.component === 'tab-pane')
const lists = nodes.filter(n => n.component === 'list-ui')
const opd = nodes.find(n => n.component === 'vue-ui' && n.options?.name === 'lab_patient_opd_card')

assert(Array.isArray(form.fields) && form.fields.length === 2, 'Root must contain shared OPD Card then Tab')
assert(form.fields[0]?.options?.name === 'lab_patient_opd_card', 'Search/OPD Card must be above Tab')
assert(form.fields[1]?.component === 'tab', 'Tab must follow OPD Card')
assert(Boolean(opd), 'Missing OPD Card widget')
assert(opd?.options?.content?.includes('ค้นหาด้วย HN, CID หรือชื่อ-นามสกุล'), 'Missing patient search above OPD Card')
assert(opd?.options?.content?.indexOf('ค้นหาด้วย HN') < opd?.options?.content?.indexOf('<el-card'), 'Search controls are not above OPD Card header')
assert(opd?.options?.content?.includes('สแกน HN / LAB NO. / Barcode'), 'Missing barcode search')

assert(Boolean(tab), 'Missing Tab widget')
assert(panes.length === 4, `Expected 4 Tab panes, found ${panes.length}`)
const labels = panes.map(p => p.options?.label)
assert(JSON.stringify(labels) === JSON.stringify(['รอรับ', 'รับเข้าแล้ว / รอตรวจ', 'ผลแลป', 'ยกเลิกรายการ']), `Unexpected tab labels: ${labels.join(', ')}`)
assert(!labels.includes('รายการรวม'), 'Obsolete รายการรวม tab must be removed')
assert(panes.filter(p => p.options?.active).length === 1 && panes[0]?.options?.active === true, 'Only รอรับ may be active initially')

assert(lists.length === 5, `Expected 5 ListViews, found ${lists.length}`)
const listNames = lists.map(n => n.options?.name)
for (const name of ['lab_waiting_list', 'lab_received_processing_list', 'lab_result_reports_list', 'lab_result_items_list', 'lab_cancelled_list']) {
  assert(listNames.includes(name), `Missing ListView ${name}`)
}
assert(!nodes.some(n => ['table', 'data-grid', 'sub-form'].includes(n.component)), 'Draft must not use Table/DataGrid/SubForm')

for (const list of lists) {
  assert(Boolean(list.key), `${list.options?.name}: missing catalog key`)
  assert(Boolean(list.id), `${list.options?.name}: missing id`)
  assert(list.options?.providerType === 'FORM', `${list.options?.name}: providerType must be FORM`)
  assert(Boolean(list.options?.formId), `${list.options?.name}: missing formId`)
  assert(Array.isArray(list.options?.searchField), `${list.options?.name}: searchField must be an array`)
  assert(typeof list.options?.detailContent === 'string' && list.options.detailContent.length > 30, `${list.options?.name}: missing visible detailContent`)
}

const resultPane = panes.find(p => p.options?.name === 'lab_results')
const resultGrid = resultPane?.fields?.find(n => n.component === 'grid')
assert(Boolean(resultGrid), 'Result tab must contain two-column grid')
assert(resultGrid?.cols?.length === 2, 'Result tab must have left/right columns')
assert(resultGrid?.cols?.[0]?.options?.span === 9 && resultGrid?.cols?.[1]?.options?.span === 15, 'Result split must be 9/15')
const resultItems = lists.find(n => n.options?.name === 'lab_result_items_list')
assert(resultItems?.options?.groupField === 'source_item_id', 'Result items must group by ordered source item')
for (const visible of ['ผล', 'ค่าปกติ', 'Critical', 'ผู้ลงผล', 'ผู้รับรอง']) {
  assert(resultItems?.options?.detailContent?.includes(visible), `Result UI missing ${visible}`)
}
for (const hiddenTechnical of ['Result UID', 'Report Seq', 'Schema version', 'Payload Hash', 'Items JSON Snapshot', 'จับคู่ไม่สำเร็จ']) {
  assert(!lists.some(n => n.options?.detailContent?.includes(hiddenTechnical)), `Technical field leaked into user UI: ${hiddenTechnical}`)
}

// Behavior test: clicking a Result Report must select the report, refresh the
// right Result Item ListView, and pass the row to the shared OPD Card.
const resultReports = lists.find(n => n.options?.name === 'lab_result_reports_list')
let selectedWhere = ''
let editorWhere = ''
let refreshCount = 0
let selectedPatientRow = null
const itemEditor = { dpFormData: { options: {} }, handleRefresh: () => { refreshCount += 1 } }
const itemRef = {
  setFieldOption: (name, value) => { if (name === 'where') selectedWhere = value },
  getFieldEditor: () => itemEditor,
}
Object.defineProperty(itemEditor, 'dpFormData', {
  value: { options: new Proxy({}, { set(target, prop, value) { if (prop === 'where') editorWhere = value; target[prop] = value; return true } }) },
})
const cardRef = { vueState: { selectLabRow: row => { selectedPatientRow = row } } }
const mockForm = {
  getFieldRef: name => name === 'lab_result_items_list' ? itemRef : name === 'lab_patient_opd_card' ? cardRef : null,
}
const clickHandler = new Function('row', resultReports.options.clickEvent)
clickHandler.call({ getFormRef: () => mockForm }, { _id: 'report-123', patient_hn: 'TEST-HN' })
assert(mockForm.$labSelectedResultReportId === 'report-123', 'Result report click did not persist selected report id')
assert(selectedWhere === "result_report_id = 'report-123'", 'Result report click did not update Result Item where')
assert(editorWhere === "result_report_id = 'report-123'", 'Result report click did not update live ListView editor where')
assert(refreshCount === 1, 'Result report click must refresh Result Item ListView exactly once')
assert(selectedPatientRow?.patient_hn === 'TEST-HN', 'Result report click did not pass row to OPD Card')

const ids = nodes.map(n => n.id).filter(Boolean)
assert(new Set(ids).size === ids.length, 'Widget ids must be unique')
const optionNames = nodes.map(n => n.options?.name).filter(Boolean)
assert(new Set(optionNames).size === optionNames.length, 'Widget option names must be unique')

// Syntax-check custom event code without executing initCraft APIs.
for (const node of nodes) {
  for (const key of ['onCreated', 'onMounted', 'onUnmount', 'clickEvent']) {
    const code = node.options?.[key]
    if (!code || typeof code !== 'string') continue
    try { new vm.Script(`(function(){${code}\n})`) }
    catch (error) { errors.push(`${node.options?.name || node.id}.${key}: ${error.message}`) }
  }
}

assert(form.formConfig?.jsonVersion === 3, 'jsonVersion must be 3')
assert(Object.keys(form).length === 2 && form.fields && form.formConfig, 'Top-level schema must match person.json: fields + formConfig only')

if (errors.length) {
  console.error(`FAIL (${errors.length})`)
  errors.forEach(error => console.error(`- ${error}`))
  process.exit(1)
}

console.log('PASS: JSON parse and SDForm structure')
console.log('PASS: Search/Barcode is above shared OPD Card')
console.log('PASS: Exactly 4 tabs; no รายการรวม')
console.log('PASS: 5 native ListViews; no Table/DataGrid/SubForm')
console.log('PASS: Result tab uses 9/15 split and groups results by source_item_id')
console.log('PASS: Result Report click filters/refreshes Result Item list and updates OPD Card context')
console.log('PASS: User UI contains result/normal/critical/reporter/verifier and hides technical receipt fields')
console.log('PASS: Widget IDs/names are unique and custom JavaScript parses')
