#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Turn the legacy Bio 'resulted' pane into an in-process manual-entry pane."""

import json
from pathlib import Path


SOURCE = Path('Lab_Biochem_initCraft_import.json')
OUTPUT = Path('Lab_Biochem_initCraft_import.json')

CONTENT = '''<div class="lab-screen"><div style="display:grid;grid-template-columns:minmax(280px,460px) minmax(0,1fr) max-content;align-items:center;gap:10px;margin-bottom:16px"><div class="lab-search-wrap"><input class="lab-search" :value="search" @input="setSearch($event.target.value)" placeholder="ค้นหาผู้ป่วยที่กำลังดำเนินการ" /></div><span class="lab-muted">{{ info || 'เลือกผู้ป่วยเพื่อกรอกผล Manual' }}</span><button class="lab-button" type="button" @click="load">โหลดใหม่</button></div><div style="display:grid;grid-template-columns:360px minmax(0,1fr);gap:14px;min-height:590px"><div style="border:1px solid #e5e7eb;border-radius:8px;background:#fff;overflow:hidden"><div style="padding:15px 16px;border-bottom:1px solid #e5e7eb"><h2 style="margin:0;font-size:16px">ผู้ป่วยกำลังดำเนินการ</h2><p style="margin:3px 0 0;color:#6b7280;font-size:12px">กำลังดำเนินการ {{ filtered().length }} ราย</p></div><button v-for="row in filtered()" :key="row._id" type="button" @click="select(row)" style="display:grid;width:100%;grid-template-columns:1fr;gap:3px;padding:13px 16px;border:0;border-bottom:1px solid #e5e7eb;color:#111827;text-align:left;cursor:pointer" :style="{background:String(selectedId)===String(row._id||row.id)?'#fffbeb':'#fff',boxShadow:String(selectedId)===String(row._id||row.id)?'inset 3px 0 #d97706':'none'}"><b style="font-size:14px">{{ row.patient_hn || '-' }}</b><span style="color:#374151">{{ row.patient_name || '-' }}</span><small style="color:#6b7280">{{ specimen(row) }} · เริ่ม {{ time(row.result_started_at) }}</small></button><div v-if="filtered().length===0" class="lab-empty"><strong>ไม่พบผู้ป่วย</strong><br/>รายการจะแสดงหลังเริ่มดำเนินการ</div></div><div v-if="selected()" style="border:1px solid #e5e7eb;border-radius:8px;background:#fff;overflow:hidden"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid #e5e7eb"><div><h2 style="margin:0;font-size:16px">{{ selected().patient_hn || '-' }} — {{ selected().patient_name || '-' }}</h2><p style="margin:3px 0 0;color:#6b7280;font-size:12px">LAB NO. {{ selected().lab_no || 'รอกำหนด' }} · {{ specimen(selected()) }} · เริ่ม {{ time(selected().result_started_at) }}</p></div><span style="display:inline-block;padding:5px 12px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700">กำลังดำเนินการ</span></div><div style="padding:12px 16px;background:#fffbeb;border-bottom:1px solid #fde68a;color:#92400e;font-size:12px">กรอกค่าผล Manual เพื่อเตรียมลงผล — ค่านี้เป็นข้อมูลชั่วคราวในหน้าจอ จนกว่าจะเชื่อม Result Item และขั้นตอนบันทึก/ยืนยันผล</div><h3 style="margin:16px 16px 9px;font-size:14px">List Order</h3><div class="lab-table-wrap"><table class="lab-table" style="width:calc(100% - 32px);margin:0 16px 16px;min-width:900px"><thead><tr><th>รหัส</th><th>รายการตรวจ</th><th style="text-align:right">ราคา</th><th>ค่าผล Manual</th><th>สถานะ</th></tr></thead><tbody><tr v-for="item in items(selected())" :key="item.id||item.master_id||item.code"><td><b>{{ item.code || '-' }}</b></td><td>{{ item.name || '-' }}</td><td style="text-align:right">{{ money(item.effective_price!=null?item.effective_price:item.sale_price) }}</td><td><el-input size="small" :model-value="manualValue(selected(),item)" @input="setManualValue(selected(),item,$event)" placeholder="กรอกผล" clearable /></td><td><span style="display:inline-block;padding:3px 8px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700">กำลังดำเนินการ</span></td></tr></tbody></table></div></div><div v-else class="lab-detail-empty"><div><b>List Order</b><br/><span>เลือกผู้ป่วยจากรายการด้านซ้ายเพื่อกรอกผล Manual</span></div></div></div></div>'''

ON_CREATED = '''const s=this.vueState;const field=this;const PROVIDER={providerId:'6a771f20cc7d0a8451130339',providerType:'FORM',params:{},options:{}};s.rows=[];s.search='';s.info='';s.selectedId='';s.manualValues={};s.extract=out=>{const p=[out,out&&out.data,out&&out.rows,out&&out.data&&out.data.data,out&&out.reply&&out.reply.data];for(let i=0;i<p.length;i++){if(Array.isArray(p[i]))return p[i]}return []};s.safeJson=v=>{try{return typeof v==='string'?JSON.parse(v||'{}'):(v||{})}catch(e){return {}}};s.items=row=>{const x=s.safeJson(row&&row.selected_items_json);return Array.isArray(x)?x:[]};s.specimen=row=>{const x=s.safeJson(row&&row.biochemistry_specimen_json);const m={clotted:'Clotted blood',ionized_calcium:'Ionized Calcium',lithium_heparin:'Lithium heparin',naf:'NaF',edta:'EDTA',urine_spot:'Urine spot',urine_24hr:'Urine 24 hr.',csf:'CSF',body_fluid:'Body Fluid'};return m[x.bloodType]||m[x.urineType]||m[x.type]||'-'};s.time=v=>{if(!v)return '-';try{return new Date(v).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'})}catch(e){return String(v)}};s.money=v=>Number(v||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});s.setSearch=v=>{s.search=v||''};s.filtered=()=>{const q=s.search.trim().toLowerCase();return !q?s.rows:s.rows.filter(r=>[r.patient_hn,r.patient_name,r.ward_clinic,r.lab_no].join(' ').toLowerCase().includes(q))};s.selected=()=>s.rows.find(r=>String(r._id||r.id)===String(s.selectedId))||null;s.select=row=>{s.selectedId=String(row._id||row.id||'')};s.manualKey=(row,item)=>String(row&&row._id||row&&row.id||'')+'|'+String(item&&item.master_id||item&&item.id||item&&item.code||'');s.manualValue=(row,item)=>s.manualValues[s.manualKey(row,item)]||'';s.setManualValue=(row,item,value)=>{const key=s.manualKey(row,item);s.manualValues={...s.manualValues,[key]:String(value==null?'':value)}};s.load=()=>{try{s.info='กำลังโหลด...';const api=field.globalUserState||((field.getFormRef&&field.getFormRef())||{}).userState;if(!api||typeof api.crudGetAll!=='function')throw Error('ไม่พบ API connector ของฟอร์ม');api.crudGetAll({sdProvider:PROVIDER,totalEnable:true},out=>{const all=s.extract(out);s.rows=all.filter(r=>{const status=String(r.order_status||'');const isBio=r.lab_section==='BC'||(!r.lab_section&&!!r.selected_items_json);return isBio&&status==='processing'});if(!s.selectedId||!s.rows.some(r=>String(r._id||r.id)===String(s.selectedId)))s.selectedId=s.rows[0]?String(s.rows[0]._id||s.rows[0].id):'';s.info='กำลังดำเนินการ '+s.rows.length+' ใบ'},e=>{throw e||Error('อ่านข้อมูลไม่สำเร็จ')})}catch(e){s.info='โหลดไม่สำเร็จ';field.notify('โหลดรายการกำลังดำเนินการไม่สำเร็จ','error',4000)}};s.load();'''

# The tab continues to be the existing "ออกผลแล้ว" view.  This revision only
# changes the per-test display and adds temporary Manual-result/unit controls.
CONTENT = (CONTENT
    .replace('ค้นหาผู้ป่วยที่กำลังดำเนินการ', 'ค้นหาผู้ป่วยที่ออกผลแล้ว')
    .replace('ผู้ป่วยกำลังดำเนินการ', 'ผู้ป่วยออกผลแล้ว')
    .replace('กำลังดำเนินการ {{ filtered().length }} ราย', 'ออกผลแล้ว {{ filtered().length }} ราย')
    .replace(' · เริ่ม {{ time(row.result_started_at) }}', ' · ออกผล {{ time(row.received_at) }}')
    .replace(' · เริ่ม {{ time(selected().result_started_at) }}', ' · ออกผล {{ time(selected().received_at) }}')
    .replace('<th>ค่าผล Manual</th><th>สถานะ</th>', '<th>ค่าผล Manual</th><th>หน่วย</th><th>สถานะ</th>')
    .replace('placeholder="กรอกผล" clearable /></td><td><span', 'placeholder="กรอกผล" clearable /></td><td><el-select size="small" :model-value="unitValue(selected(),item)" @change="setUnitValue(selected(),item,$event)" placeholder="เลือกหน่วย" clearable><el-option v-for="unit in unitOptions" :key="unit" :label="unit" :value="unit" /></el-select></td><td><span')
)
ON_CREATED = (ON_CREATED
    .replace("s.manualValues={};", "s.manualValues={};s.unitValues={};s.unitOptions=['mg/dL','mmol/L','U/L','g/dL','%','mEq/L'];")
    .replace("s.setManualValue=(row,item,value)=>{const key=s.manualKey(row,item);s.manualValues={...s.manualValues,[key]:String(value==null?'':value)}};", "s.setManualValue=(row,item,value)=>{const key=s.manualKey(row,item);s.manualValues={...s.manualValues,[key]:String(value==null?'':value)}};s.unitValue=(row,item)=>s.unitValues[s.manualKey(row,item)]||'';s.setUnitValue=(row,item,value)=>{const key=s.manualKey(row,item);s.unitValues={...s.unitValues,[key]:value||''}};")
    .replace("status==='processing'", "status==='resulted'")
    .replace("s.info='กำลังดำเนินการ '+s.rows.length+' ใบ'", "s.info='ออกผลแล้ว '+s.rows.length+' ใบ'")
    .replace("โหลดรายการกำลังดำเนินการไม่สำเร็จ", "โหลดรายการออกผลแล้วไม่สำเร็จ")
)


def walk(value):
    if isinstance(value, dict):
        if value.get('id') == 'vue-ui-lab-resulted':
            options = value['options']
            options['content'] = CONTENT
            options['onCreated'] = ON_CREATED
        for child in value.values():
            walk(child)
    elif isinstance(value, list):
        for child in value:
            walk(child)


def main():
    form = json.loads(SOURCE.read_text())
    walk(form)
    panes = []
    def find_panes(value):
        if isinstance(value, dict):
            if value.get('id') == 'tab-pane-lab-resulted': panes.append(value)
            for child in value.values(): find_panes(child)
        elif isinstance(value, list):
            for child in value: find_panes(child)
    find_panes(form)
    if len(panes) != 1:
        raise RuntimeError('Expected exactly one legacy resulted tab')
    panes[0]['options']['name'] = 'lab_resulted'
    panes[0]['options']['label'] = 'ออกผลแล้ว'
    OUTPUT.write_text(json.dumps(form, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
