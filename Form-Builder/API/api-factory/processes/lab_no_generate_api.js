/*
 * initCraft API Factory Process
 * Name: LAB - Generate LAB NO. and reserve a Lab Work Item
 * Deployed Process ID: 6a94f1ed422c1ca959829d6e
 * Input: {
 *   item_id?: '<zdata_cpoe_order_item _id>',
 *   item_ids?: ['<zdata_cpoe_order_item _id>', '...']
 * }
 * Output LAB NO.: SSYYMMDDNNNN
 *
 * CPOE is read-only. The LAB NO. is owned by zdata_lab_work_item. A retry for
 * the same CPOE Item returns the same Work Item/LAB NO. without consuming a
 * second counter. Daily counters are isolated by section and stop at 9999.
 * A legacy interrupted receipt may leave CPOE accepted/prepared without any
 * Work Item, LAB NO. or receipt evidence; that exact state is recoverable
 * through the same idempotent reservation path.
 * Replica sets use mongoTxn; standalone MongoDB falls back to an atomic counter
 * and the Work Item _id as the idempotency lock. A crash/race may leave a safe
 * sequence gap, but a reserved number is never reused.
 */

const ITEM_COLLECTION = 'zdata_cpoe_order_item'
const ORDER_COLLECTION = 'zdata_cpoe_order'
const ITEM_MASTER_COLLECTION = 'zdata_master_item_order'
const SECTION_COLLECTION = 'zdata_section'
const WORK_ITEM_COLLECTION = 'zdata_lab_work_item'
const ORDER_CANCELLATION_COLLECTION = 'zdata_lab_order_cancellation'
const COUNTER_COLLECTION = 'zdata_lab_no_counter'
const MAX_DAILY_SEQUENCE = 9999

const SECTION_PREFIX = {
  BC: '10', HM: '20', ML: '21', HH: '22', IM: '30', 'MI-OUT': '31',
  MB: '40', MY: '41', BB: '50', BG: '70'
}
const ORGANIZATION_SECTION_CODES = {
  // M1000 is the dedicated MY/manual-result Organization (verified 2026-09-21).
  M1000: ['MY'],
  M1001: ['BC'], M1002: ['BB'], M1003: ['ML'], M0104: ['HM', 'HH'],
  M1004: ['HM', 'HH'], M1005: ['MB'], M1006: ['IM', 'MI-OUT'],
  M1007: ['BG'], '10': ['BC'], '20': ['HM'], '20-22': ['HM', 'HH'],
  '21': ['ML'], '22': ['HH'], '30': ['IM'], '31': ['MI-OUT'],
  '40': ['MB'], '41': ['MY'], '50': ['BB'], '70': ['BG']
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
const jsonArray = value => {
  try {
    const parsed = JSON.parse(text(value))
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}
const transactionUnsupported = error => {
  const message = text(error && error.message || error).toLowerCase()
  return message.includes('transaction numbers are only allowed on a replica set member or mongos') ||
    message.includes('transaction support is not available')
}
const active = { $nin: [0, 3] }
const requestedItemIds = Array.from(new Set(
  (Array.isArray(params && params.item_ids) ? params.item_ids : [params && params.item_id])
    .map(text)
    .filter(Boolean)
))
const itemId = requestedItemIds[0] || ''

if (!requestedItemIds.length || requestedItemIds.some(id => !/^[a-f0-9]{24}$/i.test(id))) {
  return { success: false, message: 'item_id/item_ids ไม่ถูกต้อง' }
}
if (requestedItemIds.length > 100) return { success: false, message: 'สร้าง LAB NO. ได้ไม่เกิน 100 รายการต่อชุด' }
if (!app.isAuth(userInfo.roles || [])) return { success: false, message: 'ไม่มีสิทธิ์สร้าง LAB NO.' }

const organizationCode = text(userInfo.unit && userInfo.unit.code).toUpperCase()
const allowedSections = ORGANIZATION_SECTION_CODES[organizationCode] || []
if (!allowedSections.length) return { success: false, message: 'Organization ปัจจุบันไม่ได้ผูกกับห้อง LAB' }

const now = text(app.curDate('YYYY-MM-DD HH:mm:ss'))
const localDateKey = now.slice(0, 10)
const localDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDateKey)
if (!localDateMatch) return { success: false, message: 'อ่านวันที่ปัจจุบันจากระบบไม่สำเร็จ' }
const gregorianYear = Number(localDateMatch[1])
if (!Number.isInteger(gregorianYear) || gregorianYear < 1900 || gregorianYear > 9999) {
  return { success: false, message: 'อ่านปีปัจจุบันจากระบบไม่สำเร็จ' }
}
const buddhistYear = gregorianYear + 543
const buddhistYearTwoDigits = String(buddhistYear % 100).padStart(2, '0')
const monthTwoDigits = localDateMatch[2]
const dayTwoDigits = localDateMatch[3]
const buddhistDateKey = String(buddhistYear) + '-' + monthTwoDigits + '-' + dayTwoDigits
const actorCode = text(userInfo.employee_code || userInfo.username || userInfo.account && userInfo.account.name)
const actorName = text(userInfo.fullname || userInfo.display_name || userInfo.account && (userInfo.account.label || userInfo.account.name) || actorCode)
const actorId = userInfo._id || userInfo.id || userInfo.account && (userInfo.account._id || userInfo.account.id) || ''
const actorAudit = { id: actorId, name: actorName || actorCode }
const itemObjectId = app.dbObjectId(itemId)

/*
 * 2026-09-09 LIS batch contract:
 * one Receive action for several Items of the same CPOE Order/section/specimen
 * reserves one LAB NO. shared by every per-Item Work Item. The legacy one-Item
 * path below is intentionally left intact for existing callers.
 */
const assignBatchLabNo = async session => {
  const sessionOptions = session ? { session } : {}
  const itemCollection = app.db.collection(ITEM_COLLECTION)
  const orderCollection = app.db.collection(ORDER_COLLECTION)
  const masterCollection = app.db.collection(ITEM_MASTER_COLLECTION)
  const sectionCollection = app.db.collection(SECTION_COLLECTION)
  const workCollection = app.db.collection(WORK_ITEM_COLLECTION)
  const counterCollection = app.db.collection(COUNTER_COLLECTION)
  const cancellationCollection = app.db.collection(ORDER_CANCELLATION_COLLECTION)
  const canonicalItemIds = requestedItemIds.slice().sort()
  const defaultBatchId = canonicalItemIds[0]
  const contexts = []

  for (const currentItemId of requestedItemIds) {
    const objectId = app.dbObjectId(currentItemId)
    const item = await itemCollection.findOne({ _id: objectId, xrstatx: active }, sessionOptions)
    if (!item) throw new Error('ITEM_NOT_FOUND')
    if (text(item.service_type && item.service_type.value).toLowerCase() !== 'lab') throw new Error('ITEM_NOT_LAB')
    const orderRef = item.order_id && item.order_id.value ? item.order_id.value : item.xparentx
    if (!orderRef) throw new Error('ORDER_REFERENCE_MISSING')
    const order = await orderCollection.findOne({ _id: orderRef, xrstatx: active }, sessionOptions)
    if (!order) throw new Error('ORDER_NOT_FOUND')
    const cancellationOrderId = typeof orderRef === 'string' ? app.dbObjectId(orderRef) : orderRef
    const cancellation = await cancellationCollection.findOne({
      _id: cancellationOrderId,
      xrstatx: active,
      cancel_status: { $in: ['pending', 'applied'] }
    }, sessionOptions)
    if (cancellation) throw new Error('ORDER_CANCELLED')

    let master = null
    if (item.item_data_id) master = await masterCollection.findOne({ _id: item.item_data_id, xrstatx: active }, sessionOptions)
    let section = item.section_snapshot ||
      (item.lab_context_snapshot && item.lab_context_snapshot.section) ||
      (master && master.section) || {}
    if (!text(section.code) && section.value) {
      const sectionId = typeof section.value === 'string' ? app.dbObjectId(section.value) : section.value
      const foundSection = await sectionCollection.findOne(
        { _id: sectionId, xrstatx: active, enable: { $ne: false } }, sessionOptions
      )
      if (foundSection) section = foundSection
    }
    const existing = await workCollection.findOne({
      xrstatx: active,
      is_current_attempt: { $ne: false },
      $or: [{ _id: objectId }, { source_specimen_record_id: currentItemId }]
    }, { sort: { attempt_no: -1, updated_at: -1, created_at: -1 }, ...sessionOptions })
    const itemStatus = text(item.current_status).toLowerCase()
    const pendingMarkedLabNo = Boolean(
      existing && !text(existing.lab_no) &&
      (existing.retest_pending_lab_no === true || existing.cbc_swap_pending_lab_no === true)
    )
    if ((!existing || pendingMarkedLabNo) && itemStatus !== 'ready') throw new Error('PAYMENT_NOT_READY')
    const retestPending = Boolean(
      existing && existing.retest_pending_lab_no === true && !text(existing.lab_no) &&
      text(existing.work_status).toLowerCase() === 'waiting_receive' && itemStatus === 'ready'
    )
    const cbcSwapPending = Boolean(
      existing && existing.cbc_swap_active === true && existing.cbc_swap_pending_lab_no === true &&
      !text(existing.lab_no) && text(existing.work_status).toLowerCase() === 'waiting_receive' &&
      itemStatus === 'ready' && ['HM1', 'MS1'].includes(text(existing.effective_item_code).toUpperCase())
    )
    if (cbcSwapPending) {
      const effectiveMasterId = text(existing.effective_item_master_id)
      if (!effectiveMasterId) throw new Error('CBC_SWAP_MASTER_MISSING')
      master = await masterCollection.findOne({ _id: app.dbObjectId(effectiveMasterId), xrstatx: active }, sessionOptions)
      if (!master) throw new Error('CBC_SWAP_MASTER_MISSING')
      section = { code: text(existing.section_code).toUpperCase(), name: text(existing.section_name) }
    }
    const sectionCode = text(section.code).toUpperCase()
    if (!allowedSections.includes(sectionCode)) throw new Error('SECTION_FORBIDDEN')
    if (!SECTION_PREFIX[sectionCode]) throw new Error('SECTION_PREFIX_MISSING')
    if (existing && !retestPending && !cbcSwapPending && !text(existing.lab_no)) throw new Error('WORK_ITEM_WITHOUT_LAB_NO')

    const labData = item.lab_data && typeof item.lab_data === 'object' ? item.lab_data : {}
    const masterLab = master && master.lab_item && typeof master.lab_item === 'object' ? master.lab_item : {}
    const masterSpecimen = masterLab.specimen && !Array.isArray(masterLab.specimen) ? masterLab.specimen : {}
    const specimenCode = text(labData.spec_source_code || masterSpecimen.code)
    const specimenName = text(labData.spec_source || labData.source || masterSpecimen.name)
    contexts.push({
      itemId: currentItemId,
      objectId,
      item,
      order,
      orderRef: text(orderRef),
      master,
      masterLab,
      labData,
      specimenCode,
      specimenName,
      specimenKey: (specimenCode || specimenName).toUpperCase(),
      sectionCode,
      sectionName: text(section.name_th || section.name || section.label || sectionCode),
      existing,
      retestPending,
      cbcSwapPending
    })
  }

  if (new Set(contexts.map(row => row.orderRef)).size !== 1) throw new Error('BATCH_ORDER_MISMATCH')
  if (new Set(contexts.map(row => row.sectionCode)).size !== 1) throw new Error('BATCH_SECTION_MISMATCH')
  if (new Set(contexts.map(row => row.specimenKey)).size !== 1) throw new Error('BATCH_SPECIMEN_MISMATCH')
  // A reopened Item owns a fresh Work Item identity/idempotency key. Keep it
  // isolated from legacy multi-item receipt batches so no sibling can inherit
  // the new attempt's transport identity.
  if (contexts.length > 1 && contexts.some(row => row.retestPending)) throw new Error('BATCH_RETEST_ITEM_MUST_BE_SINGLE')

  const sectionCode = contexts[0].sectionCode
  const sectionPrefix = SECTION_PREFIX[sectionCode]
  const selectedItems = contexts
    .slice()
    .sort((left, right) => (Number(left.item.item_no || 0) - Number(right.item.item_no || 0)) || left.itemId.localeCompare(right.itemId))
    .map((row, index) => ({
      seq: index + 1,
      source_item_id: row.itemId,
      item_code: row.cbcSwapPending ? text(row.existing.effective_item_code) : text(row.item.item_code),
      item_name: row.cbcSwapPending ? text(row.existing.effective_item_name || row.master && row.master.item_name) : text(row.item.item_name || row.master && row.master.item_name),
      test_code: text(row.masterLab.his_lab_code),
      specimen_code: row.specimenCode
    }))
  const selectionMatches = row => {
    const storedIds = jsonArray(row && row.selected_items_json)
      .map(entry => text(entry && entry.source_item_id))
      .filter(Boolean)
      .sort()
    return storedIds.length === canonicalItemIds.length && storedIds.every((id, index) => id === canonicalItemIds[index])
  }
  const assignedContexts = contexts.filter(row => row.existing && !row.retestPending && !row.cbcSwapPending && text(row.existing.lab_no))
  const assignedLabNos = Array.from(new Set(assignedContexts.map(row => text(row.existing.lab_no))))
  if (assignedLabNos.length > 1) throw new Error('BATCH_ALREADY_SPLIT')
  if (assignedContexts.length && assignedContexts.some(row => !selectionMatches(row.existing))) {
    throw new Error('BATCH_ALREADY_ASSIGNED')
  }
  if (assignedContexts.length && contexts.some(row => row.retestPending || row.cbcSwapPending)) throw new Error('BATCH_RETEST_MISMATCH')

  let labNo = assignedLabNos[0] || ''
  let batchId = text(assignedContexts[0] && assignedContexts[0].existing.receipt_batch_id) || defaultBatchId
  let sequence = Number(assignedContexts[0] && assignedContexts[0].existing.lab_no_sequence || 0) || null
  let newlyReserved = false

  if (!labNo) {
    const counterId = ['lab_no', sectionCode, localDateKey].join(':')
    const counterResult = await counterCollection.findOneAndUpdate(
      { _id: counterId },
      [{ $set: {
        section_code: sectionCode,
        section_prefix: sectionPrefix,
        buddhist_year: buddhistYear,
        year_two_digits: buddhistYearTwoDigits,
        date_key: localDateKey,
        buddhist_date_key: buddhistDateKey,
        month_two_digits: monthTwoDigits,
        day_two_digits: dayTwoDigits,
        format_version: 2,
        daily_limit_reached: { $gte: [{ $ifNull: ['$sequence', 0] }, MAX_DAILY_SEQUENCE] },
        sequence: {
          $let: {
            vars: { current: { $ifNull: ['$sequence', 0] } },
            in: { $cond: [{ $gte: ['$$current', MAX_DAILY_SEQUENCE] }, '$$current', { $add: ['$$current', 1] }] }
          }
        },
        created_at: { $ifNull: ['$created_at', now] },
        updated_at: now,
        updated_by: actorCode
      } }],
      { upsert: true, returnDocument: 'after', ...sessionOptions }
    )
    const counter = counterResult && (counterResult.value || counterResult)
    if (counter && counter.daily_limit_reached === true) throw new Error('DAILY_LIMIT_REACHED')
    sequence = Number(counter && counter.sequence)
    if (!Number.isInteger(sequence) || sequence < 1 || sequence > MAX_DAILY_SEQUENCE) throw new Error('COUNTER_INVALID')
    labNo = sectionPrefix + buddhistYearTwoDigits + monthTwoDigits + dayTwoDigits + String(sequence).padStart(4, '0')
    const duplicate = await workCollection.findOne({ lab_no: labNo, xrstatx: active }, { projection: { _id: 1 }, ...sessionOptions })
    if (duplicate) throw new Error('LAB_NO_COLLISION')
    newlyReserved = true
  }

  const buildWorkItem = row => {
    const patient = row.order.vid && row.order.vid.pid || {}
    const patientHn = text(patient.hn)
    if (!patientHn) throw new Error('PATIENT_HN_MISSING')
    const patientName = [text(patient.prename), text(patient.p_fname || patient.first_name), text(patient.p_lname || patient.last_name)]
      .filter(Boolean).join(' ') || patientHn
    return {
      _id: row.objectId,
      xparentx: row.objectId,
      xsitex: userInfo.site || {},
      xunitx: { code: sectionCode, name: row.sectionName },
      xrstatx: 1,
      xversionx: 'v1',
      xerrorx: null,
      dataid: row.itemId,
      created_by: actorAudit,
      created_at: now,
      updated_by: actorAudit,
      updated_at: now,
      source_order_id: text(row.order._id),
      source_order_number: text(row.order.order_number),
      source_specimen_record_id: row.itemId,
      receipt_batch_id: batchId,
      batch_item_count: contexts.length,
      lab_no: labNo,
      section_code: sectionCode,
      section_name: row.sectionName,
      work_status: 'waiting_receive',
      patient_hn: patientHn,
      visit_id: text(row.order.vid && (row.order.vid.vn || row.order.vid.value) || row.order.xparentx),
      patient_name: patientName,
      ward_clinic: text(row.order.vid && (row.order.vid.ward || row.order.vid.visit_clinic)),
      ordered_at: text(row.order.created_at),
      specimen_json: JSON.stringify({
        code: row.specimenCode,
        name: row.specimenName,
        collected_at: text(row.labData.specimen_at || row.labData.at),
        collected_by: text(row.labData.specimen_by || row.labData.by)
      }),
      selected_items_json: JSON.stringify(selectedItems),
      lab_no_section_prefix: sectionPrefix,
      lab_no_buddhist_year: buddhistYear,
      lab_no_year_two_digits: buddhistYearTwoDigits,
      lab_no_date_key: localDateKey,
      lab_no_buddhist_date_key: buddhistDateKey,
      lab_no_month: monthTwoDigits,
      lab_no_day: dayTwoDigits,
      lab_no_sequence: sequence,
      lab_no_format_version: 2,
      lab_no_generated_at: now,
      lab_no_generated_by: actorCode
    }
  }

  for (const row of contexts) {
    if (row.existing && !row.retestPending && !row.cbcSwapPending) continue
    const workItem = buildWorkItem(row)
    if (row.retestPending || row.cbcSwapPending) {
      const { _id, dataid, xparentx, created_by, created_at, ...retestWorkItem } = workItem
      const pendingFilter = row.retestPending
        ? { retest_pending_lab_no: true }
        : { cbc_swap_active: true, cbc_swap_pending_lab_no: true }
      const reassigned = await workCollection.updateOne(
        { _id: row.existing._id, xrstatx: active, is_current_attempt: { $ne: false }, work_status: 'waiting_receive', lab_no: { $in: [null, ''] }, ...pendingFilter },
        {
          $set: {
            ...retestWorkItem,
            ...(row.retestPending ? {
              retest_pending_lab_no: false,
              retest_lab_no_generated_at: now,
              retest_lab_no_generated_by: actorAudit
            } : {
              cbc_swap_pending_lab_no: false,
              cbc_swap_lab_no_generated_at: now,
              cbc_swap_lab_no_generated_by: actorAudit
            })
          },
          $push: row.retestPending
            ? { retest_generation_log: { lab_no: labNo, generated_at: now, generated_by: actorAudit } }
            : { cbc_swap_generation_log: { lab_no: labNo, generated_at: now, generated_by: actorAudit } }
        },
        sessionOptions
      )
      if (!reassigned || Number(reassigned.matchedCount) !== 1) throw new Error('RETEST_LAB_NO_CONFLICT')
    } else {
      try {
        await workCollection.insertOne(workItem, sessionOptions)
      } catch (error) {
        if (session) throw error
        const raced = await workCollection.findOne({ _id: row.objectId, xrstatx: active })
        if (!raced || text(raced.lab_no) !== labNo || !selectionMatches(raced)) throw error
      }
    }
  }

  return {
    item_id: requestedItemIds[0],
    item_ids: requestedItemIds,
    work_item_id: batchId,
    work_item_ids: requestedItemIds,
    receipt_batch_id: batchId,
    batch_item_count: contexts.length,
    lab_no: labNo,
    section_code: sectionCode,
    section_prefix: sectionPrefix,
    buddhist_year: buddhistYear,
    year_two_digits: buddhistYearTwoDigits,
    date_key: localDateKey,
    buddhist_date_key: buddhistDateKey,
    month: monthTwoDigits,
    day: dayTwoDigits,
    sequence,
    format_version: 2,
    work_status: 'waiting_receive',
    already_assigned: !newlyReserved
  }
}

const assignLabNo = async session => {
    const sessionOptions = session ? { session } : {}
    const itemCollection = app.db.collection(ITEM_COLLECTION)
    const orderCollection = app.db.collection(ORDER_COLLECTION)
    const masterCollection = app.db.collection(ITEM_MASTER_COLLECTION)
    const sectionCollection = app.db.collection(SECTION_COLLECTION)
    const workCollection = app.db.collection(WORK_ITEM_COLLECTION)
    const counterCollection = app.db.collection(COUNTER_COLLECTION)
    const cancellationCollection = app.db.collection(ORDER_CANCELLATION_COLLECTION)

    const item = await itemCollection.findOne({ _id: itemObjectId, xrstatx: active }, sessionOptions)
    if (!item) throw new Error('ITEM_NOT_FOUND')
    if (text(item.service_type && item.service_type.value).toLowerCase() !== 'lab') throw new Error('ITEM_NOT_LAB')
    const orderRef = item.order_id && item.order_id.value ? item.order_id.value : item.xparentx
    if (!orderRef) throw new Error('ORDER_REFERENCE_MISSING')
    const cancellationOrderId = typeof orderRef === 'string' ? app.dbObjectId(orderRef) : orderRef
    const cancellation = await cancellationCollection.findOne({
      _id: cancellationOrderId,
      xrstatx: active,
      cancel_status: { $in: ['pending', 'applied'] }
    }, sessionOptions)
    if (cancellation) throw new Error('ORDER_CANCELLED')

    const existing = await workCollection.findOne({
      xrstatx: active,
      is_current_attempt: { $ne: false },
      $or: [{ _id: itemObjectId }, { source_specimen_record_id: itemId }]
    }, { sort: { attempt_no: -1, updated_at: -1, created_at: -1 }, ...sessionOptions })
    const itemStatus = text(item.current_status).toLowerCase()
    /* ตรวจใหม่ 2026-09-04: ปุ่มตรวจใหม่ล้างเลขเดิมและตั้ง marker ไว้บน Work Item เดิม
       2026-09-23: อนุญาตให้จองเลขใหม่เฉพาะ marker + waiting_receive + CPOE ready
       หลังผ่านการเงินแล้วเท่านั้น
       เพื่อคง idempotency ของเส้นทางสร้าง LAB NO. ปกติไว้ทั้งหมด */
    const pendingMarkedLabNo = Boolean(
      existing && !text(existing.lab_no) &&
      (existing.retest_pending_lab_no === true || existing.cbc_swap_pending_lab_no === true)
    )
    if ((!existing || pendingMarkedLabNo) && itemStatus !== 'ready') throw new Error('PAYMENT_NOT_READY')
    const retestPending = Boolean(
      existing && existing.retest_pending_lab_no === true &&
      !text(existing.lab_no) && text(existing.work_status).toLowerCase() === 'waiting_receive' &&
      itemStatus === 'ready'
    )
    const cbcSwapPending = Boolean(
      existing && existing.cbc_swap_active === true && existing.cbc_swap_pending_lab_no === true &&
      !text(existing.lab_no) && text(existing.work_status).toLowerCase() === 'waiting_receive' &&
      itemStatus === 'ready' && ['HM1', 'MS1'].includes(text(existing.effective_item_code).toUpperCase())
    )
    if (existing && !retestPending && !cbcSwapPending) {
      const existingLabNo = text(existing.lab_no)
      if (!existingLabNo) throw new Error('WORK_ITEM_WITHOUT_LAB_NO')
      return {
        item_id: itemId,
        work_item_id: text(existing._id),
        lab_no: existingLabNo,
        section_code: text(existing.section_code).toUpperCase(),
        section_prefix: text(existing.lab_no_section_prefix),
        buddhist_year: Number(existing.lab_no_buddhist_year || 0) || null,
        date_key: text(existing.lab_no_date_key) || null,
        month: text(existing.lab_no_month) || null,
        day: text(existing.lab_no_day) || null,
        sequence: Number(existing.lab_no_sequence || 0) || null,
        format_version: Number(existing.lab_no_format_version || 2),
        work_status: text(existing.work_status),
        already_assigned: true
      }
    }

    const order = await orderCollection.findOne({ _id: orderRef, xrstatx: active }, sessionOptions)
    if (!order) throw new Error('ORDER_NOT_FOUND')

    let master = null
    const masterId = cbcSwapPending ? text(existing.effective_item_master_id) : item.item_data_id
    if (masterId) master = await masterCollection.findOne({ _id: typeof masterId === 'string' ? app.dbObjectId(masterId) : masterId, xrstatx: active }, sessionOptions)
    if (cbcSwapPending && !master) throw new Error('CBC_SWAP_MASTER_MISSING')
    let section = cbcSwapPending
      ? { code: text(existing.section_code).toUpperCase(), name: text(existing.section_name) }
      : item.section_snapshot || (item.lab_context_snapshot && item.lab_context_snapshot.section) || (master && master.section) || {}
    if (!text(section.code) && section.value) {
      const sectionId = typeof section.value === 'string' ? app.dbObjectId(section.value) : section.value
      const foundSection = await sectionCollection.findOne(
        { _id: sectionId, xrstatx: active, enable: { $ne: false } }, sessionOptions
      )
      if (foundSection) section = foundSection
    }

    const sectionCode = text(section.code).toUpperCase()
    if (!allowedSections.includes(sectionCode)) throw new Error('SECTION_FORBIDDEN')
    const sectionPrefix = SECTION_PREFIX[sectionCode]
    if (!sectionPrefix) throw new Error('SECTION_PREFIX_MISSING')
    const sectionName = text(section.name_th || section.name || section.label || sectionCode)
    const patient = order.vid && order.vid.pid || {}
    const patientHn = text(patient.hn)
    if (!patientHn) throw new Error('PATIENT_HN_MISSING')
    const patientName = [text(patient.prename), text(patient.p_fname || patient.first_name), text(patient.p_lname || patient.last_name)]
      .filter(Boolean).join(' ') || patientHn

    const counterId = ['lab_no', sectionCode, localDateKey].join(':')
    const counterResult = await counterCollection.findOneAndUpdate(
      { _id: counterId },
      [{ $set: {
        section_code: sectionCode,
        section_prefix: sectionPrefix,
        buddhist_year: buddhistYear,
        year_two_digits: buddhistYearTwoDigits,
        date_key: localDateKey,
        buddhist_date_key: buddhistDateKey,
        month_two_digits: monthTwoDigits,
        day_two_digits: dayTwoDigits,
        format_version: 2,
        daily_limit_reached: { $gte: [{ $ifNull: ['$sequence', 0] }, MAX_DAILY_SEQUENCE] },
        sequence: {
          $let: {
            vars: { current: { $ifNull: ['$sequence', 0] } },
            in: { $cond: [{ $gte: ['$$current', MAX_DAILY_SEQUENCE] }, '$$current', { $add: ['$$current', 1] }] }
          }
        },
        created_at: { $ifNull: ['$created_at', now] },
        updated_at: now,
        updated_by: actorCode
      } }],
      { upsert: true, returnDocument: 'after', ...sessionOptions }
    )
    const counter = counterResult && (counterResult.value || counterResult)
    if (counter && counter.daily_limit_reached === true) throw new Error('DAILY_LIMIT_REACHED')
    const sequence = Number(counter && counter.sequence)
    if (!Number.isInteger(sequence) || sequence < 1 || sequence > MAX_DAILY_SEQUENCE) throw new Error('COUNTER_INVALID')

    const labNo = sectionPrefix + buddhistYearTwoDigits + monthTwoDigits + dayTwoDigits + String(sequence).padStart(4, '0')
    const duplicate = await workCollection.findOne(
      { lab_no: labNo, xrstatx: active },
      { projection: { _id: 1 }, ...sessionOptions }
    )
    if (duplicate) throw new Error('LAB_NO_COLLISION')

    const labData = item.lab_data && typeof item.lab_data === 'object' ? item.lab_data : {}
    const masterLab = master && master.lab_item && typeof master.lab_item === 'object' ? master.lab_item : {}
    const specimen = masterLab.specimen && !Array.isArray(masterLab.specimen) ? masterLab.specimen : {}
    const orderId = text(order._id)
    const workItemId = text(itemObjectId)
    const workItem = {
      _id: itemObjectId,
      xparentx: itemObjectId,
      xsitex: userInfo.site || {},
      xunitx: { code: sectionCode, name: sectionName },
      xrstatx: 1,
      xversionx: 'v1',
      xerrorx: null,
      dataid: workItemId,
      created_by: actorAudit,
      created_at: now,
      updated_by: actorAudit,
      updated_at: now,
      source_order_id: orderId,
      source_order_number: text(order.order_number),
      source_specimen_record_id: itemId,
      lab_no: labNo,
      section_code: sectionCode,
      section_name: sectionName,
      work_status: 'waiting_receive',
      patient_hn: patientHn,
      visit_id: text(order.vid && (order.vid.vn || order.vid.value) || order.xparentx),
      patient_name: patientName,
      ward_clinic: text(order.vid && (order.vid.ward || order.vid.visit_clinic)),
      ordered_at: text(order.created_at),
      specimen_json: JSON.stringify({
        code: text(labData.spec_source_code || specimen.code),
        name: text(labData.spec_source || labData.source || specimen.name),
        collected_at: text(labData.specimen_at || labData.at),
        collected_by: text(labData.specimen_by || labData.by)
      }),
      selected_items_json: JSON.stringify([{
        seq: Number(item.item_no || 1),
        source_item_id: itemId,
        item_code: text(item.item_code),
        item_name: text(item.item_name || master && master.item_name),
        test_code: text(masterLab.his_lab_code),
        specimen_code: text(labData.spec_source_code || specimen.code)
      }]),
      lab_no_section_prefix: sectionPrefix,
      lab_no_buddhist_year: buddhistYear,
      lab_no_year_two_digits: buddhistYearTwoDigits,
      lab_no_date_key: localDateKey,
      lab_no_buddhist_date_key: buddhistDateKey,
      lab_no_month: monthTwoDigits,
      lab_no_day: dayTwoDigits,
      lab_no_sequence: sequence,
      lab_no_format_version: 2,
      lab_no_generated_at: now,
      lab_no_generated_by: actorCode
    }
    if (retestPending || cbcSwapPending) {
      const { _id, dataid, xparentx, created_by, created_at, ...retestWorkItem } = workItem
      const pendingFilter = retestPending
        ? { retest_pending_lab_no: true }
        : { cbc_swap_active: true, cbc_swap_pending_lab_no: true }
      const reassigned = await workCollection.updateOne(
        {
          _id: existing._id,
          xrstatx: active,
          is_current_attempt: { $ne: false },
          work_status: 'waiting_receive',
          lab_no: { $in: [null, ''] },
          ...pendingFilter
        },
        {
          $set: {
            ...retestWorkItem,
            ...(retestPending ? {
              retest_pending_lab_no: false,
              retest_lab_no_generated_at: now,
              retest_lab_no_generated_by: actorAudit
            } : {
              cbc_swap_pending_lab_no: false,
              cbc_swap_lab_no_generated_at: now,
              cbc_swap_lab_no_generated_by: actorAudit
            })
          },
          $push: retestPending
            ? { retest_generation_log: { lab_no: labNo, generated_at: now, generated_by: actorAudit } }
            : { cbc_swap_generation_log: { lab_no: labNo, generated_at: now, generated_by: actorAudit } }
        },
        sessionOptions
      )
      if (!reassigned || Number(reassigned.matchedCount) !== 1) {
        const raced = await workCollection.findOne({ _id: existing._id, xrstatx: active }, sessionOptions)
        if (!raced || !text(raced.lab_no) || (retestPending ? raced.retest_pending_lab_no === true : raced.cbc_swap_pending_lab_no === true)) {
          throw new Error('RETEST_LAB_NO_CONFLICT')
        }
        return {
          item_id: itemId,
          work_item_id: text(raced._id),
          lab_no: text(raced.lab_no),
          section_code: text(raced.section_code).toUpperCase(),
          section_prefix: text(raced.lab_no_section_prefix),
          buddhist_year: Number(raced.lab_no_buddhist_year || 0) || null,
          date_key: text(raced.lab_no_date_key) || null,
          month: text(raced.lab_no_month) || null,
          day: text(raced.lab_no_day) || null,
          sequence: Number(raced.lab_no_sequence || 0) || null,
          format_version: Number(raced.lab_no_format_version || 2),
          work_status: text(raced.work_status),
          retest_reassigned: retestPending,
          cbc_swap_reassigned: cbcSwapPending,
          already_assigned: true
        }
      }
      return {
        item_id: itemId,
        work_item_id: text(existing._id),
        lab_no: labNo,
        section_code: sectionCode,
        section_prefix: sectionPrefix,
        buddhist_year: buddhistYear,
        year_two_digits: buddhistYearTwoDigits,
        date_key: localDateKey,
        buddhist_date_key: buddhistDateKey,
        month: monthTwoDigits,
        day: dayTwoDigits,
        sequence,
        format_version: 2,
        work_status: 'waiting_receive',
        retest_reassigned: retestPending,
        cbc_swap_reassigned: cbcSwapPending,
        already_assigned: false
      }
    }
    try {
      await workCollection.insertOne(workItem, sessionOptions)
    } catch (error) {
      // On standalone MongoDB two concurrent retries may reserve different
      // counter values. The Work Item _id remains the idempotency lock; return
      // the winner and never reuse the skipped counter value.
      if (!session) {
        const raced = await workCollection.findOne({
          xrstatx: active,
          is_current_attempt: { $ne: false },
          $or: [{ _id: itemObjectId }, { source_specimen_record_id: itemId }]
        }, { sort: { attempt_no: -1, updated_at: -1, created_at: -1 } })
        if (raced && text(raced.lab_no)) {
          return {
            item_id: itemId,
            work_item_id: text(raced._id),
            lab_no: text(raced.lab_no),
            section_code: text(raced.section_code).toUpperCase(),
            section_prefix: text(raced.lab_no_section_prefix),
            buddhist_year: Number(raced.lab_no_buddhist_year || 0) || null,
            date_key: text(raced.lab_no_date_key) || null,
            month: text(raced.lab_no_month) || null,
            day: text(raced.lab_no_day) || null,
            sequence: Number(raced.lab_no_sequence || 0) || null,
            format_version: Number(raced.lab_no_format_version || 2),
            work_status: text(raced.work_status),
            already_assigned: true
          }
        }
      }
      throw error
    }

    return {
      item_id: itemId,
      work_item_id: workItemId,
      lab_no: labNo,
      section_code: sectionCode,
      section_prefix: sectionPrefix,
      buddhist_year: buddhistYear,
      year_two_digits: buddhistYearTwoDigits,
      date_key: localDateKey,
      buddhist_date_key: buddhistDateKey,
      month: monthTwoDigits,
      day: dayTwoDigits,
      sequence,
      format_version: 2,
      work_status: 'waiting_receive',
      recovered_inconsistent_item: false,
      already_assigned: false
    }
}

let assigned
try {
  if (this && typeof this.mongoTxn === 'function') {
    try {
      assigned = await this.mongoTxn(
        session => requestedItemIds.length > 1 ? assignBatchLabNo(session) : assignLabNo(session),
        { name: requestedItemIds.length > 1 ? 'generateBatchLabNoWorkItems' : 'generateLabNoWorkItem', maxRetry: 5, timeoutMs: 15000 }
      )
    } catch (error) {
      if (!transactionUnsupported(error)) throw error
      assigned = requestedItemIds.length > 1 ? await assignBatchLabNo(null) : await assignLabNo(null)
    }
  } else {
    // Nested API execution on some initCraft runtimes does not bind utility
    // helpers to `this`; use the existing idempotent standalone path.
    assigned = requestedItemIds.length > 1 ? await assignBatchLabNo(null) : await assignLabNo(null)
  }
} catch (error) {
  const code = text(error && error.message || error)
  const messages = {
    ITEM_NOT_FOUND: 'ไม่พบ CPOE Item ที่ต้องการสร้าง LAB NO.',
    ITEM_NOT_LAB: 'สร้าง LAB NO. ได้เฉพาะ LAB Item',
    ITEM_NOT_WAITING_RECEIVE: 'สร้าง LAB NO. ใหม่ได้เฉพาะ Item ที่ยังรอรับ specimen',
    PAYMENT_NOT_READY: 'ยังไม่ผ่านการเงิน จึงยังสร้าง LAB NO. และรับ specimen ไม่ได้',
    ORDER_CANCELLED: 'Order นี้ถูกยกเลิกแล้ว จึงสร้าง LAB NO. ไม่ได้',
    ORDER_REFERENCE_MISSING: 'Item ไม่มีข้อมูลเชื่อม CPOE Order',
    ORDER_NOT_FOUND: 'ไม่พบ CPOE Order ของ Item นี้',
    PATIENT_HN_MISSING: 'ไม่พบ HN จึงยังสร้าง Lab Work Item ไม่ได้',
    SECTION_FORBIDDEN: 'Item นี้ไม่ได้อยู่ใน Section ของ Organization ปัจจุบัน',
    SECTION_PREFIX_MISSING: 'Section นี้ยังไม่มีรหัส 2 หลักสำหรับสร้าง LAB NO.',
    COUNTER_INVALID: 'ลำดับ LAB NO. ไม่ถูกต้อง',
    DAILY_LIMIT_REACHED: 'LAB NO. ของ Section นี้ครบ 9999 รายการสำหรับวันนี้แล้ว กรุณาแจ้งผู้ดูแลระบบ',
    LAB_NO_COLLISION: 'LAB NO. ที่กำลังสร้างซ้ำกับเลขที่มีอยู่ จึงหยุดเพื่อป้องกันการจับคู่ผิดรายการ',
    WORK_ITEM_WITHOUT_LAB_NO: 'พบ Lab Work Item เดิมแต่ไม่มี LAB NO. กรุณาให้ผู้ดูแลตรวจสอบ',
    RETEST_LAB_NO_CONFLICT: 'สถานะตรวจใหม่เปลี่ยนระหว่างสร้าง LAB NO. กรุณาโหลดใหม่แล้วลองอีกครั้ง',
    CBC_SWAP_MASTER_MISSING: 'ไม่พบ Master ปลายทางของรายการ CBC ที่สลับ กรุณาแจ้งผู้ดูแลระบบ',
    BATCH_ORDER_MISMATCH: 'รายการที่เลือกต้องอยู่ใน CPOE Order เดียวกัน',
    BATCH_SECTION_MISMATCH: 'รายการที่เลือกต้องอยู่ใน Section เดียวกัน',
    BATCH_SPECIMEN_MISMATCH: 'รายการที่เลือกใช้ specimen ต่างชนิดกัน กรุณาแยกรับเป็นคนละชุด',
    BATCH_ALREADY_SPLIT: 'รายการที่เลือกเคยถูกสร้างเป็น LAB NO. คนละเลขแล้ว จึงรวมย้อนหลังไม่ได้',
    BATCH_ALREADY_ASSIGNED: 'รายการบางส่วนมี LAB NO. จากชุดรับอื่นแล้ว จึงรวมเป็นชุดใหม่ไม่ได้',
    BATCH_RETEST_MISMATCH: 'ไม่สามารถรวมรายการตรวจใหม่กับรายการที่มี LAB NO. เดิมในชุดเดียวกัน',
    BATCH_RETEST_ITEM_MUST_BE_SINGLE: 'รายการเปิดตรวจใหม่ต้องรับ specimen แยกเป็นรายการเดี่ยว'
  }
  return { success: false, message: messages[code] || 'สร้าง LAB NO. ไม่สำเร็จ: ' + code }
}

return {
  success: true,
  data: assigned,
  message: assigned.already_assigned ? 'Item นี้มี LAB NO. แล้ว' : 'สร้าง LAB NO. และ Lab Work Item แล้ว'
}
