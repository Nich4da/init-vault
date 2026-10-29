#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../../../..')
const FORM = path.join(ROOT, 'Form-Builder/SDForm/form-factory/forms/lab-emr-result-history-popup-v1.json')
const TEMPLATE_REPLACEMENT = path.join(ROOT, '02-his/form-factory/lab-popup-result-template-FULL-v2-REPLACE.txt')
const ON_CREATED_REPLACEMENT = path.join(ROOT, '02-his/form-factory/lab-popup-result-onCreated-FULL-v6-REPLACE.txt')
const CSS_FULL_REPLACEMENT = path.join(ROOT, '02-his/form-factory/lab-popup-result-css-FULL-v3-REPLACE.txt')
const PROCESS_ID = '6ab3be31cec3020e8562a2c9'

const findVueUi = value => {
  if (!value || typeof value !== 'object') return null
  if (value.component === 'vue-ui') return value
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findVueUi(item)
        if (found) return found
      }
    } else {
      const found = findVueUi(child)
      if (found) return found
    }
  }
  return null
}

const form = JSON.parse(fs.readFileSync(FORM, 'utf8'))
const widget = findVueUi(form)
assert(widget, 'LAB result form must contain one vue-ui widget')
assert(!/DEMO|demoMlab|baseRows|genericRows|isDemo|lab_result_payload/.test(JSON.stringify(widget)), 'production form must not contain demo clinical-result fallbacks')
assert(!widget.options.onCreated.trim().endsWith('s.load();'), 'popup must not read the Form connector during onCreated')
assert.match(widget.options.onMounted, /setTimeout\(start, 50\)/, 'popup must wait for the parent Form connector after mount')
assert.match(widget.options.onMounted, /form && form\.userState/, 'mounted loader must guard userState behind an existing Form ref')
assert.match(widget.options.content, /<sd-report[^>]+:report-list="reportList\(\)"[^>]+:params="reportParams\(\)"/, 'popup must bind its report button to the LAB Result Report')
assert.doesNotMatch(widget.options.onCreated, /Report binding ของ EMR/, 'report button must not remain a placeholder notification')
assert.match(widget.options.onCreated, /typeof form\.closePopup==='function'/, 'custom close controls must close their own popup')
assert.strictEqual(fs.readFileSync(TEMPLATE_REPLACEMENT, 'utf8').replace(/\n$/, ''), widget.options.content, 'paste-ready Template replacement must match the canonical form')
assert.strictEqual(fs.readFileSync(ON_CREATED_REPLACEMENT, 'utf8').replace(/\n$/, ''), widget.options.onCreated, 'paste-ready onCreated replacement must match the canonical form')
assert.strictEqual(fs.readFileSync(CSS_FULL_REPLACEMENT, 'utf8').replace(/\n$/, ''), form.formConfig.cssCode, 'paste-ready full CSS replacement must match the canonical form')
assert.match(widget.options.onCreated, /s\.reportReady\(\) \? 'เปิดรายงานผล PDF'/, 'report tooltip must describe the ready PDF state instead of claiming that the report is missing')
assert.match(form.formConfig.cssCode, /\.lab-rh\{[^}]*height:min\(820px,calc\(100vh - 100px\)\);min-height:0;/, 'popup root must reserve room for the Element Plus dialog chrome')
assert.doesNotMatch(form.formConfig.cssCode, /display:grid;min-height:min\(820px,calc\(100vh - 48px\)\)/, 'popup root must not grow past the viewport from table min-content height')
assert.match(form.formConfig.cssCode, /\.el-overlay-dialog:has\(\.lab-emr-result-history-popup-form\)\{[^}]*overflow:hidden!important/, 'LAB popup overlay must suppress the redundant outer vertical scrollbar')
assert.match(form.formConfig.cssCode, /\.el-dialog:has\(\.lab-emr-result-history-popup-form\)\{[^}]*margin:0 auto!important/, 'LAB popup dialog must not retain the default 15vh top and 50px bottom margins')
assert.doesNotMatch(form.formConfig.cssCode, /@media\(max-width:620px\)\{\.lab-rh\{[^}]*min-height:calc\(100vh - 24px\)/, 'mobile CSS must not restore the oversized minimum height')
assert.match(widget.options.content, /v-if="attachmentCount\(\)" class="lab-rh__attachments"/, 'popup must show the shared attachment section only when valid files exist')
assert.match(widget.options.content, /target="_blank" rel="noopener noreferrer"/, 'attachment links must open without granting an opener handle')
assert.match(widget.options.onCreated, /\^\(https\?:\\\/\\\/\|\\\/\)/, 'attachment URL helper must reject executable or unknown URL schemes')
assert.match(form.formConfig.cssCode, /\.lab-rh__attachments\{[^}]*border:1px/, 'attachment section must use the bordered treatment')
assert.doesNotMatch(form.formConfig.cssCode, /\.lab-rh__attachments\{[^}]*box-shadow/, 'attachment section must not add a shadow')

const history = Array.from({ length: 10 }, (_, index) => ({
  value: String(100 + index),
  visit_vn: `VN-${String(10 - index).padStart(2, '0')}`,
  lab_no: `LAB-${String(10 - index).padStart(2, '0')}`,
  status: 'final',
  entered_at: `2026-${String(10 - index).padStart(2, '0')}-01 09:00:00`,
}))

const standardOrder = {
  source_order_id: 'ORDER-BC',
  section_code: 'BC',
  section: 'Biochemistry',
  patient_hn: 'HN-001',
  patient_name: 'ผู้ป่วยทดสอบ',
  lab_no: 'LAB-CURRENT',
  specimen_name: 'Clotted blood',
  result_report_ids: ['0123456789abcdef01234567'],
  order_comment: 'งดอาหารก่อนตรวจ 8 ชั่วโมง',
  reported_at: '2026-10-20 12:52:00',
  attachments: [
    { name: 'lab-result.pdf', url: 'https://files.example.test/lab-result.pdf', size: 15360, uid: 'ATT-1' },
    { name: 'unsafe.html', url: 'javascript:alert(1)', size: 80, uid: 'ATT-2' },
  ],
  items: [{
    group_id: 'ITEM-BUN',
    group_name: 'BUN',
    name: 'BUN',
    code: 'BUN',
    value: '25.00',
    unit: 'mg/dL',
    ref: '5-18',
    flag: 'H',
    result_status: 'final',
    result_comment: 'Comment ระดับ Test',
    previous_values: history,
    visibility: { state: 'visible', item_id: 'ITEM-BUN', source_order_id: 'ORDER-BC' },
  }],
}

const boot = ({ params = {}, formParams = {}, response, onCall }) => {
  const state = {}
  const calls = []
  let closeCalls = 0
  const api = {
    user: { username: 'doctor.test' },
    runProcess(processId, payload, success, failure) {
      calls.push({ processId, payload })
      try {
        const value = onCall ? onCall(processId, payload) : response
        success(value)
      } catch (error) {
        failure(error)
      }
    },
  }
  const context = {
    vueState: state,
    params,
    getFormRef: () => ({ userState: api, closePopup() { closeCalls += 1 }, subFormClose() {} }),
    globalUserState: null,
    notify() {},
  }
  new Function('formParams', widget.options.onCreated).call(context, formParams)
  assert.strictEqual(calls.length, 0, 'onCreated must only initialize state and must not call the LAB API')
  new Function('setTimeout', widget.options.onMounted).call(context, callback => callback())
  return { state, calls, closeCalls: () => closeCalls }
}

const createdWithoutParent = { vueState: {}, params: {}, notify() {} }
assert.doesNotThrow(() => new Function(widget.options.onCreated).call(createdWithoutParent), 'onCreated must tolerate a parent Form that is not ready yet')
assert.strictEqual(typeof createdWithoutParent.vueState.load, 'function')

let connectorChecks = 0
let delayedCalls = 0
const delayedApi = {
  user: { username: 'doctor.test' },
  runProcess(processId, payload, success) {
    delayedCalls += 1
    success({ success: true, current_vn: 'VN-DELAYED', lab_orders: [standardOrder] })
  },
}
const delayedContext = {
  vueState: {},
  params: { visit_id: 'VISIT-DELAYED', source_order_id: 'ORDER-BC', section_code: 'BC' },
  getFormRef() {
    connectorChecks += 1
    return connectorChecks < 3 ? undefined : { userState: delayedApi, closePopup() {}, subFormClose() {} }
  },
  globalUserState: null,
  notify() {},
}
new Function(widget.options.onCreated).call(delayedContext)
assert.strictEqual(connectorChecks, 0, 'onCreated must not probe the parent Form')
new Function('setTimeout', widget.options.onMounted).call(delayedContext, callback => callback())
assert.strictEqual(connectorChecks, 5, 'mounted loader must retry until both the Form and API are available, then reuse it for username and LAB load')
assert.strictEqual(delayedCalls, 1, 'delayed connector must trigger exactly one LAB API load')

const missing = boot({ params: {}, response: {} })
assert.strictEqual(missing.calls.length, 0, 'form must not query without visit_id')
assert.match(missing.state.error, /visit_id/)
assert.strictEqual(missing.state.currentOrder, null)

const standard = boot({
  params: { visit_id: 'VISIT-1', source_order_id: 'ORDER-BC', section_code: 'BC' },
  response: {
    success: true,
    current_vn: 'VN-CURRENT',
    lab_orders: [
      { ...standardOrder, source_order_id: 'OTHER-ORDER' },
      standardOrder,
    ],
  },
})
assert.deepStrictEqual(standard.calls[0], {
  processId: PROCESS_ID,
  payload: { visit_id: 'VISIT-1', history_limit: 10 },
})
assert.strictEqual(standard.state.currentOrder.source_order_id, 'ORDER-BC')
assert.strictEqual(standard.state.orderComment(), 'งดอาหารก่อนตรวจ 8 ชั่วโมง')
assert.strictEqual(standard.state.visibleVisits().length, 5)
standard.state.setHistoryCount(10)
assert.strictEqual(standard.state.visibleVisits().length, 10)
assert.strictEqual(standard.state.rows()[0].note, 'Comment ระดับ Test')
assert.strictEqual(standard.state.rows()[0].current, '25.00')
assert.strictEqual(standard.state.reportReady(), true)
assert.deepStrictEqual(standard.state.reportParams(), { xparentx: '0123456789abcdef01234567' })
assert.strictEqual(standard.state.attachmentCount(), 1, 'popup must exclude unsafe attachment URLs')
assert.strictEqual(standard.state.attachments()[0].name, 'lab-result.pdf')
assert.strictEqual(standard.state.attachmentType(standard.state.attachments()[0]), 'PDF')
assert.strictEqual(standard.state.attachmentSize(standard.state.attachments()[0]), '15 KB')
standard.state.closeForm()
assert.strictEqual(standard.closeCalls(), 1, 'custom close buttons must close the current popup')

const inheritedParams = boot({
  params: { visit_id: 'STALE-VISIT' },
  formParams: { visit_id: 'VISIT-1', source_order_id: 'ORDER-BC', section_code: 'BC', lab_no: 'LAB-CURRENT' },
  response: { success: true, current_vn: 'VN-CURRENT', lab_orders: [standardOrder] },
})
assert.deepStrictEqual(inheritedParams.calls[0].payload, { visit_id: 'VISIT-1', history_limit: 10 }, 'popup must prefer openForm formParams over widget-local params')
assert.strictEqual(inheritedParams.state.currentOrder.source_order_id, 'ORDER-BC', 'popup must resolve the exact Order from formParams')

const sparseHistory = history.slice(0, 2)
const sparse = boot({
  params: { visit_id: 'VISIT-SPARSE', source_order_id: 'ORDER-BC', section_code: 'BC' },
  response: {
    success: true,
    current_vn: 'VN-CURRENT',
    lab_orders: [{ ...standardOrder, items: [{ ...standardOrder.items[0], previous_values: sparseHistory }] }],
  },
})
assert.strictEqual(sparse.state.allVisits().length, 2, 'actual history must remain distinct from empty display slots')
assert.strictEqual(sparse.state.visibleVisits().length, 5, 'default selection must always render five history columns')
assert.strictEqual(sparse.state.visibleVisits()[0].vn, sparseHistory[0].visit_vn, 'real history must remain first')
assert.strictEqual(sparse.state.visibleVisits()[2].placeholder, true, 'missing history must be represented by a placeholder column')
assert.strictEqual(sparse.state.visibleVisits()[2].entered_at, 'ยังไม่มีผล')
sparse.state.setHistoryCount(1)
assert.strictEqual(sparse.state.visibleVisits().length, 1, 'one-history selection must render exactly one column')
sparse.state.setHistoryCount(10)
assert.strictEqual(sparse.state.visibleVisits().length, 10, 'ten-history selection must render exactly ten columns')
assert.strictEqual(sparse.state.visibleVisits().filter(item => item.placeholder).length, 8, 'ten-history selection must pad all missing columns')

let reportClicks = 0
const originalDocument = globalThis.document
globalThis.document = {
  getElementById(id) {
    assert.strictEqual(id, 'lab-rh-result-report-host')
    return { querySelector: () => ({ click() { reportClicks += 1 } }) }
  },
}
standard.state.openReport()
globalThis.document = originalDocument
assert.strictEqual(reportClicks, 1, 'report button must forward to the bound Result Report')

for (const [sectionCode, expectedName] of [
  ['HM', 'Hematology'],
  ['ML', 'Clinical Microscopy Laboratory'],
  ['HH', 'Hematology-Homeostasis'],
  ['BB', 'Blood Bank'],
  ['BG', 'Biomolecular and Genetics'],
]) {
  const room = boot({
    params: { visit_id: `VISIT-${sectionCode}`, source_order_id: `ORDER-${sectionCode}`, section_code: sectionCode },
    response: { success: true, current_vn: `VN-${sectionCode}`, lab_orders: [{ ...standardOrder, source_order_id: `ORDER-${sectionCode}`, section_code: sectionCode }] },
  })
  assert.match(room.state.room().label, new RegExp(expectedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.strictEqual(room.state.isMlab(), false)
  assert.strictEqual(room.state.hasSiteColumn(), false)
}

const ambiguous = boot({
  params: { visit_id: 'VISIT-AMBIGUOUS', section_code: 'BC' },
  response: {
    success: true,
    current_vn: 'VN-CURRENT',
    lab_orders: [
      standardOrder,
      { ...standardOrder, source_order_id: 'ORDER-BC-2', lab_no: 'LAB-CURRENT-2' },
    ],
  },
})
assert.strictEqual(ambiguous.state.currentOrder, null, 'form must fail closed when EMR does not identify one exact Order')
assert.match(ambiguous.state.error, /ไม่พบรายการ LAB ที่ตรง/)

const my = boot({
  params: { visit_id: 'VISIT-MY', source_order_id: 'ORDER-MY', section_code: 'MY' },
  response: {
    success: true,
    current_vn: 'VN-MY',
    lab_orders: [{
      ...standardOrder,
      source_order_id: 'ORDER-MY',
      section_code: 'MY',
      items: [
        { ...standardOrder.items[0], group_id: 'MY-1', group_name: 'Wood light', test_name: 'Wood light', name: 'ช่องท้อง · Specimen Skin', value: 'พบเชื้อ', actual_site_name: 'ช่องท้อง', actual_site_detail: 'ด้านซ้าย' },
        { ...standardOrder.items[0], group_id: 'MY-1', group_name: 'Wood light', test_name: 'Wood light', name: 'หลัง · Specimen Skin', value: 'ไม่พบเชื้อ', actual_site_name: 'หลัง', actual_site_detail: '' },
      ],
    }],
  },
})
assert.strictEqual(my.state.hasSiteColumn(), true)
assert.strictEqual(my.state.rows()[0].group, true, 'MY must render one Test header')
assert.strictEqual(my.state.rows()[1].site, 'ช่องท้อง (ด้านซ้าย)')
assert.strictEqual(my.state.rows()[2].site, 'หลัง')

const mb = boot({
  params: { visit_id: 'VISIT-MB', source_order_id: 'ORDER-MB', section_code: 'MB' },
  response: {
    success: true,
    current_vn: 'VN-MB',
    lab_orders: [{
      ...standardOrder,
      source_order_id: 'ORDER-MB',
      section_code: 'MB',
      items: [{ ...standardOrder.items[0], group_name: 'Aerobic culture', name: 'Aerobic culture', value: 'SPECIMEN: BF\nNo growth after 5 days' }],
    }],
  },
})
assert.strictEqual(mb.state.isMlab(), true)
assert.match(mb.state.mlab().rawText, /No growth after 5 days/)
mb.state.setMlabHistoryCount(10)
assert.strictEqual(mb.state.visibleMlabHistory().length, 10)

let sensitiveOpened = false
const sensitive = boot({
  params: { visit_id: 'VISIT-IM', source_order_id: 'ORDER-IM', section_code: 'IM' },
  onCall(processId, payload) {
    assert.strictEqual(processId, PROCESS_ID)
    if (payload.action === 'open_sensitive') {
      sensitiveOpened = true
      assert.strictEqual(payload.item_id, 'ITEM-HIV')
      assert.strictEqual(payload.password, 'secret')
      return {
        success: true,
        item_ids: ['ITEM-HIV'],
        items: [{ ...standardOrder.items[0], group_id: 'ITEM-HIV', name: 'HIV Ag/Ab', value: 'Negative', visibility: { state: 'visible', item_id: 'ITEM-HIV', source_order_id: 'ORDER-IM' } }],
      }
    }
    return {
      success: true,
      current_vn: 'VN-IM',
      lab_orders: [{
        ...standardOrder,
        source_order_id: 'ORDER-IM',
        section_code: 'IM',
        items: [{ group_id: 'ITEM-HIV', group_name: 'HIV Ag/Ab', name: 'HIV Ag/Ab', result_status: 'final', visibility: { state: 'reauth_required', item_id: 'ITEM-HIV', source_order_id: 'ORDER-IM' } }],
      }],
    }
  },
})
const lockedRow = sensitive.state.rows()[0]
assert.strictEqual(lockedRow.locked, true)
sensitive.state.openSensitive(lockedRow)
sensitive.state.setSensitivePassword('secret')
sensitive.state.setSensitivePurpose('ดูแลรักษาผู้ป่วย')
sensitive.state.submitSensitive()
assert.strictEqual(sensitiveOpened, true)
assert.strictEqual(sensitive.state.rows()[0].locked, false)
assert.strictEqual(sensitive.state.rows()[0].current, 'Negative')

const miOut = boot({
  params: { visit_id: 'VISIT-MI-OUT', source_order_id: 'ORDER-MI-OUT', section_code: 'MI-OUT' },
  response: {
    success: true,
    current_vn: 'VN-MI-OUT',
    lab_orders: [{
      ...standardOrder,
      source_order_id: 'ORDER-MI-OUT',
      section_code: 'MI-OUT',
      items: [{ group_id: 'ITEM-SENSITIVE-OUT', name: 'ผลตรวจส่งนอก', result_status: 'final', visibility: { state: 'reauth_required', sensitive: true, item_id: 'ITEM-SENSITIVE-OUT', source_order_id: 'ORDER-MI-OUT' } }],
    }],
  },
})
assert.match(miOut.state.room().label, /Immunology ส่งนอกรพ\./)
assert.match(miOut.state.subtitle(), /Sensitive/)
assert.strictEqual(miOut.state.rows()[0].locked, true)

console.log('ok - LAB EMR result form is API-bound with table, MLab, MY and Sensitive contracts')
