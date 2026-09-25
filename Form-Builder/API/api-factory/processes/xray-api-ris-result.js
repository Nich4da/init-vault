// initCraft API Factory process: RIS Result (POST JSON, insert only)
const FORM_TABLE = 'zdata_xray_result';
const COUNTER_TABLE = 'xray_api_counters';
const COUNTER_ID = 'zdata_xray_result.ResultId';

// POST application/json: { ...fields } or { params: { ...fields } }.
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

input = { ...input };
if (typeof input.AccessionNo === 'string' || typeof input.AccessionNo === 'number') {
  input.AccessionNo = String(input.AccessionNo).trim();
}

const reply = (code, text, operation = null) => ({
  message: text,
  MessageControlId: input.MessageControlId || null,
  AccessionNo: input.AccessionNo || null,
  Operation: operation,
  AcknowledgementCode: code,
  TextMessage: text,
});

const accessionNo = input.AccessionNo;
if (typeof accessionNo !== 'string' || !accessionNo) {
  return reply('AE', 'AccessionNo is required');
}
if (accessionNo.length > 16) {
  return reply('AE', 'AccessionNo must not exceed 16 characters');
}

const allowedFields = [
  'MessageControlId', 'Hn', 'RequestNo', 'QNo', 'AccessionNo', 'Status',
  'ExamUid', 'ExamName', 'ImageCapturedDateTime', 'RadiologistUid',
  'ResultText', 'ResultDateTime', 'SeverityUid', 'SentDateTime',
  'ReceivedDateTime',
];

const data = {};
for (const name of allowedFields) {
  if (input[name] !== undefined) data[name] = input[name];
}
data.AccessionNo = accessionNo;
data.xrstatx = 1;

// Server-owned sequence, shared across all accessions. Never accept ResultId
// from the caller. Atomic $inc avoids MAX+1 races between concurrent requests.
// Keep this counter permanently; failed inserts may leave gaps in the sequence.
// Existing rows are not backfilled. See raw/LLM-ApiDocs.md: app.db.
try {
  const counterResult = await app.db.collection(COUNTER_TABLE).findOneAndUpdate(
    { _id: COUNTER_ID },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  // MongoDB driver versions may return the document or a metadata wrapper.
  const counter = counterResult?.value ?? counterResult;
  if (!Number.isSafeInteger(counter?.seq) || counter.seq < 1) {
    return reply('AE', 'Unable to allocate ResultId');
  }
  data.ResultId = counter.seq;
} catch (_) {
  return reply('AE', 'Unable to allocate ResultId');
}

// Every valid request inserts a new result, including repeated AccessionNo
// or MessageControlId. Never update a row in xray_result from this process.
const operation = 'insert';
const saved = await app.dbInsert(data, FORM_TABLE, userInfo);
if (!saved.success) {
  return reply('AE', saved.reply?.message || saved.message || `Unable to ${operation} result`, operation);
}

// TODO: Update the OTHER table here, only after the result insert succeeds.
// Pending: target table/form name and destination field mapping.
// Match that target by AccessionNo = accessionNo; data.ResultId identifies
// this inserted result. Do not use FORM_TABLE as the update destination.
// No target lookup/update runs until those details are supplied.

return {
  ...reply('AA', 'Result inserted', operation),
  ResultId: data.ResultId,
};
