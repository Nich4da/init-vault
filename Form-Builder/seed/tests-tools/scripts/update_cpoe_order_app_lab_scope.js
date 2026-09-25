const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const file = path.join(root, 'Form-Builder/SDForm/sdform_module/EMR_form/CPOE_app.json')
const form = JSON.parse(fs.readFileSync(file, 'utf8'))

const walk = (value, visit) => {
  if (!value || typeof value !== 'object') return
  visit(value)
  if (Array.isArray(value)) value.forEach(item => walk(item, visit))
  else Object.values(value).forEach(item => walk(item, visit))
}

const byName = name => {
  let found = null
  walk(form, value => { if (value.name === name) found = value })
  if (!found) throw new Error('Missing SDForm widget: ' + name)
  return found
}

const replaceOnce = (text, before, after, label) => {
  const first = text.indexOf(before)
  if (first < 0) throw new Error('Missing patch anchor: ' + label)
  if (text.indexOf(before, first + before.length) >= 0) throw new Error('Ambiguous patch anchor: ' + label)
  return text.slice(0, first) + after + text.slice(first + before.length)
}

const pt = byName('pt_header')
const item = byName('item_screen')

if (
  pt.content.includes('ค้นหาด้วย HN, VN หรือชื่อผู้ป่วย') &&
  pt.onCreated.includes("action:'list_open_visits'") &&
  item.onCreated.includes('const LAB_SCOPE =')
) {
  console.log('CPOE Order App LAB scope is already up to date')
  process.exit(0)
}

const oldPicker = `  <div v-if="manualMode()" class="cpoe-vn-picker">
    <div class="cpoe-vn-search">
      <el-input :model-value="vnQuery" size="small" clearable prefix-icon="Search"
        placeholder="กรอก VN เพื่อเลือก Visit" @input="setVnQuery" @keyup.enter="findVisits" />
      <el-button size="small" type="primary" :loading="vnLoading" @click="findVisits">ค้นหา VN</el-button>
    </div>
    <div v-if="vnError" class="cpoe-vn-error">{{ vnError }}</div>
    <button v-for="visit in vnRows" :key="visit._id" type="button" class="cpoe-vn-row"
      :class="{'is-selected':selectedVisitId===String(visit._id)}" @click="selectVisit(visit)">
      <span class="cpoe-vn-code">VN{{ visit.vn || '–' }}</span>
      <span class="cpoe-vn-name">HN{{ visitPatient(visit).hn || '–' }} · {{ visitName(visit) || 'ไม่ทราบชื่อ' }}</span>
      <span class="cpoe-vn-age">{{ visitPatient(visit).age || '' }}</span>
    </button>
  </div>`

const newPicker = `  <div v-if="manualMode()" class="cpoe-vn-picker">
    <div class="cpoe-vn-title">
      <strong>เลือกผู้ป่วยที่เปิด Visit วันนี้</strong>
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
    <div v-else class="cpoe-vn-hint">แสดงเฉพาะ Visit วันที่วันนี้ที่สถานะยังเปิดอยู่</div>
  </div>`

pt.content = replaceOnce(pt.content, oldPicker, newPicker, 'manual Visit picker')
pt.content = replaceOnce(
  pt.content,
  `manualMode()?'กรอก VN ด้านบนเพื่อเลือก Visit':'ไม่มีข้อมูลผู้ป่วย — จอนี้ต้องเปิดจากหน้า EMR'`,
  `manualMode()?'เลือก HN/VN ที่เปิด Visit วันนี้จากด้านบน':'ไม่มีข้อมูลผู้ป่วย — จอนี้ต้องเปิดจากหน้า EMR'`,
  'empty patient message',
)

pt.onCreated = replaceOnce(
  pt.onCreated,
  `const s = this.vueState;
const field = this;`,
  `const s = this.vueState;
const field = this;
const LAB_WORKLIST_PROCESS_ID = '6a9434c3422c1ca959829d5e';`,
  'pt process constant',
)
pt.onCreated = replaceOnce(
  pt.onCreated,
  `s.vnQuery = '';
s.vnRows = [];
s.vnLoading = false;
s.vnError = '';
s.selectedVisitId = '';`,
  `s.vnRows = [];
s.vnLoading = false;
s.vnError = '';
s.visitDate = '';
s.selectedVisitId = '';`,
  'pt picker state',
)
pt.onCreated = replaceOnce(
  pt.onCreated,
  `s.manualMode = () => !!((field.params || {}).manual_visit);
s.setVnQuery = value => { s.vnQuery = String(value || '').trim(); s.vnError = ''; };`,
  `s.manualMode = () => !!((field.params || {}).manual_visit);`,
  'remove exact VN query setter',
)

const findVisitsPattern = /s\.findVisits = \(\) => \{[\s\S]*?\n\};\n\n\/\/ ค่าที่ต้องแสดงเป็นข้อความ/
if (!findVisitsPattern.test(pt.onCreated)) throw new Error('Missing patch anchor: findVisits implementation')
pt.onCreated = pt.onCreated.replace(findVisitsPattern, `s.visitOptionLabel = visit => {
  const p = s.visitPatient(visit);
  const hn = String(p.hn || '–');
  const vn = String((visit && visit.vn) || '–');
  const name = s.visitName(visit) || 'ไม่ทราบชื่อ';
  return 'HN' + hn + ' · VN' + vn + ' · ' + name;
};
s.selectVisitById = id => {
  const key = String(id || '');
  s.selectedVisitId = key;
  if(!key){
    s.manualContext = null;
    const form = formRef();
    if(form) form.$labCpoeContext = null;
    return;
  }
  const visit = s.vnRows.find(row => String(row && row._id || '') === key);
  if(visit) s.selectVisit(visit);
};
s.extractVisitPayload = out => {
  const candidates = [out, out && out.data, out && out.data && out.data.data, out && out.reply && out.reply.data];
  for(let i=0;i<candidates.length;i++){
    const row = candidates[i];
    if(row && typeof row === 'object' && Array.isArray(row.visits)) return row;
    if(row && row.data && Array.isArray(row.data.visits)) return row.data;
  }
  return null;
};
s.loadTodayVisits = () => {
  if(!s.manualMode() || s.vnLoading) return;
  const form = formRef();
  const api = (field.globalUserState || (form && form.userState));
  if(!api || typeof api.runProcess !== 'function'){
    s.vnError = 'ไม่พบตัวเชื่อมข้อมูล Visit'; return;
  }
  s.vnLoading = true;
  s.vnError = '';
  const p = field.params || {};
  api.runProcess(
    LAB_WORKLIST_PROCESS_ID,
    { action:'list_open_visits', organization_code:String(p.organization_code || '') },
    out => {
      s.vnLoading = false;
      const payload = s.extractVisitPayload(out);
      if(!payload){ s.vnRows=[]; s.vnError='รูปแบบข้อมูล Visit ไม่ถูกต้อง'; return; }
      s.vnRows = Array.isArray(payload.visits) ? payload.visits : [];
      s.visitDate = String(payload.visit_date || '');
      if(!s.vnRows.length) s.vnError = 'วันนี้ยังไม่มีผู้ป่วยที่เปิด Visit อยู่';
    },
    error => {
      s.vnLoading = false;
      s.vnRows = [];
      s.vnError = 'อ่าน Visit วันนี้ไม่สำเร็จ: ' + String(error && error.message || error || 'ไม่ทราบสาเหตุ');
    }
  );
};

// ค่าที่ต้องแสดงเป็นข้อความ`)

pt.onMounted = `// LAB launcher โหลดเฉพาะ Visit ที่เปิดอยู่ในวันปัจจุบัน
if(this.vueState.manualMode()) this.vueState.loadTodayVisits();
`

const oldTypes = `const TYPES = [
\t{ code: 'lab', label: 'Lab', prefix: 'L', mode: 'sheet', spec: true },
\t{ code: 'xray', label: 'X-ray', prefix: 'X', mode: 'sheet' },
\t{ code: 'nurs', label: 'หัตถการ', prefix: 'N', mode: 'pick' },
\t{ code: 'order', label: 'บริการอื่นๆ', prefix: 'O', mode: 'pick' },
];`
const newTypes = `const LAB_SCOPE = !!((field.params || {}).lab_scope);
const LAB_ORGANIZATION_CODE = String((field.params || {}).organization_code || '').trim().toUpperCase();
const LAB_SECTION_CODES = (Array.isArray((field.params || {}).section_codes) ? (field.params || {}).section_codes : [])
\t.map(code => String(code || '').trim().toUpperCase()).filter(Boolean);
const ALL_TYPES = [
\t{ code: 'lab', label: 'Lab', prefix: 'L', mode: 'sheet', spec: true },
\t{ code: 'xray', label: 'X-ray', prefix: 'X', mode: 'sheet' },
\t{ code: 'nurs', label: 'หัตถการ', prefix: 'N', mode: 'pick' },
\t{ code: 'order', label: 'บริการอื่นๆ', prefix: 'O', mode: 'pick' },
];
const TYPES = LAB_SCOPE ? ALL_TYPES.filter(type => type.code === 'lab') : ALL_TYPES;`
item.onCreated = replaceOnce(item.onCreated, oldTypes, newTypes, 'CPOE service types')
item.onCreated = replaceOnce(
  item.onCreated,
  `s.TYPES = TYPES;
s.HISTORY = HISTORY;`,
  `s.TYPES = TYPES;
s.HISTORY = HISTORY;
s.labScope = LAB_SCOPE;
s.labOrganizationCode = LAB_ORGANIZATION_CODE;
s.labSectionCodes = LAB_SECTION_CODES;`,
  'CPOE scope state',
)

item.content = replaceOnce(
  item.content,
  `<button :aria-pressed="st === HISTORY.code" @click.stop="setType(HISTORY.code)">{{ HISTORY.label }}</button>`,
  `<button v-if="!labScope" :aria-pressed="st === HISTORY.code" @click.stop="setType(HISTORY.code)">{{ HISTORY.label }}</button>`,
  'hide history in LAB scope',
)

item.onCreated = replaceOnce(
  item.onCreated,
  `{ service_types: TYPES.map((t) => t.code) },`,
  `{ service_types: TYPES.map((t) => t.code), organization_code: LAB_ORGANIZATION_CODE, section_codes: LAB_SECTION_CODES },`,
  'catalog scoped request',
)
item.onCreated = replaceOnce(
  item.onCreated,
  `\t\t\ts.cat = d.catalog || {};
\t\t\ts.catCounts = d.counts || {};
\t\t\ts.catLoaded = true;`,
  `\t\t\tconst catalog = d.catalog || {};
\t\t\tif(LAB_SCOPE){
\t\t\t\tconst allowed = {};
\t\t\t\tLAB_SECTION_CODES.forEach(code => { allowed[code] = true; });
\t\t\t\tconst lab = catalog.lab || { sections: [], items: [] };
\t\t\t\tcatalog.lab = Object.assign({}, lab, {
\t\t\t\t\tsections: (lab.sections || []).filter(section => allowed[String(section && section.code || '').toUpperCase()]),
\t\t\t\t\titems: (lab.items || []).filter(row => allowed[String(row && row.sec || '').toUpperCase()])
\t\t\t\t});
\t\t\t}
\t\t\ts.cat = catalog;
\t\t\ts.catCounts = Object.assign({}, d.counts || {}, LAB_SCOPE ? { lab: ((catalog.lab || {}).items || []).length } : {});
\t\t\ts.catLoaded = true;`,
  'filter LAB catalog response',
)

item.onCreated = replaceOnce(
  item.onCreated,
  `\t\tvisit_id: String((field.params || {}).visit_id || ''),`,
  `\t\tvisit_id: String((s.pt() || {}).visit_id || ''),
\t\torganization_code: LAB_SCOPE ? LAB_ORGANIZATION_CODE : '',
\t\tsection_codes: LAB_SCOPE ? LAB_SECTION_CODES.slice() : [],`,
  'save selected Visit and LAB scope',
)
item.onCreated = replaceOnce(
  item.onCreated,
  `const doSave = (then) => {
\tif (s.saving || !s.cart.length) return;
\ts.saving = true;`,
  `const doSave = (then) => {
\tif (s.saving || !s.cart.length) return;
\tif(LAB_SCOPE){
\t\tconst allowed = {};
\t\tLAB_SECTION_CODES.forEach(code => { allowed[code] = true; });
\t\tconst invalid = s.cart.filter(line => line.st !== 'lab' || !allowed[String(line.sec || '').toUpperCase()]);
\t\tif(invalid.length){
\t\t\tfield.alert('พบรายการที่ไม่ได้อยู่ในห้อง LAB ปัจจุบัน กรุณานำออกจากใบก่อนบันทึก', 'warning');
\t\t\treturn;
\t\t}
\t}
\ts.saving = true;`,
  'LAB scope save guard',
)

const oldCss = `.cpoe-vn-picker{margin-bottom:8px;padding:10px 12px;border:1px solid var(--el-border-color-lighter);border-radius:10px;background:var(--el-fill-color-light)}
.cpoe-vn-search{display:flex;gap:8px;align-items:center}.cpoe-vn-search .el-input{width:min(360px,100%)}
.cpoe-vn-error{margin-top:6px;color:var(--el-color-danger);font-size:12px}
.cpoe-vn-row{display:grid;grid-template-columns:130px minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;margin-top:6px;padding:8px 10px;border:0;border-bottom:1px dashed var(--el-border-color-lighter);background:transparent;text-align:left;color:var(--el-text-color-regular)}
.cpoe-vn-row:hover,.cpoe-vn-row.is-selected{background:var(--el-bg-color);color:var(--el-color-primary)}
.cpoe-vn-code{font-family:var(--font-mono);font-weight:700}.cpoe-vn-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cpoe-vn-age{color:var(--el-text-color-secondary);font-size:12px}
@media(max-width:720px){.cpoe-vn-search{align-items:stretch;flex-direction:column}.cpoe-vn-search .el-input{width:100%}.cpoe-vn-row{grid-template-columns:1fr}.cpoe-vn-name{white-space:normal}}`
const newCss = `.cpoe-vn-picker{margin-bottom:8px;padding:12px;border:1px solid var(--el-border-color-lighter);border-radius:10px;background:var(--el-fill-color-light)}
.cpoe-vn-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;color:var(--el-text-color-primary)}
.cpoe-vn-title span,.cpoe-vn-hint{color:var(--el-text-color-secondary);font-size:12px}
.cpoe-vn-select{width:min(720px,100%)}
.cpoe-vn-error{margin-top:6px;color:var(--el-color-danger);font-size:12px}
.cpoe-vn-hint{margin-top:6px}
@media(max-width:720px){.cpoe-vn-title{align-items:flex-start;flex-direction:column}.cpoe-vn-select{width:100%}}`
form.formConfig.cssCode = replaceOnce(form.formConfig.cssCode, oldCss, newCss, 'manual Visit picker CSS')

fs.writeFileSync(file, JSON.stringify(form, null, 2) + '\n')
console.log('Updated', file)
