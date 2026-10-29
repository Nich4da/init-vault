const fs = require('fs')
const path = require('path')
const assert = require('assert')

const root = path.resolve(__dirname, '../../../..')
const sendFile = path.join(root, 'Form-Builder/API/api-factory/processes/cpoe_order_send_xray_bypass_api.js')
const saveFile = path.join(root, 'Form-Builder/API/api-factory/processes/cpoe_order_save_xray_bypass_api.js')
const send = fs.readFileSync(sendFile, 'utf8')
const save = fs.readFileSync(saveFile, 'utf8')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

// API Factory process bodies intentionally use top-level await/return.
assert.doesNotThrow(() => new AsyncFunction('app', 'params', 'userInfo', send), 'send replacement compiles as an async process body')
assert.doesNotThrow(() => new AsyncFunction('app', 'params', 'userInfo', save), 'save replacement compiles as an async process body')

for (const [name, source] of [['send', send], ['save', save]]) {
  assert(source.includes("const XRAY_UNIT_TYPE = 'xray'"), name + ' recognizes the X-ray service type')
  assert(source.includes('unit_parent.value'), name + ' resolves child radiology organizations through Organization parent')
  assert(source.includes('unit_type: XRAY_UNIT_TYPE'), name + ' verifies that the Organization parent is an X-ray root')
  assert(!source.includes('unit_code: \'RA-11\''), name + ' does not hard-code RA-11')
  assert(!source.includes('unit_code: \'RA-309\''), name + ' does not hard-code RA-309')
}

assert(send.includes('isXrayUnit && (await isXrayOnlyOrder(orderId))'), 'send bypass requires the current X-ray unit and an X-ray-only order')
assert(send.includes("isOnlyServiceOrder(id, XRAY_UNIT_TYPE)"), 'send checks every persisted item as X-ray')
assert(send.includes('return total > 0 && otherService === 0'), 'send rejects empty and mixed-service orders')

assert(save.includes('serviceUnit.isXray && (await xrayOwnsDraft(editId))'), 'draft update bypass requires the current X-ray unit and its X-ray-only draft')
assert(save.includes("ownsServiceDraft(id, XRAY_UNIT_TYPE)"), 'draft update checks both incoming and persisted items as X-ray')
assert(save.includes('lines.every((l) => (lineSvcCode(l) || svcCode) === serviceType)'), 'draft update rejects incoming mixed-service lines')
assert(save.includes('return total > 0 && otherService === 0'), 'draft update rejects empty and persisted mixed-service orders')

// The patch must not redirect billing ownership or create/move patient queues.
assert(save.includes('order_clinic: await resolveOrderClinic()'), 'new orders retain the originating Visit clinic for billing/audit')
assert(!send.includes('cpoe-order-queue (') || send.includes('เลิกเรียก cpoe-order-queue'), 'send keeps the existing no-queue contract')
assert(!/runApiProcess[^\n]+(?:queue|move.?unit|checkin)/i.test(send), 'send does not call a queue mutation process')
assert(!/runApiProcess[^\n]+(?:queue|move.?unit|checkin)/i.test(save), 'save does not call a queue mutation process')

console.log('PASS CPOE order save/send X-ray-unit bypass replacements')
