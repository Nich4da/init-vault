const assert = require("assert");
const fs = require("fs");
const path = require("path");

const workspace = __dirname;
const outputPath = path.join(workspace, "Lab_Result_Inbound_Receive.json");
const personPath = path.join(workspace, "person.json");
const textareaSourcePath = path.join(workspace, "disease.json");
const resultSchemaPath = path.join(
  workspace,
  "schemas",
  "agent-to-his-result.schema.json",
);

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const output = readJson(outputPath);
const person = readJson(personPath);
const textareaSource = readJson(textareaSourcePath);
const resultSchema = readJson(resultSchemaPath);

function walkNodes(value, callback, pathName = "fields") {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      walkNodes(item, callback, `${pathName}[${index}]`),
    );
    return;
  }
  if (!value || typeof value !== "object") return;
  if (value.component) callback(value, pathName);
  if (value.fields) walkNodes(value.fields, callback, `${pathName}.fields`);
  if (value.cols) walkNodes(value.cols, callback, `${pathName}.cols`);
}

function findNode(root, predicate) {
  let result = null;
  walkNodes(root, (node) => {
    if (!result && predicate(node)) result = node;
  });
  assert(result, "Required template must exist");
  return result;
}

const templates = {
  grid: person.fields[0],
  "grid-col": person.fields[0].cols[0],
  card: findNode(person.fields, (node) => node.component === "card"),
  "text-input": findNode(
    person.fields,
    (node) => node.component === "text-input" && node.options?.name === "p_ppn",
  ),
  "select-input": findNode(
    person.fields,
    (node) =>
      node.component === "select-input" && node.options?.name === "p_abogroup",
  ),
  "number-input": findNode(
    person.fields,
    (node) =>
      node.component === "number-input" && node.options?.name === "birth_order",
  ),
  "textarea-input": findNode(
    textareaSource.fields,
    (node) => node.component === "textarea-input",
  ),
};

const nodes = [];
walkNodes(output.fields, (node, nodePath) => nodes.push({ node, nodePath }));
const widgets = nodes.filter(({ node }) => node.formItemFlag);
const cards = nodes.filter(({ node }) => node.component === "card");
const grids = nodes.filter(({ node }) => node.component === "grid");
const cols = nodes.filter(({ node }) => node.component === "grid-col");

assert.strictEqual(output.formConfig.jsonVersion, 3);
assert.strictEqual(output.formConfig.modelName, "formData");
assert.strictEqual(output.formConfig.refName, "sdForm");
assert.strictEqual(output.formConfig.rulesName, "rules");
assert.strictEqual(output.fields.length, 1);
assert.strictEqual(output.fields[0].component, "grid");
assert.strictEqual(output.fields[0].cols.length, 1);
assert.strictEqual(output.fields[0].cols[0].component, "grid-col");
assert.strictEqual(cards.length, 5);
assert.strictEqual(widgets.length, 29);

const ids = nodes.map(({ node }) => node.id);
assert(ids.every(Boolean), "Every node must have an id");
assert.strictEqual(new Set(ids).size, ids.length, "Every id must be unique");

const fieldNames = widgets.map(({ node }) => node.options.name);
assert.strictEqual(
  new Set(fieldNames).size,
  fieldNames.length,
  "Every field options.name must be unique",
);

for (const { node, nodePath } of widgets) {
  const template = templates[node.component];
  assert(template, `Known working template required for ${node.component}`);
  assert.strictEqual(
    node.key,
    template.key,
    `${nodePath} must retain the exported component key`,
  );
  for (const optionKey of Object.keys(template.options)) {
    assert(
      Object.prototype.hasOwnProperty.call(node.options, optionKey),
      `${node.options.name} missing template option ${optionKey}`,
    );
  }
  assert.strictEqual(node.options.hidden, false, `${node.options.name} hidden`);
  assert.strictEqual(
    node.options.labelHidden,
    false,
    `${node.options.name} label hidden`,
  );
  for (const [optionKey, optionValue] of Object.entries(node.options)) {
    if (/^on[A-Z]/.test(optionKey)) {
      assert.strictEqual(
        optionValue,
        "",
        `${node.options.name}.${optionKey} must be inert`,
      );
    }
  }
}

for (const { node, nodePath } of cards) {
  assert.strictEqual(node.key, templates.card.key, `${nodePath} card key`);
  assert.strictEqual(node.options.hidden, false);
  assert.strictEqual(node.options.folded, false);
  assert.strictEqual(typeof node.options.bgbody, "boolean");
  assert(Array.isArray(node.fields) && node.fields.length > 0);
  assert(node.fields.every((child) => child.component === "grid"));
}

for (const { node, nodePath } of grids) {
  assert(Array.isArray(node.cols) && node.cols.length > 0, `${nodePath} empty grid`);
  assert(node.cols.every((child) => child.component === "grid-col"));
  if (node !== output.fields[0]) {
    const spanTotal = node.cols.reduce((sum, col) => sum + col.options.span, 0);
    assert.strictEqual(spanTotal, 24, `${nodePath} spans must total 24`);
  }
}

for (const { node, nodePath } of cols) {
  assert(Array.isArray(node.fields) && node.fields.length > 0, `${nodePath} empty col`);
  assert.strictEqual(typeof node.options.responsive, "boolean");
}

const byName = new Map(widgets.map(({ node }) => [node.options.name, node]));
for (const requiredName of [
  "result_uid",
  "order_no",
  "filler_order_no",
  "hn",
  "visit_id",
]) {
  assert.strictEqual(byName.get(requiredName).options.required, true, requiredName);
}
assert.strictEqual(byName.get("report_seq").component, "text-input");
assert.strictEqual(byName.get("report_seq").fieldType, "String");
assert.strictEqual(byName.get("items_json").component, "textarea-input");
assert.strictEqual(byName.get("items_json").options.readonly, true);

const schemaToFormField = {
  order_no: "order_no",
  filler_order_no: "filler_order_no",
  hn: "hn",
  visit_id: "visit_id",
  result_uid: "result_uid",
  report_seq: "report_seq",
  stage: "stage",
  overall_status: "agent_overall_status",
  reported_at: "reported_at",
  items: "items_json",
};
for (const requiredProperty of resultSchema.required) {
  if (["reported_by", "items"].includes(requiredProperty)) continue;
  const formFieldName = schemaToFormField[requiredProperty];
  assert(formFieldName, `No form mapping for required ${requiredProperty}`);
  assert.strictEqual(
    byName.get(formFieldName).options.required,
    true,
    `${formFieldName} must represent required wire property ${requiredProperty}`,
  );
}
for (const [schemaName, formFieldName] of Object.entries(schemaToFormField)) {
  const property = resultSchema.properties[schemaName];
  if (!property || property.type !== "string" || !property.maxLength) continue;
  assert.strictEqual(
    byName.get(formFieldName).options.maxLength,
    property.maxLength,
    `${formFieldName} maxLength must match the wire schema`,
  );
}
assert.strictEqual(byName.get("reported_by_source_id").options.required, true);
assert.strictEqual(byName.get("reported_by_source_name").options.required, true);

const initialModel = Object.fromEntries(
  widgets.map(({ node }) => [node.options.name, node.options.defaultValue]),
);
assert.strictEqual(Object.keys(initialModel).length, 29);
assert.strictEqual(initialModel.receipt_status, "received");
assert.strictEqual(initialModel.source_channel, "agent");
assert.strictEqual(initialModel.schema_version, "his-agent-result-v1");
assert.strictEqual(initialModel.internal_overall_status, "processing");
assert.strictEqual(initialModel.items_json, "[]");
assert.strictEqual(initialModel.raw_payload_json, "{}");

console.log("PASS JSON syntax/parse");
console.log("PASS exported-template component keys and full option schemas");
console.log("PASS Layout -> Grid Col -> Card -> Layout -> Grid Col -> Widget hierarchy");
console.log("PASS 29 visible widgets, unique ids/names, non-empty containers");
console.log("PASS wire types, required matching keys, defaults, and inert events");
console.log("PASS required/maxLength mapping against agent-to-his-result schema");
console.log("NOTE live initCraft Builder/Preview verification is still required");
