/**
 * cpoe-order-send — ส่งใบสั่งยาให้ห้องยา (draft → sent)
 *
 * เรียกจาก: การ์ดใบสั่งยาในหน้า EMR → ปุ่ม "ส่งใบสั่งยา" (widget order_card)
 *
 * params:
 *   order_id          required  _id ของใบที่จะส่ง
 *   reason?           optional  หมายเหตุการส่ง — เก็บใน status_stage[].stage_reason
 *   override_reason?  optional  เหตุผลที่หมอยืนยันส่งทั้งที่ติดคำเตือนระดับห้ามสั่ง (≥ 10 ตัวอักษร)
 *                               ไม่ส่งมา = พฤติกรรมเดิมทุกอย่าง (ติด block แล้วตีกลับ)
 *   confirm_dup?      optional  true = หมอยืนยันส่งแลปซ้ำแล้ว (ซ้ำใน visit นี้ §1.6 หรือยังไม่พ้น repeat_days §1.7)
 *                               ไม่ส่งมา + เจอซ้ำ = ตีกลับ code DUP_LAB พร้อม duplicates[] ให้จอขึ้น popup
 *
 * return: { success, message, order_id, order_number, current_status, order_to_location, item_updated,
 *           overridden?: [{ item_name, rule, message }] }
 *
 * 🔴 หลักการที่ยึดไว้ (อย่าเผลอแก้ให้ "ง่ายขึ้น"):
 *   1. **guard สถานะอยู่ใน filter ของ update ไม่ใช่ `if` ข้างบน** — สองจอกดพร้อมกัน/กดรัว
 *      `if` ผ่านทั้งคู่แล้วเขียนทับกัน · filter ไม่ match = ตัวที่สองตีกลับ ไม่มีอะไรถูกแก้
 *   2. **ตรวจความปลอดภัยยาใหม่ที่ด่านนี้ ไม่อ่าน `alert_flags` ที่ค้างในใบ** — ระหว่างใบเป็นร่าง
 *      หมอคนอื่นอาจสั่งใบใหม่ให้คนไข้คนเดียวกัน กฎ `duplicate` เทียบข้ามใบ ⇒ ผลเดิมเชื่อไม่ได้
 *      (หลักเดียวกับที่ order-save คิดราคาใหม่เสมอ) · ตรวจไม่สำเร็จ = **ตีกลับ**
 *      ต่างจากตอน save ที่ยอมให้ผ่าน เพราะนี่คือด่านสุดท้ายก่อนยาออกจริง (D8.3)
 *   3. **ไม่เขียนทับ `alert_flags` ของรายการ** — นั่นคือบันทึกว่า "ตอนสั่งหมอเห็นอะไร"
 *      เจอ block ตอนส่ง = ตีกลับให้หมอแก้แล้วบันทึกใหม่ (order-save จะ refresh ธงให้เอง)
 *   4. **ปลายทางมาจาก mapping ที่ห้องยาตั้งเอง** — `stock_location.serve_units[]` ประกาศว่า
 *      คลังนั้นรับใบจากคลินิกไหนบ้าง ⇒ เพิ่มห้องจ่ายใหม่ = ตั้งค่าในฟอร์ม ไม่ต้องแตะโค้ด
 *      หาไม่เจอ = **ตีกลับ ห้าม fallback เงียบ** — ยาไปผิดห้องอันตรายกว่าส่งไม่ออก
 *   5. ค่าที่ลงใบเป็น **หน่วยงาน (`org_unit`) ไม่ใช่รหัสคลัง** — ฝั่งห้องยาแปลงกลับเป็นคลังเองตอนตัด stock
 *      🔴 `order_to_location` **มีความหมายกับใบยาเท่านั้น** = ห้องยา/คลังที่จะตัด stock (พี่ยืนยัน 2026-10-06)
 *      ใบ LAB / X-ray / Order ก็ได้ค่านี้ (= ห้องยาของคลินิก) แต่ **ไม่ใช่ปลายทางหรือคิวของใบนั้น**
 *      ⇒ ห้ามเอาไปใช้เปิดคิว / prefill ห้องส่งต่อ / แสดงเป็นปลายทางของใบที่ไม่ใช่ยา
 *   6. **override ได้ แต่ต้องมีเหตุผทางคลินิกและถูกบันทึกทุกครั้ง** (พี่เคาะ 2026-08-07)
 *      ระบบที่บล็อกสนิทจะโดนหาทางอ้อม — หมอสั่งด้วยวาจา/กระดาษแทน แล้วระบบไม่เห็นอะไรเลย
 *      ⇒ ยอมให้ผ่านโดยแลกกับ "ใครยืนยัน ตอนไหน เพราะอะไร ทับคำเตือนอะไรบ้าง" ที่ตามย้อนหลังได้
 *      🔴 ไม่ส่ง override_reason มา = ตีกลับเหมือนเดิมทุกประการ (caller เก่าไม่ต้องแก้)
 *   7. **ส่งใบ ≠ ส่งคิว** — process นี้ไม่เปิดคิวให้ใบชนิดใดเลย (เลิกเรียก cpoe-order-queue 2026-10-06)
 *      flow X-ray ที่พี่เคาะ: หมอส่งใบ → ห้อง X-ray เห็นใบใน worklist (จาก current_status sent/ready ของรายการ)
 *      → **คนเป็นผู้ส่งคิว** ไปห้องตรวจ X-ray (Move Unit / step_clinic ของห้องตรวจ) คิวจึงไปถึง
 *      เคยเปิดคิวอัตโนมัติที่ `order_to_location` ⇒ คิว X-ray ทุกครั้งไปโผล่ที่ m01.p ห้องยา (44 ครั้ง 08-31 → 10-06)
 *      ❌ อย่าผูกการเปิดคิวกลับเข้ามาที่นี่ — ถ้าวันหน้าอยากให้เปิดคิวเอง ต้องถามพี่ก่อน และห้ามใช้ order_to_location
 */

const FORM_ORDER = '6a6f5cd1265885c2377cc218'; // CPOE Order      → zdata_cpoe_order
const FORM_ORDER_ITEM = '6a6f7db2265885c2377cc222'; // CPOE Order Item → zdata_cpoe_order_item
const FORM_CPOE_ITEM = '6a594763d448dfc9d33e2c27'; // CPOE Item       → zdata_master_item_order (ธง req_specimen)
const FORM_VISIT = '6a40fdec4b6dfdf45acbfbce'; // Visit           → zdata_visit
const FORM_STOCK_LOC = '6a5fbb49a608039c539ebb53'; // Stock Locations → zdata_pis_stock_location
const GET_PROC = '6a71fe5f7f06d199f2a8a75d'; // cpoe-order-get
const CHECK_PROC = '6a722956e5ad2347aff4d231'; // cpoe-drug-check

const FORM_COLL = 'sdform_manage';
const DRAFT = 'draft';
const SENT = 'sent';
/* เหตุผล override สั้นกว่านี้ = กดผ่านลวก ๆ ("-", "ok") ซึ่งเท่ากับไม่ได้บังคับอะไรเลย
   ยาวพอให้เขียนเหตุผลจริงได้ ("ไม่มียาทดแทน", "แพ้เก่าข้อมูลไม่ชัด") — ปรับเลขนี้ได้ที่เดียว */
const MIN_OVERRIDE_REASON = 10;

const oid = (id) => {
	try {
		return app.dbObjectId(String(id));
	} catch (e) {
		return null;
	}
};
const bothIds = (id) => [String(id), oid(id)].filter(Boolean);
const unwrap = (v) => (v && typeof v === 'object' && !Array.isArray(v) && 'value' in v ? v.value : v);
const codeOf = (v) => String(unwrap(v) == null ? '' : unwrap(v)).trim();
const fail = (code, message, extra) => Object.assign({ success: false, code: code, message: message }, extra || {});

/* ── คลินิกผู้สั่ง (order_clinic · 2026-09-17) — กติกาชุดเดียวกับ cpoe-order-save/list/cancel ────
   ข้ามได้เฉพาะ role ห้องยา **ที่กำลังอยู่หน่วยที่ไม่ใช่คลินิก** (พี่เคาะ 2026-09-17 ข้อ 2) · admin/super ไม่ข้าม · ใบที่ยังไม่มี order_clinic หรือไม่รู้หน่วย user = ไม่ล็อก
   ⚠️ ห้องยาปลายทางยังหาจาก visit.visit_clinic เหมือนเดิม (ขั้น 2) — order_clinic ใช้ตัดสินสิทธิ์อย่างเดียว */
const CLINIC_BYPASS_ROLES = ['PHARMA', 'PHARMA_HEAD'];
const myUnitCode = userInfo && userInfo.unit && userInfo.unit.code ? String(userInfo.unit.code) : '';
const hasPharmaRole = (Array.isArray(userInfo && userInfo.roles) ? userInfo.roles : []).some((r) => CLINIC_BYPASS_ROLES.indexOf(r) >= 0);
let clinicBypass = false; // ตั้งจริงหลัง tableOf — ต้องรู้ก่อนว่าหน่วยปัจจุบันเป็นคลินิกไหม (ดูด้านล่าง)
const isOwnClinic = (order) => {
	const code = codeOf(order && order.order_clinic);
	return clinicBypass || !code || !myUnitCode || code === myUnitCode;
};

/* resolve ชื่อ collection จาก form id — 🔴 ห้าม hardcode `zdata_*`
   ฟอร์มตั้งชื่อ table เองได้ (form_table) และชื่อต่างกันข้าม instance แต่ form id คงที่ */
const tableCache = {};
const tableOf = async (formId) => {
	if (tableCache[formId] !== undefined) return tableCache[formId];
	const o = oid(formId);
	const doc = o ? await app.db.collection(FORM_COLL).findOne({ _id: o }, { projection: { form_table: 1 } }) : null;
	tableCache[formId] = (doc && doc.form_table) || null;
	return tableCache[formId];
};

/* role ห้องยาข้ามกติกาคลินิกได้ **เฉพาะตอนอยู่หน่วยที่ไม่ใช่คลินิก** (เช่น m01.p ห้องยา) — พี่เคาะ 2026-09-17
   🔴 ตัดสินตาม "กำลังทำงานในฐานะอะไร" ไม่ใช่ "ถือ role อะไร" — account หลาย role (DOCTOR+PHARMA)
      ที่สลับมาอยู่คลินิก ต้องโดนล็อกเหมือนหมอ ไม่งั้นแก้ใบข้ามคลินิกได้เงียบ ๆ (เจอบนจอจริง account admin)
   คลินิก = Organization unit_type 'clinic' + ref_code 5 หลัก (ชุดเดียวกับ cpoe-order-save · ห้องยา/การเงินไม่มี ref_code) */
const FORM_ORG = '6a3790c04cfbfdbe257f86fb'; // Organization → zdata_organization
if (hasPharmaRole) {
	const orgTable = await tableOf(FORM_ORG);
	const org = myUnitCode && orgTable
		? await app.db.collection(orgTable).findOne({ unit_code: myUnitCode, unit_type: 'clinic', xrstatx: 1 }, { projection: { ref_code: 1 } })
		: null;
	clinicBypass = !(org && /^\d{5}$/.test(String(org.ref_code || '')));
}

/* หน่วยแลปสั่ง/ส่งใบ "แลปล้วน" แทนคลินิกได้ (พี่เคาะ 2026-09-21) — ชุดเดียวกับ cpoe-order-save/list/cancel
   ต้นเหตุ: order-save ให้คนที่อยู่หน่วยไม่ใช่คลินิกสร้างใบได้ (order_clinic = คลินิกของวิสิท) แต่ด่านนี้ตีกลับ
      ⇒ แลปบันทึกใบได้ แต่ส่งใบตัวเองไม่ออก ค้างเป็นร่าง
   🔴 ข้ามได้เฉพาะใบที่ทุกรายการเป็น service ของหน่วยนั้น — ใบยา/ใบผสมของคลินิกยังล็อกเหมือนเดิม
      ดูที่ระดับรายการ ไม่ใช่ service_type หัวใบ (หัวใบ = ชนิดของรายการแรกเท่านั้น) */
const LAB_UNIT_TYPE = 'lab';
const XRAY_UNIT_TYPE = 'xray';
let isLabUnit = false;
let isXrayUnit = false;
if (myUnitCode) {
	const orgTable = await tableOf(FORM_ORG);
	const currentOrg = orgTable
		? await app.db.collection(orgTable).findOne(
			{ unit_code: myUnitCode, xrstatx: 1 },
			{ projection: { _id: 1, unit_type: 1, unit_parent: 1 } },
		)
		: null;
	isLabUnit = !!(currentOrg && currentOrg.unit_type === LAB_UNIT_TYPE);
	isXrayUnit = !!(currentOrg && currentOrg.unit_type === XRAY_UNIT_TYPE);
	/* หน่วยทำงานรังสีจริงเป็น Organization ลูกชนิด clinic (เช่น RA-11/RA-309)
	   โดย parent เป็น SelectByForm {value:<Organization _id>,label:<unit_code>} ของ root ชนิด xray */
	if (!isXrayUnit && currentOrg && currentOrg.unit_parent && orgTable) {
		const parentId = codeOf(currentOrg.unit_parent.value);
		const parentOid = parentId && oid(parentId);
		isXrayUnit = !!(parentOid && (await app.db.collection(orgTable).findOne(
			{ _id: parentOid, unit_type: XRAY_UNIT_TYPE, xrstatx: 1 },
			{ projection: { _id: 1 } },
		)));
	}
}
const isOnlyServiceOrder = async (id, serviceType) => {
	const itemColl = app.db.collection(await tableOf(FORM_ORDER_ITEM));
	const base = { 'order_id.value': { $in: bothIds(id) }, xrstatx: 1 };
	const total = await itemColl.countDocuments(base);
	const otherService = await itemColl.countDocuments(Object.assign({}, base, { 'service_type.value': { $ne: serviceType } }));
	return total > 0 && otherService === 0;
};
const isLabOnlyOrder = (id) => isOnlyServiceOrder(id, LAB_UNIT_TYPE);
const isXrayOnlyOrder = (id) => isOnlyServiceOrder(id, XRAY_UNIT_TYPE);

/* ══ 1) ตรวจ input + โหลดใบ ═══════════════════════════════════════════════ */
const orderId = String(params.order_id || '').trim();
if (!orderId || !oid(orderId)) return fail('NO_ORDER', 'ไม่ได้ระบุใบสั่งที่จะส่ง');

const orderTable = await tableOf(FORM_ORDER);
const itemTable = await tableOf(FORM_ORDER_ITEM);
const visitTable = await tableOf(FORM_VISIT);
const locTable = await tableOf(FORM_STOCK_LOC);
if (!orderTable || !itemTable || !visitTable) return fail('FORM_MISSING', 'อ่านโครงฟอร์ม CPOE ไม่ได้ (sdform_manage)');
if (!locTable) return fail('FORM_MISSING', 'อ่านโครงฟอร์ม Stock Locations ไม่ได้ (sdform_manage)');

const orderRes = await app.dbFindById(oid(orderId), orderTable);
const order = orderRes && orderRes.success ? (orderRes.reply || {}).data : null;
if (!order) return fail('ORDER_NOT_FOUND', 'ไม่พบใบสั่งนี้ (' + orderId + ')');

// เช็คเบื้องต้นเพื่อให้ข้อความชัด — guard ตัวจริงอยู่ใน filter ของ update (ขั้น 5)
const curStatus = String(order.current_status || '');
if (curStatus !== DRAFT) {
	return fail('NOT_DRAFT', 'ใบนี้ไม่ใช่ใบร่างแล้ว (สถานะ ' + (curStatus || '—') + ') จึงส่งซ้ำไม่ได้', { current_status: curStatus });
}
if (!Number(order.item_count)) return fail('NO_ITEMS', 'ใบนี้ยังไม่มีรายการ จึงส่งให้ห้องยาไม่ได้');

/* ── 1.5) สิ่งส่งตรวจที่บังคับระบุ (master `req_specimen` · พี่สั่ง 2026-10-02 "กันเหนียวที่ api") ──
   ต้นเหตุ: จอสั่งตรวจปิดปุ่มส่งใบอยู่แล้ว แต่ปุ่ม "ส่งใบสั่งตรวจ" บนการ์ด EMR ยิง process นี้ตรง ⇒ หลุดด่านจอ
   ผ่าน = lab_data มี specimen (รหัสที่เลือก หรือชื่อที่พิมพ์เอง/ข้อความเดิม) **และ** เวลาที่เก็บ
   🔴 ดูธงจาก master ณ ตอนส่ง (item_data_id) — ไม่เชื่อสิ่งที่จอบอก · ใบที่ไม่มี lab เลยไม่เสียเวลา query master */
const specMissing = async () => {
	const items = await app.db
		.collection(itemTable)
		.find({ 'order_id.value': { $in: bothIds(orderId) }, 'service_type.value': 'lab', xrstatx: 1 }, { projection: { item_code: 1, item_name: 1, item_data_id: 1, quantity: 1, lab_data: 1 } })
		.toArray();
	if (!items.length) return [];
	const masterTable = await tableOf(FORM_CPOE_ITEM);
	if (!masterTable) return [];
	const ids = items.map((i) => oid(i.item_data_id)).filter(Boolean);
	const req = await app.db.collection(masterTable).find({ _id: { $in: ids }, req_specimen: true }, { projection: { _id: 1, multi_specimen: 1 } }).toArray();
	const reqSet = {}; // master _id → { ms } · ms = multi_specimen (ต้องมี specimen ครบตามจำนวนที่สั่ง)
	req.forEach((m) => {
		reqSet[String(m._id)] = { ms: m.multi_specimen === true };
	});
	const filled = (d) => !!(d && String(d.spec_source_code || d.spec_source || '').trim() && String(d.specimen_at || '').trim());
	/* multi_specimen (พี่สั่ง 2026-10-02): สั่ง 3 = specimen ใน specimens[] ต้องครบ 3 ตัว (ทุกตัวมี specimen + เวลา)
	   รายการทั่วไป = ช่องบนสุดของ lab_data ครบก็พอ (= specimen แถวแรก) */
	const short = (i, rule) => {
		if (!rule.ms) return filled(i.lab_data) ? 0 : 1;
		const need = Math.max(1, Number(i.quantity) || 1);
		const list = i.lab_data && Array.isArray(i.lab_data.specimens) ? i.lab_data.specimens : [];
		const have = list.filter(filled).length || (filled(i.lab_data) ? 1 : 0);
		return Math.max(0, need - have);
	};
	return items
		.map((i) => ({ i: i, rule: reqSet[String(i.item_data_id)] }))
		.filter((x) => x.rule && short(x.i, x.rule) > 0)
		.map((x) => {
			const out = { item_code: x.i.item_code || '', item_name: x.i.item_name || '' };
			if (x.rule.ms) out.need = Math.max(1, Number(x.i.quantity) || 1);
			if (x.rule.ms) out.missing = short(x.i, x.rule);
			return out;
		});
};
const specMiss = await specMissing();
if (specMiss.length) {
	return fail(
		'SPEC_REQUIRED',
		'ยังไม่ระบุสิ่งส่งตรวจ ' + specMiss.length + ' รายการ (' + specMiss.map((x) => (x.item_name || x.item_code) + (x.need ? ' ขาด ' + x.missing + ' จาก ' + x.need + ' specimen' : '')).join(' · ') + ') — เปิดแก้ใบแล้วระบุก่อนส่ง',
		{ spec_missing: specMiss },
	);
}

/* ── 1.6) หมายเหตุที่บังคับระบุ (master `req_commt` · พี่เคาะ 2026-10-02) ──
   รายการอย่างส่ง lab ออกนอก — ห้องปลายทางต้องรู้ว่าแพทย์สั่งตรวจอะไร ⇒ comment ว่าง = ส่งไม่ได้
   ด่านเดียวกับ 1.5: จอปิดปุ่มส่งแล้ว แต่ปุ่มส่งบนการ์ด EMR ยิงตรงได้ · ดูธงจาก master ณ ตอนส่ง ไม่เชื่อจอ
   ทุกชนิดรายการ (ไม่ใช่แค่ lab) — ธงตั้งที่ master รายตัว ⇒ ใครถูกติ๊กก็ต้องถาม */
const commentMissing = async () => {
	const items = await app.db
		.collection(itemTable)
		.find({ 'order_id.value': { $in: bothIds(orderId) }, xrstatx: 1 }, { projection: { item_code: 1, item_name: 1, item_form_id: 1, item_data_id: 1, comment: 1 } })
		.toArray();
	// เฉพาะบรรทัดที่มาจาก CPOE Item — ใบยาใช้ process นี้ด้วย แต่ยาชี้ master คนละฟอร์ม ไม่ต้องเสีย query
	const empty = items.filter((i) => String(i.item_form_id || '') === FORM_CPOE_ITEM && !String(i.comment == null ? '' : i.comment).trim());
	if (!empty.length) return []; // ทุกบรรทัดมีหมายเหตุ (หรือไม่มีรายการตรวจ) — ไม่ต้อง query master
	const masterTable = await tableOf(FORM_CPOE_ITEM);
	if (!masterTable) return [];
	const ids = empty.map((i) => oid(i.item_data_id)).filter(Boolean);
	const req = await app.db.collection(masterTable).find({ _id: { $in: ids }, req_commt: true }, { projection: { _id: 1 } }).toArray();
	const reqSet = {};
	req.forEach((m) => {
		reqSet[String(m._id)] = 1;
	});
	return empty.filter((i) => reqSet[String(i.item_data_id)]).map((i) => ({ item_code: i.item_code || '', item_name: i.item_name || '' }));
};
const commentMiss = await commentMissing();
if (commentMiss.length) {
	return fail(
		'COMMENT_REQUIRED',
		'ยังไม่ระบุหมายเหตุ/คำสั่งแพทย์ ' + commentMiss.length + ' รายการ (' + commentMiss.map((x) => x.item_name || x.item_code).join(' · ') + ') — เปิดแก้ใบ กด "ระบุหมายเหตุ" ที่รายการนั้น แล้วค่อยส่ง',
		{ comment_missing: commentMiss },
	);
}
// ใบร่างของคลินิกอื่น — LAB/X-ray ข้ามได้เฉพาะใบล้วนของหน่วยตนเอง; ใบผสมยังถูกล็อก
const serviceUnitBypass =
	(isLabUnit && (await isLabOnlyOrder(orderId))) ||
	(isXrayUnit && (await isXrayOnlyOrder(orderId)));
if (!isOwnClinic(order) && !serviceUnitBypass) {
	return fail('NOT_ORDER_CLINIC', 'ใบนี้ออกโดยคลินิก ' + ((order.order_clinic && order.order_clinic.label) || codeOf(order.order_clinic)) + ' — ส่งได้เฉพาะคลินิกที่ออกใบ', {
		current_status: curStatus,
		order_clinic: codeOf(order.order_clinic),
	});
}

const visitId = codeOf(order.vid);
if (!visitId) return fail('NO_VISIT', 'ใบนี้ไม่มีวิสิทผูกอยู่ — ส่งไม่ได้');

/* ── 1.6) แลปส่งซ้ำใน visit เดียวกัน (พี่เคาะ 1A 2B 3A · 2026-10-02) ─────────────────────
   รายการ lab ในใบนี้ ที่ใบอื่นของ visit เดียวกันส่งไปแล้ว — นับทุกคลินิก รวมคลินิกตัวเอง (บอกในรายการว่าคลินิกไหน)
   "ส่งแล้ว" = รายการที่ยังมีผล (sent/accepted/ready/completed) · ร่าง/ยกเลิก/ปฏิเสธ ไม่นับ
   ไม่ได้ยืนยันมา = ตีกลับให้จอถาม · ยืนยันแล้ว = ส่งต่อ + บันทึกใน status_stage ว่าใครยืนยันซ้ำรายการไหน
   🔴 เช็คที่ด่านนี้ ไม่ใช่ที่จอ — การ์ดในหน้า EMR ยิง process นี้ตรงได้เหมือนกัน
   🔴 ต้องอยู่ก่อนออก Lab No. (§3.5) — ตีกลับหลังจองเลข = เลขหายไปเปล่าๆ ทุกครั้งที่หมอกดยกเลิก */
const DUP_ACTIVE = ['sent', 'accepted', 'ready', 'completed'];
const confirmDup = params.confirm_dup === true || params.confirm_dup === 'true';
const findDupLabs = async () => {
	const mine = await app.db
		.collection(itemTable)
		.find({ 'order_id.value': { $in: bothIds(orderId) }, 'service_type.value': 'lab', xrstatx: 1 }, { projection: { item_code: 1 } })
		.toArray();
	const codes = Array.from(new Set(mine.map((i) => String(i.item_code || '').trim()).filter(Boolean)));
	if (!codes.length) return [];
	const others = await app.db
		.collection(orderTable)
		.find({ 'vid.value': { $in: bothIds(visitId) }, _id: { $ne: oid(orderId) }, xrstatx: 1 }, { projection: { order_number: 1, order_clinic: 1 } })
		.toArray();
	if (!others.length) return [];
	const orderById = {};
	others.forEach((o) => {
		orderById[String(o._id)] = o;
	});
	const hits = await app.db
		.collection(itemTable)
		.find(
			{
				'order_id.value': { $in: others.flatMap((o) => bothIds(String(o._id))) },
				'service_type.value': 'lab',
				item_code: { $in: codes },
				current_status: { $in: DUP_ACTIVE },
				xrstatx: 1,
			},
			{ projection: { order_id: 1, item_code: 1, item_name: 1, current_status: 1, status_stage: 1 } }
		)
		.toArray();
	return hits.map((h) => {
		const o = orderById[codeOf(h.order_id)] || {};
		const sentStage = (Array.isArray(h.status_stage) ? h.status_stage : []).find((x) => x && x.stage_status === SENT);
		const clinic = codeOf(o.order_clinic);
		return {
			kind: 'visit', // ซ้ำใน visit เดียวกัน (§1.6) — คู่กับ 'repeat' ของ §1.7
			item_code: h.item_code || '',
			item_name: h.item_name || '',
			order_number: o.order_number || '',
			clinic: clinic,
			clinic_name: (o.order_clinic && o.order_clinic.label) || clinic,
			// เทียบกับคลินิกที่ออกใบนี้ (ไม่ใช่หน่วยของคนกด — แลปส่งแทนคลินิกได้)
			same_clinic: !!clinic && clinic === (codeOf(order.order_clinic) || myUnitCode),
			sent_at: (sentStage && sentStage.stage_at) || '',
			status: h.current_status || '',
		};
	});
};
const visitDups = await findDupLabs();

/* ── 1.7) ไม่ควรตรวจซ้ำภายใน N วัน (master `repeat_days` · พี่เคาะ 1A 2A 3A · 2026-10-02) ──────────
   รายการ lab ที่ตั้ง repeat_days > 0 และคนไข้รายนี้ **ทุก visit** มีรายการเดียวกันส่งไปแล้วภายใน N วัน
   นับจากวันที่ส่งใบ (stage sent ของรายการ) · สถานะที่นับชุดเดียวกับ §1.6 · เจอ = เตือนให้ยืนยันทุกตัว (1A)
   🔴 `repeat_action` ในฟอร์มยังไม่ถูกใช้ — พี่เลือก 1A เตือนอย่างเดียว · ค่า block ไม่มีผลจนกว่าจะเคาะเพิ่ม
   🔴 ซ้ำใน visit เดียวกันอยู่ใน §1.6 แล้ว — ข้ามที่นี่ ไม่งั้นรายการเดียวขึ้น 2 แถวใน popup
   ⚠️ นับเฉพาะใบใน CPOE — ประวัติจากระบบเก่า (old HIS) ไม่อยู่ในนี้ */
const DAY_MS = 86400000;
const atMs = (v) => {
	const mt = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(v || ''));
	return mt ? new Date(+mt[1], +mt[2] - 1, +mt[3], +mt[4], +mt[5]).getTime() : NaN;
};
const findRepeatLabs = async () => {
	const masterTable = await tableOf(FORM_CPOE_ITEM);
	if (!masterTable) return [];
	const mine = await app.db
		.collection(itemTable)
		.find({ 'order_id.value': { $in: bothIds(orderId) }, 'service_type.value': 'lab', xrstatx: 1 }, { projection: { item_code: 1, item_data_id: 1 } })
		.toArray();
	const ids = mine.map((i) => oid(i.item_data_id)).filter(Boolean);
	if (!ids.length) return [];
	// กติกาอ่านจาก master ณ ตอนส่ง ไม่เชื่อสำเนาในใบ
	const rules = await app.db.collection(masterTable).find({ _id: { $in: ids }, repeat_days: { $gt: 0 } }, { projection: { repeat_days: 1 } }).toArray();
	if (!rules.length) return [];
	const daysById = {};
	rules.forEach((m) => {
		daysById[String(m._id)] = Math.floor(Number(m.repeat_days));
	});
	const daysByCode = {};
	mine.forEach((i) => {
		const d = daysById[String(i.item_data_id)];
		if (d > 0) daysByCode[String(i.item_code || '').trim()] = d;
	});
	const codes = Object.keys(daysByCode).filter(Boolean);
	const personId = order.vid && order.vid.xtbxlv1_xfx_id ? String(order.vid.xtbxlv1_xfx_id) : '';
	if (!codes.length || !personId) return [];

	const nowMs = atMs(app.curDate());
	// อ่านเวลาปัจจุบันไม่ออก = คิดช่วงไม่ได้ · ดังใน log ไม่เงียบ (cutoff "NaN-…" จะกรองทิ้งทุกใบโดยไม่มีใครรู้)
	if (isNaN(nowMs)) {
		app.log.warn('[cpoe-order-send] repeat-check: อ่าน app.curDate() ไม่ออก — ข้ามการเช็ค ' + codes.join(','));
		return [];
	}
	const maxDays = Math.max.apply(null, codes.map((c) => daysByCode[c]));
	/* เอาเฉพาะใบที่ขยับภายในช่วง — ใช้ index ix_cpoe_person_updated (cpoe-ensure-index) · ทั้งโรงพยาบาลจะใหญ่แค่ไหนก็ดูแค่ใบของคนนี้ในช่วง
	   🔴 กรองด้วย updated_at ไม่ใช่ created_at — ร่างค้างนานแล้วค่อยส่ง created_at เก่ากว่าวันส่ง ⇒ หลุดไม่เตือน
	      ตอนส่งใบ updated_at ถูกตั้งเป็นเวลาส่งเสมอ และขยับไปข้างหน้าเท่านั้น ⇒ ใบที่ส่งในช่วงไม่มีวันตกหล่น
	   updated_at เป็น string "YYYY-MM-DD HH:mm:ss" ⇒ เทียบแบบ string ได้ (รูปเดียวกับ app.curDate) */
	const pad2 = (n) => String(n).padStart(2, '0');
	const cut = new Date(nowMs - maxDays * DAY_MS);
	const cutoffAt = cut.getFullYear() + '-' + pad2(cut.getMonth() + 1) + '-' + pad2(cut.getDate()) + ' ' + pad2(cut.getHours()) + ':' + pad2(cut.getMinutes()) + ':00';
	const others = await app.db
		.collection(orderTable)
		.find(
			{
				'vid.xtbxlv1_xfx_id': { $in: bothIds(personId) },
				xrstatx: 1,
				updated_at: { $gte: cutoffAt },
				'vid.value': { $nin: bothIds(visitId) },
				_id: { $ne: oid(orderId) },
			},
			{ projection: { order_number: 1, order_clinic: 1 } }
		)
		.toArray();
	if (!others.length) return [];
	const orderById = {};
	others.forEach((o) => {
		orderById[String(o._id)] = o;
	});
	const hits = await app.db
		.collection(itemTable)
		.find(
			{
				'order_id.value': { $in: others.flatMap((o) => bothIds(String(o._id))) },
				'service_type.value': 'lab',
				item_code: { $in: codes },
				current_status: { $in: DUP_ACTIVE },
				xrstatx: 1,
			},
			{ projection: { order_id: 1, item_code: 1, item_name: 1, current_status: 1, status_stage: 1 } }
		)
		.toArray();

	// ครั้งล่าสุดต่อรหัส — ครั้งเก่ากว่านั้นไม่ช่วยตัดสินอะไร
	const latest = {};
	hits.forEach((h) => {
		const sentStage = (Array.isArray(h.status_stage) ? h.status_stage : []).find((x) => x && x.stage_status === SENT);
		const at = sentStage && sentStage.stage_at;
		const ms = atMs(at);
		if (isNaN(ms) || nowMs - ms > maxDays * DAY_MS) return;
		const code = String(h.item_code || '').trim();
		if (!latest[code] || ms > latest[code].ms) latest[code] = { h: h, at: at, ms: ms };
	});
	return Object.keys(latest)
		.filter((code) => nowMs - latest[code].ms < daysByCode[code] * DAY_MS)
		.map((code) => {
			const x = latest[code];
			const o = orderById[codeOf(x.h.order_id)] || {};
			const clinic = codeOf(o.order_clinic);
			return {
				kind: 'repeat',
				item_code: x.h.item_code || '',
				item_name: x.h.item_name || '',
				order_number: o.order_number || '',
				clinic: clinic,
				clinic_name: (o.order_clinic && o.order_clinic.label) || clinic,
				same_clinic: !!clinic && clinic === (codeOf(order.order_clinic) || myUnitCode),
				sent_at: x.at,
				status: x.h.current_status || '',
				repeat_days: daysByCode[code],
				days_ago: Math.floor((nowMs - x.ms) / DAY_MS),
			};
		});
};
const repeatLabs = await findRepeatLabs();

// ทั้งสองแบบใช้ popup ยืนยันเดียวกัน (code DUP_LAB · แยกด้วย kind) — ยืนยันครั้งเดียวผ่านทั้งชุด
const dupLabs = visitDups.concat(repeatLabs);
const dupText = (d) =>
	(d.item_name || d.item_code) +
	(d.kind === 'repeat' ? ' — ตรวจไปแล้ว ' + d.days_ago + ' วันก่อน (ไม่ควรซ้ำภายใน ' + d.repeat_days + ' วัน)' : ' — ' + (d.clinic_name || 'ไม่ทราบคลินิก') + ' ใน visit นี้');
if (dupLabs.length && !confirmDup) {
	return fail(
		'DUP_LAB',
		'มี ' + dupLabs.length + ' รายการแลปที่เพิ่งส่งตรวจไปแล้ว (' + dupLabs.map(dupText).join(' · ') + ') — ยืนยันการส่งตรวจซ้ำก่อนส่ง',
		{ duplicates: dupLabs }
	);
}

/* ══ 2) หาหน่วยปลายทางจาก mapping ที่ห้องยาตั้งไว้ ═════════════════════════
   คลินิกของวิสิท → stock_location ที่ประกาศ serve_units มีคลินิกนั้น → org_unit ของคลัง
   ⚠️ `serve_units` เป็น select-form multiple ⇒ เก็บเป็น { value: ['A102','A103'], label: '...' }
      (object เดียวที่ value เป็น array ไม่ใช่ array ของ object) — mongo match ที่ `serve_units.value` ได้ตรง */
const visitRes = await app.dbFindById(oid(visitId), visitTable);
const visit = visitRes && visitRes.success ? (visitRes.reply || {}).data : null;
if (!visit) return fail('VISIT_NOT_FOUND', 'ไม่พบวิสิทของใบนี้ (' + visitId + ')');

const clinicCode = codeOf(visit.visit_clinic);
if (!clinicCode) return fail('NO_CLINIC', 'วิสิทนี้ไม่มีคลินิก จึงหาห้องยาปลายทางไม่ได้');

const locRows = await app.db
	.collection(locTable)
	.find({ 'serve_units.value': clinicCode, enable: true, xrstatx: 1 }, { projection: { code: 1, name: 1, org_unit: 1, sort: 1 } })
	.sort({ sort: 1, _id: 1 })
	.toArray();

if (!locRows.length) {
	// 🔴 ห้าม fallback ไปห้องอื่น — ยาไปผิดห้องอันตรายกว่าส่งไม่ออก
	return fail(
		'LOC_NOT_CONFIGURED',
		'ยังไม่ได้ตั้งค่าห้องยาที่รับใบจากคลินิก ' + clinicCode + ' — ตั้งที่ฟอร์ม Stock Locations ช่อง "หน่วยที่รับใบจาก"',
		{ clinic: clinicCode },
	);
}
if (locRows.length > 1) {
	app.log.warn('[cpoe-order-send] คลินิก ' + clinicCode + ' มีคลังประกาศรับ ' + locRows.length + ' แห่ง — ใช้ ' + locRows[0].code + ' (sort น้อยสุด)');
}

const toLoc = locRows[0].org_unit || null;
if (!toLoc || !codeOf(toLoc)) {
	return fail('LOC_NO_UNIT', 'คลัง ' + locRows[0].code + ' ยังไม่ได้ผูกหน่วยงาน (org_unit) — ตั้งค่าก่อนจึงจะส่งใบได้');
}

/* ══ 3) ตรวจความปลอดภัยยาใหม่ ณ วินาทีที่ส่ง ═══════════════════════════════
   อ่านรายการกลับผ่าน order-get เพราะที่นั่นคือที่เดียวที่แปลง prescription_data → sig
   (รวม sig_freq_calc ที่ไม่ได้เก็บลงใบ แต่กฎ qty_guard ต้องใช้) — เขียนแปลงเองที่นี่
   = วันหนึ่งสองฝั่งแปลงไม่ตรงกัน แล้วกฎจะยิงผิดโดยไม่มีใครเห็น */
const getRes = await app.subProcess(GET_PROC, { order_id: orderId, visit_id: visitId }, userInfo);
const got = (getRes && getRes.data) || null;
if (!getRes || !getRes.success || !got || !got.success || !Array.isArray(got.lines)) {
	return fail('READ_LINES_FAILED', 'อ่านรายการในใบไม่สำเร็จ จึงยังส่งไม่ได้: ' + ((got && got.message) || (getRes && getRes.message) || 'ไม่ทราบสาเหตุ'));
}
if (!got.lines.length) return fail('NO_ITEMS', 'ใบนี้ยังไม่มีรายการ จึงส่งให้ห้องยาไม่ได้');

const checkRes = await app.subProcess(
	CHECK_PROC,
	{
		visit_id: visitId,
		order_id: orderId, // ใบตัวเองไม่นับเป็น "ใบอื่นของวิสิท" ตอนเทียบกฎ duplicate
		lines: got.lines.map((l, i) => ({
			line_id: String(i),
			item_form_id: l.item_form_id,
			item_data_id: l.item_data_id,
			quantity: l.quantity,
			qty_calc_source: l.qty_calc_source,
			sig: l.sig,
			comment: l.comment,
			// ใบกำกับที่ผูกกับรายการ — กฎ prescriber_temp ใช้ตัดสินว่ายังขาดใบไหม (ด่าน ③ ของ B4)
			temp_id: l.temp_id || '',
		})),
	},
	userInfo,
);
const chk = (checkRes && checkRes.data) || null;
if (!checkRes || !checkRes.success || !chk || !chk.success || !Array.isArray(chk.lines)) {
	// 🔴 ด่านสุดท้ายก่อนยาออกจริง — ตรวจไม่ได้ = ไม่ปล่อยผ่าน (ต่างจากตอนบันทึกร่าง)
	return fail('CHECK_FAILED', 'ตรวจความปลอดภัยยาไม่สำเร็จ จึงยังส่งใบไม่ได้: ' + ((chk && chk.message) || (checkRes && checkRes.message) || 'ไม่ทราบสาเหตุ'));
}

const blocks = [];
chk.lines.forEach((r) => {
	const idx = Number((r && r.line_id) || -1);
	const src = got.lines[idx] || {};
	(Array.isArray(r && r.alerts) ? r.alerts : []).forEach((a) => {
		if (a && a.level === 'block') {
			blocks.push({ item_name: src.item_name || '', rule: a.rule || '', message: a.message || '' });
		}
	});
});
/* ── ด่าน block + ทางออกที่บันทึกได้ ─────────────────────────────────────
   🔴 ไม่มีเหตุผลมา = ตีกลับ (พฤติกรรมเดิม) · มีเหตุผลที่ยาวพอ = ปล่อยผ่านแล้วบันทึกทุกอย่าง
      เหตุผลสั้นเกินก็ตีกลับ — ไม่งั้น "เหตุผลบังคับ" จะกลายเป็นปุ่มยืนยันธรรมดาที่ไม่มีใครอ่าน */
const overrideReason = String(params.override_reason == null ? '' : params.override_reason).trim();
if (blocks.length && !overrideReason) {
	return fail('HAS_BLOCK', 'มี ' + blocks.length + ' รายการที่ติดคำเตือนระดับห้ามสั่ง — แก้ในจอสั่งยา หรือยืนยันส่งพร้อมระบุเหตุผล', { blocks: blocks });
}
if (blocks.length && overrideReason.length < MIN_OVERRIDE_REASON) {
	return fail(
		'OVERRIDE_REASON_TOO_SHORT',
		'ระบุเหตุผลที่ยืนยันส่งทั้งที่มีคำเตือนห้ามสั่ง อย่างน้อย ' + MIN_OVERRIDE_REASON + ' ตัวอักษร',
		{ blocks: blocks },
	);
}
// override ที่ไม่มี block จริง = ไม่นับ (กันเหตุผลลอย ๆ ติดใบที่ไม่ได้ทับคำเตือนอะไร)
const overridden = blocks.length ? blocks : [];

/* ══ 3.5) Lab No. ตอนส่งใบ (Section `ln_order_gen` · พี่เคาะ ง1 2026-10-02) ═══════════════
   รายการ lab ใน section ที่เปิดธง → 1 test = 1 LN → เขียนที่ CPOE Order Item `item_no`
   รูปแบบ SSYYMMDDNNNN: SS = ref_code ของ section · YY = พ.ศ. 2 หลักท้าย · MM DD · NNNN รันต่อ section ต่อวัน
   🔴 ใช้ตัวนับตัวเดียวกับ LIS (lab_no_generate_api) — _id 'lab_no:<SECTION>:<YYYY-MM-DD>' ใน zdata_lab_no_counter
      และวันที่จาก app.curDate() เหมือนกัน ⇒ เลขที่ออกตอนส่งใบกับตอนรับสิ่งส่งตรวจไม่มีทางชนกัน
      (คนละตัวนับ = วันเดียวกันสองทางแจกเลขเดียวกันให้คนละรายการได้)
   🔴 ครบ 9999 หยุด ไม่วนกลับ · เลขที่จองแล้วไม่ใช้ซ้ำ (ส่งไม่สำเร็จ = เว้นช่องได้ แต่ไม่ซ้ำ)
   🔴 มี item_no แล้วไม่ออกใหม่ — ส่งรอบแรกล้มแล้วกดส่งซ้ำ ได้เลขเดิม
   ออกเลขไม่ได้ = ไม่ให้ส่งใบ (ข้อ 1 · พี่เคาะ) — ทำก่อนเขียนสถานะ ใบยังเป็นร่างเสมอเมื่อล้ม */
const LN_COUNTER = 'zdata_lab_no_counter'; // ชื่อเดียวกับ LIS (lab_no_generate_api) — ห้ามเปลี่ยนข้างเดียว
const LN_MAX = 9999;
const FORM_SECTION = '6a58f4dfd448dfc9d33e2bf2'; // Section → zdata_section (ln_order_gen · ref_code)
const FORM_LAB_WORK = '6a95c750422c1ca959829e8a'; // Lab_work_item → zdata_lab_work_item (เช็คเลขชน)
const lnFail = (code, message) => fail(code, message);

const assignLabNos = async () => {
	const items = await app.db
		.collection(itemTable)
		.find(
			{ 'order_id.value': { $in: bothIds(orderId) }, 'service_type.value': 'lab', xrstatx: 1 },
			{ projection: { item_code: 1, item_name: 1, item_data_id: 1, item_no: 1 } }
		)
		.toArray();
	const todo = items.filter((i) => !String(i.item_no == null ? '' : i.item_no).trim());
	if (!todo.length) return { assigned: [] };

	// section ของแต่ละรายการ — ดูจาก master ณ ตอนส่ง (ไม่เชื่อสำเนาในใบ) แล้วอ่านธง/ref_code จาก Section
	const masterTable = await tableOf(FORM_CPOE_ITEM);
	const sectionTable = await tableOf(FORM_SECTION);
	if (!masterTable || !sectionTable) return { error: lnFail('FORM_MISSING', 'อ่านโครงฟอร์ม CPOE Item / Section ไม่ได้ จึงออก Lab No. ไม่ได้') };
	const masters = await app.db
		.collection(masterTable)
		.find({ _id: { $in: todo.map((i) => oid(i.item_data_id)).filter(Boolean) } }, { projection: { section: 1 } })
		.toArray();
	const secIdOf = {};
	masters.forEach((m) => {
		const v = m.section && unwrap(m.section);
		if (v) secIdOf[String(m._id)] = String(v);
	});
	const secIds = Array.from(new Set(Object.values(secIdOf)));
	if (!secIds.length) return { assigned: [] };
	const sections = await app.db
		.collection(sectionTable)
		.find({ _id: { $in: secIds.map(oid).filter(Boolean) }, ln_order_gen: true }, { projection: { code: 1, ref_code: 1, name: 1 } })
		.toArray();
	const secById = {};
	sections.forEach((x) => {
		secById[String(x._id)] = x;
	});
	const want = todo.filter((i) => secById[secIdOf[String(i.item_data_id)]]);
	if (!want.length) return { assigned: [] };

	// วันที่ — รูปเดียวกับ LIS (app.curDate · server) เพื่อให้ key ตัวนับตรงกัน
	const today = String(app.curDate('YYYY-MM-DD HH:mm:ss') || '').slice(0, 10);
	const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
	if (!dm) return { error: lnFail('LN_DATE_INVALID', 'อ่านวันที่ปัจจุบันไม่สำเร็จ จึงออก Lab No. ไม่ได้') };
	const be = Number(dm[1]) + 543;
	const yy = String(be % 100).padStart(2, '0');
	const workTable = await tableOf(FORM_LAB_WORK);
	const counters = app.db.collection(LN_COUNTER);
	const assigned = [];

	for (const it of want) {
		const sec = secById[secIdOf[String(it.item_data_id)]];
		const secCode = String(sec.code || '').trim().toUpperCase();
		const prefix = String(sec.ref_code == null ? '' : sec.ref_code).trim();
		if (!/^\d{2}$/.test(prefix)) {
			return { error: lnFail('LN_PREFIX_MISSING', 'Section ' + secCode + ' ยังไม่มี Ref Code 2 หลัก จึงออก Lab No. ให้ ' + (it.item_name || it.item_code) + ' ไม่ได้') };
		}
		// โครงเดียวกับ pipeline update ของ LIS — เอกสารตัวนับต้องหน้าตาเหมือนกันไม่ว่าใครเป็นคนจอง
		const res = await counters.findOneAndUpdate(
			{ _id: ['lab_no', secCode, today].join(':') },
			[
				{
					$set: {
						section_code: secCode,
						section_prefix: prefix,
						buddhist_year: be,
						year_two_digits: yy,
						date_key: today,
						buddhist_date_key: be + '-' + dm[2] + '-' + dm[3],
						month_two_digits: dm[2],
						day_two_digits: dm[3],
						format_version: 2,
						daily_limit_reached: { $gte: [{ $ifNull: ['$sequence', 0] }, LN_MAX] },
						sequence: {
							$let: {
								vars: { cur: { $ifNull: ['$sequence', 0] } },
								in: { $cond: [{ $gte: ['$$cur', LN_MAX] }, '$$cur', { $add: ['$$cur', 1] }] },
							},
						},
						created_at: { $ifNull: ['$created_at', now] },
						updated_at: now,
						updated_by: userInfo.username,
					},
				},
			],
			{ upsert: true, returnDocument: 'after' }
		);
		const c = res && (res.value || res);
		if (c && c.daily_limit_reached === true) {
			return { error: lnFail('LN_DAILY_LIMIT', 'Lab No. ของ Section ' + secCode + ' ครบ 9999 รายการสำหรับวันนี้แล้ว — แจ้งผู้ดูแลระบบ') };
		}
		const seq = Number(c && c.sequence);
		if (!Number.isInteger(seq) || seq < 1 || seq > LN_MAX) return { error: lnFail('LN_COUNTER_INVALID', 'ตัวนับ Lab No. ผิดปกติ จึงยังส่งใบไม่ได้') };
		const ln = prefix + yy + dm[2] + dm[3] + String(seq).padStart(4, '0');
		// เลขชน (ref_code ซ้ำกันระหว่าง section · ข้อมูลเก่า) — หยุดก่อนจับคู่ผิดรายการ ไม่เดาเลขใหม่ให้
		const dupItem = await app.db.collection(itemTable).findOne({ item_no: ln, xrstatx: 1 }, { projection: { _id: 1 } });
		const dupWork = workTable ? await app.db.collection(workTable).findOne({ lab_no: ln, xrstatx: { $nin: [0, 3] } }, { projection: { _id: 1 } }) : null;
		if (dupItem || dupWork) return { error: lnFail('LN_COLLISION', 'Lab No. ' + ln + ' ซ้ำกับเลขที่มีอยู่ จึงหยุดเพื่อป้องกันการจับคู่ผิดรายการ — แจ้งผู้ดูแลระบบ') };
		// 🔴 guard item_no ว่าง — สองจอกดส่งพร้อมกัน ตัวที่สองไม่ทับเลขของตัวแรก (เลขที่จองไว้ = ช่องว่าง ไม่ซ้ำ)
		await app.db.collection(itemTable).updateOne(
			{ _id: it._id, $or: [{ item_no: { $exists: false } }, { item_no: null }, { item_no: '' }] },
			{ $set: { item_no: ln, item_no_at: now, updated_at: now, updated_by: stamp } }
		);
		assigned.push({ item_code: it.item_code || '', item_no: ln });
	}
	return { assigned: assigned };
};

/* ══ 4) เขียนสถานะ ═══════════════════════════════════════════════════════
   ฟอร์ม CPOE Order มี api_onevent เฉพาะ on:'insert' (ออกเลขใบ) — ไม่มี event ตอน update
   ⇒ raw update ไม่ข้าม event ใด และจำเป็น เพราะต้อง guard แบบ atomic
   🔴 raw write ไม่ผ่าน hook ⇒ stamp updated_* เอง + ล้าง options cache เอง */
const now = app.curDate();
const stamp = { id: String(userInfo.account.id), name: userInfo.username };
/* 🔴 `stage_by` เป็น select-data 'user-list' (valueObjectId) ⇒ ต้องเป็น { value: ObjectId, label }
   ไม่ใช่ `userInfo.account` ({id,name}) ที่เป็นรูปของ updated_by — ลงผิดรูปจอโชว์ `[object Object]`
   (`stamp` ข้างบนยังเป็น {id,name} ถูกแล้ว เพราะ updated_by ไม่ใช่ช่องในฟอร์ม) */
const memberRef = (acc) => (acc && acc.id ? { value: oid(String(acc.id)), label: acc.name || '' } : null);
const currentMember = memberRef(userInfo.account);
const stage = {
	stage_status: SENT,
	stage_at: now,
	stage_by: currentMember,
	stage_location: toLoc,
	stage_reason: params.reason == null ? '' : String(params.reason),
};
// เหตุผล override อยู่ใน stage ด้วย — ไทม์ไลน์ของใบต้องเล่าเรื่องได้ครบโดยไม่ต้องเปิดที่อื่น
if (overridden.length) {
	stage.stage_override_reason = overrideReason;
	stage.stage_override_alerts = overridden;
}
// ยืนยันส่งแลปซ้ำ (§1.6) — ใคร/เมื่อไหร่ = stage_by/stage_at ของ stage นี้ · รายการที่ซ้ำเก็บไว้ข้างกัน
if (dupLabs.length) stage.stage_dup_confirmed = dupLabs;

// Lab No. ก่อนเปลี่ยนสถานะ — ล้ม = คืน fail ตรงนี้ ใบยังเป็นร่าง (ข้อ 1 · พี่เคาะ) · ดู §3.5
const lnRes = await assignLabNos();
if (lnRes.error) return lnRes.error;
if (lnRes.assigned.length) void app.optCacheInvalidate(itemTable);

const $set = { current_status: SENT, order_to_location: toLoc, updated_at: now, updated_by: stamp };
if (overridden.length) {
	// ธงที่หัวใบ — ห้องยาต้องกรองใบกลุ่มนี้ขึ้นมาดูก่อนจ่ายได้ โดยไม่ต้องไล่อ่าน status_stage ทุกใบ
	$set.has_override = true;
	$set.override_reason = overrideReason;
	$set.override_by = userInfo.account;
	$set.override_at = now;
	$set.override_alerts = overridden;
}

const sent = await app.db.collection(orderTable).findOneAndUpdate(
	// guard อยู่ตรงนี้ ไม่ใช่ `if` ข้างบน — กดซ้ำ/สองจอพร้อมกัน ตัวที่สองไม่ match = ไม่มีอะไรถูกแก้
	{ _id: oid(orderId), current_status: DRAFT, xrstatx: 1 },
	{ $set: $set, $push: { status_stage: stage } },
	{ returnDocument: 'after' },
);
if (!sent) {
	return fail('NOT_DRAFT', 'ใบนี้ถูกส่งไปแล้ว หรือสถานะเปลี่ยนไประหว่างกด — โหลดการ์ดใหม่แล้วลองอีกครั้ง');
}

/* รายการในใบเปลี่ยนตามหัวใบ — จอห้องปลายทางกรองที่ระดับรายการ (service_type ของ item)
   ถ้าลูกยัง draft จะกรองไม่เจอทั้งที่หัวใบส่งแล้ว */
const itemRes = await app.db.collection(itemTable).updateMany(
	{ 'order_id.value': { $in: bothIds(orderId) }, current_status: DRAFT, xrstatx: 1 },
	{
		$set: { current_status: SENT, updated_at: now, updated_by: stamp },
		$push: { status_stage: stage },
	},
);
const itemUpdated = (itemRes && itemRes.modifiedCount) || 0;
if (itemUpdated !== got.lines.length) {
	// ไม่ตีกลับ (หัวใบส่งไปแล้ว) แต่ต้องดัง — ใบที่ลูกไม่ครบจะทำให้จอห้องยาเห็นรายการไม่ครบ
	app.log.warn('[cpoe-order-send] order ' + orderId + ' หัวใบ sent แล้ว แต่รายการเปลี่ยนสถานะ ' + itemUpdated + '/' + got.lines.length + ' รายการ');
}

void app.optCacheInvalidate(orderTable);
void app.optCacheInvalidate(itemTable);

app.log.info('[cpoe-order-send] order ' + orderId + ' (' + (sent.order_number || '-') + ') → sent ปลายทาง ' + codeOf(toLoc) + ' · ' + itemUpdated + ' รายการ');
if (dupLabs.length) {
	app.log.warn('[cpoe-order-send] dup-lab: order ' + (sent.order_number || orderId) + ' ยืนยันส่งแลปซ้ำ ' + dupLabs.length + ' รายการ โดย ' + userInfo.username + ' · ' + dupLabs.map((d) => d.item_code + '@' + (d.order_number || '?')).join(' | '));
}
if (overridden.length) {
	// ระดับ warn ไม่ใช่ info — ใบที่ทับคำเตือนห้ามสั่งต้องหาเจอใน log ได้โดยไม่ต้องรู้เลขใบล่วงหน้า
	app.log.warn(
		'[cpoe-order-send] override: order ' + (sent.order_number || orderId) + ' ส่งทั้งที่ติด block ' + overridden.length +
			' รายการ โดย ' + userInfo.username + ' — เหตุผล: ' + overrideReason +
			' · ' + overridden.map((b) => (b.rule || '?') + ':' + (b.item_name || '?')).join(' | '),
	);
}

/* ── ไม่เปิดคิวที่นี่ (หลักการข้อ 7) ─────────────────────────────────────
   เดิมเรียก cpoe-order-queue (6a794b9530f965929f47a709) ตรงนี้ → เปิดคิว X-ray ที่ order_to_location = ห้องยา
   เลิกแล้ว 2026-10-06: ห้อง X-ray เห็นใบจาก worklist อยู่แล้ว คิวไปห้องตรวจ X-ray ต้องมีคนส่ง */

return {
	success: true,
	message:
		'ส่งใบสั่งยาไปที่ ' + ((toLoc && toLoc.label) || codeOf(toLoc)) + ' แล้ว' +
		(overridden.length ? ' (ยืนยันส่งทั้งที่มีคำเตือนห้ามสั่ง ' + overridden.length + ' รายการ)' : ''),
	order_id: orderId,
	order_number: sent.order_number || '',
	current_status: SENT,
	order_to_location: toLoc,
	item_count: got.lines.length,
	item_updated: itemUpdated,
	// เตือนที่ไม่ถึงขั้นห้ามสั่ง — จอเอาไปแสดงได้ ไม่ได้ตีกลับใบ
	warn_count: Number((chk.summary || {}).warn) || 0,
	// คำเตือนห้ามสั่งที่ถูกทับรอบนี้ (ว่าง = ส่งผ่านตามปกติ) — จอเอาไปยืนยันกับหมอว่าทับอะไรไปบ้าง
	overridden: overridden,
	// คงช่องไว้ให้ caller เก่า (ipd-order-create อ่าน sent.queue) — null เสมอ เพราะส่งใบไม่เปิดคิวแล้ว (หลักการข้อ 7)
	queue: null,
	// แลปที่ยืนยันส่งซ้ำรอบนี้ (ว่าง = ไม่มีรายการซ้ำใน visit) — ดู §1.6
	dup_confirmed: dupLabs,
	// Lab No. ที่ออกให้รอบนี้ (ว่าง = ใบนี้ไม่มีรายการใน section ที่เปิด ln_order_gen หรือมีเลขอยู่แล้ว)
	lab_nos: lnRes.assigned,
};
