/*
 * initCraft API Factory Process
 * Name: LAB CPOE Worklist + specimen correction + Result Viewer
 * Deployed Process ID: 6a9434c3422c1ca959829d5e
 * Deployment reported by the user on 2026-08-30; deployed runtime/UAT is not yet verified.
 *
 * Purpose:
 * - Read LAB work from zdata_cpoe_order_item, not from an order mirror.
 * - Route each Item by section, then group rows by CPOE Order + Section for UI.
 * - Prefer immutable Item snapshots when they exist; fall back to current masters
 *   while cpoe-order-save/send is being extended.
 * - Manual LAB entry writes the canonical Result Report/Result Item forms used by
 *   Agent callbacks. The legacy Result Item form is read-only fallback only.
 *
 * Input:
 * {
 *   action?: 'list' | 'list_cbc_swap' | 'swap_cbc_item' | 'list_open_visits' | 'update_specimen' | 'get_manual_result' | 'save_manual_result' | 'save_result_edits' | 'save_result_attachments' | 'set_result_visibility' | 'check_cancel_finance' | 'cancel_order' | 'retest_order' | 'retest_item',
 *   organization_code?: string,                      // App Organization (m1000-m1007)
 *   section_codes?: string[] | comma-separated string,
 *   statuses?: string[] | comma-separated string, // default: ['sent']
 *   date_from?: 'YYYY-MM-DD',
 *   date_to?: 'YYYY-MM-DD',
 *   all_dates?: boolean,                            // exact HN + completed history only
 *   hn?: string,                                  // exact HN only
 *   cross_section?: boolean,                       // read-only LAB history/result view across enabled Sections
 *   lookup_mode?: 'results' | 'orders',            // required with cross_section; get_manual_result requires results
 *   priorities?: string[] | comma-separated string,
 *   include_specimens?: boolean,                     // default true; false for count-only calls
 *   item_id?: string,                                // update_specimen only
 *   specimen_code?: string,                          // update_specimen only
 *   attachment_scope?: 'item' | 'order',             // save_result_attachments only; default item
 *   attachment_operation?: 'replace' | 'remove',      // save_result_attachments only; default replace
 *   removed_attachment_key?: string,                  // required when attachment_operation=remove
 *   page?: number,                                // default: 1
 *   limit?: number                                // default: 30, max: 100
 * }
 *
 * Read is the default action. Write actions are specimen correction,
 * Manual Result persistence after specimen receipt, correction of existing canonical
 * Result Items, Result Report attachments, per-Item result visibility, and
 * Order cancellation scoped to the Section row selected in the worklist.
 * Receive and Item rejection remain separate Processes.
 */

const ITEM_COLLECTION = 'zdata_cpoe_order_item'
const ORDER_COLLECTION = 'zdata_cpoe_order'
const ITEM_MASTER_COLLECTION = 'zdata_master_item_order'
const SECTION_COLLECTION = 'zdata_section'
const SPECIMEN_COLLECTION = 'zdata_specimen_code'
const WORK_ITEM_COLLECTION = 'zdata_lab_work_item'
const OUTBOUND_COLLECTION = 'zdata_lab_outband_order'
const ORDER_CANCELLATION_COLLECTION = 'zdata_lab_order_cancellation'
const BILL_COLLECTION = 'zdata_fa_bill'
const BILL_ITEM_COLLECTION = 'zdata_fa_bill_item'
const DIAGNOSIS_COLLECTION = 'zdata_diagnosis'
const VISIT_COLLECTION = 'zdata_visit'
const VISIT_TRAN_COLLECTION = 'zdata_visit_tran'
/* สถานะคิวที่จอ "ผู้มารับบริการวันนี้" (patient.json · visit_list) นับว่ายังเปิดอยู่
   คัดลอกมาจาก where ของ ListView ตัวจริง ห้ามเดาเพิ่มเอง */
const OPEN_VTRAN_STATUSES = ['waiting', 'called', 'in_progress']
const CBC_SWAP_CODES = ['HM1', 'MS1']
const CBC_SWAP_SECTION_BY_CODE = { HM1: 'HM', MS1: 'ML' }
const RESULT_RECEIPT_FORM_ID = '6a8b1c03f851000f28e501ef'
const RESULT_REPORT_FORM_ID = '6a8d4334f851000f28e5025b'
const RESULT_ITEM_FORM_ID = '6a8bc91df851000f28e501fb'
const LEGACY_RESULT_ITEM_FORM_ID = '6a7aa641935ed08882467374'
const RESULT_ATTACHMENT_MAX_FILES = 10
const RESULT_ATTACHMENT_MAX_FILE_BYTES = 10 * 1024 * 1024
const RESULT_ATTACHMENT_MAX_TOTAL_BYTES = 50 * 1024 * 1024
// 2026-09-23: `ready` now has an explicit financial meaning: Finance has
// cleared the CPOE Item and LAB may receive its specimen. Keep the older
// no-receipt recovery aliases separate so the Worklist never collapses
// `ready` back to `sent` and loses the payment gate.
const LEGACY_WAITING_CPOE_STATUSES = ['accepted', 'prepared', 'dispensed']
const PRE_RECEIVE_CPOE_STATUSES = ['sent', 'ready', ...LEGACY_WAITING_CPOE_STATUSES]
// Keep this allowlist byte-for-byte equivalent to hl7_result_upsert_api.js.
// The receiver uses it to accept one ordered test -> many result components;
// the Worklist uses the same relationship to display those persisted children.
// A parity regression prevents the two standalone API Factory Processes drifting.
const RESULT_COMPONENT_CODES_BY_GROUP = {
  '1001CD': ['100101CD', '10010201CD', '100102CD', '10010401CD', '10010402CD', '100104CD', '100105CD', '100106CD', '100107CD'],
  '1004CD': ['100804CD', '100805CD', '100806CD', '100807CD'],
  '100701BL': ['100702IC', '102390', '102501IC', '102502IC', '102503IC', '102504IC', '103601BL', '103602BL', '103603BL', '103604BL', '103605BL', '103606BL', '103607BL', '103609BL', '103610BL', '103611BL', '103612BL', '103613BL', '103614BL', '103615BL', '103616BL', '103618BL', '103620BL', '103621BL', '103622BL', '103627BL'],
  '100802CD': ['100802CD', '101120CD'],
  '10090123UR': ['100901UR', '100902UR', '100903UR'],
  '1015UH': ['1015UH'],
  '1025CD': ['101201', '102501CD', '102502CD', '102503CD', '102504CD'],
  '10C86SETCD': ['1085CD', '1086CD'],
  '2001EB': ['200101EB', '200102EB', '200103EB', '200105EB', '200106EB', '200107EB', '200108EB', '200109EB', '200111EB', '200112EB', '200113EB', '200114EB', '200115EB', '200116EB', '200117EB', '200119EB', '200120EB', '200121EB', '200122EB', '200138EB', '200151EB', '200153EB', '200154EB', '200260', '200270', '200280', '200290', '200300'],
  '2006BF': ['200600BF', '200601BF', '200603BF', '200613BF', '200614BF', '200615BF', '200616BF'],
  '2101EB': ['210101EB', '210102EB', '210103EB', '210105EB', '210106EB', '210107EB', '210108EB', '210109EB', '210111EB', '210112EB', '210113EB', '210114EB', '210115EB', '210116EB', '210117EB', '210119EB', '210120EB', '210121EB', '210122EB', '210138EB', '210151EB', '210153EB', '210154EB', '210270', '210280', '210290', '210300', '210310'],
  '2106UR': ['210601UR', '210602UR', '210603UR', '210604UR', '210605UR', '210606UR', '210607UR', '210608UR', '210609UR', '210610UR', '210611UR', '210612UR', '210614UR', '210615UR', '210617UR', '210618UR', '210619UR', '210620UR', '210621UR', '210622UR'],
  '2110ST': ['211001ST', '211002ST', '211003ST', '211004ST', '211006ST', '211007ST', '211008ST', '211009ST'],
  '2113ST': ['211301ST', '211302ST', '211303UR', '211304ST', '211305ST', '211306', '2113ST'],
  '2201EB': ['220101EB', '220102EB', '220103EB', '220104EB', '220105EB'],
  '2208SO': ['220801SO', '220802SO'],
  '2235SO': ['220901SO', '2209SO'],
  '2296NP': ['229601NP', '229602NP', '229603NP'],
  '3003BL': ['300301BL', '300302BL'],
  '3013ST': ['301301ST', '301302ST'],
  '3018BF': ['301802FL'],
  '3018CS': ['301801CS', '301802CS', '301803CS', '301804CS', '301805CS', '301806CS'],
  '3029ST': ['302901ST', '302902ST', '3029ST', '30IM29ST'],
  '3030CD': ['302210', '303001CD', '303002CD', '303003CD', '303004CD', '303005CD', '303006CD', '303007CD', '303008CD', '303009CD', '303010CD', '303011CD'],
  '3057BL': ['305701BL', '305702BL', '305703BL', '305704BL'],
  '3064BL': ['306401BL', '306402BL'],
  '3079BL': ['302000', '307901BL', '307902BL', '307903BL', '307904BL', '307905BL', '307906BL', '307907BL', '307908BL', '307909BL', '307910BL', '307911BL', '307912BL'],
  '3096NP': ['309601NP', '309602NP', '309603NP'],
  '30IM136CD': ['301550', '301560', '30IM136CD'],
  '30IM26NS': ['301451'],
}
// Specimen master รุ่นเก่าบางแถวไม่มี is_active; ระบบเดิมถือว่า active เว้นแต่ปิดไว้ชัดเจน
const specimenIsActive = row => {
  const raw = row && row.is_active
  if (raw === undefined || raw === null || raw === '') return true
  if (raw === false || raw === 0) return false
  const normalized = String(raw).trim().toLowerCase()
  return !['0', 'false', 'n', 'no'].includes(normalized)
}

// Worklist ต้องรองรับทั้ง Specimen master กลาง และ specimen ที่ถูกผูกไว้จริงใน
// CPOE Item master รุ่นปัจจุบัน เพราะบาง site ยังมีข้อมูลใน master กลางไม่ครบทุก code.
const specimenOptionOf = value => {
  if (value == null || value === '') return null
  let source = value
  if (typeof source === 'string') {
    const raw = source.trim()
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') source = parsed
      else return { value: raw, label: raw }
    } catch (error) {
      return { value: raw, label: raw }
    }
  }
  if (typeof source !== 'object') return null
  const code = valueText(source.specimen_code || source.code || source.value).trim()
  if (!code) return null
  const label = valueText(source.specimen_name || source.name || source.label || code).trim()
  return { value: code, label: label || code }
}

const mergeSpecimenOptions = (...groups) => {
  const byCode = {}
  groups.forEach(group => {
    ;(Array.isArray(group) ? group : []).forEach(raw => {
      const option = raw && raw.value != null
        ? { value: valueText(raw.value).trim(), label: valueText(raw.label || raw.value).trim() }
        : specimenOptionOf(raw)
      if (!option || !option.value) return
      const key = option.value.toUpperCase()
      if (!byCode[key] || byCode[key].label === byCode[key].value) byCode[key] = option
    })
  })
  return Object.values(byCode).sort((a, b) =>
    a.label.localeCompare(b.label, 'th') || a.value.localeCompare(b.value, 'en')
  )
}

// App Organization ใช้ m100x แต่ Section master ใช้รหัสห้อง LAB คนละชุด
// จึงต้อง route ผ่าน mapping ที่ยืนยันจาก zdata_organization + zdata_section
const ORGANIZATION_SECTION_CODES = {
  // Live Organization verified 2026-09-21:
  // M1000 = กลุ่มงานพยาธิวิทยาคลินิกและเทคนิคการแพทย์ = MY (manual-result room)
  M1000: ['MY'],
  M1001: ['BC'],
  M1002: ['BB'],
  M1003: ['ML'],
  M0104: ['HM', 'HH'],
  M1004: ['HM', 'HH'],
  M1005: ['MB'],
  M1006: ['IM', 'MI-OUT'],
  M1007: ['BG'],
  '10': ['BC'],
  '20': ['HM'],
  '20-22': ['HM', 'HH'],
  '21': ['ML'],
  '22': ['HH'],
  '30': ['IM'],
  '31': ['MI-OUT'],
  '40': ['MB'],
  '41': ['MY'],
  '50': ['BB'],
  '70': ['BG']
}

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

const jsonArray = value => {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}

const resultComponentCodesForOrderCode = orderCode => {
  const code = valueText(orderCode).trim()
  if (!code) return []
  const mapped = RESULT_COMPONENT_CODES_BY_GROUP[code]
  return [code, ...(Array.isArray(mapped) ? mapped : [])]
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

const clampInt = (value, fallback, min, max) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.floor(number)))
}

const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value)
const nextDate = value => new Date(Date.parse(value + 'T00:00:00Z') + (24 * 60 * 60 * 1000))
  .toISOString()
  .slice(0, 10)

if (!app.isAuth(userInfo.roles || [])) {
  return { success: false, message: 'ไม่มีสิทธิ์อ่านรายการสั่งตรวจ LAB' }
}

const userUnitCode = valueText(userInfo.unit && userInfo.unit.code).trim().toUpperCase()
const requestedOrganizationCode = valueText(params.organization_code || params.unit_code)
  .trim()
  .toUpperCase()

if (requestedOrganizationCode && userUnitCode && requestedOrganizationCode !== userUnitCode) {
  return { success: false, message: 'Organization ที่ร้องขอไม่ตรงกับ Organization ปัจจุบันของผู้ใช้' }
}

const organizationCode = requestedOrganizationCode || userUnitCode
const requestedSectionCodes = listText(params.section_codes || params.section_code)
  .map(code => code.toUpperCase())
const action = valueText(params.action).trim().toLowerCase() || 'list'
const crossSectionRequested = params.cross_section === true || valueText(params.cross_section).trim().toLowerCase() === 'true'
const lookupMode = valueText(params.lookup_mode).trim().toLowerCase()

// cross_section is an explicit read-only capability. The cross-room lookup may
// read one Result Item through get_manual_result, but every write action must
// still fail before any CPOE, Work Item, Outbound, or Result access.
const crossSectionReadActions = ['list', 'get_manual_result']
if (crossSectionRequested && !crossSectionReadActions.includes(action)) {
  return { success: false, error: 'cross_section_read_only', message: 'โหมดสืบค้นข้ามห้องเป็นแบบอ่านอย่างเดียว' }
}
if (crossSectionRequested && !['results', 'orders'].includes(lookupMode)) {
  return { success: false, error: 'lookup_mode_required', message: 'กรุณาระบุ lookup_mode เป็น results หรือ orders' }
}
if (crossSectionRequested && action === 'get_manual_result' && lookupMode !== 'results') {
  return { success: false, error: 'result_lookup_mode_required', message: 'การอ่านผลข้ามห้องต้องใช้ lookup_mode เป็น results' }
}
if (!crossSectionRequested && lookupMode) {
  return { success: false, error: 'cross_section_required', message: 'lookup_mode ใช้ได้เฉพาะโหมดสืบค้นข้ามห้อง' }
}

let sectionRows = []
try {
  const found = await app.dbFindAll(
    {
      from: SECTION_COLLECTION,
      nosql: {
        type: 'query',
        collection: SECTION_COLLECTION,
        query: {
          xrstatx: { $nin: [0, 3] },
          enable: true,
          'st_id.code': 'lab'
        },
        projection: {
          _id: 1,
          code: 1,
          name: 1,
          name_th: 1,
          ref_code: 1,
          unit: 1,
          enable: 1
        }
      }
    },
    false,
    false
  )
  if (!found || found.success === false) {
    return { success: false, message: 'อ่าน Section master ไม่สำเร็จ' }
  }
  sectionRows = found.reply && Array.isArray(found.reply.data) ? found.reply.data : []
} catch (error) {
  return { success: false, message: 'อ่าน Section master ไม่สำเร็จ' }
}

const enabledSections = sectionRows.filter(row => row && row.enable === true && valueText(row.code).trim())

if (!organizationCode) {
  return { success: false, message: 'บัญชีผู้ใช้ไม่มี Organization unit สำหรับกำหนดห้อง LAB' }
}

const enabledCodeLookup = Object.fromEntries(
  enabledSections.map(row => [valueText(row.code).trim().toUpperCase(), true])
)
const mappedSectionCodes = ORGANIZATION_SECTION_CODES[organizationCode] ||
  (enabledCodeLookup[organizationCode] ? [organizationCode] : [])
const mappedLookup = Object.fromEntries(mappedSectionCodes.map(code => [code, true]))
const contextSections = enabledSections.filter(row =>
  mappedLookup[valueText(row.code).trim().toUpperCase()]
)

const localSectionCodes = contextSections.map(row => valueText(row.code).trim().toUpperCase())
const sectionScopeRows = crossSectionRequested ? enabledSections : contextSections
const allowedByContext = sectionScopeRows.map(row => valueText(row.code).trim().toUpperCase())
const allowedLookup = Object.fromEntries(allowedByContext.map(code => [code, true]))
const contextSectionMetadata = sectionScopeRows.map(row => ({
  id: valueText(row._id),
  code: valueText(row.code).trim().toUpperCase(),
  label: valueText(row.name_th || row.name || row.code).trim()
}))

if (crossSectionRequested && !localSectionCodes.length) {
  return { success: false, error: 'lab_user_required', message: 'บัญชีผู้ใช้ไม่ได้อยู่ในห้อง LAB ที่เปิดใช้งาน' }
}

if (requestedSectionCodes.some(code => !allowedLookup[code])) {
  return { success: false, message: 'ไม่มีสิทธิ์อ่าน Section ที่ร้องขอ' }
}

const allowedSectionCodes = requestedSectionCodes.length
  ? requestedSectionCodes
  : allowedByContext
const selectedSectionLookup = Object.fromEntries(allowedSectionCodes.map(code => [code, true]))
const allowedSections = contextSectionMetadata.filter(section => selectedSectionLookup[section.code])

/* ── ย้ายขึ้นมาก่อนด่าน Section 2026-09-03 ────────────────────────────────
   `list_open_visits` เป็นรายการ Visit ของทั้งโรงพยาบาลในวันนี้ ไม่ได้ใช้ Section เลย
   (query กรองแค่ visit_date + visit_status) แต่เดิมมันอยู่ใต้ด่าน "Organization นี้ไม่มี
   Section LAB" ⇒ ผู้ใช้ที่ไม่ได้อยู่ห้อง LAB (หมอที่คลินิก, ห้องรังสี) จะถูกตัดจบก่อน
   แล้วหน้าจอได้ payload ของ list กลับไปแทน จนกล่องเลือก VN ขึ้นว่า "รูปแบบข้อมูลไม่ถูกต้อง"
   ⇒ ย้ายทั้ง action dispatch และบล็อกนี้ขึ้นมาไว้เหนือด่าน · ด่านเดิมยังอยู่ครบสำหรับ
   action อื่นทุกตัว ไม่มีใครเสียการป้องกันไป */
if (action === 'list_open_visits') {
  /* ── ให้ตรงกับกล่อง "ผู้มารับบริการวันนี้" ของหน้า Patient (ผู้ใช้ถาม 2026-09-04) ──
     ของเดิมอ่าน zdata_visit ตรง ๆ ด้วย { visit_date: 'YYYY-MM-DD' เท่ากันเป๊ะ, visit_status: true }
     ซึ่ง **ไม่ใช่** นิยาม "Visit ที่เปิดวันนี้" ที่จอ Visit List ใช้จริง — จอนั้นอ่าน Visit Tran
     (form 6a461235e521219e514d1c4b = zdata_visit_tran) ด้วยเงื่อนไข
       `visit_date` = DATE_TO_STRING(DATE_ADD(CURRENT_DATE(),'hour',7),'%Y-%m-%d')
       AND vtran_status IN ('waiting','called','in_progress')
     ⇒ ชั้นแรกจึงอ่านคิววันนี้จาก Visit Tran แล้วดึง Visit ตาม vid ที่ได้ = เห็นชุดเดียวกับ Visit List
     ⇒ ชั้นสองยังเป็น query zdata_visit ของเดิม (ไม่ได้ลบทิ้ง) แต่ผ่อนสองจุดที่ทำให้ผลว่างเงียบ ๆ ได้:
        · visit_date เทียบเป็น "ช่วงวัน" ($gte วันนี้ / $lt พรุ่งนี้) แทนที่จะเท่ากันเป๊ะ —
          ฟิลด์นี้เป็น date-input dateType "datetime" ค่าที่เก็บจริงจึงอาจมีเวลาต่อท้าย
          ('2026-09-04 08:30') ซึ่ง "=" กับ '2026-09-04' ไม่มีวันตรงเลยสักแถว
        · visit_status ใช้ $ne:false แทน === true — เอกสารที่ไม่มีฟิลด์นี้จะไม่ถูกตัดทิ้งเงียบ ๆ
     ผลลัพธ์แนบ source / visit_tran_total มาด้วย เพื่อให้ไล่ได้จากหน้าจอว่าชั้นไหนเป็นคนตอบ */
  const nowText = typeof app.curDate === 'function' ? valueText(app.curDate()) : ''
  const visitDate = validDate(nowText.slice(0, 10))
    ? nowText.slice(0, 10)
    : new Date(Date.now() + (7 * 60 * 60 * 1000)).toISOString().slice(0, 10)
  const nextVisitDate = new Date(Date.parse(visitDate + 'T00:00:00Z') + (24 * 60 * 60 * 1000))
    .toISOString()
    .slice(0, 10)
  // string range ครอบทั้ง 'YYYY-MM-DD' และ 'YYYY-MM-DD HH:mm[:ss]' / 'YYYY-MM-DDTHH:mm'
  const visitDayRange = { $gte: visitDate, $lt: nextVisitDate }
  const requestedVisitHn = valueText(params.hn).trim().replace(/^HN\s*/i, '')

  const visitProjection = {
    _id: 1,
    vn: 1,
    visit_date: 1,
    visit_type: 1,
    visit_clinic: 1,
    visit_doctor: 1,
    inscl_hos: 1,
    'pid.value': 1,
    'pid.hn': 1,
    'pid.prename': 1,
    'pid.p_fname': 1,
    'pid.p_lname': 1,
    'pid.p_gender': 1,
    'pid.age': 1,
    'pid.p_abogroup': 1
  }

  const readVisits = async query => {
    const scopedQuery = { ...query }
    if (requestedVisitHn) scopedQuery['pid.hn'] = requestedVisitHn
    const found = await app.dbFindAll(
      {
        from: VISIT_COLLECTION,
        nosql: {
          type: 'query',
          collection: VISIT_COLLECTION,
          query: scopedQuery,
          projection: visitProjection,
          sort: { vn: 1 },
          limit: 2000
        }
      },
      false,
      false
    )
    if (!found || found.success === false) return null
    return found.reply && Array.isArray(found.reply.data) ? found.reply.data : []
  }

  try {
    // ชั้นแรก — คิววันนี้จาก Visit Tran (แหล่งเดียวกับกล่อง "ผู้มารับบริการวันนี้")
    let visitTranIds = []
    let visitTranTotal = 0
    try {
      const tranFound = await app.dbFindAll(
        {
          from: VISIT_TRAN_COLLECTION,
          nosql: {
            type: 'query',
            collection: VISIT_TRAN_COLLECTION,
            query: {
              xrstatx: { $nin: [0, 3] },
              vtran_status: { $in: OPEN_VTRAN_STATUSES },
              // บางแถวเก็บวันที่ไว้ที่ checkin_at อย่างเดียว — ยอมรับทั้งสองทาง
              $or: [{ visit_date: visitDayRange }, { checkin_at: visitDayRange }]
            },
            projection: {
              _id: 1,
              'vid.value': 1,
              visit_date: 1,
              checkin_at: 1,
              vtran_status: 1
            },
            limit: 2000
          }
        },
        false,
        false
      )
      const tranRows = tranFound && tranFound.success !== false && tranFound.reply && Array.isArray(tranFound.reply.data)
        ? tranFound.reply.data
        : []
      visitTranTotal = tranRows.length
      const seenVisitId = {}
      tranRows.forEach(row => {
        const visitId = valueText(row && row.vid && row.vid.value).trim()
        if (!visitId || seenVisitId[visitId]) return
        seenVisitId[visitId] = true
        visitTranIds.push(visitId)
      })
    } catch (error) {
      // Visit Tran อ่านไม่ได้ ⇒ ตกไปใช้ชั้นสอง ไม่ทำให้ทั้ง action ล้มทั้งอัน
      visitTranIds = []
    }

    let visits = []
    let source = 'visit_day'
    if (visitTranIds.length) {
      // _id อาจต้องเป็น ObjectId — ส่งทั้งค่าดิบและตัวแปลง กัน type ไม่ตรงแล้วได้ 0 แถว
      const visitIdValues = []
      visitTranIds.forEach(visitId => {
        visitIdValues.push(visitId)
        try {
          const objectId = app.dbObjectId(visitId)
          if (objectId && String(objectId) !== visitId) visitIdValues.push(objectId)
        } catch (error) { /* แปลงไม่ได้ก็ใช้ค่าดิบพอ */ }
      })
      const byVisitTran = await readVisits({
        xrstatx: { $nin: [0, 3] },
        _id: { $in: visitIdValues }
      })
      if (byVisitTran && byVisitTran.length) {
        visits = byVisitTran
        source = 'visit_tran'
      }
    }

    if (!visits.length) {
      const byVisitDay = await readVisits({
        xrstatx: { $nin: [0, 3] },
        visit_date: visitDayRange,
        visit_status: { $ne: false }
      })
      if (byVisitDay === null) {
        return { success: false, message: 'อ่าน Visit ที่เปิดอยู่วันนี้ไม่สำเร็จ' }
      }
      visits = byVisitDay
      source = 'visit_day'
    }

    return {
      success: true,
      data: {
        visits,
        total: visits.length,
        visit_date: visitDate,
        source,
        visit_tran_total: visitTranTotal,
        organization_code: organizationCode,
        section_codes: allowedSectionCodes,
        sections: allowedSections
      },
      message: 'อ่าน Visit ที่เปิดอยู่วันนี้สำเร็จ'
    }
  } catch (error) {
    return {
      success: false,
      message: 'อ่าน Visit ที่เปิดอยู่วันนี้ไม่สำเร็จ: ' + String(error && error.message || error)
    }
  }
}


if (!allowedSectionCodes.length) {
  return {
    success: true,
    data: {
      orders: [],
      total: 0,
      page: 1,
      limit: clampInt(params.limit, 30, 1, 100),
      section_codes: [],
      sections: [],
      organization_code: organizationCode,
      unit_code: organizationCode,
      specimen_options: []
    },
    message: 'ไม่พบ Section LAB ที่ผูกกับ Organization นี้'
  }
}

/* ── สลับ CBC ระหว่าง HM / ML ก่อนรับ specimen ────────────────────────────
   CPOE Item คือคำสั่งเดิมของแพทย์และเป็นหลักฐานการคิดราคา จึงห้ามแก้ item_code,
   item_data_id หรือ snapshot ต้นทาง. การสลับเป็น routing override + audit บน
   Lab Work Item เท่านั้น และ LAB NO. Generator จะนำ override นี้ไปใช้ตอนรับจริง. */
if (action === 'swap_cbc_item') {
  if (!localSectionCodes.some(code => code === 'HM' || code === 'ML')) {
    return { success: false, error: 'cbc_swap_forbidden', message: 'เมนูสลับ CBC ใช้ได้เฉพาะห้อง HM และ ML' }
  }
  const itemId = valueText(params.item_id).trim()
  const reason = valueText(params.reason).trim()
  if (!/^[a-f0-9]{24}$/i.test(itemId)) {
    return { success: false, error: 'invalid_item_id', message: 'item_id ไม่ถูกต้อง' }
  }
  if (reason.length > 1000) {
    return { success: false, error: 'reason_too_long', message: 'เหตุผลต้องไม่เกิน 1000 ตัวอักษร' }
  }

  const active = { $nin: [0, 3] }
  const itemObjectId = app.dbObjectId(itemId)
  const itemCollection = app.db.collection(ITEM_COLLECTION)
  const orderCollection = app.db.collection(ORDER_COLLECTION)
  const masterCollection = app.db.collection(ITEM_MASTER_COLLECTION)
  const sectionCollection = app.db.collection(SECTION_COLLECTION)
  const workCollection = app.db.collection(WORK_ITEM_COLLECTION)
  const item = await itemCollection.findOne({ _id: itemObjectId, xrstatx: active })
  if (!item) return { success: false, error: 'item_not_found', message: 'ไม่พบ CPOE Item ที่ต้องการสลับ' }
  if (valueText(item.service_type && item.service_type.value).trim().toLowerCase() !== 'lab') {
    return { success: false, error: 'item_not_lab', message: 'สลับได้เฉพาะ LAB Item' }
  }
  const existing = await workCollection.findOne({
    xrstatx: active,
    is_current_attempt: { $ne: false },
    $or: [{ _id: itemObjectId }, { source_specimen_record_id: itemId }]
  }, { sort: { attempt_no: -1, updated_at: -1, created_at: -1 } })
  const sourceCode = valueText(item.item_code).trim().toUpperCase()
  const currentCode = existing && existing.cbc_swap_active === true
    ? valueText(existing.effective_item_code).trim().toUpperCase()
    : sourceCode
  if (!CBC_SWAP_CODES.includes(sourceCode) || !CBC_SWAP_CODES.includes(currentCode)) {
    return { success: false, error: 'item_not_cbc_swap', message: 'สลับได้เฉพาะรหัส HM1 หรือ MS1 แบบตรงตัวเท่านั้น' }
  }
  const itemStatus = valueText(item.current_status).trim().toLowerCase()
  const workStatus = valueText(existing && existing.work_status).trim().toLowerCase()
  const receivedEvidence = Boolean(valueText(item.received_at || item.lab_no).trim()) || Boolean(
    existing && valueText(existing.lab_no || existing.received_at || existing.resulted_at || existing.completed_at).trim()
  )
  const swappablePlaceholder = existing && existing.cbc_swap_active === true && !receivedEvidence && workStatus === 'waiting_receive'
  if (itemStatus !== 'sent' || receivedEvidence || (existing && !swappablePlaceholder)) {
    return { success: false, error: 'cbc_already_received', message: 'สลับรายการไม่ได้ เพราะ CBC รายการนี้รับ specimen หรือเริ่มดำเนินการแล้ว' }
  }

  const targetCode = currentCode === 'HM1' ? 'MS1' : 'HM1'
  const targetSectionCode = CBC_SWAP_SECTION_BY_CODE[targetCode]
  const targetMaster = await masterCollection.findOne({
    xrstatx: active,
    item_code: targetCode
  })
  if (!targetMaster) return { success: false, error: 'cbc_target_master_missing', message: 'ไม่พบ Master ปลายทาง ' + targetCode }
  let targetSection = targetMaster.section || {}
  if (!valueText(targetSection.code).trim() && targetSection.value) {
    const sectionId = typeof targetSection.value === 'string' ? app.dbObjectId(targetSection.value) : targetSection.value
    targetSection = await sectionCollection.findOne({ _id: sectionId, xrstatx: active, enable: { $ne: false } }) || targetSection
  }
  if (valueText(targetSection.code).trim().toUpperCase() !== targetSectionCode) {
    return { success: false, error: 'cbc_target_section_invalid', message: 'Master ' + targetCode + ' ไม่ได้ผูกกับห้อง ' + targetSectionCode }
  }
  const orderRef = item.order_id && item.order_id.value ? item.order_id.value : item.xparentx
  const order = orderRef ? await orderCollection.findOne({ _id: orderRef, xrstatx: active }) : null
  if (!order) return { success: false, error: 'order_not_found', message: 'ไม่พบ CPOE Order ของรายการนี้' }
  const now = valueText(app.curDate('YYYY-MM-DD HH:mm:ss')).trim()
  const actorCode = valueText(userInfo.employee_code || userInfo.username || userInfo.account && (userInfo.account.code || userInfo.account.name)).trim()
  const actorName = valueText(userInfo.fullname || userInfo.display_name || userInfo.account && (userInfo.account.label || userInfo.account.name) || actorCode).trim()
  const actorId = userInfo._id || userInfo.id || userInfo.account && (userInfo.account._id || userInfo.account.id) || ''
  if (!actorCode) return { success: false, error: 'actor_missing', message: 'ไม่พบผู้ทำรายการจากบัญชีผู้ใช้' }
  const actorAudit = { id: actorId, name: actorName || actorCode }
  const targetSectionName = valueText(targetSection.name_th || targetSection.name || targetSection.label || targetSectionCode).trim()
  const audit = {
    from_code: currentCode,
    from_section_code: CBC_SWAP_SECTION_BY_CODE[currentCode],
    to_code: targetCode,
    to_section_code: targetSectionCode,
    reason,
    at: now,
    by: actorAudit
  }
  if (existing) {
    const updated = await workCollection.updateOne(
      { _id: existing._id, xrstatx: active, cbc_swap_active: true, work_status: 'waiting_receive', lab_no: { $in: [null, ''] } },
      {
        $set: {
          effective_item_code: targetCode,
          effective_item_name: valueText(targetMaster.item_name || targetCode).trim(),
          effective_item_master_id: valueText(targetMaster._id).trim(),
          section_code: targetSectionCode,
          section_name: targetSectionName,
          xunitx: { code: targetSectionCode, name: targetSectionName },
          cbc_swap_pending_lab_no: true,
          cbc_last_swapped_at: now,
          cbc_last_swapped_by: actorAudit,
          updated_at: now,
          updated_by: actorAudit
        },
        $inc: { cbc_swap_count: 1 },
        $push: { cbc_swap_history: audit }
      }
    )
    if (!updated || Number(updated.matchedCount) !== 1) {
      return { success: false, error: 'cbc_swap_conflict', message: 'สถานะรายการเปลี่ยนระหว่างสลับ กรุณาโหลดใหม่' }
    }
  } else {
    const patient = order.vid && order.vid.pid || {}
    const patientHn = valueText(patient.hn).trim()
    const patientName = [valueText(patient.prename), valueText(patient.p_fname || patient.first_name), valueText(patient.p_lname || patient.last_name)]
      .map(value => value.trim()).filter(Boolean).join(' ') || patientHn
    const workItem = {
      _id: itemObjectId,
      xparentx: itemObjectId,
      xsitex: userInfo.site || {},
      xunitx: { code: targetSectionCode, name: targetSectionName },
      xrstatx: 1,
      xversionx: 'v1',
      xerrorx: null,
      dataid: itemId,
      created_by: actorAudit,
      created_at: now,
      updated_by: actorAudit,
      updated_at: now,
      source_order_id: valueText(order._id).trim(),
      source_order_number: valueText(order.order_number).trim(),
      source_specimen_record_id: itemId,
      work_status: 'waiting_receive',
      lab_no: '',
      is_current_attempt: true,
      attempt_no: 1,
      section_code: targetSectionCode,
      section_name: targetSectionName,
      patient_hn: patientHn,
      visit_id: valueText(order.vid && (order.vid.vn || order.vid.value) || order.xparentx).trim(),
      patient_name: patientName,
      ward_clinic: valueText(order.vid && (order.vid.ward || order.vid.visit_clinic)).trim(),
      ordered_at: valueText(order.created_at).trim(),
      ordered_item_code: sourceCode,
      ordered_item_name: valueText(item.item_name).trim(),
      ordered_item_master_id: valueText(item.item_data_id).trim(),
      effective_item_code: targetCode,
      effective_item_name: valueText(targetMaster.item_name || targetCode).trim(),
      effective_item_master_id: valueText(targetMaster._id).trim(),
      cbc_swap_active: true,
      cbc_swap_pending_lab_no: true,
      cbc_swap_count: 1,
      cbc_last_swapped_at: now,
      cbc_last_swapped_by: actorAudit,
      cbc_swap_history: [audit]
    }
    try {
      await workCollection.insertOne(workItem)
    } catch (error) {
      return { success: false, error: 'cbc_swap_conflict', message: 'มีการสร้าง Work Item พร้อมกัน กรุณาโหลดใหม่แล้วลองอีกครั้ง' }
    }
  }
  return {
    success: true,
    data: {
      item_id: itemId,
      order_id: valueText(order._id).trim(),
      ordered_item_code: sourceCode,
      effective_item_code: targetCode,
      from_section_code: CBC_SWAP_SECTION_BY_CODE[currentCode],
      section_code: targetSectionCode
    },
    message: 'สลับรายการ ' + currentCode + ' เป็น ' + targetCode + ' แล้ว'
  }
}

if (action === 'list_cbc_swap') {
  if (!localSectionCodes.some(code => code === 'HM' || code === 'ML')) {
    return { success: false, error: 'cbc_swap_forbidden', message: 'เมนูสลับ CBC ใช้ได้เฉพาะห้อง HM และ ML' }
  }
  const page = clampInt(params.page, 1, 1, 1000000)
  const limit = clampInt(params.limit, 30, 1, 100)
  const skip = (page - 1) * limit
  const hn = valueText(params.hn).trim()
  const requestedDateFrom = valueText(params.date_from).trim()
  const requestedDateTo = valueText(params.date_to).trim()
  if ((requestedDateFrom && !validDate(requestedDateFrom)) || (requestedDateTo && !validDate(requestedDateTo))) {
    return { success: false, message: 'date_from/date_to ต้องเป็น YYYY-MM-DD' }
  }
  const nowText = typeof app.curDate === 'function' ? valueText(app.curDate()) : ''
  const currentDate = validDate(nowText.slice(0, 10))
    ? nowText.slice(0, 10)
    : new Date(Date.now() + (7 * 60 * 60 * 1000)).toISOString().slice(0, 10)
  const dateFrom = requestedDateFrom || currentDate
  const dateTo = requestedDateTo || currentDate
  const orderMatch = {
    xrstatx: { $nin: [0, 3] },
    ...(hn ? { 'vid.pid.hn': hn } : {})
  }
  const cbcPipeline = [
    { $match: { xrstatx: { $nin: [0, 3] }, 'service_type.value': 'lab', item_code: { $in: CBC_SWAP_CODES } } },
    {
      $lookup: {
        from: WORK_ITEM_COLLECTION,
        let: { source_item_id: { $toString: '$_id' } },
        pipeline: [
          { $match: { xrstatx: { $nin: [0, 3] }, is_current_attempt: { $ne: false }, $expr: { $eq: ['$source_specimen_record_id', '$$source_item_id'] } } },
          { $sort: { updated_at: -1, created_at: -1 } }, { $limit: 1 }
        ],
        as: 'work_item'
      }
    },
    { $unwind: { path: '$work_item', preserveNullAndEmptyArrays: true } },
    /* A completed swap belongs to the destination room's Today tab. Keeping it
       out of this handoff queue makes the optimistic UI removal durable after
       refresh while received-but-unswapped CBC rows can still show disabled. */
    { $match: { 'work_item.cbc_swap_active': { $ne: true } } },
    {
      $addFields: {
        effective_item_code: { $cond: [{ $eq: ['$work_item.cbc_swap_active', true] }, '$work_item.effective_item_code', '$item_code'] },
        effective_item_name: { $cond: [{ $eq: ['$work_item.cbc_swap_active', true] }, '$work_item.effective_item_name', '$item_name'] },
        effective_section_code: { $cond: [{ $eq: ['$work_item.cbc_swap_active', true] }, '$work_item.section_code', { $cond: [{ $eq: ['$item_code', 'HM1'] }, 'HM', 'ML'] }] },
        order_ref_id: { $ifNull: ['$order_id.value', '$xparentx'] },
        cbc_swap_allowed: {
          $and: [
            { $eq: ['$current_status', 'sent'] },
            { $eq: [{ $ifNull: ['$received_at', ''] }, ''] },
            { $eq: [{ $ifNull: ['$lab_no', ''] }, ''] },
            { $eq: [{ $ifNull: ['$work_item.lab_no', ''] }, ''] },
            { $eq: [{ $ifNull: ['$work_item.received_at', ''] }, ''] },
            { $in: [{ $ifNull: ['$work_item.work_status', 'waiting_receive'] }, ['waiting_receive']] }
          ]
        }
      }
    },
    { $match: { effective_item_code: { $in: CBC_SWAP_CODES }, effective_section_code: { $in: ['HM', 'ML'] } } },
    { $lookup: { from: ORDER_COLLECTION, localField: 'order_ref_id', foreignField: '_id', as: 'order' } },
    { $unwind: { path: '$order', preserveNullAndEmptyArrays: false } },
    { $match: orderMatch },
    { $addFields: { requested_day: { $substrCP: [{ $convert: { input: '$order.created_at', to: 'string', onError: '', onNull: '' } }, 0, 10] } } },
    { $match: { requested_day: { $gte: dateFrom, $lte: dateTo } } },
    { $sort: { 'order.created_at': -1, item_no: 1 } },
    {
      $group: {
        _id: '$order._id',
        order: { $first: '$order' },
        cbc_items: { $push: {
          item_id: { $toString: '$_id' },
          item_code: '$effective_item_code',
          item_name: '$effective_item_name',
          ordered_item_code: '$item_code',
          section_code: '$effective_section_code',
          current_status: '$current_status',
          swap_allowed: '$cbc_swap_allowed',
          swap_count: { $ifNull: ['$work_item.cbc_swap_count', 0] },
          last_swapped_at: '$work_item.cbc_last_swapped_at',
          last_swapped_by: '$work_item.cbc_last_swapped_by'
        } }
      }
    },
    {
      $lookup: {
        from: ITEM_COLLECTION,
        let: { order_id: '$_id' },
        pipeline: [
          { $match: { xrstatx: { $nin: [0, 3] }, 'service_type.value': 'lab', $expr: { $eq: [{ $ifNull: ['$order_id.value', '$xparentx'] }, '$$order_id'] } } },
          { $lookup: { from: ITEM_MASTER_COLLECTION, localField: 'item_data_id', foreignField: '_id', as: 'master' } },
          { $unwind: { path: '$master', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: WORK_ITEM_COLLECTION,
              let: { source_item_id: { $toString: '$_id' } },
              pipeline: [
                { $match: { xrstatx: { $nin: [0, 3] }, is_current_attempt: { $ne: false }, $expr: { $eq: ['$source_specimen_record_id', '$$source_item_id'] } } },
                { $sort: { updated_at: -1, created_at: -1 } }, { $limit: 1 }
              ],
              as: 'work_item'
            }
          },
          { $unwind: { path: '$work_item', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              item_id: { $toString: '$_id' },
              item_code: { $cond: [{ $eq: ['$work_item.cbc_swap_active', true] }, '$work_item.effective_item_code', '$item_code'] },
              item_name: { $cond: [{ $eq: ['$work_item.cbc_swap_active', true] }, '$work_item.effective_item_name', '$item_name'] },
              ordered_item_code: '$item_code',
              current_status: 1,
              lab_no: { $ifNull: ['$work_item.lab_no', '$lab_no'] },
              section_code: { $cond: [
                { $eq: ['$work_item.cbc_swap_active', true] }, '$work_item.section_code',
                { $ifNull: ['$section_snapshot.code', { $ifNull: ['$lab_context_snapshot.section.code', '$master.section.code'] }] }
              ] },
              specimen: {
                ordered: {
                  source: { $ifNull: ['$lab_data.spec_source', '$lab_data.source'] },
                  source_code: '$lab_data.spec_source_code',
                  collected_at: { $ifNull: ['$lab_data.specimen_at', '$lab_data.at'] }
                },
                master: { code: '$master.lab_item.specimen.code', name: '$master.lab_item.specimen.name' }
              }
            }
          },
          { $sort: { item_no: 1, item_code: 1 } }
        ],
        as: 'items'
      }
    },
    {
      $project: {
        _id: 0,
        row_key: { $concat: [{ $toString: '$_id' }, '|CBC'] },
        order_id: { $toString: '$_id' },
        order_number: '$order.order_number',
        requested_at: '$order.created_at',
        priority: '$order.priority',
        patient: {
          hn: '$order.vid.pid.hn', prename: '$order.vid.pid.prename', first_name: '$order.vid.pid.p_fname',
          last_name: '$order.vid.pid.p_lname', age: '$order.vid.pid.age', gender_text: '$order.vid.gender_text'
        },
        visit: { visit_id: { $toString: '$order.xparentx' }, vn: '$order.vid.vn', clinic: '$order.vid.visit_clinic', ward: '$order.vid.ward' },
        requester: { cosign_user: '$order.cosign_user', visit_doctor: '$order.vid.visit_doctor' },
        finance: { total_amount: '$order.total_amount', paid_amount: '$order.paid_amount', coverage: '$order.inscl_hos' },
        cbc_items: 1,
        cbc_item: { $arrayElemAt: ['$cbc_items', 0] },
        items: 1,
        item_count: { $size: '$items' }
      }
    },
    { $sort: { requested_at: -1, order_number: -1 } },
    { $facet: { rows: [{ $skip: skip }, { $limit: limit }], meta: [{ $count: 'total' }] } }
  ]
  try {
    const found = await app.dbFindAll({
      from: ITEM_COLLECTION,
      nosql: { type: 'aggregate', collections: [ITEM_COLLECTION], pipeline: cbcPipeline }
    }, false, false)
    if (!found || found.success === false) return { success: false, message: 'อ่านรายการสลับ CBC ไม่สำเร็จ' }
    const aggregateRows = found.reply && Array.isArray(found.reply.data) ? found.reply.data : []
    const facet = aggregateRows[0] || {}
    const orders = Array.isArray(facet.rows) ? facet.rows : []
    const total = Array.isArray(facet.meta) && facet.meta[0] ? Number(facet.meta[0].total || 0) : 0
    return {
      success: true,
      data: { orders, total, page, limit, organization_code: organizationCode, section_codes: ['HM', 'ML'], date_scope: { from: dateFrom, to: dateTo } },
      message: 'อ่านรายการสลับ CBC สำเร็จ'
    }
  } catch (error) {
    return { success: false, message: 'อ่านรายการสลับ CBC ไม่สำเร็จ: ' + String(error && error.message || error) }
  }
}

/* ── เปิดตรวจใหม่ระดับ Item (ผู้ใช้ยืนยัน 2026-09-22) ────────────────────────
   เก็บ rejected attempt เดิมไว้ทั้ง Work Item, LAB NO., Outbound และเหตุผล
   แล้วสร้าง Work Item attempt ใหม่ใต้ CPOE Item/Order เดิม โดยยังไม่ออก LAB NO.
   Receive จะสร้าง LAB NO. และ Outbound `order_no` จาก Work Item _id ใหม่ จึงไม่
   ชน idempotency key ของรอบเดิม. เส้นทาง retest_order เดิมไม่ถูกเปลี่ยน. */
if (action === 'retest_item') {
  const itemId = valueText(params.item_id).trim()
  const requestedOrderId = valueText(params.order_id).trim()
  const requestedOrderNumber = valueText(params.order_number).trim()
  const retestReason = valueText(params.retest_reason || params.reason).trim()
  if (!/^[a-f0-9]{24}$/i.test(itemId)) {
    return { success: false, error: 'invalid_item_id', message: 'item_id ไม่ถูกต้อง' }
  }
  if (retestReason.length < 3) {
    return { success: false, error: 'retest_reason_required', message: 'กรุณาระบุเหตุผลเปิดตรวจใหม่อย่างน้อย 3 ตัวอักษร' }
  }
  if (retestReason.length > 1000) {
    return { success: false, error: 'retest_reason_too_long', message: 'เหตุผลเปิดตรวจใหม่ต้องไม่เกิน 1000 ตัวอักษร' }
  }

  const now = valueText(app.curDate('YYYY-MM-DD HH:mm:ss')).trim()
  const actorCode = valueText(userInfo.employee_code || userInfo.username || userInfo.account && (userInfo.account.code || userInfo.account.name)).trim()
  const actorName = valueText(userInfo.fullname || userInfo.display_name || userInfo.account && (userInfo.account.label || userInfo.account.name) || actorCode).trim()
  const actorId = userInfo._id || userInfo.id || userInfo.account && (userInfo.account._id || userInfo.account.id) || ''
  if (!actorCode) return { success: false, error: 'actor_missing', message: 'ไม่พบผู้ทำรายการจากบัญชีผู้ใช้' }
  const actorAudit = { id: actorId, name: actorName || actorCode }
  const active = { $nin: [0, 3] }
  const itemObjectId = app.dbObjectId(itemId)
  const itemCollection = app.db.collection(ITEM_COLLECTION)
  const orderCollection = app.db.collection(ORDER_COLLECTION)
  const masterCollection = app.db.collection(ITEM_MASTER_COLLECTION)
  const sectionCollection = app.db.collection(SECTION_COLLECTION)
  const workCollection = app.db.collection(WORK_ITEM_COLLECTION)
  const outboundCollection = app.db.collection(OUTBOUND_COLLECTION)

  const item = await itemCollection.findOne({ _id: itemObjectId, xrstatx: active })
  if (!item) return { success: false, error: 'item_not_found', message: 'ไม่พบ CPOE Item ที่ต้องการเปิดตรวจใหม่' }
  if (valueText(item.service_type && item.service_type.value).trim().toLowerCase() !== 'lab') {
    return { success: false, error: 'item_not_lab', message: 'เปิดตรวจใหม่ได้เฉพาะ LAB Item' }
  }
  const orderRef = item.order_id && item.order_id.value ? item.order_id.value : item.xparentx
  if (!orderRef) return { success: false, error: 'order_reference_missing', message: 'Item ไม่มีข้อมูลเชื่อม CPOE Order' }
  const order = await orderCollection.findOne({ _id: orderRef, xrstatx: active })
  if (!order) return { success: false, error: 'order_not_found', message: 'ไม่พบ CPOE Order ของ Item นี้' }
  const orderId = valueText(order._id).trim()
  const orderNumber = valueText(order.order_number).trim()
  if (requestedOrderId && requestedOrderId !== orderId) {
    return { success: false, error: 'order_mismatch', message: 'CPOE Order ไม่ตรงกับ Item ที่เลือก' }
  }
  if (requestedOrderNumber && requestedOrderNumber !== orderNumber) {
    return { success: false, error: 'order_number_mismatch', message: 'เลขที่ใบสั่งไม่ตรงกับ Item ที่เลือก' }
  }

  let master = null
  if (item.item_data_id) master = await masterCollection.findOne({ _id: item.item_data_id, xrstatx: active })
  let section = item.section_snapshot || item.lab_context_snapshot && item.lab_context_snapshot.section || master && master.section || {}
  if (!valueText(section.code).trim() && section.value) {
    const sectionId = typeof section.value === 'string' ? app.dbObjectId(section.value) : section.value
    const foundSection = await sectionCollection.findOne({ _id: sectionId, xrstatx: active, enable: { $ne: false } })
    if (foundSection) section = foundSection
  }
  const sectionCode = valueText(section.code).trim().toUpperCase()
  const sectionName = valueText(section.name_th || section.name || section.label || sectionCode).trim()
  if (!sectionCode || !allowedSectionCodes.includes(sectionCode)) {
    return { success: false, error: 'section_forbidden', message: 'Item นี้ไม่ได้อยู่ใน Section ของ Organization ปัจจุบัน' }
  }

  const previousWork = await workCollection.findOne({
    xrstatx: active,
    is_current_attempt: { $ne: false },
    $or: [{ _id: itemObjectId }, { source_specimen_record_id: itemId }]
  }, { sort: { attempt_no: -1, updated_at: -1, created_at: -1 } })
  if (!previousWork || valueText(previousWork.work_status).trim().toLowerCase() !== 'rejected' ||
      valueText(item.current_status).trim().toLowerCase() !== 'rejected') {
    return { success: false, error: 'item_not_rejected', message: 'เปิดตรวจใหม่ได้เฉพาะ Item ที่ถูกปฏิเสธอยู่' }
  }
  if (valueText(previousWork.resulted_at || previousWork.completed_at || item.resulted_at).trim()) {
    return { success: false, error: 'result_exists', message: 'Item นี้มีผลตรวจแล้ว ต้องใช้ขั้นตอนแก้ไข/ทบทวนผล ไม่สามารถเปิดตรวจใหม่จากการปฏิเสธได้' }
  }

  const previousWorkItemId = valueText(previousWork._id).trim()
  const previousOutbound = await outboundCollection.findOne({
    xrstatx: active,
    $or: [
      { _id: previousWork._id },
      { work_item_id: previousWorkItemId },
      { order_no: previousWorkItemId }
    ]
  })
  if (previousOutbound) {
    const outboundStatus = valueText(previousOutbound.hl7_status).trim().toLowerCase()
    const cancelled = outboundStatus === 'cancelled'
    const attempted = Number(previousOutbound.attempt_count || 0) > 0 ||
      Boolean(valueText(previousOutbound.sent_at || previousOutbound.last_success_at).trim()) ||
      !['', 'new', 'pending', 'ready', 'cancelled'].includes(outboundStatus)
    if (!cancelled && attempted) {
      return { success: false, error: 'lis_cancel_required', message: 'รอบเดิมถูกส่งไป Agent/LIS แล้ว ต้องยืนยันการยกเลิกฝั่ง LIS ก่อนเปิดตรวจใหม่' }
    }
    if (!cancelled) {
      return { success: false, error: 'outbound_not_cancelled', message: 'Outbound รอบเดิมยังไม่ถูกยกเลิก กรุณาปฏิเสธ Item ให้สำเร็จก่อนเปิดตรวจใหม่' }
    }
  }

  const labData = item.lab_data && typeof item.lab_data === 'object' ? item.lab_data : {}
  const masterLab = master && master.lab_item && typeof master.lab_item === 'object' ? master.lab_item : {}
  const masterSpecimen = masterLab.specimen && !Array.isArray(masterLab.specimen) ? masterLab.specimen : {}
  const patient = order.vid && order.vid.pid || {}
  const patientHn = valueText(patient.hn).trim()
  const patientName = [valueText(patient.prename), valueText(patient.p_fname || patient.first_name), valueText(patient.p_lname || patient.last_name)]
    .map(value => value.trim()).filter(Boolean).join(' ') || patientHn
  const attemptNo = Math.max(1, Number(previousWork.attempt_no || 1)) + 1
  const candidate = {
    xparentx: itemObjectId,
    xsitex: userInfo.site || {},
    xunitx: { code: sectionCode, name: sectionName },
    xrstatx: 1,
    xversionx: 'v1',
    xerrorx: null,
    dataid: '',
    created_by: actorAudit,
    created_at: now,
    updated_by: actorAudit,
    updated_at: now,
    source_order_id: orderId,
    source_order_number: orderNumber,
    source_specimen_record_id: itemId,
    previous_work_item_id: previousWorkItemId,
    retest_of_work_item_id: previousWorkItemId,
    attempt_no: attemptNo,
    is_current_attempt: false,
    attempt_status: 'opening',
    work_status: 'waiting_receive',
    lab_no: '',
    retest_pending_lab_no: true,
    retest_reason: retestReason,
    retest_at: now,
    retest_by: actorAudit,
    section_code: sectionCode,
    section_name: sectionName,
    patient_hn: patientHn,
    visit_id: valueText(order.vid && (order.vid.vn || order.vid.value) || order.xparentx).trim(),
    patient_name: patientName,
    ward_clinic: valueText(order.vid && (order.vid.ward || order.vid.visit_clinic)).trim(),
    ordered_at: valueText(order.created_at).trim(),
    specimen_json: valueText(previousWork.specimen_json).trim() || JSON.stringify({
      code: valueText(labData.spec_source_code || masterSpecimen.code).trim(),
      name: valueText(labData.spec_source || labData.source || masterSpecimen.name).trim(),
      collected_at: '',
      collected_by: ''
    }),
    selected_items_json: valueText(previousWork.selected_items_json).trim() || JSON.stringify([{
      seq: Number(item.item_no || 1),
      source_item_id: itemId,
      item_code: valueText(item.item_code).trim(),
      item_name: valueText(item.item_name || master && master.item_name).trim(),
      test_code: valueText(masterLab.his_lab_code).trim(),
      specimen_code: valueText(labData.spec_source_code || masterSpecimen.code).trim()
    }])
  }

  let inserted
  try {
    inserted = await workCollection.insertOne(candidate)
  } catch (error) {
    return { success: false, error: 'retest_attempt_create_failed', message: 'สร้างรอบตรวจใหม่ไม่สำเร็จ กรุณาลองใหม่' }
  }
  const newWorkRawId = inserted && inserted.insertedId || candidate._id
  const newWorkItemId = valueText(newWorkRawId).trim()
  if (!newWorkItemId) {
    return { success: false, error: 'retest_attempt_id_missing', message: 'สร้างรอบตรวจใหม่แล้วแต่ไม่พบรหัส Work Item กรุณาให้ผู้ดูแลตรวจสอบ' }
  }
  const newWorkObjectId = typeof newWorkRawId === 'string' ? app.dbObjectId(newWorkRawId) : newWorkRawId
  const previousSaved = await workCollection.updateOne(
    { _id: previousWork._id, xrstatx: active, work_status: 'rejected', is_current_attempt: { $ne: false } },
    { $set: { is_current_attempt: false, replaced_by_work_item_id: newWorkItemId, reopened_at: now, reopened_by: actorAudit, updated_at: now, updated_by: actorAudit }, $push: { retest_log: { to_work_item_id: newWorkItemId, attempt_no: attemptNo, reason: retestReason, at: now, by: actorAudit } } }
  )
  if (!previousSaved || Number(previousSaved.matchedCount) !== 1) {
    await workCollection.updateOne({ _id: newWorkObjectId, xrstatx: active }, { $set: { attempt_status: 'void', void_reason: 'retest_race_lost', updated_at: now, updated_by: actorAudit } })
    return { success: false, error: 'retest_race_lost', message: 'สถานะ Item เปลี่ยนระหว่างเปิดตรวจใหม่ กรุณาโหลดใหม่' }
  }
  const candidateSaved = await workCollection.updateOne(
    { _id: newWorkObjectId, xrstatx: active, attempt_status: 'opening', is_current_attempt: false },
    { $set: { dataid: newWorkItemId, is_current_attempt: true, attempt_status: 'active', updated_at: now, updated_by: actorAudit } }
  )
  if (!candidateSaved || Number(candidateSaved.matchedCount) !== 1) {
    await workCollection.updateOne({ _id: newWorkObjectId, xrstatx: active }, { $set: { is_current_attempt: false, attempt_status: 'void', void_reason: 'activation_failed', updated_at: now, updated_by: actorAudit } })
    await workCollection.updateOne({ _id: previousWork._id, xrstatx: active }, { $set: { is_current_attempt: true, replaced_by_work_item_id: '', updated_at: now, updated_by: actorAudit } })
    return { success: false, error: 'retest_attempt_activate_failed', message: 'เปิดรอบตรวจใหม่ไม่สำเร็จและคืนรอบเดิมแล้ว กรุณาลองใหม่' }
  }
  const itemSaved = await itemCollection.updateOne(
    { _id: itemObjectId, xrstatx: active, current_status: 'rejected' },
    {
      $set: {
        current_status: 'sent',
        current_work_item_id: newWorkItemId,
        retest_at: now,
        retest_by: actorAudit,
        retest_reason: retestReason,
        updated_at: now,
        updated_by: actorCode
      },
      $push: {
        rejection_history: {
          work_item_id: previousWorkItemId,
          lab_no: valueText(previousWork.lab_no).trim(),
          rejection_record_id: valueText(previousWork.rejection_record_id).trim(),
          reject_reason_code: valueText(previousWork.reject_reason_code).trim(),
          reject_reason_detail: valueText(previousWork.reject_reason_detail).trim(),
          rejected_at: valueText(previousWork.rejected_at).trim(),
          rejected_by: previousWork.rejected_by || '',
          reopened_as_work_item_id: newWorkItemId,
          retest_reason: retestReason,
          reopened_at: now,
          reopened_by: actorAudit
        }
      }
    }
  )
  if (!itemSaved || Number(itemSaved.matchedCount) !== 1) {
    await workCollection.updateOne({ _id: newWorkObjectId, xrstatx: active }, { $set: { is_current_attempt: false, attempt_status: 'void', void_reason: 'cpoe_status_conflict', updated_at: now, updated_by: actorAudit } })
    await workCollection.updateOne({ _id: previousWork._id, xrstatx: active }, { $set: { is_current_attempt: true, replaced_by_work_item_id: '', updated_at: now, updated_by: actorAudit } })
    return { success: false, error: 'retest_race_lost', message: 'สถานะ CPOE Item เปลี่ยนระหว่างเปิดตรวจใหม่ กรุณาโหลดใหม่' }
  }

  return {
    success: true,
    data: {
      item_id: itemId,
      order_id: orderId,
      order_number: orderNumber,
      section_code: sectionCode,
      previous_work_item_id: previousWorkItemId,
      work_item_id: newWorkItemId,
      attempt_no: attemptNo,
      current_status: 'sent',
      work_status: 'waiting_receive',
      retest_pending_lab_no: true,
      retest_reason: retestReason
    },
    message: 'เปิดตรวจใหม่เฉพาะรายการแล้ว · กลับไปรอรับ specimen · LAB NO. ใหม่จะสร้างเมื่อกดรับ'
  }
}

/* ── ตรวจใหม่ (ผู้ใช้สั่ง 2026-09-04) ────────────────────────────────────────
   เปิดเฉพาะ LAB Item ที่ถูกยกเลิก/ปฏิเสธใน Section ของแถวเดิมกลับเป็น "รอรับ"
   โดยใช้ CPOE Order/Item เดิม ไม่แก้ Order header และไม่ลบประวัติผลหรือการยกเลิกเดิม

   Lab Work Item ใช้ _id เดียวกับ CPOE Item จึงสร้างแถวใหม่ซ้อนเดิมไม่ได้อย่างปลอดภัย:
   reset รอบงานเดิมเป็น waiting_receive, เก็บ LAB NO. เดิมใน lab_no_history[], ล้างเลขเดิม
   และตั้ง retest_pending_lab_no เพื่อให้ Receive เรียก Lab No. Generator ตอนผู้ใช้กดรับ specimen
   Outbound เดิม reset กลับเป็น new แต่เก็บ attempt/history ของรอบก่อน และตั้ง marker
   ให้ Receive สร้าง payload ใหม่หลังได้ LAB NO. ใหม่ โดยยังใช้ CPOE Order/Item เดิม */
if (action === 'retest_order') {
  const orderId = valueText(params.order_id).trim()
  const requestedOrderNumber = valueText(params.order_number).trim()
  if (!/^[a-f0-9]{24}$/i.test(orderId)) {
    return { success: false, error: 'invalid_order_id', message: 'order_id ไม่ถูกต้อง' }
  }
  if (allowedSectionCodes.length !== 1) {
    return { success: false, error: 'retest_section_required', message: 'กรุณาระบุ Section ของแถว Order ที่ต้องการตรวจใหม่' }
  }

  const now = valueText(app.curDate('YYYY-MM-DD HH:mm:ss')).trim()
  const actorCode = valueText(userInfo.employee_code || userInfo.username || userInfo.account && (userInfo.account.code || userInfo.account.name)).trim()
  const actorName = valueText(userInfo.fullname || userInfo.display_name || userInfo.account && (userInfo.account.label || userInfo.account.name) || actorCode).trim()
  const actorId = userInfo._id || userInfo.id || userInfo.account && (userInfo.account._id || userInfo.account.id) || ''
  if (!actorCode) {
    return { success: false, error: 'actor_missing', message: 'ไม่พบผู้ทำรายการจากบัญชีผู้ใช้' }
  }
  const actorAudit = { id: actorId, name: actorName || actorCode }
  const active = { $nin: [0, 3] }
  const terminalStatuses = ['cancelled', 'rejected', 'returned', 'reversed']
  const sectionCode = allowedSectionCodes[0]

  const orderObjectId = app.dbObjectId(orderId)
  const orderCollection = app.db.collection(ORDER_COLLECTION)
  const itemCollection = app.db.collection(ITEM_COLLECTION)
  const masterCollection = app.db.collection(ITEM_MASTER_COLLECTION)
  const sectionCollection = app.db.collection(SECTION_COLLECTION)
  const workCollection = app.db.collection(WORK_ITEM_COLLECTION)
  const outboundCollection = app.db.collection(OUTBOUND_COLLECTION)
  const cancellationCollection = app.db.collection(ORDER_CANCELLATION_COLLECTION)
  const order = await orderCollection.findOne({ _id: orderObjectId, xrstatx: active })
  if (!order) return { success: false, error: 'order_not_found', message: 'ไม่พบ CPOE Order ที่ต้องการตรวจใหม่' }
  const orderNumber = valueText(order.order_number).trim()
  if (requestedOrderNumber && requestedOrderNumber !== orderNumber) {
    return { success: false, error: 'order_number_mismatch', message: 'เลขที่ใบสั่งไม่ตรงกับ Order ที่เลือก' }
  }

  const serviceTypeOf = item => valueText(
    item && item.service_type && item.service_type.value != null
      ? item.service_type.value
      : item && item.service_type
  ).trim().toLowerCase()
  const orderLinks = [orderObjectId, orderId]
  const allItems = await itemCollection.find({
    xrstatx: active,
    $or: [
      { 'order_id.value': { $in: orderLinks } },
      { order_ref_id: { $in: orderLinks } },
      { xparentx: { $in: orderLinks } }
    ]
  }).toArray()
  const labItems = allItems.filter(item => serviceTypeOf(item) === 'lab')
  if (!labItems.length) {
    return { success: false, error: 'lab_items_not_found', message: 'Order นี้ไม่มี LAB Item ที่ตรวจใหม่ได้' }
  }

  const contexts = []
  let outOfScopeItemCount = 0
  for (let index = 0; index < labItems.length; index += 1) {
    const item = labItems[index]
    const itemId = valueText(item._id).trim()
    let master = null
    if (item.item_data_id) master = await masterCollection.findOne({ _id: item.item_data_id, xrstatx: active })
    let resolvedSection = item.section_snapshot || item.lab_context_snapshot && item.lab_context_snapshot.section || master && master.section || {}
    if (!valueText(resolvedSection.code).trim() && resolvedSection.value) {
      const sectionId = typeof resolvedSection.value === 'string' ? app.dbObjectId(resolvedSection.value) : resolvedSection.value
      const foundSection = await sectionCollection.findOne({ _id: sectionId, xrstatx: active, enable: { $ne: false } })
      if (foundSection) resolvedSection = foundSection
    }
    const resolvedCode = valueText(resolvedSection.code).trim().toUpperCase()
    if (resolvedCode !== sectionCode) {
      outOfScopeItemCount += 1
      continue
    }
    const workItem = await workCollection.findOne({
      xrstatx: active,
      $or: [{ _id: item._id }, { source_specimen_record_id: itemId }]
    })
    const outbound = await outboundCollection.findOne({
      xrstatx: active,
      $or: [{ _id: item._id }, { source_cpoe_item_id: itemId }, { work_item_id: itemId }]
    })
    contexts.push({ item, itemId, workItem, outbound })
  }
  if (!contexts.length) {
    return { success: false, error: 'section_items_not_found', message: 'Order นี้ไม่มี Item ใน Section ที่เลือก' }
  }

  const targets = contexts.filter(context => {
    const cpoeStatus = valueText(context.item.current_status).trim().toLowerCase()
    const workStatus = valueText(context.workItem && context.workItem.work_status).trim().toLowerCase()
    return terminalStatuses.includes(cpoeStatus) && (!context.workItem || terminalStatuses.includes(workStatus))
  })
  if (!targets.length) {
    return { success: false, error: 'nothing_to_retest', message: 'Order นี้ไม่มีรายการที่ยกเลิกหรือปฏิเสธไว้ จึงไม่ต้องตรวจใหม่' }
  }

  for (let index = 0; index < targets.length; index += 1) {
    const context = targets[index]
    if (context.outbound && !context.workItem) {
      return { success: false, error: 'retest_data_conflict', message: 'พบ Outbound แต่ไม่พบ Lab Work Item กรุณาให้ผู้ดูแลตรวจสอบก่อนเปิดตรวจใหม่' }
    }
  }

  let reopened = 0
  let clearedLabNo = 0
  let pendingLabNo = 0
  for (let index = 0; index < targets.length; index += 1) {
    const context = targets[index]
    const cpoeStatus = valueText(context.item.current_status).trim().toLowerCase()
    const previousLabNo = valueText(context.workItem && context.workItem.lab_no || context.item.lab_no).trim()
    if (context.workItem) {
      const workUpdate = {
        $set: {
          work_status: 'waiting_receive',
          lab_no: '',
          retest_pending_lab_no: true,
          received_at: '',
          received_by: '',
          resulted_at: '',
          resulted_by: '',
          completed_at: '',
          completed_by: '',
          cancellation_record_id: '',
          cancel_type: '',
          cancel_reason: '',
          cancelled_at: '',
          cancelled_by: '',
          rejection_record_id: '',
          reject_reason_code: '',
          reject_reason_detail: '',
          rejected_at: '',
          rejected_by: '',
          retest_at: now,
          retest_by: actorAudit,
          updated_at: now,
          updated_by: actorAudit
        },
        $push: {
          retest_log: { from_status: valueText(context.workItem.work_status).trim().toLowerCase(), to_status: 'waiting_receive', cleared_lab_no: previousLabNo, new_lab_no: '', at: now, by: actorAudit }
        }
      }
      if (previousLabNo) {
        workUpdate.$push.lab_no_history = { lab_no: previousLabNo, cleared_at: now, cleared_by: actorAudit, reason: 'retest' }
        clearedLabNo += 1
      }
      const workSaved = await workCollection.updateOne(
        { _id: context.workItem._id, xrstatx: active, work_status: valueText(context.workItem.work_status) },
        workUpdate
      )
      if (!workSaved || Number(workSaved.matchedCount) !== 1) {
        return { success: false, error: 'retest_race_lost', message: 'สถานะ Lab Work Item เปลี่ยนระหว่างเปิดตรวจใหม่ กรุณาโหลดใหม่แล้วลองอีกครั้ง', data: { reopened_item_count: reopened } }
      }
      pendingLabNo += 1
    }
    if (context.outbound) {
      const previousOutboundStatus = valueText(context.outbound.hl7_status).trim().toLowerCase()
      const previousAttemptCount = Number(context.outbound.attempt_count || 0)
      const outboundSaved = await outboundCollection.updateOne(
        { _id: context.outbound._id, xrstatx: active, attempt_count: previousAttemptCount, hl7_status: context.outbound.hl7_status },
        { $set: {
          lab_no: '',
          hl7_status: 'new',
          retest_pending_outbound: true,
          retryable: true,
          request_payload_json: '',
          response_payload_json: '',
          dispatch_id: '',
          order_ref: '',
          routed_to_json: '[]',
          agent_http_status: null,
          agent_duplicate: false,
          queued_at: '',
          last_status_at: now,
          last_error_code: '',
          last_error_http_status: '',
          last_error_at: '',
          last_error_reason: '',
          last_error_detail_json: '',
          sent_at: '',
          last_success_at: '',
          retest_at: now,
          retest_by: actorAudit,
          updated_at: now,
          updated_by: actorCode
        }, $push: { retest_log: {
          previous_lab_no: previousLabNo,
          previous_hl7_status: previousOutboundStatus,
          previous_attempt_count: previousAttemptCount,
          previous_dispatch_id: valueText(context.outbound.dispatch_id),
          previous_order_ref: valueText(context.outbound.order_ref),
          new_lab_no: '',
          at: now,
          by: actorAudit
        } } }
      )
      if (!outboundSaved || Number(outboundSaved.matchedCount) !== 1) {
        return { success: false, error: 'retest_race_lost', message: 'สถานะ Outbound เปลี่ยนระหว่างเปิดตรวจใหม่ กรุณาให้ผู้ดูแลตรวจสอบ', data: { reopened_item_count: reopened } }
      }
    }
    const itemSaved = await itemCollection.updateOne(
      { _id: context.item._id, xrstatx: active, current_status: valueText(context.item.current_status) },
      { $set: {
        current_status: 'sent',
        lab_no: '',
        received_at: '',
        received_by: '',
        work_item_id: '',
        cancellation_record_id: '',
        cancel_type: '',
        cancel_reason: '',
        cancelled_at: '',
        cancelled_by: '',
        rejection_record_id: '',
        reject_reason_code: '',
        reject_reason_detail: '',
        rejected_at: '',
        rejected_by: '',
        retest_at: now,
        retest_by: actorAudit,
        updated_at: now,
        updated_by: actorCode
      }, $push: { retest_log: { from_status: cpoeStatus, to_status: 'sent', cleared_lab_no: previousLabNo, new_lab_no: '', at: now, by: actorAudit } } }
    )
    if (!itemSaved || Number(itemSaved.matchedCount) !== 1) {
      return { success: false, error: 'retest_race_lost', message: 'สถานะ CPOE Item เปลี่ยนระหว่างเปิดตรวจใหม่ กรุณาโหลดใหม่และให้ผู้ดูแลตรวจสอบ', data: { reopened_item_count: reopened } }
    }
    reopened += 1
  }

  const scopeItemId = contexts.map(context => context.itemId).sort()[0]
  const cancellationObjectId = app.dbObjectId(outOfScopeItemCount ? scopeItemId : orderId)
  let auditSyncPending = false
  let cancellation = await cancellationCollection.findOne({ _id: cancellationObjectId, xrstatx: active })
  if (!cancellation && outOfScopeItemCount) {
    const legacyCancellation = await cancellationCollection.findOne({ _id: orderObjectId, xrstatx: active })
    const legacyScope = valueText(legacyCancellation && legacyCancellation.cancel_scope).trim().toLowerCase()
    const legacySections = listText(legacyCancellation && legacyCancellation.section_codes).map(code => code.toUpperCase())
    if (legacyCancellation && (legacyScope !== 'section' || legacySections.includes(sectionCode))) {
      cancellation = legacyCancellation
    }
  }
  if (cancellation) {
    try {
      const stamped = await cancellationCollection.updateOne(
        { _id: cancellation._id, xrstatx: active, cancel_status: { $in: ['pending', 'applied', 'reopened'] } },
        { $set: { cancel_status: 'reopened', reopened_at: now, reopened_by: actorAudit, updated_at: now, updated_by: actorAudit }, $push: { reopen_log: { at: now, by: actorAudit, reopened_item_count: reopened, section_code: sectionCode } } }
      )
      auditSyncPending = !stamped || Number(stamped.matchedCount) !== 1
    } catch (error) {
      auditSyncPending = true
    }
  }

  return {
    success: true,
    data: {
      order_id: orderId,
      order_number: orderNumber,
      section_code: sectionCode,
      current_status: 'sent',
      work_status: 'waiting_receive',
      reopened_item_count: reopened,
      cleared_lab_no_count: clearedLabNo,
      pending_lab_no_count: pendingLabNo,
      audit_sync_pending: auditSyncPending
    },
    message: 'เปิดตรวจใหม่แล้ว ' + reopened + ' รายการ · กลับไปสถานะรอรับ' +
      (pendingLabNo ? ' · LAB NO. ใหม่จะสร้างเมื่อกดรับ specimen' : '') +
      (auditSyncPending ? ' (Cancellation Log ยังรอ reconcile)' : '')
  }
}


if (action === 'cancel_order' || action === 'check_cancel_finance') {
  const isCancelWrite = action === 'cancel_order'
  const orderId = valueText(params.order_id).trim()
  const requestedOrderNumber = valueText(params.order_number).trim()
  const cancelReason = valueText(params.cancel_reason || params.reason).trim()
  if (!/^[a-f0-9]{24}$/i.test(orderId)) {
    return { success: false, error: 'invalid_order_id', message: 'order_id ไม่ถูกต้อง' }
  }
  if (isCancelWrite && !cancelReason) {
    return { success: false, error: 'cancel_reason_missing', message: 'กรุณาระบุเหตุผลการยกเลิก Order' }
  }
  if (isCancelWrite && cancelReason.length > 1000) {
    return { success: false, error: 'cancel_reason_too_long', message: 'เหตุผลการยกเลิกต้องไม่เกิน 1000 ตัวอักษร' }
  }
  if (allowedSectionCodes.length !== 1) {
    return { success: false, error: 'cancel_section_required', message: 'กรุณาระบุ Section ของแถว Order ที่ต้องการยกเลิก' }
  }
  const cancelSectionCode = allowedSectionCodes[0]

  const now = valueText(app.curDate('YYYY-MM-DD HH:mm:ss')).trim()
  const actorCode = valueText(userInfo.employee_code || userInfo.username || userInfo.account && (userInfo.account.code || userInfo.account.name)).trim()
  const actorName = valueText(userInfo.fullname || userInfo.display_name || userInfo.account && (userInfo.account.label || userInfo.account.name) || actorCode).trim()
  const actorId = userInfo._id || userInfo.id || userInfo.account && (userInfo.account._id || userInfo.account.id) || ''
  if (isCancelWrite && !actorCode) {
    return { success: false, error: 'actor_missing', message: 'ไม่พบผู้ยกเลิกจากบัญชีผู้ใช้' }
  }
  const actorAudit = { id: actorId, name: actorName || actorCode }
  const orderObjectId = app.dbObjectId(orderId)
  const active = { $nin: [0, 3] }
  const orderCollection = app.db.collection(ORDER_COLLECTION)
  const itemCollection = app.db.collection(ITEM_COLLECTION)
  const masterCollection = app.db.collection(ITEM_MASTER_COLLECTION)
  const sectionCollection = app.db.collection(SECTION_COLLECTION)
  const workCollection = app.db.collection(WORK_ITEM_COLLECTION)
  const outboundCollection = app.db.collection(OUTBOUND_COLLECTION)
  const cancellationCollection = app.db.collection(ORDER_CANCELLATION_COLLECTION)
  const billCollection = app.db.collection(BILL_COLLECTION)
  const billItemCollection = app.db.collection(BILL_ITEM_COLLECTION)
  const terminalCpoeStatuses = ['completed', 'rejected', 'cancelled']
  const syncCpoeCancelled = async (context, cancellationPatch) => {
    const current = await itemCollection.findOne({ _id: context.item._id, xrstatx: active })
    if (!current) throw new Error('CPOE_ITEM_NOT_FOUND')
    const currentStatus = valueText(current.current_status).trim().toLowerCase()
    if (currentStatus === 'cancelled') return { status: currentStatus, changed: false, preservedTerminal: false }
    if (terminalCpoeStatuses.includes(currentStatus)) {
      return { status: currentStatus, changed: false, preservedTerminal: true }
    }
    const saved = await itemCollection.updateOne(
      { _id: context.item._id, xrstatx: active, current_status: { $nin: terminalCpoeStatuses } },
      { $set: { current_status: 'cancelled', ...(cancellationPatch || {}) } }
    )
    if (saved && Number(saved.matchedCount) === 1) {
      return { status: 'cancelled', changed: true, preservedTerminal: false }
    }
    const raced = await itemCollection.findOne({ _id: context.item._id, xrstatx: active })
    const racedStatus = valueText(raced && raced.current_status).trim().toLowerCase()
    if (terminalCpoeStatuses.includes(racedStatus)) {
      return { status: racedStatus, changed: false, preservedTerminal: racedStatus !== 'cancelled' }
    }
    throw new Error('CPOE_STATUS_SYNC_CONFLICT')
  }
  const serviceTypeOf = item => valueText(
    item && item.service_type && item.service_type.value != null
      ? item.service_type.value
      : item && item.service_type
  ).trim().toLowerCase()
  const orderLinks = [orderObjectId, orderId]

  const order = await orderCollection.findOne({ _id: orderObjectId, xrstatx: active })
  if (!order) return { success: false, error: 'order_not_found', message: 'ไม่พบ CPOE Order ที่ต้องการยกเลิก' }
  const orderNumber = valueText(order.order_number).trim()
  if (requestedOrderNumber && requestedOrderNumber !== orderNumber) {
    return { success: false, error: 'order_number_mismatch', message: 'เลขที่ใบสั่งไม่ตรงกับ Order ที่เลือก' }
  }

  const allItems = await itemCollection.find({
    xrstatx: active,
    $or: [
      { 'order_id.value': { $in: orderLinks } },
      { order_ref_id: { $in: orderLinks } },
      { xparentx: { $in: orderLinks } }
    ]
  }).toArray()
  const labItems = allItems.filter(item => serviceTypeOf(item) === 'lab')
  if (!labItems.length) {
    return { success: false, error: 'lab_items_not_found', message: 'Order นี้ไม่มี LAB Item ที่ยกเลิกได้' }
  }

  const contexts = []
  let outOfScopeItemCount = 0
  for (let index = 0; index < labItems.length; index += 1) {
    const item = labItems[index]
    const itemId = valueText(item._id).trim()
    let master = null
    if (item.item_data_id) master = await masterCollection.findOne({ _id: item.item_data_id, xrstatx: active })
    let section = item.section_snapshot || item.lab_context_snapshot && item.lab_context_snapshot.section || master && master.section || {}
    if (!valueText(section.code).trim() && section.value) {
      const sectionId = typeof section.value === 'string' ? app.dbObjectId(section.value) : section.value
      const foundSection = await sectionCollection.findOne({ _id: sectionId, xrstatx: active, enable: { $ne: false } })
      if (foundSection) section = foundSection
    }
    const sectionCode = valueText(section.code).trim().toUpperCase()
    if (!sectionCode) {
      return { success: false, error: 'section_missing', message: 'ไม่พบห้อง LAB ของ Item ' + (valueText(item.item_code).trim() || itemId) }
    }
    if (!selectedSectionLookup[sectionCode]) {
      outOfScopeItemCount += 1
      continue
    }
    const workItem = await workCollection.findOne({
      xrstatx: active,
      $or: [{ _id: item._id }, { source_specimen_record_id: itemId }]
    })
    const outbound = await outboundCollection.findOne({
      xrstatx: active,
      $or: [{ _id: item._id }, { source_cpoe_item_id: itemId }, { work_item_id: itemId }]
    })
    contexts.push({ item, itemId, master, section, sectionCode, workItem, outbound })
  }
  if (!contexts.length) {
    return { success: false, error: 'section_items_not_found', message: 'Order นี้ไม่มี Item ใน Section ที่เลือก' }
  }

  const terminalStatuses = ['cancelled', 'rejected', 'returned', 'reversed']
  const scopeItemId = contexts.map(context => context.itemId).sort()[0]
  const cancellationObjectId = app.dbObjectId(outOfScopeItemCount ? scopeItemId : orderId)
  let cancellation = await cancellationCollection.findOne({ _id: cancellationObjectId, xrstatx: active })
  if (!cancellation && outOfScopeItemCount) {
    const legacyCancellation = await cancellationCollection.findOne({ _id: orderObjectId, xrstatx: active })
    const legacyScope = valueText(legacyCancellation && legacyCancellation.cancel_scope).trim().toLowerCase()
    const legacySections = listText(legacyCancellation && legacyCancellation.section_codes).map(code => code.toUpperCase())
    if (legacyCancellation && (legacyScope !== 'section' || legacySections.includes(cancelSectionCode))) {
      cancellation = legacyCancellation
    }
  }
  const cancellable = []
  for (let index = 0; index < contexts.length; index += 1) {
    const context = contexts[index]
    const workStatus = valueText(context.workItem && context.workItem.work_status).trim().toLowerCase()
    const cpoeStatus = valueText(context.item.current_status).trim().toLowerCase()
    const status = workStatus || cpoeStatus
    if (terminalStatuses.includes(status)) continue
    // 2026-09-25: cancellation is intentionally HIS-only. A previously sent
    // Outbound row must neither block the HIS cancellation nor trigger a new
    // Agent/LIS cancellation message. Unsent queue rows are stopped below so
    // they cannot leave HIS after the user cancels the Order.
    if (context.workItem) {
      if (!['waiting_receive', 'received'].includes(workStatus)) {
        return { success: false, error: 'item_not_cancellable', message: 'ยกเลิก Order ไม่ได้ เพราะมี Item อยู่ในสถานะ ' + (workStatus || 'ไม่ทราบสถานะ') }
      }
    } else {
      const hasReceiptEvidence = Boolean(valueText(context.item.received_at || context.item.lab_no).trim())
      const effectiveStatus = LEGACY_WAITING_CPOE_STATUSES.includes(cpoeStatus) && !hasReceiptEvidence ? 'sent' : cpoeStatus
      if (!['sent', 'ready'].includes(effectiveStatus)) {
        return { success: false, error: 'item_not_cancellable', message: 'ยกเลิก Order ไม่ได้ เพราะมี Item ที่ไม่อยู่ในสถานะรอรับ' }
      }
    }
    cancellable.push(context)
  }

  if (!cancellable.length && !cancellation) {
    return { success: false, error: 'nothing_to_cancel', message: 'Order นี้ไม่มีรายการที่ยกเลิกได้' }
  }
  if (cancellation && valueText(cancellation.cancel_status).trim().toLowerCase() === 'conflict') {
    return { success: false, error: 'cancel_conflict', message: 'Order นี้เคยยกเลิกไม่สำเร็จเพราะสถานะเปลี่ยน กรุณาให้ผู้ดูแลตรวจสอบ' }
  }

  // Finance preflight is executed both when the dialog opens and again inside
  // the write action. The second check is authoritative and closes the race
  // where a receipt is issued after the popup was opened.
  const financeTerminalItemStatuses = ['cancelled', 'void', 'refunded', 'reversed']
  const financeTerminalBillStatuses = ['cancelled', 'void', 'refunded', 'reversed']
  const financeOpenBillStatuses = ['', 'draft', 'issued', 'open', 'pending']
  const targetFinanceItemIds = cancellable.map(context => context.item._id)
  const allFinanceBillItems = targetFinanceItemIds.length
    ? await billItemCollection.find({
      xrstatx: active,
      'order_item.value': { $in: targetFinanceItemIds }
    }).toArray()
    : []
  const activeFinanceBillItems = allFinanceBillItems.filter(row => {
    const status = valueText(row && row.item_status).trim().toLowerCase()
    return !financeTerminalItemStatuses.includes(status)
  })
  const financeBillIds = activeFinanceBillItems
    .map(row => row && row.bill_id && row.bill_id.value)
    .filter(Boolean)
    .filter((value, index, rows) => rows.findIndex(other => valueText(other) === valueText(value)) === index)
  const financeBills = financeBillIds.length
    ? await billCollection.find({ _id: { $in: financeBillIds }, xrstatx: active }).toArray()
    : []
  const financeBillById = {}
  financeBills.forEach(bill => { financeBillById[valueText(bill && bill._id)] = bill })
  const unpaidFinanceBillItems = []
  const withdrawnFinanceBillItems = []
  const paidFinanceBillItems = []
  const unknownFinanceBillItems = []
  const activeReceiptNumbers = []
  activeFinanceBillItems.forEach(billItem => {
    const billId = valueText(billItem && billItem.bill_id && billItem.bill_id.value).trim()
    const bill = financeBillById[billId]
    if (!bill) {
      unknownFinanceBillItems.push(billItem)
      return
    }
    const billStatus = valueText(bill.bill_status).trim().toLowerCase()
    const receiptNumber = valueText(bill.receipt_number).trim()
    const isRefund = bill.is_refund === true || ['true', '1'].includes(valueText(bill.is_refund).trim().toLowerCase())
    if (isRefund || financeTerminalBillStatuses.includes(billStatus)) {
      withdrawnFinanceBillItems.push(billItem)
      return
    }
    if (billStatus === 'paid' || receiptNumber) {
      paidFinanceBillItems.push(billItem)
      if (receiptNumber && !activeReceiptNumbers.includes(receiptNumber)) activeReceiptNumbers.push(receiptNumber)
      return
    }
    if (financeOpenBillStatuses.includes(billStatus)) {
      unpaidFinanceBillItems.push(billItem)
      return
    }
    unknownFinanceBillItems.push(billItem)
  })

  let financeStatus = 'not_billed'
  let financeMessage = 'ยังไม่มีรายการการเงินของ LAB Item ชุดนี้ สามารถยกเลิกได้'
  let financeCanCancel = true
  if (paidFinanceBillItems.length) {
    financeStatus = 'paid_receipt_active'
    financeCanCancel = false
    financeMessage = 'พบใบเสร็จที่ยังใช้งานอยู่ กรุณาโทรแจ้งการเงินให้ถอนใบเสร็จก่อน แล้วกดตรวจสอบสถานะการเงินอีกครั้ง'
  } else if (unknownFinanceBillItems.length) {
    financeStatus = 'review_required'
    financeCanCancel = false
    financeMessage = 'ข้อมูลการเงินของรายการนี้ไม่สมบูรณ์ กรุณาให้การเงินตรวจสอบก่อนยกเลิก'
  } else if (unpaidFinanceBillItems.length) {
    financeStatus = 'unpaid'
    financeMessage = 'รายการยังไม่ชำระเงิน สามารถยกเลิกได้ทันที'
  } else if (withdrawnFinanceBillItems.length) {
    financeStatus = 'receipt_withdrawn'
    financeMessage = 'การเงินถอนใบเสร็จแล้ว สามารถยกเลิกได้'
  }
  const financeData = {
    can_cancel: financeCanCancel,
    finance_status: financeStatus,
    finance_message: financeMessage,
    active_bill_item_count: activeFinanceBillItems.length,
    unpaid_bill_item_count: unpaidFinanceBillItems.length,
    withdrawn_bill_item_count: withdrawnFinanceBillItems.length,
    paid_bill_item_count: paidFinanceBillItems.length,
    unknown_bill_item_count: unknownFinanceBillItems.length,
    receipt_numbers: activeReceiptNumbers
  }

  if (!isCancelWrite) {
    return {
      success: true,
      data: {
        order_id: orderId,
        order_number: orderNumber,
        cancel_scope: 'section',
        section_code: cancelSectionCode,
        section_codes: [cancelSectionCode],
        ...financeData
      },
      message: financeMessage
    }
  }
  if (!financeCanCancel) {
    return {
      success: false,
      error: financeStatus === 'paid_receipt_active' ? 'finance_receipt_active' : 'finance_state_unknown',
      data: financeData,
      message: financeMessage
    }
  }

  let alreadyCancelled = Boolean(cancellation)
  if (!cancellation) {
    const cancellationDoc = {
      _id: cancellationObjectId,
      xparentx: orderObjectId,
      xsitex: userInfo.site || {},
      xunitx: userInfo.unit || {},
      xrstatx: 1,
      xversionx: 'v1',
      dataid: orderId,
      source_order_id: orderId,
      source_order_number: orderNumber,
      cancel_scope: 'section',
      section_code: cancelSectionCode,
      cancel_type: 'lab_order_cancelled',
      cancel_status: 'pending',
      cancel_reason: cancelReason,
      cancelled_at: now,
      cancelled_by: actorAudit,
      organization_code: organizationCode,
      section_codes: contexts.map(context => context.sectionCode).filter((code, index, rows) => rows.indexOf(code) === index),
      item_ids: cancellable.map(context => context.itemId),
      created_at: now,
      created_by: actorAudit,
      updated_at: now,
      updated_by: actorAudit
    }
    try {
      await cancellationCollection.insertOne(cancellationDoc)
      cancellation = cancellationDoc
    } catch (error) {
      cancellation = await cancellationCollection.findOne({ _id: cancellationObjectId, xrstatx: active })
      if (!cancellation) throw error
      alreadyCancelled = true
    }
  }

  const cancellationRecordObjectId = cancellation._id || cancellationObjectId
  const cancellationId = valueText(cancellation._id).trim() || orderId
  const authoritativeReason = valueText(cancellation.cancel_reason).trim() || cancelReason
  const authoritativeAt = valueText(cancellation.cancelled_at).trim() || now
  const authoritativeBy = cancellation.cancelled_by || actorAudit
  let cancelledCount = 0
  let financeCancelledItemCount = 0
  let cpoeCancelledCount = 0
  let cpoePreservedTerminalCount = 0
  for (let index = 0; index < unpaidFinanceBillItems.length; index += 1) {
    const billItem = unpaidFinanceBillItems[index]
    const saved = await billItemCollection.updateOne(
      { _id: billItem._id, xrstatx: active, item_status: { $nin: financeTerminalItemStatuses } },
      { $set: {
        item_status: 'cancelled',
        cancel_source: 'lab_order',
        cancel_reason: authoritativeReason,
        cancelled_at: authoritativeAt,
        cancelled_by: authoritativeBy,
        updated_at: now,
        updated_by: actorAudit
      } }
    )
    if (!saved || Number(saved.matchedCount) !== 1) {
      await cancellationCollection.updateOne(
        { _id: cancellationRecordObjectId, xrstatx: active },
        { $set: { cancel_status: 'conflict', conflict_bill_item_id: valueText(billItem._id), updated_at: now, updated_by: actorAudit } }
      )
      return {
        success: false,
        error: 'finance_item_sync_failed',
        data: financeData,
        message: 'สถานะรายการการเงินเปลี่ยนระหว่างยกเลิก จึงหยุดก่อนแก้สถานะ LAB กรุณาโหลดใหม่'
      }
    }
    financeCancelledItemCount += 1
  }
  for (let index = 0; index < cancellable.length; index += 1) {
    const context = cancellable[index]
    const patient = order.vid && order.vid.pid || {}
    const labData = context.item.lab_data && typeof context.item.lab_data === 'object' ? context.item.lab_data : {}
    const masterLab = context.master && context.master.lab_item && typeof context.master.lab_item === 'object' ? context.master.lab_item : {}
    const masterSpecimen = masterLab.specimen && !Array.isArray(masterLab.specimen) ? masterLab.specimen : {}
    const cancelPatch = {
      work_status: 'cancelled',
      cancellation_record_id: cancellationId,
      cancel_type: 'lab_order_cancelled',
      cancel_reason: authoritativeReason,
      cancelled_at: authoritativeAt,
      cancelled_by: authoritativeBy,
      updated_at: now,
      updated_by: actorAudit
    }
    if (context.outbound) {
      const outboundStatus = valueText(context.outbound.hl7_status).trim().toLowerCase()
      const unsentOutbound = Number(context.outbound.attempt_count || 0) === 0 &&
        !valueText(context.outbound.sent_at || context.outbound.last_success_at).trim() &&
        ['', 'new', 'pending', 'ready'].includes(outboundStatus)
      if (unsentOutbound) {
        // Stop only a queue row that has never left HIS. Sent rows are retained
        // unchanged for audit; this action never sends a cancellation to Agent/LIS.
        await outboundCollection.updateOne(
          { _id: context.outbound._id, xrstatx: active, attempt_count: 0, hl7_status: { $in: ['', 'new', 'pending', 'ready'] } },
          { $set: {
            hl7_status: 'cancelled',
            retryable: false,
            last_status_at: authoritativeAt,
            updated_at: now,
            updated_by: actorCode,
            last_error_code: 'order_cancelled_his_only',
            last_error_at: authoritativeAt,
            last_error_reason: authoritativeReason
          } }
        )
      }
    }
    if (context.workItem) {
      const saved = await workCollection.updateOne(
        { _id: context.workItem._id, xrstatx: active, work_status: { $in: ['waiting_receive', 'received'] } },
        { $set: cancelPatch }
      )
      if (!saved || Number(saved.matchedCount) !== 1) {
        await cancellationCollection.updateOne(
          { _id: cancellationRecordObjectId, xrstatx: active },
          { $set: { cancel_status: 'conflict', conflict_item_id: context.itemId, updated_at: now, updated_by: actorAudit } }
        )
        return { success: false, error: 'cancel_race_lost', message: 'สถานะ Item เปลี่ยนระหว่างยกเลิก กรุณาโหลดใหม่และให้ผู้ดูแลตรวจสอบ' }
      }
    } else {
      const patientHn = valueText(patient.hn).trim()
      const patientName = [valueText(patient.prename), valueText(patient.p_fname || patient.first_name), valueText(patient.p_lname || patient.last_name)]
        .map(value => value.trim()).filter(Boolean).join(' ') || patientHn
      const workItemDoc = {
        _id: context.item._id,
        xparentx: context.item._id,
        xsitex: userInfo.site || {},
        xunitx: { code: context.sectionCode, name: valueText(context.section.name_th || context.section.name || context.sectionCode).trim() },
        xrstatx: 1,
        xversionx: 'v1',
        dataid: context.itemId,
        created_by: actorAudit,
        created_at: now,
        source_order_id: orderId,
        source_order_number: orderNumber,
        source_specimen_record_id: context.itemId,
        lab_no: '',
        section_code: context.sectionCode,
        section_name: valueText(context.section.name_th || context.section.name || context.sectionCode).trim(),
        patient_hn: patientHn,
        visit_id: valueText(order.vid && (order.vid.vn || order.vid.value) || order.xparentx).trim(),
        patient_name: patientName,
        ward_clinic: valueText(order.vid && (order.vid.ward || order.vid.visit_clinic)).trim(),
        ordered_at: valueText(order.created_at).trim(),
        specimen_json: JSON.stringify({
          code: valueText(labData.spec_source_code || masterSpecimen.code).trim(),
          name: valueText(labData.spec_source || labData.source || masterSpecimen.name).trim(),
          collected_at: valueText(labData.specimen_at || labData.at).trim(),
          collected_by: valueText(labData.specimen_by || labData.by).trim()
        }),
        selected_items_json: JSON.stringify([{
          seq: Number(context.item.item_no || 1),
          source_item_id: context.itemId,
          item_code: valueText(context.item.item_code).trim(),
          item_name: valueText(context.item.item_name || context.master && context.master.item_name).trim(),
          test_code: valueText(masterLab.his_lab_code).trim(),
          specimen_code: valueText(labData.spec_source_code || masterSpecimen.code).trim()
        }]),
        ...cancelPatch
      }
      try {
        await workCollection.insertOne(workItemDoc)
      } catch (error) {
        const raced = await workCollection.findOne({ _id: context.item._id, xrstatx: active })
        if (!raced || valueText(raced.work_status).trim().toLowerCase() !== 'cancelled') {
          await cancellationCollection.updateOne(
            { _id: cancellationRecordObjectId, xrstatx: active },
            { $set: { cancel_status: 'conflict', conflict_item_id: context.itemId, updated_at: now, updated_by: actorAudit } }
          )
          return { success: false, error: 'cancel_race_lost', message: 'สถานะ Item เปลี่ยนระหว่างยกเลิก กรุณาโหลดใหม่และให้ผู้ดูแลตรวจสอบ' }
        }
      }
    }
    try {
      const cpoeSync = await syncCpoeCancelled(context, {
        cancel_type: 'lab_order_cancelled',
        cancel_reason: authoritativeReason,
        cancelled_at: authoritativeAt,
        cancelled_by: authoritativeBy,
        updated_at: now,
        updated_by: actorAudit
      })
      if (cpoeSync.status === 'cancelled') cpoeCancelledCount += 1
      if (cpoeSync.preservedTerminal) cpoePreservedTerminalCount += 1
    } catch (error) {
      await cancellationCollection.updateOne(
        { _id: cancellationRecordObjectId, xrstatx: active },
        { $set: { cancel_status: 'conflict', conflict_item_id: context.itemId, updated_at: now, updated_by: actorAudit } }
      )
      return { success: false, error: 'cpoe_status_sync_failed', message: 'ยกเลิก LAB Item แล้ว แต่ sync สถานะ CPOE Item ไม่สำเร็จ กรุณาให้ผู้ดูแล reconcile' }
    }
    cancelledCount += 1
  }

  const cancellableIds = new Set(cancellable.map(context => context.itemId))
  for (let index = 0; index < contexts.length; index += 1) {
    const context = contexts[index]
    if (cancellableIds.has(context.itemId)) continue
    const workStatus = valueText(context.workItem && context.workItem.work_status).trim().toLowerCase()
    const cpoeStatus = valueText(context.item.current_status).trim().toLowerCase()
    if (workStatus !== 'cancelled' && cpoeStatus !== 'cancelled') continue
    try {
      const cpoeSync = await syncCpoeCancelled(context, {
        cancel_type: 'lab_order_cancelled',
        cancel_reason: authoritativeReason,
        cancelled_at: authoritativeAt,
        cancelled_by: authoritativeBy,
        updated_at: now,
        updated_by: actorAudit
      })
      if (cpoeSync.status === 'cancelled') cpoeCancelledCount += 1
      if (cpoeSync.preservedTerminal) cpoePreservedTerminalCount += 1
    } catch (error) {
      await cancellationCollection.updateOne(
        { _id: cancellationRecordObjectId, xrstatx: active },
        { $set: { cancel_status: 'conflict', conflict_item_id: context.itemId, updated_at: now, updated_by: actorAudit } }
      )
      return { success: false, error: 'cpoe_status_sync_failed', message: 'LAB Item ถูกยกเลิกแล้ว แต่ sync สถานะ CPOE Item ไม่สำเร็จ กรุณาให้ผู้ดูแล reconcile' }
    }
  }

  let auditSyncPending = false
  try {
    const stamped = await cancellationCollection.updateOne(
      { _id: cancellationRecordObjectId, xrstatx: active, cancel_status: { $in: ['pending', 'applied'] } },
      { $set: { cancel_status: 'applied', applied_at: now, updated_at: now, updated_by: actorAudit } }
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
      cancel_scope: 'section',
      section_code: cancelSectionCode,
      section_codes: [cancelSectionCode],
      current_status: 'cancelled',
      cancel_type: 'lab_order_cancelled',
      cancel_reason: authoritativeReason,
      cancelled_at: authoritativeAt,
      cancelled_by: authoritativeBy,
      item_count: contexts.length,
      cancelled_item_count: cancelledCount,
      preserved_terminal_item_count: contexts.length - cancelledCount,
      cpoe_cancelled_item_count: cpoeCancelledCount,
      cpoe_preserved_terminal_item_count: cpoePreservedTerminalCount,
      finance_status: financeStatus,
      finance_cancelled_item_count: financeCancelledItemCount,
      finance_withdrawn_item_count: withdrawnFinanceBillItems.length,
      cancellation_record_id: cancellationId,
      already_cancelled: alreadyCancelled,
      audit_sync_pending: auditSyncPending
    },
    message: auditSyncPending
      ? 'ยกเลิก LAB Order แล้ว แต่ Cancellation Log ยังรอ reconcile'
      : alreadyCancelled
        ? 'LAB Order นี้ถูกยกเลิกแล้ว'
        : 'ยกเลิก LAB Order แล้ว'
  }
}

const loadItemContext = async itemId => {
  const found = await app.dbFindById(app.dbObjectId(itemId), ITEM_COLLECTION)
  const item = found && found.reply && found.reply.data
  if (!item || [0, 3].includes(Number(item.xrstatx))) return null

  let master = null
  if (item.item_data_id) {
    const masterFound = await app.dbFindById(item.item_data_id, ITEM_MASTER_COLLECTION)
    master = masterFound && masterFound.reply && masterFound.reply.data
  }

  let section = item.section_snapshot ||
    (item.lab_context_snapshot && item.lab_context_snapshot.section) ||
    (master && master.section) || {}
  if (!valueText(section.code) && section.value) {
    const sectionFound = await app.dbFindById(section.value, SECTION_COLLECTION)
    section = sectionFound && sectionFound.reply && sectionFound.reply.data || section
  }

  const orderRef = item.order_id && item.order_id.value
    ? item.order_id.value
    : item.xparentx
  let order = null
  if (orderRef) {
    const orderFound = await app.dbFindById(orderRef, ORDER_COLLECTION)
    order = orderFound && orderFound.reply && orderFound.reply.data
  }
  let cancellation = null
  const orderId = valueText(order && order._id || orderRef).trim()
  if (/^[a-f0-9]{24}$/i.test(orderId)) {
    cancellation = await app.db.collection(ORDER_CANCELLATION_COLLECTION).findOne({
      _id: app.dbObjectId(orderId),
      xrstatx: { $nin: [0, 3] },
      cancel_status: { $in: ['pending', 'applied'] }
    })
  }
  const workItem = await app.db.collection(WORK_ITEM_COLLECTION).findOne({
    source_specimen_record_id: itemId,
    xrstatx: { $nin: [0, 3] }
  })
  return { item, master, section, order, workItem, cancellation }
}

const effectiveItemStatus = context => {
  if (context && context.cancellation) return 'cancelled'
  const workStatus = valueText(context && context.workItem && context.workItem.work_status).trim().toLowerCase()
  const map = {
    waiting_receive: 'sent',
    received: 'accepted',
    processing: 'prepared',
    resulted: 'resulted',
    completed: 'completed',
    rejected: 'rejected',
    cancelled: 'cancelled'
  }
  return map[workStatus] || valueText(context && context.item && context.item.current_status).trim().toLowerCase()
}

const formRows = async (formId, where, queryParams, orderBy, limit) => {
  const found = await app.sdformGetAll(
    {
      providerId: formId,
      providerType: 'FORM',
      params: queryParams,
      options: {
        where,
        orderBy: orderBy || [{ column: 'xupdatx', sort: 'DESC' }],
        limit: limit || 20,
        page: 1
      }
    },
    false,
    userInfo
  )
  if (!found || found.success === false) throw new Error('RESULT_LOOKUP_FAILED')
  return Array.isArray(found.data) ? found.data : []
}

const resultRows = (where, queryParams, orderBy, limit) =>
  formRows(RESULT_ITEM_FORM_ID, where, queryParams, orderBy, limit)

const legacyResultRows = (where, queryParams, orderBy, limit) =>
  formRows(LEGACY_RESULT_ITEM_FORM_ID, where, queryParams, orderBy, limit)

// The legacy Result Item Form is a read-only compatibility source and may be
// disabled after the canonical form is deployed. An unavailable legacy form
// behaves like an empty source and must not break the Worklist result viewer.
const optionalLegacyResultRows = async (where, queryParams, orderBy, limit) => {
  try {
    return await legacyResultRows(where, queryParams, orderBy, limit)
  } catch (error) {
    return []
  }
}

if (['get_manual_result', 'save_manual_result', 'save_result_edits', 'save_result_attachments', 'set_result_visibility'].includes(action)) {
  const itemId = valueText(params.item_id).trim()
  if (!/^[a-f0-9]{24}$/i.test(itemId)) {
    return { success: false, message: 'item_id ไม่ถูกต้อง' }
  }

  let context
  try {
    context = await loadItemContext(itemId)
  } catch (error) {
    return { success: false, message: 'ตรวจสอบ CPOE Item ไม่สำเร็จ' }
  }
  if (!context || valueText(context.item.service_type && context.item.service_type.value).toLowerCase() !== 'lab') {
    return { success: false, message: 'ไม่พบ CPOE LAB Item ที่เลือก' }
  }

  const itemSectionCode = valueText(context.section && context.section.code).trim().toUpperCase()
  if (!allowedLookup[itemSectionCode]) {
    return { success: false, message: 'Item นี้ไม่ได้อยู่ใน Section ของ Organization ปัจจุบัน' }
  }
  const itemStatus = effectiveItemStatus(context)
  const editableStatuses = ['accepted', 'prepared', 'dispensed', 'resulted']
  const viewableStatuses = ['sent', ...editableStatuses, 'completed']
  if (action === 'get_manual_result' && !viewableStatuses.includes(itemStatus)) {
    return { success: false, message: 'สถานะ Item นี้ไม่อนุญาตให้ดูผลตรวจ' }
  }
  const resultEditStatuses = [...editableStatuses, 'completed']
  if (action === 'save_manual_result' && !editableStatuses.includes(itemStatus)) {
    return {
      success: false,
      message: itemStatus === 'sent'
        ? 'ต้องรับ specimen ก่อนกรอกผล Manual'
        : 'สถานะ Item นี้ไม่อนุญาตให้กรอกผล Manual'
    }
  }
  if (action === 'save_result_attachments' && !viewableStatuses.includes(itemStatus)) {
    return { success: false, message: 'สถานะ Item นี้ไม่อนุญาตให้แนบไฟล์ผลตรวจ' }
  }
  if (['save_result_edits', 'set_result_visibility'].includes(action) && !resultEditStatuses.includes(itemStatus)) {
    return {
      success: false,
      message: itemStatus === 'sent'
        ? 'ต้องรับ specimen ก่อนแก้ไขผลหรือเปลี่ยนการมองเห็นผล'
        : 'สถานะ Item นี้ไม่อนุญาตให้แก้ไขผลหรือเปลี่ยนการมองเห็นผล'
    }
  }
  if (!context.order || [0, 3].includes(Number(context.order.xrstatx))) {
    return { success: false, message: 'ไม่พบ CPOE Order ของ Item นี้' }
  }

  const labData = context.item.lab_data && typeof context.item.lab_data === 'object'
    ? context.item.lab_data
    : {}
  const masterLab = context.master && context.master.lab_item && typeof context.master.lab_item === 'object'
    ? context.master.lab_item
    : {}
  const orderId = valueText(context.order._id).trim()
  const orderNo = valueText(context.order.order_number).trim()
  const workItemId = valueText(context.workItem && context.workItem._id).trim()
  const workReceiptBatchId = valueText(context.workItem && context.workItem.receipt_batch_id).trim()
  const workBatchItemCount = Number(context.workItem && context.workItem.batch_item_count || 0)
  const workOrderNo = workReceiptBatchId || valueText(context.workItem && context.workItem.dataid).trim() || itemId
  const labNo = valueText(context.workItem && context.workItem.lab_no).trim()
  const patientHn = valueText(context.order.vid && context.order.vid.pid && context.order.vid.pid.hn).trim()
  const visitVn = valueText(context.order.vid && context.order.vid.vn).trim()
  const visitRecordId = valueText(context.order.xparentx).trim()
  const testCode = valueText(context.item.item_code).trim()
  const testName = valueText(context.item.item_name || (context.master && context.master.item_name) || testCode).trim()
  const specimenCode = valueText(labData.spec_source_code).trim()
  const specimenName = valueText(labData.spec_source || labData.source).trim()

  let currentRows = []
  let currentReportRows = []
  let previousRows = []
  let unmatchedReceipts = []
  let currentIsLegacy = false
  try {
    currentRows = await resultRows(
      '(order_no = :workItemId OR order_no = :workOrderNo OR order_no = :itemId) AND xrstatx NOT IN (0,3)',
      { workItemId, workOrderNo, itemId },
      [
        { column: 'result_sequence', sort: 'ASC' },
        { column: 'xupdatx', sort: 'DESC' }
      ],
      500
    )
    if (currentRows.length) {
      currentReportRows = await formRows(
        RESULT_REPORT_FORM_ID,
        '(order_no = :workItemId OR order_no = :workOrderNo OR order_no = :itemId OR filler_order_no = :labNo) AND xrstatx NOT IN (0,3)',
        { workItemId, workOrderNo, itemId, labNo },
        [
          { column: 'report_seq', sort: 'DESC' },
          { column: 'xupdatx', sort: 'DESC' }
        ],
        100
      )
    }
    if (!currentRows.length) {
      currentRows = await optionalLegacyResultRows(
        'source_item_id = :itemId AND xrstatx NOT IN (0,3)',
        { itemId },
        [{ column: 'xupdatx', sort: 'DESC' }],
        10
      )
      currentIsLegacy = currentRows.length > 0
    }
    if (patientHn) {
      previousRows = await resultRows(
        'hn = :patientHn AND order_no != :workItemId AND order_no != :workOrderNo AND order_no != :itemId AND xrstatx NOT IN (0,3)',
        { patientHn, workItemId, workOrderNo, itemId },
        [
          { column: 'entered_at', sort: 'DESC' },
          { column: 'xupdatx', sort: 'DESC' }
        ],
        1000
      )
      if (!previousRows.length) {
        previousRows = await optionalLegacyResultRows(
          'patient_hn = :patientHn AND source_item_id != :itemId AND xrstatx NOT IN (0,3)',
          { patientHn, itemId },
          [
            { column: 'entered_at', sort: 'DESC' },
            { column: 'xupdatx', sort: 'DESC' }
          ],
          1000
        )
      }
    }
  } catch (error) {
    return { success: false, message: 'ค้นหารายการผลตรวจเดิมไม่สำเร็จ' }
  }

  // MB worst-case viewer: an exact Order/LAB NO./HN/VN receipt whose obs_code
  // does not map to any ordered Item remains audit-only. Expose only its raw
  // MLab value for review; never materialize it as a clinical Result Item.
  if (action === 'get_manual_result' && itemSectionCode === 'MB' && labNo && patientHn && visitVn) {
    try {
      const receiptRows = await formRows(
        RESULT_RECEIPT_FORM_ID,
        'filler_order_no = :labNo AND hn = :patientHn AND visit_id = :visitVn AND xrstatx NOT IN (0,3)',
        { labNo, patientHn, visitVn },
        [
          { column: 'report_seq', sort: 'DESC' },
          { column: 'received_at', sort: 'DESC' },
          { column: 'xupdatx', sort: 'DESC' }
        ],
        20
      )
      const expectedOrderIds = new Set([
        workItemId,
        workOrderNo,
        workReceiptBatchId,
        valueText(context.workItem && context.workItem.dataid).trim(),
        valueText(context.workItem && context.workItem.source_specimen_record_id).trim(),
        itemId,
        orderId,
        orderNo
      ].filter(Boolean))
      unmatchedReceipts = receiptRows.filter(row => {
        const status = valueText(row && row.receipt_status).trim().toLowerCase()
        const receiptOrderNo = valueText(row && row.order_no).trim()
        const message = valueText(row && row.error_message)
        const matchedItemCount = Number(row && row.matched_item_count) || 0
        const unmatchedItemCount = Number(row && row.unmatched_item_count) || 0
        return status === 'unmatched'
          && expectedOrderIds.has(receiptOrderNo)
          && matchedItemCount === 0
          && unmatchedItemCount > 0
          && /obs_code/i.test(message)
      }).map(row => {
        let payload = null
        try {
          payload = JSON.parse(valueText(row && row.raw_payload_json))
        } catch (error) {
          payload = null
        }
        const sourceItems = payload && Array.isArray(payload.items)
          ? payload.items
          : jsonArray(row && row.items_json)
        const items = sourceItems.map(item => ({
          obs_code: valueText(item && item.obs_code),
          obs_name: valueText(item && item.obs_name),
          value: valueText(item && item.value),
          obx_status: valueText(item && item.obx_status)
        })).filter(item => item.value)
        return {
          receipt_id: valueText(row && (row._id || row.id)).trim(),
          result_uid: valueText(row && row.result_uid),
          report_seq: valueText(row && row.report_seq),
          stage: valueText(row && row.stage),
          reported_at: valueText(row && row.reported_at),
          items
        }
      }).filter(receipt => receipt.items.length)
    } catch (error) {
      unmatchedReceipts = []
    }
  }

  const resultIdentity = row => valueText(
    row && (row.result_definition_id || row.obs_code || row.test_code)
  ).trim()
  const rowVersion = row => valueText(row && row.result_version).trim() || '0'
  const rowTime = row => valueText(row && (row.entered_at || row.xupdatx || row.xcreatx)).trim()
  const timeValue = value => {
    const parsed = new Date(valueText(value).replace(' ', 'T')).getTime()
    return Number.isFinite(parsed) ? parsed : 0
  }
  const newerResult = (candidate, selected) => {
    if (!selected) return true
    const versionOrder = rowVersion(candidate).localeCompare(rowVersion(selected), undefined, { numeric: true })
    if (versionOrder !== 0) return versionOrder > 0
    return timeValue(rowTime(candidate)) > timeValue(rowTime(selected))
  }
  const latestByIdentity = rows => {
    const latest = new Map()
    for (const row of rows) {
      const key = resultIdentity(row)
      if (!key) continue
      if (newerResult(row, latest.get(key))) latest.set(key, row)
    }
    return Array.from(latest.values()).sort((left, right) => {
      const a = Number(valueText(left && left.result_sequence)) || 0
      const b = Number(valueText(right && right.result_sequence)) || 0
      return a - b || resultIdentity(left).localeCompare(resultIdentity(right))
    })
  }
  const allCurrentClinicalRows = latestByIdentity(currentRows)
  // One ordered CPOE test can materialize multiple clinical Result Items.
  // Filter a shared LAB-NO batch by the ordered code plus all mapped result
  // components, not by exact code alone. panel_code remains source metadata and
  // is deliberately not trusted as the clinical parent because LIS payloads may
  // assign a distinct panel_code to every OBX/result component.
  const selectedItemSnapshot = jsonArray(
    context.workItem && (context.workItem.selected_items || context.workItem.selected_items_json)
  ).find(row => valueText(row && (row.source_item_id || row.source_cpoe_item_id || row.item_id)).trim() === itemId)
  const snapshotTestCode = valueText(selectedItemSnapshot && (
    selectedItemSnapshot.test_code || selectedItemSnapshot.his_code_id ||
    selectedItemSnapshot.obs_code || selectedItemSnapshot.item_code || selectedItemSnapshot.code
  )).trim()
  const batchItemCodes = new Set([
    ...resultComponentCodesForOrderCode(snapshotTestCode),
    ...resultComponentCodesForOrderCode(testCode),
    ...resultComponentCodesForOrderCode(valueText(masterLab.his_lab_code).trim())
  ])
  const currentClinicalRows = workReceiptBatchId && workBatchItemCount > 1
    ? allCurrentClinicalRows.filter(row => batchItemCodes.has(resultIdentity(row)) || batchItemCodes.has(valueText(row && (row.obs_code || row.test_code)).trim()))
    : allCurrentClinicalRows
  const itemAttachmentReportKey = 'attachment|' + workItemId
  const orderAttachmentReportKey = 'attachment-order|' + orderId + '|' + itemSectionCode
  let attachmentReport = null
  let itemAttachmentReport = null
  let orderAttachmentReport = null
  try {
    const attachmentReports = await formRows(
      RESULT_REPORT_FORM_ID,
      '(report_key = :itemAttachmentReportKey OR report_key = :orderAttachmentReportKey) AND xrstatx NOT IN (0,3)',
      { itemAttachmentReportKey, orderAttachmentReportKey },
      [{ column: 'xupdatx', sort: 'DESC' }],
      2
    )
    itemAttachmentReport = attachmentReports.find(report =>
      valueText(report && report.report_key).trim() === itemAttachmentReportKey
    ) || null
    orderAttachmentReport = attachmentReports.find(report =>
      valueText(report && report.report_key).trim() === orderAttachmentReportKey
    ) || null
    attachmentReport = orderAttachmentReport || itemAttachmentReport
  } catch (error) {
    return { success: false, message: 'อ่านไฟล์แนบผลตรวจไม่สำเร็จ' }
  }
  const current = currentClinicalRows.find(row =>
    valueText(row && row.result_source).trim().toLowerCase() === 'manual' &&
    valueText(row && (row.test_code || row.obs_code)).trim() === testCode
  ) || null
  const currentOrderTime = timeValue(context.order.created_at || context.order.order_date || context.item.created_at)
  const finalPreviousRows = previousRows.filter(row => {
    const status = valueText(row && row.result_status).trim().toLowerCase()
    const obx = valueText(row && row.obx_status).trim().toUpperCase()
    if (!['final', 'corrected', 'completed', 'resulted'].includes(status) && !['F', 'C'].includes(obx)) return false
    const candidateTime = timeValue(rowTime(row))
    return !(currentOrderTime && candidateTime && candidateTime >= currentOrderTime)
  })
  const previousByIdentity = new Map()
  for (const row of finalPreviousRows) {
    const key = resultIdentity(row)
    if (key && newerResult(row, previousByIdentity.get(key))) previousByIdentity.set(key, row)
    const code = valueText(row && (row.obs_code || row.test_code)).trim()
    if (code && newerResult(row, previousByIdentity.get(code))) previousByIdentity.set(code, row)
  }
  const previousFor = row => {
    const key = resultIdentity(row) || testCode
    const code = valueText(row && (row.obs_code || row.test_code)).trim() || testCode
    return previousByIdentity.get(key) || previousByIdentity.get(code) || null
  }
  const previous = previousFor(current || { test_code: testCode })

  const previousData = row => row ? {
    value: valueText(row.result_value),
    unit: valueText(row.unit_symbol_snapshot || row.unit_symbol || row.units),
    interpretation: valueText(row.interpretation_code),
    reference_range: valueText(row.reference_range_snapshot || row.ref_range),
    visit_vn: valueText(row.visit_id || row.visit_vn),
    entered_at: rowTime(row)
  } : null
  const reportById = new Map()
  const reportByUid = new Map()
  const reportByOrderNo = new Map()
  for (const report of currentReportRows) {
    const reportId = valueText(report && (report._id || report.id)).trim()
    const resultUid = valueText(report && report.result_uid).trim()
    const reportOrderNo = valueText(report && report.order_no).trim()
    if (reportId && !reportById.has(reportId)) reportById.set(reportId, report)
    if (resultUid && !reportByUid.has(resultUid)) reportByUid.set(resultUid, report)
    if (reportOrderNo && !reportByOrderNo.has(reportOrderNo)) reportByOrderNo.set(reportOrderNo, report)
  }
  const linkedReport = row => {
    const joinedParent = row && row.parent_id && typeof row.parent_id === 'object' ? row.parent_id : null
    if (joinedParent && (
      valueText(joinedParent.reported_by_source_name) ||
      valueText(joinedParent.verified_by_source_name)
    )) return joinedParent
    const reportId = valueText(row && (row.result_report_id || row.xparentx)).trim()
    const resultUid = valueText(row && row.result_uid).trim()
    const reportOrderNo = valueText(row && row.order_no).trim()
    return reportById.get(reportId) || reportByUid.get(resultUid) || reportByOrderNo.get(reportOrderNo) || joinedParent || {}
  }
  const reportMeta = row => {
    const parent = linkedReport(row)
    return {
      reported_at: valueText(row && row.reported_at || parent.reported_at || rowTime(row)),
      reported_by_source_id: valueText(row && row.reported_by_source_id || parent.reported_by_source_id),
      reported_by_source_name: valueText(row && row.reported_by_source_name || parent.reported_by_source_name || row && row.entered_by),
      verified_at: valueText(row && row.verified_at || parent.verified_at),
      verified_by_source_id: valueText(row && row.verified_by_source_id || parent.verified_by_source_id),
      verified_by_source_name: valueText(row && row.verified_by_source_name || parent.verified_by_source_name)
    }
  }
  const resultData = row => ({
    result_item_id: valueText(row && (row._id || row.id)).trim(),
    result_report_id: valueText(row && (row.result_report_id || row.xparentx)).trim(),
    result_definition_id: valueText(row && row.result_definition_id),
    test_code: valueText(row && (row.obs_code || row.test_code)) || testCode,
    test_name: valueText(row && (row.obs_name || row.test_name)) || testName,
    result_value: valueText(row && row.result_value),
    result_comment: valueText(row && row.result_comment),
    unit: valueText(row && (row.unit_symbol_snapshot || row.unit_symbol || row.units)),
    interpretation: valueText(row && row.interpretation_code),
    reference_range: valueText(row && (row.reference_range_snapshot || row.ref_range)),
    result_source: valueText(row && row.result_source),
    result_status: valueText(row && row.result_status),
    is_critical: row && row.is_critical === true,
    entered_at: rowTime(row),
    last_edited_by: valueText(row && row.last_edited_by),
    last_edited_at: valueText(row && row.last_edited_at),
    change_kind: valueText(row && row.change_kind),
    ...reportMeta(row),
    previous: previousData(previousFor(row))
  })

  const responseData = savedRow => {
    const displayRows = savedRow
      ? latestByIdentity([savedRow, ...currentClinicalRows])
      : currentClinicalRows.slice()
    if (!displayRows.length && previous) {
      displayRows.push({ test_code: testCode, test_name: testName })
    }
    const base = savedRow || current || {
      result_value: '',
      unit_symbol_snapshot: valueText(masterLab.unit_symbol || masterLab.unit || context.master && context.master.unit),
      interpretation_code: '',
      reference_range_snapshot: valueText(masterLab.reference_range || masterLab.ref_range)
    }
    const meta = reportMeta(displayRows.reduce((latest, row) => {
      if (!latest) return row
      return timeValue(reportMeta(row).reported_at) >= timeValue(reportMeta(latest).reported_at) ? row : latest
    }, base))
    return {
      item_id: itemId,
      result_item_id: valueText(base && (base._id || base.id)).trim(),
      order_id: orderId,
      order_no: orderNo,
      lab_no: labNo,
      patient_hn: patientHn,
      visit_vn: visitVn,
      visit_record_id: visitRecordId,
      section_code: itemSectionCode,
      test_code: testCode,
      test_name: testName,
      specimen_code: specimenCode,
      specimen_name: specimenName,
      result_value: valueText(base && base.result_value),
      unit: valueText(base && (base.unit_symbol_snapshot || base.unit_symbol || base.units)),
      interpretation: valueText(base && base.interpretation_code),
      reference_range: valueText(base && (base.reference_range_snapshot || base.ref_range)),
      result_status: valueText(base && base.result_status),
      entered_at: rowTime(base),
      ...meta,
      previous: previousData(previous),
      result_report_id: valueText(attachmentReport && attachmentReport._id) || valueText(base && (base.result_report_id || base.xparentx)),
      result_attachments: attachmentReport && Array.isArray(attachmentReport.result_attachments)
        ? attachmentReport.result_attachments
        : [],
      is_hide_result: context.item.is_hide_result === true,
      result_visibility_action: valueText(context.item.result_visibility_action),
      result_visibility_reason: valueText(context.item.result_visibility_reason),
      result_visibility_by: context.item.result_visibility_by || null,
      result_visibility_at: valueText(context.item.result_visibility_at),
      unmatched_receipts: unmatchedReceipts,
      results: displayRows.map(resultData)
    }
  }

  if (action === 'set_result_visibility') {
    const hiddenText = valueText(params.hidden).trim().toLowerCase()
    const hidden = params.hidden === true || params.hidden === 1 || ['true', '1'].includes(hiddenText)
      ? true
      : params.hidden === false || params.hidden === 0 || ['false', '0'].includes(hiddenText)
        ? false
        : null
    if (hidden == null) {
      return { success: false, message: 'hidden ต้องเป็น true หรือ false' }
    }
    if (!currentClinicalRows.length) {
      return { success: false, message: 'ยังไม่มีผลตรวจที่บันทึกไว้ จึงยังเปลี่ยนการมองเห็นผลไม่ได้' }
    }
    const reason = valueText(params.reason).trim().slice(0, 1000)
    if (reason.length < 3) {
      return { success: false, message: 'กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร' }
    }

    const currentHidden = context.item.is_hide_result === true
    if (currentHidden === hidden) {
      return {
        success: true,
        data: responseData(current || null),
        message: hidden ? 'ผลตรวจนี้ถูกตั้งสถานะปกปิดอยู่แล้ว' : 'ผลตรวจนี้ไม่ได้ถูกปกปิดอยู่แล้ว'
      }
    }

    const now = typeof app.curDate === 'function' ? valueText(app.curDate()) : new Date().toISOString()
    const account = userInfo && userInfo.account && typeof userInfo.account === 'object' ? userInfo.account : {}
    const visibilityActor = {
      id: valueText(account.id || account._id),
      name: valueText(account.name || account.display_name || userInfo.username)
    }
    let history = Array.isArray(context.item.result_visibility_history)
      ? context.item.result_visibility_history.slice()
      : []
    if (!history.length && typeof context.item.result_visibility_history === 'string') {
      try {
        const parsed = JSON.parse(context.item.result_visibility_history)
        history = Array.isArray(parsed) ? parsed : []
      } catch (error) {
        history = []
      }
    }
    const actionName = hidden ? 'hide' : 'unhide'
    const auditEntry = {
      action: actionName,
      reason,
      performed_by: visibilityActor,
      performed_at: now
    }
    const patch = {
      is_hide_result: hidden,
      result_visibility_action: actionName,
      result_visibility_reason: reason,
      result_visibility_by: visibilityActor,
      result_visibility_at: now,
      result_visibility_history: [...history, auditEntry]
    }
    let saved
    try {
      saved = await app.dbUpdate(
        patch,
        ITEM_COLLECTION,
        userInfo,
        { _id: app.dbObjectId(itemId), xrstatx: { $nin: [0, 3] } }
      )
    } catch (error) {
      return { success: false, message: 'บันทึกสถานะปกปิดผลไม่สำเร็จ' }
    }
    if (!saved || saved.success === false) {
      return { success: false, message: 'บันทึกสถานะปกปิดผลไม่สำเร็จ' }
    }
    Object.assign(context.item, patch)
    return {
      success: true,
      data: responseData(current || null),
      message: hidden ? 'บันทึกสถานะปกปิดผลแล้ว' : 'ยกเลิกการปกปิดผลแล้ว'
    }
  }

  if (action === 'get_manual_result') {
    return {
      success: true,
      data: responseData(current || null),
      message: currentClinicalRows.length
        ? 'อ่านผลตรวจแล้ว'
        : itemStatus === 'sent'
          ? 'ยังไม่มีผลตรวจ; รับ specimen ก่อนใช้ปุ่มดินสอกรอกผล'
          : itemSectionCode === 'MY'
            ? 'ยังไม่มีผลตรวจ; ใช้ปุ่มดินสอเพื่อกรอกผล Manual ได้'
            : 'ยังไม่มีผลตรวจ; รอผลจาก Agent/LIS'
    }
  }

  if (action === 'save_result_edits') {
    if (currentIsLegacy) {
      return { success: false, message: 'ผลเดิมอยู่ใน schema รุ่นเก่า จึงยังแก้ไขจาก Popup นี้ไม่ได้' }
    }
    const requestedRows = Array.isArray(params.results) ? params.results : []
    if (!requestedRows.length || requestedRows.length > 500) {
      return { success: false, message: 'ไม่พบรายการผลที่ต้องการแก้ไข' }
    }
    const currentById = new Map(
      currentClinicalRows.map(row => [valueText(row && (row._id || row.id)).trim(), row])
    )
    const edits = []
    for (const requested of requestedRows) {
      const resultItemId = valueText(requested && requested.result_item_id).trim()
      if (!/^[a-f0-9]{24}$/i.test(resultItemId) || !currentById.has(resultItemId)) {
        return { success: false, message: 'Result Item ที่แก้ไขไม่ตรงกับผลล่าสุดของ LAB Item นี้' }
      }
      const clean = {
        result_value: valueText(requested.result_value).slice(0, 10000),
        unit_symbol_snapshot: valueText(requested.unit).slice(0, 200),
        interpretation_code: valueText(requested.interpretation).slice(0, 200),
        reference_range_snapshot: valueText(requested.reference_range).slice(0, 2000)
      }
      const currentRow = currentById.get(resultItemId)
      const changed = valueText(currentRow.result_value) !== clean.result_value ||
        valueText(currentRow.unit_symbol_snapshot || currentRow.units) !== clean.unit_symbol_snapshot ||
        valueText(currentRow.interpretation_code) !== clean.interpretation_code ||
        valueText(currentRow.reference_range_snapshot || currentRow.ref_range) !== clean.reference_range_snapshot
      if (changed) edits.push({ resultItemId, currentRow, clean })
    }
    const now = app.curDate('YYYY-MM-DD HH:mm:ss')
    const actor = valueText(userInfo.username || userInfo.account && userInfo.account.name).trim()
    try {
      for (const edit of edits) {
        const patch = {
          result_value: edit.clean.result_value,
          units: edit.clean.unit_symbol_snapshot,
          unit_symbol_snapshot: edit.clean.unit_symbol_snapshot,
          interpretation_code: edit.clean.interpretation_code,
          ref_range: edit.clean.reference_range_snapshot,
          reference_range_snapshot: edit.clean.reference_range_snapshot,
          change_kind: 'corrected',
          last_edited_by: actor,
          last_edited_at: now
        }
        const saved = await app.sdformSetOne(RESULT_ITEM_FORM_ID, edit.resultItemId, patch, 1, userInfo)
        if (!saved || saved.success === false) {
          return { success: false, message: 'บันทึก Result Item ที่แก้ไขไม่สำเร็จ' }
        }
        Object.assign(edit.currentRow, patch)
      }
    } catch (error) {
      return { success: false, message: 'บันทึกผลที่แก้ไขไม่สำเร็จ: ' + valueText(error && error.message || error) }
    }
    return {
      success: true,
      data: responseData(null),
      message: edits.length ? 'บันทึกผลที่แก้ไขแล้ว ' + edits.length + ' รายการ' : 'ไม่มีค่าผลที่เปลี่ยนแปลง'
    }
  }

  if (action === 'save_result_attachments') {
    const rawAttachments = Array.isArray(params.result_attachments) ? params.result_attachments : []
    if (rawAttachments.length > RESULT_ATTACHMENT_MAX_FILES) {
      return { success: false, message: 'แนบไฟล์ได้สูงสุด 10 ไฟล์ต่อผลตรวจ' }
    }
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png']
    const allowedMime = ['application/pdf', 'image/jpeg', 'image/png']
    let totalBytes = 0
    const attachments = []
    for (const raw of rawAttachments) {
      const response = raw && raw.response && typeof raw.response === 'object' ? raw.response : raw || {}
      const name = valueText(raw && raw.name || response.fileName).trim()
      const extension = valueText(response.fileType || name.split('.').pop()).trim().toLowerCase()
      const mimetype = valueText(response.mimetype).trim().toLowerCase()
      const fileId = valueText(response.fileId).trim()
      const filePath = valueText(response.filePath || raw && raw.url).trim()
      const size = Math.max(0, Number(raw && raw.size || response.size || 0) || 0)
      totalBytes += size
      if (!name || !/^[a-f0-9]{24}$/i.test(fileId) || !filePath || !allowedExtensions.includes(extension)) {
        return { success: false, message: 'ข้อมูลไฟล์แนบไม่ถูกต้อง' }
      }
      if (mimetype && !allowedMime.includes(mimetype)) {
        return { success: false, message: 'ชนิดไฟล์แนบไม่ตรงกับ PDF/JPG/PNG ที่อนุญาต' }
      }
      if (valueText(response.formId).trim() && valueText(response.formId).trim() !== RESULT_REPORT_FORM_ID) {
        return { success: false, message: 'ไฟล์แนบไม่ได้อัปโหลดสำหรับ Result Report' }
      }
      if (size > RESULT_ATTACHMENT_MAX_FILE_BYTES) {
        return { success: false, message: 'ไฟล์แนบแต่ละไฟล์ต้องไม่เกิน 10 MB' }
      }
      attachments.push({
        name,
        percentage: 100,
        status: 'success',
        size,
        uid: raw && raw.uid || fileId,
        url: filePath,
        response: {
          filePath,
          fileName: valueText(response.fileName),
          fileType: extension,
          fileGroup: valueText(response.fileGroup),
          mimetype,
          domainUrl: valueText(response.domainUrl),
          fileId,
          formId: RESULT_REPORT_FORM_ID
        }
      })
    }
    if (totalBytes > RESULT_ATTACHMENT_MAX_TOTAL_BYTES) {
      return { success: false, message: 'ไฟล์แนบรวมต้องไม่เกิน 50 MB' }
    }
    const now = app.curDate('YYYY-MM-DD HH:mm:ss')
    const actor = valueText(userInfo.username || userInfo.account && userInfo.account.name).trim()
    const attachmentScope = valueText(params.attachment_scope).trim().toLowerCase() === 'order'
      ? 'order'
      : 'item'
    const attachmentReportKey = attachmentScope === 'order'
      ? orderAttachmentReportKey
      : itemAttachmentReportKey
    const scopedAttachmentReport = attachmentScope === 'order'
      ? orderAttachmentReport
      : itemAttachmentReport
    const attachmentOperation = valueText(params.attachment_operation).trim().toLowerCase() || 'replace'
    if (!['replace', 'remove'].includes(attachmentOperation)) {
      return { success: false, message: 'attachment_operation ไม่ถูกต้อง' }
    }
    if (attachmentOperation === 'remove') {
      const existing = scopedAttachmentReport && Array.isArray(scopedAttachmentReport.result_attachments)
        ? scopedAttachmentReport.result_attachments
        : []
      const attachmentKey = entry => {
        const response = entry && entry.response && typeof entry.response === 'object' ? entry.response : entry || {}
        return valueText(response.fileId || entry && (entry.uid || entry.url || entry.name)).trim()
      }
      const removedKey = valueText(params.removed_attachment_key).trim()
      const existingKeys = existing.map(attachmentKey).filter(Boolean)
      const nextKeys = attachments.map(attachmentKey).filter(Boolean)
      if (!removedKey || !existingKeys.includes(removedKey) || existing.length - attachments.length !== 1 || nextKeys.some(key => !existingKeys.includes(key)) || nextKeys.includes(removedKey)) {
        return { success: false, message: 'ข้อมูลการนำไฟล์แนบออกไม่ถูกต้อง กรุณาโหลดผลใหม่แล้วลองอีกครั้ง' }
      }
    }
    let resultReportId = valueText(scopedAttachmentReport && scopedAttachmentReport._id).trim()
    const reportData = {
      xparentx: app.dbObjectId(attachmentScope === 'order' ? orderId : workItemId),
      filler_order_no: attachmentScope === 'order' ? orderNo : labNo,
      hn: patientHn,
      visit_id: visitVn,
      order_no: attachmentScope === 'order' ? orderId : workItemId,
      order_status_id: workItemId,
      lab_section: itemSectionCode,
      lab_section_name: valueText(context.section && (context.section.name_th || context.section.name)),
      record_kind: attachmentScope === 'order' ? 'attachment' : 'report',
      report_key: attachmentReportKey,
      receipt_status: 'processed',
      source_channel: 'manual',
      internal_overall_status: currentClinicalRows.length ? 'resulted' : 'processing',
      item_count: currentClinicalRows.length,
      matched_item_count: currentClinicalRows.length,
      unmatched_item_count: 0,
      processed_at: now,
      result_attachments: attachments,
      confirmed_by: actor,
      confirmed_at: now,
      error_message: ''
    }
    try {
      if (!resultReportId) {
        const draft = await app.insertData(RESULT_REPORT_FORM_ID, userInfo)
        resultReportId = valueText(draft && (
          draft.id || draft.data && (draft.data._id || draft.data.id) ||
          draft.reply && (draft.reply.id || draft.reply.data && draft.reply.data._id)
        )).trim()
        if (!draft || draft.success === false || !resultReportId) {
          return { success: false, message: 'สร้าง Result Report สำหรับไฟล์แนบไม่สำเร็จ' }
        }
      }
      const saved = await app.sdformSetOne(
        RESULT_REPORT_FORM_ID,
        resultReportId,
        { ...reportData, result_report_id: resultReportId },
        1,
        userInfo
      )
      if (!saved || saved.success === false) {
        return { success: false, message: 'บันทึกไฟล์แนบใน Result Report ไม่สำเร็จ' }
      }
    } catch (error) {
      return { success: false, message: 'บันทึกไฟล์แนบไม่สำเร็จ: ' + valueText(error && error.message || error) }
    }
    attachmentReport = { _id: resultReportId, ...reportData }
    if (attachmentScope === 'order') orderAttachmentReport = attachmentReport
    else itemAttachmentReport = attachmentReport
    return {
      success: true,
      data: { ...responseData(null), result_report_id: resultReportId, result_attachments: attachments },
      message: 'บันทึกไฟล์แนบผลตรวจแล้ว'
    }
  }

  const manual = params.manual_result && typeof params.manual_result === 'object'
    ? params.manual_result
    : {}
  const clinical = {
    result_value: valueText(manual.result_value),
    unit_symbol_snapshot: valueText(manual.unit),
    interpretation_code: valueText(manual.interpretation),
    reference_range_snapshot: valueText(manual.reference_range)
  }
  const hasClinicalValue = Object.values(clinical).some(value => value.trim())
  const now = app.curDate('YYYY-MM-DD HH:mm:ss')
  const actor = valueText(userInfo.username || userInfo.account && userInfo.account.name).trim()
  const reportKey = 'manual|' + workItemId
  let reportRowsForWork = []
  try {
    reportRowsForWork = await formRows(
      RESULT_REPORT_FORM_ID,
      'report_key = :reportKey AND xrstatx NOT IN (0,3)',
      { reportKey },
      [{ column: 'xupdatx', sort: 'DESC' }],
      2
    )
  } catch (error) {
    return { success: false, message: 'ค้นหา Result Report ไม่สำเร็จ' }
  }

  let resultReportId = valueText(reportRowsForWork[0] && reportRowsForWork[0]._id).trim()
  const reportData = {
    xparentx: app.dbObjectId(workItemId),
    filler_order_no: labNo,
    hn: patientHn,
    visit_id: visitVn,
    order_no: workItemId,
    order_status_id: workItemId,
    lab_section: itemSectionCode,
    lab_section_name: valueText(context.section && (context.section.name_th || context.section.name)),
    record_kind: 'report',
    report_key: reportKey,
    receipt_status: 'processed',
    source_channel: 'manual',
    internal_overall_status: hasClinicalValue ? 'partial' : 'processing',
    reported_at: hasClinicalValue ? now : '',
    reported_by_source_id: hasClinicalValue ? actor : '',
    reported_by_source_name: hasClinicalValue ? actor : '',
    item_count: 1,
    matched_item_count: 1,
    unmatched_item_count: 0,
    processed_at: now,
    error_message: ''
  }
  try {
    if (!resultReportId) {
      const draft = await app.insertData(RESULT_REPORT_FORM_ID, userInfo)
      resultReportId = valueText(draft && (
        draft.id ||
        draft.data && (draft.data._id || draft.data.id) ||
        draft.reply && (draft.reply.id || draft.reply.data && draft.reply.data._id)
      )).trim()
      if (!draft || draft.success === false || !resultReportId) {
        return { success: false, message: 'สร้าง draft Result Report ไม่สำเร็จ' }
      }
    }
    const reportSaved = await app.sdformSetOne(
      RESULT_REPORT_FORM_ID,
      resultReportId,
      { ...reportData, result_report_id: resultReportId },
      1,
      userInfo
    )
    if (!reportSaved || reportSaved.success === false) {
      return { success: false, message: 'บันทึก Result Report ไม่สำเร็จ' }
    }
  } catch (error) {
    return { success: false, message: 'บันทึก Result Report ไม่สำเร็จ: ' + valueText(error && error.message || error) }
  }

  const manualValueChanged = Boolean(
    current && hasClinicalValue && valueText(current.result_value) !== clinical.result_value
  )
  const reportParent = app.dbObjectId(resultReportId)
  const rowData = {
    xparentx: reportParent,
    parent_id: {
      value: reportParent,
      label: 'LAB ' + labNo + ' · HN ' + patientHn + ' · VN ' + visitVn,
      filler_order_no: labNo,
      hn: patientHn,
      visit_id: visitVn,
      lab_section: itemSectionCode
    },
    result_report_id: resultReportId,
    result_definition_id: valueText(current && current.result_definition_id),
    order_no: workItemId,
    filler_order_no: labNo,
    lab_section: itemSectionCode,
    hn: patientHn,
    visit_id: visitVn,
    result_sequence: String(context.item.item_no || 1),
    test_code: testCode,
    obs_code: testCode,
    obs_name: testName,
    test_name: testName,
    result_value: clinical.result_value,
    units: clinical.unit_symbol_snapshot,
    unit_symbol_snapshot: clinical.unit_symbol_snapshot,
    ref_range: clinical.reference_range_snapshot,
    reference_range_snapshot: clinical.reference_range_snapshot,
    interpretation_code: clinical.interpretation_code,
    result_source: 'manual',
    result_status: hasClinicalValue ? 'entered' : 'draft',
    change_kind: manualValueChanged ? 'corrected' : valueText(current && current.change_kind) || 'first',
    previous_value: '',
    entered_at: hasClinicalValue ? valueText(current && current.entered_at) || now : '',
    entered_by: hasClinicalValue ? valueText(current && current.entered_by) || actor : '',
    last_edited_at: manualValueChanged ? now : '',
    last_edited_by: manualValueChanged ? actor : '',
    edit_history_json: '[]'
  }

  let resultItemId = currentIsLegacy ? '' : valueText(current && (current._id || current.id)).trim()
  try {
    if (!resultItemId) {
      const draft = await app.insertData(RESULT_ITEM_FORM_ID, userInfo)
      resultItemId = valueText(draft && (
        draft.id ||
        draft.data && (draft.data._id || draft.data.id) ||
        draft.reply && (draft.reply.id || draft.reply.data && draft.reply.data._id)
      )).trim()
      if (!draft || draft.success === false || !resultItemId) {
        return { success: false, message: 'สร้าง draft ผล Manual ไม่สำเร็จ' }
      }
    }
    const saved = await app.sdformSetOne(RESULT_ITEM_FORM_ID, resultItemId, rowData, 1, userInfo)
    if (!saved || saved.success === false) {
      return { success: false, message: 'บันทึกผล Manual ไม่สำเร็จ' }
    }
  } catch (error) {
    return { success: false, message: 'บันทึกผล Manual ไม่สำเร็จ: ' + valueText(error && error.message || error) }
  }

  if (hasClinicalValue && itemStatus !== 'resulted') {
    if (!context.workItem || !context.workItem._id) {
      return { success: false, message: 'บันทึกผลแล้ว แต่ไม่พบ Lab Work Item สำหรับปรับสถานะ กรุณาให้ผู้ดูแลตรวจสอบ' }
    }
    try {
      const statusSaved = await app.dbUpdate(
        { work_status: 'resulted', resulted_at: now, resulted_by: actor },
        WORK_ITEM_COLLECTION,
        userInfo,
        {
          _id: context.workItem._id,
          xrstatx: { $nin: [0, 3] },
          work_status: { $in: ['received', 'processing'] }
        }
      )
      if (!statusSaved || statusSaved.success === false) {
        return { success: false, message: 'บันทึกผลแล้ว แต่ปรับสถานะ Lab Work Item ไม่สำเร็จ กรุณาให้ผู้ดูแลตรวจสอบ' }
      }
    } catch (error) {
      return { success: false, message: 'บันทึกผลแล้ว แต่ปรับสถานะ Lab Work Item ไม่สำเร็จ กรุณาให้ผู้ดูแลตรวจสอบ' }
    }
  }

  return {
    success: true,
    data: responseData({ _id: resultItemId, ...rowData }),
    message: hasClinicalValue ? 'บันทึกผล Manual แล้ว' : 'บันทึกร่างผล Manual แล้ว'
  }
}

if (action === 'update_specimen') {
  const itemId = valueText(params.item_id).trim()
  const specimenCode = valueText(params.specimen_code).trim().toUpperCase()
  if (!/^[a-f0-9]{24}$/i.test(itemId)) {
    return { success: false, message: 'item_id ไม่ถูกต้อง' }
  }
  if (!specimenCode) {
    return { success: false, message: 'กรุณาเลือก specimen' }
  }

  let item
  let master
  let section
  let workItem
  try {
    const itemFound = await app.dbFindById(app.dbObjectId(itemId), ITEM_COLLECTION)
    item = itemFound && itemFound.reply && itemFound.reply.data
    if (!item || [0, 3].includes(item.xrstatx)) {
      return { success: false, message: 'ไม่พบ CPOE Item ที่ต้องการแก้ไข' }
    }
    if (valueText(item.service_type && item.service_type.value).toLowerCase() !== 'lab') {
      return { success: false, message: 'แก้ specimen ได้เฉพาะ LAB Item' }
    }
    workItem = await app.db.collection(WORK_ITEM_COLLECTION).findOne({
      xrstatx: { $nin: [0, 3] },
      $or: [{ _id: app.dbObjectId(itemId) }, { source_specimen_record_id: itemId }]
    })
    const cpoeStatus = valueText(item.current_status).trim().toLowerCase()
    const workStatus = valueText(workItem && workItem.work_status).trim().toLowerCase()
    const hasReceiptEvidence = Boolean(valueText(item.received_at || item.lab_no).trim())
    const effectiveWaiting = workItem
      ? workStatus === 'waiting_receive'
      : PRE_RECEIVE_CPOE_STATUSES.includes(cpoeStatus) && !hasReceiptEvidence
    if (!effectiveWaiting) {
      return { success: false, message: 'แก้ specimen ได้เฉพาะรายการที่ยังรอรับ' }
    }
    if (item.item_data_id) {
      const masterFound = await app.dbFindById(item.item_data_id, ITEM_MASTER_COLLECTION)
      master = masterFound && masterFound.reply && masterFound.reply.data
    }
    const route = item.section_snapshot ||
      (item.lab_context_snapshot && item.lab_context_snapshot.section) ||
      (master && master.section) || {}
    section = route
    if (!valueText(section.code) && section.value) {
      const sectionFound = await app.dbFindById(section.value, SECTION_COLLECTION)
      section = sectionFound && sectionFound.reply && sectionFound.reply.data || section
    }
  } catch (error) {
    return { success: false, message: 'ตรวจสอบ CPOE Item ไม่สำเร็จ' }
  }

  const itemSectionCode = valueText(section && section.code).trim().toUpperCase()
  if (!allowedLookup[itemSectionCode]) {
    return { success: false, message: 'Item นี้ไม่ได้อยู่ใน Section ของ Organization ปัจจุบัน' }
  }

  const orderRef = item.order_id && item.order_id.value ? item.order_id.value : item.xparentx
  const orderId = valueText(orderRef).trim()
  if (/^[a-f0-9]{24}$/i.test(orderId)) {
    const cancellation = await app.db.collection(ORDER_CANCELLATION_COLLECTION).findOne({
      xrstatx: { $nin: [0, 3] },
      source_order_id: orderId,
      cancel_status: { $in: ['pending', 'applied'] },
      $or: [
        { cancel_scope: { $ne: 'section' } },
        { cancel_scope: 'section', section_codes: itemSectionCode }
      ]
    })
    if (cancellation) return { success: false, message: 'Order นี้ถูกยกเลิกแล้ว จึงแก้ specimen ไม่ได้' }
  }

  let specimen
  try {
    const found = await app.dbFindAll(
      {
        from: SPECIMEN_COLLECTION,
        nosql: {
          type: 'query',
          collection: SPECIMEN_COLLECTION,
          query: {
            xrstatx: { $nin: [0, 3] },
            specimen_code: specimenCode
          },
          projection: { _id: 1, specimen_code: 1, specimen_name: 1, is_active: 1 },
          limit: 2000
        }
      },
      false,
      false
    )
    const rows = found && found.success !== false && found.reply && Array.isArray(found.reply.data)
      ? found.reply.data
      : []
    specimen = rows.find(row => specimenIsActive(row) && valueText(row.specimen_code).trim().toUpperCase() === specimenCode)

    // บาง site มี code อยู่ใน CPOE Item master แล้ว แต่ Specimen master กลางยังไม่ครบ
    // จึงยอมรับเฉพาะ code ที่ถูกผูกกับ LAB item ที่ active จริง ไม่รับค่าลอยจากหน้าจอ.
    if (!specimen) {
      const configured = await app.dbFindAll(
        {
          from: ITEM_MASTER_COLLECTION,
          nosql: {
            type: 'query',
            collection: ITEM_MASTER_COLLECTION,
            query: {
              xrstatx: { $nin: [0, 3] },
              $or: [
                { 'lab_item.specimen.code': specimenCode },
                { 'lab_item.specimen.value': specimenCode },
                { 'lab_item.specimen.specimen_code': specimenCode }
              ]
            },
            projection: { _id: 1, 'lab_item.specimen': 1 },
            limit: 20
          }
        },
        false,
        false
      )
      const configuredRows = configured && configured.success !== false && configured.reply && Array.isArray(configured.reply.data)
        ? configured.reply.data
        : []
      let configuredOption = null
      configuredRows.some(row => {
        const raw = row && row.lab_item && row.lab_item.specimen
        const refs = Array.isArray(raw) ? raw : [raw]
        configuredOption = refs
          .map(specimenOptionOf)
          .find(option => option && option.value.toUpperCase() === specimenCode) || null
        return Boolean(configuredOption)
      })
      if (configuredOption) {
        specimen = {
          specimen_code: configuredOption.value,
          specimen_name: configuredOption.label
        }
      }
    }
  } catch (error) {
    return { success: false, message: 'ตรวจสอบ Specimen master ไม่สำเร็จ' }
  }
  if (!specimen) {
    return { success: false, message: 'ไม่พบ specimen ที่เปิดใช้งาน' }
  }

  const specimenName = valueText(specimen.specimen_name || specimen.specimen_code).trim()
  const labData = item.lab_data && typeof item.lab_data === 'object' ? item.lab_data : {}
  const nextLabData = {
    ...labData,
    spec_source: specimenName,
    spec_source_code: specimenCode
  }
  let updated
  try {
    updated = await app.dbUpdate(
      { lab_data: nextLabData },
      ITEM_COLLECTION,
      userInfo,
      {
        _id: app.dbObjectId(itemId),
        xrstatx: { $nin: [0, 3] },
        current_status: { $in: PRE_RECEIVE_CPOE_STATUSES },
        received_at: { $in: [null, ''] },
        lab_no: { $in: [null, ''] }
      }
    )
  } catch (error) {
    return { success: false, message: 'บันทึก specimen ไม่สำเร็จ' }
  }
  if (!updated || updated.success === false) {
    return { success: false, message: 'บันทึก specimen ไม่สำเร็จ' }
  }
  return {
    success: true,
    data: {
      item_id: itemId,
      specimen_code: specimenCode,
      specimen_name: specimenName
    },
    message: 'อัปเดต specimen แล้ว'
  }
}

if (action !== 'list') {
  return { success: false, message: 'ไม่รองรับ action นี้' }
}

let specimenOptions = []
if (params.include_specimens !== false) {
  try {
    const found = await app.dbFindAll(
      {
        from: SPECIMEN_COLLECTION,
        nosql: {
          type: 'query',
          collection: SPECIMEN_COLLECTION,
          query: {
            xrstatx: { $nin: [0, 3] }
          },
          projection: {
            _id: 1,
            specimen_code: 1,
            specimen_name: 1,
            is_active: 1
          },
          sort: { specimen_name: 1, specimen_code: 1 },
          limit: 2000
        }
      },
      false,
      false
    )
    if (found && found.success !== false) {
      const rows = found.reply && Array.isArray(found.reply.data) ? found.reply.data : []
      const seenSpecimenCodes = {}
      specimenOptions = rows
        .filter(specimenIsActive)
        .map(row => ({
          value: valueText(row.specimen_code).trim(),
          label: valueText(row.specimen_name || row.specimen_code).trim()
        }))
        .filter(option => {
          const key = option.value.toUpperCase()
          if (!key || seenSpecimenCodes[key]) return false
          seenSpecimenCodes[key] = true
          return true
        })
    }

    // CPOE Item master คือแหล่งที่ผูก specimen กับรายการตรวจจริง จึงนำ code ที่
    // active และถูกใช้งานอยู่มารวมด้วย เพื่อไม่ให้ dropdown เหลือแค่แถวเดียวเมื่อ
    // Specimen master กลางของ site ยัง seed ไม่ครบ.
    try {
      const configuredFound = await app.dbFindAll(
        {
          from: ITEM_MASTER_COLLECTION,
          nosql: {
            type: 'aggregate',
            collections: [ITEM_MASTER_COLLECTION],
            pipeline: [
              {
                $match: {
                  xrstatx: { $nin: [0, 3] },
                  'lab_item.specimen': { $exists: true, $ne: null }
                }
              },
              {
                $project: {
                  specimens: {
                    $cond: [
                      { $isArray: '$lab_item.specimen' },
                      '$lab_item.specimen',
                      ['$lab_item.specimen']
                    ]
                  }
                }
              },
              { $unwind: '$specimens' },
              {
                $project: {
                  specimen_code: {
                    $ifNull: [
                      '$specimens.specimen_code',
                      { $ifNull: ['$specimens.code', '$specimens.value'] }
                    ]
                  },
                  specimen_name: {
                    $ifNull: [
                      '$specimens.specimen_name',
                      { $ifNull: ['$specimens.name', '$specimens.label'] }
                    ]
                  }
                }
              },
              { $match: { specimen_code: { $nin: [null, ''] } } },
              {
                $group: {
                  _id: '$specimen_code',
                  specimen_code: { $first: '$specimen_code' },
                  specimen_name: { $first: '$specimen_name' }
                }
              },
              { $sort: { specimen_name: 1, specimen_code: 1 } },
              { $limit: 2000 }
            ]
          }
        },
        false,
        false
      )
      const configuredRows = configuredFound && configuredFound.success !== false && configuredFound.reply && Array.isArray(configuredFound.reply.data)
        ? configuredFound.reply.data
        : []
      specimenOptions = mergeSpecimenOptions(specimenOptions, configuredRows)
    } catch (error) {
      // master กลางยังเป็น fallback เดิมได้ จึงไม่ทำให้ทั้ง Worklist ล้ม
    }
  } catch (error) {
    return { success: false, message: 'อ่าน Specimen master ไม่สำเร็จ' }
  }
}

const allowedStatuses = {
  draft: true,
  sent: true,
  accepted: true,
  prepared: true,
  ready: true,
  dispensed: true,
  cancelled: true,
  returned: true,
  reversed: true,
  rejected: true,
  resulted: true,
  completed: true
}
const requestedStatuses = listText(params.statuses || params.status)
  .map(status => status.toLowerCase())
const lookupStatuses = lookupMode === 'results'
  ? ['resulted', 'completed']
  : ['sent', 'accepted', 'prepared', 'ready', 'dispensed', 'resulted', 'completed', 'cancelled', 'rejected']
const statuses = (crossSectionRequested
  ? lookupStatuses
  : (requestedStatuses.length ? requestedStatuses : ['sent']))
  .filter(status => allowedStatuses[status])

// A Worklist tab selects an Order+Section row, not individual Items. Normalize
// the raw Item statuses to the single bucket used for that row after all sibling
// Items have been grouped. This keeps a rejected Item attached to its Order and
// prevents one Order from being split between the active and cancelled tabs.
const receivedRowStatuses = ['accepted', 'prepared', 'dispensed']
const cancelledRowStatuses = ['cancelled', 'returned', 'reversed']
const rowFilterStatuses = [...new Set(statuses.map(status => {
  if (receivedRowStatuses.includes(status)) return 'accepted'
  if (cancelledRowStatuses.includes(status)) return 'cancelled'
  return status
}))]

if (!statuses.length) {
  return { success: false, message: 'ไม่พบสถานะที่รองรับในคำขอ' }
}

const page = clampInt(params.page, 1, 1, 1000000)
const limit = clampInt(params.limit, 30, 1, 100)
const skip = (page - 1) * limit
const hn = valueText(params.hn).trim()
const requestedDateFrom = valueText(params.date_from).trim()
const requestedDateTo = valueText(params.date_to).trim()
const allDatesRequested = params.all_dates === true || valueText(params.all_dates).trim().toLowerCase() === 'true'
const priorities = listText(params.priorities || params.priority)
  .filter(priority => ['1', '2', '3', '4', '5'].includes(priority))

if ((requestedDateFrom && !validDate(requestedDateFrom)) || (requestedDateTo && !validDate(requestedDateTo))) {
  return { success: false, message: 'date_from/date_to ต้องเป็น YYYY-MM-DD' }
}

/* เพิ่ม 2026-09-07 ตามคำสั่งผู้ใช้: Worklist เป็นคิวประจำวันเหมือน Patient "เปิด VN วันนี้"
   - ไม่ส่งช่วงวันที่ ⇒ API บังคับวันปัจจุบันเอง เพื่อกันหน้า/ผู้เรียกอื่นหลุดไปเห็น archive
   - `all_dates` เปิดได้เฉพาะ exact HN + completed เพื่อรักษาหน้าดูผลย้อนหลังเดิม
   - เป็น read filter เท่านั้น ไม่มีการลบ/แก้ Order, Work Item, Outbound หรือ Result ใด ๆ */
const allDatesAllowed = crossSectionRequested
  ? allDatesRequested && !!hn
  : allDatesRequested && !!hn && statuses.length === 1 && statuses[0] === 'completed'
if (allDatesRequested && !allDatesAllowed) {
  return { success: false, message: crossSectionRequested
    ? 'all_dates ในโหมดสืบค้นต้องระบุ HN แบบ exact'
    : 'all_dates ใช้ได้เฉพาะการค้นผล completed ด้วย HN แบบ exact เท่านั้น' }
}
if (allDatesAllowed && (requestedDateFrom || requestedDateTo)) {
  return { success: false, message: 'all_dates ห้ามใช้ร่วมกับ date_from/date_to' }
}
if (crossSectionRequested && !allDatesRequested && Boolean(requestedDateFrom) !== Boolean(requestedDateTo)) {
  return { success: false, message: 'โหมดสืบค้นต้องระบุช่วงวันที่ให้ครบทั้งวันเริ่มต้นและวันสิ้นสุด' }
}
if (crossSectionRequested && !allDatesRequested && !requestedDateFrom && !requestedDateTo) {
  return { success: false, error: 'lookup_scope_required', message: 'โปรดระบุ HN หรือเลือกช่วงวันที่' }
}
const nowText = typeof app.curDate === 'function' ? valueText(app.curDate()) : ''
const currentDate = validDate(nowText.slice(0, 10))
  ? nowText.slice(0, 10)
  : new Date(Date.now() + (7 * 60 * 60 * 1000)).toISOString().slice(0, 10)
const defaultDateScope = !crossSectionRequested && !allDatesAllowed && !requestedDateFrom && !requestedDateTo
const dateFrom = defaultDateScope ? currentDate : requestedDateFrom
const dateTo = defaultDateScope ? currentDate : requestedDateTo

const itemMatch = {
  xrstatx: { $nin: [0, 3] },
  'service_type.value': 'lab'
}

const orderMatch = {
  'order.xrstatx': { $nin: [0, 3] }
}
if (hn) orderMatch['order.vid.pid.hn'] = hn
if (priorities.length) orderMatch['order.priority'] = { $in: priorities }

// The history path starts from CPOE Order so exact HN + created_at can use
// ipd_order_hn_created. It then expands only LAB Items and normalizes them into
// the same shape as the proven daily Item-root pipeline.
const lookupOrderMatch = { xrstatx: { $nin: [0, 3] } }
if (hn) lookupOrderMatch['vid.pid.hn'] = hn
if (priorities.length) lookupOrderMatch.priority = { $in: priorities }
if (dateFrom || dateTo) {
  lookupOrderMatch.created_at = {}
  if (dateFrom) lookupOrderMatch.created_at.$gte = dateFrom
  if (dateTo) lookupOrderMatch.created_at.$lt = nextDate(dateTo)
}
const lookupRootStages = [
  { $match: lookupOrderMatch },
  { $sort: { created_at: -1, _id: -1 } },
  { $addFields: { _lookup_order: '$$ROOT' } },
  {
    $lookup: {
      from: ITEM_COLLECTION,
      let: { lookup_order_id: '$_id' },
      pipeline: [
        {
          $match: {
            xrstatx: { $nin: [0, 3] },
            'service_type.value': 'lab',
            $expr: {
              $or: [
                { $eq: ['$order_id.value', '$$lookup_order_id'] },
                { $eq: ['$xparentx', '$$lookup_order_id'] }
              ]
            }
          }
        }
      ],
      as: 'lookup_items'
    }
  },
  { $unwind: { path: '$lookup_items', preserveNullAndEmptyArrays: false } },
  { $replaceRoot: { newRoot: { $mergeObjects: ['$lookup_items', { order: '$_lookup_order' }] } } }
]

const requestedAtExpr = {
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
}

/* เวลาแกนของรายการประจำวันยึดตามสถานะที่ผู้ใช้เห็น ไม่เปลี่ยนสถานะจริง:
   รอรับ=request, รับแล้ว=receive, ออกผล=result, ยกเลิก/ปฏิเสธ=action time */
const dailyStatusAtExpr = {
  $switch: {
    branches: [
      {
        case: { $eq: ['$effective_status', 'cancelled'] },
        then: {
          $ifNull: [
            '$work_item.cancelled_at',
            { $ifNull: ['$order_cancellation.cancelled_at', { $ifNull: ['$cancelled_at', requestedAtExpr] }] }
          ]
        }
      },
      {
        case: { $eq: ['$effective_status', 'rejected'] },
        then: { $ifNull: ['$work_item.rejected_at', { $ifNull: ['$rejected_at', requestedAtExpr] }] }
      },
      {
        case: { $in: ['$effective_status', ['resulted', 'completed']] },
        then: {
          $ifNull: [
            '$work_item.latest_result_at',
            {
              $ifNull: [
                '$work_item.resulted_at',
                {
                  $ifNull: [
                    '$resulted_at',
                    {
                      $cond: [
                        { $eq: ['$effective_status', 'resulted'] },
                        '$work_item.updated_at',
                        { $ifNull: ['$work_item.completed_at', requestedAtExpr] }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      },
      {
        case: { $in: ['$effective_status', receivedRowStatuses] },
        then: { $ifNull: ['$work_item.received_at', { $ifNull: ['$received_at', requestedAtExpr] }] }
      }
    ],
    default: requestedAtExpr
  }
}

const dailyDateMatch = {}
if (dateFrom) dailyDateMatch.$gte = dateFrom
if (dateTo) dailyDateMatch.$lte = dateTo

const pipeline = [
  ...(crossSectionRequested ? lookupRootStages : [{ $match: itemMatch }]),
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
    $lookup: {
      from: WORK_ITEM_COLLECTION,
      let: { source_item_id: { $toString: '$_id' } },
      pipeline: [
        {
          $match: {
            xrstatx: { $nin: [0, 3] },
            is_current_attempt: { $ne: false },
            $expr: { $eq: ['$source_specimen_record_id', '$$source_item_id'] }
          }
        },
        { $sort: { updated_at: -1, created_at: -1 } },
        { $limit: 1 }
      ],
      as: 'work_item'
    }
  },
  { $unwind: { path: '$work_item', preserveNullAndEmptyArrays: true } },
  {
    $addFields: {
      route_section: {
        $cond: [
          {
            $eq: ['$work_item.cbc_swap_active', true]
          },
          {
            code: '$work_item.section_code',
            name: '$work_item.section_name',
            name_th: '$work_item.section_name',
            enable: true
          },
          {
            $ifNull: [
              '$section_snapshot',
              { $ifNull: ['$lab_context_snapshot.section', '$master.section'] }
            ]
          }
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
  {
    $addFields: {
      resolved_section: { $ifNull: ['$section_master', '$route_section'] }
    }
  },
  {
    $match: {
      'resolved_section.code': { $in: allowedSectionCodes },
      'resolved_section.enable': { $ne: false }
    }
  },
  {
    $lookup: {
      from: ORDER_CANCELLATION_COLLECTION,
      let: {
        source_order_id: { $toString: '$order_ref_id' },
        section_code: '$resolved_section.code',
        item_id: { $toString: '$_id' }
      },
      pipeline: [
        {
          $match: {
            xrstatx: { $nin: [0, 3] },
            cancel_status: { $in: ['pending', 'applied'] },
            $expr: {
              $and: [
                { $eq: ['$source_order_id', '$$source_order_id'] },
                {
                  $or: [
                    { $ne: [{ $ifNull: ['$cancel_scope', 'order'] }, 'section'] },
                    {
                      $and: [
                        { $in: ['$$section_code', { $ifNull: ['$section_codes', []] }] },
                        { $in: ['$$item_id', { $ifNull: ['$item_ids', []] }] }
                      ]
                    }
                  ]
                }
              ]
            }
          }
        },
        { $sort: { updated_at: -1, created_at: -1 } },
        { $limit: 1 }
      ],
      as: 'order_cancellation'
    }
  },
  { $unwind: { path: '$order_cancellation', preserveNullAndEmptyArrays: true } },
  {
    $addFields: {
      effective_status: {
        $switch: {
          branches: [
            {
              case: { $ne: [{ $ifNull: ['$order_cancellation._id', null] }, null] },
              then: 'cancelled'
            },
            { case: { $eq: ['$work_item.work_status', 'waiting_receive'] }, then: 'sent' },
            { case: { $eq: ['$work_item.work_status', 'received'] }, then: 'accepted' },
            { case: { $eq: ['$work_item.work_status', 'processing'] }, then: 'prepared' },
            { case: { $eq: ['$work_item.work_status', 'resulted'] }, then: 'resulted' },
            { case: { $eq: ['$work_item.work_status', 'completed'] }, then: 'completed' },
            { case: { $eq: ['$work_item.work_status', 'rejected'] }, then: 'rejected' },
            { case: { $eq: ['$work_item.work_status', 'cancelled'] }, then: 'cancelled' },
            {
              case: {
                $and: [
                  { $eq: [{ $ifNull: ['$work_item._id', null] }, null] },
                  { $in: ['$current_status', LEGACY_WAITING_CPOE_STATUSES] },
                  { $eq: [{ $ifNull: ['$received_at', ''] }, ''] },
                  { $eq: [{ $ifNull: ['$lab_no', ''] }, ''] }
                ]
              },
              then: 'sent'
            }
          ],
          default: '$current_status'
        }
      }
    }
  },
  {
    $lookup: {
      from: ITEM_MASTER_COLLECTION,
      let: { item_code: '$item_code' },
      pipeline: [
        {
          $match: {
            $expr: {
              $in: ['$$item_code', { $ifNull: ['$sub_order.value', []] }]
            }
          }
        },
        { $project: { _id: 1, item_code: 1, item_name: 1 } },
        { $limit: 1 }
      ],
      as: 'set_master'
    }
  },
  { $unwind: { path: '$set_master', preserveNullAndEmptyArrays: true } },
  ...(crossSectionRequested ? [] : [
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
    { $addFields: { daily_scope_at: dailyStatusAtExpr } },
    {
      $addFields: {
        daily_scope_day: {
          $substrCP: [
            {
              $convert: {
                input: '$daily_scope_at',
                to: 'string',
                onError: '',
                onNull: ''
              }
            },
            0,
            10
          ]
        }
      }
    },
    ...(dateFrom || dateTo ? [{ $match: { daily_scope_day: dailyDateMatch } }] : [])
  ]),
  { $sort: { 'order.created_at': -1, created_at: 1, item_no: 1, item_code: 1 } },
  {
    $group: {
      _id: {
        order_id: '$order._id',
        section_code: '$resolved_section.code'
      },
      order: { $first: '$order' },
      items: {
        $push: {
          item_id: { $toString: '$_id' },
          item_code: { $cond: [{ $eq: ['$work_item.cbc_swap_active', true] }, '$work_item.effective_item_code', '$item_code'] },
          item_name: { $cond: [{ $eq: ['$work_item.cbc_swap_active', true] }, '$work_item.effective_item_name', '$item_name'] },
          ordered_item_code: '$item_code',
          cbc_swap_active: { $eq: ['$work_item.cbc_swap_active', true] },
          cbc_swap_count: { $ifNull: ['$work_item.cbc_swap_count', 0] },
          quantity: '$quantity',
          current_status: '$effective_status',
          work_status: '$work_item.work_status',
          work_item_id: { $toString: '$work_item._id' },
          attempt_no: { $ifNull: ['$work_item.attempt_no', 1] },
          retest_of_work_item_id: '$work_item.retest_of_work_item_id',
          retest_pending_lab_no: { $eq: ['$work_item.retest_pending_lab_no', true] },
          service_type: '$service_type',
          item_master_id: {
            $cond: [
              { $eq: ['$work_item.cbc_swap_active', true] },
              '$work_item.effective_item_master_id',
              { $toString: '$item_data_id' }
            ]
          },
          section: {
            id: { $toString: '$resolved_section._id' },
            code: '$resolved_section.code',
            name: '$resolved_section.name',
            name_th: '$resolved_section.name_th',
            ref_code: '$resolved_section.ref_code',
            unit: '$resolved_section.unit'
          },
          specimen: {
            options: {
              $cond: [
                { $isArray: '$master.lab_item.specimen' },
                '$master.lab_item.specimen',
                {
                  $cond: [
                    { $ne: [{ $ifNull: ['$master.lab_item.specimen', null] }, null] },
                    ['$master.lab_item.specimen'],
                    []
                  ]
                }
              ]
            },
            master: {
              code: '$master.lab_item.specimen.code',
              name: '$master.lab_item.specimen.name'
            },
            ordered: {
              source: { $ifNull: ['$lab_data.spec_source', '$lab_data.source'] },
              source_code: '$lab_data.spec_source_code',
              storage: { $ifNull: ['$lab_data.ship_storage', '$lab_data.storage'] },
              collected_at: { $ifNull: ['$lab_data.specimen_at', '$lab_data.at'] },
              collected_by: { $ifNull: ['$lab_data.specimen_by', '$lab_data.by'] }
            },
            complete: {
              $ne: [{ $ifNull: ['$lab_data.spec_source', { $ifNull: ['$lab_data.source', ''] }] }, '']
            }
          },
          mapping: {
            his_lab_code: '$master.lab_item.his_lab_code',
            c_test: '$master.lab_item.c_test',
            tmt_code: '$master.lab_item.tmt_code'
          },
          panel: {
            ordered_as: {
              $cond: [
                { $ne: [{ $ifNull: ['$set_master.item_code', ''] }, ''] },
                'group_child',
                {
                  $cond: [
                    { $ne: [{ $ifNull: ['$master.lab_parent.value', ''] }, ''] },
                    'exclusive_child',
                    'single_or_parent'
                  ]
                }
              ]
            },
            set_code: '$set_master.item_code',
            set_name: '$set_master.item_name',
            parent_code: '$master.lab_parent.value',
            parent_name: '$master.lab_parent.label'
          },
          lab_no: { $ifNull: ['$work_item.lab_no', '$lab_no'] },
          received_at: { $ifNull: ['$work_item.received_at', '$received_at'] },
          received_by: { $ifNull: ['$work_item.received_by', '$received_by'] },
          latest_result_at: {
            $ifNull: [
              '$work_item.latest_result_at',
              {
                $ifNull: [
                  '$work_item.resulted_at',
                  {
                    $ifNull: [
                      '$resulted_at',
                      {
                        $cond: [
                          { $eq: ['$effective_status', 'resulted'] },
                          '$work_item.updated_at',
                          ''
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          resulted_at: { $ifNull: ['$work_item.resulted_at', '$resulted_at'] },
          is_critical: '$is_critical',
          result_summary: '$result_summary',
          is_hide_result: { $eq: ['$is_hide_result', true] },
          result_visibility_action: '$result_visibility_action',
          result_visibility_reason: '$result_visibility_reason',
          result_visibility_by: '$result_visibility_by',
          result_visibility_at: '$result_visibility_at',
          rejected_at: { $ifNull: ['$work_item.rejected_at', '$rejected_at'] },
          rejected_by: { $ifNull: ['$work_item.rejected_by', '$rejected_by'] },
          reject_reason_code: { $ifNull: ['$work_item.reject_reason_code', '$reject_reason_code'] },
          reject_reason_detail: { $ifNull: ['$work_item.reject_reason_detail', '$reject_reason_detail'] },
          reject_reason: {
            $cond: [
              { $ne: [{ $ifNull: ['$work_item.reject_reason_detail', ''] }, ''] },
              '$work_item.reject_reason_detail',
              { $ifNull: ['$work_item.reject_reason_code', '$reject_reason'] }
            ]
          },
          cancellation_record_id: { $toString: '$order_cancellation._id' },
          cancel_type: { $ifNull: ['$work_item.cancel_type', '$order_cancellation.cancel_type'] },
          cancel_reason: { $ifNull: ['$work_item.cancel_reason', '$order_cancellation.cancel_reason'] },
          cancelled_at: { $ifNull: ['$work_item.cancelled_at', '$order_cancellation.cancelled_at'] },
          cancelled_by: { $ifNull: ['$work_item.cancelled_by', '$order_cancellation.cancelled_by'] }
        }
      }
    }
  },
  {
    $addFields: {
      row_filter_status: {
        $let: {
          vars: {
            item_statuses: {
              $map: {
                input: '$items',
                as: 'item',
                in: '$$item.current_status'
              }
            },
            active_statuses: {
              $map: {
                input: {
                  $filter: {
                    input: '$items',
                    as: 'item',
                    cond: {
                      $not: [{
                        $in: [
                          '$$item.current_status',
                          ['cancelled', 'rejected', 'returned', 'reversed']
                        ]
                      }]
                    }
                  }
                },
                as: 'item',
                in: '$$item.current_status'
              }
            }
          },
          in: {
            $switch: {
              branches: [
                {
                  // No active sibling remains: all rejected => rejected;
                  // a mixed terminal row belongs to the cancelled bucket.
                  case: { $eq: [{ $size: '$$active_statuses' }, 0] },
                  then: {
                    $cond: [
                      {
                        $eq: [
                          {
                            $size: {
                              $filter: {
                                input: '$$item_statuses',
                                as: 'status',
                                cond: { $ne: ['$$status', 'rejected'] }
                              }
                            }
                          },
                          0
                        ]
                      },
                      'rejected',
                      'cancelled'
                    ]
                  }
                },
                // An Order with a waiting sibling remains in the waiting tab.
                { case: { $in: ['sent', '$$active_statuses'] }, then: 'sent' },
                { case: { $in: ['ready', '$$active_statuses'] }, then: 'ready' },
                {
                  case: {
                    $eq: [
                      {
                        $size: {
                          $filter: {
                            input: '$$active_statuses',
                            as: 'status',
                            cond: { $ne: ['$$status', 'completed'] }
                          }
                        }
                      },
                      0
                    ]
                  },
                  then: 'completed'
                },
                {
                  case: {
                    $gt: [
                      { $size: { $setIntersection: ['$$active_statuses', ['resulted', 'completed']] } },
                      0
                    ]
                  },
                  then: 'resulted'
                },
                {
                  case: {
                    $gt: [
                      { $size: { $setIntersection: ['$$active_statuses', receivedRowStatuses] } },
                      0
                    ]
                  },
                  then: 'accepted'
                },
                { case: { $in: ['draft', '$$active_statuses'] }, then: 'draft' }
              ],
              default: { $arrayElemAt: ['$$active_statuses', 0] }
            }
          }
        }
      }
    }
  },
  ...(!crossSectionRequested
    ? [{ $match: { row_filter_status: { $in: rowFilterStatuses } } }]
    : []),
  {
    $project: {
      _id: 0,
      _diagnosis_visit_id: '$order.xparentx',
      row_key: {
        $concat: [{ $toString: '$_id.order_id' }, '|', '$_id.section_code']
      },
      order_id: { $toString: '$_id.order_id' },
      section_code: '$_id.section_code',
      order_number: '$order.order_number',
      current_status: '$order.current_status',
      requested_at: requestedAtExpr,
      priority: '$order.priority',
      prior_medication: '$order.prior_medication',
      prior_specify: '$order.prior_specify',
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
      order_tags: '$order.order_tags',
      items: 1,
      item_count: { $size: '$items' }
    }
  },
  ...(crossSectionRequested && lookupMode === 'results'
    ? [{ $match: { 'items.current_status': { $in: ['resulted', 'completed'] } } }]
    : []),
  { $sort: { requested_at: -1, order_number: -1 } },
  {
    $facet: {
      rows: [
        { $skip: skip },
        { $limit: limit },
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
        { $project: { _diagnosis_visit_id: 0, diagnosis_record: 0 } }
      ],
      meta: [{ $count: 'total' }]
    }
  }
]

let aggregateRows
try {
  const found = await app.dbFindAll(
    {
      from: crossSectionRequested ? ORDER_COLLECTION : ITEM_COLLECTION,
      nosql: {
        type: 'aggregate',
        collections: [crossSectionRequested ? ORDER_COLLECTION : ITEM_COLLECTION],
        pipeline
      }
    },
    false,
    false
  )
  if (!found || found.success === false) {
    return { success: false, message: 'อ่าน CPOE LAB worklist ไม่สำเร็จ' }
  }
  aggregateRows = found.reply && Array.isArray(found.reply.data) ? found.reply.data : []
} catch (error) {
  return {
    success: false,
    message: 'อ่าน CPOE LAB worklist ไม่สำเร็จ: ' + String(error && error.message || error)
  }
}

const facet = aggregateRows[0] || {}
const orders = Array.isArray(facet.rows) ? facet.rows : []
const total = Array.isArray(facet.meta) && facet.meta[0]
  ? Number(facet.meta[0].total || 0)
  : 0

return {
  success: true,
  data: {
    orders,
    total,
    page,
    limit,
    section_codes: allowedSectionCodes,
    sections: allowedSections,
    statuses,
    priorities,
    date_scope: {
      from: dateFrom,
      to: dateTo,
      defaulted: defaultDateScope,
      all_dates: allDatesAllowed,
      axis: crossSectionRequested ? 'order_created_at' : 'status_time'
    },
    cross_section: crossSectionRequested,
    lookup_mode: crossSectionRequested ? lookupMode : '',
    organization_code: organizationCode,
    unit_code: organizationCode,
    specimen_options: specimenOptions
  },
  message: 'อ่าน CPOE LAB worklist สำเร็จ'
}
