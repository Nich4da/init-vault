// initCraft API Factory process: RIS Schedule (GET query upsert)
// Replace FORM_ID after importing sd_form/xray-schedule.json.
const FORM_ID = '6a86090df851000f28e44aaf';
const FORM_TABLE = 'zdata_xray_schedule';

const asObject = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (_) { return null; }
};

const rootInput = asObject(params) || {};
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
      .map((name) => asObject(input[name])).find((value) => value);
    if (!wrapped) break;
    input = wrapped;
  }
}

const reply = (code, text, operation = null) => ({
  message: text,
  MessageControlId: input.MessageControlId || null,
  AccessionNo: input.AccessionNo || null,
  Operation: operation,
  AcknowledgementCode: code,
  TextMessage: text,
});

const required = [
  'AccessionNo', 'Hn', 'PatientFName', 'PatientGender', 'PatientDob', 'PatientSsn',
  'PatientClassUid', 'VisitNo', 'AdmissionNo', 'StartDateTime', 'EndDateTime',
  'ModalityUid', 'ExamUid', 'ExamName',
];
const missing = required.filter(
  (name) => input[name] === undefined || input[name] === null || input[name] === '',
);
if (missing.length) return reply('AE', `Missing required field(s): ${missing.join(', ')}`);

const accessionNo = String(input.AccessionNo).trim();
if (!accessionNo) return reply('AE', 'no accession_no');
if (accessionNo.length > 16) return reply('AE', 'AccessionNo must not exceed 16 characters');
const patientGender = String(input.PatientGender).trim().toUpperCase();
if (!['M', 'F', 'U'].includes(patientGender)) return reply('AE', 'PatientGender must be M, F, or U');
const patientClassUid = String(input.PatientClassUid).trim().toUpperCase();
if (!['O', 'I', 'E'].includes(patientClassUid)) return reply('AE', 'PatientClassUid must be O, I, or E');
if (!/^\d{13}$/.test(String(input.PatientSsn))) return reply('AE', 'PatientSsn must contain 13 digits');

const numericFields = ['ExamRate', 'Qty', 'ScheduleDtlRate'];
for (const name of numericFields) {
  if (input[name] === undefined || input[name] === null || input[name] === '') continue;
  const value = Number(input[name]);
  if (!Number.isFinite(value) || value < 0) return reply('AE', `${name} must be a non-negative number`);
  if (name === 'Qty' && !Number.isInteger(value)) return reply('AE', 'Qty must be an integer');
}

const current = await app.sdformGetOne({
  providerId: FORM_ID,
  providerType: 'FORM',
  options: { where: '`AccessionNo` = :accessionNo' },
  params: { accessionNo },
}, userInfo);
const currentRecord = current.success && current.data && current.data._id ? current.data : null;

const allowedFields = [
  'MessageControlId', 'Hn', 'PatientTitle', 'PatientFName', 'PatientMName', 'PatientLName',
  'PatientTitleEng', 'PatientFNameEng', 'PatientMNameEng', 'PatientLNameEng', 'PatientGender',
  'PatientDob', 'PatientSsn', 'PatientPhone1', 'PatientPhone2', 'PatientEmail', 'PatientAddr1',
  'PatientAddr2', 'PatientAddr3', 'PatientAddr4', 'PatientAddr5', 'PatientLmp', 'PatientClassUid',
  'VisitNo', 'AdmissionNo', 'PatientStatusUid', 'PatientStatusText', 'InsuranceTypeUid',
  'InsuranceTypeDesc', 'ReferenceUnitUid', 'ReferenceUnitName', 'ReferringDoctorUid',
  'ReferringDoctorTitle', 'ReferringDoctorFName', 'ReferringDoctorMName', 'ReferringDoctorLName',
  'ReferringDoctorTitleEng', 'ReferringDoctorFNameEng', 'ReferringDoctorMNameEng',
  'ReferringDoctorLNameEng', 'ClinicalInstruction', 'ScheduleUid', 'ScheduleDate', 'StartDateTime',
  'EndDateTime', 'ModalityUid', 'ModalityName', 'ModalityTypeUid', 'ModalityTypeName', 'ExamUid',
  'ExamName', 'ExamRate', 'ExamTypeUid', 'ExamTypeText', 'Qty', 'ScheduleDtlRate', 'RadiologistUid',
  'RadiologistTitle', 'RadiologistFName', 'RadiologistMName', 'RadiologistLName',
  'RadiologistTitleEng', 'RadiologistFNameEng', 'RadiologistMNameEng', 'RadiologistLNameEng',
  'IsDeleted', 'OrganizationUid', 'OrganizationName', 'OrganizationAlias', 'AccessionNo',
];

const data = {};
for (const name of allowedFields) if (input[name] !== undefined) data[name] = input[name];
data.AccessionNo = accessionNo;
data.PatientGender = patientGender;
data.PatientClassUid = patientClassUid;
data.IsDeleted = input.IsDeleted === true || input.IsDeleted === 1
  || String(input.IsDeleted || '').trim().toLowerCase() === 'true';
for (const name of numericFields) {
  if (data[name] !== undefined && data[name] !== null && data[name] !== '') data[name] = Number(data[name]);
}

data.xrstatx = 1;
const saved = currentRecord
  ? await app.dbUpdate(data, FORM_TABLE, userInfo, { _id: app.dbObjectId(currentRecord._id) })
  : await app.dbInsert(data, FORM_TABLE, userInfo);
if (!saved.success) {
  return reply('AE', saved.reply?.message || saved.message
    || (currentRecord ? 'Unable to update schedule' : 'Unable to insert schedule'));
}

try {
  app.wsSend('gridform', FORM_ID, 'ris-schedule-api', {
    from: 'ris-schedule-api', broadcast: true,
    data: saved.reply?.data || (currentRecord ? { ...currentRecord, ...data } : data),
    method: currentRecord ? 'update' : 'insert', keyid: '_id',
  });
} catch (_) {
  // The write already succeeded; an open screen can refresh later.
}

return reply('AA', currentRecord ? 'Schedule updated' : 'Schedule created',
  currentRecord ? 'update' : 'insert');
