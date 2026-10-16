/**
 * emr_view · onCreated — จอ "EMR History" (ฟอร์ม EMR Hisroty 6a96557e422c1ca959829eae)
 *
 * วางที่: vue-ui `emr_view` (ฟอร์มนี้มี widget ตัวเดียว เต็มจอ)
 * หน้าที่: แสดงการรักษาของ **visit ใบเดียว** แบบอ่านอย่างเดียว — เปิดจากปุ่ม "ดูทั้งใบ" ในหน้า EMR
 *
 * รับ context 2 ทาง (เรียงตามลำดับที่ลอง):
 *   1) formParams.visit_id / formParams.history_id  ← ทางปกติ (openForm ส่ง params มา)
 *   2) s.ehLoad(visitId) จากภายนอก                  ← เผื่อจอเปิดค้างแล้วอยากสลับใบ
 *
 * 🔴 ทุก key ที่เทมเพลตอ้างต้องมีค่าตั้งแต่ตรงนี้ — ขาดตัวเดียว = error box ทั้ง widget
 * 🔴 v-model ผูก object เท่านั้น (ehUi.tab) — scope proxy ไม่มี set trap ให้ตัวแปรเดี่ยว
 * 🔴 อ่านอย่างเดียวจริง ๆ: ไม่มีปุ่มบันทึก/ลบ · ปุ่มที่มีคือ "เปิดใบต้นทาง" ซึ่งเปิดฟอร์มจริงของ record นั้น
 */

const s = this.vueState;
const field = this;

const HISTORY_PROC = '6a9662a75723cd050ea497e0'; // emr-history-get — คงเดิม
const EH_LAB_BOARD_PROC = '6ab3be31cec3020e8562a2c9'; // emr-lab-board-get — โหลดแยกจาก history
const hnOfVisit = (visit) => String((visit && (visit.hn || (visit.person && visit.person.hn))) || '');

/* ══ state ════════════════════════════════════════════════════════════════ */
s.ehLoading = false;
s.ehErr = '';
s.ehReady = false; // โหลดสำเร็จแล้วอย่างน้อย 1 ครั้ง
s.ehVisit = null;
s.ehVitals = null;
s.ehSubjective = null;
s.ehPe = null;
s.ehDx = null;
s.ehPlan = null;
s.ehConsults = [];
s.ehOrders = [];
s.ehMoney = null;
s.ehOthers = [];
s.ehMeta = null;
s.ehNav = null; // { prev, next, index, total } — ไล่ดู visit อื่นของคนไข้คนเดียวกัน
s.ehGroups = []; // รายการสั่งรวมทุกใบ จัดตามชนิด (ยา/Lab/X-ray/หัตถการ)
s.ehUi = { showOther: [], showNormalPe: false }; // el-collapse v-model รับ array ของ name ที่เปิดอยู่

/* ══ helper ที่เทมเพลตเรียก ══════════════════════════════════════════════ */

// "2026-09-01 10:55:24" / "2026-09-01" → "01/09/2569 10:55" (พ.ศ. ตาม convention ของระบบ)
s.ehWhen = (v) => {
	const t = String(v || '');
	if (t.length < 10) return t;
	const d = t.slice(8, 10) + '/' + t.slice(5, 7) + '/' + (Number(t.slice(0, 4)) + 543);
	return t.length >= 16 ? d + ' ' + t.slice(11, 16) : d;
};

s.ehMoneyText = (n) => {
	const x = Number(n);
	if (!Number.isFinite(x)) return '-';
	return x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ป้ายชนิดใบสั่ง/รายการ — ชนิดที่ระบบใช้จริง: med / lab / xray / nurs / order
s.ehTypeLabel = (t) => {
	const map = { med: 'ยา', drug: 'ยา', lab: 'Lab', xray: 'X-ray', nurs: 'หัตถการ', order: 'เวชภัณฑ์' };
	return map[String(t || '').toLowerCase()] || t || 'อื่นๆ';
};

s.ehTypeColor = (t) => {
	const map = { med: 'success', drug: 'success', lab: 'primary', xray: 'warning', nurs: 'info', order: 'info' };
	return map[String(t || '').toLowerCase()] || 'info';
};

// สถานะใบสั่ง — ตัวที่พบจริงใน status_stage ของ CPOE
s.ehStatusLabel = (st) => {
	const map = {
		draft: 'ร่าง',
		sent: 'ส่งแล้ว',
		received: 'รับแล้ว',
		prepared: 'จัดแล้ว',
		dispensed: 'จ่ายแล้ว',
		completed: 'เสร็จสิ้น',
		cancelled: 'ยกเลิก',
		canceled: 'ยกเลิก',
	};
	return map[String(st || '').toLowerCase()] || st || '';
};

// ป้ายการปรึกษา — ค่าจริงในฟอร์ม Consult
s.ehConsultLabel = (st) => {
	const map = { draft: 'ร่าง', send: 'ส่งปรึกษา', accept: 'รับปรึกษา', reply: 'ตอบกลับแล้ว', complete: 'เสร็จสิ้น', cancel: 'ยกเลิก' };
	return map[String(st || '').toLowerCase()] || st || '';
};

s.ehConsultColor = (st) => {
	const t = String(st || '').toLowerCase();
	if (t === 'cancel') return 'danger';
	if (t === 'complete' || t === 'reply') return 'success';
	if (t === 'draft') return 'info';
	return 'warning';
};

// สีของค่าสัญญาณชีพตามธงที่ process คำนวณให้ (อิงช่วงปกติตามอายุ)
s.ehVitalColor = (key) => {
	const f = s.ehVitals && s.ehVitals.flags ? s.ehVitals.flags[key] : '';
	return f ? 'var(--el-color-danger)' : 'inherit';
};

// ป้ายกำกับท้ายค่าที่ผิดปกติ — หมอเห็นแล้วรู้ทันทีว่าสูงหรือต่ำ ไม่ต้องเทียบช่วงเอง
s.ehFlagText = (key) => {
	const f = s.ehVitals && s.ehVitals.flags ? s.ehVitals.flags[key] : '';
	return f === 'high' ? '↑' : f === 'low' ? '↓' : '';
};

// PE: แสดงเฉพาะที่ผิดปกติก่อน — กดแล้วค่อยกางที่ปกติ
s.ehPeItems = () => {
	const items = (s.ehPe && s.ehPe.items) || [];
	if (s.ehUi.showNormalPe) return items;
	const bad = items.filter((p) => p.abnormal);
	return bad.length ? bad : items; // ปกติทั้งหมด → แสดงตามเดิม ไม่ให้จอว่างเปล่า
};

s.ehTogglePe = () => {
	s.ehUi.showNormalPe = !s.ehUi.showNormalPe;
};

// ไปใบก่อนหน้า / ถัดไปของคนไข้คนเดียวกัน (ปุ่ม ‹ › บนหัวจอ)
s.ehGo = (visitId) => {
	if (!visitId) return;
	s.ehLoad(String(visitId), null);
};

/* ══ เปิด record ต้นทาง ═══════════════════════════════════════════════════ */
s.ehOpen = (formId, dataId) => {
	if (!formId || !dataId) return;
	const form = field.getFormRef();
	if (!form) return;
	form.openForm(String(formId), String(dataId), '', null, {
		// 🔴 readonly: true = โหมดดู — ซ่อน Submit/Reset และ disable ทุกช่อง (SdCrudForm.formReadonly)
		//    ไม่ใส่ = popup เปิดเป็นโหมดแก้ไข ซึ่งขัดกับเจตนาของจอประวัติทั้งจอ
		readonly: true,
		// 🔴 ต้อง spread formParams ของแม่ ไม่งั้น popup ไม่เหลือ xsitex/xunitx (ระบบใช้ตัดสิน site/unit)
		params: Object.assign({}, form.formParams),
		cancelCallback: () => form.subFormClose(),
	});
};

/* ══ โหลดข้อมูล ═══════════════════════════════════════════════════════════ */
s.ehLoad = (visitId, historyId) => {
	const form = field.getFormRef();
	if (!form) return;
	// 🔴 กันเคส "import model เวอร์ชันที่ generator ยังไม่ได้เติม process id"
	//    ปล่อยไว้จะยิง API ด้วยชื่อ token → backend ตอบ "API not found" ซึ่งอ่านไม่ออกว่าเกิดจากอะไร
	if (String(HISTORY_PROC).indexOf('__') === 0) {
		s.ehErr = 'ฟอร์มนี้ยัง import model เวอร์ชันเก่าอยู่ (ยังไม่มี process id) — import ไฟล์ล่าสุดจาก generator แล้ว hard reload';
		s.ehReady = true;
		return;
	}

	if (!visitId && !historyId) {
		s.ehErr = 'ไม่ได้รับ visit ที่จะแสดง (ต้องเปิดจอนี้พร้อม visit_id)';
		return;
	}

	s.ehLoading = true;
	s.ehErr = '';
	if (s.ehLabReset) s.ehLabReset();
	// สลับใบ = ล้างของเดิมก่อน ไม่งั้นระหว่างโหลดจอโชว์ข้อมูลคนละ visit ปนกัน
	s.ehUi.showNormalPe = false;
	form.userState.runProcess(
		HISTORY_PROC,
		{ visit_id: visitId || null, history_id: historyId || null },
		(res) => {
			s.ehLoading = false;
			const d = (res && res.data) || {};
			// process ที่ตีกลับด้วย success:false มาทาง callback นี้เหมือนกัน ไม่ใช่ errCb
			if (!d.success) {
				s.ehErr = d.message || 'อ่านประวัติการรักษาไม่สำเร็จ';
				return;
			}
			s.ehVisit = d.visit || null;
			s.ehVitals = d.vitals || null;
			s.ehSubjective = d.subjective || null;
			s.ehPe = d.pe || null;
			s.ehDx = d.dx || null;
			s.ehPlan = d.plan || null;
			s.ehConsults = Array.isArray(d.consults) ? d.consults : [];
			s.ehOrders = Array.isArray(d.orders) ? d.orders : [];
			s.ehGroups = Array.isArray(d.item_groups) ? d.item_groups : [];
			s.ehNav = d.nav || null;
			s.ehMoney = d.money || null;
			s.ehOthers = Array.isArray(d.others) ? d.others : [];
			s.ehMeta = d.meta || null;
			s.ehReady = true;
			if (s.ehGroups.some((group) => String(group.type || '').toLowerCase() === 'lab')) s.ehLabLoad(s.ehVisit);
		},
		(err) => {
			s.ehLoading = false;
			s.ehErr = 'อ่านประวัติการรักษาไม่สำเร็จ: ' + ((err && err.message) || err);
		},
	);
};

s.ehReload = () => {
	if (s.ehVisit) s.ehLoad(s.ehVisit.visit_id, null);
	else s.ehBoot();
};

// อ่าน context จาก params ที่ openForm ส่งเข้ามา — เรียกจาก onMounted (formRef พร้อมแล้วตอนนั้น)
s.ehBoot = () => {
	const p = field.formParams || {};
	const visitId = p.visit_id || p.visitId || p.vid || null;
	const historyId = p.history_id || p.historyId || p.dataId || null;
	s.ehLoad(visitId, historyId);
};

/* ══ EMR History · LAB result sibling card ════════════════════════════════
 * แยกโหลดจาก emr-history-get และจับคู่ด้วย CPOE Order ID เท่านั้น:
 * item_groups[].items[].order_id === lab_orders[].source_order_id
 */
const EH_LAB_RESULT_PDF_REPORT_ID = '6aa8f5a8b92813319a86ea11';
const EH_LAB_MICRO_RESULT_PDF_REPORT_ID = '6ab1c2d3e4f5061728394a5b';
const EH_LAB_MICRO_SECTIONS = ['MB'];
const EH_LAB_STATUS = {
	draft: { label: 'ร่าง', type: 'info' },
	sent: { label: 'ส่งแล้ว', type: 'warning' },
	ready: { label: 'ready', type: 'warning' },
	accepted: { label: 'ห้องแลปรับแล้ว', type: 'warning' },
	collected: { label: 'เก็บสิ่งส่งตรวจแล้ว', type: 'warning' },
	in_process: { label: 'กำลังตรวจ', type: 'warning' },
	resulted: { label: 'มีผลแล้ว', type: 'success' },
	completed: { label: 'เสร็จสิ้น', type: 'success' },
	cancelled: { label: 'ยกเลิก', type: 'info' },
	rejected: { label: 'ปฏิเสธสิ่งส่งตรวจ', type: 'danger' },
};
const EH_LAB_PENDING = ['draft', 'sent', 'ready', 'prepared', 'accepted', 'collected', 'in_process'];

s.ehLabLoading = false;
s.ehLabError = '';
s.ehLabOrders = [];
s.ehLabHn = '';
s.ehLabOgOpen = {};
s.ehLabDialog = { visible: false, order: null };
s.ehLabMbHistory = { visible: false, row: null };
s.ehLabMicroSelectedGroupKey = '';
s.ehLabResultGroupOpen = {};
s.ehLabReauth = { visible: false, loading: false, error: '', username: '', password: '', purpose: 'ดูแลรักษาผู้ป่วย', mode: 'view', placement: '', order: null, item: null };
s.ehLabPdfGrant = { orderKey: '', placement: '', token: '', expiresAt: 0 };
s.ehLabSensitiveExpiryTimer = null;
s.ehLabSensitiveGrants = {};

/* ══ helper เล็ก ๆ ════════════════════════════════════════════════════════ */
// "2026-09-22 10:52:00" → "10:52" (รับ "10:52" ที่ส่งมาตรง ๆ ด้วย)
const ehLabHm = (v) => {
	const t = String(v || '');
	if (t.length >= 16) return t.slice(11, 16);
	return /^\d{2}:\d{2}/.test(t) ? t.slice(0, 5) : '';
};
// "2026-09-18" → "18/09/69" (พ.ศ. 2 หลัก — หัวก้อนแคบ ปีเต็มไม่พอที่)
const ehLabDmy = (v) => {
	const t = String(v || '');
	if (t.length < 10) return '';
	return t.slice(8, 10) + '/' + t.slice(5, 7) + '/' + String(Number(t.slice(0, 4)) + 543).slice(2);
};
const ehLabIsNum = (v) => /^[\d.,<>≥≤+\- ]+$/.test(String(v == null ? '' : v));
// ค่าที่ไม่ใช่ตัวเลข (ขึ้นเชื้อ / S / R) ไม่ต้องมีลูกศร — ลูกศรสื่อว่าสูง/ต่ำกว่าค่าปกติ
s.ehLabArrow = (f, v) => (v !== undefined && !ehLabIsNum(v) ? '' : f === 'H' || f === 'C' ? '▲' : f === 'L' ? '▼' : '');

// flag มาตรฐานของจอ: C=วิกฤติ · H=สูง · L=ต่ำ · A=ผิดปกติ(ไม่ใช่ตัวเลข) · N=ปกติ
const ehLabFlagOf = (it) => {
	if (it && it.critical === true) return 'C';
	const f = String((it && (it.flag || it.interpretation || it.interpretation_code)) || '').toUpperCase();
	if (f === 'HH' || f === 'LL' || f === 'CC' || f === 'CRIT') return 'C';
	if (f === 'H' || f === 'HIGH') return 'H';
	if (f === 'L' || f === 'LOW') return 'L';
	if (f === 'A' || f === 'AB' || f === 'ABNORMAL' || f === 'POS') return 'A';
	return 'N';
};
const ehLabIsAbn = (r) => r.flag === 'C' || r.flag === 'H' || r.flag === 'L' || r.flag === 'A';

const ehLabSessionUsername = () => {
	const form = field.getFormRef && field.getFormRef();
	const user = (form && form.userState && form.userState.user) || (field.globalUserState && field.globalUserState.user) || {};
	return String(user.username || (user.account && user.account.username) || '').trim();
};
const ehLabGrantCache = () => {
	const form = field.getFormRef && field.getFormRef();
	const userState = form && form.userState;
	if (!userState) return s.ehLabSensitiveGrants;
	const cacheKey = '__emrHistorySensitiveGrants';
	if (!userState[cacheKey] || typeof userState[cacheKey] !== 'object' || Array.isArray(userState[cacheKey])) userState[cacheKey] = {};
	return userState[cacheKey];
};
const ehLabEpoch = (value) => {
	if (value && typeof value === 'object' && value.$numberLong != null) return Number(value.$numberLong || 0);
	return Number(value || 0);
};
const ehLabGrantScope = (source) => {
	const order = source || {};
	const raw = order._raw || order;
	const items = Array.isArray(raw.__sensitive_base_items) ? raw.__sensitive_base_items : Array.isArray(raw.items) ? raw.items : [];
	const sensitive = items.find((row) => row && row.visibility && row.visibility.sensitive) || items.find((row) => row && row.visibility) || {};
	const visibility = sensitive.visibility || {};
	const username = ehLabSessionUsername();
	const visitId = String(visibility.visit_id || raw.visit_id || (s.ehVisit && (s.ehVisit.visit_id || s.ehVisit.data_id)) || '');
	const sourceOrderId = String(visibility.source_order_id || raw.source_order_id || order.source_order_id || '');
	const sectionCode = String(raw.section_code || order.section_code || '').toUpperCase();
	return username && sourceOrderId ? [username, visitId, sourceOrderId, sectionCode].join('|') : '';
};
const ehLabGrantFromRaw = (source) => {
	const raw = (source && source._raw) || source || {};
	const scope = ehLabGrantScope(source);
	const ownerScope = String(raw.__sensitive_grant_scope || '');
	if (ownerScope && ownerScope !== scope) return null;
	const token = String(raw.__sensitive_grant_token || '');
	const expiresAt = ehLabEpoch(raw.__sensitive_grant_expires_at_epoch);
	return token && expiresAt > Date.now() ? { token, expiresAt } : null;
};
const ehLabRememberSensitiveGrant = (source) => {
	const key = ehLabGrantScope(source);
	const grant = ehLabGrantFromRaw(source);
	if (key && grant) ehLabGrantCache()[key] = grant;
	return grant;
};
const ehLabForgetSensitiveGrant = (source) => {
	const key = ehLabGrantScope(source);
	if (key) delete ehLabGrantCache()[key];
};
const ehLabSensitiveGrant = (source) => {
	const direct = ehLabRememberSensitiveGrant(source);
	if (direct) return direct;
	const key = ehLabGrantScope(source);
	const cache = ehLabGrantCache();
	const stored = key ? cache[key] : null;
	if (!stored) return null;
	if (!stored.token || ehLabEpoch(stored.expiresAt) <= Date.now()) {
		delete cache[key];
		return null;
	}
	return { token: String(stored.token), expiresAt: ehLabEpoch(stored.expiresAt) };
};
const ehLabAttachSensitiveGrant = (raw) => {
	const grant = ehLabSensitiveGrant(raw);
	if (!grant && !raw.__sensitive_grant_token && !raw.__sensitive_grant_expires_at_epoch) return raw;
	const next = Object.assign({}, raw);
	if (grant) {
		next.__sensitive_grant_token = grant.token;
		next.__sensitive_grant_expires_at_epoch = grant.expiresAt;
		next.__sensitive_grant_scope = ehLabGrantScope(raw);
	} else {
		delete next.__sensitive_grant_token;
		delete next.__sensitive_grant_expires_at_epoch;
		delete next.__sensitive_grant_scope;
	}
	return next;
};

const ehLabPreviousRow = (item) => ({
	value: item && item.value != null && item.value !== '' ? String(item.value) : '—',
	unit: String((item && item.unit) || ''),
	interpretation: String((item && item.interpretation) || ''),
	ref: String((item && item.reference_range) || ''),
	when: String((item && item.entered_at) || ''),
	visit_vn: String((item && item.visit_vn) || ''),
	lab_no: String((item && item.lab_no) || ''),
	status: String((item && item.status) || ''),
});
const ehLabRow = (it) => {
	const visibility = (it && it.visibility) || { state: 'visible' };
	const visibilityState = String(visibility.state || 'visible');
	const manuallyHidden = visibilityState === 'hidden' || visibility.manual_hidden === true;
	const previousValues = (it && Array.isArray(it.previous_values) ? it.previous_values : it && it.previous ? [it.previous] : [])
		.slice(0, 5)
		.map(ehLabPreviousRow);
	const r = {
		visibility: visibility,
		// Manual LAB hide stays in its original row/Profile position but contains
		// no clinical value. Sensitive/unresolved rows remain in the locked list.
		redacted: manuallyHidden,
		locked: visibilityState !== 'visible' && !manuallyHidden,
		reauth_required: visibilityState === 'reauth_required',
		text: !!(it && it.text), // ผลเป็นรายงานความเรียง ไม่ใช่ค่าเดี่ยว
		name: String((it && (it.name || it.obs_name || it.test_name)) || '-'),
		code: String((it && (it.code || it.obs_code)) || ''),
		value: it && it.value != null && it.value !== '' ? String(it.value) : '—',
		unit: String((it && (it.unit || it.unit_symbol_snapshot)) || ''),
		ref: String((it && (it.ref || it.reference_range_snapshot)) || ''),
		// เก็บค่าที่ LAB ส่งมาจริงไว้แสดงผล (เช่น N / NEG) แยกจาก flag ที่ normalize เพื่อใช้สี/critical logic
		interpretation: String((it && (it.interpretation || it.interpretation_code || it.flag)) || '').trim(),
		comment: String((it && it.result_comment) || ''),
		result_item_id: String((it && it.result_item_id) || ''),
		// Preserve the printable Result Report parent after row normalization.
		result_report_id: String((it && (it.result_report_id || it.xparentx)) || ''),
		group_id: String((it && it.group_id) || ''),
		group_name: String((it && it.group_name) || ''),
		source: String((it && it.result_source) || ''),
		status: String((it && it.result_status) || ''),
		reported_at: String((it && it.reported_at) || ''),
		reported_by: String((it && it.reported_by_source_name) || ''),
		verified_at: String((it && it.verified_at) || ''),
		verified_by: String((it && it.verified_by_source_name) || ''),
		previous: previousValues[0] || null,
		previous_values: previousValues,
	};
	r.flag = ehLabFlagOf(it);
	r.arrow = s.ehLabArrow(r.flag, r.value);
	return r;
};

/* ══ stepper ของใบที่ยังไม่ออกผล ══════════════════════════════════════════
   🔴 ขึ้นเฉพาะใบที่ยังไม่มีผลเท่านั้น — ผลออกเมื่อไหร่ stepper หายทันที แทนที่ด้วยบรรทัดค่าผล */
const ehLabSteps = (o) => {
	const raw = String(o.status || '');
	const seq = ['sent', 'accepted', 'in_process', 'resulted'];
	const at = { sent: o.ordered_at, accepted: o.received_at || o.collected_at, in_process: o.in_process_at, resulted: o.resulted_at };
	const label = { sent: 'ส่งใบ', accepted: 'ห้องแลปรับ', in_process: 'กำลังตรวจ', resulted: 'ออกผล' };
	// ใบที่ status เพี้ยน/ไม่รู้จัก → ถือว่าอยู่ขั้นแรก ดีกว่าเดาให้ไกลกว่าความจริง
	let cur = seq.indexOf(raw === 'collected' ? 'accepted' : raw);
	if (cur < 0) cur = 0;
	return seq.map((k, i) => ({
		label: label[k],
		time: ehLabHm(at[k]),
		state: i < cur ? 'done' : i === cur ? 'now' : 'todo',
	}));
};
// เส้นเชื่อมระหว่างจุด — วาดเป็น element จริง (inline style ทำ ::before ไม่ได้)
s.ehLabStepLine = (steps, i, side) => {
	const last = steps.length - 1;
	if ((side === 'l' && i === 0) || (side === 'r' && i === last)) return { flex: 1, height: '2px', background: 'transparent' };
	const done = side === 'l' ? steps[i - 1].state === 'done' : steps[i].state === 'done';
	return { flex: 1, height: '2px', background: done ? 'var(--el-color-success)' : 'var(--el-border-color-light)' };
};
s.ehLabStepDot = (st) => {
	const c = st.state === 'todo' ? 'var(--el-border-color-light)' : st.state === 'now' ? 'var(--el-color-warning)' : 'var(--el-color-success)';
	return {
		flex: 'none',
		width: '12px',
		height: '12px',
		borderRadius: '50%',
		border: '2px solid ' + c,
		background: st.state === 'todo' ? 'var(--el-bg-color)' : c,
		boxShadow: st.state === 'now' ? '0 0 0 3px var(--el-color-warning-light-9)' : 'none',
	};
};

/* ══ ประกอบก้อนผล 1 ใบสั่ง ════════════════════════════════════════════════ */
const ehLabMkOrder = (raw) => {
	if (!raw) return null;
	raw = ehLabAttachSensitiveGrant(raw);
	const status = String(raw.status || '');
	const st = EH_LAB_STATUS[status] || { label: status || '—', type: 'danger' };
	const cancelled = status === 'cancelled' || status === 'rejected';
	const pending = EH_LAB_PENDING.indexOf(status) >= 0;
	const scope = String(raw.scope || 'visit');
	const allRows = (Array.isArray(raw.items) ? raw.items : []).map(ehLabRow);
	const lockedRows = allRows.filter((row) => row.locked);
	const rows = allRows.filter((row) => !row.locked);
	const resultGroups = [];
	const resultGroupByKey = {};
	rows.forEach((row, rowIndex) => {
		// 1 CPOE Item = 1 กลุ่มผล; Profile จึงเป็นหัวเดียวและมีผลย่อยหลายแถวเหมือน LAB Worklist
		const groupKey = row.group_id || (row.group_name ? 'name|' + row.group_name : 'row|' + rowIndex);
		if (!resultGroupByKey[groupKey]) {
			resultGroupByKey[groupKey] = {
				group_key: groupKey,
				test_name: row.group_name || row.name,
				test_code: '',
				results: [],
			};
			resultGroups.push(resultGroupByKey[groupKey]);
		}
		if (!resultGroupByKey[groupKey].test_code && row.code) resultGroupByKey[groupKey].test_code = row.code;
		resultGroupByKey[groupKey].results.push(row);
	});

	const o = {
		key: String(raw.order_id || raw.order_no || Math.random()),
		source_order_id: String(raw.source_order_id || ''),
		_raw: raw,
		_sensitive_disclosed: !!raw.__sensitive_disclosed,
		scope: scope,
		section: String(raw.section || 'ผลตรวจ'),
		order_no: String(raw.order_no || raw.order_id || ''),
		lab_no: String(raw.lab_no || ''),
		patient_hn: String(raw.patient_hn || s.ehLabHn || ''),
		patient_name: String(raw.patient_name || ''),
		specimen_name: String(raw.specimen_name || ''),
		ordered_items: Array.isArray(raw.ordered_items) ? raw.ordered_items : [],
		status: status,
		pending: pending,
		cancelled: cancelled,
		cancel_reason: String(raw.cancel_reason || ''),
		ordered_at: String(raw.ordered_at || ''),
		received_at: String(raw.received_at || ''),
		collected_at: String(raw.collected_at || ''),
		resulted_at: String(raw.resulted_at || ''),
		reported_at: String(raw.reported_at || ''),
		reported_by: String(raw.reported_by_source_name || ''),
		verified_at: String(raw.verified_at || ''),
		verified_by: String(raw.verified_by_source_name || ''),
		attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
		rows: rows,
		locked_rows: lockedRows,
		has_locked: lockedRows.length > 0,
		result_groups: resultGroups,
		criticals: rows.filter((r) => r.flag === 'C'),
		// 🔴 ผลที่เป็น "รายงานความเรียง" (MB/MLab) แยกถังของตัวเอง — ต้องเห็นเสมอ
		//    LIS ไม่ได้ตีธงผิดปกติให้ ไม่ได้แปลว่าปกติ ⇒ ห้ามพับไปอยู่ใต้ "ค่าปกติ"
		hidden_rows: rows.filter((r) => r.redacted),
		abnormals: rows.filter((r) => !r.redacted && ehLabIsAbn(r) && !r.text),
		texts: rows.filter((r) => !r.redacted && r.text && !ehLabIsAbn(r)),
		normals: rows.filter((r) => !r.redacted && !ehLabIsAbn(r) && !r.text),
	};

	// เวลา 2 จุดเสมอ: สั่ง → ผล · ใบที่ยังไม่ออกผลมีแค่เวลาสั่ง (ห้ามเติมเวลาปลอม)
	const t1 = ehLabHm(raw.ordered_at);
	const t2 = ehLabHm(raw.resulted_at);
	o.time_text = t1 ? (t2 && !pending && !cancelled ? 'สั่ง ' + t1 + ' → ผล ' + t2 : 'สั่ง ' + t1) : t2 ? 'ผล ' + t2 : '';
	// วันที่ขึ้นเฉพาะใบที่สั่งครั้งก่อน — ใบของวิสิทนี้เป็นวันเดียวกันอยู่แล้ว
	const d1 = ehLabDmy(raw.ordered_at);
	o.sub_text = (scope === 'today' && d1 ? d1 + ' · ' : '') + o.order_no;

	o.chip_text = scope === 'today' && !pending && !cancelled ? 'ผลออกวันนี้' : st.label;
	o.chip_type = scope === 'today' && !pending && !cancelled ? 'warning' : st.type;
	// มีรายงานความเรียงแต่ไม่มีธงผิดปกติ ⇒ ห้ามขึ้นว่า "ปกติทั้งหมด" (เราไม่รู้ว่าปกติ)
	o.abn_text = o.hidden_rows.length ? 'ปกปิดผล ' + o.hidden_rows.length : o.abnormals.length ? 'ผิดปกติ ' + o.abnormals.length : o.texts.length ? 'มีรายงานผล' : o.has_locked ? 'มีผล Sensitive' : rows.length ? 'ปกติทั้งหมด' : '';
	o.abn_type = o.hidden_rows.length ? 'danger' : o.abnormals.length ? (o.criticals.length ? 'danger' : 'warning') : o.texts.length ? 'info' : o.has_locked ? 'warning' : 'success';
	o.steps = pending ? ehLabSteps(raw) : [];

	// ── ปุ่มรายงานผล PDF ──────────────────────────────────────────────
	o.section_code = String(raw.section_code || '');
	const reportIds = (Array.isArray(raw.result_report_ids) ? raw.result_report_ids : []).filter((x) => /^[a-f0-9]{24}$/i.test(String(x)));
	o.micro = EH_LAB_MICRO_SECTIONS.indexOf(o.section_code) >= 0;
	// micro: Report รับ xparentx แล้ว; ต้องมี Result Report ชุดเดียวเพื่อไม่พิมพ์ผิดชุด
	// ทั่วไป: ต้องมี Result Report ชุดเดียวเท่านั้น ไม่งั้นพิมพ์ผิดชุด
	const microParams = reportIds.length === 1 ? { xparentx: reportIds[0] } : {};
	o.report_ready = o.micro ? !!EH_LAB_MICRO_RESULT_PDF_REPORT_ID && reportIds.length === 1 : !!EH_LAB_RESULT_PDF_REPORT_ID && reportIds.length === 1;
	o.report_list = o.report_ready
		? [{ reportId: o.micro ? EH_LAB_MICRO_RESULT_PDF_REPORT_ID : EH_LAB_RESULT_PDF_REPORT_ID, label: 'PDF', type: 'pdf' }]
		: [];
	o.has_sensitive = [].concat(raw.__sensitive_base_items || [], raw.items || []).some((row) => !!(row && row.visibility && row.visibility.sensitive));
	// Screen grant and PDF grant are deliberately separate. A doctor must re-auth
	// for every Sensitive PDF click; the five-minute screen grant is never passed here.
	o.report_params = o.report_ready ? (o.micro ? microParams : { xparentx: reportIds[0] }) : {};
	// บอกเหตุที่ปุ่มไม่มา; MLab หลาย Result Report ต้องไม่เดาเลือกใบ
	o.report_hint = o.micro
		? o.report_ready ? '' : reportIds.length > 1 ? 'MLab มีผลหลายชุด จึงไม่เลือก Result Report ให้อัตโนมัติ' : 'ยังไม่มี Result Report สำหรับ PDF MLab'
		: o.report_ready
		? ''
		: reportIds.length > 1
		? 'ใบนี้มีผลหลายชุด จึงไม่พิมพ์เพียงบางชุดให้อัตโนมัติ'
		: '';
	o.bar = cancelled
		? 'var(--el-text-color-placeholder)'
		: o.criticals.length
		? 'var(--el-color-danger)'
		: pending
		? 'var(--el-color-warning)'
		: 'var(--el-color-success)';
	return o;
};

// SdReport เก็บ parameter ภายใน component จึงต้อง remount เมื่อ Order/grant เปลี่ยน
// เพื่อไม่ให้ PDF ใช้ token เก่าหรือ token ของใบอื่น.
s.ehLabReportInstanceKey = (order, placement) => {
	const o = order || {};
	const params = o.report_params || {};
	return [
		'eh-lab-report',
		String(placement || 'card'),
		String(o.source_order_id || o.key || ''),
		String(o.section_code || ''),
		String(params.xparentx || ''),
		'redacted',
	].join('|');
};
s.ehLabPdfOrderKey = (order) => [String(order && (order.source_order_id || order.key) || ''), String(order && order.section_code || '')].join('|');
s.ehLabPdfHostId = (order, placement) => ('eh-lab-pdf-' + String(placement || 'card') + '-' + s.ehLabPdfOrderKey(order)).replace(/[^A-Za-z0-9_-]/g, '_');
s.ehLabPdfGrantReady = (order, placement) => {
	const grant = s.ehLabPdfGrant || {};
	return !!grant.token && grant.orderKey === s.ehLabPdfOrderKey(order) && grant.placement === String(placement || 'card') && Number(grant.expiresAt || 0) > Date.now();
};
s.ehLabPdfParams = (order, placement) => {
	const base = Object.assign({}, (order && order.report_params) || {});
	return s.ehLabPdfGrantReady(order, placement) ? Object.assign(base, { grant_token: s.ehLabPdfGrant.token }) : base;
};
s.ehLabPdfReportInstanceKey = (order, placement) => [s.ehLabReportInstanceKey(order, placement), s.ehLabPdfGrantReady(order, placement) ? s.ehLabPdfGrant.token : 'locked'].join('|');
const ehLabSensitiveAnchor = (order) => {
	const locked = Array.isArray(order && order.locked_rows) ? order.locked_rows.find((row) => row && row.visibility && row.visibility.sensitive) : null;
	if (locked) return locked;
	const raw = (order && order._raw) || {};
	return [].concat(raw.__sensitive_base_items || [], raw.items || []).find((row) => row && row.visibility && row.visibility.sensitive) || null;
};
s.ehLabRequestSensitivePdf = (order, placement) => {
	const item = ehLabSensitiveAnchor(order);
	if (!order || !order.report_ready || !order.has_sensitive || !item) return;
	s.ehLabPdfGrant = { orderKey: '', placement: '', token: '', expiresAt: 0 };
	s.ehLabReauth = { visible: true, loading: false, error: '', username: ehLabSessionUsername(), password: '', purpose: 'ดูแลรักษาผู้ป่วยและเปิดรายงานผล PDF', mode: 'pdf', placement: String(placement || 'card'), order, item };
};
const ehLabClickAuthorizedPdf = (order, placement, attempt) => {
	const doc = typeof globalThis !== 'undefined' ? globalThis.document : null;
	const host = doc && doc.getElementById(s.ehLabPdfHostId(order, placement));
	const button = host && host.querySelector ? host.querySelector('button:not([disabled])') : null;
	if (button && typeof button.click === 'function') {
		button.click();
		return;
	}
	// Vue mounts/remounts SdReport after the grant changes. Wait for that render
	// instead of asking the doctor to click PDF and authenticate a second time.
	if (Number(attempt || 0) < 20) {
		setTimeout(() => ehLabClickAuthorizedPdf(order, placement, Number(attempt || 0) + 1), 50);
		return;
	}
	if (field.notify) field.notify('ยืนยันตัวตนแล้ว แต่ระบบเปิด PDF ไม่สำเร็จ', 'error', 4500);
};
const ehLabOpenAuthorizedPdf = (order, placement, data) => {
	s.ehLabPdfGrant = { orderKey: s.ehLabPdfOrderKey(order), placement: String(placement || 'card'), token: String(data.sensitive_grant_token || ''), expiresAt: Number(data.sensitive_grant_expires_at_epoch || 0) };
	s.ehLabCloseReauth();
	setTimeout(() => ehLabClickAuthorizedPdf(order, placement, 0), 0);
};



/* ══ interactions ═════════════════════════════════════════════════════════ */
// 🔴 เขียน object ใหม่ทั้งก้อน ไม่แก้ key เดิมในที่ — ให้ Vue เห็นการเปลี่ยนแน่นอน (pattern เดียวกับ item_card)
s.ehLabOgToggle = (key) => {
	const next = {};
	Object.keys(s.ehLabOgOpen).forEach((k) => {
		next[k] = s.ehLabOgOpen[k];
	});
	next[key] = !next[key];
	s.ehLabOgOpen = next;
};
// พับรายงานความเรียงของ Lab ไว้ 4 บรรทัด — ใบ MB ใบเดียวยาวเป็นร้อยบรรทัด
s.ehLabTxtClamp = (key) => {
	const base = { marginTop: '3px', fontSize: '11px', lineHeight: '1.5', color: 'var(--el-text-color-regular)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'ui-monospace, Menlo, Consolas, monospace' };
	if (s.ehLabOgOpen['r|' + key]) return Object.assign({}, base, { maxHeight: '260px', overflow: 'auto' });
	return Object.assign({}, base, { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' });
};



// เปิดผลทั้งใบใน popup อ่านอย่างเดียวแบบเดียวกับ LAB Worklist
// 🔴 ห้าม fallback ไปเปิด Result Item ตัวแรก — นั่นคือหน้ากรอก/แก้ไขผลของห้อง LAB ไม่ใช่หน้าดูผลของ EMR
s.ehLabOrderTarget = (o) => !!(o && ((Array.isArray(o.rows) && o.rows.length) || (Array.isArray(o.locked_rows) && o.locked_rows.some((row) => row.reauth_required))));
s.ehLabOpenOrder = (o) => {
	let order = o;
	if (!s.ehLabOrderTarget(order)) return;
	const locked = Array.isArray(order.locked_rows) ? order.locked_rows.find((row) => row.reauth_required) : null;
	if (locked && ehLabSensitiveGrantValid(order)) {
		ehLabReuseSensitive(order, locked);
		return;
	}
	if (locked && order._raw && order._raw.__sensitive_grant_token) {
		const expiredOrder = ehLabRedactSensitiveOrder(order, false);
		ehLabReplaceOrder(order, expiredOrder);
		order = expiredOrder;
	}
	const opened = {};
	(Array.isArray(order.result_groups) ? order.result_groups : []).forEach((group, index) => {
		if (Array.isArray(group.results) && group.results.length > 1) opened[s.ehLabResultGroupKey(group, index)] = true;
	});
	s.ehLabResultGroupOpen = opened;
	s.ehLabMbHistory = { visible: false, row: null };
	s.ehLabDialog = { visible: true, order };
};
s.ehLabCloseLabDialog = () => {
	const order = s.ehLabDialog.order;
	ehLabClearSensitiveExpiryTimer();
	if (order && order._sensitive_disclosed) {
		const redactedOrder = ehLabRedactSensitiveOrder(order, ehLabSensitiveGrantValid(order));
		ehLabReplaceOrder(order, redactedOrder);
		if (ehLabSensitiveGrantValid(redactedOrder)) ehLabScheduleSensitiveExpiry(redactedOrder);
	}
	s.ehLabDialog = { visible: false, order: null };
	s.ehLabMbHistory = { visible: false, row: null };
	s.ehLabMicroSelectedGroupKey = '';
	s.ehLabResultGroupOpen = {};
};

const ehLabRequestId = () => 'emr-sensitive-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
s.ehLabRequestSensitive = (order, item) => {
	if (!order || !item || !item.reauth_required) return;
	if (ehLabSensitiveGrantValid(order)) {
		ehLabReuseSensitive(order, item);
		return;
	}
	s.ehLabReauth = { visible: true, loading: false, error: '', username: ehLabSessionUsername(), password: '', purpose: 'ดูแลรักษาผู้ป่วย', mode: 'view', placement: '', order, item };
};
s.ehLabCloseReauth = () => {
	s.ehLabReauth = { visible: false, loading: false, error: '', username: '', password: '', purpose: 'ดูแลรักษาผู้ป่วย', mode: 'view', placement: '', order: null, item: null };
};
const ehLabReplaceOrder = (oldOrder, nextOrder) => {
	s.ehLabOrders = (Array.isArray(s.ehLabOrders) ? s.ehLabOrders : []).map((order) => (order === oldOrder || order.key === oldOrder.key ? nextOrder : order));
};
const ehLabSensitiveGrantValid = (order) => {
	return !!ehLabSensitiveGrant(order);
};
const ehLabClearSensitiveExpiryTimer = () => {
	if (s.ehLabSensitiveExpiryTimer) clearTimeout(s.ehLabSensitiveExpiryTimer);
	s.ehLabSensitiveExpiryTimer = null;
};
const ehLabRedactSensitiveOrder = (order, keepGrant) => {
	const grant = keepGrant ? ehLabSensitiveGrant(order) : null;
	const raw = Object.assign({}, (order && order._raw) || {});
	if (Array.isArray(raw.__sensitive_base_items)) raw.items = raw.__sensitive_base_items.slice();
	raw.__sensitive_disclosed = false;
	if (grant) {
		raw.__sensitive_grant_token = grant.token;
		raw.__sensitive_grant_expires_at_epoch = grant.expiresAt;
		raw.__sensitive_grant_scope = ehLabGrantScope(order);
	} else {
		delete raw.__sensitive_grant_token;
		delete raw.__sensitive_grant_expires_at_epoch;
		delete raw.__sensitive_grant_scope;
		ehLabForgetSensitiveGrant(order);
	}
	return ehLabMkOrder(raw);
};
const ehLabScheduleSensitiveExpiry = (order) => {
	ehLabClearSensitiveExpiryTimer();
	const grant = ehLabSensitiveGrant(order);
	const expiresAt = grant ? grant.expiresAt : 0;
	const delay = expiresAt - Date.now();
	if (!(delay > 0)) return;
	s.ehLabSensitiveExpiryTimer = setTimeout(() => {
		const active = s.ehLabDialog.order && s.ehLabDialog.order.key === order.key ? s.ehLabDialog.order : order;
		ehLabForgetSensitiveGrant(active);
		const redactedOrder = ehLabRedactSensitiveOrder(active, false);
		ehLabReplaceOrder(active, redactedOrder);
		if (s.ehLabDialog.order && s.ehLabDialog.order.key === active.key) s.ehLabDialog = { visible: true, order: redactedOrder };
		s.ehLabSensitiveExpiryTimer = null;
	}, delay);
	if (s.ehLabSensitiveExpiryTimer && typeof s.ehLabSensitiveExpiryTimer.unref === 'function') s.ehLabSensitiveExpiryTimer.unref();
};
const ehLabApplySensitiveDisclosure = (order, item, data) => {
	const visibility = item.visibility || {};
	const raw = Object.assign({}, order._raw || {});
	if (!Array.isArray(raw.__sensitive_base_items)) raw.__sensitive_base_items = (Array.isArray(raw.items) ? raw.items : []).slice();
	const disclosedIds = {};
	(Array.isArray(data.item_ids) ? data.item_ids : [visibility.item_id || item.group_id]).forEach((id) => { disclosedIds[String(id || '')] = true; });
	raw.items = raw.__sensitive_base_items.filter((row) => !disclosedIds[String((row.visibility && row.visibility.item_id) || row.group_id || '')]).concat(Array.isArray(data.items) ? data.items : []);
	raw.result_report_ids = Array.from(new Set([].concat(raw.result_report_ids || [], data.result_report_ids || []).map(String).filter(Boolean)));
	raw.__sensitive_grant_token = data.sensitive_grant_token || '';
	raw.__sensitive_grant_expires_at_epoch = ehLabEpoch(data.sensitive_grant_expires_at_epoch);
	raw.__sensitive_grant_scope = ehLabGrantScope(raw);
	raw.reported_at = data.reported_at || raw.reported_at;
	raw.reported_by_source_name = data.reported_by_source_name || raw.reported_by_source_name;
	raw.verified_at = data.verified_at || raw.verified_at;
	raw.verified_by_source_name = data.verified_by_source_name || raw.verified_by_source_name;
	raw.__sensitive_disclosed = true;
	ehLabRememberSensitiveGrant(raw);
	const nextOrder = ehLabMkOrder(raw);
	ehLabReplaceOrder(order, nextOrder);
	ehLabScheduleSensitiveExpiry(nextOrder);
	s.ehLabCloseReauth();
	s.ehLabOpenOrder(nextOrder);
};
const ehLabReuseSensitive = (order, item) => {
	const form = field.getFormRef && field.getFormRef();
	const visibility = (item && item.visibility) || {};
	const grant = ehLabSensitiveGrant(order);
	if (!form || !form.userState || typeof form.userState.runProcess !== 'function' || !grant) {
		s.ehLabRequestSensitive(order, item);
		return;
	}
	form.userState.runProcess(
		EH_LAB_BOARD_PROC,
		{
			action: 'reuse_sensitive',
			visit_id: visibility.visit_id || String((s.ehVisit && (s.ehVisit.visit_id || s.ehVisit.data_id)) || ''),
			source_order_id: visibility.source_order_id || order.source_order_id,
			item_id: visibility.item_id || item.group_id,
			section_code: order.section_code || '',
			sensitive_grant_token: grant.token,
			request_id: ehLabRequestId(),
			screen: 'emr_history',
		},
		(res) => {
			const data = (res && res.data) || {};
			if (!data.success) {
				ehLabForgetSensitiveGrant(order);
				const redactedOrder = ehLabRedactSensitiveOrder(order, false);
				ehLabReplaceOrder(order, redactedOrder);
				s.ehLabReauth = { visible: true, loading: false, error: data.message || 'สิทธิ์เปิดดู 5 นาทีหมดอายุแล้ว กรุณายืนยันใหม่', username: ehLabSessionUsername(), password: '', purpose: 'ดูแลรักษาผู้ป่วย', mode: 'view', placement: '', order: redactedOrder, item };
				return;
			}
			ehLabApplySensitiveDisclosure(order, item, data);
		},
		(err) => {
			s.ehLabReauth = { visible: true, loading: false, error: 'เปิดผล Sensitive ไม่สำเร็จ: ' + ((err && err.message) || err), username: ehLabSessionUsername(), password: '', purpose: 'ดูแลรักษาผู้ป่วย', mode: 'view', placement: '', order, item };
		}
	);
};
s.ehLabSubmitSensitive = () => {
	const auth = s.ehLabReauth;
	const form = field.getFormRef && field.getFormRef();
	if (!auth.order || !auth.item || !form || !form.userState || typeof form.userState.runProcess !== 'function') return;
	if (!auth.username || !auth.password || !String(auth.purpose || '').trim()) {
		s.ehLabReauth = Object.assign({}, auth, { error: 'กรุณากรอก username, password และเหตุผลให้ครบ' });
		return;
	}
	const password = auth.password;
	s.ehLabReauth = Object.assign({}, auth, { loading: true, error: '', password: '' });
	const visibility = auth.item.visibility || {};
	form.userState.runProcess(
		EH_LAB_BOARD_PROC,
		{
			action: 'open_sensitive',
			visit_id: visibility.visit_id || String((s.ehVisit && (s.ehVisit.visit_id || s.ehVisit.data_id)) || ''),
			source_order_id: visibility.source_order_id || auth.order.source_order_id,
			item_id: visibility.item_id || auth.item.group_id,
			section_code: auth.order.section_code || '',
			username: auth.username,
			password,
			purpose: String(auth.purpose || '').trim(),
			request_id: ehLabRequestId(),
				screen: auth.mode === 'pdf' ? 'emr_history_pdf' : 'emr_history',
		},
		(res) => {
			const data = (res && res.data) || {};
			if (!data.success) {
				s.ehLabReauth = Object.assign({}, s.ehLabReauth, { loading: false, error: data.message || 'ยืนยันตัวตนไม่สำเร็จ' });
				return;
			}
			if (auth.mode === 'pdf') ehLabOpenAuthorizedPdf(auth.order, auth.placement, data);
			else ehLabApplySensitiveDisclosure(auth.order, auth.item, data);
		},
		(err) => {
			s.ehLabReauth = Object.assign({}, s.ehLabReauth, { loading: false, error: 'เปิดผล Sensitive ไม่สำเร็จ: ' + ((err && err.message) || err) });
		}
	);
};
s.ehLabResultGroups = () => {
	const order = s.ehLabDialog.order;
	if (s.ehLabIsMicrobiologyDialog && s.ehLabIsMicrobiologyDialog()) return s.ehLabMicroGroupsForDisplay();
	return order && Array.isArray(order.result_groups) ? order.result_groups : [];
};
s.ehLabResultGroupKey = (group, index) => String((group && group.group_key) || 'group|' + index);
s.ehLabResultGroupIsProfile = (group) => !!(group && Array.isArray(group.results) && group.results.length > 1);
s.ehLabResultGroupExpanded = (group, index) => !s.ehLabResultGroupIsProfile(group) || !!s.ehLabResultGroupOpen[s.ehLabResultGroupKey(group, index)];
s.ehLabToggleResultGroup = (group, index) => {
	const key = s.ehLabResultGroupKey(group, index);
	s.ehLabResultGroupOpen = Object.assign({}, s.ehLabResultGroupOpen, { [key]: !s.ehLabResultGroupOpen[key] });
};
s.ehLabExpandAllResultGroups = () => {
	const next = {};
	s.ehLabResultGroups().forEach((group, index) => {
		if (s.ehLabResultGroupIsProfile(group)) next[s.ehLabResultGroupKey(group, index)] = true;
	});
	s.ehLabResultGroupOpen = next;
};
s.ehLabCollapseAllResultGroups = () => {
	s.ehLabResultGroupOpen = {};
};
s.ehLabResultProfileCount = () => s.ehLabResultGroups().filter(s.ehLabResultGroupIsProfile).length;
s.ehLabLockedResultCount = () => {
	const order = s.ehLabDialog.order;
	return order && Array.isArray(order.locked_rows) ? order.locked_rows.length : 0;
};
// ชื่อรายการ Sensitive เป็น metadata ที่แสดงได้ แม้ค่าผลยังล็อกอยู่
// จึงต้องนับรวมเป็น "รายการสั่งตรวจ" แต่ไม่รวมในจำนวนผลย่อยที่เปิดเผยแล้ว
s.ehLabResultTestCount = () => s.ehLabResultGroups().length + s.ehLabLockedResultCount();
s.ehLabResultRowsCount = () => s.ehLabResultGroups().reduce((count, group) => count + (Array.isArray(group && group.results) ? group.results.length : 0), 0);
s.ehLabResultCriticalCount = () => {
	const order = s.ehLabDialog.order;
	return order && Array.isArray(order.criticals) ? order.criticals.length : 0;
};
s.ehLabResultAbnormalCount = () => {
	const order = s.ehLabDialog.order;
	return order && Array.isArray(order.abnormals) ? order.abnormals.filter((row) => row.flag !== 'C').length : 0;
};
s.ehLabResultRowNumber = (group, groupIndex, rowIndex) =>
	s.ehLabResultGroupIsProfile(group) ? groupIndex + 1 + '.' + (rowIndex + 1) : String(groupIndex + 1);
s.ehLabHasResultValue = (row) => !!(row && !row.redacted && row.value != null && row.value !== '' && row.value !== '—');
s.ehLabResultSignalClass = (row) => (row && row.flag === 'C' ? 'is-critical' : row && ehLabIsAbn(row) ? 'is-abnormal' : 'is-normal');
s.ehLabResultSignalText = (row) => (row && row.flag === 'C' ? 'ค่าวิกฤติ' : row && ehLabIsAbn(row) ? 'ค่าผิดปกติ' : 'ค่าปกติ');
s.ehLabResultMeasuredClass = (row) => s.ehLabResultSignalClass(row);
s.ehLabResultInterpretationClass = (row) => s.ehLabResultSignalClass(row);
s.ehLabResultSignalStyle = (row) => {
	const type = s.ehLabResultSignalClass(row);
	const color = type === 'is-critical' ? '#b84d4d' : type === 'is-abnormal' ? '#e6a23c' : '#2f761e';
	const ring = type === 'is-critical' ? 'rgba(245,108,108,.12)' : type === 'is-abnormal' ? 'rgba(230,162,60,.11)' : 'rgba(103,194,58,.10)';
	return { display: 'block', width: '10px', height: '10px', margin: 'auto', border: '1px solid ' + color, borderRadius: '50%', background: color, boxShadow: '0 0 0 3px ' + ring };
};
s.ehLabResultMeasuredStyle = (row) => ({ color: row && row.redacted ? 'var(--el-color-danger)' : row && row.flag === 'C' ? '#c45656' : row && ehLabIsAbn(row) ? '#b88230' : 'var(--el-text-color-primary)', fontSize: row && row.redacted ? '13px' : '15px', fontWeight: 800, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' });
s.ehLabResultInterpretationStyle = (row) => {
	const type = s.ehLabResultSignalClass(row);
	const palette = type === 'is-critical' ? ['#fab6b6', '#fef0f0', '#c45656'] : type === 'is-abnormal' ? ['#f3d19e', '#fdf6ec', '#b88230'] : ['#b3e19d', '#f0f9eb', '#529b2e'];
	return { display: 'inline-flex', minHeight: '23px', alignItems: 'center', padding: '2px 8px', border: '1px solid ' + palette[0], borderRadius: '999px', background: palette[1], color: palette[2], fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' };
};
s.ehLabResultSourceText = (source) => {
	const value = String(source || '').trim().toLowerCase();
	if (!value) return '';
	if (value === 'agent' || value === 'lis' || value === 'lisconnect' || value === 'interface') return 'LIS';
	if (value === 'manual' || value === 'his') return 'Manual';
	return source;
};
s.ehLabResultStatusValue = () => {
	const order = s.ehLabDialog.order;
	const statuses = order && Array.isArray(order.rows) ? order.rows.map((row) => String(row.status || '').toLowerCase()).filter(Boolean) : [];
	if ((statuses.length && statuses.every((value) => value === 'final' || value === 'completed')) || (order && order.status === 'completed')) return 'final';
	if (statuses.some((value) => value === 'partial') || (order && order.status === 'resulted')) return 'partial';
	return 'pending';
};
s.ehLabResultStatusText = () => (s.ehLabResultStatusValue() === 'final' ? 'Final' : s.ehLabResultStatusValue() === 'partial' ? 'Partial' : 'รอผล');
s.ehLabCompactDateTime = (value) => {
	const text = String(value || '');
	if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return text;
	const date = text.slice(8, 10) + '/' + text.slice(5, 7) + '/' + String(Number(text.slice(0, 4)) + 543).slice(2);
	const time = text.length >= 19 ? text.slice(11, 19) : text.length >= 16 ? text.slice(11, 16) : '';
	return date + (time ? ' ' + time : '');
};
s.ehLabFlagType = (flag) => (flag === 'C' ? 'danger' : flag === 'H' || flag === 'L' || flag === 'A' ? 'warning' : 'success');
s.ehLabFlagLabel = (rowOrFlag) => {
	const interpretation = rowOrFlag && typeof rowOrFlag === 'object' ? String(rowOrFlag.interpretation || '').trim() : '';
	if (interpretation) return interpretation;
	const flag = rowOrFlag && typeof rowOrFlag === 'object' ? rowOrFlag.flag : rowOrFlag;
	return flag === 'C' ? 'C' : flag === 'H' ? 'H' : flag === 'L' ? 'L' : flag === 'A' ? 'A' : '-';
};
s.ehLabFileName = (file) => String((file && (file.name || (file.response && file.response.fileName))) || 'ไฟล์แนบผลตรวจ');
s.ehLabFileUrl = (file) => String((file && (file.url || (file.response && file.response.filePath))) || '');
s.ehLabFileSize = (file) => {
	const n = Number(file && file.size);
	if (!n) return '';
	return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.ceil(n / 1024) + ' KB';
};

/* ══ ล้าง state ใหม่ตอนเปลี่ยนคนไข้ ═══════════════════════════════════════
   ห่อ ehLabLoad เดิมไว้ ตัวเดิมยังถูกเรียกครบทุกครั้ง — ที่เพิ่มคือล้างของใหม่ก่อนโหลดรอบใหม่
   (ถ้า process error ข้อมูลกลุ่มของคนไข้คนก่อนต้องไม่ค้างอยู่บนจอ) */


/* MLab read-only viewer parity with LAB Worklist.
 * Raw result_value is displayed and copied as received. Do not infer Gram
 * stain, organism, MIC, S/I/R, abnormal, or critical values from its text.
 */
s.ehLabIsMicrobiologyDialog = () => !!(s.ehLabDialog && s.ehLabDialog.order && s.ehLabDialog.order.micro);
s.ehLabAttachmentCount = () => (s.ehLabDialog && s.ehLabDialog.order && Array.isArray(s.ehLabDialog.order.attachments) ? s.ehLabDialog.order.attachments.length : 0);
s.ehLabScrollToAttachments = () => {
	if (typeof document === 'undefined') return;
	const target = document.getElementById('eh-lab-result-attachments');
	if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
s.ehLabPreviousValues = (row) => (row && !row.redacted && Array.isArray(row.previous_values) ? row.previous_values.slice(0, 5) : []);
s.ehLabPreviousSnapshot = (item) => [
	item && item.unit ? item.unit : '',
	item && item.interpretation ? item.interpretation : '',
	item && item.ref ? 'ปกติ ' + item.ref : '',
].filter(Boolean).join(' · ');
s.ehLabOpenMbHistory = (row) => {
	if (!row || !s.ehLabPreviousValues(row).length) return;
	s.ehLabMbHistory = { visible: true, row };
};
s.ehLabCloseMbHistory = () => {
	s.ehLabMbHistory = { visible: false, row: null };
};
s.ehLabMicroGroupKey = (group, index) => String((group && (group.group_key || group.test_code || group.test_name)) || 'micro-result-' + String(index || 0));
s.ehLabMicroGroupsForDisplay = () => {
	const groups = s.ehLabIsMicrobiologyDialog() && Array.isArray(s.ehLabDialog.order.result_groups) ? s.ehLabDialog.order.result_groups : [];
	return s.ehLabMicroSelectedGroupKey ? groups.filter((group, index) => s.ehLabMicroGroupKey(group, index) === s.ehLabMicroSelectedGroupKey) : groups;
};
s.ehLabMicroHasValue = (row) => !!row && !row.redacted && String(row.value == null ? '' : row.value).trim() !== '' && String(row.value).trim() !== '—';
s.ehLabMicroResultRows = (group) => (Array.isArray(group && group.results) ? group.results : []).filter(s.ehLabMicroHasValue);
s.ehLabMicroGroupHasResult = (group) => s.ehLabMicroResultRows(group).length > 0;
s.ehLabMicroGroupStatusValue = (group) => {
	const rows = s.ehLabMicroResultRows(group);
	if (!rows.length) return 'pending';
	const statuses = rows.map((row) => String((row && row.status) || '').toLowerCase()).filter(Boolean);
	return statuses.length && statuses.every((status) => ['f', 'final', 'completed', 'complete'].indexOf(status) >= 0) ? 'final' : 'partial';
};
s.ehLabMicroGroupStatusText = (group) => ({ final: 'Final', partial: 'Partial result', pending: 'รอผล' }[s.ehLabMicroGroupStatusValue(group)]);
s.ehLabMicroStatusStyle = (value) =>
	value === 'final'
		? { borderColor: '#b3e19d', background: '#f0f9eb', color: '#529b2e' }
		: value === 'partial'
		? { borderColor: '#f3d19e', background: '#fdf6ec', color: '#b88230' }
		: { borderColor: '#c8c9cc', background: '#f4f4f5', color: '#909399' };
s.ehLabMicroGroupStatusStyle = (group) => s.ehLabMicroStatusStyle(s.ehLabMicroGroupStatusValue(group));
s.ehLabMicroOverallStatusValue = () => {
	const groups = s.ehLabMicroGroupsForDisplay();
	if (!groups.length || groups.every((group) => !s.ehLabMicroGroupHasResult(group))) return 'pending';
	return groups.every((group) => s.ehLabMicroGroupStatusValue(group) === 'final') ? 'final' : 'partial';
};
s.ehLabMicroOverallStatusText = () => ({ final: 'Final', partial: 'Partial result', pending: 'รอผล' }[s.ehLabMicroOverallStatusValue()]);
s.ehLabMicroOverallStatusStyle = () => s.ehLabMicroStatusStyle(s.ehLabMicroOverallStatusValue());
s.ehLabMicroGroupReportedAt = (group) => {
	const times = (Array.isArray(group && group.results) ? group.results : []).map((row) => String((row && row.reported_at) || '')).filter(Boolean).sort();
	return times[times.length - 1] || '';
};
s.ehLabMicroLatestReportedAt = () => {
	const order = (s.ehLabDialog && s.ehLabDialog.order) || {};
	const times = s.ehLabMicroGroupsForDisplay().map(s.ehLabMicroGroupReportedAt).filter(Boolean).sort();
	return times[times.length - 1] || order.reported_at || order.resulted_at || '';
};
s.ehLabMicroResultCountText = () => {
	const groups = s.ehLabMicroGroupsForDisplay();
	const done = groups.filter(s.ehLabMicroGroupHasResult).length;
	return 'ทั้งหมด ' + groups.length + ' · มีผล ' + done + ' · รอผล ' + Math.max(0, groups.length - done);
};
s.ehLabMicroPatientName = () => {
	const order = (s.ehLabDialog && s.ehLabDialog.order) || {};
	const raw = order._raw || {};
	const visit = s.ehVisit || {};
	const person = visit.person || visit.patient || {};
	return String(raw.patient_name || visit.patient_name || person.name || person.full_name || person.display_name || [person.prefix, person.first_name || person.firstname, person.last_name || person.lastname].filter(Boolean).join(' ') || '');
};
s.ehLabMicroItems = (order) => {
	const o = order || {};
	const groups = Array.isArray(o.result_groups) ? o.result_groups : [];
	const ordered = o._raw && Array.isArray(o._raw.ordered_items) ? o._raw.ordered_items : [];
	const used = {};
	const items = ordered.map((item, itemIndex) => {
		const itemId = String((item && item.item_id) || '');
		let groupIndex = groups.findIndex((group) => String((group && group.group_key) || '') === itemId);
		if (groupIndex < 0) groupIndex = groups.findIndex((group) => (Array.isArray(group && group.results) ? group.results : []).some((row) => String((row && row.visibility && row.visibility.item_id) || '') === itemId));
		if (groupIndex < 0 && item && item.result_code) groupIndex = groups.findIndex((group) => String((group && group.test_code) || '') === String(item.result_code));
		if (groupIndex < 0 && ordered.length === 1 && groups.length === 1) groupIndex = 0;
		const group = groupIndex >= 0 ? groups[groupIndex] : null;
		if (group) used[s.ehLabMicroGroupKey(group, groupIndex)] = true;
		return {
			item_id: itemId || 'micro-item-' + itemIndex,
			item_code: String((item && (item.item_code || item.result_code)) || ''),
			item_name: String((item && item.item_name) || (group && group.test_name) || ''),
			specimen_name: String((item && item.specimen_name) || ''),
			collected_at: String((item && item.collected_at) || ''),
			group_key: group ? s.ehLabMicroGroupKey(group, groupIndex) : '',
			has_result: !!group && (Array.isArray(group.results) ? group.results : []).some(s.ehLabMicroHasValue),
		};
	});
	groups.forEach((group, groupIndex) => {
		const groupKey = s.ehLabMicroGroupKey(group, groupIndex);
		if (used[groupKey]) return;
		items.push({ item_id: groupKey, item_code: String(group.test_code || ''), item_name: String(group.test_name || ''), specimen_name: '', collected_at: '', group_key: groupKey, has_result: s.ehLabMicroGroupHasResult(group) });
	});
	return items;
};
s.ehLabMicroSelectedItem = () => {
	const order = (s.ehLabDialog && s.ehLabDialog.order) || {};
	return s.ehLabMicroItems(order).find((item) => item.group_key && item.group_key === s.ehLabMicroSelectedGroupKey) || null;
};
s.ehLabMicroSpecimenName = () => {
	const order = (s.ehLabDialog && s.ehLabDialog.order) || {};
	const raw = order._raw || {};
	const item = s.ehLabMicroSelectedItem();
	return String((item && item.specimen_name) || raw.specimen_name || raw.specimen || raw.specimen_type || '');
};
s.ehLabMicroCollectedAt = () => {
	const order = (s.ehLabDialog && s.ehLabDialog.order) || {};
	const item = s.ehLabMicroSelectedItem();
	return String((item && item.collected_at) || order.collected_at || '');
};
const ehLabMicroItemReportOrder = (order, item) => {
	const groups = Array.isArray(order && order.result_groups) ? order.result_groups : [];
	const group = groups.find((candidate, index) => s.ehLabMicroGroupKey(candidate, index) === String((item && item.group_key) || ''));
	const reportIds = Array.from(
		new Set(
			(Array.isArray(group && group.results) ? group.results : [])
				.map((row) => String((row && row.result_report_id) || ''))
				.filter((id) => /^[a-f0-9]{24}$/i.test(id)),
		),
	);
	const ready = !!EH_LAB_MICRO_RESULT_PDF_REPORT_ID && reportIds.length === 1;
	const next = Object.assign({}, order, {
		report_ready: ready,
		report_list: ready ? [{ reportId: EH_LAB_MICRO_RESULT_PDF_REPORT_ID, label: 'PDF', type: 'pdf' }] : [],
		report_params: ready ? { xparentx: reportIds[0] } : {},
		report_hint: ready ? '' : reportIds.length > 1 ? 'รายการนี้มีผลหลายชุด จึงไม่เลือก Result Report ให้อัตโนมัติ' : 'ยังไม่มี Result Report สำหรับ PDF MLab',
	});
	next._raw = Object.assign({}, (order && order._raw) || {}, { result_report_ids: reportIds });
	return next;
};
s.ehLabOpenMicroItem = (order, item) => {
	if (!order || !item || !item.has_result || !item.group_key) return;
	s.ehLabMicroSelectedGroupKey = item.group_key;
	// The card groups an entire Microbiology Order, but this popup is one CPOE
	// Item. Pass only that Item's current Result Report parent to Report Factory.
	s.ehLabOpenOrder(ehLabMicroItemReportOrder(order, item));
};
s.ehLabCopyMicrobiologyResult = () => {
	const lines = [];
	s.ehLabMicroGroupsForDisplay().forEach((group) => {
		lines.push([String((group && group.test_code) || ''), String((group && group.test_name) || ''), s.ehLabMicroGroupStatusText(group)].filter(Boolean).join(' · '));
		s.ehLabMicroResultRows(group).forEach((row) => {
			lines.push(['รหัสผล ' + (row.code || '-'), 'ชื่อ/รหัสจาก MLab ' + (row.name || '-')].join(' · '));
			lines.push(String(row.value || ''));
		});
		if (!s.ehLabMicroGroupHasResult(group)) lines.push('รอผล');
		lines.push('');
	});
	const text = lines.join('\n').trim();
	if (!text) {
		if (field.notify) field.notify('ไม่มีผลให้คัดลอก', 'warning', 2500);
		return;
	}
	if (typeof field.copyClipboard === 'function') field.copyClipboard(text);
	if (field.notify) field.notify('คัดลอกผลที่แสดงแล้ว', 'success', 2200);
};

s.ehLabReset = () => {
	if (s.ehLabSensitiveExpiryTimer) clearTimeout(s.ehLabSensitiveExpiryTimer);
	s.ehLabLoading = false;
	s.ehLabError = '';
	s.ehLabOrders = [];
	s.ehLabHn = '';
	s.ehLabOgOpen = {};
	s.ehLabDialog = { visible: false, order: null };
	s.ehLabMbHistory = { visible: false, row: null };
	s.ehLabMicroSelectedGroupKey = '';
	s.ehLabResultGroupOpen = {};
	s.ehLabReauth = { visible: false, loading: false, error: '', username: '', password: '', purpose: 'ดูแลรักษาผู้ป่วย', mode: 'view', placement: '', order: null, item: null };
	s.ehLabPdfGrant = { orderKey: '', placement: '', token: '', expiresAt: 0 };
	s.ehLabSensitiveExpiryTimer = null;
};

s.ehLabCardsForGroup = (group) => {
	if (!group || String(group.type || '').toLowerCase() !== 'lab') return [];
	const orderIds = {};
	(Array.isArray(group.items) ? group.items : []).forEach((item) => {
		const orderId = String((item && item.order_id) || '');
		if (orderId) orderIds[orderId] = true;
	});
	return s.ehLabOrders.filter((order) => order.source_order_id && orderIds[order.source_order_id]);
};

s.ehLabLoad = (visit) => {
	const form = field.getFormRef();
	if (!form) return;
	const visitId = String((visit && (visit.visit_id || visit.data_id)) || '');
	const hn = String((visit && hnOfVisit(visit)) || '');
	if (!visitId) {
		s.ehLabError = 'ไม่พบ visit_id สำหรับโหลดผล Lab';
		return;
	}
	s.ehLabLoading = true;
	s.ehLabError = '';
	s.ehLabOrders = [];
	s.ehLabHn = hn;
	s.ehLabOgOpen = {};
	form.userState.runProcess(
		EH_LAB_BOARD_PROC,
		{ visit_id: visitId, hn: hn || null },
		(res) => {
			const data = (res && res.data) || {};
			s.ehLabLoading = false;
			if (data.success === false) {
				s.ehLabError = data.message || 'อ่านผล Lab ไม่สำเร็จ';
				return;
			}
			const orders = (Array.isArray(data.lab_orders) ? data.lab_orders : [])
				.filter((raw) => String((raw && raw.scope) || 'visit') !== 'today')
				.map(ehLabMkOrder)
				.filter(Boolean);
			s.ehLabOrders = orders;
			const opened = {};
			orders.forEach((order) => {
				if (order.criticals.length) opened[order.key] = true;
			});
			s.ehLabOgOpen = opened;
		},
		(err) => {
			s.ehLabLoading = false;
			s.ehLabError = 'อ่านผล Lab ไม่สำเร็จ: ' + ((err && err.message) || err);
		},
	);
};

s.ehLabReload = () => {
	if (s.ehVisit) s.ehLabLoad(s.ehVisit);
};
