const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'))
const walk = (value, fn) => {
  if (!value || typeof value !== 'object') return
  fn(value)
  if (Array.isArray(value)) value.forEach(item => walk(item, fn))
  else Object.values(value).forEach(item => walk(item, fn))
}
const findNamed = (form, name) => {
  let hit = null
  walk(form, value => {
    if ((value.options && value.options.name === name) || value.name === name) hit = value.options || value
  })
  return hit
}
const named = (form, name) => {
  const hit = findNamed(form, name)
  assert(hit, 'missing field ' + name)
  return hit
}
const findNode = (form, name) => {
  let hit = null
  walk(form, value => {
    if (value.options && value.options.name === name) hit = value
  })
  return hit
}

const settings = readJson('Form-Builder/SDForm/X-ray/xray-reject-reason-settings-v1.json')
const rejection = readJson('Form-Builder/SDForm/X-ray/xray-rejection-record-v1.json')
const worklist = readJson('Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json')
const widget = named(worklist, 'xray_cpoe_worklist')

for (const name of ['reason_type', 'reason_code', 'reason_text', 'is_active', 'internal_note']) named(settings, name)
assert.strictEqual(findNamed(settings, 'display_order'), null)
assert.strictEqual(findNamed(settings, 'section_code'), null)
const reasonCode = findNode(settings, 'reason_code')
assert.strictEqual(reasonCode.component, 'autonumber-input')
assert.strictEqual(reasonCode.options.prefix, 'XRAYR-')
assert.strictEqual(reasonCode.options.digit, 5)
assert.strictEqual(reasonCode.options.increment, 1)
assert.strictEqual(reasonCode.options.readonly, true)
assert.strictEqual(reasonCode.options.perDay, false)
assert.strictEqual(reasonCode.options.bySite, false)
const reasonType = named(settings, 'reason_type')
assert.strictEqual(reasonType.defaultValue, 'BOTH')
assert.deepStrictEqual(reasonType.optionItems.map(row => row.value), ['BOTH', 'ITEM_REJECT', 'ORDER_CANCEL'])

for (const name of ['source_item_id', 'source_order_id', 'order_group_id', 'patient_hn',
  'patient_name', 'ward_clinic', 'modality', 'accession_no', 'selected_items_json',
  'treatment_right', 'payment_status', 'revision_no', 'rejected_at', 'rejected_by',
  'rejection_status']) {
  assert.strictEqual(named(rejection, name).hidden, true, name + ' must stay audit-only')
}
const rejectReason = named(rejection, 'reject_reason_code')
assert.strictEqual(rejectReason.multiple, false)
assert(rejectReason.required)
assert(rejectReason.onCreated.includes('form.formParams'))
assert(rejectReason.optionItems.some(row => row.value === 'PATIENT_ABSENT' && row.label === 'ผู้ป่วยไม่มาตามนัด'))
assert(rejectReason.optionItems.some(row => row.value === 'PHYSICIAN_CANCELLED'))
assert(rejectReason.optionItems.some(row => row.value === 'WRONG_PATIENT'))

assert(widget.onCreated.includes("action:'get_reason_options'"), 'Worklist must load the X-ray reason master')
assert(widget.onCreated.includes("reason_type:type"), 'reason master requests must identify reject/cancel type')
assert(widget.onCreated.includes('reason_options:reasonOptions'), 'rejection popup must receive master-backed choices')
assert(widget.content.includes('cancelDialog.reason_code'), 'cancel dialog must require a master reason code')
assert(widget.content.includes('cancelDialog.reason_options'), 'cancel dialog must render master-backed choices')
assert(widget.onCreated.includes("action:'check_cancel_finance'"), 'cancel dialog must run finance preflight')
assert(widget.onCreated.includes("['finance_receipt_active','finance_state_unknown','finance_item_sync_failed']"),
  'server finance failures must refresh the open dialog')

const worklistApiBody = fs.readFileSync(path.join(root,
  'Form-Builder/API/api-factory/processes/xray_cpoe_worklist_api.js'), 'utf8')
assert(worklistApiBody.includes("params.reason_type || 'ITEM_REJECT'"))
assert(worklistApiBody.includes("row.reason_type || 'BOTH'"))
assert(worklistApiBody.includes('created_at: 1'))
assert(!worklistApiBody.includes('display_order'), 'X-ray reason master must use record creation order')

const seedBody = fs.readFileSync(path.join(root,
  'Form-Builder/API/api-factory/processes/xray_reject_reason_seed_api.js'), 'utf8')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const Seed = new AsyncFunction('params', 'userInfo', 'app', seedBody)
const rows = []
const app = {
  isAuth: () => true,
  curDate: () => '2026-10-18 18:00:00',
  dbFindAll: async () => ({ success: true, reply: { data: rows.map(row => ({ ...row })) } }),
  dbInsert: async data => { rows.push({ ...data }); return { success: true, reply: { data } } },
}

;(async () => {
  const preview = await Seed({ action: 'preview' }, { roles: ['auth'], username: 'tester' }, app)
  assert.strictEqual(preview.success, true)
  assert.strictEqual(preview.data.missing_count, 4)

  const missingToken = await Seed({ action: 'execute' }, { roles: ['auth'], username: 'tester' }, app)
  assert.strictEqual(missingToken.success, false)
  assert.strictEqual(rows.length, 0)

  const seeded = await Seed({ action: 'execute', confirm_token: 'SEED_XRAY_REJECT_REASONS_V1' },
    { roles: ['auth'], username: 'tester' }, app)
  assert.strictEqual(seeded.success, true, seeded.message)
  assert.strictEqual(seeded.data.inserted_count, 4)
  assert.strictEqual(new Set(rows.map(row => row.reason_code)).size, 4)
  assert(rows.every(row => row.reason_type === 'BOTH'))
  assert(rows.every(row => !Object.prototype.hasOwnProperty.call(row, 'display_order')))

  const repeated = await Seed({ action: 'execute', confirm_token: 'SEED_XRAY_REJECT_REASONS_V1' },
    { roles: ['auth'], username: 'tester' }, app)
  assert.strictEqual(repeated.success, true)
  assert.strictEqual(repeated.data.inserted_count, 0, 'seed must be idempotent')
  assert.strictEqual(rows.length, 4)

  console.log('X-ray rejection settings tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
