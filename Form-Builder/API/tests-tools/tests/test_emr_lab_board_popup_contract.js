#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../../../..')
const PROCESS = path.join(ROOT, 'Form-Builder/API/api-factory/processes/emr-lab-board-get.js')
const source = fs.readFileSync(PROCESS, 'utf8')

assert.match(source, /\[1, 5, 10\]\.indexOf\(requestedHistoryLimit\)/, 'API must allow only 1/5/10 history counts')
assert.match(source, /requestedHistoryLimit : 5/, 'API must retain five as the default for existing consumers')
assert.strictEqual((source.match(/\.slice\(0, historyLimit\)/g) || []).length, 2, 'both history serialization paths must respect history_limit')
assert.match(source, /projection: \{ order_number: 1, order_comment: 1, created_at: 1/, 'CPOE Order comment must be projected')
assert.match(source, /order_note: 1/, 'Result Report/LIS Order comment must be projected')
assert.match(source, /reportOrderNotes = uniq/, 'Result Report/LIS Order comments must be deduplicated')
assert.match(source, /g\.order_comment = reportOrderNotes\.join\('\\n'\)/, 'Result Report/LIS Order comment must override the CPOE fallback without losing line breaks')
assert.match(source, /order_comment: g\.order_comment \|\| ''/, 'LAB order response must expose the Order comment')
assert.match(source, /history_limit: historyLimit/, 'response must report the applied history limit')

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
assert.doesNotThrow(() => new AsyncFunction('params', 'userInfo', 'app', source), 'API Factory process body must parse as an async function')

console.log('ok - EMR LAB board exposes configurable history and Order comments')
