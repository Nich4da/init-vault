#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../../..');
const source = fs.readFileSync(path.join(ROOT, 'Form-Builder/API/api-factory/processes/emr-xray-history-get.js'), 'utf8');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const run = new AsyncFunction('params', 'app', 'userInfo', source);

const ids = {
	visit: 'aaaaaaaaaaaaaaaaaaaaaaaa',
	order: 'bbbbbbbbbbbbbbbbbbbbbbbb',
	item1: 'cccccccccccccccccccccccc',
	item2: 'dddddddddddddddddddddddd',
	master1: '111111111111111111111111',
	master2: '222222222222222222222222',
	section: '333333333333333333333333',
};

const collections = {
	zdata_visit: [{ _id: ids.visit, xrstatx: 1, vn: 'VN-CURRENT', pid: { hn: 'HN-01' } }],
	zdata_cpoe_order: [{ _id: ids.order, xrstatx: 1, xparentx: ids.visit, order_number: 'XR-ORDER-01', created_at: '2026-10-19 08:00:00', cosign_user: { label: 'Doctor A' } }],
	zdata_cpoe_order_item: [
		{ _id: ids.item1, xrstatx: 1, order_id: { value: ids.order }, service_type: { value: 'xray' }, item_data_id: ids.master1, item_code: 'RD101', item_name: 'Chest PA', accession_no: 'ACC-CURRENT', current_status: 'completed', section_snapshot: { value: ids.section } },
		{ _id: ids.item2, xrstatx: 1, order_id: { value: ids.order }, service_type: { value: 'xray' }, item_data_id: ids.master2, item_code: 'RD052', item_name: 'Skull AP', accession_no: 'ACC-SKULL', current_status: 'completed', section_snapshot: { value: ids.section } },
	],
	zdata_master_item_order: [
		{ _id: ids.master1, xrstatx: 1, item_name: 'Chest PA', xray_item: { modality: { value: 'DX', label: 'General X-ray' } } },
		{ _id: ids.master2, xrstatx: 1, item_name: 'Skull AP', xray_item: { modality: { value: 'DX', label: 'General X-ray' } } },
	],
	zdata_section: [{ _id: ids.section, xrstatx: 1, code: 'RA-11', name_th: 'ห้องเอกซเรย์' }],
	zdata_xray_order: [
		{ _id: 'o0', xrstatx: 1, Hn: 'HN-01', VisitNo: 'VN-CURRENT', AccessionNo: 'ACC-CURRENT', ExamUid: 'RD101', ExamName: 'Chest PA', ModalityTypeUid: 'DX', created_at: '2026-10-19 08:10:00' },
		{ _id: 'o1', xrstatx: 1, Hn: 'HN-01', VisitNo: 'VN-CURRENT', AccessionNo: 'ACC-SKULL', ExamUid: 'RD052', ExamName: 'Skull AP', ModalityTypeUid: 'DX', created_at: '2026-10-19 08:11:00' },
		...Array.from({ length: 12 }, (_, index) => ({ _id: 'h' + index, xrstatx: 1, Hn: 'HN-01', VisitNo: 'VN-OLD-' + index, AccessionNo: 'ACC-H-' + index, ExamUid: 'RD101', ExamName: 'Chest PA', created_at: '2026-10-' + String(22 - index).padStart(2, '0') + ' 08:00:00' })),
		{ _id: 'wrong-code', xrstatx: 1, Hn: 'HN-01', VisitNo: 'VN-WRONG', AccessionNo: 'ACC-WRONG-CODE', ExamUid: 'RD999', ExamName: 'Chest PA', created_at: '2026-10-18 09:00:00' },
		{ _id: 'wrong-hn', xrstatx: 1, Hn: 'HN-02', VisitNo: 'VN-WRONG-HN', AccessionNo: 'ACC-WRONG-HN', ExamUid: 'RD101', ExamName: 'Chest PA', created_at: '2026-10-18 10:00:00' },
	],
	zdata_xray_result: [
		{ _id: 'r0', xrstatx: 1, Hn: 'HN-01', AccessionNo: 'ACC-CURRENT', ExamName: 'Chest PA', ResultText: 'Current chest result', ResultDateTime: '2026-10-19 09:00:00', Status: 'F' },
		{ _id: 'r1', xrstatx: 1, Hn: 'HN-01', AccessionNo: 'ACC-SKULL', ExamName: 'Skull AP', ResultText: 'Current skull result', ResultDateTime: '2026-10-19 09:01:00', Status: 'F' },
		...Array.from({ length: 12 }, (_, index) => ({ _id: 'rh' + index, xrstatx: 1, Hn: 'HN-01', AccessionNo: 'ACC-H-' + index, ExamName: 'Chest PA', ResultText: 'History ' + index, ResultDateTime: '2026-10-' + String(22 - index).padStart(2, '0') + ' 09:00:00', Status: 'F' })),
		{ _id: 'rw1', xrstatx: 1, Hn: 'HN-01', AccessionNo: 'ACC-WRONG-CODE', ExamName: 'Chest PA', ResultText: 'Must not match by name', ResultDateTime: '2026-10-18 10:00:00', Status: 'F' },
		{ _id: 'rw2', xrstatx: 1, Hn: 'HN-02', AccessionNo: 'ACC-WRONG-HN', ExamName: 'Chest PA', ResultText: 'Must not cross HN', ResultDateTime: '2026-10-18 11:00:00', Status: 'F' },
	],
};

const get = (object, pathText) => pathText.split('.').reduce((value, key) => (value == null ? value : value[key]), object);
const eq = (a, b) => String(a) === String(b);
const matchesValue = (value, condition) => {
	if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return eq(value, condition);
	if ('$in' in condition && !condition.$in.some((candidate) => eq(value, candidate))) return false;
	if ('$nin' in condition && condition.$nin.some((candidate) => eq(value, candidate))) return false;
	if ('$exists' in condition && condition.$exists !== (value !== undefined)) return false;
	return true;
};
const matches = (row, query) => Object.entries(query || {}).every(([key, condition]) => {
	if (key === '$or') return condition.some((part) => matches(row, part));
	return matchesValue(get(row, key), condition);
});

let writes = 0;
const app = {
	dbObjectId: (value) => String(value),
	dbFindById: async (id, collection) => ({ success: true, reply: { data: (collections[collection] || []).find((row) => eq(row._id, id)) || null } }),
	dbFindAll: async (request) => {
		const spec = request.nosql || {};
		let rows = (collections[spec.collection] || []).filter((row) => matches(row, spec.query));
		return { success: true, reply: { data: rows.slice(0, spec.limit > 0 ? spec.limit : rows.length) } };
	},
	dbInsert: async () => { writes += 1; throw new Error('write forbidden'); },
	dbUpdate: async () => { writes += 1; throw new Error('write forbidden'); },
	dbDelete: async () => { writes += 1; throw new Error('write forbidden'); },
};

(async () => {
	const output = await run({ visit_id: ids.visit }, app, {});
	assert.strictEqual(output.success, true);
	assert.strictEqual(output.read_only, true);
	assert.strictEqual(output.hn, 'HN-01');
	assert.strictEqual(output.vn, 'VN-CURRENT');
	assert.strictEqual(output.orders.length, 1, 'must group by CPOE Order');
	assert.strictEqual(output.orders[0].rooms.length, 1, 'same room/modality must share one room group');
	assert.strictEqual(output.orders[0].rooms[0].items.length, 2);
	assert.strictEqual(output.orders[0].is_final, true, 'Order Final is derived once at order level');

	const chest = output.orders[0].rooms[0].items.find((item) => item.exam_code === 'RD101');
	assert(chest, 'exact exam code must be returned');
	assert.strictEqual(chest.result_text, 'Current chest result');
	assert.strictEqual(chest.history_count, 10, 'same-exam history must be capped at ten');
	assert.strictEqual(chest.same_exam_history[0].accession_no, 'ACC-H-0', 'history must sort newest first');
	assert(!chest.same_exam_history.some((row) => row.accession_no === 'ACC-CURRENT'), 'current accession must be excluded');
	assert(!chest.same_exam_history.some((row) => row.accession_no === 'ACC-WRONG-CODE'), 'same name with a different ExamUid must not match');
	assert(!chest.same_exam_history.some((row) => row.accession_no === 'ACC-WRONG-HN'), 'history must not leak across HN');
	assert(chest.same_exam_history.every((row) => row.vn.startsWith('VN-OLD-')), 'historical VN is provenance, not the grouping key');
	assert.strictEqual(writes, 0, 'read-only process must never write');

	const invalid = await run({ visit_id: 'bad' }, app, {});
	assert.strictEqual(invalid.success, false);
	assert.strictEqual(invalid.error, 'invalid_visit_id');

	console.log('emr-xray-history-get tests passed');
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
