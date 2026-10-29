/* ล็อกหน้า "ประวัติการใช้สารทึบรังสี" (xray-contrast-history-v1.json)
 *
 * 🔴 เขียน assertion ชุดนี้ใหม่ 2026-10-02 ตามคำสั่งผู้ใช้ — ไม่ใช่การลดความเข้ม
 *    ของเทสเดิมเพื่อให้ของใหม่ผ่าน แต่เพราะผู้ใช้เปลี่ยนแบบหน้าจอเอง 2 รอบ:
 *      1) 2026-09-28 ให้ยก pattern ของ X-ray CPOE Worklist มาใช้แทนแท็บสืบค้นผลแลป
 *         ⇒ assertion เดิมที่ล็อกคลาส .xll-* ใช้ไม่ได้อีก เปลี่ยนเป็นล็อก .xr-*
 *      2) 2026-10-02 ให้เอา chip กรองสถานะออก เพราะหน้านี้ไม่ได้มาดูผล/สถานะ
 *         ⇒ assertion เดิมที่บังคับให้มี chip ถูกแทนด้วย assertion ที่ "ห้ามมี" chip
 *    สิ่งที่เทสเดิมปกป้องไว้ยังอยู่ครบทุกข้อ: read-only · ไม่มีปุ่มสั่งงาน ·
 *    ขอบเขตการค้น · ถ้อยคำ "ยังไม่ได้บันทึก" · ไม่มี specimen · options ครบตามแม่แบบ
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const root = path.join(__dirname, '../../../..')
const script = path.join(root, 'Form-Builder/seed/tests-tools/scripts/build_xray_contrast_history_ui.js')
const jsonPath = path.join(root, 'Form-Builder/SDForm/X-ray/xray-contrast-history-v1.json')
const worklistPath = path.join(root, 'Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json')

/* generator เป็นแหล่งความจริง — แก้ JSON ด้วยมือแล้วลืมแก้สคริปต์ รอบ generate ถัดไปงานหาย */
const before = fs.readFileSync(jsonPath, 'utf8')
execFileSync('node', [script], { cwd: root })
assert.strictEqual(
  fs.readFileSync(jsonPath, 'utf8'), before,
  'the committed JSON must match what the generator produces — regenerate it',
)

const form = JSON.parse(before)

/* ── โครงไฟล์ตามกฎ SDFORM_JSON_RULES.md (SDFORM-RULES-OK-2026-08-25) ───────── */
assert.strictEqual(form.fields.length, 1, 'ต้องมี container เดียวที่ root')
const grid = form.fields[0]
assert.strictEqual(grid.component, 'grid')
const col = grid.cols[0]
assert.strictEqual(col.component, 'grid-col')
assert(Array.isArray(col.fields) && col.fields.length === 1, 'ลูกต้องอยู่ใน .fields ไม่ใช่ .widgetList')
const widget = col.fields[0]
assert.strictEqual(widget.component, 'vue-ui')
assert.deepStrictEqual(
  Object.keys(widget.options).sort(),
  ['columnSpan', 'content', 'customClass', 'hidden', 'label', 'name', 'onCreated', 'onMounted', 'onUnmount'],
  'ชุด options ของ vue-ui ต้องครบตามแม่แบบ ห้ามเพิ่มหรือลด',
)
assert.strictEqual(widget.options.customClass, '', 'ห้ามยัดคลาสลง options.customClass ของ widget (§12.4)')
assert(Array.isArray(form.formConfig.customClass), 'formConfig.customClass ต้องเป็นอาร์เรย์')

const names = []
const walk = node => {
  if (Array.isArray(node)) return node.forEach(walk)
  if (!node || typeof node !== 'object') return
  if (node.options && node.options.name) names.push(node.options.name)
  assert.notStrictEqual(node.component, 'tab', 'หน้านี้ไม่มี tab — และห้ามซ้อน tab ใน tab-pane เด็ดขาด')
  walk(node.fields); walk(node.cols); walk(node.tabs)
}
walk(form.fields)
assert.strictEqual(new Set(names).size, names.length, 'options.name ห้ามซ้ำ')

const content = widget.options.content
const code = widget.options.onCreated
const css = form.formConfig.cssCode
const worklistCss = JSON.parse(fs.readFileSync(worklistPath, 'utf8')).formConfig.cssCode
const ruleBody = (source, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(escaped + '\\{([^}]*)\\}'))
  assert(match, 'ไม่พบ CSS rule: ' + selector)
  return match[1]
}

/* ── read-only เท่านั้น ─────────────────────────────────────────────────────── */
;['cancel_order', 'dispatch', 'reject', 'accept', 'queue_call', 'queue_done'].forEach(action => {
  assert(!code.includes("action:'" + action + "'"), 'ห้ามมี action เขียน: ' + action)
})
assert(code.includes("action:'list'"), 'ต้องเรียก action list ของ Process worklist เดิม')
assert(code.includes("const WORKLIST_PROCESS_ID='6a957009422c1ca959829e45'"),
  'ต้องใช้ Process เดิมของ X-ray Worklist ห้ามสร้าง Process ใหม่')
;['ส่งเข้าเครื่อง', 'ยกเลิก order', 'ตรวจใหม่', 'สร้างรายการใหม่', 'หนังสือยินยอม'].forEach(label => {
  assert(!content.includes('>' + label + '<'), 'ห้ามมีปุ่มสั่งงาน: ' + label)
})
;['xr-item-check-cell', 'el-checkbox', 'xr-create-button', 'xr-consent-button', 'xr-item-sticker-action']
  .forEach(cls => assert(!content.includes(cls), 'ห้ามมีของฝั่งเขียน: ' + cls))
assert(content.includes('อ่านอย่างเดียว'), 'ต้องบอกผู้ใช้ว่าอ่านอย่างเดียว')

/* ── ไม่มี chip กรองสถานะ (ผู้ใช้สั่ง 2026-10-02) ───────────────────────────
   หน้านี้ตอบคำถามเดียว: order นี้มีคนแนบใบบันทึกสารทึบไว้หรือยัง */
assert(!content.includes('xr-status-strip'), 'ห้ามมีแถบ chip กรองสถานะ')
assert(!content.includes('xr-status-chip'), 'ห้ามมี chip กรองสถานะ')
assert(!content.includes('statusFilters'), 'ห้ามมีรายการตัวกรองสถานะ')
assert(!content.includes('xr-modality-select'), 'ผู้ใช้ให้เอา dropdown กรองเครื่องออก')
assert(!content.includes('aria-label="กรองตามเครื่อง"'), 'ห้ามเหลือ control กรองเครื่อง')
/* 2026-10-18 ผู้ใช้กากบาทคอลัมน์สถานะทั้งระดับใบและระดับรายการออกจากหน้าดู */
assert(!content.includes('data-label="สถานะ"'), 'หน้าดูสารทึบไม่ต้องมีคอลัมน์สถานะ')

/* ── pattern ยกจาก X-ray CPOE Worklist ────────────────────────────────────── */
;['xr-toolbar', 'xr-search-control', 'xr-date-control', 'xr-worklist-shell', 'xr-worklist',
  'xr-list-head', 'xr-patient-block', 'xr-patient-row', 'xr-expand-button', 'xr-patient-summary',
  'xr-context-tags', 'xr-metric', 'xr-doctor-cell', 'xr-row-actions',
  'xr-detail-panel', 'xr-item-grid', 'xr-item-head', 'xr-item-row', 'xr-empty'].forEach(cls => {
  assert(content.includes(cls), 'ต้องใช้คลาสเดิมของ Worklist: ' + cls)
  assert(css.includes(cls), 'CSS ต้องมีคลาส ' + cls)
})
/* xr-order-cell เป็น hook ใน markup ที่ Worklist ตัวจริงก็ไม่มีกฎ CSS ของตัวเอง
   (จัดรูปด้วย .xr-metric) — ล็อกไว้แค่ว่าต้องอยู่ใน markup เหมือนต้นฉบับ */
assert(content.includes('xr-order-cell'), 'ต้องใช้คลาสเดิมของ Worklist: xr-order-cell')
assert(css.startsWith('.xray-contrast-history{'), 'CSS ต้อง scope ใต้ root ของหน้านี้')
assert(!css.includes('.xray-cpoe'), 'ห้ามเหลือ scope ของ Worklist มาทับสไตล์ฟอร์มอื่น')
;['.xr-detail-panel', '.xr-detail-top', '.xr-item-head', '.xr-item-row',
  '.xr-item-contrast', '.xr-contrast-chip'].forEach(suffix => {
  assert.strictEqual(
    ruleBody(css, '.xray-contrast-history ' + suffix),
    ruleBody(worklistCss, '.xray-cpoe ' + suffix),
    'ต้อง clone CSS จาก Worklist ตรง ๆ: ' + suffix,
  )
})
assert(css.includes('grid-template-columns:30px minmax(165px,1.3fr) minmax(142px,1fr) 92px 94px 126px minmax(110px,.95fr) 196px'),
  'หัวระดับ order ต้องใช้ tracks เดิมของ Worklist แล้วตัดเฉพาะสถานะออก')
assert(css.includes('.xr-row-actions{display:flex;align-items:center;justify-content:flex-start;'),
  'สารทึบระดับ order ต้องชิดซ้ายของคอลัมน์')

/* หัวตาราง item — คงข้อมูลบุคลากรแบบอ่านอย่างเดียว และตัดคอลัมน์ที่ผู้ใช้กากบาท */
;['Accession No.', 'รายการตรวจ', 'เครื่อง', 'Radiographer', 'Radiologist',
  'ปฏิเสธ', 'คนปฏิเสธ', 'สารทึบ'].forEach(label => {
  assert(content.includes('<div>' + label + '</div>'), 'หัวตารางรายการต้องมีคอลัมน์ ' + label)
})
;['เวลาส่งเข้าเครื่อง', 'สถานะ', 'สติ๊กเกอร์ HN'].forEach(label => {
  assert(!content.includes('<div>' + label + '</div>'), 'ต้องตัดคอลัมน์ที่ผู้ใช้กากบาท: ' + label)
})
assert(css.includes('grid-template-columns:42px 150px minmax(215px,1.9fr) 78px 150px 150px minmax(125px,1.1fr) minmax(105px,.9fr) 130px'),
  'ตาราง item ต้องคง gutter/width เดิมของ Worklist และตัดเฉพาะ columns ที่ผู้ใช้ระบุ')
assert(css.includes('.xr-item-grid-wrap{overflow-x:auto;margin-left:-42px;padding-top:0}'),
  'หัวตารางสีฟ้าต้องขยายเข้ากับ gutter ซ้ายแบบ Worklist เดิม')
assert(!css.includes('min-width:1621px'), 'ห้ามเหลือความกว้างตาราง 12 คอลัมน์เดิม')
assert(!css.includes('.xr-item-check-cell'), 'CSS ต้องไม่เหลือ sticky checkbox ที่ถูกตัดออกแล้ว')
assert(!/specimen/i.test(content), 'X-ray ไม่มี specimen')
assert(!content.includes('LAB NO.'), 'X-ray ไม่มี Lab No.')
assert(content.includes('<div data-label="Radiologist">{{ item.radiologist }}</div>'),
  'Radiologist ต้องแสดงเป็นข้อความอ่านอย่างเดียว')
assert(!content.includes('{{ item.code }}'), 'รหัส CPOE ภายในต้องไม่แสดงใน UI')
assert(content.includes('class="xr-item-gutter"'), 'ต้องคง gutter layout ของ Worklist โดยไม่มี checkbox')
assert(content.includes('class="xr-contrast-chip"'), 'สารทึบระดับ item ต้องใช้ chip เดิมของ Worklist')
assert(!content.includes('xr-contrast-sub'), 'ห้ามสร้างรายละเอียดสองบรรทัดที่ทำให้คอลัมน์สารทึบเละ')
assert(!content.includes('>ดูบันทึก</el-button>'), 'ห้ามเพิ่มคอลัมน์ปุ่มดูบันทึกเอง — ให้กด chip เดิม')

/* หัวใบสั่งต้องใช้ข้อมูลชุดเดียวกับ Worklist ปัจจุบัน */
assert(content.includes('row.show_payment_status'), 'ต้องแสดงสถานะชำระเงินเมื่อมีข้อมูลการเงิน')
assert(content.includes("row.finance_passed ? 'ชำระเงินแล้ว' : 'ยังไม่ได้ชำระเงิน'"))
assert(content.includes('xr-coverage-pill'), 'ต้องแสดงสิทธิ์การเงิน')
assert(content.includes('{{ row.doctor }}'), 'ต้องแสดงชื่อแพทย์ผู้สั่ง')
assert(code.includes('s.orderAgeText='), 'อายุต้องใช้ formatter ปี/เดือน/วันเดียวกับ Worklist')
assert(code.includes('s.coverageAbbrev='), 'สิทธิ์ต้องอ่าน finance.coverage แบบเดียวกับ Worklist')
assert(code.includes('s.requesterName='), 'แพทย์ต้องอ่าน requester.cosign_user/visit_doctor แบบเดียวกับ Worklist')

/* ── ตัวกรองของหน้า: เหลือเฉพาะใบที่มีบันทึกสารทึบ ────────────────────────── */
assert(code.includes('r.contrast_count>0'), 'ต้องกรองเหลือเฉพาะใบที่มีบันทึกการใช้สารทึบ')
assert(code.includes('s.hiddenCount='), 'ต้องนับใบที่ถูกซ่อนไว้บอกผู้ใช้')
assert(content.includes('ซ่อน'), 'ต้องบอกจำนวนใบที่ถูกซ่อน ไม่ให้เข้าใจว่าไม่มีใบอื่น')

/* ── ถ้อยคำที่ผู้ใช้เคาะแล้ว ────────────────────────────────────────────────
   🔴 ไม่มีข้อมูล = "ยังไม่ได้บันทึก" เท่านั้น ห้ามอ่านว่า "ไม่ได้ฉีด" */
assert(content.includes('ยังไม่ได้บันทึก'), 'ช่องว่างต้องอ่านว่า "ยังไม่ได้บันทึก"')
assert(code.includes('ไม่ได้แปลว่าไม่ได้ฉีด'), 'tooltip ต้องย้ำว่าไม่มีข้อมูลไม่ได้แปลว่าไม่ได้ฉีด')
assert(content.includes('ไม่ได้แปลว่าไม่ได้ฉีด'), 'บรรทัดสรุปต้องย้ำกติกาเดียวกัน')

/* ── ขอบเขตการค้น: HN ตรงตัว หรือ Date Range ครบสองฝั่ง (spec.md §5.1) ────── */
assert(code.includes('s.searched=false'), 'ต้องเริ่มด้วยสถานะยังไม่ค้น')
assert(code.includes('โปรดระบุ HN หรือเลือกช่วงวันที่'), 'ไม่เข้าเงื่อนไขต้องเตือนและไม่เรียก Process')
assert.strictEqual(widget.options.onMounted, '', 'onMounted ต้องว่าง — ห้ามโหลดรายการเองตอนเปิดหน้า')
assert(content.includes('โปรดระบุ HN / เลือกวันที่'), 'หน้าว่างต้องบอกกติกาการค้น')

/* ── ปุ่มดูบันทึกเปิดฟอร์มเดิม ไม่สร้างฟอร์มใหม่ ────────────────────────── */
assert(code.includes('const CONTRAST_FORM_ID='), 'ต้องมีค่าฟอร์มบันทึกสารทึบให้ตั้งตอน generate')
assert(code.includes('openForm(CONTRAST_FORM_ID'), 'ปุ่มดูบันทึกต้องเปิดฟอร์มบันทึกสารทึบตัวเดิม')
assert(code.includes('accession_no:'), 'ต้องส่งตัวระบุรายการทาง initData เหมือนปุ่มใน Worklist')

/* ── สารทึบอ่านจาก payload เท่านั้น ห้าม hard-code ────────────────────────── */
assert(code.includes('s.contrastInfo=i=>'), 'ต้องอ่าน item.contrast จาก payload')
assert(code.includes('i.contrast_brand'), 'ต้องรองรับทรงแบน item.contrast_* ด้วย')
assert(!/Omnipaque|Visipaque|Barium Sulfate Suspension/.test(code + content), 'ห้าม hard-code ยี่ห้อสารทึบ')
assert(!/'(CR|CT|DX|MRI|VCUG)'/.test(content), 'ห้าม hard-code รายชื่อเครื่องในหน้าจอ')

/* รันตัวแปลง payload จริงเพื่อกันข้อมูลหัวใบสั่งหายซ้ำ */
const runtimeField = {
  vueState: {},
  globalUserState: { user: { unit: { code: '10' } } },
  getFormRef: () => ({}),
  notify: () => {},
}
new Function(code).call(runtimeField)
const s = runtimeField.vueState
const sample = s.buildRow({
  order_id: 'ORDER-1', order_number: 'R2610180001', priority: '3',
  requested_at: '2026-10-18T11:50:54+07:00',
  patient: {
    hn: '6900001', prename: 'น.ส.', first_name: 'ดำ', last_name: 'ใจดี',
    gender_text: 'หญิง', age: { year: 8, month: 2, day: 3 },
    alerts: { allergies: ['Penicillin'] },
  },
  visit: { clinic: '19.p คลินิกวัคซีน' },
  requester: { cosign_user: { prename: 'พญ.', first_name: 'แพทย์', last_name: 'ทดสอบ' } },
  finance: {
    coverage: [{ inscl_item_main: { value: 'OFC', label: 'สิทธิข้าราชการ' } }],
    total_amount: 1000, paid_amount: 1000,
  },
  diagnosis: { value: 'Z00.1', label: 'ตรวจสุขภาพเด็ก' },
  items: [{
    item_id: 'ITEM-1', item_code: '44005', item_name: 'Additional multiphase',
    current_status: 'ready', modality: { code: 'CT', label: 'CT scan' },
    radiographer: 'รังสีเทคนิค ทดสอบ', radiologist: 'รังสีแพทย์ ทดสอบ',
    contrast: { record_id: 'CONTRAST-1', types: ['non_ionic'], volume_ml: 1 },
  }],
})
assert.strictEqual(sample.name, 'น.ส. ดำ ใจดี')
assert.strictEqual(sample.age, '8 ปี 2 เดือน 3 วัน')
assert.strictEqual(sample.room, '19.p คลินิกวัคซีน')
assert.strictEqual(sample.show_payment_status, true)
assert.strictEqual(sample.finance_passed, true)
assert.strictEqual(sample.coverage, 'OFC')
assert.strictEqual(sample.doctor, 'พญ. แพทย์ ทดสอบ')
assert.strictEqual(sample.alert_text, 'แพ้ Penicillin')
assert.strictEqual(sample.items[0].radiographer, 'รังสีเทคนิค ทดสอบ')
assert.strictEqual(sample.items[0].radiologist, 'รังสีแพทย์ ทดสอบ')
assert.deepStrictEqual(sample.test_list, ['Additional multiphase'])

console.log('X-ray contrast history form tests passed')
