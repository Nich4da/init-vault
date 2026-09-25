/**
 * emr-summary-get — ข้อมูลการ์ด "สรุปการรักษา" ในหน้า EMR
 * ------------------------------------------------------------------
 * อ่าน **การรักษาครั้งก่อนหน้า** (ไม่รวม visit ที่กำลังตรวจอยู่) จาก snapshot ฟอร์ม Visit History
 * แล้วเติมผล Lab / X-ray ล่าสุดของคนไข้ (ทั้ง 2 อย่างไม่ผูก visit — ผูกด้วย HN)
 *
 * params: { person_id, hn?, visit_id? }   visit_id = visit ปัจจุบัน (ตัดออกจากผลลัพธ์)
 * return: { success, visit:{...}, cc, dx[], meds[], plan, lab[], xray[], other[], built }
 *
 * 🔴 snapshot เป็นของที่ visit-history-build สร้าง — visit เก่าที่ยังไม่เคยถูกแตะจะไม่มี
 *    ⇒ ถ้าไม่เจอ จะสั่ง build ให้ 1 ครั้งแบบ lazy (fail-open — build ไม่ได้ก็คืนเท่าที่มี)
 */

const VH_TABLE = 'zdata_visit_history';
const VISIT_TABLE = 'zdata_visit';
const LAB_TABLE = 'zdata_lab_result_item';
const XRAY_TABLE = 'zdata_xray_result';
const BUILD_PROC = '6a95549ef4908ee7af234e56'; // visit-history-build
const BOARD_PROC = '6ab3be31cec3020e8562a2c9'; // emr-lab-board-get — ใบสั่งตรวจวิสิทนี้ + ผลที่ออกวันนี้

const DX_FORM = '6a47a9cc8ca8083d715e3486';
const ITEM_FORM = '6a6f7db2265885c2377cc222';
const PLAN_FORM = '6a47dcac8ca8083d715e3492';
const PE_FORM = '6a473a1dd54977f38061dddf'; // Physical Examination — ตรวจร่างกาย
const SCREENING_FORM = '6a473513d54977f38061dddd'; // cc + hpi ตัวจริงที่พยาบาลซักประวัติ

const MAX_LAB = 40; // ดึงเผื่อไว้ก่อน dedupe ตามชื่อรายการ
const MAX_XRAY = 10;

const idPair = (id) => ({ $in: [String(id), app.dbObjectId(String(id))] });

const findAll = async (collection, query, opt) => {
	const o = opt || {};
	const res = await app.dbFindAll(
		{ nosql: { type: 'query', collection, query, projection: o.projection || {}, sort: o.sort || { _id: -1 }, limit: o.limit || -1 } },
		false,
		!!o.limit,
	);
	return res && res.success ? res.reply.data || [] : [];
};

const labelOf = (v) => (v && typeof v === 'object' ? v.label || v.value : v) || '';
const codeOf = (v) => (v && typeof v === 'object' ? v.value : v) || '';

const personId = params.person_id ? String(params.person_id) : null;
const curVisitId = params.visit_id ? String(params.visit_id) : null;
let hn = params.hn ? String(params.hn) : null;

if (!personId && !hn) return { success: false, message: 'ต้องส่ง person_id หรือ hn' };

// app.runProcess() คืน wrapper ของแพลตฟอร์ม ไม่ใช่ค่าที่ child Process return โดยตรง:
// { success, permissionDenied, reply: { status, message, data } }
// รองรับทั้ง wrapper จริงและ direct payload เพื่อให้ใช้ได้กับ test/runtime หลายเวอร์ชัน
const unwrapProcess = (result) => {
	if (!result || typeof result !== 'object') return null;
	const reply = result.reply || {};
	const candidates = [reply.data, result.data, reply, result];
	for (let i = 0; i < candidates.length; i += 1) {
		const item = candidates[i];
		if (item && typeof item === 'object' && typeof item.success === 'boolean') return item;
	}
	return null;
};

// ใบสั่งตรวจของวิสิทนี้ + ผลที่ออกวันนี้ — คนละ process กันโดยตั้งใจ (emr-lab-board-get)
// 🔴 ครอบ try ไว้: board ล้มก็แค่ไม่มีก้อนผล ห้ามลาก cc/hpi/PE/dx/ยา ของตัวนี้พังไปด้วย
let board = { current_vn: '', lab_orders: [], xray_results: [], lab_trends: [] };
try {
	const bo = unwrapProcess(await app.runProcess(BOARD_PROC, { person_id: personId, hn: hn, visit_id: curVisitId }, userInfo));
	if (bo && bo.success) board = { current_vn: bo.current_vn || '', lab_orders: bo.lab_orders || [], xray_results: bo.xray_results || [], lab_trends: bo.lab_trends || [] };
} catch (boardErr) {
	app.log.warn('[emr-summary] lab board ล้ม: ' + ((boardErr && boardErr.message) || boardErr));
}

// ---------------------------------------------------------------- 1) หา visit ก่อนหน้า (ใบล่าสุดใบเดียว)

// 🔴 เอาใบเดียวเท่านั้น (พี่เคาะ 2026-08-31) — เคยลองไล่ย้อนหาส่วนที่มีข้อมูลทีละหัวข้อแล้ว
//    ได้ CC จาก visit หนึ่ง Dx จากอีก visit ยาจากอีกใบ ⇒ อ่านแล้วสับสนว่าเป็นการรักษาครั้งไหน
//    การ์ดนี้ต้องตอบ "ครั้งก่อนมาหาหมอ เกิดอะไรขึ้น" = ภาพของ visit เดียว
const visitRows = await findAll(
	VISIT_TABLE,
	personId ? { 'pid.value': idPair(personId), xrstatx: 1 } : { 'pid.hn': String(hn), xrstatx: 1 },
	{ sort: { visit_date: -1, _id: -1 }, limit: 5, projection: { visit_date: 1, vn: 1, visit_clinic: 1, visit_doctor: 1, 'pid.hn': 1 } },
);
const prev = visitRows.find((v) => !curVisitId || String(v._id) !== curVisitId) || null;

if (!prev) {
	return { success: true, built: 0, has_history: false, hn: hn || null, visit: null, cc: '', hpi: '', pe: null, dx: [], meds: [], other: [], plan: null, lab: [], xray: [], ...board };
}

const prevId = String(prev._id);
if (!hn) hn = (prev.pid && prev.pid.hn) || null;

const from = { visit_id: prevId, vn: prev.vn || null, visit_date: prev.visit_date || null };

// snapshot ของใบนั้น — ไม่มีก็สร้างให้ (visit เก่าที่ยังไม่เคยถูกแตะหลังระบบ Visit History ขึ้น)
let built = 0;
let snap = (await findAll(VH_TABLE, { 'vid.value': idPair(prevId), xrstatx: 1 }, { limit: 1 }))[0] || null;
if (!snap) {
	try {
		const out = await app.runProcess(BUILD_PROC, { visit_id: prevId }, userInfo);
		if (out && out.success) {
			built = 1;
			snap = (await findAll(VH_TABLE, { 'vid.value': idPair(prevId), xrstatx: 1 }, { limit: 1 }))[0] || null;
		}
	} catch (e) {
		// การ์ดต้องเปิดได้เสมอ — build ไม่ผ่านก็ตกไปอ่านตารางต้นทางตรงข้างล่าง
		app.log.warn('[emr-summary] lazy build ล้ม (' + prevId + '): ' + e.message);
	}
}

// ---------------------------------------------------------------- 2) สกัดเนื้อจาก snapshot ของใบนั้น

const blocks = (snap && snap.emr && snap.emr.blocks) || [];
const rowsOf = (formId) => {
	const b = blocks.find((x) => String(x.form_id) === formId);
	return b ? b.rows.map((r) => ({ data_id: r.data_id, data: r.data || {} })) : [];
};
const visitData = (snap && snap.emr && snap.emr.visit && snap.emr.visit.data) || {};

// แปลงใบ PE 1 ใบเป็นรูปที่จอใช้ได้ — เอาเฉพาะแถวที่มีเนื้อ (แถวเปล่าจากฟอร์มไม่ต้องโชว์)
// pe_examina เป็น select-form ที่พก name_th/name/normal ติดค่ามาให้แล้ว ⇒ ไม่ต้อง join master
const buildPe = (d, dataId) => {
	const items = [];
	for (const r of Array.isArray(d.pe) ? d.pe : []) {
		const ex = r && r.pe_examina;
		const name = (ex && (ex.name_th || ex.label || ex.name)) || '';
		const findings = String((r && r.pe_findings) || '').trim();
		const result = codeOf(r && r.pe_result);
		if (!name && !findings) continue;
		items.push({
			name,
			findings,
			result, // ค่า radio ตามที่ฟอร์มเก็บ
			abnormal: !!(result && String(result).toLowerCase() !== 'normal' && String(result) !== '1'),
			group: (ex && ex.group) || '',
		});
	}
	return { data_id: dataId, form_id: PE_FORM, note: d.note || '', items };
};

const firstOf = (rows, key) => {
	for (const r of rows) {
		const t = String((r.data && r.data[key]) || '').trim();
		if (t) return t;
	}
	return '';
};

// CC / HPI — ตัวจริงอยู่ที่ใบ Screening (พยาบาลซักประวัติ) · visit.cc เป็นค่าที่ห้องบัตรคีย์ตอนรับบริการ
const screenRows = rowsOf(SCREENING_FORM);
let cc = firstOf(screenRows, 'cc') || String(visitData.cc || '').trim();
let hpi = firstOf(screenRows, 'hpi');

// PE
let pe = null;
const peHit = rowsOf(PE_FORM).find((r) => (Array.isArray(r.data.pe) && r.data.pe.length) || String(r.data.note || '').trim());
if (peHit) pe = buildPe(peHit.data, peHit.data_id);

// วินิจฉัย
const dx = [];
for (const r of rowsOf(DX_FORM)) {
	const d = r.data;
	if (d.primary_dx) dx.push({ text: labelOf(d.primary_dx), primary: true, data_id: r.data_id });
	if (Array.isArray(d.dx_item)) {
		for (const it of d.dx_item) {
			const t = labelOf(it && (it.dx_code || it.icd10 || it.dx_item || it.dx));
			if (t) dx.push({ text: t, primary: false, data_id: r.data_id });
		}
	}
}

// ยา / หัตถการ — service_type ของจริงคือ 'med' (ข้อมูลเก่าบางชุดใช้ 'drug') ⇒ รับทั้งคู่
const meds = [];
const other = [];
const pushItem = (d, dataId, when) => {
	const type = String(codeOf(d.service_type) || '').toLowerCase();
	const pd = d.prescription_data || {};
	const row = {
		data_id: dataId,
		form_id: ITEM_FORM,
		name: d.item_name || '',
		code: d.item_code || '',
		qty: d.quantity != null ? d.quantity : null,
		status: d.current_status || '',
		type,
		when: when || '',
	};
	if (type === 'med' || type === 'drug') {
		meds.push({ ...row, sig: pd.sig_label_th || pd.sig_label || '', indication: pd.sig_indication || '', duration: pd.sig_duration != null ? pd.sig_duration : null, refill: !!d.is_refill });
	} else if (type !== 'lab' && type !== 'xray') {
		other.push(row);
	}
};
for (const r of rowsOf(ITEM_FORM)) pushItem(r.data, r.data_id, r.data.created_at);

// แผนการรักษา (จอปัจจุบันไม่ได้แสดง แต่ยังคืนไว้ — เอากลับมาแสดงได้โดยไม่ต้องแก้ process)
let plan = null;
const planHit = rowsOf(PLAN_FORM).find((r) => {
	const d = r.data;
	return d.plan_disposition || d.plan_sick_leave_days || d.plan_education || d.plan_safety_net;
});
if (planHit) {
	plan = {
		data_id: planHit.data_id,
		form_id: PLAN_FORM,
		disposition: labelOf(planHit.data.plan_disposition),
		sick_leave_days: planHit.data.plan_sick_leave_days != null ? planHit.data.plan_sick_leave_days : null,
		education: planHit.data.plan_education || '',
		safety_net: planHit.data.plan_safety_net || '',
	};
}

// ---------------------------------------------------------------- 2.5) snapshot ใช้ไม่ได้ → อ่านตารางต้นทางของ visit เดียวกัน

// ใบที่ build ไม่ผ่าน (หรือ block ว่าง) ยังต้องแสดงได้ — query ตรงด้วย vid ของ visit ใบนั้น ไม่ข้ามไปใบอื่น
const vidFilter = { 'vid.value': idPair(prevId), xrstatx: 1 };

if (!cc || !hpi) {
	const rows = await findAll('zdata_screening', vidFilter, { limit: 5, projection: { cc: 1, hpi: 1 } });
	for (const r of rows) {
		if (!cc && String(r.cc || '').trim()) cc = String(r.cc).trim();
		if (!hpi && String(r.hpi || '').trim()) hpi = String(r.hpi).trim();
	}
}

if (!pe) {
	const rows = await findAll('zdata_pe', vidFilter, { limit: 5 });
	const hit = rows.find((r) => (Array.isArray(r.pe) && r.pe.length) || String(r.note || '').trim());
	if (hit) pe = buildPe(hit, String(hit._id));
}

if (!dx.length) {
	const rows = await findAll('zdata_diagnosis', vidFilter, { limit: 5, projection: { primary_dx: 1, dx_item: 1 } });
	for (const r of rows) {
		if (r.primary_dx) dx.push({ text: labelOf(r.primary_dx), primary: true, data_id: String(r._id) });
		if (Array.isArray(r.dx_item)) {
			for (const it of r.dx_item) {
				const t = labelOf(it && (it.dx_code || it.icd10 || it.dx_item || it.dx));
				if (t) dx.push({ text: t, primary: false, data_id: String(r._id) });
			}
		}
	}
}

if (!meds.length && !other.length) {
	// รายการสั่งผูกกับใบสั่ง ไม่ใช่ visit ⇒ visit อยู่ที่ chain lv2 ของ joiner (lv1 = person)
	const rows = await findAll('zdata_cpoe_order_item', { 'order_id.xtbxlv2_xfx_id': idPair(prevId), xrstatx: 1 }, { sort: { _id: -1 }, limit: 60 });
	for (const r of rows) pushItem(r, String(r._id), r.created_at);
}

if (!plan) {
	const rows = await findAll('zdata_plan', vidFilter, { limit: 5 });
	const hit = rows.find((r) => r.plan_disposition || r.plan_sick_leave_days || r.plan_education || r.plan_safety_net);
	if (hit) {
		plan = {
			data_id: String(hit._id),
			form_id: PLAN_FORM,
			disposition: labelOf(hit.plan_disposition),
			sick_leave_days: hit.plan_sick_leave_days != null ? hit.plan_sick_leave_days : null,
			education: hit.plan_education || '',
			safety_net: hit.plan_safety_net || '',
		};
	}
}

const visitInfo = {
	...from,
	clinic: labelOf(prev.visit_clinic) || labelOf(visitData.visit_clinic),
	doctor: labelOf(prev.visit_doctor) || labelOf(visitData.visit_doctor),
	history_id: snap ? String(snap._id) : null,
};

// ---------------------------------------------------------------- 3) Lab / X-ray (ผลล่าสุดของคนไข้ ไม่จำกัด visit)

let lab = [];
let xray = [];
if (hn) {
	const labRows = await findAll(
		LAB_TABLE,
		{ hn: String(hn), xrstatx: 1 },
		{ sort: { _id: -1 }, limit: MAX_LAB, projection: { test_name: 1, panel_name: 1, result_value: 1, unit_symbol_snapshot: 1, units: 1, reference_range_snapshot: 1, ref_range: 1, interpretation_code: 1, is_critical: 1, result_status: 1, visit_id: 1, filler_order_no: 1, created_at: 1, entered_at: 1 } },
	);
	// เก็บค่าล่าสุดต่อรายการตรวจ — ผลชุดเก่าของ test เดียวกันไม่ต้องโชว์ซ้ำในการ์ดสรุป
	const seen = {};
	for (const r of labRows) {
		const name = r.test_name || r.panel_name || '';
		if (!name || seen[name]) continue;
		seen[name] = true;
		lab.push({
			data_id: String(r._id),
			name,
			panel: r.panel_name || '',
			value: r.result_value != null ? String(r.result_value) : '',
			unit: r.unit_symbol_snapshot || r.units || '',
			ref: r.reference_range_snapshot || r.ref_range || '',
			flag: r.interpretation_code || '',
			critical: !!r.is_critical,
			status: codeOf(r.result_status) || '',
			when: r.entered_at || r.created_at || '',
			visit_id: r.visit_id || '',
		});
	}

	const xrayRows = await findAll(
		XRAY_TABLE,
		{ Hn: String(hn), xrstatx: 1 },
		{ sort: { ResultDateTime: -1, _id: -1 }, limit: MAX_XRAY },
	);
	xray = xrayRows.map((r) => ({
		data_id: String(r._id),
		name: r.ExamName || '',
		result: r.ResultText || '',
		when: r.ResultDateTime || r.ImageCapturedDateTime || '',
		status: r.Status || '',
		severity: r.SeverityUid || '',
		accession: r.AccessionNo || '',
	}));
}

return {
	success: true,
	built, // จำนวน snapshot ที่สร้างให้ระหว่างอ่าน (visit เก่าที่ยังไม่เคย build)
	has_history: true,
	hn: hn || null,
	visit: visitInfo,
	cc,
	hpi,
	pe,
	dx,
	meds,
	from, // ทุกหัวข้อมาจาก visit ใบเดียวกันนี้
	other,
	plan,
	lab,
	xray,
	lab_form_id: '6a8bc91df851000f28e501fb',
	xray_form_id: '6a860980f851000f28e44ab0',
	...board, // current_vn · lab_orders · xray_results · lab_trends
};
