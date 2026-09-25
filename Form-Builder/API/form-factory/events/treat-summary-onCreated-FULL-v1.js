/**
 * treat_summary · onCreated — การ์ด "สรุปการรักษา" ในหน้า EMR (ฟอร์ม EMR 6a4f64e7f8cdfc54cec16488)
 *
 * วางที่: vue-ui `treat_summary` ในการ์ด `card62530`
 * หน้าที่: เห็นว่า "ครั้งก่อนรักษาอะไรไป" — CC / วินิจฉัย / ยา + sig / แผนการรักษา
 *          และผล Lab · X-ray ล่าสุดของคนไข้ (2 อย่างหลังไม่ผูก visit — ผูกด้วย HN)
 *
 * 🔴 ข้อมูลมาจาก snapshot ฟอร์ม Visit History ไม่ได้ query ตารางต้นทางเอง (ดู skill add-visit-history)
 *    visit เก่าที่ยังไม่เคยมี snapshot → process จะ build ให้เองครั้งแรกที่เปิด (คืน built:true)
 * 🔴 ทุก key ที่เทมเพลตอ้างต้องมีค่าตั้งแต่ตรงนี้ — ขาดตัวเดียว = error box ทั้ง widget
 * 🔴 `tsUi` ต้องเป็น object เพราะเทมเพลตใช้ v-model="tsUi.tab" (scope proxy ไม่มี set trap ให้ตัวแปรเดี่ยว)
 */

const s = this.vueState;
const field = this;

const SUMMARY_PROC = '6a9574cc1812c7078a067299'; // emr-summary-get

/* ══ state ════════════════════════════════════════════════════════════════ */
s.tsPid = null; // person _id ของคนไข้ที่เปิดอยู่
s.tsHn = null;
s.tsCurVisit = null; // visit ที่กำลังตรวจ — ตัดออกจากผลลัพธ์ (การ์ดนี้เล่า "ครั้งก่อน")
s.tsVisit = null; // { visit_id, vn, visit_date, clinic, doctor, history_id }
s.tsVisitTip = '';
s.tsHasHistory = false;
s.tsCc = '';
s.tsHpi = '';
s.tsPe = null; // ตรวจร่างกายครั้งล่าสุดที่มีบันทึก
s.tsDx = [];
s.tsMeds = [];
s.tsOther = [];
s.tsPlan = null;
s.tsHasPlan = false; // มีเนื้อ 'แผนการรักษา' จริงไหม (คำแนะนำผู้ป่วยแยกหัวข้อ ไม่นับ)
s.tsLab = [];
s.tsXray = [];
s.tsLoading = false;
s.tsErr = '';
s.tsUi = { tab: 'med' };

// ทุกหัวข้อมาจาก visit ใบเดียวกัน (พี่เคาะ: เอาแค่ใบล่าสุด) ⇒ ที่มาโชว์ที่หัวการ์ดที่เดียวพอ
s.tsFrom = null;

// form id ไว้กดเปิด record ต้นทาง — process ส่งกลับมาด้วย เผื่อฟอร์มถูกย้าย/เปลี่ยน
s.tsDxFormId = '6a47a9cc8ca8083d715e3486';
s.tsLabFormId = '6a8bc91df851000f28e501fb';
s.tsXrayFormId = '6a860980f851000f28e44ab0';

// "2026-08-10 09:15:00" / "2026-08-10" → "10/08/2569" (+ เวลา ถ้ามี) — พ.ศ. ตาม convention ของระบบ
s.tsWhen = (v) => {
	const t = String(v || '');
	if (t.length < 10) return t;
	const d = t.slice(8, 10) + '/' + t.slice(5, 7) + '/' + (Number(t.slice(0, 4)) + 543);
	return t.length >= 16 ? d + ' ' + t.slice(11, 16) : d;
};

// "มาจากครั้งไหน" — โชว์สั้น ๆ ท้ายหัวข้อ (วันที่ + VN ถ้ามี)
s.tsFromText = (f) => {
	if (!f) return '';
	const d = s.tsWhen(f.visit_date);
	return f.vn ? d + ' · VN ' + f.vn : d;
};

/* ══ โหลดสรุป ═════════════════════════════════════════════════════════════
   เรียกจาก opd_card.setTran (เปลี่ยนคนไข้) · onMounted (เข้าแท็บ EMR ทีหลัง) */
s.tsLoad = (personId, hn, curVisitId) => {
	s.tsPid = personId ? String(personId) : null;
	s.tsHn = hn || null;
	s.tsCurVisit = curVisitId ? String(curVisitId) : null;
	s.tsVisit = null;
	s.tsVisitTip = '';
	s.tsHasHistory = false;
	s.tsCc = '';
	s.tsHpi = '';
	s.tsPe = null;
	s.tsDx = [];
	s.tsMeds = [];
	s.tsOther = [];
	s.tsPlan = null;
	s.tsHasPlan = false;
	s.tsLab = [];
	s.tsXray = [];
	s.tsErr = '';
	if (!s.tsPid && !s.tsHn) return;

	const form = field.getFormRef();
	if (!form) return;

	s.tsLoading = true;
	form.userState.runProcess(
		SUMMARY_PROC,
		{ person_id: s.tsPid, hn: s.tsHn, visit_id: s.tsCurVisit },
		(res) => {
			s.tsLoading = false;
			const d = (res && res.data) || {};
			// process ที่ตีกลับด้วย success:false มาทาง callback นี้เหมือนกัน ไม่ใช่ errCb
			if (!d.success) {
				s.tsErr = d.message || 'อ่านสรุปการรักษาไม่สำเร็จ';
				return;
			}
			s.tsHasHistory = !!d.has_history;
			s.tsVisit = d.visit || null;
			s.tsVisitTip = s.tsVisit
				? 'สรุปจากการรักษาวันที่ ' + s.tsWhen(s.tsVisit.visit_date) + ' (VN ' + (s.tsVisit.vn || '-') + ')' + (d.built ? ' · สร้างสรุปให้ตอนเปิดครั้งแรก' : '')
				: '';
			s.tsCc = d.cc || '';
			s.tsHpi = d.hpi || '';
			s.tsPe = d.pe || null;
			s.tsFrom = d.from || null;
			s.tsDx = Array.isArray(d.dx) ? d.dx : [];
			s.tsMeds = Array.isArray(d.meds) ? d.meds : [];
			s.tsOther = Array.isArray(d.other) ? d.other : [];
			s.tsPlan = d.plan || null;
			// หัวข้อ "แผนการรักษา" โผล่เฉพาะตอนมีเนื้อจริง — คำแนะนำผู้ป่วย (education) แยกหัวข้อของตัวเอง
			s.tsHasPlan = !!(s.tsPlan && (s.tsPlan.disposition || s.tsPlan.sick_leave_days || s.tsPlan.safety_net));
			s.tsLab = Array.isArray(d.lab) ? d.lab : [];
			s.tsXray = Array.isArray(d.xray) ? d.xray : [];
			s.tsAbsorb(d); // แท็บ Lab/X-Ray แบบจัดกลุ่ม — ดูบล็อกท้ายไฟล์
			if (d.lab_form_id) s.tsLabFormId = d.lab_form_id;
			if (d.xray_form_id) s.tsXrayFormId = d.xray_form_id;
			// เปิดแท็บที่มีของให้ก่อน — ค่าเริ่มเป็นยา (ตัวที่หมอดูบ่อยสุด) ไม่มียาค่อยตกไป Lab แล้ว X-ray
			if (s.tsMeds.length) s.tsUi.tab = 'med';
			else if (s.tsLab.length) s.tsUi.tab = 'lab';
			else if (s.tsXray.length) s.tsUi.tab = 'xray';
			else if (s.tsOther.length) s.tsUi.tab = 'proc';
			else s.tsUi.tab = 'med';
		},
		(err) => {
			s.tsLoading = false;
			s.tsErr = 'อ่านสรุปการรักษาไม่สำเร็จ: ' + ((err && err.message) || err);
		}
	);
};

// ดึง context คนไข้จาก tran ที่ opd_card เซ็ตไว้ที่ form.$examTran (แหล่งเดียวกับการ์ดอื่นในหน้านี้)
s.tsLoadFromTran = (tran) => {
	const visit = (tran && tran.vid) || null;
	const pt = (visit && visit.pid) || {};
	// person id อยู่ที่ chain ของ joiner (parent ของ visit = person) — pid ใน visit เป็น snapshot ไม่มี _id
	const personId = visit && visit.xtbxlv1_xfx_id ? String(visit.xtbxlv1_xfx_id) : null;
	s.tsLoad(personId, pt.hn || null, visit && visit.value ? String(visit.value) : null);
};

s.tsReload = () => s.tsLoad(s.tsPid, s.tsHn, s.tsCurVisit);

/* ══ เปิด record ต้นทาง ═══════════════════════════════════════════════════
   ทุกก้อนใน snapshot พก form_id + data_id มาด้วย ⇒ กดดูใบจริงได้จากทุกบรรทัด */
s.tsOpen = (formId, dataId) => {
	if (!formId || !dataId) return;
	const form = field.getFormRef();
	if (!form) return;
	form.openForm(String(formId), String(dataId), '', null, {
		// 🔴 ต้อง spread formParams ของแม่ ไม่งั้น popup ไม่เหลือ _id/xsitex/xunitx (ระบบใช้ตัดสิน site/unit)
		params: Object.assign({}, form.formParams),
		cancelCallback: () => form.subFormClose(),
	});
};

// เปิดจอ EMR History ของ visit ครั้งก่อนทั้งใบ (ก้อนที่การ์ดนี้ไม่ได้แสดง เช่น vital sign / ใบสั่งทุกใบ / การเงิน)
// 🔴 form_ui ไม่มี record ของตัวเอง ⇒ เปิดด้วย dataId ว่าง แล้วส่ง visit_id ไปทาง params
//    (จอนั้นหา snapshot เอง — ยังไม่มีก็ build ให้ ⇒ ไม่ต้องพึ่ง history_id ที่อาจยังไม่เกิด)
s.tsOpenVisit = () => {
	const EMR_HISTORY_FORM = '6a96557e422c1ca959829eae'; // จอ EMR History (form_ui อ่านอย่างเดียว)
	const visitId = s.tsVisit && s.tsVisit.visit_id;
	if (!visitId) return;
	const form = field.getFormRef();
	if (!form) return;
	const ctx = Object.assign({}, form.formParams, { visit_id: String(visitId), history_id: (s.tsVisit && s.tsVisit.history_id) || '' });
	form.openForm(EMR_HISTORY_FORM, '', '', ctx, {
		params: ctx,
		cancelCallback: () => form.subFormClose(),
	});
};


/**
 * treat_summary · แท็บ Lab / X-Ray แบบจัดกลุ่มตามใบสั่ง
 * ฟอร์ม EMR `6a4f64e7f8cdfc54cec16488` · widget vue-ui `treat_summary` (การ์ด `card62530`)
 *
 * ⬆️ ทุกอย่างเหนือบรรทัดนี้คือ onCreated เดิม **ไม่ถูกแก้เลยสักตัวอักษร**
 *    ยกเว้นบรรทัดเดียวใน callback ของ `tsLoad` ที่เติม `s.tsAbsorb(d);` เข้าไป
 * ⬇️ ตั้งแต่บรรทัดนี้ลงไปคือของใหม่ทั้งหมด — เพิ่มอย่างเดียว ไม่เขียนทับคีย์เดิมสักตัว
 *    (ยกเว้น `s.tsLoad` ที่ถูก "ห่อ" ไว้ท้ายไฟล์ ตัวเดิมยังถูกเรียกครบทุกครั้ง)
 *
 * 🔴 ต้องใช้คู่กับ Template ที่มีแท็บ Lab / X-Ray เวอร์ชันใหม่ — ถ้ายังเป็น Template เดิม
 *    ไฟล์นี้จะไม่ทำให้อะไรพัง แต่ก็ไม่เห็นผลอะไร (ของใหม่ไม่มีใครเรียกใช้)
 * 🔴 ถ้า process ยังไม่ส่ง `lab_orders` / `xray_results` มา → `tsLgOn` / `tsXgOn` เป็น false
 *    Template จะตกไปแสดง "ลิสต์แบนแบบเดิม" เหมือนทุกวันนี้เป๊ะ ๆ
 *
 * ── สัญญาข้อมูลที่ `emr-summary-get` (6a9574cc1812c7078a067299) ต้องส่งเพิ่ม ──────
 *    เพิ่ม **คีย์ใหม่** เท่านั้น ห้ามแก้/ตัด `lab[]` `xray[]` เดิม
 *    (ตรรกะเลือกแท็บเริ่มต้นด้านบนยังอ่านจาก `tsLab.length` / `tsXray.length`)
 *
 *  d.current_vn   : "6900305"                       // VN ที่เปิดอยู่ (ไว้ขึ้นหัวข้อ)
 *  d.lab_orders   : [{
 *      order_id, order_no, section, lab_no,
 *      section_code,      // 'BC'|'HM'|'HH'|'ML'|'MB' — จอใช้เลือก Report ผล (MB = micro)
 *      status,            // sent|accepted|collected|in_process|resulted|completed|cancelled|rejected
 *      scope,             // "visit" = ใบของ VN นี้ · "today" = สั่งครั้งก่อนแต่ผลออกวันนี้
 *      ordered_at,        // "YYYY-MM-DD HH:mm:ss"  เวลาสั่ง
 *      resulted_at,       // "" ถ้ายังไม่ออกผล      เวลาที่ผลเข้าระบบ HIS
 *      received_at, collected_at, in_process_at,    // ออปชัน — ใช้วาด stepper
 *      cancel_reason,
 *      result_report_ids, // id ของ Result Report ที่พบในใบนี้ — ปุ่ม PDF ขึ้นเฉพาะตอนมีชุดเดียว
 *      view_form_id, view_data_id,                  // ออปชัน — ปุ่ม "ดูผลทั้งใบ"
 *      items: [{ name, code, value, unit, ref, flag, critical, text, form_id, data_id }]
 *                         // text:true = ผลเป็นรายงานความเรียง (MB/MLab) ไม่ใช่ค่าเดี่ยว
 *    }]
 *  d.xray_results : [{ key, exam_name, accession_no, scope, ordered_at, resulted_at,
 *                      severity, result_text, form_id, data_id }]
 *  d.lab_trends   : [{ name, unit, ref, flag, series:[{ when, value }] }]   // ออปชัน
 *
 * 🔴 ขอบเขตที่ผู้ใช้เคาะ 2026-09-22: การ์ดแสดงแค่ 2 กลุ่ม — ใบของ VN ที่เปิดอยู่ กับใบที่
 *    "ผลออกวันนี้" นับจาก **เวลาที่ผลเข้าระบบ HIS** · การกรองเป็นหน้าที่ของ process (`scope`)
 * 🔴 การ์ดโชว์ค่าล่าสุดค่าเดียว — ค่าก่อนหน้าอยู่ในจอ "ดูผลทั้งใบ" ที่เดียว
 */

/* ══ Report ผลตรวจ (PDF) — Report และคอมโพเนนต์ชุดเดียวกับ LAB Worklist ═════
   ห้องแลปทั่วไป : `Lab result` ดึงจาก `zdata_lab_report_manual_entry`
                  ⇒ ผูกกับ **Result Report** ด้วย `xparentx = result_report_id` (ไม่ใช่ใบสั่ง)
                  🔴 ใบที่มีชุดผลหลายชุด พิมพ์เพียงชุดเดียวไม่ได้ ⇒ ซ่อนปุ่ม (กติกาเดียวกับ Worklist)
   Microbiology  : `Lab result - microbiology (static)` ดึงจาก `zdata_visit` — **ยังเป็น static**
                  เพราะ SQL ฝั่ง micro ยังไม่เชื่อม ⇒ เชื่อมปุ่มไว้รอก่อนตามที่พี่สั่ง (2026-09-22)
                  ส่ง params ว่างเหมือน Worklist ทำ · พอ SQL เชื่อมแล้วน่าจะเปลี่ยนเป็น
                  `xparentx = result_report_id` เหมือนของทั่วไป — แก้ที่ `microParams` จุดเดียว */
const LAB_RESULT_PDF_REPORT_ID = '6aa8f5a8b92813319a86ea11';
const MICRO_RESULT_PDF_REPORT_ID = '6ab1c2d3e4f5061728394a5b';
const MICRO_SECTIONS = ['MB'];

/* ══ ป้ายสถานะใบ — ชุดเดียวกับการ์ด "ใบสั่งตรวจ" (item_card) ═════════════════
   🔴 ค่าที่ไม่รู้จักต้องโชว์ค่าดิบ ห้ามแปลงเป็น "ร่าง" — ใบที่สถานะเพี้ยนต้องมองเห็นได้ */
const TS_LAB_STATUS = {
	draft: { label: 'ร่าง', type: 'info' },
	sent: { label: 'ส่งแล้ว', type: 'warning' },
	// `ready` เป็นสถานะจริงของ CPOE ที่ยังไม่ยืนยันความหมาย ⇒ คงคำดิบไว้
	// แต่ให้สีส้ม (กำลังดำเนินการ) ไม่ใช่แดง เพราะมันไม่ใช่ความผิดพลาด
	ready: { label: 'ready', type: 'warning' },
	accepted: { label: 'ห้องแลปรับแล้ว', type: 'warning' },
	collected: { label: 'เก็บสิ่งส่งตรวจแล้ว', type: 'warning' },
	in_process: { label: 'กำลังตรวจ', type: 'warning' },
	resulted: { label: 'มีผลแล้ว', type: 'success' },
	completed: { label: 'เสร็จสิ้น', type: 'success' },
	cancelled: { label: 'ยกเลิก', type: 'info' },
	rejected: { label: 'ปฏิเสธสิ่งส่งตรวจ', type: 'danger' },
};
const TS_PENDING = ['draft', 'sent', 'ready', 'prepared', 'accepted', 'collected', 'in_process'];

/* ══ state ใหม่ (ต้องมีค่าตั้งแต่ตรงนี้ — ขาดตัวเดียว = error box ทั้ง widget) ══ */
s.tsLgOn = false; // มีข้อมูลแบบจัดกลุ่มจาก process ไหม (false = ตกไปใช้ลิสต์แบบเดิม)
s.tsXgOn = false;
s.tsLgVisit = []; // ใบสั่งของ VN ที่เปิดอยู่
s.tsLgToday = []; // สั่งครั้งก่อน แต่ผลออกวันนี้
s.tsXgVisit = [];
s.tsXgToday = [];
s.tsLgSections = []; // [{ key, title, empty, list }] — หัวข้อ "วิสิทนี้ / ผลออกวันนี้" ประกอบที่ JS
s.tsXgSections = []; //  ⇒ Template วน v-for ชั้นเดียว ไม่ต้องก๊อป markup ก้อนผลสองชุด
s.tsTrends = []; // แนวโน้มรายค่า (โหมด "ตามค่าตรวจ")
s.tsVnLabel = '';
s.tsOgOpen = {}; // key ของก้อน/บล็อกที่กางอยู่
s.tsLgUi = { mode: 'order' }; // 🔴 ต้องเป็น object — scope proxy ไม่มี set trap ให้ตัวแปรเดี่ยว
s.tsLabDialog = { visible: false, order: null }; // popup อ่านอย่างเดียว — ห้ามเปิด Result Item CRUD จากหน้า EMR
s.tsResultGroupOpen = {}; // สถานะกาง/พับ Profile ใน popup ผลทั้งใบ

/* ══ helper เล็ก ๆ ════════════════════════════════════════════════════════ */
// "2026-09-22 10:52:00" → "10:52" (รับ "10:52" ที่ส่งมาตรง ๆ ด้วย)
const tsHm = (v) => {
	const t = String(v || '');
	if (t.length >= 16) return t.slice(11, 16);
	return /^\d{2}:\d{2}/.test(t) ? t.slice(0, 5) : '';
};
// "2026-09-18" → "18/09/69" (พ.ศ. 2 หลัก — หัวก้อนแคบ ปีเต็มไม่พอที่)
const tsDmy = (v) => {
	const t = String(v || '');
	if (t.length < 10) return '';
	return t.slice(8, 10) + '/' + t.slice(5, 7) + '/' + String(Number(t.slice(0, 4)) + 543).slice(2);
};
const tsIsNum = (v) => /^[\d.,<>≥≤+\- ]+$/.test(String(v == null ? '' : v));
// ค่าที่ไม่ใช่ตัวเลข (ขึ้นเชื้อ / S / R) ไม่ต้องมีลูกศร — ลูกศรสื่อว่าสูง/ต่ำกว่าค่าปกติ
s.tsArrow = (f, v) => (v !== undefined && !tsIsNum(v) ? '' : f === 'H' || f === 'C' ? '▲' : f === 'L' ? '▼' : '');

// flag มาตรฐานของจอ: C=วิกฤติ · H=สูง · L=ต่ำ · A=ผิดปกติ(ไม่ใช่ตัวเลข) · N=ปกติ
const tsFlagOf = (it) => {
	if (it && it.critical === true) return 'C';
	const f = String((it && (it.flag || it.interpretation || it.interpretation_code)) || '').toUpperCase();
	if (f === 'HH' || f === 'LL' || f === 'CC' || f === 'CRIT') return 'C';
	if (f === 'H' || f === 'HIGH') return 'H';
	if (f === 'L' || f === 'LOW') return 'L';
	if (f === 'A' || f === 'AB' || f === 'ABNORMAL' || f === 'POS') return 'A';
	return 'N';
};
const tsIsAbn = (r) => r.flag === 'C' || r.flag === 'H' || r.flag === 'L' || r.flag === 'A';

const tsRow = (it) => {
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
	r.flag = tsFlagOf(it);
	r.arrow = s.tsArrow(r.flag, r.value);
	return r;
};

/* ══ stepper ของใบที่ยังไม่ออกผล ══════════════════════════════════════════
   🔴 ขึ้นเฉพาะใบที่ยังไม่มีผลเท่านั้น — ผลออกเมื่อไหร่ stepper หายทันที แทนที่ด้วยบรรทัดค่าผล */
const tsSteps = (o) => {
	const raw = String(o.status || '');
	const seq = ['sent', 'accepted', 'in_process', 'resulted'];
	const at = { sent: o.ordered_at, accepted: o.received_at || o.collected_at, in_process: o.in_process_at, resulted: o.resulted_at };
	const label = { sent: 'ส่งใบ', accepted: 'ห้องแลปรับ', in_process: 'กำลังตรวจ', resulted: 'ออกผล' };
	// ใบที่ status เพี้ยน/ไม่รู้จัก → ถือว่าอยู่ขั้นแรก ดีกว่าเดาให้ไกลกว่าความจริง
	let cur = seq.indexOf(raw === 'collected' ? 'accepted' : raw);
	if (cur < 0) cur = 0;
	return seq.map((k, i) => ({
		label: label[k],
		time: tsHm(at[k]),
		state: i < cur ? 'done' : i === cur ? 'now' : 'todo',
	}));
};
// เส้นเชื่อมระหว่างจุด — วาดเป็น element จริง (inline style ทำ ::before ไม่ได้)
s.tsStepLine = (steps, i, side) => {
	const last = steps.length - 1;
	if ((side === 'l' && i === 0) || (side === 'r' && i === last)) return { flex: 1, height: '2px', background: 'transparent' };
	const done = side === 'l' ? steps[i - 1].state === 'done' : steps[i].state === 'done';
	return { flex: 1, height: '2px', background: done ? 'var(--el-color-success)' : 'var(--el-border-color-light)' };
};
s.tsStepDot = (st) => {
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
const tsMkOrder = (raw) => {
	if (!raw) return null;
	const status = String(raw.status || '');
	const st = TS_LAB_STATUS[status] || { label: status || '—', type: 'danger' };
	const cancelled = status === 'cancelled' || status === 'rejected';
	const pending = TS_PENDING.indexOf(status) >= 0;
	const scope = String(raw.scope || 'visit');
	const rows = (Array.isArray(raw.items) ? raw.items : []).map(tsRow);
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
		scope: scope,
		section: String(raw.section || 'ผลตรวจ'),
		order_no: String(raw.order_no || raw.order_id || ''),
		lab_no: String(raw.lab_no || ''),
		patient_hn: String(raw.patient_hn || s.tsHn || ''),
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
		abnormals: rows.filter((r) => tsIsAbn(r) && !r.text),
		texts: rows.filter((r) => r.text && !tsIsAbn(r)),
		normals: rows.filter((r) => !tsIsAbn(r) && !r.text),
	};

	// เวลา 2 จุดเสมอ: สั่ง → ผล · ใบที่ยังไม่ออกผลมีแค่เวลาสั่ง (ห้ามเติมเวลาปลอม)
	const t1 = tsHm(raw.ordered_at);
	const t2 = tsHm(raw.resulted_at);
	o.time_text = t1 ? (t2 && !pending && !cancelled ? 'สั่ง ' + t1 + ' → ผล ' + t2 : 'สั่ง ' + t1) : t2 ? 'ผล ' + t2 : '';
	// วันที่ขึ้นเฉพาะใบที่สั่งครั้งก่อน — ใบของวิสิทนี้เป็นวันเดียวกันอยู่แล้ว
	const d1 = tsDmy(raw.ordered_at);
	o.sub_text = (scope === 'today' && d1 ? d1 + ' · ' : '') + o.order_no;

	o.chip_text = scope === 'today' && !pending && !cancelled ? 'ผลออกวันนี้' : st.label;
	o.chip_type = scope === 'today' && !pending && !cancelled ? 'warning' : st.type;
	// มีรายงานความเรียงแต่ไม่มีธงผิดปกติ ⇒ ห้ามขึ้นว่า "ปกติทั้งหมด" (เราไม่รู้ว่าปกติ)
	o.abn_text = o.abnormals.length ? 'ผิดปกติ ' + o.abnormals.length : o.texts.length ? 'มีรายงานผล' : rows.length ? 'ปกติทั้งหมด' : '';
	o.abn_type = o.abnormals.length ? (o.criticals.length ? 'danger' : 'warning') : o.texts.length ? 'info' : 'success';
	o.steps = pending ? tsSteps(raw) : [];

	// ── ปุ่มรายงานผล PDF ──────────────────────────────────────────────
	o.section_code = String(raw.section_code || '');
	const reportIds = (Array.isArray(raw.result_report_ids) ? raw.result_report_ids : []).filter((x) => /^[a-f0-9]{24}$/i.test(String(x)));
	o.micro = MICRO_SECTIONS.indexOf(o.section_code) >= 0;
	// micro: Report เป็น static ⇒ ไม่ต้องมี Result Report ก็เปิดได้ (params ว่าง เหมือน Worklist)
	// ทั่วไป: ต้องมี Result Report ชุดเดียวเท่านั้น ไม่งั้นพิมพ์ผิดชุด
	const microParams = {};
	o.report_ready = o.micro ? !!MICRO_RESULT_PDF_REPORT_ID : !!LAB_RESULT_PDF_REPORT_ID && reportIds.length === 1;
	o.report_list = o.report_ready
		? [{ reportId: o.micro ? MICRO_RESULT_PDF_REPORT_ID : LAB_RESULT_PDF_REPORT_ID, label: 'รายงานผล', type: 'pdf' }]
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

/* ══ แนวโน้มรายค่า (โหมด "ตามค่าตรวจ") ═══════════════════════════════════
   ค่าที่มีจุดเดียวไม่ใช่แนวโน้ม — ตัดทิ้ง ไม่ต้องขึ้นเส้นตรงหลอกตา */
const tsMkTrend = (t) => {
	const pts = (Array.isArray(t && t.series) ? t.series : [])
		.map((p) => ({ when: String(p.when || ''), value: Number(p.value) }))
		.filter((p) => isFinite(p.value));
	if (pts.length < 2) return null;
	const W = 64;
	const H = 18;
	const vals = pts.map((p) => p.value);
	const mn = Math.min.apply(null, vals);
	const mx = Math.max.apply(null, vals);
	const rg = mx - mn || 1;
	const xy = pts.map((p, i) => [2 + i * ((W - 4) / (pts.length - 1)), H - 2 - ((p.value - mn) / rg) * (H - 5)]);
	const flag = tsFlagOf(t);
	return {
		key: String(t.name || '') + '|' + String(t.unit || ''),
		name: String(t.name || '-'),
		unit: String(t.unit || ''),
		ref: String(t.ref || ''),
		flag: flag,
		color: flag === 'C' ? 'var(--el-color-danger)' : flag === 'N' ? 'var(--el-color-success)' : 'var(--el-color-warning)',
		points: xy.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '),
		last_x: xy[xy.length - 1][0].toFixed(1),
		last_y: xy[xy.length - 1][1].toFixed(1),
		last_value: pts[pts.length - 1].value,
		series_text: pts.map((p) => p.value + ' (' + tsDmy(p.when).slice(0, 5) + ')').join(' → '),
	};
};

/* ══ X-ray ════════════════════════════════════════════════════════════════ */
const tsMkXray = (x, i) => {
	if (!x) return null;
	const t1 = tsHm(x.ordered_at);
	const t2 = tsHm(x.resulted_at);
	const scope = String(x.scope || 'visit');
	const d1 = tsDmy(x.ordered_at);
	return {
		key: String(x.key || x.accession_no || 'xr' + i),
		scope: scope,
		name: String(x.exam_name || x.name || 'X-ray'),
		severity: String(x.severity || ''),
		sev_type: String(x.severity || '') === 'ปกติ' ? 'success' : 'warning',
		time_text: t1 ? (t2 ? 'สั่ง ' + t1 + ' → ผล ' + t2 : 'สั่ง ' + t1) : t2 ? 'ผล ' + t2 : '',
		sub_text: (scope === 'today' && d1 ? d1 + ' · ' : '') + String(x.accession_no || ''),
		text: String(x.result_text || x.result || ''),
		form_id: String(x.form_id || ''),
		data_id: String(x.data_id || ''),
	};
};

/* ══ รับข้อมูลจาก process (เรียกจาก callback ของ tsLoad เดิม) ══════════════ */
s.tsAbsorb = (d) => {
	const src = d || {};
	s.tsVnLabel = String(src.current_vn || '');

	// 🔴 `tsLgOn` = "process พูดภาษาใหม่เป็นไหม" ไม่ใช่ "มีข้อมูลไหม"
	//    ถ้าผูกกับจำนวนข้อมูล วิสิทที่ยังไม่ได้สั่งตรวจจะตกไปแสดงลิสต์แบบเก่า
	//    ซึ่งเป็นผลของ "วิสิทอื่น" ⇒ หมอเห็นผลเก่าแล้วนึกว่าเป็นของวันนี้ (อันตรายกว่าไม่แสดงอะไร)
	//    ⇒ ดูที่ "มีคีย์ส่งมาไหม" แทน · ไม่มีใบก็แสดงสถานะว่างของแบบใหม่ ตรงกับการ์ด "ใบสั่งตรวจ" ข้าง ๆ
	const groups = (Array.isArray(src.lab_orders) ? src.lab_orders : []).map(tsMkOrder).filter(Boolean);
	s.tsLgVisit = groups.filter((g) => g.scope !== 'today');
	s.tsLgToday = groups.filter((g) => g.scope === 'today');
	s.tsLgOn = Array.isArray(src.lab_orders);

	const xs = (Array.isArray(src.xray_results) ? src.xray_results : []).map(tsMkXray).filter(Boolean);
	s.tsXgVisit = xs.filter((x) => x.scope !== 'today');
	s.tsXgToday = xs.filter((x) => x.scope === 'today');
	s.tsXgOn = Array.isArray(src.xray_results);

	const vnText = s.tsVnLabel ? 'ใบสั่งของวิสิทนี้ · VN ' + s.tsVnLabel : 'ใบสั่งของวิสิทนี้';
	s.tsLgSections = [{ key: 'visit', title: vnText, empty: '— ยังไม่มีใบสั่งตรวจในวิสิทนี้ —', list: s.tsLgVisit }];
	if (s.tsLgToday.length) s.tsLgSections.push({ key: 'today', title: 'ผลออกวันนี้ · จากใบสั่งครั้งก่อน', empty: '', list: s.tsLgToday });
	s.tsXgSections = [{ key: 'visit', title: vnText, empty: '— ยังไม่มีใบสั่ง X-ray ในวิสิทนี้ —', list: s.tsXgVisit }];
	if (s.tsXgToday.length) s.tsXgSections.push({ key: 'today', title: 'ผลออกวันนี้ · จากใบสั่งครั้งก่อน', empty: '', list: s.tsXgToday });

	s.tsTrends = (Array.isArray(src.lab_trends) ? src.lab_trends : []).map(tsMkTrend).filter(Boolean);
	if (!s.tsTrends.length) s.tsLgUi.mode = 'order'; // ไม่มีแนวโน้ม = ไม่มีปุ่มสลับ ต้องไม่ค้างอยู่โหมดที่ว่าง

	// ก้อนที่มีค่าวิกฤติกางไว้ให้เลย — สิ่งที่หมอต้องเห็นก่อน ไม่ควรต้องกดหา
	const nextOpen = {};
	groups.forEach((g) => {
		if (g.criticals.length) nextOpen[g.key] = true;
	});
	s.tsOgOpen = nextOpen;
};

/* ══ interactions ═════════════════════════════════════════════════════════ */
// 🔴 เขียน object ใหม่ทั้งก้อน ไม่แก้ key เดิมในที่ — ให้ Vue เห็นการเปลี่ยนแน่นอน (pattern เดียวกับ item_card)
s.tsOgToggle = (key) => {
	const next = {};
	Object.keys(s.tsOgOpen).forEach((k) => {
		next[k] = s.tsOgOpen[k];
	});
	next[key] = !next[key];
	s.tsOgOpen = next;
};
s.tsLgSetMode = (m) => {
	s.tsLgUi.mode = m;
};
// พับรายงานความเรียงของ Lab ไว้ 4 บรรทัด — ใบ MB ใบเดียวยาวเป็นร้อยบรรทัด
s.tsTxtClamp = (key) => {
	const base = { marginTop: '3px', fontSize: '11px', lineHeight: '1.5', color: 'var(--el-text-color-regular)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'ui-monospace, Menlo, Consolas, monospace' };
	if (s.tsOgOpen['r|' + key]) return Object.assign({}, base, { maxHeight: '260px', overflow: 'auto' });
	return Object.assign({}, base, { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' });
};

// อ่านรายงาน X-ray เต็ม — พับ 3 บรรทัดไว้ก่อน เพราะรายงานยาวกลบก้อนอื่นทั้งการ์ด
s.tsXrClamp = (key) =>
	s.tsOgOpen['x|' + key]
		? { marginTop: '5px', fontSize: '12px', lineHeight: '1.5', color: 'var(--el-text-color-regular)', overflowWrap: 'anywhere' }
		: {
				marginTop: '5px',
				fontSize: '12px',
				lineHeight: '1.5',
				color: 'var(--el-text-color-regular)',
				overflowWrap: 'anywhere',
				display: '-webkit-box',
				WebkitLineClamp: 3,
				WebkitBoxOrient: 'vertical',
				overflow: 'hidden',
		  };

// เปิดผลทั้งใบใน popup อ่านอย่างเดียวแบบเดียวกับ LAB Worklist
// 🔴 ห้าม fallback ไปเปิด Result Item ตัวแรก — นั่นคือหน้ากรอก/แก้ไขผลของห้อง LAB ไม่ใช่หน้าดูผลของ EMR
s.tsOrderTarget = (o) => !!(o && Array.isArray(o.rows) && o.rows.length);
s.tsOpenOrder = (o) => {
	if (!s.tsOrderTarget(o)) return;
	const opened = {};
	(Array.isArray(o.result_groups) ? o.result_groups : []).forEach((group, index) => {
		if (Array.isArray(group.results) && group.results.length > 1) opened[s.tsResultGroupKey(group, index)] = true;
	});
	s.tsResultGroupOpen = opened;
	s.tsLabDialog = { visible: true, order: o };
};
s.tsCloseLabDialog = () => {
	s.tsLabDialog = { visible: false, order: null };
	s.tsResultGroupOpen = {};
};
s.tsResultGroups = () => {
	const order = s.tsLabDialog.order;
	return order && Array.isArray(order.result_groups) ? order.result_groups : [];
};
s.tsResultGroupKey = (group, index) => String((group && group.group_key) || 'group|' + index);
s.tsResultGroupIsProfile = (group) => !!(group && Array.isArray(group.results) && group.results.length > 1);
s.tsResultGroupExpanded = (group, index) => !s.tsResultGroupIsProfile(group) || !!s.tsResultGroupOpen[s.tsResultGroupKey(group, index)];
s.tsToggleResultGroup = (group, index) => {
	const key = s.tsResultGroupKey(group, index);
	s.tsResultGroupOpen = Object.assign({}, s.tsResultGroupOpen, { [key]: !s.tsResultGroupOpen[key] });
};
s.tsExpandAllResultGroups = () => {
	const next = {};
	s.tsResultGroups().forEach((group, index) => {
		if (s.tsResultGroupIsProfile(group)) next[s.tsResultGroupKey(group, index)] = true;
	});
	s.tsResultGroupOpen = next;
};
s.tsCollapseAllResultGroups = () => {
	s.tsResultGroupOpen = {};
};
s.tsResultProfileCount = () => s.tsResultGroups().filter(s.tsResultGroupIsProfile).length;
s.tsResultTestCount = () => s.tsResultGroups().length;
s.tsResultRowsCount = () => {
	const order = s.tsLabDialog.order;
	return order && Array.isArray(order.rows) ? order.rows.length : 0;
};
s.tsResultCriticalCount = () => {
	const order = s.tsLabDialog.order;
	return order && Array.isArray(order.criticals) ? order.criticals.length : 0;
};
s.tsResultAbnormalCount = () => {
	const order = s.tsLabDialog.order;
	return order && Array.isArray(order.abnormals) ? order.abnormals.filter((row) => row.flag !== 'C').length : 0;
};
s.tsResultRowNumber = (group, groupIndex, rowIndex) =>
	s.tsResultGroupIsProfile(group) ? groupIndex + 1 + '.' + (rowIndex + 1) : String(groupIndex + 1);
s.tsHasResultValue = (row) => !!(row && row.value != null && row.value !== '' && row.value !== '—');
s.tsResultSignalClass = (row) => (row && row.flag === 'C' ? 'is-critical' : row && tsIsAbn(row) ? 'is-abnormal' : 'is-normal');
s.tsResultSignalText = (row) => (row && row.flag === 'C' ? 'ค่าวิกฤติ' : row && tsIsAbn(row) ? 'ค่าผิดปกติ' : 'ค่าปกติ');
s.tsResultMeasuredClass = (row) => s.tsResultSignalClass(row);
s.tsResultInterpretationClass = (row) => s.tsResultSignalClass(row);
s.tsResultSignalStyle = (row) => {
	const type = s.tsResultSignalClass(row);
	const color = type === 'is-critical' ? '#b84d4d' : type === 'is-abnormal' ? '#e6a23c' : '#2f761e';
	const ring = type === 'is-critical' ? 'rgba(245,108,108,.12)' : type === 'is-abnormal' ? 'rgba(230,162,60,.11)' : 'rgba(103,194,58,.10)';
	return { display: 'block', width: '10px', height: '10px', margin: 'auto', border: '1px solid ' + color, borderRadius: '50%', background: color, boxShadow: '0 0 0 3px ' + ring };
};
s.tsResultMeasuredStyle = (row) => ({ color: row && row.flag === 'C' ? '#c45656' : row && tsIsAbn(row) ? '#b88230' : 'var(--el-text-color-primary)', fontSize: '15px', fontWeight: 800, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' });
s.tsResultInterpretationStyle = (row) => {
	const type = s.tsResultSignalClass(row);
	const palette = type === 'is-critical' ? ['#fab6b6', '#fef0f0', '#c45656'] : type === 'is-abnormal' ? ['#f3d19e', '#fdf6ec', '#b88230'] : ['#b3e19d', '#f0f9eb', '#529b2e'];
	return { display: 'inline-flex', minHeight: '23px', alignItems: 'center', padding: '2px 8px', border: '1px solid ' + palette[0], borderRadius: '999px', background: palette[1], color: palette[2], fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' };
};
s.tsResultSourceText = (source) => {
	const value = String(source || '').trim().toLowerCase();
	if (!value) return '';
	if (value === 'agent' || value === 'lis' || value === 'lisconnect' || value === 'interface') return 'LIS';
	if (value === 'manual' || value === 'his') return 'Manual';
	return source;
};
s.tsResultStatusValue = () => {
	const order = s.tsLabDialog.order;
	const statuses = order && Array.isArray(order.rows) ? order.rows.map((row) => String(row.status || '').toLowerCase()).filter(Boolean) : [];
	if ((statuses.length && statuses.every((value) => value === 'final' || value === 'completed')) || (order && order.status === 'completed')) return 'final';
	if (statuses.some((value) => value === 'partial') || (order && order.status === 'resulted')) return 'partial';
	return 'pending';
};
s.tsResultStatusText = () => (s.tsResultStatusValue() === 'final' ? 'Final' : s.tsResultStatusValue() === 'partial' ? 'Partial' : 'รอผล');
s.tsCompactDateTime = (value) => {
	const text = String(value || '');
	if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return text;
	const date = text.slice(8, 10) + '/' + text.slice(5, 7) + '/' + String(Number(text.slice(0, 4)) + 543).slice(2);
	const time = text.length >= 19 ? text.slice(11, 19) : text.length >= 16 ? text.slice(11, 16) : '';
	return date + (time ? ' ' + time : '');
};
s.tsLabFlagType = (flag) => (flag === 'C' ? 'danger' : flag === 'H' || flag === 'L' || flag === 'A' ? 'warning' : 'success');
s.tsLabFlagLabel = (flag) => (flag === 'C' ? 'C' : flag === 'H' ? 'H' : flag === 'L' ? 'L' : flag === 'A' ? 'A' : '-');
s.tsLabFileName = (file) => String((file && (file.name || (file.response && file.response.fileName))) || 'ไฟล์แนบผลตรวจ');
s.tsLabFileUrl = (file) => String((file && (file.url || (file.response && file.response.filePath))) || '');
s.tsLabFileSize = (file) => {
	const n = Number(file && file.size);
	if (!n) return '';
	return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.ceil(n / 1024) + ' KB';
};
s.tsOpenXr = (x) => {
	if (x.data_id) s.tsOpen(x.form_id || s.tsXrayFormId, x.data_id);
};

/* ══ ล้าง state ใหม่ตอนเปลี่ยนคนไข้ ═══════════════════════════════════════
   ห่อ tsLoad เดิมไว้ ตัวเดิมยังถูกเรียกครบทุกครั้ง — ที่เพิ่มคือล้างของใหม่ก่อนโหลดรอบใหม่
   (ถ้า process error ข้อมูลกลุ่มของคนไข้คนก่อนต้องไม่ค้างอยู่บนจอ) */
const tsLoadBase = s.tsLoad;
s.tsLoad = (personId, hn, curVisitId) => {
	s.tsLgOn = false;
	s.tsXgOn = false;
	s.tsLgVisit = [];
	s.tsLgToday = [];
	s.tsXgVisit = [];
	s.tsXgToday = [];
	s.tsLgSections = [];
	s.tsXgSections = [];
	s.tsTrends = [];
	s.tsOgOpen = {};
	s.tsResultGroupOpen = {};
	s.tsVnLabel = '';
	s.tsLabDialog = { visible: false, order: null };
	return tsLoadBase(personId, hn, curVisitId);
};
