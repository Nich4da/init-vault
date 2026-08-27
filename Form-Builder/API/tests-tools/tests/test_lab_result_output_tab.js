const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = __dirname
const FILE = path.join(ROOT, 'Lab_Result_Output_Tab_ListView_EMR_Person.json')
const AGENT_SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/agent-to-his-result.schema.json'), 'utf8'))
const EMR = JSON.parse(fs.readFileSync(path.join(ROOT, 'EMR.json'), 'utf8'))
const REPORT_FORM = JSON.parse(fs.readFileSync(path.join(ROOT, 'Lab_Result_Report_Manual_Entry.json'), 'utf8'))
const ITEM_FORM = JSON.parse(fs.readFileSync(path.join(ROOT, 'Lab_Result_Item_Filtered_LIS_Validated.json'), 'utf8'))
const PERSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'person.json'), 'utf8'))
const form = JSON.parse(fs.readFileSync(FILE, 'utf8'))
const errors = []
const assert = (value, message) => { if (!value) errors.push(message) }

const nodes = []
function walk(value) {
  if (!value || typeof value !== 'object') return
  if (!Array.isArray(value) && value.component) nodes.push(value)
  if (Array.isArray(value)) value.forEach(walk)
  else Object.values(value).forEach(walk)
}
walk(form.fields)

const grids = nodes.filter(node => node.component === 'grid')
const cols = nodes.filter(node => node.component === 'grid-col')
const lists = nodes.filter(node => node.component === 'list-ui')
const byName = name => lists.find(node => node.options?.name === name)
const search = byName('lab_result_reports_search')
const summary = byName('lab_selected_report_summary')
const items = byName('lab_selected_result_items')

function firstNode(root, predicate) {
  let found = null
  function visit(value) {
    if (found || !value || typeof value !== 'object') return
    if (!Array.isArray(value) && predicate(value)) { found = value; return }
    if (Array.isArray(value)) value.forEach(visit)
    else Object.values(value).forEach(visit)
  }
  visit(root)
  return found
}

function fieldNames(source) {
  const result = new Set(['_id', 'xparentx', 'created_at', 'updated_at', 'created_by', 'updated_by', 'xrstatx'])
  function visit(value) {
    if (!value || typeof value !== 'object') return
    if (!Array.isArray(value) && value.formItemFlag === true && value.options?.name) result.add(value.options.name)
    if (Array.isArray(value)) value.forEach(visit)
    else Object.values(value).forEach(visit)
  }
  visit(source)
  return result
}

const emrList = firstNode(EMR, node => node.component === 'list-ui' && node.options?.name === 'visit_unit')
const personGrid = PERSON.fields[0]
const personCol = PERSON.fields[0].cols[0]
const reportFields = fieldNames(REPORT_FORM)
const itemFields = fieldNames(ITEM_FORM)

assert(Object.keys(form).length === 2 && form.fields && form.formConfig, 'Top level must contain only fields + formConfig')
assert(form.fields.length === 1 && form.fields[0].component === 'grid', 'Root must be one Layout widget')
assert(nodes.every(node => ['grid', 'grid-col', 'list-ui'].includes(node.component)), 'Only Layout/Grid Col/ListView widgets are allowed')
assert(grids.length === 1, `Expected one Layout, found ${grids.length}`)
assert(cols.length === 2, `Expected two Grid Cols, found ${cols.length}`)
assert(grids[0].cols?.[0]?.options?.span === 9 && grids[0].cols?.[1]?.options?.span === 15, 'Desktop split must be 9/15')
assert(Object.keys(grids[0]).sort().join(',') === Object.keys(personGrid).sort().join(','), 'Layout node schema must match person.json')
for (const col of cols) {
  assert(Object.keys(col).sort().join(',') === Object.keys(personCol).sort().join(','), `${col.options?.name}: Grid Col node schema must match person.json`)
  assert(col.options?.responsive === false, `${col.options?.name}: responsive must be false so PC span stays 9/15`)
}
assert(lists.length === 3, `Expected three ListViews, found ${lists.length}`)

// Renderer contract: all ListViews must retain the full key set/types from a
// ListView that is already proven to mount in EMR.  This catches the previous
// "Tree View can read it but builder canvas is blank" failure class.
assert(Boolean(emrList), 'Runtime-verified EMR ListView template was not found')
for (const list of lists) {
  const nodeKeys = Object.keys(list).sort().join(',')
  const emrNodeKeys = Object.keys(emrList || {}).sort().join(',')
  const optionKeys = Object.keys(list.options || {}).sort().join(',')
  const emrOptionKeys = Object.keys(emrList?.options || {}).sort().join(',')
  assert(nodeKeys === emrNodeKeys, `${list.options?.name}: node keys differ from verified EMR ListView`)
  assert(optionKeys === emrOptionKeys, `${list.options?.name}: option keys differ from verified EMR ListView`)
  assert(!Object.prototype.hasOwnProperty.call(list, 'key'), `${list.options?.name}: generated catalogue key must not be present`)
  assert(typeof list.options?.customClass === 'string', `${list.options?.name}: customClass must be a string`)
  assert(list.options?.clickEvent === null || typeof list.options?.clickEvent === 'string', `${list.options?.name}: invalid clickEvent type`)
  for (const item of list.options?.customValue || []) {
    assert(typeof item.labelWidth === 'number' && typeof item.align === 'string', `${list.options?.name}: incomplete customValue row schema`)
    try { new vm.Script(`(function(row){ return (${item.expressions}); })`) }
    catch (error) { errors.push(`${list.options?.name}.customValue.${item.fieldName}: ${error.message}`) }
  }

  const customNames = new Set((list.options?.customValue || []).map(item => item.fieldName))
  const placeholders = Array.from(String(list.options?.detailContent || '').matchAll(/\{\{\s*([A-Za-z_$][\w$]*)\s*\}\}/g), match => match[1])
  for (const placeholder of placeholders) {
    assert(customNames.has(placeholder), `${list.options?.name}: template placeholder ${placeholder} has no customValue`)
  }
}

assert(search?.options?.formId === '6a8478abf851000f28e44a16', 'Left ListView must use Result Report form')
for (const field of ['patient_hn', 'patient_name', 'lab_no']) {
  assert(search?.options?.searchField?.includes(field), `Left search is missing ${field}`)
}
assert(search?.options?.buttonsRow?.length === 1 && search.options.buttonsRow[0].label === 'ดูผล', 'Left list must have one ดูผล button')
assert(summary?.options?.formId === search?.options?.formId, 'Summary must use the selected Result Report provider')
assert(items?.options?.formId === '6a7aa641935ed08882467374', 'Right result list must use Lab Result Item form')
assert(items?.options?.groupField === null, 'Current Result Item form has no panel_name field, so runtime grouping must stay unset')
assert(items?.options?.orderBy?.map(x => x.column).join(',') === 'result_sequence,test_code', 'Result ordering must use fields that exist in Result Item')

// Any field selected in ListView schema-aware controls must exist in its live
// provider form.  Unknown group/order/search fields can fail during mount.
for (const [list, fields] of [[search, reportFields], [summary, reportFields], [items, itemFields]]) {
  const bound = []
  for (const key of ['groupField', 'iconField', 'titleField', 'statusField', 'colorField']) {
    if (list.options?.[key]) bound.push([key, list.options[key]])
  }
  for (const field of list.options?.searchField || []) bound.push(['searchField', field])
  for (const order of list.options?.orderBy || []) bound.push(['orderBy', order.column])
  for (const [kind, field] of bound) assert(fields.has(field), `${list.options?.name}.${kind} references missing provider field ${field}`)
}

const wireItemProperties = AGENT_SCHEMA.$defs.resultItem.properties
for (const field of ['obs_code', 'obs_name', 'value', 'units', 'ref_range', 'obx_status', 'critical_low_rule', 'critical_high_rule', 'panel_code', 'panel_name', 'group_role', 'organism']) {
  assert(Boolean(wireItemProperties[field]), `Agent result schema missing expected field ${field}`)
}
const itemTemplateAndValues = `${items?.options?.detailContent || ''}\n${JSON.stringify(items?.options?.customValue || [])}`
for (const mapping of ['obs_code', 'obs_name', 'units', 'ref_range', 'obx_status', 'critical_low_rule', 'critical_high_rule', 'panel_name', 'organism']) {
  assert(itemTemplateAndValues.includes(mapping), `Result UI does not map Agent field ${mapping}`)
}
for (const userValue of ['ผลตรวจ', 'ค่าปกติ', 'หมายเหตุ']) {
  assert(items?.options?.detailContent?.includes(userValue), `Visible result UI missing ${userValue}`)
}
for (const technical of ['Result UID', 'Receipt Seq', 'Result Version', 'Change Kind', 'Payload Hash', 'Schema version']) {
  assert(!lists.some(list => list.options?.detailContent?.includes(technical)), `Technical receipt field leaked into UI: ${technical}`)
}

// Parse every field/list event body.
for (const list of lists) {
  for (const key of ['clickEvent', 'onCreated', 'onMounted', 'onUnmount']) {
    const code = list.options?.[key]
    if (!code) continue
    try { new vm.Script(`(function(){${code}\n})`) }
    catch (error) { errors.push(`${list.options.name}.${key}: ${error.message}`) }
  }
  for (const [index, button] of (list.options?.buttonsRow || []).entries()) {
    try { new vm.Script(`(function(){${button.onClick || ''}\n})`) }
    catch (error) { errors.push(`${list.options.name}.buttonsRow[${index}]: ${error.message}`) }
  }
}

// Behavior: ดูผล must update and refresh both right-side ListViews.
let summaryWhere = ''
let itemWhere = ''
let summaryTitle = ''
let itemTitle = ''
let summaryRefresh = 0
let itemRefresh = 0
const makeRef = (kind) => {
  const editor = { dpFormData: { options: {} }, handleRefresh: () => { if (kind === 'summary') summaryRefresh += 1; else itemRefresh += 1 } }
  return {
    setFieldOption: (name, value) => {
      if (name === 'where') { if (kind === 'summary') summaryWhere = value; else itemWhere = value }
      if (name === 'titleName') { if (kind === 'summary') summaryTitle = value; else itemTitle = value }
    },
    getFieldEditor: () => editor,
  }
}
const summaryRef = makeRef('summary')
const itemRef = makeRef('items')
const mockForm = { getFieldRef: name => name === 'lab_selected_report_summary' ? summaryRef : name === 'lab_selected_result_items' ? itemRef : null }
const notices = []
const handler = new Function('dataRow', search.options.buttonsRow[0].onClick)
handler.call({ getFormRef: () => mockForm, notify: (...args) => notices.push(args) }, {
  _id: '6a8478abf851000f28e44a16',
  lab_no: 'LAB-TEST-001',
})
assert(mockForm.$selectedLabResultReport?.id === '6a8478abf851000f28e44a16', 'ดูผล did not persist selected report context')
assert(summaryWhere.includes("_id = CONVERT('6a8478abf851000f28e44a16'"), 'ดูผล did not filter summary by Report ObjectId')
assert(itemWhere === "xparentx = CONVERT('6a8478abf851000f28e44a16', 'objectId')", 'ดูผล must filter Result Items through the configured xparentx relation')
assert(summaryRefresh === 1 && itemRefresh === 1, 'ดูผล must refresh both right ListViews exactly once')
assert(summaryTitle.includes('LAB-TEST-001') && itemTitle.includes('LAB-TEST-001'), 'ดูผล did not update right-side titles')
assert(notices.length === 0, 'Valid ดูผล row unexpectedly raised a notification')

// Behavior: the generic right-side result row must remain useful for numeric,
// pending, critical, and microbiology-style results without lab-specific
// widgets or raw JSON rendering.
const evaluateCustomValues = (list, row) => Object.fromEntries((list.options.customValue || []).map(item => {
  const evaluate = new Function('row', `return (${item.expressions})`)
  return [item.fieldName, evaluate(row)]
}))
const numericResult = evaluateCustomValues(items, {
  test_name: 'Sodium',
  obs_code: 'NA',
  result_value: 144,
  unit_symbol_snapshot: 'mmol/L',
  reference_range_snapshot: '132-141',
  is_critical: true,
  critical_comment: 'แจ้งแพทย์แล้ว',
  result_status: 'final',
})
assert(numericResult.resultNameLabel === 'Sodium', 'Numeric result name did not render')
assert(numericResult.resultValueLabel === '144', 'Numeric result value did not render')
assert(numericResult.unitLabel === 'mmol/L' && numericResult.referenceLabel === '132-141', 'Unit/reference range did not render')
assert(numericResult.criticalLabel === 'CRITICAL' && numericResult.criticalClass === 'is-critical', 'Critical result did not render')
assert(numericResult.obxStateLabel === 'Final', 'Final result status did not render')

const pendingResult = evaluateCustomValues(items, { test_name: 'Culture', result_value: '', result_status: 'pending' })
assert(pendingResult.resultValueLabel === 'รอผล' && pendingResult.resultValueClass === 'is-pending', 'Pending result did not render')
const microbiologyResult = evaluateCustomValues(items, { test_name: 'Blood culture', result_value: 'Positive', organism: 'E. coli' })
assert(microbiologyResult.organismLabel === 'Organism: E. coli', 'Microbiology organism did not render')

const ids = nodes.map(node => node.id).filter(Boolean)
const names = nodes.map(node => node.options?.name).filter(Boolean)
assert(new Set(ids).size === ids.length, 'Widget IDs must be unique')
assert(new Set(names).size === names.length, 'Widget variable names must be unique')
for (const node of nodes) {
  const pattern = node.component === 'grid-col' ? /^grid-col-\d+$/ : node.component === 'grid' ? /^grid\d+$/ : /^list-ui\d+$/
  assert(pattern.test(node.id || ''), `${node.options?.name}: id does not follow the builder-generated ${node.component} shape`)
}
assert(form.formConfig?.jsonVersion === 3, 'jsonVersion must be 3')

if (errors.length) {
  console.error(`FAIL (${errors.length})`)
  errors.forEach(error => console.error(`- ${error}`))
  process.exit(1)
}

console.log('PASS: JSON parse and person-style SDForm hierarchy')
console.log('PASS: ListView node/options match the runtime-verified EMR export')
console.log('PASS: All schema-bound search/group/order fields exist in their provider forms')
console.log('PASS: Only Layout/Grid Col/ListView widgets; desktop split 9/15')
console.log('PASS: HN/name/LAB NO. search and ดูผล row button')
console.log('PASS: ดูผล filters and refreshes report summary + result items')
console.log('PASS: Result UI maps Agent panel/result/critical/microbiology fields')
console.log('PASS: Result items use the current xparentx relation and safe result ordering')
console.log('PASS: Numeric, pending, critical, and microbiology result-row behavior')
console.log('PASS: Technical receipt/audit fields are hidden from user UI')
console.log('PASS: Event syntax and widget IDs/names')
