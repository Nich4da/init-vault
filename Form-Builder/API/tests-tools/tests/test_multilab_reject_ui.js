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

const collectCreated = value => {
  if (Array.isArray(value)) return value.flatMap(collectCreated)
  if (!value || typeof value !== 'object') return []
  const own = value.options && typeof value.options.onCreated === 'string'
    ? [value.options.onCreated]
    : []
  return own.concat(Object.values(value).flatMap(collectCreated))
}

const waiting = findOptions(doc, 'lab_waiting_center_specimen')
const received = findOptions(doc, 'lab_received_component')
const cancelled = findOptions(doc, 'lab_cancelled_listview_final')
assert(waiting && received && cancelled)

const row = {
  _id: { $oid: '6a8210b7ebe955d6977ec9d3' },
  order_number: '7069000009',
  section_code: '70',
  section_name: 'Biomolecular and Genetics',
  specimen_status: 'waiting',
  work_status: '',
  patient_hn: '63481525',
  patient_name: 'น.ส. กนกวลี สิงห์รุ่งเรืองกิจ',
  patient_birth_date: '2011-07-15',
  patient_photo: 'https://example.test/patient.png',
  source_unit_name: 'A102 โรคทั่วไป',
  inscl_hos_json: '[{"inscl_item_main":{"value":"UCS"}},"CASH"]',
  payment_status: 'ชำระเงินแล้ว',
  received_at: '2026-08-17 02:34:00',
  selected_items: '[{"code":"L1"},{"code":"CBC"}]',
  specimens: '[{"specimen_code":"BLOOD","label":"Blood"},{"specimen_code":"CLOT","label":"Clotted blood"}]'
}

let opened = null
let processCall = null
let closed = false
let rejectedRefreshes = 0
const rejectedEditor = { dpFormData: { options: {} }, handleRefresh: () => { rejectedRefreshes++ } }
const refs = {
  lab_cancelled_listview_final: {
    setFieldOption: () => { throw new Error('editor path should update the cancelled filter exactly once') },
    getFieldEditor: () => rejectedEditor
  },
  lab_all_orders_center_specimen: { vueState: { load: () => {} } }
}
const api = {
  user: { unit: { code: '70', name: 'Biomolecular and Genetics' } },
  crudGetAll: (request, success) => success({ data: [row] }),
  runProcess: (id, params, success) => {
    processCall = { id, params }
    success({ success: true, message: 'ปฏิเสธสิ่งส่งตรวจแล้ว' })
  }
}
const form = {
  userState: api,
  getFieldRef: name => refs[name] || null,
  openForm: (formId, dataId, parentId, initData, options) => { opened = { formId, dataId, parentId, initData, options } },
  subFormClose: () => { closed = true }
}
const field = {
  vueState: {},
  globalUserState: api,
  getFormRef: () => form,
  notify: () => {}
}

const realSetInterval = global.setInterval
global.setInterval = () => 1
try {
  new Function(waiting.onCreated).call(field)
} finally {
  global.setInterval = realSetInterval
}

field.vueState.reject(row)
assert(opened)
assert.equal(opened.formId, '6a7713fdcc7d0a8451130331')
assert.equal(opened.initData.source_order_id, '6a8210b7ebe955d6977ec9d3')
assert.equal(opened.initData.order_group_id, '7069000009')
assert.equal(opened.initData.lab_section, '70')
assert.equal(rejectedRefreshes, 0)
assert.doesNotMatch(waiting.onCreated, /syncRejectedList|__cancelledWhere/)

const cancelledField = {
  globalUserState: api,
  getFormRef: () => form,
  getFieldEditor: () => rejectedEditor,
  setFieldOption: () => { throw new Error('editor path should update the cancelled filter exactly once') }
}
global.setInterval = () => 1
try {
  new Function(cancelled.onCreated).call(cancelledField)
} finally {
  global.setInterval = realSetInterval
}
assert.equal(rejectedRefreshes, 1)
assert.match(rejectedEditor.dpFormData.options.where, /section_code = '70'/)
assert.match(rejectedEditor.dpFormData.options.where, /section_code = 'BG'/)
assert.match(rejectedEditor.dpFormData.options.where, /work_status = 'rejected'/)
cancelledField.__applyCancelledRoomFilter()
assert.equal(rejectedRefreshes, 1)
api.user.unit = { code: '20', name: 'Hematology' }
cancelledField.__applyCancelledRoomFilter()
assert.equal(rejectedRefreshes, 2)
assert.match(rejectedEditor.dpFormData.options.where, /section_code = '20'/)
assert.match(rejectedEditor.dpFormData.options.where, /section_code = 'HM'/)
assert.doesNotMatch(rejectedEditor.dpFormData.options.where, /section_code = '70'/)
api.user.unit = { code: '70', name: 'Biomolecular and Genetics' }
cancelledField.__applyCancelledRoomFilter()
assert.equal(rejectedRefreshes, 3)

opened.options.afterSaveCallback({
  _id: { $oid: '6a830000ebe955d6977ec010' },
  source_order_id: '6a8210b7ebe955d6977ec9d3',
  reject_reason_code: 'specimen_insufficient',
  reject_reason_detail: 'sample test'
})
assert(processCall)
assert.equal(processCall.id, '6a79ff46d5218a5b6a26bebc')
assert.equal(processCall.params.source_order_id, '6a8210b7ebe955d6977ec9d3')
assert.equal(processCall.params.rejection_record_id, '6a830000ebe955d6977ec010')
assert.equal(processCall.params.order_number, '7069000009')
assert.equal(processCall.params.section_code, '70')
assert.equal(processCall.params.reject_reason_code, 'specimen_insufficient')
assert.equal(closed, true)

assert.doesNotMatch(waiting.onCreated, /field\.prompt\('ระบุเหตุผลที่ปฏิเสธ/)
assert.doesNotMatch(received.onCreated, /field\.prompt\('ระบุเหตุผลที่ปฏิเสธ/)
assert.match(received.onCreated, /form\.openForm\(REJECTION_FORM_ID/)
assert.match(received.onCreated, /api\.runProcess\(REJECT_PROCESS_ID/)

assert.equal(cancelled.formId, '6a7daa3e8d398c11cf2fe869')
assert.match(cancelled.where, /work_status = 'rejected'/)
assert.match(cancelled.where, /section_code = '__ROOM_NOT_READY__'/)
assert.equal(cancelled.enableWs, false)
assert.equal(cancelled.buttonsRow.length, 1)
assert.equal(cancelled.buttonsRow[0].label, 'ตรวจซ้ำ')
assert.doesNotMatch(
  collectCreated(doc).join('\n'),
  /\['lab_cancelled_listview_final',\"lab_section = '.+order_status = 'rejected'/
)

const cancelledValues = Object.fromEntries(cancelled.customValue.map(item => [item.fieldName, new Function('row', `return ${item.expressions}`)(row)]))
assert.equal(cancelledValues.labNoLabel, '7069000009')
assert.match(cancelledValues.patientAvatarHtml, /patient\.png/)
assert.match(cancelledValues.patientAgeLabel, /อายุ/)
assert.match(cancelledValues.contextBadgesHtml, /A102 โรคทั่วไป/)
assert.match(cancelledValues.contextBadgesHtml, /UCS/)
assert.match(cancelledValues.contextBadgesHtml, /CASH/)
assert.match(cancelledValues.contextBadgesHtml, /ชำระเงินแล้ว/)
assert.equal(cancelledValues.sectionLabel, 'Biomolecular and Genetics')
assert.equal(cancelledValues.specimenLabel, 'Blood · Clotted blood')
assert.equal(cancelledValues.orderCountLabel, '2 รายการ')
assert.match(cancelledValues.statusBadgeHtml, /ยกเลิกรายการ/)
assert.match(cancelled.detailContent, /patientAgeLabel/)
assert.match(cancelled.detailContent, /sectionLabel/)

let recheckCall = null
let cancelledRefreshes = 0
let waitingReloads = 0
let allReloads = 0
const recheckApi = {
  runProcess: (id, params, success) => {
    recheckCall = { id, params }
    success({ success: true, message: 'ย้ายรายการกลับหน้ารอรับแล้ว' })
  }
}
const recheckRefs = {
  lab_waiting_center_specimen: { vueState: { load: () => { waitingReloads++ } } },
  lab_all_orders_center_specimen: { vueState: { load: () => { allReloads++ } } }
}
const recheckForm = {
  userState: recheckApi,
  getFieldRef: name => recheckRefs[name] || null
}
const buttonContext = {
  getFormRef: () => recheckForm,
  getFieldEditor: () => ({ handleRefresh: () => { cancelledRefreshes++ } }),
  notify: () => {}
}
const runRecheck = new Function('btnRow', 'btnIndex', 'dataRow', 'dataIndex', cancelled.buttonsRow[0].onClick)
runRecheck.call(buttonContext, null, 0, row, 0)
assert(recheckCall)
assert.equal(recheckCall.id, '6a79ff46d5218a5b6a26bebc')
assert.equal(recheckCall.params.source_order_id, '6a8210b7ebe955d6977ec9d3')
assert.equal(recheckCall.params.action, 'recheck')
assert.equal(recheckCall.params.order_number, '7069000009')
assert.equal(recheckCall.params.section_code, '70')
assert.equal(cancelledRefreshes, 1)
assert.equal(waitingReloads, 1)
assert.equal(allReloads, 1)

process.stdout.write('PASS: Reject flow and cancelled-tab Recheck return the same Status row to waiting_receive\n')
