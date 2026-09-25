/* ══════════════════════════════════════════════════════════════════════════
   emr-summary-get · ส่วนต่อขยาย "ใบสั่งตรวจของวิสิทนี้ + ผลที่ออกวันนี้"
   Process ID 6a9574cc1812c7078a067299  (his.module_api · field `api_process`)

   ── วิธีติดตั้ง (แตะของเดิม 3 จุด ทุกจุดเป็นการ "เพิ่ม" ไม่ใช่แก้) ──────────
   ① วางบล็อกนี้ทั้งก้อน **เหนือบรรทัด**
        // ------- 1) หา visit ก่อนหน้า (ใบล่าสุดใบเดียว)
      (ต้องอยู่เหนือ early-return ของ `if (!prev)` ไม่งั้นคนไข้ที่ไม่มีวิสิทเก่าจะไม่ได้ข้อมูลนี้)
   ② ใน early-return ของ `if (!prev)` เติม 4 คีย์ท้ายสุด:
        , current_vn: currentVn, lab_orders: labOrders, xray_results: xrayResults, lab_trends: labTrends
   ③ ใน return ก้อนสุดท้าย เติม 4 คีย์เดียวกัน

   🔴 ไม่แตะโค้ดเดิมแม้แต่บรรทัดเดียว — cc/hpi/pe/dx/meds/other/plan/lab/xray/built
      ยังคำนวณและคืนค่าเหมือนเดิมทุกประการ (การ์ดเวอร์ชันเก่ายังใช้ `lab[]`/`xray[]` อยู่
      และตรรกะเลือกแท็บเริ่มต้นในจอก็ยังอ่านจาก 2 คีย์นั้น ⇒ ห้ามตัดทิ้ง)

   ── สิ่งที่ค้นพบจากฐานข้อมูลจริง (ห้ามเดา · ตรวจแล้ว 2026-09-22) ────────────
   🔴 `zdata_lab_result_item.visit_id` และ `zdata_lab_work_item.visit_id`
      เก็บเป็น **VN** ("6900305") ไม่ใช่ visit `_id` — คนละค่ากับ params.visit_id
      ⇒ ต้องอ่าน `vn` ของวิสิทที่เปิดอยู่จาก `zdata_visit` ก่อน แล้วค่อย match
   🔴 `zdata_xray_order.VisitNo` ก็เป็น VN เช่นกัน และ `zdata_xray_result` ไม่มี visit
      ⇒ X-ray ต้องต่อผ่าน `AccessionNo` → `zdata_xray_order.VisitNo`
   🔴 Work Item `_id` = CPOE Item `_id` · `source_order_id` = CPOE Order `_id`
      · Result Item `order_no` = Work Item `_id`
   🔴 ใบที่ห้องแลปยังไม่รับ **ยังไม่มี Work Item** ⇒ ต้องตั้งต้นจาก CPOE Item
      ไม่งั้นใบที่ "ส่งแล้วรอผล" จะหายไปทั้งใบ ซึ่งคือสิ่งที่หมอต้องเห็นที่สุด
   🔴 "ผลออกวันนี้" นับจาก `created_at` ของ Result Item = เวลาที่ผลเข้าระบบ HIS
      (ไม่ใช่ `entered_at` ซึ่งเป็นเวลาฝั่ง LIS และเป็น ISO คนละรูปแบบ)
   🔴 "วันนี้" = วันของวิสิทที่เปิดอยู่ (`visit_date`) ไม่ใช่วันบนนาฬิกาเครื่อง
      VN เปิดวันต่อวัน ⇒ ปกติเป็นวันเดียวกัน แต่เปิดวิสิทเก่าย้อนหลังจะไม่มีผลวันนี้ปนเข้ามา
   ══════════════════════════════════════════════════════════════════════════ */

const WORK_ITEM_TABLE = 'zdata_lab_work_item';
const CPOE_ITEM_TABLE = 'zdata_cpoe_order_item';
const CPOE_ORDER_TABLE = 'zdata_cpoe_order';
const XRAY_ORDER_TABLE = 'zdata_xray_order';
const LAB_ITEM_FORM = '6a8bc91df851000f28e501fb'; // Result Item — ปุ่ม "ดูผลทั้งใบ"
const XRAY_RESULT_FORM = '6a860980f851000f28e44ab0';

const MAX_CPOE_ITEM = 200;
const MAX_RESULT_ROW = 300;
const MAX_XRAY_ROW = 60;
const TREND_POINTS = 5; // จุดสูงสุดต่อ 1 ค่าตรวจในมุมมอง "ตามค่าตรวจ"

// ลำดับความคืบหน้าของใบ — ใบทั้งใบคืบได้เท่ารายการที่ช้าที่สุดในใบ
const STAGE_RANK = { draft: 0, sent: 1, accepted: 2, collected: 3, in_process: 4, resulted: 5, completed: 6 };
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

// 🔴 ใช้ boardHn แยกจาก hn ของเดิม — ไม่แตะลำดับการเติมค่า hn ที่โค้ดเดิมพึ่งอยู่
let boardHn = hn;

/* 🔴 ทั้งบล็อกนี้รัน **ก่อน** ตรรกะเดิม ⇒ ถ้ามันโยน error ขึ้นมา process จะตายทั้งตัว
   แล้ว cc / hpi / PE / วินิจฉัย / ยา / หัตถการ ที่เคยทำงานได้จะหายไปด้วย
   ⇒ ครอบ try ไว้: ของใหม่พังได้ แต่ห้ามลากของเดิมพังไปด้วย
      พังเมื่อไหร่ = คืน array ว่าง = การ์ดตกไปแสดงลิสต์แบบเดิมเหมือนไม่มีฟีเจอร์นี้ */
try {

if (curVisitId) {
	const curRows = await findAll(VISIT_TABLE, { _id: idOne(curVisitId), xrstatx: 1 }, { limit: 1, projection: { vn: 1, visit_date: 1, 'pid.hn': 1 } });
	const cur = curRows[0] || null;
	if (cur) {
		currentVn = String(cur.vn || '');
		currentDay = dayOf(cur.visit_date);
		if (!boardHn) boardHn = (cur.pid && cur.pid.hn) || null;
	}
}

/* ── ตัวช่วยประกอบ 1 ก้อนผล (1 ใบสั่ง × 1 section) ──────────────────────── */
// 🔴 ของจริงจาก MB/MLab: `result_value` เป็น **รายงานความเรียงทั้งใบ** (ยาว 1,500+ ตัวอักษร
//    มี \r\n เป็นตาราง S/I/R) ไม่ใช่ค่าเดี่ยว และ `is_critical` เป็น false แม้ขึ้นเชื้อดื้อยา
//    ⇒ ต้องติดธง `text` ให้จอรู้ว่าต้องแสดงเป็นบล็อกรายงาน ไม่ใช่ตัวเลขท้ายบรรทัด
//    และจอต้องไม่พับมันไปอยู่ใต้ "ค่าปกติ" เพราะ LIS ไม่ได้บอกว่าปกติ แค่ไม่ได้ตีธง
const NARRATIVE_MIN = 60; // ยาวเกินนี้หรือมีขึ้นบรรทัดใหม่ = รายงาน ไม่ใช่ค่าเดี่ยว
const CODE_ONLY = /^[0-9]+$/; // obs_name ของ MB เป็นรหัสล้วน ("4001") อ่านไม่รู้เรื่อง

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
		form_id: LAB_ITEM_FORM,
		data_id: String(r._id),
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
	return {
		order_id: g.key,
		order_no: g.order_no || '',
		section: g.section || 'Lab',
		// section_code ไว้ให้จอตัดสินว่าใบนี้ใช้ Report ผลตัวไหน (micro ยังไม่มี Report จริง)
		section_code: g.section_code || '',
		// Report ผล PDF ผูกกับ Result Report ไม่ใช่ใบสั่ง ⇒ ส่ง id ที่พบทั้งหมดให้จอเป็นคนตัดสิน
		// (ชุดผลหลายชุดในใบเดียว = พิมพ์ชุดเดียวไม่ได้ ตามกติกาเดียวกับ LAB Worklist)
		result_report_ids: uniq(g.rows.map((r) => String(r.result_report_id || ''))),
		lab_no: g.lab_no || '',
		status: groupStatus(g.stages, g.rows.length > 0),
		scope: g.scope,
		ordered_at: g.ordered_at || '',
		resulted_at: resultedAt,
		received_at: g.received_at || '',
		collected_at: '',
		in_process_at: '',
		cancel_reason: g.cancel_reason || '',
		view_form_id: '',
		view_data_id: '',
		items: rows.map(mapResultRow),
	};
};

if (currentVn) {
	const RESULT_FIELDS = {
		obs_name: 1, obs_code: 1, test_name: 1, test_code: 1, result_value: 1, unit_symbol_snapshot: 1, units: 1,
		reference_range_snapshot: 1, ref_range: 1, interpretation_code: 1, is_critical: 1, result_status: 1,
		result_sequence: 1, order_no: 1, filler_order_no: 1, lab_section: 1, visit_id: 1, created_at: 1, entered_at: 1, result_report_id: 1,
	};
	const groups = {}; // key -> ก้อน
	const touch = (key, seed) => {
		if (!groups[key]) groups[key] = Object.assign({ key, rows: [], stages: [], scope: 'visit' }, seed);
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
				section_code: sectionCode,
				order_no: (order && order.order_number) || (wi && wi.source_order_number) || '',
				section: (wi && (wi.section_name || wi.section_code)) || labelOf(order && order.order_to_location) || 'Lab',
				lab_no: (wi && wi.lab_no) || '',
				ordered_at: (order && order.created_at) || (wi && wi.ordered_at) || it.created_at || '',
				received_at: (wi && wi.received_at) || '',
				cancel_reason: (wi && (wi.cancel_reason || wi.reject_reason_detail)) || '',
			});
			if (!g.lab_no && wi && wi.lab_no) g.lab_no = wi.lab_no;
			if (!g.received_at && wi && wi.received_at) g.received_at = wi.received_at;
			if (!g.cancel_reason && wi && (wi.cancel_reason || wi.reject_reason_detail)) g.cancel_reason = wi.cancel_reason || wi.reject_reason_detail;
			g.stages.push(itemStage(codeOf(it.current_status), wi));
			// ชื่อรายการที่สั่งติดไปกับผล — ใช้ตอน obs_name เป็นรหัสล้วน
			(resultByOrderNo[itemId] || []).forEach((r) => {
				r.__item = it.item_name || '';
				g.rows.push(r);
			});
		});
	}

	/* ── ② ผลที่เข้าระบบ "วันของวิสิทนี้" แต่มาจาก VN อื่น (สั่งไว้ครั้งก่อน) ── */
	const dayEnd = nextDayOf(currentDay);
	if (boardHn && currentDay && dayEnd) {
		const todayRows = await findAll(
			LAB_TABLE,
			{ hn: String(boardHn), created_at: { $gte: currentDay, $lt: dayEnd }, xrstatx: 1 },
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
					section_code: String((wi && wi.section_code) || r.lab_section || ''),
					order_no: (order && order.order_number) || (wi && wi.source_order_number) || '',
					section: (wi && (wi.section_name || wi.section_code)) || r.lab_section || 'Lab',
					lab_no: (wi && wi.lab_no) || r.filler_order_no || '',
					ordered_at: (order && order.created_at) || (wi && wi.ordered_at) || '',
					received_at: (wi && wi.received_at) || '',
					cancel_reason: '',
				});
				g.scope = 'today';
				r.__item = itemNameById[String(r.order_no || '')] || '';
				g.rows.push(r);
			});
		}
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
	if (boardHn) {
		const names = uniq(labOrders.reduce((acc, o) => acc.concat(o.items.map((i) => i.name)), []));
		if (names.length) {
			const hist = await findAll(
				LAB_TABLE,
				{ hn: String(boardHn), test_name: { $in: names }, xrstatx: 1 },
				{ sort: { _id: -1 }, limit: MAX_RESULT_ROW, projection: RESULT_FIELDS },
			);
			const byName = {};
			hist.forEach((r) => {
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
	const xrayMine = boardHn ? await findAll(XRAY_TABLE, { Hn: String(boardHn), xrstatx: 1 }, { sort: { _id: -1 }, limit: MAX_XRAY_ROW, projection: XR_FIELDS }) : [];
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
} catch (boardErr) {
	// ของใหม่ล้ม → ล้างค่าให้สะอาด แล้วปล่อยให้ตรรกะเดิมเดินต่อตามปกติ
	currentVn = '';
	labOrders = [];
	xrayResults = [];
	labTrends = [];
	app.log.warn('[emr-summary] lab/xray board ล้ม: ' + ((boardErr && boardErr.message) || boardErr));
}
