/**
 * pis-order-accept — Pharmacy accepts medication-only CPOE Orders for one Visit.
 *
 * Working copy of deployed Process 6a7a8687ff82f62b36d36f11, corrected 2026-10-06
 * after R2610060007 proved that the old Visit-wide update changed X-ray/LAB Items
 * from `sent` to `accepted` when Pharmacy accepted the patient.
 *
 * Contract preserved:
 * - idempotent: only `sent` headers/items can move to `accepted`;
 * - sequential writes and atomic status guards remain;
 * - one click still accepts every medication-only Order in the Visit.
 *
 * New safety boundary:
 * - an Order is accepted only when it has active Items and every active Item has
 *   `service_type.value = med`;
 * - mixed or non-medication Orders are skipped without changing header or Items.
 */

const FORM_ORDER = '6a6f5cd1265885c2377cc218'
const FORM_ORDER_ITEM = '6a6f7db2265885c2377cc222'
const FORM_COLL = 'sdform_manage'
const SENT = 'sent'
const ACCEPTED = 'accepted'
const MED_SERVICE = 'med'

const oid = id => {
  try {
    return app.dbObjectId(String(id))
  } catch (error) {
    return null
  }
}
const text = value => {
  if (value == null) return ''
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return String(value.toHexString())
    if (value.$oid != null) return String(value.$oid)
    if (value.value != null) return text(value.value)
  }
  return String(value)
}
const bothIds = id => [text(id), oid(id)].filter(Boolean)
const fail = (code, message) => ({
  success: false,
  code: code,
  message: message,
  accepted: 0,
  item_updated: 0,
  skipped_non_med: 0,
  orders: []
})

const tableOf = async formId => {
  const formObjectId = oid(formId)
  const doc = formObjectId
    ? await app.db.collection(FORM_COLL).findOne(
        { _id: formObjectId },
        { projection: { form_table: 1 } }
      )
    : null
  return (doc && doc.form_table) || null
}

const visitId = text(params.visit_id).trim()
if (!visitId || !oid(visitId)) return fail('NO_VISIT', 'ไม่ได้ระบุ visit')

const orderTable = await tableOf(FORM_ORDER)
const itemTable = await tableOf(FORM_ORDER_ITEM)
if (!orderTable || !itemTable) {
  return fail('FORM_MISSING', 'อ่านโครงฟอร์ม CPOE ไม่ได้ (sdform_manage)')
}

const waiting = await app.db.collection(orderTable).find(
  { 'vid.value': { $in: bothIds(visitId) }, current_status: SENT, xrstatx: 1 },
  { projection: { order_number: 1, order_to_location: 1 } }
).toArray()

if (!waiting.length) {
  return {
    success: true,
    message: 'ไม่มีใบสั่งยาที่รอรับ',
    visit_id: visitId,
    accepted: 0,
    item_updated: 0,
    skipped_non_med: 0,
    orders: []
  }
}

/* Classify from active child Items, not from the Visit or destination Unit. The old
   destination-based assumption was the exact cause of cross-service acceptance. */
const waitingIdPool = waiting.reduce((ids, order) => ids.concat(bothIds(order._id)), [])
const activeItems = await app.db.collection(itemTable).find(
  {
    $or: [
      { 'order_id.value': { $in: waitingIdPool } },
      { xparentx: { $in: waitingIdPool } }
    ],
    xrstatx: 1
  },
  { projection: { order_id: 1, xparentx: 1, service_type: 1 } }
).toArray()

const itemsByOrder = {}
activeItems.forEach(item => {
  const orderId = text(item && item.order_id && item.order_id.value) || text(item && item.xparentx)
  if (!orderId) return
  if (!itemsByOrder[orderId]) itemsByOrder[orderId] = []
  itemsByOrder[orderId].push(item)
})

const medicationOrders = waiting.filter(order => {
  const rows = itemsByOrder[text(order._id)] || []
  return rows.length > 0 && rows.every(item =>
    text(item && item.service_type && item.service_type.value).trim().toLowerCase() === MED_SERVICE
  )
})
const skippedNonMed = waiting.length - medicationOrders.length

if (!medicationOrders.length) {
  return {
    success: true,
    message: 'ไม่มีใบสั่งยาที่รอรับ',
    visit_id: visitId,
    accepted: 0,
    item_updated: 0,
    skipped_non_med: skippedNonMed,
    orders: []
  }
}

const now = app.curDate()
const accountId = userInfo && userInfo.account && userInfo.account.id
const accountName = (userInfo && userInfo.account && userInfo.account.name) ||
  (userInfo && userInfo.username) || ''
const stamp = { id: text(accountId), name: (userInfo && userInfo.username) || accountName }
const memberRef = accountId ? { value: oid(accountId), label: accountName } : null

const acceptedOrders = []
let itemUpdated = 0
for (const order of medicationOrders) {
  const stage = {
    stage_status: ACCEPTED,
    stage_at: now,
    stage_by: memberRef,
    stage_location: order.order_to_location || null,
    stage_reason: ''
  }
  const done = await app.db.collection(orderTable).findOneAndUpdate(
    { _id: order._id, current_status: SENT, xrstatx: 1 },
    {
      $set: { current_status: ACCEPTED, updated_at: now, updated_by: stamp },
      $push: { status_stage: stage }
    },
    { returnDocument: 'after' }
  )
  if (!done) continue

  acceptedOrders.push({
    order_id: text(order._id),
    order_number: done.order_number || order.order_number || '',
    stage: stage
  })
  const ids = bothIds(order._id)
  const result = await app.db.collection(itemTable).updateMany(
    {
      $or: [
        { 'order_id.value': { $in: ids } },
        { xparentx: { $in: ids } }
      ],
      'service_type.value': MED_SERVICE,
      current_status: SENT,
      xrstatx: 1
    },
    {
      $set: { current_status: ACCEPTED, updated_at: now, updated_by: stamp },
      $push: { status_stage: stage }
    }
  )
  itemUpdated += Number(result && result.modifiedCount) || 0
}

if (acceptedOrders.length) {
  void app.optCacheInvalidate(orderTable)
  void app.optCacheInvalidate(itemTable)
  app.log.info(
    '[pis-order-accept] รับใบยา ' + acceptedOrders.map(order => order.order_number).join(', ') +
    ' (visit ' + visitId + ') โดย ' + ((userInfo && userInfo.username) || '') +
    ' · ' + itemUpdated + ' รายการ · ข้าม non-med ' + skippedNonMed + ' ใบ'
  )
}

return {
  success: true,
  message: acceptedOrders.length
    ? 'รับใบสั่งยา ' + acceptedOrders.length + ' ใบแล้ว'
    : 'ไม่มีใบสั่งยาที่รอรับ',
  visit_id: visitId,
  accepted: acceptedOrders.length,
  item_updated: itemUpdated,
  skipped_non_med: skippedNonMed,
  orders: acceptedOrders.map(order => ({
    order_id: order.order_id,
    order_number: order.order_number
  }))
}
