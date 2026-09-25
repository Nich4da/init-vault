// initCraft API Factory process: X-ray Order Status Change
// External POST body: { "params": { ...OrderStatusChanged fields } }.

const STATUS_CHANGE_TABLE = 'zdata_xray_order_status_change';
const ORDER_FORM_ID = '6a8f1ea97632d182ef6914fd';
const ORDER_TABLE = 'zdata_xray_order';

const asObject = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
};

const rootInput = asObject(typeof params === 'undefined' ? null : params) || {};
let input = rootInput;
for (let depth = 0; depth < 3; depth += 1) {
  const wrapped = ['params', 'body', 'data', 'payload']
    .map((name) => asObject(input[name]))
    .find(Boolean);
  if (!wrapped) break;
  input = wrapped;
}

const statusFields = [
  'MessageControlId', 'Hn', 'RequestNo', 'QNo', 'AccessionNo',
  'Status', 'ExamUid', 'ExamName', 'ImageCapturedDateTime',
];

const messageControlId = input.MessageControlId || null;
const accessionNo = input.AccessionNo === undefined || input.AccessionNo === null
  ? '' : String(input.AccessionNo).trim();
const status = input.Status === undefined || input.Status === null
  ? '' : String(input.Status).trim().toUpperCase();
const reply = (code, text, extra = {}) => ({
  MessageControlId: messageControlId,
  AcknowledgementCode: code,
  TextMessage: text,
  ...extra,
});

const required = ['Hn', 'AccessionNo', 'Status', 'ExamUid', 'ExamName'];
const missing = required.filter((name) => (
  input[name] === undefined || input[name] === null || String(input[name]).trim() === ''
));
if (missing.length) return reply('AE', `Missing required field(s): ${missing.join(', ')}`);
if (accessionNo.length > 16) return reply('AE', 'AccessionNo must not exceed 16 characters');
if (!['A', 'C'].includes(status)) return reply('AE', 'Status must be A (Arrival) or C (Completed)');

// Record every valid notification before looking up its order.
const statusChangeData = {};
for (const name of statusFields) {
  if (input[name] !== undefined) statusChangeData[name] = input[name];
}
statusChangeData.AccessionNo = accessionNo;
statusChangeData.Status = status;
statusChangeData.xrstatx = 1;

const historySaved = await app.dbInsert(statusChangeData, STATUS_CHANGE_TABLE, userInfo);
if (!historySaved?.success) return reply('AE', 'ไม่สามารถบันทึกประวัติการเปลี่ยนสถานะได้');

const current = await app.sdformGetOne({
  providerId: ORDER_FORM_ID,
  providerType: 'FORM',
  options: { where: '`AccessionNo` = :accessionNo' },
  params: { accessionNo },
}, userInfo);

if (!current?.success || !current.data?._id) {
  return reply('AE', `ไม่พบรายการสั่งตรวจที่มี AccessionNo: ${accessionNo}`, {
    AccessionNo: accessionNo,
    StatusChangeSaved: true,
  });
}

// Update only fields defined by the OrderStatusChanged contract.
const orderData = {};
for (const name of statusFields) {
  if (name !== 'AccessionNo' && input[name] !== undefined) orderData[name] = input[name];
}
orderData.Status = status;
orderData.xrstatx = 1;

const orderSaved = await app.dbUpdate(
  orderData,
  ORDER_TABLE,
  userInfo,
  { _id: app.dbObjectId(current.data._id) },
);
if (!orderSaved?.success) {
  return reply('AE', 'บันทึกประวัติสถานะแล้ว แต่ไม่สามารถอัปเดตรายการสั่งตรวจได้', {
    AccessionNo: accessionNo,
    StatusChangeSaved: true,
  });
}

try {
  await app.wsSend('gridform', ORDER_FORM_ID, 'ris-order-status-api', {
    from: 'ris-order-status-api',
    broadcast: true,
    data: { ...current.data, ...orderData },
    method: 'update',
    keyid: '_id',
  });
} catch (_) {
  // Database updates are already complete.
}

return reply('AA', 'อัปเดตสถานะรายการสั่งตรวจเรียบร้อยแล้ว', {
  AccessionNo: accessionNo,
  Status: status,
  StatusChangeSaved: true,
});
