const assert = require('assert')
const fs = require('fs')
const path = require('path')

const apiBody = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/lab_cpoe_worklist_api.js'),
  'utf8',
)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const Process = new AsyncFunction('params', 'userInfo', 'app', apiBody)

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
    items: [{ item_id: 'ITEM-1', item_code: 'C2', current_status: 'accepted', section: { code: 'BC' } }],
    item_count: 1,
  }],
  meta: [{ total: 1 }],
}

const writeItemId = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const writeMasterId = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const manualItemId = 'cccccccccccccccccccccccc'
const manualMasterId = 'dddddddddddddddddddddddd'
const manualOrderId = 'eeeeeeeeeeeeeeeeeeeeeeee'

const makeApp = (captures, manualSectionCode = 'MY', manualStatus = 'accepted') => ({
  isAuth: () => true,
  isSuper: roles => roles.includes('super'),
  isAdmin: roles => roles.includes('admin'),
  isManager: roles => roles.includes('manager'),
  dbObjectId: id => String(id),
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
    if (provider.from === 'zdata_cpoe_order_item') {
      return { success: true, reply: { data: [facetResult] } }
    }
    throw new Error('Unexpected collection ' + provider.from)
  },
  curDate: () => '2026-08-31 10:20:30',
  sdformGetAll: async provider => {
    captures.push({ type: 'sdformGetAll', provider })
    if (provider.options.where.includes('source_item_id = :itemId')) {
      return { success: true, data: [] }
    }
    if (provider.options.where.includes('filler_order_no = :labNo')) {
      return {
        success: true,
        data: [{
          _id: 'agent-result-row',
          filler_order_no: provider.params.labNo,
          result_source: 'agent',
          result_status: 'final',
          result_value: 'Detected',
          unit_symbol_snapshot: '',
          interpretation_code: 'H',
          reference_range_snapshot: 'Not detected',
          is_critical: false,
          test_code: 'MY-CULTURE',
          test_name: 'Fungal culture',
          reported_at: '2026-08-31 10:00:00',
        }],
      }
    }
    if (provider.options.where.includes('patient_hn = :patientHn')) {
      return {
        success: true,
        data: [{
          source_item_id: 'OLD-ITEM',
          result_status: 'entered',
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
    return { success: true, id: 'ffffffffffffffffffffffff' }
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
    assert.strictEqual(result.data.orders[0].current_status, 'accepted')
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
    assert(pipelineText.includes('service_type.value'))
    assert(pipelineText.includes('resolved_section.code'))
    assert(pipelineText.includes('group_child'))
    assert(pipelineText.includes('emr_context'))
    assert(pipelineText.includes('order.vid.pid.age'))

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
    assert.strictEqual(result.data.result_entry, 'pencil')
    assert.strictEqual(result.data.visit_vn, 'VN-NEW')
    assert.strictEqual(result.data.unit, '')
    assert.strictEqual(result.data.reference_range, 'Not detected')
    assert.strictEqual(result.data.previous, null)
    assert.strictEqual(result.data.patient_previous.value, 'Candida albicans')
    assert.strictEqual(result.data.patient_previous.visit_vn, 'VN-OLD')
    assert.strictEqual(result.data.results.length, 1)
    assert.strictEqual(result.data.results[0].result_source, 'agent')
    assert.strictEqual(result.data.results[0].is_critical, false)
  }

  {
    const captures = []
    const result = await Process(
      { action: 'get_manual_result', organization_code: 'm1001', item_id: manualItemId },
      userAt('m1001'),
      makeApp(captures, 'BC'),
    )
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.section_code, 'BC')
    assert.strictEqual(result.data.result_entry, 'pencil')
  }

  {
    const captures = []
    const result = await Process(
      { action: 'get_manual_result', organization_code: 'm1001', item_id: manualItemId },
      userAt('m1001'),
      makeApp(captures, 'BC', 'sent'),
    )
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.section_code, 'BC')
    assert.strictEqual(result.data.results.length, 1)
  }

  {
    const result = await Process(
      {
        action: 'save_manual_result',
        organization_code: 'm1001',
        item_id: manualItemId,
        manual_result: { result_value: '123' },
      },
      userAt('m1001'),
      makeApp([], 'BC', 'sent'),
    )
    assert.strictEqual(result.success, false)
    assert(result.message.includes('รับ specimen ก่อน'))
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
    const save = captures.find(entry => entry.type === 'sdformSetOne')
    assert(save, 'must persist a Result Item')
    assert.strictEqual(save.formId, '6a7aa641935ed08882467374')
    assert.strictEqual(save.data.source_item_id, manualItemId)
    assert.strictEqual(save.data.patient_hn, 'HN-TEST')
    assert.strictEqual(save.data.visit_vn, 'VN-NEW')
    assert.strictEqual(save.data.previous_value, 'Detected')
    assert.strictEqual(save.data.result_value, 'Candida tropicalis')
    assert.strictEqual(save.data.unit_symbol_snapshot, 'CFU/mL')
    assert.strictEqual(save.data.interpretation_code, 'POS')
    assert.strictEqual(save.data.reference_range_snapshot, 'Not detected')
    const itemAudit = JSON.parse(save.data.edit_history_json)
    assert.strictEqual(itemAudit.length, 1)
    assert.strictEqual(itemAudit[0].result_value, 'Detected')
    assert.strictEqual(itemAudit[0].source, 'agent')
    const statusUpdate = captures.find(entry => entry.type === 'update' && entry.from === 'zdata_cpoe_order_item')
    assert(statusUpdate, 'entered Manual result must move only this Item to resulted')
    assert.strictEqual(statusUpdate.filter._id, manualItemId)
    assert.strictEqual(statusUpdate.data.current_status, 'resulted')
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
