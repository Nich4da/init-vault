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
const WORK_ITEM_FORM_ID = '6a95c750422c1ca959829e8a'
const CPOE_ITEM_COLLECTION = 'zdata_cpoe_order_item'
const CPOE_ORDER_COLLECTION = 'zdata_cpoe_order'
const OUTBOUND_COLLECTION = 'zdata_lab_outband_order'
const SCHEMA_VERSION = 'his-agent-result-v2'

// Result-component allowlist from catalog-configured-tests-Group.numbers,
// reviewed 2026-09-15 (SHA-256 d147d6b9785cc7cc7b5695a7132b1798d8bd976b45087e69c6791b796dbf382b).
// group_code and local_code are the user-confirmed HIS/LIS mapping identifiers.
// The source has no required/optional flag, so mapped children authorize inbound
// obs_code values only; they are not all treated as mandatory final components.
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

const firstText = values => {
  for (const value of values) {
    const result = trimmed(value)
    if (result) return result
  }
  return ''
}

const newestTimestamp = (currentValue, candidateValue) => {
  const current = trimmed(currentValue)
  const candidate = trimmed(candidateValue)
  if (!current) return candidate
  if (!candidate) return current
  const currentTime = Date.parse(current)
  const candidateTime = Date.parse(candidate)
  if (!Number.isFinite(candidateTime)) return current
  if (!Number.isFinite(currentTime) || candidateTime >= currentTime) return candidate
  return current
}

const resultComponentsForOrderCode = orderCode => {
  const components = RESULT_COMPONENT_CODES_BY_GROUP[trimmed(orderCode)]
  return Array.isArray(components) ? components : []
}

const orderCodeCoveredByPayload = (orderCode, payloadCodes) => {
  if (payloadCodes.has(orderCode)) return true
  const components = resultComponentsForOrderCode(orderCode)
  if (!components.length || components.includes(orderCode)) return false
  return components.some(code => payloadCodes.has(code))
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

const canonicalJson = value => {
  const normalize = item => {
    if (Array.isArray(item)) return item.map(normalize)
    if (item && typeof item === 'object') {
      return Object.keys(item).sort().reduce((result, key) => {
        result[key] = normalize(item[key])
        return result
      }, {})
    }
    return item
  }
  return JSON.stringify(normalize(value))
}

const storedPayloadHash = receiptRow => {
  const rawPayloadJson = trimmed(receiptRow && receiptRow.raw_payload_json)
  if (rawPayloadJson) {
    try {
      return stableHash(canonicalJson(JSON.parse(rawPayloadJson)))
    } catch (error) {
      // Fall back to the stored hash for legacy Receipts with invalid raw JSON.
    }
  }
  return trimmed(receiptRow && receiptRow.payload_hash)
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
const transportMetadataFields = new Set(['xpartnerx'])
const allowedIdentityFields = new Set(['source_id', 'source_name'])
const allowedItemFields = new Set([
  'obs_code', 'obs_name', 'value', 'units', 'ref_range', 'obx_status',
  'change_kind', 'previous_value', 'receipt_seq', 'result_version',
  'critical_low_rule', 'critical_high_rule', 'panel_code', 'panel_name',
  'group_role', 'organism', 'interpretation_code', 'is_critical', 'comment',
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

const syncCpoeItemStatus = async (sourceItemId, targetStatus) => {
  const itemId = trimmed(sourceItemId)
  if (!/^[a-f\d]{24}$/i.test(itemId)) {
    return { status: '', changed: false, preservedTerminal: false, pending: true, reason: 'missing_source_item_id' }
  }
  const itemObjectId = app.dbObjectId(itemId)
  const itemCollection = app.db.collection(CPOE_ITEM_COLLECTION)
  const activeQuery = { $nin: [0, 3] }
  const terminalStatuses = ['completed', 'rejected']
  const current = await itemCollection.findOne({ _id: itemObjectId, xrstatx: activeQuery })
  if (!current) {
    return { status: '', changed: false, preservedTerminal: false, pending: true, reason: 'cpoe_item_not_found' }
  }
  const currentStatus = lower(current.current_status)
  if (currentStatus === targetStatus) {
    return { status: currentStatus, changed: false, preservedTerminal: false, pending: false, reason: '' }
  }
  if (terminalStatuses.includes(currentStatus)) {
    return { status: currentStatus, changed: false, preservedTerminal: true, pending: false, reason: '' }
  }
  const saved = await itemCollection.updateOne(
    { _id: itemObjectId, xrstatx: activeQuery, current_status: { $nin: terminalStatuses } },
    { $set: { current_status: targetStatus } }
  )
  if (saved && Number(saved.matchedCount) === 1) {
    return { status: targetStatus, changed: true, preservedTerminal: false, pending: false, reason: '' }
  }
  const raced = await itemCollection.findOne({ _id: itemObjectId, xrstatx: activeQuery })
  const racedStatus = lower(raced && raced.current_status)
  if (racedStatus === targetStatus || terminalStatuses.includes(racedStatus)) {
    return {
      status: racedStatus,
      changed: false,
      preservedTerminal: terminalStatuses.includes(racedStatus) && racedStatus !== targetStatus,
      pending: false,
      reason: '',
    }
  }
  return { status: racedStatus, changed: false, preservedTerminal: false, pending: true, reason: 'compare_and_set_conflict' }
}

const sourceItemIdFromWork = statusRow => firstText([
  statusRow && statusRow.source_specimen_record_id,
  statusRow && statusRow.dataid,
  statusRow && statusRow._id,
])

const cpoeOrderIdFromItem = item => firstText([
  item && item.order_id && item.order_id.value,
  item && item.order_id,
  item && item.xparentx,
])

const reconcileOutboundFromResult = async (statusRow, resultPayload, receiptId) => {
  const targetStatus = ['resulted', 'corrected'].includes(resultPayload.overall_status)
    ? 'resulted'
    : resultPayload.overall_status === 'in_progress'
      ? 'in_progress'
      : ''
  if (!targetStatus) {
    return { status: '', changed: false, pending: false, reason: 'not_applicable' }
  }

  const sourceItemId = sourceItemIdFromWork(statusRow)
  if (!/^[a-f\d]{24}$/i.test(sourceItemId)) {
    return { status: '', changed: false, pending: true, reason: 'missing_source_item_id' }
  }

  const collection = app.db.collection(OUTBOUND_COLLECTION)
  const current = await collection.findOne({
    xrstatx: { $nin: [0, 3] },
    order_no: resultPayload.order_no,
    lab_no: resultPayload.filler_order_no,
    patient_hn: resultPayload.hn,
    visit_id: resultPayload.visit_id,
    source_cpoe_item_id: sourceItemId,
  })
  if (!current) {
    return { status: '', changed: false, pending: true, reason: 'outbound_not_found' }
  }

  const currentStatus = lower(current.hl7_status) || 'new'
  const terminalStatuses = ['cancelled', 'cancel_rejected']
  if (terminalStatuses.includes(currentStatus)) {
    return { status: currentStatus, changed: false, pending: false, reason: 'terminal_status_preserved' }
  }

  const now = isoThailand()
  const nextStatus = currentStatus === 'resulted' ? currentStatus : targetStatus
  const saved = await collection.updateOne(
    { _id: current._id, xrstatx: { $nin: [0, 3] }, hl7_status: current.hl7_status },
    {
      $set: {
        hl7_status: nextStatus,
        retryable: false,
        next_retry_at: '',
        last_status_at: now,
        result_callback_received_at: now,
        result_uid: resultPayload.result_uid,
        result_receipt_id: trimmed(receiptId),
        last_error_code: '',
        last_error_at: '',
        last_error_http_status: '',
        last_error_reason: '',
        last_error_detail_json: '',
      },
    }
  )
  if (saved && Number(saved.matchedCount) === 1) {
    return {
      status: nextStatus,
      changed: currentStatus !== nextStatus || current.retryable !== false || Boolean(trimmed(current.last_error_code)),
      pending: false,
      reason: '',
    }
  }

  const raced = await collection.findOne({ _id: current._id, xrstatx: { $nin: [0, 3] } })
  const racedStatus = lower(raced && raced.hl7_status)
  if (raced && racedStatus === nextStatus && raced.retryable === false) {
    return { status: racedStatus, changed: false, pending: false, reason: '' }
  }
  return { status: racedStatus, changed: false, pending: true, reason: 'compare_and_set_conflict' }
}

const aggregateParentCpoeOrder = async sourceItemId => {
  const itemId = trimmed(sourceItemId)
  if (!/^[a-f\d]{24}$/i.test(itemId)) {
    return { status: '', changed: false, complete: false, pending: true, reason: 'missing_source_item_id' }
  }

  const itemCollection = app.db.collection(CPOE_ITEM_COLLECTION)
  const orderCollection = app.db.collection(CPOE_ORDER_COLLECTION)
  const item = await itemCollection.findOne({
    _id: app.dbObjectId(itemId),
    xrstatx: { $nin: [0, 3] },
  })
  if (!item) {
    return { status: '', changed: false, complete: false, pending: true, reason: 'cpoe_item_not_found' }
  }

  const orderId = cpoeOrderIdFromItem(item)
  if (!/^[a-f\d]{24}$/i.test(orderId)) {
    return { status: '', changed: false, complete: false, pending: true, reason: 'cpoe_order_reference_missing' }
  }

  const orderObjectId = app.dbObjectId(orderId)
  const order = await orderCollection.findOne({
    _id: orderObjectId,
    xrstatx: { $nin: [0, 3] },
  })
  if (!order) {
    return { status: '', changed: false, complete: false, pending: true, reason: 'cpoe_order_not_found' }
  }

  const children = await itemCollection.find({
    xrstatx: { $nin: [0, 3] },
    $or: [
      { xparentx: orderObjectId },
      { 'order_id.value': orderObjectId },
    ],
  }).toArray()
  if (!children.length) {
    return { status: lower(order.current_status), changed: false, complete: false, pending: true, reason: 'cpoe_order_items_not_found' }
  }

  const completedCount = children.filter(child => lower(child.current_status) === 'completed').length
  const complete = completedCount === children.length
  const currentStatus = lower(order.current_status)
  if (!complete) {
    return {
      status: currentStatus,
      changed: false,
      complete: false,
      pending: false,
      reason: 'items_pending',
      item_count: children.length,
      completed_item_count: completedCount,
    }
  }
  if (currentStatus === 'completed') {
    return {
      status: currentStatus,
      changed: false,
      complete: true,
      pending: false,
      reason: '',
      item_count: children.length,
      completed_item_count: completedCount,
    }
  }
  if (['cancelled', 'rejected'].includes(currentStatus)) {
    return {
      status: currentStatus,
      changed: false,
      complete: true,
      pending: false,
      reason: 'terminal_status_preserved',
      item_count: children.length,
      completed_item_count: completedCount,
    }
  }

  const saved = await orderCollection.updateOne(
    {
      _id: orderObjectId,
      xrstatx: { $nin: [0, 3] },
      current_status: { $nin: ['completed', 'cancelled', 'rejected'] },
    },
    {
      $set: {
        current_status: 'completed',
        result_completed_at: isoThailand(),
        result_completed_source: 'lis.receive',
      },
    }
  )
  if (saved && Number(saved.matchedCount) === 1) {
    return {
      status: 'completed',
      changed: true,
      complete: true,
      pending: false,
      reason: '',
      item_count: children.length,
      completed_item_count: completedCount,
    }
  }

  const raced = await orderCollection.findOne({ _id: orderObjectId, xrstatx: { $nin: [0, 3] } })
  const racedStatus = lower(raced && raced.current_status)
  if (raced && ['completed', 'cancelled', 'rejected'].includes(racedStatus)) {
    return {
      status: racedStatus,
      changed: false,
      complete: true,
      pending: false,
      reason: racedStatus === 'completed' ? '' : 'terminal_status_preserved',
      item_count: children.length,
      completed_item_count: completedCount,
    }
  }
  return {
    status: racedStatus,
    changed: false,
    complete: true,
    pending: true,
    reason: 'compare_and_set_conflict',
    item_count: children.length,
    completed_item_count: completedCount,
  }
}

const reconcileOperationalStatus = async (statusRow, resultPayload, receiptId) => {
  const cpoeTargetStatus = ['resulted', 'corrected'].includes(resultPayload.overall_status)
    ? 'completed'
    : resultPayload.overall_status === 'cancelled'
      ? 'rejected'
      : ''
  const sourceItemId = sourceItemIdFromWork(statusRow)
  let cpoe = {
    status: '', changed: false, preservedTerminal: false, pending: false,
    reason: cpoeTargetStatus ? '' : 'unchanged_in_progress',
  }
  if (cpoeTargetStatus) {
    try {
      cpoe = await syncCpoeItemStatus(sourceItemId, cpoeTargetStatus)
    } catch (error) {
      cpoe = {
        status: '', changed: false, preservedTerminal: false, pending: true,
        reason: trimmed(error && error.message || error) || 'sync_failed',
      }
    }
  }

  let outbound = { status: '', changed: false, pending: false, reason: 'not_applicable' }
  if (['in_progress', 'resulted', 'corrected'].includes(resultPayload.overall_status)) {
    try {
      outbound = await reconcileOutboundFromResult(statusRow, resultPayload, receiptId)
    } catch (error) {
      outbound = {
        status: '', changed: false, pending: true,
        reason: trimmed(error && error.message || error) || 'sync_failed',
      }
    }
  }

  let parent = {
    status: '', changed: false, complete: false, pending: false,
    reason: 'unchanged_in_progress',
  }
  if (['resulted', 'corrected'].includes(resultPayload.overall_status)) {
    try {
      parent = await aggregateParentCpoeOrder(sourceItemId)
    } catch (error) {
      parent = {
        status: '', changed: false, complete: false, pending: true,
        reason: trimmed(error && error.message || error) || 'sync_failed',
      }
    }
  }

  const warnings = []
  if (cpoe.pending) warnings.push('CPOE Item status sync pending: ' + cpoe.reason)
  if (outbound.pending) warnings.push('Outbound status reconcile pending: ' + outbound.reason)
  if (parent.pending) warnings.push('CPOE parent status sync pending: ' + parent.reason)
  return { cpoe, outbound, parent, warnings }
}

const reconcileProcessedDuplicate = async (existingReceipt, resultPayload) => {
  try {
    const candidates = await queryRows(
      WORK_ITEM_FORM_ID,
      { labNo: resultPayload.filler_order_no },
      '`lab_no` = :labNo AND `xrstatx` NOT IN (0,3)',
      [],
      100
    )
    const exact = candidates.filter(row => {
      const workIds = [row._id, row.dataid, row.source_specimen_record_id].map(trimmed).filter(Boolean)
      return trimmed(row.lab_no) === resultPayload.filler_order_no &&
        workIds.includes(resultPayload.order_no) &&
        trimmed(row.patient_hn) === resultPayload.hn &&
        [trimmed(row.visit_id), trimmed(row.visit_vn)].filter(Boolean).includes(resultPayload.visit_id)
    })
    if (exact.length !== 1) {
      return {
        cpoe: { status: '', changed: false, pending: true, reason: 'work_item_not_matched' },
        outbound: { status: '', changed: false, pending: false, reason: 'not_run' },
        parent: { status: '', changed: false, complete: false, pending: false, reason: 'not_run' },
        warnings: ['Duplicate status reconcile pending: work_item_not_matched'],
      }
    }
    return reconcileOperationalStatus(exact[0], resultPayload, trimmed(existingReceipt._id))
  } catch (error) {
    const reason = trimmed(error && error.message || error) || 'sync_failed'
    return {
      cpoe: { status: '', changed: false, pending: true, reason },
      outbound: { status: '', changed: false, pending: false, reason: 'not_run' },
      parent: { status: '', changed: false, complete: false, pending: false, reason: 'not_run' },
      warnings: ['Duplicate status reconcile pending: ' + reason],
    }
  }
}

const wirePayload = params && params.payload && typeof params.payload === 'object'
  ? params.payload
  : params
const clinicalWirePayload = wirePayload && typeof wirePayload === 'object' && !Array.isArray(wirePayload)
  ? Object.keys(wirePayload).reduce((result, key) => {
    if (!transportMetadataFields.has(key)) result[key] = wirePayload[key]
    return result
  }, {})
  : wirePayload
const payload = clinicalWirePayload && typeof clinicalWirePayload === 'object' && !Array.isArray(clinicalWirePayload)
  ? Object.assign({}, clinicalWirePayload, {
    filler_order_no: firstText([
      clinicalWirePayload.filler_order_no,
      clinicalWirePayload.labno,
      clinicalWirePayload.lab_no,
    ]),
  })
  : clinicalWirePayload

/*
 * External authentication belongs to the action-scoped lis.receive API key and
 * API Factory permissions. The gateway service context may omit roles, so this
 * Process must not re-authorize from userInfo.roles or trust xpartnerx as proof.
 * Do not expose the legacy public-token/direct Process route for inbound results.
 */

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

// Gateway metadata is deliberately excluded from the clinical receipt/hash.
const rawPayload = JSON.stringify(clinicalWirePayload)
const receivedAt = isoThailand()
const workReportKey = [payload.order_no, payload.filler_order_no, payload.visit_id].join('|')
const payloadHash = stableHash(canonicalJson(clinicalWirePayload))
const agentInternalStatus = internalStatus(payload)
const criticalCount = payload.items.filter(item => criticalDecision(item).isCritical).length

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

let duplicateRows
try {
  duplicateRows = await queryRows(
    RECEIPT_FORM_ID,
    { resultUid: payload.result_uid },
    '`result_uid` = :resultUid AND `xrstatx` NOT IN (0,3)',
    [],
    1000
  )
} catch (error) {
  return { success: false, created: false, code: 'RECEIPT_LOOKUP_FAILED', message: trimmed(error.message || error) }
}

const receiptIdentityFields = ['order_no', 'filler_order_no', 'hn', 'visit_id', 'result_uid']
const receiptIdentityComplete = row => receiptIdentityFields.every(field => trimmed(row && row[field]))
const sameReceiptIdentity = row => receiptIdentityFields.every(field => trimmed(row && row[field]) === trimmed(payload[field]))
const matchingReceipts = duplicateRows.filter(sameReceiptIdentity)

if (matchingReceipts.length > 1) {
  return {
    success: false,
    created: false,
    duplicate: true,
    code: 'RESULT_UID_IDENTITY_AMBIGUOUS',
    message: 'พบ Receipt มากกว่า 1 record สำหรับ result_uid และ Order identity เดียวกัน; หยุดเพื่อป้องกันเลือกประวัติผิด',
    data: {
      result_uid: payload.result_uid,
      receipt_ids: matchingReceipts.map(row => trimmed(row._id)).filter(Boolean),
    },
  }
}

if (!matchingReceipts.length && duplicateRows.some(row => !receiptIdentityComplete(row))) {
  return {
    success: false,
    created: false,
    duplicate: true,
    code: 'RESULT_UID_IDENTITY_INCOMPLETE',
    message: 'พบ Receipt เดิมของ result_uid นี้ที่ไม่มี Order identity ครบ จึงยังแยกว่าเป็นคนละผลอย่างปลอดภัยไม่ได้',
    data: { result_uid: payload.result_uid },
  }
}

let receipt
let receiptCreated = false
let reprocessedReceipt = false

if (matchingReceipts.length === 1) {
  const existing = matchingReceipts[0]
  const existingStatus = lower(existing.receipt_status)
  const existingPayloadHash = storedPayloadHash(existing)
  if (!existingPayloadHash) {
    return {
      success: false,
      created: false,
      duplicate: true,
      code: 'RESULT_UID_PAYLOAD_UNVERIFIABLE',
      message: 'Receipt เดิมไม่มี payload fingerprint ที่ตรวจสอบได้ จึงไม่ replay เพื่อป้องกันผลผิดก้อน',
      data: {
        result_uid: payload.result_uid,
        receipt_id: trimmed(existing._id),
        receipt_status: existingStatus || 'unknown',
        result_report_id: trimmed(existing.result_report_id),
      },
    }
  }
  if (existingPayloadHash !== payloadHash) {
    return {
      success: false,
      created: false,
      duplicate: true,
      code: 'RESULT_UID_PAYLOAD_CONFLICT',
      message: 'result_uid และ Order identity เดิมถูกส่งมาด้วย payload ที่เปลี่ยนไป; ต้องใช้ result_uid ใหม่และเพิ่ม version/sequence ตามรอบผล',
      data: {
        result_uid: payload.result_uid,
        receipt_id: trimmed(existing._id),
        receipt_status: existingStatus || 'unknown',
        result_report_id: trimmed(existing.result_report_id),
      },
    }
  }
  if (existingStatus === 'processed') {
    // Reconcile operational state only from the already-processed Receipt.
    const storedPayload = {
      order_no: trimmed(existing.order_no),
      filler_order_no: trimmed(existing.filler_order_no),
      hn: trimmed(existing.hn),
      visit_id: trimmed(existing.visit_id),
      result_uid: trimmed(existing.result_uid),
      overall_status: lower(existing.agent_overall_status),
    }
    const storedStatusComplete = Boolean(storedPayload.overall_status)
    const reconciliation = storedStatusComplete
      ? await reconcileProcessedDuplicate(existing, storedPayload)
      : {
        cpoe: { status: '', changed: false, pending: true, reason: 'stored_receipt_status_incomplete' },
        outbound: { status: '', changed: false, pending: false, reason: 'not_run' },
        parent: { status: '', changed: false, complete: false, pending: false, reason: 'not_run' },
        warnings: ['Duplicate status reconcile pending: stored_receipt_status_incomplete'],
      }
    return {
      success: true,
      created: false,
      duplicate: true,
      code: 'DUPLICATE_RESULT_UID',
      message: reconciliation.warnings.length
        ? 'result_uid นี้ถูก HIS รับไว้แล้ว แต่มีสถานะรอ reconcile'
        : 'result_uid นี้ถูก HIS รับไว้แล้วและตรวจสถานะประกอบซ้ำสำเร็จ',
      data: {
        result_uid: payload.result_uid,
        receipt_id: trimmed(existing._id),
        receipt_status: trimmed(existing.receipt_status),
        result_report_id: trimmed(existing.result_report_id),
        cpoe_status: reconciliation.cpoe.status,
        cpoe_status_changed: reconciliation.cpoe.changed,
        cpoe_sync_pending: reconciliation.cpoe.pending,
        outbound_status: reconciliation.outbound.status,
        outbound_status_changed: reconciliation.outbound.changed,
        outbound_sync_pending: reconciliation.outbound.pending,
        parent_order_status: reconciliation.parent.status,
        parent_order_status_changed: reconciliation.parent.changed,
        parent_order_complete: reconciliation.parent.complete,
        parent_order_item_count: reconciliation.parent.item_count || 0,
        parent_order_completed_item_count: reconciliation.parent.completed_item_count || 0,
        parent_order_sync_pending: reconciliation.parent.pending,
        warnings: reconciliation.warnings,
      },
    }
  }

  try {
    receipt = await saveRecord(RECEIPT_FORM_ID, trimmed(existing._id), receiptData)
    reprocessedReceipt = true
  } catch (error) {
    return {
      success: false,
      created: false,
      duplicate: true,
      code: 'RECEIPT_RETRY_PREPARE_FAILED',
      message: 'เตรียม Receipt เดิมเพื่อประมวลผลซ้ำไม่สำเร็จ: ' + trimmed(error.message || error),
      data: { result_uid: payload.result_uid, receipt_id: trimmed(existing._id) },
    }
  }
}

if (!receipt) {
  try {
    receipt = await createRecord(RECEIPT_FORM_ID, receiptData)
    receiptCreated = true
  } catch (error) {
    return { success: false, created: false, code: 'RECEIPT_CREATE_FAILED', message: trimmed(error.message || error) }
  }
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
    created: receiptCreated,
    reprocessed_receipt: reprocessedReceipt,
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
    WORK_ITEM_FORM_ID,
    { labNo: payload.filler_order_no },
    '`lab_no` = :labNo AND `xrstatx` NOT IN (0,3)',
    [],
    100
  )
} catch (error) {
  return failAfterReceipt('ORDER_LOOKUP_FAILED', 'ค้นหา Lab Order ไม่สำเร็จ: ' + trimmed(error.message || error), 'error')
}

const exactStatusRows = statusRows.filter(row => {
  const sameLabNo = trimmed(row.lab_no) === payload.filler_order_no
  const workIds = [row._id, row.dataid, row.source_specimen_record_id].map(trimmed).filter(Boolean)
  const sameOrder = workIds.includes(payload.order_no)
  const sameHn = trimmed(row.patient_hn) === payload.hn
  const sameVisit = [trimmed(row.visit_id), trimmed(row.visit_vn)].filter(Boolean).includes(payload.visit_id)
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
const orderedSourceItemIds = new Set(orderedItems.map(item => firstText([
  item && item.source_item_id,
  item && item.source_cpoe_item_id,
  item && item.item_id,
])).filter(Boolean))
const relatedStatusRows = statusRows.filter(row => {
  const sameLabNo = trimmed(row.lab_no) === payload.filler_order_no
  const sameHn = trimmed(row.patient_hn) === payload.hn
  const sameVisit = [trimmed(row.visit_id), trimmed(row.visit_vn)].filter(Boolean).includes(payload.visit_id)
  const sourceItemId = sourceItemIdFromWork(row)
  const sameBatch = trimmed(row.receipt_batch_id) === payload.order_no
  return sameLabNo && sameHn && sameVisit && (
    trimmed(row._id) === statusId || sameBatch || orderedSourceItemIds.has(sourceItemId)
  )
})
const operationalStatusRows = relatedStatusRows.length ? relatedStatusRows : [statusRow]
const orderedCodes = new Set(orderedItems.map(item => firstText([
  item && item.test_code,
  item && item.his_code_id,
  item && item.obs_code,
  item && item.item_code,
  item && item.code,
])).filter(Boolean))

if (!orderedCodes.size) {
  return failAfterReceipt('ORDER_ITEMS_MISSING', 'Lab Order ไม่มี selected_items/test_code สำหรับจับคู่ผล', 'unmatched', { order_status_id: statusId })
}

const allowedResultCodes = new Set(orderedCodes)
orderedCodes.forEach(orderCode => {
  resultComponentsForOrderCode(orderCode).forEach(code => allowedResultCodes.add(code))
})

const matchedItems = payload.items.filter(item => allowedResultCodes.has(item.obs_code))
const unmatchedItems = payload.items.filter(item => !allowedResultCodes.has(item.obs_code))
if (!matchedItems.length) {
  return failAfterReceipt('OBS_CODE_NOT_MATCHED', 'ไม่มี obs_code ใดตรงกับ test_code หรือ result-component mapping ของ Lab Order', 'unmatched', {
    order_status_id: statusId,
    unmatched_obs_codes: unmatchedItems.map(item => item.obs_code),
  })
}

if (unmatchedItems.length) {
  return failAfterReceipt('OBS_CODE_PARTIAL_MISMATCH', 'มี obs_code ที่ไม่อยู่ใน Lab Order หรือ result-component mapping; ไม่บันทึกผลบางส่วนเพื่อป้องกันข้อมูลขาด', 'unmatched', {
    order_status_id: statusId,
    matched_obs_codes: matchedItems.map(item => item.obs_code),
    unmatched_obs_codes: unmatchedItems.map(item => item.obs_code),
  })
}

const payloadCodes = new Set(matchedItems.map(item => item.obs_code))
const missingExpectedCodes = Array.from(orderedCodes).filter(code => !orderCodeCoveredByPayload(code, payloadCodes))
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

let report = null
let resumedReport = false
if (reportRows.length) {
  const existingReport = reportRows[0]
  const canResumeReport = reportRows.length === 1 && reprocessedReceipt &&
    trimmed(existingReport.result_uid) === payload.result_uid
  if (!canResumeReport) {
    return failAfterReceipt('REPORT_STAGE_CONFLICT', 'report_seq/stage นี้มี Result Report แล้ว แต่ไม่ใช่ Report ที่ replay ได้จาก Receipt เดิม; หยุดเพื่อป้องกันการทับประวัติ', 'error', {
      order_status_id: statusId,
      result_report_id: trimmed(existingReport._id),
      report_key: reportKey,
    })
  }
  report = { id: trimmed(existingReport._id), data: existingReport }
  resumedReport = true
}

let latestReport = null
for (const row of workReports) {
  if (resumedReport && trimmed(row._id) === report.id) continue
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
    created: receiptCreated,
    reprocessed_receipt: reprocessedReceipt,
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

try {
  report = resumedReport
    ? await saveRecord(REPORT_FORM_ID, report.id, reportData)
    : await createRecord(REPORT_FORM_ID, reportData)
  if (!report.id) throw new Error('ไม่พบ Result Report ID หลังบันทึก')
  if (trimmed(reportData.result_report_id) !== report.id) {
    await saveRecord(REPORT_FORM_ID, report.id, { result_report_id: report.id })
  }
} catch (error) {
  return failAfterReceipt('REPORT_SAVE_FAILED', 'บันทึก Result Report ไม่สำเร็จ: ' + trimmed(error.message || error), 'error', { order_status_id: statusId })
}

let createdItemCount = 0
let updatedItemCount = 0
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
      result_comment: item.comment || '',
      interpretation_code: decision.interpretationCode,
      is_critical: decision.isCritical,
      result_source: 'agent',
      result_status: itemStatus(payload, item),
      result_uid: payload.result_uid,
      obx_status: item.obx_status,
      change_kind: item.change_kind,
      previous_value: '',
      receipt_seq: item.receipt_seq,
      result_version: item.result_version,
      critical_low_rule: item.critical_low_rule || '',
      critical_high_rule: item.critical_high_rule || '',
      entered_by: previous ? trimmed(previous.entered_by) : payload.reported_by.source_name,
      entered_at: previous ? trimmed(previous.entered_at) : payload.reported_at,
      // Agent resends replace the current value but never create HIS manual-editor audit.
      last_edited_by: previous ? trimmed(previous.last_edited_by) : '',
      last_edited_at: previous ? trimmed(previous.last_edited_at) : '',
      edit_history_json: '[]',
    }

    try {
      const previousId = trimmed(previous && (previous._id || previous.id))
      if (previousId) {
        await saveRecord(RESULT_ITEM_FORM_ID, previousId, rowData)
        updatedItemCount += 1
      } else {
        await createRecord(RESULT_ITEM_FORM_ID, rowData)
        createdItemCount += 1
      }
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
  for (const operationalRow of operationalStatusRows) {
    const operationalCurrentStatus = lower(operationalRow.work_status)
    const operationalNextStatus = requestedWorkStatus !== 'cancelled' &&
      (workStatusRank[operationalCurrentStatus] || 0) > (workStatusRank[requestedWorkStatus] || 0)
      ? operationalCurrentStatus
      : requestedWorkStatus
    const statusPatch = {
      work_status: operationalNextStatus,
      // Result-tab time is the latest report time for Partial/Final/Corrected.
      // Keep resulted_at reserved for the first Final completion timestamp.
      latest_result_at: newestTimestamp(operationalRow.latest_result_at, payload.reported_at),
    }
    if (!trimmed(operationalRow.resulted_at) && ['resulted', 'corrected'].includes(payload.overall_status)) {
      statusPatch.resulted_at = payload.verified_at || payload.reported_at
      statusPatch.resulted_by = payload.reported_by.source_name
    }
    await saveRecord(WORK_ITEM_FORM_ID, trimmed(operationalRow._id), statusPatch)
  }
} catch (error) {
  return failAfterReceipt('STATUS_SYNC_FAILED', 'เก็บผลแล้ว แต่ sync Work Status ไม่สำเร็จ: ' + trimmed(error.message || error), 'error', {
    order_status_id: statusId,
    result_report_id: report.id,
  })
}

const batchReconciliationWarnings = []
const batchCpoeTargetStatus = ['resulted', 'corrected'].includes(payload.overall_status)
  ? 'completed'
  : payload.overall_status === 'cancelled'
    ? 'rejected'
    : ''
if (batchCpoeTargetStatus && operationalStatusRows.length > 1) {
  for (const operationalRow of operationalStatusRows) {
    if (trimmed(operationalRow._id) === statusId) continue
    try {
      const sync = await syncCpoeItemStatus(sourceItemIdFromWork(operationalRow), batchCpoeTargetStatus)
      if (sync.pending) batchReconciliationWarnings.push('CPOE batch Item status sync pending: ' + sync.reason)
    } catch (error) {
      batchReconciliationWarnings.push('CPOE batch Item status sync pending: ' + (trimmed(error && error.message || error) || 'sync_failed'))
    }
  }
}
const reconciliation = await reconcileOperationalStatus(statusRow, payload, receipt.id)
const cpoeSync = reconciliation.cpoe
const outboundSync = reconciliation.outbound
const parentSync = reconciliation.parent

const finalReceiptStatus = 'processed'
const warnings = []
if (reportWarning) warnings.push(reportWarning)
warnings.push(...batchReconciliationWarnings)
warnings.push(...reconciliation.warnings)
const warning = warnings.join('; ')
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
  created: receiptCreated,
  reprocessed_receipt: reprocessedReceipt,
  resumed_report: resumedReport,
  duplicate: false,
  code: warning ? 'PROCESSED_WITH_WARNING' : 'PROCESSED',
  message: warning ? 'รับและบันทึกผล Lab สำเร็จ แต่มีข้อมูลรอ reconcile' : 'รับและบันทึกผล Lab สำเร็จ',
  data: {
    result_uid: payload.result_uid,
    receipt_id: receipt.id,
    receipt_status: finalReceiptStatus,
    result_report_id: report.id,
    order_status_id: statusId,
    order_status_ids: operationalStatusRows.map(row => trimmed(row._id)).filter(Boolean),
    report_key: reportKey,
    work_status: nextWorkStatus,
    cpoe_status: cpoeSync.status,
    cpoe_status_changed: cpoeSync.changed,
    cpoe_terminal_preserved: cpoeSync.preservedTerminal,
    cpoe_sync_pending: cpoeSync.pending,
    outbound_status: outboundSync.status,
    outbound_status_changed: outboundSync.changed,
    outbound_sync_pending: outboundSync.pending,
    parent_order_status: parentSync.status,
    parent_order_status_changed: parentSync.changed,
    parent_order_complete: parentSync.complete,
    parent_order_item_count: parentSync.item_count || 0,
    parent_order_completed_item_count: parentSync.completed_item_count || 0,
    parent_order_sync_pending: parentSync.pending,
    matched_item_count: matchedItems.length,
    unmatched_item_count: 0,
    unmatched_obs_codes: [],
    missing_expected_obs_codes: missingExpectedCodes,
    created_item_count: createdItemCount,
    updated_item_count: updatedItemCount,
    unchanged_version_item_count: unchangedVersionItemCount,
    report_item_count: allReportItems.length,
    critical_count: allReportItems.filter(row => row.is_critical === true).length,
    warnings,
  },
}
