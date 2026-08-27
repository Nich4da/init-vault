const fs = require('fs');
const path = require('path');

const sourcePath = path.join(
  __dirname,
  'lab-ห้องปฏิบัติการ_listview-compact-columns_2026-08-18.json'
);
const handlerPath = path.join(
  __dirname,
  'open_manual_lab_results_button_template.js'
);
const outputPath = path.join(
  __dirname,
  'lab-ห้องปฏิบัติการ_manual-result-button_2026-08-19.json'
);

const placeholder = "s.viewResult=row=>{field.notify('ปุ่มดูผลพร้อมแล้ว — จะเชื่อมฟอร์ม Manual ในขั้นตอนถัดไป','info',3000)};";
const sourceText = fs.readFileSync(sourcePath, 'utf8');
const handler = fs.readFileSync(handlerPath, 'utf8').trim();

const occurrenceCount = sourceText.split(placeholder).length - 1;
if (occurrenceCount !== 1) {
  throw new Error(`Expected exactly one viewResult placeholder, found ${occurrenceCount}`);
}

if (!handler.includes("const PREPARE_MANUAL_RESULT_PROCESS_ID = '6a852b0cf851000f28e44a46'")) {
  throw new Error('Prepare API id is missing from handler');
}
if (!handler.includes("const RESULT_REPORT_MANUAL_UI_FORM_ID = '6a852aa3f851000f28e44a44'")) {
  throw new Error('Result Report UI form id is missing from handler');
}

// Escape the handler exactly as JSON string content. This preserves every
// other byte in the source JSON instead of parsing and reformatting the file.
const escapedHandler = JSON.stringify(handler).slice(1, -1);
const outputText = sourceText.replace(placeholder, escapedHandler);

if (outputText === sourceText) {
  throw new Error('No replacement was made');
}
if (outputText !== sourceText.replace(placeholder, escapedHandler)) {
  throw new Error('Output contains changes outside the requested replacement');
}

fs.writeFileSync(outputPath, outputText);

const writtenText = fs.readFileSync(outputPath, 'utf8');
if (writtenText !== outputText) {
  throw new Error('Written file differs from validated output');
}

const model = JSON.parse(writtenText);
let target = null;

const walk = nodes => {
  for (const node of nodes || []) {
    if (node && node.options && node.options.name === 'lab_resulted_component') {
      target = node;
    }
    walk(node && node.fields);
    for (const col of (node && node.cols) || []) walk(col.fields);
    for (const tab of (node && node.tabs) || []) walk(tab.fields);
  }
};
walk(model.fields);

if (!target || target.component !== 'vue-ui') {
  throw new Error('lab_resulted_component was not found');
}

const onCreated = String(target.options.onCreated || '');
if (onCreated.includes('ปุ่มดูผลพร้อมแล้ว — จะเชื่อมฟอร์ม Manual ในขั้นตอนถัดไป')) {
  throw new Error('Old placeholder is still present');
}
if (!onCreated.includes('6a852b0cf851000f28e44a46')) {
  throw new Error('Prepare API id is not present in target onCreated');
}
if (!onCreated.includes('6a852aa3f851000f28e44a44')) {
  throw new Error('Result Report UI form id is not present in target onCreated');
}

new Function('userInfo', onCreated);

console.log(`PASS: ${outputPath}`);
console.log('PASS: exactly one placeholder replaced');
console.log('PASS: all other source bytes preserved');
console.log('PASS: JSON syntax');
console.log('PASS: lab_resulted_component onCreated syntax');
