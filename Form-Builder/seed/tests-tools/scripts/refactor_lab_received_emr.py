import json

PATH = 'Lab_Biochem_initCraft_import.json'

RECEIVED_TEMPLATE = """<div class='lab-screen lab-received-workspace'>
  <div class='lab-received-toolbar'>
    <span class='lab-muted'>{{ info || 'เลือกผู้ป่วยจาก รอรับ เพื่อเปิดใบสั่งตรวจ' }}</span>
    <button class='lab-button' type='button' @click='load'>โหลดใหม่</button>
  </div>
  <div v-if='selected()' class='lab-received-detail'>
    <section class='lab-patient-card'>
      <div class='lab-patient-photo' :style="patientPhoto(selected())?{backgroundImage:'url('+patientPhoto(selected())+')'}:{}"><span v-if='!patientPhoto(selected())'>{{ patientInitial(selected()) }}</span></div>
      <div class='lab-patient-card-main'>
        <div class='lab-patient-card-name'>{{ selected().patient_name || '-' }}</div>
        <div class='lab-patient-card-hn'>HN{{ selected().patient_hn || '-' }}</div>
        <div class='lab-patient-card-meta'><span class='lab-card-blue'>{{ selected().ward_clinic || '-' }}</span><span v-if='coverage(selected())' class='lab-card-green'>{{ coverage(selected()) }}</span><span v-if='payment(selected())' class='lab-card-green'>{{ payment(selected()) }}</span></div>
        <div class='lab-patient-card-sub'>LAB NO. {{ selected().lab_no || 'รอกำหนด' }} · {{ specimen(selected()) }} · รับเข้า {{ time(selected().received_at) }}</div>
      </div>
      <div class='lab-patient-card-info'><label>ผู้รับเข้า</label><b>{{ selected().received_by || '-' }}</b></div>
      <div class='lab-patient-card-info'><label>Specimen</label><b>{{ specimen(selected()) }}</b></div>
      <div class='lab-patient-card-info'><label>สถานะ</label><span class='lab-status-pill is-received'>รับเข้าแล้ว</span></div>
      <div class='lab-patient-card-count'>{{ itemCount(selected()) }} รายการ</div>
    </section>
    <section class='lab-received-order-card'>
      <div class='lab-received-order-head'><div><h2>List Order</h2><p>รายการตรวจของผู้ป่วยที่เลือก</p></div></div>
      <div class='lab-table-wrap'><table class='lab-table lab-received-table'><thead><tr><th>รหัส</th><th>รายการตรวจ</th><th style='text-align:right'>ราคา</th><th>สถานะ</th></tr></thead><tbody><tr v-for='item in items(selected())' :key='item.id||item.master_id||item.code'><td><b>{{ item.code || '-' }}</b></td><td>{{ item.name || '-' }}</td><td style='text-align:right'>{{ money(item.effective_price!=null?item.effective_price:item.sale_price) }}</td><td><span class='lab-status-pill is-waiting'>รอตรวจ</span></td></tr></tbody></table></div>
      <div v-if='history(selected()).length' class='lab-received-history'><div class='lab-history-head'><h3>ประวัติการแก้ไขรายการส่งตรวจ</h3><select :value='historyFilter' @change='setHistoryFilter($event.target.value)'><option value='all'>ทั้งหมด</option><option value='added'>รายการที่เพิ่ม</option><option value='removed'>รายการที่ลด</option></select></div><div v-for='(entry,index) in filteredHistory(selected())' :key='entry.changed_at||index' class='lab-history-entry'><div class='lab-history-time'>{{ historyTime(entry.changed_at) }}<span v-if='entry.changed_by'> · {{ entry.changed_by }}</span></div><div v-if="historyFilter==='all'||historyFilter==='added'" v-for='item in (entry.added||[])' :key="'add-'+item.code" class='lab-history-add'>＋ {{ item.code }} <span>{{ item.name }}</span></div><div v-if="historyFilter==='all'||historyFilter==='removed'" v-for='item in (entry.removed||[])' :key="'remove-'+item.code" class='lab-history-remove'>− {{ item.code }} <span>{{ item.name }}</span></div></div></div>
      <div class='lab-received-actions'><button type='button' @click='editOrder' class='lab-secondary-button'>แก้ไขรายการส่งตรวจ</button><button type='button' @click='startProcess' class='lab-primary-button'>เริ่มดำเนินการ</button></div>
    </section>
  </div>
  <div v-else class='lab-detail-empty'><div><b>ยังไม่ได้เลือกผู้ป่วย</b><br/><span>เลือกรายการจากแท็บ รอรับ แล้วกดรับสิ่งส่งตรวจ</span></div></div>
</div>"""

RECEIVED_CSS = """
/* Received tab: single-patient workspace, patterned after EMR */
.lab-received-toolbar{display:flex;justify-content:flex-end;align-items:center;gap:12px;margin-bottom:14px}.lab-received-toolbar .lab-muted{margin-right:auto}.lab-received-detail{display:flex;flex-direction:column;gap:14px}.lab-patient-card{display:grid;grid-template-columns:76px minmax(260px,1.4fr) minmax(105px,.45fr) minmax(120px,.55fr) minmax(100px,.42fr) max-content;gap:14px;align-items:center;padding:16px;border:1px solid #cfe2ff;border-radius:12px;background:linear-gradient(100deg,#edf6ff,#f8fbff)}.lab-patient-photo{width:72px;height:72px;border-radius:14px;background:#dbeafe center/cover no-repeat;color:#2563eb;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;overflow:hidden}.lab-patient-card-main{min-width:0}.lab-patient-card-name{font-size:20px;font-weight:800;color:#1e293b;line-height:1.25}.lab-patient-card-hn{display:inline-block;margin-top:5px;color:#3b82f6;font-size:14px;font-weight:800}.lab-patient-card-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}.lab-card-blue,.lab-card-green{display:inline-block;padding:4px 8px;border-radius:7px;font-size:12px;font-weight:700}.lab-card-blue{color:#409eff;background:#edf6ff;border:1px solid #cfe7ff}.lab-card-green{color:#67c23a;background:#eff9e9;border:1px solid #d8f1ca}.lab-patient-card-sub{margin-top:7px;color:#64748b;font-size:12px;line-height:1.4}.lab-patient-card-info{display:flex;flex-direction:column;gap:4px;min-width:0}.lab-patient-card-info label{color:#94a3b8;font-size:11px}.lab-patient-card-info b{color:#334155;font-size:13px;word-break:break-word}.lab-patient-card-count{align-self:start;padding:7px 12px;border-radius:999px;background:#eff6ff;color:#2563eb;font-size:13px;font-weight:800;white-space:nowrap}.lab-received-order-card{overflow:hidden;border:1px solid #e5e7eb;border-radius:12px;background:#fff}.lab-received-order-head{padding:15px 16px;border-bottom:1px solid #e5e7eb}.lab-received-order-head h2{margin:0;color:#111827;font-size:18px}.lab-received-order-head p{margin:4px 0 0;color:#94a3b8;font-size:12px}.lab-received-table{width:calc(100% - 32px);margin:0 16px 16px}.lab-received-history{padding:0 16px 16px}.lab-history-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:4px 0 9px}.lab-history-head h3{margin:0;font-size:15px}.lab-history-head select{height:30px;padding:0 28px 0 9px;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#374151;font-size:12px}.lab-history-entry{margin-bottom:10px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}.lab-history-time{padding:8px 12px;color:#374151;font-size:12px;font-weight:700}.lab-history-add,.lab-history-remove{padding:8px 12px;font-weight:700}.lab-history-add{background:#ecfdf5;color:#166534}.lab-history-remove{background:#fef2f2;color:#dc2626}.lab-history-add span,.lab-history-remove span{font-weight:500}.lab-received-actions{display:flex;justify-content:flex-end;gap:10px;padding:14px 16px;border-top:1px solid #e5e7eb}.lab-primary-button,.lab-secondary-button{height:38px;padding:0 14px;border-radius:7px;font-weight:700;cursor:pointer}.lab-primary-button{border:1px solid #2563eb;background:#2563eb;color:#fff}.lab-secondary-button{border:1px solid #d1d5db;background:#fff;color:#374151}@media(max-width:1000px){.lab-patient-card{grid-template-columns:72px minmax(0,1fr) max-content}.lab-patient-card-info{grid-column:auto}.lab-patient-card-count{grid-column:3;grid-row:1}}@media(max-width:680px){.lab-patient-card{grid-template-columns:60px minmax(0,1fr);padding:12px;gap:10px}.lab-patient-photo{width:56px;height:56px;border-radius:12px;font-size:20px}.lab-patient-card-name{font-size:17px}.lab-patient-card-info{grid-column:1/-1;display:grid;grid-template-columns:110px 1fr;align-items:center}.lab-patient-card-count{grid-column:1/-1;grid-row:auto;justify-self:start}.lab-received-actions{flex-wrap:wrap}.lab-received-actions button{flex:1}}
"""


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
received['content'] = RECEIVED_TEMPLATE
script = received['onCreated']
watch_marker = ";s.__receivedLastTab='';s.watchReceivedTab="
if watch_marker in script:
    script = script.split(watch_marker, 1)[0]
script = script.replace("s.selected=()=>s.rows.find(r=>String(r._id||r.id)===String(s.selectedId))||null;s.select=row=>{s.selectedId=String(row._id||row.id||'')};", "s.selected=()=>s.rows.find(r=>String(r._id||r.id)===String(s.selectedId))||null;s.select=row=>{s.selectedId=String(row._id||row.id||'');const f=field.getFormRef();if(f)f.$labReceivedOrderId=s.selectedId};s.preselect=id=>{s.selectedId=String(id||'');const f=field.getFormRef();if(f)f.$labReceivedOrderId=s.selectedId};s.patientInitial=row=>{const v=String(row&&row.patient_name||row&&row.patient_hn||'?').trim();return v?v.charAt(0).toUpperCase():'?'};s.patientPhoto=row=>String(row&&row.patient_photo||row&&row.patient_image||row&&row.photo_url||row&&row.patient_pic||'');s.coverage=row=>String(row&& (row.treatment_right||row.insurance_right||row.inscl_code||row.inscl_name)||'').trim();s.payment=row=>String(row&&row.payment_status||'').trim();")
start = "const f=field.getFormRef();const wanted=String((f&&f.$labReceivedOrderId)"
end = ";s.info='รับเข้าแล้ว '+s.rows.length+' ใบ'"
first = script.find(start)
last = script.find(end, first)
if first < 0 or last < 0:
    raise AssertionError('received selection anchor not found')
last += len(end)
replacement = "const f=field.getFormRef();const wanted=String((f&&f.$labReceivedOrderId)||'');if(wanted&&s.rows.some(r=>String(r._id||r.id)===wanted)){s.selectedId=wanted;if(f)f.$labReceivedOrderId=''}else{s.selectedId=''};s.info='รับเข้าแล้ว '+s.rows.length+' ใบ'"
received['onCreated'] = script[:first] + replacement + script[last:]

# The received tab is an EMR-style transient workspace: once a user leaves it,
# do not retain the prior selected patient. It only opens a patient when the
# receive action explicitly passes one through $labReceivedOrderId.
received['onCreated'] += ";s.__receivedLastTab='';s.watchReceivedTab=()=>{const f=field.getFormRef();const tabs=f&&f.getFieldRef&&f.getFieldRef('lab_biochem_tabs');const active=tabs&&tabs.activeTabName||'';if(s.__receivedLastTab==='tab-pane-lab-received'&&active!=='tab-pane-lab-received')s.selectedId='';s.__receivedLastTab=active};s.__receivedTabTimer=setInterval(s.watchReceivedTab,350)"

waiting = nodes['lab_waiting_orders']['options']
old_receive = "s.loadWaitingOrders();const received=field.refField('lab_received_component');if(received&&received.vueState&&typeof received.vueState.load==='function')received.vueState.load()"
new_receive = "s.loadWaitingOrders();const received=field.refField('lab_received_component');const host=form;if(host)host.$labReceivedOrderId=id;if(received&&received.vueState){if(typeof received.vueState.preselect==='function')received.vueState.preselect(id);if(typeof received.vueState.load==='function')received.vueState.load()}const tabs=host&&host.getFieldRef&&host.getFieldRef('lab_biochem_tabs');if(tabs)tabs.activeTabName='tab-pane-lab-received';setTimeout(()=>{const liveTabs=host&&host.getFieldRef&&host.getFieldRef('lab_biochem_tabs');if(liveTabs)liveTabs.activeTabName='tab-pane-lab-received'},0)"
if old_receive in waiting['onCreated']:
    waiting['onCreated'] = waiting['onCreated'].replace(old_receive, new_receive)
elif "tabs.activeTabName='tab-pane-lab-received'" in waiting['onCreated'] and 'setTimeout(()=>{const liveTabs' not in waiting['onCreated']:
    waiting['onCreated'] = waiting['onCreated'].replace("if(tabs)tabs.activeTabName='tab-pane-lab-received'", "if(tabs)tabs.activeTabName='tab-pane-lab-received';setTimeout(()=>{const liveTabs=host&&host.getFieldRef&&host.getFieldRef('lab_biochem_tabs');if(liveTabs)liveTabs.activeTabName='tab-pane-lab-received'},0)")
elif "tabs.activeTabName='tab-pane-lab-received'" in waiting['onCreated']:
    pass
else:
    raise AssertionError('receive action anchor not found')

css = form['formConfig'].get('cssCode') or ''
marker = '/* Received tab: single-patient workspace, patterned after EMR */'
if marker in css:
    css = css.split(marker, 1)[0]
form['formConfig']['cssCode'] = css + RECEIVED_CSS

with open(PATH, 'w', encoding='utf-8') as target:
    json.dump(form, target, ensure_ascii=False, indent=2)
    target.write('\n')
print('received tab rebuilt; receive action wired')
