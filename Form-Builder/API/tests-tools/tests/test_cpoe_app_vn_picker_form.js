const assert = require('assert')
const fs = require('fs')
const path = require('path')

/* ฟอร์ม CPOE Order App ที่เพิ่ม "ช่องเลือก VN ทางเลือกที่สอง" (ผู้ใช้ขอ 2026-09-03)

   คำสั่งผู้ใช้: "ทุกอย่างเหมือนเดิมเป๊ะ แค่เพิ่มเงื่อนไขการเลือก VN ได้เฉย ๆ"
   ⇒ เทสนี้บังคับสองอย่างพร้อมกัน:
     1. ทุก key ในฟอร์มต้องเท่ากับต้นฉบับทุกตัวอักษร ยกเว้น pt_header,
        สิทธิ์ตาม Visit, Hematology visual merge และ CSS ที่ตั้งใจแก้
     2. เส้นทางเดิม (VN มาจาก EMR ผ่าน field.params) ต้องยังอยู่ครบ */
const root = path.resolve(__dirname, '../../../..')
const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))

const source = read('Form-Builder/SDForm/sdform_module/EMR_form/CPOE_app.json')
const form = read('Form-Builder/SDForm/form-factory/forms/cpoe-order-app-vn-picker-v1.json')

const findNamed = (node, name) => {
  let hit = null
  const walk = value => {
    if (!value || typeof value !== 'object') return
    if (value.name === name) hit = value
    if (Array.isArray(value)) value.forEach(walk)
    else Object.values(value).forEach(walk)
  }
  walk(node)
  assert(hit, 'field not found: ' + name)
  return hit
}

/* ── 1. ต่างจากต้นฉบับได้เฉพาะจุดที่ตั้งใจแก้ ─────────────────────────────── */
const diffs = []
const compare = (a, b, trail) => {
  if (a === b) return
  const typeA = Array.isArray(a) ? 'array' : typeof a
  const typeB = Array.isArray(b) ? 'array' : typeof b
  const isBox = typeA === 'object' || typeA === 'array'
  if (typeA !== typeB || a === null || b === null || !isBox) {
    diffs.push(trail)
    return
  }
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])]
  keys.forEach(key => compare(a[key], b[key], trail ? trail + '.' + key : key))
}
compare(source, form, '')

const allowed = [
  'formConfig.cssCode',
  'fields.0.cols.0.fields.0.options.content',
  'fields.0.cols.0.fields.0.options.onCreated',
  'fields.0.cols.0.fields.0.options.onMounted',
  'fields.0.cols.0.fields.1.options.content',
  'fields.0.cols.0.fields.1.options.onCreated',
]
assert.deepStrictEqual(
  diffs.slice().sort(), allowed.slice().sort(),
  'แก้ได้เฉพาะ pt_header, Hematology visual merge ใน item_screen และ cssCode',
)

/* 2026-09-04: ยอมให้ item_screen ต่างได้เฉพาะ content/onCreated ของ Hematology visual merge
   แต่ option อื่นทุกตัวต้องเหมือนเดิม */
const sourceScreen = findNamed(source, 'item_screen')
const screen = findNamed(form, 'item_screen')
assert(sourceScreen.content.includes('ไม่ได้รับ patient context — ฟอร์มแม่ต้องส่งมาทาง params ไม่ใช่ initData'),
  'ต้นฉบับต้องยังเก็บ diagnostic เดิมไว้เพื่อยืนยันว่าตัวสร้างลบจากโคลนจริง')
assert(!screen.content.includes('ไม่ได้รับ patient context'),
  'ฟอร์มโคลนที่ผู้ใช้เปิดต้องไม่แสดง diagnostic patient context')
assert(!screen.content.includes('ฟอร์มแม่ต้องส่งมาทาง params ไม่ใช่ initData'))
assert(screen.onCreated.includes("const cb = (field.params || {}).on_order_sent;"),
  'CPOE must expose an optional callback for the parent after send succeeds')
assert(screen.onCreated.includes("if (typeof cb === 'function') cb();"))
assert(screen.onCreated.includes("notifySent();\n\t\t\t\tfield.alert('ส่งใบ '"),
  'send callback must run only in the successful cpoe-order-send branch')
const sourceScreenStable = { ...sourceScreen }
const screenStable = { ...screen }
delete sourceScreenStable.content
delete sourceScreenStable.onCreated
delete screenStable.content
delete screenStable.onCreated
assert.deepStrictEqual(screenStable, sourceScreenStable,
  'item_screen ต่างได้เฉพาะ content/onCreated ของ Hematology visual merge')

const sourceHeader = findNamed(source, 'pt_header')
const header = findNamed(form, 'pt_header')
assert.deepStrictEqual(
  Object.keys(header), Object.keys(sourceHeader),
  'โครง option ของ pt_header ต้องครบเท่าเดิม',
)

/* ── 2. เส้นทางเดิม: VN มาจาก EMR ผ่าน params ─────────────────────────────── */
assert(header.onCreated.includes('s.manualMode = () => !!((field.params || {}).manual_visit);'),
  'ตัวแยกโหมดเดิมต้องอยู่ครบ')
assert(header.onCreated.includes("const m = () => s.manualContext || ((formRef() || {}).$labCpoeContext) || field.params || {};"),
  'ลำดับการอ่าน context เดิม (เลือกเอง → ของฟอร์ม → params ของ EMR) ห้ามเปลี่ยน')
assert(header.onCreated.includes('s.ptText = (key) => {'), 'ตัวอ่านค่าคนไข้เดิมยังอยู่')
assert(!header.onCreated.includes('crudGetAll'), 'ไม่ได้เพิ่ม query ใหม่ในจอนี้')

/* ── 3. ช่องเลือก VN ใช้ได้ทุกโหมด ────────────────────────────────────────── */
assert(sourceHeader.content.includes('<div v-if="manualMode()" class="cpoe-vn-picker">'),
  'ต้นฉบับซ่อน picker ไว้เฉพาะโหมด manual (ถ้าข้อนี้พัง แปลว่าต้นฉบับเปลี่ยนไปแล้ว)')
assert(header.content.includes('<div class="cpoe-vn-picker">'), 'ของใหม่ไม่ผูกกับโหมดแล้ว')
assert(!header.content.includes('v-if="manualMode()" class="cpoe-vn-picker"'))
assert(header.content.includes('{{ vnPickerTitle() }}'), 'หัวข้อเปลี่ยนตามโหมด')
assert(header.content.includes('{{ vnPickerHint() }}'))
assert(header.onCreated.includes('s.vnPickerTitle ='))
assert(header.onCreated.includes('s.vnPickerHint ='))

/* el-select ตัวเดิม (ตัวเลือก · ค้นหา · ล้างค่า) ต้องไม่ถูกแก้ */
assert(header.content.includes('<el-select :model-value="selectedVisitId" class="cpoe-vn-select" size="large"'))
assert(header.content.includes('filterable clearable :loading="vnLoading"'))
assert(header.content.includes('@change="selectVisitById"'))
assert(header.content.includes('v-for="visit in vnRows"'))

/* โหลดรายการ Visit ทุกโหมด */
assert(!header.onCreated.includes('if(!s.manualMode() || s.vnLoading) return;'), 'เอาเงื่อนไขกันโหมดออกแล้ว')
assert(header.onCreated.includes('if(s.vnLoading) return;'), 'ยังกันการโหลดซ้อนเหมือนเดิม')
assert(header.onMounted.includes('this.vueState.loadTodayVisits();'))
assert(!header.onMounted.includes('if(this.vueState.manualMode())'))
assert(header.onCreated.includes("action:'list_open_visits'"), 'ยังใช้ Process/action เดิม ไม่ได้สร้างทางใหม่')
assert(header.onCreated.includes("const LAB_WORKLIST_PROCESS_ID = '6a9434c3422c1ca959829d5e';"),
  'ยังอ่านจาก Process เดิมตัวเดียวกัน')

/* ── 4. ล้างช่อง = กลับไปใช้ VN เดิม ทั้งหัวจอและจอสั่งรายการ ─────────────── */
const clearBranch = header.onCreated.slice(
  header.onCreated.indexOf('s.selectVisitById = id =>'),
  header.onCreated.indexOf('s.extractVisitPayload'),
)
assert(clearBranch.includes('s.manualContext = null;'), 'ล้างค่าที่หัวจอ')
assert(clearBranch.includes('form.$labCpoeContext = null;'), 'ล้าง context ที่ฟอร์มถือไว้')
assert(clearBranch.includes('setPatientContext(null)'),
  'ต้องบอกจอสั่งรายการด้วย ไม่งั้นหัวจอกับจอล่างจะเป็นคนละคนไข้')

/* ── 5. เตือนเมื่อ VN ที่ใช้อยู่ไม่ใช่ของ EMR ─────────────────────────────── */
assert(header.content.includes('v-if="vnOverridden()"'))
assert(header.onCreated.includes('s.vnOverridden = () => {'))
assert(header.onCreated.includes('s.emrVisitId = ()'))
assert(form.formConfig.cssCode.includes('.cpoe-vn-override{'), 'มีสไตล์ของแถบเตือน')
assert(
  source.formConfig.cssCode.split('\n').every(line => form.formConfig.cssCode.includes(line)),
  'CSS เดิมทุกบรรทัดต้องยังอยู่ — เพิ่มได้อย่างเดียว ห้ามแก้ของเดิม',
)

/* ── 6. โหมด manual เดิมต้องยังทำงานเหมือนเดิม ───────────────────────────── */
assert(header.onCreated.includes("s.vnPickerTitle = () => s.manualMode()"),
  'โหมด manual ยังได้ข้อความเดิม "เลือกผู้ป่วยที่เปิด Visit วันนี้"')
assert(header.onCreated.includes("? 'เลือกผู้ป่วยที่เปิด Visit วันนี้'"))
assert(header.onCreated.includes("? 'แสดงเฉพาะ Visit วันที่วันนี้ที่สถานะยังเปิดอยู่'"))

/* ── 6a. ตัวเลือก VN แสดงวันที่ Visit แบบไทยสำหรับทุกห้อง LAB ───────────── */
const visitLabelRuntime = { vueState: {}, params: { lab_scope: true }, getFormRef: () => ({}) }
new Function(header.onCreated).call(visitLabelRuntime)
assert.strictEqual(
  visitLabelRuntime.vueState.visitOptionLabel({
    _id: 'VISIT-THAI-DATE',
    vn: '6900325',
    visit_date: '2026-09-29T08:15:00+07:00',
    pid: { hn: '6900023', prename: { label: 'นาย' }, p_fname: 'ปฏิวัติ', p_lname: 'แก้วสิทธิ์' },
  }),
  'HN6900023 · VN6900325 · 29 กันยายน 2569 · นาย ปฏิวัติ แก้วสิทธิ์',
  'วันที่ในตัวเลือก VN ต้องมาจาก Visit และแสดงเดือนภาษาไทยกับปี พ.ศ.',
)
assert.strictEqual(
  visitLabelRuntime.vueState.visitOptionLabel({ vn: '6900999', pid: { hn: '6900998', p_fname: 'ไม่มีวันที่' } }),
  'HN6900998 · VN6900999 · ไม่มีวันที่',
  'ถ้า Visit ไม่มีวันที่ต้องไม่สร้างวันที่จากเครื่องหรือแสดงตัวคั่นซ้ำ',
)
const normalCpoeLabelRuntime = { vueState: {}, params: {}, getFormRef: () => ({}) }
new Function(header.onCreated).call(normalCpoeLabelRuntime)
assert.strictEqual(
  normalCpoeLabelRuntime.vueState.visitOptionLabel({
    vn: '6900325', visit_date: '2026-09-29', pid: { hn: '6900023', p_fname: 'ผู้ป่วย' },
  }),
  'HN6900023 · VN6900325 · ผู้ป่วย',
  'หน้า CPOE ปกติที่ไม่ได้เปิดจาก LAB Worklist ต้องคง label เดิม',
)

/* ── 7. สิทธิ์ต้องตาม Visit ที่เลือก ไม่ใช่ params ตอนเปิดฟอร์ม ─────────────── */
assert(screen.onCreated.includes('const rows = (s.pt() || {}).inscl_hos;'),
  'สิทธิ์ต้องอ่านจาก patient/Visit context ปัจจุบัน')
assert(!screen.onCreated.includes('const rows = (field.params || {}).inscl_hos;'),
  'ห้ามยึดสิทธิ์จาก params ตอนเปิดฟอร์ม เพราะ Worklist ไม่ได้ส่ง inscl_hos มาทางนั้น')
assert(screen.onCreated.includes('s.manualContext = ctx || null;\n  s.insIx = 0;'),
  'เปลี่ยน Visit ต้อง reset ไปสิทธิ์แรกของ Visit ใหม่')

const rightsContext = {
  visit_id: 'VISIT-OFC',
  inscl_hos: [{
    inscl_item_main: { value: 'OFC', label: 'ราชการ' },
    inscl_item_sub: { value: '1001b', label: 'ข้าราชการ(จ่ายตรง)' },
  }],
}
const rightsRuntime = {
  vueState: {},
  params: { manual_visit: true },
  getFormRef: () => ({ $labCpoeContext: rightsContext }),
}
new Function(screen.onCreated).call(rightsRuntime)
assert.deepStrictEqual(rightsRuntime.vueState.insList(), [{
  main: 'OFC',
  sub: '1001b',
  label: 'ราชการ / ข้าราชการ(จ่ายตรง)',
}], 'แม้ params ไม่มี inscl_hos dropdown ก็ต้องเห็นสิทธิ์ OFC จาก Visit context')
assert.strictEqual(rightsRuntime.vueState.insCurrent().main, 'OFC',
  'สิทธิ์แรกของ Visit ต้องถูกเลือกเป็นค่าเริ่มต้น')
assert(screen.content.includes(
  '<select class="ins-locked" :value="insIx" disabled aria-readonly="true" tabindex="-1">',
), 'ช่องสิทธิ์ต้องแสดงค่าเดิมในรูปแบบ select แต่ถูก disable และข้าม focus')
assert(!screen.content.includes('<select :value="insIx" @change="setIns($event.target.value)">'),
  'ห้ามมี change handler ที่ทำให้เปลี่ยนสิทธิ์จากหน้าใบสั่ง')
assert(screen.content.includes('<option v-for="(r, i) in insList()"'),
  'ตัวเลือกเดิมต้องยังรับ label สิทธิ์จาก Visit เพื่อแสดงผล')
assert(screen.onCreated.includes('const ins = s.insCurrent();\n\treturn {'),
  'payload ต้องยังอ่านสิทธิ์ผู้ป่วยจาก insCurrent เดิม')
assert(form.formConfig.cssCode.includes('.cpoe-item .fld select.ins-locked{-webkit-appearance:none;appearance:none;'),
  'ต้องซ่อนลูกศร native dropdown เฉพาะช่องสิทธิ์')
assert(form.formConfig.cssCode.includes('pointer-events:none;cursor:not-allowed;opacity:1;'),
  'ช่องสิทธิ์ต้องคลิกไม่ได้แต่ยังอ่านค่าได้ชัดเจน')

/* ── 8. Hematology visual merge เฉพาะ Cpoe_test_order (2026-09-04) ────────── */
assert(screen.content.includes('{{ r.displayCode || r.code }}'), 'แท็บรวมต้องแสดง HM / HH ได้')
assert(screen.content.includes('v-if="g.bucketStart" class="hem-bucket"'), 'ต้องมีหัวแบ่งสองส่วนในรายการ')
assert(screen.onCreated.includes("const HEM_TAB_CODE = 'HEM';"))
assert(screen.onCreated.includes('sec: realSectionCode(item),'), 'ตะกร้าต้องเก็บรหัส section จริง')

const itemRuntime = { vueState: {}, params: {}, getFormRef: () => ({}) }
new Function(screen.onCreated).call(itemRuntime)
const state = itemRuntime.vueState
const catalogItem = (sec, code, group) => ({
  id: code, c: code, n: code, p: 100, cv: 0, sp: '', spn: '', sec,
  g: group, gs: 1, one: true, sub: [], par: '', sk: '',
})

/* จงใจส่ง HH มาก่อน เพื่อพิสูจน์ว่าหน้าจอจัด HM ก่อน HH เสมอ */
const merged = state.mergeHematologyCatalog({
  lab: {
    sections: [
      { code: 'HH', name: 'Hematology-Homeostasis', n: 1, g: 1 },
      { code: 'HM', name: 'Hematology', n: 1, g: 1 },
      { code: 'BC', name: 'Biochemistry', n: 1, g: 1 },
    ],
    items: [
      catalogItem('HH', 'HH1', 'Coagulation'),
      catalogItem('HM', 'HM1', 'CBC'),
      catalogItem('BC', 'BC1', 'Chemistry'),
    ],
  },
})
assert.deepStrictEqual(
  merged.lab.sections.map(row => ({ code: row.code, displayCode: row.displayCode || '', name: row.name, n: row.n })),
  [
    { code: 'HEM', displayCode: 'HM / HH', name: 'Hematology', n: 2 },
    { code: 'BC', displayCode: '', name: 'Biochemistry', n: 1 },
  ],
  'HM/HH ต้องเหลือแท็บเดียว ส่วน BC ต้องเหมือนเดิม',
)
assert.deepStrictEqual(
  merged.lab.items.map(row => ({ code: row.c, ui: row.sec, real: row.sourceSec || row.sec })),
  [
    { code: 'HH1', ui: 'HEM', real: 'HH' },
    { code: 'HM1', ui: 'HEM', real: 'HM' },
    { code: 'BC1', ui: 'BC', real: 'BC' },
  ],
  'รหัสจริง HM/HH ต้องไม่ถูกทับด้วย HEM',
)

state.cat = merged
state.catLoaded = true
state.st = 'lab'
state.sec.lab = 'HEM'
state.q.lab = ''
state.grp.lab = ''
state.bp.lab = ''
state.recompute()
assert.deepStrictEqual(state.view.rail.map(row => row.name), ['Hematology', 'Biochemistry'])
assert.strictEqual(state.view.rail[0].displayCode, 'HM / HH')
assert.strictEqual(state.view.head.title, 'Hematology')
assert.deepStrictEqual(
  state.view.groups.filter(group => group.bucketStart).map(group => [group.bucketCode, group.bucketName]),
  [['HM', 'Hematology'], ['HH', 'Hematology-Homeostasis']],
  'ในแท็บรวมต้องแบ่งรายการเป็น HM และ HH ตามลำดับ',
)
state.toggleItem(state.view.groups[0].rows[0])
state.toggleItem(state.view.groups[1].rows[0])
assert.deepStrictEqual(state.cart.map(line => line.sec), ['HM', 'HH'],
  'กดเลือกจากแท็บรวมแล้วตะกร้าต้องยังเก็บ HM/HH แยกกัน')

/* ── 9. LAB Immunology ต้องเลือกทีละรายการ ไม่มีปุ่ม All ระดับกลุ่ม ────────── */
assert(screen.content.includes(
  '<button v-if="!immunologyLabScope" class="grp-all" :class="{ on: g.allOn }"',
), 'ปุ่ม All ระดับกลุ่มต้องถูกซ่อนด้วยบริบท Immunology เท่านั้น')
assert(screen.content.includes('<input type="checkbox" :checked="i._on" @change="toggleItem(i)">'),
  'checkbox เลือกรายการทีละรายการต้องยังอยู่')
assert(screen.onCreated.includes("const IMMUNOLOGY_SECTION_CODES = ['IM', 'MI-OUT'];"))

const immunologyRuntime = {
  vueState: {},
  params: { lab_scope: true, organization_code: '30', section_codes: ['IM'] },
  getFormRef: () => ({}),
}
new Function(screen.onCreated).call(immunologyRuntime)
assert.strictEqual(immunologyRuntime.vueState.immunologyLabScope, true,
  'LAB IM ต้องซ่อนปุ่ม All ระดับกลุ่ม')

const immunologyOutsourceRuntime = {
  vueState: {},
  params: { lab_scope: true, organization_code: '31', section_codes: ['MI-OUT'] },
  getFormRef: () => ({}),
}
new Function(screen.onCreated).call(immunologyOutsourceRuntime)
assert.strictEqual(immunologyOutsourceRuntime.vueState.immunologyLabScope, true,
  'LAB MI-OUT ต้องใช้กติกาเดียวกับ Immunology')

const biochemistryRuntime = {
  vueState: {},
  params: { lab_scope: true, organization_code: '10', section_codes: ['BC'] },
  getFormRef: () => ({}),
}
new Function(screen.onCreated).call(biochemistryRuntime)
assert.strictEqual(biochemistryRuntime.vueState.immunologyLabScope, false,
  'LAB ห้องอื่นต้องยังเห็นและใช้ปุ่ม All ได้เหมือนเดิม')

const emrRuntime = { vueState: {}, params: {}, getFormRef: () => ({}) }
new Function(screen.onCreated).call(emrRuntime)
assert.strictEqual(emrRuntime.vueState.immunologyLabScope, false,
  'หน้า CPOE ปกติที่ไม่ได้เปิดจาก LAB Worklist ต้องไม่ถูกกระทบ')

/* ── 10. ช่องค้นหาเด่นขึ้นเฉพาะ LAB Worklist ─────────────────────────────── */
assert(screen.content.includes(`<div class="cpoe-item" :class="{ 'is-lab-scope': labScope }"`),
  'root ต้องมี class ตาม LAB scope เพื่อไม่ให้ style ลามไป CPOE ปกติ')
assert(form.formConfig.cssCode.includes('.cpoe-item.is-lab-scope .sh-hd .find{flex:0 1 320px;'),
  'ช่องค้นหา LAB ต้องกว้างขึ้น')
assert(form.formConfig.cssCode.includes('.cpoe-item.is-lab-scope .sh-hd .find input{width:100%;border:2px solid'),
  'ช่องค้นหา LAB ต้องมีกรอบที่สังเกตง่ายขึ้น')
assert(!source.formConfig.cssCode.includes('.cpoe-item.is-lab-scope .sh-hd .find'),
  'style ใหม่ต้องอยู่เฉพาะ candidate ไม่แก้แม่แบบ CPOE เดิม')

/* ── 11. modal ระบุสิ่งส่งตรวจเดิมต้องอยู่ครบและเปิดได้จากทุก LAB Item ───── */
assert(screen.content.includes('class="ask-box" role="dialog" aria-modal="true" aria-label="ระบุสิ่งส่งตรวจ"'),
  'template modal ระบุสิ่งส่งตรวจห้ามหาย')
assert(screen.content.includes('v-if="canOpenSpec(l) && !specBar(l)"'),
  'LAB Item ที่ master มี specimen แล้วต้องมีปุ่มเปิด modal เดิม')
assert(screen.content.includes('@click="openSpec(ix)">ระบุสิ่งส่งตรวจ</button>'))
assert(screen.onCreated.includes('s.canOpenSpec = (l) => LAB_SCOPE && !!l && l.st === \'lab\' && isSetLead(l);'))
assert(screen.onCreated.includes("if (!needSpec(l) && !(l && l.lab_data)) return null;"),
  'หลังบันทึก optional specimen detail ต้องแสดง summary เดิมได้')
assert(screen.content.includes('<button class="btn btn-primary" style="flex:none" @click="saveSpec()">บันทึก</button>'),
  'Source of specimen ว่างต้องยังกดบันทึกได้ตามที่ผู้ใช้ยืนยัน 2026-09-29')
assert(!screen.content.includes(':disabled="!specForm.source"'),
  'ห้ามปิดปุ่มบันทึกเพราะ Source of specimen ว่าง')

const specimenTubeIx = screen.content.indexOf('<span v-if="l.sp && !l.set">· หลอด {{ l.sp }}</span>')
const specimenBreakIx = screen.content.indexOf('class="spec-break"', specimenTubeIx)
const specimenButtonIx = screen.content.indexOf('class="spec-open"', specimenBreakIx)
const selfPayIx = screen.content.indexOf('<b class="m-paid-t">ชำระเอง', specimenButtonIx)
assert(specimenTubeIx >= 0 && specimenBreakIx > specimenTubeIx && specimenButtonIx > specimenBreakIx && selfPayIx > specimenButtonIx,
  'ปุ่มระบุสิ่งส่งตรวจต้องอยู่แถวล่างหลังข้อมูลหลอดและก่อนข้อความชำระเงิน')
assert(form.formConfig.cssCode.includes('.cpoe-item .line .m .spec-break{flex-basis:100%;height:0}'),
  'ต้องบังคับตำแหน่งปุ่มลงแถวล่างเหมือน UI เดิม')
assert(form.formConfig.cssCode.includes('.cpoe-item .line .m .spec-open{border:1px solid var(--accent);'),
  'ปุ่มต้องเป็นขอบสีเขียวเข้มตามรูปแบบเดิม')

const specimenModalRuntime = {
  vueState: {}, params: { lab_scope: true, section_codes: ['IM'] }, getFormRef: () => ({}),
}
new Function(screen.onCreated).call(specimenModalRuntime)
const specimenState = specimenModalRuntime.vueState
specimenState.cart = [{ st: 'lab', c: 'IM2', n: 'Anti-HIV', sp: 'BL', spn: 'Blood', set: '', lab_data: null }]
assert.strictEqual(specimenState.canOpenSpec(specimenState.cart[0]), true,
  'LAB Item ที่มี specimen BL ต้องเปิด modal ระบุสิ่งส่งตรวจได้')
assert.strictEqual(specimenState.missSpec().length, 0,
  'การคืนปุ่ม modal ห้ามเปลี่ยน specimen BL ให้กลายเป็นข้อมูลบังคับ')
assert.strictEqual(specimenState.specBar(specimenState.cart[0]), null,
  'ก่อนกรอก optional detail ให้ใช้ปุ่มเล็ก ไม่เพิ่มแถบเตือน')
specimenState.cart[0].lab_data = { source: 'เลือดผู้ป่วย', storage: 'IM', at: '2026-09-29T09:15', by: 'Tester' }
assert.strictEqual(specimenState.specBar(specimenState.cart[0]).done, true,
  'หลังกรอกต้องใช้แถบสรุปเดิมของ modal')

/* เปลี่ยน assertion เดิมตามคำสั่งผู้ใช้ 2026-09-29: source เป็น optional */
specimenState.cart[0].lab_data = null
specimenState.specIx = 0
specimenState.specForm = { source: '', storage: 'IM', at: '2026-09-29T09:20', by: 'Tester' }
specimenState.saveSpec()
assert.strictEqual(specimenState.cart[0].lab_data.source, '',
  'บันทึก modal ได้แม้ Source of specimen ว่าง')
assert.strictEqual(specimenState.specBar(specimenState.cart[0]).done, true,
  'หลังบันทึก source ว่างต้องแสดงว่า modal ถูกบันทึกแล้ว')
assert.strictEqual(specimenState.missSpec().length, 0,
  'source ว่างหลังบันทึกต้องไม่บล็อกการส่ง Order')

/* modal handler/validation สำคัญต้องคงอยู่ ไม่เปลี่ยน flow บันทึก */
assert(screen.onCreated.includes('s.openSpec = (ix) => {'))
assert(screen.onCreated.includes('s.closeSpec = () => {'))
assert(screen.onCreated.includes('s.saveSpec = () => {'))
assert(!screen.onCreated.includes("if (!String(s.specForm.source || '').trim()) return;"),
  'Source of specimen ต้องไม่เป็น validation บังคับ')
assert(screen.onCreated.includes('if (s.missSpec().length) return;'))

const hmOnly = { lab: { sections: [{ code: 'HM', name: 'Hematology', n: 1 }], items: [catalogItem('HM', 'HM2', 'CBC')] } }
assert.strictEqual(state.mergeHematologyCatalog(hmOnly), hmOnly,
  'LAB scope ที่มีแค่ห้องเดียวต้องไม่ถูกเปลี่ยนหน้าจอ')

console.log('CPOE Order App · VN picker form tests passed')
