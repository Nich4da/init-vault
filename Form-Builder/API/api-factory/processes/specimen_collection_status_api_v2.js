/*
 * ROLLBACK / DIAGNOSTIC SOURCE ONLY.
 * Do not publish this shortened variant for the current LabCen flow.
 * Current deploy source: specimen-collection-status-api.js
 *
 * This file intentionally remains in the workspace so the earlier core can
 * still be compared, but it lacks the complete VN hydration/reconciliation
 * and contains the audit-overwrite behavior repaired in the deploy source.
 */

const STATUS_FORM_ID='6a7daa3e8d398c11cf2fe869';
const SPECIMEN_COLLECTION_STATUS='zdata_specimen_collection_status';
const CENTER_LAB_ORDER_COLLECTION='zdata_lab_center_order';
const CENTER_LAB_COUNTER_COLLECTION='zdata_lab_order_number_counter';

const STATUS_PROVIDER={
  providerId:STATUS_FORM_ID,
  providerType:'FORM',
  params:{},
  options:{limit:1000,page:1}
};

const VALID_SPECIMEN_STATUS=['waiting','collected','sent'];
const VALID_WORK_STATUS=['waiting_receive','received','processing','resulted','completed','rejected','cancelled'];
const WORK_TRANSITIONS={
  waiting_receive:['received','rejected','cancelled'],
  received:['processing','rejected','cancelled'],
  processing:['resulted','rejected','cancelled'],
  resulted:['completed','rejected'],
  completed:[],
  rejected:[],
  cancelled:[]
};

const actor=String(userInfo.username||(userInfo.account&&(userInfo.account.name||userInfo.account.username))||'');
const now=app.curDate('YYYY-MM-DD HH:mm:ss');

const valueText=value=>value==null?'':String(value);
const recordId=row=>valueText(row&&(row._id||row.id));
const parseArray=value=>{
  if(Array.isArray(value))return value;
  try{
    const parsed=typeof value==='string'?JSON.parse(value||'[]'):value;
    return Array.isArray(parsed)?parsed:[];
  }catch(e){
    return [];
  }
};
const jsonArray=value=>JSON.stringify(parseArray(value));
const normalStatus=value=>{
  const status=valueText(value||'waiting').toLowerCase();
  return VALID_SPECIMEN_STATUS.indexOf(status)>-1?status:'waiting';
};
const defaultWorkStatus=status=>status==='sent'?'waiting_receive':'';

const getFormRows=async()=>{
  const result=await app.sdformGetAll(STATUS_PROVIDER,true,userInfo);
  if(!result||!result.success){
    return {success:false,message:(result&&result.message)||'อ่าน Lab Specimen Collection Status Form ไม่สำเร็จ',rows:[]};
  }
  return {success:true,message:'ok',rows:Array.isArray(result.data)?result.data:[]};
};

const findFormByOrderNumber=async orderNumber=>{
  const result=await getFormRows();
  if(!result.success)return result;
  const key=valueText(orderNumber).trim();
  return {...result,row:result.rows.find(row=>valueText(row.order_number).trim()===key)||null};
};

const findRawByOrderNumber=async orderNumber=>{
  return app.dbFindOne({
    from:SPECIMEN_COLLECTION_STATUS,
    where:'order_number = :orderNumber',
    params:{orderNumber:valueText(orderNumber).trim()}
  });
};

const getRawRows=async()=>{
  const result=await app.dbFindAll(
    {from:SPECIMEN_COLLECTION_STATUS,orderBy:[{column:'created_at',sort:'DESC'}]},
    false,
    false
  );
  if(!result||!result.success){
    return {success:false,message:(result&&result.message)||'โหลดรายการไม่สำเร็จ',rows:[]};
  }
  return {success:true,message:'ok',rows:(result.reply&&result.reply.data)||[]};
};

const toFormData=(source,override)=>{
  const row=source||{};
  const patch=override||{};
  const specimenStatus=normalStatus(patch.specimen_status!==undefined?patch.specimen_status:row.specimen_status);
  const workStatus=valueText(patch.work_status!==undefined?patch.work_status:row.work_status)||defaultWorkStatus(specimenStatus);
  return {
    order_number:valueText(patch.order_number!==undefined?patch.order_number:row.order_number).trim(),
    section_code:valueText(patch.section_code!==undefined?patch.section_code:row.section_code).trim(),
    section_name:valueText(patch.section_name!==undefined?patch.section_name:row.section_name).trim(),
    specimen_status:specimenStatus,
    work_status:workStatus,
    patient_hn:valueText(patch.patient_hn!==undefined?patch.patient_hn:row.patient_hn).trim(),
    patient_name:valueText(patch.patient_name!==undefined?patch.patient_name:row.patient_name).trim(),
    ward_clinic:valueText(patch.ward_clinic!==undefined?patch.ward_clinic:row.ward_clinic),
    selected_items:jsonArray(patch.selected_items!==undefined?patch.selected_items:row.selected_items),
    specimens:jsonArray(patch.specimens!==undefined?patch.specimens:row.specimens),
    collected_at:valueText(patch.collected_at!==undefined?patch.collected_at:row.collected_at),
    collected_by:valueText(patch.collected_by!==undefined?patch.collected_by:row.collected_by),
    sent_at:valueText(patch.sent_at!==undefined?patch.sent_at:row.sent_at),
    sent_by:valueText(patch.sent_by!==undefined?patch.sent_by:row.sent_by),
    received_at:valueText(patch.received_at!==undefined?patch.received_at:row.received_at),
    received_by:valueText(patch.received_by!==undefined?patch.received_by:row.received_by),
    processing_at:valueText(patch.processing_at!==undefined?patch.processing_at:row.processing_at),
    processing_by:valueText(patch.processing_by!==undefined?patch.processing_by:row.processing_by),
    resulted_at:valueText(patch.resulted_at!==undefined?patch.resulted_at:row.resulted_at),
    resulted_by:valueText(patch.resulted_by!==undefined?patch.resulted_by:row.resulted_by),
    rejected_at:valueText(patch.rejected_at!==undefined?patch.rejected_at:row.rejected_at),
    rejected_by:valueText(patch.rejected_by!==undefined?patch.rejected_by:row.rejected_by),
    reject_reason_code:valueText(patch.reject_reason_code!==undefined?patch.reject_reason_code:row.reject_reason_code),
    reject_reason_detail:valueText(patch.reject_reason_detail!==undefined?patch.reject_reason_detail:row.reject_reason_detail)
  };
};

const validateCreate=data=>{
  const required=['order_number','section_code','section_name','patient_hn','patient_name'];
  const missing=required.filter(key=>!valueText(data[key]).trim());
  return missing.length?'missing required fields: '+missing.join(', '):'';
};

const saveForm=async(id,data)=>{
  return app.sdformSetOne(STATUS_FORM_ID,id||'',data,1,userInfo);
};

// Form Provider scopes native ListView by xunitx, so the record must belong
// to the Lab section that will receive it, not the unit of the central caller.
const routeToLabUnit=async(id,data)=>{
  const record=id&&app.dbObjectId(id);
  if(!record)return {success:false,message:'ไม่พบ record id สำหรับกำหนดห้อง Lab'};
  return app.dbUpdate(
    {
      dataid:valueText(id),
      xrstatx:1,
      xunitx:{code:valueText(data.section_code),name:valueText(data.section_name)}
    },
    SPECIMEN_COLLECTION_STATUS,
    userInfo,
    {_id:record}
  );
};

/*
 * LabCen bridge (additive)
 *
 * The original actions below remain unchanged.  These helpers only support
 * the existing Center Lab Insert/Update event adapters.  One Center order is
 * normalized into one Status row per selected Lab section.  A generated
 * LAB NO. is persisted back into that section in selected_items_json so an
 * Update reuses the same number instead of allocating a duplicate.
 */
const bridgeText=value=>{
  if(value==null)return '';
  if(typeof value==='object'){
    if(value.$oid!=null)return bridgeText(value.$oid);
    if(value._id!=null)return bridgeText(value._id);
    if(value.id!=null)return bridgeText(value.id);
    if(value.value!=null&&typeof value.value!=='object')return bridgeText(value.value);
  }
  return String(value).trim();
};
const bridgeRecordId=row=>{
  const source=row||{};
  const candidates=[source.__bridge_id,source.dataid,source.id,source._id];
  for(const candidate of candidates){
    const text=bridgeText(candidate);
    const match=text.match(/[a-fA-F0-9]{24}/);
    if(match)return match[0];
  }
  return '';
};
const bridgeSection=row=>{
  const source=row||{};
  return {
    code:bridgeText(source.section_code||source.sectionCode||source.lab_section||source.section||source.unit_code||source.unit),
    name:bridgeText(source.section_name||source.sectionName||source.lab_name||source.unit_name)
  };
};
const bridgeRoomCode=sectionCode=>{
  const raw=bridgeText(sectionCode).toUpperCase();
  const map={BC:'10',HM:'20',HEM:'20',ML:'21',HH:'22',IM:'30','MI-OUT':'31',MB:'40',MY:'41',BB:'50',BG:'70'};
  return map[raw]||raw;
};
const bridgeGroupOrderNumber=(group,items)=>{
  const direct=bridgeText(group&&(group.order_number||group.lab_no));
  if(direct)return direct;
  const numbers=[];
  (items||[]).forEach(item=>{
    const number=bridgeText(item&&(item.order_number||item.lab_no));
    if(number&&numbers.indexOf(number)===-1)numbers.push(number);
  });
  return numbers.length===1?numbers[0]:'';
};
const bridgeItemSpecimens=(sectionCode,items)=>{
  const seen={};
  return (items||[]).map(item=>{
    const row=item||{};
    let specimen=row.c_specimen||row.specimen||{};
    if(typeof specimen==='string')specimen={specimen_code:specimen,label:specimen};
    const code=bridgeText(specimen.specimen_code||specimen.code||row.specimen_code);
    const label=bridgeText(specimen.label||specimen.specimen_name||row.specimen_name||code);
    const key=code+'|'+label;
    if(!label||seen[key])return null;
    seen[key]=true;
    return {section_code:sectionCode,specimen_code:code,label};
  }).filter(Boolean);
};
const normalizeBridgeGroups=value=>{
  const list=parseArray(value);
  const grouped=list.length>0&&list.every(row=>row&&Object.prototype.hasOwnProperty.call(row,'selected_items'));
  if(grouped){
    return list.map(row=>{
      const items=parseArray(row.selected_items);
      const direct=bridgeSection(row);
      const fallback=bridgeSection(items[0]);
      const code=direct.code||fallback.code;
      const name=direct.name||fallback.name;
      const specimens=parseArray(row.specimens);
      return {
        ...row,
        section_code:code,
        section_name:name,
        order_number:bridgeGroupOrderNumber(row,items),
        selected_items:items,
        specimens:specimens.length?specimens:bridgeItemSpecimens(code,items)
      };
    }).filter(group=>group.section_code&&parseArray(group.selected_items).length);
  }
  const bySection={};
  const order=[];
  list.forEach(item=>{
    const section=bridgeSection(item);
    const key=section.code||section.name;
    if(!key)return;
    if(!bySection[key]){
      bySection[key]={section_code:section.code,section_name:section.name,selected_items:[]};
      order.push(key);
    }
    bySection[key].selected_items.push(item);
  });
  return order.map(key=>{
    const group=bySection[key];
    return {
      ...group,
      order_number:bridgeGroupOrderNumber(group,group.selected_items),
      specimens:bridgeItemSpecimens(group.section_code,group.selected_items)
    };
  });
};
const nextBridgeLabNo=async sectionCode=>{
  const refCode=bridgeText(sectionCode).toUpperCase().padStart(2,'0').slice(0,2);
  const ceYear=Number(app.curDate('YYYY'));
  const yy=String((ceYear+543)%100).padStart(2,'0');
  const key='center_lab_order_'+refCode+yy;
  const found=await app.dbFindOne({from:CENTER_LAB_COUNTER_COLLECTION,where:'code = :key',params:{key}});
  const current=(found&&found.success&&found.reply&&found.reply.data&&Number(found.reply.data.count))||0;
  const next=current+1;
  const saved=await app.dbUpdate({code:key,count:next},CENTER_LAB_COUNTER_COLLECTION,userInfo,{code:key},true);
  if(!saved||!saved.success)throw Error((saved&&saved.message)||'สร้างลำดับ LAB NO. ไม่สำเร็จ');
  return refCode+yy+String(next).padStart(6,'0');
};
const findBridgeStatus=async(centerOrderId,roomCode,orderNumber)=>{
  if(orderNumber){
    const exact=await findRawByOrderNumber(orderNumber);
    if(exact&&exact.success&&exact.reply&&exact.reply.data){
      return {...exact.reply.data,__bridge_id:bridgeText(exact.id)};
    }
  }
  if(!centerOrderId)return null;
  const linked=await app.dbFindOne({
    from:SPECIMEN_COLLECTION_STATUS,
    where:'center_order_id = :centerOrderId AND section_code = :sectionCode',
    params:{centerOrderId,sectionCode:roomCode}
  });
  return linked&&linked.success&&linked.reply&&linked.reply.data
    ? {...linked.reply.data,__bridge_id:bridgeText(linked.id)}
    : null;
};
const bridgeItemKey=item=>bridgeText(item&&(item.id||item.master_id||item.item_code||item.code));
const bridgeItemSummary=item=>({code:bridgeText(item&&(item.code||item.item_code)),name:bridgeText(item&&(item.name||item.item_name||item.master_item_name))});
const bridgeItemDiff=(beforeValue,afterValue)=>{
  const before=parseArray(beforeValue),after=parseArray(afterValue),beforeMap={},afterMap={};
  before.forEach(item=>{const key=bridgeItemKey(item);if(key)beforeMap[key]=item});
  after.forEach(item=>{const key=bridgeItemKey(item);if(key)afterMap[key]=item});
  return {
    added:after.filter(item=>{const key=bridgeItemKey(item);return key&&!beforeMap[key]}).map(bridgeItemSummary),
    removed:before.filter(item=>{const key=bridgeItemKey(item);return key&&!afterMap[key]}).map(bridgeItemSummary)
  };
};
const bridgeSourceUnit=center=>{
  const source=center||{};
  const unit=source.source_unit_name||source.ward_clinic||source.sender_unit_name||source.origin_unit_name||source.xunitx||'';
  return bridgeText(unit&&typeof unit==='object'?(unit.name||unit.label||unit.unit_name||unit.value):unit);
};
const enrichBridgeStatus=async(id,center,group,roomCode,history)=>{
  const record=id&&app.dbObjectId(id);
  if(!record)return {success:false,message:'ไม่พบ Status record id'};
  const patch={
    center_order_id:bridgeRecordId(center),
    order_change_history_json:JSON.stringify(history||[]),
    ordered_at:bridgeText(center.ordered_at||center.requested_at||center.created_at),
    visit_id:bridgeText(center.visit_id||center.visit_id_link),
    visit_id_link:bridgeText(center.visit_id_link||center.visit_id),
    visit_vn:bridgeText(center.visit_vn||center.vn),
    patient_gender:bridgeText(center.patient_gender||center.gender),
    patient_birth_date:bridgeText(center.patient_birth_date||center.birth_date),
    patient_photo:bridgeText(center.patient_photo||center.patient_photo_url),
    source_unit_code:bridgeText(center.source_unit_code),
    source_unit_name:bridgeSourceUnit(center),
    inscl_hos_json:typeof center.inscl_hos_json==='string'?center.inscl_hos_json:JSON.stringify(center.inscl_hos_json||[]),
    dataid:bridgeText(id),
    xrstatx:1,
    xunitx:{code:roomCode,name:bridgeText(group.section_name)||roomCode}
  };
  return app.dbUpdate(patch,SPECIMEN_COLLECTION_STATUS,userInfo,{_id:record});
};
const persistBridgeGroups=async(centerOrderId,groups)=>{
  const record=centerOrderId&&app.dbObjectId(centerOrderId);
  if(!record)return {success:false,message:'ไม่พบ Center Lab record id'};
  return app.dbUpdate(
    {selected_items_json:JSON.stringify(groups)},
    CENTER_LAB_ORDER_COLLECTION,
    userInfo,
    {_id:record}
  );
};
const materializeBridgeCenterOrder=async center=>{
  const source=center||{};
  const centerOrderId=bridgeText(source.center_order_id||source.center_lab_order_id||source._id||source.id||source.dataid);
  if(!centerOrderId)return {success:false,message:'center_order_id is required'};
  const groups=normalizeBridgeGroups(source.selected_items_json||source.selected_items);
  if(!groups.length)return {success:false,message:'selected_items_json ไม่มีรายการ Lab ที่แยก section ได้'};
  const created=[];
  const updated=[];
  const failed=[];
  let centerChanged=false;
  for(let index=0;index<groups.length;index++){
    let group=groups[index];
    const sourceSection=bridgeText(group.section_code);
    const roomCode=bridgeRoomCode(sourceSection);
    if(!roomCode){failed.push({section_code:sourceSection,reason:'ไม่พบ section_code'});continue;}
    const existingBeforeNumber=await findBridgeStatus(centerOrderId,roomCode,bridgeText(group.order_number));
    let orderNumber=bridgeText(group.order_number)||(existingBeforeNumber&&bridgeText(existingBeforeNumber.order_number));
    if(!orderNumber)orderNumber=await nextBridgeLabNo(sourceSection||roomCode);
    const items=parseArray(group.selected_items).map(item=>{
      if(bridgeText(item.order_number)===orderNumber)return item;
      centerChanged=true;
      return {...item,order_number:orderNumber};
    });
    if(bridgeText(group.order_number)!==orderNumber){centerChanged=true;group={...group,order_number:orderNumber};}
    group={...group,selected_items:items};
    groups[index]=group;
    try{
      const existing=existingBeforeNumber||await findBridgeStatus(centerOrderId,roomCode,orderNumber);
      const previousHistory=parseArray(existing&&(existing.order_change_history_json||existing.order_change_history));
      const diff=bridgeItemDiff(existing&&existing.selected_items,items);
      const history=previousHistory.slice();
      if(existing&&(diff.added.length||diff.removed.length)){
        history.push({changed_at:now,changed_by:actor,added:diff.added,removed:diff.removed});
      }
      const statusSource={
        ...(existing||{}),
        order_number:orderNumber,
        section_code:roomCode,
        section_name:bridgeText(group.section_name)||roomCode,
        patient_hn:bridgeText(source.patient_hn||source.hn),
        patient_name:bridgeText(source.patient_name||source.full_name),
        ward_clinic:bridgeSourceUnit(source),
        selected_items:items,
        specimens:parseArray(group.specimens),
        specimen_status:existing?existing.specimen_status:'waiting',
        work_status:existing?existing.work_status:''
      };
      const data=toFormData(statusSource,{});
      const validationError=validateCreate(data);
      if(validationError)throw Error(validationError);
      const saved=await saveForm(existing?bridgeRecordId(existing):'',data);
      if(!saved||!saved.success)throw Error((saved&&saved.message)||'บันทึก Status ไม่สำเร็จ');
      const id=existing?bridgeRecordId(existing):bridgeText(saved.id||bridgeRecordId(saved.data));
      if(!id)throw Error('บันทึก Status สำเร็จแต่ไม่พบ record id');
      const routed=await routeToLabUnit(id,data);
      if(!routed||!routed.success)throw Error((routed&&routed.message)||'กำหนดห้อง Lab ไม่สำเร็จ');
      const enriched=await enrichBridgeStatus(id,source,group,roomCode,history);
      if(!enriched||!enriched.success)throw Error((enriched&&enriched.message)||'บันทึกข้อมูลเชื่อม LabCen ไม่สำเร็จ');
      const result={id,order_number:orderNumber,section_code:roomCode,section_name:data.section_name};
      if(existing)updated.push({...result,added_count:diff.added.length,removed_count:diff.removed.length});
      else created.push(result);
    }catch(error){
      failed.push({order_number:orderNumber,section_code:roomCode,reason:bridgeText(error&&error.message||error)});
    }
  }
  if(centerChanged){
    const persisted=await persistBridgeGroups(centerOrderId,groups);
    if(!persisted||!persisted.success)failed.push({center_order_id:centerOrderId,reason:(persisted&&persisted.message)||'บันทึก LAB NO. กลับ LabCen ไม่สำเร็จ'});
  }
  return {
    success:failed.length===0,
    message:failed.length?'สร้าง/อัปเดต Lab Status สำเร็จบางส่วน':'สร้าง/อัปเดต Lab Status สำเร็จ',
    center_order_id:centerOrderId,
    created,
    updated,
    failed
  };
};

if(params.action==='materialize_center_order'){
  const source=(params.center_record&&typeof params.center_record==='object')
    ? {...params.center_record,center_order_id:params.center_order_id||params.center_record._id||params.center_record.id}
    : params;
  return materializeBridgeCenterOrder(source);
}

if(params.action==='get_order'||params.action==='hydrate_visit_context'){
  const orderNumber=bridgeText(params.order_number||params.lab_no);
  if(!orderNumber)return {success:false,message:'order_number is required'};
  const found=await findRawByOrderNumber(orderNumber);
  const row=found&&found.reply&&found.reply.data;
  if(!found.success||!row)return {success:false,message:'ไม่พบรายการสำหรับ order_number '+orderNumber};
  return {success:true,order_number:orderNumber,row};
}

if(params.action==='resolve_center_order'){
  const orderNumber=bridgeText(params.order_number||params.lab_no);
  if(!orderNumber)return {success:false,message:'order_number is required'};
  const found=await findRawByOrderNumber(orderNumber);
  const status=found&&found.reply&&found.reply.data;
  const linked=bridgeText(status&&status.center_order_id);
  if(linked)return {success:true,center_order_id:linked,resolution:'linked'};
  const centers=await app.dbFindAll({from:CENTER_LAB_ORDER_COLLECTION},false,false);
  const rows=centers&&centers.success&&centers.reply&&centers.reply.data||[];
  const matches=rows.filter(center=>normalizeBridgeGroups(center.selected_items_json).some(group=>bridgeText(group.order_number)===orderNumber));
  if(matches.length!==1)return {success:false,message:matches.length?'พบ LabCen มากกว่าหนึ่ง record สำหรับ LAB NO. '+orderNumber:'ไม่พบ LabCen สำหรับ LAB NO. '+orderNumber};
  return {success:true,center_order_id:bridgeRecordId(matches[0]),resolution:'lab_no'};
}

if(params.action==='mark_received_once'){
  const orderNumber=bridgeText(params.order_number||params.lab_no);
  if(!orderNumber)return {success:false,message:'order_number is required'};
  const found=await findRawByOrderNumber(orderNumber);
  const raw=found&&found.reply&&found.reply.data;
  const row=raw?{...raw,__bridge_id:bridgeText(found.id)}:null;
  if(!found.success||!row)return {success:false,message:'ไม่พบรายการสำหรับ order_number '+orderNumber};
  if(row.received_at)return {success:true,message:'มีเวลารับ specimen แล้ว',order_number:orderNumber,received_at:row.received_at,received_by:row.received_by||''};
  const saved=await saveForm(bridgeRecordId(row),toFormData(row,{received_at:now,received_by:actor}));
  if(!saved||!saved.success)return {success:false,message:(saved&&saved.message)||'บันทึกเวลารับ specimen ไม่สำเร็จ'};
  return {success:true,message:'บันทึกเวลารับ specimen แล้ว',order_number:orderNumber,received_at:now,received_by:actor};
}

if(params.action==='repair_room_routing'){
  const confirmed=params.confirm===true||params.confirm==='true';
  if(!confirmed)return {success:true,dry_run:true,message:'ส่ง confirm:true เพื่อกำหนด xunitx ของ Status ตาม section_code'};
  const result=await getRawRows();
  if(!result.success)return result;
  const updated=[];
  const failed=[];
  for(const row of result.rows){
    const roomCode=bridgeRoomCode(row.section_code);
    const orderNumber=bridgeText(row.order_number);
    if(!roomCode||!orderNumber){failed.push({order_number:orderNumber,reason:'ไม่มี section_code หรือ LAB NO.'});continue;}
    // Legacy Status rows may expose `_id` as a runtime BSON object and have
    // no `dataid`, which makes app.dbObjectId(_id) throw before the repair can
    // start.  LAB NO. is unique in this collection, so route legacy rows by
    // order_number and avoid an unnecessary ObjectId conversion entirely.
    const routed=await app.dbUpdate(
      {xrstatx:1,xunitx:{code:roomCode,name:bridgeText(row.section_name)||roomCode}},
      SPECIMEN_COLLECTION_STATUS,
      userInfo,
      {order_number:orderNumber}
    );
    if(routed&&routed.success)updated.push({order_number:row.order_number||'',section_code:roomCode});
    else failed.push({order_number:row.order_number||'',reason:(routed&&routed.message)||'กำหนดห้องไม่สำเร็จ'});
  }
  return {success:failed.length===0,message:'กำหนดห้อง Lab แล้ว '+updated.length+' รายการ',updated,failed};
}

if(params.action==='list'){
  const result=await getRawRows();
  if(!result.success)return {success:false,message:result.message};
  return {
    success:true,
    message:'ok',
    rows:result.rows.map(row=>({...row,lab_no:row.order_number||'',work_status:row.work_status||defaultWorkStatus(normalStatus(row.specimen_status))}))
  };
}

if(params.action==='create'){
  const input=(params.record&&typeof params.record==='object')?params.record:params;
  const data=toFormData(input,{specimen_status:'waiting',work_status:''});
  const validationError=validateCreate(data);
  if(validationError)return {success:false,message:validationError};

  const legacy=await findRawByOrderNumber(data.order_number);
  if(legacy.success&&legacy.reply&&legacy.reply.data){
    return {success:true,message:'มีรายการ Specimen Status อยู่แล้ว',id:recordId(legacy.reply.data),order_number:data.order_number,created:false};
  }

  const saved=await saveForm('',data);
  if(!saved||!saved.success)return {success:false,message:(saved&&saved.message)||'สร้าง Lab Specimen Collection Status Form ไม่สำเร็จ'};
  const id=saved.id||recordId(saved.data);
  const routed=await routeToLabUnit(id,data);
  if(!routed||!routed.success)return {success:false,message:(routed&&routed.message)||'สร้างรายการสำเร็จ แต่กำหนดห้อง Lab ไม่สำเร็จ'};
  return {success:true,message:'สร้างรายการ Specimen Status สำเร็จ',id,order_number:data.order_number,created:true};
}

if(params.action==='migrate_one'){
  const orderNumber=valueText(params.order_number).trim();
  if(!orderNumber)return {success:false,message:'order_number is required'};
  const legacy=await findRawByOrderNumber(orderNumber);
  const raw=legacy&&legacy.reply&&legacy.reply.data;
  if(!legacy.success||!raw)return {success:false,message:'ไม่พบรายการเดิมสำหรับ order_number '+orderNumber};
  const id=recordId(raw);
  if(!id)return {success:false,message:'รายการเดิมไม่มี record id'};
  const data=toFormData(raw,{});
  const validationError=validateCreate(data);
  if(validationError)return {success:false,message:validationError};
  const saved=await saveForm(id,data);
  if(!saved||!saved.success)return {success:false,message:(saved&&saved.message)||'ย้ายรายการเดิมเข้าฟอร์มไม่สำเร็จ'};
  const routed=await routeToLabUnit(id,data);
  if(!routed||!routed.success)return {success:false,message:(routed&&routed.message)||'ย้ายรายการสำเร็จ แต่กำหนดห้อง Lab ไม่สำเร็จ'};
  return {success:true,message:'ย้ายรายการเดิมเข้าผ่าน Form pipeline สำเร็จ',id,order_number:orderNumber};
}

if(params.action==='update'){
  const orderNumber=valueText(params.order_number).trim();
  const nextStatus=valueText(params.status).trim().toLowerCase();
  if(!orderNumber)return {success:false,message:'order_number is required'};
  if(VALID_SPECIMEN_STATUS.indexOf(nextStatus)===-1)return {success:false,message:'status must be one of '+VALID_SPECIMEN_STATUS.join(', ')};

  const found=await findRawByOrderNumber(orderNumber);
  const current=found&&found.reply&&found.reply.data;
  if(!found.success||!current)return {success:false,message:'ไม่พบรายการสำหรับ order_number '+orderNumber};

  const patch={specimen_status:nextStatus};
  if(nextStatus==='collected'){
    patch.collected_at=now;
    patch.collected_by=actor;
  }
  if(nextStatus==='sent'){
    patch.sent_at=now;
    patch.sent_by=actor;
    patch.work_status='waiting_receive';
  }

  const saved=await saveForm(recordId(current),toFormData(current,patch));
  if(!saved||!saved.success)return {success:false,message:(saved&&saved.message)||'บันทึกสถานะ Center Specimen ไม่สำเร็จ'};
  return {success:true,message:'อัปเดตสถานะ Center Specimen สำเร็จ',order_number:orderNumber,specimen_status:nextStatus,work_status:patch.work_status||valueText(current.work_status)};
}

if(params.action==='update_work_status'){
  const orderNumber=valueText(params.order_number).trim();
  const nextWorkStatus=valueText(params.work_status).trim().toLowerCase();
  if(!orderNumber)return {success:false,message:'order_number is required'};
  if(VALID_WORK_STATUS.indexOf(nextWorkStatus)===-1)return {success:false,message:'work_status must be one of '+VALID_WORK_STATUS.join(', ')};

  const found=await findRawByOrderNumber(orderNumber);
  const row=found&&found.reply&&found.reply.data;
  if(!found.success||!row)return {success:false,message:'ไม่พบรายการสำหรับ order_number '+orderNumber};
  if(normalStatus(row.specimen_status)!=='sent')return {success:false,message:'ห้อง Lab รับงานได้เฉพาะรายการที่ศูนย์กลางส่งต่อแล้ว'};

  const currentWorkStatus=valueText(row.work_status)||'waiting_receive';
  const allowedNext=WORK_TRANSITIONS[currentWorkStatus]||[];
  if(currentWorkStatus!==nextWorkStatus&&allowedNext.indexOf(nextWorkStatus)===-1){
    return {success:false,message:'ไม่สามารถเปลี่ยนสถานะจาก '+currentWorkStatus+' เป็น '+nextWorkStatus};
  }

  const patch={work_status:nextWorkStatus};
  if(nextWorkStatus==='received'){
    patch.received_at=now;
    patch.received_by=actor;
  }
  if(nextWorkStatus==='processing'){
    patch.processing_at=now;
    patch.processing_by=actor;
  }
  if(nextWorkStatus==='resulted'){
    patch.resulted_at=now;
    patch.resulted_by=actor;
  }
  if(nextWorkStatus==='rejected'){
    patch.rejected_at=now;
    patch.rejected_by=actor;
    patch.reject_reason_code=valueText(params.reject_reason_code);
    patch.reject_reason_detail=valueText(params.reject_reason_detail);
  }

  const saved=await saveForm(recordId(row),toFormData(row,patch));
  if(!saved||!saved.success)return {success:false,message:(saved&&saved.message)||'อัปเดตสถานะงานห้อง Lab ไม่สำเร็จ'};
  return {success:true,message:'อัปเดตสถานะงานห้อง Lab สำเร็จ',order_number:orderNumber,work_status:nextWorkStatus};
}

return {success:false,message:'unknown action: '+valueText(params.action)};
