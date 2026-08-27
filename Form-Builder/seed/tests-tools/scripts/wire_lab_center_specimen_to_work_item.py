"""Wire Lab Center Specimen's Send action to the Lab Work Item bridge API."""

import json


PATH = 'lab_center_specimen.json'
WORK_ITEM_PROCESS_ID = '6a7e82ba8d398c11cf2fe8d5'

REPLACEMENT = r'''s.updateStatus=(row,nextStatus,doneMsg,afterUpdate)=>{const form=field.getFormRef&&field.getFormRef(),api=(form&&form.userState)||field.globalUserState;if(!api||typeof api.runProcess!=='function'){field.notify('ไม่พบ API connector','error',3500);return}const id=row._id||row.id;if(s.updatingIds[id])return;s.updatingIds={...s.updatingIds,[id]:true};const finish=()=>{const u={...s.updatingIds};delete u[id];s.updatingIds=u};const complete=()=>{finish();field.notify(doneMsg,'success',2500);s.load()};s.callProcess(api,{action:'update',order_number:row.order_number,status:nextStatus},res=>{const body=(res&&res.data)||{};if(!body.success){finish();field.notify('บันทึกไม่สำเร็จ: '+(body.message||''),'error',4000);return}if(typeof afterUpdate==='function'){afterUpdate(api,complete)}else complete()},err=>{finish();field.notify('บันทึกไม่สำเร็จ: '+(s.errMsg(err)||'ตรวจสอบการเชื่อมต่อ API'),'error',4000)})};
s.receive=row=>s.updateStatus(row,'collected','รับสิ่งส่งตรวจแล้ว');
s.send=row=>s.updateStatus(row,'sent','ส่งสิ่งส่งตรวจแล้ว',(api,complete)=>{const snapshot={...row,specimen_status:'sent'},id=row._id||row.id,failed=message=>{const u={...s.updatingIds};delete u[id];s.updatingIds=u;field.notify('ส่งสิ่งส่งตรวจแล้ว แต่สร้าง Lab Work Item ไม่สำเร็จ: '+message,'error',5000);s.load()};try{api.runProcess(WORK_ITEM_PROCESS_ID,{source_record:snapshot},res=>{const body=(res&&res.data)||{};if(body.success===false){failed(body.message||'');return}complete()},err=>failed(s.errMsg(err)||''))}catch(e){failed(s.errMsg(e)||'')}});'''

with open(PATH, encoding='utf-8') as source:
    form = json.load(source)

options = form['fields'][0]['options']
script = options['onCreated']
marker = "const PROCESS_ID='6a7e787e8d398c11cf2fe8b8';"
if marker not in script:
    raise RuntimeError('Lab Center Specimen Process ID not found')
script = script.replace(marker, marker + "const WORK_ITEM_PROCESS_ID='" + WORK_ITEM_PROCESS_ID + "';", 1)

start = script.find('s.updateStatus=')
if start < 0:
    raise RuntimeError('Lab Center Specimen status handler not found')
options['onCreated'] = script[:start] + REPLACEMENT

with open(PATH, 'w', encoding='utf-8') as target:
    json.dump(form, target, ensure_ascii=False, indent=2)
    target.write('\n')

print(PATH)
