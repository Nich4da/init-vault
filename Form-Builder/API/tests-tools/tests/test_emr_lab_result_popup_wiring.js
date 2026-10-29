#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../../../..')
const POPUP_FORM_ID = '6ad789a39291822e416c02e7'

const targets = [
  {
    event: 'Form-Builder/API/form-factory/events/emr-history-onCreated-FULL-v1.js',
    // Updated 2026-10-22: v4 is the user-approved combined X-ray/LAB redesign.
    // The assertion still protects exact paste-ready parity; only the version pointer changed.
    replacement: '02-his/form-factory/emr-history-onCreated-FULL-v4-REPLACE.txt',
    template: '02-his/form-factory/emr-history-template-FULL-v1.html',
    templateText: '02-his/form-factory/emr-history-template-FULL-v1.txt',
    handler: 'ehLabOpenResultForm',
    visitKey: 'ehVisit',
  },
  {
    event: 'Form-Builder/API/form-factory/events/treat-summary-onCreated-FULL-v1.js',
    replacement: '02-his/form-factory/treat-summary-onCreated-FULL-v3-REPLACE.txt',
    template: '02-his/form-factory/treat-summary-template-FULL-v1.html',
    templateText: '02-his/form-factory/treat-summary-template-FULL-v1.txt',
    handler: 'tsOpenResultForm',
    visitKey: 'tsVisit',
  },
]

for (const target of targets) {
  const event = fs.readFileSync(path.join(ROOT, target.event), 'utf8')
  const replacement = fs.readFileSync(path.join(ROOT, target.replacement), 'utf8')
  const template = fs.readFileSync(path.join(ROOT, target.template), 'utf8')
  const templateText = fs.readFileSync(path.join(ROOT, target.templateText), 'utf8')

  assert.strictEqual(replacement, event, `${target.replacement} must mirror the paste-ready event source`)
  assert.strictEqual(templateText, template, `${target.templateText} must mirror its HTML source`)
  assert(event.includes(POPUP_FORM_ID), `${target.event} must target the user-owned LAB result popup form`)
  assert(template.includes(`@click.stop="${target.handler}(o)"`), `${target.template} must route the LAB whole-result button to the new form`)

  const opened = []
  const form = {
    formParams: { xsitex: 'SITE-1', xunitx: 'UNIT-1' },
    openForm(...args) { opened.push(args) },
    subFormClose() {},
    userState: {},
  }
  const context = {
    vueState: { tsLoad() {} },
    getFormRef: () => form,
    notify() {},
  }
  new Function(event).call(context)
  context.vueState[target.visitKey] = { visit_id: 'VISIT-1' }
  context.vueState[target.handler]({
    source_order_id: 'ORDER-1',
    section_code: 'BC',
    lab_no: 'LAB-1',
    rows: [{ name: 'BUN' }],
    _raw: {},
  })

  assert.strictEqual(opened.length, 1, `${target.handler} must open exactly one form`)
  assert.strictEqual(opened[0][0], POPUP_FORM_ID)
  assert.strictEqual(opened[0][1], '', 'UI popup must not open a CRUD data record')
  assert.deepStrictEqual(opened[0][3], {
    xsitex: 'SITE-1',
    xunitx: 'UNIT-1',
    visit_id: 'VISIT-1',
    source_order_id: 'ORDER-1',
    section_code: 'BC',
    lab_no: 'LAB-1',
  })
  assert.strictEqual(opened[0][4].readonly, true)
  assert.deepStrictEqual(opened[0][4].params, opened[0][3])
}

console.log('ok - EMR LAB whole-result buttons open the shared history-table form only')
