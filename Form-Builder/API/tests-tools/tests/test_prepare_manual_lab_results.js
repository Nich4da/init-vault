const assert = require('assert');
const fs = require('fs');
const path = require('path');

const apiBody = fs.readFileSync(
  path.join(__dirname, 'prepare_manual_lab_results_api.js'),
  'utf8'
);
const buttonBody = fs.readFileSync(
  path.join(__dirname, 'open_manual_lab_results_button_template.js'),
  'utf8'
);

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const Process = new AsyncFunction('params', 'userInfo', 'app', apiBody);
new Function('s', 'field', buttonBody);

const statusRow = {
  _id: '6a852797f851000f28e44a3e',
  order_number: '1069000024',
  section_code: '10',
  section_name: 'Biochemistry',
  patient_hn: 'HN-TEST',
  patient_name: 'Test Patient',
  visit_id: '6a8525ecf851000f28e44a39',
  visit_vn: '6900175',
  work_status: 'processing',
  selected_items: JSON.stringify([
    {
      id: 'lab-10-item-a',
      master_id: 'item-a',
      item_code: 'C71',
      name: 'Ferritin',
      c_specimen: { specimen_code: 'CD', label: 'Clotted blood' },
    },
    {
      id: 'lab-10-item-b',
      master_id: 'item-b',
      item_code: 'C85',
      name: 'Serum Iron',
      c_specimen: { specimen_code: 'CD', label: 'Clotted blood' },
    },
  ]),
  specimens: JSON.stringify([
    { specimen_code: 'CD', label: 'Clotted blood' },
  ]),
  xrstatx: 1,
};

const stored = [];
const drafts = new Map();
let idCounter = 0;
const mockApp = {
  isAuth: () => true,
  dbObjectId: value => value,
  dbFindById: async () => ({ success: true, reply: { data: statusRow } }),
  sdformGetAll: async () => ({ success: true, data: stored.slice() }),
  insertData: async formId => {
    assert.strictEqual(formId, '6a7aa641935ed08882467374');
    const id = `draft-${++idCounter}`;
    drafts.set(id, { _id: id, xrstatx: 0 });
    return { success: true, id };
  },
  sdformSetOne: async (formId, dataId, data) => {
    assert.strictEqual(formId, '6a7aa641935ed08882467374');
    assert.ok(drafts.has(dataId));
    const row = { ...data, _id: dataId, xrstatx: 1 };
    drafts.delete(dataId);
    stored.push(row);
    return { success: true, id: row._id, data: row };
  },
};

(async () => {
  const userInfo = { roles: ['auth'], username: 'tester' };
  const params = { status_record_id: '6a852797f851000f28e44a3e' };

  const first = await Process(params, userInfo, mockApp);
  assert.strictEqual(first.success, true);
  assert.strictEqual(first.data.created_count, 2);
  assert.strictEqual(first.data.existing_count, 0);
  assert.strictEqual(stored.length, 2);
  assert.strictEqual(stored[0].order_status_id, params.status_record_id);
  assert.strictEqual(stored[0].test_code, 'C71');
  assert.strictEqual(stored[0].result_status, 'pending');
  assert.strictEqual(stored[0].result_source, 'manual');
  assert.strictEqual(stored[0].interpretation_code, 'N');
  assert.strictEqual(drafts.size, 0);

  const second = await Process(params, userInfo, mockApp);
  assert.strictEqual(second.success, true);
  assert.strictEqual(second.data.created_count, 0);
  assert.strictEqual(second.data.existing_count, 2);
  assert.strictEqual(stored.length, 2);

  const invalid = await Process({ status_record_id: 'bad-id' }, userInfo, mockApp);
  assert.strictEqual(invalid.success, false);

  console.log('PASS: API body syntax');
  console.log('PASS: button handler syntax');
  console.log('PASS: first prepare creates drafts then saves missing rows');
  console.log('PASS: second prepare creates no duplicates');
  console.log('PASS: invalid status id is rejected');
})();
