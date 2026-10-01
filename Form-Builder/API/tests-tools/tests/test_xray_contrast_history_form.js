/* ล็อกหน้า "ประวัติการใช้สารทึบรังสี" (xray-contrast-history-v1.json)
   ผู้ใช้สั่ง 2026-09-27: ให้เหลือเฉพาะโหมดดูประวัติ และให้ยก pattern ของแท็บ
   "สืบค้นผลแลป" มาใช้ตรง ๆ ไม่คิดโครงใหม่
   เทสนี้กันสามเรื่อง: โครงไฟล์ตามกฎ SDForm · หน้าเป็น read-only จริง ·
   คอลัมน์/ถ้อยคำที่ผู้ใช้เคาะแล้วไม่หายไปเงียบ ๆ */
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const root = path.join(__dirname, '../../../..')
const script = path.join(root, 'Form-Builder/seed/tests-tools/scripts/build_xray_contrast_history_ui.js')
const jsonPath = path.join(root, 'Form-Builder/SDForm/X-ray/xray-contrast-history-v1.json')

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
/* customClass ของ widget ต้องปล่อยตามแม่แบบ — ภาคผนวก §12.4 */
assert.strictEqual(widget.options.customClass, '', 'ห้ามยัดคลาสลง options.customClass ของ widget')
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
const script_ = widget.options.onCreated

/* ── read-only เท่านั้น ─────────────────────────────────────────────────────
   หน้านี้ต้องไม่มีทางเขียนอะไรกลับไปที่ order/item เลย */
;['cancel_order', 'dispatch', 'reject', 'accept', 'queue_call', 'queue_done'].forEach(action => {
  assert(!script_.includes("action:'" + action + "'"), 'ห้ามมี action เขียน: ' + action)
})
assert(script_.includes("action:'list'"), 'ต้องเรียก action list ของ Process worklist เดิม')
assert(script_.includes("const WORKLIST_PROCESS_ID='6a957009422c1ca959829e45'"),
  'ต้องใช้ Process เดิมของ X-ray Worklist ห้ามสร้าง Process ใหม่')
assert(!/ส่งเข้าเครื่อง|ยกเลิกรายการ|ปฏิเสธ/.test(content), 'ห้ามมีปุ่มฝั่งเขียนในหน้านี้')
assert(content.includes('อ่านอย่างเดียว'), 'ต้องบอกผู้ใช้ว่าอ่านอย่างเดียว')

/* ── pattern ยกมาจากแท็บสืบค้นผลแลป ────────────────────────────────────────── */
;['xll-toolbar', 'xll-search', 'xll-date', 'xll-mode-strip', 'xll-summary', 'xll-shell',
  'xll-head', 'xll-order', 'xll-row', 'xll-expand', 'xll-patient', 'xll-context',
  'xll-sections', 'xll-order-meta', 'xll-status', 'xll-detail', 'xll-item-head',
  'xll-item-row', 'xll-empty', 'xll-pagination'].forEach(cls => {
  assert(content.includes(cls), 'ต้องใช้คลาสเดิมของ xray_lab_lookup: ' + cls)
  assert(form.formConfig.cssCode.includes(cls), 'CSS ต้องมีคลาส ' + cls)
})
assert(form.formConfig.cssCode.startsWith('.xray-contrast-history{'), 'root class ของ CSS ต้องเป็นของหน้านี้')

/* คอลัมน์ระดับ order — เรียงตามแท็บ LAB โดยสลับ Specimen→สารทึบ และ ห้องแลป→เครื่อง */
const orderHead = (content.match(/<div class="xll-head"[\s\S]*?<\/div>\s*<article/) || [''])[0]
;['ผู้ป่วย', 'บริบท', 'รายการ', 'สารทึบ', 'เครื่อง', 'เวลาสั่ง / Order No.', 'สถานะ'].forEach(label => {
  assert(orderHead.includes('<div>' + label + '</div>'), 'หัวตารางต้องมีคอลัมน์ ' + label)
})
/* คอลัมน์ระดับ item — LAB NO.→Accession No. · เวลาออกผล→วันเวลาที่ใช้ · ดูผล→ดูบันทึก */
const itemHead = (content.match(/<div class="xll-item-head">[\s\S]*?<\/div>\s*<div v-for/) || [''])[0]
;['ลำดับ', 'Accession No.', 'รายการตรวจ', 'สารทึบ', 'เครื่อง', 'วันเวลาที่ใช้', 'สถานะ'].forEach(label => {
  assert(itemHead.includes('<div>' + label + '</div>'), 'หัวตารางรายการต้องมีคอลัมน์ ' + label)
})
/* 🔴 X-ray ไม่มี specimen และไม่มี Lab No. — ห้ามมีคอลัมน์หรือคำเหล่านี้หลุดมา */
assert(!/specimen/i.test(content), 'X-ray ไม่มี specimen')
assert(!content.includes('LAB NO.'), 'X-ray ไม่มี Lab No.')

/* ── ถ้อยคำที่ผู้ใช้เคาะแล้ว ────────────────────────────────────────────────
   🔴 ไม่มีข้อมูล = "ยังไม่ได้บันทึก" เท่านั้น ห้ามอ่านว่า "ไม่ได้ฉีด" */
assert(content.includes('ยังไม่ได้บันทึก'), 'ช่องว่างต้องอ่านว่า "ยังไม่ได้บันทึก"')
assert(script_.includes('ไม่ได้แปลว่าไม่ได้ฉีด'), 'tooltip ต้องย้ำว่าไม่มีข้อมูลไม่ได้แปลว่าไม่ได้ฉีด')
assert(!/ไม่ได้ฉีด(?!\))/.test(content.replace('ไม่ได้แปลว่าไม่ได้ฉีด', '')), 'ห้ามสรุปว่า "ไม่ได้ฉีด"')

/* ── ขอบเขตการค้น: HN ตรงตัว หรือ Date Range ครบสองฝั่ง (spec.md §5.1) ────── */
assert(script_.includes("s.searched=false"), 'ต้องเริ่มด้วยสถานะยังไม่ค้น')
assert(script_.includes('โปรดระบุ HN หรือเลือกช่วงวันที่'), 'ไม่เข้าเงื่อนไขต้องเตือนและไม่เรียก Process')
assert(!script_.includes('s.load()') || script_.includes('s.search=()'), 'ต้องเรียก load ผ่าน search เท่านั้น')
assert.strictEqual(widget.options.onMounted, '', 'onMounted ต้องว่าง — ห้ามโหลดรายการเองตอนเปิดหน้า')
assert(content.includes('โปรดระบุ HN / เลือกวันที่'), 'หน้าว่างต้องบอกกติกาการค้น')

/* ── ปุ่มดูบันทึกเปิดฟอร์มเดิม ไม่สร้างฟอร์มใหม่ ────────────────────────── */
assert(script_.includes("const CONTRAST_FORM_ID="), 'ต้องมีค่าฟอร์มบันทึกสารทึบให้ตั้งตอน generate')
assert(script_.includes('openForm(CONTRAST_FORM_ID'), 'ปุ่มดูบันทึกต้องเปิดฟอร์มบันทึกสารทึบตัวเดิม')
assert(script_.includes('accession_no:'), 'ต้องส่งตัวระบุรายการทาง initData เหมือนปุ่มใน Worklist')

/* ── สารทึบอ่านจาก payload เท่านั้น ห้าม hard-code ────────────────────────── */
assert(script_.includes('s.contrastInfo=i=>'), 'ต้องอ่าน item.contrast จาก payload')
assert(script_.includes('i.contrast_brand'), 'ต้องรองรับทรงแบน item.contrast_* ด้วย')
assert(!/Omnipaque|Visipaque|Barium Sulfate Suspension/.test(script_ + content), 'ห้าม hard-code ยี่ห้อสารทึบ')

console.log('X-ray contrast history form tests passed')
