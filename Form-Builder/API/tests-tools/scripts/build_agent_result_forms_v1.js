const fs = require('fs')
const path = require('path')

const ROOT = __dirname
const VIEW_TEMPLATE = path.join(ROOT, 'Lab_Result_Inbound_Receive_User_View_EMR_Person_v2.json')
const PERSON_TEMPLATE = path.join(ROOT, 'person.json')
const DISEASE_TEMPLATE = path.join(ROOT, 'disease.json')

const OUTPUTS = {
  report: path.join(ROOT, 'Result_Report_Manual_Entry_Agent_Result_v1.json'),
  item: path.join(ROOT, 'Lab_Result_Item_Agent_Result_v1.json'),
  receipt: path.join(ROOT, 'Lab_Result_Inbound_Receive_Agent_Result_v1.json'),
}

const FORM_IDS = {
  report: '6a8d4334f851000f28e5025b',
  item: '6a8bc91df851000f28e501fb',
  receipt: '6a8b1c03f851000f28e501ef',
}

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const clone = value => JSON.parse(JSON.stringify(value))

const viewTemplate = readJson(VIEW_TEMPLATE)
const personTemplate = readJson(PERSON_TEMPLATE)
const diseaseTemplate = readJson(DISEASE_TEMPLATE)

function walk(value, callback) {
  if (Array.isArray(value)) {
    value.forEach(item => walk(item, callback))
    return
  }
  if (!value || typeof value !== 'object') return
  if (value.component) callback(value)
  if (value.fields) walk(value.fields, callback)
  if (value.cols) walk(value.cols, callback)
}

function findNode(root, predicate, description) {
  let found = null
  walk(root, node => {
    if (!found && predicate(node)) found = node
  })
  if (!found) throw new Error(`Template node not found: ${description}`)
  return clone(found)
}

const templates = {
  grid: clone(viewTemplate.fields[0]),
  col: clone(viewTemplate.fields[0].cols[0]),
  text: findNode(
    viewTemplate.fields,
    node => node.component === 'text-input' && node.options?.name === 'hn',
    'complete text-input',
  ),
  textarea: findNode(
    diseaseTemplate.fields,
    node => node.component === 'textarea-input',
    'complete textarea-input',
  ),
  select: findNode(
    personTemplate.fields,
    node => node.component === 'select-input' && node.options?.name === 'p_abogroup',
    'complete select-input',
  ),
  switch: findNode(
    personTemplate.fields,
    node => node.component === 'switch-input' && node.options?.name === 'p_twin',
    'complete switch-input',
  ),
  number: findNode(
    personTemplate.fields,
    node => node.component === 'number-input' && node.options?.name === 'birth_order',
    'complete number-input',
  ),
  list: findNode(
    viewTemplate.fields,
    node => node.component === 'list-ui' && node.options?.name === 'inbound_result_items_list',
    'runtime-verified list-ui',
  ),
}

let sequence = 92000
function nextNumber() {
  sequence += 1
  return sequence
}

function stripChildren(node) {
  delete node.fields
  delete node.cols
  delete node.widgetList
  return node
}

function setIdentity(node) {
  const number = nextNumber()
  if (node.component === 'grid-col') node.id = `grid-col-${number}`
  else node.id = `${node.component}${number}`
  return node
}

function clearEvents(options) {
  for (const key of Object.keys(options || {})) {
    if (/^on[A-Z]/.test(key)) options[key] = ''
  }
}

function makeText(spec) {
  const node = stripChildren(clone(templates.text))
  Object.assign(node.options, {
    name: spec.name,
    label: spec.label,
    defaultValue: spec.defaultValue ?? null,
    placeholder: spec.placeholder || '',
    columnSpan: spec.span,
    labelHidden: false,
    readonly: spec.editable !== true,
    disabled: false,
    hidden: spec.hidden === true,
    clearable: spec.editable === true,
    required: spec.required === true,
    requiredHint: spec.requiredHint || '',
    validation: '',
    validationHint: '',
    customClass: '',
    minLength: null,
    maxLength: spec.maxLength ?? null,
    showWordLimit: false,
  })
  clearEvents(node.options)
  return setIdentity(node)
}

function makeTextarea(spec) {
  const node = stripChildren(clone(templates.textarea))
  Object.assign(node.options, {
    name: spec.name,
    label: spec.label,
    rows: spec.rows || 4,
    defaultValue: spec.defaultValue ?? null,
    placeholder: spec.placeholder || '',
    columnSpan: spec.span,
    labelHidden: false,
    readonly: spec.editable !== true,
    disabled: false,
    hidden: spec.hidden === true,
    autoSize: spec.autoSize === true,
    required: spec.required === true,
    requiredHint: spec.requiredHint || '',
    validation: '',
    validationHint: '',
    customClass: '',
    minLength: null,
    maxLength: spec.maxLength ?? null,
    showWordLimit: false,
  })
  clearEvents(node.options)
  return setIdentity(node)
}

function makeSelect(spec) {
  const node = stripChildren(clone(templates.select))
  Object.assign(node.options, {
    name: spec.name,
    label: spec.label,
    defaultValue: spec.defaultValue ?? '',
    placeholder: spec.placeholder || '',
    columnSpan: spec.span,
    labelHidden: false,
    disabled: spec.editable !== true,
    hidden: spec.hidden === true,
    clearable: spec.editable === true,
    filterable: false,
    allowCreate: false,
    remote: false,
    automaticDropdown: false,
    multiple: false,
    multipleLimit: null,
    optionItems: clone(spec.optionItems || []),
    required: spec.required === true,
    requiredHint: spec.requiredHint || '',
    validation: '',
    validationHint: '',
    customClass: '',
  })
  clearEvents(node.options)
  return setIdentity(node)
}

function makeSwitch(spec) {
  const node = stripChildren(clone(templates.switch))
  Object.assign(node.options, {
    name: spec.name,
    label: spec.label,
    defaultValue: spec.defaultValue === true,
    columnSpan: spec.span,
    labelHidden: false,
    disabled: true,
    hidden: spec.hidden === true,
    customClass: '',
    activeText: spec.activeText || 'Critical',
    inactiveText: spec.inactiveText || 'ปกติ',
    inlinePrompt: false,
  })
  clearEvents(node.options)
  return setIdentity(node)
}

function makeNumber(spec) {
  const node = stripChildren(clone(templates.number))
  Object.assign(node.options, {
    name: spec.name,
    label: spec.label,
    defaultValue: spec.defaultValue ?? 0,
    placeholder: spec.placeholder || '',
    columnSpan: spec.span,
    labelHidden: false,
    disabled: true,
    hidden: spec.hidden === true,
    required: spec.required === true,
    requiredHint: spec.requiredHint || '',
    validation: '',
    validationHint: '',
    customClass: '',
    min: 0,
    max: 100000000000,
    precision: 0,
    step: 1,
  })
  clearEvents(node.options)
  return setIdentity(node)
}

function makeCol(name, span, widgets) {
  const col = stripChildren(clone(templates.col))
  col.fields = widgets
  Object.assign(col.options, {
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
  })
  return setIdentity(col)
}

function makeRoot(name, cols) {
  const grid = stripChildren(clone(templates.grid))
  grid.cols = cols
  Object.assign(grid.options, {
    name,
    hidden: false,
    gutter: 16,
    colHeight: null,
    customClass: '',
  })
  return setIdentity(grid)
}

function makeForm(root) {
  return {
    fields: [root],
    formConfig: clone(viewTemplate.formConfig),
  }
}

function fieldFromSpec(spec) {
  if (spec.type === 'textarea') return makeTextarea(spec)
  if (spec.type === 'select') return makeSelect(spec)
  if (spec.type === 'switch') return makeSwitch(spec)
  if (spec.type === 'number') return makeNumber(spec)
  return makeText(spec)
}

const receiptFields = [
  { name: 'record_kind', label: 'ชนิด Record', type: 'select', span: 6, defaultValue: 'receipt', optionItems: [
    { label: 'Technical receipt', value: 'receipt' },
    { label: 'Result report', value: 'report' },
  ] },
  { name: 'report_key', label: 'Report Key', span: 6 },
  { name: 'order_status_id', label: 'Lab Work Item ID', span: 6 },
  { name: 'lab_section', label: 'Lab Section Code', span: 6 },
  { name: 'lab_section_name', label: 'Lab Section', span: 6 },
  { name: 'receipt_status', label: 'สถานะการรับ/ประมวลผล', type: 'select', span: 6, optionItems: [
    { label: 'รับข้อความแล้ว', value: 'received' },
    { label: 'ประมวลผลแล้ว', value: 'processed' },
    { label: 'ข้อมูลซ้ำ', value: 'duplicate' },
    { label: 'จับคู่ไม่สำเร็จ', value: 'unmatched' },
    { label: 'ผิดพลาด', value: 'error' },
  ] },
  { name: 'source_channel', label: 'ช่องทาง', span: 6, defaultValue: 'agent' },
  { name: 'schema_version', label: 'Schema version', span: 6, defaultValue: 'his-agent-result-v1' },
  { name: 'received_at', label: 'เวลาที่ HIS รับข้อความ', span: 6 },
  { name: 'order_no', label: 'Order No.', span: 6, required: true },
  { name: 'filler_order_no', label: 'LAB NO.', span: 6, required: true },
  { name: 'hn', label: 'HN', span: 6, required: true },
  { name: 'visit_id', label: 'VN / Visit ID', span: 6, required: true },
  { name: 'result_uid', label: 'Result UID', span: 6, required: true },
  { name: 'report_seq', label: 'Report Seq', span: 6, required: true },
  { name: 'stage', label: 'Stage', span: 6, required: true },
  { name: 'agent_overall_status', label: 'สถานะผลจาก Agent', type: 'select', span: 6, required: true, optionItems: [
    { label: 'ออกผลบางส่วน', value: 'in_progress' },
    { label: 'ออกผลแล้ว', value: 'resulted' },
    { label: 'แก้ไขผล', value: 'corrected' },
    { label: 'ยกเลิกผล', value: 'cancelled' },
  ] },
  { name: 'internal_overall_status', label: 'สถานะภายใน HIS', type: 'select', span: 6, optionItems: [
    { label: 'กำลังตรวจ', value: 'processing' },
    { label: 'ออกผลบางส่วน', value: 'partial' },
    { label: 'ออกผลครบ', value: 'completed' },
    { label: 'แก้ไขผล', value: 'corrected' },
    { label: 'ยกเลิกผล', value: 'cancelled' },
  ] },
  { name: 'reported_at', label: 'เวลารายงานผล', span: 6, required: true },
  { name: 'reported_by_source_id', label: 'รหัสผู้ลงผล', span: 6, required: true },
  { name: 'reported_by_source_name', label: 'ผู้ลงผล', span: 6, required: true },
  { name: 'verified_at', label: 'เวลารับรองผล', span: 6 },
  { name: 'verified_by_source_id', label: 'รหัสผู้รับรองผล', span: 6 },
  { name: 'verified_by_source_name', label: 'ผู้รับรองผล', span: 6 },
  { name: 'item_count', label: 'จำนวนรายการผล', type: 'number', span: 6 },
  { name: 'critical_count', label: 'จำนวน Critical', type: 'number', span: 6 },
  { name: 'matched_item_count', label: 'จับคู่สำเร็จ', type: 'number', span: 6 },
  { name: 'unmatched_item_count', label: 'จับคู่ไม่สำเร็จ', type: 'number', span: 6 },
  { name: 'items_json', label: 'Items JSON Snapshot', type: 'textarea', span: 24, rows: 8 },
  { name: 'result_report_id', label: 'Result Report ID', span: 6 },
  { name: 'processed_at', label: 'เวลาประมวลผล', span: 6 },
  { name: 'payload_hash', label: 'Payload Hash', span: 12 },
  { name: 'error_message', label: 'รายละเอียดข้อผิดพลาด', type: 'textarea', span: 24, rows: 4 },
  { name: 'raw_payload_json', label: 'Raw Payload JSON', type: 'textarea', span: 24, rows: 10 },
]

function buildReceiptForm() {
  const visibleNames = new Set([
    'receipt_status', 'filler_order_no', 'hn', 'visit_id',
    'agent_overall_status', 'reported_at', 'reported_by_source_name',
    'verified_at', 'verified_by_source_name',
  ])
  const cols = []
  const hidden = []
  for (const spec of receiptFields) {
    const fieldSpec = { ...spec, hidden: !visibleNames.has(spec.name) }
    const widget = fieldFromSpec(fieldSpec)
    if (fieldSpec.hidden) hidden.push(widget)
    else cols.push(makeCol(`receipt_${spec.name}_col`, spec.span, [widget]))
  }
  cols.push(makeCol('receipt_internal_storage_col', 24, hidden))
  return makeForm(makeRoot('lab_result_inbound_receive_agent_v1_root', cols))
}

const itemHiddenSpecs = [
  { name: 'result_report_id', label: 'Result Report ID' },
  { name: 'result_definition_id', label: 'Result Definition ID' },
  { name: 'result_sequence', label: 'ลำดับผล' },
  { name: 'order_no', label: 'Order No.' },
  { name: 'filler_order_no', label: 'LAB NO.' },
  { name: 'hn', label: 'HN' },
  { name: 'visit_id', label: 'VN / Visit ID' },
  { name: 'lab_section', label: 'Lab Section Code' },
  { name: 'test_code', label: 'Test Code' },
  { name: 'obs_code', label: 'OBS Code', required: true },
  { name: 'obs_name', label: 'OBS Name' },
  { name: 'panel_code', label: 'Panel Code' },
  { name: 'panel_name', label: 'Panel / Test Item' },
  { name: 'group_role', label: 'Group Role' },
  { name: 'organism', label: 'Organism' },
  { name: 'units', label: 'Units จาก Agent' },
  { name: 'ref_range', label: 'Ref Range จาก Agent' },
  { name: 'result_source', label: 'ที่มาผล', type: 'select', defaultValue: 'manual', optionItems: [
    { label: 'Agent/LIS', value: 'agent' },
    { label: 'Manual', value: 'manual' },
    { label: 'Manual correction', value: 'manual_correction' },
  ] },
  { name: 'result_status', label: 'สถานะผลรายตัว', type: 'select', defaultValue: 'pending', optionItems: [
    { label: 'รอผล', value: 'pending' },
    { label: 'ลงผลแล้ว', value: 'entered' },
    { label: 'Final', value: 'final' },
    { label: 'Corrected', value: 'corrected' },
    { label: 'Void', value: 'void' },
  ] },
  { name: 'result_uid', label: 'Result UID' },
  { name: 'obx_status', label: 'OBX Status' },
  { name: 'change_kind', label: 'Change Kind' },
  { name: 'previous_value', label: 'Previous Value', type: 'textarea' },
  { name: 'receipt_seq', label: 'Receipt Seq' },
  { name: 'result_version', label: 'Result Version' },
  { name: 'critical_low_rule', label: 'Critical Low จาก Agent' },
  { name: 'critical_high_rule', label: 'Critical High จาก Agent' },
  { name: 'entered_by', label: 'ผู้บันทึก Manual' },
  { name: 'entered_at', label: 'เวลาบันทึก Manual' },
  { name: 'last_edited_by', label: 'ผู้แก้ไขล่าสุด' },
  { name: 'last_edited_at', label: 'เวลาแก้ไขล่าสุด' },
  { name: 'edit_history_json', label: 'ประวัติการแก้ไข', type: 'textarea' },
]

function buildItemForm() {
  const cols = [
    makeCol('item_test_name_col', 24, [makeText({
      name: 'test_name', label: 'Test Item / รายการตรวจ', span: 24, required: true,
    })]),
    makeCol('item_result_value_col', 24, [makeTextarea({
      name: 'result_value', label: 'Result / ผลตรวจ', span: 24, rows: 6,
      editable: true, required: false,
      placeholder: 'กรอกผลได้ทั้งตัวเลข ข้อความสั้น หรือข้อความหลายบรรทัด',
    })]),
    makeCol('item_unit_col', 6, [makeText({
      name: 'unit_symbol_snapshot', label: 'Unit / หน่วย', span: 6,
    })]),
    makeCol('item_interpretation_col', 6, [makeText({
      name: 'interpretation_code', label: 'แปลผล', span: 6,
    })]),
    makeCol('item_reference_col', 6, [makeText({
      name: 'reference_range_snapshot', label: 'Ref. Range / ค่าปกติ', span: 6,
    })]),
    makeCol('item_critical_col', 6, [makeSwitch({
      name: 'is_critical', label: 'Critical / ค่าวิกฤติ', span: 6,
    })]),
  ]
  const hidden = itemHiddenSpecs.map(spec => fieldFromSpec({
    ...spec,
    span: 24,
    hidden: true,
  }))
  cols.push(makeCol('item_internal_storage_col', 24, hidden))
  return makeForm(makeRoot('lab_result_item_agent_manual_v1_root', cols))
}

function resultListOnMounted() {
  return [
    'const field=this;',
    'let attempt=0;',
    "const idOf=(raw)=>{if(raw&&typeof raw==='object')return String(raw.$oid||raw.value||raw._id||'');return String(raw||'')};",
    "const readId=()=>{if(typeof data!=='undefined'&&data){const direct=idOf(data.result_report_id||data._id);if(direct)return direct}const form=typeof field.getFormRef==='function'?field.getFormRef():null;if(!form)return '';const model=form.formDataModel||form.formData||{};return idOf(model.result_report_id||model._id)};",
    "const apply=()=>{attempt+=1;const id=readId();if(!/^[a-f0-9]{24}$/i.test(id)){if(attempt<20)setTimeout(apply,100);return}const where=\"xparentx = CONVERT('\"+id+\"', 'objectId')\";if(typeof field.setFieldOption==='function')field.setFieldOption('where',where);const editor=field.getFieldEditor&&field.getFieldEditor();if(!editor)return;editor.dpFormData=editor.dpFormData||{};editor.dpFormData.options=editor.dpFormData.options||{};editor.defaultWhere=where;editor.dpFormData.options.where=where;if(typeof editor.handleRefresh==='function')editor.handleRefresh()};",
    'apply();',
  ].join('\n')
}

function resultButtonOnClick() {
  return [
    'const host=this.getFormRef&&this.getFormRef();',
    "const raw=dataRow&&(dataRow._id||dataRow.dataid||dataRow.id);",
    "const id=raw&&typeof raw==='object'?String(raw.$oid||raw.value||raw._id||''):String(raw||'');",
    "if(!host||typeof host.openForm!=='function'||!/^[a-f0-9]{24}$/i.test(id)){this.notify('ไม่พบ Result Item ID ที่ถูกต้อง','warning',3000);return;}",
    'const listField=this;',
    `host.openForm('${FORM_IDS.item}',id,null,{}, {`,
    '  readonly:false,',
    "  popupType:'dialog',",
    '  backdrop:false,',
    '  afterSaveCallback:()=>{',
    "    if(typeof host.subFormClose==='function')host.subFormClose();",
    '    const editor=listField.getFieldEditor&&listField.getFieldEditor();',
    "    if(editor&&typeof editor.handleRefresh==='function')editor.handleRefresh();",
    '  }',
    '});',
  ].join('\n')
}

function makeResultList() {
  const node = stripChildren(clone(templates.list))
  // The exported/running list-ui shape is keyless. Adding key makes this Builder version render an empty column.
  delete node.key
  Object.assign(node.options, {
    name: 'lab_result_items_list',
    columnSpan: 24,
    hidden: false,
    formId: FORM_IDS.item,
    parentId: '',
    params: null,
    titleEnable: true,
    titleName: 'รายการผลตรวจ',
    iconName: '',
    initData: null,
    subformWidth: 900,
    where: "xparentx = CONVERT('000000000000000000000000', 'objectId')",
    orderBy: [
      { column: 'result_sequence', sort: 'ASC' },
      { column: 'obs_code', sort: 'ASC' },
    ],
    searchField: ['test_name', 'obs_name', 'test_code', 'obs_code', 'result_value'],
    limitRow: 100,
    actionEnable: true,
    addBtnEnable: false,
    delBtnEnable: false,
    viewBtnEnable: false,
    reloadBtnEnable: true,
    updateBtnEnable: false,
    height: '620px',
    providerType: 'FORM',
    allowDeleteFunc: '',
    buttonsRow: [{
      prefixIcon: 'el-edit',
      label: 'กรอก / แก้ไขผล',
      type: 'primary',
      suffixIcon: '',
      color: '',
      disabled: false,
      plain: true,
      circle: false,
      round: true,
      loading: false,
      confirm: false,
      confirmTitle: '',
      badge: 0,
      badgeMax: 99,
      tag: 'button',
      href: '',
      blank: false,
      onClick: resultButtonOnClick(),
    }],
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
    detailContent: [
      '<div style="display:grid;grid-template-columns:minmax(190px,1.2fr) minmax(190px,1.25fr) 90px 90px minmax(145px,.9fr) minmax(145px,.9fr);gap:14px;align-items:start;width:100%;box-sizing:border-box;">',
      '  <div><div style="font-weight:750;color:#303947;">{{testItemLabel}}</div><div style="margin-top:3px;color:#7b8492;font-size:12px;">{{componentLabel}}</div><div style="margin-top:2px;color:#a0a7b2;font-size:11px;">{{testCodeLabel}}</div></div>',
      '  <div><div style="color:#98a0ac;font-size:11px;">Result / ผลตรวจ</div><div style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:16px;font-weight:700;color:#273142;">{{resultValueLabel}}</div></div>',
      '  <div><div style="color:#98a0ac;font-size:11px;">Unit</div><div>{{unitLabel}}</div></div>',
      '  <div><div style="color:#98a0ac;font-size:11px;">แปลผล</div><div style="font-weight:700;">{{interpretationLabel}}</div></div>',
      '  <div><div style="color:#98a0ac;font-size:11px;">Ref. Range</div><div style="white-space:pre-wrap;">{{referenceLabel}}</div></div>',
      '  <div><div style="color:#98a0ac;font-size:11px;">Critical</div><div style="white-space:pre-wrap;font-weight:750;color:#d94a4a;">{{criticalLabel}}</div></div>',
      '</div>',
    ].join('\n'),
    statusContent: '',
    statusField: null,
    colorField: null,
    groupField: null,
    disableNoMore: false,
    scrollDistance: 1,
    listColumn: 1,
    detailMaxRow: 12,
    totalEnable: true,
    noMoreLabel: 'หมดรายการ',
    searchPlaceholder: 'ค้นหารายการตรวจ รหัสผล หรือค่าผล',
    clickEvent: null,
    customValue: [
      { labelWidth: 150, align: 'left', fieldName: 'testItemLabel', expressions: "String(row.panel_name||row.test_name||row.obs_name||row.test_code||row.obs_code||'-')" },
      { labelWidth: 150, align: 'left', fieldName: 'componentLabel', expressions: "(row.panel_name&&String(row.panel_name)!==String(row.test_name||row.obs_name||''))?String(row.test_name||row.obs_name||''):''" },
      { labelWidth: 150, align: 'left', fieldName: 'testCodeLabel', expressions: "String(row.obs_code||row.test_code||'-')" },
      { labelWidth: 150, align: 'left', fieldName: 'resultValueLabel', expressions: "(row.result_value!==undefined&&row.result_value!==null&&String(row.result_value)!=='')?String(row.result_value):'รอผล'" },
      { labelWidth: 150, align: 'left', fieldName: 'unitLabel', expressions: "String(row.unit_symbol_snapshot||row.units||'-')" },
      { labelWidth: 150, align: 'left', fieldName: 'interpretationLabel', expressions: "String(row.interpretation_code||'-')" },
      { labelWidth: 150, align: 'left', fieldName: 'referenceLabel', expressions: "String(row.reference_range_snapshot||row.ref_range||'-')" },
      { labelWidth: 150, align: 'left', fieldName: 'criticalLabel', expressions: "(function(){var a=[];if(row.critical_low_rule)a.push('ต่ำ: '+row.critical_low_rule);if(row.critical_high_rule)a.push('สูง: '+row.critical_high_rule);if(!a.length&&(row.is_critical===true||String(row.is_critical).toLowerCase()==='true'))a.push('CRITICAL');return a.join('\\n')||'-'})()" },
    ],
    customClass: '',
    onCreated: '',
    onMounted: resultListOnMounted(),
    onUnmount: '',
    onInsertBefore: '',
    onUpdateBefore: '',
    onViewBefore: '',
    onBeforeSave: '',
    onAfterDelete: '',
    onselect: '',
    onunselect: '',
    label: 'List View',
    wsRefresh: false,
  })
  return setIdentity(node)
}

function buildReportForm() {
  const visibleNames = new Set([
    'hn', 'visit_id', 'filler_order_no', 'reported_at',
    'reported_by_source_name', 'verified_by_source_name',
  ])
  const spans = {
    hn: 6,
    visit_id: 6,
    filler_order_no: 6,
    reported_at: 6,
    reported_by_source_name: 12,
    verified_by_source_name: 12,
  }
  const cols = []
  const hidden = []
  for (const spec of receiptFields) {
    const fieldSpec = {
      ...spec,
      span: spans[spec.name] || 24,
      hidden: !visibleNames.has(spec.name),
      defaultValue: spec.name === 'record_kind' ? 'report' : spec.defaultValue,
    }
    const widget = fieldFromSpec(fieldSpec)
    if (fieldSpec.hidden) hidden.push(widget)
    else cols.push(makeCol(`report_${spec.name}_col`, fieldSpec.span, [widget]))
  }
  cols.push(makeCol('report_internal_storage_col', 24, hidden))
  cols.push(makeCol('report_result_items_col', 24, [makeResultList()]))
  const form = makeForm(makeRoot('result_report_manual_entry_agent_v1_root', cols))
  return form
}

const generated = {
  report: buildReportForm(),
  item: buildItemForm(),
  receipt: buildReceiptForm(),
}

for (const [name, outputPath] of Object.entries(OUTPUTS)) {
  fs.writeFileSync(outputPath, `${JSON.stringify(generated[name], null, 2)}\n`)
  JSON.parse(fs.readFileSync(outputPath, 'utf8'))
  console.log(`WROTE ${path.basename(outputPath)}`)
}

console.log(`REPORT_FORM_ID=${FORM_IDS.report}`)
console.log(`ITEM_FORM_ID=${FORM_IDS.item}`)
console.log(`RECEIPT_FORM_ID=${FORM_IDS.receipt}`)
