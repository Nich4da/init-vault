const fs = require('fs')
const path = require('path')

const ROOT = __dirname
const SOURCE_LAB = '/Users/nichada/Documents/ห้องปฏิบัติการแลป-now.js'
const SOURCE_EMR = path.join(ROOT, 'EMR.json')
const SOURCE_PERSON = path.join(ROOT, 'person.json')
const OUTPUT = path.join(ROOT, 'Lab_Workbench_Tab_List_OPD_Draft.json')

const STATUS_FORM_ID = '6a7daa3e8d398c11cf2fe869'
const RESULT_REPORT_FORM_ID = '6a8478abf851000f28e44a16'
const RESULT_ITEM_FORM_ID = '6a7aa641935ed08882467374'

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const clone = value => JSON.parse(JSON.stringify(value))

function walk(value, visit) {
  if (!value || typeof value !== 'object') return
  visit(value)
  if (Array.isArray(value)) value.forEach(item => walk(item, visit))
  else Object.values(value).forEach(item => walk(item, visit))
}

function findOne(root, predicate, label) {
  let found = null
  walk(root, node => {
    if (!found && predicate(node)) found = node
  })
  if (!found) throw new Error(`Template not found: ${label}`)
  return found
}

const sourceLab = readJson(SOURCE_LAB)
const emr = readJson(SOURCE_EMR)
const person = readJson(SOURCE_PERSON)

const tabTemplate = findOne(sourceLab, n => n.component === 'tab', 'tab')
const paneTemplate = findOne(sourceLab, n => n.component === 'tab-pane', 'tab-pane')
const listTemplate = findOne(
  sourceLab,
  n => n.component === 'list-ui' || (n.id === 'list-ui-lab-cancelled-final' && n.options),
  'list-ui',
)
const opdTemplate = findOne(emr, n => n.component === 'vue-ui' && n.options?.name === 'opd_card', 'EMR opd_card')
const gridTemplate = findOne(person, n => n.component === 'grid' && Array.isArray(n.cols), 'grid')
const gridColTemplate = findOne(person, n => n.component === 'grid-col' && Array.isArray(n.fields), 'grid-col')

const sectionWhere = "(section_code = :xunit_codex OR (:xunit_codex = '20' AND section_code = '22'))"

function makePane(name, label, active, fields, id) {
  const pane = clone(paneTemplate)
  pane.id = id
  pane.fields = fields
  pane.options = {
    ...pane.options,
    name,
    label,
    hidden: false,
    active,
    disabled: false,
    customClass: '',
    onCreated: '',
  }
  return pane
}

function makeList({ name, id, formId, title, where, detailContent, searchField, customValue, clickEvent = '', groupField = null, height = '560px' }) {
  const node = clone(listTemplate)
  node.component = 'list-ui'
  node.name = 'List View'
  node.category = 'display_ui'
  node.icon = 'list-ui'
  node.children = false
  node.enable = true
  node.formItemFlag = false
  node.id = id
  node.options = {
    ...node.options,
    name,
    label: 'List View',
    customClass: ['lab-workbench-list'],
    columnSpan: 24,
    hidden: false,
    formId,
    parentId: '',
    params: null,
    titleEnable: true,
    titleName: title,
    where,
    orderBy: [{ column: 'updated_at', sort: 'DESC' }],
    searchField,
    limitRow: 50,
    actionEnable: false,
    addBtnEnable: false,
    delBtnEnable: false,
    viewBtnEnable: false,
    reloadBtnEnable: true,
    updateBtnEnable: false,
    height,
    providerType: 'FORM',
    buttonsRow: [],
    defaultFilterParent: false,
    parentPath: '_id',
    showWhenParent: false,
    enableWs: true,
    listType: 'listview',
    iconWigth: 48,
    iconField: null,
    titleContent: '',
    titleField: null,
    detailContent,
    statusContent: '',
    statusField: null,
    colorField: null,
    groupField,
    disableNoMore: false,
    scrollDistance: 1,
    listColumn: 1,
    detailMaxRow: 8,
    totalEnable: true,
    noMoreLabel: 'หมดรายการ',
    searchPlaceholder: 'ค้นหา HN, ชื่อผู้ป่วย หรือ LAB NO.',
    clickEvent,
    customValue,
    onCreated: '',
    onMounted: '',
    onUnmount: '',
  }
  return node
}

const commonValues = [
  { fieldName: 'patientInitial', expressions: "(function(){var x=String(row.patient_name||row.patient_hn||'?').trim();return x?x.charAt(0).toUpperCase():'?'})()" },
  { fieldName: 'patientHnLabel', expressions: "'HN '+String(row.patient_hn||row.hn||'-')" },
  { fieldName: 'labNoLabel', expressions: "String(row.order_number||row.lab_no||'-')" },
  { fieldName: 'sourceUnitLabel', expressions: "String(row.source_unit_name||row.ward_clinic||row.sender_unit_name||'-')" },
  { fieldName: 'doctorLabel', expressions: "String(row.ordering_provider_name||row.doctor_name||row.ordered_by_name||'-')" },
  { fieldName: 'specimenLabel', expressions: "(function(){var x=row.specimens||row.specimen_json||[];try{x=typeof x==='string'?JSON.parse(x||'[]'):x}catch(e){x=[]}return(Array.isArray(x)?x:[]).map(function(v){return String((v&&v.label)||(v&&v.specimen_name)||(v&&v.specimen_code)||'')}).filter(Boolean).join(' · ')||'-'})()" },
  { fieldName: 'orderCountLabel', expressions: "(function(){var x=row.selected_items||row.selected_items_json||[];try{x=typeof x==='string'?JSON.parse(x||'[]'):x}catch(e){x=[]}return(Array.isArray(x)?x.length:0)+' รายการ'})()" },
  { fieldName: 'statusLabel', expressions: "(function(){var s=String(row.work_status||row.order_status||'').toLowerCase();var m={waiting_receive:'รอรับ',received:'รับเข้าแล้ว',processing:'กำลังตรวจ',resulted:'ออกผลบางส่วน',completed:'ออกผลครบ',rejected:'ยกเลิกรายการ',cancelled:'ยกเลิกรายการ'};return m[s]||s||'-'})()" },
  { fieldName: 'eventTimeLabel', expressions: "(function(){var v=row.received_at||row.processing_at||row.resulted_at||row.rejected_at||row.updated_at||row.created_at;if(!v)return '-';try{return new Date(v).toLocaleString('th-TH')}catch(e){return String(v)}})()" },
]

const workRow = `<div class="lab-wb-row">
  <div class="lab-wb-avatar">{{patientInitial}}</div>
  <div class="lab-wb-patient"><b>{{patient_name}}</b><span>{{patientHnLabel}}</span><strong>LAB NO. {{labNoLabel}}</strong></div>
  <div class="lab-wb-cell"><label>คลินิก/หน่วยส่ง</label><span>{{sourceUnitLabel}}</span></div>
  <div class="lab-wb-cell"><label>ผู้สั่งตรวจ</label><span>{{doctorLabel}}</span></div>
  <div class="lab-wb-cell"><label>รายการตรวจ</label><span>{{orderCountLabel}}</span></div>
  <div class="lab-wb-cell"><label>Specimen</label><span>{{specimenLabel}}</span></div>
  <div class="lab-wb-cell"><label>สถานะ / เวลา</label><b>{{statusLabel}}</b><small>{{eventTimeLabel}}</small></div>
</div>`

const waitingList = makeList({
  name: 'lab_waiting_list',
  id: 'list-ui-lab-waiting-draft',
  formId: STATUS_FORM_ID,
  title: 'รอรับสิ่งส่งตรวจ',
  where: `${sectionWhere} AND specimen_status = 'sent' AND (work_status = 'waiting_receive' OR work_status IS NULL)`,
  detailContent: workRow,
  searchField: ['patient_hn', 'patient_name', 'order_number', 'lab_no'],
  customValue: commonValues,
})

const receivedList = makeList({
  name: 'lab_received_processing_list',
  id: 'list-ui-lab-received-processing-draft',
  formId: STATUS_FORM_ID,
  title: 'รับเข้าแล้ว / รอตรวจ',
  where: `${sectionWhere} AND work_status IN ('received', 'processing')`,
  detailContent: workRow,
  searchField: ['patient_hn', 'patient_name', 'order_number', 'lab_no'],
  customValue: commonValues,
})

const cancelledValues = commonValues.concat([
  { fieldName: 'rejectReasonLabel', expressions: "String(row.rejection_reason||row.reject_reason||row.cancel_reason||'-')" },
  { fieldName: 'rejectByLabel', expressions: "String(row.rejected_by_name||row.cancelled_by_name||'-')" },
])
const cancelledRow = `<div class="lab-wb-row lab-wb-row-cancelled">
  <div class="lab-wb-avatar">{{patientInitial}}</div>
  <div class="lab-wb-patient"><b>{{patient_name}}</b><span>{{patientHnLabel}}</span><strong>LAB NO. {{labNoLabel}}</strong></div>
  <div class="lab-wb-cell"><label>คลินิก/หน่วยส่ง</label><span>{{sourceUnitLabel}}</span></div>
  <div class="lab-wb-cell"><label>รายการตรวจ</label><span>{{orderCountLabel}}</span></div>
  <div class="lab-wb-cell lab-wb-wide"><label>เหตุผลยกเลิก</label><span>{{rejectReasonLabel}}</span></div>
  <div class="lab-wb-cell"><label>ผู้ยกเลิก / เวลา</label><span>{{rejectByLabel}}</span><small>{{eventTimeLabel}}</small></div>
</div>`
const cancelledList = makeList({
  name: 'lab_cancelled_list',
  id: 'list-ui-lab-cancelled-draft',
  formId: STATUS_FORM_ID,
  title: 'ยกเลิกรายการ',
  where: `${sectionWhere} AND work_status IN ('rejected', 'cancelled')`,
  detailContent: cancelledRow,
  searchField: ['patient_hn', 'patient_name', 'order_number', 'lab_no'],
  customValue: cancelledValues,
})

const reportValues = [
  { fieldName: 'reportLabNo', expressions: "String(row.lab_no||row.order_no||'-')" },
  { fieldName: 'reportPatient', expressions: "[row.patient_hn,row.patient_name].filter(Boolean).join(' · ')||'-'" },
  { fieldName: 'reportStatus', expressions: "String(row.overall_status||'-')" },
  { fieldName: 'reportCount', expressions: "String(row.resulted_count||0)+' / '+String(row.expected_count||0)" },
  { fieldName: 'reportTime', expressions: "(function(){var v=row.verified_at||row.reported_at||row.updated_at;if(!v)return '-';try{return new Date(v).toLocaleString('th-TH')}catch(e){return String(v)}})()" },
]
// Keep the click script as plain ES5-compatible JavaScript for initCraft.
const reportClickSafe = `const form=this.getFormRef&&this.getFormRef();
if(!form)return;
const reportId=String((row&&(row._id||row.id||row.dataid))||'');
form.$labSelectedResultReportId=reportId;
const itemRef=form.getFieldRef&&form.getFieldRef('lab_result_items_list');
if(itemRef&&typeof itemRef.setFieldOption==='function')itemRef.setFieldOption('where',"result_report_id = '"+reportId.replace(/'/g,"''")+"'");
const editor=itemRef&&itemRef.getFieldEditor&&itemRef.getFieldEditor();
if(editor&&editor.dpFormData&&editor.dpFormData.options)editor.dpFormData.options.where="result_report_id = '"+reportId.replace(/'/g,"''")+"'";
if(editor&&editor.handleRefresh)editor.handleRefresh();
const card=form.getFieldRef&&form.getFieldRef('lab_patient_opd_card');
if(card&&card.vueState&&typeof card.vueState.selectLabRow==='function')card.vueState.selectLabRow(row);`

const reportList = makeList({
  name: 'lab_result_reports_list',
  id: 'list-ui-lab-result-reports-draft',
  formId: RESULT_REPORT_FORM_ID,
  title: 'LAB NO. / รายงานผล',
  where: `(lab_section = :xunit_codex OR (:xunit_codex = '20' AND lab_section = '22'))`,
  detailContent: `<div class="lab-result-report-row"><b>LAB NO. {{reportLabNo}}</b><span>{{reportPatient}}</span><div><em>{{reportStatus}}</em><strong>{{reportCount}} ผล</strong></div><small>{{reportTime}}</small></div>`,
  searchField: ['lab_no', 'order_no', 'patient_hn', 'patient_name'],
  customValue: reportValues,
  clickEvent: reportClickSafe,
  height: '610px',
})

const itemValues = [
  { fieldName: 'orderedItemLabel', expressions: "String(row.source_item_name||row.ordered_item_name||row.test_name||'-')" },
  { fieldName: 'resultValueLabel', expressions: "String(row.result_value==null||row.result_value===''?'-':row.result_value)" },
  { fieldName: 'unitLabel', expressions: "String(row.unit_symbol_snapshot||row.unit_symbol||'-')" },
  { fieldName: 'referenceLabel', expressions: "String(row.reference_range_snapshot||'-')" },
  { fieldName: 'criticalLabel', expressions: "(row.is_critical===true||String(row.interpretation_code||'').toUpperCase()==='CRITICAL')?'Critical':'ปกติ'" },
  { fieldName: 'criticalClass', expressions: "(row.is_critical===true||String(row.interpretation_code||'').toUpperCase()==='CRITICAL')?'is-critical':'is-normal'" },
  { fieldName: 'reportedByLabel', expressions: "String(row.reported_by_name||row.reported_by_source_name||row.entered_by_name||'-')" },
  { fieldName: 'verifiedByLabel', expressions: "String(row.verified_by_name||row.verified_by_source_name||'-')" },
]
const itemList = makeList({
  name: 'lab_result_items_list',
  id: 'list-ui-lab-result-items-draft',
  formId: RESULT_ITEM_FORM_ID,
  title: 'รายการสั่งตรวจและผล',
  where: "result_report_id = '__select_report__'",
  detailContent: `<div class="lab-result-item-row">
    <div class="lab-result-test"><b>{{orderedItemLabel}}</b><small>{{test_code}}</small></div>
    <div class="lab-result-value"><label>ผล</label><strong>{{resultValueLabel}}</strong><span>{{unitLabel}}</span></div>
    <div class="lab-result-ref"><label>ค่าปกติ</label><span>{{referenceLabel}}</span></div>
    <div class="lab-result-critical {{criticalClass}}"><label>Critical</label><b>{{criticalLabel}}</b></div>
    <div class="lab-result-person"><label>ผู้ลงผล</label><span>{{reportedByLabel}}</span><label>ผู้รับรอง</label><span>{{verifiedByLabel}}</span></div>
  </div>`,
  searchField: ['test_code', 'test_name', 'result_value'],
  customValue: itemValues,
  groupField: 'source_item_id',
  height: '610px',
})

function makeGridCol(span, fields, id) {
  const col = clone(gridColTemplate)
  col.id = id
  col.fields = fields
  col.options = {
    ...col.options,
    name: id.replace(/-/g, '_'),
    hidden: false,
    span,
    offset: 0,
    push: 0,
    pull: 0,
    responsive: true,
    md: 24,
    sm: 24,
    xs: 24,
    bgColor: null,
    customClass: '',
  }
  return col
}

const resultGrid = clone(gridTemplate)
resultGrid.id = 'grid-lab-result-split-draft'
resultGrid.cols = [
  makeGridCol(9, [reportList], 'grid-col-lab-result-reports-draft'),
  makeGridCol(15, [itemList], 'grid-col-lab-result-items-draft'),
]
resultGrid.options = {
  ...resultGrid.options,
  name: 'lab_result_split_grid',
  hidden: false,
  gutter: 16,
  colHeight: null,
  customClass: 'lab-result-split-grid',
}

const opdCard = clone(opdTemplate)
opdCard.id = 'vue-ui-lab-patient-opd-card-draft'
opdCard.options.name = 'lab_patient_opd_card'
opdCard.options.label = 'OPD Card'
opdCard.options.customClass = ['lab-shared-opd-card']
const searchContent = `<div class="lab-patient-search-bar">
  <el-input v-model="patientSearch" clearable placeholder="ค้นหาด้วย HN, CID หรือชื่อ-นามสกุล" @keyup.enter="runPatientSearch('text')" />
  <el-input v-model="barcodeSearch" clearable placeholder="สแกน HN / LAB NO. / Barcode" @keyup.enter="runPatientSearch('barcode')" />
  <el-button type="primary" @click="runPatientSearch('text')">ค้นหา</el-button>
  <el-button @click="clearPatientSearch">ล้าง</el-button>
</div>`
opdCard.options.content = searchContent + opdCard.options.content.replace(
  'ยังไม่ได้เลือกคนไข้ — กด EMR จากคิวห้องตรวจ',
  'ยังไม่ได้เลือกคนไข้ — ค้นหา HN/ชื่อ หรือสแกน Barcode ด้านบน',
)
const patientSearchScript = `
// Lab Workbench search adapter: query only the current laboratory section.
s.patientSearch='';s.barcodeSearch='';s.labContextRow=null;
s.labText=v=>{if(v==null)return '';if(typeof v==='object')return s.labText(v.value||v.code||v.label||v.name||v._id||'');return String(v).trim()};
s.labUnitCode=()=>{const form=field.getFormRef&&field.getFormRef(),state=(form&&form.userState)||field.globalUserState||{},user=state.user||state,raw=user.unit||user.currentUnit||user.xunitx||state.unit||state.currentUnit||state.xunitx||{};return s.labText(raw)};
s.labAllowedSections=()=>{const code=s.labUnitCode();return code==='20'?['20','22']:(code?[code]:[])};
s.labRights=row=>{const raw=row&&(row.inscl_hos_json||row.treatment_right||row.insurance_right)||[];try{const list=Array.isArray(raw)?raw:(typeof raw==='string'&&raw.trim().charAt(0)==='['?JSON.parse(raw):[raw]);return list.map(x=>s.labText(x&&typeof x==='object'?(x.label||x.value||x.name):x)).filter(Boolean)}catch(e){return []}};
s.rowToTran=row=>({checkin_at:row.received_at||row.ordered_at||row.created_at,start_at:row.processing_at||null,pttype:s.labRights(row),allergy_tags:Array.isArray(row.allergy_tags)?row.allergy_tags:[],vid:{value:s.labText(row.visit_id||row.visit_id_link),vn:s.labText(row.visit_vn||row.vn),visit_type:s.labText(row.visit_type),pid:{hn:s.labText(row.patient_hn||row.hn),p_fname:s.labText(row.patient_name),p_lname:'',p_gender:s.labText(row.patient_gender||row.gender),age:s.labText(row.patient_age||row.age),birth_date:row.patient_birth_date||row.birth_date||'',p_phone:s.labText(row.patient_phone||row.p_phone),p_abogroup:s.labText(row.patient_abogroup||row.p_abogroup),p_pic:row.patient_photo_url?[{url:row.patient_photo_url}]:[]}}});
s.selectLabRow=row=>{s.labContextRow=row||null;s.setTran(row?s.rowToTran(row):null)};
s.clearPatientSearch=()=>{s.patientSearch='';s.barcodeSearch='';s.selectLabRow(null)};
s.runPatientSearch=mode=>{const q=s.labText(mode==='barcode'?s.barcodeSearch:s.patientSearch).toLowerCase(),sections=s.labAllowedSections(),form=field.getFormRef&&field.getFormRef(),api=(form&&form.userState)||field.globalUserState;if(!q){field.notify('กรุณาระบุ HN ชื่อ หรือสแกน Barcode','warning',2500);return}if(!sections.length){field.notify('ไม่พบห้อง Lab ของผู้ใช้ จึงไม่ค้นหาข้ามห้อง','warning',3000);return}if(!api||typeof api.crudGetAll!=='function'){field.notify('ไม่พบ Form connector','error',3000);return}const where='('+sections.map(x=>"section_code = '"+x+"'").join(' OR ')+')';api.crudGetAll({sdProvider:{providerId:'${STATUS_FORM_ID}',providerType:'FORM',params:{},options:{where,limit:500,page:1,orderBy:[{column:'updated_at',sort:'DESC'}]}},totalEnable:true},out=>{const rows=(out&&out.data&&Array.isArray(out.data)?out.data:(out&&out.data&&Array.isArray(out.data.data)?out.data.data:[]));const matched=rows.filter(row=>[row.patient_hn,row.patient_name,row.order_number,row.lab_no,row.barcode].map(s.labText).join(' ').toLowerCase().includes(q));if(!matched.length){s.selectLabRow(null);field.notify('ไม่พบผู้ป่วย/รายการในห้อง Lab นี้','warning',3000);return}s.selectLabRow(matched[0]);if(matched.length>1)field.notify('พบ '+matched.length+' รายการ — แสดงรายการล่าสุดก่อน','info',2500)},err=>field.notify('ค้นหาไม่สำเร็จ: '+String((err&&err.message)||err||''),'error',3500))};`
opdCard.options.onCreated = `${opdCard.options.onCreated}\n${patientSearchScript}`

const tab = clone(tabTemplate)
tab.id = 'tab-lab-workbench-draft'
tab.options = {
  ...tab.options,
  name: 'lab_workbench_tabs',
  hidden: false,
  displayType: 'border-card',
  tabPosition: 'top',
  customClass: 'lab-workbench-tabs',
  lazy: false,
}
tab.tabs = [
  makePane('lab_waiting', 'รอรับ', true, [waitingList], 'tab-pane-lab-waiting-draft'),
  makePane('lab_received_processing', 'รับเข้าแล้ว / รอตรวจ', false, [receivedList], 'tab-pane-lab-received-processing-draft'),
  makePane('lab_results', 'ผลแลป', false, [resultGrid], 'tab-pane-lab-results-draft'),
  makePane('lab_cancelled', 'ยกเลิกรายการ', false, [cancelledList], 'tab-pane-lab-cancelled-draft'),
]

const extraCss = `
/* Lab Workbench widget draft — EMR/person visual hierarchy */
.lab-patient-search-bar{display:grid;grid-template-columns:minmax(280px,1.35fr) minmax(240px,1fr) auto auto;gap:10px;align-items:center;margin:0 0 12px;padding:14px 16px;border:1px solid var(--el-border-color-lighter);border-radius:8px;background:var(--el-bg-color)}
.lab-shared-opd-card{margin-bottom:14px}.lab-workbench-tabs{margin-top:4px}.lab-workbench-list .el-list-view-item{padding:0!important}
.lab-wb-row{display:grid;grid-template-columns:48px minmax(190px,1.1fr) minmax(145px,.8fr) minmax(145px,.8fr) minmax(100px,.5fr) minmax(130px,.7fr) minmax(135px,.72fr);gap:13px;align-items:center;padding:12px 14px;min-width:0}
.lab-wb-avatar{display:grid;width:44px;height:44px;place-items:center;border-radius:10px;background:#eaf3ff;color:#337ee8;font-weight:800}.lab-wb-patient,.lab-wb-cell{display:flex;min-width:0;flex-direction:column;gap:2px}.lab-wb-patient b,.lab-wb-cell span{overflow-wrap:anywhere}.lab-wb-patient span,.lab-wb-cell label,.lab-wb-cell small{color:#9098a5;font-size:11px}.lab-wb-patient strong{color:#337ee8;font-size:12px}.lab-wb-cell b{color:#4f5968}.lab-wb-row-cancelled{background:#fffafa}
.lab-result-split-grid{align-items:stretch}.lab-result-report-row{display:grid;gap:5px;padding:12px}.lab-result-report-row>b{color:#337ee8}.lab-result-report-row>span,.lab-result-report-row>small{color:#7f8794;font-size:12px}.lab-result-report-row>div{display:flex;justify-content:space-between;gap:8px}.lab-result-report-row em{font-style:normal;color:#e59a1d}.lab-result-item-row{display:grid;grid-template-columns:minmax(180px,1.15fr) minmax(130px,.75fr) minmax(125px,.7fr) minmax(90px,.5fr) minmax(150px,.8fr);gap:12px;align-items:center;padding:12px 14px}.lab-result-test,.lab-result-value,.lab-result-ref,.lab-result-critical,.lab-result-person{display:flex;min-width:0;flex-direction:column;gap:2px}.lab-result-item-row label,.lab-result-test small{color:#969eaa;font-size:11px}.lab-result-value strong{font-size:18px;color:#273142}.lab-result-value span,.lab-result-ref span,.lab-result-person span{font-size:12px;color:#596273}.lab-result-critical{padding:6px 8px;border-radius:6px}.lab-result-critical.is-critical{background:#fff0f0;color:#d83b3b}.lab-result-critical.is-normal{background:#eef9eb;color:#55a934}
@media(max-width:980px){.lab-patient-search-bar{grid-template-columns:1fr 1fr}.lab-wb-row{grid-template-columns:48px minmax(180px,1fr) repeat(2,minmax(130px,.7fr))}.lab-wb-cell:nth-of-type(3),.lab-wb-cell:nth-of-type(4){display:none}.lab-result-item-row{grid-template-columns:1fr 1fr}.lab-result-person{grid-column:1/-1}}
@media(max-width:640px){.lab-patient-search-bar{grid-template-columns:1fr}.lab-wb-row{grid-template-columns:44px 1fr}.lab-wb-cell{grid-column:1/-1}.lab-result-item-row{grid-template-columns:1fr}}
`

const output = {
  fields: [opdCard, tab],
  formConfig: {
    ...sourceLab.formConfig,
    cssCode: `${sourceLab.formConfig.cssCode || ''}\n${extraCss}`,
    functions: '',
    onFormCreated: '',
    onFormMounted: '',
    onParentChange: '',
    onFormDataChange: '',
    onFormUnmounted: '',
  },
}

fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`)
console.log(`Wrote ${OUTPUT}`)
console.log(`Fields: ${output.fields.length}; tabs: ${tab.tabs.length}`)
