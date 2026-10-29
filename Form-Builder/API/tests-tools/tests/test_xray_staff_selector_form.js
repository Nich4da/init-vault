const assert = require('assert')
const fs = require('fs')
const path = require('path')

/* Focused regression for the 2026-09-30 user-approved selector change.
   This intentionally loads only the X-ray Worklist widget, so unrelated in-progress
   changes to the embedded LAB lookup cannot hide a selector regression. */
const form = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../../SDForm/X-ray/xray-cpoe-worklist-v1.json'),
  'utf8',
))

const findWidget = node => {
  if (!node || typeof node !== 'object') return null
  if (node.options && node.options.name === 'xray_cpoe_worklist') return node.options
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) {
        const found = findWidget(child)
        if (found) return found
      }
    } else if (value && typeof value === 'object') {
      const found = findWidget(value)
      if (found) return found
    }
  }
  return null
}

const widget = findWidget(form)
assert(widget, 'xray_cpoe_worklist widget is required')
assert(widget.content.includes(':model-value="item.radiographer" size="small" clearable filterable'))
assert(widget.content.includes(':model-value="item.radiologist" size="small" clearable filterable'))
assert(widget.content.includes('allow-create default-first-option'))
assert(widget.onCreated.includes("const XRAY_MEMBER_FORM_ID='6abcb7c0c54b3f93ce7a0489'"))
assert(!widget.onCreated.includes("{value:'พญ.กนกพร"), 'staff names must come from master')
assert(!widget.onCreated.includes("{value:'นางสุกัญญา"), 'staff names must come from master')

const MEMBER_TECH = '111111111111111111111111'
const MEMBER_DOCTOR = '222222222222222222222222'
const members = [
  {
    _id: MEMBER_TECH, xrstatx: 1, prename: { label: 'นาง' },
    first_name: 'สุกัญญา', last_name: 'ประจะเน',
    position: { value: 'RADIOGRAPHER_PRO' },
  },
  {
    _id: MEMBER_DOCTOR, xrstatx: 1, prename: { label: 'พญ.' },
    first_name: 'กนกพร ', last_name: 'ชุติวงศ์ธนะพัฒน์',
    position: { value: 'RADIOLOGIST_PRO' },
  },
  {
    _id: '333333333333333333333333', xrstatx: 1, prename: { label: 'นาย' },
    first_name: 'ไม่ควร', last_name: 'แสดง', position: { value: 'OTHER' },
  },
]
const notices = []
const saved = []
const field = {
  vueState: {},
  globalUserState: {
    user: { unit: { code: 'M0901' } },
    crudGetAll: (request, ok) => ok({ data: members }),
  },
  getFormRef: () => ({ formParams: {} }),
  notify: message => notices.push(String(message)),
}

;(async () => {
  new Function(widget.onCreated).call(field)
  const s = field.vueState
  s.loadStaffOptions()
  assert.deepStrictEqual(s.radiographerOptions.map(x => x.value), ['นางสุกัญญา ประจะเน'])
  assert.deepStrictEqual(s.radiologistOptions.map(x => x.value), ['พญ.กนกพร ชุติวงศ์ธนะพัฒน์'])

  s.processCall = async (id, params) => {
    saved.push(params)
    return { success: true, data: { item_id: params.item_id } }
  }
  s.orders = [{
    order_id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    can_action: true,
    items: [{ item_id: 'bbbbbbbbbbbbbbbbbbbbbbbb', current_status: 'sent', item_name: 'Chest PA' }],
  }]
  let row = s.buildRow(s.orders[0])

  await s.setRadiographer(row, row.items[0], 'ชื่อที่ไม่ได้อยู่ใน master')
  assert.strictEqual(saved.length, 0, 'free-text Radiographer must never reach the API')
  assert(notices.some(message => message.includes('ต้องเลือกจาก X-ray Member Master')))

  await s.setRadiographer(row, row.items[0], s.radiographerOptions[0].value)
  assert.strictEqual(saved[0].radiographer_source, 'master')
  assert.strictEqual(saved[0].radiographer_member_id, MEMBER_TECH)

  row = s.buildRow(s.orders[0])
  await s.setRadiologist(row, row.items[0], 'พญ.แพทย์ ภายนอก')
  assert.strictEqual(saved[1].radiologist_source, 'external')
  assert.strictEqual(saved[1].radiologist_member_id, '')

  row = s.buildRow(s.orders[0])
  await s.setRadiologist(row, row.items[0], s.radiologistOptions[0].value)
  assert.strictEqual(saved[2].radiologist_source, 'master')
  assert.strictEqual(saved[2].radiologist_member_id, MEMBER_DOCTOR)
  assert.strictEqual(s.buildRow(s.orders[0]).items[0].radiologist, 'พญ.กนกพร ชุติวงศ์ธนะพัฒน์')

  console.log('X-ray Member Master staff selector form tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
