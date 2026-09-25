/*
 * Local, no-network regression suite for the HIS HL7/LIS result receiver.
 * Run from any directory:
 *   node Form-Builder/API/tests-tools/scripts/run_hl7_result_suite.js
 */
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.resolve(__dirname, '../../../..')
const nodeTests = [
  'Form-Builder/API/tests-tools/tests/test_hl7_result_upsert_api.js',
  'Form-Builder/API/tests-tools/tests/test_agent_result_forms_v1.js',
  'Form-Builder/API/tests-tools/tests/test_lab_cpoe_worklist_api.js',
  'Form-Builder/API/tests-tools/tests/test_lab_cpoe_worklist_form.js',
  'Form-Builder/API/tests-tools/tests/test_lab_result_inbound_receive.js',
  'Form-Builder/API/tests-tools/tests/test_lab_result_inbound_listview_emr_person.js',
  'Form-Builder/API/tests-tools/tests/test_lab_result_output_tab.js',
]
const formFiles = [
  'Form-Builder/SDForm/form-factory/forms/Lab_Result_Inbound_Receive_Agent_Result_v1.json',
  'Form-Builder/SDForm/form-factory/forms/Result_Report_Manual_Entry_Agent_Result_v1.json',
  'Form-Builder/SDForm/form-factory/forms/Lab_Result_Item_Agent_Result_v1.json',
]
const validator = 'Form-Builder/seed/tests-tools/validators/check_sdform_json.py'

const run = (command, args) => {
  console.log('\n$ ' + [command, ...args].join(' '))
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}

for (const file of nodeTests) run(process.execPath, [file])
for (const file of formFiles) run(process.env.PYTHON || 'python3', [validator, file])

console.log('\nPASS: HL7 result receiver suite completed without network or HIS writes')
