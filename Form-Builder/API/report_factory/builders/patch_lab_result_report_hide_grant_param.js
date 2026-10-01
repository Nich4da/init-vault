#!/usr/bin/env node
'use strict'

/*
 * Remove only the visible grant_token row from Report Factory `Lab result`.
 * The SQL provider still accepts grant_token from the EMR caller.
 *
 * Usage:
 *   node patch_lab_result_report_hide_grant_param.js INPUT.json OUTPUT.json
 */

const fs = require('fs')

const REPORT_ID = '6aa8f5a8b92813319a86ea11'
const inputPath = process.argv[2]
const outputPath = process.argv[3]

if (!inputPath || !outputPath) {
  throw new Error('Usage: node patch_lab_result_report_hide_grant_param.js INPUT.json OUTPUT.json')
}

const source = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const records = Array.isArray(source) ? source : Array.isArray(source.data) ? source.data : [source]
const report = records.find(row => {
  const id = row && row._id && (row._id.$oid || row._id)
  return String(id || '') === REPORT_ID
})
if (!report) throw new Error('Lab result Report Factory record not found: ' + REPORT_ID)
if (report.pdf_name !== 'Lab result') throw new Error('unexpected report name for ' + REPORT_ID)
if (!Array.isArray(report.pdf_params)) throw new Error('Lab result pdf_params is missing')

const before = JSON.stringify(report.pdf_params)
const grantRows = report.pdf_params.filter(row => row && row.param_var === 'grant_token')
if (grantRows.length !== 1) {
  throw new Error('expected exactly one visible grant_token parameter, found ' + grantRows.length)
}

report.pdf_params = report.pdf_params.filter(row => !row || row.param_var !== 'grant_token')
if (!report.pdf_params.some(row => row && row.param_var === 'xparentx')) {
  throw new Error('xparentx Result Report selector must remain visible')
}
if (before === JSON.stringify(report.pdf_params)) throw new Error('grant_token parameter was not removed')

const output = Array.isArray(source) ? records : Array.isArray(source.data) ? { ...source, data: records } : report
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n')
console.log('Wrote Lab result report without visible grant_token:', outputPath)
