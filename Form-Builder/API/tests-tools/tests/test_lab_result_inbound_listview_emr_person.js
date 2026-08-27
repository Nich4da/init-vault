const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = __dirname
const readJson = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'))

const listForm = readJson('Lab_Result_Inbound_ListView_EMR_Person.json')
const viewerForm = readJson('Lab_Result_Inbound_Receive_User_View_EMR_Person_v2.json')
const emr = readJson('EMR.json')
const person = readJson('person.json')
const inboundSource = readJson('Lab_Result_Inbound_Receive.json')
const resultItemSource = readJson('Lab_Result_Item_Filtered_LIS_Validated.json')

function collect(root) {
  const nodes = []
  function walk(value) {
    if (!value || typeof value !== 'object') return
    if (!Array.isArray(value) && value.component) nodes.push(value)
    if (Array.isArray(value)) value.forEach(walk)
    else Object.values(value).forEach(walk)
  }
  walk(root)
  return nodes
}

function findNode(root, predicate) {
  return collect(root).find(predicate)
}

function fieldNames(root) {
  return new Set(collect(root)
    .filter(node => node.formItemFlag === true && node.options?.name)
    .map(node => node.options.name))
}

const emrList = findNode(emr, node => node.component === 'list-ui' && node.options?.name === 'visit_unit')
const personGrid = person.fields[0]
const personCol = person.fields[0].cols[0]
const listNodes = collect(listForm.fields)
const viewerNodes = collect(viewerForm.fields)
const allNodes = [...listNodes, ...viewerNodes]
const lists = allNodes.filter(node => node.component === 'list-ui')
const listByName = name => lists.find(node => node.options?.name === name)
const receiptList = listByName('lab_inbound_result_list')
const resultList = listByName('inbound_result_items_list')

assert.strictEqual(listForm.formConfig.jsonVersion, 3)
assert.strictEqual(viewerForm.formConfig.jsonVersion, 3)
for (const form of [listForm, viewerForm]) {
  assert.strictEqual(form.fields.length, 1)
  assert.strictEqual(form.fields[0].component, 'grid')
  assert.deepStrictEqual(Object.keys(form.fields[0]).sort(), Object.keys(personGrid).sort())
  for (const col of form.fields[0].cols) {
    assert.strictEqual(col.component, 'grid-col')
    assert.deepStrictEqual(Object.keys(col).sort(), Object.keys(personCol).sort())
    assert.strictEqual(col.options.responsive, false)
    assert(Array.isArray(col.fields) && col.fields.length > 0)
  }
}

assert.strictEqual(lists.length, 2)
for (const list of lists) {
  assert.deepStrictEqual(Object.keys(list).sort(), Object.keys(emrList).sort())
  assert.deepStrictEqual(Object.keys(list.options).sort(), Object.keys(emrList.options).sort())
  assert.strictEqual(Object.prototype.hasOwnProperty.call(list, 'key'), false)
  assert.strictEqual(typeof list.options.customClass, 'string')
  assert.strictEqual(list.options.providerType, 'FORM')
  assert.strictEqual(list.options.listType, 'listview')
  assert.strictEqual(list.options.groupField, null)
  assert.strictEqual(list.options.enableWs, false)
  assert.strictEqual(list.options.wsRefresh, false)
}

assert.strictEqual(receiptList.options.formId, '6a8b1c03f851000f28e501ef')
assert.deepStrictEqual(receiptList.options.searchField, ['hn', 'filler_order_no', 'order_no'])
assert.strictEqual(receiptList.options.buttonsRow.length, 1)
assert.strictEqual(receiptList.options.buttonsRow[0].label, 'ดูผล')
assert.strictEqual(resultList.options.formId, '6a7aa641935ed08882467374')
assert.deepStrictEqual(resultList.options.orderBy.map(item => item.column), ['result_sequence', 'test_code'])

const inboundNames = fieldNames(inboundSource)
const itemNames = fieldNames(resultItemSource)
const systemNames = new Set(['_id', 'xparentx', 'xrstatx', 'created_at', 'updated_at'])
for (const name of receiptList.options.searchField) assert(inboundNames.has(name), `Missing inbound search field ${name}`)
for (const order of receiptList.options.orderBy) assert(inboundNames.has(order.column) || systemNames.has(order.column), `Missing inbound order field ${order.column}`)
for (const name of resultList.options.searchField) assert(itemNames.has(name), `Missing result search field ${name}`)
for (const order of resultList.options.orderBy) assert(itemNames.has(order.column) || systemNames.has(order.column), `Missing result order field ${order.column}`)

const rawPlaceholders = content => Array.from(String(content).matchAll(/\{\{\s*([A-Za-z_$][\w$]*)\s*\}\}/g), match => match[1])
for (const name of rawPlaceholders(receiptList.options.detailContent)) assert(inboundNames.has(name), `Receipt template field missing: ${name}`)
for (const name of rawPlaceholders(resultList.options.detailContent)) assert(itemNames.has(name), `Result template field missing: ${name}`)

const viewerFieldNodes = viewerNodes.filter(node => node.formItemFlag === true)
const viewerFieldNames = viewerFieldNodes.map(node => node.options.name)
const inboundFieldByName = new Map(collect(inboundSource)
  .filter(node => node.formItemFlag === true && node.options?.name)
  .map(node => [node.options.name, node]))
assert.strictEqual(viewerFieldNames.length, inboundNames.size)
assert.deepStrictEqual(new Set(viewerFieldNames), inboundNames)
assert.strictEqual(new Set(viewerFieldNames).size, viewerFieldNames.length)
for (const field of viewerFieldNodes) {
  const source = inboundFieldByName.get(field.options.name)
  assert(source, `Inbound source field missing: ${field.options.name}`)
  assert.strictEqual(field.component, source.component, `Component changed: ${field.options.name}`)
  assert.strictEqual(field.category, source.category, `Category changed: ${field.options.name}`)
  assert.strictEqual(field.fieldType, source.fieldType, `fieldType changed: ${field.options.name}`)
  assert.deepStrictEqual(Object.keys(field).sort(), Object.keys(source).sort(), `Node schema changed: ${field.options.name}`)
  assert.deepStrictEqual(Object.keys(field.options).sort(), Object.keys(source.options).sort(), `Option schema changed: ${field.options.name}`)
}
for (const name of ['result_uid', 'report_seq', 'schema_version', 'items_json', 'raw_payload_json', 'payload_hash', 'result_report_id']) {
  const field = viewerFieldNodes.find(node => node.options.name === name)
  assert(field && field.options.hidden === true, `Technical field must stay hidden: ${name}`)
}
for (const name of ['hn', 'filler_order_no', 'reported_at', 'verified_at', 'reported_by_source_name', 'verified_by_source_name']) {
  const field = viewerFieldNodes.find(node => node.options.name === name)
  assert(field && field.options.hidden === false, `User field must be visible: ${name}`)
}
for (const name of ['raw_payload_json', 'items_json', 'result_uid', 'schema_version', 'report_seq', 'stage', 'receipt_status', 'source_channel', 'received_at', 'order_no', 'visit_id', 'reported_by_source_id', 'verified_by_source_id', 'item_count', 'critical_count', 'matched_item_count', 'unmatched_item_count', 'internal_overall_status', 'error_message', 'result_report_id', 'processed_at', 'payload_hash', 'agent_overall_status']) {
  const field = viewerFieldNodes.find(node => node.options.name === name)
  assert(field && field.options.hidden === true, `Technical field must be hidden: ${name}`)
}

for (const list of lists) {
  for (const key of ['onCreated', 'onMounted', 'onUnmount', 'clickEvent', 'onInsertBefore', 'onUpdateBefore', 'onViewBefore', 'onBeforeSave', 'onAfterDelete', 'onselect', 'onunselect', 'allowDeleteFunc']) {
    const code = list.options[key]
    if (!code) continue
    new vm.Script(`(function(){${code}\n})`)
  }
  for (const button of list.options.buttonsRow || []) new vm.Script(`(function(){${button.onClick || ''}\n})`)
}

let opened = null
const openHandler = new Function('dataRow', receiptList.options.buttonsRow[0].onClick)
openHandler.call({
  getFormRef: () => ({ openForm: (...args) => { opened = args } }),
  notify: () => { throw new Error('Valid row must not notify') },
}, { _id: '6a8b1c03f851000f28e501ef' })
assert(opened)
assert.strictEqual(opened[0], '6a8b1c03f851000f28e501ef')
assert.strictEqual(opened[1], '6a8b1c03f851000f28e501ef')
assert.strictEqual(opened[4].readonly, true)
assert.strictEqual(opened[4].popupType, 'dialog')

let appliedWhere = ''
let refreshCount = 0
const editor = { dpFormData: { options: {} }, handleRefresh: () => { refreshCount += 1 } }
const mountedHandler = new Function(resultList.options.onMounted)
mountedHandler.call({
  getFormRef: () => ({ getFieldValue: name => name === 'result_report_id' ? '6a8478abf851000f28e44a16' : null }),
  setFieldOption: (name, value) => { if (name === 'where') appliedWhere = value },
  getFieldEditor: () => editor,
})
assert.strictEqual(appliedWhere, "xparentx = CONVERT('6a8478abf851000f28e44a16', 'objectId')")
assert.strictEqual(editor.defaultWhere, appliedWhere)
assert.strictEqual(editor.dpFormData.options.where, appliedWhere)
assert.strictEqual(refreshCount, 1)

// CRUD can mount display widgets before getFormRef() is available.  The event
// must never throw in that state; it should keep the zero-id filter and retry.
const crudMountedWithoutForm = new Function('data', 'setTimeout', resultList.options.onMounted)
assert.doesNotThrow(() => crudMountedWithoutForm.call({
  getFormRef: () => undefined,
  setFieldOption: () => { throw new Error('No valid report id must not change the filter') },
}, {}, () => {}))

// In CRUD edit mode, the reactive form model can already contain the link even
// when getFormRef() is not ready.  Verify that path independently.
let crudWhere = ''
let crudRefresh = 0
const crudEditor = { dpFormData: { options: {} }, handleRefresh: () => { crudRefresh += 1 } }
crudMountedWithoutForm.call({
  getFormRef: () => undefined,
  setFieldOption: (name, value) => { if (name === 'where') crudWhere = value },
  getFieldEditor: () => crudEditor,
}, { result_report_id: '6a8478abf851000f28e44a16' }, () => {})
assert.strictEqual(crudWhere, "xparentx = CONVERT('6a8478abf851000f28e44a16', 'objectId')")
assert.strictEqual(crudRefresh, 1)

const ids = allNodes.map(node => node.id)
assert(ids.every(Boolean))
assert.strictEqual(new Set(ids).size, ids.length)
assert(allNodes.every(node => ['grid', 'grid-col', 'list-ui', 'text-input', 'select-input', 'number-input', 'textarea-input'].includes(node.component)))

console.log('PASS JSON parse and person Layout/Grid Col hierarchy')
console.log('PASS ListViews retain the complete runtime-verified EMR option schema')
console.log('PASS one-box HN/LAB NO./Order search fields exist in Inbound Receive')
console.log('PASS ดูผล opens the selected Inbound Receipt read-only')
console.log('PASS Inbound user view preserves every receipt field and hides technical fields')
console.log('PASS Result Item ListView binds only to current provider fields')
console.log('PASS result_report_id filters Result Items through xparentx and refreshes once')
console.log('PASS CRUD mount without getFormRef and CRUD edit via data.result_report_id')
console.log('PASS event syntax, unique ids, and allowed widget types')
