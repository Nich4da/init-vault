#!/usr/bin/env node
'use strict'

const fs = require('fs')

const [sqlPath, reportPath] = process.argv.slice(2)
if (!sqlPath || !reportPath) throw new Error('Usage: node test_lab_result_profile_group_replace.js SQL_JSON REPORT_JSON')

const one = filename => {
  const parsed = JSON.parse(fs.readFileSync(filename, 'utf8'))
  return Array.isArray(parsed) ? parsed[0] : parsed
}

const sql = one(sqlPath)
const report = one(reportPath)
const pipeline = JSON.parse(sql.nosql_pipeline)
const resultLookup = pipeline.find(stage => stage.$lookup?.from === 'zdata_lab_result_item')?.$lookup
const window = resultLookup?.pipeline?.find(stage => stage.$setWindowFields)?.$setWindowFields
if (!window) throw new Error('Missing result-item window stage')
if (window.partitionBy !== '$order_no') throw new Error('Profile partition must use order_no')
if (!window.output?._profile_row_no?.$documentNumber) throw new Error('Missing profile row number')
if (!window.output?._profile_count?.$count) throw new Error('Missing profile count')

const finalProject = [...pipeline].reverse().find(stage => stage.$project)?.$project
if (!finalProject?.parent_test_name) throw new Error('Missing parent_test_name projection')
if (!finalProject?.profile_header_row) throw new Error('Missing profile_header_row projection')
if (!sql.sql_options.variable.some(row => row.vname === 'profile_header_row')) throw new Error('Missing profile_header_row SQL variable')

const rowTemplate = report.pdf_column?.[0]?.col_value || ''
if (!rowTemplate.includes('<tbody>{{profile_header_row}}<tr>')) throw new Error('Report row template does not render profile header')
if ((rowTemplate.match(/\{\{profile_header_row\}\}/g) || []).length !== 1) throw new Error('Profile header must render exactly once per SQL row')
if (!rowTemplate.includes('{{site_cell}}')) throw new Error('MY site column binding was lost')
if (!rowTemplate.includes('{{comment_row}}')) throw new Error('Test comment binding was lost')
if (report.pdf_params.some(row => row.param_var === 'grant_token')) throw new Error('Sensitive grant token must not become a visible report parameter')

console.log('LAB result profile/group replacement contract: PASS')
