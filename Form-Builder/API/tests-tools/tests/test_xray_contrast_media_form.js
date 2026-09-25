/* ล็อกฟอร์ม "บันทึกการใช้สารทึบรังสี" ให้ตรงกับเอกสารกระดาษที่ผู้ใช้ส่งมา 2026-09-10
   เอกสารมี 3 หน้า · เทสนี้ไล่ทีละข้อ ถ้าวันหน้ามีใครลบช่องไหนออกจะแดงทันที */
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const root = path.join(__dirname, '../../../..')
const script = path.join(root, 'Form-Builder/seed/tests-tools/scripts/build_xray_contrast_media_form.js')
const jsonPath = path.join(root, 'Form-Builder/SDForm/X-ray/xray-contrast-media-record-v1.json')

/* generator ต้องเป็นแหล่งความจริง — ถ้าใครแก้ JSON ด้วยมือแล้วลืมแก้สคริปต์
   รอบ generate ถัดไปงานจะหายเงียบ ๆ เทสจึงรัน generator แล้วเทียบกับไฟล์ที่มีอยู่ */
const before = fs.readFileSync(jsonPath, 'utf8')
execFileSync('node', [script], { cwd: root })
assert.strictEqual(
  fs.readFileSync(jsonPath, 'utf8'), before,
  'the committed JSON must match what the generator produces — regenerate it',
)

const form = JSON.parse(before)
const widgets = []
const walk = node => {
  if (Array.isArray(node)) return node.forEach(walk)
  if (!node || typeof node !== 'object') return
  if (node.component) widgets.push(node)
  walk(node.fields); walk(node.cols); walk(node.tabs)
}
walk(form.fields)

const byName = {}
widgets.forEach(w => {
  const name = w.options && w.options.name
  if (name) {
    assert(!byName[name], 'duplicate options.name: ' + name)
    byName[name] = w
  }
})
const need = name => {
  assert(byName[name], 'missing field: ' + name)
  return byName[name]
}
const labels = w => (w.options.optionItems || []).map(o => o.label)
const values = w => (w.options.optionItems || []).map(o => o.value)

/* ── 1 ตัวเลือกต่อบรรทัด + responsive (ผู้ใช้สั่ง 2026-09-10) ───────────────
   เดิมบีบ 2–3 คอลัมน์แล้ว label ภาษาไทยทับกันจนอ่านไม่ออกในหน้า Builder */
/* 🔴 แก้ assertion เดิม 2026-09-10 (ผู้ใช้สั่งหลังส่งภาพ Builder ที่ checkbox หายทั้ง 5 กลุ่ม)
   ของเดิมบังคับ customClass:'cmr-choice' ลงในตัว widget — นั่นคือตัวที่ทำให้กลุ่มหาย
   (แม่แบบของระบบเว้น customClass ว่างทุกตัว · ค่า string ที่เราแต่งเองเคยทำ card และ
   file-upload-input ไม่เรนเดอร์มาแล้ว) ⇒ ย้ายคลาสไปไว้ที่ระดับฟอร์มแทน
   สิ่งที่ assertion เดิมปกป้อง ("ตัวเลือกต้องขึ้นบรรทัดละ 1 และ label ต้องตัดบรรทัดได้")
   ยังถูกปกป้องครบด้านล่าง แค่เปลี่ยนที่เกาะของ CSS */
widgets.filter(w => w.component === 'checkbox-input').forEach(w => {
  assert.strictEqual(w.options.customClass, '',
    'checkbox ห้ามมีคลาสของตัวเอง — แม่แบบของระบบเว้นว่าง: ' + w.options.name)
})
const css = form.formConfig.cssCode
assert(Array.isArray(form.formConfig.customClass),
  'formConfig.customClass ต้องเป็นอาร์เรย์เสมอ (ของระบบใช้ ["mb15"]) ห้ามเป็น string')
assert(form.formConfig.customClass.includes('cmr-form'),
  'ต้องมีคลาสระดับฟอร์มไว้ให้ CSS เกาะ ไม่งั้นตัวเลือกจะไม่ขึ้นบรรทัดละ 1')
assert(css.includes('flex-direction:column'), 'CSS ต้องบังคับให้ตัวเลือกเรียงลงมาทีละบรรทัด')
assert(css.includes('.cmr-form .el-checkbox{'), 'CSS ที่ทำให้ตัวเลือกขึ้นบรรทัดใหม่ต้องอยู่ครบ')
assert(css.includes('white-space:normal'), 'label ต้องตัดบรรทัดได้ ไม่ใช่ nowrap ทับกัน')
assert(css.includes('@media (max-width:860px)'), 'ต้องมี breakpoint ให้จอแคบ')
/* คลาสห้ามหลุดกลับไปอยู่ในตัว widget ไม่ว่ารูปแบบไหน */
assert(!css.includes('.cmr-choice'), 'เลิกใช้ .cmr-choice แล้ว — คลาสอยู่ที่ระดับฟอร์ม')

/* ── 🔴 ด่านหลักของบั๊ก 2026-09-10 รอบสี่ ────────────────────────────────────
   checkbox-input ไม่มีแม่แบบของระบบให้ลอกเลยสักไฟล์ · ชุด 22 คีย์ที่เคยใช้ลอกมาจาก
   lab_order_mock_import.json ซึ่งเราเขียนเองและไม่เคยพิสูจน์ว่า import แล้วขึ้นจริง
   ⇒ ผูก checkbox ไว้กับ radio-input ซึ่งเป็นวิดเจ็ตพี่น้องและ **มีแม่แบบของระบบ** 13 ตัว
   (patient.json · visit.json · disease.json ฯลฯ) ทุกตัวมีคีย์เท่ากันหมด 29 คีย์
   ตรงกับ SNAPSHOT ของ validator (radio-input: 29) */
const MODULE_DIR = path.join(root, 'Form-Builder/SDForm/sdform_module')
const OUR_OWN_MOCK = 'lab_order_mock_import.json'
const radioKeySets = []
const scanModules = dir => fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
  const full = path.join(dir, entry.name)
  if (entry.isDirectory()) return scanModules(full)
  if (!entry.name.endsWith('.json') || entry.name === OUR_OWN_MOCK) return
  let parsed
  try { parsed = JSON.parse(fs.readFileSync(full, 'utf8')) } catch (e) { return }
  const visit = node => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!node || typeof node !== 'object') return
    if (node.component === 'radio-input' && node.options) radioKeySets.push(Object.keys(node.options).sort())
    Object.values(node).forEach(visit)
  }
  visit(parsed)
})
scanModules(MODULE_DIR)
assert(radioKeySets.length >= 10, 'ต้องเจอแม่แบบ radio-input ของระบบ ไม่งั้นเทียบอะไรไม่ได้')
const RADIO_KEYS = radioKeySets[0]
radioKeySets.forEach(keys => assert.deepStrictEqual(keys, RADIO_KEYS,
  'แม่แบบ radio-input ของระบบต้องมีชุดคีย์เดียวกันทุกตัว'))
widgets.filter(w => w.component === 'checkbox-input').forEach(w => {
  assert.deepStrictEqual(Object.keys(w.options).sort(), RADIO_KEYS,
    'checkbox "' + w.options.name + '" ต้องมีชุด options เท่าแม่แบบ radio-input ของระบบ ' +
    '(29 คีย์) — ขาดคีย์เมื่อไหร่ Builder ไม่เรนเดอร์ทั้งกลุ่ม')
})
/* ค่า presentation ต้องเท่าแม่แบบเป๊ะ ๆ (SDFORM_JSON_RULES ข้อ ง) — แก้ได้แต่ค่าข้อมูล */
widgets.filter(w => w.component === 'checkbox-input').forEach(w => {
  const o = w.options
  assert.strictEqual(o.displayStyle, '', 'displayStyle ต้องเว้นตามแม่แบบ: ' + o.name)
  assert.strictEqual(o.buttonStyle, false, 'buttonStyle ต้องเป็น false ตามแม่แบบ: ' + o.name)
  assert.strictEqual(o.border, false, 'border ต้องเป็น false ตามแม่แบบ radio: ' + o.name)
  assert.strictEqual(o.showCol, 0, 'showCol ต้องเป็น 0 ตามแม่แบบ radio (2/4 มีที่มาจาก mock ของเราเอง): ' + o.name)
  assert.strictEqual(o.labelIconClass, null, 'ห้ามแต่งไอคอน: ' + o.name)
  assert.strictEqual(o.labelIconPosition, 'rear', 'ห้ามย้ายตำแหน่งไอคอน: ' + o.name)
  assert.strictEqual(o.labelColor, null, 'ห้ามแต่งสี label: ' + o.name)
  assert.strictEqual(o.labelAlign, '', 'labelAlign ต้องเว้นตามแม่แบบ: ' + o.name)
  assert(Array.isArray(o.defaultValue), 'checkbox ต้อง default เป็นอาร์เรย์: ' + o.name)
})
/* บั๊กชุดนี้มาในรูปเดียวกันทุกครั้ง: ใส่ค่า string ลง customClass ของ widget
   ของที่ระบบสร้างเองใช้ "อาร์เรย์" เสมอ (["mb15"] · ["lab-waiting-listview"])
   ส่วนค่า string ที่เราพิมพ์เองพบเฉพาะในไฟล์ที่ไม่เรนเดอร์ ⇒ ห้ามมีในฟอร์มนี้ */
widgets.forEach(w => {
  const cc = w.options && w.options.customClass
  assert(!(typeof cc === 'string' && cc !== ''),
    'customClass ห้ามเป็น string ที่มีค่า (' + cc + ') บน ' + w.component + ' "' +
    (w.options.name || '') + '" — ของระบบเป็นอาร์เรย์เสมอ')
})

/* ── 🔴 ด่านที่แพงที่สุดที่เคยพลาด (2026-09-10) ────────────────────────────
   ใส่ค่าลง customClass ของ card ทั้งที่ฟอร์มจริงในรีโป 70/70 ตัวเว้นว่างหมด
   ⇒ Builder เรนเดอร์ card ไม่ออกเลยทั้งใบ · Tree View เห็นครบแต่ canvas ว่าง
   validator จับไม่ได้เพราะ "ช่องครบ" แค่ค่าผิด
   ⇒ เทสนี้เทียบทุก customClass กับของจริง: ถ้าไม่มี component ไหนในรีโปเคยใส่ค่า
      แบบนั้น ห้ามเป็นเจ้าแรก */
const REAL_DIR = path.join(root, 'Form-Builder/SDForm')
const shape = value => (value === '' || (Array.isArray(value) && !value.length)) ? 'empty' : 'value'
const precedent = {}
const scan = dir => fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
  const full = path.join(dir, entry.name)
  if (entry.isDirectory()) return scan(full)
  /* 🔴 2026-09-10: ตัด lab_order_mock_import.json ออกจาก "ของจริง" — เราเขียนเอง
     ไม่เคยพิสูจน์ว่า import แล้วขึ้น และเป็นต้นทางของ checkbox 22 คีย์ที่ทำให้กลุ่มหาย */
  if (!entry.name.endsWith('.json') || entry.name.includes('contrast-media')
    || entry.name === 'lab_order_mock_import.json') return
  let parsed
  try { parsed = JSON.parse(fs.readFileSync(full, 'utf8')) } catch (e) { return }
  const visit = node => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!node || typeof node !== 'object') return
    if (node.component && node.options && typeof node.options === 'object'
      ) {
      const bag = precedent[node.component] = precedent[node.component] || { keySets: [] }
      bag.keySets.push(new Set(Object.keys(node.options)))
      if ('customClass' in node.options) {
        bag.customClass = bag.customClass || new Set()
        bag.customClass.add(shape(node.options.customClass))
      }
      /* showCol เป็นค่าที่ Builder ใช้จัดคอลัมน์ · ใส่ค่าที่ไม่มีใครใช้ (เช่น 1)
         แล้ว checkbox ทั้งกลุ่มหายจากจอ (ผู้ใช้เจอ 2026-09-10) */
      if ('showCol' in node.options) {
        bag.showCol = bag.showCol || new Set()
        bag.showCol.add(node.options.showCol)
      }
    }
    Object.values(node).forEach(visit)
  }
  visit(parsed)
})
scan(REAL_DIR)
widgets.forEach(w => {
  if (!w.options) return
  const bag = precedent[w.component]
  if (!bag) return
  if (bag.customClass && bag.customClass.size && 'customClass' in w.options) {
    assert(bag.customClass.has(shape(w.options.customClass)),
      'customClass "' + w.options.customClass + '" on ' + w.component + ' "' +
      (w.options.name || '') + '" has no precedent in any real form — Builder may refuse to render it',
    )
  }
  /* 🔴 ด่านที่จับได้ทั้งสามบั๊กของ 2026-09-10 — เทียบชุดคีย์ **สองทาง**
     validator ของรีโปเช็คแค่ "คีย์ขาด" · แต่ **คีย์เกิน** ก็ทำให้ Builder ไม่เรนเดอร์
     (checkbox-input ได้ validation/labelTooltip/labelColor ฯลฯ ติดมาจาก common()
      ซึ่ง checkbox จริงทั้ง 7 ตัวไม่มีสักคีย์ ⇒ หายทั้งกลุ่ม) */
  if (bag.keySets.length) {
    const everUsed = bag.keySets.reduce((acc, set) => { set.forEach(k => acc.add(k)); return acc }, new Set())
    const alwaysHas = [...bag.keySets[0]].filter(k => bag.keySets.every(set => set.has(k)))
    const mineKeys = Object.keys(w.options)
    const extra = mineKeys.filter(k => !everUsed.has(k))
    const missing = alwaysHas.filter(k => !mineKeys.includes(k))
    assert.deepStrictEqual(extra, [],
      'extra option keys on ' + w.component + ' "' + (w.options.name || '') +
      '" that no real form has — Builder may refuse to render it')
    assert.deepStrictEqual(missing, [],
      'missing option keys on ' + w.component + ' "' + (w.options.name || '') +
      '" that every real form has')
  }
  if (bag.showCol && bag.showCol.size && 'showCol' in w.options) {
    assert(bag.showCol.has(w.options.showCol),
      'showCol ' + w.options.showCol + ' on ' + w.component + ' "' + (w.options.name || '') +
      '" has no precedent (real forms use ' + [...bag.showCol].join(', ') + ') — Builder may drop the whole group',
    )
  }
})
/* CSS ห้ามหลุดไปโดนฟอร์มอื่นในแอปเดียวกัน — ทุกกฎต้องมีคลาสของฟอร์มนี้นำหน้า */
css.split('\n').map(line => line.trim()).filter(line => line.includes('{') && !line.startsWith('@') && !line.startsWith('}'))
  .forEach(line => assert(
    /^\.cmr-/.test(line),
    'CSS rule must be scoped to this form, found: ' + line,
  ))

/* ── โครงไฟล์ ───────────────────────────────────────────────────────────── */
assert.strictEqual(form.formConfig.modelName, 'formData')
assert.strictEqual(form.formConfig.jsonVersion, 3)
const ids = widgets.map(w => w.id)
assert.strictEqual(new Set(ids).size, ids.length, 'widget id must be unique')
/* ทุก widget ต้องอยู่ใน container — validator เตือนเรื่องนี้และเคยทำ columnSpan ไม่มีผล */
form.fields.forEach(top => assert(
  ['grid', 'card', 'tab'].includes(top.component),
  'every top-level node must be a container, found: ' + top.component,
))

/* ── ข้อ 1–2. ผู้ป่วย ───────────────────────────────────────────────────── */
assert.strictEqual(need('hn').options.required, true, 'HN is the key field, it must be required')
;['patient_name', 'patient_age', 'patient_birth_date', 'patient_weight'].forEach(need)
/* ช่องที่เอกสารบอกว่า "ลิงค์จากข้อมูล EMR/Patient" ห้ามให้พิมพ์เอง จะได้ไม่ขัดกับ EMR */
assert.strictEqual(need('patient_name').options.readonly, true)
assert.strictEqual(need('patient_age').options.readonly, true)

/* ── ข้อ 3. รายการตรวจ ──────────────────────────────────────────────────── */
const exam = need('exam_items')
const ctChoice = need('exam_ct_choice')
const radiationChoice = need('exam_radiation_choice')
/* แก้ assertion 2026-09-11 ตามภาพ Builder จากผู้ใช้: ต้องเป็นช่องติ๊กแบบเดิม
   แต่ยังคงสัญญาเลือกได้ครั้งละ 1 choice ด้วย onChange ไม่ใช่เปลี่ยนเป็น radio button */
assert.strictEqual(exam.component, 'checkbox-input', 'ต้องคงดีไซน์เป็นช่อง checkbox แบบเดิม')
assert.strictEqual(exam.id, 'checkbox-input90010')
assert.strictEqual(ctChoice.component, 'checkbox-input')
assert.strictEqual(radiationChoice.component, 'checkbox-input')
assert.strictEqual(ctChoice.id, 'checkbox-input99007')
assert.strictEqual(radiationChoice.id, 'checkbox-input99008')
assert.deepStrictEqual([...labels(exam), ...labels(ctChoice), ...labels(radiationChoice)], [
  'Esophagogrphy', 'Upper GI Study', 'GI Follow Through', 'Barium Enema',
  'Loopagram', 'Detecography', 'Geuitogram', 'VCUG', 'Intravenous', 'Cath Lab',
  'CT', 'Radiation dose',
], 'ต้องมี 12 choice และเรียงตามคำสั่งผู้ใช้ 2026-09-11')
const allExamValues = [...values(exam), ...values(ctChoice), ...values(radiationChoice)]
assert.strictEqual(new Set(allExamValues).size, allExamValues.length, 'choice value ห้ามซ้ำ')
assert(exam.options.onChange.includes('this.setValue(selected)'),
  'checkbox ต้องยกเลิกตัวเดิมและคงตัวที่เลือกล่าสุดไว้เพียงหนึ่งค่า')
/* ผู้ใช้สั่ง 2026-09-11 จากภาพ Builder: ช่องลูกต้องอยู่ใต้ choice แม่ทันที
   จึงแยก CT และ Radiation dose เป็น checkbox group ของตัวเองแล้ววางช่องลูกต่อท้าย */
const examCard = need('cmr_exam')
const examOrder = examCard.fields.map(w => w.options.name)
assert(examOrder.indexOf('exam_ct_choice') < examOrder.indexOf('ct_ctdi_vol_mgy'))
assert(examOrder.indexOf('ct_dlp_mgy_cm') < examOrder.indexOf('exam_radiation_choice'))
assert(examOrder.indexOf('exam_radiation_choice') < examOrder.indexOf('radiation_kv'))

/* ทดสอบ Event Setting จริง: ทั้งสาม checkbox group ต้องเลือกค้างรวมกันได้เพียง 1 choice */
const visibility = {}
const fieldRefs = {}
const groupValues = {}
;['exam_items', 'exam_ct_choice', 'exam_radiation_choice'].forEach(name => {
  fieldRefs[name] = { setValue(value) { groupValues[name] = value } }
})
const conditionalFields = [
  'ct_ctdi_vol_mgy', 'ct_dlp_mgy_cm', 'radiation_kv', 'radiation_ma',
  'radiation_time_start', 'radiation_time_end', 'radiation_total_dap', 'radiation_total_ed',
]
conditionalFields.forEach(name => {
  fieldRefs[name] = {
    options: { hidden: true },
    field: { options: { hidden: true } },
    setHidden(hidden) { visibility[name] = hidden },
  }
})
let selectedExam = null
const examRuntime = {
  getFormRef() { return { getFieldRef(name) { return fieldRefs[name] } } },
  setValue(value) { selectedExam = value },
}
new Function('value', exam.options.onChange).call(examRuntime, ['ivp', 'be'])
assert.deepStrictEqual(selectedExam, ['be'], 'รายการทั่วไปต้องเก็บ choice ที่ติ๊กล่าสุดเพียงตัวเดียว')
assert.deepStrictEqual(groupValues.exam_ct_choice, [])
assert.deepStrictEqual(groupValues.exam_radiation_choice, [])
new Function('value', ctChoice.options.onChange).call(examRuntime, ['ct'])
assert.deepStrictEqual(groupValues.exam_items, [], 'เลือก CT ต้องยกเลิกรายการทั่วไป')
assert.deepStrictEqual(groupValues.exam_radiation_choice, [], 'เลือก CT ต้องยกเลิก Radiation dose')
;['ct_ctdi_vol_mgy', 'ct_dlp_mgy_cm'].forEach(name => assert.strictEqual(visibility[name], false))
;['radiation_kv', 'radiation_ma', 'radiation_time_start', 'radiation_time_end',
  'radiation_total_dap', 'radiation_total_ed']
  .forEach(name => assert.strictEqual(visibility[name], true))
new Function('value', radiationChoice.options.onChange).call(examRuntime, ['radiation_dose'])
assert.deepStrictEqual(groupValues.exam_items, [], 'เลือก Radiation dose ต้องยกเลิกรายการทั่วไป')
assert.deepStrictEqual(groupValues.exam_ct_choice, [], 'เลือก Radiation dose ต้องยกเลิก CT')
;['ct_ctdi_vol_mgy', 'ct_dlp_mgy_cm'].forEach(name => assert.strictEqual(visibility[name], true))
;['radiation_kv', 'radiation_ma', 'radiation_time_start', 'radiation_time_end',
  'radiation_total_dap', 'radiation_total_ed']
  .forEach(name => assert.strictEqual(visibility[name], false))
/* เลือก CT หรือ Radiation dose แล้วค่อยเปิดช่องรายละเอียดใต้ choice นั้น */
const CT_FIELDS = ['ct_ctdi_vol_mgy', 'ct_dlp_mgy_cm']
const RADIATION_FIELDS = [
  'radiation_kv', 'radiation_ma', 'radiation_time_start', 'radiation_time_end',
  'radiation_total_dap', 'radiation_total_ed',
]
;[...CT_FIELDS, ...RADIATION_FIELDS].forEach(name => {
  assert.strictEqual(need(name).options.hidden, true, name + ' must start hidden')
})
CT_FIELDS.forEach(name => assert(ctChoice.options.onChange.includes(name), 'CT must reveal ' + name))
RADIATION_FIELDS.forEach(name => assert(radiationChoice.options.onChange.includes(name),
  'Radiation dose must reveal ' + name))
CT_FIELDS.forEach(name => assert.strictEqual(need(name).component, 'number-input'))
;['radiation_kv', 'radiation_ma', 'radiation_total_dap', 'radiation_total_ed']
  .forEach(name => assert.strictEqual(need(name).component, 'number-input'))
;['radiation_time_start', 'radiation_time_end'].forEach(name => {
  assert.strictEqual(need(name).component, 'date-input')
  assert.strictEqual(need(name).options.dateType, 'time')
})
assert.strictEqual(need('ct_ctdi_vol_mgy').options.suffixText, 'mGy')
assert.strictEqual(need('ct_dlp_mgy_cm').options.suffixText, 'mGy·cm')
assert.strictEqual(need('radiation_total_dap').options.suffixText, 'CcGycm²')
assert.strictEqual(need('radiation_total_ed').options.suffixText, 'mGy')
/* ฟิลด์ใหม่ห้ามทำให้ id/key ของข้อ 4–9 ที่ไม่ได้สั่งแก้เลื่อนตาม generator */
assert.strictEqual(need('cmr_exam').id, 'card90013')
assert.strictEqual(need('contrast_types').id, 'checkbox-input90014')
assert.strictEqual(need('cmr_contrast').id, 'card90020')
assert.strictEqual(need('used_at').id, 'date-input90021')
assert.strictEqual(need('extravasation').id, 'radio-input90025')
assert.strictEqual(need('cmr_adverse').id, 'card90034')
const summaryScript = need('cmr_summary').options.onCreated
;[...CT_FIELDS, ...RADIATION_FIELDS].forEach(name => {
  assert(summaryScript.includes(name), 'หน้าสรุปต้องรองรับค่า ' + name)
})
assert(summaryScript.includes("chosen==='ct'"), 'หน้าสรุปต้องแสดงค่า CT เฉพาะเมื่อเลือก CT')
assert(summaryScript.includes("chosen==='radiation_dose'"),
  'หน้าสรุปต้องแสดงค่า radiation dose เฉพาะเมื่อเลือก Radiation dose')

/* ── ข้อ 4–6. สารทึบรังสี ───────────────────────────────────────────────── */
const kinds = need('contrast_types')
assert.deepStrictEqual(labels(kinds), ['Non-Ionic contrast', 'Barium Sulphate'])
;['contrast_brand', 'contrast_concentration', 'contrast_lot_no'].forEach(name => {
  assert.strictEqual(need(name).options.hidden, true, name + ' shows only after Non-Ionic is ticked')
  assert(kinds.options.onChange.includes(name), 'onChange must reveal ' + name)
})
assert.deepStrictEqual(labels(need('route_types')), ['กิน', 'สวน', 'ฉีด'])
const volume = need('contrast_volume_ml')
assert.strictEqual(volume.component, 'number-input', 'เอกสารสั่ง "อาจจะ number input"')
assert.strictEqual(volume.options.suffixText, 'ml.')

/* ── ข้อ 7–8. เวลา และแพทย์ ─────────────────────────────────────────────── */
const usedAt = need('used_at')
assert.strictEqual(usedAt.options.dateType, 'datetime', 'เอกสารขอทั้งเวลาและวันที่')
assert.strictEqual(usedAt.options.initCurrent, true,
  '"เลือก date กรองวันที่เขากำลังกรอกได้เลย" ⇒ ต้องตั้งเป็นเวลาปัจจุบันให้')
const doctor = need('order_doctor')
assert.strictEqual(doctor.component, 'select-input', 'เอกสารสั่ง "ทำเป็น mockup dropdown ไปก่อน"')
assert(doctor.options.optionItems.length > 0)
doctor.options.optionItems.forEach(o => assert(
  o.label.includes('(ตัวอย่าง)'),
  'ทุกชื่อแพทย์ต้องกำกับว่าเป็นตัวอย่าง จะได้ไม่มีใครเข้าใจว่าเป็นข้อมูลจริง',
))
/* "เลขใบอนุญาตจะดึงจากชื่อที่เลือก" — ต้องเติมให้ ไม่ใช่ให้พิมพ์เอง */
assert.strictEqual(need('order_doctor_license').options.readonly, true)
assert(doctor.options.onChange.includes('order_doctor_license'))

/* ── ข้อ 9. อาการไม่พึงประสงค์ ──────────────────────────────────────────── */
assert.deepStrictEqual(labels(need('extravasation')), ['No', 'Yes'],
  'Contrast Media Extravasation No ; Yes')
const SYMPTOMS = [
  'Erythema ผิวหนังแดง/ผื่นแดง',
  'Swelling อาการบวม',
  'Pruritus อาการคัน',
  'Angioedema อาการบวมของเนื้อเยื่อใต้ผิวหนัง เช่น ใบหน้า ริมฝีปาก รอบตา หรือลิ้นบวม',
  'Nausea คลื่นไส้',
  'Vomiting อาเจียน',
  'Headache ปวดศีรษะ',
  'Maculopapular rash ผื่นแดงราบร่วมกับผื่นนูน/ผื่นแดงนูนกระจาย',
  'Urticaria ลมพิษ',
  'Anaphylactic Shock ภาวะช็อกจากการแพ้รุนแรง',
  'Other อื่นๆ ระบุ',
]
/* เอกสารใช้รายการอาการชุดเดียวกันทั้ง Acute และ Delay — ห้ามหลุดจากกัน */
assert.deepStrictEqual(labels(need('acute_symptoms')), SYMPTOMS)
assert.deepStrictEqual(labels(need('delay_symptoms')), SYMPTOMS)
;[['acute_symptoms', 'acute_other_detail'], ['delay_symptoms', 'delay_other_detail']].forEach(pair => {
  assert.strictEqual(need(pair[1]).options.hidden, true, pair[1] + ' starts hidden')
  assert(need(pair[0]).options.onChange.includes(pair[1]), 'ติ๊ก "อื่นๆ" แล้วต้องขึ้นช่องให้กรอก')
})
const onset = need('delay_onset_time')
assert.strictEqual(onset.options.dateType, 'time', 'เอกสารสั่ง "(เลือกเวลา time)"')

/* ผู้ใช้สั่ง 2026-09-10: กด Yes แล้วค่อยขึ้นทั้งสองหัวข้อ */
const extrav = need('extravasation')
;['cmr_acute_head', 'acute_symptoms', 'cmr_delay_head', 'delay_onset_time', 'delay_symptoms']
  .forEach(name => {
    assert.strictEqual(need(name).options.hidden, true, name + ' ต้องซ่อนไว้ก่อนกด Yes')
    assert(extrav.options.onChange.includes(name), 'Yes ต้องเปิด ' + name)
  })
assert(extrav.options.onChange.includes("picked.indexOf('yes')"), 'ต้องเปิดเฉพาะตอนเลือก Yes')
assert(extrav.options.onChange.includes('acute_other_detail'),
  'เลือก No แล้วช่อง "อื่นๆ ระบุ" ต้องถูกปิดตามด้วย ไม่ลอยค้าง')

/* ── Contrast History (หน้าสรุป) ────────────────────────────────────────── */
const summary = need('cmr_summary')
;['วันที่ใช้สารทึบรังสี', 'รายการตรวจพิเศษทางรังสี', 'สารทึบรังสีที่ใช้',
  'ปริมาณสารทึบรังสีที่ใช้', 'อาการไม่พึงประสงค์ของการใช้ยา', 'แพทย์ผู้สั่ง'
].forEach(line => assert(
  summary.options.onCreated.includes(line),
  'หน้าสรุปต้องมีบรรทัด: ' + line,
))
assert(summary.options.content.includes("|| '-'"),
  'ผู้ใช้สั่ง: ช่องที่ยังไม่กรอกให้ใส่ "-"')
/* interval ต้องถูกเคลียร์ ไม่งั้นเปิด-ปิดฟอร์มหลายรอบจะมี timer ค้างสะสม */
assert(summary.options.onMounted.includes('setInterval'))
assert(summary.options.onUnmount.includes('clearInterval'), 'the refresh timer must be cleaned up')

/* 🔴 เพิ่ม 2026-09-24 (ผู้ใช้ส่งภาพ: หน้าสรุปขึ้น "-" ทุกบรรทัดทั้งที่กรอกแล้ว)
   ของเดิมอ่าน `getFormRef().formData` ทางเดียว · form ref จริงในรีโปไม่ได้เก็บค่า
   ไว้ที่ชื่อนั้นเสมอไป ⇒ รันสคริปต์ onCreated จริงกับ form ref ทุกทรงที่พบในรีโป
   และคู่มือ field แล้วบังคับว่าต้องสรุปออกมาได้ครบทุกทรง ไม่ใช่แค่ทรงเดียว */
const SUMMARY_MODEL = {
  used_at: '2026-09-24 10:00', exam_items: ['ivp'],
  contrast_types: ['non_ionic'], contrast_brand: 'Omnipaque',
  contrast_volume_ml: 80, extravasation: 'no', order_doctor: 'mock-01',
}
const runSummary = formRef => {
  const ctx = { vueState: {}, getFormRef: () => formRef }
  new Function(summary.options.onCreated).call(ctx)   // eslint-disable-line no-new-func
  return ctx.vueState.rows.map(r => r.value)
}
const SUMMARY_EXPECTED = [
  '2026-09-24 10:00', 'Intravenous', 'Non-Ionic contrast · Omnipaque',
  '80 ml.', 'Extravasation: NO', '(ตัวอย่าง) นพ. ก. รังสีชำนาญ — ว.10001',
]
;[
  ['formDataModel', { formDataModel: SUMMARY_MODEL }],           // visit.json, person_form.json
  ['$props.formData', { $props: { formData: SUMMARY_MODEL } }],  // APPT_Doctor_Book_UI.json
  ['formData', { formData: SUMMARY_MODEL }],                     // เส้นทางเดิม ห้ามหาย
  ['getFormData(false)', { getFormData: () => SUMMARY_MODEL }],  // คู่มือ fields-reference
].forEach(([shape, formRef]) => assert.deepStrictEqual(
  runSummary(formRef), SUMMARY_EXPECTED,
  'หน้าสรุปต้องอ่านค่าได้จาก form ref ทรง ' + shape,
))
/* ฟอร์มที่ยังว่างต้องว่างจริง ไม่ใช่เดาค่าให้ — ฝั่ง template จะแสดง "-" เอง */
assert.deepStrictEqual(runSummary({ formDataModel: {} }), ['', '', '', '', '', ''],
  'ฟอร์มว่างต้องสรุปออกมาว่าง ไม่ใช่มีค่าแปลกปลอม')

/* 🔴 เพิ่ม 2026-09-24 รอบสอง — timer ยิง s.build() ทุก 1.2 วินาทีตลอดเวลาที่ฟอร์มเปิด
   หน้าสรุปจึงห้ามเรียก "ฟังก์ชันของฟอร์ม" ซ้ำ ๆ ระหว่างที่คนกำลังกรอก
   อ่าน property ได้ไม่จำกัด · getFormData() เป็นทางสำรองและต้องมีเพดาน */
const countingRef = extra => {
  const ref = Object.assign({ calls: 0 }, extra)
  ref.getFormData = () => { ref.calls += 1; return SUMMARY_MODEL }
  return ref
}
const buildMany = (formRef, times) => {
  const ctx = { vueState: {}, getFormRef: () => formRef }
  new Function(summary.options.onCreated).call(ctx)   // eslint-disable-line no-new-func
  for (let i = 1; i < times; i += 1) ctx.vueState.build()
  return ctx.vueState.rows.map(r => r.value)
}
/* 1) อ่าน property ได้ = ห้ามแตะ getFormData() เลยสักครั้ง (เคสของจริงในระบบนี้) */
const cheapRef = countingRef({ formDataModel: SUMMARY_MODEL })
assert.deepStrictEqual(buildMany(cheapRef, 20), SUMMARY_EXPECTED,
  'อ่านจาก property ได้แล้วต้องสรุปถูกทุกรอบ')
assert.strictEqual(cheapRef.calls, 0,
  'อ่าน property ได้แล้วห้ามเรียก getFormData() เลยสักครั้ง')
/* 2) รันไทม์ที่มีแต่ getFormData ต้องยังสรุปได้ "ทุกรอบ" ไม่ใช่นิ่งค้างหลังครบเพดาน */
const fallbackRef = countingRef({})
assert.deepStrictEqual(buildMany(fallbackRef, 20), SUMMARY_EXPECTED,
  'ทรงที่มีแต่ getFormData ต้องยังสรุปได้ทุกรอบ ไม่ใช่ค้างหลังลองครบ 3 ครั้ง')
/* 3) ลองแล้วไม่ได้อะไร = ต้องเลิกยิง ไม่ใช่ไล่เรียกทุก 1.2 วินาทีไปเรื่อย ๆ */
const deadRef = { calls: 0 }
deadRef.getFormData = () => { deadRef.calls += 1; return {} }
buildMany(deadRef, 20)
assert(deadRef.calls > 0 && deadRef.calls <= 3,
  'getFormData() ที่ไม่เคยคืนค่าต้องหยุดยิงตามเพดาน (1–3 ครั้ง) — เรียกไป ' + deadRef.calls)

/* ── ยังไม่เชื่อมอะไร — ผู้ใช้สั่งว่า "ทำฟอร์มมาก่อน" ─────────────────────── */
const blob = JSON.stringify(form)
assert(!/runProcess|processCall/.test(blob),
  'รอบนี้เป็นฟอร์มเปล่า ยังไม่ต้องเรียก Process ใด ๆ')


/* ── ตัวระบุรายการตรวจ · การ์ด cmr_link (ผู้ใช้สั่ง 2026-09-23) ──────────────
   "ฟอร์ม xray-contrast-media-record-v1 ต้องมีช่องเก็บ order_id / item_id /
    accession_no ผูกกลับมาที่รายการตรวจ"
   ปุ่ม "สารทึบ" ในหน้า X-ray Worklist ส่งค่าชุดนี้มาทาง initData — ไม่มีช่องรับ
   เท่ากับค่าถูกทิ้งทันที และใบบันทึกจะผูกกลับไปที่รายการตรวจไม่ได้เลย */
const LINK_FIELDS = [
  'item_id', 'accession_no', 'order_id', 'order_no',
  'visit_id', 'modality', 'item_code', 'item_name',
]
const linkCard = need('cmr_link')
assert.strictEqual(linkCard.component, 'card')
assert.strictEqual(linkCard.options.folded, true, 'การ์ดนี้พับไว้ ไม่รบกวนการกรอก แต่กางตรวจสอบได้')
LINK_FIELDS.forEach(name => {
  const f = need(name)
  assert.strictEqual(f.component, 'text-input', name + ' ต้องเป็น text-input')
  assert.strictEqual(f.options.readonly, true, name + ' ระบบเติมให้ ห้ามพิมพ์ทับ')
  assert.strictEqual(f.options.required, false, name + ' ห้าม required — เปิดฟอร์มตรง ๆ ต้องยังบันทึกได้')
})
assert.deepStrictEqual(
  linkCard.fields.map(f => f.options.name), LINK_FIELDS,
  'ลำดับช่องในการ์ดตัวระบุรายการต้องคงที่',
)
/* 🔴 HN ผูกอยู่แล้วผ่านช่อง hn เดิมของหมวด 1–2 — ห้ามสร้างช่อง HN ซ้ำในการ์ดนี้
   สองช่องชื่อเดียวกันจะชนกัน และสองช่องคนละชื่อจะทำให้ไม่รู้ว่าอันไหนคือของจริง */
assert(!LINK_FIELDS.includes('hn'), 'HN uses the existing field, never a second one')
assert(byName.hn, 'the original HN field must still exist')

/* 🔴 ของเดิมต้องไม่ขยับ — การ์ดใหม่ต่อท้าย จึงห้ามมี id/key ของหมวด 1–9 เลื่อน */
assert.strictEqual(need('cmr_patient').id, 'card90009')
assert.strictEqual(need('cmr_history').id, 'card90036')
assert.strictEqual(
  form.fields[form.fields.length - 1].options.name, 'cmr_link',
  'การ์ดตัวระบุรายการต้องอยู่ท้ายสุดเสมอ — แทรกกลางแล้ว key ของหมวดเดิมจะเลื่อน',
)
/* timer ของหน้าสรุปต้องยังถูกเคลียร์ ถึงจะไม่ใช่การ์ดสุดท้ายแล้วก็ตาม
   (เดิม generator อ้าง fields[length-1] ซึ่งพังทันทีที่มีการ์ดต่อท้าย) */
assert(need('cmr_summary').options.onUnmount.includes('clearInterval'),
  'the summary timer cleanup must not move to the new card')

console.log('X-ray contrast media form tests passed')
