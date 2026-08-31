const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'))
const walk = (value, fn) => {
  if (!value || typeof value !== 'object') return
  fn(value)
  if (Array.isArray(value)) value.forEach(item => walk(item, fn))
  else Object.values(value).forEach(item => walk(item, fn))
}
const named = (form, name) => {
  let hit = null
  walk(form, value => { if (value.name === name) hit = value })
  assert(hit, 'missing field ' + name)
  return hit
}

const worklist = read('Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json')
const widget = named(worklist, 'lab_cpoe_worklist')

assert(!widget.content.includes('lab-page-head'), 'page header must be removed')
assert(!widget.content.includes('lab-section-control'), 'room/section picker must not be in this Form')
assert(!widget.content.includes('ตรวจสอบชนิด specimen ก่อนรับ'), 'obsolete instruction must be removed')
assert(!widget.content.includes('<table'), 'expanded Item rows must follow the Stock grid pattern, not a boxed table')
assert(widget.content.includes('lab-item-grid'))
assert(widget.content.includes('lab-specimen-select'))
assert(widget.content.includes('filterable default-first-option'))
assert(widget.content.includes("'lab-specimen-changed':specimenChanged(item)"))
assert(worklist.formConfig.cssCode.includes('.lab-specimen-select .el-select__selected-item{color:var(--text);font-weight:700}'))
assert(worklist.formConfig.cssCode.includes('.lab-specimen-select.lab-specimen-changed .el-select__selected-item{color:#c45656;font-weight:700}'))
assert(widget.content.includes('<div class="lab-item-grid lab-item-head"'), 'expanded Order must show the Item column header')
assert(widget.content.includes('<div>เลือก</div><div>ลำดับ</div><div>Lab no.</div><div>รายการสั่งตรวจ</div><div>specimen</div>'))
assert(widget.content.includes('<div>เวลาเก็บ specimen</div><div>เวลารับ specimen</div><div>สถานะ</div><div>ปฏิเสธ</div><div>คนปฏิเสธ</div>'))
assert(!widget.content.includes('<div data-label="ผลตรวจ">'), 'Order tab must not contain Item-level result actions')
assert(widget.content.includes('v-for="(item,index) in resultItems(order)"'))
assert(widget.content.includes('@click="openResult(item,order,false)">ดูผล</el-button>'))
assert(!widget.content.includes(':disabled="!canOpenResultTab(order)"'), 'result tab must be available before results exist')
assert(widget.onCreated.includes("'ผลตรวจทางห้องปฏิบัติการ'"))
assert(widget.content.includes('aria-label="กรอกหรือแก้ไขผล"'))
assert(widget.content.includes('@click="openResult(item,order,false)"'))
assert(widget.content.includes('ค่าก่อนหน้าของ Item · ประวัติการแก้ไข (อ่านอย่างเดียว)'))
assert(widget.content.includes('<span>Unit</span><el-input v-model="manual.form.unit" clearable />'))
assert(widget.content.includes('<span>ค่าปกติ / Reference range</span><el-input v-model="manual.form.reference_range" clearable />'))
assert(widget.content.includes('การกรอกมือจะไม่สร้างสถานะค่าวิกฤติอัตโนมัติ'))
assert(widget.content.includes('<div>ผู้ป่วย</div><div></div><div>รายการ</div>'))
assert(!widget.content.includes('<span class="lab-field-label">รายการ</span>'), 'desktop Order row must not repeat the Item count heading')
assert(!widget.content.includes('<span class="lab-field-label">specimen</span>'), 'desktop Order row must not repeat the specimen heading')
assert(!widget.content.includes('<span class="lab-field-label">แพทย์</span>'), 'desktop Order row must not repeat the doctor heading')
assert(!widget.content.includes('lab-order-time-label'), 'desktop Order row must not repeat the requested-time heading')
assert(widget.content.includes("Diagnosis: {{ diagnosisText(order) || 'รอเชื่อม EMR' }}"))
assert(widget.content.includes('@click="openCreateOrder"'))
assert(widget.content.includes('@click="openEmr(order)"'))
assert(widget.content.includes(':disabled="selectedCount()!==1||receiveLoading"'))
assert(widget.content.includes('@click="receiveSelected"'))
assert(!widget.content.includes("@click=\"explainWriteBlock('รับ specimen')\""))
assert(widget.onCreated.includes("const RECEIVE_PROCESS_ID='6a94f634422c1ca959829d70'"))
assert(widget.onCreated.includes('const ok=await field.confirm('))
assert(!widget.onCreated.includes('Promise.resolve(field.confirm('))
assert(widget.onCreated.includes('await globalThis.fetch('))
assert(widget.onCreated.includes("body:JSON.stringify({params:params||{}})"))
assert(!widget.onCreated.includes('.runProcess('), 'Form must not use the broken userState.runProcess callback wrapper')

;(async () => {
const opened = []
const processCalls = []
const notifications = []
let receiveResponse = {
  success: true,
  message: 'รับ specimen และส่ง Agent เข้าคิวแล้ว',
  data: {
    current_status: 'accepted',
    lab_no: '1069000001',
    received_at: '2026-08-31 09:00:00',
    received_by: 'LAB-USER',
    hl7_status: 'queued',
  },
}
const originalFetch = globalThis.fetch
globalThis.fetch = async (url, options) => {
  const id = String(url).split('/').pop()
  const body = JSON.parse(options.body || '{}')
  const params = body.params || {}
  processCalls.push({ id, params, authorization: options.headers && options.headers.Authorization })
  let data
  if (id === '6a94f634422c1ca959829d70') data = receiveResponse
  else if (params.action === 'get_manual_result') {
    data = { success: true, data: {
      item_id: params.item_id,
      section_code: 'MY',
      patient_hn: 'HN-TEST',
      visit_vn: 'VN-NEW',
      test_code: 'MY-CULTURE',
      test_name: 'Fungal culture',
      lab_no: 'MY2608310001',
      result_value: '',
      unit: 'CFU/mL',
      interpretation: '',
      reference_range: 'Not detected',
      results: [],
      previous: { value: 'Candida albicans', entered_by: 'lab-old', source: 'manual' },
    } }
  } else if (params.action === 'save_manual_result') {
    data = { success: true, message: 'บันทึกผล Manual แล้ว', data: { result_status: 'entered' } }
  } else if (params.action === 'update_specimen') {
    data = { success: true, data: { specimen_code: params.specimen_code, specimen_name: 'Blood' } }
  } else {
    data = { success: true, data: { orders: [], specimen_options: [], page: 1, limit: 30, total: 0 } }
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({ message: 'API run success', data, error: null }),
  }
}
const field = {
  vueState: {},
  globalUserState: {
    user: { unit: { code: '10' }, token: 'test-token' },
  },
  getFormRef: () => ({
    formParams: { xsitex: 'SITE-1' },
    openForm: (...args) => opened.push(args),
  }),
  confirm: async () => true,
  notify: (...args) => notifications.push(args),
}
new Function(widget.onCreated).call(field)
const s = field.vueState

assert.strictEqual(s.ageText({ patient: { age: '3y 3m 3d' } }), '3y 3m 3d')
assert.strictEqual(
  s.requesterName({ requester: { visit_doctor: 'Nichada Patcharasumransuk (marnichacha27@gmail.com)' } }),
  'Nichada Patcharasumransuk',
)
assert.strictEqual(
  s.requesterName({ requester: { visit_doctor: 'ศิรชัย ปิยะชน ( )' } }),
  'ศิรชัย ปิยะชน',
)
assert(!Object.prototype.hasOwnProperty.call(s.params(['sent'], 30, 1), 'section_codes'))
assert.strictEqual(s.params(['sent'], 30, 1).organization_code, '10')
assert.strictEqual(s.specimenMasterOptions.length, 0)

const item = {
  item_id: 'ITEM-1',
  current_status: 'sent',
  specimen: { complete: false, ordered: { source_code: 'CD' }, master: { code: 'CD', name: 'Clotted blood' } },
}
assert.strictEqual(s.specimenChanged(item), false)
await s.setSpecimen(item, 'BL')
assert.strictEqual(processCalls[0].params.action, 'update_specimen')
assert.strictEqual(processCalls[0].params.organization_code, '10')
assert.strictEqual(processCalls[0].authorization, 'Bearer test-token')
assert.strictEqual(s.specimenEdits['ITEM-1'], 'BL')
assert.strictEqual(item.specimen.ordered.source, 'Blood')
assert.strictEqual(item.specimen.complete, true)
assert.strictEqual(s.specimenChanged(item), true)

s.specimenEdits['ITEM-1'] = 'CD'
assert.strictEqual(s.specimenChanged(item), false)

const mycologyItem = {
  item_id: 'MY-ITEM-1',
  current_status: 'accepted',
  section: { code: 'MY' },
}
assert.strictEqual(s.isMycology(mycologyItem), true)
assert.strictEqual(s.canEditManual(mycologyItem), true)
assert.strictEqual(s.canEditManual({ ...mycologyItem, current_status: 'sent' }), false)
await s.openResult(mycologyItem, { order_id: 'ORDER-MY' }, false)
assert.strictEqual(processCalls.at(-1).params.action, 'get_manual_result')
assert.strictEqual(s.manual.editing, false)
s.startManualEdit()
assert.strictEqual(s.manual.editing, true)
assert.strictEqual(s.manual.data.previous.value, 'Candida albicans')
assert.strictEqual(s.manual.data.previous.entered_by, 'lab-old')
assert.strictEqual(s.manual.form.unit, 'CFU/mL')
s.manual.form.result_value = 'Candida tropicalis'
s.manual.form.interpretation = 'POS'
await s.saveManualResult()
const manualSaveCall = processCalls.find(call => call.params.action === 'save_manual_result')
assert(manualSaveCall)
assert.strictEqual(manualSaveCall.params.manual_result.result_value, 'Candida tropicalis')
assert.strictEqual(mycologyItem.current_status, 'resulted')

const biochemistryItem = {
  item_id: 'BC-ITEM-1',
  current_status: 'accepted',
  section: { code: 'BC' },
}
assert.strictEqual(s.isMycology(biochemistryItem), false)
assert.strictEqual(s.canViewResult(biochemistryItem), true)
await s.openResult(biochemistryItem, { order_id: 'ORDER-BC' }, false)
assert.strictEqual(processCalls.at(-1).params.action, 'get_manual_result')
assert.strictEqual(s.manual.editing, false)
s.startManualEdit()
assert.strictEqual(s.manual.editing, true)

const waitingItem = {
  item_id: 'BC-ITEM-WAITING',
  current_status: 'sent',
  section: { code: 'BC' },
}
const waitingOrder = { order_id: 'ORDER-WAITING', items: [waitingItem] }
assert.strictEqual(s.canOpenResultTab(waitingOrder), true)
s.setDetailTab(waitingOrder, 'results')
assert.strictEqual(s.detailTab(waitingOrder), 'results')
assert.strictEqual(s.canViewResult(waitingItem), true)
await s.openResult(waitingItem, waitingOrder, false)
assert.strictEqual(processCalls.at(-1).params.action, 'get_manual_result')
assert.strictEqual(s.manual.editing, false)
s.startManualEdit()
assert.strictEqual(s.manual.editing, false, 'pencil stays unavailable until specimen receipt')

const receiveItem = {
  item_id: '111111111111111111111111',
  item_code: 'BC001',
  item_name: 'Glucose',
  current_status: 'sent',
  specimen: { ordered: { collected_at: '2026-08-31 08:30:00' } },
}
s.orders = [{ order_id: 'ORDER-RECEIVE-1', items: [receiveItem] }]
s.toggleItem(receiveItem.item_id)
await s.receiveSelected()
const receiveCall = processCalls.find(call => call.id === '6a94f634422c1ca959829d70')
assert(receiveCall)
assert.deepStrictEqual(receiveCall.params, { item_id: receiveItem.item_id })
assert.strictEqual(receiveItem.current_status, 'accepted')
assert.strictEqual(receiveItem.lab_no, '1069000001')
assert.strictEqual(receiveItem.received_at, '2026-08-31 09:00:00')
assert.strictEqual(receiveItem.hl7_status, 'queued')
assert.strictEqual(s.isSelected(receiveItem.item_id), false)
assert.strictEqual(s.receiveLoading, false)

const noCollectionTimeItem = {
  item_id: '333333333333333333333333',
  item_code: 'BC003',
  item_name: 'Calcium',
  current_status: 'sent',
  specimen: { ordered: {} },
}
s.orders = [{ order_id: 'ORDER-RECEIVE-3', items: [noCollectionTimeItem] }]
s.toggleItem(noCollectionTimeItem.item_id)
await s.receiveSelected()
assert(processCalls.some(call => call.id === '6a94f634422c1ca959829d70' && call.params.item_id === noCollectionTimeItem.item_id))
assert.strictEqual(noCollectionTimeItem.current_status, 'accepted')

receiveResponse = {
  success: false,
  received: true,
  retryable: true,
  message: 'รับ specimen แล้ว แต่ Agent ยังไม่พร้อม',
  data: {
    current_status: 'accepted',
    lab_no: '1069000002',
    received_at: '2026-08-31 09:05:00',
    received_by: 'LAB-USER',
    hl7_status: 'new',
  },
}
const transportFailedItem = {
  item_id: '222222222222222222222222',
  item_code: 'BC002',
  item_name: 'Albumin',
  current_status: 'sent',
  specimen: { ordered: { collected_at: '2026-08-31 08:35:00' } },
}
s.orders = [{ order_id: 'ORDER-RECEIVE-2', items: [transportFailedItem] }]
s.toggleItem(transportFailedItem.item_id)
await s.receiveSelected()
assert.strictEqual(transportFailedItem.current_status, 'accepted')
assert.strictEqual(transportFailedItem.hl7_status, 'new')
assert.strictEqual(s.isSelected(transportFailedItem.item_id), false)
assert(notifications.some(args => args[0] === 'รับ specimen แล้ว แต่ Agent ยังไม่พร้อม' && args[1] === 'warning'))

s.openCreateOrder()
assert.strictEqual(opened[0][0], '6a927860422c1ca959829d26')
assert.strictEqual(opened[0][4].params.manual_visit, true)

s.openEmr({ emr_context: { visit_id: 'VISIT-1', vn: 'VN-1' } })
assert.strictEqual(opened[1][0], '6a4f64e7f8cdfc54cec16488')
assert.strictEqual(opened[1][4].params.lab_deep_link, true)
assert.strictEqual(opened[1][4].params.visit_id, 'VISIT-1')

const cpoe = read('Form-Builder/SDForm/sdform_module/EMR_form/CPOE_app.json')
const patientHeader = named(cpoe, 'pt_header')
const itemScreen = named(cpoe, 'item_screen')
assert(patientHeader.content.includes('cpoe-vn-picker'))
assert(patientHeader.onCreated.includes("providerId:'6a40fdec4b6dfdf45acbfbce'"))
assert(itemScreen.onCreated.includes('setPatientContext'))

const emr = read('Form-Builder/SDForm/sdform_module/EMR_form/EMR.json')
assert(emr.formConfig.onFormMounted.includes('lab_deep_link'))
assert(emr.formConfig.onFormMounted.includes("providerId:'6a461235e521219e514d1c4b'"))
assert(emr.formConfig.onFormMounted.includes('hideQueueTabs'))
assert(emr.formConfig.onFormMounted.includes("'tab1','tab_pane_10728','tab_pane_11027'"))
assert(emr.formConfig.onFormMounted.includes('setInterval'))
assert(emr.formConfig.onFormMounted.includes("querySelector(':scope > .el-tabs__header')"))
assert(emr.formConfig.cssCode.includes('.lab-emr-only>.el-tabs__header'))

globalThis.fetch = originalFetch
console.log('LAB CPOE worklist Form tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
