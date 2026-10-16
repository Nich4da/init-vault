#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const apiPath = path.join(root, 'Form-Builder/API/api-factory/processes/xray_cpoe_worklist_api.js')
const source = fs.readFileSync(apiPath, 'utf8')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

new AsyncFunction('params', source)

assert(!source.includes('zdata_xray_queue'), 'the X-ray API must not depend on a separate queue collection')
assert(!source.includes('XRAY_QUEUE_SOURCE'), 'the X-ray API must not create Visit Tran projections')
assert(!source.includes("action === 'queue'"), 'the retired X-ray queue adapter is removed')
assert(!source.includes('queueVisitPipeline'), 'the Worklist no longer builds a parallel queue view')
assert(!source.includes('queueBucketName'))
assert(!source.includes('queue_source: VISIT_TRAN_COLLECTION'))
assert(!source.includes("action === 'queue_call'"), 'central EMR processes own queue calling')
assert(!source.includes("action === 'queue_reassign'"), 'central EMR forms own room transfer')
assert(!source.includes("action === 'queue_done'"), 'central EMR processes own completion')
assert(!source.includes("action === 'queue_targets'"), 'there is no X-ray routing directory')
assert(!source.includes('_called_queue'), 'the Worklist is not gated by an X-ray queue')

const listStart = source.indexOf('/* ── action: list')
const listEnd = source.indexOf('let aggregateRows', listStart)
assert(listStart >= 0 && listEnd > listStart, 'list pipeline is present')
const listSource = source.slice(listStart, listEnd)
assert(!listSource.includes('VISIT_TRAN_COLLECTION'),
  'normal Orders enter Worklist independently of whether Finance or an exam room sent a queue')
assert(listSource.includes("'service_type.value': XRAY_SERVICE_TYPE"),
  'normal Worklist visibility remains driven by X-ray Order items')

assert(source.includes("current_status: { $in: statusVocabulary }"),
  'the established Worklist vocabulary gate remains')
assert(source.includes("const RECEIVED_STATUSES = ['accepted', 'prepared', 'dispensed', 'dispatched', 'in_progress']"),
  'Worklist/Accession dispatch semantics remain unchanged')
assert(source.includes("const RESULT_COLLECTION = 'zdata_xray_result'"),
  'RIS result integration remains unchanged')
assert(source.includes("if (action === 'resolve_open_visit')"),
  'existing patient/visit resolution remains')
assert(source.includes("if (action === 'get_report')"),
  'existing result lookup remains')

console.log('ok - X-ray Worklist API contains no queue adapter; native EMR panes own the queue flow')
