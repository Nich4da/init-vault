const assert = require("assert");
const fs = require("fs");
const path = require("path");

const VIEWER = "Result_Report_Viewer_Agent_Result_v1.json";
const TEMPLATE = "TEMPLATE_file_upload_from_builder.json";
const ITEM_FORM_ID = "6a8bc91df851000f28e501fb";
const FORM_DIR = path.join(__dirname, "../../../SDForm/form-factory/forms");

const viewer = JSON.parse(fs.readFileSync(path.join(FORM_DIR, VIEWER), "utf8"));
const template = JSON.parse(fs.readFileSync(path.join(FORM_DIR, TEMPLATE), "utf8"));

function walk(nodes, visitor, path = "fields") {
  (nodes || []).forEach((node, index) => {
    const here = `${path}[${index}]`;
    visitor(node, here);
    walk(node.cols, visitor, `${here}.cols`);
    walk(node.fields, visitor, `${here}.fields`);
    walk(node.tabs, visitor, `${here}.tabs`);
  });
}

const nodes = [];
walk(viewer.fields, (node, path) => nodes.push({ node, path }));

const ids = nodes.map(({ node }) => node.id).filter(Boolean);
assert.strictEqual(new Set(ids).size, ids.length, "widget/container ids must be unique");

const names = nodes
  .map(({ node }) => node.options && node.options.name)
  .filter(Boolean);
assert.strictEqual(new Set(names).size, names.length, "options.name must be unique");

assert.strictEqual(viewer.fields[0].component, "grid");
assert.strictEqual(viewer.fields[1].component, "file-upload-input");

const templateGrid = template.fields.find((node) => node.component === "grid");
const templateUpload = template.fields.find(
  (node) => node.component === "file-upload-input",
);
assert(templateGrid && templateUpload, "exported Builder template must contain grid and upload");
assert.deepStrictEqual(
  Object.keys(viewer.fields[0].options).sort(),
  Object.keys(templateGrid.options).sort(),
  "root grid option axis must match exported Builder template",
);
assert.deepStrictEqual(
  Object.keys(viewer.fields[1].options).sort(),
  Object.keys(templateUpload.options).sort(),
  "upload option axis must match exported Builder template",
);

const listEntry = nodes.find(({ node }) => node.component === "list-ui");
assert(listEntry, "viewer must contain list-ui");
assert(listEntry.path.includes(".cols") && listEntry.path.includes(".fields"));
assert.strictEqual(listEntry.node.key, undefined, "list-ui template is keyless");
assert.strictEqual(listEntry.node.options.hidden, false);
assert.strictEqual(listEntry.node.options.formId, ITEM_FORM_ID);
assert.strictEqual(listEntry.node.options.listColumn, 1);
assert(listEntry.node.options.where.includes("000000000000000000000000"));
assert(listEntry.node.options.onMounted.includes("formParams"));
assert(listEntry.node.options.onMounted.includes("result_report_id"));
assert(!listEntry.node.options.onMounted.includes("getFieldValue"));

const requiredHeaders = [
  "filler_order_no",
  "hn",
  "visit_id",
  "patient_name",
  "reported_at",
  "reported_by_source_name",
  "verified_at",
  "verified_by_source_name",
];
for (const name of requiredHeaders) {
  const entry = nodes.find(({ node }) => node.options && node.options.name === name);
  assert(entry, `missing visible header field ${name}`);
  assert.strictEqual(entry.node.options.hidden, false);
  assert.strictEqual(entry.node.options.readonly, true);
}

const upload = viewer.fields[1];
assert.strictEqual(upload.options.name, "result_attachments");
assert.strictEqual(upload.options.hidden, false);
assert(upload.options.fileTypes.includes("pdf"));
assert(upload.options.fileTypes.includes("jpg"));
assert.strictEqual(upload.options.limit, 3);
assert.strictEqual(upload.options.fileMaxSize, 5);

for (const { node, path } of nodes) {
  if (node.component === "grid-col") {
    assert(Array.isArray(node.fields), `${path} must use .fields`);
    assert.strictEqual(node.widgetList, undefined, `${path} must not use .widgetList`);
  }
  if (node.options && Object.prototype.hasOwnProperty.call(node.options, "hidden")) {
    assert.strictEqual(node.options.hidden, false, `${path} must not be hidden`);
  }
}

for (const { node, path } of nodes) {
  const scripts = [];
  if (node.options) {
    for (const [key, value] of Object.entries(node.options)) {
      if (/^on[A-Z]/.test(key) && typeof value === "string" && value.trim()) {
        scripts.push([key, value]);
      }
    }
  }
  for (const [key, code] of scripts) {
    assert.doesNotThrow(
      () => new Function("formParams", "data", "dataRow", code),
      `${path}.options.${key} must have valid JavaScript syntax`,
    );
  }
}

assert.doesNotThrow(
  () => new Function("formParams", viewer.formConfig.onFormMounted),
  "formConfig.onFormMounted must have valid JavaScript syntax",
);

console.log("PASS: viewer keeps exported Builder grid/upload container axis");
console.log("PASS: list-ui is visible, keyless, nested in grid-col.fields, and points to Lab_Result_Item");
console.log("PASS: report context uses formParams.result_report_id without getFieldValue crash path");
console.log("PASS: all header fields and result_attachments upload are visible");
console.log("PASS: IDs/names are unique and event scripts parse");
