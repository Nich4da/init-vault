/*
 * initCraft API Factory Process
 * Name: LAB Agent Order Submit
 * Deployed Process ID: 6a9468c7422c1ca959829d6a
 * Process creation reported by the user on 2026-08-31; Agent configuration and live UAT are not yet verified.
 *
 * Purpose:
 * - Server-side transport boundary for the configured Agent order endpoint.
 * - Validate the canonical HIS -> Agent payload before any network call.
 * - Preserve Agent idempotency semantics: order_no is the retry key.
 * - Normalize HTTP/Agent responses for the receive orchestrator to persist.
 *
 * Input:
 * {
 *   payload: { ...his-to-agent-order.schema.json }
 * }
 *
 * Deployment configuration:
 * AGENT_ORDER_URL must be the complete endpoint, including /api/orders.
 * Replace the two placeholders below only in the protected API Factory process.
 * Never put the Agent key in SDForm/Vue code, query strings, or this repository.
 */

const AGENT_ORDER_URL = 'REPLACE_WITH_AGENT_ORDER_URL'
const AGENT_KEY = 'REPLACE_WITH_AGENT_KEY'
const MAX_BODY_BYTES = 1024 * 1024
const REQUEST_TIMEOUT_MS = 5000

const valueText = value => value == null ? '' : String(value)
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

const ROOT_REQUIRED = ['order_no', 'labno', 'hn', 'ordered_at', 'priority', 'items']
const ITEM_REQUIRED = [
  'seq',
  'test_code',
  'test_name',
  'specimen_code',
  'collected_at',
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
  ;['sex', 'visit_type'].forEach(key => {
    if (own(payload, key)) validateText(payload[key], 'payload.' + key, errors, { max: 50 })
  })
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

const normalizeAgentOrderUrl = value => {
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

const agentOrderUrl = normalizeAgentOrderUrl(AGENT_ORDER_URL)
if (!configured(AGENT_ORDER_URL) || !agentOrderUrl || !configured(AGENT_KEY)) {
  return {
    success: false,
    error: 'not_configured',
    retryable: false,
    hl7_status: 'new',
    message: 'ยังไม่ได้ตั้งค่า Agent URL/Key ใน API Factory ฝั่ง server'
  }
}

let response
try {
  response = await app.axios.post(agentOrderUrl, normalizedPayload, {
    timeout: REQUEST_TIMEOUT_MS,
    maxBodyLength: MAX_BODY_BYTES,
    maxContentLength: MAX_BODY_BYTES,
    headers: {
      'X-Agent-Key': AGENT_KEY,
      'Content-Type': 'application/json'
    },
    validateStatus: () => true
  })
} catch (error) {
  const status = Number(error && error.response && error.response.status || 0)
  const agentError = safeAgentError(error && error.response && error.response.data)
  return {
    success: false,
    error: status ? agentError.error : 'agent_unreachable',
    reason: agentError.reason,
    detail: agentError.detail,
    http_status: status || null,
    retryable: !status || status === 500 || status === 503,
    hl7_status: 'new',
    order_no: normalizedPayload.order_no,
    labno: normalizedPayload.labno,
    message: status
      ? 'Agent ปฏิเสธ Order (' + status + ')'
      : 'เชื่อมต่อ Agent ไม่สำเร็จ; เก็บสถานะรับ specimen ไว้และรอ reconcile'
  }
}

const status = Number(response && response.status || 0)
const data = response && response.data
const duplicateSuccess = status === 200 && isPlainObject(data) && data.ok === true && data.duplicate === true
const queuedSuccess = status === 202 && isPlainObject(data) && data.ok === true && data.duplicate === false

if (duplicateSuccess || queuedSuccess) {
  if (valueText(data.order_no) !== normalizedPayload.order_no) {
    return {
      success: false,
      error: 'invalid_agent_response',
      retryable: true,
      hl7_status: 'new',
      http_status: status,
      order_no: normalizedPayload.order_no,
      labno: normalizedPayload.labno,
      message: 'Agent ตอบ order_no ไม่ตรงกับ Order ที่ส่ง'
    }
  }
  return {
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
  }
}

if (status >= 200 && status < 300) {
  return {
    success: false,
    error: 'invalid_agent_response',
    retryable: true,
    hl7_status: 'new',
    http_status: status,
    order_no: normalizedPayload.order_no,
    labno: normalizedPayload.labno,
    message: 'Agent ตอบสำเร็จแต่รูปแบบ response ไม่ตรง contract; retry ด้วย order_no เดิมได้'
  }
}

const agentError = safeAgentError(data)
const retryable = status === 500 || status === 503
return {
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
}
