const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../../..');
const formPath = path.join(root, 'Form-Builder/SDForm/X-ray/xray-member-master-v1.json');
const seedPath = path.join(root, '02-his/data/xray-staff-master-seed-v1.json');

const expectedNames = [
  'prename',
  'first_name',
  'last_name',
  'email',
  'position',
  'position_other',
  'professional_code',
];

const expectedPositions = [
  ['นายแพทย์ชำนาญการ', 'RADIOLOGIST_PRO'],
  ['นายแพทย์ชำนาญการพิเศษ', 'RADIOLOGIST_SENIOR'],
  ['นักรังสีการแพทย์ชำนาญการ', 'RADIOGRAPHER_PRO'],
  ['นักรังสีการแพทย์ปฏิบัติการ', 'RADIOGRAPHER_PRACTICE'],
  ['อื่นๆ (แพทย์ภายนอก)', 'OTHER'],
];

function walk(value, out = []) {
  if (Array.isArray(value)) {
    for (const child of value) walk(child, out);
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  if (value.component) out.push(value);
  for (const child of Object.values(value)) walk(child, out);
  return out;
}

const form = JSON.parse(fs.readFileSync(formPath, 'utf8'));
const fields = walk(form).filter(node => node.formItemFlag === true);
const names = fields.map(node => node.options.name);
assert.deepStrictEqual(names, expectedNames, 'one Member form with exact requested field order');
assert.strictEqual(new Set(names).size, names.length, 'field names must be unique');

const byName = Object.fromEntries(fields.map(node => [node.options.name, node]));
for (const name of ['prename', 'first_name', 'last_name', 'position']) {
  assert.strictEqual(byName[name].options.required, true, `${name} is required`);
}
assert.strictEqual(byName.prename.component, 'select-form-input');
assert.strictEqual(byName.prename.options.formId, '6a3797c94cfbfdbe257f86fd');
assert.strictEqual(byName.prename.options.where, '`enable` = true');
assert.strictEqual(byName.prename.options.valueField, 'prename_code');
assert.deepStrictEqual(byName.prename.options.labelField, ['prename_min_name']);
assert.deepStrictEqual(byName.prename.options.refField, ['prename_full_name']);
assert.strictEqual(byName.prename.options.valueObjectId, false);
assert.strictEqual(byName.email.options.required, false);
assert.deepStrictEqual(byName.email.options.validation, ['email']);
assert.strictEqual(byName.position.component, 'select-input');
assert.deepStrictEqual(
  byName.position.options.optionItems.map(item => [item.label, item.value]),
  expectedPositions,
  'position dropdown must contain the agreed combined choices'
);
assert.match(byName.position.options.onChange, /value === 'OTHER'/);
assert.match(byName.position.options.onChange, /other\.setRequired\(true/);
assert.strictEqual(byName.position_other.options.hidden, true);
assert.strictEqual(byName.position_other.options.required, false);
assert.match(byName.position_other.options.onMounted, /position\.getValue\(\) === 'OTHER'/);
assert.strictEqual(byName.professional_code.options.required, false);

for (const excluded of ['title', 'staff_no', 'member_type', 'user_id', 'ris_uid', 'provider_type']) {
  assert.ok(!names.includes(excluded), `${excluded} is intentionally out of scope`);
}

const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
assert.strictEqual(seed.status, 'seed-only-not-imported');
assert.strictEqual(seed.members.length, 13);
assert.ok(seed.members.every(row => row.first_name && row.last_name && row.position));
assert.ok(seed.members.every(row => row.prename && row.prename.value && row.prename.label));
assert.deepStrictEqual(
  [...new Set(seed.members.map(row => row.prename.value))].sort(),
  ['003', '004', '005', '135'],
  'seed uses verified PRENAME codes'
);
assert.ok(seed.members.every(row => row.position_other === '' && row.professional_code === ''));
assert.strictEqual(seed.members.filter(row => row.position.startsWith('RADIOLOGIST_')).length, 5);
assert.strictEqual(seed.members.filter(row => row.position.startsWith('RADIOGRAPHER_')).length, 8);

const duplicatedEmail = seed.members.filter(
  row => row.email.toLowerCase() === 'staff01@example.invalid'
);
assert.strictEqual(duplicatedEmail.length, 2, 'preserve the source duplicate pending confirmation');
assert.ok(seed.notes.some(note => note.includes('staff01@example.invalid')));

console.log('X-ray Member master form: OK');
