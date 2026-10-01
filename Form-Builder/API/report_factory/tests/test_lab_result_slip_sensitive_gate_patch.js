#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.join(__dirname, '../../../..')
const SCRIPT = path.join(ROOT, 'Form-Builder/API/report_factory/builders/patch_lab_result_slip_sensitive_gate.js')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-result-gate-'))
const input = path.join(dir, 'input.json')
const output = path.join(dir, 'output.json')

fs.writeFileSync(input, JSON.stringify({
  _id: '6ab0a1c4d0c3ef2e97911e55',
  sql_name: 'lab_result_slip',
  nosql_collections: '["zdata_lab_report_manual_entry"]',
  nosql_pipeline: JSON.stringify([
    { $match: { xrstatx: 1, selected_report: '{{xparentx}}' } },
    {
      $lookup: {
        from: 'zdata_lab_result_item',
        let: { rid: '$xparentx' },
        pipeline: [
          { $match: { $expr: { $eq: ['$xparentx', '$$rid'] } } },
          { $project: { _id: 1, test_name: 1, result_value: 1, units: 1, interpretation_code: 1, ref_range: 1, result_comment: 1 } },
        ],
        as: '_items',
      },
    },
    { $unwind: { path: '$_items', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: '$_items._id',
        test_name: '$_items.test_name',
        result_value: '$_items.result_value',
        unit: '$_items.units',
        result_unit: { $concat: ['$_items.result_value', ' ', '$_items.units'] },
        interpretation: '$_items.interpretation_code',
        ref_range: '$_items.ref_range',
        comment_row: '$_items.result_comment',
      },
    },
  ]),
  sql_options: { param: [{ pname: 'xparentx', ptype: 'text', pdefault: null }] },
}), 'utf8')

execFileSync(process.execPath, [SCRIPT, input, output])
const patched = JSON.parse(fs.readFileSync(output, 'utf8'))
const pipeline = JSON.parse(patched.nosql_pipeline)

assert.strictEqual(pipeline[0].$match.selected_report, '{{xparentx}}', 'Result Report selector stays first')

const itemLookup = pipeline.find(stage => stage.$lookup && stage.$lookup.as === '_items').$lookup
assert.strictEqual(itemLookup.let.report_id, '$xparentx')
const itemMatchJson = JSON.stringify(itemLookup.pipeline.find(stage => stage.$match))
assert(itemMatchJson.includes('result_report_id'), 'legacy/manual rows may use result_report_id')
assert(itemMatchJson.includes('$xparentx'), 'normal rows may use xparentx')
assert(!itemMatchJson.includes('order_no'), 'report.order_no must never expand Result Items')
assert.strictEqual(itemLookup.pipeline.find(stage => stage.$project).$project.order_no, 1)
assert.strictEqual(itemLookup.pipeline.find(stage => stage.$project).$project.result_report_id, 1)

const orderItemLookup = pipeline.find(stage => stage.$lookup && stage.$lookup.as === '_sensitive_gate_order_item').$lookup
assert.strictEqual(orderItemLookup.from, 'zdata_cpoe_order_item')
assert.strictEqual(orderItemLookup.let.row_order_item_id.$toString, '$_items.order_no')
assert.strictEqual(orderItemLookup.pipeline.find(stage => stage.$project).$project.parent_order_id, '$order_id.value')
assert.strictEqual(orderItemLookup.pipeline.find(stage => stage.$project).$project.item_data_id, 1)

const masterLookup = pipeline.find(stage => stage.$lookup && stage.$lookup.as === '_sensitive_gate_master').$lookup
assert.strictEqual(masterLookup.from, 'zdata_master_item_order')
assert.strictEqual(masterLookup.let.item_data_id, '$_sensitive_gate_order_item_row.item_data_id')

const grantLookup = pipeline.find(stage => stage.$lookup && stage.$lookup.as === '_sensitive_gate_grant').$lookup
assert.strictEqual(grantLookup.from, 'zdata_emr_sensitive_access_grant')
assert.strictEqual(grantLookup.let.parent_order_id.$toString, '$_sensitive_gate_order_item_row.parent_order_id')
assert.strictEqual(grantLookup.let.requested_token.$trim.input, '{{grant_token}}')
assert(JSON.stringify(grantLookup.pipeline).includes('source_order_id'))

assert(!pipeline.some(stage => stage.$match && JSON.stringify(stage).includes('_sensitive_gate_required')), 'PDF must not be blocked as a whole')
assert(pipeline.some(stage => stage.$addFields && stage.$addFields._sensitive_gate_redact_current), 'each Result Item calculates redaction independently')

const finalProject = pipeline[pipeline.length - 1].$project
for (const field of ['result_value', 'unit', 'result_unit', 'interpretation', 'ref_range', 'comment_row']) {
  assert.deepStrictEqual(finalProject[field].$cond.slice(0, 2), ['$_sensitive_gate_redact_current', ''], field + ' must be blank while locked')
}
assert.strictEqual(finalProject.test_name, '$_items.test_name', 'test name remains visible')
assert.strictEqual(finalProject.sensitive_redacted, '$_sensitive_gate_redact_current')

const tokenParam = patched.sql_options.param.find(param => param.pname === 'grant_token')
assert(tokenParam, 'SQL accepts the hidden caller grant token')
assert.strictEqual(tokenParam.pdefault, '', 'grant token must be optional')
assert(JSON.parse(patched.nosql_collections).includes('zdata_emr_sensitive_access_grant'))
assert(patched.sql_note.includes('EMR_SENSITIVE_RESULT_REPORT_ROW_GATE_V3'))

console.log('LAB Result-Report-scoped Sensitive gate patch test passed')
