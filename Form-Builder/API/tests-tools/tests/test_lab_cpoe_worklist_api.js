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
const LEGACY_RESULT_ITEM_FORM_ID = '6a7aa641935ed08882467374'

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
  canonicalCurrent = [],
  canonicalReports = [],
  canonicalPrevious = [],
  unmatchedReceiptRows = [],
  attachmentReport = null,
  legacyLookupFails = false,
  writeStatus = 'sent',
  writeReceivedAt = '',
  writeLabNo = '',
  writeWorkStatus = '',
  writeCancellation = null,
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
            work_status: manualStatus === 'sent' ? 'waiting_receive' : manualStatus === 'resulted' ? 'resulted' : 'received',
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
            lab_data: { specimen_at: '2026-08-30T09:00' },
          },
        },
      }
    }
    if (from === 'zdata_master_item_order' && String(id) === writeMasterId) {
      return {
        success: true,
        reply: { data: { _id: writeMasterId, section: { code: 'HH', name: 'Hematology-Homeostasis' } } },
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
            lab_no: 'MY2608310001',
            lab_data: { spec_source: 'Skin scraping', spec_source_code: 'SKIN' },
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
    if (provider.from === 'zdata_specimen_code') {
      return {
        success: true,
        reply: {
          data: [
            { specimen_code: 'BL', specimen_name: 'Blood' },
            { specimen_code: 'CD', specimen_name: 'Clotted blood' },
            { specimen_code: 'OLD', specimen_name: 'Inactive specimen', is_active: false },
          ],
        },
      }
    }
    if (provider.from === 'zdata_master_item_order') {
      if (provider.nosql.type === 'aggregate') {
        return {
          success: true,
          reply: {
            data: [
              { specimen_code: 'CD', specimen_name: 'Clotted blood' },
              { specimen_code: 'IC', specimen_name: 'Ionized Calcium Blood' },
            ],
          },
        }
      }
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
    if (provider.from === 'zdata_cpoe_order_item') {
      return { success: true, reply: { data: [facetResult] } }
    }
    if (provider.from === 'zdata_cpoe_order' && provider.nosql.type === 'aggregate') {
      return { success: true, reply: { data: [facetResult] } }
    }
    throw new Error('Unexpected collection ' + provider.from)
  },
  curDate: () => '2026-08-31 10:20:30',
  sdformGetAll: async provider => {
    captures.push({ type: 'sdformGetAll', provider })
    if (provider.providerId === RESULT_RECEIPT_FORM_ID) {
      return { success: true, data: unmatchedReceiptRows }
    }
    if (provider.providerId === RESULT_REPORT_FORM_ID && provider.options.where.includes('report_key =')) {
      return { success: true, data: attachmentReport ? [attachmentReport] : [] }
    }
    if (provider.providerId === RESULT_REPORT_FORM_ID && provider.options.where.includes('order_no = :workItemId')) {
      return { success: true, data: canonicalReports }
    }
    if (provider.providerId === RESULT_ITEM_FORM_ID && provider.options.where.includes('order_no = :workItemId')) {
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
    return { success: true, id }
  },
})

const userAt = code => ({ roles: ['auth'], username: 'lab-test', unit: { code, name: code } })

;
(async () => {
  assert.deepStrictEqual(
    componentMapFrom(apiBody),
    componentMapFrom(receiverApiBody),
    'Worklist and Result Receiver must use the same ordered-test -> result-component mapping',
  )

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
    assert.strictEqual(result.data.orders[0].prior_medication, '2')
    assert.strictEqual(result.data.orders[0].prior_specify, 'abacavir')
    assert.strictEqual(result.data.orders[0].diagnosis.label, 'C4102 Maxilla malignant neoplasm')
    assert.deepStrictEqual(result.data.specimen_options, [
      { value: 'BL', label: 'Blood' },
      { value: 'CD', label: 'Clotted blood' },
      { value: 'IC', label: 'Ionized Calcium Blood' },
    ])
    const specimenProvider = captures.find(provider => provider.from === 'zdata_specimen_code')
    assert(specimenProvider, 'list must read the Specimen master')
    assert.strictEqual(Object.prototype.hasOwnProperty.call(specimenProvider.nosql.query, 'is_active'), false,
      'query must not discard legacy rows whose is_active field is missing')
    assert.strictEqual(specimenProvider.nosql.limit, 2000, 'dropdown must request the complete Specimen master page')
    assert.strictEqual(specimenProvider.nosql.projection.is_active, 1,
      'runtime must filter only rows explicitly marked inactive')
    const configuredSpecimenProvider = captures.find(provider =>
      provider.from === 'zdata_master_item_order' && provider.nosql.type === 'aggregate'
    )
    assert(configuredSpecimenProvider, 'list must merge specimen codes configured on active CPOE LAB items')
    assert.deepStrictEqual(configuredSpecimenProvider.nosql.collections, ['zdata_master_item_order'])

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
      stage.$match && stage.$match.row_filter_status
    )
    assert(rowStatusStageIndex > orderGroupIndex, 'row status must be derived only after every sibling Item is grouped')
    assert(rowStatusFilterIndex > rowStatusStageIndex, 'tab status must filter the complete Order+Section row')
    assert.deepStrictEqual(
      aggregateProvider.nosql.pipeline[rowStatusFilterIndex].$match.row_filter_status,
      { $in: ['sent'] },
    )
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
    const dailyDateMatch = aggregateProvider.nosql.pipeline.find(stage =>
      stage.$match && stage.$match.daily_scope_day
    )
    assert(dailyDateMatch, 'default Worklist must enforce a current-day status-time scope')
    assert.deepStrictEqual(dailyDateMatch.$match.daily_scope_day, {
      $gte: '2026-08-31',
      $lte: '2026-08-31',
    })
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
    assert.deepStrictEqual(result.data.section_codes, ['BC', 'HM', 'HH', 'MB', 'MY'])
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
    const specimenLookup = captures.find(entry => entry.from === 'zdata_specimen_code')
    assert(specimenLookup, 'specimen correction must validate against the same master list')
    assert.strictEqual(Object.prototype.hasOwnProperty.call(specimenLookup.nosql.query, 'is_active'), false)
    assert.strictEqual(specimenLookup.nosql.limit, 2000)
    assert.strictEqual(specimenLookup.nosql.projection.is_active, 1)
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

  {
    // Site ที่ Specimen master กลางยังไม่มี code แต่ CPOE LAB item ใช้งาน code นี้อยู่
    // ต้องเลือกและบันทึกได้ โดยยังคงปฏิเสธ code ที่ไม่อยู่ใน master ใดเลย.
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
    const configuredLookup = captures.find(entry =>
      entry.from === 'zdata_master_item_order' && entry.nosql.type === 'query'
    )
    assert(configuredLookup, 'specimen correction must fall back to active CPOE item configuration')
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
        }],
      }),
    )
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.reported_by_source_name, 'ผู้รายงานจาก Result Report')
    assert.strictEqual(result.data.verified_by_source_name, 'ผู้ยืนยันจาก Result Report')
    assert.strictEqual(result.data.results[0].reported_by_source_name, 'ผู้รายงานจาก Result Report')
    assert.strictEqual(result.data.results[0].verified_by_source_id, 'APPROVER001')
    assert.strictEqual(result.data.results[0].verified_by_source_name, 'ผู้ยืนยันจาก Result Report')
    const reportLookup = captures.find(entry => entry.type === 'sdformGetAll' && entry.provider.providerId === RESULT_REPORT_FORM_ID && entry.provider.options.where.includes('order_no = :workItemId'))
    assert(reportLookup, 'result viewer must load parent Result Report metadata')
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
    assert.strictEqual(result.data.results[0].is_critical, true, 'visibility must not clear Critical Result')

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
        reason: 'x',
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
    assert.strictEqual(result.success, false)
    assert(result.message.includes('3 ตัวอักษร'))
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
    assert.strictEqual(reportSave.data.report_key, 'manual|999999999999999999999999')
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
        action: 'save_manual_result',
        organization_code: 'm1000',
        item_id: manualItemId,
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
          _id: 'CURRENT-MANUAL-RESULT',
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
    const save = captures.find(entry => entry.type === 'sdformSetOne' && entry.formId === RESULT_ITEM_FORM_ID)
    assert(save, 'manual pencil correction must update the canonical Result Item')
    assert.strictEqual(save.id, 'CURRENT-MANUAL-RESULT')
    assert.strictEqual(save.data.entered_by, 'first-editor', 'manual correction must retain the original entry identity')
    assert.strictEqual(save.data.last_edited_by, 'his-pencil-editor', 'manual pencil must audit the logged-in HIS user')
    assert.strictEqual(save.data.last_edited_at, '2026-08-31 10:20:30')
    assert.strictEqual(save.data.change_kind, 'corrected')
  }

  {
    const captures = []
    const resultItemId = 'abababababababababababab'
    const result = await Process(
      {
        action: 'save_result_edits',
        organization_code: '10',
        item_id: manualItemId,
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
    const save = captures.find(entry => entry.type === 'sdformSetOne' && entry.formId === RESULT_ITEM_FORM_ID)
    assert(save, 'pencil correction must update the existing canonical Result Item')
    assert.strictEqual(save.id, resultItemId)
    assert.strictEqual(save.data.result_value, '101')
    assert.strictEqual(save.data.unit_symbol_snapshot, 'mg/dL')
    assert.strictEqual(save.data.interpretation_code, 'H')
    assert.strictEqual(save.data.reference_range_snapshot, '70-100')
    assert.strictEqual(save.data.last_edited_by, 'his-result-editor')
    assert.strictEqual(save.data.last_edited_at, '2026-08-31 10:20:30')
    assert.strictEqual(save.data.change_kind, 'corrected')
    assert.strictEqual(Object.prototype.hasOwnProperty.call(save.data, 'is_critical'), false, 'HIS edit must not recalculate Critical')
    assert.strictEqual(Object.prototype.hasOwnProperty.call(save.data, 'result_source'), false, 'HIS edit must preserve Agent/LIS source')
    assert.strictEqual(result.data.results[0].result_source, 'agent')
    assert.strictEqual(result.data.results[0].is_critical, false)
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
    assert.deepStrictEqual(result.data.specimen_options, [])
    assert(!captures.some(provider => provider.from === 'zdata_specimen_code'))
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

  assert(apiBody.includes("action === 'retest_item'"))
  assert(apiBody.includes("action === 'swap_cbc_item'"))
  assert(apiBody.includes('is_current_attempt: { $ne: false }'), 'Worklist must resolve only the latest active Work Item attempt')
  assert(apiBody.includes("retest_pending_lab_no: { $eq: ['$work_item.retest_pending_lab_no', true] }"))
  assert(apiBody.includes("attempt_no: { $ifNull: ['$work_item.attempt_no', 1] }"))

  console.log('LAB CPOE worklist API tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
