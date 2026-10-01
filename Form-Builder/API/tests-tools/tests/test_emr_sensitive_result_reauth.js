#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../../../..')
const PROCESS = path.join(ROOT, 'Form-Builder/API/api-factory/processes/emr-lab-board-get.js')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

const VISIT_ID = '111111111111111111111111'
const ORDER_ID = '222222222222222222222222'
const ITEM_ID = '333333333333333333333333'
const MASTER_ID = '444444444444444444444444'
const USER_ID = '555555555555555555555555'
const RESULT_ID = '666666666666666666666666'

const source = fs.readFileSync(PROCESS, 'utf8')
const runProcess = new AsyncFunction('params', 'userInfo', 'app', source)

const buildHarness = ({ passwordOk = true, auditOk = true, roles = ['DOCTOR'], username = 'doctor.test', accountXrstatx, viewerUsername = 'lab.viewer', viewerRoles = ['LAB'], blockedAt = null, scopeMatch = true } = {}) => {
	const logs = []
	const grants = []
	const queries = []
	const item = {
		_id: ITEM_ID,
		item_data_id: MASTER_ID,
		item_code: 'IM2',
		item_name: 'HIV Ag/Ab',
		service_type: { value: 'lab' },
		order_id: { value: ORDER_ID, xtbxlv2_xfx_id: VISIT_ID },
		xrstatx: 1,
	}
	const dataFor = request => {
		const { collection } = request.nosql
		queries.push({ collection, query: request.nosql.query })
		if (collection === 'zdata_visit') return [{ _id: VISIT_ID, vn: 'VN-001', visit_date: '2026-09-25 08:00:00', pid: { hn: 'HN-001', value: 'PATIENT-1' } }]
		if (collection === 'zdata_cpoe_order_item') {
			if (!scopeMatch && request.nosql.query['order_id.xtbxlv2_xfx_id']) return []
			return [item]
		}
		if (collection === 'zdata_lab_work_item') return [{ _id: ITEM_ID, section_code: 'IM', xrstatx: 1 }]
		if (collection === 'zdata_master_item_order') return [{ _id: MASTER_ID, item_code: 'IM2', item_name: 'HIV Ag/Ab', is_hide_result: true, updated_at: '2026-09-25 08:00:00', xrstatx: 1 }]
		if (collection === 'zdata_emr_sensitive_access_grant') {
			const query = request.nosql.query || {}
			return grants.filter(grant =>
				(!query.grant_token || grant.grant_token === query.grant_token) &&
				(!query.viewer_username || grant.viewer_username === query.viewer_username) &&
				(!query.source_order_id || grant.source_order_id === query.source_order_id) &&
				(!query.expires_at_epoch || Number(grant.expires_at_epoch) >= Number(query.expires_at_epoch.$gte || 0)) &&
				grant.xrstatx === 1
			)
		}
		if (collection === 'core_user') {
			assert.deepStrictEqual(request.nosql.query.xrstatx, { $nin: [0, 3] }, 'auth lookup must accept legacy accounts without xrstatx')
			if ([0, 3].includes(accountXrstatx)) return []
			return [{ _id: USER_ID, username, password_hash: 'bcrypt-hash', roles, blocked_at: blockedAt, ...(accountXrstatx == null ? {} : { xrstatx: accountXrstatx }) }]
		}
		if (collection === 'zdata_lab_result_item') return [{
			_id: RESULT_ID,
			result_uid: 'result-revision-1',
			hn: 'HN-001',
			visit_id: 'VN-001',
			lab_section: 'IM',
			order_no: ITEM_ID,
			obs_name: 'HIV Ag/Ab',
			obs_code: 'IM2-R',
			result_value: 'REACTIVE-SECRET',
			result_comment: 'secret-comment',
			units: '',
			ref_range: 'Non-reactive',
			interpretation_code: 'A',
			is_critical: false,
			result_status: 'final',
			result_report_id: '777777777777777777777777',
			entered_at: '2026-09-25 09:00:00',
			reported_at: '2026-09-25 09:00:00',
			reported_by_source_name: 'Lab Reporter',
		}]
		return []
	}
	const app = {
		dbObjectId: value => value,
		dbFindAll: async request => ({ success: true, reply: { data: dataFor(request) } }),
		dbInsert: async (data, collection) => {
			if (collection === 'zdata_emr_sensitive_access_log') {
				logs.push(data)
				return { success: auditOk }
			}
			assert.strictEqual(collection, 'zdata_emr_sensitive_access_grant')
			grants.push(data)
			return { success: true }
		},
		curDate: () => '2026-09-25 09:01:00',
	}
	const context = {
		compareHash: async (hash, plain) => {
			assert.strictEqual(hash, 'bcrypt-hash')
			assert.strictEqual(plain, 'correct-password')
			return passwordOk
		},
	}
	const userInfo = { username: viewerUsername, roles: viewerRoles, account: { id: 'viewer-user-id' }, site: { code: 'SITE' }, unit: { code: 'OPD' } }
	return { app, context, userInfo, logs, grants, queries }
}

const baseParams = {
	action: 'open_sensitive',
	visit_id: VISIT_ID,
	hn: 'FORGED-HN-MUST-BE-IGNORED',
	source_order_id: ORDER_ID,
	item_id: ITEM_ID,
	username: 'doctor.test',
	password: 'correct-password',
	purpose: 'ดูแลรักษาผู้ป่วย',
	request_id: 'req-sensitive-001',
	screen: 'treat_summary',
}

const execute = async (harness, params = baseParams) => runProcess.call(harness.context, params, harness.userInfo, harness.app)

;(async () => {
	const successHarness = buildHarness()
	const opened = await execute(successHarness)
	assert.strictEqual(opened.success, true)
	assert.strictEqual(opened.action, 'open_sensitive')
	assert.strictEqual(opened.items.length, 1)
	assert.strictEqual(opened.items[0].value, 'REACTIVE-SECRET')
	assert.strictEqual(successHarness.logs[0].patient_id, 'PATIENT-1', 'patient scope must come from the server-side visit, not client HN')
	assert.strictEqual(opened.items[0].visibility.disclosed, true)
	// 2026-09-25 confirmed change: one doctor confirmation unlocks the whole sheet,
	// including the PDF surface for the current dialog session.
	assert.strictEqual(opened.items[0].result_report_id, '777777777777777777777777')
	assert.strictEqual(opened.items[0].previous, null, 'previous Sensitive result is outside this first disclosure flow')
	assert.deepStrictEqual(opened.attachments, [])
	assert.deepStrictEqual(opened.result_report_ids, ['777777777777777777777777'])
	assert(opened.sensitive_grant_token)
	assert.strictEqual(opened.section_code, 'IM', 'server must return the authoritative Work Item Section')
	assert.strictEqual(successHarness.grants.length, 1)
	assert(successHarness.grants[0].expires_at_epoch > Date.now())
	// 2026-09-28 user-confirmed policy change: Sensitive disclosure lasts five minutes.
	assert.strictEqual(successHarness.grants[0].expires_at_epoch - successHarness.grants[0].issued_at_epoch, 5 * 60 * 1000, 'grant TTL must equal five minutes')
	assert(successHarness.grants[0].expires_at_epoch <= Date.now() + (5 * 60 * 1000), 'grant TTL must be at most five minutes')
	assert.strictEqual(successHarness.grants[0].section_code, 'IM', 'PDF grant must be scoped to the authoritative Section even when the client omitted it')
	assert.strictEqual(successHarness.logs.length, 1)
	assert.strictEqual(successHarness.logs[0].outcome, 'success')
	assert.strictEqual(successHarness.logs[0].reason_code, 'reauth_success')
	assert.strictEqual(successHarness.logs[0].item_id, ITEM_ID)
	assert.strictEqual(successHarness.logs[0].patient_id, 'PATIENT-1')
	assert.strictEqual(successHarness.logs[0].revision_id, 'result-revision-1')
	assert.strictEqual(successHarness.logs[0].username, 'lab.viewer', 'viewer session must be audited separately')
	assert.strictEqual(successHarness.logs[0].authorized_by_username, 'doctor.test')
	assert(successHarness.queries.some(entry => entry.collection === 'core_user'), 'legacy DOCTOR without xrstatx must reach the account lookup')
	const logWire = JSON.stringify(successHarness.logs[0])
	for (const forbidden of ['correct-password', 'bcrypt-hash', 'REACTIVE-SECRET', 'secret-comment']) {
		assert.strictEqual(logWire.includes(forbidden), false, `Access Log leaked ${forbidden}`)
	}

	const reused = await execute(successHarness, {
		action: 'reuse_sensitive',
		visit_id: VISIT_ID,
		source_order_id: ORDER_ID,
		item_id: ITEM_ID,
		section_code: 'IM',
		sensitive_grant_token: opened.sensitive_grant_token,
		request_id: 'req-sensitive-reuse-001',
		screen: 'treat_summary',
	})
	assert.strictEqual(reused.success, true)
	assert.strictEqual(reused.action, 'reuse_sensitive')
	assert.strictEqual(reused.items[0].value, 'REACTIVE-SECRET')
	assert.strictEqual(reused.sensitive_grant_token, opened.sensitive_grant_token)
	assert.strictEqual(successHarness.grants.length, 1, 'reuse must not mint another grant')
	assert.strictEqual(successHarness.logs.length, 2, 'every grant reuse must append an Access Log')
	assert.strictEqual(successHarness.logs[1].reason_code, 'grant_reuse')

	successHarness.grants[0].expires_at_epoch = Date.now() - 1
	const expired = await execute(successHarness, {
		action: 'reuse_sensitive',
		visit_id: VISIT_ID,
		source_order_id: ORDER_ID,
		item_id: ITEM_ID,
		section_code: 'IM',
		sensitive_grant_token: opened.sensitive_grant_token,
		request_id: 'req-sensitive-reuse-expired',
		screen: 'treat_summary',
	})
	assert.strictEqual(expired.success, false)
	assert.strictEqual(expired.code, 'grant_expired')
	assert.strictEqual(JSON.stringify(expired).includes('REACTIVE-SECRET'), false)

	const sectionScopeHarness = buildHarness()
	const sectionScopeOpened = await execute(sectionScopeHarness)
	sectionScopeHarness.grants[0].section_code = 'BC'
	const wrongSectionReuse = await execute(sectionScopeHarness, {
		action: 'reuse_sensitive',
		visit_id: VISIT_ID,
		source_order_id: ORDER_ID,
		item_id: ITEM_ID,
		section_code: 'IM',
		sensitive_grant_token: sectionScopeOpened.sensitive_grant_token,
		request_id: 'req-sensitive-reuse-wrong-section',
		screen: 'treat_summary',
	})
	assert.strictEqual(wrongSectionReuse.success, false)
	assert.strictEqual(wrongSectionReuse.code, 'scope_mismatch')
	assert.strictEqual(sectionScopeHarness.logs.at(-1).reason_code, 'grant_section_mismatch')
	assert.strictEqual(JSON.stringify(wrongSectionReuse).includes('REACTIVE-SECRET'), false)

	const viewerScopeHarness = buildHarness()
	const viewerScopeOpened = await execute(viewerScopeHarness)
	viewerScopeHarness.userInfo.username = 'other.viewer'
	const wrongViewerReuse = await execute(viewerScopeHarness, {
		action: 'reuse_sensitive',
		visit_id: VISIT_ID,
		source_order_id: ORDER_ID,
		item_id: ITEM_ID,
		section_code: 'IM',
		sensitive_grant_token: viewerScopeOpened.sensitive_grant_token,
		request_id: 'req-sensitive-reuse-wrong-viewer',
		screen: 'treat_summary',
	})
	assert.strictEqual(wrongViewerReuse.success, false)
	assert.strictEqual(wrongViewerReuse.code, 'grant_expired')
	assert.strictEqual(JSON.stringify(wrongViewerReuse).includes('REACTIVE-SECRET'), false)

	const badPasswordHarness = buildHarness({ passwordOk: false })
	const denied = await execute(badPasswordHarness)
	assert.strictEqual(denied.success, false)
	assert.strictEqual(denied.code, 'reauth_failed')
	assert.strictEqual(badPasswordHarness.logs.length, 1)
	assert.strictEqual(badPasswordHarness.logs[0].outcome, 'bad_credentials')
	assert.strictEqual(JSON.stringify(denied).includes('REACTIVE-SECRET'), false)

	// 2026-09-25 confirmed change: a LAB viewer may enter a different doctor's
	// credential; authorization is based on the submitted account, not viewer role.
	const forbiddenHarness = buildHarness({ roles: ['NURSE'] })
	const forbidden = await execute(forbiddenHarness)
	assert.strictEqual(forbidden.success, false)
	assert.strictEqual(forbidden.code, 'forbidden')
	assert.strictEqual(forbiddenHarness.logs[0].reason_code, 'account_not_allowed')

	const blockedHarness = buildHarness({ blockedAt: '2026-09-25 08:55:00' })
	const blocked = await execute(blockedHarness)
	assert.strictEqual(blocked.success, false)
	assert.strictEqual(blocked.code, 'forbidden')
	assert.strictEqual(blockedHarness.logs[0].reason_code, 'account_blocked')

	for (const accountXrstatx of [0, 3]) {
		const inactiveHarness = buildHarness({ accountXrstatx })
		const inactive = await execute(inactiveHarness)
		assert.strictEqual(inactive.success, false)
		assert.strictEqual(inactive.code, 'forbidden')
		assert.strictEqual(inactiveHarness.logs[0].reason_code, 'account_not_allowed')
	}

	const scopeHarness = buildHarness({ scopeMatch: false })
	const scopeDenied = await execute(scopeHarness)
	assert.strictEqual(scopeDenied.success, false)
	assert.strictEqual(scopeDenied.code, 'scope_mismatch')
	assert.strictEqual(scopeHarness.logs[0].reason_code, 'item_visit_mismatch')

	const forgedSectionHarness = buildHarness()
	const forgedSection = await execute(forgedSectionHarness, { ...baseParams, section_code: 'BC' })
	assert.strictEqual(forgedSection.success, false)
	assert.strictEqual(forgedSection.code, 'scope_mismatch')
	assert.strictEqual(forgedSectionHarness.logs[0].reason_code, 'section_item_mismatch')

	const auditFailureHarness = buildHarness({ auditOk: false })
	const auditFailure = await execute(auditFailureHarness)
	assert.strictEqual(auditFailure.success, false)
	assert.strictEqual(auditFailure.code, 'audit_failed')
	assert.strictEqual(JSON.stringify(auditFailure).includes('REACTIVE-SECRET'), false, 'result must not leave server when success audit insert fails')

	console.log('ok - Sensitive result re-auth is server-authorized and fail-closed on Access Log failure')
})().catch(error => {
	console.error(error)
	process.exit(1)
})
