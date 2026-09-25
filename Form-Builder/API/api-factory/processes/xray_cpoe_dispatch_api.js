/*
 * initCraft API Factory Process
 * Name: X-ray - Dispatch CPOE order to RIS
 * Deployed Process ID: 6a967029422c1ca959829edc   (ผู้ใช้แจ้ง 2026-09-01)
 *
 * Input:  { order_id: '<zdata_cpoe_order _id>',
 *           item_id?: '<zdata_cpoe_order_item _id>',
 *           item_ids?: ['<item id>', ...], retry_only?: boolean }
 * Output: { success, accession_no, transport: { status, ack, error },
 *           items: [...], message }
 *
 * ลำดับตาม spec.md §4.2 · ห้ามสลับ:
 *   1. ตรวจสิทธิ์ + scope องค์กร + สถานะ
 *   2. ออก Accession  → Process 6a95cd58422c1ca959829e8d (idempotent)
 *   3. commit การรับ + audit dispatched_at/by แบบ atomic
 *   4. ส่งเข้า RIS ด้วย API ของทีม → Process 6a8f1ef87632d182ef6914fe **นอก transaction**
 *      ทางหลัก app.runProcess · ทางสำรอง HTTP public token (ตั้งค่าที่ RIS_ORDER_PUBLIC_TOKEN)
 *   5. เก็บผล transport · **RIS ล้มเหลวห้าม rollback ข้อ 2–3**
 *
 * เรียก Process อื่นด้วย app.runProcess(id, params, userInfo) ทั้งคู่
 * จึงไม่ต้องใช้ public token และไม่มี network hop ที่เราต้องดูแลเอง
 *
 * ยิงซ้ำปลอดภัย: RIS ใช้ AccessionNo เป็นกุญแจธุรกิจตัวเดียว เจอแล้ว update
 * ⇒ รายการที่ transport ล้มเหลวกดใหม่ได้ ไม่เกิดใบซ้ำ (retry_only)
 *
 * **ส่งตรวจซ้ำ / ตรวจใหม่** — เปลี่ยนกติกาตามคำสั่งผู้ใช้ 2026-09-03
 * (เดิม 2026-09-02: ใช้เลข Accession เดิมซ้ำ · ผู้ใช้สั่งเปลี่ยนหลังเห็นของจริง)
 *   · ใช้ **Order เดิมและเลข Order เดิม** เสมอ ไม่สร้างใบใหม่ ไม่เปลี่ยนเลขใบ
 *   · ถ้ารายการนั้นมีเลข Accession อยู่แล้ว → **ล้างทิ้ง** แล้วออกเลขใหม่ตอนกดส่งเข้าเครื่อง
 *   · เลขเดิมถูกเก็บไว้ที่ accession_history[] ไม่ได้หายไป เพราะผลอ่านรอบก่อนใน
 *     zdata_xray_result ยังผูกกับเลขนั้น ต้องตามกลับได้
 *   · ส่งตรวจซ้ำ (รอบใหม่) เท่านั้นที่เลื่อน dispatched_at — retry ที่ forward ล้มใช้เวลาเดิม
 *   · รายการที่ยกเลิก/ปฏิเสธแล้วส่งซ้ำไม่ได้ (ต้องสั่งใหม่จาก CPOE)
 *   · **retry_only ไม่เข้าเส้นทางนี้** — รอบนั้น RIS ยังไม่เคยได้รับใบ การใช้เลขเดิมถูกแล้ว
 *
 * **1 order มีได้หลาย test และหลาย accession** (ผู้ใช้ยืนยัน 2026-09-01 · เหมือน LAB)
 * ตั้งแต่ 2026-09-07 caller ส่ง item_ids[] หลายรายการในคำขอเดียวได้ แต่ Process
 * ยังคงออกเลข/commit/เรียก RIS ตามลำดับทีละ item เพราะ RIS รับ flat payload ต่อ accession
 * ทุก item จึงได้เลข accession ของตัวเองและเป็นใบสั่งแยกกันฝั่ง RISเหมือนเดิม
 * สถานะระดับใบเป็นผลรวมของ item · ใบจะ "ออกผลครบ" เมื่อทุก item มีผลอ่านแล้ว
 *
 * **MongoDB ของระบบนี้เป็น standalone** — เปิด transaction ไม่ได้ (แก้ 2026-09-01)
 * ทั้ง Process นี้และ xray-accession-generate จึงมีเส้นทางสำรองแบบไม่มี session
 */

const ITEM_COLLECTION = 'zdata_cpoe_order_item'
const ORDER_COLLECTION = 'zdata_cpoe_order'
const ITEM_MASTER_COLLECTION = 'zdata_master_item_order'
const XRAY_SERVICE_TYPE = 'xray'

const ACCESSION_PROCESS_ID = '6a95cd58422c1ca959829e8d'
const RIS_ORDER_PROCESS_ID = '6a8f1ef87632d182ef6914fe'
const ORDER_CANCELLATION_COLLECTION = 'zdata_xray_order_cancellation'
const MAX_BATCH_ITEMS = 50

/* ── เส้นทางสำรองไปหา RIS ───────────────────────────────────────────────
   ทางหลักคือ app.runProcess ซึ่งไม่ต้องใช้ token · ถ้าแพลตฟอร์มไม่ยอมให้
   Process เรียกข้าม Process (permissionDenied) จะไม่มีทางส่งได้เลย
   จึงมีทางที่สอง: ยิง HTTP เข้า public endpoint ของ Process เดียวกัน

   **ห้าม commit token ลงรีโป** — เว้นว่างไว้ในไฟล์นี้เสมอ แล้วไปวางค่าจริง
   ในช่องโค้ดของ API Factory เท่านั้น (token เปิดให้เขียนฐานข้อมูลได้โดยไม่ต้องล็อกอิน)
   ว่างอยู่ = ใช้เฉพาะทางหลัก และถ้าทางหลักถูกปฏิเสธจะบอกตรง ๆ ว่าต้องเติมอะไร

   gateway ตรวจว่ามี property ชื่อ params ที่ระดับบนสุดก่อนตรวจ token
   (ยืนยันด้วยการยิงจริง 2026-09-01) body จึงต้องเป็น { params: <payload> } */
const RIS_PUBLIC_URL = 'https://apihis.softmax-one.com/api/v1/process/public'
const RIS_ORDER_PUBLIC_TOKEN = ''
const RIS_REQUEST_TIMEOUT_MS = 20000

/* ฟิลด์บังคับของ RIS — ลอกจาก `required` ใน ../../xray_api_order.js ตรงตัว
   ทีมผ่อนกฎ 2026-09-01 เหลือ 9 ตัว (AdmissionNo/PatientSsn ไม่บังคับแล้ว)
   เช็คฝั่งเราก่อนยิง เพื่อให้ข้อความบอกว่า "ข้อมูลคนไข้ช่องไหนว่าง" แทนที่จะรอ
   RIS ตอบ AE กลับมาเป็นชื่อฟิลด์ฝั่งเขาซึ่งคนหน้างานแปลไม่ออก
   test_xray_cpoe_dispatch_api.js อ่านไฟล์ของทีมมาเทียบ ห้ามหลุดจากกัน */
const RIS_REQUIRED_FIELDS = [
  'Hn', 'PatientFName', 'PatientGender', 'PatientDob',
  'PatientClassUid', 'VisitNo', 'AccessionNo', 'ExamUid', 'ExamName'
]

/* ชื่อไทยของแต่ละฟิลด์ เพื่อให้คนหน้างานรู้ว่าต้องไปแก้ตรงไหน */
const RIS_FIELD_LABEL = {
  Hn: 'HN',
  PatientFName: 'ชื่อผู้ป่วย',
  PatientGender: 'เพศ',
  PatientDob: 'วันเกิด',
  PatientClassUid: 'ประเภทผู้ป่วย (IPD/OPD)',
  VisitNo: 'VN',
  AccessionNo: 'เลข Accession',
  ExamUid: 'รหัสรายการตรวจ',
  ExamName: 'ชื่อรายการตรวจ'
}

/* หน่วยงานรังสีที่เข้าหน้าจอนี้ได้ — ต้องตรงกันทั้งสาม Process ของ X-ray
   ผู้ใช้ยืนยันผัง 2026-09-01:
     m0900 กลุ่มงานรังสีวิทยา (xray)  = กลุ่มแม่
       ├─ m0901 งานรังสีวิทยา (clinic) = X-ray ธรรมดา
       └─ CT    CT scan / CT-MRI SCAN  = CT/MRI
   นี่เป็น "ประตู" เท่านั้น ไม่ได้กรองข้อมูล — ทุก org ที่ผ่านเข้ามาเห็นรายการรังสี
   ทั้งหมดเหมือนกัน (ผู้ใช้ยืนยัน 2026-09-01 ว่ายังไม่ต้องแยกตาม org) */
const XRAY_ORGANIZATION_CODES = ['m0900', 'm0901', 'CT']

/* สถานะหลังรับเข้าห้องรังสี — อยู่ในกลุ่ม dispatched ของ worklist */
const DISPATCH_STATUS = 'dispatched'
const WAITING_STATUS = 'sent'
const FINANCE_READY_STATUS = 'ready'

/* กลุ่ม "รับเข้าห้องรังสีแล้ว" ทั้งชุด — ต้องตรงกับ bucket active ของ
   STATUS_VOCABULARY ใน xray_cpoe_worklist_api.js และ s.itemState ของฟอร์มเป๊ะ ๆ
   เคยเช็คแค่คำว่า 'dispatched' ตรงตัว ทำให้แถวที่ CPOE เขียนเป็น 'accepted'
   ถูกฟอร์มปล่อยให้ติ๊กแต่ API ปฏิเสธ (ผู้ใช้เจอ 2026-09-01) */
const RECEIVED_STATUSES = ['accepted', 'prepared', 'dispensed', 'dispatched', 'in_progress']

const valueText = value => {
  if (value == null) return ''
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return String(value.toHexString())
    if (value.$oid != null) return String(value.$oid)
    if (value._id != null) return valueText(value._id)
    if (value.value != null && typeof value.value !== 'object') return String(value.value)
    if (value.label != null && typeof value.label !== 'object') return String(value.label)
    if (value.code != null) return String(value.code)
  }
  return String(value)
}
const trimmed = value => valueText(value).trim()

/* standalone MongoDB โยน error สองแบบนี้เมื่อขอ session — ไม่ใช่ความผิดของข้อมูล
   ระบบนี้เป็น standalone จริง (เหมือน LAB) จึงต้องมีเส้นทางไม่มี transaction เสมอ
   ชุดข้อความเดียวกับ lab_cpoe_receive_api.js / lab_no_generate_api.js */
const transactionUnsupported = error => {
  const message = trimmed((error && error.message) || error).toLowerCase()
  return message.includes('transaction numbers are only allowed on a replica set member or mongos') ||
    message.includes('transaction support is not available')
}

/* ── mapping CPOE → RIS ────────────────────────────────────────────────────
   ผู้ใช้ยืนยัน 2026-09-01:
     · PatientClassUid ใช้แค่ I / O — ตัด E (ห้องฉุกเฉิน) ออก มี AN = I ไม่มี = O
     · ExamUid ใช้ item_code ของ CPOE ตรงๆ
     · ModalityTypeUid ใช้ code (เช่น DX)
     · ส่งฟิลด์เท่าที่เห็นว่าเหมาะสม ฝั่ง RIS จะ map ต่อเอง
   แก้ mapping ทั้งหมดได้ที่บล็อกนี้บล็อกเดียว
   ────────────────────────────────────────────────────────────────────────── */

const GENDER_MAP = { 'ชาย': 'M', 'หญิง': 'F', MALE: 'M', FEMALE: 'F', M: 'M', F: 'F' }

const toGender = value => {
  const raw = trimmed(value)
  if (!raw) return 'U'
  return GENDER_MAP[raw] || GENDER_MAP[raw.toUpperCase()] || 'U'
}

/* วันเกิดใน HIS ไทยมีทั้ง ค.ศ. และ พ.ศ. และเก็บได้หลายรูปแบบ
   RIS รับ YYYY-MM-DD แบบ ค.ศ. เท่านั้น (xray_api_order.js)
   ปีตั้งแต่ 2400 ขึ้นไปถือเป็น พ.ศ. แปลงลง 543 · อ่านไม่ออกคืนค่าว่าง **ไม่เดา**

   เดิมรับแค่ YYYY-MM-DD ทรงเดียว ⇒ คนไข้ที่ HIS เก็บเป็น DD/MM/YYYY จะได้ค่าว่าง
   แล้ว RIS ตอบ "Missing required field(s): PatientDob" โดยไม่มีใครเดาสาเหตุถูก */
const toIsoDate = value => {
  const raw = trimmed(value).replace(/T.*$/, '').trim()
  if (!raw) return ''

  let year = 0
  let month = 0
  let day = 0

  let match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(raw)
  if (match) {
    year = Number(match[1]); month = Number(match[2]); day = Number(match[3])
  } else if ((match = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(raw))) {
    /* ทรงไทยมาตรฐาน วัน/เดือน/ปี — ปีอยู่ท้ายจึงไม่กำกวมกับทรงบน */
    day = Number(match[1]); month = Number(match[2]); year = Number(match[3])
  } else if ((match = /^(\d{4})(\d{2})(\d{2})$/.exec(raw))) {
    year = Number(match[1]); month = Number(match[2]); day = Number(match[3])
  } else {
    return ''
  }

  if (year >= 2400) year -= 543
  if (year < 1900 || year > 2199) return ''
  if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) return ''
  return String(year).padStart(4, '0') + '-' +
    String(month).padStart(2, '0') + '-' +
    String(day).padStart(2, '0')
}

const isUrgent = order => {
  const raw = trimmed(order && order.priority).toLowerCase()
  if (!raw) return false
  if (raw.indexOf('urgent') >= 0 || raw.indexOf('stat') >= 0 || raw.indexOf('ด่วน') >= 0) return true
  return ['2', '3', '4', '5'].indexOf(raw) >= 0
}

/* ชื่อฟิลด์ใน snapshot ของ CPOE ไม่ได้มาทรงเดียวเสมอ — ไล่หาให้ครบทุกชื่อที่เจอจริง
   ก่อนจะยอมแพ้ ดีกว่าปล่อยให้ฟิลด์บังคับว่างแล้ว RIS ตีกลับทั้งใบ
   คืนค่าแรกที่ไม่ว่าง · ไม่มีเลยคืนค่าว่าง (ไม่เดา) */
const firstText = (...values) => {
  for (let i = 0; i < values.length; i += 1) {
    const value = trimmed(values[i])
    if (value) return value
  }
  return ''
}

/* SelectByForm เก็บ {value,label}; ฟิลด์ข้อความของ RIS ต้องใช้ label ไม่ใช่ code */
const displayText = value => {
  if (value && typeof value === 'object' && value.label != null) return trimmed(value.label)
  return trimmed(value)
}

const buildRisPayload = (order, item, accessionNo, modalityCode, modalityName, organizationCode) => {
  const visit = (order && order.vid) || {}
  const patient = visit.pid || {}
  const admissionNo = trimmed(visit.an)
  const doctor = visit.visit_doctor

  const payload = {
    Hn: firstText(patient.hn, visit.hn, order && order.hn),
    PatientTitle: firstText(displayText(patient.prename), displayText(patient.title), displayText(patient.prefix)),
    PatientFName: firstText(patient.p_fname, patient.first_name, patient.fname, patient.firstname),
    PatientLName: firstText(patient.p_lname, patient.last_name, patient.lname, patient.lastname),
    PatientGender: toGender(firstText(visit.gender_text, patient.gender_text, patient.sex, patient.gender)),
    /* ข้อมูลจริงบางใบเก็บวันเกิดไว้ที่ visit.birth_date ไม่ได้ซ้ำไว้ใต้ pid */
    PatientDob: toIsoDate(firstText(
      patient.birth_date, patient.birthdate, patient.dob, patient.birth_day,
      visit.birth_date, visit.birthdate, visit.dob, visit.birth_day
    )),
    PatientClassUid: admissionNo ? 'I' : 'O',
    VisitNo: firstText(visit.vn, visit.visit_no, order && order.vn),
    AccessionNo: trimmed(accessionNo),
    ExamUid: trimmed(item && item.item_code),
    ExamName: trimmed(item && item.item_name),
    Priority: isUrgent(order) ? 'U' : 'R',
    Status: 'A',
    IsDeleted: false
  }

  /* ฟิลด์ที่ไม่บังคับ — ใส่เฉพาะเมื่อมีค่า ไม่ส่งค่าว่างไปรกใบสั่ง
     AdmissionNo และ PatientSsn ไม่บังคับแล้วตั้งแต่ 2026-09-01 (ทีมผ่อนกฎ)
     จึงไม่ต้องใส่ค่าปลอมให้ OPD หรือผู้ป่วยต่างชาติอีกต่อไป */
  /* แพทย์ส่งตรวจ: ถ้า HIS ให้มาเป็น object แยกช่องได้ตามที่ RIS ต้องการ
     ถ้าเป็นข้อความล้วน **ห้ามเดาว่าคำไหนคือชื่อคำไหนคือนามสกุล** — ใส่ทั้งก้อนไว้ที่
     FName เหมือนเดิม (พฤติกรรมเดิมที่ใช้อยู่ ยังคงไว้ทุกกรณี) */
  const doctorIsObject = doctor && typeof doctor === 'object'
  const doctorTitle = doctorIsObject ? firstText(doctor.prename, doctor.title, doctor.prefix) : ''
  const doctorFirst = doctorIsObject ? firstText(doctor.p_fname, doctor.first_name, doctor.fname) : ''
  const doctorLast = doctorIsObject ? firstText(doctor.p_lname, doctor.last_name, doctor.lname) : ''
  const doctorSplit = Boolean(doctorFirst || doctorLast)

  const optional = {
    AdmissionNo: admissionNo,
    PatientSsn: firstText(patient.cid, patient.ssn, patient.p_idcard),
    RequestNo: trimmed(order && order.order_number),
    ClinicalInstruction: trimmed(order && (order.order_comment || order.note)),
    /* ฟิลด์ที่มีข้อมูลใน CPOE อยู่แล้วแต่เดิมไม่ได้ส่ง — เพิ่มเข้าไปเฉย ๆ
       ทุกตัวเป็น optional ฝั่ง RIS จึงไม่มีทางทำให้ใบที่เคยส่งผ่านกลายเป็นตีกลับ */
    ReferringDoctorTitle: doctorTitle,
    ReferringDoctorFName: doctorSplit ? doctorFirst : trimmed(doctor),
    ReferringDoctorLName: doctorLast,
    ReferenceUnitUid: firstText(
      visit.visit_clinic && visit.visit_clinic.value,
      visit.clinic && visit.clinic.value,
      visit.ward && visit.ward.value
    ),
    ReferenceUnitName: firstText(
      displayText(visit.visit_clinic), displayText(visit.clinic), displayText(visit.ward)
    ),
    InsuranceTypeDesc: trimmed(order && order.inscl_hos),
    /* id ของข้อความ ใช้ไล่ย้อนเวลามีปัญหา · ทีมยืนยันว่าไม่มีผลกับการ dedup */
    MessageControlId: trimmed(accessionNo) ? ('XR' + trimmed(accessionNo)) : '',
    ModalityTypeUid: trimmed(modalityCode),
    ModalityTypeName: trimmed(modalityName),
    OrganizationUid: trimmed(organizationCode),
    Qty: item && item.quantity != null ? Number(item.quantity) : null
  }
  Object.keys(optional).forEach(name => {
    const value = optional[name]
    if (value === null || value === undefined || value === '') return
    if (name === 'Qty' && !Number.isFinite(value)) return
    payload[name] = value
  })

  return payload
}

/* ── ตัวช่วยเรียก Process อื่น ──────────────────────────────────────────────
   app.runProcess คืน { success, permissionDenied, reply: { status, message, data } }
   ส่วนตัว Process เองคืน { success, data, message } — แกะให้เหลือชั้นเดียว */
const unwrapProcess = result => {
  if (!result || typeof result !== 'object') return null
  const reply = result.reply || {}
  const candidates = [reply.data, result.data, reply, result]
  for (let i = 0; i < candidates.length; i += 1) {
    const item = candidates[i]
    if (item && typeof item === 'object' && (typeof item.success === 'boolean' || item.AcknowledgementCode)) {
      return item
    }
  }
  return null
}

/* ── 1. ตรวจสิทธิ์ + scope ─────────────────────────────────────────────── */

const orderId = trimmed(params.order_id)
if (!/^[a-f0-9]{24}$/i.test(orderId)) {
  return { success: false, message: 'order_id ไม่ถูกต้อง' }
}
const retryOnly = params.retry_only === true

/* ── รับทั้ง item เดี่ยวและ batch ของ Order เดียวกัน ─────────────────────
   item_id เดี่ยวยังคงเป็น contract เดิม ส่วน item_ids[] คือ batch wrapper ฝั่ง HIS
   (เพิ่ม 2026-09-07) · ด้านในยังเรียก RIS ทีละ flat payload ต่อ accession ตามเดิม
   คัดเฉพาะ id ที่รูปแบบถูกต้อง เพื่อไม่ให้ค่าขยะกลายเป็น "ไม่เลือกอะไรเลย" เงียบๆ */
const rawItemIds = []
if (params.item_id !== null && params.item_id !== undefined) rawItemIds.push(params.item_id)
if (Array.isArray(params.item_ids)) params.item_ids.forEach(value => rawItemIds.push(value))
const invalidItemIds = rawItemIds.filter(value => !/^[a-f0-9]{24}$/i.test(trimmed(value)))
if (invalidItemIds.length) {
  return { success: false, message: 'item_id ที่ส่งมาไม่ถูกต้อง — ยังไม่มีรายการใดถูกส่ง' }
}
const requestedItemIds = []
rawItemIds.forEach(value => {
  const id = trimmed(value)
  if (/^[a-f0-9]{24}$/i.test(id) && !requestedItemIds.includes(id)) requestedItemIds.push(id)
})
if (requestedItemIds.length > MAX_BATCH_ITEMS) {
  return {
    success: false,
    message: 'ส่งเข้าเครื่องได้ไม่เกิน ' + MAX_BATCH_ITEMS + ' รายการต่อคำขอ',
    data: { order_id: trimmed(params.order_id), requested: requestedItemIds.length }
  }
}

if (!app.isAuth(userInfo.roles || [])) {
  return { success: false, message: 'ไม่มีสิทธิ์ส่งรายการเข้าเครื่อง' }
}

const organizationCode = trimmed(userInfo.unit && userInfo.unit.code).toUpperCase()
const allowedOrganizations = XRAY_ORGANIZATION_CODES
  .map(code => String(code).trim().toUpperCase())
  .filter(Boolean)
if (!organizationCode || !allowedOrganizations.includes(organizationCode)) {
  return {
    success: false,
    message: 'Organization "' + (organizationCode || '-') + '" ไม่ใช่หน่วยงานรังสี จึงส่งเข้าเครื่องไม่ได้'
  }
}

const now = valueText(app.curDate('YYYY-MM-DD HH:mm:ss')).trim()
const actor = trimmed(userInfo.username || (userInfo.account && userInfo.account.name))
const orderObjectId = app.dbObjectId(orderId)

const itemCollection = app.db.collection(ITEM_COLLECTION)
const orderCollection = app.db.collection(ORDER_COLLECTION)
const masterCollection = app.db.collection(ITEM_MASTER_COLLECTION)

const order = await orderCollection.findOne({ _id: orderObjectId, xrstatx: { $nin: [0, 3] } })
if (!order) return { success: false, message: 'ไม่พบ Order ที่ต้องการส่งเข้าเครื่อง' }

/* ลิงก์ item → order: บางชุดข้อมูลเก็บ order_ref_id เป็น ObjectId บางชุดเก็บเป็น string
   worklist ใช้ $lookup ซึ่งยอมทรงเดียว แต่ find ที่นี่ต้องรับทั้งสองไม่งั้นหาไม่เจอ
   เผื่อ schema ที่ผูกด้วย xparentx ไว้ด้วย (เจอในบาง export ของ CPOE) */
const orderLinks = [orderObjectId, orderId]
const allItems = await itemCollection
  .find({
    xrstatx: { $nin: [0, 3] },
    $or: [{ order_ref_id: { $in: orderLinks } }, { xparentx: { $in: orderLinks } }]
  })
  .toArray()

/* service_type เก็บได้ทั้ง {value:'xray'} และ 'xray' ตรงๆ — valueText แกะให้ทั้งคู่ */
const serviceTypeOf = item => trimmed(
  (item && item.service_type && item.service_type.value != null)
    ? item.service_type.value
    : (item && item.service_type)
).toLowerCase()

const xrayItems = allItems.filter(item => serviceTypeOf(item) === XRAY_SERVICE_TYPE)
if (!xrayItems.length) {
  /* บอกให้ชัดว่าติดตรงไหน ไม่ใช่ "ไม่มีรายการ" เฉยๆ แล้วให้ไปเดาเอง
     — ไม่เจอ item เลย = ลิงก์ผิด · เจอแต่ไม่ใช่รังสี = service_type ไม่ตรง */
  const seen = []
  allItems.forEach(item => {
    const type = serviceTypeOf(item) || '(ว่าง)'
    if (!seen.includes(type)) seen.push(type)
  })
  return {
    success: false,
    message: allItems.length
      ? ('Order นี้ไม่มีรายการทางรังสี — พบ ' + allItems.length +
         ' รายการ แต่ service_type เป็น ' + seen.join(', ') + ' (ต้องเป็น "' + XRAY_SERVICE_TYPE + '")')
      : 'ไม่พบรายการใดในใบสั่งนี้ — item ไม่ได้ผูกกับ order ด้วย order_ref_id หรือ xparentx',
    data: { order_id: orderId, items_found: allItems.length, service_types: seen }
  }
}

/* ป้องกัน IsDeleted:false เฉพาะรายการที่กำลังยกเลิก RIS; บันทึกแบบเดิม
   (ไม่มี cancel_scope) ยังบล็อกทั้ง Order จนกว่าจะตรวจ/เปิดใหม่ */
const cancellationCollection = app.db.collection(ORDER_CANCELLATION_COLLECTION)
const cancelBlocksDispatch = async () => {
  const record = await cancellationCollection.findOne({
    _id: orderObjectId,
    xrstatx: { $nin: [0, 3] }
  })
  if (!record || !['pending', 'ris_pending', 'applied', 'conflict']
    .includes(trimmed(record.cancel_status).toLowerCase())) return false
  if (trimmed(record.cancel_scope).toLowerCase() !== 'items') return true
  if (trimmed(record.cancel_status).toLowerCase() === 'applied') return false
  const blockedIds = Array.isArray(record.item_ids) ? record.item_ids.map(value => trimmed(value)) : []
  return !requestedItemIds.length || requestedItemIds.some(id => blockedIds.includes(id))
}
if (await cancelBlocksDispatch()) {
  return { success: false, message: 'รายการที่เลือกกำลังยกเลิกหรือยกเลิกแล้ว จึงส่งเข้าเครื่องไม่ได้' }
}

/* Batch ต้องผ่าน preflight ครบทั้งชุดก่อนแตะ accession/status ใด ๆ
   ป้องกันกรณีส่ง id ของคนละ Order หรือมี id ผิดปนมาแล้ว Process ทำเพียงบางรายการ */
if (requestedItemIds.length > 1) {
  const xrayItemIds = xrayItems.map(item => valueText(item._id))
  const missingRequestedIds = requestedItemIds.filter(id => !xrayItemIds.includes(id))
  if (missingRequestedIds.length) {
    return {
      success: false,
      message: 'พบ item_id ที่ไม่ใช่รายการ X-ray ของ Order นี้ — ยังไม่มีรายการใดถูกส่ง',
      data: { order_id: orderId, missing_item_ids: missingRequestedIds }
    }
  }
}

const transportFailed = item => {
  const transport = item && item.transport
  return trimmed(transport && transport.status).toLowerCase() === 'failed'
}

/* ค้างครึ่งทาง: ถูก mark ว่าส่งเข้าเครื่องแล้วแต่ไม่มีเลข Accession
   สถานะนี้เกิดได้จากบั๊ก standalone MongoDB (2026-09-01) เท่านั้น — ลำดับที่ถูกต้อง
   ออกเลขก่อนเปลี่ยนสถานะเสมอ ⇒ "dispatched แต่ไม่มีเลข" คือหลักฐานว่ายังไม่เสร็จ
   และ RIS ยังไม่เคยเห็นใบนี้ (ไม่มีเลขก็ส่งไม่ได้) ⇒ ทำต่อได้โดยไม่เสี่ยงใบซ้ำ */
const transportDelivered = item => {
  const transport = item && item.transport
  return trimmed(transport && transport.status).toLowerCase() === 'ok'
}
/* ── ส่งตรวจซ้ำ (แก้กติกา 2026-09-03 ตามคำสั่งผู้ใช้) ─────────────────────
   ถ่ายซ้ำเคสเดิม = กดส่งเข้าเครื่องอีกรอบบน **Order เดิม** แต่ **ออกเลข Accession ใหม่**
   (เดิม 2026-09-02 ใช้เลขเดิมซ้ำ เพราะ xray_api_order upsert ด้วย AccessionNo)
   เลขใหม่ ⇒ ฝั่ง RIS ได้ใบของรอบนี้แยกจากรอบก่อน และผลอ่านสองรอบไม่ปนกัน
   เลขเดิมเก็บไว้ที่ accession_history[] จึงยังตามผลอ่านรอบก่อนกลับได้

   ห้ามส่งซ้ำรายการที่ยกเลิก/ปฏิเสธไปแล้ว — เคสนั้นต้องสั่งใหม่จาก CPOE ไม่ใช่ปลุกใบเดิม */
const TERMINAL_STATUSES = ['cancelled', 'rejected', 'returned', 'reversed']
const resendable = item => {
  if (!item) return false
  if (TERMINAL_STATUSES.indexOf(trimmed(item.current_status).toLowerCase()) >= 0) return false
  return Boolean(trimmed(item.accession_no))
}

const incompleteDispatch = item => {
  if (!item) return false
  const status = trimmed(item.current_status).toLowerCase()
  if (RECEIVED_STATUSES.indexOf(status) < 0) return false
  /* ไม่มีเลข = RIS เป็นไปไม่ได้ที่จะเคยเห็นใบนี้ (ไม่มีเลขก็ส่งไม่ได้)
     และต้องไม่มี transport ที่สำเร็จค้างอยู่ กันการส่งซ้ำโดยไม่ตั้งใจ */
  return !trimmed(item.accession_no) && !transportDelivered(item)
}

/* Finance gate แบบเดียวกับ LAB: `sent` ยังเลือกเพื่อปฏิเสธ/ยกเลิกได้ แต่ห้าม
   ออกเลขหรือรับเข้าห้องรังสีจน Finance เปลี่ยน CPOE Item เป็น `ready`.
   รายการที่มีหลักฐานว่าเคยรับแล้ว (เลข/transport/สถานะหลังรับ) ยัง retry หรือส่งซ้ำ
   ได้ตาม flow เดิม ไม่ย้อนกลับไปบังคับ Finance ซ้ำกลางงาน. */
const hasDispatchEvidence = item => Boolean(
  trimmed(item && item.accession_no) ||
  trimmed(item && item.dispatched_at) ||
  trimmed(item && item.transport && item.transport.status) ||
  RECEIVED_STATUSES.indexOf(trimmed(item && item.current_status).toLowerCase()) >= 0
)
const requestedRows = requestedItemIds.length
  ? xrayItems.filter(item => requestedItemIds.includes(valueText(item._id)))
  : xrayItems
const financeBlocked = requestedRows.filter(item =>
  trimmed(item && item.current_status).toLowerCase() === WAITING_STATUS && !hasDispatchEvidence(item)
)
if (!retryOnly && financeBlocked.length) {
  return {
    success: false,
    error: 'payment_not_ready',
    message: 'ยังไม่ผ่านการเงิน',
    data: {
      order_id: orderId,
      items: financeBlocked.map(item => ({
        item_id: valueText(item._id),
        item_code: trimmed(item.item_code),
        current_status: trimmed(item.current_status)
      }))
    }
  }
}

/* รายการที่ต้องทำ:
   - ปกติ: Finance ผ่านแล้ว (ready)
   - ค้างครึ่งทาง: รับแล้วแต่ยังไม่มีเลข — ทำต่อให้จบ
   - ส่งตรวจซ้ำ: มีเลขแล้วและยังไม่ถูกยกเลิก — ล้างเลขเดิมแล้วออกเลขใหม่ (2026-09-03)
   - retry_only: ที่ส่งไปแล้วแต่ transport ล้มเหลว — ใช้เลขเดิม ไม่ออกเลขใหม่ */
const targets = xrayItems.filter(item => {
  if (requestedItemIds.length && !requestedItemIds.includes(valueText(item._id))) return false
  const status = trimmed(item.current_status).toLowerCase()
  if (retryOnly) return status !== FINANCE_READY_STATUS && (transportFailed(item) || incompleteDispatch(item))
  return status === FINANCE_READY_STATUS || transportFailed(item) || incompleteDispatch(item) || resendable(item)
})
if (requestedItemIds.length > 1) {
  targets.sort((left, right) =>
    requestedItemIds.indexOf(valueText(left._id)) - requestedItemIds.indexOf(valueText(right._id))
  )
}

if (requestedItemIds.length > 1 && targets.length !== requestedItemIds.length) {
  const targetIds = targets.map(item => valueText(item._id))
  const blocked = xrayItems
    .filter(item => requestedItemIds.includes(valueText(item._id)) && !targetIds.includes(valueText(item._id)))
    .map(item => ({
      item_id: valueText(item._id),
      item_code: trimmed(item.item_code),
      current_status: trimmed(item.current_status),
      accession_no: trimmed(item.accession_no),
      transport_status: trimmed(item.transport && item.transport.status)
    }))
  return {
    success: false,
    message: 'มีรายการในชุดที่ส่งเข้าเครื่องไม่ได้ — ยังไม่มีรายการใดถูกส่ง',
    data: { order_id: orderId, items: blocked }
  }
}

/* ติ๊กมาแต่ไม่มีอันไหนอยู่ในสถานะที่ส่งได้ = บอกให้ชัด ไม่ใช่เงียบว่า "ไม่มีรายการ"
   ต้องบอก **สถานะจริง** ที่อ่านได้ด้วย ไม่งั้นต้องเดาหรือเปิด DB ดูเองทุกครั้ง */
if (requestedItemIds.length && !targets.length) {
  const known = xrayItems.filter(item => requestedItemIds.includes(valueText(item._id)))
  if (!known.length) {
    return { success: false, message: 'ไม่พบรายการที่เลือกในใบสั่งนี้' }
  }
  const detail = known.map(item => ({
    item_id: valueText(item._id),
    item_code: trimmed(item.item_code),
    current_status: trimmed(item.current_status),
    accession_no: trimmed(item.accession_no),
    transport_status: trimmed(item.transport && item.transport.status)
  }))
  const first = detail[0]
  return {
    success: false,
    message: 'รายการที่เลือกส่งเข้าเครื่องไม่ได้ — สถานะปัจจุบันคือ "' +
      (first.current_status || '(ว่าง)') + '"' +
      (first.accession_no ? (' และมีเลข ' + first.accession_no + ' แล้ว') : ' และยังไม่มีเลข Accession') +
      ' · ส่งได้เฉพาะสถานะ "' + FINANCE_READY_STATUS + '" หรือรายการที่รับแล้วแต่ยังไม่ได้เลข',
    data: { order_id: orderId, items: detail }
  }
}

/* ไม่ได้ระบุรายการมา แต่ใบนี้มีให้ส่งหลายรายการ = ไม่เดาแทนผู้ใช้
   เดาแล้วส่งผิดรายการ = ใบสั่งผิดไปนอนอยู่ที่เครื่อง แก้ย้อนหลังยากกว่าถามใหม่ */
if (!requestedItemIds.length && targets.length > 1) {
  return {
    success: false,
    message: 'ใบนี้มีรายการที่ส่งเข้าเครื่องได้ ' + targets.length + ' รายการ — ระบุ item_ids ที่ต้องการส่ง',
    data: { order_id: orderId, candidates: targets.map(row => valueText(row._id)) }
  }
}

if (!targets.length) {
  const alreadyDone = xrayItems.every(
    item => trimmed(item.current_status).toLowerCase() !== FINANCE_READY_STATUS &&
      !transportFailed(item) && !incompleteDispatch(item)
  )
  return {
    success: true,
    accession_no: trimmed(xrayItems[0].accession_no),
    transport: { status: 'skipped', ack: '', error: '' },
    items: [],
    message: alreadyDone ? 'Order นี้ส่งเข้าเครื่องไปแล้ว' : 'ไม่มีรายการที่ต้องส่งเข้าเครื่อง'
  }
}

const results = []

for (let index = 0; index < targets.length; index += 1) {
  const item = targets[index]
  const itemId = valueText(item._id)
  const alreadyDispatched = hasDispatchEvidence(item)
  let accessionNo = trimmed(item.accession_no)
  /* จำไว้ก่อนเรียกตัวออกเลข เพื่อแยก "ส่งตรวจซ้ำ" (มีเลขมาก่อนแล้ว) ออกจาก
     "ซ่อมรายการที่ค้าง" (เพิ่งได้เลขในรอบนี้) — สองอย่างนี้ต้องปฏิบัติไม่เหมือนกัน */
  const isResend = alreadyDispatched && Boolean(accessionNo)
  /* ── รอบใหม่จริงหรือแค่ส่งใบเดิมซ้ำ (แยกให้ชัด 2026-09-16 · ผู้ใช้สั่ง) ────────
     "รอบใหม่" = ถ่ายใหม่ ⇒ ต้องออกเลข Accession ใหม่ และเลื่อนเวลาส่งเป็นรอบนี้
     "ส่งซ้ำเพราะ forward ล้ม / retry_only" = ใบเดิมที่ยังไปไม่ถึงปลายทาง
       ⇒ ใช้เลขเดิม และ **ห้ามเลื่อน dispatched_at** เพราะไม่ได้ถ่ายใหม่
     เงื่อนไขนี้คือตัวเดียวกับที่ใช้ตัดสินว่าจะล้างเลข Accession หรือไม่ (ขั้น 1b)
     ของเดิมสองที่ใช้เงื่อนไขไม่ตรงกัน: ไม่ล้างเลขให้ retry แต่ดันเลื่อนเวลาให้
     ⇒ เวลาส่งเข้าเครื่องเลื่อนไปข้างหน้าทั้งที่เป็นรอบเดิม (เจอจริง 2026-09-10) */
  const isNewRound = isResend && !retryOnly && !transportFailed(item)

  /* ── 1b. ส่งตรวจซ้ำ = ล้างเลข Accession เดิมก่อน (ผู้ใช้สั่ง 2026-09-03) ──
     Order เดิมและเลข Order เดิมไม่ถูกแตะ — เปลี่ยนเฉพาะเลข Accession ของรายการนี้
     ตัวออกเลขเป็น idempotent โดยยึดเงื่อนไข "accession_no ยังว่าง" ⇒ ล้างก่อนจึงได้เลขใหม่
     ห้ามลบเลขเดิมทิ้งเฉย ๆ: ผลอ่านรอบก่อนใน zdata_xray_result ผูกกับเลขนั้นอยู่
     ข้ามขั้นนี้สองกรณี เพราะรอบก่อน RIS **ยังไม่เคยได้ใบ** การใช้เลขเดิมจึงถูกแล้ว:
       · retry_only
       · รายการที่ transport ล้มเหลวค้างอยู่ (กดส่งใหม่ = ส่งใบเดิมที่ยังไม่ถึงปลายทาง) */
  if (isNewRound && accessionNo) {
    const previousAccession = accessionNo
    await itemCollection.updateOne(
      { _id: item._id, xrstatx: { $nin: [0, 3] } },
      {
        $set: {
          accession_no: '',
          accession_cleared_at: now,
          accession_cleared_by: actor,
          updated_at: now,
          updated_by: actor
        },
        $push: {
          accession_history: {
            accession_no: previousAccession,
            cleared_at: now,
            cleared_by: actor,
            reason: 'resend'
          }
        }
      }
    )
    accessionNo = ''
    item.accession_no = ''
  }

  /* ── 2. ออก Accession ผ่าน Process เดิม (idempotent ต่อ item) ─────────── */
  if (!accessionNo) {
    const issued = unwrapProcess(await app.runProcess(ACCESSION_PROCESS_ID, { item_id: itemId }, userInfo))
    if (!issued || issued.success === false) {
      results.push({
        item_id: itemId,
        stage: 'accession',
        success: false,
        message: (issued && issued.message) || 'ออก Accession No. ไม่สำเร็จ'
      })
      continue
    }
    accessionNo = trimmed(issued.data && issued.data.accession_no)
  }
  if (!accessionNo) {
    results.push({ item_id: itemId, stage: 'accession', success: false, message: 'ไม่ได้รับเลข Accession กลับมา' })
    continue
  }

  /* ── 3. commit การรับ แบบ atomic — ข้ามถ้าเป็นการยิงซ้ำ ───────────────── */
  if (!alreadyDispatched) {
    /* คำสั่งเดียว เอกสารเดียว แบบ compare-and-set ⇒ atomic อยู่แล้วแม้ไม่มี transaction
       standalone MongoDB จึงตกมาเส้นทางไม่มี session ได้โดยไม่เสียความถูกต้อง
       เดิมเรียก mongoTxn ตรง ๆ ทำให้ทุกครั้งล้มด้วย "Transaction numbers are only
       allowed on a replica set member or mongos" (แก้ 2026-09-01) */
    const commitReceive = async session => {
      const txItems = app.db.collection(ITEM_COLLECTION)
      const saved = await txItems.updateOne(
        { _id: item._id, xrstatx: { $nin: [0, 3] }, current_status: FINANCE_READY_STATUS },
        {
          $set: {
            current_status: DISPATCH_STATUS,
            dispatched_at: now,
            dispatched_by: userInfo.account || { name: actor },
            updated_at: now,
            updated_by: actor
          }
        },
        session ? { session } : {}
      )
      if (!saved || Number(saved.matchedCount) !== 1) throw new Error('ITEM_STATUS_CONFLICT')
      return true
    }
    let committed
    try {
      try {
        committed = await this.mongoTxn(
          session => commitReceive(session),
          { name: 'dispatchXrayItem', maxRetry: 5, timeoutMs: 15000 }
        )
      } catch (error) {
        if (!transactionUnsupported(error)) throw error
        committed = await commitReceive(null)
      }
    } catch (error) {
      results.push({
        item_id: itemId,
        accession_no: accessionNo,
        stage: 'receive',
        success: false,
        message: trimmed(error && error.message) === 'ITEM_STATUS_CONFLICT'
          ? 'รายการถูกเปลี่ยนสถานะระหว่างส่งเข้าเครื่อง กรุณาลองใหม่'
          : 'บันทึกการรับไม่สำเร็จ'
      })
      continue
    }
    if (!committed) {
      results.push({ item_id: itemId, accession_no: accessionNo, stage: 'receive', success: false, message: 'บันทึกการรับไม่สำเร็จ' })
      continue
    }
  } else if (isResend) {
    /* ส่งตรวจซ้ำ (รอบใหม่): ได้เลขใหม่ไปแล้วจากขั้น 1b/2 · เลื่อนเวลาส่งเป็นรอบนี้
       เพื่อให้ worklist รู้ว่าเริ่มรอบใหม่แล้ว และรอผลของรอบนี้
       ส่งซ้ำเพราะ forward ล้ม: ใบเดิม เลขเดิม ⇒ **ไม่แตะ dispatched_at/dispatched_by**
       แต่ยังบันทึก resent_at + dispatch_count ทุกครั้ง จะได้ตามได้ว่ากดไปกี่หน */
    const stamp = {
      current_status: DISPATCH_STATUS,
      resent_at: now,
      updated_at: now,
      updated_by: actor
    }
    if (isNewRound) {
      stamp.dispatched_at = now
      stamp.dispatched_by = userInfo.account || { name: actor }
    }
    await itemCollection.updateOne(
      { _id: item._id, xrstatx: { $nin: [0, 3] } },
      { $set: stamp, $inc: { dispatch_count: 1 } }
    )
  }

  /* ── 4. ส่งเข้า RIS นอก transaction ───────────────────────────────────── */
  let master = null
  if (item.item_data_id) {
    master = await masterCollection.findOne({ _id: item.item_data_id, xrstatx: { $nin: [0, 3] } })
  }
  const xrayItem = (master && master.xray_item) || {}
  const modalityCode = trimmed(xrayItem.modality || xrayItem.modality_type).toUpperCase()
  const modalityName = trimmed(xrayItem.modality_name || xrayItem.modality_label)

  const payload = buildRisPayload(order, item, accessionNo, modalityCode, modalityName, organizationCode)

  /* อ่านซ้ำก่อนขาส่ง RIS: ปุ่มยกเลิกอาจถูกกดหลัง preflight ด้านบน */
  if (await cancelBlocksDispatch()) {
    results.push({ item_id: itemId, accession_no: accessionNo, stage: 'transport',
      success: false, message: 'Order กำลังยกเลิก RIS — ไม่ส่ง IsDeleted:false ทับ' })
    continue
  }

  /* ── 4a. เช็คฟิลด์บังคับก่อนยิง ─────────────────────────────────────────
     ยิงทั้งที่รู้ว่าขาด = เสียเที่ยวและได้ข้อความภาษาอังกฤษของ RIS กลับมา
     ซึ่งบอกแค่ชื่อฟิลด์ฝั่งเขา ไม่ได้บอกว่าต้องไปแก้ที่ไหนในระบบเรา */
  const missingFields = RIS_REQUIRED_FIELDS.filter(name => {
    const value = payload[name]
    return value === undefined || value === null || String(value).trim() === ''
  })
  if (missingFields.length) {
    const labels = missingFields.map(name => RIS_FIELD_LABEL[name] || name)
    const note = 'ข้อมูลไม่ครบสำหรับส่งเข้า RIS — ขาด ' + labels.join(', ') +
      ' (ฟิลด์ ' + missingFields.join(', ') + ') ต้องแก้ที่ทะเบียนผู้ป่วย/ใบสั่งก่อน'
    const attemptCount = Number((item.transport && item.transport.attempts) || 0) + 1
    await itemCollection.updateOne(
      { _id: item._id, xrstatx: { $nin: [0, 3] } },
      {
        $set: {
          transport: {
            status: 'failed',
            ack: 'AE',
            message: note,
            missing_fields: missingFields,
            at: now,
            by: actor,
            attempts: attemptCount
          },
          transport_failed: true,
          updated_at: now,
          updated_by: actor
        }
      }
    )
    results.push({
      item_id: itemId,
      accession_no: accessionNo,
      stage: 'transport',
      success: false,
      ack: 'AE',
      attempts: attemptCount,
      missing_fields: missingFields,
      message: note
    })
    continue
  }

  /* ทางหลัก: เรียก Process ของทีมตรง ๆ ไม่ต้องใช้ token และไม่มี network hop */
  let ack = null
  let transportError = ''
  let route = 'process'
  try {
    const sent = await app.runProcess(RIS_ORDER_PROCESS_ID, payload, userInfo)
    if (sent && sent.permissionDenied) {
      transportError = 'ไม่มีสิทธิ์เรียก RIS Order API'
    } else {
      ack = unwrapProcess(sent)
      if (!ack) transportError = 'RIS ไม่ได้ตอบในรูปแบบ ACK ที่รู้จัก'
    }
  } catch (error) {
    transportError = trimmed(error && error.message) || 'เรียก RIS Order API ไม่สำเร็จ'
  }

  /* ทางสำรอง: ยิง HTTP เข้า public endpoint ของ Process เดียวกัน
     ใช้เฉพาะเมื่อทางหลักไม่ได้ ACK กลับมา · ปลอดภัยที่จะยิงซ้ำเพราะ RIS upsert
     ด้วย AccessionNo ⇒ ถึงทางหลักจะไปถึงจริงแต่เราอ่าน ACK ไม่ออก ก็ได้ใบเดิมทับ
     ไม่เกิดใบซ้ำ (xray_api_order.js: เจอ AccessionNo = update) */
  if (!ack && RIS_ORDER_PUBLIC_TOKEN && app && app.axios) {
    const primaryError = transportError
    try {
      const response = await app.axios.post(
        RIS_PUBLIC_URL + '?token=' + encodeURIComponent(RIS_ORDER_PUBLIC_TOKEN),
        { params: payload },
        {
          timeout: RIS_REQUEST_TIMEOUT_MS,
          headers: { 'Content-Type': 'application/json' },
          validateStatus: () => true
        }
      )
      const status = Number((response && response.status) || 0)
      const body = (response && response.data) || null
      const parsed = unwrapProcess(body) || unwrapProcess(body && body.data)
      if (parsed && parsed.AcknowledgementCode) {
        ack = parsed
        transportError = ''
        route = 'public'
      } else {
        transportError = primaryError + ' · ทางสำรอง HTTP ตอบ ' + (status || 'ไม่ทราบสถานะ') +
          ' แต่ไม่ใช่รูปแบบ ACK'
      }
    } catch (error) {
      const status = Number((error && error.response && error.response.status) || 0)
      transportError = primaryError + ' · ทางสำรอง HTTP ล้มเหลว' +
        (status ? (' (' + status + ')') : '') +
        (trimmed(error && error.message) ? (': ' + trimmed(error.message)) : '')
    }
  } else if (!ack && !RIS_ORDER_PUBLIC_TOKEN) {
    transportError = transportError +
      ' · เส้นทางสำรองปิดอยู่ — ใส่ public token ของ Process ' + RIS_ORDER_PROCESS_ID +
      ' ที่ตัวแปร RIS_ORDER_PUBLIC_TOKEN ใน API Factory (ห้าม commit ลงรีโป)'
  }

  const ackCode = trimmed(ack && ack.AcknowledgementCode).toUpperCase()
  const ackText = trimmed(ack && ack.TextMessage)
  const delivered = ackCode === 'AA'
  if (!delivered && !transportError) {
    transportError = ackText || ('RIS ปฏิเสธใบสั่ง (' + (ackCode || 'ไม่มีรหัสตอบกลับ') + ')')
  }

  /* ── ผลของ "ขาที่สอง" — API ของทีม → Envision (เพิ่ม 2026-09-09) ──────────
     xray_api_order บันทึกลง zdata_xray_order ก่อน แล้วค่อย forward ต่อไป Envision
     สองขานี้พังแยกกันได้ · ของเดิมเก็บแค่ AcknowledgementCode/TextMessage
     ⇒ เวลา forward พังจะเห็นแค่ "Order saved locally, but forwarding failed"
     ซึ่งไม่บอกว่า **ไปไม่ถึง** หรือ **ถึงแล้วโดนปฏิเสธ** ต้องเปิด DB ไล่เอง
     (ผู้ใช้เจอจริง 2026-09-09 17:30 · Envision ตอบ 401 แต่หน้าจอไม่แสดง)

     ทีมส่งค่าพวกนี้กลับมาให้อยู่แล้ว เราแค่ไม่เคยเก็บ ⇒ เก็บเพิ่มอย่างเดียว
     🔴 ไม่แตะ delivered / ackCode / status ใด ๆ — ใบที่เคยผ่านยังผ่านเหมือนเดิม */
  /* ack เป็น null ได้จริง (RIS ไม่ตอบในรูปแบบ ACK ที่รู้จัก) ⇒ ต้องกันก่อนอ่านฟิลด์ */
  const forwardRaw = ack ? ack.ForwardHttpStatus : null
  const forwardStatus = (forwardRaw === null || forwardRaw === undefined || forwardRaw === '' ||
    !Number.isFinite(Number(forwardRaw))) ? null : Number(forwardRaw)
  const forwardError = trimmed(ack && ack.ForwardError)
  const forwardBody = (() => {
    const body = ack && ack.ForwardResponse
    if (body === null || body === undefined || body === '') return ''
    const text = typeof body === 'string' ? body : (() => {
      try { return JSON.stringify(body) } catch (_) { return String(body) }
    })()
    return trimmed(text).slice(0, 300)
  })()
  /* LocalSaved บอกว่าใบลง zdata_xray_order แล้วหรือยัง — สำคัญตอนตัดสินใจส่งซ้ำ
     ถ้าบันทึกแล้วแต่ forward พัง การกดใหม่คือ update ไม่ใช่ใบซ้ำ */
  const localSaved = (ack && ack.LocalSaved) === true

  /* ต่อท้ายเหตุผลจริงให้ข้อความที่คนหน้างานเห็น — ไม่เขียนทับของเดิม
     ถ้าไม่มีข้อมูล forward เลย ข้อความจะเท่าเดิมเป๊ะ ๆ ทุกตัวอักษร */
  if (!delivered) {
    const detail = forwardStatus !== null
      ? ('Envision ตอบ HTTP ' + forwardStatus +
         (forwardStatus === 401 || forwardStatus === 403
           ? ' (ไม่ผ่านการยืนยันตัวตน — ตรวจ credential ฝั่ง xray_api_order)'
           : ''))
      : (forwardError
        ? ('ต่อ Envision ไม่ได้ (' + forwardError + ') — ตรวจว่าเซิร์ฟเวอร์ HIS ออกไปหา RIS ได้จริงไหม')
        : '')
    if (detail) transportError = transportError + ' · ' + detail
  }

  /* ── 5. เก็บผล transport · ห้าม rollback ข้อ 2–3 เมื่อ RIS ล้มเหลว ────── */
  const attempts = Number((item.transport && item.transport.attempts) || 0) + 1
  await itemCollection.updateOne(
    { _id: item._id, xrstatx: { $nin: [0, 3] } },
    {
      $set: {
        transport: {
          status: delivered ? 'ok' : 'failed',
          ack: ackCode,
          message: delivered ? ackText : transportError,
          operation: trimmed(ack && ack.Operation),
          /* รู้ว่าใบนี้ไปถึง RIS ทางไหน จะได้ตัดสินใจได้ว่าต้องขอสิทธิ์เพิ่มหรือยัง */
          route: route,
          at: now,
          by: actor,
          attempts: attempts,
          /* ผลของขา API ทีม → Envision · null = ทีมไม่ได้ส่งค่ากลับมา (เช่นเวอร์ชันเก่า) */
          forward_http_status: forwardStatus,
          forward_error: forwardError,
          forward_response: forwardBody,
          local_saved: localSaved
        },
        transport_failed: !delivered,
        updated_at: now,
        updated_by: actor
      }
    }
  )

  results.push({
    item_id: itemId,
    accession_no: accessionNo,
    stage: delivered ? 'done' : 'transport',
    success: delivered,
    ack: ackCode,
    attempts: attempts,
    resent: isResend,
    message: delivered
      ? (isResend ? 'ส่งตรวจซ้ำแล้ว · ใช้ Accession No. เดิม' : (ackText || 'ส่งเข้าเครื่องแล้ว'))
      : transportError
  })
}

const firstAccession = trimmed((results.filter(row => row.accession_no)[0] || {}).accession_no)
const accessionNos = results.map(row => trimmed(row.accession_no)).filter(Boolean)
const failures = results.filter(row => !row.success)
const receiveFailures = failures.filter(row => row.stage === 'accession' || row.stage === 'receive')
const deliveredCount = results.filter(row => row.success).length

if (!results.length) {
  return { success: false, message: 'ไม่มีรายการที่ส่งเข้าเครื่องได้' }
}

if (!failures.length) {
  return {
    success: true,
    accession_no: firstAccession,
    accession_nos: accessionNos,
    requested: targets.length,
    delivered: deliveredCount,
    failed: 0,
    partial: false,
    transport: { status: 'ok', ack: 'AA', error: '' },
    items: results,
    message: results.length > 1
      ? ('ส่งเข้าเครื่องแล้ว ' + deliveredCount + '/' + results.length + ' รายการ')
      : ((results[0] && results[0].resent ? 'ส่งตรวจซ้ำแล้ว · ' : 'ส่งเข้าเครื่องแล้ว · ') +
        'Accession No. ' + firstAccession)
  }
}

/* รับไว้แล้วแต่ส่ง RIS ไม่ผ่าน = ยังนับว่าสำเร็จบางส่วน ให้กดส่งซ้ำได้
   ล้มตั้งแต่ออกเลขหรือบันทึกรับ = ไม่สำเร็จ ต้องแก้ก่อน */
const partial = receiveFailures.length === 0
return {
  success: partial,
  accession_no: firstAccession,
  accession_nos: accessionNos,
  requested: targets.length,
  delivered: deliveredCount,
  failed: failures.length,
  partial: deliveredCount > 0 || partial,
  transport: {
    status: 'failed',
    ack: trimmed((failures[0] || {}).ack),
    error: trimmed((failures[0] || {}).message)
  },
  items: results,
  message: partial
    ? 'รับรายการแล้วแต่ส่งเข้า RIS ไม่สำเร็จ — กดส่งใหม่ได้ · ' + trimmed((failures[0] || {}).message)
    : trimmed((failures[0] || {}).message) || 'ส่งเข้าเครื่องไม่สำเร็จ'
}
