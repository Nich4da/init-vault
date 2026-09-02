const assert = require('assert')
const fs = require('fs')
const path = require('path')

const apiBody = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/lab_cpoe_worklist_api.js'),
  'utf8',
)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const Process = new AsyncFunction('params', 'userInfo', 'app', apiBody)
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
  canonicalCurrent = [],
  canonicalPrevious = [],
} = {}) => ({
  isAuth: () => true,
  isSuper: roles => roles.includes('super'),
  isAdmin: roles => roles.includes('admin'),
  isManager: roles => roles.includes('manager'),
  dbObjectId: id => String(id),
  db: {
    collection: name => {
      if (name === 'zdata_lab_order_cancellation') {
        return { findOne: async () => null }
      }
      if (name !== 'zdata_lab_work_item') throw new Error('Unexpected direct collection ' + name)
      return {
        findOne: async query => {
          if (query.source_specimen_record_id !== manualItemId) return null
          return {
            _id: '999999999999999999999999',
            xrstatx: 1,
            source_specimen_record_id: manualItemId,
            lab_no: 'MY2608310001',
            section_code: manualSectionCode,
            work_status: manualStatus === 'sent' ? 'waiting_receive' : manualStatus === 'resulted' ? 'resulted' : 'received',
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
            current_status: 'sent',
            service_type: { value: 'lab' },
            item_data_id: writeMasterId,
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
            lab_item: { unit_symbol: 'CFU/mL', reference_range: 'Not detected' },
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
          ],
        },
      }
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
    throw new Error('Unexpected collection ' + provider.from)
  },
  curDate: () => '2026-08-31 10:20:30',
  sdformGetAll: async provider => {
    captures.push({ type: 'sdformGetAll', provider })
    if (provider.providerId === RESULT_REPORT_FORM_ID && provider.options.where.includes('report_key = :reportKey')) {
      return { success: true, data: [] }
    }
    if (provider.providerId === RESULT_ITEM_FORM_ID && provider.options.where.includes('order_no = :workItemId')) {
      return { success: true, data: canonicalCurrent }
    }
    if (provider.providerId === RESULT_ITEM_FORM_ID && provider.options.where.includes('hn = :patientHn')) {
      return { success: true, data: canonicalPrevious }
    }
    if (provider.providerId === LEGACY_RESULT_ITEM_FORM_ID && provider.options.where.includes('source_item_id = :itemId')) {
      return { success: true, data: [] }
    }
    if (provider.providerId === LEGACY_RESULT_ITEM_FORM_ID && provider.options.where.includes('patient_hn = :patientHn')) {
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
    ])

    const aggregateProvider = captures.find(provider => provider.from === 'zdata_cpoe_order_item')
    assert(aggregateProvider, 'must query CPOE Order Item as the worklist source')
    assert.strictEqual(aggregateProvider.nosql.type, 'aggregate')
    assert.deepStrictEqual(aggregateProvider.nosql.collections, ['zdata_cpoe_order_item'])

    const pipelineText = JSON.stringify(aggregateProvider.nosql.pipeline)
    assert(pipelineText.includes('zdata_master_item_order'))
    assert(pipelineText.includes('zdata_section'))
    assert(pipelineText.includes('zdata_cpoe_order'))
    assert(pipelineText.includes('zdata_lab_work_item'))
    assert(pipelineText.includes('zdata_lab_order_cancellation'))
    assert(pipelineText.includes('service_type.value'))
    assert(pipelineText.includes('resolved_section.code'))
    assert(pipelineText.includes('group_child'))
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
    assert(pipelineText.includes('is_critical'))
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

    const visitProvider = captures.find(provider => provider.from === 'zdata_visit')
    assert(visitProvider, 'must query Visit records for the LAB manual-order launcher')
    assert.deepStrictEqual(visitProvider.nosql.query, {
      xrstatx: { $nin: [0, 3] },
      visit_date: '2026-08-31',
      visit_status: true,
    })
    assert.strictEqual(visitProvider.nosql.projection['pid.hn'], 1)
    assert.strictEqual(Object.prototype.hasOwnProperty.call(visitProvider.nosql.projection, 'pid.p_pic'), false)
    assert.strictEqual(visitProvider.nosql.limit, 2000)
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
    const update = captures.find(entry => entry.type === 'update')
    assert(update, 'must persist specimen selection')
    assert.strictEqual(update.from, 'zdata_cpoe_order_item')
    assert.strictEqual(update.data.lab_data.spec_source, 'Blood')
    assert.strictEqual(update.data.lab_data.spec_source_code, 'BL')
    assert.strictEqual(update.data.lab_data.specimen_at, '2026-08-30T09:00')
    assert.strictEqual(update.filter.current_status, 'sent')
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
    assert.deepStrictEqual(result.data.section_codes, ['MB', 'MY'])
    assert.deepStrictEqual(result.data.sections.map(section => section.code), ['MB', 'MY'])
    assert.strictEqual(result.data.organization_code, 'M1005')
  }

  {
    const captures = []
    const result = await Process(
      { action: 'get_manual_result', organization_code: 'm1005', item_id: manualItemId },
      userAt('m1005'),
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
      { action: 'get_manual_result', organization_code: 'm1005', item_id: manualItemId },
      userAt('m1005'),
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
          units: 'g/dL',
          result_status: 'corrected',
          result_version: '3',
          entered_at: '2026-08-31 09:30:00',
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
    assert.strictEqual(result.data.results[0].last_edited_by, 'ผู้แก้ผล')
  }

  {
    const captures = []
    const result = await Process(
      { action: 'get_manual_result', organization_code: 'm1005', item_id: manualItemId },
      userAt('m1005'),
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
        organization_code: 'm1005',
        item_id: manualItemId,
        manual_result: { result_value: 'must-not-save' },
      },
      userAt('m1005'),
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
        manual_result: { result_value: 'must-not-save' },
      },
      userAt('10'),
      makeApp(captures, { manualSectionCode: 'BC' }),
    )
    assert.strictEqual(result.success, false)
    assert(result.message.includes('Mycology'))
    assert(!captures.some(entry => entry.type === 'sdformSetOne'))
  }

  {
    const captures = []
    const result = await Process(
      {
        action: 'save_manual_result',
        organization_code: 'm1005',
        item_id: manualItemId,
        manual_result: {
          result_value: 'Candida tropicalis',
          unit: 'CFU/mL',
          interpretation: 'POS',
          reference_range: 'Not detected',
        },
      },
      userAt('m1005'),
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
      { section_codes: 'BC,HM', statuses: 'sent,accepted', page: 2, limit: 500 },
      { roles: ['manager'], username: 'manager-test', unit: { code: 'm1000' } },
      makeApp([]),
    )
    assert.strictEqual(result.success, true)
    assert.deepStrictEqual(result.data.section_codes, ['BC', 'HM'])
    assert.deepStrictEqual(result.data.sections.map(section => section.code), ['BC', 'HM'])
    assert.deepStrictEqual(result.data.statuses, ['sent', 'accepted'])
    assert.strictEqual(result.data.page, 2)
    assert.strictEqual(result.data.limit, 100)
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

  console.log('LAB CPOE worklist API tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
