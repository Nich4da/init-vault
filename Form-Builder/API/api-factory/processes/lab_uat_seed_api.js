/*
 * initCraft API Factory Process
 * Name: LAB - UAT Seed (No Finance / No LIS)
 * Suggested Process name: lab_uat_seed
 *
 * Purpose
 *   เตรียมข้อมูล UAT สำหรับตรวจหน้า LAB Worklist และ EMR result history โดย
 *   - สร้าง CPOE draft ผ่าน cpoe-order-save หรือใช้ Order ทดสอบที่มีอยู่
 *   - ข้ามการเงินด้วยการเปลี่ยนสถานะเฉพาะ CPOE Item ทดสอบ
 *   - จอง LAB NO. จาก counter เดียวกับระบบจริง (เลขไม่ถูกนำกลับมาใช้ซ้ำ)
 *   - สร้าง Work Item + Outbound audit ที่ถูกล็อกเป็น UAT และส่งต่อไม่ได้
 *   - ลงผลผ่าน hl7_result_upsert เฉพาะภายใน HIS; ห้อง MY ใช้ canonical Form pipeline
 *
 * IMPORTANT
 *   Process นี้ไม่มีการเรียก Receive, lab_agent_order_submit, HTTP, fetch หรือ Agent/LIS
 *   และไม่เขียน Bill, Bill Item, Receipt การเงิน หรือ Visit Tran
 *
 * Actions
 *   preview_existing { item_ids[], expected_hn, confirm }
 *   seed_existing    { item_ids[], expected_hn, confirm, note? }
 *   preview_suite    { visit_id, expected_hn, confirm }
 *   create_suite     { visit_id, expected_hn, confirm }
 *   preview_manual_suite { visit_id, expected_hn, confirm }
 *   create_manual_suite  { visit_id, expected_hn, confirm, note? }
 *   preview_flow_suite { visit_id, expected_hn, confirm }
 *   create_flow_suite  { visit_id, expected_hn, confirm, note? }
 *   resume_flow_suite  { seed_run_id, visit_id, expected_hn, confirm }
 *   preview_bc_profile_suite { visit_id, expected_hn, confirm }
 *   create_bc_profile_suite  { visit_id, expected_hn, confirm, note? }
 *   cleanup          { seed_run_id, confirm }
 *
 * Required confirm: LAB_UAT_NO_LIS
 */

const ORDER_COLLECTION = 'zdata_cpoe_order'
const ITEM_COLLECTION = 'zdata_cpoe_order_item'
const MASTER_COLLECTION = 'zdata_master_item_order'
const VISIT_COLLECTION = 'zdata_visit'
const WORK_COLLECTION = 'zdata_lab_work_item'
const OUTBOUND_COLLECTION = 'zdata_lab_outband_order'
const COUNTER_COLLECTION = 'zdata_lab_no_counter'
const SEED_RUN_COLLECTION = 'zdata_lab_uat_seed_run'
const RECEIPT_COLLECTION = 'zdata_lab_result_inbound'
const REPORT_COLLECTION = 'zdata_lab_report_manual_entry'
const RESULT_COLLECTION = 'zdata_lab_result_item'
const REVISION_COLLECTION = 'zdata_lab_result_revision_log'

const REPORT_FORM_ID = '6a8d4334f851000f28e5025b'
const RESULT_ITEM_FORM_ID = '6a8bc91df851000f28e501fb'
const CPOE_SAVE_PROCESS_ID = '6a71edd247075049ef0245af'
const RESULT_UPSERT_PROCESS_ID = '6a8da8a6f851000f28e50299'

const CONFIRM_TEXT = 'LAB_UAT_NO_LIS'
const TEST_HN_ALLOWLIST = ['6900002']
const ACTIVE = { $nin: [0, 3] }
const MAX_ITEMS = 30
const MAX_DAILY_SEQUENCE = 9999
const ALLOWED_SECTIONS = ['BC', 'HM', 'HH', 'ML', 'IM', 'MI-OUT', 'MB', 'MY', 'BB', 'BG']
const SECTION_PREFIX = {
  BC: '10', HM: '20', ML: '21', HH: '22', IM: '30', 'MI-OUT': '31',
  MB: '40', MY: '41', BB: '50', BG: '70'
}
const SECTION_ORGANIZATION = {
  BC: 'M1001', HM: 'M1004', HH: 'M1004', ML: 'M1003', IM: 'M1006',
  'MI-OUT': 'M1006', MB: 'M1005', MY: 'M1000', BB: 'M1002', BG: 'M1007'
}

/* IDs are validated against the live Item master before create_suite writes. */
const DEFAULT_SUITE = [
  { section: 'BC', item_code: 'C1', master_id: '6a900cc00c6722b3af181cba', comment: 'UAT Test comment: LFT profile', order_comment: 'UAT Order comment: BC profile' },
  { section: 'HM', item_code: 'HM1', master_id: '6a900cc00c6722b3af181dbb' },
  { section: 'HH', item_code: 'H15', master_id: '6a900cc00c6722b3af181d96' },
  { section: 'ML', item_code: 'MS6', master_id: '6a900cc00c6722b3af181ff0' },
  { section: 'IM', item_code: 'IM2', master_id: '6a900cc00c6722b3af181e90' },
  { section: 'MI-OUT', item_code: 'I0059', master_id: '6a900cc00c6722b3af181e16' },
  { section: 'MB', item_code: 'M7', master_id: '6a900cc00c6722b3af181fbd', specimen_name: 'Body Fluid (BF)' },
  { section: 'MY', item_code: 'M12', master_id: '6a900cc00c6722b3af181fab', quantity: 3 },
  { section: 'BB', item_code: 'BB2', master_id: '6a900cc00c6722b3af181c4e' },
  { section: 'BG', item_code: 'BG1', master_id: '6a900cc00c6722b3af181c85' }
]

/*
 * Interactive Worklist fixtures are intentionally separate orders so each
 * workflow can be tested without changing another scenario. Only MY is left
 * for a real Receive click because the Worklist's MY path is manual/no-Agent.
 * BC result entry is pre-received here with a transport-locked outbound record.
 */
const FLOW_SUITE = [
  {
    scenario: 'MY_RECEIVE_MANUAL', section: 'MY', item_code: 'M12', master_id: '6a900cc00c6722b3af181fab',
    quantity: 3, target_status: 'ready', order_comment: '[UAT FLOW] MY · รับสิ่งส่งตรวจแบบ Manual · ห้ามส่ง Agent/LIS'
  },
  {
    scenario: 'BC_REJECT_RETEST', section: 'BC', item_code: 'C20', master_id: '6a900cc00c6722b3af181cc8',
    target_status: 'ready', order_comment: '[UAT FLOW] BC · ปฏิเสธ แล้วกดตรวจใหม่'
  },
  {
    scenario: 'BC_CANCEL_FINANCE_READONLY', section: 'BC', item_code: 'C23', master_id: '6a900cc00c6722b3af181ccb',
    target_status: 'ready', order_comment: '[UAT FLOW] BC · ยกเลิก/ตรวจใหม่ · เช็กการเงินแบบอ่านอย่างเดียว'
  },
  {
    scenario: 'BC_RESULT_ENTRY_NO_LIS', section: 'BC', item_code: 'C26', master_id: '6a900cc00c6722b3af181cd3',
    target_status: 'accepted', order_comment: '[UAT FLOW] BC · รับแล้วสำหรับทดลองลงผล · NO LIS'
  }
]

/* Clone the user's requested BC shape on the explicit test visit. The four
 * Electrolyte components must be submitted in one CPOE save or the CPOE
 * profile-completeness rule rejects the order. */
const BC_PROFILE_SUITE = [
  { section: 'BC', item_code: 'C1', master_id: '6a900cc00c6722b3af181cba', comment: 'Comment ระดับ Test: UAT Liver Function profile' },
  { section: 'BC', item_code: 'C25.1-CD', master_id: '6a900cc00c6722b3af181ccf' },
  { section: 'BC', item_code: 'C25.2-CD', master_id: '6a900cc00c6722b3af181cd0' },
  { section: 'BC', item_code: 'C25.3-CD', master_id: '6a900cc00c6722b3af181cd1' },
  { section: 'BC', item_code: 'C25.4-CD', master_id: '6a900cc00c6722b3af181cd2' }
]

/* Values, units and ranges mirror existing historical BC result rows. */
const BC_ELECTROLYTE_RESULTS = {
  '102501CD': ['Sodium', '136', 'mmol/L', '132-141', 'N'],
  '102502CD': ['Potassium', '4.20', 'mmol/L', '3.7-5.5', 'N'],
  '102503CD': ['Chloride', '111', 'mmol/L', '98-107', 'H'],
  '102504CD': ['Carbondioxide', '25.0', 'mmol/L', '24-30', 'N']
}

const valueText = value => {
  if (value == null) return ''
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return String(value.toHexString())
    if (value.$oid != null) return String(value.$oid)
    if (value._id != null) return valueText(value._id)
    if (value.value != null && typeof value.value !== 'object') return String(value.value)
    if (value.code != null) return String(value.code)
  }
  return String(value)
}
const text = value => valueText(value).trim()
const lower = value => text(value).toLowerCase()
const validId = value => /^[a-f0-9]{24}$/i.test(text(value))
const unique = values => Array.from(new Set([].concat(values || []).map(text).filter(Boolean)))
const parseArray = value => {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : [] } catch (error) { return [] }
}
const now = text(app.curDate && app.curDate('YYYY-MM-DD HH:mm:ss')) || new Date().toISOString()
const actor = text(userInfo.employee_code || userInfo.username || userInfo.account && (userInfo.account.code || userInfo.account.name))
const actorAudit = { id: userInfo._id || userInfo.id || '', name: actor }
const roles = [].concat(userInfo.roles || []).map(role => lower(role && (role.code || role.value || role.name || role)))
const privileged = Boolean(
  app.isSuper && app.isSuper(userInfo.roles || []) ||
  app.isAdmin && app.isAdmin(userInfo.roles || []) ||
  roles.includes('lab_uat')
)

if (!privileged) return { success: false, error: 'permission_denied', message: 'ใช้ได้เฉพาะผู้ดูแลระบบหรือ role LAB_UAT' }
if (text(params.confirm) !== CONFIRM_TEXT) {
  return { success: false, error: 'confirmation_required', message: 'กรุณาส่ง confirm: "' + CONFIRM_TEXT + '"' }
}

const action = lower(params.action) || 'preview_existing'
if (![
  'preview_existing', 'seed_existing', 'preview_suite', 'create_suite',
  'preview_manual_suite', 'create_manual_suite',
  'preview_flow_suite', 'create_flow_suite', 'resume_flow_suite',
  'preview_bc_profile_suite', 'create_bc_profile_suite',
  'cleanup'
].includes(action)) {
  return { success: false, error: 'action_invalid', message: 'action ไม่ถูกต้อง' }
}

const unwrapProcess = result => {
  const candidates = [result && result.reply && result.reply.data, result && result.data, result && result.reply, result]
  for (const candidate of candidates) if (candidate && typeof candidate === 'object' && typeof candidate.success === 'boolean') return candidate
  return null
}
const makeRunId = () => {
  let seed = ''
  try { if (this && typeof this.genUUID === 'function') seed = text(this.genUUID()) } catch (error) { seed = '' }
  if (!seed) seed = Date.now() + '-' + Math.random().toString(36).slice(2, 12)
  return 'LAB-UAT-' + seed.replace(/[^A-Za-z0-9_-]/g, '')
}
const testMarker = value => ['ทดสอบ', 'ไม่ใช่คนจริง', 'test', 'uat', 'demo', 'dummy'].some(marker => lower(value).includes(marker))
const isAllowedTestPatient = (hn, marker) => TEST_HN_ALLOWLIST.includes(text(hn)) || testMarker(marker)
const orderIdOf = item => text(item && item.order_id && item.order_id.value || item && item.xparentx)
const sectionOf = (item, master) => text(
  item && item.section_snapshot && item.section_snapshot.code ||
  item && item.lab_context_snapshot && item.lab_context_snapshot.section && item.lab_context_snapshot.section.code ||
  master && master.section && master.section.code ||
  master && master.lab_item && master.lab_item.section && master.lab_item.section.code
).toUpperCase()

const patientContext = order => {
  const visit = order && order.vid || {}
  const patient = visit.pid || {}
  return {
    hn: text(patient.hn),
    vn: text(visit.vn || visit.value || order && order.xparentx),
    name: [text(patient.prename && (patient.prename.label || patient.prename)), text(patient.p_fname || patient.first_name), text(patient.p_lname || patient.last_name)].filter(Boolean).join(' '),
    marker: [patient.hn, patient.p_fname, patient.p_lname, patient.first_name, patient.last_name, order && order.order_comment].map(text).join(' ')
  }
}

const runSubProcess = async (processId, payload) => unwrapProcess(await app.subProcess(processId, payload, userInfo))

const reserveLabNo = async sectionCode => {
  const section = text(sectionCode).toUpperCase()
  const prefix = SECTION_PREFIX[section]
  if (!prefix) throw new Error('SECTION_PREFIX_MISSING')
  const dateKey = now.slice(0, 10)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) throw new Error('SYSTEM_DATE_INVALID')
  const buddhistYear = Number(match[1]) + 543
  const year = String(buddhistYear % 100).padStart(2, '0')
  const month = match[2]
  const day = match[3]
  const counterId = ['lab_no', section, dateKey].join(':')
  const result = await app.db.collection(COUNTER_COLLECTION).findOneAndUpdate(
    { _id: counterId },
    [{ $set: {
      section_code: section, section_prefix: prefix, buddhist_year: buddhistYear,
      year_two_digits: year, date_key: dateKey,
      buddhist_date_key: buddhistYear + '-' + month + '-' + day,
      month_two_digits: month, day_two_digits: day, format_version: 2,
      daily_limit_reached: { $gte: [{ $ifNull: ['$sequence', 0] }, MAX_DAILY_SEQUENCE] },
      sequence: {
        $let: {
          vars: { current: { $ifNull: ['$sequence', 0] } },
          in: { $cond: [{ $gte: ['$$current', MAX_DAILY_SEQUENCE] }, '$$current', { $add: ['$$current', 1] }] }
        }
      },
      created_at: { $ifNull: ['$created_at', now] }, updated_at: now, updated_by: actor
    } }],
    { upsert: true, returnDocument: 'after' }
  )
  const counter = result && (result.value || result)
  if (!counter || counter.daily_limit_reached === true) throw new Error('LAB_NO_DAILY_LIMIT')
  const sequence = Number(counter.sequence)
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > MAX_DAILY_SEQUENCE) throw new Error('LAB_NO_COUNTER_INVALID')
  return {
    lab_no: prefix + year + month + day + String(sequence).padStart(4, '0'),
    sequence, prefix, date_key: dateKey, buddhist_year: buddhistYear
  }
}

const profileFixtures = {
  '1001CD': [
    ['100101CD', 'Total protein', '7.2', 'g/dL', '6.0-8.0', 'N'],
    ['100102CD', 'Albumin', '4.3', 'g/dL', '3.5-5.2', 'N'],
    ['10010401CD', 'Total bilirubin', '1.8', 'mg/dL', '0.2-1.2', 'H'],
    ['100105CD', 'AST', '36', 'U/L', '0-40', 'N'],
    ['100106CD', 'ALT', '42', 'U/L', '0-41', 'H']
  ],
  '2001EB': [
    ['200101EB', 'Hemoglobin', '11.2', 'g/dL', '11.5-15.5', 'L'],
    ['200102EB', 'Hematocrit', '34', '%', '35-45', 'L'],
    ['200103EB', 'WBC', '8200', 'cell/uL', '5000-10000', 'N'],
    ['200105EB', 'Platelet', '280000', 'cell/uL', '150000-450000', 'N']
  ],
  '2106UR': [
    ['210601UR', 'Color', 'Yellow', '', '', 'N'],
    ['210602UR', 'Appearance', 'Clear', '', '', 'N'],
    ['210603UR', 'Specific gravity', '1.015', '', '1.005-1.030', 'N'],
    ['210604UR', 'pH', '6.0', '', '5.0-8.0', 'N']
  ]
}

const resultRowsFor = context => {
  const code = text(context.test_code)
  const section = text(context.section).toUpperCase()
  const supplied = params.result_overrides && params.result_overrides[context.item_code]
  if (Array.isArray(supplied) && supplied.length) return supplied
  if (profileFixtures[code]) {
    return profileFixtures[code].map((row, index) => ({
      obs_code: row[0], obs_name: row[1], value: row[2], units: row[3], ref_range: row[4],
      interpretation_code: row[5], is_critical: false, obx_status: 'F', change_kind: 'first', receipt_seq: String(index + 1), result_version: '1', comment: index === 0 ? 'UAT profile result' : ''
    }))
  }
  if (BC_ELECTROLYTE_RESULTS[code]) {
    const row = BC_ELECTROLYTE_RESULTS[code]
    return [{
      obs_code: code, obs_name: row[0], value: row[1], units: row[2], ref_range: row[3],
      interpretation_code: row[4], is_critical: false, obx_status: 'F', change_kind: 'first',
      receipt_seq: '1', result_version: '1', comment: 'UAT Electrolyte profile result'
    }]
  }
  if (section === 'MB') {
    return [{
      obs_code: code, obs_name: context.test_name,
      value: [
        'SPECIMEN: Body Fluid (BF)',
        '------------------------------------------------',
        '* Aerobic Culture *',
        '     No growth after 5 days',
        '------------------------------------------------',
        'LAB NO.: ' + context.lab_no,
        'REPORTED BY UAT LAB / APPROVED BY UAT LAB',
        'RELEASED : ' + now
      ].join('\n'),
      units: '', ref_range: '', interpretation_code: 'N', is_critical: false,
      obx_status: 'F', change_kind: 'first', receipt_seq: '1', result_version: '1', comment: 'MLab raw text UAT'
    }]
  }
  const values = {
    IM: ['Reactive (UAT)', '', '', 'AA', true],
    'MI-OUT': ['Detected 125 copies/mL (UAT)', 'copies/mL', 'Not detected', 'H', false],
    HH: ['235', 'mg/dL', '200-400', 'N', false],
    BB: ['Negative', '', 'Negative', 'N', false],
    BG: ['46,XX', '', '46,XX', 'N', false],
    HM: ['Normal morphology', '', '', 'N', false],
    ML: ['Negative', '', 'Negative', 'N', false],
    BC: ['25.00', 'mg/dL', '5-18', 'H', false]
  }
  const value = values[section] || ['UAT result', '', '', 'N', false]
  return [{
    obs_code: code, obs_name: context.test_name, value: value[0], units: value[1], ref_range: value[2],
    interpretation_code: value[3], is_critical: value[4], obx_status: 'F', change_kind: 'first', receipt_seq: '1', result_version: '1',
    comment: section === 'BC' ? 'Comment ระดับ Test: UAT result' : ''
  }]
}

const snapshotFields = ['current_status', 'lab_no', 'received_at', 'received_by', 'updated_at', 'updated_by', 'uat_seed']
const orderSnapshotFields = ['current_status', 'result_completed_at', 'result_completed_source', 'updated_at', 'updated_by', 'uat_seed']
const snapshotOf = row => snapshotFields.reduce((result, key) => {
  result[key] = Object.prototype.hasOwnProperty.call(row, key) ? { exists: true, value: row[key] } : { exists: false }
  return result
}, {})
const orderSnapshotOf = row => orderSnapshotFields.reduce((result, key) => {
  result[key] = Object.prototype.hasOwnProperty.call(row, key) ? { exists: true, value: row[key] } : { exists: false }
  return result
}, {})

const loadContexts = async itemIds => {
  const contexts = []
  for (const itemId of itemIds) {
    const item = await app.db.collection(ITEM_COLLECTION).findOne({ _id: app.dbObjectId(itemId), xrstatx: ACTIVE })
    if (!item) throw new Error('ITEM_NOT_FOUND:' + itemId)
    if (lower(item.service_type && item.service_type.value || item.service_type) !== 'lab') throw new Error('ITEM_NOT_LAB:' + itemId)
    const orderId = orderIdOf(item)
    const order = validId(orderId) ? await app.db.collection(ORDER_COLLECTION).findOne({ _id: app.dbObjectId(orderId), xrstatx: ACTIVE }) : null
    if (!order) throw new Error('ORDER_NOT_FOUND:' + itemId)
    const masterId = text(item.item_data_id)
    const master = validId(masterId) ? await app.db.collection(MASTER_COLLECTION).findOne({ _id: app.dbObjectId(masterId), xrstatx: ACTIVE }) : null
    if (!master) throw new Error('MASTER_NOT_FOUND:' + itemId)
    const patient = patientContext(order)
    const section = sectionOf(item, master)
    const lab = master.lab_item && typeof master.lab_item === 'object' ? master.lab_item : {}
    const specimen = lab.specimen && typeof lab.specimen === 'object' && !Array.isArray(lab.specimen) ? lab.specimen : {}
    contexts.push({
      item_id: itemId, item, order_id: orderId, order, master, patient, section,
      item_code: text(item.item_code || master.item_code), test_code: text(lab.his_lab_code),
      test_name: text(item.item_name || master.item_name || lab.name),
      specimen_code: text(item.lab_data && item.lab_data.spec_source_code || specimen.code),
      specimen_name: text(item.lab_data && (item.lab_data.spec_source || item.lab_data.source) || specimen.name),
      before: snapshotOf(item), order_before: orderSnapshotOf(order)
    })
  }
  return contexts
}

const validateContexts = (contexts, expectedHn, allowDraft) => contexts.map(context => {
  const reasons = []
  if (!ALLOWED_SECTIONS.includes(context.section)) reasons.push('section ไม่อยู่ใน allowlist')
  if (!context.test_code) reasons.push('master ไม่มี his_lab_code')
  if (!context.patient.hn || context.patient.hn !== expectedHn) reasons.push('HN ไม่ตรง')
  if (!context.patient.vn) reasons.push('ไม่มี VN')
  if (!testMarker(context.patient.marker)) reasons.push('ไม่ใช่ผู้ป่วยทดสอบ')
  const allowedStatuses = allowDraft ? ['draft', 'sent', 'ready'] : ['sent', 'ready']
  if (!allowedStatuses.includes(lower(context.item.current_status))) reasons.push('สถานะ ' + lower(context.item.current_status) + ' seed ไม่ได้')
  return {
    item_id: context.item_id, order_id: context.order_id, section: context.section,
    item_code: context.item_code, test_code: context.test_code, item_name: context.test_name,
    current_status: lower(context.item.current_status), ready: reasons.length === 0, reasons
  }
})

const createFormRecord = async (formId, data) => {
  const draft = await app.insertData(formId, userInfo)
  const id = text(draft && (draft.id || draft.data && (draft.data._id || draft.data.id) || draft.reply && (draft.reply.id || draft.reply.data && draft.reply.data._id)))
  if (!draft || draft.success === false || !validId(id)) throw new Error('FORM_DRAFT_FAILED:' + formId)
  const record = Object.assign({}, data)
  if (record.xparentx === '__SELF__') record.xparentx = app.dbObjectId(id)
  if (record.result_report_id === '__SELF__') record.result_report_id = id
  const saved = await app.sdformSetOne(formId, id, record, 1, userInfo)
  if (!saved || saved.success === false) throw new Error('FORM_SAVE_FAILED:' + formId)
  return id
}

const seedMycology = async context => {
  const reportKey = ['manual', context.order_id, context.item_id, context.lab_no, 'MY'].join('|')
  const reportId = await createFormRecord(REPORT_FORM_ID, {
    xparentx: '__SELF__', result_report_id: '__SELF__', filler_order_no: context.lab_no,
    hn: context.patient.hn, visit_id: context.patient.vn, order_no: context.item_id,
    order_status_id: context.item_id, lab_section: 'MY', lab_section_name: 'Mycology Laboratory',
    record_kind: 'report', report_key: reportKey, receipt_status: 'processed', source_channel: 'manual',
    internal_overall_status: 'completed', reported_at: now, reported_by_source_id: actor,
    reported_by_source_name: actor, verified_at: now, verified_by_source_id: actor,
    verified_by_source_name: actor, order_note: 'UAT MY manual multi-site', item_count: 4,
    matched_item_count: 4, unmatched_item_count: 0, processed_at: now, error_message: '',
    uat_seed: { run_id: context.run_id, at: now, by: actor }
  })
  const sites = [
    { specimen_index: 0, sub: 0, specimen_code: 'HAIR', specimen_name: 'Hair', ordered_code: 'HEAD', ordered_name: 'ศีรษะ', actual_code: 'HEAD', actual_name: 'ศีรษะ', detail: 'เส้นผม', value: 'พบเชื้อ' },
    { specimen_index: 0, sub: 1, specimen_code: 'HAIR', specimen_name: 'Hair', ordered_code: 'HEAD', ordered_name: 'ศีรษะ', actual_code: 'NECK', actual_name: 'ลำคอ', detail: 'ตำแหน่งที่ห้อง LAB เพิ่มเอง', value: 'ไม่พบเชื้อ\nผลเพิ่มเติม UAT' },
    { specimen_index: 1, sub: 0, specimen_code: 'SKIN', specimen_name: 'Skin scraping', ordered_code: 'ARM', ordered_name: 'แขน', actual_code: 'ARM', actual_name: 'แขน', detail: 'ผิวหนัง', value: 'ไม่พบเชื้อ' },
    { specimen_index: 2, sub: 0, specimen_code: 'NAIL', specimen_name: 'Nail clipping', ordered_code: 'LEG', ordered_name: 'ขา', actual_code: 'LEG', actual_name: 'ขา', detail: 'เล็บ', value: 'พบเชื้อ' }
  ]
  const resultIds = []
  for (let index = 0; index < sites.length; index += 1) {
    const site = sites[index]
    const rowKey = [context.item_id, site.specimen_index, site.sub ? 'sub-' + site.sub : site.specimen_code.toLowerCase()].join('|')
    const id = await createFormRecord(RESULT_ITEM_FORM_ID, {
      xparentx: app.dbObjectId(reportId),
      parent_id: { value: app.dbObjectId(reportId), label: 'LAB ' + context.lab_no + ' · HN ' + context.patient.hn + ' · VN ' + context.patient.vn, filler_order_no: context.lab_no, hn: context.patient.hn, visit_id: context.patient.vn, lab_section: 'MY' },
      result_report_id: reportId, result_definition_id: 'MY-PATH|' + rowKey,
      order_no: context.item_id, filler_order_no: context.lab_no, lab_section: 'MY',
      hn: context.patient.hn, visit_id: context.patient.vn,
      result_sequence: String((site.specimen_index * 1000) + site.sub + 1),
      test_code: context.test_code, obs_code: context.test_code, obs_name: context.test_name, test_name: context.test_name,
      result_value: site.value, units: '', unit_symbol_snapshot: '', ref_range: '', reference_range_snapshot: '',
      interpretation_code: '', is_critical: false, result_source: 'manual', result_status: 'final',
      result_uid: context.result_uid, change_kind: 'first', previous_value: '', entered_at: now, entered_by: actor,
      verified_at: now, verified_by: actor, verified_by_source_id: actor, verified_by_source_name: actor,
      last_edited_at: '', last_edited_by: '', edit_history_json: '[]', source_item_id: context.item_id,
      pathology_row_key: rowKey, specimen_index: site.specimen_index,
      specimen_code_snapshot: site.specimen_code, specimen_name_snapshot: site.specimen_name,
      ordered_site_code_snapshot: site.ordered_code, ordered_site_name_snapshot: site.ordered_name,
      actual_site_code: site.actual_code, actual_site_name: site.actual_name,
      actual_site_detail: site.detail, pathology_sub_index: site.sub,
      uat_seed: { run_id: context.run_id, at: now, by: actor }
    })
    resultIds.push(id)
  }
  return { report_id: reportId, result_item_ids: resultIds, receipt_id: '', result_uid: context.result_uid }
}

const prepareContext = async (context, runId) => {
  const existingWork = await app.db.collection(WORK_COLLECTION).findOne({ _id: app.dbObjectId(context.item_id), xrstatx: ACTIVE })
  if (existingWork) throw new Error('WORK_ITEM_ALREADY_EXISTS:' + context.item_id)
  const existingOutbound = await app.db.collection(OUTBOUND_COLLECTION).findOne({ source_cpoe_item_id: context.item_id, xrstatx: ACTIVE })
  if (existingOutbound) throw new Error('OUTBOUND_ALREADY_EXISTS:' + context.item_id)

  const number = await reserveLabNo(context.section)
  context.lab_no = number.lab_no
  context.run_id = runId
  context.result_uid = [runId, context.section, context.item_id].join('|').slice(0, 200)
  const selected = [{
    seq: Number(context.item.item_no || 1), source_item_id: context.item_id,
    item_code: context.item_code, item_name: context.test_name,
    test_code: context.test_code, specimen_code: context.specimen_code
  }]
  const work = {
    _id: app.dbObjectId(context.item_id), xparentx: app.dbObjectId(context.item_id),
    xsitex: userInfo.site || {}, xunitx: { code: context.section, name: context.section },
    xrstatx: 1, xversionx: 'v1', dataid: context.item_id,
    created_by: actorAudit, created_at: now, updated_by: actorAudit, updated_at: now,
    source_order_id: context.order_id, source_order_number: text(context.order.order_number),
    source_specimen_record_id: context.item_id, receipt_batch_id: context.item_id,
    lab_no: context.lab_no, section_code: context.section, section_name: context.section,
    work_status: 'received', patient_hn: context.patient.hn, patient_name: context.patient.name,
    visit_id: context.patient.vn, visit_vn: context.patient.vn, ordered_at: text(context.order.created_at) || now,
    received_at: now, received_by: actor,
    specimen_json: JSON.stringify({ code: context.specimen_code, name: context.specimen_name, collected_at: now, collected_by: actor }),
    selected_items_json: JSON.stringify(selected), selected_items: selected,
    lab_no_section_prefix: number.prefix, lab_no_buddhist_year: number.buddhist_year,
    lab_no_date_key: number.date_key, lab_no_sequence: number.sequence, lab_no_format_version: 2,
    lab_no_generated_at: now, lab_no_generated_by: actor,
    uat_seed: { run_id: runId, mode: 'no_lis', transport_locked: true, at: now, by: actor }
  }
  await app.db.collection(WORK_COLLECTION).insertOne(work)

  const outbound = {
    _id: app.dbObjectId(context.item_id), xparentx: app.dbObjectId(context.item_id), xrstatx: 1,
    dataid: context.item_id, work_item_id: context.item_id, source_cpoe_order_id: context.order_id,
    source_cpoe_item_id: context.item_id, order_no: context.item_id, lab_no: context.lab_no,
    section_code: context.section, patient_hn: context.patient.hn, visit_id: context.patient.vn,
    item_count: 1, hl7_status: 'uat_bypassed', transport_channel: 'uat_seed_no_transport',
    dispatch_id: '', order_ref: '', retryable: false, attempt_count: 0,
    queued_at: '', sent_at: '', last_success_at: '', last_status_at: now,
    created_at: now, updated_at: now, created_by: actor, updated_by: actor,
    last_error_code: 'UAT_TRANSPORT_BLOCKED', last_error_at: now,
    last_error_reason: 'UAT Seed: ห้ามส่ง Agent/LIS', request_payload_json: '', response_payload_json: '', attempt_history_json: '[]',
    uat_seed: { run_id: runId, transport_locked: true, agent_called: false, lis_called: false, at: now, by: actor }
  }
  await app.db.collection(OUTBOUND_COLLECTION).insertOne(outbound)

  await app.db.collection(ITEM_COLLECTION).updateOne(
    { _id: app.dbObjectId(context.item_id), xrstatx: ACTIVE },
    { $set: { current_status: 'accepted', lab_no: context.lab_no, received_at: now, received_by: actor, updated_at: now, updated_by: actor, uat_seed: { run_id: runId, at: now, by: actor } } }
  )

  return {
    item_id: context.item_id, order_id: context.order_id, section: context.section,
    item_code: context.item_code, test_code: context.test_code, lab_no: context.lab_no,
    result_uid: context.result_uid, receipt_id: '', report_id: '', result_item_ids: [],
    before: context.before, order_before: context.order_before
  }
}

const seedContext = async (context, runId) => {
  const prepared = await prepareContext(context, runId)

  let result
  if (context.section === 'MY') {
    result = await seedMycology(context)
    await app.db.collection(WORK_COLLECTION).updateOne({ _id: app.dbObjectId(context.item_id), 'uat_seed.run_id': runId }, { $set: { work_status: 'completed', latest_result_at: now, resulted_at: now, resulted_by: actor } })
    await app.db.collection(ITEM_COLLECTION).updateOne({ _id: app.dbObjectId(context.item_id), 'uat_seed.run_id': runId }, { $set: { current_status: 'completed' } })
  } else {
    const payload = {
      order_no: context.item_id,
      filler_order_no: context.lab_no, hn: context.patient.hn, visit_id: context.patient.vn,
      result_uid: context.result_uid, report_seq: '1', stage: 'final', overall_status: 'resulted',
      reported_at: now.replace(' ', 'T') + '+07:00',
      reported_by: { source_id: 'LAB-UAT', source_name: 'LAB UAT Seed' },
      verified_at: now.replace(' ', 'T') + '+07:00',
      verified_by: { source_id: 'LAB-UAT', source_name: 'LAB UAT Seed' },
      order_note: context.section === 'BC' ? 'Comment ระดับ Order: UAT BC profile' : 'LAB UAT Seed · no LIS',
      items: resultRowsFor(context)
    }
    const saved = await runSubProcess(RESULT_UPSERT_PROCESS_ID, payload)
    if (!saved || saved.success !== true) throw new Error('RESULT_UPSERT_FAILED:' + text(saved && (saved.code || saved.message)))
    const data = saved.data || {}
    result = { receipt_id: text(data.receipt_id), report_id: text(data.result_report_id), result_item_ids: [], result_uid: context.result_uid }
    if (validId(result.report_id)) {
      const rows = await app.db.collection(RESULT_COLLECTION).find({ result_report_id: result.report_id, xrstatx: ACTIVE }).toArray()
      result.result_item_ids = rows.map(row => text(row._id)).filter(validId)
    }
  }
  return {
    item_id: prepared.item_id, order_id: prepared.order_id, section: prepared.section,
    item_code: prepared.item_code, test_code: prepared.test_code, lab_no: prepared.lab_no,
    result_uid: result.result_uid, receipt_id: result.receipt_id, report_id: result.report_id,
    result_item_ids: result.result_item_ids, before: context.before, order_before: context.order_before
  }
}

if (action === 'cleanup') {
  const runId = text(params.seed_run_id)
  if (!/^LAB-UAT-[A-Za-z0-9_-]{8,120}$/.test(runId)) return { success: false, error: 'seed_run_id_invalid', message: 'seed_run_id ไม่ถูกต้อง' }
  const run = await app.db.collection(SEED_RUN_COLLECTION).findOne({ run_id: runId, xrstatx: ACTIVE })
  if (!run) return { success: false, error: 'seed_run_not_found', message: 'ไม่พบ seed run' }
  if (lower(run.status) === 'cleaned') return { success: true, data: { seed_run_id: runId, already_cleaned: true }, message: 'cleanup แล้ว' }
  const entries = Array.isArray(run.items) ? run.items : []
  for (const entry of entries) {
    const outbound = await app.db.collection(OUTBOUND_COLLECTION).findOne({ _id: app.dbObjectId(entry.item_id), xrstatx: ACTIVE })
    if (!outbound || text(outbound.uat_seed && outbound.uat_seed.run_id) !== runId || Number(outbound.attempt_count || 0) !== 0 || text(outbound.dispatch_id) || text(outbound.sent_at)) {
      return { success: false, error: 'cleanup_transport_conflict', message: 'พบ Outbound ที่ไม่ใช่ UAT ล้วนหรือมีการส่งแล้ว จึงหยุด cleanup' }
    }
    const foreignReceipt = await app.db.collection(RECEIPT_COLLECTION).findOne({ order_no: entry.item_id, xrstatx: ACTIVE, result_uid: { $ne: entry.result_uid } })
    if (foreignReceipt) return { success: false, error: 'cleanup_real_result_conflict', message: 'พบผลอื่นของ Item นี้ จึงหยุด cleanup' }
  }
  const cleanupMark = { xrstatx: 3, deleted_at: now, deleted_by: actor, uat_seed_cleanup: { run_id: runId, at: now, by: actor } }
  let restored = 0
  const createdOrderIdSet = new Set((Array.isArray(run.created_order_ids) ? run.created_order_ids : []).map(text))
  const restoredOrderIds = new Set()
  for (const entry of entries) {
    for (const collection of [RECEIPT_COLLECTION, REPORT_COLLECTION, RESULT_COLLECTION, REVISION_COLLECTION]) {
      await app.db.collection(collection).updateMany({ $or: [{ result_uid: entry.result_uid }, { 'uat_seed.run_id': runId }], xrstatx: ACTIVE }, { $set: cleanupMark })
    }
    await app.db.collection(OUTBOUND_COLLECTION).updateOne({ _id: app.dbObjectId(entry.item_id), 'uat_seed.run_id': runId, xrstatx: ACTIVE }, { $set: cleanupMark })
    await app.db.collection(WORK_COLLECTION).updateOne({ _id: app.dbObjectId(entry.item_id), 'uat_seed.run_id': runId, xrstatx: ACTIVE }, { $set: cleanupMark })
    const setValues = {}
    const unsetValues = {}
    snapshotFields.forEach(key => {
      const saved = entry.before && entry.before[key]
      if (saved && saved.exists) setValues[key] = saved.value
      else unsetValues[key] = ''
    })
    const update = { $set: setValues }
    if (Object.keys(unsetValues).length) update.$unset = unsetValues
    const itemRestored = await app.db.collection(ITEM_COLLECTION).updateOne({ _id: app.dbObjectId(entry.item_id), 'uat_seed.run_id': runId, xrstatx: ACTIVE }, update)
    restored += Number(itemRestored && itemRestored.modifiedCount) || 0
    if (createdOrderIdSet.has(text(entry.order_id))) {
      await app.db.collection(ITEM_COLLECTION).updateOne({ _id: app.dbObjectId(entry.item_id), xrstatx: ACTIVE }, { $set: cleanupMark })
    } else if (validId(entry.order_id) && !restoredOrderIds.has(text(entry.order_id))) {
      const orderSet = {}
      const orderUnset = {}
      orderSnapshotFields.forEach(key => {
        const saved = entry.order_before && entry.order_before[key]
        if (saved && saved.exists) orderSet[key] = saved.value
        else orderUnset[key] = ''
      })
      const orderUpdate = { $set: orderSet }
      if (Object.keys(orderUnset).length) orderUpdate.$unset = orderUnset
      await app.db.collection(ORDER_COLLECTION).updateOne({ _id: app.dbObjectId(entry.order_id), xrstatx: ACTIVE }, orderUpdate)
      restoredOrderIds.add(text(entry.order_id))
    }
  }
  if (Array.isArray(run.created_order_ids)) {
    for (const orderId of run.created_order_ids) {
      await app.db.collection(ITEM_COLLECTION).updateMany({ xparentx: app.dbObjectId(orderId), xrstatx: ACTIVE }, { $set: cleanupMark })
      await app.db.collection(ORDER_COLLECTION).updateOne({ _id: app.dbObjectId(orderId), xrstatx: ACTIVE }, { $set: cleanupMark })
    }
  }
  await app.db.collection(SEED_RUN_COLLECTION).updateOne({ run_id: runId, xrstatx: ACTIVE }, { $set: { status: 'cleaned', cleaned_at: now, cleaned_by: actor, updated_at: now, updated_by: actor } })
  return { success: true, data: { seed_run_id: runId, restored_items: restored, lab_no_counter_reused: false }, message: 'cleanup UAT แล้ว; LAB NO. ที่จองไว้ไม่ถูกนำกลับมาใช้ซ้ำ' }
}

let itemIds = unique(params.item_ids || params.item_id)
let createdOrderIds = []
let runId = ''
let runRecordCreated = false
const expectedHn = text(params.expected_hn)
if (!expectedHn) return { success: false, error: 'expected_hn_required', message: 'ต้องระบุ expected_hn' }

if (action === 'preview_bc_profile_suite' || action === 'create_bc_profile_suite') {
  const visitId = text(params.visit_id)
  if (!validId(visitId)) return { success: false, error: 'visit_id_invalid', message: 'visit_id ไม่ถูกต้อง' }
  const visit = await app.db.collection(VISIT_COLLECTION).findOne({ _id: app.dbObjectId(visitId), xrstatx: ACTIVE })
  const visitHn = text(visit && visit.pid && visit.pid.hn)
  const marker = [visitHn, visit && visit.pid && visit.pid.p_fname, visit && visit.pid && visit.pid.p_lname].map(text).join(' ')
  if (!visit || visitHn !== expectedHn || !isAllowedTestPatient(visitHn, marker)) {
    return { success: false, error: 'test_visit_required', message: 'Visit/HN ไม่ตรงหรือไม่ใช่ผู้ป่วยทดสอบ' }
  }

  const masters = []
  const checks = []
  for (const fixture of BC_PROFILE_SUITE) {
    const master = await app.db.collection(MASTER_COLLECTION).findOne({ _id: app.dbObjectId(fixture.master_id), xrstatx: ACTIVE })
    const actualSection = sectionOf(null, master)
    const ready = Boolean(master && text(master.item_code) === fixture.item_code && actualSection === 'BC' && text(master.lab_item && master.lab_item.his_lab_code))
    masters.push(master)
    checks.push({ section: 'BC', item_code: fixture.item_code, master_id: fixture.master_id, ready, reason: ready ? '' : 'Item master เปลี่ยน/ปิดใช้งาน/section ไม่ตรง' })
  }
  if (action === 'preview_bc_profile_suite' || checks.some(check => !check.ready)) {
    return {
      success: checks.every(check => check.ready),
      data: {
        visit_id: visitId,
        hn: expectedHn,
        items: checks,
        profile_names: ['Liver Function Test', 'Electrolyte from Clotted blood'],
        calls_agent_or_lis: false,
        creates_finance_records: false,
        bypasses_receive: true
      },
      error: checks.some(check => !check.ready) ? 'bc_profile_preflight_failed' : '',
      message: checks.every(check => check.ready) ? 'BC profile suite พร้อมสร้างและลงผลจำลอง' : 'BC profile suite ยังสร้างไม่ได้'
    }
  }

  runId = makeRunId()
  await app.db.collection(SEED_RUN_COLLECTION).insertOne({
    run_id: runId,
    mode: action,
    status: 'creating_order',
    expected_hn: expectedHn,
    visit_id: visitId,
    item_ids: [],
    created_order_ids: [],
    items: [],
    note: text(params.note).slice(0, 1000),
    safety: {
      finance_record_created: false,
      outbound_transport_locked: true,
      agent_called: false,
      lis_called: false,
      external_http_called: false,
      receive_bypassed: true
    },
    created_at: now,
    created_by: actor,
    updated_at: now,
    updated_by: actor,
    xrstatx: 1
  })
  runRecordCreated = true
  try {
    const lines = BC_PROFILE_SUITE.map((fixture, index) => {
      const master = masters[index]
      const lab = master.lab_item || {}
      const specimen = lab.specimen || {}
      return {
        uid: 'lab-uat-bc-profile-' + fixture.item_code,
        item_source: 'item',
        item_form_id: '6a594763d448dfc9d33e2c27',
        item_data_id: fixture.master_id,
        item_code: fixture.item_code,
        item_name: text(master.item_name),
        quantity: 1,
        service_type: 'lab',
        comment: fixture.comment || '',
        lab_data: {
          source: text(specimen.name),
          spec_source: text(specimen.name),
          spec_source_code: text(specimen.code),
          storage: 'IM',
          at: now,
          by_id: text(userInfo._id || userInfo.id)
        }
      }
    })
    const created = await runSubProcess(CPOE_SAVE_PROCESS_ID, {
      visit_id: visitId,
      organization_code: SECTION_ORGANIZATION.BC,
      section_codes: ['BC'],
      service_type: 'lab',
      priority: '1',
      inscl: null,
      inscl_row: null,
      order_comment: '[LAB UAT NO LIS] Liver Function + Electrolyte · bypass Receive · seeded result',
      order_tags: ['LAB_UAT_NO_LIS', 'BC_PROFILE_RESULT'],
      lines
    })
    if (!created || created.success !== true || !validId(created.order_id)) {
      throw new Error('BC_PROFILE_ORDER_CREATE_FAILED:' + (text(created && created.message) || 'สร้าง CPOE order ไม่สำเร็จ'))
    }
    const orderId = text(created.order_id)
    createdOrderIds = [orderId]
    const rows = await app.db.collection(ITEM_COLLECTION).find({
      xrstatx: ACTIVE,
      $or: [{ xparentx: app.dbObjectId(orderId) }, { 'order_id.value': app.dbObjectId(orderId) }]
    }).toArray()
    for (const fixture of BC_PROFILE_SUITE) {
      const selected = rows.find(row => text(row.item_code) === fixture.item_code)
      if (!selected) throw new Error('BC_PROFILE_ITEM_MISSING:' + fixture.item_code)
      itemIds.push(text(selected._id))
    }
    itemIds = unique(itemIds)
    await app.db.collection(SEED_RUN_COLLECTION).updateOne(
      { run_id: runId, xrstatx: ACTIVE },
      { $set: { status: 'seeding', created_order_ids: createdOrderIds, item_ids: itemIds, updated_at: now, updated_by: actor } }
    )
  } catch (error) {
    await app.db.collection(SEED_RUN_COLLECTION).updateOne(
      { run_id: runId, xrstatx: ACTIVE },
      { $set: { status: 'cleanup_required', created_order_ids: createdOrderIds, item_ids: unique(itemIds), failure: { message: text(error && error.message || error), at: now }, updated_at: now, updated_by: actor } }
    )
    return { success: false, error: 'bc_profile_create_failed_cleanup_required', data: { seed_run_id: runId, created_order_ids: createdOrderIds }, message: text(error && error.message || error) }
  }
}

if (action === 'preview_flow_suite' || action === 'create_flow_suite' || action === 'resume_flow_suite') {
  const visitId = text(params.visit_id)
  if (!validId(visitId)) return { success: false, error: 'visit_id_invalid', message: 'visit_id ไม่ถูกต้อง' }
  const visit = await app.db.collection(VISIT_COLLECTION).findOne({ _id: app.dbObjectId(visitId), xrstatx: ACTIVE })
  const visitHn = text(visit && visit.pid && visit.pid.hn)
  const marker = [visitHn, visit && visit.pid && visit.pid.p_fname, visit && visit.pid && visit.pid.p_lname].map(text).join(' ')
  if (!visit || visitHn !== expectedHn || !isAllowedTestPatient(visitHn, marker)) {
    return { success: false, error: 'test_visit_required', message: 'Visit/HN ไม่ตรงหรือไม่ใช่ผู้ป่วยทดสอบ' }
  }

  const checks = []
  for (const fixture of FLOW_SUITE) {
    const master = await app.db.collection(MASTER_COLLECTION).findOne({ _id: app.dbObjectId(fixture.master_id), xrstatx: ACTIVE })
    const actualSection = sectionOf(null, master)
    const ready = Boolean(master && text(master.item_code) === fixture.item_code && actualSection === fixture.section && text(master.lab_item && master.lab_item.his_lab_code))
    checks.push({
      scenario: fixture.scenario, section: fixture.section, item_code: fixture.item_code,
      master_id: fixture.master_id, target_status: fixture.target_status, ready,
      reason: ready ? '' : 'Item master เปลี่ยน/ปิดใช้งาน/section ไม่ตรง'
    })
  }
  if (action === 'preview_flow_suite' || checks.some(check => !check.ready)) {
    return {
      success: checks.every(check => check.ready),
      data: {
        visit_id: visitId, hn: expectedHn, scenarios: checks,
        finance_check_mode: 'read_only_on_cancel', creates_finance_records: false,
        calls_agent_or_lis: false, receive_click_allowed_only_for: 'MY_RECEIVE_MANUAL'
      },
      error: checks.some(check => !check.ready) ? 'flow_suite_preflight_failed' : '',
      message: checks.every(check => check.ready) ? 'Interactive flow suite พร้อมสร้าง' : 'Interactive flow suite ยังสร้างไม่ได้'
    }
  }

  let scenarios = []
  let prepared = []
  if (action === 'resume_flow_suite') {
    runId = text(params.seed_run_id)
    if (!/^LAB-UAT-[A-Za-z0-9_-]{8,120}$/.test(runId)) return { success: false, error: 'seed_run_id_invalid', message: 'seed_run_id ไม่ถูกต้อง' }
    const previous = await app.db.collection(SEED_RUN_COLLECTION).findOne({ run_id: runId, xrstatx: ACTIVE })
    if (!previous || lower(previous.mode) !== 'create_flow_suite' || lower(previous.status) !== 'cleanup_required' || text(previous.expected_hn) !== expectedHn || text(previous.visit_id) !== visitId) {
      return { success: false, error: 'flow_resume_not_allowed', message: 'resume ได้เฉพาะ create_flow_suite เดิมที่หยุดเป็น cleanup_required และ Visit/HN ตรงกัน' }
    }
    createdOrderIds = unique(previous.created_order_ids)
    itemIds = unique(previous.item_ids)
    scenarios = Array.isArray(previous.scenarios) ? previous.scenarios.slice() : []
    prepared = Array.isArray(previous.items) ? previous.items.slice() : []
    const allowedNames = new Set(FLOW_SUITE.map(row => row.scenario))
    if (scenarios.some(row => !allowedNames.has(text(row && row.scenario)))) {
      return { success: false, error: 'flow_resume_state_invalid', message: 'seed run มี scenario ที่ไม่อยู่ใน allowlist' }
    }
    runRecordCreated = true
    await app.db.collection(SEED_RUN_COLLECTION).updateOne(
      { run_id: runId, xrstatx: ACTIVE },
      { $set: { status: 'creating_orders', failure: null, updated_at: now, updated_by: actor } }
    )
  } else {
    runId = makeRunId()
    await app.db.collection(SEED_RUN_COLLECTION).insertOne({
      run_id: runId, mode: action, status: 'creating_orders', expected_hn: expectedHn,
      visit_id: visitId, item_ids: [], created_order_ids: [], items: [], scenarios: [],
      note: text(params.note).slice(0, 1000),
      safety: {
        finance_record_created: false, finance_check_mode: 'read_only_on_cancel', outbound_transport_locked: true,
        agent_called: false, lis_called: false, external_http_called: false,
        receive_click_allowed_only_for: 'MY_RECEIVE_MANUAL'
      },
      created_at: now, created_by: actor, updated_at: now, updated_by: actor, xrstatx: 1
    })
    runRecordCreated = true
  }
  try {
    for (const fixture of FLOW_SUITE) {
      if (scenarios.some(row => text(row && row.scenario) === fixture.scenario)) continue
      const master = await app.db.collection(MASTER_COLLECTION).findOne({ _id: app.dbObjectId(fixture.master_id), xrstatx: ACTIVE })
      const lab = master.lab_item || {}
      const specimen = lab.specimen || {}
      const labRows = fixture.section === 'MY' ? [
        { spec_source_code: 'HAIR', spec_source: 'Hair', spec_site_code: 'HEAD', spec_site_name: 'ศีรษะ', at: now },
        { spec_source_code: 'SKIN', spec_source: 'Skin scraping', spec_site_code: 'ARM', spec_site_name: 'แขน', at: now },
        { spec_source_code: 'NAIL', spec_source: 'Nail clipping', spec_site_code: 'LEG', spec_site_name: 'ขา', at: now }
      ] : null
      const created = await runSubProcess(CPOE_SAVE_PROCESS_ID, {
        visit_id: visitId, organization_code: SECTION_ORGANIZATION[fixture.section], section_codes: [fixture.section],
        service_type: 'lab', priority: '1', inscl: null, inscl_row: null,
        order_comment: fixture.order_comment, order_tags: ['LAB_UAT_NO_LIS', fixture.scenario],
        lines: [{
          uid: 'lab-uat-flow-' + fixture.scenario, item_source: 'item', item_form_id: '6a594763d448dfc9d33e2c27',
          item_data_id: fixture.master_id, item_code: fixture.item_code, item_name: text(master.item_name),
          quantity: fixture.quantity || 1, service_type: 'lab', comment: 'UAT FLOW: ' + fixture.scenario,
          lab_data: labRows ? { rows: labRows, by_id: text(userInfo._id || userInfo.id) } : {
            source: text(specimen.name), spec_source: text(specimen.name), spec_source_code: text(specimen.code),
            storage: 'IM', at: now, by_id: text(userInfo._id || userInfo.id)
          }
        }]
      })
      if (!created || created.success !== true || !validId(created.order_id)) {
        throw new Error('FLOW_ORDER_CREATE_FAILED:' + fixture.scenario + ':' + (text(created && created.message) || 'สร้าง CPOE draft ไม่สำเร็จ'))
      }
      const orderId = text(created.order_id)
      createdOrderIds.push(orderId)
      const rows = await app.db.collection(ITEM_COLLECTION).find({ xrstatx: ACTIVE, $or: [{ xparentx: app.dbObjectId(orderId) }, { 'order_id.value': app.dbObjectId(orderId) }] }).toArray()
      const selected = rows.find(row => text(row.item_code) === fixture.item_code)
      if (!selected) throw new Error('FLOW_ITEM_MISSING:' + fixture.scenario + ':' + fixture.item_code)
      const itemId = text(selected._id)
      itemIds.push(itemId)
      await app.db.collection(ITEM_COLLECTION).updateOne(
        { _id: app.dbObjectId(itemId), xrstatx: ACTIVE },
        { $set: { current_status: 'ready', uat_seed: { run_id: runId, scenario: fixture.scenario, at: now, by: actor }, updated_at: now, updated_by: actor } }
      )
      await app.db.collection(ORDER_COLLECTION).updateOne(
        { _id: app.dbObjectId(orderId), xrstatx: ACTIVE },
        { $set: { current_status: 'ready', uat_seed: { run_id: runId, scenario: fixture.scenario, at: now, by: actor }, updated_at: now, updated_by: actor } }
      )
      const scenario = {
        scenario: fixture.scenario, section: fixture.section, order_id: orderId,
        order_number: text((await app.db.collection(ORDER_COLLECTION).findOne({ _id: app.dbObjectId(orderId), xrstatx: ACTIVE }) || {}).order_number),
        item_id: itemId, item_code: fixture.item_code, status: fixture.target_status,
        finance_check_mode: fixture.scenario === 'BC_CANCEL_FINANCE_READONLY' ? 'read_only_on_cancel' : 'not_applicable',
        receive_click_safe: fixture.scenario === 'MY_RECEIVE_MANUAL'
      }
      if (fixture.target_status === 'accepted') {
        const context = (await loadContexts([itemId]))[0]
        const preparedEntry = await prepareContext(context, runId)
        prepared.push(preparedEntry)
        scenario.status = 'accepted'
        scenario.lab_no = preparedEntry.lab_no
        scenario.transport_locked = true
        scenario.result_created = false
        await app.db.collection(ORDER_COLLECTION).updateOne(
          { _id: app.dbObjectId(orderId), xrstatx: ACTIVE },
          { $set: { current_status: 'accepted', updated_at: now, updated_by: actor } }
        )
      }
      scenarios.push(scenario)
      await app.db.collection(SEED_RUN_COLLECTION).updateOne(
        { run_id: runId, xrstatx: ACTIVE },
        { $set: { created_order_ids: createdOrderIds.slice(), item_ids: unique(itemIds), items: prepared.slice(), scenarios: scenarios.slice(), updated_at: now, updated_by: actor } }
      )
    }
    await app.db.collection(SEED_RUN_COLLECTION).updateOne(
      { run_id: runId, xrstatx: ACTIVE },
      { $set: { status: 'seeded', created_order_ids: createdOrderIds.slice(), item_ids: unique(itemIds), items: prepared, scenarios, updated_at: now, updated_by: actor } }
    )
  } catch (error) {
    await app.db.collection(SEED_RUN_COLLECTION).updateOne(
      { run_id: runId, xrstatx: ACTIVE },
      { $set: { status: 'cleanup_required', created_order_ids: createdOrderIds.slice(), item_ids: unique(itemIds), items: prepared, scenarios, failure: { message: text(error && error.message || error), at: now }, updated_at: now, updated_by: actor } }
    )
    return { success: false, error: 'flow_suite_create_failed_cleanup_required', data: { seed_run_id: runId, created_order_ids: createdOrderIds, scenarios }, message: text(error && error.message || error) }
  }

  return {
    success: true,
    data: {
      seed_run_id: runId, hn: expectedHn, scenarios, created_order_ids: createdOrderIds,
      finance_record_created: false, finance_check_mode: 'read_only_on_cancel',
      agent_called: false, lis_called: false, external_http_called: false,
      outbound_transport_locked: true, receive_click_allowed_only_for: 'MY_RECEIVE_MANUAL'
    },
    message: 'สร้าง Interactive LAB UAT flow แล้ว; ไม่เรียก Agent/LIS และไม่สร้างหรือแก้ข้อมูลการเงิน'
  }
}

if (
  action === 'preview_suite' || action === 'create_suite' ||
  action === 'preview_manual_suite' || action === 'create_manual_suite'
) {
  const visitId = text(params.visit_id)
  if (!validId(visitId)) return { success: false, error: 'visit_id_invalid', message: 'visit_id ไม่ถูกต้อง' }
  const visit = await app.db.collection(VISIT_COLLECTION).findOne({ _id: app.dbObjectId(visitId), xrstatx: ACTIVE })
  const visitHn = text(visit && visit.pid && visit.pid.hn)
  const marker = [visitHn, visit && visit.pid && visit.pid.p_fname, visit && visit.pid && visit.pid.p_lname].map(text).join(' ')
  if (!visit || visitHn !== expectedHn || !isAllowedTestPatient(visitHn, marker)) {
    return { success: false, error: 'test_visit_required', message: 'Visit/HN ไม่ตรงหรือไม่ใช่ผู้ป่วยทดสอบ' }
  }
  const checks = []
  for (const fixture of DEFAULT_SUITE) {
    const master = await app.db.collection(MASTER_COLLECTION).findOne({ _id: app.dbObjectId(fixture.master_id), xrstatx: ACTIVE })
    const actualSection = sectionOf(null, master)
    const ready = Boolean(master && text(master.item_code) === fixture.item_code && actualSection === fixture.section && text(master.lab_item && master.lab_item.his_lab_code))
    checks.push({ section: fixture.section, item_code: fixture.item_code, master_id: fixture.master_id, ready, reason: ready ? '' : 'Item master เปลี่ยน/ปิดใช้งาน/section ไม่ตรง' })
  }
  if (action === 'preview_suite' || action === 'preview_manual_suite' || checks.some(check => !check.ready)) {
    const manualMode = action === 'preview_manual_suite' || action === 'create_manual_suite'
    return {
      success: checks.every(check => check.ready),
      data: {
        visit_id: visitId, hn: expectedHn, rooms: checks,
        target_status: manualMode ? 'accepted' : 'completed',
        manual_entry_ready: manualMode,
        result_created: false,
        calls_agent_or_lis: false, creates_finance_records: false,
        outbound_transport_locked: true, receive_bypassed: true
      },
      error: checks.some(check => !check.ready) ? 'suite_preflight_failed' : '',
      message: checks.every(check => check.ready)
        ? (manualMode ? 'Manual-entry suite พร้อมสร้าง' : 'Suite พร้อมสร้าง')
        : 'Suite ยังสร้างไม่ได้'
    }
  }
  runId = makeRunId()
  await app.db.collection(SEED_RUN_COLLECTION).insertOne({
    run_id: runId, mode: action, status: 'creating_orders', expected_hn: expectedHn,
    visit_id: visitId, item_ids: [], created_order_ids: [], items: [],
    note: text(params.note).slice(0, 1000),
    safety: { finance_record_created: false, outbound_transport_locked: true, agent_called: false, lis_called: false, external_http_called: false },
    created_at: now, created_by: actor, updated_at: now, updated_by: actor, xrstatx: 1
  })
  runRecordCreated = true
  try {
    for (const fixture of DEFAULT_SUITE) {
      const master = await app.db.collection(MASTER_COLLECTION).findOne({ _id: app.dbObjectId(fixture.master_id), xrstatx: ACTIVE })
      const lab = master.lab_item || {}
      const specimen = lab.specimen || {}
      const labRows = fixture.section === 'MY' ? [
        { spec_source_code: 'HAIR', spec_source: 'Hair', spec_site_code: 'HEAD', spec_site_name: 'ศีรษะ', at: now },
        { spec_source_code: 'SKIN', spec_source: 'Skin scraping', spec_site_code: 'ARM', spec_site_name: 'แขน', at: now },
        { spec_source_code: 'NAIL', spec_source: 'Nail clipping', spec_site_code: 'LEG', spec_site_name: 'ขา', at: now }
      ] : null
      const created = await runSubProcess(CPOE_SAVE_PROCESS_ID, {
        visit_id: visitId, organization_code: SECTION_ORGANIZATION[fixture.section], section_codes: [fixture.section],
        service_type: 'lab', priority: '1', inscl: null, inscl_row: null,
        order_comment: fixture.order_comment || ('LAB UAT ' + fixture.section + ' · NO LIS'), order_tags: ['LAB_UAT_NO_LIS'],
        lines: [{
          uid: 'lab-uat-' + fixture.section, item_source: 'item', item_form_id: '6a594763d448dfc9d33e2c27',
          item_data_id: fixture.master_id, item_code: fixture.item_code, item_name: text(master.item_name),
          quantity: fixture.quantity || 1, service_type: 'lab', comment: fixture.comment || '',
          lab_data: labRows ? { rows: labRows, by_id: text(userInfo._id || userInfo.id) } : {
            source: fixture.specimen_name || text(specimen.name), spec_source: fixture.specimen_name || text(specimen.name),
            spec_source_code: text(specimen.code), storage: 'IM', at: now, by_id: text(userInfo._id || userInfo.id)
          }
        }]
      })
      if (!created || created.success !== true || !validId(created.order_id)) {
        throw new Error('SUITE_ORDER_CREATE_FAILED:' + fixture.section + ':' + (text(created && created.message) || 'สร้าง CPOE draft ไม่สำเร็จ'))
      }
      createdOrderIds.push(text(created.order_id))
      await app.db.collection(SEED_RUN_COLLECTION).updateOne(
        { run_id: runId, xrstatx: ACTIVE },
        { $set: { created_order_ids: createdOrderIds.slice(), updated_at: now, updated_by: actor } }
      )
      const rows = await app.db.collection(ITEM_COLLECTION).find({ xrstatx: ACTIVE, $or: [{ xparentx: app.dbObjectId(created.order_id) }, { 'order_id.value': app.dbObjectId(created.order_id) }] }).toArray()
      const selected = rows.find(row => text(row.item_code) === fixture.item_code)
      if (!selected) throw new Error('SUITE_ITEM_MISSING:' + fixture.section + ':' + fixture.item_code)
      itemIds.push(text(selected._id))
      await app.db.collection(SEED_RUN_COLLECTION).updateOne(
        { run_id: runId, xrstatx: ACTIVE },
        { $set: { item_ids: unique(itemIds), updated_at: now, updated_by: actor } }
      )
    }
  } catch (error) {
    await app.db.collection(SEED_RUN_COLLECTION).updateOne(
      { run_id: runId, xrstatx: ACTIVE },
      { $set: { status: 'cleanup_required', item_ids: unique(itemIds), created_order_ids: createdOrderIds.slice(), failure: { message: text(error && error.message || error), at: now }, updated_at: now, updated_by: actor } }
    )
    return { success: false, error: 'suite_order_create_failed_cleanup_required', data: { seed_run_id: runId, created_order_ids: createdOrderIds }, message: text(error && error.message || error) }
  }
}

itemIds = unique(itemIds)
if (!itemIds.length || itemIds.length > MAX_ITEMS || itemIds.some(id => !validId(id))) {
  if (runRecordCreated) await app.db.collection(SEED_RUN_COLLECTION).updateOne({ run_id: runId, xrstatx: ACTIVE }, { $set: { status: 'cleanup_required', failure: { message: 'item_ids_invalid', at: now }, updated_at: now, updated_by: actor } })
  return { success: false, error: 'item_ids_invalid', message: 'item_ids ไม่ถูกต้องหรือเกิน ' + MAX_ITEMS + ' รายการ' }
}

let contexts
try { contexts = await loadContexts(itemIds) } catch (error) {
  if (runRecordCreated) await app.db.collection(SEED_RUN_COLLECTION).updateOne({ run_id: runId, xrstatx: ACTIVE }, { $set: { status: 'cleanup_required', failure: { message: text(error && error.message || error), at: now }, updated_at: now, updated_by: actor } })
  return { success: false, error: 'context_load_failed', data: runRecordCreated ? { seed_run_id: runId, created_order_ids: createdOrderIds } : {}, message: text(error && error.message || error) }
}
const checks = validateContexts(
  contexts,
  expectedHn,
  action === 'create_suite' || action === 'create_manual_suite' || action === 'create_bc_profile_suite'
)
if (action === 'preview_existing') {
  return { success: checks.every(check => check.ready), data: { hn: expectedHn, items: checks, calls_agent_or_lis: false, creates_finance_records: false }, error: checks.some(check => !check.ready) ? 'seed_preflight_failed' : '', message: checks.every(check => check.ready) ? 'รายการพร้อม seed' : 'มีรายการที่ยัง seed ไม่ได้' }
}
if (checks.some(check => !check.ready)) {
  if (runRecordCreated) await app.db.collection(SEED_RUN_COLLECTION).updateOne({ run_id: runId, xrstatx: ACTIVE }, { $set: { status: 'cleanup_required', failure: { message: 'seed_preflight_failed', at: now }, updated_at: now, updated_by: actor } })
  return { success: false, error: 'seed_preflight_failed', data: { seed_run_id: runId || '', items: checks, created_order_ids: createdOrderIds }, message: 'มีรายการที่ไม่ผ่าน preflight' }
}

if (!runId) runId = makeRunId()
const runRecord = {
  run_id: runId, mode: action, status: 'seeding', expected_hn: expectedHn,
  item_ids: itemIds, created_order_ids: createdOrderIds, items: [],
  note: text(params.note).slice(0, 1000),
  safety: { finance_record_created: false, outbound_transport_locked: true, agent_called: false, lis_called: false, external_http_called: false },
  created_at: now, created_by: actor, updated_at: now, updated_by: actor, xrstatx: 1
}
if (runRecordCreated) {
  await app.db.collection(SEED_RUN_COLLECTION).updateOne(
    { run_id: runId, xrstatx: ACTIVE },
    { $set: { status: 'seeding', item_ids: itemIds, created_order_ids: createdOrderIds, note: runRecord.note, safety: runRecord.safety, updated_at: now, updated_by: actor } }
  )
} else {
  await app.db.collection(SEED_RUN_COLLECTION).insertOne(runRecord)
}

const seeded = []
try {
  if (action === 'create_manual_suite') {
    for (const context of contexts) seeded.push(await prepareContext(context, runId))
    for (const orderId of createdOrderIds) {
      await app.db.collection(ORDER_COLLECTION).updateOne(
        { _id: app.dbObjectId(orderId), xrstatx: ACTIVE },
        { $set: { uat_seed: { run_id: runId, at: now, by: actor }, current_status: 'accepted', updated_at: now, updated_by: actor } }
      )
    }
    await app.db.collection(SEED_RUN_COLLECTION).updateOne(
      { run_id: runId, xrstatx: ACTIVE },
      { $set: { status: 'manual_entry_ready', items: seeded, updated_at: now, updated_by: actor } }
    )
    return {
      success: true,
      data: {
        seed_run_id: runId, hn: expectedHn, item_count: seeded.length, items: seeded,
        created_order_ids: createdOrderIds, coverage: seeded.map(row => row.section),
        target_status: 'accepted', manual_entry_ready: true, result_created: false,
        finance_record_created: false, agent_called: false, lis_called: false,
        external_http_called: false, outbound_transport_locked: true, receive_bypassed: true
      },
      message: 'สร้าง LAB UAT สำหรับลงผล Manual ทุกห้องแล้ว โดยข้าม Receive/Agent/LIS และไม่สร้างข้อมูลการเงิน'
    }
  }
  for (const context of contexts) seeded.push(await seedContext(context, runId))
  for (const orderId of createdOrderIds) {
    await app.db.collection(ORDER_COLLECTION).updateOne({ _id: app.dbObjectId(orderId), xrstatx: ACTIVE }, { $set: { uat_seed: { run_id: runId, at: now, by: actor }, current_status: 'completed', updated_at: now, updated_by: actor } })
  }
  await app.db.collection(SEED_RUN_COLLECTION).updateOne({ run_id: runId, xrstatx: ACTIVE }, { $set: { status: 'seeded', items: seeded, updated_at: now, updated_by: actor } })
} catch (error) {
  await app.db.collection(SEED_RUN_COLLECTION).updateOne({ run_id: runId, xrstatx: ACTIVE }, { $set: { status: 'cleanup_required', items: seeded, failure: { message: text(error && error.message || error), at: now }, updated_at: now, updated_by: actor } })
  return { success: false, error: 'seed_failed_cleanup_required', data: { seed_run_id: runId, seeded_items: seeded, created_order_ids: createdOrderIds }, message: text(error && error.message || error) }
}

return {
  success: true,
  data: {
    seed_run_id: runId, hn: expectedHn, item_count: seeded.length, items: seeded,
    created_order_ids: createdOrderIds,
    coverage: seeded.map(row => row.section),
    finance_record_created: false, agent_called: false, lis_called: false,
    external_http_called: false, outbound_transport_locked: true
  },
  message: 'สร้าง LAB UAT seed และลงผลแล้ว โดยไม่เรียก Agent/LIS และไม่สร้างข้อมูลการเงิน'
}
