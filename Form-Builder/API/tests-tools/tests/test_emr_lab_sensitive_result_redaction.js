#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../../../..')
const PROCESS = path.join(ROOT, 'Form-Builder/API/api-factory/processes/emr-lab-board-get.js')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

const VISIT_ID = '111111111111111111111111'
const ORDER_ID = '222222222222222222222222'
const REPORT_ID = '333333333333333333333333'

const ids = {
  im2: 'aaaaaaaaaaaaaaaaaaaaaaa1',
  i0058: 'aaaaaaaaaaaaaaaaaaaaaaa2',
  i0059: 'aaaaaaaaaaaaaaaaaaaaaaa3',
  bb543: 'aaaaaaaaaaaaaaaaaaaaaaa4',
  unknown: 'aaaaaaaaaaaaaaaaaaaaaaa5',
  oldIm2: 'aaaaaaaaaaaaaaaaaaaaaaa6',
  oldBb543: 'aaaaaaaaaaaaaaaaaaaaaaa7',
  mIm2: 'bbbbbbbbbbbbbbbbbbbbbbb1',
  mI0058: 'bbbbbbbbbbbbbbbbbbbbbbb2',
  mI0059: 'bbbbbbbbbbbbbbbbbbbbbbb3',
  mBb543: 'bbbbbbbbbbbbbbbbbbbbbbb4',
  mUnknown: 'bbbbbbbbbbbbbbbbbbbbbbb5',
}

const currentItems = [
  { _id: ids.im2, item_data_id: ids.mIm2, item_code: 'IM2', item_name: 'HIV Ag/Ab', is_hide_result: false },
  { _id: ids.i0058, item_data_id: ids.mI0058, item_code: 'I0058', item_name: 'Sensitive test 58' },
  { _id: ids.i0059, item_data_id: ids.mI0059, item_code: 'I0059', item_name: 'Sensitive test 59' },
  { _id: ids.bb543, item_data_id: ids.mBb543, item_code: 'BB543', item_name: 'CBC' },
  { _id: ids.unknown, item_data_id: ids.mUnknown, item_code: 'UNKNOWN', item_name: 'Unresolved policy test' },
].map(item => ({
  ...item,
  order_id: { value: ORDER_ID },
  service_type: { value: 'lab' },
  current_status: { value: 'completed' },
}))

const historyItems = [
  { _id: ids.oldIm2, item_data_id: ids.mIm2, item_code: 'IM2', item_name: 'HIV Ag/Ab' },
  { _id: ids.oldBb543, item_data_id: ids.mBb543, item_code: 'BB543', item_name: 'CBC' },
]

const masters = [
  { _id: ids.mIm2, item_code: 'IM2', item_name: 'HIV Ag/Ab', is_hide_result: true, xrstatx: 1 },
  { _id: ids.mI0058, item_code: 'I0058', item_name: 'Sensitive test 58', is_hide_result: true, xrstatx: 1 },
  { _id: ids.mI0059, item_code: 'I0059', item_name: 'Sensitive test 59', is_hide_result: true, xrstatx: 1 },
  { _id: ids.mBb543, item_code: 'BB543', item_name: 'CBC', xrstatx: 1 },
  // mUnknown จงใจไม่มี เพื่อยืนยัน fail-closed เมื่อ policy resolve ไม่ได้
]

const result = (id, orderNo, obsName, value, sequence, createdAt, reportId = REPORT_ID) => ({
  _id: id,
  hn: 'HN-001',
  visit_id: 'VN-001',
  order_no: orderNo,
  result_report_id: reportId,
  obs_code: obsName.toUpperCase().replace(/\s/g, '-'),
  obs_name: obsName,
  result_value: value,
  result_comment: `comment:${value}`,
  units: 'unit',
  ref_range: 'normal-range',
  interpretation_code: 'H',
  is_critical: true,
  result_status: 'final',
  result_sequence: sequence,
  entered_at: createdAt,
  reported_at: createdAt,
  reported_by_source_name: 'Sensitive Reporter',
  created_at: createdAt,
})

const currentResults = [
  result('ccccccccccccccccccccccc1', ids.im2, 'HIV marker 1', 'secret-im2-a', '01', '2026-09-25 09:01:00'),
  result('ccccccccccccccccccccccc2', ids.im2, 'HIV marker 2', 'secret-im2-b', '02', '2026-09-25 09:02:00'),
  result('ccccccccccccccccccccccc3', ids.i0058, 'Sensitive 58', 'secret-i0058', '03', '2026-09-25 09:03:00'),
  result('ccccccccccccccccccccccc4', ids.i0059, 'Sensitive 59', 'secret-i0059', '04', '2026-09-25 09:04:00'),
  result('ccccccccccccccccccccccc5', ids.bb543, 'CBC', '13.0', '05', '2026-09-25 09:05:00'),
  result('ccccccccccccccccccccccc6', ids.unknown, 'Unknown policy result', 'secret-unresolved', '06', '2026-09-25 09:06:00'),
]

const historyResults = currentResults.concat([
  { ...result('ddddddddddddddddddddddd1', ids.oldIm2, 'HIV marker 1', 'secret-old-im2', '01', '2026-08-01 08:00:00'), visit_id: 'VN-OLD-1' },
  { ...result('ddddddddddddddddddddddd2', ids.oldBb543, 'CBC', '12.0', '01', '2026-08-01 08:00:00'), visit_id: 'VN-OLD-2' },
])

const requestedCollections = []
const dataFor = request => {
  const { collection, query = {} } = request.nosql
  requestedCollections.push(collection)
  if (collection === 'zdata_visit') return [{ _id: VISIT_ID, vn: 'VN-001', visit_date: '2026-09-25 08:00:00', pid: { hn: 'HN-001' } }]
  if (collection === 'zdata_cpoe_order_item') {
    if (query._id) return currentItems.concat(historyItems)
    return currentItems
  }
  if (collection === 'zdata_master_item_order') return masters
  if (collection === 'zdata_cpoe_order') return [{ _id: ORDER_ID, order_number: 'R-001', created_at: '2026-09-25 08:30:00' }]
  if (collection === 'zdata_lab_work_item') {
    return currentItems.map(item => ({
      _id: item._id,
      visit_id: 'VN-001',
      source_order_id: ORDER_ID,
      source_order_number: 'R-001',
      lab_no: 'LAB-001',
      section_code: 'HM',
      section_name: 'Hematology',
      work_status: 'completed',
      received_at: '2026-09-25 08:40:00',
    }))
  }
  if (collection === 'zdata_lab_result_item') {
    if (query.visit_id) return currentResults
    if (query.hn && query.created_at) return currentResults
    if (query.hn) return historyResults
    return []
  }
  if (collection === 'zdata_lab_report_manual_entry') {
    return [{
      _id: REPORT_ID,
      order_no: ids.bb543,
      result_attachments: [{ uid: 'secret-file', name: 'sensitive.pdf', url: '/secret/sensitive.pdf' }],
    }]
  }
  return []
}

const app = {
  dbObjectId: value => value,
  dbFindAll: async request => ({ success: true, reply: { data: dataFor(request) } }),
}

;(async () => {
  const body = fs.readFileSync(PROCESS, 'utf8')
  const run = new AsyncFunction('params', 'userInfo', 'app', body)
  const payload = await run({ visit_id: VISIT_ID, hn: 'HN-001' }, { username: 'doctor.test' }, app)

  assert.strictEqual(payload.lab_orders.length, 1)
  const order = payload.lab_orders[0]
  assert.strictEqual(order.items.length, 5, 'two result rows from one sensitive CPOE Item must collapse to one placeholder')

  const byItemId = Object.fromEntries(order.items.map(item => [item.group_id, item]))
  for (const itemId of [ids.im2, ids.i0058, ids.i0059]) {
    const item = byItemId[itemId]
    assert(item, `missing protected placeholder for ${itemId}`)
    assert.strictEqual(item.visibility.state, 'reauth_required')
    assert.strictEqual(item.visibility.sensitive, true)
    for (const forbidden of ['value', 'text', 'unit', 'ref', 'flag', 'critical', 'result_item_id', 'result_report_id', 'result_comment', 'previous']) {
      assert.strictEqual(Object.prototype.hasOwnProperty.call(item, forbidden), false, `${forbidden} leaked for ${itemId}`)
    }
  }

  const bb543 = byItemId[ids.bb543]
  assert.strictEqual(bb543.visibility.state, 'visible', 'BB543 must remain visible until policy is confirmed')
  assert.strictEqual(bb543.value, '13.0')
  assert.strictEqual(bb543.previous.value, '12.0')

  const unresolved = byItemId[ids.unknown]
  assert.strictEqual(unresolved.visibility.state, 'withheld')
  assert.strictEqual(unresolved.visibility.reason, 'policy_unresolved')
  assert.strictEqual(Object.prototype.hasOwnProperty.call(unresolved, 'value'), false)

  assert.deepStrictEqual(order.result_report_ids, [REPORT_ID], 'server-redacted PDF must remain addressable before re-auth')
  assert.deepStrictEqual(order.attachments, [], 'mixed orders must not expose attachment metadata or URLs')
  assert.strictEqual(requestedCollections.includes('zdata_lab_report_manual_entry'), false, 'protected report surfaces should not be queried for a mixed group')

  const wire = JSON.stringify(payload)
  for (const secret of ['secret-im2-a', 'secret-im2-b', 'secret-i0058', 'secret-i0059', 'secret-old-im2', 'secret-unresolved', '/secret/sensitive.pdf']) {
    assert.strictEqual(wire.includes(secret), false, `response leaked ${secret}`)
  }
  assert.strictEqual(payload.lab_trends.length, 1)
  assert.strictEqual(payload.lab_trends[0].name, 'CBC')
  assert.deepStrictEqual(payload.lab_trends[0].series.map(point => point.value), [12, 13])

  console.log('ok - EMR LAB board redacts current-master Sensitive results before response serialization')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
