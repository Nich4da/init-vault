#!/usr/bin/env node
'use strict'

/*
 * Build the read-only SDForm schema for zdata_emr_sensitive_access_log.
 * Widgets and containers are cloned from verified system-exported forms; no
 * widget options are authored from scratch.
 *
 * Usage:
 *   node build_emr_sensitive_access_log_form.js OUTPUT.json
 */

const fs = require('fs')
const path = require('path')

const outputPath = process.argv[2]
if (!outputPath) throw new Error('Usage: node build_emr_sensitive_access_log_form.js OUTPUT.json')

const ROOT = path.join(__dirname, '../../../..')
const person = JSON.parse(fs.readFileSync(path.join(ROOT, 'Form-Builder/SDForm/form-factory/forms/person.json'), 'utf8'))
const disease = JSON.parse(fs.readFileSync(path.join(ROOT, 'Form-Builder/SDForm/form-factory/forms/disease.json'), 'utf8'))
const clone = value => JSON.parse(JSON.stringify(value))

const allWidgets = []
const collect = fields => {
  for (const field of fields || []) {
    allWidgets.push(field)
    collect(field.fields)
    for (const col of field.cols || []) {
      allWidgets.push(col)
      collect(col.fields)
    }
  }
}
collect(person.fields)
collect(disease.fields)

const template = (component, predicate = () => true) => {
  const found = allWidgets.find(field => field.component === component && predicate(field))
  if (!found) throw new Error('verified template not found: ' + component)
  return found
}

const textTemplate = template('text-input', field =>
  field.options && field.options.onValidate === '' && field.options.onChange === ''
)
const tagsTemplate = template('tags-input', field =>
  field.options && field.options.onValidate === '' && field.options.onChange === ''
)
const textareaTemplate = template('textarea-input', field =>
  field.options && field.options.onValidate === '' && field.options.onChange === ''
)
const rootGridTemplate = disease.fields.find(field => field.component === 'grid' && Array.isArray(field.cols) && field.cols.length)
if (!rootGridTemplate) throw new Error('verified root grid template not found')
const gridColTemplate = rootGridTemplate.cols[0]

let sequence = 86000
const next = () => ++sequence

const makeWidget = spec => {
  const base = spec.type === 'tags' ? tagsTemplate : spec.type === 'textarea' ? textareaTemplate : textTemplate
  const field = clone(base)
  const n = next()
  field.key = n
  field.id = `${field.component}-emr-sensitive-access-log-${n}`
  field.options.name = spec.name
  field.options.label = spec.label
  field.options.defaultValue = null
  field.options.columnSpan = spec.span
  field.options.readonly = true
  field.options.required = false
  field.options.requiredHint = ''
  field.options.hidden = spec.hidden === true
  field.options.placeholder = ''
  return field
}

const makeColumn = spec => {
  const col = clone(gridColTemplate)
  const n = next()
  col.key = n
  col.id = `grid-col-emr-sensitive-access-log-${n}`
  col.fields = [makeWidget(spec)]
  col.options.name = `${spec.name}_col`
  col.options.hidden = spec.hidden === true
  col.options.span = spec.span
  col.options.md = spec.span
  col.options.sm = spec.span === 6 ? 12 : 24
  col.options.xs = 24
  return col
}

const fields = [
  { name: 'event_at', label: 'วันเวลาที่ขอดูผล', span: 6 },
  { name: 'action', label: 'การดำเนินการ', span: 6 },
  { name: 'outcome', label: 'ผลการยืนยัน', span: 6 },
  { name: 'reason_code', label: 'รหัสเหตุผล', span: 6 },
  { name: 'username', label: 'ผู้ใช้งานที่ขอดูผล', span: 6 },
  { name: 'roles_snapshot', label: 'สิทธิ์ผู้ขอดู ณ เวลานั้น', type: 'tags', span: 6 },
  { name: 'authorized_by_username', label: 'บัญชีแพทย์ที่ยืนยัน', span: 6 },
  { name: 'authorized_by_roles_snapshot', label: 'สิทธิ์ผู้ยืนยัน ณ เวลานั้น', type: 'tags', span: 6 },
  { name: 'purpose', label: 'วัตถุประสงค์การขอดูผล', type: 'textarea', span: 12 },
  { name: 'source', label: 'แหล่งที่มา', span: 6 },
  { name: 'screen', label: 'หน้าจอที่ขอดู', span: 6 },
  { name: 'site', label: 'Site ณ เวลาที่ขอดู', type: 'textarea', span: 12 },
  { name: 'unit', label: 'หน่วยงาน ณ เวลาที่ขอดู', type: 'textarea', span: 12 },
  { name: 'visit_id', label: 'Visit ID', span: 6 },
  { name: 'source_order_id', label: 'Parent Order ID', span: 6 },
  { name: 'item_id', label: 'CPOE Order Item ID', span: 6 },
  { name: 'item_code', label: 'รหัสรายการตรวจ', span: 6 },
  { name: 'revision_id', label: 'Result Revision ID', span: 6 },
  { name: 'request_id', label: 'Request ID', span: 6 },
  { name: 'event_id', label: 'Event ID', span: 6, hidden: true },
  { name: 'user_id', label: 'User ID ผู้ขอดู', span: 6, hidden: true },
  { name: 'authorized_by_user_id', label: 'User ID ผู้ยืนยัน', span: 6, hidden: true },
  { name: 'patient_id', label: 'Patient ID', span: 6, hidden: true },
  { name: 'master_id', label: 'Item Master ID', span: 6, hidden: true },
  { name: 'master_updated_at', label: 'Master Updated At', span: 6, hidden: true },
  { name: 'sensitive', label: 'Sensitive', span: 6, hidden: true },
  { name: 'xrstatx', label: 'Record Status', span: 6, hidden: true },
]

const rootGrid = clone(rootGridTemplate)
rootGrid.key = next()
rootGrid.id = 'grid-emr-sensitive-access-log-v1'
rootGrid.options.name = 'emr_sensitive_access_log_v1_root'
rootGrid.options.hidden = false
rootGrid.cols = fields.map(makeColumn)

const output = {
  fields: [rootGrid],
  formConfig: clone(disease.formConfig),
}

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n')
console.log('Wrote EMR Sensitive Access Log form:', outputPath)
