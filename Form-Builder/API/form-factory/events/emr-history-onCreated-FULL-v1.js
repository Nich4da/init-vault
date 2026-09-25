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
s.ehLabResultGroupOpen = {};

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

const ehLabRow = (it) => {
	const r = {
		text: !!(it && it.text), // ผลเป็นรายงานความเรียง ไม่ใช่ค่าเดี่ยว
		name: String((it && (it.name || it.obs_name || it.test_name)) || '-'),
		code: String((it && (it.code || it.obs_code)) || ''),
		value: it && it.value != null && it.value !== '' ? String(it.value) : '—',
		unit: String((it && (it.unit || it.unit_symbol_snapshot)) || ''),
		ref: String((it && (it.ref || it.reference_range_snapshot)) || ''),
		comment: String((it && it.result_comment) || ''),
		result_item_id: String((it && it.result_item_id) || ''),
		group_id: String((it && it.group_id) || ''),
		group_name: String((it && it.group_name) || ''),
		source: String((it && it.result_source) || ''),
		status: String((it && it.result_status) || ''),
		reported_at: String((it && it.reported_at) || ''),
		reported_by: String((it && it.reported_by_source_name) || ''),
		verified_at: String((it && it.verified_at) || ''),
		verified_by: String((it && it.verified_by_source_name) || ''),
		previous:
			it && it.previous
				? {
						value: String(it.previous.value == null || it.previous.value === '' ? '—' : it.previous.value),
						unit: String(it.previous.unit || ''),
						when: String(it.previous.entered_at || ''),
				  }
				: null,
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
	const status = String(raw.status || '');
	const st = EH_LAB_STATUS[status] || { label: status || '—', type: 'danger' };
	const cancelled = status === 'cancelled' || status === 'rejected';
	const pending = EH_LAB_PENDING.indexOf(status) >= 0;
	const scope = String(raw.scope || 'visit');
	const rows = (Array.isArray(raw.items) ? raw.items : []).map(ehLabRow);
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
		resultGroupByKey[groupKey].results.push(row);
	});

	const o = {
		key: String(raw.order_id || raw.order_no || Math.random()),
		source_order_id: String(raw.source_order_id || ''),
		scope: scope,
		section: String(raw.section || 'ผลตรวจ'),
		order_no: String(raw.order_no || raw.order_id || ''),
		lab_no: String(raw.lab_no || ''),
		patient_hn: String(raw.patient_hn || s.ehLabHn || ''),
		status: status,
		pending: pending,
		cancelled: cancelled,
		cancel_reason: String(raw.cancel_reason || ''),
		ordered_at: String(raw.ordered_at || ''),
		resulted_at: String(raw.resulted_at || ''),
		reported_at: String(raw.reported_at || ''),
		reported_by: String(raw.reported_by_source_name || ''),
		verified_at: String(raw.verified_at || ''),
		verified_by: String(raw.verified_by_source_name || ''),
		attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
		rows: rows,
		result_groups: resultGroups,
		criticals: rows.filter((r) => r.flag === 'C'),
		// 🔴 ผลที่เป็น "รายงานความเรียง" (MB/MLab) แยกถังของตัวเอง — ต้องเห็นเสมอ
		//    LIS ไม่ได้ตีธงผิดปกติให้ ไม่ได้แปลว่าปกติ ⇒ ห้ามพับไปอยู่ใต้ "ค่าปกติ"
		abnormals: rows.filter((r) => ehLabIsAbn(r) && !r.text),
		texts: rows.filter((r) => r.text && !ehLabIsAbn(r)),
		normals: rows.filter((r) => !ehLabIsAbn(r) && !r.text),
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
	o.abn_text = o.abnormals.length ? 'ผิดปกติ ' + o.abnormals.length : o.texts.length ? 'มีรายงานผล' : rows.length ? 'ปกติทั้งหมด' : '';
	o.abn_type = o.abnormals.length ? (o.criticals.length ? 'danger' : 'warning') : o.texts.length ? 'info' : 'success';
	o.steps = pending ? ehLabSteps(raw) : [];

	// ── ปุ่มรายงานผล PDF ──────────────────────────────────────────────
	o.section_code = String(raw.section_code || '');
	const reportIds = (Array.isArray(raw.result_report_ids) ? raw.result_report_ids : []).filter((x) => /^[a-f0-9]{24}$/i.test(String(x)));
	o.micro = EH_LAB_MICRO_SECTIONS.indexOf(o.section_code) >= 0;
	// micro: Report เป็น static ⇒ ไม่ต้องมี Result Report ก็เปิดได้ (params ว่าง เหมือน Worklist)
	// ทั่วไป: ต้องมี Result Report ชุดเดียวเท่านั้น ไม่งั้นพิมพ์ผิดชุด
	const microParams = {};
	o.report_ready = o.micro ? !!EH_LAB_MICRO_RESULT_PDF_REPORT_ID : !!EH_LAB_RESULT_PDF_REPORT_ID && reportIds.length === 1;
	o.report_list = o.report_ready
		? [{ reportId: o.micro ? EH_LAB_MICRO_RESULT_PDF_REPORT_ID : EH_LAB_RESULT_PDF_REPORT_ID, label: 'รายงานผล', type: 'pdf' }]
		: [];
	o.report_params = o.report_ready ? (o.micro ? microParams : { xparentx: reportIds[0] }) : {};
	// บอกเหตุที่ปุ่มไม่มา / เตือนว่ายังเป็นตัวอย่าง ดีกว่าปล่อยให้เข้าใจผิด
	o.report_hint = o.micro
		? 'Microbiology: Report ยังเป็นแบบ static (SQL ยังไม่เชื่อม) — เนื้อผลจริงอ่านได้จากรายงานในการ์ด'
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
s.ehLabOrderTarget = (o) => !!(o && Array.isArray(o.rows) && o.rows.length);
s.ehLabOpenOrder = (o) => {
	if (!s.ehLabOrderTarget(o)) return;
	const opened = {};
	(Array.isArray(o.result_groups) ? o.result_groups : []).forEach((group, index) => {
		if (Array.isArray(group.results) && group.results.length > 1) opened[s.ehLabResultGroupKey(group, index)] = true;
	});
	s.ehLabResultGroupOpen = opened;
	s.ehLabDialog = { visible: true, order: o };
};
s.ehLabCloseLabDialog = () => {
	s.ehLabDialog = { visible: false, order: null };
	s.ehLabResultGroupOpen = {};
};
s.ehLabResultGroups = () => {
	const order = s.ehLabDialog.order;
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
s.ehLabResultTestCount = () => s.ehLabResultGroups().length;
s.ehLabResultRowsCount = () => {
	const order = s.ehLabDialog.order;
	return order && Array.isArray(order.rows) ? order.rows.length : 0;
};
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
s.ehLabHasResultValue = (row) => !!(row && row.value != null && row.value !== '' && row.value !== '—');
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
s.ehLabResultMeasuredStyle = (row) => ({ color: row && row.flag === 'C' ? '#c45656' : row && ehLabIsAbn(row) ? '#b88230' : 'var(--el-text-color-primary)', fontSize: '15px', fontWeight: 800, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' });
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
s.ehLabFlagLabel = (flag) => (flag === 'C' ? 'C' : flag === 'H' ? 'H' : flag === 'L' ? 'L' : flag === 'A' ? 'A' : '-');
s.ehLabFileName = (file) => String((file && (file.name || (file.response && file.response.fileName))) || 'ไฟล์แนบผลตรวจ');
s.ehLabFileUrl = (file) => String((file && (file.url || (file.response && file.response.filePath))) || '');
s.ehLabFileSize = (file) => {
	const n = Number(file && file.size);
	if (!n) return '';
	return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.ceil(n / 1024) + ' KB';
};

s.ehLabReset = () => {
	s.ehLabLoading = false;
	s.ehLabError = '';
	s.ehLabOrders = [];
	s.ehLabHn = '';
	s.ehLabOgOpen = {};
	s.ehLabDialog = { visible: false, order: null };
	s.ehLabResultGroupOpen = {};
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
