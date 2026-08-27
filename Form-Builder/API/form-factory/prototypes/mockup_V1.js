{
  "fields": [
    {
      "name": "Components",
      "component": "vue-ui",
      "category": "display_ui",
      "icon": "vue-ui",
      "fieldType": "None",
      "fieldLength": null,
      "children": false,
      "enable": true,
      "formItemFlag": false,
      "options": {
        "name": "create_biochemistry_order",
        "label": "Create Biochemistry Order",
        "columnSpan": 24,
        "hidden": false,
        "content": "<div class=\"bio-create-bar\"><div><div class=\"bio-create-title\">รายการตรวจ Biochemistry</div><div class=\"bio-create-sub\">เลือกผู้ป่วย ระบุสิ่งส่งตรวจ และเลือกรายการตรวจจากฟอร์มเดียวกัน</div></div><el-button type=\"primary\" size=\"large\" @click=\"createNewBioOrder\">สร้างรายการใหม่</el-button></div>",
        "customClass": "",
        "onCreated": "const s=this.vueState;const field=this;s.createNewBioOrder=()=>{const f=field.getFormRef();if(!f)return;f.openForm('6a771f20cc7d0a8451130339',null,null,{}, {params:{from:'lab-biochemistry-dashboard'},popupType:'dialog',backdrop:false,afterSaveCallback:()=>{const waiting=field.refField('lab_waiting_orders');if(waiting&&waiting.vueState&&waiting.vueState.loadWaitingOrders)waiting.vueState.loadWaitingOrders()}})};",
        "onMounted": "",
        "onUnmount": ""
      },
      "id": "vue-ui-create-biochemistry-order"
    },
    {
      "key": 81001,
      "name": "Tab",
      "component": "tab",
      "category": "container",
      "icon": "tab",
      "fieldType": "None",
      "fieldLength": null,
      "children": false,
      "enable": true,
      "formItemFlag": false,
      "tabs": [
        {
          "key": 81011,
          "name": "Tab Pane",
          "component": "tab-pane",
          "category": "container",
          "icon": "tab-pane",
          "fieldType": "None",
          "fieldLength": null,
          "children": true,
          "enable": true,
          "formItemFlag": false,
          "fields": [
            {
              "key": 81102,
              "name": "Components",
              "component": "vue-ui",
              "category": "display_ui",
              "icon": "components-ui",
              "fieldType": "None",
              "fieldLength": null,
              "children": false,
              "enable": true,
              "formItemFlag": false,
              "options": {
                "name": "lab_waiting_orders",
                "columnSpan": 4,
                "hidden": false,
                "label": "Components",
                "customClass": "",
                "content": "<div class=\"lab-screen\"><div class=\"lab-metrics\"><div class=\"lab-metric\"><div>รอรับทั้งหมด</div><b class=\"blue\">{{ waitingCount() }} <small>รายการ</small></b></div><div class=\"lab-metric\"><div>รายการตรวจ</div><b class=\"blue\">{{ waitingOrderCount() }} <small>รายการ</small></b></div><div class=\"lab-metric\"><div>สิ่งส่งตรวจหลายประเภท</div><b class=\"amber\">{{ waitingSpecimenCount() }} <small>ประเภท</small></b></div></div><div class=\"lab-toolbar lab-toolbar-result\"><div class=\"lab-search-wrap\"><input class=\"lab-search\" :value=\"bioLabWaitingSearch\" @input=\"setWaitingSearch($event.target.value)\" placeholder=\"ค้นหา HN, ชื่อผู้ป่วย หรือ Ward / Clinic\" /></div><span></span><span class=\"lab-spacer\"></span><button class=\"lab-button\" type=\"button\" @click=\"loadWaitingOrders\">โหลดใหม่</button></div><div class=\"lab-panel\"><div class=\"lab-panel-head\"><div><h2>ผู้ป่วยรอรับสิ่งส่งตรวจ</h2><p>รายการ Biochemistry ที่ส่งมาจากฟอร์มสั่ง Lab</p></div><span>{{ bioLabLoadInfo || (bioLabWaitingRows.length + ' รายการ') }}</span></div><div class=\"lab-table-wrap\"><table class=\"lab-table\"><thead><tr><th>HN / LAB NO.</th><th>ชื่อผู้ป่วย</th><th>Ward / Clinic</th><th>เวลาสั่ง</th><th>สิ่งส่งตรวจ</th><th>Specimen</th><th>สิทธิ์การรักษา</th><th>Order</th><th>การชำระเงิน</th><th>สถานะ</th></tr></thead><tbody><tr v-for=\"row in filteredWaitingOrders()\" :key=\"row._id\"><td><b>{{ row.patient_hn || '-' }}</b><br/><small>LAB NO. รอกำหนด</small></td><td>{{ row.patient_name || '-' }}</td><td>{{ row.ward_clinic || '-' }}</td><td>{{ formatWaitingTime(row.ordered_at || row.requested_at) }}</td><td>{{ waitingSpecimenLabel(row) }}</td><td>{{ waitingSpecimenTypeLabel(row) }}</td><td>{{ waitingCoverageLabel(row) }}</td><td><span class=\"lab-status-tag\">{{ waitingItemCount(row) }} รายการ</span></td><td>{{ waitingPaymentLabel(row) }}</td><td class=\"lab-action-cell\"><button type=\"button\" class=\"lab-link receive\" @click=\"receiveOrder(row)\">รับเข้า</button><span>·</span><button type=\"button\" class=\"lab-link reject\" @click=\"rejectOrder(row)\">ปฏิเสธ</button></td></tr><tr v-if=\"filteredWaitingOrders().length===0\"><td colspan=\"10\"><div class=\"lab-empty\"><strong>ไม่พบรายการรอรับ</strong><br/>ส่งรายการจากฟอร์มสั่ง Biochemistry แล้วกด “โหลดใหม่”</div></td></tr></tbody></table></div></div></div>",
                "onCreated": "const s=this.vueState;const field=this;const TARGET_PROVIDER={providerId:'6a771f20cc7d0a8451130339',providerType:'FORM',params:{},options:{}};const REJECTION_FORM_ID='6a7713fdcc7d0a8451130331';const REJECTION_PROVIDER={providerId:REJECTION_FORM_ID,providerType:'FORM',params:{},options:{}};const RECEIVE_PROCESS_ID='6a789afecc7d0a845113039e';s.bioLabWaitingRows=[];s.bioLabWaitingSearch='';s.bioLabLoadInfo='';s.extractRows=out=>{const picks=[out,out&&out.data,out&&out.rows,out&&out.data&&out.data.data,out&&out.data&&out.data.rows,out&&out.reply&&out.reply.data];for(let i=0;i<picks.length;i++){if(Array.isArray(picks[i]))return picks[i]}return []};s.setWaitingSearch=v=>{s.bioLabWaitingSearch=v||''};s.safeJson=v=>{try{return typeof v==='string'?JSON.parse(v||'{}'):(v||{})}catch(e){return {}}};s.waitingItems=row=>{const x=s.safeJson(row.selected_items_json);return Array.isArray(x)?x:[]};s.waitingItemCount=row=>s.waitingItems(row).length;s.waitingSpecimenLabel=row=>{const x=s.safeJson(row.biochemistry_specimen_json);const labels={clotted:'Clotted blood',ionized_calcium:'Ionized Calcium',lithium_heparin:'Lithium heparin',naf:'NaF',edta:'EDTA',urine_spot:'Urine spot',urine_24hr:'Urine 24 hr.',csf:'CSF',body_fluid:'Body Fluid'};return labels[x.bloodType]||labels[x.urineType]||labels[x.type]||'-'};s.waitingSpecimenTypeLabel=row=>String(row.specimen_code||'-');s.waitingCoverageLabel=row=>{const v=row.treatment_right||row.insurance_right||row.inscl_code||row.inscl_name||row.inscl_hos||'';if(Array.isArray(v))return v.map(x=>typeof x==='object'?((x.label||x.value||x.inscl_item_main&&x.inscl_item_main.value||'')):x).filter(Boolean).join(', ')||'-';return typeof v==='object'?String(v.label||v.value||'-'):String(v||'-')};s.waitingPaymentLabel=row=>String(row.payment_status||'-');s.receiveOrder=async row=>{const id=String(row._id||row.id||'');if(!id){field.notify('ไม่พบรหัสใบสั่งตรวจ','error',3000);return}try{const form=field.getFormRef();const api=(form&&form.userState)||field.globalUserState;if(!api||typeof api.runProcess!=='function')throw new Error('ไม่พบ API Process connector');s.bioLabLoadInfo='กำลังรับเข้า...';await api.runProcess(RECEIVE_PROCESS_ID,{source_order_id:id});field.notify('รับเข้าสิ่งส่งตรวจแล้ว','success',3000);setTimeout(()=>{s.loadWaitingOrders();const received=field.refField('lab_received_component');if(received&&received.vueState&&typeof received.vueState.load==='function')received.vueState.load()},700)}catch(e){s.bioLabLoadInfo='';field.notify('รับเข้าสิ่งส่งตรวจไม่สำเร็จ: '+(e&&e.message?e.message:'ไม่ทราบสาเหตุ'),'error',4500)}};s.rejectOrder=row=>{const f=field.getFormRef();if(!f||typeof f.openForm!=='function'){field.notify('ไม่พบตัวเปิดฟอร์มปฏิเสธ','error',3000);return}const hn=String(row.patient_hn||'').trim();const name=String(row.patient_name||'').trim();const initData={source_order_id:row._id||row.id||'',order_group_id:row.order_group_id||'',patient_hn:hn,patient_name:name,patient_display:[hn,name].filter(Boolean).join(' — '),ward_clinic:row.ward_clinic||'',lab_section:row.lab_section||'BC',selected_items_json:row.selected_items_json||'[]',biochemistry_specimen_json:row.biochemistry_specimen_json||'{}',treatment_right:s.waitingCoverageLabel(row)==='-'?'':s.waitingCoverageLabel(row),payment_status:row.payment_status||'',revision_no:String(row.revision_no||1)};f.openForm(REJECTION_FORM_ID,null,null,initData,{params:{from:'lab-biochemistry-dashboard',source_order_id:initData.source_order_id},popupType:'dialog',backdrop:false,afterSaveCallback:()=>{s.loadWaitingOrders();const cancelled=field.refField('lab_cancelled_orders');if(cancelled&&cancelled.vueState&&cancelled.vueState.load)cancelled.vueState.load();if(typeof f.subFormClose==='function')f.subFormClose()}})};s.formatWaitingTime=v=>{if(!v)return '-';try{return new Date(v).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'})}catch(e){return String(v)}};s.filteredWaitingOrders=()=>{const q=s.bioLabWaitingSearch.trim().toLowerCase();return !q?s.bioLabWaitingRows:s.bioLabWaitingRows.filter(r=>[r.patient_hn,r.patient_name,r.ward_clinic].join(' ').toLowerCase().includes(q))};s.waitingCount=()=>s.bioLabWaitingRows.length;s.waitingOrderCount=()=>s.bioLabWaitingRows.reduce((n,r)=>n+s.waitingItemCount(r),0);s.waitingSpecimenCount=()=>new Set(s.bioLabWaitingRows.map(s.waitingSpecimenLabel).filter(x=>x&&x!=='-')).size;s.applyWaitingResult=(out,rejectionsOut)=>{const denied=!!(out&&(out.permissionDenied||(out.data&&out.data.permissionDenied)));const message=(out&&(out.message||(out.data&&out.data.message)))||'';const rows=s.extractRows(out);const rejectedIds=new Set(s.extractRows(rejectionsOut).map(r=>String(r.source_order_id||'')).filter(Boolean));s.bioLabWaitingRows=rows.filter(r=>{const status=r.order_status||'waiting_receive';const isBio=r.lab_section==='BC'||(!r.lab_section&&!!r.selected_items_json);const id=String(r._id||r.id||'');return isBio&&['waiting_receive','waiting'].includes(status)&&!rejectedIds.has(id)});s.bioLabLoadInfo=denied?'ไม่มีสิทธิ์อ่าน Lab_Bio_Order':(message&&rows.length===0?message:('อ่าน '+rows.length+' ใบ · รอรับ '+s.bioLabWaitingRows.length+' ใบ'));console.log('[Lab Bio] order provider result',out)};s.loadWaitingOrders=()=>{try{s.bioLabLoadInfo='กำลังโหลด...';const api=field.globalUserState||((field.getFormRef&&field.getFormRef())||{}).userState;if(!api||typeof api.crudGetAll!=='function')throw new Error('ไม่พบ API connector ของฟอร์ม');api.crudGetAll({sdProvider:TARGET_PROVIDER,totalEnable:true},out=>{api.crudGetAll({sdProvider:REJECTION_PROVIDER,totalEnable:true},rejectionsOut=>s.applyWaitingResult(out,rejectionsOut),()=>s.applyWaitingResult(out,{data:[]}))},e=>{throw e||new Error('อ่านข้อมูลไม่สำเร็จ')})}catch(e){s.bioLabLoadInfo='โหลดไม่สำเร็จ';field.notify('โหลดรายการรอรับไม่สำเร็จ: '+(e&&e.message?e.message:'ตรวจสอบสิทธิ์และ Form ID'),'error',4000)}};s.loadWaitingOrders();",
                "onMounted": "",
                "onUnmount": ""
              },
              "id": "vue-ui-lab-waiting-orders"
            }
          ],
          "options": {
            "name": "lab_waiting",
            "label": "รอรับ",
            "hidden": false,
            "active": true,
            "disabled": false,
            "customClass": ""
          },
          "id": "tab-pane-lab-waiting"
        },
        {
          "key": 81012,
          "name": "Tab Pane",
          "component": "tab-pane",
          "category": "container",
          "icon": "tab-pane",
          "fieldType": "None",
          "fieldLength": null,
          "children": true,
          "enable": true,
          "formItemFlag": false,
          "fields": [
            {
              "name": "Components",
              "component": "vue-ui",
              "category": "display_ui",
              "icon": "components-ui",
              "fieldType": "None",
              "fieldLength": null,
              "children": false,
              "enable": true,
              "formItemFlag": false,
              "options": {
                "name": "lab_received_styles",
                "columnSpan": 4,
                "hidden": false,
                "label": "Received Styles",
                "customClass": "",
                "onCreated": "",
                "onMounted": "",
                "onUnmount": "",
                "content": "<style>.lab-toolbar-received{display:grid!important;grid-template-columns:minmax(280px,460px) minmax(0,1fr) max-content!important;align-items:center!important;gap:10px!important}.lab-queue,.lab-detail{border:1px solid #e5e7eb!important;border-radius:8px!important;background:#fff!important;overflow:hidden!important}.lab-received-row{display:grid!important;width:100%!important;grid-template-columns:1fr!important;gap:3px!important;padding:13px 16px!important;border:0!important;border-bottom:1px solid #e5e7eb!important;background:#fff!important;color:#111827!important;text-align:left!important;cursor:pointer!important}.lab-received-row:hover{background:#f8fafc!important}.lab-received-row.active{background:#eff6ff!important;box-shadow:inset 3px 0 #2563eb!important}.lab-received-row b{font-size:14px!important}.lab-received-row span{color:#374151!important}.lab-received-row small{color:#6b7280!important}.lab-detail-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;padding:15px 16px!important;border-bottom:1px solid #e5e7eb!important}.lab-detail-head h2{margin:0!important;font-size:16px!important}.lab-detail-head p{margin:3px 0 0!important;color:#6b7280!important;font-size:12px!important}.lab-detail-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important;padding:14px 16px!important;border-bottom:1px solid #e5e7eb!important}.lab-detail-grid span{display:flex!important;flex-direction:column!important;gap:3px!important;color:#6b7280!important;font-size:12px!important}.lab-detail-grid b{color:#111827!important;font-size:13px!important;word-break:break-word!important}.lab-detail h3{margin:16px 16px 9px!important;font-size:14px!important}.lab-detail-table{width:calc(100% - 32px)!important;margin:0 16px 16px!important;border-collapse:collapse!important}.lab-detail-table th,.lab-detail-table td{padding:10px!important;border-bottom:1px solid #e5e7eb!important;text-align:left!important}.lab-detail-table th{color:#6b7280!important;background:#f9fafb!important;font-size:12px!important}.lab-detail-table td:nth-child(3){text-align:right!important}.lab-received-tag{display:inline-block!important;padding:3px 8px!important;border-radius:999px!important;background:#ecfdf5!important;color:#047857!important;font-size:11px!important;font-weight:700!important}@media(max-width:900px){.lab-toolbar-received{grid-template-columns:1fr!important}.lab-detail-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}</style>"
              },
              "id": "vue-ui-lab-received-styles"
            },
            {
              "key": 81201,
              "name": "Components",
              "component": "vue-ui",
              "category": "display_ui",
              "icon": "components-ui",
              "fieldType": "None",
              "fieldLength": null,
              "children": false,
              "enable": true,
              "formItemFlag": false,
              "options": {
                "name": "lab_received_component",
                "columnSpan": 4,
                "hidden": false,
                "label": "Components",
                "customClass": "",
                "onCreated": "const s=this.vueState;const field=this;const PROVIDER={providerId:'6a771f20cc7d0a8451130339',providerType:'FORM',params:{},options:{}};s.rows=[];s.search='';s.info='';s.selectedId='';s.historyFilter='all';s.extract=out=>{const p=[out,out&&out.data,out&&out.rows,out&&out.data&&out.data.data,out&&out.reply&&out.reply.data];for(let i=0;i<p.length;i++){if(Array.isArray(p[i]))return p[i]}return []};s.safeJson=v=>{try{return typeof v==='string'?JSON.parse(v||'{}'):(v||{})}catch(e){return {}}};s.items=row=>{const x=s.safeJson(row&&row.selected_items_json);return Array.isArray(x)?x:[]};s.itemCount=row=>s.items(row).length;s.history=row=>{const x=s.safeJson(row&&row.order_change_history_json);return Array.isArray(x)?x:[]};s.setHistoryFilter=v=>{s.historyFilter=v||'all'};s.filteredHistory=row=>{const filter=s.historyFilter||'all';return s.history(row).filter(entry=>filter==='all'||(filter==='added'&&Array.isArray(entry.added)&&entry.added.length)||(filter==='removed'&&Array.isArray(entry.removed)&&entry.removed.length))};s.historyTime=v=>{if(!v)return '-';try{return new Date(v).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'medium'})}catch(e){return String(v)}};s.specimen=row=>{const x=s.safeJson(row&&row.biochemistry_specimen_json);const m={clotted:'Clotted blood',ionized_calcium:'Ionized Calcium',lithium_heparin:'Lithium heparin',naf:'NaF',edta:'EDTA',urine_spot:'Urine spot',urine_24hr:'Urine 24 hr.',csf:'CSF',body_fluid:'Body Fluid'};return m[x.bloodType]||m[x.urineType]||m[x.type]||'-'};s.time=v=>{if(!v)return '-';try{return new Date(v).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'})}catch(e){return String(v)}};s.money=v=>Number(v||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});s.setSearch=v=>{s.search=v||''};s.filtered=()=>{const q=s.search.trim().toLowerCase();return !q?s.rows:s.rows.filter(r=>[r.patient_hn,r.patient_name,r.ward_clinic,r.lab_no].join(' ').toLowerCase().includes(q))};s.selected=()=>s.rows.find(r=>String(r._id||r.id)===String(s.selectedId))||null;s.select=row=>{s.selectedId=String(row._id||row.id||'')};s.editOrder=()=>{const row=s.selected();const form=field.getFormRef();const id=row&&String(row._id||row.id||'');if(!id){field.notify('กรุณาเลือกรายการก่อน','warning',3000);return}if(!form||typeof form.openForm!=='function'){field.notify('ไม่พบตัวเปิดฟอร์มใบสั่งตรวจ','error',3000);return}form.openForm('6a771f20cc7d0a8451130339',id,null,{}, {popupType:'dialog',backdrop:false,afterSaveCallback:()=>{s.load();const waiting=field.refField('lab_waiting_orders');if(waiting&&waiting.vueState&&typeof waiting.vueState.loadWaitingOrders==='function')waiting.vueState.loadWaitingOrders()}})};s.startProcess=()=>{const row=s.selected();if(!row){field.notify('กรุณาเลือกรายการก่อน','warning',3000);return}field.notify('เตรียมเริ่มดำเนินการสำหรับ HN '+(row.patient_hn||'-'),'info',3000)};s.load=()=>{try{s.info='กำลังโหลด...';const api=field.globalUserState||((field.getFormRef&&field.getFormRef())||{}).userState;if(!api||typeof api.crudGetAll!=='function')throw Error('ไม่พบ API connector ของฟอร์ม');api.crudGetAll({sdProvider:PROVIDER,totalEnable:true},out=>{const all=s.extract(out);s.rows=all.filter(r=>{const status=String(r.order_status||'');const isBio=r.lab_section==='BC'||(!r.lab_section&&!!r.selected_items_json);return isBio&&status==='received'});if(!s.selectedId||!s.rows.some(r=>String(r._id||r.id)===String(s.selectedId)))s.selectedId=s.rows[0]?String(s.rows[0]._id||s.rows[0].id):'';s.info='รับเข้าแล้ว '+s.rows.length+' ใบ'},e=>{throw e||Error('อ่านข้อมูลไม่สำเร็จ')})}catch(e){s.info='โหลดไม่สำเร็จ';field.notify('โหลดรายการรับเข้าแล้วไม่สำเร็จ','error',4000)}};s.load();",
                "onMounted": "this.vueState.load()",
                "onUnmount": "",
                "content": "<div class=\"lab-screen\"><div style=\"display:grid;grid-template-columns:minmax(280px,460px) minmax(0,1fr) max-content;align-items:center;gap:10px;margin-bottom:16px\"><div class=\"lab-search-wrap\"><input class=\"lab-search\" :value=\"search\" @input=\"setSearch($event.target.value)\" placeholder=\"ค้นหาผู้ป่วยที่รับเข้าแล้ว\" /></div><span class=\"lab-muted\">{{ info || 'เลือกผู้ป่วยเพื่อเปิด List Order' }}</span><button class=\"lab-button\" type=\"button\" @click=\"load\">โหลดใหม่</button></div><div style=\"display:grid;grid-template-columns:360px minmax(0,1fr);gap:14px;min-height:590px\"><div style=\"border:1px solid #e5e7eb;border-radius:8px;background:#fff;overflow:hidden\"><div style=\"display:flex;align-items:center;justify-content:space-between;padding:15px 16px;border-bottom:1px solid #e5e7eb\"><div><h2 style=\"margin:0;font-size:16px\">ผู้ป่วยรับเข้าแล้ว</h2><p style=\"margin:3px 0 0;color:#6b7280;font-size:12px\">กำลังดำเนินการ {{ filtered().length }} ราย</p></div></div><button v-for=\"row in filtered()\" :key=\"row._id\" type=\"button\" @click=\"select(row)\" style=\"display:grid;width:100%;grid-template-columns:1fr;gap:3px;padding:13px 16px;border:0;border-bottom:1px solid #e5e7eb;color:#111827;text-align:left;cursor:pointer\" :style=\"{background:String(selectedId)===String(row._id||row.id)?'#eff6ff':'#fff',boxShadow:String(selectedId)===String(row._id||row.id)?'inset 3px 0 #2563eb':'none'}\"><b style=\"font-size:14px\">{{ row.patient_hn || '-' }}</b><span style=\"color:#374151\">{{ row.patient_name || '-' }}</span><small style=\"color:#6b7280\">{{ specimen(row) }} · รับเข้า {{ time(row.received_at) }}</small></button><div v-if=\"filtered().length===0\" class=\"lab-empty\"><strong>ไม่พบผู้ป่วย</strong><br/>รายการจะแสดงหลังยืนยันการรับสิ่งส่งตรวจ</div></div><div v-if=\"selected()\" style=\"border:1px solid #e5e7eb;border-radius:8px;background:#fff;overflow:hidden\"><div style=\"display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid #e5e7eb\"><div><h2 style=\"margin:0;font-size:16px\">{{ selected().patient_hn || '-' }} — {{ selected().patient_name || '-' }}</h2><p style=\"margin:3px 0 0;color:#6b7280;font-size:12px\">LAB NO. {{ selected().lab_no || 'รอกำหนด' }} · {{ specimen(selected()) }} · รับเข้า {{ time(selected().received_at) }}</p></div><span class=\"lab-status-tag\">{{ itemCount(selected()) }} รายการ</span></div><div style=\"display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:14px 16px;border-bottom:1px solid #e5e7eb\"><span style=\"display:flex;flex-direction:column;gap:3px;color:#6b7280;font-size:12px\">Ward / Clinic<b style=\"color:#111827;font-size:13px\">{{ selected().ward_clinic || '-' }}</b></span><span style=\"display:flex;flex-direction:column;gap:3px;color:#6b7280;font-size:12px\">ผู้รับเข้า<b style=\"color:#111827;font-size:13px\">{{ selected().received_by || '-' }}</b></span><span style=\"display:flex;flex-direction:column;gap:3px;color:#6b7280;font-size:12px\">Specimen<b style=\"color:#111827;font-size:13px\">{{ selected().specimen_code || '-' }}</b></span><span style=\"display:flex;flex-direction:column;gap:3px;color:#6b7280;font-size:12px\">การชำระเงิน<b style=\"color:#111827;font-size:13px\">{{ selected().payment_status || '-' }}</b></span></div><h3 style=\"margin:16px 16px 9px;font-size:14px\">List Order</h3><table style=\"width:calc(100% - 32px);margin:0 16px 16px;border-collapse:collapse\"><thead><tr><th style=\"padding:10px;text-align:left;color:#6b7280;background:#f9fafb;font-size:12px\">รหัส</th><th style=\"padding:10px;text-align:left;color:#6b7280;background:#f9fafb;font-size:12px\">รายการตรวจ</th><th style=\"padding:10px;text-align:right;color:#6b7280;background:#f9fafb;font-size:12px\">ราคา</th><th style=\"padding:10px;text-align:left;color:#6b7280;background:#f9fafb;font-size:12px\">สถานะ</th></tr></thead><tbody><tr v-for=\"item in items(selected())\" :key=\"item.id||item.code\"><td style=\"padding:10px;border-bottom:1px solid #e5e7eb\"><b>{{ item.code || '-' }}</b></td><td style=\"padding:10px;border-bottom:1px solid #e5e7eb\">{{ item.name || '-' }}</td><td style=\"padding:10px;border-bottom:1px solid #e5e7eb;text-align:right\">{{ money(item.effective_price!=null?item.effective_price:item.sale_price) }}</td><td style=\"padding:10px;border-bottom:1px solid #e5e7eb\"><span style=\"display:inline-block;padding:3px 8px;border-radius:999px;background:#eff6ff;color:#2563eb;font-size:11px;font-weight:700\">รอตรวจ</span></td></tr></tbody></table><div v-if=\"history(selected()).length\" style=\"padding:0 16px 16px\"><div style=\"display:flex;align-items:center;justify-content:space-between;gap:10px;margin:4px 0 9px\"><h3 style=\"margin:0;font-size:14px\">ประวัติการแก้ไขรายการส่งตรวจ</h3><select :value=\"historyFilter\" @change=\"setHistoryFilter($event.target.value)\" style=\"height:30px;padding:0 28px 0 9px;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#374151;font-size:12px;cursor:pointer\"><option value=\"all\">ทั้งหมด</option><option value=\"added\">รายการที่เพิ่ม</option><option value=\"removed\">รายการที่ลด</option></select></div><div v-for=\"(entry,index) in filteredHistory(selected())\" :key=\"entry.changed_at||index\" style=\"margin-bottom:10px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden\"><div style=\"padding:8px 12px;color:#374151;font-size:12px;font-weight:700\">{{ historyTime(entry.changed_at) }}<span v-if=\"entry.changed_by\"> · {{ entry.changed_by }}</span></div><div v-if=\"historyFilter==='all'||historyFilter==='added'\" v-for=\"item in (entry.added||[])\" :key=\"'add-'+item.code\" style=\"padding:8px 12px;background:#ecfdf5;color:#166534;font-weight:700\">＋ {{ item.code }} <span style=\"font-weight:500\">{{ item.name }}</span></div><div v-if=\"historyFilter==='all'||historyFilter==='removed'\" v-for=\"item in (entry.removed||[])\" :key=\"'remove-'+item.code\" style=\"padding:8px 12px;background:#fef2f2;color:#dc2626;font-weight:700\">− {{ item.code }} <span style=\"font-weight:500\">{{ item.name }}</span></div></div></div><div style=\"display:flex;justify-content:flex-end;gap:10px;padding:14px 16px;border-top:1px solid #e5e7eb;background:#fff\"><button type=\"button\" @click=\"editOrder\" style=\"height:38px;padding:0 14px;border:1px solid #d1d5db;border-radius:7px;background:#fff;color:#374151;font-weight:700;cursor:pointer\">แก้ไขรายการส่งตรวจ</button><button type=\"button\" @click=\"startProcess\" style=\"height:38px;padding:0 14px;border:1px solid #2563eb;border-radius:7px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer\">เริ่มดำเนินการ</button></div></div><div v-else class=\"lab-detail-empty\"><div><b>List Order</b><br/><span>เลือกผู้ป่วยจากรายการด้านซ้ายเพื่อดูรายละเอียด<br/>สิ่งส่งตรวจ, LAB NO., ผลตรวจ, Comment และสถานะ</span></div></div></div></div>"
              },
              "id": "vue-ui-lab-received"
            }
          ],
          "options": {
            "name": "lab_received",
            "label": "รับเข้าแล้ว",
            "hidden": false,
            "active": false,
            "disabled": false,
            "customClass": ""
          },
          "id": "tab-pane-lab-received"
        },
        {
          "key": 81013,
          "name": "Tab Pane",
          "component": "tab-pane",
          "category": "container",
          "icon": "tab-pane",
          "fieldType": "None",
          "fieldLength": null,
          "children": true,
          "enable": true,
          "formItemFlag": false,
          "fields": [
            {
              "key": 81301,
              "name": "Components",
              "component": "vue-ui",
              "category": "display_ui",
              "icon": "components-ui",
              "fieldType": "None",
              "fieldLength": null,
              "children": false,
              "enable": true,
              "formItemFlag": false,
              "options": {
                "name": "lab_resulted_component",
                "columnSpan": 4,
                "hidden": false,
                "label": "Components",
                "customClass": "",
                "onCreated": "",
                "onMounted": "",
                "onUnmount": "",
                "content": "<div class=\"lab-screen\"><div class=\"lab-metrics\"><div class=\"lab-metric\"><div>ออกผลทั้งหมด</div><b class=\"green\">0 <small>LAB NO.</small></b></div><div class=\"lab-metric\"><div>ออกผลครบ</div><b class=\"green\">0 <small>รายการ</small></b></div><div class=\"lab-metric\"><div>ออกผลบางส่วน</div><b class=\"amber\">0 <small>รายการ</small></b></div></div><div class=\"lab-toolbar lab-toolbar-result\"><div class=\"lab-search-wrap\"><input class=\"lab-search\" placeholder=\"ค้นหา HN, ชื่อผู้ป่วย หรือ LAB NO.\" /></div><select class=\"lab-select\"><option>สถานะผลทั้งหมด</option><option>ออกผลครบ</option><option>ออกผลบางส่วน</option></select><span class=\"lab-spacer\"></span><button class=\"lab-button\" type=\"button\">Export CSV</button></div><div class=\"lab-panel\"><div class=\"lab-panel-head\"><div><h2>รายการที่ออกผลแล้ว</h2><p>ดูผลหรือพิมพ์รายงานตาม LAB NO.</p></div></div><div class=\"lab-table-wrap\"><table class=\"lab-table\"><thead><tr><th>HN / LAB NO.</th><th>ชื่อผู้ป่วย</th><th>Ward / Clinic</th><th>เวลาออกผล</th><th>สิ่งส่งตรวจ</th><th>สถานะผล</th><th></th></tr></thead><tbody><tr><td colspan=\"7\"><div class=\"lab-empty\"><strong>ไม่พบรายการออกผล</strong><br/>ผลที่ออกแล้วจะแสดงในหน้านี้</div></td></tr></tbody></table></div></div></div>"
              },
              "id": "vue-ui-lab-resulted"
            }
          ],
          "options": {
            "name": "lab_resulted",
            "label": "ออกผลแล้ว",
            "hidden": false,
            "active": false,
            "disabled": false,
            "customClass": ""
          },
          "id": "tab-pane-lab-resulted"
        },
        {
          "key": 81014,
          "name": "Tab Pane",
          "component": "tab-pane",
          "category": "container",
          "icon": "tab-pane",
          "fieldType": "None",
          "fieldLength": null,
          "children": true,
          "enable": true,
          "formItemFlag": false,
          "fields": [
            {
              "key": 81302,
              "name": "Components",
              "component": "vue-ui",
              "category": "display_ui",
              "icon": "components-ui",
              "fieldType": "None",
              "fieldLength": null,
              "children": false,
              "enable": true,
              "formItemFlag": false,
              "options": {
                "name": "lab_cancelled_orders",
                "columnSpan": 4,
                "hidden": false,
                "label": "Components",
                "customClass": "",
                "content": "<div class=\"lab-screen\"><div class=\"lab-toolbar lab-toolbar-result\"><div class=\"lab-search-wrap\"><input class=\"lab-search\" :value=\"cancelledSearch\" @input=\"setSearch($event.target.value)\" placeholder=\"ค้นหา HN, ชื่อผู้ป่วย หรือ Ward / Clinic\" /></div><span></span><span class=\"lab-spacer\"></span><button class=\"lab-button\" type=\"button\" @click=\"load\">โหลดใหม่</button></div><div class=\"lab-panel\"><div class=\"lab-panel-head\"><div><h2>รายการที่ยกเลิก</h2><p>สิ่งส่งตรวจที่ห้องปฏิบัติการปฏิเสธรับ</p></div><span>{{ info || (filtered().length + ' รายการ') }}</span></div><div class=\"lab-table-wrap\"><table class=\"lab-table\"><thead><tr><th>HN / LAB NO.</th><th>ชื่อผู้ป่วย</th><th>Ward / Clinic</th><th>เวลาสั่ง</th><th>สิ่งส่งตรวจ</th><th>Specimen</th><th>สิทธิ์การรักษา</th><th>Order</th><th>การชำระเงิน</th><th>สถานะ</th></tr></thead><tbody><tr v-for=\"row in filtered()\" :key=\"row._id\"><td><b>{{ row.patient_hn || '-' }}</b><br/><small>LAB NO. รอกำหนด</small></td><td>{{ row.patient_name || '-' }}</td><td>{{ row.ward_clinic || '-' }}</td><td>{{ formatTime(row.ordered_at || row.requested_at) }}</td><td>{{ specimen(row) }}</td><td>{{ row.specimen_code || '-' }}</td><td>{{ coverage(row) }}</td><td><span class=\"lab-status-tag\">{{ itemCount(row) }} รายการ</span></td><td>{{ row.payment_status || '-' }}</td><td><b style=\"color:var(--el-color-danger)\">ยกเลิกแล้ว</b><br/><small>{{ reason(row) }}</small></td></tr><tr v-if=\"filtered().length===0\"><td colspan=\"10\"><div class=\"lab-empty\"><strong>ไม่พบรายการยกเลิก</strong><br/>รายการที่ปฏิเสธรับจะแสดงในหน้านี้</div></td></tr></tbody></table></div></div></div>",
                "onCreated": "const s=this.vueState;const field=this;const PROVIDER={providerId:'6a7713fdcc7d0a8451130331',providerType:'FORM',params:{},options:{}};s.rows=[];s.cancelledSearch='';s.info='';s.extract=out=>{const picks=[out,out&&out.data,out&&out.rows,out&&out.data&&out.data.data,out&&out.reply&&out.reply.data];for(let i=0;i<picks.length;i++){if(Array.isArray(picks[i]))return picks[i]}return []};s.safeJson=v=>{try{return typeof v==='string'?JSON.parse(v||'{}'):(v||{})}catch(e){return {}}};s.itemCount=row=>{const x=s.safeJson(row.selected_items_json);return Array.isArray(x)?x.length:0};s.specimen=row=>{const x=s.safeJson(row.biochemistry_specimen_json);const m={clotted:'Clotted blood',ionized_calcium:'Ionized Calcium',lithium_heparin:'Lithium heparin',naf:'NaF',edta:'EDTA',urine_spot:'Urine spot',urine_24hr:'Urine 24 hr.',csf:'CSF',body_fluid:'Body Fluid'};return m[x.bloodType]||m[x.urineType]||m[x.type]||'-'};s.coverage=row=>{const v=row.treatment_right||row.insurance_right||row.inscl_code||row.inscl_name||'';return typeof v==='object'?String(v.label||v.value||'-'):String(v||'-')};s.reason=row=>{const m={specimen_incorrect:'สิ่งส่งตรวจไม่ถูกต้อง',specimen_insufficient:'ปริมาณสิ่งส่งตรวจไม่เพียงพอ',container_incorrect:'ภาชนะบรรจุไม่ถูกต้อง',patient_mismatch:'ข้อมูลผู้ป่วยไม่ตรงกัน',specimen_unsuitable:'สิ่งส่งตรวจเสื่อมสภาพหรือปนเปื้อน',other:'อื่น ๆ'};return m[row.reject_reason_code]||'ปฏิเสธรับสิ่งส่งตรวจ'};s.formatTime=v=>{if(!v)return '-';try{return new Date(v).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'})}catch(e){return String(v)}};s.setSearch=v=>{s.cancelledSearch=v||''};s.filtered=()=>{const q=s.cancelledSearch.trim().toLowerCase();return !q?s.rows:s.rows.filter(r=>[r.patient_hn,r.patient_name,r.ward_clinic].join(' ').toLowerCase().includes(q))};s.load=()=>{try{s.info='กำลังโหลด...';const api=field.globalUserState||((field.getFormRef&&field.getFormRef())||{}).userState;if(!api||typeof api.crudGetAll!=='function')throw Error('ไม่พบ API connector ของฟอร์ม');api.crudGetAll({sdProvider:PROVIDER,totalEnable:true},out=>{const all=s.extract(out);s.rows=all.filter(r=>r&&r.source_order_id);s.info='อ่าน '+all.length+' ใบ · ยกเลิก '+s.rows.length+' ใบ'},e=>{throw e||Error('อ่านข้อมูลไม่สำเร็จ')})}catch(e){s.info='โหลดไม่สำเร็จ';field.notify('โหลดรายการยกเลิกไม่สำเร็จ','error',4000)}};s.load();",
                "onMounted": "",
                "onUnmount": ""
              },
              "id": "vue-ui-lab-cancelled"
            }
          ],
          "options": {
            "name": "lab_cancelled",
            "label": "ยกเลิกรายการ",
            "hidden": false,
            "active": false,
            "disabled": false,
            "customClass": ""
          },
          "id": "tab-pane-lab-cancelled"
        }
      ],
      "options": {
        "name": "lab_biochem_tabs",
        "hidden": false,
        "displayType": "card",
        "tabPosition": "top",
        "lazy": true,
        "customClass": ""
      },
      "id": "tab-lab-biochem"
    }
  ],
  "formConfig": {
    "modelName": "formData",
    "refName": "sdForm",
    "rulesName": "rules",
    "labelWidth": 120,
    "labelPosition": "top",
    "size": "",
    "labelAlign": "label-right-align",
    "cssCode": ".lab-screen{font-family:\"IBM Plex Sans Thai\",\"Noto Sans Thai\",Tahoma,sans-serif;color:#111827;font-size:14px}.lab-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:18px}.lab-metric{padding:15px 16px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;color:#6b7280;font-size:12px}.lab-metric b{display:block;margin-top:4px;font-size:25px}.lab-metric small{font-size:12px;font-weight:400;color:#9ca3af}.blue{color:#2563eb}.red{color:#dc2626}.amber{color:#d97706}.green{color:#059669}.lab-toolbar{align-items:center;gap:10px;margin-bottom:16px}.lab-toolbar-filter{display:grid;grid-template-columns:minmax(280px,460px) 210px;justify-content:start}.lab-toolbar-received{display:grid;grid-template-columns:minmax(280px,460px) max-content;justify-content:start}.lab-toolbar-result{display:grid;grid-template-columns:minmax(280px,460px) 210px minmax(0,1fr) max-content}.lab-search-wrap{position:relative;width:100%;min-width:0}.lab-search-wrap:before{content:\"⌕\";position:absolute;z-index:2;left:12px;top:7px;color:#6b7280;font-size:20px;pointer-events:none}.lab-search{display:block!important;width:100%!important;height:40px!important;border:1px solid #d1d5db!important;border-radius:8px!important;background:#fff!important;color:#111827!important;padding:0 12px 0 36px!important;outline:none!important;box-sizing:border-box!important}.lab-select{display:block!important;width:210px!important;height:40px!important;border:1px solid #d1d5db!important;border-radius:8px!important;background:#fff!important;color:#111827!important;padding:0 12px!important;box-sizing:border-box!important;min-width:0!important}.lab-search:focus,.lab-select:focus{border-color:#93c5fd!important;box-shadow:0 0 0 3px #eff6ff}.lab-button{height:40px;padding:0 15px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#374151;font-weight:600;cursor:pointer;white-space:nowrap}.lab-button:hover{background:#f9fafb}.lab-panel,.lab-queue{border:1px solid #e5e7eb;border-radius:8px;background:#fff;overflow:hidden}.lab-panel-head,.lab-queue-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid #e5e7eb}.lab-panel-head h2,.lab-queue-head h2{margin:0;font-size:16px}.lab-panel-head p,.lab-queue-head p,.lab-panel-head span,.lab-muted{margin:3px 0 0;color:#6b7280;font-size:12px}.lab-table-wrap{overflow-x:auto}.lab-table{width:100%;border-collapse:collapse;min-width:820px}.lab-table th{height:40px;padding:0 14px;text-align:left;background:#f9fafb;color:#6b7280;border-bottom:1px solid #e5e7eb;font-size:11px;font-weight:600}.lab-table td{padding:12px 14px;border-bottom:1px solid #e5e7eb}.lab-empty{padding:64px 20px;text-align:center;color:#6b7280;line-height:1.7}.lab-empty strong,.lab-detail-empty b{color:#374151}.lab-split{display:grid;grid-template-columns:360px minmax(0,1fr);gap:14px;min-height:590px}.lab-detail-empty{display:grid;place-items:center;border:1px dashed #d1d5db;border-radius:8px;background:#fff;color:#6b7280;text-align:center;line-height:1.8}.lab-flow{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:14px;padding:12px 14px;border-left:4px solid #2563eb;border-radius:4px;background:#eff6ff;color:#4b5563;font-size:12px}.lab-flow b{color:#1d4ed8;margin-right:4px}.lab-flow i{font-style:normal;color:#2563eb}.lab-spacer{min-width:0}@media(max-width:900px){.lab-metrics{grid-template-columns:1fr}.lab-toolbar-filter,.lab-toolbar-received,.lab-toolbar-result{display:grid;grid-template-columns:1fr;justify-content:stretch}.lab-select{width:100%!important}.lab-toolbar-result .lab-spacer{display:none}.lab-toolbar-result .lab-button{justify-self:start}.lab-split{grid-template-columns:1fr}.lab-queue{min-height:200px}.lab-detail-empty{min-height:240px}}\n.bio-root{display:flex;flex-direction:column;gap:16px}.bio-specimen,.bio-summary{border:1px solid var(--el-border-color-lighter);border-radius:12px;padding:16px;background:var(--el-fill-color-blank)}.bio-specimen h3{margin:0 0 12px;font-size:15px}.bio-specimen-grid{display:grid;grid-template-columns:1.3fr 1fr;gap:20px}.bio-sub{display:flex;flex-wrap:wrap;margin:10px 0 0 24px}.bio-specimen-fields{display:grid;gap:10px}.bio-toolbar{display:flex;align-items:center;gap:16px}.bio-toolbar>.el-input{max-width:520px}.bio-count{margin-left:auto;white-space:nowrap;text-align:right;color:var(--el-text-color-secondary)}.bio-count b,.bio-count strong,.bio-total strong{color:var(--el-color-primary)}.bio-groups{column-width:300px;column-gap:16px}.bio-group{break-inside:avoid;border:1px solid var(--el-border-color-lighter);border-radius:10px;overflow:hidden;margin:0 0 16px;background:#fff}.bio-group-title{display:flex;gap:8px;align-items:center;padding:11px 12px;background:var(--el-fill-color-light)}.bio-group-title b,.bio-name{flex:1}.bio-group-title span{font-size:11px;color:var(--el-text-color-secondary)}.bio-item{display:flex;align-items:center;gap:8px;padding:7px 12px;border-top:1px solid var(--el-border-color-lighter);font-size:13px}.bio-code{min-width:48px;color:var(--el-color-primary);font-weight:700}.bio-price{min-width:72px;text-align:right;color:var(--el-text-color-secondary);font-variant-numeric:tabular-nums}.bio-minute{width:92px}.bio-summary-head,.bio-total{display:flex;justify-content:space-between;align-items:center}.bio-none{padding:12px 0;color:var(--el-text-color-placeholder)}.bio-selected{display:flex;align-items:center;gap:8px;padding:7px 0;border-top:1px solid var(--el-border-color-lighter)}.bio-selected>span:nth-child(2){flex:1}.bio-selected small{color:var(--el-text-color-secondary)}.bio-total{padding-top:12px;font-size:15px}.bio-send{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border:1px solid var(--el-color-primary-light-7);border-radius:12px;background:var(--el-color-primary-light-9)}.bio-send b{display:block;color:var(--el-text-color-primary)}.bio-send span{display:block;margin-top:3px;font-size:12px;color:var(--el-text-color-secondary)}@media(max-width:700px){.bio-specimen-grid{grid-template-columns:1fr}.bio-toolbar{align-items:stretch;flex-direction:column}.bio-toolbar>.el-input{max-width:none}.bio-count{margin-left:0;text-align:left}.bio-groups{column-width:auto}.bio-sub{margin-left:0}.bio-send{align-items:stretch;flex-direction:column}}\n.bio-create-bar{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:18px 20px;border:1px solid var(--el-color-primary-light-7);border-radius:14px;background:var(--el-color-primary-light-9);margin-bottom:18px}.bio-create-title{font-size:17px;font-weight:700;color:var(--el-text-color-primary)}.bio-create-sub{font-size:13px;color:var(--el-text-color-secondary);margin-top:3px}@media(max-width:640px){.bio-create-bar{align-items:flex-start;flex-direction:column}}\n.lab-order-list{display:flex;flex-direction:column;gap:3px;min-width:190px;max-width:330px}.lab-order-list div{display:flex;gap:7px;line-height:1.35}.lab-order-list b{min-width:45px;color:var(--el-color-primary);font-size:12px}.lab-order-list span{color:var(--el-text-color-regular);font-size:12px}.lab-order-list small{color:var(--el-text-color-placeholder)}.lab-status-tag{display:inline-block;padding:5px 12px;border-radius:999px;background:#eff6ff;color:#2563eb;font-size:12px;font-weight:700;white-space:nowrap}.lab-action-cell{white-space:nowrap}.lab-link{border:0!important;background:transparent!important;padding:2px!important;font:inherit!important;font-weight:700!important;cursor:pointer}.lab-link.receive{color:#2563eb}.lab-link.reject{color:#dc2626}.lab-action-cell>span{margin:0 4px;color:#9ca3af}",
    "customClass": [],
    "functio Sns": "",
    "layoutType": "PC",
    "jsonVersion": 3,
    "onFormCreated": "",
    "onFormMounted": "",
    "onParentChange": "",
    "onFormDataChange": "",
    "onFormUnmounted": ""
  }
}
