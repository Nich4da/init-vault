/*
 * initCraft API Factory Process
 * Name: LAB CPOE Worklist + specimen correction + Result viewer/manual fallback
 * Deployed Process ID: 6a9434c3422c1ca959829d5e
 * Deployment reported by the user on 2026-08-30; deployed runtime/UAT is not yet verified.
 *
 * Purpose:
 * - Read LAB work from zdata_cpoe_order_item, not from an order mirror.
 * - Route each Item by section, then group rows back into one CPOE Order for UI.
 * - Prefer immutable Item snapshots when they exist; fall back to current masters
 *   while cpoe-order-save/send is being extended.
 *
 * Input:
 * {
 *   action?: 'list' | 'update_specimen' | 'get_manual_result' | 'save_manual_result',
 *   organization_code?: string,                      // App Organization (m1000-m1007)
 *   section_codes?: string[] | comma-separated string,
 *   statuses?: string[] | comma-separated string, // default: ['sent']
 *   date_from?: 'YYYY-MM-DD',
 *   date_to?: 'YYYY-MM-DD',
 *   hn?: string,                                  // exact HN only
 *   priorities?: string[] | comma-separated string,
 *   include_specimens?: boolean,                     // default true; false for count-only calls
 *   item_id?: string,                                // update_specimen only
 *   specimen_code?: string,                          // update_specimen only
 *   page?: number,                                // default: 1
 *   limit?: number                                // default: 30, max: 100
 * }
 *
 * Read is the default action. Write actions are specimen correction and audited
 * Manual Result persistence after receipt. Receive/Reject/Cancel remain out of scope.
 */

const ITEM_COLLECTION = 'zdata_cpoe_order_item'
const ORDER_COLLECTION = 'zdata_cpoe_order'
const ITEM_MASTER_COLLECTION = 'zdata_master_item_order'
const SECTION_COLLECTION = 'zdata_section'
const SPECIMEN_COLLECTION = 'zdata_specimen_code'
const RESULT_ITEM_FORM_ID = '6a7aa641935ed08882467374'

// App Organization ใช้ m100x แต่ Section master ใช้รหัสห้อง LAB คนละชุด
// จึงต้อง route ผ่าน mapping ที่ยืนยันจาก zdata_organization + zdata_section
const ORGANIZATION_SECTION_CODES = {
  M1000: ['BC', 'IM', 'BB', 'MB', 'HM', 'MY', 'HH', 'MI-OUT', 'BG', 'ML'],
  M1001: ['BC'],
  M1002: ['BB'],
  M1003: ['ML'],
  M0104: ['HM', 'HH'],
  M1004: ['HM', 'HH'],
  M1005: ['MB', 'MY'],
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

const objectArray = value => {
  if (Array.isArray(value)) return value.filter(row => row && typeof row === 'object')
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(row => row && typeof row === 'object') : []
  } catch (error) {
    return []
  }
}

const booleanValue = value => value === true || value === 1 || value === '1' || value === 'true'

const clampInt = (value, fallback, min, max) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.floor(number)))
}

const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value)

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

const allowedByContext = contextSections.map(row => valueText(row.code).trim().toUpperCase())
const allowedLookup = Object.fromEntries(allowedByContext.map(code => [code, true]))
const contextSectionMetadata = contextSections.map(row => ({
  id: valueText(row._id),
  code: valueText(row.code).trim().toUpperCase(),
  label: valueText(row.name_th || row.name || row.code).trim()
}))

if (requestedSectionCodes.some(code => !allowedLookup[code])) {
  return { success: false, message: 'ไม่มีสิทธิ์อ่าน Section ที่ร้องขอ' }
}

const allowedSectionCodes = requestedSectionCodes.length
  ? requestedSectionCodes
  : allowedByContext
const selectedSectionLookup = Object.fromEntries(allowedSectionCodes.map(code => [code, true]))
const allowedSections = contextSectionMetadata.filter(section => selectedSectionLookup[section.code])

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

const action = valueText(params.action).trim().toLowerCase() || 'list'

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
  return { item, master, section, order }
}

const resultRows = async (where, queryParams, orderBy, limit) => {
  const found = await app.sdformGetAll(
    {
      providerId: RESULT_ITEM_FORM_ID,
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

if (action === 'get_manual_result' || action === 'save_manual_result') {
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
  const itemStatus = valueText(context.item.current_status).trim().toLowerCase()
  const editableStatuses = ['accepted', 'prepared', 'ready', 'dispensed', 'resulted']
  const viewableStatuses = ['sent'].concat(editableStatuses, ['completed'])
  if (!viewableStatuses.includes(itemStatus) ||
    (action === 'save_manual_result' && !editableStatuses.includes(itemStatus))) {
    return {
      success: false,
      message: itemStatus === 'sent'
        ? 'ต้องรับ specimen ก่อนกรอกผล Manual'
        : 'สถานะ Item นี้ไม่อนุญาตให้กรอกผล Manual'
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
  const labNo = valueText(context.item.lab_no).trim()
  const patientHn = valueText(context.order.vid && context.order.vid.pid && context.order.vid.pid.hn).trim()
  const visitVn = valueText(context.order.vid && context.order.vid.vn).trim()
  const visitRecordId = valueText(context.order.xparentx).trim()
  const testCode = valueText(context.item.item_code).trim()
  const testName = valueText(context.item.item_name || (context.master && context.master.item_name) || testCode).trim()
  const specimenCode = valueText(labData.spec_source_code).trim()
  const specimenName = valueText(labData.spec_source || labData.source).trim()

  let currentRows = []
  let previousRows = []
  try {
    const sourceRows = await resultRows(
      'source_item_id = :itemId AND xrstatx NOT IN (0,3)',
      { itemId },
      [{ column: 'xupdatx', sort: 'DESC' }],
      50
    )
    let agentRows = []
    if (labNo) {
      agentRows = await resultRows(
        'filler_order_no = :labNo AND xrstatx NOT IN (0,3)',
        { labNo },
        [
          { column: 'result_version', sort: 'DESC' },
          { column: 'xupdatx', sort: 'DESC' }
        ],
        100
      )
    }
    const seenResultIds = {}
    currentRows = sourceRows.concat(agentRows).filter(row => {
      const rowId = valueText(row && (row._id || row.id)).trim()
      if (!rowId) return true
      if (seenResultIds[rowId]) return false
      seenResultIds[rowId] = true
      return true
    })
    if (patientHn && testCode) {
      previousRows = await resultRows(
        'patient_hn = :patientHn AND test_code = :testCode AND source_item_id != :itemId AND xrstatx NOT IN (0,3)',
        { patientHn, testCode, itemId },
        [
          { column: 'entered_at', sort: 'DESC' },
          { column: 'xupdatx', sort: 'DESC' }
        ],
        20
      )
    }
  } catch (error) {
    return { success: false, message: 'ค้นหารายการผลตรวจเดิมไม่สำเร็จ' }
  }

  // Never edit an Agent/LIS row in place. Manual entry owns its own row and a
  // later LIS result remains a separate version for explicit reconciliation.
  const current = currentRows.find(row =>
    valueText(row && row.result_source).trim().toLowerCase() === 'manual' &&
    valueText(row && row.source_item_id).trim() === itemId
  ) || null
  const patientPrevious = previousRows.find(row => {
    const status = valueText(row && row.result_status).trim().toLowerCase()
    return !['pending', 'draft', 'void', 'cancelled'].includes(status)
  }) || previousRows[0] || null
  const editBaseline = current || currentRows[0] || null

  const resultView = row => ({
    result_item_id: valueText(row && (row._id || row.id)).trim(),
    result_source: valueText(row && row.result_source).trim() || 'unknown',
    result_value: valueText(row && row.result_value),
    unit: valueText(row && (row.unit_symbol_snapshot || row.unit_symbol || row.units)),
    interpretation: valueText(row && row.interpretation_code),
    reference_range: valueText(row && (row.reference_range_snapshot || row.ref_range)),
    result_status: valueText(row && (row.result_status || row.obx_status)),
    is_critical: booleanValue(row && row.is_critical),
    critical_low_rule: valueText(row && row.critical_low_rule),
    critical_high_rule: valueText(row && row.critical_high_rule),
    entered_at: valueText(row && (row.entered_at || row.reported_at || row.xupdatx || row.xcreatx)),
    entered_by: valueText(row && (row.entered_by || row.reported_by_source_name)),
    test_code: valueText(row && (row.test_code || row.obs_code)) || testCode,
    test_name: valueText(row && (row.test_name || row.obs_name)) || testName
  })

  const responseData = savedRow => {
    const revisions = objectArray(savedRow && savedRow.edit_history_json)
    const previousRevision = revisions.length ? revisions[revisions.length - 1] : null
    return {
      item_id: itemId,
      result_item_id: valueText(savedRow && (savedRow._id || savedRow.id)).trim(),
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
      result_value: valueText(savedRow && savedRow.result_value),
      unit: valueText(savedRow && (savedRow.unit_symbol_snapshot || savedRow.unit_symbol || savedRow.units)),
      interpretation: valueText(savedRow && savedRow.interpretation_code),
      reference_range: valueText(savedRow && (savedRow.reference_range_snapshot || savedRow.ref_range)),
      is_critical: booleanValue(savedRow && savedRow.is_critical),
      result_status: valueText(savedRow && savedRow.result_status),
      result_entry: 'pencil',
      results: currentRows.map(resultView),
      revisions,
      previous: previousRevision ? {
        value: valueText(previousRevision.result_value),
        unit: valueText(previousRevision.unit),
        interpretation: valueText(previousRevision.interpretation),
        reference_range: valueText(previousRevision.reference_range),
        is_critical: booleanValue(previousRevision.is_critical),
        entered_at: valueText(previousRevision.changed_at),
        entered_by: valueText(previousRevision.changed_by),
        source: valueText(previousRevision.source)
      } : null,
      patient_previous: patientPrevious ? {
        value: valueText(patientPrevious.result_value),
        unit: valueText(patientPrevious.unit_symbol_snapshot || patientPrevious.unit_symbol || patientPrevious.units),
        interpretation: valueText(patientPrevious.interpretation_code),
        reference_range: valueText(patientPrevious.reference_range_snapshot),
        visit_vn: valueText(patientPrevious.visit_vn || patientPrevious.visit_id),
        entered_at: valueText(patientPrevious.entered_at || patientPrevious.xupdatx || patientPrevious.xcreatx)
      } : null
    }
  }

  if (action === 'get_manual_result') {
    const defaults = {
      result_value: '',
      unit_symbol_snapshot: valueText(masterLab.unit_symbol || masterLab.unit || context.master && context.master.unit),
      interpretation_code: '',
      reference_range_snapshot: valueText(masterLab.reference_range || masterLab.ref_range),
      is_critical: false,
      edit_history_json: '[]'
    }
    return {
      success: true,
      data: responseData(editBaseline || defaults),
      message: currentRows.length
        ? 'อ่านผลตรวจแล้ว'
        : itemStatus === 'sent'
          ? 'ยังไม่มีผลตรวจ; รับ specimen ก่อนใช้ปุ่มดินสอกรอกผล'
          : 'ยังไม่มีผลตรวจ; ใช้ปุ่มดินสอเพื่อกรอกผล Manual ได้'
    }
  }

  const manual = params.manual_result && typeof params.manual_result === 'object'
    ? params.manual_result
    : {}
  const clinical = {
    result_value: valueText(manual.result_value),
    unit_symbol_snapshot: valueText(manual.unit),
    interpretation_code: valueText(manual.interpretation),
    reference_range_snapshot: valueText(manual.reference_range),
    is_critical: booleanValue(manual.is_critical)
  }
  const hasClinicalValue = [
    clinical.result_value,
    clinical.unit_symbol_snapshot,
    clinical.interpretation_code,
    clinical.reference_range_snapshot
  ].some(value => value.trim())
  const now = app.curDate('YYYY-MM-DD HH:mm:ss')
  const actor = valueText(userInfo.username || userInfo.account && userInfo.account.name).trim()
  const history = objectArray(current && current.edit_history_json)
  const previousSource = current || editBaseline
  const changed = previousSource && (
    valueText(previousSource.result_value) !== clinical.result_value ||
    valueText(previousSource.unit_symbol_snapshot || previousSource.unit_symbol || previousSource.units) !== clinical.unit_symbol_snapshot ||
    valueText(previousSource.interpretation_code) !== clinical.interpretation_code ||
    valueText(previousSource.reference_range_snapshot || previousSource.ref_range) !== clinical.reference_range_snapshot ||
    booleanValue(previousSource.is_critical) !== clinical.is_critical
  )
  if (changed) {
    history.push({
      source: valueText(previousSource.result_source) || 'unknown',
      changed_at: now,
      changed_by: actor,
      result_value: valueText(previousSource.result_value),
      unit: valueText(previousSource.unit_symbol_snapshot || previousSource.unit_symbol || previousSource.units),
      interpretation: valueText(previousSource.interpretation_code),
      reference_range: valueText(previousSource.reference_range_snapshot || previousSource.ref_range),
      is_critical: booleanValue(previousSource.is_critical)
    })
  }
  const rowData = {
    order_status_id: orderId,
    order_id: orderId,
    order_no: orderNo,
    lab_no: labNo,
    lab_section: itemSectionCode,
    source_item_id: itemId,
    patient_hn: patientHn,
    visit_id: visitVn,
    visit_vn: visitVn,
    visit_record_id: visitRecordId,
    specimen_code: specimenCode,
    specimen_name: specimenName,
    result_sequence: Number(context.item.item_no || 1),
    test_code: testCode,
    obs_code: testCode,
    test_name: testName,
    ...clinical,
    result_source: 'manual',
    result_status: hasClinicalValue ? 'entered' : 'draft',
    previous_value: previousSource ? valueText(previousSource.result_value) : '',
    entered_at: current && valueText(current.entered_at) || (hasClinicalValue ? now : ''),
    entered_by: current && valueText(current.entered_by) || (hasClinicalValue ? actor : ''),
    last_edited_at: changed ? now : valueText(current && current.last_edited_at),
    last_edited_by: changed ? actor : valueText(current && current.last_edited_by),
    edit_history_json: JSON.stringify(history)
  }

  let resultItemId = valueText(current && (current._id || current.id)).trim()
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
    try {
      const statusSaved = await app.dbUpdate(
        { current_status: 'resulted', resulted_at: now, resulted_by: actor },
        ITEM_COLLECTION,
        userInfo,
        {
          _id: app.dbObjectId(itemId),
          xrstatx: { $nin: [0, 3] },
          current_status: { $in: editableStatuses.filter(status => status !== 'resulted') }
        }
      )
      if (!statusSaved || statusSaved.success === false) {
        return { success: false, message: 'บันทึกผลแล้ว แต่ปรับสถานะ CPOE Item ไม่สำเร็จ กรุณาให้ผู้ดูแลตรวจสอบ' }
      }
    } catch (error) {
      return { success: false, message: 'บันทึกผลแล้ว แต่ปรับสถานะ CPOE Item ไม่สำเร็จ กรุณาให้ผู้ดูแลตรวจสอบ' }
    }
  }

  return {
    success: true,
    data: {
      ...responseData({ _id: resultItemId, ...rowData }),
      results: [resultView({ _id: resultItemId, ...rowData })].concat(
        currentRows.filter(row => valueText(row && (row._id || row.id)).trim() !== resultItemId).map(resultView)
      )
    },
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
  try {
    const itemFound = await app.dbFindById(app.dbObjectId(itemId), ITEM_COLLECTION)
    item = itemFound && itemFound.reply && itemFound.reply.data
    if (!item || [0, 3].includes(item.xrstatx)) {
      return { success: false, message: 'ไม่พบ CPOE Item ที่ต้องการแก้ไข' }
    }
    if (valueText(item.service_type && item.service_type.value).toLowerCase() !== 'lab') {
      return { success: false, message: 'แก้ specimen ได้เฉพาะ LAB Item' }
    }
    if (valueText(item.current_status).toLowerCase() !== 'sent') {
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
            is_active: { $in: ['1', 1, true] },
            specimen_code: specimenCode
          },
          projection: { _id: 1, specimen_code: 1, specimen_name: 1 }
        }
      },
      false,
      false
    )
    const rows = found && found.success !== false && found.reply && Array.isArray(found.reply.data)
      ? found.reply.data
      : []
    specimen = rows.find(row => valueText(row.specimen_code).trim().toUpperCase() === specimenCode)
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
        current_status: 'sent'
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
            xrstatx: { $nin: [0, 3] },
            is_active: { $in: ['1', 1, true] }
          },
          projection: {
            _id: 1,
            specimen_code: 1,
            specimen_name: 1
          },
          sort: { specimen_name: 1, specimen_code: 1 }
        }
      },
      false,
      false
    )
    if (found && found.success !== false) {
      const rows = found.reply && Array.isArray(found.reply.data) ? found.reply.data : []
      specimenOptions = rows
        .map(row => ({
          value: valueText(row.specimen_code).trim(),
          label: valueText(row.specimen_name || row.specimen_code).trim()
        }))
        .filter(option => option.value)
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
const statuses = (requestedStatuses.length ? requestedStatuses : ['sent'])
  .filter(status => allowedStatuses[status])

if (!statuses.length) {
  return { success: false, message: 'ไม่พบสถานะที่รองรับในคำขอ' }
}

const page = clampInt(params.page, 1, 1, 1000000)
const limit = clampInt(params.limit, 30, 1, 100)
const skip = (page - 1) * limit
const hn = valueText(params.hn).trim()
const dateFrom = valueText(params.date_from).trim()
const dateTo = valueText(params.date_to).trim()
const priorities = listText(params.priorities || params.priority)
  .filter(priority => ['1', '2', '3', '4', '5'].includes(priority))

if ((dateFrom && !validDate(dateFrom)) || (dateTo && !validDate(dateTo))) {
  return { success: false, message: 'date_from/date_to ต้องเป็น YYYY-MM-DD' }
}

const itemMatch = {
  xrstatx: { $nin: [0, 3] },
  'service_type.value': 'lab',
  current_status: { $in: statuses }
}

const orderMatch = {
  'order.xrstatx': { $nin: [0, 3] }
}
if (hn) orderMatch['order.vid.pid.hn'] = hn
if (priorities.length) orderMatch['order.priority'] = { $in: priorities }
if (dateFrom || dateTo) {
  orderMatch['order.created_at'] = {}
  if (dateFrom) orderMatch['order.created_at'].$gte = dateFrom + ' 00:00:00'
  if (dateTo) orderMatch['order.created_at'].$lte = dateTo + ' 23:59:59'
}

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
          { $ifNull: ['$lab_context_snapshot.section', '$master.section'] }
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
  { $sort: { 'order.created_at': -1, created_at: 1, item_no: 1, item_code: 1 } },
  {
    $group: {
      _id: '$order._id',
      order: { $first: '$order' },
      items: {
        $push: {
          item_id: { $toString: '$_id' },
          item_code: '$item_code',
          item_name: '$item_name',
          quantity: '$quantity',
          current_status: '$current_status',
          service_type: '$service_type',
          item_master_id: { $toString: '$item_data_id' },
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
            parent_code: '$master.lab_parent.value'
          },
          lab_no: '$lab_no',
          received_at: '$received_at',
          received_by: '$received_by',
          rejected_at: '$rejected_at',
          rejected_by: '$rejected_by',
          reject_reason: '$reject_reason'
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
  { $sort: { requested_at: -1, order_number: -1 } },
  {
    $facet: {
      rows: [{ $skip: skip }, { $limit: limit }],
      meta: [{ $count: 'total' }]
    }
  }
]

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

// CPOE Order status may remain `sent` while Item-level LAB work has already
// advanced. Derive the worklist label from the Items that belong to this LAB
// context so a received Item is shown as received-awaiting-result immediately.
orders.forEach(order => {
  const itemStatuses = (Array.isArray(order && order.items) ? order.items : [])
    .map(item => valueText(item && item.current_status).trim().toLowerCase())
    .filter(Boolean)
  if (!itemStatuses.length) return
  const all = values => itemStatuses.every(status => values.includes(status))
  const some = values => itemStatuses.some(status => values.includes(status))
  if (all(['cancelled', 'rejected', 'returned', 'reversed'])) order.current_status = 'cancelled'
  else if (all(['completed'])) order.current_status = 'completed'
  else if (some(['resulted', 'completed'])) order.current_status = 'resulted'
  else if (all(['accepted', 'prepared', 'ready', 'dispensed'])) order.current_status = 'accepted'
  else if (some(['accepted', 'prepared', 'ready', 'dispensed'])) order.current_status = 'mixed'
  else order.current_status = 'sent'
})

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
    organization_code: organizationCode,
    unit_code: organizationCode,
    specimen_options: specimenOptions
  },
  message: 'อ่าน CPOE LAB worklist สำเร็จ'
}
