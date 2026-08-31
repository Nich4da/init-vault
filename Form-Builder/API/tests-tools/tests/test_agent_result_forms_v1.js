const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const FORM_DIR = path.join(__dirname, '../../../SDForm/form-factory/forms')
const SCHEMA_DIR = path.join(__dirname, '../../../SDForm/api-factory/schemas')

const FILES = {
  report: 'Result_Report_Manual_Entry_Agent_Result_v1.json',
  item: 'Lab_Result_Item_Agent_Result_v1.json',
  receipt: 'Lab_Result_Inbound_Receive_Agent_Result_v1.json',
}
const FORM_IDS = {
  report: '6a8d4334f851000f28e5025b',
  item: '6a8bc91df851000f28e501fb',
  receipt: '6a8b1c03f851000f28e501ef',
}

const forms = Object.fromEntries(
  Object.entries(FILES).map(([name, file]) => [
    name,
    JSON.parse(fs.readFileSync(path.join(FORM_DIR, file), 'utf8')),
  ]),
)
const schema = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, 'agent-to-his-result-v2.schema.json'), 'utf8'))
const listTemplateForm = JSON.parse(fs.readFileSync(path.join(FORM_DIR, 'Lab_Result_Inbound_Receive_User_View_EMR_Person_v2.json'), 'utf8'))
const personTemplateForm = JSON.parse(fs.readFileSync(path.join(FORM_DIR, 'person.json'), 'utf8'))
const diseaseTemplateForm = JSON.parse(fs.readFileSync(path.join(FORM_DIR, 'disease.json'), 'utf8'))

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

function byName(form, name) {
  return walk(form.fields).find(node => node.options?.name === name)
}

function findTemplate(form, component, predicate = () => true) {
  const node = walk(form.fields).find(item => item.component === component && predicate(item))
  assert(node, `Missing template ${component}`)
  return node
}

const templates = {
  grid: listTemplateForm.fields[0],
  'grid-col': listTemplateForm.fields[0].cols[0],
  'text-input': findTemplate(listTemplateForm, 'text-input', node => node.options?.name === 'hn'),
  'textarea-input': findTemplate(diseaseTemplateForm, 'textarea-input'),
  'select-input': findTemplate(personTemplateForm, 'select-input', node => node.options?.name === 'p_abogroup'),
  'switch-input': findTemplate(personTemplateForm, 'switch-input', node => node.options?.name === 'p_twin'),
  'number-input': findTemplate(personTemplateForm, 'number-input', node => node.options?.name === 'birth_order'),
  'list-ui': findTemplate(listTemplateForm, 'list-ui'),
}

function assertCommonStructure(form, fileName) {
  assert.deepStrictEqual(Object.keys(form).sort(), ['fields', 'formConfig'])
  assert.strictEqual(form.formConfig.jsonVersion, 3)
  assert.strictEqual(form.fields.length, 1)
  assert.strictEqual(form.fields[0].component, 'grid')
  assert(Array.isArray(form.fields[0].cols) && form.fields[0].cols.length > 0)
  assert(form.fields[0].cols.every(col => col.component === 'grid-col'))
  assert(form.fields[0].cols.every(col => Array.isArray(col.fields) && col.fields.length > 0))
  assert(!JSON.stringify(form).includes('widgetList'), `${fileName} must use .fields, not .widgetList`)
  const nodes = walk(form.fields)
  const ids = nodes.map(node => node.id)
  const names = nodes.map(node => node.options?.name).filter(Boolean)
  assert(ids.every(Boolean), `${fileName}: every node needs an id`)
  assert.strictEqual(new Set(ids).size, ids.length, `${fileName}: duplicate id`)
  assert.strictEqual(new Set(names).size, names.length, `${fileName}: duplicate options.name`)
  for (const node of nodes) {
    const template = templates[node.component]
    assert(template, `${fileName}: no approved template for ${node.component}`)
    assert.deepStrictEqual(
      Object.keys(node).sort(),
      Object.keys(template).sort(),
      `${fileName}: ${node.component}/${node.options?.name} node-axis differs from template`,
    )
    assert.deepStrictEqual(
      Object.keys(node.options || {}).sort(),
      Object.keys(template.options || {}).sort(),
      `${fileName}: ${node.component}/${node.options?.name} options-axis differs from template`,
    )
    if (node.component !== 'list-ui') {
      assert.strictEqual(node.key, template.key, `${fileName}: ${node.component} key differs from template`)
    }
  }
}

for (const [name, form] of Object.entries(forms)) assertCommonStructure(form, FILES[name])

const receiptNames = new Set(
  walk(forms.receipt.fields)
    .filter(node => node.formItemFlag === true)
    .map(node => node.options.name),
)
const schemaToReceipt = {
  order_no: 'order_no',
  filler_order_no: 'filler_order_no',
  hn: 'hn',
  visit_id: 'visit_id',
  result_uid: 'result_uid',
  report_seq: 'report_seq',
  stage: 'stage',
  overall_status: 'agent_overall_status',
  reported_at: 'reported_at',
  reported_by: 'reported_by_source_id',
  items: 'items_json',
}
for (const property of schema.required) {
  assert(receiptNames.has(schemaToReceipt[property]), `Receipt missing Agent field ${property}`)
}
assert(receiptNames.has('filler_order_no'), 'Receipt missing normalized LAB NO. field')
assert(receiptNames.has('raw_payload_json'))
assert.strictEqual(byName(forms.receipt, 'record_kind').options.defaultValue, 'receipt')
assert.strictEqual(byName(forms.report, 'record_kind').options.defaultValue, 'report')
assert(byName(forms.receipt, 'report_key'))
assert(byName(forms.report, 'report_key'))
assert(byName(forms.receipt, 'result_report_id'))
assert(byName(forms.report, 'order_status_id'))
assert(byName(forms.report, 'lab_section'))
assert(byName(forms.item, 'lab_section'))
assert.strictEqual(byName(forms.receipt, 'raw_payload_json').options.hidden, true)
assert.strictEqual(byName(forms.receipt, 'items_json').options.hidden, true)
assert.strictEqual(byName(forms.receipt, 'report_seq').fieldType, 'String')
for (const countName of ['item_count', 'critical_count', 'matched_item_count', 'unmatched_item_count']) {
  assert.strictEqual(byName(forms.receipt, countName).component, 'number-input')
  assert.strictEqual(byName(forms.receipt, countName).fieldType, 'Number')
}

const list = byName(forms.report, 'lab_result_items_list')
const verifiedList = walk(listTemplateForm.fields).find(node => node.component === 'list-ui')
assert(list)
assert.strictEqual(list.options.formId, FORM_IDS.item)
assert.strictEqual(list.options.providerType, 'FORM')
assert.strictEqual(list.options.hidden, false)
assert.strictEqual(list.options.showWhenParent, false)
assert.strictEqual(list.options.actionEnable, true)
assert.strictEqual(list.options.addBtnEnable, false)
assert.strictEqual(list.options.delBtnEnable, false)
assert.strictEqual(list.options.buttonsRow.length, 1)
assert.strictEqual(list.options.buttonsRow[0].label, 'กรอก / แก้ไขผล')
assert(!Object.prototype.hasOwnProperty.call(list, 'key'), 'list-ui must match keyless working export')
assert.deepStrictEqual(Object.keys(list).sort(), Object.keys(verifiedList).sort())
assert.deepStrictEqual(Object.keys(list.options).sort(), Object.keys(verifiedList.options).sort())

for (const expression of list.options.customValue) {
  new vm.Script(`(function(row){ return (${expression.expressions}); })`)
}
new vm.Script(`(function(dataRow){${list.options.buttonsRow[0].onClick}\n})`)
new vm.Script(`(function(data,setTimeout){${list.options.onMounted}\n})`)

const render = row => Object.fromEntries(
  list.options.customValue.map(item => [
    item.fieldName,
    new Function('row', `return (${item.expressions})`)(row),
  ]),
)
const numeric = render({
  panel_name: 'Chemistry',
  test_name: 'Glucose',
  obs_code: 'C23',
  result_value: '450',
  unit_symbol_snapshot: 'mg/dL',
  interpretation_code: 'HH',
  reference_range_snapshot: '70-100',
  critical_high_rule: '>400',
  is_critical: true,
})
assert.strictEqual(numeric.resultValueLabel, '450')
assert.strictEqual(numeric.unitLabel, 'mg/dL')
assert.strictEqual(numeric.interpretationLabel, 'HH')
assert.strictEqual(numeric.referenceLabel, '70-100')
assert(numeric.criticalLabel.includes('>400'))

const micro = render({
  panel_name: 'Mycology',
  test_name: 'Fungal culture',
  obs_code: 'MY-CULT',
  result_value: 'พบเชื้อ Candida albicans\nรอผล susceptibility',
  unit_symbol_snapshot: '',
  reference_range_snapshot: '',
  is_critical: false,
})
assert(micro.resultValueLabel.includes('\n'), 'multiline result must retain line breaks')
assert.strictEqual(micro.unitLabel, '-')
assert.strictEqual(micro.criticalLabel, '-')

let whereApplied = ''
let refreshCount = 0
const editor = { dpFormData: { options: {} }, handleRefresh: () => { refreshCount += 1 } }
const mounted = new Function('data', 'setTimeout', list.options.onMounted)
mounted.call({
  getFormRef: () => undefined,
  setFieldOption: (key, value) => { if (key === 'where') whereApplied = value },
  getFieldEditor: () => editor,
}, { _id: '6a8d4334f851000f28e5025b' }, callback => callback())
assert.strictEqual(whereApplied, "xparentx = CONVERT('6a8d4334f851000f28e5025b', 'objectId')")
assert.strictEqual(refreshCount, 1)
assert.doesNotThrow(() => mounted.call({
  getFormRef: () => undefined,
  setFieldOption: () => {},
}, {}, () => {}))

const visibleItemNames = walk(forms.item.fields)
  .filter(node => node.formItemFlag === true && node.options.hidden === false)
  .map(node => node.options.name)
assert.deepStrictEqual(visibleItemNames, [
  'test_name',
  'result_value',
  'unit_symbol_snapshot',
  'interpretation_code',
  'reference_range_snapshot',
  'is_critical',
])
for (const node of walk(forms.item.fields).filter(node => node.formItemFlag === true)) {
  const editable = node.options.name === 'result_value'
  if (node.component === 'switch-input' || node.component === 'select-input') {
    assert.strictEqual(node.options.disabled, true, `${node.options.name} must be disabled`)
  } else {
    assert.strictEqual(node.options.readonly, !editable, `${node.options.name} readonly mismatch`)
  }
}
assert.strictEqual(byName(forms.item, 'result_value').component, 'textarea-input')
assert.strictEqual(byName(forms.item, 'result_value').fieldType, 'String')
assert.strictEqual(byName(forms.item, 'result_version').fieldType, 'String')
assert.strictEqual(byName(forms.item, 'receipt_seq').fieldType, 'String')
assert.strictEqual(byName(forms.item, 'is_critical').fieldType, 'Boolean')
assert.strictEqual(byName(forms.item, 'result_value').options.required, false)
assert.strictEqual(byName(forms.item, 'unit_symbol_snapshot').options.required, false)

for (const required of ['obs_code', 'obs_name', 'value', 'obx_status', 'change_kind', 'receipt_seq', 'result_version']) {
  const itemField = required === 'value' ? 'result_value' : required
  assert(byName(forms.item, itemField), `Result Item missing Agent item field ${required}`)
}
for (const optional of ['units', 'ref_range', 'critical_low_rule', 'critical_high_rule', 'panel_code', 'panel_name', 'group_role', 'organism']) {
  assert(byName(forms.item, optional), `Result Item missing optional Agent item field ${optional}`)
}

let openArgs = null
const openItem = new Function('dataRow', list.options.buttonsRow[0].onClick)
openItem.call({
  getFormRef: () => ({
    openForm: (...args) => { openArgs = args },
    subFormClose: () => {},
  }),
  getFieldEditor: () => ({ handleRefresh: () => {} }),
  notify: message => { throw new Error(message) },
}, { _id: '6a8bc91df851000f28e501fb', result_source: 'agent' })
assert(openArgs)
assert.strictEqual(openArgs[0], FORM_IDS.item)
assert.strictEqual(openArgs[4].readonly, false, 'Result popup must allow Result correction')

console.log('PASS three JSON files parse with grid -> cols[].fields[] hierarchy')
console.log('PASS every node/options axis and component key matches its real exported template')
console.log('PASS Agent receipt covers required callback fields and raw append-only payload')
console.log('PASS Result Report ListView matches the 62-option keyless working template')
console.log('PASS ListView filters child items by current receipt/report _id without getFieldValue crash')
console.log('PASS only result_value is editable; test/unit/interpretation/ref/critical are readonly')
console.log('PASS numeric, multiline Micro result, blank unit and received Critical rendering')
console.log('PASS edit button opens Lab_result_item form ID ' + FORM_IDS.item)
