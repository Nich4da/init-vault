/* test_hn_patient_sticker.js — สัญญาของคู่ SQL + Report "ป้ายติดแฟ้ม (HN)"
 *
 * ข้อกำหนดจากผู้ใช้ 2026-09-04:
 *   "ไม่ต้องเอาข้อมูลไรเลย เกี่ยวกับ lab /xray เอาแค่ hn ข้อมูลผู้ป่วย วาร์ดต้นทาง บาร์โคเด hn"
 *   และ "filter จับแค่ hn" ⇒ เทสนี้บังคับทั้งสองข้อแบบชี้ชัด ไม่ใช่แค่ smoke
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../../..')
const builder = require('../builders/build_hn_patient_sticker')
const xrayBuilder = require('../builders/build_xray_hn_accession_sticker')

const readOne = filename => {
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'))
  assert(Array.isArray(data), `${path.basename(filename)} must be an export array`)
  assert.strictEqual(data.length, 1, `${path.basename(filename)} must contain one record`)
  return data[0]
}

const sql = builder.buildSqlRecord()
const report = builder.buildReportRecord()

// deterministic: รันซ้ำต้องได้ record เดิมเป๊ะ
assert.deepStrictEqual(sql, builder.buildSqlRecord())
assert.deepStrictEqual(report, builder.buildReportRecord())

// ── identity / wiring ────────────────────────────────────────────────────────
assert.strictEqual(sql._id.$oid, builder.HN_STICKER_SQL_ID)
assert.strictEqual(sql.dataid, builder.HN_STICKER_SQL_ID)
assert.strictEqual(sql.xparentx.$oid, builder.HN_STICKER_SQL_ID, 'SQL record ต้อง self-parent')
assert.strictEqual(report._id.$oid, builder.HN_STICKER_REPORT_ID)
assert.strictEqual(report.dataid, builder.HN_STICKER_REPORT_ID)
assert.strictEqual(report.xparentx.$oid, builder.HN_STICKER_REPORT_ID, 'Report record ต้อง self-parent')
assert.strictEqual(report.pdf_sql.value.$oid, builder.HN_STICKER_SQL_ID, 'Report ต้องชี้ SQL ตัวนี้')
assert.strictEqual(report.pdf_sql.label, sql.sql_name)
assert.strictEqual(sql.sql_name, 'HN Patient Sticker v1')
assert.strictEqual(report.pdf_name, 'ป้ายติดแฟ้ม (HN)')

/* ── ห้ามทับของเดิมที่ใช้งานอยู่ ────────────────────────────────────────────
   `5256d813009293b480d0a15c` = Report ป้ายติดแฟ้ม (VN) ตัวเดิม — ปุ่ม HN ย้ายมาใช้ป้ายใหม่แล้ว
   2026-09-04 แต่ record ยังอยู่ในระบบ ห้ามนำ _id นี้มาใช้ซ้ำ
   และคู่ X-ray HN Accession Sticker ยังต้องเป็นคนละ record */
const LIVE_HN_ORDER_REPORT_ID = '5256d813009293b480d0a15c'
const forbiddenIds = new Set([
  LIVE_HN_ORDER_REPORT_ID,
  xrayBuilder.XRAY_HN_STICKER_SQL_ID,
  xrayBuilder.XRAY_HN_STICKER_REPORT_ID,
])
assert(!forbiddenIds.has(builder.HN_STICKER_SQL_ID), 'ห้ามใช้ _id ของ record ที่ live อยู่')
assert(!forbiddenIds.has(builder.HN_STICKER_REPORT_ID), 'ห้ามใช้ _id ของ record ที่ live อยู่')
assert.notStrictEqual(builder.HN_STICKER_SQL_ID, builder.HN_STICKER_REPORT_ID)

// ── พารามิเตอร์: hn ตัวเดียวเท่านั้น ─────────────────────────────────────────
assert.deepStrictEqual(sql.sql_options.param.map(row => row.pname), ['hn'])
assert.deepStrictEqual(report.pdf_params.map(row => row.param_var), ['hn'])
assert.strictEqual(report.pdf_params[0].param_required, true)
assert.strictEqual(report.pdf_params[0].param_label, 'HN')
assert.strictEqual(report.pdf_params[0].param_default, null, 'ห้ามฝัง HN ตัวอย่างของผู้ป่วยจริงไว้')

// ── SQL shape ───────────────────────────────────────────────────────────────
assert.strictEqual(sql.sql_type, 'nosql')
assert.strictEqual(sql.nosql_type, 'aggregate')
assert.strictEqual(sql.sql_from, 'zdata_visit')
assert.strictEqual(sql.sql_form_id.value, builder.VISIT_FORM_ID)
assert.deepStrictEqual(JSON.parse(sql.nosql_collections), ['zdata_visit'])
assert.strictEqual(sql.sql_share, 'public', 'Report Preview ต้องอ่าน data source ได้')

const aliases = sql.sql_options.variable.map(row => row.vname)
assert.deepStrictEqual(aliases, builder.outputVariables)

const pipeline = JSON.parse(sql.nosql_pipeline)
assert.deepStrictEqual(pipeline, builder.nosqlPipeline)
const pipelineText = JSON.stringify(pipeline)

/* filter จับแค่ hn — ไม่มีพารามิเตอร์อื่นแอบอยู่ในไปป์ไลน์
   เปลี่ยน assertion เดิม 2026-09-04: ของเดิมล็อกว่าต้องเป็น `"pid.hn":"{{hn}}"` เป๊ะ ๆ
   แต่ Preview จริงคืน 0 แถว ⇒ เปลี่ยนไป match บน alias ระดับบนสุดตามแบบ X-ray HN sticker
   ที่ผ่าน runtime แล้ว · สิ่งที่ assertion เดิมปกป้อง (กรองด้วย HN เท่านั้น) ยังถูกล็อกไว้ครบ */
assert(pipelineText.includes('"$ifNull":["$pid.hn",""]'), 'ค่า HN ต้องอ่านจาก pid.hn ของ Visit')
assert(pipelineText.includes('"_hn_key":"{{hn}}"'), 'ต้องกรองด้วย HN ผ่าน alias ระดับบนสุด')
assert(pipelineText.includes('"_hn_key_prefixed":"{{hn}}"'), 'ต้องรับทั้ง 6900001 และ HN6900001')
const hnMatchStage = pipeline.find(stage => stage.$match && stage.$match.$or)
assert.deepStrictEqual(hnMatchStage.$match.$or, [
  { _hn_key: '{{hn}}' },
  { _hn_key_prefixed: '{{hn}}' },
], 'ทั้งสองทางต้องชี้ผู้ป่วยคนเดียวกัน ห้ามกรองหลวมข้ามคน')
assert.deepStrictEqual(hnMatchStage.$match.xrstatx, { $nin: [0, 3] })
assert(pipeline.indexOf(hnMatchStage) > pipeline.findIndex(stage => stage.$addFields && stage.$addFields._hn_key),
  '$addFields ที่สร้าง _hn_key ต้องมาก่อน $match')
const usedParams = [...pipelineText.matchAll(/\{\{([a-z0-9_]+)\}\}/gi)].map(match => match[1])
assert.deepStrictEqual([...new Set(usedParams)], ['hn'], 'ห้ามมีพารามิเตอร์อื่นนอกจาก hn')

// ห้ามมีข้อมูล LAB/X-ray ใด ๆ ในไปป์ไลน์
const forbiddenTokens = [
  'zdata_cpoe_order', 'zdata_cpoe_order_item', 'zdata_lab_work_item', 'zdata_lab_outband_order',
  'accession_no', 'lab_no', 'service_type', 'section_code', 'modality', 'item_name', 'order_id',
]
forbiddenTokens.forEach(token => assert(
  !pipelineText.includes(token),
  `ป้ายนี้ต้องไม่มีข้อมูล LAB/X-ray — เจอ "${token}" ในไปป์ไลน์`,
))

// เนื้อหาที่ผู้ใช้สั่งไว้ครบทั้งสี่อย่าง
assert(pipelineText.includes('"hn":'), 'ต้องคืน hn')
assert(pipelineText.includes('"patient_name":'), 'ต้องคืนชื่อผู้ป่วย')
assert(pipelineText.includes('"ward_display":'), 'ต้องคืนวาร์ดต้นทาง')
assert(pipelineText.includes('visit_clinic'), 'วาร์ดต้นทางอ่านจาก visit_clinic ของ Visit')
assert(pipelineText.includes('"$add":[{"$year":"$_birth_date"},543]'), 'วันเกิดต้องเป็น พ.ศ.')
assert(pipelineText.includes('"$dateDiff"'), 'อายุต้องคิดเป็น ปี/เดือน/วัน')
assert(pipelineText.includes('"$subtract"'), 'อายุต้องกันวันติดลบเหมือนสูตรที่ผ่าน UAT แล้ว')

// เลือกได้แถวเดียวเสมอ และ Visit ที่ยังเปิดอยู่มาก่อน
assert.deepStrictEqual(pipeline[pipeline.length - 1], { $limit: 1 }, 'ต้องจบด้วย $limit 1')
const sortStage = pipeline.find(stage => stage.$sort)
assert.deepStrictEqual(sortStage.$sort, { _open_rank: -1, _visit_sort: -1, _created_sort: -1 })

// ── Report shape ────────────────────────────────────────────────────────────
assert.strictEqual(report.pdf_from, 'zdata_visit')
assert.strictEqual(report.pdf_form_id, builder.VISIT_FORM_ID)
assert.strictEqual(report.pdf_page_size, 'custom')
assert.strictEqual(report.pdf_orientation, 'landscape')
// ขนาด/ขอบเดียวกับต้นแบบ "ป้ายติดแฟ้ม (VN)" ที่ผู้ใช้ส่งมา
assert.deepStrictEqual(report.pdf_custom_size, { width: 247, height: 67 })
assert.strictEqual(report.pdf_ml, 1)
assert.strictEqual(report.pdf_mt, 1)
assert.strictEqual(report.pdf_mr, 4)
assert.strictEqual(report.pdf_mb, 3)
assert.strictEqual(report.pdf_fontsize, 11)
assert.strictEqual(report.pdf_page_num, false)
assert.strictEqual(report.pdf_page_date, false)
assert.strictEqual(report.pdf_title, null)
assert.deepStrictEqual(report.pdf_column, [], 'ป้ายนี้ไม่มีตาราง ⇒ ไม่ต้องมี column setting')
assert.deepStrictEqual(report.pdf_tb_header, [])

assert.strictEqual(report.pdf_content.length, 2, 'html หนึ่งก้อน + barcode หนึ่งก้อน')
const [headerWidget, barcodeWidget] = report.pdf_content
assert.strictEqual(headerWidget.content_widget, 'html')
assert.strictEqual(barcodeWidget.content_widget, 'barcode')
assert.strictEqual(barcodeWidget.content_value, '{{hn}}', 'บาร์โค้ดต้องเป็น HN ไม่ใช่ VN')
assert.strictEqual(barcodeWidget.content_align, 'right')
assert.strictEqual(barcodeWidget.content_width, 70)
assert.strictEqual(barcodeWidget.content_height, 8)
assert.strictEqual(barcodeWidget.content_mt, -16)

const html = headerWidget.content_value
assert(html.includes('{{patient_name}}'))
assert(html.includes('HN {{hn}}'))
assert(html.includes('วันเกิด : {{birth_date_display}}'))
assert(html.includes('อายุ {{age_display}}'))
assert(html.includes('{{ward_display}}'), 'ต้องแสดงวาร์ดต้นทาง')
assert(html.includes('{{gender_text}}'))
assert(html.includes('{{blood_group}}'))
assert(!html.includes('{{vn}}'), 'ป้ายนี้ผูกกับ HN ไม่ใช่ VN')

// ทุก {{tag}} ในเนื้อรายงานต้องมี alias จริงใน SQL — พิมพ์ผิด = ช่องว่างเงียบ ๆ
const reportTags = [...JSON.stringify(report.pdf_content).matchAll(/\{\{([a-z0-9_]+)\}\}/gi)]
  .map(match => match[1])
assert(reportTags.length > 0)
reportTags.forEach(tag => assert(
  aliases.includes(tag),
  `{{${tag}}} ไม่มีใน SQL alias ⇒ จะขึ้นเป็นช่องว่างเงียบ ๆ`,
))

/* ไม่มีร่องรอย LAB/X-ray ใน "สิ่งที่พิมพ์ออกมา"
   ตรวจเฉพาะ pdf_content + pdf_params + data source — ไม่รวม pdf_note/pdf_desc ซึ่งเป็นคำอธิบาย
   ให้คนอ่าน (โน้ตจงใจเขียนว่าห้ามใส่ Accession/LAB NO. จึงมีคำพวกนี้ได้) */
const printedText = JSON.stringify({
  content: report.pdf_content,
  params: report.pdf_params,
  source: { from: report.pdf_from, form: report.pdf_form_id },
}).toLowerCase()
;['accession', 'lab_no', 'order_number', 'item_name', 'section', 'modality', 'cpoe'].forEach(token => assert(
  !printedText.includes(token),
  `รายงานนี้ต้องไม่พิมพ์ข้อมูล LAB/X-ray — เจอ "${token}"`,
))

// ── ไฟล์ export ที่ generate ไว้ต้องตรงกับ builder ────────────────────────────
const sqlFile = readOne(builder.SQL_OUTPUT)
const reportFile = readOne(builder.REPORT_OUTPUT)
assert.deepStrictEqual(sqlFile, sql, 'ไฟล์ SQL export ไม่ตรงกับ builder — generate ใหม่')
assert.deepStrictEqual(reportFile, report, 'ไฟล์ Report export ไม่ตรงกับ builder — generate ใหม่')

// ── ของเดิมต้องไม่ถูกกระทบ ───────────────────────────────────────────────────
const xraySql = xrayBuilder.buildSqlRecord()
const xrayReport = xrayBuilder.buildReportRecord()
assert.strictEqual(xraySql.sql_name, 'X-ray HN Accession Sticker v1')
assert.strictEqual(xrayReport.pdf_name, 'X-ray HN Accession Sticker 8.5x2 cm v2')
assert.deepStrictEqual(xrayReport.pdf_params.map(row => row.param_var),
  ['order_id', 'visit_id', 'item_id', 'printed_date'])

console.log('HN patient sticker report/SQL contract tests passed')
