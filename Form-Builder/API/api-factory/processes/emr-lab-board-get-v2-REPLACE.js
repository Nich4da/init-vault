/**
 * emr-lab-board-get — ใบสั่งตรวจของวิสิทที่เปิดอยู่ + ผลที่ออกวันนี้
 * ------------------------------------------------------------------
 * แยกออกจาก `emr-summary-get` (6a9574cc1812c7078a067299) โดยตั้งใจ:
 * ตัวนั้นเล่า "การรักษาครั้งก่อน" จาก snapshot ส่วนตัวนี้เล่า "วิสิทนี้สั่งอะไร ผลออกหรือยัง"
 * คนละเรื่อง คนละแหล่งข้อมูล ⇒ แยก process ให้พังแยกกันและแก้แยกกันได้
 *
 * params : { visit_id, hn?, person_id? }     visit_id = visit `_id` ของวิสิทที่เปิดอยู่
 *          { action:'open_sensitive', visit_id, source_order_id, item_id,
 *            username, password, purpose, request_id }
 * return : { success, current_vn, service_date, ordered_today[], resulted_today[],
 *            lab_orders[], xray_results[], lab_trends[] }
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
 *    และ "วันนี้" = `visit_date` ของวิสิทที่ HIS เปิดอยู่ ไม่ใช่ timer/วันจาก browser
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
const refText = (v) => {
	if (v == null || v === '') return '';
	if (typeof v !== 'object') return String(v);
	if (v.value != null && v.value !== '') return String(v.value);
	if (v.xtbxlv2_xfx_id != null && v.xtbxlv2_xfx_id !== '') return String(v.xtbxlv2_xfx_id);
	return String(v); // Mongo ObjectId
};

const curVisitId = params.visit_id ? String(params.visit_id) : null;
let hn = params.hn ? String(params.hn) : null;

const WORK_ITEM_TABLE = 'zdata_lab_work_item';
const CPOE_ITEM_TABLE = 'zdata_cpoe_order_item';
const CPOE_ORDER_TABLE = 'zdata_cpoe_order';
const ITEM_MASTER_TABLE = 'zdata_master_item_order';
const RESULT_REPORT_TABLE = 'zdata_lab_report_manual_entry';
const RESULT_REVISION_TABLE = 'zdata_lab_result_revision_log';
const CORE_USER_TABLE = 'core_user';
const SENSITIVE_ACCESS_LOG_TABLE = 'zdata_emr_sensitive_access_log';
const SENSITIVE_ACCESS_GRANT_TABLE = 'zdata_emr_sensitive_access_grant';
const XRAY_ORDER_TABLE = 'zdata_xray_order';
const XRAY_RESULT_FORM = '6a860980f851000f28e44ab0';

const MAX_CPOE_ITEM = 200;
const MAX_RESULT_ROW = 300;
const MAX_XRAY_ROW = 60;
const TREND_POINTS = 5; // จุดสูงสุดต่อ 1 ค่าตรวจในมุมมอง "ตามค่าตรวจ"
// Popup ผล LAB ใน EMR เลือกดูย้อนหลังได้ 1/5/10 ครั้ง. ค่าเริ่มต้น 5
// เพื่อคง contract เดิมของผู้เรียกที่ยังไม่ได้ส่ง history_limit.
const requestedHistoryLimit = Number(params.history_limit);
const historyLimit = [1, 5, 10].indexOf(requestedHistoryLimit) >= 0 ? requestedHistoryLimit : 5;
// 2026-09-25 confirmed policy: only a DOCTOR credential may authorize
// disclosure outside Immunology. The signed-in viewer and authorizing doctor
// may be different people (for example a LAB user asking a doctor to confirm).
const SENSITIVE_OPEN_ROLES = ['DOCTOR'];
const SENSITIVE_GRANT_TTL_MS = 5 * 60 * 1000;

// Keep this allowlist equivalent to LAB Worklist/HL7 Result Upsert.  A received
// batch can store every OBX row under the first Work Item, so EMR must resolve
// each result code back to the CPOE Item that clinically owns it before applying
// item-level visibility or building the LAB-style Profile groups.
const RESULT_COMPONENT_CODES_BY_GROUP = {
	'1001CD': ['100101CD', '10010201CD', '100102CD', '10010401CD', '10010402CD', '100104CD', '100105CD', '100106CD', '100107CD'],
	'1004CD': ['100804CD', '100805CD', '100806CD', '100807CD'],
	'100701BL': ['100702IC', '102390', '102501IC', '102502IC', '102503IC', '102504IC', '103601BL', '103602BL', '103603BL', '103604BL', '103605BL', '103606BL', '103607BL', '103609BL', '103610BL', '103611BL', '103612BL', '103613BL', '103614BL', '103615BL', '103616BL', '103618BL', '103620BL', '103621BL', '103622BL', '103627BL'],
	'100802CD': ['100802CD', '101120CD'],
	'10090123UR': ['100901UR', '100902UR', '100903UR'],
	'1015UH': ['1015UH'],
	'1025CD': ['101201', '102501CD', '102502CD', '102503CD', '102504CD'],
	'10C86SETCD': ['1085CD', '1086CD'],
	'2001EB': ['200101EB', '200102EB', '200103EB', '200105EB', '200106EB', '200107EB', '200108EB', '200109EB', '200111EB', '200112EB', '200113EB', '200114EB', '200115EB', '200116EB', '200117EB', '200119EB', '200120EB', '200121EB', '200122EB', '200138EB', '200151EB', '200153EB', '200154EB', '200260', '200270', '200280', '200290', '200300'],
	'2006BF': ['200600BF', '200601BF', '200603BF', '200613BF', '200614BF', '200615BF', '200616BF'],
	'2101EB': ['210101EB', '210102EB', '210103EB', '210105EB', '210106EB', '210107EB', '210108EB', '210109EB', '210111EB', '210112EB', '210113EB', '210114EB', '210115EB', '210116EB', '210117EB', '210119EB', '210120EB', '210121EB', '210122EB', '210138EB', '210151EB', '210153EB', '210154EB', '210270', '210280', '210290', '210300', '210310'],
	'2106UR': ['210601UR', '210602UR', '210603UR', '210604UR', '210605UR', '210606UR', '210607UR', '210608UR', '210609UR', '210610UR', '210611UR', '210612UR', '210614UR', '210615UR', '210617UR', '210618UR', '210619UR', '210620UR', '210621UR', '210622UR'],
	'2110ST': ['211001ST', '211002ST', '211003ST', '211004ST', '211006ST', '211007ST', '211008ST', '211009ST'],
	'2113ST': ['211301ST', '211302ST', '211303UR', '211304ST', '211305ST', '211306', '2113ST'],
	'2201EB': ['220101EB', '220102EB', '220103EB', '220104EB', '220105EB'],
	'2208SO': ['220801SO', '220802SO'],
	'2235SO': ['220901SO', '2209SO'],
	'2296NP': ['229601NP', '229602NP', '229603NP'],
	'3003BL': ['300301BL', '300302BL'],
	'3013ST': ['301301ST', '301302ST'],
	'3018BF': ['301802FL'],
	'3018CS': ['301801CS', '301802CS', '301803CS', '301804CS', '301805CS', '301806CS'],
	'3029ST': ['302901ST', '302902ST', '3029ST', '30IM29ST'],
	'3030CD': ['302210', '303001CD', '303002CD', '303003CD', '303004CD', '303005CD', '303006CD', '303007CD', '303008CD', '303009CD', '303010CD', '303011CD'],
	'3057BL': ['305701BL', '305702BL', '305703BL', '305704BL'],
	'3064BL': ['306401BL', '306402BL'],
	'3079BL': ['302000', '307901BL', '307902BL', '307903BL', '307904BL', '307905BL', '307906BL', '307907BL', '307908BL', '307909BL', '307910BL', '307911BL', '307912BL'],
	'3096NP': ['309601NP', '309602NP', '309603NP'],
	'30IM136CD': ['301550', '301560', '30IM136CD'],
	'30IM26NS': ['301451'],
};

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
const jsonArray = (value) => {
	if (Array.isArray(value)) return value;
	if (typeof value !== 'string') return [];
	try {
		const parsed = JSON.parse(value || '[]');
		return Array.isArray(parsed) ? parsed : [];
	} catch (error) {
		return [];
	}
};
const jsonObject = (value) => {
	if (value && typeof value === 'object' && !Array.isArray(value)) return value;
	if (typeof value !== 'string') return {};
	try {
		const parsed = JSON.parse(value || '{}');
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
	} catch (error) {
		return {};
	}
};
// Specimen metadata must come from structured CPOE/Work Item fields only.
// MLab result_value is a narrative report and must never be parsed to derive it.
const specimenMeta = (item, workItem) => {
	const labData = item && item.lab_data && typeof item.lab_data === 'object' ? item.lab_data : {};
	const rows = Array.isArray(labData.specimens) && labData.specimens.length ? labData.specimens : [labData];
	const snapshot = jsonObject(workItem && workItem.specimen_json);
	const names = [];
	const collectedAts = [];
	rows.concat([snapshot]).forEach((row) => {
		if (!row || typeof row !== 'object') return;
		const name = String(row.spec_source || row.source || row.specimen_name || row.name || row.specimen_code || row.code || '').trim();
		const collectedAt = String(row.specimen_at || row.at || row.collected_at || '').trim();
		if (name && names.indexOf(name) < 0) names.push(name);
		if (collectedAt && collectedAts.indexOf(collectedAt) < 0) collectedAts.push(collectedAt);
	});
	return { specimen_names: names, specimen_name: names.join(' / '), collected_ats: collectedAts, collected_at: collectedAts[0] || '' };
};
const resultComponentCodesForOrderCode = (orderCode) => {
	const code = String(orderCode || '').trim();
	if (!code) return [];
	return uniq([code].concat(RESULT_COMPONENT_CODES_BY_GROUP[code] || []));
};

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

const RESULT_FIELDS = {
	obs_name: 1, obs_code: 1, test_name: 1, test_code: 1, panel_code: 1, panel_name: 1, group_role: 1, organism: 1,
	result_value: 1, unit_symbol_snapshot: 1, units: 1,
	reference_range_snapshot: 1, ref_range: 1, interpretation_code: 1, is_critical: 1, result_status: 1,
	result_sequence: 1, result_definition_id: 1, result_comment: 1, result_source: 1, result_version: 1, result_uid: 1, obx_status: 1,
	change_kind: 1, receipt_seq: 1, previous_value: 1, critical_low_rule: 1, critical_high_rule: 1,
	entered_at: 1, entered_by: 1, last_edited_at: 1, last_edited_by: 1,
	// 🌸 เพิ่มเฉพาะ MY: freestyle identity. Other sections keep the existing mapper and
	// response shape; these fields are exposed only when `myPathologyMeta` matches.
	pathology_row_key: 1, pathology_sub_index: 1, source_item_id: 1, specimen_index: 1,
	specimen_code_snapshot: 1, specimen_name_snapshot: 1,
	ordered_site_code_snapshot: 1, ordered_site_name_snapshot: 1,
	actual_site_code: 1, actual_site_name: 1, actual_site_detail: 1,
	order_no: 1, filler_order_no: 1, lab_section: 1, visit_id: 1, hn: 1, created_at: 1, updated_at: 1, xupdatx: 1,
	result_report_id: 1, xparentx: 1, reported_at: 1, reported_by_source_id: 1, reported_by_source_name: 1,
	verified_at: 1, verified_by_source_id: 1, verified_by_source_name: 1,
};
const REPORT_FIELDS = {
	order_no: 1, filler_order_no: 1, report_key: 1, result_uid: 1, result_attachments: 1, order_note: 1,
	report_seq: 1, stage: 1, agent_overall_status: 1, internal_overall_status: 1,
	receipt_status: 1, source_channel: 1, schema_version: 1, record_kind: 1,
	received_at: 1, processed_at: 1, confirmed_at: 1, confirmed_by: 1,
	reported_at: 1, reported_by_source_id: 1, reported_by_source_name: 1,
	verified_at: 1, verified_by_source_id: 1, verified_by_source_name: 1,
	item_count: 1, critical_count: 1, matched_item_count: 1, unmatched_item_count: 1,
	created_at: 1, updated_at: 1, xupdatx: 1,
};
const REVISION_FIELDS = {
	revision_id: 1, previous_revision_id: 1, result_uid: 1, report_id: 1, order_no: 1,
	report_seq: 1, receipt_seq: 1, stage: 1, source_reported_at: 1, received_at: 1,
	item_count: 1, changed_item_count: 1, ingest_status: 1, schema_version: 1,
	created_at: 1, updated_at: 1, xupdatx: 1,
};

// Visibility มี 2 policy คนละความหมาย:
// - Item Master `is_hide_result` = Sensitive ต้องยืนยันตัวตนตาม flow เดิม
// - CPOE Item `is_hide_result` + audited visibility action = LAB พัก/ปกปิดผล
//   ระหว่างตรวจสอบแก้ไข ซึ่ง EMR ต้องไม่เปิดเผยค่าและแพทย์ override ไม่ได้
const loadResultPolicies = async (itemIds) => {
	const ids = uniq(itemIds.map((id) => String(id || '')));
	if (!ids.length) return {};
	const items = await findAll(
		CPOE_ITEM_TABLE,
		{ _id: idsIn(ids), xrstatx: 1 },
		{
			limit: ids.length,
			projection: {
				item_data_id: 1, item_code: 1, item_name: 1, comment: 1, order_id: 1, service_type: 1,
				is_hide_result: 1, result_visibility_action: 1, result_visibility_reason: 1,
				result_visibility_by: 1, result_visibility_at: 1,
			},
		},
	);
	const itemById = {};
	items.forEach((item) => {
		itemById[String(item._id || '')] = item;
	});

	const masterIds = uniq(items.map((item) => refText(item.item_data_id)));
	const fallbackCodes = uniq(items.filter((item) => !refText(item.item_data_id)).map((item) => refText(item.item_code)));
	const mastersById = masterIds.length
		? await findAll(
				ITEM_MASTER_TABLE,
				{ _id: idsIn(masterIds), xrstatx: 1 },
				{ limit: masterIds.length, projection: { item_code: 1, item_name: 1, is_hide_result: 1, lab_parent: 1, lab_item: 1, xupdatx: 1, updated_at: 1 } },
		  )
		: [];
	const mastersByCode = fallbackCodes.length
		? await findAll(
				ITEM_MASTER_TABLE,
				{ item_code: { $in: fallbackCodes }, xrstatx: 1 },
				{ limit: fallbackCodes.length, projection: { item_code: 1, item_name: 1, is_hide_result: 1, lab_parent: 1, lab_item: 1, xupdatx: 1, updated_at: 1 } },
		  )
		: [];
	const masterIdMap = {};
	const masterCodeMap = {};
	mastersById.concat(mastersByCode).forEach((master) => {
		masterIdMap[String(master._id || '')] = master;
		const code = refText(master.item_code);
		if (code && !masterCodeMap[code]) masterCodeMap[code] = master;
	});
	const parentCodes = uniq(mastersById.concat(mastersByCode).map((master) => refText(master && master.lab_parent)));
	const parentMasters = parentCodes.length
		? await findAll(
				ITEM_MASTER_TABLE,
				{ item_code: { $in: parentCodes }, xrstatx: 1 },
				{ limit: parentCodes.length, projection: { item_code: 1, item_name: 1 } },
		  )
		: [];
	const parentMasterByCode = {};
	parentMasters.forEach((master) => {
		const code = refText(master.item_code);
		if (code && !parentMasterByCode[code]) parentMasterByCode[code] = master;
	});

	const policies = {};
	ids.forEach((itemId) => {
		const item = itemById[itemId] || null;
		const masterId = item ? refText(item.item_data_id) : '';
		const itemCode = item ? refText(item.item_code) : '';
		const sourceOrderId = item ? refText(item.order_id) : '';
		const sourceVisitId = item && item.order_id ? refText(item.order_id.xtbxlv2_xfx_id) : '';
		const master = masterId ? masterIdMap[masterId] || null : masterCodeMap[itemCode] || null;
		const visibilityAction = String((item && item.result_visibility_action) || '').trim().toLowerCase();
		const manualHidden = !!(item && item.is_hide_result === true && visibilityAction === 'hide');
		if (!item || !master) {
			policies[itemId] = {
				state: manualHidden ? 'hidden' : 'withheld',
				reason: manualHidden ? 'manual_result_hidden' : 'policy_unresolved',
				sensitive: false,
				manual_hidden: manualHidden,
				item_id: itemId,
				item_code: itemCode,
				item_name: (item && item.item_name) || '',
				item_comment: String((item && item.comment) || ''),
				source_order_id: sourceOrderId,
				visit_id: sourceVisitId,
				master_id: masterId,
				master_updated_at: '',
			};
			return;
		}
		const sensitive = master.is_hide_result === true;
		const resultCode = refText(master.lab_item && (master.lab_item.his_lab_code || master.lab_item.value));
		const parentCode = refText(master.lab_parent);
		const parentMaster = parentCode ? parentMasterByCode[parentCode] || null : null;
		policies[itemId] = {
			state: manualHidden ? 'hidden' : sensitive ? 'reauth_required' : 'visible',
			reason: manualHidden ? 'manual_result_hidden' : sensitive ? 'sensitive_master' : '',
			sensitive,
			manual_hidden: manualHidden,
			item_id: itemId,
			item_code: refText(master.item_code) || itemCode,
			item_name: item.item_name || master.item_name || '',
			item_comment: String(item.comment || ''),
			result_code: resultCode,
			result_codes: resultComponentCodesForOrderCode(resultCode),
			group_id: parentCode ? 'panel:' + parentCode : itemId,
			group_name: parentCode ? String((parentMaster && parentMaster.item_name) || labelOf(master.lab_parent) || item.item_name || master.item_name || '') : String(item.item_name || master.item_name || ''),
			source_order_id: sourceOrderId,
			visit_id: sourceVisitId,
			master_id: String(master._id || ''),
			master_updated_at: String(master.updated_at || master.xupdatx || ''),
		};
	});
	return policies;
};

let currentVn = '';
let currentDay = '';
let currentVisit = null;
let currentPatientName = '';
let labOrders = [];
let orderedToday = [];
let resultedToday = [];
let xrayResults = [];
let labTrends = [];
let summaryLab = [];


if (curVisitId) {
	const curRows = await findAll(VISIT_TABLE, { _id: idOne(curVisitId), xrstatx: 1 }, { limit: 1, projection: { vn: 1, visit_date: 1, 'pid.hn': 1, 'pid.value': 1, 'pid.prename': 1, 'pid.p_fname': 1, 'pid.p_lname': 1 } });
	const cur = curRows[0] || null;
	if (cur) {
		currentVisit = cur;
		currentVn = String(cur.vn || '');
		currentDay = dayOf(cur.visit_date);
		// patient scope ต้อง derive จาก visit ที่ server เท่านั้น — ไม่เชื่อ hn จาก client
		hn = (cur.pid && cur.pid.hn) || null;
		currentPatientName = [labelOf(cur.pid && cur.pid.prename), cur.pid && cur.pid.p_fname, cur.pid && cur.pid.p_lname]
			.map((part) => String(part || '').trim()).filter(Boolean).join(' ');
	}
}

/* ── ตัวช่วยประกอบ 1 ก้อนผล (1 ใบสั่ง × 1 section) ──────────────────────── */
// 🔴 ของจริงจาก MB/MLab: `result_value` เป็น **รายงานความเรียงทั้งใบ** (ยาว 1,500+ ตัวอักษร
//    มี \r\n เป็นตาราง S/I/R) ไม่ใช่ค่าเดี่ยว และ `is_critical` เป็น false แม้ขึ้นเชื้อดื้อยา
//    ⇒ ต้องติดธง `text` ให้จอรู้ว่าต้องแสดงเป็นบล็อกรายงาน ไม่ใช่ตัวเลขท้ายบรรทัด
//    และจอต้องไม่พับมันไปอยู่ใต้ "ค่าปกติ" เพราะ LIS ไม่ได้บอกว่าปกติ แค่ไม่ได้ตีธง
const NARRATIVE_MIN = 60; // ยาวเกินนี้หรือมีขึ้นบรรทัดใหม่ = รายงาน ไม่ใช่ค่าเดี่ยว
const CODE_ONLY = /^[0-9]+$/; // obs_name ของ MB เป็นรหัสล้วน ("4001") อ่านไม่รู้เรื่อง

const historyMatchText = (value) => String(value == null ? '' : value).trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const historyTestCode = (r) => String((r && (r.obs_code || r.test_code)) || '').trim().toUpperCase();
const historyTestName = (r) => {
	const obs = String((r && r.obs_name) || '').trim();
	const test = String((r && r.test_name) || '').trim();
	// MB/MLab may store a numeric obs_name. In that case the authoritative
	// CPOE Item name resolved into __item is the readable Test name.
	return historyMatchText((!CODE_ONLY.test(obs) && obs) || (!CODE_ONLY.test(test) && test) || (r && r.__item) || obs || test);
};
const historyTestKey = (r) => {
	const code = historyTestCode(r);
	const name = historyTestName(r);
	// Fail closed: history is comparable only when both Test code and Test name
	// are present and equal. Name-only/code-only fallback can mix clinical tests.
	return code && name ? code + '|' + name : '';
};
const myPathologyMeta = (r) => {
	if (String((r && r.lab_section) || '').trim().toUpperCase() !== 'MY') return null;
	const pathologyRowKey = String((r && r.pathology_row_key) || '').trim();
	const actualSiteName = String((r && r.actual_site_name) || '').trim();
	const orderedSiteName = String((r && r.ordered_site_name_snapshot) || '').trim();
	const specimenName = String((r && r.specimen_name_snapshot) || '').trim();
	if (!pathologyRowKey && !actualSiteName && !orderedSiteName && !specimenName) return null;
	const actualSiteDetail = String((r && r.actual_site_detail) || '').trim();
	const siteName = actualSiteName || orderedSiteName;
	const siteDisplay = siteName && actualSiteDetail ? siteName + ' (' + actualSiteDetail + ')' : siteName || actualSiteDetail;
	return {
		pathology_row_key: pathologyRowKey,
		pathology_sub_index: Number.isInteger(Number(r && r.pathology_sub_index)) ? Number(r.pathology_sub_index) : null,
		specimen_index: Number.isInteger(Number(r && r.specimen_index)) ? Number(r.specimen_index) : null,
		specimen_code: String((r && r.specimen_code_snapshot) || '').trim(),
		specimen_name: specimenName,
		ordered_site_code: String((r && r.ordered_site_code_snapshot) || '').trim(),
		ordered_site_name: orderedSiteName,
		actual_site_code: String((r && r.actual_site_code) || '').trim(),
		actual_site_name: actualSiteName,
		actual_site_detail: actualSiteDetail,
		display_name: [siteDisplay || 'ไม่ระบุตำแหน่ง', specimenName ? 'Specimen ' + specimenName : ''].filter(Boolean).join(' · '),
	};
};
// 🌸 เพิ่มเฉพาะ MY: a previous value is clinically comparable only when test, specimen and
// actual site match. Falling back to M14/Wood light alone repeats one unrelated
// historical value across every freestyle location.
const myPathologyPreviousKey = (r) => {
	const meta = myPathologyMeta(r);
	if (!meta) return '';
	const testCode = String((r && (r.obs_code || r.test_code)) || '').trim().toUpperCase();
	const specimen = String(meta.specimen_code || meta.specimen_name || '').trim().toLocaleLowerCase();
	const site = String(meta.actual_site_code || meta.actual_site_name || meta.ordered_site_code || meta.ordered_site_name || '').trim().toLocaleLowerCase();
	const siteDetail = String(meta.actual_site_detail || '').trim().toLocaleLowerCase();
	return testCode && specimen && site ? [testCode, specimen, site, siteDetail].join('|') : '';
};
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
				lab_no: String(r.filler_order_no || ''),
				status: String(r.result_status || r.obx_status || ''),
				obx_status: String(r.obx_status || ''),
				result_version: String(r.result_version || ''),
				change_kind: String(r.change_kind || ''),
				result_uid: String(r.result_uid || ''),
				is_critical: criticalDecision(r.is_critical),
				critical_state: criticalState(r.is_critical),
				entered_at: resultTime(r),
		  }
		: null;

const resultPolicy = (r) =>
	(r && r.__policy) || {
		state: 'withheld',
		reason: 'policy_unresolved',
		sensitive: false,
		manual_hidden: false,
		item_id: String((r && r.order_no) || ''),
		item_code: '',
		item_name: String((r && r.__item) || ''),
		source_order_id: '',
		visit_id: '',
		master_id: '',
		master_updated_at: '',
	};
const isResultVisible = (r) => resultPolicy(r).state === 'visible';
const publicPolicy = (policy) => ({
	state: policy.state,
	reason: policy.reason || '',
	sensitive: policy.sensitive === true,
	manual_hidden: policy.manual_hidden === true,
	item_id: policy.item_id || '',
	item_code: policy.item_code || '',
	source_order_id: policy.source_order_id || '',
	visit_id: policy.visit_id || '',
	master_id: policy.master_id || '',
	master_updated_at: policy.master_updated_at || '',
});
const criticalDecision = (value) => (value === true ? true : value === false ? false : null);
const criticalState = (value) => (value === true ? 'critical' : value === false ? 'not_critical' : 'unknown');

const mapResultRow = (r) => {
	const raw = r.result_value == null ? '' : String(r.result_value);
	const obs = String(r.obs_name || '').trim();
	const tst = String(r.test_name || '').trim();
	const policy = resultPolicy(r);
	const pathology = myPathologyMeta(r);
	const clinicalName = (!CODE_ONLY.test(obs) && obs) || (!CODE_ONLY.test(tst) && tst) || String(r.__item || '') || obs || tst || '';
	return {
		// ชื่อที่หมออ่านรู้เรื่อง — รหัสล้วนตกไปใช้ชื่อรายการที่สั่งจาก CPOE Item แทน
		// 🌸 เพิ่มเฉพาะ MY: ใช้ตำแหน่ง+specimen เป็นชื่อแถวใต้ Profile ของรายการตรวจ
		// เพื่อให้ผล 1 test หลายตำแหน่งไม่กลายเป็น Wood light ซ้ำแบบแยกไม่ออก.
		name: pathology ? pathology.display_name : clinicalName,
		code: r.obs_code || r.test_code || '',
		obs_code: String(r.obs_code || ''),
		obs_name: obs,
		test_code: String(r.test_code || ''),
		test_name: tst || clinicalName,
		panel_code: String(r.panel_code || ''),
		panel_name: String(r.panel_name || ''),
		group_role: String(r.group_role || ''),
		organism: String(r.organism || ''),
		result_definition_id: String(r.result_definition_id || ''),
		result_sequence: r.result_sequence == null ? '' : String(r.result_sequence),
		value: raw,
		result_value: raw,
		text: raw.indexOf('\n') >= 0 || raw.length > NARRATIVE_MIN,
		unit: r.unit_symbol_snapshot || r.units || '',
		units: String(r.unit_symbol_snapshot || r.units || ''),
		ref: r.reference_range_snapshot || r.ref_range || '',
		reference_range: String(r.reference_range_snapshot || r.ref_range || ''),
		flag: r.interpretation_code || '',
		interpretation_code: String(r.interpretation_code || ''),
		// `critical` is retained for old consumers. New UI must use the tri-state
		// `is_critical`/`critical_state` contract and must not turn missing into false.
		critical: !!r.is_critical,
		is_critical: criticalDecision(r.is_critical),
		critical_state: criticalState(r.is_critical),
		result_item_id: String(r._id || ''),
		result_report_id: String(r.result_report_id || r.xparentx || ''),
		result_comment: String(r.result_comment || ''),
		// Result จาก batch เก่าอาจผูก `order_no` ไว้ที่ Work Item แรกทั้งชุด
		// จึงใช้ owner/group ที่ resolve จาก selected_items + Item Master ก่อนเสมอ
		group_id: String(policy.group_id || policy.item_id || r.__source_item_id || r.order_no || ''),
		group_name: String(policy.group_name || r.__item || policy.item_name || ''),
		ordered_item_id: String(policy.item_id || r.__source_item_id || r.order_no || ''),
		ordered_item_code: String(policy.item_code || ''),
		ordered_item_name: String(policy.item_name || r.__item || ''),
		ordered_item_comment: String(policy.item_comment || ''),
		result_source: String(r.result_source || ''),
		result_status: String(r.result_status || ''),
		obx_status: String(r.obx_status || ''),
		result_version: String(r.result_version || ''),
		change_kind: String(r.change_kind || ''),
		receipt_seq: String(r.receipt_seq || ''),
		result_uid: String(r.result_uid || ''),
		previous_value: r.previous_value == null ? '' : String(r.previous_value),
		critical_rule_snapshot: {
			low: String(r.critical_low_rule || ''),
			high: String(r.critical_high_rule || ''),
		},
		correction: {
			is_corrected:
				String(r.obx_status || '').toUpperCase() === 'C' ||
				String(r.result_status || '').toLowerCase() === 'corrected' ||
				String(r.change_kind || '').toLowerCase() === 'corrected' ||
				(Number(r.result_version) > 1),
			change_kind: String(r.change_kind || ''),
			result_version: String(r.result_version || ''),
			receipt_seq: String(r.receipt_seq || ''),
			previous_value: r.previous_value == null ? '' : String(r.previous_value),
			last_edited_at: String(r.last_edited_at || ''),
			last_edited_by: String(r.last_edited_by || ''),
		},
		entered_at: String(r.entered_at || ''),
		entered_by: String(r.entered_by || ''),
		last_edited_at: String(r.last_edited_at || ''),
		last_edited_by: String(r.last_edited_by || ''),
		reported_at: String(r.reported_at || r.entered_at || r.created_at || ''),
		reported_by_source_name: personName(r, 'reported'),
		verified_at: String(r.verified_at || ''),
		verified_by_source_name: personName(r, 'verified'),
		// `previous` remains for backward-compatible cards. The doctor's full
		// Result popup consumes `previous_values` newest -> oldest. The caller may
		// request 1/5/10 occurrences; callers that omit the option still receive 5.
		previous: previousData(r.__previous),
		previous_values: (Array.isArray(r.__previous_values) ? r.__previous_values : r.__previous ? [r.__previous] : [])
			.slice(0, historyLimit)
			.map(previousData)
			.filter(Boolean),
		visibility: publicPolicy(policy),
		...(pathology ? {
			my_pathology: true,
			test_name: clinicalName,
			pathology_row_key: pathology.pathology_row_key,
			pathology_sub_index: pathology.pathology_sub_index,
			specimen_index: pathology.specimen_index,
			specimen_code: pathology.specimen_code,
			specimen_name: pathology.specimen_name,
			ordered_site_code: pathology.ordered_site_code,
			ordered_site_name: pathology.ordered_site_name,
			actual_site_code: pathology.actual_site_code,
			actual_site_name: pathology.actual_site_name,
			actual_site_detail: pathology.actual_site_detail,
		} : {}),
	};
};

// ผลที่ยังเปิดไม่ได้ต้องเหลือเพียงหนึ่ง placeholder ต่อ CPOE Item
// จงใจไม่คืน result row id/count, value, comment, unit/ref, flag/critical หรือ previous.
// Result Report id คืนที่ระดับใบเพื่อให้เปิด PDF แบบ server-redacted ได้ แต่ไม่ผูกกับ placeholder รายการ.
const mapProtectedResult = (r) => {
	const policy = resultPolicy(r);
	const name = String(r.__item || policy.item_name || 'ผลตรวจ');
	return {
		name,
		code: policy.result_code || policy.item_code || '',
		group_id: policy.group_id || policy.item_id || String(r.order_no || ''),
		group_name: policy.group_name || name,
		result_status: String(r.result_status || ''),
		reported_at: String(r.reported_at || r.entered_at || r.created_at || ''),
		visibility: publicPolicy(policy),
	};
};

const actorRoles = uniq([].concat((userInfo && userInfo.roles) || []).map((role) => String(role || '')));
const actorUsername = String((userInfo && userInfo.username) || '').trim();
const roleCode = (role) => String((role && typeof role === 'object' ? role.code || role.value || role.name : role) || '').trim().toUpperCase();
const hasSensitiveRole = (roles) => [].concat(roles || []).some((role) => SENSITIVE_OPEN_ROLES.indexOf(roleCode(role)) >= 0);
const sensitiveGrantToken = () => [Date.now().toString(36)].concat(Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 12))).join('-');
const auditSensitiveAccess = async (outcome, reasonCode, context) => {
	const c = context || {};
	const policy = c.policy || {};
	const eventAt = app.curDate ? app.curDate('YYYY-MM-DD HH:mm:ss') : new Date().toISOString();
	const logData = {
		event_id: String(c.request_id || ''),
		request_id: String(c.request_id || ''),
		action: 'sensitive_result_open',
		outcome: String(outcome || ''),
		event_at: eventAt,
		reason_code: String(reasonCode || ''),
		user_id: String((userInfo && userInfo.account && userInfo.account.id) || c.user_id || ''),
		username: actorUsername,
		roles_snapshot: actorRoles,
		authorized_by_user_id: String(c.authorized_by_user_id || ''),
		authorized_by_username: String(c.authorized_by_username || ''),
		authorized_by_roles_snapshot: [].concat(c.authorized_by_roles || []).map(roleCode).filter(Boolean),
		site: (userInfo && userInfo.site) || null,
		unit: (userInfo && userInfo.unit) || null,
		patient_id: String((currentVisit && currentVisit.pid && currentVisit.pid.value) || ''),
		visit_id: String(c.visit_id || curVisitId || ''),
		source_order_id: String(c.source_order_id || policy.source_order_id || ''),
		item_id: String(c.item_id || policy.item_id || ''),
		item_code: String(policy.item_code || ''),
		revision_id: String(c.revision_id || ''),
		master_id: String(policy.master_id || ''),
		master_updated_at: String(policy.master_updated_at || ''),
		sensitive: policy.sensitive === true,
		purpose: String(c.purpose || ''),
		source: 'emr',
		screen: String(c.screen || 'emr_lab_result'),
		xrstatx: 1,
	};
	try {
		const saved = await app.dbInsert(logData, SENSITIVE_ACCESS_LOG_TABLE, userInfo);
		return !!(saved && saved.success);
	} catch (e) {
		return false;
	}
};

const openSensitiveResult = async () => {
	const action = String(params.action || 'open_sensitive');
	const reuseGrant = action === 'reuse_sensitive';
	const requestId = String(params.request_id || '').trim();
	const itemId = String(params.item_id || '').trim();
	const sourceOrderIdParam = String(params.source_order_id || '').trim();
	const sectionCodeParam = String(params.section_code || '').trim().toUpperCase();
	let submittedUsername = String(params.username || '').trim();
	const password = String(params.password || '');
	let purpose = String(params.purpose || '').trim();
	const suppliedGrantToken = String(params.sensitive_grant_token || '').trim();
	const screen = String(params.screen || 'emr_lab_result');
	const auditContext = { request_id: requestId, visit_id: curVisitId || '', source_order_id: sourceOrderIdParam, item_id: itemId, purpose, screen };
	const deny = async (code, outcome, reason, message, extra) => {
		const ok = await auditSensitiveAccess(outcome, reason, Object.assign({}, auditContext, extra || {}));
		return ok
			? { success: false, code, message }
			: { success: false, code: 'audit_failed', message: 'ไม่สามารถบันทึก Access Log ได้ จึงไม่เปิดเผยผลตรวจ' };
	};

	if (!requestId || !curVisitId || !sourceOrderIdParam || !itemId || (reuseGrant ? !suppliedGrantToken : !submittedUsername || !password || !purpose)) {
		return deny('invalid_request', 'denied', 'missing_required_input', 'กรุณากรอกข้อมูลยืนยันตัวตนและเหตุผลให้ครบ');
	}
	if (!actorUsername) return deny('reauth_failed', 'forbidden', 'missing_session_user', 'ไม่สามารถยืนยันตัวตนได้');
	if (!currentVisit || !currentVn || !hn) return deny('not_found', 'not_found', 'visit_not_found', 'ไม่พบวิสิทที่ใช้เปิดผล');

	const scopedItems = await findAll(
		CPOE_ITEM_TABLE,
		{ _id: idOne(itemId), 'order_id.xtbxlv2_xfx_id': idOne(curVisitId), xrstatx: 1 },
		{ limit: 1 },
	);
	const item = scopedItems[0] || null;
	if (!item || String(codeOf(item.service_type) || '').toLowerCase() !== 'lab') {
		return deny('scope_mismatch', 'scope_mismatch', 'item_visit_mismatch', 'รายการตรวจไม่อยู่ในขอบเขตวิสิทนี้');
	}
	const sourceOrderId = refText(item.order_id);
	if (sourceOrderIdParam && sourceOrderIdParam !== sourceOrderId) {
		return deny('scope_mismatch', 'scope_mismatch', 'order_item_mismatch', 'ใบสั่งตรวจไม่ตรงกับรายการที่ขอเปิด');
	}
	auditContext.source_order_id = sourceOrderId;

	const policies = await loadResultPolicies([itemId]);
	const policy = policies[itemId] || null;
	if (!policy || policy.state === 'withheld') {
		return deny('withheld', 'withheld', 'policy_unresolved', 'ยังไม่สามารถเปิดผลรายการนี้ได้', { policy });
	}
	if (policy.state !== 'reauth_required' || policy.sensitive !== true) {
		return deny('policy_changed', 'policy_changed', 'not_sensitive_now', 'นโยบายรายการตรวจเปลี่ยนแล้ว กรุณาโหลดข้อมูลใหม่', { policy });
	}

	let savedGrant = null;
	if (reuseGrant) {
		const grants = await findAll(
			SENSITIVE_ACCESS_GRANT_TABLE,
			{
				grant_token: suppliedGrantToken,
				viewer_username: actorUsername,
				source_order_id: sourceOrderId,
				expires_at_epoch: { $gte: Date.now() },
				xrstatx: 1,
			},
			{ limit: 1, projection: { viewer_user_id: 1, section_code: 1, authorized_by_user_id: 1, authorized_by_username: 1, purpose: 1, expires_at_epoch: 1 } },
		);
		savedGrant = grants[0] || null;
		const actorUserId = String((userInfo && userInfo.account && userInfo.account.id) || '');
		if (!savedGrant || (savedGrant.viewer_user_id && actorUserId && String(savedGrant.viewer_user_id) !== actorUserId)) {
			return deny('grant_expired', 'denied', 'grant_invalid_or_expired', 'สิทธิ์เปิดดู 5 นาทีหมดอายุแล้ว กรุณายืนยันตัวตนใหม่', { policy });
		}
		submittedUsername = String(savedGrant.authorized_by_username || '').trim();
		purpose = String(savedGrant.purpose || '').trim();
		auditContext.purpose = purpose;
	}

	const users = await findAll(
		CORE_USER_TABLE,
		// core_user รุ่นเก่าบางบัญชีไม่มี xrstatx; $nin ยอมรับ field ที่ไม่มี
		// แต่ยังตัด record ที่ถูกยกเลิก/ลบ (0/3) และ blocked_at ตรวจแยกด้านล่าง
		{ username: submittedUsername, xrstatx: { $nin: [0, 3] } },
		{ limit: 1, projection: { username: 1, password_hash: 1, blocked_at: 1, roles: 1 } },
	);
	const account = users[0] || null;
	if (!account || account.blocked_at || !hasSensitiveRole(account.roles)) {
		return deny('forbidden', 'forbidden', account && account.blocked_at ? 'account_blocked' : 'account_not_allowed', 'บัญชีนี้ไม่สามารถเปิดผล Sensitive ได้', { policy, user_id: account && account._id });
	}
	if (!reuseGrant) {
		let passwordOk = false;
		try {
			passwordOk = !!(account.password_hash && (await this.compareHash(account.password_hash, password)));
		} catch (e) {
			passwordOk = false;
		}
		if (!passwordOk) return deny('reauth_failed', 'bad_credentials', 'bad_credentials', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', { policy, user_id: account._id, authorized_by_username: submittedUsername });
	}

	// One confirmation unlocks every Sensitive result in the same Order+Section.
	// Resolve the sheet on the server; never trust a client-provided list of IDs.
	const orderItems = await findAll(
		CPOE_ITEM_TABLE,
		{ 'order_id.value': idOne(sourceOrderId), 'order_id.xtbxlv2_xfx_id': idOne(curVisitId), xrstatx: 1 },
		{ limit: MAX_CPOE_ITEM },
	);
	let sheetItemIds = orderItems
		.filter((candidate) => String(codeOf(candidate.service_type) || '').toLowerCase() === 'lab')
		.map((candidate) => String(candidate._id || ''));
	// Resolve Section from server-owned Work Items. EMR History may receive a
	// legacy board row without section_code; trusting that empty client value
	// creates a grant that the Report SQL can never match. A supplied client
	// Section is accepted only when it agrees with the authoritative row.
	const sheetWorkRows = sheetItemIds.length
		? await findAll(
			WORK_ITEM_TABLE,
			{ _id: idsIn(sheetItemIds), xrstatx: 1 },
			{ limit: sheetItemIds.length, projection: { section_code: 1 } },
		  )
		: [];
	const workByItemId = {};
	sheetWorkRows.forEach((row) => { workByItemId[String(row._id || '')] = row; });
	const authoritativeSectionCode = String((workByItemId[itemId] && workByItemId[itemId].section_code) || '').trim().toUpperCase();
	if (sectionCodeParam && authoritativeSectionCode && sectionCodeParam !== authoritativeSectionCode) {
		return deny('scope_mismatch', 'scope_mismatch', 'section_item_mismatch', 'ห้อง Lab ไม่ตรงกับรายการที่ขอเปิด', { policy, user_id: account._id });
	}
	let resolvedSectionCode = authoritativeSectionCode || sectionCodeParam;
	if (resolvedSectionCode && sheetItemIds.length) {
		const sectionIds = {};
		sheetWorkRows.forEach((row) => {
			if (String(row.section_code || '').trim().toUpperCase() === resolvedSectionCode) sectionIds[String(row._id || '')] = true;
		});
		sheetItemIds = sheetItemIds.filter((candidateId) => sectionIds[candidateId]);
	}
	if (sheetItemIds.indexOf(itemId) < 0) sheetItemIds.push(itemId);
	const sheetPolicies = await loadResultPolicies(sheetItemIds);
	const sensitiveItemIds = sheetItemIds.filter((candidateId) => {
		const candidatePolicy = sheetPolicies[candidateId];
		return candidatePolicy && candidatePolicy.state === 'reauth_required' && candidatePolicy.sensitive === true;
	});
	const resultRows = await findAll(
		LAB_TABLE,
		{ order_no: idsIn(sensitiveItemIds), visit_id: String(currentVn), hn: String(hn), xrstatx: 1 },
		{ sort: { result_sequence: 1, entered_at: 1, _id: 1 }, limit: MAX_RESULT_ROW, projection: RESULT_FIELDS },
	);
	if (!resultRows.length) return deny('not_found', 'not_found', 'result_not_found', 'ไม่พบผลตรวจสำหรับรายการนี้', { policy, user_id: account._id });
	const latest = resultRows.slice().sort((a, b) => resultTime(b).localeCompare(resultTime(a)))[0];
	const resultSectionCode = String(latest.lab_section || '').trim().toUpperCase();
	if (resolvedSectionCode && resultSectionCode && resolvedSectionCode !== resultSectionCode) {
		return deny('scope_mismatch', 'scope_mismatch', 'section_result_mismatch', 'ห้อง Lab ของผลตรวจไม่ตรงกับรายการที่ขอเปิด', { policy, user_id: account._id });
	}
	resolvedSectionCode = resolvedSectionCode || resultSectionCode;
	if (!resolvedSectionCode) {
		return deny('scope_unresolved', 'scope_mismatch', 'section_unresolved', 'ไม่สามารถยืนยันขอบเขตห้อง Lab สำหรับเปิดผลได้', { policy, user_id: account._id });
	}
	if (reuseGrant && String(savedGrant.section_code || '').trim().toUpperCase() !== resolvedSectionCode) {
		return deny('scope_mismatch', 'scope_mismatch', 'grant_section_mismatch', 'สิทธิ์เปิดดูไม่ตรงกับห้อง Lab ของรายการนี้', { policy, user_id: account._id });
	}
	const revisionId = String(latest.result_uid || latest.result_version || latest._id || '');
	for (const disclosedItemId of sensitiveItemIds) {
		const logged = await auditSensitiveAccess('success', reuseGrant ? 'grant_reuse' : 'reauth_success', Object.assign({}, auditContext, {
			policy: sheetPolicies[disclosedItemId], item_id: disclosedItemId, revision_id: revisionId,
			authorized_by_user_id: account._id, authorized_by_username: submittedUsername, authorized_by_roles: account.roles,
		}));
		if (!logged) return { success: false, code: 'audit_failed', message: 'ไม่สามารถบันทึก Access Log ได้ จึงไม่เปิดเผยผลตรวจ' };
	}
	let grantToken = suppliedGrantToken;
	let grantExpiresAtEpoch = Number(savedGrant && savedGrant.expires_at_epoch) || 0;
	if (!reuseGrant) {
		grantToken = sensitiveGrantToken();
		const issuedAtEpoch = Date.now();
		grantExpiresAtEpoch = issuedAtEpoch + SENSITIVE_GRANT_TTL_MS;
		let grantSaved = null;
		try {
			grantSaved = await app.dbInsert({
				grant_token: grantToken,
				viewer_username: actorUsername,
				viewer_user_id: String((userInfo && userInfo.account && userInfo.account.id) || ''),
				source_order_id: sourceOrderId,
				section_code: resolvedSectionCode,
				authorized_by_user_id: String(account._id || ''),
				authorized_by_username: submittedUsername,
				purpose,
				issued_at_epoch: issuedAtEpoch,
				expires_at_epoch: grantExpiresAtEpoch,
				xrstatx: 1,
			}, SENSITIVE_ACCESS_GRANT_TABLE, userInfo);
		} catch (e) {
			grantSaved = null;
		}
		if (!grantSaved || grantSaved.success === false) return { success: false, code: 'grant_failed', message: 'สร้างสิทธิ์เปิดดูชั่วคราวไม่สำเร็จ' };
	}

	const items = resultRows.map((row) => {
		const rowItemId = String(row.order_no || '');
		const rowPolicy = sheetPolicies[rowItemId] || policy;
		const rowItem = orderItems.find((candidate) => String(candidate._id || '') === rowItemId);
		const disclosedPolicy = Object.assign({}, rowPolicy, { state: 'visible' });
		row.__item = (rowItem && rowItem.item_name) || rowPolicy.item_name || '';
		row.__policy = disclosedPolicy;
		const mapped = mapResultRow(row);
		// Historical Sensitive values are not covered by the current
		// Order+Section grant. Keep them fail-closed instead of widening scope.
		mapped.previous = null;
		mapped.previous_values = [];
		mapped.visibility = Object.assign({}, publicPolicy(disclosedPolicy), { disclosed: true });
		return mapped;
	});
	const resultReportIds = uniq(items.map((mapped) => String(mapped.result_report_id || '')).filter(Boolean));
	return {
		success: true,
		action,
		item_id: itemId,
		item_ids: sensitiveItemIds,
		section_code: resolvedSectionCode,
		revision_id: revisionId,
		items,
		reported_at: String(latest.reported_at || latest.entered_at || latest.created_at || ''),
		reported_by_source_name: personName(latest, 'reported'),
		verified_at: String(latest.verified_at || ''),
		verified_by_source_name: personName(latest, 'verified'),
		attachments: [],
		result_report_ids: resultReportIds,
		sensitive_grant_token: grantToken,
		sensitive_grant_expires_at_epoch: grantExpiresAtEpoch,
		access_event_id: requestId,
	};
};

if (['open_sensitive', 'reuse_sensitive'].indexOf(String(params.action || '')) >= 0) return openSensitiveResult();

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

// Result Report / Revision metadata is returned as a safe UI contract only.
// Raw payload, payload hash and item snapshots remain server-side audit data.
const metadataTime = (row) => String((row && (row.reported_at || row.source_reported_at || row.received_at || row.processed_at || row.updated_at || row.xupdatx || row.created_at)) || '');
const sequenceValue = (value) => {
	if (value === '' || value == null) return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
};
const nullableNumber = (value) => (value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value));
const latestMetadataFirst = (a, b) => {
	const left = sequenceValue(a && (a.report_seq || a.receipt_seq));
	const right = sequenceValue(b && (b.report_seq || b.receipt_seq));
	if (left !== null && right !== null && left !== right) return right - left;
	return metadataTime(b).localeCompare(metadataTime(a));
};
const mapReportMetadata = (report) => ({
	report_id: String((report && report._id) || ''),
	result_uid: String((report && report.result_uid) || ''),
	report_seq: String((report && report.report_seq) || ''),
	stage: String((report && report.stage) || ''),
	agent_overall_status: String((report && report.agent_overall_status) || ''),
	internal_overall_status: String((report && report.internal_overall_status) || ''),
	receipt_status: String((report && report.receipt_status) || ''),
	source_channel: String((report && report.source_channel) || ''),
	schema_version: String((report && report.schema_version) || ''),
	record_kind: String((report && report.record_kind) || ''),
	received_at: String((report && report.received_at) || ''),
	reported_at: String((report && report.reported_at) || ''),
	reported_by_source_id: String((report && report.reported_by_source_id) || ''),
	reported_by_source_name: String((report && report.reported_by_source_name) || ''),
	verified_at: String((report && report.verified_at) || ''),
	verified_by_source_id: String((report && report.verified_by_source_id) || ''),
	verified_by_source_name: String((report && report.verified_by_source_name) || ''),
	confirmed_at: String((report && report.confirmed_at) || ''),
	confirmed_by: String((report && report.confirmed_by) || ''),
	item_count: nullableNumber(report && report.item_count),
	critical_count: nullableNumber(report && report.critical_count),
	matched_item_count: nullableNumber(report && report.matched_item_count),
	unmatched_item_count: nullableNumber(report && report.unmatched_item_count),
});
const mapRevisionMetadata = (revision) => ({
	revision_id: String((revision && revision.revision_id) || ''),
	previous_revision_id: String((revision && revision.previous_revision_id) || ''),
	result_uid: String((revision && revision.result_uid) || ''),
	report_seq: String((revision && revision.report_seq) || ''),
	receipt_seq: String((revision && revision.receipt_seq) || ''),
	stage: String((revision && revision.stage) || ''),
	source_reported_at: String((revision && revision.source_reported_at) || ''),
	received_at: String((revision && revision.received_at) || ''),
	item_count: nullableNumber(revision && revision.item_count),
	changed_item_count: nullableNumber(revision && revision.changed_item_count),
	ingest_status: String((revision && revision.ingest_status) || ''),
	schema_version: String((revision && revision.schema_version) || ''),
});

const buildGroup = (g) => {
	const rows = g.rows.slice().sort((a, b) => {
		const left = Number(a && a.result_sequence);
		const right = Number(b && b.result_sequence);
		if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return left - right;
		return String((a && a.result_sequence) || '').localeCompare(String((b && b.result_sequence) || ''));
	});
	const visibleRows = rows.filter(isResultVisible);
	const protectedRows = rows.filter((r) => !isResultVisible(r));
	const hasProtected = protectedRows.length > 0;
	const resultedAt = g.rows.reduce((mx, r) => (String(r.created_at || '') > mx ? String(r.created_at) : mx), '');
	// Attachment ยังปิดทั้งใบเมื่อมี protected item; PDF ใช้ Result Report id
	// แยกต่างหากและให้ Report SQL blank เฉพาะแถว Sensitive ที่ยังไม่มี grant.
	const reports = hasProtected ? [] : Array.isArray(g.reports) ? g.reports : [];
	const reportHistory = reports.map(mapReportMetadata).sort(latestMetadataFirst);
	const revisionHistory = (hasProtected ? [] : Array.isArray(g.revisions) ? g.revisions : []).map(mapRevisionMetadata).sort(latestMetadataFirst);
	const currentReport = reportHistory.find(
		(report) => report.stage || report.report_seq || report.agent_overall_status || report.internal_overall_status,
	) || reportHistory[0] || null;
	const latestRevision = revisionHistory[0] || null;
	const hasItemCorrection = visibleRows.some(
		(row) =>
			String(row.obx_status || '').toUpperCase() === 'C' ||
			String(row.result_status || '').toLowerCase() === 'corrected' ||
			String(row.change_kind || '').toLowerCase() === 'corrected' ||
			Number(row.result_version) > 1,
	);
	const hasReportCorrection = reportHistory.some((report) => String(report.stage || '').toLowerCase() === 'corrected');
	const criticalSummary = visibleRows.reduce(
		(summary, row) => {
			const key = row.is_critical === true ? 'true' : row.is_critical === false ? 'false' : 'unknown';
			summary[key] += 1;
			return summary;
		},
		{ true: 0, false: 0, unknown: 0 },
	);
	const metaRows = (hasProtected ? visibleRows : rows.concat(reports)).sort((a, b) => resultTime(b).localeCompare(resultTime(a)));
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
	const displayItems = [];
	const protectedSeen = {};
	rows.forEach((row) => {
		if (isResultVisible(row)) {
			displayItems.push(mapResultRow(row));
			return;
		}
		const itemId = resultPolicy(row).item_id || String(row.__source_item_id || row.order_no || '');
		if (protectedSeen[itemId]) return;
		protectedSeen[itemId] = true;
		displayItems.push(mapProtectedResult(row));
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
		result_report_ids: uniq(rows.map((r) => String(r.result_report_id || r.xparentx || '')).filter(Boolean)),
		lab_no: g.lab_no || '',
		patient_hn: String(hn || ''),
		patient_name: g.patient_name || currentPatientName || '',
		// Keep the legacy merged/fallback key for old consumers, but expose each
		// comment level separately so the redesigned UI does not conflate authorship.
		order_comment: g.order_comment || '',
		cpoe_order_comment: g.cpoe_order_comment || '',
		result_order_note: (g.result_order_notes || []).join('\n'),
		report_order_notes: uniq([].concat(g.result_order_notes || []).filter(Boolean)),
		specimen_name: uniq([].concat(g.specimen_names || []).filter(Boolean)).join(' / '),
		specimen_names: uniq([].concat(g.specimen_names || []).filter(Boolean)),
		ordered_items: Array.isArray(g.ordered_items) ? g.ordered_items : [],
		status: groupStatus(g.stages, g.rows.length > 0),
		scope: g.scope,
		ordered_at: g.ordered_at || '',
		resulted_at: resultedAt,
		received_at: g.received_at || '',
		collected_at: (g.collected_ats || [])[0] || '',
		in_process_at: '',
		cancel_reason: g.cancel_reason || '',
		reported_at: firstMeta('reported_at'),
		reported_by_source_name: firstMeta('', 'reported'),
		verified_at: firstMeta('verified_at'),
		verified_by_source_name: firstMeta('', 'verified'),
		result_stage: currentReport ? currentReport.stage : '',
		report_seq: currentReport ? currentReport.report_seq : '',
		result_uid: currentReport ? currentReport.result_uid : '',
		agent_overall_status: currentReport ? currentReport.agent_overall_status : '',
		internal_overall_status: currentReport ? currentReport.internal_overall_status : '',
		item_count: currentReport ? currentReport.item_count : null,
		critical_count: currentReport ? currentReport.critical_count : null,
		critical_summary: criticalSummary,
		critical_summary_complete: !hasProtected,
		revision_count: revisionHistory.length,
		report: currentReport,
		report_history: reportHistory,
		revision_history: revisionHistory,
		correction_summary: {
			has_correction:
				hasItemCorrection ||
				hasReportCorrection ||
				(!!latestRevision &&
					(revisionHistory.length > 1 || String(latestRevision.stage || '').toLowerCase() === 'corrected' || Number(latestRevision.changed_item_count) > 0)),
			revision_count: revisionHistory.length,
			latest_revision_id: latestRevision ? latestRevision.revision_id : '',
			previous_revision_id: latestRevision ? latestRevision.previous_revision_id : '',
			changed_item_count: latestRevision ? latestRevision.changed_item_count : null,
		},
		attachments,
		items: displayItems,
	};
};

if (currentVn) {
	const groups = {}; // key -> ก้อน
	const snapshotTestCodeByItemId = {};
	const touch = (key, seed) => {
		if (!groups[key]) groups[key] = Object.assign({ key, rows: [], reports: [], revisions: [], result_order_notes: [], item_ids: [], stages: [], names: [], ordered_items: [], specimen_names: [], collected_ats: [], scope: 'visit' }, seed);
		return groups[key];
	};

	/* ── ① ใบสั่ง LAB ของวิสิทนี้ — ตั้งต้นจาก CPOE Item เพื่อให้ใบที่ยังรอผลไม่หาย ── */
	const cpoeItems = await findAll(
		CPOE_ITEM_TABLE,
		{ 'order_id.xtbxlv2_xfx_id': idOne(curVisitId), xrstatx: 1 },
		{
			sort: { _id: 1 },
			limit: MAX_CPOE_ITEM,
			projection: { order_id: 1, service_type: 1, item_data_id: 1, item_code: 1, item_name: 1, comment: 1, current_status: 1, lab_data: 1, created_at: 1 },
		},
	);
	const labItems = cpoeItems.filter((r) => String(codeOf(r.service_type) || '').toLowerCase() === 'lab');

	if (labItems.length) {
		const orderIds = uniq(labItems.map((r) => String(codeOf(r.order_id) || '')));
		// ทั้งสาม query ใช้ key ที่ทราบแล้วและไม่พึ่งผลกัน จึงยิงพร้อมกันเพื่อลดเวลารวมของ Tab LAB.
		const [orderRows, workRows, resultRows] = await Promise.all([
			orderIds.length
				? findAll(CPOE_ORDER_TABLE, { _id: idsIn(orderIds), xrstatx: 1 }, { limit: orderIds.length, projection: { order_number: 1, order_comment: 1, created_at: 1, current_status: 1, order_to_location: 1 } })
				: Promise.resolve([]),
			findAll(
				WORK_ITEM_TABLE,
				{ visit_id: String(currentVn), xrstatx: 1 },
				{ limit: MAX_CPOE_ITEM, projection: { lab_no: 1, section_code: 1, section_name: 1, work_status: 1, received_at: 1, ordered_at: 1, source_order_id: 1, source_order_number: 1, source_specimen_record_id: 1, receipt_batch_id: 1, selected_items: 1, selected_items_json: 1, specimen_json: 1, patient_name: 1, cancel_reason: 1, reject_reason_detail: 1 } },
			),
			findAll(LAB_TABLE, { visit_id: String(currentVn), xrstatx: 1 }, { sort: { _id: 1 }, limit: MAX_RESULT_ROW, projection: RESULT_FIELDS }),
		]);
		const orderById = {};
		orderRows.forEach((o) => {
			orderById[String(o._id)] = o;
		});

		// Work Item ของ VN นี้ — `_id` ตรงกับ CPOE Item `_id`
		const workByItem = {};
		workRows.forEach((w) => {
			workByItem[String(w._id)] = w;
			jsonArray(w.selected_items || w.selected_items_json).forEach((snapshot) => {
				const sourceItemId = String((snapshot && (snapshot.source_item_id || snapshot.source_cpoe_item_id || snapshot.item_id)) || '');
				if (!sourceItemId) return;
				// Aggregate receipt batches have one Work Item for several CPOE Items.
				// Point every selected child back to that authoritative batch row.
				if (!workByItem[sourceItemId]) workByItem[sourceItemId] = w;
				const testCode = String((snapshot && (snapshot.test_code || snapshot.his_code_id || snapshot.obs_code || snapshot.item_code || snapshot.code)) || '').trim();
				if (testCode) snapshotTestCodeByItemId[sourceItemId] = testCode;
			});
		});

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
			const specimen = specimenMeta(it, wi);
			const g = touch(orderId + '|' + sectionCode, {
				source_order_id: orderId,
				section_code: sectionCode,
				order_no: (order && order.order_number) || (wi && wi.source_order_number) || '',
				// 🔴 ห้ามเอา `order_to_location` มาเป็นชื่อห้องแลป — ของจริงในใบ LAB คือ "m01.p ห้องยาพรีเมี่ยม"
				//    (ช่องนั้นเป็นปลายทางของใบ ไม่ใช่ section ของแลป) ⇒ ยังไม่มี Work Item = ยังไม่รู้ section
				section: (wi && (wi.section_name || wi.section_code)) || '',
				lab_no: (wi && wi.lab_no) || '',
				ordered_at: (order && order.created_at) || (wi && wi.ordered_at) || it.created_at || '',
				order_comment: (order && order.order_comment) || '',
				cpoe_order_comment: (order && order.order_comment) || '',
				received_at: (wi && wi.received_at) || '',
				cancel_reason: (wi && (wi.cancel_reason || wi.reject_reason_detail)) || '',
				patient_name: (wi && wi.patient_name) || currentPatientName || '',
			});
			if (!g.lab_no && wi && wi.lab_no) g.lab_no = wi.lab_no;
			if (!g.received_at && wi && wi.received_at) g.received_at = wi.received_at;
			if (!g.order_comment && order && order.order_comment) g.order_comment = order.order_comment;
			if (!g.cancel_reason && wi && (wi.cancel_reason || wi.reject_reason_detail)) g.cancel_reason = wi.cancel_reason || wi.reject_reason_detail;
			if (!g.patient_name && wi && wi.patient_name) g.patient_name = wi.patient_name;
			specimen.specimen_names.forEach((name) => { if (g.specimen_names.indexOf(name) < 0) g.specimen_names.push(name); });
			specimen.collected_ats.forEach((at) => { if (g.collected_ats.indexOf(at) < 0) g.collected_ats.push(at); });
			g.stages.push(itemStage(codeOf(it.current_status), wi));
			if (g.item_ids.indexOf(itemId) < 0) g.item_ids.push(itemId);
			if (it.item_name) g.names.push(String(it.item_name));
			if (!g.ordered_items.some((row) => row.item_id === itemId)) {
				g.ordered_items.push({
					item_id: itemId,
					item_code: String(codeOf(it.item_code) || ''),
					item_name: String(it.item_name || ''),
					comment: String(it.comment || ''),
					result_code: String(snapshotTestCodeByItemId[itemId] || ''),
					status: itemStage(codeOf(it.current_status), wi),
					specimen_name: specimen.specimen_name,
					specimen_names: specimen.specimen_names,
					collected_at: specimen.collected_at,
				});
			}
			// ชื่อรายการที่สั่งติดไปกับผล — ใช้ตอน obs_name เป็นรหัสล้วน
			(resultByOrderNo[itemId] || []).forEach((r) => {
				r.__item = it.item_name || '';
				g.rows.push(r);
			});
		});
	}

	// History ใช้ทำ previous/trend/legacy summary; เริ่มพร้อม query ผลวันนี้เพื่อลดเวลารอรวม.
	const resultHistoryPromise = hn
		? findAll(LAB_TABLE, { hn: String(hn), xrstatx: 1 }, { sort: { entered_at: -1, _id: -1 }, limit: 1000, projection: RESULT_FIELDS })
		: Promise.resolve([]);

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
				? await findAll(CPOE_ORDER_TABLE, { _id: idsIn(oIds), xrstatx: 1 }, { limit: oIds.length, projection: { order_number: 1, order_comment: 1, created_at: 1 } })
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
					order_comment: (order && order.order_comment) || '',
					cpoe_order_comment: (order && order.order_comment) || '',
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
	const resultHistory = await resultHistoryPromise;

	// ผูกทุก Result Item กลับ CPOE Item -> Item Master ปัจจุบันก่อนประกอบ previous/trend/response
	// เพื่อให้ผลเก่าที่สั่งก่อนมี snapshot ถูกคุ้มครองทันทีเมื่อ master ถูกตั้ง Sensitive
	const policyItemIds = uniq(
		Object.keys(groups)
			.reduce((acc, key) => acc.concat(groups[key].item_ids || []), [])
			.concat(resultHistory.map((r) => String(r.order_no || ''))),
	);
	const policyByItemId = await loadResultPolicies(policyItemIds);
	const rowResultCode = (row) => String((row && (row.result_definition_id || row.obs_code || row.test_code)) || '').trim();
	const resolveResultOwnerId = (row, itemIds) => {
		const candidates = uniq([].concat(itemIds || []).map((id) => String(id || '')));
		const resultCode = rowResultCode(row);
		const exact = candidates.find((itemId) => {
			const policy = policyByItemId[itemId] || {};
			return resultCode && (String(snapshotTestCodeByItemId[itemId] || '') === resultCode || String(policy.result_code || '') === resultCode);
		});
		if (exact) return exact;
		const component = candidates.find((itemId) => {
			const policy = policyByItemId[itemId] || {};
			const codes = uniq([].concat(policy.result_codes || [], resultComponentCodesForOrderCode(snapshotTestCodeByItemId[itemId])));
			return resultCode && codes.indexOf(resultCode) >= 0;
		});
		if (component) return component;
		const storedItemId = String((row && row.order_no) || '');
		return candidates.indexOf(storedItemId) >= 0 ? storedItemId : storedItemId;
	};
	const currentOwnerByResultId = {};
	Object.keys(groups).forEach((key) => {
		const group = groups[key];
		group.rows.forEach((r) => {
			const ownerItemId = resolveResultOwnerId(r, group.item_ids);
			const policy = policyByItemId[ownerItemId] || policyByItemId[String(r.order_no || '')];
			r.__source_item_id = ownerItemId;
			r.__policy = policy;
			if (policy && policy.item_name) r.__item = policy.item_name;
			if (r._id) currentOwnerByResultId[String(r._id)] = ownerItemId;
		});
	});
	resultHistory.forEach((r) => {
		const ownerItemId = currentOwnerByResultId[String(r._id || '')] || String(r.order_no || '');
		r.__source_item_id = ownerItemId;
		r.__policy = policyByItemId[ownerItemId] || policyByItemId[String(r.order_no || '')];
		if (r.__policy && r.__policy.item_name) r.__item = r.__policy.item_name;
	});
	const summarySeen = {};
	resultHistory.forEach((r) => {
		if (!isResultVisible(r)) return;
		const name = String(r.test_name || r.obs_name || r.panel_name || '').trim();
		if (!name || summarySeen[name]) return;
		summarySeen[name] = true;
		summaryLab.push({
			data_id: String(r._id || ''),
			name,
			panel: String(r.panel_name || ''),
			value: r.result_value != null ? String(r.result_value) : '',
			unit: String(r.unit_symbol_snapshot || r.units || ''),
			ref: String(r.reference_range_snapshot || r.ref_range || ''),
			flag: String(r.interpretation_code || ''),
			critical: !!r.is_critical,
			is_critical: criticalDecision(r.is_critical),
			critical_state: criticalState(r.is_critical),
			status: String(codeOf(r.result_status) || ''),
			obx_status: String(r.obx_status || ''),
			result_version: String(r.result_version || ''),
			change_kind: String(r.change_kind || ''),
			receipt_seq: String(r.receipt_seq || ''),
			result_uid: String(r.result_uid || ''),
			when: String(r.entered_at || r.created_at || ''),
			visit_id: String(r.visit_id || ''),
		});
	});

	if (hn) {
		const currentIds = {};
		const currentOrderNos = {};
		Object.keys(groups).forEach((key) => {
			groups[key].rows.forEach((r) => {
				currentIds[String(r._id || '')] = true;
				currentOrderNos[String(r.order_no || '')] = true;
			});
		});
		const publishedHistory = resultHistory.filter((r) => {
			if (!isResultVisible(r)) return false;
			// Defense in depth: the query is already HN-scoped with a server-derived
			// HN, but never accept a row whose stored HN differs from that patient.
			if (String(r.hn || '') !== String(hn || '')) return false;
			if (currentIds[String(r._id || '')] || currentOrderNos[String(r.order_no || '')]) return false;
			const st = String(r.result_status || '').toLowerCase();
			const obx = String(r.obx_status || '').toUpperCase();
			return ['partial', 'final', 'corrected', 'completed', 'resulted'].indexOf(st) >= 0 || ['P', 'F', 'C'].indexOf(obx) >= 0;
		});
		Object.keys(groups).forEach((key) => {
			groups[key].rows.forEach((r) => {
				if (!isResultVisible(r)) return;
				const currentTime = resultTime(r);
				const testKey = historyTestKey(r);
				const pathologyKey = myPathologyPreviousKey(r);
				if (!currentTime || !testKey || (myPathologyMeta(r) && !pathologyKey)) {
					r.__previous = null;
					r.__previous_values = [];
					return;
				}
				const candidates = publishedHistory.filter((old) => {
					if (resultTime(old) >= currentTime || historyTestKey(old) !== testKey) return false;
					return !pathologyKey || myPathologyPreviousKey(old) === pathologyKey;
				});
				// A corrected/partial/final chain from the same historical examination
				// is one previous occurrence, not several. Keep its latest effective row.
				const latestByOccurrence = {};
				candidates.forEach((old) => {
					const occurrenceKey = [
						String(old.visit_id || ''),
						String(old.order_no || ''),
						String(old.result_report_id || old.xparentx || old.filler_order_no || ''),
						testKey,
					].join('|');
					const saved = latestByOccurrence[occurrenceKey];
					if (!saved || resultTime(old) > resultTime(saved)) latestByOccurrence[occurrenceKey] = old;
				});
				r.__previous_values = Object.keys(latestByOccurrence)
					.map((occurrenceKey) => latestByOccurrence[occurrenceKey])
					.sort((a, b) => resultTime(b).localeCompare(resultTime(a)))
					.slice(0, historyLimit);
				r.__previous = r.__previous_values[0] || null;
			});
		});
	}

	const allGroups = Object.keys(groups).map((key) => groups[key]);
	const reportGroups = allGroups.filter((g) => !g.rows.some((r) => !isResultVisible(r)));
	const reportIds = uniq(reportGroups.reduce((acc, g) => acc.concat(g.rows.map((r) => String(r.result_report_id || r.xparentx || ''))), []));
	const itemIds = uniq(reportGroups.reduce((acc, g) => acc.concat(g.item_ids || []), []));
	const reportKeys = uniq(
		reportGroups.reduce((acc, g) => {
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
				projection: REPORT_FIELDS,
			},
		);
		reportGroups.forEach((g) => {
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
			// Comment ระดับ Order ที่มาพร้อมผลจาก Report/LIS เป็นข้อมูลของผลจริง
			// จึงมาก่อน comment ใบสั่ง CPOEใน legacy `order_comment`; API ใหม่ส่งทั้งสองระดับ
			// แยกใน `cpoe_order_comment` และ `result_order_note` ด้วย.
			const reportOrderNotes = uniq(g.reports.map((report) => String(report.order_note || '').trim()).filter(Boolean));
			g.result_order_notes = reportOrderNotes;
			if (reportOrderNotes.length) g.order_comment = reportOrderNotes.join('\n');
			g.rows.forEach((row) => {
				const parent = g.reports.find((report) => String(report._id || '') === String(row.result_report_id || row.xparentx || '')) || g.reports.find((report) => String(report.order_no || '') === String(row.order_no || ''));
				if (!parent) return;
				if (!row.reported_at) row.reported_at = parent.reported_at;
				if (!row.reported_by_source_name) row.reported_by_source_name = parent.reported_by_source_name;
				if (!row.verified_at) row.verified_at = parent.verified_at;
				if (!row.verified_by_source_name) row.verified_by_source_name = parent.verified_by_source_name;
			});
		});

		const revisionResultUids = uniq(reportRows.map((report) => String(report.result_uid || '')).filter(Boolean));
		const revisionOr = [];
		if (reportIds.length) revisionOr.push({ report_id: { $in: reportIds } });
		if (itemIds.length) revisionOr.push({ order_no: { $in: itemIds } });
		if (revisionResultUids.length) revisionOr.push({ result_uid: { $in: revisionResultUids } });
		if (revisionOr.length) {
			const revisionRows = await findAll(
				RESULT_REVISION_TABLE,
				{ $or: revisionOr, xrstatx: 1 },
				{ sort: { received_at: -1, _id: -1 }, limit: Math.max(200, revisionOr.length * 50), projection: REVISION_FIELDS },
			);
			reportGroups.forEach((g) => {
				const wantedIds = {};
				g.rows.forEach((row) => { wantedIds[String(row.result_report_id || row.xparentx || '')] = true; });
				const wantedOrders = {};
				(g.item_ids || []).forEach((id) => { wantedOrders[String(id)] = true; });
				const wantedUids = {};
				(g.reports || []).forEach((report) => { if (report.result_uid) wantedUids[String(report.result_uid)] = true; });
				g.revisions = revisionRows.filter(
					(revision) =>
						wantedIds[String(revision.report_id || '')] ||
						wantedOrders[String(revision.order_no || '')] ||
						wantedUids[String(revision.result_uid || '')],
				);
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

	// Contract ใหม่แยกความหมายของสองหัวข้อให้ชัด แต่คง lab_orders เดิมไว้ให้ผู้ใช้เก่า.
	// รายการที่สั่งและออกผลในวัน VN เดียวกันจึงปรากฏได้ทั้งสองหัวข้อโดยอ้าง record เดียวกัน.
	orderedToday = labOrders.filter((order) => String(order.scope || 'visit') !== 'today');
	resultedToday = labOrders.filter((order) => {
		if (String(order.scope || '') === 'today') return true;
		return !!currentDay && dayOf(order.resulted_at || order.reported_at) === currentDay;
	});

	/* ── ③ แนวโน้มของค่าที่อยู่ในสองกลุ่มข้างบน ─────────────────────────── */
	if (hn) {
		const names = uniq(
			labOrders.reduce(
				(acc, o) => acc.concat(o.items.filter((i) => i.visibility && i.visibility.state === 'visible').map((i) => i.name)),
				[],
			),
		);
		if (names.length) {
			const allowedNames = {};
			names.forEach((name) => {
				allowedNames[String(name)] = true;
			});
			const byName = {};
			resultHistory.forEach((r) => {
				const n = r.obs_name || r.test_name || '';
				if (!isResultVisible(r) || !allowedNames[String(n)] || !isNumeric(r.result_value)) return;
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
	history_limit: historyLimit,
	current_vn: currentVn,
	service_date: currentDay,
	ordered_today: orderedToday,
	resulted_today: resultedToday,
	lab_orders: labOrders,
	summary_lab: summaryLab,
	xray_results: xrayResults,
	lab_trends: labTrends,
};
