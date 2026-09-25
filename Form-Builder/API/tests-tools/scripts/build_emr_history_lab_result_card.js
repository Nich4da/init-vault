#!/usr/bin/env node
'use strict';

/**
 * Build the two paste-ready `emr_view` component artifacts for EMR History.
 *
 * Source of truth:
 * - current decrypted EMR History export (the existing order card stays byte-for-byte)
 * - the verified Treat Summary LAB result card and LAB Worklist-style viewer
 *
 * This script intentionally does not rewrite an SDForm JSON or touch a live form.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../../..');
const EMR_HISTORY = path.join(ROOT, 'Form-Builder/SDForm/sdform_module/EMR_form/EMR_history.json');
const TREAT_TEMPLATE = path.join(ROOT, '02-his/form-factory/treat-summary-template-FULL-v1.html');
const TREAT_CREATED = path.join(ROOT, 'Form-Builder/API/form-factory/events/treat-summary-onCreated-FULL-v1.js');
const OUT_TEMPLATE = path.join(ROOT, '02-his/form-factory/emr-history-template-FULL-v1.html');
const OUT_CREATED = path.join(ROOT, 'Form-Builder/API/form-factory/events/emr-history-onCreated-FULL-v1.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const lines = (text) => text.replace(/\r\n/g, '\n').split('\n');
const lineSlice = (text, first, last) => lines(text).slice(first - 1, last).join('\n');
const indent = (text, spaces) => {
	const pad = ' '.repeat(spaces);
	return text.split('\n').map((line) => (line ? pad + line : line)).join('\n');
};
const dedent = (text, spaces) => {
	const prefix = ' '.repeat(spaces);
	return text.split('\n').map((line) => (line.startsWith(prefix) ? line.slice(spaces) : line)).join('\n');
};
const replaceOnce = (text, search, replacement, label) => {
	const first = text.indexOf(search);
	if (first < 0) throw new Error('Missing build marker: ' + label);
	if (text.indexOf(search, first + search.length) >= 0) throw new Error('Build marker is not unique: ' + label);
	return text.slice(0, first) + replacement + text.slice(first + search.length);
};
const adaptTs = (text) =>
	text
		.replace(/\bts/g, 'ehLab')
		.replace(/\bTS_/g, 'EH_LAB_')
		.replace(/\bEH_LAB_LAB_STATUS\b/g, 'EH_LAB_STATUS')
		.replace(/\bEH_LAB_PENDING\b/g, 'EH_LAB_PENDING')
		.replace(/\bLAB_RESULT_PDF_REPORT_ID\b/g, 'EH_LAB_RESULT_PDF_REPORT_ID')
		.replace(/\bMICRO_RESULT_PDF_REPORT_ID\b/g, 'EH_LAB_MICRO_RESULT_PDF_REPORT_ID')
		.replace(/\bMICRO_SECTIONS\b/g, 'EH_LAB_MICRO_SECTIONS');

const model = JSON.parse(read(EMR_HISTORY));
const widget = (Array.isArray(model.fields) ? model.fields : []).find(
	(field) => field && field.component === 'vue-ui' && field.options && field.options.name === 'emr_view',
);
if (!widget) throw new Error('Cannot find vue-ui `emr_view` in EMR History source');

const originalTemplate = String(widget.options.content || '').replace(/\r\n/g, '\n');
const originalCreated = String(widget.options.onCreated || '').replace(/\r\n/g, '\n');
const treatTemplate = read(TREAT_TEMPLATE);
const treatCreated = read(TREAT_CREATED);

// Keep the complete result-card markup that already passed the Treat Summary work.
let resultCard = lineSlice(treatTemplate, 139, 272);
resultCard = dedent(resultCard, 14);
resultCard = replaceOnce(resultCard, 'v-for="o in sec.list"', 'v-for="o in ehLabCardsForGroup(g)"', 'result-card loop');
resultCard = adaptTs(resultCard);

// Keep the complete LAB Worklist-style read-only result viewer.
let resultDialog = lineSlice(treatTemplate, 330, 405);
resultDialog = dedent(resultDialog, 10);
resultDialog = adaptTs(resultDialog);

const orderStartMarker = '        <div v-for="(g, gi) in ehGroups" :key="\'grp\' + gi"';
const orderTailMarker = '\n        </div>\n      </div>\n    </div>\n\n    <!-- ══ การเงิน';
const orderStart = originalTemplate.indexOf(orderStartMarker);
const orderTail = originalTemplate.indexOf(orderTailMarker, orderStart);
if (orderStart < 0 || orderTail < 0) throw new Error('Cannot isolate the existing EMR History order card');
const orderEnd = orderTail + '\n        </div>'.length;
const originalOrderCard = originalTemplate.slice(orderStart, orderEnd);
const orderLines = originalOrderCard.split('\n');
orderLines[0] = '          <div';
for (let index = 1; index < orderLines.length; index += 1) {
	if (orderLines[index]) orderLines[index] = '  ' + orderLines[index];
}

const labSiblings = [
	'          <!-- ผล Lab เป็นการ์ดคนละความหมายกับการ์ดสั่งตรวจ จึงวางเป็น sibling ต่อท้าย ไม่ซ้อนในกรอบเดิม -->',
	'          <div v-if="g.type === \'lab\' && ehLabLoading"',
	'            style="padding:10px 12px;border:1px dashed var(--el-border-color);border-radius:8px;background:var(--el-fill-color-blank);font-size:12px;color:var(--el-text-color-secondary)">',
	'            กำลังโหลดผล Lab…',
	'          </div>',
	'          <el-alert v-if="g.type === \'lab\' && ehLabError" :title="ehLabError" type="error" :closable="false" show-icon />',
	'          <div v-if="g.type === \'lab\' && !ehLabLoading && !ehLabError && !ehLabCardsForGroup(g).length"',
	'            style="padding:10px 12px;border:1px dashed var(--el-border-color);border-radius:8px;background:var(--el-fill-color-blank);font-size:12px;color:var(--el-text-color-placeholder)">',
	'            — ยังไม่พบข้อมูลติดตามผลของใบสั่ง Lab นี้ —',
	'          </div>',
	indent(resultCard, 10),
	'          <div v-if="g.type === \'lab\' && !ehLabLoading" style="text-align:right;margin-top:-4px">',
	'            <el-button text size="small" style="font-size:11px;height:22px;color:var(--el-text-color-secondary)" @click="ehLabReload()">โหลดใหม่</el-button>',
	'          </div>',
].join('\n');

const orderAndResult = [
	'        <template v-for="(g, gi) in ehGroups" :key="\'grp\' + gi">',
	orderLines.join('\n'),
	labSiblings,
	'        </template>',
].join('\n');

let builtTemplate = originalTemplate.slice(0, orderStart) + orderAndResult + originalTemplate.slice(orderEnd);
const rootClose = '\n  </template>\n</div>';
builtTemplate = replaceOnce(
	builtTemplate,
	rootClose,
	'\n  </template>\n\n  <!-- popup อ่านผลทั้งใบ: pattern เดียวกับ LAB Worklist / Treat Summary -->\n' + indent(resultDialog, 2) + '\n</div>',
	'root close for result dialog',
);

// Reuse the verified LAB mapping and viewer helpers, excluding trends and X-ray-only helpers.
let labCore = lineSlice(treatCreated, 263, 457);
labCore = adaptTs(labCore);
let labInteractions = [lineSlice(treatCreated, 546, 564), lineSlice(treatCreated, 582, 682)].join('\n\n');
labInteractions = adaptTs(labInteractions);
labInteractions = labInteractions.replace(/\ns\.ehLabLgSetMode = \(m\) => \{\n\ts\.ehLabLgUi\.mode = m;\n\};/, '');

const labExtension = `
/* ══ EMR History · LAB result sibling card ════════════════════════════════
 * แยกโหลดจาก emr-history-get และจับคู่ด้วย CPOE Order ID เท่านั้น:
 * item_groups[].items[].order_id === lab_orders[].source_order_id
 */
const EH_LAB_RESULT_PDF_REPORT_ID = '6aa8f5a8b92813319a86ea11';
const EH_LAB_MICRO_RESULT_PDF_REPORT_ID = '6ab1c2d3e4f5061728394a5b';
const EH_LAB_MICRO_SECTIONS = ['MB'];
const EH_LAB_STATUS = {
	draft: { label: 'ร่าง', type: 'info' },
	sent: { label: 'ส่งแล้ว', type: 'warning' },
	ready: { label: 'ready', type: 'warning' },
	accepted: { label: 'ห้องแลปรับแล้ว', type: 'warning' },
	collected: { label: 'เก็บสิ่งส่งตรวจแล้ว', type: 'warning' },
	in_process: { label: 'กำลังตรวจ', type: 'warning' },
	resulted: { label: 'มีผลแล้ว', type: 'success' },
	completed: { label: 'เสร็จสิ้น', type: 'success' },
	cancelled: { label: 'ยกเลิก', type: 'info' },
	rejected: { label: 'ปฏิเสธสิ่งส่งตรวจ', type: 'danger' },
};
const EH_LAB_PENDING = ['draft', 'sent', 'ready', 'prepared', 'accepted', 'collected', 'in_process'];

s.ehLabLoading = false;
s.ehLabError = '';
s.ehLabOrders = [];
s.ehLabHn = '';
s.ehLabOgOpen = {};
s.ehLabDialog = { visible: false, order: null };
s.ehLabResultGroupOpen = {};

${labCore}

${labInteractions}

s.ehLabReset = () => {
	s.ehLabLoading = false;
	s.ehLabError = '';
	s.ehLabOrders = [];
	s.ehLabHn = '';
	s.ehLabOgOpen = {};
	s.ehLabDialog = { visible: false, order: null };
	s.ehLabResultGroupOpen = {};
};

s.ehLabCardsForGroup = (group) => {
	if (!group || String(group.type || '').toLowerCase() !== 'lab') return [];
	const orderIds = {};
	(Array.isArray(group.items) ? group.items : []).forEach((item) => {
		const orderId = String((item && item.order_id) || '');
		if (orderId) orderIds[orderId] = true;
	});
	return s.ehLabOrders.filter((order) => order.source_order_id && orderIds[order.source_order_id]);
};

s.ehLabLoad = (visit) => {
	const form = field.getFormRef();
	if (!form) return;
	const visitId = String((visit && (visit.visit_id || visit.data_id)) || '');
	const hn = String((visit && hnOfVisit(visit)) || '');
	if (!visitId) {
		s.ehLabError = 'ไม่พบ visit_id สำหรับโหลดผล Lab';
		return;
	}
	s.ehLabLoading = true;
	s.ehLabError = '';
	s.ehLabOrders = [];
	s.ehLabHn = hn;
	s.ehLabOgOpen = {};
	form.userState.runProcess(
		EH_LAB_BOARD_PROC,
		{ visit_id: visitId, hn: hn || null },
		(res) => {
			const data = (res && res.data) || {};
			s.ehLabLoading = false;
			if (data.success === false) {
				s.ehLabError = data.message || 'อ่านผล Lab ไม่สำเร็จ';
				return;
			}
			const orders = (Array.isArray(data.lab_orders) ? data.lab_orders : [])
				.filter((raw) => String((raw && raw.scope) || 'visit') !== 'today')
				.map(ehLabMkOrder)
				.filter(Boolean);
			s.ehLabOrders = orders;
			const opened = {};
			orders.forEach((order) => {
				if (order.criticals.length) opened[order.key] = true;
			});
			s.ehLabOgOpen = opened;
		},
		(err) => {
			s.ehLabLoading = false;
			s.ehLabError = 'อ่านผล Lab ไม่สำเร็จ: ' + ((err && err.message) || err);
		},
	);
};

s.ehLabReload = () => {
	if (s.ehVisit) s.ehLabLoad(s.ehVisit);
};
`;

let builtCreated = replaceOnce(
	originalCreated,
	"const HISTORY_PROC = '6a9662a75723cd050ea497e0'; // emr-history-get (generator เติมให้ตอน build model)",
	"const HISTORY_PROC = '6a9662a75723cd050ea497e0'; // emr-history-get — คงเดิม\nconst EH_LAB_BOARD_PROC = '6ab3be31cec3020e8562a2c9'; // emr-lab-board-get — โหลดแยกจาก history\nconst hnOfVisit = (visit) => String((visit && (visit.hn || (visit.person && visit.person.hn))) || '');",
	'process constants',
);
builtCreated = replaceOnce(
	builtCreated,
	"\ts.ehLoading = true;\n\ts.ehErr = '';\n\t// สลับใบ = ล้างของเดิมก่อน ไม่งั้นระหว่างโหลดจอโชว์ข้อมูลคนละ visit ปนกัน",
	"\ts.ehLoading = true;\n\ts.ehErr = '';\n\tif (s.ehLabReset) s.ehLabReset();\n\t// สลับใบ = ล้างของเดิมก่อน ไม่งั้นระหว่างโหลดจอโชว์ข้อมูลคนละ visit ปนกัน",
	'reset LAB state on visit switch',
);
builtCreated = replaceOnce(
	builtCreated,
	"\t\t\ts.ehMeta = d.meta || null;\n\t\t\ts.ehReady = true;",
	"\t\t\ts.ehMeta = d.meta || null;\n\t\t\ts.ehReady = true;\n\t\t\tif (s.ehGroups.some((group) => String(group.type || '').toLowerCase() === 'lab')) s.ehLabLoad(s.ehVisit);",
	'load LAB result sibling after history',
);
builtCreated = builtCreated.trimEnd() + '\n\n' + labExtension.trim() + '\n';

// Preserve the exact order card content (apart from the loop moving to an outer template).
if (!builtTemplate.includes('ผล Lab เป็นการ์ดคนละความหมายกับการ์ดสั่งตรวจ')) throw new Error('LAB sibling marker missing');
if (!builtTemplate.includes('v-for="o in ehLabCardsForGroup(g)"')) throw new Error('LAB card loop missing');
// Names that already contained "Lab" in Treat Summary would otherwise receive it twice.
builtTemplate = builtTemplate.replace(/ehLabLabDialog/g, 'ehLabDialog');
builtCreated = builtCreated.replace(/ehLabLabDialog/g, 'ehLabDialog');
// Same normalization for helpers whose original names already contain the Lab prefix.
builtTemplate = builtTemplate.replace(/ehLabLabFlag/g, 'ehLabFlag').replace(/ehLabLabFile/g, 'ehLabFile');
builtCreated = builtCreated.replace(/ehLabLabFlag/g, 'ehLabFlag').replace(/ehLabLabFile/g, 'ehLabFile');

// Add the CPOE Order identity needed by the exact join; Treat Summary did not need to expose it.
builtCreated = replaceOnce(
	builtCreated,
	"\t\tkey: String(raw.order_id || raw.order_no || Math.random()),\n\t\tscope: scope,",
	"\t\tkey: String(raw.order_id || raw.order_no || Math.random()),\n\t\tsource_order_id: String(raw.source_order_id || ''),\n\t\tscope: scope,",
	'LAB source_order_id mapping',
);

fs.mkdirSync(path.dirname(OUT_TEMPLATE), { recursive: true });
fs.mkdirSync(path.dirname(OUT_CREATED), { recursive: true });
fs.writeFileSync(OUT_TEMPLATE, builtTemplate.endsWith('\n') ? builtTemplate : builtTemplate + '\n');
fs.writeFileSync(OUT_CREATED, builtCreated);

console.log(path.relative(ROOT, OUT_TEMPLATE));
console.log(path.relative(ROOT, OUT_CREATED));
