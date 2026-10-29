/**
 * cpoe-order-save — บันทึกใบสั่งยาจากจอ CPOE (สร้างใบร่างใหม่ / แก้ใบร่างเดิม)
 *
 * เรียกจาก: widget order_screen → s.save() (จอสั่งยา form_ui 6a70b8cd74be9b0d6e2dca74)
 *
 * params:
 *   visit_id      required  _id ของ visit (จอได้มาทาง field.params ไม่ใช่ form data)
 *   lines[]       required  ตะกร้าของจอ — [{ uid, item_form_id, item_data_id, item_source, item_code,
 *                           item_name, quantity, qty_calc_source, price_overwrite, comment, tags[], sig{} }]
 *   inscl         { main, sub } code ล้วนของสิทธิ์ที่หมอเลือก (null = ชำระเองทั้งใบ)
 *   inscl_row     สิทธิ์ทั้งแถวจาก visit.inscl_hos[] — ใช้เก็บ label ลงใบ (ไม่มีก็ยังบันทึกได้)
 *   service_type  code ของ Service Type ของ "ใบ" (default 'med') — ใช้ออก prefix เลขที่ใบเท่านั้น
 *   priority      '1'-'5' ความเร่งด่วนระดับใบ (C13 · default '1' ปกติ)
 *   prior_medication  '1'/'2' ยาที่เคยรับ · prior_specify ข้อความ (เก็บเฉพาะเมื่อตอบ '2')
 *   lines[].service_type  code ชนิดของ "บรรทัดนั้น" — ไม่ส่ง = ใช้ชนิดของใบ (จอสั่งยาไม่ส่ง)
 *   lines[].lab_data      { source, storage, at, by_id, by } สิ่งส่งตรวจของบรรทัด (lab เท่านั้น)
 *                         หรือรูปใหม่ { rows:[{site,site_n,spec,spec_n,at,storage,temp,note}], by_id, by } (จอ CPOE Order App)
 *   order_id      ถ้าส่งมา = แก้ใบเดิมใบนั้น (ไม่ออกเลขใหม่ · เขียนรายการทับทั้งชุด)
 *                 draft = เฉพาะคลินิกผู้สั่ง (order_clinic · 2026-09-17) · sent/accepted = เฉพาะ role PHARMA/ADMIN (C04 · b4)
 *   order_comment / order_tags[]   หมายเหตุระดับใบ
 *
 * return: { success, message, order_id, order_number, current_status, item_count, sub_lines, totals, mode:'insert'|'update' }
 *
 * ชุดแม่-ลูกของรายการตรวจ (C33 · พี่เคาะ 2026-08-30): **ทุกบรรทัดคิดราคาจริง ไม่มีบรรทัด ฿0**
 *   sub_order → ชุด group: หัวชุดไม่เข้าใบ (ตัดทิ้ง) · ลูกต้องครบชุด ไม่ครบตีกลับ SET_INCOMPLETE
 *   lab_parent → ชุด exclusive: แม่กับลูกอยู่พร้อมกันไม่ได้ ⇒ แม่ชนะ ตัดลูกออก
 *   ตัดสินจาก master ที่นี่เอง ไม่เชื่อธงจากจอ · ธง is_sub ของกติกาเดิมถูกเมิน
 *
 * 🔴 หลักการที่ยึดไว้ (อย่าเผลอแก้ให้ "ง่ายขึ้น"):
 *   1. ราคาคิดใหม่ที่นี่เสมอด้วย cpoe-price-calc — ห้ามเชื่อราคาที่จอส่งมา
 *      ตะกร้าอยู่ใน localStorage ข้ามวันได้ ราคา/สิทธิ์อาจเปลี่ยนไปแล้ว และ client แก้ค่าได้
 *   2. รายการที่ราคาออกไม่ได้ (หา master ไม่เจอ / ไม่มีราคา) = ตีกลับทั้งใบ
 *      ห้ามบันทึกด้วยราคา 0 — ของออกจากคลังโดยไม่มีใครเก็บเงินคือความเสียหายจริง
 *   3. หัวใบต้อง commit ผ่าน sdformSetOne เท่านั้น เพราะ form_event ของ CPOE Order ตั้ง
 *      api_onevent on:'insert' → cpoe-order-no (6a6f92a0…) ไว้ ⇒ raw insertOne = ใบไม่มีเลขที่
 */

const FORM_ORDER = '6a6f5cd1265885c2377cc218';       // CPOE Order      → zdata_cpoe_order
const FORM_ORDER_ITEM = '6a6f7db2265885c2377cc222';  // CPOE Order Item → zdata_cpoe_order_item
const FORM_VISIT = '6a40fdec4b6dfdf45acbfbce';       // Visit           → zdata_visit
const FORM_SERVICE_TYPE = '6a58d02cd448dfc9d33e2bd6';// Service Type    → zdata_service_type
const FORM_ITEM_MASTER = '6a594763d448dfc9d33e2c27'; // CPOE Item       → zdata_master_item_order
const FORM_ORG = '6a3790c04cfbfdbe257f86fb';         // Organization    → zdata_organization
const PRICE_PROC = '6a71214c650bf6eb42f45ce4';       // cpoe-price-calc
const CHECK_PROC = '6a722956e5ad2347aff4d231';       // cpoe-drug-check (ทะเบียนกฎความปลอดภัย D8)

const FORM_COLL = 'sdform_manage';

/* ค่าที่ฟอร์ม CPOE Order ยอมรับ — ต้องตรงกับ optionItems ของ field จริง (ตรวจกับ form_model 2026-08-29)
   priority: select-input String · prior_medication: radio-input String */
const PRIORITY_VALUES = ['1', '2', '3', '4', '5'];
const PRIOR_MED_VALUES = ['1', '2'];
const STORAGE_VALUES = ['IM', 'RF', 'RT']; // ship_storage: radio-input ของ CPOE Order Item
const DRAFT = 'draft';
const SENT = 'sent';
const ACCEPTED = 'accepted';
const MAX_LINES = 200;   // กันตะกร้าที่เพี้ยน/ถูกยิงจาก client ปลอม ไม่ใช่ข้อจำกัดทางคลินิก

/* ── เภสัชแก้ใบที่ส่งแล้ว (C04 · b4 พี่เคาะ 2026-08-11) ────────────────────
   ใบ `sent`/`accepted` แก้ได้เฉพาะฝั่งห้องยา และเฉพาะ "ก่อนกดจัดยา" —
   หลัง `prepared` ยาจัดลงถุงแล้ว แก้ = ต้องจัดใหม่
   ฝั่งแพทย์กติกาเดิมทุกอย่าง: แก้ได้แค่ draft · ใบ sent มีทางเดียวคือยกเลิก (C43)
   ชุด role ยกมาจาก cpoe-drug-set/check-rule-set ตรง ๆ — ต้องเป็นชุดเดียวกันทั้งฝั่งเภสัช
   (admin/super ตัวเล็กคือ role ระบบเดิมที่ผู้ดูแลถืออยู่ ไม่ใช่ role งาน) */
const PIS_EDIT_ROLES = ['ADMIN', 'SUPER_ADMIN', 'PHARMA', 'PHARMA_HEAD', 'admin', 'super'];
const userRoles = Array.isArray(userInfo.roles) ? userInfo.roles : [];
const canPisEdit = PIS_EDIT_ROLES.some((r) => userRoles.indexOf(r) >= 0);

/* ── คลินิกผู้สั่ง `order_clinic` (dx-clinic-43 → CPOE · พี่เคาะ A1 C1 D1 2026-09-17) ─────────
   ใบเป็นของคลินิกที่ออกใบ — แก้/ลบ/ส่ง/ยกเลิก ได้เฉพาะ user ที่อยู่หน่วยนั้น (กติกาชุดเดียวกับ
   cpoe-order-list / send / cancel — แก้ที่ไหนต้องแก้ครบ 4 ตัว) · และเป็นค่า CLINIC ของ DRUG_OPD/CHARGE_OPD
   🔴 เก็บครั้งเดียวตอนสร้างใบ ห้ามอยู่ใน orderPatch — `xunitx` ใช้แทนไม่ได้ เพราะ initSaveForm
      เขียนทับเป็นหน่วยของคนบันทึกล่าสุดทุกครั้ง
   ข้ามกติกาได้เฉพาะ role ห้องยา **ที่กำลังอยู่หน่วยที่ไม่ใช่คลินิก** (C1 + พี่เคาะข้อ 2 2026-09-17)
   — admin/super ไม่ข้าม (ต่างจาก PIS_EDIT_ROLES ข้างบนโดยตั้งใจ)
   ใบที่ยังไม่มี order_clinic หรือไม่รู้หน่วยของ user = ไม่ล็อก */
const CLINIC_BYPASS_ROLES = ['PHARMA', 'PHARMA_HEAD'];
const myUnitCode = userInfo.unit && userInfo.unit.code ? String(userInfo.unit.code) : '';
const hasPharmaRole = CLINIC_BYPASS_ROLES.some((r) => userRoles.indexOf(r) >= 0);
let clinicBypass = false; // ตั้งจริงในขั้น 3 หลังรู้ว่าหน่วยปัจจุบันเป็นคลินิกไหม (tableOf ยังไม่ถูกนิยามตรงนี้)
const isOwnClinic = (order) => {
	const code = codeOf(order && order.order_clinic);
	return clinicBypass || !code || !myUnitCode || code === myUnitCode;
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const unwrap = (v) => (v && typeof v === 'object' && !Array.isArray(v) && 'value' in v ? v.value : v);
const codeOf = (v) => String(unwrap(v) == null ? '' : unwrap(v)).trim();
const oid = (id) => {
	try {
		return app.dbObjectId(String(id));
	} catch (e) {
		return null;
	}
};
const fail = (code, message, extra) => Object.assign({ success: false, code: code, message: message }, extra || {});

/* ── ค่าที่ลงช่อง select-data 'user-list' ต้องเป็น { value: ObjectId, label } ──
   🔴 `userInfo.account` เป็น { id, name } (รูปของ created_by/updated_by ที่ระบบ stamp)
      คนละรูปกับที่ widget อ่าน — select-data-input อ่าน `value.value` (SdCrudSelectSubForm.getValueSelect)
      ลงผิดรูปแล้วจอโชว์ `[object Object]` และ select match ไม่ติด (เจอจริง 2026-08-08 ที่ cosign_user)
   ช่องที่ต้องใช้ helper นี้: cosign_user · modify_user · status_stage[].stage_by (ทั้งใบและรายการ)
   ⚠️ `valueObjectId: true` ของ user-list ⇒ value ต้องเป็น ObjectId จริง ไม่ใช่ string hex */
const memberRef = (acc) => {
	if (!acc || !acc.id) return null;
	return { value: oid(String(acc.id)), label: acc.name || '' };
};
const currentMember = memberRef(userInfo.account);

/* ── แพทย์ผู้สั่ง (C10) — คนกดบันทึกไม่ใช่คนสั่งเสมอไป ─────────────────────
   พยาบาล/ผู้ช่วยคีย์แทนได้ ⇒ จอมี dropdown เลือกแพทย์ (provider `cpoe-doctor-list`)
   🔴 **ไม่เชื่อ label ที่จอส่งมา** — resolve จาก core_user สดทุกครั้ง แล้วประกอบ label เอง
      (จอเป็นฝั่ง client · ชื่อที่ลงในเอกสารทางคลินิกต้องมาจากฐานข้อมูลจริง)
   🔴 **เลือกคนที่ไม่ใช่ DOCTOR = ไม่ตีกลับใบ** แต่ fallback เป็นคนกดบันทึกแล้วรายงานกลับทาง
      `cosign_fallback` — หลักเดียวกับข้อ 5 ของพี่ (ระบบที่บล็อกสนิทโดนหาทางอ้อม)
      ถ้าตีกลับ หมอจะสั่งยาไม่ได้เพราะ dropdown ส่งค่าเพี้ยน ซึ่งอันตรายกว่าชื่อผู้สั่งไม่ตรง */
const DOCTOR_ROLE = 'DOCTOR';
const doctorRef = async (id) => {
	const o = oid(String(id || ''));
	if (!o) return null;
	const u = await app.db.collection('core_user').findOne({ _id: o }, { projection: { roles: 1, profile: 1, username: 1, email: 1 } });
	if (!u) return null;
	if (!Array.isArray(u.roles) || u.roles.indexOf(DOCTOR_ROLE) < 0) return null;
	const p = u.profile || {};
	const name = [p.fname, p.lname].filter(Boolean).join(' ') || u.username || '';
	// รูป label เดียวกับ user-list (`{{fname}} {{lname}} ( {{email}} )`) — จอเปิดใบเดิมมาแล้ว chip ตรง
	return { value: u._id, label: u.email ? name + ' ( ' + u.email + ' )' : name };
};

/* คนเก็บสิ่งส่งตรวจ (specimen_by) — เป็น select-data 'user-list' เหมือน cosign_user
   🔴 แต่ **ไม่เช็ค role** — คนเจาะเลือดคือพยาบาล/นักเทคนิค ไม่ใช่หมอ
      ใช้ doctorRef ตรงนี้ = ชื่อคนเก็บหายทุกครั้งที่พยาบาลเป็นคนเจาะ (ซึ่งคือเคสปกติ)
   🔴 ไม่เชื่อ label ที่จอส่งมาเหมือนกัน — resolve จาก core_user สดทุกครั้ง */
const userRef = async (id) => {
	const o = oid(String(id || ''));
	if (!o) return null;
	const u = await app.db.collection('core_user').findOne({ _id: o }, { projection: { profile: 1, username: 1, email: 1 } });
	if (!u) return null;
	const pf = u.profile || {};
	const name = [pf.fname, pf.lname].filter(Boolean).join(' ') || u.username || '';
	return { value: u._id, label: u.email ? name + ' ( ' + u.email + ' )' : name };
};

let cosignMember = currentMember;
let cosignFallback = '';
let doctorResolved = false; // จอส่ง cosign_user_id มาและเป็นหมอจริง — โหมดเภสัชแก้ใบใช้ตัดสินว่าจะคงผู้สั่งเดิมไหม
const pickedDoctor = String(params.cosign_user_id || '').trim();
if (pickedDoctor) {
	const found = await doctorRef(pickedDoctor);
	if (found) {
		cosignMember = found;
		doctorResolved = true;
	} else cosignFallback = 'NOT_A_DOCTOR';
}

/* ── resolve ชื่อ collection จาก form id ────────────────────────────────────
   🔴 ห้าม hardcode `zdata_<formId>` — ฟอร์มตั้งชื่อ table เองได้ (form_table)
      rename เมื่อไหร่ process ที่ hardcode จะพังเงียบ */
const tableCache = {};
const tableOf = async (formId) => {
	if (tableCache[formId] !== undefined) return tableCache[formId];
	const o = oid(formId);
	/* ดึง config ของช่องเลือก "ของต้นทาง" มาด้วย — ใช้ประกอบค่าให้ตรงรูปที่ฟอร์มเขียนเอง (ดู §4.5)
	   pick_drug = ยา · pick_master = รายการตรวจ (lab/x-ray/หัตถการ)
	   🔴 ลืมช่องไหนใน projection นี้ = ช่องนั้นถูกเขียนเป็น null เงียบ ๆ ทั้งใบ (เคสจริง pick_master ก่อน 09-01) */
	const doc = o
		? await app.db.collection(FORM_COLL).findOne(
				{ _id: o },
				{ projection: { form_table: 1, joiner_field: 1, 'form_db.schema.pick_drug': 1, 'form_db.schema.pick_master': 1 } },
		  )
		: null;
	tableCache[formId] = doc || null;
	return tableCache[formId];
};

/* ══ 1) ตรวจ input ═══════════════════════════════════════════════════════ */
const visitId = String(params.visit_id || '').trim();
if (!visitId || !oid(visitId)) return fail('NO_VISIT', 'ไม่พบ visit ของใบสั่ง — เปิดจอสั่งยาจากหน้า EMR อีกครั้ง');

const rawLines = Array.isArray(params.lines) ? params.lines.filter(Boolean) : [];
if (!rawLines.length) return fail('NO_LINES', 'ยังไม่มีรายการในใบสั่ง');
if (rawLines.length > MAX_LINES) return fail('TOO_MANY_LINES', 'รายการเกิน ' + MAX_LINES + ' บรรทัด');

// uid ของแต่ละบรรทัดคือกุญแจที่ใช้จับคู่ผลราคากลับ — ซ้ำ/ว่างเมื่อไหร่ราคาจะไปลงผิดบรรทัด
const lineKey = (l, i) => String(l.uid || l.line_id || ('l' + i));
const seenKey = {};
/* 🔴 `let` ไม่ใช่ `const` — ด่านชุดแม่-ลูก (C33) ข้างล่างคัดบรรทัดออกด้วย `lines = lines.filter(...)`
   (หัวชุด group ที่หลุดเข้ามา · ลูกที่ซ้ำกับแม่ในชุด exclusive) */
let lines = rawLines.map((l, i) => {
	let k = lineKey(l, i);
	while (seenKey[k]) k = k + '_' + i;
	seenKey[k] = true;
	return Object.assign({}, l, { _key: k });
});

const svcCode = codeOf(params.service_type) || 'med';

/* ── ชนิดของ "แต่ละรายการ" (spec §3.4 · พี่เคาะ 2026-08-29) ─────────────────
   1 ใบมีได้หลายชนิด — **ยกเว้นยา** · `order.service_type` ใช้ออก prefix เลขที่ใบเท่านั้น
   ตัวจริงที่ห้องปลายทางกรองคือ `item.service_type` ของแต่ละบรรทัด
   🔴 จอสั่งยาไม่ส่งค่านี้มา (ทั้งใบเป็นยาชนิดเดียว) ⇒ ไม่ส่ง = ตกมาใช้ชนิดของใบ เหมือนเดิมทุกประการ
      อย่าเปลี่ยนเป็น "บังคับส่ง" — จะทำให้ใบยาที่ใช้งานอยู่พังทันที */
const lineSvcCode = (l) => codeOf(l.service_type) || '';

/* 🔴 ยาแยกใบเสมอ — จอสั่งตรวจส่งรายการยาปนมาไม่ได้ (spec §3.4 ข้อ 5)
   หลุดมาเมื่อไหร่แปลว่าจอมีบั๊ก ต้องดังตั้งแต่ตรงนี้ ไม่ใช่ปล่อยให้ใบผสมยาไหลเข้า DB
   แล้วห้องยาไม่เห็น (ใบ prefix L ไม่ถูกส่งไปห้องยา) = ยาหายไปเงียบ ๆ ทั้งบรรทัด */
const medLines = lines.filter((l) => lineSvcCode(l) === 'med');
if (medLines.length && svcCode !== 'med') {
	return fail('MED_NOT_ALLOWED', 'ใบนี้มีรายการยาปนมา ' + medLines.length + ' รายการ — ยาต้องแยกใบและสั่งจากจอสั่งยา');
}

/* ทุกบรรทัดประกาศชนิดมาครบ และไม่มีบรรทัดไหนเป็นยา ⇒ ไม่มีอะไรให้ drug-check ตรวจ
   (ตรวจอยู่ = เสียเวลารอ subProcess 60KB ทุกครั้งที่บันทึกใบ lab/x-ray โดยได้ผลว่าง)
   🔴 เงื่อนไข "ประกาศครบทุกบรรทัด" สำคัญ — ขาดบรรทัดเดียวถือว่าไม่รู้ ต้องตรวจตามปกติ */
const declaredSvc = lines.map(lineSvcCode).filter(Boolean);
const skipDrugCheck = declaredSvc.length === lines.length && lines.length > 0;

/* ── master ของ "รายการตรวจ/บริการ" ที่อยู่ในใบ — โหลดครั้งเดียว ใช้ 2 เรื่อง ──
     1. `is_one`   clamp จำนวนเป็น 1
     2. ชุดแม่-ลูก (C31) ตัดสินว่าบรรทัดไหนเป็นลูกที่ต้องคิดราคา 0
   🔴 ทั้งสองเรื่องต้องเสร็จ **ก่อนคิดราคา** — ตัดสินทีหลังจะได้ราคาของสิ่งที่ไม่ได้สั่งจริง
   🔴 `tableOf()` ของไฟล์นี้คืน **doc ทั้งก้อน ไม่ใช่ชื่อ table** ⇒ ต้อง `.form_table` เสมอ
      (เคยพลาดมาแล้ว: ส่ง doc เข้า collection() ⇒ MongoServerError "Failed to parse namespace element"
       ทำให้ทุกใบที่มีรายการตรวจ throw ตั้งแต่ก่อนคิดราคา — บันทึกใบไม่ได้เลย)
   เฉพาะบรรทัดที่มาจากแคตตาล็อกรายการตรวจ ไม่แตะบรรทัดยา (จอสั่งยาไม่เดินทางนี้) */
const itemLines = lines.filter((l) => String(l.item_form_id || '') === FORM_ITEM_MASTER);
const itemMasterById = {};
// เก็บไว้ใช้ต่อตอนตรวจความครบของชุด group — ต้อง query ลูกที่ payload ไม่ได้ส่งมา
let itemMasterTable = '';
if (itemLines.length) {
	const masterForm = await tableOf(FORM_ITEM_MASTER);
	const masterTable = masterForm && masterForm.form_table;
	/* อ่าน master ไม่ได้ = clamp is_one ไม่ได้ และแยกแม่-ลูกไม่ได้ ⇒ ราคาที่ออกมาเชื่อไม่ได้
	   ตีกลับดีกว่าบันทึกใบที่อาจเก็บเงินผิด (หลักเดียวกับ PRICE_FAILED) */
	if (!masterTable) return fail('FORM_MISSING', 'อ่านโครงฟอร์มรายการตรวจ (CPOE Item) ไม่ได้ จึงยังบันทึกใบไม่ได้');
	itemMasterTable = masterTable;
	const ids = itemLines.map((l) => oid(l.item_data_id)).filter(Boolean);
	/* 🔴 ไม่ใส่ projection โดยตั้งใจ — master ก้อนนี้ถูกใช้ต่อ 2 งานที่ต้องการคนละชุดช่อง:
	     (ก) ตัดสินชุดแม่-ลูก/is_one ที่นี่ (item_code, is_one, sub_order, lab_parent)
	     (ข) ประกอบ `pick_master` + หมวดเบิกตอนเขียนใบ (§4.5) ซึ่งอ่าน refField จาก schema **แบบ dynamic**
	   ⇒ projection ที่นี่ = hardcode ชุดช่องล่วงหน้า วันที่มีคนเพิ่ม ref field ในฟอร์ม ใบจะขาดของนั้นเงียบ ๆ
	     (เคสจริง 09-01: projection 5 ช่อง ⇒ pick_master/category_id ของรายการตรวจว่างทั้งระบบ)
	   ต้นทุนที่แลกมา: master item ~2 KB/แถว (max 3.8 KB · วัด 2026-09-01) × ไม่เกิน MAX_LINES แถว */
	const rows = ids.length ? await app.db.collection(masterTable).find({ _id: { $in: ids } }).toArray() : [];
	rows.forEach((r) => {
		itemMasterById[String(r._id)] = r;
	});
}

/* ── รายการที่สั่งได้ครั้งละ 1 ชิ้น (master `is_one`) ──────────────────────
   🔴 บังคับที่ server ด้วย ไม่ใช่เชื่อจอ — จอปิดปุ่มเพิ่มให้แล้ว แต่ payload ปลอมได้
      และใบเก่าที่ "สั่งซ้ำ" มาอาจพก qty เดิมติดมา · qty ผิด = เก็บเงินคนไข้ผิด */
lines.forEach((l) => {
	const m = itemMasterById[String(l.item_data_id)];
	if (m && m.is_one === true && Number(l.quantity) !== 1) {
		app.log.warn('[cpoe-order-save] is_one — ปรับจำนวน ' + (l.item_name || l.item_code) + ' จาก ' + l.quantity + ' เป็น 1');
		l.quantity = 1;
	}
});

/* ── ชุดแม่-ลูก (C33 · พี่เคาะ 2026-08-30 ตาม design/lab-ui-config.drawio) ──────
   🔴 **ไม่มีบรรทัดราคา 0 อีกแล้ว** — ทุกบรรทัดในใบคิดราคาจริงของตัวเอง
      ด่านนี้จึงไม่ได้ "ตั้งราคา" แต่ **คัดว่าบรรทัดไหนมีสิทธิ์อยู่ในใบ** ก่อนส่งไปคิดเงิน

   sk='g' group (`sub_order` — C25-CD ฿160 = ลูก ฿40×4)
     · หัวชุดไม่ใช่ของที่ขายได้ ⇒ อยู่ในใบไม่ได้ ตัดทิ้ง
     · ลูกต้องครบชุด — ขาดตัวใดตัวหนึ่งคือจ่าย ฿40 แต่ห้องแลปตรวจ 4 ค่า ⇒ ตีกลับ
       (ยกเว้นตัวที่ขาดถูกปิดใช้งานไปแล้ว — สั่งไม่ได้จริง ปล่อยผ่าน + log)

   sk='x' exclusive (`lab_parent` — C1 ฿320 vs ลูกรวม ฿340)
     · แม่กับลูกอยู่ในใบพร้อมกัน = เก็บเงินซ้ำ ⇒ **แม่ชนะ ตัดลูกออก**
       (ราคาชุดถูกกว่าไล่สั่งลูกเสมอ ⇒ ตัดลูกไม่มีทางเก็บเกินกว่าที่หมอเห็นบนจอ · ตรงกับ normalizeSets ในจอ)

   🔴 ตัดสินจาก master เอง **ไม่เชื่อธงที่จอส่งมา** — จอปลอม payload ได้ และนี่คือเงินคนไข้
   🔴 ชี้กันด้วย `item_code` ไม่ใช่ `_id` (กติกาเดียวกับ linkKin ใน cpoe-item-catalog — แก้ที่นี่ต้องดูตัวนั้นด้วย) */
const masterByCode = {};
Object.keys(itemMasterById).forEach((k) => {
	const m = itemMasterById[k];
	if (m.item_code) masterByCode[m.item_code] = m;
});

/* แผนผังชุดจาก master ของบรรทัดที่อยู่ในใบ — ต่างจาก catalog ตรงที่ตรงนี้เห็นเฉพาะของในใบ
   ⇒ ชุด group ต้องอ่าน `sub_order` จากตัวแม่ที่ "ลูกในใบชี้ไปหา" ด้วย ไม่ใช่แค่แม่ที่อยู่ในใบ */
/* 🔴 ชุด group แม่ **ไม่อยู่ในใบ** โดยดีไซน์ ⇒ อ่าน `sub_order` จาก master ที่โหลดมากับบรรทัดไม่ได้เลย
   ต้อง query แม่ที่ลูกชี้ไปด้วย `lab_parent` ก่อน แล้วค่อยตัดสินว่าเป็นชุดชนิดไหน
   (เคยพลาดตรงนี้ 2026-08-30: groupOf ว่างตลอด ⇒ ลูกถูกจัดเป็น exclusive ⇒ guard ครบชุดไม่เคยทำงาน) */
const parentCodes = {};
Object.keys(masterByCode).forEach((c) => {
	const p = masterByCode[c].lab_parent && masterByCode[c].lab_parent.value;
	if (p) parentCodes[String(p).trim()] = 1;
});
const parentMaster = {}; // parentCode -> { item_code, sub_order }
Object.keys(masterByCode).forEach((c) => {
	parentMaster[c] = masterByCode[c]; // แม่ที่บังเอิญอยู่ในใบด้วย (ชุด exclusive)
});
const askCodes = Object.keys(parentCodes).filter((c) => !parentMaster[c]);
if (askCodes.length && itemMasterTable) {
	const prows = await app.db
		.collection(itemMasterTable)
		.find({ item_code: { $in: askCodes } }, { projection: { item_code: 1, sub_order: 1, lab_parent: 1 } })
		.toArray();
	prows.forEach((r) => {
		parentMaster[r.item_code] = r;
	});
}

const subListOf = (code) => {
	const m = parentMaster[code];
	const v = m && m.sub_order && Array.isArray(m.sub_order.value) ? m.sub_order.value : [];
	return v.map((x) => String(x || '').trim()).filter(Boolean);
};

const groupOf = {}; // childCode -> parentCode (ชุด group — แม่ไม่เข้าใบ ลูกต้องครบ)
const xParentOf = {}; // childCode -> parentCode (ชุด exclusive — แม่ XOR ลูก)
Object.keys(masterByCode).forEach((c) => {
	const p = masterByCode[c].lab_parent && masterByCode[c].lab_parent.value
		? String(masterByCode[c].lab_parent.value).trim() : '';
	if (!p || p === c) return;
	// แม่ประกาศ sub_order ที่มีลูกตัวนี้อยู่ = ชุด group · ไม่งั้นเป็น exclusive
	if (subListOf(p).indexOf(c) >= 0) groupOf[c] = p;
	else xParentOf[c] = p;
});

/* 1) หัวชุด group ที่หลุดเข้ามาในใบ — ตัดทิ้ง (ไม่ใช่ของที่ขายได้ · ลูกถือราคาแทนครบแล้ว)
      มาได้ 2 ทาง: payload ที่ปลอม/เก่า และใบที่บันทึกด้วยกติกา C31 ก่อน 08-30 */
const dropHead = [];
lines = lines.filter((l) => {
	const m = itemMasterById[String(l.item_data_id)];
	const isHead = m && m.sub_order && Array.isArray(m.sub_order.value) && m.sub_order.value.length > 0;
	if (!isHead) return true;
	dropHead.push(m.item_code);
	return false;
});
if (dropHead.length) {
	app.log.warn('[cpoe-order-save] ชุด group — ตัดบรรทัดหัวชุดออก ' + dropHead.length + ' บรรทัด (' + dropHead.join(' · ') + ') ลูกเป็นตัวถือราคา');
}

/* 2) ชุด group ต้องครบ — เทียบลูกในใบกับ `sub_order` ของแม่
      🔴 ขาดแล้วปล่อยผ่าน = คนไข้จ่าย ฿40 แต่ห้องแลปได้ใบสั่งตรวจ 4 ค่า */
const inCode = {};
lines.forEach((l) => {
	const m = itemMasterById[String(l.item_data_id)];
	if (m && m.item_code) inCode[m.item_code] = 1;
});
const missSet = {};
Object.keys(inCode).forEach((c) => {
	const par = groupOf[c];
	if (!par || missSet[par]) return;
	const miss = subListOf(par).filter((x) => !inCode[x]);
	if (miss.length) missSet[par] = miss;
});
const missAll = [];
Object.keys(missSet).forEach((p) => missSet[p].forEach((c) => missAll.push(c)));
// ลูกที่ขาดแต่ "ถูกปิดใช้งานไปแล้ว" ไม่ใช่ความผิดของคนสั่ง — สั่งไม่ได้จริง ⇒ ยกเว้นให้
if (missAll.length && itemMasterTable) {
	const alive = await app.db
		.collection(itemMasterTable)
		.find({ item_code: { $in: missAll }, use_status: true, xrstatx: 1 }, { projection: { item_code: 1 } })
		.toArray();
	const aliveCode = {};
	alive.forEach((r) => {
		aliveCode[r.item_code] = 1;
	});
	const blocking = missAll.filter((c) => aliveCode[c]);
	const retired = missAll.filter((c) => !aliveCode[c]);
	if (retired.length) {
		app.log.warn('[cpoe-order-save] ชุด group — ลูกที่ขาดถูกปิดใช้งานแล้ว ' + retired.join(' · ') + ' ปล่อยผ่าน');
	}
	if (blocking.length) {
		return fail(
			'SET_INCOMPLETE',
			'รายการชุดต้องสั่งครบทั้งชุด — ยังขาด ' + blocking.join(' · ') + ' กรุณาเลือกที่ชุดในจออีกครั้ง',
			{ missing_items: blocking },
		);
	}
}

/* 3) ชุด exclusive — แม่อยู่ในใบแล้ว ลูกต้องออก (เก็บเงินซ้ำ) */
const dropKid = [];
lines = lines.filter((l) => {
	const m = itemMasterById[String(l.item_data_id)];
	const par = m && m.item_code ? xParentOf[m.item_code] : '';
	if (!par || !inCode[par]) return true;
	dropKid.push(m.item_code + '→' + par);
	return false;
});
if (dropKid.length) {
	app.log.warn('[cpoe-order-save] ชุด exclusive — ตัดบรรทัดลูกที่ซ้ำกับแม่ในใบ ' + dropKid.length + ' บรรทัด (' + dropKid.join(' · ') + ')');
}

// ธงบอกที่มาของบรรทัด (ใช้เขียน from_set ลงใบ) — ชุด group เท่านั้น ไม่มีผลกับราคาแล้ว
lines.forEach((l) => {
	const m = itemMasterById[String(l.item_data_id)];
	l._sub_of = m && m.item_code && groupOf[m.item_code] ? groupOf[m.item_code] : '';
});
const subLineCount = lines.filter((l) => l._sub_of).length;
if (subLineCount) {
	app.log.info('[cpoe-order-save] ชุด group — บรรทัดในชุด ' + subLineCount + ' บรรทัด (คิดราคาจริงรายบรรทัด)');
}

/* สิทธิ์ของใบ — sub-form inscl_hos (main: valueField 'inscl_hos_code' · sub: valueField 'code')
   🔴 ตั้งแต่ 2026-09-20 ใบเก็บ **ลำดับสิทธิ์ทั้งชุด** ไม่ใช่สิทธิ์เดียว เพราะราคาถูกตัดสินรายบรรทัด
      (ยาตัวหนึ่งเบิก OFC อีกตัวตกไปชำระเองได้ในใบเดียวกัน) ⇒ ใบต้องบอกได้ว่าตอนสั่งมีสิทธิ์อะไรลำดับไหน
   🔴 แถวแรก = สิทธิ์หลักเสมอ — cpoe-order-get:206 และจอทั้งสองยังอ่าน inscl_hos[0] เป็นสิทธิ์ของใบ
      สิทธิ์ที่ "ใช้จริง" ของแต่ละบรรทัดอยู่ที่ inscl_main/inscl_sub ในรายการ (CPOE Order Item) */
const insRowOf = (r) => {
	if (!r || typeof r !== 'object') return null;
	const mainSrc = r.inscl_item_main != null ? r.inscl_item_main : r.main;
	const subSrc = r.inscl_item_sub != null ? r.inscl_item_sub : r.sub;
	const main = codeOf(mainSrc);
	if (!main) return null;
	const sub = codeOf(subSrc);
	return {
		inscl_item_main: { value: main, label: (mainSrc && mainSrc.label) || main },
		inscl_item_sub: sub ? { value: sub, label: (subSrc && subSrc.label) || sub } : null,
	};
};
// จอรุ่นใหม่ส่ง inscl_list (แถวดิบจาก visit.inscl_hos) · รุ่นเก่าส่ง inscl + inscl_row = สิทธิ์เดียว
const insclChainIn = Array.isArray(params.inscl_list) && params.inscl_list.length
	? params.inscl_list
	: params.inscl
	? [params.inscl_row || params.inscl]
	: [];
const insclRows = insclChainIn.map(insRowOf).filter(Boolean);

/* ══ 2) คิดราคาใหม่ฝั่ง server ═══════════════════════════════════════════ */
const priceRes = await app.subProcess(
	PRICE_PROC,
	{
		/* 🔴 ส่ง "ลำดับสิทธิ์ทั้งชุด" ไม่ใช่สิทธิ์เดียว — price-calc ไล่ทีละสิทธิ์ต่อรายการ (พี่เคาะ 2026-09-20)
		   จอรุ่นเก่าที่ยังส่ง inscl เดี่ยวมาก็ยังบันทึกได้ (chain ยาว 1) ⇒ ทยอยอัปเดตจอได้ไม่ต้องพร้อมกัน */
		inscl_list: insclChainIn,
		lines: lines.map((l) => ({
			line_id: l._key,
			item_form_id: l.item_form_id,
			item_data_id: l.item_data_id,
			quantity: l.quantity,
			price_overwrite: l.price_overwrite,
			// 🔴 ไม่ส่ง is_sub แล้ว (C33) — ทุกบรรทัดคิดราคาจริง · ตัวกันเงินซ้ำคือการคัดบรรทัดข้างบน
			sub_of: l._sub_of,
		})),
	},
	userInfo,
);
// subProcess คืน { success, message, data } — ผลของ process อยู่ที่ .data
const price = (priceRes && priceRes.data) || null;
if (!priceRes || !priceRes.success || !price || !Array.isArray(price.lines)) {
	return fail('PRICE_FAILED', 'คิดราคาไม่สำเร็จ จึงยังบันทึกใบไม่ได้: ' + ((priceRes && priceRes.message) || 'ไม่ทราบสาเหตุ'));
}

const priceByKey = {};
price.lines.forEach((r) => {
	if (r && r.line_id != null) priceByKey[String(r.line_id)] = r;
});

// 🔴 รายการที่ราคาออกไม่ได้ = ตีกลับทั้งใบ พร้อมบอกว่าเป็นบรรทัดไหน (ไม่หยุดที่บรรทัดแรก)
const badLines = [];
lines.forEach((l) => {
	const p = priceByKey[l._key];
	if (!p || !p.found) {
		badLines.push({ uid: l._key, item_name: l.item_name || '', reason: 'ไม่พบรายการต้นทางในระบบ' });
	} else if (p.unit_price === null || p.unit_price === undefined) {
		badLines.push({ uid: l._key, item_name: p.item_name || l.item_name || '', reason: 'ไม่มีราคาของรายการนี้ — ต้องกรอกราคาเอง' });
	}
});
if (badLines.length) {
	return fail('PRICE_INCOMPLETE', 'มี ' + badLines.length + ' รายการที่ยังไม่มีราคา จึงบันทึกใบไม่ได้', { invalid_lines: badLines });
}

const totals = price.totals || { total_amount: 0, claim_amount: 0, paid_amount: 0 };

/* ══ 2.5) ตรวจความปลอดภัยยาใหม่ฝั่ง server (D8) ══════════════════════════
   จอตรวจให้ระหว่างจัดยาแล้ว แต่เชื่อไม่ได้ 100% — ตะกร้าค้างข้ามวันได้ และใบอื่นของวิสิท
   อาจเพิ่งถูกสั่งโดยหมอคนอื่นระหว่างที่จอเปิดค้าง ⇒ ผลที่ "ติดไปกับใบ" ต้องเป็นของรอบนี้เท่านั้น

   🔴 ต่างจากราคา: ตรวจไม่สำเร็จ **ไม่ตีกลับใบ**
      ราคาผิด = เก็บเงินผิดจริงทันที · ส่วนใบร่างที่ยังไม่ถูกส่ง ห้องยายังไม่เห็น และด่านจริงคือตอน "ส่งใบ"
      แต่ห้ามเงียบ — ทุกบรรทัดต้องติดธงไว้ว่า "รอบนี้ยังไม่ได้ตรวจ" ไม่ใช่ปล่อยเป็นบรรทัดที่ดูสะอาด */
const checkByKey = {};
let checkFailed = '';
if (skipDrugCheck) {
	// ใบที่ไม่มียาเลย — ไม่มีอะไรให้ตรวจ · เขียน log ไว้ให้ตามได้ว่าข้ามเพราะอะไร ไม่ใช่ข้ามเงียบ
	app.log.info('[cpoe-order-save] ข้าม drug-check — ใบไม่มีรายการยา (' + lines.length + ' บรรทัด · ชนิด ' + declaredSvc.join(',') + ')');
} else {
	try {
		const checkRes = await app.subProcess(
			CHECK_PROC,
			{
				visit_id: visitId,
				order_id: String(params.order_id || ''),   // ใบที่กำลังแก้ ไม่นับเป็น "ใบอื่นของวิสิท"
				lines: lines.map((l) => ({
					line_id: l._key,
					item_form_id: l.item_form_id,
					item_data_id: l.item_data_id,
					quantity: l.quantity,
					qty_calc_source: l.qty_calc_source,
					sig: l.sig,
					comment: l.comment,
					// ใบกำกับที่จอผูกมากับบรรทัด — กฎ prescriber_temp ใช้ตัดสินว่ายังขาดใบไหม
					temp_id: l.temp_id || '',
				})),
			},
			userInfo,
		);
		const chk = (checkRes && checkRes.data) || null;
		if (checkRes && checkRes.success && chk && chk.success && Array.isArray(chk.lines)) {
			chk.lines.forEach((r) => {
				if (r && r.line_id != null) checkByKey[String(r.line_id)] = Array.isArray(r.alerts) ? r.alerts : [];
			});
		} else {
			checkFailed = (chk && chk.message) || (checkRes && checkRes.message) || 'ไม่ทราบสาเหตุ';
		}
	} catch (e) {
		checkFailed = (e && e.message) || String(e);
	}
}
if (checkFailed) app.log.warn('[cpoe-order-save] drug-check ล้ม: ' + checkFailed);

/* ══ 3) โหลด visit + master ที่ต้องใช้ประกอบใบ ═══════════════════════════ */
const visitForm = await tableOf(FORM_VISIT);
const orderForm = await tableOf(FORM_ORDER);
const itemForm = await tableOf(FORM_ORDER_ITEM);
const svcForm = await tableOf(FORM_SERVICE_TYPE);
if (!visitForm || !orderForm || !itemForm) return fail('FORM_MISSING', 'อ่านโครงฟอร์ม CPOE ไม่ได้ (sdform_manage)');

const visitRes = await app.dbFindById(oid(visitId), visitForm.form_table);
const visit = visitRes && visitRes.success ? (visitRes.reply || {}).data : null;
if (!visit) return fail('VISIT_NOT_FOUND', 'ไม่พบ visit ' + visitId);

// service_type ของใบ/รายการเป็น select-form ที่ valueField = 'code' ⇒ เก็บ { value:<code>, label:<name> }
// 🔴 value ต้องเป็น code ไม่ใช่ _id — cpoe-order-no อ่านค่านี้ไปเลือก prefix ของเลขที่ใบ
let svcObj = { value: svcCode, label: svcCode };
if (svcForm && svcForm.form_table) {
	const svcDoc = await app.db.collection(svcForm.form_table).findOne({ code: svcCode, xrstatx: 1 }, { projection: { code: 1, name: 1 } });
	if (svcDoc) svcObj = { value: svcDoc.code, label: svcDoc.name || svcDoc.code };
}

/* ชนิดของแต่ละบรรทัด — resolve เป็น { value:<code>, label:<name> } แบบเดียวกับหัวใบ
   อ่าน master ครั้งเดียวต่อ code (ใบผสมชนิดมีไม่เกิน 4 ชนิด) ⇒ ไม่ยิง query ต่อบรรทัด */
const svcCache = {};
svcCache[svcCode] = svcObj;
const svcOfLine = async (l) => {
	const c = lineSvcCode(l);
	if (!c) return svcObj; // ไม่ประกาศ = ตกมาใช้ชนิดของใบ (จอสั่งยาเดินทางนี้)
	if (svcCache[c]) return svcCache[c];
	let obj = { value: c, label: c };
	if (svcForm && svcForm.form_table) {
		const doc = await app.db.collection(svcForm.form_table).findOne({ code: c, xrstatx: 1 }, { projection: { code: 1, name: 1 } });
		if (doc) obj = { value: doc.code, label: doc.name || doc.code };
	}
	svcCache[c] = obj;
	return obj;
};


/* คลินิกผู้สั่งของ "ใบใหม่" (A1) — หน่วยของคนบันทึก ถ้าเป็นคลินิกจริง ไม่งั้นคลินิกแรกของ visit
   คลินิกจริง = Organization unit_type 'clinic' **และมี ref_code 5 หลัก** (รหัส CLINIC ของ 43 แฟ้ม)
   🔴 เช็ค ref_code ด้วยเพราะห้องยา (m01.p) / การเงิน (d01.p) ถูกตั้ง unit_type 'clinic' ไว้เหมือนกัน
      ⇒ เภสัช/ผู้ช่วยออกใบแทน หรือ process อัตโนมัติ (ipd-order-create · appt-items-promote ได้หน่วย CENTER)
      ตกไปใช้คลินิกแรกของ visit แทน ไม่ใช่ลงห้องยาเป็นคลินิก */
const myClinicalUnit = await (async () => {
	const orgForm = await tableOf(FORM_ORG);
	if (!myUnitCode || !orgForm || !orgForm.form_table) return null;
	const org = await app.db
		.collection(orgForm.form_table)
		.findOne({ unit_code: myUnitCode, unit_type: 'clinic', xrstatx: 1 }, { projection: { unit_code: 1, unit_name: 1, ref_code: 1 } });
	return org && /^\d{5}$/.test(String(org.ref_code || '')) ? org : null;
})();
// role ห้องยาข้ามได้เฉพาะตอนอยู่หน่วยที่ไม่ใช่คลินิก — account หลาย role (DOCTOR+PHARMA) ที่อยู่คลินิกต้องโดนล็อกเหมือนหมอ
clinicBypass = hasPharmaRole && !myClinicalUnit;

/* หน่วยแลปแก้ใบร่าง "แลปล้วน" ที่ order_clinic เป็นคลินิกได้ (พี่เคาะ 2026-09-21) — ชุดเดียวกับ cpoe-order-send/list/cancel
   ต้นเหตุ: ใบใหม่ที่แลปสร้างได้ order_clinic = คลินิกของวิสิท (resolveOrderClinic) ⇒ พอกดบันทึกซ้ำ/ส่ง
      ใบตัวเองกลายเป็น "ใบของคลินิกอื่น" ถูกตีกลับ ค้างเป็นร่าง
   🔴 LAB/X-ray ข้ามได้เฉพาะเมื่อ "รายการเดิมในใบ" และ "รายการที่ส่งมาใหม่" เป็น service
      ของหน่วยนั้นทุกบรรทัด (กันเอาใบชนิดอื่นของคลินิกมาเขียนทับ หรือแอบเติมรายการผสม) */
const LAB_UNIT_TYPE = 'lab';
const XRAY_UNIT_TYPE = 'xray';
const serviceUnit = await (async () => {
	if (!myUnitCode) return { isLab: false, isXray: false };
	const orgForm = await tableOf(FORM_ORG);
	if (!orgForm || !orgForm.form_table) return { isLab: false, isXray: false };
	const org = await app.db
		.collection(orgForm.form_table)
		.findOne({ unit_code: myUnitCode, xrstatx: 1 }, { projection: { _id: 1, unit_type: 1, unit_parent: 1 } });
	if (!org) return { isLab: false, isXray: false };
	let isXray = org.unit_type === XRAY_UNIT_TYPE;
	/* หน่วยทำงานรังสีจริงเป็น Organization ลูกชนิด clinic (เช่น RA-11/RA-309)
	   โดย parent เป็น SelectByForm {value:<Organization _id>,label:<unit_code>} ของ root ชนิด xray */
	if (!isXray && org.unit_parent) {
		const parentId = codeOf(org.unit_parent.value);
		const parentOid = parentId && oid(parentId);
		isXray = !!(parentOid && (await app.db.collection(orgForm.form_table).findOne(
			{ _id: parentOid, unit_type: XRAY_UNIT_TYPE, xrstatx: 1 },
			{ projection: { _id: 1 } },
		)));
	}
	return { isLab: org.unit_type === LAB_UNIT_TYPE, isXray: isXray };
})();
const ownsServiceDraft = async (id, serviceType) => {
	// บรรทัดที่ไม่ประกาศชนิด = ใช้ชนิดของใบ (lineSvcCode) — ต้องนับแบบเดียวกับตอนเขียนรายการ
	if (!lines.length || !lines.every((l) => (lineSvcCode(l) || svcCode) === serviceType)) return false;
	const itemColl = app.db.collection(itemForm.form_table);
	const base = { 'order_id.value': { $in: [String(id), oid(id)].filter(Boolean) }, xrstatx: 1 };
	const total = await itemColl.countDocuments(base);
	const otherService = await itemColl.countDocuments(Object.assign({}, base, { 'service_type.value': { $ne: serviceType } }));
	return total > 0 && otherService === 0;
};
const labOwnsDraft = (id) => ownsServiceDraft(id, LAB_UNIT_TYPE);
const xrayOwnsDraft = (id) => ownsServiceDraft(id, XRAY_UNIT_TYPE);

const resolveOrderClinic = async () => {
	if (myClinicalUnit) {
		return { value: String(myClinicalUnit.unit_code), label: String(myClinicalUnit.unit_code) + (myClinicalUnit.unit_name ? ' ' + myClinicalUnit.unit_name : '') };
	}
	const vc = visit.visit_clinic;
	const vcCode = codeOf(vc);
	return vcCode ? { value: vcCode, label: (vc && vc.label) || vcCode } : null;
};

const now = app.curDate();
const stage = {
	stage_status: DRAFT,
	stage_at: now,
	stage_by: currentMember,
	stage_location: null,   // ห้องยาปลายทางยังไม่เคาะ — เติมตอน "ส่งใบสั่งยา" (order_to_location เหมือนกัน)
	stage_reason: '',
};

/* ══ 4) หัวใบ — สร้างใหม่ หรือแก้ใบร่างเดิม ═══════════════════════════════ */
const orderPatch = {
	service_type: svcObj,
	current_status: DRAFT,
	inscl_hos: insclRows,
	item_count: lines.length,
	total_amount: round2(totals.total_amount),
	claim_amount: round2(totals.claim_amount),
	paid_amount: round2(totals.paid_amount),
	order_comment: params.order_comment == null ? '' : String(params.order_comment),
	order_tags: Array.isArray(params.order_tags) ? params.order_tags : [],
	/* ความเร่งด่วนระดับใบ (C13) — select-input เก็บเป็น String '1'-'5' ตาม optionItems ของฟอร์ม
	   ไม่ส่งมา = '1' ปกติ (ตรงกับ default ของฟอร์ม) · ค่าที่ไม่รู้จักตกมาเป็น '1' ไม่ใช่เก็บค่าเพี้ยนลงใบ */
	priority: PRIORITY_VALUES.indexOf(String(params.priority || '')) >= 0 ? String(params.priority) : '1',
	/* "ยาที่เคยรับ" (C13) — radio-input String '1'/'2' · '' = ยังไม่ตอบ (ฟอร์มไม่บังคับ)
	   🔴 prior_specify เก็บเฉพาะตอนตอบ "ได้รับแล้ว" — ตอบ "ยังไม่ได้รับ" แล้วยังมีข้อความค้าง
	      = ใบขัดแย้งในตัวเอง (บอกว่ายังไม่ได้รับ แต่ระบุชื่อยาที่ได้รับไว้) */
	prior_medication: PRIOR_MED_VALUES.indexOf(String(params.prior_medication || '')) >= 0 ? String(params.prior_medication) : '',
	prior_specify: String(params.prior_medication || '') === '2' ? String(params.prior_specify || '').trim() : '',
	cosign_user: cosignMember,    // แพทย์ผู้สั่งที่เลือกในจอ · ไม่ได้เลือก = คนที่กดบันทึก (C10)
	modify_user: currentMember,   // คนกดบันทึกจริงเสมอ — คนละคำถามกับ "ใครสั่ง"
	is_refill: false,
};

const editId = String(params.order_id || '').trim();
let orderId = '';
let mode = 'insert';
let eventOrderNo = null;   // เลขที่ใบที่ api_onevent คืนมาทาง response (ยังไม่ได้ลง DB — ดูหมายเหตุใต้ block นี้)
// สถานะที่รายการ (เขียนใหม่ทั้งชุดในขั้น 5) ต้องได้ — ต้องตามหัวใบเสมอ ไม่งั้น pis-order-prepare/paid/dispense
// ที่ updateMany รายการด้วย filter สถานะจะ match ไม่ติด (item_updated = 0 เงียบ ๆ)
let itemStatus = DRAFT;
let itemStages = null;   // null = ใช้ [stage] ปกติ · โหมดเภสัชแก้ใบ = สำเนาไทม์ไลน์หัวใบ

if (editId) {
	/* แก้ใบเดิม — guard 3 ชั้นก่อนเขียนทับ */
	if (!oid(editId)) return fail('BAD_ORDER_ID', 'order_id ไม่ถูกต้อง');
	const oldRes = await app.dbFindById(oid(editId), orderForm.form_table);
	const old = oldRes && oldRes.success ? (oldRes.reply || {}).data : null;
	if (!old) return fail('ORDER_NOT_FOUND', 'ไม่พบใบสั่งที่จะแก้ (' + editId + ')');
	const oldStatus = String(old.current_status || '');
	/* 🔴 ใบที่ส่งไปห้องยาแล้ว ฝั่งแพทย์ห้ามเขียนทับ (ข้อความ/code เดิม — จอหมอ handle อยู่แล้ว)
	   ยกเว้นฝั่งห้องยา (C04 · b4): sent/accepted + role PHARMA/ADMIN = แก้ได้ · prepared ขึ้นไป = จบทุกฝั่ง */
	const isPisEdit = (oldStatus === SENT || oldStatus === ACCEPTED) && canPisEdit;
	if (oldStatus !== DRAFT && !isPisEdit) {
		return fail('ORDER_NOT_DRAFT', 'ใบนี้ไม่ใช่ใบร่างแล้ว (สถานะ ' + old.current_status + ') จึงแก้จากจอสั่งยาไม่ได้');
	}
	if (String((old.vid || {}).value || '') !== visitId) {
		return fail('VISIT_MISMATCH', 'ใบนี้เป็นของวิสิทอื่น');
	}
	// ใบร่างของคลินิกอื่น — LAB/X-ray ข้ามได้เฉพาะใบล้วนของหน่วยตนเอง; ใบผสมยังถูกล็อก
	const serviceUnitBypass =
		(serviceUnit.isLab && (await labOwnsDraft(editId))) ||
		(serviceUnit.isXray && (await xrayOwnsDraft(editId)));
	if (oldStatus === DRAFT && !isOwnClinic(old) && !serviceUnitBypass) {
		return fail('NOT_ORDER_CLINIC', 'ใบนี้ออกโดยคลินิก ' + ((old.order_clinic && old.order_clinic.label) || codeOf(old.order_clinic)) + ' — แก้ได้เฉพาะคลินิกที่ออกใบ', {
			order_clinic: codeOf(old.order_clinic),
		});
	}

	orderId = editId;
	mode = 'update';
	if (oldStatus === DRAFT) {
		const record = Object.assign({}, old, orderPatch, {
			status_stage: Array.isArray(old.status_stage) && old.status_stage.length ? old.status_stage : [stage],
			// ใบเก่าก่อนมี order_clinic (ยังไม่ backfill) ได้คลินิกตอนแก้ครั้งแรก · มีแล้วคงเดิมเสมอ
			order_clinic: old.order_clinic && codeOf(old.order_clinic) ? old.order_clinic : await resolveOrderClinic(),
		});
		const saved = await app.sdformSetOne(FORM_ORDER, orderId, record, 1, userInfo);
		if (!saved || saved.success === false) return fail('ORDER_SAVE_FAILED', 'บันทึกหัวใบไม่สำเร็จ: ' + ((saved || {}).message || ''));
	} else {
		/* โหมดเภสัชแก้ใบ sent/accepted — เขียนหัวใบแบบ guard สถานะใน filter (หลักเดียวกับ order-send/cancel/prepare)
		   ใช้ sdformSetOne ไม่ได้เพราะไม่มี filter ให้ — ระหว่างอ่านใบกับเขียน อีกจออาจกดจัดยา/ยกเลิกไปแล้ว
		   เขียนทับโดยไม่ guard = ดึงสถานะใบถอยหลังเงียบ ๆ (ใบ prepared กลายเป็น sent)
		   🔴 แก้ "เนื้อใบ" อย่างเดียว — ไม่แตะ current_status / status_stage (ไทม์ไลน์เดิมอยู่ครบ)
		   ⚠️ ช่องว่างที่เหลือ: รายการ (ขั้น 5 ลบ+เขียนใหม่) ไม่ atomic กับหัวใบ — ชนวินาทีเดียวกับ prepare
		      ยังเกิด item สถานะไม่ตรงหัวใบได้ ยอมรับไว้ก่อน (ห้องยาเดียวกัน คนไข้คนเดียวกัน โอกาสต่ำ) */
		/* ผู้สั่งเดิม (หมอ) ต้องไม่เด้งเป็นเภสัชคนกด (b5 — ใบของหมอคือความรับผิดชอบของหมอ)
		   จอส่งหมอมาชัดเจน = เปลี่ยนตามจอ · ไม่ส่ง/ส่งค่าเพี้ยน = คงของเดิมในใบ
		   เซ็ตกลับเข้า cosignMember ด้วย — response ท้ายไฟล์ต้องรายงานค่าที่ลง DB จริง ไม่ใช่คนกด */
		if (!doctorResolved) cosignMember = old.cosign_user || null;
		const patch = Object.assign({}, orderPatch, {
			current_status: oldStatus,
			cosign_user: cosignMember,
			updated_at: now,
			updated_by: userInfo.account,
		});
		const done = await app.db.collection(orderForm.form_table).findOneAndUpdate(
			{ _id: oid(orderId), current_status: oldStatus, xrstatx: 1 },
			{ $set: patch },
			{ returnDocument: 'after' },
		);
		if (!done) {
			return fail('STATUS_CHANGED', 'สถานะใบเปลี่ยนไประหว่างแก้ (อาจเพิ่งถูกจัดยา/ยกเลิก) — โหลดใบใหม่แล้วดูอีกครั้ง', {
				current_status: oldStatus,
			});
		}
		void app.optCacheInvalidate(orderForm.form_table);
		itemStatus = oldStatus;
		// รายการถูกลบ+สร้างใหม่ทั้งชุด ⇒ ไทม์ไลน์รายการเดิมหาย — สำเนาไทม์ไลน์หัวใบมาแทน
		// (ตั้งแต่ draft→sent stage ของหัวใบกับรายการคือชุดเดียวกันอยู่แล้ว: save สร้างคู่ · order-send $push คู่)
		itemStages = (Array.isArray(old.status_stage) && old.status_stage.length ? old.status_stage : [stage]).map((sg) => Object.assign({}, sg));
	}
} else {
	/* สร้างใบใหม่ — draft ว่าง → ประกอบ joiner vid → commit (event ออกเลขที่ให้) */
	const draft = await app.insertData(FORM_ORDER, userInfo);
	if (!draft || !draft.success || !draft.id) return fail('DRAFT_FAILED', 'สร้างใบร่างไม่สำเร็จ');

	const jf = (draft.sdformModel || {}).joiner_field || orderForm.joiner_field || {};
	// parentJoiner = joiner ที่ "visit" ใช้ผูก person (ปกติ 'pid') → ทำให้ vid.xtbxlv1_xfx_id ชี้ person ให้เอง
	// อ่านจากฟอร์ม Visit แทน hardcode — วันหลังเปลี่ยนชื่อ joiner ตัวนี้ยังทำงานถูก
	const parentJoiner = ((visitForm.joiner_field || {}).field_name) || 'pid';
	const joiner = await app.createJoinerValue(
		visit,
		String(visitId),
		jf.label_template,
		jf.label_fields,
		jf.ref_fields,
		parentJoiner,
	);

	const record = Object.assign({}, draft.data, orderPatch, {
		dataid: draft.id,
		status_stage: [stage],
		order_clinic: await resolveOrderClinic(),
	});
	record[jf.field_name || 'vid'] = joiner;

	const saved = await app.sdformSetOne(FORM_ORDER, draft.id, record, 1, userInfo);
	if (!saved || saved.success === false) return fail('ORDER_SAVE_FAILED', 'บันทึกใบไม่สำเร็จ: ' + ((saved || {}).message || ''));
	orderId = String(draft.id);
	// เลขที่ใบที่ event คืนมา อยู่ใน response ของ sdformSetOne เท่านั้น (ดู §เขียนเลขกลับ ข้างล่าง)
	eventOrderNo = ((saved.data || {}).order_number) || null;
}

/* ── เขียนเลขที่ใบกลับ record ────────────────────────────────────────────
   🔴 `xformDatax` ของ api_onevent **ไม่ถูกเขียนลง DB** — afterSaveForm merge มันเข้า
      "ผลลัพธ์ที่ส่งกลับ" อย่างเดียว (ZProcess.ts afterSaveForm → caller ทำแค่
      `result.reply.data = eventReturn.data` ไม่มี dbUpdate ตามหลัง)
      ฟอร์มปกติรอดเพราะ *จอ* เอาค่าไปใส่ formModel ต่อ — API ที่เรียก sdformSetOne เองไม่มีใครทำให้
   ⇒ ต้องหยิบเลขจาก response แล้วเขียนกลับเอง ไม่งั้นใบใน DB ไม่มีเลขที่ (เลขถูกกินไปแล้วด้วย) */
const afterRes = await app.dbFindById(oid(orderId), orderForm.form_table);
const orderDoc = afterRes && afterRes.success ? (afterRes.reply || {}).data : null;
let orderNumber = (orderDoc && orderDoc.order_number) || null;

if (!orderNumber && eventOrderNo) {
	const wrote = await app.dbUpdate({ order_number: eventOrderNo }, orderForm.form_table, userInfo, { _id: oid(orderId) });
	if (wrote && wrote.success !== false) {
		orderNumber = eventOrderNo;
		if (orderDoc) orderDoc.order_number = eventOrderNo;
	}
}
if (!orderNumber) {
	// ใบไม่มีเลขที่ = ห้องยาอ้างอิงไม่ได้ ต้องดังตั้งแต่ตรงนี้ (ใบยังเป็นร่าง ยังไม่มีใครเห็น)
	app.log.warn('[cpoe-order-save] order ' + orderId + ' has no order_number after save');
}

/* ── สิ่งส่งตรวจของบรรทัด (C13) ─────────────────────────────────────────────
   จอส่งมาเป็น { source, storage, at, by_id, by } — by_id คือ _id ของคนเก็บ
   ไม่มีทั้ง source และเวลาที่เก็บ = กล่องเปล่า ⇒ คืน null ไม่เขียนลงใบ
   (กติกาเดียวกับจอที่ปิดปุ่ม "ส่งใบ" เมื่อยังระบุไม่ครบ — สองฝั่งต้องตัดสินเหมือนกัน) */
const labDataOf = async (l) => {
	const d = l.lab_data;
	/* 🔴 กล่องมี 2 โหมด (จอสั่งตรวจ 2026-09-01): specimen ชัดเจนกรอกทั้งกลุ่มโดย **ไม่มี source**
	   (รหัส specimen ของรายการบอกอยู่แล้วว่าเก็บอะไร) ⇒ เกณฑ์ "มีข้อมูลจริง" คือ source **หรือ** เวลาที่เก็บ
	   เช็คแต่ source อย่างเดียว = ทิ้งของที่กรอกจากโหมดกลุ่มทั้งก้อนโดยเงียบ */
	if (!d) return null;
	/* รูปใหม่ = มี rows · ยกเว้นก้อนที่มี source เดิมติดมาและไม่มีแถวไหนเลือก specimen
	   (= ใบเก่าที่ cpoe-item-get คืนมาแล้วจอส่งกลับโดยไม่ได้แก้) ⇒ ใช้ทางเดิม ใบเก่าจะไม่เปลี่ยนความหมายของ spec_source */
	const legacyPass = String(d.source || '').trim() && Array.isArray(d.rows) && !d.rows.some((r) => r && String(r.spec || r.spec_n || '').trim());
	if (Array.isArray(d.rows) && !legacyPass) return labDataOfRows(d);
	const hasSource = !!String(d.source || '').trim();
	if (!hasSource && !String(d.at || '').trim()) return null;
	const by = d.by_id ? await userRef(d.by_id) : null;
	return {
		spec_source: hasSource ? String(d.source).trim() : '',
		ship_storage: STORAGE_VALUES.indexOf(String(d.storage || '')) >= 0 ? String(d.storage) : 'IM',
		specimen_at: String(d.at || ''),
		// resolve ไม่เจอ (ผู้ใช้ถูกลบ) = เว้นว่าง ดีกว่าเก็บ id ลอยที่จอโชว์เป็น [object Object]
		specimen_by: by,
	};
};

/* ── กล่องแบบใหม่ (จอ CPOE Order App · พี่เคาะ 2026-10-02) — จอส่ง { rows:[…], by, by_id } ──
   row = { site, site_n, spec, spec_n, at, storage, temp, note } · 1 แถว = 1 specimen (multi_specimen มีหลายแถว)
   🔴 แถวแรกเขียนซ้ำที่ช่องบนสุดเสมอ — LIS (lab_cpoe_worklist ฯลฯ) อ่าน spec_source_code/spec_source/specimen_at/ship_storage อยู่แล้ว
      ⇒ ไม่ต้องแก้ LIS · ทุกแถวเก็บครบใน specimens[] (sub-form ใน CPOE Order Item)
   🔴 spec_source = **ชื่อ specimen** (LIS โชว์เป็นชื่อ specimen) · ข้อความอิสระ (source) ย้ายไป spec_note
      specimen พิมพ์เอง (autocomplete) = spec_source_code ว่าง + spec_source เป็นข้อความที่พิมพ์
      รูปเดิม { source,… } จากจออื่นยังเขียนลง spec_source แบบเดิม (ทางบน) ไม่เปลี่ยนพฤติกรรมจอพวกนั้น
   ไม่มีแถวไหนมีเวลาเก็บ = กล่องเปล่า ⇒ null (กติกาเดียวกับทางเดิม) */
const txt = (v) => String(v == null ? '' : v).trim();
const rowOut = (r) => ({
	spec_site_code: txt(r.site),
	spec_site_name: txt(r.site_n),
	spec_source_code: txt(r.spec),
	spec_source: txt(r.spec_n),
	specimen_at: txt(r.at),
	ship_storage: STORAGE_VALUES.indexOf(txt(r.storage)) >= 0 ? txt(r.storage) : 'IM',
	// อุณหภูมิมีความหมายเฉพาะ "อุณหภูมิห้อง" · ตัวเลขไม่ได้ = ไม่เก็บ (ดีกว่าเก็บข้อความเพี้ยน)
	ship_temp: txt(r.storage) === 'RT' && txt(r.temp) !== '' && !isNaN(Number(r.temp)) ? Number(r.temp) : null,
	spec_note: txt(r.note),
});
const labDataOfRows = async (d) => {
	/* 🔴 จอ clone Cpoe_lab_order ส่ง lab_data ที่ได้จาก cpoe-item-get กลับมาทั้งก้อน (มี rows ติดมา)
	   แล้วประทับเวลาตอนส่งใบลง d.at (รูปเดิม) ⇒ แถวแรกที่ไม่มีเวลา ใช้ d.at แทน ไม่งั้นเวลาที่ประทับหลุดทั้งก้อน */
	const rows = d.rows
		.map((r, i) => (i === 0 && r && !txt(r.at) && txt(d.at) ? Object.assign({}, r, { at: d.at }) : r))
		.filter((r) => r && txt(r.at));
	if (!rows.length) return null;
	const by = d.by_id ? await userRef(d.by_id) : null;
	const out = rowOut(rows[0]);
	out.specimen_by = by;
	// หลอดชัดเจน (ไม่มี specimen ที่เลือก) ไม่ต้องมีรายการ specimens — LIS ใช้ specimen ของ master ตามเดิม
	out.specimens = rows.some((r) => txt(r.spec) || txt(r.spec_n)) ? rows.map(rowOut) : [];
	return out;
};

/* ══ 5) รายการในใบ ═══════════════════════════════════════════════════════
   แก้ใบร่าง = เขียนรายการทับทั้งชุด (ลบของเก่าก่อน) — ตะกร้าในจอคือความจริงของใบร่าง
   ปลอดภัยเพราะ guard ข้างบนยืนยันแล้วว่ายังเป็น draft (ยังไม่มีใครเอาไปทำงานต่อ) */
if (mode === 'update') {
	// joiner value เก็บเป็น string (createJoinerValue รับ String(orderId)) แต่บาง instance เป็น ObjectId → ครอบทั้งคู่
	const delFilter = { 'order_id.value': { $in: [String(orderId), oid(orderId)].filter(Boolean) } };
	// 🔴 ห้ามใช้ app.dbDelete — ข้างในเป็น deleteOne (DBDecorator.ts) ⇒ ใบที่มี 3 รายการจะลบได้แถวเดียว
	//    ที่เหลือค้างเป็นรายการซ้ำในใบเดิม (เจอตอนเทสจริง 2026-08-04)
	//    raw write ไม่ล้าง options cache ให้ ⇒ ต้องเรียก optCacheInvalidate เอง
	await app.db.collection(itemForm.form_table).deleteMany(delFilter);
	void app.optCacheInvalidate(itemForm.form_table);
}

// joiner ของรายการชี้ไปที่ "ใบ" — ประกอบครั้งเดียวแล้วใช้ซ้ำทุกบรรทัด (parent เดียวกันทั้งใบ)
// ⚠️ ต้องทำหลังอ่านใบกลับ เพราะ label_fields ของ joiner ตัวนี้มี order_number อยู่ด้วย
const itemJf = itemForm.joiner_field || {};
const orderJoiner = await app.createJoinerValue(
	orderDoc || { _id: orderId, order_number: orderNumber, vid: (orderDoc || {}).vid },
	String(orderId),
	itemJf.label_template,
	itemJf.label_fields,
	itemJf.ref_fields,
	'vid',   // joiner ของ "ใบ" ที่ชี้ visit → ทำให้ order_id.xtbxlv1/2 ชี้ person/visit ให้เอง
);

/* ══ 4.5) pick_drug — เก็บ "ตัวยาต้นทาง" ติดไปกับรายการในใบ ═══════════════
   ทำไมต้องมี: ใบที่ process สร้าง ไม่เคยผ่านช่อง pick_drug ของฟอร์ม ⇒ รายการในใบ **ไม่มี gp_ref เลย**
   (verify กับ DB 2026-08-05 — ทุกแถวไม่มีคีย์นี้) ทุกฝั่งที่อ่านใบย้อนหลังจึงไม่รู้ด้วยซ้ำว่า
   รายการนั้นเป็นยาหรือไม่ใช่ยา (ประวัติการสั่งในจอ · ห้องยา · ตรวจกฎย้อนหลัง)
   ⇒ ประกอบเองให้ตรงรูปที่ฟอร์มเขียน: { value, label, ...refField }
      (SdSelectRemoteList.vue:866 — `_raw` ถูกตัดทิ้งก่อน emit ที่บรรทัด 678 จึงไม่เก็บด้วย)

   🔴 อ่าน labelField/refField จาก form_db.schema ไม่ hardcode — ref field แก้ในฟอร์มได้ตลอด
      hardcode เมื่อไหร่ วันที่มีคนเพิ่ม ref field ใบใหม่จะไม่ได้ของนั้นโดยไม่มีใครรู้
   🔴 ตัด gp_ref.sigs ทิ้งก่อนเก็บ (พี่เคาะ 2026-08-05) — เป็นก้อนใหญ่สุดของ gp_ref และใบไม่ได้ใช้
      Sig ที่หมอเลือกจริงอยู่ใน prescription_data แล้ว */
const pickCfg = (((itemForm.form_db || {}).schema || {}).pick_drug || {}).inputOptions || {};
const pickForm = String(pickCfg.formId || '');
const pickRefs = Array.isArray(pickCfg.refField) ? pickCfg.refField : [];
const pickLabels = Array.isArray(pickCfg.labelField) ? pickCfg.labelField : [];

const getPath = (obj, path) =>
	String(path || '')
		.split('.')
		.reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);
const setPath = (obj, path, val) => {
	const keys = String(path || '').split('.');
	let cur = obj;
	for (let i = 0; i < keys.length - 1; i++) {
		if (cur[keys[i]] === null || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
		cur = cur[keys[i]];
	}
	cur[keys[keys.length - 1]] = val === undefined ? null : val;
};

// โหลด master ของรายการที่มาจากฟอร์มเดียวกับช่อง pick_drug (ยา) — ยิงครั้งเดียวทั้งใบ
const masterById = {};
if (pickForm && pickRefs.length) {
	const tradeForm = await tableOf(pickForm);
	const ids = lines
		.filter((l) => String(l.item_form_id || '') === pickForm)
		.map((l) => oid(l.item_data_id))
		.filter(Boolean);
	if (tradeForm && tradeForm.form_table && ids.length) {
		const rows = await app.db.collection(tradeForm.form_table).find({ _id: { $in: ids } }).toArray();
		rows.forEach((r) => {
			masterById[String(r._id)] = r;
		});
	}
}

/* รายการนี้เป็น "ยา" จริงไหม (C14 · พี่เคาะ 2026-08-08)
   🔴 ใช้ `gp_flag` เป็นตัวตัดสินเดียว ให้ตรงกับจอ (widget-order-screen `isDrugLine`) และกฎ
      drug-check (`inScope`) เป๊ะ ๆ — ห้ามเดาจากชื่อ/หน่วยจ่าย/การมี sigs
      สามฝั่งต้องใช้เกณฑ์เดียวกัน ไม่งั้นจอซ่อนช่องวิธีใช้แต่ใบยังเก็บ แล้วไม่มีใครเห็นว่าต่างกัน
   ⇒ รายการที่ไม่ได้มาจากตารางยาเลย (lab/x-ray) ไม่มี master ⇒ ไม่ใช่ยาอยู่แล้ว */
const isDrugLine = (l) => {
	if (String(l.item_form_id || '') !== pickForm) return false;
	const gp = (masterById[String(l.item_data_id)] || {}).gp_ref || {};
	return String(gp.gp_flag || '') === 'DRUG';
};

const buildPickDrug = (l) => {
	if (String(l.item_form_id || '') !== pickForm) return null;   // รายการที่ไม่ได้มาจากตารางยา (lab/xray) ใช้ช่องอื่น
	const m = masterById[String(l.item_data_id)];
	if (!m) return null;
	const out = {
		value: String(m._id),
		label: pickLabels.map((f) => getPath(m, f)).filter((v) => v !== null && v !== undefined && v !== '').join(' '),
	};
	pickRefs.forEach((p) => setPath(out, p, getPath(m, p)));
	if (out.gp_ref && typeof out.gp_ref === 'object') delete out.gp_ref.sigs;
	return out;
};

/* ══ 4.5b) pick_master — "รายการตรวจต้นทาง" ติดไปกับรายการในใบ (คู่แฝดของ pick_drug) ═══
   ทำไมต้องมี: ฟอร์ม CPOE Order Item มีช่อง `pick_master` (select-form → CPOE Item) อยู่แล้ว
   แต่ process ไม่เคยเขียนค่านี้เลย ⇒ รายการ lab/x-ray ในใบ **ไม่มีที่มา** (verify กับ DB 2026-09-01:
   สาย item 49 แถว มี pick_master แค่ 1 แถว ซึ่งมาจากการกรอกมือในฟอร์ม ไม่ใช่จากจอ)
   ปลายทางจึงอ่าน section / lab_item / specimen / price_data ย้อนหลังจากใบไม่ได้ ต้องวิ่งกลับไป
   join master เอง แล้วได้ค่า ณ วันนี้ ไม่ใช่ค่า ณ วันที่สั่ง

   🔴 อ่าน labelField/refField จาก form_db.schema เหมือน pick_drug — ห้าม hardcode ชุดช่อง
   🔴 ไม่ตัดช่องไหนทิ้งเอง (ต่างจาก pick_drug ที่ตัด gp_ref.sigs) — ชุดช่องที่ฟอร์มประกาศคือชุดที่ตั้งใจเก็บ
      และ master ทั้ง doc ~2 KB เท่านั้น ไม่มีก้อนใหญ่แบบ sigs */
const pickMasterCfg = (((itemForm.form_db || {}).schema || {}).pick_master || {}).inputOptions || {};
const pickMasterRefs = Array.isArray(pickMasterCfg.refField) ? pickMasterCfg.refField : [];
const pickMasterLabels = Array.isArray(pickMasterCfg.labelField) ? pickMasterCfg.labelField : [];

const buildPickMaster = (l) => {
	if (String(l.item_form_id || '') !== FORM_ITEM_MASTER) return null;   // บรรทัดยาใช้ pick_drug ไม่ใช่ช่องนี้
	const m = itemMasterById[String(l.item_data_id)];
	if (!m) return null;
	const out = {
		value: String(m._id), // sdformSetOne cast เป็น ObjectId ให้เอง ตาม valueObjectId ของผัง
		label: pickMasterLabels.map((f) => getPath(m, f)).filter((v) => v !== null && v !== undefined && v !== '').join(' '),
	};
	pickMasterRefs.forEach((p) => setPath(out, p, getPath(m, p)));
	return out;
};

/* ══ 4.6) billing group (C26) — หมวดค่ารักษาพยาบาล eClaim ══════════════════
   ทำไมต้องมี: `category_id` ในรายการว่างทุกแถว (verify กับ DB 2026-08-07) ⇒ ใบที่ระบบออกให้
   ไปต่อฝั่งเรียกเก็บ/ส่งเบิกไม่ได้เลย ต้องมีคนมานั่งเติมหมวดทีหลังทุกใบ

   ที่มาของค่า: `billing_group` ของ Trade Drug (เก็บเป็น { value:<code>, label }) → หา record
   ในฟอร์ม Category ด้วย `code` แล้วประกอบเป็น joiner ให้ตรงรูปที่ฟอร์มเขียนเอง
   🔴 เทียบด้วย `code` ไม่ใช่ label — ชื่อหมวดยาวและแก้ได้ ส่วน code เป็นรหัส eClaim ที่ตรึงอยู่แล้ว
   🔴 หา code ไม่เจอ = ปล่อย null ห้ามเดาหมวดใกล้เคียง — หมวดผิดในใบเบิกแก้ยากกว่าหมวดว่าง

   ⚠️ `sub_category_id` ยังเว้นว่างไว้: Trade Drug ไม่มีช่องหมวดย่อยให้ map (มีแค่ billing_group
      ตัวเดียว) ⇒ ต้องเพิ่มช่องที่ฟอร์มยาก่อน กฎ dependField ของฟอร์มผูก sub ไว้กับ category อยู่แล้ว */
const FORM_CATEGORY = '6a594e85d448dfc9d33e2c28'; // Category → zdata_category (หมวด eClaim 18 หมวด)

const catByCode = {};
const billCodes = [...new Set(Object.keys(masterById).map((k) => codeOf((masterById[k] || {}).billing_group)).filter(Boolean))];
if (billCodes.length) {
	const catForm = await tableOf(FORM_CATEGORY);
	const catTable = catForm && catForm.form_table;
	if (catTable) {
		const rows = await app.db.collection(catTable).find({ code: { $in: billCodes }, xrstatx: 1 }).toArray();
		rows.forEach((r) => {
			catByCode[String(r.code)] = r;
		});
	} else {
		// ไม่ตีกลับใบเพราะเรื่องหมวดเบิก แต่ต้องดัง — ไม่งั้นใบจะว่างหมวดเงียบ ๆ เหมือนเดิม
		app.log.warn('[cpoe-order-save] อ่านโครงฟอร์ม Category ไม่ได้ — รายการในใบนี้จะไม่มี category_id');
	}
}

const buildCategory = (l) => {
	const m = masterById[String(l.item_data_id)];
	const code = m ? codeOf(m.billing_group) : '';
	const cat = code ? catByCode[code] : null;
	if (!cat) return null;
	return {
		value: String(cat._id), // sdformSetOne cast เป็น ObjectId ให้เอง ตาม valueObjectId ของผัง
		label: [cat.code, cat.name].filter(Boolean).join(' '), // labelField = [code, name]
		code: cat.code || '',
		nhso: cat.nhso || '',
		name: cat.name || '',
	};
};

/* ── หมวดเบิกของ "รายการตรวจ" — ง่ายกว่าสายยาเพราะ master ตั้งหมวดไว้ในตัวเองแล้ว ──────────
   สายยาต้องแปลง billing_group (เก็บเป็น code) → หา record ในฟอร์ม Category เอง (buildCategory ข้างบน)
   ส่วน CPOE Item เก็บ `category_id` เป็น joiner ที่ประกอบเสร็จแล้ว ⇒ **copy ตรง ไม่ต้อง query ซ้ำ**
   ข้อมูลพร้อมอยู่จริง: master 6,224/6,383 แถว (97.5%) มีหมวดแล้ว (วัด 2026-09-01)
   🔴 ไม่เดาหมวดเมื่อ master ไม่ได้ตั้ง — คืน null เหมือนสายยา (หมวดผิดในใบเบิกแก้ยากกว่าหมวดว่าง)
   🔴 normalize ให้ครบ 5 คีย์เสมอ ต่อให้ master เก็บมาไม่ครบ — ฝั่งอ่านใบจะได้ไม่ต้องแยกว่ารายการนี้
      มาจากสายยาหรือสายตรวจ (สองสายต้องได้รูปเดียวกันเป๊ะ) */
const joinerOf = (v, refKeys, labelKeys) => {
	if (!v || !v.value) return null;
	const out = { value: String(v.value), label: v.label || '' };
	refKeys.forEach((k) => {
		out[k] = v[k] == null ? '' : v[k];
	});
	/* 🔴 label สำรองประกอบจาก **labelField** ไม่ใช่ refField ทั้งชุด — หมวดเบิกมี nhso ซ้ำกับ code
	   ประกอบจาก refField จะได้ "7 7 ค่าตรวจ..." (เจอตอน dry-run 2026-09-01) ผิดจากที่ฟอร์มเขียนเอง */
	if (!out.label) out.label = labelKeys.map((k) => out[k]).filter(Boolean).join(' ');
	return out;
};

// refField = [code, nhso, name] · labelField = [code, name] — ให้ตรงกับสายยา (buildCategory ข้างบน)
const buildItemCategory = (l) => {
	const m = itemMasterById[String(l.item_data_id)];
	return m ? joinerOf(m.category_id, ['code', 'nhso', 'name'], ['code', 'name']) : null;
};

/* ⚠️ `sub_category_id` — ท่อพร้อมแล้ว แต่ปลายทางยังไม่มีน้ำ:
   master ตั้งหมวดย่อยไว้ 0 จาก 6,383 แถว (วัด 2026-09-01) ⇒ ค่านี้จะเป็น null ไปก่อน
   วันที่เภสัช/ห้องแลปเติมหมวดย่อยที่ฟอร์ม CPOE Item ใบใหม่จะได้ค่าทันทีโดยไม่ต้องแก้ process
   (สายยายิ่งไม่มีทางเลือก — Trade Drug ไม่มีช่องหมวดย่อยให้ map เลย ดูหมายเหตุ §4.6) */
const buildItemSubCategory = (l) => {
	const m = itemMasterById[String(l.item_data_id)];
	return m ? joinerOf(m.sub_category_id, ['code', 'name'], ['name']) : null;   // labelField ของช่องนี้ = [name]
};

/* ── ที่มาของบรรทัด `from_set` ─────────────────────────────────────────────
   ช่องนี้มีอยู่แล้วในฟอร์ม (เดิมใช้กับ "ยาชุด" C21) และเป็น snapshot ที่มาแบบทั่วไป
   ⇒ ใช้ตัวเดียวกันบอกว่า "บรรทัดนี้เป็นลูกของชุด <แม่>" ได้เลย ไม่ต้องเพิ่มช่องในฟอร์ม
   🔴 ที่มาจาก server (ชุดแม่-ลูก) ชนะค่าที่จอส่งมาเสมอ — บรรทัดที่ราคาถูก zero ไปแล้ว
      ต้องมีหลักฐานในใบว่าทำไมถึงเป็น 0 ไม่งั้นฝั่งเรียกเก็บอ่านใบแล้วนึกว่าลืมใส่ราคา */
const fromSetOf = (l) => {
	if (l._sub_of) {
		const p = masterByCode[l._sub_of];
		return {
			set_id: p ? String(p._id) : '',
			set_code: l._sub_of,
			set_name: (p && p.item_name) || '',
		};
	}
	if (l.from_set && l.from_set.set_id) {
		return {
			set_id: String(l.from_set.set_id),
			set_code: String(l.from_set.set_code || ''),
			set_name: String(l.from_set.set_name || ''),
		};
	}
	return null;
};

const itemIds = [];
// ใบกำกับที่ต้องผูกกับรายการหลังเขียนใบเสร็จ (prescriber_temp · ดูขั้น 5.5)
const tempLinks = [];
const sigOf = (l) => {
	const g = l.sig || {};
	// prescription_data เป็น object-group — field ที่เป็น select-form เก็บ { value:<code>, label }
	return {
		sig_dose: Number(g.sig_dose) || 0,
		sig_unit: g.sig_unit ? { value: g.sig_unit, label: g.sig_unit_label || g.sig_unit } : null,
		sig_route: g.sig_route ? { value: g.sig_route, label: g.sig_route_label || g.sig_route } : null,
		sig_freq: g.sig_freq ? { value: g.sig_freq, label: g.sig_freq_label || g.sig_freq } : null,
		sig_timing: g.sig_timing ? { value: g.sig_timing, label: g.sig_timing_label || g.sig_timing } : null,
		sig_duration: Number(g.sig_duration) || 0,
		sig_label: g.sig_label_custom || g.sig_label || '',
		sig_label_th: g.sig_label_th || '',
		sig_indication: g.sig_indication || '',
		// ฉลากช่วย 1/2 ติดมาจาก template ทั้งแถว — ห้องยา (cpoe-order-list → labels[]) อ่านสองช่องนี้
		sig_label1: g.sig_label1 || '',
		sig_label2: g.sig_label2 || '',
		sig_note: g.sig_note || '',
		is_default: false,
	};
};

// 🔴 ต้องเขียน "ทีละบรรทัดตามลำดับ" ห้าม Promise.all —
//    insertData reuse draft ว่าง (xrstatx=0) ของ user เดิม ⇒ ยิงพร้อมกันจะแย่ง draft ตัวเดียวกัน
//    (dbInsertMany เร็วกว่าก็จริง แต่ไม่ stamp created_by/created_at ให้ และคืน success=false
//     เมื่อ insert แค่ 1 แถว เพราะเช็ค insertedCount > 1 — ใบยาตัวเดียวจะรายงานว่าล้มเหลวทั้งที่เขียนแล้ว)
for (const l of lines) {
	const p = priceByKey[l._key] || {};
	const d = await app.insertData(FORM_ORDER_ITEM, userInfo);
	if (!d || !d.success || !d.id) return fail('ITEM_DRAFT_FAILED', 'สร้างรายการไม่สำเร็จ (' + (l.item_name || l._key) + ')', { order_id: orderId, order_number: orderNumber });

	const rec = Object.assign({}, d.data, {
		dataid: d.id,
		item_source: l.item_source || 'drug',
		/* 🔴 ชนิดของ "บรรทัดนี้" ไม่ใช่ของใบ (spec §3.4) — ห้องปลายทางกรองที่ค่านี้
		   ใบ prefix L ที่มีรายการ xray ปน บรรทัด xray ต้องเป็น xray ไม่ใช่ lab
		   ไม่ประกาศมา = ตกมาใช้ชนิดของใบ (จอสั่งยาเดินทางนี้ พฤติกรรมเดิมทุกประการ) */
		service_type: await svcOfLine(l),
		// objectid-input render เป็น text input ⇒ เก็บ string (ฝั่งอ่านควรครอบทั้ง string/ObjectId)
		item_form_id: String(l.item_form_id || ''),
		item_data_id: String(l.item_data_id || ''),
		item_code: p.item_code || l.item_code || '',
		item_name: p.item_name || l.item_name || '',
		item_tags: Array.isArray(l.tags) ? l.tags : [],
		/* ป้ายที่ห้องยาต้องระวังก่อนจ่าย — แยกจาก item_tags ตั้งแต่ 2026-08-11 (C10)
		   item_tags ปนบัญชียา (ED/NED/ก/ข) ซึ่งไม่ใช่เรื่องควบคุม ⇒ ปลายทางเดาไม่ได้ว่าตัวไหนคืออะไร
		   🔴 ใบที่บันทึกก่อนวันนั้นไม่มีช่องนี้ — ฝั่งอ่าน (cpoe-order-list / pis-order-dispense) ต้องมี fallback เสมอ */
		item_control_tags: Array.isArray(l.control_tags) ? l.control_tags : [],
		quantity: Number(l.quantity) || 0,
		qty_calc_source: l.qty_calc_source === 'manual' ? 'manual' : 'auto',
		// ราคาทั้งชุดมาจาก price-calc ไม่ใช่จากจอ
		is_price_overwrite: p.price_source === 'overwrite',
		unit_price: p.unit_price,
		original_price: p.original_price == null ? p.unit_price : p.original_price,
		claim_price: p.claim_price,
		paid_price: p.paid_price,
		net_amount: p.net_amount,
		claim_amount: p.claim_amount,
		paid_amount: p.paid_amount,
		/* สิทธิ์ที่ "ใช้จริง" ของบรรทัดนี้ (2026-09-20) — price-calc ไล่ลำดับสิทธิ์ของวิสิทแล้วเลือกตัวแรกที่
		   เบิกได้ + เข้าเงื่อนไข + มีราคา ⇒ ใบเดียวมีได้หลายสิทธิ์ · ว่าง = ไม่มีสิทธิ์ไหนใช้ได้ (ชำระเอง)
		   coverage_by บอกว่าเข้าเงื่อนไขด้วยชั้นไหน: category | sub_category | drug_item | order_item
		   (ว่างทั้งที่มีสิทธิ์ = สิทธิ์นั้นไม่ได้เปิดจำกัดรายการ) — การเงินต้องตอบย้อนหลังได้ว่าทำไมบรรทัดนี้เบิกได้ */
		inscl_main: p.inscl_used ? p.inscl_used.main || '' : '',
		inscl_sub: p.inscl_used ? p.inscl_used.sub || '' : '',
		inscl_name: p.inscl_used ? p.inscl_used.name || '' : '',
		inscl_coverage_by: p.coverage_by || '',
		/* วิธีใช้ยาเขียนเฉพาะรายการที่เป็นยา (C14 · พี่เคาะ 2026-08-08)
		   จอไม่ให้แก้ Sig ของรายการที่ไม่ใช่ยาอยู่แล้ว ⇒ ค่าที่ส่งมาเป็นค่าตั้งต้นของจอ (dose 1 · 1 วัน)
		   ไม่ใช่สิ่งที่หมอกรอก · เขียนลงใบ = ผ้าก๊อซ/lab มี "ครั้งละ 1 เม็ด วันละ 2 เวลา" ติดไปด้วย
		   แล้วฉลาก/รายงาน/ห้องยาหยิบไปใช้ต่อได้โดยไม่มีใครเอะใจ */
		prescription_data: isDrugLine(l) ? sigOf(l) : null,
		/* สิ่งส่งตรวจ (C13) — object-group `lab_data` 4 ช่องในฟอร์ม CPOE Order Item
		   🔴 เขียนเฉพาะบรรทัด lab ที่จอระบุมาจริง — บรรทัด xray/หัตถการที่มีช่องนี้ค้างอยู่
		      จะทำให้ห้องแลปเห็นใบที่ "มีสิ่งส่งตรวจ" ทั้งที่ไม่ต้องเก็บอะไร
		   🔴 specimen_by เป็น select-data (Object) ไม่ใช่ string — resolve จาก core_user ไม่เชื่อ label จากจอ */
		lab_data: await labDataOf(l),
		// เตือนจาก price-calc + drug-check เก็บติดใบไว้ด้วย — ใบที่ออกไปแล้วต้องตอบย้อนหลังได้ว่า
		// ตอนสั่งเห็นคำเตือนอะไร มาจากกฎไหน อ้างเรคคอร์ดไหน (D8.2 ข้อ 4)
		alert_flags: (p.alerts || [])
			.map((a) => ({
				rule: a.rule || '',
				type: 'price',
				level: a.level === 'block' ? 'block' : a.level === 'warn' ? 'warn' : 'info',
				message: a.message || '',
				source_id: '',
			}))
			.concat(
				(checkByKey[l._key] || []).map((a) => ({
					rule: a.rule || '',
					type: 'check',
					level: a.level === 'block' ? 'block' : a.level === 'warn' ? 'warn' : 'info',
					message: a.message || '',
					source_id: a.source_id || '',
				}))
			)
			.concat(
				checkFailed
					? [{ rule: 'check_failed', type: 'check', level: 'warn', message: 'ตรวจความปลอดภัยยาไม่สำเร็จตอนบันทึก (' + checkFailed + ') — รายการนี้ยังไม่ได้ตรวจ', source_id: '' }]
					: []
			),
		comment: l.comment == null ? '' : String(l.comment),
		/* ใบกำกับที่ผูกกับรายการนี้ (prescriber_temp) — เก็บฝั่ง "ใบสั่งยา" ด้วย ไม่ใช่ฝั่งใบกำกับอย่างเดียว
		   ⇒ ด่านตอนส่งใบ (order-send) และการตรวจย้อนหลังอ่านจากรายการได้ตรง ๆ
		      ไม่ต้องไล่ join กลับจากใบกำกับ "ทุกฟอร์ม" (เภสัชสร้างฟอร์มใบกำกับเพิ่มได้เรื่อย ๆ) */
		prescriber_temp_id: String(l.temp_id || ''),
		prescriber_temp_form_id: String((l.temp_req && l.temp_req.form_id) || ''),
		/* ที่มาจากชุด — ยาชุด (C21 ก้อน 7 · D3.3) หรือชุดแม่-ลูกของรายการตรวจ (C31)
		   snapshot ตลอดอายุใบ ไม่ผูกกลับไปที่ชุดแบบ live ⇒ แก้ชุดทีหลังไม่กระทบใบเก่า
		   null = รายการที่หมอค้นเอง (แยกออกจาก "ข้อมูลหาย" ได้) · ดู fromSetOf() ข้างบน */
		from_set: fromSetOf(l),
		brand_swap: l.brand_swap
			? {
					from_code: String(l.brand_swap.from_code || ''),
					from_name: String(l.brand_swap.from_name || ''),
					to_code: String(l.brand_swap.to_code || ''),
					to_name: String(l.brand_swap.to_name || ''),
					basis: String(l.brand_swap.basis || 'fefo'),
					no_stock: l.brand_swap.no_stock === true,
					exp_date: l.brand_swap.exp_date || null,
					lot_no: l.brand_swap.lot_no || null,
					decided: l.brand_swap.decided === 'user' ? 'user' : 'auto',
			  }
			: null,
		// สถานะรายการตามหัวใบเสมอ (C04) — โหมดเภสัชแก้ใบ sent/accepted รายการใหม่ต้องได้สถานะเดิมของใบ
		// ไม่ใช่ draft ไม่งั้น pis-order-prepare (updateMany filter สถานะ) ไม่เจอรายการ
		current_status: itemStatus,
		// ตัวยาต้นทาง (มี gp_flag / vtm / subs อยู่ข้างใน) — null เมื่อรายการไม่ได้มาจากตารางยา
		pick_drug: buildPickDrug(l),
		// รายการตรวจต้นทาง (section / service_type / lab_item / price_data ...) — null เมื่อบรรทัดเป็นยา (§4.5b)
		pick_master: buildPickMaster(l),
		/* หมวดค่ารักษา eClaim — คนละที่มาตามชนิดบรรทัด แต่ได้รูปเดียวกัน:
		   ยา = billing_group → ฟอร์ม Category (C26) · รายการตรวจ = หมวดที่ตั้งไว้ที่ master
		   🔴 ลำดับนี้กันชนกันเอง: บรรทัดยา buildItemCategory คืน null อยู่แล้ว (ไม่มีใน itemMasterById)
		      และบรรทัดตรวจ buildCategory ก็คืน null (ไม่มีใน masterById) ⇒ ไม่มีทางทับกัน */
		category_id: buildCategory(l) || buildItemCategory(l),
		// หมวดย่อย eClaim — ยังว่างทั้งระบบเพราะ master ไม่ได้ตั้งไว้ (ดูหมายเหตุที่ buildItemSubCategory)
		sub_category_id: buildItemSubCategory(l),
		status_stage: itemStages || [stage],
		modify_user: currentMember,
		is_refill: false,
		refill_time: 0,
	});
	rec[itemJf.field_name || 'order_id'] = orderJoiner;

	const savedItem = await app.sdformSetOne(FORM_ORDER_ITEM, d.id, rec, 1, userInfo);
	if (!savedItem || savedItem.success === false) {
		return fail('ITEM_SAVE_FAILED', 'บันทึกรายการไม่สำเร็จ (' + (rec.item_name || l._key) + ')', {
			order_id: orderId,
			order_number: orderNumber,
			saved_items: itemIds.length,
		});
	}
	itemIds.push(String(d.id));

	/* ใบกำกับที่จอผูกมากับบรรทัด — เก็บไว้ผูกทีเดียวหลังลูป (ขั้น 5.5)
	   ไม่เขียนตรงนี้เพราะลูปนี้ยัง return fail กลางทางได้ ⇒ ใบจะถูกผูกกับรายการของใบที่เขียนไม่จบ */
	const tempId = String(l.temp_id || '');
	const tempFormId = String((l.temp_req && l.temp_req.form_id) || '');
	if (tempId && tempFormId) {
		tempLinks.push({ temp_id: tempId, form_id: tempFormId, item_id: String(d.id), item_name: rec.item_name || '' });
	}
}

/* ══ 5.5) ผูกใบกำกับกับรายการในใบ (prescriber_temp · §🧠 ข้อ 9 [C=2]) ══════
   ใบกำกับถูกเขียนลง DB ตั้งแต่ตอนหมอกรอกในจอ โดย `order_item_id` ว่างไว้ก่อน —
   ที่นี่คือจุดเดียวในระบบที่รู้ว่า "ใบกำกับใบนั้น = รายการไหนในใบสั่งยา" จึงเป็นที่เติมค่า

   🔴 resolve ชื่อ collection จาก `temp_req.form_id` ผ่าน tableOf() — ห้าม hardcode `zdata_<formId>`
      ฟอร์มใบกำกับแต่ละใบตั้งชื่อ table เองได้ และเภสัชสร้างฟอร์มเพิ่มเองได้ตลอด
   🔴 เขียนทับเสมอ ไม่ใช่เขียนเฉพาะตอนที่ค่าว่าง — แก้ใบร่างจะลบ order item เก่าทิ้งทั้งชุด (ขั้น 5)
      แล้วสร้างใหม่ ⇒ id เดิมที่ใบกำกับถืออยู่กลายเป็นรายการผี ต้องชี้ใหม่ทุกครั้งที่บันทึก
   🔴 ผูกไม่สำเร็จ = **ไม่ตีกลับทั้งใบ** — ใบสั่งยาเขียนเสร็จไปแล้วจริง ๆ การ fail ตรงนี้จะทำให้หมอ
      เห็น error ทั้งที่ใบออกไปแล้ว แล้วกดบันทึกซ้ำจนได้ใบซ้อน ⇒ คืน `temp_unlinked` ให้จอเตือนแทน
   ⚠️ raw write ไม่ล้าง options cache ให้ ⇒ ต้อง optCacheInvalidate เอง (หลักเดียวกับ deleteMany ขั้น 5) */
const tempUnlinked = [];
let tempLinkedCount = 0;
for (const t of tempLinks) {
	const tf = await tableOf(t.form_id);
	const table = tf && tf.form_table;
	const o = oid(t.temp_id);
	if (!table || !o) {
		tempUnlinked.push({ temp_id: t.temp_id, item_name: t.item_name, reason: !table ? 'ไม่พบฟอร์มใบกำกับ' : 'id ใบกำกับไม่ถูกต้อง' });
		continue;
	}
	const r = await app.db.collection(table).updateOne({ _id: o }, { $set: { order_item_id: t.item_id } });
	if (!r || !r.matchedCount) {
		tempUnlinked.push({ temp_id: t.temp_id, item_name: t.item_name, reason: 'ไม่พบใบกำกับใน ' + table });
		continue;
	}
	void app.optCacheInvalidate(table);
	tempLinkedCount++;
}

return {
	success: true,
	message: 'ok',
	mode: mode,
	order_id: orderId,
	order_number: orderNumber,
	// สถานะใบหลังบันทึก — draft ปกติ · โหมดเภสัชแก้ใบ = สถานะเดิมของใบ (sent/accepted) จอเอาไปแสดง/ตัดสินปุ่มต่อ
	current_status: itemStatus,
	item_count: itemIds.length,
	item_ids: itemIds,
	// บรรทัดลูกของชุดที่ถูกคิดราคา 0 รอบนี้ (C31) — จอเอาไปบอกหมอได้ว่าคิดเงินที่แม่แล้ว
	sub_lines: subLineCount,
	inscl: price.inscl_resolved || null,
	/* แพทย์ผู้สั่งที่ลงใบจริง — จอเอาไปยืนยัน/เตือนเมื่อ fallback (C10)
	   `cosign_fallback: 'NOT_A_DOCTOR'` = ค่าที่จอส่งมาไม่ใช่หมอ ⇒ ใบลงชื่อคนกดบันทึกแทน */
	cosign_user: cosignMember ? { value: String(cosignMember.value), label: cosignMember.label } : null,
	cosign_fallback: cosignFallback,
	/* ใบกำกับที่ผูกกับรายการแล้วในรอบนี้ (prescriber_temp)
	   `temp_unlinked` ไม่ว่าง = ใบสั่งยาบันทึกสำเร็จ แต่ใบกำกับบางใบยังลอยอยู่ ⇒ จอต้องเตือนให้คนรู้
	   (เงียบไว้แล้ววันหลังไม่มีใครตามได้ว่าใบไหนขาด — ใบกำกับคือหลักฐานการขออนุมัติ) */
	temp_linked: tempLinkedCount,
	temp_unlinked: tempUnlinked,
	totals: {
		total_amount: round2(totals.total_amount),
		claim_amount: round2(totals.claim_amount),
		paid_amount: round2(totals.paid_amount),
	},
};
