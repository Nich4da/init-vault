#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const SQL_ID = '6ab0a1c4d0c3ef2e97911e55'
const REPORT_ID = '6aa8f5a8b92813319a86ea11'

const [sqlInput, reportInput, outputDir] = process.argv.slice(2)
if (!sqlInput || !reportInput || !outputDir) {
  throw new Error('Usage: node build_lab_result_profile_group_replace.js SQL_EXPORT REPORT_EXPORT OUTPUT_DIR')
}

const readOne = (filename, expectedId, label) => {
  const source = JSON.parse(fs.readFileSync(filename, 'utf8'))
  const rows = Array.isArray(source) ? source : Array.isArray(source.data) ? source.data : [source]
  const row = rows.find(item => String(item?._id?.$oid || item?._id || '') === expectedId)
  if (!row) throw new Error(`${label} ${expectedId} not found in ${filename}`)
  return structuredClone(row)
}

const sql = readOne(sqlInput, SQL_ID, 'SQL Factory record')
const report = readOne(reportInput, REPORT_ID, 'Report Factory record')

if (sql.sql_name !== 'lab_result_slip') throw new Error(`Unexpected SQL name: ${sql.sql_name}`)
if (report.pdf_name !== 'Lab result') throw new Error(`Unexpected report name: ${report.pdf_name}`)

const pipeline = JSON.parse(sql.nosql_pipeline)
const resultLookupStage = pipeline.find(stage => stage.$lookup?.from === 'zdata_lab_result_item')
if (!resultLookupStage) throw new Error('zdata_lab_result_item lookup not found')

const itemPipeline = resultLookupStage.$lookup.pipeline
if (itemPipeline.some(stage => stage.$setWindowFields)) {
  throw new Error('Result-item window stage already exists; review source before rebuilding')
}

const sortIndex = itemPipeline.findIndex(stage => stage.$sort)
if (sortIndex < 0) throw new Error('Result-item sort stage not found')
itemPipeline.splice(sortIndex + 1, 0, {
  $setWindowFields: {
    partitionBy: '$order_no',
    // MongoDB requires exactly one top-level sort key for $documentNumber.
    // The preceding stable sort already uses _seq then _id.
    sortBy: { _seq: 1 },
    output: {
      _profile_row_no: { $documentNumber: {} },
      _profile_count: { $count: {} }
    }
  }
})

const itemProject = itemPipeline.find(stage => stage.$project)?.$project
if (!itemProject) throw new Error('Result-item projection not found')
itemProject._profile_row_no = 1
itemProject._profile_count = 1

const orderItemLookup = pipeline.find(stage => stage.$lookup?.as === '_sensitive_gate_order_item')?.$lookup
if (!orderItemLookup) throw new Error('CPOE order-item lookup not found')
const orderItemProject = orderItemLookup.pipeline.find(stage => stage.$project)?.$project
if (!orderItemProject) throw new Error('CPOE order-item projection not found')
orderItemProject.item_name = 1
orderItemProject.item_code = 1

const masterLookup = pipeline.find(stage => stage.$lookup?.as === '_sensitive_gate_master')?.$lookup
if (!masterLookup) throw new Error('Order master lookup not found')
const masterProject = masterLookup.pipeline.find(stage => stage.$project)?.$project
if (!masterProject) throw new Error('Order master projection not found')
masterProject.item_name = 1
masterProject.item_code = 1

const finalProject = [...pipeline].reverse().find(stage => stage.$project)?.$project
if (!finalProject || !finalProject.test_name) throw new Error('Final report projection not found')

const parentNameExpr = {
  $let: {
    vars: {
      orderName: { $trim: { input: { $toString: { $ifNull: ['$_sensitive_gate_order_item_row.item_name', ''] } } } },
      masterName: { $trim: { input: { $toString: { $ifNull: ['$_sensitive_gate_master_row.item_name', ''] } } } }
    },
    in: { $cond: [{ $ne: ['$$orderName', ''] }, '$$orderName', '$$masterName'] }
  }
}

finalProject.parent_test_name = parentNameExpr
finalProject.profile_header_row = {
  $let: {
    vars: {
      raw: parentNameExpr,
      count: { $ifNull: ['$_items._profile_count', 0] },
      rowNo: { $ifNull: ['$_items._profile_row_no', 0] }
    },
    in: {
      $let: {
        vars: {
          safe: {
            $replaceAll: {
              input: {
                $replaceAll: {
                  input: { $replaceAll: { input: '$$raw', find: '&', replacement: '&amp;' } },
                  find: '<',
                  replacement: '&lt;'
                }
              },
              find: '>',
              replacement: '&gt;'
            }
          }
        },
        in: {
          $cond: [
            { $and: [{ $gt: ['$$count', 1] }, { $eq: ['$$rowNo', 1] }, { $ne: ['$$safe', ''] }] },
            {
              $concat: [
                '<tr><td colspan="',
                { $cond: ['$_hasSite', '5', '4'] },
                '" style="border:none;padding-top:6px;padding-bottom:4px;"><span style="font-size:17px;"><b>',
                '$$safe',
                '</b></span></td></tr>'
              ]
            },
            ''
          ]
        }
      }
    }
  }
}

sql.nosql_pipeline = JSON.stringify(pipeline)
sql.sql_note = 'EMR_SENSITIVE_RESULT_REPORT_ROW_GATE_V4: Result Items use Result Report ID only; Sensitive grants use each row parent CPOE Order; repeated items from the same ordered test render one dynamic parent/profile heading.'
sql.sql_desc = `${sql.sql_desc || ''} Profile/group heading is derived from the linked CPOE Order Item (fallback Order Master), never hardcoded; it is emitted only for the first row when an ordered test has more than one result item.`.trim()

if (!Array.isArray(sql.sql_options?.variable)) throw new Error('SQL variable list missing')
for (const name of ['parent_test_name', 'profile_header_row']) {
  if (!sql.sql_options.variable.some(row => row.vname === name)) {
    sql.sql_options.variable.push({ vname: name, origin: name, as: null })
  }
}

if (!Array.isArray(report.pdf_column) || report.pdf_column.length !== 1) {
  throw new Error('Expected one HTML table column in Lab result report')
}
const tableColumn = report.pdf_column[0]
const marker = '<tbody><tr><td style="border:none; text-align:left;">'
if (!tableColumn.col_value.includes(marker)) throw new Error('Lab result row template marker not found')
tableColumn.col_value = tableColumn.col_value.replace(
  marker,
  '<tbody>{{profile_header_row}}<tr><td style="border:none; text-align:left;">'
)
report.pdf_desc = `${report.pdf_desc || ''} Parent/profile name is rendered once before its sub-results from {{profile_header_row}} supplied by lab_result_slip; single-result tests remain ungrouped.`.trim()

fs.mkdirSync(outputDir, { recursive: true })
const sqlName = `01_sql-factory__lab_result_slip__${SQL_ID}.json`
const reportName = `02_report-factory__Lab-result__${REPORT_ID}.json`
const sqlPath = path.join(outputDir, sqlName)
const reportPath = path.join(outputDir, reportName)
fs.writeFileSync(sqlPath, JSON.stringify([sql], null, 2) + '\n')
fs.writeFileSync(reportPath, JSON.stringify([report], null, 2) + '\n')

const readme = `# LAB Result PDF — Profile/Parent Heading v4\n\nสถานะ: ชุดไฟล์สำหรับให้ผู้ใช้ Replace เอง ยังไม่ได้แก้ live artifact\n\n## สิ่งที่แก้\n\n- รายการที่มีผลย่อยหลายแถวจะแสดงชื่อ Test/Order หลักหนึ่งครั้ง เช่น **Liver Function Test**\n- Total protein, Albumin, Total bilirubin, AST และ ALT ยังคงเป็นผลย่อย\n- ชื่อหัวดึงจาก CPOE Order Item และ fallback ไป Order Master ไม่ hardcode ชื่อ profile\n- Test ที่มีผลเดียวไม่เพิ่มหัวซ้ำ\n- คง sensitive-result gate, comment ระดับ Order/Test, คอลัมน์ตำแหน่งของ MY และ layout เดิม\n- ไม่เปลี่ยนพฤติกรรม MLab ใน popup; ปุ่ม 1–5 ยังอยู่ตาม prototype\n\n## ลำดับ Replace\n\n1. SQL Factory: \`${sqlName}\`\n2. Report Factory: \`${reportName}\`\n\nต้อง Replace record เดิมด้วย ID เดิม ห้าม Clone และควร Export backup ก่อน Replace\n\n## Ownership / write gate\n\nLive SQL และ Report มี Created By: Parinya Tumchay จึงไม่ได้ถูก Save/Publish โดย Codex ชุดนี้เตรียมให้ผู้ใช้หรือเจ้าของ artifact ตรวจและ Replace เท่านั้น\n\n## UAT สำคัญ\n\n1. BC profile C1 ต้องเห็น Liver Function Test หนึ่งครั้งและผลย่อย 5 แถว\n2. Electrolyte profile ต้องเห็นชื่อรายการหลักหนึ่งครั้งและผลย่อยตามจริง\n3. Single test ต้องไม่แสดงชื่อซ้ำสองชั้น\n4. MY หลายตำแหน่งต้องยังมีคอลัมน์ตำแหน่งและหัว Test หลักหนึ่งครั้ง\n5. IM / MI-OUT sensitive result ต้องยังปกปิดก่อนยืนยันตัวตน\n6. MLab popup ต้องยังใช้รูปแบบเดิมและปุ่ม 1–5\n`
fs.writeFileSync(path.join(outputDir, 'README_IMPORT_TH.md'), readme)

const checksumLines = [sqlName, reportName, 'README_IMPORT_TH.md'].map(name => {
  const data = fs.readFileSync(path.join(outputDir, name))
  return `${crypto.createHash('sha256').update(data).digest('hex')}  ${name}`
})
fs.writeFileSync(path.join(outputDir, 'checksums.sha256'), checksumLines.join('\n') + '\n')

console.log(`Wrote replacement package: ${outputDir}`)
