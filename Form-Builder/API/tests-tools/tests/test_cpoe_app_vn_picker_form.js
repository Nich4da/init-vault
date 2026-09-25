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

/* ── 7. สิทธิ์ต้องตาม Visit ที่เลือก ไม่ใช่ params ตอนเปิดฟอร์ม ─────────────── */
assert(screen.onCreated.includes('const rows = (s.pt() || {}).inscl_hos;'),
  'dropdown สิทธิ์ต้องอ่านจาก patient/Visit context ปัจจุบัน')
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

const hmOnly = { lab: { sections: [{ code: 'HM', name: 'Hematology', n: 1 }], items: [catalogItem('HM', 'HM2', 'CBC')] } }
assert.strictEqual(state.mergeHematologyCatalog(hmOnly), hmOnly,
  'LAB scope ที่มีแค่ห้องเดียวต้องไม่ถูกเปลี่ยนหน้าจอ')

console.log('CPOE Order App · VN picker form tests passed')
