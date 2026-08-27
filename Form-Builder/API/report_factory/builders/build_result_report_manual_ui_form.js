const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, 'Result_Report_Manual_DataGrid_Validated.json');
const outputPath = path.join(__dirname, 'Result_Report_Manual_UI_Validated.json');

const model = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

const keepHeaderFields = new Set([
  'lab_no',
  'patient_hn',
  'patient_name',
  'visit_id',
  'lab_section',
  'specimen',
]);

model.fields = model.fields.filter(field => {
  if (!field || !field.options) return false;
  return keepHeaderFields.has(field.options.name) || field.component === 'datagrid-form-ui';
});

const headerLayout = {
  lab_no: { label: 'LAB NO.', span: 6 },
  patient_hn: { label: 'HN', span: 6 },
  patient_name: { label: 'ชื่อผู้ป่วย', span: 6 },
  visit_id: { label: 'VN', span: 6 },
  lab_section: { label: 'ห้อง Lab / Section', span: 12 },
  specimen: { label: 'Specimen', span: 12 },
};

for (const field of model.fields) {
  if (!field || !field.options || !headerLayout[field.options.name]) continue;
  const config = headerLayout[field.options.name];
  field.options.label = config.label;
  field.options.columnSpan = config.span;
  field.options.readonly = true;
  field.options.disabled = false;
  field.options.hidden = false;
  field.options.required = false;
  field.options.clearable = false;
  field.options.defaultValue = '';
  field.options.placeholder = '';
}

const grid = model.fields.find(field => field && field.component === 'datagrid-form-ui');
if (!grid) throw new Error('Data Grid Form was not found in source model');

Object.assign(grid.options, {
  name: 'lab_result_items_grid',
  label: 'รายการผลตรวจ',
  titleEnable: true,
  titleName: 'รายการผลตรวจ',
  hidden: false,
  readonly: false,
  formId: '6a7aa641935ed08882467374',
  providerType: 'FORM',
  displayFields: [
    'test_name',
    'result_value',
    'unit_symbol_snapshot',
    'reference_range_snapshot',
    'interpretation_code',
    'result_comment',
  ],
  searchField: ['test_code', 'test_name'],
  editColumn: null,
  orderBy: [{ column: 'result_sequence', sort: 'ASC' }],
  where: 'order_status_id = :order_status_id',
  defaultFilterParent: false,
  showWhenParent: false,
  limitRow: 100,
  actionEnable: true,
  actionCrudEnable: false,
  actionLabel: 'จัดการ',
  actionWidth: 72,
  addBtnEnable: false,
  viewBtnEnable: false,
  updateBtnEnable: true,
  delBtnEnable: false,
  reloadBtnEnable: true,
  rawdataBtnEnable: false,
  exportBtnEnable: false,
  exportRowBtnEnable: false,
  systemColumn: false,
  indexColumn: false,
  resizable: true,
  enableWs: false,
  buttonsBar: null,
  buttonsRow: [
    {
      prefixIcon: '',
      label: 'กรอกผล',
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
      onClick: [
        "const id = dataRow && (dataRow._id || dataRow.id);",
        "const form = this.getFormRef && this.getFormRef();",
        "if (!id || !form || typeof form.openForm !== 'function') {",
        "  this.notify('ไม่พบรายการผลตรวจที่ต้องการแก้ไข', 'warning', 3000);",
        "  return;",
        "}",
        "form.openForm('6a7aa641935ed08882467374', String(id), null, {}, {",
        "  popupType: 'dialog',",
        "  backdrop: false,",
        "  afterSaveCallback: () => {",
        "    const grid = form.getFieldRef && form.getFieldRef('lab_result_items_grid');",
        "    const editor = grid && grid.getFieldEditor && grid.getFieldEditor();",
        "    if (editor && typeof editor.handleRefresh === 'function') editor.handleRefresh();",
        "    if (typeof form.subFormClose === 'function') form.subFormClose();",
        "  }",
        "});",
      ].join('\n'),
    },
  ],
  parentId: '',
  params: null,
  initData: null,
});

grid.options.onCreated = '';
grid.options.onMounted = '';
grid.options.onUnmount = '';
grid.options.onInsertBefore = '';
grid.options.onUpdateBefore = '';
grid.options.onViewBefore = '';
grid.options.onBeforeSave = '';
grid.options.onAfterDelete = '';
grid.options.allowDeleteFunc = '';
grid.options.allowCloneFunc = '';

model.formConfig.labelPosition = 'top';
model.formConfig.labelWidth = 120;
model.formConfig.cssCode = '';
model.formConfig.customClass = [];
model.formConfig.functions = '';
model.formConfig.onFormCreated = '';
model.formConfig.onParentChange = '';
model.formConfig.onFormDataChange = '';
model.formConfig.onFormUnmounted = '';
model.formConfig.onFormMounted = '';

const expectedNames = [
  'lab_no',
  'patient_hn',
  'patient_name',
  'visit_id',
  'lab_section',
  'specimen',
  'lab_result_items_grid',
];
const actualNames = model.fields.map(field => field.options.name);
const unique = values => new Set(values).size === values.length;
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(JSON.stringify(actualNames) === JSON.stringify(expectedNames), 'Unexpected UI widget order or field set');
assert(unique(actualNames), 'Duplicate widget variable name');
assert(unique(model.fields.map(field => field.id)), 'Duplicate widget id');
assert(!actualNames.includes('order_status_id'), 'Internal order_status_id widget must not exist in UI form');
assert(!actualNames.includes('source_mode'), 'Internal source_mode widget must not exist in UI form');
assert(model.fields.filter(field => field.component === 'text-input').every(field => field.options.hidden === false), 'A visible header field was hidden');
assert(grid.options.formId === '6a7aa641935ed08882467374', 'Grid source form id is incorrect');
assert(grid.options.providerType === 'FORM', 'Grid provider must be FORM');
assert(grid.options.hidden === false, 'Grid must be visible');
assert(grid.options.readonly === false, 'Grid must allow editing');
assert(grid.options.addBtnEnable === false, 'Grid add button must be disabled');
assert(grid.options.delBtnEnable === false, 'Grid delete button must be disabled');
assert(grid.options.updateBtnEnable === true, 'Grid update button must be enabled');
assert(grid.options.actionEnable === true, 'Grid action column must be enabled');
assert(grid.options.where === 'order_status_id = :order_status_id', 'Grid parameterized filter is incorrect');
assert(model.formConfig.onFormMounted === '', 'UI form must not replace the grid filter during mount');
assert(JSON.stringify(grid.options.displayFields) === JSON.stringify([
  'test_name',
  'result_value',
  'unit_symbol_snapshot',
  'reference_range_snapshot',
  'interpretation_code',
  'result_comment',
]), 'Grid must contain only essential result columns');
assert(grid.options.editColumn === null, 'Grid must not depend on imported inline-edit columns');
assert(grid.options.actionCrudEnable === false, 'Built-in View/Edit/Delete actions must be disabled');
assert(Array.isArray(grid.options.buttonsRow) && grid.options.buttonsRow.length === 1, 'Grid must expose one safe result-entry action');
assert(grid.options.buttonsRow[0].label === 'กรอกผล', 'Result-entry action label is incorrect');
assert(grid.options.actionWidth === 72, 'Action column must be compact');
assert(grid.options.indexColumn === false, 'Redundant row index must be hidden');

new Function('formParams', model.formConfig.onFormMounted);
new Function('dataRow', grid.options.buttonsRow[0].onClick);

fs.writeFileSync(outputPath, `${JSON.stringify(model, null, 2)}\n`);
JSON.parse(fs.readFileSync(outputPath, 'utf8'));
console.log(`PASS: ${outputPath}`);
