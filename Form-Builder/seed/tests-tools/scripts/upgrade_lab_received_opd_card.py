# -*- coding: utf-8 -*-
"""Clone the current EMR OPD card into Lab's transient receive workspace.

The Lab status row keeps a visit_id.  At receive time this script makes the
card query the matching Visit Tran, then hands that *real* EMR-shaped record
to the copied OPD card.  BMI/Vital Sign forms, patient edit and histories
therefore retain the same behavior as EMR instead of rendering a snapshot.
"""

import json
from pathlib import Path


LAB_PATH = Path('Lab_Biochem_initCraft_import.json')
EMR_PATH = Path('/Users/nichada/Documents/emr-current')
STATUS_FORM_ID = '6a7daa3e8d398c11cf2fe869'
STATUS_PROCESS_ID = '6a7e787e8d398c11cf2fe8b8'
VISIT_TRAN_FORM_ID = '6a461235e521219e514d1c4b'
CENTER_LAB_FORM_ID = '6a75a7810796231c653df996'
REJECTION_FORM_ID = '6a7713fdcc7d0a8451130331'
REJECT_PROCESS_ID = '6a79ff46d5218a5b6a26bebc'


LIST_ORDER_TEMPLATE = r'''
<section v-if="selected()" class="lab-received-order-card">
  <div class="lab-received-order-head"><div><h2>List Order</h2><p>รายการตรวจของผู้ป่วยที่เลือก</p></div><span>{{ itemCount(selected()) }} รายการ</span></div>
  <div class="lab-table-wrap"><table class="lab-table lab-received-table"><thead><tr><th>รหัส</th><th>รายการตรวจ</th><th style="text-align:right">ราคา</th><th>สถานะ</th></tr></thead><tbody><tr v-for="item in items(selected())" :key="item.id||item.master_id||item.code"><td><b>{{ item.code || '-' }}</b></td><td>{{ item.name || '-' }}</td><td style="text-align:right">{{ money(item.effective_price!=null?item.effective_price:item.sale_price) }}</td><td><span class="lab-status-pill is-waiting">รอดำเนินการ</span></td></tr></tbody></table></div>
  <div class="lab-received-history"><div class="lab-history-head" style="justify-content:flex-start;gap:12px"><h3 style="flex:0 0 auto;white-space:nowrap">ประวัติการแก้ไขรายการส่งตรวจ</h3><el-select v-if="history(selected()).length" size="small" style="width:160px!important;min-width:160px!important;max-width:160px!important;flex:0 0 160px" :model-value="historyFilter" @update:model-value="setHistoryFilter"><el-option label="ทั้งหมด" value="all"/><el-option label="รายการที่เพิ่ม" value="added"/><el-option label="รายการที่ลด" value="removed"/></el-select></div><div v-if="history(selected()).length"><div v-for="(entry,index) in filteredHistory(selected())" :key="entry.changed_at||index" class="lab-history-entry"><div class="lab-history-time">{{ historyTime(entry.changed_at) }}<span v-if="entry.changed_by"> · {{ entry.changed_by }}</span></div><div v-if="historyFilter==='all'||historyFilter==='added'" v-for="item in (entry.added||[])" :key="'add-'+item.code" class="lab-history-add">＋ {{ item.code }} <span>{{ item.name }}</span></div><div v-if="historyFilter==='all'||historyFilter==='removed'" v-for="item in (entry.removed||[])" :key="'remove-'+item.code" class="lab-history-remove">− {{ item.code }} <span>{{ item.name }}</span></div></div></div><div v-else style="padding:10px 12px;border:1px dashed #d1d5db;border-radius:8px;color:#6b7280;font-size:13px">ยังไม่มีประวัติการเพิ่ม/ลบรายการ</div></div>
  <div class="lab-received-actions"><el-button type="danger" plain @click="rejectReceived">ปฏิเสธสิ่งส่งตรวจ</el-button><el-button @click="editOrder">แก้ไขรายการส่งตรวจ</el-button><el-button type="primary" @click="startProcess">เริ่มดำเนินการ</el-button></div>
</section>'''


LAB_SET_TRAN = r'''// Lab uses the same EMR card, but it has no EMR-only SOAP/consult/order
// widgets to refresh.  The complete Visit Tran is supplied by loadEmrTran.
s.setTran = (row) => {
  s.tran = row || null
  s.loadBmi()
  s.loadVs()
  s.tickExam()
}

'''


LAB_STATE = r'''
/* lab-emr-opd-card-v3 */
const STATUS_PROVIDER = { providerId: '__STATUS_FORM__', providerType: 'FORM', params: {}, options: {} };
const VISIT_TRAN_PROVIDER = { providerId: '__VISIT_TRAN_FORM__', providerType: 'FORM', params: {}, options: {} };
const REJECTION_FORM_ID = '__REJECTION_FORM__';
const REJECT_PROCESS_ID = '__REJECT_PROCESS__';

const labArray = value => {
  let parsed = value;
  // Form textarea values normally arrive as JSON once.  Accept one additional
  // JSON layer as well, so an older record cannot silently hide its audit.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed !== 'string') return [];
    try { parsed = JSON.parse(parsed || '[]'); } catch (e) { return []; }
  }
  return Array.isArray(parsed) ? parsed : [];
};
const labText = value => value == null ? '' : String(value);
const labRecordId = value => {
  if (value == null) return '';
  if (typeof value === 'object') return labRecordId(value.$oid || value._id || value.id || value.value || '');
  return String(value).trim();
};

s.rights = row => {
  const seen = {};
  return labArray(row && (row.inscl_hos_json || row.inscl_hos || row.pttype || [])).map(item => {
    if (item && typeof item === 'object') { const main = item.inscl_item_main || {}; return labText(main.value || main.label || item.label || item.value || item.name || item.code).trim(); }
    return labText(item).trim();
  }).filter(label => label && label !== '-' && !seen[label] && (seen[label] = true));
};
s.allergies = row => {
  const seen = {};
  return labArray(row && (row.allergy_tags_json || row.allergy_tags || row.allergies || row.drug_allergy || [])).map(item => {
    return labText(item && typeof item === 'object' ? (item.name || item.label || item.value) : item).trim();
  }).filter(label => label && !seen[label] && (seen[label] = true));
};
s.receivedKey = row => labText(row && (row.order_number || row.lab_no || row._id || row.id));
s.activeReceiveRow = null;
s.selected = () => s.activeReceiveRow || null;
s.items = row => labArray(row && row.selected_items);
s.itemCount = row => s.items(row).length;
s.money = value => Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
s.history = row => labArray(row && (row.order_change_history_json || row.order_change_history)).map(entry => {
  const change = entry && typeof entry === 'object' ? entry : {};
  // `added` / `removed` are the canonical keys.  The aliases keep the view
  // compatible with audit rows written by the older Lab prototype.
  return {
    ...change,
    added: labArray(change.added || change.added_items || change.additions),
    removed: labArray(change.removed || change.removed_items || change.removals),
  };
}).filter(entry => entry.added.length || entry.removed.length);
s.historyFilter = 'all';
s.setHistoryFilter = value => { s.historyFilter = value || 'all'; };
s.filteredHistory = row => s.history(row).filter(entry => s.historyFilter === 'all' || (s.historyFilter === 'added' && Array.isArray(entry.added) && entry.added.length) || (s.historyFilter === 'removed' && Array.isArray(entry.removed) && entry.removed.length));
s.historyTime = value => { if (!value) return '-'; try { return new Date(value).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'medium' }); } catch (e) { return labText(value); } };

// Use a fallback only while the complete Visit Tran query is loading or for a
// legacy order that has no visit_id.  The normal card always receives the
// actual Visit Tran so every EMR control keeps its own record relationship.
s.fallbackTran = row => {
  if (!row) return null;
  const photo = labText(row.patient_photo || row.photo_url);
  const pid = {
    hn: labText(row.patient_hn),
    p_fname: labText(row.patient_name),
    p_lname: '',
    p_gender: labText(row.patient_gender || row.gender),
    p_abogroup: labText(row.blood_group || row.abo_group),
    birth_date: row.patient_birth_date || row.birth_date || '',
    p_phone: labText(row.patient_phone || row.p_phone),
    p_pic: photo ? [{ url: photo }] : [],
  };
  return {
    checkin_at: row.visit_time || row.ordered_at || row.created_at || '',
    pttype: s.rights(row),
    allergy_tags: s.allergies(row),
    vid: {
      value: labText(row.visit_id || row.visit_id_link),
      vn: labText(row.visit_vn || row.vn),
      visit_type: labText(row.visit_type),
      xtbxlv1_xfx_id: labText(row.person_id),
      pid: pid,
    },
  };
};
s.mergeEmrTran = (labRow, liveTran) => {
  const fallback = s.fallbackTran(labRow) || {};
  const live = liveTran || {};
  const fallbackVid = fallback.vid || {}, liveVid = live.vid || {};
  const fallbackPid = fallbackVid.pid || {}, livePid = liveVid.pid || {};
  const pttype = Array.isArray(live.pttype) && live.pttype.length ? live.pttype : s.rights(labRow);
  const allergies = Array.isArray(live.allergy_tags) && live.allergy_tags.length ? live.allergy_tags : s.allergies(labRow);
  return {
    ...fallback,
    ...live,
    checkin_at: live.checkin_at || fallback.checkin_at,
    pttype: pttype,
    allergy_tags: allergies,
    vid: { ...fallbackVid, ...liveVid, pid: { ...fallbackPid, ...livePid } },
  };
};
s.receiveLoadVersion = 0;
s.loadEmrTran = row => {
  const version = ++s.receiveLoadVersion;
  const fallback = s.fallbackTran(row);
  const visitId = labText(row && (row.visit_id || row.visit_id_link)).trim();
  const form = field.getFormRef && field.getFormRef();
  const api = (form && form.userState) || field.globalUserState;
  if (!visitId || !api || typeof api.crudGetAll !== 'function') { s.setTran(fallback); return; }
  s.setTran(fallback);
  api.crudGetAll({
    sdProvider: {
      ...VISIT_TRAN_PROVIDER,
      params: { visitId: visitId },
      options: { where: "`vid.value` = CONVERT(:visitId, 'objectId')", limit: 1, page: 1 },
    },
    totalEnable: false,
  }, out => {
    if (version !== s.receiveLoadVersion) return;
    const rows = (out && out.data) || [];
    s.setTran(s.mergeEmrTran(row, rows[0] || null));
  }, () => { if (version === s.receiveLoadVersion) s.setTran(fallback); });
};
s.setReceiveRow = row => {
  const form = field.getFormRef && field.getFormRef();
  s.activeReceiveRow = row || null;
  if (form) { form.$labReceiveTran = row || null; form.$labReceivedOrderId = row ? s.receivedKey(row) : ''; }
  if (row) s.loadEmrTran(row); else s.setTran(null);
};
s.clearReceiveRow = () => {
  const form = field.getFormRef && field.getFormRef();
  s.receiveLoadVersion++;
  s.activeReceiveRow = null;
  s.setTran(null);
  if (form) { form.$labReceiveTran = null; form.$labReceivedOrderId = ''; }
};
s.load = () => {
  const form = field.getFormRef && field.getFormRef();
  const row = form && form.$labReceiveTran;
  if (row) s.setReceiveRow(row); else s.clearReceiveRow();
};
s.openForReceive = key => {
  const form = field.getFormRef && field.getFormRef();
  const row = form && form.$labReceiveTran;
  if (row && s.receivedKey(row) === labText(key)) s.setReceiveRow(row);
};

// Same reset-on-leave interaction as EMR: the patient detail is transient.
s.__labReceiveLastTab = '';
s.watchLabReceiveTab = () => {
  const form = field.getFormRef && field.getFormRef();
  const tabs = form && form.getFieldRef && form.getFieldRef('lab_biochem_tabs');
  const active = (tabs && tabs.activeTabName) || '';
  if (s.__labReceiveLastTab === 'lab_received' && active !== 'lab_received') s.clearReceiveRow();
  s.__labReceiveLastTab = active;
};
if (s.__labReceiveNavTimer) clearInterval(s.__labReceiveNavTimer);
s.watchLabReceiveTab();
s.__labReceiveNavTimer = setInterval(s.watchLabReceiveTab, 180);

s.refreshSelectedOrder = () => {
  const row = s.selected();
  const form = field.getFormRef && field.getFormRef(), api = (form && form.userState) || field.globalUserState;
  const orderNumber = labText(row && row.order_number).trim();
  if (!row || !orderNumber || !api || typeof api.runProcess !== 'function') return;
  api.runProcess('__STATUS_PROCESS__', { action: 'get_order', order_number: orderNumber }, out => {
    const body = (out && out.data) || out || {};
    if (body.success === false || !body.row) { field.notify(body.message || 'โหลดรายการ Lab ล่าสุดไม่สำเร็จ', 'warning'); return; }
    s.setReceiveRow({ ...row, ...body.row });
  }, () => field.notify('โหลดรายการ Lab ล่าสุดไม่สำเร็จ', 'warning'));
};
s.refreshSelectedOrderAfterSave = () => {
  // The Center form update event awaits the Status sync.  These two delayed
  // reads also cover older runtimes that release afterSave before its nested
  // API event callback has updated the derived Status row.
  s.refreshSelectedOrder();
  setTimeout(() => s.refreshSelectedOrder(), 300);
  setTimeout(() => s.refreshSelectedOrder(), 900);
};

s.editOrder = () => {
  const row = s.selected();
  const form = field.getFormRef && field.getFormRef(), api = (form && form.userState) || field.globalUserState;
  const orderNumber = labText(row && row.order_number).trim();
  if (!row || !orderNumber || !form || typeof form.openForm !== 'function' || !api || typeof api.runProcess !== 'function') { field.notify('ไม่พบข้อมูลใบสั่ง Lab Center ที่ต้องการแก้ไข', 'warning'); return; }
  api.runProcess('__STATUS_PROCESS__', { action: 'resolve_center_order', order_number: orderNumber }, out => {
    const body = (out && out.data) || out || {};
    const centerOrderId = labText(body.center_order_id).trim();
    if (body.success === false || !centerOrderId) { field.notify(body.message || 'ไม่พบใบสั่ง Lab Center ต้นทาง', 'error'); return; }
    // Open the actual Center Lab record—not the derived Status record—so the
    // order-sheet UI retains its own add/remove behavior and group LAB NO.
    form.openForm('__CENTER_LAB_FORM__', centerOrderId, null, {}, {
      popupType: 'dialog',
      backdrop: false,
      afterSaveCallback: () => {
        s.refreshSelectedOrderAfterSave();
        // This is the same popup-close pattern used by the EMR card.  It
        // closes only after a successful Submit, never when the user cancels.
        if (form && typeof form.subFormClose === 'function') form.subFormClose();
      }
    });
  }, err => field.notify(labText((err && err.message) || err || 'เปิดใบสั่ง Lab Center ไม่สำเร็จ'), 'error'));
};
s.rejectReceived = () => {
  const row = s.selected();
  if (!row) { field.notify('กรุณาเลือกรายการก่อน', 'warning'); return; }
  const form = field.getFormRef && field.getFormRef(), api = (form && form.userState) || field.globalUserState;
  const sourceOrderId = labRecordId(row._id || row.id);
  if (!sourceOrderId || !form || typeof form.openForm !== 'function') { field.notify('ไม่พบ record id ของ Lab Status', 'error'); return; }
  const patientHn = labText(row.patient_hn).trim(), patientName = labText(row.patient_name).trim();
  const initData = {
    source_order_id: sourceOrderId,
    order_group_id: labText(row.order_number || row.lab_no).trim(),
    patient_hn: patientHn,
    patient_name: patientName,
    patient_display: [patientHn, patientName].filter(Boolean).join(' — '),
    ward_clinic: labText(row.source_unit_name || row.ward_clinic).trim(),
    lab_section: labText(row.section_code).trim(),
    selected_items_json: typeof row.selected_items === 'string' ? row.selected_items : JSON.stringify(row.selected_items || []),
    biochemistry_specimen_json: typeof row.specimens === 'string' ? row.specimens : JSON.stringify(row.specimens || []),
    treatment_right: labText(row.treatment_right || row.insurance_right).trim(),
    payment_status: labText(row.payment_status).trim(),
    revision_no: String(row.revision_no || 1)
  };
  form.openForm(REJECTION_FORM_ID, null, null, initData, {
    params: { from: 'multi-lab-received', source_order_id: sourceOrderId, order_number: initData.order_group_id, section_code: initData.lab_section },
    popupType: 'dialog',
    backdrop: false,
    afterSaveCallback: saved => {
      const savedRow = (saved && saved.data) || saved || {};
      if (!api || typeof api.runProcess !== 'function') { field.notify('บันทึกเหตุผลแล้ว แต่ไม่พบ Reject API', 'error'); return; }
      api.runProcess(REJECT_PROCESS_ID, {
        source_order_id: sourceOrderId,
        rejection_record_id: labRecordId(savedRow._id || savedRow.id),
        order_number: initData.order_group_id,
        section_code: initData.lab_section,
        reject_reason_code: savedRow.reject_reason_code,
        reject_reason_detail: savedRow.reject_reason_detail
      }, out => {
        const body = (out && out.data) || out || {};
        if (body.success === false) { field.notify(body.message || 'ปฏิเสธ specimen ไม่สำเร็จ', 'error'); return; }
        field.notify(body.message || 'ปฏิเสธ specimen แล้ว', 'success');
        s.clearReceiveRow();
        ['lab_waiting_center_specimen', 'lab_all_orders_center_specimen', 'lab_cancelled_listview_final'].forEach(name => {
          const ref = form.getFieldRef && form.getFieldRef(name), editor = ref && ref.getFieldEditor && ref.getFieldEditor();
          if (ref && ref.vueState && typeof ref.vueState.load === 'function') ref.vueState.load();
          if (editor && typeof editor.handleRefresh === 'function') editor.handleRefresh();
        });
        if (typeof form.subFormClose === 'function') form.subFormClose();
      }, err => field.notify(labText((err && err.message) || err || 'ปฏิเสธ specimen ไม่สำเร็จ'), 'error'));
    }
  });
};
s.startProcess = () => {
  const row = s.selected();
  if (!row) { field.notify('กรุณาเลือกรายการก่อน', 'warning'); return; }
  const form = field.getFormRef && field.getFormRef(), api = (form && form.userState) || field.globalUserState;
  if (!api || typeof api.runProcess !== 'function') { field.notify('ไม่พบ API connector', 'error'); return; }
  api.runProcess('__STATUS_PROCESS__', { action: 'update_work_status', order_number: labText(row.order_number), work_status: 'processing' }, out => {
    const body = (out && out.data) || out || {};
    if (body.success === false) { field.notify(body.message || 'เริ่มดำเนินการไม่สำเร็จ', 'error'); return; }
    field.notify(body.message || 'เริ่มดำเนินการแล้ว', 'success');
  }, err => field.notify(labText((err && err.message) || err || 'เริ่มดำเนินการไม่สำเร็จ'), 'error'));
};

// A lazy tab can mount after the receive click.  Read the form hand-off only
// after all copied EMR methods have been installed.
s.load();
'''


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def by_name(model, name):
    for node in walk(model):
        options = node.get('options') if isinstance(node, dict) else None
        if isinstance(options, dict) and options.get('name') == name:
            return node
    raise RuntimeError(f'ไม่พบ widget {name}')


lab_form = json.loads(LAB_PATH.read_text(encoding='utf-8'))
emr_form = json.loads(EMR_PATH.read_text(encoding='utf-8'))
emr_card = by_name(emr_form, 'opd_card')['options']
received = by_name(lab_form, 'lab_received_component')['options']

emr_script = emr_card.get('onCreated') or ''
start = emr_script.find('// เซ็ตคนไข้ + โหลด BMI')
end = emr_script.find('// เปิดฟอร์ม BMI', start)
if start < 0 or end < 0:
    raise RuntimeError('ไม่พบ setTran block ใน OPD card ล่าสุด')
emr_script = emr_script[:start] + LAB_SET_TRAN + emr_script[end:]

emr_content = (emr_card.get('content') or '').replace('ยังไม่ได้เลือกคนไข้ — กด EMR จากคิวห้องตรวจ', 'ยังไม่ได้เลือกคนไข้ — กดรับ specimen จากคิวรอรับ')
received['content'] = '<div class="lab-screen lab-received-workspace">' + emr_content + LIST_ORDER_TEMPLATE + '</div>'
received['onCreated'] = emr_script + '\n' + LAB_STATE.replace('__STATUS_FORM__', STATUS_FORM_ID).replace('__STATUS_PROCESS__', STATUS_PROCESS_ID).replace('__VISIT_TRAN_FORM__', VISIT_TRAN_FORM_ID).replace('__CENTER_LAB_FORM__', CENTER_LAB_FORM_ID).replace('__REJECTION_FORM__', REJECTION_FORM_ID).replace('__REJECT_PROCESS__', REJECT_PROCESS_ID)
received['onMounted'] = ''
received['onUnmount'] = "const s=this.vueState;if(s&&s.__labReceiveNavTimer)clearInterval(s.__labReceiveNavTimer);if(s&&s.examTimerId)clearInterval(s.examTimerId);if(s&&s.bmiApexInstance){s.bmiApexInstance.destroy();s.bmiApexInstance=null;}"

LAB_PATH.write_text(json.dumps(lab_form, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Received Lab tab now clones the current EMR OPD card with live Visit context')
