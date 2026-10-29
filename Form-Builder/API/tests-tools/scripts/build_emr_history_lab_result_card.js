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
const OUT_TEMPLATE_TEXT = path.join(ROOT, '02-his/form-factory/emr-history-template-FULL-v1.txt');
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

// Keep the complete result-card markup that already passed the Treat Summary
// work. Semantic markers avoid silently truncating its footer/actions.
const resultCardStart = treatTemplate.indexOf('              <div v-for="o in sec.list"');
const resultCardEnd = treatTemplate.indexOf('\n            </div>\n          </template>\n\n          <!-- โหลดใหม่', resultCardStart);
if (resultCardStart < 0 || resultCardEnd < 0) throw new Error('Cannot isolate the Treat Summary LAB result card');
let resultCard = dedent(treatTemplate.slice(resultCardStart, resultCardEnd), 14);
resultCard = replaceOnce(resultCard, 'v-for="o in sec.list"', 'v-for="o in ehLabCardsForGroup(g)"', 'result-card loop');
resultCard = adaptTs(resultCard);
resultCard = replaceOnce(
	resultCard,
	'    <template v-else>\n      <div v-for="(r, ri) in o.locked_rows"',
	`    <template v-else>
      <div v-for="(r, ri) in o.hidden_rows" :key="'hidden' + ri" style="display:flex;align-items:center;gap:8px;margin:6px 0;padding:9px 10px;border:1px solid var(--el-color-danger-light-5);border-radius:7px;background:var(--el-color-danger-light-9)">
        <span style="flex:1;min-width:0">
          <strong style="display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ r.name }}</strong>
          <small v-if="r.code" style="display:block;margin-top:2px;color:var(--el-text-color-secondary)">{{ r.code }}</small>
        </span>
        <strong style="color:var(--el-color-danger);font-size:11px">ปกปิดผล</strong>
      </div>
      <div v-for="(r, ri) in o.locked_rows"`,
	'EMR manual-hidden result card row',
);
// Microbiology is reviewed at CPOE Item level in LAB. Mirror that navigation
// in EMR: show one row/button per ordered Item and open only that Item's raw
// MLab result. The standard LAB summary card remains unchanged in v-else.
resultCard = replaceOnce(
	resultCard,
	'    <div v-if="o.lab_no" style="padding:7px 0 1px;font-size:10px;color:var(--el-text-color-placeholder)">LAB NO. {{ o.lab_no }}</div>',
	`    <template v-if="o.micro">
        <div v-if="o.lab_no" style="padding:9px 3px 6px;font-size:11px;color:var(--el-text-color-secondary)">LAB NO. {{ o.lab_no }}</div>
        <div style="overflow:hidden;border:1px solid var(--el-border-color-light);border-radius:7px;background:var(--el-bg-color)">
          <div v-for="(item, itemIndex) in ehLabMicroItems(o)" :key="item.item_id || item.group_key || itemIndex" style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 12px;border-top:1px dashed var(--el-border-color-light)">
            <span style="min-width:0"><strong style="display:block;color:var(--el-text-color-primary);font-size:13px;line-height:1.4;overflow-wrap:anywhere">{{ item.item_name || '-' }}</strong><small style="display:block;margin-top:2px;color:var(--el-text-color-secondary);font-size:11px">{{ item.item_code || '-' }}</small></span>
            <span style="display:flex;align-items:center;gap:8px"><strong v-if="!item.has_result" style="color:var(--el-text-color-secondary);font-size:12px">ไม่มีผล</strong><el-button v-else type="danger" size="small" @click.stop="ehLabOpenMicroItem(o, item)">ดูผล</el-button></span>
          </div>
        </div>
      </template>
    <template v-else>
      <div v-if="o.lab_no" style="padding:7px 0 1px;font-size:10px;color:var(--el-text-color-placeholder)">LAB NO. {{ o.lab_no }}</div>`,
	'MLab item-level card list',
);
resultCard = replaceOnce(
	resultCard,
	'      <div v-if="o.report_hint" style="margin-top:4px;font-size:10px;line-height:1.45;color:var(--el-text-color-placeholder)">{{ o.report_hint }}</div>\n    </template>\n\n  </div>',
	'      <div v-if="o.report_hint" style="margin-top:4px;font-size:10px;line-height:1.45;color:var(--el-text-color-placeholder)">{{ o.report_hint }}</div>\n    </template>\n      </template>\n\n  </div>',
	'MLab item-level card branch close',
);

// EMR History uses the user-confirmed compact Order result sheet instead of
// the expandable Treat Summary card. One bordered sub-card is one LAB Order;
// no Order/LAB No./room/status header is repeated inside the card. MB is a
// special two-column raw-text presentation and intentionally gives the result
// the whole remaining horizontal width.
resultCard = `<section v-if="g.type === 'lab' && !ehLabLoading && !ehLabError" style="overflow:hidden;border:1px solid var(--el-border-color-light);border-radius:8px;background:var(--el-bg-color)">
  <div style="padding:12px 14px;border-bottom:1px solid var(--el-border-color-lighter);background:var(--el-fill-color-lighter)">
    <small style="display:block;margin-bottom:7px;color:var(--el-text-color-secondary);font-size:10.5px;font-weight:700">ผลตรวจ lab</small>
    <div style="display:flex;flex-wrap:wrap;gap:6px;min-width:0;padding:1px 1px 4px">
      <el-button v-for="room in ehLabRooms" :key="room.code" size="small" :type="ehLabRoom===room.code?'primary':''" :plain="ehLabRoom!==room.code" style="flex:none;margin-left:0" @click.stop="ehLabSetRoom(room.code)">
        {{ room.label }} <span style="display:inline-flex;min-width:18px;height:18px;align-items:center;justify-content:center;margin-left:4px;padding:0 5px;border-radius:9px;background:rgba(144,147,153,.12);font-size:9px">{{ ehLabRoomCount(g, room.code) }}</span>
      </el-button>
    </div>
  </div>

  <div style="padding:12px 14px 16px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:7px;color:var(--el-text-color-secondary);font-size:10.5px">
      <span><strong style="color:var(--el-text-color-regular)">{{ ehLabRoomLabel(ehLabRoom) }}</strong> · {{ ehLabVisibleCardsForGroup(g).length }} Order</span>
      <span style="text-align:right">IM / MI-OUT ยังปกปิดผล Sensitive จนกว่าจะยืนยันตัวตน</span>
    </div>

    <div style="min-width:0;overflow:hidden">
      <div v-if="ehLabRoom==='MB'" style="display:grid;grid-template-columns:minmax(180px,240px) minmax(0,1fr);column-gap:14px;min-width:0;padding:8px 13px;border:1px solid var(--el-border-color-light);border-radius:7px 7px 0 0;background:var(--el-fill-color-light);color:var(--el-text-color-secondary);font-size:10px;font-weight:700">
        <span>รายการตรวจ</span><span>ผล LAB</span>
      </div>
      <div v-else style="display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1.2fr) minmax(48px,.55fr) minmax(64px,.8fr) minmax(54px,.62fr);column-gap:8px;min-width:0;padding:8px 10px;border:1px solid var(--el-border-color-light);border-radius:7px 7px 0 0;background:var(--el-fill-color-light);color:var(--el-text-color-secondary);font-size:10px;font-weight:700">
        <span>รายการตรวจ</span><span>ผล LAB</span><span>หน่วย</span><span>Ref. Range</span><span>แปลผล</span>
      </div>

      <div style="display:grid;gap:9px;min-width:0;padding-top:9px">
        <article v-for="o in ehLabVisibleCardsForGroup(g)" :key="o.key" style="position:relative;overflow:hidden;border:1px solid var(--el-border-color-light);border-radius:8px;background:var(--el-bg-color);box-shadow:0 1px 2px rgba(31,35,41,.04)">
          <span :style="{position:'absolute',inset:'0 auto 0 0',width:'3px',background:o.criticals.length?'var(--el-color-danger)':(o.abnormals.length?'var(--el-color-warning)':'var(--el-border-color)')}"></span>

          <template v-if="o.micro">
            <div v-for="(r,rowIndex) in ehLabCardRows(o)" :key="r.result_item_id || r.code || rowIndex" style="display:grid;grid-template-columns:minmax(180px,240px) minmax(0,1fr);column-gap:14px;min-height:74px;align-items:start;padding:11px 13px 11px 16px;border-top:1px dashed var(--el-border-color-lighter)">
              <strong style="min-width:0;color:var(--el-text-color-primary);font-size:12.5px;line-height:1.45;overflow-wrap:anywhere">{{ r.name || '-' }}</strong>
              <div style="min-width:0;width:100%">
                <template v-if="r.locked">
                  <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap"><el-tag size="small" type="warning" effect="plain">ปกปิดผล Sensitive</el-tag><el-button v-if="r.reauth_required" size="small" type="warning" plain @click.stop="ehLabRequestSensitive(o,r)">ยืนยันตัวตนเพื่อดู</el-button></div>
                </template>
                <strong v-else-if="r.redacted" style="color:var(--el-color-danger);font-size:11.5px">ปกปิดผล</strong>
                <pre v-else style="width:100%;max-width:none;margin:0;color:var(--el-text-color-regular);font:12px/1.65 'Noto Sans Thai','Leelawadee UI',Tahoma,Arial,sans-serif;white-space:pre-wrap;overflow-wrap:anywhere">{{ r.value || '—' }}</pre>
              </div>
            </div>
          </template>

          <template v-else>
            <div v-for="(r,rowIndex) in ehLabCardRows(o)" :key="r.result_item_id || r.code || rowIndex" style="display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1.2fr) minmax(48px,.55fr) minmax(64px,.8fr) minmax(54px,.62fr);column-gap:8px;min-width:0;min-height:54px;align-items:start;padding:10px 10px 10px 16px;border-top:1px dashed var(--el-border-color-lighter)">
              <strong style="min-width:0;color:var(--el-text-color-primary);font-size:12.5px;line-height:1.45;overflow-wrap:anywhere">{{ r.name || '-' }}</strong>
              <div style="min-width:0">
                <template v-if="r.locked"><div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap"><el-tag size="small" type="warning" effect="plain">ปกปิดผล Sensitive</el-tag><el-button v-if="r.reauth_required" size="small" type="warning" plain @click.stop="ehLabRequestSensitive(o,r)">ยืนยันตัวตนเพื่อดู</el-button></div></template>
                <strong v-else :style="ehLabCardValueStyle(r)" style="font-size:13px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere">{{ r.redacted ? 'ปกปิดผล' : (r.value || '—') }}</strong>
              </div>
              <span style="min-width:0;font-size:11.5px">{{ r.locked || r.redacted ? '—' : (r.unit || '—') }}</span>
              <span style="min-width:0;font-size:11.5px;white-space:pre-wrap;overflow-wrap:anywhere">{{ r.locked || r.redacted ? '—' : (r.ref || '—') }}</span>
              <span style="min-width:0"><el-tag v-if="!r.locked && !r.redacted" size="small" :type="ehLabCardFlagType(r)" effect="plain">{{ ehLabFlagLabel(r) }}</el-tag><span v-else>—</span></span>
            </div>
          </template>

          <div v-if="!ehLabCardRows(o).length" style="padding:22px 16px;color:var(--el-text-color-placeholder);text-align:center">ยังไม่มีผล LAB ใน Order นี้</div>
          <div style="display:flex;justify-content:flex-end;gap:6px;padding:7px 10px 8px;border-top:1px solid var(--el-border-color-lighter);background:var(--el-fill-color-lighter)" @click.stop>
            <sd-report v-if="o.report_ready && !o.has_sensitive" :key="ehLabReportInstanceKey(o,'card')" :report-list="o.report_list" :params="o.report_params" size="small" />
            <el-button v-else-if="o.report_ready" size="small" @click.stop="ehLabRequestSensitivePdf(o,'card')">PDF</el-button>
            <span v-if="o.report_ready && o.has_sensitive && ehLabPdfGrantReady(o,'card')" :id="ehLabPdfHostId(o,'card')" style="display:none"><sd-report :key="ehLabPdfReportInstanceKey(o,'card')" :report-list="o.report_list" :params="ehLabPdfParams(o,'card')" size="small" /></span>
            <el-button v-if="!o.report_ready" size="small" disabled :title="o.report_hint || 'ยังไม่มี Result Report'">PDF</el-button>
            <el-button size="small" :disabled="!ehLabOrderTarget(o)" @click.stop="ehLabOpenResultForm(o)">ดูผลทั้งใบ</el-button>
          </div>
        </article>
      </div>
    </div>
  </div>
</section>`;

// Keep the complete LAB Worklist-style read-only result viewer. Use semantic
// markers because the Treat Summary template gains lines independently.
const resultDialogStart = treatTemplate.indexOf('          <el-dialog v-model="tsLabDialog.visible"');
const resultDialogEnd = treatTemplate.indexOf('\n\n      </el-tab-pane>', resultDialogStart);
if (resultDialogStart < 0 || resultDialogEnd < 0) throw new Error('Cannot isolate the Treat Summary LAB result dialogs');
let resultDialog = dedent(treatTemplate.slice(resultDialogStart, resultDialogEnd), 10);
resultDialog = adaptTs(resultDialog);
resultDialog = resultDialog.replace(/ehLabLabDialog/g, 'ehLabDialog').replace(/ehLabLabFlag/g, 'ehLabFlag').replace(/ehLabLabFile/g, 'ehLabFile');
const reauthDialogStart = resultDialog.indexOf('<el-dialog v-model="ehLabReauth.visible"');
if (reauthDialogStart < 0) throw new Error('Cannot isolate the LAB Sensitive re-auth dialog');
const reauthDialog = resultDialog.slice(reauthDialogStart);

// EMR History receives the same raw MLab result text as LAB Worklist, but its
// normalized row shape is intentionally different. Keep the standard LAB
// viewer byte-for-byte inside the v-else branch and add an MB-only read-only
// presentation which never parses or reclassifies the raw result text.
const microResultBody = `
<div v-if="ehLabDialog.order" class="lab-micro-result-viewer" style="display:grid;gap:14px;max-height:calc(100vh - 230px);min-height:300px;overflow-y:auto;padding-right:4px;color:var(--el-text-color-regular)">
  <section style="display:grid;grid-template-columns:minmax(220px,1.5fr) repeat(4,minmax(120px,1fr));gap:1px;overflow:hidden;border:1px solid var(--el-border-color);border-radius:9px;background:var(--el-border-color)">
    <div style="padding:11px 13px;background:var(--el-bg-color)"><small style="display:block;color:var(--el-text-color-secondary)">ผู้ป่วย</small><strong style="display:block;margin-top:3px;color:var(--el-text-color-primary)">{{ ehLabMicroPatientName() || '-' }}</strong></div>
    <div style="padding:11px 13px;background:var(--el-bg-color)"><small style="display:block;color:var(--el-text-color-secondary)">HN</small><strong class="lab-mono" style="display:block;margin-top:3px">{{ ehLabDialog.order.patient_hn || ehLabHn || '-' }}</strong></div>
    <div style="padding:11px 13px;background:var(--el-bg-color)"><small style="display:block;color:var(--el-text-color-secondary)">LAB NO.</small><strong class="lab-mono" style="display:block;margin-top:3px">{{ ehLabDialog.order.lab_no || '-' }}</strong></div>
    <div style="padding:11px 13px;background:var(--el-bg-color)"><small style="display:block;color:var(--el-text-color-secondary)">สิ่งส่งตรวจ</small><strong style="display:block;margin-top:3px">{{ ehLabMicroSpecimenName() || '-' }}</strong></div>
    <div style="padding:11px 13px;background:var(--el-bg-color)"><small style="display:block;color:var(--el-text-color-secondary)">สถานะรวม</small><strong :style="ehLabMicroOverallStatusStyle()" style="display:inline-flex;margin-top:3px;padding:2px 8px;border:1px solid;border-radius:999px">{{ ehLabMicroOverallStatusText() }}</strong></div>
  </section>

  <el-alert v-if="ehLabResultCriticalCount()" type="error" :closable="false" show-icon :title="'พบผลวิกฤติ ' + ehLabResultCriticalCount() + ' รายการ'" />

  <section style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">
    <div style="padding:10px 12px;border:1px solid var(--el-border-color-light);border-radius:8px;background:var(--el-fill-color-blank)"><small style="display:block;color:var(--el-text-color-secondary)">เก็บสิ่งส่งตรวจ</small><strong class="lab-mono" style="display:block;margin-top:3px">{{ ehLabCompactDateTime(ehLabMicroCollectedAt()) || '-' }}</strong></div>
    <div style="padding:10px 12px;border:1px solid var(--el-border-color-light);border-radius:8px;background:var(--el-fill-color-blank)"><small style="display:block;color:var(--el-text-color-secondary)">ห้องแลปรับ</small><strong class="lab-mono" style="display:block;margin-top:3px">{{ ehLabCompactDateTime(ehLabDialog.order.received_at) || '-' }}</strong></div>
    <div style="padding:10px 12px;border:1px solid var(--el-border-color-light);border-radius:8px;background:var(--el-fill-color-blank)"><small style="display:block;color:var(--el-text-color-secondary)">ออกผลล่าสุด</small><strong class="lab-mono" style="display:block;margin-top:3px">{{ ehLabCompactDateTime(ehLabMicroLatestReportedAt()) || '-' }}</strong></div>
  </section>

  <section>
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:9px"><strong style="font-size:16px">รายการตรวจ</strong><small style="color:var(--el-text-color-secondary)">{{ ehLabMicroResultCountText() }}</small></div>
    <div style="display:grid;gap:12px">
      <article v-for="(group, groupIndex) in ehLabMicroGroupsForDisplay()" :key="ehLabMicroGroupKey(group, groupIndex)" style="overflow:hidden;border:1px solid #79bbff;border-radius:10px;background:#ecf5ff">
        <header style="display:grid;grid-template-columns:48px minmax(220px,1fr) minmax(150px,auto) auto;gap:12px;align-items:center;padding:14px 16px;border-bottom:1px solid #a0cfff">
          <span class="lab-mono" style="color:var(--el-text-color-secondary);font-size:14px">{{ String(groupIndex + 1).padStart(2, '0') }}</span>
          <span style="min-width:0"><strong style="display:block;color:var(--el-text-color-primary);font-size:15px;overflow-wrap:anywhere">{{ group.test_name || '-' }}</strong><small style="display:block;margin-top:2px;color:var(--el-text-color-secondary)">รหัสรายการ HIS {{ group.test_code || '-' }}</small></span>
          <span><small style="display:block;color:var(--el-text-color-secondary)">เวลารายงาน</small><strong class="lab-mono" style="display:block;margin-top:2px">{{ ehLabCompactDateTime(ehLabMicroGroupReportedAt(group)) || '-' }}</strong></span>
          <span :style="ehLabMicroGroupStatusStyle(group)" style="display:inline-flex;padding:3px 9px;border:1px solid;border-radius:999px;font-size:11px;font-weight:700">{{ ehLabMicroGroupStatusText(group) }}</span>
        </header>
        <div v-if="ehLabMicroGroupHasResult(group)" style="display:grid;gap:10px;padding:14px 16px;background:var(--el-bg-color)">
          <section v-for="(r, rowIndex) in ehLabMicroResultRows(group)" :key="r.result_item_id || r.code || rowIndex" style="overflow:hidden;border:1px solid var(--el-border-color-light);border-radius:8px;background:var(--el-fill-color-blank)">
            <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--el-border-color-light)">
              <span style="padding:9px 11px;background:var(--el-bg-color)"><small style="display:block;color:var(--el-text-color-secondary)">รหัสผลที่บันทึกใน HIS</small><strong class="lab-mono" style="display:block;margin-top:2px">{{ r.code || '-' }}</strong></span>
              <span style="padding:9px 11px;background:var(--el-bg-color)"><small style="display:block;color:var(--el-text-color-secondary)">ชื่อ/รหัสที่มากับผล</small><strong style="display:block;margin-top:2px;overflow-wrap:anywhere">{{ r.name || group.test_name || '-' }}</strong></span>
              <span style="padding:9px 11px;background:var(--el-bg-color)"><small style="display:block;color:var(--el-text-color-secondary)">สถานะผล</small><strong style="display:block;margin-top:2px">{{ r.status || '-' }}</strong></span>
              <span style="padding:9px 11px;background:var(--el-bg-color)"><small style="display:block;color:var(--el-text-color-secondary)">เวลารายงาน</small><strong class="lab-mono" style="display:block;margin-top:2px">{{ ehLabCompactDateTime(r.reported_at) || '-' }}</strong></span>
            </div>
            <div style="padding:13px 16px;background:var(--el-bg-color)">
              <strong style="display:block;margin-bottom:9px;color:var(--el-text-color-primary)">ผลจาก MLab</strong>
              <pre style="margin:0;min-height:72px;overflow:auto;color:var(--el-text-color-regular);font:13px/1.75 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere">{{ r.value }}</pre>
              <p v-if="r.comment" style="margin:10px 0 0;padding-top:9px;border-top:1px dashed var(--el-border-color);white-space:pre-wrap;overflow-wrap:anywhere">{{ r.comment }}</p>
              <div v-if="ehLabPreviousValues(r).length" style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:12px;padding:10px 12px;border:1px solid #a0cfff;border-radius:8px;background:#ecf5ff">
                <span style="min-width:0"><strong style="display:block;color:#337ecc;font-size:12px">มีผลย้อนหลัง {{ ehLabPreviousValues(r).length }} ครั้ง</strong><small style="display:block;margin-top:2px;color:var(--el-text-color-secondary)">ข้อความจาก Agent แบบเต็ม · ล่าสุด → เก่าสุด</small></span>
                <el-button type="primary" plain size="small" @click.stop="ehLabOpenMbHistory(r)">ดูผลย้อนหลัง</el-button>
              </div>
              <div v-else style="margin-top:12px;padding:9px 12px;border:1px dashed var(--el-border-color);border-radius:8px;color:var(--el-text-color-placeholder);font-size:11px;text-align:center">ยังไม่มีประวัติของรายการนี้</div>
            </div>
          </section>
        </div>
        <div v-else style="padding:26px 16px;background:var(--el-bg-color);color:var(--el-text-color-placeholder);text-align:center">รอผลจาก MLab</div>
      </article>
    </div>
  </section>

  <section id="eh-lab-result-attachments" class="lab-result-attachments" style="display:grid;gap:10px;margin-top:2px;padding:10px 12px;border:1px solid var(--el-border-color-light);border-radius:7px;background:#f7f9fc">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px"><div style="display:grid;gap:3px"><strong style="font-size:13px">ไฟล์แนบผลตรวจ</strong><small style="color:var(--el-text-color-secondary);font-size:10px">ไฟล์จากห้องปฏิบัติการ · อ่านอย่างเดียวใน EMR</small></div><span style="color:var(--el-text-color-secondary);font-size:11px">{{ ehLabAttachmentCount() }}</span></div>
    <div v-if="ehLabAttachmentCount()" style="display:grid;gap:6px"><a v-for="(file, fi) in ehLabDialog.order.attachments" :key="'lab-micro-file-' + fi" :href="ehLabFileUrl(file)" target="_blank" rel="noopener" style="display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--el-border-color-light);border-radius:6px;background:var(--el-bg-color);color:var(--el-text-color-regular);text-decoration:none"><span style="color:#337ecc;font-size:10px;font-weight:700">ดูไฟล์</span><strong style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ ehLabFileName(file) }}</strong><small style="color:var(--el-text-color-secondary);font-size:10px">{{ ehLabFileSize(file) }}</small></a></div>
    <div v-else style="padding:8px 10px;border:1px dashed var(--el-border-color);border-radius:6px;color:var(--el-text-color-placeholder);font-size:11px;text-align:center">ไม่มีไฟล์แนบผลตรวจ</div>
  </section>
</div>`;

const mbHistoryOverlay = `<!-- MB only: raw Agent history stays inside this doctor popup. It is an
     inline child overlay (not a teleported nested el-dialog), so closing it
     preserves the parent popup, scroll position, and selected MLab Item. -->
<div v-if="ehLabMbHistory.visible && ehLabMbHistory.row" tabindex="-1" @vue:mounted="$event.el.focus()" @keydown.esc.stop="ehLabCloseMbHistory()"
  style="position:fixed;inset:0;z-index:3200;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(31,41,55,.58);outline:none">
  <section role="dialog" aria-modal="true" aria-label="ผลย้อนหลังจาก Agent" style="display:flex;width:min(900px,calc(100vw - 48px));max-height:calc(100vh - 64px);flex-direction:column;overflow:hidden;border:1px solid var(--el-border-color);border-radius:12px;background:var(--el-bg-color);box-shadow:0 18px 55px rgba(15,23,42,.28)">
    <header style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 18px;border-bottom:1px solid var(--el-border-color-light)">
      <span style="min-width:0"><strong style="display:block;color:var(--el-text-color-primary);font-size:17px">ผลย้อนหลัง · {{ ehLabMbHistory.row.code || '-' }} {{ ehLabMbHistory.row.name || '' }}</strong><small style="display:block;margin-top:4px;color:var(--el-text-color-secondary)">{{ ehLabPreviousValues(ehLabMbHistory.row).length }} ครั้งล่าสุดก่อนผลปัจจุบัน · ข้อความ raw จาก Agent โดยไม่ตัดหรือแปลงโครงสร้าง</small></span>
      <el-button circle size="small" aria-label="ปิดผลย้อนหลัง" @click="ehLabCloseMbHistory()">×</el-button>
    </header>
    <div style="display:grid;gap:10px;overflow-y:auto;padding:14px 18px;background:var(--el-fill-color-lighter)">
      <article v-for="(previous, previousIndex) in ehLabPreviousValues(ehLabMbHistory.row)" :key="(previous.visit_vn || '') + '|' + (previous.lab_no || '') + '|' + previousIndex" style="overflow:hidden;border:1px solid var(--el-border-color-light);border-radius:8px;background:var(--el-bg-color)">
        <header style="display:flex;align-items:center;gap:8px 14px;flex-wrap:wrap;padding:9px 12px;border-bottom:1px solid var(--el-border-color-light);background:var(--el-fill-color-light);font-size:10.5px"><b style="color:var(--el-color-primary)">ครั้งที่ {{ previousIndex + 1 }}<template v-if="previousIndex===0"> · ล่าสุด</template></b><strong class="lab-mono">{{ ehLabCompactDateTime(previous.when) || '-' }}</strong><strong v-if="previous.lab_no" class="lab-mono">LAB {{ previous.lab_no }}</strong><span style="margin-left:auto;padding:2px 7px;border:1px solid var(--el-border-color);border-radius:999px;color:var(--el-text-color-secondary)">ข้อความจาก Agent</span></header>
        <pre style="margin:0;min-height:78px;overflow:auto;padding:13px 15px;color:var(--el-text-color-regular);font:12.5px/1.75 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere">{{ previous.value }}</pre>
      </article>
    </div>
    <footer style="display:flex;justify-content:flex-end;padding:11px 18px;border-top:1px solid var(--el-border-color-light)"><el-button @click="ehLabCloseMbHistory()">ปิดผลย้อนหลัง</el-button></footer>
  </section>
</div>`;

resultDialog = replaceOnce(
	resultDialog,
	'<el-dialog v-model="ehLabDialog.visible" class="lab-result-dialog" width="min(1320px,calc(100vw - 48px))"',
	'<el-dialog v-model="ehLabDialog.visible" class="lab-result-dialog" :class="{\'is-microbiology\':ehLabIsMicrobiologyDialog()}" :width="ehLabIsMicrobiologyDialog() ? \'min(1180px,calc(100vw - 32px))\' : \'min(1320px,calc(100vw - 48px))\'"',
	'microbiology dialog class and width',
);
resultDialog = replaceOnce(
	resultDialog,
	'<strong style="color:var(--el-text-color-primary);font-size:20px;line-height:1.25">ผลตรวจทางห้องปฏิบัติการ</strong>',
	'<strong style="color:var(--el-text-color-primary);font-size:20px;line-height:1.25">ผลตรวจทางห้องปฏิบัติการ</strong>\n          <span v-if="ehLabIsMicrobiologyDialog()" style="display:inline-flex;min-height:23px;align-items:center;padding:2px 8px;border:1px solid #a0cfff;border-radius:999px;background:#ecf5ff;color:#337ecc;font-size:10px;font-weight:700">จุลชีววิทยา · MLab</span>',
	'microbiology header tag',
);
resultDialog = replaceOnce(resultDialog, "{{ r.previous && r.previous.value || '-' }}", "{{ r.redacted ? '-' : (r.previous && r.previous.value || '-') }}", 'redacted previous result');
resultDialog = replaceOnce(resultDialog, "{{ r.value || 'รอผล' }}", "{{ r.redacted ? 'ปกปิดผล' : (r.value || 'รอผล') }}", 'redacted measured result');
resultDialog = replaceOnce(resultDialog, "{{ r.unit || '-' }}", "{{ r.redacted ? '-' : (r.unit || '-') }}", 'redacted result unit');
resultDialog = replaceOnce(
	resultDialog,
	'<span class="lab-result-interpretation" :class="ehLabResultInterpretationClass(r)" :style="ehLabResultInterpretationStyle(r)">{{ ehLabFlagLabel(r) }}</span>',
	'<span v-if="!r.redacted" class="lab-result-interpretation" :class="ehLabResultInterpretationClass(r)" :style="ehLabResultInterpretationStyle(r)">{{ ehLabFlagLabel(r) }}</span><span v-else>-</span>',
	'redacted result interpretation',
);
resultDialog = replaceOnce(resultDialog, "{{ r.ref || '-' }}", "{{ r.redacted ? '-' : (r.ref || '-') }}", 'redacted reference range');
resultDialog = replaceOnce(resultDialog, '<div v-if="r.comment" class="lab-result-comment"', '<div v-if="r.comment && !r.redacted" class="lab-result-comment"', 'redacted result comment');
resultDialog = replaceOnce(resultDialog, '<section class="lab-result-attachments"', '<section id="eh-lab-result-attachments" class="lab-result-attachments"', 'EMR attachment section anchor');
resultDialog = resultDialog.replace('สูงสุด 3 ไฟล์', 'สูงสุด 10 ไฟล์').replace('{{ ehLabDialog.order.attachments.length }}/3', '{{ ehLabDialog.order.attachments.length }}/10');
// Doctor-only history layout confirmed from the standalone HTML prototype.
// The Treat Summary card/template is a source only; these replacements are
// applied exclusively to the EMR History full-result dialog.
resultDialog = replaceOnce(
	resultDialog,
	'<div class="lab-result-value-head" style="display:grid;grid-template-columns:44px 34px minmax(230px,1.5fr) 125px 130px 92px 115px 145px;min-width:920px;min-height:42px;align-items:center;background:#f5f7fa;color:var(--el-text-color-secondary);font-size:11px;font-weight:700">\n        <span style="padding:10px">#</span><span></span><span style="padding:10px">รายการ</span><span style="padding:10px">ค่าก่อนหน้า</span><span style="padding:10px">ค่าที่ตรวจได้</span><span style="padding:10px">หน่วย</span><span style="padding:10px">แปลผล</span><span style="padding:10px">ค่าปกติ</span>',
	'<div class="lab-result-value-head" style="display:grid;grid-template-columns:44px 34px minmax(230px,1.25fr) minmax(130px,.75fr) 92px 115px minmax(460px,2fr);min-width:1180px;min-height:42px;align-items:center;background:#f5f7fa;color:var(--el-text-color-secondary);font-size:11px;font-weight:700">\n        <span style="padding:10px">#</span><span></span><span style="padding:10px">รายการ</span><span style="padding:10px">ค่าปัจจุบัน</span><span style="padding:10px">หน่วย</span><span style="padding:10px">แปลผล</span><span style="padding:10px">ค่าก่อนหน้า 1–5 ครั้ง <span style="font-weight:400">(ล่าสุด → เก่าสุด)</span></span>',
	'doctor previous-five header',
);
resultDialog = replaceOnce(resultDialog, 'grid-template-columns:32px minmax(260px,1fr) 28px;gap:10px;min-width:920px', 'grid-template-columns:32px minmax(260px,1fr) 28px;gap:10px;min-width:1180px', 'doctor profile width');
resultDialog = replaceOnce(
	resultDialog,
	'style="display:grid;grid-template-columns:44px 34px minmax(230px,1.5fr) 125px 130px 92px 115px 145px;min-width:920px;min-height:52px;align-items:center;border-top:1px solid var(--el-border-color-light)"',
	'style="display:grid;grid-template-columns:44px 34px minmax(230px,1.25fr) minmax(130px,.75fr) 92px 115px minmax(460px,2fr);min-width:1180px;min-height:72px;align-items:stretch;border-top:1px solid var(--el-border-color-light)"',
	'doctor previous-five row grid',
);
resultDialog = replaceOnce(
	resultDialog,
	`<div class="lab-result-previous lab-mono" style="min-width:0;padding:10px;color:var(--el-text-color-secondary)">{{ r.redacted ? '-' : (r.previous && r.previous.value || '-') }}</div>
            <div style="min-width:0;padding:10px"><strong class="lab-result-measured" :class="ehLabResultMeasuredClass(r)" :style="ehLabResultMeasuredStyle(r)">{{ r.redacted ? 'ปกปิดผล' : (r.value || 'รอผล') }}</strong></div>
            <div style="min-width:0;padding:10px">{{ r.redacted ? '-' : (r.unit || '-') }}</div>
            <div style="min-width:0;padding:10px"><span v-if="!r.redacted" class="lab-result-interpretation" :class="ehLabResultInterpretationClass(r)" :style="ehLabResultInterpretationStyle(r)">{{ ehLabFlagLabel(r) }}</span><span v-else>-</span></div>
            <div class="lab-mono" style="min-width:0;padding:10px">{{ r.redacted ? '-' : (r.ref || '-') }}</div>`,
	`<div style="min-width:0;padding:10px"><strong class="lab-result-measured" :class="ehLabResultMeasuredClass(r)" :style="ehLabResultMeasuredStyle(r)">{{ r.redacted ? 'ปกปิดผล' : (r.value || 'รอผล') }}</strong><small v-if="!r.redacted && r.ref" class="lab-mono" style="display:block;margin-top:4px;color:var(--el-text-color-placeholder);font-size:9.5px">ค่าปกติ {{ r.ref }}</small></div>
            <div style="min-width:0;padding:10px">{{ r.redacted ? '-' : (r.unit || '-') }}</div>
            <div style="min-width:0;padding:10px"><span v-if="!r.redacted" class="lab-result-interpretation" :class="ehLabResultInterpretationClass(r)" :style="ehLabResultInterpretationStyle(r)">{{ ehLabFlagLabel(r) }}</span><span v-else>-</span></div>
            <div class="lab-result-history" style="min-width:0;padding:8px 10px">
              <div v-if="!ehLabPreviousValues(r).length" style="display:flex;min-height:54px;align-items:center;justify-content:center;border:1px dashed var(--el-border-color);border-radius:7px;color:var(--el-text-color-placeholder);font-size:10.5px">ยังไม่มีประวัติของรายการนี้</div>
              <div v-else style="display:flex;gap:7px;max-width:100%;overflow-x:auto;padding-bottom:3px">
                <article v-for="(previous, previousIndex) in ehLabPreviousValues(r)" :key="(previous.visit_vn || '') + '|' + (previous.lab_no || '') + '|' + previousIndex" style="display:grid;flex:0 0 126px;gap:3px;padding:7px 8px;border:1px solid var(--el-border-color-light);border-radius:7px;background:var(--el-fill-color-blank)">
                  <span style="display:flex;align-items:center;justify-content:space-between;gap:5px;color:var(--el-color-primary);font-size:9px;font-weight:700"><b>ครั้งที่ {{ previousIndex + 1 }}</b><small v-if="previousIndex===0" style="font-weight:400">ล่าสุด</small></span>
                  <strong class="lab-mono" style="color:var(--el-text-color-primary);font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere">{{ previous.value }}</strong>
                  <small v-if="ehLabPreviousSnapshot(previous)" style="color:var(--el-text-color-secondary);font-size:9px;overflow-wrap:anywhere">{{ ehLabPreviousSnapshot(previous) }}</small>
                  <small class="lab-mono" style="color:var(--el-text-color-placeholder);font-size:8.5px">{{ ehLabCompactDateTime(previous.when) || '-' }}</small>
                  <small v-if="previous.lab_no" class="lab-mono" style="color:var(--el-text-color-placeholder);font-size:8.5px">LAB {{ previous.lab_no }}</small>
                </article>
              </div>
            </div>`,
	'doctor previous-five cells',
);
const resultBodyStart = resultDialog.indexOf('  <div v-if="ehLabDialog.order" class="lab-manual-form lab-result-viewer"');
const resultFooterAt = resultDialog.indexOf('\n\n  <template #footer>', resultBodyStart);
if (resultBodyStart < 0 || resultFooterAt < 0) throw new Error('Cannot isolate the standard LAB result dialog body');
const standardResultBody = replaceOnce(
	resultDialog.slice(resultBodyStart, resultFooterAt),
	'v-if="ehLabDialog.order"',
	'v-if="ehLabDialog.order && !ehLabIsMicrobiologyDialog()"',
	'standard LAB viewer guard',
);
const scrollableStandardResultBody = replaceOnce(
	standardResultBody,
	'class="lab-manual-form lab-result-viewer" style="min-height:300px;color:var(--el-text-color-regular)"',
	'class="lab-manual-form lab-result-viewer" style="max-height:calc(100vh - 230px);min-height:300px;overflow-y:auto;padding-right:4px;color:var(--el-text-color-regular)"',
	'standard LAB dialog scrollbar',
);
resultDialog =
	resultDialog.slice(0, resultBodyStart) +
	'  <template v-if="ehLabIsMicrobiologyDialog()">\n' +
	indent(microResultBody, 4) +
	'\n  </template>\n' +
	scrollableStandardResultBody +
	resultDialog.slice(resultFooterAt);
resultDialog = replaceOnce(
	resultDialog,
	'<template #footer><el-button @click="ehLabCloseLabDialog()">ปิด</el-button></template>',
	indent(mbHistoryOverlay, 2) + '\n\n  <template #footer><el-button v-if="ehLabAttachmentCount()" type="primary" plain @click="ehLabScrollToAttachments()">ดูไฟล์แนบ ({{ ehLabAttachmentCount() }})</el-button><el-button v-if="ehLabIsMicrobiologyDialog()" @click="ehLabCopyMicrobiologyResult()">คัดลอกผลที่แสดง</el-button><el-button @click="ehLabCloseLabDialog()">ปิด</el-button></template>',
	'microbiology dialog footer',
);

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
	'          <!-- /EMR History LAB result board -->',
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
	'\n  </template>\n\n  <!-- ยืนยันตัวตน Sensitive/PDF เท่านั้น; ผลทั้งใบเปิดผ่าน Form กลาง lab_popup_result -->\n' + indent(reauthDialog, 2) + '\n</div>',
	'root close for LAB re-auth dialog',
);

// Reuse the verified LAB mapping and viewer helpers, excluding trends and
// X-ray-only helpers. Semantic markers keep this builder stable when Treat
// Summary gains unrelated lines.
const labCoreStart = treatCreated.indexOf('/* ══ helper เล็ก');
const labCoreEnd = treatCreated.indexOf('/* ══ แนวโน้มรายค่า', labCoreStart);
if (labCoreStart < 0 || labCoreEnd < 0) throw new Error('Cannot isolate Treat Summary LAB mapping helpers');
let labCore = treatCreated.slice(labCoreStart, labCoreEnd);
labCore = adaptTs(labCore);
labCore = labCore
	.replace(/\bEH_LAB_LAB_BOARD_PROC\b/g, 'EH_LAB_BOARD_PROC')
	.replace(/__emrTreatSummarySensitiveGrants/g, '__emrHistorySensitiveGrants')
	.replace(/s\.ehLabCurVisit/g, "String((s.ehVisit && (s.ehVisit.visit_id || s.ehVisit.data_id)) || '')")
	.replace(/ehLab-lab-report/g, 'eh-lab-report')
	.replace(/ehLab-lab-pdf/g, 'eh-lab-pdf');
const labCardInteractionsStart = treatCreated.indexOf('/* ══ interactions');
const labCardInteractionsEnd = treatCreated.indexOf('// อ่านรายงาน X-ray', labCardInteractionsStart);
const labViewerInteractionsStart = treatCreated.indexOf('// เปิดผลทั้งใบใน popup', labCardInteractionsEnd);
const labViewerInteractionsEnd = treatCreated.indexOf('const tsLoadBase = s.tsLoad;', labViewerInteractionsStart);
if (labCardInteractionsStart < 0 || labCardInteractionsEnd < 0 || labViewerInteractionsStart < 0 || labViewerInteractionsEnd < 0) {
	throw new Error('Cannot isolate Treat Summary LAB viewer interactions');
}
let labInteractions = [
	treatCreated.slice(labCardInteractionsStart, labCardInteractionsEnd),
	treatCreated.slice(labViewerInteractionsStart, labViewerInteractionsEnd),
].join('\n\n');
labInteractions = adaptTs(labInteractions);
labInteractions = labInteractions.replace(/\ns\.ehLabLgSetMode = \(m\) => \{\n\ts\.ehLabLgUi\.mode = m;\n\};/, '');
labInteractions = labInteractions
	.replace(/\bEH_LAB_LAB_BOARD_PROC\b/g, 'EH_LAB_BOARD_PROC')
	.replace(/s\.ehLabCurVisit/g, "String((s.ehVisit && (s.ehVisit.visit_id || s.ehVisit.data_id)) || '')")
	.replace(/'treat_summary_pdf'/g, "'emr_history_pdf'")
	.replace(/'treat_summary'/g, "'emr_history'");
labInteractions = replaceOnce(
	labInteractions,
	"const ehLabReplaceOrder = (oldOrder, nextOrder) => {\n\t['ehLabLgVisit', 'ehLabLgToday'].forEach((key) => {\n\t\ts[key] = (Array.isArray(s[key]) ? s[key] : []).map((order) => (order === oldOrder || order.key === oldOrder.key ? nextOrder : order));\n\t});\n};",
	"const ehLabReplaceOrder = (oldOrder, nextOrder) => {\n\ts.ehLabOrders = (Array.isArray(s.ehLabOrders) ? s.ehLabOrders : []).map((order) => (order === oldOrder || order.key === oldOrder.key ? nextOrder : order));\n};",
	'EMR History sensitive order replacement',
);
labInteractions = labInteractions.replace(/\ns\.ehLabOpenXr = \(x\) => \{\n\tif \(x\.data_id\) s\.ehLabOpen\(x\.form_id \|\| s\.ehLabXrayFormId, x\.data_id\);\n\};/, '');

const labExtension = `
/* ══ EMR History · LAB result sibling card ════════════════════════════════
 * แยกโหลดจาก emr-history-get และจับคู่ด้วย CPOE Order ID เท่านั้น:
 * item_groups[].items[].order_id === lab_orders[].source_order_id
 */
const EH_LAB_RESULT_PDF_REPORT_ID = '6aa8f5a8b92813319a86ea11';
const EH_LAB_MICRO_RESULT_PDF_REPORT_ID = '6ab1c2d3e4f5061728394a5b';
const EH_LAB_RESULT_HISTORY_FORM_ID = '6ad789a39291822e416c02e7';
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
s.ehLabRoom = 'ALL';
s.ehLabRooms = [
	{ code: 'ALL', label: 'ทั้งหมด' },
	{ code: 'BC', label: 'BC' },
	{ code: 'HM', label: 'HM' },
	{ code: 'HH', label: 'HH' },
	{ code: 'ML', label: 'ML' },
	{ code: 'IM', label: 'IM' },
	{ code: 'MI-OUT', label: 'MI-OUT' },
	{ code: 'MB', label: 'MB' },
	{ code: 'MY', label: 'MY' },
	{ code: 'BB', label: 'BB' },
	{ code: 'BG', label: 'BG' },
];
s.ehLabOgOpen = {};
s.ehLabDialog = { visible: false, order: null };
s.ehLabMbHistory = { visible: false, row: null };
s.ehLabMicroSelectedGroupKey = '';
s.ehLabResultGroupOpen = {};
s.ehLabReauth = { visible: false, loading: false, error: '', username: '', password: '', purpose: 'ดูแลรักษาผู้ป่วย', mode: 'view', placement: '', order: null, item: null };
s.ehLabPdfGrant = { orderKey: '', placement: '', token: '', expiresAt: 0 };
s.ehLabSensitiveExpiryTimer = null;
s.ehLabSensitiveGrants = {};

${labCore}

${labInteractions}

const ehLabRoomCode = (value) => {
	const code = String(value || '').trim().toUpperCase().replace(/_/g, '-');
	return code === 'MIOUT' ? 'MI-OUT' : code;
};
s.ehLabSetRoom = (code) => {
	const normalized = ehLabRoomCode(code) || 'ALL';
	s.ehLabRoom = s.ehLabRooms.some((room) => room.code === normalized) ? normalized : 'ALL';
};
s.ehLabRoomLabel = (code) => {
	const room = s.ehLabRooms.find((item) => item.code === String(code || 'ALL'));
	return room ? room.label : 'ทั้งหมด';
};
s.ehLabCardRows = (order) => (order && Array.isArray(order.display_rows) ? order.display_rows : []);
s.ehLabCardValueStyle = (row) => ({
	color: row && row.redacted ? 'var(--el-color-danger)' : row && row.flag === 'C' ? 'var(--el-color-danger)' : row && ehLabIsAbn(row) ? 'var(--el-color-warning)' : 'var(--el-text-color-primary)',
});
s.ehLabCardFlagType = (row) => (row && row.flag === 'C' ? 'danger' : row && ehLabIsAbn(row) ? 'warning' : 'success');
s.ehLabRoomCount = (group, code) => {
	const orders = s.ehLabCardsForGroup(group);
	const roomCode = ehLabRoomCode(code);
	return roomCode === 'ALL' ? orders.length : orders.filter((order) => ehLabRoomCode(order.section_code) === roomCode).length;
};
s.ehLabVisibleCardsForGroup = (group) => {
	const orders = s.ehLabCardsForGroup(group);
	return s.ehLabRoom === 'ALL' ? orders : orders.filter((order) => ehLabRoomCode(order.section_code) === s.ehLabRoom);
};

/* MLab read-only viewer parity with LAB Worklist.
 * Raw result_value is displayed and copied as received. Do not infer Gram
 * stain, organism, MIC, S/I/R, abnormal, or critical values from its text.
 */
s.ehLabIsMicrobiologyDialog = () => !!(s.ehLabDialog && s.ehLabDialog.order && s.ehLabDialog.order.micro);
s.ehLabAttachmentCount = () => (s.ehLabDialog && s.ehLabDialog.order && Array.isArray(s.ehLabDialog.order.attachments) ? s.ehLabDialog.order.attachments.length : 0);
s.ehLabScrollToAttachments = () => {
	if (typeof document === 'undefined') return;
	const target = document.getElementById('eh-lab-result-attachments');
	if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
s.ehLabPreviousValues = (row) => (row && !row.redacted && Array.isArray(row.previous_values) ? row.previous_values.slice(0, 5) : []);
s.ehLabPreviousSnapshot = (item) => [
	item && item.unit ? item.unit : '',
	item && item.interpretation ? item.interpretation : '',
	item && item.ref ? 'ปกติ ' + item.ref : '',
].filter(Boolean).join(' · ');
s.ehLabOpenMbHistory = (row) => {
	if (!row || !s.ehLabPreviousValues(row).length) return;
	s.ehLabMbHistory = { visible: true, row };
};
s.ehLabCloseMbHistory = () => {
	s.ehLabMbHistory = { visible: false, row: null };
};
s.ehLabMicroGroupKey = (group, index) => String((group && (group.group_key || group.test_code || group.test_name)) || 'micro-result-' + String(index || 0));
s.ehLabMicroGroupsForDisplay = () => {
	const groups = s.ehLabIsMicrobiologyDialog() && Array.isArray(s.ehLabDialog.order.result_groups) ? s.ehLabDialog.order.result_groups : [];
	return s.ehLabMicroSelectedGroupKey ? groups.filter((group, index) => s.ehLabMicroGroupKey(group, index) === s.ehLabMicroSelectedGroupKey) : groups;
};
s.ehLabMicroHasValue = (row) => !!row && !row.redacted && String(row.value == null ? '' : row.value).trim() !== '' && String(row.value).trim() !== '—';
s.ehLabMicroResultRows = (group) => (Array.isArray(group && group.results) ? group.results : []).filter(s.ehLabMicroHasValue);
s.ehLabMicroGroupHasResult = (group) => s.ehLabMicroResultRows(group).length > 0;
s.ehLabMicroGroupStatusValue = (group) => {
	const rows = s.ehLabMicroResultRows(group);
	if (!rows.length) return 'pending';
	const statuses = rows.map((row) => String((row && row.status) || '').toLowerCase()).filter(Boolean);
	return statuses.length && statuses.every((status) => ['f', 'final', 'completed', 'complete'].indexOf(status) >= 0) ? 'final' : 'partial';
};
s.ehLabMicroGroupStatusText = (group) => ({ final: 'Final', partial: 'Partial result', pending: 'รอผล' }[s.ehLabMicroGroupStatusValue(group)]);
s.ehLabMicroStatusStyle = (value) =>
	value === 'final'
		? { borderColor: '#b3e19d', background: '#f0f9eb', color: '#529b2e' }
		: value === 'partial'
		? { borderColor: '#f3d19e', background: '#fdf6ec', color: '#b88230' }
		: { borderColor: '#c8c9cc', background: '#f4f4f5', color: '#909399' };
s.ehLabMicroGroupStatusStyle = (group) => s.ehLabMicroStatusStyle(s.ehLabMicroGroupStatusValue(group));
s.ehLabMicroOverallStatusValue = () => {
	const groups = s.ehLabMicroGroupsForDisplay();
	if (!groups.length || groups.every((group) => !s.ehLabMicroGroupHasResult(group))) return 'pending';
	return groups.every((group) => s.ehLabMicroGroupStatusValue(group) === 'final') ? 'final' : 'partial';
};
s.ehLabMicroOverallStatusText = () => ({ final: 'Final', partial: 'Partial result', pending: 'รอผล' }[s.ehLabMicroOverallStatusValue()]);
s.ehLabMicroOverallStatusStyle = () => s.ehLabMicroStatusStyle(s.ehLabMicroOverallStatusValue());
s.ehLabMicroGroupReportedAt = (group) => {
	const times = (Array.isArray(group && group.results) ? group.results : []).map((row) => String((row && row.reported_at) || '')).filter(Boolean).sort();
	return times[times.length - 1] || '';
};
s.ehLabMicroLatestReportedAt = () => {
	const order = (s.ehLabDialog && s.ehLabDialog.order) || {};
	const times = s.ehLabMicroGroupsForDisplay().map(s.ehLabMicroGroupReportedAt).filter(Boolean).sort();
	return times[times.length - 1] || order.reported_at || order.resulted_at || '';
};
s.ehLabMicroResultCountText = () => {
	const groups = s.ehLabMicroGroupsForDisplay();
	const done = groups.filter(s.ehLabMicroGroupHasResult).length;
	return 'ทั้งหมด ' + groups.length + ' · มีผล ' + done + ' · รอผล ' + Math.max(0, groups.length - done);
};
s.ehLabMicroPatientName = () => {
	const order = (s.ehLabDialog && s.ehLabDialog.order) || {};
	const raw = order._raw || {};
	const visit = s.ehVisit || {};
	const person = visit.person || visit.patient || {};
	return String(raw.patient_name || visit.patient_name || person.name || person.full_name || person.display_name || [person.prefix, person.first_name || person.firstname, person.last_name || person.lastname].filter(Boolean).join(' ') || '');
};
s.ehLabMicroItems = (order) => {
	const o = order || {};
	const groups = Array.isArray(o.result_groups) ? o.result_groups : [];
	const ordered = o._raw && Array.isArray(o._raw.ordered_items) ? o._raw.ordered_items : [];
	const used = {};
	const items = ordered.map((item, itemIndex) => {
		const itemId = String((item && item.item_id) || '');
		let groupIndex = groups.findIndex((group) => String((group && group.group_key) || '') === itemId);
		if (groupIndex < 0) groupIndex = groups.findIndex((group) => (Array.isArray(group && group.results) ? group.results : []).some((row) => String((row && row.visibility && row.visibility.item_id) || '') === itemId));
		if (groupIndex < 0 && item && item.result_code) groupIndex = groups.findIndex((group) => String((group && group.test_code) || '') === String(item.result_code));
		if (groupIndex < 0 && ordered.length === 1 && groups.length === 1) groupIndex = 0;
		const group = groupIndex >= 0 ? groups[groupIndex] : null;
		if (group) used[s.ehLabMicroGroupKey(group, groupIndex)] = true;
		return {
			item_id: itemId || 'micro-item-' + itemIndex,
			item_code: String((item && (item.item_code || item.result_code)) || ''),
			item_name: String((item && item.item_name) || (group && group.test_name) || ''),
			specimen_name: String((item && item.specimen_name) || ''),
			collected_at: String((item && item.collected_at) || ''),
			group_key: group ? s.ehLabMicroGroupKey(group, groupIndex) : '',
			has_result: !!group && (Array.isArray(group.results) ? group.results : []).some(s.ehLabMicroHasValue),
		};
	});
	groups.forEach((group, groupIndex) => {
		const groupKey = s.ehLabMicroGroupKey(group, groupIndex);
		if (used[groupKey]) return;
		items.push({ item_id: groupKey, item_code: String(group.test_code || ''), item_name: String(group.test_name || ''), specimen_name: '', collected_at: '', group_key: groupKey, has_result: s.ehLabMicroGroupHasResult(group) });
	});
	return items;
};
s.ehLabMicroSelectedItem = () => {
	const order = (s.ehLabDialog && s.ehLabDialog.order) || {};
	return s.ehLabMicroItems(order).find((item) => item.group_key && item.group_key === s.ehLabMicroSelectedGroupKey) || null;
};
s.ehLabMicroSpecimenName = () => {
	const order = (s.ehLabDialog && s.ehLabDialog.order) || {};
	const raw = order._raw || {};
	const item = s.ehLabMicroSelectedItem();
	return String((item && item.specimen_name) || raw.specimen_name || raw.specimen || raw.specimen_type || '');
};
s.ehLabMicroCollectedAt = () => {
	const order = (s.ehLabDialog && s.ehLabDialog.order) || {};
	const item = s.ehLabMicroSelectedItem();
	return String((item && item.collected_at) || order.collected_at || '');
};
const ehLabMicroItemReportOrder = (order, item) => {
	const groups = Array.isArray(order && order.result_groups) ? order.result_groups : [];
	const group = groups.find((candidate, index) => s.ehLabMicroGroupKey(candidate, index) === String((item && item.group_key) || ''));
	const reportIds = Array.from(
		new Set(
			(Array.isArray(group && group.results) ? group.results : [])
				.map((row) => String((row && row.result_report_id) || ''))
				.filter((id) => /^[a-f0-9]{24}$/i.test(id)),
		),
	);
	const ready = !!EH_LAB_MICRO_RESULT_PDF_REPORT_ID && reportIds.length === 1;
	const next = Object.assign({}, order, {
		report_ready: ready,
		report_list: ready ? [{ reportId: EH_LAB_MICRO_RESULT_PDF_REPORT_ID, label: 'PDF', type: 'pdf' }] : [],
		report_params: ready ? { xparentx: reportIds[0] } : {},
		report_hint: ready ? '' : reportIds.length > 1 ? 'รายการนี้มีผลหลายชุด จึงไม่เลือก Result Report ให้อัตโนมัติ' : 'ยังไม่มี Result Report สำหรับ PDF MLab',
	});
	next._raw = Object.assign({}, (order && order._raw) || {}, { result_report_ids: reportIds });
	return next;
};
s.ehLabOpenMicroItem = (order, item) => {
	if (!order || !item || !item.has_result || !item.group_key) return;
	s.ehLabMicroSelectedGroupKey = item.group_key;
	// The card groups an entire Microbiology Order, but this popup is one CPOE
	// Item. Pass only that Item's current Result Report parent to Report Factory.
	s.ehLabOpenOrder(ehLabMicroItemReportOrder(order, item));
};
s.ehLabCopyMicrobiologyResult = () => {
	const lines = [];
	s.ehLabMicroGroupsForDisplay().forEach((group) => {
		lines.push([String((group && group.test_code) || ''), String((group && group.test_name) || ''), s.ehLabMicroGroupStatusText(group)].filter(Boolean).join(' · '));
		s.ehLabMicroResultRows(group).forEach((row) => {
			lines.push(['รหัสผล ' + (row.code || '-'), 'ชื่อ/รหัสจาก MLab ' + (row.name || '-')].join(' · '));
			lines.push(String(row.value || ''));
		});
		if (!s.ehLabMicroGroupHasResult(group)) lines.push('รอผล');
		lines.push('');
	});
	const text = lines.join('\\n').trim();
	if (!text) {
		if (field.notify) field.notify('ไม่มีผลให้คัดลอก', 'warning', 2500);
		return;
	}
	if (typeof field.copyClipboard === 'function') field.copyClipboard(text);
	if (field.notify) field.notify('คัดลอกผลที่แสดงแล้ว', 'success', 2200);
};

s.ehLabReset = () => {
	if (s.ehLabSensitiveExpiryTimer) clearTimeout(s.ehLabSensitiveExpiryTimer);
	s.ehLabLoading = false;
	s.ehLabError = '';
	s.ehLabOrders = [];
	s.ehLabHn = '';
	s.ehLabRoom = 'ALL';
	s.ehLabOgOpen = {};
	s.ehLabDialog = { visible: false, order: null };
	s.ehLabMbHistory = { visible: false, row: null };
	s.ehLabMicroSelectedGroupKey = '';
	s.ehLabResultGroupOpen = {};
	s.ehLabReauth = { visible: false, loading: false, error: '', username: '', password: '', purpose: 'ดูแลรักษาผู้ป่วย', mode: 'view', placement: '', order: null, item: null };
	s.ehLabPdfGrant = { orderKey: '', placement: '', token: '', expiresAt: 0 };
	s.ehLabSensitiveExpiryTimer = null;
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
if (!builtTemplate.includes('v-for="o in ehLabVisibleCardsForGroup(g)"')) throw new Error('filtered LAB card loop missing');
// Names that already contained "Lab" in Treat Summary would otherwise receive it twice.
builtTemplate = builtTemplate.replace(/ehLabLabDialog/g, 'ehLabDialog');
builtCreated = builtCreated
	.replace(/ehLabLabDialog/g, 'ehLabDialog')
	.replace(/EH_LAB_LAB_RESULT_HISTORY_FORM_ID/g, 'EH_LAB_RESULT_HISTORY_FORM_ID')
	.replace(/s\.ehLabVisit/g, 's.ehVisit');
// Same normalization for helpers whose original names already contain the Lab prefix.
builtTemplate = builtTemplate.replace(/ehLabLabFlag/g, 'ehLabFlag').replace(/ehLabLabFile/g, 'ehLabFile');
builtCreated = builtCreated.replace(/ehLabLabFlag/g, 'ehLabFlag').replace(/ehLabLabFile/g, 'ehLabFile');

// EMR must keep manually hidden rows in their original table position as a
// redacted placeholder. Sensitive/unresolved rows continue to use re-auth.
builtCreated = replaceOnce(
	builtCreated,
	"\tconst visibility = (it && it.visibility) || { state: 'visible' };\n\tconst r = {\n\t\tvisibility: visibility,\n\t\tlocked: String(visibility.state || 'visible') !== 'visible',\n\t\treauth_required: String(visibility.state || '') === 'reauth_required',",
	"\tconst visibility = (it && it.visibility) || { state: 'visible' };\n\tconst visibilityState = String(visibility.state || 'visible');\n\tconst manuallyHidden = visibilityState === 'hidden' || visibility.manual_hidden === true;\n\tconst r = {\n\t\tvisibility: visibility,\n\t\t// Manual LAB hide stays in its original row/Profile position but contains\n\t\t// no clinical value. Sensitive/unresolved rows remain in the locked list.\n\t\tredacted: manuallyHidden,\n\t\tlocked: visibilityState !== 'visible' && !manuallyHidden,\n\t\treauth_required: visibilityState === 'reauth_required',",
	'EMR manual-hidden row mapping',
);
builtCreated = replaceOnce(
	builtCreated,
	"const ehLabRow = (it) => {\n\tconst visibility = (it && it.visibility) || { state: 'visible' };",
	"const ehLabPreviousRow = (item) => ({\n\tvalue: item && item.value != null && item.value !== '' ? String(item.value) : '—',\n\tunit: String((item && item.unit) || ''),\n\tinterpretation: String((item && item.interpretation) || ''),\n\tref: String((item && item.reference_range) || ''),\n\twhen: String((item && item.entered_at) || ''),\n\tvisit_vn: String((item && item.visit_vn) || ''),\n\tlab_no: String((item && item.lab_no) || ''),\n\tstatus: String((item && item.status) || ''),\n});\nconst ehLabRow = (it) => {\n\tconst visibility = (it && it.visibility) || { state: 'visible' };",
	'doctor previous-five row mapper helper',
);
builtCreated = replaceOnce(
	builtCreated,
	"\tconst manuallyHidden = visibilityState === 'hidden' || visibility.manual_hidden === true;\n\tconst r = {",
	"\tconst manuallyHidden = visibilityState === 'hidden' || visibility.manual_hidden === true;\n\tconst previousValues = (it && Array.isArray(it.previous_values) ? it.previous_values : it && it.previous ? [it.previous] : [])\n\t\t.slice(0, 5)\n\t\t.map(ehLabPreviousRow);\n\tconst r = {",
	'doctor previous-five row mapper input',
);
builtCreated = replaceOnce(
	builtCreated,
	"\t\tprevious:\n\t\t\tit && it.previous\n\t\t\t\t? {\n\t\t\t\t\t\tvalue: String(it.previous.value == null || it.previous.value === '' ? '—' : it.previous.value),\n\t\t\t\t\t\tunit: String(it.previous.unit || ''),\n\t\t\t\t\t\twhen: String(it.previous.entered_at || ''),\n\t\t\t\t  }\n\t\t\t\t: null,",
	"\t\tprevious: previousValues[0] || null,\n\t\tprevious_values: previousValues,",
	'doctor previous-five normalized rows',
);
builtCreated = replaceOnce(
	builtCreated,
	"\t\tcriticals: rows.filter((r) => r.flag === 'C'),\n\t\t// 🔴 ผลที่เป็น \"รายงานความเรียง\" (MB/MLab) แยกถังของตัวเอง — ต้องเห็นเสมอ\n\t\t//    LIS ไม่ได้ตีธงผิดปกติให้ ไม่ได้แปลว่าปกติ ⇒ ห้ามพับไปอยู่ใต้ \"ค่าปกติ\"\n\t\tabnormals: rows.filter((r) => ehLabIsAbn(r) && !r.text),\n\t\ttexts: rows.filter((r) => r.text && !ehLabIsAbn(r)),\n\t\tnormals: rows.filter((r) => !ehLabIsAbn(r) && !r.text),",
	"\t\tcriticals: rows.filter((r) => r.flag === 'C'),\n\t\t// 🔴 ผลที่เป็น \"รายงานความเรียง\" (MB/MLab) แยกถังของตัวเอง — ต้องเห็นเสมอ\n\t\t//    LIS ไม่ได้ตีธงผิดปกติให้ ไม่ได้แปลว่าปกติ ⇒ ห้ามพับไปอยู่ใต้ \"ค่าปกติ\"\n\t\thidden_rows: rows.filter((r) => r.redacted),\n\t\tabnormals: rows.filter((r) => !r.redacted && ehLabIsAbn(r) && !r.text),\n\t\ttexts: rows.filter((r) => !r.redacted && r.text && !ehLabIsAbn(r)),\n\t\tnormals: rows.filter((r) => !r.redacted && !ehLabIsAbn(r) && !r.text),",
	'EMR manual-hidden result buckets',
);
builtCreated = replaceOnce(
	builtCreated,
	"\t\tcriticals: rows.filter((r) => r.flag === 'C'),",
	"\t\tdisplay_rows: allRows,\n\t\tcriticals: rows.filter((r) => r.flag === 'C'),",
	'preserve LAB API row order for the compact result sheet',
);
builtCreated = replaceOnce(
	builtCreated,
	"s.ehLabOrderTarget = (o) => !!(o && ((Array.isArray(o.rows) && o.rows.length) || (Array.isArray(o.locked_rows) && o.locked_rows.some((row) => row.reauth_required))));",
	"s.ehLabOrderTarget = (o) => !!String((o && (o.source_order_id || (o._raw && o._raw.source_order_id))) || '');",
	'shared LAB popup target for every Order card',
);
builtCreated = builtCreated.replace('\n\ts.ehLabCloseReauth();\n\ts.ehLabOpenOrder(nextOrder);\n};', '\n\ts.ehLabCloseReauth();\n};');
builtCreated = replaceOnce(
	builtCreated,
	"\to.abn_text = o.abnormals.length ? 'ผิดปกติ ' + o.abnormals.length : o.texts.length ? 'มีรายงานผล' : o.has_locked ? 'มีผล Sensitive' : rows.length ? 'ปกติทั้งหมด' : '';\n\to.abn_type = o.abnormals.length ? (o.criticals.length ? 'danger' : 'warning') : o.texts.length ? 'info' : o.has_locked ? 'warning' : 'success';",
	"\to.abn_text = o.hidden_rows.length ? 'ปกปิดผล ' + o.hidden_rows.length : o.abnormals.length ? 'ผิดปกติ ' + o.abnormals.length : o.texts.length ? 'มีรายงานผล' : o.has_locked ? 'มีผล Sensitive' : rows.length ? 'ปกติทั้งหมด' : '';\n\to.abn_type = o.hidden_rows.length ? 'danger' : o.abnormals.length ? (o.criticals.length ? 'danger' : 'warning') : o.texts.length ? 'info' : o.has_locked ? 'warning' : 'success';",
	'EMR manual-hidden card label',
);
builtCreated = builtCreated.replace(
	"String(visibility.visit_id || raw.visit_id || String((s.ehVisit && (s.ehVisit.visit_id || s.ehVisit.data_id)) || '') || '')",
	"String(visibility.visit_id || raw.visit_id || (s.ehVisit && (s.ehVisit.visit_id || s.ehVisit.data_id)) || '')",
);
builtCreated = replaceOnce(
	builtCreated,
	"s.ehLabResultRowsCount = () => {\n\tconst order = s.ehLabDialog.order;\n\treturn order && Array.isArray(order.rows) ? order.rows.length : 0;\n};",
	"s.ehLabResultRowsCount = () => s.ehLabResultGroups().reduce((count, group) => count + (Array.isArray(group && group.results) ? group.results.length : 0), 0);",
	'EMR visible result row count',
);
builtCreated = replaceOnce(
	builtCreated,
	"s.ehLabHasResultValue = (row) => !!(row && row.value != null && row.value !== '' && row.value !== '—');",
	"s.ehLabHasResultValue = (row) => !!(row && !row.redacted && row.value != null && row.value !== '' && row.value !== '—');",
	'EMR redacted result signal',
);
builtCreated = replaceOnce(
	builtCreated,
	"s.ehLabResultMeasuredStyle = (row) => ({ color: row && row.flag === 'C' ? '#c45656' : row && ehLabIsAbn(row) ? '#b88230' : 'var(--el-text-color-primary)', fontSize: '15px', fontWeight: 800, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' });",
	"s.ehLabResultMeasuredStyle = (row) => ({ color: row && row.redacted ? 'var(--el-color-danger)' : row && row.flag === 'C' ? '#c45656' : row && ehLabIsAbn(row) ? '#b88230' : 'var(--el-text-color-primary)', fontSize: row && row.redacted ? '13px' : '15px', fontWeight: 800, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' });",
	'EMR redacted result style',
);

// Add the CPOE Order identity needed by the exact join when the shared source
// predates that field. Current Treat Summary already exposes it.
if (!builtCreated.includes("\t\tsource_order_id: String(raw.source_order_id || ''),")) {
	builtCreated = replaceOnce(
		builtCreated,
		"\t\tkey: String(raw.order_id || raw.order_no || Math.random()),\n\t\tscope: scope,",
		"\t\tkey: String(raw.order_id || raw.order_no || Math.random()),\n\t\tsource_order_id: String(raw.source_order_id || ''),\n\t\tscope: scope,",
		'LAB source_order_id mapping',
	);
}
builtCreated = replaceOnce(
	builtCreated,
	"\t\tresultGroupByKey[groupKey].results.push(row);",
	"\t\tif (!resultGroupByKey[groupKey].test_code && row.code) resultGroupByKey[groupKey].test_code = row.code;\n\t\tresultGroupByKey[groupKey].results.push(row);",
	'MLab group HIS code mapping',
);
builtCreated = replaceOnce(
	builtCreated,
	"\t\tresult_item_id: String((it && it.result_item_id) || ''),\n\t\tgroup_id: String((it && it.group_id) || ''),",
	"\t\tresult_item_id: String((it && it.result_item_id) || ''),\n\t\t// Preserve the printable Result Report parent after row normalization.\n\t\tresult_report_id: String((it && (it.result_report_id || it.xparentx)) || ''),\n\t\tgroup_id: String((it && it.group_id) || ''),",
	'MLab Result Report parent mapping',
);
builtCreated = replaceOnce(
	builtCreated,
	"\t\tordered_at: String(raw.ordered_at || ''),\n\t\tresulted_at: String(raw.resulted_at || ''),",
	"\t\tordered_at: String(raw.ordered_at || ''),\n\t\treceived_at: String(raw.received_at || ''),\n\t\tcollected_at: String(raw.collected_at || ''),\n\t\tresulted_at: String(raw.resulted_at || ''),",
	'MLab timeline timestamps',
);
builtCreated = replaceOnce(
	builtCreated,
	"\t\tpatient_hn: String(raw.patient_hn || s.ehLabHn || ''),",
	"\t\tpatient_hn: String(raw.patient_hn || s.ehLabHn || ''),\n\t\tpatient_name: String(raw.patient_name || ''),\n\t\tspecimen_name: String(raw.specimen_name || ''),\n\t\tordered_items: Array.isArray(raw.ordered_items) ? raw.ordered_items : [],",
	'MLab patient/specimen/item metadata',
);
builtCreated = replaceOnce(
	builtCreated,
	"s.ehLabResultGroups = () => {\n\tconst order = s.ehLabDialog.order;\n\treturn order && Array.isArray(order.result_groups) ? order.result_groups : [];\n};",
	"s.ehLabResultGroups = () => {\n\tconst order = s.ehLabDialog.order;\n\tif (s.ehLabIsMicrobiologyDialog && s.ehLabIsMicrobiologyDialog()) return s.ehLabMicroGroupsForDisplay();\n\treturn order && Array.isArray(order.result_groups) ? order.result_groups : [];\n};",
	'MLab selected item result groups',
);
builtCreated = replaceOnce(
	builtCreated,
	"\ts.ehLabDialog = { visible: false, order: null };\n\ts.ehLabResultGroupOpen = {};",
	"\ts.ehLabDialog = { visible: false, order: null };\n\ts.ehLabMbHistory = { visible: false, row: null };\n\ts.ehLabMicroSelectedGroupKey = '';\n\ts.ehLabResultGroupOpen = {};",
	'reset selected MLab item on dialog close',
);
builtCreated = replaceOnce(
	builtCreated,
	"\ts.ehLabResultGroupOpen = opened;\n\ts.ehLabDialog = { visible: true, order };",
	"\ts.ehLabResultGroupOpen = opened;\n\ts.ehLabMbHistory = { visible: false, row: null };\n\ts.ehLabDialog = { visible: true, order };",
	'reset MB history child overlay on dialog open',
);

fs.mkdirSync(path.dirname(OUT_TEMPLATE), { recursive: true });
fs.mkdirSync(path.dirname(OUT_CREATED), { recursive: true });
const mergeMarkedRegion = (current, generated, startMarker, endMarker) => {
	const currentStart = current.indexOf(startMarker);
	const currentEnd = current.indexOf(endMarker, currentStart);
	const generatedStart = generated.indexOf(startMarker);
	const generatedEnd = generated.indexOf(endMarker, generatedStart);
	if (currentStart < 0 || currentEnd < 0 || generatedStart < 0 || generatedEnd < 0) return generated;
	return current.slice(0, currentStart) + generated.slice(generatedStart, generatedEnd + endMarker.length) + current.slice(currentEnd + endMarker.length);
};
let outputTemplate = builtTemplate;
if (fs.existsSync(OUT_TEMPLATE)) {
	const currentTemplate = read(OUT_TEMPLATE);
	if (currentTemplate.includes('ehXrayOrdersForGroup')) {
		outputTemplate = mergeMarkedRegion(
			currentTemplate,
			builtTemplate,
			'          <!-- ผล Lab เป็นการ์ดคนละความหมายกับการ์ดสั่งตรวจ จึงวางเป็น sibling ต่อท้าย ไม่ซ้อนในกรอบเดิม -->',
			'          <!-- /EMR History LAB result board -->',
		);
	}
}
let outputCreated = builtCreated;
if (fs.existsSync(OUT_CREATED)) {
	const currentCreated = read(OUT_CREATED);
	const labMarker = '/* ══ EMR History · LAB result sibling card';
	const xrayMarker = '/* ══ EMR History · X-ray result card';
	if (currentCreated.includes(xrayMarker)) {
		const currentLab = currentCreated.indexOf(labMarker);
		const currentXray = currentCreated.indexOf(xrayMarker, currentLab);
		const generatedLab = builtCreated.indexOf(labMarker);
		if (currentLab >= 0 && currentXray > currentLab && generatedLab >= 0) {
			outputCreated = currentCreated.slice(0, currentLab) + builtCreated.slice(generatedLab).trimEnd() + '\n\n' + currentCreated.slice(currentXray);
		}
	}
}
const pasteReadyTemplate = outputTemplate.endsWith('\n') ? outputTemplate : outputTemplate + '\n';
fs.writeFileSync(OUT_TEMPLATE, pasteReadyTemplate);
fs.writeFileSync(OUT_TEMPLATE_TEXT, pasteReadyTemplate);
fs.writeFileSync(OUT_CREATED, outputCreated);

console.log(path.relative(ROOT, OUT_TEMPLATE));
console.log(path.relative(ROOT, OUT_TEMPLATE_TEXT));
console.log(path.relative(ROOT, OUT_CREATED));
