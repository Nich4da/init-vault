import json

PATH = 'Lab_Biochem_initCraft_import.json'

CUSTOM_VALUES = [
    {'fieldName': 'labNoLabel', 'expressions': "row.lab_no||'LAB NO. รอกำหนด'"},
    {'fieldName': 'patientInitial', 'expressions': "(function(){var s=String(row.patient_name||row.patient_hn||'?').trim();return s?s.charAt(0).toUpperCase():'?';})()"},
    {'fieldName': 'orderedDateLabel', 'expressions': "(function(){var v=row.ordered_at||row.requested_at||row.created_at;if(!v)return '-';var d=new Date(v);if(isNaN(d))return String(v);return d.toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit'});})()"},
    {'fieldName': 'orderedTimeLabel', 'expressions': "(function(){var v=row.ordered_at||row.requested_at||row.created_at;if(!v)return '';var d=new Date(v);if(isNaN(d))return '';return d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});})()"},
    {'fieldName': 'contextBadgesHtml', 'expressions': "(function(){function esc(v){return String(v==null?'':v).replace(/[&<>\\\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\\\"':'&quot;',\"'\":'&#39;'}[c]})}var ward=row.ward_clinic||'';var coverage=row.treatment_right||row.insurance_right||row.inscl_code||row.inscl_name||'';var payment=row.payment_status||'';var parts=[];if(ward&&ward!=='-')parts.push('<span class=\"lab-context-badge\">'+esc(ward)+'</span>');if(coverage&&coverage!=='-')parts.push('<span class=\"lab-benefit-badge\">'+esc(coverage)+'</span>');if(payment&&payment!=='-')parts.push('<span class=\"lab-benefit-badge\">'+esc(payment)+'</span>');return parts.join('')})()"},
    {'fieldName': 'specimenLabel', 'expressions': "(function(){var rows=[];try{rows=typeof row.specimen_records_json==='string'?JSON.parse(row.specimen_records_json||'[]'):(row.specimen_records_json||[])}catch(e){}if(!Array.isArray(rows)||!rows.length){try{var items=typeof row.selected_items_json==='string'?JSON.parse(row.selected_items_json||'[]'):(row.selected_items_json||[]);rows=(items||[]).map(function(i){return {label:i.specimen_name||(i.c_specimen&&i.c_specimen.label)||'',specimen_code:i.specimen_code||(i.c_specimen&&i.c_specimen.specimen_code)||''}})}catch(e){}}var seen={};return(rows||[]).map(function(x){var v=String(x.label||x.specimen_name||x.specimen_code||'ไม่ระบุ specimen');if(seen[v])return '';seen[v]=1;return v}).filter(Boolean).join(' · ')||'-'})()"},
    {'fieldName': 'orderCountLabel', 'expressions': "(function(){try{var x=typeof row.selected_items_json==='string'?JSON.parse(row.selected_items_json||'[]'):(row.selected_items_json||[]);return(Array.isArray(x)?x.length:0)+' รายการ'}catch(e){return(row.order_count||0)+' รายการ'}})()"},
    {'fieldName': 'statusBadgeHtml', 'expressions': "(function(){var s=String(row.central_specimen_status||row.order_status||'awaiting_check').toLowerCase();var m={awaiting_check:['รอตรวจ specimen','is-waiting'],checking:['กำลังตรวจ specimen','is-progress'],forwarded:['ส่งต่อห้อง Lab แล้ว','is-received'],waiting_receive:['รอรับ','is-waiting'],received:['รับเข้าแล้ว','is-received'],processing:['กำลังตรวจ','is-progress'],resulted:['ออกผลบางส่วน','is-partial'],completed:['ออกผลครบ','is-completed'],rejected:['ยกเลิก','is-cancelled']};var x=m[s]||[s||'-','is-default'];return '<span class=\"lab-status-pill '+x[1]+'\">'+x[0]+'</span>'})()"},
]

DETAIL = """<div class='lab-worklist-row'>
  <div class='lab-patient-avatar'><span>{{patientInitial}}</span></div>
  <div class='lab-patient-summary'>
    <div class='lab-lab-no'>{{labNoLabel}}</div>
    <div class='lab-hn'>{{patient_hn}}</div>
    <div class='lab-patient-name'>{{patient_name}}</div>
  </div>
  <div class='lab-context-badges'>{{contextBadgesHtml}}</div>
  <div class='lab-worklist-meta'>
    <div class='lab-worklist-cell'><label>เวลาส่ง</label><span>{{orderedDateLabel}}<br>{{orderedTimeLabel}}</span></div>
    <div class='lab-worklist-cell'><label>Specimen</label><span>{{specimenLabel}}</span></div>
    <div class='lab-worklist-cell lab-status-cell'><label>สถานะ</label>{{statusBadgeHtml}}</div>
    <div class='lab-worklist-cell lab-order-cell'><label>Order</label><b class='lab-order-pill'>{{orderCountLabel}}</b></div>
  </div>
</div>"""

ALL_DETAIL = DETAIL

CSS = """
/* Responsive Lab Workbench list rows — compact typography/tags aligned to EMR. */
.lab-worklist-row{box-sizing:border-box;display:grid;grid-template-columns:56px minmax(205px,.75fr) minmax(190px,.85fr) minmax(105px,.38fr) minmax(120px,.48fr) minmax(115px,.42fr) minmax(96px,.34fr);gap:14px;align-items:center;width:100%;min-width:0;padding:10px 168px 10px 8px;font-size:13px}
.lab-patient-avatar{width:52px;height:52px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#e6f0ff,#cfe2ff);color:#2768dd;font-weight:800;font-size:18px;overflow:hidden}
.lab-patient-summary,.lab-worklist-cell{min-width:0}.lab-lab-no{font-size:14px;font-weight:800;color:#1e293b;line-height:1.3}.lab-hn{margin-top:2px;color:#64748b;font-size:12px;font-weight:700;line-height:1.3}.lab-patient-name{margin-top:1px;color:#334155;font-size:13px;line-height:1.35;white-space:normal;overflow-wrap:anywhere}.lab-context-badges{display:flex;flex-wrap:wrap;align-content:center;gap:6px;min-width:0}.lab-worklist-meta{display:contents}.lab-worklist-cell{display:flex;align-self:stretch;min-height:46px;flex-direction:column;justify-content:flex-start;gap:4px;padding-top:8px;box-sizing:border-box}.lab-worklist-cell label{height:13px;color:#94a3b8;font-size:11px;font-weight:500;line-height:13px}.lab-worklist-cell span,.lab-worklist-cell b{color:#334155;font-size:13px;line-height:1.35;white-space:normal;overflow-wrap:anywhere}.lab-context-badge,.lab-benefit-badge{display:inline-block;padding:4px 8px;border-radius:4px!important;font-size:12px!important;font-weight:700!important;line-height:1.25;white-space:nowrap!important}.lab-context-badge{background:#edf6ff;color:#409eff!important;border:1px solid #cfe7ff}.lab-benefit-badge{background:#eff9e9;color:#67c23a!important;border:1px solid #d8f1ca}.lab-order-pill{display:inline-block;align-self:flex-start;padding:4px 8px!important;border:1px solid #cbd5e1!important;border-radius:4px!important;background:transparent!important;background-color:transparent!important;box-shadow:none!important;color:#64748b!important;font-size:12px!important;font-weight:700!important;line-height:1.25!important;white-space:nowrap}.lab-status-pill{display:inline-block;align-self:flex-start;padding:4px 8px;border-radius:4px!important;font-size:12px!important;font-weight:700;line-height:1.25;white-space:nowrap}.lab-status-pill.is-waiting{background:#f1f2f4;color:#6b7280!important}.lab-status-pill.is-received{background:#eeeafd;color:#6747de!important}.lab-status-pill.is-progress{background:#fff3d8;color:#e29a05!important}.lab-status-pill.is-partial{background:#fff0df;color:#ef7d1a!important}.lab-status-pill.is-completed{background:#e7f9eb;color:#16aa45!important}.lab-status-pill.is-cancelled{background:#fde8e7;color:#df3933!important}.lab-status-pill.is-default{background:#f1f2f4;color:#6b7280!important}
@media(max-width:1280px){.lab-worklist-row{grid-template-columns:56px minmax(175px,.75fr) minmax(170px,.85fr) minmax(100px,.38fr) minmax(105px,.48fr) minmax(108px,.42fr) minmax(88px,.34fr);padding-right:18px}.lab-worklist-meta{display:contents}.lab-worklist-cell{min-height:42px}}
@media(max-width:820px){.lab-worklist-row{grid-template-columns:50px minmax(0,1fr);gap:10px;padding:10px}.lab-patient-avatar{width:46px;height:46px;border-radius:12px;font-size:18px}.lab-lab-no{font-size:15px}.lab-context-badges{grid-column:1/-1;padding-left:56px}.lab-worklist-meta{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));padding-left:0;gap:8px 14px}.lab-worklist-cell{min-height:38px}.lab-worklist-cell label{font-size:11px}.lab-worklist-cell span,.lab-worklist-cell b{font-size:13px}}
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

ids = {'list-ui-lab-waiting', 'list-ui-lab-cancelled-final', 'list-ui-lab-all-orders'}
updated = []
for node in walk(form):
    if node.get('id') not in ids:
        continue
    options = node.setdefault('options', {})
    values = list(CUSTOM_VALUES)
    if node['id'] == 'list-ui-lab-all-orders':
        options['detailContent'] = ALL_DETAIL
    else:
        options['detailContent'] = DETAIL
    options['customValue'] = values
    updated.append(node['id'])

config = form.setdefault('formConfig', {})
existing_css = config.get('cssCode') or ''
marker = '/* Responsive Lab Workbench list rows'
tail = ''
if marker in existing_css:
    before, after = existing_css.split(marker, 1)
    # This form also carries the received-workspace and EMR pcard styles after
    # the list-row block. Replace only the list block; preserve those styles.
    next_marker = '/* Received tab: single-patient workspace, patterned after EMR */'
    tail = after[after.find(next_marker):] if next_marker in after else ''
    existing_css = before
config['cssCode'] = existing_css + CSS + tail

with open(PATH, 'w', encoding='utf-8') as target:
    json.dump(form, target, ensure_ascii=False, indent=2)
    target.write('\n')

print('updated:', ', '.join(updated))
