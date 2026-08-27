import json


SOURCE = 'Lab_Biochem_initCraft_import.json'
TARGET = 'Lab_Center_Specimen_Hub_APP_V3.json'
CENTER_FORM_ID = '6a75a7810796231c653df996'


CONTENT = r'''<div class="lch-app">
  <div class="lch-head">
    <div><div class="lch-kicker">LAB CENTER</div><h2>ศูนย์ตรวจรับ Specimen</h2><p>รายการใบสั่งจาก Center Lab Order</p></div>
    <el-button :loading="loading" @click="load">โหลดใหม่</el-button>
  </div>
  <div class="lch-toolbar">
    <el-input :model-value="search" placeholder="ค้นหา HN, ชื่อผู้ป่วย, LAB NO. หรือ Ward / Clinic" clearable @input="setSearch" @clear="setSearch('')" />
    <span>{{ info }}</span>
  </div>
  <el-tabs v-model="view" class="lch-tabs">
    <el-tab-pane label="รายการรวมตรวจ specimen" name="queue" />
    <el-tab-pane label="ตรวจ specimen" name="checking" />
    <el-tab-pane label="ส่งต่อห้อง Lab แล้ว" name="forwarded" />
  </el-tabs>
  <div v-if="filtered().length" class="lch-list">
    <div v-for="row in filtered()" :key="row._id||row.id" class="lch-row">
      <div class="lch-avatar">{{ initial(row) }}</div>
      <div class="lch-patient"><b>{{ row.patient_name || '-' }}</b><span>HN {{ row.patient_hn || '-' }} · {{ labNo(row) }}</span><small>{{ row.ward_clinic || '-' }} · {{ time(row.created_at||row.ordered_at) }}</small></div>
      <div class="lch-cell"><label>Specimen</label><span>{{ specimens(row) }}</span></div>
      <div class="lch-cell"><label>Order</label><span>{{ itemCount(row) }} รายการ</span></div>
      <span class="lch-status" :class="state(row)">{{ stateLabel(row) }}</span>
    </div>
  </div>
  <el-empty v-else :description="loading ? 'กำลังโหลดรายการ...' : 'ไม่พบรายการ'" />
</div>'''


SCRIPT = f'''const s=this.vueState;const field=this;const PROVIDER={{providerId:'{CENTER_FORM_ID}',providerType:'FORM',params:{{}},options:{{limit:1000,orderBy:[{{column:'created_at',sort:'DESC'}}]}}}};
s.rows=[];s.search='';s.view='queue';s.loading=false;s.info='';
s.extract=out=>{{const picks=[out,out&&out.data,out&&out.rows,out&&out.data&&out.data.data,out&&out.data&&out.data.rows,out&&out.reply&&out.reply.data];for(let i=0;i<picks.length;i++)if(Array.isArray(picks[i]))return picks[i];return []}};
s.safeArray=v=>{{try{{const x=typeof v==='string'?JSON.parse(v||'[]'):(v||[]);return Array.isArray(x)?x:[]}}catch(e){{return []}}}};
s.state=row=>String(row&&row.central_specimen_status||'awaiting_check').toLowerCase();
s.stateLabel=row=>{{const x=s.state(row);return x==='checking'?'กำลังตรวจ specimen':x==='forwarded'?'ส่งต่อห้อง Lab แล้ว':'รอตรวจ specimen'}};
s.initial=row=>{{const x=String(row&&row.patient_name||row&&row.patient_hn||'?').trim();return x?x.charAt(0).toUpperCase():'?'}};
s.labNo=row=>row&&row.lab_no||'LAB NO. รอกำหนด';
s.items=row=>s.safeArray(row&&row.selected_items_json);
s.itemCount=row=>s.items(row).length;
s.specimens=row=>{{let records=s.safeArray(row&&row.specimen_records_json);if(!records.length)records=s.items(row).map(i=>({{specimen_code:i.specimen_code||(i.c_specimen&&i.c_specimen.specimen_code)||'',label:i.specimen_name||(i.c_specimen&&i.c_specimen.label)||''}}));const seen={{}};return records.map(x=>String(x.label||x.specimen_name||x.specimen_code||'ไม่ระบุ specimen')).filter(x=>{{if(seen[x])return false;seen[x]=true;return true}}).join(' · ')||'-'}};
s.time=v=>{{if(!v)return '-';try{{return new Date(v).toLocaleString('th-TH',{{dateStyle:'short',timeStyle:'short'}})}}catch(e){{return String(v)}}}};
s.setSearch=v=>{{s.search=String(v||'')}};
s.filtered=()=>{{const q=s.search.trim().toLowerCase(),view=s.view||'queue';return s.rows.filter(r=>{{const status=s.state(r),match=view==='queue'?status!=='checking'&&status!=='forwarded':status===view;if(!match)return false;return !q||[r.patient_hn,r.patient_name,r.lab_no,r.ward_clinic].join(' ').toLowerCase().includes(q)}})}};
s.apply=out=>{{const rows=s.extract(out);s.rows=rows;s.info='พบ '+rows.length+' ใบสั่ง';if(!rows.length){{const msg=out&&(out.message||(out.data&&out.data.message));if(msg)s.info=String(msg)}}}};
s.fail=err=>{{s.rows=[];s.info='โหลดไม่สำเร็จ';field.notify('โหลด Center Lab Order ไม่สำเร็จ: '+((err&&err.message)||'ตรวจสอบสิทธิ์ Form provider'),'error',4500)}};
s.load=()=>{{const form=field.getFormRef&&field.getFormRef(),api=(form&&form.userState)||field.globalUserState;if(!api||typeof api.crudGetAll!=='function'){{s.fail(new Error('ไม่พบ API connector'));return}}s.loading=true;s.info='กำลังโหลด Center Lab Order...';let settled=false;const done=out=>{{if(settled)return;settled=true;s.apply(out);s.loading=false}},bad=err=>{{if(settled)return;settled=true;s.fail(err);s.loading=false}};try{{const result=api.crudGetAll({{sdProvider:PROVIDER,totalEnable:true}},done,bad);if(result&&typeof result.then==='function')result.then(done).catch(bad)}}catch(e){{bad(e)}}}};'''


CSS = '''.lch-app{font-family:"IBM Plex Sans Thai","Noto Sans Thai",Tahoma,sans-serif;color:#1e293b}.lch-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px}.lch-kicker{font-size:11px;font-weight:800;letter-spacing:.12em;color:#3b82f6}.lch-head h2{margin:3px 0;font-size:21px}.lch-head p{margin:0;color:#64748b;font-size:13px}.lch-toolbar{display:flex;align-items:center;gap:14px;margin-bottom:8px}.lch-toolbar .el-input{max-width:520px}.lch-toolbar span{color:#64748b;font-size:12px}.lch-tabs{margin-bottom:8px}.lch-list{overflow:hidden;border:1px solid #e2e8f0;border-radius:10px;background:#fff}.lch-row{display:grid;grid-template-columns:48px minmax(220px,1fr) minmax(180px,.8fr) minmax(90px,.28fr) max-content;gap:14px;align-items:center;padding:13px 16px;border-bottom:1px solid #edf2f7}.lch-row:last-child{border-bottom:0}.lch-avatar{display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:9px;background:#e5f0ff;color:#337ee8;font-size:17px;font-weight:800}.lch-patient,.lch-cell{display:flex;min-width:0;flex-direction:column;gap:3px}.lch-patient b{font-size:14px}.lch-patient span{color:#64748b;font-size:12px;font-weight:600}.lch-patient small{color:#94a3b8;font-size:11px}.lch-cell label{color:#94a3b8;font-size:11px}.lch-cell span{color:#334155;font-size:12px;line-height:1.4;overflow-wrap:anywhere}.lch-status{padding:4px 8px;border-radius:4px;font-size:12px;font-weight:700;white-space:nowrap}.lch-status.awaiting_check{background:#f1f2f4;color:#6b7280}.lch-status.checking{background:#fff3d8;color:#c47b00}.lch-status.forwarded{background:#e7f9eb;color:#16833b}@media(max-width:820px){.lch-head,.lch-toolbar{align-items:stretch;flex-direction:column}.lch-toolbar .el-input{max-width:none}.lch-row{grid-template-columns:46px minmax(0,1fr);gap:10px}.lch-cell,.lch-status{grid-column:2}}'''


with open(SOURCE, encoding='utf-8') as source:
    form = json.load(source)

form['fields'] = [{
    'key': 92301, 'name': 'Components', 'component': 'vue-ui', 'category': 'display_ui',
    'icon': 'vue-ui', 'fieldType': 'None', 'fieldLength': None, 'children': False,
    'enable': True, 'formItemFlag': False, 'id': 'vue-ui-center-specimen-app-v3',
    'options': {'name': 'center_specimen_app_v3', 'label': 'ศูนย์ตรวจรับ Specimen',
                'columnSpan': 24, 'hidden': False, 'content': CONTENT, 'customClass': '',
                'onCreated': SCRIPT, 'onMounted': 'this.vueState.load()', 'onUnmount': ''}
}]
cfg = form['formConfig']
cfg.update({'modelName': 'LabCenterSpecimenAppV3Form', 'refName': 'labCenterSpecimenAppV3FormRef',
            'rulesName': 'labCenterSpecimenAppV3Rules', 'labelPosition': 'top', 'labelWidth': 0,
            'cssCode': CSS, 'onFormDataChange': ''})

with open(TARGET, 'w', encoding='utf-8') as target:
    json.dump(form, target, ensure_ascii=False, indent=2)
    target.write('\n')

print(TARGET)
