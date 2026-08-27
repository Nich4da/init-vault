import json

SOURCE = 'Lab_Biochem_initCraft_import.json'
TARGET = 'Lab_Center_Specimen_Hub_WIDGETS_V2.json'
CENTER_FORM_ID = '6a75a7810796231c653df996'


def values():
    return [
        {'fieldName': 'labNoLabel', 'expressions': "row.lab_no||'LAB NO. รอกำหนด'"},
        {'fieldName': 'patientInitial', 'expressions': "(function(){var s=String(row.patient_name||row.patient_hn||'?').trim();return s?s.charAt(0).toUpperCase():'?';})()"},
        {'fieldName': 'patientNameLabel', 'expressions': "row.patient_name||'-'"},
        {'fieldName': 'patientHnLabel', 'expressions': "row.patient_hn||'-'"},
        {'fieldName': 'wardLabel', 'expressions': "row.ward_clinic||'-'"},
        {'fieldName': 'forwardedByLabel', 'expressions': "row.central_forwarded_by||'-'"},
        {'fieldName': 'specimenManifest', 'expressions': "(function(){var raw=row.specimen_records_json,rows=[];try{rows=typeof raw==='string'?JSON.parse(raw||'[]'):(raw||[])}catch(e){}if(!Array.isArray(rows)||!rows.length){try{var items=typeof row.selected_items_json==='string'?JSON.parse(row.selected_items_json||'[]'):(row.selected_items_json||[]);rows=(items||[]).map(function(i){return {specimen_code:i.specimen_code||(i.c_specimen&&i.c_specimen.specimen_code)||'',label:i.specimen_name||(i.c_specimen&&i.c_specimen.label)||'ไม่ระบุ specimen'}})}catch(e){}}var seen={};return rows.map(function(x){var v=String(x.label||x.specimen_name||x.specimen_code||'ไม่ระบุ specimen');if(seen[v])return '';seen[v]=1;return v}).filter(Boolean).join(' · ')||'-'})()"},
        {'fieldName': 'specimenCountLabel', 'expressions': "(function(){var raw=row.specimen_records_json,rows=[];try{rows=typeof raw==='string'?JSON.parse(raw||'[]'):(raw||[])}catch(e){}if(Array.isArray(rows)&&rows.length)return rows.length+' ประเภท';try{var i=typeof row.selected_items_json==='string'?JSON.parse(row.selected_items_json||'[]'):(row.selected_items_json||[]);var set={};(i||[]).forEach(function(x){set[String(x.specimen_code||(x.c_specimen&&x.c_specimen.specimen_code)||'unspecified')]=1});return Object.keys(set).length+' ประเภท'}catch(e){return '-' }})()"},
        {'fieldName': 'orderCountLabel', 'expressions': "(function(){try{var x=typeof row.selected_items_json==='string'?JSON.parse(row.selected_items_json||'[]'):(row.selected_items_json||[]);return(Array.isArray(x)?x.length:0)+' รายการ'}catch(e){return'-'}})()"},
        {'fieldName': 'orderedAtLabel', 'expressions': "(function(){var v=row.created_at||row.ordered_at||row.createdAt;if(!v)return '-';try{return new Date(v).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'})}catch(e){return String(v)}})()"},
        {'fieldName': 'checkedByLabel', 'expressions': "row.central_checked_by||'-'"},
        {'fieldName': 'forwardedAtLabel', 'expressions': "(function(){var v=row.central_forwarded_at;if(!v)return '-';try{return new Date(v).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'})}catch(e){return String(v)}})()"},
    ]


DETAIL_QUEUE = '''<div class="lch-list-row"><div class="lch-avatar">{{patientInitial}}</div><div class="lch-patient"><b>{{patientNameLabel}}</b><span>HN{{patientHnLabel}} · {{labNoLabel}}</span><small>{{wardLabel}} · {{orderedAtLabel}}</small></div><div class="lch-cell"><label>Specimen</label><span>{{specimenManifest}}</span></div><div class="lch-cell"><label>Order</label><span>{{orderCountLabel}}</span></div><span class="lch-status awaiting">รอตรวจ specimen</span></div>'''
DETAIL_CHECK = '''<div class="lch-list-row"><div class="lch-avatar">{{patientInitial}}</div><div class="lch-patient"><b>{{patientNameLabel}}</b><span>HN{{patientHnLabel}} · {{labNoLabel}}</span><small>ผู้ตรวจ: {{checkedByLabel}}</small></div><div class="lch-cell"><label>Trick sheet / Specimen</label><span>{{specimenManifest}}</span></div><div class="lch-cell"><label>จำนวน</label><span>{{specimenCountLabel}}</span></div><span class="lch-status checking">กำลังตรวจ specimen</span></div>'''
DETAIL_FORWARDED = '''<div class="lch-list-row"><div class="lch-avatar">{{patientInitial}}</div><div class="lch-patient"><b>{{patientNameLabel}}</b><span>HN{{patientHnLabel}} · {{labNoLabel}}</span><small>ส่งต่อโดย {{forwardedByLabel}} · {{forwardedAtLabel}}</small></div><div class="lch-cell"><label>Specimen</label><span>{{specimenManifest}}</span></div><div class="lch-cell"><label>Order</label><span>{{orderCountLabel}}</span></div><span class="lch-status forwarded">ส่งต่อห้อง Lab แล้ว</span></div>'''


def action_set_checking():
    return """const host=this.getFormRef(),api=(host&&host.userState)||this.globalUserState,id=String(dataRow._id||dataRow.id||''),state=String(dataRow.central_specimen_status||'awaiting_check').toLowerCase(),go=()=>{const tabs=host&&host.getFieldRef&&host.getFieldRef('central_specimen_tabs');if(tabs)tabs.activeTabName='tab-pane-central-specimen-check'};if(state==='forwarded'){this.notify('รายการนี้ส่งต่อห้อง Lab แล้ว ดูได้ที่แท็บ ส่งต่อห้อง Lab แล้ว','info',3000);return}if(state==='checking'){go();return}if(!id||!api||typeof api.crudUpdate!=='function'){this.alert('ไม่พบ API connector สำหรับอัปเดตสถานะ','error');return}const user=(api.user||{}),actor=user.username||user.name||user.account||'',now=new Date().toISOString(),done=()=>{const q=host.getFieldRef('central_specimen_queue_list');const ce=q&&q.getFieldEditor&&q.getFieldEditor();if(ce&&ce.handleRefresh)ce.handleRefresh();const c=host.getFieldRef('central_specimen_check_list');const de=c&&c.getFieldEditor&&c.getFieldEditor();if(de&&de.handleRefresh)de.handleRefresh();go()};try{const out=api.crudUpdate({id:id,data:{central_specimen_status:'checking',central_checked_at:now,central_checked_by:actor},sdProvider:{providerId:'6a75a7810796231c653df996',providerType:'FORM',params:{},options:{}}});if(out&&typeof out.then==='function')out.then(()=>{this.notify('เปิดรายการตรวจ specimen แล้ว','success',2000);done()}).catch(e=>this.alert('อัปเดตสถานะไม่สำเร็จ: '+((e&&e.message)||''),'error'));else{this.notify('เปิดรายการตรวจ specimen แล้ว','success',2000);setTimeout(done,400)}}catch(e){this.alert('อัปเดตสถานะไม่สำเร็จ: '+((e&&e.message)||''),'error')}"""


def action_forward():
    return """const host=this.getFormRef(),api=(host&&host.userState)||this.globalUserState,id=String(dataRow._id||dataRow.id||'');if(!id||!api||typeof api.crudUpdate!=='function'){this.alert('ไม่พบ API connector สำหรับบันทึก','error');return}this.confirm('ยืนยันว่า specimen ครบและพร้อมส่งต่อให้ห้องปฏิบัติการ?','ส่งต่อห้อง Lab').then(ok=>{if(!ok)return;const user=(api.user||{}),actor=user.username||user.name||user.account||'',now=new Date().toISOString(),data={central_specimen_status:'forwarded',central_checked_at:dataRow.central_checked_at||now,central_checked_by:dataRow.central_checked_by||actor,central_forwarded_at:now,central_forwarded_by:actor},done=()=>{['central_specimen_check_list','central_specimen_forwarded_list'].forEach(n=>{const r=host.getFieldRef(n),e=r&&r.getFieldEditor&&r.getFieldEditor();if(e&&e.handleRefresh)e.handleRefresh()});const tabs=host.getFieldRef('central_specimen_tabs');if(tabs)tabs.activeTabName='tab-pane-central-specimen-forwarded'};try{const out=api.crudUpdate({id:id,data:data,sdProvider:{providerId:'6a75a7810796231c653df996',providerType:'FORM',params:{},options:{}}});if(out&&typeof out.then==='function')out.then(()=>{this.notify('ส่งต่อห้อง Lab แล้ว','success',2500);done()}).catch(e=>this.alert('ส่งต่อไม่สำเร็จ: '+((e&&e.message)||''),'error'));else{this.notify('ส่งต่อห้อง Lab แล้ว','success',2500);setTimeout(done,400)}}catch(e){this.alert('ส่งต่อไม่สำเร็จ: '+((e&&e.message)||''),'error')}})"""


def list_view(key, name, title, where, detail, buttons):
    return {
        'key': key, 'name': 'List View', 'component': 'list-ui', 'category': 'display_ui',
        'icon': 'list-view', 'fieldType': 'Array', 'fieldLength': None, 'children': False,
        'enable': True, 'formItemFlag': False, 'id': 'list-ui-' + name,
        'options': {
            'name': name, 'label': title, 'customClass': ['lch-listview'], 'columnSpan': 4,
            'hidden': False, 'formId': CENTER_FORM_ID, 'parentId': '', 'params': None,
            'titleEnable': True, 'titleName': title, 'where': where,
            'orderBy': [{'column': 'created_at', 'sort': 'DESC'}],
            'searchField': ['patient_hn', 'patient_name', 'lab_no', 'ward_clinic'], 'limitRow': 50,
            'actionEnable': bool(buttons), 'addBtnEnable': False, 'delBtnEnable': False,
            'viewBtnEnable': False, 'reloadBtnEnable': True, 'updateBtnEnable': False,
            'height': '620px', 'providerType': 'FORM', 'buttonsRow': buttons, 'reportList': None,
            'defaultFilterParent': False, 'parentPath': '_id', 'showWhenParent': False,
            'enableWs': True, 'listType': 'listview', 'iconWigth': 48, 'iconField': None,
            'titleContent': '', 'titleField': None, 'detailContent': detail, 'statusContent': '',
            'statusField': None, 'colorField': None, 'groupField': None, 'disableNoMore': False,
            'scrollDistance': 1, 'listColumn': 1, 'detailMaxRow': 3, 'totalEnable': True,
            'noMoreLabel': 'หมดรายการ', 'searchPlaceholder': 'ค้นหา HN, ชื่อผู้ป่วย, LAB NO. หรือ Ward / Clinic',
            'clickEvent': '', 'customValue': values(), 'onCreated': '', 'onMounted': '', 'onUnmount': ''
        }
    }


def pane(key, name, label, field):
    return {'key': key, 'name': 'Tab Pane', 'component': 'tab-pane', 'category': 'container', 'icon': 'tab-pane', 'fieldType': 'None', 'fieldLength': None, 'children': True, 'enable': True, 'formItemFlag': False, 'id': 'tab-pane-' + name, 'fields': [field], 'options': {'name': name, 'label': label, 'hidden': False, 'active': name == 'central-specimen-queue', 'disabled': False, 'customClass': ''}}


queue_btn = {'key': 92110, 'name': 'ตรวจ specimen', 'enable': True, 'confirm': False, 'customClass': 'lch-action-check', 'onClick': action_set_checking()}
forward_btn = {'key': 92210, 'name': 'Specimen ครบ — ส่งต่อห้อง Lab', 'enable': True, 'confirm': False, 'customClass': 'lch-action-forward', 'onClick': action_forward()}

tabs = {'key': 92000, 'name': 'Tab', 'component': 'tab', 'category': 'container', 'icon': 'tab', 'fieldType': 'None', 'fieldLength': None, 'children': False, 'enable': True, 'formItemFlag': False, 'id': 'tab-central-specimen-tabs', 'tabs': [
    pane(92010, 'central-specimen-queue', 'รายการรวมตรวจ specimen', list_view(92011, 'central_specimen_queue_list', 'รายการรวมตรวจ specimen', "", DETAIL_QUEUE, [queue_btn])),
    pane(92020, 'central-specimen-check', 'ตรวจ specimen', list_view(92021, 'central_specimen_check_list', 'ตรวจ specimen', "central_specimen_status = 'checking'", DETAIL_CHECK, [forward_btn])),
    pane(92030, 'central-specimen-forwarded', 'ส่งต่อห้อง Lab แล้ว', list_view(92031, 'central_specimen_forwarded_list', 'ส่งต่อห้อง Lab แล้ว', "central_specimen_status = 'forwarded'", DETAIL_FORWARDED, [])),
], 'options': {'name': 'central_specimen_tabs', 'label': 'ศูนย์ตรวจรับ Specimen', 'activeName': 'tab-pane-central-specimen-queue', 'tabPosition': 'top', 'type': 'card', 'stretch': False, 'columnSpan': 4, 'hidden': False, 'customClass': ''}}

CSS = '''.lch-listview .el-list-view-item{padding:0!important}.lch-list-row{display:grid;grid-template-columns:48px minmax(220px,1fr) minmax(180px,.85fr) minmax(90px,.28fr) max-content;gap:14px;align-items:center;width:100%;min-width:0;padding:12px 150px 12px 8px;font-size:13px;box-sizing:border-box}.lch-avatar{display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:8px;background:#e5f0ff;color:#337ee8;font-size:17px;font-weight:800}.lch-patient,.lch-cell{display:flex;min-width:0;flex-direction:column;gap:3px}.lch-patient b{font-size:14px;color:#1e293b}.lch-patient span{color:#64748b;font-size:12px;font-weight:600}.lch-patient small{color:#94a3b8;font-size:11px}.lch-cell label{height:13px;color:#94a3b8;font-size:11px;line-height:13px}.lch-cell span{color:#334155;font-size:12px;line-height:1.35;overflow-wrap:anywhere}.lch-status{display:inline-block;padding:4px 8px;border-radius:4px;font-size:12px;font-weight:700;white-space:nowrap}.lch-status.awaiting{background:#f1f2f4;color:#6b7280}.lch-status.checking{background:#fff3d8;color:#e29a05}.lch-status.forwarded{background:#e7f9eb;color:#16aa45}.lch-listview .lch-action-check,.lch-listview .lch-action-check .el-button{background:#fff3d8!important;border-color:#f4c663!important;color:#c47b00!important}.lch-listview .lch-action-forward,.lch-listview .lch-action-forward .el-button{background:#e7f9eb!important;border-color:#9bdfad!important;color:#16833b!important}@media(max-width:1000px){.lch-list-row{grid-template-columns:48px minmax(0,1fr) minmax(150px,.7fr) max-content;padding-right:16px}.lch-list-row .lch-cell:nth-of-type(2){display:none}}@media(max-width:680px){.lch-list-row{grid-template-columns:46px minmax(0,1fr);gap:10px;padding:10px}.lch-list-row .lch-cell,.lch-list-row .lch-status{grid-column:2}.lch-list-row .lch-cell:nth-of-type(2){display:flex}}'''

with open(SOURCE, encoding='utf-8') as source:
    base = json.load(source)

base['fields'] = [tabs]
cfg = base['formConfig']
cfg.update({'modelName': 'LabCenterSpecimenHubForm', 'refName': 'labCenterSpecimenHubFormRef', 'rulesName': 'labCenterSpecimenHubRules', 'labelPosition': 'top', 'labelWidth': 0, 'cssCode': CSS, 'onFormDataChange': ''})

with open(TARGET, 'w', encoding='utf-8') as target:
    json.dump(base, target, ensure_ascii=False, indent=2)
    target.write('\n')
print(TARGET)
