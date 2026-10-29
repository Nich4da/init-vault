/* Build a user-owned room-scoped CPOE replacement from a current Builder export.
 * Usage: node build_cpoe_app_xray_v2.js <latest-export.json> [output.json]
 * The source export is never modified. Queue movement stays in the launcher;
 * this form only reports a successful send through on_order_sent(context).
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const sourcePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, 'Form-Builder/SDForm/sdform_module/EMR_form/CPOE_app.json')
const outPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(root, 'Form-Builder/SDForm/form-factory/forms/cpoe-test-order-post-send-move-v3.json')
const form = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))

const walk = (value, fn) => {
  if (!value || typeof value !== 'object') return
  fn(value)
  if (Array.isArray(value)) value.forEach(item => walk(item, fn))
  else Object.values(value).forEach(item => walk(item, fn))
}
const findNamed = name => {
  let hit = null
  walk(form, value => { if (value && value.name === name) hit = value })
  if (!hit) throw new Error('Field not found: ' + name)
  return hit
}
const replaceOnce = (text, before, after, label) => {
  const count = text.split(before).length - 1
  if (count !== 1) throw new Error('expected exactly one "' + label + '" (found ' + count + ')')
  return text.replace(before, after)
}

const header = findNamed('pt_header')
const item = findNamed('item_screen')

/* Patient / Visit picker shared by the LAB and X-ray launchers. */
header.content = replaceOnce(
  header.content,
  '  <el-card v-if="ptHas()" class="card-container wcard-soft pcard pcard-bg plain" shadow="always">',
  `  <div class="cpoe-vn-picker">
    <div class="cpoe-vn-title">
      <strong>{{ vnPickerTitle() }}</strong>
      <span v-if="visitDate">{{ visitDate }} · {{ vnRows.length }} Visit</span>
    </div>
    <el-select :model-value="selectedVisitId" class="cpoe-vn-select" size="large"
      filterable clearable :loading="vnLoading" placeholder="ค้นหาด้วย HN, VN หรือชื่อผู้ป่วย"
      no-match-text="ไม่พบผู้ป่วยที่ตรงกับคำค้น" no-data-text="ไม่มี Visit ที่เปิดอยู่วันนี้"
      @change="selectVisitById">
      <el-option v-for="visit in vnRows" :key="String(visit._id)"
        :label="visitOptionLabel(visit)" :value="String(visit._id)" />
    </el-select>
    <div v-if="vnError" class="cpoe-vn-error">{{ vnError }}</div>
    <div v-else class="cpoe-vn-hint">{{ vnPickerHint() }}</div>
    <div v-if="vnOverridden()" class="cpoe-vn-override">
      กำลังใช้ VN ที่เลือกเอง (VN{{ ptText('vn') || '–' }}) แทน VN จาก EMR (VN{{ emrVn() || '–' }})
      · ล้างช่องด้านบนเพื่อกลับไปใช้ VN เดิม
    </div>
  </div>

  <el-card v-if="ptHas()" class="card-container wcard-soft pcard pcard-bg plain" shadow="always">`,
  'insert Visit picker',
)
header.content = replaceOnce(
  header.content,
  '<el-empty v-if="!ptHas()" description="ไม่มีข้อมูลผู้ป่วย — จอนี้ต้องเปิดจากการ์ดใบสั่งยาในหน้า EMR" />',
  `<el-empty v-if="!ptHas()" :description="manualMode()?'เลือก HN/VN ที่เปิด Visit วันนี้จากด้านบน':'ไม่มีข้อมูลผู้ป่วย — จอนี้ต้องเปิดจากหน้า EMR'" />`,
  'empty patient message',
)
header.onCreated = replaceOnce(
  header.onCreated,
  'const m = () => field.params || {};',
  `const LAB_WORKLIST_PROCESS_ID = '6a9434c3422c1ca959829d5e';
const formRef = () => field.getFormRef && field.getFormRef();
s.manualContext = null;
s.vnRows = [];
s.vnLoading = false;
s.vnError = '';
s.visitDate = '';
s.selectedVisitId = '';
const m = () => s.manualContext || ((formRef() || {}).$cpoeVisitContext) || field.params || {};`,
  'reactive patient context',
)
header.onCreated += `

/* Visit picker shared by LAB and X-ray launchers. */
s.manualMode = () => !!((field.params || {}).manual_visit);
s.visitPatient = visit => (visit && visit.pid) || {};
s.visitName = visit => {
  const p = s.visitPatient(visit);
  const pre = p.prename && typeof p.prename === 'object' ? (p.prename.label || p.prename.value) : p.prename;
  return [pre || '', p.p_fname || '', p.p_lname || ''].join(' ').replace(/\\s+/g, ' ').trim();
};
s.visitContext = visit => {
  const p = s.visitPatient(visit);
  const unit = (visit && (visit.current_unit || visit.unit_to)) || null;
  return {
    person_id: String((visit && visit.xtbxlv1_xfx_id) || p.value || ''),
    hn: p.hn || '', full_name: s.visitName(visit),
    sex: ({'1':'ชาย','2':'หญิง'})[String(p.p_gender || '')] || String(p.p_gender || ''),
    age: p.age == null ? '' : p.age, blood_group: p.p_abogroup || '',
    p_pic: Array.isArray(p.p_pic) ? p.p_pic : null,
    allergy_tags: Array.isArray(visit && visit.allergy_tags) ? visit.allergy_tags : [],
    visit_id: String((visit && (visit._id || visit.value)) || ''),
    visit_tran_id: String((visit && (visit.visit_tran_id || visit.tran_id || visit.vtran_id)) || ''),
    visit_tran_count: Number((visit && visit.visit_tran_count) || 0),
    visit_tran_ambiguous: !!(visit && visit.visit_tran_ambiguous),
    current_unit: unit,
    current_room: (visit && (visit.current_room || visit.room_to)) || null,
    visit_tran_status: String((visit && visit.visit_tran_status) || ''),
    visit_priority: String((visit && visit.visit_priority) || '10'),
    vn: (visit && visit.vn) || '',
    visit_type: (visit && visit.visit_type && (visit.visit_type.label || visit.visit_type.value)) || (visit && visit.visit_type) || '',
    visit_datetime: (visit && (visit.visit_date || visit.created_at)) || '',
    visit_clinic: (visit && visit.visit_clinic && (visit.visit_clinic.label || visit.visit_clinic.value)) || (visit && visit.visit_clinic) || '',
    visit_doctor: (visit && visit.visit_doctor && (visit.visit_doctor.label || visit.visit_doctor.value)) || (visit && visit.visit_doctor) || '',
    dx_summary: '', service_type: '',
    inscl_hos: Array.isArray(visit && visit.inscl_hos) ? visit.inscl_hos : []
  };
};
s.selectVisit = visit => {
  const ctx = s.visitContext(visit);
  if(!ctx.visit_id) return;
  s.selectedVisitId = ctx.visit_id; s.manualContext = ctx;
  const form = formRef(); if(form) form.$cpoeVisitContext = ctx;
  const orderField = field.getFieldRef && field.getFieldRef('item_screen');
  if(orderField && orderField.vueState && typeof orderField.vueState.setPatientContext === 'function') orderField.vueState.setPatientContext(ctx);
};
s.selectVisitById = id => {
  const key = String(id || ''); s.selectedVisitId = key;
  if(!key){
    s.manualContext = null;
    const form = formRef(); if(form) form.$cpoeVisitContext = null;
    const orderField = field.getFieldRef && field.getFieldRef('item_screen');
    if(orderField && orderField.vueState && typeof orderField.vueState.setPatientContext === 'function') orderField.vueState.setPatientContext(null);
    return;
  }
  const visit = s.vnRows.find(row => String((row && row._id) || '') === key);
  if(visit) s.selectVisit(visit);
};
s.visitThaiDate = visit => {
  const raw = String((visit && (visit.visit_date || visit.created_at)) || '');
  const hit = raw.match(/^(\\d{4})-(\\d{1,2})-(\\d{1,2})/); if(!hit) return '';
  const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  return Number(hit[3]) + ' ' + months[Number(hit[2]) - 1] + ' ' + (Number(hit[1]) + 543);
};
s.visitOptionLabel = visit => ['HN' + (s.visitPatient(visit).hn || '–'), 'VN' + ((visit && visit.vn) || '–'), s.visitThaiDate(visit), s.visitName(visit) || 'ไม่ทราบชื่อ'].filter(Boolean).join(' · ');
s.extractVisitPayload = out => {
  const rows = [out, out && out.data, out && out.data && out.data.data, out && out.reply && out.reply.data];
  for(let i=0;i<rows.length;i++) if(rows[i] && Array.isArray(rows[i].visits)) return rows[i];
  return null;
};
s.loadTodayVisits = () => {
  if(s.vnLoading) return;
  const form = formRef(), api = field.globalUserState || (form && form.userState);
  if(!api || typeof api.runProcess !== 'function'){ s.vnError = 'ไม่พบตัวเชื่อมข้อมูล Visit'; return; }
  s.vnLoading = true; s.vnError = '';
  const p = field.params || {};
  api.runProcess(LAB_WORKLIST_PROCESS_ID, { action:'list_open_visits', organization_code:String(p.organization_code || '') }, out => {
    s.vnLoading = false;
    const payload = s.extractVisitPayload(out);
    if(!payload){ s.vnRows = []; s.vnError = 'รูปแบบข้อมูล Visit ไม่ถูกต้อง'; return; }
    s.vnRows = Array.isArray(payload.visits) ? payload.visits : [];
    s.visitDate = String(payload.visit_date || '');
    if(!s.vnRows.length) s.vnError = 'วันนี้ยังไม่มีผู้ป่วยที่เปิด Visit อยู่';
    const originalId = String((field.params || {}).visit_id || '');
    if(!s.selectedVisitId && originalId && s.vnRows.some(row => String(row && row._id || '') === originalId)) s.selectedVisitId = originalId;
  }, error => {
    s.vnLoading = false; s.vnRows = [];
    s.vnError = 'อ่าน Visit วันนี้ไม่สำเร็จ: ' + String((error && error.message) || error || 'ไม่ทราบสาเหตุ');
  });
};
s.emrVn = () => String(((field.params || {}).vn) || '');
s.vnOverridden = () => !!(s.manualContext && (field.params || {}).visit_id && String(s.manualContext.visit_id) !== String((field.params || {}).visit_id));
s.vnPickerTitle = () => s.manualMode() ? 'เลือกผู้ป่วยที่เปิด Visit วันนี้' : 'เลือก VN อีกช่องทาง (ค่าเริ่มต้นมาจาก EMR)';
s.vnPickerHint = () => s.manualMode() ? 'แสดงเฉพาะ Visit วันนี้ที่สถานะยังเปิดอยู่' : 'ล้างช่องเพื่อกลับไปใช้ VN เดิมจาก EMR';`
header.onMounted = 'this.vueState.loadTodayVisits();\n'

/* LAB / X-ray scope on the latest CPOE item widget. */
item.onCreated = replaceOnce(
  item.onCreated,
  `const TYPES = [
\t{ code: 'lab', label: 'Lab', prefix: 'L', mode: 'sheet', spec: true },
\t{ code: 'xray', label: 'X-ray', prefix: 'X', mode: 'sheet' },
\t{ code: 'nurs', label: 'หัตถการ', prefix: 'N', mode: 'pick' },
\t{ code: 'order', label: 'บริการอื่นๆ', prefix: 'O', mode: 'pick' },
];`,
  `const LAB_SCOPE = !!((field.params || {}).lab_scope);
const XRAY_SCOPE = !!((field.params || {}).xray_scope) || String((field.params || {}).source || '') === 'xray-worklist';
const LAB_ORGANIZATION_CODE = String((field.params || {}).organization_code || '').trim().toUpperCase();
const LAB_SECTION_CODES = (Array.isArray((field.params || {}).section_codes) ? (field.params || {}).section_codes : [])
\t.map(code => String(code || '').trim().toUpperCase()).filter(Boolean);
const ALL_TYPES = [
\t{ code: 'lab', label: 'Lab', prefix: 'L', mode: 'sheet', spec: true },
\t{ code: 'xray', label: 'X-ray', prefix: 'X', mode: 'sheet' },
\t{ code: 'nurs', label: 'หัตถการ', prefix: 'N', mode: 'pick' },
\t{ code: 'order', label: 'บริการอื่นๆ', prefix: 'O', mode: 'pick' },
];
const TYPES = LAB_SCOPE ? ALL_TYPES.filter(type => type.code === 'lab')
\t: XRAY_SCOPE ? ALL_TYPES.filter(type => type.code === 'xray') : ALL_TYPES;`,
  'scoped service types',
)
item.onCreated = replaceOnce(
  item.onCreated,
  `s.TYPES = TYPES;
s.HISTORY = HISTORY;`,
  `s.TYPES = TYPES;
s.HISTORY = HISTORY;
s.labScope = LAB_SCOPE;
s.xrayScope = XRAY_SCOPE;`,
  'scope state',
)
item.onCreated = replaceOnce(item.onCreated, `s.st = 'lab'; // ชนิดที่เปิดอยู่`, `s.st = XRAY_SCOPE ? 'xray' : 'lab'; // ชนิดที่เปิดอยู่`, 'default service type')
item.onCreated = replaceOnce(
  item.onCreated,
  `s.pt = () => field.params || {};
s.ptOk = () => !!(field.params && field.params.visit_id);
s.itemMode = () => ((field.params || {}).order_id ? 'edit' : 'new');`,
  `s.manualContext = null;
s.pt = () => s.manualContext || ((field.getFormRef && field.getFormRef()) || {}).$cpoeVisitContext || field.params || {};
s.ptOk = () => !!((s.pt() || {}).visit_id);
s.itemMode = () => ((field.params || {}).order_id ? 'edit' : 'new');
s.setPatientContext = ctx => {
\ts.manualContext = ctx || null;
\ts.insIx = 0; s.cart = []; s.savedOrderId = ''; s.savedOrderNumber = '';
\ts.priceById = {}; s.priceTotals = null; s.priceError = '';
\tif(s.catLoaded) s.recompute(); else s.boot();
};
};`,
  'mutable patient context',
)
item.onCreated = replaceOnce(
  item.onCreated,
  `{ service_types: TYPES.map((t) => t.code) },`,
  `{ service_types: TYPES.map((t) => t.code), organization_code: LAB_SCOPE ? LAB_ORGANIZATION_CODE : '', section_codes: LAB_SCOPE ? LAB_SECTION_CODES.slice() : [] },`,
  'scoped catalog request',
)
item.onCreated = replaceOnce(
  item.onCreated,
  `\t\t\ts.cat = d.catalog || {};
\t\t\ts.catCounts = d.counts || {};`,
  `\t\t\tconst catalog = d.catalog || {};
\t\t\tif(LAB_SCOPE && LAB_SECTION_CODES.length){
\t\t\t\tconst allowed = {}; LAB_SECTION_CODES.forEach(code => { allowed[code] = true; });
\t\t\t\tconst lab = catalog.lab || { sections: [], items: [] };
\t\t\t\tcatalog.lab = Object.assign({}, lab, {
\t\t\t\t\tsections: (lab.sections || []).filter(row => allowed[String(row && row.code || '').toUpperCase()]),
\t\t\t\t\titems: (lab.items || []).filter(row => allowed[String(row && row.sec || '').toUpperCase()])
\t\t\t\t});
\t\t\t}
\t\t\ts.cat = catalog;
\t\t\ts.catCounts = Object.assign({}, d.counts || {}, LAB_SCOPE ? { lab: ((catalog.lab || {}).items || []).length } : {});`,
  'LAB catalog response filter',
)
item.onCreated = replaceOnce(
  item.onCreated,
  `\t\tvisit_id: String((field.params || {}).visit_id || ''),`,
  `\t\tvisit_id: String((s.pt() || {}).visit_id || ''),
\t\torganization_code: LAB_SCOPE ? LAB_ORGANIZATION_CODE : '',
\t\tsection_codes: LAB_SCOPE ? LAB_SECTION_CODES.slice() : [],`,
  'active Visit in save payload',
)
item.onCreated = replaceOnce(
  item.onCreated,
  `const doSave = (then) => {
\tif (s.saving || !s.cart.length) return;
\ts.saving = true;`,
  `const doSave = (then) => {
\tif (s.saving || !s.cart.length) return;
\tif(LAB_SCOPE || XRAY_SCOPE){
\t\tconst allowed = {}; LAB_SECTION_CODES.forEach(code => { allowed[code] = true; });
\t\tconst invalid = s.cart.filter(line => LAB_SCOPE
\t\t\t? (line.st !== 'lab' || (LAB_SECTION_CODES.length && !allowed[String(line.sec || '').toUpperCase()]))
\t\t\t: line.st !== 'xray');
\t\tif(invalid.length){ field.alert('พบรายการที่อยู่นอกขอบเขตของห้องนี้ กรุณานำออกจากใบก่อนบันทึก', 'warning'); return; }
\t}
\ts.saving = true;`,
  'scope save guard',
)
item.onCreated = replaceOnce(
  item.onCreated,
  `const notifySaved = () => {
\t// บอกฟอร์มแม่ว่าใบใน DB ขยับแล้ว — การ์ดหน้า EMR จะได้โหลดใหม่ตอนปิด popup
\tconst cb = (field.params || {}).on_order_saved;
\tif (typeof cb === 'function') cb();
};`,
  `const notifySaved = () => {
\tconst cb = (field.params || {}).on_order_saved;
\tif (typeof cb === 'function') cb();
};
const notifySent = () => {
\tconst cb = (field.params || {}).on_order_sent;
\tif (typeof cb === 'function') cb(s.pt() || {});
};`,
  'sent callback',
)
item.onCreated = replaceOnce(
  item.onCreated,
  `\t\t\tfield.alert('ส่งใบ ' + (s.savedOrderNumber || '') + ' แล้ว', 'success');
\t\t\tfield.getFormRef().closePopup();`,
  `\t\t\tnotifySent();
\t\t\tfield.alert('ส่งใบ ' + (s.savedOrderNumber || '') + ' แล้ว', 'success');
\t\t\tfield.getFormRef().closePopup();`,
  'notify after successful send',
)

item.content = replaceOnce(item.content, '<div class="cpoe-item" @click="closePrioMenu()">', `<div class="cpoe-item" :class="{ 'is-lab-scope': labScope, 'is-xray-scope': xrayScope }" @click="closePrioMenu()">`, 'scope CSS classes')
item.content = replaceOnce(item.content, 'title="ไม่ได้รับ patient context — ฟอร์มแม่ต้องส่งมาทาง params ไม่ใช่ initData"', `:title="xrayScope?'เลือกผู้ป่วยที่เปิด Visit วันนี้จากด้านบน':'ยังไม่ได้เลือกผู้ป่วย/Visit'"`, 'friendly patient prompt')
item.content = replaceOnce(item.content, '<button :aria-pressed="st === HISTORY.code" @click.stop="setType(HISTORY.code)">{{ HISTORY.label }}</button>', '<button v-if="!labScope && !xrayScope" :aria-pressed="st === HISTORY.code" @click.stop="setType(HISTORY.code)">{{ HISTORY.label }}</button>', 'hide history in scoped modes')
form.formConfig.cssCode += `

/* CPOE replacement 2026-10-18: shared Visit picker + room scopes.
   Post-send Move Unit belongs to the launcher and is not rendered here. */
.cpoe-vn-picker{margin-bottom:8px;padding:12px;border:1px solid var(--el-border-color-lighter);border-radius:10px;background:var(--el-fill-color-light)}
.cpoe-vn-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;color:var(--el-text-color-primary)}
.cpoe-vn-title span,.cpoe-vn-hint{color:var(--el-text-color-secondary);font-size:12px}
.cpoe-vn-select{width:min(720px,100%)}
.cpoe-vn-error{margin-top:6px;color:var(--el-color-danger);font-size:12px}
.cpoe-vn-hint{margin-top:6px}
.cpoe-vn-override{margin-top:8px;padding:6px 10px;border:1px solid var(--el-color-warning);border-radius:6px;background:var(--el-color-warning-light-9);color:var(--el-color-warning-dark-2);font-size:12px}
@media(max-width:720px){.cpoe-vn-title{align-items:flex-start;flex-direction:column}.cpoe-vn-select{width:100%}}
`

/*
 * The live Builder export currently emits the two vue-ui widgets at root.
 * Wrap them in a full-width grid so the replacement remains import-safe under
 * the repository SDForm rules without changing either widget's name or code.
 */
if (!form.fields.some(field => ['grid', 'card', 'tab'].includes(field && field.component))) {
  const rootFields = form.fields
  form.fields = [{
    key: 9261016,
    name: 'Layout',
    component: 'grid',
    category: 'container',
    icon: 'grid',
    fieldType: 'None',
    fieldLength: null,
    children: false,
    enable: true,
    cols: [{
      key: 9261017,
      name: 'Grid Col',
      component: 'grid-col',
      category: 'container',
      icon: 'grid-col',
      fieldType: 'None',
      fieldLength: null,
      children: true,
      enable: true,
      fields: rootFields,
      options: {
        name: 'cpoe_xray_root_col', hidden: false, span: 24, offset: 0,
        push: 0, pull: 0, responsive: false, md: 24, sm: 24, xs: 24,
        bgColor: null, customClass: '',
      },
      id: 'grid-col-cpoe-xray-root',
    }],
    options: {
      name: 'cpoe_xray_root_grid', hidden: false, gutter: 0,
      colHeight: null, customClass: '',
    },
    id: 'grid-cpoe-xray-root',
  }]
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(form, null, 2) + '\n')
console.log('wrote ' + path.relative(root, outPath))
