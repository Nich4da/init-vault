/* build_xray_contrast_history_ui.js
 * สร้าง Form-Builder/SDForm/X-ray/xray-contrast-history-v1.json
 *   หน้า "ประวัติการใช้สารทึบรังสี" — ค้นด้วย HN แล้วดูว่า order ใด วันใด
 *   มีบันทึกการใช้สารทึบของรายการตรวจไหนบ้าง · อ่านอย่างเดียวล้วน
 *
 * โครงไฟล์ (container + options ทุกช่อง) ก๊อปจากฟอร์ม LAB ที่ผ่าน validator แล้ว
 *   Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json
 * ตามกฎ 02-initcraft/governance/from-codex-backup/SDFORM_JSON_RULES.md
 * (SDFORM-RULES-OK-2026-08-25) — แก้เฉพาะค่าข้อมูล ไม่แตะค่า presentation
 *
 * หน้าตา/กติกาการค้น ยกมาจากแท็บ "สืบค้นผลแลป" (widget xray_lab_lookup) ทั้งชุด
 * CSS .xll-* จึงเป็นชุดเดียวกับที่ build_xray_cpoe_worklist_ui.js ใช้อยู่
 *   คอลัมน์แมปตรง: Specimen → สารทึบ · ห้องแลป → เครื่อง · LAB NO. → Accession No.
 *   เวลาออกผล → วันเวลาที่ใช้ · ปุ่ม ดูผล → ดูบันทึก
 *
 * 🔴 ข้อจำกัดที่ต้องรู้ก่อนใช้งานจริง
 *   ข้อมูลสารทึบอ่านจาก payload ของ Process worklist (item.contrast หรือ item.contrast_*)
 *   ซึ่ง xray_cpoe_worklist_api.js ยังไม่ได้ join zdata_xray_contrast_media
 *   ⇒ จนกว่าฝั่ง API จะเพิ่มให้ ทุกแถวจะขึ้น "ยังไม่ได้บันทึก" และหน้าจะบอกเหตุผลตรง ๆ
 *   หน้านี้ไม่แตะ Worklist เดิม ไม่เขียนข้อมูลใด ๆ และไม่สร้าง Process ใหม่
 *
 * รันใหม่ได้เสมอ:  node Form-Builder/seed/tests-tools/scripts/build_xray_contrast_history_ui.js
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const source = path.join(root, 'Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json')
const target = path.join(root, 'Form-Builder/SDForm/X-ray/xray-contrast-history-v1.json')

/* Process เดิมของ X-ray Worklist — read-only action 'list' เท่านั้น ไม่มี Process ใหม่ */
const worklistProcessId = '6a957009422c1ca959829e45'
/* ฟอร์มบันทึกการใช้สารทึบรังสีที่ import ไว้แล้ว (spec.md §ตารางไอดี)
   ปิดปุ่มได้โดยไม่ต้องแก้โค้ด: XRAY_CONTRAST_FORM_ID= (ค่าว่าง) */
const defaultContrastFormId = '6aa2424809c1bad08952da71'
const contrastFormId = String(
  process.env.XRAY_CONTRAST_FORM_ID === undefined
    ? defaultContrastFormId
    : process.env.XRAY_CONTRAST_FORM_ID
).trim()
if (contrastFormId && !/^[a-f0-9]{24}$/i.test(contrastFormId)) {
  throw new Error('XRAY_CONTRAST_FORM_ID must be the 24-character Form ID of the contrast media record form')
}

const form = JSON.parse(fs.readFileSync(source, 'utf8'))
const grid = form.fields.find(field => field.component === 'grid')
if (!grid || !grid.cols || !grid.cols[0] || !grid.cols[0].fields || !grid.cols[0].fields[0] ||
    grid.cols[0].fields[0].component !== 'vue-ui') {
  throw new Error('Validated grid/grid-col/vue-ui template was not found')
}
form.fields = [grid]
grid.options.name = 'xray_contrast_history_root'
grid.id = 'grid-xray-contrast-history-root'
const col = grid.cols[0]
col.options.name = 'xray_contrast_history_col'
col.id = 'grid-col-xray-contrast-history'
const widget = col.fields[0]
widget.options.name = 'xray_contrast_history'
widget.options.label = 'ประวัติการใช้สารทึบรังสี'
widget.id = 'vue-ui-xray-contrast-history'

form.formConfig.cssCode = `.xray-contrast-history{--xll-ink:var(--el-text-color-primary,#303133);--xll-text:var(--el-text-color-regular,#606266);--xll-muted:var(--el-text-color-secondary,#909399);--xll-border:var(--el-border-color-light,#e4e7ed);--xll-fill:var(--el-fill-color-light,#f5f7fa);--xll-white:var(--el-bg-color,#fff);width:100%;padding:4px 0 30px;color:var(--xll-text);font-family:"Leelawadee UI","Noto Sans Thai",Tahoma,"Segoe UI",sans-serif;font-size:13px;line-height:1.4}
.xray-contrast-history *{box-sizing:border-box}.xll-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}.xll-toolbar .xll-search{width:290px!important;flex:0 0 290px}.xll-toolbar .xll-date{width:220px!important;flex:0 0 220px}.xll-mode-strip{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}.xll-mode-strip>button{display:inline-flex;min-height:34px;align-items:center;gap:8px;padding:6px 11px;border:1px solid var(--xll-border);border-radius:6px;background:var(--xll-fill);color:var(--xll-text);font:inherit;cursor:pointer}.xll-mode-strip>button strong{display:grid;min-width:22px;height:20px;place-items:center;padding:0 5px;border-radius:999px;background:var(--xll-white);color:var(--xll-muted);font-size:10px}.xll-mode-strip>button.is-active{border-color:var(--el-color-primary,#409eff);background:var(--el-color-primary-light-9,#ecf5ff);color:var(--el-color-primary,#409eff)}.xll-mode-strip>button.is-active strong{color:var(--el-color-primary,#409eff)}.xll-mode-strip>small{margin-left:auto;color:var(--xll-muted);font-size:11px}.xll-summary{margin:0 0 8px;color:var(--xll-muted);font-size:12px}.xll-summary.is-error{color:var(--el-color-danger,#f56c6c)}.xll-empty{display:grid;min-height:180px;place-content:center;gap:6px;padding:20px;border:1px dashed var(--xll-border);background:var(--xll-fill);text-align:center}.xll-empty strong{color:var(--xll-ink);font-size:14px}.xll-empty span{color:var(--xll-muted);font-size:12px}
.xll-shell{border-top:1px solid var(--xll-border);border-bottom:1px solid var(--xll-border);overflow-x:auto}.xll-head,.xll-row{display:grid;grid-template-columns:32px minmax(190px,1.45fr) minmax(130px,1fr) 70px minmax(130px,1fr) 88px minmax(150px,1.1fr) 110px;gap:9px;align-items:center;min-width:1040px;padding:8px 10px}.xll-head{border-bottom:1px solid var(--xll-border);color:var(--xll-muted);font-size:11px;font-weight:650}.xll-order{border-bottom:1px solid var(--el-border-color-lighter,#ebeef5)}.xll-order:last-child{border-bottom:0}.xll-row{min-height:72px;background:var(--xll-white);cursor:pointer}.xll-row:hover,.xll-order.is-open>.xll-row{background:var(--xll-fill)}.xll-expand{display:grid;width:28px;height:30px;place-items:center;padding:0;border:0;border-radius:4px;background:transparent;color:var(--xll-muted);cursor:pointer}.xll-expand svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;transition:transform .16s}.xll-order.is-open .xll-expand svg{transform:rotate(90deg)}.xll-patient,.xll-order-meta{display:grid;gap:2px;min-width:0}.xll-patient>span{overflow:hidden;color:var(--xll-ink);font-weight:650;text-overflow:ellipsis;white-space:nowrap}.xll-patient small,.xll-order-meta small{color:var(--xll-muted);font-size:11px}.xll-context,.xll-sections{display:flex;gap:5px;flex-wrap:wrap}.xll-pill,.xll-section,.xll-status{display:inline-flex;min-height:21px;align-items:center;padding:1px 7px;border:1px solid var(--xll-border);border-radius:5px;background:var(--xll-white);font-size:10px;font-weight:650}.xll-section{border-color:var(--el-color-primary-light-5,#a0cfff);background:var(--el-color-primary-light-9,#ecf5ff);color:var(--el-color-primary,#409eff);font-family:"SFMono-Regular","Roboto Mono",Consolas,monospace}.xll-order-no{width:max-content;max-width:100%;padding:1px 6px;border-radius:4px;background:var(--el-fill-color,#f0f2f5);color:var(--xll-ink);font-family:"SFMono-Regular","Roboto Mono",Consolas,monospace;font-size:11px}.xll-status.is-waiting{border-color:#fadb14;background:#fffbe6;color:#8a6d00}.xll-status.is-received{border-color:#e6a23c;background:var(--el-color-warning-light-9,#fdf6ec);color:#b88230}.xll-status.is-partial{border-color:var(--el-color-success-light-3,#95d475);background:var(--el-color-success-light-9,#f0f9eb);color:#529b2e}.xll-status.is-complete{border-color:#67c23a;background:var(--el-color-success-light-9,#f0f9eb);color:#529b2e}.xll-status.is-cancelled{border-color:#f56c6c;background:var(--el-color-danger-light-9,#fef0f0);color:#c45656}.xll-detail{padding:0 12px 12px 42px;background:var(--xll-white);overflow-x:auto}.xll-item-head,.xll-item-row{display:grid;grid-template-columns:52px 130px minmax(240px,2fr) minmax(130px,1fr) 88px 132px 116px 74px;gap:10px;align-items:center;min-width:1050px;padding:7px 0}.xll-item-head{border-top:1px solid var(--el-color-primary-light-7,#c6e2ff);border-bottom:1px solid var(--el-color-primary-light-7,#c6e2ff);background:var(--el-color-primary-light-9,#ecf5ff);color:var(--xll-ink);font-size:11px;font-weight:650}.xll-item-row{min-height:50px;border-bottom:1px dashed var(--el-border-color-lighter,#ebeef5);font-size:12px}.xll-detail-empty{padding:24px;text-align:center;color:var(--xll-muted)}.xll-pagination{display:flex;justify-content:flex-end;padding-top:10px}.xll-mono{font-family:"SFMono-Regular","Roboto Mono",Consolas,monospace;font-variant-numeric:tabular-nums}
@media(max-width:900px){.xll-toolbar .xll-search,.xll-toolbar .xll-date{width:calc(50% - 5px)!important;flex:0 0 calc(50% - 5px)}}
@media(max-width:760px){.xll-toolbar{display:grid;grid-template-columns:1fr}.xll-toolbar .xll-search,.xll-toolbar .xll-date{width:100%!important;max-width:none;flex:auto}.xll-mode-strip>small{width:100%;margin-left:0}.xll-result-head{grid-template-columns:1fr 1fr}.xll-pagination{justify-content:flex-start;overflow-x:auto}}

.xll-note{margin:0 0 10px;padding:8px 11px;border:1px solid var(--el-color-warning-light-5,#f3d19e);border-radius:6px;background:var(--el-color-warning-light-9,#fdf6ec);color:#b88230;font-size:12px;line-height:1.6}
.xll-brand{display:grid;gap:2px;min-width:0}
.xll-brand strong{overflow-wrap:anywhere}
.xll-brand small{color:var(--xll-muted);font-size:10px;overflow-wrap:anywhere}
.xll-none{color:var(--el-text-color-placeholder,#a8abb2)}
.xll-alert{display:inline-flex;align-items:center;min-height:19px;margin-top:3px;padding:0 6px;border:1px solid var(--el-color-danger-light-5,#fab6b6);border-radius:4px;background:var(--el-color-danger-light-9,#fef0f0);color:#c45656;font-size:10px;font-weight:650}
.xll-count-sub{color:var(--xll-muted);font-size:11px}`

widget.options.content = `<div class="xray-contrast-history">
  <section aria-label="สืบค้นบันทึกการใช้สารทึบรังสี">
    <div class="xll-toolbar">
      <el-input class="xll-search" :model-value="filters.hn" size="small" clearable
        prefix-icon="Search" placeholder="ระบุ HN…" aria-label="ระบุ HN เพื่อสืบค้นบันทึกการใช้สารทึบรังสี"
        @input="setHn" @clear="clearScope" @keyup.enter="search" />
      <el-date-picker class="xll-date" :model-value="filters.dates" size="small" type="daterange"
        range-separator="ถึง" start-placeholder="Date Range" end-placeholder="Date Range"
        value-format="YYYY-MM-DD" format="DD/MM/YYYY" @update:model-value="setDates" />
      <el-button size="small" type="primary" :loading="loading" @click="search">Search</el-button>
    </div>
    <div class="xll-mode-strip" role="tablist" aria-label="ประเภทข้อมูลที่สืบค้น">
      <button type="button" role="tab" aria-selected="true" class="is-active">
        <span>ประวัติการใช้สารทึบ</span><strong>{{ counts.orders_with_record || 0 }}</strong>
      </button>
      <small>อ่านอย่างเดียว · ทุกเครื่องในหน่วยรังสี</small>
    </div>
  </section>

  <div v-if="!searched" class="xll-empty" role="status">
    <strong>โปรดระบุ HN / เลือกวันที่</strong>
    <span>หากต้องการค้นหาทุกช่วงเวลา ต้องระบุ HN ก่อน</span>
  </div>
  <div v-else-if="loading" class="xll-summary">กำลังโหลดรายการ…</div>
  <div v-else-if="errorMessage" class="xll-summary is-error">
    {{ errorMessage }} <el-button size="small" @click="load">ลองใหม่</el-button>
  </div>
  <template v-else>
    <div class="xll-summary">แสดง {{ rows.length }} Order จากทั้งหมด {{ page.total }} · ทุกเครื่อง · {{ scopeText() }}</div>
    <div v-if="rows.length && !counts.records" class="xll-note">
      ยังไม่พบบันทึกการใช้สารทึบในผลที่ค้นนี้ — ช่องว่างหมายถึง <strong>ยังไม่ได้บันทึก</strong> ไม่ได้แปลว่าไม่ได้ฉีด ·
      ถ้าทุกใบว่างทั้งที่รู้ว่ามีบันทึกแล้ว ให้ตรวจว่า Process worklist คืน item.contrast มาหรือยัง
    </div>
    <section class="xll-shell" aria-label="ผลการสืบค้นบันทึกการใช้สารทึบรังสี">
      <div class="xll-head" aria-hidden="true">
        <div></div><div>ผู้ป่วย</div><div>บริบท</div><div>รายการ</div><div>สารทึบ</div>
        <div>เครื่อง</div><div>เวลาสั่ง / Order No.</div><div>สถานะ</div>
      </div>
      <article v-for="order in rows" :key="orderKey(order)" class="xll-order" :class="{'is-open':isExpanded(order)}">
        <div class="xll-row" @click="toggleFromRow(order,$event)">
          <button class="xll-expand" type="button" :aria-expanded="isExpanded(order)"
            :aria-label="isExpanded(order)?'ย่อรายละเอียด':'ขยายรายละเอียด'" @click="toggle(order)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"></path></svg>
          </button>
          <div class="xll-patient">
            <strong class="xll-mono">{{ patientHn(order) }}</strong>
            <span>{{ patientName(order) }}</span>
            <small>{{ patientMeta(order) }}</small>
          </div>
          <div class="xll-context"><span v-if="sourceRoom(order)" class="xll-pill">{{ sourceRoom(order) }}</span></div>
          <div><strong>{{ itemCount(order) }}</strong><small> รายการ</small></div>
          <div><strong>{{ recordCount(order) }}</strong><small class="xll-count-sub">/{{ itemCount(order) }} บันทึกแล้ว</small></div>
          <div class="xll-sections"><span v-for="code in modalityCodes(order)" :key="code" class="xll-section">{{ code }}</span></div>
          <div class="xll-order-meta"><span class="xll-order-no">{{ text(order.order_number) }}</span><small class="xll-mono">{{ dateTime(order.requested_at) }}</small></div>
          <div><span class="xll-status" :class="statusClass(orderState(order))">{{ statusText(orderState(order)) }}</span></div>
        </div>
        <div v-if="isExpanded(order)" class="xll-detail">
          <div class="xll-item-head"><div>ลำดับ</div><div>Accession No.</div><div>รายการตรวจ</div><div>สารทึบ</div><div>เครื่อง</div><div>วันเวลาที่ใช้</div><div>สถานะ</div><div></div></div>
          <div v-for="(item,index) in items(order)" :key="itemKey(item,index)" class="xll-item-row">
            <div class="xll-mono">{{ index+1 }}</div>
            <div class="xll-mono">{{ text(item.accession_no) }}</div>
            <div><strong>{{ text(item.item_code) }}</strong> {{ text(item.item_name) }}</div>
            <div>
              <div v-if="contrastLabel(item)" class="xll-brand" :title="contrastTitle(item)">
                <strong>{{ contrastLabel(item) }}</strong>
                <small>{{ contrastDetail(item) }}</small>
                <span v-if="contrastAdverse(item)" class="xll-alert">มีอาการไม่พึงประสงค์</span>
              </div>
              <span v-else class="xll-none" :title="contrastTitle(item)">ยังไม่ได้บันทึก</span>
            </div>
            <div><span v-if="modalityCode(item)" class="xll-section" :title="modalityLabel(item)">{{ modalityCode(item) }}</span></div>
            <div class="xll-mono">{{ contrastUsedAt(item) }}</div>
            <div><span class="xll-status" :class="statusClass(itemState(item))">{{ statusText(itemState(item)) }}</span></div>
            <div><el-button size="small" type="primary" plain :disabled="!contrastLabel(item)"
              :title="contrastLabel(item)?'เปิดใบบันทึกการใช้สารทึบรังสีของรายการนี้':'ยังไม่ได้บันทึกของรายการนี้'"
              @click="openRecord(order,item)">ดูบันทึก</el-button></div>
          </div>
          <div v-if="!items(order).length" class="xll-detail-empty">ไม่มีรายการตรวจใน Order นี้</div>
        </div>
      </article>
      <div v-if="!rows.length" class="xll-empty"><strong>ไม่พบข้อมูลตาม HN หรือช่วงวันที่ที่ระบุ</strong></div>
    </section>
    <div v-if="page.total>page.size" class="xll-pagination">
      <el-pagination small background layout="total, sizes, prev, pager, next"
        :current-page="page.current" :page-size="page.size" :page-sizes="[10,30,50,100]" :total="page.total"
        @current-change="setPage" @size-change="setPageSize" />
    </div>
  </template>
</div>`

widget.options.onCreated = `const s=this.vueState;
const field=this;
/* Process เดียวกับ X-ray CPOE Worklist — อ่านอย่างเดียว action 'list' เท่านั้น
   หน้านี้ไม่มี action เขียนใด ๆ (ไม่มี cancel_order / dispatch / reject) */
const WORKLIST_PROCESS_ID='${worklistProcessId}';
/* ฟอร์ม "บันทึกการใช้สารทึบรังสี" ที่ปุ่ม "สารทึบ" ใน Worklist เปิดอยู่แล้ว
   ค่าว่าง = ปุ่มยังกดได้แต่บอกตรง ๆ ว่ายังไม่เชื่อม (decision X17 ห้ามปุ่มตาย) */
const CONTRAST_FORM_ID='${contrastFormId}';
s.rows=[];s.loading=false;s.errorMessage='';s.searched=false;
s.counts={orders_with_record:0,records:0};
s.filters={hn:'',dates:[]};s.page={current:1,size:30,total:0};
s.expanded={};s.loadSeq=0;
s.text=v=>{if(v==null)return '';if(typeof v==='object')return s.text(v.label||v.name||v.display_name||v.full_name||v.code||v.value||v._id||'');return String(v).trim();};
s.items=o=>o&&Array.isArray(o.items)?o.items:[];
s.itemKey=(i,index)=>s.text(i&&i.item_id)||s.text(i&&i._id)||String(index);
s.orderKey=o=>s.text(o&&o.row_key)||s.text(o&&o.order_id)||s.text(o&&o._id)||s.text(o&&o.order_number);
s.patientHn=o=>s.text(o&&o.patient&&o.patient.hn);
s.patientName=o=>{const p=(o&&o.patient)||{};const name=s.text(p.full_name||p.patient_name);return name||[s.text(p.prename),s.text(p.first_name||p.p_fname),s.text(p.last_name||p.p_lname)].filter(Boolean).join(' ');};
s.patientMeta=o=>{const p=(o&&o.patient)||{};return [s.text(p.gender_text),s.text(p.age_text||p.age)].filter(Boolean).join(' · ');};
s.sourceRoom=o=>s.text(o&&o.source_unit)||s.text(o&&o.visit&&o.visit.clinic)||s.text(o&&o.ordering_unit);
s.itemCount=o=>Number(o&&o.item_count)||s.items(o).length;
/* เครื่อง — ห้าม hard-code รายชื่อ อ่านจาก payload เท่านั้น (Xray_design.md §6.2) */
s.modalityLabel=i=>s.text(i&&i.modality&&(i.modality.label||i.modality.name))||s.text(i&&i.modality&&i.modality.code)||s.text(i&&i.modality);
s.modalityCode=i=>s.text(i&&i.modality&&i.modality.code)||s.modalityLabel(i);
s.modalityCodes=o=>{const out=[];s.items(o).forEach(i=>{const code=s.modalityCode(i);if(code&&out.indexOf(code)<0)out.push(code);});return out.length?out:['-'];};
/* สถานะ — ชุดเดียวกับ X-ray Worklist ไม่คิดคำใหม่ */
s.itemState=i=>{const x=s.text(i&&i.current_status).toLowerCase();if(['cancelled','rejected','returned','reversed'].indexOf(x)>=0)return 'cancelled';if(s.text(i&&i.resulted_at))return 'resulted';if(['resulted','completed'].indexOf(x)>=0)return 'resulted';if(['accepted','prepared','dispensed','dispatched','in_progress'].indexOf(x)>=0)return 'dispatched';return 'waiting';};
s.orderState=o=>{const states=s.items(o).map(s.itemState);if(!states.length)return 'waiting';if((o&&o.cancelled===true)||states.every(x=>x==='cancelled'))return 'cancelled';const live=states.filter(x=>x!=='cancelled');const resulted=live.filter(x=>x==='resulted').length;const dispatched=live.filter(x=>x==='dispatched').length;const waiting=live.filter(x=>x==='waiting').length;if(resulted&&!waiting&&resulted===live.length)return 'complete';if(resulted)return 'partial';if(dispatched)return 'dispatched';return 'waiting';};
s.statusText=v=>{const x=s.text(v);if(x==='complete')return 'ออกผลครบ';if(x==='partial')return 'ออกผลบางส่วน';if(x==='resulted')return 'ออกผลแล้ว';if(x==='dispatched')return 'ส่งเครื่องแล้ว';if(x==='cancelled')return 'ยกเลิก';return 'รอรับ';};
s.statusClass=v=>{const x=s.text(v);if(x==='complete'||x==='resulted')return 'is-complete';if(x==='partial')return 'is-partial';if(x==='dispatched')return 'is-received';if(x==='cancelled')return 'is-cancelled';return 'is-waiting';};
s.dateTime=v=>{const raw=s.text(v);if(!raw)return '';const d=new Date(raw);if(Number.isNaN(d.getTime()))return raw;return new Intl.DateTimeFormat('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Bangkok'}).format(d);};
/* ── สารทึบ ─────────────────────────────────────────────────────────────────
   อ่านจาก payload ของ Process เท่านั้น รับได้ทั้งทรงซ้อน item.contrast{...}
   และทรงแบน item.contrast_* เหมือนคอลัมน์ "สารทึบ" ใน Worklist
   🔴 ไม่มีข้อมูล = "ยังไม่ได้บันทึก" เท่านั้น ห้ามอ่านว่า "ไม่ได้ฉีด" */
s.contrastInfo=i=>(i&&typeof i.contrast==='object'&&i.contrast)||{};
s.list=v=>Array.isArray(v)?v.map(s.text).filter(Boolean).join(' · '):s.text(v);
s.contrastBrand=i=>s.text(s.contrastInfo(i).brand||s.contrastInfo(i).contrast_brand||s.contrastInfo(i).name)||s.text(i&&i.contrast_brand);
s.contrastVolume=i=>{const c=s.contrastInfo(i);const v=(c.volume_ml==null?(c.contrast_volume_ml==null?(i&&i.contrast_volume_ml):c.contrast_volume_ml):c.volume_ml);const n=s.text(v);return n?n+' mL':'';};
s.contrastTypes=i=>{const c=s.contrastInfo(i);return s.list(c.types||c.contrast_types||(i&&i.contrast_types));};
s.contrastRoutes=i=>{const c=s.contrastInfo(i);return s.list(c.routes||c.route_types||(i&&i.route_types));};
s.contrastUsedAtRaw=i=>{const c=s.contrastInfo(i);return s.text(c.used_at)||s.text(i&&i.contrast_used_at);};
s.contrastUsedAt=i=>s.dateTime(s.contrastUsedAtRaw(i));
s.contrastRecordedBy=i=>{const c=s.contrastInfo(i);return s.text(c.recorded_by)||s.text(i&&i.contrast_recorded_by);};
s.contrastRecordId=i=>{const c=s.contrastInfo(i);return s.text(c.record_id||c._id||c.id);};
s.contrastLabel=i=>[s.contrastBrand(i),s.contrastVolume(i)].filter(Boolean).join(' · ')||(s.contrastUsedAtRaw(i)?s.contrastTypes(i)||'บันทึกแล้ว':'');
s.contrastDetail=i=>[s.contrastTypes(i),s.contrastRoutes(i)].filter(Boolean).join(' · ');
s.contrastAdverse=i=>{const c=s.contrastInfo(i);const acute=c.acute_symptoms||(i&&i.contrast_acute_symptoms);const delay=c.delay_symptoms||(i&&i.contrast_delay_symptoms);const ex=s.text(c.extravasation||(i&&i.contrast_extravasation)).toLowerCase();return ex==='yes'||(Array.isArray(acute)&&acute.length>0)||(Array.isArray(delay)&&delay.length>0);};
s.hasRecord=i=>!!(s.contrastLabel(i)||s.contrastUsedAtRaw(i));
s.recordCount=o=>s.items(o).filter(s.hasRecord).length;
s.contrastTitle=i=>{const parts=[s.contrastTypes(i),s.contrastRoutes(i)?'วิธีใช้ '+s.contrastRoutes(i):'',s.contrastVolume(i),s.contrastUsedAtRaw(i)?'ใช้เมื่อ '+s.contrastUsedAt(i):'',s.contrastRecordedBy(i)?'ผู้บันทึก '+s.contrastRecordedBy(i):''].filter(Boolean);return parts.length?parts.join(' · '):'ยังไม่ได้บันทึกการใช้สารทึบของรายการนี้ (ไม่ได้แปลว่าไม่ได้ฉีด)';};
s.scopeText=()=>(s.filters.dates&&s.filters.dates.length===2)?'ช่วงวันที่ที่เลือก':'ทุกช่วงเวลา';
s.isExpanded=o=>!!s.expanded[s.orderKey(o)];
s.toggle=o=>{const key=s.orderKey(o);s.expanded={...s.expanded,[key]:!s.expanded[key]};};
s.toggleFromRow=(o,event)=>{const target=event&&event.target;if(target&&target.closest&&target.closest('button,a,input,.el-button'))return;s.toggle(o);};
s.setHn=v=>{s.filters={...s.filters,hn:s.text(v)};};
s.setDates=v=>{s.filters={...s.filters,dates:Array.isArray(v)?v:[]};};
s.clearScope=()=>{s.setHn('');if(!(s.filters.dates&&s.filters.dates.length===2)){s.searched=false;s.rows=[];s.page={...s.page,current:1,total:0};s.counts={orders_with_record:0,records:0};}};
s.extractProcess=out=>{const c=[out,out&&out.data,out&&out.data&&out.data.data,out&&out.reply&&out.reply.data];for(let i=0;i<c.length;i++){const x=c[i];if(x&&typeof x==='object'&&(typeof x.success==='boolean'||(x.data&&Array.isArray(x.data.orders))))return x;}return out||{};};
s.extractPayload=out=>{const p=s.extractProcess(out);const c=[p&&p.data,p,out&&out.data&&out.data.data,out&&out.data];for(let i=0;i<c.length;i++){if(c[i]&&Array.isArray(c[i].orders))return c[i];}return null;};
s.api=()=>field.globalUserState||((field.getFormRef&&field.getFormRef())||{}).userState;
s.processCall=(params)=>new Promise((resolve,reject)=>{const api=s.api();if(!api||typeof api.runProcess!=='function'){reject(new Error('ไม่พบ API Process connector'));return;}api.runProcess(WORKLIST_PROCESS_ID,params||{},out=>resolve(s.extractProcess(out)),error=>reject(error||new Error('เรียก API Process ไม่สำเร็จ')));});
s.unitCode=()=>{const state=field.globalUserState||{};const user=state.user||{};return s.text(user&&user.unit&&user.unit.code).toUpperCase();};
/* ขอบเขตที่ยอมรับ: HN แบบตรงตัว หรือ Date Range ครบสองฝั่ง (spec.md §5.1)
   ไม่ส่ง statuses = ทุกสถานะตามค่าเริ่มต้นของ Process */
s.params=(limit,page)=>{const hn=s.text(s.filters.hn);const p={action:'list',page:page||s.page.current,limit:limit||s.page.size,organization_code:s.unitCode()};if(hn)p.hn=hn;if(s.filters.dates&&s.filters.dates.length===2){p.date_from=s.filters.dates[0];p.date_to=s.filters.dates[1];}return p;};
s.call=(params,ok,fail)=>{if(!WORKLIST_PROCESS_ID){fail(new Error('ยังไม่ได้ตั้งค่า Process ID ของ xray-cpoe-worklist'));return;}s.processCall(params).then(p=>{if(p&&p.success===false){fail(new Error(p.message||'API ปฏิเสธคำขอ'));return;}const payload=s.extractPayload(p);if(!payload){fail(new Error('รูปแบบ response ไม่ตรงกับ X-ray worklist contract'));return;}ok(payload);}).catch(error=>fail(error||new Error('เรียก API ไม่สำเร็จ')));};
s.refreshCounts=()=>{let orders=0;let records=0;s.rows.forEach(o=>{const n=s.recordCount(o);records+=n;if(n)orders+=1;});s.counts={orders_with_record:orders,records:records};};
s.load=()=>{if(!s.searched){s.rows=[];s.loading=false;s.errorMessage='';s.page={...s.page,total:0};s.counts={orders_with_record:0,records:0};return;}const seq=++s.loadSeq;s.loading=true;s.errorMessage='';s.call(s.params(),payload=>{if(seq!==s.loadSeq)return;s.rows=Array.isArray(payload.orders)?payload.orders:[];s.page={...s.page,current:Number(payload.page||s.page.current),size:Number(payload.limit||s.page.size),total:Number(payload.total||0)};s.expanded=Object.fromEntries(s.rows.map(o=>[s.orderKey(o),true]));s.refreshCounts();s.loading=false;},error=>{if(seq!==s.loadSeq)return;s.rows=[];s.page={...s.page,total:0};s.counts={orders_with_record:0,records:0};s.errorMessage=s.text(error&&error.message)||'โหลดรายการไม่สำเร็จ';s.loading=false;});};
s.search=()=>{const hn=s.text(s.filters.hn);const hasDates=Array.isArray(s.filters.dates)&&s.filters.dates.length===2;if(!hn&&!hasDates){s.searched=false;s.rows=[];s.counts={orders_with_record:0,records:0};s.page={...s.page,current:1,total:0};s.errorMessage='';field.notify('โปรดระบุ HN หรือเลือกช่วงวันที่','warning',3200);return;}s.searched=true;s.page={...s.page,current:1};s.load();};
s.setPage=v=>{s.page={...s.page,current:Number(v)||1};s.load();};
s.setPageSize=v=>{s.page={...s.page,size:Number(v)||30,current:1};s.load();};
/* เปิดใบบันทึกด้วยฟอร์มเดียวกับปุ่ม "สารทึบ" ของ Worklist — ส่งตัวระบุรายการทาง initData
   ถ้า payload มีรหัสแถวของใบบันทึกมาด้วย ส่งเป็น dataId เพื่อเปิดใบเดิม
   ไม่มีรหัส = ทรงเดียวกับปุ่มเดิมทุกประการ */
s.openRecord=(order,item)=>{
  if(!CONTRAST_FORM_ID){field.notify('ยังไม่ได้เชื่อมฟอร์มบันทึกการใช้สารทึบรังสี — ตั้ง XRAY_CONTRAST_FORM_ID ตอน generate','warning',6000);return;}
  const form=field.getFormRef&&field.getFormRef();
  if(!form||typeof form.openForm!=='function'){field.notify('ไม่พบตัวเปิดฟอร์มบันทึกการใช้สารทึบรังสี','error',3000);return;}
  form.openForm(CONTRAST_FORM_ID,s.contrastRecordId(item),'',{
    hn:s.patientHn(order),
    patient_name:s.patientName(order),
    item_id:s.text(item&&item.item_id)||s.text(item&&item._id),
    accession_no:s.text(item&&item.accession_no),
    order_id:s.text(order&&order.order_id),
    order_no:s.text(order&&order.order_number),
    visit_id:s.text(order&&order.visit_id)||s.text(order&&order.visit&&order.visit._id),
    modality:s.modalityCode(item),
    item_code:s.text(item&&item.item_code),
    item_name:s.text(item&&item.item_name)
  },{backdrop:false,popupType:'dialog',params:Object.assign({},form.formParams||{},{source:'xray-contrast-history',service_type:'xray'})});
};`
widget.options.onMounted = ''
widget.options.onUnmount = ''

/* ── ด่านกันพลาดก่อนเขียนไฟล์ ─────────────────────────────────────────────
   หน้านี้ต้อง read-only เสมอ · ถ้าวันหน้ามีใครเผลอเติม action เขียนลงไป ให้ล้มทันที */
const WRITE_ACTIONS = ['cancel_order', 'dispatch', 'reject', 'accept', 'queue_call', 'queue_done', 'save', 'update']
WRITE_ACTIONS.forEach(action => {
  if (widget.options.onCreated.includes("action:'" + action + "'")) {
    throw new Error('หน้าประวัติสารทึบต้องอ่านอย่างเดียว — พบ action ' + action)
  }
})
if (!widget.options.onCreated.includes("const WORKLIST_PROCESS_ID='" + worklistProcessId + "'")) {
  throw new Error('Process ID ไม่ตรงกับที่ฝังอยู่ใน onCreated')
}
if (!widget.options.content.includes('ยังไม่ได้บันทึก')) {
  throw new Error('ช่องสารทึบที่ว่างต้องอ่านว่า "ยังไม่ได้บันทึก" เสมอ ห้ามแปลว่าไม่ได้ฉีด')
}
if (widget.options.content.includes('Specimen') || widget.options.content.includes('specimen')) {
  throw new Error('X-ray ไม่มี specimen — ห้ามมีคอลัมน์นี้ (Xray_design.md กติกาข้อ 2)')
}
const optionKeys = Object.keys(widget.options).sort().join(',')
if (optionKeys !== 'columnSpan,content,customClass,hidden,label,name,onCreated,onMounted,onUnmount') {
  throw new Error('ชุด options ของ vue-ui ต้องครบตามแม่แบบ 9 ช่อง ห้ามเพิ่มหรือลด: ' + optionKeys)
}

fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, JSON.stringify(form, null, 2) + '\n')
console.log('wrote ' + path.relative(root, target))
