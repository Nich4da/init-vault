const assert = require('assert')
const fs = require('fs')
const vm = require('vm')

const FORM_FILE = process.argv[2] || 'Result_Report_Manual_UI_FIXED.json'
const ITEM_FILE = 'Lab_Result_Item_Minimal_Widget_Critical.json'
const form = JSON.parse(fs.readFileSync(FORM_FILE, 'utf8'))
const itemForm = JSON.parse(fs.readFileSync(ITEM_FILE, 'utf8'))
const listTemplate = JSON.parse(
  fs.readFileSync('Lab_Result_Inbound_Receive_User_View_EMR_Person_v2.json', 'utf8')
)

function walk(value, output = []) {
  if (!value || typeof value !== 'object') return output
  if (!Array.isArray(value) && value.component) output.push(value)
  if (Array.isArray(value)) value.forEach(item => walk(item, output))
  else Object.values(value).forEach(item => walk(item, output))
  return output
}

function fieldNames(source) {
  const names = new Set([
    '_id',
    'xparentx',
    'xrstatx',
    'created_at',
    'updated_at',
  ])
  for (const node of walk(source)) {
    if (node.formItemFlag === true && node.options?.name) names.add(node.options.name)
  }
  return names
}

const nodes = walk(form)
const names = nodes.map(node => node.options?.name).filter(Boolean)
const ids = nodes.map(node => node.id).filter(Boolean)
const byName = name => nodes.find(node => node.options?.name === name)
const list = byName('lab_result_items_list')
const upload = byName('result_attachments')
const verifiedList = walk(listTemplate).find(node => node.component === 'list-ui')

assert.deepStrictEqual(Object.keys(form).sort(), ['fields', 'formConfig'])
assert.strictEqual(form.formConfig.jsonVersion, 3)
assert.strictEqual(new Set(names).size, names.length, 'Widget variable names must be unique')
assert.strictEqual(new Set(ids).size, ids.length, 'Widget IDs must be unique')
assert(nodes.every(node => node.options?.hidden === false), 'No widget may be hidden')

for (const name of ['lab_no', 'patient_hn', 'visit_id']) {
  const field = byName(name)
  assert(field, `Missing visible correlation field ${name}`)
  assert.strictEqual(field.options.hidden, false, `${name} must be visible`)
  assert.strictEqual(field.options.readonly, true, `${name} must be readonly`)
}

assert(upload, 'Missing result attachment upload')
assert.strictEqual(upload.component, 'file-upload-input')
assert.strictEqual(upload.options.hidden, false)
assert.strictEqual(upload.options.multipleSelect, true)
assert.strictEqual(upload.options.showFileList, true)
assert(upload.options.limit >= 1)
assert(upload.options.fileMaxSize > 0)

assert(list, 'Missing result item ListView')
assert.strictEqual(list.options.formId, '6a7aa641935ed08882467374')
assert.strictEqual(list.options.providerType, 'FORM')
assert.strictEqual(list.options.listType, 'listview')
assert.strictEqual(list.options.hidden, false)
assert.strictEqual(list.options.defaultFilterParent, false)
assert.strictEqual(list.options.parentPath, '_id')
assert.strictEqual(list.options.showWhenParent, false)
assert(list.options.where.includes("order_status_id = '__NO_CONTEXT__'"), 'List must fail closed before context is applied')
assert(!Object.prototype.hasOwnProperty.call(list, 'key'), 'ListView must match the proven runtime node shape')

assert(verifiedList, 'Required ListView template was not found')
assert.deepStrictEqual(
  Object.keys(list).sort(),
  Object.keys(verifiedList).sort(),
  'ListView node keys differ from required template'
)
assert.deepStrictEqual(
  Object.keys(list.options).sort(),
  Object.keys(verifiedList.options).sort(),
  'ListView option keys differ from required template'
)

const itemNames = fieldNames(itemForm)
for (const field of list.options.searchField) {
  assert(itemNames.has(field), `List search references missing Result Item field ${field}`)
}
for (const order of list.options.orderBy) {
  assert(itemNames.has(order.column), `List ordering references missing Result Item field ${order.column}`)
}

const customNames = new Set(list.options.customValue.map(item => item.fieldName))
const placeholders = Array.from(
  list.options.detailContent.matchAll(/\{\{\s*([A-Za-z_$][\w$]*)\s*\}\}/g),
  match => match[1]
)
for (const placeholder of placeholders) {
  assert(customNames.has(placeholder), `Missing customValue for ${placeholder}`)
}

for (const item of list.options.customValue) {
  new vm.Script(`(function(row){ return (${item.expressions}); })`)
}
for (const button of list.options.buttonsRow) {
  new vm.Script(`(function(dataRow){ ${button.onClick}\n})`)
}
for (const key of [
  'onFormCreated',
  'onParentChange',
  'onFormDataChange',
  'onFormUnmounted',
]) {
  assert.strictEqual(form.formConfig[key], '', `${key} must not dereference fields during mount`)
}
assert(!JSON.stringify(form).includes('getFieldValue'), 'Form must not contain the previous unsafe getFieldValue call')
new vm.Script(`(function(){ ${form.formConfig.onFormMounted}\n})`)

let appliedWhere = ''
let refreshed = 0
const editor = {
  dpFormData: { options: {} },
  handleRefresh: () => { refreshed += 1 },
}
const listRef = {
  setFieldOption: (name, value) => {
    if (name === 'where') appliedWhere = value
  },
  getFieldEditor: () => editor,
}
const mounted = new Function('formParams', form.formConfig.onFormMounted)
const realSetTimeout = global.setTimeout
global.setTimeout = callback => callback()
mounted.call(
  { getFieldRef: name => name === 'lab_result_items_list' ? listRef : null },
  { order_status_id: '6a852797f851000f28e44a3e' }
)
global.setTimeout = realSetTimeout
assert.strictEqual(
  appliedWhere,
  "order_status_id = '6a852797f851000f28e44a3e' AND xrstatx NOT IN(0,3)"
)
assert.strictEqual(editor.defaultWhere, appliedWhere)
assert.strictEqual(editor.dpFormData.options.where, appliedWhere)
assert.strictEqual(refreshed, 1, 'Mounted ListView must refresh once after receiving context')

const criticalExpressions = list.options.customValue
  .filter(item => item.fieldName.startsWith('critical'))
  .map(item => item.expressions)
  .join('\n')
assert(criticalExpressions.includes('is_critical'), 'Critical display must use the received is_critical flag')
assert(!/threshold|critical_low_rule|critical_high_rule/i.test(criticalExpressions), 'HIS must not recalculate critical thresholds')

const evaluate = row => Object.fromEntries(
  list.options.customValue.map(item => [
    item.fieldName,
    new Function('row', `return (${item.expressions})`)(row),
  ])
)
const lisResult = evaluate({
  test_name: 'Glucose',
  test_code: 'GLU',
  result_value: 450,
  unit_symbol_snapshot: 'mg/dL',
  reference_range_snapshot: '70-100',
  is_critical: true,
  result_source: 'lis',
})
assert.strictEqual(lisResult.resultValue, '450')
assert.strictEqual(lisResult.unitLabel, 'mg/dL')
assert.strictEqual(lisResult.referenceLabel, '70-100')
assert.strictEqual(lisResult.criticalLabel, 'CRITICAL')

const manualLongText = evaluate({
  test_name: 'Fungal culture',
  obs_code: 'FUN-CULT',
  result_value: 'พบเชื้อ Candida albicans\nรอผล susceptibility',
  reference_range_snapshot: 'No growth',
  is_critical: false,
  result_source: 'manual',
})
assert(manualLongText.resultValue.includes('\n'), 'Long text result must retain line breaks')
assert.strictEqual(manualLongText.criticalLabel, 'ปกติ')

const openHandler = new Function('dataRow', list.options.buttonsRow[0].onClick)
function openFor(source) {
  let call = null
  const host = {
    openForm: (...args) => { call = args },
    subFormClose: () => {},
  }
  const field = {
    getFormRef: () => host,
    getFieldEditor: () => ({ handleRefresh: () => {} }),
    notify: message => { throw new Error(message) },
  }
  openHandler.call(field, {
    _id: '64b7aa641935ed0888246737',
    result_source: source,
  })
  assert(call, 'Result Item form was not opened')
  assert.strictEqual(call[0], '6a7aa641935ed08882467374')
  return call[4].readonly
}
assert.strictEqual(openFor('lis'), true, 'LIS result must open readonly')
assert.strictEqual(openFor('agent'), true, 'Agent result must open readonly')
assert.strictEqual(openFor('manual'), false, 'Manual result must open editable')
assert.strictEqual(openFor(''), false, 'Pending item without source must remain editable')

console.log('PASS: SDForm JSON syntax and unique widget identifiers')
console.log('PASS: all widgets visible; HN/VN/LAB NO. visible and readonly')
console.log('PASS: File Upload configuration')
console.log('PASS: ListView schema matches Lab_Result_Inbound_Receive_User_View_EMR_Person_v2.json')
console.log('PASS: Result Item technical-key filter and provider fields')
console.log('PASS: numeric and multiline text result rendering')
console.log('PASS: critical alert uses received is_critical only')
console.log('PASS: LIS/Agent readonly and Manual editable behavior')
console.log('PASS: safe formParams mount filter; no getFieldValue crash')
