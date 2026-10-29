const fs = require('fs')
const path = require('path')
const assert = require('assert')

const root = path.resolve(__dirname, '../../../..')
const file = path.join(root, 'Form-Builder/SDForm/form-factory/forms/cpoe-test-order-post-send-move-v3.json')
const form = JSON.parse(fs.readFileSync(file, 'utf8'))

const walk = (value, fn) => {
  if (!value || typeof value !== 'object') return
  fn(value)
  if (Array.isArray(value)) value.forEach(item => walk(item, fn))
  else Object.values(value).forEach(item => walk(item, fn))
}
const named = name => {
  let hit = null
  walk(form, value => { if (value && value.name === name) hit = value })
  assert(hit, 'missing widget ' + name)
  return hit
}

const header = named('pt_header')
const item = named('item_screen')
const code = item.onCreated
const content = item.content

assert(header.content.includes('ค้นหาด้วย HN, VN หรือชื่อผู้ป่วย'), 'Visit picker is present')
assert(header.onCreated.includes("action:'list_open_visits'"), 'Visit picker loads the current open Visits')
assert(header.onCreated.includes('visit_tran_id'), 'Visit context retains an optional Visit Tran ID')

assert(code.includes("const XRAY_SCOPE = !!((field.params || {}).xray_scope) || String((field.params || {}).source || '') === 'xray-worklist'"), 'X-ray scope supports the existing launcher')
assert(code.includes("XRAY_SCOPE ? ALL_TYPES.filter(type => type.code === 'xray')"), 'X-ray scope contains only X-ray')
assert(code.includes("s.st = XRAY_SCOPE ? 'xray' : 'lab'"), 'X-ray is the default type in X-ray scope')
assert(content.includes('v-if="!labScope && !xrayScope"'), 'History is hidden in room-scoped modes')

assert(!content.includes('ส่งต่อ (กำหนดเอง)'), 'CPOE does not render the rejected direct Move Unit button')
assert(!code.includes('MOVE_UNIT_FORM_ID'), 'queue movement stays outside the CPOE form')
assert(code.includes('cb(s.pt() || {})'), 'successful send returns the selected patient/Visit context to the launcher')
assert(code.indexOf('notifySent();') < code.indexOf("field.alert('ส่งใบ '"), 'the launcher callback runs only in the successful send branch')

// Markers from the 2026-10-10 live CPOE export: these must survive the rebase.
assert(code.includes("s.orderComment = ''"), 'latest whole-order comment state is preserved')
assert(code.includes('order_comment: String(s.orderComment'), 'latest whole-order comment payload is preserved')
assert(code.includes('s.missCmt = () =>'), 'latest required item comment logic is preserved')
assert(code.includes('const stampSpecAt = () =>'), 'latest specimen timestamp-on-send logic is preserved')
assert(code.includes("d.code === 'DUP_LAB'"), 'latest duplicate LAB confirmation is preserved')

assert(code.includes("visit_id: String((s.pt() || {}).visit_id || '')"), 'the selected Visit is saved')
assert(code.includes("line.st !== 'xray'"), 'X-ray scope blocks non-X-ray lines')
assert(!code.includes('order_to_location'), 'the form does not overwrite order_to_location')

console.log('PASS cpoe-test-order-post-send-move-v3')
