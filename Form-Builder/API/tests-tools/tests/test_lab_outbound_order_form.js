const assert = require('assert')
const fs = require('fs')
const path = require('path')

const formPath = path.join(
  __dirname,
  '../../../SDForm/Lab/lab-outbound-order-v1.json',
)
const bridgePath = path.join(
  __dirname,
  '../../api-factory/processes/Lab_Center_Specimen_To_Work_Item_API.js',
)
const form = JSON.parse(fs.readFileSync(formPath, 'utf8'))
const bridge = fs.readFileSync(bridgePath, 'utf8')

const nodes = []
const visit = value => {
  if (!value || typeof value !== 'object') return
  if (value.component) nodes.push(value)
  Object.values(value).forEach(child => {
    if (Array.isArray(child)) child.forEach(visit)
    else if (child && typeof child === 'object') visit(child)
  })
}
visit(form)

assert.strictEqual(form.fields.length, 1)
assert.strictEqual(form.fields[0].component, 'grid')
assert.strictEqual(form.fields[0].cols.length, 38)
assert(
  form.fields[0].cols.every(
    node => node.component === 'grid-col' && node.fields.length === 1,
  ),
  'Every outbound field must use exactly one grid-col',
)
assert(
  nodes.every(node => node.component !== 'card'),
  'Nested cards blanked the Builder canvas and must not return',
)
assert.strictEqual(nodes.length, 77)
assert.strictEqual(nodes.filter(node => node.component === 'grid').length, 1)
assert.strictEqual(nodes.filter(node => node.component === 'grid-col').length, 38)

const keys = nodes.map(node => node.key)
assert(keys.every(Number.isInteger), 'Every rendered component must have a numeric key')
assert.strictEqual(new Set(keys).size, keys.length, 'Component keys must be unique')

const ids = nodes.map(node => node.id)
assert(ids.every(Boolean), 'Every rendered component must have an id')
assert.strictEqual(new Set(ids).size, ids.length, 'Component ids must be unique')

const byName = new Map()
for (const node of nodes) {
  const name = node.options && node.options.name
  if (!name) continue
  assert(!byName.has(name), `duplicate field/container name: ${name}`)
  byName.set(name, node)
}

const requiredNames = [
  'work_item_id',
  'source_cpoe_order_id',
  'source_cpoe_item_id',
  'order_no',
  'lab_no',
  'section_code',
  'patient_hn',
  'visit_id',
  'item_count',
  'hl7_status',
  'agent_http_status',
  'agent_duplicate',
  'retryable',
  'attempt_count',
  'dispatch_id',
  'last_error_code',
  'last_error_reason',
  'request_payload_json',
  'response_payload_json',
  'attempt_history_json',
]
for (const name of requiredNames) assert(byName.has(name), `missing ${name}`)

const statusValues = byName.get('hl7_status').options.optionItems.map(row => row.value)
assert.deepStrictEqual(statusValues, [
  'new',
  'sending',
  'queued',
  'sent',
  'in_progress',
  'resulted',
  'stalled',
  'failed',
  'cancel_requested',
  'cancelled',
  'cancel_rejected',
])

assert.strictEqual(byName.get('order_no').options.required, true)
assert.strictEqual(byName.get('lab_no').options.required, true)
assert.strictEqual(byName.get('request_payload_json').options.required, true)
assert(byName.get('request_payload_json').options.maxLength >= 1024 * 1024)

for (const node of nodes) {
  if (['text-input', 'textarea-input'].includes(node.component)) {
    assert.strictEqual(node.options.readonly, true, `${node.options.name} must be readonly`)
  }
  if (['number-input', 'select-input', 'switch-input'].includes(node.component)) {
    assert.strictEqual(node.options.disabled, true, `${node.options.name} must be disabled`)
  }
}

const serialized = JSON.stringify(form)
assert(!/__CONFIGURE_AGENT_KEY__|X-Agent-Key|Bearer\s+[A-Za-z0-9_-]+/i.test(serialized))
assert(bridge.includes("const WORK_ITEM_FORM_ID = '6a95c750422c1ca959829e8a'"))
assert(!bridge.includes('6a7e818b8d398c11cf2fe8d4'))

console.log('LAB Outbound Order Form tests passed')
