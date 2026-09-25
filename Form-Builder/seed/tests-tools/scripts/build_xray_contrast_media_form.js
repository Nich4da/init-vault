/* สร้าง SDForm JSON: บันทึกการใช้สารทึบรังสี — สถาบันสุขภาพเด็กแห่งชาติมหาราชินี
 *
 * ที่มา: เอกสารกระดาษที่ผู้ใช้ส่งมา 2026-09-10 (3 หน้า)
 * ปลายทาง: Form-Builder/SDForm/X-ray/xray-contrast-media-record-v1.json
 *
 * รอบนี้ทำ **เฉพาะตัวฟอร์ม** ตามที่ผู้ใช้สั่ง ("ทำฟอร์มมาก่อน")
 * ยังไม่เชื่อม API และยังไม่มีปุ่มเปิดจากหน้า X-ray worklist
 *
 * 🔴 จุดที่เอกสารต้นฉบับไม่ครบ/ขัดกันเอง — ตัดสินใจไว้ตรงนี้ ไม่ได้เดาเงียบ ๆ:
 *   1) รายการตรวจข้อ 3 ปรับตามคำสั่งผู้ใช้ 2026-09-11 เป็น checkbox หน้าตาเดิม
 *      แต่เลือกค้างได้ครั้งละ 1 รายการ จำนวน 12 รายการตามลำดับที่กำหนด ดู EXAM_ITEMS
 *   2) ชื่อแพทย์ผู้สั่งยังไม่มี master — เอกสารสั่งให้ "ทำเป็น mockup dropdown ไปก่อน"
 *      จึงใส่รายชื่อสมมติที่ **เขียนกำกับว่า (ตัวอย่าง)** ทุกตัว จะได้ไม่มีใครเผลอ
 *      คิดว่าเป็นข้อมูลจริง · เลขใบอนุญาตเติมอัตโนมัติจากชื่อที่เลือก
 *   3) Contrast History เอกสารบอกว่า "ดึงข้อมูลมาสรุป" ซึ่งต้องใช้ API ที่ยังไม่มี
 *      จึงทำเป็นแผงสรุป **ของใบที่กำลังกรอกอยู่** และบอกตรง ๆ ว่าประวัติย้อนหลัง
 *      จะขึ้นเมื่อเชื่อม API แล้ว ไม่ทำตารางเปล่าหลอกไว้
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '../../../..')
const outPath = path.join(root, 'Form-Builder/SDForm/X-ray/xray-contrast-media-record-v1.json')

let seq = 90000
const nextKey = () => (seq += 1)

/* ── ตัวช่วยสร้างฟิลด์ — ทรง options ลอกจากฟอร์มที่ import เข้า Builder ได้จริง
      (xray_result.json · xray_order_status_change.json · patient.json) ────── */
const base = (component, name, fieldType, opts, extra) => {
  /* ฟิลด์ใหม่ที่แทรกกลางฟอร์มใช้ key สำรองแบบ explicit เพื่อไม่ให้ key/id ของ
     ฟิลด์เดิมด้านล่างเลื่อนตามลำดับ generator และกระทบข้อมูล/การอ้างอิงเดิม */
  const key = extra && Number.isInteger(extra.key) ? extra.key : nextKey()
  return Object.assign({
    key,
    name: name,
    component,
    category: extra && extra.category ? extra.category : 'basic_input',
    icon: component,
    fieldType,
    fieldLength: null,
    children: false,
    enable: true,
    formItemFlag: extra && extra.formItemFlag === false ? false : true,
    options: opts,
    id: component + key
  }, (extra && extra.rest) || {})
}

const common = o => ({
  labelWidth: null,
  labelHidden: false,
  hidden: false,
  disabled: false,
  required: false,
  requiredHint: '',
  validation: '',
  validationHint: '',
  customClass: '',
  labelIconClass: null,
  labelIconPosition: 'rear',
  labelTooltip: o.labelTooltip || null,
  labelColor: null,
  onCreated: '',
  onMounted: '',
  onUnmount: '',
  onChange: o.onChange || '',
  onValidate: ''
})

const text = o => base('text-input', 'Text Input', 'String', Object.assign(common(o), {
  name: o.name, label: o.label, labelAlign: '', type: 'text',
  defaultValue: o.defaultValue == null ? null : o.defaultValue,
  placeholder: o.placeholder || '', columnSpan: o.span || 8, size: '',
  readonly: !!o.readonly, clearable: true, showPassword: false,
  required: !!o.required, requiredHint: o.required ? ('กรุณาระบุ' + o.label) : '',
  disabled: !!o.disabled, hidden: !!o.hidden,
  minLength: null, maxLength: o.maxLength || null, showWordLimit: false,
  prefixIcon: '', suffixIcon: '', prefixText: '', suffixText: o.suffixText || '',
  appendButton: false, appendButtonDisabled: false, buttonIcon: 'el-search',
  onInput: '', onFocus: '', onBlur: '', onAppendButtonClick: ''
}))

const textarea = o => base('textarea-input', 'Textarea', 'String', Object.assign(common(o), {
  name: o.name, label: o.label, labelAlign: '', rows: o.rows || 3,
  defaultValue: null, placeholder: o.placeholder || '', columnSpan: o.span || 24,
  size: '', readonly: false, autoSize: false, hidden: !!o.hidden,
  minLength: null, maxLength: o.maxLength || 2000, showWordLimit: true,
  onInput: '', onFocus: '', onBlur: ''
}))

const number = o => base('number-input', 'Number Input', 'Number', Object.assign(common(o), {
  name: o.name, label: o.label, labelAlign: '', defaultValue: null,
  placeholder: o.placeholder || '', columnSpan: o.span || 6, size: '',
  hidden: !!o.hidden, required: !!o.required,
  requiredHint: o.required ? ('กรุณาระบุ' + o.label) : '',
  min: o.min == null ? 0 : o.min, max: o.max == null ? 100000 : o.max,
  precision: o.precision == null ? 0 : o.precision, step: o.step || 1,
  controlsPosition: 'right', prefixIcon: '', suffixIcon: '',
  prefixText: '', suffixText: o.suffixText || '',
  onFocus: '', onBlur: ''
}), { key: o.key })

const dateField = o => base('date-input', 'Date Time', 'StringDate', Object.assign(common(o), {
  name: o.name, label: o.label, labelAlign: '', dateType: o.dateType || 'datetime',
  defaultValue: null, placeholder: o.placeholder || '', columnSpan: o.span || 8,
  size: '', autoFullWidth: true, readonly: false, clearable: true, editable: false,
  hidden: !!o.hidden, required: !!o.required,
  requiredHint: o.required ? ('กรุณาระบุ' + o.label) : '',
  format: o.format || 'DD/MM/YYYY HH:mm', valueFormat: o.valueFormat || 'YYYY-MM-DD HH:mm:ss',
  disabledDate: false,
  /* เอกสารเขียนว่า "เลือก date กรองวันที่เขากำลังกรอกได้เลย" ⇒ เปิดฟอร์มมาให้เป็นตอนนี้ */
  initCurrent: !!o.initCurrent,
  onFocus: '', onBlur: ''
}), { key: o.key })

/* ── checkbox-input ────────────────────────────────────────────────────────
   🔴 แก้ 2026-09-10 (รอบสี่ · ผู้ใช้ส่งภาพจาก Builder มา): checkbox **หายทั้ง 5 กลุ่ม**
   ทั้งกลุ่มที่ไม่ได้ซ่อนอยู่แล้ว (exam_items · contrast_types · route_types) และกลุ่มที่
   ต้องโผล่ตอนกด Yes ⇒ ไม่ใช่บั๊กของ setShown แต่ widget ไม่ถูกเรนเดอร์มาตั้งแต่ต้น

   หลักฐานที่ทำให้ฟันธง (สแกนทั้งรีโป 2026-09-10):
     · ทุก widget ในฟอร์มนี้ที่ "ขึ้นจริง" มีชุดคีย์ options ตรงกับฟอร์มแม่แบบของระบบใน
       `Form-Builder/SDForm/sdform_module/` แบบไม่ขาดไม่เกินสักคีย์
     · checkbox-input เป็น component เดียวที่ **ไม่มีแม่แบบของระบบเลย** — ชุด 22 คีย์เดิม
       ลอกมาจาก `lab_order_mock_import.json` ซึ่ง *เราเขียนขึ้นเอง* และไม่เคยพิสูจน์ว่า
       import แล้วขึ้นจริง ⇒ ใช้อ้างอิงไม่ได้
     · `radio-input` เป็นวิดเจ็ตพี่น้องของ checkbox และ **มีแม่แบบของระบบ** (patient.json ·
       visit.json · disease.json) = 29 คีย์ ตรงกับ SNAPSHOT ของ validator
       และ radio ในฟอร์มนี้ก็เรนเดอร์ให้เห็นในภาพ (No/Yes) ทั้งที่สร้างด้วย common()

   ⇒ ข้อสรุปเดิมที่เคยเขียนไว้ตรงนี้ ("ห้ามใช้ common() เพราะคีย์เกินทำให้กลุ่มหาย") **ผิด**
     ของจริงคือ SDFORM_JSON_RULES ข้อ ก: **options ไม่ครบชุด ⇒ widget ไม่ render**
     ชุด 22 คีย์ขาดไป 7 คีย์ (labelAlign · validation · validationHint · labelIconClass ·
     labelIconPosition · labelTooltip · labelColor) รอบนี้จึงใช้ common() เหมือน radio
     ทุกประการ ⇒ ได้ครบ 29 คีย์เท่าแม่แบบ

   ค่า presentation ตั้งตามแม่แบบ radio-input ห้ามแต่งเอง (กฎข้อ ง):
     border:false · showCol:0 · displayStyle:'' · customClass:''
   "1 บรรทัดต่อ 1 ตัวเลือก" ที่ผู้ใช้สั่งไว้ 2026-09-10 ย้ายไปทำด้วย CSS ที่เกาะคลาสระดับ
   ฟอร์ม (`formConfig.customClass:['cmr-form']`) แทนการใส่คลาสลงในตัว widget
   ถ้า Builder รุ่นนี้ไม่ติดคลาสให้ฟอร์ม ตัวเลือกจะเรียงต่อกันแบบปกติ — อ่านได้ ไม่หาย */
const checkbox = o => base('checkbox-input', 'Checkbox', 'Array', Object.assign(common(o), {
  name: o.name, label: o.label, labelAlign: '', labelHidden: !!o.labelHidden, defaultValue: [],
  columnSpan: o.span || 24, size: '', displayStyle: '', buttonStyle: false,
  border: false, showCol: 0, hidden: !!o.hidden, optionItems: o.items,
  customClass: ''
}), { key: o.key })

const radio = o => base('radio-input', 'Radio Button', 'String', Object.assign(common(o), {
  name: o.name, label: o.label, labelAlign: '', defaultValue: o.defaultValue || '',
  columnSpan: o.span || 8, size: '', displayStyle: '', buttonStyle: true,
  border: false, showCol: 0, hidden: !!o.hidden, optionItems: o.items,
  /* radio-input ในรีโป 21/21 ตัวก็เว้น customClass ว่างเหมือนกัน ⇒ ไม่เสี่ยง */
  customClass: ''
}))

const select = o => base('select-input', 'Select Input', 'String|Array', Object.assign(common(o), {
  name: o.name, label: o.label, labelAlign: '', defaultValue: '',
  placeholder: o.placeholder || '', columnSpan: o.span || 8, size: '',
  hidden: !!o.hidden, clearable: true, filterable: true, allowCreate: false,
  remote: false, automaticDropdown: false, multiple: false, multipleLimit: null,
  optionItems: o.items,
  onFocus: '', onBlur: '', onClear: '', onRemoteQuery: ''
}))

const html = o => base('vue-ui', 'Components', 'None', {
  name: o.name, label: o.label || '', columnSpan: 24, hidden: !!o.hidden, content: o.content,
  customClass: [], onCreated: o.onCreated || '', onMounted: o.onMounted || '', onUnmount: ''
}, { category: 'display_ui', formItemFlag: false })

/* widget ที่ลอยอยู่ root จะไม่กิน columnSpan (validator เตือน) ⇒ ห่อด้วย grid เสมอ */
const grid = (name, inner) => {
  const gKey = nextKey()
  const cKey = nextKey()
  return {
    key: gKey, name: 'Layout', component: 'grid', category: 'container', icon: 'grid',
    fieldType: 'None', fieldLength: null, children: false, enable: true,
    options: { name: name + '_root', hidden: false, gutter: 16, colHeight: null, customClass: '' },
    id: 'grid-' + name,
    cols: [{
      key: cKey, name: 'Grid Col', component: 'grid-col', category: 'container', icon: 'grid-col',
      fieldType: 'None', fieldLength: null, children: true, enable: true,
      options: {
        name: name + '_col', hidden: false, span: 24, offset: 0, push: 0, pull: 0,
        responsive: false, md: 12, sm: 24, xs: 24, bgColor: null, customClass: ''
      },
      id: 'grid-col-' + name,
      fields: inner
    }],
    fields: []
  }
}

const card = (o, fields) => {
  const key = nextKey()
  return {
    key, name: 'Card', component: 'card', category: 'container', icon: 'card',
    fieldType: 'None', fieldLength: null, children: false, enable: true,
    fields,
    options: {
      name: o.name, label: o.label, subLabel: o.subLabel || '', hidden: false,
      /* folded เพิ่ม 2026-09-23 — ไม่ส่งค่ามา = false เหมือนเดิมทุกการ์ดที่มีอยู่ */
      folded: o.folded === true, bgbody: false, showFold: true, headerDisable: false,
      headerType: null, headerEffect: 'plain', labelColor: null, cardWidth: '',
      /* 🔴 ห้ามใส่ค่าใน customClass ของ card — ฟอร์มจริงในรีโป 70/70 ตัวเว้นว่างหมด
         และช่อง Custom Class ในหน้า Property เป็น Select ที่เลือกจากรายการที่มีอยู่
         ใส่ค่าที่ระบบไม่รู้จักลงไปแล้ว Builder เรนเดอร์ card ไม่ออกทั้งใบ
         (ผู้ใช้เจอจริง 2026-09-10: Tree View เห็นครบแต่ canvas ว่าง) */
      themes: 'wcard-soft', shadow: 'never', customClass: '',
      labelIconText: false, labelIconClass: o.icon || 'el-document',
      labelIconPosition: 'front', labelTooltip: null
    },
    id: 'card' + key
  }
}

/* ── ตัวช่วยซ่อน/แสดงฟิลด์ตามการติ๊ก ────────────────────────────────────────
   Builder ไม่มี API มาตรฐานตัวเดียวสำหรับเรื่องนี้ · ฟอร์มที่ใช้จริงในรีโปเซ็ต
   options.hidden ตรง ๆ (ดู EMR.json) จึงลองทุกทางที่เป็นไปได้แล้วค่อยเซ็ตตัวแปร
   ถ้ารุ่นไหนไม่รองรับ ฟิลด์จะโผล่ตลอดแทนที่จะหายไป — ฝั่งปลอดภัยกว่ากรอกไม่ได้ */
const TOGGLE_HELPER = [
  "const form=this.getFormRef&&this.getFormRef();",
  "if(!form||typeof form.getFieldRef!=='function')return;",
  "const setShown=(name,on)=>{",
  "  const f=form.getFieldRef(name);",
  "  if(!f)return;",
  "  if(typeof f.setHidden==='function'){f.setHidden(!on);}",
  "  else if(on&&typeof f.show==='function'){f.show();}",
  "  else if(!on&&typeof f.hide==='function'){f.hide();}",
  "  if(f.options)f.options.hidden=!on;",
  "  if(f.field&&f.field.options)f.field.options.hidden=!on;",
  "};",
  "const picked=Array.isArray(value)?value.map(String):(value==null?[]:[String(value)]);"
].join('\n')

/* ── 3. รายการตรวจพิเศษทางรังสี ─────────────────────────────────────────────
   ผู้ใช้กำหนดใหม่ 2026-09-11: เลือกได้เพียงหนึ่งรายการและเรียงตามลำดับนี้ */
const EXAM_ITEMS = [
  { label: 'Esophagogrphy', value: 'esophagography' },
  { label: 'Upper GI Study', value: 'upper_gi' },
  { label: 'GI Follow Through', value: 'gi_follow_through' },
  { label: 'Barium Enema', value: 'be' },
  { label: 'Loopagram', value: 'loopogram' },
  { label: 'Detecography', value: 'detecography' },
  { label: 'Geuitogram', value: 'genitogram' },
  { label: 'VCUG', value: 'vcug' },
  { label: 'Intravenous', value: 'ivp' },
  { label: 'Cath Lab', value: 'catch_lab' },
  { label: 'CT', value: 'ct' },
  { label: 'Radiation dose', value: 'radiation_dose' }
]
const EXAM_GENERAL_ITEMS = EXAM_ITEMS.filter(item => !['ct', 'radiation_dose'].includes(item.value))

/* อาการไม่พึงประสงค์ — เอกสารใช้รายการเดียวกันทั้ง Acute และ Delay
   ประกาศครั้งเดียวแล้วใช้ซ้ำ จะได้ไม่มีวันหลุดจากกัน */
const SYMPTOM_ITEMS = [
  { label: 'Erythema ผิวหนังแดง/ผื่นแดง', value: 'erythema' },
  { label: 'Swelling อาการบวม', value: 'swelling' },
  { label: 'Pruritus อาการคัน', value: 'pruritus' },
  { label: 'Angioedema อาการบวมของเนื้อเยื่อใต้ผิวหนัง เช่น ใบหน้า ริมฝีปาก รอบตา หรือลิ้นบวม', value: 'angioedema' },
  { label: 'Nausea คลื่นไส้', value: 'nausea' },
  { label: 'Vomiting อาเจียน', value: 'vomiting' },
  { label: 'Headache ปวดศีรษะ', value: 'headache' },
  { label: 'Maculopapular rash ผื่นแดงราบร่วมกับผื่นนูน/ผื่นแดงนูนกระจาย', value: 'maculopapular_rash' },
  { label: 'Urticaria ลมพิษ', value: 'urticaria' },
  { label: 'Anaphylactic Shock ภาวะช็อกจากการแพ้รุนแรง', value: 'anaphylactic_shock' },
  { label: 'Other อื่นๆ ระบุ', value: 'other' }
]

/* แพทย์ผู้สั่ง — mockup ตามที่เอกสารสั่ง · ทุกชื่อมีคำว่า (ตัวอย่าง) กำกับ
   เลขใบอนุญาตผูกไว้กับ value เพื่อให้ onChange เติมช่องเลขใบอนุญาตได้ */
const DOCTOR_ITEMS = [
  { label: '(ตัวอย่าง) นพ. ก. รังสีชำนาญ', value: 'mock-01', license: 'ว.10001' },
  { label: '(ตัวอย่าง) พญ. ข. ภาพวินิจฉัย', value: 'mock-02', license: 'ว.10002' },
  { label: '(ตัวอย่าง) นพ. ค. กุมารเวช', value: 'mock-03', license: 'ว.10003' }
]

const HEAD_CSS = ''

const headerWidget = html({
    name: 'cmr_header',
    content: HEAD_CSS + `<div class="cmr-head">
  <h2>บันทึกการใช้สารทึบรังสี</h2>
  <p>สถาบันสุขภาพเด็กแห่งชาติมหาราชินี · กลุ่มงานรังสีวิทยา</p>
  <div class="cmr-note">เปิดจากคอลัมน์ "สารทึบ" ในหน้า X-ray CPOE Worklist ได้แล้ว (2026-09-23) ·
  ตัวระบุรายการตรวจถูกเติมให้อัตโนมัติ ดูได้ที่การ์ดท้ายฟอร์ม ·
  ยังไม่ได้เชื่อม API ประวัติย้อนหลัง และชื่อแพทย์ผู้สั่งยังเป็นรายการตัวอย่างไว้ทดสอบเท่านั้น</div>
</div>`
  })

const fields = [
  grid('cmr-banner', [headerWidget]),

  /* ── 1–2. ผู้ป่วย ───────────────────────────────────────────────────────
     เอกสารระบุว่า HN เลือกจาก dropdown หรือยิงบาร์โค้ด และชื่อ/อายุ/วันเกิด/
     น้ำหนัก "ลิงค์จากข้อมูล EMR/Patient" ⇒ รอบนี้ทำเป็นช่องกรอกที่ตั้ง readonly
     ไว้ก่อน แล้วให้ตัวเชื่อมเป็นคนเติม · ไม่ทำ dropdown หลอกที่ไม่มีข้อมูลจริง */
  card({ name: 'cmr_patient', label: '1–2. ข้อมูลผู้ป่วย', subLabel: 'ดึงจาก EMR / Patient', icon: 'el-user' }, [
    text({ name: 'hn', label: 'HN', span: 6, required: true,
      placeholder: 'ยิงบาร์โค้ด HN หรือกรอก',
      labelTooltip: 'เลือกจาก dropdown หรือยิงสแกนบาร์โค้ด HN — ต่อกับตัวเลือกผู้ป่วยตอนเชื่อม API' }),
    text({ name: 'patient_name', label: 'ชื่อ-นามสกุล', span: 10, readonly: true,
      placeholder: 'เติมอัตโนมัติจาก HN' }),
    text({ name: 'patient_age', label: 'อายุ', span: 4, readonly: true,
      placeholder: 'เติมอัตโนมัติ' }),
    dateField({ name: 'patient_birth_date', label: 'วันเดือนปีเกิด', span: 4,
      dateType: 'date', format: 'DD/MM/YYYY', valueFormat: 'YYYY-MM-DD',
      placeholder: 'เติมอัตโนมัติ' }),
    number({ name: 'patient_weight', label: 'น้ำหนักผู้ป่วย', span: 4,
      precision: 1, max: 300, suffixText: 'กก.', placeholder: 'เติมอัตโนมัติ' })
  ]),

  /* ── 3. รายการตรวจพิเศษทางรังสี ────────────────────────────────────────── */
  card({ name: 'cmr_exam', label: '3. รายการตรวจพิเศษทางรังสี', subLabel: 'เลือกได้ 1 รายการ', icon: 'el-first-aid-kit' }, [
    checkbox({
      name: 'exam_items', label: 'รายการตรวจ', items: EXAM_GENERAL_ITEMS, showCol: 3,
      onChange: [
        TOGGLE_HELPER,
        "/* คงหน้าตา checkbox แต่บังคับให้เหลือตัวล่าสุดเพียงตัวเดียว",
        "   ห้ามเพิ่ม maxCheck เพราะ checkbox ไม่มี system template ของตัวเอง */",
        "const selected=picked.length>1?[picked[picked.length-1]]:picked;",
        "if(picked.length>1&&typeof this.setValue==='function')this.setValue(selected);",
        "const setGroup=(name,val)=>{const f=form.getFieldRef(name);if(f&&typeof f.setValue==='function')f.setValue(val);};",
        "if(selected.length){",
        "  setGroup('exam_ct_choice',[]);setGroup('exam_radiation_choice',[]);",
        "  ['ct_ctdi_vol_mgy','ct_dlp_mgy_cm','radiation_kv','radiation_ma',",
        "   'radiation_time_start','radiation_time_end','radiation_total_dap','radiation_total_ed']",
        "    .forEach(name=>setShown(name,false));",
        "}"
      ].join('\n')
    }),
    checkbox({
      key: 99007, name: 'exam_ct_choice', label: 'CT', labelHidden: true,
      items: [{ label: 'CT', value: 'ct' }],
      onChange: [
        TOGGLE_HELPER,
        "const on=picked.indexOf('ct')>=0;",
        "const setGroup=(name,val)=>{const f=form.getFieldRef(name);if(f&&typeof f.setValue==='function')f.setValue(val);};",
        "if(on){setGroup('exam_items',[]);setGroup('exam_radiation_choice',[]);}",
        "['ct_ctdi_vol_mgy','ct_dlp_mgy_cm'].forEach(name=>setShown(name,on));",
        "if(on)['radiation_kv','radiation_ma','radiation_time_start','radiation_time_end',",
        " 'radiation_total_dap','radiation_total_ed'].forEach(name=>setShown(name,false));"
      ].join('\n')
    }),
    number({ name: 'ct_ctdi_vol_mgy', label: 'CTDI vol', span: 12, hidden: true,
      precision: 2, max: 100000, suffixText: 'mGy', placeholder: '0' }),
    number({ name: 'ct_dlp_mgy_cm', label: 'DLP', span: 12, hidden: true,
      precision: 2, max: 1000000, suffixText: 'mGy·cm', placeholder: '0' }),
    checkbox({
      key: 99008, name: 'exam_radiation_choice', label: 'Radiation dose', labelHidden: true,
      items: [{ label: 'Radiation dose', value: 'radiation_dose' }],
      onChange: [
        TOGGLE_HELPER,
        "const on=picked.indexOf('radiation_dose')>=0;",
        "const setGroup=(name,val)=>{const f=form.getFieldRef(name);if(f&&typeof f.setValue==='function')f.setValue(val);};",
        "if(on){setGroup('exam_items',[]);setGroup('exam_ct_choice',[]);}",
        "['radiation_kv','radiation_ma','radiation_time_start','radiation_time_end',",
        " 'radiation_total_dap','radiation_total_ed'].forEach(name=>setShown(name,on));",
        "if(on)['ct_ctdi_vol_mgy','ct_dlp_mgy_cm'].forEach(name=>setShown(name,false));"
      ].join('\n')
    }),
    number({ key: 99001, name: 'radiation_kv', label: 'kV', span: 6, hidden: true,
      precision: 2, max: 10000, placeholder: '0' }),
    number({ key: 99002, name: 'radiation_ma', label: 'mA', span: 6, hidden: true,
      precision: 2, max: 100000, placeholder: '0' }),
    /* time range ใช้ date-input ชนิด time สองช่องซึ่งมีแม่แบบระบบรองรับอยู่แล้ว
       แทนการสร้าง time-range-input ที่ยังไม่มี system export ให้ยืนยัน options */
    dateField({ key: 99003, name: 'radiation_time_start', label: 'time (เริ่ม)', span: 6, hidden: true,
      dateType: 'time', format: 'HH:mm', valueFormat: 'HH:mm:ss', placeholder: 'เวลาเริ่ม' }),
    dateField({ key: 99004, name: 'radiation_time_end', label: 'time (สิ้นสุด)', span: 6, hidden: true,
      dateType: 'time', format: 'HH:mm', valueFormat: 'HH:mm:ss', placeholder: 'เวลาสิ้นสุด' }),
    number({ key: 99005, name: 'radiation_total_dap', label: 'Total DAP', span: 12, hidden: true,
      precision: 2, max: 100000000, suffixText: 'CcGycm²', placeholder: '0' }),
    number({ key: 99006, name: 'radiation_total_ed', label: 'Total E.D.', span: 12, hidden: true,
      precision: 2, max: 1000000, suffixText: 'mGy', placeholder: '0' })
  ]),

  /* ── 4–6. สารทึบรังสี ──────────────────────────────────────────────────── */
  card({ name: 'cmr_contrast', label: '4–6. สารทึบรังสีที่ใช้', subLabel: 'ประเภท · วิธีการใช้ · ปริมาณ', icon: 'el-magic-stick' }, [
    checkbox({
      name: 'contrast_types', label: '4. ประเภทสารทึบรังสีที่ใช้', showCol: 2,
      items: [
        { label: 'Non-Ionic contrast', value: 'non_ionic' },
        { label: 'Barium Sulphate', value: 'barium_sulphate' }
      ],
      onChange: [
        TOGGLE_HELPER,
        "const on=picked.indexOf('non_ionic')>=0;",
        "setShown('contrast_brand',on);",
        "setShown('contrast_concentration',on);",
        "setShown('contrast_lot_no',on);"
      ].join('\n')
    }),
    text({ name: 'contrast_brand', label: 'ยี่ห้อ', span: 8, hidden: true, placeholder: 'ยี่ห้อสารทึบรังสี' }),
    text({ name: 'contrast_concentration', label: 'ความเข้มข้น', span: 8, hidden: true, placeholder: 'เช่น 300 mgI/ml' }),
    text({ name: 'contrast_lot_no', label: 'Lot. number', span: 8, hidden: true, placeholder: 'Lot number' }),
    checkbox({
      name: 'route_types', label: '5. วิธีการใช้', showCol: 3,
      items: [
        { label: 'กิน', value: 'oral' },
        { label: 'สวน', value: 'enema' },
        { label: 'ฉีด', value: 'injection' }
      ]
    }),
    number({ name: 'contrast_volume_ml', label: '6. ปริมาณที่ใช้', span: 6,
      precision: 2, max: 10000, suffixText: 'ml.', placeholder: '0' })
  ]),

  /* ── 7–8. เวลา และแพทย์ผู้สั่ง ─────────────────────────────────────────── */
  card({ name: 'cmr_when_who', label: '7–8. เวลาที่ใช้ และแพทย์ผู้สั่ง', icon: 'el-clock' }, [
    dateField({ name: 'used_at', label: '7. วันที่และเวลาที่ใช้', span: 8, initCurrent: true,
      placeholder: 'เลือกวันและเวลา',
      labelTooltip: 'เปิดฟอร์มมาตั้งเป็นวันเวลาปัจจุบันให้แล้ว แก้ได้' }),
    select({
      name: 'order_doctor', label: '8. แพทย์ผู้สั่ง', span: 10,
      placeholder: 'เลือกแพทย์ผู้สั่ง',
      items: DOCTOR_ITEMS.map(d => ({ label: d.label, value: d.value })),
      labelTooltip: 'รายการตัวอย่างสำหรับทดสอบ — เปลี่ยนเป็น master แพทย์จริงตอนเชื่อมข้อมูล',
      /* เอกสาร: "เลขใบอนุญาตจะดึงจากชื่อที่เลือก" */
      onChange: [
        "const form=this.getFormRef&&this.getFormRef();",
        "if(!form||typeof form.getFieldRef!=='function')return;",
        "const MAP=" + JSON.stringify(
          DOCTOR_ITEMS.reduce((acc, d) => { acc[d.value] = d.license; return acc }, {})
        ) + ";",
        "const target=form.getFieldRef('order_doctor_license');",
        "if(target&&typeof target.setValue==='function')target.setValue(MAP[String(value)]||'');"
      ].join('\n')
    }),
    text({ name: 'order_doctor_license', label: 'เลขที่ใบอนุญาตประกอบวิชาชีพเวชกรรม', span: 6,
      readonly: true, placeholder: 'เติมอัตโนมัติจากชื่อแพทย์' })
  ]),

  /* ── 9. อาการไม่พึงประสงค์ ─────────────────────────────────────────────── */
  card({ name: 'cmr_adverse', label: '9. อาการไม่พึงประสงค์จากการใช้สารทึบรังสี', icon: 'el-warning' }, [
    /* ผู้ใช้สั่ง 2026-09-10: "ถ้ากด yes แล้วจะขึ้นทั้ง 2 หัวข้อให้ติ๊กและกรอก"
       ⇒ ทั้งบล็อก Acute และ Delay ซ่อนไว้ก่อน เปิดเมื่อเลือก Yes เท่านั้น
       เลือก No แล้วต้องปิดกลับให้หมด **รวมช่อง "อื่นๆ ระบุ"** ไม่งั้นช่องที่เคย
       เปิดค้างจากการติ๊กอื่นๆ จะลอยอยู่ทั้งที่หัวข้อถูกปิดไปแล้ว */
    radio({
      name: 'extravasation', label: 'Contrast Media Extravasation', span: 8,
      items: [{ label: 'No', value: 'no' }, { label: 'Yes', value: 'yes' }],
      onChange: [
        TOGGLE_HELPER,
        "const yes=picked.indexOf('yes')>=0;",
        "['cmr_acute_head','acute_symptoms','cmr_delay_head','delay_onset_time','delay_symptoms']",
        "  .forEach(name=>setShown(name,yes));",
        "/* ช่อง 'อื่นๆ ระบุ' มีเงื่อนไขของตัวเอง (ต้องติ๊ก อื่นๆ ก่อน) ⇒ เปิดตามไม่ได้",
        "   ปิดได้อย่างเดียวเมื่อ No เพื่อไม่ให้ค้างอยู่ใต้หัวข้อที่หายไปแล้ว */",
        "if(!yes){['acute_other_detail','delay_other_detail'].forEach(name=>setShown(name,false));}"
      ].join('\n')
    }),
    html({
      name: 'cmr_acute_head', hidden: true,
      content: '<div style="margin:6px 0 2px;font-weight:700;color:var(--el-text-color-primary,#303133)">Acute Adverse Reaction</div>'
    }),
    checkbox({
      name: 'acute_symptoms', label: 'อาการ', items: SYMPTOM_ITEMS, showCol: 2, hidden: true,
      onChange: [TOGGLE_HELPER, "setShown('acute_other_detail',picked.indexOf('other')>=0);"].join('\n')
    }),
    text({ name: 'acute_other_detail', label: 'อาการอื่นๆ (Acute) ระบุ', span: 12, hidden: true,
      placeholder: 'ระบุอาการ' }),
    html({
      name: 'cmr_delay_head', hidden: true,
      content: '<div style="margin:12px 0 2px;font-weight:700;color:var(--el-text-color-primary,#303133)">Delay Adverse Reaction</div>'
    }),
    /* เอกสารเขียน "ระยะเวลาที่มีอาการ......... (เลือกเวลา time)" ⇒ เก็บเป็นเวลา ไม่ใช่ตัวเลขชั่วโมง */
    dateField({ name: 'delay_onset_time', label: 'ระยะเวลาที่มีอาการ', span: 6, hidden: true,
      dateType: 'time', format: 'HH:mm', valueFormat: 'HH:mm:ss',
      placeholder: 'เลือกเวลา' }),
    checkbox({
      name: 'delay_symptoms', label: 'อาการ', items: SYMPTOM_ITEMS, showCol: 2, hidden: true,
      onChange: [TOGGLE_HELPER, "setShown('delay_other_detail',picked.indexOf('other')>=0);"].join('\n')
    }),
    text({ name: 'delay_other_detail', label: 'อาการอื่นๆ (Delay) ระบุ', span: 12, hidden: true,
      placeholder: 'ระบุอาการ' }),
    textarea({ name: 'adverse_note', label: 'บันทึกเพิ่มเติม', rows: 3,
      placeholder: 'รายละเอียดอาการไม่พึงประสงค์เพิ่มเติม' })
  ]),

  /* ── Contrast History (หน้าสรุป) ───────────────────────────────────────── */
  card({ name: 'cmr_history', label: 'Contrast History (หน้าสรุป)', subLabel: 'สรุปจากใบที่กำลังกรอก', icon: 'el-tickets' }, [
    html({
      name: 'cmr_summary',
      content: `<div>
  <div class="cmr-note">ประวัติการใช้สารทึบรังสี <b>ย้อนหลัง</b> ของผู้ป่วยรายนี้จะขึ้นที่นี่เมื่อเชื่อม API แล้ว ·
  ตอนนี้แสดงสรุปเฉพาะใบที่กำลังกรอกอยู่</div>
  <div class="cmr-sum" style="margin-top:10px">
    <div v-for="row in rows" :key="row.label" class="cmr-sum-row">
      <span>{{ row.label }}</span>
      <strong :class="{'cmr-sum-empty':!row.value}">{{ row.value || '-' }}</strong>
    </div>
  </div>
</div>`,
      onCreated: [
        "const field=this;const s=this.vueState;",
        "const EXAM=" + JSON.stringify(EXAM_ITEMS.reduce((a, x) => { a[x.value] = x.label; return a }, {})) + ";",
        "const CONTRAST={non_ionic:'Non-Ionic contrast',barium_sulphate:'Barium Sulphate'};",
        "const SYMPTOM=" + JSON.stringify(SYMPTOM_ITEMS.reduce((a, x) => { a[x.value] = x.label; return a }, {})) + ";",
        "const DOCTOR=" + JSON.stringify(DOCTOR_ITEMS.reduce((a, d) => { a[d.value] = d.label + ' — ' + d.license; return a }, {})) + ";",
        "s.rows=[];",
        /* 🔴 แก้ 2026-09-24 (ผู้ใช้ส่งภาพ: หน้าสรุปขึ้น "-" ทุกบรรทัดทั้งที่กรอกแล้ว)
           ของเดิมอ่านที่ `getFormRef().formData` ทางเดียว — ตัว form ref จริงไม่มี
           property ชื่อนั้น (ฟอร์มจริงในรีโปใช้ `formDataModel` · `$props.formData`
           และคู่มือ field ใช้ `getFormData(false)`) ⇒ s.data() คืน {} ตลอด
           ทุกบรรทัดจึงตกไปที่ '-' ⇒ ไล่ทุกทางที่เป็นไปได้แล้วเลือกตัวที่มีค่าจริง
           เส้นทางเดิม `f.formData` ยังอยู่ในรายการ ไม่ได้ถอดออก */
        /* 🔴 แก้รอบสอง 2026-09-24 — รอบแรกเรียก `f.getFormData(false)` **ทุกครั้ง**
           ที่ s.data() ทำงาน ซึ่ง timer ยิงทุก 1.2 วินาทีตลอดเวลาที่ฟอร์มเปิดอยู่
           นั่นคือการเรียก "ฟังก์ชันของฟอร์ม" ถี่ ๆ ระหว่างที่คนกำลังกรอก ไม่ใช่การ
           อ่าน property เฉย ๆ ⇒ เปลี่ยนเป็น: อ่าน property ก่อน · ล็อกช่องที่ใช้ได้
           ไว้ใช้ซ้ำ · เรียก getFormData เป็นทางสำรองสุดท้ายและจำกัดไม่เกิน 3 ครั้ง
           ตลอดอายุวิดเจ็ต ทุกเส้นทางเดิมยังอยู่ครบ ไม่ได้ถอดตัวไหนออก */
        "s.ref=()=>(field.getFormRef&&field.getFormRef())||null;",
        "s.usable=v=>(v&&typeof v==='object'&&typeof v.then!=='function')?v:null;",
        /* อ่าน property ล้วน ไม่มีการเรียกฟังก์ชันของฟอร์ม ⇒ ยิงถี่แค่ไหนก็ไม่กระทบ */
        "s.readers=[",
        "  ()=>{const f=s.ref();return f&&f.formDataModel;},",
        "  ()=>{const f=s.ref();return f&&f.$props&&f.$props.formData;},",
        "  ()=>{const f=s.ref();return f&&f.formData;},",
        "  ()=>field.formModel,",
        /* ตัวสุดท้ายตัวเดียวที่ "เรียกฟังก์ชัน" — ลองได้ไม่เกิน 3 ครั้งตอนยังหาไม่เจอ
           แต่ถ้ามันคือช่องเดียวที่ให้ข้อมูลได้ จะถูกล็อกไว้แล้วใช้ต่อทุกรอบ
           ไม่งั้นหน้าสรุปจะนิ่งค้างหลังรอบที่ 3 ซึ่งแย่กว่าบั๊กเดิม */
        "  ()=>{const f=s.ref();return (f&&typeof f.getFormData==='function')?f.getFormData(false):null;}",
        "];",
        "s.COSTLY=4;",
        "s.probes=0;",
        "s.read=i=>{try{return s.usable(s.readers[i]());}catch(e){return null;}};",
        "s.data=()=>{",
        "  if(s.__idx!=null){",
        "    const v=s.read(s.__idx);",
        "    if(v)return v;",
        "    s.__idx=null;",
        "  }",
        "  for(let i=0;i<s.readers.length;i++){",
        "    if(i===s.COSTLY){if(s.probes>=3)continue;s.probes++;}",
        "    const v=s.read(i);",
        "    if(v&&Object.keys(v).length){s.__idx=i;return v;}",
        "  }",
        "  return {};",
        "};",
        "s.list=(value,map)=>((Array.isArray(value)?value:[]).map(v=>map[v]||v)).join(', ');",
        "s.choice=(value,map)=>{const v=Array.isArray(value)?value[0]:value;return v?(map[v]||v):'';};",
        "s.build=()=>{",
        "  const d=s.data();",
        "  const general=Array.isArray(d.exam_items)?d.exam_items[0]:d.exam_items;",
        "  const ctPicked=Array.isArray(d.exam_ct_choice)&&d.exam_ct_choice.indexOf('ct')>=0;",
        "  const dosePicked=Array.isArray(d.exam_radiation_choice)&&d.exam_radiation_choice.indexOf('radiation_dose')>=0;",
        "  const chosen=ctPicked?'ct':(dosePicked?'radiation_dose':general);",
        "  const exams=chosen?(EXAM[chosen]||chosen):'';",
        "  const ct=chosen==='ct'?[d.ct_ctdi_vol_mgy!=null&&d.ct_ctdi_vol_mgy!==''?('CTDI vol '+d.ct_ctdi_vol_mgy+' mGy'):'',d.ct_dlp_mgy_cm!=null&&d.ct_dlp_mgy_cm!==''?('DLP '+d.ct_dlp_mgy_cm+' mGy·cm'):''].filter(Boolean).join(' · '):'';",
        "  const dose=chosen==='radiation_dose'?[d.radiation_kv!=null&&d.radiation_kv!==''?('kV '+d.radiation_kv):'',d.radiation_ma!=null&&d.radiation_ma!==''?('mA '+d.radiation_ma):'',d.radiation_time_start||d.radiation_time_end?('time '+(d.radiation_time_start||'-')+'–'+(d.radiation_time_end||'-')):'',d.radiation_total_dap!=null&&d.radiation_total_dap!==''?('Total DAP '+d.radiation_total_dap+' CcGycm²'):'',d.radiation_total_ed!=null&&d.radiation_total_ed!==''?('Total E.D. '+d.radiation_total_ed+' mGy'):''].filter(Boolean).join(' · '):'';",
        "  const extra=[ct,dose].filter(Boolean).join(' · ');",
        "  const kinds=s.list(d.contrast_types,CONTRAST);",
        "  const brand=[d.contrast_brand,d.contrast_concentration,d.contrast_lot_no?('Lot '+d.contrast_lot_no):''].filter(Boolean).join(' · ');",
        "  const acute=s.list(d.acute_symptoms,SYMPTOM);",
        "  const delay=s.list(d.delay_symptoms,SYMPTOM);",
        "  const adverse=[acute?('Acute: '+acute):'',delay?('Delay: '+delay):'',",
        "    d.extravasation?('Extravasation: '+d.extravasation.toUpperCase()):''].filter(Boolean).join(' · ');",
        "  s.rows=[",
        "    {label:'วันที่ใช้สารทึบรังสี',value:d.used_at||''},",
        "    {label:'รายการตรวจพิเศษทางรังสี',value:[exams,extra].filter(Boolean).join(' · ')},",
        "    {label:'สารทึบรังสีที่ใช้',value:[kinds,brand].filter(Boolean).join(' · ')},",
        "    {label:'ปริมาณสารทึบรังสีที่ใช้',value:(d.contrast_volume_ml==null||d.contrast_volume_ml==='')?'':(d.contrast_volume_ml+' ml.')},",
        "    {label:'อาการไม่พึงประสงค์ของการใช้ยา',value:adverse},",
        "    {label:'แพทย์ผู้สั่ง',value:DOCTOR[d.order_doctor]||''}",
        "  ];",
        "};",
        "s.build();"
      ].join('\n'),
      /* อ่านค่าจาก formData ตรง ๆ · ไม่มี watcher ให้ผูกในวิดเจ็ตชนิดนี้
         จึงรีเฟรชเป็นจังหวะ แล้วเก็บกวาดตอน unmount ไม่ให้ timer ค้าง */
      onMounted: [
        "const s=this.vueState;",
        "if(!s.__timer){s.__timer=setInterval(()=>s.build(),1200);}"
      ].join('\n')
    })
  ]),

  /* ── ตัวระบุรายการตรวจ (เพิ่ม 2026-09-23 ตามคำสั่งผู้ใช้) ───────────────────
     ปุ่ม "สารทึบ" ในหน้า X-ray CPOE Worklist ส่งค่าชุดนี้มาทาง initData
     ไม่มีช่องรับ = ค่าถูกทิ้งทันที และใบบันทึกจะผูกกลับไปที่รายการตรวจไม่ได้เลย
       · item_id     = กุญแจจริง 1 รายการตรวจ (X-ray item) ต่อ 1 ใบบันทึก
                       เป็นคีย์ที่ worklist API จะใช้ดึงกลับมาโชว์ชิปในคอลัมน์ "สารทึบ"
       · accession_no= เลขที่คนอ่านออก ตรงกับสติ๊กเกอร์ HN และเลขฝั่ง RIS
       · order_id / order_no / visit_id = ไว้ join กลับใบสั่งและ visit
       · item_code / item_name / modality = ทำให้ใบบันทึกอ่านรู้เรื่องโดยไม่ต้อง join
     🔴 hn **ไม่ได้อยู่ในการ์ดนี้** เพราะมีช่องของตัวเองอยู่แล้วที่หมวด 1–2 และปุ่มก็
        ส่งค่ามาเติมให้อยู่แล้ว — ไม่สร้างช่อง HN ซ้ำซ้อนให้ขัดกันเอง
     🔴 ต่อท้าย fields เสมอ ห้ามแทรกกลาง ไม่งั้น key/id ของหมวด 1–9 เลื่อนตาม generator
     ทุกช่อง readonly (ระบบเติมให้ ไม่ใช่ของที่คนกรอก) และการ์ดพับไว้เพื่อไม่รบกวนการกรอก
     แต่กางดูตรวจสอบได้ว่าใบนี้ผูกกับรายการไหน · เปิดฟอร์มตรง ๆ โดยไม่ผ่านปุ่ม = ว่างทั้งการ์ด
     ซึ่งแปลว่า "ใบนี้ไม่ได้ผูกกับรายการตรวจใด" ตามจริง ไม่ใช่ข้อผิดพลาด */
  card({ name: 'cmr_link', label: 'ตัวระบุรายการตรวจ (ระบบเติมให้)',
    subLabel: 'ผูกใบบันทึกนี้กับรายการตรวจในใบสั่ง X-ray', icon: 'el-link', folded: true }, [
    text({ name: 'item_id', label: 'Item ID (รายการตรวจ)', span: 8, readonly: true,
      placeholder: 'เติมจากหน้า X-ray Worklist',
      labelTooltip: 'กุญแจหลักที่ผูกใบบันทึกนี้กับรายการตรวจ — ว่าง = ยังไม่ได้ผูกกับรายการใด' }),
    text({ name: 'accession_no', label: 'Accession No.', span: 8, readonly: true,
      placeholder: 'เติมจากหน้า X-ray Worklist' }),
    text({ name: 'order_id', label: 'Order ID', span: 8, readonly: true,
      placeholder: 'เติมจากหน้า X-ray Worklist' }),
    text({ name: 'order_no', label: 'Order No.', span: 8, readonly: true,
      placeholder: 'เติมจากหน้า X-ray Worklist' }),
    text({ name: 'visit_id', label: 'Visit ID', span: 8, readonly: true,
      placeholder: 'เติมจากหน้า X-ray Worklist' }),
    text({ name: 'modality', label: 'เครื่อง', span: 8, readonly: true,
      placeholder: 'เติมจากหน้า X-ray Worklist' }),
    text({ name: 'item_code', label: 'รหัสรายการตรวจ', span: 8, readonly: true,
      placeholder: 'เติมจากหน้า X-ray Worklist' }),
    text({ name: 'item_name', label: 'ชื่อรายการตรวจ', span: 16, readonly: true,
      placeholder: 'เติมจากหน้า X-ray Worklist' })
  ])
]

/* timer ต้องถูกเคลียร์ ไม่งั้นเปิด-ปิดฟอร์มหลายรอบจะมี interval ค้างสะสม
   🔴 แก้ 2026-09-23: เดิมอ้าง fields[fields.length-1] ซึ่งผูกกับ "การ์ดสุดท้าย"
      พอเพิ่มการ์ดตัวระบุรายการต่อท้าย onUnmount จะไปลงผิดการ์ดแล้ว timer รั่วเงียบ ๆ
      ⇒ ค้นด้วยชื่อการ์ดแทน และ assert ให้ล้มตั้งแต่ตอน build ถ้าหาไม่เจอ */
const summaryCard = fields.filter(f => f.options && f.options.name === 'cmr_history')[0]
if (!summaryCard) throw new Error('หาการ์ด cmr_history ไม่เจอ — onUnmount ของ timer จะไม่ถูกตั้ง')
summaryCard.fields[0].options.onUnmount = [
  "const s=this.vueState;",
  "if(s.__timer){clearInterval(s.__timer);s.__timer=null;}"
].join('\n')

const form = {
  formConfig: {
    modelName: 'formData',
    refName: 'sdForm',
    rulesName: 'rules',
    labelWidth: 120,
    labelPosition: 'top',
    size: '',
    labelAlign: 'label-right-align',
    /* ── CSS ของฟอร์ม (เพิ่ม 2026-09-10 ตามคำสั่งผู้ใช้) ──────────────────────
       ปัญหาที่เห็นในหน้า Builder: ตัวเลือกภาษาไทยยาว ๆ ถูกบีบหลายคอลัมน์แล้ว
       ข้อความทับกันจนอ่านไม่ออก · Element Plus ตั้ง .el-checkbox เป็น inline-block
       ความสูงคงที่และ white-space:nowrap มาแต่เดิม ⇒ ต้องปลดสามอย่างนี้
       🔴 ทุก selector ขึ้นต้นด้วย .cmr- เสมอ (.cmr-form สำหรับของที่ Element Plus เรนเดอร์เอง
          · .cmr-head/.cmr-sum สำหรับ HTML ใน vue-ui) จะได้ไม่รั่วไปโดนฟอร์มอื่นในแอปเดียวกัน */
    cssCode: [
      /* สไตล์หัวฟอร์มและตารางสรุป — เดิมอยู่ใน <style> ของ vue-ui ตัวหัว ซึ่งมีผล
         เฉพาะ widget ตัวเอง ตารางสรุปคนละ widget จึงไม่ได้สไตล์ (ผู้ใช้เห็น label
         กับค่าเบียดติดกันเป็นบรรทัดเดียว 2026-09-10) ⇒ ย้ายมารวมที่นี่ทั้งหมด */
      ".cmr-head{padding:14px 16px;border:1px solid var(--el-border-color-light,#e4e7ed);border-radius:8px;background:var(--el-fill-color-light,#f5f7fa)}",
      ".cmr-head h2{margin:0;font-size:17px;font-weight:700;color:var(--el-text-color-primary,#303133)}",
      ".cmr-head p{margin:4px 0 0;font-size:12px;color:var(--el-text-color-secondary,#909399)}",
      ".cmr-note{margin-top:8px;padding:7px 10px;border-left:3px solid var(--el-color-warning,#e6a23c);background:var(--el-color-warning-light-9,#fdf6ec);color:#b88230;font-size:11px;line-height:1.6}",
      ".cmr-sum{display:grid;gap:8px}",
      ".cmr-sum-row{display:grid;grid-template-columns:minmax(150px,.32fr) 1fr;gap:10px;padding:7px 0;border-bottom:1px dashed var(--el-border-color-lighter,#ebeef5)}",
      ".cmr-sum-row:last-child{border-bottom:0}",
      ".cmr-sum-row span{color:var(--el-text-color-secondary,#909399);font-size:12px}",
      ".cmr-sum-row strong{color:var(--el-text-color-primary,#303133);font-weight:650;overflow-wrap:anywhere}",
      ".cmr-sum-empty{color:var(--el-text-color-placeholder,#a8abb2);font-weight:400}",

      /* 🔴 2026-09-10 (รอบสี่): คลาสย้ายจากตัว widget มาไว้ที่ฟอร์ม (formConfig.customClass)
         ใส่ค่าลง options.customClass ของ checkbox ไม่ได้ — แม่แบบของระบบเว้นว่างไว้ทุกตัว
         และเราเคยโดนมาแล้วทั้งกับ card และ file-upload-input ⇒ selector จึงเกาะ .cmr-form */
      '.cmr-form .el-checkbox-group{display:flex;flex-direction:column;gap:6px;width:100%}',
      '.cmr-form .el-checkbox{display:flex;width:100%;height:auto;min-height:32px;margin:0;padding:6px 10px;align-items:flex-start;white-space:normal}',
      '.cmr-form .el-checkbox__input{flex:none;margin-top:3px}',
      '.cmr-form .el-checkbox__label{display:block;padding-left:8px;white-space:normal;line-height:1.5;overflow-wrap:anywhere}',
      /* จอแคบ: ตัวเลือกยังเต็มความกว้างอยู่แล้ว (columnSpan 24) แค่ลดระยะให้กระชับ */
      '@media (max-width:860px){',
      '  .cmr-form .el-checkbox{padding:6px 8px}',
      '}',
      '@media (max-width:600px){',
      '  .cmr-sum-row{grid-template-columns:1fr;gap:2px}',
      '}'
    ].join('\n'),
    /* คลาสระดับฟอร์ม — เป็นที่เกาะเดียวที่เหลือให้ CSS หลังถอดคลาสออกจากตัว widget
       แบบอย่าง: person_form.json ของระบบใช้ `["mb15"]` (เป็น **อาร์เรย์** เสมอ) */
    customClass: ['cmr-form'],
    functions: '',
    layoutType: 'PC',
    jsonVersion: 3,
    onFormCreated: '',
    onFormMounted: '',
    onParentChange: '',
    onFormDataChange: '',
    onFormUnmounted: ''
  },
  fields
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(form, null, 2) + '\n')
console.log('wrote ' + path.relative(root, outPath))
