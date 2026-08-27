const fs = require('fs')
const assert = require('assert')

const doc = JSON.parse(fs.readFileSync('Lab_Biochem_initCraft_import.json', 'utf8'))

const findOptions = (value, name) => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findOptions(item, name)
      if (found) return found
    }
    return null
  }
  if (!value || typeof value !== 'object') return null
  if (value.options && value.options.name === name) return value.options
  for (const child of Object.values(value)) {
    const found = findOptions(child, name)
    if (found) return found
  }
  return null
}

const resulted = findOptions(doc, 'lab_resulted_component')
const received = findOptions(doc, 'lab_received_component')
assert(resulted && received)

assert.match(resulted.content, /class="lab-waiting-row"/)
assert.match(resulted.content, /class="lab-hover-action-group"/)
assert.match(resulted.content, /@click="viewResult\(row\)"[^>]*>ดูผล</)
assert.doesNotMatch(resulted.content, /ค่าผล Manual|กรอกผล|unitOptions/)

const processingRow = {
  _id: { $oid: '6a8210b7ebe955d6977ec9d3' },
  order_number: '7069000009',
  section_code: '70',
  section_name: 'Biomolecular and Genetics',
  work_status: 'processing',
  processing_at: '2026-08-17 04:00:00',
  patient_hn: '63481525',
  patient_name: 'น.ส. กนกวลี สิงห์รุ่งเรืองกิจ',
  selected_items: '[{"code":"L1"},{"code":"CBC"}]',
  specimens: '[{"label":"Blood"}]'
}
const statusRows = [
  processingRow,
  { ...processingRow, _id: '6a8210b7ebe955d6977ec9d4', order_number: '7069000010', section_code: 'BG', work_status: 'completed' },
  { ...processingRow, _id: '6a8210b7ebe955d6977ec9d5', order_number: '1069000018', section_code: '10' },
  { ...processingRow, _id: '6a8210b7ebe955d6977ec9d6', order_number: '7069000011', work_status: 'received' }
]
const notices = []
const resultApi = {
  user: { unit: { code: '70', name: 'Biomolecular and Genetics' } },
  crudGetAll: (request, success) => success({ data: statusRows })
}
const resultForm = { userState: resultApi }
const resultField = {
  vueState: {},
  globalUserState: resultApi,
  getFormRef: () => resultForm,
  notify: (...args) => notices.push(args)
}
const realSetInterval = global.setInterval
global.setInterval = () => 1
try {
  new Function(resulted.onCreated).call(resultField)
} finally {
  global.setInterval = realSetInterval
}
assert.deepEqual(resultField.vueState.rows.map(row => row.order_number), ['7069000009', '7069000010'])
assert.equal(resultField.vueState.items(processingRow).length, 2)
assert.equal(resultField.vueState.specimens(processingRow), 'Blood')
assert.equal(resultField.vueState.statusLabel(processingRow), 'กำลังตรวจ')
resultField.vueState.viewResult(processingRow)
assert.match(notices.at(-1)[0], /เชื่อมฟอร์ม Manual ในขั้นตอนถัดไป/)

const marker = 's.startProcess = () => {'
const start = received.onCreated.indexOf(marker)
const endMarker = '\n};\n\n// A lazy tab'
const end = received.onCreated.indexOf(endMarker, start)
assert(start >= 0 && end > start)
const startProcessAssignment = received.onCreated.slice(start, end + 4)

let processCall = null
let cleared = 0
let resultReloads = 0
let allReloads = 0
const tabs = { activeTabName: 'tab-pane-lab-received' }
const refs = {
  lab_resulted_component: { vueState: { load: () => { resultReloads++ } } },
  lab_all_orders_center_specimen: { vueState: { load: () => { allReloads++ } } },
  lab_biochem_tabs: tabs
}
const transitionApi = {
  runProcess: (id, params, success) => {
    processCall = { id, params }
    success({ success: true, work_status: 'processing' })
  }
}
const transitionForm = {
  userState: transitionApi,
  getFieldRef: name => refs[name] || null
}
const transitionField = {
  globalUserState: transitionApi,
  getFormRef: () => transitionForm,
  notify: (...args) => notices.push(args)
}
const state = {
  selected: () => processingRow,
  clearReceiveRow: () => { cleared++ }
}
new Function('s', 'field', 'labText', startProcessAssignment)(state, transitionField, value => String(value == null ? '' : value))
const realSetTimeout = global.setTimeout
global.setTimeout = callback => { callback(); return 1 }
try {
  state.startProcess()
} finally {
  global.setTimeout = realSetTimeout
}
assert(processCall)
assert.equal(processCall.id, '6a7e787e8d398c11cf2fe8b8')
assert.deepEqual(processCall.params, { action: 'update_work_status', order_number: '7069000009', work_status: 'processing' })
assert.equal(cleared, 1)
assert.equal(resultReloads, 1)
assert.equal(allReloads, 1)
assert.equal(tabs.activeTabName, 'tab-pane-lab-resulted')

process.stdout.write('PASS: start processing updates Status, opens resulted tab, and renders room-filtered hover View Result list\n')
