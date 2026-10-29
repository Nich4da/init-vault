/*
 * initCraft API Factory Process
 * Name: X-ray - Seed Reject Reason Settings v1
 *
 * One-time, idempotent seed for the X-ray Reject Reason Settings Form.
 * - preview is read-only and is the default action.
 * - execute inserts only missing reason_code rows; it never overwrites or
 *   re-enables a row that an administrator already changed.
 */

const COLLECTION = 'zdata_xray_reject_reason_settings'
const CONFIRM_TOKEN = 'SEED_XRAY_REJECT_REASONS_V1'
const text = value => value == null ? '' : String(value).trim()
const action = text(params && params.action || 'preview').toLowerCase()
const activeQuery = { xrstatx: { $nin: [0, 3] } }
const defaults = [
  { reason_code: 'PATIENT_ABSENT', reason_text: 'ผู้ป่วยไม่มาตามนัด', reason_type: 'BOTH' },
  { reason_code: 'PHYSICIAN_CANCELLED', reason_text: 'แพทย์ยกเลิกคำสั่ง', reason_type: 'BOTH' },
  { reason_code: 'WRONG_PATIENT', reason_text: 'สั่งผิดคน', reason_type: 'BOTH' },
  { reason_code: 'OTHER', reason_text: 'อื่น ๆ', reason_type: 'BOTH' },
]

if (!app.isAuth(userInfo.roles || [])) {
  return { success: false, message: 'ไม่มีสิทธิ์จัดการ Master เหตุผลปฏิเสธ X-ray' }
}

let existing = []
try {
  const found = await app.dbFindAll({
    from: COLLECTION,
    nosql: {
      type: 'query',
      collection: COLLECTION,
      query: activeQuery,
      projection: { reason_code: 1, reason_text: 1, reason_type: 1, is_active: 1 },
      limit: 1000,
    },
  }, false, false)
  if (!found || found.success === false || !found.reply || !Array.isArray(found.reply.data)) {
    return { success: false, message: 'อ่าน X-ray Reject Reason Settings ไม่สำเร็จ' }
  }
  existing = found.reply.data
} catch (error) {
  return { success: false, message: 'อ่าน X-ray Reject Reason Settings ไม่สำเร็จ' }
}

const existingCodes = new Set(existing.map(row => text(row && row.reason_code).toUpperCase()).filter(Boolean))
const missing = defaults.filter(row => !existingCodes.has(row.reason_code))
const summary = {
  existing_count: existing.length,
  default_count: defaults.length,
  missing_count: missing.length,
  missing_codes: missing.map(row => row.reason_code),
}

if (action === 'preview') {
  return { success: true, action: 'preview', data: summary, message: missing.length ? 'พบเหตุผลตั้งต้นที่ยังไม่มี ' + missing.length + ' รายการ' : 'เหตุผลตั้งต้นครบแล้ว' }
}
if (action !== 'execute') {
  return { success: false, message: 'รองรับเฉพาะ action preview หรือ execute' }
}
if (text(params && params.confirm_token) !== CONFIRM_TOKEN) {
  return { success: false, message: 'confirm_token ไม่ถูกต้อง' }
}

const now = typeof app.curDate === 'function' ? app.curDate('YYYY-MM-DD HH:mm:ss') : new Date().toISOString()
const actor = text(userInfo.username || userInfo.account && (userInfo.account.username || userInfo.account.name))
const inserted = []
const failures = []
for (let index = 0; index < missing.length; index += 1) {
  const row = missing[index]
  try {
    const saved = await app.dbInsert({
      ...row,
      is_active: true,
      internal_note: 'เหตุผลตั้งต้นจาก X-ray Worklist v1',
      created_at: now,
      created_by: actor,
      updated_at: now,
      updated_by: actor,
    }, COLLECTION, userInfo)
    if (!saved || saved.success === false) failures.push({ reason_code: row.reason_code, message: text(saved && saved.message) || 'บันทึกไม่สำเร็จ' })
    else inserted.push(row.reason_code)
  } catch (error) {
    failures.push({ reason_code: row.reason_code, message: text(error && error.message || error) })
  }
}

return {
  success: failures.length === 0,
  action: 'execute',
  data: { ...summary, inserted_count: inserted.length, inserted_codes: inserted, failures },
  message: failures.length ? 'เพิ่มเหตุผลตั้งต้นได้บางส่วน กรุณาตรวจสอบ failures' : 'เพิ่มเหตุผลตั้งต้น X-ray แล้ว ' + inserted.length + ' รายการ',
}
