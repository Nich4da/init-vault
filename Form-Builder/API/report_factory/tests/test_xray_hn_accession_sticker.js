const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../../..')
const builder = require('../builders/build_xray_hn_accession_sticker')

const readOne = filename => {
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'))
  assert(Array.isArray(data), `${path.basename(filename)} must be an export array`)
  assert.strictEqual(data.length, 1, `${path.basename(filename)} must contain one record`)
  return data[0]
}

const sql = builder.buildSqlRecord()
const report = builder.buildReportRecord()
const requiredParams = ['order_id', 'visit_id', 'item_id', 'printed_date']

assert.deepStrictEqual(sql, builder.buildSqlRecord())
assert.deepStrictEqual(report, builder.buildReportRecord())
assert.strictEqual(sql._id.$oid, builder.XRAY_HN_STICKER_SQL_ID)
assert.strictEqual(report._id.$oid, builder.XRAY_HN_STICKER_REPORT_ID)
assert.strictEqual(report.pdf_sql.value.$oid, builder.XRAY_HN_STICKER_SQL_ID)
assert.strictEqual(sql.sql_name, 'X-ray HN Accession Sticker v1')
assert.strictEqual(report.pdf_name, 'X-ray HN Accession Sticker 8.5x2 cm v2')
assert.strictEqual(sql.sql_type, 'nosql')
assert.strictEqual(sql.nosql_type, 'aggregate')
assert.strictEqual(sql.sql_share, 'public')
assert.strictEqual(report.pdf_share, 'private')
assert.deepStrictEqual(sql.sql_options.param.map(row => row.pname), requiredParams)
assert.deepStrictEqual(report.pdf_params.map(row => row.param_var), requiredParams)
assert(report.pdf_params.every(row => row.param_required === true))

const aliases = new Set(sql.sql_options.variable.map(row => row.vname))
assert.deepStrictEqual([...aliases], builder.outputVariables)
builder.outputVariables.forEach(name => assert(aliases.has(name), `missing SQL alias ${name}`))

const pipeline = JSON.parse(sql.nosql_pipeline)
assert.deepStrictEqual(pipeline, builder.nosqlPipeline)
const pipelineText = JSON.stringify(pipeline)
requiredParams.forEach(name => assert(pipelineText.includes(`{{${name}}}`), `missing parameter {{${name}}}`))
assert(pipelineText.includes('"_item_key":"{{item_id}}"'), 'the sticker must select exactly the clicked item')
assert(pipelineText.includes('"_order_key":"{{order_id}}"'))
assert(pipelineText.includes('"_visit_key":"{{visit_id}}"'))
assert(!pipelineText.includes('"accession_no":{"$exists":true'), 'blank Accession must still be printable')
assert(pipelineText.includes('"service_type.value":"xray"'))
assert(!pipelineText.includes('"service_type.value":"lab"'))
assert(pipelineText.includes('"from":"zdata_cpoe_order"'))
assert(pipelineText.includes('"from":"zdata_visit"'))
assert(pipelineText.includes('"$dateDiff"'), 'age must include year/month/day calculation')
assert(pipelineText.includes('"$subtract"'), 'age must adjust incomplete years/months to prevent negative days')
assert(pipelineText.includes('"$add":[{"$year":"$_birth_date"},543]'), 'birth year must display in Buddhist Era')

assert.strictEqual(report.pdf_page_size, 'custom')
assert.strictEqual(report.pdf_orientation, 'landscape')
assert(Math.abs(report.pdf_custom_size.width - (8.5 * 72 / 2.54)) < 0.001)
assert(Math.abs(report.pdf_custom_size.height - (2 * 72 / 2.54)) < 0.001)
assert.strictEqual(report.pdf_ml, 4)
assert.strictEqual(report.pdf_mr, 4)
assert.strictEqual(report.pdf_mt, 2)
assert.strictEqual(report.pdf_mb, 2)
assert.strictEqual(report.pdf_fontsize, 8)
assert.strictEqual(report.pdf_page_date, false)
assert.strictEqual(report.pdf_page_num, false)
assert.strictEqual(report.pdf_title, null)
assert.deepStrictEqual(report.pdf_column, [])
assert.strictEqual(report.pdf_content.length, 1)

const html = report.pdf_content[0].content_value
assert.strictEqual(report.pdf_content[0].content_widget, 'html')
assert.strictEqual(report.pdf_content[0].content_fontsize, 8)
assert.strictEqual((html.match(/<tr>/g) || []).length, 4, 'reference label has four lines')
assert(html.includes('{{hospital_name}}'))
assert(html.includes('{{accession_no}}'))
assert(html.includes('{{patient_name}}'))
assert(html.includes('<b>วันเกิด</b> {{birth_date_display}}'))
assert(!html.includes('DOB'), 'the user explicitly replaced DOB with วันเกิด')
assert(html.includes('<b>อายุ</b> {{age_display}}'))
assert(html.includes('<b>วันที่</b> {{print_date}}'))
assert(html.includes('<b>HN</b> {{hn}}'))
assert(html.indexOf('{{hospital_name}}') < html.indexOf('{{patient_name}}'))
assert(html.indexOf('{{patient_name}}') < html.indexOf('วันเกิด'))
assert(html.indexOf('วันเกิด') < html.indexOf('วันที่'))

const bindings = new Set(
  Array.from(html.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g), match => match[1]),
)
bindings.forEach(name => assert(aliases.has(name), `Report binding has no SQL alias ${name}`))

assert.deepStrictEqual(readOne(builder.SQL_OUTPUT), sql)
assert.deepStrictEqual(readOne(builder.REPORT_OUTPUT), report)
assert.throws(() => builder.buildReportRecord('not-an-object-id'))
assert.throws(() => builder.buildReportRecord(builder.XRAY_HN_STICKER_SQL_ID, 'not-an-object-id'))

const liveRebind = builder.buildReportRecord(
  '6a980809422c1ca95982a053',
  '6a980831422c1ca95982a054',
  { createdAt: '2026-09-02 18:27:45', updatedAt: '2026-09-02 18:40:00' },
)
assert.strictEqual(liveRebind._id.$oid, '6a980831422c1ca95982a054')
assert.strictEqual(liveRebind.dataid, '6a980831422c1ca95982a054')
assert.strictEqual(liveRebind.pdf_sql.value.$oid, '6a980809422c1ca95982a053')
assert.strictEqual(liveRebind.created_at, '2026-09-02 18:27:45')
assert.strictEqual(liveRebind.updated_at, '2026-09-02 18:40:00')

const combined = `${JSON.stringify(sql)}\n${JSON.stringify(report)}`
;['IMG_9126', '1787790500083603', '68627011', 'ณัฐกิตติ์'].forEach(value => {
  assert(!combined.includes(value), `artifact must not contain reference-image PHI: ${value}`)
})

console.log('X-ray HN/Accession sticker SQL/Report contract passed')
