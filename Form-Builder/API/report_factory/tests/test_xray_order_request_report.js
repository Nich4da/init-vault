const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../../..");
const builder = require("../builders/build_xray_order_request_report");
const WORKLIST_API = path.join(
  ROOT,
  "Form-Builder/API/api-factory/processes/xray_cpoe_worklist_api.js",
);
const CPOE_ORDER_FORM = path.join(
  ROOT,
  "Form-Builder/SDForm/sdform_module/EMR_form/CPOE Order.json",
);

const DUMMY_SQL_ID = "111111111111111111111111";
const DUMMY_REPORT_ID = "222222222222222222222222";
const LIVE_CLONE_SQL_ID = "6a97f46b422c1ca95982a03e";
const LIVE_CLONE_REPORT_ID = "6a97f826422c1ca95982a048";
const requiredParams = ["order_id", "visit_id", "printed_by", "printed_at"];

const readOne = (filename) => {
  const data = JSON.parse(fs.readFileSync(filename, "utf8"));
  assert(Array.isArray(data), `${path.basename(filename)} must be an export array`);
  assert.strictEqual(data.length, 1, `${path.basename(filename)} must contain exactly one record`);
  return data[0];
};

const sql = builder.buildSqlRecord();
const report = builder.buildReportRecord(DUMMY_SQL_ID);

assert.deepStrictEqual(sql, builder.buildSqlRecord());
assert(sql.created_by && sql.created_by.id && sql.created_by.id.$oid, "SQL backup needs real export metadata");
assert(sql.updated_by && sql.updated_by.id && sql.updated_by.id.$oid, "SQL backup needs real export metadata");
assert(report.created_by && report.created_by.id && report.created_by.id.$oid, "Report backup needs real export metadata");
assert(report.updated_by && report.updated_by.id && report.updated_by.id.$oid, "Report backup needs real export metadata");
assert.strictEqual(report.pdf_sql.value.$oid, DUMMY_SQL_ID);
assert.strictEqual(builder.buildReportRecord().pdf_sql.value.$oid, builder.XRAY_SQL_ID);
assert.strictEqual(sql._id.$oid, builder.XRAY_SQL_ID);
assert.strictEqual(sql.dataid, builder.XRAY_SQL_ID);
assert.strictEqual(report._id.$oid, builder.XRAY_REPORT_ID);
assert.strictEqual(sql.sql_share, "public");
assert.strictEqual(report.pdf_share, "private");
assert.strictEqual(sql.sql_type, "nosql");
assert.strictEqual(sql.nosql_type, "aggregate");
assert.strictEqual(report.pdf_type, "report");
assert.strictEqual(sql.sql_name, "X-ray Order Request PDF v1");
assert.strictEqual(report.pdf_name, "X-ray Order Request v1");
assert.strictEqual(report.pdf_sql.label, sql.sql_name);

// Report param_var must equal SQL pname or the provider silently returns 0 rows.
assert.deepStrictEqual(sql.sql_options.param.map((row) => row.pname), requiredParams);
assert(sql.sql_options.param.every((row) => row.ptype === "text"));
assert.deepStrictEqual(report.pdf_params.map((row) => row.param_var), requiredParams);
assert(report.pdf_params.every((row) => row.param_required === true));
// X-ray is not subdivided by zdata_section the way LAB is (xray_cpoe_worklist_api.js).
assert(!requiredParams.includes("section_code"), "X-ray must not scope by section_code");

const aliases = new Set(sql.sql_options.variable.map((row) => row.vname));
assert.deepStrictEqual([...aliases], builder.outputVariables);
[
  "row_no", "order_id", "order_number", "patient_name", "hn", "gender_display",
  "ward_clinic", "diagnosis_display", "priority_display", "order_note", "accession_no",
  "test_display", "modality_code", "modality_display", "body_part", "section_code",
  "section_name", "printed_by", "printed_at",
].forEach((alias) => assert(aliases.has(alias), `missing SQL alias: ${alias}`));

// Specimen belongs to LAB only; it must not reappear in the X-ray artifacts.
const specimenAliases = [
  "source_specimen", "collected_at", "collected_by", "storage_display",
  "specimen_name", "lab_no",
];
specimenAliases.forEach((alias) => assert(!aliases.has(alias), `X-ray must not carry LAB alias: ${alias}`));

assert.deepStrictEqual(sql.sql_select, []);
assert.deepStrictEqual(sql.sql_join, []);
assert.deepStrictEqual(sql.sql_order_by, []);
assert.strictEqual(sql.sql_where, null);
assert.strictEqual(typeof sql.nosql_collections, "string", "nosql_collections must be a JSON string");
assert.deepStrictEqual(JSON.parse(sql.nosql_collections), ["zdata_cpoe_order_item"]);

const pipeline = JSON.parse(sql.nosql_pipeline);
assert(Array.isArray(pipeline) && pipeline.length > 0);
const pipelineText = JSON.stringify(pipeline);
requiredParams.forEach((name) => assert(pipelineText.includes(`{{${name}}}`), `pipeline must bind {{${name}}}`));
assert(!pipelineText.includes("{{section_code}}"));
assert(pipelineText.includes('"from":"zdata_cpoe_order"'));
assert(pipelineText.includes('"from":"zdata_master_item_order"'));
assert(pipelineText.includes('"from":"zdata_section"'));
assert(pipelineText.includes('"from":"zdata_diagnosis"'));
assert(!pipelineText.includes("zdata_lab_work_item"), "X-ray must not read the LAB work item collection");
assert(pipelineText.includes('"service_type.value":"xray"'));
assert(!pipelineText.includes('"service_type.value":"lab"'));
assert(pipelineText.includes('"$setWindowFields"'));
const windowStage = pipeline.find((stage) => stage.$setWindowFields);
assert.strictEqual(Object.keys(windowStage.$setWindowFields.sortBy).length, 1);
const projectStage = pipeline.find((stage) => stage.$project);
assert(projectStage, "NoSQL aggregate must project Report variables");
builder.outputVariables.forEach((alias) =>
  assert(Object.prototype.hasOwnProperty.call(projectStage.$project, alias), `pipeline does not project ${alias}`),
);
specimenAliases.forEach((alias) =>
  assert(!Object.prototype.hasOwnProperty.call(projectStage.$project, alias), `pipeline still projects ${alias}`),
);

// Modality resolution must not drift from the X-ray Workbench worklist API.
const worklistSource = fs.readFileSync(WORKLIST_API, "utf8");
builder.MODALITY_MASTER.forEach((row) => {
  assert(
    worklistSource.includes(`{ code: '${row.code}', label: '${row.label}' }`),
    `modality ${row.code} drifted from xray_cpoe_worklist_api.js`,
  );
});
assert(pipelineText.includes("_master.xray_item.modality.value"));
assert(pipelineText.includes("_master.xray_item.modality_type"));
assert(pipelineText.includes("xray_context_snapshot.section"));
assert(pipelineText.includes('"$split":["$$raw","("]'), "person names must strip trailing account/email text");
assert(pipelineText.includes('"$in":[{"$toLower"'), "AN must normalize legacy empty numeric values");
["0", "0.0", "null", "undefined"].forEach((emptyAn) =>
  assert(pipelineText.includes(`"${emptyAn}"`), `AN blank normalization is missing ${emptyAn}`),
);

// Priority scalar codes must render the same labels configured on CPOE Order.
const walkObjects = (value, out = []) => {
  if (!value || typeof value !== "object") return out;
  if (!Array.isArray(value)) out.push(value);
  Object.values(value).forEach((child) => walkObjects(child, out));
  return out;
};
const priorityField = walkObjects(JSON.parse(fs.readFileSync(CPOE_ORDER_FORM, "utf8")))
  .find((item) => item.name === "priority" && Array.isArray(item.optionItems));
assert(priorityField, "CPOE Order priority field not found");
assert.deepStrictEqual(
  builder.PRIORITY_MASTER,
  priorityField.optionItems.map((item) => ({ code: String(item.value), label: item.label })),
);
builder.PRIORITY_MASTER.forEach((row) => {
  assert(pipelineText.includes(`"code":"${row.code}","label":"${row.label}"`));
});

// The ID-lookup helper must hand back exactly the keys the report filters on,
// otherwise a copied order_id/visit_id pair silently returns 0 rows.
const LOOKUP_SQL = path.join(ROOT, "Form-Builder/SDForm/X-ray/sql/xray-order-visit-ids.nosql.json");
const lookupPipeline = JSON.parse(fs.readFileSync(LOOKUP_SQL, "utf8"));
const findExpression = (stages, key) => {
  const stage = stages.find((item) => item.$addFields && item.$addFields[key]);
  assert(stage, `pipeline has no ${key}`);
  return JSON.stringify(stage.$addFields[key]);
};
assert.strictEqual(findExpression(lookupPipeline, "_order_key"), findExpression(pipeline, "_order_key"));
assert.strictEqual(findExpression(lookupPipeline, "_visit_key"), findExpression(pipeline, "_visit_key"));
const lookupMatch = JSON.stringify(lookupPipeline[0].$match);
assert(lookupMatch.includes('"service_type.value":"xray"'));
assert(lookupMatch.includes('"xrstatx":{"$nin":[0,3]}'));
const lookupProject = lookupPipeline[lookupPipeline.length - 1].$project;
["order_id", "visit_id", "order_number", "hn", "item_count", "accession_count"].forEach((field) =>
  assert(Object.prototype.hasOwnProperty.call(lookupProject, field), `lookup must return ${field}`),
);

// The order_number fallback reads zdata_cpoe_order directly, so its visit_id must be
// the report's _visit_key with the joined-order prefix stripped, and its order_id must
// be the _id the report's $lookup joins item.order_id.value against.
const BY_NUMBER_SQL = path.join(ROOT, "Form-Builder/SDForm/X-ray/sql/xray-order-ids-by-number.nosql.json");
const byNumber = JSON.parse(fs.readFileSync(BY_NUMBER_SQL, "utf8"));
const byNumberFields = byNumber.find((stage) => stage.$addFields).$addFields;
assert.strictEqual(
  JSON.stringify(byNumberFields.visit_id),
  findExpression(pipeline, "_visit_key").split("$_order.").join("$"),
);
assert.strictEqual(JSON.stringify(byNumberFields.order_id), JSON.stringify({ $toString: "$_id" }));
const orderLookup = pipeline.find((stage) => stage.$lookup && stage.$lookup.from === "zdata_cpoe_order").$lookup;
assert.strictEqual(orderLookup.localField, "order_id.value");
assert.strictEqual(orderLookup.foreignField, "_id");
assert(JSON.stringify(byNumber).includes("{{order_number}}"));

// X-ray Order ID Finder v1 — importable so its variables/params arrive declared, which is
// the whole reason a hand-pasted helper renders an empty grid.
const finder = builder.buildFinderSqlRecord();
assert.deepStrictEqual(finder, builder.buildFinderSqlRecord());
assert.strictEqual(finder.sql_name, "X-ray Order ID Finder v1");
assert.strictEqual(finder._id.$oid, builder.XRAY_FINDER_SQL_ID);
assert.strictEqual(finder.dataid, builder.XRAY_FINDER_SQL_ID);
assert.notStrictEqual(finder._id.$oid, builder.XRAY_SQL_ID);
assert.notStrictEqual(finder._id.$oid, builder.XRAY_REPORT_ID);
assert.strictEqual(finder.sql_type, "nosql");
assert.strictEqual(finder.nosql_type, "aggregate");
// Reads the order collection, so it works even when service_type is spelled unexpectedly.
assert.strictEqual(finder.sql_from, "zdata_cpoe_order");
assert.deepStrictEqual(JSON.parse(finder.nosql_collections), ["zdata_cpoe_order"]);
assert.deepStrictEqual(finder.sql_options.param.map((row) => row.pname), ["order_number"]);
assert.deepStrictEqual(
  finder.sql_options.variable.map((row) => row.vname),
  builder.finderVariables,
);
assert(finder.sql_options.variable.every((row) => row.origin === row.vname));
const finderPipeline = JSON.parse(finder.nosql_pipeline);
const finderText = JSON.stringify(finderPipeline);
assert(finderText.includes("{{order_number}}"));
assert(!finderText.includes('"service_type.value":"xray"'), "finder must not gate on service_type");
const finderFields = finderPipeline.filter((stage) => stage.$addFields).pop().$addFields;
// Same two values the Report filters on, so a copied pair cannot miss.
assert.strictEqual(
  JSON.stringify(finderFields.visit_id),
  findExpression(pipeline, "_visit_key").split("$_order.").join("$"),
);
assert.strictEqual(JSON.stringify(finderFields.order_id), JSON.stringify({ $toString: "$_id" }));
const finderProject = finderPipeline[finderPipeline.length - 1].$project;
builder.finderVariables.forEach((name) =>
  assert(Object.prototype.hasOwnProperty.call(finderProject, name), `finder must project ${name}`),
);
assert.deepStrictEqual(readOne(builder.FINDER_OUTPUT), finder);

const restoreSql = builder.buildSqlRestoreRecord(DUMMY_SQL_ID);
assert.strictEqual(restoreSql._id.$oid, DUMMY_SQL_ID);
assert.strictEqual(restoreSql.dataid, DUMMY_SQL_ID);
assert.strictEqual(restoreSql.nosql_pipeline, sql.nosql_pipeline);

const restoreReport = builder.buildReportRestoreRecord(DUMMY_REPORT_ID, DUMMY_SQL_ID);
assert.strictEqual(restoreReport._id.$oid, DUMMY_REPORT_ID);
assert.strictEqual(restoreReport.dataid, DUMMY_REPORT_ID);
assert.strictEqual(restoreReport.pdf_sql.value.$oid, DUMMY_SQL_ID);
assert.throws(() => builder.buildSqlRestoreRecord("nope"));
assert.throws(() => builder.buildReportRestoreRecord("nope", DUMMY_SQL_ID));

assert.strictEqual(report.pdf_page_size, "A4");
// 2026-09-03 (user: "ทำให้ layout ของแลป ... อันนี้ไฟล์ล่าสุดที่แลปใช้ทำ report").
// The user confirmed A4 portrait as the required paper for LAB, and X-ray Order Request
// must print on the same stationery, so this form follows LAB Order Request v1 (11:55).
assert.strictEqual(report.pdf_orientation, "portrait");
assert.strictEqual(report.pdf_column.length, 5);
assert.deepStrictEqual(
  report.pdf_column.map((col) => col.col_label),
  ["#", "Accession No.", "รายการตรวจ", "เครื่อง", "ตำแหน่ง"],
);
assert.deepStrictEqual(
  report.pdf_column.map((col) => col.col_field),
  ["row_no", "accession_no", "test_display", "modality_code", "body_part"],
);
// 2026-09-03: rescaled for the 547 pt portrait text column. #, Accession No. and ตำแหน่ง
// keep LAB's portrait widths (26 / 104 / 120) so the two forms line up; เครื่อง is X-ray-only.
assert.deepStrictEqual(
  report.pdf_column.map((col) => col.col_width),
  [26, 104, "*", 62, 120],
);
const fixedWidth = report.pdf_column
  .map((col) => col.col_width)
  .filter((width) => typeof width === "number")
  .reduce((total, width) => total + width, 0);
assert(fixedWidth + 200 <= 595 - report.pdf_ml - report.pdf_mr, "table columns leave too little room for รายการตรวจ");
assert.strictEqual(report.pdf_ml, 24);
assert.strictEqual(report.pdf_mt, 24);
assert.strictEqual(report.pdf_mr, 24);
assert.strictEqual(report.pdf_mb, 24);
assert.strictEqual(report.pdf_page_num, false);
assert.strictEqual(report.pdf_tb_layout, "lightHorizontalLines");
// 2026-09-03 (user: "แก้ report ของ xray ... ขนาดฟ้อนต์ ระยะห่าง ... ไม่ค่อยตรง").
// SdReport.vue renders table body cells at pdf_fontsize, not at the table widget's
// content_fontsize, so this is the only control for row text. Set to 13 so the body
// matches its own white header at LAB's portrait table size. Every content item sets an
// explicit content_fontsize, so nothing else inherits this value.
assert.strictEqual(report.pdf_fontsize, 13);

const contentByVariable = Object.fromEntries(report.pdf_content.map((item) => [item.content_var, item]));
assert.strictEqual(contentByVariable.hospital_logo.content_widget, "image");
assert.strictEqual(contentByVariable.hospital_logo.content_align, "left");
assert.strictEqual(contentByVariable.hospital_logo.content_width, 62);
assert.strictEqual(contentByVariable.hospital_logo.content_height, 86);
assert.strictEqual(contentByVariable.hospital_logo.content_ml, 12);
assert(contentByVariable.hospital_logo.content_value.endsWith("logo_2026_07_27_15_07_3392455.jpeg"));
assert.strictEqual(contentByVariable.order_barcode.content_align, "right");
// 2026-09-03: LAB portrait barcode.
assert.strictEqual(contentByVariable.order_barcode.content_width, 104);
assert.strictEqual(contentByVariable.order_barcode.content_height, 22);
assert.strictEqual(contentByVariable.xray_order_items.content_widget, "table");
assert(!contentByVariable.specimen_info, "X-ray report must not keep the LAB specimen block");

["xray_order_header", "patient_order_info", "exam_info"].forEach((variable) => {
  const html = contentByVariable[variable].content_value;
  assert(html.includes("border:none"), `${variable} must use borderless column layout`);
  assert(!html.includes("border:1px"), `${variable} must not render a boxed grid`);
  // 2026-09-03: the deployed renderer draws HTML through html-to-pdfmake in THSarabun,
  // which converts px -> pt at 0.75 and drops CSS line-height entirely. The frame's
  // 16 px detail text therefore had to be re-cut at 24 px to occupy the same width.
  assert.strictEqual(contentByVariable[variable].content_fontsize, variable === "xray_order_header" ? 16 : 17);
  assert(html.includes(variable === "xray_order_header" ? "font-size:16px" : "font-size:17px"));
  // line-height is in the renderer's ignoreStyles list; leading must come from margins.
  assert(!html.includes("line-height"), `${variable} must not rely on ignored line-height`);
});
assert.strictEqual(contentByVariable.xray_section_title.content_fontsize, 17);
assert(contentByVariable.xray_section_title.content_value.includes("font-size:19px"));
const headerHtml = contentByVariable.xray_order_header.content_value;
assert(headerHtml.includes("width:22%"));
assert(headerHtml.includes("width:56%"));
assert.strictEqual((headerHtml.match(/width:22%/g) || []).length, 2);
assert.strictEqual((headerHtml.match(/<col /g) || []).length, 3);
assert(headerHtml.includes("สถาบันสุขภาพเด็กแห่งชาติมหาราชินี"));
assert(headerHtml.includes("QUEEN SIRIKIT NATIONAL INSTITUTE OF CHILD HEALTH"));
assert(headerHtml.includes("กรมการแพทย์ กระทรวงสาธารณสุข"));
assert(headerHtml.includes("font-size:26px"));
assert(headerHtml.includes("font-size:17px"));
assert.strictEqual(contentByVariable.xray_order_header.content_mt, -96);
assert.strictEqual(contentByVariable.xray_section_title.content_mt, 28);
assert(contentByVariable.xray_section_title.content_value.includes("{{section_name}}"));
assert.strictEqual((contentByVariable.patient_order_info.content_value.match(/<col /g) || []).length, 2);
assert.strictEqual((contentByVariable.exam_info.content_value.match(/<col /g) || []).length, 2);
assert.strictEqual(contentByVariable.xray_order_items.content_fontsize, 13);
assert.strictEqual(contentByVariable.print_footer.content_fontsize, 12);

const reportText = report.pdf_content
  .map((item) => (typeof item.content_value === "string" ? item.content_value : ""))
  .join("\n");
const bindings = new Set(
  Array.from(reportText.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g), (match) => match[1]),
);
report.pdf_column.forEach((col) => bindings.add(col.col_field));
bindings.forEach((binding) => assert(aliases.has(binding), `report binding has no SQL alias: ${binding}`));
["source_specimen", "collected_at", "collected_by", "storage_display", "specimen_name", "lab_no"].forEach((alias) =>
  assert(!bindings.has(alias), `report still binds LAB-only field: ${alias}`),
);
["Specimen", "Lab Number", "ห้องปฏิบัติการ"].forEach((label) =>
  assert(!reportText.includes(label), `report still carries LAB wording: ${label}`),
);
["<b>Name :</b>", "<b>Ward :</b>", "<b>Date :</b>", "รหัส Section"].forEach((label) =>
  assert(!reportText.includes(label), `report still carries replaced label: ${label}`),
);
["<b>ชื่อ :</b>", "<b>คลินิกที่ส่ง :</b>", "<b>วันที่ :</b>", "ประเภทการตรวจวินิจฉัย"].forEach((label) =>
  assert(reportText.includes(label), `report is missing requested label: ${label}`),
);

// Active Restore artifacts must equal the current builder contract. Superseded
// Clone snapshots are intentionally not retained in the export workspace.
const liveRestoreSql = readOne(builder.SQL_RESTORE_OUTPUT);
assert.strictEqual(liveRestoreSql._id.$oid, LIVE_CLONE_SQL_ID);
assert.strictEqual(liveRestoreSql.dataid, LIVE_CLONE_SQL_ID);
assert.strictEqual(liveRestoreSql.nosql_pipeline, sql.nosql_pipeline);
const reboundReport = readOne(builder.REPORT_RESTORE_OUTPUT);
assert.strictEqual(reboundReport._id.$oid, LIVE_CLONE_REPORT_ID);
assert.strictEqual(reboundReport.dataid, LIVE_CLONE_REPORT_ID);
assert.strictEqual(reboundReport.pdf_sql.value.$oid, LIVE_CLONE_SQL_ID);
assert.strictEqual(reboundReport.pdf_sql.label, sql.sql_name);
assert.deepStrictEqual(reboundReport.pdf_params, report.pdf_params);
assert.deepStrictEqual(reboundReport.pdf_content, report.pdf_content);
assert.deepStrictEqual(reboundReport.pdf_column, report.pdf_column);
assert.strictEqual(reboundReport.pdf_page_size, report.pdf_page_size);
assert.strictEqual(reboundReport.pdf_orientation, report.pdf_orientation);
assert.strictEqual(reboundReport.pdf_tb_layout, "lightHorizontalLines");
assert.deepStrictEqual(reboundReport.pdf_tb_header, report.pdf_tb_header);
assert.strictEqual(report.pdf_tb_header.length, 1, "SdReport.vue custom header must contain one row");
assert(Array.isArray(report.pdf_tb_header[0]), "custom header must be nested as an array of rows");
assert.strictEqual(report.pdf_tb_header[0].length, report.pdf_column.length);
assert.deepStrictEqual(
  report.pdf_tb_header[0].map((cell) => cell.text),
  report.pdf_column.map((col) => col.col_label),
);
report.pdf_tb_header[0].forEach((cell) => {
  assert.strictEqual(cell.fillColor, "#FFFFFF");
  // 2026-09-03: header cells must match the body, which reads pdf_fontsize.
  assert.strictEqual(cell.fontSize, 13);
  assert.strictEqual(cell.fontSize, report.pdf_fontsize, "header must match table body size");
});

const combined = `${JSON.stringify(sql)}\n${JSON.stringify(report)}`;
["IMG_9044", "000000000000001", "ณัฐวุฒิ พัฒนกิจเจริญสุขสมบูรณ์"].forEach((value) =>
  assert(!combined.includes(value), `artifact must not contain source-image/sample PHI: ${value}`),
);

console.log("X-ray Order Request SQL/Report static contract passed");
