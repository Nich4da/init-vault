/*
 * initCraft API Factory Process body
 * Suggested process name: hl7_result_upsert
 *
 * Paste this complete file inside Process(params, userInfo).
 * External request body: { "params": <Agent result JSON> }
 * Contract: schemas/agent-to-his-result-v2.schema.json
 *
 * This process deliberately uses the SDForm pipeline for all writes. It does not
 * change specimen, reject, priority, search, or ListView behavior.
 */

const RECEIPT_FORM_ID = '6a8b1c03f851000f28e501ef'
const REPORT_FORM_ID = '6a8d4334f851000f28e5025b'
const RESULT_ITEM_FORM_ID = '6a8bc91df851000f28e501fb'
const STATUS_FORM_ID = '6a7daa3e8d398c11cf2fe869'
const SCHEMA_VERSION = 'his-agent-result-v2'

const text = value => {
  if (value == null) return ''
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return String(value.toHexString())
    if (value.$oid != null) return String(value.$oid)
    if (value._id != null) return text(value._id)
    if (value.id != null && typeof value.id !== 'object') return String(value.id)
    if (value.value != null && typeof value.value !== 'object') return String(value.value)
  }
  return String(value)
}

const trimmed = value => text(value).trim()
const lower = value => trimmed(value).toLowerCase()
const active = row => row && Number(row.xrstatx) !== 0 && Number(row.xrstatx) !== 3

const parseArray = value => {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}

const parseHistory = value => {
  const parsed = parseArray(value)
  return parsed.filter(entry => entry && typeof entry === 'object')
}

const firstText = values => {
  for (const value of values) {
    const result = trimmed(value)
    if (result) return result
  }
  return ''
}

const resultData = result => {
  if (!result) return null
  if (Array.isArray(result.data)) return result.data
  if (result.data != null) return result.data
  if (result.reply && result.reply.data != null) return result.reply.data
  return null
}

const resultId = result => trimmed(
  result && (
    result.id ||
    (result.data && (result.data._id || result.data.id)) ||
    (result.reply && (result.reply.id || (result.reply.data && result.reply.data._id)))
  )
)

const isoThailand = () => {
  try {
    const value = app.curDate('YYYY-MM-DDTHH:mm:ss+07:00')
    if (value) return String(value)
  } catch (error) {
    // Unit-test and older runtime fallback only.
  }
  const now = new Date(Date.now() + (7 * 60 * 60 * 1000))
  return now.toISOString().replace('Z', '+07:00')
}

const stableHash = value => {
  const source = String(value || '')
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return 'fnv1a32:' + (hash >>> 0).toString(16).padStart(8, '0')
}

const sequenceCompare = (left, right) => {
  const a = trimmed(left).replace(/^0+(?=\d)/, '')
  const b = trimmed(right).replace(/^0+(?=\d)/, '')
  if (a.length !== b.length) return a.length > b.length ? 1 : -1
  if (a === b) return 0
  return a > b ? 1 : -1
}

const internalStatus = payload => {
  if (payload.overall_status === 'cancelled') return 'cancelled'
  if (payload.overall_status === 'corrected') return 'corrected'
  if (payload.overall_status === 'resulted') return 'completed'
  return payload.items.length ? 'partial' : 'processing'
}

const itemStatus = (payload, item) => {
  const obxStatus = trimmed(item && item.obx_status).toUpperCase()
  if (payload.overall_status === 'cancelled') return 'void'
  if (payload.overall_status === 'corrected') return 'corrected'
  if (obxStatus === 'C') return 'corrected'
  if (['X', 'D'].includes(obxStatus)) return 'void'
  if (obxStatus === 'F') return 'final'
  if (obxStatus === 'P') return 'entered'
  if (payload.overall_status === 'resulted') return 'final'
  return 'entered'
}

const criticalCodes = new Set(['LL', 'HH', 'AA'])
const recognizedInterpretationCodes = new Set(['N', 'L', 'H', 'LL', 'HH', 'AA'])

const criticalDecision = item => {
  const interpretationCode = trimmed(item && item.interpretation_code).toUpperCase()
  const hasExplicitBoolean = item && typeof item.is_critical === 'boolean'
  const isCritical = hasExplicitBoolean
    ? item.is_critical
    : criticalCodes.has(interpretationCode)
  return {
    interpretationCode,
    isCritical,
    missing: !hasExplicitBoolean && !interpretationCode,
  }
}

const allowedTopFields = new Set([
  'order_no', 'filler_order_no', 'hn', 'visit_id', 'result_uid',
  'report_seq', 'stage', 'overall_status', 'reported_at', 'reported_by',
  'verified_at', 'verified_by', 'items', 'labno', 'lab_no',
])
const allowedIdentityFields = new Set(['source_id', 'source_name'])
const allowedItemFields = new Set([
  'obs_code', 'obs_name', 'value', 'units', 'ref_range', 'obx_status',
  'change_kind', 'previous_value', 'receipt_seq', 'result_version',
  'critical_low_rule', 'critical_high_rule', 'panel_code', 'panel_name',
  'group_role', 'organism', 'interpretation_code', 'is_critical',
])
const requiredTopFields = [
  'order_no', 'filler_order_no', 'hn', 'visit_id', 'result_uid',
  'report_seq', 'stage', 'overall_status', 'reported_at', 'reported_by', 'items',
]
const requiredItemFields = [
  'obs_code', 'obs_name', 'value', 'obx_status', 'change_kind',
  'receipt_seq', 'result_version',
]
const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+07:00$/
const sequencePattern = /^\d+$/

const validateStringLength = (value, path, maxLength, errors, minLength) => {
  if (value == null) return
  if (typeof value !== 'string') return
  const minimum = minLength == null ? 0 : minLength
  if (value.length < minimum) errors.push(path + ' ต้องยาวอย่างน้อย ' + minimum + ' ตัวอักษร')
  if (value.length > maxLength) errors.push(path + ' ต้องยาวไม่เกิน ' + maxLength + ' ตัวอักษร')
}

const validateIdentity = (value, path, errors) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(path + ' ต้องเป็น object')
    return
  }
  for (const key of Object.keys(value)) {
    if (!allowedIdentityFields.has(key)) errors.push(path + '.' + key + ' ไม่อยู่ใน schema')
  }
  for (const key of allowedIdentityFields) {
    if (!trimmed(value[key])) errors.push(path + '.' + key + ' ต้องมีค่า')
  }
  validateStringLength(value.source_id, path + '.source_id', 100, errors, 1)
  validateStringLength(value.source_name, path + '.source_name', 300, errors, 1)
}

const validatePayload = payload => {
  const errors = []
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ['params ต้องเป็น Agent result object']
  }
  for (const key of Object.keys(payload)) {
    if (!allowedTopFields.has(key)) errors.push(key + ' ไม่อยู่ใน schema')
  }
  for (const key of requiredTopFields) {
    if (payload[key] == null || (typeof payload[key] === 'string' && !payload[key])) {
      errors.push(key + ' เป็น required field')
    }
  }
  for (const key of ['order_no', 'filler_order_no', 'labno', 'lab_no', 'hn', 'visit_id', 'result_uid', 'stage']) {
    if (payload[key] != null && typeof payload[key] !== 'string') errors.push(key + ' ต้องเป็น string')
  }
  for (const key of ['order_no', 'filler_order_no', 'labno', 'lab_no', 'hn', 'visit_id']) {
    validateStringLength(payload[key], key, 100, errors, 1)
  }
  validateStringLength(payload.result_uid, 'result_uid', 200, errors, 1)
  const labNoValues = [payload.filler_order_no, payload.labno, payload.lab_no]
    .map(trimmed)
    .filter(Boolean)
  if (new Set(labNoValues).size > 1) errors.push('filler_order_no/labno/lab_no ต้องเป็น LAB NO. ค่าเดียวกัน')
  if (payload.report_seq != null && typeof payload.report_seq !== 'string') errors.push('report_seq ต้องเป็น string')
  if (!sequencePattern.test(trimmed(payload.report_seq))) errors.push('report_seq ต้องเป็น string ตัวเลข')
  if (!['in_progress', 'resulted', 'corrected', 'cancelled'].includes(payload.overall_status)) {
    errors.push('overall_status ไม่ถูกต้อง')
  }
  const stageByStatus = {
    in_progress: ['partial', 'preliminary'],
    resulted: ['final'],
    corrected: ['corrected'],
    cancelled: ['cancelled'],
  }
  const allowedStages = stageByStatus[payload.overall_status] || []
  if (trimmed(payload.stage) && allowedStages.length && !allowedStages.includes(lower(payload.stage))) {
    errors.push('stage ไม่สอดคล้องกับ overall_status')
  }
  if (!isoPattern.test(trimmed(payload.reported_at))) errors.push('reported_at ต้องเป็น ISO 8601 +07:00')
  validateIdentity(payload.reported_by, 'reported_by', errors)
  if (payload.verified_at != null && !isoPattern.test(trimmed(payload.verified_at))) {
    errors.push('verified_at ต้องเป็น ISO 8601 +07:00')
  }
  if (payload.verified_by != null) validateIdentity(payload.verified_by, 'verified_by', errors)
  if (payload.overall_status === 'resulted') {
    if (!payload.verified_at) errors.push('resulted ต้องมี verified_at')
    if (!payload.verified_by) errors.push('resulted ต้องมี verified_by')
  }
  if (!Array.isArray(payload.items) || !payload.items.length) {
    errors.push('items ต้องเป็น array ที่มีอย่างน้อย 1 รายการ')
    return errors
  }
  payload.items.forEach((item, index) => {
    const path = 'items[' + index + ']'
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(path + ' ต้องเป็น object')
      return
    }
    for (const key of Object.keys(item)) {
      if (!allowedItemFields.has(key)) errors.push(path + '.' + key + ' ไม่อยู่ใน schema')
    }
    for (const key of requiredItemFields) {
      if (item[key] == null || (key !== 'value' && typeof item[key] === 'string' && !item[key])) {
        errors.push(path + '.' + key + ' เป็น required field')
      }
    }
    const itemLimits = {
      obs_code: [100, 1],
      obs_name: [300, 1],
      units: [100, 0],
      ref_range: [500, 0],
      obx_status: [20, 1],
      change_kind: [100, 1],
      critical_low_rule: [200, 1],
      critical_high_rule: [200, 1],
      panel_code: [100, 0],
      panel_name: [300, 0],
      group_role: [100, 0],
      organism: [300, 0],
    }
    for (const [key, limit] of Object.entries(itemLimits)) {
      validateStringLength(item[key], path + '.' + key, limit[0], errors, limit[1])
    }
    for (const key of Object.keys(item)) {
      if (key === 'is_critical') {
        if (item[key] != null && typeof item[key] !== 'boolean') errors.push(path + '.is_critical ต้องเป็น boolean')
      } else if (item[key] != null && typeof item[key] !== 'string') {
        errors.push(path + '.' + key + ' ต้องเป็น string')
      }
    }
    if (!sequencePattern.test(trimmed(item.receipt_seq))) errors.push(path + '.receipt_seq ต้องเป็น string ตัวเลข')
    if (!sequencePattern.test(trimmed(item.result_version))) errors.push(path + '.result_version ต้องเป็น string ตัวเลข')
    const interpretationCode = trimmed(item.interpretation_code).toUpperCase()
    if (interpretationCode && !recognizedInterpretationCodes.has(interpretationCode)) {
      errors.push(path + '.interpretation_code ไม่ถูกต้อง')
    }
    if (typeof item.is_critical === 'boolean' && interpretationCode) {
      const codeCritical = criticalCodes.has(interpretationCode)
      if (item.is_critical !== codeCritical) {
        errors.push(path + '.is_critical ขัดแย้งกับ interpretation_code')
      }
    }
  })
  const obsCodes = payload.items.map(item => trimmed(item && item.obs_code)).filter(Boolean)
  const duplicateObsCodes = obsCodes.filter((code, index) => obsCodes.indexOf(code) !== index)
  if (duplicateObsCodes.length) {
    errors.push('items.obs_code ซ้ำใน payload: ' + Array.from(new Set(duplicateObsCodes)).join(', '))
  }
  return errors
}

const queryRows = async (formId, paramsValue, where, orderBy, limit) => {
  const provider = {
    providerId: formId,
    providerType: 'FORM',
    params: paramsValue || {},
    options: {
      where,
      orderBy: orderBy || [],
      limit: limit || 1000,
      page: 1,
    },
  }
  const found = await app.sdformGetAll(provider, false, userInfo)
  if (!found || found.success === false) {
    throw new Error((found && found.message) || 'query form ไม่สำเร็จ')
  }
  const data = resultData(found)
  return Array.isArray(data) ? data.filter(active) : []
}

const saveRecord = async (formId, dataId, data) => {
  const saved = await app.sdformSetOne(formId, dataId, data, 1, userInfo)
  if (!saved || saved.success === false) {
    throw new Error((saved && saved.message) || 'บันทึก form ไม่สำเร็จ')
  }
  return { id: resultId(saved) || trimmed(dataId), data: resultData(saved) || data }
}

const createRecord = async (formId, data) => {
  const draft = await app.insertData(formId, userInfo)
  const draftId = resultId(draft)
  if (!draft || draft.success === false || !draftId) {
    throw new Error((draft && draft.message) || 'สร้าง draft ไม่สำเร็จ')
  }
  return saveRecord(formId, draftId, data)
}

const wirePayload = params && params.payload && typeof params.payload === 'object'
  ? params.payload
  : params
const payload = wirePayload && typeof wirePayload === 'object' && !Array.isArray(wirePayload)
  ? Object.assign({}, wirePayload, {
    filler_order_no: firstText([
      wirePayload.filler_order_no,
      wirePayload.labno,
      wirePayload.lab_no,
    ]),
  })
  : wirePayload

if (!app.isAuth(userInfo.roles || [])) {
  return { success: false, created: false, code: 'FORBIDDEN', message: 'service account ไม่มีสิทธิ์รับผล Lab' }
}

const validationErrors = validatePayload(payload)
if (validationErrors.length) {
  return {
    success: false,
    created: false,
    code: 'INVALID_PAYLOAD',
    message: 'Agent result JSON ไม่ผ่าน schema',
    errors: validationErrors,
  }
}

const rawPayload = JSON.stringify(wirePayload)
const receivedAt = isoThailand()
const workReportKey = [payload.order_no, payload.filler_order_no, payload.visit_id].join('|')
const payloadHash = stableHash(rawPayload)
const agentInternalStatus = internalStatus(payload)
const criticalCount = payload.items.filter(item => criticalDecision(item).isCritical).length

let duplicateRows
try {
  duplicateRows = await queryRows(
    RECEIPT_FORM_ID,
    { resultUid: payload.result_uid },
    '`result_uid` = :resultUid AND `xrstatx` NOT IN (0,3)',
    [],
    2
  )
} catch (error) {
  return { success: false, created: false, code: 'RECEIPT_LOOKUP_FAILED', message: trimmed(error.message || error) }
}

if (duplicateRows.length) {
  const existing = duplicateRows[0]
  const existingStatus = lower(existing.receipt_status)
  if (existingStatus !== 'processed') {
    return {
      success: false,
      created: false,
      duplicate: true,
      code: 'DUPLICATE_UNPROCESSED_RESULT_UID',
      message: 'result_uid นี้มี receipt เดิมที่ยังไม่ processed; ต้อง reconcile ก่อนตอบรับสำเร็จ',
      data: {
        result_uid: payload.result_uid,
        receipt_id: trimmed(existing._id),
        receipt_status: existingStatus || 'unknown',
        result_report_id: trimmed(existing.result_report_id),
      },
    }
  }
  return {
    success: true,
    created: false,
    duplicate: true,
    code: 'DUPLICATE_RESULT_UID',
    message: 'result_uid นี้ถูก HIS รับไว้แล้ว',
    data: {
      result_uid: payload.result_uid,
      receipt_id: trimmed(existing._id),
      receipt_status: trimmed(existing.receipt_status),
      result_report_id: trimmed(existing.result_report_id),
    },
  }
}

const receiptData = {
  receipt_status: 'received',
  source_channel: 'agent',
  schema_version: SCHEMA_VERSION,
  received_at: receivedAt,
  order_no: payload.order_no,
  filler_order_no: payload.filler_order_no,
  hn: payload.hn,
  visit_id: payload.visit_id,
  result_uid: payload.result_uid,
  report_seq: payload.report_seq,
  stage: payload.stage,
  agent_overall_status: payload.overall_status,
  internal_overall_status: agentInternalStatus,
  reported_at: payload.reported_at,
  reported_by_source_id: payload.reported_by.source_id,
  reported_by_source_name: payload.reported_by.source_name,
  verified_at: payload.verified_at || '',
  verified_by_source_id: payload.verified_by ? payload.verified_by.source_id : '',
  verified_by_source_name: payload.verified_by ? payload.verified_by.source_name : '',
  item_count: payload.items.length,
  critical_count: criticalCount,
  matched_item_count: 0,
  unmatched_item_count: 0,
  items_json: JSON.stringify(payload.items),
  result_report_id: '',
  processed_at: '',
  payload_hash: payloadHash,
  error_message: '',
  raw_payload_json: rawPayload,
}

let receipt
try {
  receipt = await createRecord(RECEIPT_FORM_ID, receiptData)
} catch (error) {
  return { success: false, created: false, code: 'RECEIPT_CREATE_FAILED', message: trimmed(error.message || error) }
}

const updateReceipt = async patch => {
  try {
    await saveRecord(RECEIPT_FORM_ID, receipt.id, patch)
  } catch (error) {
    // The original raw receipt already exists. Do not hide the primary failure.
  }
}

const failAfterReceipt = async (code, message, status, extra) => {
  const receiptStatus = status || 'error'
  await updateReceipt({
    receipt_status: receiptStatus,
    processed_at: isoThailand(),
    error_message: message,
    unmatched_item_count: receiptStatus === 'unmatched' ? payload.items.length : 0,
  })
  return {
    success: false,
    created: true,
    duplicate: false,
    code,
    message,
    data: Object.assign({
      result_uid: payload.result_uid,
      receipt_id: receipt.id,
      receipt_status: receiptStatus,
    }, extra || {}),
  }
}

let statusRows
try {
  statusRows = await queryRows(
    STATUS_FORM_ID,
    { fillerOrderNo: payload.filler_order_no },
    '`order_number` = :fillerOrderNo AND `xrstatx` NOT IN (0,3)',
    [],
    20
  )
} catch (error) {
  return failAfterReceipt('ORDER_LOOKUP_FAILED', 'ค้นหา Lab Order ไม่สำเร็จ: ' + trimmed(error.message || error), 'error')
}

const exactStatusRows = statusRows.filter(row => {
  const sameLabNo = firstText([row.order_number, row.lab_no]) === payload.filler_order_no
  const sameOrder = firstText([row.center_order_id, row.order_no]) === payload.order_no
  const sameHn = trimmed(row.patient_hn) === payload.hn
  const sameVisit = [trimmed(row.visit_vn), trimmed(row.visit_id)].filter(Boolean).includes(payload.visit_id)
  return sameLabNo && sameOrder && sameHn && sameVisit
})

if (exactStatusRows.length !== 1) {
  const hasLabNo = statusRows.length > 0
  const message = exactStatusRows.length > 1
    ? 'พบ Lab Order ที่ตรงกันมากกว่า 1 record; หยุดเพื่อป้องกันจับคู่ผิดงาน'
    : hasLabNo
      ? 'LAB NO. มีอยู่ แต่ order_no/HN/VN ไม่ตรงกับ Agent result'
      : 'ไม่พบ LAB NO. ที่ Agent ส่งมา'
  return failAfterReceipt('ORDER_NOT_MATCHED', message, 'unmatched', {
    candidate_count: statusRows.length,
    exact_match_count: exactStatusRows.length,
  })
}

const statusRow = exactStatusRows[0]
const statusId = trimmed(statusRow._id)
const currentWorkStatus = lower(statusRow.work_status)
if (['rejected', 'cancelled', 'canceled'].includes(currentWorkStatus)) {
  return failAfterReceipt('ORDER_NOT_ACTIVE', 'Lab Order ถูกปฏิเสธหรือยกเลิกแล้ว', 'unmatched', { order_status_id: statusId })
}
if (!['received', 'processing', 'resulted', 'completed'].includes(currentWorkStatus)) {
  return failAfterReceipt('ORDER_NOT_READY', 'Lab Order ยังไม่อยู่ในสถานะที่รับผลได้: ' + (currentWorkStatus || '(ว่าง)'), 'unmatched', { order_status_id: statusId })
}

const orderedItems = parseArray(statusRow.selected_items || statusRow.selected_items_json)
const orderedCodes = new Set(orderedItems.map(item => firstText([
  item && item.his_code_id,
  item && item.item_code,
  item && item.test_code,
  item && item.obs_code,
  item && item.code,
])).filter(Boolean))

if (!orderedCodes.size) {
  return failAfterReceipt('ORDER_ITEMS_MISSING', 'Lab Order ไม่มี selected_items/test_code สำหรับจับคู่ผล', 'unmatched', { order_status_id: statusId })
}

const matchedItems = payload.items.filter(item => orderedCodes.has(item.obs_code))
const unmatchedItems = payload.items.filter(item => !orderedCodes.has(item.obs_code))
if (!matchedItems.length) {
  return failAfterReceipt('OBS_CODE_NOT_MATCHED', 'ไม่มี obs_code ใดตรงกับ test_code ใน Lab Order', 'unmatched', {
    order_status_id: statusId,
    unmatched_obs_codes: unmatchedItems.map(item => item.obs_code),
  })
}

if (unmatchedItems.length) {
  return failAfterReceipt('OBS_CODE_PARTIAL_MISMATCH', 'มี obs_code ที่ไม่อยู่ใน Lab Order; ไม่บันทึกผลบางส่วนเพื่อป้องกันข้อมูลขาด', 'unmatched', {
    order_status_id: statusId,
    matched_obs_codes: matchedItems.map(item => item.obs_code),
    unmatched_obs_codes: unmatchedItems.map(item => item.obs_code),
  })
}

const payloadCodes = new Set(matchedItems.map(item => item.obs_code))
const missingExpectedCodes = Array.from(orderedCodes).filter(code => !payloadCodes.has(code))
if (payload.overall_status === 'resulted' && missingExpectedCodes.length) {
  return failAfterReceipt('FINAL_ITEMS_INCOMPLETE', 'overall_status=resulted แต่ items ยังไม่ครบตาม Lab Order', 'unmatched', {
    order_status_id: statusId,
    missing_obs_codes: missingExpectedCodes,
  })
}

const reportKey = [workReportKey, statusId, payload.report_seq, lower(payload.stage)].join('|')
let reportRows
let workReports
try {
  const lookups = await Promise.all([
    queryRows(
      REPORT_FORM_ID,
      { reportKey },
      '`report_key` = :reportKey AND `xrstatx` NOT IN (0,3)',
      [{ column: 'reported_at', sort: 'DESC' }],
      2
    ),
    queryRows(
      REPORT_FORM_ID,
      { orderStatusId: statusId },
      '`order_status_id` = :orderStatusId AND `xrstatx` NOT IN (0,3)',
      [{ column: 'reported_at', sort: 'DESC' }],
      2000
    ),
  ])
  reportRows = lookups[0]
  workReports = lookups[1]
} catch (error) {
  return failAfterReceipt('REPORT_LOOKUP_FAILED', 'ค้นหา Result Report ไม่สำเร็จ: ' + trimmed(error.message || error), 'error', { order_status_id: statusId })
}

if (reportRows.length) {
  return failAfterReceipt('REPORT_STAGE_CONFLICT', 'report_seq/stage นี้มี Result Report แล้ว แต่ result_uid ไม่ตรง; หยุดเพื่อป้องกันการทับประวัติ', 'error', {
    order_status_id: statusId,
    result_report_id: trimmed(reportRows[0]._id),
    report_key: reportKey,
  })
}

let latestReport = null
for (const row of workReports) {
  if (!latestReport || sequenceCompare(row.report_seq || '0', latestReport.report_seq || '0') > 0) latestReport = row
}

if (latestReport && sequenceCompare(payload.report_seq, latestReport.report_seq) < 0) {
  await updateReceipt({
    receipt_status: 'processed',
    processed_at: isoThailand(),
    result_report_id: trimmed(latestReport._id),
    matched_item_count: matchedItems.length,
    unmatched_item_count: 0,
    error_message: 'stale report_seq: เก็บ receipt แล้วแต่ไม่ย้อนผลปัจจุบัน',
  })
  return {
    success: true,
    created: true,
    duplicate: false,
    stale: true,
    code: 'STALE_REPORT_SEQUENCE',
    message: 'เก็บ receipt แล้ว แต่ report_seq เก่ากว่าผลปัจจุบันจึงไม่สร้าง Report/Items',
    data: { receipt_id: receipt.id, result_report_id: trimmed(latestReport._id), order_status_id: statusId },
  }
}

if (latestReport && sequenceCompare(payload.report_seq, latestReport.report_seq) === 0) {
  return failAfterReceipt('REPORT_SEQUENCE_REUSED', 'report_seq ซ้ำกับ Report เดิม; Agent ต้องเพิ่ม report_seq เมื่อส่ง stage/message ใหม่', 'error', {
    order_status_id: statusId,
    result_report_id: trimmed(latestReport._id),
  })
}

const reportStatusRank = { processing: 1, partial: 2, completed: 3, corrected: 4, cancelled: 5 }
const latestInternalStatus = latestReport ? trimmed(latestReport.internal_overall_status) : ''
if (latestReport && agentInternalStatus !== 'cancelled' &&
  (reportStatusRank[agentInternalStatus] || 0) < (reportStatusRank[latestInternalStatus] || 0)) {
  return failAfterReceipt('REPORT_STATUS_REGRESSION', 'stage ใหม่ย้อนสถานะจาก ' + latestInternalStatus + ' เป็น ' + agentInternalStatus, 'error', {
    order_status_id: statusId,
    result_report_id: trimmed(latestReport._id),
  })
}

let priorItems = []
try {
  priorItems = await queryRows(
    RESULT_ITEM_FORM_ID,
    {
      orderNo: payload.order_no,
      fillerOrderNo: payload.filler_order_no,
      visitId: payload.visit_id,
    },
    '`order_no` = :orderNo AND `filler_order_no` = :fillerOrderNo AND `visit_id` = :visitId AND `xrstatx` NOT IN (0,3)',
    [{ column: 'created_at', sort: 'DESC' }],
    5000
  )
} catch (error) {
  return failAfterReceipt('ITEM_LOOKUP_FAILED', 'ค้นหาประวัติ Result Item ไม่สำเร็จ: ' + trimmed(error.message || error), 'error', {
    order_status_id: statusId,
  })
}

const previousByObsCode = new Map()
for (const row of priorItems) {
  const code = trimmed(row.obs_code || row.test_code)
  if (!code) continue
  const previous = previousByObsCode.get(code)
  if (!previous || sequenceCompare(row.result_version || '0', previous.result_version || '0') > 0) {
    previousByObsCode.set(code, row)
  }
}

const conflicts = []
const staleVersions = []
for (const item of matchedItems) {
  const previous = previousByObsCode.get(item.obs_code)
  if (!previous) continue
  const versionOrder = sequenceCompare(item.result_version, previous.result_version || '0')
  if (versionOrder < 0) staleVersions.push(item.obs_code)
  if (versionOrder === 0 && trimmed(previous.result_value) !== item.value) {
    conflicts.push(item.obs_code + ': result_version เดิมแต่ value เปลี่ยน')
  }
}
if (staleVersions.length) {
  return failAfterReceipt('STALE_ITEM_VERSION', 'result_version เก่ากว่าผลที่รับไว้แล้ว: ' + staleVersions.join(', '), 'error', {
    order_status_id: statusId,
  })
}
if (conflicts.length) {
  return failAfterReceipt('RESULT_VERSION_CONFLICT', conflicts.join('; '), 'error', {
    order_status_id: statusId,
  })
}

const workParentObjectId = app.dbObjectId(statusId)
const missingCriticalDecisionCodes = matchedItems
  .filter(item => criticalDecision(item).missing && (trimmed(item.critical_low_rule) || trimmed(item.critical_high_rule)))
  .map(item => item.obs_code)
const reportWarning = missingCriticalDecisionCodes.length
  ? 'ไม่มี explicit critical decision: ' + missingCriticalDecisionCodes.join(', ')
  : ''

const reportData = {
  xparentx: workParentObjectId,
  filler_order_no: payload.filler_order_no,
  hn: payload.hn,
  visit_id: payload.visit_id,
  reported_at: payload.reported_at,
  reported_by_source_name: payload.reported_by.source_name,
  verified_by_source_name: payload.verified_by ? payload.verified_by.source_name : '',
  record_kind: 'report',
  report_key: reportKey,
  order_status_id: statusId,
  lab_section: firstText([statusRow.section_code, statusRow.lab_section]),
  lab_section_name: firstText([statusRow.section_name, statusRow.lab_section_name]),
  receipt_status: 'processed',
  source_channel: 'agent',
  schema_version: SCHEMA_VERSION,
  received_at: receivedAt,
  order_no: payload.order_no,
  result_uid: payload.result_uid,
  report_seq: payload.report_seq,
  stage: payload.stage,
  agent_overall_status: payload.overall_status,
  internal_overall_status: agentInternalStatus,
  reported_by_source_id: payload.reported_by.source_id,
  verified_at: payload.verified_at || '',
  verified_by_source_id: payload.verified_by ? payload.verified_by.source_id : '',
  item_count: matchedItems.length,
  critical_count: matchedItems.filter(item => criticalDecision(item).isCritical).length,
  matched_item_count: matchedItems.length,
  unmatched_item_count: 0,
  items_json: JSON.stringify(payload.items),
  processed_at: isoThailand(),
  payload_hash: payloadHash,
  error_message: reportWarning,
  raw_payload_json: rawPayload,
}

let report
try {
  report = await createRecord(REPORT_FORM_ID, reportData)
  if (!report.id) throw new Error('ไม่พบ Result Report ID หลังบันทึก')
  if (trimmed(reportData.result_report_id) !== report.id) {
    await saveRecord(REPORT_FORM_ID, report.id, { result_report_id: report.id })
  }
} catch (error) {
  return failAfterReceipt('REPORT_SAVE_FAILED', 'บันทึก Result Report ไม่สำเร็จ: ' + trimmed(error.message || error), 'error', { order_status_id: statusId })
}

let createdItemCount = 0
let unchangedVersionItemCount = 0
const parentObjectId = app.dbObjectId(report.id)
const parentLabel = 'LAB ' + payload.filler_order_no + ' · HN ' + payload.hn + ' · VN ' + payload.visit_id
const orderedByCode = new Map()
for (const orderedItem of orderedItems) {
  const code = firstText([
    orderedItem && orderedItem.his_code_id,
    orderedItem && orderedItem.item_code,
    orderedItem && orderedItem.test_code,
    orderedItem && orderedItem.obs_code,
    orderedItem && orderedItem.code,
  ])
  if (code && !orderedByCode.has(code)) orderedByCode.set(code, orderedItem)
}

if (payload.overall_status !== 'cancelled') {
  for (let index = 0; index < matchedItems.length; index += 1) {
    const item = matchedItems[index]
    const previous = previousByObsCode.get(item.obs_code) || null
    const versionOrder = previous
      ? sequenceCompare(item.result_version, previous.result_version || '0')
      : 1
    if (previous && versionOrder === 0) unchangedVersionItemCount += 1

    const decision = criticalDecision(item)
    const history = previous ? parseHistory(previous.edit_history_json) : []
    if (previous && (versionOrder > 0 || trimmed(previous.result_value) !== item.value)) {
      history.push({
        source: 'agent',
        result_uid: payload.result_uid,
        result_version: item.result_version,
        changed_at: payload.reported_at,
        changed_by: payload.reported_by.source_name,
        old_value: text(previous.result_value),
        new_value: item.value,
        change_kind: item.change_kind,
      })
    }

    const orderedItem = orderedByCode.get(item.obs_code) || null
    const resultSequence = firstText([
      orderedItem && orderedItem.result_sequence,
      orderedItem && orderedItem.seq,
      previous && previous.result_sequence,
      String(index + 1),
    ])

    const rowData = {
      xparentx: parentObjectId,
      parent_id: {
        value: parentObjectId,
        label: parentLabel,
        filler_order_no: payload.filler_order_no,
        hn: payload.hn,
        visit_id: payload.visit_id,
        lab_section_name: reportData.lab_section_name,
        lab_section: reportData.lab_section,
        reported_at: payload.reported_at,
        reported_by_source_name: payload.reported_by.source_name,
        verified_by_source_name: payload.verified_by ? payload.verified_by.source_name : '',
      },
      result_report_id: report.id,
      result_definition_id: previous ? trimmed(previous.result_definition_id) : '',
      result_sequence: resultSequence,
      order_no: payload.order_no,
      filler_order_no: payload.filler_order_no,
      hn: payload.hn,
      visit_id: payload.visit_id,
      lab_section: reportData.lab_section,
      test_code: item.obs_code,
      obs_code: item.obs_code,
      obs_name: item.obs_name,
      test_name: item.obs_name,
      panel_code: item.panel_code || '',
      panel_name: item.panel_name || '',
      group_role: item.group_role || '',
      organism: item.organism || '',
      result_value: item.value,
      units: item.units || '',
      unit_symbol_snapshot: item.units || '',
      ref_range: item.ref_range || '',
      reference_range_snapshot: item.ref_range || '',
      interpretation_code: decision.interpretationCode,
      is_critical: decision.isCritical,
      result_source: 'agent',
      result_status: itemStatus(payload, item),
      result_uid: payload.result_uid,
      obx_status: item.obx_status,
      change_kind: item.change_kind,
      previous_value: item.previous_value != null
        ? item.previous_value
        : previous ? text(previous.result_value) : '',
      receipt_seq: item.receipt_seq,
      result_version: item.result_version,
      critical_low_rule: item.critical_low_rule || '',
      critical_high_rule: item.critical_high_rule || '',
      entered_by: previous ? trimmed(previous.entered_by) : payload.reported_by.source_name,
      entered_at: previous ? trimmed(previous.entered_at) : payload.reported_at,
      last_edited_by: previous && versionOrder > 0 ? payload.reported_by.source_name : '',
      last_edited_at: previous && versionOrder > 0 ? payload.reported_at : '',
      edit_history_json: JSON.stringify(history),
    }

    try {
      await createRecord(RESULT_ITEM_FORM_ID, rowData)
      createdItemCount += 1
    } catch (error) {
      return failAfterReceipt('ITEM_SAVE_FAILED', 'บันทึก ' + item.obs_code + ' ไม่สำเร็จ: ' + trimmed(error.message || error), 'error', {
        order_status_id: statusId,
        result_report_id: report.id,
        created_item_count: createdItemCount,
      })
    }
  }
}

let allReportItems = []
try {
  allReportItems = await queryRows(
    RESULT_ITEM_FORM_ID,
    { reportId: report.id },
    '`result_report_id` = :reportId AND `xrstatx` NOT IN (0,3)',
    [{ column: 'result_sequence', sort: 'ASC' }],
    2000
  )
  await saveRecord(REPORT_FORM_ID, report.id, {
    xparentx: workParentObjectId,
    result_report_id: report.id,
    item_count: allReportItems.length,
    critical_count: allReportItems.filter(row => row.is_critical === true).length,
    matched_item_count: matchedItems.length,
    unmatched_item_count: 0,
  })
} catch (error) {
  return failAfterReceipt('REPORT_COUNT_UPDATE_FAILED', 'อัปเดตจำนวนผลใน Report ไม่สำเร็จ: ' + trimmed(error.message || error), 'error', {
    order_status_id: statusId,
    result_report_id: report.id,
  })
}

const requestedWorkStatus = payload.overall_status === 'cancelled'
  ? 'cancelled'
  : payload.overall_status === 'resulted' || payload.overall_status === 'corrected'
    ? 'completed'
    : 'resulted'
const workStatusRank = { received: 1, processing: 2, resulted: 3, completed: 4, cancelled: 5 }
const nextWorkStatus = requestedWorkStatus !== 'cancelled' &&
  (workStatusRank[currentWorkStatus] || 0) > (workStatusRank[requestedWorkStatus] || 0)
  ? currentWorkStatus
  : requestedWorkStatus
try {
  const statusPatch = { work_status: nextWorkStatus }
  if (!trimmed(statusRow.resulted_at) && ['resulted', 'corrected'].includes(payload.overall_status)) {
    statusPatch.resulted_at = payload.verified_at || payload.reported_at
    statusPatch.resulted_by = payload.reported_by.source_name
  }
  await saveRecord(STATUS_FORM_ID, statusId, statusPatch)
} catch (error) {
  return failAfterReceipt('STATUS_SYNC_FAILED', 'เก็บผลแล้ว แต่ sync Work Status ไม่สำเร็จ: ' + trimmed(error.message || error), 'error', {
    order_status_id: statusId,
    result_report_id: report.id,
  })
}

const finalReceiptStatus = 'processed'
const warning = reportWarning
await updateReceipt({
  receipt_status: finalReceiptStatus,
  result_report_id: report.id,
  processed_at: isoThailand(),
  matched_item_count: matchedItems.length,
  unmatched_item_count: 0,
  error_message: warning,
})

return {
  success: true,
  created: true,
  duplicate: false,
  code: warning ? 'PROCESSED_WITH_WARNING' : 'PROCESSED',
  message: warning ? 'รับและบันทึกผล Lab สำเร็จ แต่ต้องตรวจ critical contract' : 'รับและบันทึกผล Lab สำเร็จ',
  data: {
    result_uid: payload.result_uid,
    receipt_id: receipt.id,
    receipt_status: finalReceiptStatus,
    result_report_id: report.id,
    order_status_id: statusId,
    report_key: reportKey,
    work_status: nextWorkStatus,
    matched_item_count: matchedItems.length,
    unmatched_item_count: 0,
    unmatched_obs_codes: [],
    missing_expected_obs_codes: missingExpectedCodes,
    created_item_count: createdItemCount,
    updated_item_count: 0,
    unchanged_version_item_count: unchangedVersionItemCount,
    report_item_count: allReportItems.length,
    critical_count: allReportItems.filter(row => row.is_critical === true).length,
    warnings: warning ? [warning] : [],
  },
}
