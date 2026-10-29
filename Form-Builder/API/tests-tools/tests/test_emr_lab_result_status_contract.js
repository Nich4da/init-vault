#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../../../..')
const PROCESS = path.join(ROOT, 'Form-Builder/API/api-factory/processes/emr-lab-board-get.js')
const REPLACEMENT = path.join(ROOT, 'Form-Builder/API/api-factory/processes/emr-lab-board-get-v2-REPLACE.js')
const source = fs.readFileSync(PROCESS, 'utf8')
const replacementSource = fs.readFileSync(REPLACEMENT, 'utf8')

assert.strictEqual(replacementSource, source, 'paste-ready replacement must exactly match the verified local process')

assert.match(source, /const RESULT_REVISION_TABLE = 'zdata_lab_result_revision_log'/, 'API must read the append-only result revision log')
assert.match(source, /report_seq: 1, stage: 1, agent_overall_status: 1, internal_overall_status: 1/, 'Report projection must include stage and sequence metadata')
assert.match(source, /change_kind: 1, receipt_seq: 1, previous_value: 1/, 'Result projection must include version/correction metadata')
assert.match(source, /is_critical: criticalDecision\(r\.is_critical\)/, 'Result rows must expose tri-state critical decision')
assert.match(source, /critical_state: criticalState\(r\.is_critical\)/, 'Result rows must expose an explicit critical state')
assert.match(source, /critical_summary_complete: !hasProtected/, 'Order critical summary must disclose when protected rows make it incomplete')
assert.match(source, /obx_status: String\(r\.obx_status \|\| ''\)/, 'Result rows must expose OBX status')
assert.match(source, /result_version: String\(r\.result_version \|\| ''\)/, 'Result rows must expose result version')
assert.match(source, /change_kind: String\(r\.change_kind \|\| ''\)/, 'Result rows must expose change kind')
assert.match(source, /report_history: reportHistory/, 'Order response must expose report metadata history')
assert.match(source, /revision_history: revisionHistory/, 'Order response must expose sanitized correction history')
assert.match(source, /result_stage: currentReport \? currentReport\.stage : ''/, 'Order response must expose the current report stage')
assert.match(source, /correction_summary:/, 'Order response must expose a correction summary')
assert.match(source, /cpoe_order_comment: g\.cpoe_order_comment \|\| ''/, 'CPOE Order comment must remain separate')
assert.match(source, /result_order_note: \(g\.result_order_notes \|\| \[\]\)\.join\('\\n'\)/, 'Result Report note must remain separate')
assert.match(source, /ordered_item_comment: String\(policy\.item_comment \|\| ''\)/, 'Ordered Test comment must remain separate')
assert.match(source, /result_comment: String\(r\.result_comment \|\| ''\)/, 'Result Item comment must remain separate')
assert.match(source, /result_sequence: r\.result_sequence == null \? '' : String\(r\.result_sequence\)/, 'Result sequence must be available to the UI')
assert.match(source, /critical_rule_snapshot:/, 'Critical rule snapshots must be labeled as audit context')
assert.doesNotMatch(source, /items_snapshot_json:\s*1/, 'API must not expose revision result snapshots in its projection')
assert.doesNotMatch(source, /raw_payload_json:\s*1/, 'API must not expose raw LIS payloads in its projection')

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
assert.doesNotThrow(() => new AsyncFunction('params', 'userInfo', 'app', source), 'API Factory process body must parse as an async function')
assert.doesNotThrow(() => new AsyncFunction('params', 'userInfo', 'app', replacementSource), 'replacement must parse as an async API Factory process')

console.log('ok - EMR LAB result status/version/correction contract is additive and sanitized')
