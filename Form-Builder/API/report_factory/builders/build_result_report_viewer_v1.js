const fs = require("fs");

const TEMPLATE_FILE = "TEMPLATE_file_upload_from_builder.json";
const REPORT_FILE = "Result_Report_Manual_Entry_Agent_Result_v1.json";
const OUTPUT_FILE = "Result_Report_Viewer_Agent_Result_v1.json";

const VIEWER_FORM_ID = "6a8d5620f851000f28e50270";
const REPORT_FORM_ID = "6a8d4334f851000f28e5025b";
const ITEM_FORM_ID = "6a8bc91df851000f28e501fb";

const clone = (value) => JSON.parse(JSON.stringify(value));
const template = JSON.parse(fs.readFileSync(TEMPLATE_FILE, "utf8"));
const report = JSON.parse(fs.readFileSync(REPORT_FILE, "utf8"));

function walk(nodes, visitor) {
  for (const node of nodes || []) {
    visitor(node);
    walk(node.cols, visitor);
    walk(node.fields, visitor);
    walk(node.tabs, visitor);
  }
}

function findByComponent(json, component) {
  const found = [];
  walk(json.fields, (node) => {
    if (node.component === component) found.push(node);
  });
  return found;
}

function findByName(json, name) {
  let found = null;
  walk(json.fields, (node) => {
    if (!found && node.options && node.options.name === name) found = node;
  });
  return found;
}

const textTemplate = findByComponent(template, "text-input")[0];
const colTemplate = findByComponent(template, "grid-col")[0];
const gridTemplate = findByComponent(template, "grid")[0];
const uploadTemplate = findByComponent(template, "file-upload-input")[0];
const reportList = findByName(report, "lab_result_items_list");

if (!textTemplate || !colTemplate || !gridTemplate || !uploadTemplate || !reportList) {
  throw new Error("Required exported Builder template component is missing");
}

let serial = 97000;
const next = () => ++serial;

function makeTextCol(name, label, span = 6, maxLength = 500) {
  const col = clone(colTemplate);
  const colNo = next();
  const fieldNo = next();
  col.key = colNo;
  col.id = `grid-col${colNo}`;
  col.options.name = `viewer_${name}_col`;
  col.options.span = span;
  col.options.md = 12;
  col.options.sm = 24;
  col.options.xs = 24;

  const field = clone(textTemplate);
  field.key = fieldNo;
  field.id = `text-input${fieldNo}`;
  field.fieldLength = maxLength;
  field.options.name = name;
  field.options.label = label;
  field.options.defaultValue = "";
  field.options.columnSpan = span;
  field.options.maxLength = maxLength;
  field.options.readonly = true;
  field.options.disabled = false;
  field.options.hidden = false;
  field.options.required = false;
  field.options.clearable = false;
  field.options.placeholder = "";
  col.fields = [field];
  return col;
}

const grid = clone(gridTemplate);
const gridNo = next();
grid.key = gridNo;
grid.id = `grid${gridNo}`;
grid.options.name = "result_report_viewer_root";
grid.options.hidden = false;
grid.cols = [
  makeTextCol("filler_order_no", "LAB NO.", 6, 100),
  makeTextCol("hn", "HN", 6, 100),
  makeTextCol("visit_id", "VN / Visit ID", 6, 100),
  makeTextCol("patient_name", "ชื่อผู้ป่วย", 6, 500),
  makeTextCol("reported_at", "เวลารายงานผล", 6, 100),
  makeTextCol("reported_by_source_name", "ผู้ลงผล", 6, 500),
  makeTextCol("verified_at", "เวลารับรองผล", 6, 100),
  makeTextCol("verified_by_source_name", "ผู้รับรองผล", 6, 500),
];

const listCol = clone(colTemplate);
const listColNo = next();
listCol.key = listColNo;
listCol.id = `grid-col${listColNo}`;
listCol.options.name = "viewer_result_items_col";
listCol.options.span = 24;
listCol.options.md = 24;
listCol.options.sm = 24;
listCol.options.xs = 24;

const list = clone(reportList);
const listNo = next();
list.id = `list-ui${listNo}`;
delete list.key;
list.options.name = "result_report_viewer_items_list";
list.options.formId = ITEM_FORM_ID;
list.options.titleName = "รายการผลตรวจ";
list.options.hidden = false;
list.options.where = "xparentx = CONVERT('000000000000000000000000', 'objectId')";
list.options.onMounted = [
  "const field=this;",
  "let attempt=0;",
  "const idOf=(raw)=>{if(raw&&typeof raw==='object')return String(raw.$oid||raw.value||raw._id||'');return String(raw||'')};",
  "const context=()=>{",
  "  if(typeof formParams!=='undefined'&&formParams)return formParams;",
  "  const form=typeof field.getFormRef==='function'?field.getFormRef():null;",
  "  return form&&form.formParams?form.formParams:{};",
  "};",
  "const readId=()=>{",
  "  const ctx=context();",
  "  if(ctx.result_report_id)return idOf(ctx.result_report_id);",
  "  if(ctx.report_id)return idOf(ctx.report_id);",
  "  if(typeof data!=='undefined'&&data&&data.result_report_id)return idOf(data.result_report_id);",
  "  return '';",
  "};",
  "const apply=()=>{",
  "  attempt+=1;",
  "  const id=readId();",
  "  if(!/^[a-f0-9]{24}$/i.test(id)){if(attempt<20)setTimeout(apply,100);return;}",
  "  const where=\"xparentx = CONVERT('\"+id+\"', 'objectId')\";",
  "  if(typeof field.setFieldOption==='function')field.setFieldOption('where',where);",
  "  const editor=field.getFieldEditor&&field.getFieldEditor();",
  "  if(!editor){if(attempt<20)setTimeout(apply,100);return;}",
  "  editor.dpFormData=editor.dpFormData||{};",
  "  editor.dpFormData.options=editor.dpFormData.options||{};",
  "  editor.defaultWhere=where;",
  "  editor.dpFormData.options.where=where;",
  "  if(typeof editor.handleRefresh==='function')editor.handleRefresh();",
  "};",
  "apply();",
].join("\n");

listCol.fields = [list];
grid.cols.push(listCol);

const upload = clone(uploadTemplate);
const uploadNo = next();
upload.key = uploadNo;
upload.id = `file-upload-input${uploadNo}`;
upload.options.name = "result_attachments";
upload.options.label = "ไฟล์ผลแลป";
upload.options.columnSpan = 24;
upload.options.hidden = false;
upload.options.disabled = false;
upload.options.required = false;
upload.options.uploadTip = "รองรับ PDF, รูปภาพ และเอกสาร สูงสุด 3 ไฟล์ ไฟล์ละไม่เกิน 5 MB";
upload.options.fileTypes = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "txt",
  "zip",
];
upload.options.limit = 3;
upload.options.fileMaxSize = 5;
upload.options.onUploadSuccess = "";
upload.options.onUploadError = "";
upload.options.onFileRemove = "";

const formConfig = clone(template.formConfig);
formConfig.cssCode = [
  ".result-report-viewer-note{color:#909399;font-size:12px}",
  ".result-report-viewer-files{margin-top:14px}",
].join("\n");
formConfig.onFormMounted = [
  "const ctx=(typeof formParams!=='undefined'&&formParams)||(this&&this.formParams)||{};",
  "const form=this;",
  "const set=(name,value)=>{if(value===undefined||value===null)return;if(form&&typeof form.setFieldValue==='function')form.setFieldValue(name,value);};",
  "set('filler_order_no',ctx.filler_order_no||ctx.lab_no);",
  "set('hn',ctx.hn||ctx.patient_hn);",
  "set('visit_id',ctx.visit_id||ctx.vn);",
  "set('patient_name',ctx.patient_name);",
  "set('reported_at',ctx.reported_at);",
  "set('reported_by_source_name',ctx.reported_by_source_name||ctx.reported_by);",
  "set('verified_at',ctx.verified_at);",
  "set('verified_by_source_name',ctx.verified_by_source_name||ctx.verified_by);",
].join("\n");

const output = {
  fields: [grid, upload],
  formConfig,
};

fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`);

console.log(`Wrote ${OUTPUT_FILE}`);
console.log(`Viewer form: ${VIEWER_FORM_ID}`);
console.log(`Report source: ${REPORT_FORM_ID}`);
console.log(`Result item source: ${ITEM_FORM_ID}`);
