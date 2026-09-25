/* build_cpoe_app_vn_picker.js
 * สร้าง Form-Builder/SDForm/form-factory/forms/cpoe-order-app-vn-picker-v1.json
 *
 * ต้นฉบับ: Form-Builder/SDForm/sdform_module/EMR_form/CPOE_app.json (ไม่ถูกแก้)
 * ผู้ใช้ขอ 2026-09-03: "เพิ่ม dropdown เลือก VN ที่เปิดภายในวันนั้น … จากตอนแรก vn จะโดนดึง
 * มาจาก EMR อันนี้ยังอยู่เหมือนเดิมนะ แต่ว่าแค่เพิ่มกล่องให้เลือก VN อีกช่องทางนึงเฉย ๆ"
 *
 * ของเดิมที่มีอยู่แล้ว: จอนี้ **มี** ตัวเลือก VN อยู่แล้ว แต่ขึ้นเฉพาะตอนเปิดจาก worklist
 * (`params.manual_visit`) เท่านั้น — เปิดจาก EMR จะไม่เห็นช่องนี้เลย
 * สคริปต์นี้ปลดเงื่อนไขให้ช่องเลือก VN ใช้ได้ทุกโหมดโดยไม่แตะเส้นทาง EMR
 * และรวม HM/HH เป็นแท็บ Hematology เฉพาะภาพบนจอตามคำสั่งผู้ใช้ 2026-09-04
 *
 * สิ่งที่แก้ (เทสบังคับว่าจุดอื่นต้องเหมือนต้นฉบับทุก byte):
 *   1. pt_header.content   — เอา v-if="manualMode()" ออกจากกล่อง picker + ข้อความบอกโหมด
 *   2. pt_header.onCreated — โหลด Visit วันนี้ได้ทุกโหมด · ล้างช่อง = กลับไปใช้ context เดิม
 *   3. pt_header.onMounted — โหลดรายการ Visit ทุกโหมด
 *   4. formConfig.cssCode  — สไตล์ของแถบเตือนตอนใช้ VN ที่เลือกเอง
 *   5. item_screen.content — ลบ diagnostic alert เรื่อง patient context; parent ส่งผ่าน params อยู่แล้ว
 *   6. item_screen         — virtual Hematology tab รวม HM/HH โดยรหัสจริงในตะกร้ายังแยกเดิม
 *   7. item_screen         — สิทธิ์อ่านจาก patient/Visit context ปัจจุบัน ไม่ยึด params ตอนเปิดฟอร์ม
 *
 * รันใหม่ได้เสมอ:  node Form-Builder/seed/tests-tools/scripts/build_cpoe_app_vn_picker.js
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const sourcePath = path.join(root, 'Form-Builder/SDForm/sdform_module/EMR_form/CPOE_app.json')
const outPath = path.join(root, 'Form-Builder/SDForm/form-factory/forms/cpoe-order-app-vn-picker-v1.json')

const form = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))

const walk = (value, fn) => {
  if (!value || typeof value !== 'object') return
  fn(value)
  if (Array.isArray(value)) value.forEach(item => walk(item, fn))
  else Object.values(value).forEach(item => walk(item, fn))
}

const findNamed = name => {
  let hit = null
  walk(form, value => {
    if (value && value.name === name) hit = value
  })
  if (!hit) throw new Error('Field not found: ' + name)
  return hit
}

const replaceOnce = (text, from, to, label) => {
  const count = text.split(from).length - 1
  if (count !== 1) throw new Error('expected exactly one "' + label + '" (found ' + count + ')')
  return text.replace(from, to)
}

const header = findNamed('pt_header')
const itemScreen = findNamed('item_screen')

/* ── 0. ลบข้อความ diagnostic ที่ไม่ควรแสดงกับผู้ใช้ ──────────────────────────
   ฟอร์มแม่ LAB/X-ray ส่ง initData = null และส่ง context ใน options.params อยู่แล้ว
   จึงเอาเฉพาะ alert นี้ออก โดยยังคง ptOk()/boot guard เดิมไว้กันการทำงานโดยไม่มี visit_id */
itemScreen.content = replaceOnce(
  itemScreen.content,
  '    <!-- ไม่มี context = จอทำงานต่อไม่ได้เลย ⇒ ต้องดังพอที่คนจะรู้ว่าต้องกลับไปดูฝั่งที่เปิดจอ -->\n' +
  '    <el-alert v-if="!ptOk()" type="error" :closable="false" show-icon\n' +
  '      title="ไม่ได้รับ patient context — ฟอร์มแม่ต้องส่งมาทาง params ไม่ใช่ initData" />\n\n' +
  '    <el-alert v-else-if="catErr" type="error" :closable="false" show-icon :title="catErr" />',
  '    <el-alert v-if="catErr" type="error" :closable="false" show-icon :title="catErr" />',
  'patient context diagnostic alert',
)

/* ── 1. content ─────────────────────────────────────────────────────────────
   กล่อง picker เดิมถูกซ่อนด้วย v-if="manualMode()" — ปลดออกให้เห็นทุกโหมด
   หัวข้อ/คำอธิบายเปลี่ยนตามโหมด เพราะสองโหมดมีความหมายต่างกัน:
     manual (เปิดจาก worklist) = "เลือกผู้ป่วย" — ยังไม่มีใครเลย
     EMR                        = "เปลี่ยน VN"  — มีคนไข้อยู่แล้ว ช่องนี้เป็นทางเลือกที่สอง */
header.content = replaceOnce(
  header.content,
  '  <div v-if="manualMode()" class="cpoe-vn-picker">\n' +
  '    <div class="cpoe-vn-title">\n' +
  '      <strong>เลือกผู้ป่วยที่เปิด Visit วันนี้</strong>',
  '  <!-- เพิ่ม 2026-09-03 (ผู้ใช้ขอ): ช่องเลือก VN ใช้ได้ทุกโหมด ไม่ใช่เฉพาะ manual_visit\n' +
  '       เส้นทางเดิมไม่เปลี่ยน — เปิดจาก EMR ยังได้ VN จาก params เหมือนเดิมทุกประการ\n' +
  '       ช่องนี้เป็น "ทางเลือกที่สอง" เท่านั้น · ล้างช่องเมื่อไหร่ก็กลับไปใช้ VN เดิมทันที -->\n' +
  '  <div class="cpoe-vn-picker">\n' +
  '    <div class="cpoe-vn-title">\n' +
  '      <strong>{{ vnPickerTitle() }}</strong>',
  'picker gate in content',
)

header.content = replaceOnce(
  header.content,
  '    <div v-else class="cpoe-vn-hint">แสดงเฉพาะ Visit วันที่วันนี้ที่สถานะยังเปิดอยู่</div>\n' +
  '  </div>',
  '    <div v-else class="cpoe-vn-hint">{{ vnPickerHint() }}</div>\n' +
  '    <!-- เตือนเมื่อ VN ที่ใช้อยู่ไม่ใช่ตัวที่ EMR ส่งมา — กันสั่งผิดคนโดยไม่รู้ตัว -->\n' +
  '    <div v-if="vnOverridden()" class="cpoe-vn-override">\n' +
  '      กำลังใช้ VN ที่เลือกเอง (VN{{ ptText(\'vn\') || \'–\' }}) แทน VN จาก EMR (VN{{ emrVn() || \'–\' }})\n' +
  '      · ล้างช่องด้านบนเพื่อกลับไปใช้ VN เดิม\n' +
  '    </div>\n' +
  '  </div>',
  'picker hint in content',
)

/* ── 2. onCreated ───────────────────────────────────────────────────────── */

/* โหลดรายการ Visit ได้ทุกโหมด — เดิมกันไว้ให้โหลดเฉพาะ manual_visit */
header.onCreated = replaceOnce(
  header.onCreated,
  '  if(!s.manualMode() || s.vnLoading) return;',
  '  /* เปลี่ยน 2026-09-03: โหลดได้ทุกโหมด เพราะช่องเลือก VN เปิดให้ใช้ทุกโหมดแล้ว\n' +
  '     (กันซ้อนด้วย vnLoading เหมือนเดิม) */\n' +
  '  if(s.vnLoading) return;',
  'loadTodayVisits gate',
)

/* ล้างช่อง = กลับไปใช้ context เดิม — ต้องบอก item_screen ด้วย ไม่ใช่แค่หัวจอ */
header.onCreated = replaceOnce(
  header.onCreated,
  '  if(!key){\n' +
  '    s.manualContext = null;\n' +
  '    const form = formRef();\n' +
  '    if(form) form.$labCpoeContext = null;\n' +
  '    return;\n' +
  '  }',
  '  if(!key){\n' +
  '    s.manualContext = null;\n' +
  '    const form = formRef();\n' +
  '    if(form) form.$labCpoeContext = null;\n' +
  '    /* เพิ่ม 2026-09-03: บอกจอสั่งรายการให้กลับไปใช้ context เดิม (EMR/params) ด้วย\n' +
  '       ไม่งั้นหัวจอกลับไปเป็นคนไข้ของ EMR แต่จอล่างยังค้างอยู่ที่คนที่เพิ่งเลือก\n' +
  '       setPatientContext(null) ล้างตะกร้าและ boot ใหม่ เหมือนการสลับผู้ป่วยทุกครั้ง */\n' +
  '    const item = field.getFieldRef && field.getFieldRef(\'item_screen\');\n' +
  '    if(item && item.vueState && typeof item.vueState.setPatientContext === \'function\') item.vueState.setPatientContext(null);\n' +
  '    return;\n' +
  '  }',
  'selectVisitById clear branch',
)

/* เลือกค่าเริ่มต้นในช่องให้ตรงกับ VN ที่ EMR ส่งมา — ถ้า Visit นั้นอยู่ในรายการของวันนี้
   ตั้งค่าที่ "ตัวเลือกที่โชว์" อย่างเดียว ไม่เรียก selectVisit ⇒ ไม่มีการเปลี่ยน context */
header.onCreated = replaceOnce(
  header.onCreated,
  "      if(!s.vnRows.length) s.vnError = 'วันนี้ยังไม่มีผู้ป่วยที่เปิด Visit อยู่';",
  '      /* เพิ่ม 2026-09-04: ตอนว่างให้บอกด้วยว่าชั้นไหนตอบ (visit_tran = ตาม Visit List /\n' +
  '         visit_day = fallback อ่าน zdata_visit ตรง ๆ) และ Visit List วันนี้มีกี่คิว\n' +
  '         ไม่งั้น "ไม่มีรายการ" บอกอะไรไม่ได้เลยว่า query ไม่ตรงวัน หรือวันนี้ไม่มีคนไข้จริง ๆ */\n' +
  "      if(!s.vnRows.length) s.vnError = 'วันนี้ยังไม่มีผู้ป่วยที่เปิด Visit อยู่'\n" +
  "        + ' (วันที่ ' + (s.visitDate || '-')\n" +
  "        + ' · Visit List ' + (payload.visit_tran_total == null ? '-' : payload.visit_tran_total) + ' คิว'\n" +
  "        + ' · แหล่ง ' + (payload.source || '-') + ')';\n" +
  '      /* เพิ่ม 2026-09-03: โชว์ VN ของ EMR เป็นค่าตั้งต้นในช่อง ถ้ามันอยู่ในรายการวันนี้\n' +
  '         แค่ทำให้ช่องไม่ว่างเปล่าเท่านั้น ไม่ได้แตะ context ของใบสั่ง */\n' +
  '      if(!s.selectedVisitId && s.emrVisitId()){\n' +
  '        const found = s.vnRows.some(row => String((row && row._id) || \'\') === s.emrVisitId());\n' +
  '        if(found) s.selectedVisitId = s.emrVisitId();\n' +
  '      }',
  'preselect EMR visit',
)

/* helper ของโหมด/ข้อความ — ต่อท้ายไฟล์ ไม่แทรกกลางของเดิม */
header.onCreated += `

/* ── ช่องเลือก VN ทางเลือกที่สอง (ผู้ใช้ขอ 2026-09-03) ──────────────────────
   ของเดิม: VN มาจาก EMR ผ่าน field.params — **ยังเป็นค่าเริ่มต้นเหมือนเดิมทุกกรณี**
   ของใหม่: ช่อง dropdown ใช้ได้ทุกโหมด ถ้าไม่แตะ ทุกอย่างทำงานเหมือนก่อนหน้านี้เป๊ะ */
s.emrParams = () => field.params || {};
s.emrVisitId = () => String(s.emrParams().visit_id || '');
s.emrVn = () => {
  const v = s.emrParams().vn;
  if(v === null || v === undefined) return '';
  if(typeof v === 'object') return String(v.label || v.value || '');
  return String(v);
};
s.vnPickerTitle = () => s.manualMode()
  ? 'เลือกผู้ป่วยที่เปิด Visit วันนี้'
  : 'เลือก VN อีกช่องทาง (ค่าเริ่มต้นมาจาก EMR)';
s.vnPickerHint = () => s.manualMode()
  ? 'แสดงเฉพาะ Visit วันที่วันนี้ที่สถานะยังเปิดอยู่'
  : ('ค่าเริ่มต้นคือ VN จาก EMR (VN' + (s.emrVn() || '–') + ') · แสดงเฉพาะ Visit ของวันนี้ที่ยังเปิดอยู่' +
     ' · ล้างช่องเพื่อกลับไปใช้ VN เดิม');
/* ใช้ VN ที่เลือกเองอยู่หรือเปล่า — เทียบกับ VN ที่ EMR ส่งมาเท่านั้น
   โหมด manual ไม่มี VN จาก EMR ให้เทียบ จึงไม่ถือว่า "override" */
s.vnOverridden = () => {
  const picked = s.manualContext && String(s.manualContext.visit_id || '');
  const emr = s.emrVisitId();
  return !!(picked && emr && picked !== emr);
};`

/* ── 3. onMounted ───────────────────────────────────────────────────────── */
header.onMounted = replaceOnce(
  header.onMounted,
  '// LAB launcher โหลดเฉพาะ Visit ที่เปิดอยู่ในวันปัจจุบัน\n' +
  'if(this.vueState.manualMode()) this.vueState.loadTodayVisits();',
  '// โหลด Visit ที่เปิดอยู่ในวันปัจจุบัน — ทุกโหมด (เปลี่ยน 2026-09-03)\n' +
  '// เปิดจาก EMR ก็ต้องมีรายการให้เลือก ไม่งั้น dropdown จะว่างตลอด\n' +
  'this.vueState.loadTodayVisits();',
  'onMounted loader',
)

/* ── 4. CSS ของแถบเตือน ─────────────────────────────────────────────────── */
form.formConfig.cssCode = replaceOnce(
  form.formConfig.cssCode,
  '.cpoe-vn-hint{margin-top:6px}',
  '.cpoe-vn-hint{margin-top:6px}\n' +
  '/* เพิ่ม 2026-09-03: เตือนเมื่อ VN ที่ใช้อยู่ไม่ใช่ตัวที่ EMR ส่งมา */\n' +
  '.cpoe-vn-override{margin-top:8px;padding:6px 10px;border:1px solid var(--el-color-warning);' +
  'border-radius:6px;background:var(--el-color-warning-light-9);color:var(--el-color-warning-dark-2);font-size:12px}',
  'vn hint css',
)

/* ── 5. สิทธิ์ของ Visit ที่เลือก ────────────────────────────────────────────
   Worklist เปิดฟอร์มด้วย params สำหรับ scope เท่านั้น แล้วผู้ใช้เลือก Visit ภายใน popup
   ดังนั้นสิทธิ์ต้องอ่านจาก s.pt() ซึ่งติดตาม manualContext/$labCpoeContext/params
   เหมือนข้อมูลผู้ป่วยส่วนอื่น ไม่เช่นนั้นหัวจอขึ้น OFC แต่ selector เห็น array ว่าง */
itemScreen.onCreated = replaceOnce(
  itemScreen.onCreated,
  'const rows = (field.params || {}).inscl_hos;',
  'const rows = (s.pt() || {}).inscl_hos;',
  'insurance rows follow active patient context',
)

/* เปลี่ยน Visit แล้วเลือกสิทธิ์แรกของ Visit ใหม่เสมอ ป้องกัน index จาก Visit ก่อนหน้าค้าง */
itemScreen.onCreated = replaceOnce(
  itemScreen.onCreated,
  's.setPatientContext = ctx => {\n' +
  '  s.manualContext = ctx || null;\n' +
  '  s.cart = [];',
  's.setPatientContext = ctx => {\n' +
  '  s.manualContext = ctx || null;\n' +
  '  s.insIx = 0;\n' +
  '  s.cart = [];',
  'reset insurance selection when patient context changes',
)

/* ── 6. Hematology: HM + HH รวมเฉพาะภาพบนจอ ───────────────────────────────────────────
   ผู้ใช้ขอ 2026-09-04: ให้ HM/Hematology และ HH/Hematology-Homeostasis
   อยู่ในแท็บเดียวชื่อ Hematology แต่รหัสที่บันทึกยังต้องเป็น HM/HH เดิม
   แก้ใน clone Cpoe_test_order เท่านั้น ไม่แตะ CPOE_app ต้นฉบับ */
itemScreen.onCreated = replaceOnce(
  itemScreen.onCreated,
  "const keyOf = (st, item) => st + ':' + (item.id || item.c);\nconst inCart = (k) => s.cart.findIndex((l) => l.k === k);",
  `const keyOf = (st, item) => st + ':' + (item.id || item.c);
const inCart = (k) => s.cart.findIndex((l) => l.k === k);

/* HM/HH มีแค่ visual section ร่วมกัน รหัสจริงของ item เก็บใน sourceSec และห้ามส่ง HEM ไปบันทึก */
const HEM_TAB_CODE = 'HEM';
const isHemSource = code => code === 'HM' || code === 'HH';
const realSectionCode = item => String((item && (item.sourceSec || item.sec)) || '');
const hemSectionName = code => code === 'HH' ? 'Hematology-Homeostasis' : 'Hematology';

s.mergeHematologyCatalog = catalog => {
	const source = catalog || {};
	const lab = source.lab;
	if(!lab) return source;
	const sections = Array.isArray(lab.sections) ? lab.sections : [];
	const hemSections = sections.filter(section => isHemSource(String((section && section.code) || '').toUpperCase()));
	/* รวมเฉพาะตอนที่แคตตาล็อกมีทั้งสองห้อง — scope ที่มีแค่ HM หรือ HH ยังเหมือนเดิม */
	if(hemSections.length < 2) return source;
	const items = (Array.isArray(lab.items) ? lab.items : []).map(row => {
		const code = String((row && row.sec) || '').toUpperCase();
		if(!isHemSource(code)) return row;
		return Object.assign({}, row, { sourceSec: code, sourceSecName: hemSectionName(code), sec: HEM_TAB_CODE });
	});
	let inserted = false;
	const mergedSections = [];
	sections.forEach(section => {
		const code = String((section && section.code) || '').toUpperCase();
		if(!isHemSource(code)){ mergedSections.push(section); return; }
		if(inserted) return;
		inserted = true;
		const hemItems = items.filter(row => row && row.sec === HEM_TAB_CODE);
		mergedSections.push(Object.assign({}, section, {
			code: HEM_TAB_CODE,
			displayCode: 'HM / HH',
			name: 'Hematology',
			n: hemItems.length,
			g: hemSections.reduce((sum, row) => sum + Number((row && row.g) || 0), 0)
		}));
	});
	return Object.assign({}, source, { lab: Object.assign({}, lab, { sections: mergedSections, items: items }) });
};`,
  'Hematology visual helpers',
)

itemScreen.onCreated = replaceOnce(
  itemScreen.onCreated,
  '\t\t\tsec: item.sec,',
  '\t\t\tsec: realSectionCode(item),',
  'cart keeps real Hematology section code',
)

itemScreen.onCreated = replaceOnce(
  itemScreen.onCreated,
  'const catalog = d.catalog || {};',
  'let catalog = d.catalog || {};',
  'catalog must be transformable',
)

itemScreen.onCreated = replaceOnce(
  itemScreen.onCreated,
  `			s.cat = catalog;
			s.catCounts = Object.assign({}, d.counts || {}, LAB_SCOPE ? { lab: ((catalog.lab || {}).items || []).length } : {});`,
  `			/* ทำหลัง LAB_SCOPE filter: ถ้าเปิดมาเฉพาะห้องเดียว จะไม่ถูกรวมโดยบังเอิญ */
			catalog = s.mergeHematologyCatalog(catalog);
			s.cat = catalog;
			s.catCounts = Object.assign({}, d.counts || {}, LAB_SCOPE ? { lab: ((catalog.lab || {}).items || []).length } : {});`,
  'merge Hematology catalog after scope filter',
)

itemScreen.onCreated = replaceOnce(
  itemScreen.onCreated,
  '\t\tsec: i.sec,\n\t\tone: i.one === true,',
  '\t\tsec: realSectionCode(i),\n\t\tone: i.one === true,',
  'render row keeps real Hematology section code',
)

itemScreen.onCreated = replaceOnce(
  itemScreen.onCreated,
  "const secName = (c) => (data.sections.find((x) => x.code === c) || {}).name || c;",
  "const secName = (c) => isHemSource(c) ? hemSectionName(c) : ((data.sections.find((x) => x.code === c) || {}).name || c);",
  'Hematology source section labels',
)

itemScreen.onCreated = replaceOnce(
  itemScreen.onCreated,
  `	items.forEach((i) => {
		const sk = setKeyOf(i);
		const gk = sk ? (q ? i.sec + '|' + sk : sk) : q ? i.sec + '|' + (i.g || '') : i.g || '';
		if (!gmap[gk]) {
			const head = sk ? groupHeadOf(st, i) : null;`,
  `	items.forEach((i) => {
		const sk = setKeyOf(i);
		const sourceSec = realSectionCode(i);
		const inMergedHemTab = !q && st === 'lab' && sec === HEM_TAB_CODE;
		/* แยก key ตาม source section เฉพาะแท็บรวม กันกลุ่มชื่อซ้ำของ HM/HH ไหลมาปนกัน */
		const groupPrefix = (q || inMergedHemTab) ? sourceSec + '|' : '';
		const gk = sk ? groupPrefix + sk : groupPrefix + (i.g || '');
		if (!gmap[gk]) {
			const head = sk ? groupHeadOf(st, i) : null;`,
  'split merged Hematology groups by source section',
)

itemScreen.onCreated = replaceOnce(
  itemScreen.onCreated,
  "\t\t\t\tsort: (q ? (secIx[i.sec] === undefined ? 99 : secIx[i.sec]) * 1e6 : 0) +",
  "\t\t\t\t// แท็บรวมเรียง HM ก่อน HH เสมอ เพื่อให้หัวแบ่งสองส่วนไม่สลับกัน\n" +
  "\t\t\t\tsort: (inMergedHemTab ? (sourceSec === 'HH' ? 1 : 0) * 1e6 : q ? (secIx[i.sec] === undefined ? 99 : secIx[i.sec]) * 1e6 : 0) +",
  'Hematology bucket ordering',
)

itemScreen.onCreated = replaceOnce(
  itemScreen.onCreated,
  '\t\t\t\tsec: i.sec,\n\t\t\t\t/* การ์ดชุด',
  '\t\t\t\tsec: sourceSec,\n\t\t\t\t/* การ์ดชุด',
  'group keeps source Hematology section',
)

itemScreen.onCreated = replaceOnce(
  itemScreen.onCreated,
  `	const seenSec = {};
	const groups = gorder`,
  `	const seenSec = {};
	const seenHemBucket = {};
	const groups = gorder`,
  'Hematology bucket state',
)

itemScreen.onCreated = replaceOnce(
  itemScreen.onCreated,
  `		.map((g) => {
			// กลุ่มแรกของแต่ละ section ได้ anchor ไว้ให้แถบซ้ายกระโดดมาหา
			const anchor = q && !seenSec[g.sec] ? 'cpoe-sec-' + g.sec : '';
			seenSec[g.sec] = 1;`,
  `		.map((g) => {
			// แท็บ HEM เป็นแค่ visual key; ตอนค้นหาให้แถบซ้ายกระโดดมาที่ผล HM/HH กลุ่มแรก
			const anchorCode = isHemSource(g.sec) ? HEM_TAB_CODE : g.sec;
			const anchor = q && !seenSec[anchorCode] ? 'cpoe-sec-' + anchorCode : '';
			seenSec[anchorCode] = 1;
			const showHemBucket = !q && st === 'lab' && sec === HEM_TAB_CODE;
			const bucketStart = showHemBucket && !seenHemBucket[g.sec];
			if(showHemBucket) seenHemBucket[g.sec] = 1;`,
  'Hematology bucket markers',
)

itemScreen.onCreated = replaceOnce(
  itemScreen.onCreated,
  `				secCode: g.secCode,
				secName: g.secName,
				label: g.label,`,
  `				secCode: g.secCode,
				secName: g.secName,
				bucketStart: bucketStart,
				bucketCode: bucketStart ? g.sec : '',
				bucketName: bucketStart ? secName(g.sec) : '',
				label: g.label,`,
  'Hematology bucket view data',
)

itemScreen.onCreated = replaceOnce(
  itemScreen.onCreated,
  `			code: x.code,
			name: x.name,`,
  `			code: x.code,
			displayCode: x.displayCode || x.code,
			name: x.name,`,
  'rail display code',
)

itemScreen.content = replaceOnce(
  itemScreen.content,
  '<span class="cd">{{ r.code }}</span><span class="nm">{{ r.name }}</span>',
  '<span class="cd">{{ r.displayCode || r.code }}</span><span class="nm">{{ r.name }}</span>',
  'rail renders display code',
)

itemScreen.content = replaceOnce(
  itemScreen.content,
  `                  <div v-for="g in view.groups" :key="g.gk" class="grp" :class="{ big: g.big, setcard: g.set, on: g.set && g.set.on }" :id="g.anchor || null">
                    <!-- การ์ดชุด`,
  `                  <div v-for="g in view.groups" :key="g.gk" class="grp" :class="{ big: g.big, setcard: g.set, on: g.set && g.set.on }" :id="g.anchor || null">
                    <div v-if="g.bucketStart" class="hem-bucket">
                      <span class="hem-code">{{ g.bucketCode }}</span><span>{{ g.bucketName }}</span>
                    </div>
                    <!-- การ์ดชุด`,
  'Hematology source bucket heading',
)

form.formConfig.cssCode += '\n/* Cpoe_test_order 2026-09-04: หัวแบ่ง HM/HH ภายใน visual tab Hematology */\n' +
  '.hem-bucket{display:flex;align-items:center;gap:8px;margin:-1px -1px 8px;padding:9px 12px;' +
  'border-radius:8px 8px 0 0;background:var(--el-color-success-light-9);color:var(--el-color-success-dark-2);font-weight:800}' +
  '.hem-code{display:inline-flex;min-width:28px;justify-content:center;padding:2px 7px;border:1px solid currentColor;border-radius:999px;font-size:11px}'

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(form, null, 2) + '\n')
console.log('wrote ' + path.relative(root, outPath))
