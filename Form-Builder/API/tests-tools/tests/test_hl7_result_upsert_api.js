const assert = require('assert')
const fs = require('fs')
const path = require('path')

const RECEIPT_FORM_ID = '6a8b1c03f851000f28e501ef'
const REPORT_FORM_ID = '6a8d4334f851000f28e5025b'
const RESULT_ITEM_FORM_ID = '6a8bc91df851000f28e501fb'
const STATUS_FORM_ID = '6a7daa3e8d398c11cf2fe869'

const apiBody = fs.readFileSync(path.join(__dirname, 'hl7_result_upsert_api.js'), 'utf8')
const partial = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/agent_result_partial.json'), 'utf8'))
const finalResult = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/agent_result_final.json'), 'utf8'))
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const Process = new AsyncFunction('params', 'userInfo', 'app', apiBody)

const clone = value => JSON.parse(JSON.stringify(value))
const stores = new Map([
  [RECEIPT_FORM_ID, []],
  [REPORT_FORM_ID, []],
  [RESULT_ITEM_FORM_ID, []],
  [STATUS_FORM_ID, [{
    _id: '6a9000000000000000000001',
    xrstatx: 1,
    order_number: 'LAB-TEST-001',
    center_order_id: 'ORDER-TEST-001',
    patient_hn: 'HN-TEST-001',
    visit_id: '6a9000000000000000000002',
    visit_vn: 'VN-TEST-001',
    section_code: 'CHEM',
    section_name: 'Biochemistry',
    work_status: 'processing',
    selected_items: JSON.stringify([
      { his_code_id: 'NA', name: 'Sodium' },
      { his_code_id: 'K', name: 'Potassium' },
    ]),
  }]],
])
const drafts = new Map()
let counter = 100
const objectId = () => (++counter).toString(16).padStart(24, '0')

const rows = formId => stores.get(formId)
const findById = (formId, id) => rows(formId).find(row => row._id === id)

const mockApp = {
  isAuth: () => true,
  curDate: () => '2026-08-25T10:30:00+07:00',
  dbObjectId: value => String(value),
  sdformGetAll: async provider => {
    let data = rows(provider.providerId).filter(row => row.xrstatx !== 0 && row.xrstatx !== 3)
    const p = provider.params || {}
    if (provider.providerId === RECEIPT_FORM_ID) {
      data = data.filter(row => row.result_uid === p.resultUid)
    } else if (provider.providerId === STATUS_FORM_ID) {
      data = data.filter(row => row.order_number === p.fillerOrderNo)
    } else if (provider.providerId === REPORT_FORM_ID) {
      if (p.reportKey) data = data.filter(row => row.report_key === p.reportKey)
      if (p.orderStatusId) data = data.filter(row => row.order_status_id === p.orderStatusId)
    } else if (provider.providerId === RESULT_ITEM_FORM_ID) {
      if (p.reportId) data = data.filter(row => row.result_report_id === p.reportId)
      if (p.orderNo) data = data.filter(row => row.order_no === p.orderNo)
      if (p.fillerOrderNo) data = data.filter(row => row.filler_order_no === p.fillerOrderNo)
      if (p.visitId) data = data.filter(row => row.visit_id === p.visitId)
    }
    return { success: true, data: clone(data) }
  },
  insertData: async formId => {
    assert.ok(stores.has(formId), 'unknown form id ' + formId)
    const id = objectId()
    drafts.set(id, { formId, row: { _id: id, xrstatx: 0 } })
    return { success: true, id }
  },
  sdformSetOne: async (formId, dataId, data) => {
    assert.ok(stores.has(formId), 'unknown form id ' + formId)
    const current = findById(formId, dataId)
    const draft = drafts.get(dataId)
    if (!current && !draft) return { success: false, message: 'record not found' }
    const next = Object.assign({}, current || draft.row, clone(data), { _id: dataId, xrstatx: 1 })
    if (current) Object.assign(current, next)
    else rows(formId).push(next)
    drafts.delete(dataId)
    return { success: true, id: dataId, data: clone(next) }
  },
}

const userInfo = { roles: ['lab_result_agent'], username: 'agent-test' }

const receiptByUid = uid => rows(RECEIPT_FORM_ID).find(row => row.result_uid === uid)
const reportBySeq = seq => rows(REPORT_FORM_ID).find(row => row.report_seq === String(seq))
const reportByUid = uid => rows(REPORT_FORM_ID).find(row => row.result_uid === uid)
const itemsByReport = reportId => rows(RESULT_ITEM_FORM_ID).filter(row => row.result_report_id === reportId)
const itemByReportAndCode = (reportId, code) => itemsByReport(reportId).find(row => row.obs_code === code)
const status = () => rows(STATUS_FORM_ID)[0]

;
(async () => {
  const invalid = clone(partial)
  invalid.report_seq = 1
  const invalidResult = await Process(invalid, userInfo, mockApp)
  assert.strictEqual(invalidResult.success, false)
  assert.strictEqual(invalidResult.code, 'INVALID_PAYLOAD')
  assert.strictEqual(rows(RECEIPT_FORM_ID).length, 0, 'invalid JSON must not create a receipt')

  const conflictingLabNoAlias = clone(partial)
  conflictingLabNoAlias.labno = 'DIFFERENT-LAB-NO'
  const invalidAlias = await Process(conflictingLabNoAlias, userInfo, mockApp)
  assert.strictEqual(invalidAlias.success, false)
  assert.strictEqual(invalidAlias.code, 'INVALID_PAYLOAD')
  assert.ok(invalidAlias.errors.some(message => message.includes('filler_order_no/labno/lab_no')))
  assert.strictEqual(rows(RECEIPT_FORM_ID).length, 0, 'conflicting LAB NO. aliases must not create a receipt')

  const first = await Process(clone(partial), userInfo, mockApp)
  assert.strictEqual(first.success, true)
  assert.strictEqual(first.code, 'PROCESSED')
  assert.strictEqual(first.data.created_item_count, 1)
  assert.strictEqual(rows(RECEIPT_FORM_ID).length, 1)
  assert.strictEqual(rows(REPORT_FORM_ID).length, 1)
  assert.strictEqual(rows(RESULT_ITEM_FORM_ID).length, 1)
  assert.strictEqual(receiptByUid(partial.result_uid).receipt_status, 'processed')
  const partialReport = reportBySeq('1')
  const partialNa = itemByReportAndCode(partialReport._id, 'NA')
  assert.strictEqual(partialReport.internal_overall_status, 'partial')
  assert.strictEqual(partialReport.result_report_id, partialReport._id)
  assert.strictEqual(partialReport.xparentx, status()._id, 'Report must be a child of Lab Order Item Status')
  assert.strictEqual(partialNa.result_value, '128')
  assert.strictEqual(partialNa.interpretation_code, 'LL')
  assert.strictEqual(partialNa.is_critical, true)
  assert.strictEqual(partialNa.xparentx, partialReport._id)
  assert.strictEqual(partialNa.parent_id.value, partialReport._id)
  assert.strictEqual(partialNa.result_report_id, partialReport._id)
  assert.strictEqual(status().work_status, 'resulted')
  assert.strictEqual(status().resulted_at, undefined, 'partial must not stamp completion time')

  const beforeDuplicate = {
    receipts: rows(RECEIPT_FORM_ID).length,
    reports: rows(REPORT_FORM_ID).length,
    items: rows(RESULT_ITEM_FORM_ID).length,
  }
  const duplicate = await Process(clone(partial), userInfo, mockApp)
  assert.strictEqual(duplicate.success, true)
  assert.strictEqual(duplicate.created, false)
  assert.strictEqual(duplicate.duplicate, true)
  assert.deepStrictEqual(beforeDuplicate, {
    receipts: rows(RECEIPT_FORM_ID).length,
    reports: rows(REPORT_FORM_ID).length,
    items: rows(RESULT_ITEM_FORM_ID).length,
  })

  const incompleteFinal = clone(finalResult)
  incompleteFinal.result_uid = 'RESULT-TEST-INCOMPLETE-002'
  incompleteFinal.items = [incompleteFinal.items[0]]
  const reportCountBeforeIncomplete = rows(REPORT_FORM_ID).length
  const itemCountBeforeIncomplete = rows(RESULT_ITEM_FORM_ID).length
  const incomplete = await Process(incompleteFinal, userInfo, mockApp)
  assert.strictEqual(incomplete.success, false)
  assert.strictEqual(incomplete.code, 'FINAL_ITEMS_INCOMPLETE')
  assert.deepStrictEqual(incomplete.data.missing_obs_codes, ['K'])
  assert.strictEqual(receiptByUid(incompleteFinal.result_uid).receipt_status, 'unmatched')
  assert.strictEqual(rows(REPORT_FORM_ID).length, reportCountBeforeIncomplete)
  assert.strictEqual(rows(RESULT_ITEM_FORM_ID).length, itemCountBeforeIncomplete)

  const completed = await Process(clone(finalResult), userInfo, mockApp)
  assert.strictEqual(completed.success, true)
  assert.strictEqual(rows(RECEIPT_FORM_ID).length, 3)
  assert.strictEqual(rows(REPORT_FORM_ID).length, 2, 'partial/final must be separate stage reports')
  assert.strictEqual(rows(RESULT_ITEM_FORM_ID).length, 3, 'each stage keeps its own item snapshots')
  const finalReport = reportBySeq('2')
  const finalNa = itemByReportAndCode(finalReport._id, 'NA')
  const finalK = itemByReportAndCode(finalReport._id, 'K')
  assert.strictEqual(finalReport.internal_overall_status, 'completed')
  assert.strictEqual(finalReport.xparentx, status()._id)
  assert.strictEqual(finalReport.item_count, 2)
  assert.strictEqual(finalReport.critical_count, 0)
  assert.strictEqual(finalNa.result_value, '136')
  assert.strictEqual(finalNa.result_version, '2')
  assert.strictEqual(JSON.parse(finalNa.edit_history_json).length, 1)
  assert.strictEqual(finalK.result_value, '4.2')
  assert.strictEqual(partialNa.result_value, '128', 'partial snapshot must remain unchanged')
  assert.strictEqual(status().work_status, 'completed')
  assert.strictEqual(status().resulted_at, finalResult.verified_at)

  const correctedPayload = clone(finalResult)
  correctedPayload.result_uid = 'RESULT-TEST-CORRECTED-003'
  correctedPayload.report_seq = '3'
  correctedPayload.stage = 'corrected'
  correctedPayload.overall_status = 'corrected'
  correctedPayload.reported_at = '2026-08-25T10:20:00+07:00'
  delete correctedPayload.verified_at
  delete correctedPayload.verified_by
  correctedPayload.items = [{
    ...correctedPayload.items[0],
    value: '137',
    previous_value: '136',
    change_kind: 'corrected',
    receipt_seq: '3',
    result_version: '3',
  }]
  const corrected = await Process(correctedPayload, userInfo, mockApp)
  assert.strictEqual(corrected.success, true)
  assert.strictEqual(rows(REPORT_FORM_ID).length, 3)
  assert.strictEqual(rows(RESULT_ITEM_FORM_ID).length, 4)
  const correctedReport = reportBySeq('3')
  const correctedNa = itemByReportAndCode(correctedReport._id, 'NA')
  assert.strictEqual(correctedReport.internal_overall_status, 'corrected')
  assert.strictEqual(correctedReport.xparentx, status()._id)
  assert.strictEqual(correctedNa.result_value, '137')
  assert.strictEqual(correctedNa.result_status, 'corrected')
  assert.strictEqual(JSON.parse(correctedNa.edit_history_json).length, 2)
  assert.strictEqual(finalNa.result_value, '136', 'final snapshot must remain unchanged')
  assert.strictEqual(status().work_status, 'completed')

  const unmatchedPayload = clone(partial)
  unmatchedPayload.result_uid = 'RESULT-TEST-UNMATCHED-004'
  unmatchedPayload.order_no = 'WRONG-ORDER'
  const reportCountBeforeUnmatched = rows(REPORT_FORM_ID).length
  const itemCountBeforeUnmatched = rows(RESULT_ITEM_FORM_ID).length
  const unmatched = await Process(unmatchedPayload, userInfo, mockApp)
  assert.strictEqual(unmatched.success, false)
  assert.strictEqual(unmatched.code, 'ORDER_NOT_MATCHED')
  assert.strictEqual(receiptByUid(unmatchedPayload.result_uid).receipt_status, 'unmatched')
  assert.strictEqual(rows(REPORT_FORM_ID).length, reportCountBeforeUnmatched)
  assert.strictEqual(rows(RESULT_ITEM_FORM_ID).length, itemCountBeforeUnmatched)

  const regressionPayload = clone(partial)
  regressionPayload.result_uid = 'RESULT-TEST-REGRESSION-005'
  regressionPayload.report_seq = '4'
  regressionPayload.items[0].receipt_seq = '4'
  regressionPayload.items[0].result_version = '4'
  const regressionReportCount = rows(REPORT_FORM_ID).length
  const regression = await Process(regressionPayload, userInfo, mockApp)
  assert.strictEqual(regression.success, false)
  assert.strictEqual(regression.code, 'REPORT_STATUS_REGRESSION')
  assert.strictEqual(rows(REPORT_FORM_ID).length, regressionReportCount)
  assert.strictEqual(receiptByUid(regressionPayload.result_uid).receipt_status, 'error')

  const conflictPayload = clone(finalResult)
  conflictPayload.result_uid = 'RESULT-TEST-CONFLICT-006'
  conflictPayload.report_seq = '4'
  conflictPayload.stage = 'corrected'
  conflictPayload.overall_status = 'corrected'
  conflictPayload.items[0] = {
    ...conflictPayload.items[0],
    value: '999',
    result_version: '3',
    receipt_seq: '4',
  }
  conflictPayload.items[1].receipt_seq = '4'
  const reportCountBeforeConflict = rows(REPORT_FORM_ID).length
  const itemCountBeforeConflict = rows(RESULT_ITEM_FORM_ID).length
  const conflict = await Process(conflictPayload, userInfo, mockApp)
  assert.strictEqual(conflict.success, false)
  assert.strictEqual(conflict.code, 'RESULT_VERSION_CONFLICT')
  assert.strictEqual(correctedNa.result_value, '137', 'conflict must not overwrite current value')
  assert.strictEqual(rows(REPORT_FORM_ID).length, reportCountBeforeConflict, 'conflict must not append report')
  assert.strictEqual(rows(RESULT_ITEM_FORM_ID).length, itemCountBeforeConflict, 'conflict must not append items')
  assert.strictEqual(receiptByUid(conflictPayload.result_uid).receipt_status, 'error')

  rows(STATUS_FORM_ID).push({
    _id: '6a9000000000000000000003',
    xrstatx: 1,
    order_number: 'LAB-CRITICAL-002',
    center_order_id: 'ORDER-CRITICAL-002',
    patient_hn: 'HN-CRITICAL-002',
    visit_vn: 'VN-CRITICAL-002',
    section_code: 'CHEM',
    section_name: 'Biochemistry',
    work_status: 'processing',
    selected_items: JSON.stringify([{ his_code_id: 'GLU', name: 'Glucose' }]),
  })
  const ruleOnlyPayload = clone(partial)
  delete ruleOnlyPayload.filler_order_no
  ruleOnlyPayload.labno = 'LAB-CRITICAL-002'
  ruleOnlyPayload.order_no = 'ORDER-CRITICAL-002'
  ruleOnlyPayload.hn = 'HN-CRITICAL-002'
  ruleOnlyPayload.visit_id = 'VN-CRITICAL-002'
  ruleOnlyPayload.result_uid = 'RESULT-TEST-RULE-ONLY-007'
  ruleOnlyPayload.items = [{
    obs_code: 'GLU',
    obs_name: 'Glucose',
    value: '87',
    units: 'mg/dL',
    ref_range: '74-109',
    obx_status: 'P',
    change_kind: 'first',
    receipt_seq: '1',
    result_version: '1',
    critical_low_rule: '<55.5',
    critical_high_rule: '>399.4',
  }]
  const ruleOnly = await Process(ruleOnlyPayload, userInfo, mockApp)
  assert.strictEqual(ruleOnly.success, true)
  assert.strictEqual(ruleOnly.code, 'PROCESSED_WITH_WARNING')
  const ruleOnlyReport = reportByUid(ruleOnlyPayload.result_uid)
  const glucose = itemByReportAndCode(ruleOnlyReport._id, 'GLU')
  assert.strictEqual(glucose.is_critical, false, 'critical rule presence is not a critical result decision')
  assert.strictEqual(glucose.critical_low_rule, '<55.5')
  assert.strictEqual(receiptByUid(ruleOnlyPayload.result_uid).filler_order_no, ruleOnlyPayload.labno)

  if (process.env.AGENT_RESULT_JSON) {
    const externalPayload = JSON.parse(process.env.AGENT_RESULT_JSON)
    const externalStatusId = objectId()
    rows(STATUS_FORM_ID).push({
      _id: externalStatusId,
      xrstatx: 1,
      order_number: externalPayload.filler_order_no || externalPayload.labno || externalPayload.lab_no,
      center_order_id: externalPayload.order_no,
      patient_hn: externalPayload.hn,
      visit_vn: externalPayload.visit_id,
      section_code: 'TEST',
      section_name: 'External payload test',
      work_status: 'processing',
      selected_items: JSON.stringify(externalPayload.items.map((item, index) => ({
        his_code_id: item.obs_code,
        name: item.obs_name,
        seq: String(index + 1),
      }))),
    })
    const externalResult = await Process(clone(externalPayload), userInfo, mockApp)
    assert.strictEqual(externalResult.success, true)
    assert.ok(['PROCESSED', 'PROCESSED_WITH_WARNING'].includes(externalResult.code))
    const externalReport = reportByUid(externalPayload.result_uid)
    assert.ok(externalReport)
    assert.strictEqual(externalReport.xparentx, externalStatusId)
    const externalItems = itemsByReport(externalReport._id)
    assert.strictEqual(externalItems.length, externalPayload.items.length)
    externalPayload.items.forEach(item => {
      const saved = externalItems.find(row => row.obs_code === item.obs_code)
      assert.ok(saved, 'missing saved item ' + item.obs_code)
      assert.strictEqual(saved.result_value, item.value)
      assert.strictEqual(saved.units, item.units || '')
      assert.strictEqual(saved.ref_range, item.ref_range || '')
    })
    console.log('PASS: external Agent JSON materializes every supplied item; code=' + externalResult.code)
  }

  assert.strictEqual(drafts.size, 0)
  console.log('PASS: API Process body syntax')
  console.log('PASS: invalid wire types are rejected before write')
  console.log('PASS: partial result creates Receipt -> Report -> Result Item and critical snapshot')
  console.log('PASS: duplicate result_uid creates no duplicate records')
  console.log('PASS: incomplete final is retained as unmatched receipt without clinical materialization')
  console.log('PASS: final result appends a stage Report and item snapshots, then completes work status')
  console.log('PASS: corrected result appends another stage and preserves prior snapshots/history')
  console.log('PASS: order_no/LAB NO./HN/VN mismatch keeps receipt unmatched only')
  console.log('PASS: stage regression is blocked after corrected/completed results')
  console.log('PASS: same item version with different value is blocked')
  console.log('PASS: labno alias is accepted and rule-only critical data is stored as a non-critical warning')
})().catch(error => {
  console.error(error)
  process.exitCode = 1
})
