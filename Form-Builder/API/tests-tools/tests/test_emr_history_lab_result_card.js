#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../../..');
const templatePath = path.join(ROOT, '02-his/form-factory/emr-history-template-FULL-v1.html');
const createdPath = path.join(ROOT, 'Form-Builder/API/form-factory/events/emr-history-onCreated-FULL-v1.js');
const template = fs.readFileSync(templatePath, 'utf8');
const created = fs.readFileSync(createdPath, 'utf8');

assert(template.includes('<template v-for="(g, gi) in ehGroups"'), 'group loop must use an outer template');
assert(template.includes('v-for="o in ehLabCardsForGroup(g)"'), 'result card must be driven by the exact group matcher');
assert(template.includes('ผล Lab เป็นการ์ดคนละความหมายกับการ์ดสั่งตรวจ'), 'separate sibling marker is missing');
assert(template.includes('v-model="ehLabDialog.visible"'), 'LAB Worklist-style result dialog is missing');
assert(template.includes('Approve name:'), 'approver byline is missing');
assert(!template.includes('append-to-body'), 'result dialog must stay in the component tree');

const groupLoopAt = template.indexOf('<template v-for="(g, gi) in ehGroups"');
const orderCardAt = template.indexOf("border: '1px solid ' + (g.type === 'med'", groupLoopAt);
const siblingAt = template.indexOf('ผล Lab เป็นการ์ดคนละความหมายกับการ์ดสั่งตรวจ', orderCardAt);
const resultLoopAt = template.indexOf('v-for="o in ehLabCardsForGroup(g)"', siblingAt);
assert(groupLoopAt >= 0 && orderCardAt > groupLoopAt && siblingAt > orderCardAt && resultLoopAt > siblingAt, 'result card must follow the unchanged order card');

const calls = [];
const state = {};
const matchingRaw = {
	order_id: 'LAB-GROUP-1',
	source_order_id: 'ORDER-1',
	order_no: 'R2609240004',
	section: 'Hematology-Homeostasis',
	status: 'completed',
	scope: 'visit',
	patient_hn: '6900023',
	ordered_at: '2026-09-24 15:05:00',
	resulted_at: '2026-09-24 15:30:00',
	reported_at: '2026-09-24 15:30:43',
	reported_by_source_name: 'ทนพญ.ปรัศนีย์ บุญภิญโญ ท.น.15190',
	verified_by_source_name: 'ทนพญ.ปรัศนีย์ บุญภิญโญ ท.น.15190',
	result_report_ids: ['aaaaaaaaaaaaaaaaaaaaaaaa'],
	items: [
		{ group_id: 'PROFILE-1', group_name: 'Hemoglobin typing', name: 'Hemoglobin typing', code: '220101EB', value: 'A2A Barts H', result_status: 'final' },
		{ group_id: 'PROFILE-1', group_name: 'Hemoglobin typing', name: 'Hb F', code: '220102EB', value: '2.0', unit: '%', ref: '0-1.2', flag: 'H', result_status: 'final' },
		{ group_id: 'PROFILE-1', group_name: 'Hemoglobin typing', name: 'Hb A', code: '220103EB', value: '80.0', unit: '%', ref: '95-98', flag: 'L', result_status: 'final' },
		{ group_id: 'PROFILE-1', group_name: 'Hemoglobin typing', name: 'Hb A2/E', code: '220104EB', value: '3.5', unit: '%', ref: '0-3.5', result_status: 'final' },
		{ group_id: 'PROFILE-1', group_name: 'Hemoglobin typing', name: 'Remarks (Hb Typing)', code: '220105EB', value: 'Comment', result_comment: 'Suspected thalassemia', result_status: 'final' },
	],
};

const form = {
	formParams: { visit_id: 'VISIT-1' },
	userState: {
		runProcess(processId, params, ok) {
			calls.push({ processId, params });
			if (processId === '6a9662a75723cd050ea497e0') {
				ok({ data: {
					success: true,
					visit: { visit_id: 'VISIT-1', hn: '6900023' },
					item_groups: [{ type: 'lab', label: 'Lab', count: 1, total: 315, items: [{ order_id: 'ORDER-1', name: 'Hemoglobin typing' }] }],
					consults: [], orders: [], others: [],
				} });
				return;
			}
			if (processId === '6ab3be31cec3020e8562a2c9') {
				ok({ data: { success: true, lab_orders: [matchingRaw, Object.assign({}, matchingRaw, { order_id: 'LAB-GROUP-2', source_order_id: 'ORDER-2' })] } });
				return;
			}
			throw new Error('Unexpected process ' + processId);
		},
	},
	openForm() {},
	subFormClose() {},
};
const component = { vueState: state, formParams: form.formParams, getFormRef: () => form };
new Function(created).call(component);
state.ehLoad('VISIT-1', null);

assert.strictEqual(calls.length, 2, 'history and LAB board must be loaded separately');
assert.deepStrictEqual(calls[1], { processId: '6ab3be31cec3020e8562a2c9', params: { visit_id: 'VISIT-1', hn: '6900023' } });
assert.strictEqual(state.ehLabOrders.length, 2, 'board response stays available before card-level filtering');
const cards = state.ehLabCardsForGroup(state.ehGroups[0]);
assert.strictEqual(cards.length, 1, 'only the result with the exact source_order_id may render after this order card');
assert.strictEqual(cards[0].source_order_id, 'ORDER-1');
assert.strictEqual(cards[0].reported_by, 'ทนพญ.ปรัศนีย์ บุญภิญโญ ท.น.15190');
assert.strictEqual(cards[0].verified_by, 'ทนพญ.ปรัศนีย์ บุญภิญโญ ท.น.15190');
assert.strictEqual(cards[0].result_groups.length, 1);
assert.strictEqual(cards[0].result_groups[0].results.length, 5);

state.ehLabOpenOrder(cards[0]);
assert.strictEqual(state.ehLabDialog.visible, true);
assert.strictEqual(state.ehLabResultRowNumber(cards[0].result_groups[0], 0, 4), '1.5');
assert.strictEqual(state.ehLabDialog.order.result_groups[0].results[4].comment, 'Suspected thalassemia');

console.log('ok - EMR History LAB result is a separate exact-order sibling card with the shared full-result viewer');
