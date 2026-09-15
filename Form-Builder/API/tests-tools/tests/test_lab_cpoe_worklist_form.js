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
assert(worklist.formConfig.cssCode.includes('.lab-specimen-select.lab-specimen-changed .el-select__selected-item{color:var(--danger);font-weight:700}'))
assert(widget.content.includes('<div class="lab-item-grid lab-item-head"'), 'expanded Order must show the Item column header')
assert(widget.content.includes('aria-label="เลือกทุกรายการที่รอรับ" @change="toggleAll(order)"'))
assert(widget.content.includes('<div>ลำดับ</div><div>Lab no.</div><div>รายการสั่งตรวจ</div><div>specimen</div>'))
assert(widget.content.includes('<div>เวลาเก็บ specimen</div><div>เวลารับ specimen</div><div>สถานะ</div><div>เหตุผล</div><div>ผู้ดำเนินการ</div>'))
assert(widget.content.includes('{{ actionReasonText(item) }}'))
assert(widget.content.includes('{{ actionActorText(item) }}'))
assert(widget.content.includes('v-for="step in orderStatusCounts(order)"'))
assert(widget.content.includes('<i class="lab-order-status-dot" aria-hidden="true"></i><b>{{ step.count }}</b>'))
assert(!widget.content.includes('<i class="lab-order-status-dot" aria-hidden="true"></i>{{ statusText(orderStatus(order)) }}'), 'Order status must show Item counts rather than a repeated status label')
assert(!widget.content.includes('class="lab-state-dot"'), 'the dot pattern belongs to Order status, not Item status')
assert(widget.onCreated.includes('s.orderStatusCounts=o=>'))
assert(widget.onCreated.includes('s.orderStatusCountAria=o=>'))
assert(worklist.formConfig.cssCode.includes('.lab-order-status-step.is-waiting .lab-order-status-dot{background:#fadb14}'))
assert(worklist.formConfig.cssCode.includes('.lab-order-status-step.is-received .lab-order-status-dot{background:#e6a23c}'))
assert(worklist.formConfig.cssCode.includes('.lab-order-status-step.is-partial .lab-order-status-dot{background:var(--el-color-success-light-3,#95d475)}'))
assert(worklist.formConfig.cssCode.includes('.lab-order-status-step.is-complete .lab-order-status-dot{background:#67c23a}'))
assert(worklist.formConfig.cssCode.includes('.lab-order-status-step.is-cancelled .lab-order-status-dot{background:#f56c6c}'))
assert(worklist.formConfig.cssCode.includes('.lab-inline-tag,.lab-state-tag{display:inline-flex;min-height:20px'))
assert(worklist.formConfig.cssCode.includes('.lab-state-tag.status-waiting{border-color:#fadb14'))
assert(worklist.formConfig.cssCode.includes('.lab-state-tag.status-received{border-color:#e6a23c'))
assert(worklist.formConfig.cssCode.includes('.lab-state-tag.status-result-partial{border-color:var(--el-color-success-light-3,#95d475)'))
assert(worklist.formConfig.cssCode.includes('.lab-state-tag.status-result-complete{border-color:#67c23a'))
assert(worklist.formConfig.cssCode.includes('.lab-state-tag.status-cancelled{border-color:#f56c6c'))
assert(widget.onCreated.includes("{key:'waiting',label:'รอรับ'}"))
assert(widget.onCreated.includes("{key:'received',label:'รับแล้ว'}"))
assert(widget.onCreated.includes("{key:'partial',label:'ออกผลบางส่วน'}"))
assert(widget.content.includes('class="lab-status-legend" aria-label="คำอธิบายสีสถานะ"'))
for (const label of ['รอรับ', 'รับแล้ว', 'ออกผลบางส่วน', 'ออกผลครบ', 'ยกเลิก / ปฏิเสธ']) {
  assert(widget.content.includes(`<span>${label}</span>`), `status legend must explain ${label}`)
}
assert(widget.onCreated.includes("waiting:['sent']"))
assert(widget.onCreated.includes("received:['accepted','prepared','ready','dispensed']"))
assert(widget.onCreated.includes("partial:['resulted']"))
assert(widget.onCreated.includes("accepted:'รับแล้ว'"))
assert(!widget.onCreated.includes("accepted:'รับแล้ว · รอผล'"))
assert(widget.content.includes(':loading="createOrderLoading"'))
assert(!worklist.formConfig.cssCode.includes('.lab-create-button{margin-left:auto}'), 'Create button must stay beside Report')
assert(widget.onCreated.includes("specimen_insufficient:'ปริมาณสิ่งส่งตรวจไม่เพียงพอ'"))
assert(!widget.content.includes('<div data-label="ผลตรวจ">'), 'Order tab must not contain Item-level result actions')
assert(widget.content.includes('v-for="(item,index) in resultItems(order)"'))
assert(widget.content.includes('@click="openResult(item,order,false)">แก้ไขผล</el-button>'))
assert(widget.content.includes('@click="openOrderResults(order)">ดูผล</el-button>'), 'Order-row shortcut must open the complete Order result view')
assert(widget.content.includes("detailTab(order)==='results' ? 'ดูผล' : 'HN'"), 'Order-row action heading must follow the active detail tab')
assert(widget.content.includes('<div>ลำดับ</div><div>รายการสั่งตรวจ</div><div>เวลาออกผล</div><div>ผลตรวจ</div><div>สถานะ</div>'))
assert(widget.content.includes('{{ resultTime(item) }}'))
assert(widget.content.includes('{{ criticalText(item) }}'))
assert(!widget.content.includes('<div class="lab-result-list-head"><div>ลำดับ</div><div>รายการสั่งตรวจ</div><div>LAB NO.</div>'))
assert(!widget.content.includes(':disabled="!canOpenResultTab(order)"'), 'result tab must be available before results exist')
assert(widget.onCreated.includes("'ผลตรวจทางห้องปฏิบัติการ'"))
assert(widget.content.includes("'แก้ไขผลตรวจทั้งหมด'"))
assert(widget.content.includes('width="min(1040px,calc(100vw - 32px))"'))
assert(widget.content.includes('class="lab-result-title-row"'))
assert(widget.content.includes('class="lab-result-edit-button"'))
assert(widget.content.includes('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5'))
assert(widget.content.includes("{{ resultHidden() ? 'ยกเลิกปกปิด' : 'ปกปิดผล' }}"))
assert(widget.content.includes("'ยืนยันปกปิดผล' : 'ยืนยันยกเลิกการปกปิดผล'"))
assert(widget.content.includes('การปกปิดจะไม่ล้างสถานะหรือ workflow แจ้งค่าวิกฤติ'))
assert(widget.content.includes('v-model="visibilityDialog.reason"'))
assert(widget.onCreated.includes('กรุณาระบุเหตุผล'))
assert(widget.content.includes('@click="openResult(item,order,false)"'))
assert(!widget.content.includes('class="lab-result-patient-card"'), 'result popup must not repeat the patient summary card removed by the approved mockup')
assert(!widget.content.includes("{{ manual.data.patient_name || 'ไม่พบชื่อผู้ป่วย' }}"))
assert(widget.content.includes("{{ manual.data.patient_hn || '-' }}"))
assert(widget.content.includes('class="lab-result-value-head"'))
assert(!widget.content.includes('ผลการตรวจ {{ resultRowsForDisplay().length }} รายการ'))
assert(widget.content.includes('<span>#</span><span><span class="lab-sr-only">สถานะ</span></span><span>รายการ</span><span title="ประวัติค่าที่เคยบันทึกของ Item นี้ · อ่านอย่างเดียว">ค่าก่อนหน้า</span><span>ค่าที่ตรวจได้</span><span>unit</span><span>แปลผล</span><span>ค่าปกติ</span>'))
assert(widget.content.includes('class="lab-result-profile-row"'))
assert(widget.content.includes('v-for="group in resultGroupsForDisplay()"'), 'Order result view must render one Parent header per ordered Item')
assert(widget.content.includes('v-for="(result,index) in group.results"'), 'each Parent header must render every returned child result')
assert(widget.content.includes("{{ group.test_name || '-' }}"))
assert(widget.content.includes('{{ result.test_name || group.test_name || \'-\' }}'))
assert(widget.content.includes('{{ resultTestCount() }} tests'))
assert(widget.content.includes('ยังไม่มีผลตรวจ · รอผลจาก LIS หรือกดดินสอเพื่อกรอกผล'))
assert(!widget.content.includes('ยังไม่มีผลตรวจ · รอผลจาก Agent/LIS'))
for (const repeatedLabel of ['ลำดับ', 'รายการตรวจ', 'ผลก่อนหน้า', 'ผลปัจจุบัน', 'หน่วย']) {
  assert(!widget.content.includes(`<div><span>${repeatedLabel}</span>`), `result row must not repeat the ${repeatedLabel} label`)
}
assert(widget.onCreated.includes('s.resultContext=(item,order)=>'))
assert(widget.onCreated.includes('s.resultRowsForDisplay=()=>'))
assert(widget.onCreated.includes('s.resultGroupsForDisplay=()=>'))
assert(widget.onCreated.includes('s.resultTestCount=()=>'))
assert(widget.onCreated.includes('s.resultGroup=(item,order,data)=>'))
assert(widget.onCreated.includes('s.groupOrderResultGroups=groups=>'))
assert(widget.onCreated.includes('s.loadOrderResultGroup=async(item,order)=>'))
assert(widget.onCreated.includes('s.openOrderResults=async order=>'))
assert(widget.onCreated.includes('const loadedGroups=await Promise.all(items.map(item=>s.loadOrderResultGroup(item,order)))'))
assert(widget.onCreated.includes('const groups=s.groupOrderResultGroups(loadedGroups)'))
assert(!widget.onCreated.includes('s.openFirstOrderResult=order=>'))
assert(widget.onCreated.includes('s.openResultVisibilityDialog=()=>'))
assert(widget.onCreated.includes('s.submitResultVisibility=async()=>'))
assert(widget.onCreated.includes("action:'set_result_visibility'"))
assert(widget.onCreated.includes('const fallback=s.resultContext(item,order)'))
assert(widget.onCreated.includes('const merged={...fallback,...d'))
assert(widget.content.includes('v-if="!manual.orderView && hasPersistedResult()"'), 'Item hide/unhide must remain scoped to an Item result')
assert(widget.content.includes('v-if="manual.orderView" class="lab-result-attachments"'), 'Upload UI must exist only in the Order result popup')
assert(!widget.content.includes('อัปโหลดไฟล์จากปุ่มดูผลระดับรายการ'))
assert(widget.onCreated.includes("attachment_scope:'order'"), 'Upload persistence must use the Order attachment scope')
assert(worklist.formConfig.cssCode.includes('.lab-result-value-head,.lab-result-value-row{'))
assert(worklist.formConfig.cssCode.includes('.lab-result-hidden-tag{'))
assert(worklist.formConfig.cssCode.includes('.lab-result-hidden-notice{'))
assert(worklist.formConfig.cssCode.includes('.lab-visibility-summary{'))
assert(worklist.formConfig.cssCode.includes('.lab-result-dialog .el-dialog__body{max-height:calc(100vh - 160px);padding:18px;overflow:auto;overscroll-behavior:contain}'))
assert(worklist.formConfig.cssCode.includes('.lab-result-value-head,.lab-result-value-row{grid-template-columns:56px 48px minmax(180px,1fr) 132px 132px 94px 104px 188px;gap:0;min-width:940px;padding:0}'))
assert(worklist.formConfig.cssCode.includes('.lab-result-value-head{min-height:42px;align-items:center;background:var(--fill-soft)}'))
assert(worklist.formConfig.cssCode.includes('.lab-result-profile-row{display:flex;min-width:940px;min-height:40px;align-items:center;padding:5px 10px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--fill-light)}'))
assert(!worklist.formConfig.cssCode.includes('.lab-result-value-row.is-pending>div{background:#fffaf2}'))
assert(worklist.formConfig.cssCode.includes('.lab-result-signal{display:block;width:10px;height:10px;margin-left:7px;border:1px solid;border-radius:50%}'))
assert(worklist.formConfig.cssCode.includes('.lab-result-signal.is-normal{border-color:#4e9631;background:#2f761e;box-shadow:0 0 0 3px rgba(103,194,58,.10)}'))
assert(worklist.formConfig.cssCode.includes('.lab-result-signal.is-critical{border-color:#d46a6a;background:#b84d4d;box-shadow:0 0 0 3px rgba(245,108,108,.12)}'))
assert(widget.content.includes('v-if="hasResultValue(result)" class="lab-result-signal"'))
assert(widget.onCreated.includes("s.resultSignalClass=result=>result&&result.is_critical===true?'is-critical':'is-normal'"))
assert(widget.onCreated.includes("s.resultSignalText=result=>result&&result.is_critical===true?'ค่าวิกฤติ':'ไม่มีค่าวิกฤติ'"))
// 2026-09-02: prior result is longitudinal (previous encounter), not correction history.
assert(widget.content.includes('>ค่าก่อนหน้า</span>'))
assert(widget.content.includes('<span>ค่าที่ตรวจได้</span>'))
assert(widget.content.indexOf('>ค่าก่อนหน้า</span>') < widget.content.indexOf('<span>ค่าที่ตรวจได้</span>'))
assert(!widget.content.includes('ประวัติการแก้ไข (อ่านอย่างเดียว)'))
assert(!widget.content.includes('แก้ไขโดย {{ result.last_edited_by }}'), 'approved result popup does not show row-level audit text')
assert(widget.content.includes('v-model="manual.editMap[result._edit_key].unit"'))
assert(widget.content.includes('v-model="manual.editMap[result._edit_key].reference_range"'))
assert(widget.content.includes('manual.editing && manual.editMap[result._edit_key]'), 'Order and Item rows must bind to their own editable values')
assert(widget.content.includes('ค่า Critical คงใช้ค่าที่ Agent/LIS ส่งมา'))
assert(widget.content.includes('class="lab-result-attachments"'))
assert(widget.content.includes('ไฟล์แนบผลตรวจ'))
assert(widget.content.includes('>Upload file</el-button>'))
assert(widget.content.indexOf('class="lab-result-attachments"') > widget.content.indexOf('class="lab-result-values"'), 'upload must stay below the result table')
assert(widget.content.includes(':action="resultUploadAction()"'))
assert(widget.content.includes('PDF / JPG / JPEG / PNG'))
assert(widget.content.includes('<div>ผู้ป่วย</div><div></div><div>รายการ</div>'))
assert(widget.content.includes('v-if="hasPriorMedication(order)" class="lab-prior-medication"'))
assert(widget.content.includes('💊 {{ priorMedicationText(order) }}'))
assert(!widget.content.includes('🟡'), 'prior medication marker must not include the trailing yellow circle')
assert(widget.onCreated.includes("s.hasPriorMedication=o=>s.optionCode(o&&o.prior_medication)==='2'"))
assert(worklist.formConfig.cssCode.includes('.lab-prior-medication{'))
assert(widget.content.includes('v-if="coverageAbbrev(order)" class="lab-inline-tag lab-meta-pill lab-coverage-pill"'))
assert(widget.content.includes('{{ coverageAbbrev(order) }}'))
assert(widget.content.includes('v-if="showPaid(order)" class="lab-inline-tag lab-meta-pill lab-payment-pill"'))
assert(!widget.content.includes('v-if="isPaid(order)" class="lab-inline-tag lab-meta-pill lab-payment-pill"'))
assert(worklist.formConfig.cssCode.includes('.lab-context-top .lab-coverage-pill{border-color:var(--el-color-warning-light-5,#f3d19e);background:var(--warning-50);color:var(--warning)}'))
assert(worklist.formConfig.cssCode.includes('grid-template-columns:32px minmax(210px,1.45fr) minmax(220px,1.45fr) 78px 90px'))
assert(widget.content.includes(":class=\"{'is-selectable':item.current_status==='sent','is-selected':isSelected(item.item_id)}\""))
assert(widget.content.includes('@click="selectRow(order,item,$event)"'))
assert(widget.onCreated.includes('s.selectRow=(order,item,event)=>'))
assert(widget.content.includes('class="lab-patient-row" @click="toggleOrderFromRow(order,$event)"'))
assert(widget.onCreated.includes('s.toggleOrderFromRow=(order,event)=>'))
assert(worklist.formConfig.cssCode.includes('.lab-patient-row{') && worklist.formConfig.cssCode.includes('cursor:pointer'))
assert(widget.content.includes(':model-value="allSelectableChecked(order)"'))
assert(widget.content.includes(':indeterminate="someSelectableChecked(order)"'))
assert(widget.content.includes(':disabled="!selectableItems(order).length"'))
assert(widget.content.includes('aria-label="เลือกทุกรายการที่รอรับ" @change="toggleAll(order)"'))
assert(worklist.formConfig.cssCode.includes('.lab-item-row.is-selectable{cursor:pointer}'))
assert(widget.content.includes('<div class="lab-item-check-cell"><el-checkbox'))
assert(widget.content.includes('<div data-label="เลือก" class="lab-item-check-cell"><el-checkbox'))
assert(worklist.formConfig.cssCode.includes('.lab-item-grid-wrap{overflow-x:auto;margin-left:-42px;padding-top:0}'))
assert(worklist.formConfig.cssCode.includes('grid-template-columns:42px 52px 100px'))
assert(worklist.formConfig.cssCode.includes('min-width:1210px;padding:6px 0}.lab-item-head{min-height:44px'))
assert(worklist.formConfig.cssCode.includes('.lab-item-check-cell{position:sticky;left:0;z-index:2'))
assert(worklist.formConfig.cssCode.includes('.lab-result-list{padding-top:0;overflow-x:auto;margin-left:-42px}'))
assert(worklist.formConfig.cssCode.includes('min-width:772px;padding:6px 0 6px 42px}.lab-result-list-head{min-height:44px'))
assert(worklist.formConfig.cssCode.includes('.dark .lab-cpoe{--lab-wait-bg:rgba(250,219,20,.14);--lab-wait-text:#ffe45c}'))
assert(widget.content.includes('<el-button size="small" type="success" :loading="receiveLoading"'))
assert(widget.content.includes('<el-button size="small" type="warning" :loading="rejectLoading"'))
assert(widget.content.includes('<el-button size="small" type="danger" :loading="cancelDialog.loading&&cancelDialog.order===order"'))
assert(!widget.content.includes('type="warning" plain :loading="rejectLoading"'))
assert(!widget.content.includes('type="danger" plain :loading="cancelDialog.loading&&cancelDialog.order===order"'))
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
assert(widget.content.includes(':key="order.row_key||order.order_id"'))
assert(widget.content.includes('isExpanded(order)'))
assert(widget.onCreated.includes('s.orderRowKey=o=>'))
assert(widget.content.includes('v-if="!isCancelledOrder(order)" class="lab-plain-action" size="small"'))
// 2026-09-02: user approved binding the verified live Report ID; PDF must now be row-scoped.
assert(!widget.content.includes("@click=\"notifyPending('PDF ใบสั่งตรวจ')\""))
assert(widget.content.includes('<sd-report'), 'Worklist must bind the verified LAB Order Report')
assert(widget.content.includes('v-if="!isCancelledOrder(order)&&orderReportReady(order)"'))
assert(widget.content.includes('title="Order นี้ไม่มี Order ID, Visit ID หรือ LAB Section สำหรับสร้าง PDF"'))
assert(widget.content.includes('v-if="!isCancelledOrder(order)&&hnOrderReportReady(order)"'))
assert(widget.content.includes(':report-list="hnOrderReportList" :params="hnOrderReportParams(order)"'))
// ข้อความ disabled เปลี่ยนตามเงื่อนไขใหม่ 2026-09-04: กันที่ HN ไม่ใช่ Visit ID แล้ว
assert(widget.content.includes('title="Order นี้ไม่มี HN สำหรับสร้างป้ายติดแฟ้ม">HN</el-button>'))
assert(widget.content.includes(":aria-label=\"'ดูผลของ '+(text(order.patient&&order.patient.hn)||'Order นี้')\""))
/* เปลี่ยน assertion เดิม 2026-09-04 ตามคำสั่งผู้ใช้: ปุ่มตรวจใหม่ต้องเรียก write action จริง
   และยังอยู่เฉพาะตำแหน่งเดิมบนแถวที่ยกเลิก/ปฏิเสธ */
assert(widget.content.includes('@click="retestOrder(order)">ตรวจใหม่</el-button>'))
assert(widget.content.includes(':loading="isRetesting(order)" :disabled="isRetesting(order)"'))
assert(widget.content.includes('v-if="!isCancelledOrder(order)" class="lab-plain-action" size="small" @click="openEmr(order)">EMR</el-button>'))
assert(widget.content.includes('<span v-else class="lab-action-placeholder" aria-hidden="true"></span>'))
assert(widget.content.includes("{{ statusKey==='cancelled' ? 'ดำเนินการ' : 'PDF' }}"))
assert(widget.onCreated.includes("s.isCancelledOrder=o=>['cancelled','rejected'].includes(s.orderStatus(o))"))
assert(widget.onCreated.includes("const ORDER_REQUEST_REPORT_ID='6a977ac8422c1ca959829f97'"))
assert(widget.onCreated.includes("s.orderRequestReportList=ORDER_REQUEST_REPORT_ID?[{reportId:ORDER_REQUEST_REPORT_ID,label:'PDF',type:'pdf'}]:[]"))
/* เปลี่ยน assertion เดิม 2026-09-04 ตามคำสั่งผู้ใช้ ("เอาเข้า lab ให้ด้วย"):
   ปุ่ม HN ของ LAB ย้ายจาก `5256d813009293b480d0a15c` (ป้ายติดแฟ้ม/VN · รับ xparentx)
   ไปเป็น `ป้ายติดแฟ้ม (HN)` `6a9a355c422c1ca95982a1a2` (รับ hn อย่างเดียว)
   เหมือนที่ฝั่ง X-ray ย้ายไปแล้วในวันเดียวกัน */
assert(widget.onCreated.includes("const HN_ORDER_REPORT_ID='6a9a355c422c1ca95982a1a2'"))
assert(!widget.onCreated.includes('5256d813009293b480d0a15c'), 'LAB ต้องไม่เรียกป้ายตัวเดิมแล้ว')
assert(widget.onCreated.includes("s.hnOrderReportList=HN_ORDER_REPORT_ID?[{reportId:HN_ORDER_REPORT_ID,label:'HN',type:'pdf'}]:[]"))
assert(widget.onCreated.includes('s.orderVisitId=o=>'))
assert(widget.onCreated.includes('s.orderReportReady=o=>'))
assert(widget.onCreated.includes('s.reportSectionCode=o=>'))
assert(widget.onCreated.includes('s.orderReportParams=o=>'))
assert(widget.onCreated.includes('order_id:s.text(o&&o.order_id)'))
assert(widget.onCreated.includes('visit_id:s.orderVisitId(o)'))
assert(widget.onCreated.includes('section_code:s.reportSectionCode(o)'))
assert(widget.onCreated.includes('s.hnOrderReportReady=o=>'))
assert(widget.onCreated.includes('s.hnOrderReportParams=o=>({hn:s.text(o&&o.patient&&o.patient.hn)})'),
  'ป้ายใหม่รับ hn อย่างเดียว ⇒ ห้ามส่ง xparentx ต่อ')
assert(!widget.onCreated.includes('({xparentx:s.orderVisitId(o)})'))
// s.orderVisitId ยังต้องอยู่ครบ — EMR History และ PDF ใบสั่งตรวจยังใช้อยู่
assert(widget.onCreated.includes('s.orderVisitId=o=>'))
assert(widget.onCreated.includes('s.retestOrder=order=>'))
assert(widget.onCreated.includes("action:'retest_order'"))
assert(widget.onCreated.includes('section_codes:[sectionCode]'))
assert(!widget.onCreated.includes('s.mockRetest=order=>'))
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
assert(widget.onCreated.includes('if(allCompletedHistory)p.all_dates=true'))
assert(widget.onCreated.includes("s.filters={hn:'',dates:[s.currentDay,s.currentDay]}"))
assert(widget.onCreated.includes('s.bangkokToday=()=>'))
assert(widget.onCreated.includes('dayChanged=nextDay!==s.currentDay'))
assert(widget.onCreated.includes("s.applyFilters=()=>{s.scanMode=false;s.scannedHn=''"))
assert(widget.onCreated.includes('s.performReceive=async(order,items)=>'))
assert(widget.onCreated.includes('s.receiveGroups=items=>'))
assert(widget.onCreated.includes('s.dispatchAgentInBackground=(items,receiveData)=>'))
assert(widget.onCreated.includes('if(itemIds.length>1)receiveParams.item_ids=itemIds'))
assert(widget.onCreated.includes('if(itemIds.length>1)dispatchParams.item_ids=itemIds'))
assert(widget.onCreated.includes("dispatch_mode:'deferred'"))
assert(widget.onCreated.includes("dispatch_mode:'sync'"))
assert(widget.onCreated.includes('agent_dispatch_queued===true'))
assert(widget.onCreated.includes('s.receiveSelected=order=>'))
assert(!widget.onCreated.includes('await field.confirm('), 'initCraft confirm is callback-based in the deployed runtime')
assert(widget.onCreated.includes('()=>s.performReceive(order,items)'))
assert(widget.onCreated.includes('s.selectedItems=order=>'))
assert(widget.onCreated.includes('s.canReceiveOrder=order=>'))
assert(widget.onCreated.includes('for(let index=0;index<groups.length;index++)'))
assert(widget.onCreated.includes('s.rejectSelected=order=>'))
assert(widget.content.includes('@click="openCancelOrder(order)">ยกเลิก order</el-button>'))
assert(widget.content.includes('ระบบจะยกเลิกเฉพาะ LAB Item ของ Section นี้ใน Order เดิม'))
assert(widget.content.includes('@click="submitCancelOrder">ยืนยันยกเลิก Section นี้</el-button>'))
assert(widget.content.includes('v-model="cancelDialog.reason" filterable clearable'))
assert(widget.content.includes('v-for="option in rejectReasonOptions"'))
assert(!widget.content.includes('v-model="cancelDialog.reason" type="textarea"'), 'Cancel must reuse the Reject reason dropdown')
assert(widget.content.includes('ถ้ารายการถูกส่งไป Agent/LIS แล้ว ระบบจะหยุดและไม่ยกเลิกเฉพาะฝั่ง HIS'))
assert(widget.onCreated.includes('s.canCancelOrder=order=>'))
assert(widget.onCreated.includes('s.openCancelOrder=order=>'))
assert(widget.onCreated.includes('ยกเลิก Section นี้ได้เฉพาะรายการที่ยังรอรับหรือรับแล้วแต่ยังไม่ส่ง Agent/LIS'))
assert(!widget.onCreated.includes('ยกเลิกทั้ง Order ได้เฉพาะรายการที่ยังรอรับ'))
assert(widget.onCreated.includes('s.submitCancelOrder=async()=>'))
assert(widget.onCreated.includes("action:'cancel_order'"))
assert(widget.onCreated.includes('section_codes:[s.reportSectionCode(order)]'))
assert(widget.onCreated.includes('const REJECT_REASON_OPTIONS=Object.keys(REJECT_REASON_LABELS)'))
assert(widget.onCreated.includes('reason=REJECT_REASON_LABELS[reasonCode]||reasonCode'))
assert(worklist.formConfig.cssCode.includes('.lab-status-chip{--chip-color:#73767a;--chip-border:var(--primary)'))
assert(worklist.formConfig.cssCode.includes('[data-status="waiting"]{--chip-color:#fadb14'))
assert(worklist.formConfig.cssCode.includes('[data-status="received"]{--chip-color:#e6a23c'))
assert(worklist.formConfig.cssCode.includes('[data-status="partial"]{--chip-color:var(--el-color-success-light-3,#95d475)'))
assert(worklist.formConfig.cssCode.includes('[data-status="complete"]{--chip-color:#67c23a'))
assert(worklist.formConfig.cssCode.includes('[data-status="cancelled"]{--chip-color:#f56c6c'))
/* 2026-09-08 user-approved behavior: LAB NO. must render before the separate
   Agent request finishes; Outbound remains durable when transport fails. */
assert(widget.onCreated.includes('ส่ง Agent เป็นชุดเดียว'))
assert(widget.onCreated.includes('รวมรายการ specimen เดียวกันส่ง Agent เป็นชุดเดียว'))
assert(widget.onCreated.includes('หน้าจอไม่ต้องรอ Agent ตอบ'))
assert(widget.onCreated.includes('Outbound จะยังอยู่ให้ตรวจสอบและส่งใหม่'))
assert(widget.onCreated.includes("api.runProcess(id,params||{}"))
assert(!widget.onCreated.includes('globalThis.fetch('), 'Form must retain the original working Process connector')

;(async () => {
const opened = []
const notifications = []
const processCalls = []
const confirmations = []
let subFormCloseCount = 0
const originalFetch = globalThis.fetch
globalThis.fetch = async (url, options) => {
  const id = String(url).split('/').pop()
  const body = JSON.parse(options.body || '{}')
  const params = body.params || {}
  processCalls.push({ id, params, authorization: options.headers && options.headers.Authorization })
  let data
  if (params.action === 'list_open_visits') {
    const visits = params.hn === '6900999' ? [] : [{
      _id: 'VISIT-6900027',
      vn: '6900247',
      visit_date: '2026-09-09',
      visit_type: { value: '4', label: 'มาตรวจ' },
      visit_clinic: { value: '19.P', label: '19.p คลินิกวัคซีน' },
      visit_doctor: { value: 'DOC-1', label: 'แพทย์ทดสอบ' },
      inscl_hos: [{ inscl_item_main: { value: 'OFC', label: 'ข้าราชการ' } }],
      pid: { value: 'PERSON-6900027', hn: '6900027', prename: { label: 'น.ส.' }, p_fname: 'กนกวงศ์', p_lname: 'จวบสมบัติ', p_gender: '2', age: '34', p_abogroup: 'B' },
    }]
    data = { success: true, data: { visits, total: visits.length, visit_date: '2026-09-09', section_codes: ['BC'] } }
  } else if (params.action === 'retest_order') {
    data = { success: true, message: 'เปิดตรวจใหม่แล้ว 2 รายการ · กลับไปสถานะรอรับ · LAB NO. ใหม่จะสร้างเมื่อกดรับ specimen', data: {
      order_id: params.order_id,
      order_number: params.order_number,
      section_code: params.section_codes[0],
      current_status: 'sent',
      work_status: 'waiting_receive',
      reopened_item_count: 2,
      cleared_lab_no_count: 1,
      pending_lab_no_count: 2,
      audit_sync_pending: false,
    } }
  } else if (params.action === 'cancel_order') {
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
  } else if (id === '6a94f634422c1ca959829d70' && params.dispatch_mode === 'sync') {
    const agentFailed = params.item_id === '444444444444444444444444'
    const receiveIds = Array.isArray(params.item_ids) && params.item_ids.length ? params.item_ids : [params.item_id]
    data = { success: true, message: agentFailed ? 'รับ specimen แล้ว แต่ส่ง Agent ไม่สำเร็จ' : 'Agent รับ Order เข้าคิวแล้ว', data: {
      item_id: params.item_id,
      item_ids: receiveIds,
      items: receiveIds.map(itemId => ({ item_id: itemId, current_status: 'accepted', lab_no: '1069000001', received_at: '2026-08-31 09:00:00', received_by: 'LAB-USER' })),
      receipt_batch_id: params.item_id,
      current_status: 'accepted',
      lab_no: '1069000001',
      received_at: '2026-08-31 09:00:00',
      received_by: 'LAB-USER',
      hl7_status: agentFailed ? 'new' : 'queued',
      agent_send_success: !agentFailed,
      agent_transport_state: agentFailed ? 'failed' : 'queued',
      agent_retryable: agentFailed,
      agent_message: agentFailed ? 'เชื่อมต่อ Agent ไม่สำเร็จ' : 'Agent รับ Order เข้าคิวแล้ว',
      transport_deferred: false,
    } }
  } else if (id === '6a94f634422c1ca959829d70') {
    const receiveIds = Array.isArray(params.item_ids) && params.item_ids.length ? params.item_ids : [params.item_id]
    data = { success: true, message: 'รับ specimen แล้ว · กำลังส่ง Agent เบื้องหลัง', data: {
      item_id: params.item_id,
      item_ids: receiveIds,
      items: receiveIds.map(itemId => ({ item_id: itemId, current_status: 'accepted', lab_no: '1069000001', received_at: '2026-08-31 09:00:00', received_by: 'LAB-USER' })),
      receipt_batch_id: params.item_id,
      outbound_order_id: params.item_id,
      current_status: 'accepted',
      lab_no: '1069000001',
      received_at: '2026-08-31 09:00:00',
      received_by: 'LAB-USER',
      hl7_status: 'new',
      agent_send_success: false,
      agent_dispatch_queued: true,
      agent_transport_state: 'pending_dispatch',
      agent_retryable: true,
      agent_message: 'รับ specimen แล้ว · กำลังส่ง Agent เบื้องหลัง',
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
  } else if (params.action === 'set_result_visibility') {
    data = { success: true, message: params.hidden ? 'บันทึกสถานะปกปิดผลแล้ว' : 'ยกเลิกการปกปิดผลแล้ว', data: {
      is_hide_result: params.hidden === true,
      result_visibility_action: params.hidden ? 'hide' : 'unhide',
      result_visibility_reason: params.reason,
      result_visibility_by: { id: 'USER-1', name: 'Earn Admin' },
      result_visibility_at: '2026-09-08 10:15:00',
    } }
  } else if (params.action === 'get_manual_result') {
    const isBiochemistry = params.item_id === 'BC-ITEM-1'
    data = { success: true, data: {
      item_id: params.item_id,
      section_code: isBiochemistry ? 'BC' : 'MY',
      patient_hn: 'HN-TEST',
      visit_vn: 'VN-NEW',
      test_code: isBiochemistry ? 'C23' : 'MY-CULTURE',
      test_name: isBiochemistry ? 'Glucose' : 'Fungal culture',
      lab_no: isBiochemistry ? 'BC2608310001' : 'MY2608310001',
      result_value: isBiochemistry ? '98' : '',
      unit: isBiochemistry ? 'mg/dL' : 'CFU/mL',
      interpretation: '',
      reference_range: isBiochemistry ? '70-100' : 'Not detected',
      is_hide_result: false,
      result_visibility_reason: '',
      result_visibility_by: null,
      result_visibility_at: '',
      result_attachments: isBiochemistry ? [{ name: 'result.pdf', size: 1024, url: 'https://files.test/result.pdf', response: { fileId: 'bbbbbbbbbbbbbbbbbbbbbbbb', fileName: 'result.pdf', filePath: 'https://files.test/result.pdf', fileType: 'pdf', mimetype: 'application/pdf', formId: '6a8d4334f851000f28e5025b' } }] : [],
      results: isBiochemistry ? [{ result_item_id: 'aaaaaaaaaaaaaaaaaaaaaaaa', test_code: 'C23', test_name: 'Glucose', result_value: '98', unit: 'mg/dL', interpretation: 'N', reference_range: '70-100', result_source: 'agent', is_critical: false }] : [],
      previous: { value: 'Candida albicans', entered_by: 'lab-old', source: 'manual' },
    } }
  } else if (params.action === 'save_manual_result') {
    data = { success: true, message: 'บันทึกผล Manual แล้ว', data: { result_status: 'entered', entered_at: '2026-08-31 15:02:30' } }
  } else if (params.action === 'save_result_edits') {
    data = { success: true, message: 'บันทึกผลที่แก้ไขแล้ว 1 รายการ', data: { results: params.results.map(row => ({ ...row, test_code: 'C23', test_name: 'Glucose', result_source: 'agent', is_critical: false })) } }
  } else if (params.action === 'save_result_attachments') {
    data = { success: true, message: 'บันทึกไฟล์แนบผลตรวจแล้ว', data: { result_report_id: 'cccccccccccccccccccccccc', result_attachments: params.result_attachments } }
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
  confirm: (message, callback, type, title) => {
    confirmations.push({ message, callbackType: typeof callback, type, title })
    return callback()
  },
  notify: (...args) => notifications.push(args),
}
new Function(widget.onCreated).call(field)
const s = field.vueState

/* Result marker represents clinical criticality, never workflow status. */
assert.strictEqual(s.hasResultValue({ result_value: '' }), false, 'pending result must not render a marker')
assert.strictEqual(s.hasResultValue({ result_value: '0' }), true, 'zero is a recorded result and must render a marker')
assert.strictEqual(s.resultSignalClass({ result_value: '120', is_critical: true }), 'is-critical')
assert.strictEqual(s.resultSignalClass({ result_value: '90', is_critical: false }), 'is-normal')
assert.strictEqual(s.resultSignalClass({ result_value: '90' }), 'is-normal', 'recorded result without a critical flag is non-critical')

/* เปลี่ยนตามคำสั่งผู้ใช้ 2026-09-03: ช่องไม่มีข้อมูลต้องว่าง ไม่ใช้ขีดแทน */
assert.strictEqual(s.datePart(''), '')
assert.strictEqual(s.timePart(null), '')
assert.strictEqual(s.compactDateTime(''), '')
assert.strictEqual(s.rejectReasonText({}), '')
assert.strictEqual(s.actionActorText({}), '')
assert.strictEqual(s.resultTime({}), '')

assert.strictEqual(s.ageText({ patient: { age: '3y 3m 3d' } }), '3y 3m 3d')
assert.strictEqual(s.hasPriorMedication({ prior_medication: '2', prior_specify: 'abacavir' }), true)
assert.strictEqual(s.hasPriorMedication({ prior_medication: 2, prior_specify: 'abacavir' }), true)
assert.strictEqual(s.hasPriorMedication({ prior_medication: { value: '2', label: 'ได้รับแล้ว' }, prior_specify: 'abacavir' }), true)
assert.strictEqual(s.hasPriorMedication({ prior_medication: '1', prior_specify: 'abacavir' }), false)
assert.strictEqual(s.hasPriorMedication({ prior_medication: '2', prior_specify: '' }), false)
assert.strictEqual(s.priorMedicationText({ prior_specify: 'abacavir' }), 'abacavir')
assert.strictEqual(s.coverageAbbrev({ finance: { coverage: [{ inscl_item_main: { value: 'OFC', label: 'OFC ข้าราชการ (ต่อเนื่อง)' }, inscl_item_sub: null }] } }), 'OFC')
assert.strictEqual(s.coverageAbbrev({ finance: { coverage: [{ inscl_item_main: { value: 'UCS', label: 'UCS หลักประกันสุขภาพ' } }] } }), 'UCS')
assert.strictEqual(s.coverageAbbrev({ finance: { coverage: '[{"inscl_item_main":{"value":"CASH","label":"CASH เงินสด"}}]' } }), '')
assert.strictEqual(s.coverageAbbrev({ finance: { coverage: [] } }), '')
assert.strictEqual(s.showPaid({ finance: { coverage: [{ inscl_item_main: { value: 'OFC' } }], total_amount: 100, paid_amount: 100 } }), false)
assert.strictEqual(s.showPaid({ finance: { coverage: [{ inscl_item_main: { value: 'CASH' } }], total_amount: 100, paid_amount: 100 } }), true)
assert.strictEqual(s.showPaid({ finance: { coverage: [], total_amount: 100, paid_amount: 100 } }), true)
assert.strictEqual(s.showPaid({ finance: { coverage: [{ inscl_item_main: { value: 'CASH' } }], total_amount: 100, paid_amount: 0 } }), false)
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
const orderCounts = s.orderStatusCounts({ items: [
  { current_status: 'sent' },
  { current_status: 'accepted' },
  { current_status: 'prepared' },
  { current_status: 'resulted' },
  { current_status: 'completed' },
  { current_status: 'rejected' },
] })
assert.deepStrictEqual(orderCounts.map(step => [step.key, step.count]), [
  ['waiting', 1],
  ['received', 2],
  ['partial', 1],
  ['complete', 1],
  ['cancelled', 1],
])
assert.strictEqual(
  s.orderStatusCountAria({ items: [{ current_status: 'accepted' }, { current_status: 'ready' }] }),
  'รับแล้ว 2 รายการ',
)
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
assert.strictEqual(scannedHistoryParams.all_dates, true)
assert(!Object.prototype.hasOwnProperty.call(scannedHistoryParams, 'date_from'))
assert(!Object.prototype.hasOwnProperty.call(scannedHistoryParams, 'date_to'))
const todayBeforeReset = s.currentDay
const bangkokTodayBeforeReset = s.bangkokToday
let dailyReloads = 0
let dailyCountReloads = 0
const dailyLoadOrders = s.loadOrders
const dailyRefreshCounts = s.refreshCounts
s.loadOrders = () => { dailyReloads++ }
s.refreshCounts = () => { dailyCountReloads++ }
s.filters = { hn: 'OLD-HN', dates: [todayBeforeReset, todayBeforeReset] }
s.scanMode = true
s.scannedHn = '6900001'
s.bangkokToday = () => '2099-01-02'
s.handleUnitChange()
assert.deepStrictEqual(s.filters, { hn: '', dates: ['2099-01-02', '2099-01-02'] })
assert.strictEqual(s.scanMode, false)
assert.strictEqual(s.scannedHn, '')
assert.strictEqual(dailyReloads, 1)
assert.strictEqual(dailyCountReloads, 1)
s.loadOrders = dailyLoadOrders
s.refreshCounts = dailyRefreshCounts
s.bangkokToday = bangkokTodayBeforeReset
s.currentDay = todayBeforeReset
s.filters = { hn: 'MANUAL-HN', dates: ['2026-08-01', '2026-09-02'] }
s.scanMode = true
s.scannedHn = '6900001'
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
const selectAllOrder = {
  order_id: 'ORDER-SELECT-ALL',
  items: [
    { ...item, item_id: 'ITEM-A', current_status: 'sent' },
    { ...item, item_id: 'ITEM-B', current_status: 'sent' },
    { ...item, item_id: 'ITEM-C', current_status: 'accepted' },
  ],
}
s.selected = {}
assert.strictEqual(s.allSelectableChecked(selectAllOrder), false)
assert.strictEqual(s.someSelectableChecked(selectAllOrder), false)
s.toggleAll(selectAllOrder)
assert.deepStrictEqual(s.selected, { 'ITEM-A': true, 'ITEM-B': true }, 'select all chooses every waiting Item only')
assert.strictEqual(s.allSelectableChecked(selectAllOrder), true)
s.toggleItem(selectAllOrder, 'ITEM-A')
assert.strictEqual(s.someSelectableChecked(selectAllOrder), true, 'partial selection marks the header indeterminate')
s.toggleAll(selectAllOrder)
assert.deepStrictEqual(s.selected, { 'ITEM-A': true, 'ITEM-B': true }, 'select all completes a partial selection')
s.toggleAll(selectAllOrder)
assert.deepStrictEqual(s.selected, {}, 'select all clears when every waiting Item is selected')
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
  item_code: 'MY-CULTURE',
  item_name: 'Fungal culture',
  lab_no: 'MY2608310001',
  received_at: '2026-08-31 09:00:00',
  current_status: 'accepted',
  section: { code: 'MY' },
  specimen: { ordered: { source: 'Skin scraping' } },
}
assert.strictEqual(s.isMycology(mycologyItem), true)
assert.strictEqual(s.canEditManual(mycologyItem), true)
assert.strictEqual(s.canEditManual({ ...mycologyItem, current_status: 'sent' }), false)
await s.openResult(mycologyItem, {
  order_id: 'ORDER-MY',
  patient: { hn: 'HN-WORKLIST', prename: 'น.ส.', first_name: 'ทดสอบ', last_name: 'ผู้ป่วย', age: '7y' },
  visit: { vn: 'VN-WORKLIST', clinic: '41 Mycology' },
}, false)
assert.strictEqual(processCalls.at(-1).params.action, 'get_manual_result')
assert.strictEqual(s.manual.editing, false)
assert.strictEqual(s.manual.data.patient_name, 'น.ส. ทดสอบ ผู้ป่วย', 'patient name must remain available from the Worklist row')
assert.strictEqual(s.manual.data.patient_hn, 'HN-TEST', 'API context may override the Worklist HN')
assert.strictEqual(s.manual.data.lab_no, 'MY2608310001')
assert.strictEqual(s.manual.data.ward_clinic, '41 Mycology', 'missing API metadata must fall back to the Worklist row')
assert.strictEqual(s.resultRowsForDisplay()[0].test_name, 'Fungal culture')

const realProcessCall = s.processCall
s.processCall = async () => ({ success: false, message: 'lookup failed' })
await s.openResult(mycologyItem, {
  order_id: 'ORDER-MY-FALLBACK',
  patient: { hn: 'HN-FALLBACK', first_name: 'ชื่อจาก', last_name: 'Worklist' },
  visit: { vn: 'VN-FALLBACK', clinic: '41 Mycology' },
}, false)
assert.strictEqual(s.manual.data.patient_name, 'ชื่อจาก Worklist', 'failed lookup must not blank the selected patient')
assert.strictEqual(s.manual.data.patient_hn, 'HN-FALLBACK', 'failed lookup must not blank HN')
assert.strictEqual(s.manual.data.lab_no, 'MY2608310001', 'failed lookup must not blank LAB NO.')
assert.strictEqual(s.resultRowsForDisplay()[0].test_name, 'Fungal culture', 'failed lookup must retain the selected test')
s.processCall = realProcessCall
await s.openResult(mycologyItem, {
  order_id: 'ORDER-MY',
  patient: { hn: 'HN-WORKLIST', prename: 'น.ส.', first_name: 'ทดสอบ', last_name: 'ผู้ป่วย', age: '7y' },
  visit: { vn: 'VN-WORKLIST', clinic: '41 Mycology' },
}, false)
s.startManualEdit()
assert.strictEqual(s.manual.editing, true)
assert.strictEqual(s.manual.data.previous.value, 'Candida albicans')
assert.strictEqual(s.manual.data.previous.entered_by, 'lab-old')
assert.strictEqual(s.manual.editRows[0].unit, 'CFU/mL')
s.manual.editRows[0].result_value = 'Candida tropicalis'
s.manual.editRows[0].interpretation = 'POS'
await s.saveResult()
const manualSaveCall = processCalls.find(call => call.params.action === 'save_manual_result')
assert(manualSaveCall)
assert.strictEqual(manualSaveCall.params.manual_result.result_value, 'Candida tropicalis')
assert.strictEqual(mycologyItem.current_status, 'resulted')
assert.strictEqual(mycologyItem.resulted_at, '2026-08-31 15:02:30')
assert.strictEqual(s.resultTime(mycologyItem), '15:02:30')
assert.strictEqual(s.criticalText(mycologyItem), 'รอยืนยัน')
assert.strictEqual(s.criticalText({ ...mycologyItem, is_critical: true }), 'ค่าวิกฤติ')
assert.strictEqual(s.criticalText({ ...mycologyItem, is_critical: false }), 'ไม่พบค่าวิกฤติ')

const emptyBiochemistryItem = {
  item_id: 'BC-MANUAL-EMPTY',
  item_code: 'BC-MANUAL',
  item_name: 'Manual biochemistry test',
  current_status: 'accepted',
  section: { code: 'BC' },
}
await s.openResult(emptyBiochemistryItem, { order_id: 'ORDER-BC-MANUAL', items: [emptyBiochemistryItem] }, false)
assert.strictEqual(s.hasPersistedResult(), false, 'pending CPOE Item id must not be mistaken for a persisted Result Item id')
s.startManualEdit()
assert.strictEqual(s.manual.editing, true, 'received non-Mycology Item must expose the pencil')
s.manual.editRows[0].result_value = '12.3'
await s.saveResult()
const nonMyManualCall = processCalls.filter(call => call.params.action === 'save_manual_result').at(-1)
assert.strictEqual(nonMyManualCall.params.item_id, emptyBiochemistryItem.item_id)
assert.strictEqual(nonMyManualCall.params.manual_result.result_value, '12.3')

const biochemistryItem = {
  item_id: 'BC-ITEM-1',
  current_status: 'accepted',
  section: { code: 'BC' },
}
assert.strictEqual(s.isMycology(biochemistryItem), false)
assert.strictEqual(s.canViewResult(biochemistryItem), true)
assert.strictEqual(s.canEditManual(biochemistryItem), true, 'received LAB Items in every Section must allow Manual entry')
await s.openResult(biochemistryItem, { order_id: 'ORDER-BC' }, false)
assert.strictEqual(processCalls.at(-1).params.action, 'get_manual_result')
assert.strictEqual(s.manual.editing, false)
s.startManualEdit()
assert.strictEqual(s.manual.editing, true, 'existing Agent/LIS results must expose the pencil editor')
assert.strictEqual(s.manual.editRows[0].unit, 'mg/dL')
s.manual.editRows[0].result_value = '101'
await s.saveResult()
const correctionSaveCall = processCalls.find(call => call.params.action === 'save_result_edits')
assert(correctionSaveCall)
assert.strictEqual(correctionSaveCall.params.results[0].result_item_id, 'aaaaaaaaaaaaaaaaaaaaaaaa')
assert.strictEqual(correctionSaveCall.params.results[0].result_value, '101')
assert.strictEqual(s.manual.data.results[0].result_source, 'agent', 'HIS correction must not replace the original source')
assert.strictEqual(s.manual.attachments.length, 1)

assert.strictEqual(s.resultHidden(), false)
s.openResultVisibilityDialog()
assert.strictEqual(s.visibilityDialog.visible, true)
assert.strictEqual(s.visibilityDialog.targetHidden, true)
const visibilityCallsBeforeShortReason = processCalls.filter(call => call.params.action === 'set_result_visibility').length
s.visibilityDialog.reason = 'x'
await s.submitResultVisibility()
assert.strictEqual(
  processCalls.filter(call => call.params.action === 'set_result_visibility').length,
  visibilityCallsBeforeShortReason,
  'short reason must not call the visibility API',
)
s.visibilityDialog.reason = 'รอตรวจสอบผลซ้ำ'
await s.submitResultVisibility()
const hideCall = processCalls.filter(call => call.params.action === 'set_result_visibility').at(-1)
assert(hideCall)
assert.strictEqual(hideCall.params.item_id, 'BC-ITEM-1')
assert.strictEqual(hideCall.params.hidden, true)
assert.strictEqual(hideCall.params.reason, 'รอตรวจสอบผลซ้ำ')
assert.strictEqual(biochemistryItem.is_hide_result, true)
assert.strictEqual(s.resultHidden(), true)
assert.strictEqual(s.resultVisibilityActor(), 'Earn Admin')
assert.strictEqual(s.visibilityDialog.visible, false)
assert.strictEqual(s.manual.data.results[0].result_value, '101', 'visibility action must not mutate the result value')
assert.strictEqual(s.manual.data.results[0].is_critical, false, 'visibility action must not mutate Critical state')

s.openResultVisibilityDialog()
assert.strictEqual(s.visibilityDialog.targetHidden, false)
s.visibilityDialog.reason = 'ตรวจสอบผลเรียบร้อยแล้ว'
await s.submitResultVisibility()
const unhideCall = processCalls.filter(call => call.params.action === 'set_result_visibility').at(-1)
assert.strictEqual(unhideCall.params.hidden, false)
assert.strictEqual(biochemistryItem.is_hide_result, false)
assert.strictEqual(s.resultHidden(), false)

assert.strictEqual(s.canUploadResultFile(), false, 'Item-level result popup must not expose Upload')
assert.strictEqual(s.beforeResultUpload({ name: 'scan.exe', type: 'application/octet-stream', size: 100 }), false)
assert.strictEqual(s.beforeResultUpload({ name: 'scan.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 }), false)

/* 2026-09-08: the saved CPOE Order contains the set's child Items. Order-level
   ดูผล must regroup them under the selected Parent/set heading while keeping
   the existing Item-level edit/hide/upload path unchanged. */
const electrolyteItems = [
  ['CHILD-SODIUM', 'C25.1-IC', 'Sodium (Na) จาก Ionized Ca Tube'],
  ['CHILD-POTASSIUM', 'C25.2-IC', 'Potassium (K) จาก Ionized Ca Tube'],
  ['CHILD-CHLORIDE', 'C25.3-IC', 'Chloride (Cl) จาก Ionized Ca Tube'],
  ['CHILD-TCO2', 'C25.4-IC', 'Total Carbondioxide (tCO2) จาก Ionized Ca Tube'],
].map(([item_id, item_code, item_name]) => ({
  item_id,
  item_code,
  item_name,
  current_status: 'accepted',
  section: { code: 'BC' },
  panel: {
    ordered_as: 'group_child',
    set_code: 'C25-IC',
    set_name: 'Electrolyte จาก Ionized Ca Tube',
  },
}))
const osmolalityItem = {
  item_id: 'PANEL-OSMOLALITY',
  item_code: 'C43',
  item_name: 'Osmolality (serum)',
  current_status: 'accepted',
  section: { code: 'BC' },
}
const aggregateOrder = {
  order_id: 'ORDER-PANEL',
  patient: { hn: 'HN-PANEL' },
  items: [...electrolyteItems, osmolalityItem],
}
const itemProcessCall = s.processCall
const electrolyteValues = ['140', '7.0', '103', '24']
let osmolalityValue = '290'
s.processCall = async (id, params) => {
  const electrolyteIndex = electrolyteItems.findIndex(item => item.item_id === params.item_id)
  if (params.action === 'save_result_edits' && electrolyteIndex >= 0) {
    electrolyteValues[electrolyteIndex] = params.results[0].result_value
    return { success: true, data: { results: params.results.map(row => ({
      ...row,
      test_code: electrolyteItems[electrolyteIndex].item_code,
      test_name: ['Sodium', 'Potassium', 'Chloride', 'Total Carbondioxide'][electrolyteIndex],
      is_critical: electrolyteIndex === 1,
    })) } }
  }
  if (params.action === 'save_result_edits' && params.item_id === osmolalityItem.item_id) {
    osmolalityValue = params.results[0].result_value
    return { success: true, data: { results: params.results.map(row => ({
      ...row,
      test_code: 'C43',
      test_name: 'Osmolality',
      is_critical: false,
    })) } }
  }
  if (params.action !== 'get_manual_result') return itemProcessCall(id, params)
  if (electrolyteIndex >= 0) return { success: true, data: {
    item_id: electrolyteItems[electrolyteIndex].item_id,
    test_code: electrolyteItems[electrolyteIndex].item_code,
    test_name: electrolyteItems[electrolyteIndex].item_name,
    patient_hn: 'HN-PANEL',
    results: [{
      result_item_id: String(electrolyteIndex + 1).repeat(24),
      test_code: electrolyteItems[electrolyteIndex].item_code,
      test_name: ['Sodium', 'Potassium', 'Chloride', 'Total Carbondioxide'][electrolyteIndex],
      result_value: electrolyteValues[electrolyteIndex],
      is_critical: electrolyteIndex === 1,
    }],
  } }
  if (params.item_id === osmolalityItem.item_id) return { success: true, data: {
    item_id: osmolalityItem.item_id,
    test_code: 'C43',
    test_name: osmolalityItem.item_name,
    patient_hn: 'HN-PANEL',
    results: [
      { result_item_id: '333333333333333333333333', test_code: 'C43', test_name: 'Osmolality', result_value: osmolalityValue, is_critical: false },
    ],
  } }
  return { success: false, message: 'unexpected item' }
}
await s.openOrderResults(aggregateOrder)
assert.strictEqual(s.manual.orderView, true)
assert.strictEqual(s.manual.item, null, 'Order view must not silently target the first Item for writes')
assert.strictEqual(s.resultTestCount(), 2, 'Order header count represents ordered Parent Items')
assert.strictEqual(s.resultGroupsForDisplay().length, 2)
assert.strictEqual(s.resultGroupsForDisplay()[0].test_name, 'Electrolyte จาก Ionized Ca Tube')
assert.deepStrictEqual(s.resultGroupsForDisplay()[0].item_ids, electrolyteItems.map(item => item.item_id))
assert.deepStrictEqual(s.resultGroupsForDisplay()[0].results.map(row => row.test_name), ['Sodium', 'Potassium', 'Chloride', 'Total Carbondioxide'])
assert.deepStrictEqual(s.resultGroupsForDisplay()[1].results.map(row => row.test_name), ['Osmolality'])
assert.strictEqual(s.resultRowsForDisplay().length, 5, 'all child results across every Parent Item must render')
assert.strictEqual(s.hasRecordedResult(), true)
assert.strictEqual(s.manualCriticalCount(), 1)
assert.strictEqual(s.canEditResult(), true, 'Order aggregate must allow multi-Item Manual entry and correction')
assert.strictEqual(s.canUploadResultFile(), true, 'Order aggregate must own the Upload action')
const orderAttachment = { name: 'order-result.pdf', size: 1024, response: { fileId: '444444444444444444444444' } }
await s.persistResultAttachments([orderAttachment])
const orderAttachmentCall = processCalls.filter(call => call.params.action === 'save_result_attachments').at(-1)
assert(orderAttachmentCall)
assert.strictEqual(orderAttachmentCall.params.attachment_scope, 'order')
assert.strictEqual(orderAttachmentCall.params.item_id, electrolyteItems[0].item_id)

s.startManualEdit()
assert.strictEqual(s.manual.editing, true, 'Order pencil must enter edit mode')
assert.strictEqual(Object.keys(s.manual.editMap).length, 5, 'each Order result row must have an independent editor')
const sodiumRow = s.resultGroupsForDisplay()[0].results[0]
const potassiumRow = s.resultGroupsForDisplay()[0].results[1]
s.manual.editMap[sodiumRow._edit_key].result_value = '142'
s.manual.editMap[potassiumRow._edit_key].result_value = '4.2'
await s.saveResult()
assert.strictEqual(electrolyteValues[0], '142', 'Order save must persist the edited Sodium Item')
assert.strictEqual(electrolyteValues[1], '4.2', 'Order save must persist the edited Potassium Item independently')
assert.strictEqual(s.manual.orderView, true)
assert.strictEqual(s.manual.editing, false)

await s.openResult(electrolyteItems[0], aggregateOrder, false)
assert.strictEqual(s.manual.orderView, false, 'Item ดูผล must retain the original Item mode')
assert.strictEqual(s.manual.item, electrolyteItems[0])
assert.strictEqual(s.canEditResult(), true)
assert.strictEqual(s.canUploadResultFile(), false, 'Item popup must keep edit/hide but never Upload')
s.startManualEdit()
s.manual.editRows[0].result_value = '145'
await s.saveResult()
await s.openOrderResults(aggregateOrder)
assert.strictEqual(s.resultGroupsForDisplay()[0].results[0].result_value, '145', 'Order result must reload the canonical value saved from Item edit')
s.processCall = itemProcessCall

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
await s.openOrderResults(waitingOrder)
assert.strictEqual(s.canUploadResultFile(), true, 'Order upload must be available immediately even while the Item waits for specimen')
assert.strictEqual(s.canEditResult(), false, 'Manual values still require specimen receipt')

const sharedBcOrder = {
  order_id: 'ORDER-SHARED',
  row_key: 'ORDER-SHARED|BC',
  section_code: 'BC',
  items: [{ item_id: 'SHARED-BC', current_status: 'sent', section: { code: 'BC' } }],
}
const sharedHmOrder = {
  order_id: 'ORDER-SHARED',
  row_key: 'ORDER-SHARED|HM',
  section_code: 'HM',
  items: [{ item_id: 'SHARED-HM', current_status: 'sent', section: { code: 'HM' } }],
}
assert.notStrictEqual(s.orderRowKey(sharedBcOrder), s.orderRowKey(sharedHmOrder))
s.expanded = {}
s.selected = { 'SHARED-BC': true }
s.toggleOrderFromRow(sharedBcOrder, { target: normalRowTarget })
assert.strictEqual(s.isExpanded(sharedBcOrder), true, 'clicking the Order row must expand it')
assert.deepStrictEqual(s.selected, {}, 'row-wide Order toggle must preserve the existing selection reset')
const orderButtonTarget = { closest: selector => selector.includes('button') ? {} : null }
s.toggleOrderFromRow(sharedBcOrder, { target: orderButtonTarget })
assert.strictEqual(s.isExpanded(sharedBcOrder), true, 'buttons inside the Order row must not double toggle it')
s.toggleOrderFromRow(sharedBcOrder, { target: normalRowTarget })
assert.strictEqual(s.isExpanded(sharedBcOrder), false, 'clicking the open Order row must collapse it')
s.toggleOrder(sharedBcOrder)
assert.strictEqual(s.isExpanded(sharedBcOrder), true)
assert.strictEqual(s.isExpanded(sharedHmOrder), false, 'same Order ID in another Section must keep independent row state')
s.setDetailTab(sharedBcOrder, 'results')
assert.strictEqual(s.detailTab(sharedBcOrder), 'results')
assert.strictEqual(s.detailTab(sharedHmOrder), 'order', 'same Order ID in another Section must keep an independent tab')
assert.strictEqual(s.reportSectionCode(sharedHmOrder), 'HM', 'row Section is authoritative for reports and cancellation')

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
await new Promise(resolve => setTimeout(resolve, 0))
assert.strictEqual(confirmations.at(-1).callbackType, 'function')
assert.strictEqual(confirmations.at(-1).type, 'warning')
assert.strictEqual(confirmations.at(-1).title, 'รับ specimen')
const receiveCalls = processCalls.filter(call => call.id === '6a94f634422c1ca959829d70' && call.params.dispatch_mode === 'deferred')
assert.strictEqual(receiveCalls.length, 1)
assert.deepStrictEqual(receiveCalls.map(call => call.params), [
  { item_id: receiveItem.item_id, dispatch_mode: 'deferred', item_ids: [receiveItem.item_id, receiveItem2.item_id] },
])
const backgroundDispatchCalls = processCalls.filter(call => call.id === '6a94f634422c1ca959829d70' && call.params.dispatch_mode === 'sync')
assert.deepStrictEqual(backgroundDispatchCalls.map(call => call.params), [
  { item_id: receiveItem.item_id, dispatch_mode: 'sync', item_ids: [receiveItem.item_id, receiveItem2.item_id] },
])
assert.strictEqual(receiveItem.current_status, 'accepted')
assert.strictEqual(receiveItem2.current_status, 'accepted')
assert.strictEqual(receiveItem.lab_no, '1069000001')
assert.strictEqual(receiveItem2.lab_no, '1069000001')
assert.strictEqual(receiveItem.received_at, '2026-08-31 09:00:00')
assert.strictEqual(receiveItem.hl7_status, 'queued')
assert.strictEqual(receiveItem.agent_transport_state, 'queued')
assert.strictEqual(s.isSelected(receiveItem.item_id), false)
assert.strictEqual(s.isSelected(receiveItem2.item_id), false)
assert.strictEqual(s.receiveLoading, false)
assert(notifications.some(row => row[0].includes('รับ specimen สำเร็จ 2 รายการ · กำลังส่ง Agent เบื้องหลัง 1 ชุด (2 รายการ)')))

const agentFailureItem = {
  item_id: '444444444444444444444444',
  item_code: 'BC003',
  item_name: 'AST',
  current_status: 'sent',
  specimen: { ordered: {} },
}
const agentFailureOrder = { order_id: 'ORDER-RECEIVE-FAIL', items: [agentFailureItem] }
s.orders = [agentFailureOrder]
s.toggleItem(agentFailureOrder, agentFailureItem.item_id)
await s.receiveSelected(agentFailureOrder)
await new Promise(resolve => setTimeout(resolve, 0))
assert.strictEqual(agentFailureItem.current_status, 'accepted', 'Agent failure must preserve the successful receipt in UI state')
assert.strictEqual(agentFailureItem.hl7_status, 'new')
assert.strictEqual(agentFailureItem.agent_transport_state, 'failed')
assert(notifications.some(row => row[0].includes('รับ specimen สำเร็จ 1 รายการ · กำลังส่ง Agent เบื้องหลัง 1 ชุด (1 รายการ)')))
assert(notifications.at(-1)[0].includes('รับ specimen แล้ว แต่ส่ง Agent ไม่สำเร็จ'))

{
  /* 2026-09-08: prove the visible receipt does not await a slow Agent request. */
  const originalProcessCall = s.processCall
  const originalLoadOrdersForAsync = s.loadOrders
  const originalRefreshCountsForAsync = s.refreshCounts
  let finishAgent
  let agentFinished = false
  const asyncItem = {
    item_id: '555555555555555555555555',
    item_code: 'BC004',
    item_name: 'Sodium',
    current_status: 'sent',
    specimen: { ordered: {} },
  }
  s.loadOrders = () => {}
  s.refreshCounts = () => {}
  s.processCall = async (id, request) => {
    assert.strictEqual(id, '6a94f634422c1ca959829d70')
    if (request.dispatch_mode === 'deferred') {
      return { success: true, data: {
        item_id: asyncItem.item_id,
        outbound_order_id: asyncItem.item_id,
        current_status: 'accepted',
        lab_no: '1069000002',
        received_at: '2026-09-08 10:35:40',
        hl7_status: 'new',
        agent_dispatch_queued: true,
        agent_transport_state: 'pending_dispatch',
      } }
    }
    return new Promise(resolve => {
      finishAgent = value => { agentFinished = true; resolve(value) }
    })
  }
  await s.performReceive({ order_id: 'ORDER-ASYNC', items: [asyncItem] }, [asyncItem])
  assert.strictEqual(typeof finishAgent, 'function', 'background Agent request must start')
  assert.strictEqual(agentFinished, false, 'receive must return while Agent is still pending')
  assert.strictEqual(asyncItem.lab_no, '1069000002', 'LAB NO. must be visible before Agent finishes')
  assert.strictEqual(s.receiveLoading, false)
  finishAgent({ success: true, data: { agent_send_success: true, hl7_status: 'queued', agent_transport_state: 'queued' } })
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.strictEqual(asyncItem.hl7_status, 'queued')
  assert.strictEqual(asyncItem.agent_transport_state, 'queued')
  s.processCall = originalProcessCall
  s.loadOrders = originalLoadOrdersForAsync
  s.refreshCounts = originalRefreshCountsForAsync
}

s.allowedSectionCodes = ['BC']
s.filters = { ...s.filters, hn: '' }
await s.openCreateOrder()
assert.strictEqual(opened[0][0], '6a995d064744260ea8c9498c')
assert.strictEqual(opened[0][3], null, 'patient context must not be passed as initData')
assert.strictEqual(opened[0][4].params.manual_visit, true)
assert.strictEqual(opened[0][4].params.xsitex, 'SITE-1', 'parent formParams must be forwarded through options.params')
assert.strictEqual(opened[0][4].params.lab_scope, true)
assert.strictEqual(opened[0][4].params.organization_code, '10')
assert.deepStrictEqual(opened[0][4].params.section_codes, ['BC'])

s.filters = { ...s.filters, hn: 'HN6900027' }
await s.openCreateOrder()
const contextualOpen = opened[1]
assert(contextualOpen, 'exact HN search with an open VN must launch CPOE')
assert.strictEqual(contextualOpen[3], null, 'patient context must still travel through params, never initData')
assert.strictEqual(contextualOpen[4].params.hn, '6900027')
assert.strictEqual(contextualOpen[4].params.visit_id, 'VISIT-6900027')
assert.strictEqual(contextualOpen[4].params.vn, '6900247')
assert.strictEqual(contextualOpen[4].params.full_name, 'น.ส. กนกวงศ์ จวบสมบัติ')
assert.strictEqual(contextualOpen[4].params.sex, 'หญิง')
assert.strictEqual(contextualOpen[4].params.inscl_hos[0].inscl_item_main.value, 'OFC')
const contextualLookup = processCalls.find(call => call.params.action === 'list_open_visits' && call.params.hn === '6900027')
assert(contextualLookup, 'Create button must resolve the searched HN against today open visits')

const openedBeforeMissingOpenVisit = opened.length
s.filters = { ...s.filters, hn: '6900999' }
await s.openCreateOrder()
assert.strictEqual(opened.length, openedBeforeMissingOpenVisit, 'HN without an open VN must not launch CPOE')
assert(notifications.some(note => String(note[0]).includes('HN 6900999 ยังไม่ได้เปิด VN วันนี้')))
assert.strictEqual(s.createOrderLoading, false)

const reportScopedOrder = {
  order_id: 'ORDER-REPORT-1',
  section_code: 'BC',
  emr_context: { visit_id: 'VISIT-1', vn: 'VN-1' },
  visit: { visit_id: 'VISIT-FALLBACK', vn: 'VN-FALLBACK' },
  patient: { hn: '6900001' },
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
assert.deepStrictEqual(s.hnOrderReportList, [{ reportId: '6a9a355c422c1ca95982a1a2', label: 'HN', type: 'pdf' }])
assert.strictEqual(s.hnOrderReportReady(reportScopedOrder), true)
assert.deepStrictEqual(s.hnOrderReportParams(reportScopedOrder), { hn: '6900001' })
/* ปุ่มผูกกับ HN แล้ว ⇒ Order ที่ไม่มี Visit ID แต่มี HN ยังพิมพ์ป้ายได้
   ส่วนแถวที่ไม่มี HN ต้อง disabled · PDF ใบสั่งตรวจยังกันด้วย Visit ID เหมือนเดิม */
assert.strictEqual(s.hnOrderReportReady({ ...reportScopedOrder, emr_context: {}, visit: {} }), true)
assert.strictEqual(s.hnOrderReportReady({ ...reportScopedOrder, patient: {} }), false)

s.openEmr(reportScopedOrder)
const emrOpen = opened.at(-1)
assert.strictEqual(emrOpen[0], '6a96557e422c1ca959829eae')
assert.strictEqual(emrOpen[2], '')
assert.strictEqual(emrOpen[4].params.lab_deep_link, true)
assert.strictEqual(emrOpen[4].params.visit_id, 'VISIT-1')
assert.strictEqual(Object.prototype.hasOwnProperty.call(emrOpen[4].params, 'vn'), false)
assert.strictEqual(emrOpen[4].params.source, 'lab-worklist')

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
s.cancelDialog.reason = 'ward_cancel'
await s.submitCancelOrder()
const cancelCall = processCalls.find(call => call.params.action === 'cancel_order')
assert(cancelCall)
assert.strictEqual(cancelCall.id, '6a9434c3422c1ca959829d5e')
assert.deepStrictEqual(cancelCall.params, {
  action: 'cancel_order',
  organization_code: '10',
  section_codes: ['BC'],
  order_id: cancelOrder.order_id,
  order_number: cancelOrder.order_number,
  cancel_reason: 'Ward ยกเลิกการส่งตรวจ',
})
for (const cancelledItem of cancelOrder.items) {
  assert.strictEqual(cancelledItem.current_status, 'cancelled')
  assert.strictEqual(cancelledItem.work_status, 'cancelled')
  assert.strictEqual(cancelledItem.cancel_reason, 'Ward ยกเลิกการส่งตรวจ')
  assert.strictEqual(cancelledItem.cancelled_by.name, 'Earn Admin')
}
assert.strictEqual(s.cancelDialog.visible, false)
assert.strictEqual(s.cancelDialog.loading, false)
assert(!widget.content.includes('explainWriteBlock'), 'cancel order must call its write action')

const confirmationCountBeforeRetest = confirmations.length
await s.retestOrder(cancelOrder)
assert.strictEqual(confirmations.length, confirmationCountBeforeRetest + 1)
const retestConfirmation = confirmations.at(-1)
assert.strictEqual(retestConfirmation.callbackType, 'function', 'initCraft confirm argument 2 must remain a callback')
assert.strictEqual(retestConfirmation.type, 'warning')
assert.strictEqual(retestConfirmation.title, 'ตรวจใหม่')
assert(retestConfirmation.message.includes('เก็บไว้ในประวัติ'))
assert(retestConfirmation.message.includes('สร้าง LAB NO. ใหม่เมื่อกดรับ specimen'))
const retestCall = processCalls.find(call => call.params.action === 'retest_order')
assert(retestCall)
assert.strictEqual(retestCall.id, '6a9434c3422c1ca959829d5e')
assert.deepStrictEqual(retestCall.params, {
  action: 'retest_order',
  organization_code: '10',
  section_codes: ['BC'],
  order_id: cancelOrder.order_id,
  order_number: cancelOrder.order_number,
})
assert.strictEqual(s.statusKey, 'waiting', 'หลังตรวจใหม่ให้เปิดแท็บรอรับทันที')
assert.strictEqual(s.isRetesting(cancelOrder), false)
assert(notifications.some(note => note[0].includes('เปิดตรวจใหม่แล้ว 2 รายการ')))

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
