/**
 * emr-history-get — ข้อมูลจอ "EMR History" (ฟอร์ม EMR Hisroty 6a96557e422c1ca959829eae)
 * ---------------------------------------------------------------------------------
 * คืนภาพ **การรักษาของ visit ใบเดียว** แบบอ่านอย่างเดียว — คนละงานกับ emr-summary-get
 * (ตัวนั้นตอบ "ครั้งก่อนรักษาอะไรไป" จากมุมของ visit ปัจจุบัน)
 *
 * params: { visit_id }  หรือ  { history_id }   (อย่างใดอย่างหนึ่ง)
 * return: { success, built, visit, vitals, subjective, pe, dx, plan, consults[], orders[], money, others[], meta }
 *
 * 🔴 อ่านจาก snapshot ฟอร์ม Visit History อย่างเดียว (พี่เคาะ 2026-09-01) — ไม่ query ตารางต้นทางซ้ำ
 *    ไม่มี snapshot → สั่ง visit-history-build ให้ 1 ครั้ง แล้วอ่านใหม่ (visit เก่าก่อนระบบนี้ขึ้น)
 * 🔴 ทุกก้อนพก form_id + data_id กลับไปด้วย ⇒ จอกดเปิด record ต้นทางดูของจริงได้
 */

const VH_TABLE = 'zdata_visit_history';
const VISIT_TABLE = 'zdata_visit';
const BUILD_PROC = '6a95549ef4908ee7af234e56'; // visit-history-build

// ฟอร์มที่จอนี้รู้จักและจัดวางเป็นหัวข้อเฉพาะ — นอกลิสต์นี้ตกไปกลุ่ม "บันทึกอื่น ๆ"
const F = {
	VISIT: '6a40fdec4b6dfdf45acbfbce',
	TRAN: '6a461235e521219e514d1c4b',
	VITAL: '6a470b4939179670f85ba2d8',
	BMI: '6a4689ef39179670f85ba2a2',
	SCREENING: '6a473513d54977f38061dddd',
	NOTE: '6a61e715aa0b20d77634b390', // Clinical Note (เก่า) — สำรอง hpi
	PE: '6a473a1dd54977f38061dddf',
	DX: '6a47a9cc8ca8083d715e3486',
	PLAN: '6a47dcac8ca8083d715e3492',
	CONSULT: '6a482ea68ca8083d715e3498',
	ORDER: '6a6f5cd1265885c2377cc218',
	ORDER_ITEM: '6a6f7db2265885c2377cc222',
	BILL: '6a87aeedf851000f28e5019f',
	BILL_ITEM: '6a87b34ff851000f28e501a7',
};

// ฟอร์มที่จัดการแล้วในหัวข้อเฉพาะ (หรือไม่ต้องโชว์ซ้ำ) — ไม่ต้องไปโผล่ใน "บันทึกอื่น ๆ" อีก
// Bill (ใบเสร็จ) ปล่อยให้โผล่ใน "บันทึกอื่น ๆ" — กดเปิดดูใบจริงได้ · Bill item ไม่ต้อง (รายละเอียดอยู่ในใบแล้ว)
const HANDLED = [F.TRAN, F.VITAL, F.BMI, F.SCREENING, F.NOTE, F.PE, F.DX, F.PLAN, F.CONSULT, F.ORDER, F.ORDER_ITEM, F.BILL_ITEM];

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

// ค่า choice / select-form เก็บเป็น { value, label } — เอาไปโชว์ใช้ label, เอาไปเทียบใช้ value
const labelOf = (v) => (v && typeof v === 'object' ? v.label || v.value : v) || '';
const codeOf = (v) => (v && typeof v === 'object' ? v.value : v) || '';
const txt = (v) => String(v == null ? '' : v).trim();
const numOrNull = (v) => {
	if (v === '' || v == null) return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
};

// ── ช่วงปกติของสัญญาณชีพตามอายุ ────────────────────────────────────────
// 🔴 ค่ามาตรฐานทั่วไป (PALS/ผู้ใหญ่) — hardcode ไว้ก่อน ถ้า รพ. มีเกณฑ์ของตัวเองต้องย้ายไป master
//    จอเอาไปทำ "ธงแดง" ให้หมอไม่ต้องอ่านตัวเลขเอง ⇒ ต้องอนุรักษ์นิยม: สงสัยว่าผิด = ติดธง
const VITAL_RANGE = [
	{ max_age: 1, pulse: [100, 160], rr: [30, 60], bp_h: [70, 100], bp_l: [35, 65] },
	{ max_age: 3, pulse: [90, 150], rr: [24, 40], bp_h: [80, 110], bp_l: [40, 70] },
	{ max_age: 6, pulse: [80, 140], rr: [22, 34], bp_h: [85, 115], bp_l: [45, 75] },
	{ max_age: 12, pulse: [70, 120], rr: [18, 30], bp_h: [90, 120], bp_l: [50, 80] },
	{ max_age: 18, pulse: [60, 100], rr: [12, 20], bp_h: [95, 130], bp_l: [55, 85] },
	{ max_age: 999, pulse: [60, 100], rr: [12, 20], bp_h: [90, 140], bp_l: [60, 90] },
];
const TEMP_RANGE = [36, 37.5];

// อายุเป็นปี — คิดจาก birth_date เทียบวันที่มาตรวจ (แม่นกว่า string "25y 2m 4d" ที่ snapshot เก็บ)
const ageYearOf = (birth, visitDate) => {
	const b = String(birth || '').slice(0, 10);
	const v = String(visitDate || '').slice(0, 10);
	if (b.length !== 10) return null;
	const bd = new Date(b);
	const vd = v.length === 10 ? new Date(v) : new Date();
	if (isNaN(bd.getTime()) || isNaN(vd.getTime())) return null;
	return Math.floor((vd - bd) / (365.25 * 24 * 3600 * 1000));
};

// คืน 'high' / 'low' / '' — ค่าที่ยังไม่ได้วัดคืน '' (ไม่ใช่ผิดปกติ)
const flagOf = (val, range) => {
	if (val == null || !range) return '';
	if (val < range[0]) return 'low';
	if (val > range[1]) return 'high';
	return '';
};

// ---------------------------------------------------------------- 1) หา snapshot ของ visit ที่ขอมา

const historyId = params.history_id ? String(params.history_id) : null;
let visitId = params.visit_id ? String(params.visit_id) : null;

if (!visitId && !historyId) return { success: false, message: 'ต้องส่ง visit_id หรือ history_id' };

let built = 0;
let snap = null;

if (historyId) {
	const res = await app.dbFindById(app.dbObjectId(historyId), VH_TABLE);
	snap = res && res.success ? res.reply.data : null;
	if (snap && snap.vid && snap.vid.value) visitId = String(snap.vid.value);
} else {
	snap = (await findAll(VH_TABLE, { 'vid.value': idPair(visitId), xrstatx: 1 }, { limit: 1 }))[0] || null;
	// ยังไม่เคยมีใครแตะ visit ใบนี้หลังระบบ Visit History ขึ้น → สร้างให้ตรงนี้ครั้งเดียว
	if (!snap) {
		try {
			const out = await app.runProcess(BUILD_PROC, { visit_id: visitId }, userInfo);
			if (out && out.success) {
				built = 1;
				snap = (await findAll(VH_TABLE, { 'vid.value': idPair(visitId), xrstatx: 1 }, { limit: 1 }))[0] || null;
			}
		} catch (e) {
			app.log.warn('[emr-history] build ล้ม (' + visitId + '): ' + e.message);
		}
	}
}

if (!snap || !snap.emr) {
	return { success: false, message: 'ยังไม่มีประวัติของการมาตรวจครั้งนี้', visit_id: visitId || null, built };
}

const emr = snap.emr || {};
const blocks = Array.isArray(emr.blocks) ? emr.blocks : [];
const blockOf = (formId) => blocks.find((b) => String(b.form_id) === formId) || null;
const rowsOf = (formId) => {
	const b = blockOf(formId);
	return b && Array.isArray(b.rows) ? b.rows : [];
};
// แถวแรกที่ "มีเนื้อจริง" ตามเงื่อนไขที่ส่งมา (แถวเปล่าจากฟอร์มไม่ต้องโชว์)
const hitRow = (formId, has) => rowsOf(formId).find((r) => has(r.data || {})) || null;

const vMeta = emr.visit || {};
const v = vMeta.data || {};

// ---------------------------------------------------------------- 2) หัวจอ — คนไข้ / การมาตรวจ

const pid = v.pid || {};
const pic = Array.isArray(pid.p_pic) && pid.p_pic[0] ? pid.p_pic[0].url || '' : '';
const tranRow = rowsOf(F.TRAN)[0] || null;
const tran = (tranRow && tranRow.data) || {};

const person = {
	person_id: vMeta.person_id || codeOf(v.pid) || '',
	hn: pid.hn || vMeta.hn || '',
	name: txt([labelOf(pid.prename), pid.p_fname, pid.p_lname].filter(Boolean).join(' ')) || labelOf(v.pid),
	gender: txt(v.gender_text),
	age: txt(v.age) || txt(pid.age),
	birth_date: txt(pid.birth_date),
	blood: txt(v.abogroup_text),
	phone: txt(pid.p_phone),
	photo: pic,
};

// สิทธิการรักษา — ใบเดียวมีได้หลายสิทธิ (หลัก/รอง)
const inscl = (Array.isArray(v.inscl_hos) ? v.inscl_hos : []).map((r) => ({
	main: labelOf(r && r.inscl_item_main),
	sub: labelOf(r && r.inscl_item_sub),
	code: codeOf(r && r.inscl_item_main),
}));

const visit = {
	visit_id: vMeta.data_id || visitId || '',
	history_id: String(snap._id),
	form_id: vMeta.form_id || F.VISIT,
	data_id: vMeta.data_id || '',
	vn: vMeta.vn || txt(v.vn),
	hn: person.hn,
	visit_date: vMeta.visit_date || txt(v.visit_date),
	checkin_at: txt(tran.checkin_at) || txt(v.created_at),
	checkout_at: txt(tran.checkout_at),
	clinic: labelOf(v.visit_clinic),
	room: labelOf(v.visit_room) || labelOf(tran.room_to),
	doctor: labelOf(v.visit_doctor) || labelOf(tran.doctor_to) || labelOf(v.doctor_diag),
	queue_label: txt(tran.queue_label),
	queue_no: numOrNull(tran.queue_no),
	visit_status: v.visit_status === false ? 'closed' : 'open',
	person: person,
	inscl: inscl,
	// การแพ้เก็บที่ระดับ tran (ตัวเดียวกับที่หัวจอ EMR ใช้) — เป็นภาพ ณ วันที่มาตรวจ
	allergy_tags: Array.isArray(tran.allergy_tags) ? tran.allergy_tags.filter(Boolean) : [],
};

// ---------------------------------------------------------------- 3) สัญญาณชีพ / BMI

const vitalRow = rowsOf(F.VITAL)[0] || null;
const vital = (vitalRow && vitalRow.data) || {};
const bmiRow = rowsOf(F.BMI)[0] || null;
const bmi = (bmiRow && bmiRow.data) || {};

const vitals = {
	bp_h: numOrNull(vital.bp_h),
	bp_l: numOrNull(vital.bp_l),
	pulse: numOrNull(vital.pulse),
	rr: numOrNull(vital.rr),
	temp: numOrNull(vital.temp),
	weight: numOrNull(bmi.weight),
	stature: numOrNull(bmi.stature),
	bmi: numOrNull(bmi.bmi),
	bsa: numOrNull(bmi.bsa),
	waistline: numOrNull(bmi.waistline),
	vital_form_id: F.VITAL,
	vital_data_id: vitalRow ? vitalRow.data_id : '',
	vital_at: txt(vital.updated_at) || txt(vital.created_at),
	bmi_form_id: F.BMI,
	bmi_data_id: bmiRow ? bmiRow.data_id : '',
};
vitals.has = vitals.bp_h != null || vitals.pulse != null || vitals.temp != null || vitals.rr != null || vitals.weight != null || vitals.bmi != null;

// ธงเตือนตามช่วงปกติของอายุคนไข้ ณ วันที่มาตรวจ — จอเอาไปทำสีแดง/ป้าย "สูง/ต่ำ"
const ageY = ageYearOf(person.birth_date, visit.visit_date);
const range = VITAL_RANGE.find((r) => ageY == null || ageY < r.max_age) || VITAL_RANGE[VITAL_RANGE.length - 1];
vitals.age_year = ageY;
vitals.range = { pulse: range.pulse, rr: range.rr, bp_h: range.bp_h, bp_l: range.bp_l, temp: TEMP_RANGE };
vitals.flags = {
	bp_h: flagOf(vitals.bp_h, range.bp_h),
	bp_l: flagOf(vitals.bp_l, range.bp_l),
	pulse: flagOf(vitals.pulse, range.pulse),
	rr: flagOf(vitals.rr, range.rr),
	temp: flagOf(vitals.temp, TEMP_RANGE),
};
vitals.abnormal = Object.keys(vitals.flags).some((k) => !!vitals.flags[k]);

// ---------------------------------------------------------------- 4) S — ซักประวัติ

const scrRow = hitRow(F.SCREENING, (d) => txt(d.cc) || txt(d.hpi) || txt(d.congenital_disease) || txt(d.history_sickness_past) || txt(d.history_family));
const scr = (scrRow && scrRow.data) || {};
const noteRow = hitRow(F.NOTE, (d) => txt(d.hpi));

const subjective = {
	cc: txt(scr.cc) || txt(tran.cc) || txt(v.cc),
	hpi: txt(scr.hpi) || (noteRow ? txt(noteRow.data.hpi) : ''),
	past: txt(scr.history_sickness_past),
	congenital: txt(scr.congenital_disease),
	family: txt(scr.history_family),
	form_id: F.SCREENING,
	data_id: scrRow ? scrRow.data_id : '',
	at: txt(scr.updated_at) || txt(scr.created_at),
	by: (scr.updated_by && scr.updated_by.name) || (scr.created_by && scr.created_by.name) || '',
};
subjective.has = !!(subjective.cc || subjective.hpi || subjective.past || subjective.congenital || subjective.family);

// ---------------------------------------------------------------- 5) O — ตรวจร่างกาย

// pe_examina เป็น select-form ที่พก name_th/name/normal/group ติดมาแล้ว ⇒ ไม่ต้อง join master
const peRow = hitRow(F.PE, (d) => (Array.isArray(d.pe) && d.pe.length) || txt(d.note));
const peData = (peRow && peRow.data) || {};
const peItems = [];
for (const r of Array.isArray(peData.pe) ? peData.pe : []) {
	const ex = (r && r.pe_examina) || {};
	const name = ex.name_th || ex.label || ex.name || '';
	const findings = txt(r && r.pe_findings);
	const result = codeOf(r && r.pe_result);
	if (!name && !findings) continue;
	peItems.push({
		name: name,
		group: ex.group || '',
		normal_text: ex.normal || '',
		findings: findings,
		result: result,
		// ระบบเก็บ '1' = ปกติ (บางชุดเก็บ 'normal') — นอกจากนี้ถือว่าผิดปกติ ต้องเน้นสี
		abnormal: !!(result && String(result).toLowerCase() !== 'normal' && String(result) !== '1'),
	});
}
const pe = {
	items: peItems,
	note: peData.note || '', // html-input — จอ render เป็น html (มาจากฟอร์มในระบบ ไม่ใช่ข้อมูลนอก)
	form_id: F.PE,
	data_id: peRow ? peRow.data_id : '',
	at: txt(peData.updated_at) || txt(peData.created_at),
	by: (peData.updated_by && peData.updated_by.name) || (peData.created_by && peData.created_by.name) || '',
	has: peItems.length > 0 || !!txt(peData.note),
	// จอกางเฉพาะรายการที่ผิดปกติ ที่เหลือพับไว้ — หมอสแกนตาแล้วเจอของสำคัญก่อน
	abnormal_count: peItems.filter((p) => p.abnormal).length,
	normal_count: peItems.filter((p) => !p.abnormal).length,
};

// ---------------------------------------------------------------- 6) A — วินิจฉัย

const dxItems = [];
let dxDoctor = '';
let dxFormRow = null;
for (const r of rowsOf(F.DX)) {
	const d = r.data || {};
	if (!dxFormRow && (d.primary_dx || (Array.isArray(d.dx_item) && d.dx_item.length))) dxFormRow = r;
	if (!dxDoctor) dxDoctor = labelOf(d.doctor_dx);
	if (d.primary_dx) dxItems.push({ code: codeOf(d.primary_dx), text: labelOf(d.primary_dx), primary: true, data_id: r.data_id });
	for (const it of Array.isArray(d.dx_item) ? d.dx_item : []) {
		const src = it && (it.dx_code || it.icd10 || it.dx_item || it.dx);
		const text = labelOf(src);
		if (!text) continue;
		dxItems.push({
			code: codeOf(src),
			text: text,
			primary: false,
			dx_type: labelOf(it.dx_type),
			data_id: r.data_id,
		});
	}
}
const dx = {
	items: dxItems,
	doctor: dxDoctor || labelOf(v.doctor_diag),
	form_id: F.DX,
	data_id: dxFormRow ? dxFormRow.data_id : '',
	has: dxItems.length > 0,
};

// ---------------------------------------------------------------- 7) P — แผนการรักษา

const planRow = hitRow(F.PLAN, (d) => d.plan_disposition || d.plan_sick_leave_days || txt(d.plan_education) || txt(d.plan_safety_net));
const planData = (planRow && planRow.data) || {};
const plan = {
	disposition: labelOf(planData.plan_disposition),
	sick_leave_days: numOrNull(planData.plan_sick_leave_days),
	education: planData.plan_education || '', // html
	safety_net: planData.plan_safety_net || '', // html
	form_id: F.PLAN,
	data_id: planRow ? planRow.data_id : '',
	has: !!planRow,
};

// ---------------------------------------------------------------- 8) ปรึกษา (Consult)

const consults = rowsOf(F.CONSULT).map((r) => {
	const d = r.data || {};
	return {
		to: labelOf(d.consult_to),
		clinic: labelOf(d.consult_to && d.consult_to.consult_clinic),
		doctor: labelOf(d.consult_to && d.consult_to.consult_doctor) || labelOf(d.consult_doctor),
		reason: txt(d.consult_reason),
		status: codeOf(d.consult_status),
		priority: codeOf(d.consult_priority),
		replied: !!d.reply,
		soap_s: txt(d.soap_s),
		soap_o: txt(d.soap_o),
		soap_a: txt(d.soap_a),
		soap_p: txt(d.soap_p),
		at: txt(d.created_at),
		form_id: F.CONSULT,
		data_id: r.data_id,
	};
});

// ---------------------------------------------------------------- 9) ใบสั่ง + รายการในใบ

// รายการผูกกับ "ใบสั่ง" ไม่ใช่ visit ⇒ จับคู่ด้วย parent_id ของ row (= data_id ของใบ)
const itemsByOrder = {};
for (const r of rowsOf(F.ORDER_ITEM)) {
	const d = r.data || {};
	const key = String(r.parent_id || '');
	const pd = d.prescription_data || {};
	const item = {
		data_id: r.data_id,
		form_id: F.ORDER_ITEM,
		name: txt(d.item_name),
		code: txt(d.item_code),
		type: String(codeOf(d.service_type) || '').toLowerCase(),
		type_label: labelOf(d.service_type),
		status: txt(d.current_status),
		qty: numOrNull(d.quantity),
		unit_price: numOrNull(d.unit_price),
		net_amount: numOrNull(d.net_amount),
		tags: Array.isArray(d.item_tags) ? d.item_tags.filter(Boolean) : [],
		comment: txt(d.comment),
		is_refill: !!d.is_refill,
		// ยา: sig ฉบับไทยคือตัวที่หมอ/เภสัชอ่าน — ตัวอังกฤษเก็บไว้เผื่อ sig ไทยว่าง
		sig: txt(pd.sig_label_th) || txt(pd.sig_label),
		indication: txt(pd.sig_indication),
		duration: numOrNull(pd.sig_duration),
		sig_note: txt(pd.sig_note),
	};
	if (!itemsByOrder[key]) itemsByOrder[key] = [];
	itemsByOrder[key].push(item);
}

const orders = rowsOf(F.ORDER).map((r) => {
	const d = r.data || {};
	const items = itemsByOrder[String(r.data_id)] || [];
	return {
		data_id: r.data_id,
		form_id: F.ORDER,
		order_number: txt(d.order_number),
		type: String(codeOf(d.service_type) || '').toLowerCase(),
		type_label: labelOf(d.service_type),
		status: txt(d.current_status),
		priority: codeOf(d.priority),
		total_amount: numOrNull(d.total_amount),
		paid_amount: numOrNull(d.paid_amount),
		item_count: numOrNull(d.item_count) != null ? numOrNull(d.item_count) : items.length,
		comment: txt(d.order_comment),
		is_refill: !!d.is_refill,
		at: txt(d.created_at),
		by: (d.created_by && d.created_by.name) || '',
		items: items,
	};
});
// เรียงตามเวลาสั่ง — ใบแรกที่หมอสั่งอยู่บน อ่านตามลำดับการรักษา
orders.sort((a, b) => String(a.at).localeCompare(String(b.at)));

// รวมรายการทุกใบเข้าด้วยกันแล้วจัดตามชนิด — จอหลักแสดงชุดนี้ (ใบสั่งยังคืนไว้ให้กดดูใบต้นทางได้)
// 🔴 ใบที่ถูกยกเลิกยังอยู่ในลิสต์ แต่ติดธง cancelled ไว้ — ประวัติต้องเห็นว่าเคยสั่งแล้วยกเลิก
const TYPE_ORDER = ['med', 'lab', 'xray', 'nurs', 'order'];
const TYPE_LABEL = { med: 'ยา', drug: 'ยา', lab: 'Lab', xray: 'X-ray', nurs: 'หัตถการ', order: 'เวชภัณฑ์' };
const groupMap = {};
for (const o of orders) {
	const cancelled = String(o.status || '').toLowerCase().indexOf('cancel') === 0;
	for (const it of o.items) {
		const t = it.type === 'drug' ? 'med' : it.type || 'other';
		if (!groupMap[t]) groupMap[t] = { type: t, label: TYPE_LABEL[t] || it.type_label || 'อื่นๆ', count: 0, total: 0, items: [] };
		groupMap[t].count += 1;
		if (!cancelled) groupMap[t].total += Number(it.net_amount) || 0;
		groupMap[t].items.push(
			Object.assign({}, it, {
				order_number: o.order_number,
				order_id: o.data_id,
				order_form_id: o.form_id,
				order_status: o.status,
				order_at: o.at,
				cancelled: cancelled,
			}),
		);
	}
}
const itemGroups = Object.keys(groupMap)
	.sort((a, b) => {
		const ia = TYPE_ORDER.indexOf(a);
		const ib = TYPE_ORDER.indexOf(b);
		return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
	})
	.map((k) => groupMap[k]);

// ---------------------------------------------------------------- 10) การเงิน + ก้อนที่เหลือ

// 🔴 ตัวเลข 2 ชุดนี้ต่างกันเป็นปกติ และเคยทำให้คนอ่านคิดว่าจอคำนวณผิด:
//    ordered = มูลค่าที่หมอสั่ง (จากใบสั่ง) · billed = ที่ออกบิลแล้ว (จากฟอร์ม Bill) ⇒ จอต้องเขียน label แยกให้ชัด
const orderedTotal = orders.reduce((sum, o) => (String(o.status || '').toLowerCase().indexOf('cancel') === 0 ? sum : sum + (Number(o.total_amount) || 0)), 0);
const money = {
	ordered: orderedTotal,
	total: numOrNull(snap.total_amount) || 0, // ออกบิลแล้ว
	paid: numOrNull(snap.paid_amount) || 0,
	outstanding: numOrNull(snap.outstanding_amount) || 0,
	status_text: txt(snap.bill_status_text),
	// ยังไม่มีบิลและไม่มีใบสั่ง = ไม่ต้องโชว์แถบการเงินให้รก
	has: !!(orderedTotal || numOrNull(snap.total_amount) || numOrNull(snap.paid_amount)),
};

// ก้อนที่จอไม่มีหัวข้อเฉพาะให้ (ทะเบียนโรค / ใบเสร็จ / ฟอร์มเฉพาะทางที่เพิ่มมาทีหลัง)
// ⇒ ฟอร์มใหม่ที่ถูกผูกเข้า Visit History ทีหลัง จะไม่หายไปจากจอนี้โดยไม่มีใครรู้
//
// 🔴 แถวพวกนี้ต้อง "อ่านแล้วรู้เรื่อง" ไม่ใช่โชว์ค่าแรกที่เจอ (เคยได้ "draft" ลอย ๆ ซึ่งบอกอะไรไม่ได้)
//    ⇒ เลือก field ตามความหมาย (เลขที่เอกสาร → ชื่อ/หัวข้อ → ยอดเงิน → สถานะ) แล้วติด label จริง
//       ของฟอร์มนั้นจาก form_db.schema — ไม่เดา label เอง
const otherBlocks = blocks.filter((b) => HANDLED.indexOf(String(b.form_id)) < 0);

// label ของ field แต่ละฟอร์ม — อ่านทีเดียวต่อฟอร์ม (ก้อนพวกนี้มีไม่กี่ฟอร์มต่อ visit)
const labelByForm = {};
for (const b of otherBlocks) {
	const rows = await findAll('sdform_manage', { $or: [{ _id: idPair(String(b.form_id)) }, { dataid: String(b.form_id) }] }, { limit: 1, projection: { 'form_db.schema': 1 } });
	const schema = (rows[0] && rows[0].form_db && rows[0].form_db.schema) || {};
	const map = {};
	for (const k of Object.keys(schema)) {
		const lb = schema[k] && schema[k].label;
		if (lb) map[k] = String(lb);
	}
	labelByForm[String(b.form_id)] = map;
}

// จัดลำดับความสำคัญของ field ที่เอามาโชว์ — ชื่อ field บอกความหมายได้พอสมควรในสคีมาชุดนี้
const pickScore = (key, val) => {
	const k = String(key).toLowerCase();
	if (k.indexOf('x') === 0 || k === 'dataid' || k === '_id' || k.indexOf('_by') >= 0) return 0;
	if (/(_no|_number|_code)$/.test(k) || k === 'vn' || k === 'hn') return 100; // เลขที่เอกสาร
	if (/(name|title|label|subject|topic)/.test(k)) return 90;
	if (/(total|amount|price|net)/.test(k) && typeof val === 'number') return 80;
	if (/status/.test(k)) return 70;
	if (/(date|_at)$/.test(k)) return 30; // เวลาโชว์แยกอยู่แล้ว เอาไว้ท้าย ๆ
	if (typeof val === 'string' && val.trim() && val.length < 80) return 50;
	if (val && typeof val === 'object' && val.label) return 50;
	return 10;
};

const others = otherBlocks.map((b) => {
	const labels = labelByForm[String(b.form_id)] || {};
	return {
		form_id: String(b.form_id),
		form_name: b.form_name || '',
		form_table: b.form_table || '',
		count: b.count || (Array.isArray(b.rows) ? b.rows.length : 0),
		truncated: !!b.truncated,
		rows: (Array.isArray(b.rows) ? b.rows : []).slice(0, 20).map((r) => {
			const d = r.data || {};
			const picked = Object.keys(d)
				.map((k) => ({ key: k, val: d[k], score: pickScore(k, d[k]) }))
				.filter((x) => x.score > 10 && x.val !== null && x.val !== '' && !(Array.isArray(x.val) && !x.val.length))
				.sort((a, b2) => b2.score - a.score)
				.slice(0, 4)
				.map((x) => ({
					label: labels[x.key] || x.key,
					value: typeof x.val === 'object' ? labelOf(x.val) : String(x.val),
				}))
				.filter((x) => x.value);
			return {
				data_id: r.data_id,
				at: txt(r.updated_at) || txt(r.created_at),
				by: (d.updated_by && d.updated_by.name) || (d.created_by && d.created_by.name) || '',
				fields: picked,
			};
		}),
	};
});

// ---------------------------------------------------------------- 11) ใบก่อนหน้า / ถัดไป (ปุ่ม ‹ › บนจอ)

// หมอที่อยากไล่ดูหลายครั้งไม่ต้องปิดจอแล้วกดใหม่ทีละใบ
// 🔴 ดึงรายการ visit ของคนไข้แบบเบา (projection 2 field) แล้วหาตำแหน่งเอง — ได้ทั้ง prev/next และ "ครั้งที่ x จาก y"
const nav = { prev: null, next: null, index: 0, total: 0 };
const personKey = visit.person.person_id;
if (personKey) {
	const list = await findAll(
		VISIT_TABLE,
		{ 'pid.value': idPair(personKey), xrstatx: 1 },
		{ sort: { visit_date: -1, _id: -1 }, limit: 200, projection: { visit_date: 1, vn: 1 } },
	);
	const at = list.findIndex((x) => String(x._id) === String(visit.visit_id));
	nav.total = list.length;
	if (at >= 0) {
		nav.index = at + 1; // 1 = ครั้งล่าสุด
		const brief = (r) => (r ? { visit_id: String(r._id), vn: r.vn || '', visit_date: r.visit_date || '' } : null);
		nav.next = brief(list[at - 1]); // ใหม่กว่า
		nav.prev = brief(list[at + 1]); // เก่ากว่า
	}
}

return {
	success: true,
	built,
	nav,
	visit,
	vitals,
	subjective,
	pe,
	dx,
	plan,
	consults,
	orders,
	item_groups: itemGroups,
	money,
	others,
	meta: {
		built_at: txt(emr.built_at),
		built_by: (emr.built_by && emr.built_by.name) || txt(emr.built_by),
		snapshot_at: txt(snap.snapshot_at),
		rebuild_count: numOrNull(snap.rebuild_count) || 0,
		block_count: numOrNull(snap.block_count) || blocks.length,
		row_count: numOrNull(snap.row_count) || 0,
		history_form_id: '6a954d55422c1ca959829e20',
	},
};
