const fs = require('fs');
const path = require('path');

const manualSourcePath = '/Users/nichada/Documents/lab-result-manual.json';
const gridSourcePath = '/Users/nichada/Documents/init-vault/HIS/sdform_module/patient.json';
const outputPath = path.join(__dirname, 'Result_Report_Manual_DataGrid_Validated.json');

const manualModel = JSON.parse(fs.readFileSync(manualSourcePath, 'utf8'));
const gridSourceModel = JSON.parse(fs.readFileSync(gridSourcePath, 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));

function findField(fields, predicate) {
  for (const field of fields || []) {
    if (predicate(field)) return field;
    const nested = findField(field && field.fields, predicate);
    if (nested) return nested;
  }
  return null;
}

function findObject(value, predicate) {
  if (!value || typeof value !== 'object') return null;
  if (predicate(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findObject(item, predicate);
      if (found) return found;
    }
    return null;
  }
  for (const item of Object.values(value)) {
    const found = findObject(item, predicate);
    if (found) return found;
  }
  return null;
}

function manualField(name) {
  const field = findField(manualModel.fields, item => item && item.options && item.options.name === name);
  if (!field) throw new Error(`Missing manual field template: ${name}`);
  return clone(field);
}

const gridTemplate = findObject(
  gridSourceModel,
  item => item && (item.component === 'datagrid-form-ui' || item.name === 'Data Grid Form')
);
if (!gridTemplate) throw new Error('Data Grid Form template was not found');

function configureHeader(name, label, columnSpan, hidden = false) {
  const field = manualField(name);
  field.options.label = label;
  field.options.columnSpan = columnSpan;
  field.options.hidden = hidden;
  field.options.readonly = true;
  field.options.disabled = false;
  field.options.required = false;
  field.options.requiredHint = '';
  field.options.clearable = false;
  field.options.onCreated = '';
  field.options.onMounted = '';
  field.options.onUnmount = '';
  field.options.onInput = '';
  field.options.onChange = '';
  field.options.onFocus = '';
  field.options.onBlur = '';
  field.options.onValidate = '';
  return field;
}

const orderStatusId = configureHeader('order_status_id', 'Lab Status ID', 24, true);
const labNo = configureHeader('lab_no', 'LAB NO.', 6);
const patientHn = configureHeader('patient_hn', 'HN', 6);
const patientName = configureHeader('patient_name', 'ชื่อผู้ป่วย', 6);
const visitId = configureHeader('visit_id', 'VN', 6);
const labSection = configureHeader('lab_section', 'ห้อง Lab / Section', 12);
const specimen = configureHeader('specimen', 'Specimen', 12);
const sourceMode = configureHeader('source_mode', 'รูปแบบการรับผล', 24, true);
sourceMode.options.defaultValue = 'manual';

const grid = clone(gridTemplate);
grid.id = 'datagrid-form-ui-lab-result-items';
grid.key = 91001;
grid.options.name = 'lab_result_items_grid';
grid.options.label = 'รายการผลตรวจ';
grid.options.columnSpan = 24;
grid.options.hidden = false;
grid.options.formId = '6a7aa641935ed08882467374';
grid.options.providerType = 'FORM';
grid.options.parentId = '';
grid.options.params = null;
grid.options.readonly = false;
grid.options.titleEnable = true;
grid.options.titleName = 'รายการผลตรวจ';
grid.options.displayFields = [
  'result_sequence',
  'test_name',
  'result_value',
  'unit_id',
  'reference_range_snapshot',
  'interpretation_code',
  'critical_comment',
  'result_comment'
];
grid.options.searchField = ['test_code', 'test_name'];
grid.options.editColumn = [
  'result_value',
  'unit_id',
  'interpretation_code',
  'critical_comment',
  'result_comment'
];
grid.options.limitRow = 100;
grid.options.infiniteScroll = false;
grid.options.rememberState = false;
grid.options.orderBy = [{ column: 'result_sequence', sort: 'ASC' }];
grid.options.maxHeight = 620;
grid.options.height = 'auto';
grid.options.subformWidth = 900;
grid.options.where = "order_status_id = '__NO_CONTEXT__'";
grid.options.defaultFilterParent = false;
grid.options.parentPath = '_id';
grid.options.showWhenParent = false;
grid.options.enableWs = false;
grid.options.buttonsBar = null;
grid.options.buttonsRow = null;
grid.options.resizable = true;
grid.options.indexColumn = true;
grid.options.systemColumn = false;
grid.options.actionEnable = true;
grid.options.actionCrudEnable = true;
grid.options.actionLabel = 'จัดการ';
grid.options.actionWidth = 90;
grid.options.rawdataBtnEnable = false;
grid.options.exportBtnEnable = false;
grid.options.exportRowBtnEnable = false;
grid.options.addBtnEnable = false;
grid.options.viewBtnEnable = true;
grid.options.updateBtnEnable = true;
grid.options.delBtnEnable = false;
grid.options.reloadBtnEnable = true;
grid.options.groupKey = '';
grid.options.aggrColumn = null;
grid.options.sumColumn = null;
grid.options.totalInline = true;
grid.options.keyId = '_id';
grid.options.rowKey = 'dataid';
grid.options.onCreated = '';
grid.options.onMounted = '';
grid.options.onUnmount = '';
grid.options.onInsertBefore = '';
grid.options.onUpdateBefore = '';
grid.options.onViewBefore = '';
grid.options.onBeforeSave = '';
grid.options.onAfterDelete = '';

manualModel.fields = [
  orderStatusId,
  labNo,
  patientHn,
  patientName,
  visitId,
  labSection,
  specimen,
  sourceMode,
  grid
];

manualModel.formConfig.onFormCreated = '';
manualModel.formConfig.onFormMounted = [
  "const params = (typeof formParams !== 'undefined' && formParams) ? formParams : {};",
  "const patch = {};",
  "['order_status_id','lab_no','patient_hn','patient_name','visit_id','lab_section','specimen','source_mode'].forEach(name => {",
  "  if (params[name] !== undefined && params[name] !== null) patch[name] = params[name];",
  "});",
  "if (Object.keys(patch).length) this.setFormData(patch);",
  "const rawStatusId = params.order_status_id || this.getFieldValue('order_status_id') || '';",
  "const statusId = String(rawStatusId && rawStatusId.value ? rawStatusId.value : rawStatusId).trim();",
  "const safeStatusId = /^[0-9a-fA-F]{24}$/.test(statusId) ? statusId : '__NO_CONTEXT__';",
  "const where = \"order_status_id = '\" + safeStatusId + \"'\";",
  "setTimeout(() => {",
  "  const gridField = this.getFieldRef && this.getFieldRef('lab_result_items_grid');",
  "  if (!gridField) return;",
  "  if (typeof gridField.setFieldOption === 'function') gridField.setFieldOption('where', where);",
  "  const editor = gridField.getFieldEditor && gridField.getFieldEditor();",
  "  if (!editor) return;",
  "  if (!editor.dpFormData.options) editor.dpFormData.options = {};",
  "  editor.defaultWhere = where;",
  "  editor.dpFormData.options.where = where;",
  "  if (typeof editor.handleRefresh === 'function') editor.handleRefresh();",
  "}, 80);"
].join('\n');
manualModel.formConfig.onParentChange = '';
manualModel.formConfig.onFormDataChange = '';
manualModel.formConfig.onFormUnmounted = '';

fs.writeFileSync(outputPath, `${JSON.stringify(manualModel, null, 2)}\n`);
console.log(outputPath);
