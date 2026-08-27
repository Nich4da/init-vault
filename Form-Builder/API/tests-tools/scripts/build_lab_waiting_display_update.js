const fs = require('fs');
const path = require('path');

const sourcePath = '/Users/nichada/Documents/lab-ห้องปฏิบัติการ.json';
const outputPath = path.join(
  process.cwd(),
  'lab-ห้องปฏิบัติการ_listview-compact-columns_2026-08-18.json',
);

const form = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const waiting = form.fields?.[1]?.tabs?.[1]?.fields?.[1];
const allOrders = form.fields?.[1]?.tabs?.[0]?.fields?.[0];
const resulted = form.fields?.[1]?.tabs?.[3]?.fields?.[0];
const cancelled = form.fields?.[1]?.tabs?.[4]?.fields?.[0];

if (
  waiting?.id !== 'list-ui-lab-waiting-center-specimen' ||
  waiting?.options?.name !== 'lab_waiting_center_specimen'
) {
  throw new Error('ไม่พบ widget หน้ารอรับตัวล่าสุดตาม id/name ที่คาดไว้');
}
if (
  allOrders?.id !== 'list-ui-lab-all-center-specimen' ||
  allOrders?.options?.name !== 'lab_all_orders_center_specimen'
) {
  throw new Error('ไม่พบ widget รายการรวมตัวล่าสุดตาม id/name ที่คาดไว้');
}
if (
  resulted?.id !== 'vue-ui-lab-resulted' ||
  resulted?.options?.name !== 'lab_resulted_component'
) {
  throw new Error('ไม่พบ widget ออกผลแล้วตัวล่าสุดตาม id/name ที่คาดไว้');
}
if (
  cancelled?.id !== 'list-ui-lab-cancelled-final' ||
  cancelled?.options?.name !== 'lab_cancelled_listview_final'
) {
  throw new Error('ไม่พบ widget รายการปฏิเสธสิ่งส่งตรวจตาม id/name ที่คาดไว้');
}

const replaceOnce = (source, before, after, label) => {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`ไม่พบตำแหน่งแก้ไข: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`ตำแหน่งแก้ไขซ้ำมากกว่าหนึ่งแห่ง: ${label}`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
};

let content = waiting.options.content;
content = replaceOnce(
  content,
  '<el-input :model-value="search" @input="search=$event" clearable placeholder="ค้นหา LAB NO., HN, ชื่อผู้ป่วย หรือห้องต้นทาง" />',
  '<el-input :model-value="search" @input="setSearch" @clear="setSearch(\'\')" clearable placeholder="ค้นหา LAB NO., HN, ชื่อผู้ป่วย หรือห้องต้นทาง" />',
  'controlled search หน้ารอรับ',
);
content = replaceOnce(
  content,
  '<b class="lab-waiting-labno">{{ row.order_number || row.lab_no || \'-\' }}</b>',
  '<div style="display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap;"><b class="lab-waiting-labno">{{ row.order_number || row.lab_no || \'-\' }}</b><span v-if="priorityLabel(row)" :style="priorityStyle(row)">{{ priorityLabel(row) }}</span></div>',
  'ป้าย priority หลัง LAB NO.',
);
content = replaceOnce(
  content,
  '<div><small>เวลารับ</small><b>{{ receivedTime(row) }}</b></div>',
  '<div><small>เวลาสั่ง</small><b>{{ time(row) }}</b></div><div><small>เวลารับ</small><b>{{ receivedTime(row) }}</b></div>',
  'คอลัมน์เวลาสั่ง',
);
content = replaceOnce(
  content,
  '<strong>{{ row.patient_name || \'-\' }} <span v-if="gender(row)" class="lab-waiting-sex">{{ gender(row) }}</span></strong>',
  '<strong><span class="lab-waiting-patient-name">{{ row.patient_name || \'-\' }}</span><span v-if="gender(row)" class="lab-waiting-sex">{{ gender(row) }}</span></strong>',
  'แยกชื่อและป้ายเพศเพื่อไม่ให้ป้ายถูกตัด',
);
content = replaceOnce(
  content,
  '<div v-if="filtered().length" class="lab-waiting-list"><article',
  '<div v-if="filtered().length" class="lab-waiting-list"><div class="lab-waiting-columns" aria-hidden="true"><div>ผู้ป่วย / LAB NO.</div><div></div><div class="lab-waiting-order-head"><span>Specimen</span><span>ห้อง Lab</span><span>เวลาสั่ง</span><span>เวลารับ</span><span>Order</span><span>สถานะ</span></div></div><article',
  'หัวคอลัมน์หน้ารอรับ',
);
[
  ['<div><small>Specimen</small><span>{{ specimens(row) }}</span></div>', '<div><span>{{ specimens(row) }}</span></div>', 'ตัด label Specimen ในแถว'],
  ['<div><small>ห้อง Lab</small><b>{{ organizationName(row) }}</b></div>', '<div><b>{{ organizationName(row) }}</b></div>', 'ตัด label ห้อง Lab ในแถว'],
  ['<div><small>เวลาสั่ง</small><b>{{ time(row) }}</b></div>', '<div><b>{{ time(row) }}</b></div>', 'ตัด label เวลาสั่งในแถว'],
  ['<div><small>เวลารับ</small><b>{{ receivedTime(row) }}</b></div>', '<div><b>{{ receivedTime(row) }}</b></div>', 'ตัด label เวลารับในแถว'],
  ['<div><small>Order</small><span class="lab-status-tag">{{ items(row).length }} รายการ</span></div>', '<div><span class="lab-status-tag">{{ items(row).length }} รายการ</span></div>', 'ตัด label Order ในแถว'],
  ['<div><small>สถานะ</small><span class="lab-status-tag" :style="statusStyle(row)">{{ statusLabel(row) }}</span></div>', '<div><span class="lab-status-tag" :style="statusStyle(row)">{{ statusLabel(row) }}</span></div>', 'ตัด label สถานะในแถว'],
].forEach(([before, after, label]) => {
  content = replaceOnce(content, before, after, label);
});
waiting.options.content = content;

let onCreated = waiting.options.onCreated;
onCreated = replaceOnce(
  onCreated,
  "s.rows=[];s.search='';s.info='';s.loading=false;s.busy={};",
  "s.rows=[];s.search='';s.setSearch=value=>{const next=value&&value.target?value.target.value:value;s.search=next==null?'':String(next)};s.info='';s.loading=false;s.busy={};",
  'setter ช่องค้นหาหน้ารอรับ',
);
onCreated = replaceOnce(
  onCreated,
  'const DEV_ALLOW_EARLY_LAB_ACTIONS=true;',
  'const DEV_ALLOW_EARLY_LAB_ACTIONS=false;',
  'ปิด early Lab actions หลังฟอร์มกลางพร้อมใช้งาน',
);
onCreated = replaceOnce(
  onCreated,
  "s.sourceUnit=row=>{const v=String((row&&(row.source_unit_name||row.sender_unit_name||row.origin_unit_name||row.ward_clinic))||'').trim();return v&&v!=='-'?v:''};",
  "s.sourceUnit=row=>{const v=String((row&&(row.source_unit_name||row.sender_unit_name||row.origin_unit_name||row.ward_clinic))||'').trim();return v&&v!=='-'?v:''};\ns.priority=row=>String((row&&row.priority_status)||'').trim().toLowerCase();\ns.priorityLabel=row=>({urgent:'เร่งด่วน',stat:'STAT'})[s.priority(row)]||'';\ns.priorityStyle=row=>{const base='display:inline-block;padding:1px 7px;border-radius:9px;font-size:10px;font-weight:800;line-height:1.5;white-space:nowrap;';return s.priority(row)==='stat'?base+'background:#fee2e2;color:#dc2626;border:1px solid #fecaca':base+'background:#fff3d8;color:#c2410c;border:1px solid #fed7aa'};",
  'helper แสดง priority',
);
onCreated = replaceOnce(
  onCreated,
  "s.canReceive=row=>{const specimen=String((row&&row.specimen_status)||'').toLowerCase(),work=String((row&&row.work_status)||'').toLowerCase(),readyFromSpecimen=specimen==='sent'||(DEV_ALLOW_EARLY_LAB_ACTIONS&&['waiting','collected'].includes(specimen));if(DEV_EMR_STYLE_RECEIVE_NAVIGATION)return s.isMine(row)&&(readyFromSpecimen||work==='received');return s.isMine(row)&&readyFromSpecimen&&(!work||work==='waiting_receive')};",
  "s.canReceive=row=>{const specimen=String((row&&row.specimen_status)||'').toLowerCase(),work=String((row&&row.work_status)||'').toLowerCase();return s.isMine(row)&&specimen==='sent'&&(!work||work==='waiting_receive'||work==='received')};",
  'แสดงปุ่มสำหรับ sent ทั้งก่อนรับและหลังรับเพื่อกลับเข้ารายการเดิม',
);
onCreated = replaceOnce(
  onCreated,
  "s.statusLabel=row=>{const m={waiting_receive:'รอรับ',received:'รับเข้าแล้ว',processing:'กำลังตรวจ',resulted:'ออกผลแล้ว',completed:'ออกผลครบ',rejected:'ปฏิเสธสิ่งส่งตรวจ',cancelled:'ยกเลิก',waiting:'รอรับ',collected:'รอรับ',sent:'รอรับ'};const specimen=String((row&&row.specimen_status)||'').toLowerCase(),work=String((row&&row.work_status)||'').toLowerCase();if(DEV_EMR_STYLE_RECEIVE_NAVIGATION&&(['waiting','collected','sent'].includes(specimen)||['waiting_receive','received'].includes(work)))return 'รอรับ';return m[s.status(row)]||'รอรับ'};",
  "s.statusLabel=row=>{const m={waiting_receive:'รอรับ',received:'รับเข้าแล้ว',processing:'กำลังตรวจ',resulted:'ออกผลแล้ว',completed:'ออกผลครบ',rejected:'ปฏิเสธสิ่งส่งตรวจ',cancelled:'ยกเลิก',waiting:'รอรับ',collected:'รอรับ',sent:'รอรับ'};return m[s.status(row)]||'รอรับ'};",
  'หน้ารอรับแสดง label ตาม work_status จริง',
);
onCreated = replaceOnce(
  onCreated,
  "s.statusStyle=row=>{const status=s.status(row);return(status==='sent'||status==='waiting_receive'||status==='waiting')?'border:0;border-radius:0;background:#f3f4f6;color:#6b7280':'border:0;border-radius:0'};",
  "s.statusStyle=row=>{const value=s.status(row),base='border:0;border-radius:0;padding:4px 8px;line-height:1.15;';if(['sent','waiting_receive','waiting','collected'].includes(value))return base+'background:#f3f4f6;color:#6b7280';if(value==='received')return base+'background:#e9f8eb;color:#53b447';if(value==='processing')return base+'background:#fef8e8;color:#f2bc42';if(value==='rejected')return base+'background:#fde8e7;color:#df3933';return base};",
  'สีสถานะหน้ารอรับ',
);
waiting.options.onCreated = onCreated;

let allContent = allOrders.options.content;
allContent = replaceOnce(
  allContent,
  '<el-input :model-value="search" @input="search=$event" clearable placeholder="ค้นหา LAB NO., HN, ชื่อผู้ป่วย หรือห้องต้นทาง" />',
  '<el-input :model-value="search" @input="setSearch" @clear="setSearch(\'\')" clearable placeholder="ค้นหา LAB NO., HN, ชื่อผู้ป่วย หรือห้องต้นทาง" />',
  'controlled search หน้ารายการรวม',
);
allContent = replaceOnce(
  allContent,
  '<b style="display:block;font-size:15px;color:#1f2937">{{ row.order_number || row.lab_no || \'-\' }}</b>',
  '<div style="display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap;"><b style="display:block;font-size:15px;color:#1f2937">{{ row.order_number || row.lab_no || \'-\' }}</b><span v-if="priorityLabel(row)" :style="priorityStyle(row)">{{ priorityLabel(row) }}</span></div>',
  'ป้าย priority หลัง LAB NO. ในรายการรวม',
);
allOrders.options.content = allContent;

let allOnCreated = allOrders.options.onCreated;
allOnCreated = replaceOnce(
  allOnCreated,
  "s.rows=[];s.search='';s.info='';s.loading=false;",
  "s.rows=[];s.search='';s.setSearch=value=>{const next=value&&value.target?value.target.value:value;s.search=next==null?'':String(next)};s.info='';s.loading=false;",
  'setter ช่องค้นหาหน้ารายการรวม',
);
allOnCreated = replaceOnce(
  allOnCreated,
  "s.sourceUnit=row=>{const v=s.text(row&&(row.source_unit_name||row.sender_unit_name||row.origin_unit_name||row.ward_clinic));return v&&v!=='-'?v:''};",
  "s.sourceUnit=row=>{const v=s.text(row&&(row.source_unit_name||row.sender_unit_name||row.origin_unit_name||row.ward_clinic));return v&&v!=='-'?v:''};\ns.priority=row=>s.text(row&&row.priority_status).toLowerCase();\ns.priorityLabel=row=>({urgent:'เร่งด่วน',stat:'STAT'})[s.priority(row)]||'';\ns.priorityStyle=row=>{const base='display:inline-block;padding:1px 7px;border-radius:9px;font-size:10px;font-weight:800;line-height:1.5;white-space:nowrap;';return s.priority(row)==='stat'?base+'background:#fee2e2;color:#dc2626;border:1px solid #fecaca':base+'background:#fff3d8;color:#c2410c;border:1px solid #fed7aa'};",
  'helper priority ในรายการรวม',
);
allOnCreated = replaceOnce(
  allOnCreated,
  "s.statusStyle=row=>{const value=s.status(row);return['sent','waiting_receive','waiting'].includes(value)?'border:0;border-radius:0;background:#f3f4f6;color:#6b7280':'border:0;border-radius:0'};",
  "s.statusStyle=row=>{const value=s.status(row),base='border:0;border-radius:0;padding:4px 8px;line-height:1.15;';if(['sent','waiting_receive','waiting','collected'].includes(value))return base+'background:#f3f4f6;color:#6b7280';if(value==='received')return base+'background:#e9f8eb;color:#53b447';if(value==='processing')return base+'background:#fef8e8;color:#f2bc42';if(value==='rejected')return base+'background:#fde8e7;color:#df3933';return base};",
  'สีสถานะหน้ารายการรวม',
);
allOrders.options.onCreated = allOnCreated;

resulted.options.content = `<section class="lab-panel lab-waiting-panel"><div class="lab-panel-head"><div><h2>รายการออกผลแล้ว</h2><p>{{ info || 'โหลดรายการจาก Lab Status' }}</p></div><el-button :loading="loading" @click="load">โหลดใหม่</el-button></div><div class="lab-toolbar lab-waiting-toolbar"><el-input :model-value="search" @input="search=$event" clearable placeholder="ค้นหา LAB NO., HN, ชื่อผู้ป่วย หรือห้องต้นทาง" /></div><div v-if="filtered().length" class="lab-waiting-list"><div class="lab-waiting-columns lab-resulted-columns" aria-hidden="true"><div>ผู้ป่วย / LAB NO.</div><div></div><div class="lab-resulted-order-head"><span>Specimen</span><span>ห้อง Lab</span><span>เวลาสั่ง</span><span>เวลารับ</span><span>Order</span><span>สถานะ</span><span>เวลาออก</span></div></div><article v-for="row in filtered()" :key="row._id||row.id" class="lab-waiting-row lab-resulted-row" tabindex="0"><div class="lab-waiting-patient"><div class="lab-waiting-avatar"><img v-if="photo(row)" :src="photo(row)" alt="รูปผู้ป่วย" /><svg v-else viewBox="0 0 48 48" aria-label="patient"><circle cx="24" cy="16" r="8"></circle><path d="M8 42c1-9 7-15 16-15s15 6 16 15z"></path></svg></div><div class="lab-waiting-identity"><div style="display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap;"><b class="lab-waiting-labno">{{ row.order_number || row.lab_no || '-' }}</b><span v-if="priorityLabel(row)" :style="priorityStyle(row)">{{ priorityLabel(row) }}</span></div><small>HN {{ row.patient_hn || '-' }}</small><strong><span class="lab-waiting-patient-name">{{ row.patient_name || '-' }}</span><span v-if="gender(row)" class="lab-waiting-sex">{{ gender(row) }}</span></strong><small v-if="age(row)">{{ age(row) }}</small></div></div><div class="lab-waiting-context"><span v-if="sourceUnit(row)" class="lab-context-chip source">{{ sourceUnit(row) }}</span><span class="lab-context-chip paid">ชำระเงินแล้ว</span><span v-for="(right,index) in rights(row)" :key="'result-right-'+index" class="lab-context-chip right">{{ right }}</span></div><div class="lab-waiting-order lab-resulted-order"><div><span>{{ specimens(row) }}</span></div><div><b>{{ organizationName(row) }}</b></div><div><b>{{ time(row) }}</b></div><div><b>{{ receivedTime(row) }}</b></div><div><span class="lab-status-tag">{{ items(row).length }} รายการ</span></div><div><span class="lab-status-tag" :style="statusStyle(row)">{{ statusLabel(row) }}</span></div><div><b>{{ completedTime(row) }}</b></div></div><div class="lab-waiting-actions"><div class="lab-hover-action-group"><el-button size="small" type="primary" @click="viewResult(row)">ดูผล</el-button></div></div></article></div><div v-else class="lab-empty"><strong>ไม่พบรายการ</strong><br>รายการจะแสดงหลังจากกดเริ่มดำเนินการ</div></section>`;
resulted.options.content = replaceOnce(
  resulted.options.content,
  '<el-input :model-value="search" @input="search=$event" clearable placeholder="ค้นหา LAB NO., HN, ชื่อผู้ป่วย หรือห้องต้นทาง" />',
  '<el-input :model-value="search" @input="setSearch" @clear="setSearch(\'\')" clearable placeholder="ค้นหา LAB NO., HN, ชื่อผู้ป่วย หรือห้องต้นทาง" />',
  'controlled search หน้าออกผลแล้ว',
);

let resultedOnCreated = resulted.options.onCreated;
resultedOnCreated = replaceOnce(
  resultedOnCreated,
  "s.rows=[];s.search='';s.info='';s.loading=false;",
  "s.rows=[];s.search='';s.setSearch=value=>{const next=value&&value.target?value.target.value:value;s.search=next==null?'':String(next)};s.info='';s.loading=false;",
  'setter ช่องค้นหาหน้าออกผลแล้ว',
);
resultedOnCreated = replaceOnce(
  resultedOnCreated,
  "s.sourceUnit=row=>s.text(row&&(row.source_unit_name||row.sender_unit_name||row.origin_unit_name||row.ward_clinic));",
  "s.sourceUnit=row=>s.text(row&&(row.source_unit_name||row.sender_unit_name||row.origin_unit_name||row.ward_clinic));\ns.priority=row=>s.text(row&&row.priority_status).toLowerCase();\ns.priorityLabel=row=>({urgent:'เร่งด่วน',stat:'STAT'})[s.priority(row)]||'';\ns.priorityStyle=row=>{const base='display:inline-block;padding:1px 7px;border-radius:9px;font-size:10px;font-weight:800;line-height:1.5;white-space:nowrap;';return s.priority(row)==='stat'?base+'background:#fee2e2;color:#dc2626;border:1px solid #fecaca':base+'background:#fff3d8;color:#c2410c;border:1px solid #fed7aa'};\ns.time=row=>{const value=row&&(row.ordered_at||row.requested_at||row.created_at);if(!value)return '-';try{return new Date(value).toLocaleString('th-TH',{hour:'2-digit',minute:'2-digit'})}catch(e){return String(value)}};\ns.receivedTime=row=>{const value=row&&row.received_at;if(!value)return '-';try{return new Date(value).toLocaleString('th-TH',{hour:'2-digit',minute:'2-digit'})}catch(e){return String(value)}};\ns.isComplete=row=>s.text(row&&row.work_status).toLowerCase()==='completed';\ns.completedTime=row=>{if(!s.isComplete(row))return '-';const value=row&&(row.completed_at||row.resulted_at);if(!value)return '-';try{return new Date(value).toLocaleString('th-TH',{hour:'2-digit',minute:'2-digit'})}catch(e){return String(value)}};",
  'helper คอลัมน์หน้าออกผลแล้ว',
);
resultedOnCreated = replaceOnce(
  resultedOnCreated,
  "s.statusLabel=row=>{const status=s.text(row&&row.work_status).toLowerCase(),labels={processing:'กำลังตรวจ',resulted:'ออกผลบางส่วน',completed:'ออกผลครบ'};return labels[status]||status||'-'};",
  "s.statusLabel=row=>{const status=s.text(row&&row.work_status).toLowerCase(),labels={waiting_receive:'รอรับ',waiting:'รอรับ',sent:'รอรับ',collected:'รอรับ',received:'รับเข้าแล้ว',processing:'กำลังตรวจ',resulted:'ออกผลบางส่วน',completed:'ออกผลครบ'};return labels[status]||status||'-'};",
  'ชื่อสถานะหน้าออกผลแล้วใช้ชุดเดียวกัน',
);
resultedOnCreated = replaceOnce(
  resultedOnCreated,
  "s.statusStyle=row=>{const status=s.text(row&&row.work_status).toLowerCase();return status==='completed'?'border:0;border-radius:0;background:#e7f9eb;color:#16aa45':status==='resulted'?'border:0;border-radius:0;background:#fff0df;color:#ef7d1a':'border:0;border-radius:0;background:#fff3d8;color:#a16207'};",
  "s.statusStyle=row=>{const value=s.text(row&&row.work_status).toLowerCase(),base='border:0;border-radius:0;padding:4px 8px;line-height:1.15;';if(['sent','waiting_receive','waiting','collected'].includes(value))return base+'background:#f3f4f6;color:#6b7280';if(value==='received'||value==='completed')return base+'background:#e9f8eb;color:#53b447';if(value==='processing')return base+'background:#fef8e8;color:#f2bc42';if(value==='resulted')return base+'background:#fff0df;color:#ef7d1a';return base};",
  'สีสถานะหน้าออกผลแล้ว',
);
resulted.options.onCreated = resultedOnCreated;

const cancelledStatusValue = cancelled.options.customValue.find(
  item => item.fieldName === 'statusBadgeHtml',
);
if (!cancelledStatusValue) {
  throw new Error('ไม่พบ custom value สถานะของ ListView ยกเลิกรายการ');
}
cancelledStatusValue.expressions = replaceOnce(
  cancelledStatusValue.expressions,
  "rejected:['ยกเลิกรายการ','is-cancelled']",
  "rejected:['ปฏิเสธสิ่งส่งตรวจ','is-cancelled']",
  'ชื่อสถานะปฏิเสธใน ListView',
);
const cancelledValue = fieldName => cancelled.options.customValue.find(
  item => item.fieldName === fieldName,
);
const cancelledOrderedAtValue = cancelledValue('orderedAtLabel');
const cancelledReceivedAtValue = cancelledValue('receivedAtLabel');
const cancelledContextValue = cancelledValue('contextBadgesHtml');
if (!cancelledOrderedAtValue || !cancelledReceivedAtValue || !cancelledContextValue) {
  throw new Error('ไม่พบ custom value เวลา/สิทธิ์ของ ListView ยกเลิกรายการ');
}
for (const timeValue of [cancelledOrderedAtValue, cancelledReceivedAtValue]) {
  timeValue.expressions = replaceOnce(
    timeValue.expressions,
    "+' '+d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})",
    "+'<br>'+d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})",
    'แยกวันที่และเวลาเป็นคนละบรรทัด',
  );
}
cancelledContextValue.expressions = replaceOnce(
  cancelledContextValue.expressions,
  "forEach(function(v){parts.push('<span class=\\\"lab-benefit-badge\\\">'+esc(v)+'</span>')})",
  "forEach(function(v){parts.push('<span class=\\\"lab-benefit-badge lab-rights-badge\\\">'+esc(v)+'</span>')})",
  'ป้ายสิทธิ์การรักษาสีเหลือง',
);
if (!cancelledValue('patientGenderHtml')) {
  cancelled.options.customValue.push({
    fieldName: 'patientGenderHtml',
    expressions: "(function(){var v=String(row.patient_gender||row.gender||row.p_gender||row.patient_sex||'').trim().toLowerCase(),label=['1','m','male','ชาย'].includes(v)?'ชาย':['2','f','female','หญิง'].includes(v)?'หญิง':'';return label?'<span class=\\\"lab-gender-pill\\\">'+label+'</span>':''})()",
  });
}
cancelled.options.detailContent = replaceOnce(
  cancelled.options.detailContent,
  "<div class='lab-worklist-row'>",
  "<div class='lab-worklist-row lab-cancelled-split-row'>",
  'class แถว ListView ยกเลิกรายการ',
);
cancelled.options.detailContent = replaceOnce(
  cancelled.options.detailContent,
  "<div class='lab-worklist-cell'><label>เวลาสั่ง / เวลารับ</label><span>{{orderedAtLabel}}<br>{{receivedAtLabel}}</span></div>",
  "<div class='lab-worklist-cell'><label>เวลาสั่ง</label><span class='lab-cancelled-datetime'>{{orderedAtLabel}}</span></div>\n    <div class='lab-worklist-cell'><label>เวลารับ</label><span class='lab-cancelled-datetime'>{{receivedAtLabel}}</span></div>",
  'แยกคอลัมน์เวลาสั่งและเวลารับ',
);
cancelled.options.detailContent = replaceOnce(
  cancelled.options.detailContent,
  "<div class='lab-worklist-cell'><label>Specimen / ห้อง Lab</label><span>{{specimenLabel}}<br><b>{{sectionLabel}}</b></span></div>",
  "<div class='lab-worklist-cell'><label>Specimen</label><span>{{specimenLabel}}</span></div>\n    <div class='lab-worklist-cell'><label>ห้อง Lab</label><b>{{sectionLabel}}</b></div>",
  'แยกคอลัมน์ specimen และห้อง Lab',
);
cancelled.options.detailContent = replaceOnce(
  cancelled.options.detailContent,
  "<div class='lab-worklist-cell lab-order-cell'><label>Order</label><b class='lab-order-pill'>{{orderCountLabel}}</b></div>",
  "<div class='lab-worklist-cell lab-order-cell'><label>Order</label><span class='lab-status-tag'>{{orderCountLabel}}</span></div>",
  'ป้าย Order สีฟ้าตามแท็บอื่น',
);
cancelled.options.detailContent = replaceOnce(
  cancelled.options.detailContent,
  "<div class='lab-patient-name'>{{patient_name}}</div>",
  "<div class='lab-patient-name lab-cancelled-patient-name'><span>{{patient_name}}</span>{{patientGenderHtml}}</div>",
  'แสดงป้ายเพศข้างชื่อผู้ป่วย',
);

let css = form.formConfig.cssCode;
css = replaceOnce(
  css,
  'grid-template-columns:minmax(235px,1.08fr)',
  'grid-template-columns:minmax(290px,1.22fr)',
  'ขยายคอลัมน์ข้อมูลผู้ป่วยบน desktop',
);
css = replaceOnce(
  css,
  'grid-template-columns:minmax(220px,1.1fr)',
  'grid-template-columns:minmax(250px,1.15fr)',
  'ขยายคอลัมน์ข้อมูลผู้ป่วยบนจอกลาง',
);
css = replaceOnce(
  css,
  '.lab-waiting-identity strong{overflow:hidden;color:#374151;font-size:14px;text-overflow:ellipsis;white-space:nowrap}.lab-waiting-sex{display:inline-block;margin-left:5px;padding:2px 7px;border-radius:10px;background:#e9f8df;color:#4fa62a;font-size:11px}',
  '.lab-waiting-identity strong{display:flex;align-items:center;gap:5px;min-width:0;color:#374151;font-size:14px}.lab-waiting-patient-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lab-waiting-sex{display:inline-block;flex:none;margin-left:0;padding:2px 7px;border-radius:10px;background:#e9f8df;color:#4fa62a;font-size:11px}',
  'คงป้ายเพศไว้แม้ชื่อผู้ป่วยยาว',
);
css = replaceOnce(
  css,
  'minmax(410px,1.35fr)',
  'minmax(500px,1.52fr)',
  'ขยายพื้นที่ metadata สำหรับคอลัมน์เวลาเพิ่ม',
);
css = replaceOnce(
  css,
  'minmax(290px,1.22fr) minmax(185px,.78fr) minmax(500px,1.52fr) 184px',
  'minmax(290px,1.22fr) minmax(165px,.68fr) minmax(500px,1.52fr)',
  'นำปุ่มออกจาก grid บน desktop',
);
css = replaceOnce(
  css,
  'minmax(250px,1.15fr) minmax(165px,.76fr) minmax(300px,1.1fr) 174px',
  'minmax(250px,1.15fr) minmax(150px,.65fr) minmax(430px,1.25fr)',
  'นำปุ่มออกจาก grid บนจอกลาง',
);
css = replaceOnce(
  css,
  'grid-template-columns:minmax(220px,1fr) minmax(190px,.84fr) 174px',
  'grid-template-columns:minmax(250px,1fr) minmax(190px,.84fr)',
  'นำปุ่มออกจาก grid บน responsive workspace',
);
css = replaceOnce(
  css,
  '.lab-hover-action-group{display:flex;justify-content:flex-end;gap:6px;min-width:170px;opacity:0;pointer-events:none;visibility:hidden;transition:opacity .12s ease}',
  '.lab-hover-action-group{display:flex;justify-content:flex-end;gap:6px;width:max-content;white-space:nowrap;opacity:0;pointer-events:none;visibility:hidden;transition:opacity .12s ease}',
  'จัดปุ่มเป็น overlay แถวเดียว',
);
css = replaceOnce(
  css,
  '.lab-waiting-row{display:grid;',
  '.lab-waiting-row{position:relative;display:grid;',
  'กำหนดกรอบอ้างอิงสำหรับปุ่ม overlay',
);
css = replaceOnce(
  css,
  '.lab-waiting-order>div{display:grid;min-width:0;gap:3px}',
  '.lab-waiting-order>div{display:flex;align-items:center;min-width:0}',
  'จัดค่าของแต่ละคอลัมน์หลังตัด label ซ้ำ',
);
css = replaceOnce(
  css,
  '.lab-waiting-actions{display:flex;justify-content:flex-end;min-width:0}',
  '.lab-waiting-actions{position:absolute;top:10px;right:12px;z-index:5;display:flex;justify-content:flex-end;min-width:0}',
  'วางปุ่มมุมขวาบนของแถว',
);
css = replaceOnce(
  css,
  '.lab-waiting-order{grid-column:1 / span 2;grid-row:2}.lab-waiting-actions{grid-column:3;grid-row:1 / span 2}',
  '.lab-waiting-order{grid-column:1 / -1;grid-row:2}.lab-waiting-actions{top:10px;right:12px}',
  'จัด responsive โดยไม่จองคอลัมน์ให้ปุ่ม',
);
css = replaceOnce(
  css,
  '.lab-waiting-actions{justify-content:flex-start}.lab-hover-action-group{opacity:1;',
  '.lab-waiting-actions{top:8px;right:10px}.lab-hover-action-group{opacity:1;',
  'คงปุ่ม overlay บนมือถือ',
);
css = replaceOnce(
  css,
  '.lab-waiting-list{display:grid;gap:0;border-top:1px solid #e7ebf1}',
  '.lab-waiting-list{display:grid;gap:0;border-top:1px solid #e7ebf1}.lab-waiting-columns{display:grid;grid-template-columns:minmax(290px,1.22fr) minmax(165px,.68fr) minmax(500px,1.52fr);align-items:center;gap:14px;padding:12px 20px;border-bottom:1px solid #e7ebf1;background:#f8fafc;color:#667085;font-size:12px;font-weight:700}.lab-waiting-order-head{display:grid;grid-template-columns:minmax(80px,1.05fr) minmax(82px,1.05fr) 58px 58px 78px minmax(100px,1.25fr);gap:8px;min-width:0}.lab-waiting-order-head span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  'หัวคอลัมน์ desktop',
);
css = replaceOnce(
  css,
  '@media(max-width:1380px){.lab-waiting-row{',
  '@media(max-width:1380px){.lab-waiting-columns{grid-template-columns:minmax(250px,1.15fr) minmax(150px,.65fr) minmax(430px,1.25fr);gap:10px;padding:11px 14px}.lab-waiting-order-head{grid-template-columns:1fr 1fr 54px 54px 70px;gap:6px}.lab-waiting-order-head span:last-child{display:none}.lab-waiting-row{',
  'หัวคอลัมน์จอกลาง',
);
css = replaceOnce(
  css,
  '@media(max-width:1040px){.lab-waiting-row{',
  '@media(max-width:1040px){.lab-waiting-columns{grid-template-columns:minmax(250px,1fr) minmax(190px,.84fr)}.lab-waiting-order-head{grid-column:1 / -1;grid-row:2}.lab-waiting-row{',
  'หัวคอลัมน์ responsive workspace',
);
css = replaceOnce(
  css,
  '@media(max-width:720px){.lab-waiting-row{',
  '@media(max-width:720px){.lab-waiting-columns{display:none}.lab-waiting-row{',
  'ซ่อนหัวคอลัมน์บนมือถือ',
);
css = replaceOnce(
  css,
  'grid-template-columns:minmax(80px,1.05fr) minmax(82px,1.05fr) 58px 78px minmax(100px,1.25fr)',
  'grid-template-columns:minmax(80px,1.05fr) minmax(82px,1.05fr) 58px 58px 78px minmax(100px,1.25fr)',
  'grid desktop หกคอลัมน์',
);
css = replaceOnce(
  css,
  '.lab-waiting-order{grid-template-columns:1fr 1fr 54px 70px;gap:6px}',
  '.lab-waiting-order{grid-template-columns:1fr 1fr 54px 54px 70px;gap:6px}',
  'grid responsive ห้าคอลัมน์หลังซ่อนสถานะ',
);
css += '.lab-resulted-columns,.lab-resulted-row{grid-template-columns:minmax(290px,1.22fr) minmax(165px,.68fr) minmax(560px,1.75fr)}.lab-resulted-order-head,.lab-resulted-order{display:grid;grid-template-columns:minmax(80px,1.1fr) minmax(82px,1.05fr) 54px 54px 76px minmax(82px,1fr) 58px;gap:8px;min-width:0;align-items:center}.lab-resulted-order-head span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lab-resulted-order>div{display:flex!important;align-items:center;min-width:0}.lab-resulted-order>div:last-child{display:flex!important}@media(max-width:1380px){.lab-resulted-columns,.lab-resulted-row{grid-template-columns:minmax(250px,1.15fr) minmax(150px,.65fr) minmax(500px,1.5fr)}.lab-resulted-order-head,.lab-resulted-order{grid-template-columns:minmax(72px,1fr) minmax(75px,1fr) 48px 48px 64px minmax(72px,1fr) 50px;gap:6px}.lab-resulted-order-head span:last-child{display:block}}@media(max-width:1040px){.lab-resulted-columns,.lab-resulted-row{grid-template-columns:minmax(250px,1fr) minmax(190px,.84fr)}.lab-resulted-order-head,.lab-resulted-order{grid-column:1 / -1;grid-row:2}}@media(max-width:720px){.lab-resulted-order{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px}}';
css += '.lab-waiting-columns:not(.lab-resulted-columns),.lab-waiting-row:not(.lab-resulted-row){grid-template-columns:minmax(300px,340px) minmax(190px,260px) minmax(500px,1fr)}.lab-waiting-labno{font-size:15px}.lab-waiting-identity small{font-size:11px;line-height:1.3}.lab-waiting-identity strong{font-size:13px;font-weight:600}.lab-waiting-order>div>b,.lab-waiting-order>div>span:not(.lab-status-tag){font-size:13px;line-height:1.35}.lab-waiting-order>div:first-child{align-items:flex-start}.lab-waiting-order>div:first-child>span{overflow:visible;text-overflow:clip;white-space:normal;overflow-wrap:anywhere;word-break:normal}.lab-table tbody td:nth-child(4),.lab-table tbody td:nth-child(5),.lab-table tbody td:nth-child(6){font-size:13px;line-height:1.35}@media(max-width:1380px){.lab-waiting-columns:not(.lab-resulted-columns),.lab-waiting-row:not(.lab-resulted-row){grid-template-columns:minmax(250px,300px) minmax(160px,220px) minmax(430px,1fr)}}@media(max-width:1040px){.lab-waiting-columns:not(.lab-resulted-columns),.lab-waiting-row:not(.lab-resulted-row){grid-template-columns:minmax(250px,300px) minmax(190px,1fr)}}@media(max-width:720px){.lab-waiting-row:not(.lab-resulted-row){grid-template-columns:minmax(0,1fr)}}';
css += '.lab-cancelled-split-row{grid-template-columns:56px 220px 210px 90px 90px 115px 125px 135px 75px;gap:5px;padding-right:8px}.lab-cancelled-split-row .lab-cancelled-datetime{line-height:1.4;white-space:normal}.lab-cancelled-split-row .lab-status-pill,.lab-cancelled-split-row .lab-status-tag{align-self:flex-start;padding:4px 8px;border:0!important;border-radius:0!important;box-shadow:none!important;font-size:12px;line-height:1.25;white-space:nowrap!important}.lab-cancelled-split-row .lab-status-tag{background:#eff6ff;color:#2563eb!important}.lab-cancelled-split-row .lab-status-cell{overflow:visible}.lab-cancelled-split-row .lab-context-badge,.lab-cancelled-split-row .lab-benefit-badge{border:0!important;border-radius:0!important;box-shadow:none!important}.lab-cancelled-patient-name{display:flex;align-items:center;gap:5px;min-width:0}.lab-cancelled-patient-name>span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lab-gender-pill{display:inline-block;flex:none;padding:2px 7px;border-radius:10px;background:#e9f8df;color:#4fa62a!important;font-size:11px!important;font-weight:700;line-height:1.35;white-space:nowrap}.lab-rights-badge{background:#fff3d5!important;color:#a16207!important;border-color:transparent!important}@media(max-width:1280px){.lab-cancelled-split-row{grid-template-columns:50px minmax(165px,205px) minmax(145px,180px) 82px 82px 100px 105px 130px 72px;gap:4px;padding-right:6px}}@media(max-width:820px){.lab-cancelled-split-row{grid-template-columns:50px minmax(0,1fr);gap:10px;padding:10px}.lab-cancelled-split-row .lab-status-pill,.lab-cancelled-split-row .lab-status-tag{white-space:normal!important}}';
form.formConfig.cssCode = css;

fs.writeFileSync(outputPath, `${JSON.stringify(form, null, 2)}\n`, 'utf8');
process.stdout.write(`${outputPath}\n`);
