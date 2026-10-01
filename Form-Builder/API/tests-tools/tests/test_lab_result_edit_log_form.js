const assert = require('assert')
const fs = require('fs')
const path = require('path')

const formPath = path.join(__dirname, '../../../SDForm/Lab/lab-result-edit-log-v1.json')
const form = JSON.parse(fs.readFileSync(formPath, 'utf8'))
const worklistApiPath = path.join(__dirname, '../../api-factory/processes/lab_cpoe_worklist_api.js')
const worklistApi = fs.readFileSync(worklistApiPath, 'utf8')
const deployedFormId = '6ab78b7159662ac8f059105a'
const deployedCollection = 'zdata_' + deployedFormId

function walk(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach(item => walk(item, output))
    return output
  }
  if (!value || typeof value !== 'object') return output
  if (value.component) output.push(value)
  if (value.fields) walk(value.fields, output)
  if (value.cols) walk(value.cols, output)
  return output
}

assert.deepStrictEqual(Object.keys(form).sort(), ['fields', 'formConfig'])
assert.strictEqual(form.formConfig.jsonVersion, 3)
assert.deepStrictEqual(form.formConfig.customClass, ['lab-result-edit-log-v1'])
assert.strictEqual(form.fields.length, 1)
assert.strictEqual(form.fields[0].component, 'grid')

const nodes = walk(form.fields)
const fields = nodes.filter(node => node.formItemFlag === true)
const byName = Object.fromEntries(fields.map(node => [node.options && node.options.name, node]))
const required = [
  'event_id', 'request_id', 'correction_group_id', 'action', 'outcome', 'source',
  'source_result_item_id', 'source_result_report_id', 'source_work_item_id',
  'source_cpoe_order_id', 'source_cpoe_item_id', 'order_number', 'lab_no',
  'section_code', 'hn', 'visit_id', 'test_code', 'obs_code', 'test_name',
  'correction_reason', 'changed_fields_json', 'before_result_value',
  'after_result_value', 'before_unit', 'after_unit', 'before_interpretation',
  'after_interpretation', 'before_reference_range', 'after_reference_range',
  'corrected_by_user_id', 'corrected_by_username', 'corrected_by_name', 'corrected_at',
]

for (const name of required) {
  assert(byName[name], `LAB Result Edit Log missing ${name}`)
  assert.strictEqual(byName[name].options.readonly, true, `${name} must be read-only in the audit Form`)
}

assert.strictEqual(byName.event_id.options.hidden, true)
assert.strictEqual(byName.source_result_item_id.options.hidden, true)
assert.strictEqual(byName.changed_fields_json.options.hidden, true)
assert.strictEqual(byName.correction_reason.component, 'textarea-input')
assert.strictEqual(byName.correction_reason.options.required, false)
assert.strictEqual(byName.correction_reason.options.requiredHint, '')
assert.strictEqual(byName.before_result_value.component, 'textarea-input')
assert.strictEqual(byName.after_result_value.component, 'textarea-input')

for (const field of fields) {
  for (const [option, handler] of Object.entries(field.options || {})) {
    if (/^on[A-Z]/.test(option)) assert.strictEqual(handler, '', `${field.options.name}.${option} must not mutate audit data`)
  }
}
const serialized = JSON.stringify(form)
assert(!serialized.includes('widgetList'), 'Form must keep the verified SDForm fields schema')
assert(
  worklistApi.includes("const RESULT_EDIT_LOG_FORM_ID = '" + deployedFormId + "'"),
  'Worklist Process must identify the deployed LAB Result Edit Log Form',
)
assert(
  worklistApi.includes("const RESULT_EDIT_LOG_COLLECTION = 'zdata_' + RESULT_EDIT_LOG_FORM_ID"),
  'Worklist Process must derive the correction collection from the deployed Form ID',
)
assert(!worklistApi.includes("const RESULT_EDIT_LOG_COLLECTION = 'zdata_lab_result_edit_log'"))
assert.strictEqual(deployedCollection, 'zdata_6ab78b7159662ac8f059105a')

console.log('LAB Result Edit Log form assertions passed')
