// initCraft API Factory process: RIS Result Reset (POST JSON)
// Inserts an audit row into xray_resultreset, then resets an existing xray_result.
const RESULT_RESET_FORM_ID = '6a95b663422c1ca959829e87';
const RESULT_RESET_TABLE = 'zdata_xray_resultreset';
const RESULT_FORM_ID = '6a860980f851000f28e44ab0';
const RESULT_TABLE = 'zdata_xray_result';

// POST application/json: direct fields or a params/body/data/payload wrapper.
// API Factory exposes the resolved JSON body as params.
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
const flattenedQuery = {};
for (const [name, value] of Object.entries(rootInput)) {
  const match = name.match(/^(?:params|body|data|payload)(?:\[([^\]]+)\]|\.([^.[\]]+))$/);
  if (match) flattenedQuery[match[1] || match[2]] = value;
}

if (Object.keys(flattenedQuery).length) {
  input = flattenedQuery;
} else {
  for (let depth = 0; depth < 3; depth += 1) {
    const wrapped = ['params', 'body', 'data', 'payload', 'New item']
      .map((name) => asObject(input[name]))
      .find((value) => value);
    if (!wrapped) break;
    input = wrapped;
  }
}

const reply = (code, text) => ({
  message: text,
  MessageControlId: input.MessageControlId || null,
  AccessionNo: input.AccessionNo || null,
  Status: 'C',
  AcknowledgementCode: code,
  TextMessage: text,
});

const required = ['Hn', 'AccessionNo', 'ExamUid', 'ExamName', 'RadiologistUid'];
const missing = required.filter(
  (name) => input[name] === undefined || input[name] === null || String(input[name]).trim() === '',
);
if (missing.length) return reply('AE', `Missing required field(s): ${missing.join(', ')}`);

const accessionNo = String(input.AccessionNo).trim();
if (accessionNo.length > 16) {
  return reply('AE', 'AccessionNo must not exceed 16 characters');
}

if (input.Status !== undefined && String(input.Status).trim().toUpperCase() !== 'C') {
  return reply('AE', 'Status must be C');
}

const allowedFields = [
  'MessageControlId', 'Hn', 'RequestNo', 'QNo', 'AccessionNo',
  'Status', 'ExamUid', 'ExamName', 'RadiologistUid',
  'SentDateTime', 'ReceivedDateTime',
];
const data = {};
for (const name of allowedFields) {
  if (input[name] !== undefined && input[name] !== null) {
    data[name] = typeof input[name] === 'string' ? input[name].trim() : input[name];
  }
}
data.AccessionNo = accessionNo;
data.Status = 'C';
data.xrstatx = 1;

// Store every valid reset request first as an audit record.
const inserted = await app.dbInsert(data, RESULT_RESET_TABLE, userInfo);
if (!inserted.success) {
  return reply('AE', inserted.reply?.message || inserted.message || 'Unable to insert result reset');
}

// ResultReset never creates a result. It updates only an existing accession.
const current = await app.sdformGetOne({
  providerId: RESULT_FORM_ID,
  providerType: 'FORM',
  options: { where: '`AccessionNo` = :accessionNo' },
  params: { accessionNo },
}, userInfo);

if (!current.data?._id) return reply('AE', 'no accession_no');

const updateData = {};
for (const name of allowedFields) {
  if (data[name] !== undefined) updateData[name] = data[name];
}
updateData.Status = 'C';

const updated = await app.dbUpdate(
  updateData,
  RESULT_TABLE,
  userInfo,
  { _id: app.dbObjectId(current.data._id) },
);
if (!updated.success) {
  return reply('AE', updated.reply?.message || updated.message || 'Unable to update result');
}

try {
  app.wsSend('gridform', RESULT_FORM_ID, 'ris-result-reset-api', {
    from: 'ris-result-reset-api',
    broadcast: true,
    data: { ...current.data, ...updateData },
    method: 'update',
    keyid: '_id',
  });
} catch (_) {
  // The database update is already committed.
}

return reply('AA', 'Result reset inserted and result updated');
