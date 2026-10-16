/*
 * initCraft API Factory Process
 * Name: X-ray CPOE Worklist
 * Deployed Process ID: 6a957009422c1ca959829e45
 * ผู้ใช้แจ้ง ID เมื่อ 2026-08-31; ยังไม่ได้ยืนยัน deployed runtime กับข้อมูลจริง
 *
 * Purpose:
 * - อ่านงานรังสีจาก zdata_cpoe_order_item ที่ service_type = 'xray' ตรง ๆ ไม่สร้าง mirror form
 * - resolve เครื่อง (modality) จาก master.xray_item แล้ว group กลับเป็นหนึ่ง Order
 * - คืน counts ของ chip ทั้งห้า (รวมทั้งหมด) และ modalities[] ให้ UI ไม่ต้อง hard-code รายชื่อเครื่อง
 *
 * Input:
 * {
 *   action?: 'list' | 'queue_tracking' | 'resolve_open_visit' | 'get_report' | 'save_manual_report' | 'set_staff' | 'cancel_order',
 *   // get_report อ่านจาก zdata_xray_result ด้วย AccessionNo (RIS เขียนเข้ามา)
 *   organization_code?: string,       // App Organization; ต้องตรงกับ unit ของผู้ใช้
 *   modality?: string | string[],     // code ของเครื่อง (array/CSV/ค่าเดี่ยว) — ตัวกรองการแสดงผลเท่านั้น
 *   statuses?: string[] | csv,        // default: ทุกสถานะที่รองรับ
 *   date_from?: 'YYYY-MM-DD',
 *   date_to?: 'YYYY-MM-DD',
 *   hn?: string,                      // exact HN
 *   citizen_id?: string,              // exact 13-digit citizen ID from scanner; all dates like HN scan
 *   q?: string,                       // free text: HN / VN / inpatient AN / citizen ID / Order No. / Accession No. / ชื่อผู้ป่วย
 *   page?: number,                    // default 1
 *   limit?: number,                   // default 30, max 100
 *   item_id?: string                  // get_report เท่านั้น
 *   // get_report คืน data.versions[] = ผลอ่านทุกฉบับจาก zdata_zdata_xray_result_log (ใหม่→เก่า)
 *   // save_manual_report รับ manual_request_id, result_text, radiologist_uid,
 *   // result_datetime, result_status และ severity_uid แล้วเขียน result/current + immutable log
 * }
 *
 * Output (list):
 * { success, data: { orders[], total, page, limit, modalities[], counts{}, statuses,
 *                    date_scope{}, organization_code }, message }
 *
 * Unit Queue / My Room / Completed ไม่ผ่าน Process นี้: ฟอร์ม X-ray clone List View
 * ของ EMR และอ่าน zdata_visit_tran โดยตรง จึงไม่มี queue adapter หรือ lifecycle ซ้ำ.
 * - ไม่แตะ Agent submit ของ LAB ซึ่งบังคับ labno/specimen_code (decision X3)
 *
 * การตัดสินใจของผู้ใช้ 2026-08-31 (แทนสมมติฐานเดิมที่ผูกกับ Section รังสี):
 * - ขอบเขตคุมด้วย **Organization/Room ของหน่วยรังสี**: รหัสตั้งต้นใน
 *   XRAY_ORGANIZATION_CODES, ทุกหน่วยลูกใต้ XRAY_ORGANIZATION_ROOT_CODES และทุก Room
 *   ที่ผูกกับหน่วยเหล่านั้น; ไม่ได้แบ่งย่อยด้วย zdata_section เหมือน LAB
 * - ค่า modality อ่านจาก **master.xray_item.modality** เป็นทางหลัก
 *   (ref field `xray_item` ยืนยันแล้วใน CPOE Order Item.json) และมีทางสำรองไล่หาเผื่อ schema ต่าง
 */

const ITEM_COLLECTION = 'zdata_cpoe_order_item'
const ORDER_COLLECTION = 'zdata_cpoe_order'
const ITEM_MASTER_COLLECTION = 'zdata_master_item_order'
/* X-ray Member Master · Form ID 6abcb7c0c54b3f93ce7a0489
   ใช้ตรวจ member_id/ตำแหน่งซ้ำฝั่ง server ก่อนบันทึก selector ใน Worklist */
const XRAY_MEMBER_COLLECTION = 'zdata_xray_member_master'
const SECTION_COLLECTION = 'zdata_section'
/* Organization master — collection zdata_organization (Form ID 6a3790c04cfbfdbe257f86fb)
   ข้อมูลจริง 2026-10-05: unit_parent เป็น SelectByForm {value:<Organization _id>,label:<unit_code>}
   ส่วน Room อยู่ zdata_room และผูก Organization ด้วย unit_id.value */
/* Diagnosis — ลอกเส้นทางจาก lab_cpoe_worklist_api.js ที่ใช้งานได้จริงแล้ว
   ผูกกับ visit ด้วย `vid.value` (vid เป็น object ไม่ใช่ค่าเดี่ยว) และ join ใน pipeline
   เก็บ primary_dx ดิบ ๆ ({value:<ICD>, label:<ชื่อโรค>}) ให้ฟอร์มอ่านเหมือน LAB */
const DIAGNOSIS_COLLECTION = 'zdata_diagnosis'
/* ผลอ่านที่ RIS ยิงกลับมา — Process xray-api-ris-result (6a861de5f851000f28e44ab3)
   ผูกกับใบสั่งด้วย AccessionNo อย่างเดียว ซึ่งเป็นเลขที่เราออกเอง จึง join ได้ตรง ๆ
   **endpoint นั้น insert ทุกครั้ง ไม่ upsert** ⇒ หนึ่ง accession มีได้หลายแถว
   (ยิงซ้ำ / ผลอ่านฉบับแก้ / ส่งตรวจซ้ำ) เราจึงต้องเลือกฉบับล่าสุดเองอย่างจงใจ */
const RESULT_COLLECTION = 'zdata_xray_result'
/* ── ประวัติผลอ่านทุกฉบับ (ยืนยันโครงสร้าง 2026-09-16) ──────────────────────
   ทีมแยกตารางผลอ่านเป็นสองชั้นตั้งแต่ 2026-09-09 22:45–23:11 (เราเพิ่งรู้):
     · zdata_xray_result            = **ฉบับปัจจุบัน** 1 แถวต่อ Accession (ถูก upsert ทับ)
       Form 6aa180f009c1bad08952da58 · ไม่มีฟิลด์ ResultId
     · zdata_zdata_xray_result_log  = **ทุกฉบับที่ RIS เคยส่งเข้ามา**
       Form 6a860980f851000f28e44ab0 (ฟอร์มเดิมที่ถูกเปลี่ยนชื่อ) · มี ResultId
   ⇒ ประวัติการแก้ต้องอ่านจาก log ไม่ใช่ตารางผลอ่าน ไม่งั้นได้ 1 ฉบับตลอดไป
   (ยืนยันกับข้อมูลจริง: SM20260910DX001 ยิงเข้ามา 6 ครั้ง → log 6 แถว · result 1 แถว)
   🔴 ตารางผลอ่านเดิมไม่ถูกแตะเลย — action list และฟิลด์ "ฉบับปัจจุบัน" ทั้งหมด
      ยังอ่านจาก zdata_xray_result เหมือนเดิมทุกประการ */
const RESULT_LOG_COLLECTION = 'zdata_zdata_xray_result_log'
const RESULT_FORM_ID = '6aa180f009c1bad08952da58'
const RESULT_LOG_FORM_ID = '6a860980f851000f28e44ab0'
const RESULT_COUNTER_COLLECTION = 'xray_api_counters'
const RESULT_COUNTER_ID = 'zdata_xray_result.ResultId'

/* สถานะที่ RIS แจ้งกลับ — Process xray_order_status_change (6a861d99f851000f28e44ab2)
   เพิ่ม 2026-09-09 ตามที่ผู้ใช้เลือกตัวเลือก A · ขา **เข้า** ล้วน: RIS เรียกเข้ามาหาเรา
   แล้ว update แถวใน zdata_xray_order เอง — ฝั่งเราห้ามยิงออกไป (log 2026-09-02)
   `Status` รับแค่ `A` = Arrival · `C` = Completed ส่วน `N` = Request มาจากตอนสร้างใบ
   endpoint นั้น update-only แต่ข้อมูลจริงมี 14 แถว / 12 accession ⇒ **มีซ้ำ**
   จึงต้องเลือกแถวล่าสุดเองด้วย updated_at เหมือนที่ทำกับผลอ่าน
   🔴 อ่านอย่างเดียวเพื่อ "แสดง" เท่านั้น — ไม่แตะ current_status, effective_status,
      bucket, chip หรือเงื่อนไขกรองใด ๆ ของเดิม */
const XRAY_RIS_ORDER_COLLECTION = 'zdata_xray_order'

const ORGANIZATION_COLLECTION = 'zdata_organization'
const ROOM_COLLECTION = 'zdata_room'
/* แหล่งข้อมูลของแถบเตือนแพ้ยา (ผู้ใช้ขอ 2026-09-03) — ยืนยันจากวิกิ his-data-model:
   · zdata_person.allergy_main[] คือ "ประวัติการแพ้ยา" ตัวจริงของคนไข้
   · zdata_patient_assessment เก็บ drug_allergy / food_allergy ราย visit
   ทั้งสองอันเป็น join เพิ่ม อ่านอย่างเดียว ไม่กระทบ pipeline เดิมของ worklist */
const PERSON_COLLECTION = 'zdata_person'
const VISIT_COLLECTION = 'zdata_visit'
const ASSESSMENT_COLLECTION = 'zdata_patient_assessment'
/* บันทึกการยกเลิกของ Order — item_ids ระบุชุดที่กำลังยกเลิก และ history
   เก็บชุดก่อนหน้าเมื่อยกเลิกบางรายการใน Order เดิมซ้ำ */
const ORDER_CANCELLATION_COLLECTION = 'zdata_xray_order_cancellation'
/* Process เดียวกับปุ่มส่งเข้าเครื่อง: HIS → xray_api_order → Envision GetOrder.
   ผู้ใช้ยืนยัน 2026-09-18 ว่ายกเลิกด้วย Order JSON เดิมและ IsDeleted:true */
const RIS_ORDER_PROCESS_ID = '6a8f1ef87632d182ef6914fe'
/* เลือกเฉพาะ field ของ outbound ปกติ ห้าม forward _id/audit/xrstatx จากตารางกลาง */
const RIS_DISPATCH_FIELDS = [
  'Hn', 'PatientTitle', 'PatientFName', 'PatientLName', 'PatientGender', 'PatientDob',
  'PatientClassUid', 'VisitNo', 'AccessionNo', 'ExamUid', 'ExamName', 'Priority',
  'Status', 'IsDeleted', 'AdmissionNo', 'PatientSsn', 'RequestNo',
  'ClinicalInstruction', 'ReferringDoctorTitle', 'ReferringDoctorFName',
  'ReferringDoctorLName', 'ReferenceUnitUid', 'ReferenceUnitName',
  'InsuranceTypeDesc', 'MessageControlId', 'ModalityTypeUid',
  'ModalityTypeName', 'OrganizationUid', 'Qty'
]
const RIS_ORDER_REQUIRED = [
  'Hn', 'PatientFName', 'PatientGender', 'PatientDob', 'PatientClassUid',
  'VisitNo', 'AccessionNo', 'ExamUid', 'ExamName'
]
/* Visit Tran is used only to resolve today's open Visit before creating an Order.
   Queue panes themselves are native EMR List Views and do not call this Process. */
const VISIT_TRAN_COLLECTION = 'zdata_visit_tran'
const XRAY_SERVICE_TYPE = 'xray'

/* กลุ่ม "รับเข้าห้องรังสีแล้ว" — เท่ากับ bucket pending ของ STATUS_VOCABULARY
   dispatch/accession ประกาศชุดเดียวกันและมีเทสเทียบทั้งสามไฟล์ ห้ามหลุดจากกัน */
const RECEIVED_STATUSES = ['accepted', 'prepared', 'dispensed', 'dispatched', 'in_progress']
/* Finance-cleared `ready` ยังไม่ถือว่ารับเข้า แต่ยกเลิกได้เหมือน `sent` และรายการที่รับแล้ว */
const CANCELLABLE_ACTIVE_STATUSES = ['sent', 'ready'].concat(RECEIVED_STATUSES)

/* คำที่ใช้ "เดาให้ดู" ว่าหน่วยงานไหนน่าจะเป็นรังสี — ใช้เป็นคำแนะนำในข้อความเท่านั้น
   ไม่ใช่เกณฑ์ให้สิทธิ์ สิทธิ์มาจากรหัสตั้งต้นและสาย parent ของ Organization master */
const RADIOLOGY_NAME_HINTS = ['รังสี', 'เอกซเรย์', 'เอ็กซเรย์', 'x-ray', 'xray', 'radio']

/*
 * 🔴 หน่วยงานรังสี — Organization ที่มีสิทธิ์เห็นงานรังสี · ต้องตรงกันทั้งสาม Process
 * ผู้ใช้ยืนยันผัง 2026-09-01:
 *     m0900  กลุ่มงานรังสีวิทยา (xray)   = กลุ่มแม่
 *       ├─ m0901  งานรังสีวิทยา (clinic)  = X-ray ธรรมดา
 *       └─ CT     CT scan / CT-MRI SCAN   = CT/MRI (มีห้องตรวจ CT และ MRI ข้างใน)
 * นี่เป็น "ประตู" เท่านั้น **ไม่ได้กรองข้อมูล** — query กรองด้วย service_type=xray
 * กับสถานะเท่านั้น ทุก org ที่ผ่านเข้ามาจึงเห็นรายการรังสีทั้งหมดเหมือนกัน
 * (ผู้ใช้ยืนยัน 2026-09-01 ว่ายังไม่ต้องแยกให้แต่ละ org เห็นเฉพาะงานตัวเอง)
 * เทียบแบบไม่สนตัวพิมพ์ · ปล่อยว่าง = ปฏิเสธทุก Organization (fail-closed)
 */
const XRAY_ORGANIZATION_CODES = ['m0900', 'm0901', 'CT']
/* ทุกห้องที่จัดอยู่ใต้กลุ่มรังสีต้องใช้คิวกลางชุดเดียวกัน รวมถึงหน่วย/ห้องที่เพิ่มภายหลัง
   (เช่น Organization RA-301 และ Room US1/US2/RF/Serv) จึง resolve ทั้งสาย
   unit_parent.value และ zdata_room.unit_id.value ห้ามอนุญาตด้วยการเดาจากชื่อ */
const XRAY_ORGANIZATION_ROOT_CODES = ['m0900']

/*
 * รายการเครื่องของ dropdown — enum เดียวกับช่อง Modality ของ master Radio Exam
 * และ modality_type ของ zdata_section (ยืนยันจาก section.json ในรีโป + หน้าจอ Builder 2026-08-31)
 * code ที่พบในข้อมูลจริงแต่ไม่มีในรายการนี้ จะถูกต่อท้ายให้อัตโนมัติโดยใช้ code เป็น label
 */
const MODALITY_MASTER = [
  { code: 'DX', label: 'DX-Digital Radiography' },
  { code: 'MG', label: 'MG-Mammography' },
  { code: 'US', label: 'US-Ultrasound' },
  { code: 'CT', label: 'CT-Computed Tomography' },
  { code: 'RF', label: 'RF-Radiofluoroscopy' },
  { code: 'CR', label: 'CR-Computed Radiography' },
  { code: 'VCUG', label: 'VCUG-Voiding Cystourethrogram' },
  { code: 'MR', label: 'Magnetic Resonance' },
  { code: 'IO', label: 'Intra-oral Radiography' },
  { code: 'UN', label: 'Unspecified' },
  { code: 'OT', label: 'Other' }
]
const MODALITY_LABEL = Object.fromEntries(MODALITY_MASTER.map(row => [row.code, row.label]))

/* Queue v2: ห้องหนึ่งดึงเฉพาะงานที่เครื่องในห้องทำได้ ไม่ใช่เห็นคิวกลางแล้ว
   ดึงงานคนละ modality ไปชนกันทุกห้อง · Serv เป็นห้องงานอื่นแบบ assign-only:
   เห็นได้เมื่อมีคนระบุปลายทางตรง ๆ เท่านั้น ไม่ดึงคิวกลางเอง */
const XRAY_ROOM_CAPABILITIES = {
  X11: ['DX', 'CR'],
  X2: ['DX', 'CR'],
  X3: ['DX', 'CR'],
  US1: ['US'],
  US2: ['US'],
  RF: ['RF', 'VCUG'],
  CT: ['CT'],
  MRI: ['MR', 'MRI'],
  SERV: []
}
const XRAY_ASSIGN_ONLY_ROOMS = ['SERV']

const valueText = value => {
  if (value == null) return ''
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return String(value.toHexString())
    if (value.$oid != null) return String(value.$oid)
    if (value.value != null && typeof value.value !== 'object') return String(value.value)
    if (value.code != null) return String(value.code)
  }
  return String(value)
}

const listText = value => {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : []
  const seen = {}
  return values
    .map(item => valueText(item).trim())
    .filter(item => {
      if (!item || seen[item]) return false
      seen[item] = true
      return true
    })
}

/* ── แถบเตือนแพ้ยา / COVID (ผู้ใช้ขอ 2026-09-03) ─────────────────────────────
   valueText() หยิบ .value/.code มาก่อน ซึ่งเหมาะกับการ join แต่ไม่เหมาะกับการอ่านออกเสียง
   ชื่อยาที่แพ้ต้องเป็น label ที่คนอ่านรู้เรื่อง ไม่ใช่ id ของ master */
const labelText = value => {
  if (value == null) return ''
  if (typeof value === 'object') {
    if (value.label != null && typeof value.label !== 'object') return String(value.label).trim()
    if (value.name != null && typeof value.name !== 'object') return String(value.name).trim()
    if (value.allergy_item != null) return labelText(value.allergy_item)
    return valueText(value).trim()
  }
  return String(value).trim()
}

/* CPOE item_code เป็นรหัสภายใน ส่วนรหัสที่ RIS รู้จักอยู่ใน SelectByForm
   snapshot master.xray_item. คืน object ว่างเมื่อ master อ่านไม่ได้ เพื่อให้ caller
   เลือก fallback ที่ปลอดภัยสำหรับ Order เก่าซึ่งเคยส่งด้วย item_code มาก่อน. */
const readItemXrayMapping = async item => {
  const masterRef = item && item.item_data_id && item.item_data_id.value != null
    ? item.item_data_id.value
    : item && item.item_data_id
  if (!masterRef) return {}
  try {
    const found = await app.dbFindById(masterRef, ITEM_MASTER_COLLECTION)
    const master = found && found.reply && found.reply.data
    return (master && master.xray_item) || {}
  } catch (error) {
    return {}
  }
}

/* ช่องแพ้ยาในแบบประเมินมักถูกกรอกว่า "ปฏิเสธการแพ้ยา" / "ไม่มี" / "NKDA" ซึ่งแปลว่า
   **ไม่แพ้** ถ้ายกขึ้นกล่องแดงตรง ๆ จะกลายเป็นเตือนกลับด้าน อันตรายกว่าไม่เตือน
   จึงคัดข้อความปฏิเสธออกก่อนเสมอ (เทียบเฉพาะต้นข้อความ ไม่ตัดคำที่มีคำเหล่านี้อยู่กลางประโยค) */
const NEGATIVE_ALLERGY = /^(-+|ไม่มี|ไม่ทราบ|ปฏิเสธ|no |none|nil|nka|nkda|unknown|n\/a)/i

const allergyTexts = order => {
  const out = []
  const push = value => {
    const text = labelText(value)
    if (!text || NEGATIVE_ALLERGY.test(text)) return
    if (out.indexOf(text) < 0) out.push(text)
  }
  const list = Array.isArray(order && order._allergy_main) ? order._allergy_main : []
  list.forEach(row => push(row))
  push(order && order._drug_allergy)
  push(order && order._food_allergy)
  return out
}

/* COVID มาจาก Diagnosis ของ visit (ผู้ใช้เลือกแหล่งนี้ 2026-09-03) — ไม่มีฟิลด์ COVID เฉพาะใน HIS
   U07.1/U07.2 คือรหัสมาตรฐานของ COVID-19 · เผื่อชื่อโรคเป็นข้อความไว้ด้วยเพราะบางใบลงเป็นคำ */
const COVID_CODE = /^u07/i
const COVID_TEXT = /covid|โควิด|sars-cov/i
const covidFlag = order => {
  const dx = order && order.diagnosis
  if (!dx) return false
  const code = valueText(dx).trim()
  const label = labelText(dx)
  return COVID_CODE.test(code) || COVID_TEXT.test(code) || COVID_TEXT.test(label)
}

const clampInt = (value, fallback, min, max) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.floor(number)))
}

const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value)
const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

if (!app.isAuth(userInfo.roles || [])) {
  return { success: false, message: 'ไม่มีสิทธิ์อ่านรายการสั่งตรวจทางรังสี' }
}

const userUnitCode = valueText(userInfo.unit && userInfo.unit.code).trim().toUpperCase()
const requestedOrganizationCode = valueText(params.organization_code || params.unit_code)
  .trim()
  .toUpperCase()

if (requestedOrganizationCode && userUnitCode && requestedOrganizationCode !== userUnitCode) {
  return { success: false, message: 'Organization ที่ร้องขอไม่ตรงกับ Organization ปัจจุบันของผู้ใช้' }
}

const organizationCode = requestedOrganizationCode || userUnitCode
if (!organizationCode) {
  return { success: false, message: 'บัญชีผู้ใช้ไม่มี Organization unit สำหรับกำหนดหน่วยรังสี' }
}

const configuredOrganizations = XRAY_ORGANIZATION_CODES
  .map(code => String(code).trim().toUpperCase())
  .filter(Boolean)
const configuredOrganizationRoots = XRAY_ORGANIZATION_ROOT_CODES
  .map(code => String(code).trim().toUpperCase())
  .filter(Boolean)

const page = clampInt(params.page, 1, 1, 1000000)
const limit = clampInt(params.limit, 30, 1, 100)
const action = valueText(params.action).trim().toLowerCase() || 'list'

const modalityList = counts => MODALITY_MASTER.map(row => ({
  code: row.code,
  label: row.label,
  count: (counts && counts[row.code]) || 0
}))

const emptyResult = message => ({
  success: true,
  data: {
    orders: [],
    total: 0,
    page,
    limit,
    modalities: modalityList(null),
    counts: { all: 0, waiting: 0, pending: 0, active: 0, complete: 0, cancelled: 0 },
    statuses: [],
    date_scope: { from: '', to: '', defaulted: false, include_backlog: false, axis: 'status_time' },
    modality_unmapped: 0,
    organization_code: organizationCode,
    unit_code: organizationCode
  },
  message
})

/* ── ขอบเขตหน่วยงาน — fail-closed ────────────────────────────────────────
   ไม่มี code ของหน่วยรังสี = ไม่คืนข้อมูลใด ๆ
   แต่ไปอ่าน Organization master มาบอกว่าหน่วยงานปัจจุบันคืออะไร และหน่วยงานไหน
   "น่าจะ" เป็นรังสี เพื่อให้ผู้ดูแลเติม XRAY_ORGANIZATION_CODES ได้โดยไม่ต้องไปหาเอง
   ข้อมูลที่คืนเป็นรหัส/ชื่อหน่วยงานเท่านั้น ไม่ใช่ข้อมูลผู้ป่วย                      */
const readOrganizations = async () => {
  try {
    const found = await app.dbFindAll(
      {
        from: ORGANIZATION_COLLECTION,
        nosql: {
          type: 'query',
          collection: ORGANIZATION_COLLECTION,
          query: { xrstatx: { $nin: [0, 3] }, enable: { $ne: false } },
          projection: { _id: 1, unit_code: 1, unit_name: 1, unit_parent: 1, enable: 1 },
          sort: { unit_code: 1 }
        }
      },
      false,
      false
    )
    if (!found || found.success === false) return []
    return found.reply && Array.isArray(found.reply.data) ? found.reply.data : []
  } catch (error) {
    return []
  }
}

const describeOrganization = row => ({
  code: valueText(row && row.unit_code).trim(),
  name: valueText(row && row.unit_name).trim(),
  parent_code: valueText(
    row && row.unit_parent && (
      row.unit_parent.unit_code || row.unit_parent.code || row.unit_parent.label || row.unit_parent
    )
  ).trim(),
  parent_name: valueText(row && row.unit_parent && row.unit_parent.unit_name).trim()
})

const readRooms = async organizationIds => {
  if (!Array.isArray(organizationIds) || !organizationIds.length) return []
  try {
    const found = await app.dbFindAll(
      {
        from: ROOM_COLLECTION,
        nosql: {
          type: 'query',
          collection: ROOM_COLLECTION,
          query: {
            xrstatx: { $nin: [0, 3] },
            enable: { $ne: false },
            'unit_id.value': { $in: organizationIds }
          },
          projection: { _id: 1, code: 1, name: 1, unit_id: 1, enable: 1, qtype: 1, assign_only: 1 },
          sort: { code: 1 }
        }
      },
      false,
      false
    )
    if (!found || found.success === false) return []
    return found.reply && Array.isArray(found.reply.data) ? found.reply.data : []
  } catch (error) {
    return []
  }
}

/* อ่าน master ทุกครั้งก่อนแตะข้อมูลผู้ป่วย แล้วขยายสิทธิ์เฉพาะลูกหลานของ root ที่กำหนดไว้
   โดย resolve parent ด้วย ObjectId จริงก่อนใช้ label/code สำรอง จากนั้นเติม Room ที่ unit_id.value
   ชี้เข้า Organization ที่ผ่านสิทธิ์ ถ้า master ใช้งานไม่ได้ให้กลับไปใช้ชุด explicit เดิม
   เพื่อไม่เปิดสิทธิ์กว้างและไม่ทำให้ห้องเดิมหยุดงาน ห้องทั้งหมดใช้ queue document เดียวกันตาม visit_id */
const organizationRows = (await readOrganizations()).filter(row => row && row.enable !== false)
const organizationDirectory = organizationRows.map(describeOrganization).filter(row => row.code)
const organizationCodeById = new Map()
const organizationNameById = new Map()
organizationRows.forEach(row => {
  const id = valueText(row && row._id).trim().toUpperCase()
  const code = valueText(row && row.unit_code).trim().toUpperCase()
  if (id && code) {
    organizationCodeById.set(id, code)
    organizationNameById.set(id, valueText(row && row.unit_name).trim())
  }
})
organizationDirectory.forEach(row => {
  const source = organizationRows.filter(candidate =>
    valueText(candidate && candidate.unit_code).trim().toUpperCase() === row.code.toUpperCase())[0]
  const parentId = valueText(source && source.unit_parent && source.unit_parent.value).trim().toUpperCase()
  if (!parentId) return
  if (organizationCodeById.has(parentId)) row.parent_code = organizationCodeById.get(parentId)
  if (organizationNameById.has(parentId)) row.parent_name = organizationNameById.get(parentId)
})
const allowedOrganizationSet = new Set(configuredOrganizations.concat(configuredOrganizationRoots))
for (let pass = 0; pass < organizationRows.length; pass += 1) {
  let changed = false
  organizationRows.forEach(source => {
    const row = describeOrganization(source)
    const code = row.code.toUpperCase()
    const parentId = valueText(source && source.unit_parent && source.unit_parent.value).trim().toUpperCase()
    const parentCode = (organizationCodeById.get(parentId) || row.parent_code).toUpperCase()
    if (code && parentCode && allowedOrganizationSet.has(parentCode) && !allowedOrganizationSet.has(code)) {
      allowedOrganizationSet.add(code)
      changed = true
    }
  })
  if (!changed) break
}
const allowedOrganizationIds = organizationRows
  .filter(row => allowedOrganizationSet.has(valueText(row && row.unit_code).trim().toUpperCase()))
  .map(row => row && row._id)
  .filter(Boolean)
const roomRows = await readRooms(allowedOrganizationIds)
const roomDirectory = roomRows.filter(row => row && row.enable !== false).map(row => {
  const parentId = valueText(row && row.unit_id && row.unit_id.value).trim().toUpperCase()
  const code = valueText(row && row.code).trim()
  const normalizedCode = code.toUpperCase()
  return {
    code: code,
    name: valueText(row && row.name).trim(),
    parent_code: organizationCodeById.get(parentId) || '',
    parent_name: valueText(row && row.unit_id && row.unit_id.label).trim(),
    qtype: valueText(row && row.qtype).trim(),
    capabilities: (XRAY_ROOM_CAPABILITIES[normalizedCode] || []).slice(),
    assign_only: XRAY_ASSIGN_ONLY_ROOMS.indexOf(normalizedCode) >= 0 || row.assign_only === true
  }
}).filter(row => row.code && row.parent_code && allowedOrganizationSet.has(row.parent_code))
const allowedUnitSet = new Set(allowedOrganizationSet)
roomDirectory.forEach(row => allowedUnitSet.add(row.code.toUpperCase()))
const allowedOrganizations = Array.from(allowedUnitSet)
const organizationAllowed = allowedUnitSet.has(organizationCode)

if (!organizationAllowed) {
  const directory = organizationDirectory
  const current = directory.concat(roomDirectory)
    .filter(row => row.code.toUpperCase() === organizationCode)[0] || null
  const looksRadiology = row => {
    const haystack = (row.name + ' ' + row.parent_name).toLowerCase()
    return RADIOLOGY_NAME_HINTS.some(hint => haystack.indexOf(hint.toLowerCase()) >= 0)
  }
  const candidates = directory.filter(looksRadiology)

  const currentText = 'Organization ปัจจุบันคือ "' + organizationCode + '"' +
    (current && current.name ? ' (' + current.name + ')' : '')
  const candidateText = candidates.length
    ? ' · หน่วยงานที่น่าจะเป็นรังสี: ' +
      candidates.map(row => row.code + (row.name ? ' (' + row.name + ')' : '')).join(', ')
    : (directory.length ? ' · ไม่พบหน่วยงานที่ชื่อสื่อถึงรังสีใน Organization master' : '')

  /* แก้ 2026-09-10 ตามคำสั่งผู้ใช้: เดิมพ่วงรหัสหน่วยงานปัจจุบันกับรายชื่อหน่วยที่น่าจะเป็นรังสี
     และชื่อตัวแปรในโค้ดต่อท้ายมาด้วย ซึ่งเจ้าหน้าที่หน้างานอ่านแล้วไม่รู้ว่าต้องทำอะไร
     เหลือประโยคเดียวที่บอก "ต้องทำอะไรต่อ" พอ
     🔴 ข้อมูลวินิจฉัยไม่ได้หายไป — ยังส่งกลับครบใน data.organization_current /
        data.organization_candidates ให้ผู้ดูแลเปิดดูได้ (มีเทสคุมทั้งสองช่อง)
     ส่วนกรณี Process ยังไม่ได้ตั้ง XRAY_ORGANIZATION_CODES เลย เก็บข้อความเดิมไว้
     เพราะเป็นความผิดพลาดตอนตั้งค่า คนที่ต้องอ่านคือผู้ดูแลระบบ ไม่ใช่เจ้าหน้าที่ */
  const reason = configuredOrganizations.length || configuredOrganizationRoots.length
    ? 'ห้องนี้ไม่ใช่หน่วยงานรังสี กรุณาเปลี่ยนห้องที่มุมขวาบน'
    : 'ยังไม่ได้กำหนดหน่วยงานรังสีใน Process — ใส่รหัสที่ XRAY_ORGANIZATION_CODES · ' +
      currentText + candidateText

  if (action !== 'list') return { success: false, message: reason }
  const blocked = emptyResult(reason)
  blocked.data.organization_current = current
  blocked.data.organization_candidates = candidates
  return blocked
}

/* ── เปิด CPOE จาก HN/เลขบัตรที่ค้นหรือสแกน — อ่าน Visit วันนี้เท่านั้น ───
   ใช้นิยาม Visit เปิดเดียวกับ LAB: คิว Visit Tran สถานะเปิดก่อน แล้ว fallback
   Visit วันนี้เมื่อไม่มีคิวของ HN นี้ ไม่ใช้ใบสั่ง X-ray เป็นตัวตัดสิน เพราะผู้ป่วย
   ที่ยังไม่มีใบสั่งต้องสร้างรายการแรกได้ และห้ามส่งเลขบัตรกลับหน้าจอ */
if (action === 'resolve_open_visit') {
  const requestedHn = valueText(params.hn).trim().replace(/^HN\s*/i, '')
  const citizenId = valueText(params.citizen_id).trim()
  if ((requestedHn && citizenId) || (!requestedHn && !citizenId) ||
      (requestedHn && !/^[0-9]{6,12}$/.test(requestedHn)) ||
      (citizenId && !/^[0-9]{13}$/.test(citizenId))) {
    return { success: false, message: 'ระบุ HN หรือเลขบัตรประชาชนให้ถูกต้องเพียงอย่างเดียว' }
  }
  let hn = requestedHn
  try {
    if (citizenId) {
      const personFound = await app.dbFindAll({
        from: PERSON_COLLECTION,
        nosql: { type: 'query', collection: PERSON_COLLECTION,
          query: { xrstatx: { $nin: [0, 3] }, p_cid: citizenId },
          projection: { hn: 1 }, limit: 2 }
      }, false, false)
      if (!personFound || personFound.success === false) throw new Error('อ่านทะเบียนผู้ป่วยไม่สำเร็จ')
      const people = personFound.reply && Array.isArray(personFound.reply.data) ? personFound.reply.data : []
      if (people.length > 1) return { success: false, message: 'พบเลขบัตรประชาชนซ้ำในทะเบียน กรุณาตรวจสอบข้อมูลผู้ป่วย' }
      hn = valueText(people[0] && people[0].hn).trim()
    }
    if (!hn) return { success: true, data: { hn: '', visit: null } }

    const nowText = typeof app.curDate === 'function' ? valueText(app.curDate()) : ''
    const today = validDate(nowText.slice(0, 10)) ? nowText.slice(0, 10)
      : new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const tomorrow = new Date(Date.parse(today + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10)
    const day = { $gte: today, $lt: tomorrow }
    const visitProjection = { _id: 1, vn: 1, visit_date: 1, visit_type: 1,
      visit_clinic: 1, visit_doctor: 1, inscl_hos: 1, 'pid.value': 1,
      'pid.hn': 1, 'pid.prename': 1, 'pid.p_fname': 1, 'pid.p_lname': 1,
      'pid.p_gender': 1, 'pid.age': 1, 'pid.p_abogroup': 1 }
    const readVisits = async query => {
      const found = await app.dbFindAll({
        from: VISIT_COLLECTION,
        nosql: { type: 'query', collection: VISIT_COLLECTION,
          query: { ...query, 'pid.hn': hn }, projection: visitProjection,
          sort: { vn: 1 }, limit: 100 }
      }, false, false)
      if (!found || found.success === false) throw new Error('อ่าน Visit วันนี้ไม่สำเร็จ')
      return found.reply && Array.isArray(found.reply.data) ? found.reply.data : []
    }
    let visitIds = []
    try {
      const tranFound = await app.dbFindAll({
        from: VISIT_TRAN_COLLECTION,
        nosql: { type: 'query', collection: VISIT_TRAN_COLLECTION,
          query: { xrstatx: { $nin: [0, 3] },
            vtran_status: { $in: ['waiting', 'called', 'in_progress'] },
            $or: [{ visit_date: day }, { checkin_at: day }] },
          projection: { 'vid.value': 1 }, limit: 2000 }
      }, false, false)
      if (tranFound && tranFound.success !== false) {
        const trans = tranFound.reply && Array.isArray(tranFound.reply.data) ? tranFound.reply.data : []
        visitIds = [...new Set(trans.map(row => valueText(row && row.vid && row.vid.value).trim()).filter(Boolean))]
      }
    } catch (error) { visitIds = [] }
    let visits = []
    if (visitIds.length) {
      const ids = visitIds.flatMap(id => {
        const values = [id]
        try { const oid = app.dbObjectId(id); if (oid && String(oid) !== id) values.push(oid) } catch (error) { /* use string */ }
        return values
      })
      visits = await readVisits({ xrstatx: { $nin: [0, 3] }, _id: { $in: ids } })
    }
    if (!visits.length) visits = await readVisits({ xrstatx: { $nin: [0, 3] },
      visit_date: day, visit_status: { $ne: false } })
    const visit = visits.filter(row => valueText(row && row.pid && row.pid.hn).trim() === hn)
      .sort((a, b) => valueText(a.vn).localeCompare(valueText(b.vn))).pop() || null
    return { success: true, data: { hn, visit } }
  } catch (error) {
    return { success: false, message: valueText(error && error.message) || 'ตรวจสอบ Visit วันนี้ไม่สำเร็จ' }
  }
}

/* ── action: save_manual_report ──────────────────────────────────────────
   ผู้ใช้ยืนยัน 2026-10-15 ให้เพิ่มปุ่มดินสอใน popup ผลอ่านเดิมเหมือน LAB
   โดยห้ามเปลี่ยน flow อื่น จึงเพิ่ม action นี้แยกจาก get_report/dispatch/cancel:
   · ต้องเป็น X-ray item ที่ส่งเข้าเครื่องและมี Accession No. แล้ว
   · ใช้ field เดิมของ X-ray Result เท่านั้น; ไม่สร้าง Form/collection ใหม่
   · upsert ฉบับปัจจุบันใน zdata_xray_result และ append ทุกฉบับใน result_log
   · ไม่แก้ current_status ของ CPOE item — list เดิมจะเห็น ResultText แล้วคำนวณ
     "ออกผลแล้ว" ด้วยกติกาเดิม
   · manual_request_id ทำให้ retry คำขอเดิมไม่เพิ่ม log ซ้ำ                    */
if (action === 'save_manual_report') {
  const itemId = valueText(params.item_id).trim()
  const requestId = valueText(params.manual_request_id).trim()
  const resultText = valueText(params.result_text).trim()
  const radiologistUid = valueText(params.radiologist_uid).trim()
  const resultDateTime = valueText(params.result_datetime).trim()
  const resultStatus = valueText(params.result_status).trim().toUpperCase() || 'F'
  const severityUid = valueText(params.severity_uid).trim()

  if (!/^[a-f0-9]{24}$/i.test(itemId)) {
    return { success: false, error: 'item_id_invalid', message: 'item_id ไม่ถูกต้อง' }
  }
  if (!/^[A-Za-z0-9._:-]{8,80}$/.test(requestId)) {
    return { success: false, error: 'manual_request_id_invalid', message: 'manual_request_id ไม่ถูกต้อง' }
  }
  if (!resultText) {
    return { success: false, error: 'result_text_required', message: 'กรุณากรอกผลอ่าน' }
  }
  if (resultText.length > 8000) {
    return { success: false, error: 'result_text_too_long', message: 'ผลอ่านต้องไม่เกิน 8,000 ตัวอักษร' }
  }
  if (!radiologistUid || radiologistUid.length > 100) {
    return { success: false, error: 'radiologist_uid_required', message: 'กรุณาเลือกรังสีแพทย์' }
  }
  if (!['F', 'P', 'C'].includes(resultStatus)) {
    return { success: false, error: 'result_status_invalid', message: 'สถานะผลต้องเป็น F, P หรือ C' }
  }
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(resultDateTime)) {
    return { success: false, error: 'result_datetime_invalid', message: 'วันเวลาออกผลไม่ถูกต้อง' }
  }
  if (severityUid.length > 100) {
    return { success: false, error: 'severity_uid_too_long', message: 'Severity ยาวเกินกำหนด' }
  }

  let item = null
  try {
    const found = await app.dbFindById(app.dbObjectId(itemId), ITEM_COLLECTION)
    item = found && found.reply && found.reply.data
  } catch (error) {
    return { success: false, error: 'item_read_failed', message: 'อ่านรายการตรวจไม่สำเร็จ' }
  }
  if (!item || [0, 3].includes(Number(item.xrstatx))) {
    return { success: false, error: 'item_not_found', message: 'ไม่พบรายการตรวจนี้' }
  }
  if (valueText(item.service_type && item.service_type.value).trim().toLowerCase() !== XRAY_SERVICE_TYPE) {
    return { success: false, error: 'not_xray_item', message: 'รายการนี้ไม่ใช่รายการทางรังสี' }
  }
  const itemStatus = valueText(item.current_status).trim().toLowerCase()
  if (itemStatus === 'cancelled' || itemStatus === 'rejected') {
    return { success: false, error: 'item_not_editable', message: 'รายการที่ยกเลิกหรือปฏิเสธแล้วไม่สามารถบันทึกผลได้' }
  }
  const accessionNo = valueText(item.accession_no).trim()
  if (!accessionNo) {
    return { success: false, error: 'accession_required', message: 'รายการนี้ยังไม่มี Accession No. กรุณาส่งเข้าเครื่องก่อน' }
  }

  let order = null
  const orderRef = item.order_id && item.order_id.value ? item.order_id.value : item.xparentx
  if (orderRef) {
    try {
      const found = await app.dbFindById(orderRef, ORDER_COLLECTION)
      order = found && found.reply && found.reply.data
    } catch (error) {
      order = null
    }
  }
  if (!order || [0, 3].includes(Number(order.xrstatx))) {
    return { success: false, error: 'order_not_found', message: 'ไม่พบ Order ของรายการตรวจนี้' }
  }

  /* ผล manual ต้องอ้าง Exam เดียวกับใบที่เคยส่งจริงตาม AccessionNo ก่อนเสมอ
     เพื่อรองรับทั้งใบใหม่ที่ใช้ Radio Exam code และใบเก่าที่เคยใช้ CPOE item_code.
     ถ้าไม่พบ outbound snapshot ค่อย fallback ไป mapping ปัจจุบัน แล้วจึงพฤติกรรมเดิม. */
  let outboundOrder = null
  try {
    outboundOrder = await app.db.collection(XRAY_RIS_ORDER_COLLECTION).findOne(
      { AccessionNo: accessionNo, xrstatx: { $nin: [0, 3] } },
      { sort: { updated_at: -1, _id: -1 } }
    )
  } catch (error) {
    outboundOrder = null
  }
  const xrayMapping = await readItemXrayMapping(item)
  const resultExamUid = valueText(outboundOrder && outboundOrder.ExamUid).trim() ||
    valueText(xrayMapping.value).trim() || valueText(item.item_code).trim()
  const resultExamName = valueText(outboundOrder && outboundOrder.ExamName).trim() ||
    labelText(xrayMapping.label) || valueText(item.item_name).trim()

  const actorCode = valueText(userInfo.employee_code || userInfo.username ||
    (userInfo.account && (userInfo.account.code || userInfo.account.name))).trim()
  if (!actorCode) {
    return { success: false, error: 'actor_missing', message: 'ไม่พบผู้บันทึกจากบัญชีผู้ใช้' }
  }
  const now = valueText(app.curDate && app.curDate()).trim() || resultDateTime
  const messageControlId = 'HIS-MANUAL-' + requestId
  const baseResult = {
    MessageControlId: messageControlId,
    Hn: valueText(order && order.vid && order.vid.pid && order.vid.pid.hn).trim(),
    RequestNo: valueText(order && order.order_number).trim(),
    QNo: valueText(order && (order.q_no || order.queue_no)).trim(),
    AccessionNo: accessionNo,
    Status: resultStatus,
    ExamUid: resultExamUid,
    ExamName: resultExamName,
    ImageCapturedDateTime: valueText(item.performed_at || item.dispatched_at).trim(),
    RadiologistUid: radiologistUid,
    ResultText: resultText,
    ResultDateTime: resultDateTime,
    SeverityUid: severityUid,
    SentDateTime: now,
    ReceivedDateTime: now,
    xrstatx: 1
  }

  let existingLog = null
  try {
    existingLog = await app.db.collection(RESULT_LOG_COLLECTION).findOne({
      MessageControlId: messageControlId,
      AccessionNo: accessionNo,
      xrstatx: { $nin: [0, 3] }
    })
  } catch (error) {
    return { success: false, error: 'manual_log_lookup_failed', message: 'ตรวจสอบคำขอบันทึกซ้ำไม่สำเร็จ' }
  }

  let resultId = Number(existingLog && existingLog.ResultId) || 0
  if (!existingLog) {
    try {
      const allocated = await app.db.collection(RESULT_COUNTER_COLLECTION).findOneAndUpdate(
        { _id: RESULT_COUNTER_ID },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' }
      )
      const counter = allocated && (allocated.value || allocated)
      resultId = Number(counter && counter.seq)
    } catch (error) {
      resultId = 0
    }
    if (!Number.isSafeInteger(resultId) || resultId < 1) {
      return { success: false, error: 'result_id_failed', message: 'ออกเลขลำดับผลอ่านไม่สำเร็จ' }
    }
    const logSaved = await app.dbInsert({ ...baseResult, ResultId: resultId }, RESULT_LOG_COLLECTION, userInfo)
    if (!logSaved || logSaved.success === false) {
      return { success: false, error: 'manual_log_save_failed', message: 'บันทึกประวัติผล Manual ไม่สำเร็จ' }
    }
  }

  let currentRows = []
  try {
    currentRows = await app.db.collection(RESULT_COLLECTION)
      .find({ AccessionNo: accessionNo, xrstatx: { $nin: [0, 3] } })
      .sort({ ResultDateTime: -1, xupdatx: -1, _id: -1 })
      .limit(1)
      .toArray()
  } catch (error) {
    return { success: false, error: 'current_result_lookup_failed', message: 'ค้นหาผลอ่านปัจจุบันไม่สำเร็จ' }
  }
  const current = currentRows[0] || null
  const currentSaved = current && current._id
    ? await app.dbUpdate(baseResult, RESULT_COLLECTION, userInfo, { _id: app.dbObjectId(current._id) })
    : await app.dbInsert(baseResult, RESULT_COLLECTION, userInfo)
  if (!currentSaved || currentSaved.success === false) {
    return {
      success: false,
      error: 'current_result_save_failed',
      message: 'บันทึกประวัติแล้ว แต่ปรับผลอ่านปัจจุบันไม่สำเร็จ กรุณากดบันทึกซ้ำ',
      data: { item_id: itemId, accession_no: accessionNo, result_id: resultId, retry_safe: true }
    }
  }

  try {
    app.wsSend('gridform', RESULT_FORM_ID, 'xray-manual-result', {
      from: 'xray-manual-result', broadcast: true, data: baseResult,
      method: current && current._id ? 'update' : 'insert', keyid: '_id'
    })
    app.wsSend('gridform', RESULT_LOG_FORM_ID, 'xray-manual-result-log', {
      from: 'xray-manual-result-log', broadcast: true,
      data: { ...baseResult, ResultId: resultId }, method: 'insert', keyid: '_id'
    })
  } catch (error) {
    /* บันทึกฐานข้อมูลสำเร็จแล้ว WebSocket ล้มไม่ควรย้อนผลทางคลินิก */
  }

  return {
    success: true,
    data: {
      item_id: itemId,
      accession_no: accessionNo,
      result_id: resultId,
      result_text: resultText,
      reported_at: resultDateTime,
      radiologist_uid: radiologistUid,
      result_status: resultStatus,
      severity_uid: severityUid,
      source: 'manual',
      duplicate_request: Boolean(existingLog)
    },
    message: existingLog ? 'คำขอนี้บันทึกไว้แล้ว · อัปเดตผลปัจจุบันเรียบร้อย' : 'บันทึกผล Manual เรียบร้อยแล้ว'
  }
}

/* ── action: get_report ──────────────────────────────────────────────────
   D-X6 เคาะแล้ว 2026-09-02 — ผลอ่านอยู่ที่ zdata_xray_result ซึ่ง RIS ยิงเข้ามาเอง
   ผ่าน Process xray-api-ris-result (6a861de5f851000f28e44ab3) ผูกด้วย AccessionNo

   ผลอ่านของ RIS เป็น **ข้อความก้อนเดียว** (`ResultText`) ไม่ได้แยก Findings/Impression
   จึงห้ามแบ่งเองด้วยการเดา — แสดงตามที่เขาส่งมา

   endpoint ของเขา **insert ทุกครั้ง ไม่ upsert** ⇒ accession เดียวมีได้หลายฉบับ
   (ยิงซ้ำ / ผลอ่านฉบับแก้ / ส่งตรวจซ้ำ) จึงเรียงด้วย ResultDateTime แล้วหยิบล่าสุด
   คืน result_versions เป็นจำนวนฉบับ และ (เพิ่ม 2026-09-15) versions[] ทุกฉบับ
   พร้อมรังสีแพทย์/เวลา/สถานะของแต่ละฉบับ ให้หน้าจอทำ "ประวัติการแก้" ได้           */
if (action === 'get_report') {
  const itemId = valueText(params.item_id).trim()
  if (!/^[a-f0-9]{24}$/i.test(itemId)) {
    return { success: false, message: 'item_id ไม่ถูกต้อง' }
  }

  let item = null
  try {
    const found = await app.dbFindById(app.dbObjectId(itemId), ITEM_COLLECTION)
    item = found && found.reply && found.reply.data
  } catch (error) {
    return { success: false, message: 'อ่านรายการตรวจไม่สำเร็จ' }
  }
  if (!item || [0, 3].includes(Number(item.xrstatx))) {
    return { success: false, message: 'ไม่พบรายการตรวจนี้' }
  }
  if (valueText(item.service_type && item.service_type.value).trim().toLowerCase() !== XRAY_SERVICE_TYPE) {
    return { success: false, message: 'รายการนี้ไม่ใช่รายการทางรังสี' }
  }

  let master = null
  if (item.item_data_id) {
    try {
      const masterFound = await app.dbFindById(item.item_data_id, ITEM_MASTER_COLLECTION)
      master = masterFound && masterFound.reply && masterFound.reply.data
    } catch (error) {
      master = null
    }
  }

  const xrayItem = (master && master.xray_item) || {}
  let section = item.section_snapshot ||
    (item.xray_context_snapshot && item.xray_context_snapshot.section) ||
    (master && master.section) || {}
  if (!valueText(section.code) && section.value) {
    try {
      const sectionFound = await app.dbFindById(section.value, SECTION_COLLECTION)
      section = (sectionFound && sectionFound.reply && sectionFound.reply.data) || section
    } catch (error) {
      /* ใช้ค่า snapshot ที่มีอยู่ */
    }
  }

  const modalityCode = valueText(
    xrayItem.modality || xrayItem.modality_type || section.modality_type
  ).trim().toUpperCase()

  let order = null
  const orderRef = item.order_id && item.order_id.value ? item.order_id.value : item.xparentx
  if (orderRef) {
    try {
      const orderFound = await app.dbFindById(orderRef, ORDER_COLLECTION)
      order = orderFound && orderFound.reply && orderFound.reply.data
    } catch (error) {
      order = null
    }
  }

  const accessionNo = valueText(item.accession_no).trim()
  let resultRows = []
  if (accessionNo) {
    try {
      const rows = await app.db.collection(RESULT_COLLECTION)
        .find({ AccessionNo: accessionNo, xrstatx: { $nin: [0, 3] } })
        .sort({ ResultDateTime: -1, xupdatx: -1, _id: -1 })
        .limit(20)
        .toArray()
      resultRows = Array.isArray(rows) ? rows : []
    } catch (error) {
      return { success: false, message: 'ค้นหาผลอ่านไม่สำเร็จ' }
    }
  }

  /* ประวัติทุกฉบับ — อ่านจาก log · เรียงด้วย ResultId (เลขลำดับที่ Result API ออกให้
     และเป็นฟิลด์ที่มีเฉพาะในตาราง log) แล้วค่อยตกไปที่เวลา/_id เมื่อไม่มีเลข
     🔴 อ่าน log ไม่สำเร็จ = ไม่ทำให้ทั้ง action ล้ม — ตกกลับไปใช้ resultRows
        ซึ่งให้ผลเท่ากับพฤติกรรมก่อนวันที่ 2026-09-16 ทุกประการ */
  let historyRows = []
  if (accessionNo) {
    try {
      const rows = await app.db.collection(RESULT_LOG_COLLECTION)
        .find({ AccessionNo: accessionNo, xrstatx: { $nin: [0, 3] } })
        .sort({ ResultId: -1, ResultDateTime: -1, _id: -1 })
        .limit(20)
        .toArray()
      historyRows = Array.isArray(rows) ? rows : []
    } catch (error) {
      historyRows = []
    }
  }
  const versionRows = historyRows.length ? historyRows : resultRows

  const row = resultRows[0] || null
  const resultText = valueText(row && row.ResultText).trim()
  const hasReport = Boolean(resultText)

  return {
    success: true,
    data: {
      item_id: itemId,
      order_id: valueText(order && order._id).trim(),
      order_number: valueText(order && order.order_number).trim(),
      patient_hn: valueText(order && order.vid && order.vid.pid && order.vid.pid.hn).trim(),
      visit_vn: valueText(order && order.vid && order.vid.vn).trim(),
      accession_no: accessionNo,
      test_code: valueText(item.item_code).trim(),
      test_name: valueText(item.item_name || (master && master.item_name)).trim(),
      modality: {
        code: modalityCode,
        label: MODALITY_LABEL[modalityCode] || modalityCode
      },
      body_part: valueText(xrayItem.body_path || xrayItem.bordy_path).trim(),
      /* เวลาถ่ายจริงมาจาก RIS (ImageCapturedDateTime) ค่าใน CPOE เป็นทางสำรอง */
      performed_at: valueText(
        (row && row.ImageCapturedDateTime) || item.performed_at || item.dispatched_at
      ).trim(),
      reported_at: valueText(row && row.ResultDateTime).trim(),
      /* RIS ส่งมาเป็น **รหัส** รังสีแพทย์ ยังไม่มีตาราง map เป็นชื่อ (คำถามข้อ 5)
         จึงแสดงรหัสตามจริง ห้ามเดาชื่อคน */
      radiologist_uid: valueText(row && row.RadiologistUid).trim(),
      severity_uid: valueText(row && row.SeverityUid).trim(),
      result_text: resultText,
      result_status: valueText(row && row.Status).trim(),
      result_versions: versionRows.length,
      /* ── ประวัติผลอ่านทุกฉบับ (เพิ่ม 2026-09-15 · ผู้ใช้อนุมัติดีไซน์ popup แล้ว) ──
         RIS insert แถวใหม่ทุกครั้งโดยตั้งใจ (ris-integration-plan.md §3) ⇒ ประวัติ
         ครบอยู่ใน zdata_xray_result แล้ว ที่ผ่านมาเราคืนแค่ฉบับล่าสุดกับจำนวน
         เท่ากับทิ้งของที่มีอยู่ ตอนนี้ส่งออกทั้งชุดให้หน้าจอเลือกดูได้

         🔴 เพิ่มล้วน — ทุกฟิลด์เดิมด้านบน (result_text/reported_at/radiologist_uid/…)
            ยังเป็น **ฉบับล่าสุด** เหมือนเดิมทุกประการ ฟอร์มรุ่นเก่าที่ไม่รู้จัก versions
            จึงทำงานได้เหมือนเดิม ไม่ต้องแก้อะไร
         · no เรียงจากเก่า→ใหม่ (ฉบับที่ 1 คือฉบับแรกที่ RIS ส่ง) ส่วนลำดับใน array
           เรียงใหม่→เก่าตาม sort เดิม ⇒ versions[0] คือฉบับล่าสุดเสมอ
         · ไม่ join zdata_xray_resultreset — ผู้ใช้ตัดหมุด "ถอนผล" ออกจากไทม์ไลน์
           2026-09-15 เพราะทุกฉบับถูกเก็บไว้ครบอยู่แล้ว แถว audit ยังอยู่ในฐานข้อมูล
         · ยังคง limit 20 แถวเท่าเดิม (ไม่เปลี่ยนพฤติกรรม query) ⇒ versions_capped
           บอกหน้าจอว่าอาจมีฉบับเก่ากว่านี้ที่ไม่ได้ส่งมา */
      versions: versionRows.map((resultRow, index) => ({
        no: versionRows.length - index,
        latest: index === 0,
        result_text: valueText(resultRow && resultRow.ResultText).trim(),
        reported_at: valueText(resultRow && resultRow.ResultDateTime).trim(),
        /* รหัสรังสีแพทย์ของ **ฉบับนั้น** — คนละฉบับคนละคนได้ ห้ามยืมของฉบับล่าสุด */
        radiologist_uid: valueText(resultRow && resultRow.RadiologistUid).trim(),
        severity_uid: valueText(resultRow && resultRow.SeverityUid).trim(),
        result_status: valueText(resultRow && resultRow.Status).trim(),
        performed_at: valueText(resultRow && resultRow.ImageCapturedDateTime).trim(),
        received_at: valueText(resultRow && resultRow.ReceivedDateTime).trim(),
        message_control_id: valueText(resultRow && resultRow.MessageControlId).trim(),
        /* เลขลำดับฉบับจาก Result API — ว่างเมื่อตกกลับไปอ่านตารางผลอ่านเดิม */
        result_id: valueText(resultRow && resultRow.ResultId).trim()
      })),
      versions_capped: versionRows.length >= 20,
      /* `dispatched_at` ยังคืนไว้ให้หน้าจอใช้อ้างอิงได้ ส่วน `result_is_current`
         ที่เคยใส่ไว้ 2026-09-15 ถูกถอนออก 2026-09-16 พร้อมกับกติกาเทียบเวลา
         (ผู้ใช้สั่ง) — ไม่เก็บแนวคิดที่ตายแล้วไว้ใน contract */
      dispatched_at: valueText(item.dispatched_at).trim(),
      has_report: hasReport
    },
    message: !accessionNo
      ? 'รายการนี้ยังไม่ได้ส่งเข้าเครื่อง จึงยังไม่มีเลข Accession สำหรับดึงผลอ่าน'
      : (hasReport
        ? (versionRows.length > 1
          ? ('อ่านผลอ่านฉบับล่าสุดแล้ว · accession นี้มีผลอ่าน ' + versionRows.length + ' ฉบับ')
          : 'อ่านผลอ่านแล้ว')
        : 'ยังไม่มีผลอ่านของรายการนี้ · รอ RIS ส่งกลับมา')
  }
}

/* ── action: cancel_order ────────────────────────────────────────────────
   ฟอร์มส่ง item_ids ของรายการที่ติ๊ก; คำขอจาก Form รุ่นเก่าที่ไม่มี
   item_ids ต้อง fail-closed เพื่อไม่ให้ยกเลิกทั้งใบระหว่าง deploy:
     · เหตุผลเป็น free text บังคับกรอก ไม่ต้องมีฟอร์มแยกเหมือนการปฏิเสธ
     · บันทึกการยกเลิกเก็บที่ zdata_xray_order_cancellation โดยใช้ _id ของ order
       เป็น _id ⇒ กดซ้ำได้ ไม่เกิดใบซ้ำ และรู้ได้ว่าเคยยกเลิกไปแล้ว
     · เปลี่ยนสถานะ item แบบ compare-and-set ทีละใบ · แพ้ race = หยุดและบันทึก conflict
     · ไม่มี transaction (MongoDB standalone — spec.md §4.3.1)

   **เส้นแบ่งของ X-ray: เลข Accession**
   ออกเลขแล้ว = ใบสั่งอาจไปนอนอยู่ฝั่ง RIS/PACS แล้ว (AccessionNo เป็นกุญแจธุรกิจ
   ตัวเดียวของเขา) การยกเลิกเฉพาะฝั่งเราจะทำให้สองระบบขัดกัน ⇒ หยุดและบอกให้ชัด
   จนกว่าจะได้ contract ยกเลิกจากทีม RIS (decision X9)
   ตรงกับกฎ lis_cancel_required ของ LAB ที่ห้ามยกเลิกใบที่ส่งออก Agent ไปแล้ว   */
/* ── บันทึกเจ้าหน้าที่ระดับ item + เก็บ log ───────────────────────────────
   2026-09-30 ผู้ใช้ให้เชื่อมทั้ง Radiographer / Radiologist กับ X-ray Member Master
   · Radiographer ต้องเป็น master ใน UI; server ตรวจตำแหน่งเมื่อได้รับ metadata รุ่นใหม่
   · Radiologist เลือก master หรือพิมพ์แพทย์ภายนอก (source=external) ได้
   · client รุ่นเก่าที่ส่ง radiographer string อย่างเดียวยังทำงานต่อได้ระหว่าง deploy
   · ไม่แตะ dispatched_by — นั่นคือบัญชีที่กดปุ่มส่งเข้าเครื่อง คนละความหมายกัน
   · ทุกการเปลี่ยนต้องมีร่องรอย: ค่าเก่า ค่าใหม่ เวลา และคนแก้ ถูก push ลง
     <kind>_log[] ของ item เอง (ทรงเดียวกับ accession_history)
     ห้ามเขียนทับเฉย ๆ เพราะเวชระเบียนต้องตอบได้ว่าใครแก้อะไรเมื่อไหร่
   · การล้างค่า (ส่งค่าว่าง) ก็ถูกบันทึกเป็น log เหมือนกัน ไม่ใช่ลบเงียบ ๆ */
if (action === 'set_staff') {
  const itemId = valueText(params.item_id).trim()
  if (!/^[a-f0-9]{24}$/i.test(itemId)) {
    return { success: false, error: 'invalid_item_id', message: 'item_id ไม่ถูกต้อง' }
  }
  const staffFields = ['radiographer', 'radiologist'].filter(field =>
    Object.prototype.hasOwnProperty.call(params, field)
  )
  if (staffFields.length !== 1) {
    return { success: false, error: 'nothing_to_save', message: 'ไม่มีข้อมูลเจ้าหน้าที่ที่จะบันทึก' }
  }
  const staffField = staffFields[0]
  const staffLabel = staffField === 'radiologist' ? 'Radiologist' : 'Radiographer'
  let staffName = valueText(params[staffField]).trim().replace(/\s+/g, ' ')
  if (staffName.length > 120) {
    return { success: false, error: staffField + '_too_long', message: 'ชื่อ ' + staffLabel + ' ต้องไม่เกิน 120 ตัวอักษร' }
  }
  let source = staffName ? valueText(params[staffField + '_source']).trim().toLowerCase() : ''
  let memberId = staffName ? valueText(params[staffField + '_member_id']).trim() : ''

  if (source && source !== 'master' && source !== 'external') {
    return { success: false, error: 'invalid_staff_source', message: 'แหล่งข้อมูล ' + staffLabel + ' ไม่ถูกต้อง' }
  }
  if (source === 'external' && staffField !== 'radiologist') {
    return { success: false, error: 'external_radiographer_not_allowed', message: 'Radiographer ต้องเลือกจาก X-ray Member Master' }
  }
  if (source === 'external') memberId = ''

  const active = { $nin: [0, 3] }
  if (source === 'master') {
    if (!/^[a-f0-9]{24}$/i.test(memberId)) {
      return { success: false, error: 'invalid_member_id', message: 'รหัส X-ray Member ไม่ถูกต้อง' }
    }
    const member = await app.db.collection(XRAY_MEMBER_COLLECTION).findOne({
      _id: app.dbObjectId(memberId), xrstatx: active
    })
    if (!member) {
      return { success: false, error: 'member_not_found', message: 'ไม่พบรายชื่อใน X-ray Member Master' }
    }
    const position = valueText(member.position).trim().toUpperCase()
    const allowedPositions = staffField === 'radiologist'
      ? ['RADIOLOGIST_PRO', 'RADIOLOGIST_SENIOR']
      : ['RADIOGRAPHER_PRO', 'RADIOGRAPHER_PRACTICE']
    if (allowedPositions.indexOf(position) < 0) {
      return { success: false, error: 'member_role_mismatch', message: 'ตำแหน่งใน X-ray Member Master ไม่ตรงกับช่อง ' + staffLabel }
    }
    const memberPrename = labelText(member.prename)
    const memberFirstName = valueText(member.first_name).trim()
    const masterName = [memberPrename + memberFirstName, valueText(member.last_name).trim()]
      .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    if (!masterName) {
      return { success: false, error: 'member_name_missing', message: 'X-ray Member ยังไม่มีชื่อที่ใช้แสดงผล' }
    }
    /* ใช้ชื่อจากฐานจริงเสมอ ไม่เชื่อข้อความที่ client ส่งคู่มากับ member_id */
    staffName = masterName
  }

  const now = valueText(app.curDate('YYYY-MM-DD HH:mm:ss')).trim()
  const actorCode = valueText(userInfo.employee_code || userInfo.username ||
    (userInfo.account && (userInfo.account.code || userInfo.account.name))).trim()
  if (!actorCode) {
    return { success: false, error: 'actor_missing', message: 'ไม่พบผู้บันทึกจากบัญชีผู้ใช้' }
  }
  const actorName = valueText(userInfo.fullname || userInfo.display_name ||
    (userInfo.account && (userInfo.account.label || userInfo.account.name)) || actorCode).trim()
  const actorId = userInfo._id || userInfo.id ||
    (userInfo.account && (userInfo.account._id || userInfo.account.id)) || ''
  const actorAudit = { id: actorId, name: actorName || actorCode }

  const itemCollection = app.db.collection(ITEM_COLLECTION)
  const item = await itemCollection.findOne({ _id: app.dbObjectId(itemId), xrstatx: active })
  if (!item) return { success: false, error: 'item_not_found', message: 'ไม่พบรายการที่ต้องการบันทึก' }

  const serviceType = valueText(
    (item.service_type && item.service_type.value != null) ? item.service_type.value : item.service_type
  ).trim().toLowerCase()
  if (serviceType !== XRAY_SERVICE_TYPE) {
    return { success: false, error: 'not_xray_item', message: 'รายการนี้ไม่ใช่รายการทางรังสี' }
  }

  /* ยกเลิก/ปฏิเสธไปแล้วไม่ต้องบันทึกผู้ถ่าย — ของเดิมที่ลงไว้ยังอ่านได้ตามปกติ */
  const currentStatus = valueText(item.current_status).trim().toLowerCase()
  if (['cancelled', 'rejected', 'returned', 'reversed'].indexOf(currentStatus) >= 0) {
    return {
      success: false,
      error: 'item_terminal',
      message: 'รายการนี้ถูกยกเลิก/ปฏิเสธแล้ว จึงบันทึก ' + staffLabel + ' ไม่ได้'
    }
  }

  const previous = valueText(item[staffField]).trim()
  const previousSource = valueText(item[staffField + '_source']).trim()
  const previousMemberId = valueText(item[staffField + '_member_id']).trim()
  if (previous === staffName && previousSource === source && previousMemberId === memberId) {
    const data = { item_id: itemId, staff_field: staffField, previous, changed: false }
    data[staffField] = staffName
    return {
      success: true,
      data,
      message: 'ค่าเดิมอยู่แล้ว ไม่มีการเปลี่ยนแปลง'
    }
  }

  try {
    const setFields = { updated_at: now, updated_by: actorCode }
    setFields[staffField] = staffName
    setFields[staffField + '_at'] = staffName ? now : ''
    setFields[staffField + '_by'] = staffName ? actorAudit : ''
    setFields[staffField + '_source'] = source
    setFields[staffField + '_member_id'] = memberId
    const pushFields = {}
    pushFields[staffField + '_log'] = {
      value: staffName,
      previous,
      source,
      previous_source: previousSource,
      member_id: memberId,
      previous_member_id: previousMemberId,
      action: staffName ? 'set' : 'clear',
      at: now,
      by: actorAudit
    }
    await itemCollection.updateOne(
      { _id: item._id, xrstatx: active },
      {
        $set: setFields,
        $push: pushFields
      }
    )
  } catch (error) {
    return {
      success: false,
      error: 'save_failed',
      message: 'บันทึก ' + staffLabel + ' ไม่สำเร็จ: ' + String((error && error.message) || error)
    }
  }

  const data = {
    item_id: itemId, staff_field: staffField, previous, previous_source: previousSource,
    previous_member_id: previousMemberId, source, member_id: memberId, changed: true, at: now, by: actorAudit
  }
  data[staffField] = staffName
  return {
    success: true,
    data,
    message: staffName ? ('บันทึก ' + staffLabel + ': ' + staffName) : ('ล้าง ' + staffLabel + ' แล้ว')
  }
}

/* ── ตรวจใหม่ (ผู้ใช้สั่ง 2026-09-03) ────────────────────────────────────────
   ปุ่ม "ตรวจใหม่" สำหรับรายการที่เลือกใน Order เดิม · กติกาที่ผู้ใช้กำหนด:
     · ย้าย Order กลับไปหน้า "รอรับ" — **ใช้ Order เดิมและเลข Order เดิม** ไม่สร้างใบใหม่
     · ถ้ามีเลข Accession ค้างอยู่ให้ล้างทิ้ง แล้วให้ผู้ใช้กด "ส่งเข้าเครื่อง" เพื่อออกเลขใหม่
   (แทนกติกาเดิมใน Xray_design.md ที่ให้สร้าง Order ใหม่ลิงก์กลับ)

   สิ่งที่ **ไม่** ทำ: ไม่ลบบันทึกการยกเลิกทิ้ง — เอกสารใน zdata_xray_order_cancellation
   คือหลักฐานว่าเคยยกเลิกด้วยเหตุผลอะไร แค่ประทับว่าถูกเปิดกลับมาแล้ว
   ทุกรายการที่ถูกปลุกกลับมาเก็บร่องรอยไว้ที่ retest_log[] ของ item เอง */
/* action ใหม่ทำให้ Form รุ่นใหม่ไม่เผลอเรียก retest_order รุ่นเก่าที่เปิดกลับทั้งใบ */
if (action === 'retest_items' || action === 'retest_order') {
  const orderId = valueText(params.order_id).trim()
  if (!/^[a-f0-9]{24}$/i.test(orderId)) {
    return { success: false, error: 'invalid_order_id', message: 'order_id ไม่ถูกต้อง' }
  }
  /* 2026-09-18: ห้าม fallback เป็นทั้ง Order เมื่อฟอร์มเก่ายังไม่ส่ง item_ids */
  const requestedIds = params.item_ids
  if (!Array.isArray(requestedIds) || !requestedIds.length || requestedIds.length > 100 ||
    requestedIds.some(id => typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id)) ||
    new Set(requestedIds.map(id => id.toLowerCase())).size !== requestedIds.length) {
    return { success: false, error: 'invalid_item_ids', message: 'กรุณาเลือกรายการ X-ray ที่ต้องการตรวจใหม่' }
  }

  const now = valueText(app.curDate('YYYY-MM-DD HH:mm:ss')).trim()
  const actorCode = valueText(userInfo.employee_code || userInfo.username ||
    (userInfo.account && (userInfo.account.code || userInfo.account.name))).trim()
  if (!actorCode) {
    return { success: false, error: 'actor_missing', message: 'ไม่พบผู้ทำรายการจากบัญชีผู้ใช้' }
  }
  const actorName = valueText(userInfo.fullname || userInfo.display_name ||
    (userInfo.account && (userInfo.account.label || userInfo.account.name)) || actorCode).trim()
  const actorId = userInfo._id || userInfo.id ||
    (userInfo.account && (userInfo.account._id || userInfo.account.id)) || ''
  const actorAudit = { id: actorId, name: actorName || actorCode }

  const active = { $nin: [0, 3] }
  const orderObjectId = app.dbObjectId(orderId)
  const orderCollection = app.db.collection(ORDER_COLLECTION)
  const itemCollection = app.db.collection(ITEM_COLLECTION)
  const cancellationCollection = app.db.collection(ORDER_CANCELLATION_COLLECTION)

  const order = await orderCollection.findOne({ _id: orderObjectId, xrstatx: active })
  if (!order) return { success: false, error: 'order_not_found', message: 'ไม่พบ CPOE Order ที่ต้องการตรวจใหม่' }
  const orderNumber = valueText(order.order_number).trim()

  const orderLinks = [orderObjectId, orderId]
  const allItems = await itemCollection.find({
    xrstatx: active,
    $or: [
      { 'order_id.value': { $in: orderLinks } },
      { order_ref_id: { $in: orderLinks } },
      { xparentx: { $in: orderLinks } }
    ]
  }).toArray()
  const serviceTypeOf = item => valueText(
    (item && item.service_type && item.service_type.value != null)
      ? item.service_type.value
      : (item && item.service_type)
  ).trim().toLowerCase()
  const xrayItems = allItems.filter(item => serviceTypeOf(item) === XRAY_SERVICE_TYPE)
  if (!xrayItems.length) {
    return { success: false, error: 'no_xray_item', message: 'Order นี้ไม่มีรายการทางรังสี' }
  }

  /* ปลุกกลับมาได้เฉพาะรายการที่จบด้วยการยกเลิก/ปฏิเสธ
     รายการที่ออกผลแล้วให้ใช้ปุ่ม "ส่งตรวจซ้ำ" ในแท็บ order ซึ่งมีเส้นทางของตัวเองอยู่แล้ว */
  const terminalStatuses = ['cancelled', 'rejected', 'returned', 'reversed']
  const itemById = new Map(xrayItems.map(item => [valueText(item._id).toLowerCase(), item]))
  const targets = requestedIds.map(id => itemById.get(id.toLowerCase()))
  if (targets.some(item => !item)) {
    return { success: false, error: 'item_not_in_order', message: 'รายการที่เลือกไม่ใช่ X-ray ใน Order นี้ กรุณาโหลดใหม่' }
  }
  if (targets.some(item => !terminalStatuses.includes(valueText(item.current_status).trim().toLowerCase()))) {
    return {
      success: false,
      error: 'item_not_retestable',
      message: 'รายการที่เลือกมีสถานะที่ตรวจใหม่ไม่ได้ กรุณาโหลดใหม่และเลือกเฉพาะรายการที่ยกเลิก'
    }
  }
  const auditBefore = await cancellationCollection.findOne({ _id: orderObjectId, xrstatx: active })
  if (auditBefore && ['pending', 'ris_pending', 'conflict'].includes(valueText(auditBefore.cancel_status).trim().toLowerCase())) {
    return { success: false, error: 'cancel_audit_pending',
      message: 'การยกเลิก Order นี้ยังค้างดำเนินการ กรุณาให้ผู้ดูแลตรวจสอบก่อนตรวจใหม่' }
  }

  let reopened = 0
  let clearedAccession = 0
  for (let index = 0; index < targets.length; index += 1) {
    const item = targets[index]
    const status = valueText(item.current_status).trim().toLowerCase()
    const previousAccession = valueText(item.accession_no).trim()
    /* ล้างทุกอย่างของรอบก่อนให้แถวกลับไปเป็น "รอรับ" จริง ๆ ไม่ใช่แค่เปลี่ยนป้ายสถานะ
       เวลาส่ง/ผู้ส่ง/ผล transport ของรอบเก่าถ้าค้างไว้ หน้าจอจะอ่านว่ารอบนี้เคยส่งไปแล้ว */
    const update = {
      $set: {
        current_status: 'sent',
        accession_no: '',
        dispatched_at: '',
        dispatched_by: '',
        resent_at: '',
        transport: '',
        transport_failed: false,
        cancel_reason: '',
        cancelled_at: '',
        cancelled_by: '',
        cancel_type: '',
        cancellation_record_id: '',
        retest_at: now,
        retest_by: actorAudit,
        updated_at: now,
        updated_by: actorCode
      },
      $push: {
        retest_log: {
          from_status: status,
          to_status: 'sent',
          cleared_accession_no: previousAccession,
          at: now,
          by: actorAudit
        }
      }
    }
    /* เลขเดิมต้องตามกลับได้เสมอ — ผลอ่านรอบก่อนใน zdata_xray_result ผูกกับเลขนั้น
       ใช้ที่เก็บเดียวกับการส่งตรวจซ้ำ (accession_history) จะได้ไล่ประวัติที่เดียวจบ */
    if (previousAccession) {
      update.$push.accession_history = {
        accession_no: previousAccession,
        cleared_at: now,
        cleared_by: actorCode,
        reason: 'retest'
      }
      clearedAccession += 1
    }
    const saved = await itemCollection.updateOne(
      { _id: item._id, xrstatx: active, current_status: valueText(item.current_status) },
      update
    )
    if (!saved || Number(saved.matchedCount) !== 1) {
      return {
        success: false,
        error: 'retest_race_lost',
        message: 'สถานะรายการเปลี่ยนระหว่างเปิดตรวจใหม่ กรุณาโหลดใหม่แล้วลองอีกครั้ง',
        data: { order_id: orderId, reopened_item_count: reopened }
      }
    }
    reopened += 1
  }

  /* บันทึก ID รายการที่เปิดกลับ และคง applied ถ้ายังมีรายการยกเลิกในชุดเดิม */
  let auditSyncPending = false
  try {
    const reopenedIds = new Set(targets.map(item => valueText(item._id).toLowerCase()))
    const stillCancelled = xrayItems.some(item => !reopenedIds.has(valueText(item._id).toLowerCase()) &&
      terminalStatuses.includes(valueText(item.current_status).trim().toLowerCase()))
    const stamped = await cancellationCollection.updateOne(
      { _id: orderObjectId, xrstatx: active },
      {
        $set: { cancel_status: stillCancelled ? 'applied' : 'reopened', reopened_at: now, reopened_by: actorAudit, updated_at: now, updated_by: actorAudit },
        $push: { reopen_log: { at: now, by: actorAudit, item_ids: targets.map(item => valueText(item._id)), reopened_item_count: reopened } }
      }
    )
    auditSyncPending = !stamped || Number(stamped.matchedCount) !== 1
  } catch (error) {
    auditSyncPending = true
  }

  return {
    success: true,
    data: {
      order_id: orderId,
      order_number: orderNumber,
      current_status: 'sent',
      item_ids: targets.map(item => valueText(item._id)),
      reopened_item_count: reopened,
      cleared_accession_count: clearedAccession,
      item_count: xrayItems.length,
      audit_sync_pending: auditSyncPending
    },
    message: (clearedAccession
      ? 'เปิดตรวจใหม่แล้ว ' + reopened + ' รายการ · ล้างเลข Accession เดิม ' + clearedAccession +
        ' รายการ — กดส่งเข้าเครื่องเพื่อออกเลขใหม่'
      : 'เปิดตรวจใหม่แล้ว ' + reopened + ' รายการ — กลับไปสถานะรอรับ') +
      (auditSyncPending ? ' (บันทึกการยกเลิกยังรอ reconcile)' : '')
  }
}

if (action === 'cancel_order') {
  const orderId = valueText(params.order_id).trim()
  const requestedOrderNumber = valueText(params.order_number).trim()
  const cancelReason = valueText(params.cancel_reason || params.reason).trim()
  if (!/^[a-f0-9]{24}$/i.test(orderId)) {
    return { success: false, error: 'invalid_order_id', message: 'order_id ไม่ถูกต้อง' }
  }
  if (!cancelReason) {
    return { success: false, error: 'cancel_reason_missing', message: 'กรุณาระบุเหตุผลการยกเลิก Order' }
  }
  if (cancelReason.length > 1000) {
    return { success: false, error: 'cancel_reason_too_long', message: 'เหตุผลการยกเลิกต้องไม่เกิน 1000 ตัวอักษร' }
  }

  const now = valueText(app.curDate('YYYY-MM-DD HH:mm:ss')).trim()
  const actorCode = valueText(userInfo.employee_code || userInfo.username ||
    (userInfo.account && (userInfo.account.code || userInfo.account.name))).trim()
  if (!actorCode) {
    return { success: false, error: 'actor_missing', message: 'ไม่พบผู้ยกเลิกจากบัญชีผู้ใช้' }
  }
  const actorName = valueText(userInfo.fullname || userInfo.display_name ||
    (userInfo.account && (userInfo.account.label || userInfo.account.name)) || actorCode).trim()
  const actorId = userInfo._id || userInfo.id ||
    (userInfo.account && (userInfo.account._id || userInfo.account.id)) || ''
  const actorAudit = { id: actorId, name: actorName || actorCode }

  const active = { $nin: [0, 3] }
  const orderObjectId = app.dbObjectId(orderId)
  const orderCollection = app.db.collection(ORDER_COLLECTION)
  const itemCollection = app.db.collection(ITEM_COLLECTION)
  const cancellationCollection = app.db.collection(ORDER_CANCELLATION_COLLECTION)

  const order = await orderCollection.findOne({ _id: orderObjectId, xrstatx: active })
  if (!order) return { success: false, error: 'order_not_found', message: 'ไม่พบ CPOE Order ที่ต้องการยกเลิก' }
  const orderNumber = valueText(order.order_number).trim()
  if (requestedOrderNumber && requestedOrderNumber !== orderNumber) {
    return { success: false, error: 'order_number_mismatch', message: 'เลขที่ใบสั่งไม่ตรงกับ Order ที่เลือก' }
  }

  /* ลิงก์ item → order รับได้ทุกทรงเหมือน dispatch ไม่งั้นบางชุดข้อมูลจะหาไม่เจอ */
  const orderLinks = [orderObjectId, orderId]
  const allItems = await itemCollection.find({
    xrstatx: active,
    $or: [
      { 'order_id.value': { $in: orderLinks } },
      { order_ref_id: { $in: orderLinks } },
      { xparentx: { $in: orderLinks } }
    ]
  }).toArray()
  const serviceTypeOf = item => valueText(
    (item && item.service_type && item.service_type.value != null)
      ? item.service_type.value
      : (item && item.service_type)
  ).trim().toLowerCase()
  const xrayItems = allItems.filter(item => serviceTypeOf(item) === XRAY_SERVICE_TYPE)
  if (!xrayItems.length) {
    return { success: false, error: 'xray_items_not_found', message: 'Order นี้ไม่มีรายการทางรังสีที่ยกเลิกได้' }
  }

  const scopedCancel = Object.prototype.hasOwnProperty.call(params, 'item_ids')
  const requestedItemIds = scopedCancel && Array.isArray(params.item_ids) ? params.item_ids : []
  if (!scopedCancel || !Array.isArray(params.item_ids) || !requestedItemIds.length ||
      requestedItemIds.length > 100 || requestedItemIds.some(id => !/^[a-f0-9]{24}$/i.test(valueText(id).trim())) ||
      new Set(requestedItemIds.map(id => valueText(id).trim().toLowerCase())).size !== requestedItemIds.length) {
    return { success: false, error: 'invalid_item_ids', message: 'กรุณาเลือกรายการ X-ray ที่ต้องการยกเลิก' }
  }
  const selectedIds = requestedItemIds.map(id => valueText(id).trim().toLowerCase())
  const xrayIds = xrayItems.map(item => valueText(item._id).trim().toLowerCase())
  if (selectedIds.some(id => !xrayIds.includes(id))) {
    return { success: false, error: 'item_order_mismatch', message: 'รายการที่เลือกไม่ใช่ X-ray item ของ Order นี้' }
  }
  const cancelTargets = xrayItems.filter(item =>
    selectedIds.includes(valueText(item._id).trim().toLowerCase()))
  const terminalStatuses = ['cancelled', 'rejected', 'returned', 'reversed']
  const resultStatuses = ['resulted', 'completed']
  const cancellable = []
  const risTargets = []
  for (let index = 0; index < cancelTargets.length; index += 1) {
    const item = cancelTargets[index]
    const status = valueText(item.current_status).trim().toLowerCase()
    const label = valueText(item.item_code).trim() || valueText(item._id).trim()
    if (terminalStatuses.includes(status)) continue
    if (resultStatuses.includes(status)) {
      return {
        success: false,
        error: 'item_not_cancellable',
        message: 'ยกเลิก Order ไม่ได้ เพราะรายการ ' + label + ' ออกผลอ่านไปแล้ว'
      }
    }
    if (!CANCELLABLE_ACTIVE_STATUSES.includes(status)) {
      return {
        success: false,
        error: 'item_not_cancellable',
        message: 'ยกเลิก Order ไม่ได้ เพราะรายการ ' + label + ' อยู่สถานะ "' + (status || '(ว่าง)') + '"'
      }
    }
    cancellable.push({ item: item, itemId: valueText(item._id).trim(), status: status })
    if (valueText(item.accession_no).trim()) {
      if (xrayItems.some(sibling =>
        valueText(sibling._id).trim() !== valueText(item._id).trim() &&
        !selectedIds.includes(valueText(sibling._id).trim().toLowerCase()) &&
        valueText(sibling.accession_no).trim() === valueText(item.accession_no).trim())) {
        return { success: false, error: 'shared_accession',
          message: 'Accession ' + valueText(item.accession_no).trim() + ' ผูกกับรายการที่ไม่ได้เลือก — ยังไม่ส่งยกเลิก RIS' }
      }
      risTargets.push({ item: item, accessionNo: valueText(item.accession_no).trim(), label: label })
    }
  }

  /* ก่อนสร้าง log หรือเปลี่ยน CPOE: ทุก Accession ต้องมี Order JSON ที่เคยส่งจริง
     ในตารางกลาง จึงส่งซ้ำด้วย payload เดิมได้ ไม่เดาข้อมูลคนไข้/Exam จาก CPOE */
  const risPayloads = []
  if (risTargets.length) {
    const risOrderCollection = app.db.collection(XRAY_RIS_ORDER_COLLECTION)
    for (let index = 0; index < risTargets.length; index += 1) {
      const target = risTargets[index]
      const source = await risOrderCollection.findOne(
        { AccessionNo: target.accessionNo, xrstatx: active },
        { sort: { updated_at: -1, _id: -1 } }
      )
      if (!source) {
        return {
          success: false,
          error: 'ris_cancel_required',
          message: 'รายการ ' + target.label + ' มีเลข Accession ' + target.accessionNo +
            ' แต่ไม่พบ RIS Order JSON ที่เคยส่งในตาราง X-ray Order — ยังไม่ยกเลิกใน HIS'
        }
      }
      /* ใบใหม่ใช้ Radio Exam code; ใบเก่าก่อน migration ใช้ CPOE item_code.
         ยอมรับได้เฉพาะสองค่าที่ตรวจย้อนกลับถึง item เดิม เพื่อรักษา guard กันส่ง
         tombstone ผิดใบไว้ครบ ไม่ลดเหลือการเช็ก Accession/RequestNo อย่างเดียว. */
      const xrayMapping = await readItemXrayMapping(target.item)
      const expectedExamUids = [
        valueText(target.item.item_code).trim(),
        valueText(xrayMapping.value).trim()
      ].filter((value, index, values) => value && values.indexOf(value) === index)
      if (expectedExamUids.indexOf(valueText(source.ExamUid).trim()) < 0 ||
          (valueText(source.RequestNo).trim() && valueText(source.RequestNo).trim() !== orderNumber)) {
        return {
          success: false,
          error: 'ris_cancel_order_mismatch',
          message: 'ข้อมูล Order JSON ของ Accession ' + target.accessionNo +
            ' ไม่ตรงกับใบสั่ง/รายการตรวจใน CPOE — ยังไม่ส่งยกเลิก RIS'
        }
      }
      /* worklist derive "ออกผลแล้ว" จากตาราง RIS ไม่ได้เปลี่ยน current_status ของ CPOE
         ดังนั้นตรวจซ้ำที่ server ด้วย ไม่พึ่งปุ่ม disabled บนฟอร์มอย่างเดียว */
      const reported = await app.db.collection(RESULT_COLLECTION).findOne({
        AccessionNo: target.accessionNo,
        xrstatx: active,
        ResultText: { $nin: [null, ''] }
      })
      if (reported && valueText(reported.ResultText).trim()) {
        return {
          success: false,
          error: 'item_not_cancellable',
          message: 'ยกเลิก Order ไม่ได้ เพราะ Accession ' + target.accessionNo + ' ออกผลอ่านไปแล้ว'
        }
      }
      const payload = {}
      RIS_DISPATCH_FIELDS.forEach(name => {
        if (source[name] !== undefined && source[name] !== null && source[name] !== '') {
          payload[name] = source[name]
        }
      })
      payload.AccessionNo = target.accessionNo
      payload.Status = 'A' // callback ของ RIS อาจเปลี่ยน Status ในตารางกลางเป็น C=Completed
      payload.IsDeleted = true
      const missing = RIS_ORDER_REQUIRED.filter(name => !valueText(payload[name]).trim())
      if (missing.length) {
        return {
          success: false,
          error: 'ris_cancel_payload_incomplete',
          message: 'Order JSON ของ Accession ' + target.accessionNo +
            ' ขาดข้อมูล ' + missing.join(', ') + ' — ยังไม่ยกเลิกใน HIS'
        }
      }
      risPayloads.push({ target: target, payload: payload })
    }
  }

  let cancellation = await cancellationCollection.findOne({ _id: orderObjectId, xrstatx: active })
  const previousStatus = valueText(cancellation && cancellation.cancel_status).trim().toLowerCase()
  const previousIds = Array.isArray(cancellation && cancellation.item_ids)
    ? cancellation.item_ids.map(id => valueText(id).trim().toLowerCase()) : []
  const sameSelection = selectedIds.length === previousIds.length &&
    selectedIds.every(id => previousIds.includes(id))
  if (cancellation && ['pending', 'ris_pending', 'conflict'].includes(previousStatus) &&
      !sameSelection) {
    return { success: false, error: 'cancel_conflict',
      message: 'มีชุดรายการยกเลิกเดิมค้างอยู่ กรุณาดำเนินการชุดเดิมให้เสร็จก่อน' }
  }
  if (!cancellable.length && !cancellation) {
    return { success: false, error: 'nothing_to_cancel', message: 'Order นี้ไม่มีรายการที่ยกเลิกได้' }
  }
  if (cancellation && valueText(cancellation.cancel_status).trim().toLowerCase() === 'conflict') {
    return {
      success: false,
      error: 'cancel_conflict',
      message: 'Order นี้เคยยกเลิกไม่สำเร็จเพราะสถานะเปลี่ยน กรุณาให้ผู้ดูแลตรวจสอบ'
    }
  }
  if (cancellation && valueText(cancellation.cancel_status).trim().toLowerCase() === 'ris_pending' &&
      !risPayloads.length) {
    return {
      success: false,
      error: 'ris_cancel_required',
      message: 'Order นี้ค้างการยกเลิก RIS แต่ไม่พบ Accession ปัจจุบัน — ให้ผู้ดูแลตรวจสอบก่อนยกเลิกใน HIS'
    }
  }

  let alreadyCancelled = cancellable.length === 0
  if (!cancellation) {
    const cancellationDoc = {
      _id: orderObjectId,
      xparentx: orderObjectId,
      xsitex: userInfo.site || {},
      xunitx: userInfo.unit || {},
      xrstatx: 1,
      xversionx: 'v1',
      dataid: orderId,
      source_order_id: orderId,
      source_order_number: orderNumber,
      cancel_type: 'xray_order_cancelled',
      cancel_status: 'pending',
      cancel_reason: cancelReason,
      cancelled_at: now,
      cancelled_by: actorAudit,
      organization_code: organizationCode,
      item_ids: cancelTargets.map(item => valueText(item._id).trim()),
      cancel_scope: 'items',
      created_at: now,
      created_by: actorAudit,
      updated_at: now,
      updated_by: actorAudit
    }
    try {
      await cancellationCollection.insertOne(cancellationDoc)
      cancellation = cancellationDoc
    } catch (error) {
      /* ชนกับคนที่กดพร้อมกัน — _id ซ้ำ ⇒ อ่านของผู้ชนะมาใช้ ไม่ใช่ error */
      cancellation = await cancellationCollection.findOne({ _id: orderObjectId, xrstatx: active })
      if (!cancellation) throw error
      const storedIds = Array.isArray(cancellation.item_ids)
        ? cancellation.item_ids.map(id => valueText(id).trim().toLowerCase()) : []
      if (storedIds.length !== selectedIds.length || selectedIds.some(id => !storedIds.includes(id))) {
        return { success: false, error: 'cancel_conflict',
          message: 'มีผู้เริ่มยกเลิกรายการชุดอื่นพร้อมกัน กรุณาโหลดใหม่ก่อนลองอีกครั้ง' }
      }
      alreadyCancelled = true
    }
  }

  /* Order เดิมอาจถูกยกเลิกบางรายการไปแล้ว: เก็บ audit รอบก่อนใน history
     ก่อนเริ่มชุดใหม่ และใช้เหตุผล/ผู้ยกเลิกของชุดปัจจุบันกับ item ที่เลือกเท่านั้น */
  if (cancellation && cancellable.length &&
      ['applied', 'reopened'].includes(previousStatus)) {
    const prior = {
      item_ids: Array.isArray(cancellation.item_ids) ? cancellation.item_ids : [],
      cancel_status: cancellation.cancel_status,
      cancel_reason: cancellation.cancel_reason,
      cancelled_at: cancellation.cancelled_at,
      cancelled_by: cancellation.cancelled_by,
      ris_cancel: cancellation.ris_cancel || null
    }
    const nextHistory = (Array.isArray(cancellation.history) ? cancellation.history : []).concat([prior])
    const nextFields = {
      cancel_status: 'pending', cancel_scope: 'items',
      item_ids: cancelTargets.map(item => valueText(item._id).trim()),
      cancel_reason: cancelReason, cancelled_at: now, cancelled_by: actorAudit,
      ris_cancel: null, history: nextHistory, updated_at: now, updated_by: actorAudit
    }
    const reset = await cancellationCollection.updateOne(
      { _id: orderObjectId, xrstatx: active, cancel_status: cancellation.cancel_status },
      { $set: nextFields }
    )
    if (!reset || Number(reset.matchedCount) !== 1) {
      return { success: false, error: 'cancel_conflict', message: 'สถานะการยกเลิกเปลี่ยน กรุณาโหลดใหม่' }
    }
    cancellation = Object.assign({}, cancellation, nextFields)
  }

  const cancellationId = valueText(cancellation._id).trim() || orderId
  const authoritativeReason = valueText(cancellation.cancel_reason).trim() || cancelReason
  const authoritativeAt = valueText(cancellation.cancelled_at).trim() || now
  const authoritativeBy = cancellation.cancelled_by || actorAudit

  const progress = []
  if (risPayloads.length) {
    /* ขอบเขต HIS สิ้นสุดเมื่อ X-ray Order Process ยืนยันว่าเก็บ IsDeleted:true
       ลงตาราง Order แล้ว; การ forward ไป Envision เป็นหน้าที่ของ API Order ทีม
       เก็บผลขาที่สองไว้ใน audit แยกจากผลรับคำขอของเรา */
    const attempts = Number(cancellation.ris_cancel && cancellation.ris_cancel.attempts || 0) + 1
    const pending = await cancellationCollection.updateOne(
      { _id: orderObjectId, xrstatx: active, cancel_status: { $in: ['pending', 'ris_pending', 'reopened', 'applied'] } },
      { $set: {
        cancel_status: 'ris_pending',
        ris_cancel: { status: 'pending', attempts: attempts, at: now, items: [] },
        updated_at: now, updated_by: actorAudit
      } }
    )
    if (!pending || Number(pending.matchedCount) !== 1) {
      return { success: false, error: 'cancel_conflict', message: 'สถานะการยกเลิกเปลี่ยน กรุณาโหลดใหม่ก่อนลองอีกครั้ง' }
    }

    const unwrapRisAck = raw => {
      const candidates = [raw, raw && raw.reply && raw.reply.data,
        raw && raw.data, raw && raw.data && raw.data.data]
      return candidates.find(value => value && typeof value === 'object' && value.AcknowledgementCode) || null
    }
    const forwardedAck = raw => {
      let body = raw
      if (typeof body === 'string') {
        try { body = JSON.parse(body) } catch (_) { return null }
      }
      const candidates = [body, body && body.data, body && body.reply,
        body && body.reply && body.reply.data]
      return candidates.find(value => value && typeof value === 'object' && value.AcknowledgementCode) || null
    }

    for (let index = 0; index < risPayloads.length; index += 1) {
      const entry = risPayloads[index]
      let ack = null
      let failure = ''
      try {
        const response = await app.runProcess(RIS_ORDER_PROCESS_ID, entry.payload, userInfo)
        if (response && response.permissionDenied) failure = 'ไม่มีสิทธิ์เรียก X-ray Order API'
        else if (response && response.success === false) {
          failure = valueText(response.reply && response.reply.message).trim() || 'X-ray Order API ไม่สำเร็จ'
        }
        else ack = unwrapRisAck(response)
      } catch (error) {
        failure = valueText(error && error.message).trim() || 'เรียก X-ray Order API ไม่สำเร็จ'
      }
      const forwardRaw = ack && ack.ForwardHttpStatus
      const httpStatus = forwardRaw === null || forwardRaw === undefined || forwardRaw === ''
        ? null : Number(forwardRaw)
      const risAck = forwardedAck(ack && ack.ForwardResponse)
      const risCode = valueText(risAck && risAck.AcknowledgementCode).trim().toUpperCase()
      const responseAccession = valueText(ack && ack.AccessionNo).trim()
      const accessionMatches = !responseAccession || responseAccession === entry.target.accessionNo
      const deliveryConfirmed = !failure && ack &&
        valueText(ack.AcknowledgementCode).trim().toUpperCase() === 'AA' &&
        accessionMatches && httpStatus >= 200 && httpStatus < 300 && risCode === 'AA' &&
        (!valueText(risAck.AccessionNo).trim() ||
          valueText(risAck.AccessionNo).trim() === entry.target.accessionNo)
      const acceptedLocal = !failure && ack && ack.LocalSaved === true &&
        responseAccession === entry.target.accessionNo
      const accepted = deliveryConfirmed || acceptedLocal
      if (!accepted && !failure) {
        failure = valueText(risAck && risAck.TextMessage).trim() ||
          valueText(ack && ack.TextMessage).trim() ||
          (risCode ? 'RIS ตอบ ' + risCode : 'ยังไม่ได้ ACK ยืนยันการยกเลิกจาก RIS')
        const forwardError = valueText(ack && ack.ForwardError).trim()
        if (httpStatus) failure += ' · HTTP ' + httpStatus
        else if (forwardError) failure += ' · ' + forwardError
      }
      progress.push({
        item_id: valueText(entry.target.item._id).trim(),
        accession_no: entry.target.accessionNo,
        status: deliveryConfirmed ? 'confirmed' : acceptedLocal ? 'accepted_local' : 'failed',
        local_saved: acceptedLocal,
        ris_ack: risCode,
        forward_http_status: Number.isFinite(httpStatus) ? httpStatus : null,
        forward_error: valueText(ack && ack.ForwardError).trim(),
        message: accepted ? (deliveryConfirmed ? '' :
          valueText(ack && ack.TextMessage).trim() || 'API Order รับคำขอแล้ว แต่ยังส่งต่อ RIS ไม่สำเร็จ') : failure
      })
      await cancellationCollection.updateOne(
        { _id: orderObjectId, xrstatx: active },
        { $set: {
          ris_cancel: { status: accepted ? 'pending' : 'failed', attempts: attempts,
            at: now, items: progress },
          updated_at: now, updated_by: actorAudit
        } }
      )
      if (!accepted) {
        return {
          success: false,
          error: 'ris_cancel_failed',
          data: { accession_no: entry.target.accessionNo, ris_cancel: progress },
          message: 'API Order ยังไม่ยืนยันการรับคำขอยกเลิก Accession ' + entry.target.accessionNo +
            ' (' + failure + ') — HIS ยังไม่ยกเลิก กดซ้ำเพื่อส่ง IsDeleted:true อีกครั้ง'
        }
      }
    }
    await cancellationCollection.updateOne(
      { _id: orderObjectId, xrstatx: active },
      { $set: {
        ris_cancel: { status: progress.every(item => item.status === 'confirmed') ? 'confirmed' : 'accepted_local',
          attempts: attempts, at: now, items: progress },
        updated_at: now, updated_by: actorAudit
      } }
    )
  }

  let cancelledCount = 0
  for (let index = 0; index < cancellable.length; index += 1) {
    const target = cancellable[index]
    const saved = await itemCollection.updateOne(
      { _id: target.item._id, xrstatx: active, current_status: target.status },
      {
        $set: {
          current_status: 'cancelled',
          cancellation_record_id: cancellationId,
          cancel_type: 'xray_item_cancelled',
          cancel_reason: authoritativeReason,
          cancelled_at: authoritativeAt,
          cancelled_by: authoritativeBy,
          updated_at: now,
          updated_by: actorCode
        }
      }
    )
    if (!saved || Number(saved.matchedCount) !== 1) {
      await cancellationCollection.updateOne(
        { _id: orderObjectId, xrstatx: active },
        { $set: { cancel_status: 'conflict', conflict_item_id: target.itemId, updated_at: now, updated_by: actorAudit } }
      )
      return {
        success: false,
        error: 'cancel_race_lost',
        message: 'สถานะรายการเปลี่ยนระหว่างยกเลิก กรุณาโหลดใหม่แล้วลองอีกครั้ง'
      }
    }
    cancelledCount += 1
  }

  let auditSyncPending = false
  try {
    const stamped = await cancellationCollection.updateOne(
      /* 'reopened' อยู่ในชุดด้วยตั้งแต่ 2026-09-03 — ใบที่เคยกดตรวจใหม่แล้วถูกยกเลิกอีกครั้ง
         ต้องประทับ applied ได้ตามปกติ ไม่ใช่ค้างเป็น reconcile ทั้งที่ยกเลิกสำเร็จ */
      { _id: orderObjectId, xrstatx: active, cancel_status: { $in: ['pending', 'ris_pending', 'applied', 'reopened'] } },
      { $set: { cancel_status: 'applied', applied_at: now, updated_at: now, updated_by: actorAudit } }
    )
    auditSyncPending = !stamped || Number(stamped.matchedCount) !== 1
  } catch (error) {
    auditSyncPending = true
  }

  const upstreamItems = risPayloads.length
    ? progress.filter(item => item.status === 'accepted_local') : []
  const upstreamStatus = upstreamItems.map(item => item.forward_http_status)
    .filter(status => status != null).map(status => 'HTTP ' + status)
  const upstreamNote = upstreamItems.length
    ? ' · API Order รับคำขอยกเลิกแล้ว แต่ยังส่งต่อ RIS ไม่สำเร็จ' +
      (upstreamStatus.length ? ' (' + [...new Set(upstreamStatus)].join(', ') + ')' : '') +
      ' ทีม API Order ดูแลการส่งต่อต่อไป'
    : ''

  return {
    success: true,
    data: {
      order_id: orderId,
      order_number: orderNumber,
      current_status: xrayItems.some(item =>
        !selectedIds.includes(valueText(item._id).trim().toLowerCase()) &&
        !terminalStatuses.includes(valueText(item.current_status).trim().toLowerCase()))
        ? 'partially_cancelled' : 'cancelled',
      cancel_type: 'xray_item_cancelled',
      cancel_reason: authoritativeReason,
      cancelled_at: authoritativeAt,
      cancelled_by: authoritativeBy,
      item_count: cancelTargets.length,
      cancelled_item_count: cancelledCount,
      preserved_terminal_item_count: cancelTargets.length - cancelledCount,
      item_ids: cancelTargets.map(item => valueText(item._id).trim()),
      cancellation_record_id: cancellationId,
      already_cancelled: alreadyCancelled,
      audit_sync_pending: auditSyncPending,
      upstream_delivery_issue: upstreamItems.length > 0
    },
    message: auditSyncPending
      ? 'ยกเลิกรายการแล้ว แต่บันทึกการยกเลิกยังรอ reconcile' + upstreamNote
      : alreadyCancelled
        ? 'รายการที่เลือกถูกยกเลิกแล้ว' + upstreamNote
        : 'ยกเลิกรายการที่เลือกแล้ว' + upstreamNote
  }
}

/* คำศัพท์สถานะที่ห้องรังสี "มองเห็น" ได้
   **ไม่มี `draft` โดยตั้งใจ** — ใบที่แพทย์ยังร่างอยู่ยังไม่ได้กดส่ง จึงยังไม่ใช่คำสั่ง
   ห้องรังสีต้องไม่เห็นและนับมันด้วย (ผู้ใช้ยืนยัน 2026-09-01)
   ตัดที่นี่ที่เดียวก็พอ เพราะ statusVocabulary ถูกใช้เป็นด่านแรกของ pipeline
   ⇒ draft ไม่เข้าทั้ง buckets (chip) และ rows (ตาราง) พร้อมกัน */
const STATUS_VOCABULARY = {
  sent: 'waiting',
  ready: 'waiting',
  accepted: 'pending',
  prepared: 'pending',
  dispensed: 'pending',
  dispatched: 'pending',
  in_progress: 'pending',
  resulted: 'complete',
  completed: 'complete',
  cancelled: 'cancelled',
  rejected: 'cancelled',
  returned: 'cancelled',
  reversed: 'cancelled'
}
const statusVocabulary = Object.keys(STATUS_VOCABULARY)
const waitingStatuses = statusVocabulary.filter(status => STATUS_VOCABULARY[status] === 'waiting')
const cancelledStatuses = statusVocabulary.filter(status => STATUS_VOCABULARY[status] === 'cancelled')
const completeStatuses = statusVocabulary.filter(status => STATUS_VOCABULARY[status] === 'complete')

/* Origin unit is also used by the normal Worklist pipeline.  It is unrelated
   to queue routing and remains part of the existing X-ray visibility scope. */
const originUnitExpr = {
  $let: {
    vars: {
      sent_stage: {
        $arrayElemAt: [
          {
            $filter: {
              input: { $ifNull: ['$order.status_stage', []] },
              as: 'stage',
              cond: { $eq: ['$$stage.stage_status', 'sent'] }
            }
          },
          -1
        ]
      }
    },
    in: {
      $toUpper: {
        $ifNull: [
          '$order.xunitx.code',
          {
            $ifNull: [
              '$order.xunitx.unit_code',
              {
                $ifNull: [
                  { $cond: [{ $eq: [{ $type: '$order.xunitx' }, 'string'] }, '$order.xunitx', null] },
                  {
                    $ifNull: [
                      '$$sent_stage.stage_location.code',
                      { $ifNull: ['$$sent_stage.stage_location.value', ''] }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    }
  }
}

/* ── action: queue_tracking (read-only) ───────────────────────────────────
   This is deliberately separate from the native EMR queue panes.  It reads
   the latest Visit Tran under the radiology root and decorates that snapshot
   with X-ray order/result state.  It never calls a queue process and never
   writes Visit Tran, CPOE, or RIS data.

   Important semantic boundary:
   - current location comes from zdata_visit_tran.unit_to / room_to
   - "resulted" comes only from a non-empty RIS ResultText for every active
     X-ray item; queue status `done` is not treated as a radiology result. */
if (action === 'queue_tracking') {
  const nowText = typeof app.curDate === 'function' ? valueText(app.curDate()) : ''
  const trackingDate = validDate(valueText(params.date).trim())
    ? valueText(params.date).trim()
    : (validDate(nowText.slice(0, 10))
        ? nowText.slice(0, 10)
        : new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10))
  const trackingLimit = clampInt(params.limit, 500, 1, 1000)
  const radiologyRoots = configuredOrganizationRoots.length
    ? configuredOrganizationRoots
    : configuredOrganizations
  const terminalItemStatuses = ['cancelled', 'rejected', 'returned', 'reversed']
  /* A locally completed/resulted item without RIS ResultText is still waiting
     for the actual report, so it belongs to the middle state, never `resulted`. */
  const trackingExaminingStatuses = RECEIVED_STATUSES.concat(['resulted', 'completed'])

  const trackingPipeline = [
    {
      $match: {
        xrstatx: { $nin: [0, 3] },
        visit_date: trackingDate,
        'vid.value': { $ne: null },
        unit_path: { $in: radiologyRoots.concat(XRAY_ORGANIZATION_ROOT_CODES) }
      }
    },
    { $addFields: { _tracking_visit_id: { $toString: '$vid.value' } } },
    { $match: { _tracking_visit_id: { $ne: '' } } },
    { $sort: { checkin_at: -1, updated_at: -1, _id: -1 } },
    {
      $group: {
        _id: '$_tracking_visit_id',
        queue: { $first: '$$ROOT' }
      }
    },
    { $replaceRoot: { newRoot: '$queue' } },
    {
      $lookup: {
        from: ORDER_COLLECTION,
        let: { visit_id: '$vid.value' },
        pipeline: [
          {
            $match: {
              xrstatx: { $nin: [0, 3] },
              $expr: { $eq: [{ $toString: '$xparentx' }, { $toString: '$$visit_id' }] }
            }
          },
          { $project: { _id: 1, order_number: 1, created_at: 1 } }
        ],
        as: '_tracking_orders'
      }
    },
    {
      $lookup: {
        from: ITEM_COLLECTION,
        let: {
          order_ids: {
            $map: {
              input: { $ifNull: ['$_tracking_orders', []] },
              as: 'order',
              in: { $toString: '$$order._id' }
            }
          }
        },
        pipeline: [
          {
            $match: {
              xrstatx: { $nin: [0, 3] },
              'service_type.value': XRAY_SERVICE_TYPE,
              current_status: { $in: statusVocabulary },
              $expr: {
                $in: [
                  { $toString: { $ifNull: ['$order_id.value', '$xparentx'] } },
                  '$$order_ids'
                ]
              }
            }
          },
          {
            $lookup: {
              from: RESULT_COLLECTION,
              let: { accession: '$accession_no' },
              pipeline: [
                {
                  $match: {
                    xrstatx: { $nin: [0, 3] },
                    $expr: {
                      $and: [
                        { $ne: [{ $ifNull: ['$$accession', ''] }, ''] },
                        { $eq: ['$AccessionNo', '$$accession'] }
                      ]
                    }
                  }
                },
                { $sort: { ResultDateTime: -1, xupdatx: -1, _id: -1 } },
                { $limit: 1 },
                { $project: { _id: 0, ResultText: 1, ResultDateTime: 1 } }
              ],
              as: '_tracking_result'
            }
          },
          {
            $addFields: {
              _tracking_latest_result: {
                $arrayElemAt: [{ $ifNull: ['$_tracking_result', []] }, 0]
              }
            }
          },
          {
            $project: {
              _id: 0,
              item_id: { $toString: '$_id' },
              item_code: 1,
              item_name: 1,
              current_status: 1,
              accession_no: 1,
              dispatched_at: 1,
              resulted_at: '$_tracking_latest_result.ResultDateTime',
              has_result: {
                $ne: [
                  { $trim: { input: { $ifNull: ['$_tracking_latest_result.ResultText', ''] } } },
                  ''
                ]
              }
            }
          }
        ],
        as: '_tracking_items'
      }
    },
    {
      $addFields: {
        _tracking_active_items: {
          $filter: {
            input: { $ifNull: ['$_tracking_items', []] },
            as: 'item',
            cond: { $not: [{ $in: ['$$item.current_status', terminalItemStatuses] }] }
          }
        }
      }
    },
    {
      $addFields: {
        _tracking_resulted_count: {
          $size: {
            $filter: {
              input: '$_tracking_active_items',
              as: 'item',
              cond: { $eq: ['$$item.has_result', true] }
            }
          }
        },
        _tracking_examining_count: {
          $size: {
            $filter: {
              input: '$_tracking_active_items',
              as: 'item',
              cond: { $in: ['$$item.current_status', trackingExaminingStatuses] }
            }
          }
        }
      }
    },
    {
      $addFields: {
        _tracking_state: {
          $switch: {
            branches: [
              {
                case: {
                  $and: [
                    { $gt: [{ $size: '$_tracking_active_items' }, 0] },
                    { $eq: ['$_tracking_resulted_count', { $size: '$_tracking_active_items' }] }
                  ]
                },
                then: 'resulted'
              },
              {
                case: {
                  $or: [
                    { $in: ['$vtran_status', ['in_progress', 'done']] },
                    { $gt: ['$_tracking_examining_count', 0] }
                  ]
                },
                then: 'examining'
              }
            ],
            default: 'waiting'
          }
        }
      }
    },
    { $sort: { queue_ts: 1, checkin_at: 1, _id: 1 } },
    { $limit: trackingLimit },
    {
      $project: {
        _id: 0,
        tran_id: { $toString: '$_id' },
        visit_id: '$_tracking_visit_id',
        visit_date: 1,
        queue_label: 1,
        queue_no: 1,
        queue_ts: 1,
        checkin_at: 1,
        checkout_at: 1,
        start_at: 1,
        vtran_status: 1,
        unit_from: 1,
        unit_to: 1,
        room_to: 1,
        patient: {
          hn: '$vid.pid.hn',
          vn: '$vid.vn',
          prename: '$vid.pid.prename',
          first_name: '$vid.pid.p_fname',
          last_name: '$vid.pid.p_lname',
          gender: '$vid.pid.p_gender',
          age: '$vid.pid.age',
          picture: '$vid.pid.p_pic'
        },
        work_state: '$_tracking_state',
        items: '$_tracking_active_items',
        item_count: { $size: '$_tracking_active_items' },
        resulted_item_count: '$_tracking_resulted_count'
      }
    }
  ]

  let rows = []
  try {
    const found = await app.dbFindAll(
      {
        from: VISIT_TRAN_COLLECTION,
        nosql: {
          type: 'aggregate',
          collections: [VISIT_TRAN_COLLECTION],
          pipeline: trackingPipeline
        }
      },
      false,
      false
    )
    if (!found || found.success === false) throw new Error('query rejected')
    rows = found.reply && Array.isArray(found.reply.data) ? found.reply.data : []
  } catch (error) {
    return {
      success: false,
      message: 'อ่านข้อมูลติดตามคิว X-ray ไม่สำเร็จ: ' + String((error && error.message) || error)
    }
  }

  const stateCounts = { all: rows.length, waiting: 0, examining: 0, resulted: 0 }
  rows.forEach(row => {
    const state = valueText(row && row.work_state).trim()
    if (Object.prototype.hasOwnProperty.call(stateCounts, state)) stateCounts[state] += 1
    const unitLabel = valueText(row && row.unit_to && row.unit_to.label).trim()
    const roomLabel = valueText(row && row.room_to && row.room_to.label).trim()
    row.location_label = [unitLabel, roomLabel].filter(Boolean).join(' · ') || 'ยังไม่ระบุตำแหน่ง'
    row.location_note = valueText(row && row.unit_from && row.unit_from.label).trim()
      ? 'รับต่อจาก ' + valueText(row.unit_from.label).trim()
      : 'ตำแหน่งล่าสุดจากระบบคิวกลาง'
    row.route = []
    if (valueText(row && row.unit_from && row.unit_from.label).trim()) {
      row.route.push({ label: valueText(row.unit_from.label).trim(), at: '' })
    }
    row.route.push({ label: row.location_label, at: valueText(row && row.checkin_at).trim(), current: true })
  })

  return {
    success: true,
    data: {
      rows,
      total: rows.length,
      counts: stateCounts,
      date: trackingDate,
      read_only: true,
      organization_code: organizationCode
    }
  }
}

if (action !== 'list') {
  return { success: false, message: 'ไม่รองรับ action นี้' }
}

/* ── action: list ───────────────────────────────────────────────────────── */

const requestedStatuses = listText(params.statuses || params.status).map(status => status.toLowerCase())
const statuses = (requestedStatuses.length ? requestedStatuses : statusVocabulary)
  .filter(status => STATUS_VOCABULARY[status])

if (!statuses.length) {
  return { success: false, message: 'ไม่พบสถานะที่รองรับในคำขอ' }
}

const hn = valueText(params.hn).trim()
const citizenId = valueText(params.citizen_id).trim()
const query = valueText(params.q || params.keyword).trim()
const queryIsCitizenId = /^\d{13}$/.test(query)
/* หน้าจอเดิมส่ง q+hn คู่กันเมื่อพิมพ์รหัสที่มีตัวเลข จึงห้ามให้ HN prefilter
   ตัด AN/เลขบัตรทิ้งก่อนถึงตัวค้นหา ส่วนโหมดสแกนส่ง hn อย่างเดียวและยัง exact เหมือนเดิม */
const queryAlsoSentAsHn = !!query && query === hn
const dateFrom = valueText(params.date_from).trim()
const dateTo = valueText(params.date_to).trim()
/* เลือกเครื่องได้หลายตัว (ผู้ใช้ขอ 2026-09-02) — รับได้ทั้ง array, CSV และค่าเดี่ยว
   ค่าเดี่ยวเดิมยังทำงานเหมือนเดิมทุกประการ เป็นการเพิ่มความสามารถ ไม่ใช่เปลี่ยนสัญญา */
const requestedModalities = listText(params.modality || params.modalities)
  .map(code => code.toUpperCase())
  .filter(Boolean)
/* คงชื่อเดิมไว้เพื่อไม่ให้ผู้เรียกเก่าและ response เดิมพัง — เลือกตัวเดียวได้ค่าเท่าเดิม */
const requestedModality = requestedModalities.join(',')

/* ── ผู้ใช้เลือกลำดับการจัดเรียงเองได้ (ผู้ใช้ขอ 2026-09-25 · TOR §3.4.3.1) ───
   ก่อนหน้านี้เรียงตายตัวใหม่→เก่า · เพิ่มแบบ additive:
     latest (ค่าเริ่มต้น) = คีย์เดิมทุกตัวทุกทิศทาง ⇒ ไม่ส่ง sort มา = พฤติกรรมเดิมเป๊ะ
     oldest              = กลับทิศของคีย์ชุดเดียวกัน เก่าสุดขึ้นก่อน
   ค่าที่ไม่รู้จักตกกลับ latest แบบ fail-closed ไม่ทำให้คำขอล้ม
   หมายเหตุแกนเวลา: status_at มี $ifNull กลับไปที่ requested_at อยู่แล้ว
   ⇒ ใบที่ยังไม่มีความเคลื่อนไหวหลังสั่ง คีย์นี้คือ "เวลาสั่ง" ตรงตัว */
const SORT_SPECS = {
  latest: { status_at: -1, requested_at: -1, order_number: -1 },
  oldest: { status_at: 1, requested_at: 1, order_number: 1 }
}
const requestedSort = valueText(params.sort || params.sort_by).trim().toLowerCase()
const sortKey = SORT_SPECS[requestedSort] ? requestedSort : 'latest'
const sortSpec = SORT_SPECS[sortKey]

if ((dateFrom && !validDate(dateFrom)) || (dateTo && !validDate(dateTo))) {
  return { success: false, message: 'date_from/date_to ต้องเป็น YYYY-MM-DD' }
}
if (citizenId && !/^\d{13}$/.test(citizenId)) {
  return { success: false, message: 'citizen_id ต้องเป็นเลข 13 หลัก' }
}

/*
 * แกนของ Date Range คือ "เวลาของสถานะ" ไม่ใช่เวลาสร้างใบ (Xray_design.md §7)
 *   รอรับ → เวลาสั่ง · ส่งเครื่องแล้ว → เวลาส่งเครื่อง · ออกผล → เวลาออกผล · ยกเลิก → เวลายกเลิก
 * ค่าเริ่มต้นคือวันปัจจุบัน ยกเว้นการค้นด้วย HN แบบตรงตัวซึ่งต้องดึงประวัติข้ามวันได้
 * (Appendix B) — ค่าที่ใช้จริงถูกคืนกลับใน data.date_scope ให้ UI บอกผู้ใช้ได้
 *
 * **ค่าเริ่มต้นต้องไม่ซ่อนงานค้าง** (แก้ 2026-09-02) — ใบที่สั่งเมื่อวานแล้วยังไม่ได้ถ่าย
 * ต้องยังอยู่บนจอเช้าวันถัดไป ไม่ใช่หายไปตอนเที่ยงคืนแล้วไม่มีใครรู้ว่าคนไข้ตกค้าง
 * ⇒ ค่าเริ่มต้นเดิม = วันนี้ **หรือ** งานที่ยังไม่จบ (bucket waiting/pending) ไม่ว่าจะวันไหน
 * ถ้าผู้ใช้เลือกช่วงวันเอง ให้ยึดตามที่เลือกเป๊ะ ๆ ไม่แถมงานค้างเข้าไป
 */
const today = valueText(app.curDate()).trim().slice(0, 10)
const scopeDefaulted = !dateFrom && !dateTo && !hn && !citizenId && !queryIsCitizenId && validDate(today)
const scopeFrom = scopeDefaulted ? today : dateFrom
const scopeTo = scopeDefaulted ? today : dateTo

const skip = (page - 1) * limit
const itemMatch = {
  xrstatx: { $nin: [0, 3] },
  'service_type.value': XRAY_SERVICE_TYPE,
  current_status: { $in: statusVocabulary }
}

const orderMatch = { 'order.xrstatx': { $nin: [0, 3] } }
if (hn && !queryAlsoSentAsHn) orderMatch['order.vid.pid.hn'] = hn
/* deep link จากคิว — กางเฉพาะใบของ visit นั้น (เพิ่ม 2026-09-08)
   ใช้ exact match ไม่ใช่ regex ผ่าน q เพราะ VN ที่เป็น prefix ของอีก VN จะติดมาด้วย
   ผู้เรียกเดิมที่ไม่ส่ง visit_id ได้ผลลัพธ์เท่าเดิมทุกประการ */
const listVisitId = valueText(params.visit_id).trim()
if (listVisitId) {
  if (!/^[a-f0-9]{24}$/i.test(listVisitId)) {
    return { success: false, error: 'invalid_visit_id', message: 'visit_id ไม่ถูกต้อง' }
  }
  /* 🔴 เทียบเป็นสตริงทั้งสองฝั่ง — `xparentx` ในชุดข้อมูลนี้เป็น ObjectId หรือ string
     ก็ได้แล้วแต่ที่มาของใบ (โค้ดเดิมมี $lookup ทั้งสองแบบอยู่ในไฟล์นี้เพราะเหตุนี้)
     ของเดิมยัด app.dbObjectId() ลงไปตรง ๆ ⇒ ใบที่เก็บเป็น string จะไม่ match เลย
     แล้วหน้าจอขึ้น "ไม่พบใบสั่ง X-ray ของ VN นี้" ทั้งที่ใบมีอยู่จริง
     (ผู้ใช้เจอจริง 2026-09-08) */
  orderMatch.$expr = { $eq: [{ $toString: '$order.xparentx' }, listVisitId] }
}

const lastStage = statusList => ({
  $arrayElemAt: [
    {
      $filter: {
        input: { $ifNull: ['$status_stage', []] },
        as: 'stage',
        cond: { $in: ['$$stage.stage_status', statusList] }
      }
    },
    -1
  ]
})

const pipeline = [
  { $match: itemMatch },
  {
    $lookup: {
      from: ITEM_MASTER_COLLECTION,
      localField: 'item_data_id',
      foreignField: '_id',
      as: 'master'
    }
  },
  { $unwind: { path: '$master', preserveNullAndEmptyArrays: true } },
  {
    $addFields: {
      route_section: {
        $ifNull: [
          '$section_snapshot',
          { $ifNull: ['$xray_context_snapshot.section', '$master.section'] }
        ]
      },
      order_ref_id: { $ifNull: ['$order_id.value', '$xparentx'] }
    }
  },
  {
    $lookup: {
      from: SECTION_COLLECTION,
      localField: 'route_section.value',
      foreignField: '_id',
      as: 'section_master'
    }
  },
  { $unwind: { path: '$section_master', preserveNullAndEmptyArrays: true } },
  { $addFields: { resolved_section: { $ifNull: ['$section_master', '$route_section'] } } },
  {
    /* เครื่องมาจาก master.xray_item.modality เป็นทางหลัก (ผู้ใช้ยืนยัน 2026-08-31)
       ทางสำรองไล่ลงไปเผื่อ schema ต่าง · รองรับทั้งค่าเก็บเป็น string และ {value,label} */
    $addFields: {
      modality_raw: {
        $ifNull: [
          '$master.xray_item.modality.value',
          {
            $ifNull: [
              '$master.xray_item.modality',
              {
                $ifNull: [
                  '$master.xray_item.modality_type',
                  { $ifNull: ['$resolved_section.modality_type', ''] }
                ]
              }
            ]
          }
        ]
      }
    }
  },
  {
    $addFields: {
      modality_code: {
        $let: {
          vars: { raw: '$modality_raw' },
          in: {
            $cond: [
              { $eq: [{ $type: '$$raw' }, 'string'] },
              { $toUpper: { $trim: { input: '$$raw' } } },
              ''
            ]
          }
        }
      },
      dispatch_stage: lastStage(['accepted', 'dispensed', 'dispatched', 'in_progress']),
      cancel_stage: lastStage(['cancelled', 'rejected', 'returned', 'reversed']),
      result_stage: lastStage(['resulted', 'completed'])
    }
  },
  {
    /* ผลอ่านล่าสุดของ accession นี้ · เรียงด้วย ResultDateTime แล้วค่อย xupdatx
       เผื่อสองฉบับมีเวลาผลเท่ากัน จะได้หยิบแถวที่เขียนทีหลังเสมอ ไม่สุ่ม

       🔴 แก้บั๊ก 2026-09-17: ของเดิมเขียน '$accession' และ '$ROOT' ดอลลาร์เดียว
       ตัวแปรที่ประกาศใน let ต้องอ้างด้วย **$$** — ดอลลาร์เดียวคือ "ฟิลด์ชื่อนั้น
       ในเอกสารของตารางปลายทาง" ซึ่ง zdata_xray_result ไม่มี ⇒ เงื่อนไขแรก
       ($ne ของค่าว่าง) เป็นเท็จเสมอ ⇒ **lookup นี้ไม่เคย match อะไรเลยสักแถว**
       ผลคือ ris_result ว่างตลอด ⇒ result_text/resulted_at ที่ส่งให้ฟอร์มว่างตลอด
       ⇒ ตารางไม่เคยขึ้น "ออกผลแล้ว" และช่องเวลาออกผลว่างตลอด ทั้งที่มีผลอยู่จริง
       (ป๊อปอัป "ดูผล" ยังเห็นผลเพราะ get_report ยิง .find() ตรง ไม่ผ่าน lookup นี้
        และชิป RIS ยังขึ้นเพราะ lookup ของ zdata_xray_order ข้างล่างเขียน $$ ถูก)
       ⇒ อาการที่ผู้ใช้แจ้งตั้งแต่ 2026-09-15 มาจากตรงนี้ที่เดียว */
    $lookup: {
      from: RESULT_COLLECTION,
      let: { accession: '$accession_no' },
      pipeline: [
        {
          $match: {
            xrstatx: { $nin: [0, 3] },
            $expr: {
              $and: [
                { $ne: [{ $ifNull: ['$$accession', ''] }, ''] },
                { $eq: ['$AccessionNo', '$$accession'] }
              ]
            }
          }
        },
        { $sort: { ResultDateTime: -1, xupdatx: -1, _id: -1 } },
        {
          $group: {
            _id: null,
            latest: { $first: '$$ROOT' },
            versions: { $sum: 1 }
          }
        }
      ],
      as: 'ris_result'
    }
  },
  { $unwind: { path: '$ris_result', preserveNullAndEmptyArrays: true } },
  {
    /* สถานะล่าสุดที่ RIS แจ้งกลับสำหรับ accession นี้ (เพิ่ม 2026-09-09)
       ไม่มีแถว = RIS ยังไม่เคยแจ้ง ⇒ preserveNull ไว้ ค่าจะเป็น null และหน้าจอไม่โชว์
       ไม่ทำให้รายการหายแม้แต่ใบเดียว เพราะเป็น lookup ที่ไม่ได้ตามด้วย $match */
    $lookup: {
      from: XRAY_RIS_ORDER_COLLECTION,
      let: { accession: '$accession_no' },
      pipeline: [
        {
          $match: {
            xrstatx: { $nin: [0, 3] },
            $expr: {
              $and: [
                { $ne: [{ $ifNull: ['$$accession', ''] }, ''] },
                { $eq: ['$AccessionNo', '$$accession'] }
              ]
            }
          }
        },
        { $sort: { updated_at: -1, _id: -1 } },
        { $limit: 1 },
        { $project: { _id: 0, Status: 1, ImageCapturedDateTime: 1, updated_at: 1 } }
      ],
      as: '_ris_order'
    }
  },
  { $addFields: { ris_order: { $arrayElemAt: [{ $ifNull: ['$_ris_order', []] }, 0] } } },
  {
    /* **สถานะที่ใช้จริง** — RIS เขียนผลลงตารางของมัน ไม่ได้แตะ current_status ของเรา
       ถ้าปล่อยให้ chip นับจาก current_task เดิม chip จะบอก "รอผลอ่าน" ขณะที่แถวบอก
       "ออกผลครบ" — ตัวเลขขัดกับสิ่งที่ตาเห็นทันทีที่ผลแรกเข้ามา

       ── เปลี่ยน 2026-09-16 ตามคำสั่งผู้ใช้: ตัดการเทียบเวลาออก ──────────────
       ของเดิม (2026-09-02) บังคับว่าผลต้อง **ไม่เก่ากว่า dispatched_at** ด้วย
       เพื่อกันผลของรอบก่อนหลุดมาปนรอบที่ส่งใหม่ — ตอนนั้นจำเป็น เพราะ "ส่งตรวจซ้ำ"
       ยังใช้เลข Accession เดิม เวลาจึงเป็นทางเดียวที่แยกรอบได้

       2026-09-03 ผู้ใช้สั่งให้ส่งตรวจซ้ำ/ตรวจใหม่ **ออกเลข Accession ใหม่เสมอ**
       ⇒ รอบใหม่ = เลขใหม่ · และเรา join ผลด้วย AccessionNo อยู่แล้ว
       ⇒ ผลที่เจอใต้เลขปัจจุบันเป็นของรอบนี้โดยนิยาม การเทียบเวลาเหลือแต่ false negative
       (ยืนยันกับข้อมูลจริง 2026-09-16: ทุกใบที่มีผลถูกกติกานี้ตัดหมด เพราะ RIS ส่ง
        ResultDateTime เป็นเวลาที่ตรวจจริงตอนเช้า แต่เรากดส่งเข้าเครื่องตอนบ่าย)
       🔴 เส้นแบ่งรอบคือ **เลข Accession** ไม่ใช่เวลา — ถ้าวันหนึ่งกลับไปใช้เลขเดิมซ้ำ
          ต้องเอากติกานี้กลับมา */
    $addFields: {
      effective_status: {
        $cond: [
          { $ne: [{ $ifNull: ['$ris_result.latest.ResultText', ''] }, ''] },
          'resulted',
          '$current_status'
        ]
      }
    }
  },
  {
    $lookup: {
      from: ORDER_COLLECTION,
      localField: 'order_ref_id',
      foreignField: '_id',
      as: 'order'
    }
  },
  { $unwind: { path: '$order', preserveNullAndEmptyArrays: false } },
  { $match: orderMatch },
  { $addFields: { origin_unit_code: originUnitExpr } },
  { $sort: { 'order.created_at': -1, created_at: 1, item_no: 1, item_code: 1 } },
  {
    $group: {
      _id: '$order._id',
      order: { $first: '$order' },
      origin_unit: { $first: '$origin_unit_code' },
      modality_codes: { $addToSet: '$modality_code' },
      /* bucket ของ chip คิดจากสถานะที่ใช้จริง ไม่ใช่ค่าดิบใน CPOE */
      statuses: { $addToSet: '$effective_status' },
      items: {
        $push: {
          item_id: { $toString: '$_id' },
          item_code: '$item_code',
          item_name: '$item_name',
          quantity: '$quantity',
          current_status: '$current_status',
          effective_status: '$effective_status',
          item_master_id: { $toString: '$item_data_id' },
          modality: { code: '$modality_code' },
          body_part: { $ifNull: ['$master.xray_item.body_path', '$master.xray_item.bordy_path'] },
          section: {
            id: { $toString: '$resolved_section._id' },
            code: '$resolved_section.code',
            name: '$resolved_section.name',
            name_th: '$resolved_section.name_th'
          },
          /* เขียนโดย xray-accession-generate ตอนกดส่งเข้าเครื่อง */
          accession_no: '$accession_no',
          /* ผลอ่านจาก RIS — ฟอร์มใช้ result_text เป็นตัวตัดสินว่า "ออกผลแล้ว" หรือยัง
             ไม่ได้ดูจาก current_status เพราะ RIS ไม่ได้เขียน CPOE item ให้เรา */
          result_text: '$ris_result.latest.ResultText',
          result_status: '$ris_result.latest.Status',
          result_versions: { $ifNull: ['$ris_result.versions', 0] },
          radiologist_uid: '$ris_result.latest.RadiologistUid',
          severity_uid: '$ris_result.latest.SeverityUid',
          image_captured_at: '$ris_result.latest.ImageCapturedDateTime',
          /* สถานะที่ RIS แจ้งกลับ (A=Arrival · C=Completed) — เพิ่ม 2026-09-09
             เป็นข้อมูลแสดงผลล้วน ไม่ได้ใช้ตัดสิน bucket/chip ซึ่งยังคิดจากของเดิมทุกประการ */
          ris_order_status: { $ifNull: ['$ris_order.Status', ''] },
          ris_order_status_at: { $ifNull: ['$ris_order.updated_at', ''] },
          ris_order_captured_at: { $ifNull: ['$ris_order.ImageCapturedDateTime', ''] },
          dispatched_at: { $ifNull: ['$dispatched_at', '$dispatch_stage.stage_at'] },
          dispatched_by: { $ifNull: ['$dispatched_by', '$dispatch_stage.stage_by'] },
          /* Radiographer (ผู้ถ่าย) ที่ห้องรังสีเลือกเอง — คนละเรื่องกับ dispatched_by
             ซึ่งเป็นบัญชีที่กดปุ่มส่งเข้าเครื่อง · เขียนโดย action set_staff (2026-09-03) */
          radiographer: '$radiographer',
          radiographer_at: '$radiographer_at',
          radiographer_source: '$radiographer_source',
          radiographer_member_id: '$radiographer_member_id',
          /* Radiologist ที่เลือกจาก master หรือพิมพ์แพทย์ภายนอกใน Worklist */
          radiologist: '$radiologist',
          radiologist_at: '$radiologist_at',
          radiologist_source: '$radiologist_source',
          radiologist_member_id: '$radiologist_member_id',
          transport: '$transport',
          performed_at: { $ifNull: ['$ris_result.latest.ImageCapturedDateTime', '$performed_at'] },
          /* เวลาออกผลจริงมาจาก RIS ก่อนเสมอ ค่าใน CPOE เป็นทางสำรองของข้อมูลเก่า */
          resulted_at: {
            $ifNull: [
              '$ris_result.latest.ResultDateTime',
              { $ifNull: ['$resulted_at', '$result_stage.stage_at'] }
            ]
          },
          cancelled_at: { $ifNull: ['$cancelled_at', '$cancel_stage.stage_at'] },
          /* ตรวจใหม่ใช้ Order เดิมแต่เริ่มรอบรอรับใหม่ — Date Range ต้องเห็นเวลารอบนี้ */
          retest_at: '$retest_at',
          cancelled_by: { $ifNull: ['$cancelled_by', '$cancel_stage.stage_by'] },
          cancel_reason: { $ifNull: ['$cancel_reason', '$cancel_stage.stage_reason'] },
          /* เขียนโดย xray-cpoe-reject — ปฏิเสธระดับ item แบบเดียวกับ LAB */
          rejected_at: '$rejected_at',
          rejected_by: '$rejected_by',
          reject_reason_code: '$reject_reason_code',
          reject_reason_detail: '$reject_reason_detail',
          reject_reason: '$reject_reason'
        }
      }
    }
  },
  {
    /* 1 order = 1 test ⇒ สถานะใบเท่ากับสถานะ test นั้น (Xray_design.md Appendix A.3) */
    $addFields: {
      requested_at: {
        $let: {
          vars: {
            sent_stage: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: { $ifNull: ['$order.status_stage', []] },
                    as: 'stage',
                    cond: { $eq: ['$$stage.stage_status', 'sent'] }
                  }
                },
                -1
              ]
            }
          },
          in: { $ifNull: ['$$sent_stage.stage_at', '$order.created_at'] }
        }
      },
      bucket: {
        $let: {
          vars: {
            live: {
              $filter: {
                input: '$statuses',
                as: 'status',
                cond: { $not: [{ $in: ['$$status', cancelledStatuses] }] }
              }
            }
          },
          in: {
            $cond: [
              { $eq: [{ $size: '$$live' }, 0] },
              'cancelled',
              {
                $cond: [
                  {
                    $eq: [
                      {
                        $size: {
                          $filter: {
                            input: '$$live',
                            as: 'status',
                            cond: { $not: [{ $in: ['$$status', completeStatuses] }] }
                          }
                        }
                      },
                      0
                    ]
                  },
                  'complete',
                  {
                    $cond: [
                      {
                        $eq: [
                          {
                            $size: {
                              $filter: {
                                input: '$$live',
                                as: 'status',
                                cond: { $not: [{ $in: ['$$status', waitingStatuses] }] }
                              }
                            }
                          },
                          0
                        ]
                      },
                      'waiting',
                      'pending'
                    ]
                  }
                ]
              }
            ]
          }
        }
      }
    }
  },
  {
    $addFields: {
      status_at: {
        $switch: {
          branches: [
            { case: { $eq: ['$bucket', 'cancelled'] }, then: { $max: '$items.cancelled_at' } },
            { case: { $eq: ['$bucket', 'complete'] }, then: { $max: '$items.resulted_at' } },
            /* หลังตรวจใหม่ dispatched_at ถูกล้าง; ถ้าส่งเข้าเครื่องอีกครั้งก็ใช้เวลาส่ง
               รอบใหม่ที่ใหม่กว่า retest_at. ใช้ max ไม่ใช้ min เพราะ Order อาจมี sibling
               ที่ส่งเข้าเครื่องตั้งแต่วันเก่าและยังอยู่ในใบเดียวกัน */
            {
              case: { $gt: [{ $max: '$items.retest_at' }, null] },
              then: { $max: [{ $max: '$items.retest_at' }, { $max: '$items.dispatched_at' }] }
            },
            {
              case: { $gt: [{ $max: '$items.dispatched_at' }, null] },
              then: { $min: '$items.dispatched_at' }
            }
          ],
          default: '$requested_at'
        }
      }
    }
  },
  {
    $project: {
      _id: 0,
      order_id: { $toString: '$_id' },
      order_number: '$order.order_number',
      current_status: '$order.current_status',
      bucket: 1,
      modality_codes: 1,
      /* ยูนิตต้นทางของใบ — ใช้ตัดสินว่าใบนี้ต้องผ่านคิวก่อนหรือไม่
         และคืนกลับไปให้หน้าจอ/ผู้ดูแลตรวจได้ว่าอ่านค่าออกมาเป็นอะไร */
      origin_unit: 1,
      requested_at: 1,
      status_at: { $ifNull: ['$status_at', '$requested_at'] },
      status_date: {
        $substrCP: [{ $toString: { $ifNull: ['$status_at', { $ifNull: ['$requested_at', ''] }] } }, 0, 10]
      },
      priority: '$order.priority',
      patient: {
        hn: '$order.vid.pid.hn',
        prename: '$order.vid.pid.prename',
        first_name: '$order.vid.pid.p_fname',
        last_name: '$order.vid.pid.p_lname',
        age: '$order.vid.pid.age',
        birth_date: '$order.vid.pid.birth_date',
        gender_text: '$order.vid.gender_text'
      },
      visit: {
        visit_id: { $toString: '$order.xparentx' },
        vn: '$order.vid.vn',
        an: '$order.vid.an',
        visit_date: '$order.vid.visit_date',
        clinic: '$order.vid.visit_clinic',
        ward: '$order.vid.ward',
        bed: '$order.vid.bed'
      },
      emr_context: {
        visit_id: { $toString: '$order.xparentx' },
        vn: '$order.vid.vn'
      },
      /* ไม่ toString — ต้องเทียบชนิดเดียวกับ zdata_diagnosis.vid.value ใน $lookup
         ตัวเดียวกันนี้ใช้ join แบบประเมินราย visit (แพ้ยา) ด้วย */
      _diagnosis_visit_id: '$order.xparentx',
      /* คนไข้เจ้าของ visit — ประวัติการแพ้ยาอยู่ที่ zdata_person ไม่ได้อยู่ใน pid snapshot */
      _person_id: '$order.vid.pid.value',
      requester: {
        cosign_user: '$order.cosign_user',
        visit_doctor: '$order.vid.visit_doctor'
      },
      finance: {
        total_amount: '$order.total_amount',
        claim_amount: '$order.claim_amount',
        paid_amount: '$order.paid_amount',
        coverage: '$order.inscl_hos'
      },
      order_comment: '$order.order_comment',
      items: 1,
      item_count: { $size: '$items' }
    }
  }
]

if (scopeFrom || scopeTo) {
  const range = {}
  if (scopeFrom) range.$gte = scopeFrom
  if (scopeTo) range.$lte = scopeTo
  /* 🔴 เปลี่ยนตามคำสั่งผู้ใช้ 2026-09-08: "รายการในวันนั้นจะต้องรีทุกวันตาม patient"
     ⇒ ใช้กติกาเดียวกับ LAB (lab_cpoe_worklist_api.js · ผู้ใช้สั่งไว้ 2026-09-07):
     ไม่ส่งช่วงวันที่ = เห็นเฉพาะวันปัจจุบัน จบวันแล้วรีเซ็ต

     ของเดิม (2026-09-02) แถวที่ยัง active ของวันก่อนหน้าถูกแถมเข้ามาเสมอ เพื่อไม่ให้
     ใบที่สั่งเมื่อวานแล้วยังไม่ได้ถ่ายหายไปเงียบ ๆ — **ตอนนี้มันจะหายจริง**
     ทางออกเดิมยังอยู่ครบ ไม่ได้ถูกตัด: ค้นด้วย HN แบบตรงตัว (สแกนหรือพิมพ์เลข)
     จะข้ามช่วงวันที่ให้เอง หรือเลือก Date Range ย้อนหลังเองก็ได้
     เป็น read filter ล้วน ไม่มีการลบ/แก้ Order · Item · Outbound · Result ใด ๆ */
  pipeline.push({ $match: { status_date: range } })
}

/* p_cid อยู่ที่ zdata_person ไม่อยู่ใน vid.pid snapshot; join เฉพาะการค้นเลขบัตร
   หลัง scope/date/visibility gate แต่ก่อน facet เพื่อให้ rows, total และ counts ใช้ชุดเดียวกัน
   โหมดสแกน citizen_id ต้อง match เลขบัตรตรงตัว ส่วน q 13 หลักยังเป็น free-text ตามเดิม
   ใบ CPOE จริงบางใบมี vid.pid.hn แต่ไม่มี vid.pid.value จึง fallback ด้วย HN ที่ตรงกัน
   ไม่ส่งเลขบัตรหรือเอกสาร person ออกไปที่ client */
const searchCitizenId = citizenId || (queryIsCitizenId ? query : '')
if (searchCitizenId) {
  pipeline.push({
    $lookup: {
      from: PERSON_COLLECTION,
      let: { person_id: '$_person_id', patient_hn: '$patient.hn' },
      pipeline: [
        {
          $match: {
            xrstatx: { $nin: [0, 3] },
            p_cid: searchCitizenId,
            $expr: {
              $or: [
                { $eq: [{ $toString: '$_id' }, { $toString: '$$person_id' }] },
                {
                  $and: [
                    { $ne: ['$$patient_hn', ''] },
                    { $eq: ['$hn', '$$patient_hn'] }
                  ]
                }
              ]
            }
          }
        },
        { $limit: 1 },
        { $project: { _id: 1 } }
      ],
      as: '_citizen_search_person'
    }
  })
  if (citizenId) pipeline.push({ $match: { '_citizen_search_person.0': { $exists: true } } })
}

if (query) {
  const pattern = escapeRegex(query)
  pipeline.push({
    $match: {
      $or: [
        { order_number: { $regex: pattern, $options: 'i' } },
        { 'patient.hn': queryAlsoSentAsHn ? hn : { $regex: pattern, $options: 'i' } },
        { 'visit.vn': { $regex: pattern, $options: 'i' } },
        { 'visit.an': { $regex: pattern, $options: 'i' } },
        { 'items.item_code': { $regex: pattern, $options: 'i' } },
        { 'items.item_name': { $regex: pattern, $options: 'i' } },
        { 'items.accession_no': { $regex: pattern, $options: 'i' } },
        ...(queryIsCitizenId ? [{ '_citizen_search_person.0': { $exists: true } }] : []),
        {
          $expr: {
            $regexMatch: {
              input: {
                $concat: [
                  { $ifNull: ['$patient.first_name', ''] },
                  ' ',
                  { $ifNull: ['$patient.last_name', ''] }
                ]
              },
              regex: pattern,
              options: 'i'
            }
          }
        }
      ]
    }
  })
}

/*
 * ตัวกรองเครื่องอยู่ใน facet ของ rows/meta/buckets เท่านั้น
 * facet modality_counts จึงยังเห็นทุกเครื่อง — ไม่งั้น dropdown จะเหลือค่าเดียวหลังเลือก
 * ส่วนตัวกรองสถานะอยู่ใน rows/meta เท่านั้น เพื่อให้ chip นับได้ครบทุกช่องพร้อมกัน
 */
const modalityMatch = requestedModalities.length
  ? [{ $match: { modality_codes: { $in: requestedModalities } } }]
  : []
/* กรองด้วยสถานะที่ใช้จริงเช่นกัน ไม่งั้นกด chip "ออกผลครบ" แล้วตารางว่าง
   ทั้งที่ chip นับได้ (บั๊กตระกูลเดียวกับ draft ที่เคยเจอ 2026-09-01) */
const statusMatch = [{ $match: { 'items.effective_status': { $in: statuses } } }]

pipeline.push({
  $facet: {
    rows: [
      ...modalityMatch,
      ...statusMatch,
      /* ใบเดิมที่ตรวจใหม่วันนี้ต้องอยู่ต้นรายการวันนี้ ไม่ตกท้ายตามวันสั่งเดิม
         (เดิมเป็นค่าคงที่ · 2026-09-25 ให้ผู้ใช้สลับทิศได้ ค่าเริ่มต้นยังเป็นชุดเดิม) */
      { $sort: sortSpec },
      { $skip: skip },
      { $limit: limit },
      /* join หลัง skip/limit เพื่ออ่านแค่ visit ของหน้านั้น ไม่ใช่ทั้งชุดผลลัพธ์ */
      {
        $lookup: {
          from: DIAGNOSIS_COLLECTION,
          let: { visit_id: '$_diagnosis_visit_id' },
          pipeline: [
            {
              $match: {
                xrstatx: { $nin: [0, 3] },
                $expr: { $eq: ['$vid.value', '$$visit_id'] }
              }
            },
            { $sort: { updated_at: -1, created_at: -1 } },
            { $limit: 1 },
            { $project: { _id: 0, primary_dx: 1 } }
          ],
          as: 'diagnosis_record'
        }
      },
      { $unwind: { path: '$diagnosis_record', preserveNullAndEmptyArrays: true } },
      { $addFields: { diagnosis: '$diagnosis_record.primary_dx' } },
      /* ── ประวัติการแพ้ยา (ผู้ใช้ขอ 2026-09-03) ────────────────────────────
         join หลัง skip/limit เหมือน Diagnosis ⇒ อ่านแค่คนไข้ของหน้านั้น
         เทียบด้วย $toString ทั้งสองฝั่ง เพราะ pid.value/vid.value อาจเป็น ObjectId หรือ string
         แล้วแต่ใบ — ถ้าเทียบชนิดตรง ๆ แล้วพลาด จะเงียบ ๆ ไม่มีกล่องเตือน ซึ่งอันตรายกว่า */
      {
        $lookup: {
          from: PERSON_COLLECTION,
          let: { person_id: '$_person_id' },
          pipeline: [
            {
              $match: {
                xrstatx: { $nin: [0, 3] },
                $expr: { $eq: [{ $toString: '$_id' }, { $toString: '$$person_id' }] }
              }
            },
            { $limit: 1 },
            { $project: { _id: 0, allergy_main: 1 } }
          ],
          as: 'person_record'
        }
      },
      { $unwind: { path: '$person_record', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: ASSESSMENT_COLLECTION,
          let: { visit_id: '$_diagnosis_visit_id' },
          pipeline: [
            {
              $match: {
                xrstatx: { $nin: [0, 3] },
                $expr: { $eq: [{ $toString: '$vid.value' }, { $toString: '$$visit_id' }] }
              }
            },
            { $sort: { updated_at: -1, created_at: -1 } },
            { $limit: 1 },
            { $project: { _id: 0, drug_allergy: 1, food_allergy: 1 } }
          ],
          as: 'assessment_record'
        }
      },
      { $unwind: { path: '$assessment_record', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          _allergy_main: '$person_record.allergy_main',
          _drug_allergy: '$assessment_record.drug_allergy',
          _food_allergy: '$assessment_record.food_allergy'
        }
      },
      {
        $project: {
          bucket: 0,
          modality_codes: 0,
          status_date: 0,
          _citizen_search_person: 0,
          _diagnosis_visit_id: 0,
          _person_id: 0,
          diagnosis_record: 0,
          person_record: 0,
          assessment_record: 0
        }
      }
    ],
    meta: [...modalityMatch, ...statusMatch, { $count: 'total' }],
    buckets: [...modalityMatch, { $group: { _id: '$bucket', total: { $sum: 1 } } }],
    modality_counts: [
      { $unwind: '$modality_codes' },
      { $group: { _id: '$modality_codes', total: { $sum: 1 } } }
    ]
  }
})

let aggregateRows
try {
  const found = await app.dbFindAll(
    {
      from: ITEM_COLLECTION,
      nosql: {
        type: 'aggregate',
        collections: [ITEM_COLLECTION],
        pipeline
      }
    },
    false,
    false
  )
  if (!found || found.success === false) {
    return { success: false, message: 'อ่าน CPOE X-ray worklist ไม่สำเร็จ' }
  }
  aggregateRows = found.reply && Array.isArray(found.reply.data) ? found.reply.data : []
} catch (error) {
  return {
    success: false,
    message: 'อ่าน CPOE X-ray worklist ไม่สำเร็จ: ' + String((error && error.message) || error)
  }
}

const facet = aggregateRows[0] || {}
const orders = Array.isArray(facet.rows) ? facet.rows : []
const total = Array.isArray(facet.meta) && facet.meta[0] ? Number(facet.meta[0].total || 0) : 0

/* เติม label ของเครื่องให้ทุก item — pipeline คืนแต่ code */
orders.forEach(order => {
  const items = Array.isArray(order && order.items) ? order.items : []
  items.forEach(item => {
    const code = valueText(item && item.modality && item.modality.code).trim().toUpperCase()
    item.modality = { code, label: MODALITY_LABEL[code] || code }
  })
})

/* แถบเตือนแพ้ยา / COVID (ผู้ใช้ขอ 2026-09-03) — สรุปให้ UI เป็นชุดเดียว
   UI ห้าม derive เอง ไม่งั้นสองที่จะตีความข้อมูลคนละแบบแล้วเตือนไม่ตรงกัน
   ไม่มีข้อมูล = allergies ว่างและ covid=false ⇒ ฟอร์มจะไม่ขึ้นกล่อง (ไม่ใช่กล่องเปล่า) */
orders.forEach(order => {
  const allergies = allergyTexts(order)
  const covid = covidFlag(order)
  if (!order.patient || typeof order.patient !== 'object') order.patient = {}
  order.patient.alerts = { allergies, covid, covid_label: covid ? 'COVID' : '' }
  delete order._allergy_main
  delete order._drug_allergy
  delete order._food_allergy
})

const bucketRows = Array.isArray(facet.buckets) ? facet.buckets : []
const counts = { all: 0, waiting: 0, pending: 0, complete: 0, cancelled: 0 }
bucketRows.forEach(row => {
  const key = valueText(row && row._id).trim()
  const value = Number((row && row.total) || 0)
  if (counts[key] == null) return
  counts[key] += value
  counts.all += value
})
/* compatibility ชั่วคราวสำหรับ Form รุ่นเดิมที่ยังมี chip active ก้อนเดียว
   UI รุ่นใหม่ไม่แสดง key นี้และใช้ waiting/pending แยกกัน */
counts.active = counts.waiting + counts.pending

const modalityCountRows = Array.isArray(facet.modality_counts) ? facet.modality_counts : []
const modalityCountLookup = {}
let unmapped = 0
modalityCountRows.forEach(row => {
  const key = valueText(row && row._id).trim().toUpperCase()
  const value = Number((row && row.total) || 0)
  if (!key) {
    unmapped += value
    return
  }
  modalityCountLookup[key] = (modalityCountLookup[key] || 0) + value
})

/* code ที่มีในข้อมูลจริงแต่ไม่มีใน MODALITY_MASTER ต้องยังเลือกได้ ไม่ใช่หายไปเงียบ ๆ */
const modalities = modalityList(modalityCountLookup)
Object.keys(modalityCountLookup).forEach(code => {
  if (MODALITY_LABEL[code]) return
  modalities.push({ code, label: code, count: modalityCountLookup[code] })
})

return {
  success: true,
  data: {
    orders,
    total,
    page,
    limit,
    modalities,
    counts,
    statuses,
    modality: requestedModality,
    modality_codes: requestedModalities,
    /* เพิ่ม 2026-09-25 — คีย์ใหม่แบบ additive ผู้อ่าน response เดิมไม่กระทบ */
    sort: sortKey,
    sort_options: Object.keys(SORT_SPECS),
    date_scope: {
      from: scopeFrom,
      to: scopeTo,
      defaulted: scopeDefaulted,
      /* คิวประจำวันแล้ว ไม่แถมงานค้างข้ามวันอีก (ผู้ใช้สั่ง 2026-09-08)
         คงคีย์นี้ไว้เพื่อไม่ให้ผู้อ่าน response เดิมพัง — ค่าเป็น false เสมอ */
      include_backlog: false,
      axis: 'status_time'
    },
    modality_unmapped: unmapped,
    organization_code: organizationCode,
    unit_code: organizationCode
  },
  /* แก้ 2026-09-10 ตามคำสั่งผู้ใช้: อ่านสำเร็จแล้วไม่ต้องขึ้นข้อความอะไรทั้งนั้น
     ตารางที่โหลดขึ้นมาคือหลักฐานอยู่แล้ว · ฟอร์มโชว์ message ก้อนนี้เป็นแถบเตือน
     ตอนไม่มีรายการ ⇒ ของเดิมทำให้หน้าจอว่างมีแถบสีเหลืองว่า "สำเร็จ" ซึ่งอ่านแล้วงง
     🔴 จำนวนรายการที่ยังไม่มีเครื่องผูกไว้ **ไม่ได้หายไป** — ยังส่งใน modality_unmapped
        และฟอร์มมีแถบ dataNote ของตัวเองที่อ่านค่านั้นอยู่แล้ว */
  message: ''
}
