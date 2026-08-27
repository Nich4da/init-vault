const STATUS_FORM_ID='6a7daa3e8d398c11cf2fe869';
const STATUS_PROCESS_ID='6a7e787e8d398c11cf2fe8b8';
const SPECIMEN_COLLECTION_STATUS='zdata_specimen_collection_status';
const CENTER_LAB_ORDER_COLLECTION='zdata_lab_center_order';
const CENTER_LAB_COUNTER_COLLECTION='zdata_lab_order_number_counter';
const VISIT_TRAN_FORM_ID='6a461235e521219e514d1c4b';
const VISIT_FORM_ID='6a40fdec4b6dfdf45acbfbce';
const VITAL_SIGN_FORM_ID='6a470b4939179670f85ba2d8';
const BMI_FORM_ID='ป6a4689ef39179670f85ba2a2';

// TEMPORARY DEVELOPMENT SWITCH — set this back to false when the Specimen
// team publishes its approve/send workflow.  While true, Lab staff can drive
// the receiving flow from an order that is still waiting/collected upstream.
// The UI and this server-side guard are changed together; neither alone is
// sufficient.
const DEV_ALLOW_EARLY_LAB_ACTIONS=true;

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

const valueText=value=>{
  if(value==null)return '';
  if(typeof value==='object'){
    if(typeof value.toHexString==='function')return String(value.toHexString());
    if(value.$oid!=null)return String(value.$oid);
    if(value._id!=null)return valueText(value._id);
    if(value.id!=null)return valueText(value.id);
    if(value.value!=null&&typeof value.value!=='object')return String(value.value);
  }
  return String(value);
};
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
const firstNonEmptyArray=(...values)=>{
  for(const value of values){
    const list=parseArray(value);
    if(list.length)return list;
  }
  return [];
};
const benefitLabels=value=>{
  const seen={};
  return parseArray(value).map(item=>{
    if(typeof item==='string'||typeof item==='number')return valueText(item).trim();
    const row=item||{};
    const main=row.inscl_item_main||{};
    return valueText(main.value||main.label||row.label||row.value||row.name||row.code).trim();
  }).filter(label=>label&&!seen[label]&&(seen[label]=true));
};
const parseObject=value=>{
  if(value&&typeof value==='object'&&!Array.isArray(value))return value;
  try{
    const parsed=typeof value==='string'?JSON.parse(value||'{}'):value;
    return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};
  }catch(e){
    return {};
  }
};
const jsonObject=value=>JSON.stringify(parseObject(value));
const normalStatus=value=>{
  const status=valueText(value||'waiting').toLowerCase();
  return VALID_SPECIMEN_STATUS.indexOf(status)>-1?status:'waiting';
};
const defaultWorkStatus=status=>status==='sent'?'waiting_receive':'';

const formRows=async provider=>{
  try{
    const result=await app.sdformGetAll(provider,false,userInfo);
    return result&&Array.isArray(result.data)?result.data:[];
  }catch(e){
    return [];
  }
};

const photoUrl=value=>{
  const photos=Array.isArray(value)?value:parseArray(value);
  const photo=photos[0];
  if(typeof photo==='string')return photo;
  if(photo&&typeof photo==='object')return valueText(photo.url||photo.path||photo.src);
  return valueText(value&&typeof value==='object'&&(value.url||value.path||value.src));
};

const sourceUnit=value=>{
  const raw=value&&typeof value==='object'?value:parseObject(value);
  return {
    code:valueText(raw.code||raw.unit_code||raw.value||raw.id),
    name:valueText(raw.name||raw.unit_name||raw.label||raw.text)
  };
};

const pickVital=value=>{
  const row=value||{};
  return {
    recorded_at:valueText(row.created_at),
    bp_h:row.bp_h==null?'':row.bp_h,
    bp_l:row.bp_l==null?'':row.bp_l,
    pulse:row.pulse==null?'':row.pulse,
    temp:row.temp==null?'':row.temp,
    rr:row.rr==null?'':row.rr
  };
};

const pickBmi=value=>{
  const row=value||{};
  return {
    recorded_at:valueText(row.created_at),
    weight:row.weight==null?'':row.weight,
    stature:row.stature==null?'':row.stature,
    bmi:row.bmi==null?'':row.bmi,
    bsa:row.bsa==null?'':row.bsa
  };
};

// Center Lab Order already keeps visit_id_link + visit_vn.  Resolve the same
// Visit Tran used by EMR so Status has a durable, small patient snapshot.
// Query failure never blocks a specimen status record from being created.
const hydrateVisitSnapshot=async source=>{
  // The normal path is Center Lab → Status with visit_id_link.  For older
  // records, prepareLabContext can still recover that link from the exactly
  // matching Center Lab record, then resolve a Visit only when HN/VN yields
  // one unambiguous active Visit.  It must never silently pick a past Visit.
  const prepared=await prepareLabContext(source||{});
  const resolved=await resolveVisitReference(prepared.source);
  const row={
    ...prepared.source,
    visit_id:resolved.visit_id||prepared.source.visit_id||prepared.source.visit_id_link,
    visit_vn:resolved.visit_vn||prepared.source.visit_vn||prepared.source.vn
  };
  const visitId=valueText(row.visit_id||row.visit_id_link).trim();
  const fallbackVn=valueText(row.visit_vn||row.vn).trim();
  // xunitx on the Status record is the *destination* Lab section.  Do not
  // use it as the sending room; prepareLabContext copies Center's xunitx to
  // source_unit first.
  const sourceInfo=sourceUnit(row.source_unit||row.origin_unit||row.sender_unit);
  const base={
    visit_id:visitId,
    visit_vn:fallbackVn,
    visit_time:valueText(row.visit_time),
    visit_type:valueText(row.visit_type||row.visit_type_label||row.service_type),
    person_id:valueText(row.person_id),
    patient_birth_date:valueText(row.patient_birth_date||row.birth_date),
    patient_age:valueText(row.patient_age||row.age),
    patient_gender:valueText(row.patient_gender||row.gender||row.p_gender),
    blood_group:valueText(row.blood_group||row.abo_group||row.p_abogroup),
    patient_phone:valueText(row.patient_phone||row.p_phone),
    patient_photo:valueText(row.patient_photo||row.photo_url),
    // Keep the allergy chips that EMR has already resolved for this visit.
    // The Lab page reads its status-row snapshot and never has to re-query
    // the full EMR record just to render the patient safety banner.
    allergy_tags_json:jsonArray(row.allergy_tags_json||row.allergy_tags||row.allergies||row.drug_allergy||[]),
    source_unit_code:valueText(row.source_unit_code||sourceInfo.code),
    source_unit_name:valueText(row.source_unit_name||sourceInfo.name||row.ward_clinic),
    inscl_hos_json:jsonArray(row.inscl_hos_json||row.inscl_hos||[]),
    vital_signs_json:jsonObject(row.vital_signs_json),
    bmi_json:jsonObject(row.bmi_json)
  };
  if(!visitId)return base;

  const visitTranProvider={
    providerId:VISIT_TRAN_FORM_ID,
    providerType:'FORM',
    params:{visitId},
    options:{where:"`vid.value` = CONVERT(:visitId, 'objectId')",limit:1,page:1}
  };
  const visitProvider={
    providerId:VISIT_FORM_ID,
    providerType:'FORM',
    params:{visitId},
    options:{where:"_id = CONVERT(:visitId, 'objectId')",limit:1,page:1}
  };
  const vitalProvider={
    providerId:VITAL_SIGN_FORM_ID,
    providerType:'FORM',
    params:{visitId},
    options:{where:"`vid.value` = CONVERT(:visitId, 'objectId')",orderBy:[{column:'created_at',sort:'DESC'}],limit:1,page:1}
  };
  const bmiProvider={
    providerId:BMI_FORM_ID,
    providerType:'FORM',
    params:{visitId},
    options:{where:"`vid.value` = CONVERT(:visitId, 'objectId')",orderBy:[{column:'created_at',sort:'DESC'}],limit:1,page:1}
  };
  const [visitTrans,visits,vitals,bmis]=await Promise.all([
    formRows(visitTranProvider),formRows(visitProvider),formRows(vitalProvider),formRows(bmiProvider)
  ]);
  const tran=visitTrans[0]||{};
  const visit=tran.vid||visits[0]||{};
  const person=visit.pid||((visits[0]&&visits[0].pid))||{};
  // A Status row is routed to its *destination* Lab via xunitx.  The
  // originating room must therefore come from the saved Center source first,
  // or (for older orders) from the actual Visit clinic.  A legacy row that
  // mistakenly stored its destination Lab as source is repaired here too.
  const visitClinic=sourceUnit(visit.visit_clinic||(visits[0]&&visits[0].visit_clinic));
  const destinationLab=sourceUnit(row.xunitx);
  const storedSourceName=valueText(base.source_unit_name).trim();
  const destinationName=valueText(destinationLab.name||row.section_name).trim();
  const storedSourceIsDestination=!!storedSourceName&&!!destinationName&&storedSourceName===destinationName;
  const resolvedSourceCode=valueText((storedSourceIsDestination?'':base.source_unit_code)||visitClinic.code||base.source_unit_code);
  const resolvedSourceName=valueText((storedSourceIsDestination?'':base.source_unit_name)||visitClinic.name||base.source_unit_name);
  const name=[
    person.prename&&person.prename.label,
    person.p_fname||person.first_name,
    person.p_lname||person.last_name
  ].filter(Boolean).join(' ').trim();
  // Visit Tran sometimes exposes the human-readable coverage as pttype[]
  // while its joined `vid` omits inscl_hos. Prefer Visit's canonical array,
  // then fall back to pttype so the Lab queue still shows the coverage.
  const benefits=firstNonEmptyArray(
    visits[0]&&visits[0].inscl_hos,
    visit.inscl_hos,
    tran.inscl_hos,
    row.inscl_hos_json,
    row.inscl_hos,
    tran.pttype,
    visit.pttype,
    row.pttype
  );
  return {
    ...base,
    visit_vn:valueText(visit.vn||base.visit_vn),
    visit_time:valueText(row.visit_time||tran.checkin_at||visit.visit_date),
    visit_type:valueText(visit.visit_type||base.visit_type),
    person_id:valueText(visit.xtbxlv1_xfx_id||person._id||base.person_id),
    patient_hn:valueText(person.hn||row.patient_hn),
    patient_name:valueText(name||row.patient_name),
    patient_birth_date:valueText(person.birth_date||base.patient_birth_date),
    patient_age:valueText(person.age||base.patient_age),
    patient_gender:valueText(person.p_gender||base.patient_gender),
    blood_group:valueText(person.p_abogroup||base.blood_group),
    patient_phone:valueText(person.p_phone||base.patient_phone),
    patient_photo:valueText(photoUrl(person.p_pic)||base.patient_photo),
    allergy_tags_json:jsonArray(tran.allergy_tags||row.allergy_tags_json||row.allergy_tags||row.allergies||[]),
    source_unit_code:resolvedSourceCode,
    source_unit_name:resolvedSourceName,
    inscl_hos_json:jsonArray(benefits),
    vital_signs_json:jsonObject(pickVital(vitals[0])),
    bmi_json:jsonObject(pickBmi(bmis[0]))
  };
};

// Read-only diagnostic for the real values returned by this installation's
// Visit/Visit Tran forms. It exposes only coverage fields, not patient data.
const inspectVisitBenefits=async visitId=>{
  const id=valueText(visitId).trim();
  if(!id)return {success:false,message:'visit_id is required'};
  const visitTranProvider={
    providerId:VISIT_TRAN_FORM_ID,providerType:'FORM',params:{visitId:id},
    options:{where:"`vid.value` = CONVERT(:visitId, 'objectId')",limit:1,page:1}
  };
  const visitProvider={
    providerId:VISIT_FORM_ID,providerType:'FORM',params:{visitId:id},
    options:{where:"_id = CONVERT(:visitId, 'objectId')",limit:1,page:1}
  };
  const [visitTrans,visits]=await Promise.all([formRows(visitTranProvider),formRows(visitProvider)]);
  const tran=visitTrans[0]||{};
  const visit=tran.vid||visits[0]||{};
  const selected=firstNonEmptyArray(
    visits[0]&&visits[0].inscl_hos,
    visit.inscl_hos,
    tran.inscl_hos,
    tran.pttype,
    visit.pttype
  );
  return {
    success:true,
    visit_id:id,
    visit_vn:valueText(visit.vn||tran.visit_vn||tran.vn),
    sources:{
      visit_inscl_hos:benefitLabels(visits[0]&&visits[0].inscl_hos),
      visit_tran_inscl_hos:benefitLabels(tran.inscl_hos),
      visit_tran_pttype:benefitLabels(tran.pttype),
      joined_visit_pttype:benefitLabels(visit.pttype)
    },
    resolved_benefits:benefitLabels(selected)
  };
};

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
  const rows=((result.reply&&result.reply.data)||[]).filter(row=>{
    const state=valueText(row&&row.xrstatx);
    return state!=='0'&&state!=='3';
  });
  return {success:true,message:'ok',rows};
};

const getCenterOrderRows=async()=>{
  const result=await app.dbFindAll(
    {from:CENTER_LAB_ORDER_COLLECTION,orderBy:[{column:'created_at',sort:'DESC'}]},
    false,
    false
  );
  if(!result||!result.success){
    return {success:false,message:(result&&result.message)||'โหลดข้อมูล Center Lab Order ไม่สำเร็จ',rows:[]};
  }
  const rows=((result.reply&&result.reply.data)||[]).filter(row=>{
    const state=valueText(row&&row.xrstatx);
    return state!=='0'&&state!=='3';
  });
  return {success:true,message:'ok',rows};
};

const sectionValues=value=>{
  const raw=value&&typeof value==='object'?(value.code||value.value||value.id||''):valueText(value);
  const text=valueText(raw).trim().toUpperCase();
  if(!text)return [];
  // Center Lab can store Hematology as 20-22; retain the full code and each
  // component so it maps safely to an individual Status section.
  return [text].concat(text.split(/[\s,/-]+/).filter(Boolean));
};
const uniqueValues=values=>values.filter((value,index)=>value&&values.indexOf(value)===index);
const centerSections=row=>{
  const source=row||{};
  const values=[];
  [source.section_code,source.sectionCode,source.lab_section,source.unit].forEach(value=>values.push(...sectionValues(value)));
  parseArray(source.selected_items_json||source.selected_items).forEach(item=>{
    const entry=item||{};
    [entry.section_code,entry.sectionCode,entry.lab_section,entry.unit,entry.unit_code].forEach(value=>values.push(...sectionValues(value)));
  });
  return uniqueValues(values);
};
const centerLabNumbers=row=>{
  const source=row||{};
  const values=[source.lab_no,source.labNo,source.order_number,source.orderNumber];
  // Current Center Lab stores one group per Lab section in selected_items_json.
  // The section-level order_number is the precise link back from Status.
  parseArray(source.selected_items_json||source.selected_items).forEach(item=>{
    const entry=item||{};
    values.push(entry.lab_no,entry.labNo,entry.order_number,entry.orderNumber);
  });
  parseArray(source.specimen_records_json||source.specimens||source.specimen_json).forEach(item=>{
    const entry=item||{};
    values.push(entry.lab_no,entry.labNo,entry.order_number,entry.orderNumber);
  });
  return uniqueValues(values.map(value=>valueText(value).trim()));
};
const matchingCenterOrders=(status,centerRows)=>{
  const row=status||{};
  const hn=valueText(row.patient_hn).trim();
  const labNo=valueText(row.order_number).trim();
  const statusSections=sectionValues(row.section_code);
  if(!hn)return [];
  return (centerRows||[]).filter(center=>{
    if(valueText(center&&center.patient_hn).trim()!==hn)return false;
    const sourceLabs=centerLabNumbers(center);
    if(labNo&&sourceLabs.indexOf(labNo)>-1)return true;
    const sourceSections=centerSections(center);
    return statusSections.some(code=>sourceSections.indexOf(code)>-1);
  });
};

// New records carry center_order_id directly.  This resolver intentionally
// retains a LAB NO. fallback for records created before that link existed.
// It never guesses between multiple Center records.
const resolveCenterOrder=async status=>{
  const row=status||{};
  const linked=valueText(row.center_order_id||row.center_lab_order_id).trim();
  if(linked)return {success:true,center_order_id:linked,resolution:'linked'};
  const result=await getCenterOrderRows();
  if(!result.success)return {success:false,message:result.message};
  const labNo=valueText(row.order_number||row.lab_no).trim();
  const exact=labNo?(result.rows||[]).filter(center=>centerLabNumbers(center).indexOf(labNo)>-1):[];
  if(exact.length===1){
    const id=recordId(exact[0]);
    return id?{success:true,center_order_id:id,resolution:'lab_no'}:{success:false,message:'Center Lab Order ที่พบไม่มี record id'};
  }
  if(exact.length>1)return {success:false,message:'พบ Center Lab Order มากกว่าหนึ่งใบสำหรับ LAB NO. '+labNo};
  const matches=matchingCenterOrders(row,result.rows);
  if(matches.length===1){
    const id=recordId(matches[0]);
    return id?{success:true,center_order_id:id,resolution:'legacy_context'}:{success:false,message:'Center Lab Order ที่พบไม่มี record id'};
  }
  return {success:false,message:matches.length?'พบ Center Lab Order มากกว่าหนึ่งใบ':'ไม่พบ Center Lab Order ต้นทาง'};
};

// Audit only the clinically meaningful add/remove changes.  The complete
// post-save list is still stored on Status for the Lab workspace to render.
const orderItemKey=item=>{
  const row=item||{};
  return valueText(row.master_id||row.id||row.item_id||row.code||row.item_code).trim();
};
const auditOrderItem=item=>{
  const row=item||{};
  return {
    id:valueText(row.id).trim(),
    master_id:valueText(row.master_id||row.item_id).trim(),
    code:valueText(row.code||row.item_code).trim(),
    name:valueText(row.name||row.item_name||row.master_item_name).trim(),
    section_code:valueText(row.sectionCode||row.section_code).trim(),
    section_name:valueText(row.sectionName||row.section_name).trim()
  };
};
const orderItemDiff=(before,after)=>{
  const oldRows=parseArray(before),newRows=parseArray(after);
  const oldKeys={};
  const newKeys={};
  oldRows.forEach(item=>{const key=orderItemKey(item);if(key)oldKeys[key]=item;});
  newRows.forEach(item=>{const key=orderItemKey(item);if(key)newKeys[key]=item;});
  return {
    added:Object.keys(newKeys).filter(key=>!oldKeys[key]).map(key=>auditOrderItem(newKeys[key])),
    removed:Object.keys(oldKeys).filter(key=>!newKeys[key]).map(key=>auditOrderItem(oldKeys[key]))
  };
};

const activeUniqueVisits=rows=>{
  const seen={};
  return (rows||[]).filter(row=>String((row&&row.xrstatx)||'1')!=='3').filter(row=>{
    const id=recordId(row);
    return id&&!seen[id]&&(seen[id]=true);
  });
};

// `patient_hn` is not a safe foreign key: one patient can have many old
// Visits.  These lookups therefore return a Visit only if it is unique.
// Future orders should still pass visit_id_link from EMR/Center Lab.
const resolveVisitReference=async source=>{
  const row=source||{};
  const existingId=valueText(row.visit_id||row.visit_id_link).trim();
  const suppliedVn=valueText(row.visit_vn||row.vn).trim();
  if(existingId)return {visit_id:existingId,visit_vn:suppliedVn,resolution:'linked'};

  const findVisits=async(where,params)=>activeUniqueVisits(await formRows({
    providerId:VISIT_FORM_ID,
    providerType:'FORM',
    params:params||{},
    options:{where,orderBy:[{column:'created_at',sort:'DESC'}],limit:3,page:1}
  }));

  if(suppliedVn){
    const byVn=(await findVisits('vn = :visitVn',{visitVn:suppliedVn}))
      .filter(visit=>valueText(visit.vn).trim()===suppliedVn);
    if(byVn.length===1)return {visit_id:recordId(byVn[0]),visit_vn:valueText(byVn[0].vn||suppliedVn),resolution:'vn'};
    if(byVn.length>1)return {visit_id:'',visit_vn:suppliedVn,resolution:'ambiguous_vn'};
  }

  const hn=valueText(row.patient_hn).trim();
  if(!hn)return {visit_id:'',visit_vn:suppliedVn,resolution:'missing_hn'};
  const byHn=(await findVisits('`pid.hn` = :patientHn',{patientHn:hn}))
    .filter(visit=>valueText(visit&&visit.pid&&visit.pid.hn).trim()===hn);
  if(byHn.length===1)return {visit_id:recordId(byHn[0]),visit_vn:valueText(byHn[0].vn||suppliedVn),resolution:'hn_unique'};
  return {visit_id:'',visit_vn:suppliedVn,resolution:byHn.length?'ambiguous_hn':'not_found'};
};

// The Status record's xunitx is the receiving Lab.  Center Lab's xunitx is
// the sending room, so copy it into source_unit/source_unit_name explicitly.
const prepareLabContext=async source=>{
  const row=source||{};
  const directSource=sourceUnit(row.source_unit||row.origin_unit||row.sender_unit);
  const needsCenter=!valueText(row.visit_id||row.visit_id_link).trim()||!directSource.name||!valueText(row.source_unit_name).trim();
  if(!needsCenter)return {source:row,center:null,match_count:0};

  let centerResult;
  try{
    centerResult=await getCenterOrderRows();
  }catch(error){
    return {source:row,center:null,match_count:0};
  }
  if(!centerResult.success)return {source:row,center:null,match_count:0};
  const matches=matchingCenterOrders(row,centerResult.rows);
  if(matches.length!==1)return {source:row,center:null,match_count:matches.length};

  const center=matches[0];
  const centerUnit=sourceUnit(center.source_unit||center.origin_unit||center.sender_unit||center.xunitx);
  return {
    source:{
      ...center,
      ...row,
      visit_id:row.visit_id||row.visit_id_link||center.visit_id||center.visit_id_link,
      visit_vn:row.visit_vn||row.vn||center.visit_vn||center.vn,
      source_unit:row.source_unit||row.origin_unit||row.sender_unit||center.source_unit||center.origin_unit||center.sender_unit||center.xunitx,
      source_unit_code:row.source_unit_code||center.source_unit_code||centerUnit.code,
      source_unit_name:row.source_unit_name||center.source_unit_name||centerUnit.name||row.ward_clinic
    },
    center,
    match_count:1
  };
};

const toFormData=(source,override)=>{
  const row=source||{};
  const patch=override||{};
  const specimenStatus=normalStatus(patch.specimen_status!==undefined?patch.specimen_status:row.specimen_status);
  const workStatus=valueText(patch.work_status!==undefined?patch.work_status:row.work_status)||defaultWorkStatus(specimenStatus);
  return {
    order_number:valueText(patch.order_number!==undefined?patch.order_number:row.order_number).trim(),
    center_order_id:valueText(patch.center_order_id!==undefined?patch.center_order_id:(row.center_order_id||row.center_lab_order_id)).trim(),
    section_code:valueText(patch.section_code!==undefined?patch.section_code:row.section_code).trim(),
    section_name:valueText(patch.section_name!==undefined?patch.section_name:row.section_name).trim(),
    specimen_status:specimenStatus,
    work_status:workStatus,
    patient_hn:valueText(patch.patient_hn!==undefined?patch.patient_hn:row.patient_hn).trim(),
    patient_name:valueText(patch.patient_name!==undefined?patch.patient_name:row.patient_name).trim(),
    ward_clinic:valueText(patch.ward_clinic!==undefined?patch.ward_clinic:row.ward_clinic),
    visit_id:valueText(patch.visit_id!==undefined?patch.visit_id:(row.visit_id||row.visit_id_link)).trim(),
    visit_vn:valueText(patch.visit_vn!==undefined?patch.visit_vn:(row.visit_vn||row.vn)).trim(),
    visit_time:valueText(patch.visit_time!==undefined?patch.visit_time:row.visit_time),
    visit_type:valueText(patch.visit_type!==undefined?patch.visit_type:(row.visit_type||row.visit_type_label||row.service_type)),
    person_id:valueText(patch.person_id!==undefined?patch.person_id:row.person_id).trim(),
    patient_birth_date:valueText(patch.patient_birth_date!==undefined?patch.patient_birth_date:(row.patient_birth_date||row.birth_date)),
    patient_age:valueText(patch.patient_age!==undefined?patch.patient_age:(row.patient_age||row.age)),
    patient_gender:valueText(patch.patient_gender!==undefined?patch.patient_gender:(row.patient_gender||row.gender||row.p_gender)),
    blood_group:valueText(patch.blood_group!==undefined?patch.blood_group:(row.blood_group||row.abo_group||row.p_abogroup)),
    patient_phone:valueText(patch.patient_phone!==undefined?patch.patient_phone:(row.patient_phone||row.p_phone)),
    patient_photo:valueText(patch.patient_photo!==undefined?patch.patient_photo:(row.patient_photo||row.photo_url)),
    allergy_tags_json:jsonArray(patch.allergy_tags_json!==undefined?patch.allergy_tags_json:(row.allergy_tags_json||row.allergy_tags||row.allergies||row.drug_allergy)),
    source_unit_code:valueText(patch.source_unit_code!==undefined?patch.source_unit_code:(row.source_unit_code||sourceUnit(row.source_unit||row.origin_unit||row.xunitx).code)),
    source_unit_name:valueText(patch.source_unit_name!==undefined?patch.source_unit_name:(row.source_unit_name||sourceUnit(row.source_unit||row.origin_unit||row.xunitx).name||row.ward_clinic)),
    inscl_hos_json:jsonArray(patch.inscl_hos_json!==undefined?patch.inscl_hos_json:(row.inscl_hos_json||row.inscl_hos)),
    vital_signs_json:jsonObject(patch.vital_signs_json!==undefined?patch.vital_signs_json:row.vital_signs_json),
    bmi_json:jsonObject(patch.bmi_json!==undefined?patch.bmi_json:row.bmi_json),
    order_change_history_json:jsonArray(patch.order_change_history_json!==undefined?patch.order_change_history_json:(row.order_change_history_json||row.order_change_history)),
    selected_items:jsonArray(patch.selected_items!==undefined?patch.selected_items:(row.selected_items||row.selected_items_json)),
    specimens:jsonArray(patch.specimens!==undefined?patch.specimens:(row.specimens||row.specimen_records_json||row.specimen_json)),
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
  if(!id)return app.dbInsert(data,SPECIMEN_COLLECTION_STATUS,userInfo);
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

// A Status record is a derived work item.  Create it with only the fields
// that are required by the Status form first, then enrich the raw record with
// the patient/visit snapshot.  This deliberately keeps a failed optional
// snapshot conversion from preventing a Lab room from receiving the order.
// It also avoids writing anything back to the Center Lab source form.
const initialStatusData=data=>({
  order_number:valueText(data.order_number).trim(),
  section_code:valueText(data.section_code).trim(),
  section_name:valueText(data.section_name).trim(),
  specimen_status:normalStatus(data.specimen_status),
  work_status:valueText(data.work_status),
  patient_hn:valueText(data.patient_hn).trim(),
  patient_name:valueText(data.patient_name).trim(),
  selected_items:jsonArray(data.selected_items),
  specimens:jsonArray(data.specimens)
});

const createDerivedStatus=async fullData=>{
  const initial=initialStatusData(fullData||{});
  const validationError=validateCreate(initial);
  if(validationError)return {success:false,message:validationError};

  const saved=await saveForm('',initial);
  if(!saved||!saved.success){
    return {success:false,message:(saved&&saved.message)||'สร้าง Lab Specimen Collection Status Form ไม่สำเร็จ'};
  }
  const id=valueText(
    saved.id||
    (saved.reply&&saved.reply.id)||
    recordId(saved.data)||
    recordId(saved.reply&&saved.reply.data)
  ).trim();
  if(!id)return {success:false,message:'สร้าง Lab Status สำเร็จ แต่ไม่พบ record id'};

  // The collection has accepted the operational minimum.  The remainder
  // is display/context data for Lab UI, therefore it is safe to enrich by
  // record id without invoking a second Center Lab form event.
  const enriched=await app.dbUpdate(
    {
      ...fullData,
      ...initial,
      dataid:valueText(id),
      xrstatx:1,
      xunitx:{code:initial.section_code,name:initial.section_name}
    },
    SPECIMEN_COLLECTION_STATUS,
    userInfo,
    {_id:app.dbObjectId(id)}
  );
  if(!enriched||!enriched.success){
    return {success:false,message:(enriched&&enriched.message)||'สร้าง Lab Status สำเร็จ แต่บันทึกข้อมูลประกอบไม่สำเร็จ'};
  }
  return {success:true,id,data:{...fullData,...initial}};
};

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
  const input=(params.record&&typeof params.record==='object')?params.record:
    ((params.source_record&&typeof params.source_record==='object')?params.source_record:params);
  const snapshot=await hydrateVisitSnapshot(input);
  const data=toFormData(input,{...snapshot,specimen_status:'waiting',work_status:''});
  const validationError=validateCreate(data);
  if(validationError)return {success:false,message:validationError};

  const legacy=await findRawByOrderNumber(data.order_number);
  if(legacy.success&&legacy.reply&&legacy.reply.data){
    return {success:true,message:'มีรายการ Specimen Status อยู่แล้ว',id:recordId(legacy.reply.data),order_number:data.order_number,created:false};
  }

  const created=await createDerivedStatus(data);
  if(!created.success)return {success:false,message:created.message};
  const id=created.id;
  return {
    success:true,
    message:'สร้างรายการ Specimen Status สำเร็จ',
    id,
    order_number:data.order_number,
    visit_id:data.visit_id,
    visit_vn:data.visit_vn,
    created:true
  };
}

if(params.action==='migrate_one'){
  const orderNumber=valueText(params.order_number).trim();
  if(!orderNumber)return {success:false,message:'order_number is required'};
  const legacy=await findRawByOrderNumber(orderNumber);
  const raw=legacy&&legacy.reply&&legacy.reply.data;
  if(!legacy.success||!raw)return {success:false,message:'ไม่พบรายการเดิมสำหรับ order_number '+orderNumber};
  const id=recordId(raw);
  if(!id)return {success:false,message:'รายการเดิมไม่มี record id'};
  const snapshot=await hydrateVisitSnapshot(raw);
  const data=toFormData(raw,snapshot);
  const validationError=validateCreate(data);
  if(validationError)return {success:false,message:validationError};
  const saved=await saveForm(id,data);
  if(!saved||!saved.success)return {success:false,message:(saved&&saved.message)||'ย้ายรายการเดิมเข้าฟอร์มไม่สำเร็จ'};
  const routed=await routeToLabUnit(id,data);
  if(!routed||!routed.success)return {success:false,message:(routed&&routed.message)||'ย้ายรายการสำเร็จ แต่กำหนดห้อง Lab ไม่สำเร็จ'};
  return {success:true,message:'ย้ายรายการเดิมเข้าผ่าน Form pipeline สำเร็จ',id,order_number:orderNumber};
}

if(params.action==='hydrate_visit_context'){
  const orderNumber=valueText(params.order_number).trim();
  if(!orderNumber)return {success:false,message:'order_number is required'};
  const found=await findRawByOrderNumber(orderNumber);
  const current=found&&found.reply&&found.reply.data;
  if(!found.success||!current)return {success:false,message:'ไม่พบรายการสำหรับ order_number '+orderNumber};
  // Older status records were created before visit_id existed.  Allow the
  // caller to pass Center Lab's visit_id_link once to backfill those records.
  const contextSource={
    ...current,
    visit_id:params.visit_id||params.visit_id_link||current.visit_id||current.visit_id_link,
    visit_vn:params.visit_vn||current.visit_vn||current.vn
  };
  const snapshot=await hydrateVisitSnapshot(contextSource);
  if(!snapshot.visit_id)return {success:false,message:'รายการนี้ไม่มี visit_id / visit_id_link สำหรับดึงข้อมูล VN'};
  const saved=await saveForm(recordId(current),toFormData(current,{...contextSource,...snapshot}));
  if(!saved||!saved.success)return {success:false,message:(saved&&saved.message)||'อัปเดตข้อมูล VN / Patient Snapshot ไม่สำเร็จ'};
  return {
    success:true,
    message:'อัปเดต VN / Patient Snapshot สำเร็จ',
    order_number:orderNumber,
    visit_id:snapshot.visit_id,
    visit_vn:snapshot.visit_vn,
    patient_hn:snapshot.patient_hn,
    patient_name:snapshot.patient_name,
    benefit_count:benefitLabels(snapshot.inscl_hos_json).length,
    benefits:benefitLabels(snapshot.inscl_hos_json)
  };
}

if(params.action==='inspect_visit_benefits'){
  const inspected=await inspectVisitBenefits(params.visit_id||params.visit_id_link);
  if(!inspected.success)return inspected;
  const orderNumber=valueText(params.order_number).trim();
  if(!orderNumber)return inspected;
  const found=await findRawByOrderNumber(orderNumber);
  const row=found&&found.reply&&found.reply.data;
  return {
    ...inspected,
    status_record:row?{
      order_number:valueText(row.order_number),
      stored_benefits:benefitLabels(row.inscl_hos_json||row.inscl_hos)
    }:null
  };
}

// Read-only troubleshooting for a Lab No. that was created without its VN
// snapshot.  Use this before hydrate/backfill; it never writes a record.
if(params.action==='inspect_order_context'){
  const orderNumber=valueText(params.order_number).trim();
  if(!orderNumber)return {success:false,message:'order_number is required'};
  const found=await findRawByOrderNumber(orderNumber);
  const status=found&&found.reply&&found.reply.data;
  if(!found.success||!status)return {success:false,message:'ไม่พบรายการสำหรับ order_number '+orderNumber};
  const prepared=await prepareLabContext(status);
  const resolved=await resolveVisitReference(prepared.source);
  return {
    success:true,
    order_number:orderNumber,
    center_match_count:prepared.match_count,
    center_matched:!!prepared.center,
    source_unit_name:valueText(prepared.source.source_unit_name),
    visit_id:valueText(resolved.visit_id||prepared.source.visit_id||prepared.source.visit_id_link),
    visit_vn:valueText(resolved.visit_vn||prepared.source.visit_vn||prepared.source.vn),
    visit_resolution:resolved.resolution,
    message:resolved.visit_id?'พร้อมดึง VN และบันทึก Patient Snapshot':'ยังจับคู่ Visit อัตโนมัติไม่ได้ — ต้องส่ง visit_id_link จาก Center Lab/EMR'
  };
}

// Backfill old Status rows without opening and saving them one by one.
// A row is updated only when Center Lab has exactly one matching patient HN +
// section (or an exact LAB NO.).  Ambiguous rows are intentionally skipped.
if(params.action==='backfill_visit_context'){
  const statusResult=await getRawRows();
  if(!statusResult.success)return {success:false,message:statusResult.message};
  const centerResult=await getCenterOrderRows();
  if(!centerResult.success)return {success:false,message:centerResult.message};

  const limit=Math.max(1,Math.min(Number(params.limit)||100,250));
  // Use refresh_snapshot:true after extending the snapshot schema (for
  // example adding allergy/BMI/vital fields).  This deliberately refreshes
  // every safely matched row, even if it already has VN and benefits.
  const refreshSnapshot=params.refresh_snapshot===true||params.refresh_snapshot==='true';
  const candidates=statusResult.rows
    // Re-run records that already have VN when the newly added source unit
    // has not yet been copied from Center Lab.
    .filter(row=>refreshSnapshot||!valueText(row.visit_id||row.visit_id_link).trim()||!valueText(row.source_unit_name).trim()||!parseArray(row.inscl_hos_json||row.inscl_hos).length)
    .slice(0,limit);
  const ready=[];
  const skipped=[];
  candidates.forEach(status=>{
    // A legacy/new Center row can be missing visit_id_link.  It is still a
    // candidate when its Lab No./HN/section matches exactly; hydration below
    // will only use an unambiguous Visit resolved by VN/HN.
    const matches=matchingCenterOrders(status,centerResult.rows);
    if(matches.length===1){
      ready.push({status,center:matches[0]});
      return;
    }
    skipped.push({
      order_number:valueText(status.order_number),
      reason:matches.length?'พบ Center Lab มากกว่า 1 รายการ':'ไม่พบ Center Lab ที่ตรงกับ HN และ section'
    });
  });

  const preview={
    success:true,
    dry_run:true,
    total_status_rows:statusResult.rows.length,
    refresh_snapshot:refreshSnapshot,
    need_backfill:candidates.length,
    ready_count:ready.length,
    skipped_count:skipped.length,
    ready:ready.slice(0,30).map(item=>({
      order_number:valueText(item.status.order_number),
      section_code:valueText(item.status.section_code),
      visit_id:valueText(item.center.visit_id||item.center.visit_id_link),
      visit_vn:valueText(item.center.visit_vn||item.center.vn)
    })),
    skipped:skipped.slice(0,30)
  };
  const confirmed=params.confirm===true||params.confirm==='true';
  if(!confirmed)return {...preview,message:'ตรวจสอบรายการแล้ว — ส่ง confirm:true เพื่อบันทึก '+ready.length+' รายการ'};

  const updated=[];
  const failed=[];
  for(const item of ready){
    const source={
      ...item.status,
      ...item.center,
      visit_id:item.center.visit_id||item.center.visit_id_link||item.status.visit_id||item.status.visit_id_link,
      visit_vn:item.center.visit_vn||item.center.vn||item.status.visit_vn||item.status.vn
    };
    try{
      const snapshot=await hydrateVisitSnapshot(source);
      if(!snapshot.visit_id)throw Error('ไม่พบ Visit ที่ระบุได้แน่ชัดจาก Center Lab / VN / HN');
      const saved=await saveForm(recordId(item.status),toFormData(item.status,snapshot));
      if(!saved||!saved.success)throw Error((saved&&saved.message)||'บันทึก Status ไม่สำเร็จ');
      updated.push(valueText(item.status.order_number));
    }catch(error){
      failed.push({order_number:valueText(item.status.order_number),reason:valueText(error&&error.message||error)});
    }
  }
  return {
    success:failed.length===0,
    message:'Backfill VN / Patient Snapshot แล้ว '+updated.length+' รายการ',
    updated_count:updated.length,
    skipped_count:skipped.length,
    failed_count:failed.length,
    updated,
    skipped:skipped.slice(0,30),
    failed
  };
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
    // A Lab may have progressed this record while the upstream Specimen team
    // was still developing.  A late `sent` event must never rewind received /
    // processing / rejected work back to the waiting queue.
    const currentWorkStatus=valueText(current.work_status);
    if(!currentWorkStatus||currentWorkStatus==='waiting_receive')patch.work_status='waiting_receive';
  }

  const saved=await saveForm(recordId(current),toFormData(current,patch));
  if(!saved||!saved.success)return {success:false,message:(saved&&saved.message)||'บันทึกสถานะ Center Specimen ไม่สำเร็จ'};
  return {success:true,message:'อัปเดตสถานะ Center Specimen สำเร็จ',order_number:orderNumber,specimen_status:nextStatus,work_status:patch.work_status||valueText(current.work_status)};
}

// Receiving a specimen is a real workflow transition.  Keep the first physical
// receive stamp idempotent, and move only a waiting item to `received`.
if(params.action==='mark_received_once'){
  const orderNumber=valueText(params.order_number).trim();
  if(!orderNumber)return {success:false,message:'order_number is required'};

  const found=await findRawByOrderNumber(orderNumber);
  const row=found&&found.reply&&found.reply.data;
  if(!found.success||!row)return {success:false,message:'ไม่พบรายการสำหรับ order_number '+orderNumber};

  const firstReceivedAt=valueText(row.received_at).trim();
  const specimenStatus=normalStatus(row.specimen_status);
  // During the temporary early-Lab flow, waiting/collected records can still
  // have an empty work_status.  In the Lab state machine that means waiting_receive.
  const currentWorkStatus=valueText(row.work_status).trim()||'waiting_receive';
  const developmentEarlyAction=DEV_ALLOW_EARLY_LAB_ACTIONS&&['waiting','collected'].includes(specimenStatus);
  if(specimenStatus!=='sent'&&!developmentEarlyAction){
    return {success:false,message:'ห้อง Lab รับงานได้เฉพาะรายการที่ศูนย์กลางส่งต่อแล้ว'};
  }

  if(firstReceivedAt){
    if(currentWorkStatus==='waiting_receive'){
      const saved=await saveForm(recordId(row),toFormData(row,{work_status:'received'}));
      if(!saved||!saved.success)return {success:false,message:(saved&&saved.message)||'บันทึกสถานะรับ specimen ไม่สำเร็จ'};
    }
    return {
      success:true,
      message:'รายการนี้มีเวลารับ specimen แล้ว',
      order_number:orderNumber,
      received_at:firstReceivedAt,
      received_by:valueText(row.received_by),
      first_received:false,
      work_status:currentWorkStatus==='waiting_receive'?'received':currentWorkStatus
    };
  }

  const patch={received_at:now,received_by:actor};
  if(currentWorkStatus==='waiting_receive')patch.work_status='received';
  const saved=await saveForm(recordId(row),toFormData(row,patch));
  if(!saved||!saved.success)return {success:false,message:(saved&&saved.message)||'บันทึกเวลารับ specimen ไม่สำเร็จ'};
  return {
    success:true,
    message:'บันทึกเวลารับ specimen แล้ว',
    order_number:orderNumber,
    received_at:now,
    received_by:actor,
    first_received:true,
    work_status:patch.work_status||currentWorkStatus
  };
}

if(params.action==='resolve_center_order'){
  const orderNumber=valueText(params.order_number).trim();
  if(!orderNumber)return {success:false,message:'order_number is required'};
  const found=await findRawByOrderNumber(orderNumber);
  const row=found&&found.reply&&found.reply.data;
  if(!found.success||!row)return {success:false,message:'ไม่พบรายการสำหรับ order_number '+orderNumber};
  const resolved=await resolveCenterOrder(row);
  if(!resolved.success)return {success:false,message:resolved.message||'ไม่พบใบสั่ง Lab Center ต้นทาง'};
  return {
    success:true,
    order_number:orderNumber,
    center_order_id:resolved.center_order_id,
    resolution:resolved.resolution
  };
}

if(params.action==='get_order'){
  const orderNumber=valueText(params.order_number).trim();
  if(!orderNumber)return {success:false,message:'order_number is required'};
  const found=await findRawByOrderNumber(orderNumber);
  const row=found&&found.reply&&found.reply.data;
  if(!found.success||!row)return {success:false,message:'ไม่พบรายการสำหรับ order_number '+orderNumber};
  return {success:true,order_number:orderNumber,row};
}

// Called from Center Lab's `update` event after the user submits the original
// order form.  Center stays the source of truth; Status receives the exact
// post-save group JSON and an append-only add/remove audit for the Lab UI.
const createMissingStatusFromCenterGroup=async(centerOrderId,group)=>{
  const centerResult=await getCenterOrderRows();
  if(!centerResult.success)throw Error(centerResult.message||'โหลด Center Lab Order ไม่สำเร็จ');
  const center=(centerResult.rows||[]).find(item=>recordId(item)===centerOrderId);
  if(!center)throw Error('ไม่พบ Center Lab Order ต้นทางสำหรับสร้าง Status');
  const source=group||{};
  const context={
    ...center,
    ...source,
    center_order_id:centerOrderId,
    visit_id:source.visit_id||source.visit_id_link||center.visit_id||center.visit_id_link,
    visit_vn:source.visit_vn||source.vn||center.visit_vn||center.vn,
    section_code:valueText(source.section_code||source.sectionCode),
    section_name:valueText(source.section_name||source.sectionName),
    selected_items:parseArray(source.selected_items),
    specimens:parseArray(source.specimens)
  };
  const snapshot=await hydrateVisitSnapshot(context);
  const data=toFormData(context,{...snapshot,specimen_status:'waiting',work_status:''});
  const validationError=validateCreate(data);
  if(validationError)throw Error(validationError);
  const created=await createDerivedStatus(data);
  if(!created.success)throw Error(created.message||'สร้าง Status ที่ขาดหายไม่สำเร็จ');
  return created.data;
};

const centerGroupSection=value=>{
  const row=value||{};
  return {
    code:valueText(row.section_code||row.sectionCode||row.lab_section||row.section||row.unit_code||row.unit).trim(),
    name:valueText(row.section_name||row.sectionName||row.lab_name||row.unit_name).trim()
  };
};
// Center Lab records can carry either the clinical section mnemonic (BC/HM/
// BB/...) or the Organization room code used by Form Provider scoping.  The
// derived Status must always store the room code in both section_code and
// xunitx.code; otherwise a valid order exists but is invisible in the room.
const centerRoomCode=value=>{
  const raw=valueText(value).trim().toUpperCase();
  const map={BC:'10',HM:'20',HEM:'20',ML:'21',HH:'22',IM:'30','MI-OUT':'31',MB:'40',MY:'41',BB:'50',BG:'70'};
  return map[raw]||raw;
};
const centerGroupSpecimens=(sectionCode,items)=>{
  const seen={};
  return (items||[]).map(item=>{
    const row=item||{},spec=row.c_specimen||row.specimen||{};
    const code=valueText(spec.specimen_code||spec.code||row.specimen_code).trim();
    const label=valueText(spec.label||spec.specimen_name||row.specimen_name||code).trim();
    const key=code+'|'+label;
    if(!label||seen[key])return null;
    seen[key]=true;
    return {section_code:sectionCode,specimen_code:code,label};
  }).filter(Boolean);
};
const centerGroupOrderNumber=(group,items)=>{
  const direct=valueText(group&&(group.order_number||group.lab_no)).trim();
  if(direct)return direct;
  const numbers=[];
  (items||[]).forEach(item=>{
    const number=valueText(item&&(item.order_number||item.lab_no)).trim();
    if(number&&numbers.indexOf(number)===-1)numbers.push(number);
  });
  // Promote an item-level LAB NO. only when the whole section agrees.  A
  // conflicting set must not be guessed or collapsed into the wrong order.
  return numbers.length===1?numbers[0]:'';
};
const normalizeCenterOrderGroups=rows=>{
  const list=parseArray(rows);
  const grouped=list.every(row=>row&&Object.prototype.hasOwnProperty.call(row,'selected_items'));
  if(grouped)return list.map(row=>{
    const items=parseArray(row.selected_items);
    const section=centerGroupSection(row);
    const fallback=centerGroupSection(items[0]);
    const code=section.code||fallback.code,name=section.name||fallback.name;
    return {
      ...row,
      section_code:code,
      section_name:name,
      order_number:centerGroupOrderNumber(row,items),
      selected_items:items,
      specimens:parseArray(row.specimens).length?parseArray(row.specimens):centerGroupSpecimens(code,items)
    };
  });
  const bySection={},order=[];
  list.forEach(item=>{
    const section=centerGroupSection(item),key=section.code||section.name;
    if(!key)return;
    if(!bySection[key]){bySection[key]={section_code:section.code,section_name:section.name,selected_items:[]};order.push(key)}
    bySection[key].selected_items.push(item);
  });
  return order.map(key=>{
    const group=bySection[key];
    return {
      ...group,
      order_number:centerGroupOrderNumber(group,group.selected_items),
      specimens:centerGroupSpecimens(group.section_code,group.selected_items)
    };
  });
};
const nextCenterLabSequence=async refCode=>{
  const ceYear=Number(app.curDate('YYYY'));
  const yy=String((ceYear+543)%100).padStart(2,'0');
  const key='center_lab_order_'+refCode+yy;
  const found=await app.dbFindOne({from:CENTER_LAB_COUNTER_COLLECTION,where:'code = :key',params:{key}});
  const current=(found&&found.success&&found.reply&&found.reply.data&&found.reply.data.count)||0;
  const next=current+1;
  await app.dbUpdate({code:key,count:next},CENTER_LAB_COUNTER_COLLECTION,userInfo,{code:key},true);
  return refCode+yy+String(next).padStart(6,'0');
};

// The stable relationship is Center record id + Lab section.  LAB NO. is a
// property of the derived work item, not a value that must be written back to
// the ordering form.  This makes the operation idempotent and prevents a
// Center Lab save from racing with its own form event.
const findRawByCenterSection=async(centerOrderId,sectionCode)=>{
  const result=await app.dbFindOne({
    from:SPECIMEN_COLLECTION_STATUS,
    where:'center_order_id = :centerOrderId AND section_code = :sectionCode',
    params:{centerOrderId:valueText(centerOrderId).trim(),sectionCode:valueText(sectionCode).trim()}
  });
  return result&&result.success&&result.reply&&result.reply.data?result.reply.data:null;
};

const findExistingCenterStatus=async(centerOrderId,sectionCode,orderNumber)=>{
  const linked=await findRawByCenterSection(centerOrderId,sectionCode);
  if(linked)return linked;
  const labNo=valueText(orderNumber).trim();
  if(!labNo)return null;
  const legacy=await findRawByOrderNumber(labNo);
  return legacy&&legacy.success&&legacy.reply&&legacy.reply.data
    ? legacy.reply.data
    : null;
};

const nonEmptySnapshotPatch=(target,data)=>{
  const textKeys=[
    'ward_clinic','visit_id','visit_vn','visit_time','visit_type','person_id',
    'patient_birth_date','patient_age','patient_gender','blood_group',
    'patient_phone','patient_photo','source_unit_code','source_unit_name'
  ];
  textKeys.forEach(key=>{
    const value=valueText(data[key]).trim();
    if(value)target[key]=value;
  });
  ['allergy_tags_json','inscl_hos_json','order_change_history_json','selected_items','specimens'].forEach(key=>{
    if(data[key]!==undefined)target[key]=jsonArray(data[key]);
  });
  ['vital_signs_json','bmi_json'].forEach(key=>{
    if(data[key]!==undefined)target[key]=jsonObject(data[key]);
  });
  return target;
};

const updateDerivedStatusFromCenter=async(existing,centerOrderId,data)=>{
  const beforeItems=parseArray(existing.selected_items);
  const nextItems=parseArray(data.selected_items);
  const diff=orderItemDiff(beforeItems,nextItems);
  const history=parseArray(existing.order_change_history_json||existing.order_change_history);
  if(diff.added.length||diff.removed.length){
    history.push({changed_at:now,changed_by:actor,added:diff.added,removed:diff.removed});
  }
  const id=recordId(existing);
  if(!id)return {success:false,message:'พบ Lab Status เดิมแต่ไม่มี record id'};
  const patch=nonEmptySnapshotPatch({
    dataid:id,
    xrstatx:1,
    center_order_id:centerOrderId,
    section_code:valueText(data.section_code),
    section_name:valueText(data.section_name),
    xunitx:{code:valueText(data.section_code),name:valueText(data.section_name)},
    patient_hn:valueText(data.patient_hn),
    patient_name:valueText(data.patient_name),
    selected_items:jsonArray(nextItems),
    specimens:jsonArray(data.specimens)
  },data);
  // Snapshot data still contains the pre-edit history read from Status.
  // Assign the newly appended immutable audit last so it cannot be replaced
  // by that older value during nonEmptySnapshotPatch().
  patch.order_change_history_json=jsonArray(history);
  const saved=await app.dbUpdate(
    patch,
    SPECIMEN_COLLECTION_STATUS,
    userInfo,
    {_id:app.dbObjectId(id)}
  );
  if(!saved||!saved.success)return {success:false,message:(saved&&saved.message)||'อัปเดต Lab Status จาก LabCen ไม่สำเร็จ'};
  return {
    success:true,
    order_number:valueText(existing.order_number),
    created:false,
    added_count:diff.added.length,
    removed_count:diff.removed.length
  };
};

// Canonical materializer for Center Lab → Lab Order Item Status.
// It never writes selected_items_json, LAB NO., or any field back to LabCen.
// Calling it repeatedly is safe: one source Center record creates at most one
// Status record per section and subsequent calls update that same work item.
const materializeCenterOrder=async input=>{
  let center=input&&typeof input==='object'?input:{};
  let centerOrderId=valueText(center.center_order_id||center.center_lab_order_id||center._id||center.dataid||center.id).trim();
  if(!centerOrderId)return {success:false,message:'center_order_id is required'};

  // A backfill call may provide only the id.  Normal Form Event calls pass the
  // freshly saved Center Lab record and therefore do not need this query.
  if(!center.selected_items_json&&!center.selected_items){
    const sourceResult=await getCenterOrderRows();
    if(!sourceResult.success)return {success:false,message:sourceResult.message||'โหลด Center Lab Order ไม่สำเร็จ'};
    center=(sourceResult.rows||[]).find(row=>recordId(row)===centerOrderId)||{};
    if(!recordId(center))return {success:false,message:'ไม่พบ Center Lab Order ต้นทาง'};
  }

  const groups=normalizeCenterOrderGroups(center.selected_items_json||center.selected_items);
  if(!groups.length)return {success:false,message:'selected_items_json ไม่มีรายการที่ส่งต่อห้อง Lab ได้'};
  const patientHn=valueText(center.patient_hn||center.hn).trim();
  const patientName=valueText(center.patient_name||center.full_name).trim();
  if(!patientHn||!patientName)return {success:false,message:'Center Lab Order ไม่มี patient_hn หรือ patient_name'};

  const created=[];
  const updated=[];
  const failed=[];
  for(const group of groups){
    const sourceSectionCode=valueText(group.section_code||group.sectionCode).trim();
    const sectionCode=centerRoomCode(sourceSectionCode);
    const sectionName=valueText(group.section_name||group.sectionName).trim();
    if(!sectionCode||!sectionName){
      failed.push({section_code:sectionCode,reason:'ไม่พบ section_code หรือ section_name'});
      continue;
    }
    try{
      const context={
        ...center,
        ...group,
        center_order_id:centerOrderId,
        section_code:sectionCode,
        section_name:sectionName,
        selected_items:parseArray(group.selected_items),
        specimens:parseArray(group.specimens)
      };
      let snapshot={};
      try{snapshot=await hydrateVisitSnapshot(context);}catch(error){snapshot={};}
      const suppliedOrderNumber=valueText(group.order_number||group.lab_no).trim();
      const existing=await findExistingCenterStatus(centerOrderId,sectionCode,suppliedOrderNumber);
      const orderNumber=existing
        ?valueText(existing.order_number).trim()
        :(suppliedOrderNumber||await nextCenterLabSequence(sectionCode.padStart(2,'0').slice(0,2)));
      const data=toFormData(context,{...snapshot,order_number:orderNumber,specimen_status:existing?existing.specimen_status:'waiting',work_status:existing?existing.work_status:''});
      const validationError=validateCreate(data);
      if(validationError)throw Error(validationError);

      if(existing){
        const result=await updateDerivedStatusFromCenter(existing,centerOrderId,data);
        if(!result.success)throw Error(result.message);
        updated.push(result);
      }else{
        const result=await createDerivedStatus(data);
        if(!result.success)throw Error(result.message);
        created.push({order_number:orderNumber,section_code:sectionCode,section_name:sectionName});
      }
    }catch(error){
      failed.push({section_code:sectionCode,section_name:sectionName,reason:valueText(error&&error.message||error)});
    }
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
  return materializeCenterOrder(source);
}

// Administrative repair retained for legacy rows that were created before
// destination routing was persisted.  It changes only xunitx/xrstatx and is
// intentionally confirm-gated.
if(params.action==='repair_room_routing'){
  const confirmed=params.confirm===true||params.confirm==='true';
  if(!confirmed)return {success:true,dry_run:true,message:'ส่ง confirm:true เพื่อกำหนด xunitx ของ Status ตาม section_code'};
  const result=await getRawRows();
  if(!result.success)return result;
  const updated=[];
  const failed=[];
  for(const row of result.rows){
    const roomCode=centerRoomCode(row.section_code);
    const orderNumber=valueText(row.order_number).trim();
    if(!roomCode||!orderNumber){
      failed.push({order_number:orderNumber,reason:'ไม่มี section_code หรือ LAB NO.'});
      continue;
    }
    const routed=await app.dbUpdate(
      {xrstatx:1,xunitx:{code:roomCode,name:valueText(row.section_name)||roomCode}},
      SPECIMEN_COLLECTION_STATUS,
      userInfo,
      {order_number:orderNumber}
    );
    if(routed&&routed.success)updated.push({order_number:orderNumber,section_code:roomCode});
    else failed.push({order_number:orderNumber,reason:(routed&&routed.message)||'กำหนดห้องไม่สำเร็จ'});
  }
  return {success:failed.length===0,message:'กำหนดห้อง Lab แล้ว '+updated.length+' รายการ',updated,failed};
}

// Reconcile the canonical Status queue from its Center Lab source without
// changing the Center Lab form or its native submit implementation.  This is
// deliberately a two-step operation: the first call previews only; callers
// must pass confirm:true before any Status or LAB NO. data is written.
//
// It also gives an observable diagnostic result when a form-event callback is
// unavailable/suppressed by the runtime: every skipped or failed Center row is
// returned with its exact reason instead of failing silently after Submit.
if(params.action==='sync_center_orders'){
  const sourceResult=await getCenterOrderRows();
  if(!sourceResult.success)return {success:false,message:sourceResult.message||'โหลด Center Lab Order ไม่สำเร็จ'};

  const wantedId=valueText(params.center_order_id||params.center_lab_order_id).trim();
  const wantedHn=valueText(params.patient_hn).trim();
  const limit=Math.max(1,Math.min(Number(params.limit)||100,250));
  const sourceRows=(sourceResult.rows||[])
    .filter(row=>!wantedId||recordId(row)===wantedId)
    .filter(row=>!wantedHn||valueText(row.patient_hn).trim()===wantedHn)
    .slice(0,limit);

  const candidates=[];
  const skipped=[];
  for(const center of sourceRows){
    const centerOrderId=recordId(center);
    const groups=normalizeCenterOrderGroups(center.selected_items_json);
    if(!centerOrderId){
      skipped.push({center_order_id:'',patient_hn:valueText(center.patient_hn),reason:'Center Lab record ไม่มี record id'});
      continue;
    }
    if(!groups.length){
      skipped.push({center_order_id:centerOrderId,patient_hn:valueText(center.patient_hn),reason:'selected_items_json ไม่มีรายการที่ส่งต่อห้อง Lab ได้'});
      continue;
    }
    candidates.push({center,centerOrderId,groups});
  }

  const preview=candidates.map(candidate=>({
    center_order_id:candidate.centerOrderId,
    patient_hn:valueText(candidate.center.patient_hn),
    patient_name:valueText(candidate.center.patient_name),
    section_count:candidate.groups.length,
    sections:candidate.groups.map(group=>({
      section_code:valueText(group.section_code),
      section_name:valueText(group.section_name),
      order_number:valueText(group.order_number||group.lab_no)||'(จะสร้าง LAB NO.)',
      item_count:parseArray(group.selected_items).length
    }))
  }));

  const confirmed=params.confirm===true||params.confirm==='true';
  if(!confirmed){
    return {
      success:true,
      dry_run:true,
      message:'ตรวจพบ Center Lab ที่พร้อม sync '+candidates.length+' ใบ — ส่ง confirm:true เพื่อสร้าง/อัปเดต Status',
      source_count:sourceRows.length,
      candidate_count:candidates.length,
      skipped_count:skipped.length,
      candidates:preview,
      skipped
    };
  }

  const synced=[];
  const failed=[];
  for(const candidate of candidates){
    try{
      // Use the same safe materializer as the Form Event.  In particular, do
      // not fall back to the legacy sync path that writes LAB NO. back to the
      // Center source record.
      const body=await materializeCenterOrder(candidate.center);
      if(body.success===false){
        // Keep the section-level failure visible to the caller.  A generic
        // “partial success” message is not actionable when diagnosing an
        // event-created Status row.
        const detail=Array.isArray(body.failed)&&body.failed.length
          ? body.failed.map(item=>{
              const order=valueText(item&&item.order_number);
              const reason=valueText(item&&item.reason);
              return (order?order+': ':'')+(reason||'ไม่ทราบสาเหตุ');
            }).join(' | ')
          : '';
        throw Error((body.message||'sync Center Lab ไม่สำเร็จ')+(detail?' — '+detail:''));
      }
      synced.push({
        center_order_id:candidate.centerOrderId,
        patient_hn:valueText(candidate.center.patient_hn),
        created:body.created||[],
        updated:body.updated||[],
        unchanged:body.unchanged||[]
      });
    }catch(error){
      failed.push({
        center_order_id:candidate.centerOrderId,
        patient_hn:valueText(candidate.center.patient_hn),
        reason:valueText(error&&error.message||error)
      });
    }
  }

  return {
    success:failed.length===0,
    message:'sync จาก Center Lab แล้ว '+synced.length+' ใบ',
    synced_count:synced.length,
    failed_count:failed.length,
    skipped_count:skipped.length,
    synced,
    failed,
    skipped
  };
}

if(params.action==='sync_center_order_edit'){
  const centerOrderId=valueText(params.center_order_id||params.center_lab_order_id).trim();
  const groups=normalizeCenterOrderGroups(params.selected_items_json||params.groups);
  if(!centerOrderId)return {success:false,message:'center_order_id is required'};
  if(!groups.length)return {success:false,message:'selected_items_json is required'};

  const updated=[];
  const unchanged=[];
  const failed=[];
  let centerGroupsChanged=false;
  for(let index=0;index<groups.length;index++){
    let source=groups[index]||{};
    let orderNumber=valueText(source.order_number||source.lab_no).trim();
    if(!orderNumber){
      const sectionCode=valueText(source.section_code||source.sectionCode).trim();
      if(!sectionCode){
        failed.push({order_number:'',reason:'พบรายการที่ไม่มี section_code จึงยังส่งต่อห้อง Lab ไม่ได้'});
        continue;
      }
      orderNumber=await nextCenterLabSequence(sectionCode.padStart(2,'0').slice(0,2));
      source={...source,order_number:orderNumber};
      groups[index]=source;
      centerGroupsChanged=true;
    }
    try{
      const found=await findRawByOrderNumber(orderNumber);
      const row=found&&found.reply&&found.reply.data;
      const nextItems=parseArray(source.selected_items);
      const nextSpecimens=parseArray(source.specimens);
      // A status row can be absent if an older Center insert process received
      // a pre-numbered group and skipped creation.  On the next Center save,
      // recover it from that exact Center record rather than leaving the Lab
      // worklist permanently incomplete.
      if(!found.success||!row){
        const created=await createMissingStatusFromCenterGroup(centerOrderId,{...source,selected_items:nextItems,specimens:nextSpecimens});
        updated.push({order_number:orderNumber,added_count:nextItems.length,removed_count:0,created:true,section_code:created.section_code});
        continue;
      }
      const diff=orderItemDiff(row.selected_items,nextItems);
      const history=parseArray(row.order_change_history_json||row.order_change_history);
      if(diff.added.length||diff.removed.length){
        history.push({changed_at:now,changed_by:actor,added:diff.added,removed:diff.removed});
      }
      const saved=await saveForm(recordId(row),toFormData(row,{
        center_order_id:centerOrderId,
        section_code:valueText(source.section_code)||row.section_code,
        section_name:valueText(source.section_name)||row.section_name,
        selected_items:nextItems,
        specimens:nextSpecimens,
        order_change_history_json:history
      }));
      if(!saved||!saved.success)throw Error((saved&&saved.message)||'บันทึก Status ไม่สำเร็จ');
      if(diff.added.length||diff.removed.length){
        updated.push({order_number:orderNumber,added_count:diff.added.length,removed_count:diff.removed.length});
      }else{
        unchanged.push(orderNumber);
      }
    }catch(error){
      failed.push({order_number:orderNumber,reason:valueText(error&&error.message||error)});
    }
  }
  // Persist the normalized groups and their LAB NO. back to Center.  This
  // makes a one-time re-save of a legacy/raw order recoverable and prevents a
  // future edit from generating a second Lab Status record.
  if(centerGroupsChanged){
    await app.dbUpdate(
      {selected_items_json:JSON.stringify(groups)},
      CENTER_LAB_ORDER_COLLECTION,
      userInfo,
      {_id:app.dbObjectId(centerOrderId)}
    );
  }
  return {
    success:failed.length===0,
    message:failed.length?'sync Lab Status สำเร็จบางส่วน':'sync รายการ Lab Status สำเร็จ',
    updated,
    unchanged,
    failed
  };
}

if(params.action==='update_work_status'){
  const orderNumber=valueText(params.order_number).trim();
  const nextWorkStatus=valueText(params.work_status).trim().toLowerCase();
  if(!orderNumber)return {success:false,message:'order_number is required'};
  if(VALID_WORK_STATUS.indexOf(nextWorkStatus)===-1)return {success:false,message:'work_status must be one of '+VALID_WORK_STATUS.join(', ')};

  const found=await findRawByOrderNumber(orderNumber);
  const row=found&&found.reply&&found.reply.data;
  if(!found.success||!row)return {success:false,message:'ไม่พบรายการสำหรับ order_number '+orderNumber};
  const specimenStatus=normalStatus(row.specimen_status);
  const developmentEarlyAction=DEV_ALLOW_EARLY_LAB_ACTIONS&&['waiting','collected'].includes(specimenStatus);
  if(specimenStatus!=='sent'&&!developmentEarlyAction){
    return {success:false,message:'ห้อง Lab รับงานได้เฉพาะรายการที่ศูนย์กลางส่งต่อแล้ว'};
  }

  const currentWorkStatus=valueText(row.work_status)||'waiting_receive';
  const allowedNext=WORK_TRANSITIONS[currentWorkStatus]||[];
  // Records opened by the former transient receive UI can already have a
  // physical receive stamp while work_status still says waiting_receive.
  const receivedLegacyStart=currentWorkStatus==='waiting_receive'&&
    nextWorkStatus==='processing'&&Boolean(valueText(row.received_at).trim());
  if(currentWorkStatus!==nextWorkStatus&&allowedNext.indexOf(nextWorkStatus)===-1&&!receivedLegacyStart){
    return {success:false,message:'ไม่สามารถเปลี่ยนสถานะจาก '+currentWorkStatus+' เป็น '+nextWorkStatus};
  }

  const patch={work_status:nextWorkStatus};
  if(nextWorkStatus==='received'){
    // Preserve the physical first-receive stamp if Lab already opened this
    // transient workspace during the parallel-development phase.
    patch.received_at=valueText(row.received_at).trim()||now;
    patch.received_by=valueText(row.received_by).trim()||actor;
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
  return {
    success:true,
    message:'อัปเดตสถานะงานห้อง Lab สำเร็จ',
    order_number:orderNumber,
    work_status:nextWorkStatus,
    development_early_action:developmentEarlyAction
  };
}

return {success:false,message:'unknown action: '+valueText(params.action)};
