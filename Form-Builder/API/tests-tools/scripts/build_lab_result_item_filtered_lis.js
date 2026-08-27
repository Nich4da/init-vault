const fs = require('fs');
const path = require('path');

const sourcePath = '/Users/nichada/Documents/lab-result-item.json';
const outputPath = path.join(__dirname, 'Lab_Result_Item_Filtered_LIS_Validated.json');

const model = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

const clone = value => JSON.parse(JSON.stringify(value));

function findField(fields, name) {
  for (const field of fields || []) {
    if (field && field.options && field.options.name === name) return field;
    const nested = findField(field && field.fields, name);
    if (nested) return nested;
  }
  return null;
}

const card = model.fields.find(field => field && field.name === 'Card');
if (!card || !Array.isArray(card.fields)) throw new Error('Working Card schema was not found');

const textTemplate = findField(model.fields, 'test_code');
const textareaTemplate = findField(model.fields, 'result_comment');
const interpretationTemplate = findField(model.fields, 'interpretation_code');
if (!textTemplate || !textareaTemplate || !interpretationTemplate) {
  throw new Error('Required source widget templates were not found');
}

function makeHiddenText(name, label, suffix, defaultValue = '') {
  const field = clone(textTemplate);
  field.id = `text-input-lab-result-item-lis-${suffix}`;
  field.options.name = name;
  field.options.label = label;
  field.options.defaultValue = defaultValue;
  field.options.placeholder = '';
  field.options.hidden = true;
  field.options.readonly = false;
  field.options.disabled = false;
  field.options.required = false;
  field.options.requiredHint = '';
  field.options.columnSpan = 24;
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

const byName = name => findField(model.fields, name);

const testName = clone(byName('test_name'));
testName.options.columnSpan = 24;
testName.options.readonly = true;
testName.options.hidden = false;

const resultValue = clone(byName('result_value'));
resultValue.options.columnSpan = 12;
resultValue.options.hidden = false;
resultValue.options.placeholder = 'กรอกผลตรวจ หรือเว้นว่างหากผลยังไม่ออก';
resultValue.options.onChange = [
  "const raw = this.getValue();",
  "const hasValue = raw !== null && raw !== undefined && String(raw).trim() !== '';",
  "const statusField = this.refField('result_status');",
  "if (statusField) statusField.setValue(hasValue ? 'entered' : 'pending');"
].join('\n');

const unitId = clone(byName('unit_id'));
unitId.options.columnSpan = 12;
unitId.options.hidden = false;
unitId.options.onChange = [
  "const snapshotField = this.refField('unit_symbol_snapshot');",
  "if (snapshotField) snapshotField.setValue(this.getSelectedLabel() || '');"
].join('\n');

const referenceRange = clone(byName('reference_range_snapshot'));
referenceRange.options.columnSpan = 12;
referenceRange.options.readonly = true;
referenceRange.options.hidden = false;

const interpretation = clone(interpretationTemplate);
interpretation.id = 'select-input-lab-result-item-lis-critical-status';
interpretation.options.name = 'interpretation_code';
interpretation.options.label = 'สถานะค่าวิกฤต';
interpretation.options.defaultValue = 'N';
interpretation.options.placeholder = 'เลือกสถานะค่าวิกฤต';
interpretation.options.columnSpan = 12;
interpretation.options.hidden = false;
interpretation.options.disabled = false;
interpretation.options.clearable = false;
interpretation.options.optionItems = [
  { label: 'ไม่พบค่าวิกฤต', value: 'N' },
  { label: 'ค่าวิกฤตต่ำ', value: 'LL' },
  { label: 'ค่าวิกฤตสูง', value: 'HH' },
  { label: 'ค่าวิกฤตอื่น', value: 'AA' }
];
interpretation.options.onChange = [
  "const code = String(this.getValue() || 'N').toUpperCase();",
  "const criticalField = this.refField('is_critical');",
  "if (criticalField) criticalField.setValue(['LL', 'HH', 'AA'].includes(code));"
].join('\n');

const criticalComment = clone(textareaTemplate);
criticalComment.id = 'textarea-input-lab-result-item-lis-critical-comment';
criticalComment.options.name = 'critical_comment';
criticalComment.options.label = 'หมายเหตุค่าวิกฤต';
criticalComment.options.defaultValue = '';
criticalComment.options.placeholder = 'รายละเอียดค่าวิกฤตหรือการแจ้งผู้เกี่ยวข้อง';
criticalComment.options.columnSpan = 12;
criticalComment.options.hidden = false;
criticalComment.options.required = false;

const resultComment = clone(textareaTemplate);
resultComment.options.columnSpan = 12;
resultComment.options.hidden = false;

card.options.hidden = false;
card.fields = [
  testName,
  resultValue,
  unitId,
  referenceRange,
  interpretation,
  criticalComment,
  resultComment
];

const resultSequence = clone(byName('result_sequence'));
resultSequence.options.hidden = true;

const testCode = clone(byName('test_code'));
testCode.options.hidden = true;

const obsCode = clone(byName('obs_code'));
obsCode.options.hidden = true;

const unitSnapshot = clone(byName('unit_symbol_snapshot'));
unitSnapshot.options.hidden = true;

const resultSource = clone(byName('result_source'));
resultSource.options.hidden = true;
resultSource.options.defaultValue = 'manual';

const resultStatus = clone(byName('result_status'));
resultStatus.options.hidden = true;
resultStatus.options.defaultValue = 'pending';

const isCritical = clone(byName('is_critical'));
isCritical.options.hidden = true;
isCritical.options.defaultValue = false;

model.fields = [
  card,
  makeHiddenText('order_status_id', 'Lab Status ID', '01'),
  makeHiddenText('lab_no', 'LAB NO.', '02'),
  makeHiddenText('lab_section', 'ห้อง Lab / Section', '03'),
  makeHiddenText('source_item_id', 'Source CPOE Item ID', '04'),
  makeHiddenText('specimen_code', 'Specimen Code', '05'),
  resultSequence,
  testCode,
  obsCode,
  unitSnapshot,
  resultSource,
  resultStatus,
  makeHiddenText('critical_low_rule', 'Critical Low Rule', '06'),
  makeHiddenText('critical_high_rule', 'Critical High Rule', '07'),
  isCritical,
  makeHiddenText('result_uid', 'LIS Result UID', '08'),
  makeHiddenText('receipt_seq', 'LIS Receipt Sequence', '09'),
  makeHiddenText('result_version', 'LIS Result Version', '10'),
  makeHiddenText('change_kind', 'LIS Change Kind', '11'),
  makeHiddenText('obx_status', 'LIS OBX Status', '12')
];

model.formConfig.onFormCreated = '';
model.formConfig.onFormMounted = '';
model.formConfig.onParentChange = '';
model.formConfig.onFormDataChange = '';
model.formConfig.onFormUnmounted = '';

fs.writeFileSync(outputPath, `${JSON.stringify(model, null, 2)}\n`);
console.log(outputPath);
