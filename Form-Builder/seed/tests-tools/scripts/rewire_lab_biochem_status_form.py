# -*- coding: utf-8 -*-
import json
import re
from pathlib import Path


PATH = Path('Lab_Biochem_initCraft_import.json')
CENTER_LAB_FORM_ID = '6a75a7810796231c653df996'
STATUS_FORM_ID = '6a7daa3e8d398c11cf2fe869'
STATUS_PROCESS_ID = '6a7e787e8d398c11cf2fe8b8'
REJECTION_FORM_ID = '6a7713fdcc7d0a8451130331'
REJECT_PROCESS_ID = '6a79ff46d5218a5b6a26bebc'

RECHECK_BUTTON = {
    'label': 'ตรวจซ้ำ',
    'type': 'primary',
    'plain': False,
    'confirm': False,
    'onClick': """const text=value=>{if(value==null)return '';if(typeof value==='object')return text(value.$oid||value._id||value.id||value.value||'');return String(value).trim()};const host=this.getFormRef&&this.getFormRef(),api=(host&&host.userState)||this.globalUserState,id=text(dataRow&&((dataRow._id!==undefined&&dataRow._id)||dataRow.id)),orderNumber=text(dataRow&&(dataRow.order_number||dataRow.lab_no)),sectionCode=text(dataRow&&dataRow.section_code);if(!id||!api||typeof api.runProcess!=='function'){this.notify('ไม่พบ API connector สำหรับตรวจซ้ำ','error',3500);return}api.runProcess('6a79ff46d5218a5b6a26bebc',{source_order_id:id,action:'recheck',order_number:orderNumber,section_code:sectionCode},res=>{const body=(res&&res.data)||res||{};if(body.success===false){this.notify(body.message||'ย้ายรายการกลับหน้ารอรับไม่สำเร็จ','error',4000);return}this.notify(body.message||'ย้ายรายการกลับหน้ารอรับแล้ว','success',2500);const current=this.getFieldEditor&&this.getFieldEditor();if(current&&typeof current.handleRefresh==='function')current.handleRefresh();['lab_waiting_center_specimen','lab_all_orders_center_specimen'].forEach(name=>{const ref=host&&host.getFieldRef&&host.getFieldRef(name);if(ref&&ref.vueState&&typeof ref.vueState.load==='function')ref.vueState.load()})},err=>this.notify(String((err&&err.message)||err||'ย้ายรายการกลับหน้ารอรับไม่สำเร็จ'),'error',4000))"""
}

# The cancelled ListView reads zdata_specimen_collection_status directly.
# Keep every display value on the Status schema so rejecting a row changes
# only work_status; it must not make the original patient/order data vanish.
CANCELLED_CUSTOM_VALUES = [
    {'fieldName': 'labNoLabel', 'expressions': "row.order_number||row.lab_no||'LAB NO. รอกำหนด'"},
    {'fieldName': 'patientAvatarHtml', 'expressions': "(function(){function esc(v){return String(v==null?'':v).replace(/[&<>\\\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\\\"':'&quot;'}[c]})}var name=String(row.patient_name||row.patient_hn||'?').trim(),initial=name?name.charAt(0).toUpperCase():'?',url=String(row.patient_photo_url||row.patient_photo||row.photo_url||row.avatar_url||'').trim();return /^(https?:\\/\\/|data:image\\/)/i.test(url)?'<img src=\\\"'+esc(url)+'\\\" alt=\\\"รูปผู้ป่วย\\\" style=\\\"width:100%;height:100%;object-fit:cover\\\">':'<span>'+esc(initial)+'</span>'})()"},
    {'fieldName': 'patientAgeLabel', 'expressions': "(function(){var raw=String(row.patient_birth_date||row.birth_date||'').trim(),birth=null,parts=raw.match(/^(\\d{1,2})[\\/.-](\\d{1,2})[\\/.-](\\d{4})$/);if(parts){var year=Number(parts[3]);if(year>2400)year-=543;birth=new Date(year,Number(parts[2])-1,Number(parts[1]))}else if(raw){var parsed=new Date(raw);if(!isNaN(parsed.getTime()))birth=parsed}if(!birth||isNaN(birth.getTime()))return row.patient_age?'อายุ '+row.patient_age+' ปี':'';var now=new Date(),years=now.getFullYear()-birth.getFullYear(),months=now.getMonth()-birth.getMonth(),days=now.getDate()-birth.getDate();if(days<0){months--;days+=new Date(now.getFullYear(),now.getMonth(),0).getDate()}if(months<0){years--;months+=12}return years>=0?'อายุ '+years+' ปี '+months+' เดือน '+days+' วัน':''})()"},
    {'fieldName': 'orderedAtLabel', 'expressions': "(function(){var v=row.ordered_at||row.requested_at||row.created_at;if(!v)return '-';var d=new Date(v);if(isNaN(d))return String(v);return d.toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit'})+' '+d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})})()"},
    {'fieldName': 'receivedAtLabel', 'expressions': "(function(){var v=row.received_at;if(!v)return '-';var d=new Date(v);if(isNaN(d))return String(v);return d.toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit'})+' '+d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})})()"},
    {'fieldName': 'contextBadgesHtml', 'expressions': "(function(){function esc(v){return String(v==null?'':v).replace(/[&<>\\\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\\\"':'&quot;'}[c]})}function text(v){if(v==null)return '';if(typeof v==='object')return String((v.inscl_item_main&&(v.inscl_item_main.value||v.inscl_item_main.label))||v.label||v.value||v.name||'').trim();return String(v).trim()}var source=text(row.source_unit_name||row.sender_unit_name||row.origin_unit_name||row.ward_clinic),raw=row.inscl_hos_json!==undefined?row.inscl_hos_json:(row.treatment_right||row.insurance_right||row.inscl_code||row.inscl_name||[]),rights=[];try{rights=Array.isArray(raw)?raw:(typeof raw==='string'&&raw.trim().charAt(0)==='['?JSON.parse(raw):[raw])}catch(e){rights=[raw]}var payment=text(row.payment_status),seen={},parts=[];if(source&&source!=='-')parts.push('<span class=\\\"lab-context-badge\\\">'+esc(source)+'</span>');rights.map(text).filter(function(v){if(!v||v==='-'||seen[v])return false;seen[v]=1;return true}).forEach(function(v){parts.push('<span class=\\\"lab-benefit-badge\\\">'+esc(v)+'</span>')});if(payment&&payment!=='-')parts.push('<span class=\\\"lab-benefit-badge\\\">'+esc(payment)+'</span>');return parts.join('')})()"},
    {'fieldName': 'sectionLabel', 'expressions': "(function(){var code=String(row.section_code||'').trim().toUpperCase(),names={'10':'Biochemistry','20':'Hematology','21':'Clinical Microscopy Laboratory','22':'Hematology-Homeostasis','30':'Immunology','31':'Immunology-ส่งนอกรพ.','40':'Microbiology','41':'Mycology','50':'Blood Bank','70':'Biomolecular and Genetics','BC':'Biochemistry','HM':'Hematology','ML':'Clinical Microscopy Laboratory','HH':'Hematology-Homeostasis','IM':'Immunology','MI-OUT':'Immunology-ส่งนอกรพ.','MB':'Microbiology','MY':'Mycology','BB':'Blood Bank','BG':'Biomolecular and Genetics'};return names[code]||row.section_name||code||'-'})()"},
    {'fieldName': 'specimenLabel', 'expressions': "(function(){function arr(v){try{var x=typeof v==='string'?JSON.parse(v||'[]'):(v||[]);return Array.isArray(x)?x:[]}catch(e){return []}}var rows=arr(row.specimens);if(!rows.length)rows=arr(row.specimen_records_json);if(!rows.length)rows=arr(row.selected_items).map(function(i){return {label:i.specimen_name||(i.c_specimen&&(i.c_specimen.label||i.c_specimen.specimen_name))||'',specimen_code:i.specimen_code||(i.c_specimen&&i.c_specimen.specimen_code)||''}});var seen={};return rows.map(function(x){var v=String((x&&(x.label||x.specimen_name||x.specimen_code||x.code))||'').trim();if(!v||seen[v])return '';seen[v]=1;return v}).filter(Boolean).join(' · ')||'-'})()"},
    {'fieldName': 'orderCountLabel', 'expressions': "(function(){function arr(v){try{var x=typeof v==='string'?JSON.parse(v||'[]'):(v||[]);return Array.isArray(x)?x:[]}catch(e){return []}}var rows=arr(row.selected_items);if(!rows.length)rows=arr(row.selected_items_json);return (rows.length||Number(row.order_count)||0)+' รายการ'})()"},
    {'fieldName': 'statusBadgeHtml', 'expressions': "(function(){var s=String(row.work_status||row.central_specimen_status||row.order_status||'rejected').toLowerCase(),m={waiting_receive:['รอรับ','is-waiting'],received:['รับเข้าแล้ว','is-received'],processing:['กำลังตรวจ','is-progress'],resulted:['ออกผลบางส่วน','is-partial'],completed:['ออกผลครบ','is-completed'],rejected:['ยกเลิกรายการ','is-cancelled']},x=m[s]||[s||'-','is-default'];return '<span class=\\\"lab-status-pill '+x[1]+'\\\">'+x[0]+'</span>'})()"},
]

CANCELLED_DETAIL = """<div class='lab-worklist-row'>
  <div class='lab-patient-avatar'>{{patientAvatarHtml}}</div>
  <div class='lab-patient-summary'>
    <div class='lab-lab-no'>{{labNoLabel}}</div>
    <div class='lab-hn'>HN {{patient_hn}}</div>
    <div class='lab-patient-name'>{{patient_name}}</div>
    <div class='lab-hn'>{{patientAgeLabel}}</div>
  </div>
  <div class='lab-context-badges'>{{contextBadgesHtml}}</div>
  <div class='lab-worklist-meta'>
    <div class='lab-worklist-cell'><label>เวลาสั่ง / เวลารับ</label><span>{{orderedAtLabel}}<br>{{receivedAtLabel}}</span></div>
    <div class='lab-worklist-cell'><label>Specimen / ห้อง Lab</label><span>{{specimenLabel}}<br><b>{{sectionLabel}}</b></span></div>
    <div class='lab-worklist-cell lab-status-cell'><label>สถานะ</label>{{statusBadgeHtml}}</div>
    <div class='lab-worklist-cell lab-order-cell'><label>Order</label><b class='lab-order-pill'>{{orderCountLabel}}</b></div>
  </div>
</div>"""

SECTION_BY_ORG = "{'10':'BC','20':'HM','21':'ML','22':'HH','30':'IM','31':'MI-OUT','40':'MB','41':'MY','50':'BB','70':'BG'}"
# Temporary parallel-development switch.  Keep this in sync with
# DEV_ALLOW_EARLY_LAB_ACTIONS in specimen-collection-status-api.js.  It lets
# the Lab team exercise receive/reject before the separate Specimen approve
# screen is delivered, and makes that exceptional state visible in the UI.
DEV_ALLOW_EARLY_LAB_ACTIONS = True


def walk(nodes):
    if isinstance(nodes, dict):
        yield nodes
        for value in nodes.values():
            yield from walk(value)
    elif isinstance(nodes, list):
        for value in nodes:
            yield from walk(value)


def all_orders_script():
    """Build the read-only all-orders queue from LabCen, the source of truth.

    A Status row is optional here.  When one exists it contributes workflow
    state and LAB NO.; when it does not, the LabCen section still appears.
    Receive/edit/audit widgets continue to use Status and are not changed by
    this script.
    """
    script = r"""const s=this.vueState;const field=this;
const CENTER_PROVIDER={providerId:'__CENTER_FORM_ID__',providerType:'FORM',params:{},options:{limit:5000,page:1}};
const STATUS_PROVIDER={providerId:'__STATUS_FORM_ID__',providerType:'FORM',params:{},options:{limit:5000,page:1}};
s.rows=[];s.search='';s.info='';s.loading=false;
s.extract=out=>{const picks=[out,out&&out.data,out&&out.rows,out&&out.data&&out.data.data,out&&out.reply&&out.reply.data];for(let i=0;i<picks.length;i++){if(Array.isArray(picks[i]))return picks[i]}return []};
s.asArray=value=>{try{const parsed=typeof value==='string'?JSON.parse(value||'[]'):(value||[]);return Array.isArray(parsed)?parsed:[]}catch(e){return []}};
s.text=value=>{if(value==null)return '';if(typeof value==='object')return s.text(value.$oid||value._id||value.id||value.value||value.code||value.label||value.name||'');return String(value).trim()};
s.sectionOf=row=>({code:s.text(row&&(row.section_code||row.sectionCode||row.lab_section||row.section||row.unit_code||row.unit)),name:s.text(row&&(row.section_name||row.sectionName||row.lab_name||row.unit_name))});
s.groupOrderNumber=(group,items)=>{const direct=s.text(group&&(group.order_number||group.lab_no||group.orderNumber||group.labNo));if(direct)return direct;const numbers=[];(items||[]).forEach(item=>{const value=s.text(item&&(item.order_number||item.lab_no||item.orderNumber||item.labNo));if(value&&numbers.indexOf(value)===-1)numbers.push(value)});return numbers.length===1?numbers[0]:''};
s.itemSpecimens=(sectionCode,items)=>{const seen={};return(items||[]).map(item=>{const row=item||{},spec=row.c_specimen||row.specimen||{},code=s.text(spec.specimen_code||spec.code||row.specimen_code),label=s.text(spec.label||spec.specimen_name||row.specimen_name||code),key=code+'|'+label;if(!label||seen[key])return null;seen[key]=true;return{section_code:sectionCode,specimen_code:code,label}}).filter(Boolean)};
s.normalizeGroups=center=>{const list=s.asArray(center&&(center.selected_items_json||center.selected_items));const grouped=list.length>0&&list.every(row=>row&&Object.prototype.hasOwnProperty.call(row,'selected_items'));let groups=[];if(grouped){groups=list.map(row=>{const items=s.asArray(row.selected_items),direct=s.sectionOf(row),fallback=s.sectionOf(items[0]),code=direct.code||fallback.code,name=direct.name||fallback.name;return{...row,section_code:code,section_name:name,order_number:s.groupOrderNumber(row,items),selected_items:items,specimens:s.asArray(row.specimens)}})}else{const bySection={},order=[];list.forEach(item=>{const section=s.sectionOf(item),key=section.code||section.name||'UNASSIGNED';if(!bySection[key]){bySection[key]={section_code:section.code,section_name:section.name,selected_items:[]};order.push(key)}bySection[key].selected_items.push(item)});groups=order.map(key=>{const group=bySection[key];return{...group,order_number:s.groupOrderNumber(group,group.selected_items),specimens:[]}})}if(!groups.length){const section=s.sectionOf(center);groups=[{section_code:section.code,section_name:section.name,order_number:s.groupOrderNumber(center,[]),selected_items:[],specimens:[]}]}return groups};
s.centerSpecimens=(center,group)=>{let rows=s.asArray(group&&group.specimens);if(rows.length)return rows;const section=s.text(group&&group.section_code).toUpperCase(),records=s.asArray(center&&(center.specimen_records_json||center.specimens||center.specimen_json));rows=records.filter(row=>{const code=s.text(row&&(row.section_code||row.sectionCode)).toUpperCase();return !section||!code||code===section}).map(row=>{const code=s.text(row&&(row.specimen_code||row.code)),label=s.text(row&&(row.label||row.specimen_name||row.name||code));return{...row,specimen_code:code,label}}).filter(row=>row.label||row.specimen_code);return rows.length?rows:s.itemSpecimens(section,s.asArray(group&&group.selected_items))};
s.centerRows=center=>{const centerId=s.text(center&&(center._id||center.id||center.dataid));return s.normalizeGroups(center).map((group,index)=>{const section=s.sectionOf(group),sourceCode=s.text(center&&(center.source_unit_code||center.ward_clinic_code)),sourceName=s.text(center&&(center.source_unit_name||center.ward_clinic||center.sender_unit_name));return{...center,_id:(centerId||'center')+'::'+(section.code||index),center_source_id:centerId,center_order_id:centerId,section_code:section.code,section_name:section.name||section.code||'ไม่ระบุห้อง Lab',order_number:s.groupOrderNumber(group,s.asArray(group.selected_items)),selected_items:s.asArray(group.selected_items),specimens:s.centerSpecimens(center,group),source_unit_code:sourceCode,source_unit_name:sourceName,ordered_at:center.ordered_at||center.requested_at||center.created_at,specimen_status:center.specimen_status||'waiting',work_status:center.work_status||''}})};
s.matchKey=row=>s.text(row&&(row.center_order_id||row.center_lab_order_id))+'|'+s.text(row&&row.section_code).toUpperCase();
s.merge=(centers,statuses)=>{const statusByKey={},statusByNumber={},used={};statuses.forEach(row=>{const key=s.matchKey(row),number=s.text(row&&(row.order_number||row.lab_no));if(key!=='|'&&!statusByKey[key])statusByKey[key]=row;if(number&&!statusByNumber[number])statusByNumber[number]=row});const merged=[];centers.forEach(center=>{s.centerRows(center).forEach(base=>{const key=s.matchKey(base),number=s.text(base.order_number),status=statusByKey[key]||(number&&statusByNumber[number])||null;if(!status){merged.push(base);return}const statusId=s.text(status._id||status.id),row={...base,...status};row._id=statusId||base._id;row.center_source_id=base.center_source_id;row.center_order_id=base.center_order_id;row.section_code=base.section_code||status.section_code;row.section_name=base.section_name||status.section_name;row.order_number=s.text(status.order_number||status.lab_no)||base.order_number;row.selected_items=base.selected_items;row.specimens=base.specimens;row.ordered_at=base.ordered_at||status.ordered_at||status.created_at;row.source_unit_code=base.source_unit_code||status.source_unit_code;row.source_unit_name=base.source_unit_name||status.source_unit_name;['patient_hn','patient_name','patient_gender','patient_birth_date','patient_photo','patient_photo_url','visit_id','visit_id_link','visit_vn','inscl_hos_json','treatment_right','insurance_right'].forEach(name=>{if(base[name]!==undefined&&base[name]!==null&&base[name]!=='')row[name]=base[name]});merged.push(row);if(statusId)used[statusId]=true})});statuses.forEach(row=>{const id=s.text(row._id||row.id);if(!id||!used[id])merged.push(row)});return merged.sort((a,b)=>{const av=new Date(a.ordered_at||a.requested_at||a.created_at||0).getTime()||0,bv=new Date(b.ordered_at||b.requested_at||b.created_at||0).getTime()||0;return bv-av})};
s.organizationName=row=>{const names={'10':'Biochemistry','20':'Hematology','22':'Hematology','21':'Clinical Microscopy Laboratory','30':'Immunology','31':'Immunology-ส่งนอกรพ.','40':'Microbiology','41':'Mycology','50':'Blood Bank','70':'Biomolecular and Genetics','BC':'Biochemistry','HM':'Hematology','HH':'Hematology-Homeostasis','ML':'Clinical Microscopy Laboratory','IM':'Immunology','MI-OUT':'Immunology-ส่งนอกรพ.','MB':'Microbiology','MY':'Mycology','BB':'Blood Bank','BG':'Biomolecular and Genetics'};return names[s.text(row&&row.section_code).toUpperCase()]||s.text(row&&row.section_name)||'-'};
s.items=row=>s.asArray(row&&row.selected_items);
s.specimens=row=>{const seen={};return s.asArray(row&&row.specimens).map(x=>s.text(x&&(x.label||x.specimen_name||x.specimen_code||x.code))).filter(x=>x&&!seen[x]&&(seen[x]=true)).join(' · ')||'-'};
s.rights=row=>{const raw=(row&&((row.inscl_hos_json!==undefined&&row.inscl_hos_json)||row.treatment_right||row.insurance_right||row.inscl_name||row.inscl_code||row.inscl_hos))||[];let list=[];try{list=Array.isArray(raw)?raw:(typeof raw==='string'&&raw.trim().charAt(0)==='['?JSON.parse(raw):[raw])}catch(e){list=[raw]}const seen={};return list.map(x=>{if(x&&typeof x==='object')return s.text((x.inscl_item_main&&(x.inscl_item_main.value||x.inscl_item_main.label))||x.label||x.value||x.name);return s.text(x)}).filter(x=>x&&x!=='-'&&!seen[x]&&(seen[x]=true))};
s.gender=row=>{const v=s.text(row&&(row.patient_gender||row.gender||row.p_gender)).toLowerCase();return['1','m','male','ชาย'].includes(v)?'ชาย':['2','f','female','หญิง'].includes(v)?'หญิง':''};
s.age=row=>{const raw=s.text(row&&(row.patient_birth_date||row.birth_date));let birth=null;const parts=raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);if(parts){let year=Number(parts[3]);if(year>2400)year-=543;birth=new Date(year,Number(parts[2])-1,Number(parts[1]))}else if(raw){const parsed=new Date(raw);if(!Number.isNaN(parsed.getTime()))birth=parsed}if(!birth||Number.isNaN(birth.getTime())){const years=s.text(row&&row.patient_age);return years?'อายุ '+years+' ปี':''}const now=new Date();let years=now.getFullYear()-birth.getFullYear(),months=now.getMonth()-birth.getMonth(),days=now.getDate()-birth.getDate();if(days<0){months--;days+=new Date(now.getFullYear(),now.getMonth(),0).getDate()}if(months<0){years--;months+=12}return years>=0?'อายุ '+years+' ปี '+months+' เดือน '+days+' วัน':''};
s.photo=row=>s.text(row&&(row.patient_photo_url||row.patient_photo||row.photo_url||row.avatar_url));
s.sourceUnit=row=>{const v=s.text(row&&(row.source_unit_name||row.sender_unit_name||row.origin_unit_name||row.ward_clinic));return v&&v!=='-'?v:''};
s.time=row=>{const v=row&&(row.ordered_at||row.requested_at||row.created_at);if(!v)return '-';try{return new Date(v).toLocaleString('th-TH',{hour:'2-digit',minute:'2-digit'})}catch(e){return String(v)}};
s.status=row=>{const work=s.text(row&&row.work_status).toLowerCase(),specimen=s.text(row&&row.specimen_status).toLowerCase();return work||specimen||'waiting'};
s.statusLabel=row=>{const m={waiting_receive:'รอรับ',received:'รับเข้าแล้ว',processing:'กำลังตรวจ',resulted:'ออกผลแล้ว',completed:'ออกผลครบ',rejected:'ปฏิเสธสิ่งส่งตรวจ',cancelled:'ยกเลิก',waiting:'รอรับ',collected:'รอรับ',sent:'รอรับ'};return m[s.status(row)]||'รอรับ'};
s.statusStyle=row=>{const value=s.status(row);return['sent','waiting_receive','waiting'].includes(value)?'border:0;border-radius:0;background:#f3f4f6;color:#6b7280':'border:0;border-radius:0'};
s.filtered=()=>{const q=s.text(s.search).toLowerCase();return s.rows.filter(row=>!q||[row.order_number,row.patient_hn,row.patient_name,s.sourceUnit(row),row.section_name].join(' ').toLowerCase().includes(q))};
s.load=()=>{if(s.loading)return;const form=field.getFormRef&&field.getFormRef(),api=(form&&form.userState)||field.globalUserState;if(!api||typeof api.crudGetAll!=='function'){s.rows=[];s.info='ไม่พบ Form connector';field.notify('ไม่พบ Form connector','error',3500);return}s.loading=true;s.info='กำลังโหลดคำสั่งจาก LabCen...';api.crudGetAll({sdProvider:CENTER_PROVIDER,totalEnable:true},centerOut=>{const centers=s.extract(centerOut);api.crudGetAll({sdProvider:STATUS_PROVIDER,totalEnable:true},statusOut=>{const statuses=s.extract(statusOut);s.rows=s.merge(centers,statuses);s.loading=false;s.info='LabCen '+centers.length+' ใบสั่ง · แสดง '+s.rows.length+' รายการแยกห้อง'},()=>{s.rows=s.merge(centers,[]);s.loading=false;s.info='LabCen '+centers.length+' ใบสั่ง · แสดง '+s.rows.length+' รายการ (ยังไม่มีข้อมูลสถานะ)'})},err=>{s.loading=false;s.rows=[];s.info='โหลด LabCen ไม่สำเร็จ';field.notify('โหลดรายการ LabCen ไม่สำเร็จ: '+String((err&&err.message)||err||''),'error',4000)})};
s.load();s.__allOrdersRefreshTimer=setInterval(()=>s.load(),15000);"""
    return script.replace('__CENTER_FORM_ID__', CENTER_LAB_FORM_ID).replace('__STATUS_FORM_ID__', STATUS_FORM_ID)


def queue_script(mode):
    if mode == 'all':
        return all_orders_script()
    waiting = mode == 'waiting'
    all_rooms = mode == 'all'
    title = 'ผู้ป่วยรอรับสิ่งส่งตรวจ' if waiting else 'รายการสั่ง Lab ทุกห้อง'
    watcher = """
s.__waitingOrg='';
s.watchWaitingOrganization=()=>{const next=s.orgCode();if(next&&next!==s.__waitingOrg){s.__waitingOrg=next;s.load()}};
s.watchWaitingOrganization();
s.__waitingOrgTimer=setInterval(s.watchWaitingOrganization,800);""" if waiting else ""
    return f"""const s=this.vueState;const field=this;
const STATUS_PROVIDER={{providerId:'{STATUS_FORM_ID}',providerType:'FORM',params:{{}},options:{{}}}};
const REJECTION_FORM_ID='{REJECTION_FORM_ID}';
const REJECT_PROCESS_ID='{REJECT_PROCESS_ID}';
const SECTION_BY_ORG={SECTION_BY_ORG};
s.rows=[];s.search='';s.info='';s.loading=false;s.busy={{}};
const DEV_ALLOW_EARLY_LAB_ACTIONS={str(DEV_ALLOW_EARLY_LAB_ACTIONS).lower()};
// During parallel development the upstream Specimen receive/send module is
// absent.  Match EMR's navigation pattern: this button opens a temporary
// patient/order context and deliberately does NOT persist work_status.
const DEV_EMR_STYLE_RECEIVE_NAVIGATION=true;
s.extract=out=>{{const picks=[out,out&&out.data,out&&out.rows,out&&out.data&&out.data.data,out&&out.reply&&out.reply.data];for(let i=0;i<picks.length;i++){{if(Array.isArray(picks[i]))return picks[i]}}return []}};
s.readOrg=()=>{{const f=field.getFormRef&&field.getFormRef(),states=[field.globalUserState,f&&f.userState];for(let i=0;i<states.length;i++){{const st=states[i]||{{}},u=st.user||st,raw=u.unit||u.currentUnit||u.xunitx||st.unit||st.currentUnit||st.xunitx;if(raw!=null)return raw}}return(typeof userInfo!=='undefined'&&userInfo&&userInfo.unit)||null}};
s.orgCode=()=>{{const raw=s.readOrg();if(raw==null)return '';if(typeof raw==='string'||typeof raw==='number')return String(raw).trim();return String(raw.code||raw.unit_code||raw.value||raw.id||'').trim()}};
s.section=()=>SECTION_BY_ORG[s.orgCode()]||'';
// Some Organizations are a grouped Lab, e.g. Hematology = "20-22".
// Include both the group key and each section code so one selected room can
// see all of the sections it owns.
s.sectionCodes=()=>{{const raw=String(s.orgCode()||'').toUpperCase(),mapped=String(s.section()||'').toUpperCase(),split=v=>String(v||'').split(/[\\s,\\/-]+/).filter(Boolean);return[raw,mapped,...split(raw),...split(mapped)].filter((v,i,a)=>v&&a.indexOf(v)===i)}};
s.roomName=()=>{{const code=s.orgCode(),section=s.section();const names={{'10':'Biochemistry','20':'Hematology','21':'Clinical Microscopy Laboratory','22':'Hematology-Homeostasis','30':'Immunology','31':'Immunology-ส่งนอกรพ.','40':'Microbiology','41':'Mycology','50':'Blood Bank','70':'Biomolecular and Genetics'}};return names[code]||names[section]||section||'ห้อง Lab ของฉัน'}};
s.isMine=row=>s.sectionCodes().includes(String((row&&row.section_code)||'').trim().toUpperCase());
s.organizationName=row=>{{const names={{'10':'Biochemistry','20':'Hematology','22':'Hematology','21':'Clinical Microscopy Laboratory','30':'Immunology','31':'Immunology-ส่งนอกรพ.','40':'Microbiology','41':'Mycology','50':'Blood Bank','70':'Biomolecular and Genetics'}};return names[String((row&&row.section_code)||'').trim()]||String((row&&row.section_name)||'-')}};
s.items=row=>{{try{{const v=typeof(row&&row.selected_items)==='string'?JSON.parse(row.selected_items||'[]'):(row&&row.selected_items)||[];return Array.isArray(v)?v:[]}}catch(e){{return []}}}};
s.specimens=row=>{{try{{const v=typeof(row&&row.specimens)==='string'?JSON.parse(row.specimens||'[]'):(row&&row.specimens)||[];const seen={{}};return(Array.isArray(v)?v:[]).map(x=>String(x.label||x.specimen_name||x.specimen_code||'')).filter(x=>x&&!seen[x]&&(seen[x]=true)).join(' · ')||'-'}}catch(e){{return '-'}}}};
s.rights=row=>{{const raw=(row&&((row.inscl_hos_json!==undefined&&row.inscl_hos_json)||row.treatment_right||row.insurance_right||row.inscl_name||row.inscl_code||row.inscl_hos))||[];let list=[];try{{list=Array.isArray(raw)?raw:(typeof raw==='string'&&raw.trim().charAt(0)==='['?JSON.parse(raw):[raw])}}catch(e){{list=[raw]}}const seen={{}};return list.map(x=>{{if(x&&typeof x==='object')return String((x.inscl_item_main&&(x.inscl_item_main.value||x.inscl_item_main.label))||x.label||x.value||x.name||'');return String(x||'').trim()}}).filter(x=>x&&x!=='-'&&!seen[x]&&(seen[x]=true))}};
s.gender=row=>{{const v=String((row&&(row.patient_gender||row.gender||row.p_gender))||'').trim().toLowerCase();return ['1','m','male','ชาย'].includes(v)?'ชาย':['2','f','female','หญิง'].includes(v)?'หญิง':''}};
s.age=row=>{{const raw=String((row&&(row.patient_birth_date||row.birth_date))||'').trim();let birth=null;const parts=raw.match(/^(\\d{{1,2}})[\\/.-](\\d{{1,2}})[\\/.-](\\d{{4}})$/);if(parts){{let year=Number(parts[3]);if(year>2400)year-=543;birth=new Date(year,Number(parts[2])-1,Number(parts[1]))}}else if(raw){{const parsed=new Date(raw);if(!Number.isNaN(parsed.getTime()))birth=parsed}}if(!birth||Number.isNaN(birth.getTime())){{const years=String((row&&row.patient_age)||'').trim();return years?'อายุ '+years+' ปี':''}}const now=new Date();let years=now.getFullYear()-birth.getFullYear(),months=now.getMonth()-birth.getMonth(),days=now.getDate()-birth.getDate();if(days<0){{months--;days+=new Date(now.getFullYear(),now.getMonth(),0).getDate()}}if(months<0){{years--;months+=12}}return years>=0?'อายุ '+years+' ปี '+months+' เดือน '+days+' วัน':''}};
s.initial=row=>{{const v=String((row&&row.patient_name)||(row&&row.patient_hn)||'?').trim();return v?v.charAt(0).toUpperCase():'?'}};
s.photo=row=>String((row&&row.patient_photo_url)||(row&&row.patient_photo)||(row&&row.photo_url)||(row&&row.avatar_url)||'').trim();
s.sourceUnit=row=>{{const v=String((row&&(row.source_unit_name||row.sender_unit_name||row.origin_unit_name||row.ward_clinic))||'').trim();return v&&v!=='-'?v:''}};
s.time=row=>{{const v=row&&((row.ordered_at)||(row.requested_at)||(row.created_at));if(!v)return '-';try{{return new Date(v).toLocaleString('th-TH',{{hour:'2-digit',minute:'2-digit'}})}}catch(e){{return String(v)}}}};
s.receivedTime=row=>{{const v=row&&row.received_at;if(!v)return '-';try{{return new Date(v).toLocaleString('th-TH',{{hour:'2-digit',minute:'2-digit'}})}}catch(e){{return String(v)}}}};
s.status=row=>{{const v=String((row&&row.work_status)||'').toLowerCase();return v||String((row&&row.specimen_status)||'').toLowerCase()||'-'}};
s.statusLabel=row=>{{const m={{waiting_receive:'รอรับ',received:'รับเข้าแล้ว',processing:'กำลังตรวจ',resulted:'ออกผลแล้ว',completed:'ออกผลครบ',rejected:'ปฏิเสธสิ่งส่งตรวจ',cancelled:'ยกเลิก',waiting:'รอรับ',collected:'รอรับ',sent:'รอรับ'}};const specimen=String((row&&row.specimen_status)||'').toLowerCase(),work=String((row&&row.work_status)||'').toLowerCase();if(DEV_EMR_STYLE_RECEIVE_NAVIGATION&&(['waiting','collected','sent'].includes(specimen)||['waiting_receive','received'].includes(work)))return 'รอรับ';return m[s.status(row)]||'รอรับ'}};
s.statusStyle=row=>{{const status=s.status(row);return(status==='sent'||status==='waiting_receive'||status==='waiting')?'border:0;border-radius:0;background:#f3f4f6;color:#6b7280':'border:0;border-radius:0'}};
s.recordId=value=>{{if(value==null)return '';if(typeof value==='object')return s.recordId(value.$oid||value._id||value.id||value.value||'');return String(value).trim()}};
s.rowKey=row=>s.recordId((row&&row._id)||(row&&row.id)||(row&&row.order_number)||'');
// Normal production flow is `sent → waiting_receive`.  During the temporary
// parallel-development period Lab may instead start from `waiting/collected`.
// Keep the work-status predicate unchanged so an already-received record never
// gets a duplicate Receive/Reject action.
s.canReceive=row=>{{const specimen=String((row&&row.specimen_status)||'').toLowerCase(),work=String((row&&row.work_status)||'').toLowerCase(),readyFromSpecimen=specimen==='sent'||(DEV_ALLOW_EARLY_LAB_ACTIONS&&['waiting','collected'].includes(specimen));if(DEV_EMR_STYLE_RECEIVE_NAVIGATION)return s.isMine(row)&&(readyFromSpecimen||work==='received');return s.isMine(row)&&readyFromSpecimen&&(!work||work==='waiting_receive')}};
s.filtered=()=>{{const q=String(s.search||'').trim().toLowerCase();return s.rows.filter(row=>!q||[row.order_number,row.patient_hn,row.patient_name,s.sourceUnit(row),row.section_name].join(' ').toLowerCase().includes(q))}};
s.load=()=>{{const form=field.getFormRef&&field.getFormRef(),api=(form&&form.userState)||field.globalUserState,codes=s.sectionCodes();if(!{str(all_rooms).lower()}&&!codes.length){{s.rows=[];s.info='ไม่พบรหัสห้อง Lab ของผู้ใช้';return}}if(!api||typeof api.crudGetAll!=='function'){{s.rows=[];s.info='ไม่พบ Form connector';field.notify('ไม่พบ Form connector','error',3500);return}}s.loading=true;s.info='กำลังโหลด...';api.crudGetAll({{sdProvider:STATUS_PROVIDER,totalEnable:true}},out=>{{const all=s.extract(out);s.rows=all.filter(row=>{{const work=String(row.work_status||'').toLowerCase();if({str(all_rooms).lower()})return true;if(!codes.includes(String(row.section_code||'').toUpperCase()))return false;return DEV_EMR_STYLE_RECEIVE_NAVIGATION?!['processing','resulted','completed','rejected','cancelled'].includes(work):!['received','processing','resulted','completed','rejected','cancelled'].includes(work)}});s.loading=false;s.info={("'อ่านจากต้นทาง '+all.length+' · แสดง '+s.rows.length+' รายการทุกห้อง Lab'" if all_rooms else "'พบ '+s.rows.length+' รายการ · ห้อง '+codes.join('/')")}}},err=>{{s.loading=false;s.rows=[];s.info='โหลดไม่สำเร็จ';field.notify('โหลดรายการ Lab ไม่สำเร็จ: '+String((err&&err.message)||err||''),'error',4000)}})}};
// Same interaction pattern as EMR's `goEmr(row)`: keep the queue row in
// place, put its complete snapshot on the parent form for a lazy tab, then
// tell a mounted received card to render it immediately.  This is a UI
// navigation action in development mode, not a permanent specimen transition.
// The Tab ref used by the Lab form can be either the field proxy or its
// mounted editor.  Set the documented ref property first (as EMR does), then
// mirror it to the reactive editor state when the lazy pane has mounted.
s.openReceivedTab=host=>{{const target='lab_received';const apply=tab=>{{if(!tab)return;tab.activeTabName=target;if(tab.vueData)tab.vueData.activeTabName=target;if(tab.vueState)tab.vueState.activeTabName=target;const editor=typeof tab.getFieldEditor==='function'&&tab.getFieldEditor();if(editor){{editor.activeTabName=target;if(editor.vueData)editor.vueData.activeTabName=target;if(editor.vueState)editor.vueState.activeTabName=target}}}};const switchNow=()=>apply(host&&host.getFieldRef&&host.getFieldRef('lab_biochem_tabs'));switchNow();[0,120,360].forEach(delay=>setTimeout(switchNow,delay))}};
s.snapshotNeedsRefresh=row=>{{
  const visit=String((row&&(row.visit_id||row.visit_id_link))||'').trim();
  const birth=String((row&&(row.patient_birth_date||row.birth_date))||'').trim();
  const gender=String((row&&(row.patient_gender||row.gender||row.p_gender))||'').trim();
  const source=String((row&&(row.source_unit_name||row.sender_unit_name||row.origin_unit_name))||'').trim();
  const destination=String((row&&(row.section_name||row.lab_name))||'').trim();
  return !visit||!birth||!gender||!source||(source&&destination&&source===destination);
}};
s.openReceiveRow=(row,form,receiveKey)=>{{
  const show=latest=>{{
    const current=latest||row;
    form.$labReceiveTran=current;
    form.$labReceivedOrderId=receiveKey;
    const received=form.getFieldRef&&form.getFieldRef('lab_received_component');
    if(received&&received.vueState){{
      if(typeof received.vueState.setReceiveRow==='function')received.vueState.setReceiveRow(current);
      else if(typeof received.vueState.openForReceive==='function')received.vueState.openForReceive(receiveKey);
    }}
    s.openReceivedTab(form);
    field.notify('เปิดรายการรับ specimen แล้ว','success');
    setTimeout(()=>{{
      const lateReceived=form.getFieldRef&&form.getFieldRef('lab_received_component');
      if(lateReceived&&lateReceived.vueState&&typeof lateReceived.vueState.setReceiveRow==='function')lateReceived.vueState.setReceiveRow(current);
    }},0);
  }};
  const api=(form&&form.userState)||field.globalUserState;
  const orderNumber=String((row&&row.order_number)||(row&&row.lab_no)||'').trim();
  // The waiting queue remains mounted while the received workspace is open.
  // Its row can therefore be stale after an order edit.  Read the canonical
  // Status row again so the persisted add/remove audit follows the user when
  // they leave “รับเข้าแล้ว” and select the same specimen again.
  if(!orderNumber||!api||typeof api.runProcess!=='function'){{show(row);return}}
  const readLatest=()=>api.runProcess('{STATUS_PROCESS_ID}',{{action:'get_order',order_number:orderNumber}},out=>{{
    const body=(out&&out.data)||out||{{}};
    if(body.success===false||!body.row){{show(row);return}}
    const latest={{...row,...body.row}};
    s.rows=s.rows.map(item=>s.rowKey(item)===s.rowKey(row)?latest:item);
    show(latest);
    // Keep the waiting list in sync with the persisted Status snapshot.  The
    // receive card is a transient tab, but its source row must immediately
    // show the repaired photo/demographics/source room when staff returns.
    setTimeout(()=>s.load(),0);
  }},()=>show(row));
  // Status rows created by the former direct-insert process can be missing
  // the Visit snapshot or hold the destination Lab as their source room.
  // Repair only those rows, then read the canonical saved record before the
  // EMR-style patient card mounts.  New rows already arrive hydrated.
  if(!s.snapshotNeedsRefresh(row)){{readLatest();return}}
  api.runProcess('{STATUS_PROCESS_ID}',{{action:'hydrate_visit_context',order_number:orderNumber}},()=>readLatest(),()=>readLatest());
}};
s.receive=row=>{{const form=field.getFormRef&&field.getFormRef(),api=(form&&form.userState)||field.globalUserState,receiveKey=String((row&&row.order_number)||(row&&row.lab_no)||(row&&row._id)||(row&&row.id)||''),key=s.rowKey(row);if(!form||!receiveKey){{field.notify('ไม่พบข้อมูล LAB NO. สำหรับเปิดรายการ','error');return}}if(!api||typeof api.runProcess!=='function'){{field.notify('ไม่พบ API connector สำหรับบันทึกเวลารับ specimen','error');return}}if(s.busy[key])return;s.busy={{...s.busy,[key]:true}};api.runProcess('{STATUS_PROCESS_ID}',{{action:'mark_received_once',order_number:String(row.order_number||row.lab_no||'')}},res=>{{const body=(res&&res.data)||res||{{}},busy={{...s.busy}};delete busy[key];s.busy=busy;if(body.success===false){{field.notify(body.message||'บันทึกเวลารับ specimen ไม่สำเร็จ','error');return}}const patched={{...row,received_at:body.received_at||row.received_at,received_by:body.received_by||row.received_by}};s.rows=s.rows.map(item=>s.rowKey(item)===key?patched:item);s.openReceiveRow(patched,form,receiveKey)}},err=>{{const busy={{...s.busy}};delete busy[key];s.busy=busy;field.notify('บันทึกเวลารับ specimen ไม่สำเร็จ: '+String((err&&err.message)||err||''),'error')}})}};
s.reject=row=>{{
  if(!s.canReceive(row)){{field.notify('รายการนี้ยังไม่พร้อมให้ปฏิเสธ','warning',3000);return}}
  const form=field.getFormRef&&field.getFormRef(),api=(form&&form.userState)||field.globalUserState,key=s.rowKey(row);
  if(!key||!form||typeof form.openForm!=='function'){{field.notify('ไม่พบตัวเปิดฟอร์ม Reject หรือ record id','error',3500);return}}
  const hn=String(row.patient_hn||'').trim(),name=String(row.patient_name||'').trim(),orderNumber=String(row.order_number||row.lab_no||'').trim(),sectionCode=String(row.section_code||'').trim();
  const initData={{
    source_order_id:key,order_group_id:orderNumber,patient_hn:hn,patient_name:name,
    patient_display:[hn,name].filter(Boolean).join(' — '),
    ward_clinic:String(row.source_unit_name||row.ward_clinic||'').trim(),lab_section:sectionCode,
    selected_items_json:typeof row.selected_items==='string'?row.selected_items:JSON.stringify(row.selected_items||[]),
    biochemistry_specimen_json:typeof row.specimens==='string'?row.specimens:JSON.stringify(row.specimens||[]),
    treatment_right:String(row.treatment_right||row.insurance_right||''),payment_status:String(row.payment_status||''),revision_no:String(row.revision_no||1)
  }};
  form.openForm(REJECTION_FORM_ID,null,null,initData,{{
    params:{{from:'multi-lab-waiting',source_order_id:key,order_number:orderNumber,section_code:sectionCode}},
    popupType:'dialog',backdrop:false,
    afterSaveCallback:saved=>{{
      const savedRow=(saved&&saved.data)||saved||{{}};
      if(!api||typeof api.runProcess!=='function'){{field.notify('บันทึกเหตุผลแล้ว แต่ไม่พบ Reject API','error',4000);return}}
      if(s.busy[key])return;
      s.busy={{...s.busy,[key]:true}};
      api.runProcess(REJECT_PROCESS_ID,{{
        source_order_id:key,rejection_record_id:s.recordId(savedRow._id||savedRow.id),
        order_number:orderNumber,section_code:sectionCode,
        reject_reason_code:savedRow.reject_reason_code,reject_reason_detail:savedRow.reject_reason_detail
      }},res=>{{
        const body=(res&&res.data)||res||{{}},busy={{...s.busy}};delete busy[key];s.busy=busy;
        if(body.success===false){{field.notify(body.message||'ปฏิเสธ specimen ไม่สำเร็จ','error',4000);return}}
        field.notify(body.message||'ปฏิเสธ specimen แล้ว','success',2500);s.load();
        ['lab_all_orders_center_specimen','lab_cancelled_listview_final'].forEach(refName=>{{
          const ref=form&&form.getFieldRef&&form.getFieldRef(refName),editor=ref&&ref.getFieldEditor&&ref.getFieldEditor();
          if(ref&&ref.vueState&&typeof ref.vueState.load==='function')ref.vueState.load();
          if(editor&&typeof editor.handleRefresh==='function')editor.handleRefresh();
        }});
        if(typeof form.subFormClose==='function')form.subFormClose();
      }},err=>{{
        const busy={{...s.busy}};delete busy[key];s.busy=busy;
        field.notify('ปฏิเสธ specimen ไม่สำเร็จ: '+String((err&&err.message)||err||''),'error',4000);
      }});
    }}
  }});
}};
s.load();{watcher}"""


def queue_content(mode):
    waiting = mode == 'waiting'
    title = 'ผู้ป่วยรอรับสิ่งส่งตรวจ' if waiting else 'รายการสั่ง Lab ทุกห้อง'
    if not waiting:
        return f"""<section class="lab-panel"><div class="lab-panel-head"><div><h2>{title}</h2><p>{{{{ info || 'โหลดรายการจาก Lab Bio Order' }}}}</p></div><el-button :loading="loading" @click="load">โหลดใหม่</el-button></div><div class="lab-toolbar" style="padding:14px 16px"><el-input :model-value="search" @input="search=$event" clearable placeholder="ค้นหา LAB NO., HN, ชื่อผู้ป่วย หรือห้องต้นทาง" /></div><div v-if="filtered().length" class="lab-table-wrap"><table class="lab-table"><thead><tr><th>ผู้ป่วย / LAB NO.</th><th></th><th></th><th>Specimen</th><th>ห้อง Lab</th><th>เวลาสั่ง</th><th>Order</th><th>สถานะ</th></tr></thead><tbody><tr v-for="row in filtered()" :key="row._id||row.id"><td><div style="display:flex;align-items:center;gap:12px;min-width:280px"><div style="width:58px;height:58px;flex:0 0 58px;border:1px solid #d7dce5;border-radius:8px;overflow:hidden;background:#f3f5f8;display:grid;place-items:center"><img v-if="photo(row)" :src="photo(row)" style="width:100%;height:100%;object-fit:cover" /><svg v-else viewBox="0 0 48 48" style="width:42px;height:42px;fill:#9ca3af" aria-label="patient"><circle cx="24" cy="16" r="8"></circle><path d="M8 42c1-9 7-15 16-15s15 6 16 15z"></path></svg></div><div style="min-width:0;line-height:1.38"><b style="display:block;font-size:16px;color:#1f2937">{{{{ row.order_number || row.lab_no || '-' }}}}</b><small style="display:block;color:#6b7280">HN {{{{ row.patient_hn || '-' }}}}</small><span style="display:block;font-weight:600;color:#374151">{{{{ row.patient_name || '-' }}}} <span v-if="gender(row)" style="display:inline-block;margin-left:5px;padding:1px 7px;border-radius:10px;background:#e9f8df;color:#4fa62a;font-size:12px;font-weight:700">{{{{ gender(row) }}}}</span></span></div></div></td><td style="width:4%;min-width:26px"></td><td style="min-width:230px"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span v-if="sourceUnit(row)" style="display:inline-block;padding:4px 8px;border:1px solid #cfe3ff;border-radius:0;background:#eef6ff;color:#3b82f6;font-size:12px;font-weight:700">ส่งจาก: {{{{ sourceUnit(row) }}}}</span><span style="display:inline-block;padding:4px 8px;border-radius:0;background:#e9f8df;color:#4fa62a;font-size:12px;font-weight:700">ชำระเงินแล้ว</span><span v-for="(right,index) in rights(row)" :key="'right-'+index" style="display:inline-block;padding:4px 8px;border-radius:0;background:#fff3d5;color:#a16207;font-size:12px;font-weight:700">{{{{ right }}}}</span></div></td><td>{{{{ specimens(row) }}}}</td><td><b>{{{{ organizationName(row) }}}}</b></td><td><b>{{{{ time(row) }}}}</b></td><td><span class="lab-status-tag" style="border-radius:0">{{{{ items(row).length }}}} รายการ</span></td><td><span class="lab-status-tag" :style="statusStyle(row)">{{{{ statusLabel(row) }}}}</span></td></tr></tbody></table></div><div v-else class="lab-empty"><strong>ไม่พบรายการ</strong><br>ตรวจสอบรหัสห้องและสถานะสิ่งส่งตรวจ</div></section>"""
    action = """<div v-if="canReceive(row)" style="display:flex;justify-content:flex-end;gap:6px;min-width:170px"><el-button v-show="hovered===rowKey(row)" size="small" type="primary" :loading="!!busy[rowKey(row)]" @click="receive(row)">รับ specimen</el-button><el-button v-show="hovered===rowKey(row)" size="small" type="danger" plain :disabled="!!busy[rowKey(row)]" @click="reject(row)">ปฏิเสธ</el-button></div>"""
    return f"""<section class="lab-panel"><div class="lab-panel-head"><div><h2>{title}</h2><p>{{{{ info || 'โหลดรายการจาก Lab Bio Order' }}}}</p></div><el-button :loading="loading" @click="load">โหลดใหม่</el-button></div><div class="lab-toolbar" style="padding:14px 16px"><el-input :model-value="search" @input="search=$event" clearable placeholder="ค้นหา LAB NO., HN, ชื่อผู้ป่วย หรือห้องต้นทาง" /></div><div v-if="filtered().length" class="lab-table-wrap"><table class="lab-table"><thead><tr><th>LAB NO.</th><th>HN / ผู้ป่วย</th><th>ส่งจาก</th><th>Specimen</th><th>รายการตรวจ</th><th>สถานะ</th><th></th></tr></thead><tbody><tr v-for="row in filtered()" :key="row._id||row.id"><td><b>{{{{ row.order_number || row.lab_no || '-' }}}}</b></td><td><b>{{{{ row.patient_hn || '-' }}}}</b><br><span>{{{{ row.patient_name || '-' }}}}</span></td><td>{{{{ sourceUnit(row) || '-' }}}}</td><td>{{{{ specimens(row) }}}}</td><td>{{{{ items(row).length }}}} รายการ</td><td><span class="lab-status-tag">{{{{ statusLabel(row) }}}}</span></td><td class="lab-action-cell">{action}</td></tr></tbody></table></div><div v-else class="lab-empty"><strong>ไม่พบรายการ</strong><br>ตรวจสอบรหัสห้องและสถานะสิ่งส่งตรวจ</div></section>"""


def waiting_list_content():
    """A non-scrolling, EMR-like queue row for Lab receive.

    The action slot intentionally remains in the layout while its buttons are
    invisible.  This keeps every patient row aligned, but exposes the actions
    only on hover/focus just like the EMR list view.
    """
    return """<section class="lab-panel lab-waiting-panel"><div class="lab-panel-head"><div><h2>ผู้ป่วยรอรับสิ่งส่งตรวจ</h2><p>{{ info || 'โหลดรายการจาก Lab Bio Order' }}</p></div><el-button :loading="loading" @click="load">โหลดใหม่</el-button></div><div class="lab-toolbar lab-waiting-toolbar"><el-input :model-value="search" @input="search=$event" clearable placeholder="ค้นหา LAB NO., HN, ชื่อผู้ป่วย หรือห้องต้นทาง" /></div><div v-if="filtered().length" class="lab-waiting-list"><article v-for="row in filtered()" :key="row._id||row.id" class="lab-waiting-row" tabindex="0"><div class="lab-waiting-patient"><div class="lab-waiting-avatar"><img v-if="photo(row)" :src="photo(row)" alt="รูปผู้ป่วย" /><svg v-else viewBox="0 0 48 48" aria-label="patient"><circle cx="24" cy="16" r="8"></circle><path d="M8 42c1-9 7-15 16-15s15 6 16 15z"></path></svg></div><div class="lab-waiting-identity"><b class="lab-waiting-labno">{{ row.order_number || row.lab_no || '-' }}</b><small>HN {{ row.patient_hn || '-' }}</small><strong>{{ row.patient_name || '-' }} <span v-if="gender(row)" class="lab-waiting-sex">{{ gender(row) }}</span></strong><small v-if="age(row)">{{ age(row) }}</small></div></div><div class="lab-waiting-context"><span v-if="sourceUnit(row)" class="lab-context-chip source">{{ sourceUnit(row) }}</span><span class="lab-context-chip paid">ชำระเงินแล้ว</span><span v-for="(right,index) in rights(row)" :key="'right-'+index" class="lab-context-chip right">{{ right }}</span></div><div class="lab-waiting-order"><div><small>Specimen</small><span>{{ specimens(row) }}</span></div><div><small>ห้อง Lab</small><b>{{ organizationName(row) }}</b></div><div><small>เวลารับ</small><b>{{ receivedTime(row) }}</b></div><div><small>Order</small><span class="lab-status-tag">{{ items(row).length }} รายการ</span></div><div><small>สถานะ</small><span class="lab-status-tag" :style="statusStyle(row)">{{ statusLabel(row) }}</span></div></div><div class="lab-waiting-actions"><div v-if="canReceive(row)" class="lab-hover-action-group"><el-button size="small" type="primary" :loading="!!busy[rowKey(row)]" @click="receive(row)">รับ specimen</el-button><el-button size="small" type="danger" plain :disabled="!!busy[rowKey(row)]" @click="reject(row)">ปฏิเสธ</el-button></div></div></article></div><div v-else class="lab-empty"><strong>ไม่พบรายการ</strong><br>ตรวจสอบรหัสห้องและสถานะสิ่งส่งตรวจ</div></section>"""


def resulted_list_script():
    """Read processing/resulted/completed Status rows for the active Lab room."""
    return f"""const s=this.vueState;const field=this;
const STATUS_PROVIDER={{providerId:'{STATUS_FORM_ID}',providerType:'FORM',params:{{}},options:{{limit:5000,page:1}}}};
const SECTION_BY_ORG={SECTION_BY_ORG};
s.rows=[];s.search='';s.info='';s.loading=false;
s.extract=out=>{{const picks=[out,out&&out.data,out&&out.rows,out&&out.data&&out.data.data,out&&out.reply&&out.reply.data];for(let i=0;i<picks.length;i++){{if(Array.isArray(picks[i]))return picks[i]}}return []}};
s.asArray=value=>{{try{{const parsed=typeof value==='string'?JSON.parse(value||'[]'):(value||[]);return Array.isArray(parsed)?parsed:[]}}catch(e){{return []}}}};
s.text=value=>{{if(value==null)return '';if(typeof value==='object')return s.text(value.$oid||value._id||value.id||value.value||value.code||value.label||value.name||'');return String(value).trim()}};
s.readOrg=()=>{{const form=field.getFormRef&&field.getFormRef(),states=[field.globalUserState,form&&form.userState];for(let i=0;i<states.length;i++){{const state=states[i]||{{}},user=state.user||state,raw=user.unit||user.currentUnit||user.xunitx||state.unit||state.currentUnit||state.xunitx;if(raw!=null)return raw}}return(typeof userInfo!=='undefined'&&userInfo&&userInfo.unit)||null}};
s.orgCode=()=>{{const raw=s.readOrg();if(raw==null)return '';if(typeof raw==='string'||typeof raw==='number')return String(raw).trim();return String(raw.code||raw.unit_code||raw.value||raw.id||'').trim()}};
s.section=()=>SECTION_BY_ORG[s.orgCode()]||'';
s.sectionCodes=()=>{{const raw=String(s.orgCode()||'').toUpperCase(),mapped=String(s.section()||'').toUpperCase(),split=value=>String(value||'').split(/[\\s,\\/-]+/).filter(Boolean);return[raw,mapped,...split(raw),...split(mapped)].filter((value,index,all)=>value&&all.indexOf(value)===index)}};
s.isMine=row=>s.sectionCodes().includes(s.text(row&&row.section_code).toUpperCase());
s.organizationName=row=>{{const names={{'10':'Biochemistry','20':'Hematology','21':'Clinical Microscopy Laboratory','22':'Hematology-Homeostasis','30':'Immunology','31':'Immunology-ส่งนอกรพ.','40':'Microbiology','41':'Mycology','50':'Blood Bank','70':'Biomolecular and Genetics','BC':'Biochemistry','HM':'Hematology','ML':'Clinical Microscopy Laboratory','HH':'Hematology-Homeostasis','IM':'Immunology','MI-OUT':'Immunology-ส่งนอกรพ.','MB':'Microbiology','MY':'Mycology','BB':'Blood Bank','BG':'Biomolecular and Genetics'}};return names[s.text(row&&row.section_code).toUpperCase()]||s.text(row&&row.section_name)||'-'}};
s.items=row=>s.asArray(row&&row.selected_items);
s.specimens=row=>{{const seen={{}};return s.asArray(row&&row.specimens).map(item=>s.text(item&&(item.label||item.specimen_name||item.specimen_code||item.code))).filter(value=>value&&!seen[value]&&(seen[value]=true)).join(' · ')||'-'}};
s.rights=row=>{{const raw=(row&&((row.inscl_hos_json!==undefined&&row.inscl_hos_json)||row.treatment_right||row.insurance_right||row.inscl_name||row.inscl_code||row.inscl_hos))||[],list=Array.isArray(raw)?raw:(()=>{{try{{return typeof raw==='string'&&raw.trim().charAt(0)==='['?JSON.parse(raw):[raw]}}catch(e){{return[raw]}}}})(),seen={{}};return list.map(item=>item&&typeof item==='object'?s.text((item.inscl_item_main&&(item.inscl_item_main.value||item.inscl_item_main.label))||item.label||item.value||item.name):s.text(item)).filter(value=>value&&value!=='-'&&!seen[value]&&(seen[value]=true))}};
s.gender=row=>{{const value=s.text(row&&(row.patient_gender||row.gender||row.p_gender)).toLowerCase();return['1','m','male','ชาย'].includes(value)?'ชาย':['2','f','female','หญิง'].includes(value)?'หญิง':''}};
s.age=row=>{{const raw=s.text(row&&(row.patient_birth_date||row.birth_date));let birth=null;const parts=raw.match(/^(\\d{{1,2}})[\\/.-](\\d{{1,2}})[\\/.-](\\d{{4}})$/);if(parts){{let year=Number(parts[3]);if(year>2400)year-=543;birth=new Date(year,Number(parts[2])-1,Number(parts[1]))}}else if(raw){{const parsed=new Date(raw);if(!Number.isNaN(parsed.getTime()))birth=parsed}}if(!birth||Number.isNaN(birth.getTime())){{const years=s.text(row&&row.patient_age);return years?'อายุ '+years+' ปี':''}}const now=new Date();let years=now.getFullYear()-birth.getFullYear(),months=now.getMonth()-birth.getMonth(),days=now.getDate()-birth.getDate();if(days<0){{months--;days+=new Date(now.getFullYear(),now.getMonth(),0).getDate()}}if(months<0){{years--;months+=12}}return years>=0?'อายุ '+years+' ปี '+months+' เดือน '+days+' วัน':''}};
s.photo=row=>s.text(row&&(row.patient_photo_url||row.patient_photo||row.photo_url||row.avatar_url));
s.sourceUnit=row=>s.text(row&&(row.source_unit_name||row.sender_unit_name||row.origin_unit_name||row.ward_clinic));
s.startedTime=row=>{{const value=row&&(row.processing_at||row.resulted_at||row.received_at);if(!value)return '-';try{{return new Date(value).toLocaleString('th-TH',{{hour:'2-digit',minute:'2-digit'}})}}catch(e){{return String(value)}}}};
s.statusLabel=row=>{{const status=s.text(row&&row.work_status).toLowerCase(),labels={{processing:'กำลังตรวจ',resulted:'ออกผลบางส่วน',completed:'ออกผลครบ'}};return labels[status]||status||'-'}};
s.statusStyle=row=>{{const status=s.text(row&&row.work_status).toLowerCase();return status==='completed'?'border:0;border-radius:0;background:#e7f9eb;color:#16aa45':status==='resulted'?'border:0;border-radius:0;background:#fff0df;color:#ef7d1a':'border:0;border-radius:0;background:#fff3d8;color:#a16207'}};
s.filtered=()=>{{const query=s.text(s.search).toLowerCase();return s.rows.filter(row=>!query||[row.order_number,row.lab_no,row.patient_hn,row.patient_name,s.sourceUnit(row),row.section_name].join(' ').toLowerCase().includes(query))}};
s.viewResult=row=>{{field.notify('ปุ่มดูผลพร้อมแล้ว — จะเชื่อมฟอร์ม Manual ในขั้นตอนถัดไป','info',3000)}};
s.load=()=>{{const form=field.getFormRef&&field.getFormRef(),api=(form&&form.userState)||field.globalUserState,codes=s.sectionCodes();if(!codes.length){{s.rows=[];s.info='ไม่พบรหัสห้อง Lab ของผู้ใช้';return}}if(!api||typeof api.crudGetAll!=='function'){{s.rows=[];s.info='ไม่พบ Form connector';field.notify('ไม่พบ Form connector','error',3500);return}}s.loading=true;s.info='กำลังโหลด...';api.crudGetAll({{sdProvider:STATUS_PROVIDER,totalEnable:true}},out=>{{const all=s.extract(out);s.rows=all.filter(row=>s.isMine(row)&&['processing','resulted','completed'].includes(s.text(row.work_status).toLowerCase()));s.loading=false;s.info='พบ '+s.rows.length+' รายการ · ห้อง '+codes.join('/')}},error=>{{s.loading=false;s.rows=[];s.info='โหลดไม่สำเร็จ';field.notify('โหลดรายการออกผลไม่สำเร็จ: '+String((error&&error.message)||error||''),'error',4000)}})}};
s.load();s.__resultedOrg=s.orgCode();s.__resultedOrgTimer=setInterval(()=>{{const next=s.orgCode();if(next&&next!==s.__resultedOrg){{s.__resultedOrg=next;s.load()}}}},800);"""


def resulted_list_content():
    return """<section class="lab-panel lab-waiting-panel"><div class="lab-panel-head"><div><h2>รายการออกผลแล้ว</h2><p>{{ info || 'โหลดรายการจาก Lab Status' }}</p></div><el-button :loading="loading" @click="load">โหลดใหม่</el-button></div><div class="lab-toolbar lab-waiting-toolbar"><el-input :model-value="search" @input="search=$event" clearable placeholder="ค้นหา LAB NO., HN, ชื่อผู้ป่วย หรือห้องต้นทาง" /></div><div v-if="filtered().length" class="lab-waiting-list"><article v-for="row in filtered()" :key="row._id||row.id" class="lab-waiting-row" tabindex="0"><div class="lab-waiting-patient"><div class="lab-waiting-avatar"><img v-if="photo(row)" :src="photo(row)" alt="รูปผู้ป่วย" /><svg v-else viewBox="0 0 48 48" aria-label="patient"><circle cx="24" cy="16" r="8"></circle><path d="M8 42c1-9 7-15 16-15s15 6 16 15z"></path></svg></div><div class="lab-waiting-identity"><b class="lab-waiting-labno">{{ row.order_number || row.lab_no || '-' }}</b><small>HN {{ row.patient_hn || '-' }}</small><strong>{{ row.patient_name || '-' }} <span v-if="gender(row)" class="lab-waiting-sex">{{ gender(row) }}</span></strong><small v-if="age(row)">{{ age(row) }}</small></div></div><div class="lab-waiting-context"><span v-if="sourceUnit(row)" class="lab-context-chip source">{{ sourceUnit(row) }}</span><span class="lab-context-chip paid">ชำระเงินแล้ว</span><span v-for="(right,index) in rights(row)" :key="'result-right-'+index" class="lab-context-chip right">{{ right }}</span></div><div class="lab-waiting-order"><div><small>Specimen</small><span>{{ specimens(row) }}</span></div><div><small>ห้อง Lab</small><b>{{ organizationName(row) }}</b></div><div><small>เวลาเริ่ม</small><b>{{ startedTime(row) }}</b></div><div><small>Order</small><span class="lab-status-tag">{{ items(row).length }} รายการ</span></div><div><small>สถานะ</small><span class="lab-status-tag" :style="statusStyle(row)">{{ statusLabel(row) }}</span></div></div><div class="lab-waiting-actions"><div class="lab-hover-action-group"><el-button size="small" type="primary" @click="viewResult(row)">ดูผล</el-button></div></div></article></div><div v-else class="lab-empty"><strong>ไม่พบรายการ</strong><br>รายการจะแสดงหลังจากกดเริ่มดำเนินการ</div></section>"""


def compact_patient_table(content):
    """Apply the all-orders patient-card layout to any queue tab."""
    content = content.replace('ส่งจาก: ', '')
    content = content.replace(
        'padding:4px 8px;border:1px solid #cfe3ff;border-radius:0;background:#eef6ff;color:#3b82f6;font-size:12px;font-weight:700',
        'padding:4px 8px;border:0;border-radius:0;background:#eef6ff;color:#3b82f6;font-size:12px;font-weight:700'
    )
    content = content.replace('style="min-width:0;line-height:1.38"', 'style="min-width:0;line-height:1.28"')
    content = content.replace('font-size:16px;color:#1f2937', 'font-size:15px;color:#1f2937')
    content = content.replace('style="display:block;color:#6b7280">HN', 'style="display:block;color:#6b7280;font-size:11px">HN')
    content = content.replace('style="display:block;font-weight:600;color:#374151"', 'style="display:block;font-size:13px;font-weight:600;color:#374151"')
    content = content.replace('padding:1px 7px;border-radius:10px;background:#e9f8df;color:#4fa62a;font-size:12px', 'padding:1px 6px;border-radius:10px;background:#e9f8df;color:#4fa62a;font-size:11px')
    return content.replace(
        '</span></div></div></td><td style="width:4%;min-width:26px">',
        '</span><small v-if="age(row)" style="display:block;margin-top:1px;color:#6b7280;font-size:11px;line-height:1.3">{{ age(row) }}</small></div></div></td><td style="width:4%;min-width:26px">'
    )

def replace_received_or_resulted(code, status):
    code = code.replace("const PROVIDER={providerId:'6a75a7810796231c653df996',providerType:'FORM',params:{},options:{}}", f"const PROVIDER={{providerId:'{STATUS_FORM_ID}',providerType:'FORM',params:{{}},options:{{}}}}")
    code = code.replace('row&&row.selected_items_json', 'row&&row.selected_items')
    code = code.replace('row&&row.biochemistry_specimen_json', 'row&&row.specimens')
    code = code.replace("const status=String(r.order_status||'');", "const status=String(r.work_status||'');")
    code = code.replace("String(r.lab_section||'')===activeLab", "[String(activeLab||''),String(s.labUnitCode()||'')].includes(String(r.section_code||''))")
    code = code.replace("String(r.section_code||'')===activeLab", "[String(activeLab||''),String(s.labUnitCode()||'')].includes(String(r.section_code||''))")
    code = code.replace("String(row.lab_no||'')", "String(row.order_number||row.lab_no||'')")
    code = code.replace("row.lab_no || 'รอกำหนด'", "row.order_number || row.lab_no || 'รอกำหนด'")
    code = code.replace("row.lab_no||''", "row.order_number||row.lab_no||''")
    code = re.sub(
        r"s\.specimen=row=>\{const x=s\.safeJson\(row&&row\.specimens\);const m=\{.*?\};return m\[x\.bloodType\]\|\|m\[x\.urineType\]\|\|m\[x\.type\]\|\|'-'\};",
        "s.specimen=row=>{const x=s.safeJson(row&&row.specimens);const list=Array.isArray(x)?x:[];const seen={};return list.map(v=>String(v.label||v.specimen_name||v.specimen_code||'')).filter(v=>v&&!seen[v]&&(seen[v]=true)).join(' · ')||'-'};",
        code,
    )
    if status == 'received':
        # Editing must reopen the original LabCen record.  Repointing this to
        # Status breaks Update semantics and the add/remove audit history.
        code = code.replace(
            f"form.openForm('{STATUS_FORM_ID}'",
            f"form.openForm('{CENTER_LAB_FORM_ID}'",
        )
        # The received workspace is a transient EMR-style selection now.  Do
        # not start the old persisted-received query before STATE_PATCH takes
        # over, otherwise its late callback clears the selected patient card.
        code = code.replace("};s.load();;s.startProcess", "};s.startProcess")
        code = code.replace("s.watchLabContext();s.__labContextTimer=", "s.__labLastSection=s.currentLabSection();s.__labContextTimer=")
        code = code.replace("api.runProcess('6a789afecc7d0a845113039e',{source_order_id:id,action:'start_process'}", f"api.runProcess('{STATUS_PROCESS_ID}',{{action:'update_work_status',order_number:String(row.order_number||row.lab_no||''),work_status:'processing'}}")
        start_success = "field.notify(body.message || 'เริ่มดำเนินการแล้ว', 'success');"
        if "const resultRef=form&&form.getFieldRef&&form.getFieldRef('lab_resulted_component')" not in code:
            code = code.replace(
                start_success,
                start_success + "s.clearReceiveRow();const resultRef=form&&form.getFieldRef&&form.getFieldRef('lab_resulted_component'),allRef=form&&form.getFieldRef&&form.getFieldRef('lab_all_orders_center_specimen');if(resultRef&&resultRef.vueState&&typeof resultRef.vueState.load==='function')resultRef.vueState.load();if(allRef&&allRef.vueState&&typeof allRef.vueState.load==='function')allRef.vueState.load();const tabs=form&&form.getFieldRef&&form.getFieldRef('lab_biochem_tabs');if(tabs)tabs.activeTabName='tab-pane-lab-resulted';setTimeout(()=>{const liveTabs=form&&form.getFieldRef&&form.getFieldRef('lab_biochem_tabs');if(liveTabs)liveTabs.activeTabName='tab-pane-lab-resulted'},0);",
                1,
            )
    elif status == 'resulted':
        code = code.replace("return isBio&&status==='resulted'", "return isBio&&['processing','resulted','completed'].includes(status)")
    return code


def repair_new_order_refresh(code):
    """Refresh the mounted Lab widgets after LabCen saves a new order."""
    if 's.createNewLabOrder' not in code:
        return code
    return code.replace(
        "['lab_waiting_orders','lab_received_component','lab_resulted_component']",
        "['lab_all_orders_center_specimen','lab_waiting_center_specimen','lab_waiting_orders','lab_received_component','lab_resulted_component']",
        1,
    )


def remove_legacy_cancelled_filter(code):
    """Stop the old Lab Bio watcher from overwriting the Status ListView.

    That watcher still queries the former Lab Bio schema (`lab_section` and
    `order_status`).  The cancelled ListView now reads the Status form, whose
    fields are `section_code` and `work_status`; applying the legacy query a
    moment after mount makes a valid rejected row flash and then disappear.
    """
    return re.sub(
        r",\['lab_cancelled_listview_final',\"lab_section = '\"\+next\+\"' AND order_status = 'rejected'\"\]",
        "",
        code,
    )


def cancelled_room_filter_script():
    """Let the cancelled ListView own its Organization filter.

    Tab panes are lazy-mounted, so the waiting queue cannot reliably prepare
    this ListView.  Apply the Status-schema filter from the ListView lifecycle
    itself and refresh only when the effective room condition changes.
    """
    return f"""const field=this;const SECTION_BY_ORG={SECTION_BY_ORG};
field.__cancelledWhere='';
field.__cancelledReadOrg=()=>{{const form=field.getFormRef&&field.getFormRef(),states=[field.globalUserState,form&&form.userState];for(let i=0;i<states.length;i++){{const state=states[i]||{{}},user=state.user||state,raw=user.unit||user.currentUnit||user.xunitx||state.unit||state.currentUnit||state.xunitx;if(raw!=null)return raw}}return(typeof userInfo!=='undefined'&&userInfo&&userInfo.unit)||null}};
field.__cancelledOrgCode=()=>{{const raw=field.__cancelledReadOrg();if(raw==null)return '';if(typeof raw==='string'||typeof raw==='number')return String(raw).trim();return String(raw.code||raw.unit_code||raw.value||raw.id||'').trim()}};
field.__cancelledSectionCodes=()=>{{const raw=String(field.__cancelledOrgCode()||'').toUpperCase(),mapped=String(SECTION_BY_ORG[raw]||'').toUpperCase(),split=value=>String(value||'').split(/[\\s,\\/-]+/).filter(Boolean);return[raw,mapped,...split(raw),...split(mapped)].filter((value,index,all)=>value&&all.indexOf(value)===index&&/^[A-Z0-9-]+$/i.test(value))}};
field.__applyCancelledRoomFilter=()=>{{const codes=field.__cancelledSectionCodes();if(!codes.length)return false;const where='('+codes.map(code=>\"section_code = '\"+code+\"'\").join(' OR ')+\") AND work_status = 'rejected'\";if(field.__cancelledWhere===where)return true;const editor=field.getFieldEditor&&field.getFieldEditor();if(editor){{editor.dpFormData=editor.dpFormData||{{}};editor.dpFormData.options=editor.dpFormData.options||{{}};editor.defaultWhere=where;editor.dpFormData.options.where=where;field.__cancelledWhere=where;if(typeof editor.handleRefresh==='function')editor.handleRefresh();return true}}if(typeof field.setFieldOption==='function'){{field.setFieldOption('where',where);field.__cancelledWhere=where;return true}}return false}};
field.__applyCancelledRoomFilter();
if(field.__cancelledRoomTimer)clearInterval(field.__cancelledRoomTimer);
field.__cancelledRoomTimer=setInterval(()=>field.__applyCancelledRoomFilter(),800);"""


data = json.loads(PATH.read_text(encoding='utf-8'))
found = set()
for node in walk(data):
    options = node.get('options') if isinstance(node, dict) else None
    if not isinstance(options, dict):
        continue
    name = options.get('name')
    if name == 'lab_all_orders_center_specimen':
        node.update({'name': 'Components', 'component': 'vue-ui', 'category': 'display_ui', 'icon': 'vue-ui', 'fieldType': 'None', 'formItemFlag': False})
        all_content = compact_patient_table(queue_content('all'))
        options.update({'hidden': False, 'label': 'Components', 'content': all_content, 'onCreated': queue_script('all'), 'onMounted': '', 'onUnmount': "if(this.vueState&&this.vueState.__allOrdersRefreshTimer)clearInterval(this.vueState.__allOrdersRefreshTimer);"})
        found.add(name)
    elif name == 'lab_waiting_center_specimen':
        node.update({'name': 'Components', 'component': 'vue-ui', 'category': 'display_ui', 'icon': 'vue-ui', 'fieldType': 'None', 'formItemFlag': False})
        # This tab uses a dedicated responsive row rather than the all-orders
        # table.  It prevents a second horizontal scrollbar in the Lab screen.
        waiting_content = waiting_list_content()
        options.update({'hidden': False, 'label': 'Components', 'content': waiting_content, 'onCreated': queue_script('waiting'), 'onMounted': '', 'onUnmount': "if(this.vueState&&this.vueState.__waitingOrgTimer)clearInterval(this.vueState.__waitingOrgTimer);"})
        found.add(name)
    elif name == 'lab_received_component':
        options['onCreated'] = replace_received_or_resulted(options.get('onCreated', ''), 'received')
        options['onUnmount'] = "if(this.vueState&&this.vueState.__labReceiveNavTimer)clearInterval(this.vueState.__labReceiveNavTimer);"
        found.add(name)
    elif name == 'lab_resulted_component':
        options.update({
            'content': resulted_list_content(),
            'onCreated': resulted_list_script(),
            'onMounted': '',
            'onUnmount': "if(this.vueState&&this.vueState.__resultedOrgTimer)clearInterval(this.vueState.__resultedOrgTimer);",
        })
        found.add(name)
    elif name == 'lab_cancelled_listview_final':
        options.update({
            'formId': STATUS_FORM_ID,
            # The ListView replaces this guard from its own lifecycle as soon
            # as the lazy cancelled tab mounts.  Until then it cannot expose a
            # rejected row from another Organization.
            'where': "section_code = '__ROOM_NOT_READY__' AND work_status = 'rejected'",
            # Its own room watcher refreshes only when Organization changes.
            # A WebSocket reload could restore the guard between those events.
            'enableWs': False,
            'searchField': ['patient_hn', 'patient_name', 'ward_clinic', 'order_number'],
            'detailContent': CANCELLED_DETAIL,
            'customValue': CANCELLED_CUSTOM_VALUES,
            'buttonsRow': [RECHECK_BUTTON],
            'onCreated': cancelled_room_filter_script(),
            'onMounted': "if(this.__applyCancelledRoomFilter)this.__applyCancelledRoomFilter();",
            'onUnmount': "if(this.__cancelledRoomTimer)clearInterval(this.__cancelledRoomTimer);"
        })
        found.add(name)
    options['onCreated'] = remove_legacy_cancelled_filter(
        repair_new_order_refresh(options.get('onCreated', ''))
    )

required = {'lab_all_orders_center_specimen', 'lab_waiting_center_specimen', 'lab_received_component', 'lab_resulted_component', 'lab_cancelled_listview_final'}
missing = required - found
if missing:
    raise RuntimeError('ไม่พบ widget: ' + ', '.join(sorted(missing)))

# Tab must start with one active pane.  Keeping both "รายการรวม" and "รอรับ"
# active leaves the runtime Tab proxy in an ambiguous state and prevents the
# EMR-style receive action from selecting the received pane.
for node in walk(data):
    options = node.get('options') if isinstance(node, dict) else None
    if isinstance(options, dict) and options.get('name') == 'lab_biochem_tabs':
        for pane in node.get('tabs') or []:
            pane_options = pane.get('options') or {}
            pane_options['active'] = pane.get('id') == 'tab-pane-lab-waiting'

WAITING_LIST_CSS_MARKER = '/* Lab waiting list v2 */'
hover_css = """
/* Lab waiting list v2 */
.lab-waiting-panel{overflow:hidden}.lab-waiting-toolbar{padding:14px 16px}.lab-waiting-list{display:grid;gap:0;border-top:1px solid #e7ebf1}.lab-waiting-row{display:grid;grid-template-columns:minmax(235px,1.08fr) minmax(185px,.78fr) minmax(410px,1.35fr) 184px;align-items:center;gap:14px;min-width:0;padding:13px 20px;border-bottom:1px solid #e7ebf1;background:#fff;outline:none;transition:background .12s ease,box-shadow .12s ease}.lab-waiting-row:hover,.lab-waiting-row:focus-within{background:#f0f7ff;box-shadow:inset 3px 0 #4090ee}.lab-waiting-patient{display:flex;align-items:center;gap:12px;min-width:0}.lab-waiting-avatar{display:grid;flex:0 0 58px;width:58px;height:58px;place-items:center;overflow:hidden;border:1px solid #d7dce5;border-radius:9px;background:#f3f5f8}.lab-waiting-avatar img{width:100%;height:100%;object-fit:cover}.lab-waiting-avatar svg{width:42px;height:42px;fill:#9ca3af}.lab-waiting-identity{display:grid;min-width:0;line-height:1.24}.lab-waiting-labno{overflow:hidden;color:#1f2937;font-size:17px;text-overflow:ellipsis;white-space:nowrap}.lab-waiting-identity small{overflow:hidden;color:#6b7280;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.lab-waiting-identity strong{overflow:hidden;color:#374151;font-size:14px;text-overflow:ellipsis;white-space:nowrap}.lab-waiting-sex{display:inline-block;margin-left:5px;padding:2px 7px;border-radius:10px;background:#e9f8df;color:#4fa62a;font-size:11px}.lab-waiting-context{display:flex;align-content:center;align-items:center;gap:5px;min-width:0;flex-wrap:wrap}.lab-context-chip{display:inline-block;max-width:100%;padding:4px 8px;overflow:hidden;border-radius:0;font-size:12px;font-weight:700;line-height:1.15;text-overflow:ellipsis;white-space:nowrap}.lab-context-chip.source{background:#eef6ff;color:#3b82f6}.lab-context-chip.paid{background:#e9f8df;color:#4fa62a}.lab-context-chip.right{background:#fff3d5;color:#a16207}.lab-waiting-order{display:grid;grid-template-columns:minmax(80px,1.05fr) minmax(82px,1.05fr) 58px 78px minmax(100px,1.25fr);gap:8px;min-width:0}.lab-waiting-order>div{display:grid;min-width:0;gap:3px}.lab-waiting-order small{overflow:hidden;color:#8a94a3;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.lab-waiting-order b,.lab-waiting-order>div>span{overflow:hidden;color:#505966;font-size:13px;text-overflow:ellipsis;white-space:nowrap}.lab-waiting-order .lab-status-tag{justify-self:start;max-width:100%;font-size:12px}.lab-waiting-actions{display:flex;justify-content:flex-end;min-width:0}.lab-hover-action-group{display:flex;justify-content:flex-end;gap:6px;min-width:170px;opacity:0;pointer-events:none;visibility:hidden;transition:opacity .12s ease}.lab-waiting-row:hover .lab-hover-action-group,.lab-waiting-row:focus-within .lab-hover-action-group,.lab-hover-action-group:focus-within{opacity:1;pointer-events:auto;visibility:visible}@media(max-width:1380px){.lab-waiting-row{grid-template-columns:minmax(220px,1.1fr) minmax(165px,.76fr) minmax(300px,1.1fr) 174px;gap:10px;padding:12px 14px}.lab-waiting-order{grid-template-columns:1fr 1fr 54px 70px;gap:6px}.lab-waiting-order>div:last-child{display:none}.lab-hover-action-group{min-width:160px}}@media(max-width:1040px){.lab-waiting-row{grid-template-columns:minmax(220px,1fr) minmax(190px,.84fr) 174px}.lab-waiting-order{grid-column:1 / span 2;grid-row:2}.lab-waiting-actions{grid-column:3;grid-row:1 / span 2}}@media(max-width:720px){.lab-waiting-row{grid-template-columns:minmax(0,1fr);gap:10px;padding:13px}.lab-waiting-context,.lab-waiting-order,.lab-waiting-actions{grid-column:auto;grid-row:auto}.lab-waiting-order{grid-template-columns:repeat(2,minmax(0,1fr))}.lab-waiting-actions{justify-content:flex-start}.lab-hover-action-group{opacity:1;pointer-events:auto;visibility:visible}}
"""
form_css = data.setdefault('formConfig', {}).get('cssCode') or ''
if WAITING_LIST_CSS_MARKER in form_css:
    before, _, _ = form_css.partition(WAITING_LIST_CSS_MARKER)
    # v2 is appended after all prior rules; replace its whole generated tail
    # when regenerating instead of accumulating conflicting selectors.
    form_css = before.rstrip()
data['formConfig']['cssCode'] = form_css + '\n' + hover_css

PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
