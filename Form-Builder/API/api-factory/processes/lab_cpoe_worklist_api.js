/*
 * initCraft API Factory Process
 * Name: LAB CPOE Worklist + specimen correction + Mycology Manual Result
 * Deployed Process ID: 6a9434c3422c1ca959829d5e
 * Deployment reported by the user on 2026-08-30; deployed runtime/UAT is not yet verified.
 *
 * Purpose:
 * - Read LAB work from zdata_cpoe_order_item, not from an order mirror.
 * - Route each Item by section, then group rows back into one CPOE Order for UI.
 * - Prefer immutable Item snapshots when they exist; fall back to current masters
 *   while cpoe-order-save/send is being extended.
 * - Manual Mycology writes the canonical Result Report/Result Item forms used by
 *   Agent callbacks. The legacy Result Item form is read-only fallback only.
 *
 * Input:
 * {
 *   action?: 'list' | 'list_open_visits' | 'update_specimen' | 'get_manual_result' | 'save_manual_result' | 'cancel_order',
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
 * Read is the default action. Write actions are specimen correction,
 * Mycology-only Manual Result persistence, and whole-Order cancellation.
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
const DIAGNOSIS_COLLECTION = 'zdata_diagnosis'
const VISIT_COLLECTION = 'zdata_visit'
const RESULT_REPORT_FORM_ID = '6a8d4334f851000f28e5025b'
const RESULT_ITEM_FORM_ID = '6a8bc91df851000f28e501fb'
const LEGACY_RESULT_ITEM_FORM_ID = '6a7aa641935ed08882467374'

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
  const actorCode = valueText(userInfo.employee_code || userInfo.username || userInfo.account && (userInfo.account.code || userInfo.account.name)).trim()
  const actorName = valueText(userInfo.fullname || userInfo.display_name || userInfo.account && (userInfo.account.label || userInfo.account.name) || actorCode).trim()
  const actorId = userInfo._id || userInfo.id || userInfo.account && (userInfo.account._id || userInfo.account.id) || ''
  if (!actorCode) {
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
    if (!allowedLookup[sectionCode]) {
      return { success: false, error: 'section_forbidden', message: 'Order นี้มี Item นอก Section ของ Organization ปัจจุบัน จึงยกเลิกทั้งใบไม่ได้' }
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

  const terminalStatuses = ['cancelled', 'rejected', 'returned', 'reversed']
  const legacyWaitingStatuses = ['accepted', 'prepared', 'ready', 'dispensed']
  let cancellation = await cancellationCollection.findOne({ _id: orderObjectId, xrstatx: active })
  const cancellable = []
  for (let index = 0; index < contexts.length; index += 1) {
    const context = contexts[index]
    const workStatus = valueText(context.workItem && context.workItem.work_status).trim().toLowerCase()
    const cpoeStatus = valueText(context.item.current_status).trim().toLowerCase()
    const status = workStatus || cpoeStatus
    if (terminalStatuses.includes(status)) continue
    if (context.outbound) {
      const outboundStatus = valueText(context.outbound.hl7_status).trim().toLowerCase()
      const alreadyCancelledOutbound = outboundStatus === 'cancelled' && Boolean(cancellation)
      const attempted = !alreadyCancelledOutbound && (Number(context.outbound.attempt_count || 0) > 0 ||
        Boolean(valueText(context.outbound.sent_at || context.outbound.last_success_at).trim()) ||
        !['', 'new', 'pending', 'ready'].includes(outboundStatus))
      if (attempted) {
        return { success: false, error: 'lis_cancel_required', message: 'Order นี้เคยส่งออกไป Agent/LIS แล้ว ต้องใช้ API ยกเลิกฝั่ง LIS ซึ่งยังไม่เปิดใช้' }
      }
    }
    if (context.workItem) {
      if (!['waiting_receive', 'received'].includes(workStatus)) {
        return { success: false, error: 'item_not_cancellable', message: 'ยกเลิก Order ไม่ได้ เพราะมี Item อยู่ในสถานะ ' + (workStatus || 'ไม่ทราบสถานะ') }
      }
    } else {
      const hasReceiptEvidence = Boolean(valueText(context.item.received_at || context.item.lab_no).trim())
      const effectiveStatus = legacyWaitingStatuses.includes(cpoeStatus) && !hasReceiptEvidence ? 'sent' : cpoeStatus
      if (effectiveStatus !== 'sent') {
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

  let alreadyCancelled = Boolean(cancellation)
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
      cancel_type: 'lab_order_cancelled',
      cancel_status: 'pending',
      cancel_reason: cancelReason,
      cancelled_at: now,
      cancelled_by: actorAudit,
      organization_code: organizationCode,
      section_codes: contexts.map(context => context.sectionCode).filter((code, index, rows) => rows.indexOf(code) === index),
      item_ids: contexts.map(context => context.itemId),
      created_at: now,
      created_by: actorAudit,
      updated_at: now,
      updated_by: actorAudit
    }
    try {
      await cancellationCollection.insertOne(cancellationDoc)
      cancellation = cancellationDoc
    } catch (error) {
      cancellation = await cancellationCollection.findOne({ _id: orderObjectId, xrstatx: active })
      if (!cancellation) throw error
      alreadyCancelled = true
    }
  }

  const cancellationId = valueText(cancellation._id).trim() || orderId
  const authoritativeReason = valueText(cancellation.cancel_reason).trim() || cancelReason
  const authoritativeAt = valueText(cancellation.cancelled_at).trim() || now
  const authoritativeBy = cancellation.cancelled_by || actorAudit
  let cancelledCount = 0
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
      const stopped = await outboundCollection.updateOne(
        { _id: context.outbound._id, xrstatx: active, attempt_count: 0, hl7_status: { $in: ['', 'new', 'pending', 'ready'] } },
        { $set: {
          hl7_status: 'cancelled',
          retryable: false,
          last_status_at: authoritativeAt,
          updated_at: now,
          updated_by: actorCode,
          last_error_code: 'order_cancelled',
          last_error_at: authoritativeAt,
          last_error_reason: authoritativeReason
        } }
      )
      if (!stopped || Number(stopped.matchedCount) !== 1) {
        await cancellationCollection.updateOne(
          { _id: orderObjectId, xrstatx: active },
          { $set: { cancel_status: 'conflict', conflict_item_id: context.itemId, updated_at: now, updated_by: actorAudit } }
        )
        return { success: false, error: 'cancel_race_lost', message: 'สถานะ Outbound เปลี่ยนระหว่างยกเลิก จึงหยุดเพื่อไม่ให้ HIS ขัดกับ Agent/LIS' }
      }
    }
    if (context.workItem) {
      const saved = await workCollection.updateOne(
        { _id: context.workItem._id, xrstatx: active, work_status: { $in: ['waiting_receive', 'received'] } },
        { $set: cancelPatch }
      )
      if (!saved || Number(saved.matchedCount) !== 1) {
        await cancellationCollection.updateOne(
          { _id: orderObjectId, xrstatx: active },
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
            { _id: orderObjectId, xrstatx: active },
            { $set: { cancel_status: 'conflict', conflict_item_id: context.itemId, updated_at: now, updated_by: actorAudit } }
          )
          return { success: false, error: 'cancel_race_lost', message: 'สถานะ Item เปลี่ยนระหว่างยกเลิก กรุณาโหลดใหม่และให้ผู้ดูแลตรวจสอบ' }
        }
      }
    }
    cancelledCount += 1
  }

  let auditSyncPending = false
  try {
    const stamped = await cancellationCollection.updateOne(
      { _id: orderObjectId, xrstatx: active, cancel_status: { $in: ['pending', 'applied'] } },
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
      current_status: 'cancelled',
      cancel_type: 'lab_order_cancelled',
      cancel_reason: authoritativeReason,
      cancelled_at: authoritativeAt,
      cancelled_by: authoritativeBy,
      item_count: contexts.length,
      cancelled_item_count: cancelledCount,
      preserved_terminal_item_count: contexts.length - cancelledCount,
      cancellation_record_id: cancellationId,
      already_cancelled: alreadyCancelled,
      audit_sync_pending: auditSyncPending,
      cpoe_unchanged: true
    },
    message: auditSyncPending
      ? 'ยกเลิก LAB Order แล้ว แต่ Cancellation Log ยังรอ reconcile'
      : alreadyCancelled
        ? 'LAB Order นี้ถูกยกเลิกแล้ว'
        : 'ยกเลิก LAB Order แล้ว'
  }
}

if (action === 'list_open_visits') {
  const nowText = typeof app.curDate === 'function' ? valueText(app.curDate()) : ''
  const visitDate = validDate(nowText.slice(0, 10))
    ? nowText.slice(0, 10)
    : new Date(Date.now() + (7 * 60 * 60 * 1000)).toISOString().slice(0, 10)

  try {
    const found = await app.dbFindAll(
      {
        from: VISIT_COLLECTION,
        nosql: {
          type: 'query',
          collection: VISIT_COLLECTION,
          query: {
            xrstatx: { $nin: [0, 3] },
            visit_date: visitDate,
            visit_status: true
          },
          projection: {
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
          },
          sort: { vn: 1 },
          limit: 2000
        }
      },
      false,
      false
    )
    if (!found || found.success === false) {
      return { success: false, message: 'อ่าน Visit ที่เปิดอยู่วันนี้ไม่สำเร็จ' }
    }
    const visits = found.reply && Array.isArray(found.reply.data) ? found.reply.data : []
    return {
      success: true,
      data: {
        visits,
        total: visits.length,
        visit_date: visitDate,
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
  if (action === 'save_manual_result' && itemSectionCode !== 'MY') {
    return { success: false, message: 'กรอกผล Manual จาก Worklist นี้ได้เฉพาะ Mycology (MY)' }
  }

  const itemStatus = effectiveItemStatus(context)
  const editableStatuses = ['accepted', 'prepared', 'ready', 'dispensed', 'resulted']
  const viewableStatuses = ['sent', ...editableStatuses, 'completed']
  if (action === 'get_manual_result' && !viewableStatuses.includes(itemStatus)) {
    return { success: false, message: 'สถานะ Item นี้ไม่อนุญาตให้ดูผลตรวจ' }
  }
  if (action === 'save_manual_result' && !editableStatuses.includes(itemStatus)) {
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
  const workItemId = valueText(context.workItem && context.workItem._id).trim()
  const workOrderNo = valueText(context.workItem && context.workItem.dataid).trim() || itemId
  const labNo = valueText(context.workItem && context.workItem.lab_no).trim()
  const patientHn = valueText(context.order.vid && context.order.vid.pid && context.order.vid.pid.hn).trim()
  const visitVn = valueText(context.order.vid && context.order.vid.vn).trim()
  const visitRecordId = valueText(context.order.xparentx).trim()
  const testCode = valueText(context.item.item_code).trim()
  const testName = valueText(context.item.item_name || (context.master && context.master.item_name) || testCode).trim()
  const specimenCode = valueText(labData.spec_source_code).trim()
  const specimenName = valueText(labData.spec_source || labData.source).trim()

  let currentRows = []
  let previousRows = []
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
    if (!currentRows.length) {
      currentRows = await legacyResultRows(
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
        previousRows = await legacyResultRows(
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
  const currentClinicalRows = latestByIdentity(currentRows)
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
  const resultData = row => ({
    result_item_id: valueText(row && (row._id || row.id)).trim(),
    result_definition_id: valueText(row && row.result_definition_id),
    test_code: valueText(row && (row.obs_code || row.test_code)) || testCode,
    test_name: valueText(row && (row.obs_name || row.test_name)) || testName,
    result_value: valueText(row && row.result_value),
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
      previous: previousData(previous),
      results: displayRows.map(resultData)
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
    const orderRef = item.order_id && item.order_id.value ? item.order_id.value : item.xparentx
    const orderId = valueText(orderRef).trim()
    if (/^[a-f0-9]{24}$/i.test(orderId)) {
      const cancellation = await app.db.collection(ORDER_CANCELLATION_COLLECTION).findOne({
        _id: app.dbObjectId(orderId),
        xrstatx: { $nin: [0, 3] },
        cancel_status: { $in: ['pending', 'applied'] }
      })
      if (cancellation) return { success: false, message: 'Order นี้ถูกยกเลิกแล้ว จึงแก้ specimen ไม่ได้' }
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
  'service_type.value': 'lab'
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
      from: WORK_ITEM_COLLECTION,
      let: { source_item_id: { $toString: '$_id' } },
      pipeline: [
        {
          $match: {
            xrstatx: { $nin: [0, 3] },
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
    $lookup: {
      from: ORDER_CANCELLATION_COLLECTION,
      let: { source_order_id: { $toString: '$order_ref_id' } },
      pipeline: [
        {
          $match: {
            xrstatx: { $nin: [0, 3] },
            cancel_status: { $in: ['pending', 'applied'] },
            $expr: { $eq: ['$source_order_id', '$$source_order_id'] }
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
                  { $in: ['$current_status', ['accepted', 'prepared', 'ready', 'dispensed']] },
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
  { $match: { effective_status: { $in: statuses } } },
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
          current_status: '$effective_status',
          work_status: '$work_item.work_status',
          work_item_id: { $toString: '$work_item._id' },
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
          lab_no: { $ifNull: ['$work_item.lab_no', '$lab_no'] },
          received_at: { $ifNull: ['$work_item.received_at', '$received_at'] },
          received_by: { $ifNull: ['$work_item.received_by', '$received_by'] },
          resulted_at: { $ifNull: ['$work_item.resulted_at', '$resulted_at'] },
          is_critical: '$is_critical',
          result_summary: '$result_summary',
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
    $project: {
      _id: 0,
      _diagnosis_visit_id: '$order.xparentx',
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
