/*
 * API Factory process: on-center-lab-order-insert
 *
 * Bind this adapter to the Insert event of Center Lab Order.  The Center
 * record has already been saved when this event runs.  Pass the complete
 * event record to the canonical specimen-collection-status process so it can
 * create exactly one Lab Status row per destination section.
 *
 * Keep this adapter intentionally small.  It must not call sdformSetOne for
 * Lab Status directly and must not return xformDatax to the Center form.
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

const centerOrderId = text(params && (
  params.center_order_id || params._id || params.dataid || params.id
));
if (!centerOrderId) {
  return { success: false, message: 'Center Lab Insert event ไม่มี record id' };
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

// Form Event normally receives the complete saved document.  Reloading and
// merging the durable row makes the adapter equally reliable when this
// installation sends only the configured Property fields.
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
// The materializer is idempotent by Center id + Lab section.  A retry using
// only durable data safely covers a partial/malformed Form Event payload.
if (body.success !== true && durable) body = await materialize(durable);

return {
  success: body.success === true,
  message: body.message || 'สร้าง Lab Status จาก Center Lab ไม่สำเร็จ',
  center_order_id: centerOrderId,
  created: body.created || [],
  updated: body.updated || [],
  failed: body.failed || []
};
