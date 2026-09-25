#!/usr/bin/env node
'use strict'

/*
 * LAB / X-ray integration auto-diagnostic runner.
 *
 * Safe defaults:
 * - dry-run unless --send is present;
 * - --smoke sends an intentionally invalid, no-write payload;
 * - valid payloads require both --send and --confirm-write;
 * - secrets are read from environment variables only;
 * - reports redact PHI, credentials, query strings, and raw payloads.
 *
 * Run `node integration_autodiag.js --help` for usage.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const THAI_TS = /^(?:\d{14}|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+07:00)$/
const ISO_THAI_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+07:00$/
const OBJECT_ID = /^[a-f0-9]{24}$/i

const PROFILE_NAMES = [
  'lab-order',
  'lab-agent',
  'lab-result',
  'xray-dispatch',
  'xray-order',
  'xray-result',
]

const GROUPS = {
  lab: ['lab-order', 'lab-result'],
  xray: ['xray-dispatch', 'xray-result'],
  all: PROFILE_NAMES,
}

const PROFILES = {
  'lab-order': {
    label: 'LAB order · HIS Gateway/Process (lis.submit)',
    urlEnv: 'LAB_ORDER_URL',
    secretEnv: 'LAB_ORDER_API_KEY',
    headerEnv: 'LAB_ORDER_HEADER',
    defaultHeader: 'x-api-key',
    auth: 'api-key',
    envelope: payload => ({ params: { payload } }),
    validator: validateLabOrder,
    response: classifyLabOrderProcess,
    evidence: analyzeLabOrderEvidence,
  },
  'lab-agent': {
    label: 'LAB order · direct Agent isolation probe',
    urlEnv: 'LAB_AGENT_URL',
    secretEnv: 'LAB_AGENT_KEY',
    defaultHeader: 'X-Agent-Key',
    auth: 'api-key',
    envelope: payload => payload,
    validator: validateLabOrder,
    response: classifyLabAgent,
    evidence: analyzeLabOrderEvidence,
  },
  'lab-result': {
    label: 'LAB result · HIS External API (lis.receive)',
    urlEnv: 'LAB_RESULT_URL',
    secretEnv: 'LAB_RESULT_API_KEY',
    headerEnv: 'LAB_RESULT_HEADER',
    defaultHeader: 'x-api-key',
    auth: 'api-key',
    envelope: payload => ({ params: payload }),
    validator: validateLabResult,
    response: classifyLabResult,
    evidence: analyzeLabResultEvidence,
  },
  'xray-dispatch': {
    label: 'X-ray order · CPOE dispatch Process',
    urlEnv: 'XRAY_DISPATCH_URL',
    secretEnv: 'XRAY_DISPATCH_TOKEN',
    auth: 'bearer',
    envelope: payload => ({ params: payload }),
    validator: validateXrayDispatch,
    response: classifyXrayDispatch,
    evidence: analyzeXrayOrderEvidence,
  },
  'xray-order': {
    label: 'X-ray order · RIS bridge Process isolation probe',
    urlEnv: 'XRAY_ORDER_URL',
    secretEnv: 'XRAY_ORDER_TOKEN',
    auth: 'bearer-query',
    envelope: payload => ({ params: payload }),
    validator: validateXrayOrder,
    response: classifyXrayAck,
    evidence: analyzeXrayOrderEvidence,
  },
  'xray-result': {
    label: 'X-ray result · RIS callback Process',
    urlEnv: 'XRAY_RESULT_URL',
    secretEnv: 'XRAY_RESULT_TOKEN',
    auth: 'bearer-query',
    envelope: payload => ({ params: payload }),
    validator: validateXrayResult,
    response: classifyXrayAck,
    evidence: analyzeXrayResultEvidence,
  },
}

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key)
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function text(value) {
  return value == null ? '' : String(value).trim()
}

function fingerprint(value) {
  const normalized = text(value)
  if (!normalized) return ''
  return 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 12)
}

function check(level, code, message, detail) {
  return { level, code, message, ...(detail === undefined ? {} : { detail }) }
}

function requireFields(payload, fields, prefix = 'payload') {
  const errors = []
  for (const name of fields) {
    if (!own(payload, name) || text(payload[name]) === '') {
      errors.push(`${prefix}.${name} เป็น field บังคับ`)
    }
  }
  return errors
}

function validateLabOrder(payload) {
  if (!isObject(payload)) return ['payload ต้องเป็น JSON object']
  const errors = requireFields(payload, ['order_no', 'labno', 'hn', 'ordered_at', 'priority', 'sex'])
  if (!['S', 'A', 'R'].includes(payload.priority)) errors.push('payload.priority ต้องเป็น S, A หรือ R')
  if (!['M', 'F'].includes(payload.sex)) errors.push('payload.sex ต้องเป็น M หรือ F')
  for (const field of ['ordered_at', 'requested_at']) {
    if (own(payload, field) && !THAI_TS.test(text(payload[field]))) {
      errors.push(`payload.${field} ต้องเป็นเวลาไทย YYYYMMDDHHmmss หรือ ISO +07:00`)
    }
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    errors.push('payload.items ต้องเป็น array ที่มีอย่างน้อย 1 รายการ')
    return errors
  }
  const seen = new Set()
  payload.items.forEach((item, index) => {
    const prefix = `payload.items[${index}]`
    if (!isObject(item)) {
      errors.push(`${prefix} ต้องเป็น JSON object`)
      return
    }
    errors.push(...requireFields(item, ['seq', 'test_code', 'test_name', 'specimen_code', 'received_at', 'receiver'], prefix))
    if (!Number.isInteger(item.seq) || item.seq < 1) errors.push(`${prefix}.seq ต้องเป็นจำนวนเต็มตั้งแต่ 1`)
    if (seen.has(item.seq)) errors.push(`${prefix}.seq ซ้ำใน Order เดียวกัน`)
    seen.add(item.seq)
    for (const field of ['collected_at', 'received_at']) {
      if (own(item, field) && !THAI_TS.test(text(item[field]))) {
        errors.push(`${prefix}.${field} ต้องเป็นเวลาไทยและห้ามเป็น null`)
      }
    }
  })
  return errors
}

function validateLabResult(payload) {
  if (!isObject(payload)) return ['payload ต้องเป็น JSON object']
  const errors = requireFields(payload, [
    'order_no', 'hn', 'visit_id', 'result_uid', 'report_seq', 'stage',
    'overall_status', 'reported_at', 'reported_by',
  ])
  const labNos = ['filler_order_no', 'labno', 'lab_no'].filter(name => text(payload[name]))
  if (!labNos.length) errors.push('payload ต้องมี filler_order_no, labno หรือ lab_no อย่างน้อยหนึ่งค่า')
  if (new Set(labNos.map(name => text(payload[name]))).size > 1) errors.push('LAB NO. aliases ต้องมีค่าเดียวกัน')
  if (!['partial', 'preliminary', 'final', 'corrected', 'cancelled'].includes(payload.stage)) {
    errors.push('payload.stage ไม่อยู่ใน contract')
  }
  if (!['in_progress', 'resulted', 'corrected', 'cancelled'].includes(payload.overall_status)) {
    errors.push('payload.overall_status ไม่อยู่ใน contract')
  }
  if (!ISO_THAI_TS.test(text(payload.reported_at))) errors.push('payload.reported_at ต้องเป็น ISO +07:00')
  if (payload.overall_status === 'resulted') {
    errors.push(...requireFields(payload, ['verified_at', 'verified_by']))
  }
  for (const identityField of ['reported_by', 'verified_by']) {
    if (!own(payload, identityField)) continue
    if (!isObject(payload[identityField])) errors.push(`payload.${identityField} ต้องเป็น object`)
    else errors.push(...requireFields(payload[identityField], ['source_id', 'source_name'], `payload.${identityField}`))
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    errors.push('payload.items ต้องเป็น array ที่มีอย่างน้อย 1 รายการ')
  } else {
    payload.items.forEach((item, index) => {
      const prefix = `payload.items[${index}]`
      if (!isObject(item)) return errors.push(`${prefix} ต้องเป็น JSON object`)
      errors.push(...requireFields(item, [
        'obs_code', 'obs_name', 'value', 'obx_status', 'change_kind', 'receipt_seq', 'result_version',
      ], prefix))
      if (own(item, 'is_critical') && typeof item.is_critical !== 'boolean') {
        errors.push(`${prefix}.is_critical ต้องเป็น boolean`)
      }
      if ((item.critical_low_rule || item.critical_high_rule) && !own(item, 'is_critical')) {
        errors.push(`${prefix} มี critical rule แต่ไม่มี explicit is_critical`)
      }
    })
  }
  return errors
}

function validateXrayDispatch(payload) {
  if (!isObject(payload)) return ['payload ต้องเป็น JSON object']
  const errors = []
  if (!OBJECT_ID.test(text(payload.order_id))) errors.push('payload.order_id ต้องเป็น ObjectId 24 ตัว')
  const ids = Array.isArray(payload.item_ids) ? payload.item_ids : (payload.item_id ? [payload.item_id] : [])
  if (!ids.length || ids.some(value => !OBJECT_ID.test(text(value)))) {
    errors.push('payload.item_ids ต้องมี ObjectId 24 ตัวอย่างน้อย 1 ค่า')
  }
  if (ids.length > 50) errors.push('payload.item_ids รองรับไม่เกิน 50 รายการ')
  return errors
}

function validateXrayOrder(payload) {
  if (!isObject(payload)) return ['payload ต้องเป็น JSON object']
  const errors = requireFields(payload, [
    'Hn', 'PatientFName', 'PatientGender', 'PatientDob', 'PatientClassUid',
    'VisitNo', 'AccessionNo', 'ExamUid', 'ExamName',
  ])
  if (!['M', 'F', 'U'].includes(payload.PatientGender)) errors.push('payload.PatientGender ต้องเป็น M, F หรือ U')
  if (!['O', 'I', 'E'].includes(payload.PatientClassUid)) errors.push('payload.PatientClassUid ต้องเป็น O, I หรือ E')
  if (text(payload.AccessionNo).length > 16) errors.push('payload.AccessionNo ยาวเกิน 16 ตัวอักษร')
  if (own(payload, 'Priority') && !['R', 'S', 'U'].includes(payload.Priority)) errors.push('payload.Priority ต้องเป็น R, S หรือ U')
  return errors
}

function validateXrayResult(payload) {
  if (!isObject(payload)) return ['payload ต้องเป็น JSON object']
  const errors = requireFields(payload, [
    'Hn', 'AccessionNo', 'ExamUid', 'ExamName', 'RadiologistUid', 'ResultText', 'ResultDateTime',
  ])
  if (text(payload.AccessionNo).length > 16) errors.push('payload.AccessionNo ยาวเกิน 16 ตัวอักษร')
  return errors
}

function innerData(responseData) {
  if (isObject(responseData) && isObject(responseData.data)) return responseData.data
  return isObject(responseData) ? responseData : {}
}

function commonHttpChecks(result) {
  const checks = []
  if (result.error) {
    checks.push(check('FAIL', 'NETWORK_ERROR', 'เชื่อมต่อ endpoint ไม่สำเร็จ', safeError(result.error)))
    return checks
  }
  checks.push(check('PASS', 'HTTP_RESPONSE', `ได้รับ HTTP ${result.status} ภายใน ${result.ms} ms`))
  if (result.status === 401 || result.status === 403) {
    checks.push(check('FAIL', 'AUTH_REJECTED', 'Gateway/endpoint ปฏิเสธ credential หรือ scope'))
  } else if (result.status === 429) {
    checks.push(check('FAIL', 'RATE_LIMITED', 'ถูกจำกัดอัตราการเรียก; รอและ retry ด้วย idempotency key เดิม'))
  } else if (result.status >= 500) {
    checks.push(check('FAIL', 'REMOTE_SERVER_ERROR', 'ปลายทางล้มเหลวชั่วคราว; เก็บหลักฐานและ reconcile ก่อน retry'))
  }
  if (result.parseError) checks.push(check('FAIL', 'NON_JSON_RESPONSE', 'ปลายทางตอบกลับไม่ใช่ JSON ตาม contract'))
  return checks
}

function classifyLabOrderProcess(result, payload, smoke) {
  const checks = commonHttpChecks(result)
  if (checks.some(row => row.level === 'FAIL')) return checks
  const inner = innerData(result.data)
  if (smoke) {
    if (inner.error === 'invalid_payload' || inner.code === 'INVALID_PAYLOAD') {
      checks.push(check('PASS', 'NO_WRITE_SMOKE_REACHED_PROCESS', 'ถึง LAB submit Process และหยุดก่อนเขียนข้อมูลตามตั้งใจ'))
    } else {
      checks.push(check('FAIL', 'SMOKE_UNEXPECTED_RESPONSE', 'smoke ไม่ได้คืน invalid payload จาก Process', responseSummary(inner)))
    }
    return checks
  }
  if (inner.success === true) {
    checks.push(check('PASS', 'LAB_ORDER_ACCEPTED', 'HIS submit Process รับ Order สำเร็จ'))
    const status = text(inner.data && inner.data.hl7_status || inner.hl7_status)
    if (['queued', 'sending', 'sent', 'in_progress', 'resulted'].includes(status)) {
      checks.push(check('PASS', 'OUTBOUND_STATUS', `สถานะ outbound = ${status}`))
    } else {
      checks.push(check('WARN', 'OUTBOUND_STATUS_UNCONFIRMED', `Process สำเร็จแต่สถานะ outbound = ${status || '(ไม่มีค่า)'}`))
    }
  } else {
    checks.push(check('FAIL', text(inner.error || inner.code || 'LAB_ORDER_REJECTED').toUpperCase(), text(inner.message) || 'LAB submit Process ปฏิเสธ Order', responseSummary(inner)))
  }
  return checks
}

function classifyLabAgent(result, payload, smoke) {
  const checks = commonHttpChecks(result)
  if (result.error || result.parseError || [401, 403, 429].includes(result.status) || result.status >= 500) return checks
  const body = isObject(result.data) ? result.data : {}
  if (smoke) {
    if ([400, 413, 415, 422].includes(result.status)) {
      checks.push(check('PASS', 'NO_WRITE_SMOKE_REACHED_AGENT', `ถึง Agent และถูก validation ปฏิเสธด้วย HTTP ${result.status}`))
    } else {
      checks.push(check('FAIL', 'SMOKE_UNEXPECTED_RESPONSE', 'Agent smoke ควรถูกปฏิเสธก่อนเข้าคิว', responseSummary(body)))
    }
    return checks
  }
  const accepted = result.status === 202 && body.ok === true && body.duplicate === false
  const duplicate = result.status === 200 && body.ok === true && body.duplicate === true
  if (!accepted && !duplicate) {
    checks.push(check('FAIL', 'AGENT_REJECTED', 'Agent ไม่รับ Order ตาม response contract', responseSummary(body)))
    return checks
  }
  checks.push(check('PASS', duplicate ? 'AGENT_DUPLICATE_SAFE_SUCCESS' : 'AGENT_QUEUED', duplicate ? 'Agent มี order_no นี้แล้ว; ถือเป็น idempotent success' : 'Agent รับ Order เข้าคิวแล้ว'))
  if (text(body.order_no) !== text(payload.order_no)) {
    checks.push(check('FAIL', 'ORDER_NO_MISMATCH', 'Agent ตอบ order_no ไม่ตรงกับที่ส่ง'))
  } else {
    checks.push(check('PASS', 'ORDER_NO_CORRELATED', `order_no ตรงกัน (${fingerprint(payload.order_no)})`))
  }
  if (!text(body.dispatch_id)) checks.push(check('WARN', 'DISPATCH_ID_MISSING', 'Agent รับสำเร็จแต่ไม่มี dispatch_id สำหรับตามรอย'))
  return checks
}

function classifyLabResult(result, payload, smoke) {
  const checks = commonHttpChecks(result)
  if (checks.some(row => row.level === 'FAIL')) return checks
  const inner = innerData(result.data)
  if (smoke) {
    if (inner.code === 'INVALID_PAYLOAD') checks.push(check('PASS', 'NO_WRITE_SMOKE_REACHED_PROCESS', 'ถึง lis.receive Process และหยุดก่อนสร้าง Receipt'))
    else checks.push(check('FAIL', 'SMOKE_UNEXPECTED_RESPONSE', 'smoke ไม่ได้คืน INVALID_PAYLOAD', responseSummary(inner)))
    return checks
  }
  if (['PROCESSED', 'PROCESSED_WITH_WARNING', 'DUPLICATE_RESULT_UID'].includes(inner.code) && inner.success === true) {
    checks.push(check(inner.code === 'PROCESSED_WITH_WARNING' ? 'WARN' : 'PASS', inner.code, text(inner.message) || 'HIS รับผล LAB สำเร็จ'))
    const returnedUid = text(inner.data && inner.data.result_uid)
    if (returnedUid && returnedUid !== text(payload.result_uid)) checks.push(check('FAIL', 'RESULT_UID_MISMATCH', 'Process ตอบ result_uid ไม่ตรงกับที่ส่ง'))
    else checks.push(check('PASS', 'RESULT_UID_CORRELATED', `result_uid ตรงกัน (${fingerprint(payload.result_uid)})`))
    if (inner.data && inner.data.receipt_status !== 'processed') checks.push(check('WARN', 'RECEIPT_NOT_PROCESSED', `Receipt status = ${text(inner.data.receipt_status) || '(ไม่มีค่า)'}`))
  } else {
    checks.push(check('FAIL', text(inner.code || 'LAB_RESULT_REJECTED'), text(inner.message) || 'HIS ปฏิเสธผล LAB', responseSummary(inner)))
  }
  return checks
}

function classifyXrayDispatch(result, payload, smoke) {
  const checks = commonHttpChecks(result)
  if (checks.some(row => row.level === 'FAIL')) return checks
  const inner = innerData(result.data)
  if (smoke) {
    if (inner.success === false) checks.push(check('PASS', 'NO_WRITE_SMOKE_REACHED_PROCESS', 'ถึง X-ray dispatch Process และหยุดก่อนออก Accession/เขียนข้อมูล'))
    else checks.push(check('FAIL', 'SMOKE_UNEXPECTED_RESPONSE', 'smoke ไม่ถูก dispatch validation ปฏิเสธ', responseSummary(inner)))
    return checks
  }
  if (inner.success === true) {
    checks.push(check('PASS', 'XRAY_DISPATCH_ACCEPTED', text(inner.message) || 'CPOE dispatch สำเร็จ'))
    if (!text(inner.accession_no || inner.data && inner.data.accession_no)) checks.push(check('WARN', 'ACCESSION_MISSING', 'dispatch สำเร็จแต่ response ไม่มี Accession No.'))
    const transport = inner.transport || inner.data && inner.data.transport
    if (transport && (transport.ack === 'AA' || transport.AcknowledgementCode === 'AA')) checks.push(check('PASS', 'RIS_ACK_ACCEPTED', 'RIS bridge ตอบ AA'))
    else if (transport) checks.push(check('FAIL', 'RIS_ACK_NOT_ACCEPTED', 'dispatch เขียนฝั่ง HIS แล้วแต่ RIS ไม่ตอบ AA', responseSummary(transport)))
    else checks.push(check('WARN', 'RIS_TRANSPORT_EVIDENCE_MISSING', 'response ไม่มี transport ACK จึงยังยืนยัน RIS ไม่ได้'))
  } else {
    checks.push(check('FAIL', text(inner.error || inner.code || 'XRAY_DISPATCH_REJECTED').toUpperCase(), text(inner.message) || 'X-ray dispatch ปฏิเสธคำขอ', responseSummary(inner)))
  }
  return checks
}

function classifyXrayAck(result, payload, smoke, profileName) {
  const checks = commonHttpChecks(result)
  if (checks.some(row => row.level === 'FAIL')) return checks
  const ack = innerData(result.data)
  const code = text(ack.AcknowledgementCode)
  if (smoke) {
    if (['AE', 'AR'].includes(code)) checks.push(check('PASS', 'NO_WRITE_SMOKE_REACHED_PROCESS', `ถึง X-ray Process และถูกปฏิเสธด้วย ACK ${code} ก่อนเขียนข้อมูล`))
    else checks.push(check('FAIL', 'SMOKE_UNEXPECTED_RESPONSE', 'smoke ไม่ได้ ACK AE/AR', responseSummary(ack)))
    return checks
  }
  if (code !== 'AA') {
    checks.push(check('FAIL', `XRAY_ACK_${code || 'MISSING'}`, text(ack.TextMessage || ack.message) || 'X-ray Process ไม่ตอบ AA', responseSummary(ack)))
    if (ack.LocalSaved === true) checks.push(check('FAIL', 'LOCAL_SAVED_FORWARD_FAILED', 'ข้อมูลถูกบันทึกใน HIS แล้ว แต่ forward ต่อไป RIS ล้มเหลว; ห้ามส่งเลขใหม่ ให้ reconcile ด้วย Accession เดิม'))
    return checks
  }
  checks.push(check('PASS', 'XRAY_ACK_AA', text(ack.TextMessage || ack.message) || 'X-ray Process รับข้อมูลสำเร็จ'))
  const expected = text(payload.AccessionNo)
  const actual = text(ack.AccessionNo)
  if (actual && actual !== expected) checks.push(check('FAIL', 'ACCESSION_MISMATCH', 'ACK ตอบ AccessionNo ไม่ตรงกับที่ส่ง'))
  else checks.push(check('PASS', 'ACCESSION_CORRELATED', `AccessionNo ตรงกัน (${fingerprint(expected)})`))
  if (profileName === 'xray-result') {
    checks.push(check('WARN', 'XRAY_RESULT_ORDER_LINK_NOT_PROVEN', 'ACK AA ไม่ได้พิสูจน์ว่า AccessionNo มี Order จริง; ต้องตรวจ current result/worklist evidence ต่อ'))
  }
  return checks
}

function evidenceRow(evidence, key) {
  const value = evidence && evidence[key]
  return isObject(value) ? value : null
}

function compareEvidenceIdentity(checks, label, actual, expected) {
  if (!text(actual)) return
  if (text(actual) === text(expected)) checks.push(check('PASS', `${label}_IDENTITY_MATCH`, `${label} ผูก identity ถูกต้อง (${fingerprint(expected)})`))
  else checks.push(check('FAIL', `${label}_IDENTITY_MISMATCH`, `${label} ผูก identity ไม่ตรงกับ payload`))
}

function analyzeLabOrderEvidence(payload, evidence) {
  const checks = []
  const outbound = evidenceRow(evidence, 'outbound')
  if (!outbound) checks.push(check('SKIP', 'OUTBOUND_EVIDENCE_MISSING', 'ไม่มี evidence ของ zdata_lab_outband_order'))
  else {
    compareEvidenceIdentity(checks, 'OUTBOUND_ORDER_NO', outbound.order_no, payload.order_no)
    compareEvidenceIdentity(checks, 'OUTBOUND_LAB_NO', outbound.lab_no || outbound.labno, payload.labno)
    const status = text(outbound.hl7_status)
    checks.push(check(['queued', 'sending', 'sent', 'in_progress', 'resulted'].includes(status) ? 'PASS' : 'FAIL', 'OUTBOUND_PERSISTED_STATUS', `Outbound status = ${status || '(ไม่มีค่า)'}`))
  }
  const agent = evidenceRow(evidence, 'agent')
  if (!agent) checks.push(check('SKIP', 'AGENT_EVIDENCE_MISSING', 'ไม่มี Agent queue/dispatch evidence'))
  else {
    compareEvidenceIdentity(checks, 'AGENT_ORDER_NO', agent.order_no, payload.order_no)
    checks.push(check(agent.accepted === true || text(agent.dispatch_id) ? 'PASS' : 'FAIL', 'AGENT_QUEUE_EVIDENCE', agent.accepted === true || text(agent.dispatch_id) ? 'พบหลักฐาน Agent รับเข้าคิว' : 'Agent evidence ไม่มี accepted/dispatch_id'))
  }
  if (!evidenceRow(evidence, 'lis')) checks.push(check('SKIP', 'LIS_REGISTRATION_EVIDENCE_MISSING', 'ยังไม่มีหลักฐาน .req/LIS ลงทะเบียนด้วย LAB NO.'))
  return checks
}

function analyzeLabResultEvidence(payload, evidence) {
  const checks = []
  const receipt = evidenceRow(evidence, 'receipt')
  if (!receipt) checks.push(check('SKIP', 'RECEIPT_EVIDENCE_MISSING', 'ไม่มี Technical Receipt evidence'))
  else {
    compareEvidenceIdentity(checks, 'RECEIPT_RESULT_UID', receipt.result_uid, payload.result_uid)
    checks.push(check(receipt.receipt_status === 'processed' ? 'PASS' : 'FAIL', 'RECEIPT_STATUS', `Receipt status = ${text(receipt.receipt_status) || '(ไม่มีค่า)'}`))
  }
  const report = evidenceRow(evidence, 'report')
  if (!report) checks.push(check('SKIP', 'REPORT_EVIDENCE_MISSING', 'ไม่มี Result Report evidence'))
  else compareEvidenceIdentity(checks, 'REPORT_ORDER_NO', report.order_no, payload.order_no)
  const items = Array.isArray(evidence && evidence.items) ? evidence.items : []
  if (!items.length) checks.push(check('SKIP', 'RESULT_ITEMS_EVIDENCE_MISSING', 'ไม่มี Result Item evidence'))
  else {
    const expected = new Set((payload.items || []).map(row => text(row.obs_code)))
    const actual = new Set(items.map(row => text(row.obs_code)))
    const missing = [...expected].filter(code => !actual.has(code))
    checks.push(check(missing.length ? 'FAIL' : 'PASS', 'RESULT_ITEMS_MATCH', missing.length ? `ขาด obs_code ${missing.join(', ')}` : `พบ Result Item ครบ ${expected.size} code`))
  }
  for (const key of ['work_item', 'cpoe_item', 'outbound']) {
    if (!evidenceRow(evidence, key)) checks.push(check('SKIP', `${key.toUpperCase()}_EVIDENCE_MISSING`, `ไม่มี ${key} status evidence สำหรับ reconciliation`))
  }
  return checks
}

function analyzeXrayOrderEvidence(payload, evidence) {
  const checks = []
  const expected = payload.AccessionNo || evidence && evidence.expected_accession_no
  for (const key of ['cpoe_item', 'xray_order']) {
    const row = evidenceRow(evidence, key)
    if (!row) checks.push(check('SKIP', `${key.toUpperCase()}_EVIDENCE_MISSING`, `ไม่มี ${key} evidence`))
    else compareEvidenceIdentity(checks, key.toUpperCase(), row.accession_no || row.AccessionNo, expected)
  }
  const ack = evidenceRow(evidence, 'ris_ack')
  if (!ack) checks.push(check('SKIP', 'RIS_ACK_EVIDENCE_MISSING', 'ไม่มี RIS ACK evidence'))
  else checks.push(check(text(ack.AcknowledgementCode || ack.ack) === 'AA' ? 'PASS' : 'FAIL', 'RIS_ACK_EVIDENCE', `RIS ACK = ${text(ack.AcknowledgementCode || ack.ack) || '(ไม่มีค่า)'}`))
  return checks
}

function analyzeXrayResultEvidence(payload, evidence) {
  const checks = []
  const expected = payload.AccessionNo
  const log = evidenceRow(evidence, 'result_log')
  if (!log) checks.push(check('WARN', 'RESULT_LOG_EVIDENCE_MISSING', 'ไม่พบ immutable result log evidence; ตรวจ deployment ว่าตาราง log ถาวรถูกเขียนหรือไม่'))
  else compareEvidenceIdentity(checks, 'RESULT_LOG_ACCESSION', log.AccessionNo || log.accession_no, expected)
  const current = evidenceRow(evidence, 'current_result')
  if (!current) checks.push(check('FAIL', 'CURRENT_RESULT_EVIDENCE_MISSING', 'ไม่พบ current X-ray result ที่ worklist ใช้อ่าน'))
  else compareEvidenceIdentity(checks, 'CURRENT_RESULT_ACCESSION', current.AccessionNo || current.accession_no, expected)
  const worklist = evidenceRow(evidence, 'worklist_item')
  if (!worklist) checks.push(check('SKIP', 'WORKLIST_EVIDENCE_MISSING', 'ไม่มี worklist evidence จึงยังยืนยันหน้าออกผลไม่ได้'))
  else checks.push(check(worklist.resulted === true || ['resulted', 'completed'].includes(text(worklist.status)) ? 'PASS' : 'FAIL', 'WORKLIST_RESULT_STATE', `worklist result state = ${text(worklist.status) || String(worklist.resulted)}`))
  return checks
}

function safeError(error) {
  const code = text(error && (error.code || error.cause && error.cause.code)) || 'NETWORK_ERROR'
  return { code, message: redactString(text(error && error.message)).slice(0, 300) }
}

function responseSummary(value) {
  if (!isObject(value)) return {}
  const allowed = [
    'success', 'error', 'code', 'message', 'retryable', 'hl7_status', 'http_status',
    'AcknowledgementCode', 'TextMessage', 'Operation', 'LocalSaved', 'ForwardHttpStatus',
    'ForwardError', 'network_code', 'receipt_status',
  ]
  const result = {}
  for (const key of allowed) if (own(value, key)) result[key] = sanitize(value[key], key)
  if (Array.isArray(value.errors)) result.errors = value.errors.map(item => redactString(text(item)).slice(0, 300))
  return result
}

function redactString(value) {
  return text(value)
    .replace(/([?&](?:token|key|api_key|apikey|access_token)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [REDACTED]')
    .replace(/https?:\/\/[^\s]*@/gi, 'https://[REDACTED]@')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/\b\d{13}\b/g, '[REDACTED_13_DIGITS]')
}

function sanitize(value, key = '') {
  const sensitive = /(?:token|secret|password|authorization|api.?key|patient|\bhn\b|name|phone|email|addr|ssn|dob|resulttext|value|diagnosis|note|raw|payload)/i
  if (key !== 'payload_identity' && sensitive.test(key)) return '[REDACTED]'
  if (Array.isArray(value)) return value.slice(0, 50).map(item => sanitize(item, key))
  if (isObject(value)) {
    const output = {}
    for (const [childKey, childValue] of Object.entries(value)) output[childKey] = sanitize(childValue, childKey)
    return output
  }
  if (typeof value === 'string') return redactString(value).slice(0, 500)
  return value
}

function displayUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl)
    const privateHost = /^(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(parsed.hostname)
    return `${parsed.protocol}//${privateHost ? '[private-host]' : parsed.host}${parsed.pathname}`
  } catch (_) {
    return '[invalid-url]'
  }
}

function appendTokenQuery(rawUrl, token) {
  const parsed = new URL(rawUrl)
  if (!parsed.searchParams.has('token')) parsed.searchParams.set('token', token)
  return parsed.toString()
}

function resolveProfiles(selection) {
  const names = GROUPS[selection] || [selection]
  const unknown = names.filter(name => !PROFILES[name])
  if (unknown.length) throw new Error(`ไม่รู้จัก flow: ${unknown.join(', ')}`)
  return names
}

function parseArgs(argv) {
  const args = { flow: '', payload: '', caseFile: '', evidence: '', reportDir: '', send: false, confirmWrite: false, smoke: false, timeout: 15000 }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') args.help = true
    else if (arg === '--send') args.send = true
    else if (arg === '--confirm-write') args.confirmWrite = true
    else if (arg === '--smoke') args.smoke = true
    else if (['--flow', '--payload', '--case-file', '--evidence', '--report-dir', '--timeout'].includes(arg)) {
      const key = { '--flow': 'flow', '--payload': 'payload', '--case-file': 'caseFile', '--evidence': 'evidence', '--report-dir': 'reportDir', '--timeout': 'timeout' }[arg]
      args[key] = argv[++index]
    } else throw new Error(`ไม่รู้จัก argument: ${arg}`)
  }
  args.timeout = Number(args.timeout)
  if (!Number.isInteger(args.timeout) || args.timeout < 500 || args.timeout > 120000) throw new Error('--timeout ต้องอยู่ระหว่าง 500 ถึง 120000 ms')
  return args
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'))
}

function loadPayloads(args, profileNames) {
  if (args.smoke) return Object.fromEntries(profileNames.map(name => [name, {}]))
  if (args.caseFile) {
    const cases = readJson(args.caseFile)
    return Object.fromEntries(profileNames.map(name => {
      if (!own(cases, name)) throw new Error(`case file ไม่มี key ${name}`)
      return [name, cases[name]]
    }))
  }
  if (profileNames.length !== 1) throw new Error('หลาย flow ต้องใช้ --smoke หรือ --case-file')
  if (!args.payload) throw new Error('ต้องระบุ --payload สำหรับ valid case')
  const input = readJson(args.payload)
  return { [profileNames[0]]: input.payload && profileNames[0].startsWith('lab-') ? input.payload : input }
}

async function postJson(url, headers, body, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const started = Date.now()
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
      redirect: 'manual',
    })
    const raw = await response.text()
    let data = null
    let parseError = false
    try { data = JSON.parse(raw) } catch (_) { parseError = true }
    return { status: response.status, ms: Date.now() - started, data, parseError }
  } catch (error) {
    return { status: 0, ms: Date.now() - started, data: null, error }
  } finally {
    clearTimeout(timer)
  }
}

function configFor(profile, env, send) {
  const checks = []
  const rawUrl = text(env[profile.urlEnv])
  const secret = text(env[profile.secretEnv])
  const missingLevel = send ? 'FAIL' : 'WARN'
  if (!rawUrl) checks.push(check(missingLevel, 'ENDPOINT_NOT_CONFIGURED', `ยังไม่ได้ตั้ง ${profile.urlEnv}`))
  if (!secret) checks.push(check(missingLevel, 'CREDENTIAL_NOT_CONFIGURED', `ยังไม่ได้ตั้ง ${profile.secretEnv}`))
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl)
      if (!['http:', 'https:'].includes(parsed.protocol)) checks.push(check('FAIL', 'ENDPOINT_PROTOCOL_INVALID', 'endpoint ต้องเป็น http/https'))
      else checks.push(check('PASS', 'ENDPOINT_CONFIGURED', displayUrl(rawUrl)))
      if (parsed.protocol === 'http:' && !/^(?:localhost|127\.|10\.|192\.168\.|172\.)/.test(parsed.hostname)) {
        checks.push(check('WARN', 'PLAINTEXT_HTTP', 'endpoint ภายนอกใช้ HTTP; credential อาจถูกดักอ่าน'))
      }
    } catch (_) {
      checks.push(check('FAIL', 'ENDPOINT_URL_INVALID', `${profile.urlEnv} ไม่ใช่ URL`))
    }
  }
  if (secret) checks.push(check('PASS', 'CREDENTIAL_PRESENT', `พบ ${profile.secretEnv} ใน environment (ไม่แสดงค่า)`))
  return { rawUrl, secret, checks }
}

async function runProfile(name, payload, evidence, options) {
  const profile = PROFILES[name]
  const startedAt = new Date().toISOString()
  const checks = []
  const validationErrors = profile.validator(payload)
  if (options.smoke) checks.push(check(validationErrors.length ? 'PASS' : 'FAIL', 'SMOKE_PAYLOAD_GUARD', validationErrors.length ? 'payload ผิดโดยตั้งใจและจะหยุดก่อนเขียนข้อมูล' : 'smoke payload ไม่ผิดตามที่คาด; ยกเลิกเพื่อความปลอดภัย'))
  else if (validationErrors.length) validationErrors.forEach(message => checks.push(check('FAIL', 'PAYLOAD_INVALID', message)))
  else checks.push(check('PASS', 'PAYLOAD_VALID', 'payload ผ่าน static contract checks'))

  const config = configFor(profile, options.env, options.send)
  checks.push(...config.checks)
  const report = {
    profile: name,
    label: profile.label,
    mode: options.smoke ? 'no-write-smoke' : (options.send ? 'write-confirmed' : 'dry-run'),
    started_at: startedAt,
    payload_identity: payloadIdentity(name, payload),
    checks,
  }

  if (!options.send) {
    checks.push(check('SKIP', 'TRANSPORT_NOT_RUN', 'dry-run: ยังไม่ได้ติดต่อ endpoint'))
  } else if (!options.smoke && !options.confirmWrite) {
    checks.push(check('FAIL', 'WRITE_CONFIRMATION_REQUIRED', 'valid payload ต้องใช้ --send --confirm-write คู่กัน'))
  } else if (checks.some(row => row.level === 'FAIL')) {
    checks.push(check('SKIP', 'TRANSPORT_BLOCKED', 'ไม่ยิง request เพราะ preflight มี FAIL'))
  } else {
    const headers = {}
    const headerName = text(profile.headerEnv && options.env[profile.headerEnv]) || profile.defaultHeader
    let target = config.rawUrl
    if (profile.auth === 'api-key') headers[headerName] = config.secret
    if (profile.auth === 'bearer' || profile.auth === 'bearer-query') headers.Authorization = `Bearer ${config.secret}`
    if (profile.auth === 'bearer-query') target = appendTokenQuery(target, config.secret)
    const result = await postJson(target, headers, profile.envelope(payload), options.timeout)
    checks.push(...profile.response(result, payload, options.smoke, name))
  }

  if (evidence) checks.push(...profile.evidence(payload, evidence))
  else checks.push(check('SKIP', 'POST_WRITE_EVIDENCE_NOT_PROVIDED', 'ไม่มี --evidence จึงยังไม่ยืนยัน persistence/downstream/UI'))
  report.finished_at = new Date().toISOString()
  report.summary = summarize(checks)
  return report
}

function payloadIdentity(name, payload) {
  const keys = name.startsWith('lab-')
    ? ['order_no', 'labno', 'filler_order_no', 'result_uid']
    : ['order_id', 'AccessionNo']
  const result = {}
  for (const key of keys) if (text(payload[key])) result[key] = fingerprint(payload[key])
  if (name === 'xray-dispatch') {
    const ids = payload.item_ids || (payload.item_id ? [payload.item_id] : [])
    result.item_ids = ids.map(fingerprint)
  }
  return result
}

function summarize(checks) {
  const counts = { PASS: 0, WARN: 0, FAIL: 0, SKIP: 0, INFO: 0 }
  checks.forEach(row => { counts[row.level] = (counts[row.level] || 0) + 1 })
  return { status: counts.FAIL ? 'FAIL' : (counts.WARN ? 'WARN' : 'PASS'), counts }
}

function overallSummary(reports) {
  const checks = reports.flatMap(report => report.checks)
  return summarize(checks)
}

function markdownEscape(value) {
  return text(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function renderMarkdown(run) {
  const lines = [
    '# Integration Auto-Diagnostic Report',
    '',
    `- Run ID: \`${run.run_id}\``,
    `- Generated: ${run.generated_at}`,
    `- Overall: **${run.summary.status}**`,
    '- Privacy: payloads, credentials, PHI, result text, and raw responses are not stored in this report.',
    '',
  ]
  for (const report of run.reports) {
    lines.push(`## ${report.label}`, '', `Mode: \`${report.mode}\` · Result: **${report.summary.status}**`, '')
    if (Object.keys(report.payload_identity || {}).length) {
      const identities = Object.entries(report.payload_identity)
        .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : value}`)
        .join(' · ')
      lines.push(`Identity fingerprints: ${identities}`, '')
    }
    lines.push('| Level | Code | Finding |', '|---|---|---|')
    for (const row of report.checks) lines.push(`| ${row.level} | \`${markdownEscape(row.code)}\` | ${markdownEscape(row.message)} |`)
    lines.push('')
  }
  lines.push('## Interpretation', '', '- `FAIL` = จุดผิดที่ต้องแก้ก่อนถือว่า flow ผ่าน', '- `WARN` = ผ่านบางชั้นแต่ยังมีความเสี่ยงหรือ contract gap', '- `SKIP` = เครื่องมือยังไม่มี evidence ยืนยันจุดนั้น; ไม่ใช่ PASS', '')
  return lines.join('\n')
}

function writeReports(run, reportDir) {
  if (!reportDir) return []
  const directory = path.resolve(reportDir)
  fs.mkdirSync(directory, { recursive: true })
  const base = `integration-autodiag-${run.run_id}`
  const jsonPath = path.join(directory, `${base}.json`)
  const markdownPath = path.join(directory, `${base}.md`)
  fs.writeFileSync(jsonPath, JSON.stringify(sanitize(run), null, 2) + '\n')
  fs.writeFileSync(markdownPath, renderMarkdown(run) + '\n')
  return [jsonPath, markdownPath]
}

function usage() {
  return `LAB / X-ray integration auto-diagnostic

Usage:
  node integration_autodiag.js --flow <flow> --payload case.json
  node integration_autodiag.js --flow <flow> --payload case.json --send --confirm-write
  node integration_autodiag.js --flow all --smoke --send
  node integration_autodiag.js --flow lab --case-file cases.json --evidence evidence.json

Flows:
  lab-order       HIS Gateway/Process lis.submit
  lab-agent       direct Agent isolation probe
  lab-result      HIS External API lis.receive
  xray-dispatch   CPOE dispatch Process
  xray-order      RIS order bridge isolation probe
  xray-result     RIS result callback Process
  lab | xray | all  flow groups (use --smoke or --case-file)

Options:
  --smoke          intentionally invalid no-write request
  --send           allow network request
  --confirm-write  required with a valid payload
  --evidence FILE  optional post-write evidence keyed by flow
  --report-dir DIR write redacted JSON and Markdown reports
  --timeout MS     500..120000 (default 15000)

Run without --send first. Secrets belong in environment variables; see the toolkit README.`
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv)
  if (args.help) {
    console.log(usage())
    return 0
  }
  if (!args.flow) throw new Error('ต้องระบุ --flow')
  const profileNames = resolveProfiles(args.flow)
  const payloads = loadPayloads(args, profileNames)
  const evidenceRoot = args.evidence ? readJson(args.evidence) : {}
  const reports = []
  for (const name of profileNames) {
    const evidence = own(evidenceRoot, name) ? evidenceRoot[name] : (profileNames.length === 1 ? evidenceRoot : null)
    reports.push(await runProfile(name, payloads[name], evidence, { ...args, env }))
  }
  const run = {
    run_id: new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14) + '-' + crypto.randomBytes(3).toString('hex'),
    generated_at: new Date().toISOString(),
    summary: overallSummary(reports),
    reports,
  }
  console.log(renderMarkdown(run))
  const written = writeReports(run, args.reportDir)
  written.forEach(file => console.log(`report: ${file}`))
  return run.summary.status === 'FAIL' ? 2 : 0
}

if (require.main === module) {
  main().then(code => { process.exitCode = code }).catch(error => {
    console.error('ERROR: ' + redactString(error && error.message || error))
    process.exitCode = 1
  })
}

module.exports = {
  PROFILES,
  PROFILE_NAMES,
  analyzeLabOrderEvidence,
  analyzeLabResultEvidence,
  analyzeXrayOrderEvidence,
  analyzeXrayResultEvidence,
  classifyLabAgent,
  classifyLabOrderProcess,
  classifyLabResult,
  classifyXrayAck,
  classifyXrayDispatch,
  fingerprint,
  parseArgs,
  renderMarkdown,
  runProfile,
  sanitize,
  summarize,
  validateLabOrder,
  validateLabResult,
  validateXrayDispatch,
  validateXrayOrder,
  validateXrayResult,
}
