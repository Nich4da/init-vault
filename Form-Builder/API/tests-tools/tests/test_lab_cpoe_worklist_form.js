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
const rejectionForm = read('Form-Builder/SDForm/form-factory/forms/Lab_Bio_Rejection.json')
const rejectReasonField = named(rejectionForm, 'reject_reason_code')
const scanner = named(worklist, 'scan_code')
const printAgentField = worklist.fields.find(field => field && field.component === 'local-agent-ui' && field.options && field.options.name === 'local_agent')
const provenXrayAgent = read('Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json').fields
  .find(field => field && field.component === 'local-agent-ui' && field.options && field.options.name === 'local_agent')
assert(printAgentField, 'LAB root must include the direct-print local agent widget')
assert(provenXrayAgent, 'the proven X-ray local agent widget must remain available as the source')
assert.strictEqual(printAgentField.component, 'local-agent-ui')
assert.strictEqual(printAgentField.id, 'local-agent-ui-lab-printer')
assert.strictEqual(printAgentField.options.agentKind, 'printer')
assert.deepStrictEqual(
  printAgentField.options,
  provenXrayAgent.options,
  'LAB must reuse the complete proven X-ray print-agent configuration, including its connection settings',
)
const workItemForm = read('Form-Builder/SDForm/form-factory/forms/Lab_Work_Item_CRUD.json')
assert.strictEqual(named(workItemForm, 'lab_no').required, false, 'pre-receipt rejected Work Item must not require a LAB NO.')
assert.strictEqual(named(workItemForm, 'latest_result_at').hidden, true, 'latest report time must remain an internal Work Item field')
assert.strictEqual(named(workItemForm, 'rejection_record_id').hidden, true)
for (const fieldName of ['cancellation_record_id', 'cancel_type', 'cancel_reason', 'cancelled_at', 'cancelled_by']) {
  assert.strictEqual(named(workItemForm, fieldName).hidden, true, fieldName + ' must be a hidden audit field')
}

assert(widget.onCreated.includes("action:'get_reason_options'"), 'reject/cancel options must come from LAB Reason Settings')
assert(widget.onCreated.includes("s.loadReasonOptions=async(reasonType,sectionCode)=>"))
assert(widget.onCreated.includes("reason_options:reasonOptions"), 'reject popup must receive the settings-backed options')
assert(widget.onCreated.includes("reason=s.cancelReasonLabels[reasonCode]||reasonCode"), 'cancel must submit the selected settings label through the unchanged payload')
assert(rejectReasonField.onCreated.includes('form.formParams'), 'reject reason Select must consume popup params through the Form runtime')
assert(!rejectReasonField.onCreated.includes('const rows=formParams'), 'field event must not reference an undeclared formParams variable')
{
  let loaded = null
  const field = {
    getFormRef: () => ({ formParams: { reason_options: [{ value: 'LABR-00001', label: 'เหตุผลจาก Settings' }] } }),
    loadOptions: options => { loaded = options },
  }
  const run = new Function(rejectReasonField.onCreated)
  run.call(field)
  assert.deepStrictEqual(loaded, [{ value: 'LABR-00001', label: 'เหตุผลจาก Settings' }])
}

assert(!widget.content.includes('lab-page-head'), 'page header must be removed')
assert(widget.content.includes('v-if="admissionNumber(order)" class="lab-admission-badge">AN : {{ admissionNumber(order) }}</span>'), 'IPD rows must show the AN badge only when AN exists')
assert(widget.onCreated.includes('s.admissionNumber=o=>s.text(o&&o.visit&&o.visit.an);'))
assert(widget.onCreated.includes("s.encounterClass=o=>s.admissionNumber(o)?'IPD'"))
assert(widget.onCreated.includes("an:s.text(visit&&visit.an)"), 'manual CPOE context must carry AN')
assert(widget.onCreated.includes("encounter_class:s.text(visit&&visit.an)?'IPD':'OPD'"), 'manual CPOE context must carry the derived encounter class')
assert(worklist.formConfig.cssCode.includes('.lab-admission-badge{display:flex'), 'AN badge must use the approved read-only danger treatment')
assert(!widget.content.includes('lab-section-control'), 'room/section picker must not be in this Form')
assert(!widget.content.includes('ตรวจสอบชนิด specimen ก่อนรับ'), 'obsolete instruction must be removed')
assert(!widget.content.includes('<table'), 'expanded Item rows must follow the Stock grid pattern, not a boxed table')
assert(widget.content.includes('lab-item-grid'))
assert(widget.content.includes('lab-specimen-select'))
assert(widget.content.includes('<el-input v-if="isImmunologyItem(item)" class="lab-specimen-select lab-specimen-locked"'))
assert(widget.content.includes(':model-value="specimenDisplay(item)" disabled'))
assert(widget.content.includes('@mousedown.prevent @click.stop />'))
assert(widget.content.includes('<el-select v-else class="lab-specimen-select"'))
assert(widget.content.includes('filterable default-first-option'))
assert(widget.content.includes("'lab-specimen-changed':specimenChanged(item)"))
assert(widget.onCreated.includes("s.isImmunologyItem=i=>['IM','MI-OUT'].includes"))
assert(worklist.formConfig.cssCode.includes('.lab-specimen-locked .el-input__wrapper{min-height:30px;background:var(--white);box-shadow:0 0 0 1px var(--border) inset;cursor:default}'))
assert(worklist.formConfig.cssCode.includes('.lab-specimen-locked .el-input__inner{color:var(--text);font-weight:700;-webkit-text-fill-color:var(--text);cursor:default}'))
assert(worklist.formConfig.cssCode.includes('.lab-specimen-select .el-select__selected-item{color:var(--text);font-weight:700}'))
assert(worklist.formConfig.cssCode.includes('.lab-specimen-select.lab-specimen-changed .el-select__selected-item{color:var(--danger);font-weight:700}'))
assert(widget.content.includes('<div class="lab-item-grid lab-item-head"'), 'expanded Order must show the Item column header')
assert(widget.content.includes('aria-label="เลือกทุกรายการที่รอรับ" @change="toggleAll(order)"'))
assert(widget.content.includes('<div>ลำดับ</div><div>Lab no.</div><div>รายการสั่งตรวจ</div><div>specimen</div>'))
assert(widget.content.includes('<div>เวลาเก็บ specimen</div><div>เวลารับ specimen</div><div>สถานะ</div><div>เหตุผล</div><div>ผู้ดำเนินการ</div><div>ดำเนินการ</div>'))
assert(widget.content.includes('{{ actionReasonText(item) }}'))
assert(widget.content.includes('{{ actionActorText(item) }}'))
assert(widget.content.includes('<div data-label="ผู้ดำเนินการ" class="lab-item-actor-cell">{{ actionActorText(item) }}</div>'))
assert(widget.content.includes('<div data-label="ดำเนินการ" class="lab-item-action-cell">'))
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
const expectedStatusFilterOrder = [
  "{key:'waiting',label:'รอรับ'}",
  "{key:'received',label:'รับแล้ว'}",
  "{key:'partial',label:'ออกผลบางส่วน'}",
  "{key:'complete',label:'ออกผลครบ'}",
  "{key:'cancelled',label:'ยกเลิก / ปฏิเสธ'}",
  "{key:'all',label:'ทั้งหมด'}"
]
const statusFilterPositions = expectedStatusFilterOrder.map(entry => widget.onCreated.indexOf(entry))
assert(statusFilterPositions.every(position => position >= 0), 'every status filter must exist')
assert.deepStrictEqual(
  statusFilterPositions,
  [...statusFilterPositions].sort((left, right) => left - right),
  'status filters must keep the approved left-to-right order'
)
assert(widget.content.includes('class="lab-status-legend" aria-label="คำอธิบายสีสถานะ"'))
for (const label of ['รอรับ', 'รับแล้ว', 'ออกผลบางส่วน', 'ออกผลครบ', 'ยกเลิก / ปฏิเสธ']) {
  assert(widget.content.includes(`<span>${label}</span>`), `status legend must explain ${label}`)
}
// 2026-09-23 user requirement: `ready` is Finance-cleared but not yet received.
assert(widget.onCreated.includes("waiting:['sent','ready']"))
assert(widget.onCreated.includes("received:['accepted','prepared','dispensed']"))
assert(widget.onCreated.includes("partial:['resulted']"))
assert(widget.onCreated.includes("accepted:'รับแล้ว'"))
assert(!widget.onCreated.includes("accepted:'รับแล้ว · รอผล'"))
assert(widget.content.includes(':loading="createOrderLoading"'))
assert(!worklist.formConfig.cssCode.includes('.lab-create-button{margin-left:auto}'), 'Create button must stay beside Report')
assert(widget.onCreated.includes("specimen_insufficient:'ปริมาณสิ่งส่งตรวจไม่เพียงพอ'"))
assert(!widget.content.includes('<div data-label="ผลตรวจ">'), 'Order tab must not contain Item-level result actions')
assert(widget.content.includes('v-for="(item,index) in resultItems(order)"'))
// 2026-09-21: ผู้ใช้ย้ายการดู/แก้ไขผลไประดับ Order และให้ระดับ Item เหลือเฉพาะปกปิด/ยกเลิกปกปิด
assert(widget.content.includes('@click="openItemResultVisibility(item,order)"'))
assert(widget.content.includes("{{ resultHiddenItem(item) ? 'ยกเลิกปกปิด' : 'ปกปิดผล' }}"))
assert(widget.content.includes('<div v-else class="lab-result-list" :class="{\'is-lookup\':viewMode===\'lookup\'}">'))
assert(widget.content.includes('<div v-if="viewMode===\'today\'">การแสดงผล</div>'), 'lookup mode must remove the Item visibility column header')
assert(widget.content.includes('<div v-if="viewMode===\'today\'">\n                <el-button size="small" plain'), 'lookup mode must remove every Item visibility cell')
assert(!widget.content.includes('@click="openResult(item,order,false)"'), 'Item rows must not duplicate the Order-level result viewer/editor')
assert(widget.content.includes('@click="openOrderResults(order)">ดูผล</el-button>'), 'Order-row shortcut must open the complete Order result view')
// 2026-09-22: ผู้ใช้ให้คงหัวคอลัมน์ HN เดิม; เงื่อนไขสลับเป็น “ดูผล” ยังต้องเหมือนเดิม
assert(widget.content.includes("detailTab(order)==='results' ? 'ดูผล' : 'HN'"), 'Order-row action heading must follow the active detail tab')
assert(widget.content.includes('<div>ลำดับ</div><div>รายการสั่งตรวจ</div><div>เวลาออกผล</div><div v-if="viewMode===\'today\'">การแสดงผล</div><div>สถานะ</div>'))
assert(worklist.formConfig.cssCode.includes('.lab-result-list.is-lookup .lab-result-list-head,.lab-result-list.is-lookup .lab-result-list-row{grid-template-columns:52px minmax(300px,2fr) 130px minmax(140px,.9fr);min-width:650px}'))
assert(widget.content.includes('{{ resultTime(item) }}'))
assert(widget.content.includes('{{ resultStatusText(item) }}'))
assert(widget.onCreated.includes('s.latestResultAt=i=>'), 'result tab must read the latest Partial/Final report time')
assert(widget.onCreated.includes("if(status==='resulted')return'partial'"), 'result tab status must follow Work Item status, not completion time')
assert(widget.onCreated.includes("partial:'ออกผลบางส่วน',complete:'ออกผลครบ',pending:'รอผล'"))
assert(!widget.onCreated.includes("s.resultStatusText=i=>s.resultedAt(i)?'ออกผลแล้ว':'รอผล'"), 'completion timestamp must not be the result-tab status source')
assert(widget.content.includes('v-if="criticalValue(item)===true" class="lab-critical-status is-critical">ค่าวิกฤติ</span>'))
assert(!widget.content.includes('<div class="lab-result-list-head"><div>ลำดับ</div><div>รายการสั่งตรวจ</div><div>LAB NO.</div>'))
assert(!widget.content.includes(':disabled="!canOpenResultTab(order)"'), 'result tab must be available before results exist')
assert(widget.onCreated.includes("'ผลตรวจทางห้องปฏิบัติการ'"))
assert(widget.content.includes("'แก้ไขผลตรวจทั้งหมด'"))
assert(widget.content.includes("isMicrobiologyResult()?'min(1180px,calc(100vw - 32px))':'min(1320px,calc(100vw - 48px))'"), 'standard LAB popup must use the approved 1320px mockup width while MB keeps its own viewer')
assert(widget.content.includes('class="lab-result-title-row"'))
assert(widget.content.includes("standardResultStatusValue()!=='pending'"), 'standard result header must show the source status tag only when a result exists')
assert(widget.content.includes('class="lab-result-summary-tag is-critical">วิกฤติ {{ manualCriticalCount() }}</span>'))
assert(widget.content.includes('class="lab-result-summary-tag is-abnormal">ผิดปกติ {{ manualAbnormalCount() }}</span>'))
assert(widget.content.includes('class="lab-result-edit-button"'))
assert(widget.content.includes('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5'))
assert(widget.content.includes("{{ resultHidden() ? 'ยกเลิกปกปิด' : 'ปกปิดผล' }}"))
assert(widget.content.includes("'ยืนยันปกปิดผล' : 'ยืนยันยกเลิกการปกปิดผล'"))
assert(widget.content.includes('การปกปิดจะไม่ล้างสถานะหรือ workflow แจ้งค่าวิกฤติ'))
assert(widget.content.includes('v-model="visibilityDialog.reason"'))
assert(widget.content.includes('เหตุผล <small>(ไม่บังคับ)</small>'))
assert(!widget.content.includes(':disabled="text(visibilityDialog.reason).length<3"'))
assert(!widget.onCreated.includes("if(reason.length<3){field.notify('กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร'"))
assert(widget.onCreated.includes('s.openItemResultVisibility=async(item,order)=>'))
assert(!widget.content.includes('class="lab-result-patient-card"'), 'result popup must not repeat the patient summary card removed by the approved mockup')
assert(!widget.content.includes("{{ manual.data.patient_name || 'ไม่พบชื่อผู้ป่วย' }}"))
assert(widget.content.includes("{{ manual.data.patient_hn || '-' }}"))
assert(widget.content.includes('class="lab-result-value-head"'))
assert(!widget.content.includes('ผลการตรวจ {{ resultRowsForDisplay().length }} รายการ'))
assert(widget.content.includes('<span>#</span><span><span class="lab-sr-only">สถานะ</span></span><span>รายการ</span><span title="ประวัติค่าที่เคยบันทึกของ Item นี้ · อ่านอย่างเดียว">ค่าก่อนหน้า</span><span>ค่าที่ตรวจได้</span><span>หน่วย</span><span>แปลผล</span><span>ค่าปกติ</span>'))
// 2026-09-23 regression: only profile parents render as collapsible headers;
// ordinary single results stay directly visible in the shared result table.
assert(widget.content.includes('v-else-if="resultGroupIsProfile(group)" type="button" class="lab-result-profile-row"'))
assert(widget.content.includes('class="lab-sensitive-result-locked"'), 'Sensitive rows in every LAB room must render a locked placeholder')
assert(widget.content.includes('class="lab-sensitive-result-label">ปกปิดผล</strong>'), 'the locked row must show a red hidden-result label')
assert(widget.content.includes('class="lab-result-redacted-value">ปกปิดผล</strong>'), 'server-redacted Result Items must remain fail-closed inside the shared result popup')
assert(widget.content.includes("'is-redacted':result&&result.redacted===true"))
assert(!widget.onCreated.includes("redacted:true,redaction_reason:'manual_hide'"), 'manual hide must not redact the owning LAB editor')
assert(widget.onCreated.includes('if(result&&result.redacted===true)return false'), 'redacted Result Items must not become editable through the popup')
assert(!widget.content.includes('ยืนยันตัวตนเพื่อดูผล'), 'LAB must not expose a Sensitive re-auth button or dialog')
assert(!widget.content.includes('Username แพทย์'))
assert(!widget.content.includes('Password'))
assert(!widget.onCreated.includes('requestSensitiveAccess'))
assert(!widget.onCreated.includes('submitSensitiveAccess'))
assert(!widget.onCreated.includes("action:'authorize_sensitive_result'"), 'LAB Form must never send doctor credentials')
assert(widget.onCreated.includes("const key=!sensitiveLocked&&panelGroupingAllowed&&parentCode?'panel:'+parentCode:'item:'"), 'a locked Sensitive item must remain a separate named row instead of hiding normal profile siblings')
assert(!widget.onCreated.includes('sensitive_grant_token'), 'LAB Form must never send or reuse a Sensitive grant')
assert(!widget.onCreated.includes('sensitiveGrants'))
assert(widget.content.includes('v-for="(group,groupIndex) in resultGroupsForDisplay()"'), 'Order result view must render every ordered result group')
assert(widget.content.includes('@click="toggleResultGroup(group,groupIndex)"'))
assert(widget.content.includes('v-if="!group.sensitive_locked && (!resultGroupIsProfile(group) || resultGroupExpanded(group,groupIndex))"'))
assert(widget.content.includes('class="lab-result-profile-index lab-mono">{{ groupIndex+1 }}</span>'), 'profile parent must use the top-level ordered-test number')
assert(widget.content.includes('class="lab-result-profile-main"'), 'profile label must align with the ordinary result-name column')
assert(widget.content.includes("<small>Profile · คลิกเพื่อ{{ resultGroupExpanded(group,groupIndex) ? 'พับ' : 'กาง' }}ผลย่อย {{ group.results.length }} รายการ</small>"), 'profile subtitle must match the approved mockup interaction copy')
assert(widget.content.includes('{{ resultRowNumber(group,groupIndex,index) }}'), 'profile children must use hierarchical numbering from the approved HTML mockup')
assert(widget.content.includes('class="lab-result-index lab-mono">{{ resultRowNumber(group,groupIndex,index) }}</div>'), 'result row numbering needs a dedicated no-wrap target')
assert(widget.content.includes("class=\"lab-result-value-row\" :class=\"{'is-profile-child':resultGroupIsProfile(group),'is-critical':result&&result.is_critical===true,'is-redacted':result&&result.redacted===true}\""), 'profile child rows must indent while Critical and redacted rows receive their correct surface')
assert(widget.content.includes('v-for="(result,index) in group.results"'), 'each Parent header must render every returned child result')
assert(widget.content.includes('class="lab-result-profile-toolbar"'), 'standard result popup must restore the approved profile toolbar')
assert(widget.content.includes('@click="expandAllResultGroups">กาง Profile ทั้งหมด</el-button>'))
assert(widget.content.includes('@click="collapseAllResultGroups">พับทั้งหมด</el-button>'))
assert(!widget.content.includes('lab-result-profile-meta'), 'excluded profile status/specimen/latest metadata must not be added')
assert(widget.content.includes("{{ group.test_name || '-' }}"))
assert(widget.content.includes('{{ result.test_name || group.test_name || \'-\' }}'))
assert(widget.content.includes('ผลจาก {{ resultSourceText(result.result_source) }}'), 'result name cell must preserve the mockup secondary source line')
assert(widget.content.includes('v-if="result.result_comment && !result.redacted" class="lab-result-comment" role="note" aria-label="หมายเหตุผลตรวจ"'), 'standard result rows must render a persisted LIS comment only when the row is not redacted')
assert(widget.content.includes('<span>หมายเหตุผลตรวจ</span><p>{{ result.result_comment }}</p>'), 'result comment must remain visible as read-only clinical text')
assert(widget.onCreated.includes('result_comment:s.text(data.result_comment)'), 'single-result fallback must preserve result_comment')
assert(widget.content.includes('{{ resultTestCount() }} tests'))
assert(widget.content.includes('class="lab-result-byline" aria-label="ข้อมูลผู้ออกผลและผู้ยืนยันผล"'))
assert(widget.content.includes('<b>Reported by:</b> <strong>{{ resultReporterName() }}</strong>'))
assert(widget.content.includes('<b>Approve name:</b> <strong>{{ resultVerifierName() }}</strong>'))
assert(widget.content.includes('<b>ออกผลเมื่อ:</b> <strong class="lab-mono">{{ compactDateTime(resultReportedAt()) }}</strong>'))
assert(!widget.content.includes('ผลทั้งใบ · เคมีคลินิก · แสดงตามลำดับที่ได้รับจาก Agent/LIS'))
assert(widget.content.includes('ยังไม่มีผลตรวจ · รอผลจาก LIS หรือกดดินสอเพื่อกรอกผล'))
assert(!widget.content.includes('ยังไม่มีผลตรวจ · รอผลจาก Agent/LIS'))
for (const repeatedLabel of ['ลำดับ', 'รายการตรวจ', 'ผลก่อนหน้า', 'ผลปัจจุบัน', 'หน่วย']) {
  assert(!widget.content.includes(`<div><span>${repeatedLabel}</span>`), `result row must not repeat the ${repeatedLabel} label`)
}
assert(widget.onCreated.includes('s.resultContext=(item,order)=>'))
assert(widget.onCreated.includes('s.resultRowsForDisplay=()=>'))
assert(widget.onCreated.includes('s.resultGroupsForDisplay=()=>'))
assert(widget.onCreated.includes('s.resultGroupIsProfile=group=>'))
assert(widget.onCreated.includes('s.resultRowNumber=(group,groupIndex,resultIndex)=>'))
assert(widget.onCreated.includes('s.initResultGroupOpen=()=>'))
assert(widget.onCreated.includes('s.resultProfileCount=()=>'))
assert(widget.onCreated.includes('s.expandAllResultGroups=()=>'))
assert(widget.onCreated.includes('s.collapseAllResultGroups=()=>'))
assert(widget.onCreated.includes('s.resultTone=result=>'))
assert(widget.onCreated.includes('s.resultMeasuredClass=result=>'))
assert(widget.onCreated.includes('s.resultInterpretationClass=result=>'))
assert(widget.onCreated.includes('s.resultReporterName=()=>'))
assert(widget.onCreated.includes('s.resultVerifierName=()=>'))
assert(widget.onCreated.includes('s.resultReportedAt=()=>'))
assert(widget.onCreated.includes('s.resultTestCount=()=>'))
assert(widget.onCreated.includes('s.manualAbnormalCount=()=>'))
assert(widget.onCreated.includes('s.standardResultStatusValue=()=>'))
assert(widget.onCreated.includes("if(status==='completed')return'final'"), 'Final must come from the existing Order status, not inferred clinical ranges')
assert(widget.onCreated.includes('s.standardResultStatusText=()=>'))
assert(widget.content.includes('@click="requestFinalizeManualResults">ยืนยันออกผลครบ</el-button>'), 'complete Manual Order must expose an explicit Final action')
assert(widget.onCreated.includes('s.manualFinalizeContexts=()=>'))
assert(widget.onCreated.includes('s.canFinalizeManualResults=()=>'))
assert(widget.onCreated.includes('s.finalizeManualResults=async()=>'))
assert(widget.onCreated.includes("action:'finalize_manual_results'"))
assert(widget.onCreated.includes('s.requestFinalizeManualResults=()=>'))
assert(widget.onCreated.includes('s.resultGroup=(item,order,data)=>'))
assert(widget.onCreated.includes('s.groupOrderResultGroups=groups=>'))
assert(widget.onCreated.includes('s.loadOrderResultGroup=async(item,order)=>'))
assert(widget.onCreated.includes('s.openOrderResults=async order=>'))
assert(widget.onCreated.includes('const loadedGroups=await Promise.all(items.map(item=>s.loadOrderResultGroup(item,order)))'))
assert(widget.onCreated.includes('const groups=s.groupOrderResultGroups(loadedGroups)'))
assert(!widget.onCreated.includes('s.openFirstOrderResult=order=>'))
assert(widget.onCreated.includes('s.openResultVisibilityDialog=()=>'))
assert(widget.onCreated.includes('s.openItemResultVisibility=async(item,order)=>'))
assert(widget.onCreated.includes('s.submitResultVisibility=async()=>'))
assert(widget.onCreated.includes("action:'set_result_visibility'"))
assert(widget.onCreated.includes('const fallback=s.resultContext(item,order)'))
assert(widget.onCreated.includes('const merged={...fallback,...d'))
assert(widget.content.includes('v-if="viewMode===\'today\'&&!manual.orderView && hasPersistedResult()"'), 'Item hide/unhide must remain scoped to an Item result and hidden in lookup mode')
assert(widget.content.includes('v-if="manual.orderView && !isMicrobiologyResult()" class="lab-result-attachments"'), 'Upload UI must remain in the standard Order result popup but not the MB read-only viewer')
assert(!widget.content.includes('อัปโหลดไฟล์จากปุ่มดูผลระดับรายการ'))
assert(widget.onCreated.includes("attachment_scope:'order'"), 'Upload persistence must use the Order attachment scope')
assert(worklist.formConfig.cssCode.includes('.lab-result-value-head,.lab-result-value-row{'))
assert(worklist.formConfig.cssCode.includes('.lab-result-hidden-tag{'))
assert(worklist.formConfig.cssCode.includes('.lab-result-hidden-notice{'))
assert(worklist.formConfig.cssCode.includes('.lab-visibility-summary{'))
assert(worklist.formConfig.cssCode.includes('background:var(--el-color-warning-light-9,#fdf6ec);color:var(--el-text-color-regular,#606266)}'), 'visibility summary must use theme-aware warning and text tokens')
assert(worklist.formConfig.cssCode.includes('.lab-visibility-summary strong{color:var(--el-text-color-primary,#303133)}'), 'visibility summary title must remain readable when the dialog is teleported in dark mode')
assert(worklist.formConfig.cssCode.includes('.lab-visibility-summary span{color:var(--el-text-color-regular,#606266);font-size:12px;line-height:1.5}'), 'visibility summary copy must have an explicit theme-aware color')
assert(!worklist.formConfig.cssCode.includes('.lab-visibility-summary{display:grid;gap:6px;margin-bottom:14px;padding:13px 14px;border:1px solid #f3d19e;border-radius:7px;background:#fdf6ec}'), 'visibility summary must not keep a light-only hard-coded surface')
assert(worklist.formConfig.cssCode.includes('.lab-result-dialog .el-dialog__body{max-height:calc(100vh - 160px);padding:18px;overflow:auto;overscroll-behavior:contain}'))
assert(worklist.formConfig.cssCode.includes('.lab-result-value-head,.lab-result-value-row{grid-template-columns:56px 48px minmax(180px,1fr) 132px 132px 94px 104px 188px;gap:0;min-width:940px;padding:0}'))
assert(worklist.formConfig.cssCode.includes('.lab-result-value-head{min-height:42px;align-items:center;background:var(--fill-soft)}'))
assert(worklist.formConfig.cssCode.includes('.lab-result-comment{grid-column:3/-1;'), 'result comment must span the clinical columns below its result row')
assert(worklist.formConfig.cssCode.includes('white-space:pre-wrap;overflow-wrap:anywhere'), 'result comment must preserve LIS line breaks safely')
assert(worklist.formConfig.cssCode.includes('.lab-result-profile-row{display:grid;width:100%;grid-template-columns:56px 48px minmax(180px,1fr) 132px 132px 94px 104px 188px;'))
assert(worklist.formConfig.cssCode.includes('.lab-result-profile-index{grid-column:1;padding:10px}'))
assert(worklist.formConfig.cssCode.includes('.lab-result-profile-main{display:grid;grid-column:3/8;gap:1px;padding:10px}'))
assert(worklist.formConfig.cssCode.includes('.lab-result-profile-row.is-open i{transform:rotate(180deg)}'))
assert(worklist.formConfig.cssCode.includes('.lab-result-profile-toolbar{display:flex;align-items:center;gap:10px;margin:0 0 9px}'))
assert(worklist.formConfig.cssCode.includes('.lab-result-value-row.is-profile-child{padding-left:16px}'))
assert(worklist.formConfig.cssCode.includes('.lab-result-dialog:not(.is-microbiology){--lab-result-surface:var(--el-bg-color,#fff);'))
assert(worklist.formConfig.cssCode.includes('.lab-result-dialog:not(.is-microbiology) .lab-result-summary-tag{display:inline-flex;min-height:23px;'), 'summary tags must use the approved compact pill geometry')
assert(worklist.formConfig.cssCode.includes('.lab-result-dialog:not(.is-microbiology) .lab-result-summary-tag.is-final{border-color:#b3e19d;background:#f0f9eb;color:#529b2e}'))
assert(worklist.formConfig.cssCode.includes('.lab-result-dialog:not(.is-microbiology) .lab-result-test-name small{display:block;margin-top:2px;'), 'result source line must use the approved secondary typography')
assert(worklist.formConfig.cssCode.includes('.lab-result-dialog:not(.is-microbiology){display:flex;max-height:calc(100vh - 48px);flex-direction:column;margin:24px auto!important}'), 'standard result popup must keep its header, scrolling body, and footer inside the mockup viewport')
assert(worklist.formConfig.cssCode.includes('.lab-result-dialog:not(.is-microbiology) .el-dialog__body{flex:1;min-height:0;max-height:none;overflow:auto;overscroll-behavior:contain}'), 'only the standard result body should scroll')
assert(worklist.formConfig.cssCode.includes('.lab-result-dialog:not(.is-microbiology) .lab-result-index,.lab-result-dialog:not(.is-microbiology) .lab-result-profile-index{white-space:nowrap}'), 'result and profile numbers must never wrap')
assert(worklist.formConfig.cssCode.includes('.lab-result-dialog:not(.is-microbiology) .lab-result-value-row>.lab-result-index{padding-right:6px;padding-left:6px}'), 'the 44px mockup number column must retain enough content width for child numbering')
assert(worklist.formConfig.cssCode.includes('grid-template-columns:44px 34px minmax(230px,1.5fr) 125px 130px 92px 115px 145px;min-width:920px'))
assert(worklist.formConfig.cssCode.includes('grid-template-columns:32px minmax(260px,1fr) 28px;gap:10px;min-width:920px;min-height:54px'))
assert(worklist.formConfig.cssCode.includes('.lab-result-dialog:not(.is-microbiology) .lab-result-profile-row.is-open{background:var(--lab-result-surface-blue)}'))
assert(worklist.formConfig.cssCode.includes('.lab-result-dialog:not(.is-microbiology) .lab-result-report-action .el-button:not(.is-disabled)'))
assert(worklist.formConfig.cssCode.includes('.lab-result-byline{display:flex;align-items:center;gap:12px;'))
assert(!worklist.formConfig.cssCode.includes('.lab-result-value-row.is-pending>div{background:#fffaf2}'))
assert(worklist.formConfig.cssCode.includes('.lab-result-signal{display:block;width:10px;height:10px;margin-left:7px;border:1px solid;border-radius:50%}'))
assert(worklist.formConfig.cssCode.includes('.lab-result-signal.is-normal{border-color:#4e9631;background:#2f761e;box-shadow:0 0 0 3px rgba(103,194,58,.10)}'))
assert(worklist.formConfig.cssCode.includes('.lab-result-signal.is-critical{border-color:#d46a6a;background:#b84d4d;box-shadow:0 0 0 3px rgba(245,108,108,.12)}'))
assert(widget.content.includes('v-if="!result.redacted && hasResultValue(result)" class="lab-result-signal"'))
assert(widget.onCreated.includes('s.resultSignalClass=result=>s.resultTone(result)'))
assert(widget.onCreated.includes("tone==='is-critical'?'ค่าวิกฤติ':tone==='is-abnormal'?'ค่าผิดปกติ':'ไม่มีค่าวิกฤติ'"))
assert(widget.content.includes('v-if="isMicrobiologyResult()" class="lab-micro-source-tag">จุลชีววิทยา · MLab</span>'))
assert(widget.content.includes('<template v-if="isMicrobiologyResult()">'))
assert(widget.content.includes('class="lab-micro-patient-strip"'))
assert(widget.content.includes('v-if="microUnmatchedFallback()" class="lab-micro-unmatched"'), 'unmatched MB receipt must use the raw-only fallback')
assert(widget.content.includes('<strong>ข้อความต้นฉบับจาก MLab</strong>'))
assert(widget.content.includes(':aria-expanded="microUnmatchedOpen" @click="microUnmatchedOpen=!microUnmatchedOpen"'))
assert(widget.content.includes('<pre v-if="microUnmatchedOpen">{{ microUnmatchedRawText() }}</pre>'))
assert(widget.content.includes('<template v-else>'), 'normal MB result cards must be mutually exclusive with the unmatched fallback')
assert(widget.content.includes('class="lab-micro-wire-results"'))
assert(widget.content.includes('รหัสรายการ HIS'))
assert(widget.content.includes('ชื่อ/รหัสที่มากับผล'))
assert(widget.content.includes('ผลจาก MLab'))
assert(!widget.content.includes('microCultureTitle(group)'), 'MB viewer must not rename an ordered item from free-text result content')
assert(!widget.content.includes('microSusceptibilityRows(group)'), 'MB viewer must not parse antimicrobial rows from MLab free text')
assert(widget.onCreated.includes('s.microUnmatchedReceipts=()=>'))
assert(widget.onCreated.includes('s.microUnmatchedRawText=()=>'))
assert(widget.onCreated.includes('s.microUnmatchedFallback=()=>'))
assert(worklist.formConfig.cssCode.includes('.lab-micro-unmatched{'))
assert(widget.content.includes('v-if="viewMode===\'today\'&&!isMicrobiologyResult()" class="lab-result-edit-button"'), 'standard pencil must be hidden for MB and in read-only lookup mode')
assert(widget.content.includes('v-if="isMicrobiologyResult()" @click="copyMicrobiologyResult"'))
assert(widget.onCreated.includes("s.isMicrobiologyItem=i=>s.text(i&&i.section&&i.section.code).toUpperCase()==='MB'"))
assert(widget.onCreated.includes('if(s.isMicrobiologyResult())return false;'), 'MB machine-result viewer must not enter HIS manual edit mode')
assert(widget.onCreated.includes('s.microResultRows=group=>'))
assert(!widget.onCreated.includes('s.microCultureTitle=group=>'), 'MB viewer must not infer test identity from result text')
assert(!widget.onCreated.includes('s.microGramStain=group=>'), 'MB viewer must not infer Gram stain values from result text')
assert(!widget.onCreated.includes('s.microSusceptibilityRows=group=>'), 'MB viewer must not parse MIC/SIR from result text')
assert(widget.onCreated.includes('s.copyMicrobiologyResult=()=>'))
assert(worklist.formConfig.cssCode.includes('.lab-micro-patient-strip{'))
assert(worklist.formConfig.cssCode.includes('.lab-micro-wire-meta{'))
// 2026-09-29: prior result remains longitudinal (previous encounter). Manual
// Edit Log stays append-only in the API, but the popup now presents Agent
// callbacks as whole-sheet Revision Log snapshots instead of row-level accordions.
assert(widget.content.includes('>ค่าก่อนหน้า</span>'))
assert(widget.content.includes('<span>ค่าที่ตรวจได้</span>'))
assert(widget.content.indexOf('>ค่าก่อนหน้า</span>') < widget.content.indexOf('<span>ค่าที่ตรวจได้</span>'))
assert(!widget.content.includes('ประวัติการแก้ไข {{ result.correction_history.length }} ครั้ง'))
assert(widget.content.includes("'ประวัติผล '+resultRevisionCount()+' ฉบับ'"))
assert(widget.content.includes('class="lab-result-revision-view"'))
assert(widget.content.includes('snapshot ผลทั้งฉบับ'))
assert(widget.content.includes('ไม่ใช่ผลปัจจุบัน'))
assert(widget.onCreated.includes('s.mergeResultRevisions=groups=>'))
assert(widget.onCreated.includes('s.selectedResultRevision=()=>'))
assert(widget.onCreated.includes('s.toggleResultRevisionHistory=()=>'))
assert(widget.content.includes('v-model="manual.correctionReason"'))
assert(widget.content.includes('เหตุผลการแก้ไขผล'))
assert(widget.content.includes('เหตุผลการแก้ไขผล <small>(ไม่บังคับ)</small>'))
assert(!widget.content.includes('correctionReasonRequired() && !correctionReasonValid()'))
assert(!widget.onCreated.includes('s.correctionReasonValid=()=>'))
assert(!widget.onCreated.includes('correctionReason.length<3'))
assert(!widget.content.includes('แก้ไขโดย {{ result.last_edited_by }}'), 'approved result popup does not show row-level audit text')
assert(widget.content.includes('v-model="manual.editMap[result._edit_key].unit"'))
assert(widget.content.includes('v-model="manual.editMap[result._edit_key].reference_range"'))
assert(widget.content.includes('manual.editing && manual.editMap[result._edit_key]'), 'Order and Item rows must bind to their own editable values')
assert(widget.content.includes('ยังคงใช้ค่า Critical ที่ Agent/LIS ส่งมา'))
assert(widget.onCreated.includes('s.correctionReasonRequired=()=>'))
assert(widget.onCreated.includes('correction_reason:correctionReason'))
assert(widget.onCreated.includes('request_id:correctionRequestId'))
assert(worklist.formConfig.cssCode.includes('.lab-result-revision-view{'))
assert(worklist.formConfig.cssCode.includes('.lab-correction-reason{'))
assert(widget.content.includes('class="lab-result-attachments"'))
assert(widget.content.includes('ไฟล์แนบผลตรวจ'))
assert(widget.content.includes('>Upload file</el-button>'))
assert(widget.content.includes('สูงสุด 10 ไฟล์ · รวมไม่เกิน 50 MB'))
assert(widget.content.includes('{{ manual.attachments.length }}/10'))
assert(widget.content.includes(':multiple="true"'), 'one file-picker selection must accept multiple result attachments')
// 2026-09-25 runtime correction: binding file-list directly (including a separate
// v-model) made initCraft replace/crash the vue-ui after a successful multi-upload.
// Keep Element Plus pending state internal; beforeResultUpload remains the 10-file guard.
assert(!widget.content.includes(':file-list='), 'fragile initCraft vue-ui must not control Element Plus internal upload files')
assert(!widget.content.includes('v-model:file-list='), 'direct file-list v-model must stay out of the fragile initCraft vue-ui')
assert(!widget.content.includes(':limit="10"'), 'a stale hidden Element Plus list must not block replacements after persisted files are removed')
assert(widget.content.includes(':disabled="!canUploadResultFile() || manual.saving"'), 'the uploader itself must stay enabled while Element Plus dispatches the selected batch')
assert(widget.onCreated.includes('s.resultUploadReservations={}'), 'multi-file validation must reserve every selected file before upload')
assert(widget.onCreated.includes('s.resultUploadQueue=Promise.resolve()'), 'attachment metadata writes must be serialized to prevent lost files')
assert(widget.onCreated.includes('preserveNewer:true'), 'an earlier save response must not remove newer files from the visible batch')
assert(widget.onCreated.includes("field.notify('อัปโหลดและบันทึกไฟล์แนบแล้ว '+succeeded+' ไฟล์',failed?'warning':'success');"), 'batch toast must not render the duration as a visible 3000 title')
assert(widget.content.includes('v-if="viewMode===\'today\'" class="lab-result-file-remove"'), 'remove must exist only in editable Worklist mode')
assert(widget.content.includes('@click="requestRemoveResultFile(fileItem)"'))
assert(widget.content.includes('circle size="small"'))
assert(widget.content.includes('<span aria-hidden="true">×</span>'), 'remove action must render as a compact cross instead of a text button')
assert(widget.content.includes('title="นำไฟล์ออก"'))
assert(worklist.formConfig.cssCode.includes('.lab-result-file-remove{width:28px!important;height:28px!important'))
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
assert(widget.content.includes('v-if="showCashPayment(order)" class="lab-inline-tag lab-meta-pill lab-payment-pill"'))
assert(widget.content.includes(':class="{\'is-unpaid\':!isFinancePassed(order)}"'))
assert(widget.content.includes("{{ isFinancePassed(order) ? 'ชำระเงินแล้ว' : 'ยังไม่ได้ชำระเงิน' }}"))
assert(!widget.content.includes('v-if="showPaid(order)" class="lab-inline-tag lab-meta-pill lab-payment-pill"'))
assert(worklist.formConfig.cssCode.includes('.lab-context-top .lab-payment-pill.is-unpaid{border-color:var(--el-color-danger-light-5,#fab6b6);background:var(--danger-50);color:var(--danger)}'))
assert(worklist.formConfig.cssCode.includes('.lab-context-top .lab-coverage-pill{border-color:var(--el-color-warning-light-5,#f3d19e);background:var(--warning-50);color:var(--warning)}'))
// 2026-09-22: ห้องแลปแสดงเฉพาะโหมดสืบค้นข้ามห้อง; รายการวันนี้ไม่เว้นคอลัมน์นี้
assert(worklist.formConfig.cssCode.includes('.lab-list-head.is-lookup,.lab-patient-row.is-lookup{grid-template-columns:32px minmax(190px,1.4fr) minmax(190px,1.35fr) 72px 82px 64px'))
assert(worklist.formConfig.cssCode.includes('110px 72px 78px 64px'), 'short row-action labels must fit without pushing the grid past its container')
assert(worklist.formConfig.cssCode.includes('.lab-plain-action{width:100%;min-width:0') && worklist.formConfig.cssCode.includes('white-space:nowrap'))
assert(widget.content.includes(":class=\"{'is-selectable':viewMode==='today'&&isPendingReceiveItem(item),'is-selected':isSelected(item.item_id)}\""))
assert(widget.content.includes('@click="selectRow(order,item,$event)"'))
assert(widget.onCreated.includes('s.selectRow=(order,item,event)=>'))
assert(widget.content.includes('class="lab-patient-row" :class="{\'is-lookup\':viewMode===\'lookup\'}" @click="toggleOrderFromRow(order,$event)"'))
assert(widget.onCreated.includes('s.toggleOrderFromRow=(order,event)=>'))
assert(worklist.formConfig.cssCode.includes('.lab-patient-row{') && worklist.formConfig.cssCode.includes('cursor:pointer'))
assert(widget.content.includes(':model-value="allSelectableChecked(order)"'))
assert(widget.content.includes(':indeterminate="someSelectableChecked(order)"'))
assert(widget.content.includes(':disabled="viewMode===\'lookup\'||!selectableItems(order).length"'))
assert(widget.content.includes('aria-label="เลือกทุกรายการที่รอรับ" @change="toggleAll(order)"'))
assert(worklist.formConfig.cssCode.includes('.lab-item-row.is-selectable{cursor:pointer}'))
assert(widget.content.includes('<div class="lab-item-check-cell"><el-checkbox'))
assert(widget.content.includes('<div data-label="เลือก" class="lab-item-check-cell"><el-checkbox'))
assert(worklist.formConfig.cssCode.includes('.lab-item-grid-wrap{overflow-x:auto;margin-left:-42px;padding-top:0}'))
assert(worklist.formConfig.cssCode.includes('grid-template-columns:42px 52px 100px'))
assert(worklist.formConfig.cssCode.includes('minmax(105px,.8fr) 96px;gap:10px;align-items:center;min-width:1316px'))
assert(worklist.formConfig.cssCode.includes('min-width:1316px;padding:6px 0}.lab-item-head{min-height:44px'))
assert(worklist.formConfig.cssCode.includes('.lab-item-check-cell{position:sticky;left:0;z-index:2'))
assert(worklist.formConfig.cssCode.includes('.lab-result-list{padding-top:0;overflow-x:auto;margin-left:-42px}'))
// 2026-09-21: lookup-specific four-column rule now sits between the shared grid and header styling.
assert(worklist.formConfig.cssCode.includes('grid-template-columns:52px minmax(260px,1.8fr) 130px 120px minmax(120px,.8fr);gap:12px;align-items:center;min-width:772px;padding:6px 0 6px 42px}'))
assert(worklist.formConfig.cssCode.includes('.lab-result-list-head{min-height:44px'))
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
assert(widget.content.includes('class="lab-refresh-button"'))
assert(widget.content.includes('aria-label="รีเฟรชรายการ"'))
assert(widget.content.includes('@click="refreshWorklist"'))
assert(widget.content.indexOf('class="lab-refresh-button"') > widget.content.indexOf('@click="openCreateOrder"'), 'refresh button must follow Create Order')
assert(widget.onCreated.includes("request.include_status_counts=true"), 'manual/new-order refresh must request batched daily counts')
assert(widget.onCreated.includes("payload&&payload.status_counts&&typeof payload.status_counts==='object'"), 'new Process response must skip the legacy recount calls')
assert(widget.onCreated.includes('s.refreshWorklist=()=>{s.loadOrders('))
assert(widget.onCreated.includes("if(s.viewMode==='today')s.counts={...s.counts,[s.statusKey]:Number(payload.total||0)}"), 'main list response must update the active status count immediately')
assert(widget.onCreated.includes("const batched=payload.status_counts"), 'daily count badges must consume the batched response')
assert(widget.onMounted.includes('s.refreshWorklist();'), 'initial daily load must use one batched refresh path')
assert(!widget.onMounted.includes('s.loadOrders();\n  s.refreshCounts();'), 'initial daily load must not start six duplicate count pipelines')
assert(worklist.formConfig.cssCode.includes('.lab-refresh-button{width:32px!important;height:32px'))
assert(widget.content.includes('@click="openEmr(order)"'))
assert(widget.content.includes(':key="order.row_key||order.order_id"'))
assert(widget.content.includes('isExpanded(order)'))
assert(widget.onCreated.includes('s.orderRowKey=o=>'))
assert(widget.content.includes('v-if="!isCancelledOrder(order)" class="lab-plain-action" size="small"'))
// 2026-09-02: user approved binding the verified live Report ID; PDF must now be row-scoped.
assert(!widget.content.includes("@click=\"notifyPending('ใบสั่ง')\""))
assert(widget.content.includes('<sd-report'), 'Worklist must bind the verified LAB Order Report')
/* 2026-09-21: ผู้ใช้กำหนดให้ PDF ใบสั่งตรวจแสดงเฉพาะ detail tab `order`;
   tab ผลต้องคงช่องว่างและใช้ปุ่มดูผล/HN ใน action ถัดไปตามเดิม */
assert(widget.content.includes('<template v-if="!isCancelledOrder(order)">'))
assert(widget.content.includes('v-if="detailTab(order)===\'order\'&&orderReportReady(order)"'))
assert(widget.content.includes('v-else-if="detailTab(order)===\'order\'" class="lab-plain-action" size="small" disabled'))
assert(widget.content.includes('<span v-else class="lab-action-placeholder" aria-hidden="true"></span>'))
assert(!widget.content.includes('v-if="!isCancelledOrder(order)&&orderReportReady(order)"'), 'Order request PDF must not remain visible on the result tab')
assert(widget.content.includes('title="Order นี้ไม่มี Order ID, Visit ID หรือ LAB Section สำหรับสร้าง PDF"'))
/* ผู้ใช้ยืนยัน 2026-09-21: ช่อง HN เดิมต้องยิง print agent ตรง ไม่เปิด sd-report preview */
assert(widget.content.includes('class="lab-plain-action lab-hn-print" size="small"'))
assert(widget.content.includes(':title="hnPrintHint(order)" @click="printHnLabel(order)">ปริ้น HN</el-button>'))
assert(widget.content.includes(':disabled="!hnOrderReportReady(order)||!!hnPrinting[orderRowKey(order)]"'))
assert(!widget.content.includes(':report-list="hnOrderReportList" :params="hnOrderReportParams(order)"'),
  'the HN row slot must not render the old sd-report preview')
assert(worklist.formConfig.cssCode.includes('.lab-hn-print{white-space:nowrap}'))
assert(widget.content.includes(":aria-label=\"'ดูผลของ '+(text(order.patient&&order.patient.hn)||'Order นี้')\""))
/* เปลี่ยน assertion เดิม 2026-09-04 ตามคำสั่งผู้ใช้: ปุ่มตรวจใหม่ต้องเรียก write action จริง
   และยังอยู่เฉพาะตำแหน่งเดิมบนแถวที่ยกเลิก/ปฏิเสธ */
assert(widget.content.includes('@click="retestOrder(order)">ตรวจใหม่</el-button>'))
assert(widget.content.includes(':loading="isRetesting(order)" :disabled="isRetesting(order)"'))
assert(widget.content.includes('v-if="!isCancelledOrder(order)" class="lab-plain-action" size="small" @click="openEmr(order)">EMR</el-button>'))
assert(widget.content.includes('<span v-else class="lab-action-placeholder" aria-hidden="true"></span>'))
assert(widget.content.includes("{{ statusKey==='cancelled' ? 'ดำเนินการ' : 'PDF' }}"))
assert(widget.content.includes("detailTab(order)==='results' ? 'ดูผล' : 'HN'"))
assert(widget.content.includes("{{ statusKey==='cancelled' ? '' : 'EMR' }}"))
assert(widget.onCreated.includes("s.isCancelledOrder=o=>['cancelled','rejected'].includes(s.orderStatus(o))"))
assert(widget.onCreated.includes("const ORDER_REQUEST_REPORT_ID='6a977ac8422c1ca959829f97'"))
// 2026-09-22: ผู้ใช้ย่อเฉพาะข้อความปุ่มเป็น “ใบสั่ง”; หัวคอลัมน์/Report binding ต้องคงเดิม
assert(widget.onCreated.includes("s.orderRequestReportList=ORDER_REQUEST_REPORT_ID?[{reportId:ORDER_REQUEST_REPORT_ID,label:'ใบสั่ง',type:'pdf'}]:[]"))
assert(widget.content.includes('title="Order นี้ไม่มี Order ID, Visit ID หรือ LAB Section สำหรับสร้าง PDF">ใบสั่ง</el-button>'))
// 2026-09-21: General LAB Result PDF belongs to the standard Order-level result popup.
assert(widget.onCreated.includes("const LAB_RESULT_PDF_REPORT_ID='6aa8f5a8b92813319a86ea11'"))
// 2026-09-22: Microbiology uses its own existing static Report Factory record.
assert(widget.onCreated.includes("const MICROBIOLOGY_RESULT_PDF_REPORT_ID='6ab1c2d3e4f5061728394a5b'"))
// 2026-09-22: คืนชื่อปุ่มใน popup ผลตรวจเป็น “รายงานผล”; จุดนี้ไม่ใช่ปุ่มแถวรายการที่ผู้ใช้ให้เปลี่ยน
assert(widget.onCreated.includes("s.labResultPdfReportList=LAB_RESULT_PDF_REPORT_ID?[{reportId:LAB_RESULT_PDF_REPORT_ID,label:'รายงานผล',type:'pdf'}]:[]"))
assert(widget.onCreated.includes("s.microbiologyResultPdfReportList=MICROBIOLOGY_RESULT_PDF_REPORT_ID?[{reportId:MICROBIOLOGY_RESULT_PDF_REPORT_ID,label:'รายงานผล',type:'pdf'}]:[]"))
assert(widget.content.includes('v-if="manual.orderView" class="lab-result-report-slot"'), 'PDF action must keep a fixed-width flex slot so the nested parameter dialog cannot shift the header button')
assert(widget.content.includes('v-if="labResultPdfReady()" class="lab-result-report-action"'))
assert(widget.content.includes(':report-list="activeLabResultPdfReportList()" :params="labResultPdfParams()"'))
assert(widget.content.includes('v-else class="lab-result-report-action"'))
assert(widget.content.includes(':title="labResultPdfHint()">รายงานผล</el-button>'))
assert(widget.onCreated.includes("s.activeLabResultPdfReportList=()=>s.isMicrobiologyResult()?s.microbiologyResultPdfReportList:s.labResultPdfReportList"))
assert(widget.onCreated.includes('return {xparentx:s.labResultPdfParentId()}'))
assert(widget.onCreated.includes('add(fallbackIds,fallbackSeen,group&&group.data&&group.data.result_report_id)'), 'locked Sensitive groups must still supply the parent for a redacted PDF')
assert(widget.onCreated.includes('if(rowIds.length)return rowIds'), 'clinical Result Item parents must win over a separate attachment container ID')
assert(!widget.onCreated.includes('params.grant_token'), 'LAB PDF must remain redacted even if a doctor grant exists elsewhere')
assert(worklist.formConfig.cssCode.includes('.lab-result-report-action .el-button:not(.is-disabled){border-color:var(--danger)!important;background:var(--danger)!important;color:#fff!important}'))
assert(worklist.formConfig.cssCode.includes('.lab-result-report-slot{display:flex;width:94px;min-width:94px;max-width:94px;flex:0 0 94px;align-items:flex-start;justify-content:flex-end}'), 'PDF action slot must retain its width while Report Parameters is open')
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
assert(widget.onCreated.includes("const HN_LABEL_PRINTER='HN/VN Sticker'"))
assert(widget.onCreated.includes("form.getFieldRef('local_agent')"))
assert(widget.onCreated.includes('agent.printReport(HN_ORDER_REPORT_ID,{'))
assert(widget.onCreated.includes("jobKey:'lab-hn-'+hn+'-'+Date.now()"))
assert(!widget.onCreated.includes('({xparentx:s.orderVisitId(o)})'))
// s.orderVisitId ยังต้องอยู่ครบ — EMR History และ PDF ใบสั่งตรวจยังใช้อยู่
assert(widget.onCreated.includes('s.orderVisitId=o=>'))
assert(widget.onCreated.includes('s.retestOrder=order=>'))
assert(widget.onCreated.includes("action:'retest_order'"))
assert(widget.content.includes('@click.stop="openItemRetest(order,item)">ตรวจใหม่</el-button>'))
assert(widget.content.includes('v-model="itemRetestDialog.visible" title="เปิดตรวจใหม่เฉพาะรายการ"'))
assert(widget.content.includes('LAB NO. ใหม่จะออกเมื่อกดรับ specimen รอบใหม่'))
assert(widget.onCreated.includes('s.canRetestItem=i=>'))
assert(widget.onCreated.includes('s.openItemRetest=(order,item)=>'))
assert(widget.onCreated.includes('s.submitItemRetest=async()=>'))
assert(widget.onCreated.includes("action:'retest_item'"))
assert(widget.onCreated.includes("item&&item.retest_pending_lab_no===true?'__RETEST__'+s.text(item.item_id)"))
assert(widget.onCreated.includes('section_codes:[sectionCode]'))
assert(!widget.onCreated.includes('s.mockRetest=order=>'))
assert(widget.content.includes(':disabled="!canReceiveOrder(order)||receiveLoading||rejectLoading||cancelDialog.loading"'))
assert(widget.content.includes('@click="receiveSelected(order)"'))
assert(widget.content.includes(':content="receiveDisabledReason(order)"'))
assert(widget.content.includes('class="lab-receive-tooltip"'))
assert(widget.onCreated.includes("s.isFinanceReadyItem=item=>s.text(item&&item.current_status).toLowerCase()==='ready'"))
assert(widget.onCreated.includes("return 'ยังไม่ผ่านการเงิน'"))
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
/* 2026-09-21: approved cross-room read-only lookup mode. */
assert(widget.content.includes("@click=\"setViewMode('today')\">รายการวันนี้</button>"))
assert(widget.content.includes("@click=\"setViewMode('lookup')\">สืบค้นผลแลป</button>"))
assert(widget.content.includes("@click=\"setLookupMode('results')\">"))
assert(widget.content.includes("<span>ผลห้องแลป</span><strong>{{ lookupCounts.results || 0 }}</strong>"))
assert(widget.content.includes("@click=\"setLookupMode('orders')\">"))
assert(widget.content.includes("<span>รายการที่สั่ง</span><strong>{{ lookupCounts.orders || 0 }}</strong>"))
assert(widget.content.includes('โปรดระบุ HN / เลือกวันที่'))
assert(widget.content.includes('อ่านอย่างเดียว · ทุกห้องแลป'))
assert(widget.content.includes('<div v-if="viewMode===\'lookup\'">ห้องแลป</div>'))
assert(widget.content.includes('v-if="viewMode===\'lookup\'" class="lab-metric lab-section-cell" data-label="ห้องแลป"><span class="lab-section-code">{{ reportSectionCode(order) || \'-\' }}</span>'))
assert(widget.content.includes(':disabled="viewMode!==\'today\'" :title="viewMode!==\'today\'?\'ใช้ปุ่มนี้จากแท็บรายการวันนี้\':\'\'"'))
assert(widget.content.includes('v-if="viewMode===\'today\'" class="lab-status-strip"'))
assert(widget.content.includes("v-if=\"detailTab(order)==='order'&&viewMode==='today'\" class=\"lab-bulk-actions\""))
assert(widget.content.includes("v-else-if=\"viewMode==='today'\" class=\"lab-plain-action\" type=\"primary\" size=\"small\""), 'Retest must remain hidden in lookup mode')
assert(widget.content.includes('v-if="viewMode===\'today\'" class="lab-result-upload"'), 'Upload must remain hidden in lookup mode')
assert(widget.onCreated.includes("p.cross_section=true"))
assert(widget.onCreated.includes("p.lookup_mode=lookupModeOverride||s.lookupMode"))
assert(widget.onCreated.includes("else if(hn)p.all_dates=true"))
assert(widget.onCreated.includes("s.lookupStatusMap={"))
assert(widget.onCreated.includes("results:['resulted','completed']"))
assert(widget.onCreated.includes("orders:['sent','accepted','prepared','ready','dispensed','resulted','completed','cancelled','rejected']"))
assert(widget.onCreated.includes("if(s.viewMode==='lookup')return false;"), 'read-only lookup must block edit/upload/selection helpers')
assert(widget.onCreated.includes("if(s.viewMode==='lookup'){field.notify('โหมดสืบค้นเป็นแบบอ่านอย่างเดียว'"), 'write handlers must fail closed in lookup mode')
assert(widget.onMounted.includes("params.action==='get_manual_result'&&s.viewMode==='lookup'"), 'lookup Result reads must add the cross-room capability at runtime')
assert(widget.onMounted.includes("cross_section:true,lookup_mode:'results'"))
assert(widget.onMounted.includes('return baseProcessCall(id,next)'), 'the wrapper must preserve the proven Process connector')
assert(worklist.formConfig.cssCode.includes('.lab-view-tabs{'))
assert(worklist.formConfig.cssCode.includes('.lab-lookup-empty{'))
assert(worklist.formConfig.cssCode.includes('.lab-section-code{'))
/* 2026-09-22: dedicated HM/MS1 CBC routing tab. It must be room-gated,
   keep details read-only, and expose only the explicit swap action. */
assert(widget.content.includes("v-if=\"canUseCbcSwap()\""))
assert(widget.content.includes("@click=\"setViewMode('cbc_swap')\""))
assert(widget.content.includes('สลับรายการ CBC'))
assert(widget.content.includes('<div></div><div>ผู้ป่วย</div><div></div><div>รายการ</div><div>Specimen</div><div>ห้องแลป</div>'), 'CBC Order row must keep the approved Worklist column pattern')
assert(widget.content.includes('<div>เวลาสั่ง / Order No.</div><div>แพทย์</div><div>สถานะ</div><div>ดำเนินการ</div>'))
assert(widget.content.includes('class="lab-context-tags"'), 'CBC Order row must keep the same patient context block as Today')
assert(widget.content.includes('class="lab-cbc-flag"'))
assert(widget.content.includes('v-for="code in cbcSectionCodes(order)"'), 'cross-section Orders must show all LAB room badges')
assert(widget.content.includes('v-for="step in orderStatusCounts(order)"'), 'CBC Order status must use the same Item-count dots as Today')
assert(widget.content.includes('แท็บนี้ดูอย่างเดียว — รับ specimen / ปฏิเสธ / ยกเลิก ทำที่แท็บ “รายการวันนี้”'))
assert(widget.content.includes('<div class="lab-cbc-item-grid lab-cbc-item-head"><div></div><div>ลำดับ</div><div>Lab no.</div><div>รายการสั่งตรวจ</div><div>specimen</div><div>เวลาเก็บ specimen</div><div>ห้องแลป</div><div>สถานะ</div><div>หมายเหตุ</div></div>'), 'CBC Item header must match the approved HTML')
assert(widget.content.includes("'is-cbc':isCbcSwapItem(order,item)"), 'the exact CBC Item must be highlighted')
assert(widget.content.includes('{{ cbcDateTime(item.specimen&&item.specimen.ordered&&item.specimen.ordered.collected_at) }}'), 'CBC collected time must use the full Buddhist year and minute precision from the approved HTML')
assert(widget.content.includes("{{ cbcItem(order).swap_allowed?'สลับได้':'สลับไม่ได้' }}"))
assert(!widget.content.includes('lab-cbc-detail-note'), 'obsolete five-column CBC detail must be removed')
assert(widget.content.includes('@click.stop="openCbcSwap(order)">สลับรายการ</el-button>'))
assert(widget.content.includes('v-model="cbcSwapDialog.visible" class="lab-cbc-swap-dialog" width="min(760px,94vw)"'))
assert(widget.content.includes('<strong>ยืนยันสลับรายการ CBC</strong>'))
assert(widget.content.includes('Order No. {{ text(cbcSwapOrder().order_number)'))
assert(widget.content.includes('class="lab-cbc-patient-card"'))
assert(widget.content.includes('class="lab-cbc-swap-cell is-from"'))
assert(widget.content.includes('class="lab-cbc-swap-cell is-target"'))
assert(widget.content.includes('รายการเดิมที่แพทย์สั่งถูกเก็บเป็นประวัติ'))
assert(widget.content.includes('v-model="cbcSwapDialog.reasonCode"'))
assert(widget.content.includes('v-for="option in cbcSwapReasonOptions"'))
assert(widget.content.includes("cbcSwapDialog.reasonCode==='other'"))
assert(widget.onCreated.includes("action:'list_cbc_swap'"))
assert(widget.onCreated.includes("action:'swap_cbc_item'"))
assert(widget.onCreated.includes("const CBC_SWAP_REASON_LABELS={doctor_wrong_room:'แพทย์เลือกรหัสผิดห้อง'"))
assert(widget.onCreated.includes('s.cbcSwapReasonText=()=>'))
assert(widget.onCreated.includes("s.canUseCbcSwap=()=>"))
assert(widget.onCreated.includes('s.isCbcSwapItem=(o,i)=>'))
assert(widget.onCreated.includes('s.cbcItemCountText=o=>'))
assert(widget.onCreated.includes('s.cbcSectionCodes=o=>'))
assert(widget.onCreated.includes('s.cbcDateTime=v=>'))
assert(widget.onCreated.includes("['M1003','M0104','M1004','20','20-22','21','HM','ML']"))
assert(widget.onCreated.includes('s.orders=s.orders.filter('), 'successful swap must remove the row immediately')
assert(worklist.formConfig.cssCode.includes('.lab-cbc-row{'))
assert(worklist.formConfig.cssCode.includes('.lab-cbc-swap-dialog .el-dialog__header{'))
assert(worklist.formConfig.cssCode.includes('.lab-cbc-patient-card{'))
assert(worklist.formConfig.cssCode.includes('.lab-cbc-swap-facts{'))
assert(worklist.formConfig.cssCode.includes('grid-template-columns:32px minmax(180px,1.35fr) minmax(170px,1.25fr) 70px 80px 92px'))
assert(worklist.formConfig.cssCode.includes('.lab-cbc-item-grid{display:grid;grid-template-columns:42px 52px 108px minmax(220px,1.6fr)'))
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
// 2026-09-21: รายการวันนี้ยังเริ่มด้วยวันปัจจุบัน ส่วนโหมดสืบค้นต้องเริ่มว่าง
assert(widget.onCreated.includes("s.todayFilters={hn:'',dates:[s.currentDay,s.currentDay]}"))
assert(widget.onCreated.includes("s.lookupFilters={hn:'',dates:[]}"))
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
assert(widget.onCreated.includes('s.rejectSelected=async order=>'))
assert(widget.content.includes('@click="openCancelOrder(order)">ยกเลิก order</el-button>'))
assert(widget.content.includes('ระบบจะยกเลิกเฉพาะ LAB Item ของ Section นี้ใน Order เดิม'))
assert(widget.content.includes('ยกเลิกเฉพาะฝั่ง HIS โดยไม่ส่งคำสั่งยกเลิกไป Agent/LIS'))
assert(widget.content.includes('ตรวจสอบสถานะการเงินอีกครั้ง'))
assert(widget.content.includes('cancelDialog.financeLoading||!cancelDialog.financeChecked||!cancelDialog.canCancel'))
assert(widget.content.includes('@click="submitCancelOrder">ยืนยันยกเลิก Section นี้</el-button>'))
assert(widget.content.includes('v-model="cancelDialog.reason" filterable clearable'))
assert(widget.content.includes('v-for="option in cancelReasonOptions"'))
assert(!widget.content.includes('v-model="cancelDialog.reason" type="textarea"'))
assert(!widget.content.includes('ถ้ารายการถูกส่งไป Agent/LIS แล้ว ระบบจะหยุด'))
assert(widget.onCreated.includes('s.canCancelOrder=order=>'))
assert(widget.onCreated.includes('s.openCancelOrder=async order=>'))
assert(widget.onCreated.includes('ยกเลิก Section นี้ได้เฉพาะรายการที่ยังรอรับหรือรับแล้วและยังไม่มีผลตรวจ'))
assert(!widget.onCreated.includes('ยกเลิกทั้ง Order ได้เฉพาะรายการที่ยังรอรับ'))
assert(widget.onCreated.includes('s.checkCancelFinance=async()=>'))
assert(widget.onCreated.includes("action:'check_cancel_finance'"))
assert(widget.onCreated.includes('s.submitCancelOrder=async()=>'))
assert(widget.onCreated.includes("action:'cancel_order'"))
assert(widget.onCreated.includes('section_codes:[s.reportSectionCode(order)]'))
assert(widget.onCreated.includes('const CANCEL_REASON_OPTIONS=Object.keys(CANCEL_REASON_LABELS)'))
assert(widget.onCreated.includes('reason=s.cancelReasonLabels[reasonCode]||reasonCode'))
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
  } else if (params.action === 'retest_item') {
    data = { success: true, message: 'เปิดตรวจใหม่เฉพาะรายการแล้ว · กลับไปรอรับ specimen · LAB NO. ใหม่จะสร้างเมื่อกดรับ', data: {
      item_id: params.item_id,
      order_id: params.order_id,
      order_number: params.order_number,
      section_code: params.section_codes[0],
      previous_work_item_id: params.item_id,
      work_item_id: '121212121212121212121212',
      attempt_no: 2,
      current_status: 'sent',
      work_status: 'waiting_receive',
      retest_pending_lab_no: true,
      retest_reason: params.retest_reason,
    } }
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
  } else if (params.action === 'check_cancel_finance') {
    data = { success: true, message: 'รายการยังไม่ชำระเงิน สามารถยกเลิกได้ทันที', data: {
      order_id: params.order_id,
      order_number: params.order_number,
      section_code: params.section_codes[0],
      can_cancel: true,
      finance_status: 'unpaid',
      finance_message: 'รายการยังไม่ชำระเงิน สามารถยกเลิกได้ทันที',
      receipt_numbers: [],
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
  } else if (params.action === 'get_reason_options') {
    data = { success: true, data: {
      reason_type: params.reason_type,
      section_code: params.reason_section_code,
      source: 'lab_reason_settings',
      options: params.reason_type === 'ORDER_CANCEL'
        ? [{ value: 'doctor_cancel', label: 'แพทย์ยกเลิกคำสั่งตรวจ' }]
        : [{ value: 'specimen_insufficient', label: 'ปริมาณสิ่งส่งตรวจไม่เพียงพอ' }],
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
      results: [{ result_item_id: 'aaaaaaaaaaaaaaaaaaaaaaaa', test_code: 'C23', test_name: 'Glucose', result_value: '98', unit: 'mg/dL', interpretation: 'N', reference_range: '70-100', result_source: 'agent', is_critical: false, redacted: false, redaction_reason: '' }],
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
const printJobs = []
let printAgentStub = null
const formHost = {
  formParams: { xsitex: 'SITE-1' },
  openForm: (...args) => opened.push(args),
  subFormClose: () => { subFormCloseCount++ },
  getFieldRef: name => (name === 'local_agent' && printAgentStub
    ? { getFieldEditor: () => printAgentStub }
    : null),
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
s.__initialLoadStarted = true
s.__unitWatch = true
new Function(widget.onMounted).call(field)

/* Result marker represents clinical criticality, never workflow status. */
assert.strictEqual(s.hasResultValue({ result_value: '' }), false, 'pending result must not render a marker')
assert.strictEqual(s.hasResultValue({ result_value: '0' }), true, 'zero is a recorded result and must render a marker')
assert.strictEqual(s.resultSignalClass({ result_value: '120', is_critical: true }), 'is-critical')
assert.strictEqual(s.resultSignalClass({ result_value: '90', is_critical: false }), 'is-normal')
assert.strictEqual(s.resultSignalClass({ result_value: '90' }), 'is-normal', 'recorded result without a critical flag is non-critical')
const manualBeforeSummaryCheck = s.manual
s.manual = {
  ...s.manual,
  orderView: true,
  order: { items: [{ current_status: 'completed' }] },
  groups: [{
    group_key: 'panel:C25',
    results: [
      { result_value: '6.8', interpretation: 'H', is_critical: true },
      { result_value: '133', interpretation: 'L', is_critical: false },
    ],
  }],
}
assert.strictEqual(s.standardResultStatusValue(), 'final', 'header status must follow the completed Order state')
assert.strictEqual(s.standardResultStatusText(), 'Final')
assert.strictEqual(s.manualCriticalCount(), 1)
assert.strictEqual(s.manualAbnormalCount(), 1, 'critical results must not be counted again as abnormal')
s.manual = manualBeforeSummaryCheck

/* 2026-09-29: one Agent callback can be returned through several CPOE Items.
   The Order popup must merge them into one whole-sheet revision without
   duplicating an observation that appears in more than one Item response. */
const mergedRevisionCheck = s.mergeResultRevisions([
  { revisions: [{ revision_id: 'REV-2', report_seq: '2', received_at: '2026-09-29 10:20:00', items: [{ test_code: 'NA', result_value: '137' }] }, { revision_id: 'REV-1', report_seq: '1', received_at: '2026-09-29 10:10:00', items: [{ test_code: 'NA', result_value: '136' }] }] },
  { revisions: [{ revision_id: 'REV-2', report_seq: '2', received_at: '2026-09-29 10:20:00', items: [{ test_code: 'K', result_value: '4.2' }, { test_code: 'NA', result_value: '137' }] }] },
])
assert.strictEqual(mergedRevisionCheck.length, 2)
assert.deepStrictEqual(mergedRevisionCheck[0].items.map(item => item.test_code), ['NA', 'K'])
assert.strictEqual(mergedRevisionCheck[0].latest, true)
assert.strictEqual(mergedRevisionCheck[0].no, 2)
assert.strictEqual(mergedRevisionCheck[1].latest, false)

/* เปลี่ยนตามคำสั่งผู้ใช้ 2026-09-03: ช่องไม่มีข้อมูลต้องว่าง ไม่ใช้ขีดแทน */
assert.strictEqual(s.datePart(''), '')
assert.strictEqual(s.timePart(null), '')
assert.strictEqual(s.compactDateTime(''), '')
assert.strictEqual(s.rejectReasonText({}), '')
assert.strictEqual(s.actionActorText({}), '')
assert.strictEqual(s.resultTime({}), '')

assert.strictEqual(s.ageText({ patient: { age: '3y 3m 3d' } }), '3y 3m 3d')
assert.strictEqual(s.orderAgeText({ patient: { age: '3y 3m 3d' } }), '3 ปี 3 เดือน 3 วัน')
assert.strictEqual(s.orderAgeText({ patient: { age: '25y 1m 14d' } }), '25 ปี 1 เดือน 14 วัน')
assert.strictEqual(s.orderAgeText({ patient: { age: 41 } }), '41 ปี  เดือน  วัน')
assert.strictEqual(s.orderAgeText({ patient: { age: '26' } }), '26 ปี  เดือน  วัน')
assert.strictEqual(s.orderAgeText({ patient: { age: '1m 5d' } }), ' ปี 1 เดือน 5 วัน')
assert.strictEqual(s.orderAgeText({ patient: { age: { years: 2, months: 4, days: 0 } } }), '2 ปี 4 เดือน 0 วัน')
assert.strictEqual(s.orderAgeText({ patient: { age: '' } }), '')
assert(widget.content.includes('<span v-if="orderAgeText(order)">{{ orderAgeText(order) }}</span>'))
assert.strictEqual((widget.content.match(/orderAgeText\(order\)/g)||[]).length, 4, 'normal and CBC Order rows must both use the age formatter in v-if and display')
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
assert.strictEqual(s.showCashPayment({ finance: { coverage: [{ inscl_item_main: { value: 'CASH' } }], total_amount: 100, paid_amount: 100 } }), true)
assert.strictEqual(s.showCashPayment({ finance: { coverage: [{ inscl_item_main: { value: 'CASH' } }], total_amount: 100, paid_amount: 0 } }), true)
assert.strictEqual(s.showCashPayment({ finance: { coverage: [], total_amount: 100, paid_amount: 0 } }), true)
assert.strictEqual(s.showCashPayment({ finance: { coverage: [{ inscl_item_main: { value: 'OFC' } }], total_amount: 100, paid_amount: 0 } }), false)
assert.strictEqual(s.showCashPayment({ finance: { coverage: [{ inscl_item_main: { value: 'CASH' } }], total_amount: 0, paid_amount: 0 } }), false)
assert.strictEqual(s.isFinancePassed({ items: [{ current_status: 'sent' }], finance: { total_amount: 100, paid_amount: 100 } }), false, 'sent means Finance has not passed even when amount fields look paid')
assert.strictEqual(s.isFinancePassed({ items: [{ current_status: 'ready' }], finance: { total_amount: 100, paid_amount: 0 } }), true, 'ready is the explicit Finance-passed state')
assert.strictEqual(s.isFinancePassed({ items: [{ current_status: 'accepted' }, { current_status: 'completed' }], finance: { total_amount: 100, paid_amount: 0 } }), true, 'post-receipt/result states already passed the Finance gate')
assert.strictEqual(s.isFinancePassed({ items: [{ current_status: 'ready' }, { current_status: 'sent' }], finance: { total_amount: 100, paid_amount: 100 } }), false, 'a mixed Order remains unpaid until every active Item passes Finance')
assert.strictEqual(s.isFinancePassed({ items: [{ current_status: 'cancelled' }], finance: { total_amount: 100, paid_amount: 0 } }), false, 'terminal-only Orders fall back to actual payment evidence')
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
  'รอรับ 1 รายการ · รับแล้ว 1 รายการ',
)
assert.strictEqual(s.isCancelledOrder({ items: [{ current_status: 'cancelled' }, { current_status: 'rejected' }] }), true)
assert.strictEqual(s.isCancelledOrder({ items: [{ current_status: 'rejected' }, { current_status: 'rejected' }] }), true)
assert.strictEqual(s.isCancelledOrder({ items: [{ current_status: 'rejected' }, { current_status: 'sent' }] }), false)
assert.deepStrictEqual(s.itemTooltipLines(tooltipOrder), ['C34 Gamma GT', 'C64 Ammonia'])
assert.deepStrictEqual(s.specimenTooltipLines(tooltipOrder), [
  'Clotted blood · C34 Gamma GT',
  'EDTA blood · C64 Ammonia',
])
// 2026-10-01: fixture email replaced with a placeholder when creator stamps were scrubbed
// from the repo. The "Name (email)" shape is deliberately kept — stripping the parenthesised
// address is exactly what requesterName() must do, so this assertion stays as strict as before.
assert.strictEqual(
  s.requesterName({ requester: { visit_doctor: 'Nichada Patcharasumransuk (doctor.one@example.invalid)' } }),
  'Nichada Patcharasumransuk',
)
assert.strictEqual(
  s.requesterName({ requester: { visit_doctor: 'ศิรชัย ปิยะชน ( )' } }),
  'ศิรชัย ปิยะชน',
)
assert(!Object.prototype.hasOwnProperty.call(s.params(['sent'], 30, 1), 'section_codes'))
assert.strictEqual(s.params(['sent'], 30, 1).organization_code, '10')

/* Cross-room lookup opens blank, accepts exact HN for all dates or a finite date range,
   and remains read-only while the original daily mode is preserved. */
assert.strictEqual(s.viewMode, 'today')
assert.deepStrictEqual(s.filters, { hn: '', dates: [s.currentDay, s.currentDay] })
const lookupCallsBeforeOpen = processCalls.length
const lookupSavedLoad = s.loadOrders
const lookupSavedRefreshCounts = s.refreshCounts
const lookupSavedRefreshLookupCounts = s.refreshLookupCounts
let lookupLoads = 0
let lookupCountLoads = 0
let todayCountLoads = 0
s.loadOrders = () => { lookupLoads++ }
s.refreshLookupCounts = () => { lookupCountLoads++ }
s.refreshCounts = () => { todayCountLoads++ }
s.orders = [{ order_id: 'SHOULD-CLEAR' }]
s.setViewMode('lookup')
assert.strictEqual(s.viewMode, 'lookup')
assert.strictEqual(s.lookupMode, 'results')
assert.strictEqual(s.lookupSearched, false)
assert.deepStrictEqual(s.filters, { hn: '', dates: [] })
assert.deepStrictEqual(s.orders, [])
assert.strictEqual(processCalls.length, lookupCallsBeforeOpen, 'opening lookup must not call the API')
/* 2026-09-21: scan-code-ui also receives pasted HN. The accepted value must
   remain visible in the controlled search field until the user clears it. */
s.scanPatientHn('HN 6900049')
assert.strictEqual(s.scanMode, true)
assert.strictEqual(s.scannedHn, '6900049')
assert.strictEqual(s.filters.hn, '6900049', 'pasted/scanned HN must remain visible in the search input')
assert.strictEqual(s.lookupSearched, true)
s.clearScan()
assert.strictEqual(s.scanMode, false)
assert.strictEqual(s.scannedHn, '')
assert.deepStrictEqual(s.filters, { hn: '', dates: [] }, 'clear scan must clear both scanner state and visible input')
assert.strictEqual(s.lookupSearched, false)
lookupLoads = 0
lookupCountLoads = 0
todayCountLoads = 0
s.applyFilters()
assert.strictEqual(s.lookupSearched, false, 'empty lookup must stay on the instruction state')
assert.strictEqual(lookupLoads, 0)
assert.strictEqual(lookupCountLoads, 0)
s.filters = { hn: '6900049', dates: [] }
s.applyFilters()
assert.strictEqual(s.lookupSearched, true)
assert.strictEqual(lookupLoads, 1)
assert.strictEqual(lookupCountLoads, 1)
const lookupHnParams = s.params(s.lookupStatusMap.results, 30, 1)
assert.strictEqual(lookupHnParams.cross_section, true)
assert.strictEqual(lookupHnParams.lookup_mode, 'results')
assert.strictEqual(lookupHnParams.hn, '6900049')
assert.strictEqual(lookupHnParams.all_dates, true)
assert(!Object.prototype.hasOwnProperty.call(lookupHnParams, 'date_from'))
s.filters = { hn: '', dates: ['2026-09-01', '2026-09-21'] }
const lookupDateParams = s.params(s.lookupStatusMap.results, 30, 1)
assert.strictEqual(lookupDateParams.cross_section, true)
assert.strictEqual(lookupDateParams.lookup_mode, 'results')
assert.strictEqual(lookupDateParams.date_from, '2026-09-01')
assert.strictEqual(lookupDateParams.date_to, '2026-09-21')
assert(!Object.prototype.hasOwnProperty.call(lookupDateParams, 'all_dates'))
await s.processCall('6a9434c3422c1ca959829d5e', {
  action: 'get_manual_result',
  organization_code: '10',
  item_id: 'LOOKUP-RESULT-ITEM',
})
const crossRoomResultRead = processCalls.at(-1)
assert.strictEqual(crossRoomResultRead.params.cross_section, true)
assert.strictEqual(crossRoomResultRead.params.lookup_mode, 'results')
processCalls.length = 0
s.setLookupMode('orders')
assert.strictEqual(s.lookupMode, 'orders')
assert.strictEqual(lookupLoads, 2)
assert.deepStrictEqual(s.lookupStatusMap.orders, ['sent', 'accepted', 'prepared', 'ready', 'dispensed', 'resulted', 'completed', 'cancelled', 'rejected'])
const lookupWriteItem = { item_id: 'LOOKUP-ITEM', current_status: 'sent' }
assert.deepStrictEqual(s.selectableItems({ items: [lookupWriteItem] }), [])
assert.strictEqual(s.canReceiveOrder({ items: [lookupWriteItem] }), false)
assert.strictEqual(s.canCancelOrder({ items: [lookupWriteItem] }), false)
assert.strictEqual(s.canEditResult(), false)
assert.strictEqual(s.canUploadResultFile(), false)
s.setViewMode('today')
assert.strictEqual(s.viewMode, 'today')
assert.deepStrictEqual(s.filters, { hn: '', dates: [s.currentDay, s.currentDay] })
assert.strictEqual(lookupLoads, 3, 'returning to today reloads the daily worklist once')
assert.strictEqual(todayCountLoads, 1, 'returning to today refreshes daily counts once')
s.loadOrders = lookupSavedLoad
s.refreshCounts = lookupSavedRefreshCounts
s.refreshLookupCounts = lookupSavedRefreshLookupCounts

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
// 2026-09-24: ผู้ใช้ยืนยันว่า Finance มีหน้าที่ปิดปุ่มรับ specimen เท่านั้น;
// สถานะงาน LAB ทั้งก่อนและหลังผ่านการเงินต้องยังแสดง “รอรับ”.
assert.strictEqual(s.statusText('sent'), 'รอรับ')
assert.strictEqual(s.statusText('ready'), 'รอรับ')
assert.strictEqual(s.receiveDisabledReason(itemOrder), 'ยังไม่ผ่านการเงิน', 'hovering disabled Receive on an unpaid Order must explain the Finance gate')
s.selectRow(itemOrder, item, { target: normalRowTarget })
assert.strictEqual(s.isSelected(item.item_id), true, 'clicking a selectable Item row must select it')
assert.strictEqual(s.canReceiveOrder(itemOrder), false, 'sent Item is selectable for reject/specimen work but must not be receivable before Finance')
assert.strictEqual(s.receiveDisabledReason(itemOrder), 'ยังไม่ผ่านการเงิน')
item.current_status = 'ready'
assert.strictEqual(s.canReceiveOrder(itemOrder), true, 'Finance-ready Item may be received')
assert.strictEqual(s.receiveDisabledReason(itemOrder), '')
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

for (const sectionCode of ['IM', 'MI-OUT']) {
  const immunologyItem = { ...item, item_id: 'ITEM-' + sectionCode, section: { code: sectionCode } }
  const processCallCount = processCalls.length
  assert.strictEqual(s.isImmunologyItem(immunologyItem), true)
  await s.setSpecimen(immunologyItem, 'BL')
  assert.strictEqual(processCalls.length, processCallCount, sectionCode + ' must not call update_specimen')
  assert.strictEqual(s.specimenEdits[immunologyItem.item_id], undefined)
}
assert.strictEqual(s.isImmunologyItem({ ...item, section: { code: 'BC' } }), false)

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
assert(!Object.prototype.hasOwnProperty.call(processCalls.at(-1).params, 'cross_section'), 'daily result reads must remain Organization-scoped')
assert(!Object.prototype.hasOwnProperty.call(processCalls.at(-1).params, 'lookup_mode'))
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
// 2026-09-23: ผู้ใช้ให้แท็บออกผลแสดงสถานะจริงจาก Work Item แทนการอนุมานจาก resulted_at;
// Critical ยังเป็นคนละแกนและห้ามเปลี่ยนชื่อสถานะ Item เหมือนเดิม.
assert.strictEqual(s.resultStatusText(mycologyItem), 'ออกผลบางส่วน')
assert.strictEqual(s.resultStatusText({ ...mycologyItem, is_critical: true }), 'ออกผลบางส่วน')
assert.strictEqual(s.resultStatusText({ ...mycologyItem, is_critical: false }), 'ออกผลบางส่วน')
assert.strictEqual(s.resultStatusText({ ...mycologyItem, current_status: 'completed' }), 'ออกผลครบ')
assert.strictEqual(s.resultStatusText({ ...mycologyItem, current_status: 'accepted', resulted_at: '' }), 'รอผล')
assert.strictEqual(
  s.resultTime({ ...mycologyItem, resulted_at: '', latest_result_at: '2026-09-23T16:08:42.918+07:00' }),
  '16:08:42',
  'Partial result time must come from latest_result_at without requiring Final completion time',
)
assert.strictEqual(s.criticalValue(mycologyItem), null)
assert.strictEqual(s.criticalValue({ ...mycologyItem, is_critical: true }), true)
assert.strictEqual(s.criticalValue({ ...mycologyItem, is_critical: false }), false)

// 2026-09-25 user requirement: Manual save remains Partial; a separate,
// server-validated confirmation promotes the complete Order/Section to Final.
const manualFinalItemA = { item_id: '565656565656565656565656', current_status: 'resulted', section: { code: 'MY' } }
const manualFinalItemB = { item_id: '787878787878787878787878', current_status: 'resulted', section: { code: 'MY' } }
const manualFinalOrder = {
  order_id: '909090909090909090909090',
  section_code: 'MY',
  items: [manualFinalItemA, manualFinalItemB],
}
const manualFinalRowA = {
  result_item_id: '111111111111111111111111',
  result_value: 'Candida tropicalis',
  result_source: 'manual',
  result_status: 'entered',
  _item: manualFinalItemA,
  _item_id: manualFinalItemA.item_id,
}
const manualFinalRowB = {
  result_item_id: '222222222222222222222222',
  result_value: 'No growth',
  result_source: 'manual',
  result_status: 'entered',
  _item: manualFinalItemB,
  _item_id: manualFinalItemB.item_id,
}
s.manual = {
  visible: true,
  loading: false,
  saving: false,
  finalizing: false,
  uploading: false,
  editing: false,
  orderView: true,
  item: null,
  order: manualFinalOrder,
  data: { section_code: 'MY', results: [] },
  groups: [
    { item_id: manualFinalItemA.item_id, load_failed: false, results: [manualFinalRowA] },
    { item_id: manualFinalItemB.item_id, load_failed: false, results: [manualFinalRowB] },
  ],
  editRows: [],
  editMap: {},
  attachments: [],
}
assert.strictEqual(s.canFinalizeManualResults(), true, 'all persisted Manual values must enable the explicit Final action')
manualFinalRowB.result_value = ''
assert.strictEqual(s.canFinalizeManualResults(), false, 'one missing Manual value must keep Final disabled')
manualFinalRowB.result_value = 'No growth'
manualFinalRowB.result_source = 'agent'
assert.strictEqual(s.canFinalizeManualResults(), false, 'the Manual Final action must not finalize LIS/Agent rows')
manualFinalRowB.result_source = 'manual'
const manualFinalizeProcessCall = s.processCall
const manualFinalizeRefreshCounts = s.refreshCounts
const manualFinalizeCalls = []
let manualFinalizeRefreshCount = 0
s.processCall = async (id, params) => {
  manualFinalizeCalls.push({ id, params })
  return { success: true, message: 'ยืนยันออกผลครบแล้ว', data: {
    item_ids: [manualFinalItemA.item_id, manualFinalItemB.item_id],
    completed_at: '2026-09-25 14:30:00',
    completed_by: 'Lab Approver',
    verified_by_source_id: 'LAB-APPROVER-1',
    verified_by_source_name: 'Lab Approver',
  } }
}
s.refreshCounts = () => { manualFinalizeRefreshCount += 1 }
const manualFinalizeConfirmationCount = confirmations.length
await s.requestFinalizeManualResults()
assert.strictEqual(confirmations.length, manualFinalizeConfirmationCount + 1, 'Final must require an explicit confirmation')
assert.strictEqual(manualFinalizeCalls.length, 1)
assert.strictEqual(manualFinalizeCalls[0].params.action, 'finalize_manual_results')
assert.strictEqual(manualFinalizeCalls[0].params.order_id, manualFinalOrder.order_id)
assert.strictEqual(manualFinalizeCalls[0].params.section_code, 'MY')
assert.strictEqual(manualFinalItemA.current_status, 'completed')
assert.strictEqual(manualFinalItemB.current_status, 'completed')
assert.strictEqual(manualFinalRowA.result_status, 'final')
assert.strictEqual(manualFinalRowB.result_status, 'final')
assert.strictEqual(s.standardResultStatusText(), 'Final')
assert.strictEqual(s.resultVerifierName(), 'Lab Approver')
assert.strictEqual(s.canFinalizeManualResults(), false, 'a completed Order must not offer Final again')
assert.strictEqual(manualFinalizeRefreshCount, 1)
s.processCall = manualFinalizeProcessCall
s.refreshCounts = manualFinalizeRefreshCounts

const microbiologyItem = {
  item_id: 'MB-ITEM-1',
  item_code: '400199',
  item_name: 'Gram stain',
  current_status: 'resulted',
  section: { code: 'MB' },
}
const microbiologyRows = [
  { test_code: '400199', test_name: '4001', result_value: '* Aerobic Culture *\n1. Acinetobacter baumannii (CRAB_PXDR)\nPIPERAC/TAZO..  > 128*  R', result_status: 'F', entered_at: '2026-09-14 09:14:00' },
]
s.manual = {
  ...s.manual,
  visible: true,
  orderView: false,
  item: microbiologyItem,
  order: { order_id: 'ORDER-MB', items: [microbiologyItem] },
  data: { section_code: 'MB', test_code: '400199', test_name: 'Gram stain', results: microbiologyRows },
  groups: [],
  editing: false,
  editRows: [],
  editMap: {},
}
assert.strictEqual(s.isMicrobiologyItem(microbiologyItem), true)
assert.strictEqual(s.isMicrobiologyResult(), true, 'custom viewer must activate for MB')
assert.strictEqual(s.labResultPdfReady(), false, 'Item-level MLab/MB popup must not expose the Order result PDF')
assert.deepStrictEqual(s.activeLabResultPdfReportList(), [{ reportId: '6ab1c2d3e4f5061728394a5b', label: 'รายงานผล', type: 'pdf' }])
assert.deepStrictEqual(s.labResultPdfParams(), {}, 'static Microbiology report must not receive the general xparentx parameter')
s.manual.orderView = true
assert.strictEqual(s.labResultPdfReady(), true, 'Order-level MLab/MB popup must enable the existing static Microbiology PDF')
s.manual.orderView = false
assert.strictEqual(s.isMicrobiologyItem(mycologyItem), false, 'MY must keep the standard result popup')
assert.strictEqual(s.canEditResult(), false, 'MB custom viewer is read-only')
s.startManualEdit()
assert.strictEqual(s.manual.editing, false, 'MB must never enter manual edit mode from the viewer')
const microbiologyGroup = s.resultGroupsForDisplay()[0]
assert.strictEqual(microbiologyGroup.test_code, '400199')
assert.strictEqual(microbiologyGroup.test_name, 'Gram stain', 'ordered HIS item name must remain authoritative')
assert.deepStrictEqual(s.microResultRows(microbiologyGroup), microbiologyRows.map((row, index) => ({
  ...row,
  _item: microbiologyItem,
  _item_id: 'MB-ITEM-1',
  _edit_key: 'MB-ITEM-1|400199|' + index,
})))
assert.strictEqual(s.microResultRows(microbiologyGroup)[0].test_name, '4001', 'MLab source name/code must remain visible without changing the HIS item name')
assert(String(s.microResultRows(microbiologyGroup)[0].result_value).includes('* Aerobic Culture *'), 'raw MLab result must be shown unchanged even when its title conflicts with the mapped code')
assert.strictEqual(s.microGroupStatusText(microbiologyGroup), 'Final')
assert.strictEqual(s.microOverallStatusText(), 'Final')
const microbiologyMappedGroups = s.groupOrderResultGroups([
  { item_id: 'MB-GRAM', test_code: '400199', test_name: 'Gram stain', panel: { set_code: 'MB-CULTURE', set_name: 'Microbiology' }, data: { section_code: 'MB' }, results: [{ test_code: '400199', result_value: '* Aerobic Culture *' }] },
  { item_id: 'MB-ANAEROBIC', test_code: '400999', test_name: 'Anaerobic culture', panel: { set_code: 'MB-CULTURE', set_name: 'Microbiology' }, data: { section_code: 'MB' }, results: [] },
])
assert.strictEqual(microbiologyMappedGroups.length, 2, 'MB results must remain mapped one-to-one to ordered HIS Items even when both Items share a panel')
assert.deepStrictEqual(microbiologyMappedGroups.map(group => [group.test_code, group.test_name]), [
  ['400199', 'Gram stain'],
  ['400999', 'Anaerobic culture'],
])

const rawUnmatchedMlab = [
  'SPECIMEN: Blood-Hemoculture 1',
  ' * Aerobic Culture *',
  ' 1. Escherichia coli..(CRE_PXDR)',
].join('\n')
const unmatchedReceipt = {
  receipt_id: 'RECEIPT-MB-UNMATCHED',
  result_uid: 'RESULT-MB-UNMATCHED',
  items: [{ obs_code: 'UNEXPECTED-MB', value: rawUnmatchedMlab }],
}
s.manual = {
  ...s.manual,
  orderView: true,
  data: { section_code: 'MB', patient_hn: '6900049', lab_no: '406909180002' },
  groups: [
    { item_id: 'MB-GRAM', test_code: '400199', test_name: 'Gram stain', results: [], unmatched_receipts: [unmatchedReceipt] },
    { item_id: 'MB-ANAEROBIC', test_code: '400999', test_name: 'Anaerobic culture', results: [], unmatched_receipts: [unmatchedReceipt] },
  ],
}
assert.strictEqual(s.microUnmatchedFallback(), true, 'raw fallback activates only when no ordered MB item has a mapped result')
assert.strictEqual(s.microUnmatchedReceipts().length, 1, 'the same Receipt returned with multiple ordered Items must be deduplicated')
assert.strictEqual(s.microUnmatchedRawText(), rawUnmatchedMlab, 'fallback must preserve the MLab result text verbatim')
assert.strictEqual(s.microUnmatchedOpen, true, 'raw fallback must open by default')
s.manual.groups[0].results = [{ test_code: '400199', result_value: 'Gram Negative Bacilli' }]
assert.strictEqual(s.microUnmatchedFallback(), false, 'a mapped clinical result must keep the normal MB viewer')

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
const hiddenPopupGroup = s.resultGroup(
  { ...biochemistryItem, item_id: 'BC-HIDDEN-ITEM' },
  { order_id: 'ORDER-BC-HIDDEN' },
  { is_hide_result: true, test_code: 'C25.2', test_name: 'Potassium', results: [{ result_item_id: 'bbbbbbbbbbbbbbbbbbbbbbbb', test_code: 'C25.2', test_name: 'Potassium', result_value: '4.23', unit: 'mmol/L', interpretation: 'N', reference_range: '3.3-4.6', is_critical: true }] },
)
assert.notStrictEqual(hiddenPopupGroup.results[0].redacted, true, 'manual hide must not redact the owning LAB popup')
assert.strictEqual(hiddenPopupGroup.results[0].result_value, '4.23')
assert.strictEqual(hiddenPopupGroup.results[0].unit, 'mmol/L')
assert.strictEqual(hiddenPopupGroup.results[0].interpretation, 'N')
assert.strictEqual(hiddenPopupGroup.results[0].reference_range, '3.3-4.6')
assert.strictEqual(hiddenPopupGroup.results[0].is_critical, true)
assert.strictEqual(s.canEditResultRow(hiddenPopupGroup.results[0]), true)
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
assert.strictEqual(s.correctionReasonRequired(), true)
await s.saveResult()
const correctionSaveCall = processCalls.filter(call => call.params.action === 'save_result_edits').at(-1)
assert(correctionSaveCall)
assert.strictEqual(correctionSaveCall.params.results[0].result_item_id, 'aaaaaaaaaaaaaaaaaaaaaaaa')
assert.strictEqual(correctionSaveCall.params.results[0].result_value, '101')
assert.strictEqual(correctionSaveCall.params.correction_reason, '', 'correction reason must be optional')
assert(correctionSaveCall.params.request_id.startsWith('lab-result-correction-'))
assert.strictEqual(s.manual.data.results[0].result_source, 'agent', 'HIS correction must not replace the original source')
assert.strictEqual(s.manual.attachments.length, 1)

assert.strictEqual(s.resultHidden(), false)
await s.openItemResultVisibility(biochemistryItem, { order_id: 'ORDER-BC' })
assert.strictEqual(processCalls.at(-1).params.action, 'get_manual_result', 'Item visibility button must load the persisted Result Item before changing visibility')
assert.strictEqual(s.visibilityDialog.visible, true)
assert.strictEqual(s.visibilityDialog.targetHidden, true)
s.visibilityDialog.reason = ''
await s.submitResultVisibility()
const hideCall = processCalls.filter(call => call.params.action === 'set_result_visibility').at(-1)
assert(hideCall)
assert.strictEqual(hideCall.params.item_id, 'BC-ITEM-1')
assert.strictEqual(hideCall.params.hidden, true)
assert.strictEqual(hideCall.params.reason, '', 'hide reason must be optional')
assert.strictEqual(biochemistryItem.is_hide_result, true)
assert.strictEqual(s.resultHidden(), true)
assert.strictEqual(s.resultVisibilityActor(), 'Earn Admin')
assert.strictEqual(s.visibilityDialog.visible, false)
assert.strictEqual(s.manual.data.results[0].result_value, '98', 'visibility action must keep the owning LAB result editable')
assert.strictEqual(s.manual.data.results[0].redacted, false)
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
const attachmentsBeforeLimitCheck = s.manual.attachments
s.manual = { ...s.manual, uploading: false, attachments: Array.from({ length: 10 }, (_, index) => ({ name: `existing-limit-${index}.pdf`, size: 1024 })) }
assert.strictEqual(s.beforeResultUpload({ name: 'eleventh.pdf', type: 'application/pdf', size: 1024 }), false, 'custom validation must enforce the 10-file maximum without controlling Element Plus file-list')
s.manual = { ...s.manual, uploading: false, attachments: Array.from({ length: 4 }, (_, index) => ({ name: `existing-${index}.pdf`, size: 10 * 1024 * 1024 })) }
assert.strictEqual(s.beforeResultUpload({ name: 'within-total.pdf', type: 'application/pdf', size: 10 * 1024 * 1024 }), true, '50 MB combined must remain valid')
s.manual = { ...s.manual, uploading: false, attachments: Array.from({ length: 5 }, (_, index) => ({ name: `existing-over-${index}.pdf`, size: 9 * 1024 * 1024 })) }
assert.strictEqual(s.beforeResultUpload({ name: 'over-total.pdf', type: 'application/pdf', size: 6 * 1024 * 1024 }), false, 'combined payload above 50 MB must be rejected')
s.manual = { ...s.manual, uploading: false, attachments: attachmentsBeforeLimitCheck }
s.resultUploadReservations = {}
s.resultUploadPersistPending = 0
s.resultUploadBatchSucceeded = 0
s.resultUploadBatchFailed = 0
s.syncResultUploadState()

/* 2026-09-21: the saved CPOE Order contains the set's child Items. Order-level
   ดูผล must regroup them under the selected Parent/set heading; Item rows now
   expose only the audited hide/unhide action. */
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
const aggregateResultReportId = 'dddddddddddddddddddddddd'
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
      result_report_id: aggregateResultReportId,
      test_code: electrolyteItems[electrolyteIndex].item_code,
      test_name: ['Sodium', 'Potassium', 'Chloride', 'Total Carbondioxide'][electrolyteIndex],
      result_value: electrolyteValues[electrolyteIndex],
      reported_at: '2026-09-23 12:08:00',
      reported_by_source_id: 'TECH001',
      reported_by_source_name: 'ผู้รายงานผล',
      verified_at: '2026-09-23 12:09:00',
      verified_by_source_id: 'APPROVER001',
      verified_by_source_name: 'ผู้ยืนยันผล',
      is_critical: electrolyteIndex === 1,
    }],
  } }
  if (params.item_id === osmolalityItem.item_id) return { success: true, data: {
    item_id: osmolalityItem.item_id,
    test_code: 'C43',
    test_name: osmolalityItem.item_name,
    patient_hn: 'HN-PANEL',
    results: [
      { result_item_id: '333333333333333333333333', result_report_id: aggregateResultReportId, test_code: 'C43', test_name: 'Osmolality', result_value: osmolalityValue, is_critical: false },
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
assert.deepStrictEqual(
  [
    s.resultRowNumber(s.resultGroupsForDisplay()[0], 0, 0),
    s.resultRowNumber(s.resultGroupsForDisplay()[0], 0, 3),
    s.resultRowNumber(s.resultGroupsForDisplay()[1], 1, 0),
  ],
  ['1.1', '1.4', '2'],
  'numbering must match the approved HTML: ordered-test index, then profile child index',
)
assert.strictEqual(s.resultGroupIsProfile(s.resultGroupsForDisplay()[0]), true)
assert.strictEqual(s.resultGroupExpanded(s.resultGroupsForDisplay()[0], 0), true, 'the first profile opens by default')
assert.strictEqual(s.resultGroupIsProfile(s.resultGroupsForDisplay()[1]), false, 'a single ordinary result must not render a profile header')
s.toggleResultGroup(s.resultGroupsForDisplay()[0], 0)
assert.strictEqual(s.resultGroupExpanded(s.resultGroupsForDisplay()[0], 0), false)
assert.strictEqual(s.resultProfileCount(), 1)
s.expandAllResultGroups()
assert.strictEqual(s.resultGroupExpanded(s.resultGroupsForDisplay()[0], 0), true, 'expand all opens every profile without changing ordinary rows')
s.collapseAllResultGroups()
assert.strictEqual(s.resultGroupExpanded(s.resultGroupsForDisplay()[0], 0), false, 'collapse all closes every profile without hiding ordinary rows')
assert.strictEqual(s.resultReporterName(), 'ผู้รายงานผล')
assert.strictEqual(s.resultVerifierName(), 'ผู้ยืนยันผล')
assert.strictEqual(s.resultReportedAt(), '2026-09-23 12:08:00')
assert.strictEqual(s.hasRecordedResult(), true)
assert.strictEqual(s.manualCriticalCount(), 1)
assert.deepStrictEqual(s.labResultPdfParentIds(), [aggregateResultReportId])
assert.strictEqual(s.labResultPdfReady(), true, 'general LAB Order popup must enable the result PDF when exactly one Result Report parent is present')
assert.deepStrictEqual(s.labResultPdfParams(), { xparentx: aggregateResultReportId })
const attachmentContainerId = 'abababababababababababab'
s.manual.groups.forEach(group => {
  group.data.result_report_id = attachmentContainerId
  group.data.attachment_report_id = attachmentContainerId
})
assert.deepStrictEqual(s.labResultPdfParentIds(), [aggregateResultReportId], 'an uploaded-file container must not be mistaken for a second clinical Result Report')
assert.strictEqual(s.labResultPdfReady(), true, 'ordinary cross-room LAB results remain printable when the Order also has attachments')
assert.deepStrictEqual(s.labResultPdfParams(), { xparentx: aggregateResultReportId })
const visibleManualState = s.manual
s.manual = {
  ...visibleManualState,
  pdfParentId: '',
  groups: [{
    item_id: electrolyteItems[0].item_id,
    test_code: 'IM2',
    test_name: 'Anti-HIV',
    data: { result_report_id: aggregateResultReportId },
    results: [],
    sensitive_locked: true,
  }],
}
assert.deepStrictEqual(s.labResultPdfParentIds(), [aggregateResultReportId])
assert.strictEqual(s.labResultPdfReady(), true, 'redacted PDF remains available while the Sensitive row is locked')
assert.deepStrictEqual(s.labResultPdfParams(), { xparentx: aggregateResultReportId }, 'LAB PDF must never carry a Sensitive grant')
s.manual = visibleManualState
const originalOsmolalityReportId = s.manual.groups[1].results[0].result_report_id
s.manual.groups[1].results[0].result_report_id = 'eeeeeeeeeeeeeeeeeeeeeeee'
assert.strictEqual(s.labResultPdfReady(), false, 'one button must not silently print only one of multiple Result Report parents')
assert(s.labResultPdfHint().includes('หลายชุด'))
s.manual.groups[1].results[0].result_report_id = originalOsmolalityReportId
assert.strictEqual(s.canEditResult(), true, 'Order aggregate must allow multi-Item Manual entry and correction')
assert.strictEqual(s.canUploadResultFile(), true, 'Order aggregate must own the Upload action')
const batchFileA = { uid: 'BATCH-A', name: 'batch-a.pdf', type: 'application/pdf', size: 1024 }
const batchFileB = { uid: 'BATCH-B', name: 'batch-b.png', type: 'image/png', size: 2048 }
assert.strictEqual(s.beforeResultUpload(batchFileA), true)
assert.strictEqual(s.beforeResultUpload(batchFileB), true)
assert.strictEqual(Object.keys(s.resultUploadReservations).length, 2, 'both files selected together must be reserved before their requests finish')
assert.strictEqual(s.manual.uploading, true)
const batchOriginalProcessCall = s.processCall
const batchSaveParams = []
let batchSaveInFlight = 0
let batchSaveMaxInFlight = 0
s.processCall = async (processId, params) => {
  if (params.action !== 'save_result_attachments') return batchOriginalProcessCall(processId, params)
  batchSaveInFlight += 1
  batchSaveMaxInFlight = Math.max(batchSaveMaxInFlight, batchSaveInFlight)
  batchSaveParams.push(params)
  await new Promise(resolve => setTimeout(resolve, 5))
  batchSaveInFlight -= 1
  return { success: true, data: { result_report_id: aggregateResultReportId, result_attachments: params.result_attachments } }
}
const batchUploadA = s.resultUploadSuccess(
  { fileId: '555555555555555555555555', fileName: batchFileA.name, filePath: 'https://files.test/batch-a.pdf', fileType: 'pdf', mimetype: batchFileA.type, formId: '6a8d4334f851000f28e5025b' },
  batchFileA,
)
assert.deepStrictEqual(s.manual.attachments.map(file => s.attachmentKey(file)), ['555555555555555555555555'])
const batchUploadB = s.resultUploadSuccess(
  { fileId: '666666666666666666666666', fileName: batchFileB.name, filePath: 'https://files.test/batch-b.png', fileType: 'png', mimetype: batchFileB.type, formId: '6a8d4334f851000f28e5025b' },
  batchFileB,
)
assert.deepStrictEqual(s.manual.attachments.map(file => s.attachmentKey(file)), ['555555555555555555555555', '666666666666666666666666'], 'success callbacks must accumulate every selected file before persistence finishes')
await Promise.all([batchUploadA, batchUploadB])
assert.strictEqual(batchSaveMaxInFlight, 1, 'multi-file metadata saves must run serially')
assert.strictEqual(batchSaveParams.length, 2)
assert.deepStrictEqual(
  batchSaveParams.at(-1).result_attachments.map(file => s.attachmentKey(file)),
  ['555555555555555555555555', '666666666666666666666666'],
  'the final batch save must preserve every file selected together',
)
assert.deepStrictEqual(
  s.manual.attachments.map(file => s.attachmentKey(file)),
  ['555555555555555555555555', '666666666666666666666666'],
)
assert.strictEqual(s.manual.uploading, false)
assert.strictEqual(Object.keys(s.resultUploadReservations).length, 0)
s.processCall = batchOriginalProcessCall
const orderAttachment = { name: 'order-result.pdf', size: 1024, response: { fileId: '444444444444444444444444' } }
await s.persistResultAttachments([orderAttachment])
const orderAttachmentCall = processCalls.filter(call => call.params.action === 'save_result_attachments').at(-1)
assert(orderAttachmentCall)
assert.strictEqual(orderAttachmentCall.params.attachment_scope, 'order')
assert.strictEqual(orderAttachmentCall.params.attachment_operation, 'replace')
assert.strictEqual(orderAttachmentCall.params.item_id, electrolyteItems[0].item_id)
const confirmationCountBeforeRemove = confirmations.length
await s.requestRemoveResultFile(orderAttachment)
const removeAttachmentCall = processCalls.filter(call => call.params.action === 'save_result_attachments').at(-1)
assert.strictEqual(confirmations.length, confirmationCountBeforeRemove + 1, 'remove must require confirmation')
assert.strictEqual(removeAttachmentCall.params.attachment_scope, 'order')
assert.strictEqual(removeAttachmentCall.params.attachment_operation, 'remove')
assert.strictEqual(removeAttachmentCall.params.removed_attachment_key, '444444444444444444444444')
assert.deepStrictEqual(removeAttachmentCall.params.result_attachments, [])
assert.deepStrictEqual(s.manual.attachments, [])
const removeCallsBeforeLookupGuard = processCalls.filter(call => call.params.action === 'save_result_attachments').length
s.manual = { ...s.manual, attachments: [orderAttachment] }
s.viewMode = 'lookup'
assert.strictEqual(s.canRemoveResultFile(), false, 'lookup must remain read-only')
await s.requestRemoveResultFile(orderAttachment)
assert.strictEqual(processCalls.filter(call => call.params.action === 'save_result_attachments').length, removeCallsBeforeLookupGuard, 'lookup must never persist attachment removal')
s.viewMode = 'today'
const originalProcessCall = s.processCall
s.manual = { ...s.manual, uploading: false, attachments: [orderAttachment] }
s.processCall = async () => ({ success: false, message: 'forced attachment failure' })
await s.removeResultFile(orderAttachment)
assert.deepStrictEqual(s.manual.attachments, [orderAttachment], 'failed removal must restore the attachment list')
assert.strictEqual(s.manual.uploading, false)
s.processCall = originalProcessCall

s.startManualEdit()
assert.strictEqual(s.manual.editing, true, 'Order pencil must enter edit mode')
assert.strictEqual(Object.keys(s.manual.editMap).length, 5, 'each Order result row must have an independent editor')
const sodiumRow = s.resultGroupsForDisplay()[0].results[0]
const potassiumRow = s.resultGroupsForDisplay()[0].results[1]
s.manual.editMap[sodiumRow._edit_key].result_value = '142'
s.manual.editMap[potassiumRow._edit_key].result_value = '4.2'
s.manual.correctionReason = 'แก้ผล Electrolyte หลังตรวจทาน'
await s.saveResult()
assert.strictEqual(electrolyteValues[0], '142', 'Order save must persist the edited Sodium Item')
assert.strictEqual(electrolyteValues[1], '4.2', 'Order save must persist the edited Potassium Item independently')
assert.strictEqual(s.manual.orderView, true)
assert.strictEqual(s.manual.editing, false)

await s.openResult(electrolyteItems[0], aggregateOrder, false)
assert.strictEqual(s.manual.orderView, false, 'Item ดูผล must retain the original Item mode')
assert.strictEqual(s.manual.item, electrolyteItems[0])
assert.strictEqual(s.labResultPdfReady(), false, 'Item-level result popup must never expose the Order result PDF')
assert.strictEqual(s.canEditResult(), true)
assert.strictEqual(s.canUploadResultFile(), false, 'Item popup must keep edit/hide but never Upload')
s.startManualEdit()
s.manual.editRows[0].result_value = '145'
s.manual.correctionReason = 'แก้ค่า Sodium หลังตรวจทาน'
await s.saveResult()
await s.openOrderResults(aggregateOrder)
assert.strictEqual(s.resultGroupsForDisplay()[0].results[0].result_value, '145', 'Order result must reload the canonical value saved from Item edit')
s.processCall = itemProcessCall

const waitingItem = {
  item_id: 'BC-ITEM-WAITING',
  current_status: 'ready',
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
  current_status: 'ready',
  specimen: { ordered: {} },
}
const receiveItem2 = {
  item_id: '222222222222222222222222',
  item_code: 'BC002',
  item_name: 'Creatinine',
  current_status: 'ready',
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
assert.strictEqual(s.canReceiveOrder(receiveOrder), true, 'receiving multiple Finance-ready Items in one Order must stay enabled')
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
  current_status: 'ready',
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
    current_status: 'ready',
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
assert.strictEqual(typeof opened[0][4].params.on_order_sent, 'function', 'Create Order must expose an immediate worklist refresh callback after send')
{
  const originalLoadOrdersAfterCreate = s.loadOrders
  const originalRefreshCountsAfterCreate = s.refreshCounts
  let reloadsAfterCreate = 0
  let recountsAfterCreate = 0
  s.page = { ...s.page, current: 4 }
  s.loadOrders = (after, includeStatusCounts) => {
    reloadsAfterCreate += 1
    assert.strictEqual(recountsAfterCreate, 0, 'status counts must wait until the visible Order list has finished')
    assert.strictEqual(includeStatusCounts, true, 'new-order callback must request the optimized daily response')
    if (typeof after === 'function') after({ status_counts: { all: 1 } })
  }
  s.refreshCounts = () => { recountsAfterCreate += 1 }
  opened[0][4].params.on_order_sent()
  assert.strictEqual(s.page.current, 1, 'newly created orders must refresh from the first page')
  assert.strictEqual(reloadsAfterCreate, 1)
  assert.strictEqual(recountsAfterCreate, 0, 'batched Process response must not start six legacy recount requests')

  s.loadOrders = (after, includeStatusCounts) => {
    assert.strictEqual(includeStatusCounts, true)
    if (typeof after === 'function') after({})
  }
  s.refreshWorklist()
  assert.strictEqual(recountsAfterCreate, 1, 'old Process response must retain the legacy recount fallback')
  s.loadOrders = originalLoadOrdersAfterCreate
  s.refreshCounts = originalRefreshCountsAfterCreate
}

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

/* ช่อง HN ใช้ report เดิม แต่ส่งตรงไป Agent โดยไม่เปิด preview */
assert.strictEqual(s.hnPrintHint(reportScopedOrder), 'พิมพ์ป้ายติดแฟ้มที่เครื่อง HN/VN Sticker โดยไม่เปิด PDF')
notifications.length = 0
s.printHnLabel({ ...reportScopedOrder, patient: {} })
assert.strictEqual(notifications.at(-1)[0], 'Order นี้ไม่มี HN')

notifications.length = 0
printAgentStub = null
s.printHnLabel(reportScopedOrder)
assert(String(notifications.at(-1)[0]).includes('print agent'))
const printRowKey = s.orderRowKey(reportScopedOrder)
assert.strictEqual(s.hnPrinting[printRowKey], undefined)

let finishPrint = null
printAgentStub = {
  printReport: (reportId, options) => {
    printJobs.push({ reportId, options })
    return new Promise(resolve => { finishPrint = resolve })
  },
}
notifications.length = 0
s.printHnLabel(reportScopedOrder)
assert.strictEqual(printJobs.length, 1)
assert.strictEqual(printJobs[0].reportId, '6a9a355c422c1ca95982a1a2')
assert.strictEqual(printJobs[0].options.printer, 'HN/VN Sticker')
assert.deepStrictEqual(printJobs[0].options.params, { hn: '6900001' })
assert(String(printJobs[0].options.jobKey).startsWith('lab-hn-6900001-'))
assert.strictEqual(s.hnPrinting[printRowKey], true)
finishPrint()
await new Promise(resolve => setImmediate(resolve))
assert.strictEqual(s.hnPrinting[printRowKey], false)
assert(String(notifications.at(-1)[0]).includes('ส่งพิมพ์ป้ายติดแฟ้ม HN 6900001 แล้ว'))
printAgentStub = null

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
await s.rejectSelected(rejectOrder)
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
await s.openCancelOrder(cancelOrder)
assert.strictEqual(s.cancelDialog.visible, true)
assert.strictEqual(s.cancelDialog.order, cancelOrder)
assert.strictEqual(s.cancelDialog.financeChecked, true)
assert.strictEqual(s.cancelDialog.canCancel, true)
assert.strictEqual(s.cancelDialog.financeStatus, 'unpaid')
const financeCheckCall = processCalls.find(call => call.params.action === 'check_cancel_finance')
assert(financeCheckCall)
assert.deepStrictEqual(financeCheckCall.params, {
  action: 'check_cancel_finance',
  organization_code: '10',
  section_codes: ['BC'],
  order_id: cancelOrder.order_id,
  order_number: cancelOrder.order_number,
})
s.applyCancelFinance({ success: true, data: {
  can_cancel: false,
  finance_status: 'paid_receipt_active',
  finance_message: 'กรุณาให้การเงินถอนใบเสร็จก่อน',
  receipt_numbers: ['RC-TEST-001'],
} })
assert.strictEqual(s.cancelDialog.canCancel, false)
assert.deepStrictEqual(s.cancelDialog.receiptNumbers, ['RC-TEST-001'])
s.cancelDialog.reason = 'ward_cancel'
const cancelCallsBeforeBlockedSubmit = processCalls.filter(call => call.params.action === 'cancel_order').length
await s.submitCancelOrder()
assert.strictEqual(processCalls.filter(call => call.params.action === 'cancel_order').length, cancelCallsBeforeBlockedSubmit, 'Paid receipt must block cancel before the write action')
await s.checkCancelFinance()
assert.strictEqual(s.cancelDialog.canCancel, true)
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

const itemRetestItem = {
  item_id: 'abababababababababababab',
  item_code: 'BC009',
  item_name: 'Repeat Glucose',
  current_status: 'rejected',
  section: { code: 'BC' },
}
const itemRetestOrder = {
  order_id: 'cdcdcdcdcdcdcdcdcdcdcdcd',
  order_number: 'R2609220001',
  section_code: 'BC',
  items: [itemRetestItem],
}
assert.strictEqual(s.canRetestItem(itemRetestItem), true)
assert.strictEqual(s.canRetestItem({ current_status: 'sent' }), false)
s.openItemRetest(itemRetestOrder,itemRetestItem)
assert.strictEqual(s.itemRetestDialog.visible, true)
assert.strictEqual(s.itemRetestDialog.item, itemRetestItem)
s.itemRetestDialog.reasonCode = 'reject_mistake'
s.itemRetestDialog.reasonDetail = 'กดผิดรายการ'
assert.strictEqual(s.itemRetestReasonValid(), true)
await s.submitItemRetest()
const itemRetestCall = processCalls.find(call => call.params.action === 'retest_item')
assert(itemRetestCall)
assert.strictEqual(itemRetestCall.id, '6a9434c3422c1ca959829d5e')
assert.deepStrictEqual(itemRetestCall.params, {
  action: 'retest_item',
  organization_code: '10',
  section_codes: ['BC'],
  item_id: itemRetestItem.item_id,
  order_id: itemRetestOrder.order_id,
  order_number: itemRetestOrder.order_number,
  retest_reason: 'ปฏิเสธผิดรายการ · กดผิดรายการ',
})
assert.strictEqual(s.itemRetestDialog.visible, false)
assert.strictEqual(s.statusKey, 'waiting')
assert(notifications.some(note => note[0].includes('เปิดตรวจใหม่เฉพาะรายการแล้ว')))

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
