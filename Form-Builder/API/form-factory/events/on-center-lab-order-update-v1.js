/*
 * API Factory process: on-center-lab-order-update
 *
 * Bind this adapter to the Update event of Center Lab Order.  It uses the
 * same idempotent materializer as Insert, so each Center record owns at most
 * one Lab Status row per destination section.  Existing rows are refreshed
 * and their add/remove audit is appended by the canonical subprocess.
 */

const STATUS_PROCESS_ID = '6a7e787e8d398c11cf2fe8b8';
const CENTER_COLLECTION = 'zdata_lab_center_order';

const text = value => {
  if (value == null) return '';
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return String(value.toHexString()).trim();
    if (value.$oid != null) return String(value.$oid).trim();
    if (value._id != null) return text(value._id);
    if (value.id != null) return text(value.id);
    if (value.value != null && typeof value.value !== 'object') return String(value.value).trim();
  }
  const raw = String(value).trim();
  const match = raw.match(/[a-fA-F0-9]{24}/);
  return match ? match[0] : raw;
};

const centerOrderId = text(params && (params._id || params.dataid || params.id));
if (!centerOrderId) {
  return { success: false, message: 'Center Lab Update event ไม่มี record id' };
}

const unwrap = value => {
  let body = value || {};
  for (let attempt = 0; attempt < 4; attempt++) {
    if (body && body.reply && body.reply.data && typeof body.reply.data === 'object') {
      body = body.reply.data;
      continue;
    }
    if (body && body.data && typeof body.data === 'object') {
      body = body.data;
      continue;
    }
    break;
  }
  return body || {};
};

let durable = null;
try {
  const found = await app.dbFindById(app.dbObjectId(centerOrderId), CENTER_COLLECTION);
  durable = found && found.reply && found.reply.data;
} catch (error) {
  durable = null;
}
const centerRecord = {
  ...(durable || {}),
  ...((params && typeof params === 'object') ? params : {}),
  _id: (durable && durable._id) || (params && params._id) || centerOrderId
};

const materialize = async record => unwrap(await app.subProcess(STATUS_PROCESS_ID, {
  action: 'materialize_center_order',
  center_order_id: centerOrderId,
  center_record: record
}, userInfo));

let body = await materialize(centerRecord);
if (body.success !== true && durable) body = await materialize(durable);

return {
  success: body.success === true,
  message: body.message || 'อัปเดต Lab Status จาก Center Lab ไม่สำเร็จ',
  center_order_id: centerOrderId,
  created: body.created || [],
  updated: body.updated || [],
  failed: body.failed || []
};
