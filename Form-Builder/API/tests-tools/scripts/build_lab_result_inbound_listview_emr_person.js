const fs = require('fs')
const path = require('path')

const ROOT = __dirname
const PERSON_FILE = path.join(ROOT, 'person.json')
const EMR_FILE = path.join(ROOT, 'EMR.json')
const INBOUND_SOURCE_FILE = path.join(ROOT, 'Lab_Result_Inbound_Receive.json')
const LIST_OUTPUT = path.join(ROOT, 'Lab_Result_Inbound_ListView_EMR_Person.json')
const VIEW_OUTPUT = path.join(ROOT, 'Lab_Result_Inbound_Receive_User_View_EMR_Person_v2.json')

const INBOUND_FORM_ID = '6a8b1c03f851000f28e501ef'
const RESULT_ITEM_FORM_ID = '6a7aa641935ed08882467374'
const ZERO_ID = '000000000000000000000000'

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const clone = value => JSON.parse(JSON.stringify(value))

function walk(value, visit) {
  if (!value || typeof value !== 'object') return
  if (!Array.isArray(value) && value.component) visit(value)
  if (Array.isArray(value)) value.forEach(item => walk(item, visit))
  else Object.values(value).forEach(item => walk(item, visit))
}

function findOne(root, predicate, label) {
  let result = null
  walk(root, node => { if (!result && predicate(node)) result = node })
  if (!result) throw new Error(`Template not found: ${label}`)
  return result
}

const person = readJson(PERSON_FILE)
const emr = readJson(EMR_FILE)
const inboundSource = readJson(INBOUND_SOURCE_FILE)

const gridTemplate = clone(person.fields[0])
const colTemplate = clone(person.fields[0].cols[0])
const listTemplate = clone(findOne(
  emr,
  node => node.component === 'list-ui' && node.options?.name === 'visit_unit',
  'EMR visit_unit ListView',
))
const rowButtonTemplate = clone(listTemplate.options.buttonsRow[0])

const inboundFields = new Map()
walk(inboundSource.fields, node => {
  if (node.formItemFlag === true && node.options?.name) inboundFields.set(node.options.name, node)
})

let identity = 83000
function nextId() { identity += 1; return identity }

function clearChildren(node) {
  delete node.fields
  delete node.cols
  delete node.tabs
  return node
}

function setId(node) {
  const number = nextId()
  if (node.component === 'grid-col') node.id = `grid-col-${number}`
  else node.id = `${node.component}${number}`
  return node
}

function makeCol(name, span, fields) {
  const col = clearChildren(clone(colTemplate))
  col.fields = fields
  col.options = {
    ...col.options,
    name,
    hidden: false,
    span,
    offset: 0,
    push: 0,
    pull: 0,
    responsive: false,
    md: 12,
    sm: 24,
    xs: 24,
    bgColor: null,
    customClass: '',
  }
  return setId(col)
}

function makeRoot(name, cols) {
  const grid = clearChildren(clone(gridTemplate))
  grid.cols = cols
  grid.options = {
    ...grid.options,
    name,
    hidden: false,
    gutter: 16,
    colHeight: null,
    customClass: '',
  }
  return setId(grid)
}

function makeList({ name, titleName, formId, where, orderBy, searchField, height, detailContent, buttonsRow = [], onMounted = '' }) {
  const list = clearChildren(clone(listTemplate))
  delete list.key
  setId(list)
  list.options = {
    ...list.options,
    name,
    label: 'List View',
    columnSpan: 24,
    hidden: false,
    formId,
    parentId: '',
    params: null,
    titleEnable: true,
    titleName,
    iconName: '',
    initData: null,
    subformWidth: 600,
    where,
    orderBy,
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
    allowDeleteFunc: '',
    buttonsRow,
    reportList: null,
    defaultFilterParent: false,
    parentPath: '_id',
    showWhenParent: false,
    enableWs: false,
    listType: 'listview',
    iconWigth: 48,
    iconField: null,
    titleContent: '',
    titleField: null,
    detailContent,
    statusContent: '',
    statusField: null,
    colorField: null,
    groupField: null,
    disableNoMore: false,
    scrollDistance: 1,
    listColumn: 1,
    detailMaxRow: 8,
    totalEnable: true,
    noMoreLabel: 'หมดรายการ',
    searchPlaceholder: 'ค้นหา...',
    clickEvent: null,
    customValue: [],
    customClass: '',
    onCreated: '',
    onMounted,
    onUnmount: '',
    onInsertBefore: '',
    onUpdateBefore: '',
    onViewBefore: '',
    onBeforeSave: '',
    onAfterDelete: '',
    onselect: '',
    onunselect: '',
    wsRefresh: false,
  }
  return list
}

const openReceiptScript = `const form=this.getFormRef();
const raw=dataRow&&(dataRow._id||dataRow.dataid||dataRow.id);
const id=typeof raw==='object'?String(raw.$oid||raw.value||''):String(raw||'');
if(!/^[a-f0-9]{24}$/i.test(id)){this.notify('ไม่พบ Receipt ID ที่ถูกต้อง','warning',3000);return}
form.openForm('${INBOUND_FORM_ID}',id,null,{}, {readonly:true,popupType:'dialog',backdrop:false});`

const viewButton = {
  ...rowButtonTemplate,
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
  onClick: openReceiptScript,
}

const receiptListDetail = `<div style="display:grid;grid-template-columns:minmax(210px,1.25fr) minmax(120px,.65fr) 90px 105px minmax(130px,.75fr);gap:16px;align-items:center;width:100%;padding-right:96px;box-sizing:border-box;">
  <div><div style="font-size:15px;font-weight:750;color:#303947;">LAB NO. {{filler_order_no}}</div><div style="margin-top:3px;color:#5f6876;">HN {{hn}}</div><div style="margin-top:3px;color:#98a0ac;font-size:11px;">Order {{order_no}}</div></div>
  <div><div style="color:#98a0ac;font-size:11px;">Stage</div><div style="font-weight:650;">{{stage}}</div></div>
  <div><div style="color:#98a0ac;font-size:11px;">จำนวนผล</div><div style="font-weight:650;">{{item_count}}</div></div>
  <div><div style="color:#98a0ac;font-size:11px;">สถานะ</div><div style="font-weight:650;color:#e6a23c;">{{receipt_status}}</div></div>
  <div><div style="color:#98a0ac;font-size:11px;">เวลารายงาน</div><div>{{reported_at}}</div></div>
</div>`

const receiptList = makeList({
  name: 'lab_inbound_result_list',
  titleName: 'ผลแลปจาก LIS / Agent',
  formId: INBOUND_FORM_ID,
  where: 'xrstatx NOT IN(0,3)',
  orderBy: [
    { column: 'reported_at', sort: 'DESC' },
    { column: 'received_at', sort: 'DESC' },
  ],
  searchField: ['hn', 'filler_order_no', 'order_no'],
  height: '680px',
  detailContent: receiptListDetail,
  buttonsRow: [viewButton],
})
receiptList.options.searchPlaceholder = 'ค้นหา HN, LAB NO. หรือ Order No.'

const listForm = {
  fields: [makeRoot('lab_inbound_result_list_root', [
    makeCol('lab_inbound_result_list_col', 24, [receiptList]),
  ])],
  formConfig: {
    ...clone(person.formConfig),
    modelName: 'formData',
    refName: 'sdForm',
    rulesName: 'rules',
    labelWidth: 120,
    labelPosition: 'top',
    size: '',
    labelAlign: 'label-right-align',
    cssCode: '',
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

const resultListOnMounted = `const field=this;
let attempt=0;
const getForm=()=>typeof field.getFormRef==='function'?field.getFormRef():null;
const readReportId=()=>{if(typeof data!=='undefined'&&data&&data.result_report_id!=null)return data.result_report_id;const form=getForm();return form&&typeof form.getFieldValue==='function'?form.getFieldValue('result_report_id'):''};
const refresh=()=>{attempt+=1;const raw=readReportId();const id=typeof raw==='object'?String(raw.$oid||raw.value||raw._id||''):String(raw||'');if(!/^[a-f0-9]{24}$/i.test(id)){if(attempt<20)setTimeout(refresh,100);return}const where="xparentx = CONVERT('"+id+"', 'objectId')";if(typeof field.setFieldOption==='function')field.setFieldOption('where',where);const editor=field.getFieldEditor&&field.getFieldEditor();if(!editor)return;editor.dpFormData=editor.dpFormData||{};editor.dpFormData.options=editor.dpFormData.options||{};editor.defaultWhere=where;editor.dpFormData.options.where=where;if(typeof editor.handleRefresh==='function')editor.handleRefresh()};
refresh();`

const resultItemDetail = `<div style="display:grid;grid-template-columns:minmax(190px,1.25fr) minmax(125px,.75fr) minmax(120px,.7fr) 90px minmax(150px,.85fr);gap:14px;align-items:center;width:100%;box-sizing:border-box;">
  <div><div style="font-weight:750;color:#303947;">{{test_name}}</div><div style="margin-top:3px;color:#98a0ac;font-size:11px;">{{test_code}} / {{obs_code}}</div></div>
  <div><div style="color:#98a0ac;font-size:11px;">ผลตรวจ</div><div style="font-size:19px;font-weight:750;color:#273142;">{{result_value}}</div><div style="font-size:11px;color:#697383;">{{unit_symbol_snapshot}}</div></div>
  <div><div style="color:#98a0ac;font-size:11px;">ค่าปกติ</div><div>{{reference_range_snapshot}}</div></div>
  <div><div style="color:#98a0ac;font-size:11px;">Flag</div><div style="font-weight:750;color:#d94a4a;">{{interpretation_code}}</div><div style="font-size:11px;">Critical: {{is_critical}}</div></div>
  <div><div style="color:#98a0ac;font-size:11px;">หมายเหตุ</div><div style="color:#d94a4a;">{{critical_comment}}</div><div>{{result_comment}}</div></div>
</div>`

const resultItemsList = makeList({
  name: 'inbound_result_items_list',
  titleName: 'รายการผลตรวจ',
  formId: RESULT_ITEM_FORM_ID,
  where: `xparentx = CONVERT('${ZERO_ID}', 'objectId')`,
  orderBy: [
    { column: 'result_sequence', sort: 'ASC' },
    { column: 'test_code', sort: 'ASC' },
  ],
  searchField: ['test_name', 'test_code', 'obs_code', 'result_value'],
  height: '560px',
  detailContent: resultItemDetail,
  onMounted: resultListOnMounted,
})
resultItemsList.options.searchPlaceholder = 'ค้นหารายการตรวจหรือรหัสผล'

const visibleSpecs = [
  ['hn', 6, 'HN'],
  ['filler_order_no', 6, 'LAB NO.'],
  ['reported_at', 6, 'เวลารายงานผล'],
  ['verified_at', 6, 'เวลารับรองผล'],
  ['reported_by_source_name', 12, 'ผู้ลงผล'],
  ['verified_by_source_name', 12, 'ผู้รับรองผล'],
]
const visibleNames = new Set(visibleSpecs.map(([name]) => name))

function makeInboundField(name, visible, label) {
  const source = inboundFields.get(name)
  if (!source) throw new Error(`Inbound field not found: ${name}`)
  const field = clearChildren(clone(source))
  setId(field)
  field.options.name = name
  field.options.hidden = !visible
  if ('labelHidden' in field.options) field.options.labelHidden = !visible
  if (visible && label) field.options.label = label
  if ('readonly' in field.options) field.options.readonly = true
  field.options.customClass = ''
  for (const key of Object.keys(field.options)) {
    if (/^on[A-Z]/.test(key)) field.options[key] = ''
  }
  return field
}

const viewerCols = visibleSpecs.map(([name, span, label]) =>
  makeCol(`inbound_view_${name}_col`, span, [makeInboundField(name, true, label)]),
)

const hiddenFields = Array.from(inboundFields.keys())
  .filter(name => !visibleNames.has(name))
  .map(name => makeInboundField(name, false, null))
viewerCols.push(makeCol('inbound_view_hidden_storage_col', 24, hiddenFields))
viewerCols.push(makeCol('inbound_view_result_items_col', 24, [resultItemsList]))

const viewerForm = {
  fields: [makeRoot('lab_result_inbound_user_view_root', viewerCols)],
  formConfig: {
    ...clone(person.formConfig),
    modelName: 'formData',
    refName: 'sdForm',
    rulesName: 'rules',
    labelWidth: 120,
    labelPosition: 'top',
    size: '',
    labelAlign: 'label-right-align',
    cssCode: '',
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

fs.writeFileSync(LIST_OUTPUT, `${JSON.stringify(listForm, null, 2)}\n`)
fs.writeFileSync(VIEW_OUTPUT, `${JSON.stringify(viewerForm, null, 2)}\n`)
console.log(`Wrote ${path.basename(LIST_OUTPUT)}`)
console.log(`Wrote ${path.basename(VIEW_OUTPUT)}`)
console.log(`Inbound fields preserved: ${inboundFields.size}`)
