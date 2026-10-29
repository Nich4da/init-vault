/*
 * initCraft API Factory Process
 * Name: LAB CPOE - Receive specimen and dispatch the Agent outbound snapshot
 * Deployed Process ID: 6a94f634422c1ca959829d70
 *
 * Input: {
 *   item_id?: '<zdata_cpoe_order_item _id>',
 *   item_ids?: ['<zdata_cpoe_order_item _id>', '...'],
 *   dispatch_mode?: 'sync' | 'deferred',
 *   cross_section?: false
 * }
 *
 * The CPOE Order header remains read-only. Receipt is persisted in
 * zdata_lab_work_item, the source CPOE Item is compare-and-set to accepted, and the
 * transport snapshot is persisted in the actual DB collection name
 * zdata_lab_outband_order. Agent dispatch runs only after receipt persistence
 * commits; a transport failure never rolls back specimen receipt or LAB NO.
 * `deferred` returns the committed receipt immediately so the Worklist can
 * start the existing Agent dispatch path as a separate background request.
 * The default remains `sync` for backward compatibility with existing callers.
 * Replica sets use mongoTxn; standalone MongoDB uses idempotent compare-and-set
 * writes. A new receipt is allowed only while the source CPOE Item is `ready`
 * (Finance cleared); an already-persisted `received` Work Item may retry
 * idempotently after the CPOE projection has advanced to `accepted` or later.
 * IM/MI-OUT/MB/MY are source-managed: Receive validates and copies the source
 * LAB NO. from Item.lab_no or the current CPOE Item.item_no compatibility field,
 * required Item comments, and optional multi-specimen rows without calling the
 * LAB counter/Generator. Other rooms retain the legacy generation path.
 */

const ITEM_COLLECTION = 'zdata_cpoe_order_item'
const ORDER_COLLECTION = 'zdata_cpoe_order'
const VISIT_COLLECTION = 'zdata_visit'
const PERSON_COLLECTION = 'zdata_person'
const ITEM_MASTER_COLLECTION = 'zdata_master_item_order'
const SECTION_COLLECTION = 'zdata_section'
const WORK_ITEM_COLLECTION = 'zdata_lab_work_item'
const OUTBOUND_COLLECTION = 'zdata_lab_outband_order'
const ORDER_CANCELLATION_COLLECTION = 'zdata_lab_order_cancellation'
const WORK_ITEM_FORM_ID = '6a95c750422c1ca959829e8a'
const LAB_NO_PROCESS_ID = '6a94f1ed422c1ca959829d6e'
const AGENT_SUBMIT_PROCESS_ID = '6a9468c7422c1ca959829d6a'
const LAB_ORDER_EVENT_TYPE = 'lab.order.submit'
const MOTHER_RELATION_CODE = 'MTH'
const PRIORITY_MAP = {
  R: 'R', ROUTINE: 'R', '1': 'R',
  A: 'A', URGENT: 'A', '2': 'A',
  S: 'S', STAT: 'S', '3': 'S', '4': 'S', '5': 'S'
}
const SOURCE_MANAGED_SECTION_PREFIX = { IM: '30', 'MI-OUT': '31', MB: '40', MY: '41' }
const ORGANIZATION_SECTION_CODES = {
  M1000: ['MY'], M1005: ['MB'], M1006: ['IM', 'MI-OUT'],
  '30': ['IM'], '31': ['MI-OUT'], '40': ['MB'], '41': ['MY']
}

const valueText = value => {
  if (value == null) return ''
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return String(value.toHexString())
    if (value.$oid != null) return String(value.$oid)
    if (value._id != null) return valueText(value._id)
    if (value.code != null) return String(value.code)
    if (value.value != null && typeof value.value !== 'object') return String(value.value)
    if (value.label != null) return String(value.label)
  }
  return String(value)
}
const text = value => valueText(value).trim()
const lower = value => text(value).toLowerCase()
const patientPrefixText = value => value && typeof value === 'object'
  ? text(value.label || value.prename_full_name)
  : text(value)
const transactionUnsupported = error => {
  const message = lower(error && error.message || error)
  return message.includes('transaction numbers are only allowed on a replica set member or mongos') ||
    message.includes('transaction support is not available')
}
const processResult = value => {
  const result = value && value.result && typeof value.result === 'object'
    ? value.result
    : value || {}
  if (
    result.data &&
    typeof result.data === 'object' &&
    Object.prototype.hasOwnProperty.call(result.data, 'success')
  ) {
    return result.data
  }
  return result
}
const jsonObject = value => {
  try {
    const parsed = JSON.parse(text(value))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch (error) {
    return null
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
const orderReference = item => item && item.order_id && item.order_id.value
  ? item.order_id.value
  : item && item.xparentx
const toThaiIso = value => {
  const raw = text(value)
  if (/^\d{14}$/.test(raw)) return raw
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+07:00$/.test(raw)) return raw
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(raw)
  return match ? match[1] + 'T' + match[2] + '+07:00' : ''
}
const birthDate = value => {
  const digits = text(value).replace(/\D/g, '')
  return digits.length >= 8 ? digits.slice(0, 8) : ''
}
const agentSexFromCode = value => {
  const code = text(value).toUpperCase()
  return code === '1' || code === 'M' ? 'M' : code === '2' || code === 'F' ? 'F' : ''
}
const encounterClassFromVisit = visit => {
  return text(visit && visit.an) ? 'IPD' : 'OPD'
}
// 2026-10-29 temporary production UAT override. Remove after this Order's round-trip.
const maternalBloodFromOrder = order => text(order && order.order_number) === 'R2610290002' ? true : order && typeof order.is_maternal_blood === 'boolean' ? order.is_maternal_blood : undefined
const motherNameFromPerson = person => {
  const relatives = Array.isArray(person && person.relate) ? person.relate : []
  const mother = relatives.find(relative => text(relative && relative.r_code).toUpperCase() === MOTHER_RELATION_CODE)
  return mother ? [text(mother.r_fname), text(mother.r_lname)].filter(Boolean).join(' ') : ''
}
const agentVisitContextForOrder = async order => {
  const snapshot = order && order.vid || {}
  const snapshotCode = agentSexFromCode(snapshot.pid && snapshot.pid.p_gender)
  const visitId = text(snapshot.value)
  let source = null
  if (/^[a-f0-9]{24}$/i.test(visitId)) {
    try {
      source = await app.db.collection(VISIT_COLLECTION).findOne(
        { _id: app.dbObjectId(visitId), xrstatx: active },
        { projection: { 'pid.value': 1, 'pid.p_gender': 1, an: 1, encounter_class: 1, 'encounter.class': 1 } }
      )
    } catch (error) {
      source = null
    }
  }
  const mergedVisit = {
    ...snapshot,
    ...(source || {}),
    an: text(source && source.an) || text(snapshot.an)
  }
  const personId = text(source && source.pid && source.pid.value || snapshot.pid && snapshot.pid.value)
  let motherName = ''
  if (/^[a-f0-9]{24}$/i.test(personId)) {
    try {
      const person = await app.db.collection(PERSON_COLLECTION).findOne(
        { _id: app.dbObjectId(personId), xrstatx: active },
        { projection: { relate: 1 } }
      )
      motherName = motherNameFromPerson(person)
    } catch (error) {
      motherName = ''
    }
  }
  return {
    sex: agentSexFromCode(source && source.pid && source.pid.p_gender) || snapshotCode,
    encounterClass: encounterClassFromVisit(mergedVisit),
    motherName
  }
}
const lastSentAt = order => {
  const stages = Array.isArray(order && order.status_stage) ? order.status_stage : []
  for (let index = stages.length - 1; index >= 0; index -= 1) {
    if (lower(stages[index] && stages[index].stage_status) === 'sent') return text(stages[index].stage_at)
  }
  return text(order && order.created_at)
}

const active = { $nin: [0, 3] }
const terminalCpoeStatuses = ['completed', 'rejected']
const crossSectionRequested = params && (params.cross_section === true || lower(params.cross_section) === 'true')
if (crossSectionRequested) {
  return { success: false, error: 'cross_section_read_only', message: 'โหมดสืบค้นข้ามห้องเป็นแบบอ่านอย่างเดียว' }
}
const requestedItemIds = Array.from(new Set(
  (Array.isArray(params && params.item_ids) ? params.item_ids : [params && params.item_id])
    .map(text)
    .filter(Boolean)
))
const itemId = requestedItemIds[0] || ''
const dispatchMode = lower(params && params.dispatch_mode) || 'sync'
if (!requestedItemIds.length || requestedItemIds.some(id => !/^[a-f0-9]{24}$/i.test(id))) {
  return { success: false, error: 'invalid_item_id', message: 'item_id/item_ids ไม่ถูกต้อง' }
}
if (requestedItemIds.length > 100) return { success: false, error: 'too_many_items', message: 'รับ specimen ได้ไม่เกิน 100 รายการต่อชุด' }
if (!['sync', 'deferred'].includes(dispatchMode)) {
  return { success: false, error: 'invalid_dispatch_mode', message: 'dispatch_mode ต้องเป็น sync หรือ deferred' }
}
if (!app.isAuth(userInfo.roles || [])) {
  return { success: false, error: 'forbidden', message: 'ไม่มีสิทธิ์รับ specimen' }
}

const actorCode = text(userInfo.employee_code || userInfo.username || userInfo.account && (userInfo.account.code || userInfo.account.name))
const actorName = text(userInfo.fullname || userInfo.display_name || userInfo.account && (userInfo.account.label || userInfo.account.name) || actorCode)
const organizationCode = text(userInfo.unit && userInfo.unit.code).toUpperCase()
const now = text(app.curDate('YYYY-MM-DD HH:mm:ss'))
const receivedIso = toThaiIso(now)
const itemObjectId = app.dbObjectId(itemId)
if (!actorCode) return { success: false, error: 'receiver_missing', message: 'ไม่พบรหัสผู้รับ specimen จากบัญชีผู้ใช้' }

const itemCollection = app.db.collection(ITEM_COLLECTION)
const orderCollection = app.db.collection(ORDER_COLLECTION)
const masterCollection = app.db.collection(ITEM_MASTER_COLLECTION)
const workCollection = app.db.collection(WORK_ITEM_COLLECTION)
const cancellationCollection = app.db.collection(ORDER_CANCELLATION_COLLECTION)
const sectionCollection = app.db.collection(SECTION_COLLECTION)

const sourceSectionContext = async (item, master, existingWork) => {
  let section = existingWork && SOURCE_MANAGED_SECTION_PREFIX[text(existingWork.section_code).toUpperCase()]
    ? { code: text(existingWork.section_code), name: text(existingWork.section_name) }
    : item.section_snapshot || (item.lab_context_snapshot && item.lab_context_snapshot.section) || (master && master.section) || {}
  if (!text(section.code) && section.value) {
    const sectionId = typeof section.value === 'string' ? app.dbObjectId(section.value) : section.value
    const found = await sectionCollection.findOne({ _id: sectionId, xrstatx: active, enable: { $ne: false } })
    if (found) section = found
  }
  const code = text(section.code).toUpperCase()
  if (!SOURCE_MANAGED_SECTION_PREFIX[code]) return null
  const allowedSections = ORGANIZATION_SECTION_CODES[organizationCode] || []
  if (!allowedSections.includes(code)) throw new Error('SOURCE_SECTION_FORBIDDEN')
  const labNo = text(item.lab_no) || text(item.item_no)
  if (!labNo) throw new Error('SOURCE_LAB_NO_MISSING')
  if (!/^\d{12}$/.test(labNo) || !labNo.startsWith(SOURCE_MANAGED_SECTION_PREFIX[code])) {
    throw new Error('SOURCE_LAB_NO_INVALID')
  }
  if (master && master.req_commt === true && !text(item.comment)) throw new Error('REQUIRED_ITEM_COMMENT_MISSING')
  return {
    code,
    name: text(section.name_th || section.name || section.label || code),
    prefix: SOURCE_MANAGED_SECTION_PREFIX[code],
    labNo,
    reqComment: Boolean(master && master.req_commt === true),
    multiSpecimen: Boolean(master && master.multi_specimen === true)
  }
}
const sourceErrorResponse = error => {
  const code = text(error && error.message || error)
  const messages = {
    SOURCE_SECTION_FORBIDDEN: 'Item นี้ไม่ได้อยู่ใน Section ของ Organization ปัจจุบัน',
    SOURCE_LAB_NO_MISSING: 'ยังไม่ได้รับ LAB NO. จาก CPOE สำหรับห้อง IM, MI-OUT, MY หรือ MB',
    SOURCE_LAB_NO_INVALID: 'LAB NO. จาก CPOE ต้องเป็นตัวเลข 12 หลักและขึ้นต้นให้ตรงกับห้อง (IM=30, MI-OUT=31, MB=40, MY=41)',
    REQUIRED_ITEM_COMMENT_MISSING: 'รายการตรวจนี้กำหนดให้ระบุหมายเหตุจาก CPOE ก่อนรับ specimen',
    SOURCE_BATCH_LAB_NO_MISMATCH: 'รายการในชุดต้องมี LAB NO. จาก CPOE เลขเดียวกัน',
    SOURCE_BATCH_SECTION_MISMATCH: 'รายการในชุดต้องอยู่ในห้องเดียวกัน',
    SOURCE_LAB_NO_CONFLICT: 'LAB NO. จาก CPOE ไม่ตรงกับ Lab Work Item เดิม กรุณาให้ผู้ดูแลตรวจสอบ',
    SOURCE_LAB_NO_COLLISION: 'LAB NO. จาก CPOE ถูกใช้กับ CPOE Order อื่นแล้ว จึงหยุดเพื่อป้องกันการจับคู่ผิดรายการ',
    SOURCE_WORK_ITEM_CONFLICT: 'Lab Work Item เปลี่ยนแปลงระหว่างรับ LAB NO. จาก CPOE กรุณาโหลดใหม่'
  }
  return { success: false, error: lower(code), message: messages[code] || 'รับ LAB NO. จาก CPOE ไม่สำเร็จ' }
}
const outboundSpecimens = labData => {
  const rows = Array.isArray(labData && labData.specimens) ? labData.specimens : []
  return rows.map(row => ({
    spec_site_code: text(row && row.spec_site_code),
    spec_site_name: text(row && row.spec_site_name),
    spec_source_code: text(row && row.spec_source_code),
    spec_source: text(row && row.spec_source),
    specimen_at: toThaiIso(row && row.specimen_at),
    ship_storage: text(row && row.ship_storage),
    ship_temp: row && typeof row.ship_temp === 'number' ? row.ship_temp : null,
    spec_note: text(row && row.spec_note)
  }))
}
const reserveSourceManagedWorkItems = async (contexts, order) => {
  const sourceContexts = []
  for (const row of contexts) {
    const source = await sourceSectionContext(row.item, row.master, row.existingWork)
    sourceContexts.push({ ...row, source })
  }
  if (!sourceContexts.some(row => row.source)) return null
  if (sourceContexts.some(row => !row.source)) throw new Error('SOURCE_BATCH_SECTION_MISMATCH')
  if (new Set(sourceContexts.map(row => row.source.code)).size !== 1) throw new Error('SOURCE_BATCH_SECTION_MISMATCH')
  if (new Set(sourceContexts.map(row => row.source.labNo)).size !== 1) throw new Error('SOURCE_BATCH_LAB_NO_MISMATCH')

  const labNo = sourceContexts[0].source.labNo
  const duplicate = await workCollection.findOne({ lab_no: labNo, xrstatx: active })
  if (duplicate && text(duplicate.source_order_id) && text(duplicate.source_order_id) !== text(order._id)) {
    throw new Error('SOURCE_LAB_NO_COLLISION')
  }
  const receiptBatchId = text(sourceContexts.find(row => row.existingWork && row.existingWork.receipt_batch_id)?.existingWork.receipt_batch_id) ||
    sourceContexts.map(row => row.itemId).sort()[0]
  const selectedItems = sourceContexts.map(row => ({
    seq: Number(row.item.item_no || 1), source_item_id: row.itemId,
    item_code: text(row.item.item_code), item_name: text(row.item.item_name || row.master && row.master.item_name),
    test_code: text(row.masterLab && row.masterLab.his_lab_code), specimen_code: row.specimenCode
  }))
  const patient = order.vid && order.vid.pid || {}
  const patientHn = text(patient.hn)
  const patientName = [patientPrefixText(patient.prename), text(patient.p_fname || patient.first_name), text(patient.p_lname || patient.last_name)].filter(Boolean).join(' ') || patientHn
  const results = []
  for (const row of sourceContexts) {
    const source = row.source
    const base = {
      xsitex: userInfo.site || {}, xunitx: { code: source.code, name: source.name }, xrstatx: 1, xversionx: 'v1', xerrorx: null,
      updated_by: { id: userInfo._id || userInfo.id || '', name: actorName || actorCode }, updated_at: now,
      source_order_id: text(order._id), source_order_number: text(order.order_number), source_specimen_record_id: row.itemId,
      receipt_batch_id: receiptBatchId, batch_item_count: sourceContexts.length, lab_no: labNo,
      section_code: source.code, section_name: source.name, work_status: 'waiting_receive', patient_hn: patientHn,
      visit_id: text(order.vid && (order.vid.vn || order.vid.value) || order.xparentx), patient_name: patientName,
      ward_clinic: text(order.vid && (order.vid.ward || order.vid.visit_clinic)), ordered_at: text(order.created_at),
      specimen_json: JSON.stringify({ code: row.specimenCode, name: row.specimenName, collected_at: text(row.labData.specimen_at || row.labData.at), collected_by: text(row.labData.specimen_by || row.labData.by) }),
      selected_items_json: JSON.stringify(selectedItems), lab_no_source: 'cpoe_order', lab_no_section_prefix: source.prefix,
      lab_no_received_at: now, lab_no_received_by: actorCode, retest_pending_lab_no: false, cbc_swap_pending_lab_no: false
    }
    let current = row.existingWork
    if (current && text(current.lab_no) && text(current.lab_no) !== labNo) throw new Error('SOURCE_LAB_NO_CONFLICT')
    if (current && !['waiting_receive', 'received'].includes(lower(current.work_status))) throw new Error('SOURCE_WORK_ITEM_CONFLICT')
    if (current && !text(current.lab_no)) {
      const update = await workCollection.updateOne(
        { _id: current._id, xrstatx: active, is_current_attempt: { $ne: false }, lab_no: { $in: [null, ''] } },
        { $set: base }
      )
      if (!update || update.matchedCount !== 1) throw new Error('SOURCE_WORK_ITEM_CONFLICT')
      current = { ...current, ...base }
    } else if (!current) {
      const document = {
        _id: row.objectId, xparentx: row.objectId, dataid: row.itemId,
        created_by: { id: userInfo._id || userInfo.id || '', name: actorName || actorCode }, created_at: now,
        ...base
      }
      try {
        await workCollection.insertOne(document)
        current = document
      } catch (error) {
        current = await workCollection.findOne({ xrstatx: active, is_current_attempt: { $ne: false }, $or: [{ _id: row.objectId }, { source_specimen_record_id: row.itemId }] })
        if (!current || text(current.lab_no) !== labNo) throw new Error('SOURCE_WORK_ITEM_CONFLICT')
      }
    }
    results.push(current)
  }
  return { lab_no: labNo, receipt_batch_id: receiptBatchId, workItems: results }
}

/*
 * 2026-09-09 LIS batch contract. Keep the legacy one-Item path below intact:
 * callers that send item_id still receive exactly the previous behavior. A
 * Worklist batch sends item_ids and receives one shared LAB NO./Outbound order.
 */
if (requestedItemIds.length > 1) {
  const itemContexts = []
  for (const currentItemId of requestedItemIds) {
    const objectId = app.dbObjectId(currentItemId)
    const currentItem = await itemCollection.findOne({ _id: objectId, xrstatx: active })
    if (!currentItem) return { success: false, error: 'item_not_found', message: 'ไม่พบ CPOE Item ที่ต้องการรับ specimen' }
    if (lower(currentItem.service_type && currentItem.service_type.value) !== 'lab') {
      return { success: false, error: 'item_not_lab', message: 'รับ specimen ได้เฉพาะ LAB Item' }
    }
    const currentOrderRef = orderReference(currentItem)
    if (!currentOrderRef) return { success: false, error: 'order_reference_missing', message: 'Item ไม่มีข้อมูลเชื่อม CPOE Order' }
    let currentMaster = null
    if (currentItem.item_data_id) currentMaster = await masterCollection.findOne({ _id: currentItem.item_data_id, xrstatx: active })
    const currentLabData = currentItem.lab_data && typeof currentItem.lab_data === 'object' ? currentItem.lab_data : {}
    const currentMasterLab = currentMaster && currentMaster.lab_item && typeof currentMaster.lab_item === 'object' ? currentMaster.lab_item : {}
    const currentMasterSpecimen = currentMasterLab.specimen && !Array.isArray(currentMasterLab.specimen) ? currentMasterLab.specimen : {}
    const existingWork = await workCollection.findOne({
      xrstatx: active,
      is_current_attempt: { $ne: false },
      $or: [{ _id: objectId }, { source_specimen_record_id: currentItemId }]
    }, { sort: { attempt_no: -1, updated_at: -1, created_at: -1 } })
    const alreadyReceived = existingWork && lower(existingWork.work_status) === 'received'
    if (lower(currentItem.current_status) !== 'ready' && !alreadyReceived) {
      return { success: false, error: 'payment_not_ready', message: 'ยังไม่ผ่านการเงิน' }
    }
    itemContexts.push({
      itemId: currentItemId,
      objectId,
      item: currentItem,
      orderRef: text(currentOrderRef),
      master: currentMaster,
      masterLab: currentMasterLab,
      labData: currentLabData,
      specimenCode: text(currentLabData.spec_source_code || currentMasterSpecimen.code),
      specimenName: text(currentLabData.spec_source || currentLabData.source || currentMasterSpecimen.name),
      existingWork
    })
  }
  if (new Set(itemContexts.map(row => row.orderRef)).size !== 1) {
    return { success: false, error: 'batch_order_mismatch', message: 'รายการที่เลือกต้องอยู่ใน CPOE Order เดียวกัน' }
  }
  if (new Set(itemContexts.map(row => (row.specimenCode || row.specimenName).toUpperCase())).size !== 1) {
    return { success: false, error: 'batch_specimen_mismatch', message: 'รายการที่เลือกใช้ specimen ต่างชนิดกัน กรุณาแยกรับเป็นคนละชุด' }
  }

  const batchOrder = await orderCollection.findOne({ _id: app.dbObjectId(itemContexts[0].orderRef), xrstatx: active })
  if (!batchOrder) return { success: false, error: 'order_not_found', message: 'ไม่พบ CPOE Order ของ Item ที่เลือก' }
  const batchCancellationQuery = {
    _id: batchOrder._id,
    xrstatx: active,
    cancel_status: { $in: ['pending', 'applied'] }
  }
  if (await cancellationCollection.findOne(batchCancellationQuery)) {
    return { success: false, error: 'order_cancelled', message: 'Order นี้ถูกยกเลิกแล้ว จึงรับ specimen ไม่ได้' }
  }

  let generatedBatch
  try {
    const sourceReservation = await reserveSourceManagedWorkItems(itemContexts, batchOrder)
    generatedBatch = sourceReservation
      ? { success: true, data: sourceReservation }
      : processResult(await app.subProcess(
        LAB_NO_PROCESS_ID,
        { item_id: requestedItemIds[0], item_ids: requestedItemIds },
        userInfo
      ))
  } catch (error) {
    if (/^(SOURCE_|REQUIRED_)/.test(text(error && error.message || error))) return sourceErrorResponse(error)
    return { success: false, error: 'lab_no_process_failed', message: 'เรียก API จัดเตรียม LAB NO. แบบชุดไม่สำเร็จ' }
  }
  if (!generatedBatch || generatedBatch.success !== true || !text(generatedBatch.data && generatedBatch.data.lab_no)) {
    return { success: false, error: 'lab_no_failed', message: text(generatedBatch && generatedBatch.message) || 'สร้าง LAB NO. แบบชุดไม่สำเร็จ' }
  }

  const generatedData = generatedBatch.data || {}
  const batchLabNo = text(generatedData.lab_no)
  const receiptBatchId = text(generatedData.receipt_batch_id || generatedData.work_item_id) || requestedItemIds.slice().sort()[0]
  const batchWorkItems = []
  for (const row of itemContexts) {
    const work = await workCollection.findOne({
      xrstatx: active,
      is_current_attempt: { $ne: false },
      $or: [{ _id: row.objectId }, { source_specimen_record_id: row.itemId }]
    }, { sort: { attempt_no: -1, updated_at: -1, created_at: -1 } })
    if (!work) return { success: false, error: 'work_item_missing', message: 'สร้าง LAB NO. แล้วแต่ไม่พบ Lab Work Item ของรายการในชุด' }
    if (text(work.lab_no) !== batchLabNo) {
      return { success: false, error: 'lab_no_conflict', message: 'LAB NO. ของรายการในชุดไม่ตรงกัน กรุณาโหลดใหม่' }
    }
    const status = lower(work.work_status)
    if (!['waiting_receive', 'received'].includes(status)) {
      return { success: false, error: 'invalid_status', message: 'รับ specimen ไม่ได้ในสถานะ ' + (status || 'ไม่ทราบสถานะ') }
    }
    batchWorkItems.push(work)
    if (work.cbc_swap_active === true && text(work.effective_item_master_id)) {
      const effectiveMaster = await masterCollection.findOne({ _id: app.dbObjectId(text(work.effective_item_master_id)), xrstatx: active })
      if (!effectiveMaster) return { success: false, error: 'cbc_swap_master_missing', message: 'ไม่พบ Master ปลายทางของรายการ CBC ที่สลับ' }
      row.master = effectiveMaster
      row.masterLab = effectiveMaster.lab_item && typeof effectiveMaster.lab_item === 'object' ? effectiveMaster.lab_item : {}
      row.effectiveItemName = text(work.effective_item_name || effectiveMaster.item_name)
    }
  }

  const batchPatient = batchOrder.vid && batchOrder.vid.pid || {}
  const batchVisit = batchOrder.vid || {}
  const batchVisitContext = await agentVisitContextForOrder(batchOrder)
  const rawBatchPriority = text(batchOrder.priority && (batchOrder.priority.code || batchOrder.priority.value) || batchOrder.priority).toUpperCase()
  const batchPriority = PRIORITY_MAP[rawBatchPriority] || ''
  const batchOrderedAt = toThaiIso(lastSentAt(batchOrder))
  const sortedContexts = itemContexts.slice().sort((left, right) =>
    (Number(left.item.item_no || 0) - Number(right.item.item_no || 0)) || left.itemId.localeCompare(right.itemId)
  )
  const batchSectionCode = text(batchWorkItems[0].section_code).toUpperCase()
  const batchItems = sortedContexts.map((row, index) => {
    const collectedAt = toThaiIso(row.labData.specimen_at || row.labData.at)
    const result = {
      seq: index + 1,
      test_code: text(row.masterLab.his_lab_code),
      test_name: text(row.effectiveItemName || row.item.item_name || row.master && row.master.item_name || row.item.item_code),
      specimen_code: row.specimenCode,
      specimen_name: row.specimenName,
      collector_code: text(row.labData.specimen_by || row.labData.by),
      collector_name: text(row.labData.specimen_by_name),
      lab_code: batchSectionCode,
      received_at: receivedIso,
      receiver: actorCode
    }
    if (collectedAt) result.collected_at = collectedAt
    if (SOURCE_MANAGED_SECTION_PREFIX[batchSectionCode] && row.master && row.master.req_commt === true) {
      result.comment = text(row.item.comment)
    }
    if (SOURCE_MANAGED_SECTION_PREFIX[batchSectionCode] && row.master && row.master.multi_specimen === true) {
      result.specimens = outboundSpecimens(row.labData)
    }
    return result
  })
  const batchPayload = {
    event_type: LAB_ORDER_EVENT_TYPE,
    order_no: receiptBatchId,
    labno: batchLabNo,
    hn: text(batchPatient.hn),
    visit_id: text(batchVisit.vn || batchOrder.xparentx),
    ordered_at: batchOrderedAt,
    priority: batchPriority,
    note: text(batchOrder.order_comment) || null,
    patient_prefix: patientPrefixText(batchPatient.prename),
    patient_first_name: text(batchPatient.p_fname || batchPatient.first_name),
    patient_last_name: text(batchPatient.p_lname || batchPatient.last_name),
    birth_date: birthDate(batchPatient.birth_date || batchVisit.birth_date),
    sex: batchVisitContext.sex,
    visit_type: batchVisitContext.encounterClass,
    encounter: { class: batchVisitContext.encounterClass },
    doctor_code: text(batchVisit.visit_doctor && (batchVisit.visit_doctor.code || batchVisit.visit_doctor.value)),
    doctor_title: text(batchVisit.visit_doctor && batchVisit.visit_doctor.title),
    doctor_name: text(batchVisit.visit_doctor && (batchVisit.visit_doctor.name || batchVisit.visit_doctor.label)),
    clinic_code: text(batchVisit.visit_clinic && (batchVisit.visit_clinic.code || batchVisit.visit_clinic.value)),
    clinic_name: text(batchVisit.visit_clinic && (batchVisit.visit_clinic.name || batchVisit.visit_clinic.label) || batchVisit.ward),
    station: text(batchVisit.ward || batchVisit.visit_clinic && (batchVisit.visit_clinic.name || batchVisit.visit_clinic.label)),
    mongo_form_id: WORK_ITEM_FORM_ID,
    mongo_data_id: receiptBatchId,
    items: batchItems
  }
  if (!batchPayload.birth_date) delete batchPayload.birth_date
  if (batchVisitContext.motherName) batchPayload.mother_name = batchVisitContext.motherName
  const batchMaternalBlood = maternalBloodFromOrder(batchOrder)
  if (typeof batchMaternalBlood === 'boolean') batchPayload.is_maternal_blood = batchMaternalBlood

  const batchMissingOutbound = []
  if (!batchOrderedAt) batchMissingOutbound.push('ordered_at')
  if (!batchPriority) batchMissingOutbound.push('priority')
  if (!batchVisitContext.sex) batchMissingOutbound.push('sex')
  batchItems.forEach((row, index) => {
    if (!row.test_code) batchMissingOutbound.push('items[' + index + '].test_code')
    if (!row.specimen_code) batchMissingOutbound.push('items[' + index + '].specimen_code')
  })
  const batchReadinessCode = batchMissingOutbound.length ? 'awaiting_outbound_data' : ''

  const persistBatchReceive = async session => {
    const sessionOptions = session ? { session } : {}
    const txItemCollection = app.db.collection(ITEM_COLLECTION)
    const txWorkCollection = app.db.collection(WORK_ITEM_COLLECTION)
    const outboundCollection = app.db.collection(OUTBOUND_COLLECTION)
    const txCancellationCollection = app.db.collection(ORDER_CANCELLATION_COLLECTION)
    if (await txCancellationCollection.findOne(batchCancellationQuery, sessionOptions)) throw new Error('ORDER_CANCELLED')
    let alreadyReceived = true
    let stableReceivedAt = ''
    const itemResults = []

    for (const row of itemContexts) {
      let current = await txWorkCollection.findOne({ _id: row.objectId, xrstatx: active }, sessionOptions)
      if (!current) throw new Error('WORK_ITEM_NOT_FOUND')
      if (text(current.lab_no) !== batchLabNo) throw new Error('LAB_NO_CONFLICT')
      const currentStatus = lower(current.work_status)
      if (!['waiting_receive', 'received'].includes(currentStatus)) throw new Error('WORK_ITEM_RECEIVE_CONFLICT')
      const identityFields = {
        source_order_id: text(batchOrder._id),
        source_order_number: text(batchOrder.order_number),
        source_specimen_record_id: row.itemId,
        receipt_batch_id: receiptBatchId,
        batch_item_count: requestedItemIds.length,
        patient_hn: text(batchPatient.hn),
        visit_id: text(batchVisit.vn || batchOrder.xparentx),
        updated_at: now,
        updated_by: { id: userInfo._id || userInfo.id || '', name: actorName || actorCode }
      }
      if (currentStatus === 'waiting_receive') {
        alreadyReceived = false
        const receiptFields = {
          ...identityFields,
          work_status: 'received',
          received_at: now,
          received_by: actorCode
        }
        const saved = await txWorkCollection.updateOne(
          { _id: current._id, xrstatx: active, work_status: 'waiting_receive', lab_no: batchLabNo },
          { $set: receiptFields },
          sessionOptions
        )
        if (!saved || Number(saved.matchedCount) !== 1) throw new Error('WORK_ITEM_RECEIVE_CONFLICT')
        current = { ...current, ...receiptFields }
      } else if (!text(current.visit_id) || text(current.receipt_batch_id) !== receiptBatchId) {
        const backfilled = await txWorkCollection.updateOne(
          { _id: current._id, xrstatx: active, work_status: 'received', lab_no: batchLabNo },
          { $set: identityFields },
          sessionOptions
        )
        if (!backfilled || Number(backfilled.matchedCount) !== 1) throw new Error('WORK_ITEM_IDENTITY_BACKFILL_FAILED')
        current = { ...current, ...identityFields }
      }
      if (!stableReceivedAt || text(current.received_at) < stableReceivedAt) stableReceivedAt = text(current.received_at) || now

      const cpoeStatus = lower(row.item.current_status)
      let nextCpoeStatus = cpoeStatus
      let changed = false
      let preservedTerminal = false
      if (cpoeStatus !== 'accepted') {
        if (terminalCpoeStatuses.includes(cpoeStatus)) preservedTerminal = true
        else {
          if (cpoeStatus !== 'ready') throw new Error('PAYMENT_NOT_READY')
          const savedItem = await txItemCollection.updateOne(
            { _id: row.objectId, xrstatx: active, current_status: 'ready' },
            { $set: { current_status: 'accepted' } },
            sessionOptions
          )
          if (!savedItem || Number(savedItem.matchedCount) !== 1) throw new Error('PAYMENT_NOT_READY')
          nextCpoeStatus = 'accepted'
          changed = true
        }
      }
      itemResults.push({
        item_id: row.itemId,
        work_item_id: text(current._id),
        lab_no: batchLabNo,
        current_status: nextCpoeStatus,
        cpoe_status_changed: changed,
        cpoe_terminal_preserved: preservedTerminal,
        work_status: 'received',
        received_at: text(current.received_at) || now,
        received_by: text(current.received_by) || actorCode
      })
    }

    const stableReceivedIso = toThaiIso(stableReceivedAt || now) || receivedIso
    const stablePayload = {
      ...batchPayload,
      items: batchPayload.items.map(row => ({ ...row, received_at: stableReceivedIso }))
    }
    const requestPayloadJson = JSON.stringify(stablePayload)
    const outboundObjectId = app.dbObjectId(receiptBatchId)
    let outbound = await outboundCollection.findOne({
      xrstatx: active,
      $or: [{ _id: outboundObjectId }, { receipt_batch_id: receiptBatchId }, { order_no: receiptBatchId }]
    }, sessionOptions)
    if (!outbound) {
      const outboundDoc = {
        _id: outboundObjectId,
        xparentx: outboundObjectId,
        xsitex: userInfo.site || {},
        xunitx: { code: batchSectionCode, name: text(batchWorkItems[0].section_name || batchSectionCode) },
        xrstatx: 1,
        xversionx: 'v1',
        xerrorx: null,
        dataid: receiptBatchId,
        work_item_id: receiptBatchId,
        work_item_ids_json: JSON.stringify(requestedItemIds),
        receipt_batch_id: receiptBatchId,
        source_cpoe_order_id: text(batchOrder._id),
        source_cpoe_item_id: receiptBatchId,
        source_cpoe_item_ids_json: JSON.stringify(requestedItemIds),
        order_no: receiptBatchId,
        lab_no: batchLabNo,
        section_code: batchSectionCode,
        patient_hn: text(batchPatient.hn),
        visit_id: text(batchVisit.vn || batchOrder.xparentx),
        item_count: requestedItemIds.length,
        hl7_status: 'new',
        transport_channel: 'agent_http',
        schema_version: '1.0',
        dispatch_id: '',
        order_ref: '',
        routed_to_json: '[]',
        agent_http_status: null,
        agent_duplicate: false,
        retryable: batchReadinessCode ? false : true,
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
        last_error_code: batchReadinessCode,
        last_error_at: batchReadinessCode ? now : '',
        last_error_http_status: '',
        last_error_reason: batchReadinessCode ? 'ข้อมูลยังไม่พร้อมส่ง Agent' : '',
        last_error_detail_json: batchReadinessCode ? JSON.stringify({ missing_fields: batchMissingOutbound }) : '',
        request_payload_hash: '',
        response_payload_hash: '',
        request_payload_json: requestPayloadJson,
        response_payload_json: '',
        attempt_history_json: '[]'
      }
      try {
        await outboundCollection.insertOne(outboundDoc, sessionOptions)
        outbound = outboundDoc
      } catch (error) {
        if (session) throw error
        outbound = await outboundCollection.findOne({ _id: outboundObjectId, xrstatx: active })
        if (!outbound) throw error
      }
    } else if (lower(outbound.hl7_status) === 'new' &&
      (Number(outbound.attempt_count || 0) === 0 || outbound.retest_pending_outbound === true)) {
      const refreshed = await outboundCollection.updateOne(
        { _id: outbound._id, xrstatx: active, hl7_status: 'new', attempt_count: Number(outbound.attempt_count || 0) },
        { $set: {
          lab_no: batchLabNo,
          item_count: requestedItemIds.length,
          work_item_ids_json: JSON.stringify(requestedItemIds),
          source_cpoe_item_ids_json: JSON.stringify(requestedItemIds),
          request_payload_json: requestPayloadJson,
          retest_pending_outbound: false,
          retryable: batchReadinessCode ? false : true,
          last_status_at: now,
          updated_at: now,
          updated_by: actorCode,
          last_error_code: batchReadinessCode,
          last_error_at: batchReadinessCode ? now : '',
          last_error_reason: batchReadinessCode ? 'ข้อมูลยังไม่พร้อมส่ง Agent' : '',
          last_error_detail_json: batchReadinessCode ? JSON.stringify({ missing_fields: batchMissingOutbound }) : ''
        } },
        sessionOptions
      )
      if (outbound.retest_pending_outbound === true && (!refreshed || Number(refreshed.matchedCount) !== 1)) {
        throw new Error('OUTBOUND_RETEST_REFRESH_FAILED')
      }
    }

    return {
      alreadyReceived,
      itemResults,
      workItemId: receiptBatchId,
      outboundOrderId: text(outbound._id),
      receivedAt: stableReceivedAt || now,
      receivedBy: actorCode
    }
  }

  let batchReceive
  try {
    if (this && typeof this.mongoTxn === 'function') {
      try {
        batchReceive = await this.mongoTxn(
          session => persistBatchReceive(session),
          { name: 'receiveLabBatchAndQueueOutbound', maxRetry: 5, timeoutMs: 15000 }
        )
      } catch (error) {
        if (!transactionUnsupported(error)) throw error
        batchReceive = await persistBatchReceive(null)
      }
    } else batchReceive = await persistBatchReceive(null)
  } catch (error) {
    const code = text(error && error.message || error)
    const messages = {
      WORK_ITEM_NOT_FOUND: 'ไม่พบ Lab Work Item ระหว่างบันทึกรับ specimen',
      WORK_ITEM_RECEIVE_CONFLICT: 'Lab Work Item ถูกเปลี่ยนสถานะระหว่างรับ specimen กรุณาโหลดใหม่',
      WORK_ITEM_IDENTITY_BACKFILL_FAILED: 'อัปเดตข้อมูลอ้างอิงของ Lab Work Item ไม่สำเร็จ',
      LAB_NO_CONFLICT: 'LAB NO. ของรายการในชุดเปลี่ยนระหว่างรับ specimen',
      ORDER_CANCELLED: 'Order นี้ถูกยกเลิกแล้ว จึงรับ specimen ไม่ได้',
      PAYMENT_NOT_READY: 'ยังไม่ผ่านการเงิน',
      CPOE_STATUS_SYNC_CONFLICT: 'สถานะ CPOE Item เปลี่ยนระหว่างรับ specimen กรุณาโหลดใหม่',
      OUTBOUND_RETEST_REFRESH_FAILED: 'Outbound รอบตรวจใหม่เปลี่ยนสถานะระหว่างรับ specimen กรุณาโหลดใหม่'
    }
    return { success: false, error: lower(code), message: messages[code] || 'บันทึกรับ specimen แบบชุดไม่สำเร็จ: ' + code }
  }

  const dispatchBatchAgent = async () => {
    const outboundCollection = app.db.collection(OUTBOUND_COLLECTION)
    let outbound = await outboundCollection.findOne({ _id: app.dbObjectId(batchReceive.outboundOrderId), xrstatx: active })
    if (!outbound) return { success: false, state: 'failed', hl7Status: 'new', retryable: true, deferred: false, error: 'outbound_not_found', message: 'รับ specimen แล้ว แต่ไม่พบ Outbound Order สำหรับส่ง Agent' }
    if (batchReadinessCode) return { success: false, state: 'awaiting_data', hl7Status: lower(outbound.hl7_status) || 'new', retryable: false, deferred: true, error: batchReadinessCode, message: 'รับ specimen แล้ว แต่ข้อมูลยังไม่พร้อมส่ง Agent' }
    const currentStatus = lower(outbound.hl7_status)
    if (['queued', 'sent', 'in_progress', 'resulted'].includes(currentStatus)) {
      return { success: true, state: outbound.agent_duplicate ? 'duplicate' : 'already_queued', hl7Status: currentStatus, retryable: false, deferred: false, httpStatus: Number(outbound.agent_http_status || 0) || null, duplicate: Boolean(outbound.agent_duplicate), message: 'Outbound Order นี้ส่ง Agent แล้ว' }
    }
    if (currentStatus === 'sending') return { success: false, state: 'sending', hl7Status: 'sending', retryable: true, deferred: false, error: 'dispatch_in_progress', message: 'รับ specimen แล้ว และกำลังส่ง Agent จากคำขออื่น' }
    const payload = jsonObject(outbound.request_payload_json)
    if (!payload) return { success: false, state: 'failed', hl7Status: 'new', retryable: false, deferred: false, error: 'invalid_outbound_snapshot', message: 'Outbound payload อ่านไม่ได้ กรุณาให้ผู้ดูแลตรวจสอบ' }

    const previousAttempts = Number(outbound.attempt_count || 0)
    const attemptNumber = previousAttempts + 1
    const claimed = await outboundCollection.updateOne(
      { _id: outbound._id, xrstatx: active, hl7_status: { $in: ['', 'new', null] }, attempt_count: previousAttempts },
      { $set: { hl7_status: 'sending', attempt_count: attemptNumber, first_attempt_at: text(outbound.first_attempt_at) || now, last_attempt_at: now, last_status_at: now, updated_at: now, updated_by: actorCode } }
    )
    if (!claimed || Number(claimed.matchedCount) !== 1) {
      outbound = await outboundCollection.findOne({ _id: outbound._id, xrstatx: active })
      const racedStatus = lower(outbound && outbound.hl7_status)
      const racedSuccess = ['queued', 'sent', 'in_progress', 'resulted'].includes(racedStatus)
      return { success: racedSuccess, state: racedSuccess ? 'already_queued' : 'sending', hl7Status: racedStatus || 'sending', retryable: racedStatus === 'sending', deferred: false, httpStatus: Number(outbound && outbound.agent_http_status || 0) || null, duplicate: Boolean(outbound && outbound.agent_duplicate), error: racedStatus === 'sending' ? 'dispatch_in_progress' : '', message: racedStatus === 'sending' ? 'รับ specimen แล้ว และกำลังส่ง Agent จากคำขออื่น' : 'Outbound Order นี้ส่ง Agent แล้ว' }
    }

    let submitted
    try {
      submitted = processResult(await app.subProcess(AGENT_SUBMIT_PROCESS_ID, { payload, audit_managed_by_receive: true }, userInfo))
    } catch (error) {
      submitted = { success: false, error: 'agent_process_failed', retryable: true, hl7_status: 'new', message: text(error && error.message) || 'เรียก Process ส่ง Agent ไม่สำเร็จ' }
    }
    const submitData = submitted && submitted.data && typeof submitted.data === 'object' ? submitted.data : {}
    const sendSuccess = Boolean(submitted && submitted.success === true)
    const httpStatus = Number(submitData.http_status || submitted && submitted.http_status || 0) || null
    const duplicate = Boolean(submitData.duplicate)
    const nextStatus = sendSuccess ? (lower(submitData.hl7_status) || 'queued') : 'new'
    const errorCode = sendSuccess ? '' : text(submitted && submitted.error) || 'agent_submit_failed'
    const errorReason = sendSuccess ? '' : text(submitted && (submitted.reason || submitted.message)) || 'ส่ง Agent ไม่สำเร็จ'
    const detail = submitted && submitted.detail != null ? submitted.detail : null
    const history = jsonArray(outbound.attempt_history_json)
    history.push({ attempt: attemptNumber, attempted_at: now, success: sendSuccess, hl7_status: nextStatus, http_status: httpStatus, duplicate, error: errorCode, message: text(submitted && submitted.message) })
    await outboundCollection.updateOne(
      { _id: outbound._id, xrstatx: active, hl7_status: 'sending', attempt_count: attemptNumber },
      { $set: {
        hl7_status: nextStatus,
        dispatch_id: sendSuccess ? text(submitData.dispatch_id) : text(outbound.dispatch_id),
        order_ref: sendSuccess ? text(submitData.order_ref) : text(outbound.order_ref),
        routed_to_json: sendSuccess && Array.isArray(submitData.routed_to) ? JSON.stringify(submitData.routed_to.map(text)) : text(outbound.routed_to_json) || '[]',
        agent_http_status: httpStatus,
        agent_duplicate: duplicate,
        retryable: sendSuccess ? false : Boolean(submitted && submitted.retryable),
        queued_at: sendSuccess ? (text(outbound.queued_at) || now) : text(outbound.queued_at),
        last_success_at: sendSuccess ? now : text(outbound.last_success_at),
        last_status_at: now,
        updated_at: now,
        updated_by: actorCode,
        last_error_code: errorCode,
        last_error_at: sendSuccess ? '' : now,
        last_error_http_status: sendSuccess ? '' : (httpStatus || ''),
        last_error_reason: errorReason,
        last_error_detail_json: sendSuccess || detail == null ? '' : JSON.stringify(detail),
        response_payload_json: JSON.stringify(submitted || {}),
        attempt_history_json: JSON.stringify(history.slice(-50))
      } }
    )
    return { success: sendSuccess, state: sendSuccess ? (duplicate ? 'duplicate' : 'queued') : 'failed', hl7Status: nextStatus, retryable: sendSuccess ? false : Boolean(submitted && submitted.retryable), deferred: false, httpStatus, duplicate, error: errorCode, message: sendSuccess ? text(submitted && submitted.message) || 'Agent รับ Order แล้ว' : 'รับ specimen แล้ว แต่ส่ง Agent ไม่สำเร็จ: ' + errorReason }
  }

  let batchTransport
  if (dispatchMode === 'deferred') {
    batchTransport = batchReadinessCode
      ? { success: false, state: 'awaiting_data', hl7Status: 'new', retryable: false, deferred: true, error: batchReadinessCode, message: 'รับ specimen แล้ว แต่ข้อมูลยังไม่พร้อมส่ง Agent' }
      : { success: false, state: 'pending_dispatch', hl7Status: 'new', retryable: true, deferred: true, error: '', message: 'รับ specimen แล้ว · กำลังส่ง Agent เบื้องหลัง' }
  } else {
    try {
      batchTransport = await dispatchBatchAgent()
    } catch (error) {
      batchTransport = { success: false, state: 'failed', hl7Status: 'new', retryable: true, deferred: false, error: 'transport_audit_failed', message: 'รับ specimen แล้ว แต่บันทึก/ส่งสถานะ Agent ไม่สำเร็จ: ' + (text(error && error.message) || 'unknown') }
    }
  }

  return {
    success: true,
    received: true,
    data: {
      item_id: requestedItemIds[0],
      item_ids: requestedItemIds,
      items: batchReceive.itemResults,
      work_item_id: receiptBatchId,
      work_item_ids: requestedItemIds,
      receipt_batch_id: receiptBatchId,
      batch_item_count: requestedItemIds.length,
      outbound_order_id: batchReceive.outboundOrderId,
      source_order_no: text(batchOrder.order_number),
      order_no: receiptBatchId,
      lab_no: batchLabNo,
      current_status: 'accepted',
      work_status: 'received',
      hl7_status: batchTransport.hl7Status || 'new',
      outbound_readiness: batchReadinessCode || 'ready',
      missing_fields: batchMissingOutbound,
      received_at: batchReceive.receivedAt,
      received_by: batchReceive.receivedBy,
      already_received: Boolean(batchReceive.alreadyReceived),
      agent_send_success: Boolean(batchTransport.success),
      agent_transport_state: batchTransport.state,
      agent_http_status: batchTransport.httpStatus || null,
      agent_duplicate: Boolean(batchTransport.duplicate),
      agent_retryable: Boolean(batchTransport.retryable),
      agent_error: batchTransport.error || '',
      agent_message: batchTransport.message || '',
      agent_dispatch_queued: batchTransport.state === 'pending_dispatch',
      transport_deferred: Boolean(batchTransport.deferred)
    },
    message: batchTransport.message || (batchReceive.alreadyReceived ? 'ชุดนี้รับ specimen และมี Outbound Order แล้ว' : 'รับ specimen แล้ว')
  }
}

const syncCpoeItemStatus = async (collection, targetStatus, options) => {
  const queryOptions = options || {}
  const current = await collection.findOne({ _id: itemObjectId, xrstatx: active }, queryOptions)
  if (!current) throw new Error('CPOE_ITEM_NOT_FOUND')
  const currentStatus = lower(current.current_status)
  if (currentStatus === targetStatus) {
    return { status: currentStatus, changed: false, preservedTerminal: false }
  }
  if (terminalCpoeStatuses.includes(currentStatus)) {
    return { status: currentStatus, changed: false, preservedTerminal: true }
  }
  if (targetStatus === 'accepted' && currentStatus !== 'ready') throw new Error('PAYMENT_NOT_READY')
  const saved = await collection.updateOne(
    { _id: itemObjectId, xrstatx: active, current_status: targetStatus === 'accepted' ? 'ready' : { $nin: terminalCpoeStatuses } },
    { $set: { current_status: targetStatus } },
    queryOptions
  )
  if (saved && Number(saved.matchedCount) === 1) {
    return { status: targetStatus, changed: true, preservedTerminal: false }
  }
  const raced = await collection.findOne({ _id: itemObjectId, xrstatx: active }, queryOptions)
  const racedStatus = lower(raced && raced.current_status)
  if (racedStatus === targetStatus || terminalCpoeStatuses.includes(racedStatus)) {
    return { status: racedStatus, changed: false, preservedTerminal: terminalCpoeStatuses.includes(racedStatus) && racedStatus !== targetStatus }
  }
  if (targetStatus === 'accepted' && racedStatus !== 'ready') throw new Error('PAYMENT_NOT_READY')
  throw new Error('CPOE_STATUS_SYNC_CONFLICT')
}

const item = await itemCollection.findOne({ _id: itemObjectId, xrstatx: active })
if (!item) return { success: false, error: 'item_not_found', message: 'ไม่พบ CPOE Item ที่ต้องการรับ specimen' }
if (lower(item.service_type && item.service_type.value) !== 'lab') {
  return { success: false, error: 'item_not_lab', message: 'รับ specimen ได้เฉพาะ LAB Item' }
}
const orderRef = orderReference(item)
if (!orderRef) return { success: false, error: 'order_reference_missing', message: 'Item ไม่มีข้อมูลเชื่อม CPOE Order' }
const order = await orderCollection.findOne({ _id: orderRef, xrstatx: active })
if (!order) return { success: false, error: 'order_not_found', message: 'ไม่พบ CPOE Order ของ Item นี้' }
const orderObjectId = order._id
const cancellationQuery = {
  _id: orderObjectId,
  xrstatx: active,
  cancel_status: { $in: ['pending', 'applied'] }
}
if (await cancellationCollection.findOne(cancellationQuery)) {
  return { success: false, error: 'order_cancelled', message: 'Order นี้ถูกยกเลิกแล้ว จึงรับ specimen ไม่ได้' }
}

let workItem = await workCollection.findOne({
  xrstatx: active,
  is_current_attempt: { $ne: false },
  $or: [{ _id: itemObjectId }, { source_specimen_record_id: itemId }]
}, { sort: { attempt_no: -1, updated_at: -1, created_at: -1 } })
const alreadyReceivedWorkItem = workItem && lower(workItem.work_status) === 'received'
if (lower(item.current_status) !== 'ready' && !alreadyReceivedWorkItem) {
  return { success: false, error: 'payment_not_ready', message: 'ยังไม่ผ่านการเงิน' }
}
let master = null
if (item.item_data_id) master = await masterCollection.findOne({ _id: item.item_data_id, xrstatx: active })
const initialLabData = item.lab_data && typeof item.lab_data === 'object' ? item.lab_data : {}
const initialMasterLab = master && master.lab_item && typeof master.lab_item === 'object' ? master.lab_item : {}
const initialMasterSpecimen = initialMasterLab.specimen && !Array.isArray(initialMasterLab.specimen) ? initialMasterLab.specimen : {}
let sourceContext = null
try {
  sourceContext = await sourceSectionContext(item, master, workItem)
  if (sourceContext) {
    await reserveSourceManagedWorkItems([{
      itemId, objectId: itemObjectId, item, orderRef: text(orderRef), master,
      masterLab: initialMasterLab, labData: initialLabData,
      specimenCode: text(initialLabData.spec_source_code || initialMasterSpecimen.code),
      specimenName: text(initialLabData.spec_source || initialLabData.source || initialMasterSpecimen.name),
      existingWork: workItem
    }], order)
    workItem = await workCollection.findOne({
      xrstatx: active,
      is_current_attempt: { $ne: false },
      $or: [{ _id: itemObjectId }, { source_specimen_record_id: itemId }]
    }, { sort: { attempt_no: -1, updated_at: -1, created_at: -1 } })
  }
} catch (error) {
  return sourceErrorResponse(error)
}
/* ตรวจใหม่ 2026-09-04: Work Item เดิมถูก reset ไว้โดยตั้ง marker และล้าง LAB NO.
   ให้ใช้ Lab No. Generator ตัวเดิมออกเลขใหม่ตอนกดรับ specimen เท่านั้น
   Work Item ที่ไม่มีเลขแต่ไม่มี marker ยัง fail closed เหมือนเดิม */
if (!sourceContext && (!workItem || ((workItem.retest_pending_lab_no === true || workItem.cbc_swap_pending_lab_no === true) && !text(workItem.lab_no)))) {
  let generated
  try {
    generated = processResult(await app.subProcess(LAB_NO_PROCESS_ID, { item_id: itemId }, userInfo))
  } catch (error) {
    return { success: false, error: 'lab_no_process_failed', message: 'เรียก API สร้าง LAB NO. ไม่สำเร็จ' }
  }
  if (!generated || generated.success !== true || !text(generated.data && generated.data.lab_no)) {
    return { success: false, error: 'lab_no_failed', message: text(generated && generated.message) || 'สร้าง LAB NO. ไม่สำเร็จ' }
  }
  workItem = await workCollection.findOne({
    xrstatx: active,
    is_current_attempt: { $ne: false },
    $or: [{ _id: itemObjectId }, { source_specimen_record_id: itemId }]
  }, { sort: { attempt_no: -1, updated_at: -1, created_at: -1 } })
  if (!workItem) {
    return { success: false, error: 'work_item_missing', message: 'สร้าง LAB NO. แล้วแต่ไม่พบ Lab Work Item กรุณาให้ผู้ดูแลตรวจสอบ' }
  }
}

const workStatus = lower(workItem.work_status)
if (!['waiting_receive', 'received'].includes(workStatus)) {
  return { success: false, error: 'invalid_status', message: 'รับ specimen ไม่ได้ในสถานะ ' + (workStatus || 'ไม่ทราบสถานะ') }
}
const labNo = text(workItem.lab_no)
if (!labNo) return { success: false, error: 'lab_no_missing', message: 'Lab Work Item ไม่มี LAB NO.' }

const effectiveMasterId = workItem.cbc_swap_active === true && text(workItem.effective_item_master_id)
  ? text(workItem.effective_item_master_id)
  : item.item_data_id
if (effectiveMasterId && (!master || text(master._id) !== text(effectiveMasterId))) {
  master = await masterCollection.findOne({ _id: typeof effectiveMasterId === 'string' ? app.dbObjectId(effectiveMasterId) : effectiveMasterId, xrstatx: active })
}
if (workItem.cbc_swap_active === true && !master) {
  return { success: false, error: 'cbc_swap_master_missing', message: 'ไม่พบ Master ปลายทางของรายการ CBC ที่สลับ' }
}
const labData = item.lab_data && typeof item.lab_data === 'object' ? item.lab_data : {}
const masterLab = master && master.lab_item && typeof master.lab_item === 'object' ? master.lab_item : {}
const masterSpecimen = masterLab.specimen && !Array.isArray(masterLab.specimen) ? masterLab.specimen : {}
const patient = order.vid && order.vid.pid || {}
const visit = order.vid || {}
const agentVisitContext = await agentVisitContextForOrder(order)
const rawPriority = text(order.priority && (order.priority.code || order.priority.value) || order.priority).toUpperCase()
const priority = PRIORITY_MAP[rawPriority] || ''
const collectedAt = toThaiIso(labData.specimen_at || labData.at)
const testCode = text(masterLab.his_lab_code)
const specimenCode = text(labData.spec_source_code || masterSpecimen.code)
const orderedAt = toThaiIso(lastSentAt(order))
const sectionCode = text(workItem.section_code).toUpperCase()
const workItemId = text(workItem._id)
const buildPayload = stableReceivedIso => {
  const payload = {
    event_type: LAB_ORDER_EVENT_TYPE,
    order_no: workItemId,
    labno: labNo,
    hn: text(patient.hn),
    visit_id: text(visit.vn || order.xparentx),
    ordered_at: orderedAt,
    priority,
    note: text(order.order_comment) || null,
    patient_prefix: patientPrefixText(patient.prename),
    patient_first_name: text(patient.p_fname || patient.first_name),
    patient_last_name: text(patient.p_lname || patient.last_name),
    birth_date: birthDate(patient.birth_date || visit.birth_date),
    sex: agentVisitContext.sex,
    visit_type: agentVisitContext.encounterClass,
    encounter: { class: agentVisitContext.encounterClass },
    doctor_code: text(visit.visit_doctor && (visit.visit_doctor.code || visit.visit_doctor.value)),
    doctor_title: text(visit.visit_doctor && visit.visit_doctor.title),
    doctor_name: text(visit.visit_doctor && (visit.visit_doctor.name || visit.visit_doctor.label)),
    clinic_code: text(visit.visit_clinic && (visit.visit_clinic.code || visit.visit_clinic.value)),
    clinic_name: text(visit.visit_clinic && (visit.visit_clinic.name || visit.visit_clinic.label) || visit.ward),
    station: text(visit.ward || visit.visit_clinic && (visit.visit_clinic.name || visit.visit_clinic.label)),
    mongo_form_id: WORK_ITEM_FORM_ID,
    mongo_data_id: workItemId,
    items: [{
      seq: 1,
      test_code: testCode,
      test_name: text(workItem.cbc_swap_active === true && workItem.effective_item_name || item.item_name || master && master.item_name || item.item_code),
      specimen_code: specimenCode,
      specimen_name: text(labData.spec_source || labData.source || masterSpecimen.name),
      collector_code: text(labData.specimen_by || labData.by),
      collector_name: text(labData.specimen_by_name),
      lab_code: sectionCode,
      collected_at: collectedAt,
      received_at: stableReceivedIso,
      receiver: actorCode
    }]
  }
  if (!payload.birth_date) delete payload.birth_date
  if (agentVisitContext.motherName) payload.mother_name = agentVisitContext.motherName
  const maternalBlood = maternalBloodFromOrder(order)
  if (typeof maternalBlood === 'boolean') payload.is_maternal_blood = maternalBlood
  if (!collectedAt) delete payload.items[0].collected_at
  if (sourceContext && master && master.req_commt === true) payload.items[0].comment = text(item.comment)
  if (sourceContext && master && master.multi_specimen === true) payload.items[0].specimens = outboundSpecimens(labData)
  return payload
}

const missingOutbound = []
if (!orderedAt) missingOutbound.push('ordered_at')
if (!priority) missingOutbound.push('priority')
if (!agentVisitContext.sex) missingOutbound.push('sex')
if (!testCode) missingOutbound.push('items[0].test_code')
if (!specimenCode) missingOutbound.push('items[0].specimen_code')
const readinessCode = missingOutbound.length ? 'awaiting_outbound_data' : ''

const persistReceive = async session => {
    const sessionOptions = session ? { session } : {}
    const txItemCollection = app.db.collection(ITEM_COLLECTION)
    const txWorkCollection = app.db.collection(WORK_ITEM_COLLECTION)
    const outboundCollection = app.db.collection(OUTBOUND_COLLECTION)
    const txCancellationCollection = app.db.collection(ORDER_CANCELLATION_COLLECTION)
    const cancellation = await txCancellationCollection.findOne(cancellationQuery, sessionOptions)
    if (cancellation) throw new Error('ORDER_CANCELLED')
    let current = await txWorkCollection.findOne({ _id: workItem._id, xrstatx: active }, sessionOptions)
    if (!current) throw new Error('WORK_ITEM_NOT_FOUND')
    if (text(current.lab_no) !== labNo) throw new Error('LAB_NO_CONFLICT')
    let currentStatus = lower(current.work_status)
    if (!['waiting_receive', 'received'].includes(currentStatus)) throw new Error('WORK_ITEM_RECEIVE_CONFLICT')
    let alreadyReceived = currentStatus === 'received'

    const identityFields = {
      source_order_id: text(order._id),
      source_order_number: text(order.order_number),
      source_specimen_record_id: itemId,
      patient_hn: text(patient.hn),
      visit_id: text(visit.vn || order.xparentx),
      updated_at: now,
      updated_by: { id: userInfo._id || userInfo.id || '', name: actorName || actorCode }
    }

    let outbound = await outboundCollection.findOne({
      xrstatx: active,
      $or: [{ _id: current._id }, { work_item_id: workItemId }, { order_no: workItemId }]
    }, sessionOptions)

    if (currentStatus === 'waiting_receive') {
      const receiptFields = {
        ...identityFields,
        work_status: 'received',
        received_at: now,
        received_by: actorCode,
      }
      const saved = await txWorkCollection.updateOne(
        { _id: current._id, xrstatx: active, work_status: 'waiting_receive', lab_no: labNo },
        { $set: receiptFields },
        sessionOptions
      )
      if (!saved || Number(saved.matchedCount) !== 1) {
        if (session) throw new Error('WORK_ITEM_RECEIVE_CONFLICT')
        const raced = await txWorkCollection.findOne({ _id: current._id, xrstatx: active })
        if (!raced || lower(raced.work_status) !== 'received') throw new Error('WORK_ITEM_RECEIVE_CONFLICT')
        if (text(raced.lab_no) !== labNo) throw new Error('LAB_NO_CONFLICT')
        current = raced
        currentStatus = 'received'
        alreadyReceived = true
      } else {
        current = { ...current, ...receiptFields }
        currentStatus = 'received'
      }
    }

    if (currentStatus === 'received' && !text(current.visit_id)) {
      const backfilled = await txWorkCollection.updateOne(
        { _id: current._id, xrstatx: active, work_status: 'received', lab_no: labNo },
        { $set: identityFields },
        sessionOptions
      )
      if (!backfilled || Number(backfilled.matchedCount) !== 1) throw new Error('WORK_ITEM_IDENTITY_BACKFILL_FAILED')
      current = { ...current, ...identityFields }
    }

    const stableReceivedIso = toThaiIso(text(current.received_at) || now) || receivedIso
    const requestPayloadJson = JSON.stringify(buildPayload(stableReceivedIso))

    if (!outbound) {
      const outboundDoc = {
        _id: current._id,
        xparentx: current._id,
        xsitex: userInfo.site || {},
        xunitx: { code: sectionCode, name: text(current.section_name || sectionCode) },
        xrstatx: 1,
        xversionx: 'v1',
        xerrorx: null,
        dataid: workItemId,
        work_item_id: workItemId,
        source_cpoe_order_id: text(order._id),
        source_cpoe_item_id: itemId,
        order_no: workItemId,
        lab_no: labNo,
        section_code: sectionCode,
        patient_hn: text(patient.hn),
        visit_id: text(visit.vn || order.xparentx),
        item_count: 1,
        hl7_status: 'new',
        transport_channel: 'agent_http',
        schema_version: '1.0',
        dispatch_id: '',
        order_ref: '',
        routed_to_json: '[]',
        agent_http_status: null,
        agent_duplicate: false,
        retryable: readinessCode ? false : true,
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
        last_error_code: readinessCode,
        last_error_at: readinessCode ? now : '',
        last_error_http_status: '',
        last_error_reason: readinessCode ? 'ข้อมูลยังไม่พร้อมส่ง Agent' : '',
        last_error_detail_json: readinessCode ? JSON.stringify({ missing_fields: missingOutbound }) : '',
        request_payload_hash: '',
        response_payload_hash: '',
        request_payload_json: requestPayloadJson,
        response_payload_json: '',
        attempt_history_json: '[]'
      }
      try {
        await outboundCollection.insertOne(outboundDoc, sessionOptions)
        outbound = outboundDoc
      } catch (error) {
        if (session) throw error
        outbound = await outboundCollection.findOne({
          xrstatx: active,
          $or: [{ _id: current._id }, { work_item_id: workItemId }, { order_no: workItemId }]
        })
        if (!outbound) throw error
      }
    } else if (lower(outbound.hl7_status) === 'new' &&
      (Number(outbound.attempt_count || 0) === 0 || outbound.retest_pending_outbound === true)) {
      const outboundRefreshQuery = {
        _id: outbound._id,
        xrstatx: active,
        hl7_status: 'new',
        attempt_count: Number(outbound.attempt_count || 0)
      }
      if (outbound.retest_pending_outbound === true) outboundRefreshQuery.retest_pending_outbound = true
      const refreshed = await outboundCollection.updateOne(
        outboundRefreshQuery,
        { $set: {
          lab_no: labNo,
          request_payload_json: requestPayloadJson,
          retest_pending_outbound: false,
          retryable: readinessCode ? false : true,
          last_status_at: now,
          updated_at: now,
          updated_by: actorCode,
          last_error_code: readinessCode,
          last_error_at: readinessCode ? now : '',
          last_error_reason: readinessCode ? 'ข้อมูลยังไม่พร้อมส่ง Agent' : '',
          last_error_detail_json: readinessCode ? JSON.stringify({ missing_fields: missingOutbound }) : ''
        } },
        sessionOptions
      )
      if (outbound.retest_pending_outbound === true && (!refreshed || Number(refreshed.matchedCount) !== 1)) {
        throw new Error('OUTBOUND_RETEST_REFRESH_FAILED')
      }
    }

    const cpoeSync = await syncCpoeItemStatus(txItemCollection, 'accepted', sessionOptions)

    return {
      alreadyReceived,
      workItemId,
      outboundOrderId: text(outbound._id),
      receivedAt: text(current.received_at) || now,
      receivedBy: text(current.received_by) || actorCode,
      cpoeStatus: cpoeSync.status,
      cpoeStatusChanged: cpoeSync.changed,
      cpoeTerminalPreserved: cpoeSync.preservedTerminal
    }
}

let receive
try {
  if (this && typeof this.mongoTxn === 'function') {
    try {
      receive = await this.mongoTxn(
        session => persistReceive(session),
        { name: 'receiveLabWorkItemAndQueueOutbound', maxRetry: 5, timeoutMs: 15000 }
      )
    } catch (error) {
      if (!transactionUnsupported(error)) throw error
      receive = await persistReceive(null)
    }
  } else {
    // Keep direct/nested Process execution compatible when initCraft does not
    // bind mongoTxn on the Process `this` value.
    receive = await persistReceive(null)
  }
} catch (error) {
  const code = text(error && error.message || error)
  const messages = {
    WORK_ITEM_NOT_FOUND: 'ไม่พบ Lab Work Item ระหว่างบันทึกรับ specimen',
    WORK_ITEM_RECEIVE_CONFLICT: 'Lab Work Item ถูกเปลี่ยนสถานะระหว่างรับ specimen กรุณาโหลดใหม่',
    WORK_ITEM_IDENTITY_BACKFILL_FAILED: 'อัปเดตข้อมูลอ้างอิงของ Lab Work Item ไม่สำเร็จ',
    LAB_NO_CONFLICT: 'LAB NO. ของ Work Item เปลี่ยนระหว่างรับ specimen',
    ORDER_CANCELLED: 'Order นี้ถูกยกเลิกแล้ว จึงรับ specimen ไม่ได้',
    CPOE_ITEM_NOT_FOUND: 'ไม่พบ CPOE Item ระหว่าง sync สถานะรับ specimen',
    PAYMENT_NOT_READY: 'ยังไม่ผ่านการเงิน',
    CPOE_STATUS_SYNC_CONFLICT: 'สถานะ CPOE Item เปลี่ยนระหว่างรับ specimen กรุณาโหลดใหม่',
    OUTBOUND_RETEST_REFRESH_FAILED: 'Outbound รอบตรวจใหม่เปลี่ยนสถานะระหว่างรับ specimen กรุณาโหลดใหม่'
  }
  return { success: false, error: lower(code), message: messages[code] || 'บันทึกรับ specimen ไม่สำเร็จ: ' + code }
}

const dispatchAgent = async () => {
  const outboundCollection = app.db.collection(OUTBOUND_COLLECTION)
  let outbound = await outboundCollection.findOne({
    _id: app.dbObjectId(receive.outboundOrderId),
    xrstatx: active
  })
  if (!outbound) {
    return {
      success: false,
      state: 'failed',
      hl7Status: 'new',
      retryable: true,
      deferred: false,
      error: 'outbound_not_found',
      message: 'รับ specimen แล้ว แต่ไม่พบ Outbound Order สำหรับส่ง Agent'
    }
  }

  if (readinessCode) {
    return {
      success: false,
      state: 'awaiting_data',
      hl7Status: lower(outbound.hl7_status) || 'new',
      retryable: false,
      deferred: true,
      error: readinessCode,
      message: 'รับ specimen แล้ว แต่ข้อมูลยังไม่พร้อมส่ง Agent'
    }
  }

  const currentTransportStatus = lower(outbound.hl7_status)
  if (['queued', 'sent', 'in_progress', 'resulted'].includes(currentTransportStatus)) {
    return {
      success: true,
      state: outbound.agent_duplicate ? 'duplicate' : 'already_queued',
      hl7Status: currentTransportStatus,
      retryable: false,
      deferred: false,
      httpStatus: Number(outbound.agent_http_status || 0) || null,
      duplicate: Boolean(outbound.agent_duplicate),
      message: 'Outbound Order นี้ส่ง Agent แล้ว'
    }
  }
  if (currentTransportStatus === 'sending') {
    return {
      success: false,
      state: 'sending',
      hl7Status: 'sending',
      retryable: true,
      deferred: false,
      error: 'dispatch_in_progress',
      message: 'รับ specimen แล้ว และกำลังส่ง Agent จากคำขออื่น'
    }
  }

  const payload = jsonObject(outbound.request_payload_json)
  if (!payload) {
    const errorResult = {
      success: false,
      error: 'invalid_outbound_snapshot',
      retryable: false,
      hl7_status: 'new',
      message: 'Outbound payload อ่านไม่ได้ กรุณาให้ผู้ดูแลตรวจสอบ'
    }
    await outboundCollection.updateOne(
      { _id: outbound._id, xrstatx: active },
      { $set: {
        retryable: false,
        last_status_at: now,
        updated_at: now,
        updated_by: actorCode,
        last_error_code: errorResult.error,
        last_error_at: now,
        last_error_reason: errorResult.message,
        last_error_detail_json: '',
        response_payload_json: JSON.stringify(errorResult)
      } }
    )
    return {
      success: false,
      state: 'failed',
      hl7Status: 'new',
      retryable: false,
      deferred: false,
      error: errorResult.error,
      message: 'รับ specimen แล้ว แต่ ' + errorResult.message
    }
  }

  const previousAttempts = Number(outbound.attempt_count || 0)
  const attemptNumber = previousAttempts + 1
  const claimed = await outboundCollection.updateOne(
    { _id: outbound._id, xrstatx: active, hl7_status: { $in: ['', 'new', null] }, attempt_count: previousAttempts },
    { $set: {
      hl7_status: 'sending',
      attempt_count: attemptNumber,
      first_attempt_at: text(outbound.first_attempt_at) || now,
      last_attempt_at: now,
      last_status_at: now,
      updated_at: now,
      updated_by: actorCode
    } }
  )
  if (!claimed || Number(claimed.matchedCount) !== 1) {
    outbound = await outboundCollection.findOne({ _id: outbound._id, xrstatx: active })
    const racedStatus = lower(outbound && outbound.hl7_status)
    const racedSuccess = ['queued', 'sent', 'in_progress', 'resulted'].includes(racedStatus)
    return {
      success: racedSuccess,
      state: racedSuccess ? 'already_queued' : 'sending',
      hl7Status: racedStatus || 'sending',
      retryable: racedStatus === 'sending',
      deferred: false,
      httpStatus: Number(outbound && outbound.agent_http_status || 0) || null,
      duplicate: Boolean(outbound && outbound.agent_duplicate),
      error: racedStatus === 'sending' ? 'dispatch_in_progress' : '',
      message: racedStatus === 'sending'
        ? 'รับ specimen แล้ว และกำลังส่ง Agent จากคำขออื่น'
        : 'Outbound Order นี้ส่ง Agent แล้ว'
    }
  }

  let submitted
  try {
    submitted = processResult(await app.subProcess(
      AGENT_SUBMIT_PROCESS_ID,
      { payload, audit_managed_by_receive: true },
      userInfo
    ))
  } catch (error) {
    submitted = {
      success: false,
      error: 'agent_process_failed',
      retryable: true,
      hl7_status: 'new',
      message: text(error && error.message) || 'เรียก Process ส่ง Agent ไม่สำเร็จ'
    }
  }

  const submitData = submitted && submitted.data && typeof submitted.data === 'object' ? submitted.data : {}
  const sendSuccess = Boolean(submitted && submitted.success === true)
  const httpStatus = Number(submitData.http_status || submitted && submitted.http_status || 0) || null
  const duplicate = Boolean(submitData.duplicate)
  const nextStatus = sendSuccess ? (lower(submitData.hl7_status) || 'queued') : 'new'
  const errorCode = sendSuccess ? '' : text(submitted && submitted.error) || 'agent_submit_failed'
  const errorReason = sendSuccess ? '' : text(submitted && (submitted.reason || submitted.message)) || 'ส่ง Agent ไม่สำเร็จ'
  const detail = submitted && submitted.detail != null ? submitted.detail : null
  const responseJson = JSON.stringify(submitted || {})
  const history = jsonArray(outbound.attempt_history_json)
  history.push({
    attempt: attemptNumber,
    attempted_at: now,
    success: sendSuccess,
    hl7_status: nextStatus,
    http_status: httpStatus,
    duplicate,
    error: errorCode,
    message: text(submitted && submitted.message)
  })

  await outboundCollection.updateOne(
    { _id: outbound._id, xrstatx: active, hl7_status: 'sending', attempt_count: attemptNumber },
    { $set: {
      hl7_status: nextStatus,
      dispatch_id: sendSuccess ? text(submitData.dispatch_id) : text(outbound.dispatch_id),
      order_ref: sendSuccess ? text(submitData.order_ref) : text(outbound.order_ref),
      routed_to_json: sendSuccess && Array.isArray(submitData.routed_to)
        ? JSON.stringify(submitData.routed_to.map(text))
        : text(outbound.routed_to_json) || '[]',
      agent_http_status: httpStatus,
      agent_duplicate: duplicate,
      retryable: sendSuccess ? false : Boolean(submitted && submitted.retryable),
      queued_at: sendSuccess ? (text(outbound.queued_at) || now) : text(outbound.queued_at),
      last_success_at: sendSuccess ? now : text(outbound.last_success_at),
      last_status_at: now,
      updated_at: now,
      updated_by: actorCode,
      last_error_code: errorCode,
      last_error_at: sendSuccess ? '' : now,
      last_error_http_status: sendSuccess ? '' : (httpStatus || ''),
      last_error_reason: errorReason,
      last_error_detail_json: sendSuccess || detail == null ? '' : JSON.stringify(detail),
      response_payload_json: responseJson,
      attempt_history_json: JSON.stringify(history.slice(-50))
    } }
  )

  return {
    success: sendSuccess,
    state: sendSuccess ? (duplicate ? 'duplicate' : 'queued') : 'failed',
    hl7Status: nextStatus,
    retryable: sendSuccess ? false : Boolean(submitted && submitted.retryable),
    deferred: false,
    httpStatus,
    duplicate,
    error: errorCode,
    message: sendSuccess
      ? text(submitted && submitted.message) || 'Agent รับ Order แล้ว'
      : 'รับ specimen แล้ว แต่ส่ง Agent ไม่สำเร็จ: ' + errorReason
  }
}

let transport
if (dispatchMode === 'deferred') {
  transport = readinessCode
    ? {
        success: false,
        state: 'awaiting_data',
        hl7Status: 'new',
        retryable: false,
        deferred: true,
        error: readinessCode,
        message: 'รับ specimen แล้ว แต่ข้อมูลยังไม่พร้อมส่ง Agent'
      }
    : {
        success: false,
        state: 'pending_dispatch',
        hl7Status: 'new',
        retryable: true,
        deferred: true,
        error: '',
        message: 'รับ specimen แล้ว · กำลังส่ง Agent เบื้องหลัง'
      }
} else {
  try {
    transport = await dispatchAgent()
  } catch (error) {
    transport = {
      success: false,
      state: 'failed',
      hl7Status: 'new',
      retryable: true,
      deferred: false,
      error: 'transport_audit_failed',
      message: 'รับ specimen แล้ว แต่บันทึก/ส่งสถานะ Agent ไม่สำเร็จ: ' + (text(error && error.message) || 'unknown')
    }
  }
}

return {
  success: true,
  received: true,
  data: {
    item_id: itemId,
    work_item_id: receive.workItemId,
    outbound_order_id: receive.outboundOrderId,
    source_order_no: text(order.order_number),
    order_no: workItemId,
    lab_no: labNo,
    current_status: receive.cpoeStatus,
    cpoe_status_changed: Boolean(receive.cpoeStatusChanged),
    cpoe_terminal_preserved: Boolean(receive.cpoeTerminalPreserved),
    work_status: 'received',
    hl7_status: transport.hl7Status || 'new',
    outbound_readiness: readinessCode || 'ready',
    missing_fields: missingOutbound,
    received_at: receive.receivedAt,
    received_by: receive.receivedBy,
    already_received: Boolean(receive.alreadyReceived),
    agent_send_success: Boolean(transport.success),
    agent_transport_state: transport.state,
    agent_http_status: transport.httpStatus || null,
    agent_duplicate: Boolean(transport.duplicate),
    agent_retryable: Boolean(transport.retryable),
    agent_error: transport.error || '',
    agent_message: transport.message || '',
    agent_dispatch_queued: transport.state === 'pending_dispatch',
    transport_deferred: Boolean(transport.deferred)
  },
  message: transport.message || (receive.alreadyReceived
    ? 'Item นี้รับ specimen และมี Outbound Order แล้ว'
    : 'รับ specimen แล้ว')
}
