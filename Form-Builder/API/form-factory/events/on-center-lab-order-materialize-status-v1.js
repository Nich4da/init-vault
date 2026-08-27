/*
 * Center Lab Form Event adapter — bind this same process to BOTH Insert and
 * Update on the Center Lab Order form.
 *
 * Contract:
 *   Center Lab is saved first by its own normal UI.
 *   This process only asks Lab Order Item Status to materialize the saved
 *   order into one work record per section.
 *
 * It deliberately returns no xformDatax and never writes to LabCen.  That is
 * essential: the user's selected items and native cancel/edit behaviour must
 * remain owned by the Center Lab form, not by this downstream adapter.
 */

const STATUS_PROCESS_ID='6a7e787e8d398c11cf2fe8b8';

const text=value=>{
  if(value==null)return '';
  if(typeof value==='object'){
    if(value.$oid!=null)return String(value.$oid).trim();
    if(value._id!=null)return text(value._id);
    if(value.id!=null)return text(value.id);
    if(value.value!=null&&typeof value.value!=='object')return String(value.value).trim();
  }
  return String(value).trim();
};

const centerOrderId=text(params&&((params._id)||params.dataid||params.id));
if(!centerOrderId)return {success:false,message:'Center Lab form event ไม่มี record id'};

const result=await app.subProcess(STATUS_PROCESS_ID,{
  action:'materialize_center_order',
  center_order_id:centerOrderId,
  center_record:params
},userInfo);

const body=(result&&result.data)||(result&&result.reply&&result.reply.data)||result||{};

// No xformDatax: a materialization failure must never overwrite or re-save
// the source order.  The returned result remains visible in the Form Event
// API logs for diagnosis.
return {
  success:body.success!==false,
  message:body.message||'ประมวลผล Lab Status แล้ว',
  center_order_id:centerOrderId,
  created:body.created||[],
  updated:body.updated||[],
  failed:body.failed||[] 
};
