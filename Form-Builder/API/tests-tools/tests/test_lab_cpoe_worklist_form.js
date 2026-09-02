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
const scanner = named(worklist, 'scan_code')
const workItemForm = read('Form-Builder/SDForm/form-factory/forms/Lab_Work_Item_CRUD.json')
assert.strictEqual(named(workItemForm, 'lab_no').required, false, 'pre-receipt rejected Work Item must not require a LAB NO.')
assert.strictEqual(named(workItemForm, 'rejection_record_id').hidden, true)
for (const fieldName of ['cancellation_record_id', 'cancel_type', 'cancel_reason', 'cancelled_at', 'cancelled_by']) {
  assert.strictEqual(named(workItemForm, fieldName).hidden, true, fieldName + ' must be a hidden audit field')
}

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
assert(widget.content.includes('<div>เวลาเก็บ specimen</div><div>เวลารับ specimen</div><div>สถานะ</div><div>เหตุผล</div><div>ผู้ดำเนินการ</div>'))
assert(widget.content.includes('{{ actionReasonText(item) }}'))
assert(widget.content.includes('{{ actionActorText(item) }}'))
assert(widget.onCreated.includes("specimen_insufficient:'ปริมาณสิ่งส่งตรวจไม่เพียงพอ'"))
assert(!widget.content.includes('<div data-label="ผลตรวจ">'), 'Order tab must not contain Item-level result actions')
assert(widget.content.includes('v-for="(item,index) in resultItems(order)"'))
assert(widget.content.includes('@click="openResult(item,order,false)">ดูผล</el-button>'))
assert(widget.content.includes('<div>ลำดับ</div><div>รายการสั่งตรวจ</div><div>เวลาออกผล</div><div>ผลตรวจ</div><div>สถานะ</div>'))
assert(widget.content.includes('{{ resultTime(item) }}'))
assert(widget.content.includes('{{ criticalText(item) }}'))
assert(!widget.content.includes('<div class="lab-result-list-head"><div>ลำดับ</div><div>รายการสั่งตรวจ</div><div>LAB NO.</div>'))
assert(!widget.content.includes(':disabled="!canOpenResultTab(order)"'), 'result tab must be available before results exist')
assert(widget.onCreated.includes("'ผลตรวจทางห้องปฏิบัติการ'"))
assert(widget.content.includes('aria-label="กรอกหรือแก้ไขผล"'))
assert(widget.content.includes('@click="openResult(item,order,false)"'))
// 2026-09-02: prior result is longitudinal (previous encounter), not correction history.
assert(widget.content.includes('<span>ผลก่อนหน้า</span>'))
assert(widget.content.includes('<span>ผลปัจจุบัน</span>'))
assert(widget.content.indexOf('<span>ผลก่อนหน้า</span>') < widget.content.indexOf('<span>ผลปัจจุบัน</span>'))
assert(!widget.content.includes('ประวัติการแก้ไข (อ่านอย่างเดียว)'))
assert(widget.content.includes('แก้ไขโดย {{ result.last_edited_by }}'))
assert(widget.content.includes('<span>Unit</span><el-input v-model="manual.form.unit" clearable />'))
assert(widget.content.includes('<span>ค่าปกติ / Reference range</span><el-input v-model="manual.form.reference_range" clearable />'))
assert(widget.content.includes('การกรอกมือจะไม่สร้างสถานะค่าวิกฤติอัตโนมัติ'))
assert(widget.content.includes('<div>ผู้ป่วย</div><div></div><div>รายการ</div>'))
assert(widget.content.includes('v-if="hasPriorMedication(order)" class="lab-prior-medication"'))
assert(widget.content.includes('💊 {{ priorMedicationText(order) }}'))
assert(!widget.content.includes('🟡'), 'prior medication marker must not include the trailing yellow circle')
assert(widget.onCreated.includes("s.hasPriorMedication=o=>s.optionCode(o&&o.prior_medication)==='2'"))
assert(worklist.formConfig.cssCode.includes('.lab-prior-medication{'))
assert(worklist.formConfig.cssCode.includes('grid-template-columns:32px minmax(210px,1.45fr) minmax(220px,1.45fr) 78px 90px'))
assert(widget.content.includes(":class=\"{'is-selectable':item.current_status==='sent','is-selected':isSelected(item.item_id)}\""))
assert(widget.content.includes('@click="selectRow(order,item,$event)"'))
assert(widget.onCreated.includes('s.selectRow=(order,item,event)=>'))
assert(worklist.formConfig.cssCode.includes('.lab-item-row.is-selectable{cursor:pointer}'))
assert(worklist.formConfig.cssCode.includes('.lab-item-specimen-cell{padding-right:8px;transform:translateX(-8px)}'))
assert(widget.content.includes('class="lab-mono lab-item-collected-time"'))
assert(widget.content.includes('{{ datePart(item.specimen && item.specimen.ordered && item.specimen.ordered.collected_at) }}'))
assert(widget.content.includes('{{ timePart(item.specimen && item.specimen.ordered && item.specimen.ordered.collected_at) }}'))
assert(widget.content.includes(':disabled="!itemTooltipLines(order).length" popper-class="lab-cpoe-list-popper"'))
assert(widget.content.includes(':disabled="!specimenTooltipLines(order).length" popper-class="lab-cpoe-list-popper"'))
assert(widget.content.includes("class=\"lab-pop-line\">{{ line }}</div>"))
assert(widget.content.includes(':disabled="!diagnosisText(order)" popper-class="lab-cpoe-diagnosis-popper"'))
assert(widget.content.includes('<div class="lab-diagnosis-pop">{{ diagnosisText(order) }}</div>'))
assert(worklist.formConfig.cssCode.includes('.lab-cpoe-diagnosis-popper{max-width:420px}'))
assert(!widget.content.includes('<span class="lab-field-label">รายการ</span>'), 'desktop Order row must not repeat the Item count heading')
assert(!widget.content.includes('<span class="lab-field-label">specimen</span>'), 'desktop Order row must not repeat the specimen heading')
assert(!widget.content.includes('<span class="lab-field-label">แพทย์</span>'), 'desktop Order row must not repeat the doctor heading')
assert(!widget.content.includes('lab-order-time-label'), 'desktop Order row must not repeat the requested-time heading')
assert(widget.content.includes('Diagnosis:<template v-if="diagnosisText(order)"> {{ diagnosisText(order) }}</template>'))
assert(!widget.content.includes('รอเชื่อม EMR'))
assert(widget.content.includes('@click="openCreateOrder"'))
assert(widget.content.includes('@click="openEmr(order)"'))
assert(widget.content.includes('v-if="!isCancelledOrder(order)" class="lab-plain-action" size="small"'))
// 2026-09-02: user approved binding the verified live Report ID; PDF must now be row-scoped.
assert(!widget.content.includes("@click=\"notifyPending('PDF ใบสั่งตรวจ')\""))
assert(widget.content.includes('<sd-report'), 'Worklist must bind the verified LAB Order Report')
assert(widget.content.includes('v-if="!isCancelledOrder(order)&&orderReportReady(order)"'))
assert(widget.content.includes('title="Order นี้ไม่มี Order ID, Visit ID หรือ LAB Section สำหรับสร้าง PDF"'))
assert(widget.content.includes('v-else class="lab-plain-action" type="primary" size="small" @click="mockRetest(order)">ตรวจใหม่</el-button>'))
assert(widget.content.includes('v-if="!isCancelledOrder(order)" class="lab-plain-action" size="small" @click="openEmr(order)">EMR</el-button>'))
assert(widget.content.includes('<span v-else class="lab-action-placeholder" aria-hidden="true"></span>'))
assert(widget.content.includes("{{ statusKey==='cancelled' ? 'ดำเนินการ' : 'PDF' }}"))
assert(widget.onCreated.includes("s.isCancelledOrder=o=>['cancelled','rejected'].includes(s.orderStatus(o))"))
assert(widget.onCreated.includes("const ORDER_REQUEST_REPORT_ID='6a977ac8422c1ca959829f97'"))
assert(widget.onCreated.includes("s.orderRequestReportList=ORDER_REQUEST_REPORT_ID?[{reportId:ORDER_REQUEST_REPORT_ID,label:'PDF',type:'pdf'}]:[]"))
assert(widget.onCreated.includes('s.orderVisitId=o=>'))
assert(widget.onCreated.includes('s.orderReportReady=o=>'))
assert(widget.onCreated.includes('s.reportSectionCode=o=>'))
assert(widget.onCreated.includes('s.orderReportParams=o=>'))
assert(widget.onCreated.includes('order_id:s.text(o&&o.order_id)'))
assert(widget.onCreated.includes('visit_id:s.orderVisitId(o)'))
assert(widget.onCreated.includes('section_code:s.reportSectionCode(o)'))
assert(widget.onCreated.includes('s.mockRetest=order=>'))
assert(widget.content.includes(':disabled="!canReceiveOrder(order)||receiveLoading||rejectLoading||cancelDialog.loading"'))
assert(widget.content.includes('@click="receiveSelected(order)"'))
assert(widget.content.includes(':disabled="selectedCount(order)!==1||receiveLoading||rejectLoading||cancelDialog.loading"'))
assert(!widget.content.includes("@click=\"explainWriteBlock('รับ specimen')\""))
assert(widget.content.includes('@click="rejectSelected(order)"'))
assert(!widget.content.includes("@click=\"explainWriteBlock('ปฏิเสธรายการที่เลือก')\""))
assert(widget.onCreated.includes("const RECEIVE_PROCESS_ID='6a94f634422c1ca959829d70'"))
assert(widget.onCreated.includes("const REJECT_PROCESS_ID='6a79ff46d5218a5b6a26bebc'"))
assert(widget.onCreated.includes("const REJECTION_FORM_ID='6a7713fdcc7d0a8451130331'"))
assert(widget.onCreated.includes('s.allowedSectionCodes=[]'))
assert(widget.onCreated.includes('lab_scope:true'))
assert(widget.onCreated.includes('organization_code:s.unitCode()'))
assert(widget.onCreated.includes('section_codes:sectionCodes'))
assert(widget.onCreated.includes("cancelled:['cancelled','rejected']"))
assert(widget.onCreated.includes("all:['sent','accepted','prepared','ready','dispensed','resulted','completed','cancelled','rejected']"))
assert(worklist.fields.some(field => field.component === 'scan-code-ui' && field.options && field.options.name === 'scan_code'))
assert.strictEqual(scanner.target, 'document')
assert.strictEqual(scanner.minLength, 6)
assert.strictEqual(scanner.avgTimeByChar, 30)
assert.deepStrictEqual(scanner.suffixKeyCodes, [13])
assert(scanner.onScan.includes("getFieldRef('lab_cpoe_worklist')"))
assert(scanner.onScan.includes('state.scanPatientHn(hn)'))
const runScan = new Function('value', 'qty', scanner.onScan)
let scannedHn = ''
runScan.call({
  getFormRef: () => ({
    showPopupFlag: false,
    getFieldRef: () => ({ vueState: { scanPatientHn: value => { scannedHn = value } } }),
  }),
  notify: message => { throw new Error(message) },
}, 'HN 6900001', 1)
assert.strictEqual(scannedHn, '6900001')
runScan.call({
  getFormRef: () => ({ showPopupFlag: true }),
  notify: message => { throw new Error(message) },
}, '6900002', 1)
assert.strictEqual(scannedHn, '6900001', 'scanner must not switch patient behind an open popup')
assert(widget.content.includes('โหมดผู้ป่วยจากการสแกน'))
assert(widget.content.includes("statusKey==='complete'"))
assert(widget.content.includes('แสดงประวัติออกผลครบทุกวัน'))
assert(widget.content.includes('@click="clearScan"'))
assert(widget.onCreated.includes('s.scanPatientHn=hn=>'))
assert(widget.onCreated.includes("const allCompletedHistory=s.scanMode&&scopedStatuses.length===1&&scopedStatuses[0]==='completed'"))
assert(widget.onCreated.includes("s.applyFilters=()=>{s.scanMode=false;s.scannedHn=''"))
assert(widget.onCreated.includes('s.receiveSelected=async order=>'))
assert(widget.onCreated.includes('s.selectedItems=order=>'))
assert(widget.onCreated.includes('s.canReceiveOrder=order=>'))
assert(widget.onCreated.includes('for(let index=0;index<items.length;index++)'))
assert(widget.onCreated.includes('s.rejectSelected=order=>'))
assert(widget.content.includes('@click="openCancelOrder(order)">ยกเลิก order</el-button>'))
assert(widget.content.includes('@click="submitCancelOrder">ยืนยันยกเลิกทั้ง Order</el-button>'))
assert(widget.content.includes('ถ้ารายการถูกส่งไป Agent/LIS แล้ว ระบบจะหยุดและไม่ยกเลิกเฉพาะฝั่ง HIS'))
assert(widget.onCreated.includes('s.canCancelOrder=order=>'))
assert(widget.onCreated.includes('s.openCancelOrder=order=>'))
assert(widget.onCreated.includes('s.submitCancelOrder=async()=>'))
assert(widget.onCreated.includes("action:'cancel_order'"))
assert(widget.onCreated.includes('สร้าง Outbound Order โดยยังไม่ส่ง Agent อัตโนมัติ'))
assert(widget.onCreated.includes("api.runProcess(id,params||{}"))
assert(!widget.onCreated.includes('globalThis.fetch('), 'Form must retain the original working Process connector')

;(async () => {
const opened = []
const notifications = []
const processCalls = []
let subFormCloseCount = 0
const originalFetch = globalThis.fetch
globalThis.fetch = async (url, options) => {
  const id = String(url).split('/').pop()
  const body = JSON.parse(options.body || '{}')
  const params = body.params || {}
  processCalls.push({ id, params, authorization: options.headers && options.headers.Authorization })
  let data
  if (params.action === 'cancel_order') {
    data = { success: true, message: 'ยกเลิก LAB Order แล้ว', data: {
      order_id: params.order_id,
      order_number: params.order_number,
      current_status: 'cancelled',
      cancel_type: 'lab_order_cancelled',
      cancel_reason: params.cancel_reason,
      cancelled_at: '2026-09-01 13:00:00',
      cancelled_by: { id: 'USER-1', name: 'Earn Admin' },
      audit_sync_pending: false,
    } }
  } else if (id === '6a94f634422c1ca959829d70') {
    data = { success: true, message: 'รับ specimen และสร้าง LAB NO. แล้ว', data: {
      item_id: params.item_id,
      current_status: 'accepted',
      lab_no: '1069000001',
      received_at: '2026-08-31 09:00:00',
      received_by: 'LAB-USER',
      hl7_status: 'new',
      agent_transport_state: 'pending',
      transport_deferred: true,
    } }
  } else if (id === '6a79ff46d5218a5b6a26bebc') {
    data = { success: true, message: 'ปฏิเสธ LAB Item แล้ว', data: {
      item_id: params.item_id,
      work_item_id: params.item_id,
      current_status: 'rejected',
      work_status: 'rejected',
      rejected_at: '2026-09-01 12:34:56',
      rejected_by: { id: 'USER-1', name: 'Earn Admin' },
      reject_reason_code: 'specimen_insufficient',
      reject_reason_detail: 'ปริมาณไม่พอ',
      audit_sync_pending: false,
    } }
  } else if (params.action === 'get_manual_result') {
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
    data = { success: true, message: 'บันทึกผล Manual แล้ว', data: { result_status: 'entered', entered_at: '2026-08-31 15:02:30' } }
  } else if (params.action === 'update_specimen') {
    data = { success: true, data: { specimen_code: params.specimen_code, specimen_name: 'Blood' } }
  } else {
    data = { success: true, data: { orders: [], specimen_options: [], section_codes: ['BC'], page: 1, limit: 30, total: 0 } }
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({ message: 'API run success', data, error: null }),
  }
}
const formHost = {
  formParams: { xsitex: 'SITE-1' },
  openForm: (...args) => opened.push(args),
  subFormClose: () => { subFormCloseCount++ },
}
const field = {
  vueState: {},
  globalUserState: {
    user: { unit: { code: '10' }, token: 'test-token' },
    runProcess: (id, params, success, failure) => {
      globalThis.fetch('mock-process/' + id, { body: JSON.stringify({ params }) })
        .then(response => response.json())
        .then(json => success({ data: json.data }))
        .catch(failure)
    },
  },
  getFormRef: () => formHost,
  confirm: async () => true,
  notify: (...args) => notifications.push(args),
}
new Function(widget.onCreated).call(field)
const s = field.vueState

assert.strictEqual(s.ageText({ patient: { age: '3y 3m 3d' } }), '3y 3m 3d')
assert.strictEqual(s.hasPriorMedication({ prior_medication: '2', prior_specify: 'abacavir' }), true)
assert.strictEqual(s.hasPriorMedication({ prior_medication: 2, prior_specify: 'abacavir' }), true)
assert.strictEqual(s.hasPriorMedication({ prior_medication: { value: '2', label: 'ได้รับแล้ว' }, prior_specify: 'abacavir' }), true)
assert.strictEqual(s.hasPriorMedication({ prior_medication: '1', prior_specify: 'abacavir' }), false)
assert.strictEqual(s.hasPriorMedication({ prior_medication: '2', prior_specify: '' }), false)
assert.strictEqual(s.priorMedicationText({ prior_specify: 'abacavir' }), 'abacavir')
const tooltipOrder = {
  diagnosis: { value: 'C4102', label: 'C4102 Maxilla malignant neoplasm' },
  items: [
    { item_code: 'C34', item_name: 'Gamma GT', specimen: { ordered: { source: 'Clotted blood', source_code: 'CD' } } },
    { item_code: 'C64', item_name: 'Ammonia', specimen: { master: { name: 'EDTA blood', code: 'EDTA' }, ordered: {} } },
  ],
}
assert.strictEqual(s.diagnosisText(tooltipOrder), 'C4102 Maxilla malignant neoplasm')
assert.strictEqual(s.orderStatus({ current_status: 'accepted', items: [{ current_status: 'sent' }, { current_status: 'sent' }] }), 'sent')
assert.strictEqual(s.orderStatus({ current_status: 'accepted', items: [{ current_status: 'sent' }, { current_status: 'accepted' }] }), 'mixed')
assert.strictEqual(s.orderStatus({ current_status: 'sent', items: [{ current_status: 'accepted' }, { current_status: 'accepted' }] }), 'accepted')
assert.strictEqual(s.isCancelledOrder({ items: [{ current_status: 'cancelled' }, { current_status: 'rejected' }] }), true)
assert.strictEqual(s.isCancelledOrder({ items: [{ current_status: 'rejected' }, { current_status: 'rejected' }] }), true)
assert.strictEqual(s.isCancelledOrder({ items: [{ current_status: 'rejected' }, { current_status: 'sent' }] }), false)
assert.deepStrictEqual(s.itemTooltipLines(tooltipOrder), ['C34 Gamma GT', 'C64 Ammonia'])
assert.deepStrictEqual(s.specimenTooltipLines(tooltipOrder), [
  'Clotted blood · C34 Gamma GT',
  'EDTA blood · C64 Ammonia',
])
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
s.filters = { hn: 'MANUAL-HN', dates: ['2026-08-01', '2026-09-02'] }
s.scanMode = true
s.scannedHn = '6900001'
const scannedActiveParams = s.params(['sent'], 30, 1)
assert.strictEqual(scannedActiveParams.hn, '6900001')
assert.strictEqual(scannedActiveParams.date_from, '2026-08-01')
assert.strictEqual(scannedActiveParams.date_to, '2026-09-02')
const scannedHistoryParams = s.params(['completed'], 30, 1)
assert.strictEqual(scannedHistoryParams.hn, '6900001')
assert(!Object.prototype.hasOwnProperty.call(scannedHistoryParams, 'date_from'))
assert(!Object.prototype.hasOwnProperty.call(scannedHistoryParams, 'date_to'))
const realLoadOrders = s.loadOrders
const realRefreshCounts = s.refreshCounts
s.loadOrders = () => {}
s.refreshCounts = () => {}
s.statusKey = 'all'
s.setStatus('complete')
assert.strictEqual(s.scanMode, true, 'switching status tabs must retain scanned patient context')
s.applyFilters()
assert.strictEqual(s.scanMode, false, 'manual Search must exit scanned patient context')
s.loadOrders = realLoadOrders
s.refreshCounts = realRefreshCounts
assert.strictEqual(s.specimenMasterOptions.length, 0)
const processCallCountBeforeRetestMock = processCalls.length
s.mockRetest({ order_number: 'R2609010004' })
assert.strictEqual(processCalls.length, processCallCountBeforeRetestMock, 'mock retest must not call a write Process')
assert(notifications.at(-1)[0].includes('สร้าง Order No. ใหม่'))
assert(notifications.at(-1)[0].includes('สร้าง LAB NO. เมื่อรับ specimen'))
assert.strictEqual(
  s.rejectReasonText({ reject_reason_code: 'specimen_insufficient', reject_reason_detail: '' }),
  'ปริมาณสิ่งส่งตรวจไม่เพียงพอ',
)
assert.strictEqual(
  s.rejectReasonText({ reject_reason_code: 'specimen_insufficient', reject_reason_detail: 'หลอดมีตัวอย่างน้อย' }),
  'ปริมาณสิ่งส่งตรวจไม่เพียงพอ · หลอดมีตัวอย่างน้อย',
)
assert.strictEqual(
  s.rejectReasonText({ reject_reason: 'specimen_insufficient' }),
  'ปริมาณสิ่งส่งตรวจไม่เพียงพอ',
)

const item = {
  item_id: 'ITEM-1',
  current_status: 'sent',
  specimen: { complete: false, ordered: { source_code: 'CD' }, master: { code: 'CD', name: 'Clotted blood' } },
}
const itemOrder = { order_id: 'ORDER-ROW-1', items: [item] }
const normalRowTarget = { closest: () => null }
const controlRowTarget = { closest: selector => selector.includes('.el-checkbox') ? {} : null }
const originalWindow = globalThis.window
globalThis.window = { getSelection: () => ({ toString: () => '' }) }
s.selected = {}
s.selectRow(itemOrder, item, { target: normalRowTarget })
assert.strictEqual(s.isSelected(item.item_id), true, 'clicking a selectable Item row must select it')
s.selectRow(itemOrder, item, { target: controlRowTarget })
assert.strictEqual(s.isSelected(item.item_id), true, 'clicking its checkbox/control must not double toggle')
globalThis.window = { getSelection: () => ({ toString: () => 'CD' }) }
s.selectRow(itemOrder, item, { target: normalRowTarget })
assert.strictEqual(s.isSelected(item.item_id), true, 'finishing a text selection must not toggle the row')
globalThis.window = { getSelection: () => ({ toString: () => '' }) }
const receivedRowItem = { ...item, item_id: 'ITEM-RECEIVED', current_status: 'accepted' }
s.selectRow({ order_id: 'ORDER-ROW-2', items: [receivedRowItem] }, receivedRowItem, { target: normalRowTarget })
assert.strictEqual(s.isSelected('ITEM-RECEIVED'), false, 'non-waiting Item row must remain inert')
globalThis.window = originalWindow
s.selected = {}
assert.strictEqual(s.specimenChanged(item), false)
await s.setSpecimen(item, 'BL')
assert.strictEqual(processCalls[0].params.action, 'update_specimen')
assert.strictEqual(processCalls[0].params.organization_code, '10')
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
assert.strictEqual(mycologyItem.resulted_at, '2026-08-31 15:02:30')
assert.strictEqual(s.resultTime(mycologyItem), '15:02:30')
assert.strictEqual(s.criticalText(mycologyItem), 'รอยืนยัน')
assert.strictEqual(s.criticalText({ ...mycologyItem, is_critical: true }), 'ค่าวิกฤติ')
assert.strictEqual(s.criticalText({ ...mycologyItem, is_critical: false }), 'ไม่พบค่าวิกฤติ')

const biochemistryItem = {
  item_id: 'BC-ITEM-1',
  current_status: 'accepted',
  section: { code: 'BC' },
}
assert.strictEqual(s.isMycology(biochemistryItem), false)
assert.strictEqual(s.canViewResult(biochemistryItem), true)
assert.strictEqual(s.canEditManual(biochemistryItem), false)
await s.openResult(biochemistryItem, { order_id: 'ORDER-BC' }, false)
assert.strictEqual(processCalls.at(-1).params.action, 'get_manual_result')
assert.strictEqual(s.manual.editing, false)
s.startManualEdit()
assert.strictEqual(s.manual.editing, false)

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
  specimen: { ordered: {} },
}
const receiveItem2 = {
  item_id: '222222222222222222222222',
  item_code: 'BC002',
  item_name: 'Creatinine',
  current_status: 'sent',
  specimen: { ordered: {} },
}
const receiveOrder = { order_id: 'ORDER-RECEIVE-1', items: [receiveItem, receiveItem2] }
const otherOrder = { order_id: 'ORDER-RECEIVE-2', items: [{ item_id: '333333333333333333333333', current_status: 'sent' }] }
s.orders = [receiveOrder, otherOrder]
s.toggleItem(receiveOrder, receiveItem.item_id)
assert.strictEqual(s.canReceiveOrder(receiveOrder), true)
assert.strictEqual(s.canReceiveOrder(otherOrder), false, 'selection from another Order must not enable this Order button')
s.toggleItem(receiveOrder, receiveItem2.item_id)
assert.strictEqual(s.selectedCount(receiveOrder), 2)
assert.strictEqual(s.canReceiveOrder(receiveOrder), true, 'receiving multiple waiting Items in one Order must stay enabled')
await s.receiveSelected(receiveOrder)
const receiveCalls = processCalls.filter(call => call.id === '6a94f634422c1ca959829d70')
assert.strictEqual(receiveCalls.length, 2)
assert.deepStrictEqual(receiveCalls.map(call => call.params), [
  { item_id: receiveItem.item_id },
  { item_id: receiveItem2.item_id },
])
assert.strictEqual(receiveItem.current_status, 'accepted')
assert.strictEqual(receiveItem2.current_status, 'accepted')
assert.strictEqual(receiveItem.lab_no, '1069000001')
assert.strictEqual(receiveItem.received_at, '2026-08-31 09:00:00')
assert.strictEqual(receiveItem.hl7_status, 'new')
assert.strictEqual(receiveItem.agent_transport_state, 'pending')
assert.strictEqual(s.isSelected(receiveItem.item_id), false)
assert.strictEqual(s.isSelected(receiveItem2.item_id), false)
assert.strictEqual(s.receiveLoading, false)

s.allowedSectionCodes = ['BC']
s.openCreateOrder()
assert.strictEqual(opened[0][0], '6a927860422c1ca959829d26')
assert.strictEqual(opened[0][4].params.manual_visit, true)
assert.strictEqual(opened[0][4].params.lab_scope, true)
assert.strictEqual(opened[0][4].params.organization_code, '10')
assert.deepStrictEqual(opened[0][4].params.section_codes, ['BC'])

const reportScopedOrder = {
  order_id: 'ORDER-REPORT-1',
  emr_context: { visit_id: 'VISIT-1', vn: 'VN-1' },
  visit: { visit_id: 'VISIT-FALLBACK', vn: 'VN-FALLBACK' },
  items: [{ section: { code: 'BC' } }],
}
assert.strictEqual(s.orderReportReady(reportScopedOrder), true)
const reportParams = s.orderReportParams(reportScopedOrder)
assert.strictEqual(reportParams.order_id, 'ORDER-REPORT-1')
assert.strictEqual(reportParams.visit_id, 'VISIT-1')
assert.strictEqual(reportParams.section_code, 'BC')
assert(reportParams.printed_by)
assert(reportParams.printed_at)
assert.strictEqual(s.orderReportReady({ ...reportScopedOrder, emr_context: {}, visit: {} }), false)

s.openEmr(reportScopedOrder)
assert.strictEqual(opened[1][0], '6a96557e422c1ca959829eae')
assert.strictEqual(opened[1][2], '')
assert.strictEqual(opened[1][4].params.lab_deep_link, true)
assert.strictEqual(opened[1][4].params.visit_id, 'VISIT-1')
assert.strictEqual(Object.prototype.hasOwnProperty.call(opened[1][4].params, 'vn'), false)
assert.strictEqual(opened[1][4].params.source, 'lab-worklist')

const openedBeforeMissingVisit = opened.length
s.openEmr({ emr_context: { visit_id: '', vn: 'VN-2' } })
assert.strictEqual(opened.length, openedBeforeMissingVisit)
assert(String(notifications.at(-1)[0]).includes('ไม่มี Visit ID'))

const rejectItem = {
  item_id: '444444444444444444444444',
  item_code: '1034CD',
  item_name: 'Gamma GT',
  current_status: 'sent',
  section: { code: 'BC', name: 'Biochemistry' },
  specimen: { ordered: { source_code: 'CD', source: 'Clotted blood' } },
}
const rejectOrder = {
  order_id: '555555555555555555555555',
  order_number: 'R2608310004',
  patient: { hn: '6900001', prename: 'น.ส.', first_name: 'ดำ', last_name: 'ใจดี' },
  visit: { clinic: '19.p คลินิกวัคซีน' },
  finance: { coverage: 'UCS', total_amount: 100, paid_amount: 100 },
  items: [rejectItem],
}
s.orders = [rejectOrder]
s.selected = {}
s.toggleItem(rejectOrder,rejectItem.item_id)
s.rejectSelected(rejectOrder)
const rejectPopup = opened.at(-1)
assert.strictEqual(rejectPopup[0], '6a7713fdcc7d0a8451130331')
assert.strictEqual(rejectPopup[1], null)
assert.strictEqual(rejectPopup[3].source_order_id, rejectItem.item_id)
assert.strictEqual(rejectPopup[3].order_group_id, rejectOrder.order_number)
assert.strictEqual(rejectPopup[3].lab_section, 'BC')
assert.strictEqual(rejectPopup[3].rejection_status, 'recorded')
assert.strictEqual(rejectPopup[4].params.item_id, rejectItem.item_id)
assert.strictEqual(rejectPopup[4].params.order_id, rejectOrder.order_id)
assert.deepStrictEqual(rejectPopup[4].beforeSaveCallback(), {
  source_order_id: rejectItem.item_id,
  order_group_id: rejectOrder.order_number,
  lab_section: 'BC',
  rejection_status: 'recorded',
})
await rejectPopup[4].afterSaveCallback({ data: {
  _id: { $oid: '666666666666666666666666' },
  reject_reason_code: 'specimen_insufficient',
  reject_reason_detail: 'ปริมาณไม่พอ',
} })
const rejectCall = processCalls.find(call => call.id === '6a79ff46d5218a5b6a26bebc')
assert(rejectCall)
assert.deepStrictEqual(rejectCall.params, {
  action: 'reject_item',
  item_id: rejectItem.item_id,
  rejection_record_id: '666666666666666666666666',
  order_id: rejectOrder.order_id,
  order_number: rejectOrder.order_number,
  section_code: 'BC',
})
assert.strictEqual(rejectItem.current_status, 'rejected')
assert.strictEqual(rejectItem.work_status, 'rejected')
assert.strictEqual(rejectItem.reject_reason, 'ปริมาณไม่พอ')
assert.strictEqual(s.isSelected(rejectItem.item_id), false)
assert.strictEqual(s.rejectLoading, false)
assert.strictEqual(subFormCloseCount, 1)

const cancelWaiting = {
  item_id: '777777777777777777777777',
  current_status: 'sent',
  section: { code: 'BC' },
}
const cancelReceived = {
  item_id: '888888888888888888888888',
  current_status: 'accepted',
  section: { code: 'BC' },
}
const cancelOrder = {
  order_id: '999999999999999999999999',
  order_number: 'R2609010001',
  items: [cancelWaiting, cancelReceived],
}
assert.strictEqual(s.canCancelOrder(cancelOrder), true)
assert.strictEqual(s.canCancelOrder({ ...cancelOrder, items: [{ current_status: 'resulted' }] }), false)
assert.strictEqual(s.canCancelOrder({ ...cancelOrder, items: [{ current_status: 'cancelled' }] }), false)
s.openCancelOrder(cancelOrder)
assert.strictEqual(s.cancelDialog.visible, true)
assert.strictEqual(s.cancelDialog.order, cancelOrder)
s.cancelDialog.reason = 'แพทย์ยกเลิกการตรวจทั้งใบ'
await s.submitCancelOrder()
const cancelCall = processCalls.find(call => call.params.action === 'cancel_order')
assert(cancelCall)
assert.strictEqual(cancelCall.id, '6a9434c3422c1ca959829d5e')
assert.deepStrictEqual(cancelCall.params, {
  action: 'cancel_order',
  organization_code: '10',
  order_id: cancelOrder.order_id,
  order_number: cancelOrder.order_number,
  cancel_reason: 'แพทย์ยกเลิกการตรวจทั้งใบ',
})
for (const cancelledItem of cancelOrder.items) {
  assert.strictEqual(cancelledItem.current_status, 'cancelled')
  assert.strictEqual(cancelledItem.work_status, 'cancelled')
  assert.strictEqual(cancelledItem.cancel_reason, 'แพทย์ยกเลิกการตรวจทั้งใบ')
  assert.strictEqual(cancelledItem.cancelled_by.name, 'Earn Admin')
}
assert.strictEqual(s.cancelDialog.visible, false)
assert.strictEqual(s.cancelDialog.loading, false)
assert(!widget.content.includes('explainWriteBlock'), 'cancel order must call its write action')

const cpoe = read('Form-Builder/SDForm/sdform_module/EMR_form/CPOE_app.json')
const patientHeader = named(cpoe, 'pt_header')
const itemScreen = named(cpoe, 'item_screen')
assert(patientHeader.content.includes('cpoe-vn-picker'))
assert(patientHeader.content.includes('ค้นหาด้วย HN, VN หรือชื่อผู้ป่วย'))
assert(patientHeader.onCreated.includes("action:'list_open_visits'"))
assert(!patientHeader.onCreated.includes("providerId:'6a40fdec4b6dfdf45acbfbce'"))
assert(itemScreen.onCreated.includes('setPatientContext'))
assert(itemScreen.onCreated.includes('const LAB_SCOPE'))
assert(itemScreen.onCreated.includes('LAB_SECTION_CODES'))

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
