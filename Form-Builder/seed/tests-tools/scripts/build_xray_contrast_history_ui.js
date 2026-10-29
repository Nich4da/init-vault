/* build_xray_contrast_history_ui.js
 * สร้าง Form-Builder/SDForm/X-ray/xray-contrast-history-v1.json
 *   หน้า "ประวัติการใช้สารทึบรังสี" — ค้นด้วย HN แล้วเห็นเฉพาะ order ที่ "มีคนแนบ
 *   ใบบันทึกการใช้สารทึบไว้แล้ว" · อ่านอย่างเดียวล้วน ไม่มีปุ่มสั่งงานใด ๆ
 *
 * โครงไฟล์ (container + options ทุกช่อง) ก๊อปจากฟอร์ม LAB ที่ผ่าน validator แล้ว
 *   Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json
 * ตามกฎ 02-initcraft/governance/from-codex-backup/SDFORM_JSON_RULES.md
 * (SDFORM-RULES-OK-2026-08-25) — แก้เฉพาะค่าข้อมูล ไม่แตะค่า presentation
 *
 * ระบบภาพ: CSS ชุด .xr-* คัดลอกตรงจาก build_xray_cpoe_worklist_ui.js
 * (บล็อก `form.formConfig.cssCode` ของ .xray-cpoe) เปลี่ยนเฉพาะชื่อ root scope
 * เป็น .xray-contrast-history ⇒ หน้าตาเหมือน X-ray CPOE Worklist ทุกประการ
 *
 * ต่างจาก Worklist สองข้อ (ผู้ใช้สั่ง 2026-10-02 และ 2026-10-18):
 *   1. กรองเหลือเฉพาะใบที่มีบันทึกการใช้สารทึบอย่างน้อย 1 รายการ
 *   2. ไม่มีปุ่มสั่งงานและไม่มี chip กรองสถานะ — หน้านี้ไม่ได้มาดูผลหรือสถานะ
 *      ตัด checkbox เลือกรายการ · เวลาส่งเข้าเครื่อง · สถานะ · สติ๊กเกอร์ HN ·
 *      ส่งเข้าเครื่อง · ยกเลิก · ปฏิเสธ · ตรวจใหม่ · สร้างรายการใหม่ · หนังสือยินยอม
 *      แต่คง Radiographer/Radiologist เป็นข้อความอ่านอย่างเดียวตาม Worklist
 *
 * 🔴 ข้อจำกัดที่ต้องรู้ก่อนใช้งานจริง
 *   ข้อมูลสารทึบอ่านจาก payload ของ Process worklist (item.contrast หรือ item.contrast_*)
 *   ซึ่ง xray_cpoe_worklist_api.js ยังไม่ได้ join zdata_xray_contrast_media
 *   ⇒ จนกว่าฝั่ง API จะเพิ่มให้ หน้านี้จะไม่พบใบไหนเลย และบอกเหตุผลตรง ๆ ที่บรรทัดสรุป
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

form.formConfig.cssCode = `.xray-contrast-history{--primary:var(--el-color-primary,#409eff);--primary-50:var(--el-color-primary-light-9,#ecf5ff);--success:var(--el-color-success,#67c23a);--warning:var(--el-color-warning,#e6a23c);--danger:var(--el-color-danger,#f56c6c);--ink:var(--el-text-color-primary,#303133);--text:var(--el-text-color-regular,#606266);--muted:var(--el-text-color-secondary,#909399);--placeholder:var(--el-text-color-placeholder,#a8abb2);--border:var(--el-border-color,#dcdfe6);--border-light:var(--el-border-color-light,#e4e7ed);--border-lighter:var(--el-border-color-lighter,#ebeef5);--fill:var(--el-fill-color,#f0f2f5);--fill-light:var(--el-fill-color-light,#f5f7fa);--fill-lighter:var(--el-fill-color-lighter,#fafafa);--white:var(--el-bg-color,#fff);--xr-wait-bg:#fffbe6;--xr-wait-text:#8a6d00;--mono:"SFMono-Regular","Roboto Mono",Consolas,monospace;width:100%;padding:0 0 36px;background:var(--white);color:var(--text);font-family:"Leelawadee UI","Noto Sans Thai",Tahoma,"Segoe UI",sans-serif;font-size:13px;line-height:1.4}
.dark .xray-contrast-history{--xr-wait-bg:rgba(250,219,20,.14);--xr-wait-text:#ffe45c}
.xray-contrast-history *{box-sizing:border-box}
.xray-contrast-history .xr-toolbar{display:flex;flex-wrap:wrap;align-items:flex-start;gap:10px;margin-bottom:10px}
.xray-contrast-history .xr-toolbar>*{min-width:0}.xray-contrast-history .xr-toolbar .el-button+.el-button{margin-left:0}
.xray-contrast-history .xr-toolbar>.el-button,.xray-contrast-history .xr-toolbar>.el-dropdown{flex:0 0 auto}
.xray-contrast-history .xr-search-control{flex:1 1 230px;min-width:min(230px,100%);max-width:310px;width:100%}
.xray-contrast-history .xr-toolbar .xr-date-control{flex:1 1 250px;min-width:min(250px,100%);max-width:310px;width:100%!important}
.xray-contrast-history .xr-modality-field{display:flex;flex:0 1 auto;width:max-content;max-width:100%;align-items:center;gap:8px;min-width:min(220px,100%)}
.xray-contrast-history .xr-modality-label{flex:none;color:var(--muted);font-size:11px;font-weight:650}
.xray-contrast-history .xr-sort-field{display:flex;flex:0 1 auto;width:max-content;max-width:100%;align-items:center;gap:8px}
.xray-contrast-history .xr-sort-label{flex:none;color:var(--muted);font-size:11px;font-weight:650}
.xray-contrast-history .xr-sort-select{flex:0 1 auto;width:188px}
.xray-contrast-history .xr-modality-select{flex:0 1 auto;min-width:170px;max-width:calc(100% - 40px)}
/* ก่อนเลือกต้องจัด placeholder กึ่งกลางเหมือน el-select ปกติ (ของเดิมชิดบนจนดูเพี้ยน)
   เมื่อเลือกแล้วจึงยึด tag ไว้ด้านบน เพื่อให้กล่องสูงลงล่างอย่างเป็นระเบียบตอนขึ้นหลายแถว */
.xray-contrast-history .xr-modality-select .el-select__wrapper{min-height:30px;height:auto;align-items:center;padding-top:3px;padding-bottom:3px}
.xray-contrast-history .xr-modality-field.is-picked .el-select__wrapper{align-items:flex-start}
/* แสดงทุก code โดยไม่ยุบเป็น +N; เมื่อเลือกเกิน 3 ใช้ grid บังคับให้แท็กที่ 4 ขึ้นแถวใหม่
   input ค้นหาของ Element Plus เป็นลูกตัวสุดท้ายและกว้าง 126px: ปล่อยตาม auto จะดัน
   คอลัมน์แท็กให้ห่าง จึงจำกัดความกว้าง input และให้ใช้ช่องที่เหลือในแถวแท็ก */
.xray-contrast-history .xr-modality-select .el-select__selection,.xray-contrast-history .xr-modality-select .el-select__tags{flex-wrap:wrap;overflow:visible;row-gap:3px}
.xray-contrast-history .xr-modality-field.is-multirow .xr-modality-select .el-select__selection{display:grid!important;grid-template-columns:repeat(3,max-content)!important;grid-auto-flow:row;align-content:start;gap:3px 4px}
.xray-contrast-history .xr-modality-field.is-multirow .xr-modality-select .el-select__input-wrapper{grid-column:1/-1;min-width:0;max-width:100%;contain:inline-size}
.xray-contrast-history .xr-modality-field.is-multirow .xr-modality-select .el-select__input-wrapper:nth-child(3n+2){grid-column:2/-1}
.xray-contrast-history .xr-modality-field.is-multirow .xr-modality-select .el-select__input-wrapper:nth-child(3n){grid-column:3}
.xray-contrast-history .xr-modality-field.is-multirow .xr-modality-select .el-select__input{max-width:100%}
/* สีของ tag ที่เลือกแล้ว (ผู้ใช้ขอ 2026-09-11: "เปลี่ยนสี textbox และสี text ให้มองเห็นชัด")
   ใช้ชุดสีเดียวกับป้ายคลินิกต้นทางในตาราง จะได้ไม่มีสีที่ 4 โผล่มาในหน้าเดียว */
.xray-contrast-history .xr-modality-select .el-tag{max-width:none;flex:none;border-color:#a0cfff;background:#ecf5ff;color:#337ecc;font-weight:700}
.xray-contrast-history .xr-modality-select .el-tag .el-tag__content{white-space:nowrap}
.xray-contrast-history .xr-modality-select .el-tag .el-tag__close{color:#337ecc}
.xray-contrast-history .xr-modality-select .el-tag .el-tag__close:hover{background:#337ecc;color:var(--white)}
/* สีอยู่เฉพาะ tag ใน textbox เท่านั้น — ตัวกล่อง, label และพื้นหลังรายการใน dropdown
   ใช้ขาว/เทาตาม Element Plus เดิม เพื่อไม่ให้ทั้ง control ดูเหมือนถูกเลือกค้าง */
/* ปุ่มหลักอยู่ระดับเดียวกับตัวกรอง; หนังสือยินยอมอยู่แถวถัดไปใต้ปุ่มนัด
   toolbar ห่อทั้งกลุ่มลงแถวใหม่เมื่อพื้นที่ไม่พอ จึงไม่ชน Report/ตัวกรอง */
.xray-contrast-history .xr-create-group{display:grid;grid-template-columns:max-content max-content;grid-template-rows:auto auto;align-items:start;gap:5px 8px;flex:0 0 auto;margin-left:auto;max-width:100%}
.xray-contrast-history .xr-create-group .el-button+.el-button{margin-left:0}
.xray-contrast-history .xr-create-button{grid-column:1;grid-row:1}
.xray-contrast-history .xr-consent-button{grid-column:2;grid-row:1;margin-left:0}
.xray-contrast-history .xr-create-notice{position:fixed;top:12px;left:50%;z-index:3200;display:flex;align-items:center;gap:12px;max-width:calc(100vw - 24px);padding:7px 10px 7px 13px;transform:translateX(-50%);border:0;border-radius:6px;background:rgba(245,108,108,.2);color:#a83b43;font-size:13px;line-height:1.4;text-align:left}
.xray-contrast-history .xr-create-notice span{overflow-wrap:anywhere}
.xray-contrast-history .xr-create-notice button{flex:none;border:0;background:transparent;color:inherit;font:inherit;font-size:18px;line-height:1;cursor:pointer}
.xray-contrast-history .xr-create-notice button:focus-visible{outline:2px solid #fff;outline-offset:2px}
.xray-contrast-history .xr-dropdown-caret{margin-left:5px;color:var(--muted);font-size:12px}
.xray-contrast-history-test-popper .xr-test-pop-line{line-height:1.5;white-space:nowrap}
.xray-contrast-history-dx-popper{max-width:420px}
.xray-contrast-history-dx-popper .xr-dx-pop{line-height:1.5;white-space:normal;overflow-wrap:anywhere}
.xray-contrast-history-modality-popper .xr-opt-label{margin-right:16px}
.xray-contrast-history-modality-popper .xr-opt-count{float:right;color:var(--el-text-color-secondary,#909399);font-family:"SFMono-Regular","Roboto Mono",Consolas,monospace;font-size:11px;font-variant-numeric:tabular-nums}
/* แถบโหมดสแกน — ลอกทรงจาก LAB ที่ใช้งานจริงแล้ว */
.xray-contrast-history .xr-scan-context{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:0 0 10px;padding:8px 10px;border:1px solid #a0cfff;border-radius:6px;background:#ecf5ff;color:#337ecc}
.xray-contrast-history .xr-scan-context-label{font-size:11px;font-weight:700}
.xray-contrast-history .xr-scan-context strong{color:var(--ink);font-size:14px}
.xray-contrast-history .xr-scan-context>span:not(.xr-scan-context-label){font-size:11px}
.xray-contrast-history .xr-scan-context .el-button{margin-left:auto}
.xray-contrast-history .xr-status-strip{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.xray-contrast-history .xr-status-chip{--chip-color:var(--primary);--chip-border:var(--primary);display:flex;align-items:baseline;gap:6px;padding:6px 12px;border:1px solid var(--border-light);border-radius:6px;background:var(--fill-light);color:var(--muted);font:inherit;cursor:pointer;transition:border-color .15s,background-color .15s;user-select:none}
.xray-contrast-history .xr-status-chip strong{color:var(--chip-color);font-size:18px;line-height:1}.xray-contrast-history .xr-status-chip span{font-size:12px}
.xray-contrast-history .xr-status-chip[data-status="waiting"]{--chip-color:#fadb14;--chip-border:#fadb14}.xray-contrast-history .xr-status-chip[data-status="pending"]{--chip-color:#e6a23c;--chip-border:#e6a23c}.xray-contrast-history .xr-status-chip[data-status="complete"]{--chip-color:var(--success);--chip-border:var(--success)}.xray-contrast-history .xr-status-chip[data-status="cancelled"]{--chip-color:var(--danger);--chip-border:var(--danger)}
.xray-contrast-history .xr-status-chip:hover,.xray-contrast-history .xr-status-chip.is-active{border-color:var(--chip-border)}.xray-contrast-history .xr-status-chip.is-active{background:var(--fill)}
.xray-contrast-history .xr-status-legend{display:flex;align-items:center;gap:16px;margin-left:auto;padding:5px 10px;border:1px solid var(--border-light);border-radius:6px;background:var(--white);color:var(--text);font-size:11px;white-space:nowrap}
.xray-contrast-history .xr-status-legend-item{display:inline-flex;align-items:center;gap:6px}
.xray-contrast-history .xr-status-legend-dot{width:10px;height:10px;flex:none;border-radius:50%}
.xray-contrast-history .xr-status-legend-dot.is-waiting{background:#fadb14}.xray-contrast-history .xr-status-legend-dot.is-pending{background:#e6a23c}.xray-contrast-history .xr-status-legend-dot.is-resulted{background:#67c23a}.xray-contrast-history .xr-status-legend-dot.is-cancelled{background:#f56c6c}
.xray-contrast-history .xr-notice{margin:0 0 8px;padding:8px 11px;border:1px solid var(--border-light);border-radius:6px;background:var(--fill-light);color:var(--text);font-size:12px}
.xray-contrast-history .xr-notice.is-warning{border-color:#f3d19e;background:#fdf6ec;color:#b88230}
.xray-contrast-history .xr-list-summary{margin:0 0 8px;color:var(--muted);font-size:12px}.xray-contrast-history .xr-list-summary.is-error{color:var(--danger)}
.xray-contrast-history .xr-worklist-shell{overflow-x:auto;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.xray-contrast-history .xr-worklist{min-width:1055px;background:var(--white)}
/* Worklist เดิม 9 tracks; หน้านี้ตัดเฉพาะสถานะ 108px ออก จึงเหลือ 8 tracks เดิมตามลำดับ */
.xray-contrast-history .xr-list-head,.xray-contrast-history .xr-patient-row{display:grid;grid-template-columns:30px minmax(165px,1.3fr) minmax(142px,1fr) 92px 94px 126px minmax(110px,.95fr) 196px;gap:10px;align-items:center;padding:10px 12px}
.xray-contrast-history .xr-list-head{color:var(--muted);font-size:11px;font-weight:650;border-bottom:1px solid var(--border);letter-spacing:.02em}
.xray-contrast-history .xr-patient-block{position:relative;border-bottom:1px solid var(--border-lighter);content-visibility:auto;contain-intrinsic-size:84px}.xray-contrast-history .xr-patient-block:last-child{border-bottom:0}
.xray-contrast-history .xr-patient-row{min-height:84px;background:var(--white);cursor:pointer;transition:background-color .15s}.xray-contrast-history .xr-patient-row:hover{background:var(--fill-light)}.xray-contrast-history .xr-patient-block.is-open>.xr-patient-row{background:var(--fill)}
.xray-contrast-history .xr-expand-button{display:grid;width:28px;height:30px;place-items:center;padding:0;border:0;border-radius:4px;background:transparent;color:var(--muted);cursor:pointer}.xray-contrast-history .xr-expand-button:hover{background:var(--fill-light);color:var(--primary)}.xray-contrast-history .xr-expand-button svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;transition:transform .16s}.xray-contrast-history .xr-patient-block.is-open .xr-expand-button svg{transform:rotate(90deg)}
.xray-contrast-history .xr-patient-summary,.xray-contrast-history .xr-context-tags,.xray-contrast-history .xr-metric,.xray-contrast-history .xr-doctor-cell{min-width:0}
.xray-contrast-history .xr-patient-hn{display:flex;align-items:center;gap:6px;min-width:0;color:var(--ink);font-weight:700}.xray-contrast-history .xr-patient-hn .xr-mono{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.xray-contrast-history .xr-patient-name{margin-top:1px;overflow:hidden;color:var(--ink);font-weight:650;text-overflow:ellipsis;white-space:nowrap}
.xray-contrast-history .xr-patient-demographic{display:flex;align-items:center;gap:6px;margin-top:1px;color:var(--muted);font-size:11px}
.xray-contrast-history .xr-inline-tag,.xray-contrast-history .xr-state-tag{display:inline-flex;min-height:20px;align-items:center;justify-content:center;padding:1px 6px;border:1px solid;border-radius:4px;font-size:10px;font-weight:650;white-space:nowrap}
.xray-contrast-history .xr-urgent-tag{min-height:18px;padding:0 5px;border-color:var(--el-color-danger-light-5,#fab6b6);background:var(--el-color-danger-light-9,#fef0f0);color:var(--danger);font-size:9px}
.xray-contrast-history .xr-meta-pill{min-height:21px;padding:1px 8px;border-color:#c8c9cc;border-radius:999px;background:var(--white);color:var(--text)}
.xray-contrast-history .xr-gender-pill{min-height:18px;padding:0 6px;border-color:#c8c9cc;border-radius:999px;background:var(--white);color:var(--text);font-size:9px}
.xray-contrast-history .xr-context-tags{overflow:hidden}
/* ป้ายเตือนแพ้ยา/COVID — ทรงเดียวกับป้ายอื่นในคอลัมน์นี้เป๊ะ ๆ (ผู้ใช้ขอ 2026-09-03 รอบสอง)
   ขนาด/ระยะ/มุมโค้งลอกจาก .xr-meta-pill ต่างกันแค่สีแดงเท่านั้น
   ไม่ใช้คลาส xr-meta-pill ตรง ๆ เพราะกฎ .xr-context-tags>.xr-meta-pill จะย้อมส้มทับ */
.xray-contrast-history .xr-alert-box{display:inline-flex;max-width:100%;min-height:21px;align-items:center;margin-bottom:4px;padding:1px 8px;overflow:hidden;border:1px solid #f56c6c;border-radius:999px;background:#fef0f0;color:#c45656;font-size:10px;font-weight:650;line-height:1.35;white-space:nowrap;cursor:default}
.xray-contrast-history .xr-alert-box>span{overflow:hidden;text-overflow:ellipsis}
.xray-contrast-history .xr-context-top{display:flex;align-items:center;gap:5px;flex-wrap:wrap;row-gap:4px;margin-bottom:4px}
.xray-contrast-history .xr-context-top .xr-source-pill{border-color:var(--el-color-primary-light-5,#a0cfff);background:var(--el-color-primary-light-9,#ecf5ff);color:var(--primary)}.xray-contrast-history .xr-context-top .xr-payment-pill{border-color:var(--el-color-success-light-5,#b3e19d);background:var(--el-color-success-light-9,#f0f9eb);color:var(--success)}.xray-contrast-history .xr-context-top .xr-coverage-pill{border-color:var(--el-color-warning-light-5,#f3d19e);background:var(--el-color-warning-light-9,#fdf6ec);color:var(--warning)}
.xray-contrast-history .xr-context-top .xr-payment-pill.is-unpaid{border-color:var(--el-color-danger-light-5,#fab6b6);background:var(--el-color-danger-light-9,#fef0f0);color:var(--danger)}
.xray-contrast-history .xr-field-value{display:block;min-width:0;overflow:hidden;color:var(--ink);font-size:12px;font-weight:650;text-overflow:ellipsis;white-space:nowrap}
.xray-contrast-history .xr-time-value{margin-top:3px;line-height:1.25}.xray-contrast-history .xr-time-value span{display:block}
.xray-contrast-history .xr-order-no-tag{display:inline-flex;max-width:100%;min-height:18px;align-items:center;padding:0 6px;overflow:hidden;border:1px solid var(--el-color-primary-light-5,#a0cfff);border-radius:999px;background:var(--el-color-primary-light-9,#ecf5ff);color:var(--primary);font-family:var(--mono);font-size:9px;text-overflow:ellipsis;white-space:nowrap}
.xray-contrast-history .xr-diagnosis-summary{display:block;margin-top:2px;overflow:hidden;color:var(--muted);font-size:10px;text-overflow:ellipsis;white-space:nowrap}
.xray-contrast-history .xr-test-cell .xr-field-value{display:block;overflow:hidden;color:var(--ink);text-overflow:ellipsis;white-space:nowrap}
.xray-contrast-history .xr-test-cell{position:relative}
/* ไม่มีเส้นใต้ — ผู้ใช้ขอเอาออก 2026-09-03 (tooltip ยังทำงานเหมือนเดิมทุกอย่าง) */
.xray-contrast-history .xr-test-count{display:inline-block;color:var(--ink);font-size:12px;font-weight:650;cursor:default}
/* เครื่องต้องไม่ชิดคอลัมน์เวลา — กันที่ด้านขวาไว้ 26px ส่วนคอลัมน์กว้างขึ้นชดเชย
   ทำให้ tag ยังมีเนื้อที่เท่าเดิม (130-26 = 104 เท่ากับของเดิม 118-14) */
.xray-contrast-history .xr-modality-cell,.xray-contrast-history .xr-item-modality{padding-right:26px}
.xray-contrast-history .xr-test-code{display:block;margin-top:1px;color:var(--muted);font-size:10px}
/* แสดงแค่ตัวย่อ (DX, CT) ชื่อเต็มดูได้ตอน hover — ผู้ใช้ขอ 2026-09-01
   สั้นแล้วจึงไม่ต้องตัดคำอีก และ 1 order มีได้หลายเครื่องจึงเรียงต่อกันแบบ wrap ได้ */
.xray-contrast-history .xr-modality-tag{display:inline-block;width:fit-content;max-width:100%;padding:3px 8px;border:1px solid var(--border);border-radius:5px;background:var(--fill);color:var(--text);font-family:var(--mono);font-size:11px;font-weight:650;line-height:1.35;white-space:nowrap;cursor:default}
.xray-contrast-history .xr-modality-cell{display:flex;flex-wrap:wrap;align-items:center;gap:4px}
.xray-contrast-history .xr-empty-cell{color:var(--placeholder)}
.xray-contrast-history .xr-row-status{display:inline-flex;min-height:22px;align-items:center;justify-content:center;justify-self:start;padding:1px 7px;border:1px solid;border-radius:4px;font-size:10px;font-weight:650;white-space:nowrap}
.xray-contrast-history .xr-st-waiting{border-color:#fadb14;background:var(--xr-wait-bg);color:var(--xr-wait-text)}
.xray-contrast-history .xr-st-dispatched,.xray-contrast-history .xr-st-partial{border-color:#e6a23c;background:#fdf6ec;color:#b88230}
.xray-contrast-history .xr-st-complete{border-color:#b3e19d;background:#f0f9eb;color:#529b2e}
.xray-contrast-history .xr-st-cancelled,.xray-contrast-history .xr-st-failed{border-color:#fab6b6;background:#fef0f0;color:#c45656}
/* คอลัมน์ "สถานะ" ระดับ order = เช็คลิสต์ 4 ช่องคงที่ (ผู้ใช้ขอ 2026-09-03)
   ป้ายรวมทั้งใบเดิม (xr-row-status) ยังคำนวณอยู่ แต่ย้ายไปเป็น title/aria-label
   ทุกช่องกว้างเท่ากันเสมอ ดอตจึงอยู่ตรงคอลัมน์เดียวกันทุกแถว เทียบด้วยตาได้ทันที
   ช่องที่ไม่มีรายการเว้นว่าง (ไม่มีขีด ไม่มีดอตจาง) ตามกติกา "ไม่มีค่า = ว่าง" */
.xray-contrast-history .xr-row-status-check{display:flex;align-items:center;justify-self:start;gap:4px;min-width:0}
.xray-contrast-history .xr-status-step{display:inline-flex;width:24px;align-items:center;gap:2px;cursor:default}
.xray-contrast-history .xr-status-dot{width:10px;height:10px;flex:none;border-radius:50%;background:transparent}
.xray-contrast-history .xr-status-count{font-size:10px;font-weight:650;line-height:1}
/* ขั้นที่ผ่านไปแล้วใช้เครื่องหมายถูกแทนตัวเลข — จุดยังอยู่ที่เดิม ความกว้างช่องไม่ขยับ
   สีเส้นถูกเป็นสีเข้มของขั้นนั้น อ่านออกบนจุดพาสเทลโดยไม่ต้องเพิ่มขนาด */
.xray-contrast-history .xr-status-check{width:11px;height:11px;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.xray-contrast-history .xr-status-step.is-on.xr-dot-waiting .xr-status-dot{background:#fadb14}
.xray-contrast-history .xr-status-step.is-on.xr-dot-waiting .xr-status-count{color:#8a6d00}
.xray-contrast-history .xr-status-step.is-done.xr-dot-waiting .xr-status-check{color:#8a6d00}
.xray-contrast-history .xr-status-step.is-on.xr-dot-dispatched .xr-status-dot{background:#e6a23c}
.xray-contrast-history .xr-status-step.is-on.xr-dot-dispatched .xr-status-count{color:#b88230}
.xray-contrast-history .xr-status-step.is-done.xr-dot-dispatched .xr-status-check{color:#b88230}
.xray-contrast-history .xr-status-step.is-on.xr-dot-resulted .xr-status-dot{background:#67c23a}
.xray-contrast-history .xr-status-step.is-on.xr-dot-resulted .xr-status-count{color:#3f7d22}
.xray-contrast-history .xr-status-step.is-done.xr-dot-resulted .xr-status-check{color:#3f7d22}
.xray-contrast-history .xr-status-step.is-on.xr-dot-cancelled .xr-status-dot{background:#fab6b6}
.xray-contrast-history .xr-status-step.is-on.xr-dot-cancelled .xr-status-count{color:#c45656}
.xray-contrast-history .xr-row-actions{display:flex;align-items:center;justify-content:flex-start;gap:6px;min-width:0}
.xray-contrast-history .xr-plain-action{margin:0!important;padding:5px 7px!important;flex:none;font-size:11px}
/* ปุ่มพิมพ์ผ่าน print-agent — สูงเท่าปุ่ม sd-report ข้าง ๆ และห้ามตัดคำ */
.xray-contrast-history .xr-hn-print{white-space:nowrap}
.xray-contrast-history .xr-detail-panel{padding:0 12px 14px 42px;border-top:1px solid var(--border-lighter);background:var(--fill-lighter)}
.xray-contrast-history .xr-detail-top{display:flex;min-height:42px;align-items:flex-end;gap:16px;border-bottom:1px solid var(--border-light)}
.xray-contrast-history .xr-detail-tab{height:42px;padding:0;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--muted);font:inherit;font-size:12px;font-weight:650;cursor:pointer}
.xray-contrast-history .xr-detail-tab.is-active{border-bottom-color:var(--primary);color:var(--primary)}.xray-contrast-history .xr-detail-tab:disabled{color:var(--placeholder);cursor:not-allowed}
.xray-contrast-history .xr-bulk-actions{display:flex;align-items:center;gap:6px;margin-left:auto;padding-bottom:6px}.xray-contrast-history .xr-bulk-actions .el-button+.el-button{margin-left:0}.xray-contrast-history .xr-dispatch-tooltip{display:inline-flex}
/* Clone layout ของ Worklist: คง gutter 42px ไว้ให้หัวสีฟ้าเริ่มตรงขอบเดิม แต่ไม่มี checkbox
   แล้วตัดเฉพาะเวลาส่งเข้าเครื่อง, สถานะ และสติ๊กเกอร์ HN ออกจาก tracks */
.xray-contrast-history .xr-item-grid-wrap{overflow-x:auto;margin-left:-42px;padding-top:0}
.xray-contrast-history .xr-item-grid{display:grid;grid-template-columns:42px 150px minmax(215px,1.9fr) 78px 150px 150px minmax(125px,1.1fr) minmax(105px,.9fr) 130px;gap:10px;align-items:center;min-width:1225px;padding:6px 0}
.xray-contrast-history .xr-item-gutter{align-self:stretch}
.xray-contrast-history .xr-item-head{min-height:44px;color:var(--ink);font-size:11px;font-weight:650;border-top:1px solid var(--el-color-primary-light-7,#c6e2ff);border-bottom:1px solid var(--el-color-primary-light-7,#c6e2ff);background:var(--primary-50)}
.xray-contrast-history .xr-item-row{min-height:52px;border-bottom:1px dashed var(--border-lighter);font-size:12px;transition:background-color .12s}.xray-contrast-history .xr-item-row:last-child{border-bottom:0}
/* คอลัมน์ "สารทึบ" clone จาก Worklist: ชิปเดียวในคอลัมน์เดิม กดเปิด record เดิม */
.xray-contrast-history .xr-item-contrast{display:flex;align-items:center;justify-content:flex-end;min-width:0}
.xray-contrast-history .xr-contrast-chip{display:inline-flex;max-width:100%;min-height:22px;align-items:center;padding:1px 8px;overflow:hidden;border:1px solid #b7ddc4;border-radius:4px;background:#eaf6ee;color:#3a8a56;font-family:inherit;font-size:10px;font-weight:650;line-height:1.5;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
.xray-contrast-history .xr-contrast-chip:hover{border-color:#8fcaa4;background:#dff0e6}
.xray-contrast-history .xr-test-name{color:var(--ink);font-weight:650}.xray-contrast-history .xr-test-code-inline{display:block;margin-top:1px;color:var(--muted);font-size:11px;font-weight:400}
.xray-contrast-history .xr-transport-note{display:block;margin-top:3px;color:#c45656;font-size:10px;font-weight:600}
/* ชิปสถานะที่ RIS แจ้งกลับ (เพิ่ม 2026-09-09) — อยู่ในช่อง Accession เดิม
   ไม่ได้เพิ่มคอลัมน์ ตาราง xr-item-grid จึงไม่ต้องแก้สัดส่วนใด ๆ */
.xray-contrast-history .xr-ris-chip{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:4px;font-family:var(--sans);font-size:10px;font-weight:700;line-height:1.5;white-space:nowrap;cursor:default}
.xray-contrast-history .xr-ris-a{background:#eef3fe;border:1px solid #bcd0f7;color:#3a67c4}
.xray-contrast-history .xr-ris-c{background:#eaf6ee;border:1px solid #b7ddc4;color:#3a8a56}
.xray-contrast-history .xr-item-row [data-label]:before{display:none}
/* ผู้ใช้ขอ 2026-09-11: แท็บผลอ่านใช้ pattern เดียวกับแท็บ order แต่ไม่มี checkbox
   ขยายพื้นตารางเข้า gutter ซ้าย 42px แล้วชดเชย padding เพื่อให้คอลัมน์ลำดับยังอยู่ตำแหน่งเดิม */
.xray-contrast-history .xr-result-list{padding-top:0;overflow-x:auto;margin-left:-42px}
.xray-contrast-history .xr-result-list-head,.xray-contrast-history .xr-result-list-row{display:grid;grid-template-columns:56px minmax(230px,2.6fr) 78px minmax(120px,1fr) 130px 120px 150px;gap:12px;align-items:center;min-width:998px;padding:6px 0 6px 42px}
.xray-contrast-history .xr-result-list-head{min-height:44px;border-top:1px solid var(--el-color-primary-light-7,#c6e2ff);border-bottom:1px solid var(--el-color-primary-light-7,#c6e2ff);background:var(--primary-50);color:var(--ink);font-size:11px;font-weight:650}
.xray-contrast-history .xr-result-list-row{min-height:52px;border-bottom:1px dashed var(--border-lighter)}
.xray-contrast-history .xr-result-action-group{display:flex;align-items:center;gap:6px}.xray-contrast-history .xr-result-action-group .el-button+.el-button{margin-left:0}
.xray-contrast-history .xr-empty{padding:34px 20px;text-align:center;color:var(--muted);line-height:1.7}.xray-contrast-history .xr-empty strong{color:var(--ink)}
.xray-contrast-history .xr-pagination{display:flex;justify-content:flex-end;padding-top:10px}
.xray-contrast-history .xr-mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
.xr-cancel-summary{display:grid;gap:6px;margin-bottom:14px;padding:13px 14px;border:1px solid #fab6b6;border-radius:6px;background:#fef0f0;color:#c45656}
.xr-cancel-summary strong{color:var(--el-text-color-primary,#303133)}
.xr-cancel-summary span{font-size:12px;line-height:1.5}
.xr-cancel-reason{display:block}
.xr-cancel-reason>span{display:block;margin-bottom:6px;color:var(--el-text-color-primary,#303133);font-weight:650}
.xr-cancel-reason b{color:var(--el-color-danger,#f56c6c)}
.xr-report-doc{display:grid;gap:14px;min-height:200px}
.xr-report-doc .xr-mode-badge{display:inline-flex;min-height:20px;align-items:center;padding:1px 8px;border:1px solid #c8c9cc;border-radius:999px;background:#f4f4f5;color:#73767a;font-size:10px;font-weight:650}
.xr-report-head{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;padding:13px 14px;border:1px solid var(--el-border-color-lighter,#ebeef5);border-radius:6px;background:var(--el-fill-color-light,#f5f7fa)}
.xr-report-head>div{min-width:0}
.xr-report-head span{display:block;margin-bottom:4px;color:var(--el-text-color-secondary,#909399);font-size:11px;font-weight:650}
.xr-report-head strong{display:block;overflow:hidden;color:var(--el-text-color-primary,#303133);text-overflow:ellipsis;white-space:nowrap}
.xr-report-head small{display:block;margin-top:2px;color:var(--el-text-color-secondary,#909399);font-size:10px}
.xr-report-section h3{margin:0 0 6px;color:var(--el-text-color-primary,#303133);font-size:13px;font-weight:700;letter-spacing:.015em}
.xr-report-body{margin:0;padding:12px 14px;border:1px solid var(--el-border-color-lighter,#ebeef5);border-radius:6px;background:var(--el-bg-color,#fff);color:var(--el-text-color-regular,#606266);font-size:13px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere}
.xr-report-pending{padding:14px;border:1px dashed #f3d19e;border-radius:6px;background:#fdf6ec;color:#b88230;font-size:12px;text-align:center}
.xr-report-certify{display:block}
.xr-report-certify>span{display:block;margin-bottom:6px;color:var(--el-text-color-primary,#303133);font-size:13px;font-weight:700}
.xr-report-certify small{display:block;margin-top:5px;color:var(--el-text-color-secondary,#909399);font-size:11px}
.xr-report-foot{display:flex;flex-wrap:wrap;align-items:center;gap:10px;color:var(--el-text-color-secondary,#909399);font-size:12px}
.xr-report-doc .xr-mono{font-family:"SFMono-Regular","Roboto Mono",Consolas,monospace;font-variant-numeric:tabular-nums}
@media(max-width:680px){.xray-contrast-history .xr-toolbar{gap:8px}.xray-contrast-history .xr-search-control,.xray-contrast-history .xr-toolbar .xr-date-control{flex-basis:100%;max-width:none}.xray-contrast-history .xr-modality-field{flex:1 1 100%;width:100%}.xray-contrast-history .xr-modality-select{flex:1 1 auto;width:100%!important}.xray-contrast-history .xr-sort-field{flex:1 1 100%;width:100%}.xray-contrast-history .xr-sort-select{flex:1 1 auto;width:100%}}
@media(max-width:480px){.xray-contrast-history .xr-modality-field.is-multirow .xr-modality-select .el-select__selection{grid-template-columns:repeat(2,max-content)!important}.xray-contrast-history .xr-modality-field.is-multirow .xr-modality-select .el-select__input-wrapper:nth-child(2n+1){grid-column:1/-1}.xray-contrast-history .xr-modality-field.is-multirow .xr-modality-select .el-select__input-wrapper:nth-child(2n){grid-column:2}}
@media(max-width:900px){.xray-contrast-history .xr-item-grid-wrap{overflow:visible;margin-left:0}.xray-contrast-history .xr-item-head{display:none}.xray-contrast-history .xr-item-grid.xr-item-row{display:grid;grid-template-columns:1fr 1fr;gap:0 14px;min-width:0;padding:10px 0}.xray-contrast-history .xr-item-row>div{display:grid;grid-template-columns:minmax(104px,.42fr) minmax(0,1fr);align-items:center;gap:8px;min-height:34px;padding:3px 0;border-bottom:1px dashed var(--border-lighter)}.xray-contrast-history .xr-item-row>div:before{display:block;content:attr(data-label);color:var(--muted);font-size:10px;font-weight:650}.xray-contrast-history .xr-item-row>div:last-child{border-bottom:0}.xray-contrast-history .xr-result-list{margin-left:0}.xray-contrast-history .xr-result-list-head,.xray-contrast-history .xr-result-list-row{min-width:956px;padding:6px 0}}
@media(max-width:680px){.xray-contrast-history .xr-status-strip{flex-wrap:nowrap;overflow-x:auto;padding-bottom:3px}.xray-contrast-history .xr-status-chip{flex:0 0 auto}.xray-contrast-history .xr-status-legend{flex:0 0 auto}.xray-contrast-history .xr-detail-panel{padding:0 8px 12px}.xray-contrast-history .xr-detail-top{align-items:flex-start;flex-wrap:wrap}.xray-contrast-history .xr-bulk-actions{width:100%;margin:0;padding-bottom:7px;flex-wrap:wrap}.xray-contrast-history .xr-item-grid.xr-item-row{grid-template-columns:1fr}.xray-contrast-history .xr-pagination{justify-content:flex-start;overflow-x:auto}.xr-report-head{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.xray-contrast-history *{scroll-behavior:auto!important;transition-duration:.001ms!important}}

/* ── ส่วนที่เพิ่มเฉพาะหน้านี้: โหมดอ่านอย่างเดียวและ rollup ระดับ order ─────── */
.xray-contrast-history .xr-readonly-hint{display:inline-flex;align-items:center;min-height:30px;margin-left:auto;padding:0 10px;border:1px dashed var(--border);border-radius:5px;color:var(--muted);font-size:11px;font-weight:600;white-space:nowrap}
.xray-contrast-history .xr-hidden-note{display:inline-flex;align-items:center;margin-left:8px;padding:1px 8px;border:1px solid var(--border-light);border-radius:999px;background:var(--fill-light);font-size:11px}
.xray-contrast-history .xr-contrast-rollup{display:inline-flex;align-items:center;min-height:22px;padding:1px 9px;border:1px solid #b7ddc4;border-radius:999px;background:#eaf6ee;color:#3a8a56;font-family:var(--mono);font-size:10px;font-weight:650;white-space:nowrap}
.xray-contrast-history .xr-contrast-adverse{display:inline-flex;align-items:center;min-height:20px;padding:0 6px;border:1px solid #fab6b6;border-radius:4px;background:#fef0f0;color:#c45656;font-size:10px;font-weight:650;white-space:nowrap}
/* 🔴 ไม่มีข้อมูล = "ยังไม่ได้บันทึก" เท่านั้น ห้ามอ่านว่า "ไม่ได้ฉีด" */
.xray-contrast-history .xr-contrast-none{color:var(--placeholder)}
.xray-contrast-history .xr-detail-top .xr-detail-tab.is-active{cursor:default}
@media(max-width:900px){.xray-contrast-history .xr-item-gutter{display:none!important}.xray-contrast-history .xr-item-grid{grid-template-columns:1fr 1fr;min-width:0}.xray-contrast-history .xr-readonly-hint{margin-left:0}}`

widget.options.content = `<div class="xray-contrast-history">
  <section aria-label="สืบค้นประวัติการใช้สารทึบรังสี">
    <div class="xr-toolbar">
      <el-input class="xr-search-control" :model-value="filters.hn" size="small" clearable
        prefix-icon="Search" placeholder="ระบุ HN…"
        title="ค้นด้วย HN แบบตรงตัว"
        aria-label="ระบุ HN เพื่อดูประวัติการใช้สารทึบรังสี"
        @input="setHn" @clear="clearScope" @keyup.enter="search" />

      <el-date-picker class="xr-date-control" :model-value="filters.dates" size="small" type="daterange"
        range-separator="ถึง" start-placeholder="Date Range" end-placeholder="Date Range"
        value-format="YYYY-MM-DD" format="DD/MM/YYYY" @update:model-value="setDates" />

      <el-button size="small" type="primary" :loading="loading" @click="search">Search</el-button>
      <span class="xr-readonly-hint">อ่านอย่างเดียว · ไม่มีปุ่มสั่งงานในหน้านี้</span>
    </div>
  </section>

  <div v-if="!searched" class="xr-empty" role="status">
    <strong>โปรดระบุ HN / เลือกวันที่</strong><br>
    หน้านี้แสดงเฉพาะ order ที่มีคนแนบใบบันทึกการใช้สารทึบไว้แล้ว · หากต้องการค้นหาทุกช่วงเวลา ต้องระบุ HN ก่อน
  </div>
  <div v-else-if="loading" class="xr-list-summary">กำลังโหลดรายการ…</div>
  <div v-else-if="errorMessage" class="xr-list-summary is-error">
    {{ errorMessage }} <el-button size="small" @click="load">ลองใหม่</el-button>
  </div>
  <template v-else>
    <div class="xr-list-summary">
      แสดง {{ visibleRows().length }} ใบที่มีบันทึกการใช้สารทึบ · {{ scopeText() }}
      <span v-if="hiddenCount()" class="xr-hidden-note">ซ่อน {{ hiddenCount() }} ใบที่ยังไม่มีบันทึก — ไม่ได้แปลว่าไม่ได้ฉีด</span>
    </div>

    <section class="xr-worklist-shell" aria-label="รายการ order ที่มีบันทึกการใช้สารทึบ">
      <div class="xr-worklist">
        <div class="xr-list-head" aria-hidden="true">
          <div></div><div>ผู้ป่วย</div><div></div><div>รายการตรวจ</div><div>เครื่อง</div>
          <div>เวลาสั่ง / Order No.</div><div>แพทย์ / Diagnosis</div><div>สารทึบ</div>
        </div>

        <article v-for="row in visibleRows()" :key="row.id" class="xr-patient-block"
          :class="{'is-open':isExpanded(row.id)}">
          <div class="xr-patient-row" @click="toggleFromRow(row,$event)">
            <button class="xr-expand-button" type="button"
              :aria-label="isExpanded(row.id)?'ย่อรายละเอียด':'ขยายรายละเอียด'"
              :aria-expanded="isExpanded(row.id)" @click="toggle(row.id)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"></path></svg>
            </button>

            <div class="xr-patient-summary">
              <div class="xr-patient-hn">
                <span class="xr-mono">{{ row.hn }}</span>
                <span v-if="row.urgent" class="xr-inline-tag xr-urgent-tag">{{ row.urgent_label }}</span>
              </div>
              <div class="xr-patient-name">{{ row.name }}</div>
              <div class="xr-patient-demographic">
                <span v-if="row.gender" class="xr-inline-tag xr-gender-pill">{{ row.gender }}</span>
                <span v-if="row.age">{{ row.age }}</span>
              </div>
            </div>

            <div class="xr-context-tags">
              <div v-if="row.alert_text" class="xr-alert-box" role="alert" :title="row.alert_full">
                <span>{{ row.alert_text }}</span>
              </div>
              <div class="xr-context-top">
                <span v-if="row.room" class="xr-inline-tag xr-meta-pill xr-source-pill">{{ row.room }}</span>
                <span v-if="row.show_payment_status" class="xr-inline-tag xr-meta-pill xr-payment-pill"
                  :class="{'is-unpaid':!row.finance_passed}">{{ row.finance_passed ? 'ชำระเงินแล้ว' : 'ยังไม่ได้ชำระเงิน' }}</span>
                <span v-if="row.coverage" class="xr-inline-tag xr-meta-pill xr-coverage-pill">{{ row.coverage }}</span>
              </div>
            </div>

            <div class="xr-metric xr-test-cell" data-label="รายการตรวจ">
              <el-tooltip placement="top" :disabled="!row.test_list.length" popper-class="xray-contrast-history-test-popper">
                <span class="xr-test-count">{{ row.test_summary }}</span>
                <template #content>
                  <div v-for="line in row.test_list" :key="line" class="xr-test-pop-line">{{ line }}</div>
                </template>
              </el-tooltip>
            </div>

            <div class="xr-metric xr-modality-cell" data-label="เครื่อง">
              <span v-for="m in row.modalities" :key="m.code" class="xr-modality-tag" :title="m.label">{{ m.code }}</span>
            </div>

            <div class="xr-metric xr-order-cell" data-label="เวลาสั่ง / Order No.">
              <span v-if="row.order_no" class="xr-order-no-tag">{{ row.order_no }}</span>
              <span class="xr-field-value xr-time-value xr-mono">
                <span>{{ row.ordered_date }}</span><span>{{ row.ordered_time }}</span>
              </span>
            </div>

            <div class="xr-doctor-cell" data-label="แพทย์">
              <span class="xr-field-value" :title="row.doctor">{{ row.doctor }}</span>
              <el-tooltip placement="top" :disabled="!row.dx_has" popper-class="xray-contrast-history-dx-popper">
                <span class="xr-diagnosis-summary">{{ row.dx_short }}</span>
                <template #content><div class="xr-dx-pop">{{ row.dx_full }}</div></template>
              </el-tooltip>
            </div>

            <!-- ช่องสุดท้ายของ Worklist เป็นปุ่มสั่งงาน — หน้านี้ไม่มีปุ่มใด ๆ
                 ใช้บอกแทนว่าใบนี้มีใบบันทึกสารทึบแนบอยู่กี่รายการ -->
            <div class="xr-row-actions">
              <span class="xr-contrast-rollup">สารทึบ {{ row.contrast_count }}/{{ row.item_count }}</span>
              <span v-if="row.adverse_count" class="xr-contrast-adverse"
                :title="'มีอาการไม่พึงประสงค์ ' + row.adverse_count + ' รายการ'">อาการ {{ row.adverse_count }}</span>
            </div>
          </div>

          <div v-if="isExpanded(row.id)" class="xr-detail-panel">
            <div class="xr-detail-top" role="tablist">
              <button class="xr-detail-tab is-active" type="button" role="tab" aria-selected="true">order</button>
            </div>
            <div class="xr-item-grid-wrap">
              <div class="xr-item-grid xr-item-head" aria-hidden="true">
                <div class="xr-item-gutter"></div>
                <div>Accession No.</div><div>รายการตรวจ</div><div>เครื่อง</div>
                <div>Radiographer</div><div>Radiologist</div><div>ปฏิเสธ</div><div>คนปฏิเสธ</div><div>สารทึบ</div>
              </div>
              <div v-for="item in row.items" :key="item.id" class="xr-item-grid xr-item-row">
                <div class="xr-item-gutter" aria-hidden="true"></div>
                <div data-label="Accession No." class="xr-mono">{{ item.accession_no }}</div>
                <div data-label="รายการตรวจ" class="xr-test-name">{{ item.name }}</div>
                <div data-label="เครื่อง" class="xr-item-modality">
                  <span v-if="item.modality" class="xr-modality-tag" :title="item.modality_label">{{ item.modality }}</span>
                </div>
                <div data-label="Radiographer">{{ item.radiographer }}</div>
                <div data-label="Radiologist">{{ item.radiologist }}</div>
                <div data-label="ปฏิเสธ">{{ item.reject_reason }}</div>
                <div data-label="คนปฏิเสธ">{{ item.rejected_by }}</div>
                <!-- 🔴 ไม่มีข้อมูล = "ยังไม่ได้บันทึก" เท่านั้น ห้ามอ่านว่า "ไม่ได้ฉีด" -->
                <div data-label="สารทึบ" class="xr-item-contrast">
                  <button v-if="item.has_record" type="button" class="xr-contrast-chip"
                    :title="item.contrast_title" @click="openRecord(row,item)">{{ item.contrast_label }}</button>
                  <span v-else class="xr-contrast-none" :title="item.contrast_title">ยังไม่ได้บันทึก</span>
                </div>
              </div>
            </div>
          </div>
        </article>

        <div v-if="!visibleRows().length" class="xr-empty">
          <strong>ไม่พบใบที่มีบันทึกการใช้สารทึบ</strong><br>
          หน้านี้แสดงเฉพาะ order ที่มีคนแนบใบบันทึกไว้แล้วอย่างน้อย 1 รายการ · ลองเปลี่ยน HN หรือช่วงวันที่
        </div>
      </div>
    </section>
  </template>
</div>`

widget.options.onCreated = `const s=this.vueState;
const field=this;
/* Process เดิมของ X-ray CPOE Worklist — เรียกเฉพาะ action 'list' (อ่านอย่างเดียว)
   ไม่มี action เขียนในหน้านี้ และไม่สร้าง Process ใหม่ */
const WORKLIST_PROCESS_ID='${worklistProcessId}';
/* ฟอร์มบันทึกการใช้สารทึบรังสีตัวเดียวกับที่ปุ่ม "สารทึบ" ใน Worklist เปิดอยู่
   ค่าว่าง = ปุ่มยังกดได้แต่บอกตรง ๆ ว่ายังไม่เชื่อม (decision X17 ห้ามปุ่มตาย) */
const CONTRAST_FORM_ID='${contrastFormId}';
s.rows=[];s.loading=false;s.errorMessage='';s.searched=false;
s.filters={hn:'',dates:[]};s.page={current:1,size:50,total:0};
s.expanded={};s.loadSeq=0;s.scopedCount=0;
s.text=v=>{if(v==null)return '';if(typeof v==='object')return s.text(v.label||v.name||v.display_name||v.full_name||v.code||v.value||v._id||'');return String(v).trim();};
s.items=o=>o&&Array.isArray(o.items)?o.items:[];
s.stripEmail=v=>String(v||'')
  .replace(/\\s*[\\(<\\[]?[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}[\\)>\\]]?\\s*/ig,' ')
  .replace(/\\(\\s*\\)|\\[\\s*\\]|<\\s*>/g,' ')
  .replace(/\\s{2,}/g,' ')
  .trim();
s.personName=v=>{if(!v)return '';if(typeof v==='object'){const parts=[s.text(v.prename||v.prefix||v.title),s.text(v.first_name||v.p_fname||v.firstname),s.text(v.last_name||v.p_lname||v.lastname)].filter(Boolean);if(parts.length>=2)return s.stripEmail(parts.join(' '));return s.stripEmail(s.text(v.display_name||v.full_name||v.name||v.label||v.username||''));}return s.stripEmail(v);};
s.patientName=o=>[s.text(o&&o.patient&&o.patient.prename),s.text(o&&o.patient&&o.patient.first_name),s.text(o&&o.patient&&o.patient.last_name)].filter(Boolean).join(' ');
s.coverageAbbrev=o=>{const raw=o&&o.finance&&o.finance.coverage;let list=[];if(Array.isArray(raw))list=raw;else if(typeof raw==='string'&&['[','{'].includes(raw.trim().charAt(0))){try{const parsed=JSON.parse(raw);list=Array.isArray(parsed)?parsed:[parsed];}catch(e){list=[raw];}}else if(raw!=null&&raw!=='')list=[raw];for(let index=0;index<list.length;index++){const item=list[index],main=item&&typeof item==='object'&&item.inscl_item_main;const code=s.text(main&&typeof main==='object'?(main.value||main.code||main.id):(item&&typeof item==='object'?(item.value||item.code||item.id):item));if(code)return code.toUpperCase()==='CASH'?'':code;}return '';};
s.requesterName=o=>{const r=(o&&o.requester)||{};return s.personName(r.cosign_user)||s.personName(r.visit_doctor);};
s.sourceRoom=o=>s.text(o&&o.visit&&(o.visit.clinic||o.visit.ward));
s.isPaid=o=>{const f=(o&&o.finance)||{};const total=Number(f.total_amount||0);return total>0&&Number(f.paid_amount||0)>=total;};
s.showPaymentStatus=o=>{const f=(o&&o.finance)||{};return Number(f.total_amount||0)>0||!!s.coverageAbbrev(o);};
s.isFinancePassed=o=>{const terminal=['cancelled','rejected','returned','reversed'];const passed=['ready','accepted','prepared','dispensed','dispatched','in_progress','resulted','completed'];const items=s.items(o);const active=items.filter(item=>!terminal.includes(s.text(item&&item.current_status).toLowerCase()));return active.length?active.every(item=>passed.includes(s.text(item&&item.current_status).toLowerCase())):s.isPaid(o);};
const PRIORITY_LABEL={'2':'ด่วน','3':'ด่วนที่สุด','4':'ด่วน OR','5':'ด่วน อุบัติเหตุ'};
s.priorityCode=o=>s.text(o&&o.priority).toLowerCase();
s.isUrgent=o=>{const p=s.priorityCode(o);return p.indexOf('urgent')>=0||p.indexOf('stat')>=0||p.indexOf('ด่วน')>=0||['2','3','4','5'].indexOf(p)>=0;};
s.urgentLabel=o=>{if(!s.isUrgent(o))return '';const p=s.priorityCode(o);if(PRIORITY_LABEL[p])return PRIORITY_LABEL[p];const raw=s.text(o&&o.priority);return raw.indexOf('ด่วน')>=0?raw:'เร่งด่วน';};
s.orderAgeText=o=>{const raw=o&&o.patient&&o.patient.age;if(raw==null||raw==='')return '';let year='',month='',day='';if(typeof raw==='object'){const value=(...keys)=>{for(let i=0;i<keys.length;i++){const candidate=raw[keys[i]];if(candidate!=null&&candidate!=='')return s.text(candidate);}return '';};year=value('year','years','y');month=value('month','months','m');day=value('day','days','d');}else{const value=s.text(raw).trim(),yearMatch=value.match(/(-?[0-9]+(?:[.][0-9]+)?)[ \\t]*(?:y|ปี)/i),monthMatch=value.match(/(-?[0-9]+(?:[.][0-9]+)?)[ \\t]*(?:m|เดือน)/i),dayMatch=value.match(/(-?[0-9]+(?:[.][0-9]+)?)[ \\t]*(?:d|วัน)/i);if(yearMatch||monthMatch||dayMatch){year=yearMatch?yearMatch[1]:'';month=monthMatch?monthMatch[1]:'';day=dayMatch?dayMatch[1]:'';}else if(/^-?[0-9]+(?:[.][0-9]+)?$/.test(value))year=value;}if(!year&&!month&&!day)return '';return year+' ปี '+month+' เดือน '+day+' วัน';};
s.diagnosisText=o=>s.text(o&&(o.diagnosis||(o.emr_context&&o.emr_context.diagnosis)));
s.alertList=o=>{const alerts=(o&&o.patient&&o.patient.alerts)||{},out=[];if(alerts.covid===true)out.push(s.text(alerts.covid_label)||'COVID');const allergies=Array.isArray(alerts.allergies)?alerts.allergies.map(s.text).filter(Boolean):[];if(allergies.length)out.push('แพ้ '+allergies.join(', '));return out;};
s.shorten=(v,limit)=>{const t=s.text(v);return t.length>limit?t.slice(0,limit-1)+'…':t;};
s.fmt=(v,opts)=>{const raw=s.text(v);if(!raw)return '';const d=new Date(raw);if(Number.isNaN(d.getTime()))return raw;return new Intl.DateTimeFormat('th-TH',Object.assign({timeZone:'Asia/Bangkok'},opts)).format(d);};
s.datePart=v=>s.fmt(v,{day:'2-digit',month:'2-digit',year:'2-digit'});
s.timePart=v=>s.fmt(v,{hour:'2-digit',minute:'2-digit',hour12:false});
s.compactDateTime=v=>{const raw=s.text(v);return raw?s.datePart(raw)+' '+s.timePart(raw):'';};
/* ── เครื่อง · สถานะ — ชุดเดียวกับ X-ray Worklist ไม่คิดคำใหม่ ───────────── */
s.modalityLabel=i=>s.text(i&&i.modality&&(i.modality.label||i.modality.name))||s.text(i&&i.modality&&i.modality.code)||s.text(i&&i.modality);
s.modalityCode=i=>s.text(i&&i.modality&&i.modality.code)||s.modalityLabel(i);
s.ORDER_LABEL={waiting:'รอรับ',dispatched:'รอผลตรวจ',partial:'รอผลตรวจ',complete:'ออกผลครบ',cancelled:'ยกเลิก'};
s.ORDER_CLASS={waiting:'xr-st-waiting',dispatched:'xr-st-dispatched',partial:'xr-st-partial',complete:'xr-st-complete',cancelled:'xr-st-cancelled'};
s.ITEM_LABEL={waiting:'รอรับ',dispatched:'ส่งเครื่องแล้ว',resulted:'ออกผลแล้ว',cancelled:'ยกเลิก'};
s.ITEM_CLASS={waiting:'xr-st-waiting',dispatched:'xr-st-dispatched',resulted:'xr-st-complete',cancelled:'xr-st-cancelled'};
s.itemState=i=>{const x=s.text(i&&i.current_status).toLowerCase();if(['cancelled','rejected','returned','reversed'].indexOf(x)>=0)return 'cancelled';if(s.text(i&&i.resulted_at))return 'resulted';if(['resulted','completed'].indexOf(x)>=0)return 'resulted';if(['accepted','prepared','dispensed','dispatched','in_progress'].indexOf(x)>=0)return 'dispatched';return 'waiting';};
s.orderState=o=>{const states=s.items(o).map(s.itemState);if(!states.length)return 'waiting';if((o&&o.cancelled===true)||states.every(x=>x==='cancelled'))return 'cancelled';const live=states.filter(x=>x!=='cancelled');const resulted=live.filter(x=>x==='resulted').length;const dispatched=live.filter(x=>x==='dispatched').length;const waiting=live.filter(x=>x==='waiting').length;if(resulted&&!waiting&&resulted===live.length)return 'complete';if(resulted)return 'partial';if(dispatched)return 'dispatched';return 'waiting';};
/* ── สารทึบ — อ่านจาก payload เท่านั้น รับทั้ง item.contrast{...} และ item.contrast_*
   เหมือนคอลัมน์ "สารทึบ" ของ Worklist · 🔴 ไม่มีข้อมูล = "ยังไม่ได้บันทึก" เท่านั้น
   ห้ามอ่านว่า "ไม่ได้ฉีด" ──────────────────────────────────────────────────── */
s.contrastInfo=i=>(i&&typeof i.contrast==='object'&&i.contrast)||{};
s.list=v=>Array.isArray(v)?v.map(s.text).filter(Boolean).join(' · '):s.text(v);
s.contrastBrand=i=>{const c=s.contrastInfo(i);return s.text(c.brand||c.contrast_brand||c.name)||s.text(i&&i.contrast_brand);};
s.contrastVolume=i=>{const c=s.contrastInfo(i);const v=(c.volume_ml==null?(c.contrast_volume_ml==null?(i&&i.contrast_volume_ml):c.contrast_volume_ml):c.volume_ml);const n=s.text(v);return n?n+' mL':'';};
s.contrastTypes=i=>{const c=s.contrastInfo(i);return s.list(c.types||c.contrast_types||(i&&i.contrast_types));};
s.contrastRoutes=i=>{const c=s.contrastInfo(i);return s.list(c.routes||c.route_types||(i&&i.route_types));};
s.contrastUsedAt=i=>{const c=s.contrastInfo(i);return s.text(c.used_at)||s.text(i&&i.contrast_used_at);};
s.contrastRecordedBy=i=>{const c=s.contrastInfo(i);return s.personName(c.recorded_by)||s.personName(i&&i.contrast_recorded_by);};
s.contrastRecordId=i=>{const c=s.contrastInfo(i);return s.text(c.record_id||c._id||c.id);};
s.contrastLabel=i=>[s.contrastBrand(i),s.contrastVolume(i)].filter(Boolean).join(' · ');
s.contrastAdverse=i=>{const c=s.contrastInfo(i);const acute=c.acute_symptoms||(i&&i.contrast_acute_symptoms);const delay=c.delay_symptoms||(i&&i.contrast_delay_symptoms);const ex=s.text(c.extravasation||(i&&i.contrast_extravasation)).toLowerCase();return ex==='yes'||(Array.isArray(acute)&&acute.length>0)||(Array.isArray(delay)&&delay.length>0);};
s.hasRecord=i=>!!(s.contrastLabel(i)||s.contrastUsedAt(i)||s.contrastTypes(i)||s.contrastRecordId(i));
s.contrastTitle=i=>{const parts=[s.contrastTypes(i),s.contrastRoutes(i)?'วิธีใช้ '+s.contrastRoutes(i):'',s.contrastVolume(i),s.contrastUsedAt(i)?'ใช้เมื่อ '+s.compactDateTime(s.contrastUsedAt(i)):'',s.contrastRecordedBy(i)?'ผู้บันทึก '+s.contrastRecordedBy(i):''].filter(Boolean);return parts.length?parts.join(' · '):'ยังไม่ได้บันทึกการใช้สารทึบของรายการนี้ (ไม่ได้แปลว่าไม่ได้ฉีด)';};
/* ── แปลง payload เป็นแถว — ทรงเดียวกับ buildRow/buildItem ของ Worklist ───── */
s.buildItem=i=>{
  const state=s.itemState(i);
  const hasRecord=s.hasRecord(i);
  return {
    id:s.text(i&&i.item_id)||s.text(i&&i._id),
    raw:i,
    accession_no:s.text(i&&i.accession_no)||'–',
    name:s.text(i&&i.item_name),
    code:s.text(i&&i.item_code),
    modality:s.modalityCode(i),
    modality_label:s.modalityLabel(i),
    dispatched_text:s.compactDateTime(i&&i.dispatched_at)||'–',
    radiographer:s.text(i&&i.radiographer)||'–',
    radiologist:s.text(i&&i.radiologist)||'–',
    status_label:s.ITEM_LABEL[state]||'',
    status_class:s.ITEM_CLASS[state]||'xr-st-waiting',
    reject_reason:s.text(i&&(i.cancel_reason||i.reject_reason))||'–',
    rejected_by:s.personName(i&&(i.cancelled_by||i.rejected_by))||'–',
    has_record:hasRecord,
    contrast_label:s.contrastLabel(i)||s.contrastTypes(i)||'บันทึกแล้ว',
    contrast_sub:[s.contrastTypes(i),s.contrastRoutes(i),s.compactDateTime(s.contrastUsedAt(i))].filter(Boolean).join(' · '),
    contrast_title:s.contrastTitle(i),
    adverse:hasRecord&&s.contrastAdverse(i)
  };
};
s.buildRow=o=>{
  const raw=s.items(o);
  const items=raw.map(s.buildItem);
  const state=s.orderState(o);
  const p=(o&&o.patient)||{};
  const dx=s.diagnosisText(o);
  const modalities=[];
  items.forEach(i=>{if(i.modality&&!modalities.some(m=>m.code===i.modality))modalities.push({code:i.modality,label:i.modality_label});});
  return {
    id:s.text(o&&o.row_key)||s.text(o&&o.order_id)||s.text(o&&o._id)||s.text(o&&o.order_number),
    raw:o,
    hn:s.text(p.hn),
    name:s.patientName(o)||s.text(p.patient_name),
    gender:s.text(p.gender_text),
    age:s.orderAgeText(o),
    urgent:s.isUrgent(o),
    urgent_label:s.urgentLabel(o),
    room:s.sourceRoom(o),
    show_payment_status:s.showPaymentStatus(o),
    finance_passed:s.isFinancePassed(o),
    coverage:s.coverageAbbrev(o),
    alert_text:s.shorten(s.alertList(o).join(' · '),42),
    alert_full:s.alertList(o).join(' · '),
    item_count:items.length,
    test_count:items.length,
    test_summary:items.length?(items.length+' รายการ'):'',
    test_list:items.map(i=>i.name).filter(Boolean),
    modalities:modalities,
    order_no:s.text(o&&o.order_number),
    ordered_date:s.datePart(o&&o.requested_at),
    ordered_time:s.timePart(o&&o.requested_at),
    doctor:s.requesterName(o),
    dx_short:'Diagnosis: '+dx,
    dx_full:dx,
    dx_has:!!dx,
    status_label:s.ORDER_LABEL[state]||'',
    status_class:s.ORDER_CLASS[state]||'xr-st-waiting',
    items:items,
    contrast_count:items.filter(i=>i.has_record).length,
    adverse_count:items.filter(i=>i.adverse).length
  };
};
/* ── ตัวกรองของหน้านี้: เหลือเฉพาะใบที่มีใบบันทึกสารทึบแนบไว้แล้ว ─────────────
   ใบที่ยังไม่มีบันทึกถูกซ่อน แต่บอกจำนวนไว้ที่บรรทัดสรุป ไม่ให้เข้าใจว่าไม่มีใบอื่น */
s.visibleRows=()=>s.rows;
s.hiddenCount=()=>Math.max(0,s.scopedCount-s.rows.length);
s.scopeText=()=>(s.filters.dates&&s.filters.dates.length===2)?'ช่วงวันที่ที่เลือก':'ทุกช่วงเวลา';
s.isExpanded=id=>!!s.expanded[id];
s.toggle=id=>{s.expanded=Object.assign({},s.expanded,{[id]:!s.expanded[id]});};
s.toggleFromRow=(row,event)=>{const t=event&&event.target;if(t&&t.closest&&t.closest('button,a,input,.el-button,.el-select'))return;s.toggle(row.id);};
s.setHn=v=>{s.filters=Object.assign({},s.filters,{hn:s.text(v)});};
s.setDates=v=>{s.filters=Object.assign({},s.filters,{dates:Array.isArray(v)?v:[]});};
s.clearScope=()=>{s.setHn('');if(!(s.filters.dates&&s.filters.dates.length===2)){s.searched=false;s.rows=[];s.scopedCount=0;s.page=Object.assign({},s.page,{current:1,total:0});}};
s.extractProcess=out=>{const c=[out,out&&out.data,out&&out.data&&out.data.data,out&&out.reply&&out.reply.data];for(let i=0;i<c.length;i++){const x=c[i];if(x&&typeof x==='object'&&(typeof x.success==='boolean'||(x.data&&Array.isArray(x.data.orders))))return x;}return out||{};};
s.extractPayload=out=>{const p=s.extractProcess(out);const c=[p&&p.data,p,out&&out.data&&out.data.data,out&&out.data];for(let i=0;i<c.length;i++){if(c[i]&&Array.isArray(c[i].orders))return c[i];}return null;};
s.api=()=>field.globalUserState||((field.getFormRef&&field.getFormRef())||{}).userState;
s.processCall=params=>new Promise((resolve,reject)=>{const api=s.api();if(!api||typeof api.runProcess!=='function'){reject(new Error('ไม่พบ API Process connector'));return;}api.runProcess(WORKLIST_PROCESS_ID,params||{},out=>resolve(s.extractProcess(out)),error=>reject(error||new Error('เรียก API Process ไม่สำเร็จ')));});
s.unitCode=()=>{const state=field.globalUserState||{};const user=state.user||{};return s.text(user&&user.unit&&user.unit.code).toUpperCase();};
/* ขอบเขตที่ยอมรับ: HN แบบตรงตัว หรือ Date Range ครบสองฝั่ง (spec.md §5.1)
   ไม่ส่ง statuses = ทุกสถานะตามค่าเริ่มต้นของ Process */
s.params=()=>{const hn=s.text(s.filters.hn);const p={action:'list',page:s.page.current,limit:s.page.size,organization_code:s.unitCode()};if(hn)p.hn=hn;if(s.filters.dates&&s.filters.dates.length===2){p.date_from=s.filters.dates[0];p.date_to=s.filters.dates[1];}return p;};
s.call=(params,ok,fail)=>{if(!WORKLIST_PROCESS_ID){fail(new Error('ยังไม่ได้ตั้งค่า Process ID ของ xray-cpoe-worklist'));return;}s.processCall(params).then(p=>{if(p&&p.success===false){fail(new Error(p.message||'API ปฏิเสธคำขอ'));return;}const payload=s.extractPayload(p);if(!payload){fail(new Error('รูปแบบ response ไม่ตรงกับ X-ray worklist contract'));return;}ok(payload);}).catch(error=>fail(error||new Error('เรียก API ไม่สำเร็จ')));};
s.load=()=>{
  if(!s.searched){s.rows=[];s.scopedCount=0;s.loading=false;s.errorMessage='';s.page=Object.assign({},s.page,{total:0});return;}
  const seq=++s.loadSeq;s.loading=true;s.errorMessage='';
  s.call(s.params(),payload=>{
    if(seq!==s.loadSeq)return;
    const orders=Array.isArray(payload.orders)?payload.orders:[];
    const all=orders.map(s.buildRow);
    s.scopedCount=all.length;
    s.rows=all.filter(r=>r.contrast_count>0);
    s.page=Object.assign({},s.page,{current:Number(payload.page||s.page.current),size:Number(payload.limit||s.page.size),total:Number(payload.total||0)});
    s.expanded=Object.fromEntries(s.rows.map(r=>[r.id,true]));
    s.loading=false;
  },error=>{
    if(seq!==s.loadSeq)return;
    s.rows=[];s.scopedCount=0;s.page=Object.assign({},s.page,{total:0});
    s.errorMessage=s.text(error&&error.message)||'โหลดรายการไม่สำเร็จ';s.loading=false;
  });
};
s.search=()=>{const hn=s.text(s.filters.hn);const hasDates=Array.isArray(s.filters.dates)&&s.filters.dates.length===2;if(!hn&&!hasDates){s.searched=false;s.rows=[];s.scopedCount=0;s.page=Object.assign({},s.page,{current:1,total:0});s.errorMessage='';field.notify('โปรดระบุ HN หรือเลือกช่วงวันที่','warning',3200);return;}s.searched=true;s.page=Object.assign({},s.page,{current:1});s.load();};
/* เปิดใบบันทึกด้วยฟอร์มเดียวกับปุ่ม "สารทึบ" ของ Worklist — ตัวระบุรายการไปทาง initData
   ถ้า payload มีรหัสแถวของใบบันทึกมาด้วย ส่งเป็น dataId เพื่อเปิดใบเดิม
   ไม่มีรหัส = ทรงเดียวกับปุ่มเดิมทุกประการ */
s.openRecord=(row,item)=>{
  if(!CONTRAST_FORM_ID){field.notify('ยังไม่ได้เชื่อมฟอร์มบันทึกการใช้สารทึบรังสี — ตั้ง XRAY_CONTRAST_FORM_ID ตอน generate','warning',6000);return;}
  const form=field.getFormRef&&field.getFormRef();
  if(!form||typeof form.openForm!=='function'){field.notify('ไม่พบตัวเปิดฟอร์มบันทึกการใช้สารทึบรังสี','error',3000);return;}
  const o=row&&row.raw;
  form.openForm(CONTRAST_FORM_ID,s.contrastRecordId(item&&item.raw),'',{
    hn:row&&row.hn,
    patient_name:row&&row.name,
    patient_age:row&&row.age,
    item_id:item&&item.id,
    accession_no:s.text(item&&item.raw&&item.raw.accession_no),
    order_id:s.text(o&&o.order_id),
    order_no:row&&row.order_no,
    visit_id:s.text(o&&o.visit_id)||s.text(o&&o.visit&&o.visit._id),
    modality:item&&item.modality,
    item_code:item&&item.code,
    item_name:item&&item.name
  },{backdrop:false,popupType:'dialog',params:Object.assign({},form.formParams||{},{source:'xray-contrast-history',service_type:'xray'})});
};`
widget.options.onMounted = ''
widget.options.onUnmount = ''

/* ── ด่านกันพลาดก่อนเขียนไฟล์ ─────────────────────────────────────────────
   หน้านี้ต้อง read-only และต้องไม่มีตัวกรองสถานะ (ผู้ใช้สั่ง 2026-10-02) */
const WRITE_ACTIONS = ['cancel_order', 'dispatch', 'reject', 'accept', 'queue_call', 'queue_done', 'save', 'update']
WRITE_ACTIONS.forEach(action => {
  if (widget.options.onCreated.includes("action:'" + action + "'")) {
    throw new Error('หน้าประวัติสารทึบต้องอ่านอย่างเดียว — พบ action ' + action)
  }
})
/* คลาสของฝั่งเขียน/ตัวกรองสถานะ ห้ามโผล่เลยสักตัว */
const FORBIDDEN_CLASSES = ['xr-status-strip', 'xr-status-chip', 'xr-create-button', 'xr-consent-button',
  'xr-item-check-cell', 'xr-item-sticker-action', 'xr-bulk-actions', 'el-checkbox']
FORBIDDEN_CLASSES.forEach(token => {
  if (widget.options.content.includes(token)) {
    throw new Error('หน้านี้ต้องไม่มีปุ่มสั่งงานหรือ chip สถานะ — พบ ' + token)
  }
})
/* ข้อความบนปุ่มสั่งงาน — เทียบแบบ ">ข้อความ<" เพื่อไม่ชนกับหัวคอลัมน์
   เช่น "เวลาส่งเข้าเครื่อง" หรือประโยคอธิบายที่บอกว่าหน้านี้ไม่มีปุ่มพวกนั้น */
const FORBIDDEN_BUTTON_TEXT = ['ส่งเข้าเครื่อง', 'ยกเลิก order', 'ยกเลิกรายการที่เลือก', 'ตรวจใหม่',
  'สร้างรายการใหม่', 'หนังสือยินยอม', 'ปฏิเสธรายการ']
FORBIDDEN_BUTTON_TEXT.forEach(label => {
  if (widget.options.content.includes('>' + label + '<')) {
    throw new Error('หน้านี้ต้องไม่มีปุ่มสั่งงาน — พบปุ่ม ' + label)
  }
})
if (!widget.options.onCreated.includes("const WORKLIST_PROCESS_ID='" + worklistProcessId + "'")) {
  throw new Error('Process ID ไม่ตรงกับที่ฝังอยู่ใน onCreated')
}
if (!widget.options.onCreated.includes("r.contrast_count>0")) {
  throw new Error('ต้องกรองเหลือเฉพาะใบที่มีบันทึกการใช้สารทึบ')
}
if (!widget.options.content.includes('ยังไม่ได้บันทึก')) {
  throw new Error('ช่องสารทึบที่ว่างต้องอ่านว่า "ยังไม่ได้บันทึก" เสมอ ห้ามแปลว่าไม่ได้ฉีด')
}
if (/specimen/i.test(widget.options.content)) {
  throw new Error('X-ray ไม่มี specimen — ห้ามมีคอลัมน์นี้ (Xray_design.md กติกาข้อ 2)')
}
if (!form.formConfig.cssCode.startsWith('.xray-contrast-history{')) {
  throw new Error('CSS ต้อง scope ใต้ .xray-contrast-history ทั้งหมด ห้ามรั่วไปทับสไตล์ของ Worklist')
}
if (form.formConfig.cssCode.includes('.xray-cpoe')) {
  throw new Error('ห้ามเหลือ scope .xray-cpoe ของ Worklist อยู่ในฟอร์มนี้')
}
const optionKeys = Object.keys(widget.options).sort().join(',')
if (optionKeys !== 'columnSpan,content,customClass,hidden,label,name,onCreated,onMounted,onUnmount') {
  throw new Error('ชุด options ของ vue-ui ต้องครบตามแม่แบบ 9 ช่อง ห้ามเพิ่มหรือลด: ' + optionKeys)
}

fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, JSON.stringify(form, null, 2) + '\n')
console.log('wrote ' + path.relative(root, target))
