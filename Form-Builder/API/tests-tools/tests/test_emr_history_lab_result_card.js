#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../../..');
const templatePath = path.join(ROOT, '02-his/form-factory/emr-history-template-FULL-v1.html');
const templateTextPath = path.join(ROOT, '02-his/form-factory/emr-history-template-FULL-v1.txt');
const createdPath = path.join(ROOT, 'Form-Builder/API/form-factory/events/emr-history-onCreated-FULL-v1.js');
const treatSummaryTemplatePath = path.join(ROOT, '02-his/form-factory/treat-summary-template-FULL-v1.html');
const template = fs.readFileSync(templatePath, 'utf8');
const templateText = fs.readFileSync(templateTextPath, 'utf8');
const created = fs.readFileSync(createdPath, 'utf8');
const treatSummaryTemplate = fs.readFileSync(treatSummaryTemplatePath, 'utf8');

assert.strictEqual(templateText, template, 'paste-ready .txt template must stay byte-identical to the HTML source');

assert(template.includes('<template v-for="(g, gi) in ehGroups"'), 'group loop must use an outer template');
assert(template.includes('v-for="o in ehLabCardsForGroup(g)"'), 'result card must be driven by the exact group matcher');
assert(template.includes('ผล Lab เป็นการ์ดคนละความหมายกับการ์ดสั่งตรวจ'), 'separate sibling marker is missing');
assert(template.includes('v-model="ehLabDialog.visible"'), 'LAB Worklist-style result dialog is missing');
assert(template.includes('Approve name:'), 'approver byline is missing');
assert(template.includes(':class="{\'is-microbiology\':ehLabIsMicrobiologyDialog()}"'), 'MLab dialog identity is missing');
assert(template.includes('จุลชีววิทยา · MLab'), 'MLab header tag is missing');
assert(!template.includes('หลักการแสดงผล'), 'doctor EMR must not show the LAB implementation notice');
assert(template.includes('ผลจาก MLab'), 'raw MLab result block is missing');
assert(template.includes('@click.stop="ehLabOpenMicroItem(o, item)"'), 'MLab item-level result action is missing');
assert(template.includes('>ไม่มีผล</strong><el-button v-else type="danger"'), 'MLab pending item state is missing');
assert(template.includes('max-height:calc(100vh - 230px)'), 'result dialog body must have a viewport-height scroll boundary');
assert(template.includes('overflow-y:auto'), 'result dialog body scrollbar is missing');
assert(template.includes('@click="ehLabCopyMicrobiologyResult()"'), 'MLab copy action is missing');
assert(template.includes('@click="ehLabScrollToAttachments()"'), 'EMR attachment access button is missing');
assert(template.includes('ดูไฟล์แนบ ({{ ehLabAttachmentCount() }})'), 'EMR attachment button must show the file count');
assert(template.includes('id="eh-lab-result-attachments"'), 'attachment section needs a stable scroll target');
assert(template.includes('ไฟล์จากห้องปฏิบัติการ · อ่านอย่างเดียวใน EMR'), 'MLab attachment section must remain doctor read-only');
assert(template.includes('ค่าก่อนหน้า 1–5 ครั้ง'), 'doctor full-result popup must show up to five previous examinations');
assert(template.includes('@click.stop="ehLabOpenMbHistory(r)"'), 'MB long-text history action is missing');
assert(template.includes('ข้อความ raw จาก Agent โดยไม่ตัดหรือแปลงโครงสร้าง'), 'MB child overlay must preserve the raw Agent text');
assert(template.includes('ehLabMbHistory.visible && ehLabMbHistory.row'), 'same-root MB child overlay is missing');
assert(created.includes('s.ehLabAttachmentCount = () =>'), 'attachment count helper is missing');
assert(created.includes("document.getElementById('eh-lab-result-attachments')"), 'attachment scroll helper is missing');
assert(created.includes('s.ehLabPreviousValues = (row) =>'), 'previous-five UI helper is missing');
assert(created.includes('s.ehLabOpenMbHistory = (row) =>'), 'MB history open helper is missing');
assert(template.includes('v-if="ehLabDialog.order && !ehLabIsMicrobiologyDialog()"'), 'standard LAB viewer must remain behind the non-MLab guard');
assert(template.includes("r.redacted ? 'ปกปิดผล'"), 'manual-hidden result must render as redacted text in the shared result table');
assert(template.includes('o.hidden_rows'), 'manual-hidden result must be visible as a redacted row on the EMR card');
assert(!template.includes('append-to-body'), 'result dialog must stay in the component tree');
assert.match(created, /const microParams = reportIds\.length === 1 \? \{ xparentx: reportIds\[0\] \} : \{\};/);
assert.doesNotMatch(created, /const microParams = \{\};/);
assert(!treatSummaryTemplate.includes('ehLabMbHistory'), 'Treatment Summary card/template must remain unchanged by the EMR History popup feature');
assert(!treatSummaryTemplate.includes('ค่าก่อนหน้า 1–5 ครั้ง'), 'previous-five layout must not be copied into the Treatment Summary card');

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
		{ group_id: 'PROFILE-1', group_name: 'Hemoglobin typing', name: 'Hb F', code: '220102EB', value: '2.0', unit: '%', ref: '0-1.2', flag: 'H', result_status: 'final', previous_values: [
			{ value: '1.4', unit: '%', interpretation: 'H', reference_range: '0-1.2', entered_at: '2026-08-01 10:00:00', visit_vn: '6800999', lab_no: 'LAB-680801-01', status: 'final' },
			{ value: '1.1', unit: '%', interpretation: 'N', reference_range: '0-1.2', entered_at: '2026-06-01 10:00:00', visit_vn: '6800777', lab_no: 'LAB-680601-02', status: 'corrected' },
		] },
		{ group_id: 'PROFILE-1', group_name: 'Hemoglobin typing', name: 'Hb A', code: '220103EB', value: '80.0', unit: '%', ref: '95-98', flag: 'L', result_status: 'final' },
		{ group_id: 'PROFILE-1', group_name: 'Hemoglobin typing', name: 'Hb A2/E', code: '220104EB', value: '3.5', unit: '%', ref: '0-3.5', result_status: 'final' },
		{ group_id: 'PROFILE-1', group_name: 'Hemoglobin typing', name: 'Remarks (Hb Typing)', code: '220105EB', value: 'Comment', result_comment: 'Suspected thalassemia', result_status: 'final' },
		{ group_id: 'panel:C25-CD', group_name: 'Electrolyte จาก Clotted blood (สปสช.)', name: 'Potassium (K) จาก Clotted blood', code: '102502CD', result_status: 'final', visibility: { state: 'hidden', reason: 'manual_result_hidden', manual_hidden: true } },
	],
};
const microResultText = [
	'SPECIMEN: Sputum',
	'------------------------------',
	'* Gram Stain *',
	'',
	'Not found',
	'',
	'LAB NO.: 0-0001',
].join('\n');
const microRaw = {
	order_id: 'LAB-MICRO-1',
	source_order_id: 'ORDER-MICRO',
	order_no: 'R2610040001',
	section: 'Microbiology',
	section_code: 'MB',
	status: 'completed',
	scope: 'visit',
	patient_hn: '6900023',
	patient_name: 'ด.ช. ทดสอบ ระบบ',
	lab_no: '406910040001',
	ordered_at: '2026-10-04 12:31:00',
	received_at: '2026-10-04 13:00:00',
	collected_at: '2026-10-04 12:45:00',
	resulted_at: '2026-10-04 14:39:24',
	reported_at: '2026-10-04 14:39:24',
	specimen_name: 'Sputum',
	attachments: [{ name: 'micro-result.pdf', size: 2048, url: 'https://files.test/micro-result.pdf' }],
	result_report_ids: ['111111111111111111111111', '222222222222222222222222'],
	ordered_items: [
		{ item_id: 'MICRO-ITEM-1', item_code: 'M14', item_name: 'Gram stain', result_code: '400199', specimen_name: 'Sputum', collected_at: '2026-10-04 12:45:00' },
		{ item_id: 'MICRO-ITEM-2', item_code: 'M15', item_name: 'Aerobic culture', result_code: '400799', specimen_name: 'Sputum', collected_at: '2026-10-04 12:45:00' },
		{ item_id: 'MICRO-ITEM-3', item_code: 'M16', item_name: 'Anaerobic culture', result_code: '400899', specimen_name: 'Sputum', collected_at: '2026-10-04 12:45:00' },
	],
	items: [
		{ group_id: 'MICRO-ITEM-1', group_name: 'Gram stain', name: 'Gram stain', code: '400199', value: microResultText, result_status: 'final', reported_at: '2026-10-04 14:39:24', result_source: 'lis', result_report_id: '111111111111111111111111', previous_values: [
			{ value: 'SPECIMEN: Sputum\n* Gram Stain *\nNo organism seen\nFinal report', entered_at: '2026-09-01 11:00:00', visit_vn: '6900101', lab_no: '406909010001', status: 'final' },
		] },
		{ group_id: 'MICRO-ITEM-2', group_name: 'Aerobic culture', name: 'Aerobic culture', code: '400799', value: 'No growth', result_status: 'partial', reported_at: '2026-10-04 14:40:00', result_source: 'lis', result_report_id: '222222222222222222222222' },
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
					visit: { visit_id: 'VISIT-1', hn: '6900023', person: { name: 'ด.ช. ทดสอบ ระบบ' } },
					item_groups: [{ type: 'lab', label: 'Lab', count: 1, total: 315, items: [{ order_id: 'ORDER-1', name: 'Hemoglobin typing' }] }],
					consults: [], orders: [], others: [],
				} });
				return;
			}
			if (processId === '6ab3be31cec3020e8562a2c9') {
				ok({ data: { success: true, lab_orders: [matchingRaw, Object.assign({}, matchingRaw, { order_id: 'LAB-GROUP-2', source_order_id: 'ORDER-2' }), microRaw] } });
				return;
			}
			throw new Error('Unexpected process ' + processId);
		},
	},
	openForm() {},
	subFormClose() {},
};
let copiedText = '';
const notices = [];
const component = {
	vueState: state,
	formParams: form.formParams,
	getFormRef: () => form,
	copyClipboard: (value) => { copiedText = value; },
	notify: (...args) => { notices.push(args); },
};
new Function(created).call(component);
state.ehLoad('VISIT-1', null);

assert.strictEqual(calls.length, 2, 'history and LAB board must be loaded separately');
assert.deepStrictEqual(calls[1], { processId: '6ab3be31cec3020e8562a2c9', params: { visit_id: 'VISIT-1', hn: '6900023' } });
assert.strictEqual(state.ehLabOrders.length, 3, 'board response stays available before card-level filtering');
const cards = state.ehLabCardsForGroup(state.ehGroups[0]);
assert.strictEqual(cards.length, 1, 'only the result with the exact source_order_id may render after this order card');
assert.strictEqual(cards[0].source_order_id, 'ORDER-1');
assert.strictEqual(cards[0].reported_by, 'ทนพญ.ปรัศนีย์ บุญภิญโญ ท.น.15190');
assert.strictEqual(cards[0].verified_by, 'ทนพญ.ปรัศนีย์ บุญภิญโญ ท.น.15190');
assert.strictEqual(cards[0].result_groups.length, 2);
assert.strictEqual(cards[0].result_groups[0].results.length, 5);
assert.strictEqual(cards[0].hidden_rows.length, 1);
assert.strictEqual(cards[0].hidden_rows[0].redacted, true);
assert.strictEqual(cards[0].locked_rows.length, 0, 'manual hide is not a doctor re-auth flow');

state.ehLabOpenOrder(cards[0]);
assert.strictEqual(state.ehLabDialog.visible, true);
assert.strictEqual(state.ehLabResultRowNumber(cards[0].result_groups[0], 0, 4), '1.5');
assert.strictEqual(state.ehLabDialog.order.result_groups[0].results[4].comment, 'Suspected thalassemia');
assert.deepStrictEqual(state.ehLabDialog.order.result_groups[0].results[1].previous_values.map(item => item.value), ['1.4', '1.1']);
assert.strictEqual(state.ehLabDialog.order.result_groups[0].results[1].previous.value, '1.4', 'legacy previous remains the newest previous value');
assert.strictEqual(state.ehLabDialog.order.result_groups[1].results[0].redacted, true);
assert.strictEqual(state.ehLabResultRowsCount(), 6, 'redacted placeholder remains part of the LAB-style result sheet count');

const microOrder = state.ehLabOrders.find((order) => order.source_order_id === 'ORDER-MICRO');
assert(microOrder, 'MLab order must stay available to EMR History');
assert.strictEqual(microOrder.micro, true, 'MB section must select the MLab viewer');
assert.strictEqual(microOrder.received_at, '2026-10-04 13:00:00', 'MLab timeline must retain the received timestamp');
assert.strictEqual(microOrder.result_groups[0].test_code, '400199', 'MLab card must show the mapped HIS result code');
assert.strictEqual(state.ehLabMicroItems(microOrder).length, 3, 'MLab card must preserve every ordered CPOE Item');
assert.strictEqual(state.ehLabMicroItems(microOrder)[0].item_code, 'M14');
assert.strictEqual(state.ehLabMicroItems(microOrder)[0].has_result, true);
assert.strictEqual(state.ehLabMicroItems(microOrder)[1].has_result, true);
assert.strictEqual(state.ehLabMicroItems(microOrder)[2].has_result, false, 'ordered Item without a result must render as ไม่มีผล');
assert.strictEqual(microOrder.report_ready, false, 'whole-order PDF must stay fail-closed when sibling Items have different Result Reports');
state.ehLabOpenMicroItem(microOrder, state.ehLabMicroItems(microOrder)[0]);
assert.strictEqual(state.ehLabIsMicrobiologyDialog(), true);
assert.strictEqual(state.ehLabMicroGroupsForDisplay().length, 1);
assert.strictEqual(state.ehLabDialog.order.report_ready, true, 'selected Item with one Result Report must enable PDF');
assert.strictEqual(state.ehLabAttachmentCount(), 1, 'selected MLab popup must retain its Order attachment');
assert.strictEqual(state.ehLabDialog.order.attachments[0].name, 'micro-result.pdf');
assert.deepStrictEqual(state.ehLabDialog.order.report_params, { xparentx: '111111111111111111111111' });
assert.deepStrictEqual(state.ehLabDialog.order._raw.result_report_ids, ['111111111111111111111111']);
assert.strictEqual(state.ehLabResultTestCount(), 1, 'item-level popup must count only the selected Item');
assert.strictEqual(state.ehLabMicroPatientName(), 'ด.ช. ทดสอบ ระบบ');
assert.strictEqual(state.ehLabMicroSpecimenName(), 'Sputum');
assert.strictEqual(state.ehLabMicroCollectedAt(), '2026-10-04 12:45:00');
assert.strictEqual(state.ehLabMicroResultRows(microOrder.result_groups[0])[0].value, microResultText, 'raw MLab text must remain byte-for-byte at presentation level');
const selectedMicroRow = state.ehLabMicroResultRows(state.ehLabMicroGroupsForDisplay()[0])[0];
assert.strictEqual(state.ehLabPreviousValues(selectedMicroRow).length, 1);
state.ehLabOpenMbHistory(selectedMicroRow);
assert.strictEqual(state.ehLabMbHistory.visible, true, 'MB history must open inside the doctor result popup');
assert.strictEqual(state.ehLabMbHistory.row.previous_values[0].value, 'SPECIMEN: Sputum\n* Gram Stain *\nNo organism seen\nFinal report');
state.ehLabCloseMbHistory();
assert.strictEqual(state.ehLabMbHistory.visible, false);
assert.strictEqual(state.ehLabDialog.visible, true, 'closing MB history must keep the parent doctor popup open');
assert.strictEqual(state.ehLabMicroOverallStatusText(), 'Final');
assert.strictEqual(state.ehLabMicroResultCountText(), 'ทั้งหมด 1 · มีผล 1 · รอผล 0');
state.ehLabCopyMicrobiologyResult();
assert(copiedText.includes(microResultText), 'copy action must contain the exact raw MLab text');
assert.strictEqual(notices[notices.length - 1][0], 'คัดลอกผลที่แสดงแล้ว');

state.ehLabCloseLabDialog();
state.ehLabOpenMicroItem(microOrder, state.ehLabMicroItems(microOrder)[1]);
assert.strictEqual(state.ehLabDialog.order.report_ready, true);
assert.deepStrictEqual(state.ehLabDialog.order.report_params, { xparentx: '222222222222222222222222' }, 'sibling Item must open its own Result Report');

const ambiguousItemOrder = Object.assign({}, microOrder, {
	result_groups: microOrder.result_groups.map((group, index) =>
		index === 1
			? Object.assign({}, group, { results: group.results.concat(Object.assign({}, group.results[0], { result_report_id: '333333333333333333333333' })) })
			: group,
	),
});
state.ehLabCloseLabDialog();
state.ehLabOpenMicroItem(ambiguousItemOrder, state.ehLabMicroItems(ambiguousItemOrder)[1]);
assert.strictEqual(state.ehLabDialog.order.report_ready, false, 'one Item with multiple Result Reports must remain fail-closed');
assert.strictEqual(state.ehLabDialog.order.report_hint, 'รายการนี้มีผลหลายชุด จึงไม่เลือก Result Report ให้อัตโนมัติ');

console.log('ok - EMR History keeps the standard LAB viewer and routes MB results to the raw MLab popup');
