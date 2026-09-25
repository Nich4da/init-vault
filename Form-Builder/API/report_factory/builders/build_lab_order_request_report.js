const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../../..");
const EXPORT_STAMP = "2026_09_02_08_00_00";
const RESTORE_STAMP = "2026_09_02_09_30_00";
const REPORT_STAMP = "2026_09_02_08_20_00";
const REPORT_RESTORE_STAMP = "2026_09_03_11_55_00";
const SQL_TEMPLATE = path.join(
  ROOT,
  "Form-Builder/SDForm/sql-factory/exports/backup-data-module_sql-drug-label-all-sigs-2026_08_06.json",
);
const REPORT_TEMPLATE = path.join(
  ROOT,
  "Form-Builder/SDForm/report_factory/exports/backup-data-module_report-drug-label-8x6-figma-final-2026_08_06.json",
);
const SQL_OUTPUT = path.join(
  ROOT,
  `Form-Builder/SDForm/sql-factory/exports/backup-data-module_sql-Earn_admin-${EXPORT_STAMP}.json`,
);
const REPORT_OUTPUT = path.join(
  ROOT,
  `Form-Builder/SDForm/report_factory/exports/backup-data-module_report-Earn_admin-${REPORT_STAMP}.json`,
);
const SQL_RESTORE_OUTPUT = path.join(
  ROOT,
  `Form-Builder/SDForm/sql-factory/exports/backup-data-module_sql-Earn_admin-${RESTORE_STAMP}.json`,
);
const REPORT_RESTORE_OUTPUT = path.join(
  ROOT,
  `Form-Builder/SDForm/report_factory/exports/backup-data-module_report-Earn_admin-${REPORT_RESTORE_STAMP}.json`,
);

const ORDER_ITEM_FORM_ID = "6a6f7db2265885c2377cc222";
const ORDER_FORM_ID = "6a6f5cd1265885c2377cc218";
const MASTER_ITEM_FORM_ID = "6a594763d448dfc9d33e2c27";
const SECTION_FORM_ID = "6a58f4dfd448dfc9d33e2bf2";
const WORK_ITEM_FORM_ID = "6a95c750422c1ca959829e8a";
const DIAGNOSIS_FORM_ID = "6a47a9cc8ca8083d715e3486";
const TOOL_LICENSE = "6a3113a619ee74c8f82854a0";
const HOSPITAL_LOGO_URL =
  "https://apihis.softmax-one.com/assets/sdform/6a607f2ba608039c539ebb7c/picture/2026/2026_07/2026_07_27/6a58678ad448dfc9d33e2ba8/logo_2026_07_27_15_07_3392455.jpeg";

const BASE = "zdata_cpoe_order_item";
const ORDER = "zdata_cpoe_order";
const MASTER = "zdata_master_item_order";
const SECTION = "zdata_section";
const WORK = "zdata_lab_work_item";
const DIAGNOSIS = "zdata_diagnosis";

const oid = (value) => ({ $oid: value });
const formRef = (value, label) => ({ value: oid(value), label });
const clone = (value) => JSON.parse(JSON.stringify(value));
const readBackupRecord = (filename) => {
  const data = JSON.parse(fs.readFileSync(filename, "utf8"));
  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error(`Backup template must contain exactly one record: ${filename}`);
  }
  return data[0];
};
const sqlTemplate = readBackupRecord(SQL_TEMPLATE);
const reportTemplate = readBackupRecord(REPORT_TEMPLATE);

const outputVariables = [
  "row_no", "order_id", "order_number", "order_date", "order_time", "patient_name",
  "hn", "age_display", "an", "ward_clinic", "insurance_display",
  "prior_medication_display", "diagnosis_display", "source_specimen", "collected_at",
  "collected_by", "storage_display", "requester_name", "submitter_name", "lab_no",
  "item_code", "item_name", "test_display", "specimen_name", "section_code",
  "section_name", "section_unit", "printed_by", "printed_at",
];

const nosqlPipeline = [
  {
    $addFields: {
      _order_key: { $toString: { $ifNull: ["$order_id.value", "$xparentx"] } },
      _item_key: { $toString: "$_id" },
    },
  },
  {
    $match: {
      xrstatx: { $nin: [0, 3] },
      _order_key: "{{order_id}}",
      $or: [{ "service_type.value": "lab" }, { service_type: "lab" }],
    },
  },
  { $lookup: { from: ORDER, localField: "order_id.value", foreignField: "_id", as: "_order_rows" } },
  { $lookup: { from: MASTER, localField: "item_data_id", foreignField: "_id", as: "_master_rows" } },
  {
    $addFields: {
      _order: { $arrayElemAt: ["$_order_rows", 0] },
      _master: { $arrayElemAt: ["$_master_rows", 0] },
    },
  },
  {
    $addFields: {
      _section_id: { $ifNull: ["$section_snapshot.value", "$_master.section.value"] },
      _visit_key: { $toString: { $ifNull: ["$_order.xparentx", "$_order.vid.value"] } },
    },
  },
  { $lookup: { from: SECTION, localField: "_section_id", foreignField: "_id", as: "_section_rows" } },
  { $lookup: { from: WORK, localField: "_item_key", foreignField: "source_specimen_record_id", as: "_work_rows" } },
  { $lookup: { from: DIAGNOSIS, localField: "_order.xparentx", foreignField: "vid.value", as: "_diagnosis_rows" } },
  {
    $addFields: {
      _section: { $arrayElemAt: ["$_section_rows", 0] },
      _work: { $arrayElemAt: ["$_work_rows", 0] },
      _diagnosis: { $arrayElemAt: ["$_diagnosis_rows", 0] },
    },
  },
  {
    $addFields: {
      _section_code: {
        $ifNull: [
          "$_work.section_code",
          { $ifNull: ["$section_snapshot.code", { $ifNull: ["$_section.code", "$_master.section.code"] }] },
        ],
      },
    },
  },
  {
    $match: {
      "_order.xrstatx": { $nin: [0, 3] },
      _visit_key: "{{visit_id}}",
      _section_code: "{{section_code}}",
    },
  },
  {
    $addFields: {
      _sort_key: {
        $concat: [
          { $ifNull: ["$created_at", ""] },
          "|",
          { $ifNull: ["$item_code", ""] },
          "|",
          { $toString: "$_id" },
        ],
      },
    },
  },
  { $sort: { _sort_key: 1 } },
  { $setWindowFields: { sortBy: { _sort_key: 1 }, output: { _row_no: { $documentNumber: {} } } } },
  {
    $project: {
      _id: 1,
      row_no: "$_row_no",
      order_id: { $toString: "$_order._id" },
      order_number: { $ifNull: ["$_order.order_number", ""] },
      order_date: { $substrCP: [{ $ifNull: ["$_order.created_at", ""] }, 0, 10] },
      order_time: { $substrCP: [{ $ifNull: ["$_order.created_at", ""] }, 11, 8] },
      patient_name: {
        $trim: {
          input: {
            $concat: [
              { $ifNull: ["$_order.vid.pid.prename.label", ""] },
              " ",
              { $ifNull: ["$_order.vid.pid.p_fname", ""] },
              " ",
              { $ifNull: ["$_order.vid.pid.p_lname", ""] },
            ],
          },
        },
      },
      hn: { $ifNull: ["$_order.vid.pid.hn", ""] },
      age_display: { $convert: { input: "$_order.vid.pid.age", to: "string", onError: "", onNull: "" } },
      an: { $ifNull: ["$_order.vid.an", ""] },
      ward_clinic: { $ifNull: ["$_order.vid.ward.label", { $ifNull: ["$_order.vid.visit_clinic.label", ""] }] },
      insurance_display: {
        $reduce: {
          input: { $ifNull: ["$_order.inscl_hos", []] },
          initialValue: "",
          in: {
            $let: {
              vars: { label: { $ifNull: ["$$this.inscl_item_main.label", ""] } },
              in: {
                $cond: [
                  { $eq: ["$$label", ""] },
                  "$$value",
                  { $cond: [{ $eq: ["$$value", ""] }, "$$label", { $concat: ["$$value", ", ", "$$label"] }] },
                ],
              },
            },
          },
        },
      },
      prior_medication_display: { $ifNull: ["$_order.prior_specify", { $ifNull: ["$_order.prior_medication.label", ""] }] },
      diagnosis_display: { $ifNull: ["$_diagnosis.primary_dx.label", { $ifNull: ["$_diagnosis.primary_dx.value", ""] }] },
      source_specimen: { $ifNull: ["$_work.source_specimen", { $ifNull: ["$lab_data.source_specimen", ""] }] },
      collected_at: { $ifNull: ["$_work.collected_at", ""] },
      collected_by: { $ifNull: ["$_work.collected_by.name", { $ifNull: ["$_work.collected_by.label", ""] }] },
      storage_display: { $ifNull: ["$_work.storage_before_transport", { $ifNull: ["$lab_data.storage_before_transport", ""] }] },
      requester_name: { $ifNull: ["$_order.vid.visit_doctor.label", { $ifNull: ["$_order.cosign_user.name", { $ifNull: ["$_order.cosign_user.label", ""] }] }] },
      submitter_name: { $ifNull: ["$_order.created_by.name", ""] },
      lab_no: { $ifNull: ["$_work.lab_no", ""] },
      item_code: { $ifNull: ["$item_code", ""] },
      item_name: { $ifNull: ["$item_name", ""] },
      test_display: { $trim: { input: { $concat: [{ $ifNull: ["$item_code", ""] }, " ", { $ifNull: ["$item_name", ""] }] } } },
      specimen_name: { $ifNull: ["$_work.specimen_name", { $ifNull: ["$lab_data.specimen.label", { $ifNull: ["$_master.lab_item.specimen.label", ""] }] }] },
      section_code: "$_section_code",
      section_name: { $ifNull: ["$_work.section_name", { $ifNull: ["$section_snapshot.name", { $ifNull: ["$_section.name_th", { $ifNull: ["$_section.name", ""] }] }] }] },
      section_unit: { $ifNull: ["$_section.unit.label", ""] },
      printed_by: "{{printed_by}}",
      printed_at: "{{printed_at}}",
    },
  },
  { $sort: { row_no: 1 } },
];

const buildSqlRecord = () => ({
  ...clone(sqlTemplate),
  nosql_collections: JSON.stringify([BASE]),
  nosql_filter: null,
  nosql_options: null,
  nosql_pipeline: JSON.stringify(nosqlPipeline),
  nosql_type: "aggregate",
  pg_sql: null,
  sql_assign_roles: null,
  sql_category: null,
  sql_desc: "ใบสั่งตรวจ LAB: 1 แถวต่อ CPOE LAB item ภายใน Order, Visit และ Section ที่ระบุ",
  sql_form_id: { value: ORDER_ITEM_FORM_ID, label: "CPOE Order Item" },
  sql_from: BASE,
  sql_group_by: null,
  sql_join: [],
  sql_limit: null,
  sql_name: "LAB Order Request PDF v1",
  sql_note:
    "NoSQL aggregate based on an initCraft backup export. Fail-closed by order_id + visit_id + section_code; LAB NO. remains blank before receipt.",
  sql_options: {
    variable: outputVariables.map((name) => ({ vname: name, origin: name, as: null })),
    param: [
      { pname: "order_id", ptype: "text", pdefault: null },
      { pname: "visit_id", ptype: "text", pdefault: null },
      { pname: "section_code", ptype: "text", pdefault: null },
      { pname: "printed_by", ptype: "text", pdefault: null },
      { pname: "printed_at", ptype: "text", pdefault: null },
    ],
  },
  sql_order_by: [],
  sql_rstat: false,
  sql_select: [],
  sql_share: "public",
  sql_tags: ["LAB", "order-request", "pdf", "CPOE"],
  sql_type: "nosql",
  sql_where: null,
  tool_feature: "sql",
  tool_license: TOOL_LICENSE,
});

const buildSqlRestoreRecord = (importedSqlId, metadata = {}) => {
  if (!/^[a-f0-9]{24}$/i.test(String(importedSqlId || ""))) {
    throw new Error("--restore-sql-id must be the 24-character ID of the existing SQL Factory record");
  }
  const record = {
    ...buildSqlRecord(),
    _id: oid(importedSqlId),
    dataid: importedSqlId,
  };
  if (metadata.createdAt) record.created_at = metadata.createdAt;
  if (metadata.updatedAt) record.updated_at = metadata.updatedAt;
  return record;
};

const contentBase = (widget, variable, value, extra = {}) => ({
  content_widget: widget,
  content_var: variable,
  content_align: "left",
  content_decoration: "",
  content_linestyle: "dotted",
  content_bold: false,
  content_italics: false,
  content_color: "#000000",
  content_bgcolor: null,
  content_fontsize: 13,
  content_ml: null,
  content_mt: null,
  content_mr: null,
  content_mb: 4,
  content_width: null,
  content_height: null,
  content_value: value,
  ...extra,
});

const buildReportRecord = (importedSqlId) => {
  if (!/^[a-f0-9]{24}$/i.test(String(importedSqlId || ""))) {
    throw new Error("--sql-id must be the 24-character ID created by SQL Factory Clone Data");
  }
  return {
  ...clone(reportTemplate),
  pdf_assign_roles: null,
  pdf_bg: null,
  pdf_category: null,
  pdf_column: [
    {
      col_field: "row_no",
      col_label: "#",
      col_alignment: "center",
      col_width: 26,
      col_format: "",
      col_sum: "",
      col_group: false,
      col_html: false,
      col_value: null,
      col_expressions: null,
      col_fillcolor: null,
    },
    {
      col_field: "lab_no",
      col_label: "Lab Number",
      col_alignment: "left",
      col_width: 104,
      col_format: "",
      col_sum: "",
      col_group: false,
      col_html: false,
      col_value: null,
      col_expressions: null,
      col_fillcolor: null,
    },
    {
      col_field: "test_display",
      col_label: "รายการตรวจ",
      col_alignment: "left",
      col_width: "*",
      col_format: "",
      col_sum: "",
      col_group: false,
      col_html: false,
      col_value: null,
      col_expressions: null,
      col_fillcolor: null,
    },
    {
      col_field: "specimen_name",
      col_label: "Specimen",
      col_alignment: "left",
      col_width: 120,
      col_format: "",
      col_sum: "",
      col_group: false,
      col_html: false,
      col_value: null,
      col_expressions: null,
      col_fillcolor: null,
    },
  ],
  pdf_content: [
    contentBase("image", "hospital_logo", HOSPITAL_LOGO_URL, {
      content_align: "left",
      content_width: 62,
      content_height: 86,
      content_ml: 12,
      content_mt: 10,
      content_mb: 0,
    }),
    contentBase(
      "html",
      "lab_order_header",
      '<table style="width:100%;border-collapse:collapse;border:none;table-layout:fixed;font-size:16px"><colgroup><col style="width:22%"><col style="width:56%"><col style="width:22%"></colgroup><tr><td style="border:none;padding:0"></td><td style="border:none;padding:28px 0 0;text-align:center;vertical-align:top"><div style="font-size:26px;font-weight:bold;margin-bottom:-7px">สถาบันสุขภาพเด็กแห่งชาติมหาราชินี</div><div style="font-size:17px;font-weight:bold;margin-bottom:-5px">QUEEN SIRIKIT NATIONAL INSTITUTE OF CHILD HEALTH</div><div style="font-size:17px;font-weight:bold">กรมการแพทย์ กระทรวงสาธารณสุข</div></td><td style="border:none;padding:0;text-align:right;vertical-align:top"><div><b>Order No. :</b> {{order_number}}<br><b>วันที่ :</b> {{order_date}}<br><b>เวลา :</b> {{order_time}}</div></td></tr></table>',
      { content_align: "left", content_fontsize: 16, content_mt: -96, content_mb: 0 },
    ),
    contentBase("barcode", "order_barcode", "{{order_number}}", {
      content_align: "right",
      content_fontsize: 12,
      content_width: 104,
      content_height: 22,
      content_mt: 0,
      content_mr: 2,
      content_mb: 0,
    }),
    contentBase(
      "html",
      "lab_section_title",
      '<div style="font-size:19px;font-weight:bold"><span>{{section_unit}}</span> <span>{{section_name}}</span></div>',
      { content_fontsize: 17, content_ml: 0, content_mt: 28, content_mb: 8 },
    ),
    contentBase(
      "html",
      "patient_order_info",
      '<table style="width:100%;border-collapse:collapse;border:none;table-layout:fixed;font-size:17px"><colgroup><col style="width:52%"><col style="width:48%"></colgroup><tr><td style="border:none;padding:0 8px 0 0"><b>ชื่อ :</b> {{patient_name}}</td><td style="border:none;padding:0 0 0 12px"><b>อายุ :</b> {{age_display}} &nbsp;&nbsp; <b>HN :</b> {{hn}}</td></tr><tr><td style="border:none;padding:0 8px 0 0"><b>คลินิกที่ส่ง :</b> {{ward_clinic}}</td><td style="border:none;padding:0 0 0 12px"><b>วันที่ :</b> {{order_date}} &nbsp;&nbsp; <b>AN :</b> {{an}}</td></tr><tr><td style="border:none;padding:0 8px 0 0;vertical-align:top"><b>ยาที่เคยได้รับ :</b> {{prior_medication_display}}</td><td style="border:none;padding:0 0 0 12px;vertical-align:top"><b>สิทธิการรักษา :</b> {{insurance_display}}</td></tr><tr><td style="border:none;padding:0 8px 0 0;vertical-align:top"><b>Diagnosis :</b> {{diagnosis_display}}</td><td style="border:none;padding:0 0 0 12px"></td></tr></table>',
      { content_fontsize: 17, content_ml: 0, content_mb: 6 },
    ),
    contentBase(
      "html",
      "specimen_info",
      '<table style="width:100%;border-collapse:collapse;border:none;table-layout:fixed;font-size:17px"><colgroup><col style="width:52%"><col style="width:48%"></colgroup><tr><td style="border:none;padding:0 8px 0 0"><b>Source of specimen :</b> {{source_specimen}}</td><td style="border:none;padding:0 0 0 12px"><b>เก็บวันที่ :</b> {{collected_at}}</td></tr><tr><td style="border:none;padding:0 8px 0 0"><b>Collected by :</b> {{collected_by}}</td><td style="border:none;padding:0 0 0 12px"><b>การเก็บรักษาก่อนนำส่ง :</b> {{storage_display}}</td></tr><tr><td style="border:none;padding:0 8px 0 0"><b>ผู้ส่งตรวจ :</b> {{submitter_name}}</td><td style="border:none;padding:0 0 0 12px"><b>แพทย์ผู้ส่งตรวจ :</b> {{requester_name}}</td></tr></table>',
      { content_fontsize: 17, content_ml: 0, content_mb: 12 },
    ),
    contentBase("table", "lab_order_items", null, {
      content_fontsize: 13,
      content_mb: 6,
    }),
    contentBase(
      "html",
      "print_footer",
      '<table style="width:100%;border-collapse:collapse;border:none;font-size:12px"><tr><td style="border:none;padding-top:5px">Print by : {{printed_by}}</td><td style="border:none;padding-top:5px;text-align:right">Date : {{printed_at}}</td></tr></table>',
      { content_fontsize: 12, content_mt: 14, content_mb: 0 },
    ),
  ],
  pdf_custom_size: { width: null, height: null },
  pdf_desc:
    "ใบสั่งตรวจ LAB อ้างอิงภาพต้นแบบโดยไม่ฝังข้อมูลผู้ป่วยตัวอย่าง; ใช้ order_id + section_code และแสดง LAB NO. หลังรับ specimen",
  pdf_fontsize: 12,
  pdf_form_id: ORDER_ITEM_FORM_ID,
  pdf_from: BASE,
  pdf_latex: null,
  pdf_mb: 24,
  pdf_ml: 24,
  pdf_mr: 24,
  pdf_mt: 24,
  pdf_name: "LAB Order Request v1",
  pdf_note:
    "Import SQL provider first. Preview with a UAT order_id, the same visit_id used by EMR, and its LAB section_code before assigning LAB roles.",
  pdf_orientation: "portrait",
  pdf_page_date: false,
  pdf_page_num: false,
  pdf_page_size: "A4",
  pdf_params: [
    {
      param_var: "order_id",
      param_label: "Order ID",
      param_default: null,
      param_required: true,
      param_type: "text",
      param_sform: null,
      param_svalue: null,
      param_slabel: null,
    },
    {
      param_var: "visit_id",
      param_label: "Visit ID",
      param_default: null,
      param_required: true,
      param_type: "text",
      param_sform: null,
      param_svalue: null,
      param_slabel: null,
    },
    {
      param_var: "section_code",
      param_label: "LAB Section Code",
      param_default: null,
      param_required: true,
      param_type: "text",
      param_sform: null,
      param_svalue: null,
      param_slabel: null,
    },
    {
      param_var: "printed_by",
      param_label: "ผู้พิมพ์",
      param_default: null,
      param_required: true,
      param_type: "text",
      param_sform: null,
      param_svalue: null,
      param_slabel: null,
    },
    {
      param_var: "printed_at",
      param_label: "วัน/เวลาพิมพ์",
      param_default: null,
      param_required: true,
      param_type: "text",
      param_sform: null,
      param_svalue: null,
      param_slabel: null,
    },
  ],
  pdf_share: "private",
  pdf_showheader: "firstPage",
  pdf_sql: { value: oid(importedSqlId), label: "LAB Order Request PDF v1" },
  pdf_tags: ["LAB", "order-request", "CPOE"],
  // SdReport.vue expects an array of header rows. A flat cell array is treated
  // as multiple rows and can stall pdfmake during client-side rendering.
  pdf_tb_header: [
    [
      { text: "#", bold: true, alignment: "center", fillColor: "#FFFFFF", fontSize: 13 },
      { text: "Lab Number", bold: true, alignment: "left", fillColor: "#FFFFFF", fontSize: 13 },
      { text: "รายการตรวจ", bold: true, alignment: "left", fillColor: "#FFFFFF", fontSize: 13 },
      { text: "Specimen", bold: true, alignment: "left", fillColor: "#FFFFFF", fontSize: 13 },
    ],
  ],
  pdf_tb_layout: "lightHorizontalLines",
  pdf_temp: null,
  pdf_title: null,
  pdf_type: "report",
  pdf_watermark: null,
  tool_license: TOOL_LICENSE,
  };
};

const buildReportRestoreRecord = (reportId, importedSqlId, metadata = {}) => {
  if (!/^[a-f0-9]{24}$/i.test(String(reportId || ""))) {
    throw new Error("--restore-report-id must be the 24-character ID of the existing Report Factory record");
  }
  const record = {
    ...buildReportRecord(importedSqlId),
    _id: oid(reportId),
    dataid: reportId,
  };
  if (metadata.createdAt) record.created_at = metadata.createdAt;
  if (metadata.updatedAt) record.updated_at = metadata.updatedAt;
  return record;
};

const cliValue = (name) => {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length).trim() : "";
};

if (require.main === module) {
  const importedSqlId = cliValue("sql-id");
  const restoreReportId = cliValue("restore-report-id");
  const restoreSqlId = cliValue("restore-sql-id");
  if (!restoreReportId && !restoreSqlId) {
    fs.mkdirSync(path.dirname(SQL_OUTPUT), { recursive: true });
    fs.writeFileSync(SQL_OUTPUT, `${JSON.stringify([buildSqlRecord()], null, 2)}\n`);
    console.log(`Wrote ${path.relative(ROOT, SQL_OUTPUT)}`);
    console.log("Import SQL with Clone Data (Insert new id), then copy the new SQL record ID.");
  } else {
    console.log("SQL Clone package unchanged: Restore mode preserves the working SQL snapshot.");
  }

  if (importedSqlId && !restoreReportId) {
    fs.mkdirSync(path.dirname(REPORT_OUTPUT), { recursive: true });
    fs.writeFileSync(
      REPORT_OUTPUT,
      `${JSON.stringify([buildReportRecord(importedSqlId)], null, 2)}\n`,
    );
    console.log(`Wrote ${path.relative(ROOT, REPORT_OUTPUT)}`);
    console.log(`Report data source SQL ID: ${importedSqlId}`);
  } else if (!importedSqlId) {
    console.log("Report package not generated: rerun with --sql-id=<ID returned by SQL Clone Data>.");
  } else {
    console.log("Clone Report package unchanged: Restore mode writes only a new Restore snapshot.");
  }

  if (restoreSqlId) {
    const restoreMetadata = {
      createdAt: cliValue("restore-created-at"),
      updatedAt: cliValue("restore-updated-at"),
    };
    fs.mkdirSync(path.dirname(SQL_RESTORE_OUTPUT), { recursive: true });
    fs.writeFileSync(
      SQL_RESTORE_OUTPUT,
      `${JSON.stringify([buildSqlRestoreRecord(restoreSqlId, restoreMetadata)], null, 2)}\n`,
    );
    console.log(`Wrote ${path.relative(ROOT, SQL_RESTORE_OUTPUT)}`);
    console.log(`Restore Data (Upsert) target SQL ID: ${restoreSqlId}`);
  }

  if (restoreReportId) {
    if (!importedSqlId) {
      throw new Error("--restore-report-id requires --sql-id so the restored Report keeps a real SQL provider binding");
    }
    const restoreReportMetadata = {
      createdAt: cliValue("restore-report-created-at"),
      updatedAt: cliValue("restore-report-updated-at"),
    };
    fs.mkdirSync(path.dirname(REPORT_RESTORE_OUTPUT), { recursive: true });
    fs.writeFileSync(
      REPORT_RESTORE_OUTPUT,
      `${JSON.stringify([buildReportRestoreRecord(restoreReportId, importedSqlId, restoreReportMetadata)], null, 2)}\n`,
    );
    console.log(`Wrote ${path.relative(ROOT, REPORT_RESTORE_OUTPUT)}`);
    console.log(`Restore Data (Upsert) target Report ID: ${restoreReportId}`);
  }
}

module.exports = {
  EXPORT_STAMP,
  RESTORE_STAMP,
  REPORT_STAMP,
  REPORT_RESTORE_STAMP,
  SQL_OUTPUT,
  SQL_RESTORE_OUTPUT,
  REPORT_OUTPUT,
  REPORT_RESTORE_OUTPUT,
  buildSqlRecord,
  buildSqlRestoreRecord,
  buildReportRecord,
  buildReportRestoreRecord,
};
