/**
 * emr-lab-board-get — ใบสั่งตรวจของวิสิทที่เปิดอยู่ + ผลที่ออกวันนี้
 * ------------------------------------------------------------------
 * แยกออกจาก `emr-summary-get` (6a9574cc1812c7078a067299) โดยตั้งใจ:
 * ตัวนั้นเล่า "การรักษาครั้งก่อน" จาก snapshot ส่วนตัวนี้เล่า "วิสิทนี้สั่งอะไร ผลออกหรือยัง"
 * คนละเรื่อง คนละแหล่งข้อมูล ⇒ แยก process ให้พังแยกกันและแก้แยกกันได้
 *
 * params : { visit_id, hn?, person_id? }     visit_id = visit `_id` ของวิสิทที่เปิดอยู่
 * return : { success, current_vn, lab_orders[], xray_results[], lab_trends[] }
 *          ไม่มี visit_id ⇒ คืนค่าว่างทั้งหมด (การ์ดจะตกไปแสดงลิสต์แบบเดิมเอง)
 *
 * 🔴 ห้ามแก้ `emr-summary-get` ให้เกินกว่าการเรียก process นี้ — cc/hpi/PE/dx/ยา ของตัวนั้น
 *    ต้องคำนวณเหมือนเดิมทุกประการ และต้องคืน `lab[]`/`xray[]` เดิมต่อไป
 *    (ตรรกะเลือกแท็บเริ่มต้นในจอยังอ่านจาก 2 คีย์นั้น)
 *
 * ── สิ่งที่ค้นพบจากฐานข้อมูลจริง (ห้ามเดา · ตรวจแล้ว 2026-09-22) ────────────
 * 🔴 `zdata_lab_result_item.visit_id` และ `zdata_lab_work_item.visit_id` เก็บเป็น **VN**
 *    ("6900305") ไม่ใช่ visit `_id` ⇒ ต้องอ่าน `vn` จาก `zdata_visit` ก่อนแล้วค่อย match
 * 🔴 `zdata_xray_order.VisitNo` ก็เป็น VN และ `zdata_xray_result` ไม่มี visit
 *    ⇒ X-ray ต่อผ่าน `AccessionNo` → `zdata_xray_order.VisitNo`
 * 🔴 Work Item `_id` = CPOE Item `_id` · `source_order_id` = CPOE Order `_id`
 *    · Result Item `order_no` = Work Item `_id`
 * 🔴 ใบที่ห้องแลปยังไม่รับยังไม่มี Work Item ⇒ ตั้งต้นจาก CPOE Item
 *    ไม่งั้นใบ "ส่งแล้วรอผล" หายทั้งใบ ซึ่งคือสิ่งที่หมอต้องเห็นที่สุด
 * 🔴 "ผลออกวันนี้" นับจาก `created_at` ของ Result Item = เวลาที่ผลเข้าระบบ HIS
 *    และ "วันนี้" = `visit_date` ของวิสิทที่เปิดอยู่ ไม่ใช่วันบนนาฬิกาเครื่อง
 */

const VISIT_TABLE = 'zdata_visit';
const LAB_TABLE = 'zdata_lab_result_item';
const XRAY_TABLE = 'zdata_xray_result';

// helper ชุดเดียวกับ emr-summary-get (คัดลอกมาเพราะเป็นคนละ process คนละ scope)
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

const curVisitId = params.visit_id ? String(params.visit_id) : null;
let hn = params.hn ? String(params.hn) : null;

const WORK_ITEM_TABLE = 'zdata_lab_work_item';
const CPOE_ITEM_TABLE = 'zdata_cpoe_order_item';
const CPOE_ORDER_TABLE = 'zdata_cpoe_order';
const RESULT_REPORT_TABLE = 'zdata_lab_report_manual_entry';
const XRAY_ORDER_TABLE = 'zdata_xray_order';
const XRAY_RESULT_FORM = '6a860980f851000f28e44ab0';

const MAX_CPOE_ITEM = 200;
const MAX_RESULT_ROW = 300;
const MAX_XRAY_ROW = 60;
const TREND_POINTS = 5; // จุดสูงสุดต่อ 1 ค่าตรวจในมุมมอง "ตามค่าตรวจ"

// ลำดับความคืบหน้าของใบ — ใบทั้งใบคืบได้เท่ารายการที่ช้าที่สุดในใบ
// 🔴 `ready` มีจริงในระบบ (13 CPOE Item ตอนตรวจ 2026-09-23) และเป็นใบที่ยังไม่มี Work Item
//    ⇒ อยู่ช่วงรอห้องแลปรับ · ให้ลำดับไว้เพื่อจัดเรียง/เลือกขั้นของ stepper ได้ถูก
//    แต่ **ไม่แปลคำ** เพราะยังไม่ยืนยันความหมายทางงานจริง (จอโชว์คำดิบ)
const STAGE_RANK = { draft: 0, sent: 1, ready: 1.5, prepared: 1.6, accepted: 2, collected: 3, in_process: 4, resulted: 5, completed: 6 };
const DEAD_STAGE = { cancelled: 1, rejected: 1 };

const dayOf = (v) => String(v || '').slice(0, 10); // รับได้ทั้ง "YYYY-MM-DD HH:mm:ss" และ ISO
const nextDayOf = (d) => {
	if (!/^\d{4}-\d{2}-\d{2}/.test(String(d || ''))) return ''; // วันที่เพี้ยน → ไม่ทำช่วงวัน ดีกว่าโยน error
	const t = new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))));
	t.setUTCDate(t.getUTCDate() + 1);
	return t.toISOString().slice(0, 10);
};
const uniq = (a) => Array.from(new Set(a.filter((x) => x)));
const isNumeric = (v) => v !== '' && v != null && isFinite(Number(v));

// 🔴 `app.dbObjectId()` โยน error ถ้าค่าไม่ใช่ 24-hex — บล็อกนี้รันก่อนตรรกะเดิม
//    ถ้าปล่อยให้ throw ทั้ง process จะตาย แล้ว cc/dx/ยา/PE ที่เคยทำงานได้จะหายไปด้วย
//    ⇒ ทุกจุดที่ประกอบ id ต้องกรองรูปแบบก่อนเสมอ (ของเดิมใช้ `idPair` ตามเดิม ไม่ถูกแตะ)
const HEX24 = /^[a-f0-9]{24}$/i;
const idOne = (id) => {
	const t = String(id || '');
	return HEX24.test(t) ? { $in: [t, app.dbObjectId(t)] } : { $in: [t] };
};
const idsIn = (list) => ({
	$in: list.reduce((acc, id) => {
		const t = String(id || '');
		return acc.concat(HEX24.test(t) ? [t, app.dbObjectId(t)] : [t]);
	}, []),
});

let currentVn = '';
let currentDay = '';
let labOrders = [];
let xrayResults = [];
let labTrends = [];


if (curVisitId) {
	const curRows = await findAll(VISIT_TABLE, { _id: idOne(curVisitId), xrstatx: 1 }, { limit: 1, projection: { vn: 1, visit_date: 1, 'pid.hn': 1 } });
	const cur = curRows[0] || null;
	if (cur) {
		currentVn = String(cur.vn || '');
		currentDay = dayOf(cur.visit_date);
		if (!hn) hn = (cur.pid && cur.pid.hn) || null;
	}
}

/* ── ตัวช่วยประกอบ 1 ก้อนผล (1 ใบสั่ง × 1 section) ──────────────────────── */
// 🔴 ของจริงจาก MB/MLab: `result_value` เป็น **รายงานความเรียงทั้งใบ** (ยาว 1,500+ ตัวอักษร
//    มี \r\n เป็นตาราง S/I/R) ไม่ใช่ค่าเดี่ยว และ `is_critical` เป็น false แม้ขึ้นเชื้อดื้อยา
//    ⇒ ต้องติดธง `text` ให้จอรู้ว่าต้องแสดงเป็นบล็อกรายงาน ไม่ใช่ตัวเลขท้ายบรรทัด
//    และจอต้องไม่พับมันไปอยู่ใต้ "ค่าปกติ" เพราะ LIS ไม่ได้บอกว่าปกติ แค่ไม่ได้ตีธง
const NARRATIVE_MIN = 60; // ยาวเกินนี้หรือมีขึ้นบรรทัดใหม่ = รายงาน ไม่ใช่ค่าเดี่ยว
const CODE_ONLY = /^[0-9]+$/; // obs_name ของ MB เป็นรหัสล้วน ("4001") อ่านไม่รู้เรื่อง

const resultIdentity = (r) => String((r && (r.result_definition_id || r.obs_code || r.test_code || r.obs_name || r.test_name)) || '').trim();
const resultKeys = (r) =>
	uniq([
		resultIdentity(r),
		String((r && (r.obs_code || r.test_code)) || '').trim(),
		String((r && (r.obs_name || r.test_name)) || '').trim(),
	]);
const resultTime = (r) => String((r && (r.entered_at || r.reported_at || r.created_at || r.xupdatx)) || '');
const personName = (r, prefix) =>
	String((r && (r[prefix + '_by_source_name'] || r[prefix + '_by_name'] || r[prefix + '_by'])) || '').trim();
const previousData = (r) =>
	r
		? {
				value: r.result_value == null ? '' : String(r.result_value),
				unit: String(r.unit_symbol_snapshot || r.unit_symbol || r.units || ''),
				interpretation: String(r.interpretation_code || ''),
				reference_range: String(r.reference_range_snapshot || r.ref_range || ''),
				visit_vn: String(r.visit_id || r.visit_vn || ''),
				entered_at: resultTime(r),
		  }
		: null;

const mapResultRow = (r) => {
	const raw = r.result_value == null ? '' : String(r.result_value);
	const obs = String(r.obs_name || '').trim();
	const tst = String(r.test_name || '').trim();
	return {
		// ชื่อที่หมออ่านรู้เรื่อง — รหัสล้วนตกไปใช้ชื่อรายการที่สั่งจาก CPOE Item แทน
		name: (!CODE_ONLY.test(obs) && obs) || (!CODE_ONLY.test(tst) && tst) || String(r.__item || '') || obs || tst || '',
		code: r.obs_code || r.test_code || '',
		value: raw,
		text: raw.indexOf('\n') >= 0 || raw.length > NARRATIVE_MIN,
		unit: r.unit_symbol_snapshot || r.units || '',
		ref: r.reference_range_snapshot || r.ref_range || '',
		flag: r.interpretation_code || '',
		critical: !!r.is_critical,
		result_item_id: String(r._id || ''),
		result_report_id: String(r.result_report_id || r.xparentx || ''),
		result_comment: String(r.result_comment || ''),
		// ใช้จัดกลุ่ม Profile ใน popup EMR ให้เหมือน LAB Worklist
		// `order_no` ของ Result Item ชี้กลับไปยัง CPOE Item และ `__item` คือชื่อรายการที่สั่ง
		group_id: String(r.order_no || ''),
		group_name: String(r.__item || ''),
		result_source: String(r.result_source || ''),
		result_status: String(r.result_status || ''),
		reported_at: String(r.reported_at || r.entered_at || r.created_at || ''),
		reported_by_source_name: personName(r, 'reported'),
		verified_at: String(r.verified_at || ''),
		verified_by_source_name: personName(r, 'verified'),
		previous: previousData(r.__previous),
	};
};

// ความคืบหน้าของ 1 รายการ = ฝั่งที่ไปไกลกว่าระหว่าง CPOE Item กับ Work Item
// 🔴 CPOE `current_status` เป็น projection ที่ LAB ยิงกลับมา ⇒ อาจตามหลังของจริง
//    ใบที่ห้องแลปรับแล้ว (มี received_at) ต้องไม่ค้างแสดงว่า "ส่งแล้ว" ที่ stepper
const itemStage = (cpoeStatus, wi) => {
	const a = String(cpoeStatus || '').toLowerCase();
	const b = String((wi && wi.work_status) || '').toLowerCase();
	if (DEAD_STAGE[a]) return a;
	if (DEAD_STAGE[b]) return b;
	let best = a;
	if (STAGE_RANK[a] !== undefined && STAGE_RANK[b] !== undefined) best = STAGE_RANK[b] > STAGE_RANK[a] ? b : a;
	else if (STAGE_RANK[a] === undefined && a) best = a; // ค่าที่ไม่รู้จักต้องโผล่ตามจริง
	else if (!a) best = b;
	if (wi && wi.received_at && STAGE_RANK[best] !== undefined && STAGE_RANK[best] < STAGE_RANK.accepted) best = 'accepted';
	return best;
};

// สถานะของใบ = ขั้นที่ช้าที่สุดในบรรดารายการที่ยังไม่ตาย
const groupStatus = (stages, hasResult) => {
	const kids = stages.filter((x) => x);
	if (!kids.length) return hasResult ? 'resulted' : 'sent';
	const alive = kids.filter((k) => !DEAD_STAGE[k]);
	if (!alive.length) return kids.indexOf('rejected') >= 0 && kids.every((k) => k === 'rejected') ? 'rejected' : 'cancelled';
	// สถานะที่ไม่รู้จักต้องโผล่ตามจริง ห้ามกลบเป็นค่าปกติ — จอจะโชว์เป็นสีแดงให้เห็นว่าเพี้ยน
	const unknown = alive.find((k) => STAGE_RANK[k] === undefined);
	if (unknown) return unknown;
	const slowest = alive.slice().sort((a, b) => STAGE_RANK[a] - STAGE_RANK[b])[0];
	// มีผลจริงแล้วแต่สถานะ CPOE ยังตามไม่ทัน ⇒ ห้ามซ่อนค่าผลไว้หลัง stepper
	return hasResult && STAGE_RANK[slowest] < STAGE_RANK.resulted ? 'resulted' : slowest;
};

const buildGroup = (g) => {
	const rows = g.rows.slice().sort((a, b) => String(a.result_sequence || '').localeCompare(String(b.result_sequence || '')));
	const resultedAt = g.rows.reduce((mx, r) => (String(r.created_at || '') > mx ? String(r.created_at) : mx), '');
	const reports = Array.isArray(g.reports) ? g.reports : [];
	const metaRows = rows.concat(reports).sort((a, b) => resultTime(b).localeCompare(resultTime(a)));
	const firstMeta = (field, prefix) => {
		const found = metaRows.find((r) => (prefix ? personName(r, prefix) : String((r && r[field]) || '').trim()));
		return found ? (prefix ? personName(found, prefix) : String(found[field] || '')) : '';
	};
	const attachments = [];
	const attachmentSeen = {};
	reports.forEach((report) => {
		(Array.isArray(report.result_attachments) ? report.result_attachments : []).forEach((file) => {
			const key = String((file && (file.uid || file.url || file.name)) || '');
			if (!key || attachmentSeen[key]) return;
			attachmentSeen[key] = true;
			attachments.push(file);
		});
	});
	return {
		order_id: g.key,
		source_order_id: g.source_order_id || '',
		order_no: g.order_no || '',
		// ยังไม่รู้ section (ห้องแลปยังไม่รับ) ⇒ ใบรายการเดียวใช้ชื่อรายการที่สั่ง หมอจะได้รู้ว่าสั่งอะไรไป
		section: g.section || (g.names && g.names.length === 1 ? g.names[0] : 'ใบสั่งตรวจ'),
		// section_code ไว้ให้จอตัดสินว่าใบนี้ใช้ Report ผลตัวไหน (micro ยังไม่มี Report จริง)
		section_code: g.section_code || '',
		// Report ผล PDF ผูกกับ Result Report ไม่ใช่ใบสั่ง ⇒ ส่ง id ที่พบทั้งหมดให้จอเป็นคนตัดสิน
		// (ชุดผลหลายชุดในใบเดียว = พิมพ์ชุดเดียวไม่ได้ ตามกติกาเดียวกับ LAB Worklist)
		result_report_ids: uniq(g.rows.map((r) => String(r.result_report_id || ''))),
		lab_no: g.lab_no || '',
		patient_hn: String(hn || ''),
		status: groupStatus(g.stages, g.rows.length > 0),
		scope: g.scope,
		ordered_at: g.ordered_at || '',
		resulted_at: resultedAt,
		received_at: g.received_at || '',
		collected_at: '',
		in_process_at: '',
		cancel_reason: g.cancel_reason || '',
		reported_at: firstMeta('reported_at'),
		reported_by_source_name: firstMeta('', 'reported'),
		verified_at: firstMeta('verified_at'),
		verified_by_source_name: firstMeta('', 'verified'),
		attachments,
		items: rows.map(mapResultRow),
	};
};

if (currentVn) {
	const RESULT_FIELDS = {
		obs_name: 1, obs_code: 1, test_name: 1, test_code: 1, result_value: 1, unit_symbol_snapshot: 1, units: 1,
		reference_range_snapshot: 1, ref_range: 1, interpretation_code: 1, is_critical: 1, result_status: 1,
		result_sequence: 1, result_definition_id: 1, result_comment: 1, result_source: 1, result_version: 1, obx_status: 1,
		order_no: 1, filler_order_no: 1, lab_section: 1, visit_id: 1, created_at: 1, entered_at: 1, xupdatx: 1,
		result_report_id: 1, xparentx: 1, reported_at: 1, reported_by_source_id: 1, reported_by_source_name: 1,
		verified_at: 1, verified_by_source_id: 1, verified_by_source_name: 1,
	};
	const groups = {}; // key -> ก้อน
	const touch = (key, seed) => {
		if (!groups[key]) groups[key] = Object.assign({ key, rows: [], reports: [], item_ids: [], stages: [], names: [], scope: 'visit' }, seed);
		return groups[key];
	};

	/* ── ① ใบสั่ง LAB ของวิสิทนี้ — ตั้งต้นจาก CPOE Item เพื่อให้ใบที่ยังรอผลไม่หาย ── */
	const cpoeItems = await findAll(
		CPOE_ITEM_TABLE,
		{ 'order_id.xtbxlv2_xfx_id': idOne(curVisitId), xrstatx: 1 },
		{ sort: { _id: 1 }, limit: MAX_CPOE_ITEM },
	);
	const labItems = cpoeItems.filter((r) => String(codeOf(r.service_type) || '').toLowerCase() === 'lab');

	if (labItems.length) {
		const orderIds = uniq(labItems.map((r) => String(codeOf(r.order_id) || '')));
		const orderRows = orderIds.length
			? await findAll(CPOE_ORDER_TABLE, { _id: idsIn(orderIds), xrstatx: 1 }, { limit: orderIds.length, projection: { order_number: 1, created_at: 1, current_status: 1, order_to_location: 1 } })
			: [];
		const orderById = {};
		orderRows.forEach((o) => {
			orderById[String(o._id)] = o;
		});

		// Work Item ของ VN นี้ — `_id` ตรงกับ CPOE Item `_id`
		const workRows = await findAll(
			WORK_ITEM_TABLE,
			{ visit_id: String(currentVn), xrstatx: 1 },
			{ limit: MAX_CPOE_ITEM, projection: { lab_no: 1, section_code: 1, section_name: 1, work_status: 1, received_at: 1, ordered_at: 1, source_order_id: 1, source_order_number: 1, cancel_reason: 1, reject_reason_detail: 1 } },
		);
		const workByItem = {};
		workRows.forEach((w) => {
			workByItem[String(w._id)] = w;
		});

		const resultRows = await findAll(LAB_TABLE, { visit_id: String(currentVn), xrstatx: 1 }, { sort: { _id: 1 }, limit: MAX_RESULT_ROW, projection: RESULT_FIELDS });
		const resultByOrderNo = {};
		resultRows.forEach((r) => {
			const k = String(r.order_no || '');
			if (!resultByOrderNo[k]) resultByOrderNo[k] = [];
			resultByOrderNo[k].push(r);
		});

		labItems.forEach((it) => {
			const itemId = String(it._id);
			const wi = workByItem[itemId] || null;
			const orderId = String(codeOf(it.order_id) || '');
			const order = orderById[orderId] || null;
			const sectionCode = (wi && wi.section_code) || '';
			const g = touch(orderId + '|' + sectionCode, {
				source_order_id: orderId,
				section_code: sectionCode,
				order_no: (order && order.order_number) || (wi && wi.source_order_number) || '',
				// 🔴 ห้ามเอา `order_to_location` มาเป็นชื่อห้องแลป — ของจริงในใบ LAB คือ "m01.p ห้องยาพรีเมี่ยม"
				//    (ช่องนั้นเป็นปลายทางของใบ ไม่ใช่ section ของแลป) ⇒ ยังไม่มี Work Item = ยังไม่รู้ section
				section: (wi && (wi.section_name || wi.section_code)) || '',
				lab_no: (wi && wi.lab_no) || '',
				ordered_at: (order && order.created_at) || (wi && wi.ordered_at) || it.created_at || '',
				received_at: (wi && wi.received_at) || '',
				cancel_reason: (wi && (wi.cancel_reason || wi.reject_reason_detail)) || '',
			});
			if (!g.lab_no && wi && wi.lab_no) g.lab_no = wi.lab_no;
			if (!g.received_at && wi && wi.received_at) g.received_at = wi.received_at;
			if (!g.cancel_reason && wi && (wi.cancel_reason || wi.reject_reason_detail)) g.cancel_reason = wi.cancel_reason || wi.reject_reason_detail;
			g.stages.push(itemStage(codeOf(it.current_status), wi));
			if (g.item_ids.indexOf(itemId) < 0) g.item_ids.push(itemId);
			if (it.item_name) g.names.push(String(it.item_name));
			// ชื่อรายการที่สั่งติดไปกับผล — ใช้ตอน obs_name เป็นรหัสล้วน
			(resultByOrderNo[itemId] || []).forEach((r) => {
				r.__item = it.item_name || '';
				g.rows.push(r);
			});
		});
	}

	/* ── ② ผลที่เข้าระบบ "วันของวิสิทนี้" แต่มาจาก VN อื่น (สั่งไว้ครั้งก่อน) ── */
	const dayEnd = nextDayOf(currentDay);
	if (hn && currentDay && dayEnd) {
		const todayRows = await findAll(
			LAB_TABLE,
			{ hn: String(hn), created_at: { $gte: currentDay, $lt: dayEnd }, xrstatx: 1 },
			{ sort: { _id: 1 }, limit: MAX_RESULT_ROW, projection: RESULT_FIELDS },
		);
		const foreign = todayRows.filter((r) => String(r.visit_id || '') !== String(currentVn));
		const wiIds = uniq(foreign.map((r) => String(r.order_no || '')));
		if (wiIds.length) {
			const wRows = await findAll(
				WORK_ITEM_TABLE,
				{ _id: idsIn(wiIds), xrstatx: 1 },
				{ limit: wiIds.length, projection: { lab_no: 1, section_code: 1, section_name: 1, work_status: 1, received_at: 1, ordered_at: 1, source_order_id: 1, source_order_number: 1, visit_id: 1 } },
			);
			const wById = {};
			wRows.forEach((w) => {
				wById[String(w._id)] = w;
			});
			const oIds = uniq(wRows.map((w) => String(w.source_order_id || '')));
			const oRows = oIds.length
				? await findAll(CPOE_ORDER_TABLE, { _id: idsIn(oIds), xrstatx: 1 }, { limit: oIds.length, projection: { order_number: 1, created_at: 1 } })
				: [];
			const oById = {};
			oRows.forEach((o) => {
				oById[String(o._id)] = o;
			});
			// ชื่อรายการที่สั่ง (Work Item `_id` = CPOE Item `_id`) — ใช้แทน obs_name ที่เป็นรหัสล้วน
			const nameRows = await findAll(CPOE_ITEM_TABLE, { _id: idsIn(wiIds), xrstatx: 1 }, { limit: wiIds.length, projection: { item_name: 1 } });
			const itemNameById = {};
			nameRows.forEach((n) => {
				itemNameById[String(n._id)] = n.item_name || '';
			});

			foreign.forEach((r) => {
				const wi = wById[String(r.order_no || '')] || null;
				const order = (wi && oById[String(wi.source_order_id || '')]) || null;
				const key = 'today|' + String((wi && wi.source_order_id) || r.order_no) + '|' + String((wi && wi.section_code) || r.lab_section || '');
				const g = touch(key, {
					scope: 'today',
					source_order_id: String((wi && wi.source_order_id) || ''),
					section_code: String((wi && wi.section_code) || r.lab_section || ''),
					order_no: (order && order.order_number) || (wi && wi.source_order_number) || '',
					section: (wi && (wi.section_name || wi.section_code)) || r.lab_section || 'Lab',
					lab_no: (wi && wi.lab_no) || r.filler_order_no || '',
					ordered_at: (order && order.created_at) || (wi && wi.ordered_at) || '',
					received_at: (wi && wi.received_at) || '',
					cancel_reason: '',
				});
				g.scope = 'today';
				if (g.item_ids.indexOf(String(r.order_no || '')) < 0) g.item_ids.push(String(r.order_no || ''));
				r.__item = itemNameById[String(r.order_no || '')] || '';
				g.rows.push(r);
			});
		}
	}

	/* ── เติมค่าก่อนหน้า + metadata/ไฟล์แนบ เพื่อให้ EMR เปิด popup ผลทั้งใบแบบเดียวกับ LAB ── */
	let resultHistory = [];
	if (hn) {
		resultHistory = await findAll(LAB_TABLE, { hn: String(hn), xrstatx: 1 }, { sort: { entered_at: -1, _id: -1 }, limit: 1000, projection: RESULT_FIELDS });
		const currentIds = {};
		const currentOrderNos = {};
		Object.keys(groups).forEach((key) => {
			groups[key].rows.forEach((r) => {
				currentIds[String(r._id || '')] = true;
				currentOrderNos[String(r.order_no || '')] = true;
			});
		});
		const finalHistory = resultHistory.filter((r) => {
			if (currentIds[String(r._id || '')] || currentOrderNos[String(r.order_no || '')]) return false;
			const st = String(r.result_status || '').toLowerCase();
			const obx = String(r.obx_status || '').toUpperCase();
			return ['final', 'corrected', 'completed', 'resulted'].indexOf(st) >= 0 || ['F', 'C'].indexOf(obx) >= 0;
		});
		Object.keys(groups).forEach((key) => {
			groups[key].rows.forEach((r) => {
				const keys = resultKeys(r);
				r.__previous =
					finalHistory.find((old) => resultKeys(old).some((key) => keys.indexOf(key) >= 0) && resultTime(old) < resultTime(r)) || null;
			});
		});
	}

	const allGroups = Object.keys(groups).map((key) => groups[key]);
	const reportIds = uniq(allGroups.reduce((acc, g) => acc.concat(g.rows.map((r) => String(r.result_report_id || r.xparentx || ''))), []));
	const itemIds = uniq(allGroups.reduce((acc, g) => acc.concat(g.item_ids || []), []));
	const reportKeys = uniq(
		allGroups.reduce((acc, g) => {
			const keys = (g.item_ids || []).map((id) => 'attachment|' + id);
			if (g.source_order_id && g.section_code) keys.push('attachment-order|' + g.source_order_id + '|' + g.section_code);
			return acc.concat(keys);
		}, []),
	);
	const reportOr = [];
	if (reportIds.length) reportOr.push({ _id: idsIn(reportIds) });
	if (itemIds.length) reportOr.push({ order_no: { $in: itemIds } });
	if (reportKeys.length) reportOr.push({ report_key: { $in: reportKeys } });
	if (reportOr.length) {
		const reportRows = await findAll(
			RESULT_REPORT_TABLE,
			{ $or: reportOr, xrstatx: 1 },
			{
				sort: { xupdatx: -1 },
				limit: Math.max(100, reportOr.length * 20),
				projection: {
					order_no: 1, filler_order_no: 1, report_key: 1, result_uid: 1, result_attachments: 1,
					reported_at: 1, reported_by_source_id: 1, reported_by_source_name: 1,
					verified_at: 1, verified_by_source_id: 1, verified_by_source_name: 1, xupdatx: 1,
				},
			},
		);
		allGroups.forEach((g) => {
			const wantedIds = {};
			g.rows.forEach((r) => {
				wantedIds[String(r.result_report_id || r.xparentx || '')] = true;
			});
			const wantedOrders = {};
			(g.item_ids || []).forEach((id) => {
				wantedOrders[String(id)] = true;
			});
			const wantedKeys = {};
			(g.item_ids || []).forEach((id) => {
				wantedKeys['attachment|' + id] = true;
			});
			if (g.source_order_id && g.section_code) wantedKeys['attachment-order|' + g.source_order_id + '|' + g.section_code] = true;
			g.reports = reportRows.filter((report) => wantedIds[String(report._id || '')] || wantedOrders[String(report.order_no || '')] || wantedKeys[String(report.report_key || '')]);
			g.rows.forEach((row) => {
				const parent = g.reports.find((report) => String(report._id || '') === String(row.result_report_id || row.xparentx || '')) || g.reports.find((report) => String(report.order_no || '') === String(row.order_no || ''));
				if (!parent) return;
				if (!row.reported_at) row.reported_at = parent.reported_at;
				if (!row.reported_by_source_name) row.reported_by_source_name = parent.reported_by_source_name;
				if (!row.verified_at) row.verified_at = parent.verified_at;
				if (!row.verified_by_source_name) row.verified_by_source_name = parent.verified_by_source_name;
			});
		});
	}

	labOrders = Object.keys(groups).map((k) => buildGroup(groups[k]));
	// ใบที่ยังรอผลขึ้นก่อน (สิ่งที่ยังค้าง = สิ่งที่หมอต้องจัดการ) · ใบที่ตายแล้วลงท้ายสุด
	const sortRank = (o) => (DEAD_STAGE[o.status] ? 2 : o.resulted_at ? 1 : 0);
	labOrders.sort((a, b) => {
		const ra = sortRank(a);
		const rb = sortRank(b);
		if (ra !== rb) return ra - rb;
		return String(b.ordered_at).localeCompare(String(a.ordered_at));
	});

	/* ── ③ แนวโน้มของค่าที่อยู่ในสองกลุ่มข้างบน ─────────────────────────── */
	if (hn) {
		const names = uniq(labOrders.reduce((acc, o) => acc.concat(o.items.map((i) => i.name)), []));
		if (names.length) {
			const byName = {};
			resultHistory.forEach((r) => {
				const n = r.obs_name || r.test_name || '';
				if (!n || !isNumeric(r.result_value)) return;
				if (!byName[n]) byName[n] = { name: n, unit: r.unit_symbol_snapshot || r.units || '', ref: r.reference_range_snapshot || r.ref_range || '', flag: r.interpretation_code || '', series: [] };
				byName[n].series.push({ when: String(r.created_at || ''), value: Number(r.result_value) });
			});
			labTrends = Object.keys(byName)
				.map((n) => {
					const t = byName[n];
					t.series.sort((a, b) => String(a.when).localeCompare(String(b.when)));
					t.series = t.series.slice(-TREND_POINTS);
					return t;
				})
				.filter((t) => t.series.length >= 2); // จุดเดียวไม่ใช่แนวโน้ม
		}
	}

	/* ── ④ X-ray — ต่อผ่าน AccessionNo เพราะตารางผลไม่มี visit ──────────── */
	const sevOf = (v) => {
		const t = String(v == null ? '' : v).trim();
		if (!t) return '';
		const u = t.toUpperCase();
		if (u === 'NORMAL') return 'ปกติ';
		if (u === 'ABNORMAL') return 'ผิดปกติ';
		return t; // ค่าที่ไม่รู้จักโชว์ดิบ ดีกว่าแปลผิด
	};
	const XO_FIELDS = { AccessionNo: 1, ExamName: 1, VisitNo: 1, Status: 1, created_at: 1 };
	const XR_FIELDS = { AccessionNo: 1, ExamName: 1, ResultText: 1, ResultDateTime: 1, SeverityUid: 1, Status: 1, ImageCapturedDateTime: 1 };

	const xrayOrders = await findAll(XRAY_ORDER_TABLE, { VisitNo: String(currentVn), xrstatx: 1 }, { sort: { _id: -1 }, limit: MAX_XRAY_ROW, projection: XO_FIELDS });
	const accNow = uniq(xrayOrders.map((o) => String(o.AccessionNo || '')));

	// ผลที่เข้าระบบวันของวิสิทนี้ (ResultDateTime มีทั้งรูป ISO และ "YYYY-MM-DD HH:mm:ss" ⇒ กรองด้วย prefix ใน JS)
	const xrayMine = hn ? await findAll(XRAY_TABLE, { Hn: String(hn), xrstatx: 1 }, { sort: { _id: -1 }, limit: MAX_XRAY_ROW, projection: XR_FIELDS }) : [];
	const xrayToday = currentDay ? xrayMine.filter((r) => dayOf(r.ResultDateTime) === currentDay) : [];

	const accAll = uniq(accNow.concat(xrayToday.map((r) => String(r.AccessionNo || ''))));
	const resultRowsX = accAll.length
		? await findAll(XRAY_TABLE, { AccessionNo: { $in: accAll }, xrstatx: 1 }, { sort: { _id: -1 }, limit: MAX_XRAY_ROW, projection: XR_FIELDS })
		: [];
	const resultByAcc = {};
	resultRowsX.forEach((r) => {
		const a = String(r.AccessionNo || '');
		if (!resultByAcc[a] || String(r.ResultDateTime || '') > String(resultByAcc[a].ResultDateTime || '')) resultByAcc[a] = r; // เอาผลล่าสุดของ accession นั้น
	});

	const otherAcc = uniq(xrayToday.map((r) => String(r.AccessionNo || '')).filter((a) => accNow.indexOf(a) < 0));
	const otherOrders = otherAcc.length
		? await findAll(XRAY_ORDER_TABLE, { AccessionNo: { $in: otherAcc }, xrstatx: 1 }, { limit: otherAcc.length, projection: XO_FIELDS })
		: [];
	const orderByAcc = {};
	xrayOrders.concat(otherOrders).forEach((o) => {
		orderByAcc[String(o.AccessionNo || '')] = o;
	});

	const mkXray = (acc, scope) => {
		const o = orderByAcc[acc] || null;
		const r = resultByAcc[acc] || null;
		return {
			key: acc,
			exam_name: (o && o.ExamName) || (r && r.ExamName) || 'X-ray',
			accession_no: acc,
			scope: scope,
			ordered_at: (o && o.created_at) || '',
			resulted_at: (r && r.ResultDateTime) || '',
			severity: sevOf(r && r.SeverityUid),
			result_text: (r && r.ResultText) || '',
			form_id: XRAY_RESULT_FORM,
			data_id: r ? String(r._id) : '',
		};
	};
	xrayResults = accNow.map((a) => mkXray(a, 'visit')).concat(otherAcc.map((a) => mkXray(a, 'today')));
}

return {
	success: true,
	current_vn: currentVn,
	lab_orders: labOrders,
	xray_results: xrayResults,
	lab_trends: labTrends,
};
