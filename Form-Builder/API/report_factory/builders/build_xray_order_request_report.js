const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../../..");
const SQL_STAMP = "2026_09_03_00_35_00";
const REPORT_STAMP = "2026_09_03_12_00_00";
const FINDER_STAMP = "2026_09_02_16_40_00";
const SQL_RESTORE_STAMP = "2026_09_03_00_45_00";
const REPORT_RESTORE_STAMP = "2026_09_03_12_05_00";

/* Templates: the same initCraft-generated backup records the LAB package was built
   from, so the X-ray export keeps a valid Factory record shape and real metadata. */
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
  `Form-Builder/SDForm/sql-factory/exports/backup-data-module_sql-Earn_admin-${SQL_STAMP}.json`,
);
const REPORT_OUTPUT = path.join(
  ROOT,
  `Form-Builder/SDForm/report_factory/exports/backup-data-module_report-Earn_admin-${REPORT_STAMP}.json`,
);
const FINDER_OUTPUT = path.join(
  ROOT,
  `Form-Builder/SDForm/sql-factory/exports/backup-data-module_sql-Earn_admin-${FINDER_STAMP}.json`,
);
const SQL_RESTORE_OUTPUT = path.join(
  ROOT,
  `Form-Builder/SDForm/sql-factory/exports/backup-data-module_sql-Earn_admin-${SQL_RESTORE_STAMP}.json`,
);
const REPORT_RESTORE_OUTPUT = path.join(
  ROOT,
  `Form-Builder/SDForm/report_factory/exports/backup-data-module_report-Earn_admin-${REPORT_RESTORE_STAMP}.json`,
);

/* Pre-assigned identities. Clone Data (Insert new id) may replace them; the package
   stays self-consistent either way and never points at another team's record. */
const XRAY_SQL_ID = "6a98a1c0422c1ca95982a1c0";
const XRAY_REPORT_ID = "6a98a1c1422c1ca95982a1c1";
const XRAY_FINDER_SQL_ID = "6a98a1c2422c1ca95982a1c2";

const ORDER_ITEM_FORM_ID = "6a6f7db2265885c2377cc222";
const ORDER_FORM_ID = "6a6f5cd1265885c2377cc218";
const TOOL_LICENSE = "6a3113a619ee74c8f82854a0";
const HOSPITAL_LOGO_URL =
  "https://apihis.softmax-one.com/assets/sdform/6a607f2ba608039c539ebb7c/picture/2026/2026_07/2026_07_27/6a58678ad448dfc9d33e2ba8/logo_2026_07_27_15_07_3392455.jpeg";

const BASE = "zdata_cpoe_order_item";
const ORDER = "zdata_cpoe_order";
const MASTER = "zdata_master_item_order";
const SECTION = "zdata_section";
const DIAGNOSIS = "zdata_diagnosis";

/* Same enum as the Modality field of master Radio Exam and the X-ray Workbench
   dropdown (xray_cpoe_worklist_api.js MODALITY_MASTER). Kept in sync by test. */
const MODALITY_MASTER = [
  { code: "DX", label: "DX-Digital Radiography" },
  { code: "MG", label: "MG-Mammography" },
  { code: "US", label: "US-Ultrasound" },
  { code: "CT", label: "CT-Computed Tomography" },
  { code: "RF", label: "RF-Radiofluoroscopy" },
  { code: "CR", label: "CR-Computed Radiography" },
  { code: "VCUG", label: "VCUG-Voiding Cystourethrogram" },
  { code: "MR", label: "Magnetic Resonance" },
  { code: "IO", label: "Intra-oral Radiography" },
  { code: "UN", label: "Unspecified" },
  { code: "OT", label: "Other" },
];

/* Same values as the Priority select on CPOE Order. The source record can be
   either an initCraft {value,label} object or a legacy scalar code. */
const PRIORITY_MASTER = [
  { code: "1", label: "ปกติ" },
  { code: "2", label: "ด่วน" },
  { code: "3", label: "ด่วนที่สุด" },
  { code: "4", label: "ด่วน OR" },
  { code: "5", label: "ด่วน อุบัติเหตุ" },
];

const oid = (value) => ({ $oid: value });
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

/* X-ray has no specimen: source_specimen / collected_at / collected_by /
   storage_display / specimen_name / lab_no are intentionally absent. accession_no
   replaces lab_no as the number issued at dispatch. */
const outputVariables = [
  "row_no", "order_id", "order_number", "order_date", "order_time", "patient_name",
  "hn", "age_display", "gender_display", "an", "ward_clinic", "insurance_display",
  "prior_medication_display", "diagnosis_display", "priority_display", "order_note",
  "requester_name", "submitter_name", "accession_no", "item_code", "item_name",
  "test_display", "modality_code", "modality_display", "body_part", "item_status",
  "section_code", "section_name", "section_unit", "printed_by", "printed_at",
];

/* {value,label} | {code} | plain string all resolve to one display string. */
const textOf = (expression, fallback = "") => ({
  $let: {
    vars: { raw: expression },
    in: {
      $ifNull: [
        "$$raw.label",
        {
          $convert: {
            input: { $ifNull: ["$$raw.value", { $ifNull: ["$$raw.code", "$$raw"] }] },
            to: "string",
            onError: fallback,
            onNull: fallback,
          },
        },
      ],
    },
  },
});

const masterLabelOf = (expression, rows) => ({
  $let: {
    vars: { value: { $trim: { input: textOf(expression) } } },
    in: {
      $let: {
        vars: {
          row: {
            $arrayElemAt: [
              {
                $filter: {
                  input: rows,
                  as: "row",
                  cond: { $eq: ["$$row.code", "$$value"] },
                },
              },
              0,
            ],
          },
        },
        in: { $ifNull: ["$$row.label", "$$value"] },
      },
    },
  },
});

/* initCraft account labels are commonly "Display Name (email@example.org)".
   Reports need the human-readable name only. */
const personNameOf = (expression) => ({
  $let: {
    vars: { raw: textOf(expression) },
    in: { $trim: { input: { $arrayElemAt: [{ $split: ["$$raw", "("] }, 0] } } },
  },
});

/* Legacy visits sometimes persist a missing AN as numeric 0/0.0. */
const admissionNumberOf = (expression) => ({
  $let: {
    vars: { raw: textOf(expression) },
    in: {
      $cond: [
        {
          $in: [
            { $toLower: { $trim: { input: "$$raw" } } },
            ["", "0", "0.0", "null", "undefined"],
          ],
        },
        "",
        { $trim: { input: "$$raw" } },
      ],
    },
  },
});

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
      $or: [{ "service_type.value": "xray" }, { service_type: "xray" }],
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
    /* Section routing copied from xray_cpoe_worklist_api.js so the printed form and
       the Workbench always name the same unit. */
    $addFields: {
      _route_section: {
        $ifNull: ["$section_snapshot", { $ifNull: ["$xray_context_snapshot.section", "$_master.section"] }],
      },
      _visit_key: { $toString: { $ifNull: ["$_order.xparentx", "$_order.vid.value"] } },
    },
  },
  { $lookup: { from: SECTION, localField: "_route_section.value", foreignField: "_id", as: "_section_rows" } },
  { $lookup: { from: DIAGNOSIS, localField: "_order.xparentx", foreignField: "vid.value", as: "_diagnosis_rows" } },
  {
    $addFields: {
      _section: { $ifNull: [{ $arrayElemAt: ["$_section_rows", 0] }, "$_route_section"] },
      _diagnosis: { $arrayElemAt: ["$_diagnosis_rows", 0] },
    },
  },
  {
    /* Modality comes from master.xray_item.modality first — same order of fallbacks
       as the Workbench, so a printed form can never disagree with the worklist. */
    $addFields: {
      _modality_raw: {
        $ifNull: [
          "$_master.xray_item.modality.value",
          {
            $ifNull: [
              "$_master.xray_item.modality",
              {
                $ifNull: [
                  "$_master.xray_item.modality_type",
                  { $ifNull: ["$_section.modality_type", ""] },
                ],
              },
            ],
          },
        ],
      },
      _body_part_raw: {
        $ifNull: ["$_master.xray_item.body_path", { $ifNull: ["$_master.xray_item.bordy_path", ""] }],
      },
    },
  },
  {
    $addFields: {
      _modality_code: {
        $let: {
          vars: { raw: "$_modality_raw" },
          in: {
            $cond: [
              { $eq: [{ $type: "$$raw" }, "string"] },
              { $toUpper: { $trim: { input: "$$raw" } } },
              "",
            ],
          },
        },
      },
    },
  },
  {
    $match: {
      "_order.xrstatx": { $nin: [0, 3] },
      _visit_key: "{{visit_id}}",
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
      gender_display: textOf("$_order.vid.gender_text"),
      an: admissionNumberOf("$_order.vid.an"),
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
      priority_display: masterLabelOf("$_order.priority", PRIORITY_MASTER),
      order_note: { $ifNull: ["$_order.order_comment", { $ifNull: ["$comment", ""] }] },
      requester_name: personNameOf({ $ifNull: ["$_order.vid.visit_doctor.label", { $ifNull: ["$_order.cosign_user.name", { $ifNull: ["$_order.cosign_user.label", ""] }] }] }),
      submitter_name: personNameOf("$_order.created_by.name"),
      accession_no: { $ifNull: ["$accession_no", ""] },
      item_code: { $ifNull: ["$item_code", ""] },
      item_name: { $ifNull: ["$item_name", ""] },
      test_display: { $trim: { input: { $concat: [{ $ifNull: ["$item_code", ""] }, " ", { $ifNull: ["$item_name", ""] }] } } },
      modality_code: "$_modality_code",
      modality_display: {
        $let: {
          vars: {
            row: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: MODALITY_MASTER,
                    as: "row",
                    cond: { $eq: ["$$row.code", "$_modality_code"] },
                  },
                },
                0,
              ],
            },
          },
          in: { $ifNull: ["$$row.label", "$_modality_code"] },
        },
      },
      body_part: textOf("$_body_part_raw"),
      item_status: { $convert: { input: "$current_status", to: "string", onError: "", onNull: "" } },
      section_code: { $ifNull: ["$_section.code", { $ifNull: ["$section_snapshot.code", ""] }] },
      section_name: { $ifNull: ["$_section.name_th", { $ifNull: ["$_section.name", { $ifNull: ["$section_snapshot.name", ""] }] }] },
      section_unit: { $ifNull: ["$_section.unit.label", ""] },
      printed_by: "{{printed_by}}",
      printed_at: "{{printed_at}}",
    },
  },
  { $sort: { row_no: 1 } },
];

const buildSqlRecord = () => ({
  ...clone(sqlTemplate),
  _id: oid(XRAY_SQL_ID),
  dataid: XRAY_SQL_ID,
    created_at: "2026-09-03 00:35:00",
    updated_at: "2026-09-03 00:35:00",
  nosql_collections: JSON.stringify([BASE]),
  nosql_filter: null,
  nosql_options: null,
  nosql_pipeline: JSON.stringify(nosqlPipeline),
  nosql_type: "aggregate",
  pg_sql: null,
  sql_assign_roles: null,
  sql_category: null,
  sql_desc: "ใบสั่งตรวจ X-ray: 1 แถวต่อ CPOE X-ray item ภายใน Order และ Visit ที่ระบุ (ไม่มี specimen)",
  sql_form_id: { value: ORDER_ITEM_FORM_ID, label: "CPOE Order Item" },
  sql_from: BASE,
  sql_group_by: null,
  sql_join: [],
  sql_limit: null,
  sql_name: "X-ray Order Request PDF v1",
  sql_note:
    "NoSQL aggregate ตามแบบ LAB Order Request PDF v1. Fail-closed ด้วย order_id + visit_id; X-ray ไม่แบ่ง section_code เหมือน LAB. Accession No. ว่างจนกว่าจะส่งเข้าเครื่อง",
  sql_options: {
    variable: outputVariables.map((name) => ({ vname: name, origin: name, as: null })),
    param: [
      { pname: "order_id", ptype: "text", pdefault: null },
      { pname: "visit_id", ptype: "text", pdefault: null },
      { pname: "printed_by", ptype: "text", pdefault: null },
      { pname: "printed_at", ptype: "text", pdefault: null },
    ],
  },
  sql_order_by: [],
  sql_rstat: false,
  sql_select: [],
  sql_share: "public",
  sql_tags: ["XRAY", "order-request", "pdf", "CPOE"],
  sql_type: "nosql",
  sql_where: null,
  tool_feature: "sql",
  tool_license: TOOL_LICENSE,
});

/* Finder: reads zdata_cpoe_order directly so it never depends on how service_type is
   spelled on the items. It still reports the spellings it saw, which doubles as the
   diagnosis for an empty X-ray Order Request result. */
const finderVariables = [
  "order_id", "visit_id", "order_number", "order_created_at", "hn", "vn",
  "patient_name", "item_count", "xray_item_count", "service_types",
];

const itemServiceType = (itemVar) => ({
  $convert: {
    input: { $ifNull: [`${itemVar}.service_type.value`, `${itemVar}.service_type`] },
    to: "string",
    onError: "(not a string)",
    onNull: "(no service_type)",
  },
});

const finderPipeline = [
  {
    $match: {
      xrstatx: { $nin: [0, 3] },
      order_number: "{{order_number}}",
    },
  },
  {
    $lookup: {
      from: BASE,
      localField: "_id",
      foreignField: "order_id.value",
      as: "_items",
    },
  },
  {
    $addFields: {
      _live_items: {
        $filter: {
          input: { $ifNull: ["$_items", []] },
          as: "item",
          cond: { $not: [{ $in: ["$$item.xrstatx", [0, 3]] }] },
        },
      },
    },
  },
  {
    $addFields: {
      order_id: { $toString: "$_id" },
      visit_id: { $toString: { $ifNull: ["$xparentx", "$vid.value"] } },
      hn: { $ifNull: ["$vid.pid.hn", ""] },
      vn: { $ifNull: ["$vid.vn", ""] },
      order_created_at: { $ifNull: ["$created_at", ""] },
      patient_name: {
        $trim: {
          input: {
            $concat: [
              { $ifNull: ["$vid.pid.prename.label", ""] },
              " ",
              { $ifNull: ["$vid.pid.p_fname", ""] },
              " ",
              { $ifNull: ["$vid.pid.p_lname", ""] },
            ],
          },
        },
      },
      item_count: { $size: "$_live_items" },
      xray_item_count: {
        $size: {
          $filter: {
            input: "$_live_items",
            as: "item",
            cond: { $eq: [{ $toLower: itemServiceType("$$item") }, "xray"] },
          },
        },
      },
      service_types: {
        $reduce: {
          input: {
            $setUnion: [
              { $map: { input: "$_live_items", as: "item", in: itemServiceType("$$item") } },
            ],
          },
          initialValue: "",
          in: {
            $cond: [
              { $eq: ["$$value", ""] },
              "$$this",
              { $concat: ["$$value", ", ", "$$this"] },
            ],
          },
        },
      },
    },
  },
  { $limit: 5 },
  {
    $project: {
      _id: 0,
      order_id: 1,
      visit_id: 1,
      order_number: { $ifNull: ["$order_number", ""] },
      order_created_at: 1,
      hn: 1,
      vn: 1,
      patient_name: 1,
      item_count: 1,
      xray_item_count: 1,
      service_types: 1,
    },
  },
];

const buildFinderSqlRecord = () => ({
  ...clone(sqlTemplate),
  _id: oid(XRAY_FINDER_SQL_ID),
  dataid: XRAY_FINDER_SQL_ID,
  created_at: "2026-09-02 16:40:00",
  updated_at: "2026-09-02 16:40:00",
  nosql_collections: JSON.stringify([ORDER]),
  nosql_filter: null,
  nosql_options: null,
  nosql_pipeline: JSON.stringify(finderPipeline),
  nosql_type: "aggregate",
  pg_sql: null,
  sql_assign_roles: null,
  sql_category: null,
  sql_desc:
    "หา order_id + visit_id จากเลขที่ใบสั่ง (Order No.) ที่เห็นบนหน้า X-ray Workbench ไว้ป้อนให้ X-ray Order Request PDF v1",
  sql_form_id: { value: ORDER_FORM_ID, label: "CPOE Order" },
  sql_from: ORDER,
  sql_group_by: null,
  sql_join: [],
  sql_limit: null,
  sql_name: "X-ray Order ID Finder v1",
  sql_note:
    "อ่าน zdata_cpoe_order ตรง ๆ ไม่พึ่ง service_type จึงใช้ได้แม้ตอนที่ X-ray Order Request คืน 0 แถว คอลัมน์ service_types บอกค่าที่ item ใช้จริง",
  sql_options: {
    variable: finderVariables.map((name) => ({ vname: name, origin: name, as: null })),
    param: [{ pname: "order_number", ptype: "text", pdefault: null }],
  },
  sql_order_by: [],
  sql_rstat: false,
  sql_select: [],
  sql_share: "public",
  sql_tags: ["XRAY", "order-request", "lookup", "CPOE"],
  sql_type: "nosql",
  sql_where: null,
  tool_feature: "sql",
  tool_license: TOOL_LICENSE,
});

const buildSqlRestoreRecord = (importedSqlId, metadata = {}) => {
  if (!/^[a-f0-9]{24}$/i.test(String(importedSqlId || ""))) {
    throw new Error("--restore-sql-id must be the 24-character ID of the existing SQL Factory record");
  }
  const record = { ...buildSqlRecord(), _id: oid(importedSqlId), dataid: importedSqlId };
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

const column = (field, label, alignment, width) => ({
  col_field: field,
  col_label: label,
  col_alignment: alignment,
  col_width: width,
  col_format: "",
  col_sum: "",
  col_group: false,
  col_html: false,
  col_value: null,
  col_expressions: null,
  col_fillcolor: null,
});

const param = (variable, label) => ({
  param_var: variable,
  param_label: label,
  param_default: null,
  param_required: true,
  param_type: "text",
  param_sform: null,
  param_svalue: null,
  param_slabel: null,
});

const buildReportRecord = (importedSqlId = XRAY_SQL_ID) => {
  if (!/^[a-f0-9]{24}$/i.test(String(importedSqlId || ""))) {
    throw new Error("--sql-id must be a 24-character SQL Factory record ID");
  }
  return {
    ...clone(reportTemplate),
    _id: oid(XRAY_REPORT_ID),
    dataid: XRAY_REPORT_ID,
    created_at: "2026-09-03 00:40:00",
    updated_at: "2026-09-03 12:00:00",
    pdf_assign_roles: null,
    pdf_bg: null,
    pdf_category: null,
    pdf_column: [
      column("row_no", "#", "center", 26),
      column("accession_no", "Accession No.", "left", 104),
      column("test_display", "รายการตรวจ", "left", "*"),
      column("modality_code", "เครื่อง", "center", 62),
      column("body_part", "ตำแหน่ง", "left", 120),
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
        "xray_order_header",
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
        "xray_section_title",
        '<div style="font-size:19px;font-weight:bold"><span>{{section_unit}}</span> <span>{{section_name}}</span></div>',
        { content_fontsize: 17, content_ml: 0, content_mt: 28, content_mb: 8 },
      ),
      contentBase(
        "html",
        "patient_order_info",
        '<table style="width:100%;border-collapse:collapse;border:none;table-layout:fixed;font-size:17px"><colgroup><col style="width:52%"><col style="width:48%"></colgroup><tr><td style="border:none;padding:0 8px 0 0"><b>ชื่อ :</b> {{patient_name}}</td><td style="border:none;padding:0 0 0 12px"><b>อายุ :</b> {{age_display}} &nbsp;&nbsp; <b>เพศ :</b> {{gender_display}} &nbsp;&nbsp; <b>HN :</b> {{hn}}</td></tr><tr><td style="border:none;padding:0 8px 0 0"><b>คลินิกที่ส่ง :</b> {{ward_clinic}}</td><td style="border:none;padding:0 0 0 12px"><b>วันที่ :</b> {{order_date}} &nbsp;&nbsp; <b>AN :</b> {{an}}</td></tr><tr><td style="border:none;padding:0 8px 0 0;vertical-align:top"><b>ยาที่เคยได้รับ :</b> {{prior_medication_display}}</td><td style="border:none;padding:0 0 0 12px;vertical-align:top"><b>สิทธิการรักษา :</b> {{insurance_display}}</td></tr><tr><td style="border:none;padding:0 8px 0 0;vertical-align:top"><b>Diagnosis :</b> {{diagnosis_display}}</td><td style="border:none;padding:0 0 0 12px"></td></tr></table>',
        { content_fontsize: 17, content_ml: 0, content_mb: 6 },
      ),
      contentBase(
        "html",
        "exam_info",
        '<table style="width:100%;border-collapse:collapse;border:none;table-layout:fixed;font-size:17px"><colgroup><col style="width:52%"><col style="width:48%"></colgroup><tr><td style="border:none;padding:0 8px 0 0"><b>ผู้ส่งตรวจ :</b> {{submitter_name}}</td><td style="border:none;padding:0 0 0 12px"><b>แพทย์ผู้ส่งตรวจ :</b> {{requester_name}}</td></tr><tr><td style="border:none;padding:0 8px 0 0"><b>ความเร่งด่วน :</b> {{priority_display}}</td><td style="border:none;padding:0 0 0 12px"><b>ประเภทการตรวจวินิจฉัย :</b> {{section_code}}</td></tr><tr><td style="border:none;padding:0 8px 0 0;vertical-align:top"><b>หมายเหตุ / ข้อบ่งชี้ :</b> {{order_note}}</td><td style="border:none;padding:0 0 0 12px"></td></tr></table>',
        { content_fontsize: 17, content_ml: 0, content_mb: 12 },
      ),
      contentBase("table", "xray_order_items", null, {
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
      "ใบสั่งตรวจ X-ray รูปแบบเดียวกับ LAB Order Request v1 แต่ตัดบล็อก specimen ออกทั้งหมด; ใช้ order_id + visit_id และแสดง Accession No. หลังส่งเข้าเครื่อง",
    pdf_fontsize: 13,
    pdf_form_id: ORDER_ITEM_FORM_ID,
    pdf_from: BASE,
    pdf_latex: null,
    pdf_mb: 24,
    pdf_ml: 24,
    pdf_mr: 24,
    pdf_mt: 24,
    pdf_name: "X-ray Order Request v1",
    pdf_note:
      "Import SQL provider ก่อน แล้ว Preview ด้วย order_id ของ UAT และ visit_id ตัวเดียวกับที่ EMR ใช้ ก่อนจำกัดสิทธิ์ให้เฉพาะ role รังสี",
    pdf_orientation: "portrait",
    pdf_page_date: false,
    pdf_page_num: false,
    pdf_page_size: "A4",
    pdf_params: [
      param("order_id", "Order ID"),
      param("visit_id", "Visit ID"),
      param("printed_by", "ผู้พิมพ์"),
      param("printed_at", "วัน/เวลาพิมพ์"),
    ],
    pdf_share: "private",
    pdf_showheader: "firstPage",
    pdf_sql: { value: oid(importedSqlId), label: "X-ray Order Request PDF v1" },
    pdf_tags: ["XRAY", "order-request", "CPOE"],
    // SdReport.vue expects an array of header rows. The prior flat array was
    // interpreted as five rows and stalled pdfmake; one nested row is valid.
    pdf_tb_header: [
      [
        { text: "#", bold: true, alignment: "center", fillColor: "#FFFFFF", fontSize: 13 },
        { text: "Accession No.", bold: true, alignment: "left", fillColor: "#FFFFFF", fontSize: 13 },
        { text: "รายการตรวจ", bold: true, alignment: "left", fillColor: "#FFFFFF", fontSize: 13 },
        { text: "เครื่อง", bold: true, alignment: "center", fillColor: "#FFFFFF", fontSize: 13 },
        { text: "ตำแหน่ง", bold: true, alignment: "left", fillColor: "#FFFFFF", fontSize: 13 },
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
  const record = { ...buildReportRecord(importedSqlId), _id: oid(reportId), dataid: reportId };
  if (metadata.createdAt) record.created_at = metadata.createdAt;
  if (metadata.updatedAt) record.updated_at = metadata.updatedAt;
  return record;
};

const cliValue = (name) => {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length).trim() : "";
};

const writeRecord = (filename, record) => {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, `${JSON.stringify([record], null, 2)}\n`);
  console.log(`Wrote ${path.relative(ROOT, filename)}`);
};

if (require.main === module) {
  const importedSqlId = cliValue("sql-id") || XRAY_SQL_ID;
  const restoreSqlId = cliValue("restore-sql-id");
  const restoreReportId = cliValue("restore-report-id");

  writeRecord(SQL_OUTPUT, buildSqlRecord());
  writeRecord(FINDER_OUTPUT, buildFinderSqlRecord());
  writeRecord(REPORT_OUTPUT, buildReportRecord(importedSqlId));
  console.log(`Report data source SQL ID: ${importedSqlId}`);

  if (restoreSqlId) {
    writeRecord(
      SQL_RESTORE_OUTPUT,
      buildSqlRestoreRecord(restoreSqlId, {
        createdAt: cliValue("restore-created-at"),
        updatedAt: cliValue("restore-updated-at"),
      }),
    );
    console.log(`Restore Data (Upsert) target SQL ID: ${restoreSqlId}`);
  }

  if (restoreReportId) {
    writeRecord(
      REPORT_RESTORE_OUTPUT,
      buildReportRestoreRecord(restoreReportId, importedSqlId, {
        createdAt: cliValue("restore-report-created-at"),
        updatedAt: cliValue("restore-report-updated-at"),
      }),
    );
    console.log(`Restore Data (Upsert) target Report ID: ${restoreReportId}`);
  }
}

module.exports = {
  SQL_STAMP,
  REPORT_STAMP,
  SQL_RESTORE_STAMP,
  REPORT_RESTORE_STAMP,
  SQL_OUTPUT,
  REPORT_OUTPUT,
  SQL_RESTORE_OUTPUT,
  REPORT_RESTORE_OUTPUT,
  XRAY_SQL_ID,
  XRAY_REPORT_ID,
  MODALITY_MASTER,
  PRIORITY_MASTER,
  outputVariables,
  FINDER_STAMP,
  FINDER_OUTPUT,
  XRAY_FINDER_SQL_ID,
  finderVariables,
  buildSqlRecord,
  buildFinderSqlRecord,
  buildSqlRestoreRecord,
  buildReportRecord,
  buildReportRestoreRecord,
};
