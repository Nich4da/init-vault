/*
 * API Factory: Lab Bio - Receive Order
 *
 * วางเฉพาะเนื้อหานี้ใน editor ของ Process(params, userInfo)
 * Form source: Lab_Bio_Order #6a771f20cc7d0a8451130339
 */

const ORDER_FORM_ID = '6a771f20cc7d0a8451130339'
const ORDER_COLLECTION = 'zdata_testlab_bio'

const orderId = String(params.source_order_id || '').trim()
const labNo = String(params.lab_no || '').trim()
const receiveNote = String(params.receive_note || '').trim()
const action = String(params.action || 'receive').trim().toLowerCase()

if (!orderId) {
  return { success: false, message: 'ต้องระบุ source_order_id' }
}

// เริ่มต้นอนุญาตผู้ใช้ที่ล็อกอินก่อน; เมื่อมี role ห้อง Lab ให้เปลี่ยนเป็น
// if (!app.isRole('lab_bio_staff', userInfo.roles || [])) { ... }
if (!app.isAuth(userInfo.roles || [])) {
  return { success: false, message: 'ไม่มีสิทธิ์รับเข้าสิ่งส่งตรวจ' }
}

let order
try {
  const found = await app.dbFindById(app.dbObjectId(orderId), ORDER_COLLECTION)
  order = found && found.reply && found.reply.data
} catch (error) {
  return { success: false, message: 'ไม่สามารถอ่านใบสั่งตรวจได้' }
}

if (!order || Number(order.xrstatx) === 3) {
  return { success: false, message: 'ไม่พบใบสั่งตรวจ' }
}

if (String(order.lab_section || '') !== 'BC') {
  return { success: false, message: 'ใบสั่งนี้ไม่ใช่ Biochemistry' }
}

if (order.order_status === 'rejected') {
  return { success: false, message: 'ใบสั่งนี้ถูกปฏิเสธแล้ว' }
}

if (order.order_status === 'resulted') {
  return { success: false, message: 'ใบสั่งนี้ออกผลแล้ว' }
}

if (action === 'start_process') {
  if (order.order_status !== 'received') {
    return { success: false, message: 'เริ่มดำเนินการได้เฉพาะรายการที่รับเข้าแล้ว' }
  }

  const now = app.curDate('YYYY-MM-DD HH:mm:ss')
  const operator = String(userInfo.username || userInfo.account && userInfo.account.name || '')
  try {
    await app.dbUpdate(
      {
        order_status: 'resulted',
        result_started_at: now,
        result_started_by: operator
      },
      ORDER_COLLECTION,
      userInfo,
      { _id: app.dbObjectId(orderId) }
    )
  } catch (error) {
    return { success: false, message: 'ย้ายรายการไปหน้าออกผลแล้วไม่สำเร็จ' }
  }

  return {
    success: true,
    data: { order_id: orderId, order_status: 'resulted', result_started_at: now, result_started_by: operator },
    message: 'ย้ายรายการไปหน้าออกผลแล้ว'
  }
}

if (order.order_status === 'received') {
  return {
    success: true,
    data: {
      order_id: String(order._id),
      order_status: 'received',
      already_received: true
    },
    message: 'ใบสั่งนี้รับเข้าแล้ว'
  }
}

const now = app.curDate('YYYY-MM-DD HH:mm:ss')
const receiver = String(userInfo.username || userInfo.account && userInfo.account.name || '')
const updateData = {
  order_status: 'received',
  received_at: now,
  received_by: receiver
}

if (labNo) updateData.lab_no = labNo
if (receiveNote) updateData.receive_note = receiveNote

try {
  await app.dbUpdate(
    updateData,
    ORDER_COLLECTION,
    userInfo,
    { _id: app.dbObjectId(orderId) }
  )
} catch (error) {
  return {
    success: false,
    message: 'บันทึกรับเข้าสิ่งส่งตรวจไม่สำเร็จ: ' + String(error && error.message || error)
  }
}

return {
  success: true,
  data: {
    order_id: orderId,
    order_status: 'received',
    received_at: now,
    received_by: receiver,
    lab_no: labNo || String(order.lab_no || '')
  },
  message: 'รับเข้าสิ่งส่งตรวจเรียบร้อย'
}
