import copy
import json

SOURCE = 'Lab_Biochem_initCraft_import.json'
TARGET = 'Lab_Center_Specimen_Hub.json'
CENTER_ORDER_FORM_ID = '6a75a7810796231c653df996'

CONTENT = '''<div class="lch-root">
  <div class="lch-titlebar">
    <div><div class="lch-kicker">LAB CENTER</div><h1>ศูนย์ตรวจรับ Specimen</h1><p>ตรวจรับสิ่งส่งตรวจก่อนส่งต่อให้ห้องปฏิบัติการ</p></div>
    <button class="lch-btn lch-btn-plain" type="button" @click="load">↻ โหลดใหม่</button>
  </div>
  <el-tabs v-model="activeTab" type="card" class="lch-tabs">
    <el-tab-pane name="queue"><template #label>รายการรอตรวจ <b v-if="queue().length" class="lch-tab-count">{{ queue().length }}</b></template>
      <div class="lch-toolbar"><el-input :model-value="search" @input="setSearch" clearable placeholder="ค้นหา HN, ชื่อผู้ป่วย, LAB NO. หรือ Ward / Clinic" prefix-icon="Search" /><span>{{ info }}</span></div>
      <div v-if="filteredQueue().length" class="lch-list"><button v-for="row in filteredQueue()" :key="row._id||row.id" type="button" class="lch-row" @click="openInspect(row)"><div class="lch-avatar">{{ initial(row) }}</div><div class="lch-patient"><b>{{ row.patient_name || '-' }}</b><span>HN{{ row.patient_hn || '-' }} · LAB NO. {{ row.lab_no || 'รอกำหนด' }}</span><small>{{ row.ward_clinic || '-' }} · {{ time(row.created_at||row.ordered_at) }}</small></div><div class="lch-spec-summary"><label>Specimen</label><span>{{ specimenCount(row) }} ประเภท</span></div><span class="lch-status awaiting">รอตรวจ specimen</span><span class="lch-arrow">›</span></button></div>
      <el-empty v-else description="ไม่มีรายการรอตรวจ specimen" />
    </el-tab-pane>
    <el-tab-pane name="inspect"><template #label>ตรวจ specimen</template>
      <div v-if="selected()" class="lch-inspect">
        <el-card class="card-container wcard-soft pcard pcard-bg plain" shadow="always"><div class="pcard-main"><el-avatar shape="square" :size="74" fit="cover" :src="photo(selected())" class="pcard-avatar">{{ initial(selected()) }}</el-avatar><div class="pcard-identity"><div class="pcard-name-row"><span class="pcard-name">{{ selected().patient_name || '-' }}</span><span class="pcard-chip primary">HN{{ selected().patient_hn || '-' }}</span><span v-if="selected().visit_vn" class="pcard-chip warning">VN{{ selected().visit_vn }}</span></div><div class="pcard-meta pcard-meta-sub"><span>LAB NO. {{ selected().lab_no || 'รอกำหนด' }}</span><span v-if="selected().ward_clinic"> · {{ selected().ward_clinic }}</span></div><div class="pcard-meta pcard-meta-tags"><span v-for="(x,i) in rights(selected())" :key="i" class="pcard-chip success">✓ {{ x }}</span></div></div><div class="pcard-divider"></div><div class="pcard-vitals"><div class="pcard-vital"><span>รายการตรวจ</span><b>{{ itemCount(selected()) }} รายการ</b></div><div class="pcard-vital"><span>เวลาสั่ง</span><b>{{ time(selected().created_at||selected().ordered_at) }}</b></div></div></div></el-card>
        <section class="lch-sheet"><div class="lch-sheet-head"><div><h2>Trick sheet — สิ่งส่งตรวจ</h2><p>ตรวจให้ครบก่อนส่งต่อห้องปฏิบัติการ</p></div><span>{{ checkedCount() }}/{{ specimens(selected()).length }} ครบ</span></div><label v-for="spec in specimens(selected())" :key="spec.key" class="lch-spec-row"><el-checkbox :model-value="isChecked(spec.key)" @change="setChecked(spec.key,$event)" /><div><b>{{ spec.label }}</b><span>ห้องปฏิบัติการ: {{ spec.sections.join(', ') }}</span></div><small v-if="spec.storage">{{ spec.storage }}</small></label><el-empty v-if="!specimens(selected()).length" description="ยังไม่มีรายละเอียด specimen ในใบสั่ง" /></section>
        <div class="lch-actions"><button class="lch-btn lch-btn-plain" type="button" @click="backToQueue">ย้อนกลับ</button><button class="lch-btn lch-btn-primary" :disabled="!canForward() || saving" type="button" @click="forward">{{ saving ? 'กำลังบันทึก...' : 'Specimen ครบ — ส่งต่อห้อง Lab' }}</button></div>
      </div>
      <el-empty v-else description="เลือกรายการจากแท็บ รายการรอตรวจ" />
    </el-tab-pane>
    <el-tab-pane name="forwarded"><template #label>ส่งต่อห้อง Lab แล้ว <b v-if="forwarded().length" class="lch-tab-count">{{ forwarded().length }}</b></template>
      <div class="lch-toolbar"><el-input :model-value="search" @input="setSearch" clearable placeholder="ค้นหา HN, ชื่อผู้ป่วย หรือ LAB NO." prefix-icon="Search" /><span>เก็บประวัติการส่งต่อ</span></div>
      <div v-if="filteredForwarded().length" class="lch-list"><div v-for="row in filteredForwarded()" :key="row._id||row.id" class="lch-row static"><div class="lch-avatar">{{ initial(row) }}</div><div class="lch-patient"><b>{{ row.patient_name || '-' }}</b><span>HN{{ row.patient_hn || '-' }} · LAB NO. {{ row.lab_no || 'รอกำหนด' }}</span><small>ส่งต่อ {{ time(row.central_forwarded_at) }} · {{ row.central_forwarded_by || '-' }}</small></div><div class="lch-spec-summary"><label>Specimen</label><span>{{ specimenCount(row) }} ประเภท</span></div><span class="lch-status forwarded">ส่งต่อห้อง Lab แล้ว</span></div></div>
      <el-empty v-else description="ยังไม่มีรายการที่ส่งต่อ" />
    </el-tab-pane>
  </el-tabs>
</div>'''

SCRIPT = '''const s=this.vueState;const field=this;const CENTER={providerId:"6a75a7810796231c653df996",providerType:"FORM",params:{},options:{}};
s.rows=[];s.search="";s.info="";s.activeTab="queue";s.selectedId="";s.checked={};s.saving=false;
s.extract=out=>{const p=[out,out&&out.data,out&&out.rows,out&&out.data&&out.data.data];for(let i=0;i<p.length;i++)if(Array.isArray(p[i]))return p[i];return []};
s.safeJson=v=>{try{return typeof v==='string'?JSON.parse(v||'{}'):(v||{})}catch(e){return {}}};
s.selected=()=>s.rows.find(r=>String(r._id||r.id)===String(s.selectedId))||null;
s.initial=row=>{const v=String(row&&row.patient_name||row&&row.patient_hn||'?').trim();return v?v.charAt(0).toUpperCase():"?"};
s.photo=row=>String(row&&row.patient_photo||row&&row.photo_url||"");
s.rights=row=>{const raw=s.safeJson(row&&row.inscl_hos_json);const a=Array.isArray(raw)?raw:[];return a.map(x=>String(x&&x.inscl_item_main&&(x.inscl_item_main.value||x.inscl_item_main.label)||x&&x.value||x&&x.label||"")).filter(Boolean)};
s.items=row=>{const x=s.safeJson(row&&row.selected_items_json);return Array.isArray(x)?x:[]};s.itemCount=row=>s.items(row).length;
s.specimens=row=>{const raw=s.safeJson(row&&row.specimen_records_json);const base=Array.isArray(raw)&&raw.length?raw:s.items(row).map(x=>({section_code:x.sectionCode||x.section_code||x.section_name||"Lab",specimen_code:x.c_specimen&&x.c_specimen.specimen_code||x.specimen_code||"unspecified",label:x.c_specimen&&x.c_specimen.label||x.specimen_name||"ไม่ระบุ specimen",storage:x.storage||""}));const map={};base.forEach(x=>{const code=String(x.specimen_code||x.code||"unspecified");const label=String(x.label||x.specimen_name||code);const key=code+"|"+label;if(!map[key])map[key]={key,label,storage:String(x.storage||""),sections:[]};const sec=String(x.section_code||x.sectionCode||x.section_name||"Lab");if(!map[key].sections.includes(sec))map[key].sections.push(sec)});return Object.values(map)};
s.specimenCount=row=>s.specimens(row).length;s.time=v=>{if(!v)return "-";try{return new Date(v).toLocaleString("th-TH",{dateStyle:"short",timeStyle:"short"})}catch(e){return String(v)}};
s.centralState=row=>String(row&&row.central_specimen_status||"awaiting_check").toLowerCase();s.queue=()=>s.rows.filter(r=>!["forwarded","cancelled"].includes(s.centralState(r)));s.forwarded=()=>s.rows.filter(r=>s.centralState(r)==="forwarded");
s.setSearch=v=>{s.search=v||""};s.filterRows=rows=>{const q=s.search.trim().toLowerCase();return !q?rows:rows.filter(r=>[r.patient_hn,r.patient_name,r.lab_no,r.ward_clinic].join(" ").toLowerCase().includes(q))};s.filteredQueue=()=>s.filterRows(s.queue());s.filteredForwarded=()=>s.filterRows(s.forwarded());
s.openInspect=row=>{s.selectedId=String(row._id||row.id||"");const prior=s.safeJson(row.central_specimen_check_json);s.checked=prior&&prior.checked||{};s.activeTab="inspect"};s.backToQueue=()=>{s.selectedId="";s.checked={};s.activeTab="queue"};s.isChecked=key=>!!s.checked[key];s.setChecked=(key,val)=>{s.checked={...s.checked,[key]:val===true}};s.checkedCount=()=>Object.values(s.checked).filter(Boolean).length;s.canForward=()=>{const row=s.selected();return !!row&&s.specimens(row).length>0&&s.specimens(row).every(x=>s.isChecked(x.key))};
s.load=()=>{try{s.info="กำลังโหลด...";const api=field.globalUserState||((field.getFormRef&&field.getFormRef())||{}).userState;if(!api||typeof api.crudGetAll!=="function")throw Error("ไม่พบ API connector");api.crudGetAll({sdProvider:CENTER,totalEnable:true},out=>{s.rows=s.extract(out);s.info="พบ "+s.rows.length+" ใบสั่ง"},err=>{throw err||Error("อ่านข้อมูลไม่สำเร็จ")})}catch(e){s.info="โหลดไม่สำเร็จ";field.notify("โหลด Lab Center Order ไม่สำเร็จ","error",4000)}};
s.forward=async()=>{const row=s.selected();const id=String(row&&row._id||row&&row.id||"");if(!id||!s.canForward())return;const api=field.globalUserState||((field.getFormRef&&field.getFormRef())||{}).userState;if(!api||typeof api.crudUpdate!=="function"){field.notify("ไม่พบ API connector สำหรับบันทึก","error",4000);return}try{const ok=await field.confirm("ยืนยันว่า specimen ครบ และพร้อมส่งต่อห้องปฏิบัติการ?","ส่งต่อห้อง Lab");if(!ok)return;s.saving=true;const user=(field.globalUserState&&field.globalUserState.user)||{};const actor=user.username||user.name||user.account||"";const now=new Date().toISOString();const data={central_specimen_status:"forwarded",central_checked_at:now,central_checked_by:actor,central_forwarded_at:now,central_forwarded_by:actor,central_specimen_check_json:JSON.stringify({checked:s.checked,checked_at:now,checked_by:actor})};await api.crudUpdate({id,data,sdProvider:CENTER});field.notify("ตรวจ specimen ครบแล้ว — ส่งต่อห้อง Lab","success",3000);s.selectedId="";s.checked={};s.activeTab="forwarded";s.load()}catch(e){field.notify("ส่งต่อห้อง Lab ไม่สำเร็จ: "+((e&&e.message)||"ตรวจสอบ API"),"error",4500)}finally{s.saving=false}};
s.load();'''

CSS = '''.lch-root{max-width:1500px;margin:0 auto;color:#1f2937}.lch-titlebar{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding:18px 20px;border:1px solid #d8e8ff;border-radius:12px;background:#f4f9ff;margin-bottom:16px}.lch-kicker{font-size:11px;font-weight:800;letter-spacing:.08em;color:#3b82f6}.lch-titlebar h1{margin:2px 0 3px;font-size:22px}.lch-titlebar p{margin:0;color:#64748b;font-size:13px}.lch-tabs .el-tabs__header{margin-bottom:16px}.lch-tab-count{display:inline-block;margin-left:5px;min-width:18px;padding:1px 5px;border-radius:9px;background:#eef2ff;color:#6747de;font-size:11px;text-align:center}.lch-toolbar{display:flex;align-items:center;gap:14px;margin:0 0 12px}.lch-toolbar .el-input{max-width:620px}.lch-toolbar span{color:#94a3b8;font-size:12px}.lch-list{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:#fff}.lch-row{display:grid;grid-template-columns:52px minmax(250px,1fr) minmax(100px,.3fr) max-content 20px;gap:14px;align-items:center;width:100%;padding:13px 16px;border:0;border-bottom:1px solid #e8edf3;background:#fff;text-align:left;cursor:pointer}.lch-row:last-child{border-bottom:0}.lch-row:not(.static):hover{background:#f8fbff}.lch-row.static{grid-template-columns:52px minmax(250px,1fr) minmax(100px,.3fr) max-content;cursor:default}.lch-avatar{display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:9px;background:#e5f0ff;color:#337ee8;font-size:18px;font-weight:800}.lch-patient{display:flex;min-width:0;flex-direction:column;gap:2px}.lch-patient b{font-size:14px}.lch-patient span{color:#64748b;font-size:12px}.lch-patient small{color:#94a3b8;font-size:11px}.lch-spec-summary{display:flex;flex-direction:column;gap:3px}.lch-spec-summary label{color:#94a3b8;font-size:11px}.lch-spec-summary span{font-size:12px}.lch-status{padding:4px 8px;border-radius:4px;font-size:12px;font-weight:700;white-space:nowrap}.lch-status.awaiting{background:#f1f2f4;color:#6b7280}.lch-status.forwarded{background:#e7f9eb;color:#16aa45}.lch-arrow{font-size:25px;color:#94a3b8}.lch-inspect{display:flex;flex-direction:column;gap:14px}.lch-sheet{border:1px solid #e2e8f0;border-radius:10px;background:#fff;overflow:hidden}.lch-sheet-head{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:15px 16px;border-bottom:1px solid #e8edf3}.lch-sheet-head h2{margin:0;font-size:17px}.lch-sheet-head p{margin:3px 0 0;color:#94a3b8;font-size:12px}.lch-sheet-head>span{padding:4px 8px;border-radius:4px;background:#fff3d8;color:#e29a05;font-size:12px;font-weight:700}.lch-spec-row{display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid #edf0f4;cursor:pointer}.lch-spec-row:last-child{border-bottom:0}.lch-spec-row>div{display:flex;flex:1;min-width:0;flex-direction:column;gap:2px}.lch-spec-row b{font-size:13px}.lch-spec-row span,.lch-spec-row small{color:#64748b;font-size:12px}.lch-actions{display:flex;justify-content:flex-end;gap:10px}.lch-btn{height:36px;padding:0 14px;border-radius:6px;font-weight:700;cursor:pointer}.lch-btn:disabled{opacity:.55;cursor:not-allowed}.lch-btn-plain{border:1px solid #cbd5e1;background:#fff;color:#475569}.lch-btn-primary{border:1px solid #2f80ed;background:#2f80ed;color:#fff}@media(max-width:760px){.lch-titlebar{flex-direction:column}.lch-toolbar{align-items:stretch;flex-direction:column}.lch-row,.lch-row.static{grid-template-columns:48px minmax(0,1fr);gap:10px}.lch-spec-summary,.lch-status{grid-column:2}.lch-arrow{display:none}.lch-sheet-head{align-items:flex-start;flex-direction:column}.lch-actions{flex-wrap:wrap}.lch-actions .lch-btn{flex:1}}'''


def component():
    return {
        'key': 92001, 'name': 'Components', 'component': 'vue-ui', 'category': 'display_ui',
        'icon': 'components-ui', 'fieldType': 'None', 'fieldLength': None, 'children': False,
        'enable': True, 'formItemFlag': False, 'id': 'vue-ui-lab-center-specimen-hub',
        'options': {'name': 'lab_center_specimen_hub', 'columnSpan': 4, 'hidden': False,
                    'label': 'ศูนย์ตรวจรับ Specimen', 'customClass': '', 'content': CONTENT,
                    'onCreated': SCRIPT, 'onMounted': 'this.vueState.load()', 'onUnmount': ''}
    }


with open(SOURCE, encoding='utf-8') as source:
    form = json.load(source)

form['fields'] = [component()]
cfg = form['formConfig']
cfg['modelName'] = 'LabCenterSpecimenHubForm'
cfg['refName'] = 'labCenterSpecimenHubFormRef'
cfg['rulesName'] = 'labCenterSpecimenHubRules'
cfg['labelPosition'] = 'top'
cfg['labelWidth'] = 0
cfg['cssCode'] = CSS
cfg['onFormDataChange'] = ''

with open(TARGET, 'w', encoding='utf-8') as target:
    json.dump(form, target, ensure_ascii=False, indent=2)
    target.write('\n')

print(TARGET)
