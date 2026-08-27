const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync(
  'open_manual_lab_results_button_template.js',
  'utf8'
);

let processCall = null;
let openCall = null;
const form = {
  userState: {
    runProcess(processId, params, onSuccess) {
      processCall = { processId, params };
      onSuccess({
        data: {
          success: true,
          data: {
            order_status_id: params.status_record_id,
            lab_no: 'LAB-TEST',
            patient_hn: 'HN-TEST',
            patient_name: 'Test Patient',
            visit_id: 'VN-TEST',
            lab_section: 'Biochemistry',
            specimen: 'Clotted blood',
          },
        },
      });
    },
  },
  openForm(formId, dataId, parentId, initData, options) {
    openCall = { formId, dataId, parentId, initData, options };
  },
};

const notices = [];
const field = {
  getFormRef: () => form,
  globalUserState: form.userState,
  notify: (...args) => notices.push(args),
};
const s = {
  text: value => value == null ? '' : String(value),
  specimens: () => 'Fallback specimen',
};

new Function('s', 'field', source)(s, field);
s.viewResult({
  _id: '6a852797f851000f28e44a3e',
  order_number: 'LAB-FALLBACK',
});

assert.deepStrictEqual(processCall, {
  processId: '6a852b0cf851000f28e44a46',
  params: { status_record_id: '6a852797f851000f28e44a3e' },
});
assert.strictEqual(openCall.formId, '6a852aa3f851000f28e44a44');
assert.strictEqual(openCall.dataId, null);
assert.strictEqual(openCall.parentId, null);
assert.strictEqual(
  openCall.initData.order_status_id,
  '6a852797f851000f28e44a3e'
);
assert.strictEqual(openCall.initData.lab_no, 'LAB-TEST');
assert.strictEqual(openCall.options.popupType, 'dialog');
assert.strictEqual(openCall.options.backdrop, false);
assert.strictEqual(
  openCall.options.params.order_status_id,
  '6a852797f851000f28e44a3e'
);
assert.strictEqual(openCall.options.params.lab_no, 'LAB-TEST');
assert.strictEqual(notices.length, 0);

console.log('PASS: prepare API id');
console.log('PASS: Result Report UI form id');
console.log('PASS: status id forwarded to API, initData, and formParams');
console.log('PASS: openForm dialog options');
