#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Convert the Bio dashboard import into a unit-aware Lab Workbench draft."""

import json
from copy import deepcopy
from pathlib import Path


PATH = Path('Lab_Biochem_initCraft_import.json')

# Mirrors the live Organization.unit_code -> Section Master mapping verified
# 2026-08-13.  The Organization selector remains the only selector in the UI.
CONTEXT = r'''const LAB_SECTION_BY_ROOM={
  '10':{section:'BC',name:'Biochemistry'},'20':{section:'HM',name:'Hematology'},
  '21':{section:'ML',name:'Clinical Microscopy Laboratory'},'22':{section:'HH',name:'Hematology-Homeostasis'},
  '30':{section:'IM',name:'Immunology'},'31':{section:'MI-OUT',name:'Immunology-ส่งนอกรพ.'},
  '40':{section:'MB',name:'Microbiology'},'41':{section:'MY',name:'Mycology'},
  '50':{section:'BB',name:'Blood Bank'},'70':{section:'BG',name:'Biomolecular and Genetics'}
};
s.labUnitRaw=()=>{const f=field.getFormRef&&field.getFormRef();const states=[field.globalUserState,f&&f.userState];for(let i=0;i<states.length;i++){const st=states[i]||{};const u=st.user||st;const raw=u.unit||u.currentUnit||u.xunitx||st.unit||st.currentUnit||st.xunitx;if(raw)return raw}return(typeof userInfo!=='undefined'&&userInfo&&userInfo.unit)||null};
s.labUnitCode=()=>{const raw=s.labUnitRaw();if(raw==null)return '';if(typeof raw==='string'||typeof raw==='number')return String(raw).trim();return String(raw.code||raw.unit_code||raw.value||raw.id||'').trim()};
s.currentLab=()=>{s.contextTick=s.contextTick||0;const room=s.labUnitCode();return LAB_SECTION_BY_ROOM[room]||{section:'',name:(typeof s.labUnitRaw()==='object'&&s.labUnitRaw()&&(s.labUnitRaw().name||s.labUnitRaw().unit_name))||'ห้องปฏิบัติการ Lab'}};
s.currentLabSection=()=>s.currentLab().section;
s.currentLabName=()=>s.currentLab().name;
'''


def walk(value, callback):
    if isinstance(value, dict):
        callback(value)
        for child in value.values(): walk(child, callback)
    elif isinstance(value, list):
        for child in value: walk(child, callback)


def find_by_id(model, node_id):
    found = []
    walk(model, lambda x: found.append(x) if x.get('id') == node_id else None)
    if len(found) != 1: raise RuntimeError(f'{node_id}: expected 1, got {len(found)}')
    return found[0]


def add_all_orders_tab(model):
    tab = find_by_id(model, 'tab-pane-lab-waiting')
    parent = None
    def locate(value):
        nonlocal parent
        if isinstance(value, dict):
            for key, child in value.items():
                if isinstance(child, list) and tab in child: parent = child
                locate(child)
        elif isinstance(value, list):
            for child in value: locate(child)
    locate(model)
    if parent is None: raise RuntimeError('Waiting tab parent not found')
    clone = deepcopy(tab)
    clone['id'] = 'tab-pane-lab-all-orders'
    clone['key'] = 81010
    clone['options'].update(name='lab_all_orders', label='รายการรวมทุก Lab', active=True)
    # The aggregate tab contains one plain ListView. It intentionally has no
    # room filter and shows only records currently available from this source.
    clone['fields'] = [deepcopy(find_by_id(model, 'list-ui-lab-waiting'))]
    list_ui = clone['fields'][0]
    list_ui['id'] = 'list-ui-lab-all-orders'
    opts = list_ui['options']
    opts.update(name='lab_all_orders_listview', label='รายการสั่ง Lab ทั้งหมด', titleName='รายการสั่ง Lab ทั้งหมด',
                where='', actionEnable=False, addBtnEnable=False, delBtnEnable=False, updateBtnEnable=False,
                buttonsRow=[])
    # Make it clear which Lab will own an order when LabCen becomes the source.
    opts['detailContent'] = opts['detailContent'].replace("<div style='display:flex;flex-direction:column;justify-content:flex-start;min-height:66px;line-height:1.35;min-width:0;'><div style='height:17px;font-size:11px;font-weight:700;color:var(--el-text-color-secondary);margin:0 0 6px;white-space:nowrap;'>Order</div>", "<div style='display:flex;flex-direction:column;justify-content:flex-start;min-height:66px;line-height:1.35;min-width:0;'><div style='height:17px;font-size:11px;font-weight:700;color:var(--el-text-color-secondary);margin:0 0 6px;white-space:nowrap;'>Lab / Section</div><b style='font-size:13px;color:var(--el-color-primary);'>{{labSectionLabel}}</b></div><div style='display:flex;flex-direction:column;justify-content:flex-start;min-height:66px;line-height:1.35;min-width:0;'><div style='height:17px;font-size:11px;font-weight:700;color:var(--el-text-color-secondary);margin:0 0 6px;white-space:nowrap;'>Order</div>")
    opts['customValue'].append({'labelWidth': 150, 'align': 'left', 'fieldName': 'labSectionLabel', 'expressions': "row.lab_section||'-'"})
    parent.insert(parent.index(tab), clone)


def genericize_vue_scripts(model):
    for node_id, load_name in [('vue-ui-lab-waiting-orders', 'loadWaitingOrders'),
                               ('vue-ui-lab-received', 'load'), ('vue-ui-lab-resulted', 'load')]:
        node = find_by_id(model, node_id)
        script = node['options']['onCreated']
        script = script.replace('const s=this.vueState;const field=this;', 'const s=this.vueState;const field=this;' + CONTEXT)
        script = script.replace("const isBio=r.lab_section==='BC'||(!r.lab_section&&!!r.selected_items_json);", "const activeLab=s.currentLabSection();const isBio=!!activeLab&&String(r.lab_section||'')===activeLab;")
        # Make each queue re-read selected Organization unit. The global App
        # selector updates its store; this watcher refreshes only on a change.
        watcher = f";s.__labLastSection='';s.watchLabContext=()=>{{const next=s.currentLabSection();if(next&&next!==s.__labLastSection){{s.__labLastSection=next;s.{load_name}()}}}};s.watchLabContext();s.__labContextTimer=setInterval(()=>{{s.contextTick=(s.contextTick||0)+1;s.watchLabContext()}},900);"
        script += watcher
        node['options']['onCreated'] = script


def genericize_titles(model):
    create = find_by_id(model, 'vue-ui-create-biochemistry-order')
    opts = create['options']
    opts['content'] = '''<div class="bio-create-bar"><div><div class="bio-create-title">รายการตรวจ {{ currentLabName() }}</div><div class="bio-create-sub">คิวและรายการตรวจของห้องปฏิบัติการที่เลือกจาก Organization</div></div><el-button type="primary" size="large" @click="createNewBioOrder">สร้างรายการใหม่</el-button></div>'''
    opts['onCreated'] = opts['onCreated'].replace('const s=this.vueState;const field=this;', 'const s=this.vueState;const field=this;' + CONTEXT)
    opts['onCreated'] += ";s.contextTick=0;s.__labTitleTimer=setInterval(()=>{s.contextTick++},900);"
    # This is not yet a generic order creator; it remains a Bio test/order
    # helper until LabCen becomes the shared source.
    opts['label'] = 'Create Lab Order'


def filter_listviews(model):
    waiting = find_by_id(model, 'list-ui-lab-waiting')
    cancelled = find_by_id(model, 'list-ui-lab-cancelled-final')
    # ListView needs its initial filter too. The Vue waiting context watcher
    # refreshes it when the selected Organization changes at runtime.
    waiting['options']['where'] = "lab_section = 'BC' AND order_status = 'waiting_receive'"
    cancelled['options']['where'] = "lab_section = 'BC' AND order_status = 'rejected'"


def add_list_sync(model):
    waiting = find_by_id(model, 'vue-ui-lab-waiting-orders')
    script = waiting['options']['onCreated']
    old = "s.watchLabContext=()=>{const next=s.currentLabSection();if(next&&next!==s.__labLastSection){s.__labLastSection=next;s.loadWaitingOrders()}}"
    new = "s.watchLabContext=()=>{const next=s.currentLabSection();if(!next)return;const form=field.getFormRef();[['lab_waiting_listview',\"lab_section = '\"+next+\"' AND order_status = 'waiting_receive'\"],['lab_cancelled_listview_final',\"lab_section = '\"+next+\"' AND order_status = 'rejected'\"]].forEach(pair=>{const ref=form&&form.getFieldRef&&form.getFieldRef(pair[0]);const ed=ref&&ref.getFieldEditor&&ref.getFieldEditor();const prev=ed&&ed.dpFormData&&ed.dpFormData.options&&ed.dpFormData.options.where;if(ref&&typeof ref.setFieldOption==='function')ref.setFieldOption('where',pair[1]);if(ed&&prev!==pair[1]){ed.dpFormData.options=ed.dpFormData.options||{};ed.defaultWhere=pair[1];ed.dpFormData.options.where=pair[1];if(ed.handleRefresh)ed.handleRefresh()}});if(next!==s.__labLastSection){s.__labLastSection=next;s.loadWaitingOrders()}}"
    if old not in script: raise RuntimeError('waiting watcher not found')
    waiting['options']['onCreated'] = script.replace(old, new)


def main():
    model = json.loads(PATH.read_text())
    add_all_orders_tab(model)
    genericize_vue_scripts(model)
    genericize_titles(model)
    filter_listviews(model)
    add_list_sync(model)
    PATH.write_text(json.dumps(model, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
