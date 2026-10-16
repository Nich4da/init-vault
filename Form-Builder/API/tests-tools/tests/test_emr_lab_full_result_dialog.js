const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../../../..')
const PROCESS = path.join(ROOT, 'Form-Builder/API/api-factory/processes/emr-lab-board-get.js')
const EVENTS = [
  path.join(ROOT, 'Form-Builder/API/form-factory/events/treat-summary-onCreated-FULL-v1.js'),
  path.join(ROOT, 'Form-Builder/API/form-factory/events/treat-summary-lab-xray-oncreated-v1.js'),
]
const TEMPLATES = [
  path.join(ROOT, '02-his/form-factory/treat-summary-template-FULL-v1.html'),
  path.join(ROOT, '02-his/form-factory/treat-summary-lab-xray-template-v1.html'),
]

const VISIT_ID = '222222222222222222222222'
const ORDER_ID = '333333333333333333333333'
const ITEM_ID = '444444444444444444444444'
const MASTER_ID = '999999999999999999999999'
const PREVIOUS_ITEM_ID = '888888888888888888888888'
const CURRENT_RESULT_ID = '555555555555555555555555'
const PREVIOUS_RESULT_ID = '666666666666666666666666'
const REPORT_ID = '777777777777777777777777'

const currentResult = {
  _id: CURRENT_RESULT_ID,
  hn: '6900023',
  visit_id: '6900317',
  order_no: ITEM_ID,
  filler_order_no: '226909240001',
  result_report_id: REPORT_ID,
  obs_code: '220102EB',
  obs_name: 'Hb F',
  result_value: '2.0',
  result_comment: 'Comment from LIS',
  units: '%',
  ref_range: '0-1.2',
  interpretation_code: 'H',
  result_status: 'final',
  entered_at: '2026-09-24 15:30:43',
  created_at: '2026-09-24 15:30:43',
}

const previousResult = {
  _id: PREVIOUS_RESULT_ID,
  hn: '6900023',
  visit_id: '6800999',
  order_no: PREVIOUS_ITEM_ID,
  obs_code: '220102EB',
  obs_name: 'Hb F',
  result_value: '1.0',
  units: '%',
  ref_range: '0-1.2',
  interpretation_code: 'N',
  result_status: 'final',
  entered_at: '2026-08-01 10:00:00',
  created_at: '2026-08-01 10:00:00',
}

const report = {
  _id: REPORT_ID,
  order_no: ITEM_ID,
  reported_at: '2026-09-24 15:30:43',
  reported_by_source_name: 'ทนพญ.ปรัศนีย์ บุญภิญโญ ท.น.15190',
  verified_at: '2026-09-24 15:30:43',
  verified_by_source_name: 'ทนพญ.ปรัศนีย์ บุญภิญโญ ท.น.15190',
  result_attachments: [{ uid: 'file-1', name: 'hemoglobin.pdf', url: '/files/hemoglobin.pdf', size: 1024 }],
}

let activeSectionCode = 'HM'
let activeSectionName = 'Hematology'
let activeCurrentResults = [currentResult]
let activeHistoryResults = [currentResult, previousResult]

const dataFor = request => {
  const { collection, query = {} } = request.nosql
  if (collection === 'zdata_visit') return [{ _id: VISIT_ID, vn: '6900317', visit_date: '2026-09-24 08:00:00', pid: { hn: '6900023', prename: { label: 'ด.ช.' }, p_fname: 'ทดสอบ', p_lname: 'ระบบ' } }]
  if (collection === 'zdata_cpoe_order_item') {
    if (query._id) return [
      { _id: ITEM_ID, item_data_id: MASTER_ID, item_code: 'HB-TYPE', item_name: 'Hemoglobin typing' },
      { _id: PREVIOUS_ITEM_ID, item_data_id: MASTER_ID, item_code: 'HB-TYPE', item_name: 'Hemoglobin typing' },
    ]
    return [{ _id: ITEM_ID, order_id: { value: ORDER_ID }, service_type: { value: 'lab' }, item_data_id: MASTER_ID, item_code: 'HB-TYPE', item_name: 'Hemoglobin typing', current_status: { value: 'completed' }, lab_data: { spec_source: 'Clotted blood', specimen_at: '2026-09-24 15:07:00' } }]
  }
  if (collection === 'zdata_master_item_order') return [{ _id: MASTER_ID, item_code: 'HB-TYPE', item_name: 'Hemoglobin typing', is_hide_result: false, xrstatx: 1 }]
  if (collection === 'zdata_cpoe_order') return [{ _id: ORDER_ID, order_number: 'R2609240004', created_at: '2026-09-24 15:05:00' }]
  if (collection === 'zdata_lab_work_item') return [{ _id: ITEM_ID, source_order_id: ORDER_ID, source_order_number: 'R2609240004', visit_id: '6900317', lab_no: '226909240001', section_code: activeSectionCode, section_name: activeSectionName, work_status: 'completed', received_at: '2026-09-24 15:10:00', patient_name: 'ด.ช. ทดสอบ ระบบ', specimen_json: JSON.stringify({ name: 'Clotted blood', collected_at: '2026-09-24 15:07:00' }) }]
  if (collection === 'zdata_lab_result_item') {
    if (query.visit_id) return activeCurrentResults
    if (query.hn && query.created_at) return activeCurrentResults
    if (query.hn) return activeHistoryResults
    return []
  }
  if (collection === 'zdata_lab_report_manual_entry') return [report]
  return []
}

const app = {
  dbObjectId: value => value,
  dbFindAll: async request => ({ success: true, reply: { data: dataFor(request) } }),
}

;(async () => {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  const body = fs.readFileSync(PROCESS, 'utf8')
  const run = new AsyncFunction('params', 'userInfo', 'app', body)
  const payload = await run({ visit_id: VISIT_ID, hn: '6900023' }, { username: 'test' }, app)

  assert.strictEqual(payload.lab_orders.length, 1)
  assert.strictEqual(payload.ordered_today.length, 1, 'current VN order must be returned in ordered_today')
  assert.strictEqual(payload.resulted_today.length, 1, 'same-day result must also be returned in resulted_today')
  assert.strictEqual(payload.service_date, '2026-09-24', 'service date must come from the HIS Visit')
  const order = payload.lab_orders[0]
  assert.strictEqual(order.items.length, 1)
  assert.strictEqual(order.items[0].result_comment, 'Comment from LIS')
  assert.strictEqual(order.items[0].flag, 'H', 'board API must preserve the LAB interpretation code for the EMR renderer')
  assert.strictEqual(order.items[0].group_id, ITEM_ID)
  assert.strictEqual(order.items[0].group_name, 'Hemoglobin typing')
  assert.strictEqual(order.patient_hn, '6900023')
  assert.strictEqual(order.patient_name, 'ด.ช. ทดสอบ ระบบ')
  assert.strictEqual(order.specimen_name, 'Clotted blood')
  assert.strictEqual(order.collected_at, '2026-09-24 15:07:00')
  assert.deepStrictEqual(order.ordered_items.map(item => ({ code: item.item_code, name: item.item_name, specimen: item.specimen_name })), [
    { code: 'HB-TYPE', name: 'Hemoglobin typing', specimen: 'Clotted blood' },
  ])
  assert.strictEqual(order.items[0].previous.value, '1.0')
  assert.deepStrictEqual(order.items[0].previous_values.map(item => item.value), ['1.0'])
  assert.strictEqual(Object.prototype.hasOwnProperty.call(order.items[0], 'my_pathology'), false, 'non-MY result rows must keep the existing response shape')
  assert.strictEqual(order.items[0].visibility.state, 'visible')
  assert.strictEqual(order.reported_by_source_name, report.reported_by_source_name)
  assert.strictEqual(order.verified_by_source_name, report.verified_by_source_name)
  assert.deepStrictEqual(order.attachments, report.result_attachments)
  assert.strictEqual(Object.prototype.hasOwnProperty.call(order, 'view_form_id'), false)

  // Doctor popup history is fail-closed and patient-scoped: both Test code and
  // normalized Test name must match, rows from a different HN must never leak,
  // and correction revisions from one historical examination count once.
  const historyResult = (suffix, value, enteredAt, extra = {}) => ({
    ...previousResult,
    _id: `6666666666666666666666${suffix}`,
    visit_id: `68009${suffix}`,
    result_report_id: `7777777777777777777777${suffix}`,
    filler_order_no: `LAB-H-${suffix}`,
    result_value: value,
    entered_at: enteredAt,
    created_at: enteredAt,
    ...extra,
  })
  const previousFiveFixture = [
    currentResult,
    historyResult('91', 'wrong patient', '2026-09-20 10:00:00', { hn: 'OTHER-HN' }),
    historyResult('92', 'wrong name', '2026-09-19 10:00:00', { obs_name: 'Different Test', test_name: 'Different Test' }),
    historyResult('93', 'wrong code', '2026-09-18 10:00:00', { obs_code: 'OTHER-CODE', test_code: 'OTHER-CODE' }),
    historyResult('11', 'old revision', '2026-09-17 09:00:00', { visit_id: '6800911', result_report_id: '777777777777777777777711', result_status: 'partial' }),
    historyResult('12', 'corrected latest', '2026-09-17 12:00:00', { visit_id: '6800911', result_report_id: '777777777777777777777711', result_status: 'corrected' }),
    historyResult('13', 'partial published', '2026-09-16 10:00:00', { result_status: 'partial' }),
    historyResult('14', 'third', '2026-09-15 10:00:00'),
    historyResult('15', 'fourth', '2026-09-14 10:00:00'),
    historyResult('16', 'fifth', '2026-09-13 10:00:00'),
    historyResult('17', 'sixth excluded', '2026-09-12 10:00:00'),
  ]
  activeHistoryResults = previousFiveFixture
  const scopedPayload = await run({ visit_id: VISIT_ID, hn: 'CLIENT-MUST-NOT-CONTROL-SCOPE' }, { username: 'test' }, app)
  const scopedRow = scopedPayload.lab_orders[0].items[0]
  assert.deepStrictEqual(
    scopedRow.previous_values.map(item => item.value),
    ['corrected latest', 'partial published', 'third', 'fourth', 'fifth'],
    'history must be same HN + exact Test code + exact Test name, deduplicated by examination, newest first, max five',
  )
  assert.strictEqual(scopedRow.previous.value, 'corrected latest', 'legacy previous remains the newest matched history row')
  assert(scopedRow.previous_values.every(item => item.value !== 'wrong patient' && item.value !== 'wrong name' && item.value !== 'wrong code'))

  activeHistoryResults = [currentResult, previousResult]

  for (const status of ['partial', 'corrected']) {
    currentResult.result_status = status
    const statusPayload = await run({ visit_id: VISIT_ID, hn: '6900023' }, { username: 'test' }, app)
    assert.strictEqual(statusPayload.resulted_today.length, 1, `${status} issued on the Visit service date must be included in resulted_today`)
    assert.strictEqual(statusPayload.resulted_today[0].items[0].result_status, status)
  }
  currentResult.result_status = 'final'

  // MY เท่านั้น: ผล manual แบบ freestyle หนึ่ง test อาจมีหลาย specimen/ตำแหน่ง
  // EMR ต้องบอกตำแหน่งให้แพทย์แยกแถวได้ และค่าก่อนหน้าต้องเทียบตำแหน่งเดียวกัน
  // ห้าม fallback ด้วยรหัส M14 อย่างเดียว เพราะจะเอาค่าคนละตำแหน่งมาแสดงซ้ำกันทุกแถว
  const myCurrent = {
    ...currentResult,
    _id: '121212121212121212121212',
    obs_code: 'M14',
    obs_name: 'Wood light',
    test_name: 'Wood light',
    result_definition_id: 'MY-PATH|' + ITEM_ID + '|0|abdomen',
    result_value: 'พบเชื้อ',
    lab_section: 'MY',
    pathology_row_key: ITEM_ID + '|0|abdomen',
    pathology_sub_index: 0,
    source_item_id: ITEM_ID,
    specimen_index: 0,
    specimen_code_snapshot: 'STOOL',
    specimen_name_snapshot: 'Stool',
    ordered_site_code_snapshot: 'ABD',
    ordered_site_name_snapshot: 'ช่องท้อง',
    actual_site_code: 'ABD',
    actual_site_name: 'ช่องท้อง',
    actual_site_detail: 'ด้านซ้าย',
  }
  const myPreviousSameLocation = {
    ...myCurrent,
    _id: '131313131313131313131313',
    visit_id: '6800998',
    order_no: PREVIOUS_ITEM_ID,
    result_value: 'ไม่พบเชื้อ',
    entered_at: '2026-08-01 09:00:00',
    created_at: '2026-08-01 09:00:00',
  }
  const myPreviousOtherLocation = {
    ...myPreviousSameLocation,
    _id: '141414141414141414141414',
    result_definition_id: 'MY-PATH|' + PREVIOUS_ITEM_ID + '|1|back',
    pathology_row_key: PREVIOUS_ITEM_ID + '|1|back',
    specimen_code_snapshot: 'SWAB',
    specimen_name_snapshot: 'Ear swab',
    ordered_site_code_snapshot: 'BACK',
    ordered_site_name_snapshot: 'หลัง',
    actual_site_code: 'BACK',
    actual_site_name: 'หลัง',
    actual_site_detail: '',
    result_value: 'ค่าคนละตำแหน่ง',
    entered_at: '2026-08-15 09:00:00',
    created_at: '2026-08-15 09:00:00',
  }
  const myPreviousOtherDetail = {
    ...myPreviousSameLocation,
    _id: '151515151515151515151515',
    actual_site_detail: 'ด้านขวา',
    result_value: 'ค่าคนละรายละเอียดตำแหน่ง',
    entered_at: '2026-08-20 09:00:00',
    created_at: '2026-08-20 09:00:00',
  }
  activeSectionCode = 'MY'
  activeSectionName = 'Mycology'
  activeCurrentResults = [myCurrent]
  activeHistoryResults = [myCurrent, myPreviousOtherDetail, myPreviousOtherLocation, myPreviousSameLocation]
  const myPayload = await run({ visit_id: VISIT_ID, hn: '6900023' }, { username: 'test' }, app)
  const myRow = myPayload.lab_orders[0].items[0]
  assert.strictEqual(myRow.my_pathology, true)
  assert.strictEqual(myRow.name, 'ช่องท้อง (ด้านซ้าย) · Specimen Stool')
  assert.strictEqual(myRow.test_name, 'Wood light')
  assert.strictEqual(myRow.specimen_name, 'Stool')
  assert.strictEqual(myRow.actual_site_name, 'ช่องท้อง')
  assert.strictEqual(myRow.previous.value, 'ไม่พบเชื้อ', 'MY previous must match the same test + specimen + site')
  assert.deepStrictEqual(myRow.previous_values.map(item => item.value), ['ไม่พบเชื้อ'])
  assert.notStrictEqual(myRow.previous.value, 'ค่าคนละตำแหน่ง')

  activeSectionCode = 'HM'
  activeSectionName = 'Hematology'
  activeCurrentResults = [currentResult]
  activeHistoryResults = [currentResult, previousResult]

  for (const file of EVENTS) {
    const source = fs.readFileSync(file, 'utf8')
    assert.match(source, /s\.tsLabDialog = \{ visible: false, order: null \}/)
    assert.match(source, /s\.tsLabDialog = \{ visible: true, order(?:: (?:o|order))? \}/)
    assert.match(source, /result_groups: resultGroups/)
    assert.match(source, /s\.tsResultGroupIsProfile/)
    assert.match(source, /s\.tsResultSourceText/)
    assert.match(source, /const microParams = reportIds\.length === 1 \? \{ xparentx: reportIds\[0\] \} : \{\};/)
    assert.doesNotMatch(source, /const microParams = \{\};/)
    assert.doesNotMatch(source, /s\.tsOpen\(t\.f, t\.d\)/)
    const context = { vueState: { tsLoad: () => {} }, getFormRef: () => null }
    const executable = file.includes('FULL') ? source : `const s=this.vueState; const field=this;\n${source}`
    new Function(executable).call(context)
    const profileItems = ['220101EB', '220102EB', '220103EB', '220104EB', '220105EB'].map((code, index) => ({
      ...order.items[0],
      result_item_id: String(index + 1),
      code,
      name: index ? `Result ${index + 1}` : 'Hemoglobin typing',
    }))
    context.vueState.tsAbsorb({ current_vn: '6900317', lab_orders: [{ ...order, items: profileItems }], xray_results: [] })
    const viewOrder = context.vueState.tsLgVisit[0]
    assert.strictEqual(viewOrder.result_groups.length, 1)
    assert.strictEqual(viewOrder.result_groups[0].test_name, 'Hemoglobin typing')
    assert.strictEqual(viewOrder.result_groups[0].results.length, 5)
    assert.strictEqual(context.vueState.tsLgSections.length, 2, 'LAB tab must always render both headings')
    assert.match(context.vueState.tsLgSections[0].title, /Order ที่สั่งใน visit วันนี้ · VN 6900317/)
    assert.match(context.vueState.tsLgSections[1].title, /ผล LAB ที่ออกใน visit วันนี้ · VN 6900317/)
    context.vueState.tsAbsorb({ current_vn: '6900317', ordered_today: [{ ...order, items: profileItems }], resulted_today: [{ ...order, items: profileItems }], lab_orders: [{ ...order, items: profileItems }], xray_results: [] })
    assert.strictEqual(context.vueState.tsLgVisit.length, 1)
    assert.strictEqual(context.vueState.tsLgToday.length, 1, 'an order may appear in both headings when ordered and resulted in the same VN day')
    context.vueState.tsOpenOrder(viewOrder)
    assert.strictEqual(context.vueState.tsResultGroupExpanded(viewOrder.result_groups[0], 0), true)
    assert.strictEqual(context.vueState.tsResultRowNumber(viewOrder.result_groups[0], 0, 4), '1.5')

    const microReportId = 'bbbbbbbbbbbbbbbbbbbbbbbb'
    context.vueState.tsAbsorb({ current_vn: '6900317', lab_orders: [{ ...order, section_code: 'MB', result_report_ids: [microReportId], items: profileItems }], xray_results: [] })
    const microOrder = context.vueState.tsLgVisit[0]
    assert.strictEqual(microOrder.report_ready, true, 'MLab PDF must be enabled for one Result Report')
    assert.deepStrictEqual(microOrder.report_params, { xparentx: microReportId })
    context.vueState.tsAbsorb({ current_vn: '6900317', lab_orders: [{ ...order, section_code: 'MB', result_report_ids: [microReportId, 'cccccccccccccccccccccccc'], items: profileItems }], xray_results: [] })
    assert.strictEqual(context.vueState.tsLgVisit[0].report_ready, false, 'MLab PDF must fail closed for multiple Result Reports')
  }

  for (const file of TEMPLATES) {
    const source = fs.readFileSync(file, 'utf8')
    assert.match(source, /v-model="tsLabDialog\.visible"/)
    assert.match(source, /ค่าก่อนหน้า/)
    assert.match(source, /Reported by:/)
    assert.match(source, /Approve name:/)
    assert.match(source, /ไฟล์แนบผลตรวจ/)
    assert.match(source, /หมายเหตุผลตรวจ/)
    assert.match(source, /class="lab-result-dialog"/)
    assert.match(source, /class="lab-result-profile-row"/)
    assert.match(source, /class="lab-result-value-row"/)
    assert.match(source, /โหมดดูอย่างเดียว/)
    assert.match(source, /กาง Profile ทั้งหมด/)
    assert.doesNotMatch(source, /append-to-body/)
    // แถวผลบน Card ต้องแยกเป็น 3 บรรทัด: ชื่อ → รหัส → ค่าปกติ
    assert.match(source, /\{\{ r\.name \}\}<\/span>\s*<small v-if="r\.code" style="display:block/)
    assert.match(source, /\{\{ r\.code \}\}<\/small>\s*<small v-if="r\.ref" style="display:block[^>]*>ปกติ \{\{ r\.ref \}\}/)
    assert.doesNotMatch(source, /\{\{ r\.name \}\}<small v-if="r\.code"/)
    assert.doesNotMatch(source, /o\.time_text[^\n]*<el-tag/)
  }

  console.log('EMR LAB full-result dialog tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
