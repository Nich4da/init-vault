#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../../../..')
const formPath = path.join(ROOT, 'Form-Builder/SDForm/form-factory/forms/emr-sensitive-access-log-v1.json')
const form = JSON.parse(fs.readFileSync(formPath, 'utf8'))

assert.strictEqual(form.fields.length, 1)
assert.strictEqual(form.fields[0].component, 'grid')

const widgets = []
const walk = fields => {
  for (const field of fields || []) {
    if (field.formItemFlag) widgets.push(field)
    walk(field.fields)
    for (const col of field.cols || []) walk(col.fields)
  }
}
walk(form.fields)

const expected = [
  'event_at', 'action', 'outcome', 'reason_code', 'username', 'roles_snapshot',
  'authorized_by_username', 'authorized_by_roles_snapshot', 'purpose', 'source',
  'screen', 'site', 'unit', 'visit_id', 'source_order_id', 'item_id', 'item_code',
  'revision_id', 'request_id', 'event_id', 'user_id', 'authorized_by_user_id',
  'patient_id', 'master_id', 'master_updated_at', 'sensitive', 'xrstatx',
]
assert.deepStrictEqual(widgets.map(field => field.options.name), expected)
assert.strictEqual(new Set(widgets.map(field => field.options.name)).size, widgets.length)
assert(widgets.every(field => field.options.readonly === true), 'audit fields must be read-only')
assert(widgets.every(field => field.options.required === false), 'raw audit events include denied requests with partial context')

const forbidden = ['password', 'password_hash', 'grant_token', 'sensitive_grant_token', 'result_value', 'result_comment', 'attachment_url']
for (const name of forbidden) {
  assert(!widgets.some(field => field.options.name === name), 'forbidden audit field: ' + name)
}

for (const field of widgets) {
  for (const eventName of ['onCreated', 'onMounted', 'onUnmount', 'onInput', 'onChange', 'onFocus', 'onBlur', 'onValidate']) {
    if (Object.prototype.hasOwnProperty.call(field.options, eventName)) {
      assert.strictEqual(field.options[eventName], '', `${field.options.name}.${eventName} must not mutate audit records`)
    }
  }
}

assert.strictEqual(form.formConfig.onFormCreated, '')
assert.strictEqual(form.formConfig.onFormMounted, '')
assert.strictEqual(form.formConfig.onFormDataChange, '')

console.log('EMR Sensitive Access Log form contract test passed')
