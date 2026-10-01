#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../../../..')
const BOARD_ID = '6ab3be31cec3020e8562a2c9'
const VISIT_ID = '111111111111111111111111'
const ORDER_ID = '222222222222222222222222'
const ITEM_ID = '333333333333333333333333'
// 2026-09-28 user-confirmed policy change: UI reuse/expiry assertions now cover 30 seconds.
const GRANT_EXPIRES_AT = Date.now() + (5 * 60 * 1000)

const lockedRaw = {
	order_id: 'LAB-GROUP-1',
	source_order_id: ORDER_ID,
	order_no: 'R-001',
	section: 'Immunology',
	section_code: 'IM',
	status: 'completed',
	scope: 'visit',
	patient_hn: 'HN-001',
	items: [{
		name: 'HIV Ag/Ab',
		code: 'IM2',
		group_id: ITEM_ID,
		group_name: 'HIV Ag/Ab',
		visibility: { state: 'reauth_required', sensitive: true, item_id: ITEM_ID, source_order_id: ORDER_ID, visit_id: VISIT_ID },
	}],
}

const disclosedItem = {
	name: 'HIV Ag/Ab',
	code: 'IM2-R',
	group_id: ITEM_ID,
	group_name: 'HIV Ag/Ab',
	value: 'REACTIVE',
	flag: 'A',
	result_status: 'final',
	visibility: { state: 'visible', sensitive: true, disclosed: true, item_id: ITEM_ID, source_order_id: ORDER_ID, visit_id: VISIT_ID },
}

const disclosureResponse = {
	success: true,
	action: 'open_sensitive',
	item_id: ITEM_ID,
	items: [disclosedItem],
	reported_at: '2026-09-25 09:00:00',
	reported_by_source_name: 'Lab Reporter',
	attachments: [],
	item_ids: [ITEM_ID],
	result_report_ids: ['555555555555555555555555'],
	sensitive_grant_token: 'grant-token-001',
	sensitive_grant_expires_at_epoch: GRANT_EXPIRES_AT,
}

const visibleItem = {
	name: 'RPR',
	code: 'IM62',
	group_id: '444444444444444444444444',
	group_name: 'RPR',
	value: '0',
	flag: 'N',
	result_status: 'final',
	visibility: { state: 'visible', sensitive: false, item_id: '444444444444444444444444', source_order_id: ORDER_ID, visit_id: VISIT_ID },
}

const treatEvents = [
	'Form-Builder/API/form-factory/events/treat-summary-onCreated-FULL-v1.js',
	'Form-Builder/API/form-factory/events/treat-summary-lab-xray-oncreated-v1.js',
]

for (const relativePath of treatEvents) {
	const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
	const calls = []
	const form = {
		userState: {
			user: { username: 'doctor.test' },
			runProcess(processId, params, ok) {
				calls.push({ processId, params })
				assert.strictEqual(processId, BOARD_ID)
				assert(['open_sensitive', 'reuse_sensitive'].includes(params.action))
				ok({ data: { ...disclosureResponse, action: params.action } })
			},
		},
	}
	const state = relativePath.includes('FULL') ? {} : { tsLoad: () => {} }
	const component = { vueState: state, getFormRef: () => form }
	const executable = relativePath.includes('FULL') ? source : `const s=this.vueState; const field=this;\n${source}`
	new Function(executable).call(component)

	state.tsCurVisit = VISIT_ID
	const initialRaw = relativePath.includes('FULL')
		? { ...lockedRaw, result_report_ids: ['555555555555555555555555'] }
		: lockedRaw
	if (relativePath.includes('FULL')) {
		state.tsAbsorb({ current_vn: 'VN-001', lab_orders: [{ ...initialRaw, items: [visibleItem, ...initialRaw.items] }], xray_results: [], lab_trends: [] })
		const mixedOrder = state.tsLgVisit[0]
		assert.strictEqual(mixedOrder.report_ready, true, 'PDF stays available while Sensitive values are server-redacted')
		assert.strictEqual(Object.prototype.hasOwnProperty.call(mixedOrder.report_params, 'grant_token'), false)
		state.tsOpenOrder(mixedOrder)
		assert.strictEqual(state.tsLabDialog.visible, true, 'mixed order must open the full-result viewer')
		assert.strictEqual(state.tsResultTestCount(), 2, 'full-result viewer must count the locked test name')
		assert.strictEqual(state.tsResultRowsCount(), 1, 'locked placeholder must not be counted as a disclosed result row')
		assert.strictEqual(state.tsLockedResultCount(), 1)
		assert.strictEqual(mixedOrder.rows[0].flag, 'N', 'normalized flag remains available for styling and alert logic')
		assert.strictEqual(mixedOrder.rows[0].interpretation, 'N', 'the exact LAB interpretation must survive row mapping')
		assert.strictEqual(state.tsLabFlagLabel(mixedOrder.rows[0]), 'N', 'normal source interpretation must not render as a dash')
		assert.strictEqual(state.tsLabFlagLabel({ flag: 'N', interpretation: 'NEG' }), 'NEG', 'Negative interpretation must render exactly as supplied by LAB')
		assert.strictEqual(state.tsLabFlagLabel({ flag: 'N', interpretation: '' }), '-', 'missing source interpretation must stay unknown instead of being guessed as normal')
		state.tsCloseLabDialog()
	}

	state.tsAbsorb({ current_vn: 'VN-001', lab_orders: [initialRaw], xray_results: [], lab_trends: [] })
	const order = state.tsLgVisit[0]
	assert.strictEqual(order.rows.length, 0, `${relativePath} must not classify a protected placeholder as a normal result`)
	assert.strictEqual(order.locked_rows.length, 1)
	assert.strictEqual(order.abn_text, 'มีผล Sensitive')
	state.tsOpenOrder(order)
	if (relativePath.includes('FULL')) {
		assert.strictEqual(order.report_ready, true, 'locked-only sheet must still offer its redacted PDF')
		assert.strictEqual(Object.prototype.hasOwnProperty.call(order.report_params, 'grant_token'), false)
		assert.strictEqual(state.tsLabDialog.visible, true, 'locked-only order must open the full-sheet viewer with locked rows')
		assert.strictEqual(state.tsReauth.visible, false, 'opening the locked sheet must not disclose or authenticate automatically')
		state.tsRequestSensitive(order, order.locked_rows[0])
	} else {
		assert.strictEqual(state.tsLabDialog.visible, false, 'compact card must not open the value viewer before re-auth')
	}
	assert.strictEqual(state.tsReauth.visible, true)
	assert.strictEqual(state.tsReauth.username, 'doctor.test')
	state.tsReauth.password = 'correct-password'
	state.tsSubmitSensitive()
	assert.strictEqual(calls.length, 1)
	assert.strictEqual(calls[0].params.visit_id, VISIT_ID)
	assert.strictEqual(calls[0].params.source_order_id, ORDER_ID)
	assert.strictEqual(calls[0].params.item_id, ITEM_ID)
	assert.strictEqual(calls[0].params.password, 'correct-password')
	assert.strictEqual(calls[0].params.screen, 'treat_summary')
	assert.match(calls[0].params.request_id, /^emr-sensitive-/)
	assert.strictEqual(state.tsReauth.password, '', 'password must be cleared immediately after submission')
	assert.strictEqual(state.tsReauth.visible, false)
	assert.strictEqual(state.tsLabDialog.visible, true)
	assert.strictEqual(state.tsLabDialog.order.rows[0].value, 'REACTIVE')
	if (relativePath.includes('FULL')) {
		assert.strictEqual(state.tsLabDialog.order.report_ready, true, 'the report remains available after screen re-auth')
		assert.strictEqual(Object.prototype.hasOwnProperty.call(state.tsLabDialog.order.report_params, 'grant_token'), false, 'screen grant must never flow into PDF params')
		assert.strictEqual(state.tsLabDialog.order.has_sensitive, true)
		state.tsRequestSensitivePdf(state.tsLabDialog.order, 'dialog')
		assert.strictEqual(state.tsReauth.visible, true, 'Sensitive PDF must request a second authentication')
		assert.strictEqual(state.tsReauth.mode, 'pdf')
		state.tsReauth.password = 'pdf-password'
		state.tsSubmitSensitive()
		assert.strictEqual(calls.length, 2)
		assert.strictEqual(calls[1].params.screen, 'treat_summary_pdf')
		assert.strictEqual(calls[1].params.password, 'pdf-password')
		assert.strictEqual(state.tsPdfParams(state.tsLabDialog.order, 'dialog').grant_token, 'grant-token-001')
		state.tsRequestSensitivePdf(state.tsLabDialog.order, 'dialog')
		assert.strictEqual(state.tsReauth.visible, true, 'every Sensitive PDF click must authenticate again')
		assert.strictEqual(state.tsPdfGrantReady(state.tsLabDialog.order, 'dialog'), false, 'a new PDF click must discard the prior PDF grant before prompting')
		state.tsCloseReauth()
	} else {
		assert.strictEqual(state.tsLabDialog.order.report_ready, false, 'legacy compact card keeps its existing PDF behavior')
	}
	let reloads = 0
	state.tsReload = () => { reloads += 1 }
	state.tsCloseLabDialog()
	if (relativePath.includes('FULL')) {
		assert.strictEqual(reloads, 0, 'closing must redact locally without destroying the five-minute grant')
		const redactedOrder = state.tsLgVisit[0]
		assert.strictEqual(redactedOrder.rows.length, 0, 'closed card must not retain disclosed clinical values')
		assert.strictEqual(redactedOrder.locked_rows.length, 1)
		assert.strictEqual(Object.prototype.hasOwnProperty.call(redactedOrder.report_params, 'grant_token'), false, 'redacted card must not reuse the screen grant for PDF')
		state.tsOpenOrder(redactedOrder)
		assert.strictEqual(calls.length, 3, 'reopening within five minutes must validate the existing screen grant at the server')
		assert.strictEqual(calls[2].params.action, 'reuse_sensitive')
		assert.strictEqual(calls[2].params.sensitive_grant_token, 'grant-token-001')
		assert.strictEqual(Object.prototype.hasOwnProperty.call(calls[2].params, 'password'), false)
		assert.strictEqual(state.tsLabDialog.order.rows[0].value, 'REACTIVE')
		state.tsCloseLabDialog()

		// Treat Summary rebuilds card objects whenever its summary process reloads.
		// The five-minute grant must survive that rebuild, but only for the same user/visit/Order/Section.
		state.tsAbsorb({ current_vn: 'VN-001', lab_orders: [{ ...initialRaw, items: initialRaw.items.slice() }], xray_results: [], lab_trends: [] })
		const rebuiltOrder = state.tsLgVisit[0]
		assert.strictEqual(Object.prototype.hasOwnProperty.call(rebuiltOrder.report_params, 'grant_token'), false, 'rebuilt card must keep the recovered screen grant out of PDF params')
		state.tsOpenOrder(rebuiltOrder)
		assert.strictEqual(calls.length, 4, 'rebuilt card must reuse the server grant without another password')
		assert.strictEqual(calls[3].params.action, 'reuse_sensitive')
		assert.strictEqual(calls[3].params.sensitive_grant_token, 'grant-token-001')
		state.tsCloseLabDialog()
		const scopedRedactedOrder = state.tsLgVisit[0]
		form.userState.user.username = 'doctor.other'
		state.tsOpenOrder(scopedRedactedOrder)
		assert.strictEqual(calls.length, 4, 'an in-memory Order object must not reuse another user\'s grant')
		assert.strictEqual(Object.prototype.hasOwnProperty.call(state.tsLabDialog.order.report_params, 'grant_token'), false)
		state.tsCloseLabDialog()
		form.userState.user.username = 'doctor.test'

		const otherOrderId = '666666666666666666666666'
		const otherRaw = {
			...initialRaw,
			order_id: 'LAB-GROUP-2',
			source_order_id: otherOrderId,
			items: initialRaw.items.map((row) => ({
				...row,
				visibility: { ...row.visibility, source_order_id: otherOrderId },
			})),
		}
		state.tsAbsorb({ current_vn: 'VN-001', lab_orders: [otherRaw], xray_results: [], lab_trends: [] })
		assert.strictEqual(Object.prototype.hasOwnProperty.call(state.tsLgVisit[0].report_params, 'grant_token'), false, 'grant must not cross to another Order')
		state.tsAbsorb({ current_vn: 'VN-001', lab_orders: [{ ...initialRaw, section_code: 'BC', items: initialRaw.items.slice() }], xray_results: [], lab_trends: [] })
		assert.strictEqual(Object.prototype.hasOwnProperty.call(state.tsLgVisit[0].report_params, 'grant_token'), false, 'grant must not cross to another Lab Section')
		form.userState.user.username = 'doctor.other'
		state.tsAbsorb({ current_vn: 'VN-001', lab_orders: [{ ...initialRaw, items: initialRaw.items.slice() }], xray_results: [], lab_trends: [] })
		assert.strictEqual(Object.prototype.hasOwnProperty.call(state.tsLgVisit[0].report_params, 'grant_token'), false, 'grant must not cross to another user')
		form.userState.user.username = 'doctor.test'

		// initCraft may recreate the vue-ui field after closing an overlaid form.
		// Keep only the short-lived scoped grant in userState so a field remount does not force a second password.
		const remountedState = {}
		new Function(source).call({ vueState: remountedState, getFormRef: () => form })
		remountedState.tsCurVisit = VISIT_ID
		remountedState.tsAbsorb({ current_vn: 'VN-001', lab_orders: [{ ...initialRaw, items: initialRaw.items.slice() }], xray_results: [], lab_trends: [] })
		assert.strictEqual(Object.prototype.hasOwnProperty.call(remountedState.tsLgVisit[0].report_params, 'grant_token'), false, 'remounted field must keep its screen grant out of PDF params')
		remountedState.tsOpenOrder(remountedState.tsLgVisit[0])
		assert.strictEqual(calls.length, 5, 'remounted field must reuse the server grant without another password')
		assert.strictEqual(calls[4].params.action, 'reuse_sensitive')
		remountedState.tsCloseLabDialog()
	} else {
		assert.strictEqual(reloads, 1, 'legacy compact artifact keeps its existing close behavior')
	}
}

const historySource = fs.readFileSync(path.join(ROOT, 'Form-Builder/API/form-factory/events/emr-history-onCreated-FULL-v1.js'), 'utf8')
const historyCalls = []
const historyForm = {
	formParams: { visit_id: VISIT_ID },
	userState: {
		user: { username: 'doctor.test' },
		runProcess(processId, params, ok) {
			historyCalls.push({ processId, params })
			assert.strictEqual(processId, BOARD_ID)
			if (params.action === 'open_sensitive' || params.action === 'reuse_sensitive') ok({ data: { ...disclosureResponse, action: params.action } })
			else ok({ data: { success: true, lab_orders: [{ ...lockedRaw, result_report_ids: ['555555555555555555555555'] }] } })
		},
	},
}
const historyState = {}
const historyComponent = { vueState: historyState, formParams: historyForm.formParams, getFormRef: () => historyForm }
new Function(historySource).call(historyComponent)
assert.strictEqual(historyState.ehLabFlagLabel({ flag: 'N', interpretation: 'N' }), 'N', 'History must show the normal source interpretation')
assert.strictEqual(historyState.ehLabFlagLabel({ flag: 'N', interpretation: 'NEG' }), 'NEG', 'History must show the Negative source interpretation')
assert.strictEqual(historyState.ehLabFlagLabel({ flag: 'N', interpretation: '' }), '-', 'History must not infer normal when the source interpretation is blank')
historyState.ehVisit = { visit_id: VISIT_ID, hn: 'HN-001' }
historyState.ehLabLoad(historyState.ehVisit)
const historyOrder = historyState.ehLabOrders[0]
assert.strictEqual(historyOrder.rows.length, 0)
assert.strictEqual(historyOrder.locked_rows.length, 1)
assert.strictEqual(historyOrder.report_ready, true, 'History PDF remains available in redacted mode')
assert.strictEqual(Object.prototype.hasOwnProperty.call(historyOrder.report_params, 'grant_token'), false)
const historyLockedReportKey = historyState.ehLabReportInstanceKey(historyOrder, 'dialog')
historyState.ehLabOpenOrder(historyOrder)
assert.strictEqual(historyState.ehLabDialog.visible, true, 'history must show the full sheet with locked rows before re-auth')
assert.strictEqual(historyState.ehLabReauth.visible, false)
historyState.ehLabRequestSensitive(historyOrder, historyOrder.locked_rows[0])
assert.strictEqual(historyState.ehLabReauth.visible, true)
historyState.ehLabReauth.password = 'correct-password'
historyState.ehLabSubmitSensitive()
assert.strictEqual(historyCalls.length, 2)
assert.strictEqual(historyCalls[1].params.action, 'open_sensitive')
assert.strictEqual(historyCalls[1].params.screen, 'emr_history')
assert.strictEqual(historyState.ehLabReauth.password, '')
assert.strictEqual(historyState.ehLabDialog.order.rows[0].value, 'REACTIVE')
assert.strictEqual(historyState.ehLabDialog.order.report_ready, true)
assert.strictEqual(Object.prototype.hasOwnProperty.call(historyState.ehLabDialog.order.report_params, 'grant_token'), false, 'History screen grant must not flow into PDF params')
const historyUnlockedReportKey = historyState.ehLabReportInstanceKey(historyState.ehLabDialog.order, 'dialog')
assert.strictEqual(historyUnlockedReportKey, historyLockedReportKey, 'screen disclosure must not remount the redacted report with a screen grant')
assert.notStrictEqual(
	historyUnlockedReportKey,
	historyState.ehLabReportInstanceKey({ ...historyState.ehLabDialog.order, source_order_id: 'different-order' }, 'dialog'),
	'different Orders must never share one report component instance',
)
historyState.ehLabRequestSensitivePdf(historyState.ehLabDialog.order, 'dialog')
assert.strictEqual(historyState.ehLabReauth.visible, true)
assert.strictEqual(historyState.ehLabReauth.mode, 'pdf')
historyState.ehLabReauth.password = 'pdf-password'
historyState.ehLabSubmitSensitive()
assert.strictEqual(historyCalls.length, 3)
assert.strictEqual(historyCalls[2].params.screen, 'emr_history_pdf')
assert.strictEqual(historyCalls[2].params.password, 'pdf-password')
assert.strictEqual(historyState.ehLabPdfParams(historyState.ehLabDialog.order, 'dialog').grant_token, 'grant-token-001')
historyState.ehLabRequestSensitivePdf(historyState.ehLabDialog.order, 'dialog')
assert.strictEqual(historyState.ehLabReauth.visible, true, 'History must re-auth on every Sensitive PDF click')
assert.strictEqual(historyState.ehLabPdfGrantReady(historyState.ehLabDialog.order, 'dialog'), false)
historyState.ehLabCloseReauth()
let historyReloads = 0
historyState.ehLabReload = () => { historyReloads += 1 }
historyState.ehLabCloseLabDialog()
assert.strictEqual(historyReloads, 0, 'History close must redact locally and preserve only the five-minute grant')
const historyRedactedOrder = historyState.ehLabOrders[0]
assert.strictEqual(historyRedactedOrder.rows.length, 0)
assert.strictEqual(historyRedactedOrder.locked_rows.length, 1)
assert.strictEqual(Object.prototype.hasOwnProperty.call(historyRedactedOrder.report_params, 'grant_token'), false)
historyState.ehLabOpenOrder(historyRedactedOrder)
assert.strictEqual(historyCalls.length, 4)
assert.strictEqual(historyCalls[3].params.action, 'reuse_sensitive')
assert.strictEqual(historyCalls[3].params.sensitive_grant_token, 'grant-token-001')
assert.strictEqual(historyState.ehLabDialog.order.rows[0].value, 'REACTIVE')
historyState.ehLabCloseLabDialog()

for (const relativePath of [
	'02-his/form-factory/treat-summary-template-FULL-v1.html',
	'02-his/form-factory/treat-summary-lab-xray-template-v1.html',
	'02-his/form-factory/emr-history-template-FULL-v1.html',
]) {
	const template = fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
	assert.match(template, /Sensitive — ต้องยืนยันตัวตนก่อนดูผล/)
	assert.match(template, /ยืนยันตัวตนเพื่อดูผล Sensitive/)
	assert.match(template, /บันทึก Access Log ทุกครั้ง/)
	assert.match(template, /autocomplete="current-password"/)
	if (relativePath.includes('FULL')) {
		assert.match(template, /class="lab-sensitive-locked-list"/)
		assert.match(template, /ปิดบังค่าผลจนกว่าจะยืนยันตัวตน/)
		assert.doesNotMatch(template, /ยังไม่รวม PDF\/ไฟล์แนบ/)
	} else {
		assert.match(template, /ยังไม่รวม PDF\/ไฟล์แนบ/)
	}
}

const historyTemplate = fs.readFileSync(path.join(ROOT, '02-his/form-factory/emr-history-template-FULL-v1.html'), 'utf8')
assert(historyTemplate.includes(`:key="ehLabReportInstanceKey(o, 'card')"`), 'History card report must remount per Order/grant')
assert(historyTemplate.includes(`:key="ehLabReportInstanceKey(ehLabDialog.order, 'dialog')"`), 'History dialog report must remount after re-auth')
const treatTemplate = fs.readFileSync(path.join(ROOT, '02-his/form-factory/treat-summary-template-FULL-v1.html'), 'utf8')
assert(treatTemplate.includes(`:key="tsReportInstanceKey(o, 'card')"`), 'Treat Summary card report must remount per Order/grant')
assert(treatTemplate.includes(`:key="tsReportInstanceKey(tsLabDialog.order, 'dialog')"`), 'Treat Summary dialog report must remount after re-auth')
assert.match(treatTemplate, /ใช้ได้ 5 นาทีเฉพาะผู้ใช้ ใบสั่ง และห้อง Lab เดิม/)
assert.match(treatTemplate, /PDF ที่มีผล Sensitive ต้องยืนยันใหม่ทุกครั้ง/)
assert.match(treatTemplate, /tsRequestSensitivePdf\(tsLabDialog\.order, 'dialog'\)/)
assert.match(historyTemplate, /PDF ที่มีผล Sensitive ต้องยืนยันใหม่ทุกครั้ง/)
assert.match(historyTemplate, /ehLabRequestSensitivePdf\(ehLabDialog\.order, 'dialog'\)/)
assert.match(historyTemplate, /ehLabFlagLabel\(r\)/, 'History full sheet must pass the result row so the source interpretation is available')
assert.match(treatTemplate, /tsLabFlagLabel\(r\)/, 'Treat Summary full sheet must pass the result row so the source interpretation is available')

for (const [name, template] of [['History', historyTemplate], ['Treat Summary', treatTemplate]]) {
	assert.match(template, />PDF<\/el-button>/, `${name} must show a single, explicit PDF action label`)
	assert.match(template, /style="display:none"><sd-report/, `${name} protected report host must never become a second visible button`)
	assert.doesNotMatch(template, /position:absolute;left:-9999px[^>]*><sd-report/, `${name} must not rely on an off-screen visible report action`)
	assert.doesNotMatch(template, /<\/span>\s*<el-button v-else class="lab-result-report-action"/, `${name} disabled fallback must not bind v-else to the protected report host`)
}

for (const [name, source] of [['History', historySource], ['Treat Summary', fs.readFileSync(path.join(ROOT, 'Form-Builder/API/form-factory/events/treat-summary-onCreated-FULL-v1.js'), 'utf8')]]) {
	assert.match(source, /label: 'PDF', type: 'pdf'/, `${name} SdReport action must also be labelled PDF`)
	assert.match(source, /globalThis\.document/, `${name} must use the unshadowed browser document in initCraft compileFn`)
	assert.match(source, /Number\(attempt \|\| 0\) < 20/, `${name} must wait for Vue to mount the authorized report component`)
	assert.doesNotMatch(source, /กรุณากดรายงานผลอีกครั้ง/, `${name} must open the PDF in the same authenticated action`)
}

console.log('ok - EMR Treat Summary and History complete the locked-result re-auth UI flow')
