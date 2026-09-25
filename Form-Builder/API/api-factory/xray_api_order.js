// initCraft API Factory process: RIS Order
const FORM_ID = '6a8f1ea97632d182ef6914fd';
const FORM_TABLE = 'zdata_xray_order';
// Change the forwarding destination here.
const ORDER_FORWARD_URL = 'http://172.19.233.161/EnvisionRIE3rdParty/ThirdParty/GetOrder';
const ORDER_FORWARD_TIMEOUT_MS = 15000;

// POST application/json: { ...fields } or { params: { ...fields } }.
// API Factory exposes the resolved JSON body as params.
// Existing wrapped/query inputs remain compatible.
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

// Some query-string parsers keep bracket/dot notation as literal keys instead
// of creating a nested `params` object. Normalize those keys before unwrapping.
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

// Use the existing SDForm field name exactly: AccessionNo.
const forwardInput = { ...input };
input = { ...input };
if (typeof input.AccessionNo === 'string' || typeof input.AccessionNo === 'number') {
  input.AccessionNo = String(input.AccessionNo).trim();
}
const reply = (code, text, operation = null) => ({
  message: text,
  MessageControlId: input.MessageControlId || null,
  AccessionNo: input.AccessionNo || null,
  Status: input.Status ?? null,
  Operation: operation,
  AcknowledgementCode: code,
  TextMessage: text,
});

// Only the upsert key is required. Other schema fields pass through as supplied.
if (typeof input.AccessionNo !== 'string' || !input.AccessionNo) {
  return reply('AE', 'AccessionNo is required');
}
// AccessionNo is the only business key used to select the operation.
// Found => update. Not found => insert. MessageControlId never changes this.
const current = await app.sdformGetOne({
  providerId: FORM_ID,
  providerType: 'FORM',
  options: { where: '`AccessionNo` = :accessionNo' },
  params: { accessionNo: String(input.AccessionNo).trim() },
}, userInfo);
// sdformGetOne reports success=false when no row matches. That is the normal
// insert path, not an API error. Treat a result as existing only when it has _id.
const currentRecord = current.success && current.data && current.data._id
  ? current.data
  : null;

const allowedFields = [
  'MessageControlId', 'Hn', 'PatientTitle', 'PatientFName', 'PatientMName', 'PatientLName',
  'PatientTitleEng', 'PatientFNameEng', 'PatientMNameEng', 'PatientLNameEng', 'PatientGender',
  'PatientDob', 'PatientSsn', 'PatientPhone1', 'PatientPhone2', 'PatientEmail', 'PatientAddr1',
  'PatientAddr2', 'PatientAddr3', 'PatientAddr4', 'PatientAddr5', 'PatientLmp', 'PatientClassUid',
  'VisitNo', 'AdmissionNo', 'PatientStatusUid', 'PatientStatusText', 'InsuranceTypeUid',
  'InsuranceTypeDesc', 'ReferenceUnitUid', 'ReferenceUnitName', 'ReferringDoctorUid',
  'ReferringDoctorTitle', 'ReferringDoctorFName', 'ReferringDoctorMName', 'ReferringDoctorLName',
  'ReferringDoctorTitleEng', 'ReferringDoctorFNameEng', 'ReferringDoctorMNameEng',
  'ReferringDoctorLNameEng', 'ClinicalInstruction', 'ScheduleUid', 'RequestNo', 'QNo',
  'AccessionNo', 'Priority', 'Status', 'ModalityUid', 'ModalityName', 'ModalityTypeUid',
  'ModalityTypeName', 'ExamUid', 'ExamName', 'ExamRate', 'ExamTypeUid', 'ExamTypeText', 'Qty',
  'OrderDtlRate', 'RadiologistUid', 'RadiologistTitle', 'RadiologistFName', 'RadiologistMName',
  'RadiologistLName', 'RadiologistTitleEng', 'RadiologistFNameEng', 'RadiologistMNameEng',
  'RadiologistLNameEng', 'IsDeleted', 'OrganizationUid', 'OrganizationName', 'OrganizationAlias',
];

const data = {};
for (const name of allowedFields) {
  if (input[name] !== undefined) data[name] = input[name];
}
data.AccessionNo = input.AccessionNo;

// Use database decorators because sdformSetOne on this imported form returns
// the generic "Cannot Update data.". These helpers retain audit/cache hooks.
data.xrstatx = 1;
const saved = currentRecord
  ? await app.dbUpdate(
    data,
    FORM_TABLE,
    userInfo,
    { _id: app.dbObjectId(currentRecord._id) },
  )
  : await app.dbInsert(data, FORM_TABLE, userInfo);
if (!saved.success) {
  return reply(
    'AE',
    saved.reply?.message || saved.message || (currentRecord ? 'Unable to update order' : 'Unable to insert order'),
  );
}

// Notify open xray-order screens only after the database write succeeds.
// WebSocket delivery is best-effort: an offline screen or WS failure must not
// turn an already committed RIS order into an AE response (which could cause
// the RIS to retry the same message unnecessarily).
try {
  await app.wsSend('gridform', FORM_ID, 'ris-order-api', {
    from: 'ris-order-api',
    broadcast: true,
    data: saved.reply?.data || (currentRecord ? { ...currentRecord, ...data } : data),
    method: currentRecord ? 'update' : 'insert',
    keyid: '_id',
  });
} catch (_) {
  // The order is already stored; the screen can load it on its next refresh.
}

// Forward the original order fields without the API Factory wrapper or DB defaults.
// The local write is committed; a forwarding failure does not undo it.
const operation = currentRecord ? 'update' : 'insert';
try {
  const forwarded = await app.axios.post(ORDER_FORWARD_URL, forwardInput, {
    headers: { 'Content-Type': 'application/json' },
    timeout: ORDER_FORWARD_TIMEOUT_MS,
    maxRedirects: 0,
    validateStatus: (httpStatus) => httpStatus >= 200 && httpStatus < 300,
  });
  return {
    ...reply('AA', `Order ${currentRecord ? 'updated' : 'created'}; forwarding HTTP request succeeded`, operation),
    LocalSaved: true,
    ForwardHttpStatus: forwarded.status,
    ForwardResponse: forwarded.data,
  };
} catch (error) {
  return {
    ...reply('AE', 'Order saved locally, but forwarding failed', operation),
    LocalSaved: true,
    ForwardHttpStatus: error.response?.status ?? null,
    ForwardError: error.code || 'FORWARD_FAILED',
  };
}
