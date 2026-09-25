/*
 * initCraft API Factory Process
 * Name: LAB Agent Order Submit
 * Deployed Process ID: 6a9468c7422c1ca959829d6a
 * Agent URL/key and direct idempotent submit are verified. As of 2026-09-03,
 * the initCraft server-side route still times out and requires network diagnostics.
 *
 * Purpose:
 * - Server-side transport boundary for POST AGENT_URL.
 * - Validate the canonical HIS -> Agent payload before any network call.
 * - collected_at is optional; validate its Thai timestamp only when supplied.
 * - Preserve Agent idempotency semantics: order_no is the retry key.
 * - Direct/Gateway calls persist and audit zdata_lab_outband_order before transport.
 * - Receive orchestrator can opt out because it already owns the same audit transaction.
 *
 * Input:
 * {
 *   payload: { ...his-to-agent-order.schema.json }
 * }
 *
 * Deployment configuration:
 * AGENT_URL must be the complete endpoint, including /api/orders.
 * Replace the two placeholders below only in the protected API Factory process.
 * Never put the Agent key in SDForm/Vue code, query strings, or this repository.
 */

const AGENT_URL = '__CONFIGURE_AGENT_URL__'
const AGENT_KEY = '__CONFIGURE_AGENT_KEY__'
const OUTBOUND_COLLECTION = 'zdata_lab_outband_order'
const MAX_BODY_BYTES = 1024 * 1024
const REQUEST_TIMEOUT_MS = 5000

const valueText = value => value == null ? '' : String(value)
const text = value => valueText(value).trim()
const lower = value => text(value).toLowerCase()
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key)
const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const thaiDateTimePattern = /^(?:\d{14}|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+07:00)$/
const birthDatePattern = /^\d{8}(?:\d{6})?$/

const utf8ByteLength = text => {
  let bytes = 0
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    if (code < 0x80) {
      bytes += 1
    } else if (code < 0x800) {
      bytes += 2
    } else if (code >= 0xD800 && code <= 0xDBFF && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1)
      if (next >= 0xDC00 && next <= 0xDFFF) {
        bytes += 4
        index += 1
      } else {
        bytes += 3
      }
    } else {
      bytes += 3
    }
  }
  return bytes
}

const ROOT_KEYS = [
  'order_no',
  'labno',
  'hn',
  'visit_id',
  'ordered_at',
  'requested_at',
  'priority',
  'note',
  'patient_prefix',
  'patient_first_name',
  'patient_last_name',
  'birth_date',
  'sex',
  'visit_type',
  'doctor_code',
  'doctor_title',
  'doctor_name',
  'clinic_code',
  'clinic_name',
  'station',
  'station_seq',
  'special_request',
  'diagnosis',
  'antimicrobial_used',
  'underlying_disease',
  'mongo_form_id',
  'mongo_data_id',
  'items'
]

const ITEM_KEYS = [
  'seq',
  'test_code',
  'test_name',
  'specimen_code',
  'specimen_name',
  'collector_code',
  'collector_name',
  'lab_code',
  'collected_at',
  'received_at',
  'receiver'
]

const ROOT_REQUIRED = ['order_no', 'labno', 'hn', 'ordered_at', 'priority', 'sex', 'items']
const ITEM_REQUIRED = [
  'seq',
  'test_code',
  'test_name',
  'specimen_code',
  'received_at',
  'receiver'
]

const rootLookup = Object.fromEntries(ROOT_KEYS.map(key => [key, true]))
const itemLookup = Object.fromEntries(ITEM_KEYS.map(key => [key, true]))

const validateText = (value, path, errors, options) => {
  const settings = options || {}
  if (value === null && settings.nullable) return
  if (typeof value !== 'string') {
    errors.push(path + ' ต้องเป็น string')
    return
  }
  if (settings.required && value.length === 0) errors.push(path + ' ห้ามเป็นค่าว่าง')
  if (settings.max && value.length > settings.max) {
    errors.push(path + ' ยาวเกิน ' + settings.max + ' ตัวอักษร')
  }
}

const validatePayload = payload => {
  const errors = []
  if (!isPlainObject(payload)) {
    return ['payload ต้องเป็น JSON object']
  }

  Object.keys(payload).forEach(key => {
    if (!rootLookup[key]) errors.push('ไม่รองรับ field payload.' + key)
  })
  ROOT_REQUIRED.forEach(key => {
    if (!own(payload, key)) errors.push('payload.' + key + ' เป็น field บังคับ')
  })

  ;['order_no', 'labno', 'hn'].forEach(key => {
    if (own(payload, key)) validateText(payload[key], 'payload.' + key, errors, { required: true, max: 100 })
  })
  ;['visit_id', 'patient_prefix', 'doctor_code', 'doctor_title', 'clinic_code', 'station_seq',
    'mongo_form_id', 'mongo_data_id'].forEach(key => {
    if (own(payload, key)) validateText(payload[key], 'payload.' + key, errors, { max: 100 })
  })
  ;['patient_first_name', 'patient_last_name', 'station'].forEach(key => {
    if (own(payload, key)) validateText(payload[key], 'payload.' + key, errors, { max: 200 })
  })
  ;['doctor_name', 'clinic_name'].forEach(key => {
    if (own(payload, key)) validateText(payload[key], 'payload.' + key, errors, { max: 300 })
  })
  if (own(payload, 'sex') && !['M', 'F'].includes(payload.sex)) {
    errors.push('payload.sex ต้องเป็น M หรือ F')
  }
  if (own(payload, 'visit_type')) validateText(payload.visit_type, 'payload.visit_type', errors, { max: 50 })
  ;['special_request', 'diagnosis', 'antimicrobial_used', 'underlying_disease'].forEach(key => {
    if (own(payload, key)) validateText(payload[key], 'payload.' + key, errors, {})
  })
  if (own(payload, 'note')) validateText(payload.note, 'payload.note', errors, { nullable: true })

  ;['ordered_at', 'requested_at'].forEach(key => {
    if (!own(payload, key)) return
    validateText(payload[key], 'payload.' + key, errors, { required: key === 'ordered_at' })
    if (typeof payload[key] === 'string' && !thaiDateTimePattern.test(payload[key])) {
      errors.push('payload.' + key + ' ต้องเป็นเวลาไทย YYYYMMDDHHmmss หรือ ISO +07:00')
    }
  })
  if (own(payload, 'birth_date')) {
    validateText(payload.birth_date, 'payload.birth_date', errors, {})
    if (typeof payload.birth_date === 'string' && !birthDatePattern.test(payload.birth_date)) {
      errors.push('payload.birth_date ต้องเป็น YYYYMMDD หรือ YYYYMMDDHHmmss')
    }
  }
  if (own(payload, 'priority')) {
    validateText(payload.priority, 'payload.priority', errors, { required: true })
    if (!['S', 'A', 'R'].includes(payload.priority)) {
      errors.push('payload.priority ต้องเป็น S, A หรือ R')
    }
  }

  if (own(payload, 'items')) {
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      errors.push('payload.items ต้องเป็น array ที่มีอย่างน้อย 1 รายการ')
    } else {
      const sequenceLookup = {}
      payload.items.forEach((item, index) => {
        const path = 'payload.items[' + index + ']'
        if (!isPlainObject(item)) {
          errors.push(path + ' ต้องเป็น JSON object')
          return
        }
        Object.keys(item).forEach(key => {
          if (!itemLookup[key]) errors.push('ไม่รองรับ field ' + path + '.' + key)
        })
        ITEM_REQUIRED.forEach(key => {
          if (!own(item, key)) errors.push(path + '.' + key + ' เป็น field บังคับ')
        })
        if (own(item, 'seq')) {
          if (!Number.isInteger(item.seq) || item.seq < 1) {
            errors.push(path + '.seq ต้องเป็นจำนวนเต็มตั้งแต่ 1')
          } else if (sequenceLookup[item.seq]) {
            errors.push(path + '.seq ซ้ำใน Order เดียวกัน')
          } else {
            sequenceLookup[item.seq] = true
          }
        }
        ;['test_code', 'specimen_code', 'receiver'].forEach(key => {
          if (own(item, key)) validateText(item[key], path + '.' + key, errors, { required: true, max: 100 })
        })
        ;['test_name', 'specimen_name', 'collector_name'].forEach(key => {
          if (own(item, key)) validateText(item[key], path + '.' + key, errors, {
            required: key === 'test_name',
            max: 300
          })
        })
        ;['collector_code', 'lab_code'].forEach(key => {
          if (own(item, key)) validateText(item[key], path + '.' + key, errors, { max: 100 })
        })
        ;['collected_at', 'received_at'].forEach(key => {
          if (!own(item, key)) return
          validateText(item[key], path + '.' + key, errors, { required: true })
          if (typeof item[key] === 'string' && !thaiDateTimePattern.test(item[key])) {
            errors.push(path + '.' + key + ' ต้องเป็นเวลาไทย YYYYMMDDHHmmss หรือ ISO +07:00')
          }
        })
      })
    }
  }
  return errors
}

const normalizePayload = payload => {
  const normalized = {}
  ROOT_KEYS.forEach(key => {
    if (key === 'items' || !own(payload, key)) return
    normalized[key] = payload[key]
  })
  normalized.items = payload.items.map(item => {
    const normalizedItem = {}
    ITEM_KEYS.forEach(key => {
      if (own(item, key)) normalizedItem[key] = item[key]
    })
    return normalizedItem
  })
  return normalized
}

const configured = value => {
  const text = valueText(value).trim()
  return Boolean(text) && !/^__CONFIGURE_/.test(text)
}

const normalizeAgentUrl = value => {
  const text = valueText(value).trim().replace(/\/+$/, '')
  if (!/^https?:\/\/[^\s/?#]+(?::\d+)?(?:\/[^\s?#]*)?$/.test(text)) return ''
  if (/^https?:\/\/[^/]*@/i.test(text)) return ''
  return text
}

const safeAgentError = data => {
  if (!isPlainObject(data)) return { error: 'internal', reason: 'Agent ตอบกลับไม่เป็น JSON object' }
  return {
    error: valueText(data.error || 'internal').trim() || 'internal',
    reason: valueText(data.reason || data.message).trim(),
    detail: data.detail == null ? null : data.detail
  }
}

const safeNetworkError = (error, agentUrl, agentKey) => {
  const rawCode = valueText(
    error && (error.code || (error.cause && error.cause.code))
  ).trim()
  const code = rawCode.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 100) || 'NETWORK_ERROR'
  let message = valueText(error && error.message).trim()
  ;[agentKey, agentUrl].filter(Boolean).forEach(secret => {
    message = message.split(secret).join('[redacted]')
  })
  message = message
    .replace(/https?:\/\/[^\s]+/gi, '[redacted-url]')
    .replace(/\b(?:10(?:\.\d{1,3}){3}|127(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?::\d+)?\b/g, '[redacted-host]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 500)
  return {
    code,
    message: message || 'Agent network request failed'
  }
}

const jsonArray = value => {
  try {
    const parsed = JSON.parse(text(value))
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}

if (!app.isAuth(userInfo.roles || [])) {
  return { success: false, message: 'ไม่มีสิทธิ์ส่ง LAB Order ไป Agent' }
}

const payload = params && params.payload
const validationErrors = validatePayload(payload)
if (validationErrors.length) {
  return {
    success: false,
    error: 'invalid_payload',
    retryable: false,
    hl7_status: 'new',
    errors: validationErrors,
    message: 'ข้อมูล Order ไม่ตรง HIS-Agent contract'
  }
}

const normalizedPayload = normalizePayload(payload)
const body = JSON.stringify(normalizedPayload)
const bodyBytes = utf8ByteLength(body)

if (bodyBytes > MAX_BODY_BYTES) {
  return {
    success: false,
    error: 'payload_too_large',
    retryable: false,
    hl7_status: 'new',
    body_bytes: bodyBytes,
    message: 'ข้อมูล Order เกินขนาด 1 MB'
  }
}

const agentUrl = normalizeAgentUrl(AGENT_URL)
if (!configured(AGENT_URL) || !agentUrl || !configured(AGENT_KEY)) {
  return {
    success: false,
    error: 'not_configured',
    retryable: false,
    hl7_status: 'new',
    message: 'ยังไม่ได้ตั้งค่า Agent URL/Key ใน API Factory ฝั่ง server'
  }
}

// Public/Gateway contract is { payload }. The Receive orchestrator passes the
// internal flag because it already created, claimed, and will finalize this audit.
const manageOutboundAudit = !(params && params.audit_managed_by_receive === true)
const actorCode = text(
  userInfo.employee_code || userInfo.username ||
  userInfo.account && (userInfo.account.code || userInfo.account.name)
) || 'external-api'
const now = typeof app.curDate === 'function'
  ? text(app.curDate('YYYY-MM-DD HH:mm:ss'))
  : new Date().toISOString()
let outboundAudit = null

const outboundFailure = (error, code) => ({
  success: false,
  error: code || 'outbound_persistence_failed',
  retryable: true,
  hl7_status: 'new',
  order_no: normalizedPayload.order_no,
  labno: normalizedPayload.labno,
  reason: error ? 'outbound_write_failed' : '',
  message: 'บันทึก Outbound Order ไม่สำเร็จ; ยังไม่ส่งข้อมูลไป Agent'
})

const alreadyPersistedResult = row => ({
  success: true,
  data: {
    http_status: Number(row.agent_http_status || 0) || null,
    hl7_status: lower(row.hl7_status) || 'queued',
    order_no: normalizedPayload.order_no,
    labno: normalizedPayload.labno,
    duplicate: Boolean(row.agent_duplicate),
    order_ref: text(row.order_ref) || null,
    routed_to: jsonArray(row.routed_to_json).map(valueText),
    dispatch_id: text(row.dispatch_id) || null,
    outbound_order_id: text(row._id),
    attempt_count: Number(row.attempt_count || 0)
  },
  message: 'Outbound Order นี้ส่ง Agent แล้ว'
})

const beginOutboundAudit = async () => {
  if (!app.db || typeof app.db.collection !== 'function') {
    throw new Error('initCraft database API is unavailable')
  }
  const collection = app.db.collection(OUTBOUND_COLLECTION)
  if (!collection) throw new Error('Outbound collection is unavailable')

  let row = await collection.findOne({ order_no: normalizedPayload.order_no, xrstatx: 1 })
  if (!row) {
    const idCandidate = text(normalizedPayload.mongo_data_id || normalizedPayload.order_no)
    let outboundId = null
    if (/^[a-f0-9]{24}$/i.test(idCandidate) && typeof app.dbObjectId === 'function') {
      try {
        outboundId = app.dbObjectId(idCandidate)
      } catch (error) {
        outboundId = null
      }
    }
    const firstItem = normalizedPayload.items[0] || {}
    const document = {
      ...(outboundId ? { _id: outboundId, xparentx: outboundId } : {}),
      xsitex: userInfo.site || {},
      xunitx: { code: text(firstItem.lab_code), name: text(firstItem.lab_code) },
      xrstatx: 1,
      xversionx: 'v1',
      xerrorx: null,
      dataid: text(normalizedPayload.mongo_data_id || normalizedPayload.order_no),
      work_item_id: normalizedPayload.order_no,
      source_cpoe_order_id: '',
      source_cpoe_item_id: text(normalizedPayload.mongo_data_id),
      order_no: normalizedPayload.order_no,
      lab_no: normalizedPayload.labno,
      section_code: text(firstItem.lab_code),
      patient_hn: normalizedPayload.hn,
      visit_id: text(normalizedPayload.visit_id),
      item_count: normalizedPayload.items.length,
      hl7_status: 'new',
      transport_channel: 'agent_http',
      schema_version: '1.0',
      dispatch_id: '',
      order_ref: '',
      routed_to_json: '[]',
      agent_http_status: null,
      agent_duplicate: false,
      retryable: true,
      attempt_count: 0,
      first_attempt_at: '',
      last_attempt_at: '',
      next_retry_at: '',
      queued_at: '',
      sent_at: '',
      last_success_at: '',
      last_status_at: now,
      created_by: actorCode,
      updated_by: actorCode,
      created_at: now,
      updated_at: now,
      last_error_code: '',
      last_error_at: '',
      last_error_http_status: '',
      last_error_reason: '',
      last_error_detail_json: '',
      request_payload_hash: '',
      response_payload_hash: '',
      request_payload_json: body,
      response_payload_json: '',
      attempt_history_json: '[]'
    }
    try {
      const inserted = await collection.insertOne(document)
      row = { ...document, _id: document._id || inserted && inserted.insertedId }
    } catch (error) {
      row = await collection.findOne({ order_no: normalizedPayload.order_no, xrstatx: 1 })
      if (!row) throw error
    }
  }

  const currentStatus = lower(row.hl7_status)
  if (['queued', 'sent', 'in_progress', 'resulted'].includes(currentStatus)) {
    return { result: alreadyPersistedResult(row) }
  }
  if (currentStatus === 'sending') {
    return { result: {
      success: false,
      error: 'dispatch_in_progress',
      retryable: true,
      hl7_status: 'sending',
      order_no: normalizedPayload.order_no,
      labno: normalizedPayload.labno,
      outbound_order_id: text(row._id),
      attempt_count: Number(row.attempt_count || 0),
      message: 'Outbound Order นี้กำลังถูกส่งโดยคำขออื่น'
    } }
  }

  const previousAttempts = Number(row.attempt_count || 0)
  const attemptNumber = previousAttempts + 1
  const claimed = await collection.updateOne(
    {
      _id: row._id,
      xrstatx: 1,
      hl7_status: { $in: ['', 'new', null] },
      attempt_count: previousAttempts
    },
    { $set: {
      request_payload_json: body,
      xparentx: row.xparentx || row._id,
      hl7_status: 'sending',
      attempt_count: attemptNumber,
      first_attempt_at: text(row.first_attempt_at) || now,
      last_attempt_at: now,
      last_status_at: now,
      updated_at: now,
      updated_by: actorCode
    } }
  )
  if (!claimed || Number(claimed.matchedCount) !== 1) {
    const raced = await collection.findOne({ order_no: normalizedPayload.order_no, xrstatx: 1 })
    if (raced && ['queued', 'sent', 'in_progress', 'resulted'].includes(lower(raced.hl7_status))) {
      return { result: alreadyPersistedResult(raced) }
    }
    return { result: {
      success: false,
      error: 'dispatch_in_progress',
      retryable: true,
      hl7_status: lower(raced && raced.hl7_status) || 'sending',
      order_no: normalizedPayload.order_no,
      labno: normalizedPayload.labno,
      outbound_order_id: text(raced && raced._id || row._id),
      attempt_count: Number(raced && raced.attempt_count || previousAttempts),
      message: 'Outbound Order นี้กำลังถูกส่งโดยคำขออื่น'
    } }
  }

  return { collection, row, attemptNumber }
}

const finalizeOutboundAudit = async result => {
  if (!outboundAudit) return result
  const data = result && result.data && typeof result.data === 'object' ? result.data : {}
  const sendSuccess = Boolean(result && result.success === true)
  const httpStatus = Number(data.http_status || result && result.http_status || 0) || null
  const duplicate = Boolean(data.duplicate)
  const nextStatus = sendSuccess ? (lower(data.hl7_status) || 'queued') : 'new'
  const errorCode = sendSuccess ? '' : text(result && result.error) || 'agent_submit_failed'
  const errorReason = sendSuccess ? '' : text(result && (result.reason || result.message)) || 'ส่ง Agent ไม่สำเร็จ'
  const detail = result && result.detail != null ? result.detail : null
  const history = jsonArray(outboundAudit.row.attempt_history_json)
  history.push({
    attempt: outboundAudit.attemptNumber,
    attempted_at: now,
    success: sendSuccess,
    hl7_status: nextStatus,
    http_status: httpStatus,
    duplicate,
    error: errorCode,
    message: text(result && result.message)
  })

  let saved
  try {
    saved = await outboundAudit.collection.updateOne(
      {
        _id: outboundAudit.row._id,
        xrstatx: 1,
        hl7_status: 'sending',
        attempt_count: outboundAudit.attemptNumber
      },
      { $set: {
        hl7_status: nextStatus,
        dispatch_id: sendSuccess ? text(data.dispatch_id) : text(outboundAudit.row.dispatch_id),
        order_ref: sendSuccess ? text(data.order_ref) : text(outboundAudit.row.order_ref),
        routed_to_json: sendSuccess && Array.isArray(data.routed_to)
          ? JSON.stringify(data.routed_to.map(valueText))
          : text(outboundAudit.row.routed_to_json) || '[]',
        agent_http_status: httpStatus,
        agent_duplicate: duplicate,
        retryable: sendSuccess ? false : Boolean(result && result.retryable),
        queued_at: sendSuccess ? (text(outboundAudit.row.queued_at) || now) : text(outboundAudit.row.queued_at),
        last_success_at: sendSuccess ? now : text(outboundAudit.row.last_success_at),
        last_status_at: now,
        updated_at: now,
        updated_by: actorCode,
        last_error_code: errorCode,
        last_error_at: sendSuccess ? '' : now,
        last_error_http_status: sendSuccess ? '' : (httpStatus || ''),
        last_error_reason: errorReason,
        last_error_detail_json: sendSuccess || detail == null ? '' : JSON.stringify(detail),
        response_payload_json: JSON.stringify(result || {}),
        attempt_history_json: JSON.stringify(history.slice(-50))
      } }
    )
  } catch (error) {
    saved = null
  }
  if (!saved || Number(saved.matchedCount) !== 1) {
    return {
      success: false,
      error: 'outbound_audit_failed',
      retryable: true,
      hl7_status: 'sending',
      order_no: normalizedPayload.order_no,
      labno: normalizedPayload.labno,
      outbound_order_id: text(outboundAudit.row._id),
      attempt_count: outboundAudit.attemptNumber,
      agent_accepted: sendSuccess,
      message: 'Agent อาจรับ Order แล้ว แต่บันทึกผลลง Outbound audit ไม่สำเร็จ; retry ด้วย order_no เดิมได้'
    }
  }

  if (sendSuccess) {
    return {
      ...result,
      data: {
        ...data,
        outbound_order_id: text(outboundAudit.row._id),
        attempt_count: outboundAudit.attemptNumber
      }
    }
  }
  return {
    ...result,
    outbound_order_id: text(outboundAudit.row._id),
    attempt_count: outboundAudit.attemptNumber
  }
}

if (manageOutboundAudit) {
  try {
    const prepared = await beginOutboundAudit()
    if (prepared.result) return prepared.result
    outboundAudit = prepared
  } catch (error) {
    return outboundFailure(error)
  }
}

let response
try {
  response = await app.axios.post(agentUrl, normalizedPayload, {
    timeout: REQUEST_TIMEOUT_MS,
    maxBodyLength: MAX_BODY_BYTES,
    maxContentLength: MAX_BODY_BYTES,
    headers: {
      'X-Agent-Key': AGENT_KEY,
      'Content-Type': 'application/json'
    }
  })
} catch (error) {
  const status = Number(error && error.response && error.response.status || 0)
  const agentError = safeAgentError(error && error.response && error.response.data)
  const networkError = safeNetworkError(error, agentUrl, AGENT_KEY)
  return await finalizeOutboundAudit({
    success: false,
    error: status ? agentError.error : 'agent_unreachable',
    reason: status ? agentError.reason : networkError.message,
    detail: status ? agentError.detail : {
      code: networkError.code,
      message: networkError.message,
      timeout_ms: REQUEST_TIMEOUT_MS
    },
    network_code: status ? '' : networkError.code,
    network_message: status ? '' : networkError.message,
    http_status: status || null,
    retryable: !status || status === 500 || status === 503,
    hl7_status: 'new',
    order_no: normalizedPayload.order_no,
    labno: normalizedPayload.labno,
    message: status
      ? 'Agent ปฏิเสธ Order (' + status + ')'
      : 'เชื่อมต่อ Agent ไม่สำเร็จ; เก็บสถานะรับ specimen ไว้และรอ reconcile'
  })
}

const status = Number(response && response.status || 0)
const data = response && response.data
const duplicateSuccess = status === 200 && isPlainObject(data) && data.ok === true && data.duplicate === true
const queuedSuccess = status === 202 && isPlainObject(data) && data.ok === true && data.duplicate === false

if (duplicateSuccess || queuedSuccess) {
  if (valueText(data.order_no) !== normalizedPayload.order_no) {
    return await finalizeOutboundAudit({
      success: false,
      error: 'invalid_agent_response',
      retryable: true,
      hl7_status: 'new',
      http_status: status,
      order_no: normalizedPayload.order_no,
      labno: normalizedPayload.labno,
      message: 'Agent ตอบ order_no ไม่ตรงกับ Order ที่ส่ง'
    })
  }
  return await finalizeOutboundAudit({
    success: true,
    data: {
      http_status: status,
      hl7_status: 'queued',
      order_no: normalizedPayload.order_no,
      labno: normalizedPayload.labno,
      duplicate: Boolean(data.duplicate),
      order_ref: data.order_ref == null ? null : valueText(data.order_ref),
      routed_to: Array.isArray(data.routed_to) ? data.routed_to.map(valueText) : [],
      dispatch_id: data.dispatch_id == null ? null : valueText(data.dispatch_id)
    },
    message: duplicateSuccess ? 'Agent มี Order นี้แล้ว; ถือว่าส่งสำเร็จ' : 'Agent รับ Order เข้าคิวแล้ว'
  })
}

if (status >= 200 && status < 300) {
  return await finalizeOutboundAudit({
    success: false,
    error: 'invalid_agent_response',
    retryable: true,
    hl7_status: 'new',
    http_status: status,
    order_no: normalizedPayload.order_no,
    labno: normalizedPayload.labno,
    message: 'Agent ตอบสำเร็จแต่รูปแบบ response ไม่ตรง contract; retry ด้วย order_no เดิมได้'
  })
}

const agentError = safeAgentError(data)
const retryable = status === 500 || status === 503
return await finalizeOutboundAudit({
  success: false,
  error: agentError.error,
  reason: agentError.reason,
  detail: agentError.detail,
  http_status: status || null,
  retryable,
  hl7_status: 'new',
  order_no: normalizedPayload.order_no,
  labno: normalizedPayload.labno,
  message: status === 401 || status === 403
    ? 'Agent ไม่ยอมรับ credential; หยุดส่งและแจ้งผู้ดูแล'
    : status === 422
      ? 'Agent ปฏิเสธ mapping/Order; ต้องแก้ข้อมูลก่อนส่งใหม่'
      : retryable
        ? 'Agent ยังไม่พร้อม; เก็บ Order ไว้รอ retry/reconcile'
        : 'Agent ปฏิเสธ Order (' + (status || 'unknown') + ')'
})
