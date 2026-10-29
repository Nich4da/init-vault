const assert = require('assert')
const fs = require('fs')
const path = require('path')

const processBody = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/lab_uat_seed_api.js'),
  'utf8'
)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const processApi = new AsyncFunction('params', 'app', 'userInfo', processBody)

const clone = value => JSON.parse(JSON.stringify(value))
const valueText = value => {
  if (value == null) return ''
  if (typeof value === 'object') return String(value.$oid || value.value || value._id || '')
  return String(value)
}
const get = (object, dotted) => dotted.split('.').reduce((value, key) => value == null ? undefined : value[key], object)
const set = (object, dotted, value) => {
  const keys = dotted.split('.')
  let cursor = object
  keys.slice(0, -1).forEach(key => {
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {}
    cursor = cursor[key]
  })
  cursor[keys.at(-1)] = clone(value)
}
const unset = (object, dotted) => {
  const keys = dotted.split('.')
  let cursor = object
  keys.slice(0, -1).forEach(key => { cursor = cursor && cursor[key] })
  if (cursor) delete cursor[keys.at(-1)]
}
const equal = (left, right) => valueText(left) === valueText(right)
const matches = (row, query) => Object.entries(query || {}).every(([key, condition]) => {
  if (key === '$or') return condition.some(branch => matches(row, branch))
  const value = get(row, key)
  if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
    if ('$in' in condition && !condition.$in.some(candidate => equal(value, candidate))) return false
    if ('$nin' in condition && condition.$nin.some(candidate => equal(value, candidate))) return false
    if ('$ne' in condition && equal(value, condition.$ne)) return false
    const operators = ['$in', '$nin', '$ne']
    if (!Object.keys(condition).some(key => operators.includes(key))) return equal(value, condition)
    return true
  }
  return equal(value, condition)
})

const HN = '6999999'
const VN = '6999998'
const ids = {
  visit: 'eeeeeeeeeeeeeeeeeeeeeee1',
  order: 'aaaaaaaaaaaaaaaaaaaaaaa1',
  bc: 'bbbbbbbbbbbbbbbbbbbbbbb1',
  im: 'bbbbbbbbbbbbbbbbbbbbbbb2',
  mb: 'bbbbbbbbbbbbbbbbbbbbbbb3',
  my: 'bbbbbbbbbbbbbbbbbbbbbbb4',
  bcMaster: 'ccccccccccccccccccccccc1',
  imMaster: 'ccccccccccccccccccccccc2',
  mbMaster: 'ccccccccccccccccccccccc3',
  myMaster: 'ccccccccccccccccccccccc4'
}
const flowMasterIds = {
  my: '6a900cc00c6722b3af181fab',
  reject: '6a900cc00c6722b3af181cc8',
  cancel: '6a900cc00c6722b3af181ccb',
  result: '6a900cc00c6722b3af181cd3'
}
const bcProfileMasterIds = {
  liver: '6a900cc00c6722b3af181cba',
  sodium: '6a900cc00c6722b3af181ccf',
  potassium: '6a900cc00c6722b3af181cd0',
  chloride: '6a900cc00c6722b3af181cd1',
  co2: '6a900cc00c6722b3af181cd2'
}
const suiteMasterIds = {
  BC: '6a900cc00c6722b3af181cba',
  HM: '6a900cc00c6722b3af181dbb',
  HH: '6a900cc00c6722b3af181d96',
  ML: '6a900cc00c6722b3af181ff0',
  IM: '6a900cc00c6722b3af181e90',
  'MI-OUT': '6a900cc00c6722b3af181e16',
  MB: '6a900cc00c6722b3af181fbd',
  MY: '6a900cc00c6722b3af181fab',
  BB: '6a900cc00c6722b3af181c4e',
  BG: '6a900cc00c6722b3af181c85'
}

const master = (id, itemCode, section, testCode, name, extra = {}) => ({
  _id: id, xrstatx: 1, item_code: itemCode, item_name: name,
  section: { code: section, name: section },
  lab_item: { his_lab_code: testCode, name, specimen: { code: section === 'MB' ? '99' : 'BL', name: section === 'MB' ? 'Others' : 'Blood' } },
  ...extra
})
const item = (id, masterId, itemCode, name) => ({
  _id: id, xparentx: ids.order, xrstatx: 1, current_status: 'ready',
  service_type: { value: 'lab' }, item_data_id: masterId, item_code: itemCode,
  item_name: name, order_id: { value: ids.order }, comment: itemCode === 'C1' ? 'Comment ระดับ Test UAT' : ''
})

const makeState = () => ({
  zdata_cpoe_order: [{
    _id: ids.order, xrstatx: 1, current_status: 'ready', order_number: 'R-UAT-001',
    order_comment: 'UAT Order comment', created_at: '2026-10-20 09:00:00',
    vid: { vn: VN, pid: { hn: HN, p_fname: 'ทดสอบ', p_lname: 'LAB UAT ไม่ใช่คนจริง' } }
  }],
  zdata_cpoe_order_item: [
    item(ids.bc, ids.bcMaster, 'C1', 'Liver Function Test'),
    item(ids.im, ids.imMaster, 'IM2', 'Anti-HIV'),
    item(ids.mb, ids.mbMaster, 'M7', 'Aerobic culture'),
    item(ids.my, ids.myMaster, 'M12', 'SCABIES')
  ],
  zdata_master_item_order: [
    master(ids.bcMaster, 'C1', 'BC', '1001CD', 'Liver Function Test'),
    master(ids.imMaster, 'IM2', 'IM', '3002BL', 'Anti-HIV', { is_hide_result: true }),
    master(ids.mbMaster, 'M7', 'MB', '400799', 'Aerobic culture'),
    master(ids.myMaster, 'M12', 'MY', '4102M50', 'SCABIES', { multi_specimen: true }),
    master(flowMasterIds.my, 'M12', 'MY', '4102M50', 'SCABIES', { multi_specimen: true }),
    master(flowMasterIds.reject, 'C20', 'BC', '100801CD', 'BUN'),
    master(flowMasterIds.cancel, 'C23', 'BC', '1023CD', 'Sugar (Glucose) (BS)'),
    master(flowMasterIds.result, 'C26', 'BC', '3026CD', 'Calcium Total'),
    master(bcProfileMasterIds.liver, 'C1', 'BC', '1001CD', 'Liver Function Test'),
    master(bcProfileMasterIds.sodium, 'C25.1-CD', 'BC', '102501CD', 'Sodium (Na) จาก Clotted blood'),
    master(bcProfileMasterIds.potassium, 'C25.2-CD', 'BC', '102502CD', 'Potassium (K) จาก Clotted blood'),
    master(bcProfileMasterIds.chloride, 'C25.3-CD', 'BC', '102503CD', 'Chloride (Cl) จาก Clotted blood'),
    master(bcProfileMasterIds.co2, 'C25.4-CD', 'BC', '102504CD', 'Total Carbondioxide (tCO2) จาก Clotted blood'),
    master(suiteMasterIds.HM, 'HM1', 'HM', '2001EB', 'Complete Blood Count'),
    master(suiteMasterIds.HH, 'H15', 'HH', '2215CD', 'Hematology special test'),
    master(suiteMasterIds.ML, 'MS6', 'ML', '2106UR', 'Urinalysis'),
    master(suiteMasterIds.IM, 'IM2', 'IM', '3002BL', 'Anti-HIV'),
    master(suiteMasterIds['MI-OUT'], 'I0059', 'MI-OUT', '310059BL', 'External molecular test'),
    master(suiteMasterIds.MB, 'M7', 'MB', '400799', 'Aerobic culture'),
    master(suiteMasterIds.BB, 'BB2', 'BB', '5002CD', 'ABO grouping'),
    master(suiteMasterIds.BG, 'BG1', 'BG', '7001BL', 'Chromosome analysis')
  ],
  zdata_visit: [{
    _id: ids.visit, xrstatx: 1, vn: VN,
    pid: { hn: HN, p_fname: 'ทดสอบ', p_lname: 'LAB UAT ไม่ใช่คนจริง' }
  }],
  zdata_lab_work_item: [],
  zdata_lab_outband_order: [],
  zdata_lab_no_counter: [],
  zdata_lab_uat_seed_run: [],
  zdata_lab_result_inbound: [],
  zdata_lab_report_manual_entry: [],
  zdata_lab_result_item: [],
  zdata_lab_result_revision_log: [],
  zdata_fa_bill: [], zdata_fa_bill_item: [], zdata_visit_tran: []
})

const makeApp = state => {
  let idSeq = 0
  let labNoSeq = 0
  const processCalls = []
  const collection = name => {
    if (!state[name]) state[name] = []
    const rows = state[name]
    return {
      findOne: async query => rows.find(row => matches(row, query)) || null,
      find: query => ({ toArray: async () => rows.filter(row => matches(row, query)) }),
      insertOne: async document => { rows.push(clone(document)); return { insertedId: document._id } },
      updateOne: async (query, update) => {
        const row = rows.find(candidate => matches(candidate, query))
        if (!row) return { matchedCount: 0, modifiedCount: 0 }
        Object.entries(update.$set || {}).forEach(([key, value]) => set(row, key, value))
        Object.keys(update.$unset || {}).forEach(key => unset(row, key))
        return { matchedCount: 1, modifiedCount: 1 }
      },
      updateMany: async (query, update) => {
        const selected = rows.filter(candidate => matches(candidate, query))
        selected.forEach(row => {
          Object.entries(update.$set || {}).forEach(([key, value]) => set(row, key, value))
          Object.keys(update.$unset || {}).forEach(key => unset(row, key))
        })
        return { matchedCount: selected.length, modifiedCount: selected.length }
      },
      findOneAndUpdate: async (query, pipeline) => {
        let row = rows.find(candidate => matches(candidate, query))
        if (!row) { row = { _id: query._id, sequence: 0 }; rows.push(row) }
        labNoSeq += 1
        const section = String(query._id).split(':')[1]
        Object.assign(row, { section_code: section, sequence: labNoSeq, daily_limit_reached: false })
        return { value: clone(row) }
      }
    }
  }
  const newId = () => (++idSeq).toString(16).padStart(24, '0')
  return {
    processCalls,
    isAdmin: () => true,
    isSuper: () => false,
    curDate: format => format.includes('T') ? '2026-10-20T10:15:00+07:00' : '2026-10-20 10:15:00',
    dbObjectId: value => value == null ? newId() : String(value),
    db: { collection },
    insertData: async () => ({ success: true, id: newId() }),
    sdformSetOne: async (formId, id, data) => {
      const target = formId === '6a8d4334f851000f28e5025b' ? 'zdata_lab_report_manual_entry' : 'zdata_lab_result_item'
      const current = state[target].find(row => row._id === id)
      if (current) Object.assign(current, clone(data))
      else state[target].push({ _id: id, xrstatx: 1, ...clone(data) })
      return { success: true, id }
    },
    subProcess: async (processId, payload) => {
      processCalls.push({ processId, payload: clone(payload) })
      if (processId === '6a71edd247075049ef0245af') {
        const visit = state.zdata_visit.find(row => row._id === valueText(payload.visit_id))
        assert(visit, 'CPOE mock requires a test visit')
        const orderId = newId()
        const orderNumber = 'R-UAT-FLOW-' + String(state.zdata_cpoe_order.length + 1).padStart(2, '0')
        state.zdata_cpoe_order.push({
          _id: orderId, xrstatx: 1, current_status: 'draft', order_number: orderNumber,
          order_comment: payload.order_comment, order_tags: clone(payload.order_tags || []),
          created_at: '2026-10-20 10:15:00', vid: clone(visit)
        })
        payload.lines.forEach((line, index) => state.zdata_cpoe_order_item.push({
          _id: newId(), xparentx: orderId, xrstatx: 1, current_status: 'draft', item_no: index + 1,
          service_type: { value: 'lab' }, item_data_id: line.item_data_id, item_code: line.item_code,
          item_name: line.item_name, quantity: line.quantity, comment: line.comment, lab_data: clone(line.lab_data),
          order_id: { value: orderId }, created_at: '2026-10-20 10:15:00'
        }))
        return { reply: { data: { success: true, order_id: orderId, order_number: orderNumber } } }
      }
      assert.strictEqual(processId, '6a8da8a6f851000f28e50299', 'seed_existing may call only canonical inbound upsert')
      const receiptId = newId()
      const reportId = newId()
      state.zdata_lab_result_inbound.push({ _id: receiptId, xrstatx: 1, order_no: payload.order_no, result_uid: payload.result_uid })
      state.zdata_lab_report_manual_entry.push({ _id: reportId, xrstatx: 1, order_no: payload.order_no, result_uid: payload.result_uid })
      payload.items.forEach((result, index) => state.zdata_lab_result_item.push({
        _id: newId(), xrstatx: 1, result_report_id: reportId, order_no: payload.order_no,
        result_uid: payload.result_uid, result_sequence: String(index + 1),
        test_code: result.obs_code, obs_code: result.obs_code, test_name: result.obs_name,
        result_value: result.value, result_comment: result.comment,
        interpretation_code: result.interpretation_code, is_critical: result.is_critical
      }))
      const work = state.zdata_lab_work_item.find(row => row._id === payload.order_no)
      if (work) Object.assign(work, { work_status: 'completed', resulted_at: '2026-10-20 10:15:00' })
      const orderItem = state.zdata_cpoe_order_item.find(row => row._id === payload.order_no)
      if (orderItem) orderItem.current_status = 'completed'
      return { reply: { data: { success: true, data: { receipt_id: receiptId, result_report_id: reportId } } } }
    }
  }
}

const userInfo = { username: 'lab-uat-admin', roles: ['admin'], unit: { code: 'LAB_UAT' }, _id: 'dddddddddddddddddddddddd' }
const context = { genUUID: () => '00000000-0000-4000-8000-000000000001' }

;(async () => {
  {
    const state = makeState()
    const before = clone(state)
    const preview = await processApi.call(context, {
      action: 'preview_manual_suite', visit_id: ids.visit, expected_hn: HN,
      confirm: 'LAB_UAT_NO_LIS'
    }, makeApp(state), userInfo)
    assert.strictEqual(preview.success, true)
    assert.deepStrictEqual(preview.data.rooms.map(row => row.section), [
      'BC', 'HM', 'HH', 'ML', 'IM', 'MI-OUT', 'MB', 'MY', 'BB', 'BG'
    ])
    assert.strictEqual(preview.data.target_status, 'accepted')
    assert.strictEqual(preview.data.manual_entry_ready, true)
    assert.strictEqual(preview.data.result_created, false)
    assert.strictEqual(preview.data.receive_bypassed, true)
    assert.deepStrictEqual(state, before, 'manual suite preview must be read-only')
  }

  {
    const state = makeState()
    const financeBefore = clone({ bills: state.zdata_fa_bill, billItems: state.zdata_fa_bill_item, visits: state.zdata_visit_tran })
    const app = makeApp(state)
    const created = await processApi.call(context, {
      action: 'create_manual_suite', visit_id: ids.visit, expected_hn: HN,
      confirm: 'LAB_UAT_NO_LIS', note: 'manual entry all LAB rooms'
    }, app, userInfo)
    assert.strictEqual(created.success, true)
    assert.strictEqual(created.data.item_count, 10)
    assert.deepStrictEqual(created.data.coverage, ['BC', 'HM', 'HH', 'ML', 'IM', 'MI-OUT', 'MB', 'MY', 'BB', 'BG'])
    assert.strictEqual(created.data.target_status, 'accepted')
    assert.strictEqual(created.data.manual_entry_ready, true)
    assert.strictEqual(created.data.result_created, false)
    assert.strictEqual(created.data.receive_bypassed, true)
    assert.strictEqual(created.data.finance_record_created, false)
    assert.strictEqual(created.data.agent_called, false)
    assert.strictEqual(created.data.lis_called, false)
    assert.strictEqual(created.data.external_http_called, false)
    assert.strictEqual(app.processCalls.length, 10, 'manual suite may call only CPOE save once per room')
    assert(app.processCalls.every(call => call.processId === '6a71edd247075049ef0245af'))
    assert.strictEqual(state.zdata_lab_work_item.filter(row => row.xrstatx === 1).length, 10)
    assert.strictEqual(state.zdata_lab_outband_order.filter(row => row.xrstatx === 1).length, 10)
    assert.strictEqual(state.zdata_lab_result_inbound.length, 0)
    assert.strictEqual(state.zdata_lab_report_manual_entry.length, 0)
    assert.strictEqual(state.zdata_lab_result_item.length, 0)
    created.data.items.forEach(entry => {
      assert.strictEqual(state.zdata_cpoe_order_item.find(row => row._id === entry.item_id).current_status, 'accepted')
      const outbound = state.zdata_lab_outband_order.find(row => row._id === entry.item_id)
      assert.strictEqual(outbound.hl7_status, 'uat_bypassed')
      assert.strictEqual(outbound.transport_channel, 'uat_seed_no_transport')
      assert.strictEqual(outbound.attempt_count, 0)
      assert.strictEqual(outbound.dispatch_id, '')
    })
    created.data.created_order_ids.forEach(orderId => {
      assert.strictEqual(state.zdata_cpoe_order.find(row => row._id === orderId).current_status, 'accepted')
    })
    assert.deepStrictEqual(
      { bills: state.zdata_fa_bill, billItems: state.zdata_fa_bill_item, visits: state.zdata_visit_tran },
      financeBefore,
      'manual suite must not create or update finance/visit transaction records'
    )
    const cleaned = await processApi.call(context, {
      action: 'cleanup', seed_run_id: created.data.seed_run_id, confirm: 'LAB_UAT_NO_LIS'
    }, app, userInfo)
    assert.strictEqual(cleaned.success, true)
    assert.strictEqual(cleaned.data.lab_no_counter_reused, false)
    created.data.created_order_ids.forEach(orderId => {
      assert.strictEqual(state.zdata_cpoe_order.find(row => row._id === orderId).xrstatx, 3)
      state.zdata_cpoe_order_item.filter(row => row.xparentx === orderId).forEach(row => assert.strictEqual(row.xrstatx, 3))
    })
    state.zdata_lab_work_item.forEach(row => assert.strictEqual(row.xrstatx, 3))
    state.zdata_lab_outband_order.forEach(row => assert.strictEqual(row.xrstatx, 3))
  }

  {
    const state = makeState()
    const before = clone(state)
    const result = await processApi.call(context, {
      action: 'preview_existing', item_ids: [ids.bc], expected_hn: 'WRONG', confirm: 'LAB_UAT_NO_LIS'
    }, makeApp(state), userInfo)
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'seed_preflight_failed')
    assert.deepStrictEqual(state, before, 'preview with wrong HN must be read-only')
  }

  {
    const state = makeState()
    const financeBefore = clone({ bills: state.zdata_fa_bill, billItems: state.zdata_fa_bill_item, visits: state.zdata_visit_tran })
    const app = makeApp(state)
    const result = await processApi.call(context, {
      action: 'seed_existing', item_ids: [ids.bc, ids.im, ids.mb, ids.my], expected_hn: HN,
      confirm: 'LAB_UAT_NO_LIS', note: 'all result-format smoke test'
    }, app, userInfo)
    assert.strictEqual(result.success, true)
    assert.deepStrictEqual(result.data.coverage, ['BC', 'IM', 'MB', 'MY'])
    assert.strictEqual(result.data.finance_record_created, false)
    assert.strictEqual(result.data.agent_called, false)
    assert.strictEqual(result.data.lis_called, false)
    assert.strictEqual(result.data.external_http_called, false)
    assert.strictEqual(state.zdata_lab_outband_order.length, 4)
    state.zdata_lab_outband_order.forEach(row => {
      assert.strictEqual(row.hl7_status, 'uat_bypassed')
      assert.strictEqual(row.transport_channel, 'uat_seed_no_transport')
      assert.strictEqual(row.retryable, false)
      assert.strictEqual(row.attempt_count, 0)
      assert.strictEqual(row.dispatch_id, '')
      assert.strictEqual(row.uat_seed.agent_called, false)
      assert.strictEqual(row.uat_seed.lis_called, false)
    })
    assert.deepStrictEqual(
      { bills: state.zdata_fa_bill, billItems: state.zdata_fa_bill_item, visits: state.zdata_visit_tran },
      financeBefore,
      'seed must not create or update finance/visit transaction records'
    )
    result.data.items.forEach(row => assert.match(row.lab_no, /^(10|30|40|41)691020\d{4}$/))

    const bcCall = app.processCalls.find(call => call.payload.order_no === ids.bc)
    assert(bcCall)
    assert.strictEqual(bcCall.payload.order_note, 'Comment ระดับ Order: UAT BC profile')
    assert.deepStrictEqual(bcCall.payload.items.map(row => row.obs_code), ['100101CD', '100102CD', '10010401CD', '100105CD', '100106CD'])
    assert.strictEqual(bcCall.payload.items[0].comment, 'UAT profile result')

    const imCall = app.processCalls.find(call => call.payload.order_no === ids.im)
    assert(imCall)
    assert.strictEqual(imCall.payload.items[0].value, 'Reactive (UAT)')
    assert.strictEqual(imCall.payload.items[0].is_critical, true, 'critical decision must be explicit')
    assert.strictEqual(state.zdata_master_item_order.find(row => row._id === ids.imMaster).is_hide_result, true, 'Sensitive master policy must remain active')

    const mbCall = app.processCalls.find(call => call.payload.order_no === ids.mb)
    assert(mbCall)
    const raw = mbCall.payload.items[0].value
    assert(raw.includes('SPECIMEN: Body Fluid (BF)'))
    assert(raw.includes('* Aerobic Culture *'))
    assert(raw.includes('No growth after 5 days'))
    assert(raw.includes('LAB NO.: '))
    assert(raw.includes('\n'), 'MLab result must remain one multiline raw text block')

    const myRows = state.zdata_lab_result_item.filter(row => row.lab_section === 'MY')
    assert.strictEqual(myRows.length, 4)
    assert.deepStrictEqual(myRows.map(row => [row.specimen_index, row.pathology_sub_index]), [[0, 0], [0, 1], [1, 0], [2, 0]])
    assert.strictEqual(myRows[1].actual_site_name, 'ลำคอ')
    assert.strictEqual(myRows[1].actual_site_detail, 'ตำแหน่งที่ห้อง LAB เพิ่มเอง')
    assert.strictEqual(myRows[1].result_value, 'ไม่พบเชื้อ\nผลเพิ่มเติม UAT')
    assert(myRows.every(row => row.result_status === 'final'))

    assert.strictEqual(app.processCalls.length, 3, 'MY is manual; only BC/IM/MB use local canonical result upsert')
    assert(app.processCalls.every(call => call.processId === '6a8da8a6f851000f28e50299'))

    const runId = result.data.seed_run_id
    const outbound = state.zdata_lab_outband_order.find(row => row._id === ids.bc)
    outbound.dispatch_id = 'REAL-DISPATCH-MUST-BLOCK-CLEANUP'
    const blockedCleanup = await processApi.call(context, {
      action: 'cleanup', seed_run_id: runId, confirm: 'LAB_UAT_NO_LIS'
    }, app, userInfo)
    assert.strictEqual(blockedCleanup.success, false)
    assert.strictEqual(blockedCleanup.error, 'cleanup_transport_conflict')
    assert.strictEqual(state.zdata_cpoe_order_item.find(row => row._id === ids.bc).current_status, 'completed')
  }

  {
    const state = makeState()
    const before = clone(state)
    const preview = await processApi.call(context, {
      action: 'preview_flow_suite', visit_id: ids.visit, expected_hn: HN, confirm: 'LAB_UAT_NO_LIS'
    }, makeApp(state), userInfo)
    assert.strictEqual(preview.success, true)
    assert.deepStrictEqual(preview.data.scenarios.map(row => row.scenario), [
      'MY_RECEIVE_MANUAL', 'BC_REJECT_RETEST', 'BC_CANCEL_FINANCE_READONLY', 'BC_RESULT_ENTRY_NO_LIS'
    ])
    assert.strictEqual(preview.data.finance_check_mode, 'read_only_on_cancel')
    assert.deepStrictEqual(state, before, 'flow preview must be read-only')
  }

  {
    const state = makeState()
    const before = clone(state)
    const preview = await processApi.call(context, {
      action: 'preview_bc_profile_suite', visit_id: ids.visit, expected_hn: HN,
      confirm: 'LAB_UAT_NO_LIS'
    }, makeApp(state), userInfo)
    assert.strictEqual(preview.success, true)
    assert.deepStrictEqual(preview.data.items.map(row => row.item_code), [
      'C1', 'C25.1-CD', 'C25.2-CD', 'C25.3-CD', 'C25.4-CD'
    ])
    assert.strictEqual(preview.data.bypasses_receive, true)
    assert.deepStrictEqual(state, before, 'BC profile preview must be read-only')
  }

  {
    const state = makeState()
    const financeBefore = clone({ bills: state.zdata_fa_bill, billItems: state.zdata_fa_bill_item, visits: state.zdata_visit_tran })
    const app = makeApp(state)
    const created = await processApi.call(context, {
      action: 'create_bc_profile_suite', visit_id: ids.visit, expected_hn: HN,
      confirm: 'LAB_UAT_NO_LIS', note: 'Liver Function + complete Electrolyte profile'
    }, app, userInfo)
    assert.strictEqual(created.success, true)
    assert.strictEqual(created.data.item_count, 5)
    assert.deepStrictEqual(created.data.coverage, ['BC', 'BC', 'BC', 'BC', 'BC'])
    assert.strictEqual(created.data.agent_called, false)
    assert.strictEqual(created.data.lis_called, false)
    assert.strictEqual(created.data.finance_record_created, false)
    assert.strictEqual(app.processCalls.filter(call => call.processId === '6a71edd247075049ef0245af').length, 1)
    const orderSave = app.processCalls.find(call => call.processId === '6a71edd247075049ef0245af')
    assert.deepStrictEqual(orderSave.payload.lines.map(line => line.item_code), [
      'C1', 'C25.1-CD', 'C25.2-CD', 'C25.3-CD', 'C25.4-CD'
    ])
    assert.strictEqual(state.zdata_lab_work_item.filter(row => row.xrstatx === 1).length, 5)
    assert.strictEqual(state.zdata_lab_outband_order.filter(row => row.xrstatx === 1).length, 5)
    assert.strictEqual(state.zdata_lab_result_inbound.filter(row => row.xrstatx === 1).length, 5)
    assert.strictEqual(state.zdata_lab_result_item.filter(row => row.xrstatx === 1).length, 9)
    const potassium = state.zdata_lab_result_item.find(row => row.obs_code === '102502CD')
    const chloride = state.zdata_lab_result_item.find(row => row.obs_code === '102503CD')
    assert.strictEqual(potassium.result_value, '4.20')
    assert.strictEqual(chloride.interpretation_code, 'H')
    state.zdata_lab_outband_order.forEach(row => {
      assert.strictEqual(row.hl7_status, 'uat_bypassed')
      assert.strictEqual(row.transport_channel, 'uat_seed_no_transport')
      assert.strictEqual(row.retryable, false)
      assert.strictEqual(row.attempt_count, 0)
    })
    assert.deepStrictEqual(
      { bills: state.zdata_fa_bill, billItems: state.zdata_fa_bill_item, visits: state.zdata_visit_tran },
      financeBefore,
      'BC profile seed must not create or update finance/visit transaction records'
    )
  }

  {
    const state = makeState()
    const financeBefore = clone({ bills: state.zdata_fa_bill, billItems: state.zdata_fa_bill_item, visits: state.zdata_visit_tran })
    const app = makeApp(state)
    const created = await processApi.call(context, {
      action: 'create_flow_suite', visit_id: ids.visit, expected_hn: HN,
      confirm: 'LAB_UAT_NO_LIS', note: 'interactive Worklist flows'
    }, app, userInfo)
    assert.strictEqual(created.success, true)
    assert.strictEqual(created.data.scenarios.length, 4)
    assert.strictEqual(created.data.finance_record_created, false)
    assert.strictEqual(created.data.finance_check_mode, 'read_only_on_cancel')
    assert.strictEqual(created.data.agent_called, false)
    assert.strictEqual(created.data.lis_called, false)
    assert.strictEqual(created.data.receive_click_allowed_only_for, 'MY_RECEIVE_MANUAL')
    assert.strictEqual(app.processCalls.length, 4, 'flow suite may call only CPOE save once per scenario')
    assert(app.processCalls.every(call => call.processId === '6a71edd247075049ef0245af'))

    const scenarios = Object.fromEntries(created.data.scenarios.map(row => [row.scenario, row]))
    assert.strictEqual(scenarios.MY_RECEIVE_MANUAL.status, 'ready')
    assert.strictEqual(scenarios.MY_RECEIVE_MANUAL.receive_click_safe, true)
    assert.strictEqual(scenarios.BC_REJECT_RETEST.status, 'ready')
    assert.strictEqual(scenarios.BC_CANCEL_FINANCE_READONLY.status, 'ready')
    assert.strictEqual(scenarios.BC_CANCEL_FINANCE_READONLY.finance_check_mode, 'read_only_on_cancel')
    assert.strictEqual(scenarios.BC_RESULT_ENTRY_NO_LIS.status, 'accepted')
    assert.match(scenarios.BC_RESULT_ENTRY_NO_LIS.lab_no, /^10691020\d{4}$/)
    assert.strictEqual(scenarios.BC_RESULT_ENTRY_NO_LIS.transport_locked, true)
    assert.strictEqual(scenarios.BC_RESULT_ENTRY_NO_LIS.result_created, false)

    const myItem = state.zdata_cpoe_order_item.find(row => row._id === scenarios.MY_RECEIVE_MANUAL.item_id)
    assert.strictEqual(myItem.quantity, 3)
    assert.strictEqual(myItem.lab_data.rows.length, 3)
    const acceptedItem = state.zdata_cpoe_order_item.find(row => row._id === scenarios.BC_RESULT_ENTRY_NO_LIS.item_id)
    assert.strictEqual(acceptedItem.current_status, 'accepted')
    assert.strictEqual(state.zdata_lab_work_item.filter(row => row.xrstatx === 1).length, 1)
    assert.strictEqual(state.zdata_lab_outband_order.filter(row => row.xrstatx === 1).length, 1)
    assert.strictEqual(state.zdata_lab_result_inbound.length, 0)
    assert.strictEqual(state.zdata_lab_result_item.length, 0)
    const outbound = state.zdata_lab_outband_order.find(row => row._id === scenarios.BC_RESULT_ENTRY_NO_LIS.item_id)
    assert.strictEqual(outbound.hl7_status, 'uat_bypassed')
    assert.strictEqual(outbound.transport_channel, 'uat_seed_no_transport')
    assert.strictEqual(outbound.retryable, false)
    assert.strictEqual(outbound.attempt_count, 0)
    assert.deepStrictEqual(
      { bills: state.zdata_fa_bill, billItems: state.zdata_fa_bill_item, visits: state.zdata_visit_tran },
      financeBefore,
      'flow suite must not create or update finance/visit transaction records'
    )

    const cleaned = await processApi.call(context, {
      action: 'cleanup', seed_run_id: created.data.seed_run_id, confirm: 'LAB_UAT_NO_LIS'
    }, app, userInfo)
    assert.strictEqual(cleaned.success, true)
    created.data.created_order_ids.forEach(orderId => {
      assert.strictEqual(state.zdata_cpoe_order.find(row => row._id === orderId).xrstatx, 3)
      state.zdata_cpoe_order_item.filter(row => row.xparentx === orderId).forEach(row => assert.strictEqual(row.xrstatx, 3))
    })
  }

  {
    const state = makeState()
    const runId = 'LAB-UAT-RESUME-00000001'
    const flowOrderId = 'fffffffffffffffffffffff1'
    const flowItemId = 'fffffffffffffffffffffff2'
    state.zdata_cpoe_order.push({
      _id: flowOrderId, xrstatx: 1, current_status: 'ready', order_number: 'R-UAT-FLOW-PARTIAL',
      order_comment: '[UAT FLOW] MY partial', created_at: '2026-10-20 10:15:00',
      vid: clone(state.zdata_visit[0]), uat_seed: { run_id: runId, scenario: 'MY_RECEIVE_MANUAL' }
    })
    state.zdata_cpoe_order_item.push({
      _id: flowItemId, xparentx: flowOrderId, xrstatx: 1, current_status: 'ready',
      service_type: { value: 'lab' }, item_data_id: flowMasterIds.my, item_code: 'M12', item_name: 'SCABIES',
      order_id: { value: flowOrderId }, quantity: 3, uat_seed: { run_id: runId, scenario: 'MY_RECEIVE_MANUAL' }
    })
    state.zdata_lab_uat_seed_run.push({
      run_id: runId, mode: 'create_flow_suite', status: 'cleanup_required', expected_hn: HN,
      visit_id: ids.visit, item_ids: [flowItemId], created_order_ids: [flowOrderId], items: [],
      scenarios: [{ scenario: 'MY_RECEIVE_MANUAL', section: 'MY', order_id: flowOrderId, item_id: flowItemId, status: 'ready' }],
      xrstatx: 1
    })
    const app = makeApp(state)
    const resumed = await processApi.call(context, {
      action: 'resume_flow_suite', seed_run_id: runId, visit_id: ids.visit,
      expected_hn: HN, confirm: 'LAB_UAT_NO_LIS'
    }, app, userInfo)
    assert.strictEqual(resumed.success, true)
    assert.strictEqual(resumed.data.seed_run_id, runId)
    assert.strictEqual(resumed.data.scenarios.length, 4)
    assert.strictEqual(resumed.data.created_order_ids.length, 4)
    assert.strictEqual(app.processCalls.length, 3, 'resume must skip the already-created MY scenario')
    assert(app.processCalls.every(call => call.processId === '6a71edd247075049ef0245af'))
    assert.strictEqual(state.zdata_lab_uat_seed_run[0].status, 'seeded')
    assert.strictEqual(state.zdata_lab_work_item.filter(row => row.xrstatx === 1).length, 1)
    assert.strictEqual(state.zdata_lab_result_inbound.length, 0)
  }

  {
    const source = processBody
    assert(!/\bfetch\s*\(/.test(source))
    assert(!/\baxios\b/.test(source))
    assert(!/lab_agent_order_submit/i.test(source.replace(/\*[^]*?\*\//g, '')), 'executable source must not reference Agent submit')
    assert(!/lab_cpoe_receive/i.test(source), 'seed must not call the real Receive process')
    assert(!/zdata_fa_bill/.test(source), 'seed source must not reference finance Bill collections')
    assert(!/zdata_visit_tran/.test(source), 'seed source must not reference Visit Tran')
  }

  {
    const state = makeState()
    const app = makeApp(state)
    const seeded = await processApi.call(context, {
      action: 'seed_existing', item_ids: [ids.bc, ids.im, ids.mb, ids.my], expected_hn: HN,
      confirm: 'LAB_UAT_NO_LIS'
    }, app, userInfo)
    assert.strictEqual(seeded.success, true)
    const counterSnapshot = clone(state.zdata_lab_no_counter)
    const cleaned = await processApi.call(context, {
      action: 'cleanup', seed_run_id: seeded.data.seed_run_id, confirm: 'LAB_UAT_NO_LIS'
    }, app, userInfo)
    assert.strictEqual(cleaned.success, true)
    assert.strictEqual(cleaned.data.lab_no_counter_reused, false)
    assert.strictEqual(state.zdata_cpoe_order[0].current_status, 'ready', 'cleanup must restore parent Order status')
    state.zdata_cpoe_order_item.forEach(row => assert.strictEqual(row.current_status, 'ready'))
    state.zdata_lab_work_item.forEach(row => assert.strictEqual(row.xrstatx, 3))
    state.zdata_lab_outband_order.forEach(row => assert.strictEqual(row.xrstatx, 3))
    state.zdata_lab_result_item.forEach(row => assert.strictEqual(row.xrstatx, 3))
    assert.deepStrictEqual(state.zdata_lab_no_counter, counterSnapshot, 'cleanup must never decrement or reuse LAB NO. counters')
  }

  console.log('test_lab_uat_seed_api: OK')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
