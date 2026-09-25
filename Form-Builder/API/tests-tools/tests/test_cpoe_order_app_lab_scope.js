const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const form = JSON.parse(fs.readFileSync(
  path.join(root, 'Form-Builder/SDForm/sdform_module/EMR_form/CPOE_app.json'),
  'utf8',
))

const walk = (value, visit) => {
  if (!value || typeof value !== 'object') return
  visit(value)
  if (Array.isArray(value)) value.forEach(item => walk(item, visit))
  else Object.values(value).forEach(item => walk(item, visit))
}
const named = name => {
  let found = null
  walk(form, value => { if (value.name === name) found = value })
  assert(found, 'missing widget ' + name)
  return found
}

const pt = named('pt_header')
const item = named('item_screen')

assert(pt.content.includes('<el-select'))
assert(pt.content.includes('ค้นหาด้วย HN, VN หรือชื่อผู้ป่วย'))
assert(pt.content.includes('ไม่มี Visit ที่เปิดอยู่วันนี้'))
assert(!pt.content.includes('กรอก VN เพื่อเลือก Visit'))
assert(pt.onCreated.includes("const LAB_WORKLIST_PROCESS_ID = '6a9434c3422c1ca959829d5e'"))
assert(pt.onCreated.includes("action:'list_open_visits'"))
assert(pt.onMounted.includes('loadTodayVisits'))

const selectedContexts = []
const processCalls = []
const formHost = {
  userState: {
    runProcess: (id, params, success) => {
      processCalls.push({ id, params })
      success({ data: { success: true, data: {
        visit_date: '2026-09-01',
        visits: [{
          _id: 'VISIT-1',
          vn: '6900101',
          visit_date: '2026-09-01',
          pid: {
            value: 'PERSON-1',
            hn: '6900001',
            prename: { label: 'น.ส.' },
            p_fname: 'ทดสอบ',
            p_lname: 'ระบบ',
            p_gender: '2',
            age: '20 ปี',
          },
        }],
      } } })
    },
  },
}
const fieldRef = { vueState: { setPatientContext: context => selectedContexts.push(context) } }
const ptField = {
  vueState: {},
  params: {
    manual_visit: true,
    lab_scope: true,
    organization_code: 'M1001',
    section_codes: ['BC'],
  },
  getFormRef: () => formHost,
  getFieldRef: name => name === 'item_screen' ? fieldRef : null,
}
new Function(pt.onCreated).call(ptField)
new Function(pt.onMounted).call(ptField)
assert.deepStrictEqual(processCalls[0], {
  id: '6a9434c3422c1ca959829d5e',
  params: { action: 'list_open_visits', organization_code: 'M1001' },
})
assert.strictEqual(ptField.vueState.vnRows.length, 1)
assert.strictEqual(ptField.vueState.visitDate, '2026-09-01')
assert.strictEqual(ptField.vueState.visitOptionLabel(ptField.vueState.vnRows[0]), 'HN6900001 · VN6900101 · น.ส. ทดสอบ ระบบ')
ptField.vueState.selectVisitById('VISIT-1')
assert.strictEqual(selectedContexts[0].visit_id, 'VISIT-1')
assert.strictEqual(selectedContexts[0].hn, '6900001')
assert.strictEqual(formHost.$labCpoeContext.visit_id, 'VISIT-1')

assert(item.content.includes('v-if="!labScope"'))
assert(item.onCreated.includes("const TYPES = LAB_SCOPE ? ALL_TYPES.filter(type => type.code === 'lab') : ALL_TYPES"))
assert(item.onCreated.includes('sections: (lab.sections || []).filter'))
assert(item.onCreated.includes('items: (lab.items || []).filter'))
assert(item.onCreated.includes('organization_code: LAB_SCOPE ? LAB_ORGANIZATION_CODE'))
assert(item.onCreated.includes('section_codes: LAB_SCOPE ? LAB_SECTION_CODES.slice()'))
assert(item.onCreated.includes("line.st !== 'lab'"))
assert(item.onCreated.includes("visit_id: String((s.pt() || {}).visit_id || '')"))
new Function(item.onCreated)

console.log('CPOE Order App LAB scope tests passed')
