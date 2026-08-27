const fs = require('fs')
const path = require('path')

const ROOT = __dirname
const PERSON = path.join(ROOT, 'person.json')
const RUNTIME_SOURCE = path.join(ROOT, 'EMR.json')
const OUTPUT = path.join(ROOT, 'Lab_Result_Output_Tab_ListView_EMR_Person.json')

const REPORT_FORM_ID = '6a8478abf851000f28e44a16'
const ITEM_FORM_ID = '6a7aa641935ed08882467374'

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const clone = value => JSON.parse(JSON.stringify(value))

function walk(value, visit) {
  if (!value || typeof value !== 'object') return
  visit(value)
  if (Array.isArray(value)) value.forEach(item => walk(item, visit))
  else Object.values(value).forEach(item => walk(item, visit))
}

function findOne(root, predicate, label) {
  let result = null
  walk(root, node => {
    if (!result && predicate(node)) result = node
  })
  if (!result) throw new Error(`Template not found: ${label}`)
  return result
}

const person = readJson(PERSON)
const runtimeSource = readJson(RUNTIME_SOURCE)

const gridTemplate = findOne(person, node => node.component === 'grid' && Array.isArray(node.cols), 'Layout')
const colTemplate = findOne(person, node => node.component === 'grid-col' && Array.isArray(node.fields), 'Grid Col')
// EMR.json is a builder/runtime export that is already known to mount ListView
// correctly.  Clone its complete node and option schema instead of rebuilding a
// reduced approximation: missing advanced/event keys can leave a node visible
// in Tree View while the canvas renderer fails during mount.
const listTemplate = findOne(
  runtimeSource,
  node => node.component === 'list-ui' && node.options?.name === 'visit_unit',
  'runtime-verified EMR List View',
)
const buttonTemplate = findOne(
  runtimeSource,
  node => node.component === 'list-ui' && Array.isArray(node.options?.buttonsRow) && node.options.buttonsRow.length,
  'List View row button',
).options.buttonsRow[0]

function makeList({ name, id, formId, title, where, height, searchField, detailContent, customValue, groupField = null, buttonsRow = [] }) {
  const list = clone(listTemplate)
  list.id = id
  // The verified ListView export has no catalogue `key`.  A generated numeric
  // key came from the older draft template and is intentionally not emitted.
  delete list.key
  list.options = {
    ...list.options,
    name,
    label: 'List View',
    customClass: 'lab-result-output-list',
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
    actionEnable: buttonsRow.length > 0,
    addBtnEnable: false,
    delBtnEnable: false,
    viewBtnEnable: false,
    reloadBtnEnable: true,
    updateBtnEnable: false,
    height,
    providerType: 'FORM',
    buttonsRow,
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
    searchPlaceholder: 'ค้นหา...',
    clickEvent: null,
    customValue: customValue.map(item => ({
      labelWidth: 150,
      align: 'left',
      ...item,
    })),
    onCreated: '',
    onMounted: '',
    onUnmount: '',
    onInsertBefore: '',
    onUpdateBefore: '',
    onViewBefore: '',
    onBeforeSave: '',
    onAfterDelete: '',
    onselect: '',
    onunselect: '',
    allowDeleteFunc: '',
    initData: null,
    iconName: '',
    reportList: null,
    subformWidth: 600,
    wsRefresh: true,
  }
  return list
}

const selectResultScript = `const form=this.getFormRef&&this.getFormRef();
const report=dataRow||{};
const rawId=report._id||report.id||report.dataid||'';
const reportId=typeof rawId==='object'?String(rawId.$oid||rawId.value||''):String(rawId);
if(!/^[a-f0-9]{24}$/i.test(reportId)){this.notify('ไม่พบ Result Report ID ที่ถูกต้อง','warning',3000);return}
form.$selectedLabResultReport={id:reportId,lab_no:String(report.lab_no||report.order_no||''),row:report};
const applyWhere=(fieldName,where,title)=>{const ref=form.getFieldRef&&form.getFieldRef(fieldName);if(!ref)return;if(typeof ref.setFieldOption==='function'){ref.setFieldOption('where',where);if(title)ref.setFieldOption('titleName',title)}const editor=ref.getFieldEditor&&ref.getFieldEditor();if(!editor)return;editor.dpFormData=editor.dpFormData||{};editor.dpFormData.options=editor.dpFormData.options||{};editor.defaultWhere=where;editor.dpFormData.options.where=where;if(title)editor.dpFormData.options.titleName=title;if(typeof editor.handleRefresh==='function')editor.handleRefresh()};
const safeLabNo=String(report.lab_no||report.order_no||'-').replace(/[<>]/g,'');
applyWhere('lab_selected_report_summary',"_id = CONVERT('"+reportId+"', 'objectId')",'สรุปรายงาน · LAB NO. '+safeLabNo);
applyWhere('lab_selected_result_items',"xparentx = CONVERT('"+reportId+"', 'objectId')",'ผลตรวจ · LAB NO. '+safeLabNo);`

const viewButton = {
  ...clone(buttonTemplate),
  prefixIcon: 'el-view',
  label: 'ดูผล',
  type: 'primary',
  suffixIcon: '',
  color: '',
  disabled: false,
  plain: true,
  circle: false,
  round: false,
  loading: false,
  confirm: false,
  confirmTitle: '',
  badge: 0,
  badgeMax: 99,
  tag: 'button',
  href: '',
  blank: false,
  onClick: selectResultScript,
}

const reportValues = [
  { fieldName: 'labNoLabel', expressions: "String(row.lab_no||row.order_no||'-')" },
  { fieldName: 'patientLabel', expressions: "[row.patient_hn?('HN '+row.patient_hn):'',row.patient_name||''].filter(Boolean).join(' · ')||'-'" },
  { fieldName: 'specimenLabel', expressions: "String(row.specimen||'-')" },
  { fieldName: 'statusLabel', expressions: "(function(){var s=String(row.overall_status||'').toLowerCase(),m={processing:'กำลังตรวจ',in_progress:'ออกผลบางส่วน',partial:'ออกผลบางส่วน',resulted:'ออกผลแล้ว',completed:'ออกผลครบ',corrected:'แก้ไขผล',cancelled:'ยกเลิกผล'};return m[s]||s||'-'})()" },
  { fieldName: 'statusClass', expressions: "(function(){var s=String(row.overall_status||'').toLowerCase();return ['resulted','completed'].includes(s)?'is-complete':s==='corrected'?'is-corrected':['processing','in_progress','partial'].includes(s)?'is-partial':'is-default'})()" },
  { fieldName: 'countLabel', expressions: "String(row.resulted_count||0)+' / '+String(row.expected_count||0)" },
  { fieldName: 'reportTimeLabel', expressions: "(function(){var v=row.resulted_at||row.reported_at||row.updated_at;if(!v)return '-';try{return new Date(v).toLocaleString('th-TH')}catch(e){return String(v)}})()" },
]

const reportsList = makeList({
  name: 'lab_result_reports_search',
  id: 'list-ui71011',
  formId: REPORT_FORM_ID,
  title: 'ค้นหาผลแลปตามผู้ป่วย',
  where: "overall_status IN ('processing', 'in_progress', 'partial', 'resulted', 'completed', 'corrected')",
  height: '760px',
  searchField: ['patient_hn', 'patient_name', 'lab_no', 'order_no'],
  detailContent: `<div class="lab-result-report-search-row">
    <div class="lab-result-report-icon">LAB</div>
    <div class="lab-result-report-main"><b>LAB NO. {{labNoLabel}}</b><span>{{patientLabel}}</span><small>{{specimenLabel}}</small></div>
    <div class="lab-result-report-count"><label>ผลออก</label><strong>{{countLabel}}</strong></div>
    <div class="lab-result-report-state"><span class="lab-result-status {{statusClass}}">{{statusLabel}}</span><small>{{reportTimeLabel}}</small></div>
  </div>`,
  customValue: reportValues,
  buttonsRow: [viewButton],
})
reportsList.options.searchPlaceholder = 'ค้นหา HN, ชื่อผู้ป่วย หรือ LAB NO.'
reportsList.options.orderBy = [
  { column: 'updated_at', sort: 'DESC' },
]

const summaryValues = [
  { fieldName: 'summaryLabNo', expressions: "String(row.lab_no||row.order_no||'-')" },
  { fieldName: 'summaryPatient', expressions: "[row.patient_hn?('HN '+row.patient_hn):'',row.patient_name||''].filter(Boolean).join(' · ')||'-'" },
  { fieldName: 'summaryStatus', expressions: "(function(){var s=String(row.overall_status||'').toLowerCase(),m={processing:'กำลังตรวจ',in_progress:'ออกผลบางส่วน',partial:'ออกผลบางส่วน',resulted:'ออกผลแล้ว',completed:'ออกผลครบ',corrected:'แก้ไขผล',cancelled:'ยกเลิกผล'};return m[s]||s||'-'})()" },
  { fieldName: 'summaryReportedBy', expressions: "String(row.reported_by_source_name||row.entered_by_name||(row.updated_by&&row.updated_by.name)||'-')" },
  { fieldName: 'summaryVerifiedBy', expressions: "String(row.verified_by_source_name||row.verified_by_name||'-')" },
  { fieldName: 'summaryReportedAt', expressions: "(function(){var v=row.reported_at||row.resulted_at;if(!v)return '-';try{return new Date(v).toLocaleString('th-TH')}catch(e){return String(v)}})()" },
  { fieldName: 'summaryVerifiedAt', expressions: "(function(){var v=row.verified_at;if(!v)return 'ยังไม่รับรอง';try{return new Date(v).toLocaleString('th-TH')}catch(e){return String(v)}})()" },
]

const summaryList = makeList({
  name: 'lab_selected_report_summary',
  id: 'list-ui71012',
  formId: REPORT_FORM_ID,
  title: 'สรุปรายงาน · กรุณากดดูผลจากรายการด้านซ้าย',
  where: "_id = CONVERT('000000000000000000000000', 'objectId')",
  height: '190px',
  searchField: null,
  detailContent: `<div class="lab-selected-report-summary-row">
    <div><label>LAB NO.</label><b>{{summaryLabNo}}</b><span>{{summaryPatient}}</span></div>
    <div><label>สถานะ</label><strong>{{summaryStatus}}</strong></div>
    <div><label>ผู้ลงผล</label><span>{{summaryReportedBy}}</span><small>{{summaryReportedAt}}</small></div>
    <div><label>ผู้รับรอง</label><span>{{summaryVerifiedBy}}</span><small>{{summaryVerifiedAt}}</small></div>
  </div>`,
  customValue: summaryValues,
})
summaryList.options.reloadBtnEnable = false
summaryList.options.totalEnable = false

const resultValues = [
  { fieldName: 'panelLabel', expressions: "String(row.panel_name||row.source_item_name||row.test_name||row.obs_name||'รายการผล')" },
  { fieldName: 'resultNameLabel', expressions: "String(row.test_name||row.obs_name||row.test_code||row.obs_code||'-')" },
  { fieldName: 'resultCodeLabel', expressions: "String(row.obs_code||row.test_code||'-')" },
  { fieldName: 'resultValueLabel', expressions: "(row.result_value!==undefined&&row.result_value!==null&&String(row.result_value)!=='')?String(row.result_value):'รอผล'" },
  { fieldName: 'resultValueClass', expressions: "(row.result_value!==undefined&&row.result_value!==null&&String(row.result_value)!=='')?'has-result':'is-pending'" },
  { fieldName: 'unitLabel', expressions: "String(row.unit_symbol_snapshot||row.units||'-')" },
  { fieldName: 'referenceLabel', expressions: "String(row.reference_range_snapshot||row.ref_range||'-')" },
  { fieldName: 'criticalLabel', expressions: "(row.is_critical===true||row.critical_low_rule||row.critical_high_rule)?'CRITICAL':''" },
  { fieldName: 'criticalClass', expressions: "(row.is_critical===true||row.critical_low_rule||row.critical_high_rule)?'is-critical':'is-normal'" },
  { fieldName: 'commentLabel', expressions: "String(row.critical_comment||row.result_comment||'')" },
  { fieldName: 'organismLabel', expressions: "row.organism?('Organism: '+String(row.organism)):''" },
  { fieldName: 'obxStateLabel', expressions: "(function(){var s=String(row.result_status||row.obx_status||'').toLowerCase(),m={pending:'รอผล',entered:'ลงผลแล้ว',preliminary:'ผลเบื้องต้น',final:'Final',corrected:'Corrected'};return m[s]||s||''})()" },
]

const resultItemsList = makeList({
  name: 'lab_selected_result_items',
  id: 'list-ui71013',
  formId: ITEM_FORM_ID,
  title: 'ผลตรวจ · กรุณากดดูผลจากรายการด้านซ้าย',
  where: "xparentx = CONVERT('000000000000000000000000', 'objectId')",
  height: '550px',
  searchField: ['test_code', 'obs_code', 'test_name', 'result_value'],
  // panel_name/panel_code belong to the Agent wire payload but have not yet
  // been materialized as fields in the current Lab_Result_Item form.  Binding
  // ListView grouping/sorting to them can crash the current builder renderer.
  groupField: null,
  detailContent: `<div class="lab-result-component-row">
    <div class="lab-result-component-name"><b>{{resultNameLabel}}</b><small>{{resultCodeLabel}}</small><em>{{organismLabel}}</em></div>
    <div class="lab-result-component-value {{resultValueClass}}"><label>ผลตรวจ</label><strong>{{resultValueLabel}}</strong><span>{{unitLabel}}</span></div>
    <div class="lab-result-component-reference"><label>ค่าปกติ</label><span>{{referenceLabel}}</span></div>
    <div class="lab-result-component-flag {{criticalClass}}"><b>{{criticalLabel}}</b><span>{{obxStateLabel}}</span></div>
    <div class="lab-result-component-comment"><label>หมายเหตุ</label><span>{{commentLabel}}</span></div>
  </div>`,
  customValue: resultValues,
})
resultItemsList.options.searchPlaceholder = 'ค้นหารายการผลหรือรหัสผล'
resultItemsList.options.orderBy = [
  { column: 'result_sequence', sort: 'ASC' },
  { column: 'test_code', sort: 'ASC' },
]

function makeCol(span, fields, id, name) {
  const col = clone(colTemplate)
  col.id = id
  col.fields = fields
  col.options = {
    ...col.options,
    name,
    hidden: false,
    span,
    offset: 0,
    push: 0,
    pull: 0,
    // Keep the desktop span deterministic.  The previous draft used
    // responsive:true + md:24, so initCraft's PC property resolved both
    // columns to 24 even though span was configured as 9/15.
    responsive: false,
    md: 12,
    sm: 24,
    xs: 24,
    bgColor: null,
    customClass: '',
  }
  return col
}

const root = clone(gridTemplate)
root.id = 'grid71001'
root.cols = [
  makeCol(9, [reportsList], 'grid-col-71002', 'lab_result_report_search_col'),
  makeCol(15, [summaryList, resultItemsList], 'grid-col-71003', 'lab_result_detail_col'),
]
root.options = {
  ...root.options,
  name: 'lab_result_output_layout',
  hidden: false,
  gutter: 16,
  colHeight: null,
  customClass: 'lab-result-output-layout',
}

const cssCode = `
.lab-result-output-layout{align-items:start}.lab-result-output-list .el-list-view-item{padding:0!important}
.lab-result-report-search-row{display:grid;grid-template-columns:44px minmax(150px,1fr) 66px 105px;gap:10px;align-items:center;padding:11px 112px 11px 10px;min-width:0}
.lab-result-report-icon{display:grid;width:40px;height:40px;place-items:center;border-radius:8px;background:#eaf3ff;color:#337ee8;font-size:11px;font-weight:800}.lab-result-report-main,.lab-result-report-count,.lab-result-report-state{display:flex;min-width:0;flex-direction:column;gap:2px}.lab-result-report-main>b{color:#337ee8}.lab-result-report-main>span{overflow:hidden;color:#374151;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.lab-result-report-main>small,.lab-result-report-count>label,.lab-result-report-state>small{color:#929aa7;font-size:11px}.lab-result-report-count strong{color:#4b5563}.lab-result-status{display:inline-block;align-self:flex-start;padding:3px 7px;border-radius:5px;font-size:11px;font-weight:700}.lab-result-status.is-complete{background:#e8f8e8;color:#42a43c}.lab-result-status.is-partial{background:#fff3d8;color:#d38a00}.lab-result-status.is-corrected{background:#efeafe;color:#6b4ed3}.lab-result-status.is-default{background:#f1f2f4;color:#7c8490}
.lab-selected-report-summary-row{display:grid;grid-template-columns:1.2fr .55fr 1fr 1fr;gap:16px;align-items:center;padding:14px 16px;border-left:4px solid #409eff;background:#f7fbff}.lab-selected-report-summary-row>div{display:flex;min-width:0;flex-direction:column;gap:3px}.lab-selected-report-summary-row label,.lab-selected-report-summary-row small{color:#939caa;font-size:11px}.lab-selected-report-summary-row b{color:#337ee8;font-size:17px}.lab-selected-report-summary-row span,.lab-selected-report-summary-row strong{overflow-wrap:anywhere;color:#3f4856;font-size:12px}
.lab-result-component-row{display:grid;grid-template-columns:minmax(165px,1.05fr) minmax(130px,.72fr) minmax(120px,.7fr) 86px minmax(125px,.75fr);gap:12px;align-items:center;padding:12px 14px;min-width:0}.lab-result-component-name,.lab-result-component-value,.lab-result-component-reference,.lab-result-component-flag,.lab-result-component-comment{display:flex;min-width:0;flex-direction:column;gap:2px}.lab-result-component-row label,.lab-result-component-name small{color:#929aa7;font-size:11px}.lab-result-component-name b{color:#303947}.lab-result-component-name em{color:#8b5e24;font-size:11px;font-style:normal}.lab-result-component-value strong{color:#273142;font-size:20px;line-height:1.2}.lab-result-component-value span,.lab-result-component-reference span,.lab-result-component-comment span{color:#596273;font-size:12px;overflow-wrap:anywhere}.lab-result-component-value.is-pending strong{color:#a1a8b2;font-size:14px}.lab-result-component-flag{padding:7px;border-radius:6px;text-align:center}.lab-result-component-flag.is-critical{background:#fff0f0;color:#d83b3b}.lab-result-component-flag.is-normal{background:#f4f6f8;color:#75808d}.lab-result-component-flag b:empty{display:none}.lab-result-component-flag span{font-size:11px}
@media(max-width:1100px){.lab-result-report-search-row{grid-template-columns:40px 1fr 80px;padding-right:105px}.lab-result-report-count{display:none}.lab-selected-report-summary-row{grid-template-columns:1fr 1fr}.lab-result-component-row{grid-template-columns:1fr 1fr 1fr}.lab-result-component-comment{grid-column:1/-1}}
@media(max-width:680px){.lab-result-report-search-row{grid-template-columns:40px 1fr;padding-right:10px}.lab-result-report-state{grid-column:2}.lab-selected-report-summary-row,.lab-result-component-row{grid-template-columns:1fr}.lab-result-component-comment{grid-column:auto}}
`

const output = {
  fields: [root],
  formConfig: {
    modelName: 'formData',
    refName: 'sdForm',
    rulesName: 'rules',
    labelWidth: 120,
    labelPosition: 'top',
    size: '',
    labelAlign: 'label-right-align',
    cssCode,
    customClass: [],
    functions: '',
    layoutType: 'PC',
    jsonVersion: 3,
    onFormCreated: '',
    onFormMounted: '',
    onParentChange: '',
    onFormDataChange: '',
    onFormUnmounted: '',
  },
}

fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`)
console.log(`Wrote ${OUTPUT}`)
console.log('Layout: 9/15; ListViews: report search, selected report summary, result items')
