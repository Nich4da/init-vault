const assert = require('assert')
const fs = require('fs')
const path = require('path')

const RECEIPT_FORM_ID = '6a8b1c03f851000f28e501ef'
const REPORT_FORM_ID = '6a8d4334f851000f28e5025b'
const RESULT_ITEM_FORM_ID = '6a8bc91df851000f28e501fb'
const WORK_ITEM_FORM_ID = '6a95c750422c1ca959829e8a'
const CPOE_ITEM_ID = '777777777777777777777777'
const CPOE_SIBLING_ITEM_ID = '999999999999999999999999'
const CPOE_ORDER_ID = '666666666666666666666666'

const apiBody = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/hl7_result_upsert_api.js'),
  'utf8',
)
const partial = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../../SDForm/api-factory/examples/agent_result_partial.json'),
  'utf8',
))
const finalResult = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../../SDForm/api-factory/examples/agent_result_final.json'),
  'utf8',
))
const resultSchema = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../../SDForm/api-factory/schemas/agent-to-his-result-v2.schema.json'),
  'utf8',
))
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const Process = new AsyncFunction('params', 'userInfo', 'app', apiBody)
const mappingMatch = apiBody.match(
  /const RESULT_COMPONENT_CODES_BY_GROUP = (\{[\s\S]*?\n\})\n\nconst text/,
)
assert.ok(mappingMatch, 'result-component mapping must remain embedded in the Process artifact')
const resultComponentCodesByGroup = Function(`return (${mappingMatch[1]})`)()
assert.strictEqual(Object.keys(resultComponentCodesByGroup).length, 30)
assert.strictEqual(Object.values(resultComponentCodesByGroup).flat().length, 215)
assert.deepStrictEqual(resultComponentCodesByGroup['100802CD'], ['100802CD', '101120CD'])

const clone = value => JSON.parse(JSON.stringify(value))
const stores = new Map([
  [RECEIPT_FORM_ID, []],
  [REPORT_FORM_ID, []],
  [RESULT_ITEM_FORM_ID, []],
  [WORK_ITEM_FORM_ID, [{
    _id: '6a9000000000000000000001',
    source_specimen_record_id: CPOE_ITEM_ID,
    source_order_id: CPOE_ORDER_ID,
    dataid: 'ORDER-TEST-001',
    xrstatx: 1,
    lab_no: 'LAB-TEST-001',
    patient_hn: 'HN-TEST-001',
    visit_id: 'VN-TEST-001',
    section_code: 'CHEM',
    section_name: 'Biochemistry',
    work_status: 'processing',
    selected_items_json: JSON.stringify([
      // 2026-09-07: live Work Items carry a CPOE item_code plus the exact
      // test_code sent to Agent. Inbound obs_code must follow that outbound
      // test_code; a local item_code must not win merely because it is present.
      { item_code: 'C97', test_code: 'NA', name: 'Sodium' },
      { item_code: 'C64', test_code: 'K', name: 'Potassium' },
    ]),
  }]],
])
const drafts = new Map()
const cpoeItems = new Map([[CPOE_ITEM_ID, {
  _id: CPOE_ITEM_ID,
  xparentx: CPOE_ORDER_ID,
  order_id: { value: CPOE_ORDER_ID },
  xrstatx: 1,
  current_status: 'sent',
  service_type: { value: 'lab' },
}], [CPOE_SIBLING_ITEM_ID, {
  _id: CPOE_SIBLING_ITEM_ID,
  xparentx: CPOE_ORDER_ID,
  order_id: { value: CPOE_ORDER_ID },
  xrstatx: 1,
  current_status: 'sent',
  service_type: { value: 'lab' },
}]])
const cpoeOrders = new Map([[CPOE_ORDER_ID, {
  _id: CPOE_ORDER_ID,
  xrstatx: 1,
  current_status: 'sent',
  item_count: 2,
  service_type: { value: 'lab' },
}]])
const outboundRows = new Map([[CPOE_ITEM_ID, {
  _id: CPOE_ITEM_ID,
  xrstatx: 1,
  source_cpoe_order_id: CPOE_ORDER_ID,
  source_cpoe_item_id: CPOE_ITEM_ID,
  order_no: 'ORDER-TEST-001',
  lab_no: 'LAB-TEST-001',
  patient_hn: 'HN-TEST-001',
  visit_id: 'VN-TEST-001',
  hl7_status: 'new',
  retryable: true,
  next_retry_at: '2026-08-25T10:05:00+07:00',
  last_error_code: 'agent_unreachable',
  last_error_reason: 'timeout',
  attempt_history_json: '[{"attempt":1,"success":false,"error":"agent_unreachable"}]',
}]])
let counter = 100
let failNextResultItemSave = false
const objectId = () => (++counter).toString(16).padStart(24, '0')

const rows = formId => stores.get(formId)
const findById = (formId, id) => rows(formId).find(row => row._id === id)
const valueAt = (row, pathText) => pathText.split('.').reduce((value, key) => value == null ? undefined : value[key], row)
const sameValue = (left, right) => String(left) === String(right)
const matches = (row, query) => Object.entries(query || {}).every(([key, expected]) => {
  if (key === '$or') return expected.some(option => matches(row, option))
  const actual = valueAt(row, key)
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    if (expected.$nin) return !expected.$nin.some(value => sameValue(actual, value))
    if (expected.$in) return expected.$in.some(value => sameValue(actual, value))
    if (Object.prototype.hasOwnProperty.call(expected, '$ne')) return !sameValue(actual, expected.$ne)
  }
  return sameValue(actual, expected)
})
const collectionFor = name => {
  if (name === 'zdata_cpoe_order_item') return cpoeItems
  if (name === 'zdata_cpoe_order') return cpoeOrders
  if (name === 'zdata_lab_outband_order') return outboundRows
  throw new Error('unknown collection ' + name)
}

const mockApp = {
  isAuth: roles => roles.some(role => String(role).toLowerCase() !== 'guest'),
  isRole: (expected, roles) => roles.some(role => String(role).toLowerCase() === String(expected).toLowerCase()),
  curDate: () => '2026-08-25T10:30:00+07:00',
  dbObjectId: value => String(value),
  db: {
    collection: name => {
      const collectionRows = collectionFor(name)
      return {
        findOne: async query => clone(Array.from(collectionRows.values()).find(row => matches(row, query)) || null),
        find: query => ({
          toArray: async () => clone(Array.from(collectionRows.values()).filter(row => matches(row, query))),
        }),
        updateOne: async (query, update) => {
          const row = Array.from(collectionRows.values()).find(candidate => matches(candidate, query))
          if (!row) return { matchedCount: 0, modifiedCount: 0 }
          Object.assign(row, clone(update.$set || {}))
          return { matchedCount: 1, modifiedCount: 1 }
        },
      }
    },
  },
  sdformGetAll: async provider => {
    let data = rows(provider.providerId).filter(row => row.xrstatx !== 0 && row.xrstatx !== 3)
    const p = provider.params || {}
    if (provider.providerId === RECEIPT_FORM_ID) {
      data = data.filter(row => row.result_uid === p.resultUid)
    } else if (provider.providerId === WORK_ITEM_FORM_ID) {
      data = data.filter(row => row.lab_no === p.labNo)
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
    if (formId === RESULT_ITEM_FORM_ID && failNextResultItemSave) {
      failNextResultItemSave = false
      drafts.delete(dataId)
      return { success: false, message: 'synthetic result item write failure' }
    }
    const next = Object.assign({}, current || draft.row, clone(data), { _id: dataId, xrstatx: 1 })
    if (current) Object.assign(current, next)
    else rows(formId).push(next)
    drafts.delete(dataId)
    return { success: true, id: dataId, data: clone(next) }
  },
}

const userInfo = { roles: ['lab_result_agent'], username: 'agent-test' }
const noRoleUserInfo = { roles: [], username: '' }

const receiptByUid = uid => rows(RECEIPT_FORM_ID).find(row => row.result_uid === uid)
const receiptForPayload = payload => rows(RECEIPT_FORM_ID).find(row =>
  row.result_uid === payload.result_uid &&
  row.order_no === payload.order_no &&
  row.filler_order_no === (payload.filler_order_no || payload.labno || payload.lab_no) &&
  row.hn === payload.hn &&
  row.visit_id === payload.visit_id
)
const reportBySeq = seq => rows(REPORT_FORM_ID).find(row => row.report_seq === String(seq))
const reportByUid = uid => rows(REPORT_FORM_ID).find(row => row.result_uid === uid)
const itemsByReport = reportId => rows(RESULT_ITEM_FORM_ID).filter(row => row.result_report_id === reportId)
const itemByReportAndCode = (reportId, code) => itemsByReport(reportId).find(row => row.obs_code === code)
const canonicalItemByCode = code => rows(RESULT_ITEM_FORM_ID).find(row => row.obs_code === code)
const status = () => rows(WORK_ITEM_FORM_ID)[0]

;
(async () => {
  assert.deepStrictEqual(
    resultSchema.$defs.resultItem.properties.comment,
    {
      type: 'string',
      description: 'Optional observation comment from HL7 NTE. Multiple NTE lines are joined with a newline character. Omitted when the observation has no comment.',
    },
  )
  assert(!resultSchema.$defs.resultItem.required.includes('comment'), 'items[].comment must remain optional')

  const guestInvalidPayload = clone(partial)
  guestInvalidPayload.report_seq = 1
  const guestResult = await Process(guestInvalidPayload, { roles: ['guest'], username: 'guest' }, mockApp)
  assert.strictEqual(guestResult.success, false)
  assert.strictEqual(guestResult.code, 'INVALID_PAYLOAD', 'guest must pass authorization and reach schema validation')
  assert.strictEqual(rows(RECEIPT_FORM_ID).length, 0, 'guest authorization test must not create a receipt')

  const missingRoleResult = await Process(guestInvalidPayload, noRoleUserInfo, mockApp)
  assert.strictEqual(missingRoleResult.success, false)
  assert.strictEqual(missingRoleResult.code, 'INVALID_PAYLOAD', 'a caller without roles must pass the temporary UAT gate and reach schema validation')
  assert.strictEqual(rows(RECEIPT_FORM_ID).length, 0, 'no-role authorization smoke test must not create a receipt')

  const missingUserInfoResult = await Process(guestInvalidPayload, undefined, mockApp)
  assert.strictEqual(missingUserInfoResult.success, false)
  assert.strictEqual(missingUserInfoResult.code, 'INVALID_PAYLOAD', 'a caller without userInfo must pass the temporary UAT gate and reach schema validation')
  assert.strictEqual(rows(RECEIPT_FORM_ID).length, 0, 'missing-userInfo authorization smoke test must not create a receipt')

  const invalid = clone(partial)
  invalid.report_seq = 1
  const invalidResult = await Process(invalid, userInfo, mockApp)
  assert.strictEqual(invalidResult.success, false)
  assert.strictEqual(invalidResult.code, 'INVALID_PAYLOAD')
  assert.strictEqual(rows(RECEIPT_FORM_ID).length, 0, 'invalid JSON must not create a receipt')

  const gatewayMetadataInvalid = clone(invalid)
  gatewayMetadataInvalid.xpartnerx = { partner: 'gateway-test' }
  const metadataInvalidResult = await Process(gatewayMetadataInvalid, userInfo, mockApp)
  assert.strictEqual(metadataInvalidResult.success, false)
  assert.strictEqual(metadataInvalidResult.code, 'INVALID_PAYLOAD')
  assert(!metadataInvalidResult.errors.some(message => message.includes('xpartnerx')), 'gateway metadata must be separated before clinical validation')
  assert.strictEqual(rows(RECEIPT_FORM_ID).length, 0, 'metadata validation smoke must not create a receipt')

  const unknownTopField = clone(partial)
  unknownTopField.unexpected_gateway_field = 'must-still-fail'
  const unknownTopFieldResult = await Process(unknownTopField, userInfo, mockApp)
  assert.strictEqual(unknownTopFieldResult.success, false)
  assert(unknownTopFieldResult.errors.some(message => message.includes('unexpected_gateway_field')), 'only the approved xpartnerx transport field may bypass the clinical allowlist')
  assert.strictEqual(rows(RECEIPT_FORM_ID).length, 0, 'unknown field must fail before write')

  const conflictingLabNoAlias = clone(partial)
  conflictingLabNoAlias.labno = 'DIFFERENT-LAB-NO'
  const invalidAlias = await Process(conflictingLabNoAlias, userInfo, mockApp)
  assert.strictEqual(invalidAlias.success, false)
  assert.strictEqual(invalidAlias.code, 'INVALID_PAYLOAD')
  assert.ok(invalidAlias.errors.some(message => message.includes('filler_order_no/labno/lab_no')))
  assert.strictEqual(rows(RECEIPT_FORM_ID).length, 0, 'conflicting LAB NO. aliases must not create a receipt')

  const oversized = clone(partial)
  oversized.result_uid = 'X'.repeat(201)
  const invalidLength = await Process(oversized, userInfo, mockApp)
  assert.strictEqual(invalidLength.success, false)
  assert.strictEqual(invalidLength.code, 'INVALID_PAYLOAD')
  assert.ok(invalidLength.errors.some(message => message.includes('result_uid')))
  assert.strictEqual(rows(RECEIPT_FORM_ID).length, 0, 'oversized schema fields must not create a receipt')

  const emptyCriticalRule = clone(partial)
  emptyCriticalRule.result_uid = 'RESULT-TEST-EMPTY-RULE'
  emptyCriticalRule.items[0].critical_low_rule = ''
  const invalidCriticalRule = await Process(emptyCriticalRule, userInfo, mockApp)
  assert.strictEqual(invalidCriticalRule.success, false)
  assert.strictEqual(invalidCriticalRule.code, 'INVALID_PAYLOAD')
  assert.ok(invalidCriticalRule.errors.some(message => message.includes('critical_low_rule')))
  assert.strictEqual(rows(RECEIPT_FORM_ID).length, 0, 'empty minLength field must not create a receipt')

  const invalidComment = clone(partial)
  invalidComment.result_uid = 'RESULT-TEST-INVALID-COMMENT'
  invalidComment.items[0].comment = ['hemolyzed sample', 'repeat confirmed']
  const invalidCommentResult = await Process(invalidComment, userInfo, mockApp)
  assert.strictEqual(invalidCommentResult.success, false)
  assert.strictEqual(invalidCommentResult.code, 'INVALID_PAYLOAD')
  assert.ok(invalidCommentResult.errors.some(message => message.includes('items[0].comment')))
  assert.strictEqual(rows(RECEIPT_FORM_ID).length, 0, 'non-string comment must not create a receipt')

  const legacyCorrectionIdentity = clone(finalResult)
  legacyCorrectionIdentity.corrected_at = '2026-08-25T10:20:00+07:00'
  legacyCorrectionIdentity.corrected_by = { source_id: 'LIS-OLD', source_name: 'Old contract' }
  const legacyCorrectionResult = await Process(legacyCorrectionIdentity, userInfo, mockApp)
  assert.strictEqual(legacyCorrectionResult.success, false)
  assert.strictEqual(legacyCorrectionResult.code, 'INVALID_PAYLOAD')
  assert(legacyCorrectionResult.errors.some(message => message.includes('corrected_by')))
  assert(legacyCorrectionResult.errors.some(message => message.includes('corrected_at')))
  assert.strictEqual(rows(RECEIPT_FORM_ID).length, 0, 'manual HIS audit fields must not enter through the Agent contract')

  const gatewayPartial = clone(partial)
  gatewayPartial.xpartnerx = { partner: 'lis-vender', trace_id: 'synthetic-trace' }
  const first = await Process(gatewayPartial, noRoleUserInfo, mockApp)
  assert.strictEqual(first.success, true)
  assert.strictEqual(first.code, 'PROCESSED')
  assert.strictEqual(first.data.result_uid, partial.result_uid, 'a no-role caller must be able to persist a valid UAT result')
  assert.strictEqual(first.data.created_item_count, 1)
  assert.strictEqual(rows(RECEIPT_FORM_ID).length, 1)
  assert.strictEqual(rows(REPORT_FORM_ID).length, 1)
  assert.strictEqual(rows(RESULT_ITEM_FORM_ID).length, 1)
  assert.strictEqual(receiptByUid(partial.result_uid).receipt_status, 'processed')
  assert(!receiptByUid(partial.result_uid).raw_payload_json.includes('xpartnerx'), 'transport metadata must not be stored in the clinical raw payload')
  assert.strictEqual(
    JSON.parse(receiptByUid(partial.result_uid).raw_payload_json).items[0].comment,
    'hemolyzed sample\nrepeat confirmed',
    'the immutable Receipt must preserve every NTE line and newline',
  )
  const partialReport = reportBySeq('1')
  const partialNa = itemByReportAndCode(partialReport._id, 'NA')
  assert.strictEqual(partialReport.internal_overall_status, 'partial')
  assert.strictEqual(partialReport.result_report_id, partialReport._id)
  assert.strictEqual(partialReport.xparentx, status()._id, 'Report must be a child of Lab Order Item Status')
  assert.strictEqual(partialNa.result_value, '128')
  assert.strictEqual(partialNa.result_comment, 'hemolyzed sample\nrepeat confirmed')
  assert.strictEqual(partialNa.interpretation_code, 'LL')
  assert.strictEqual(partialNa.is_critical, true)
  assert.strictEqual(partialNa.xparentx, partialReport._id)
  assert.strictEqual(partialNa.parent_id.value, partialReport._id)
  assert.strictEqual(partialNa.result_report_id, partialReport._id)
  assert.strictEqual(status().work_status, 'resulted')
  assert.strictEqual(status().latest_result_at, partial.reported_at, 'partial must expose its latest report time')
  assert.strictEqual(status().resulted_at, undefined, 'partial must not stamp completion time')
  assert.strictEqual(cpoeItems.get(CPOE_ITEM_ID).current_status, 'sent', 'in-progress result must leave CPOE Item unchanged')
  assert.strictEqual(first.data.cpoe_status_changed, false)
  assert.strictEqual(outboundRows.get(CPOE_ITEM_ID).hl7_status, 'in_progress', 'a real partial callback proves the outbound order reached Agent/LIS processing')
  assert.strictEqual(outboundRows.get(CPOE_ITEM_ID).retryable, false)
  assert.strictEqual(outboundRows.get(CPOE_ITEM_ID).last_error_code, '')
  assert.strictEqual(JSON.parse(outboundRows.get(CPOE_ITEM_ID).attempt_history_json).length, 1, 'reconciliation must preserve timeout attempt history')
  assert.strictEqual(cpoeOrders.get(CPOE_ORDER_ID).current_status, 'sent', 'partial result must not complete the parent Order')

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
  const mutatedDuplicate = clone(partial)
  mutatedDuplicate.items[0].value = '129'
  const mutatedDuplicateResult = await Process(mutatedDuplicate, userInfo, mockApp)
  assert.strictEqual(mutatedDuplicateResult.success, false)
  assert.strictEqual(mutatedDuplicateResult.duplicate, true)
  assert.strictEqual(mutatedDuplicateResult.code, 'RESULT_UID_PAYLOAD_CONFLICT')
  assert.strictEqual(rows(RECEIPT_FORM_ID).length, beforeDuplicate.receipts)
  assert.strictEqual(rows(REPORT_FORM_ID).length, beforeDuplicate.reports)
  assert.strictEqual(rows(RESULT_ITEM_FORM_ID).length, beforeDuplicate.items)

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
  // 2026-09-02: user confirmed clinical Result Item stores the latest value only;
  // immutable Receipts/Report payloads remain the technical audit/idempotency trail.
  assert.strictEqual(rows(RESULT_ITEM_FORM_ID).length, 2, 'one normalized clinical row per observation')
  const finalReport = reportBySeq('2')
  const finalNa = canonicalItemByCode('NA')
  const finalK = itemByReportAndCode(finalReport._id, 'K')
  assert.strictEqual(finalReport.internal_overall_status, 'completed')
  assert.strictEqual(finalReport.xparentx, status()._id)
  assert.strictEqual(finalReport.item_count, 2)
  assert.strictEqual(finalReport.critical_count, 0)
  assert.strictEqual(finalNa.result_value, '136')
  assert.strictEqual(finalNa.result_version, '2')
  assert.strictEqual(finalNa.result_comment, '', 'an omitted comment in the latest observation clears the prior current-row comment')
  assert.strictEqual(JSON.parse(finalNa.edit_history_json).length, 0)
  assert.strictEqual(finalNa.previous_value, '')
  assert.strictEqual(finalK.result_value, '4.2')
  assert.strictEqual(partialNa.result_value, '136', 'the same normalized row must advance to the latest value')
  assert.strictEqual(completed.data.created_item_count, 1)
  assert.strictEqual(completed.data.updated_item_count, 1)
  assert.strictEqual(status().work_status, 'completed')
  assert.strictEqual(status().latest_result_at, finalResult.reported_at, 'final must advance the latest report time')
  assert.strictEqual(status().resulted_at, finalResult.verified_at)
  assert.strictEqual(cpoeItems.get(CPOE_ITEM_ID).current_status, 'completed')
  assert.strictEqual(completed.data.cpoe_status, 'completed')
  assert.strictEqual(completed.data.cpoe_status_changed, true)
  assert.strictEqual(outboundRows.get(CPOE_ITEM_ID).hl7_status, 'resulted')
  assert.strictEqual(outboundRows.get(CPOE_ITEM_ID).retryable, false)
  assert.strictEqual(completed.data.outbound_status, 'resulted')
  assert.strictEqual(completed.data.outbound_sync_pending, false)
  assert.strictEqual(cpoeOrders.get(CPOE_ORDER_ID).current_status, 'sent', 'one completed child must not complete a two-item parent Order')
  assert.strictEqual(completed.data.parent_order_complete, false)
  assert.strictEqual(completed.data.parent_order_item_count, 2)
  assert.strictEqual(completed.data.parent_order_completed_item_count, 1)

  const beforeFinalDuplicateReconcile = {
    receipts: rows(RECEIPT_FORM_ID).length,
    reports: rows(REPORT_FORM_ID).length,
    items: rows(RESULT_ITEM_FORM_ID).length,
  }
  Object.assign(outboundRows.get(CPOE_ITEM_ID), {
    hl7_status: 'new',
    retryable: true,
    next_retry_at: '2026-08-25T10:20:00+07:00',
    last_error_code: 'agent_unreachable',
    last_error_reason: 'timeout',
  })
  cpoeItems.get(CPOE_SIBLING_ITEM_ID).current_status = 'completed'
  cpoeOrders.get(CPOE_ORDER_ID).current_status = 'sent'
  const finalDuplicate = await Process(clone(finalResult), userInfo, mockApp)
  assert.strictEqual(finalDuplicate.success, true)
  assert.strictEqual(finalDuplicate.duplicate, true)
  assert.strictEqual(finalDuplicate.code, 'DUPLICATE_RESULT_UID')
  assert.deepStrictEqual(beforeFinalDuplicateReconcile, {
    receipts: rows(RECEIPT_FORM_ID).length,
    reports: rows(REPORT_FORM_ID).length,
    items: rows(RESULT_ITEM_FORM_ID).length,
  }, 'duplicate reconcile must not create Receipt, Report, or Result Item records')
  assert.strictEqual(outboundRows.get(CPOE_ITEM_ID).hl7_status, 'resulted')
  assert.strictEqual(outboundRows.get(CPOE_ITEM_ID).retryable, false)
  assert.strictEqual(outboundRows.get(CPOE_ITEM_ID).last_error_code, '')
  assert.strictEqual(JSON.parse(outboundRows.get(CPOE_ITEM_ID).attempt_history_json).length, 1)
  assert.strictEqual(cpoeOrders.get(CPOE_ORDER_ID).current_status, 'completed')
  assert.strictEqual(finalDuplicate.data.outbound_status_changed, true)
  assert.strictEqual(finalDuplicate.data.parent_order_status_changed, true)
  assert.strictEqual(finalDuplicate.data.parent_order_complete, true)

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
  finalNa.last_edited_by = 'his-manual-editor'
  finalNa.last_edited_at = '2026-08-25 10:18:00'
  const corrected = await Process(correctedPayload, userInfo, mockApp)
  assert.strictEqual(corrected.success, true)
  assert.strictEqual(rows(REPORT_FORM_ID).length, 3)
  assert.strictEqual(rows(RESULT_ITEM_FORM_ID).length, 2)
  const correctedReport = reportBySeq('3')
  const correctedNa = canonicalItemByCode('NA')
  assert.strictEqual(correctedReport.internal_overall_status, 'corrected')
  assert.strictEqual(correctedReport.xparentx, status()._id)
  assert.strictEqual(correctedNa.result_value, '137')
  assert.strictEqual(correctedNa.result_status, 'corrected')
  assert.strictEqual(JSON.parse(correctedNa.edit_history_json).length, 0)
  assert.strictEqual(correctedNa.previous_value, '')
  assert.strictEqual(correctedNa.last_edited_by, 'his-manual-editor')
  assert.strictEqual(correctedNa.last_edited_at, '2026-08-25 10:18:00')
  assert.strictEqual(finalNa.result_value, '137', 'correction updates the same normalized row')
  assert.strictEqual(corrected.data.created_item_count, 0)
  assert.strictEqual(corrected.data.updated_item_count, 1)
  assert.strictEqual(status().work_status, 'completed')
  assert.strictEqual(cpoeItems.get(CPOE_ITEM_ID).current_status, 'completed')
  assert.strictEqual(corrected.data.cpoe_status_changed, false)

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
  assert.strictEqual(outboundRows.get(CPOE_ITEM_ID).hl7_status, 'resulted', 'mismatched result must not alter Outbound state')
  assert.strictEqual(cpoeOrders.get(CPOE_ORDER_ID).current_status, 'completed', 'mismatched result must not alter Parent Order state')
  const unmatchedReceiptId = receiptForPayload(unmatchedPayload)._id
  const receiptCountBeforeUnmatchedRetry = rows(RECEIPT_FORM_ID).length
  const unmatchedRetry = await Process(clone(unmatchedPayload), userInfo, mockApp)
  assert.strictEqual(unmatchedRetry.success, false)
  assert.strictEqual(unmatchedRetry.created, false)
  assert.strictEqual(unmatchedRetry.reprocessed_receipt, true)
  assert.strictEqual(unmatchedRetry.duplicate, false)
  assert.strictEqual(unmatchedRetry.code, 'ORDER_NOT_MATCHED')
  assert.strictEqual(unmatchedRetry.data.receipt_status, 'unmatched')
  assert.strictEqual(unmatchedRetry.data.receipt_id, unmatchedReceiptId)
  assert.strictEqual(rows(RECEIPT_FORM_ID).length, receiptCountBeforeUnmatchedRetry)

  {
    // 2026-09-15: LISconnect intentionally reuses one result_uid when retrying
    // the same message. A failed Receipt must therefore be replayable, while a
    // new UID on the same Order remains a distinct result stage/version.
    const replayPayload = clone(partial)
    replayPayload.order_no = 'ORDER-REPLAY-015'
    replayPayload.filler_order_no = 'LAB-REPLAY-015'
    replayPayload.hn = 'HN-REPLAY-015'
    replayPayload.visit_id = 'VN-REPLAY-015'
    replayPayload.result_uid = 'RESULT-SCOPED-REPLAY-015'
    replayPayload.report_seq = '1'
    replayPayload.items[0].receipt_seq = '1'
    replayPayload.items[0].result_version = '1'

    const replayFirst = await Process(clone(replayPayload), userInfo, mockApp)
    assert.strictEqual(replayFirst.success, false)
    assert.strictEqual(replayFirst.code, 'ORDER_NOT_MATCHED')
    assert.strictEqual(replayFirst.created, true)
    const replayReceiptId = replayFirst.data.receipt_id
    const receiptsBeforeReplay = rows(RECEIPT_FORM_ID).length
    const reportsBeforeReplay = rows(REPORT_FORM_ID).length

    rows(WORK_ITEM_FORM_ID).push({
      _id: '6a9000000000000000000015',
      dataid: replayPayload.order_no,
      xrstatx: 1,
      lab_no: replayPayload.filler_order_no,
      patient_hn: replayPayload.hn,
      visit_id: replayPayload.visit_id,
      section_code: 'CHEM',
      section_name: 'Biochemistry',
      work_status: 'processing',
      selected_items_json: JSON.stringify([{ test_code: 'NA', name: 'Sodium' }]),
    })

    const replayed = await Process(clone(replayPayload), userInfo, mockApp)
    assert.strictEqual(replayed.success, true, replayed.message)
    assert.strictEqual(replayed.created, false)
    assert.strictEqual(replayed.reprocessed_receipt, true)
    assert.strictEqual(replayed.duplicate, false)
    assert.strictEqual(replayed.data.receipt_id, replayReceiptId)
    assert.strictEqual(rows(RECEIPT_FORM_ID).length, receiptsBeforeReplay)
    assert.strictEqual(rows(REPORT_FORM_ID).length, reportsBeforeReplay + 1)
    assert.strictEqual(receiptForPayload(replayPayload).receipt_status, 'processed')

    const changedReplay = clone(replayPayload)
    changedReplay.items[0].value = '131'
    const countsBeforeChangedReplay = {
      receipts: rows(RECEIPT_FORM_ID).length,
      reports: rows(REPORT_FORM_ID).length,
      items: rows(RESULT_ITEM_FORM_ID).length,
    }
    const changedReplayResult = await Process(changedReplay, userInfo, mockApp)
    assert.strictEqual(changedReplayResult.success, false)
    assert.strictEqual(changedReplayResult.code, 'RESULT_UID_PAYLOAD_CONFLICT')
    assert.deepStrictEqual(countsBeforeChangedReplay, {
      receipts: rows(RECEIPT_FORM_ID).length,
      reports: rows(REPORT_FORM_ID).length,
      items: rows(RESULT_ITEM_FORM_ID).length,
    })

    const nextUidPayload = clone(finalResult)
    nextUidPayload.order_no = replayPayload.order_no
    nextUidPayload.filler_order_no = replayPayload.filler_order_no
    nextUidPayload.hn = replayPayload.hn
    nextUidPayload.visit_id = replayPayload.visit_id
    nextUidPayload.result_uid = 'RESULT-NEW-UID-SAME-ORDER-016'
    nextUidPayload.report_seq = '2'
    nextUidPayload.items = [{
      ...nextUidPayload.items[0],
      receipt_seq: '2',
      result_version: '2',
    }]
    const nextUidResult = await Process(nextUidPayload, userInfo, mockApp)
    assert.strictEqual(nextUidResult.success, true, nextUidResult.message)
    assert.strictEqual(nextUidResult.created, true)
    assert.strictEqual(nextUidResult.duplicate, false)

    const sameUidOtherOrder = clone(replayPayload)
    sameUidOtherOrder.order_no = 'ORDER-OTHER-017'
    sameUidOtherOrder.filler_order_no = 'LAB-OTHER-017'
    sameUidOtherOrder.hn = 'HN-OTHER-017'
    sameUidOtherOrder.visit_id = 'VN-OTHER-017'
    rows(WORK_ITEM_FORM_ID).push({
      _id: '6a9000000000000000000017',
      dataid: sameUidOtherOrder.order_no,
      xrstatx: 1,
      lab_no: sameUidOtherOrder.filler_order_no,
      patient_hn: sameUidOtherOrder.hn,
      visit_id: sameUidOtherOrder.visit_id,
      section_code: 'CHEM',
      section_name: 'Biochemistry',
      work_status: 'processing',
      selected_items_json: JSON.stringify([{ test_code: 'NA', name: 'Sodium' }]),
    })
    const receiptsBeforeOtherOrder = rows(RECEIPT_FORM_ID).length
    const otherOrderResult = await Process(sameUidOtherOrder, userInfo, mockApp)
    assert.strictEqual(otherOrderResult.success, true, otherOrderResult.message)
    assert.strictEqual(otherOrderResult.created, true)
    assert.strictEqual(otherOrderResult.duplicate, false)
    assert.strictEqual(rows(RECEIPT_FORM_ID).length, receiptsBeforeOtherOrder + 1)
    assert.notStrictEqual(otherOrderResult.data.receipt_id, replayReceiptId)
  }

  {
    // A retry must also resume after the Report was already created but a later
    // Item write failed; otherwise the existing report_key would deadlock it.
    const resumePayload = clone(partial)
    resumePayload.order_no = 'ORDER-REPORT-RESUME-018'
    resumePayload.filler_order_no = 'LAB-REPORT-RESUME-018'
    resumePayload.hn = 'HN-REPORT-RESUME-018'
    resumePayload.visit_id = 'VN-REPORT-RESUME-018'
    resumePayload.result_uid = 'RESULT-REPORT-RESUME-018'
    resumePayload.report_seq = '1'
    resumePayload.items[0].receipt_seq = '1'
    resumePayload.items[0].result_version = '1'
    rows(WORK_ITEM_FORM_ID).push({
      _id: '6a9000000000000000000018',
      dataid: resumePayload.order_no,
      xrstatx: 1,
      lab_no: resumePayload.filler_order_no,
      patient_hn: resumePayload.hn,
      visit_id: resumePayload.visit_id,
      section_code: 'CHEM',
      section_name: 'Biochemistry',
      work_status: 'processing',
      selected_items_json: JSON.stringify([{ test_code: 'NA', name: 'Sodium' }]),
    })

    failNextResultItemSave = true
    const failedAfterReport = await Process(clone(resumePayload), userInfo, mockApp)
    assert.strictEqual(failedAfterReport.success, false)
    assert.strictEqual(failedAfterReport.code, 'ITEM_SAVE_FAILED')
    assert.strictEqual(receiptForPayload(resumePayload).receipt_status, 'error')
    const receiptIdBeforeResume = failedAfterReport.data.receipt_id
    const receiptsBeforeResume = rows(RECEIPT_FORM_ID).length
    const reportsBeforeResume = rows(REPORT_FORM_ID).length

    const resumed = await Process(clone(resumePayload), userInfo, mockApp)
    assert.strictEqual(resumed.success, true, resumed.message)
    assert.strictEqual(resumed.created, false)
    assert.strictEqual(resumed.reprocessed_receipt, true)
    assert.strictEqual(resumed.resumed_report, true)
    assert.strictEqual(resumed.data.receipt_id, receiptIdBeforeResume)
    assert.strictEqual(rows(RECEIPT_FORM_ID).length, receiptsBeforeResume)
    assert.strictEqual(rows(REPORT_FORM_ID).length, reportsBeforeResume)
    assert.strictEqual(receiptForPayload(resumePayload).receipt_status, 'processed')
  }

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

  rows(WORK_ITEM_FORM_ID).push({
    _id: '6a9000000000000000000003',
    dataid: 'ORDER-CRITICAL-002',
    xrstatx: 1,
    lab_no: 'LAB-CRITICAL-002',
    patient_hn: 'HN-CRITICAL-002',
    visit_id: 'VN-CRITICAL-002',
    section_code: 'CHEM',
    section_name: 'Biochemistry',
    work_status: 'processing',
    selected_items_json: JSON.stringify([{ test_code: 'GLU', name: 'Glucose' }]),
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

  {
    const creatinineWorkId = '6a9000000000000000000010'
    rows(WORK_ITEM_FORM_ID).push({
      _id: creatinineWorkId,
      dataid: 'ORDER-CREATININE-010',
      xrstatx: 1,
      lab_no: 'LAB-CREATININE-010',
      patient_hn: 'HN-CREATININE-010',
      visit_id: 'VN-CREATININE-010',
      section_code: 'CHEM',
      section_name: 'Biochemistry',
      work_status: 'processing',
      selected_items_json: JSON.stringify([
        { test_code: '100802CD', name: 'Creatinine' },
      ]),
    })

    const creatininePayload = clone(partial)
    creatininePayload.order_no = 'ORDER-CREATININE-010'
    creatininePayload.filler_order_no = 'LAB-CREATININE-010'
    creatininePayload.hn = 'HN-CREATININE-010'
    creatininePayload.visit_id = 'VN-CREATININE-010'
    creatininePayload.result_uid = 'RESULT-CREATININE-PARTIAL-010'
    creatininePayload.items = [
      {
        ...creatininePayload.items[0],
        obs_code: '100802CD',
        obs_name: 'Creatinine',
        value: '0.82',
        units: 'mg/dL',
        ref_range: '0.50-1.10',
        interpretation_code: 'N',
        is_critical: false,
        panel_code: '100802CD',
        panel_name: 'Creatinine',
      },
      {
        ...creatininePayload.items[0],
        obs_code: '101120CD',
        obs_name: 'eGFR',
        value: '96',
        units: 'mL/min/1.73m2',
        ref_range: '>=60',
        interpretation_code: 'N',
        is_critical: false,
        panel_code: '100802CD',
        panel_name: 'Creatinine',
      },
    ]
    const creatinineResult = await Process(creatininePayload, userInfo, mockApp)
    assert.strictEqual(creatinineResult.success, true, creatinineResult.message)
    assert.ok(['PROCESSED', 'PROCESSED_WITH_WARNING'].includes(creatinineResult.code))
    const creatinineReport = reportByUid(creatininePayload.result_uid)
    assert.ok(creatinineReport)
    assert.strictEqual(creatinineReport.item_count, 2)
    assert.deepStrictEqual(
      itemsByReport(creatinineReport._id).map(item => item.obs_code).sort(),
      ['100802CD', '101120CD'],
    )

    const unknownSiblingPayload = clone(creatininePayload)
    unknownSiblingPayload.result_uid = 'RESULT-CREATININE-UNKNOWN-011'
    unknownSiblingPayload.report_seq = '2'
    unknownSiblingPayload.items[0].receipt_seq = '2'
    unknownSiblingPayload.items[1] = {
      ...unknownSiblingPayload.items[1],
      obs_code: '999999CD',
      obs_name: 'Unknown observation',
      receipt_seq: '2',
    }
    const reportCountBeforeUnknown = rows(REPORT_FORM_ID).length
    const itemCountBeforeUnknown = rows(RESULT_ITEM_FORM_ID).length
    const unknownSiblingResult = await Process(unknownSiblingPayload, userInfo, mockApp)
    assert.strictEqual(unknownSiblingResult.success, false)
    assert.strictEqual(unknownSiblingResult.code, 'OBS_CODE_PARTIAL_MISMATCH')
    assert.deepStrictEqual(unknownSiblingResult.data.unmatched_obs_codes, ['999999CD'])
    assert.strictEqual(rows(REPORT_FORM_ID).length, reportCountBeforeUnknown)
    assert.strictEqual(rows(RESULT_ITEM_FORM_ID).length, itemCountBeforeUnknown)

    const egfrOnlyFinal = clone(finalResult)
    egfrOnlyFinal.order_no = 'ORDER-CREATININE-010'
    egfrOnlyFinal.filler_order_no = 'LAB-CREATININE-010'
    egfrOnlyFinal.hn = 'HN-CREATININE-010'
    egfrOnlyFinal.visit_id = 'VN-CREATININE-010'
    egfrOnlyFinal.result_uid = 'RESULT-CREATININE-EGFR-ONLY-012'
    egfrOnlyFinal.report_seq = '3'
    egfrOnlyFinal.items = [{
      ...egfrOnlyFinal.items[0],
      obs_code: '101120CD',
      obs_name: 'eGFR',
      value: '96',
      units: 'mL/min/1.73m2',
      ref_range: '>=60',
      receipt_seq: '3',
      result_version: '2',
      panel_code: '100802CD',
      panel_name: 'Creatinine',
    }]
    const egfrOnlyResult = await Process(egfrOnlyFinal, userInfo, mockApp)
    assert.strictEqual(egfrOnlyResult.success, false)
    assert.strictEqual(egfrOnlyResult.code, 'FINAL_ITEMS_INCOMPLETE')
    assert.deepStrictEqual(egfrOnlyResult.data.missing_obs_codes, ['100802CD'])
    assert.strictEqual(findById(WORK_ITEM_FORM_ID, creatinineWorkId).work_status, 'resulted')
  }

  {
    const liverPanelWorkId = '6a9000000000000000000013'
    rows(WORK_ITEM_FORM_ID).push({
      _id: liverPanelWorkId,
      dataid: 'ORDER-LIVER-PANEL-013',
      xrstatx: 1,
      lab_no: 'LAB-LIVER-PANEL-013',
      patient_hn: 'HN-LIVER-PANEL-013',
      visit_id: 'VN-LIVER-PANEL-013',
      section_code: 'CHEM',
      section_name: 'Biochemistry',
      work_status: 'processing',
      selected_items_json: JSON.stringify([
        { test_code: '1001CD', name: 'Liver function panel' },
      ]),
    })
    const liverComponentCodes = resultComponentCodesByGroup['1001CD']
    const liverPanelPayload = clone(finalResult)
    liverPanelPayload.order_no = 'ORDER-LIVER-PANEL-013'
    liverPanelPayload.filler_order_no = 'LAB-LIVER-PANEL-013'
    liverPanelPayload.hn = 'HN-LIVER-PANEL-013'
    liverPanelPayload.visit_id = 'VN-LIVER-PANEL-013'
    liverPanelPayload.result_uid = 'RESULT-LIVER-PANEL-FINAL-013'
    liverPanelPayload.report_seq = '1'
    liverPanelPayload.items = liverComponentCodes.map((code, index) => ({
      ...liverPanelPayload.items[0],
      obs_code: code,
      obs_name: `Liver component ${index + 1}`,
      value: String(index + 1),
      units: 'test-unit',
      ref_range: '0-99',
      receipt_seq: '1',
      result_version: '1',
      panel_code: '1001CD',
      panel_name: 'Liver function panel',
    }))
    const liverPanelResult = await Process(liverPanelPayload, userInfo, mockApp)
    assert.strictEqual(liverPanelResult.success, true, liverPanelResult.message)
    assert.ok(['PROCESSED', 'PROCESSED_WITH_WARNING'].includes(liverPanelResult.code))
    const liverPanelReport = reportByUid(liverPanelPayload.result_uid)
    assert.ok(liverPanelReport)
    assert.strictEqual(liverPanelReport.item_count, liverComponentCodes.length)
    assert.strictEqual(itemsByReport(liverPanelReport._id).length, liverComponentCodes.length)
    assert.strictEqual(findById(WORK_ITEM_FORM_ID, liverPanelWorkId).work_status, 'completed')
  }

  const cancelledCpoeItemId = '888888888888888888888888'
  const cancelledWorkId = '6a9000000000000000000008'
  cpoeItems.set(cancelledCpoeItemId, {
    _id: cancelledCpoeItemId,
    xrstatx: 1,
    current_status: 'accepted',
    service_type: { value: 'lab' },
  })
  rows(WORK_ITEM_FORM_ID).push({
    _id: cancelledWorkId,
    dataid: 'ORDER-CANCELLED-008',
    source_specimen_record_id: cancelledCpoeItemId,
    xrstatx: 1,
    lab_no: 'LAB-CANCELLED-008',
    patient_hn: 'HN-CANCELLED-008',
    visit_id: 'VN-CANCELLED-008',
    section_code: 'CHEM',
    section_name: 'Biochemistry',
    work_status: 'processing',
    selected_items_json: JSON.stringify([
      { his_code_id: 'NA', name: 'Sodium' },
      { his_code_id: 'K', name: 'Potassium' },
    ]),
  })
  const cancelledPayload = clone(finalResult)
  cancelledPayload.order_no = 'ORDER-CANCELLED-008'
  cancelledPayload.filler_order_no = 'LAB-CANCELLED-008'
  cancelledPayload.hn = 'HN-CANCELLED-008'
  cancelledPayload.visit_id = 'VN-CANCELLED-008'
  cancelledPayload.result_uid = 'RESULT-TEST-CANCELLED-008'
  cancelledPayload.report_seq = '1'
  cancelledPayload.stage = 'cancelled'
  cancelledPayload.overall_status = 'cancelled'
  delete cancelledPayload.verified_at
  delete cancelledPayload.verified_by
  cancelledPayload.items = cancelledPayload.items.map((item, index) => ({
    ...item,
    obx_status: 'X',
    change_kind: 'cancelled',
    receipt_seq: '1',
    result_version: String(index + 1),
  }))
  const cancelled = await Process(cancelledPayload, userInfo, mockApp)
  assert.strictEqual(cancelled.success, true)
  assert.strictEqual(findById(WORK_ITEM_FORM_ID, cancelledWorkId).work_status, 'cancelled')
  assert.strictEqual(cpoeItems.get(cancelledCpoeItemId).current_status, 'rejected')
  assert.strictEqual(cancelled.data.cpoe_status, 'rejected')
  assert.strictEqual(cancelled.data.cpoe_status_changed, true)

  {
    // 2026-09-09 shared-LAB-NO contract: a final multi-item callback updates
    // every Work Item/CPOE Item in the receipt batch while reconciling the one
    // anchor Outbound record.
    const batchAnchorId = 'aaaaaaaaaaaaaaaaaaaaaaa1'
    const batchSecondId = 'aaaaaaaaaaaaaaaaaaaaaaa2'
    const batchOrderId = 'aaaaaaaaaaaaaaaaaaaaaaa3'
    const batchLabNo = 'LAB-BATCH-009'
    const batchWorkIds = [batchAnchorId, batchSecondId]
    cpoeItems.set(batchAnchorId, {
      _id: batchAnchorId,
      xparentx: batchOrderId,
      order_id: { value: batchOrderId },
      xrstatx: 1,
      current_status: 'accepted',
      service_type: { value: 'lab' },
    })
    cpoeItems.set(batchSecondId, {
      _id: batchSecondId,
      xparentx: batchOrderId,
      order_id: { value: batchOrderId },
      xrstatx: 1,
      current_status: 'accepted',
      service_type: { value: 'lab' },
    })
    cpoeOrders.set(batchOrderId, {
      _id: batchOrderId,
      xrstatx: 1,
      current_status: 'accepted',
      item_count: 2,
      service_type: { value: 'lab' },
    })
    const selectedBatchItems = [
      { source_item_id: batchAnchorId, test_code: 'BNA', name: 'Batch Sodium' },
      { source_item_id: batchSecondId, test_code: 'BK', name: 'Batch Potassium' },
    ]
    batchWorkIds.forEach(workId => rows(WORK_ITEM_FORM_ID).push({
      _id: workId,
      dataid: workId,
      source_specimen_record_id: workId,
      source_order_id: batchOrderId,
      receipt_batch_id: batchAnchorId,
      batch_item_count: 2,
      xrstatx: 1,
      lab_no: batchLabNo,
      patient_hn: 'HN-BATCH-009',
      visit_id: 'VN-BATCH-009',
      section_code: 'CHEM',
      section_name: 'Biochemistry',
      work_status: 'received',
      selected_items_json: JSON.stringify(selectedBatchItems),
    }))
    outboundRows.set(batchAnchorId, {
      _id: batchAnchorId,
      xrstatx: 1,
      source_cpoe_order_id: batchOrderId,
      source_cpoe_item_id: batchAnchorId,
      source_cpoe_item_ids_json: JSON.stringify(batchWorkIds),
      receipt_batch_id: batchAnchorId,
      order_no: batchAnchorId,
      lab_no: batchLabNo,
      patient_hn: 'HN-BATCH-009',
      visit_id: 'VN-BATCH-009',
      hl7_status: 'queued',
      retryable: false,
      attempt_history_json: '[]',
    })
    const batchPayload = clone(finalResult)
    batchPayload.order_no = batchAnchorId
    batchPayload.filler_order_no = batchLabNo
    batchPayload.hn = 'HN-BATCH-009'
    batchPayload.visit_id = 'VN-BATCH-009'
    batchPayload.result_uid = 'RESULT-BATCH-009'
    batchPayload.report_seq = '1'
    batchPayload.items = batchPayload.items.map((item, index) => ({
      ...item,
      obs_code: index === 0 ? 'BNA' : 'BK',
      obs_name: index === 0 ? 'Batch Sodium' : 'Batch Potassium',
      receipt_seq: '1',
      result_version: '1',
    }))
    const batchResult = await Process(batchPayload, userInfo, mockApp)
    assert.strictEqual(batchResult.success, true, batchResult.message)
    assert.deepStrictEqual(batchResult.data.order_status_ids.sort(), batchWorkIds.slice().sort())
    assert.strictEqual(findById(WORK_ITEM_FORM_ID, batchAnchorId).work_status, 'completed')
    assert.strictEqual(findById(WORK_ITEM_FORM_ID, batchSecondId).work_status, 'completed')
    assert.strictEqual(cpoeItems.get(batchAnchorId).current_status, 'completed')
    assert.strictEqual(cpoeItems.get(batchSecondId).current_status, 'completed')
    assert.strictEqual(cpoeOrders.get(batchOrderId).current_status, 'completed')
    assert.strictEqual(outboundRows.get(batchAnchorId).hl7_status, 'resulted')
  }

  if (process.env.AGENT_RESULT_JSON) {
    const externalPayload = JSON.parse(process.env.AGENT_RESULT_JSON)
    const externalStatusId = objectId()
    rows(WORK_ITEM_FORM_ID).push({
      _id: externalStatusId,
      dataid: externalPayload.order_no,
      xrstatx: 1,
      lab_no: externalPayload.filler_order_no || externalPayload.labno || externalPayload.lab_no,
      patient_hn: externalPayload.hn,
      visit_id: externalPayload.visit_id,
      section_code: 'TEST',
      section_name: 'External payload test',
      work_status: 'processing',
      selected_items_json: JSON.stringify(externalPayload.items.map((item, index) => ({
        test_code: item.obs_code,
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
      assert.strictEqual(saved.result_comment, item.comment || '')
      assert.strictEqual(saved.units, item.units || '')
      assert.strictEqual(saved.ref_range, item.ref_range || '')
    })
    console.log('PASS: external Agent JSON materializes every supplied item; code=' + externalResult.code)
  }

  assert.strictEqual(drafts.size, 0)
  console.log('PASS: API Process body syntax')
  console.log('PASS: gateway service contexts with normal, guest, empty, or missing roles reach schema validation')
  console.log('PASS: invalid wire types are rejected before write')
  console.log('PASS: xpartnerx is separated as transport metadata while unknown clinical fields still fail closed')
  console.log('PASS: JSON Schema v2 string lengths are enforced before write')
  console.log('PASS: optional items[].comment preserves multiline HL7 NTE text and rejects non-string values')
  console.log('PASS: Agent corrected payload excludes HIS manual-editor identity/time')
  console.log('PASS: outbound test_code wins over CPOE item_code for inbound obs_code matching')
  console.log('PASS: partial result creates Receipt -> Report -> Result Item and critical snapshot')
  console.log('PASS: no-role caller can persist a valid result; normal role continues the workflow')
  console.log('PASS: duplicate result_uid creates no duplicate records')
  console.log('PASS: same scoped result_uid with a changed payload is rejected without writes')
  console.log('PASS: duplicate final callback repairs Outbound and Parent Order status without duplicating clinical data')
  console.log('PASS: incomplete final is retained as unmatched receipt without clinical materialization')
  console.log('PASS: final result appends a stage Report and updates normalized clinical items')
  console.log('PASS: partial/final callbacks reconcile Outbound state while preserving failed-attempt audit')
  console.log('PASS: Parent CPOE Order completes only after every active child Item is completed')
  console.log('PASS: Agent corrected result overwrites the same row and preserves existing HIS manual-editor audit')
  console.log('PASS: order_no/LAB NO./HN/VN mismatch keeps receipt unmatched only')
  console.log('PASS: an unchanged retry reprocesses the same unprocessed Receipt without creating another')
  console.log('PASS: a failed callback can recover on retry, a new UID advances the same Order, and the same UID is allowed on another Order')
  console.log('PASS: retry resumes the existing Report after a later Result Item write failure')
  console.log('PASS: stage regression is blocked after corrected/completed results')
  console.log('PASS: same item version with different value is blocked')
  console.log('PASS: labno alias is accepted and rule-only critical data is stored as a non-critical warning')
  console.log('PASS: 30-group/215-component mapping accepts Creatinine plus eGFR and rejects unknown sibling codes')
  console.log('PASS: final Creatinine still requires 100802CD while a pure child-code panel can complete')
  console.log('PASS: cancelled Agent result compare-and-sets the source CPOE Item to rejected')
  console.log('PASS: shared-LAB-NO final result completes every Work Item/CPOE Item in the receipt batch')
})().catch(error => {
  console.error(error)
  process.exitCode = 1
})
