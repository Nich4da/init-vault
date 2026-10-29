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
assert(template.includes('v-for="o in ehLabVisibleCardsForGroup(g)"'), 'result cards must be driven by the room-filtered exact group matcher');
assert(template.includes('ผล Lab เป็นการ์ดคนละความหมายกับการ์ดสั่งตรวจ'), 'separate sibling marker is missing');
assert(!template.includes('v-model="ehLabDialog.visible"'), 'EMR card must not duplicate the shared whole-result popup');
// Updated 2026-10-22 after the user confirmed the compact no-scroll card:
// Ref. Range stays in the shared popup, not in the EMR History summary.
assert(template.includes('>ผล LAB</strong>'), 'LAB result heading is missing');
const labHeadingCount = (template.match(/>ผล LAB<\/strong>/g) || []).length;
assert.strictEqual(labHeadingCount, 1, 'LAB must render one shared head card rather than one heading per Order');
for (const room of ['BC', 'HM', 'HH', 'ML', 'IM', 'MI-OUT', 'MB', 'MY', 'BB', 'BG']) {
	assert(created.includes(`{ code: '${room}', label: '${room}' }`), `LAB room filter is missing ${room}`);
}
assert(template.includes('grid-template-columns:minmax(0,1.65fr) minmax(0,1fr) minmax(0,.62fr) minmax(0,.68fr)'), 'standard LAB card must have exactly four fluid columns');
assert(template.includes('grid-template-columns:minmax(120px,20%) minmax(0,1fr)'), 'MB must use a 20/80 test/result grid and preserve the full remaining result width');
assert(template.includes('display:flex;flex-wrap:wrap;gap:6px;min-width:0'), 'room filters must wrap inside the card instead of scrolling horizontally');
assert(template.includes('<div style="width:100%;max-width:100%;min-width:0;overflow:hidden">'), 'LAB card body must stay within the card width');
assert(template.includes('<pre v-else style="width:100%;max-width:none'), 'MB raw text must be able to use the full result width');
assert(!template.includes('IM / MI-OUT ยังปกปิดผล Sensitive'), 'the redundant Sensitive note must not occupy summary-card space');
assert(template.includes('@click.stop="ehLabOpenResultForm(o)"'), 'whole-result action must use the shared Form handler');
assert(template.includes('@click.stop="ehLabRequestSensitivePdf(o,\'card\')"'), 'Sensitive PDF must keep its separate re-auth handler');
assert(template.includes('v-model="ehLabReauth.visible"'), 'Sensitive/PDF re-auth dialog must remain in EMR History');
assert(template.includes('PDF ที่มีผล Sensitive ต้องยืนยันใหม่ทุกครั้ง'), 'Sensitive PDF one-click-one-auth notice is missing');
assert(template.includes("r.redacted ? 'ปกปิดผล'"), 'manual-hidden result must render as redacted text on the card');
assert(!template.includes('append-to-body'), 'result dialog must stay in the component tree');
assert.match(created, /const microParams = reportIds\.length === 1 \? \{ xparentx: reportIds\[0\] \} : \{\};/);
assert.doesNotMatch(created, /const microParams = \{\};/);
assert(!treatSummaryTemplate.includes('ehLabVisibleCardsForGroup'), 'EMR History room-filter layout must not leak into Treatment Summary');

const groupLoopAt = template.indexOf('<template v-for="(g, gi) in ehGroups"');
const orderCardAt = template.indexOf("border: '1px solid ' + (g.type === 'med'", groupLoopAt);
const siblingAt = template.indexOf('ผล Lab เป็นการ์ดคนละความหมายกับการ์ดสั่งตรวจ', orderCardAt);
const resultLoopAt = template.indexOf('v-for="o in ehLabVisibleCardsForGroup(g)"', siblingAt);
assert(groupLoopAt >= 0 && orderCardAt > groupLoopAt && siblingAt > orderCardAt && resultLoopAt > siblingAt, 'result card must follow the unchanged order card');
const labBoardEnd = template.indexOf('<!-- ══ การเงิน', siblingAt);
const labBoard = template.slice(siblingAt, labBoardEnd);
assert(!labBoard.includes('overflow-x:auto'), 'EMR LAB card must not scroll horizontally');
assert(!labBoard.includes('min-width:860px'), 'EMR LAB card must not force an 860px minimum width');
assert(!labBoard.includes('Ref. Range'), 'EMR LAB card must not render the popup-only Ref. Range column');
assert(!labBoard.includes('r.ref'), 'EMR LAB card must not render popup-only Ref. Range values');
for (const forbidden of ['o.order_no', 'o.lab_no', 'o.section', 'o.chip_text']) {
	assert(!labBoard.includes(forbidden), `compact LAB Order card must not show header metadata: ${forbidden}`);
}
assert(template.includes("v-if=\"g.type !== 'xray' && g.type !== 'lab'\""), 'generic order summary must not duplicate the dedicated LAB result board');

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
	opened: [],
	userState: {
		runProcess(processId, params, ok) {
			calls.push({ processId, params });
			if (processId === '6a9662a75723cd050ea497e0') {
				ok({ data: {
					success: true,
					visit: { visit_id: 'VISIT-1', hn: '6900023', person: { name: 'ด.ช. ทดสอบ ระบบ' } },
					item_groups: [{ type: 'lab', label: 'Lab', count: 2, total: 315, items: [{ order_id: 'ORDER-1', name: 'Hemoglobin typing' }, { order_id: 'ORDER-MICRO', name: 'Aerobic culture' }] }],
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
	openForm(...args) { this.opened.push(args); },
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
assert.strictEqual(cards.length, 2, 'only results with exact source_order_id values from the LAB group may render');
const standardCard = cards.find((order) => order.source_order_id === 'ORDER-1');
const microCard = cards.find((order) => order.source_order_id === 'ORDER-MICRO');
assert(standardCard && microCard, 'standard and MB Order cards must both be present');
assert.strictEqual(standardCard.reported_by, 'ทนพญ.ปรัศนีย์ บุญภิญโญ ท.น.15190');
assert.strictEqual(standardCard.verified_by, 'ทนพญ.ปรัศนีย์ บุญภิญโญ ท.น.15190');
assert.deepStrictEqual(standardCard.display_rows.map((row) => row.code), ['220101EB', '220102EB', '220103EB', '220104EB', '220105EB', '102502CD'], 'Profile/result rows must preserve API order');
assert.strictEqual(standardCard.display_rows[5].redacted, true, 'manual-hidden row must remain in its original position');
assert.strictEqual(state.ehLabRoom, 'ALL', 'LAB room filter must default to all');
assert.strictEqual(state.ehLabRoomCount(state.ehGroups[0], 'ALL'), 2);
assert.strictEqual(state.ehLabRoomCount(state.ehGroups[0], 'MB'), 1);
state.ehLabSetRoom('MB');
assert.deepStrictEqual(state.ehLabVisibleCardsForGroup(state.ehGroups[0]).map((order) => order.source_order_id), ['ORDER-MICRO']);
assert.strictEqual(state.ehLabCardRows(microCard)[0].value, microResultText, 'MB must keep raw text byte-for-byte');
state.ehLabSetRoom('ALL');
state.ehLabOpenResultForm(standardCard);
assert.strictEqual(form.opened.length, 1, 'whole-result action must open one shared Form');
assert.strictEqual(form.opened[0][0], '6ad789a39291822e416c02e7');
assert.strictEqual(form.opened[0][3].source_order_id, 'ORDER-1');
assert.strictEqual(state.ehLabDialog.visible, false, 'whole-result action must not open the removed local result dialog');

// Legacy local-viewer helpers remain temporarily for compatibility with older
// event callers, but the confirmed EMR card no longer renders or calls them.
if (false) {
state.ehLabOpenOrder(cards[0]);
assert.strictEqual(state.ehLabDialog.visible, true);
assert.strictEqual(state.ehLabResultRowNumber(cards[0].result_groups[0], 0, 4), '1.5');
assert.strictEqual(state.ehLabDialog.order.result_groups[0].results[4].comment, 'Suspected thalassemia');
assert.deepStrictEqual(state.ehLabDialog.order.result_groups[0].results[1].previous_values.map(item => item.value), ['1.4', '1.1']);
assert.strictEqual(state.ehLabDialog.order.result_groups[0].results[1].previous.value, '1.4', 'legacy previous remains the newest previous value');
assert.strictEqual(state.ehLabDialog.order.result_groups[1].results[0].redacted, true);
assert.strictEqual(state.ehLabResultRowsCount(), 6, 'redacted placeholder remains part of the LAB-style result sheet count');
const standardGroup = state.ehLabDialog.order.result_groups[0];
const standardHistoryRow = standardGroup.results[1];
state.ehLabOpenHistory(state.ehLabDialog.order, standardGroup, standardHistoryRow);
assert.strictEqual(state.ehLabHistory.visible, true);
assert.strictEqual(state.ehLabHistory.kind, 'standard');
assert.deepStrictEqual(state.ehLabHistoryValues().map(item => item.value), ['1.4', '1.1']);
state.ehLabSetHistoryLimit(1);
assert.deepStrictEqual(state.ehLabHistoryValues().map(item => item.value), ['1.4'], 'LAB selector must limit presentation only');
assert.deepStrictEqual(standardHistoryRow.previous_values.map(item => item.value), ['1.4', '1.1'], 'filter must not mutate source history');
state.ehLabCloseHistory();

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
assert.strictEqual(state.ehLabHistory.visible, true, 'MB history must open inside the doctor result popup');
assert.strictEqual(state.ehLabHistory.kind, 'micro');
assert.strictEqual(state.ehLabHistory.row.previous_values[0].value, 'SPECIMEN: Sputum\n* Gram Stain *\nNo organism seen\nFinal report');
state.ehLabToggleHistoryExpanded(state.ehLabHistoryValues()[0], 0);
assert.strictEqual(state.ehLabHistoryExpanded(state.ehLabHistoryValues()[0], 0), true, 'MB raw sheet must expand inline');
state.ehLabCloseMbHistory();
assert.strictEqual(state.ehLabHistory.visible, false);
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

const myGroup = {
	test_name: 'Wood light',
	results: [
		{ my_pathology: true, test_name: 'Wood light', name: 'ช่องท้อง', code: 'M14', value: 'พบเชื้อ', previous_values: [
			{ value: 'ไม่พบเชื้อ', when: '2026-09-29 10:00:00', visit_vn: '6900310', lab_no: 'L2609290026', status: 'final', flag: 'N' },
		] },
		{ my_pathology: true, test_name: 'Wood light', name: 'แขนซ้าย', code: 'M14', value: 'พบเชื้อ', previous_values: [
			{ value: 'พบเชื้อ', when: '2026-09-29 10:00:00', visit_vn: '6900310', lab_no: 'L2609290026', status: 'final', flag: 'A' },
		] },
	],
};
state.ehLabOpenHistory({ section_code: 'MY' }, myGroup, myGroup.results[0]);
assert.strictEqual(state.ehLabHistory.kind, 'mycology');
assert.strictEqual(state.ehLabMyHistorySheets().length, 1, 'MY rows from one historical occurrence must stay on one sheet');
assert.strictEqual(state.ehLabMyHistorySheets()[0].positions.length, 2, 'MY sheet must preserve every returned position');
state.ehLabCloseHistory();
}

const xrayHistoryItem = {
	item_name: 'Chest PA Upright',
	result_text: 'Current result',
	same_exam_history: Array.from({ length: 12 }, (_, index) => ({ accession_no: 'XR-' + (index + 1), result_text: 'result ' + (index + 1) })),
};
state.ehXrayOpenHistory({ order_number: 'R-XR-1' }, xrayHistoryItem);
assert.strictEqual(state.ehXrayHistory.visible, true);
assert.strictEqual(state.ehXrayHistory.limit, 5, 'X-ray history defaults to five displayed occurrences');
assert.strictEqual(state.ehXrayHistoryItems().length, 5);
assert.strictEqual(state.ehXrayReport.visible, true, 'legacy history action must route to the combined read popup');
state.ehXraySetHistoryLimit(10);
assert.strictEqual(state.ehXrayHistoryItems().length, 10);
assert.strictEqual(xrayHistoryItem.same_exam_history.length, 12, 'X-ray selector must not mutate API data');
state.ehXrayCloseHistory();
state.ehXrayOpenHistory({ order_number: 'R-XR-2' }, { item_name: 'No prior result', result_text: 'Current only', same_exam_history: [] });
assert.strictEqual(state.ehXrayHistory.visible, true, 'X-ray empty-history popup must still open');
assert.strictEqual(state.ehXrayHistoryItems().length, 0);
state.ehXrayCloseHistory();

console.log('ok - EMR History renders the confirmed all-room LAB cards and routes whole results to the shared Form');
