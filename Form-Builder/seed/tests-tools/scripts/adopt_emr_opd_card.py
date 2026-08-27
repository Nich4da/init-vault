import json

PATH = 'Lab_Biochem_initCraft_import.json'


OPD_CARD_TEMPLATE = '''<div class="lab-screen lab-received-workspace">
  <div class="lab-received-toolbar">
    <span class="lab-muted">{{ info || 'เลือกผู้ป่วยจาก รอรับ เพื่อเปิดใบสั่งตรวจ' }}</span>
    <button class="lab-button" type="button" @click="load">โหลดใหม่</button>
  </div>

  <!-- Same pcard structure/classes as EMR opd_card; only the Lab data adapter differs. -->
  <el-card class="card-container wcard-soft pcard pcard-bg plain card-nav lab-opd-card" shadow="always">
    <div v-if="tran" class="pcard-main">
      <el-avatar shape="square" :size="74" fit="cover" :src="picUrl()" class="pcard-avatar mt-2">{{ patientInitial(selected()) }}</el-avatar>
      <div class="pcard-identity">
        <div class="pcard-name-row">
          <span class="pcard-name">{{ ptName() }}</span>
          <span v-if="pt().hn" class="pcard-chip primary">HN{{ pt().hn }}</span>
          <span v-if="pt().age || genderLabel()" class="pcard-chip">อายุ {{ pt().age || '-' }} ปี · {{ genderLabel() || '-' }}</span>
          <span v-if="aboLabel()" class="pcard-chip">เลือด {{ aboLabel() }}</span>
        </div>
        <div class="pcard-meta pcard-meta-sub">
          <span v-if="tran.vn" class="pcard-chip warning">VN{{ tran.vn }}</span>
          <span>LAB NO. {{ tran.labNo || 'รอกำหนด' }}</span>
          <span v-if="tran.orderedAt"> · ส่งตรวจ {{ time(tran.orderedAt) }}</span>
        </div>
        <div class="pcard-meta pcard-meta-tags">
          <span v-if="tran.wardClinic" class="pcard-chip primary">{{ tran.wardClinic }}</span>
          <span v-for="(right,index) in tran.rights" :key="'right-'+index" class="pcard-chip success">✓ {{ right }}</span>
          <span v-if="tran.payment" class="pcard-chip success">✓ {{ tran.payment }}</span>
        </div>
      </div>
      <div class="pcard-divider"></div>
      <div class="pcard-vitals lab-opd-vitals">
        <div class="pcard-vital"><span>ผู้รับเข้า</span><b>{{ tran.receivedBy || '-' }}</b></div>
        <div class="pcard-vital"><span>Specimen</span><b>{{ tran.specimen || '-' }}</b></div>
        <div class="pcard-vital"><span>สถานะ</span><b><span class="lab-status-pill is-received">รับเข้าแล้ว</span></b></div>
        <div class="pcard-vital"><span>Order</span><b>{{ tran.itemCount }} รายการ</b></div>
      </div>
    </div>
    <div v-if="tran && tran.allergies.length" class="pcard-alert">
      <span class="pcard-alert-title">แพ้ยา</span>
      <span v-for="(allergy,index) in tran.allergies" :key="'allergy-'+index" class="pcard-alert-chip">💊 {{ allergy }}</span>
    </div>
    <el-empty v-if="!tran" description="ยังไม่ได้เลือกคนไข้ — กดรับ specimen จากคิวรอรับ" />
  </el-card>

  <section v-if="selected()" class="lab-received-order-card">
    <div class="lab-received-order-head"><div><h2>List Order</h2><p>รายการตรวจของผู้ป่วยที่เลือก</p></div></div>
    <div class="lab-table-wrap"><table class="lab-table lab-received-table"><thead><tr><th>รหัส</th><th>รายการตรวจ</th><th style="text-align:right">ราคา</th><th>สถานะ</th></tr></thead><tbody><tr v-for="item in items(selected())" :key="item.id||item.master_id||item.code"><td><b>{{ item.code || '-' }}</b></td><td>{{ item.name || '-' }}</td><td style="text-align:right">{{ money(item.effective_price!=null?item.effective_price:item.sale_price) }}</td><td><span class="lab-status-pill is-waiting">รอตรวจ</span></td></tr></tbody></table></div>
    <div v-if="history(selected()).length" class="lab-received-history"><div class="lab-history-head"><h3>ประวัติการแก้ไขรายการส่งตรวจ</h3><select :value="historyFilter" @change="setHistoryFilter($event.target.value)"><option value="all">ทั้งหมด</option><option value="added">รายการที่เพิ่ม</option><option value="removed">รายการที่ลด</option></select></div><div v-for="(entry,index) in filteredHistory(selected())" :key="entry.changed_at||index" class="lab-history-entry"><div class="lab-history-time">{{ historyTime(entry.changed_at) }}<span v-if="entry.changed_by"> · {{ entry.changed_by }}</span></div><div v-if="historyFilter==='all'||historyFilter==='added'" v-for="item in (entry.added||[])" :key="'add-'+item.code" class="lab-history-add">＋ {{ item.code }} <span>{{ item.name }}</span></div><div v-if="historyFilter==='all'||historyFilter==='removed'" v-for="item in (entry.removed||[])" :key="'remove-'+item.code" class="lab-history-remove">− {{ item.code }} <span>{{ item.name }}</span></div></div></div>
    <div class="lab-received-actions"><button type="button" @click="editOrder" class="lab-secondary-button">แก้ไขรายการส่งตรวจ</button><button type="button" @click="startProcess" class="lab-primary-button">เริ่มดำเนินการ</button></div>
  </section>
</div>'''

OPD_CARD_CSS = '''
/* Lab adapter for the shared EMR opd_card / pcard visual system. */
.lab-opd-card{margin-bottom:14px}.lab-opd-card .el-card__body{padding:16px}.lab-opd-card .pcard-main{min-width:0}.lab-opd-vitals{margin-left:auto}.lab-opd-vitals .pcard-vital b{display:block;min-height:20px}.lab-opd-card .pcard-alert-chip{margin-right:7px}@media(max-width:900px){.lab-opd-card .pcard-main{flex-wrap:wrap}.lab-opd-card .pcard-divider{display:none}.lab-opd-vitals{width:100%;margin-left:0;padding-top:10px;border-top:1px solid var(--el-border-color-lighter)}}@media(max-width:620px){.lab-opd-card .pcard-name{font-size:18px}.lab-opd-card .pcard-vitals{grid-template-columns:repeat(2,minmax(0,1fr))}}
'''


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


with open(PATH, encoding='utf-8') as source:
    form = json.load(source)

nodes = {node.get('options', {}).get('name'): node for node in walk(form) if isinstance(node, dict)}
received = nodes['lab_received_component']['options']
received['content'] = OPD_CARD_TEMPLATE
script = received['onCreated']

old_helpers = "s.selected=()=>s.rows.find(r=>String(r._id||r.id)===String(s.selectedId))||null;s.select=row=>{s.selectedId=String(row._id||row.id||'');const f=field.getFormRef();if(f)f.$labReceivedOrderId=s.selectedId};s.preselect=id=>{s.selectedId=String(id||'');const f=field.getFormRef();if(f)f.$labReceivedOrderId=s.selectedId};s.patientInitial=row=>{const v=String(row&&row.patient_name||row&&row.patient_hn||'?').trim();return v?v.charAt(0).toUpperCase():'?'};s.patientPhoto=row=>String(row&&row.patient_photo||row&&row.patient_image||row&&row.photo_url||row&&row.patient_pic||'');s.coverage=row=>String(row&& (row.treatment_right||row.insurance_right||row.inscl_code||row.inscl_name)||'').trim();s.payment=row=>String(row&&row.payment_status||'').trim();"
new_helpers = """s.tran=null;s.selected=()=>s.rows.find(r=>String(r._id||r.id)===String(s.selectedId))||null;s.patientInitial=row=>{const v=String(row&&row.patient_name||row&&row.patient_hn||'?').trim();return v?v.charAt(0).toUpperCase():'?'};s.patientPhoto=row=>String(row&&row.patient_photo||row&&row.patient_image||row&&row.photo_url||row&&row.patient_pic||'');s.rights=row=>{const raw=row&&(row.treatment_right||row.insurance_right||row.inscl_name||row.inscl_code||row.inscl_hos||[]);const list=Array.isArray(raw)?raw:[raw];return list.map(x=>typeof x==='object'?String(x.label||x.value||x.name||x.inscl_item_main&&x.inscl_item_main.value||''):String(x||'')).filter(Boolean)};s.allergies=row=>{const raw=row&&(row.allergy_tags||row.allergies||row.drug_allergy||[]);const list=Array.isArray(raw)?raw:String(raw||'').split(',');return list.map(x=>typeof x==='object'?String(x.name||x.label||x.value||''):String(x).trim()).filter(Boolean)};s.toTran=row=>{if(!row)return null;return {vid:{pid:{hn:String(row.patient_hn||''),p_full_name:String(row.patient_name||''),age:row.patient_age||row.age||'',p_gender:row.patient_gender||row.gender||'',p_abogroup:row.blood_group||row.abo_group||''}},vn:String(row.visit_vn||row.vn||''),labNo:String(row.lab_no||''),wardClinic:String(row.ward_clinic||''),orderedAt:row.ordered_at||row.created_at||row.order_datetime||'',receivedBy:String(row.received_by||''),specimen:s.specimen(row),itemCount:s.itemCount(row),rights:s.rights(row),payment:String(row.payment_status||''),allergies:s.allergies(row),photo:s.patientPhoto(row)}};s.syncTran=()=>{s.tran=s.toTran(s.selected())};s.select=row=>{s.selectedId=String(row._id||row.id||'');s.syncTran();const f=field.getFormRef();if(f)f.$labReceivedOrderId=s.selectedId};s.preselect=id=>{s.selectedId=String(id||'');s.syncTran();const f=field.getFormRef();if(f)f.$labReceivedOrderId=s.selectedId};s.pt=()=>s.tran&&s.tran.vid&&s.tran.vid.pid||{};s.ptName=()=>s.pt().p_full_name||'-';s.picUrl=()=>s.tran&&s.tran.photo||'';s.genderLabel=()=>{const v=String(s.pt().p_gender||'').toLowerCase();return v==='1'||v==='m'||v==='male'||v==='ชาย'?'ชาย':v==='2'||v==='f'||v==='female'||v==='หญิง'?'หญิง':String(s.pt().p_gender||'')};s.aboLabel=()=>String(s.pt().p_abogroup||'');"""
if old_helpers in script:
    script = script.replace(old_helpers, new_helpers)
elif 's.toTran=' not in script:
    raise AssertionError('could not find Lab received patient helper anchor')

# Synchronise the pcard when the async received-order query resolves.
selection_anchor = "else{s.selectedId=''};s.info='รับเข้าแล้ว '+s.rows.length+' ใบ'"
if selection_anchor in script:
    script = script.replace(selection_anchor, "else{s.selectedId=''};s.syncTran();s.info='รับเข้าแล้ว '+s.rows.length+' ใบ'", 1)
elif "s.syncTran();s.info='รับเข้าแล้ว '" not in script:
    raise AssertionError('could not find received selection callback')

# Leaving the received tab must return to the genuine empty pcard state.
leave_anchor = "if(s.__receivedLastTab==='tab-pane-lab-received'&&active!=='tab-pane-lab-received')s.selectedId='';s.__receivedLastTab=active"
if leave_anchor in script:
    script = script.replace(leave_anchor, "if(s.__receivedLastTab==='tab-pane-lab-received'&&active!=='tab-pane-lab-received'){s.selectedId='';s.syncTran()}s.__receivedLastTab=active")
elif 's.__receivedLastTab' not in script:
    raise AssertionError('could not find received-tab leave watcher')

received['onCreated'] = script

css = form['formConfig'].get('cssCode') or ''
marker = '/* Lab adapter for the shared EMR opd_card / pcard visual system. */'
if marker in css:
    css = css.split(marker, 1)[0]
form['formConfig']['cssCode'] = css + OPD_CARD_CSS

with open(PATH, 'w', encoding='utf-8') as target:
    json.dump(form, target, ensure_ascii=False, indent=2)
    target.write('\n')

print('Lab received tab now uses EMR opd_card template/state adapter')
