const fs = require("fs");
const path = require("path");

const workspace = __dirname;
const personPath = path.join(workspace, "person.json");
const textareaSourcePath = path.join(workspace, "disease.json");
const semanticSourcePath = path.join(
  workspace,
  "Lab_Result_Inbound_Receive_Failed_Preview_2026-08-23.json",
);
const outputPath = path.join(workspace, "Lab_Result_Inbound_Receive.json");

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));

const person = readJson(personPath);
const textareaSource = readJson(textareaSourcePath);
const semanticSource = readJson(semanticSourcePath);

function walkNodes(value, callback) {
  if (Array.isArray(value)) {
    value.forEach((item) => walkNodes(item, callback));
    return;
  }
  if (!value || typeof value !== "object") return;
  if (value.component) callback(value);
  if (value.fields) walkNodes(value.fields, callback);
  if (value.cols) walkNodes(value.cols, callback);
}

function findNode(root, predicate) {
  let result = null;
  walkNodes(root, (node) => {
    if (!result && predicate(node)) result = node;
  });
  if (!result) throw new Error("Required working template was not found");
  return result;
}

const templates = {
  rootGrid: clone(person.fields[0]),
  rootCol: clone(person.fields[0].cols[0]),
  card: clone(findNode(person.fields, (node) => node.component === "card")),
  innerGrid: clone(
    findNode(
      person.fields,
      (node) =>
        node.component === "grid" &&
        node !== person.fields[0] &&
        Array.isArray(node.cols),
    ),
  ),
  innerCol: clone(
    findNode(person.fields, (node) => node.component === "grid-col"),
  ),
  "text-input": clone(
    findNode(
      person.fields,
      (node) =>
        node.component === "text-input" && node.options?.name === "p_ppn",
    ),
  ),
  "select-input": clone(
    findNode(
      person.fields,
      (node) =>
        node.component === "select-input" && node.options?.name === "p_abogroup",
    ),
  ),
  "number-input": clone(
    findNode(
      person.fields,
      (node) =>
        node.component === "number-input" && node.options?.name === "birth_order",
    ),
  ),
  "textarea-input": clone(
    findNode(
      textareaSource.fields,
      (node) => node.component === "textarea-input",
    ),
  ),
};

const semanticByName = new Map();
walkNodes(semanticSource.fields, (node) => {
  if (node.formItemFlag && node.options?.name) {
    semanticByName.set(node.options.name, node);
  }
});

let sequence = 81000;
function nextNumber() {
  sequence += 1;
  return sequence;
}

function assignIdentity(node, component, name) {
  const number = nextNumber();
  if (component === "grid-col") node.id = `grid-col-${number}`;
  else node.id = `${component}${number}`;
  if (node.options) node.options.name = name;
  return node;
}

function stripChildren(node) {
  delete node.fields;
  delete node.cols;
  return node;
}

function makeWidget(fieldName, span) {
  const semantic = semanticByName.get(fieldName);
  if (!semantic) throw new Error(`Missing semantic field: ${fieldName}`);
  const template = templates[semantic.component];
  if (!template) throw new Error(`Missing template: ${semantic.component}`);

  const widget = stripChildren(clone(template));
  const templateOptionKeys = new Set(Object.keys(widget.options || {}));

  for (const [key, value] of Object.entries(semantic.options || {})) {
    if (templateOptionKeys.has(key)) widget.options[key] = clone(value);
  }

  widget.fieldLength = semantic.fieldLength;
  widget.options.name = fieldName;
  widget.options.columnSpan = span;
  widget.options.hidden = false;
  widget.options.labelHidden = false;
  widget.options.customClass = "";

  for (const key of Object.keys(widget.options)) {
    if (/^on[A-Z]/.test(key)) widget.options[key] = "";
  }

  assignIdentity(widget, widget.component, fieldName);
  return widget;
}

function makeCol(fieldName, span, cardIndex, rowIndex, colIndex) {
  const col = stripChildren(clone(templates.innerCol));
  col.fields = [makeWidget(fieldName, span)];
  col.options = {
    ...col.options,
    name: `grid_col_inbound_${cardIndex}_${rowIndex}_${colIndex}`,
    hidden: false,
    span,
    offset: 0,
    push: 0,
    pull: 0,
    responsive: false,
    md: 12,
    sm: 24,
    xs: 24,
    bgColor: null,
    customClass: "",
  };
  assignIdentity(col, "grid-col", col.options.name);
  return col;
}

function makeGrid(row, cardIndex, rowIndex) {
  const grid = stripChildren(clone(templates.innerGrid));
  grid.cols = row.map(([fieldName, span], colIndex) =>
    makeCol(fieldName, span, cardIndex, rowIndex, colIndex + 1),
  );
  grid.options = {
    ...grid.options,
    name: `grid_inbound_${cardIndex}_${rowIndex}`,
    hidden: false,
    gutter: 16,
    colHeight: null,
    customClass: "",
  };
  assignIdentity(grid, "grid", grid.options.name);
  return grid;
}

function makeCard(cardSpec, cardIndex) {
  const card = stripChildren(clone(templates.card));
  card.fields = cardSpec.rows.map((row, rowIndex) =>
    makeGrid(row, cardIndex, rowIndex + 1),
  );
  card.options = {
    ...card.options,
    name: cardSpec.name,
    label: cardSpec.label,
    subLabel: cardSpec.subLabel,
    hidden: false,
    folded: false,
    bgbody: false,
    showFold: false,
    headerDisable: false,
    headerType: null,
    headerEffect: "plain",
    labelColor: null,
    cardWidth: "",
    themes: "wcard-flat",
    shadow: "always",
    customClass: "",
    labelIconText: false,
    labelIconClass: null,
    labelIconPosition: "front",
    labelTooltip: cardSpec.tooltip || null,
  };
  assignIdentity(card, "card", cardSpec.name);
  return card;
}

const cards = [
  {
    name: "inbound_receipt_status_card",
    label: "รับผล Lab จาก Agent",
    subLabel: "Technical receipt: หนึ่ง record ต่อหนึ่ง RESULT_UID (อ่านอย่างเดียว)",
    tooltip: "ฟอร์มนี้รับข้อมูลจาก API/Agent ไม่ใช่หน้ากรอกผล Manual",
    rows: [
      [
        ["receipt_status", 8],
        ["source_channel", 4],
        ["schema_version", 4],
        ["received_at", 8],
      ],
    ],
  },
  {
    name: "inbound_order_match_card",
    label: "ข้อมูลจับคู่ Order",
    subLabel: "ใช้ ORDER_NO + FILLER_ORDER_NO + HN/VISIT เพื่อป้องกันการจับคู่ผิดรายการ",
    rows: [
      [
        ["order_no", 6],
        ["filler_order_no", 6],
        ["hn", 6],
        ["visit_id", 6],
      ],
    ],
  },
  {
    name: "inbound_result_message_card",
    label: "ข้อมูล Result Message",
    subLabel: "เก็บค่าจาก Agent ตาม wire schema โดยไม่เปลี่ยนชนิด sequence เป็น Number",
    rows: [
      [
        ["result_uid", 8],
        ["report_seq", 4],
        ["stage", 4],
        ["agent_overall_status", 8],
      ],
      [
        ["internal_overall_status", 8],
        ["reported_at", 8],
        ["reported_by_source_id", 8],
      ],
      [
        ["reported_by_source_name", 8],
        ["verified_at", 8],
        ["verified_by_source_id", 8],
      ],
      [["verified_by_source_name", 24]],
    ],
  },
  {
    name: "inbound_result_items_card",
    label: "รายการผลที่มากับ Message",
    subLabel: "เก็บ ITEMS[] เป็น JSON snapshot; API ขั้นถัดไปจะแตกแต่ละ OBS_CODE ไปยัง Lab Result Item",
    rows: [
      [
        ["item_count", 6],
        ["critical_count", 6],
        ["matched_item_count", 6],
        ["unmatched_item_count", 6],
      ],
      [["items_json", 24]],
    ],
  },
  {
    name: "inbound_processing_audit_card",
    label: "การประมวลผลและ Audit",
    subLabel: "ข้อมูลภายใน HIS สำหรับ duplicate, matching และตรวจสอบย้อนหลัง",
    rows: [
      [
        ["result_report_id", 12],
        ["processed_at", 12],
      ],
      [["payload_hash", 24]],
      [["error_message", 24]],
      [["raw_payload_json", 24]],
    ],
  },
];

const rootGrid = stripChildren(clone(templates.rootGrid));
const rootCol = stripChildren(clone(templates.rootCol));
rootCol.fields = cards.map((cardSpec, index) => makeCard(cardSpec, index + 1));
rootCol.options = {
  ...rootCol.options,
  name: "grid_col_inbound_root",
  hidden: false,
  span: 24,
  offset: 0,
  push: 0,
  pull: 0,
  responsive: false,
  md: 12,
  sm: 24,
  xs: 24,
  bgColor: null,
  customClass: "",
};
assignIdentity(rootCol, "grid-col", rootCol.options.name);

rootGrid.cols = [rootCol];
rootGrid.options = {
  ...rootGrid.options,
  name: "lab_result_inbound_receive_root",
  hidden: false,
  gutter: 16,
  colHeight: null,
  customClass: "",
};
assignIdentity(rootGrid, "grid", rootGrid.options.name);

const formConfig = clone(person.formConfig);
Object.assign(formConfig, {
  modelName: "formData",
  refName: "sdForm",
  rulesName: "rules",
  labelWidth: 120,
  labelPosition: "top",
  size: "",
  labelAlign: "label-right-align",
  cssCode: "",
  customClass: [],
  functions: "",
  layoutType: "PC",
  jsonVersion: 3,
  onFormCreated: "",
  onFormMounted: "",
  onParentChange: "",
  onFormDataChange: "",
  onFormUnmounted: "",
});

const output = {
  fields: [rootGrid],
  formConfig,
};

fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Built ${path.basename(outputPath)} from working exported templates.`);
console.log(`Fields: ${semanticByName.size}; cards: ${cards.length}.`);

