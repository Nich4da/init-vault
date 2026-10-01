#!/usr/bin/env node
'use strict'

/*
 * Patch module_sql 6ab0a1c4d0c3ef2e97911e55 (lab_result_slip).
 *
 * Contract:
 * - {{xparentx}} selects one Result Report header.
 * - Result Items belong to that report only when item.xparentx OR
 *   item.result_report_id equals the selected Result Report ID.
 * - report.order_no is never used to expand the Result Item set.
 * - Sensitive state and grant scope are resolved per Result Item:
 *   lab_result_item.order_no -> cpoe_order_item._id -> item_data_id ->
 *   master.is_hide_result, while cpoe_order_item.order_id.value supplies the
 *   parent Order used by the grant check.
 * - grant_token remains an optional, caller-supplied SQL parameter. It must not
 *   be added to the Report Factory record's visible pdf_params.
 *
 * Usage:
 *   node patch_lab_result_slip_sensitive_gate.js INPUT.json OUTPUT.json
 */

const fs = require('fs')

const PROVIDER_ID = '6ab0a1c4d0c3ef2e97911e55'
const MARKER = 'EMR_SENSITIVE_RESULT_REPORT_ROW_GATE_V3'
const LEGACY_MARKERS = ['EMR_SENSITIVE_ROW_REDACTION_V2', 'EMR_SENSITIVE_GRANT_GATE_V1']
const inputPath = process.argv[2]
const outputPath = process.argv[3]

if (!inputPath || !outputPath) {
  throw new Error('Usage: node patch_lab_result_slip_sensitive_gate.js INPUT.json OUTPUT.json')
}

const source = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const records = Array.isArray(source) ? source : Array.isArray(source.data) ? source.data : [source]
const record = records.find(row => {
  const id = row && row._id && (row._id.$oid || row._id)
  return String(id || '') === PROVIDER_ID || row && row.sql_name === 'lab_result_slip'
})
if (!record) throw new Error('lab_result_slip provider not found in export')

let pipeline = typeof record.nosql_pipeline === 'string' ? JSON.parse(record.nosql_pipeline) : record.nosql_pipeline
if (!Array.isArray(pipeline) || !pipeline.length) throw new Error('nosql_pipeline is missing')

// Make the patch repeatable and allow upgrading the earlier V1/V2 proposals.
// Only stages in this patch's private namespace are removed.
pipeline = pipeline.filter(stage => {
  if (stage.$lookup && String(stage.$lookup.as || '').startsWith('_sensitive_gate_')) return false
  if (stage.$addFields && Object.keys(stage.$addFields).some(key => key.startsWith('_sensitive_gate_'))) return false
  return true
})

const itemLookupIndex = pipeline.findIndex(stage =>
  stage.$lookup && stage.$lookup.from === 'zdata_lab_result_item' && stage.$lookup.as === '_items'
)
if (itemLookupIndex < 0) throw new Error('result item lookup (_items) not found')

const itemLookup = pipeline[itemLookupIndex].$lookup
itemLookup.let = { ...(itemLookup.let || {}), report_id: '$xparentx' }
const itemMatch = Array.isArray(itemLookup.pipeline)
  ? itemLookup.pipeline.find(stage => stage.$match)
  : null
if (!itemMatch) throw new Error('result item match stage not found')
itemMatch.$match = {
  $expr: {
    $and: [
      { $eq: ['$xrstatx', 1] },
      {
        $or: [
          { $eq: [{ $toString: '$xparentx' }, { $toString: '$$report_id' }] },
          { $eq: [{ $toString: '$result_report_id' }, { $toString: '$$report_id' }] },
        ],
      },
    ],
  },
}

const itemProject = itemLookup.pipeline.find(stage => stage.$project)
if (!itemProject) throw new Error('result item projection not found')
itemProject.$project.order_no = 1
itemProject.$project.result_report_id = 1

const itemUnwindIndex = pipeline.findIndex((stage, index) =>
  index > itemLookupIndex && stage.$unwind && stage.$unwind.path === '$_items'
)
if (itemUnwindIndex < 0) throw new Error('result item unwind not found')

const rowGateStages = [
  {
    $lookup: {
      from: 'zdata_cpoe_order_item',
      let: { row_order_item_id: { $toString: '$_items.order_no' } },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $ne: ['$$row_order_item_id', ''] },
                { $eq: [{ $toString: '$_id' }, '$$row_order_item_id'] },
              ],
            },
          },
        },
        { $limit: 1 },
        { $project: { _id: 1, item_data_id: 1, parent_order_id: '$order_id.value' } },
      ],
      as: '_sensitive_gate_order_item',
    },
  },
  { $addFields: { _sensitive_gate_order_item_row: { $first: '$_sensitive_gate_order_item' } } },
  {
    $lookup: {
      from: 'zdata_master_item_order',
      let: { item_data_id: '$_sensitive_gate_order_item_row.item_data_id' },
      pipeline: [
        {
          $match: {
            $expr: {
              $eq: [{ $toString: '$_id' }, { $toString: '$$item_data_id' }],
            },
          },
        },
        { $limit: 1 },
        { $project: { _id: 1, is_hide_result: 1 } },
      ],
      as: '_sensitive_gate_master',
    },
  },
  { $addFields: { _sensitive_gate_master_row: { $first: '$_sensitive_gate_master' } } },
  {
    $lookup: {
      from: 'zdata_emr_sensitive_access_grant',
      let: {
        requested_token: { $trim: { input: '{{grant_token}}' } },
        parent_order_id: { $toString: '$_sensitive_gate_order_item_row.parent_order_id' },
        report_section: { $toString: '$lab_section' },
        now_epoch: { $toLong: '$$NOW' },
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $ne: ['$$requested_token', ''] },
                { $eq: ['$grant_token', '$$requested_token'] },
                { $eq: [{ $toString: '$source_order_id' }, '$$parent_order_id'] },
                { $eq: [{ $toString: '$section_code' }, '$$report_section'] },
                { $gte: ['$expires_at_epoch', '$$now_epoch'] },
                { $eq: ['$xrstatx', 1] },
              ],
            },
          },
        },
        { $limit: 1 },
        { $project: { _id: 1 } },
      ],
      as: '_sensitive_gate_grant',
    },
  },
  {
    $addFields: {
      _sensitive_gate_redact_current: {
        $and: [
          { $eq: ['$_sensitive_gate_master_row.is_hide_result', true] },
          { $eq: [{ $size: '$_sensitive_gate_grant' }, 0] },
        ],
      },
    },
  },
]
pipeline.splice(itemUnwindIndex + 1, 0, ...rowGateStages)

const finalProject = [...pipeline].reverse().find(stage => stage.$project)
if (!finalProject) throw new Error('final report projection not found')
for (const field of ['result_value', 'unit', 'result_unit', 'interpretation', 'ref_range', 'comment_row']) {
  if (!Object.prototype.hasOwnProperty.call(finalProject.$project, field)) {
    throw new Error('expected report field is missing: ' + field)
  }
  const current = finalProject.$project[field]
  const unwrapped = current && current.$cond && current.$cond[0] === '$_sensitive_gate_redact_current'
    ? current.$cond[2]
    : current
  finalProject.$project[field] = { $cond: ['$_sensitive_gate_redact_current', '', unwrapped] }
}
finalProject.$project.sensitive_redacted = '$_sensitive_gate_redact_current'
record.nosql_pipeline = JSON.stringify(pipeline)

const collections = new Set(JSON.parse(record.nosql_collections || '[]'))
for (const name of [
  'zdata_lab_result_item',
  'zdata_cpoe_order_item',
  'zdata_master_item_order',
  'zdata_emr_sensitive_access_grant',
]) collections.add(name)
record.nosql_collections = JSON.stringify(Array.from(collections))

record.sql_options = record.sql_options && typeof record.sql_options === 'object' ? record.sql_options : {}
record.sql_options.param = Array.isArray(record.sql_options.param) ? record.sql_options.param : []
const tokenParam = record.sql_options.param.find(param => param && param.pname === 'grant_token')
if (tokenParam) {
  tokenParam.ptype = 'text'
  tokenParam.pdefault = ''
} else {
  record.sql_options.param.push({ pname: 'grant_token', ptype: 'text', pdefault: '' })
}

record.sql_note = String(record.sql_note || '')
  .split('\n')
  .filter(line => !LEGACY_MARKERS.some(marker => line.includes(marker)) && !line.includes(MARKER))
  .concat(MARKER + ': Result Items use Result Report ID only; Sensitive grants use each row\'s parent CPOE Order.')
  .filter(Boolean)
  .join('\n')

const output = Array.isArray(source) ? records : Array.isArray(source.data) ? { ...source, data: records } : record
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n')
console.log('Wrote Result-Report-scoped lab_result_slip provider:', outputPath)
