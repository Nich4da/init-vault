"""Make the aggregate Lab Workbench tab read Lab Center Specimen data.

Lab Center Specimen is a form_ui application, so it exposes its records through
the published API Process rather than through a FORM ListView provider.
"""

import json


PATH = 'Lab_Biochem_initCraft_import.json'
LAB_CENTER_SPECIMEN_APP_ID = '6a7da6ec8d398c11cf2fe865'
LAB_CENTER_SPECIMEN_PROCESS_ID = '6a7e787e8d398c11cf2fe8b8'


CONTENT = '''<div class="lab-panel lab-center-specimen-source">
  <div class="lab-panel-head"><div><h2>รายการสั่ง Lab ทั้งหมด</h2><p>ข้อมูลจาก Lab Center Specimen</p></div><span>{{ info }}</span></div>
  <div class="lab-toolbar lab-toolbar-received"><div class="lab-search-wrap"><input class="lab-search" :value="search" @input="setSearch($event.target.value)" placeholder="ค้นหา HN, ชื่อผู้ป่วย, LAB NO. หรือ Section" /></div><button class="lab-button" type="button" @click="load">โหลดใหม่</button></div>
  <div class="lab-table-wrap"><table class="lab-table"><thead><tr><th>HN / LAB NO.</th><th>ชื่อผู้ป่วย</th><th>Section</th><th>Specimen</th><th>Order</th><th>สถานะ</th></tr></thead><tbody><tr v-for="row in filtered()" :key="row._id||row.id||row.order_number"><td><b>{{ row.patient_hn || '-' }}</b><br><small>{{ row.lab_no || 'LAB NO. รอกำหนด' }}</small></td><td>{{ row.patient_name || '-' }}</td><td>{{ row.section_name || row.section_code || '-' }}</td><td>{{ specimens(row) }}</td><td><span class="lab-status-tag">{{ itemCount(row) }} รายการ</span></td><td><span class="lab-status-tag">{{ statusLabel(row) }}</span></td></tr><tr v-if="!loading&&!filtered().length"><td colspan="6" class="lab-empty">ไม่พบรายการจาก Lab Center Specimen</td></tr></tbody></table></div>
</div>'''


SCRIPT = f'''const s=this.vueState;const field=this;const PROCESS_ID='{LAB_CENTER_SPECIMEN_PROCESS_ID}';
s.rows=[];s.search='';s.loading=false;s.info='';
s.safeArray=v=>{{try{{const x=typeof v==='string'?JSON.parse(v||'[]'):(v||[]);return Array.isArray(x)?x:[]}}catch(e){{return []}}}};
s.items=row=>s.safeArray(row&&row.selected_items);
s.itemCount=row=>s.items(row).length;
s.specimens=row=>{{const list=s.safeArray(row&&row.specimens);const seen={{}};return list.map(x=>String(x.label||x.specimen_name||x.specimen_code||'ไม่ระบุ specimen')).filter(x=>{{if(seen[x])return false;seen[x]=true;return true}}).join(' · ')||'-'}};
s.statusLabel=row=>{{const x=String(row&&row.specimen_status||'waiting').toLowerCase();return x==='collected'?'รอส่งสิ่งส่งตรวจ':x==='sent'?'ส่งสิ่งส่งตรวจแล้ว':'รอรับสิ่งส่งตรวจ'}};
s.setSearch=v=>{{s.search=String(v||'')}};
s.filtered=()=>{{const q=s.search.trim().toLowerCase();return !q?s.rows:s.rows.filter(r=>[r.patient_hn,r.patient_name,r.lab_no,r.order_number,r.section_name,r.section_code].join(' ').toLowerCase().includes(q))}};
s.load=()=>{{const form=field.getFormRef&&field.getFormRef(),api=(form&&form.userState)||field.globalUserState;if(!api||typeof api.runProcess!=='function'){{s.rows=[];s.info='ไม่พบ API connector';field.notify(s.info,'error',4000);return}}s.loading=true;s.info='กำลังโหลด...';let settled=false;const done=res=>{{if(settled)return;settled=true;s.loading=false;const body=res&&res.data&&((res.data.success!==undefined)||Array.isArray(res.data.rows))?res.data:(res||{{}});if(body.success===false){{s.rows=[];s.info=body.message||'โหลดไม่สำเร็จ';field.notify(s.info,'error',4000);return}}s.rows=Array.isArray(body.rows)?body.rows:[];s.info='พบ '+s.rows.length+' รายการ'}},fail=err=>{{if(settled)return;settled=true;s.loading=false;s.rows=[];s.info='โหลดไม่สำเร็จ';field.notify('โหลด Lab Center Specimen ไม่สำเร็จ: '+((err&&err.message)||''),'error',4500)}};try{{const out=api.runProcess(PROCESS_ID,{{action:'list'}},done,fail);if(out&&typeof out.then==='function')out.then(done).catch(fail)}}catch(e){{fail(e)}}}};'''


WAITING_CONTENT = '''<div class="lab-panel lab-center-specimen-source">
  <div class="lab-panel-head"><div><h2>ผู้ป่วยรอรับสิ่งส่งตรวจ</h2><p>{{ currentLabName() }} · ข้อมูลจาก Lab Center Specimen</p></div><span>{{ info }}</span></div>
  <div class="lab-toolbar lab-toolbar-received"><div class="lab-search-wrap"><input class="lab-search" :value="search" @input="setSearch($event.target.value)" placeholder="ค้นหา HN, ชื่อผู้ป่วย, LAB NO. หรือ Section" /></div><button class="lab-button" type="button" @click="load">โหลดใหม่</button></div>
  <div class="lab-table-wrap"><table class="lab-table"><thead><tr><th>HN / LAB NO.</th><th>ชื่อผู้ป่วย</th><th>Section</th><th>Specimen</th><th>Order</th><th></th></tr></thead><tbody><tr v-for="row in filtered()" :key="row._id||row.id||row.order_number"><td><b>{{ row.patient_hn || '-' }}</b><br><small>{{ row.lab_no || 'LAB NO. รอกำหนด' }}</small></td><td>{{ row.patient_name || '-' }}</td><td>{{ row.section_name || row.section_code || '-' }}</td><td>{{ specimens(row) }}</td><td><span class="lab-status-tag">{{ itemCount(row) }} รายการ</span></td><td><el-button type="primary" size="small" :loading="!!updating[row.order_number]" @click="receive(row)">รับสิ่งส่งตรวจ</el-button></td></tr><tr v-if="!loading&&!filtered().length"><td colspan="6" class="lab-empty">ไม่มีรายการรอรับสำหรับ {{ currentLabName() }}</td></tr></tbody></table></div>
</div>'''


WAITING_SCRIPT = f'''const s=this.vueState;const field=this;const PROCESS_ID='{LAB_CENTER_SPECIMEN_PROCESS_ID}';
const LAB_BY_UNIT={{'10':{{name:'Biochemistry',codes:['BC'],names:['biochemistry']}},'20':{{name:'Hematology',codes:['HM','HH'],names:['hematology','hematology-homeostasis']}},'21':{{name:'Clinical Microscopy Laboratory',codes:['ML'],names:['clinical microscopy laboratory']}},'30':{{name:'Immunology',codes:['IM'],names:['immunology']}},'31':{{name:'Immunology-ส่งนอกรพ.',codes:['MI-OUT'],names:['immunology-ส่งนอกรพ.']}},'40':{{name:'Microbiology',codes:['MB'],names:['microbiology']}},'41':{{name:'Mycology',codes:['MY'],names:['mycology']}},'50':{{name:'Blood Bank',codes:['BB'],names:['blood bank']}},'70':{{name:'Biomolecular and Genetics',codes:['BG'],names:['biomolecular and genetics']}}}};
s.rows=[];s.search='';s.loading=false;s.info='';s.updating={{}};s.contextTick=0;
s.unitCode=()=>{{const form=field.getFormRef&&field.getFormRef(),states=[field.globalUserState,form&&form.userState];for(let i=0;i<states.length;i++){{const state=states[i]||{{}},user=state.user||state,unit=user.unit||user.currentUnit||user.xunitx||state.unit||state.currentUnit||state.xunitx;if(unit){{if(typeof unit==='string'||typeof unit==='number')return String(unit).trim();return String(unit.code||unit.unit_code||unit.value||unit.id||'').trim()}}}}return ''}};
s.currentLab=()=>LAB_BY_UNIT[s.unitCode()]||{{name:'ห้องปฏิบัติการ Lab',codes:[],names:[]}};s.currentLabName=()=>s.currentLab().name;
s.safeArray=v=>{{try{{const x=typeof v==='string'?JSON.parse(v||'[]'):(v||[]);return Array.isArray(x)?x:[]}}catch(e){{return []}}}};s.items=row=>s.safeArray(row&&row.selected_items);s.itemCount=row=>s.items(row).length;
s.specimens=row=>{{const list=s.safeArray(row&&row.specimens);const seen={{}};return list.map(x=>String(x.label||x.specimen_name||x.specimen_code||'ไม่ระบุ specimen')).filter(x=>{{if(seen[x])return false;seen[x]=true;return true}}).join(' · ')||'-'}};
s.isMine=row=>{{const lab=s.currentLab(),code=String(row&&row.section_code||'').trim().toUpperCase(),name=String(row&&row.section_name||'').trim().toLowerCase();return lab.codes.includes(code)||lab.names.includes(name)}};
s.setSearch=v=>{{s.search=String(v||'')}};s.filtered=()=>{{const q=s.search.trim().toLowerCase();return s.rows.filter(r=>{{if(String(r.specimen_status||'waiting').toLowerCase()!=='waiting'||!s.isMine(r))return false;return !q||[r.patient_hn,r.patient_name,r.lab_no,r.order_number,r.section_name,r.section_code].join(' ').toLowerCase().includes(q)}})}};
s.body=res=>res&&res.data&&((res.data.success!==undefined)||Array.isArray(res.data.rows))?res.data:(res||{{}});
s.load=()=>{{const form=field.getFormRef&&field.getFormRef(),api=(form&&form.userState)||field.globalUserState;if(!api||typeof api.runProcess!=='function'){{s.rows=[];s.info='ไม่พบ API connector';return}}s.loading=true;s.info='กำลังโหลด...';let settled=false;const done=res=>{{if(settled)return;settled=true;s.loading=false;const body=s.body(res);if(body.success===false){{s.rows=[];s.info=body.message||'โหลดไม่สำเร็จ';return}}s.rows=Array.isArray(body.rows)?body.rows:[];s.info='พบ '+s.filtered().length+' รายการสำหรับ '+s.currentLabName()}},fail=err=>{{if(settled)return;settled=true;s.loading=false;s.rows=[];s.info='โหลดไม่สำเร็จ';field.notify('โหลด Lab Center Specimen ไม่สำเร็จ: '+((err&&err.message)||''),'error',4500)}};try{{const out=api.runProcess(PROCESS_ID,{{action:'list'}},done,fail);if(out&&typeof out.then==='function')out.then(done).catch(fail)}}catch(e){{fail(e)}}}};
s.receive=row=>{{const form=field.getFormRef&&field.getFormRef(),api=(form&&form.userState)||field.globalUserState,key=row.order_number;if(!key||!api||typeof api.runProcess!=='function'){{field.notify('ไม่พบ API connector หรือเลขที่ order','error',3500);return}}if(s.updating[key])return;s.updating={{...s.updating,[key]:true}};const finish=()=>{{const next={{...s.updating}};delete next[key];s.updating=next}};api.runProcess(PROCESS_ID,{{action:'update',order_number:key,status:'collected'}},res=>{{finish();const body=s.body(res);if(body.success===false){{field.notify(body.message||'รับสิ่งส่งตรวจไม่สำเร็จ','error',4000);return}}field.notify('รับสิ่งส่งตรวจแล้ว','success',2500);s.load()}},err=>{{finish();field.notify('รับสิ่งส่งตรวจไม่สำเร็จ: '+((err&&err.message)||''),'error',4000)}})}};'''


def replace_node(value):
    if isinstance(value, dict):
        for key, child in list(value.items()):
            if isinstance(child, dict) and child.get('id') in ('list-ui-lab-all-orders', 'vue-ui-lab-all-orders-center-specimen'):
                value[key] = {
                    'key': child.get('key', 81011), 'name': 'Components', 'component': 'vue-ui',
                    'category': 'display_ui', 'icon': 'vue-ui', 'fieldType': 'None',
                    'fieldLength': None, 'children': False, 'enable': True,
                    'formItemFlag': False, 'id': 'vue-ui-lab-all-orders-center-specimen',
                    'options': {
                        'name': 'lab_all_orders_center_specimen',
                        'label': 'รายการสั่ง Lab ทั้งหมด', 'columnSpan': 24,
                        'hidden': False, 'content': CONTENT, 'customClass': '',
                        'onCreated': SCRIPT, 'onMounted': 'this.vueState.load()', 'onUnmount': ''
                    }
                }
                return True
            if replace_node(child):
                return True
    elif isinstance(value, list):
        for index, child in enumerate(value):
            if isinstance(child, dict) and child.get('id') in ('list-ui-lab-all-orders', 'vue-ui-lab-all-orders-center-specimen'):
                value[index] = {
                    'key': child.get('key', 81011), 'name': 'Components', 'component': 'vue-ui',
                    'category': 'display_ui', 'icon': 'vue-ui', 'fieldType': 'None',
                    'fieldLength': None, 'children': False, 'enable': True,
                    'formItemFlag': False, 'id': 'vue-ui-lab-all-orders-center-specimen',
                    'options': {
                        'name': 'lab_all_orders_center_specimen',
                        'label': 'รายการสั่ง Lab ทั้งหมด', 'columnSpan': 24,
                        'hidden': False, 'content': CONTENT, 'customClass': '',
                        'onCreated': SCRIPT, 'onMounted': 'this.vueState.load()', 'onUnmount': ''
                    }
                }
                return True
            if replace_node(child):
                return True
    return False


def replace_waiting_node(value):
    replacement = {
        'key': 81021, 'name': 'Components', 'component': 'vue-ui', 'category': 'display_ui',
        'icon': 'vue-ui', 'fieldType': 'None', 'fieldLength': None, 'children': False,
        'enable': True, 'formItemFlag': False, 'id': 'vue-ui-lab-waiting-center-specimen',
        'options': {'name': 'lab_waiting_center_specimen', 'label': 'รอรับสิ่งส่งตรวจ',
                    'columnSpan': 24, 'hidden': False, 'content': WAITING_CONTENT,
                    'customClass': '', 'onCreated': WAITING_SCRIPT,
                    'onMounted': 'this.vueState.load()', 'onUnmount': ''}
    }
    if isinstance(value, dict):
        for key, child in list(value.items()):
            if isinstance(child, dict) and child.get('id') in ('list-ui-lab-waiting', 'vue-ui-lab-waiting-center-specimen'):
                value[key] = replacement
                return True
            if replace_waiting_node(child):
                return True
    elif isinstance(value, list):
        for index, child in enumerate(value):
            if isinstance(child, dict) and child.get('id') in ('list-ui-lab-waiting', 'vue-ui-lab-waiting-center-specimen'):
                value[index] = replacement
                return True
            if replace_waiting_node(child):
                return True
    return False


with open(PATH, encoding='utf-8') as source:
    form = json.load(source)

if not replace_node(form):
    raise RuntimeError('list-ui-lab-all-orders not found')
if not replace_waiting_node(form):
    raise RuntimeError('list-ui-lab-waiting not found')

with open(PATH, 'w', encoding='utf-8') as target:
    json.dump(form, target, ensure_ascii=False, indent=2)
    target.write('\n')

print(f'Updated {PATH} to read Lab Center Specimen App {LAB_CENTER_SPECIMEN_APP_ID}')
