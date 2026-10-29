/**
 * emr-xray-history-get — read-only X-ray result contract for EMR cards/history.
 *
 * Input:  { visit_id }
 * Output: { success, visit_id, hn, vn, orders[] }
 *
 * Design rules:
 * - The requested Visit is authoritative. HN/VN are always derived server-side.
 * - Results stay under the original X-ray Order/Visit; result date never moves them.
 * - Current results join by AccessionNo.
 * - same_exam_history is latest ten earlier studies for the same HN + exact ExamUid.
 *   There is deliberately no exam-name fallback.
 * - This process performs no insert/update/delete and does not touch LAB contracts.
 */

const VISIT_COLLECTION = 'zdata_visit';
const ORDER_COLLECTION = 'zdata_cpoe_order';
const ITEM_COLLECTION = 'zdata_cpoe_order_item';
const ITEM_MASTER_COLLECTION = 'zdata_master_item_order';
const SECTION_COLLECTION = 'zdata_section';
const XRAY_ORDER_COLLECTION = 'zdata_xray_order';
const XRAY_RESULT_COLLECTION = 'zdata_xray_result';
const XRAY_RESULT_FORM_ID = '6aa180f009c1bad08952da58';
const XRAY_SERVICE_TYPE = 'xray';
const MAX_ROWS = 2000;
const HISTORY_LIMIT = 10;

const text = (value) => String(value == null ? '' : value).trim();
const valueOf = (value) => (value && typeof value === 'object' ? value.value : value);
const labelOf = (value) => (value && typeof value === 'object' ? value.label || value.value : value) || '';
const activeQuery = () => ({ xrstatx: { $nin: [0, 3] } });
const unique = (values) => Array.from(new Set((values || []).map(text).filter(Boolean)));
const validId = (value) => /^[a-f0-9]{24}$/i.test(text(value));
const idVariants = (values) => {
	const out = [];
	unique(values).forEach((id) => {
		out.push(id);
		if (validId(id)) out.push(app.dbObjectId(id));
	});
	return out;
};
const newer = (left, right, fields) => {
	const keys = fields || ['ResultDateTime', 'updated_at', 'xupdatx', 'created_at', '_id'];
	for (const key of keys) {
		const a = text(left && left[key]);
		const b = text(right && right[key]);
		if (a !== b) return a > b;
	}
	return false;
};
const findAll = async (collection, query, options) => {
	const opt = options || {};
	const response = await app.dbFindAll(
		{
			from: collection,
			nosql: {
				type: 'query',
				collection,
				query: query || {},
				projection: opt.projection || {},
				sort: opt.sort || { _id: -1 },
				limit: Number(opt.limit || MAX_ROWS),
			},
		},
		false,
		false,
	);
	if (!response || response.success === false) throw new Error('read ' + collection + ' failed');
	return response.reply && Array.isArray(response.reply.data) ? response.reply.data : [];
};
const byId = async (collection, id) => {
	if (!validId(id)) return null;
	const response = await app.dbFindById(app.dbObjectId(text(id)), collection);
	const row = response && response.success && response.reply ? response.reply.data : null;
	return row && ![0, 3].includes(Number(row.xrstatx)) ? row : null;
};
const refId = (value) => text(valueOf(value));
const modalityFromMaster = (master) => {
	const xray = (master && master.xray_item) || {};
	return text(valueOf(xray.modality) || valueOf(xray.modality_type)).toUpperCase();
};
const modalityLabelFromMaster = (master) => {
	const xray = (master && master.xray_item) || {};
	return text(labelOf(xray.modality) || labelOf(xray.modality_type)).trim();
};
const sectionRefFrom = (item, master) => {
	const value = (item && (item.section_snapshot || (item.xray_context_snapshot && item.xray_context_snapshot.section))) || (master && master.section);
	return refId(value);
};
const resultTime = (row) => text(row && (row.ResultDateTime || row.updated_at || row.xupdatx || row.created_at));
const orderTime = (row) => text(row && (row.created_at || row.requested_at || row.xcreatx));
const doctorName = (order) => text(labelOf(order && order.cosign_user) || labelOf(order && order.vid && order.vid.visit_doctor));
const resultIsFinal = (row) => {
	const status = text(row && row.Status).toUpperCase();
	return status === 'F' || status === 'FINAL' || (!!text(row && row.ResultText) && status !== 'P');
};

const visitId = text(params && (params.visit_id || params.visitId));
if (!validId(visitId)) return { success: false, error: 'invalid_visit_id', message: 'visit_id ไม่ถูกต้อง' };

const visit = await byId(VISIT_COLLECTION, visitId);
if (!visit) return { success: false, error: 'visit_not_found', message: 'ไม่พบ Visit ที่ต้องการดูผล X-ray' };

const hn = text(visit.pid && visit.pid.hn);
const vn = text(visit.vn || (visit.vid && visit.vid.vn));
if (!hn || !vn) return { success: false, error: 'visit_identity_missing', message: 'Visit นี้ไม่มี HN หรือ VN สำหรับอ่านผล X-ray' };

const orders = await findAll(
	ORDER_COLLECTION,
	{ ...activeQuery(), $or: [{ xparentx: { $in: idVariants([visitId]) } }, { 'vid.value': { $in: idVariants([visitId]) } }] },
	{ sort: { created_at: -1, _id: -1 }, limit: MAX_ROWS },
);
const orderIds = orders.map((order) => text(order._id));
if (!orderIds.length) return { success: true, visit_id: visitId, hn, vn, orders: [], read_only: true };

const items = await findAll(
	ITEM_COLLECTION,
	{
		...activeQuery(),
		'service_type.value': XRAY_SERVICE_TYPE,
		$or: [
			{ 'order_id.value': { $in: idVariants(orderIds) } },
			{ xparentx: { $in: idVariants(orderIds) } },
		],
	},
	{ sort: { created_at: 1, item_no: 1, _id: 1 }, limit: MAX_ROWS },
);
if (!items.length) return { success: true, visit_id: visitId, hn, vn, orders: [], read_only: true };

const masterRows = await findAll(
	ITEM_MASTER_COLLECTION,
	{ ...activeQuery(), _id: { $in: idVariants(items.map((item) => refId(item.item_data_id))) } },
	{ limit: MAX_ROWS },
);
const masters = Object.fromEntries(masterRows.map((row) => [text(row._id), row]));
const sectionIds = unique(items.map((item) => sectionRefFrom(item, masters[refId(item.item_data_id)])));
const sectionRows = sectionIds.length
	? await findAll(SECTION_COLLECTION, { ...activeQuery(), _id: { $in: idVariants(sectionIds) } }, { limit: MAX_ROWS })
	: [];
const sections = Object.fromEntries(sectionRows.map((row) => [text(row._id), row]));

const accessions = unique(items.map((item) => item.accession_no));
const currentOutbound = accessions.length
	? await findAll(
		XRAY_ORDER_COLLECTION,
		{ ...activeQuery(), AccessionNo: { $in: accessions } },
		{ sort: { updated_at: -1, created_at: -1, _id: -1 }, limit: MAX_ROWS },
	)
	: [];
const outboundByAccession = {};
currentOutbound.forEach((row) => {
	const accession = text(row.AccessionNo);
	if (accession && (!outboundByAccession[accession] || newer(row, outboundByAccession[accession], ['updated_at', 'created_at', '_id']))) {
		outboundByAccession[accession] = row;
	}
});

const currentResults = accessions.length
	? await findAll(
		XRAY_RESULT_COLLECTION,
		{ ...activeQuery(), AccessionNo: { $in: accessions } },
		{ sort: { ResultDateTime: -1, updated_at: -1, xupdatx: -1, _id: -1 }, limit: MAX_ROWS },
	)
	: [];
const resultByAccession = {};
currentResults.forEach((row) => {
	const accession = text(row.AccessionNo);
	if (accession && (!resultByAccession[accession] || newer(row, resultByAccession[accession]))) resultByAccession[accession] = row;
});

// Resolve the exact Radio Exam code once per current item. Exam name is display-only.
const itemExamCode = {};
items.forEach((item) => {
	const accession = text(item.accession_no);
	const outbound = outboundByAccession[accession] || {};
	itemExamCode[text(item._id)] = text(outbound.ExamUid || item.item_code);
});
const exactExamCodes = unique(Object.values(itemExamCode));

const historicalOutbound = exactExamCodes.length
	? await findAll(
		XRAY_ORDER_COLLECTION,
		{ ...activeQuery(), Hn: hn, ExamUid: { $in: exactExamCodes }, AccessionNo: { $exists: true, $nin: ['', null] } },
		{ sort: { created_at: -1, updated_at: -1, _id: -1 }, limit: MAX_ROWS },
	)
	: [];
const historyOutboundByAccession = {};
historicalOutbound.forEach((row) => {
	const accession = text(row.AccessionNo);
	if (accession && (!historyOutboundByAccession[accession] || newer(row, historyOutboundByAccession[accession], ['updated_at', 'created_at', '_id']))) {
		historyOutboundByAccession[accession] = row;
	}
});
const historicalAccessions = Object.keys(historyOutboundByAccession);
const historicalResults = historicalAccessions.length
	? await findAll(
		XRAY_RESULT_COLLECTION,
		{ ...activeQuery(), Hn: hn, AccessionNo: { $in: historicalAccessions } },
		{ sort: { ResultDateTime: -1, updated_at: -1, xupdatx: -1, _id: -1 }, limit: MAX_ROWS },
	)
	: [];
historicalResults.forEach((row) => {
	const accession = text(row.AccessionNo);
	if (accession && (!resultByAccession[accession] || newer(row, resultByAccession[accession]))) resultByAccession[accession] = row;
});

const historyFor = (examCode, currentAccession) => {
	if (!examCode) return [];
	return Object.keys(historyOutboundByAccession)
		.map((accession) => ({ outbound: historyOutboundByAccession[accession], result: resultByAccession[accession] }))
		.filter((entry) =>
			text(entry.outbound && entry.outbound.ExamUid) === examCode &&
			text(entry.outbound && entry.outbound.AccessionNo) !== currentAccession &&
			entry.result && text(entry.result.ResultText),
		)
		.sort((left, right) => resultTime(right.result).localeCompare(resultTime(left.result)))
		.slice(0, HISTORY_LIMIT)
		.map((entry) => ({
			exam_code: examCode,
			exam_name: text(entry.outbound.ExamName || entry.result.ExamName),
			accession_no: text(entry.outbound.AccessionNo),
			vn: text(entry.outbound.VisitNo),
			result_id: text(entry.result._id),
			result_form_id: XRAY_RESULT_FORM_ID,
			result_text: text(entry.result.ResultText),
			result_status: text(entry.result.Status),
			resulted_at: resultTime(entry.result),
			radiologist_uid: text(entry.result.RadiologistUid),
			severity_uid: text(entry.result.SeverityUid),
			image_captured_at: text(entry.result.ImageCapturedDateTime),
		}));
};

const orderById = Object.fromEntries(orders.map((order) => [text(order._id), order]));
const grouped = {};
items.forEach((item) => {
	const orderId = refId(item.order_id) || text(item.xparentx);
	const order = orderById[orderId];
	if (!order) return;
	const itemId = text(item._id);
	const master = masters[refId(item.item_data_id)] || {};
	const section = sections[sectionRefFrom(item, master)] || {};
	const accession = text(item.accession_no);
	const outbound = outboundByAccession[accession] || {};
	const result = resultByAccession[accession] || null;
	const modality = text(modalityFromMaster(master) || outbound.ModalityTypeUid).toUpperCase();
	const modalityLabel = text(modalityLabelFromMaster(master) || outbound.ModalityTypeName || modality);
	const roomCode = text(section.code || outbound.OrganizationUid || modality || 'XRAY');
	const roomName = text(section.name_th || section.name || section.label || outbound.OrganizationUid || modalityLabel || 'X-ray');
	const roomKey = [roomCode, modality].join('|');
	if (!grouped[orderId]) {
		grouped[orderId] = {
			order_id: orderId,
			order_number: text(order.order_number),
			ordered_at: orderTime(order),
			ordered_by: doctorName(order),
			order_status: text(order.current_status),
			rooms: {},
		};
	}
	if (!grouped[orderId].rooms[roomKey]) {
		grouped[orderId].rooms[roomKey] = { room_code: roomCode, room_name: roomName, modality, modality_label: modalityLabel, items: [] };
	}
	const examCode = itemExamCode[itemId];
	const sameExamHistory = historyFor(examCode, accession);
	grouped[orderId].rooms[roomKey].items.push({
		item_id: itemId,
		item_code: text(item.item_code),
		item_name: text(item.item_name || master.item_name || outbound.ExamName),
		exam_code: examCode,
		exam_name: text(outbound.ExamName || item.item_name || master.item_name),
		accession_no: accession,
		current_status: text(item.current_status),
		result_id: result ? text(result._id) : '',
		result_form_id: XRAY_RESULT_FORM_ID,
		result_status: text(result && result.Status),
		result_text: text(result && result.ResultText),
		resulted_at: resultTime(result),
		radiologist_uid: text(result && result.RadiologistUid),
		severity_uid: text(result && result.SeverityUid),
		image_captured_at: text(result && result.ImageCapturedDateTime),
		is_final: resultIsFinal(result),
		history_count: sameExamHistory.length,
		same_exam_history: sameExamHistory,
	});
});

const responseOrders = Object.values(grouped)
	.map((order) => {
		const rooms = Object.values(order.rooms).map((room) => ({ ...room, item_count: room.items.length }));
		const allItems = rooms.reduce((rows, room) => rows.concat(room.items), []);
		return {
			...order,
			rooms,
			item_count: allItems.length,
			is_final: !!allItems.length && allItems.every((item) => item.is_final),
		};
	})
	.sort((left, right) => text(right.ordered_at).localeCompare(text(left.ordered_at)) || text(right.order_number).localeCompare(text(left.order_number)));

return {
	success: true,
	visit_id: visitId,
	hn,
	vn,
	orders: responseOrders,
	read_only: true,
	history_rule: 'same_hn_exact_exam_code_latest_10',
};
