#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const emrTemplate = read('02-his/form-factory/emr-history-template-FULL-v1.html');
const emrTemplateText = read('02-his/form-factory/emr-history-template-FULL-v1.txt');
const emrCreated = read('Form-Builder/API/form-factory/events/emr-history-onCreated-FULL-v1.js');
const treatTemplate = read('02-his/form-factory/treat-summary-template-FULL-v1.html');
const treatTemplateText = read('02-his/form-factory/treat-summary-template-FULL-v1.txt');
const treatCreated = read('Form-Builder/API/form-factory/events/treat-summary-onCreated-FULL-v2.js');
const api = read('Form-Builder/API/api-factory/processes/emr-xray-history-get.js');

assert.strictEqual(emrTemplateText, emrTemplate, 'EMR History HTML/TXT replacements must stay identical');
assert.strictEqual(treatTemplateText, treatTemplate, 'Treat Summary HTML/TXT replacements must stay identical');

// Updated 2026-10-19 after the user created the isolated X-ray Process.
assert(emrCreated.includes("const EH_XRAY_HISTORY_PROC = '6ad58d76481c196fbb339ae8'"), 'EMR History must use the confirmed X-ray Process ID');
assert(treatCreated.includes("const TS_XRAY_HISTORY_PROC = '6ad58d76481c196fbb339ae8'"), 'EMR card must use the same confirmed X-ray Process ID');
assert(treatCreated.includes('s.tsApi = () => {'), 'Treat Summary must resolve the Process connector through a lifecycle-safe helper');
assert(treatCreated.includes('const api = (form && form.userState) || field.globalUserState || null;'), 'Treat Summary connector must fall back safely when the parent Form is not ready');
assert(treatCreated.includes("s.tsErr = 'ไม่พบ API Process connector';"), 'Summary loader must fail closed when no Process connector exists');
assert(treatCreated.includes("s.tsXrayBoardError = 'ไม่พบ API Process connector';"), 'X-ray loader must fail closed when no Process connector exists');
assert(emrCreated.includes('s.ehXrayLoad(s.ehVisit)'), 'EMR History must load X-ray independently');
assert(emrCreated.includes('s.ehXrayOrders = s.ehXrayResultOrders(data.orders);'), 'EMR History must hide sent/ready X-ray items until a result record exists');
assert(treatCreated.includes('s.tsXrayBoardLoad(s.tsCurVisit)'), 'EMR Card must load the current Visit independently');
assert(treatCreated.includes("s.tsUi.tab = 'med';"), 'Treat Summary must default to the medicine tab');
assert(!treatCreated.includes("else if (s.tsLab.length) s.tsUi.tab = 'lab';"), 'Treat Summary must not auto-switch away from medicine based on available data');

assert(emrTemplate.includes("v-if=\"g.type !== 'xray' && g.type !== 'lab'\""), 'generic order card must leave X-ray and LAB to their dedicated result branches');
assert(emrTemplate.includes("v-if=\"g.type === 'xray'\""), 'dedicated X-ray branch is missing');
assert(emrTemplate.includes('@click="ehXrayToggleOrder(order)"'), 'History Order must collapse/expand');
// User-approved presentation change 2026-10-22: each result type has exactly
// one head card; multiple Orders are compact sub-cards inside that head card.
const emrXrayStart = emrTemplate.indexOf("<template v-if=\"g.type === 'xray'\"");
const emrXrayEnd = emrTemplate.indexOf('<!-- ผล Lab', emrXrayStart);
const emrXrayCard = emrTemplate.slice(emrXrayStart, emrXrayEnd);
assert(emrXrayCard.includes('>ผล X-RAY</strong>'), 'History X-ray card must use the result heading');
assert.strictEqual((emrXrayCard.match(/>ผล X-RAY<\/strong>/g) || []).length, 1, 'History X-ray must render one shared head card, not one heading per Order');
assert(emrXrayCard.indexOf('>ผล X-RAY</strong>') < emrXrayCard.indexOf('<article v-for="order in ehXrayOrdersForGroup(g)"'), 'History X-ray Order sub-cards must sit inside the shared head card');
assert(!emrXrayCard.includes('Order No. {{ order.order_number'), 'History X-ray card must not expose Order No. as its heading');
// Updated 2026-10-22 after the user approved one combined read popup:
// the card has one ดูผลอ่าน action; current and previous results live together.
assert(!emrXrayCard.includes('>ผลก่อนหน้า</el-button>'), 'separate previous-result card action must be removed');
assert(emrTemplate.includes(':model-value="ehXrayHistory.limit"'), 'X-ray previous-result dropdown is missing');
assert(emrTemplate.includes('<el-option :value="10" label="10 ครั้ง" />'), 'X-ray previous-result dropdown must include ten occurrences');
assert(!emrTemplate.includes("v-for=\"n in [1,2,3,4,5]\""), 'obsolete X-ray segmented history selector must be removed');
assert(emrTemplate.includes('v-if="!ehXrayHistoryItems().length"'), 'X-ray empty-history state is missing');
assert(emrCreated.includes('s.ehXrayHistoryItems = () =>'), 'X-ray presentation filter helper is missing');
assert(emrCreated.includes('s.ehXrayHistory = { visible: true, order: order || null, item, limit: 5 };'), 'EMR History X-ray combined popup must default to five previous results');
assert(emrTemplate.includes('@click="ehXrayOpenReport(order,item)"'), 'exam-level report action is missing');
assert(emrTemplate.includes('>ดูภาพ</a>'), 'exam-level image action is missing');
assert(emrTemplate.includes(':report-list="ehXrayPdfReportList"'), 'History X-ray PDF action is missing');
assert(emrCreated.includes("const EH_XRAY_RESULT_PDF_REPORT_ID = '6ab2d3e4f5061728394a5b6c'"), 'History X-ray PDF report ID is missing');
assert(emrCreated.includes("{ dataid: String(item.result_id) }"), 'History X-ray PDF must bind the result record ID');
assert(emrTemplate.includes('v-if="order.is_final"'), 'Final must remain at Order level');
assert(!emrTemplate.includes('v-if="item.is_final"'), 'Final must not be repeated at item level');

const reportDialogStart = emrTemplate.indexOf('<!-- X-ray read popup:');
const reportDialogEnd = emrTemplate.indexOf('<!-- ยืนยันตัวตน Sensitive/PDF', reportDialogStart);
const reportDialog = emrTemplate.slice(reportDialogStart, reportDialogEnd);
assert(reportDialog.includes('ehXrayReport.item.result_text'), 'report dialog must show the full report');
assert(reportDialog.includes('ehXrayHistoryItems()'), 'combined report dialog must append same-exam history');
assert(reportDialog.includes('ehXrayViewerHref(ehXrayReport.item)'), 'current report block must keep the image action');
assert(reportDialog.includes("'eh-xray-dialog-pdf-'"), 'current report block must keep the PDF action');
assert(reportDialog.includes("'eh-xray-history-pdf-'"), 'previous result rows must keep the PDF action');

assert(treatTemplate.includes('<!-- Card X-ray ใหม่:'), 'compact X-ray Card branch is missing');
assert(treatTemplate.includes('@click="tsXrayToggleOrder(order)"'), 'Card Order must collapse/expand');
assert(treatTemplate.includes('>ผล X-RAY</strong>'), 'Treat Summary X-ray card must use the result heading');
const treatXrayStart = treatTemplate.indexOf('<!-- Card X-ray ใหม่:');
const treatXrayEnd = treatTemplate.indexOf('<template v-else-if="tsXgOn">', treatXrayStart);
const treatXrayCard = treatTemplate.slice(treatXrayStart, treatXrayEnd);
assert.strictEqual((treatXrayCard.match(/>ผล X-RAY<\/strong>/g) || []).length, 1, 'Treat Summary X-ray must render one shared head card');
assert(treatXrayCard.indexOf('>ผล X-RAY</strong>') < treatXrayCard.indexOf('<article v-for="order in tsXrayOrders"'), 'Treat Summary X-ray Orders must render as child sub-cards');
assert(treatTemplate.includes('@click="tsXrayOpenReport(order,item,room)"'), 'Card report action is missing');
assert(treatTemplate.includes('tsXrayViewerHref(item)'), 'Card image action is missing');
// User-approved 2026-10-22: X-ray uses the same dropdown presentation as the
// shared LAB popup while preserving the X-ray API's latest-five contract.
assert(treatTemplate.includes('@click="tsXrayOpenHistory(order,item)">ผลก่อนหน้า</el-button>'), 'Card previous-result action is missing');
assert(treatTemplate.includes(':model-value="tsXrayHistory.limit"'), 'Card previous-result dropdown is missing');
assert(!treatTemplate.includes("v-for=\"n in [1,2,3,4,5]\""), 'obsolete Card segmented history selector must be removed');
assert(treatTemplate.includes('tsXrayHistory.item.result_text'), 'Card history must show the current result above the filter');
assert(treatTemplate.includes('tsXrayHistoryItems()'), 'Card history presentation filter helper is missing');
assert(treatCreated.includes('s.tsXrayHistory = { visible: true, order: order || null, item, limit: 5 };'), 'Treat Summary X-ray previous results must default to five');
assert(treatCreated.includes("const TS_XRAY_RESULT_PDF_REPORT_ID = '6ab2d3e4f5061728394a5b6c'"), 'Card X-ray Result PDF report ID is missing');
assert(treatCreated.includes("{ dataid: String(item.result_id) }"), 'Card X-ray PDF must bind the Report-required dataid parameter');
assert(!treatCreated.includes("{ xparentx: String(item.result_id) }"), 'Card X-ray PDF must not send the LAB-style xparentx parameter');
assert(treatCreated.includes('s.tsXrayItemHasResult = (item) =>'), 'Card X-ray must define a result-record gate');
assert(treatCreated.includes('s.tsXrayOrders = s.tsXrayResultOrders(data.orders);'), 'Card X-ray must hide orders/items that do not have result records');
assert(treatCreated.includes('// ค่าเริ่มต้นพับทุกใบ ผู้ใช้กดกางเฉพาะ Order ที่ต้องการดู\n\t\t\ts.tsXrayOrderOpen = {};'), 'Card X-ray orders must start collapsed');
assert(!treatCreated.includes("opened[s.tsXrayOrderKey(s.tsXrayOrders[0])] = true"), 'Card X-ray must not auto-expand the first order');
assert(!treatCreated.includes('s.tsXrayOrders = Array.isArray(data.orders) ? data.orders : [];'), 'obsolete unfiltered X-ray assignment must not remain in the replacement');
const xrayLoaderStart = treatCreated.indexOf('s.tsXrayBoardLoad = (visitId) =>');
const xrayLoaderEnd = treatCreated.indexOf('\n};', xrayLoaderStart) + '\n};'.length;
const xrayLoader = treatCreated.slice(xrayLoaderStart, xrayLoaderEnd);
assert(!/\},\s*\);/.test(xrayLoader), 'initCraft event editor rejects a trailing comma after the final runProcess callback');
assert(treatTemplate.includes('— ยังไม่มีผล X-ray ใน Visit นี้ —'), 'Card X-ray empty state must describe results, not orders');
assert(treatTemplate.includes('>มีผลบางส่วน</el-tag>'), 'Mixed-result X-ray orders must not be labelled sent/ready');
assert(treatTemplate.includes(':report-list="tsXrayPdfReportList"'), 'Card X-ray PDF action is missing');

// User-approved 2026-10-22: EMR History LAB summary must fit its card without
// horizontal scrolling. Ref. Range and comments remain available in the popup.
const labBoardStart = emrTemplate.indexOf('<!-- ผล Lab เป็นการ์ด');
const labBoardEnd = emrTemplate.indexOf('<!-- /EMR History LAB result board -->', labBoardStart);
const labBoard = emrTemplate.slice(labBoardStart, labBoardEnd);
assert(labBoard.includes('>ผล LAB</strong>'), 'LAB card heading must be ผล LAB');
assert.strictEqual((labBoard.match(/>ผล LAB<\/strong>/g) || []).length, 1, 'LAB must render one shared head card');
assert(labBoard.indexOf('>ผล LAB</strong>') < labBoard.indexOf('v-for="o in ehLabVisibleCardsForGroup(g)"'), 'LAB Order sub-cards must sit inside the shared head card');
assert(!labBoard.includes('Ref. Range'), 'LAB card must not render a Ref. Range column');
assert(!labBoard.includes('r.ref'), 'LAB card must not render Ref. Range values');
assert(!labBoard.includes('overflow-x:auto'), 'LAB card must not enable horizontal scrolling');
assert(labBoard.includes('grid-template-columns:72px 104px'), 'LAB footer actions need stable fixed slots');

const resultFilterStart = treatCreated.indexOf('s.tsXrayItemHasResult = (item) =>');
const resultFilterEnd = treatCreated.indexOf('s.tsXrayPdfReady = (item) =>', resultFilterStart);
const resultFilterState = {};
vm.runInNewContext(treatCreated.slice(resultFilterStart, resultFilterEnd), { s: resultFilterState });
const filteredOrders = resultFilterState.tsXrayResultOrders([
	{ order_id: 'sent-only', rooms: [{ room_code: 'DX', items: [{ item_id: 'waiting', result_id: '' }] }] },
	{ order_id: 'mixed', rooms: [
		{ room_code: 'DX', items: [
			{ item_id: 'resulted', result_id: '6aa75fc6d2e99ea16318b5ab', is_final: false },
			{ item_id: 'sent', result_id: '', is_final: false },
		] },
		{ room_code: 'CT', items: [{ item_id: 'ready', result_id: '' }] },
	] },
]);
assert.strictEqual(filteredOrders.length, 1, 'sent/ready-only X-ray orders must be hidden');
assert.strictEqual(filteredOrders[0].order_id, 'mixed', 'an order with a result must remain visible');
assert.strictEqual(filteredOrders[0].rooms.length, 1, 'rooms without results must be hidden');
assert.strictEqual(filteredOrders[0].rooms[0].items.length, 1, 'sent items inside a mixed order must be hidden');
assert.strictEqual(filteredOrders[0].item_count, 1, 'visible X-ray count must include resulted items only');
assert.strictEqual(filteredOrders[0].is_final, false, 'a non-final result must remain visible as partial');

const treatHistoryStart = treatTemplate.indexOf('<!-- X-ray previous results:');
const treatHistoryEnd = treatTemplate.indexOf('</el-dialog>', treatHistoryStart) + '</el-dialog>'.length;
const treatHistoryDialog = treatTemplate.slice(treatHistoryStart, treatHistoryEnd);
assert(treatHistoryDialog.includes('white-space:pre-wrap'), 'Card history must show full report text');
assert(treatHistoryDialog.includes('tsXrayViewerHref(historyItem)'), 'Card history must keep the image action');
assert(!treatHistoryDialog.includes('tsXrayOpenReport') && !treatHistoryDialog.includes('sd-report'), 'Card history must not contain read-report or PDF actions');

const treatReportStart = treatTemplate.indexOf('<el-dialog v-model="tsXrayReport.visible"');
const treatReportEnd = treatTemplate.indexOf('<!-- X-ray previous results:', treatReportStart);
const treatReportDialog = treatTemplate.slice(treatReportStart, treatReportEnd);
assert(treatReportDialog.includes('ผลล่าสุด · โหมดดูอย่างเดียว'), 'Card report popup must show latest-result read-only mode');
assert(!treatReportDialog.includes('ประวัติการแก้'), 'Card report popup must not expose revision history');

assert(api.includes("history_rule: 'same_hn_exact_exam_code_latest_10'"), 'API must declare the exact same-exam ten-history rule');
assert(api.includes('ExamUid: { $in: exactExamCodes }'), 'history lookup must use exact ExamUid');
assert(!api.includes('RegExp'), 'history API must not use fuzzy/name regex matching');
assert(!/db(?:Insert|Update|Delete|Remove|Save)|insertOne|updateOne|deleteOne/.test(api), 'history API must stay read-only');

// Regression sentinels: the isolated work must leave LAB and general history branches present.
for (const marker of ['EH_LAB_BOARD_PROC', 's.ehLabLoad(s.ehVisit)', 'v-for="o in ehLabVisibleCardsForGroup(g)"', '@click.stop="ehLabOpenResultForm(o)"']) {
	assert((emrCreated + emrTemplate).includes(marker), 'LAB regression marker missing: ' + marker);
}
for (const marker of ['tsLgSections', 'v-model="tsLabDialog.visible"', 'tsRequestSensitive']) {
	assert((treatCreated + treatTemplate).includes(marker), 'Treat Summary LAB regression marker missing: ' + marker);
}

console.log('EMR X-ray result/history UI tests passed');
