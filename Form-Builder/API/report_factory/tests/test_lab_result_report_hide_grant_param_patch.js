#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.join(__dirname, '../../../..')
const SCRIPT = path.join(ROOT, 'Form-Builder/API/report_factory/builders/patch_lab_result_report_hide_grant_param.js')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-report-params-'))
const input = path.join(dir, 'input.json')
const output = path.join(dir, 'output.json')

const xparentx = {
  param_var: 'xparentx',
  param_label: 'Lab report (xparentx)',
  param_default: 'sample-report-id',
  param_required: true,
}
const grant = {
  param_var: 'grant_token',
  param_label: 'Sensitive access grant',
  param_default: null,
  param_required: false,
}
const source = {
  _id: '6aa8f5a8b92813319a86ea11',
  pdf_name: 'Lab result',
  pdf_sql: { value: '6ab0a1c4d0c3ef2e97911e55', label: 'lab_result_slip' },
  pdf_content: [{ element: 'unchanged' }],
  pdf_params: [xparentx, grant],
  unrelated: { keep: true },
}
fs.writeFileSync(input, JSON.stringify(source), 'utf8')

execFileSync(process.execPath, [SCRIPT, input, output])
const patched = JSON.parse(fs.readFileSync(output, 'utf8'))
assert.deepStrictEqual(patched.pdf_params, [xparentx], 'only visible grant_token is removed')
assert.deepStrictEqual(patched.pdf_sql, source.pdf_sql)
assert.deepStrictEqual(patched.pdf_content, source.pdf_content)
assert.deepStrictEqual(patched.unrelated, source.unrelated)

console.log('Lab result visible grant parameter patch test passed')
