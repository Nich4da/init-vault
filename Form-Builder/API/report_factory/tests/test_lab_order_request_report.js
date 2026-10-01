const assert = require("assert");
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../../..");
const builder = require("../builders/build_lab_order_request_report");
const WORKLIST_PATH = path.join(
  ROOT,
  "Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json",
);
const WORKLIST_BUILDER = path.join(
  ROOT,
  "Form-Builder/seed/tests-tools/scripts/update_lab_cpoe_worklist_ui.js",
);

const DUMMY_SQL_ID = "111111111111111111111111";
const DUMMY_REPORT_ID = "222222222222222222222222";
const LIVE_SQL_ID = "6a97754d422c1ca959829f96";
const requiredParams = ["order_id", "visit_id", "section_code", "printed_by", "printed_at"];
const LIVE_REPORT_ID = "6a977ac8422c1ca959829f97";

const readOne = (filename) => {
  const data = JSON.parse(fs.readFileSync(filename, "utf8"));
  assert(Array.isArray(data), `${path.basename(filename)} must be an export array`);
  assert.strictEqual(data.length, 1, `${path.basename(filename)} must contain exactly one record`);
  return data[0];
};

// 2026-09-02: SQL_OUTPUT is a dated historical Clone snapshot. The current contract
// is verified from the builder plus the versioned Restore artifact below.
const sql = builder.buildSqlRecord();
const report = builder.buildReportRecord(DUMMY_SQL_ID);
const worklist = JSON.parse(fs.readFileSync(WORKLIST_PATH, "utf8"));
const worklistWidget = worklist.fields[0].cols[0].fields[0].options;

assert.deepStrictEqual(sql, builder.buildSqlRecord());
assert(sql.created_by && sql.created_by.id && sql.created_by.id.$oid, "SQL clone backup needs real export metadata");
assert(sql.updated_by && sql.updated_by.id && sql.updated_by.id.$oid, "SQL clone backup needs real export metadata");
assert(report.created_by && report.created_by.id && report.created_by.id.$oid, "Report clone backup needs real export metadata");
assert(report.updated_by && report.updated_by.id && report.updated_by.id.$oid, "Report clone backup needs real export metadata");
assert.strictEqual(report.pdf_sql.value.$oid, DUMMY_SQL_ID);
assert.strictEqual(sql.sql_share, "public");
assert.strictEqual(report.pdf_share, "private");
assert.strictEqual(sql.sql_type, "nosql");
assert.strictEqual(sql.nosql_type, "aggregate");
assert.strictEqual(report.pdf_type, "report");

assert.deepStrictEqual(
  sql.sql_options.param.map((row) => row.pname),
  requiredParams,
);
assert(sql.sql_options.param.every((row) => row.ptype === "text"));
assert.deepStrictEqual(
  report.pdf_params.map((row) => row.param_var),
  requiredParams,
);
assert(report.pdf_params.every((row) => row.param_required === true));

const aliases = new Set(sql.sql_options.variable.map((row) => row.vname));
const expectedAliases = [
  "row_no",
  "order_id",
  "order_number",
  "patient_name",
  "hn",
  "ward_clinic",
  "diagnosis_display",
  "lab_no",
  "test_display",
  "specimen_name",
  "section_code",
  "section_name",
  "printed_by",
  "printed_at",
];
expectedAliases.forEach((alias) => assert(aliases.has(alias), `missing SQL alias: ${alias}`));

assert.deepStrictEqual(sql.sql_select, []);
assert.deepStrictEqual(sql.sql_join, []);
assert.deepStrictEqual(sql.sql_order_by, []);
assert.strictEqual(sql.sql_where, null);
assert.deepStrictEqual(JSON.parse(sql.nosql_collections), ["zdata_cpoe_order_item"]);
const pipeline = JSON.parse(sql.nosql_pipeline);
assert(Array.isArray(pipeline) && pipeline.length > 0);
const pipelineText = JSON.stringify(pipeline);
assert(pipelineText.includes("{{order_id}}"));
assert(pipelineText.includes("{{visit_id}}"));
assert(pipelineText.includes("{{section_code}}"));
assert(pipelineText.includes("{{printed_by}}"));
assert(pipelineText.includes("{{printed_at}}"));
assert(pipelineText.includes('"from":"zdata_cpoe_order"'));
assert(pipelineText.includes('"from":"zdata_lab_work_item"'));
assert(pipelineText.includes('"from":"zdata_diagnosis"'));
assert(pipelineText.includes('"$setWindowFields"'));
const windowStage = pipeline.find((stage) => stage.$setWindowFields);
assert.strictEqual(Object.keys(windowStage.$setWindowFields.sortBy).length, 1);
const projectStage = pipeline.find((stage) => stage.$project);
assert(projectStage, "NoSQL aggregate must project Report variables");
expectedAliases.forEach((alias) => assert(Object.prototype.hasOwnProperty.call(projectStage.$project, alias)));

const restoreSql = builder.buildSqlRestoreRecord(DUMMY_SQL_ID);
assert.strictEqual(restoreSql._id.$oid, DUMMY_SQL_ID);
assert.strictEqual(restoreSql.dataid, DUMMY_SQL_ID);
assert.strictEqual(restoreSql.nosql_pipeline, sql.nosql_pipeline);
const restoreSqlArtifact = readOne(builder.SQL_RESTORE_OUTPUT);
assert.deepStrictEqual(
  restoreSqlArtifact,
  builder.buildSqlRestoreRecord(LIVE_SQL_ID, {
    createdAt: "2026-09-02 08:01:01",
    updatedAt: "2026-09-02 09:30:00",
  }),
);

const restoreReport = builder.buildReportRestoreRecord(DUMMY_REPORT_ID, DUMMY_SQL_ID);
assert.strictEqual(restoreReport._id.$oid, DUMMY_REPORT_ID);
assert.strictEqual(restoreReport.dataid, DUMMY_REPORT_ID);
assert.strictEqual(restoreReport.pdf_sql.value.$oid, DUMMY_SQL_ID);

assert.strictEqual(report.pdf_page_size, "A4");
assert.strictEqual(report.pdf_orientation, "portrait");
assert.strictEqual(report.pdf_column.length, 4);
assert.deepStrictEqual(
  report.pdf_column.map((column) => column.col_label),
  ["#", "Lab Number", "รายการตรวจ", "Specimen"],
);
assert.deepStrictEqual(
  report.pdf_column.map((column) => column.col_field),
  ["row_no", "lab_no", "test_display", "specimen_name"],
);
assert.deepStrictEqual(
  report.pdf_column.map((column) => column.col_width),
  [26, 104, "*", 120],
);
assert.strictEqual(report.pdf_ml, 24);
assert.strictEqual(report.pdf_mt, 24);
assert.strictEqual(report.pdf_mr, 24);
assert.strictEqual(report.pdf_mb, 24);
assert.strictEqual(report.pdf_page_num, false);
assert.strictEqual(report.pdf_tb_layout, "lightHorizontalLines");

const contentByVariable = Object.fromEntries(
  report.pdf_content.map((item) => [item.content_var, item]),
);
assert.strictEqual(contentByVariable.hospital_logo.content_widget, "image");
assert.strictEqual(contentByVariable.hospital_logo.content_align, "left");
assert.strictEqual(contentByVariable.hospital_logo.content_width, 62);
assert.strictEqual(contentByVariable.hospital_logo.content_height, 86);
assert.strictEqual(contentByVariable.hospital_logo.content_ml, 12);
assert.strictEqual(contentByVariable.hospital_logo.content_mt, 10);
assert(contentByVariable.hospital_logo.content_value.endsWith("logo_2026_07_27_15_07_3392455.jpeg"));
assert.strictEqual(contentByVariable.order_barcode.content_align, "right");
assert.strictEqual(contentByVariable.order_barcode.content_width, 104);
assert.strictEqual(contentByVariable.order_barcode.content_height, 22);
assert.strictEqual(contentByVariable.order_barcode.content_mt, 0);
assert.strictEqual(contentByVariable.order_barcode.content_mr, 2);
["lab_order_header", "patient_order_info", "specimen_info"].forEach((variable) => {
  const html = contentByVariable[variable].content_value;
  assert(html.includes("border:none"), `${variable} must use borderless column layout`);
  assert(!html.includes("border:1px"), `${variable} must not render a boxed grid`);
});
const headerHtml = contentByVariable.lab_order_header.content_value;
assert.strictEqual((headerHtml.match(/width:22%/g) || []).length, 2);
assert(headerHtml.includes('width:56%'));
assert.strictEqual((headerHtml.match(/<col /g) || []).length, 3);
assert(headerHtml.includes("สถาบันสุขภาพเด็กแห่งชาติมหาราชินี"));
assert(headerHtml.includes("QUEEN SIRIKIT NATIONAL INSTITUTE OF CHILD HEALTH"));
assert(headerHtml.includes("กรมการแพทย์ กระทรวงสาธารณสุข"));
assert(headerHtml.includes("padding:28px 0 0"));
assert(headerHtml.includes("font-size:26px"));
assert(headerHtml.includes("font-size:17px"));
assert(headerHtml.includes("margin-bottom:-7px"));
assert(headerHtml.includes("margin-bottom:-5px"));
assert(!headerHtml.includes("margin-top:-4px"));
assert.strictEqual(contentByVariable.lab_order_header.content_fontsize, 16);
assert.strictEqual(contentByVariable.lab_order_header.content_mt, -96);
assert.strictEqual(contentByVariable.lab_section_title.content_mt, 28);
assert.strictEqual(contentByVariable.lab_section_title.content_ml, 0);
assert(contentByVariable.lab_section_title.content_value.includes("font-size:19px"));
assert(contentByVariable.lab_section_title.content_value.includes("{{section_name}}"));
assert.strictEqual(contentByVariable.patient_order_info.content_fontsize, 17);
assert.strictEqual(contentByVariable.patient_order_info.content_ml, 0);
assert.strictEqual(contentByVariable.specimen_info.content_fontsize, 17);
assert.strictEqual(contentByVariable.specimen_info.content_ml, 0);
assert.strictEqual(contentByVariable.lab_order_items.content_fontsize, 13);
assert.strictEqual(contentByVariable.print_footer.content_fontsize, 12);
assert.strictEqual(contentByVariable.print_footer.content_mt, 14);
assert.strictEqual(
  (contentByVariable.patient_order_info.content_value.match(/<col /g) || []).length,
  2,
);
assert(contentByVariable.patient_order_info.content_value.includes("font-size:17px"));
assert(contentByVariable.patient_order_info.content_value.includes('width:52%'));
assert(contentByVariable.patient_order_info.content_value.includes('width:48%'));
assert(contentByVariable.patient_order_info.content_value.includes("padding:0 0 0 12px"));
assert(!contentByVariable.patient_order_info.content_value.includes("{{gender_display}}"));
assert(!contentByVariable.patient_order_info.content_value.includes('colspan="2"'));
assert(contentByVariable.specimen_info.content_value.includes("font-size:17px"));
assert(contentByVariable.specimen_info.content_value.includes('width:52%'));
assert(contentByVariable.specimen_info.content_value.includes('width:48%'));
assert(contentByVariable.specimen_info.content_value.includes("padding:0 0 0 12px"));
assert.strictEqual(report.pdf_fontsize, 12);

assert.strictEqual(report.pdf_tb_header.length, 1, "SdReport.vue custom header must contain one row");
assert(Array.isArray(report.pdf_tb_header[0]), "custom header must be nested as an array of rows");
assert.strictEqual(report.pdf_tb_header[0].length, report.pdf_column.length);
assert.deepStrictEqual(
  report.pdf_tb_header[0].map((cell) => cell.text),
  report.pdf_column.map((column) => column.col_label),
);
report.pdf_tb_header[0].forEach((cell) => {
  assert.strictEqual(cell.fillColor, "#FFFFFF");
  assert.strictEqual(cell.fontSize, 13);
});

const reportText = report.pdf_content
  .map((item) => (typeof item.content_value === "string" ? item.content_value : ""))
  .join("\n");
assert(!reportText.includes("line-height"), "SdReport.vue ignores CSS line-height; spacing must not depend on it");
const bindings = new Set(
  Array.from(reportText.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g), (match) => match[1]),
);
report.pdf_column.forEach((column) => bindings.add(column.col_field));
bindings.forEach((binding) => assert(aliases.has(binding), `report binding has no SQL alias: ${binding}`));
["<b>Name :</b>", "<b>Ward :</b>", "<b>Date :</b>"].forEach((label) =>
  assert(!reportText.includes(label), `report still carries replaced label: ${label}`),
);
["<b>ชื่อ :</b>", "<b>คลินิกที่ส่ง :</b>", "<b>วันที่ :</b>"].forEach((label) =>
  assert(reportText.includes(label), `report is missing requested label: ${label}`),
);

const liveRestoreReport = readOne(builder.REPORT_RESTORE_OUTPUT);
assert.deepStrictEqual(
  liveRestoreReport,
  builder.buildReportRestoreRecord(LIVE_REPORT_ID, LIVE_SQL_ID, {
    createdAt: "2026-09-02 08:24:24",
    updatedAt: "2026-09-03 11:55:00",
  }),
);

assert(worklistWidget.content.includes("<sd-report"));
assert(!worklistWidget.content.includes("notifyPending('PDF ใบสั่งตรวจ')"));
assert(worklistWidget.content.includes("ตรวจใหม่"));
assert(worklistWidget.onCreated.includes(`const ORDER_REQUEST_REPORT_ID='${LIVE_REPORT_ID}'`));
assert(worklistWidget.onCreated.includes("s.orderVisitId=o=>"));
assert(worklistWidget.onCreated.includes("visit_id:s.orderVisitId(o)"));
assert(worklistWidget.onCreated.includes("section_code:s.reportSectionCode(o)"));

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lab-order-report-test-"));
const connectedWorklistPath = path.join(tempDir, "worklist.json");
try {
  childProcess.execFileSync(process.execPath, [WORKLIST_BUILDER], {
    env: {
      ...process.env,
      LAB_ORDER_REQUEST_REPORT_ID: DUMMY_REPORT_ID,
      LAB_WORKLIST_OUTPUT: connectedWorklistPath,
    },
  });
  const connectedWorklist = JSON.parse(fs.readFileSync(connectedWorklistPath, "utf8"));
  const connectedWidget = connectedWorklist.fields[0].cols[0].fields[0].options;
  assert(connectedWidget.content.includes("<sd-report"));
  assert(!connectedWidget.content.includes("notifyPending('PDF ใบสั่งตรวจ')"));
  assert(connectedWidget.onCreated.includes(`const ORDER_REQUEST_REPORT_ID='${DUMMY_REPORT_ID}'`));
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

const combined = `${JSON.stringify(sql)}\n${JSON.stringify(report)}`;
[
  "IMG_9044",
  "000000000000001",
  "ณัฐวุฒิ พัฒนกิจเจริญสุขสมบูรณ์",
].forEach((value) => assert(!combined.includes(value), `artifact must not contain source-image/sample PHI: ${value}`));

console.log("LAB Order Request SQL/Report static contract passed");
