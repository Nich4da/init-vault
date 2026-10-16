const assert = require('assert')
const fs = require('fs')
const path = require('path')

const apiBody = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/lab_cpoe_worklist_api.js'),
  'utf8',
)
const receiverApiBody = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/hl7_result_upsert_api.js'),
  'utf8',
)
const xrayApiBody = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/xray_cpoe_worklist_api.js'),
  'utf8',
)
const organizationCodesFrom = source => {
  const match = source.match(/const XRAY_ORGANIZATION_CODES = (\[[^\n]+\])/)
  assert(match, 'XRAY_ORGANIZATION_CODES must remain a plain standalone array literal')
  return Function('return (' + match[1] + ')')().map(code => String(code).trim().toUpperCase()).sort()
}
const componentMapFrom = source => {
  const match = source.match(/const RESULT_COMPONENT_CODES_BY_GROUP = (\{[\s\S]*?\n\})/)
  assert(match, 'Result-component mapping must remain a plain standalone object literal')
  return Function('return (' + match[1] + ')')()
}
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const Process = new AsyncFunction('params', 'userInfo', 'app', apiBody)
const RESULT_RECEIPT_FORM_ID = '6a8b1c03f851000f28e501ef'
const RESULT_REPORT_FORM_ID = '6a8d4334f851000f28e5025b'
const RESULT_ITEM_FORM_ID = '6a8bc91df851000f28e501fb'
const RESULT_REVISION_LOG_FORM_ID = '6abbabdcc54b3f93ce799576'
const LEGACY_RESULT_ITEM_FORM_ID = '6a7aa641935ed08882467374'
const RESULT_EDIT_LOG_FORM_ID = '6ab78b7159662ac8f059105a'
const RESULT_EDIT_LOG_COLLECTION = 'zdata_' + RESULT_EDIT_LOG_FORM_ID
assert(!apiBody.includes('mongoTxn'), 'LAB result correction must work on standalone MongoDB through normal Form saves')
assert(apiBody.includes("an: '$order.vid.an'"), 'Worklist rows must expose the CPOE Visit AN')
assert(apiBody.includes("encounter_class: { $cond: [{ $ne: [{ $ifNull: ['$order.vid.an', ''] }, ''] }, 'IPD', 'OPD'] }"), 'Worklist rows must derive IPD/OPD from AN')
assert(apiBody.includes('an: 1'), 'Open-Visit lookup must include AN for LAB order context')
assert(apiBody.includes('admit_status: 1'), 'Open-Visit lookup must preserve the admission status context')

const sections = [
  {
    _id: 'SECTION-BC',
    xrstatx: 1,
    enable: true,
    code: 'BC',
    name: 'Biochemistry',
    unit: { value: '10', label: '10 Biochemistry', unit_parent: { unit_code: 'LAB' } },
  },
  {
    _id: 'SECTION-HM',
    xrstatx: 1,
    enable: true,
    code: 'HM',
    name: 'Hematology',
    unit: { value: '20-22', label: '20-22 Hematology', unit_parent: { unit_code: 'LAB' } },
  },
  {
    _id: 'SECTION-HH',
    xrstatx: 1,
    enable: true,
    code: 'HH',
    name: 'Hematology-Homeostasis',
    unit: { value: '20-22', label: '20-22 Hematology', unit_parent: { unit_code: 'LAB' } },
  },
  {
    _id: 'SECTION-MB',
    xrstatx: 1,
    enable: true,
    code: 'MB',
    name: 'Microbiology',
    unit: { value: '40', label: '40 Microbiology', unit_parent: { unit_code: 'LAB' } },
  },
  {
    _id: 'SECTION-MY',
    xrstatx: 1,
    enable: true,
    code: 'MY',
    name: 'Mycology',
    unit: { value: '41', label: '41 Mycology', unit_parent: { unit_code: 'LAB' } },
  },
  {
    _id: 'SECTION-IM',
    xrstatx: 1,
    enable: true,
    code: 'IM',
    name: 'Immunology',
    unit: { value: '30', label: '30 Immunology', unit_parent: { unit_code: 'LAB' } },
  },
  {
    _id: 'SECTION-MI-OUT',
    xrstatx: 1,
    enable: true,
    code: 'MI-OUT',
    name: 'Immunology Outsource',
    unit: { value: '31', label: '31 Immunology Outsource', unit_parent: { unit_code: 'LAB' } },
  },
  {
    _id: 'SECTION-OLD',
    xrstatx: 1,
    enable: false,
    code: 'OLD',
    name: 'Disabled Lab',
    unit: { value: '10', label: '10 Biochemistry', unit_parent: { unit_code: 'LAB' } },
  },
]

const facetResult = {
  rows: [{
    order_id: 'ORDER-1',
    order_number: 'TEST-ORDER-1',
    requested_at: '2026-08-30 10:00:00',
    prior_medication: '2',
    prior_specify: 'abacavir',
    diagnosis: { value: 'C4102', label: 'C4102 Maxilla malignant neoplasm' },
    items: [{ item_id: 'ITEM-1', item_code: 'C2', section: { code: 'BC' } }],
    item_count: 1,
  }],
  meta: [{ total: 1 }],
}

const writeItemId = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const writeMasterId = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const manualItemId = 'cccccccccccccccccccccccc'
const manualMasterId = 'dddddddddddddddddddddddd'
const manualOrderId = 'eeeeeeeeeeeeeeeeeeeeeeee'

const makeApp = (captures, {
  manualStatus = 'accepted',
  manualSectionCode = 'MY',
  manualVisibility = {},
  manualWorkPatch = {},
  manualMasterLabPatch = {},
  manualMasterPatch = {},
  manualLabData = { spec_source: 'Skin scraping', spec_source_code: 'SKIN' },
  manualQuantity = 1,
  doctorAccount = null,
  sensitiveGrantRows = [],
  canonicalCurrent = [],
  canonicalReports = [],
  canonicalReportOrderLookup = canonicalReports,
  canonicalPrevious = [],
  correctionLogRows = [],
  revisionRows = [],
  correctionLogWriteFails = false,
  correctionResultUpdateFails = false,
  unmatchedReceiptRows = [],
  attachmentReport = null,
  legacyLookupFails = false,
  writeStatus = 'sent',
  writeReceivedAt = '',
  writeLabNo = '',
  writeLabData = { specimen_at: '2026-08-30T09:00' },
  writeWorkStatus = '',
  writeCancellation = null,
  writeSectionCode = 'HH',
  reasonRows = [],
  // แถวคิววันนี้จาก zdata_visit_tran — แหล่งเดียวกับกล่อง "ผู้มารับบริการวันนี้" ของหน้า Patient
  visitTranRows = [{
    _id: 'VTRAN-1',
    xrstatx: 1,
    vtran_status: 'waiting',
    visit_date: '2026-08-31',
    checkin_at: '2026-08-31 08:10:00',
    vid: { value: 'VISIT-TODAY-1' },
  }],
} = {}) => ({
  isAuth: () => true,
  isSuper: roles => roles.includes('super'),
  isAdmin: roles => roles.includes('admin'),
  isManager: roles => roles.includes('manager'),
  dbObjectId: id => String(id),
  db: {
    collection: name => {
      if (name === 'zdata_lab_order_cancellation') {
        return {
          findOne: async query => {
            captures.push({ type: 'cancellationLookup', query })
            return writeCancellation
          },
        }
      }
      if (name === 'zdata_lab_result_item') {
        return {
          findOne: async query => canonicalCurrent.find(row => String(row && row._id) === String(query && query._id)) || null,
        }
      }
      if (name === RESULT_EDIT_LOG_COLLECTION) {
        return {
          findOne: async query => correctionLogRows.find(row => row && row.event_id === query.event_id) || null,
        }
      }
      if (name !== 'zdata_lab_work_item') throw new Error('Unexpected direct collection ' + name)
      return {
        findOne: async query => {
          if (writeWorkStatus && JSON.stringify(query).includes(writeItemId)) {
            return {
              _id: writeItemId,
              source_specimen_record_id: writeItemId,
              work_status: writeWorkStatus,
            }
          }
          if (query.source_specimen_record_id !== manualItemId) return null
          return {
            _id: '999999999999999999999999',
            xrstatx: 1,
            source_specimen_record_id: manualItemId,
            lab_no: 'MY2608310001',
            section_code: manualSectionCode,
            work_status: manualStatus === 'sent' ? 'waiting_receive' : manualStatus === 'resulted' ? 'resulted' : manualStatus === 'completed' ? 'completed' : 'received',
            ...manualWorkPatch,
          }
        },
      }
    },
  },
  dbFindById: async (id, from) => {
    if (from === 'zdata_cpoe_order_item' && String(id) === writeItemId) {
      return {
        success: true,
        reply: {
          data: {
            _id: writeItemId,
            xrstatx: 1,
            current_status: writeStatus,
            service_type: { value: 'lab' },
            item_data_id: writeMasterId,
            order_id: { value: 'ffffffffffffffffffffffff' },
            received_at: writeReceivedAt,
            lab_no: writeLabNo,
            lab_data: writeLabData,
          },
        },
      }
    }
    if (from === 'zdata_master_item_order' && String(id) === writeMasterId) {
      return {
        success: true,
        reply: { data: { _id: writeMasterId, section: { code: writeSectionCode, name: writeSectionCode + ' section' } } },
      }
    }
    if (from === 'zdata_cpoe_order_item' && String(id) === manualItemId) {
      return {
        success: true,
        reply: {
          data: {
            _id: manualItemId,
            xrstatx: 1,
            current_status: manualStatus,
            service_type: { value: 'lab' },
            item_data_id: manualMasterId,
            order_id: { value: manualOrderId },
            item_code: 'MY-CULTURE',
            item_name: 'Fungal culture',
            item_no: 2,
            quantity: manualQuantity,
            lab_no: 'MY2608310001',
            lab_data: manualLabData,
            ...manualVisibility,
          },
        },
      }
    }
    if (from === 'zdata_master_item_order' && String(id) === manualMasterId) {
      return {
        success: true,
        reply: {
          data: {
            _id: manualMasterId,
            item_name: 'Fungal culture',
            section: {
              code: manualSectionCode,
              name: manualSectionCode === 'MY' ? 'Mycology' : 'Biochemistry',
            },
            lab_item: { unit_symbol: 'CFU/mL', reference_range: 'Not detected', ...manualMasterLabPatch },
            ...manualMasterPatch,
          },
        },
      }
    }
    if (from === 'zdata_cpoe_order' && String(id) === manualOrderId) {
      return {
        success: true,
        reply: {
          data: {
            _id: manualOrderId,
            xrstatx: 1,
            order_number: 'R2608310001',
            xparentx: 'VISIT-OBJECT-ID',
            vid: { vn: 'VN-NEW', pid: { hn: 'HN-TEST' } },
          },
        },
      }
    }
    return { success: true, reply: { data: null } }
  },
  dbUpdate: async (data, from, userInfo, filter) => {
    captures.push({ type: 'update', data, from, userInfo, filter })
    return { success: true, reply: { data: { matchedCount: 1, modifiedCount: 1 } } }
  },
  dbFindAll: async provider => {
    captures.push(provider)
    if (provider.from === 'zdata_section') {
      return { success: true, reply: { data: sections } }
    }
    if (provider.from === 'zdata_zdata_lab_reject_cancel_reason') {
      return { success: true, reply: { data: reasonRows } }
    }
    if (provider.from === 'zdata_lab_spec') {
      const rows = [
        { code: 'BL', name: 'Blood', sort: 40 },
        { code: 'CD', name: 'Clotted blood', sort: 46 },
        { code: 'IC', name: 'Ionized Calcium Blood', sort: 50 },
      ]
      const requestedCode = provider.nosql && provider.nosql.query && provider.nosql.query.code
      return {
        success: true,
        reply: {
          data: requestedCode ? rows.filter(row => row.code === requestedCode) : rows,
        },
      }
    }
    if (provider.from === 'zdata_master_item_order') {
      return {
        success: true,
        reply: {
          data: [{
            _id: 'MASTER-IC',
            lab_item: { specimen: { code: 'IC', name: 'Ionized Calcium Blood' } },
          }],
        },
      }
    }
    if (provider.from === 'zdata_visit_tran') {
      return { success: true, reply: { data: visitTranRows } }
    }
    if (provider.from === 'zdata_visit') {
      return {
        success: true,
        reply: {
          data: [{
            _id: 'VISIT-TODAY-1',
            vn: 'VN-TODAY-1',
            visit_date: '2026-08-31',
            visit_status: true,
            pid: { value: 'PERSON-1', hn: 'HN-1', p_fname: 'Test', p_lname: 'Patient' },
          }],
        },
      }
    }
    if (provider.from === 'zdata_lab_work_item') {
      return { success: true, reply: { data: [{ _id: '999999999999999999999999', source_specimen_record_id: manualItemId, source_order_id: manualOrderId, section_code: manualSectionCode, lab_no: 'MY2608310001', visit_id: 'VN-NEW', xrstatx: 1 }] } }
    }
    if (provider.from === 'core_user') {
      return { success: true, reply: { data: doctorAccount ? [doctorAccount] : [] } }
    }
    if (provider.from === 'zdata_emr_sensitive_access_grant') {
      return { success: true, reply: { data: sensitiveGrantRows } }
    }
    if (provider.from === RESULT_EDIT_LOG_COLLECTION) {
      return { success: true, reply: { data: correctionLogRows } }
    }
    if (provider.from === 'zdata_lab_result_item') {
      return { success: true, reply: { data: canonicalCurrent.map(row => ({ result_report_id: row.result_report_id, xparentx: row.xparentx })) } }
    }
    if (provider.from === 'zdata_lab_report_manual_entry') {
      return { success: true, reply: { data: canonicalReports } }
    }
    if (provider.from === 'zdata_cpoe_order_item') {
      const facetStage = provider.nosql && Array.isArray(provider.nosql.pipeline)
        ? provider.nosql.pipeline.find(stage => stage.$facet)
        : null
      const result = facetStage && facetStage.$facet && facetStage.$facet.status_counts
        ? {
            ...facetResult,
            status_counts: [
              { _id: 'sent', total: 2 },
              { _id: 'ready', total: 1 },
              { _id: 'accepted', total: 3 },
              { _id: 'resulted', total: 4 },
              { _id: 'completed', total: 5 },
              { _id: 'cancelled', total: 6 },
              { _id: 'rejected', total: 7 },
              { _id: 'draft', total: 99 },
            ],
            terminal_status_count: [{ total: 13 }],
          }
        : facetResult
      return { success: true, reply: { data: [result] } }
    }
    if (provider.from === 'zdata_cpoe_order' && provider.nosql.type === 'aggregate') {
      return { success: true, reply: { data: [facetResult] } }
    }
    throw new Error('Unexpected collection ' + provider.from)
  },
  curDate: () => '2026-08-31 10:20:30',
  dbInsert: async (data, collection, userInfo) => {
    captures.push({ type: 'dbInsert', collection, data, userInfo })
    if (collection === RESULT_EDIT_LOG_COLLECTION) {
      captures.push({ type: 'correctionLog', collection, document: data, userInfo })
      if (correctionLogWriteFails) return { success: false }
      correctionLogRows.push({ _id: 'CORRECTION-LOG-ID', xrstatx: 1, ...data })
      return { success: true, id: 'CORRECTION-LOG-ID' }
    }
    return { success: true, id: 'AUDIT-OR-GRANT-ID' }
  },
  sdformGetAll: async provider => {
    captures.push({ type: 'sdformGetAll', provider })
    if (provider.providerId === RESULT_RECEIPT_FORM_ID) {
      return { success: true, data: unmatchedReceiptRows }
    }
    if (provider.providerId === RESULT_REVISION_LOG_FORM_ID) {
      return { success: true, data: revisionRows }
    }
    if (provider.providerId === RESULT_REPORT_FORM_ID && provider.options.where.includes('report_key =')) {
      return { success: true, data: attachmentReport ? [attachmentReport] : [] }
    }
    if (provider.providerId === RESULT_REPORT_FORM_ID && provider.options.where.includes('order_no = :workItemId')) {
      return { success: true, data: canonicalReportOrderLookup }
    }
    if (provider.providerId === RESULT_ITEM_FORM_ID && provider.options.where.includes('order_no = :workItemId')) {
      return { success: true, data: canonicalCurrent }
    }
    if (provider.providerId === RESULT_ITEM_FORM_ID && provider.options.where.includes('order_no = :item0')) {
      return { success: true, data: canonicalCurrent }
    }
    if (provider.providerId === RESULT_ITEM_FORM_ID && provider.options.where.includes('hn = :patientHn')) {
      return { success: true, data: canonicalPrevious }
    }
    if (provider.providerId === LEGACY_RESULT_ITEM_FORM_ID && provider.options.where.includes('source_item_id = :itemId')) {
      if (legacyLookupFails) return { success: false, message: 'legacy Form disabled' }
      return { success: true, data: [] }
    }
    if (provider.providerId === LEGACY_RESULT_ITEM_FORM_ID && provider.options.where.includes('patient_hn = :patientHn')) {
      if (legacyLookupFails) return { success: false, message: 'legacy Form disabled' }
      return {
        success: true,
        data: [{
          source_item_id: 'OLD-ITEM',
          result_status: 'final',
          test_code: 'MY-CULTURE',
          result_value: 'Candida albicans',
          unit_symbol_snapshot: '',
          interpretation_code: 'POS',
          reference_range_snapshot: 'Not detected',
          visit_vn: 'VN-OLD',
          entered_at: '2026-08-01 09:00:00',
        }],
      }
    }
    throw new Error('Unexpected result query')
  },
  insertData: async formId => {
    captures.push({ type: 'insertData', formId })
    return {
      success: true,
      id: formId === RESULT_REPORT_FORM_ID
        ? '111111111111111111111111'
        : 'ffffffffffffffffffffffff'
    }
  },
  sdformSetOne: async (formId, id, data) => {
    captures.push({ type: 'sdformSetOne', formId, id, data })
    if (formId === RESULT_EDIT_LOG_FORM_ID) {
      throw new Error('Correction logs must use the append-only collection insert')
    }
    if (formId === RESULT_ITEM_FORM_ID) {
      const row = canonicalCurrent.find(entry => String(entry && entry._id) === String(id))
      if (row) {
        if (correctionResultUpdateFails) return { success: false }
        Object.assign(row, data)
      }
    }
    return { success: true, id }
  },
})

const userAt = code => ({ roles: ['auth'], username: 'lab-test', unit: { code, name: code } })

const makeFinalizeApp = (captures, {
  resultRows,
  workStatus = 'resulted',
  cpoeStatus = 'resulted',
} = {}) => {
  const workItemId = '999999999999999999999999'
  const resultReportId = '121212121212121212121212'
  const cpoeItem = {
    _id: manualItemId,
    xrstatx: 1,
    current_status: cpoeStatus,
    service_type: { value: 'lab' },
    order_id: { value: manualOrderId },
    item_code: 'MY-CULTURE',
    item_name: 'Fungal culture',
    section_snapshot: { code: 'MY', name: 'Mycology' },
  }
  const workItem = {
    _id: workItemId,
    xrstatx: 1,
    is_current_attempt: true,
    source_specimen_record_id: manualItemId,
    section_code: 'MY',
    work_status: workStatus,
  }
  const canonicalCurrent = resultRows === undefined ? [{
    _id: '343434343434343434343434',
    result_report_id: resultReportId,
    order_no: workItemId,
    result_source: 'manual',
    result_status: workStatus === 'completed' ? 'final' : 'entered',
    result_value: 'Candida tropicalis',
  }] : resultRows
  const app = makeApp(captures, { canonicalCurrent })
  const fallbackCollection = app.db.collection
  app.db.collection = name => {
    if (name === 'zdata_cpoe_order') return {
      findOne: async () => ({ _id: manualOrderId, xrstatx: 1, current_status: cpoeStatus, order_number: 'R2608310001' }),
      updateOne: async (filter, update) => {
        captures.push({ type: 'directUpdate', from: name, filter, update })
        return { matchedCount: 1, modifiedCount: 1 }
      },
    }
    if (name === 'zdata_cpoe_order_item') return {
      find: () => ({ toArray: async () => [cpoeItem] }),
      updateOne: async (filter, update) => {
        captures.push({ type: 'directUpdate', from: name, filter, update })
        return { matchedCount: 1, modifiedCount: 1 }
      },
    }
    if (name === 'zdata_master_item_order' || name === 'zdata_section') return {
      findOne: async () => null,
    }
    if (name === 'zdata_lab_work_item') return {
      findOne: async () => workItem,
      updateOne: async (filter, update) => {
        captures.push({ type: 'directUpdate', from: name, filter, update })
        return { matchedCount: 1, modifiedCount: 1 }
      },
    }
    return fallbackCollection(name)
  }
  return app
}

;
(async () => {
  assert.deepStrictEqual(
    componentMapFrom(apiBody),
    componentMapFrom(receiverApiBody),
    'Worklist and Result Receiver must use the same ordered-test -> result-component mapping',
  )
  assert.deepStrictEqual(
    organizationCodesFrom(apiBody),
    organizationCodesFrom(xrayApiBody),
    'LAB cross-room lookup must grant exactly the same radiology Organizations as the X-ray Worklist',
  )

  {
    const captures = []
    const result = await Process({
      action: 'get_reason_options',
      organization_code: '10',
      section_codes: ['BC'],
      reason_section_code: 'BC',
      reason_type: 'SPECIMEN_REJECT',
    }, userAt('10'), makeApp(captures, {
      reasonRows: [
        { xrstatx: 1, reason_type: 'BOTH', section_code: 'ALL', reason_code: 'LABR-BOTH', reason_text: 'เหตุผลกลาง', display_order: 0, is_active: true },
        { xrstatx: 1, reason_type: 'SPECIMEN_REJECT', section_code: 'ALL', reason_code: 'LABR-00002', reason_text: 'เหตุผลลำดับสอง', display_order: 2, is_active: true },
        { xrstatx: 1, reason_type: 'SPECIMEN_REJECT', section_code: 'BC', reason_code: 'LABR-00001', reason_text: 'เหตุผลเฉพาะห้อง', display_order: 1, is_active: true },
        { xrstatx: 1, reason_type: 'SPECIMEN_REJECT', section_code: 'IM', reason_code: 'LABR-IGNORE-ROOM', reason_text: 'ห้องอื่น', display_order: 0, is_active: true },
        { xrstatx: 1, reason_type: 'SPECIMEN_REJECT', section_code: 'ALL', reason_code: 'LABR-IGNORE-OFF', reason_text: 'ปิดใช้งาน', display_order: 0, is_active: false },
      ],
    }))
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.source, 'lab_reason_settings')
    assert.deepStrictEqual(result.data.options, [
      { value: 'LABR-BOTH', label: 'เหตุผลกลาง', display_order: 0, section_code: 'ALL' },
      { value: 'LABR-00001', label: 'เหตุผลเฉพาะห้อง', display_order: 1, section_code: 'BC' },
      { value: 'LABR-00002', label: 'เหตุผลลำดับสอง', display_order: 2, section_code: 'ALL' },
    ])
    const reasonProvider = captures.find(provider => provider.from === 'zdata_zdata_lab_reject_cancel_reason')
    assert(reasonProvider, 'reason options must read the imported LAB Reason Settings collection')
    assert.deepStrictEqual(reasonProvider.nosql.query.reason_type, { $in: ['SPECIMEN_REJECT', 'BOTH'] })
    assert.deepStrictEqual(reasonProvider.nosql.query.xrstatx, { $nin: [0, 3] })
  }

  {
    const captures = []
    const result = await Process({}, userAt('10'), makeApp(captures))
    assert.strictEqual(result.success, true)
    assert.deepStrictEqual(result.data.section_codes, ['BC'])
    assert.deepStrictEqual(result.data.sections, [{
      id: 'SECTION-BC',
      code: 'BC',
      label: 'Biochemistry',
    }])
    assert.deepStrictEqual(result.data.statuses, ['sent'])
    assert.strictEqual(result.data.total, 1)
    assert.strictEqual(result.data.orders.length, 1)
    assert.strictEqual(Object.prototype.hasOwnProperty.call(result.data, 'status_counts'), false,
      'default list response must preserve the existing contract')
    assert.strictEqual(result.data.orders[0].prior_medication, '2')
    assert.strictEqual(result.data.orders[0].prior_specify, 'abacavir')
    assert.strictEqual(result.data.orders[0].diagnosis.label, 'C4102 Maxilla malignant neoplasm')
    assert.strictEqual(Object.prototype.hasOwnProperty.call(result.data, 'specimen_options'), false,
      'Worklist API must not rebuild the Form-backed specimen dropdown')
    assert(!captures.some(provider => provider.from === 'zdata_specimen_code'),
      'the obsolete zdata_specimen_code source must not be used')
    assert(!captures.some(provider => provider.from === 'zdata_lab_spec'),
      'list must leave the dropdown connected directly to the Lab Specimen Form')

    const aggregateProvider = captures.find(provider => provider.from === 'zdata_cpoe_order_item')
    assert(aggregateProvider, 'must query CPOE Order Item as the worklist source')
    assert.strictEqual(aggregateProvider.nosql.type, 'aggregate')
    assert.deepStrictEqual(aggregateProvider.nosql.collections, ['zdata_cpoe_order_item'])

    const pipelineText = JSON.stringify(aggregateProvider.nosql.pipeline)
    assert(pipelineText.includes('zdata_master_item_order'))
    assert(pipelineText.includes('zdata_section'))
    assert(pipelineText.includes('zdata_cpoe_order'))
    assert(pipelineText.includes('zdata_lab_work_item'))
    assert(pipelineText.includes('cbc_swap_active'), 'Today list must honor CBC routing overrides from Work Item')
    assert(pipelineText.includes('effective_item_master_id'), 'Today list must expose the effective CBC master without rewriting CPOE')
    assert(pipelineText.includes('zdata_lab_order_cancellation'))
    assert(pipelineText.includes('service_type.value'))
    assert(pipelineText.includes('resolved_section.code'))
    assert(pipelineText.includes('group_child'))
    assert(pipelineText.includes('set_name'), 'Worklist must expose the ordered set/Parent name for result grouping')
    assert(pipelineText.includes('parent_name'), 'Worklist must expose lab_parent label as the fallback Parent name')
    assert(pipelineText.includes('emr_context'))
    assert(pipelineText.includes('order.vid.pid.age'))
    assert(pipelineText.includes('order.prior_medication'))
    assert(pipelineText.includes('order.prior_specify'))
    assert(pipelineText.includes('zdata_diagnosis'))
    assert(pipelineText.includes('diagnosis_record.primary_dx'))
    assert(pipelineText.includes('vid.value'))

    const facetStage = aggregateProvider.nosql.pipeline.find(stage => stage.$facet)
    assert.strictEqual(Object.prototype.hasOwnProperty.call(facetStage.$facet, 'status_counts'), false,
      'default list pipeline must remain unchanged unless batching is requested')
    const diagnosisLookupIndex = facetStage.$facet.rows.findIndex(stage =>
      stage.$lookup && stage.$lookup.from === 'zdata_diagnosis'
    )
    const pageLimitIndex = facetStage.$facet.rows.findIndex(stage => stage.$limit)
    assert(diagnosisLookupIndex > pageLimitIndex, 'Diagnosis lookup must run only after the page limit')
    assert(pipelineText.includes('resulted_at'))
    assert(pipelineText.includes('latest_result_at'), 'Worklist must expose the latest Partial/Final report time')
    assert(pipelineText.includes('is_critical'))
    assert(pipelineText.includes('is_hide_result'), 'Worklist must expose per-Order-Item result visibility')
    assert(pipelineText.includes('result_visibility_reason'), 'Worklist must expose the latest visibility audit')
    assert(pipelineText.includes('effective_status'))
    assert(pipelineText.includes('work_item._id'), 'receipt status must prefer the canonical LAB Work Item')
    assert(pipelineText.includes('received_at'), 'accepted CPOE status without an actual receipt must fall back to waiting')
    assert(pipelineText.includes('lab_no'), 'legacy receipt evidence must remain supported')
    assert(pipelineText.includes('work_item_id'))
    assert(pipelineText.includes('source_managed'), 'four source-managed rooms must be explicit in each Item row')
    assert(
      apiBody.includes("source_lab_no: { $ifNull: ['$item_no', ''] }"),
      'Worklist must read the order-side LAB NO. from CPOE Order Item.item_no'
    )
    assert(
      apiBody.includes('{ $in: [sectionCodeExpression, SOURCE_MANAGED_SECTION_CODES] }'),
      'item_no fallback must remain limited to the four source-managed rooms'
    )
    assert(pipelineText.includes('req_commt'), 'Item rows must expose the CPOE required-comment condition')
    assert(pipelineText.includes('multi_specimen'), 'Item rows must expose the CPOE multi-specimen condition')
    assert(pipelineText.includes('item_comment'), 'Item rows must expose the persisted CPOE comment for source-managed rooms')
    assert(pipelineText.includes('lab_data.specimens'), 'multi-specimen rows must come from the CPOE payload')
    assert(pipelineText.includes('reject_reason_code'))
    assert(pipelineText.includes('reject_reason_detail'))
    assert(pipelineText.includes('cancel_reason'))
    assert(pipelineText.includes('cancelled_at'))

    const sectionFilterIndex = aggregateProvider.nosql.pipeline.findIndex(stage =>
      stage.$match && stage.$match['resolved_section.code']
    )
    const orderGroupIndex = aggregateProvider.nosql.pipeline.findIndex(stage =>
      stage.$group && stage.$group.items
    )
    assert(sectionFilterIndex >= 0, 'must filter Item by resolved LAB section')
    assert(orderGroupIndex >= 0, 'must group filtered Items back into their CPOE Order')
    assert(
      sectionFilterIndex < orderGroupIndex,
      'cross-section Order must be filtered at Item level before grouping by Order No.',
    )
    // 2026-09-03: one CPOE Order may contain several LAB Sections. Keep the
    // original Order ID/number, but never merge different rooms into one row.
    const orderGroup = aggregateProvider.nosql.pipeline[orderGroupIndex].$group
    assert.deepStrictEqual(orderGroup._id, {
      order_id: '$order._id',
      section_code: '$resolved_section.code',
    })
    const preGroupItemStatusFilterIndex = aggregateProvider.nosql.pipeline.findIndex((stage, index) =>
      index < orderGroupIndex && stage.$match && stage.$match.effective_status
    )
    assert.strictEqual(
      preGroupItemStatusFilterIndex,
      -1,
      'tab status must not remove rejected/cancelled siblings before grouping the Order',
    )
    const rowStatusStageIndex = aggregateProvider.nosql.pipeline.findIndex(stage =>
      stage.$addFields && stage.$addFields.row_filter_status
    )
    const rowStatusFilterIndex = aggregateProvider.nosql.pipeline.findIndex(stage =>
      stage.$match && stage.$match.row_filter_statuses
    )
    assert(rowStatusStageIndex > orderGroupIndex, 'row status must be derived only after every sibling Item is grouped')
    assert(rowStatusFilterIndex > rowStatusStageIndex, 'tab status must filter the complete Order+Section row')
    assert.deepStrictEqual(
      aggregateProvider.nosql.pipeline[rowStatusFilterIndex].$match.row_filter_statuses,
      { $in: ['sent'] },
    )
    const rowStatusesStage = aggregateProvider.nosql.pipeline.find(stage =>
      stage.$addFields && stage.$addFields.row_filter_statuses
    )
    assert(rowStatusesStage, 'mixed rows must retain terminal sibling states for tab filtering')
    const rowStatusesText = JSON.stringify(rowStatusesStage.$addFields.row_filter_statuses)
    assert(rowStatusesText.includes('rejected'))
    assert(rowStatusesText.includes('cancelled'))
    assert(rowStatusesText.includes('$$item.current_status'))
    const rowStatusExpression = aggregateProvider.nosql.pipeline[rowStatusStageIndex].$addFields.row_filter_status.$let
    assert.deepStrictEqual(
      rowStatusExpression.in.$switch.branches[0].then.$cond.slice(1),
      ['rejected', 'cancelled'],
      'all-rejected rows stay rejected; mixed terminal rows stay cancelled',
    )
    assert.deepStrictEqual(
      rowStatusExpression.in.$switch.branches.slice(1).map(branch => branch.then),
      ['sent', 'ready', 'completed', 'resulted', 'accepted', 'draft'],
      'row status precedence must keep unpaid/Finance-ready siblings in waiting and accepted siblings in received',
    )
    const rowStatusText = JSON.stringify(rowStatusExpression)
    assert(rowStatusText.includes('cancelled'))
    assert(rowStatusText.includes('rejected'))
    assert(rowStatusText.includes('returned'))
    assert(rowStatusText.includes('reversed'))
    assert(pipelineText.includes('row_key'), 'response must expose a unique Order+Section row key')
    assert(pipelineText.includes('cancel_scope'), 'cancellation lookup must distinguish Order and Section scope')
    assert(pipelineText.includes('item_ids'), 'Section cancellation must apply only to the cancelled Item IDs')

    // เพิ่ม 2026-09-07 ตามคำสั่งผู้ใช้: หน้า Worklist ต้องเริ่มด้วย Order ของวันปัจจุบัน
    // เหมือน Patient "ผู้มารับบริการวันนี้" โดยเป็น read filter เท่านั้น ไม่ลบ record
    const dailyScopeStage = aggregateProvider.nosql.pipeline.find(stage =>
      stage.$addFields && stage.$addFields.daily_scope_at
    )
    assert(dailyScopeStage, 'default Worklist must derive the status-time axis in the API')
    const dailyScopeText = JSON.stringify(dailyScopeStage.$addFields.daily_scope_at)
    assert(dailyScopeText.includes('work_item.received_at'))
    assert(dailyScopeText.includes('work_item.resulted_at'))
    assert(dailyScopeText.includes('work_item.latest_result_at'))
    assert(dailyScopeText.includes('work_item.updated_at'), 'legacy Partial rows need a safe display-time fallback')
    assert(dailyScopeText.includes('work_item.rejected_at'))
    assert(dailyScopeText.includes('work_item.cancelled_at'))
    assert(dailyScopeText.includes('sent_stage.stage_at'))
    const dailyStatusBranches = dailyScopeStage.$addFields.daily_scope_at.$switch.branches
    const completedDateBranch = dailyStatusBranches.find(branch =>
      branch.case && branch.case.$eq && branch.case.$eq[1] === 'completed'
    )
    const partialDateBranch = dailyStatusBranches.find(branch =>
      branch.case && branch.case.$eq && branch.case.$eq[1] === 'resulted'
    )
    assert(completedDateBranch, 'Final rows must have their own stable result-date branch')
    assert(partialDateBranch, 'Partial rows must keep their latest-result date branch')
    assert.strictEqual(
      completedDateBranch.then.$ifNull[0],
      '$work_item.resulted_at',
      'Final rows must remain on the original final-result day after a later note or correction',
    )
    assert.strictEqual(
      partialDateBranch.then.$ifNull[0],
      '$work_item.latest_result_at',
      'Partial rows must continue to follow their latest result update',
    )
    const dailyDateMatch = aggregateProvider.nosql.pipeline.find(stage =>
      stage.$match && stage.$match.daily_scope_day
    )
    assert(dailyDateMatch, 'default Worklist must enforce a current-day status-time scope')
    assert.deepStrictEqual(dailyDateMatch.$match.daily_scope_day, {
      $gte: '2026-08-31',
      $lte: '2026-08-31',
    })
    const dailyDateMatchIndex = aggregateProvider.nosql.pipeline.indexOf(dailyDateMatch)
    const setMasterLookupIndex = aggregateProvider.nosql.pipeline.findIndex(stage =>
      stage.$lookup && stage.$lookup.from === 'zdata_master_item_order' && stage.$lookup.as === 'set_master'
    )
    assert(
      setMasterLookupIndex > dailyDateMatchIndex && setMasterLookupIndex < orderGroupIndex,
      'set master metadata must run after daily scoping but before items[].panel is grouped',
    )
    assert(pipelineText.includes('daily_scope_day'), 'must normalize ISO and space-separated timestamps to YYYY-MM-DD')
    assert(pipelineText.includes('$substrCP'))
    assert(pipelineText.includes('$convert'))
    assert.deepStrictEqual(result.data.date_scope, {
      from: '2026-08-31',
      to: '2026-08-31',
      defaulted: true,
      all_dates: false,
      axis: 'status_time',
    })
  }

  // A partially rejected Order must be discoverable from the combined
  // Cancelled / Rejected tab even when an active sibling keeps its primary
  // operational bucket as sent/ready.
  {
    const captures = []
    const result = await Process(
      { statuses: ['cancelled', 'rejected'] },
      userAt('10'),
      makeApp(captures),
    )
    assert.strictEqual(result.success, true)
    const aggregateProvider = captures.find(provider => provider.from === 'zdata_cpoe_order_item')
    const mixedTerminalFilter = aggregateProvider.nosql.pipeline.find(stage =>
      stage.$match && stage.$match.row_filter_statuses
    )
    assert(mixedTerminalFilter, 'cancelled/rejected tab must filter the multi-bucket row status')
    assert.deepStrictEqual(mixedTerminalFilter.$match.row_filter_statuses, {
      $in: ['cancelled', 'rejected'],
    })
  }

  // The Today toolbar promises HN / VN / LN / Order No. / patient-name search.
  // Keep scanner/history HN exact, but route typed text through a safe literal
  // multi-field match after Work Item and CPOE Order have both been joined.
  {
    const captures = []
    const result = await Process({
      query: '2610010001',
      date_from: '2026-10-03',
      date_to: '2026-10-03',
    }, userAt('10'), makeApp(captures))
    assert.strictEqual(result.success, true)
    const aggregateProvider = captures.find(provider => provider.from === 'zdata_cpoe_order_item')
    assert(aggregateProvider, 'typed Today search must keep the proven Item-root pipeline')
    const searchStage = aggregateProvider.nosql.pipeline.find(stage =>
      stage.$match && Array.isArray(stage.$match.$or)
    )
    assert(searchStage, 'typed Today search must add a multi-field match')
    const searchText = JSON.stringify(searchStage.$match.$or)
    for (const field of [
      'order.order_number',
      'order.vid.pid.hn',
      'order.vid.vn',
      'work_item.lab_no',
      'lab_no',
      'item_no',
      'p_fname',
      'p_lname',
    ]) {
      assert(searchText.includes(field), 'typed Today search must include ' + field)
    }
    assert(searchText.includes('^R?2610010001$'), 'Order No. must accept the value with or without its R prefix')
    assert.strictEqual(
      searchStage.$match['order.vid.pid.hn'],
      undefined,
      'typed Today search must not be misrouted as exact HN',
    )
    assert(!aggregateProvider.nosql.pipeline.some(stage => stage.$match && stage.$match.daily_scope_day),
      'Order No. search must not be restricted by the selected date')
    assert.deepStrictEqual(result.data.date_scope, {
      from: '',
      to: '',
      defaulted: false,
      all_dates: false,
      axis: 'status_time',
    })
  }

  // Optional daily batching keeps the visible rows/total contract but derives
  // every status-tab count in the same aggregate instead of six extra calls.
  {
    const captures = []
    const result = await Process(
      { statuses: ['sent', 'ready'], include_status_counts: true },
      userAt('10'),
      makeApp(captures),
    )
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.total, 1)
    assert.strictEqual(result.data.orders.length, 1)
    assert.deepStrictEqual(result.data.status_counts, {
      waiting: 3,
      received: 3,
      partial: 4,
      complete: 5,
      cancelled: 13,
      all: 28,
    })

    const aggregateProviders = captures.filter(provider =>
      provider.from === 'zdata_cpoe_order_item' && provider.nosql && provider.nosql.type === 'aggregate'
    )
    assert.strictEqual(aggregateProviders.length, 1, 'batched refresh must use one Worklist aggregate')
    const pipeline = aggregateProviders[0].nosql.pipeline
    const rowStatusStageIndex = pipeline.findIndex(stage => stage.$addFields && stage.$addFields.row_filter_status)
    const globalStatusFilterIndex = pipeline.findIndex((stage, index) =>
      index > rowStatusStageIndex && stage.$match && stage.$match.row_filter_status
    )
    assert.strictEqual(globalStatusFilterIndex, -1, 'batched counts must retain all row-status buckets until the facet')
    const facetStage = pipeline.find(stage => stage.$facet)
    assert(facetStage && facetStage.$facet.status_counts, 'batched list must expose the status-count facet')
    assert.deepStrictEqual(facetStage.$facet.rows[0], {
      $match: { _row_filter_statuses: { $in: ['sent', 'ready'] } },
    })
    assert.deepStrictEqual(facetStage.$facet.meta[0], {
      $match: { _row_filter_statuses: { $in: ['sent', 'ready'] } },
    })
    assert.deepStrictEqual(facetStage.$facet.status_counts.at(-1), {
      $group: { _id: '$_row_filter_status', total: { $sum: 1 } },
    })
    assert.deepStrictEqual(facetStage.$facet.terminal_status_count, [
      { $match: { _row_filter_statuses: { $in: ['cancelled', 'rejected'] } } },
      { $count: 'total' },
    ], 'cancelled/rejected count must include a terminal Item inside a mixed Order')
    const globalSort = pipeline.find(stage => stage.$sort && stage.$sort.requested_at)
    assert.strictEqual(globalSort, undefined, 'batched counts must not sort rows that are used only for counters')
    assert.deepStrictEqual(facetStage.$facet.rows[1], {
      $sort: { requested_at: -1, order_number: -1 },
    })
  }

  // Historical result lookup is the only intentionally unbounded list path.
  // It must remain exact-HN + completed-only so a caller cannot expose the whole archive.
  {
    const captures = []
    const result = await Process(
      { hn: 'HN-1', statuses: ['completed'], all_dates: true },
      userAt('10'),
      makeApp(captures),
    )
    assert.strictEqual(result.success, true)
    const aggregateProvider = captures.find(provider => provider.from === 'zdata_cpoe_order_item')
    const dailyDateMatch = aggregateProvider.nosql.pipeline.find(stage =>
      stage.$match && stage.$match.daily_scope_day
    )
    assert.strictEqual(dailyDateMatch, undefined, 'exact-HN completed history must bypass daily scope')
    assert.deepStrictEqual(result.data.date_scope, {
      from: '',
      to: '',
      defaulted: false,
      all_dates: true,
      axis: 'status_time',
    })
  }

  {
    const result = await Process(
      { statuses: ['completed'], all_dates: true },
      userAt('10'),
      makeApp([]),
    )
    assert.strictEqual(result.success, false)
    assert(result.message.includes('HN'))
  }

  // 2026-09-21: cross-room history is a separate read-only path rooted at
  // CPOE Order so exact HN + created_at can use ipd_order_hn_created.
  {
    const captures = []
    const result = await Process(
      { cross_section: true, lookup_mode: 'results', hn: 'HN-1', all_dates: true, include_specimens: false },
      userAt('10'),
      makeApp(captures),
    )
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.cross_section, true)
    assert.strictEqual(result.data.lookup_mode, 'results')
    assert.deepStrictEqual(result.data.statuses, ['resulted', 'completed'])
    assert.deepStrictEqual(result.data.section_codes, ['BC', 'HM', 'HH', 'MB', 'MY', 'IM', 'MI-OUT'])
    assert.deepStrictEqual(result.data.date_scope, {
      from: '',
      to: '',
      defaulted: false,
      all_dates: true,
      axis: 'order_created_at',
    })
    const aggregateProvider = captures.find(provider => provider.from === 'zdata_cpoe_order')
    assert(aggregateProvider, 'cross-room lookup must start from CPOE Order')
    assert.deepStrictEqual(aggregateProvider.nosql.collections, ['zdata_cpoe_order'])
    const rootMatch = aggregateProvider.nosql.pipeline[0].$match
    assert.strictEqual(rootMatch['vid.pid.hn'], 'HN-1')
    assert.strictEqual(rootMatch.created_at, undefined, 'all dates + exact HN must not add a date scan')
    const groupIndex = aggregateProvider.nosql.pipeline.findIndex(stage => stage.$group && stage.$group.items)
    const mappedResultFilterIndex = aggregateProvider.nosql.pipeline.findIndex(stage =>
      stage.$match && stage.$match['items.current_status']
    )
    assert(groupIndex >= 0)
    assert(mappedResultFilterIndex > groupIndex,
      'result lookup must group all ordered siblings before requiring one mapped resulted/completed Item')
    assert.deepStrictEqual(
      aggregateProvider.nosql.pipeline[mappedResultFilterIndex].$match['items.current_status'],
      { $in: ['resulted', 'completed'] },
    )
  }

  {
    const captures = []
    const result = await Process(
      { cross_section: true, lookup_mode: 'orders', date_from: '2026-08-01', date_to: '2026-08-31' },
      userAt('10'),
      makeApp(captures),
    )
    assert.strictEqual(result.success, true)
    assert.deepStrictEqual(result.data.statuses, ['sent', 'accepted', 'prepared', 'ready', 'dispensed', 'resulted', 'completed', 'cancelled', 'rejected'])
    const aggregateProvider = captures.find(provider => provider.from === 'zdata_cpoe_order')
    assert.deepStrictEqual(aggregateProvider.nosql.pipeline[0].$match.created_at, {
      $gte: '2026-08-01',
      $lt: '2026-09-01',
    })
  }

  {
    const result = await Process(
      { cross_section: true, lookup_mode: 'results' },
      userAt('10'),
      makeApp([]),
    )
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'lookup_scope_required')
    assert(result.message.includes('HN'))
  }

  {
    const result = await Process(
      { cross_section: true, lookup_mode: 'orders', all_dates: true },
      userAt('10'),
      makeApp([]),
    )
    assert.strictEqual(result.success, false)
    assert(result.message.includes('HN'))
  }

  {
    const captures = []
    const result = await Process(
      { action: 'cancel_order', cross_section: true, lookup_mode: 'orders' },
      userAt('10'),
      makeApp(captures),
    )
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'cross_section_read_only')
    assert.strictEqual(captures.length, 0, 'cross-room write attempt must fail before any DB read/write')
  }

  {
    const captures = []
    const localOnly = await Process(
      { action: 'get_manual_result', organization_code: '10', item_id: manualItemId },
      userAt('10'),
      makeApp(captures),
    )
    assert.strictEqual(localOnly.success, false)
    assert(localOnly.message.includes('Section'), 'ordinary result reads must remain scoped to the current Organization')

    captures.length = 0
    const crossRoomRead = await Process(
      {
        action: 'get_manual_result',
        organization_code: '10',
        item_id: manualItemId,
        cross_section: true,
        lookup_mode: 'results',
      },
      userAt('10'),
      makeApp(captures),
    )
    assert.strictEqual(crossRoomRead.success, true, crossRoomRead.message)
    assert.strictEqual(crossRoomRead.data.section_code, 'MY')
    assert(captures.some(entry => entry.type === 'sdformGetAll'), 'cross-room result lookup must read persisted Result Items')
  }

  {
    const writeActions = [
      ['save_manual_result', { manual_result: { result_value: 'must-not-save' } }],
      ['save_pathology_results', { pathology_results: [{ specimen_index: 0, pathology_sub_index: 0, actual_site_name: 'หนังศีรษะ', result_value: 'must-not-save' }] }],
      ['save_result_edits', { results: [{ result_item_id: 'aaaaaaaaaaaaaaaaaaaaaaaa', result_value: 'must-not-save' }] }],
      ['save_result_attachments', { result_attachments: [{ name: 'must-not-save.pdf' }] }],
      ['set_result_visibility', { hidden: true, reason: 'must not save cross room' }],
    ]
    for (const [writeAction, extra] of writeActions) {
      const captures = []
      const result = await Process(
        {
          action: writeAction,
          organization_code: '10',
          item_id: manualItemId,
          cross_section: true,
          lookup_mode: 'results',
          ...extra,
        },
        userAt('10'),
        makeApp(captures),
      )
      assert.strictEqual(result.success, false, writeAction + ' must be blocked cross-room')
      assert.strictEqual(result.error, 'cross_section_read_only')
      assert.strictEqual(captures.length, 0, writeAction + ' must fail before any DB read/write')
    }
  }

  {
    const result = await Process(
      {
        action: 'get_manual_result',
        organization_code: '10',
        item_id: manualItemId,
        cross_section: true,
        lookup_mode: 'orders',
      },
      userAt('10'),
      makeApp([]),
    )
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'result_lookup_mode_required')
  }

  {
    const result = await Process(
      { cross_section: true, lookup_mode: 'results', hn: 'HN-1', all_dates: true },
      userAt('999'),
      makeApp([]),
    )
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'lab_user_required')
  }

  // 2026-09-27: every configured radiology Organization may use only the
  // read-only LAB lookup. Normal LAB worklist/write permissions stay closed.
  for (const organizationCode of ['m0900', 'm0901', 'CT']) {
    const captures = []
    const result = await Process(
      {
        organization_code: organizationCode,
        cross_section: true,
        lookup_mode: 'results',
        hn: 'HN-1',
        all_dates: true,
        include_specimens: false,
      },
      userAt(organizationCode),
      makeApp(captures),
    )
    assert.strictEqual(result.success, true, organizationCode + ' must be able to search LAB results')
    assert.strictEqual(result.data.cross_section, true)
    assert.deepStrictEqual(result.data.section_codes, ['BC', 'HM', 'HH', 'MB', 'MY', 'IM', 'MI-OUT'])
    assert(captures.some(provider => provider.from === 'zdata_cpoe_order'), 'radiology lookup must use the read-only cross-room query')

    const orderedItems = await Process(
      {
        organization_code: organizationCode,
        cross_section: true,
        lookup_mode: 'orders',
        date_from: '2026-08-01',
        date_to: '2026-08-31',
        include_specimens: false,
      },
      userAt(organizationCode),
      makeApp([]),
    )
    assert.strictEqual(orderedItems.success, true, organizationCode + ' must be able to search LAB orders read-only')
    assert.strictEqual(orderedItems.data.lookup_mode, 'orders')

    const localOnly = await Process(
      { organization_code: organizationCode },
      userAt(organizationCode),
      makeApp([]),
    )
    assert.strictEqual(localOnly.success, true)
    assert.deepStrictEqual(localOnly.data.orders, [], organizationCode + ' must not receive a LAB owner-room worklist')

    const writeCaptures = []
    const blockedWrite = await Process(
      {
        action: 'save_manual_result',
        organization_code: organizationCode,
        item_id: manualItemId,
        cross_section: true,
        lookup_mode: 'results',
        manual_result: { result_value: 'must-not-save' },
      },
      userAt(organizationCode),
      makeApp(writeCaptures),
    )
    assert.strictEqual(blockedWrite.success, false)
    assert.strictEqual(blockedWrite.error, 'cross_section_read_only')
    assert.strictEqual(writeCaptures.length, 0, 'radiology write attempts must fail before any DB access')
  }

  {
    const captures = []
    const result = await Process(
      { action: 'list_open_visits', organization_code: 'm1001' },
      userAt('m1001'),
      makeApp(captures),
    )
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.visit_date, '2026-08-31')
    assert.strictEqual(result.data.total, 1)
    assert.strictEqual(result.data.visits[0].vn, 'VN-TODAY-1')
    assert.deepStrictEqual(result.data.section_codes, ['BC'])
    assert.strictEqual(result.data.organization_code, 'M1001')

    /* เปลี่ยน assertion เดิม 2026-09-04 ตามที่ผู้ใช้สั่ง ("เช็คว่าดึง vn ต่อวันตาม Visit List ยัง")
       ของเดิมล็อกไว้ว่า query zdata_visit ต้องเป็น { visit_date: '2026-08-31' (=เป๊ะ), visit_status: true }
       ซึ่งไม่ใช่นิยามที่จอ Visit List ใช้จริง ⇒ ตอนนี้ล็อกสิ่งที่ assertion เดิมปกป้องไว้แทน คือ
       "ต้องอ่าน Visit ของวันนี้เท่านั้น + projection/limit ชุดเดิม" แต่ยอมให้เส้นทางมาจาก Visit Tran ได้ */
    const visitTranProvider = captures.find(provider => provider.from === 'zdata_visit_tran')
    assert(visitTranProvider, 'ต้องอ่านคิววันนี้จาก Visit Tran แบบเดียวกับกล่อง "ผู้มารับบริการวันนี้"')
    assert.deepStrictEqual(visitTranProvider.nosql.query.vtran_status, {
      $in: ['waiting', 'called', 'in_progress'],
    }, 'สถานะคิวต้องตรงกับ where ของ ListView ตัวจริง')
    assert.deepStrictEqual(visitTranProvider.nosql.query.$or, [
      { visit_date: { $gte: '2026-08-31', $lt: '2026-09-01' } },
      { checkin_at: { $gte: '2026-08-31', $lt: '2026-09-01' } },
    ], 'ต้องกรองเฉพาะคิวของวันนี้')

    const visitProvider = captures.find(provider => provider.from === 'zdata_visit')
    assert(visitProvider, 'must query Visit records for the LAB manual-order launcher')
    assert.deepStrictEqual(visitProvider.nosql.query, {
      xrstatx: { $nin: [0, 3] },
      _id: { $in: ['VISIT-TODAY-1'] },
    }, 'ดึง Visit ตาม vid ที่ Visit List วันนี้ชี้มา')
    assert.strictEqual(result.data.source, 'visit_tran')
    assert.strictEqual(result.data.visit_tran_total, 1)
    assert.strictEqual(visitProvider.nosql.projection['pid.hn'], 1)
    assert.strictEqual(Object.prototype.hasOwnProperty.call(visitProvider.nosql.projection, 'pid.p_pic'), false)
    assert.strictEqual(visitProvider.nosql.limit, 2000)
  }

  {
    const captures = []
    const result = await Process(
      { action: 'list_open_visits', organization_code: 'm1001', hn: '6900001' },
      userAt('m1001'),
      makeApp(captures),
    )
    assert.strictEqual(result.success, true)
    const visitProvider = captures.find(provider => provider.from === 'zdata_visit')
    assert.strictEqual(visitProvider.nosql.query['pid.hn'], '6900001', 'exact HN launcher lookup must be filtered server-side')
  }

  /* ── ชั้นสอง: ไม่มีคิวใน Visit Tran ⇒ ยังต้องอ่าน zdata_visit ของวันนี้ได้เหมือนเดิม ──
     ของเดิมเทียบ visit_date แบบ "=" กับ 'YYYY-MM-DD' และบังคับ visit_status === true
     ซึ่งได้ 0 แถวเงียบ ๆ ถ้าค่าที่เก็บมีเวลาต่อท้าย (ฟิลด์เป็น date-input dateType datetime)
     หรือเอกสารเก่าไม่มีฟิลด์ visit_status ⇒ ผ่อนเป็นช่วงวัน + $ne:false */
  {
    const captures = []
    const result = await Process(
      { action: 'list_open_visits', organization_code: 'm1001' },
      userAt('m1001'),
      makeApp(captures, { visitTranRows: [] }),
    )
    assert.strictEqual(result.success, true, result.message)
    assert.strictEqual(result.data.source, 'visit_day')
    assert.strictEqual(result.data.visit_tran_total, 0)
    assert.strictEqual(result.data.visits[0].vn, 'VN-TODAY-1')

    const visitProvider = captures.find(provider => provider.from === 'zdata_visit')
    assert.deepStrictEqual(visitProvider.nosql.query, {
      xrstatx: { $nin: [0, 3] },
      visit_date: { $gte: '2026-08-31', $lt: '2026-09-01' },
      visit_status: { $ne: false },
    })
    assert.strictEqual(visitProvider.nosql.limit, 2000)
  }

  /* ── Organization ที่ไม่มี Section LAB ต้องยังขอรายการ Visit ได้ (2026-09-03) ──
     `list_open_visits` เป็นรายการ Visit ของทั้งโรงพยาบาลในวันนี้ ไม่ได้ใช้ Section เลย
     เดิมมันอยู่ใต้ด่าน "Organization นี้ไม่มี Section LAB" ⇒ หมอที่คลินิกหรือห้องรังสี
     จะได้ payload ของ list กลับไปแทน แล้วกล่องเลือก VN ขึ้นว่ารูปแบบข้อมูลไม่ถูกต้อง
     (เจอตอนต่อกล่องเลือก VN ในจอ CPOE Order App) */
  {
    const captures = []
    const result = await Process(
      { action: 'list_open_visits', organization_code: '19.P' },
      userAt('19.P'),
      makeApp(captures),
    )
    assert.strictEqual(result.success, true, result.message)
    assert(Array.isArray(result.data.visits), 'ต้องได้รายการ Visit ไม่ใช่ payload ของ list')
    assert.strictEqual(result.data.visits[0].vn, 'VN-TODAY-1')
    assert.deepStrictEqual(result.data.section_codes, [], 'ไม่มี Section ก็ตอบเป็นรายการว่างได้ ไม่ต้องตัดจบ')
    assert(captures.find(provider => provider.from === 'zdata_visit'), 'ยังอ่าน Visit เหมือนเดิม')
  }

  /* action อื่นยังต้องโดนด่าน Section เหมือนเดิม — ห้ามหลุดการป้องกันไปด้วย */
  {
    const result = await Process({ organization_code: '19.P' }, userAt('19.P'), makeApp([]))
    assert.strictEqual(result.success, true)
    assert.deepStrictEqual(result.data.orders, [], 'Organization ที่ไม่มี Section LAB ยังไม่เห็นรายการ')
    assert(result.message.includes('ไม่พบ Section LAB'), result.message)
  }

  {
    const captures = []
    const result = await Process({ organization_code: 'm0104' }, userAt('m0104'), makeApp(captures))
    assert.strictEqual(result.success, true)
    assert.deepStrictEqual(result.data.section_codes, ['HM', 'HH'])
    const aggregateProvider = captures.find(provider => provider.from === 'zdata_cpoe_order_item')
    const sectionMatch = aggregateProvider.nosql.pipeline.find(stage =>
      stage.$match && stage.$match['resolved_section.code']
    )
    assert.deepStrictEqual(sectionMatch.$match['resolved_section.code'].$in, ['HM', 'HH'])
  }

  {
    const captures = []
    const result = await Process(
      { action: 'list_cbc_swap', organization_code: 'm0104', include_specimens: false },
      userAt('m0104'),
      makeApp(captures),
    )
    assert.strictEqual(result.success, true, result.message)
    assert.deepStrictEqual(result.data.section_codes, ['HM', 'ML'])
    const provider = captures.find(entry => entry.from === 'zdata_cpoe_order_item' && entry.nosql.type === 'aggregate')
    assert(provider, 'CBC swap list must read CPOE Items without mutating them')
    const pipelineText = JSON.stringify(provider.nosql.pipeline)
    assert(pipelineText.includes('HM1'))
    assert(pipelineText.includes('MS1'))
    assert(pipelineText.includes('cbc_swap_allowed'))
    assert(pipelineText.includes('cbc_items'))
    assert(pipelineText.includes('zdata_lab_work_item'))
  }

  {
    const itemId = '121212121212121212121212'
    const orderId = '131313131313131313131313'
    const hmMasterId = '141414141414141414141414'
    const msMasterId = '151515151515151515151515'
    const sourceItem = {
      _id: itemId,
      xrstatx: 1,
      current_status: 'sent',
      service_type: { value: 'lab' },
      item_data_id: hmMasterId,
      item_code: 'HM1',
      item_name: 'CBC ( Complete Blood Count )',
      order_id: { value: orderId },
    }
    const originalItem = JSON.parse(JSON.stringify(sourceItem))
    const order = { _id: orderId, xrstatx: 1, order_number: 'R2609220009', created_at: '2026-09-22 10:30:00', vid: { vn: 'VN-CBC', pid: { hn: '6900001', p_fname: 'CBC', p_lname: 'Patient' } } }
    const masters = new Map([
      [hmMasterId, { _id: hmMasterId, xrstatx: 1, item_code: 'HM1', item_name: 'CBC ( Complete Blood Count )', section: { code: 'HM', name: 'Hematology' } }],
      [msMasterId, { _id: msMasterId, xrstatx: 1, item_code: 'MS1', item_name: 'CBC', section: { code: 'ML', name: 'Clinical Microscopy' } }],
    ])
    const works = new Map()
    const workCollection = {
      findOne: async query => {
        const row = works.get(itemId)
        if (!row) return null
        if (query.cbc_swap_active === true && row.cbc_swap_active !== true) return null
        return JSON.parse(JSON.stringify(row))
      },
      insertOne: async doc => { works.set(String(doc._id), JSON.parse(JSON.stringify(doc))); return { insertedId: doc._id } },
      updateOne: async (query, update) => {
        const row = works.get(itemId)
        if (!row || query.cbc_swap_active === true && row.cbc_swap_active !== true || query.work_status && row.work_status !== query.work_status || query.lab_no && !query.lab_no.$in.includes(row.lab_no)) return { matchedCount: 0, modifiedCount: 0 }
        Object.assign(row, JSON.parse(JSON.stringify(update.$set || {})))
        Object.entries(update.$inc || {}).forEach(([key, value]) => { row[key] = Number(row[key] || 0) + Number(value || 0) })
        Object.entries(update.$push || {}).forEach(([key, value]) => { row[key] = Array.isArray(row[key]) ? row[key] : []; row[key].push(JSON.parse(JSON.stringify(value))) })
        return { matchedCount: 1, modifiedCount: 1 }
      },
    }
    const app = {
      isAuth: () => true,
      dbObjectId: value => String(value),
      curDate: () => '2026-09-22 10:35:00',
      dbFindAll: async provider => provider.from === 'zdata_section'
        ? { success: true, reply: { data: sections } }
        : { success: true, reply: { data: [] } },
      db: { collection: name => ({
        zdata_cpoe_order_item: { findOne: async query => String(query._id) === itemId ? JSON.parse(JSON.stringify(sourceItem)) : null },
        zdata_cpoe_order: { findOne: async query => String(query._id) === orderId ? JSON.parse(JSON.stringify(order)) : null },
        zdata_master_item_order: { findOne: async query => query.item_code ? Array.from(masters.values()).find(row => row.item_code === query.item_code) : masters.get(String(query._id)) || null },
        zdata_section: { findOne: async () => null },
        zdata_lab_work_item: workCollection,
      })[name] },
    }
    const first = await Process({ action: 'swap_cbc_item', organization_code: 'm0104', item_id: itemId, reason: 'ส่งผิดห้อง' }, userAt('m0104'), app)
    assert.strictEqual(first.success, true, first.message)
    assert.strictEqual(first.data.effective_item_code, 'MS1')
    assert.strictEqual(works.get(itemId).section_code, 'ML')
    assert.strictEqual(works.get(itemId).cbc_swap_history.length, 1)
    assert.deepStrictEqual(sourceItem, originalItem, 'CBC swap must not rewrite the doctor-ordered CPOE Item')

    const second = await Process({ action: 'swap_cbc_item', organization_code: 'm0104', item_id: itemId }, userAt('m0104'), app)
    assert.strictEqual(second.success, true, second.message)
    assert.strictEqual(second.data.effective_item_code, 'HM1')
    assert.strictEqual(works.get(itemId).cbc_swap_history.length, 2, 'swap-back must append audit instead of replacing it')
    works.get(itemId).lab_no = '206909220001'
    const blocked = await Process({ action: 'swap_cbc_item', organization_code: 'm0104', item_id: itemId }, userAt('m0104'), app)
    assert.strictEqual(blocked.success, false)
    assert.strictEqual(blocked.error, 'cbc_already_received')
  }

  {
    const captures = []
    const result = await Process(
      {
        action: 'update_specimen',
        organization_code: 'm0104',
        item_id: writeItemId,
        specimen_code: 'BL',
      },
      userAt('m0104'),
      makeApp(captures),
    )
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.specimen_name, 'Blood')
    const specimenLookup = captures.find(entry => entry.from === 'zdata_lab_spec')
    assert(specimenLookup, 'specimen correction must validate against the CPOE Order dropdown source')
    assert.deepStrictEqual(specimenLookup.nosql.query, { xrstatx: 1, code: 'BL' })
    assert.strictEqual(specimenLookup.nosql.limit, 1)
    assert(!captures.some(entry => entry.from === 'zdata_specimen_code'))
    const update = captures.find(entry => entry.type === 'update')
    assert(update, 'must persist specimen selection')
    assert.strictEqual(update.from, 'zdata_cpoe_order_item')
    assert.strictEqual(update.data.lab_data.spec_source, 'Blood')
    assert.strictEqual(update.data.lab_data.spec_source_code, 'BL')
    assert.strictEqual(update.data.lab_data.specimen_at, '2026-08-30T09:00')
    assert.deepStrictEqual(update.filter.current_status.$in, ['sent', 'ready', 'accepted', 'prepared', 'dispensed'])
    assert.deepStrictEqual(update.filter.received_at.$in, [null, ''])
    assert.deepStrictEqual(update.filter.lab_no.$in, [null, ''])
  }

  // 2026-10-03: only IM/MI-OUT keep the immutable order-time specimen.
  for (const [writeSectionCode, organizationCode] of [['IM', 'm1006'], ['MI-OUT', 'm1006']]) {
    const captures = []
    const result = await Process(
      {
        action: 'update_specimen',
        organization_code: organizationCode,
        item_id: writeItemId,
        specimen_code: 'BL',
      },
      userAt(organizationCode),
      makeApp(captures, { writeSectionCode }),
    )
    assert.strictEqual(result.success, false)
    assert(result.message.includes('IM และ MI-OUT'), writeSectionCode + ': ' + result.message)
    assert(!captures.some(entry => entry.type === 'update'), writeSectionCode + ' must not update specimen')
    assert(!captures.some(entry => entry.from === 'zdata_lab_spec'), writeSectionCode + ' must stop before specimen option lookup')
  }

  for (const [writeSectionCode, organizationCode] of [['MY', 'm1000'], ['MB', 'm1005']]) {
    const captures = []
    const result = await Process(
      {
        action: 'update_specimen',
        organization_code: organizationCode,
        item_id: writeItemId,
        specimen_code: 'BL',
      },
      userAt(organizationCode),
      makeApp(captures, { writeSectionCode, writeLabNo: writeSectionCode + '2610030001' }),
    )
    assert.strictEqual(result.success, true, writeSectionCode + ': ' + result.message)
    const update = captures.find(entry => entry.type === 'update')
    assert(update, writeSectionCode + ' must update specimen')
    assert.strictEqual(update.data.lab_data.spec_source_code, 'BL')
    assert.strictEqual(Object.prototype.hasOwnProperty.call(update.filter, 'lab_no'), false, writeSectionCode + ' order-issued LAB NO. must not block pre-receipt specimen correction')
  }

  {
    const captures = []
    const originalRows = [
      { spec_source: 'Hemoculture ขวดที่1', spec_source_code: 'BC1', spec_site_name: 'ข้อพับแขน', spec_note: 'ห้ามเปลี่ยนตำแหน่ง' },
      { spec_source: 'Stool', spec_source_code: 'ST', spec_site_name: 'หลัง / ก้นเอว' },
    ]
    const result = await Process(
      {
        action: 'update_specimen',
        organization_code: 'm1005',
        item_id: writeItemId,
        specimen_code: 'BL',
        specimen_index: 0,
      },
      userAt('m1005'),
      makeApp(captures, {
        writeSectionCode: 'MB',
        writeLabNo: '402610030001',
        writeLabData: { specimens: originalRows },
      }),
    )
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.specimen_index, 0)
    const update = captures.find(entry => entry.type === 'update')
    assert.strictEqual(update.data.lab_data.specimens[0].spec_source, 'Blood')
    assert.strictEqual(update.data.lab_data.specimens[0].spec_source_code, 'BL')
    assert.strictEqual(update.data.lab_data.specimens[0].spec_site_name, 'ข้อพับแขน', 'location must remain read-only')
    assert.strictEqual(update.data.lab_data.specimens[0].spec_note, 'ห้ามเปลี่ยนตำแหน่ง')
    assert.deepStrictEqual(update.data.lab_data.specimens[1], originalRows[1], 'other specimen rows must remain unchanged')
    assert.strictEqual(Object.prototype.hasOwnProperty.call(update.data.lab_data, 'spec_source'), false, 'row edit must not overwrite the top-level specimen')
  }

  {
    // Worklist ต้องยอมรับ code จาก Lab Specimen dropdown ชุดเดียวกับ CPOE Order
    // โดยไม่จำกัดเฉพาะค่าเริ่มต้นที่ผูกบน test นั้น.
    const captures = []
    const result = await Process(
      {
        action: 'update_specimen',
        organization_code: 'm0104',
        item_id: writeItemId,
        specimen_code: 'IC',
      },
      userAt('m0104'),
      makeApp(captures),
    )
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.specimen_code, 'IC')
    assert.strictEqual(result.data.specimen_name, 'Ionized Calcium Blood')
    const configuredLookup = captures.find(entry => entry.from === 'zdata_lab_spec')
    assert(configuredLookup, 'specimen correction must use the active Lab Specimen master')
    const update = captures.find(entry => entry.type === 'update')
    assert.strictEqual(update.data.lab_data.spec_source_code, 'IC')
    assert.strictEqual(update.data.lab_data.spec_source, 'Ionized Calcium Blood')
  }

  {
    // 2026-09-03 regression: list normalizes legacy accepted-without-receipt to
    // sent, so specimen correction must use the same effective waiting rule.
    const captures = []
    const result = await Process(
      {
        action: 'update_specimen',
        organization_code: 'm0104',
        item_id: writeItemId,
        specimen_code: 'BL',
      },
      userAt('m0104'),
      makeApp(captures, { writeStatus: 'accepted' }),
    )
    assert.strictEqual(result.success, true)
    assert(captures.some(entry => entry.type === 'update'), 'legacy effective-waiting Item remains editable')
  }

  {
    const result = await Process(
      {
        action: 'update_specimen',
        organization_code: 'm0104',
        item_id: writeItemId,
        specimen_code: 'BL',
      },
      userAt('m0104'),
      makeApp([], { writeStatus: 'accepted', writeLabNo: 'HH2609030001' }),
    )
    assert.strictEqual(result.success, false)
    assert(result.message.includes('ยังรอรับ'), 'receipt evidence must still lock specimen correction')
  }

  {
    const result = await Process(
      {
        action: 'update_specimen',
        organization_code: 'm0104',
        item_id: writeItemId,
        specimen_code: 'BL',
      },
      userAt('m0104'),
      makeApp([], { writeStatus: 'accepted', writeWorkStatus: 'received' }),
    )
    assert.strictEqual(result.success, false)
    assert(result.message.includes('ยังรอรับ'), 'received Work Item must still lock specimen correction')
  }

  {
    const captures = []
    const result = await Process(
      {
        action: 'update_specimen',
        organization_code: 'm0104',
        item_id: writeItemId,
        specimen_code: 'BL',
      },
      userAt('m0104'),
      makeApp(captures, {
        writeCancellation: {
          _id: '121212121212121212121212',
          cancel_scope: 'section',
          section_codes: ['HH'],
          cancel_status: 'applied',
        },
      }),
    )
    assert.strictEqual(result.success, false)
    assert(result.message.includes('ถูกยกเลิก'), 'matching Section cancellation must lock specimen correction')
    const lookup = captures.find(entry => entry.type === 'cancellationLookup')
    assert(lookup)
    assert.strictEqual(lookup.query.source_order_id, 'ffffffffffffffffffffffff')
    assert.deepStrictEqual(lookup.query.$or[1], { cancel_scope: 'section', section_codes: 'HH' })
  }

  {
    const result = await Process(
      {
        action: 'update_specimen',
        organization_code: 'm1001',
        item_id: writeItemId,
        specimen_code: 'BL',
      },
      userAt('m1001'),
      makeApp([]),
    )
    assert.strictEqual(result.success, false)
    assert(result.message.includes('Section'))
  }

  {
    const captures = []
    const result = await Process({ organization_code: 'm1005' }, userAt('m1005'), makeApp(captures))
    assert.strictEqual(result.success, true)
    assert.deepStrictEqual(result.data.section_codes, ['MB'])
    assert.deepStrictEqual(result.data.sections.map(section => section.code), ['MB'])
    assert.strictEqual(result.data.organization_code, 'M1005')
  }

  {
    const captures = []
    const result = await Process({ organization_code: 'm1000' }, userAt('m1000'), makeApp(captures))
    assert.strictEqual(result.success, true)
    assert.deepStrictEqual(result.data.section_codes, ['MY'])
    assert.deepStrictEqual(result.data.sections.map(section => section.code), ['MY'])
    assert.strictEqual(result.data.organization_code, 'M1000')
  }

  {
    const captures = []
    const result = await Process(
      { action: 'get_manual_result', organization_code: 'm1000', item_id: manualItemId },
      userAt('m1000'),
      makeApp(captures),
    )
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.section_code, 'MY')
    assert.strictEqual(result.data.visit_vn, 'VN-NEW')
    assert.strictEqual(result.data.unit, 'CFU/mL')
    assert.strictEqual(result.data.reference_range, 'Not detected')
    assert.strictEqual(result.data.previous.value, 'Candida albicans')
    assert.strictEqual(result.data.previous.visit_vn, 'VN-OLD')
    assert.strictEqual(result.data.results[0].previous.value, 'Candida albicans')
    assert.strictEqual(result.data.results[0].result_value, '')
  }

  {
    const captures = []
    const result = await Process(
      { action: 'get_manual_result', organization_code: 'm1000', item_id: manualItemId },
      userAt('m1000'),
      makeApp(captures, { legacyLookupFails: true }),
    )
    assert.strictEqual(result.success, true, 'disabled legacy Result Form must behave like an empty optional source')
    assert.strictEqual(result.data.test_name, 'Fungal culture')
    assert.strictEqual(result.data.patient_hn, 'HN-TEST')
    assert.strictEqual(result.data.lab_no, 'MY2608310001')
    assert.deepStrictEqual(result.data.results, [])
  }

  {
    const captures = []
    const rawMlabValue = [
      'SPECIMEN: Blood-Hemoculture 1',
      ' * Aerobic Culture *',
      ' 1. Example organism',
    ].join('\n')
    const result = await Process(
      { action: 'get_manual_result', organization_code: 'm1005', item_id: manualItemId },
      userAt('m1005'),
      makeApp(captures, {
        manualSectionCode: 'MB',
        unmatchedReceiptRows: [{
          _id: 'abababababababababababab',
          receipt_status: 'unmatched',
          order_no: manualItemId,
          filler_order_no: 'MY2608310001',
          hn: 'HN-TEST',
          visit_id: 'VN-NEW',
          result_uid: 'RESULT-MB-MISMATCH-1',
          report_seq: '2',
          stage: 'preliminary',
          reported_at: '2026-08-31 09:30:00',
          unmatched_item_count: 1,
          error_message: 'ไม่มี obs_code ใดตรงกับ test_code ของ Lab Order',
          raw_payload_json: JSON.stringify({
            order_no: manualItemId,
            filler_order_no: 'MY2608310001',
            hn: 'HN-TEST',
            visit_id: 'VN-NEW',
            items: [{ obs_code: 'UNEXPECTED-MB', obs_name: 'Unexpected MLab item', value: rawMlabValue, obx_status: 'F' }],
          }),
        }, {
          _id: 'cdcdcdcdcdcdcdcdcdcdcdcd',
          receipt_status: 'unmatched',
          order_no: 'OTHER-ORDER',
          filler_order_no: 'MY2608310001',
          hn: 'HN-TEST',
          visit_id: 'VN-NEW',
          result_uid: 'RESULT-OTHER-ORDER',
          error_message: 'ไม่มี obs_code ใดตรงกับ test_code ของ Lab Order',
          items_json: JSON.stringify([{ obs_code: 'OTHER', value: 'must not leak' }]),
        }],
      }),
    )
    assert.strictEqual(result.success, true)
    assert(!result.data.results.some(row => row.result_value), 'unmatched Receipt must not become a clinical Result Item')
    assert.strictEqual(result.data.unmatched_receipts.length, 1, 'only the exact Order identity may feed the fallback viewer')
    assert.strictEqual(result.data.unmatched_receipts[0].receipt_id, 'abababababababababababab')
    assert.strictEqual(result.data.unmatched_receipts[0].items[0].obs_code, 'UNEXPECTED-MB')
    assert.strictEqual(result.data.unmatched_receipts[0].items[0].value, rawMlabValue)
    assert(!captures.some(entry => ['insertData', 'sdformSetOne', 'update'].includes(entry.type)), 'fallback lookup must remain read-only')
    const receiptLookup = captures.find(entry => entry.type === 'sdformGetAll' && entry.provider.providerId === RESULT_RECEIPT_FORM_ID)
    assert(receiptLookup)
    assert.deepStrictEqual(receiptLookup.provider.params, { labNo: 'MY2608310001', patientHn: 'HN-TEST', visitVn: 'VN-NEW' })
  }

  {
    const captures = []
    const result = await Process(
      { action: 'get_manual_result', organization_code: 'm1000', item_id: manualItemId },
      userAt('m1000'),
      makeApp(captures, {
        canonicalCurrent: [{
          _id: 'CURRENT-RESULT',
          result_definition_id: 'DEF-HGB',
          order_no: '999999999999999999999999',
          hn: 'HN-TEST',
          visit_id: 'VN-NEW',
          obs_code: 'HGB',
          obs_name: 'Hemoglobin',
          result_value: '12.4',
          result_comment: 'ตรวจยืนยันซ้ำแล้ว\nแสดงหมายเหตุจาก LIS',
          units: 'g/dL',
          result_status: 'corrected',
          result_version: '3',
          entered_at: '2026-08-31 09:30:00',
          reported_at: '2026-08-31 09:28:00',
          reported_by_source_id: 'TECH001',
          reported_by_source_name: 'นักเทคนิคการแพทย์ ทดสอบ',
          verified_at: '2026-08-31 09:29:00',
          verified_by_source_id: 'SUP001',
          verified_by_source_name: 'ผู้ตรวจสอบ ทดสอบ',
          last_edited_by: 'ผู้แก้ผล',
          last_edited_at: '2026-08-31 09:40:00',
          result_source: 'agent',
        }],
        canonicalPrevious: [{
          _id: 'PREVIOUS-RESULT',
          result_definition_id: 'DEF-HGB',
          order_no: 'OLDER-WORK-ITEM',
          hn: 'HN-TEST',
          visit_id: 'VN-OLD-HGB',
          obs_code: 'HGB',
          obs_name: 'Hemoglobin',
          result_value: '10.0',
          units: 'g/dL',
          result_status: 'final',
          result_version: '1',
          entered_at: '2026-07-31 08:00:00',
          result_source: 'agent',
        }],
      }),
    )
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.results.length, 1)
    assert.strictEqual(result.data.results[0].test_code, 'HGB')
    assert.strictEqual(result.data.results[0].previous.value, '10.0')
    assert.strictEqual(result.data.results[0].previous.visit_vn, 'VN-OLD-HGB')
    assert.strictEqual(result.data.results[0].result_value, '12.4')
    assert.strictEqual(result.data.results[0].result_comment, 'ตรวจยืนยันซ้ำแล้ว\nแสดงหมายเหตุจาก LIS')
    assert.strictEqual(result.data.results[0].last_edited_by, 'ผู้แก้ผล')
    // 2026-09-23 regression: the read-only result popup needs the Agent/LIS
    // reporter snapshot without changing any result-write authorization.
    assert.strictEqual(result.data.reported_by_source_name, 'นักเทคนิคการแพทย์ ทดสอบ')
    assert.strictEqual(result.data.reported_at, '2026-08-31 09:28:00')
    assert.strictEqual(result.data.results[0].reported_by_source_id, 'TECH001')
    assert.strictEqual(result.data.results[0].verified_by_source_name, 'ผู้ตรวจสอบ ทดสอบ')
  }

  {
    // Agent persistence keeps reporter/verifier snapshots on the Result Report
    // parent. Result Items link to that parent but do not duplicate the fields.
    const captures = []
    const reportId = 'abababababababababababab'
    const result = await Process(
      { action: 'get_manual_result', organization_code: 'm1000', item_id: manualItemId },
      userAt('m1000'),
      makeApp(captures, {
        canonicalCurrent: [{
          _id: 'CURRENT-CHILD-RESULT',
          result_report_id: reportId,
          xparentx: reportId,
          result_uid: 'RESULT-PARENT-META',
          order_no: '999999999999999999999999',
          hn: 'HN-TEST',
          visit_id: 'VN-NEW',
          obs_code: 'HGB',
          obs_name: 'Hemoglobin',
          result_value: '12.4',
          result_status: 'final',
          result_version: '1',
          entered_at: '2026-08-31 09:30:00',
          entered_by: 'ผู้รายงานจาก Result Item',
          result_source: 'agent',
        }],
        canonicalReports: [{
          _id: reportId,
          order_no: '999999999999999999999999',
          result_uid: 'RESULT-PARENT-META',
          reported_at: '2026-08-31 09:28:00',
          reported_by_source_id: 'TECH001',
          reported_by_source_name: 'ผู้รายงานจาก Result Report',
          verified_at: '2026-08-31 09:29:00',
          verified_by_source_id: 'APPROVER001',
          verified_by_source_name: 'ผู้ยืนยันจาก Result Report',
          order_note: 'หมายเหตุระดับ Order\nจาก Agent',
        }],
      }),
    )
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.reported_by_source_name, 'ผู้รายงานจาก Result Report')
    assert.strictEqual(result.data.verified_by_source_name, 'ผู้ยืนยันจาก Result Report')
    assert.strictEqual(result.data.order_note, 'หมายเหตุระดับ Order\nจาก Agent')
    assert.strictEqual(result.data.results[0].order_note, undefined, 'order note must remain separate from analyte results')
    assert.strictEqual(result.data.results[0].reported_by_source_name, 'ผู้รายงานจาก Result Report')
    assert.strictEqual(result.data.results[0].verified_by_source_id, 'APPROVER001')
    assert.strictEqual(result.data.results[0].verified_by_source_name, 'ผู้ยืนยันจาก Result Report')
    const reportLookup = captures.find(entry => entry.type === 'sdformGetAll' && entry.provider.providerId === RESULT_REPORT_FORM_ID && entry.provider.options.where.includes('order_no = :workItemId'))
    assert(reportLookup, 'result viewer must load parent Result Report metadata')
  }

  {
    // A later Agent callback can update Result Item.result_uid while leaving
    // result_report_id on an older report revision. The read-only popup must
    // resolve the exact result_uid first so the latest order_note survives.
    const captures = []
    const staleReportId = 'acacacacacacacacacacacac'
    const latestReportId = 'adadadadadadadadadadadad'
    const latestResultUid = 'RESULT-LATEST-NOTE'
    const result = await Process(
      { action: 'get_manual_result', organization_code: 'm1000', item_id: manualItemId },
      userAt('m1000'),
      makeApp(captures, {
        canonicalCurrent: [{
          _id: 'ACTOR-ONLY-CHILD',
          result_report_id: staleReportId,
          xparentx: staleReportId,
          result_uid: latestResultUid,
          order_no: '999999999999999999999999',
          obs_code: 'HGB',
          obs_name: 'Hemoglobin',
          result_value: '12.4',
          result_status: 'final',
          result_version: '1',
          entered_at: '2026-08-31 09:30:00',
          result_source: 'agent',
        }],
        canonicalReportOrderLookup: [{
          _id: staleReportId,
          order_no: '999999999999999999999999',
          result_uid: 'RESULT-OLD-REVISION',
          reported_at: '2026-08-31 08:00:00',
          reported_by_source_name: 'ผู้รายงาน revision เก่า',
          verified_at: '2026-08-31 08:01:00',
          verified_by_source_name: 'ผู้ยืนยัน revision เก่า',
          order_note: '',
        }],
        canonicalReports: [{
          _id: latestReportId,
          order_no: 'ORDER-NOT-MATCHED-BY-LEGACY-LOOKUP',
          result_uid: latestResultUid,
          reported_at: '2026-08-31 09:28:00',
          reported_by_source_name: 'ผู้รายงานจาก Agent',
          verified_at: '2026-08-31 09:29:00',
          verified_by_source_name: 'ผู้ยืนยันจาก Agent',
          order_note: 'หมายเหตุจาก revision ล่าสุด',
        }],
      }),
    )
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.reported_by_source_name, 'ผู้รายงานจาก Agent')
    assert.strictEqual(result.data.verified_by_source_name, 'ผู้ยืนยันจาก Agent')
    assert.strictEqual(result.data.order_note, 'หมายเหตุจาก revision ล่าสุด')
    const resultParentLookup = captures.find(entry => entry.from === 'zdata_lab_report_manual_entry')
    assert(resultParentLookup, 'normal result read must fall back to the exact Result Report revision')
    const resultUidLookup = resultParentLookup.nosql.query.$or.find(clause => clause.result_uid)
    assert(resultUidLookup, 'fallback must query Result Report by result_uid')
    assert.deepStrictEqual(resultUidLookup.result_uid.$in, [latestResultUid])
  }

  {
    // A non-anchor Item in a shared LAB NO. batch must read the batch order_no,
    // then expose only the result that belongs to that Item in Item-level UI.
    const captures = []
    const batchId = 'abababababababababababab'
    const result = await Process(
      { action: 'get_manual_result', organization_code: 'm1000', item_id: manualItemId },
      userAt('m1000'),
      makeApp(captures, {
        manualWorkPatch: { receipt_batch_id: batchId, batch_item_count: 2 },
        manualMasterLabPatch: { his_lab_code: 'MY-CULTURE-EXT' },
        canonicalCurrent: [{
          _id: 'BATCH-RESULT-EXPECTED',
          order_no: batchId,
          hn: 'HN-TEST',
          visit_id: 'VN-NEW',
          obs_code: 'MY-CULTURE-EXT',
          obs_name: 'Fungal culture',
          result_value: 'Detected',
          result_status: 'final',
          result_version: '1',
          result_source: 'agent',
        }, {
          _id: 'BATCH-RESULT-OTHER',
          order_no: batchId,
          hn: 'HN-TEST',
          visit_id: 'VN-NEW',
          obs_code: 'OTHER-EXT',
          obs_name: 'Other test in same LAB NO.',
          result_value: '42',
          result_status: 'final',
          result_version: '1',
          result_source: 'agent',
        }],
      }),
    )
    assert.strictEqual(result.success, true, result.message)
    assert.strictEqual(result.data.results.length, 1)
    assert.strictEqual(result.data.results[0].test_code, 'MY-CULTURE-EXT')
    assert.strictEqual(result.data.results[0].result_value, 'Detected')
    const lookup = captures.find(entry => entry.type === 'sdformGetAll' && entry.provider.providerId === RESULT_ITEM_FORM_ID && entry.provider.options.where.includes('order_no = :workItemId'))
    assert.strictEqual(lookup.provider.params.workOrderNo, batchId)
  }

  {
    // One ordered test can have multiple Result Items. Existing persisted child
    // rows must be visible without an Agent resend, even when panel_code is not
    // the ordered parent code (as observed in the live Creatinine/eGFR callback).
    const batchId = 'bcbcbcbcbcbcbcbcbcbcbcbc'
    const result = await Process(
      { action: 'get_manual_result', organization_code: '10', item_id: manualItemId },
      userAt('10'),
      makeApp([], {
        manualSectionCode: 'BC',
        manualWorkPatch: {
          receipt_batch_id: batchId,
          batch_item_count: 9,
          selected_items_json: JSON.stringify([{ source_item_id: manualItemId, test_code: '100802CD' }]),
        },
        canonicalCurrent: [{
          _id: 'RESULT-CREATININE',
          order_no: batchId,
          obs_code: '100802CD',
          obs_name: 'Creatinine',
          panel_code: '101110',
          result_value: '0.45',
          result_status: 'final',
          result_version: '1',
          result_source: 'agent',
        }, {
          _id: 'RESULT-EGFR',
          order_no: batchId,
          obs_code: '101120CD',
          obs_name: 'eGFR',
          panel_code: '101120',
          result_value: '27.33',
          result_status: 'final',
          result_version: '1',
          result_source: 'agent',
        }, {
          _id: 'RESULT-OTHER',
          order_no: batchId,
          obs_code: '1023CD',
          obs_name: 'Glucose',
          panel_code: '101150',
          result_value: '88',
          result_status: 'final',
          result_version: '1',
          result_source: 'agent',
        }],
      }),
    )
    assert.strictEqual(result.success, true, result.message)
    assert.deepStrictEqual(
      result.data.results.map(row => row.test_code).sort(),
      ['100802CD', '101120CD'],
      'Creatinine viewer must include its mapped eGFR child and exclude sibling ordered tests',
    )
  }

  {
    const captures = []
    const result = await Process(
      {
        action: 'set_result_visibility',
        organization_code: '10',
        item_id: manualItemId,
        hidden: true,
        reason: 'รอตรวจสอบผลซ้ำกับห้องปฏิบัติการ',
      },
      userAt('10'),
      makeApp(captures, {
        manualSectionCode: 'BC',
        manualStatus: 'completed',
        canonicalCurrent: [{
          _id: 'abababababababababababab',
          order_no: '999999999999999999999999',
          hn: 'HN-TEST',
          visit_id: 'VN-NEW',
          obs_code: 'C23',
          obs_name: 'Glucose',
          result_value: '98',
          result_status: 'final',
          result_source: 'agent',
          is_critical: true,
        }],
      }),
    )
    assert.strictEqual(result.success, true, result.message)
    assert.strictEqual(result.data.is_hide_result, true)
    assert.strictEqual(result.data.result_visibility_action, 'hide')
    assert.strictEqual(result.data.result_visibility_reason, 'รอตรวจสอบผลซ้ำกับห้องปฏิบัติการ')
    assert.strictEqual(result.data.result_visibility_by.name, 'lab-test')
    assert.strictEqual(result.data.result_visibility_at, '2026-08-31 10:20:30')
    assert.strictEqual(result.data.results[0].result_value, '98', 'manual hide must not remove the clinical value from the owning LAB editor')
    assert.strictEqual(result.data.results[0].is_critical, true, 'manual hide must preserve the LAB clinical interpretation')
    assert.strictEqual(result.data.results[0].redacted, false)
    assert.strictEqual(result.data.results[0].redaction_reason, '')

    const updates = captures.filter(entry => entry.type === 'update')
    assert.strictEqual(updates.length, 1, 'visibility action must update only the selected CPOE Order Item')
    const update = updates[0]
    assert.strictEqual(update.from, 'zdata_cpoe_order_item')
    assert.strictEqual(update.filter._id, manualItemId)
    assert.deepStrictEqual(update.filter.xrstatx, { $nin: [0, 3] })
    assert.strictEqual(update.data.is_hide_result, true)
    assert.strictEqual(update.data.result_visibility_history.length, 1)
    assert.strictEqual(update.data.result_visibility_history[0].action, 'hide')
    assert.strictEqual(update.data.result_visibility_history[0].reason, 'รอตรวจสอบผลซ้ำกับห้องปฏิบัติการ')
    assert(!captures.some(entry => entry.type === 'sdformSetOne'), 'visibility must not overwrite canonical Result records')
  }

  {
    const captures = []
    const result = await Process(
      {
        action: 'set_result_visibility',
        organization_code: '10',
        item_id: manualItemId,
        hidden: false,
        reason: 'ตรวจสอบผลเรียบร้อยแล้ว',
      },
      userAt('10'),
      makeApp(captures, {
        manualSectionCode: 'BC',
        manualStatus: 'completed',
        manualVisibility: {
          is_hide_result: true,
          result_visibility_action: 'hide',
          result_visibility_reason: 'รอตรวจสอบ',
          result_visibility_history: [{
            action: 'hide',
            reason: 'รอตรวจสอบ',
            performed_by: { id: '', name: 'older-user' },
            performed_at: '2026-08-31 09:00:00',
          }],
        },
        canonicalCurrent: [{
          _id: 'abababababababababababab',
          order_no: '999999999999999999999999',
          hn: 'HN-TEST',
          visit_id: 'VN-NEW',
          obs_code: 'C23',
          result_value: '98',
          result_status: 'final',
        }],
      }),
    )
    assert.strictEqual(result.success, true, result.message)
    assert.strictEqual(result.data.is_hide_result, false)
    assert.strictEqual(result.data.result_visibility_action, 'unhide')
    const update = captures.find(entry => entry.type === 'update')
    assert(update)
    assert.strictEqual(update.data.result_visibility_history.length, 2)
    assert.strictEqual(update.data.result_visibility_history[1].action, 'unhide')
  }

  {
    const captures = []
    const result = await Process(
      {
        action: 'set_result_visibility',
        organization_code: '10',
        item_id: manualItemId,
        hidden: true,
        reason: '',
      },
      userAt('10'),
      makeApp(captures, {
        manualSectionCode: 'BC',
        manualStatus: 'completed',
        canonicalCurrent: [{
          _id: 'abababababababababababab',
          order_no: '999999999999999999999999',
          hn: 'HN-TEST',
          visit_id: 'VN-NEW',
          obs_code: 'C23',
          result_value: '98',
        }],
      }),
    )
    assert.strictEqual(result.success, true, result.message)
    const update = captures.find(entry => entry.type === 'update')
    assert(update, 'hide/unhide reason must be optional while the visibility audit event is still recorded')
    assert.strictEqual(update.data.result_visibility_reason, '')
    assert.strictEqual(update.data.result_visibility_history[0].reason, '')
  }

  {
    const captures = []
    const result = await Process(
      {
        action: 'set_result_visibility',
        organization_code: '10',
        item_id: manualItemId,
        hidden: true,
        reason: 'ยังไม่มีผลตรวจ',
      },
      userAt('10'),
      makeApp(captures, { manualSectionCode: 'BC', manualStatus: 'completed' }),
    )
    assert.strictEqual(result.success, false)
    assert(result.message.includes('ยังไม่มีผลตรวจ'))
    assert(!captures.some(entry => entry.type === 'update'))
  }

  {
    const captures = []
    const result = await Process(
      {
        action: 'set_result_visibility',
        organization_code: '10',
        item_id: manualItemId,
        hidden: true,
        reason: 'คงสถานะเดิม',
      },
      userAt('10'),
      makeApp(captures, {
        manualSectionCode: 'BC',
        manualStatus: 'completed',
        manualVisibility: { is_hide_result: true },
        canonicalCurrent: [{
          _id: 'abababababababababababab',
          order_no: '999999999999999999999999',
          hn: 'HN-TEST',
          visit_id: 'VN-NEW',
          obs_code: 'C23',
          result_value: '98',
        }],
      }),
    )
    assert.strictEqual(result.success, true)
    assert(result.message.includes('อยู่แล้ว'))
    assert(!captures.some(entry => entry.type === 'update'), 'same visibility must be idempotent')
  }

  {
    const captures = []
    const result = await Process(
      { action: 'get_manual_result', organization_code: 'm1000', item_id: manualItemId },
      userAt('m1000'),
      makeApp(captures, { manualStatus: 'sent' }),
    )
    assert.strictEqual(result.success, true, 'waiting Item must allow read-only result lookup')
    assert.strictEqual(result.data.result_value, '')
  }

  {
    const captures = []
    const result = await Process(
      {
        action: 'save_pathology_results',
        organization_code: 'm1000',
        item_id: manualItemId,
        request_id: 'my-pathology-save-1',
        pathology_results: [
          { pathology_row_key: manualItemId + '|0|hair', specimen_index: 0, pathology_sub_index: 0, actual_site_code: 'HEAD', actual_site_name: 'ศีรษะ', actual_site_detail: 'เส้นผม', result_value: 'พบเชื้อ A' },
          { pathology_row_key: manualItemId + '|0|scalp', specimen_index: 0, pathology_sub_index: 1, actual_site_code: 'HEAD', actual_site_name: 'ศีรษะ', actual_site_detail: 'หนังศีรษะ', result_value: 'ไม่พบเชื้อ' },
          { pathology_row_key: manualItemId + '|1|arm', specimen_index: 1, pathology_sub_index: 0, actual_site_code: 'ARM', actual_site_name: 'แขน', actual_site_detail: 'ขวา', result_value: 'พบเชื้อ B' },
          { pathology_row_key: manualItemId + '|2|leg', specimen_index: 2, pathology_sub_index: 0, actual_site_code: 'LEG', actual_site_name: 'ขา', actual_site_detail: 'ซ้าย', result_value: '' },
        ],
      },
      userAt('m1000'),
      makeApp(captures, {
        manualQuantity: 3,
        manualLabData: {
          specimens: [
            { spec_source_code: 'HAIR', spec_source: 'Hair', spec_site_code: 'HEAD', spec_site_name: 'ศีรษะ' },
            { spec_source_code: 'SKIN', spec_source: 'Skin scraping', spec_site_code: 'ARM', spec_site_name: 'แขน' },
            { spec_source_code: 'NAIL', spec_source: 'Nail clipping', spec_site_code: 'LEG', spec_site_name: 'ขา' },
          ],
        },
      }),
    )
    assert.strictEqual(result.success, true, result.message)
    assert(result.message.includes('4 ตำแหน่ง'))
    const reportSave = captures.find(entry => entry.type === 'sdformSetOne' && entry.formId === RESULT_REPORT_FORM_ID)
    assert(reportSave, 'MY sub-results must reuse the existing Result Report form')
    assert.strictEqual(reportSave.data.item_count, 4)
    const itemSaves = captures.filter(entry => entry.type === 'sdformSetOne' && entry.formId === RESULT_ITEM_FORM_ID)
    assert.strictEqual(itemSaves.length, 4, 'each MY actual site must persist as one existing Result Item row')
    assert.deepStrictEqual(itemSaves.map(entry => entry.data.specimen_index), [0, 0, 1, 2])
    assert.deepStrictEqual(itemSaves.map(entry => entry.data.specimen_name_snapshot), ['Hair', 'Hair', 'Skin scraping', 'Nail clipping'])
    assert.deepStrictEqual(itemSaves.map(entry => entry.data.ordered_site_name_snapshot), ['ศีรษะ', 'ศีรษะ', 'แขน', 'ขา'])
    assert.strictEqual(new Set(itemSaves.map(entry => entry.data.pathology_row_key)).size, 4)
    assert(itemSaves.every(entry => entry.data.source_item_id === manualItemId))
    const metadataWrites = captures.filter(entry => entry.type === 'update' && entry.from === 'zdata_lab_result_item')
    assert.strictEqual(metadataWrites.length, 4, 'optional MY specimen/site metadata must be persisted on Result Item rows')
    assert(captures.some(entry => entry.type === 'update' && entry.from === 'zdata_lab_work_item' && entry.data.work_status === 'resulted'))
  }

  {
    const captures = []
    const result = await Process(
      {
        action: 'save_pathology_results',
        organization_code: 'm1000',
        item_id: manualItemId,
        request_id: 'my-pathology-final-correction-1',
        pathology_results: [{
          result_item_id: 'adadadadadadadadadadadad',
          pathology_row_key: manualItemId + '|0|ordered',
          specimen_index: 0,
          pathology_sub_index: 0,
          actual_site_code: 'HEAD',
          actual_site_name: 'ศีรษะ',
          result_value: 'แก้ไขผลหลังยืนยัน',
        }],
      },
      userAt('m1000'),
      makeApp(captures, {
        manualStatus: 'completed',
        canonicalReports: [{
          _id: '111111111111111111111111',
          report_key: 'manual-order|' + manualOrderId + '|MY',
        }],
        canonicalCurrent: [{
          _id: 'adadadadadadadadadadadad',
          result_report_id: '111111111111111111111111',
          order_no: '999999999999999999999999',
          source_item_id: manualItemId,
          pathology_row_key: manualItemId + '|0|ordered',
          result_definition_id: 'MY-PATH|' + manualItemId + '|0|ordered',
          obs_code: 'MY-CULTURE',
          specimen_index: 0,
          actual_site_code: 'HEAD',
          actual_site_name: 'ศีรษะ',
          pathology_sub_index: 0,
          result_value: 'ผลเดิม',
          result_source: 'manual',
          result_status: 'final',
        }],
      }),
    )
    assert.strictEqual(result.success, true, result.message)
    const reportSave = captures.find(entry => entry.type === 'sdformSetOne' && entry.formId === RESULT_REPORT_FORM_ID)
    assert(reportSave, 'MY completed correction must retain its Result Report')
    assert.strictEqual(reportSave.data.internal_overall_status, 'completed', 'pencil correction must not downgrade Final report status')
    const correctionLog = captures.find(entry => entry.type === 'correctionLog')
    assert(correctionLog, 'MY completed correction must keep the append-only edit audit')
    assert.strictEqual(correctionLog.document.request_id, 'my-pathology-final-correction-1')
    assert.strictEqual(correctionLog.document.correction_group_id, 'my-pathology-final-correction-1', 'all changes from one MY Save click must share one revision group')
    assert(!captures.some(entry => entry.type === 'update' && entry.from === 'zdata_lab_work_item'), 'MY completed correction must not move the Work Item back to resulted')
  }

  {
    const captures = []
    const baseResultItemId = 'babababababababababababa'
    const addedResultItemId = 'cdcdcdcdcdcdcdcdcdcdcdcd'
    const result = await Process(
      {
        action: 'save_pathology_results',
        organization_code: 'm1000',
        item_id: manualItemId,
        request_id: 'my-pathology-remove-added-1',
        correction_reason: 'ลบตำแหน่งที่เพิ่มเกิน',
        removed_pathology_result_item_ids: [addedResultItemId],
        pathology_results: [{
          result_item_id: baseResultItemId,
          pathology_row_key: manualItemId + '|0|ordered',
          specimen_index: 0,
          pathology_sub_index: 0,
          actual_site_code: 'HEAD',
          actual_site_name: 'ศีรษะ',
          result_value: 'ไม่พบเชื้อ',
        }],
      },
      userAt('m1000'),
      makeApp(captures, {
        manualStatus: 'completed',
        canonicalReports: [{
          _id: '121212121212121212121212',
          report_key: 'manual-order|' + manualOrderId + '|MY',
        }],
        canonicalCurrent: [{
          _id: baseResultItemId,
          result_report_id: '121212121212121212121212',
          source_item_id: manualItemId,
          pathology_row_key: manualItemId + '|0|ordered',
          result_definition_id: 'MY-PATH|' + manualItemId + '|0|ordered',
          obs_code: 'MY-CULTURE',
          specimen_index: 0,
          pathology_sub_index: 0,
          actual_site_name: 'ศีรษะ',
          result_value: 'ไม่พบเชื้อ',
          result_source: 'manual',
          result_status: 'final',
        }, {
          _id: addedResultItemId,
          result_report_id: '121212121212121212121212',
          source_item_id: manualItemId,
          pathology_row_key: manualItemId + '|0|added-scalp',
          result_definition_id: 'MY-PATH|' + manualItemId + '|0|added-scalp',
          obs_code: 'MY-CULTURE',
          specimen_index: 0,
          specimen_name_snapshot: 'Hair',
          pathology_sub_index: 1,
          actual_site_name: 'หนังศีรษะ',
          result_value: 'พบเชื้อ',
          result_source: 'manual',
          result_status: 'final',
        }],
      }),
    )
    assert.strictEqual(result.success, true, result.message)
    assert(result.message.includes('ลบ 1 ตำแหน่งที่เพิ่ม'))
    const deletionLog = captures.find(entry => entry.type === 'correctionLog' && entry.document.source_result_item_id === addedResultItemId)
    assert(deletionLog, 'deleting a saved MY added location must append a correction log before hiding the current row')
    assert.strictEqual(deletionLog.document.correction_group_id, 'my-pathology-remove-added-1')
    assert.strictEqual(deletionLog.document.actual_site_name, 'หนังศีรษะ')
    assert(captures.some(entry => entry.type === 'update' && entry.from === 'zdata_lab_result_item' && entry.data.xrstatx === 3 && String(entry.filter._id) === addedResultItemId), 'saved added location must be soft-deleted from current Result Items')
    assert(!captures.some(entry => entry.type === 'update' && entry.from === 'zdata_lab_work_item'), 'removing an added MY location after Final must not downgrade the Work Item')
  }

  {
    const captures = []
    const baseResultItemId = 'acacacacacacacacacacacac'
    const result = await Process(
      {
        action: 'save_pathology_results',
        organization_code: 'm1000',
        item_id: manualItemId,
        request_id: 'my-pathology-add-after-final-1',
        correction_reason: 'เพิ่มตำแหน่งตรวจจริง',
        pathology_results: [{
          result_item_id: baseResultItemId,
          pathology_row_key: manualItemId + '|0|ordered',
          specimen_index: 0,
          pathology_sub_index: 0,
          actual_site_code: 'HEAD',
          actual_site_name: 'ศีรษะ',
          result_value: 'ไม่พบเชื้อ',
        }, {
          pathology_row_key: manualItemId + '|0|added-eyelid',
          specimen_index: 0,
          pathology_sub_index: 1,
          actual_site_code: 'EYELID',
          actual_site_name: 'เปลือกตา',
          result_value: 'พบเชื้อ',
        }],
      },
      userAt('m1000'),
      makeApp(captures, {
        manualStatus: 'completed',
        canonicalReports: [{
          _id: '151515151515151515151515',
          report_key: 'manual-order|' + manualOrderId + '|MY',
        }],
        canonicalCurrent: [{
          _id: baseResultItemId,
          result_report_id: '151515151515151515151515',
          order_no: '999999999999999999999999',
          source_item_id: manualItemId,
          pathology_row_key: manualItemId + '|0|ordered',
          result_definition_id: 'MY-PATH|' + manualItemId + '|0|ordered',
          obs_code: 'MY-CULTURE',
          specimen_index: 0,
          specimen_name_snapshot: 'Skin scraping',
          pathology_sub_index: 0,
          actual_site_code: 'HEAD',
          actual_site_name: 'ศีรษะ',
          result_value: 'ไม่พบเชื้อ',
          result_source: 'manual',
          result_status: 'final',
        }],
      }),
    )
    assert.strictEqual(result.success, true, result.message)
    const additionLog = captures.find(entry =>
      entry.type === 'correctionLog' && entry.document.change_operation === 'add_pathology_row'
    )
    assert(additionLog, 'adding a new MY location after Final must append a correction revision')
    assert.strictEqual(additionLog.document.correction_group_id, 'my-pathology-add-after-final-1')
    assert.strictEqual(additionLog.document.source_cpoe_item_id, manualItemId)
    assert.strictEqual(additionLog.document.pathology_row_key, manualItemId + '|0|added-eyelid')
    assert.strictEqual(additionLog.document.actual_site_name, 'เปลือกตา')
    assert.strictEqual(additionLog.document.before_result_value, '')
    assert.strictEqual(additionLog.document.after_result_value, 'พบเชื้อ')
    const addedSave = captures.find(entry =>
      entry.type === 'sdformSetOne' && entry.formId === RESULT_ITEM_FORM_ID &&
      entry.data.pathology_row_key === manualItemId + '|0|added-eyelid'
    )
    assert(addedSave, 'the added MY location must still persist as a current Result Item')
    assert.strictEqual(addedSave.data.result_status, 'corrected')
    assert(!captures.some(entry => entry.type === 'update' && entry.from === 'zdata_lab_work_item'), 'adding a MY location after Final must not downgrade the Work Item')
  }

  {
    const captures = []
    const baseResultItemId = 'dededededededededededede'
    const result = await Process(
      {
        action: 'save_pathology_results',
        organization_code: 'm1000',
        item_id: manualItemId,
        request_id: 'my-pathology-protect-ordered-1',
        removed_pathology_result_item_ids: [baseResultItemId],
        pathology_results: [{
          pathology_row_key: manualItemId + '|0|replacement',
          specimen_index: 0,
          pathology_sub_index: 0,
          actual_site_name: 'ศีรษะ',
          result_value: 'ไม่พบเชื้อ',
        }],
      },
      userAt('m1000'),
      makeApp(captures, {
        canonicalCurrent: [{
          _id: baseResultItemId,
          source_item_id: manualItemId,
          pathology_row_key: manualItemId + '|0|ordered',
          result_definition_id: 'MY-PATH|' + manualItemId + '|0|ordered',
          obs_code: 'MY-CULTURE',
          specimen_index: 0,
          pathology_sub_index: 0,
          actual_site_name: 'ศีรษะ',
          result_value: 'ไม่พบเชื้อ',
        }],
      }),
    )
    assert.strictEqual(result.success, false)
    assert(result.message.includes('ตำแหน่งหลักจากใบสั่งแพทย์'))
    assert(!captures.some(entry => entry.type === 'update' && entry.from === 'zdata_lab_result_item' && entry.data.xrstatx === 3), 'the ordered base location must never be removed')
  }

  {
    const captures = []
    const result = await Process(
      {
        action: 'save_pathology_results',
        organization_code: '10',
        item_id: manualItemId,
        pathology_results: [{ specimen_index: 0, pathology_sub_index: 0, actual_site_name: 'ศีรษะ', result_value: 'must-not-save' }],
      },
      userAt('10'),
      makeApp(captures, { manualSectionCode: 'BC' }),
    )
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'pathology_section_required')
    assert(!captures.some(entry => ['insertData', 'sdformSetOne', 'update'].includes(entry.type)), 'non-MY rooms must not be changed by the MY popup save action')
  }

  {
    const captures = []
    const result = await Process(
      {
        action: 'save_pathology_results',
        organization_code: 'm1000',
        item_id: manualItemId,
        pathology_results: [{ specimen_index: 0, pathology_sub_index: 0, actual_site_name: 'ศีรษะ', result_value: 'must-not-save' }],
      },
      userAt('m1000'),
      makeApp(captures, { manualStatus: 'sent' }),
    )
    assert.strictEqual(result.success, false)
    assert(result.message.includes('รับ specimen'))
    assert(!captures.some(entry => ['insertData', 'sdformSetOne', 'update'].includes(entry.type)))
  }

  {
    const result = await Process(
      { action: 'get_manual_result', organization_code: 'm1000', item_id: manualItemId },
      userAt('m1000'),
      makeApp([], {
        correctionLogRows: [{
          event_id: 'my-history-set-1:adadadadadadadadadadadad',
          request_id: 'my-history-set-1',
          correction_group_id: 'my-history-set-1',
          source_cpoe_item_id: manualItemId,
          source_result_item_id: 'adadadadadadadadadadadad',
          test_code: 'MY-CULTURE',
          test_name: 'Fungal culture',
          pathology_row_key: manualItemId + '|1|arm',
          specimen_index: 1,
          specimen_name_snapshot: 'Skin scraping',
          actual_site_name: 'แขน',
          correction_reason: 'แก้ผลตำแหน่งแขน',
          changed_fields_json: '["result_value"]',
          before_result_value: 'ไม่พบเชื้อ',
          after_result_value: 'พบเชื้อ B',
          corrected_by_name: 'LAB Editor',
          corrected_at: '2026-10-05 12:00:00',
          outcome: 'success',
          xrstatx: 1,
        }],
        canonicalCurrent: [{
          _id: 'adadadadadadadadadadadad',
          order_no: '999999999999999999999999',
          source_item_id: manualItemId,
          pathology_row_key: manualItemId + '|1|arm',
          result_definition_id: 'MY-PATH|' + manualItemId + '|1|arm',
          obs_code: 'MY-CULTURE',
          specimen_index: 1,
          specimen_code_snapshot: 'SKIN',
          specimen_name_snapshot: 'Skin scraping',
          ordered_site_code_snapshot: 'ARM',
          ordered_site_name_snapshot: 'แขน',
          actual_site_code: 'ARM',
          actual_site_name: 'แขน',
          actual_site_detail: 'ขวา',
          pathology_sub_index: 0,
          result_value: 'พบเชื้อ B',
          result_source: 'manual',
          result_status: 'final',
        }, {
          _id: 'bcbcbcbcbcbcbcbcbcbcbcbc',
          order_no: '999999999999999999999999',
          source_item_id: manualItemId,
          pathology_row_key: manualItemId + '|0|eyelid',
          result_definition_id: 'MY-PATH|' + manualItemId + '|0|eyelid',
          obs_code: 'MY-CULTURE',
          specimen_index: 0,
          specimen_name_snapshot: 'Hair',
          actual_site_name: 'เปลือกตา',
          pathology_sub_index: 1,
          result_value: 'พบเชื้อ C',
          result_source: 'manual',
          result_status: 'corrected',
          entered_at: '2026-10-08 17:12:35',
          entered_by: 'LAB Legacy Editor',
        }, {
          _id: 'bdbdbdbdbdbdbdbdbdbdbdbd',
          order_no: '999999999999999999999999',
          source_item_id: manualItemId,
          pathology_row_key: manualItemId + '|0|vision',
          result_definition_id: 'MY-PATH|' + manualItemId + '|0|vision',
          obs_code: 'MY-CULTURE',
          specimen_index: 0,
          specimen_name_snapshot: 'Hair',
          actual_site_name: 'การมองเห็น',
          pathology_sub_index: 2,
          result_value: 'พบเชื้อ D',
          result_source: 'manual',
          result_status: 'corrected',
          entered_at: '2026-10-08 17:12:35',
          entered_by: 'LAB Legacy Editor',
        }],
      }),
    )
    assert.strictEqual(result.success, true, result.message)
    const armResult = result.data.results.find(row => row.pathology_row_key === manualItemId + '|1|arm')
    assert(armResult)
    assert.strictEqual(armResult.specimen_index, 1)
    assert.strictEqual(armResult.actual_site_detail, 'ขวา')
    assert.strictEqual(result.data.pathology_correction_history.length, 3)
    const loggedHistory = result.data.pathology_correction_history.find(row => row.correction_group_id === 'my-history-set-1')
    assert(loggedHistory)
    assert.strictEqual(loggedHistory.specimen_name, 'Skin scraping')
    const revisionGroups = new Set(result.data.pathology_correction_history.map(row => row.correction_group_id))
    assert.strictEqual(revisionGroups.size, 2, 'one logged edit plus one legacy MY Save must render as two revisions')
    const legacyRows = result.data.pathology_correction_history.filter(row => row.correction_group_id.startsWith('legacy-my-add|'))
    assert.strictEqual(legacyRows.length, 2)
    assert(legacyRows.every(row => row.reason.includes('ประวัติเดิมก่อนเปิดใช้ correction log')))
  }

  {
    const result = await Process(
      { action: 'get_manual_result', organization_code: '10', item_id: manualItemId },
      userAt('10'),
      makeApp([], {
        manualSectionCode: 'BC',
        manualStatus: 'completed',
        manualVisibility: { is_hide_result: true, result_visibility_action: 'hide' },
        canonicalCurrent: [{
          _id: 'acacacacacacacacacacacac',
          order_no: '999999999999999999999999',
          obs_code: 'C25.2',
          obs_name: 'Potassium',
          result_value: '4.23',
          units: 'mmol/L',
          interpretation_code: 'N',
          reference_range_snapshot: '3.3-4.6',
          result_comment: 'must stay hidden',
          is_critical: true,
        }],
      }),
    )
    assert.strictEqual(result.success, true, result.message)
    assert.strictEqual(result.data.is_hide_result, true)
    assert.strictEqual(result.data.results[0].test_name, 'Potassium')
    assert.strictEqual(result.data.results[0].result_value, '4.23')
    assert.strictEqual(result.data.results[0].unit, 'mmol/L')
    assert.strictEqual(result.data.results[0].interpretation, 'N')
    assert.strictEqual(result.data.results[0].reference_range, '3.3-4.6')
    assert.strictEqual(result.data.results[0].result_comment, 'must stay hidden')
    assert.strictEqual(result.data.results[0].previous, null)
    assert.strictEqual(result.data.results[0].redacted, false)
    assert.strictEqual(result.data.results[0].is_critical, true)
  }

  {
    const captures = []
    const result = await Process(
      {
        action: 'save_manual_result',
        organization_code: 'm1000',
        item_id: manualItemId,
        manual_result: { result_value: 'must-not-save' },
      },
      userAt('m1000'),
      makeApp(captures, { manualStatus: 'sent' }),
    )
    assert.strictEqual(result.success, false)
    assert(result.message.includes('รับ specimen'))
    assert(!captures.some(entry => entry.type === 'sdformSetOne'))
  }

  {
    const captures = []
    const result = await Process(
      { action: 'get_manual_result', organization_code: '10', item_id: manualItemId },
      userAt('10'),
      makeApp(captures, { manualSectionCode: 'BC' }),
    )
    assert.strictEqual(result.success, true, 'non-MY Item must still allow read-only result lookup')
    assert(result.message.includes('Agent/LIS'), result.message)
  }

  {
    const captures = []
    const result = await Process(
      {
        action: 'save_manual_result',
        organization_code: '10',
        item_id: manualItemId,
        manual_result: { result_value: '98', unit: 'mg/dL', interpretation: 'N', reference_range: '70-100' },
      },
      userAt('10'),
      makeApp(captures, { manualSectionCode: 'BC' }),
    )
    assert.strictEqual(result.success, true, result.message)
    assert.strictEqual(result.data.results[0].result_report_id, '111111111111111111111111', 'manual result response must expose the Result Report parent used by Report Factory')
    const save = captures.find(entry => entry.type === 'sdformSetOne' && entry.formId === RESULT_ITEM_FORM_ID)
    assert(save, 'received non-Mycology Item must support Manual Result entry')
    assert.strictEqual(save.data.lab_section, 'BC')
    assert.strictEqual(save.data.result_value, '98')
    assert.strictEqual(save.data.result_source, 'manual')
  }

  {
    const captures = []
    const result = await Process(
      {
        action: 'save_manual_result',
        organization_code: 'm1000',
        item_id: manualItemId,
        manual_result: {
          result_value: 'Candida tropicalis',
          unit: 'CFU/mL',
          interpretation: 'POS',
          reference_range: 'Not detected',
        },
      },
      userAt('m1000'),
      makeApp(captures),
    )
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.result_status, 'entered')
    const reportSave = captures.find(entry => entry.type === 'sdformSetOne' && entry.formId === RESULT_REPORT_FORM_ID)
    assert(reportSave, 'must persist a Result Report before its Item')
    // 2026-09-25 confirmed change: every Manual Item in one Order+Section must
    // share a canonical Result Report so the PDF includes the complete sheet.
    assert.strictEqual(reportSave.data.report_key, 'manual-order|eeeeeeeeeeeeeeeeeeeeeeee|MY')
    assert.strictEqual(reportSave.data.order_no, 'eeeeeeeeeeeeeeeeeeeeeeee')
    assert.strictEqual(reportSave.data.xparentx, '111111111111111111111111')
    assert.strictEqual(reportSave.data.order_status_id, '999999999999999999999999')
    const save = captures.find(entry => entry.type === 'sdformSetOne' && entry.formId === RESULT_ITEM_FORM_ID)
    assert(save, 'must persist a Result Item')
    assert.strictEqual(save.formId, RESULT_ITEM_FORM_ID)
    assert.strictEqual(save.data.result_report_id, '111111111111111111111111')
    assert.strictEqual(save.data.order_no, '999999999999999999999999')
    assert.strictEqual(save.data.hn, 'HN-TEST')
    assert.strictEqual(save.data.visit_id, 'VN-NEW')
    assert.strictEqual(save.data.previous_value, '')
    assert.strictEqual(save.data.edit_history_json, '[]')
    assert.strictEqual(save.data.result_value, 'Candida tropicalis')
    assert.strictEqual(save.data.unit_symbol_snapshot, 'CFU/mL')
    assert.strictEqual(save.data.interpretation_code, 'POS')
    assert.strictEqual(save.data.reference_range_snapshot, 'Not detected')
    const statusUpdate = captures.find(entry => entry.type === 'update' && entry.from === 'zdata_lab_work_item')
    assert(statusUpdate, 'entered Manual result must move only its Lab Work Item to resulted')
    assert.strictEqual(statusUpdate.filter._id, '999999999999999999999999')
    assert.strictEqual(statusUpdate.data.work_status, 'resulted')
  }

  {
    const captures = []
    const result = await Process(
      {
        action: 'finalize_manual_results',
        organization_code: 'm1000',
        order_id: manualOrderId,
        section_code: 'MY',
      },
      { roles: ['auth'], username: 'lab-final-approver', unit: { code: 'm1000', name: 'Mycology' } },
      makeFinalizeApp(captures),
    )
    assert.strictEqual(result.success, true, result.message)
    assert.strictEqual(result.data.completed_item_count, 1)
    assert.strictEqual(result.data.order_completed, true)
    assert.strictEqual(result.data.already_completed, false)
    const resultFinal = captures.find(entry => entry.type === 'sdformSetOne' && entry.formId === RESULT_ITEM_FORM_ID)
    assert(resultFinal, 'Final action must promote the persisted Manual Result Item')
    assert.strictEqual(resultFinal.data.result_status, 'final')
    assert.strictEqual(resultFinal.data.verified_by, 'lab-final-approver')
    assert.strictEqual(resultFinal.data.verified_at, '2026-08-31 10:20:30')
    const reportFinal = captures.find(entry => entry.type === 'sdformSetOne' && entry.formId === RESULT_REPORT_FORM_ID)
    assert(reportFinal, 'Final action must promote the Manual Result Report')
    assert.strictEqual(reportFinal.data.internal_overall_status, 'completed')
    assert.strictEqual(reportFinal.data.verified_by_source_name, 'lab-final-approver')
    const workFinal = captures.find(entry => entry.type === 'directUpdate' && entry.from === 'zdata_lab_work_item')
    assert(workFinal, 'Final action must complete the authoritative Lab Work Item')
    assert.strictEqual(workFinal.filter.work_status, 'resulted')
    assert.strictEqual(workFinal.update.$set.work_status, 'completed')
    assert.strictEqual(workFinal.update.$set.completed_by, 'lab-final-approver')
    const cpoeFinal = captures.find(entry => entry.type === 'directUpdate' && entry.from === 'zdata_cpoe_order_item')
    assert(cpoeFinal, 'Final action must reconcile the CPOE Item')
    assert.strictEqual(cpoeFinal.update.$set.current_status, 'completed')
    assert.strictEqual(cpoeFinal.update.$set.result_completed_source, 'his.manual')
    const orderFinal = captures.find(entry => entry.type === 'directUpdate' && entry.from === 'zdata_cpoe_order')
    assert(orderFinal, 'a one-Item CPOE Order must complete when its Manual Item completes')
    assert.strictEqual(orderFinal.update.$set.current_status, 'completed')
  }

  {
    const captures = []
    const result = await Process(
      {
        action: 'finalize_manual_results',
        organization_code: 'm1000',
        order_id: manualOrderId,
        section_code: 'MY',
      },
      userAt('m1000'),
      makeFinalizeApp(captures, { resultRows: [] }),
    )
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'manual_result_value_required')
    assert(!captures.some(entry => entry.type === 'directUpdate'), 'incomplete Manual results must not change operational status')
    assert(!captures.some(entry => entry.type === 'sdformSetOne'), 'incomplete Manual results must not change clinical records')
  }

  {
    const captures = []
    const result = await Process(
      {
        action: 'finalize_manual_results',
        organization_code: 'm1000',
        order_id: manualOrderId,
        section_code: 'MY',
      },
      userAt('m1000'),
      makeFinalizeApp(captures, { workStatus: 'completed', cpoeStatus: 'completed' }),
    )
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.already_completed, true)
    assert(!captures.some(entry => entry.type === 'directUpdate'), 'idempotent Final retry must preserve the original completion audit')
    assert(!captures.some(entry => entry.type === 'sdformSetOne'), 'idempotent Final retry must preserve the original verification audit')
  }

  {
    const captures = []
    const resultItemId = '454545454545454545454545'
    const result = await Process(
      {
        action: 'save_manual_result',
        organization_code: 'm1000',
        item_id: manualItemId,
        correction_reason: 'แก้ผลเพาะเชื้อตามใบงานที่ตรวจทานแล้ว',
        request_id: 'manual-correction-test-1',
        manual_result: {
          result_value: 'Candida glabrata',
          unit: 'CFU/mL',
          interpretation: 'POS',
          reference_range: 'Not detected',
        },
      },
      { roles: ['auth'], username: 'his-pencil-editor', unit: { code: 'm1000', name: 'm1000' } },
      makeApp(captures, {
        manualStatus: 'resulted',
        canonicalCurrent: [{
          _id: resultItemId,
          order_no: '999999999999999999999999',
          hn: 'HN-TEST',
          visit_id: 'VN-NEW',
          obs_code: 'MY-CULTURE',
          result_value: 'Candida tropicalis',
          units: 'CFU/mL',
          ref_range: 'Not detected',
          entered_at: '2026-08-31 09:30:00',
          entered_by: 'first-editor',
          result_source: 'manual',
        }],
      }),
    )
    assert.strictEqual(result.success, true)
    const save = captures.find(entry => entry.type === 'sdformSetOne' && entry.formId === RESULT_ITEM_FORM_ID && entry.id === resultItemId)
    assert(save, 'manual pencil correction must update the canonical Result Item')
    assert.strictEqual(save.data.last_edited_by, 'his-pencil-editor', 'manual pencil must audit the logged-in HIS user')
    assert.strictEqual(save.data.last_edited_at, '2026-08-31 10:20:30')
    assert.strictEqual(save.data.change_kind, 'corrected')
    assert.strictEqual(save.data.result_value, 'Candida glabrata')
    assert.strictEqual(Object.prototype.hasOwnProperty.call(save.data, 'entered_by'), false, 'manual correction must retain the original entry identity')
    const log = captures.find(entry => entry.type === 'correctionLog')
    assert(log, 'manual correction must append an immutable correction log first')
    assert.strictEqual(log.collection, RESULT_EDIT_LOG_COLLECTION, 'correction audit must use the deployed Form collection')
    assert.strictEqual(log.document.source_result_item_id, resultItemId)
    assert.strictEqual(log.document.before_result_value, 'Candida tropicalis')
    assert.strictEqual(log.document.after_result_value, 'Candida glabrata')
    assert.strictEqual(log.document.correction_reason, 'แก้ผลเพาะเชื้อตามใบงานที่ตรวจทานแล้ว')
    assert.strictEqual(log.document.corrected_by_username, 'his-pencil-editor')
  }

  {
    const captures = []
    const resultItemId = 'abababababababababababab'
    const result = await Process(
      {
        action: 'save_result_edits',
        organization_code: '10',
        item_id: manualItemId,
        correction_reason: 'ตรวจทานค่าใหม่จากเครื่องมือแล้ว',
        request_id: 'result-edit-test-1',
        results: [{
          result_item_id: resultItemId,
          result_value: '101',
          unit: 'mg/dL',
          interpretation: 'H',
          reference_range: '70-100',
        }],
      },
      { roles: ['auth'], username: 'his-result-editor', unit: { code: '10', name: 'Biochemistry' } },
      makeApp(captures, {
        manualSectionCode: 'BC',
        manualStatus: 'completed',
        canonicalCurrent: [{
          _id: resultItemId,
          result_report_id: 'cdcdcdcdcdcdcdcdcdcdcdcd',
          order_no: '999999999999999999999999',
          hn: 'HN-TEST',
          visit_id: 'VN-NEW',
          obs_code: 'C23',
          obs_name: 'Glucose',
          result_value: '98',
          units: 'mg/dL',
          interpretation_code: 'N',
          reference_range_snapshot: '70-100',
          result_status: 'final',
          result_source: 'agent',
          is_critical: false,
        }],
      }),
    )
    assert.strictEqual(result.success, true, result.message)
    assert.strictEqual(result.data.results[0].result_report_id, 'cdcdcdcdcdcdcdcdcdcdcdcd', 'viewer response must preserve the canonical Result Report parent used by Report Factory')
    const save = captures.find(entry => entry.type === 'sdformSetOne' && entry.formId === RESULT_ITEM_FORM_ID && entry.id === resultItemId)
    assert(save, 'pencil correction must update the existing canonical Result Item')
    assert.strictEqual(save.data.result_value, '101')
    assert.strictEqual(save.data.unit_symbol_snapshot, 'mg/dL')
    assert.strictEqual(save.data.interpretation_code, 'H')
    assert.strictEqual(save.data.reference_range_snapshot, '70-100')
    assert.strictEqual(save.data.last_edited_by, 'his-result-editor')
    assert.strictEqual(save.data.last_edited_at, '2026-08-31 10:20:30')
    assert.strictEqual(save.data.change_kind, 'corrected')
    assert.strictEqual(Object.prototype.hasOwnProperty.call(save.data, 'is_critical'), false, 'HIS edit must not recalculate Critical')
    assert.strictEqual(Object.prototype.hasOwnProperty.call(save.data, 'result_source'), false, 'HIS edit must preserve Agent/LIS source')
    const log = captures.find(entry => entry.type === 'correctionLog')
    assert(log, 'pencil correction must append a correction log')
    assert.strictEqual(log.document.before_result_value, '98')
    assert.strictEqual(log.document.after_result_value, '101')
    assert.strictEqual(log.document.correction_reason, 'ตรวจทานค่าใหม่จากเครื่องมือแล้ว')
    assert.deepStrictEqual(JSON.parse(log.document.changed_fields_json), ['result_value', 'interpretation'])
    assert.strictEqual(result.data.results[0].result_source, 'agent')
    assert.strictEqual(result.data.results[0].is_critical, false)
  }

  {
    const captures = []
    const resultItemId = '565656565656565656565656'
    const result = await Process(
      {
        action: 'save_result_edits',
        organization_code: '10',
        item_id: manualItemId,
        request_id: 'missing-reason-test',
        results: [{ result_item_id: resultItemId, result_value: '102', unit: 'mg/dL', interpretation: 'H', reference_range: '70-100' }],
      },
      userAt('10'),
      makeApp(captures, {
        manualSectionCode: 'BC',
        manualStatus: 'completed',
        canonicalCurrent: [{ _id: resultItemId, order_no: '999999999999999999999999', obs_code: 'C23', result_value: '98', units: 'mg/dL', interpretation_code: 'N', reference_range_snapshot: '70-100', result_status: 'final', result_source: 'agent' }],
      }),
    )
    assert.strictEqual(result.success, true, result.message)
    const log = captures.find(entry => entry.type === 'correctionLog')
    const save = captures.find(entry => entry.type === 'sdformSetOne' && entry.formId === RESULT_ITEM_FORM_ID && entry.id === resultItemId)
    assert(log, 'correction audit must still be written when the optional reason is blank')
    assert(save, 'blank optional reason must not block the correction update')
    assert.strictEqual(log.document.correction_reason, '')
  }

  {
    const captures = []
    const resultItemId = '676767676767676767676767'
    const result = await Process(
      {
        action: 'save_result_edits',
        organization_code: '10',
        item_id: manualItemId,
        correction_reason: 'ทดสอบกรณีเขียน Log ไม่สำเร็จ',
        request_id: 'log-write-failure-test',
        results: [{ result_item_id: resultItemId, result_value: '103', unit: 'mg/dL', interpretation: 'H', reference_range: '70-100' }],
      },
      userAt('10'),
      makeApp(captures, {
        manualSectionCode: 'BC',
        manualStatus: 'completed',
        correctionLogWriteFails: true,
        canonicalCurrent: [{ _id: resultItemId, order_no: '999999999999999999999999', obs_code: 'C23', result_value: '98', units: 'mg/dL', interpretation_code: 'N', reference_range_snapshot: '70-100', result_status: 'final', result_source: 'agent' }],
      }),
    )
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'correction_log_write_failed')
    assert(captures.some(entry => entry.type === 'correctionLog'))
    assert(!captures.some(entry => entry.type === 'sdformSetOne' && entry.formId === RESULT_ITEM_FORM_ID && entry.id === resultItemId), 'current clinical value must not update after log Form save failure')
  }

  {
    const captures = []
    const resultItemId = '686868686868686868686868'
    const result = await Process(
      {
        action: 'save_result_edits',
        organization_code: '10',
        item_id: manualItemId,
        correction_reason: 'ทดสอบการบันทึกบน MongoDB standalone',
        request_id: 'standalone-form-save-test',
        results: [{ result_item_id: resultItemId, result_value: '104', unit: 'mg/dL', interpretation: 'H', reference_range: '70-100' }],
      },
      userAt('10'),
      makeApp(captures, {
        manualSectionCode: 'BC',
        manualStatus: 'completed',
        canonicalCurrent: [{ _id: resultItemId, order_no: '999999999999999999999999', obs_code: 'C23', result_value: '98', units: 'mg/dL', interpretation_code: 'N', reference_range_snapshot: '70-100', result_status: 'final', result_source: 'agent' }],
      }),
    )
    assert.strictEqual(result.success, true, result.message)
    assert(captures.some(entry => entry.type === 'correctionLog'), 'standalone flow must append the Edit Log to its Form collection')
    assert(captures.some(entry => entry.type === 'sdformSetOne' && entry.formId === RESULT_ITEM_FORM_ID && entry.id === resultItemId), 'standalone flow must update the latest Result Item through its Form')
  }

  {
    const captures = []
    const resultItemId = '787878787878787878787878'
    const correctionLogRows = [{
      event_id: 'history-event-1',
      request_id: 'revision-set-1',
      correction_group_id: 'revision-set-1',
      source_result_item_id: resultItemId,
      correction_reason: 'แก้ไขตามใบงาน',
      changed_fields_json: '["result_value"]',
      before_result_value: '98',
      after_result_value: '101',
      corrected_by_username: 'lab-editor',
      corrected_by_name: 'LAB Editor',
      corrected_at: '2026-08-31 10:20:30',
    }]
    const result = await Process(
      { action: 'get_manual_result', organization_code: '10', item_id: manualItemId },
      userAt('10'),
      makeApp(captures, {
        manualSectionCode: 'BC',
        manualStatus: 'completed',
        correctionLogRows,
        canonicalCurrent: [{ _id: resultItemId, order_no: '999999999999999999999999', obs_code: 'C23', result_value: '101', result_status: 'final', result_source: 'agent' }],
      }),
    )
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.results[0].correction_history.length, 1)
    assert.strictEqual(result.data.results[0].correction_history[0].request_id, 'revision-set-1')
    assert.strictEqual(result.data.results[0].correction_history[0].correction_group_id, 'revision-set-1')
    assert.strictEqual(result.data.results[0].correction_history[0].reason, 'แก้ไขตามใบงาน')
    assert.strictEqual(result.data.results[0].correction_history[0].before.result_value, '98')
    assert.strictEqual(result.data.results[0].correction_history[0].after.result_value, '101')
  }

  {
    const captures = []
    const resultItemId = '797979797979797979797979'
    const revisionRows = [
      {
        revision_id: 'ORDER-1|MY2608310001|UID-2', order_no: 'ORDER-1', filler_order_no: 'MY2608310001',
        result_uid: 'UID-2', report_seq: '2', stage: 'final', receipt_seq: '2',
        source_reported_at: '2026-08-31T10:20:00+07:00', received_at: '2026-08-31T10:20:30+07:00',
        receipt_id: 'RCPT-2', report_id: 'RPT-2', previous_revision_id: 'ORDER-1|MY2608310001|UID-1',
        item_count: 1, changed_item_count: 1,
        items_snapshot_json: JSON.stringify([{ obs_code: 'MY-CULTURE', obs_name: 'Fungal culture', value: 'Candida tropicalis', units: '', ref_range: 'Not detected', interpretation_code: 'POS', obx_status: 'F' }]),
      },
      {
        revision_id: 'ORDER-1|MY2608310001|UID-1', order_no: 'ORDER-1', filler_order_no: 'MY2608310001',
        result_uid: 'UID-1', report_seq: '1', stage: 'preliminary', receipt_seq: '1',
        source_reported_at: '2026-08-31T10:10:00+07:00', received_at: '2026-08-31T10:10:30+07:00',
        receipt_id: 'RCPT-1', report_id: 'RPT-1', previous_revision_id: '',
        item_count: 1, changed_item_count: 0,
        items_snapshot_json: JSON.stringify([{ obs_code: 'MY-CULTURE', obs_name: 'Fungal culture', value: 'Candida albicans', units: '', ref_range: 'Not detected', interpretation_code: 'POS', obx_status: 'P' }]),
      },
    ]
    const result = await Process(
      { action: 'get_manual_result', organization_code: '10', item_id: manualItemId },
      userAt('10'),
      makeApp(captures, {
        manualSectionCode: 'BC',
        manualStatus: 'completed',
        revisionRows,
        canonicalCurrent: [{ _id: resultItemId, order_no: '999999999999999999999999', obs_code: 'MY-CULTURE', result_value: 'Candida tropicalis', result_status: 'final', result_source: 'agent' }],
      }),
    )
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.result_revisions.length, 2)
    assert.strictEqual(result.data.result_revisions[0].latest, true)
    assert.strictEqual(result.data.result_revisions[0].items[0].changed, true)
    assert.strictEqual(result.data.result_revisions[0].items[0].previous_value, 'Candida albicans')
    assert.strictEqual(result.data.result_revisions[1].items[0].changed, false)
  }

  {
    const captures = []
    const clinicalReportId = '898989898989898989898989'
    const attachmentReportId = '909090909090909090909090'
    const result = await Process(
      { action: 'get_manual_result', organization_code: '10', item_id: manualItemId },
      userAt('10'),
      makeApp(captures, {
        manualSectionCode: 'BC',
        manualStatus: 'completed',
        canonicalCurrent: [{
          _id: '919191919191919191919191',
          order_no: '999999999999999999999999',
          obs_code: 'MY-CULTURE',
          result_value: 'normal result',
          result_status: 'final',
          result_source: 'agent',
          result_report_id: clinicalReportId,
        }],
        attachmentReport: {
          _id: attachmentReportId,
          report_key: `attachment-order|${manualOrderId}|BC`,
          result_attachments: [{ name: 'supporting-file.pdf' }],
        },
      }),
    )
    assert.strictEqual(result.success, true, result.message)
    assert.strictEqual(result.data.result_report_id, clinicalReportId, 'the printable parent must come from clinical Result Items')
    assert.deepStrictEqual(result.data.result_report_ids, [clinicalReportId])
    assert.strictEqual(result.data.attachment_report_id, attachmentReportId, 'the uploaded-file container must be exposed separately')
    assert.strictEqual(result.data.result_attachments.length, 1)
  }

  {
    const captures = []
    const attachment = {
      name: 'lab-result.pdf',
      size: 1024,
      uid: 'UPLOAD-1',
      url: 'https://apihis.softmax-one.com/assets/sdform/report/file/lab-result.pdf',
      response: {
        fileId: 'edededededededededededed',
        fileName: 'lab-result.pdf',
        filePath: 'https://apihis.softmax-one.com/assets/sdform/report/file/lab-result.pdf',
        fileType: 'pdf',
        fileGroup: 'sdform/6a8d4334f851000f28e5025b/file',
        mimetype: 'application/pdf',
        formId: RESULT_REPORT_FORM_ID,
      },
    }
    const result = await Process(
      {
        action: 'save_result_attachments',
        organization_code: '10',
        item_id: manualItemId,
        result_attachments: [attachment],
      },
      userAt('10'),
      makeApp(captures, { manualSectionCode: 'BC', manualStatus: 'sent' }),
    )
    assert.strictEqual(result.success, true, result.message)
    const reportSave = captures.find(entry => entry.type === 'sdformSetOne' && entry.formId === RESULT_REPORT_FORM_ID)
    assert(reportSave, 'attachment metadata must persist through the Result Report Form')
    assert.strictEqual(reportSave.data.report_key, 'attachment|999999999999999999999999')
    assert.strictEqual(reportSave.data.result_attachments.length, 1)
    assert.strictEqual(reportSave.data.result_attachments[0].response.fileId, 'edededededededededededed')
    assert.strictEqual(reportSave.data.confirmed_by, 'lab-test')
    assert.strictEqual(reportSave.data.confirmed_at, '2026-08-31 10:20:30')
    assert(!captures.some(entry => entry.type === 'update' && entry.from === 'zdata_lab_work_item'), 'upload alone must not change LAB status')
  }

  {
    const captures = []
    const attachment = {
      name: 'order-result.pdf',
      size: 2048,
      uid: 'UPLOAD-ORDER-1',
      url: 'https://apihis.softmax-one.com/assets/sdform/report/file/order-result.pdf',
      response: {
        fileId: 'cdcdcdcdcdcdcdcdcdcdcdcd',
        fileName: 'order-result.pdf',
        filePath: 'https://apihis.softmax-one.com/assets/sdform/report/file/order-result.pdf',
        fileType: 'pdf',
        fileGroup: 'sdform/6a8d4334f851000f28e5025b/file',
        mimetype: 'application/pdf',
        formId: RESULT_REPORT_FORM_ID,
      },
    }
    const result = await Process(
      {
        action: 'save_result_attachments',
        attachment_scope: 'order',
        organization_code: '10',
        item_id: manualItemId,
        result_attachments: [attachment],
      },
      userAt('10'),
      makeApp(captures, { manualSectionCode: 'BC', manualStatus: 'sent' }),
    )
    assert.strictEqual(result.success, true, result.message)
    const reportSave = captures.find(entry => entry.type === 'sdformSetOne' && entry.formId === RESULT_REPORT_FORM_ID)
    assert(reportSave, 'Order upload must persist through a dedicated attachment Result Report')
    assert.strictEqual(reportSave.data.report_key, `attachment-order|${manualOrderId}|BC`)
    assert.strictEqual(String(reportSave.data.xparentx), manualOrderId)
    assert.strictEqual(reportSave.data.order_no, manualOrderId)
    assert.strictEqual(reportSave.data.filler_order_no, 'R2608310001')
    assert.strictEqual(reportSave.data.record_kind, 'attachment')
    assert.strictEqual(reportSave.data.result_attachments.length, 1)
    assert(!captures.some(entry => entry.type === 'update' && entry.from === 'zdata_lab_work_item'), 'Order upload before specimen receipt must not change LAB status')
  }

  {
    const captures = []
    const result = await Process(
      {
        action: 'save_result_attachments',
        organization_code: '10',
        item_id: manualItemId,
        result_attachments: [{
          name: 'malware.exe',
          size: 100,
          response: {
            fileId: 'edededededededededededed',
            fileName: 'malware.exe',
            filePath: 'https://files.test/malware.exe',
            fileType: 'exe',
            mimetype: 'application/octet-stream',
            formId: RESULT_REPORT_FORM_ID,
          },
        }],
      },
      userAt('10'),
      makeApp(captures, { manualSectionCode: 'BC' }),
    )
    assert.strictEqual(result.success, false)
    assert(result.message.includes('ข้อมูลไฟล์แนบ') || result.message.includes('ชนิดไฟล์แนบ'))
    assert(!captures.some(entry => entry.type === 'sdformSetOne'))
  }

  {
    const attachmentAt = (index, size = 5 * 1024 * 1024) => {
      const fileId = index.toString(16).padStart(24, '0')
      return {
        name: `result-${index}.pdf`,
        size,
        uid: `UPLOAD-${index}`,
        url: `https://files.test/result-${index}.pdf`,
        response: {
          fileId,
          fileName: `result-${index}.pdf`,
          filePath: `https://files.test/result-${index}.pdf`,
          fileType: 'pdf',
          mimetype: 'application/pdf',
          formId: RESULT_REPORT_FORM_ID,
        },
      }
    }
    const captures = []
    const tenAttachments = Array.from({ length: 10 }, (_, index) => attachmentAt(index + 1))
    const accepted = await Process(
      {
        action: 'save_result_attachments',
        attachment_scope: 'order',
        organization_code: '10',
        item_id: manualItemId,
        result_attachments: tenAttachments,
      },
      userAt('10'),
      makeApp(captures, { manualSectionCode: 'BC', manualStatus: 'sent' }),
    )
    assert.strictEqual(accepted.success, true, accepted.message)
    const reportSave = captures.find(entry => entry.type === 'sdformSetOne' && entry.formId === RESULT_REPORT_FORM_ID)
    assert.strictEqual(reportSave.data.result_attachments.length, 10)

    const tooMany = await Process(
      {
        action: 'save_result_attachments',
        attachment_scope: 'order',
        organization_code: '10',
        item_id: manualItemId,
        result_attachments: [...tenAttachments, attachmentAt(11, 1)],
      },
      userAt('10'),
      makeApp([], { manualSectionCode: 'BC', manualStatus: 'sent' }),
    )
    assert.strictEqual(tooMany.success, false)
    assert(tooMany.message.includes('10 ไฟล์'))

    const tooLarge = await Process(
      {
        action: 'save_result_attachments',
        attachment_scope: 'order',
        organization_code: '10',
        item_id: manualItemId,
        result_attachments: Array.from({ length: 6 }, (_, index) => attachmentAt(index + 20, 9 * 1024 * 1024)),
      },
      userAt('10'),
      makeApp([], { manualSectionCode: 'BC', manualStatus: 'sent' }),
    )
    assert.strictEqual(tooLarge.success, false)
    assert(tooLarge.message.includes('50 MB'))

    const first = attachmentAt(40, 1024)
    const second = attachmentAt(41, 2048)
    const existingReport = {
      _id: 'abababababababababababab',
      report_key: `attachment-order|${manualOrderId}|BC`,
      result_attachments: [first, second],
    }
    const removeCaptures = []
    const removed = await Process(
      {
        action: 'save_result_attachments',
        attachment_scope: 'order',
        attachment_operation: 'remove',
        removed_attachment_key: first.response.fileId,
        organization_code: '10',
        item_id: manualItemId,
        result_attachments: [second],
      },
      userAt('10'),
      makeApp(removeCaptures, { manualSectionCode: 'BC', manualStatus: 'sent', attachmentReport: existingReport }),
    )
    assert.strictEqual(removed.success, true, removed.message)
    const removeSave = removeCaptures.find(entry => entry.type === 'sdformSetOne' && entry.formId === RESULT_REPORT_FORM_ID)
    assert.deepStrictEqual(removeSave.data.result_attachments.map(file => file.response.fileId), [second.response.fileId])

    const invalidRemove = await Process(
      {
        action: 'save_result_attachments',
        attachment_scope: 'order',
        attachment_operation: 'remove',
        removed_attachment_key: first.response.fileId,
        organization_code: '10',
        item_id: manualItemId,
        result_attachments: [],
      },
      userAt('10'),
      makeApp([], { manualSectionCode: 'BC', manualStatus: 'sent', attachmentReport: existingReport }),
    )
    assert.strictEqual(invalidRemove.success, false, 'remove must unlink exactly one existing attachment')
  }

  {
    const result = await Process(
      { organization_code: 'm1000' },
      { roles: ['manager'], username: 'manager-test', unit: { code: 'm1005' } },
      makeApp([]),
    )
    assert.strictEqual(result.success, false)
    assert(result.message.includes('Organization'))
  }

  {
    const result = await Process({ section_codes: ['HM'] }, userAt('10'), makeApp([]))
    assert.strictEqual(result.success, false)
    assert(result.message.includes('ไม่มีสิทธิ์'))
  }

  {
    const result = await Process(
      { section_codes: 'MY', statuses: 'sent,accepted', page: 2, limit: 500 },
      { roles: ['manager'], username: 'manager-test', unit: { code: 'm1000' } },
      makeApp([]),
    )
    assert.strictEqual(result.success, true)
    assert.deepStrictEqual(result.data.section_codes, ['MY'])
    assert.deepStrictEqual(result.data.sections.map(section => section.code), ['MY'])
    assert.deepStrictEqual(result.data.statuses, ['sent', 'accepted'])
    assert.strictEqual(result.data.page, 2)
    assert.strictEqual(result.data.limit, 100)
  }

  {
    const result = await Process(
      { section_codes: ['BC'] },
      { roles: ['manager'], username: 'manager-test', unit: { code: 'm1000' } },
      makeApp([]),
    )
    assert.strictEqual(result.success, false)
    assert(result.message.includes('ไม่มีสิทธิ์'))
  }

  {
    const captures = []
    const result = await Process(
      { organization_code: 'm1001', include_specimens: false },
      userAt('m1001'),
      makeApp(captures),
    )
    assert.strictEqual(result.success, true)
    assert.deepStrictEqual(result.data.section_codes, ['BC'])
    assert.strictEqual(Object.prototype.hasOwnProperty.call(result.data, 'specimen_options'), false)
    assert(!captures.some(provider => provider.from === 'zdata_specimen_code'))
    assert(!captures.some(provider => provider.from === 'zdata_lab_spec'))
  }

  {
    const captures = []
    const result = await Process({ priority: '2,5,9' }, userAt('10'), makeApp(captures))
    assert.strictEqual(result.success, true)
    assert.deepStrictEqual(result.data.priorities, ['2', '5'])
    const aggregateProvider = captures.find(provider => provider.from === 'zdata_cpoe_order_item')
    const orderMatch = aggregateProvider.nosql.pipeline.find(stage =>
      stage.$match && stage.$match['order.priority']
    )
    assert.deepStrictEqual(orderMatch.$match['order.priority'].$in, ['2', '5'])
  }

  {
    const result = await Process({ date_from: '30/08/2026' }, userAt('10'), makeApp([]))
    assert.strictEqual(result.success, false)
    assert(result.message.includes('YYYY-MM-DD'))
  }

  {
    const result = await Process({}, { roles: ['auth'], username: 'no-unit' }, makeApp([]))
    assert.strictEqual(result.success, false)
    assert(result.message.includes('Organization unit'))
  }

  {
    const app = makeApp([])
    app.isAuth = () => false
    const result = await Process({}, userAt('10'), app)
    assert.strictEqual(result.success, false)
    assert(result.message.includes('ไม่มีสิทธิ์'))
  }

  {
    const captures = []
    const app = makeApp(captures, {
      canonicalCurrent: [
        { _id: '121212121212121212121212', order_no: manualItemId, result_report_id: '343434343434343434343434', result_value: 'first', result_status: 'entered' },
        { _id: '565656565656565656565656', order_no: manualItemId, result_report_id: '787878787878787878787878', result_value: 'second', result_status: 'entered' },
      ],
    })
    const prepared = await Process(
      { action: 'prepare_result_pdf', organization_code: 'm1000', item_id: manualItemId },
      userAt('m1000'), app,
    )
    assert.strictEqual(prepared.success, true, prepared.message)
    assert.strictEqual(prepared.data.result_report_id, '343434343434343434343434')
    const itemSaves = captures.filter(entry => entry.type === 'sdformSetOne' && entry.formId === RESULT_ITEM_FORM_ID)
    assert.strictEqual(itemSaves.length, 2)
    assert(itemSaves.every(entry => entry.data.result_report_id === '343434343434343434343434'))
    assert(itemSaves.every(entry => entry.data.xparentx === '343434343434343434343434'), 'legacy Result Items must share the canonical PDF parent')
  }

  {
    const captures = []
    const app = makeApp(captures, {
      manualSectionCode: 'IM',
      manualMasterPatch: { is_hide_result: true },
      canonicalCurrent: [{ _id: '121212121212121212121212', order_no: manualItemId, result_report_id: '343434343434343434343434', obs_code: 'IM2', obs_name: 'Anti-HIV', result_value: 'SECRET', result_status: 'final' }],
    })
    const prepared = await Process(
      { action: 'prepare_result_pdf', organization_code: 'm1006', item_id: manualItemId },
      userAt('m1006'), app,
    )
    assert.strictEqual(prepared.success, true, prepared.message)
    assert.strictEqual(prepared.data.sensitive_grant_token, '', 'owner-room PDF preparation must not mint a Sensitive grant')
    assert.strictEqual(prepared.data.sensitive_grant_expires_at_epoch, 0)
    assert(!captures.some(entry => entry.type === 'dbInsert' && entry.collection === 'zdata_emr_sensitive_access_grant'), 'LAB-room ownership must never create a passwordless Sensitive grant')
  }

  {
    const captures = []
    const grantExpiresAt = Date.now() + (4 * 60 * 1000)
    const app = makeApp(captures, {
      manualSectionCode: 'IM',
      manualMasterPatch: { is_hide_result: true },
      sensitiveGrantRows: [{
        grant_token: 'doctor-grant-for-pdf',
        viewer_username: 'lab-test',
        source_order_id: manualOrderId,
        section_code: 'IM',
        purpose: 'ดูแลรักษาผู้ป่วย',
        expires_at_epoch: grantExpiresAt,
        authorized_by_user_id: 'DOCTOR-1',
        authorized_by_username: 'doctor.one',
        xrstatx: 1,
      }],
      canonicalCurrent: [{ _id: '121212121212121212121212', order_no: manualItemId, result_report_id: '343434343434343434343434', obs_code: 'IM2', obs_name: 'Anti-HIV', result_value: 'SECRET', result_status: 'final' }],
    })
    const prepared = await Process(
      { action: 'prepare_result_pdf', organization_code: 'm1006', item_id: manualItemId, sensitive_grant_token: 'doctor-grant-for-pdf', request_id: 'REQ-PDF-DOCTOR-GRANT' },
      userAt('m1006'), app,
    )
    assert.strictEqual(prepared.success, true, prepared.message)
    assert.strictEqual(prepared.data.sensitive_grant_token, '', 'LAB PDF must ignore even an existing doctor grant')
    assert.strictEqual(prepared.data.sensitive_grant_expires_at_epoch, 0)
    assert(!captures.some(entry => entry.from === 'zdata_emr_sensitive_access_grant'), 'LAB PDF must not query a grant that could disclose Sensitive values')
    assert(!captures.some(entry => entry.type === 'dbInsert' && entry.collection === 'zdata_emr_sensitive_access_log'), 'redacted LAB PDF is not a Sensitive disclosure event')
  }

  {
    const captures = []
    const app = makeApp(captures, {
      manualSectionCode: 'IM',
      manualMasterPatch: { is_hide_result: true },
      canonicalCurrent: [{ _id: '121212121212121212121212', order_no: '999999999999999999999999', result_report_id: '343434343434343434343434', obs_code: 'IM2', obs_name: 'Anti-HIV', result_value: 'SECRET', result_status: 'final' }],
    })
    const locked = await Process(
      { action: 'get_manual_result', organization_code: 'm1000', cross_section: true, lookup_mode: 'results', item_id: manualItemId },
      userAt('m1000'), app,
    )
    assert.strictEqual(locked.success, true)
    assert.strictEqual(locked.data.sensitive_locked, true)
    assert.strictEqual(Object.prototype.hasOwnProperty.call(locked.data, 'order_note'), false, 'locked Sensitive response must not expose the order note')
    assert.strictEqual(locked.data.test_name, 'Fungal culture', 'ordered test name remains visible')
    assert.strictEqual(locked.data.result_report_id, '343434343434343434343434', 'redacted PDF parent remains available before re-auth')
    assert.deepStrictEqual(locked.data.result_report_ids, ['343434343434343434343434'])
    assert.strictEqual(JSON.stringify(locked).includes('SECRET'), false, 'cross-room response must not disclose the Sensitive value before re-auth')
    const parentLookup = captures.find(entry => entry.from === 'zdata_lab_result_item')
    assert(parentLookup, 'locked flow must resolve only the Result Report parent needed for redacted PDF')
    assert.deepStrictEqual(parentLookup.nosql.projection, { result_report_id: 1, xparentx: 1 })
    assert(!captures.some(entry => entry.type === 'sdformGetAll' && entry.provider.providerId === RESULT_ITEM_FORM_ID), 'locked flow must not load clinical Result Items through the Form provider')
  }

  {
    const captures = []
    const app = makeApp(captures, {
      manualSectionCode: 'IM',
      manualMasterPatch: { is_hide_result: true },
      // Legacy core_user account intentionally has no xrstatx.
      doctorAccount: { _id: 'DOCTOR-1', username: 'doctor.one', password_hash: 'doctor-hash', roles: ['DOCTOR'] },
      canonicalCurrent: [{ _id: '121212121212121212121212', order_no: '999999999999999999999999', result_report_id: '343434343434343434343434', obs_code: 'IM2', obs_name: 'Anti-HIV', result_value: 'SECRET', result_status: 'final' }],
    })
    const opened = await Process.call(
      { compareHash: async (hash, password) => hash === 'doctor-hash' && password === 'correct-password' },
      { action: 'authorize_sensitive_result', organization_code: 'M0900', cross_section: true, lookup_mode: 'results', item_id: manualItemId, username: 'doctor.one', password: 'correct-password', purpose: 'ดูแลรักษาผู้ป่วย', request_id: 'REQ-SENSITIVE-1' },
      userAt('M0900'), app,
    )
    assert.strictEqual(opened.success, true, 'the isolated unimported X-ray lookup grant path must remain unchanged')
    assert.strictEqual(opened.data.results[0].result_value, 'SECRET')
    assert(opened.data.sensitive_grant_token)
    const doctorLookup = captures.find(entry => entry.from === 'core_user')
    assert(doctorLookup, 'doctor account must be resolved from core_user')
    assert.deepStrictEqual(doctorLookup.nosql.query.xrstatx, { $nin: [0, 3] }, 'legacy doctor without xrstatx must remain eligible')
    const inserts = captures.filter(entry => entry.type === 'dbInsert')
    const grantInsert = inserts.find(entry => entry.collection === 'zdata_emr_sensitive_access_grant')
    assert(grantInsert)
    assert(grantInsert.data.expires_at_epoch > Date.now())
    // 2026-09-28 user-confirmed policy change: Sensitive disclosure lasts five minutes.
    assert.strictEqual(grantInsert.data.expires_at_epoch - grantInsert.data.issued_at_epoch, 5 * 60 * 1000, 'Sensitive grant TTL must equal five minutes')
    assert(grantInsert.data.expires_at_epoch <= Date.now() + (5 * 60 * 1000), 'Sensitive grant TTL must be at most five minutes')
    assert.strictEqual(inserts.filter(entry => entry.collection === 'zdata_emr_sensitive_access_log').length, 2, 'authorization and disclosure must each be logged')
    assert.strictEqual(JSON.stringify(inserts).includes('correct-password'), false, 'password must never enter audit/grant storage')
  }

  {
    const captures = []
    const app = makeApp(captures, {
      manualSectionCode: 'IM',
      manualMasterPatch: { is_hide_result: true },
      sensitiveGrantRows: [{
        grant_token: 'legacy-lab-grant',
        viewer_username: 'lab-test',
        source_order_id: manualOrderId,
        section_code: 'IM',
        purpose: 'ดูแลรักษาผู้ป่วย',
        expires_at_epoch: Date.now() + (4 * 60 * 1000),
        authorized_by_user_id: 'DOCTOR-1',
        authorized_by_username: 'doctor.one',
        xrstatx: 1,
      }],
      canonicalCurrent: [{ _id: '121212121212121212121212', order_no: '999999999999999999999999', result_report_id: '343434343434343434343434', obs_code: 'IM2', obs_name: 'Anti-HIV', result_value: 'IMMUNOLOGY-VISIBLE', result_status: 'final' }],
    })
    const local = await Process(
      { action: 'get_manual_result', organization_code: 'm1006', item_id: manualItemId, sensitive_grant_token: 'legacy-lab-grant', request_id: 'REQ-IM-LOCAL' },
      userAt('m1006'), app,
    )
    assert.strictEqual(local.success, true)
    assert.strictEqual(local.data.sensitive_locked, true)
    assert.strictEqual(Object.prototype.hasOwnProperty.call(local.data, 'order_note'), false, 'locked local Sensitive response must not expose the order note')
    assert.strictEqual(local.data.test_name, 'Fungal culture', 'Immunology still sees the ordered test name')
    assert.strictEqual(JSON.stringify(local).includes('IMMUNOLOGY-VISIBLE'), false, 'Immunology must not receive the Sensitive value without a doctor grant')
    assert.strictEqual(Object.prototype.hasOwnProperty.call(local.data, 'sensitive_local_immunology'), false)
    assert(!captures.some(entry => entry.from === 'zdata_emr_sensitive_access_grant'), 'LAB must ignore an old grant token and remain redacted')
    assert(!captures.some(entry => entry.type === 'dbInsert' && entry.collection === 'zdata_emr_sensitive_access_log'), 'a redacted placeholder is not a disclosure event')
  }

  {
    const captures = []
    const app = makeApp(captures, {
      manualSectionCode: 'IM',
      manualMasterPatch: { is_hide_result: true },
      doctorAccount: { _id: 'DOCTOR-1', username: 'doctor.one', password_hash: 'doctor-hash', roles: ['DOCTOR'] },
      canonicalCurrent: [{ _id: '121212121212121212121212', order_no: manualItemId, result_report_id: '343434343434343434343434', obs_code: 'IM2', obs_name: 'Anti-HIV', result_value: 'SECRET', result_status: 'final' }],
    })
    const denied = await Process.call(
      { compareHash: async () => true },
      { action: 'authorize_sensitive_result', organization_code: 'm1006', cross_section: true, lookup_mode: 'results', item_id: manualItemId, username: 'doctor.one', password: 'correct-password', purpose: 'ดูแลรักษาผู้ป่วย', request_id: 'REQ-LAB-NO-AUTH' },
      userAt('m1006'), app,
    )
    assert.strictEqual(denied.success, false)
    assert.strictEqual(denied.error, 'lab_sensitive_redacted')
    assert(!captures.some(entry => entry.from === 'core_user'), 'LAB must reject re-auth before reading credentials')
    assert(!captures.some(entry => entry.type === 'dbInsert' && entry.collection === 'zdata_emr_sensitive_access_grant'), 'LAB must never mint a Sensitive grant')
  }

  assert(apiBody.includes("action === 'retest_item'"))
  assert(apiBody.includes("action === 'swap_cbc_item'"))
  assert(!apiBody.includes('localImmunologyAccess'), 'Sensitive access must not have an Immunology owner-room bypass')
  assert(!apiBody.includes('immunology_local_access'), 'Sensitive audit must not record a passwordless Immunology access path')
  assert(apiBody.includes("error: 'lab_sensitive_redacted'"), 'LAB authorization must be rejected server-side')
  assert(apiBody.includes('is_current_attempt: { $ne: false }'), 'Worklist must resolve only the latest active Work Item attempt')
  assert(apiBody.includes("retest_pending_lab_no: { $eq: ['$work_item.retest_pending_lab_no', true] }"))
  assert(apiBody.includes("attempt_no: { $ifNull: ['$work_item.attempt_no', 1] }"))

  console.log('LAB CPOE worklist API tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
