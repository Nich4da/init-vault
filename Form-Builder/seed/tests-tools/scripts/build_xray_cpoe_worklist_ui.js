/* build_xray_cpoe_worklist_ui.js
 * สร้าง Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json
 *
 * โครงไฟล์ (container + options ทุกช่อง) ก๊อปจากฟอร์ม LAB ที่ผ่าน validator แล้ว
 *   Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json
 * ตามกฎ 02-initcraft/governance/from-codex-backup/SDFORM_JSON_RULES.md
 * (SDFORM-RULES-OK-2026-08-25) — แก้เฉพาะค่าข้อมูล ไม่แตะค่า presentation
 *
 * รันใหม่ได้เสมอ:  node Form-Builder/seed/tests-tools/scripts/build_xray_cpoe_worklist_ui.js
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const templatePath = path.join(root, 'Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json')
const outPath = path.join(root, 'Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json')
const defaultOrderRequestReportId = '6a97f826422c1ca95982a048'
/* ปุ่ม HN ระดับ Order — เปลี่ยนเป็น "ป้ายติดแฟ้ม (HN)" ตามคำสั่งผู้ใช้ 2026-09-04
   ("ไอดี report 6a9a355c422c1ca95982a1a2 เอาไปเชื่อมกับปุ่ม PDF HN แทนของเดิมเลย xray อ่ะ")
   ของเดิม `5256d813009293b480d0a15c` (ป้ายติดแฟ้ม/VN) รับ `xparentx` = Visit ID
   ของใหม่รับ `hn` อย่างเดียว ⇒ ทั้ง ready() และ params() ต้องเปลี่ยนตามด้วย ไม่ใช่แค่เปลี่ยนเลข
   🔴 หน้า LAB ยังใช้ตัวเดิมอยู่ ไม่ถูกแตะในรอบนี้ (update_lab_cpoe_worklist_ui.js) */
const defaultHnOrderReportId = '6a9a355c422c1ca95982a1a2'
/* Report clone ที่มีอยู่จริงใน HIS; package rebind ชี้ Data Source ไป SQL clone จริง */
const defaultHnStickerReportId = '6a980831422c1ca95982a054'
const orderRequestReportId = String(
  process.env.XRAY_ORDER_REQUEST_REPORT_ID === undefined
    ? defaultOrderRequestReportId
    : process.env.XRAY_ORDER_REQUEST_REPORT_ID
).trim()
if (orderRequestReportId && !/^[a-f0-9]{24}$/i.test(orderRequestReportId)) {
  throw new Error('XRAY_ORDER_REQUEST_REPORT_ID must be the 24-character existing Report Factory ID')
}
const hnOrderReportId = String(
  process.env.XRAY_HN_ORDER_REPORT_ID === undefined
    ? defaultHnOrderReportId
    : process.env.XRAY_HN_ORDER_REPORT_ID
).trim()
if (hnOrderReportId && !/^[a-f0-9]{24}$/i.test(hnOrderReportId)) {
  throw new Error('XRAY_HN_ORDER_REPORT_ID must be the 24-character existing Report Factory ID')
}
const hnStickerReportId = String(
  process.env.XRAY_HN_STICKER_REPORT_ID === undefined
    ? defaultHnStickerReportId
    : process.env.XRAY_HN_STICKER_REPORT_ID
).trim()
if (hnStickerReportId && !/^[a-f0-9]{24}$/i.test(hnStickerReportId)) {
  throw new Error('XRAY_HN_STICKER_REPORT_ID must be the 24-character existing Report Factory ID')
}
/* ปุ่ม "สร้างรายการใหม่" เปิดฟอร์ม CPOE Order App ตัวไหน (ผู้ใช้ขอ 2026-09-03)

   🔴 แก้ค่าเริ่มต้น 2026-09-08 — ของเดิมชี้ CPOE ตัวจริง `6a927860422c1ca959829d26`
   ซึ่งต้องรับ patient context จากฟอร์มแม่ (EMR) เปิดจากหน้า X-ray ตรง ๆ จึงขึ้น
   "ไม่ได้รับ patient context — ฟอร์มแม่ต้องส่งมาทาง params ไม่ใช่ initData"
   โคลนที่มีช่องเลือก VN เองถูก import ไว้ตั้งแต่ 2026-09-04 แล้ว (ดู
   02-his/handoff/cpoe-order-app-vn-picker-v1-import.md) แต่ตอนนั้นต่อผ่าน env var
   ⇒ ทุกครั้งที่ generate ใหม่โดยไม่ตั้ง env ปุ่มก็เด้งกลับไปฟอร์มที่เปิดไม่ได้เงียบ ๆ
   ค่าเริ่มต้นจึงต้องเป็นโคลน ซึ่งเป็นตัวเดียวกับที่ LAB ใช้อยู่จริง
   จะกลับไปฟอร์มตัวจริงเมื่อไหร่ ให้ generate ใหม่พร้อม env:
     XRAY_CPOE_ORDER_APP_ID=6a927860422c1ca959829d26 \
       node Form-Builder/seed/tests-tools/scripts/build_xray_cpoe_worklist_ui.js
   ต้องเป็น Form ID 24 ตัวอักษรเสมอ — ปล่อยว่างแล้วปุ่มจะเปิดอะไรไม่ได้เลย จึงไม่ยอมให้ว่าง */
/* Process ID ของ xray-cpoe-worklist — วิดเจ็ตคิวเรียก Process ตัวเดียวกับตาราง
   ประกาศไว้ที่นี่เพื่อให้ทั้งสองฝั่งใช้ค่าเดียวกันเสมอ · มี assert ท้ายไฟล์กันค่าหลุดคนละตัว */
const worklistProcessId = '6a957009422c1ca959829e45'
/* แท็บสืบค้นผล LAB ในหน้า X-ray ใช้ Process เดียวกับ LAB Worklist โดยเปิด
   cross_section แบบ read-only เท่านั้น ไม่สร้าง API ซ้ำและไม่แตะ flow X-ray */
const labWorklistProcessId = '6a9434c3422c1ca959829d5e'
/* ปุ่ม "นัดล่วงหน้า" — 🔴 ถอดออกแล้ว 2026-09-26 ตามคำสั่งผู้ใช้
   ("เอาปุ่มนัดล่วงหน้าออกได้เลย ฉันเปลี่ยนแพลนว่าควรแยก module ดีกว่า
     เพราะในระบบนัดล่วงหน้ามีทุกอย่างครบแล้ว ... มีทั้งรายการนัด ตาราง schedule")

   ประวัติ: ผู้ใช้สั่งทำปุ่มไว้ 2026-09-08 แล้วเชื่อมเข้าจอ XR Staff Booking
   `6ab207459a834d51703fc158` เมื่อ 2026-09-23 · ตอนนี้ระบบนัดโตเป็นโมดูลของตัวเอง
   (sdform_manage มีฟอร์มตระกูล APPT/XR รวม 23 ตัว เช่น XR Staff Booking ·
   XR Nurse App `6ab62fa9469a0989e63a59d1` · APPT Nurse Console · APPT Slot Setting)
   ⇒ ไม่ต้องมีทางเข้าจากหน้า Worklist อีก

   🔴 ห้ามเติมปุ่มนี้กลับเองโดยไม่มีคำสั่งผู้ใช้ — มี assertion กันไว้ในเทสฟอร์มแล้ว
   ถ้าจะเอากลับ: กู้บล็อกนี้ ปุ่มใน `.xr-create-group` `s.openAppointment`
   `s.appointmentHint` `APPOINTMENT_FORM_ID` และกฎ CSS `.xr-appointment-button`
   จาก git history ของไฟล์นี้ (commit ก่อน 2026-09-26) */
/* The new UI Form record was created on 2026-09-17. Import its model before
 * replacing the worklist: otherwise the button would open an empty form.
 * The environment override can disable or redirect the button deliberately. */
const defaultConsentLibraryFormId = '6aab93911c5232627d0c6ee1'
const consentLibraryFormId = String(
  process.env.XRAY_CONSENT_LIBRARY_FORM_ID === undefined
    ? defaultConsentLibraryFormId
    : process.env.XRAY_CONSENT_LIBRARY_FORM_ID
).trim()
if (consentLibraryFormId && !/^[a-f0-9]{24}$/i.test(consentLibraryFormId)) {
  throw new Error('XRAY_CONSENT_LIBRARY_FORM_ID must be the 24-character Form ID of the document library')
}
/* ── ปุ่ม "สารทึบ" ระดับ item — ผู้ใช้เลือกตัวเลือก A 2026-09-23 ─────────────
   ("เพิ่มคอลัมผูกปุ่มของ xray ตามนี้หน่อย ห้ามกระทบ flow อื่นนะแค่เพิ่มมา")
   ฟอร์มบันทึกการใช้สารทึบรังสีสร้างไว้แล้วที่
     Form-Builder/SDForm/X-ray/xray-contrast-media-record-v1.json
   แต่ยังไม่ได้ import เข้า HIS จึงยังไม่มี Form ID จริง
   ⇒ ค่าว่างได้ (ทรงเดียวกับ XRAY_CONSENT_LIBRARY_FORM_ID) ปุ่มยังขึ้นทุกแถวและบอกเหตุผล
     ตรง ๆ ว่ายังไม่เชื่อม ไม่ซ่อนปุ่มและไม่กดแล้วเงียบ (decision X17 ห้ามปุ่มตาย)
   ชี้ไปฟอร์มอื่นหรือปิดปุ่มได้ตอน generate — อย่าลืม XRAY_RIS_VIEWER_ENABLED=1 ที่ JSON
   ปัจจุบันใช้อยู่ ไม่งั้นปุ่ม "ดูภาพ" จะถูกปิดกลับไปเงียบ ๆ:
     XRAY_CONTRAST_FORM_ID=<Form ID 24 ตัว> XRAY_RIS_VIEWER_ENABLED=1 \
       node Form-Builder/seed/tests-tools/scripts/build_xray_cpoe_worklist_ui.js */
/* Form ID จาก Form-Builder/SDForm/X-ray/spec.md §ตารางไอดี (import แล้ว)
   🔴 spec กำกับไว้ว่า "ยังไม่ยืนยันว่า Builder เรนเดอร์ครบ" — ตัวที่ import อยู่เก่ากว่า
      การแก้ checkbox 2026-09-10 ⇒ ปุ่มเปิดฟอร์มได้จริง แต่ต้อง import ทับด้วย JSON
      ปัจจุบันแล้วดู Builder อีกรอบก่อนใช้งานจริง
   ปิดปุ่มชั่วคราวได้โดยไม่ต้องแก้โค้ด: XRAY_CONTRAST_FORM_ID= (ค่าว่าง) */
const defaultContrastFormId = '6aa2424809c1bad08952da71'
const contrastFormId = String(
  process.env.XRAY_CONTRAST_FORM_ID === undefined
    ? defaultContrastFormId
    : process.env.XRAY_CONTRAST_FORM_ID
).trim()
if (contrastFormId && !/^[a-f0-9]{24}$/i.test(contrastFormId)) {
  throw new Error('XRAY_CONTRAST_FORM_ID must be the 24-character Form ID of the contrast media record form')
}
const defaultCpoeOrderAppId = '6a995d064744260ea8c9498c'
const cpoeOrderAppId = String(
  process.env.XRAY_CPOE_ORDER_APP_ID === undefined
    ? defaultCpoeOrderAppId
    : process.env.XRAY_CPOE_ORDER_APP_ID
).trim()
if (!/^[a-f0-9]{24}$/i.test(cpoeOrderAppId)) {
  throw new Error('XRAY_CPOE_ORDER_APP_ID must be the 24-character Form ID of the CPOE Order App')
}

/* ── ปุ่ม "ดูภาพ" → โปรแกรมดูภาพของ RIS (ผู้ใช้แจ้ง contract 2026-09-15) ──────
   ทีม RIS ยืนยัน 2026-09-15 ว่าเปิดได้ 2 level ด้วย base เดียวกัน:
     http://localhost:9090?QueryMode=AN&Value=<Accession Number>   ← ราย study
     http://localhost:9090?QueryMode=PID&Value=<Patient ID (HN)>   ← รายคนไข้
   🔴 localhost = เครื่องของผู้ใช้เอง ไม่ใช่เซิร์ฟเวอร์ HIS ⇒ ต้องเปิดจาก browser
      (window.open) เท่านั้น · ห้ามทำเป็น Process ฝั่ง server เพราะมันจะไปหา viewer
      บนเครื่อง HIS ซึ่งไม่มี ⇒ **ไม่ต้องเพิ่ม API ตัวใหม่** HN มีอยู่แล้วใน row.hn
      (มาจาก xray_cpoe_worklist_api.js → patient.hn ตัวเดียวกับที่ปุ่มพิมพ์ HN ใช้)
   ⚠️ ค่าเริ่มต้น "ปิด" เพราะ RIS ยังไม่เปิดลิงก์ให้ (2026-09-15) — เปิดปุ่มตอนนี้
      ผู้ใช้จะได้แท็บ ERR_CONNECTION_REFUSED ซึ่งแย่กว่าข้อความ "รอเชื่อมต่อ" และขัด
      decision X17 ที่ห้ามปุ่มตาย · ปิดอยู่ = พฤติกรรมเดิมทุกประการ
   วันที่ RIS เปิดลิงก์แล้ว generate ใหม่ด้วย (ไม่ต้องแก้โค้ดในนี้):
     XRAY_RIS_VIEWER_ENABLED=1 \
       node Form-Builder/seed/tests-tools/scripts/build_xray_cpoe_worklist_ui.js
   viewer อยู่ที่ server กลางแทน localhost ก็เปลี่ยน base ได้:
     XRAY_RIS_VIEWER_BASE=http://10.x.x.x:9090 XRAY_RIS_VIEWER_ENABLED=1 node ... */
const defaultRisViewerBase = 'http://localhost:9090'
const risViewerBase = String(
  process.env.XRAY_RIS_VIEWER_BASE === undefined
    ? defaultRisViewerBase
    : process.env.XRAY_RIS_VIEWER_BASE
).trim()
/* กันค่าที่ทำให้ JS ที่ generate ออกมาพัง (quote/backslash) และกันโปรโตคอลแปลก ๆ */
if (risViewerBase && !/^https?:\/\/[^\s'"\\]+$/i.test(risViewerBase)) {
  throw new Error('XRAY_RIS_VIEWER_BASE must be a plain http(s) URL, e.g. http://localhost:9090')
}
const risViewerEnabled = /^(1|true|yes|on)$/i.test(String(process.env.XRAY_RIS_VIEWER_ENABLED || '').trim())
if (risViewerEnabled && !risViewerBase) {
  throw new Error('XRAY_RIS_VIEWER_ENABLED needs XRAY_RIS_VIEWER_BASE (or the default) to point at the RIS viewer')
}

const orderRequestPdfAction = orderRequestReportId
  ? `<sd-report v-if="!row.cancelled&&orderReportReady(row)" class="xr-plain-action xr-order-report"
              :report-list="orderRequestReportList" :params="orderReportParams(row)" size="small" />
            <el-button v-else-if="!row.cancelled" class="xr-plain-action" size="small" disabled
              title="Order นี้ไม่มี Order ID หรือ Visit ID สำหรับสร้าง PDF">PDF</el-button>`
  : `<el-button v-if="!row.cancelled" class="xr-plain-action" size="small"
              @click="notifyPending('PDF ใบสั่งตรวจ')">PDF</el-button>`
/* 🔴 ไม่ถูก render แล้ว — ผู้ใช้สั่งเอาปุ่ม HN (sd-report เปิด PDF) ออกจากแถว Order
   2026-09-11 ("เอาปุ่มนี้ระดับ Order เราออกไปเลย") หลังได้ปุ่ม "พิมพ์ HN" ที่กดแล้วพิมพ์เลย
   เก็บนิยามไว้เฉย ๆ เอากลับมาได้ด้วยการใส่ ${hnOrderPdfAction} กลับในแถบปุ่มบรรทัดเดียว
   ⚠️ hnOrderReportId / hnOrderReportReady / hnOrderReportParams **ห้ามลบ** — ปุ่มพิมพ์ HN ใช้อยู่ */
const hnOrderPdfAction = hnOrderReportId
  ? `<sd-report v-if="!row.cancelled&&hnOrderReportReady(row)" class="xr-plain-action xr-order-report"
              :report-list="hnOrderReportList" :params="hnOrderReportParams(row)" size="small" />
            <el-button v-else-if="!row.cancelled" class="xr-plain-action" size="small" disabled
              title="Order นี้ไม่มี HN สำหรับสร้างป้ายติดแฟ้ม">HN</el-button>`
  : `<el-button v-if="!row.cancelled" class="xr-plain-action" size="small"
              @click="notifyPending('HN')">HN</el-button>`

/* ปุ่ม "พิมพ์ HN" — ยกมาจากฟอร์มที่ deploy อยู่จริง (x-ray-module.json ที่ผู้ใช้ส่งมา
   2026-09-11) ตามคำสั่ง "เอามาแค่ปุ่มนั้นปุ่มเดียว"
   ต่างจากปุ่ม HN ข้างซ้าย: ปุ่มนั้นเปิด PDF ให้ดู/สั่งพิมพ์เอง ส่วนปุ่มนี้ยิงตรงไปที่
   print agent บนเครื่องผู้ใช้ ⇒ ไม่มี dialog ของ browser คั่น
   🔴 ผูกกับ widget `local_agent` (local-agent-ui) ที่ระดับ root — ถ้าไม่มี ปุ่มจะเตือนแล้วจบ
   ไม่มีปุ่มพิมพ์ = ไม่มีค่าใช้ Report ⇒ ผูกกับ hnOrderReportId ตัวเดียวกับปุ่ม HN */
const hnPrintAction = hnOrderReportId
  ? `<el-button v-if="!row.cancelled" class="xr-plain-action xr-hn-print" size="small"
              type="primary" plain :loading="!!hnPrinting[row.id]"
              :disabled="!hnOrderReportReady(row)||!!hnPrinting[row.id]"
              :title="hnPrintHint(row)" @click="printHnLabel(row)">พิมพ์ HN</el-button>`
  : ''

const form = JSON.parse(fs.readFileSync(templatePath, 'utf8'))

const grid = form.fields[0]
if (!grid || grid.component !== 'grid') throw new Error('template grid not found')

/* เอาเฉพาะ container ที่ X-ray เป็นเจ้าของ — เราลอกโครงมาจากไฟล์ LAB ทั้งไฟล์
   ทุกอย่างที่ฝั่ง LAB เพิ่มเข้ามาที่ระดับ root จึงติดมาด้วยโดยไม่ตั้งใจ
   เกิดจริง 2026-09-02: widget `scan-code-ui` "Scan HN" ของ LAB (commit 83ae7b2)
   โผล่ในฟอร์ม X-ray โดยไม่มีใครสั่ง และไม่ได้ผูกกับ logic ของ X-ray เลย
   ถ้าวันหนึ่งอยากได้ Scan HN ในหน้า X-ray ต้องเพิ่มอย่างตั้งใจและผูก handler เอง */
form.fields = [grid]

/* วิดเจ็ตสแกนบาร์โค้ด HN ของ X-ray — ตั้งค่าเดียวกับ PIS/LAB ที่พิสูจน์แล้ว
   (document target, Enter suffix, ตัวเลขอย่างน้อย 6 หลัก) แต่ id/handler เป็นของ X-ray
   สร้างที่นี่อย่างตั้งใจ ไม่ใช่ปล่อยให้ติดมาจากไฟล์ LAB — ดู spec.md §5.5
   scan-code-ui อยู่ระดับ root ตามแบบ PIS · validator เตือนเรื่อง columnSpan เป็นปกติ */
const scanField = {
  key: 73905,
  name: 'Scan HN',
  component: 'scan-code-ui',
  category: 'display_ui',
  icon: 'scan-ui',
  fieldType: 'None',
  fieldLength: null,
  children: false,
  enable: true,
  formItemFlag: false,
  options: {
    name: 'scan_code',
    columnSpan: 4,
    hidden: false,
    disabled: false,
    preset: 'both',
    target: 'document',
    minLength: 6,
    avgTimeByChar: 30,
    extendedCharset: true,
    singleScanQty: 1,
    suffixKeyCodes: [13],
    indicator: 'badge',
    indicatorCorner: 'bottom-right',
    indicatorTimeout: 1,
    indicatorScanOnly: true,
    customClass: '',
    onCreated: '',
    onMounted: '',
    onUnmount: '',
    onScan: [
      'const form=this.getFormRef&&this.getFormRef();',
      'if(!form)return;',
      '/* มี popup เปิดอยู่ = ห้ามสลับผู้ป่วยกลางคัน (กฎเดียวกับ LAB) */',
      'if(form.showPopupFlag)return;',
      "const raw=String(value==null?'':value).trim();",
      "if(!raw){this.notify('อ่านบาร์โค้ดไม่ได้','warning');return;}",
      '/* ถ้าคีย์บอร์ด/เครื่องสแกนส่งค่าขณะโฟกัสช่อง Search ให้ถือเป็นคำค้น */',
      "const focused=globalThis.document&&globalThis.document.activeElement;",
      "const searchInput=focused&&typeof focused.closest==='function'&&focused.closest('.xray-cpoe .xr-search-control');",
      "if(searchInput){const worklist=form.getFieldRef&&form.getFieldRef('xray_cpoe_worklist');const state=worklist&&worklist.vueState;if(state){const typed=String(focused.value==null?'':focused.value).trim();state.setSearch(typed||raw);state.applyFilters();}return;}",
      '/* ส่งค่าดิบไปให้ widget ตัดสิน — การแปลงอักษรไทยกลับเป็นตัวเลขและการตรวจความยาว',
      '   อยู่ที่ scanPatientHn ที่เดียว ไม่งั้นสองที่จะตรวจคนละเกณฑ์แล้วเพี้ยน */',
      '/* สแกนได้จากทุกแท็บ — สลับมาแท็บ X-ray ก่อน ไม่งั้นตอนยืนอยู่แท็บคิว',
      '   widget worklist ยังไม่ถูก mount แล้ว getFieldRef จะคืน null (tab lazy) */',
      "const tab=form.getFieldRef&&form.getFieldRef('xray_app');",
      "if(tab&&tab.activeTabName!=='xray_tab_worklist')tab.activeTabName='xray_tab_worklist';",
      "const worklist=form.getFieldRef&&form.getFieldRef('xray_cpoe_worklist');",
      'const state=worklist&&worklist.vueState;',
      "if(!state||typeof state.scanPatientHn!=='function'){this.notify('ไม่พบ X-ray Worklist สำหรับรับค่า HN หรือเลขบัตร','error');return;}",
      'state.scanPatientHn(raw);'
    ].join('\n'),
    onScanError: '',
    label: 'Scan HN / เลขบัตร'
  },
  id: 'scan-code-ui-xray-hn'
}
form.fields.push(scanField)

/* วิดเจ็ต print agent ของเครื่องผู้ใช้ — ปุ่ม "พิมพ์ HN" เรียกผ่านตัวนี้ตัวเดียว
   ค่าทั้งหมดยกมาจากฟอร์มที่ deploy อยู่จริง (x-ray-module.json · 2026-09-11)
   token: ผู้ใช้สั่งให้ใส่ค่าจริงลงไปเลย 2026-09-11 ("เอา token เอาอะไรของ agent ใส่มาให้เลย")
      หลังจากผมทักท้วงเรื่องกติกา "ห้ามเก็บ credential" ใน CLAUDE.md — เจ้าของรีโปตัดสินแล้ว
      ค่านี้เป็น token ของ print agent บน localhost ของผู้ใช้เอง ไม่ใช่ของระบบกลาง
      🔴 ไฟล์นี้และ JSON ที่ generate ออกมามี token อยู่ ⇒ ห้าม push ขึ้นที่สาธารณะ
      override ได้ด้วย XRAY_LOCAL_AGENT_TOKEN ถ้าเครื่องอื่นใช้ token คนละตัว */
const defaultLocalAgentToken = '__XRAY_LOCAL_AGENT_TOKEN__'
const localAgentToken = String(
  process.env.XRAY_LOCAL_AGENT_TOKEN === undefined
    ? defaultLocalAgentToken
    : process.env.XRAY_LOCAL_AGENT_TOKEN
).trim()
const localAgentField = {
  key: 73906,
  name: 'Local Agent',
  component: 'local-agent-ui',
  category: 'display_ui',
  icon: 'el-connection',
  fieldType: null,
  fieldLength: null,
  children: false,
  enable: true,
  formItemFlag: false,
  options: {
    name: 'local_agent',
    columnSpan: 4,
    hidden: false,
    disabled: false,
    agentKind: 'printer',
    agentName: '',
    host: '127.0.0.1',
    port: 8766,
    token: localAgentToken,
    secure: false,
    autoConnect: true,
    settingsButton: true,
    settingsLabel: 'Agents',
    indicator: 'dot',
    indicatorCorner: 'bottom-right',
    indicatorTimeout: 0,
    customClass: '',
    onCreated: '',
    onMounted: '',
    onUnmount: '',
    onAgentEvent: '',
    onAgentConnected: '',
    onAgentDisconnected: '',
    onAgentError: '',
    label: 'Local Agent'
  },
  id: 'local-agent-ui-xray-printer'
}
form.fields.push(localAgentField)

grid.options.name = 'xray_cpoe_worklist_root'
grid.id = 'grid-xray-cpoe-worklist-root'

const col = grid.cols[0]
if (!col || col.component !== 'grid-col') throw new Error('template grid-col not found')
col.options.name = 'xray_cpoe_worklist_col'
col.id = 'grid-col-xray-cpoe-worklist'

const widget = col.fields[0]
if (!widget || widget.component !== 'vue-ui') throw new Error('template vue-ui not found')
/* เก็บ widget/CSS ของ LAB ก่อนเปลี่ยนก้อนหลักให้เป็น X-ray Worklist
   แท็บสืบค้นผล LAB ด้านล่างต้องใช้ UI เดียวกับ LAB จริง ไม่ใช่สร้างหน้าตา `.xll-*`
   ขึ้นมาเลียนแบบอีกชุดหนึ่ง จึง clone จาก generated LAB Form โดยตรง */
const labLookupTemplate = JSON.parse(JSON.stringify(widget))
const labLookupCss = String(form.formConfig && form.formConfig.cssCode || '')
if (!String(labLookupTemplate.options.onCreated || '').includes(`const PROCESS_ID='${labWorklistProcessId}'`)) {
  throw new Error('generated LAB widget does not point at the expected LAB Worklist Process')
}
/* สิทธิ์ดูผลต้องติดมาจาก LAB ทั้งชุด ไม่ใช่แค่หน้าตาเหมือนกัน หาก LAB template
   ไม่มี lock/re-auth/grant-to-PDF contract ให้หยุด generate ทันที เพื่อไม่ให้ X-ray
   ได้สำเนาที่เผลอเปิด Sensitive result หรือส่ง PDF โดยไม่มี server-issued grant */
for (const requiredContract of [
  's.requestSensitiveAccess=group=>',
  "action:'authorize_sensitive_result'",
  's.sensitiveSheetKey=(order,item)=>',
  's.currentSensitiveGrant=()=>',
  'if(grant&&grant.token)params.grant_token=grant.token;',
  "action:'get_manual_result'",
  'if(grant&&grant.token)request.sensitive_grant_token=grant.token;',
]) {
  if (!String(labLookupTemplate.options.onCreated || '').includes(requiredContract)) {
    throw new Error('generated LAB widget is missing the Sensitive-result access contract: ' + requiredContract)
  }
}
widget.options.name = 'xray_cpoe_worklist'
widget.options.label = 'X-ray CPOE Worklist'
widget.id = 'vue-ui-xray-cpoe-worklist'

form.formConfig.cssCode = `.xray-cpoe{--primary:var(--el-color-primary,#409eff);--primary-50:var(--el-color-primary-light-9,#ecf5ff);--success:var(--el-color-success,#67c23a);--warning:var(--el-color-warning,#e6a23c);--danger:var(--el-color-danger,#f56c6c);--ink:var(--el-text-color-primary,#303133);--text:var(--el-text-color-regular,#606266);--muted:var(--el-text-color-secondary,#909399);--placeholder:var(--el-text-color-placeholder,#a8abb2);--border:var(--el-border-color,#dcdfe6);--border-light:var(--el-border-color-light,#e4e7ed);--border-lighter:var(--el-border-color-lighter,#ebeef5);--fill:var(--el-fill-color,#f0f2f5);--fill-light:var(--el-fill-color-light,#f5f7fa);--fill-lighter:var(--el-fill-color-lighter,#fafafa);--white:var(--el-bg-color,#fff);--xr-wait-bg:#fffbe6;--xr-wait-text:#8a6d00;--mono:"SFMono-Regular","Roboto Mono",Consolas,monospace;width:100%;padding:0 0 36px;background:var(--white);color:var(--text);font-family:"Leelawadee UI","Noto Sans Thai",Tahoma,"Segoe UI",sans-serif;font-size:13px;line-height:1.4}
.dark .xray-cpoe{--xr-wait-bg:rgba(250,219,20,.14);--xr-wait-text:#ffe45c}
.xray-cpoe *{box-sizing:border-box}
.xray-cpoe .xr-toolbar{display:flex;flex-wrap:wrap;align-items:flex-start;gap:10px;margin-bottom:10px}
.xray-cpoe .xr-toolbar>*{min-width:0}.xray-cpoe .xr-toolbar .el-button+.el-button{margin-left:0}
.xray-cpoe .xr-toolbar>.el-button,.xray-cpoe .xr-toolbar>.el-dropdown{flex:0 0 auto}
.xray-cpoe .xr-search-control{flex:1 1 230px;min-width:min(230px,100%);max-width:310px;width:100%}
.xray-cpoe .xr-toolbar .xr-date-control{flex:1 1 250px;min-width:min(250px,100%);max-width:310px;width:100%!important}
.xray-cpoe .xr-modality-field{display:flex;flex:0 1 auto;width:max-content;max-width:100%;align-items:center;gap:8px;min-width:min(220px,100%)}
.xray-cpoe .xr-modality-label{flex:none;color:var(--muted);font-size:11px;font-weight:650}
.xray-cpoe .xr-sort-field{display:flex;flex:0 1 auto;width:max-content;max-width:100%;align-items:center;gap:8px}
.xray-cpoe .xr-sort-label{flex:none;color:var(--muted);font-size:11px;font-weight:650}
.xray-cpoe .xr-sort-select{flex:0 1 auto;width:188px}
.xray-cpoe .xr-modality-select{flex:0 1 auto;min-width:170px;max-width:calc(100% - 40px)}
/* ก่อนเลือกต้องจัด placeholder กึ่งกลางเหมือน el-select ปกติ (ของเดิมชิดบนจนดูเพี้ยน)
   เมื่อเลือกแล้วจึงยึด tag ไว้ด้านบน เพื่อให้กล่องสูงลงล่างอย่างเป็นระเบียบตอนขึ้นหลายแถว */
.xray-cpoe .xr-modality-select .el-select__wrapper{min-height:30px;height:auto;align-items:center;padding-top:3px;padding-bottom:3px}
.xray-cpoe .xr-modality-field.is-picked .el-select__wrapper{align-items:flex-start}
/* แสดงทุก code โดยไม่ยุบเป็น +N; เมื่อเลือกเกิน 3 ใช้ grid บังคับให้แท็กที่ 4 ขึ้นแถวใหม่
   input ค้นหาของ Element Plus เป็นลูกตัวสุดท้ายและกว้าง 126px: ปล่อยตาม auto จะดัน
   คอลัมน์แท็กให้ห่าง จึงจำกัดความกว้าง input และให้ใช้ช่องที่เหลือในแถวแท็ก */
.xray-cpoe .xr-modality-select .el-select__selection,.xray-cpoe .xr-modality-select .el-select__tags{flex-wrap:wrap;overflow:visible;row-gap:3px}
.xray-cpoe .xr-modality-field.is-multirow .xr-modality-select .el-select__selection{display:grid!important;grid-template-columns:repeat(3,max-content)!important;grid-auto-flow:row;align-content:start;gap:3px 4px}
.xray-cpoe .xr-modality-field.is-multirow .xr-modality-select .el-select__input-wrapper{grid-column:1/-1;min-width:0;max-width:100%;contain:inline-size}
.xray-cpoe .xr-modality-field.is-multirow .xr-modality-select .el-select__input-wrapper:nth-child(3n+2){grid-column:2/-1}
.xray-cpoe .xr-modality-field.is-multirow .xr-modality-select .el-select__input-wrapper:nth-child(3n){grid-column:3}
.xray-cpoe .xr-modality-field.is-multirow .xr-modality-select .el-select__input{max-width:100%}
/* สีของ tag ที่เลือกแล้ว (ผู้ใช้ขอ 2026-09-11: "เปลี่ยนสี textbox และสี text ให้มองเห็นชัด")
   ใช้ชุดสีเดียวกับป้ายคลินิกต้นทางในตาราง จะได้ไม่มีสีที่ 4 โผล่มาในหน้าเดียว */
.xray-cpoe .xr-modality-select .el-tag{max-width:none;flex:none;border-color:#a0cfff;background:#ecf5ff;color:#337ecc;font-weight:700}
.xray-cpoe .xr-modality-select .el-tag .el-tag__content{white-space:nowrap}
.xray-cpoe .xr-modality-select .el-tag .el-tag__close{color:#337ecc}
.xray-cpoe .xr-modality-select .el-tag .el-tag__close:hover{background:#337ecc;color:var(--white)}
/* สีอยู่เฉพาะ tag ใน textbox เท่านั้น — ตัวกล่อง, label และพื้นหลังรายการใน dropdown
   ใช้ขาว/เทาตาม Element Plus เดิม เพื่อไม่ให้ทั้ง control ดูเหมือนถูกเลือกค้าง */
/* ปุ่มหลักอยู่ระดับเดียวกับตัวกรอง; หนังสือยินยอมอยู่แถวถัดไปใต้ปุ่มนัด
   toolbar ห่อทั้งกลุ่มลงแถวใหม่เมื่อพื้นที่ไม่พอ จึงไม่ชน Report/ตัวกรอง */
.xray-cpoe .xr-create-group{display:grid;grid-template-columns:max-content max-content;grid-template-rows:auto auto;align-items:start;gap:5px 8px;flex:0 0 auto;margin-left:auto;max-width:100%}
.xray-cpoe .xr-create-group .el-button+.el-button{margin-left:0}
.xray-cpoe .xr-create-button{grid-column:1;grid-row:1}
.xray-cpoe .xr-consent-button{grid-column:2;grid-row:1;margin-left:0}
.xray-cpoe .xr-create-notice{position:fixed;top:12px;left:50%;z-index:3200;display:flex;align-items:center;gap:12px;max-width:calc(100vw - 24px);padding:7px 10px 7px 13px;transform:translateX(-50%);border:0;border-radius:6px;background:rgba(245,108,108,.2);color:#a83b43;font-size:13px;line-height:1.4;text-align:left}
.xray-cpoe .xr-create-notice span{overflow-wrap:anywhere}
.xray-cpoe .xr-create-notice button{flex:none;border:0;background:transparent;color:inherit;font:inherit;font-size:18px;line-height:1;cursor:pointer}
.xray-cpoe .xr-create-notice button:focus-visible{outline:2px solid #fff;outline-offset:2px}
.xray-cpoe .xr-dropdown-caret{margin-left:5px;color:var(--muted);font-size:12px}
.xray-cpoe-test-popper .xr-test-pop-line{line-height:1.5;white-space:nowrap}
.xray-cpoe-dx-popper{max-width:420px}
.xray-cpoe-dx-popper .xr-dx-pop{line-height:1.5;white-space:normal;overflow-wrap:anywhere}
.xray-cpoe-modality-popper .xr-opt-label{margin-right:16px}
.xray-cpoe-modality-popper .xr-opt-count{float:right;color:var(--el-text-color-secondary,#909399);font-family:"SFMono-Regular","Roboto Mono",Consolas,monospace;font-size:11px;font-variant-numeric:tabular-nums}
/* แถบโหมดสแกน — ลอกทรงจาก LAB ที่ใช้งานจริงแล้ว */
.xray-cpoe .xr-scan-context{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:0 0 10px;padding:8px 10px;border:1px solid #a0cfff;border-radius:6px;background:#ecf5ff;color:#337ecc}
.xray-cpoe .xr-scan-context-label{font-size:11px;font-weight:700}
.xray-cpoe .xr-scan-context strong{color:var(--ink);font-size:14px}
.xray-cpoe .xr-scan-context>span:not(.xr-scan-context-label){font-size:11px}
.xray-cpoe .xr-scan-context .el-button{margin-left:auto}
.xray-cpoe .xr-status-strip{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.xray-cpoe .xr-status-chip{--chip-color:var(--primary);--chip-border:var(--primary);display:flex;align-items:baseline;gap:6px;padding:6px 12px;border:1px solid var(--border-light);border-radius:6px;background:var(--fill-light);color:var(--muted);font:inherit;cursor:pointer;transition:border-color .15s,background-color .15s;user-select:none}
.xray-cpoe .xr-status-chip strong{color:var(--chip-color);font-size:18px;line-height:1}.xray-cpoe .xr-status-chip span{font-size:12px}
.xray-cpoe .xr-status-chip[data-status="waiting"]{--chip-color:#fadb14;--chip-border:#fadb14}.xray-cpoe .xr-status-chip[data-status="pending"]{--chip-color:#e6a23c;--chip-border:#e6a23c}.xray-cpoe .xr-status-chip[data-status="complete"]{--chip-color:var(--success);--chip-border:var(--success)}.xray-cpoe .xr-status-chip[data-status="cancelled"]{--chip-color:var(--danger);--chip-border:var(--danger)}
.xray-cpoe .xr-status-chip:hover,.xray-cpoe .xr-status-chip.is-active{border-color:var(--chip-border)}.xray-cpoe .xr-status-chip.is-active{background:var(--fill)}
.xray-cpoe .xr-status-legend{display:flex;align-items:center;gap:16px;margin-left:auto;padding:5px 10px;border:1px solid var(--border-light);border-radius:6px;background:var(--white);color:var(--text);font-size:11px;white-space:nowrap}
.xray-cpoe .xr-status-legend-item{display:inline-flex;align-items:center;gap:6px}
.xray-cpoe .xr-status-legend-dot{width:10px;height:10px;flex:none;border-radius:50%}
.xray-cpoe .xr-status-legend-dot.is-waiting{background:#fadb14}.xray-cpoe .xr-status-legend-dot.is-pending{background:#e6a23c}.xray-cpoe .xr-status-legend-dot.is-resulted{background:#67c23a}.xray-cpoe .xr-status-legend-dot.is-cancelled{background:#f56c6c}
.xray-cpoe .xr-notice{margin:0 0 8px;padding:8px 11px;border:1px solid var(--border-light);border-radius:6px;background:var(--fill-light);color:var(--text);font-size:12px}
.xray-cpoe .xr-notice.is-warning{border-color:#f3d19e;background:#fdf6ec;color:#b88230}
.xray-cpoe .xr-list-summary{margin:0 0 8px;color:var(--muted);font-size:12px}.xray-cpoe .xr-list-summary.is-error{color:var(--danger)}
.xray-cpoe .xr-worklist-shell{overflow-x:auto;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.xray-cpoe .xr-worklist{min-width:1173px;background:var(--white)}
.xray-cpoe .xr-list-head,.xray-cpoe .xr-patient-row{display:grid;grid-template-columns:30px minmax(165px,1.3fr) minmax(142px,1fr) 92px 94px 126px minmax(110px,.95fr) 108px 196px;gap:10px;align-items:center;padding:10px 12px}
.xray-cpoe .xr-list-head{color:var(--muted);font-size:11px;font-weight:650;border-bottom:1px solid var(--border);letter-spacing:.02em}
.xray-cpoe .xr-patient-block{position:relative;border-bottom:1px solid var(--border-lighter);content-visibility:auto;contain-intrinsic-size:84px}.xray-cpoe .xr-patient-block:last-child{border-bottom:0}
.xray-cpoe .xr-patient-row{min-height:84px;background:var(--white);cursor:pointer;transition:background-color .15s}.xray-cpoe .xr-patient-row:hover{background:var(--fill-light)}.xray-cpoe .xr-patient-block.is-open>.xr-patient-row{background:var(--fill)}
.xray-cpoe .xr-expand-button{display:grid;width:28px;height:30px;place-items:center;padding:0;border:0;border-radius:4px;background:transparent;color:var(--muted);cursor:pointer}.xray-cpoe .xr-expand-button:hover{background:var(--fill-light);color:var(--primary)}.xray-cpoe .xr-expand-button svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;transition:transform .16s}.xray-cpoe .xr-patient-block.is-open .xr-expand-button svg{transform:rotate(90deg)}
.xray-cpoe .xr-patient-summary,.xray-cpoe .xr-context-tags,.xray-cpoe .xr-metric,.xray-cpoe .xr-doctor-cell{min-width:0}
.xray-cpoe .xr-patient-hn{display:flex;align-items:center;gap:6px;min-width:0;color:var(--ink);font-weight:700}.xray-cpoe .xr-patient-hn .xr-mono{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.xray-cpoe .xr-patient-name{margin-top:1px;overflow:hidden;color:var(--ink);font-weight:650;text-overflow:ellipsis;white-space:nowrap}
.xray-cpoe .xr-patient-demographic{display:flex;align-items:center;gap:6px;margin-top:1px;color:var(--muted);font-size:11px}
.xray-cpoe .xr-inline-tag,.xray-cpoe .xr-state-tag{display:inline-flex;min-height:20px;align-items:center;justify-content:center;padding:1px 6px;border:1px solid;border-radius:4px;font-size:10px;font-weight:650;white-space:nowrap}
.xray-cpoe .xr-urgent-tag{min-height:18px;padding:0 5px;border-color:var(--el-color-danger-light-5,#fab6b6);background:var(--el-color-danger-light-9,#fef0f0);color:var(--danger);font-size:9px}
.xray-cpoe .xr-meta-pill{min-height:21px;padding:1px 8px;border-color:#c8c9cc;border-radius:999px;background:var(--white);color:var(--text)}
.xray-cpoe .xr-gender-pill{min-height:18px;padding:0 6px;border-color:#c8c9cc;border-radius:999px;background:var(--white);color:var(--text);font-size:9px}
.xray-cpoe .xr-context-tags{overflow:hidden}
/* ป้ายเตือนแพ้ยา/COVID — ทรงเดียวกับป้ายอื่นในคอลัมน์นี้เป๊ะ ๆ (ผู้ใช้ขอ 2026-09-03 รอบสอง)
   ขนาด/ระยะ/มุมโค้งลอกจาก .xr-meta-pill ต่างกันแค่สีแดงเท่านั้น
   ไม่ใช้คลาส xr-meta-pill ตรง ๆ เพราะกฎ .xr-context-tags>.xr-meta-pill จะย้อมส้มทับ */
.xray-cpoe .xr-alert-box{display:inline-flex;max-width:100%;min-height:21px;align-items:center;margin-bottom:4px;padding:1px 8px;overflow:hidden;border:1px solid #f56c6c;border-radius:999px;background:#fef0f0;color:#c45656;font-size:10px;font-weight:650;line-height:1.35;white-space:nowrap;cursor:default}
.xray-cpoe .xr-alert-box>span{overflow:hidden;text-overflow:ellipsis}
.xray-cpoe .xr-context-top{display:flex;align-items:center;gap:5px;flex-wrap:wrap;row-gap:4px;margin-bottom:4px}
.xray-cpoe .xr-context-top .xr-source-pill{border-color:var(--el-color-primary-light-5,#a0cfff);background:var(--el-color-primary-light-9,#ecf5ff);color:var(--primary)}.xray-cpoe .xr-context-top .xr-payment-pill{border-color:var(--el-color-success-light-5,#b3e19d);background:var(--el-color-success-light-9,#f0f9eb);color:var(--success)}.xray-cpoe .xr-context-top .xr-coverage-pill{border-color:var(--el-color-warning-light-5,#f3d19e);background:var(--el-color-warning-light-9,#fdf6ec);color:var(--warning)}
.xray-cpoe .xr-context-top .xr-payment-pill.is-unpaid{border-color:var(--el-color-danger-light-5,#fab6b6);background:var(--el-color-danger-light-9,#fef0f0);color:var(--danger)}
.xray-cpoe .xr-field-value{display:block;min-width:0;overflow:hidden;color:var(--ink);font-size:12px;font-weight:650;text-overflow:ellipsis;white-space:nowrap}
.xray-cpoe .xr-time-value{margin-top:3px;line-height:1.25}.xray-cpoe .xr-time-value span{display:block}
.xray-cpoe .xr-order-no-tag{display:inline-flex;max-width:100%;min-height:18px;align-items:center;padding:0 6px;overflow:hidden;border:1px solid var(--el-color-primary-light-5,#a0cfff);border-radius:999px;background:var(--el-color-primary-light-9,#ecf5ff);color:var(--primary);font-family:var(--mono);font-size:9px;text-overflow:ellipsis;white-space:nowrap}
.xray-cpoe .xr-diagnosis-summary{display:block;margin-top:2px;overflow:hidden;color:var(--muted);font-size:10px;text-overflow:ellipsis;white-space:nowrap}
.xray-cpoe .xr-test-cell .xr-field-value{display:block;overflow:hidden;color:var(--ink);text-overflow:ellipsis;white-space:nowrap}
.xray-cpoe .xr-test-cell{position:relative}
/* ไม่มีเส้นใต้ — ผู้ใช้ขอเอาออก 2026-09-03 (tooltip ยังทำงานเหมือนเดิมทุกอย่าง) */
.xray-cpoe .xr-test-count{display:inline-block;color:var(--ink);font-size:12px;font-weight:650;cursor:default}
/* เครื่องต้องไม่ชิดคอลัมน์เวลา — กันที่ด้านขวาไว้ 26px ส่วนคอลัมน์กว้างขึ้นชดเชย
   ทำให้ tag ยังมีเนื้อที่เท่าเดิม (130-26 = 104 เท่ากับของเดิม 118-14) */
.xray-cpoe .xr-modality-cell,.xray-cpoe .xr-item-modality{padding-right:26px}
.xray-cpoe .xr-item-grid>[data-label="เวลาส่งเข้าเครื่อง"]{padding-left:2px}
.xray-cpoe .xr-test-code{display:block;margin-top:1px;color:var(--muted);font-size:10px}
/* แสดงแค่ตัวย่อ (DX, CT) ชื่อเต็มดูได้ตอน hover — ผู้ใช้ขอ 2026-09-01
   สั้นแล้วจึงไม่ต้องตัดคำอีก และ 1 order มีได้หลายเครื่องจึงเรียงต่อกันแบบ wrap ได้ */
.xray-cpoe .xr-modality-tag{display:inline-block;width:fit-content;max-width:100%;padding:3px 8px;border:1px solid var(--border);border-radius:5px;background:var(--fill);color:var(--text);font-family:var(--mono);font-size:11px;font-weight:650;line-height:1.35;white-space:nowrap;cursor:default}
.xray-cpoe .xr-modality-cell{display:flex;flex-wrap:wrap;align-items:center;gap:4px}
.xray-cpoe .xr-empty-cell{color:var(--placeholder)}
.xray-cpoe .xr-row-status{display:inline-flex;min-height:22px;align-items:center;justify-content:center;justify-self:start;padding:1px 7px;border:1px solid;border-radius:4px;font-size:10px;font-weight:650;white-space:nowrap}
.xray-cpoe .xr-st-waiting{border-color:#fadb14;background:var(--xr-wait-bg);color:var(--xr-wait-text)}
.xray-cpoe .xr-st-dispatched,.xray-cpoe .xr-st-partial{border-color:#e6a23c;background:#fdf6ec;color:#b88230}
.xray-cpoe .xr-st-complete{border-color:#b3e19d;background:#f0f9eb;color:#529b2e}
.xray-cpoe .xr-st-cancelled,.xray-cpoe .xr-st-failed{border-color:#fab6b6;background:#fef0f0;color:#c45656}
/* คอลัมน์ "สถานะ" ระดับ order = เช็คลิสต์ 4 ช่องคงที่ (ผู้ใช้ขอ 2026-09-03)
   ป้ายรวมทั้งใบเดิม (xr-row-status) ยังคำนวณอยู่ แต่ย้ายไปเป็น title/aria-label
   ทุกช่องกว้างเท่ากันเสมอ ดอตจึงอยู่ตรงคอลัมน์เดียวกันทุกแถว เทียบด้วยตาได้ทันที
   ช่องที่ไม่มีรายการเว้นว่าง (ไม่มีขีด ไม่มีดอตจาง) ตามกติกา "ไม่มีค่า = ว่าง" */
.xray-cpoe .xr-row-status-check{display:flex;align-items:center;justify-self:start;gap:4px;min-width:0}
.xray-cpoe .xr-status-step{display:inline-flex;width:24px;align-items:center;gap:2px;cursor:default}
.xray-cpoe .xr-status-dot{width:10px;height:10px;flex:none;border-radius:50%;background:transparent}
.xray-cpoe .xr-status-count{font-size:10px;font-weight:650;line-height:1}
/* ขั้นที่ผ่านไปแล้วใช้เครื่องหมายถูกแทนตัวเลข — จุดยังอยู่ที่เดิม ความกว้างช่องไม่ขยับ
   สีเส้นถูกเป็นสีเข้มของขั้นนั้น อ่านออกบนจุดพาสเทลโดยไม่ต้องเพิ่มขนาด */
.xray-cpoe .xr-status-check{width:11px;height:11px;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.xray-cpoe .xr-status-step.is-on.xr-dot-waiting .xr-status-dot{background:#fadb14}
.xray-cpoe .xr-status-step.is-on.xr-dot-waiting .xr-status-count{color:#8a6d00}
.xray-cpoe .xr-status-step.is-done.xr-dot-waiting .xr-status-check{color:#8a6d00}
.xray-cpoe .xr-status-step.is-on.xr-dot-dispatched .xr-status-dot{background:#e6a23c}
.xray-cpoe .xr-status-step.is-on.xr-dot-dispatched .xr-status-count{color:#b88230}
.xray-cpoe .xr-status-step.is-done.xr-dot-dispatched .xr-status-check{color:#b88230}
.xray-cpoe .xr-status-step.is-on.xr-dot-resulted .xr-status-dot{background:#67c23a}
.xray-cpoe .xr-status-step.is-on.xr-dot-resulted .xr-status-count{color:#3f7d22}
.xray-cpoe .xr-status-step.is-done.xr-dot-resulted .xr-status-check{color:#3f7d22}
.xray-cpoe .xr-status-step.is-on.xr-dot-cancelled .xr-status-dot{background:#fab6b6}
.xray-cpoe .xr-status-step.is-on.xr-dot-cancelled .xr-status-count{color:#c45656}
.xray-cpoe .xr-row-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px;min-width:0}
.xray-cpoe .xr-plain-action{margin:0!important;padding:5px 7px!important;flex:none;font-size:11px}
/* ปุ่มพิมพ์ผ่าน print-agent — สูงเท่าปุ่ม sd-report ข้าง ๆ และห้ามตัดคำ */
.xray-cpoe .xr-hn-print{white-space:nowrap}
.xray-cpoe .xr-detail-panel{padding:0 12px 14px 42px;border-top:1px solid var(--border-lighter);background:var(--fill-lighter)}
.xray-cpoe .xr-detail-top{display:flex;min-height:42px;align-items:flex-end;gap:16px;border-bottom:1px solid var(--border-light)}
.xray-cpoe .xr-detail-tab{height:42px;padding:0;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--muted);font:inherit;font-size:12px;font-weight:650;cursor:pointer}
.xray-cpoe .xr-detail-tab.is-active{border-bottom-color:var(--primary);color:var(--primary)}.xray-cpoe .xr-detail-tab:disabled{color:var(--placeholder);cursor:not-allowed}
.xray-cpoe .xr-bulk-actions{display:flex;align-items:center;gap:6px;margin-left:auto;padding-bottom:6px}.xray-cpoe .xr-bulk-actions .el-button+.el-button{margin-left:0}.xray-cpoe .xr-dispatch-tooltip{display:inline-flex}
/* ผู้ใช้แก้ 2026-09-11: หัวตารางสีฟ้าต้องชิดเส้นใต้ tab ทันที จึงไม่มี padding ด้านบน
   และขยายพื้นที่ scroll เข้า gutter ซ้าย 42px เพื่อให้ checkbox ไปยึดอยู่ริม panel ได้ */
.xray-cpoe .xr-item-grid-wrap{overflow-x:auto;margin-left:-42px;padding-top:0}
/* ผู้ใช้ปรับ 2026-09-11: ช่อง sticky กว้าง 42px ให้เส้นแบ่งขวาตรงแนวเริ่มคำว่า order
   min-width คือผลรวม minimum tracks + gaps จริง พื้นหลังหัวตารางจึงคลุมทุกคอลัมน์ไม่ขาด
   2026-09-23 ผู้ใช้เลือกตัวเลือก A: เพิ่มคอลัมน์ที่ 12 "สารทึบ" 130px + gap 10px
   ⇒ 1481px → 1621px · คอลัมน์ 1–11 เดิมคงสัดส่วนเท่าเดิมทุกตัว ไม่มีตัวไหนถูกบีบ */
.xray-cpoe .xr-item-grid{display:grid;grid-template-columns:42px 150px minmax(215px,1.9fr) 78px 132px 150px 150px 108px minmax(125px,1.1fr) minmax(105px,.9fr) 126px 130px;gap:10px;align-items:center;min-width:1621px;padding:6px 0}
.xray-cpoe .xr-item-radiologist .el-select,.xray-cpoe .xr-item-radiographer .el-select{width:100%}
.xray-cpoe .xr-item-head{min-height:44px;color:var(--ink);font-size:11px;font-weight:650;border-top:1px solid var(--el-color-primary-light-7,#c6e2ff);border-bottom:1px solid var(--el-color-primary-light-7,#c6e2ff);background:var(--primary-50)}
.xray-cpoe .xr-item-row{min-height:52px;border-bottom:1px dashed var(--border-lighter);font-size:12px;transition:background-color .12s}.xray-cpoe .xr-item-row:last-child{border-bottom:0}
.xray-cpoe .xr-item-row.is-selectable{cursor:pointer}
.xray-cpoe .xr-item-row.is-selectable:hover{background:var(--fill-light)}
.xray-cpoe .xr-item-row.is-selected{background:var(--primary-50)}
.xray-cpoe .xr-item-row.is-selected:hover{background:var(--primary-50)}
/* checkbox หัวตารางและระดับ item ต้องมองเห็นตลอดเมื่อเลื่อนแนวนอน
   พื้นหลังของ cell ทึบตามสถานะแถว เพื่อไม่ให้ข้อความที่ scroll ผ่านด้านหลังซ้อนกับ checkbox */
.xray-cpoe .xr-item-check-cell{position:sticky;left:0;z-index:2;align-self:stretch;display:flex;align-items:center;padding-left:12px;background:var(--fill-lighter);box-shadow:1px 0 0 var(--border-lighter)}
.xray-cpoe .xr-item-head>.xr-item-check-cell{z-index:3;background:var(--primary-50);box-shadow:1px 0 0 var(--el-color-primary-light-7,#c6e2ff)}
.xray-cpoe .xr-item-row.is-selectable:hover>.xr-item-check-cell{background:var(--fill-light)}
.xray-cpoe .xr-item-row.is-selected>.xr-item-check-cell,.xray-cpoe .xr-item-row.is-selected:hover>.xr-item-check-cell{background:var(--primary-50)}
.xray-cpoe .xr-item-sticker-action{display:flex;align-items:center;justify-content:flex-end;min-width:0}
/* คอลัมน์ "สารทึบ" (2026-09-23) — ยังไม่บันทึก = ปุ่มจาง ๆ "+ บันทึก"
   บันทึกแล้ว = ชิปบอกยี่ห้อกับปริมาณ กดซ้ำเพื่อเปิดฟอร์มเดิมขึ้นมาแก้
   ทรง flex ชุดเดียวกับ .xr-item-sticker-action เพื่อให้สองคอลัมน์สุดท้ายเรียงเท่ากัน */
.xray-cpoe .xr-item-contrast{display:flex;align-items:center;justify-content:flex-end;min-width:0}
.xray-cpoe .xr-contrast-chip{display:inline-flex;max-width:100%;min-height:22px;align-items:center;padding:1px 8px;overflow:hidden;border:1px solid #b7ddc4;border-radius:4px;background:#eaf6ee;color:#3a8a56;font-family:inherit;font-size:10px;font-weight:650;line-height:1.5;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
.xray-cpoe .xr-contrast-chip:hover{border-color:#8fcaa4;background:#dff0e6}
.xray-cpoe .xr-test-name{color:var(--ink);font-weight:650}.xray-cpoe .xr-test-code-inline{display:block;margin-top:1px;color:var(--muted);font-size:11px;font-weight:400}
.xray-cpoe .xr-transport-note{display:block;margin-top:3px;color:#c45656;font-size:10px;font-weight:600}
/* ชิปสถานะที่ RIS แจ้งกลับ (เพิ่ม 2026-09-09) — อยู่ในช่อง Accession เดิม
   ไม่ได้เพิ่มคอลัมน์ ตาราง xr-item-grid จึงไม่ต้องแก้สัดส่วนใด ๆ */
.xray-cpoe .xr-ris-chip{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:4px;font-family:var(--sans);font-size:10px;font-weight:700;line-height:1.5;white-space:nowrap;cursor:default}
.xray-cpoe .xr-ris-a{background:#eef3fe;border:1px solid #bcd0f7;color:#3a67c4}
.xray-cpoe .xr-ris-c{background:#eaf6ee;border:1px solid #b7ddc4;color:#3a8a56}
.xray-cpoe .xr-item-row [data-label]:before{display:none}
/* ผู้ใช้ขอ 2026-09-11: แท็บผลอ่านใช้ pattern เดียวกับแท็บ order แต่ไม่มี checkbox
   ขยายพื้นตารางเข้า gutter ซ้าย 42px แล้วชดเชย padding เพื่อให้คอลัมน์ลำดับยังอยู่ตำแหน่งเดิม */
.xray-cpoe .xr-result-list{padding-top:0;overflow-x:auto;margin-left:-42px}
.xray-cpoe .xr-result-list-head,.xray-cpoe .xr-result-list-row{display:grid;grid-template-columns:56px minmax(230px,2.6fr) 78px minmax(120px,1fr) 130px 120px 150px;gap:12px;align-items:center;min-width:998px;padding:6px 0 6px 42px}
.xray-cpoe .xr-result-list-head{min-height:44px;border-top:1px solid var(--el-color-primary-light-7,#c6e2ff);border-bottom:1px solid var(--el-color-primary-light-7,#c6e2ff);background:var(--primary-50);color:var(--ink);font-size:11px;font-weight:650}
.xray-cpoe .xr-result-list-row{min-height:52px;border-bottom:1px dashed var(--border-lighter)}
.xray-cpoe .xr-result-action-group{display:flex;align-items:center;gap:6px}.xray-cpoe .xr-result-action-group .el-button+.el-button{margin-left:0}
.xray-cpoe .xr-empty{padding:34px 20px;text-align:center;color:var(--muted);line-height:1.7}.xray-cpoe .xr-empty strong{color:var(--ink)}
.xray-cpoe .xr-pagination{display:flex;justify-content:flex-end;padding-top:10px}
.xray-cpoe .xr-mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
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
@media(max-width:680px){.xray-cpoe .xr-toolbar{gap:8px}.xray-cpoe .xr-search-control,.xray-cpoe .xr-toolbar .xr-date-control{flex-basis:100%;max-width:none}.xray-cpoe .xr-modality-field{flex:1 1 100%;width:100%}.xray-cpoe .xr-modality-select{flex:1 1 auto;width:100%!important}.xray-cpoe .xr-sort-field{flex:1 1 100%;width:100%}.xray-cpoe .xr-sort-select{flex:1 1 auto;width:100%}}
@media(max-width:480px){.xray-cpoe .xr-modality-field.is-multirow .xr-modality-select .el-select__selection{grid-template-columns:repeat(2,max-content)!important}.xray-cpoe .xr-modality-field.is-multirow .xr-modality-select .el-select__input-wrapper:nth-child(2n+1){grid-column:1/-1}.xray-cpoe .xr-modality-field.is-multirow .xr-modality-select .el-select__input-wrapper:nth-child(2n){grid-column:2}}
@media(max-width:900px){.xray-cpoe .xr-item-grid-wrap{overflow:visible;margin-left:0}.xray-cpoe .xr-item-head{display:none}.xray-cpoe .xr-item-grid.xr-item-row{display:grid;grid-template-columns:1fr 1fr;gap:0 14px;min-width:0;padding:10px 0}.xray-cpoe .xr-item-grid.xr-item-row>.xr-item-check-cell{position:static;z-index:auto;padding-left:0;background:transparent;box-shadow:none}.xray-cpoe .xr-item-row>div{display:grid;grid-template-columns:minmax(104px,.42fr) minmax(0,1fr);align-items:center;gap:8px;min-height:34px;padding:3px 0;border-bottom:1px dashed var(--border-lighter)}.xray-cpoe .xr-item-row>div:before{display:block;content:attr(data-label);color:var(--muted);font-size:10px;font-weight:650}.xray-cpoe .xr-item-row>div:last-child{border-bottom:0}.xray-cpoe .xr-result-list{margin-left:0}.xray-cpoe .xr-result-list-head,.xray-cpoe .xr-result-list-row{min-width:956px;padding:6px 0}}
@media(max-width:680px){.xray-cpoe .xr-status-strip{flex-wrap:nowrap;overflow-x:auto;padding-bottom:3px}.xray-cpoe .xr-status-chip{flex:0 0 auto}.xray-cpoe .xr-status-legend{flex:0 0 auto}.xray-cpoe .xr-detail-panel{padding:0 8px 12px}.xray-cpoe .xr-detail-top{align-items:flex-start;flex-wrap:wrap}.xray-cpoe .xr-bulk-actions{width:100%;margin:0;padding-bottom:7px;flex-wrap:wrap}.xray-cpoe .xr-item-grid.xr-item-row{grid-template-columns:1fr}.xray-cpoe .xr-pagination{justify-content:flex-start;overflow-x:auto}.xr-report-head{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.xray-cpoe *{scroll-behavior:auto!important;transition-duration:.001ms!important}}`

widget.options.content = `<div class="xray-cpoe">
  <div v-if="createOrderNotice" class="xr-create-notice" role="alert" aria-live="assertive">
    <span>{{ createOrderNotice }}</span>
    <button type="button" aria-label="ปิดข้อความแจ้งเตือน" @click="dismissCreateOrderNotice">×</button>
  </div>
  <section aria-label="ค้นหาและกรองรายการ">
    <div class="xr-toolbar">
      <el-input class="xr-search-control" :model-value="filters.q" size="small" clearable
        prefix-icon="Search" placeholder="HN / VN / ON / Acc. / AN / บัตร ปชช. / ชื่อ"
        title="ค้นหา HN, VN, Order No., Accession No., AN ผู้ป่วยใน, เลขบัตรประชาชน หรือชื่อผู้ป่วย"
        aria-label="ค้นหา HN VN Order No. Accession No. AN ผู้ป่วยใน เลขบัตรประชาชน หรือชื่อผู้ป่วย"
        @input="setSearch" @clear="applyFilters" @keyup.enter="applyFilters" />

      <el-date-picker class="xr-date-control" :model-value="filters.dates" size="small" type="daterange"
        range-separator="ถึง" start-placeholder="Date Range" end-placeholder="Date Range"
        value-format="YYYY-MM-DD" format="DD/MM/YYYY" :disabled="scanMode"
        :title="scanMode?'โหมดสแกนแสดงทุกวันที่ของผู้ป่วยนี้ ช่วงวันที่จึงไม่มีผล':''"
        @update:model-value="setDates" />

      <div class="xr-modality-field" :class="{'is-picked':modality.length,'is-multirow':modality.length>3}">
        <span class="xr-modality-label">เครื่อง</span>
        <el-select class="xr-modality-select" popper-class="xray-cpoe-modality-popper"
          :model-value="modality" size="small" filterable multiple clearable
          :style="{width:modalitySelectWidth()}"
          :disabled="!view.modalityReady"
          :placeholder="view.modalityPlaceholder" :aria-label="view.modalityAria"
          @change="setModality">
          <el-option v-for="m in view.modalities" :key="m.value" :label="m.value" :value="m.value">
            <span class="xr-opt-label" :title="m.label">{{ m.value }}</span>
            <span v-if="m.count !== null" class="xr-opt-count">{{ m.count }}</span>
          </el-option>
        </el-select>
      </div>

      <div class="xr-sort-field">
        <span class="xr-sort-label">เรียงตาม</span>
        <el-select class="xr-sort-select" :model-value="sortKey" size="small"
          aria-label="เลือกลำดับการจัดเรียงรายการ" @change="setSort">
          <el-option v-for="o in sortOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </div>

      <el-button size="small" type="primary" :loading="loading" @click="applyFilters">Search</el-button>
      <el-dropdown trigger="click" @command="reportCommand">
        <el-button size="small">Report <span class="xr-dropdown-caret">⌄</span></el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="pdf">PDF</el-dropdown-item>
            <el-dropdown-item command="excel">Excel</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <div class="xr-create-group">
        <el-button class="xr-create-button" size="small" type="primary" :loading="createOrderLoading" @click="openCreateOrder">สร้างรายการใหม่</el-button>
        <el-button class="xr-consent-button" size="small" :title="consentLibraryHint"
          @click="openConsentLibrary">หนังสือยินยอม</el-button>
      </div>
    </div>

    <div v-if="scanMode" class="xr-scan-context" role="status" aria-live="polite">
      <span class="xr-scan-context-label">โหมดผู้ป่วยจากการสแกน</span>
      <strong class="xr-mono">{{ scanLabel }} {{ scanDisplay }}</strong>
      <span>แสดงทุกวันที่ของผู้ป่วยนี้</span>
      <el-button size="small" plain @click="clearScan">{{ scanType==='citizen_id'?'ล้างเลขบัตรที่สแกน':'ล้าง HN ที่สแกน' }}</el-button>
    </div>

    <div v-if="focusVisitId" class="xr-scan-context" role="status" aria-live="polite">
      <span class="xr-scan-context-label">เปิดจากคิว</span>
      <strong class="xr-mono">VN {{ focusVisitVn || '-' }}</strong>
      <span>แสดงเฉพาะใบสั่งของ Visit นี้</span>
      <el-button size="small" plain @click="clearFocusVisit">แสดงทั้งหมด</el-button>
    </div>

    <div class="xr-status-strip" role="group" aria-label="กรองรายการตามสถานะ">
      <button v-for="filter in statusFilters" :key="filter.key" type="button"
        class="xr-status-chip" :class="{'is-active':statusKey===filter.key}"
        :data-status="filter.key==='all'?'':filter.key" :aria-pressed="statusKey===filter.key"
        @click="setStatus(filter.key)">
        <strong>{{ view.counts[filter.key] || 0 }}</strong><span>{{ filter.label }}</span>
      </button>
      <div class="xr-status-legend" aria-label="คำอธิบายสีสถานะ">
        <span class="xr-status-legend-item">
          <i class="xr-status-legend-dot is-waiting" aria-hidden="true"></i><span>รอรับ</span>
        </span>
        <span class="xr-status-legend-item">
          <i class="xr-status-legend-dot is-pending" aria-hidden="true"></i><span>รอผลตรวจ</span>
        </span>
        <span class="xr-status-legend-item">
          <i class="xr-status-legend-dot is-resulted" aria-hidden="true"></i><span>ออกผลแล้ว</span>
        </span>
        <span class="xr-status-legend-item">
          <i class="xr-status-legend-dot is-cancelled" aria-hidden="true"></i><span>ยกเลิก</span>
        </span>
      </div>
    </div>
  </section>

  <div v-if="view.configWarning" class="xr-notice is-warning">{{ view.configWarning }}</div>
  <div v-if="view.serverNote" class="xr-notice is-warning">{{ view.serverNote }}</div>
  <div v-if="view.dataNote" class="xr-notice is-warning">{{ view.dataNote }}</div>
  <div v-if="view.modalityNote" class="xr-notice">{{ view.modalityNote }}</div>

  <div v-if="loading" class="xr-list-summary">กำลังโหลดรายการ…</div>
  <div v-else-if="errorMessage" class="xr-list-summary is-error">
    {{ errorMessage }} <el-button size="small" @click="loadOrders">ลองใหม่</el-button>
  </div>
  <div v-else class="xr-list-summary">{{ view.summary }}</div>

  <section class="xr-worklist-shell" aria-label="รายการผู้ป่วย">
    <div class="xr-worklist">
      <div class="xr-list-head" aria-hidden="true">
        <div></div><div>ผู้ป่วย</div><div></div><div>รายการตรวจ</div><div>เครื่อง</div>
        <div>เวลาสั่ง / Order No.</div><div>แพทย์ / Diagnosis</div><div>สถานะ</div><div></div>
      </div>

      <article v-for="row in view.rows" :key="row.id" class="xr-patient-block"
        :class="{'is-open':isExpanded(row.id)}">
        <div class="xr-patient-row" @click="toggleOrderFromRow(row,$event)">
          <button class="xr-expand-button" type="button"
            :aria-label="isExpanded(row.id)?'ย่อรายละเอียด':'ขยายรายละเอียด'"
            :aria-expanded="isExpanded(row.id)" @click="toggleOrder(row.id)">
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
            <!-- แถบเตือนแพ้ยา / COVID (ผู้ใช้ขอ 2026-09-03) — ข้อมูลมาจาก EMR ผ่าน API เท่านั้น
                 ห้ามเดาเอง · ไม่มีข้อมูล = ไม่ขึ้นกล่อง ห้ามขึ้นกล่องเปล่าให้เข้าใจว่า "ไม่แพ้"
                 ข้อความเต็มดูได้ตอน hover เพราะช่องแคบและตัดด้วย ellipsis -->
            <div v-if="row.alert_text" class="xr-alert-box" role="alert" :title="row.alert_full">
              <span>{{ row.alert_text }}</span>
            </div>
            <div class="xr-context-top">
              <span v-if="row.room" class="xr-inline-tag xr-meta-pill xr-source-pill">{{ row.room }}</span>
              <span v-if="row.show_cash_payment" class="xr-inline-tag xr-meta-pill xr-payment-pill"
                :class="{'is-unpaid':!row.finance_passed}">{{ row.finance_passed ? 'ชำระเงินแล้ว' : 'ยังไม่ได้ชำระเงิน' }}</span>
              <span v-if="row.coverage" class="xr-inline-tag xr-meta-pill xr-coverage-pill">{{ row.coverage }}</span>
            </div>
          </div>

          <div class="xr-metric xr-test-cell" data-label="รายการตรวจ">
            <el-tooltip placement="top" :disabled="!row.test_count" popper-class="xray-cpoe-test-popper">
              <span class="xr-test-count">{{ row.test_summary }}</span>
              <template #content>
                <div v-for="line in row.test_list" :key="line" class="xr-test-pop-line">{{ line }}</div>
              </template>
            </el-tooltip>
          </div>

          <div class="xr-metric xr-modality-cell" data-label="เครื่อง">
            <span v-for="m in row.modalities" :key="m.code" class="xr-modality-tag"
              :title="m.label">{{ m.code }}</span>
          </div>

          <div class="xr-metric xr-order-cell" data-label="เวลาสั่ง / Order No.">
            <span v-if="row.order_no" class="xr-order-no-tag">{{ row.order_no }}</span>
            <span class="xr-field-value xr-time-value xr-mono">
              <span>{{ row.ordered_date }}</span><span>{{ row.ordered_time }}</span>
            </span>
          </div>

          <div class="xr-doctor-cell" data-label="แพทย์">
            <span class="xr-field-value" :title="row.doctor">{{ row.doctor }}</span>
            <el-tooltip placement="top" :disabled="!row.dx_has" popper-class="xray-cpoe-dx-popper">
              <span class="xr-diagnosis-summary">{{ row.dx_short }}</span>
              <template #content><div class="xr-dx-pop">{{ row.dx_full }}</div></template>
            </el-tooltip>
          </div>

          <!-- เช็คลิสต์สถานะระดับ order — 4 ช่องตามเส้นทางจริงของ item
               รอรับ · รอผลตรวจ · ออกผลแล้ว · ยกเลิก/ปฏิเสธ
               มีรายการค้างที่ขั้นนี้ = จุดสี + จำนวน · ผ่านขั้นนี้ไปแล้ว = จุดสี + เครื่องหมายถูก
               ยังไม่ถึง = เว้นว่าง · hover ดอตเห็นชื่อสถานะ hover ทั้งช่องเห็นสรุปทั้งใบ -->
          <div class="xr-row-status-check" role="img" :aria-label="row.status_aria" :title="row.status_aria">
            <span v-for="step in row.status_steps" :key="step.key" class="xr-status-step"
              :class="[step.dot_class,{'is-on':step.active||step.done,'is-done':step.done}]"
              :title="step.title">
              <i class="xr-status-dot" aria-hidden="true"></i>
              <b v-if="step.active" class="xr-status-count">{{ step.count }}</b>
              <svg v-else-if="step.done" class="xr-status-check" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M2.4 6.4 4.9 8.9 9.6 3.4"></path>
              </svg>
            </span>
          </div>

          <div class="xr-row-actions">
            <!-- PDF ตรงนี้คือใบสั่งตรวจระดับ Order เท่านั้น
                 ปุ่ม PDF ของผลอ่านระดับ item ถูกตัดออก 2026-09-03 (ผู้ใช้ขอ)
                 และยังห้ามมี PDF ผลอ่านระดับ Order เหมือนเดิม เพราะผลกลับมาเป็นรายรายการ
                 และอาจเสร็จคนละเวลา (ยืนยัน 2026-09-02) -->
            ${orderRequestPdfAction}
            ${hnPrintAction}
            <el-button v-if="!row.cancelled" class="xr-plain-action" size="small"
              @click="openEmr(row)">EMR</el-button>
            <!-- 2026-09-18: ปุ่มสรุปเปิดรายการให้เลือกก่อน ห้ามตรวจใหม่ทั้ง Order โดยไม่ติ๊ก item -->
            <el-button v-else class="xr-plain-action" size="small" type="warning" plain
              title="เปิดรายการเพื่อเลือก X-ray ที่ต้องการตรวจใหม่"
              @click="openRetestSelection(row)">ตรวจใหม่</el-button>
          </div>
        </div>

        <div v-if="isExpanded(row.id)" class="xr-detail-panel">
          <div class="xr-detail-top" role="tablist">
            <button class="xr-detail-tab" :class="{'is-active':detailTab(row.id)==='order'}" type="button"
              role="tab" :aria-selected="detailTab(row.id)==='order'"
              @click="setDetailTab(row.id,'order')">order</button>
            <button class="xr-detail-tab" :class="{'is-active':detailTab(row.id)==='results'}" type="button"
              role="tab" :aria-selected="detailTab(row.id)==='results'"
              :title="row.has_result?'ดูผลอ่านของ order นี้':'ยังไม่มีผลอ่าน — เปิดดูโครงตารางได้'"
              @click="setDetailTab(row.id,'results')">ผลอ่าน</button>
            <div class="xr-bulk-actions">
              <el-tooltip v-if="row.can_dispatch" placement="top" :disabled="!row.dispatch_disabled_reason"
                :content="row.dispatch_disabled_reason" popper-class="xray-cpoe-list-popper">
                <span class="xr-dispatch-tooltip">
                  <el-button size="small" type="success" :loading="row.dispatching"
                    :disabled="row.dispatching||row.rejecting||row.retesting||!row.dispatch_ready"
                    :title="row.dispatch_hint"
                    @click="dispatchOrder(row)">{{ row.dispatch_label }}</el-button>
                </span>
              </el-tooltip>
              <el-button v-if="row.can_reject" size="small" type="warning"
                :loading="row.rejecting"
                :disabled="row.dispatching||row.rejecting||!row.reject_ready"
                :title="row.reject_hint"
                @click="rejectSelected(row)">ปฏิเสธรายการ</el-button>
              <el-button v-if="!row.cancelled" size="small" type="danger"
                :loading="cancelDialog.loading&&cancelDialog.order_id===row.id"
                :disabled="row.dispatching||row.rejecting||cancelDialog.loading||!row.can_cancel"
                :title="row.cancel_hint"
                @click="openCancelOrder(row)">ยกเลิกรายการที่เลือก</el-button>
              <el-button v-if="row.can_retest" size="small" type="warning" plain
                :loading="row.retesting"
                :disabled="row.retesting||row.dispatching||row.rejecting||!row.retest_ready"
                :title="row.retest_hint"
                @click="retestOrder(row)">ตรวจใหม่เฉพาะที่เลือก</el-button>
            </div>
          </div>

          <div v-if="detailTab(row.id)==='order'" class="xr-item-grid-wrap">
            <div class="xr-item-grid xr-item-head" aria-hidden="true">
              <div class="xr-item-check-cell"><el-checkbox :model-value="allSelectableSelected(row)"
                :indeterminate="someSelectableSelected(row)" :disabled="!selectableItemIds(row).length"
                aria-label="เลือกทุกรายการที่ดำเนินการได้" @change="toggleAllItems(row)" /></div>
              <div>Accession No.</div><div>รายการตรวจ</div><div>เครื่อง</div>
              <div>เวลาส่งเข้าเครื่อง</div><div>Radiographer</div><div>Radiologist</div><div>สถานะ</div><div>ปฏิเสธ</div><div>คนปฏิเสธ</div><div>สติ๊กเกอร์ HN</div><div>สารทึบ</div>
            </div>
            <div v-for="item in row.items" :key="item.id" class="xr-item-grid xr-item-row"
              :class="{'is-selectable':item.can_select,'is-selected':item.selected}"
              @click="selectRow(item,$event)">
              <div data-label="เลือก" class="xr-item-check-cell">
                <el-checkbox :model-value="item.selected" :disabled="!item.can_select"
                  @change="toggleItem(item.id)" />
              </div>
              <div data-label="Accession No." class="xr-mono">{{ item.accession_no }}<span
                v-if="item.ris_status_label" class="xr-ris-chip" :class="item.ris_status_class"
                :title="item.ris_status_title">{{ item.ris_status_label }}</span></div>
              <div data-label="รายการตรวจ" class="xr-test-name">
                {{ item.name }}<span class="xr-mono xr-test-code-inline">{{ item.code }}</span>
              </div>
              <div data-label="เครื่อง" class="xr-item-modality"><span v-if="item.modality" class="xr-modality-tag" :title="item.modality_label">{{ item.modality }}</span></div>
              <div data-label="เวลาส่งเข้าเครื่อง" class="xr-mono">
                {{ item.dispatched_text }}
                <span v-if="item.transport_failed" class="xr-transport-note">{{ item.transport_note }}</span>
                <span v-else-if="item.needs_accession" class="xr-transport-note">ยังไม่ได้เลข Accession · กดส่งเข้าเครื่องอีกครั้ง</span>
              </div>
              <!-- คอลัมน์นี้เคยเป็น "ผู้ส่ง" (คนกดส่งเข้าเครื่อง) — ผู้ใช้ให้เปลี่ยนเป็น Radiographer
                   2026-09-03 · ค่าเดิมไม่ได้หายไป ยังอยู่ใน item.dispatched_by และโชว์ตอน hover
                   2026-09-30 เชื่อม Member Master แล้ว: เลือกได้เฉพาะบุคลากรสาย Radiographer -->
              <div data-label="Radiographer" class="xr-item-radiographer"
                :title="item.dispatched_by?('ผู้กดส่งเข้าเครื่อง: '+item.dispatched_by):''">
                <el-select :model-value="item.radiographer" size="small" clearable filterable
                  :loading="staffOptionsLoading || item.radiographer_saving" :disabled="item.radiographer_saving"
                  placeholder="เลือก Radiographer" :aria-label="'Radiographer ของ '+item.name"
                  @change="value=>setRadiographer(row,item,value)">
                  <el-option v-for="tech in radiographerOptions" :key="tech.member_id||tech.value"
                    :label="tech.label" :value="tech.value" />
                </el-select>
              </div>
              <!-- 2026-09-30 เชื่อม Member Master: เลือกแพทย์ประจำจาก master ได้
                   และ allow-create สำหรับพิมพ์ชื่อแพทย์ภายนอกโดยไม่สร้าง Member ปลอม -->
              <div data-label="Radiologist" class="xr-item-radiologist">
                <el-select :model-value="item.radiologist" size="small" clearable filterable
                  allow-create default-first-option
                  :loading="staffOptionsLoading || item.radiologist_saving" :disabled="item.radiologist_saving"
                  placeholder="เลือกหรือพิมพ์ Radiologist" :aria-label="'Radiologist ของ '+item.name"
                  @change="value=>setRadiologist(row,item,value)">
                  <el-option v-for="doc in radiologistOptions" :key="doc.member_id||doc.value"
                    :label="doc.label" :value="doc.value" />
                </el-select>
              </div>
              <div data-label="สถานะ"><span class="xr-state-tag" :class="item.status_class">{{ item.status_label }}</span></div>
              <div data-label="ปฏิเสธ">{{ item.reject_reason }}</div>
              <div data-label="คนปฏิเสธ">{{ item.rejected_by }}</div>
              <div data-label="สติ๊กเกอร์ HN" class="xr-item-sticker-action">
                <sd-report v-if="itemStickerReady(row,item)" class="xr-plain-action xr-item-sticker-report"
                  :report-list="hnStickerReportList" :params="itemStickerParams(row,item)" size="small" />
                <el-button v-else class="xr-plain-action" size="small" disabled
                  :title="item.sticker_hint">สติ๊กเกอร์ HN</el-button>
              </div>
              <!-- คอลัมน์ "สารทึบ" (ผู้ใช้เลือกตัวเลือก A 2026-09-23) — อยู่ระดับ item
                   เพราะใบเดียวมีได้ทั้งรายการที่ฉีดและรายการที่ไม่ฉีด
                   🔴 ไม่มีข้อมูล = "ยังไม่ได้บันทึก" เท่านั้น ห้ามอ่านว่า "ไม่ได้ฉีด"
                      จึงกดได้ทุกรายการ ยังไม่กรองตาม modality เพราะผู้ใช้ยังไม่ได้ให้
                      รายชื่อเครื่องที่ฉีดได้ — เดาเองแล้วรายการที่ฉีดจริงจะกดไม่ได้
                   ปุ่มนี้ไม่แตะ can_select / สถานะ / ปุ่มเดิมของแถวสักตัว -->
              <div data-label="สารทึบ" class="xr-item-contrast">
                <button v-if="item.contrast_label" type="button" class="xr-contrast-chip"
                  :title="item.contrast_title" @click="openContrastRecord(row,item)">{{ item.contrast_label }}</button>
                <el-button v-else class="xr-plain-action" size="small"
                  :title="item.contrast_hint" @click="openContrastRecord(row,item)">+ บันทึก</el-button>
              </div>
            </div>
          </div>

          <div v-else class="xr-result-list">
            <div class="xr-result-list-head" aria-hidden="true">
              <div>ลำดับ</div><div>รายการตรวจ</div><div>เครื่อง</div><div>ผู้ส่ง</div>
              <div>เวลาออกผล</div><div>สถานะ</div><div></div>
            </div>
            <div v-for="item in row.result_items" :key="'result-'+item.id" class="xr-result-list-row">
              <div class="xr-mono">{{ item.seq }}</div>
              <div class="xr-test-name">{{ item.name }}</div>
              <div><span v-if="item.modality" class="xr-modality-tag" :title="item.modality_label">{{ item.modality }}</span></div>
              <div>{{ item.dispatched_by }}</div>
              <div class="xr-mono">{{ item.resulted_text }}</div>
              <div><span class="xr-state-tag" :class="item.state_class">{{ item.state_label }}</span></div>
              <div class="xr-result-action-group">
                <!-- กดดูได้เสมอ ยังไม่มีผลก็เปิดดูสถานะรอผลได้ (ผู้ใช้ขอ 2026-09-02) -->
                <el-button size="small" type="primary" @click="openReport(row,item)">ดูผล</el-button>
                <!-- ── เปลี่ยนเป็นลิงก์จริง 2026-09-17 (ผู้ใช้เจอของจริง) ──────────────
                     ของเดิมเป็นปุ่มที่เรียก window.open() ด้วย JS ⇒ เบราว์เซอร์นับเป็น
                     "ป๊อปอัปที่สคริปต์สั่งเปิด" แล้วบล็อก · ผู้ใช้ตั้ง Allow ให้โดเมนนี้แล้ว
                     ก็ยังโดนบล็อก เพราะหน้าฟอร์มถูกฝังใน iframe ที่ไม่อนุญาต popup
                     ⇒ ตั้งค่าเบราว์เซอร์แก้ไม่ได้ ต้องเป็น <a> ที่คน "คลิกเอง" จริง ๆ
                     ซึ่งเบราว์เซอร์ไม่เคยบล็อก (เป็น navigation ไม่ใช่ popup)
                     🔴 ไม่มี URL (ยังไม่เปิดใช้ / ไม่มีทั้ง AN และ HN) = ตกกลับไปใช้ปุ่มเดิม
                        ที่บอกเหตุผลผ่าน notify เหมือนเดิมทุกประการ -->
                <a v-if="viewerHref(row,item)" class="el-button el-button--small xr-viewer-link"
                  :href="viewerHref(row,item)" target="_blank" rel="noopener noreferrer"
                  :title="imageHint(row,item)">ดูภาพ</a>
                <el-button v-else size="small" :title="imageHint(row,item)" @click="openImage(row,item)">ดูภาพ</el-button>
                <!-- ปุ่ม PDF ระดับ item ถูกตัดออก 2026-09-03 (ผู้ใช้ขอ) — item.can_pdf / pdf_hint
                     ยังคำนวณอยู่เหมือนเดิม เอาปุ่มกลับมาได้ทันทีโดยไม่ต้องรื้อ logic -->
              </div>
            </div>
            <div v-if="!row.result_items.length" class="xr-empty">ยังไม่มีผลอ่านใน Order นี้</div>
          </div>
        </div>
      </article>

      <div v-if="!loading && !view.rows.length" class="xr-empty">
        <strong>ไม่พบรายการ</strong><br />
        <template v-if="scanMode">ไม่พบ Order ของ {{ scanLabel }} {{ scanDisplay }} ในสถานะนี้ · ลองเปลี่ยนแท็บสถานะ หรือกดล้างเลขที่สแกน</template>
        <template v-else>ลองเปลี่ยนคำค้น เครื่อง ช่วงวันที่ หรือสถานะ</template>
      </div>
    </div>
  </section>

  <div v-if="page.total>page.size" class="xr-pagination">
    <el-pagination :current-page="page.current" :page-size="page.size"
      :page-sizes="[10,20,30,50,100]" :total="page.total" size="small" background
      layout="total, sizes, prev, pager, next, jumper"
      @current-change="setPage" @size-change="setPageSize" />
  </div>

  <el-dialog :model-value="cancelDialog.visible" title="ยกเลิกรายการ X-ray" width="min(560px,94vw)"
    :close-on-click-modal="false" :close-on-press-escape="!cancelDialog.loading"
    :show-close="!cancelDialog.loading"
    @update:model-value="setCancelVisible" @closed="resetCancelDialog">
    <div class="xr-cancel-summary">
      <strong>Order No. {{ cancelDialog.order_no }}</strong>
      <span>ยกเลิกเฉพาะ {{ cancelDialog.item_names.length }} รายการที่เลือก: {{ cancelDialog.item_names.join(', ') }}</span>
      <span>รายการที่ส่งแล้วจะส่ง Order JSON เดิมพร้อม IsDeleted:true ไป API Order ทีมก่อนเปลี่ยนสถานะใน HIS · ทีม API Order รับผิดชอบส่งต่อ RIS</span>
    </div>
    <label class="xr-cancel-reason"><span>เหตุผลการยกเลิก <b>*</b></span>
      <el-input :model-value="cancelDialog.reason" type="textarea" :rows="4" maxlength="1000"
        show-word-limit :disabled="cancelDialog.loading" placeholder="ระบุเหตุผลการยกเลิกรายการ"
        @update:model-value="setCancelReason" />
    </label>
    <template #footer>
      <el-button :disabled="cancelDialog.loading" @click="setCancelVisible(false)">ไม่ยกเลิก</el-button>
      <el-button type="danger" :loading="cancelDialog.loading" :disabled="!cancelDialog.reason||!cancelDialog.item_ids.length"
        @click="submitCancelOrder">ยืนยันยกเลิกรายการที่เลือก</el-button>
    </template>
  </el-dialog>

  <el-dialog :model-value="report.visible" title="ผลอ่าน" width="min(1060px,96vw)"
    :close-on-click-modal="false" destroy-on-close
    @update:model-value="setReportVisible" @closed="resetReport">
    <div v-loading="report.loading" class="xr-report-doc">
      <div class="xr-report-head">
        <div><span>โหมด</span><span class="xr-mode-badge">โหมดดูอย่างเดียว</span></div>
        <div><span>รายการตรวจ</span><strong :title="report.data.test_name">{{ report.data.test_name }}</strong><small>{{ report.data.test_code }}</small></div>
        <div><span>เครื่อง</span><strong><span v-if="report.data.modality_code" class="xr-report-modality"
          :title="report.data.modality_label">{{ report.data.modality_code }}</span></strong></div>
        <div><span>Accession No.</span><strong class="xr-mono">{{ report.data.accession_no }}</strong></div>
        <div><span>HN / Order No.</span><strong class="xr-mono xr-report-wrap"
          :title="report.data.patient_hn + ' / ' + report.data.order_number">{{ report.data.patient_hn }} / {{ report.data.order_number }}</strong></div>
        <div><span>เวลาถ่าย</span><strong class="xr-mono">{{ report.data.performed_text }}</strong></div>
        <div><span>เวลาออกผล</span><strong class="xr-mono">{{ shownReported() }}</strong></div>
      </div>

      <!-- ── ประวัติการแก้ผลอ่าน (เพิ่ม 2026-09-15 · ผู้ใช้อนุมัติดีไซน์แล้ว) ──────
           RIS insert แถวใหม่ทุกครั้ง ⇒ ทุกฉบับถูกเก็บไว้ครบใน zdata_xray_result
           API คืน data.versions[] (ใหม่→เก่า) · versions[0] คือฉบับล่าสุดเสมอ
           🔴 Process รุ่นเก่าที่ยังไม่คืน versions[] ⇒ versions ว่าง แล้ว dialog
              ตกกลับไปหน้าตาเดิมทุกประการ (ข้อความ version_note เดิม + ผลก้อนเดียว) -->
      <div v-if="report.versions.length > 1" class="xr-rev-bar">
        <el-button size="small" :type="report.history_open ? 'primary' : ''" plain
          @click="toggleReportHistory">ประวัติการแก้ {{ report.versions.length }} ฉบับ</el-button>
        <span class="xr-rev-note">{{ report.data.version_summary }}</span>
      </div>
      <div v-else-if="report.data.version_stale" class="xr-report-pending">{{ report.data.version_stale }}</div>
      <div v-else-if="report.data.version_note" class="xr-report-pending">{{ report.data.version_note }}</div>

      <div v-if="report.history_open && report.versions.length && !currentReportVersion().latest"
        class="xr-rev-alert" role="alert">
        <span>กำลังดูฉบับที่ {{ currentReportVersion().no }} ซึ่งถูกแทนที่แล้ว — ไม่ใช่ผลที่ใช้อ้างอิง</span>
        <el-button size="small" @click="goLatestReportVersion">ไปฉบับล่าสุด</el-button>
      </div>

      <div v-if="report.data.has_report" class="xr-rev-split"
        :class="{'is-solo':!report.history_open || report.versions.length < 2}">
        <nav v-if="report.history_open && report.versions.length > 1" class="xr-rev-rail"
          aria-label="ประวัติผลอ่าน">
          <div class="xr-rev-rail-head">ไทม์ไลน์ · ใหม่ → เก่า</div>
          <div class="xr-rev-rail-list">
            <button v-for="(ver,vi) in report.versions" :key="'ver-'+vi" type="button"
              class="xr-rev-node" :class="{'is-latest':ver.latest,'is-current':report.selected===vi}"
              :aria-current="report.selected===vi ? 'true' : 'false'" @click="selectReportVersion(vi)">
              <span class="xr-rev-mark" aria-hidden="true"><i class="xr-rev-dot"></i><i class="xr-rev-line"></i></span>
              <span class="xr-rev-node-body">
                <span class="xr-rev-node-top">
                  <b>ฉบับที่ {{ ver.no }}</b>
                  <em class="xr-rev-tag" :class="ver.latest ? 'is-latest' : 'is-old'">{{ ver.latest ? 'ล่าสุด' : 'ถูกแทนที่' }}</em>
                </span>
                <span class="xr-rev-node-when xr-mono">{{ ver.reported_text }}</span>
                <span class="xr-rev-node-who">รังสีแพทย์ {{ ver.radiologist || '—' }}</span>
              </span>
            </button>
          </div>
        </nav>

        <div class="xr-rev-panel">
          <div class="xr-rev-panel-head">
            <h3>ผลอ่าน<template v-if="report.history_open && report.versions.length > 1"> ฉบับที่ {{ currentReportVersion().no }}<template v-if="currentReportVersion().latest"> (ล่าสุด)</template></template></h3>
            <el-checkbox v-if="report.history_open && report.versions.length && currentReportVersion().has_previous"
              class="xr-rev-diff" :model-value="report.diff" size="small"
              @change="setReportDiff">ไฮไลต์ส่วนที่ต่างจากฉบับก่อน</el-checkbox>
          </div>
          <p v-if="report.versions.length" class="xr-report-body">
            <span v-for="(ln,li) in currentReportVersion().lines" :key="'ln-'+li"
              class="xr-rev-ln" :class="{'is-changed':ln.changed && report.diff,'is-head':ln.head}">{{ ln.text }}</span>
          </p>
          <p v-else class="xr-report-body">{{ report.data.result_text }}</p>

          <div v-if="report.history_open && report.versions.length" class="xr-rev-kv">
            <div><span>เวลาออกผล</span><strong class="xr-mono">{{ currentReportVersion().reported_text || '—' }}</strong></div>
            <div><span>รังสีแพทย์</span><strong class="xr-mono">{{ currentReportVersion().radiologist || '—' }}</strong></div>
            <div><span>สถานะผล</span><strong>{{ currentReportVersion().status_label || '—' }}</strong></div>
            <div><span>HIS รับเมื่อ</span><strong class="xr-mono">{{ currentReportVersion().received_text || '—' }}</strong></div>
            <div><span>Message Control Id</span><strong class="xr-mono">{{ currentReportVersion().message_control_id || '—' }}</strong></div>
          </div>
        </div>
      </div>

      <div v-if="!report.data.has_report && !report.loading" class="xr-report-pending">
        {{ report.data.pending_message }}
      </div>

      <!-- ช่อง "ผู้รับรองผล" ถูกตัดออก 2026-09-03 (ผู้ใช้ขอ) — มันยังไม่มีที่เก็บฝั่ง server
           อยู่แล้ว · state certified_by / setReportCertifier ยังอยู่ครบ เอากลับมาแสดงได้ทันที -->

      <!-- ท้าย dialog เดินตามฉบับที่กำลังดู ไม่ใช่ฉบับล่าสุดเสมอไป — ไม่งั้นเปิดฉบับเก่า
           แล้วชื่อคนอ่านกับเวลายังเป็นของอีกฉบับ ซึ่งอ่านแล้วเข้าใจผิดได้ทันที
           ไม่มี versions (Process เก่า) = ค่าเดิมจาก report.data เหมือนเดิมทุกประการ -->
      <div class="xr-report-foot">
        <span>รหัสรังสีแพทย์: {{ shownRadiologist() }}</span>
        <span v-if="shownSeverity()">Severity: {{ shownSeverity() }}</span>
        <span>{{ shownReported() }}</span>
      </div>
    </div>
    <template #footer>
      <el-button @click="setReportVisible(false)">ปิด</el-button>
    </template>
  </el-dialog>
</div>`

widget.options.onCreated = `const s=this.vueState;
const field=this;

/* ── Process ID ────────────────────────────────────────────────────────────
   xray-cpoe-worklist — source: Form-Builder/API/api-factory/processes/xray_cpoe_worklist_api.js
   ผู้ใช้แจ้ง Process ID 2026-08-31; ยังไม่ยืนยัน deployed runtime
   contract ที่ฟอร์มนี้เรียก:
     {action:'list', organization_code, statuses[], modality, q, hn,
      date_from, date_to, page, limit}
       → {success, data:{orders[], total, page, limit, modalities[], counts{}}}
     {action:'get_report', organization_code, order_id, item_id}
       → {success, data:{findings, impression, radiologist, reported_at, …}}   */
const WORKLIST_PROCESS_ID='6a957009422c1ca959829e45';
/* หมายเหตุ: ฟอร์มไม่เรียก xray-accession-generate (6a95cd58422c1ca959829e8d) เอง
   เลข Accession ออกโดย dispatch ฝั่ง server เท่านั้น เพื่อไม่ให้มีทางที่สองที่ทำให้
   ได้เลขมาแต่ยังไม่ได้รับและ RIS ไม่รู้เรื่อง (ผู้ใช้ทักท้วง 2026-09-01) */
/* xray-cpoe-dispatch — source: Form-Builder/API/api-factory/processes/xray_cpoe_dispatch_api.js
   ผู้ใช้แจ้ง Process ID 2026-09-01
   contract ที่ฟอร์มนี้เรียก:
     {order_id, item_id, retry_only?} → {success, accession_no,
                                transport:{status,ack,error}, items[], message}
   **ส่งได้ครั้งละ 1 รายการ** (ผู้ใช้ยืนยัน 2026-09-01) — 1 order มีได้หลาย test
   และหลาย accession แต่กดส่งทีละรายการ เพราะผลอ่านกลับมาเป็นราย item
   ลำดับฝั่ง server: ออกเลข → บันทึกรับ → ส่ง RIS ด้วย API ของทีม → เก็บผล transport */
const DISPATCH_PROCESS_ID='6a967029422c1ca959829edc';
/* xray-cpoe-reject — source: Form-Builder/API/api-factory/processes/xray_cpoe_reject_api.js
   ยังไม่ได้ deploy: paste เข้า API Factory แล้วเอา Process ID มาใส่ที่นี่
   ฟอร์มเหตุผลการปฏิเสธของรังสีก็ยังไม่ได้สร้าง — ใส่ Form ID เมื่อมีแล้ว
   ทั้งสองค่าว่างอยู่ ปุ่มปฏิเสธจะยังกดไม่ได้และบอกสาเหตุตรง ๆ ไม่เงียบหาย */
const REJECT_PROCESS_ID='';
const REJECTION_FORM_ID='';
/* ฟอร์มที่ปุ่ม "สร้างรายการใหม่" เปิด — ตั้งค่าตอน generate ผ่าน XRAY_CPOE_ORDER_APP_ID
   (ค่าเริ่มต้นคือ CPOE Order App ตัวจริง) ⇒ สลับไปฟอร์มโคลนได้โดยไม่ต้องแก้โค้ดในนี้ */
const CPOE_ORDER_APP_ID='${cpoeOrderAppId}';
/* คลัง PDF หนังสือยินยอม — ต้องได้ Form ID หลัง import ฟอร์มแยก */
const CONSENT_LIBRARY_FORM_ID='${consentLibraryFormId}';
/* ฟอร์มบันทึกการใช้สารทึบรังสี ระดับ item — ว่าง = ยังไม่ได้ import (ดูคอมเมนต์ที่ generator) */
const CONTRAST_FORM_ID='${contrastFormId}';
/* EMR History — ผู้ใช้แจ้ง Form ID 2026-09-01 · LAB ผูกตัวนี้แล้วและใช้งานได้จริง
   ทรงการเรียกลอกจาก lab-cpoe-worklist ทุกตัวอักษร: arg ที่ 3 เป็น '' ไม่ใช่ visit_id
   (visit_id ส่งทาง params) ของเดิม X-ray ส่งเป็น dataId ซึ่งเป็นคนละความหมาย */
const EMR_FORM_ID='6a96557e422c1ca959829eae';
/* X-ray Order Request v1 — Report Factory clone ที่ผู้ใช้ทดสอบ Preview แล้ว */
const ORDER_REQUEST_REPORT_ID='${orderRequestReportId}';
/* ป้ายติดแฟ้มระดับ Order — Report เดิมรับ xparentx เป็น Visit ID */
const HN_ORDER_REPORT_ID='${hnOrderReportId}';
/* สติ๊กเกอร์ HN + Accession No. ขนาด 8.5 × 2 ซม. · อยู่ระดับ item */
const HN_STICKER_REPORT_ID='${hnStickerReportId}';
/* โปรแกรมดูภาพของ RIS — ปุ่ม "ดูภาพ" ในแท็บผลอ่าน (ดูคอมเมนต์เต็มที่ generator)
   BASE ว่างหรือ ENABLED=false ⇒ ปุ่มทำตัวเหมือนเดิมเป๊ะ (แจ้งว่ารอเชื่อมต่อ ไม่เปิดแท็บ) */
const RIS_VIEWER_BASE='${risViewerBase}';
const RIS_VIEWER_ENABLED=${risViewerEnabled ? 'true' : 'false'};

s.orders=[];
s.dispatching={};
s.rejecting={};
s.selected={};
s.loading=false;
s.createOrderLoading=false;
s.createOrderNotice='';
s.__createOrderNoticeTimer=null;
s.dismissCreateOrderNotice=()=>{
  if(s.__createOrderNoticeTimer)clearTimeout(s.__createOrderNoticeTimer);
  s.__createOrderNoticeTimer=null;
  s.createOrderNotice='';
};
s.showCreateOrderNotice=message=>{
  s.dismissCreateOrderNotice();
  s.createOrderNotice=s.text(message);
  s.__createOrderNoticeTimer=setTimeout(()=>s.dismissCreateOrderNotice(),3500);
};
s.errorMessage='';
s.expanded={};
s.detailTabs={};
s.filters={q:'',dates:[]};
s.loadedQuery='';
/* โหมดผู้ป่วยจากการสแกนบาร์โค้ด HN — pattern เดียวกับ LAB (2026-09-02)
   เพิ่มเลขบัตร 13 หลัก 2026-09-17; HN เดิมยังส่ง hn แบบ exact เหมือนเดิม
   คงตัวระบุไว้เมื่อสลับแท็บสถานะ จนกว่าจะกดล้างหรือกด Search เอง
   สแกนไม่เปลี่ยนสถานะ ไม่ออกเลข ไม่ส่งเข้าเครื่อง — อ่านอย่างเดียวล้วน */
s.resetScan=()=>{s.scanMode=false;s.scanType='hn';s.scannedHn='';s.scannedCitizenId='';s.scanLabel='HN';s.scanDisplay='';s.scanNoticePending=false;};
s.resetScan();
/* โหมดเปิดจากคิว (เพิ่ม 2026-09-08) — กางเฉพาะใบของ visit เดียว
   แยกจาก scanMode เพราะสองโหมดนี้ตีกัน: สแกนคือราย HN ทุกวัน ส่วนนี่คือราย visit
   ทั้งคู่จึงล้างอีกฝั่งทิ้งเมื่อถูกเปิดใช้ */
s.focusVisitId='';
s.focusVisitVn='';
/* เลือกเครื่องได้หลายตัว (ผู้ใช้ขอ 2026-09-02) — เก็บเป็น array ของ code
   ว่าง = ไม่กรอง ซึ่งให้ผลเท่ากับ "Select all" เดิมทุกประการ */
s.modality=[];
/* ผู้ใช้เลือกลำดับการจัดเรียงเองได้ (ผู้ใช้ขอ 2026-09-25 · TOR §3.4.3.1)
   latest = ลำดับเดิมทุกประการ และเป็นค่าเริ่มต้น ⇒ ไม่ส่ง sort ไป API เลย */
s.sortKey='latest';
s.sortOptions=[
  {value:'latest',label:'เวลาสั่งล่าสุดก่อน'},
  {value:'oldest',label:'เวลาสั่งเก่าสุดก่อน'}
];
s.modalityMaster=[];
s.modalityPool=[];
s.statusKey='all';
s.counts={all:0,active:0,complete:0,cancelled:0};
s.page={current:1,size:30,total:0};
s.dateScope={from:'',to:'',defaulted:false};
s.serverMessage='';
s.unmapped=0;
s.loadSeq=0;
s.countSeq=0;
s.report={visible:false,loading:false,order:null,item:null,data:{},certified_by:'',versions:[],selected:0,history_open:false,diff:true};
s.consentLibraryHint=CONSENT_LIBRARY_FORM_ID
  ?'เปิดคลังเอกสาร X-ray เพื่อดูตัวอย่างและพิมพ์ PDF'
  :'ยังไม่ได้เชื่อมคลังเอกสาร X-ray — import ฟอร์มแยกแล้วตั้ง XRAY_CONSENT_LIBRARY_FORM_ID';
s.contrastHint=CONTRAST_FORM_ID
  ?'บันทึกการใช้สารทึบรังสีของรายการนี้'
  :'ยังไม่ได้เชื่อมฟอร์มบันทึกการใช้สารทึบรังสี — import xray-contrast-media-record-v1 แล้วตั้ง XRAY_CONTRAST_FORM_ID';
s.orderRequestReportList=ORDER_REQUEST_REPORT_ID?[{reportId:ORDER_REQUEST_REPORT_ID,label:'PDF',type:'pdf'}]:[];
s.hnOrderReportList=HN_ORDER_REPORT_ID?[{reportId:HN_ORDER_REPORT_ID,label:'HN',type:'pdf'}]:[];
s.hnStickerReportList=HN_STICKER_REPORT_ID?[{reportId:HN_STICKER_REPORT_ID,label:'สติ๊กเกอร์ HN',type:'pdf'}]:[];
/* ยกเลิกทั้งใบ — เหตุผลเป็น free text บังคับกรอก ไม่ต้องมีฟอร์มแยกเหมือนการปฏิเสธ
   (ทรงเดียวกับ LAB ที่ใช้งานจริงแล้ว) */
s.cancelDialog={visible:false,loading:false,order_id:'',order_no:'',item_ids:[],item_names:[],reason:''};
/* ── X-ray Member Master (ผู้ใช้ยืนยันให้เชื่อม 2026-09-30) ────────────────
   อ่านรายชื่อจาก Form จริง ไม่ hard-code ชื่อบุคลากรใน Worklist
   · Radiographer: เฉพาะ RADIOGRAPHER_* และห้ามพิมพ์คนใหม่
   · Radiologist: เฉพาะ RADIOLOGIST_*; ช่อง UI อนุญาต free text สำหรับหมอนอก
   ฟิลด์ชื่อเดิมยังเก็บเป็น string เพื่อให้ข้อมูล/รายงานรุ่นเก่าอ่านต่อได้ ส่วน _source และ
   _member_id เป็น metadata ใหม่ที่ช่วยแยก master กับ external โดยไม่เปลี่ยน flow อื่น */
const XRAY_MEMBER_FORM_ID='6abcb7c0c54b3f93ce7a0489';
const XRAY_MEMBER_PROVIDER={providerId:XRAY_MEMBER_FORM_ID,providerType:'FORM',params:{},options:{limit:200,page:1}};
const RADIOGRAPHER_POSITIONS=['RADIOGRAPHER_PRO','RADIOGRAPHER_PRACTICE'];
const RADIOLOGIST_POSITIONS=['RADIOLOGIST_PRO','RADIOLOGIST_SENIOR'];
s.radiologistOptions=[];
s.radiographerOptions=[];
s.staffOptionsLoading=false;
s.staffOptionsLoaded=false;
s.extractRows=out=>{
  const picks=[out,out&&out.data,out&&out.rows,out&&out.data&&out.data.data,
    out&&out.data&&out.data.rows,out&&out.reply&&out.reply.data];
  for(let i=0;i<picks.length;i++)if(Array.isArray(picks[i]))return picks[i];
  return [];
};
s.memberPosition=row=>s.text(row&&row.position&&row.position.value)||s.text(row&&row.position);
s.memberName=row=>{
  const prename=s.text(row&&row.prename),first=s.text(row&&row.first_name),last=s.text(row&&row.last_name);
  return [prename+first,last].filter(Boolean).join(' ').replace(/\\s+/g,' ').trim();
};
s.memberOption=row=>({
  value:s.memberName(row),label:s.memberName(row),member_id:s.text(row&&row._id),
  source:'master',position:s.memberPosition(row),professional_code:s.text(row&&row.professional_code)
});
s.loadStaffOptions=()=>{
  if(s.staffOptionsLoading)return;
  const api=s.api();
  if(!api||typeof api.crudGetAll!=='function'){
    field.notify('โหลด X-ray Member Master ไม่สำเร็จ: ไม่พบ Form connector','error',5200);return;
  }
  s.staffOptionsLoading=true;
  api.crudGetAll({sdProvider:XRAY_MEMBER_PROVIDER,totalEnable:true},out=>{
    const rows=s.extractRows(out).filter(row=>![0,3].includes(Number(row&&row.xrstatx)));
    const options=rows.map(s.memberOption).filter(option=>option.value&&option.member_id);
    s.radiographerOptions=options.filter(option=>RADIOGRAPHER_POSITIONS.includes(option.position));
    s.radiologistOptions=options.filter(option=>RADIOLOGIST_POSITIONS.includes(option.position));
    s.staffOptionsLoaded=true;
    s.staffOptionsLoading=false;
  },error=>{
    s.staffOptionsLoading=false;
    field.notify('โหลด X-ray Member Master ไม่สำเร็จ: '+(s.text(error&&error.message)||'ตรวจสอบสิทธิ์อ่านฟอร์ม'),'error',5200);
  });
};
s.savingStaff={};
/* แก้ค่าในข้อมูลดิบที่โหลดมา แล้ว recompute — ไม่โหลดใหม่ทั้งหน้า
   เพราะ loadOrders จะพับแถวที่กางอยู่และล้างที่ติ๊กไว้ ผู้ใช้กำลังทำงานค้างอยู่ */
s.applyItemField=(itemId,name,value)=>{
  const key=s.text(itemId);
  (Array.isArray(s.orders)?s.orders:[]).forEach(o=>{
    ((o&&Array.isArray(o.items))?o.items:[]).forEach(i=>{
      if((s.text(i&&i.item_id)||s.text(i&&i._id))===key)i[name]=value;
    });
  });
};
/* บันทึกสอง selector ด้วย contract เดียวกัน (แก้ตามผู้ใช้ 2026-09-30)
   server เป็นผู้ตรวจ member_id + ตำแหน่งซ้ำอีกชั้น; จอ optimistic แต่ต้องย้อนทุก field
   ถ้าบันทึกล้มเหลว เพื่อไม่ให้ชื่อที่ไม่ได้ลงฐานข้อมูลค้างหลอกผู้ใช้ */
s.staffSaveKey=(itemId,kind)=>s.text(itemId)+'|'+s.text(kind);
s.staffOption=(kind,value)=>{
  const options=kind==='radiologist'?s.radiologistOptions:s.radiographerOptions;
  return options.find(option=>option.value===s.text(value))||null;
};
s.setStaff=async(row,item,kind,value)=>{
  const itemId=s.text(item&&item.id);
  if(!itemId||!['radiographer','radiologist'].includes(kind))return;
  const picked=s.text(value);
  const previous=s.text(item&&item[kind]);
  if(picked===previous)return;
  const saveKey=s.staffSaveKey(itemId,kind);
  if(s.savingStaff[saveKey])return;
  const option=s.staffOption(kind,picked);
  const source=picked?(option?'master':'external'):'';
  const memberId=option?s.text(option.member_id):'';
  if(kind==='radiographer'&&picked&&!option){
    field.notify('Radiographer ต้องเลือกจาก X-ray Member Master','warning',4000);return;
  }
  const previousSource=s.text(item&&item[kind+'_source']);
  const previousMemberId=s.text(item&&item[kind+'_member_id']);
  s.applyItemField(itemId,kind,picked);
  s.applyItemField(itemId,kind+'_source',source);
  s.applyItemField(itemId,kind+'_member_id',memberId);
  s.savingStaff={...s.savingStaff,[saveKey]:true};
  s.recompute();
  try{
    const payload={action:'set_staff',organization_code:s.unitCode(),order_id:s.text(row&&row.id),item_id:itemId};
    payload[kind]=picked;
    payload[kind+'_source']=source;
    payload[kind+'_member_id']=memberId;
    const p=await s.processCall(WORKLIST_PROCESS_ID,payload);
    if(!p||p.success===false){
      s.applyItemField(itemId,kind,previous);
      s.applyItemField(itemId,kind+'_source',previousSource);
      s.applyItemField(itemId,kind+'_member_id',previousMemberId);
      field.notify(s.text(p&&p.message)||('บันทึก '+(kind==='radiologist'?'Radiologist':'Radiographer')+' ไม่สำเร็จ'),'error',5200);
    }else if(!s.actionAnswered(p,'item_id')){
      s.applyItemField(itemId,kind,previous);
      s.applyItemField(itemId,kind+'_source',previousSource);
      s.applyItemField(itemId,kind+'_member_id',previousMemberId);
      field.notify(s.staleProcessNote('set_staff'),'error',9000);
    }
  }catch(error){
    s.applyItemField(itemId,kind,previous);
    s.applyItemField(itemId,kind+'_source',previousSource);
    s.applyItemField(itemId,kind+'_member_id',previousMemberId);
    field.notify(s.text(error&&error.message)||('เรียก API บันทึก '+(kind==='radiologist'?'Radiologist':'Radiographer')+' ไม่สำเร็จ'),'error',5200);
  }finally{
    const next={...s.savingStaff};delete next[saveKey];s.savingStaff=next;
    s.recompute();
  }
};
s.setRadiographer=(row,item,value)=>s.setStaff(row,item,'radiographer',value);
s.setRadiologist=(row,item,value)=>s.setStaff(row,item,'radiologist',value);
/* ── ตรวจใหม่ (ปรับเป็นรายรายการ 2026-09-18) ──────────────────────────────
   เลือกรายการยกเลิกก่อน: Order เดิม เลข Order เดิม เฉพาะรายการนั้นกลับไป "รอรับ" และล้างเลข Accession
   เลขใหม่จะออกตอนผู้ใช้กด "ส่งเข้าเครื่อง" อีกที (ไม่ออกให้อัตโนมัติ)
   โหลดรายการใหม่หลังสำเร็จ เพราะสถานะทั้งใบเปลี่ยน ตัวเลขบน chip ก็ต้องขยับตาม */
s.retesting={};
/* Process รุ่นเก่าที่ยังไม่รู้จัก action ใหม่จะ **ตกไปทำ list** แล้วตอบ success:true พร้อม
   data.orders มาแทน ⇒ ปุ่มดูเหมือนทำงานแต่ไม่มีอะไรเปลี่ยน และไม่มี error ให้จับ
   (ผู้ใช้เจอจริง 2026-09-03: "ทำไมปุ่มตรวจใหม่ใช้ไม่ได้")
   จึงต้องดู "ทรงของคำตอบ" ด้วย ไม่ใช่ดูแค่ success — ไม่งั้นหน้าจอโกหกเงียบ ๆ */
s.actionAnswered=(p,key)=>{
  const d=(p&&p.data)||{};
  if(Array.isArray(d.orders))return false;
  return Object.prototype.hasOwnProperty.call(d,key);
};
s.staleProcessNote=name=>'Process worklist ที่ deploy อยู่ยังไม่มี action "'+name+
  '" — ต้องเอาโค้ดล่าสุดของ xray_cpoe_worklist_api.js ไป replace body ก่อน';
s.openRetestSelection=row=>{
  const id=s.text(row&&row.id);
  if(!id)return;
  if(!s.isExpanded(id))s.toggleOrder(id);
  s.setDetailTab(id,'order');
  field.notify('เลือกรายการ X-ray ที่ยกเลิกแล้วในตาราง จากนั้นกด “ตรวจใหม่เฉพาะที่เลือก”','info',4600);
};
s.retestOrder=async row=>{
  const id=s.text(row&&row.id);
  if(!id){field.notify('ไม่พบรหัส Order','error',3200);return;}
  const selectedItems=((row&&row.items)||[]).filter(i=>i&&i.selected);
  if(!selectedItems.length){field.notify('เลือกรายการ X-ray ที่ต้องการตรวจใหม่','warning',3200);return;}
  if(selectedItems.some(i=>!i.can_retest)){
    field.notify('ตรวจใหม่ได้เฉพาะรายการที่ยกเลิกแล้ว กรุณาเลือกใหม่','warning',4000);return;
  }
  const itemIds=selectedItems.map(i=>s.text(i.id));
  if(itemIds.some(id=>!id)||new Set(itemIds).size!==itemIds.length){
    field.notify('รหัสรายการ X-ray ที่เลือกไม่ถูกต้อง กรุณาโหลดใหม่','error',4000);return;
  }
  if(s.retesting[id])return;
  s.retesting={...s.retesting,[id]:true};
  s.recompute();
  try{
    const p=await s.processCall(WORKLIST_PROCESS_ID,{
      /* ใช้ action ใหม่: Process เก่าจะตอบ list แทน ไม่เปิดกลับทั้ง Order */
      action:'retest_items',
      organization_code:s.unitCode(),
      order_id:id,
      order_number:s.text(row&&row.order_no),
      item_ids:itemIds
    });
    if(!p||p.success===false){
      field.notify(s.text(p&&p.message)||'เปิดตรวจใหม่ไม่สำเร็จ','error',6000);
      return;
    }
    if(!s.actionAnswered(p,'reopened_item_count')||
       !Array.isArray(p.data&&p.data.item_ids)||
       p.data.item_ids.length!==itemIds.length||
       itemIds.some(id=>!p.data.item_ids.includes(id))){
      field.notify(s.staleProcessNote('retest_items'),'error',9000);
      return;
    }
    const d=p.data||{};
    field.notify(s.text(p.message)||'เปิดตรวจใหม่แล้ว',d.audit_sync_pending?'warning':'success',d.audit_sync_pending?6000:3600);
    s.selected={};
    s.loadOrders();
    s.refreshCounts();
  }catch(error){
    field.notify(s.text(error&&error.message)||'เรียก API ตรวจใหม่ไม่สำเร็จ','error',6000);
  }finally{
    const next={...s.retesting};delete next[id];s.retesting=next;
    s.recompute();
  }
};
s.statusFilters=[
  {key:'all',label:'ทั้งหมด'},
  {key:'waiting',label:'รอรับ'},
  {key:'pending',label:'รอผลตรวจ'},
  {key:'complete',label:'ออกผลครบ'},
  {key:'cancelled',label:'ยกเลิก'}
];
/* statuses ที่ส่งให้ server — ใช้คำศัพท์เดียวกับ zdata_cpoe_order_item ของ LAB
   เพราะ X-ray อ่านจากตารางเดียวกัน (Xray_design.md Appendix C.1)
   แต่จัดกลุ่มตาม X-ray: 1 order = 1 test ⇒ 'resulted' คือ 'ออกผลครบ' ไม่ใช่ 'ออกผลบางส่วน'
   ตัวเลขบน chip จึงตรงกับป้ายสถานะที่แสดงในแถว (Appendix A.1/A.3) */
s.statusMap={
  /* all = ไม่ส่ง statuses ไปเลย ให้ API ใช้ vocabulary เต็มของตัวเอง
     ถ้า hard-code รายชื่อไว้ที่นี่ วันที่ API เพิ่มสถานะใหม่ chip กับตารางจะไม่ตรงกัน
     (เกิดมาแล้ว 2026-09-01: ฟอร์มไม่ได้ส่ง draft ทำให้ chip นับ 1 แต่ตารางว่าง)
     ตอนนี้ draft ถูกตัดออกจาก vocabulary ฝั่ง API แล้ว — ใบร่างไม่ใช่คำสั่ง */
  all:[],
  waiting:['sent','ready'],
  pending:['accepted','prepared','dispensed','dispatched','in_progress'],
  complete:['resulted','completed'],
  cancelled:['cancelled','rejected','returned','reversed']
};
s.view={
  rows:[],
  dateScopeText:'',
  serverNote:'',
  dataNote:'',
  counts:{all:0,waiting:0,pending:0,complete:0,cancelled:0},
  modalities:[],
  modalityReady:false,
  modalityPlaceholder:'Select all',
  modalityPicked:[],
  modalityAria:'กรองตามเครื่อง · ทุกเครื่อง',
  modalityNote:'',
  summary:'',
  configWarning:''
};

/* ── formatting helpers ─────────────────────────────────────────────────── */
s.text=v=>{
  if(v==null)return '';
  if(typeof v==='object')return s.text(v.label||v.name||v.display_name||v.full_name||v.username||v.code||v.value||v._id||'');
  return String(v).trim();
};
s.stripEmail=v=>String(v||'')
  .replace(/\\s*[\\(<\\[]?[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}[\\)>\\]]?\\s*/ig,' ')
  .replace(/\\(\\s*\\)|\\[\\s*\\]|<\\s*>/g,' ')
  .replace(/\\s{2,}/g,' ')
  .trim();
s.personName=v=>{
  if(!v)return '';
  if(typeof v==='object'){
    const parts=[s.text(v.prename||v.prefix||v.title),s.text(v.first_name||v.p_fname||v.firstname),s.text(v.last_name||v.p_lname||v.lastname)].filter(Boolean);
    if(parts.length>=2)return s.stripEmail(parts.join(' '));
    return s.stripEmail(s.text(v.display_name||v.full_name||v.name||v.label||v.username||''));
  }
  return s.stripEmail(v);
};
s.orderReportReady=row=>!!(s.text(row&&row.id)&&s.text(row&&row.emr&&row.emr.visit_id));
s.currentUserName=()=>{
  const state=field.globalUserState||{},user=state.user||state.currentUser||{};
  return s.personName(user)||s.personName(state)||'ผู้ใช้งานระบบ';
};
s.currentPrintTime=()=>new Intl.DateTimeFormat('th-TH',{
  day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',
  hour12:false,timeZone:'Asia/Bangkok'
}).format(new Date());
s.orderReportParams=row=>({
  order_id:s.text(row&&row.id),
  visit_id:s.text(row&&row.emr&&row.emr.visit_id),
  printed_by:s.currentUserName(),
  printed_at:s.currentPrintTime()
});
/* เปลี่ยน 2026-09-04 พร้อมกับ HN_ORDER_REPORT_ID: ป้ายใหม่ค้นด้วย HN ไม่ใช่ Visit ID
   ⇒ กันไว้ที่ row.hn แทน emr.visit_id · Order ที่ไม่มี HN ปุ่มยัง disabled เหมือนเดิม */
s.hnOrderReportReady=row=>!!(HN_ORDER_REPORT_ID&&s.text(row&&row.hn));
s.hnOrderReportParams=row=>({hn:s.text(row&&row.hn)});
/* ── ปุ่ม "พิมพ์ HN" (ยกจากฟอร์มจริงที่ deploy อยู่ · เพิ่มกลับ 2026-09-11) ──────
   สั่งพิมพ์ผ่าน print agent บนเครื่องผู้ใช้ตรง ๆ ไม่เปิด PDF ไม่มี dialog ของ browser
   ตัวส่งคือ widget local-agent-ui ชื่อ 'local_agent' ที่อยู่ท้ายฟอร์ม (agentKind='printer')
   HN_LABEL_PRINTER คือ alias ของเครื่องพิมพ์ที่ตั้งไว้ในหน้า Agents — ตั้งชื่อต่างจากนี้แล้วจะหาไม่เจอ
   🔴 ใช้ Report ตัวเดียวกับปุ่ม HN (HN_ORDER_REPORT_ID) ไม่ได้เพิ่ม Report ใหม่ */
const HN_LABEL_PRINTER='HN/VN Sticker';
s.hnPrinting={};
s.setHnPrinting=(id,v)=>{s.hnPrinting={...s.hnPrinting,[id]:!!v};};
s.printAgent=()=>{
  const form=field.getFormRef&&field.getFormRef();
  const ref=form&&form.getFieldRef?form.getFieldRef('local_agent'):null;
  const agent=ref&&ref.getFieldEditor?ref.getFieldEditor():null;
  return agent&&typeof agent.printReport==='function'?agent:null;
};
s.hnPrintHint=row=>s.hnOrderReportReady(row)
  ?'พิมพ์ป้ายติดแฟ้มที่เครื่อง '+HN_LABEL_PRINTER+' โดยไม่เปิด PDF'
  :'Order นี้ไม่มี HN สำหรับพิมพ์ป้ายติดแฟ้ม';
s.printHnLabel=row=>{
  const hn=s.text(row&&row.hn),id=s.text(row&&row.id);
  if(!hn){field.notify('Order นี้ไม่มี HN','warning',2500);return;}
  const agent=s.printAgent();
  if(!agent){
    field.notify('ยังไม่ได้เชื่อมต่อ print agent บนเครื่องนี้ — เปิดปุ่ม Agents ท้ายหน้าเพื่อตั้งค่า','error',4000);
    return;
  }
  s.setHnPrinting(id,true);
  const finish=()=>s.setHnPrinting(id,false);
  let done=null;
  try{
    done=agent.printReport(HN_ORDER_REPORT_ID,{
      printer:HN_LABEL_PRINTER,
      params:{hn:hn},
      /* กดย้ำด้วยความเร็วเสมอ — agent กันงานซ้ำ jobKey เดิมภายใน 60 วิ
         กดพิมพ์ใบที่สองถึงต้องออกจริง ไม่ใช่เงียบหาย */
      jobKey:'xray-hn-'+hn+'-'+Date.now()
    });
  }catch(e){
    finish();
    field.notify('พิมพ์ไม่สำเร็จ: '+((e&&e.message)||e),'error',4000);
    return;
  }
  const ok=()=>{finish();field.notify('ส่งพิมพ์ป้ายติดแฟ้ม HN '+hn+' แล้ว','success',2500);};
  /* field script ไม่ใช่ async — ห้าม await ต้อง .then()/.catch() เอาเอง */
  if(done&&typeof done.then==='function'){
    done.then(ok).catch(err=>{
      finish();
      field.notify('พิมพ์ไม่สำเร็จ: '+((err&&err.message)||err),'error',4000);
    });
  }else{ok();}
};
s.itemStickerReady=(row,item)=>!!(HN_STICKER_REPORT_ID&&s.text(row&&row.id)&&s.text(row&&row.emr&&row.emr.visit_id)&&s.text(item&&item.id)&&item&&item.can_sticker);
s.currentPrintDate=()=>new Intl.DateTimeFormat('en-GB',{
  day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Bangkok'
}).format(new Date()).replace(/\\//g,'-');
s.itemStickerParams=(row,item)=>({
  order_id:s.text(row&&row.id),
  visit_id:s.text(row&&row.emr&&row.emr.visit_id),
  item_id:s.text(item&&item.id),
  printed_date:s.currentPrintDate()
});
s.patientName=o=>[s.text(o&&o.patient&&o.patient.prename),s.text(o&&o.patient&&o.patient.first_name),s.text(o&&o.patient&&o.patient.last_name)].filter(Boolean).join(' ');
s.coverage=o=>s.text(o&&o.finance&&o.finance.coverage);
s.coverageAbbrev=o=>{
  const raw=o&&o.finance&&o.finance.coverage;
  let list=[];
  if(Array.isArray(raw))list=raw;
  else if(typeof raw==='string'&&['[','{'].includes(raw.trim().charAt(0))){
    try{const parsed=JSON.parse(raw);list=Array.isArray(parsed)?parsed:[parsed];}
    catch(e){list=[raw];}
  }else if(raw!=null&&raw!=='')list=[raw];
  for(let index=0;index<list.length;index++){
    const item=list[index],main=item&&typeof item==='object'&&item.inscl_item_main;
    const code=s.text(main&&typeof main==='object'
      ?(main.value||main.code||main.id)
      :(item&&typeof item==='object'?(item.value||item.code||item.id):item));
    if(code)return code.toUpperCase()==='CASH'?'':code;
  }
  return '';
};
s.requesterName=o=>{const r=(o&&o.requester)||{};return s.personName(r.cosign_user)||s.personName(r.visit_doctor);};
s.sourceRoom=o=>s.text(o&&o.visit&&(o.visit.clinic||o.visit.ward));
s.isPaid=o=>{const f=(o&&o.finance)||{};const total=Number(f.total_amount||0);return total>0&&Number(f.paid_amount||0)>=total;};
s.showPaid=o=>s.isPaid(o)&&!s.coverageAbbrev(o);
s.showCashPayment=o=>{const f=(o&&o.finance)||{};return Number(f.total_amount||0)>0&&!s.coverageAbbrev(o);};
/* Finance เป็นเจ้าของ transition sent → ready เหมือน LAB: ยอดเงินใช้เพียง
   ตัดสินว่าต้องแสดงกล่องสิทธิ์เงินสดหรือไม่ ส่วนข้อความ/สีและสิทธิ์กดส่งเครื่อง
   ต้องยึด current_status ของ Item เพื่อไม่ให้ยอดที่ sync ช้าปลด gate ผิดจังหวะ.
   สถานะหลังรับทั้งหมดถือว่าผ่าน gate ไปแล้ว เพื่อไม่ย้อน badge เป็นแดงกลาง flow. */
s.isFinancePassed=o=>{
  const terminal=['cancelled','rejected','returned','reversed'];
  const passed=['ready','accepted','prepared','dispensed','dispatched','in_progress','resulted','completed'];
  const items=o&&Array.isArray(o.items)?o.items:[];
  const active=items.filter(item=>!terminal.includes(s.text(item&&item.current_status).toLowerCase()));
  return active.length?active.every(item=>passed.includes(s.text(item&&item.current_status).toLowerCase())):s.isPaid(o);
};
/* ชื่อระดับความเร่งด่วน — ชุดค่าเดียวกับ PRIORITY ของฟอร์ม CPOE Order App
   1 ปกติ · 2 ด่วน · 3 ด่วนที่สุด · 4 ด่วน OR · 5 ด่วน อุบัติเหตุ
   zdata_cpoe_order.priority เก็บเป็นรหัสสตริง (ยืนยันกับข้อมูลจริง 2026-09-11 พบ '1','2','4')
   แก้ 2026-09-11 ตามที่ผู้ใช้สั่ง: เดิมทุกระดับโชว์คำว่า 'เร่งด่วน' คำเดียว จนแยกไม่ออกว่าใบไหนด่วนแบบไหน */
const PRIORITY_LABEL={'2':'ด่วน','3':'ด่วนที่สุด','4':'ด่วน OR','5':'ด่วน อุบัติเหตุ'};
s.priorityCode=o=>s.text(o&&o.priority).toLowerCase();
s.isUrgent=o=>{const p=s.priorityCode(o);return p.indexOf('urgent')>=0||p.indexOf('stat')>=0||p.indexOf('ด่วน')>=0||['2','3','4','5'].indexOf(p)>=0;};
/* รหัสที่ไม่รู้จัก (เช่น 'urgent'/'stat' ที่ระบบอื่นส่งมา) ⇒ ใช้ข้อความที่ส่งมาถ้าเป็นชื่อไทยอยู่แล้ว
   ไม่งั้นตกกลับไปที่คำเดิม 'เร่งด่วน' — ป้ายต้องไม่หายไม่ว่าค่าจะเป็นอะไร */
s.urgentLabel=o=>{if(!s.isUrgent(o))return '';const p=s.priorityCode(o);if(PRIORITY_LABEL[p])return PRIORITY_LABEL[p];const raw=s.text(o&&o.priority);return raw.indexOf('ด่วน')>=0?raw:'เร่งด่วน';};
s.ageText=o=>s.text(o&&o.patient&&o.patient.age);
/* Diagnosis = primary_dx ดิบจาก zdata_diagnosis ({value:<ICD>, label:<ชื่อโรค>})
   s.text หยิบ label มาก่อน ถ้าไม่มีจะตกไปที่ value — พฤติกรรมเดียวกับ LAB ที่ใช้งานได้จริง */
s.diagnosisText=o=>s.text(o&&(o.diagnosis||(o.emr_context&&o.emr_context.diagnosis)));
/* ── แถบเตือนแพ้ยา / COVID (ผู้ใช้ขอ 2026-09-03) ───────────────────────────
   ค่ามาจาก API เท่านั้น (patient.alerts) ซึ่งอ่าน EMR ให้:
     · allergies[] — zdata_person.allergy_main + patient_assessment.drug_allergy/food_allergy
     · covid       — ตัดสินจาก Diagnosis ของ visit (ผู้ใช้เลือกแหล่งนี้ 2026-09-03)
   ฟอร์มไม่เดาเอง ไม่ derive จากข้อความอื่น ถ้า API ไม่ส่งมา = ไม่มีกล่อง
   Process รุ่นเก่าที่ยังไม่มี alerts จึงไม่พัง แค่ไม่ขึ้นกล่องเท่านั้น */
s.alertList=o=>{
  const alerts=(o&&o.patient&&o.patient.alerts)||{};
  const out=[];
  if(alerts.covid===true)out.push(s.text(alerts.covid_label)||'COVID');
  const allergies=Array.isArray(alerts.allergies)?alerts.allergies.map(s.text).filter(Boolean):[];
  if(allergies.length)out.push('แพ้ '+allergies.join(', '));
  return out;
};

s.toDate=v=>{if(!v)return null;const d=new Date(String(v).replace(' ','T'));return Number.isNaN(d.getTime())?null:d;};
s.datePart=v=>{const d=s.toDate(v);return d?d.toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit',timeZone:'Asia/Bangkok'}):'';};
s.timePart=v=>{const d=s.toDate(v);return d?d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Asia/Bangkok'}):'';};
s.compactDateTime=v=>{const d=s.toDate(v);return d?s.datePart(v)+' '+s.timePart(v):'';};
s.shorten=(v,limit)=>{const t=s.text(v);return t.length>limit?t.slice(0,limit-1)+'…':t;};

/* ── state model — Xray_design.md Appendix A.3 (1 order = 1 accession = 1 test)
   'partial' เกิดขึ้นไม่ได้ในโมเดลนี้ เก็บ label ไว้เผื่อ contract เปลี่ยนเท่านั้น ── */
s.ORDER_LABEL={waiting:'รอรับ',dispatched:'รอผลตรวจ',partial:'รอผลตรวจ',complete:'ออกผลครบ',cancelled:'ยกเลิก'};
s.ORDER_CLASS={waiting:'xr-st-waiting',dispatched:'xr-st-dispatched',partial:'xr-st-partial',complete:'xr-st-complete',cancelled:'xr-st-cancelled'};
s.ITEM_LABEL={waiting:'รอรับ',dispatched:'ส่งเครื่องแล้ว',resulted:'ออกผลแล้ว',cancelled:'ยกเลิก'};
s.ITEM_CLASS={waiting:'xr-st-waiting',dispatched:'xr-st-dispatched',resulted:'xr-st-complete',cancelled:'xr-st-cancelled'};
/* ── สถานะที่ RIS แจ้งกลับ (เพิ่ม 2026-09-09 · ผู้ใช้เลือกตัวเลือก A) ──────────
   มาจาก Process xray_order_status_change ซึ่งเป็นขา **เข้า** — RIS เรียกเข้ามาอัปเดต
   zdata_xray_order เอง ฝั่งเราอ่านมาโชว์เฉยๆ ไม่เคยยิงออกไป
   รับแค่ A = Arrival · C = Completed · ค่าอื่น (เช่น N = Request ตอนสร้างใบ) ไม่โชว์
   เพราะ N ไม่ได้บอกความคืบหน้าอะไรที่ผู้ใช้ยังไม่รู้จากคอลัมน์สถานะเดิมอยู่แล้ว */
s.RIS_STATUS_LABEL={A:'RIS: เครื่องรับรายการแล้ว',C:'RIS: มีภาพแล้ว · รอแพทย์อ่าน'};
s.risStatusCode=i=>{const v=s.text(i&&i.ris_order_status).trim().toUpperCase();return (v==='A'||v==='C')?v:'';};
s.risStatusTitle=i=>{
  const code=s.risStatusCode(i);if(!code)return '';
  const when=s.compactDateTime(i&&i.ris_order_status_at);
  const shot=code==='C'?s.compactDateTime(i&&i.ris_order_captured_at):'';
  return [s.RIS_STATUS_LABEL[code],when?('RIS แจ้งเมื่อ '+when):'',shot?('เวลาถ่าย '+shot):'']
    .filter(Boolean).join(' · ');
};
/* เช็คลิสต์สถานะระดับ order — 4 ช่องคงที่ เรียงตามเส้นทางจริง
   ของรายการ: รอรับ → รอผลตรวจ → ออกผลแล้ว → ยกเลิก/ปฏิเสธ
   ช่องระดับ order ใช้คำรวม "รอผลตรวจ" ส่วนตาราง item คงคำเชิงเหตุการณ์ "ส่งเครื่องแล้ว"
   (ช่องสุดท้ายรวมการปฏิเสธไว้ด้วย เพราะ itemState จัดทั้งสองอย่างเป็น 'cancelled')

   แก้ตามผู้ใช้ 2026-09-03 (รอบสอง): เป็น "ความคืบหน้า" ไม่ใช่ภาพนิ่งของสถานะปัจจุบัน
   รายการที่ส่งเข้าเครื่องแล้วและกำลังรอผลตรวจ แปลว่าขั้น "รอรับ" ผ่านไปแล้ว ช่องนั้นต้องขึ้น
   เครื่องหมายถูก ไม่ใช่เว้นว่างเหมือนไม่เคยเกิดขึ้น
     · มีรายการค้างอยู่ที่ขั้นนี้  → จุดสี + จำนวน
     · ไม่มีรายการค้าง แต่มีรายการผ่านขั้นนี้ไปแล้ว → จุดสี + เครื่องหมายถูก
     · ยังไม่มีรายการไปถึง         → เว้นว่าง
   'cancelled' ไม่อยู่ในเส้นทางเดิน — ยกเลิกแล้วไม่ได้เดินต่อ จึงไม่ทำให้ขั้นก่อนหน้า
   กลายเป็นผ่าน และตัวมันเองก็ไม่มีวันเป็น "ผ่านแล้ว" */
s.STATUS_STEPS=['waiting','dispatched','resulted','cancelled'];
s.STEP_ORDER={waiting:0,dispatched:1,resulted:2};
s.STEP_LABEL={...s.ITEM_LABEL,dispatched:'รอผลตรวจ',cancelled:'ยกเลิก / ปฏิเสธ'};
s.STEP_DOT_CLASS={waiting:'xr-dot-waiting',dispatched:'xr-dot-dispatched',resulted:'xr-dot-resulted',cancelled:'xr-dot-cancelled'};
s.statusSteps=o=>{
  const items=(o&&Array.isArray(o.items))?o.items:[];
  /* ยกเลิกทั้งใบแล้ว item รายตัวอาจยังไม่ถูกอัปเดต — นับเป็นยกเลิกทั้งหมด
     ไม่งั้นใบที่ยกเลิกแล้วจะยังโชว์ดอต "รอรับ" ค้างไว้ ขัดกับป้ายรวมของแถวเอง */
  const forced=!!(o&&o.cancelled===true);
  const states=items.map(i=>forced?'cancelled':s.itemState(i));
  const counts={};
  states.forEach(st=>{counts[st]=(counts[st]||0)+1;});
  return s.STATUS_STEPS.map(key=>{
    const count=counts[key]||0;
    const label=s.STEP_LABEL[key]||key;
    const rank=s.STEP_ORDER[key];
    const passed=(rank==null)?0:states.filter(st=>s.STEP_ORDER[st]!=null&&s.STEP_ORDER[st]>rank).length;
    const done=count===0&&passed>0;
    return {
      key:key,
      label:label,
      count:count,
      passed:passed,
      active:count>0,
      done:done,
      dot_class:s.STEP_DOT_CLASS[key]||'',
      title:count?(label+' · '+count+' รายการ')
        :(done?(label+' · ผ่านขั้นนี้แล้ว '+passed+' รายการ'):(label+' · ไม่มีรายการ'))
    };
  });
};
/* ข้อความสรุปทั้งใบ — ป้ายรวมเดิมยังอยู่ตรงนี้ ทั้ง hover และ screen reader ยังได้ยินเหมือนเดิม
   ขั้นที่ผ่านไปแล้วต้องได้ยินด้วย ไม่งั้นคนที่ใช้ screen reader จะเห็นภาพไม่ครบเท่าคนที่มองจอ */
s.statusAria=o=>{
  const head=s.ORDER_LABEL[s.orderState(o)]||'';
  const on=s.statusSteps(o)
    .filter(x=>x.active||x.done)
    .map(x=>x.active?(x.label+' '+x.count+' รายการ'):(x.label+' ผ่านแล้ว'));
  return on.length?(head+' · '+on.join(' · ')):head;
};

/* RIS เขียนผลอ่านลง zdata_xray_result ของมันเอง **ไม่ได้แตะ CPOE item ของเรา**
   สถานะ "ออกผลแล้ว" จึงต้อง derive จากผลที่ join มา ไม่ใช่รอ current_status เปลี่ยน
   ส่งตรวจซ้ำจะเลื่อน dispatched_at ⇒ ผลฉบับเก่ากลายเป็น "ไม่ใช่ผลของรอบนี้" อัตโนมัติ */
s.hasResult=i=>!!s.text(i&&i.result_text);
/* ── เปลี่ยน 2026-09-16 ตามคำสั่งผู้ใช้: ตัดการเทียบเวลาออก ──────────────────
   ของเดิม (2026-09-02) บังคับว่า resulted_at ต้องไม่เก่ากว่า dispatched_at
   เพื่อกันผลของรอบก่อนหลุดมาปนรอบที่ส่งใหม่ — ตอนนั้นจำเป็น เพราะ "ส่งตรวจซ้ำ"
   ยังใช้เลข Accession เดิม เวลาจึงเป็นทางเดียวที่แยกรอบได้
   2026-09-03 ผู้ใช้สั่งให้ส่งตรวจซ้ำ/ตรวจใหม่ **ออกเลข Accession ใหม่เสมอ**
   ⇒ รอบใหม่ = เลขใหม่ · และผลถูก join ด้วย AccessionNo ⇒ ผลที่เห็นเป็นของรอบนี้เสมอ
   เทียบเวลาต่อไปมีแต่ตัดผลจริงทิ้ง (2026-09-16 พบว่ากินทุกใบที่มีผลในระบบ)
   🔴 เส้นแบ่งรอบคือเลข Accession ไม่ใช่เวลา — ถ้ากลับไปใช้เลขเดิมซ้ำเมื่อไหร่
      ต้องเอากติกานี้กลับมา · กติกาเดียวกับ effective_status ฝั่ง server */
s.resultIsCurrent=i=>s.hasResult(i);
s.itemState=i=>{
  const x=s.text(i&&i.current_status).toLowerCase();
  if(['cancelled','rejected','returned','reversed'].indexOf(x)>=0)return 'cancelled';
  if(s.resultIsCurrent(i))return 'resulted';
  if(['resulted','completed'].indexOf(x)>=0)return 'resulted';
  if(['accepted','prepared','dispensed','dispatched','in_progress'].indexOf(x)>=0)return 'dispatched';
  return 'waiting';
};
s.orderState=o=>{
  const items=(o&&Array.isArray(o.items))?o.items:[];
  const states=items.map(s.itemState);
  if(!states.length)return 'waiting';
  if(o.cancelled===true||states.every(x=>x==='cancelled'))return 'cancelled';
  const live=states.filter(x=>x!=='cancelled');
  const resulted=live.filter(x=>x==='resulted').length;
  const dispatched=live.filter(x=>x==='dispatched').length;
  const waiting=live.filter(x=>x==='waiting').length;
  if(resulted&&!waiting&&resulted===live.length)return 'complete';
  if(resulted)return 'partial';
  if(dispatched)return 'dispatched';
  return 'waiting';
};
s.orderBucket=o=>{const x=s.orderState(o);return x==='cancelled'?'cancelled':(x==='complete'?'complete':(x==='waiting'?'waiting':'pending'));};
s.pickTime=(items,key,mode)=>{
  let out='';
  items.forEach(i=>{const v=s.text(i&&i[key]);if(!v)return;if(!out||(mode==='max'?v>out:v<out))out=v;});
  return out;
};
/* คอลัมน์ "เวลาสถานะ" ถูกตัดออกจากตาราง 2026-09-02 (ผู้ใช้ขอ — ระดับ item มีเวลา
   ส่งเข้าเครื่องอยู่แล้ว) แต่ยังคำนวณไว้เหมือนเดิม เพราะ:
     · เป็นแกนเดียวกับที่ API ใช้กรอง Date Range (status_date)
     · เอากลับมาแสดงได้ทันทีด้วยการเพิ่มเซลล์กลับ ไม่ต้องรื้อ logic ใหม่
   ค่าอยู่ที่ row.status_time_label / _date / _time */
s.statusTime=o=>{
  const state=s.orderState(o);
  const items=(o&&Array.isArray(o.items))?o.items:[];
  if(state==='cancelled')return {label:'เวลายกเลิก',iso:s.text(o&&o.cancelled_at)||s.pickTime(items,'cancelled_at','max')};
  if(state==='complete'||state==='partial')return {label:'เวลาออกผล',iso:s.pickTime(items,'resulted_at','max')};
  if(state==='dispatched')return {label:'เวลาส่งเครื่อง',iso:s.pickTime(items,'dispatched_at','min')};
  return {label:'เวลาสถานะ',iso:''};
};

/* ── เครื่อง (modality) ─────────────────────────────────────────────────────
   ห้าม hard-code รายชื่อเครื่องในฟอร์ม (Xray_design.md §6.2)
   ตัวเลือกมาจาก data.modalities[] ของ API เท่านั้น ถ้าไม่มีจึงรวบรวมจากรายการที่โหลดมาแล้ว */
s.modalityLabel=i=>s.text(i&&i.modality&&(i.modality.label||i.modality.name))||s.text(i&&i.modality&&i.modality.code)||s.text(i&&i.modality);
s.modalityCode=i=>s.text(i&&i.modality&&i.modality.code)||s.modalityLabel(i);
s.orderModality=o=>{
  const items=(o&&Array.isArray(o.items))?o.items:[];
  if(!items.length)return {code:'',label:''};
  return {code:s.modalityCode(items[0]),label:s.modalityLabel(items[0])};
};
/* 1 order มีได้หลายเครื่อง (ผู้ใช้ยกตัวอย่าง 2026-09-01: CT + DX ในใบเดียว)
   แถวสรุปเคยโชว์เครื่องของ item ตัวแรกตัวเดียว ซึ่งทำให้เข้าใจผิดว่าใบนี้มีเครื่องเดียว
   เรียงตามลำดับที่เจอใน item เพื่อให้ตรงกับตารางด้านล่าง ไม่เรียงใหม่ */
s.orderModalities=o=>{
  const items=(o&&Array.isArray(o.items))?o.items:[];
  const seen={};
  const out=[];
  items.forEach(i=>{
    const code=s.modalityCode(i);
    if(!code||seen[code])return;
    seen[code]=true;
    out.push({code:code,label:s.modalityLabel(i)||code});
  });
  return out;
};
s.mergeModalityPool=orders=>{
  const derived=[];
  const index={};
  orders.forEach(o=>{
    /* เก็บทุกเครื่องในใบ ไม่ใช่แค่ของ item ตัวแรก ไม่งั้นใบที่มี CT+DX จะหาย DX ไป */
    s.orderModalities(o).forEach(m=>{
      const value=m.code||m.label;
      if(!value||index[value])return;
      index[value]={value:value,label:m.label||value,count:null};
      derived.push(index[value]);
    });
  });
  if(!s.modality.length){s.modalityPool=derived;return;}
  const pool=(Array.isArray(s.modalityPool)?s.modalityPool:[]).slice();
  derived.forEach(d=>{if(!pool.some(x=>x.value===d.value))pool.push(d);});
  s.modalityPool=pool;
};
s.isModalityPicked=code=>(Array.isArray(s.modality)?s.modality:[]).indexOf(s.text(code))>=0;
s.buildModalities=()=>{
  const master=Array.isArray(s.modalityMaster)?s.modalityMaster:[];
  const decorate=row=>({...row,selected:s.isModalityPicked(row.value)});
  if(master.length){
    const out=[];
    const seen={};
    master.forEach(m=>{
      const value=s.text(m&&(m.code||m.value));
      if(!value||seen[value])return;
      seen[value]=true;
      out.push(decorate({value:value,label:s.text(m&&(m.label||m.name))||value,count:(m&&m.count!=null)?Number(m.count):null}));
    });
    return out;
  }
  return (Array.isArray(s.modalityPool)?s.modalityPool:[]).slice().sort((a,b)=>a.label<b.label?-1:1).map(decorate);
};

/* ── client-side guard — กันกรณี API ยังไม่กรองให้ครบ ห้ามซ้อนกรองสถานะ
   (สถานะเป็นหน้าที่ของ statuses[] ที่ส่งไป server เท่านั้น) ─────────────── */
s.searchBlob=o=>{
  const items=(o&&Array.isArray(o.items))?o.items:[];
  return [s.text(o&&o.patient&&o.patient.hn),s.text(o&&o.visit&&o.visit.vn),s.text(o&&o.visit&&o.visit.an),s.text(o&&o.order_number),s.patientName(o),s.requesterName(o)]
    .concat(items.map(i=>[s.text(i&&i.item_code),s.text(i&&i.item_name),s.modalityLabel(i),s.text(i&&i.accession_no)].join(' ')))
    .join(' ').toLowerCase();
};
/* เลือกหลายเครื่อง = ใบไหนมีเครื่องใดเครื่องหนึ่งที่เลือกไว้ก็เข้าข่าย
   และต้องดูทุกเครื่องในใบ ไม่ใช่แค่ของ item ตัวแรก (ใบ CT+DX ต้องติดทั้งสองตัวกรอง) */
s.matchesModality=o=>{
  const picked=Array.isArray(s.modality)?s.modality:[];
  if(!picked.length)return true;
  return s.orderModalities(o).some(m=>picked.indexOf(m.code)>=0||picked.indexOf(m.label)>=0);
};
s.matchesQuery=o=>{
  const q=s.text(s.filters.q).toLowerCase();
  /* เลขบัตรไม่อยู่ใน response เพื่อคุ้มครองข้อมูลส่วนบุคคล; เชื่อเฉพาะแถวที่ server
     คืนมาสำหรับคำค้นเดียวกันหลัง load สำเร็จ ไม่ปล่อยให้แถวค้างจากคำค้นเก่าผ่าน guard */
  return !q||s.searchBlob(o).indexOf(q)>=0||(/^\\d{13}$/.test(q)&&s.loadedQuery===q);
};

/* ── view builders — เทมเพลตอ่านจาก s.view เท่านั้น ห้ามคำนวณสดในเทมเพลต ─── */
s.transportFailed=i=>(i&&i.transport&&i.transport.status)?s.text(i.transport.status).toLowerCase()==='failed':(i&&i.transport_failed===true);
/* ค้างครึ่งทาง: ขึ้นว่าส่งเครื่องแล้วแต่ยังไม่มีเลข Accession
   ลำดับที่ถูกต้องออกเลขก่อนเปลี่ยนสถานะเสมอ ⇒ สภาพนี้แปลว่ายังไม่เสร็จจริง
   (เกิดจากบั๊ก standalone MongoDB 2026-09-01) ต้องกดส่งซ้ำให้จบได้ */
s.transportDelivered=i=>s.text(i&&i.transport&&i.transport.status).toLowerCase()==='ok';
s.needsAccession=i=>s.itemState(i)==='dispatched'&&!s.text(i&&i.accession_no)&&!s.transportDelivered(i);
/* ส่งตรวจซ้ำ: ถ่ายซ้ำเคสเดิมด้วยเลข Accession เดิม (ผู้ใช้ยืนยัน 2026-09-02)
   ทำได้กับรายการที่มีเลขแล้วและยังไม่ถูกยกเลิก · RIS upsert ด้วยเลขนี้ ไม่เกิดใบซ้ำ */
s.canResend=i=>!!s.text(i&&i.accession_no)&&s.itemState(i)!=='cancelled';
s.isFinanceReadyItem=i=>s.text(i&&i.current_status).toLowerCase()==='ready';
/* ผู้ใช้ยืนยัน 2026-09-18: ออกเลขแล้วให้ server ส่ง Order เดิม IsDeleted:true
   ผ่าน API Order ทีมก่อนเปลี่ยนสถานะ HIS; ฟอร์มจึงไม่บล็อกด้วย Accession อีก
   คืน null = รายการจบไปแล้ว ไม่ต้องนับ · false = ออกผลแล้ว · true = กดได้ */
s.itemCancellable=i=>{
  const state=s.itemState(i);
  if(state==='cancelled')return null;
  if(state==='resulted')return false;
  return true;
};
/* ── สรุปสารทึบระดับ item (เพิ่ม 2026-09-23 · ตัวเลือก A) ──────────────────
   อ่านจาก payload ของ API เท่านั้น — รับได้ทั้งทรงซ้อน item.contrast{brand,volume_ml,
   used_at,recorded_by} และทรงแบน item.contrast_brand / item.contrast_volume_ml
   🔴 ตอนนี้ xray_cpoe_worklist_api ยังไม่คืนค่าชุดนี้ ⇒ ทุกแถวขึ้นปุ่ม "+ บันทึก"
      ซึ่งถูกต้องแล้ว "ไม่มีข้อมูล" = "ยังไม่ได้บันทึก" ไม่ใช่ "ไม่ได้ฉีด"
      วันที่ API คืนค่ามา ชิปจะขึ้นเองโดยไม่ต้อง generate ฟอร์มใหม่
   Process รุ่นเดิมที่ไม่มีคีย์นี้จึงไม่พัง แค่ไม่ขึ้นชิปเท่านั้น */
s.contrastInfo=i=>(i&&typeof i.contrast==='object'&&i.contrast)||{};
s.contrastBrand=i=>s.text(s.contrastInfo(i).brand||s.contrastInfo(i).name)||s.text(i&&i.contrast_brand);
s.contrastVolume=i=>{
  const c=s.contrastInfo(i);
  const v=c.volume_ml==null?(i&&i.contrast_volume_ml):c.volume_ml;
  return v==null||v===''?'':s.text(v)+' ml';
};
s.contrastLabel=i=>[s.contrastBrand(i),s.contrastVolume(i)].filter(Boolean).join(' · ');
s.contrastTitle=i=>{
  const c=s.contrastInfo(i);
  const when=s.compactDateTime(c.used_at||(i&&i.contrast_used_at));
  const who=s.personName(c.recorded_by||(i&&i.contrast_recorded_by));
  return ['บันทึกการใช้สารทึบแล้ว — กดเพื่อแก้ไข',when?'เวลาที่ใช้ '+when:'',who?'ผู้บันทึก '+who:''].filter(Boolean).join(' · ');
};
s.buildItem=(o,i)=>{
  const state=s.itemState(i);
  const failed=s.transportFailed(i);
  const stuck=s.needsAccession(i);
  const resend=s.canResend(i);
  const financeReady=s.isFinanceReadyItem(i);
  const accessionNo=s.text(i&&i.accession_no);
  return {
    id:s.text(i&&i.item_id)||s.text(i&&i._id),
    accession_no:accessionNo,
    can_select:state==='waiting'||failed||stuck||resend||state==='cancelled',
    can_retest:state==='cancelled',
    can_dispatch_item:state!=='cancelled'&&((state==='waiting'&&financeReady)||failed||stuck||resend),
    finance_ready:financeReady,
    finance_blocked:state==='waiting'&&!financeReady&&!failed&&!stuck&&!resend,
    /* ปฏิเสธได้เฉพาะที่ยังไม่ได้ส่งเข้าเครื่อง — ส่งไปแล้วต้องยกเลิกที่ RIS ก่อน
       ซึ่งยังไม่มี contract จากทีม RIS (decision X9) จึงยังเปิดให้ไม่ได้ */
    can_reject:state==='waiting',
    needs_accession:stuck,
    can_resend:resend,
    result_versions:Number(i&&i.result_versions)||0,
    selected:!!s.selected[s.text(i&&i.item_id)||s.text(i&&i._id)],
    /* ทั้งสองค่ามาจากฐานข้อมูลจริง; field string เดิมคงไว้เพื่อ backward compatibility */
    radiologist:s.text(i&&i.radiologist),
    radiologist_source:s.text(i&&i.radiologist_source),
    radiologist_member_id:s.text(i&&i.radiologist_member_id),
    radiologist_saving:!!s.savingStaff[s.staffSaveKey(s.text(i&&i.item_id)||s.text(i&&i._id),'radiologist')],
    radiographer:s.text(i&&i.radiographer),
    radiographer_source:s.text(i&&i.radiographer_source),
    radiographer_member_id:s.text(i&&i.radiographer_member_id),
    radiographer_saving:!!s.savingStaff[s.staffSaveKey(s.text(i&&i.item_id)||s.text(i&&i._id),'radiographer')],
    /* ไม่ได้ผูกกับ title ของแถวแล้ว (ผู้ใช้ขอเอา tooltip ออก 2026-09-02)
       เก็บไว้เป็นคำอธิบายสถานะของรายการ เผื่อใช้ในที่อื่นและยังมีเทสคุมอยู่ */
    select_hint:stuck?'รายการนี้ยังไม่ได้เลข Accession — เลือกเพื่อส่งให้จบ'
      :((state==='waiting'&&!financeReady)?'ยังไม่ผ่านการเงิน — เลือกเพื่อปฏิเสธหรือยกเลิกได้ แต่ยังรับเข้าห้องรังสีไม่ได้'
      :(state==='waiting'||failed)?'เลือกเพื่อส่งเข้าเครื่องหรือปฏิเสธ'
      :resend?'เลือกเพื่อส่งตรวจซ้ำ — ระบบจะล้างเลขเดิมแล้วออกเลข Accession ใหม่'
      :state==='cancelled'?'เลือกเพื่อตรวจใหม่เฉพาะรายการนี้'
      :'รายการนี้ส่งเข้าเครื่องไปแล้ว'),
    name:s.text(i&&i.item_name),
    code:s.text(i&&i.item_code),
    /* แสดงตัวย่อ ชื่อเต็มอยู่ใน title ให้ hover ดู (ผู้ใช้ขอ 2026-09-01) */
    modality:s.modalityCode(i),
    modality_label:s.modalityLabel(i),
    dispatched_text:s.compactDateTime(i&&i.dispatched_at),
    dispatched_by:s.personName(i&&i.dispatched_by),
    /* ── เปลี่ยน 2026-09-16 ตามคำสั่งผู้ใช้ ────────────────────────────────
       ของเดิม transport_failed ชนะป้ายเสมอ ⇒ รายการที่ RIS ส่งผลกลับมาแล้ว
       ยังขึ้น "ส่งเครื่องไม่สำเร็จ" ซึ่งย้อนแย้งกับข้อมูลที่ใหม่กว่า
       ⇒ **มีผลอ่าน = ออกผลแล้ว** ส่วนความล้มเหลวของ transport ยังเห็นครบ
          ที่ข้อความแดงใต้คอลัมน์ "เวลาส่งเข้าเครื่อง" (transport_note ไม่ถูกแตะ) */
    status_label:state==='resulted'?s.ITEM_LABEL.resulted
      :(failed?'ส่งเครื่องไม่สำเร็จ':(stuck?'ค้าง · ยังไม่ได้เลข':(s.ITEM_LABEL[state]||''))),
    status_class:state==='resulted'?s.ITEM_CLASS.resulted
      :((failed||stuck)?'xr-st-failed':(s.ITEM_CLASS[state]||'xr-st-waiting')),
    transport_failed:!!failed,
    /* บอกเหตุผลจริงที่ RIS ตอบกลับมา ไม่ใช่ประโยคสำเร็จรูปว่า "ลองใหม่ได้"
       ซึ่งไม่ได้บอกอะไรเลยว่าต้องไปแก้ตรงไหน (ผู้ใช้ทักท้วง 2026-09-01) */
    transport_note:failed?(s.text(i&&i.transport&&i.transport.message)||'ส่งเข้า RIS ไม่สำเร็จ'):'',
    reject_reason:s.text(i&&(i.cancel_reason||i.reject_reason)),
    rejected_by:s.personName(i&&(i.cancelled_by||i.rejected_by)),
    can_sticker:state!=='cancelled',
    sticker_hint:state==='cancelled'?'รายการนี้ถูกยกเลิกแล้ว':(accessionNo?'พิมพ์สติ๊กเกอร์ HN พร้อม Accession No.':'พิมพ์สติ๊กเกอร์ HN ได้ · Accession No. จะเว้นว่าง'),
    /* สถานะที่ RIS แจ้งกลับผ่าน xray_order_status_change (เพิ่ม 2026-09-09 · ตัวเลือก A)
       A = คนไข้ถึงเครื่องแล้ว · C = ถ่ายเสร็จแล้ว · ค่าอื่น/ว่าง = RIS ยังไม่แจ้ง ⇒ ไม่โชว์ชิป
       🔴 เป็นข้อมูล "แสดงผล" ล้วน ไม่ได้เข้าไปยุ่งกับ state/can_select/ปุ่มใด ๆ ของเดิม */
    ris_status:s.risStatusCode(i),
    ris_status_label:s.RIS_STATUS_LABEL[s.risStatusCode(i)]||'',
    ris_status_class:s.risStatusCode(i)==='C'?'xr-ris-c':'xr-ris-a',
    ris_status_title:s.risStatusTitle(i),
    /* คอลัมน์ "สารทึบ" (2026-09-23) — ข้อมูลแสดงผลล้วน ไม่แตะ state / can_select /
       can_dispatch_item / can_reject / can_sticker ของเดิมสักตัว */
    contrast_label:s.contrastLabel(i),
    contrast_title:s.contrastTitle(i),
    contrast_hint:s.contrastLabel(i)?'แก้ไขบันทึกการใช้สารทึบรังสีของรายการนี้':s.contrastHint
  };
};
s.buildResultItem=(o,i,index)=>{
  const state=s.itemState(i);
  const done=state==='resulted';
  const failed=s.transportFailed(i);
  const stuck=s.needsAccession(i);
  return {
    id:s.text(i&&i.item_id)||s.text(i&&i._id),
    seq:index+1,
    name:s.text(i&&i.item_name),
    code:s.text(i&&i.item_code),
    modality:s.modalityCode(i),
    modality_label:s.modalityLabel(i),
    accession_no:s.text(i&&i.accession_no),
    /* ผู้กดส่งเข้าเครื่อง — ส่งทีละรายการ คนละรายการอาจคนละคน (ผู้ใช้ขอ 2026-09-02) */
    dispatched_by:s.personName(i&&i.dispatched_by),
    resulted_text:done?s.compactDateTime(i&&i.resulted_at):'',
    done:done,
    /* สถานะเต็มชุดเดียวกับแท็บ order — ส่งเข้าเครื่องทีละรายการ รายการในใบเดียวกัน
       จึงอยู่คนละขั้นได้ ถ้าโชว์แค่ "รอผลอ่าน/ออกผลแล้ว" จะไม่รู้ว่าอันไหนยังไม่ได้ส่ง */
    /* กติกาเดียวกับแท็บ order (2026-09-16): มีผลอ่าน = ออกผลแล้ว */
    state_label:done?s.ITEM_LABEL.resulted
      :(failed?'ส่งเครื่องไม่สำเร็จ':(stuck?'ค้าง · ยังไม่ได้เลข':(s.ITEM_LABEL[state]||''))),
    state_class:done?s.ITEM_CLASS.resulted
      :((failed||stuck)?'xr-st-failed':(s.ITEM_CLASS[state]||'xr-st-waiting')),
    can_pdf:done,
    pdf_hint:done?'พิมพ์ผลอ่าน':'พิมพ์ได้เมื่อออกผลแล้ว'
  };
};
/* คีย์ของ order ที่ใช้ทั่วทั้ง widget — payload ดิบใช้ order_id/_id ไม่ใช่ id
   (id เป็นชื่อที่ buildRow ตั้งขึ้นเองตอนแปลงเป็นแถว)
   ประกาศเป็นฟังก์ชันเดียวเพื่อให้ s.expanded และ row.id ใช้คีย์เดียวกันเสมอ
   เพิ่ม 2026-09-08 หลังพบว่า auto-expand ของ deep link อ่าน order.id แล้วได้ค่าว่าง
   จึงกาง item ไม่ขึ้นทั้งที่กรองถูกใบแล้ว */
s.orderKey=o=>s.text(o&&o.order_id)||s.text(o&&o._id);
s.buildRow=o=>{
  const items=(o&&Array.isArray(o.items))?o.items:[];
  const state=s.orderState(o);
  const st=s.statusTime(o);
  const cancelled=state==='cancelled';
  const resultItems=items.map((i,index)=>s.buildResultItem(o,i,index));
  const hasResult=resultItems.some(r=>r.done);
  const dx=s.diagnosisText(o);
  const builtItems=items.map(i=>s.buildItem(o,i));
  const dispatchChoices=builtItems.filter(i=>i.can_select&&!i.can_retest);
  const selectedItems=builtItems.filter(i=>i.selected);
  const selectedCount=selectedItems.length;
  const picked=selectedCount===1?selectedItems[0]:null;
  const selectedRaw=items.filter(i=>!!s.selected[s.text(i&&i.item_id)||s.text(i&&i._id)]);
  const cancelStates=selectedRaw.map(s.itemCancellable);
  const cancelCheck=cancelled?{can:false,hint:'Order นี้ถูกยกเลิกแล้ว'}
    :(!selectedRaw.length?{can:false,hint:'เลือกรายการ X-ray ที่ต้องการยกเลิก'}
    :(cancelStates.every(v=>v===true)
      ?{can:true,hint:'ยกเลิกเฉพาะ '+selectedRaw.length+' รายการที่เลือก'}
      :{can:false,hint:'ยกเลิกไม่ได้ — รายการที่เลือกมีผลอ่านหรือถูกยกเลิกแล้ว'}));
  return {
    id:s.orderKey(o),
    hn:s.text(o&&o.patient&&o.patient.hn),
    name:s.patientName(o),
    gender:s.text(o&&o.patient&&o.patient.gender_text),
    age:s.ageText(o),
    urgent:s.isUrgent(o),
    urgent_label:s.urgentLabel(o),
    room:s.sourceRoom(o),
    paid:s.showPaid(o),
    show_cash_payment:s.showCashPayment(o),
    finance_passed:s.isFinancePassed(o),
    coverage:s.coverageAbbrev(o),
    /* เพิ่ม 2026-09-03: แถบเตือนแพ้ยา/COVID · ว่าง = ไม่มีข้อมูลจาก EMR จึงไม่ขึ้นกล่อง
       ตัดให้สั้นพอใส่ช่อง แล้วเก็บข้อความเต็มไว้ที่ title — ห้ามตัดจนอ่านไม่รู้เรื่อง */
    alert_text:s.shorten(s.alertList(o).join(' · '),42),
    alert_full:s.alertList(o).join(' · '),
    /* 1 order มีได้หลาย test — แถวสรุปบอกจำนวน แล้วดูชื่อได้ตอน hover (เหมือน LAB)
       ห้ามโชว์ชื่อ test ตัวแรกตัวเดียว เพราะทำให้เข้าใจผิดว่าใบนี้มีรายการเดียว */
    test_count:items.length,
    test_summary:items.length?(items.length+' รายการ'):'',
    test_list:items.map(i=>[s.text(i&&i.item_name),s.text(i&&i.item_code)].filter(Boolean).join(' · ')).filter(Boolean),
    modalities:s.orderModalities(o),
    order_no:s.text(o&&o.order_number),
    ordered_date:s.datePart(o&&o.requested_at),
    ordered_time:s.timePart(o&&o.requested_at),
    status_time_label:st.label||'เวลาสถานะ',
    status_time_date:st.iso?s.datePart(st.iso):'',
    status_time_time:st.iso?s.timePart(st.iso):'',
    status_label:s.ORDER_LABEL[state]||'',
    status_class:s.ORDER_CLASS[state]||'xr-st-waiting',
    /* เพิ่ม 2026-09-03: ข้อมูลของเช็คลิสต์สถานะ — ป้ายรวมด้านบนยังคำนวณเหมือนเดิมทุกประการ
       ของเดิมที่อ่าน status_label/status_class อยู่จึงไม่ได้รับผลกระทบ */
    status_steps:s.statusSteps(o),
    status_aria:s.statusAria(o),
    doctor:s.requesterName(o),
    /* ส่งข้อความเต็มไปเลย แล้วให้ CSS ellipsis ตัดตามความกว้างคอลัมน์จริง
       ถ้าตัดด้วย JS ที่จำนวนตัวอักษร จะสั้นเกินบนจอกว้างและยังล้นบนจอแคบ */
    /* ไม่มีค่าให้แสดงแค่ "Diagnosis:" เฉย ๆ (ผู้ใช้ขอ 2026-09-02 · เหมือน LAB)
       ข้อความ "รอเชื่อม EMR" เดิมทำให้เข้าใจผิดว่าระบบยังไม่ได้ต่อ ทั้งที่ต่อแล้ว
       แต่คนไข้รายนั้นยังไม่มี Diagnosis บันทึกไว้จริง ๆ */
    dx_short:'Diagnosis: '+dx,
    dx_full:dx,
    dx_has:!!dx,
    cancelled:cancelled,
    has_result:hasResult,
    can_pdf:state==='complete',
    pdf_hint:state==='complete'?'พิมพ์ผลอ่าน':'พิมพ์ได้เมื่อออกผลครบ',
    can_dispatch:!cancelled&&items.some(i=>s.itemState(i)==='waiting'||s.transportFailed(i)||s.needsAccession(i)||s.canResend(i)),
    dispatch_ready:!!selectedCount&&selectedItems.every(i=>i.can_dispatch_item),
    dispatch_disabled_reason:selectedItems.some(i=>i.finance_blocked)
      ?'ยังไม่ผ่านการเงิน'
      :(!selectedCount
        ?(dispatchChoices.length&&dispatchChoices.every(i=>i.finance_blocked)?'ยังไม่ผ่านการเงิน':'เลือกรายการที่จะส่งเข้าเครื่อง')
        :(selectedItems.every(i=>i.can_dispatch_item)?'':'ส่งเข้าเครื่องได้เฉพาะรายการที่พร้อมส่ง')),
    can_retest:builtItems.some(i=>i.can_retest),
    retest_ready:!!selectedCount&&selectedItems.every(i=>i.can_retest),
    retest_hint:!selectedCount?'เลือกรายการ X-ray ที่ยกเลิกแล้ว'
      :selectedItems.every(i=>i.can_retest)?'เปิดตรวจใหม่เฉพาะ '+selectedCount+' รายการที่เลือก'
      :'เลือกรายการที่ยกเลิกแล้วเท่านั้น',
    /* เปลี่ยน 2026-09-03: checkbox เลือกหลาย item/เลือกทั้งหมดได้แล้ว แต่ Process เดิม
       ยังรับ item_id เดี่ยว จึงส่งตามลำดับทีละ item จากปุ่มเดียวโดยไม่เปลี่ยน API contract */
    dispatch_label:selectedCount>1?('ส่งเข้าเครื่อง '+selectedCount+' รายการ')
      :((picked&&(picked.transport_failed||picked.needs_accession))?'ส่งเข้าเครื่องใหม่'
        :((picked&&picked.can_resend)?'ส่งตรวจซ้ำ':'ส่งเข้าเครื่อง')),
    dispatch_hint:selectedCount>1?('ส่งรายการที่เลือก '+selectedCount+' รายการตามลำดับ')
      :(picked
        ?((picked.can_resend&&!picked.transport_failed&&!picked.needs_accession)
          /* เปลี่ยนตามคำสั่งผู้ใช้ 2026-09-03: ส่งตรวจซ้ำใช้ Order เดิม แต่ล้างเลข
             Accession เดิมทิ้งแล้วออกเลขใหม่ตอนกดส่ง (เดิมใช้เลขเดิมซ้ำ) */
          ?('ส่งตรวจซ้ำ '+picked.name+' · ระบบจะออกเลข Accession ใหม่ให้')
          :('ส่ง '+picked.name+' เข้าเครื่อง'))
        :'เลือกรายการที่จะส่ง'),
    can_reject:!cancelled&&items.some(i=>s.itemState(i)==='waiting'),
    can_cancel:cancelCheck.can,
    cancel_hint:cancelCheck.hint,
    reject_ready:!!(picked&&picked.can_reject),
    reject_hint:picked
      ?(picked.can_reject?('ปฏิเสธ '+picked.name):'ปฏิเสธได้เฉพาะรายการที่ยังไม่ได้ส่งเข้าเครื่อง')
      :'เลือกรายการที่จะปฏิเสธ 1 รายการ',
    selected_count:selectedCount,
    selected_item_id:picked?picked.id:'',
    selected_item_name:picked?picked.name:'',
    dispatching:!!s.dispatching[s.text(o&&o.order_id)||s.text(o&&o._id)],
    rejecting:!!s.rejecting[s.text(o&&o.order_id)||s.text(o&&o._id)],
    retesting:!!s.retesting[s.text(o&&o.order_id)||s.text(o&&o._id)],
    first_result_item:resultItems.filter(r=>r.done)[0]||null,
    items:builtItems,
    result_items:resultItems,
    emr:{visit_id:s.text((o&&o.emr_context&&o.emr_context.visit_id)||(o&&o.visit&&o.visit.visit_id))}
  };
};
s.recompute=()=>{
  const source=Array.isArray(s.orders)?s.orders:[];
  const orders=source.filter(o=>s.matchesModality(o)&&s.matchesQuery(o));
  const modalities=s.buildModalities();
  const picked=Array.isArray(s.modality)?s.modality:[];
  const modalityLabel=picked.length
    ?picked.map(code=>{
      const found=modalities.filter(m=>m.value===code)[0];
      return found?found.label:code;
    }).join(', ')
    :'ทุกเครื่อง';
  const chip=(s.statusFilters.filter(f=>f.key===s.statusKey)[0]||{}).label||'';
  const usingMaster=Array.isArray(s.modalityMaster)&&s.modalityMaster.length>0;
  /* API เป็นผู้ตัดสินช่วงวันที่จริง (ค่าเริ่มต้นคือวันนี้ ยกเว้นค้น HN ตรงตัว)
     จึงต้องบอกผู้ใช้ว่ากำลังดูช่วงไหนอยู่ ไม่ปล่อยให้เดาจากช่องว่าง */
  const scope=s.dateScope||{};
  const scopeText=scope.defaulted
    ?(scope.include_backlog===false?'วันนี้ (ค่าเริ่มต้น)':'วันนี้ + งานค้างทุกวัน (ค่าเริ่มต้น)')
    :(scope.from||scope.to)
      ?(s.datePart(scope.from)||scope.from||'…')+' – '+(s.datePart(scope.to)||scope.to||'…')
      :'ทั้งหมด';
  s.view={
    rows:orders.map(s.buildRow),
    dateScopeText:scopeText,
    /* API ตอบ success:true พร้อมเหตุผลได้ (เช่น Organization ยังไม่ถูกผูกกับหน่วยรังสี)
       ถ้าไม่แสดง ผู้ใช้จะเห็นแต่ 'ไม่พบรายการ' แล้วไม่รู้ว่าต้องแก้อะไร */
    serverNote:(!orders.length&&!s.loading)?s.text(s.serverMessage):'',
    dataNote:Number(s.unmapped||0)>0?('มี '+Number(s.unmapped)+' รายการที่ยังไม่มีเครื่องผูกไว้ใน master — แจ้งผู้ดูแลตรวจสอบ item master'):'',
    counts:{
      all:Number(s.counts.all||0),
      waiting:Number(s.counts.waiting||0),
      pending:Number(s.counts.pending||0),
      complete:Number(s.counts.complete||0),
      cancelled:Number(s.counts.cancelled||0)
    },
    modalities:modalities,
    modalityReady:modalities.length>0,
    modalityPlaceholder:modalities.length?'Select all':'ยังไม่มีรายการเครื่องจาก API',
    modalityPicked:picked.slice(),
    modalityAria:'กรองตามเครื่อง · '+modalityLabel+' · '+orders.length+' รายการ',
    modalityNote:(!modalities.length&&!s.loading&&!s.errorMessage)?'ตัวกรองเครื่องปิดไว้ — API ยังไม่คืน data.modalities[] และยังไม่มีรายการให้รวบรวมเครื่องได้':(usingMaster?'':(modalities.length?'รายชื่อเครื่องรวบรวมจากรายการที่โหลดมา — ให้ API คืน data.modalities[] เพื่อได้รายชื่อและจำนวนครบทั้งหน่วยงาน':'')),
    summary:'แสดง '+orders.length+' รายการ จากทั้งหมด '+Number(s.page.total||0)+' · เครื่อง: '+modalityLabel+' · สถานะ: '+chip+
      (s.scanMode?(' · '+s.scanLabel+' '+s.scanDisplay+' · ทุกวันที่'):(' · ช่วงวันที่: '+scopeText)),
    configWarning:WORKLIST_PROCESS_ID?'':'ยังไม่ได้ตั้งค่า Process ID ของ xray-cpoe-worklist — ใส่ค่าที่ตัวแปร WORKLIST_PROCESS_ID ใน onCreated ของ widget นี้ก่อน จึงจะโหลดรายการได้'
  };
};

/* ── interaction ────────────────────────────────────────────────────────── */
s.isExpanded=id=>!!s.expanded[id];
/* ย่อแถวแล้วล้างที่ติ๊กไว้ กันเผลอกดส่งของที่มองไม่เห็น (แบบเดียวกับ LAB) */
s.toggleOrder=id=>{s.expanded={...s.expanded,[id]:!s.expanded[id]};s.selected={};s.recompute();};
/* ผู้ใช้ขอ 2026-09-11: กดพื้นที่ใดก็ได้ของแถว Order เพื่อเปิด/ย่อ
   แต่ control ภายในแถวเป็นเจ้าของ click ของตัวเอง และการลากเลือกข้อความต้องไม่สลับแถว */
s.toggleOrderFromRow=(row,event)=>{
  const id=s.text(row&&row.id);
  if(!id)return;
  const el=event&&event.target;
  if(el&&typeof el.closest==='function'&&el.closest('button,a,input,textarea,select,label,.el-button,.el-input,.el-select,.el-checkbox,.el-dropdown,[role="button"]'))return;
  const sel=(typeof window!=='undefined'&&window.getSelection)?window.getSelection():null;
  if(sel&&s.text(sel.toString()))return;
  s.toggleOrder(id);
};
/* เปลี่ยน 2026-09-03 ตามคำสั่งผู้ใช้: เลือกหลาย item และเลือกทั้งหมดได้
   การปฏิเสธยังคงทีละ item เพราะต้องมีหลักฐานเหตุผลต่อรายการ */
s.toggleItem=id=>{
  const key=s.text(id);
  if(!key)return;
  const next={...s.selected};
  if(next[key])delete next[key];else next[key]=true;
  s.selected=next;
  s.recompute();
};
s.selectableItemIds=row=>((row&&row.items)||[]).filter(item=>item&&item.can_select).map(item=>s.text(item.id)).filter(Boolean);
s.allSelectableSelected=row=>{const ids=s.selectableItemIds(row);return !!ids.length&&ids.every(id=>!!s.selected[id]);};
s.someSelectableSelected=row=>{const ids=s.selectableItemIds(row);const count=ids.filter(id=>!!s.selected[id]).length;return count>0&&count<ids.length;};
s.toggleAllItems=row=>{
  const ids=s.selectableItemIds(row);
  if(!ids.length)return;
  const next={...s.selected},clear=ids.every(id=>!!next[id]);
  ids.forEach(id=>{if(clear)delete next[id];else next[id]=true;});
  s.selected=next;
  s.recompute();
};
/* กดตรงไหนของแถวก็เลือกได้ ไม่ต้องเล็งช่อง checkbox (ผู้ใช้ขอ 2026-09-01)
   ข้ามให้สามกรณี ไม่งั้นจะไปรบกวนงานอื่นของผู้ใช้:
     1) กดที่ checkbox เอง — มันยิง toggleItem อยู่แล้ว ปล่อยผ่านจะสลับสองรอบ = ไม่เกิดอะไร
     2) กดที่ปุ่ม/ลิงก์/ช่องกรอกในแถว — เจ้าของ control ต้องได้ event ไป
     3) เพิ่งลากเลือกข้อความ (เช่นจะ copy เลข Accession) — ปล่อยคลิกจบโดยไม่สลับ */
s.selectRow=(item,event)=>{
  if(!item||!item.can_select)return;
  const el=event&&event.target;
  if(el&&typeof el.closest==='function'&&el.closest('.el-checkbox,button,a,input,textarea,.el-select,.el-input'))return;
  const sel=(typeof window!=='undefined'&&window.getSelection)?window.getSelection():null;
  if(sel&&s.text(sel.toString()))return;
  s.toggleItem(item.id);
};
s.detailTab=id=>s.detailTabs[id]||'order';
s.setDetailTab=(id,tab)=>{if(!id)return;s.detailTabs={...s.detailTabs,[id]:tab};};
s.setSearch=v=>{s.filters={...s.filters,q:v||''};s.recompute();};
s.setDates=v=>{s.filters={...s.filters,dates:Array.isArray(v)?v:[]};s.applyFilters();};
s.setSort=v=>{
  const next=s.sortOptions.some(o=>o.value===v)?v:'latest';
  if(next===s.sortKey)return;
  s.sortKey=next;
  /* กลับไปหน้า 1 เพราะลำดับเปลี่ยนแล้วเลขหน้าเดิมไม่มีความหมาย
     นับ chip ไม่ขึ้นกับลำดับ จึงไม่ต้อง refreshCounts ซ้ำ */
  s.page={...s.page,current:1};
  s.loadOrders();
};
s.setStatus=key=>{if(!s.statusMap[key]||s.statusKey===key)return;s.statusKey=key;s.page={...s.page,current:1};s.loadOrders();};
s.setPage=page=>{s.page={...s.page,current:Number(page)||1};s.loadOrders();};
s.setPageSize=size=>{s.page={...s.page,current:1,size:Number(size)||30};s.loadOrders();};
/* ใช้ฐานเดียวกันตั้งแต่ 0 แท็ก: ช่องไม่กระโดดกว้างเมื่อเลือก 2 แล้วหดเมื่อเลือก 3
   ขนาดฐาน 186px รองรับ code สั้น 3 คอลัมน์ + gap + wrapper/ลูกศรตาม DOM จริง
   code ยาวกว่าจึงขยายตามคอลัมน์ที่ต้องใช้; input ค้นหาห่อแถวได้เมื่อพื้นที่เต็ม */
const MODALITY_BASE_W=186;
const MODALITY_MAX_W=360;
s.modalitySelectWidth=()=>{
  const picked=Array.isArray(s.modality)?s.modality:[];
  if(!picked.length)return MODALITY_BASE_W+'px';
  const columns=[0,0,0];
  picked.forEach((code,index)=>{
    columns[index%3]=Math.max(columns[index%3],Math.max(48,s.text(code).length*8+34));
  });
  return Math.min(MODALITY_MAX_W,Math.max(MODALITY_BASE_W,columns.reduce((sum,width)=>sum+width,0)+8+28))+'px';
};
/* เลือกเครื่องแล้วกรองทันที ไม่ต้องกด Search และ reset ไปหน้า 1 (design §6.2) */
s.setModality=v=>{
  /* el-select multiple ส่ง array มา · รับค่าเดี่ยวและ null ไว้ด้วยเผื่อผู้เรียกเก่า */
  const list=(Array.isArray(v)?v:(v==null||v===''?[]:[v])).map(s.text).filter(Boolean);
  const next=[];
  list.forEach(code=>{if(next.indexOf(code)<0)next.push(code);});
  if(next.join(',')===(Array.isArray(s.modality)?s.modality:[]).join(','))return;
  s.modality=next;
  s.page={...s.page,current:1};
  s.loadOrders();
  s.refreshCounts();
};
/* เอาเครื่องออกทีละตัวแบบเจาะจง — ผู้ใช้ตัดปุ่มกากบาททิ้ง 2026-09-02 เพราะกดซ้ำที่แถว
   ก็ยกเลิกได้อยู่แล้ว · คงเมธอดไว้เป็นทางเรียกแบบระบุตัว (ใช้โดย clearModality และเทส)
   ไม่ได้ลบเพราะไม่มีอะไรเสียหาย และยังเป็นจุดเดียวที่การันตีว่าเอาออกทีละตัวถูกต้อง */
s.unpickModality=code=>{
  const target=s.text(code);
  const picked=Array.isArray(s.modality)?s.modality:[];
  if(picked.indexOf(target)<0)return;
  s.setModality(picked.filter(value=>value!==target));
};
/* รับ HN หรือเลขบัตรจากวิดเจ็ตสแกน — ตัวเลขล้วนอย่างน้อย 6 หลัก เหมือน LAB
   ล้างคำค้นเดิมทิ้ง เพราะสองอย่างนี้ตีกันแล้วผู้ใช้จะงงว่าทำไมไม่เจอ */
/* เครื่องสแกนพิมพ์เหมือนคีย์บอร์ด ถ้าเครื่องค้างอยู่โหมดภาษาไทย ตัวเลขจะกลายเป็น
   อักษรไทยตามผัง Kedmanee — HN 6900001 อ่านได้เป็น ุตจจจจๅ
   (ยืนยันจาก runtime ฝั่ง LAB 2026-09-02 · ถ้าไม่แปลงกลับ จะกลายเป็นค่าว่างทันที)
   แปลงเฉพาะเมื่อเจออักษรไทยจริง ๆ เพื่อไม่ให้ '-' หรือ '/' ใน barcode ปกติถูกแปลงผิด */
s.THAI_DIGIT_KEYS={'ๅ':'1','/':'2','-':'3','ภ':'4','ถ':'5','ุ':'6','ึ':'7','ค':'8','ต':'9','จ':'0'};
s.normalizeScanDigits=v=>{
  const raw=s.text(v);
  if(!/[ๅภถุึคตจ]/.test(raw))return raw;
  return raw.split('').map(ch=>(s.THAI_DIGIT_KEYS[ch]!=null?s.THAI_DIGIT_KEYS[ch]:ch)).join('');
};
s.scanPatientHn=hn=>{
  const code=s.normalizeScanDigits(hn).replace(/\\D/g,'');
  if(code.length<6){field.notify('อ่านเลขผู้ป่วยจากการสแกนไม่ได้: '+s.text(hn),'warning',3600);return;}
  const isCitizenId=code.length===13;
  s.scanMode=true;
  s.scanType=isCitizenId?'citizen_id':'hn';
  s.scannedHn=isCitizenId?'':code;
  s.scannedCitizenId=isCitizenId?code:'';
  s.scanLabel=isCitizenId?'เลขบัตรประชาชน':'HN';
  s.scanDisplay=isCitizenId?'•••••••••'+code.slice(-4):code;
  s.scanNoticePending=true;
  /* สแกน HN ทับโหมดเปิดจากคิว — ไม่งั้นจะกรองซ้อนกันจนไม่เจออะไรเลย */
  s.focusVisitId='';
  s.focusVisitVn='';
  s.filters={...s.filters,q:''};
  s.expanded={};
  s.detailTabs={};
  s.selected={};
  s.orders=[];
  s.page={...s.page,current:1,total:0};
  s.loadOrders();
  s.refreshCounts();
};
s.clearScan=()=>{
  if(!s.scanMode)return;
  s.resetScan();
  s.expanded={};
  s.detailTabs={};
  s.selected={};
  s.page={...s.page,current:1,total:0};
  s.loadOrders();
  s.refreshCounts();
};
/* ── เปิดจากคิว (เพิ่ม 2026-09-08) ─────────────────────────────────────────
   ผู้ใช้ยืนยันว่าปุ่ม X-ray ในคิว "แค่กาง order ให้ดู" ⇒ ที่นี่อ่านอย่างเดียวล้วน
   ไม่แตะ current_status ไม่แตะสถานะคิว ไม่ยิง dispatch
   กรองด้วย visit_id แบบ exact ฝั่ง API ไม่ใช่ยัด VN ลงช่องค้นหา เพราะ q เป็น regex
   แล้ว VN ที่เป็น prefix ของอีก VN จะติดมาด้วย */
s.focusVisit=target=>{
  const visitId=s.text(target&&target.visit_id);
  if(!visitId){field.notify('คิวนี้ไม่มี Visit ID','warning',3000);return;}
  const form=field.getFormRef&&field.getFormRef();
  if(form)form.$xrayQueueTarget=null;
  s.scanMode=false;s.scannedHn='';s.scanNoticePending=false;
  s.filters={...s.filters,q:'',dates:[]};
  s.focusVisitId=visitId;
  s.focusVisitVn=s.text(target&&target.vn);
  s.expanded={};s.detailTabs={};s.selected={};
  s.page={...s.page,current:1};
  s.loadOrders();
  s.refreshCounts();
};
s.clearFocusVisit=()=>{
  if(!s.focusVisitId)return;
  s.focusVisitId='';s.focusVisitVn='';
  s.expanded={};s.detailTabs={};s.selected={};
  s.page={...s.page,current:1};
  s.loadOrders();
  s.refreshCounts();
};

/* กด Search เอง = ออกจากโหมดสแกน (ผู้ใช้ตั้งใจค้นด้วยเงื่อนไขของตัวเอง) */
s.applyFilters=()=>{s.resetScan();s.focusVisitId='';s.focusVisitVn='';s.modalityPool=[];s.page={...s.page,current:1};s.loadOrders();s.refreshCounts();};
s.clearModality=()=>s.setModality([]);

s.notifyPending=label=>field.notify(label+' รอการเชื่อมต่อ','info',2500);
s.reportCommand=type=>s.notifyPending(type==='excel'?'Report Excel':'Report PDF');
s.explainWriteBlock=action=>field.notify(action+' ยังไม่เปิดใช้ — ต้องได้ contract จากทีม RIS ก่อน (decision X9)','warning',3600);

/* ── ปุ่ม "ดูภาพ" → เปิดโปรแกรมดูภาพของ RIS (ผู้ใช้แจ้งลิงก์ 2026-09-15) ──────
   ทีม RIS ให้มา 2 level:
     AN   <BASE>?QueryMode=AN&Value=<Accession No.>   ← เจาะ study นั้นใบเดียว
     PID  <BASE>?QueryMode=PID&Value=<HN>             ← ทุก study ของคนไข้คนนั้น
   ปุ่มนี้อยู่ระดับ item ⇒ ใช้ AN ก่อนเสมอเมื่อรายการมีเลข Accession แล้ว
   ยังไม่ได้ส่งเข้าเครื่อง (ไม่มีเลข) จึงตกกลับไป PID เพื่อให้ยังเปิดดูของเก่าได้
   ค่าทั้งสองมาจากข้อมูลแถวที่ API เดิมส่งมาอยู่แล้ว (item.accession_no · row.hn)
   ⇒ **ไม่มี API ตัวใหม่ ไม่มี Process ใหม่**
   🔴 เปิดจาก browser เท่านั้น เพราะ base เป็นเครื่องของผู้ใช้เอง (localhost) */
s.risViewerUrl=(row,item)=>{
  if(!RIS_VIEWER_BASE)return '';
  const an=s.text(item&&item.accession_no),hn=s.text(row&&row.hn);
  const mode=an?'AN':(hn?'PID':'');
  if(!mode)return '';
  return RIS_VIEWER_BASE+(RIS_VIEWER_BASE.indexOf('?')>=0?'&':'?')+
    'QueryMode='+mode+'&Value='+encodeURIComponent(an||hn);
};
/* บอกให้ชัดว่ากำลังจะเปิดแบบไหน — เปิดด้วย HN แล้วเห็นหลาย study เป็นเรื่องปกติ
   ไม่ใช่ความผิดพลาด ผู้ใช้ต้องรู้ล่วงหน้าว่าทำไมไม่ได้เห็นใบเดียว */
s.imageHint=(row,item)=>{
  if(!RIS_VIEWER_ENABLED)return 'ดูภาพ · รอ RIS เปิดลิงก์ให้ใช้งาน';
  const an=s.text(item&&item.accession_no),hn=s.text(row&&row.hn);
  if(an)return 'เปิดภาพของ Accession No. '+an+' ในโปรแกรม RIS';
  if(hn)return 'รายการนี้ยังไม่มีเลข Accession — เปิดด้วย HN '+hn+' จะเห็นทุกรายการของคนไข้';
  return 'Order นี้ไม่มีทั้ง Accession No. และ HN จึงเปิดภาพไม่ได้';
};
/* href ของลิงก์ "ดูภาพ" — ว่างเมื่อยังไม่เปิดใช้หรือไม่มีทั้ง AN และ HN
   ⇒ เทมเพลตจะตกไปใช้ปุ่มเดิมที่อธิบายเหตุผลให้ ไม่ใช่ลิงก์ที่กดแล้วไปไหนไม่ได้ */
s.viewerHref=(row,item)=>RIS_VIEWER_ENABLED?s.risViewerUrl(row,item):'';
/* คงไว้เป็นทางสำรอง: ใช้กับเคสที่ยังไม่มี URL (แจ้งเหตุผล) และเผื่อผู้เรียกเก่า
   เส้นทาง window.open ยังอยู่ครบ ไม่ได้ถูกถอด */
s.openImage=(row,item)=>{
  /* ยังไม่เปิดใช้ = พฤติกรรมเดิมทุกตัวอักษร ไม่เปิดแท็บเปล่าให้ผู้ใช้เจอหน้า error */
  if(!RIS_VIEWER_ENABLED){s.notifyPending('ดูภาพ · RIS ยังไม่เปิดลิงก์');return;}
  const url=s.risViewerUrl(row,item);
  if(!url){field.notify('รายการนี้ไม่มี Accession No. หรือ HN สำหรับเปิดภาพ','warning',3000);return;}
  /* ไม่ใส่ 'noopener' ใน windowFeatures เพราะ browser จะคืน null เสมอ แล้วเราจะ
     แยกไม่ออกว่าโดน popup blocker หรือเปิดสำเร็จ ⇒ ตัด opener ทิ้งเองหลังเปิด */
  const win=(typeof window!=='undefined'&&window.open)?window.open(url,'_blank'):null;
  if(!win){field.notify('เบราว์เซอร์บล็อกการเปิดแท็บใหม่ — อนุญาต pop-up ของหน้านี้แล้วกดใหม่','warning',5200);return;}
  try{win.opener=null;}catch(e){}
};

/* ── ส่งเข้าเครื่อง ────────────────────────────────────────────────────────
   เรียก Process เดียว ลำดับทั้งหมดอยู่ฝั่ง server (spec.md §4.2)
   success:true + transport.status==='failed' = รับไว้แล้วแต่ RIS ไม่รับ ⇒ กดใหม่ได้ */
s.dispatchOrder=async row=>{
  const id=s.text(row&&row.id);
  if(!id){field.notify('ไม่พบรหัส Order','error',3200);return;}
  if(!DISPATCH_PROCESS_ID){field.notify('ยังไม่ได้ตั้งค่า Process ID ของ xray-cpoe-dispatch — ใส่ค่าที่ตัวแปร DISPATCH_PROCESS_ID ใน onCreated ก่อน','warning',5200);return;}
  /* ผู้ใช้เลือกหลายรายการได้ แต่ Process รับ item_id เดี่ยว จึงเรียกตามลำดับทีละ item
     เพื่อคง transaction/accession/transport contract เดิมของแต่ละรายการ */
  const itemIds=((row&&row.items)||[]).filter(i=>i.selected).map(i=>s.text(i.id)).filter(Boolean);
  if(!itemIds.length){field.notify('เลือกรายการที่จะส่งเข้าเครื่อง','warning',3200);return;}
  if(((row&&row.items)||[]).some(i=>i.selected&&i.finance_blocked)){
    field.notify('ยังไม่ผ่านการเงิน','warning',3000);return;
  }
  if(((row&&row.items)||[]).some(i=>i.selected&&(i.can_retest||i.can_dispatch_item===false))){
    field.notify('ส่งเข้าเครื่องได้เฉพาะรายการที่พร้อมส่ง กรุณาเลือกใหม่','warning',4000);return;
  }
  if(s.dispatching[id])return;
  s.dispatching={...s.dispatching,[id]:true};s.recompute();
  const sent=[],transportFailed=[],failed=[];
  try{
    for(let index=0;index<itemIds.length;index++){
      const itemId=itemIds[index];
      try{
        const p=await s.processCall(DISPATCH_PROCESS_ID,{order_id:id,item_id:itemId});
        const t=(p&&p.transport)||{};
        if(!p||p.success===false){failed.push({id:itemId,message:s.text(p&&p.message)||'ส่งเข้าเครื่องไม่สำเร็จ'});continue;}
        if(s.text(t.status)==='failed')transportFailed.push({id:itemId,message:s.text(p.message)||'รับรายการแล้วแต่ส่ง RIS ไม่สำเร็จ'});
        else sent.push({id:itemId,message:s.text(p.message)||'ส่งเข้าเครื่องแล้ว'});
      }catch(error){failed.push({id:itemId,message:s.text(error&&error.message)||'เรียก API ส่งเข้าเครื่องไม่สำเร็จ'});}
    }
    if(itemIds.length===1){
      if(failed.length)field.notify(failed[0].message,'error',8000);
      else if(transportFailed.length)field.notify(transportFailed[0].message,'warning',7000);
      else field.notify(sent[0].message,'success',3600);
    }else{
      const parts=[];
      if(sent.length)parts.push('ส่งสำเร็จ '+sent.length+' รายการ');
      if(transportFailed.length)parts.push('รับแล้วแต่ RIS ไม่สำเร็จ '+transportFailed.length+' รายการ');
      if(failed.length)parts.push('ไม่สำเร็จ '+failed.length+' รายการ');
      field.notify(parts.join(' · '),failed.length?'error':(transportFailed.length?'warning':'success'),8000);
    }
    if(sent.length||transportFailed.length){s.selected={};s.loadOrders();s.refreshCounts();}
  }finally{
    const next={...s.dispatching};delete next[id];s.dispatching=next;s.recompute();
  }
};
/* ── ปฏิเสธรายการระดับ item ────────────────────────────────────────────────
   ทรงเดียวกับ LAB: เปิดฟอร์มเหตุผล → บันทึกได้ record id → ค่อยเรียก API เปลี่ยนสถานะ
   ฟอร์มคือหลักฐาน · API แค่ทำให้สถานะตรงกับหลักฐาน ไม่มีทางลัดที่ข้ามฟอร์มได้ */
s.recordId=v=>{if(v==null)return '';if(typeof v==='object')return s.recordId(v.$oid||v._id||v.id||v.value||'');return String(v).trim();};
s.savedRow=v=>{const c=[v&&v.data&&v.data.data,v&&v.reply&&v.reply.data,v&&v.data,v];for(let i=0;i<c.length;i++){if(c[i]&&typeof c[i]==='object'&&!Array.isArray(c[i]))return c[i];}return {};};
s.rejectSelected=row=>{
  const orderId=s.text(row&&row.id);
  const itemId=s.text(row&&row.selected_item_id);
  if(!orderId){field.notify('ไม่พบรหัส Order','error',3200);return;}
  if(!itemId){field.notify('เลือกรายการที่จะปฏิเสธ 1 รายการ','warning',3200);return;}
  if(!REJECT_PROCESS_ID||!REJECTION_FORM_ID){
    field.notify('ยังปฏิเสธไม่ได้ — ต้อง deploy Process xray-cpoe-reject และสร้างฟอร์มเหตุผลการปฏิเสธของรังสีก่อน แล้วใส่ค่าที่ REJECT_PROCESS_ID / REJECTION_FORM_ID','warning',6000);
    return;
  }
  const item=((row&&row.items)||[]).filter(i=>s.text(i.id)===itemId)[0];
  if(!item||!item.can_reject){field.notify('ปฏิเสธได้เฉพาะรายการที่ยังไม่ได้ส่งเข้าเครื่อง','warning',3600);return;}
  const form=field.getFormRef&&field.getFormRef();
  if(!form||typeof form.openForm!=='function'){field.notify('ไม่พบตัวเปิดฟอร์มเหตุผลการปฏิเสธ','error',3500);return;}
  const initData={
    source_item_id:itemId,
    source_order_id:itemId,
    order_group_id:s.text(row.order_no)||orderId,
    patient_hn:s.text(row.hn),
    patient_name:s.text(row.name),
    patient_display:[s.text(row.hn),s.text(row.name)].filter(Boolean).join(' — '),
    ward_clinic:s.text(row.room),
    modality:s.text(item.modality),
    accession_no:s.text(item.accession_no),
    selected_items_json:JSON.stringify([{source_item_id:itemId,item_code:s.text(item.code),item_name:s.text(item.name),modality:s.text(item.modality)}]),
    revision_no:'1',
    rejection_status:'recorded'
  };
  form.openForm(REJECTION_FORM_ID,null,null,initData,{
    params:Object.assign({},form.formParams||{},{from:'xray-cpoe-worklist',item_id:itemId,order_id:orderId,order_number:s.text(row.order_no)}),
    popupType:'dialog',backdrop:false,
    beforeSaveCallback:()=>({source_item_id:itemId,order_group_id:s.text(row.order_no)||orderId,rejection_status:'recorded'}),
    afterSaveCallback:async saved=>{
      const rejectionRecordId=s.recordId(s.savedRow(saved)._id||s.savedRow(saved).id);
      if(!rejectionRecordId){field.notify('บันทึกเหตุผลแล้ว แต่ไม่พบ record id สำหรับเปลี่ยนสถานะ','error',5000);return;}
      if(s.rejecting[orderId])return;
      s.rejecting={...s.rejecting,[orderId]:true};s.recompute();
      try{
        const p=await s.processCall(REJECT_PROCESS_ID,{action:'reject_item',item_id:itemId,rejection_record_id:rejectionRecordId,order_id:orderId,order_number:s.text(row.order_no)});
        if(!p||p.success===false){field.notify(s.text(p&&p.message)||'ปฏิเสธรายการไม่สำเร็จ','error',6000);return;}
        const d=p.data||{};
        field.notify(s.text(p.message)||'ปฏิเสธรายการแล้ว',d.audit_sync_pending?'warning':'success',d.audit_sync_pending?6000:3600);
        s.selected={};
        if(typeof form.subFormClose==='function')form.subFormClose();
        s.loadOrders();s.refreshCounts();
      }catch(error){
        field.notify(s.text(error&&error.message)||'เรียก API ปฏิเสธไม่สำเร็จ','error',6000);
      }finally{
        const next={...s.rejecting};delete next[orderId];s.rejecting=next;s.recompute();
      }
    }
  });
};
/* ── ยกเลิกเฉพาะ item ที่เลือก ────────────────────────────────────────────
   เรียก action 'cancel_order' ของ worklist Process ตัวเดิม — ไม่ต้อง deploy
   Process ใหม่ (ทรงเดียวกับ LAB) · ฝั่ง server ตัดสินเรื่องเลข Accession อีกชั้น */
s.setCancelVisible=v=>{
  if(s.cancelDialog.loading)return;
  if(v)return;
  s.cancelDialog={...s.cancelDialog,visible:false};
};
s.setCancelReason=v=>{s.cancelDialog={...s.cancelDialog,reason:s.text(v)};};
s.resetCancelDialog=()=>{
  if(s.cancelDialog.loading)return;
  s.cancelDialog={visible:false,loading:false,order_id:'',order_no:'',item_ids:[],item_names:[],reason:''};
};
s.openCancelOrder=row=>{
  const id=s.text(row&&row.id);
  if(!id){field.notify('ไม่พบรหัส Order','error',3200);return;}
  if(!row.can_cancel){field.notify(s.text(row.cancel_hint)||'ยกเลิก Order นี้ไม่ได้','warning',4200);return;}
  const picked=(row.items||[]).filter(item=>item.selected);
  const itemIds=picked.map(item=>s.text(item.id)).filter(Boolean);
  if(!itemIds.length){field.notify('กรุณาเลือกรายการ X-ray','warning',3200);return;}
  s.cancelDialog={visible:true,loading:false,order_id:id,order_no:s.text(row.order_no),item_ids:itemIds,item_names:picked.map(item=>s.text(item.name)||s.text(item.code)),reason:''};
};
s.submitCancelOrder=async()=>{
  const id=s.text(s.cancelDialog.order_id);
  const reason=s.text(s.cancelDialog.reason);
  if(!id){field.notify('ไม่พบรหัส Order','error',3200);return;}
  if(!s.cancelDialog.item_ids.length){field.notify('กรุณาเลือกรายการ X-ray','warning',3200);return;}
  if(!reason){field.notify('กรุณาระบุเหตุผลการยกเลิกรายการ','warning',3200);return;}
  if(s.cancelDialog.loading)return;
  s.cancelDialog={...s.cancelDialog,loading:true};
  try{
    const p=await s.processCall(WORKLIST_PROCESS_ID,{action:'cancel_order',organization_code:s.unitCode(),order_id:id,order_number:s.text(s.cancelDialog.order_no),item_ids:s.cancelDialog.item_ids.slice(),cancel_reason:reason});
    if(!p||p.success===false){
      s.cancelDialog={...s.cancelDialog,loading:false};
      field.notify(s.text(p&&p.message)||'ยกเลิก Order ไม่สำเร็จ','error',7000);
      return;
    }
    const d=p.data||{};
    s.cancelDialog={visible:false,loading:false,order_id:'',order_no:'',item_ids:[],item_names:[],reason:''};
    s.selected={};
    const needsAttention=d.audit_sync_pending||d.upstream_delivery_issue;
    field.notify(s.text(p.message)||'ยกเลิก Order แล้ว',needsAttention?'warning':'success',needsAttention?8000:3600);
    s.loadOrders();s.refreshCounts();
  }catch(error){
    s.cancelDialog={...s.cancelDialog,loading:false};
    field.notify(s.text(error&&error.message)||'เรียก API ยกเลิก Order ไม่สำเร็จ','error',6000);
  }
};
s.openConsentLibrary=()=>{
  if(!CONSENT_LIBRARY_FORM_ID){
    field.notify('ยังไม่ได้เชื่อมคลังเอกสาร X-ray — import ฟอร์มแยกแล้วตั้ง XRAY_CONSENT_LIBRARY_FORM_ID','warning',6000);
    return;
  }
  const form=field.getFormRef&&field.getFormRef();
  if(!form||typeof form.openForm!=='function'){field.notify('ไม่พบตัวเปิดคลังเอกสาร X-ray','error',3000);return;}
  form.openForm(CONSENT_LIBRARY_FORM_ID,'','',null,{backdrop:false,params:Object.assign({},form.formParams||{},{
    source:'xray-worklist',
    service_type:'xray'
  })});
};
/* ── บันทึกการใช้สารทึบรังสี ระดับ item (ผู้ใช้เลือกตัวเลือก A 2026-09-23) ──
   ผู้ใช้ยืนยันว่า log การใช้สารทึบเก็บไว้ในฟอร์มการใช้สารทึบเอง ⇒ ปุ่มนี้แค่เปิดฟอร์ม
   ไม่มีการเขียนสถานะ ไม่เรียก Process ไม่แตะข้อมูล Order/item ใด ๆ ทั้งสิ้น
   ยังไม่เชื่อมฟอร์ม = บอกให้ชัดว่าติดอะไรและต้องทำอะไรต่อ (ทรงเดียวกับปุ่มคลังหนังสือยินยอม)
   🔴 ตัวระบุรายการต้องไปทาง **initData** เท่านั้นจึงจะถูกบันทึกลงใบ — params ลงที่
      form.formParams ซึ่งไม่ได้เขียนค่าลงฟิลด์ (แก้ 2026-09-23 หลังผู้ใช้ทักว่าต้องมี
      ช่องเก็บจริง) · ฟอร์มสารทึบมีช่องรับครบแล้วที่การ์ด cmr_link
      (item_id · accession_no · order_id · order_no · visit_id · modality · item_code · item_name)
   params ยังส่งชุดเดิมไว้ด้วย ไม่ถอดออก เผื่อ event/สคริปต์ฝั่งฟอร์มที่อ่าน formParams อยู่
   ฟอร์มที่ไม่รู้จักคีย์ไหนจะมองข้ามไปเอง ส่งเกินจึงปลอดภัยกว่าส่งขาด */
s.openContrastRecord=(row,item)=>{
  if(!CONTRAST_FORM_ID){
    field.notify('ยังไม่ได้เชื่อมฟอร์มบันทึกการใช้สารทึบรังสี — import xray-contrast-media-record-v1 แล้วตั้ง XRAY_CONTRAST_FORM_ID ตอน generate ฟอร์มใหม่','warning',6000);
    return;
  }
  const form=field.getFormRef&&field.getFormRef();
  if(!form||typeof form.openForm!=='function'){field.notify('ไม่พบตัวเปิดฟอร์มบันทึกการใช้สารทึบรังสี','error',3000);return;}
  form.openForm(CONTRAST_FORM_ID,'','',{
    hn:s.text(row&&row.hn),
    patient_name:s.text(row&&row.name),
    patient_age:s.text(row&&row.age),
    /* การ์ด cmr_link ของฟอร์มสารทึบ — ชื่อคีย์ต้องตรงกับ options.name ทุกตัว */
    item_id:s.text(item&&item.id),
    accession_no:s.text(item&&item.accession_no),
    order_id:s.text(row&&row.id),
    order_no:s.text(row&&row.order_no),
    visit_id:s.text(row&&row.emr&&row.emr.visit_id),
    modality:s.text(item&&item.modality),
    item_code:s.text(item&&item.code),
    item_name:s.text(item&&item.name)
  },{
    backdrop:false,
    popupType:'dialog',
    params:Object.assign({},form.formParams||{},{
      source:'xray-worklist',
      service_type:'xray',
      order_id:s.text(row&&row.id),
      order_no:s.text(row&&row.order_no),
      visit_id:s.text(row&&row.emr&&row.emr.visit_id),
      hn:s.text(row&&row.hn),
      item_id:s.text(item&&item.id),
      accession_no:s.text(item&&item.accession_no),
      item_code:s.text(item&&item.code),
      item_name:s.text(item&&item.name),
      modality:s.text(item&&item.modality)
    })
  });
};
s.createOrderTarget=()=>{
  if(s.scanMode){
    if(s.scanType==='citizen_id'&&/^[0-9]{13}$/.test(s.scannedCitizenId))return {citizen_id:s.scannedCitizenId};
    if(/^[0-9]{6,12}$/.test(s.scannedHn))return {hn:s.scannedHn};
    return null;
  }
  const raw=s.text(s.filters&&s.filters.q);
  if(!/^(?:HN[\\s:-]*)?[0-9][0-9\\s-]*$/i.test(raw))return null;
  const digits=raw.replace(/[^0-9]/g,'');
  if(digits.length===13)return {citizen_id:digits};
  return /^[0-9]{6,12}$/.test(digits)?{hn:digits}:null;
};
s.createOrderVisitContext=visit=>{
  const p=visit&&visit.pid||{};
  return {
    person_id:s.text(visit&&visit.xtbxlv1_xfx_id||p.value),
    hn:s.text(p.hn),
    full_name:[s.text(p.prename),s.text(p.p_fname),s.text(p.p_lname)].filter(Boolean).join(' ').replace(/\\s+/g,' ').trim(),
    sex:({'1':'ชาย','2':'หญิง'})[s.text(p.p_gender)]||s.text(p.p_gender),
    age:p.age==null?'':p.age,
    blood_group:s.text(p.p_abogroup),
    p_pic:Array.isArray(p.p_pic)?p.p_pic:null,
    allergy_tags:[],
    visit_id:s.text(visit&&visit._id||visit&&visit.value),
    vn:s.text(visit&&visit.vn),
    visit_type:s.text(visit&&visit.visit_type),
    visit_datetime:s.text(visit&&visit.visit_date||visit&&visit.created_at),
    visit_clinic:s.text(visit&&visit.visit_clinic),
    visit_doctor:s.text(visit&&visit.visit_doctor),
    dx_summary:'',service_type:'',
    inscl_hos:Array.isArray(visit&&visit.inscl_hos)?visit.inscl_hos:[]
  };
};
s.openCreateOrder=async()=>{
  const form=field.getFormRef&&field.getFormRef();
  if(!form||typeof form.openForm!=='function'){field.notify('ไม่พบตัวเปิด CPOE Order App','error',3000);return;}
  if(s.createOrderLoading)return;
  s.dismissCreateOrderNotice();
  const launchParams=Object.assign({},form.formParams||{},{manual_visit:true,source:'xray-worklist'});
  const target=s.createOrderTarget();
  if(target){
    s.createOrderLoading=true;
    try{
      const p=await s.processCall(WORKLIST_PROCESS_ID,Object.assign({action:'resolve_open_visit',organization_code:s.unitCode()},target));
      if(!p||p.success===false){field.notify(s.text(p&&p.message)||'ตรวจสอบ VN วันนี้ไม่สำเร็จ','error',4200);return;}
      if(!p.data||!Object.prototype.hasOwnProperty.call(p.data,'visit')){
        field.notify(s.staleProcessNote('resolve_open_visit'),'error',6000);return;
      }
      const visit=p.data.visit;
      const hn=s.text(p.data.hn);
      if(!visit){s.showCreateOrderNotice(hn?'HN '+hn+' ยังไม่ได้เปิด VN วันนี้':'ยังไม่พบ HN ที่เปิด VN วันนี้');return;}
      if(!hn||s.text(visit.pid&&visit.pid.hn)!==hn||!s.text(visit._id||visit.value)){
        field.notify('ข้อมูล Visit ไม่ตรงกับ HN ที่ค้นหา กรุณาตรวจสอบอีกครั้ง','error',4200);return;
      }
      Object.assign(launchParams,s.createOrderVisitContext(visit));
    }catch(error){field.notify(s.text(error&&error.message)||'ตรวจสอบ VN วันนี้ไม่สำเร็จ','error',4200);return;}
    finally{s.createOrderLoading=false;}
  }
  form.openForm(CPOE_ORDER_APP_ID,'','',null,{backdrop:false,params:launchParams});
};
s.openEmr=row=>{
  const form=field.getFormRef&&field.getFormRef();
  const visitId=s.text(row&&row.emr&&row.emr.visit_id);
  if(!visitId){field.notify('Order นี้ไม่มี Visit ID สำหรับเปิด EMR History','warning',3000);return;}
  if(!form||typeof form.openForm!=='function'){field.notify('ไม่พบตัวเปิด EMR','error',3000);return;}
  form.openForm(EMR_FORM_ID,'','',null,{backdrop:false,popupType:'dialog',readonly:true,params:Object.assign({},form.formParams||{},{source:'xray-worklist',xray_deep_link:true,visit_id:visitId})});
};

/* ── result viewer — โครงสร้างผลอ่านจริงยังเป็น decision X6
   อ่านค่าตามที่ API คืนมา ถ้าไม่มีให้แสดงสถานะรอผล ไม่เดาค่าเอง ────────── */
/* RIS ส่ง ResultText มาเป็นก้อนเดียว ไม่ได้แยก Findings/Impression (D-X6 · 2026-09-02)
   ห้ามแบ่งหัวข้อเองด้วยการเดา — แสดงตามที่เขาส่งมาจริง */
/* ── ประวัติการแก้ผลอ่าน (เพิ่ม 2026-09-15 · ดีไซน์ที่ผู้ใช้อนุมัติ) ──────────
   RIS insert แถวใหม่ทุกครั้ง ⇒ ทุกฉบับอยู่ใน zdata_xray_result ครบอยู่แล้ว
   API action get_report คืน data.versions[] เรียงใหม่→เก่า (versions[0] = ล่าสุด)
   ฟอร์มไม่คำนวณลำดับเอง ใช้ no/latest ที่ server ส่งมา แล้วมีทางสำรองจาก index
   ⚠️ ไม่มี versions[] (Process เก่า) = ทุกอย่างในนี้ให้ค่าว่าง แล้ว dialog ตกกลับ
      ไปหน้าตาเดิมทุกประการ ของเดิมจึงไม่พังไม่ว่าจะ deploy คู่ไหน */
s.RESULT_STATUS_LABEL={F:'ผลสมบูรณ์ (F)',P:'ผลเบื้องต้น (P)',C:'แก้ไข (C)'};
/* ไฮไลต์ความต่างแบบรายบรรทัด: บรรทัดที่ไม่มีอยู่ในฉบับก่อนหน้า = ถูกแก้
   เทียบด้วยข้อความที่ trim แล้ว จึงไม่ไปติดกับการเว้นวรรคท้ายบรรทัด
   🔴 เป็นตัวช่วยอ่าน ไม่ใช่หลักฐานทางคลินิก — ข้อความเต็มของทุกฉบับยังอยู่ครบ */
s.diffLines=(text,previousText)=>{
  const prev=previousText?new Set(String(previousText).split('\\n').map(line=>line.trim())):null;
  return String(text||'').split('\\n').map(line=>({
    text:line,
    head:/^[A-Z][A-Z \\-']{1,38}:?$/.test(line.trim()),
    changed:!!prev&&!!line.trim()&&!prev.has(line.trim())
  }));
};
s.buildVersions=d=>{
  const raw=(d&&Array.isArray(d.versions))?d.versions:[];
  return raw.map((v,index)=>{
    const previous=raw[index+1]||null;
    const text=s.text(v&&v.result_text);
    const code=s.text(v&&v.result_status).toUpperCase();
    return {
      no:Number(v&&v.no)||(raw.length-index),
      latest:(v&&v.latest===true)||index===0,
      result_text:text,
      reported_text:s.compactDateTime(v&&v.reported_at),
      performed_text:s.compactDateTime(v&&v.performed_at),
      received_text:s.compactDateTime(v&&v.received_at),
      /* รหัสรังสีแพทย์ของฉบับนั้นเท่านั้น — ว่างก็ปล่อยว่าง ห้ามยืมของฉบับล่าสุดมาเติม */
      radiologist:s.text(v&&v.radiologist_uid),
      severity:s.text(v&&v.severity_uid),
      status_code:code,
      status_label:s.RESULT_STATUS_LABEL[code]||code,
      message_control_id:s.text(v&&v.message_control_id),
      has_previous:!!previous,
      lines:s.diffLines(text,previous&&previous.result_text)
    };
  });
};
s.versionSummary=d=>{
  const raw=(d&&Array.isArray(d.versions))?d.versions:[];
  if(raw.length<2)return '';
  const people={};
  raw.forEach(v=>{const uid=s.text(v&&v.radiologist_uid);if(uid)people[uid]=true;});
  const count=Object.keys(people).length;
  return 'RIS ส่งผลอ่านของ Accession นี้มา '+raw.length+' ฉบับ'+
    (count?(' · รังสีแพทย์ '+count+' คน'):'')+
    (d&&d.versions_capped?' · แสดง 20 ฉบับล่าสุด':'')+
    ' · ฉบับล่าสุดคือผลที่ใช้อ้างอิง';
};
s.currentReportVersion=()=>{
  const list=Array.isArray(s.report.versions)?s.report.versions:[];
  if(!list.length)return {no:0,latest:true,lines:[],has_previous:false,radiologist:'',severity:'',
    reported_text:'',received_text:'',status_label:'',message_control_id:''};
  const index=Math.min(Math.max(0,Number(s.report.selected)||0),list.length-1);
  return list[index];
};
s.selectReportVersion=index=>{s.report={...s.report,selected:Number(index)||0};};
s.goLatestReportVersion=()=>{
  const list=Array.isArray(s.report.versions)?s.report.versions:[];
  const at=list.findIndex(v=>v.latest);
  s.selectReportVersion(at<0?0:at);
};
s.toggleReportHistory=()=>{
  const open=!s.report.history_open;
  /* ปิดประวัติ = กลับไปฉบับล่าสุดเสมอ ไม่ให้เหลือฉบับเก่าค้างบนจอโดยไม่มีแถบเตือน */
  s.report={...s.report,history_open:open,selected:open?s.report.selected:0};
  if(!open)s.goLatestReportVersion();
};
s.setReportDiff=v=>{s.report={...s.report,diff:!!v};};
/* หัวและท้าย dialog เดินตามฉบับที่กำลังดู · ไม่มี versions = ค่าเดิมจาก report.data */
s.shownReported=()=>{
  const list=Array.isArray(s.report.versions)?s.report.versions:[];
  return list.length?s.currentReportVersion().reported_text:s.text(s.report.data&&s.report.data.reported_text);
};
s.shownRadiologist=()=>{
  const list=Array.isArray(s.report.versions)?s.report.versions:[];
  return list.length?s.currentReportVersion().radiologist:s.text(s.report.data&&s.report.data.radiologist);
};
s.shownSeverity=()=>{
  const list=Array.isArray(s.report.versions)?s.report.versions:[];
  return list.length?s.currentReportVersion().severity:s.text(s.report.data&&s.report.data.severity);
};
s.buildReport=(d,row,item)=>{
  const resultText=s.text(d&&d.result_text);
  const versions=Number(d&&d.result_versions)||0;
  return {
    test_name:s.text(d&&d.test_name)||(item&&item.name)||'',
    test_code:s.text(d&&d.test_code)||(item&&item.code)||'',
    modality:s.text(d&&d.modality&&(d.modality.label||d.modality.code))||s.text(d&&d.modality)||(item&&item.modality)||'',
    /* เพิ่ม 2026-09-15: ช่อง "เครื่อง" ใน dialog โชว์ตัวย่อ ชื่อเต็มไปอยู่ที่ title
       (กติกาเดียวกับตารางตั้งแต่ 2026-09-01) · report.data.modality เดิมยังอยู่ครบ */
    modality_code:s.text(d&&d.modality&&d.modality.code)||s.text(d&&d.modality)||(item&&item.modality)||'',
    modality_label:s.text(d&&d.modality&&(d.modality.label||d.modality.code))||s.text(d&&d.modality)||(item&&item.modality_label)||(item&&item.modality)||'',
    accession_no:s.text(d&&d.accession_no)||(item&&item.accession_no)||'',
    patient_hn:s.text(d&&d.patient_hn)||(row&&row.hn)||'',
    order_number:s.text(d&&d.order_number)||(row&&row.order_no)||'',
    performed_text:s.compactDateTime(d&&d.performed_at),
    reported_text:s.compactDateTime(d&&d.reported_at),
    result_text:resultText,
    /* RIS ส่งมาเป็น "รหัส" รังสีแพทย์ ยังไม่มีตาราง map เป็นชื่อ — แสดงรหัสตามจริง
       ห้ามเดาชื่อคนจากรหัส (คำถามข้อ 5 ที่ยังรอทีม RIS ตอบ) */
    radiologist:s.text(d&&d.radiologist_uid),
    severity:s.text(d&&d.severity_uid),
    versions:versions,
    /* endpoint ของ RIS insert ทุกครั้ง ⇒ มีได้หลายฉบับ ต้องบอกให้ผู้ใช้รู้ว่ากำลังดูฉบับล่าสุด */
    version_note:versions>1?('accession นี้มีผลอ่าน '+versions+' ฉบับ · แสดงฉบับล่าสุด'):'',
    /* สรุปบนแถบประวัติ — นับรังสีแพทย์แบบไม่ซ้ำ เพราะคนละฉบับอาจคนละคน */
    version_summary:s.versionSummary(d),
    /* Process เก่ายังไม่คืน versions[] แต่บอกจำนวนฉบับมา ⇒ ประวัติเปิดไม่ได้จริง
       ต้องบอกตรง ๆ ว่าติดอะไร ไม่ใช่ซ่อนปุ่มแล้วปล่อยให้งงว่าทำไมไม่มี */
    version_stale:(versions>1&&!(d&&Array.isArray(d.versions)&&d.versions.length))
      ?'Process worklist ที่ deploy อยู่ยังไม่คืน versions[] — เอาโค้ดล่าสุดของ xray_cpoe_worklist_api.js ไป replace body ก่อน จึงจะดูประวัติการแก้ได้ (ตอนนี้แสดงเฉพาะฉบับล่าสุด)'
      :'',
    has_report:!!resultText,
    pending_message:'ยังไม่มีผลอ่านของรายการนี้ · รอ RIS ส่งกลับมา'
  };
};
s.setReportVisible=v=>{s.report={...s.report,visible:!!v};};
/* ชื่อผู้รับรองผล — เก็บไว้ในหน้าจอเท่านั้น ยังไม่มีที่เก็บฝั่ง server
   ไม่ทำปุ่มบันทึกหลอกไว้ เพราะกดแล้วไม่เกิดอะไรจะแย่กว่าไม่มีปุ่ม */
s.setReportCertifier=v=>{s.report={...s.report,certified_by:s.text(v)};};
s.resetReport=()=>{s.report={visible:false,loading:false,order:null,item:null,data:{},certified_by:'',versions:[],selected:0,history_open:false,diff:true};};
s.openReport=async(row,item)=>{
  if(!item){field.notify('รายการนี้ยังไม่มีผลอ่าน','warning',2600);return;}
  /* เปิดใหม่ทุกครั้ง = เริ่มที่ฉบับล่าสุดและพับประวัติไว้ก่อน (พฤติกรรมเดิมของ dialog)
     ผู้ใช้กดปุ่มประวัติเองเมื่ออยากเทียบ — เปิดค้างไว้ข้ามรายการจะทำให้หลงว่าอยู่ฉบับไหน */
  s.report={visible:true,loading:true,order:row,item:item,data:s.buildReport({},row,item),certified_by:'',
    versions:[],selected:0,history_open:false,diff:true};
  if(!WORKLIST_PROCESS_ID){s.report={...s.report,loading:false};field.notify('ยังไม่ได้ตั้งค่า Process ID จึงอ่านผลไม่ได้','error',3600);return;}
  try{
    const p=await s.processCall(WORKLIST_PROCESS_ID,{action:'get_report',organization_code:s.unitCode(),order_id:s.text(row&&row.id),item_id:s.text(item&&item.id)});
    if(!p||p.success===false){s.report={...s.report,loading:false};field.notify((p&&p.message)||'อ่านผลไม่สำเร็จ','error',4000);return;}
    const payload=(p&&p.data)||{};
    s.report={...s.report,loading:false,data:s.buildReport(payload,row,item),
      versions:s.buildVersions(payload),selected:0};
  }catch(error){
    s.report={...s.report,loading:false};
    field.notify(s.text(error&&error.message)||'อ่านผลไม่สำเร็จ','error',4000);
  }
};

/* ── API connector ──────────────────────────────────────────────────────── */
s.extractProcess=out=>{const c=[out,out&&out.data,out&&out.data&&out.data.data,out&&out.reply&&out.reply.data];for(let i=0;i<c.length;i++){const x=c[i];if(x&&typeof x==='object'&&(typeof x.success==='boolean'||(x.data&&Array.isArray(x.data.orders))))return x;}return out||{};};
s.extractPayload=out=>{const p=s.extractProcess(out);const c=[p&&p.data,p,out&&out.data&&out.data.data,out&&out.data];for(let i=0;i<c.length;i++){if(c[i]&&Array.isArray(c[i].orders))return c[i];}return null;};
s.api=()=>field.globalUserState||((field.getFormRef&&field.getFormRef())||{}).userState;
s.processCall=(id,params)=>new Promise((resolve,reject)=>{
  const api=s.api();
  if(!api||typeof api.runProcess!=='function'){reject(new Error('ไม่พบ API Process connector'));return;}
  api.runProcess(id,params||{},out=>resolve(s.extractProcess(out)),error=>reject(error||new Error('เรียก API Process ไม่สำเร็จ')));
});
s.unitCode=()=>{const user=field.globalUserState&&field.globalUserState.user;return s.text(user&&user.unit&&user.unit.code).toUpperCase();};
s.params=(statuses,limit,page)=>{
  const p={action:'list',statuses:statuses,page:page||s.page.current,limit:limit||s.page.size,organization_code:s.unitCode()};
  /* ไม่ส่ง sort = พฤติกรรมเดิมทุกประการ · ใส่ก่อน early return ทุกอันเพื่อให้
     โหมดสแกนและโหมดเปิดจากคิวเรียงตามที่ผู้ใช้เลือกด้วย */
  if(s.sortKey&&s.sortKey!=='latest')p.sort=s.sortKey;
  /* โหมดสแกน = ดูผู้ป่วยรายนั้นทุกวันที่ · ส่ง hn หรือ citizen_id ตามชนิดที่สแกน
     ไม่ส่งคำค้นและช่วงวันที่; API จะไม่ใส่ช่วงวันที่ค่าเริ่มต้นให้เอง (Appendix B)
     ต้องตัดวันที่ทั้ง rows และ counts พร้อมกัน ไม่งั้น chip กับตารางจะไม่ตรงกันอีก */
  if(s.scanMode){
    if(s.scanType==='citizen_id')p.citizen_id=s.scannedCitizenId;
    else p.hn=s.scannedHn;
    if(Array.isArray(s.modality)&&s.modality.length)p.modality=s.modality.slice();
    return p;
  }
  /* เปิดจากคิว = กรองราย visit แบบ exact ฝั่ง API (เพิ่ม 2026-09-08)
     ไม่ส่ง = พฤติกรรมเดิมทุกประการ */
  if(s.focusVisitId){p.visit_id=s.focusVisitId;return p;}
  const q=s.text(s.filters.q);
  /* เลขบัตร 13 หลักในช่อง Search เป็น q เท่านั้น; ห้ามส่งเป็น hn จน API รุ่นเดิม
     exact-filter HN ก่อนถึงการค้นเลขบัตร ส่วนรหัสอื่นคง hint HN ของเดิม */
  if(q){p.q=q;if(!/^\\d{13}$/.test(q)&&q.indexOf(' ')<0&&/[0-9]/.test(q))p.hn=q;}
  /* API รับได้ทั้ง array และ CSV · ส่ง array ตรง ๆ เพื่อไม่ต้องกังวลเรื่อง escape */
  if(Array.isArray(s.modality)&&s.modality.length)p.modality=s.modality.slice();
  if(s.filters.dates&&s.filters.dates.length===2){p.date_from=s.filters.dates[0];p.date_to=s.filters.dates[1];}
  return p;
};
s.call=(params,ok,fail)=>{
  if(!WORKLIST_PROCESS_ID){fail(new Error('ยังไม่ได้ตั้งค่า Process ID ของ xray-cpoe-worklist'));return;}
  s.processCall(WORKLIST_PROCESS_ID,params).then(p=>{
    if(p&&p.success===false){fail(new Error(p.message||'API ปฏิเสธคำขอ'));return;}
    const payload=s.extractPayload(p);
    if(!payload){fail(new Error('รูปแบบ response ไม่ตรงกับ X-ray worklist contract'));return;}
    ok(payload,s.text(p&&p.message));
  }).catch(error=>fail(error||new Error('เรียก API ไม่สำเร็จ')));
};
/* counts ของ chip ทั้งห้า (รวมทั้งหมด) ต้องนับภายใต้ตัวกรองเครื่องปัจจุบัน (design §6.2)
   ถ้า API คืน data.counts มาแล้ว loadOrders จะใช้ค่านั้นและไม่ยิงซ้ำ */
s.refreshCounts=()=>{
  if(!WORKLIST_PROCESS_ID)return;
  const seq=++s.countSeq;
  s.statusFilters.forEach(filter=>{
    s.call(s.params(s.statusMap[filter.key],1,1),payload=>{
      if(seq!==s.countSeq)return;
      s.counts={...s.counts,[filter.key]:Number(payload.total||0)};
      s.recompute();
    },()=>{});
  });
};
s.applyCounts=payload=>{
  const c=payload&&payload.counts;
  if(!c||typeof c!=='object')return false;
  /* Process รุ่นเก่าคืน active ก้อนเดียว — อย่ารับเป็น split counts ปลอม ๆ;
     ให้ refreshCounts ยิงแยกด้วย raw statuses ซึ่ง API รุ่นเก่ายังรองรับอยู่ */
  if(c.waiting==null||c.pending==null)return false;
  s.counts={
    all:Number(c.all!=null?c.all:s.counts.all)||0,
    waiting:Number(c.waiting!=null?c.waiting:s.counts.waiting)||0,
    pending:Number(c.pending!=null?c.pending:s.counts.pending)||0,
    complete:Number(c.complete!=null?c.complete:s.counts.complete)||0,
    cancelled:Number(c.cancelled!=null?c.cancelled:s.counts.cancelled)||0
  };
  s.countSeq++;
  return true;
};
s.loadOrders=()=>{
  const seq=++s.loadSeq;
  const requestedQuery=s.text(s.filters.q).toLowerCase();
  s.loading=true;
  s.errorMessage='';
  s.selected={};
  s.recompute();
  s.call(s.params(s.statusMap[s.statusKey]),(payload,message)=>{
    if(seq!==s.loadSeq)return;
    s.serverMessage=message||'';
    s.unmapped=Number(payload.modality_unmapped||0);
    s.orders=Array.isArray(payload.orders)?payload.orders:[];
    s.loadedQuery=requestedQuery;
    /* เปิดจากคิวแล้วต้องเห็นรายการทันทีโดยไม่ต้องกดกางเอง (ผู้ใช้ขอ 2026-09-08:
       "แค่กาง order ให้ดู") · หลาย order ใน visit เดียวกางหมดทุกใบ */
    if(s.focusVisitId){
      const opened={};
      s.orders.forEach(order=>{const id=s.orderKey(order);if(id)opened[id]=true;});
      s.expanded=opened;
      if(!s.orders.length)field.notify('ไม่พบใบสั่ง X-ray ของ VN '+(s.focusVisitVn||'นี้')+' ในสถานะที่เลือก','warning',3600);
    }
    s.modalityMaster=Array.isArray(payload.modalities)?payload.modalities:[];
    s.mergeModalityPool(s.orders);
    s.applyCounts(payload);
    s.dateScope=(payload.date_scope&&typeof payload.date_scope==='object')?payload.date_scope:{from:'',to:'',defaulted:false};
    s.page={...s.page,current:Number(payload.page||s.page.current),size:Number(payload.limit||s.page.size),total:Number(payload.total||0)};
    s.loading=false;
    if(s.scanNoticePending){
      s.scanNoticePending=false;
      field.notify(s.orders.length?('พบรายการของ '+s.scanLabel+' '+s.scanDisplay):('ไม่พบรายการของ '+s.scanLabel+' '+s.scanDisplay+' ในสถานะนี้'),s.orders.length?'success':'warning',3500);
    }
    s.recompute();
  },error=>{
    if(seq!==s.loadSeq)return;
    s.orders=[];
    s.serverMessage='';
    s.unmapped=0;
    s.page={...s.page,total:0};
    s.errorMessage=s.text(error&&error.message)||'โหลดรายการไม่สำเร็จ';
    s.scanNoticePending=false;
    s.loading=false;
    s.recompute();
  });
};
s.handleUnitChange=()=>{
  const next=s.unitCode();
  if(next===s.currentUnitCode)return;
  s.currentUnitCode=next;
  s.expanded={};
  s.modalityPool=[];
  s.page={...s.page,current:1,total:0};
  s.loadOrders();
  s.refreshCounts();
};

s.recompute();`

widget.options.onMounted = `const s=this.vueState;
/* deep link จากแท็บคิว (เพิ่ม 2026-09-08) — tab ตั้ง lazy:true ตามแม่แบบ EMR
   แท็บนี้จึงอาจเพิ่งถูกสร้างตอนผู้ใช้กดปุ่ม X-ray ในคิว และ getFieldRef ฝั่งคิว
   ยังหา widget นี้ไม่เจอ ⇒ ปุ่มฝากเป้าหมายไว้ที่ form.$xrayQueueTarget
   (กลไกเดียวกับ form.$examTran ของฟอร์ม EMR) แล้วอ่านที่นี่ **ก่อน** โหลดครั้งแรก
   จะได้ยิง API รอบเดียวแบบกรองแล้ว ไม่ใช่โหลดทั้งหมดก่อนแล้วโหลดซ้ำ */
const host=(this.getFormRef&&this.getFormRef())||null;
const pending=host&&host.$xrayQueueTarget;
if(pending&&pending.visit_id){
  host.$xrayQueueTarget=null;
  s.focusVisitId=s.text(pending.visit_id);
  s.focusVisitVn=s.text(pending.vn);
  s.scanMode=false;s.scannedHn='';s.scanNoticePending=false;
  s.filters={...s.filters,q:'',dates:[]};
  s.expanded={};s.detailTabs={};s.selected={};
  s.page={...s.page,current:1};
  /* mount แล้วมาก่อนหน้านี้ = โหลดครั้งแรกผ่านไปแล้ว ต้องยิงใหม่เอง */
  if(s.__initialLoadStarted){s.loadOrders();s.refreshCounts();}
}
if(!s.__initialLoadStarted){
  s.__initialLoadStarted=true;
  s.currentUnitCode=s.unitCode();
  s.loadStaffOptions();
  s.loadOrders();
  s.refreshCounts();
}
if(!s.__unitWatch){
  s.__unitWatch=setInterval(()=>s.handleUnitChange(),1000);
}`

widget.options.onUnmount = `const s=this.vueState;
if(s.dismissCreateOrderNotice)s.dismissCreateOrderNotice();
if(s.__unitWatch){
  clearInterval(s.__unitWatch);
  s.__unitWatch=null;
}`


/* ── คิวห้องรังสี — แท็บ Unit Queue / My Room ────────────────────────────────
   เพิ่ม 2026-09-08 ตามคำสั่งผู้ใช้: "จากตอนแรก ถ้ามีการสั่ง → เข้าห้องเลย
   เปลี่ยนเป็นเข้าคิวก่อน" · โครงเลียนแบบฟอร์ม EMR (6a4f64e7f8cdfc54cec16488)
   ที่ผู้ใช้ชี้เป็นต้นแบบ: Unit Queue → My Room → (ปุ่ม) → หน้างานจริง

   🔴 แท็บ "X-ray" คือ widget เดิมทั้งก้อน **ไม่แก้อะไรข้างในเลย** — ที่เพิ่มมีแค่
      s.focusVisit()/s.clearFocusVisit() กับบล็อกอ่าน deep link ใน onMounted
      เส้นทางเดิม (เปิดฟอร์มแล้วใช้ตาราง/สแกน/กรอง) เดินได้เหมือนเดิมทุกประการ

   🔴 tab เป็น lazy mount (options.lazy = true ตามแม่แบบ EMR) ⇒ ตอนกดปุ่ม X-ray
      จากคิว widget worklist อาจยังไม่ถูกสร้าง getFieldRef จะคืน null
      จึงต้องฝากเป้าหมายไว้ที่ form.$xrayQueueTarget ให้ onMounted มาอ่านเอง
      (กลไกเดียวกับ form.$examTran ของ EMR ที่ใช้งานจริงอยู่แล้ว)

   โครง tab/tab-pane ก๊อปจาก EMR.json ซึ่ง SDFORM_JSON_RULES.md ระบุเป็นแม่แบบ
   ของ `tab` — เปลี่ยนเฉพาะค่าข้อมูล (name/label/id) ไม่แตะค่า presentation */
const XRAY_PANE_UNIT = 'xray_tab_unit'
const XRAY_PANE_ROOM = 'xray_tab_room'
const XRAY_PANE_DONE = 'xray_tab_done'
const XRAY_PANE_WORKLIST = 'xray_tab_worklist'
const XRAY_PANE_LAB_LOOKUP = 'xray_tab_lab_lookup'
const XRAY_TAB_NAME = 'xray_app'
/* ปุ่ม "ส่งต่อ" ยกมาจากฟอร์ม EMR ตามคำสั่งผู้ใช้ 2026-09-08 — ใช้ฟอร์มและ Process
   ตัวเดียวกับที่ EMR เรียกอยู่จริง ไม่ได้สร้างของใหม่ขึ้นมาซ้ำ
     · ฟอร์มย้ายคิว   6a4f828d22f95f21b606d9a2  (EMR list-ui visit_room ปุ่มที่ 3)
     · cpoe-order-dest 6a75820bb902d8cb04375f69  (เดาปลายทางจากใบสั่งยาที่รอห้องยา) */
const MOVE_FORM_ID = '6a4f828d22f95f21b606d9a2'
const ORDER_DEST_PROCESS_ID = '6a75820bb902d8cb04375f69'
const QUEUE_WIDGET_NAMES = { unit: 'xray_queue_unit', room: 'xray_queue_room', done: 'xray_queue_done' }

const clone = value => JSON.parse(JSON.stringify(value))

/* ห่อ widget ด้วย grid > grid-col ชุดเดียวกับที่ worklist ใช้อยู่แล้ว
   (ก๊อป container จากของจริงในไฟล์นี้ ไม่ประดิษฐ์โครงใหม่ ตามกฎข้อ ข) */
const wrapInGrid = (childWidget, slug) => {
  const wrapGrid = clone(grid)
  wrapGrid.options.name = slug + '_root'
  wrapGrid.id = 'grid-' + slug
  const wrapCol = clone(col)
  wrapCol.options.name = slug + '_col'
  wrapCol.id = 'grid-col-' + slug
  wrapCol.fields = [childWidget]
  wrapGrid.cols = [wrapCol]
  return wrapGrid
}

const QUEUE_WIDGET_LABELS = { unit: 'X-ray Unit Queue', room: 'X-ray My Room', done: 'X-ray Completed' }
const queueWidget = bucket => {
  const isUnit = bucket === 'unit'
  const slug = 'xray-queue-' + bucket
  const node = clone(widget)
  node.options.name = QUEUE_WIDGET_NAMES[bucket]
  node.options.label = QUEUE_WIDGET_LABELS[bucket]
  node.id = 'vue-ui-' + slug
  node.options.content = `<div class="xray-queue">
  <div class="xq-bar">
    <div class="xq-heading">
      <span class="xq-title">{{ title }}</span>
      <span class="xq-total">{{ total }} คิว</span>
    </div>
    <el-button size="small" :loading="loading" @click="reload">รีเฟรช</el-button>
  </div>

  <div v-if="errorMessage" class="xq-error" role="alert">{{ errorMessage }}</div>

  <div v-else-if="!loading && !rows.length" class="xq-empty">{{ emptyText }}</div>

  <div v-else class="xq-list" v-loading="loading">
    <div v-for="(row,index) in rows" :key="row.visit_id" class="xq-row">
      <div class="xq-seq" :class="{'is-label':!!row.queue_label}" :title="seqHint(row)">{{ seqText(row, index) }}</div>
      <div class="xq-who">
        <div class="xq-nameline">
          <span class="xq-name">{{ row.patient_name || '(ไม่มีชื่อในระบบ)' }}</span>
          <span class="xq-state" :class="stateClass">{{ stateLabel }}</span>
        </div>
        <div class="xq-meta">
          <span class="xr-mono">HN {{ row.hn || '-' }}</span>
          <span class="xr-mono">VN {{ row.vn || '-' }}</span>
          <span v-if="row.gender_text">{{ row.gender_text }}</span>
          <span v-if="row.age !== ''">{{ row.age }} ปี</span>
        </div>
      </div>
      <div class="xq-when">
        <div class="xq-wait">&#9201; {{ waitText(row) }}</div>
        <div class="xq-sub">{{ stampText(row) }}</div>
      </div>
      <div class="xq-load">
        <strong>{{ row.item_count }}</strong> รายการ
        <span class="xq-sub">{{ row.order_count }} ใบสั่ง</span>
      </div>
      <div class="xq-act">
        <el-button v-if="isUnit" type="primary" plain size="small"
          :loading="!!calling[row.visit_id]" @click="callVisit(row)">เรียก/รับเข้าห้อง</el-button>
        <template v-else>
          <el-button type="primary" plain size="small" @click="goXray(row)">X-ray</el-button>
          <el-button v-if="isRoom" type="success" plain size="small"
            :disabled="!row.tran_id" :title="forwardHint(row)"
            @click="forwardVisit(row)">ส่งต่อ</el-button>
        </template>
      </div>
    </div>
  </div>

  <div v-if="!loading && total > rows.length" class="xq-more">
    แสดง {{ rows.length }} จาก {{ total }} คิว — กดรีเฟรชหลังเคลียร์คิวด้านบนเพื่อดูส่วนที่เหลือ
  </div>
</div>`

  node.options.onCreated = `const field=this;
const s=this.vueState;
const WORKLIST_PROCESS_ID='${worklistProcessId}';
const BUCKET='${bucket}';
const XRAY_PANE='${XRAY_PANE_WORKLIST}';
const TAB_NAME='${XRAY_TAB_NAME}';
const SIBLINGS=${JSON.stringify(Object.keys(QUEUE_WIDGET_NAMES).filter(key => key !== bucket).map(key => QUEUE_WIDGET_NAMES[key]))};
const MOVE_FORM_ID='${MOVE_FORM_ID}';
const ORDER_DEST_PROCESS_ID='${ORDER_DEST_PROCESS_ID}';

s.isUnit=BUCKET==='unit';
s.isRoom=BUCKET==='room';
s.isDone=BUCKET==='done';
s.title=s.isUnit?'คิวรอเรียกเข้าห้อง':(s.isRoom?'คิวในห้อง (เรียกแล้ว)':'คิวที่สำเร็จ / ส่งต่อแล้ว');
s.emptyText=s.isUnit?'ไม่มีคิวในวันนี้':(s.isRoom?'ยังไม่มีคิวที่เรียกเข้าห้อง':'ยังไม่มีคิวที่ปิดวันนี้');
s.rows=[];
s.total=0;
s.loading=false;
s.errorMessage='';
s.calling={};
s.loadSeq=0;

s.text=v=>{
  if(v==null)return '';
  if(typeof v==='string')return v;
  if(typeof v==='number'||typeof v==='boolean')return String(v);
  if(typeof v==='object')return s.text(v.label!=null?v.label:(v.value!=null?v.value:''));
  return String(v);
};
s.api=()=>field.globalUserState||((field.getFormRef&&field.getFormRef())||{}).userState;
s.extractProcess=out=>{
  const c=[out,out&&out.data,out&&out.data&&out.data.data,out&&out.reply&&out.reply.data];
  for(let i=0;i<c.length;i++){const x=c[i];if(x&&typeof x==='object'&&typeof x.success==='boolean')return x;}
  return out||{};
};
s.processCall=(id,params)=>new Promise((resolve,reject)=>{
  const api=s.api();
  if(!api||typeof api.runProcess!=='function'){reject(new Error('ไม่พบ API Process connector'));return;}
  api.runProcess(id,params||{},out=>resolve(s.extractProcess(out)),error=>reject(error||new Error('เรียก API Process ไม่สำเร็จ')));
});
s.unitCode=()=>{const user=field.globalUserState&&field.globalUserState.user;return s.text(user&&user.unit&&user.unit.code).toUpperCase();};

/* เวลารอ — คิดจากเวลาสั่ง (Unit Queue) หรือเวลาเรียกเข้าห้อง (My Room)
   ใช้ตัวแปลงวันที่แบบเดียวกับ worklist (new Date + replace ' ' เป็น 'T'))
   ฟอร์มนี้ไม่มี dayjs ให้เรียก จึงห้ามอ้างถึง */
s.toDate=v=>{if(!v)return null;const d=new Date(String(v).replace(' ','T'));return Number.isNaN(d.getTime())?null:d;};
s.minutesSince=v=>{
  const d=s.toDate(v);
  if(!d)return null;
  const diff=Math.floor((Date.now()-d.getTime())/60000);
  return diff>=0?diff:0;
};
/* เลขคิวจริงมี prefix อยู่ข้างหน้า (เช่น D002) — ผู้ใช้ทักท้วง 2026-09-08
   มาจาก visit_tran ผ่าน API · ไม่มีแถวคิวก็ตกกลับไปใช้ลำดับในรายการเหมือนเดิม
   จะได้ไม่มีช่องว่างให้เจ้าหน้าที่อ่านไม่ออกว่าใครมาก่อนหลัง */
/* ป้ายสถานะของคิว — ผู้ใช้ขอ 2026-09-08: "หน้า myroom ต้องมี status ว่ารับแล้ว
   เหมือนกับ flow emr" · เป็นสถานะของ **คิว** ไม่ใช่สถานะของใบสั่ง
   (ใบสั่งมีป้ายของตัวเองอยู่แล้วในตาราง X-ray ห้ามเอามาปนกัน) */
s.stateLabel=s.isDone?'ส่งต่อแล้ว':(s.isRoom?'รับแล้ว':'รอเรียก');
s.stateClass=s.isDone?'is-done':(s.isRoom?'is-room':'is-wait');
s.seqText=(row,index)=>s.text(row&&row.queue_label)||String(index+1);
s.seqHint=row=>(row&&row.queue_label)
  ?'เลขคิวจากระบบคิวผู้ป่วย'
  :'ยังไม่มีเลขคิวใน visit_tran — แสดงลำดับในรายการแทน';
s.humanMinutes=mins=>{
  if(mins==null)return '--:--';
  const h=Math.floor(mins/60);
  return h>0?(h+' ชม. '+(mins%60)+' น.'):(mins+' นาที');
};
s.waitText=row=>{
  /* ปิดคิวแล้วไม่มี "เวลารอ" อีก — ที่มีความหมายคือ "อยู่ในห้องนานเท่าไหร่" */
  if(s.isDone){
    const from=s.toDate(row&&row.called_at),to=s.toDate(row&&row.done_at);
    if(!from||!to)return '--:--';
    return s.humanMinutes(Math.max(0,Math.floor((to-from)/60000)));
  }
  return s.humanMinutes(s.minutesSince(s.isUnit?(row&&row.requested_at):(row&&row.called_at)));
};
s.stampText=row=>{
  const raw=s.isUnit?s.text(row&&row.requested_at):(s.isRoom?s.text(row&&row.called_at):s.text(row&&row.done_at));
  const label=s.isUnit?'สั่ง ':(s.isRoom?'เรียก ':'ปิดคิว ');
  return raw?(label+raw.slice(11,16)):'';
};

s.load=()=>{
  const seq=++s.loadSeq;
  s.loading=true;
  s.errorMessage='';
  s.processCall(WORKLIST_PROCESS_ID,{action:'queue',bucket:BUCKET,organization_code:s.unitCode(),limit:50}).then(p=>{
    if(seq!==s.loadSeq)return;
    if(p&&p.success===false){s.rows=[];s.total=0;s.errorMessage=s.text(p.message)||'อ่านคิวไม่สำเร็จ';s.loading=false;return;}
    const d=(p&&p.data)||{};
    s.rows=Array.isArray(d.rows)?d.rows:[];
    s.total=Number(d.total)||s.rows.length;
    s.loading=false;
  }).catch(error=>{
    if(seq!==s.loadSeq)return;
    s.rows=[];s.total=0;
    s.errorMessage=s.text(error&&error.message)||'อ่านคิวไม่สำเร็จ';
    s.loading=false;
  });
};
s.reload=()=>s.load();
/* คิวย้ายถังแล้วแถวต้องหายจากที่นี่และไปโผล่อีกแท็บ ⇒ รีเฟรชแท็บที่เหลือทั้งหมด
   ไม่ให้ผู้ใช้เห็นคิวค้างอยู่สองที่พร้อมกัน (แท็บที่ยังไม่ mount จะข้ามไปเอง) */
s.reloadSibling=()=>{
  const form=field.getFormRef&&field.getFormRef();
  if(!form||typeof form.getFieldRef!=='function')return;
  SIBLINGS.forEach(name=>{
    const other=form.getFieldRef(name);
    if(other&&other.vueState&&typeof other.vueState.load==='function')other.vueState.load();
  });
};

s.callVisit=row=>{
  const id=s.text(row&&row.visit_id);
  if(!id){field.notify('คิวนี้ไม่มี Visit ID','warning',3000);return;}
  if(s.calling[id])return;
  s.calling={...s.calling,[id]:true};
  s.processCall(WORKLIST_PROCESS_ID,{action:'queue_call',organization_code:s.unitCode(),visit_id:id}).then(p=>{
    s.calling={...s.calling,[id]:false};
    if(p&&p.success===false){field.notify(s.text(p.message)||'เรียกคิวไม่สำเร็จ','error',4200);return;}
    const already=!!(p&&p.data&&p.data.already_called);
    field.notify(already?'คิวนี้ถูกเรียกเข้าห้องอยู่แล้ว':'เรียกคิวเข้าห้องแล้ว',already?'info':'success',2600);
    s.load();
    s.reloadSibling();
  }).catch(error=>{
    s.calling={...s.calling,[id]:false};
    field.notify(s.text(error&&error.message)||'เรียกคิวไม่สำเร็จ','error',4200);
  });
};

/* กดแล้ว "แค่กาง order ให้ดู" — ไม่แตะสถานะคิวและไม่แตะ current_status
   (ผู้ใช้ยืนยัน 2026-09-08 ว่าต่างจากปุ่ม EMR ที่ stamp เริ่มตรวจ) */
s.goXray=row=>{
  const form=field.getFormRef&&field.getFormRef();
  const visitId=s.text(row&&row.visit_id);
  if(!visitId){field.notify('คิวนี้ไม่มี Visit ID','warning',3000);return;}
  if(!form){field.notify('ไม่พบฟอร์มสำหรับเปิดหน้า X-ray','error',3000);return;}
  const target={visit_id:visitId,vn:s.text(row&&row.vn),hn:s.text(row&&row.hn)};
  form.$xrayQueueTarget=target;
  const w=form.getFieldRef&&form.getFieldRef('xray_cpoe_worklist');
  if(w&&w.vueState&&typeof w.vueState.focusVisit==='function')w.vueState.focusVisit(target);
  const tab=form.getFieldRef&&form.getFieldRef(TAB_NAME);
  if(tab)tab.activeTabName=XRAY_PANE;
};

/* ── ส่งต่อ (ยกมาจากปุ่ม "ส่งต่อ" ของฟอร์ม EMR · ผู้ใช้สั่ง 2026-09-08) ──────
   ลำดับ prefill ปลายทางเหมือน EMR ทุกประการ:
     consult (หมอเจาะจงปลายทางไว้) > ใบสั่งยาที่รอห้องยา > ไม่ prefill
   🔴 ห้ามใช้ await — เป็น sync handler เหมือนต้นฉบับ ⇒ ใช้ callback ของ runProcess
   🔴 หาปลายทางไม่ได้/ล้ม = เปิดฟอร์มตามปกติ ห้ามบล็อกเจ้าหน้าที่
      (เป็นตัวช่วยกรอก ไม่ใช่ด่าน — เหตุผลเดียวกับที่เขียนไว้ในฟอร์ม EMR)
   ต่างจาก EMR ตรงเดียว: บันทึกเสร็จแล้วปิดคิวฝั่ง X-ray ด้วย เพื่อให้แถวย้ายไป
   แท็บ Completed — EMR ไม่ต้องทำเพราะมันอ่าน vtran_status ตรง ๆ อยู่แล้ว */
s.forwardHint=row=>(row&&row.tran_id)
  ?'ส่งต่อคนไข้ไปหน่วยอื่น แล้วปิดคิวรังสีนี้'
  :'คิวนี้ไม่มีรายการใน visit_tran จึงส่งต่อไม่ได้ — ต้องตั้งค่า routing ของหน่วยรังสีก่อน';
s.closeQueue=row=>{
  const id=s.text(row&&row.visit_id);
  if(!id)return;
  s.processCall(WORKLIST_PROCESS_ID,{action:'queue_done',organization_code:s.unitCode(),visit_id:id}).then(p=>{
    if(p&&p.success===false){field.notify(s.text(p.message)||'ส่งต่อแล้วแต่ปิดคิวไม่สำเร็จ','warning',5200);}
    else field.notify('ส่งต่อแล้ว · ปิดคิวเรียบร้อย','success',2800);
    s.load();
    s.reloadSibling();
  }).catch(error=>{
    field.notify(s.text(error&&error.message)||'ส่งต่อแล้วแต่ปิดคิวไม่สำเร็จ','error',5200);
    s.load();
    s.reloadSibling();
  });
};
s.forwardVisit=row=>{
  const form=field.getFormRef&&field.getFormRef();
  const tranId=s.text(row&&row.tran_id);
  if(!tranId){field.notify(s.forwardHint(row),'warning',5200);return;}
  if(!form||typeof form.openForm!=='function'){field.notify('ไม่พบตัวเปิดฟอร์มส่งต่อ','error',3000);return;}
  const ci=(row&&row.consult_info)||null;
  const curUnit=s.text(row&&row.unit_to&&row.unit_to.value);
  const ctx={
    tran_id:tranId,
    cur_unit:curUnit,
    visit_priority:s.text(row&&row.visit_priority)||'10',
    tran_note:'',
    consult_id:''
  };
  const refresh=()=>{s.load();s.reloadSibling();};
  const openMove=()=>form.openForm(MOVE_FORM_ID,'','',ctx,{
    params:ctx,
    afterSaveCallback:()=>{
      if(typeof form.subFormClose==='function')form.subFormClose();
      s.closeQueue(row);
    },
    cancelCallback:()=>{
      if(typeof form.subFormClose==='function')form.subFormClose();
      refresh();
    }
  });
  if(ci&&ci.clinic&&String(ci.clinic)!==String(curUnit)){
    ctx.unit_to={value:ci.clinic,label:ci.to_label||ci.clinic};
    ctx.tran_note=ci.reason||'';
    ctx.visit_priority=ci.priority||ctx.visit_priority;
    ctx.consult_id=ci.consult_id||'';
    openMove();
    return;
  }
  if(ci&&ci.reply&&String(ci.clinic)===String(curUnit)&&row.unit_from&&row.unit_from.value){
    ctx.unit_to={value:row.unit_from.value,label:row.unit_from.label||row.unit_from.value};
    openMove();
    return;
  }
  const api=s.api();
  if(!api||typeof api.runProcess!=='function'){openMove();return;}
  api.runProcess(ORDER_DEST_PROCESS_ID,{tran_id:tranId},out=>{
    const p=s.extractProcess(out);
    const d=(p&&p.data)||(out&&out.data)||{};
    if(d.found&&d.unit&&d.unit.value){
      ctx.unit_to=d.unit;
      ctx.tran_note=d.order_count>1?('ใบสั่งยา '+d.order_number+' (มี '+d.order_count+' ใบรอห้องยา)'):'';
    }
    openMove();
  },()=>openMove());
};`

  node.options.onMounted = `const s=this.vueState;
if(!s.__started){s.__started=true;s.load();}`
  node.options.onUnmount = ''
  return wrapInGrid(node, slug)
}

/* ── สืบค้นผล LAB ข้ามทุกห้อง — clone UI ของ LAB จริง + read-only lock ───────
   ผู้ใช้ยืนยัน 2026-09-27 ว่าไม่ต้องการ X-ray lookup ที่เพียง “หน้าตาคล้าย” LAB:
   ต้องใช้ UI/interaction ของส่วนสืบค้นผลแลปใน LAB Worklist จริง ทั้ง toolbar,
   list, expanded detail, pagination และ result dialog โดยอยู่ใน top tab ของ X-ray
   เหมือนเดิมและไม่พา workflow LAB ส่วนอื่นเข้ามา

   วิธีนี้ clone generated LAB widget ตรง ๆ แล้วเอาเฉพาะแถบสลับ view ใหญ่ออก เพราะ
   top tab `สืบค้นผลแลป` ของ X-ray ทำหน้าที่เลือก view ให้อยู่แล้ว จากนั้น lock state
   ไว้ที่ lookup และ allowlist Process เฉพาะ read actions เท่านั้น */
const labLookupContent = source => {
  let content = String(source || '')
  const viewTabsStart = content.indexOf('    <div class="lab-view-tabs"')
  const lookupStripStart = content.indexOf('    <div v-if="viewMode===\'today\'" class="lab-status-strip"')
  if (viewTabsStart < 0 || lookupStripStart < 0 || lookupStripStart <= viewTabsStart) {
    throw new Error('LAB lookup view markers not found in the generated LAB widget')
  }
  content = content.slice(0, viewTabsStart) + content.slice(lookupStripStart)
  if (!content.includes('<div class="lab-cpoe">')) {
    throw new Error('LAB lookup root not found in the generated LAB widget')
  }
  return content.replace('<div class="lab-cpoe">', '<div class="lab-cpoe xray-lab-lookup">')
}

const labLookupWidget = () => {
  const node = clone(labLookupTemplate)
  node.options.name = 'xray_lab_lookup'
  node.options.label = 'สืบค้นผลแลป'
  node.id = 'vue-ui-xray-lab-lookup'
  node.options.content = labLookupContent(labLookupTemplate.options.content)
  node.options.onCreated = `${labLookupTemplate.options.onCreated}

/* X-ray owns only the read-only LAB lookup surface.  Keep the LAB rendering and
   sensitive-result flow intact, but make every LAB Process call fail closed unless
   it is one of the three reads required by this screen. */
s.viewMode='lookup';
s.lookupMode='results';
s.lookupSearched=false;
s.lookupCounts={results:0,orders:0};
s.lookupFilters={hn:'',dates:[]};
s.filters={...s.lookupFilters};
s.orders=[];
s.expanded={};
s.detailTabs={};
s.selected={};
s.page={...s.page,current:1,total:0};
const xrayLabReadActions=['','list','get_manual_result','authorize_sensitive_result'];
const xrayLabBaseProcessCall=s.processCall;
s.processCall=(id,params)=>{
  const action=s.text(params&&params.action).toLowerCase();
  if(id!==PROCESS_ID||!xrayLabReadActions.includes(action)){
    return Promise.reject(new Error('แท็บ X-ray สืบค้นผล LAB เป็นแบบอ่านอย่างเดียว'));
  }
  const next={...(params||{})};
  if(action==='get_manual_result'||action==='authorize_sensitive_result'){
    next.cross_section=true;
    next.lookup_mode='results';
  }
  return xrayLabBaseProcessCall(id,next);
};
s.setViewMode=mode=>{
  if(mode!=='lookup')field.notify('แท็บนี้ใช้สำหรับสืบค้นผล LAB แบบอ่านอย่างเดียว','warning',3000);
};`
  node.options.onMounted = labLookupTemplate.options.onMounted
  node.options.onUnmount = labLookupTemplate.options.onUnmount
  return wrapInGrid(node, 'xray-lab-lookup')
}

const tabRoot = {
  key: 85929,
  name: 'Tab',
  component: 'tab',
  category: 'container',
  icon: 'tab',
  fieldType: 'None',
  fieldLength: null,
  children: false,
  enable: true,
  tabs: [
    {
      key: 65026,
      name: 'Tab Pane',
      component: 'tab-pane',
      category: 'container',
      icon: 'tab-pane',
      fieldType: 'None',
      fieldLength: null,
      children: true,
      enable: true,
      fields: [queueWidget('unit')],
      options: {
        name: XRAY_PANE_UNIT,
        label: 'Unit Queue',
        hidden: false,
        active: false,
        disabled: false,
        customClass: '',
        icon: 'el-guide'
      },
      id: 'tab-pane-xray-unit'
    },
    {
      key: 65026,
      name: 'Tab Pane',
      component: 'tab-pane',
      category: 'container',
      icon: 'tab-pane',
      fieldType: 'None',
      fieldLength: null,
      children: true,
      enable: true,
      fields: [queueWidget('room')],
      options: {
        name: XRAY_PANE_ROOM,
        label: 'My Room',
        hidden: false,
        active: false,
        disabled: false,
        customClass: '',
        icon: 'el-message-box'
      },
      id: 'tab-pane-xray-room'
    },
    {
      key: 65026,
      name: 'Tab Pane',
      component: 'tab-pane',
      category: 'container',
      icon: 'tab-pane',
      fieldType: 'None',
      fieldLength: null,
      children: true,
      enable: true,
      /* แท็บนี้ถือ grid เดิมของ worklist ทั้งก้อน ไม่ได้สร้างใหม่ */
      fields: [grid],
      options: {
        name: XRAY_PANE_WORKLIST,
        label: 'X-ray',
        hidden: false,
        /* เปิดฟอร์มมาแล้วเห็นตารางเดิมก่อนเหมือนที่เคยเป็น — คิวเป็นของที่เพิ่มเข้ามา
           ไม่ใช่ของที่มาแทนที่ (ผู้ใช้สั่งให้ของเดิมทำงานเหมือนเดิม) */
        active: true,
        disabled: false,
        customClass: '',
        icon: 'addon-heart-pulse-fill'
      },
      id: 'tab-pane-xray-worklist'
    },
    {
      key: 65026,
      name: 'Tab Pane',
      component: 'tab-pane',
      category: 'container',
      icon: 'tab-pane',
      fieldType: 'None',
      fieldLength: null,
      children: true,
      enable: true,
      fields: [queueWidget('done')],
      options: {
        /* "สำเร็จ / ส่งต่อคิว" — คนละความหมายกับ chip "ออกผลครบ" ของตาราง X-ray
           (ผู้ใช้ย้ำ 2026-09-08) อันนั้นคือผลอ่านครบ อันนี้คือคิวจบแล้ว */
        name: XRAY_PANE_DONE,
        label: 'Completed',
        hidden: false,
        active: false,
        disabled: false,
        customClass: '',
        icon: 'el-circle-check'
      },
      id: 'tab-pane-xray-done'
    },
    /* ── สืบค้นผลแลป — ย้ายมาไว้ท้ายสุด 2026-09-27 ตามคำสั่งผู้ใช้ ───────────────
       ("tab สืบค้นผลแลปของ xray ... ตอนนี้มันเป็น tab รวมใหญ่ มันคนละหน้าที่
         tab ใหญ่คือสำหรับคิว" → "แค่ย้าย tab สืบค้นผลแลปไปอยู่สุดท้าย")
       เหตุผล: สี่แท็บแรกเป็นเรื่องคิว/ใบสั่งของห้องรังสี ส่วนแท็บนี้เป็นการสืบค้น
       ผล LAB ข้ามห้องแบบอ่านอย่างเดียว คนละหน้าที่กัน จึงไม่ควรแทรกกลางกลุ่มคิว
       🔴 ย้ายแค่ลำดับใน tabs[] เท่านั้น — ไม่แตะ options/id/โครงของ pane ใด
          และไม่ได้ทำ tab ซ้อนชั้น เพราะทั้งรีโป 129 ฟอร์มไม่มีแม่แบบ tab ซ้อน
          (SDFORM_JSON_RULES.md ห้ามประกอบโครงขึ้นเอง · เคย render ว่างมาแล้ว) */
    {
      key: 65026,
      name: 'Tab Pane',
      component: 'tab-pane',
      category: 'container',
      icon: 'tab-pane',
      fieldType: 'None',
      fieldLength: null,
      children: true,
      enable: true,
      fields: [labLookupWidget()],
      options: {
        name: XRAY_PANE_LAB_LOOKUP,
        label: 'สืบค้นผลแลป',
        hidden: false,
        active: false,
        disabled: false,
        customClass: '',
        icon: 'el-search'
      },
      id: 'tab-pane-xray-lab-lookup'
    }
  ],
  options: {
    name: XRAY_TAB_NAME,
    hidden: false,
    displayType: 'card',
    tabPosition: 'top',
    lazy: true,
    customClass: ''
  },
  id: 'tab-xray-app'
}

form.fields = [tabRoot, scanField, localAgentField]

/* กันค่าหลุดคนละตัว — ถ้าวันหนึ่งมีคนแก้ Process ID ในโค้ดของตาราง แต่ลืมแก้ของคิว
   ปุ่มเรียกคิวจะเงียบไปโดยไม่มีใครรู้ · ให้ generator ล้มตั้งแต่ตอน build แทน */
if (!widget.options.onCreated.includes("const WORKLIST_PROCESS_ID='" + worklistProcessId + "'")) {
  throw new Error('worklistProcessId ไม่ตรงกับ Process ID ที่ฝังอยู่ใน onCreated ของตาราง worklist')
}

/* CSS ของแท็บคิว — ต่อท้ายอย่างเดียว ไม่แตะสไตล์เดิมของตาราง (.xray-cpoe) แม้แต่บรรทัดเดียว */
form.formConfig.cssCode += `
.xray-queue{--xq-ink:var(--el-text-color-primary,#303133);--xq-text:var(--el-text-color-regular,#606266);--xq-muted:var(--el-text-color-secondary,#909399);--xq-border:var(--el-border-color-light,#e4e7ed);--xq-fill:var(--el-fill-color-light,#f5f7fa);--xq-white:var(--el-bg-color,#fff);width:100%;padding:4px 0 28px;color:var(--xq-text);font-family:"Leelawadee UI","Noto Sans Thai",Tahoma,"Segoe UI",sans-serif;font-size:13px;line-height:1.4}
.xray-queue *{box-sizing:border-box}
.xray-queue .xq-bar{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.xray-queue .xq-heading{display:flex;align-items:baseline;gap:10px;min-width:0}
.xray-queue .xq-title{font-size:15px;font-weight:700;color:var(--xq-ink)}
.xray-queue .xq-total{font-size:12px;color:var(--xq-muted)}
.xray-queue .xq-error{padding:10px 12px;border:1px solid var(--el-color-danger-light-7,#fab6b6);background:var(--el-color-danger-light-9,#fef0f0);color:var(--el-color-danger,#f56c6c);border-radius:6px}
.xray-queue .xq-empty{padding:28px 12px;text-align:center;color:var(--xq-muted);background:var(--xq-fill);border:1px dashed var(--xq-border);border-radius:6px}
.xray-queue .xq-list{display:flex;flex-direction:column;gap:6px}
.xray-queue .xq-row{display:grid;grid-template-columns:62px minmax(180px,2fr) minmax(110px,1fr) minmax(96px,auto) max-content;align-items:center;gap:12px;padding:10px 12px;background:var(--xq-white);border:1px solid var(--xq-border);border-radius:6px}
.xray-queue .xq-row>*{min-width:0}
.xray-queue .xq-seq{font-size:18px;font-weight:800;color:var(--xq-ink);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.xray-queue .xq-seq.is-label{font-family:"SFMono-Regular","Roboto Mono",Consolas,monospace;font-size:14px;letter-spacing:.02em}
.xray-queue .xq-nameline{display:flex;align-items:center;gap:8px;min-width:0}
.xray-queue .xq-name{flex:1 1 auto;min-width:0;font-weight:700;color:var(--xq-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.xray-queue .xq-state{flex:none;display:inline-flex;min-height:20px;align-items:center;padding:1px 8px;border:1px solid;border-radius:999px;font-size:10px;font-weight:650;white-space:nowrap}
.xray-queue .xq-state.is-wait{border-color:#f3d19e;background:#fdf6ec;color:#b88230}
.xray-queue .xq-state.is-room{border-color:#b3e19d;background:#f0f9eb;color:#529b2e}
.xray-queue .xq-state.is-done{border-color:#c8c9cc;background:#f4f4f5;color:#73767a}
.xray-queue .xq-meta{display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:var(--xq-muted)}
.xray-queue .xq-wait{font-size:12px;color:var(--xq-ink);white-space:nowrap}
.xray-queue .xq-sub{font-size:11px;color:var(--xq-muted);white-space:nowrap}
.xray-queue .xq-load{font-size:12px;white-space:nowrap}
.xray-queue .xq-act{text-align:right}
.xray-queue .xq-more{margin-top:10px;font-size:11px;color:var(--xq-muted);text-align:center}
.xray-queue .xr-mono{font-family:"SFMono-Regular","Roboto Mono",Consolas,monospace}
@media (max-width:900px){.xray-queue .xq-row{grid-template-columns:54px 1fr max-content;row-gap:6px}.xray-queue .xq-when,.xray-queue .xq-load{grid-column:2}}
`

/* Legacy `.xll-*` stylesheet from the rejected custom X-ray lookup.  Keep the
   source snapshot here for provenance, but never append it to the generated Form. */
const legacyXllCss = `
.xray-lab-lookup{--xll-ink:var(--el-text-color-primary,#303133);--xll-text:var(--el-text-color-regular,#606266);--xll-muted:var(--el-text-color-secondary,#909399);--xll-border:var(--el-border-color-light,#e4e7ed);--xll-fill:var(--el-fill-color-light,#f5f7fa);--xll-white:var(--el-bg-color,#fff);width:100%;padding:4px 0 30px;color:var(--xll-text);font-family:"Leelawadee UI","Noto Sans Thai",Tahoma,"Segoe UI",sans-serif;font-size:13px;line-height:1.4}
.xray-lab-lookup *{box-sizing:border-box}.xll-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}.xll-toolbar .xll-search{width:290px!important;flex:0 0 290px}.xll-toolbar .xll-date{width:220px!important;flex:0 0 220px}.xll-mode-strip{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}.xll-mode-strip>button{display:inline-flex;min-height:34px;align-items:center;gap:8px;padding:6px 11px;border:1px solid var(--xll-border);border-radius:6px;background:var(--xll-fill);color:var(--xll-text);font:inherit;cursor:pointer}.xll-mode-strip>button strong{display:grid;min-width:22px;height:20px;place-items:center;padding:0 5px;border-radius:999px;background:var(--xll-white);color:var(--xll-muted);font-size:10px}.xll-mode-strip>button.is-active{border-color:var(--el-color-primary,#409eff);background:var(--el-color-primary-light-9,#ecf5ff);color:var(--el-color-primary,#409eff)}.xll-mode-strip>button.is-active strong{color:var(--el-color-primary,#409eff)}.xll-mode-strip>small{margin-left:auto;color:var(--xll-muted);font-size:11px}.xll-summary{margin:0 0 8px;color:var(--xll-muted);font-size:12px}.xll-summary.is-error{color:var(--el-color-danger,#f56c6c)}.xll-empty{display:grid;min-height:180px;place-content:center;gap:6px;padding:20px;border:1px dashed var(--xll-border);background:var(--xll-fill);text-align:center}.xll-empty strong{color:var(--xll-ink);font-size:14px}.xll-empty span{color:var(--xll-muted);font-size:12px}
.xll-shell{border-top:1px solid var(--xll-border);border-bottom:1px solid var(--xll-border);overflow-x:auto}.xll-head,.xll-row{display:grid;grid-template-columns:32px minmax(190px,1.45fr) minmax(130px,1fr) 70px minmax(130px,1fr) 88px minmax(150px,1.1fr) 110px;gap:9px;align-items:center;min-width:1040px;padding:8px 10px}.xll-head{border-bottom:1px solid var(--xll-border);color:var(--xll-muted);font-size:11px;font-weight:650}.xll-order{border-bottom:1px solid var(--el-border-color-lighter,#ebeef5)}.xll-order:last-child{border-bottom:0}.xll-row{min-height:72px;background:var(--xll-white);cursor:pointer}.xll-row:hover,.xll-order.is-open>.xll-row{background:var(--xll-fill)}.xll-expand{display:grid;width:28px;height:30px;place-items:center;padding:0;border:0;border-radius:4px;background:transparent;color:var(--xll-muted);cursor:pointer}.xll-expand svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;transition:transform .16s}.xll-order.is-open .xll-expand svg{transform:rotate(90deg)}.xll-patient,.xll-order-meta{display:grid;gap:2px;min-width:0}.xll-patient>span{overflow:hidden;color:var(--xll-ink);font-weight:650;text-overflow:ellipsis;white-space:nowrap}.xll-patient small,.xll-order-meta small{color:var(--xll-muted);font-size:11px}.xll-context,.xll-sections{display:flex;gap:5px;flex-wrap:wrap}.xll-pill,.xll-section,.xll-status{display:inline-flex;min-height:21px;align-items:center;padding:1px 7px;border:1px solid var(--xll-border);border-radius:5px;background:var(--xll-white);font-size:10px;font-weight:650}.xll-section{border-color:var(--el-color-primary-light-5,#a0cfff);background:var(--el-color-primary-light-9,#ecf5ff);color:var(--el-color-primary,#409eff);font-family:"SFMono-Regular","Roboto Mono",Consolas,monospace}.xll-order-no{width:max-content;max-width:100%;padding:1px 6px;border-radius:4px;background:var(--el-fill-color,#f0f2f5);color:var(--xll-ink);font-family:"SFMono-Regular","Roboto Mono",Consolas,monospace;font-size:11px}.xll-status.is-waiting{border-color:#fadb14;background:#fffbe6;color:#8a6d00}.xll-status.is-received{border-color:#e6a23c;background:var(--el-color-warning-light-9,#fdf6ec);color:#b88230}.xll-status.is-partial{border-color:var(--el-color-success-light-3,#95d475);background:var(--el-color-success-light-9,#f0f9eb);color:#529b2e}.xll-status.is-complete{border-color:#67c23a;background:var(--el-color-success-light-9,#f0f9eb);color:#529b2e}.xll-status.is-cancelled{border-color:#f56c6c;background:var(--el-color-danger-light-9,#fef0f0);color:#c45656}.xll-detail{padding:0 12px 12px 42px;background:var(--xll-white);overflow-x:auto}.xll-item-head,.xll-item-row{display:grid;grid-template-columns:52px 130px minmax(240px,2fr) minmax(130px,1fr) 88px 132px 116px 74px;gap:10px;align-items:center;min-width:1050px;padding:7px 0}.xll-item-head{border-top:1px solid var(--el-color-primary-light-7,#c6e2ff);border-bottom:1px solid var(--el-color-primary-light-7,#c6e2ff);background:var(--el-color-primary-light-9,#ecf5ff);color:var(--xll-ink);font-size:11px;font-weight:650}.xll-item-row{min-height:50px;border-bottom:1px dashed var(--el-border-color-lighter,#ebeef5);font-size:12px}.xll-detail-empty{padding:24px;text-align:center;color:var(--xll-muted)}.xll-pagination{display:flex;justify-content:flex-end;padding-top:10px}.xll-mono{font-family:"SFMono-Regular","Roboto Mono",Consolas,monospace;font-variant-numeric:tabular-nums}
.xll-result-loading{padding:30px;text-align:center;color:var(--xll-muted)}.xll-result{display:grid;gap:14px}.xll-result-head{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:12px;padding:12px 14px;border:1px solid var(--el-border-color-lighter,#ebeef5);border-radius:7px;background:var(--el-fill-color-light,#f5f7fa)}.xll-result-head span{display:block;margin-bottom:3px;color:var(--xll-muted);font-size:11px}.xll-result-head strong{display:block;overflow-wrap:anywhere;color:var(--xll-ink)}.xll-result-note{padding:9px 11px;border:1px solid var(--el-color-primary-light-7,#c6e2ff);border-radius:6px;background:var(--el-color-primary-light-9,#ecf5ff);font-size:12px}.xll-result-note.is-warning{border-color:var(--el-color-warning-light-5,#f3d19e);background:var(--el-color-warning-light-9,#fdf6ec)}.xll-result-table{overflow-x:auto}.xll-result-grid{display:grid;grid-template-columns:minmax(220px,1.7fr) minmax(130px,1fr) 90px minmax(130px,1fr) 90px 130px;gap:10px;align-items:center;min-width:880px;padding:8px 10px;border-bottom:1px solid var(--el-border-color-lighter,#ebeef5)}.xll-result-grid-head{background:var(--el-fill-color-light,#f5f7fa);color:var(--xll-muted);font-size:11px;font-weight:650}.xll-result-grid>div:first-child{display:grid;gap:2px}.xll-result-grid>div:first-child span{color:var(--xll-muted);font-size:11px}.xll-critical{display:inline-flex;margin-left:6px;padding:1px 6px;border-radius:4px;background:var(--el-color-danger-light-9,#fef0f0);color:var(--el-color-danger,#f56c6c);font-size:10px;font-weight:700}
.xll-head,.xll-row{grid-template-columns:32px minmax(190px,1.45fr) minmax(130px,1fr) 70px minmax(130px,1fr) 88px minmax(150px,1.1fr) 110px 74px;min-width:1120px}.xll-order-action{display:flex;justify-content:flex-end}.xll-item-head,.xll-item-row{grid-template-columns:52px 130px minmax(240px,2fr) minmax(130px,1fr) 88px 132px 116px;min-width:970px}.xll-result-group{display:grid;gap:8px;border:1px solid var(--xll-border);border-radius:7px;overflow:hidden}.xll-result-group-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:10px 12px;background:var(--el-color-primary-light-9,#ecf5ff)}.xll-result-group-head>div{color:var(--xll-ink);overflow-wrap:anywhere}.xll-result-group-head>div strong{margin-right:5px}.xll-result-group-head small{flex:none;color:var(--xll-muted);font-size:11px;text-align:right}.xll-result-group>.xll-result-note{margin:0 10px}.xll-result-empty{padding:18px;text-align:center;color:var(--xll-muted);font-size:12px}
@media(max-width:900px){.xll-toolbar .xll-search,.xll-toolbar .xll-date{width:calc(50% - 5px)!important;flex:0 0 calc(50% - 5px)}}
@media(max-width:760px){.xll-toolbar{display:grid;grid-template-columns:1fr}.xll-toolbar .xll-search,.xll-toolbar .xll-date{width:100%!important;max-width:none;flex:auto}.xll-mode-strip>small{width:100%;margin-left:0}.xll-result-head{grid-template-columns:1fr 1fr}.xll-pagination{justify-content:flex-start;overflow-x:auto}}
`
void legacyXllCss

/* ใช้ stylesheet ชุดเดียวกับ LAB Worklist จริงเพื่อให้ toolbar, list, expanded
   detail, pagination และ result dialog ตรงกันทั้ง light/dark/responsive mode.
   กฎ `.xll-*` ด้านบนเป็น legacy snapshot ที่ไม่ถูกใส่ใน output; กฎที่ render จริง
   เริ่มจาก labLookupCss นี้ */
form.formConfig.cssCode += `\n${labLookupCss}\n`

/* CSS ของ "ประวัติการแก้ผลอ่าน" (เพิ่ม 2026-09-15) — ต่อท้ายอย่างเดียว
   🔴 ไม่ scope ใต้ .xray-cpoe เหมือนคลาส .xr-report-* ตัวอื่น เพราะ el-dialog ถูก
      teleport ออกไปนอก root ของ widget ⇒ selector ที่ scope ไว้จะไม่โดน
   สีทั้งหมดอิงตัวแปรของ Element Plus ชุดเดียวกับที่ dialog เดิมใช้ จึงไปกับธีมมืดได้เอง */
form.formConfig.cssCode += `
.xr-rev-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.xr-rev-note{color:var(--el-text-color-secondary,#909399);font-size:12px}
.xr-report-modality{display:inline-block;width:fit-content;padding:2px 8px;border:1px solid var(--el-border-color,#dcdfe6);border-radius:5px;background:var(--el-fill-color,#f0f2f5);color:var(--el-text-color-regular,#606266);font-family:"SFMono-Regular","Roboto Mono",Consolas,monospace;font-size:11.5px;font-weight:650;line-height:1.35;white-space:nowrap;cursor:default}
.xr-rev-alert{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 12px;border:1px solid #f3d19e;border-radius:6px;background:#fdf6ec;color:#b88230;font-size:12.5px;font-weight:600}
.xr-rev-alert .el-button{margin-left:auto}
.xr-rev-split{display:grid;grid-template-columns:262px minmax(0,1fr);gap:16px;align-items:start}
.xr-rev-split.is-solo{grid-template-columns:minmax(0,1fr)}
.xr-rev-rail{border:1px solid var(--el-border-color-lighter,#ebeef5);border-radius:6px;background:var(--el-fill-color-lighter,#fafafa);overflow:hidden}
.xr-rev-rail-head{padding:9px 12px;border-bottom:1px solid var(--el-border-color-lighter,#ebeef5);color:var(--el-text-color-secondary,#909399);font-size:11px;font-weight:650}
.xr-rev-rail-list{display:flex;flex-direction:column;gap:2px;padding:6px}
.xr-rev-node{display:grid;grid-template-columns:18px minmax(0,1fr);gap:9px;width:100%;padding:9px 9px 9px 6px;border:1px solid transparent;border-radius:5px;background:transparent;font:inherit;color:inherit;text-align:left;cursor:pointer}
.xr-rev-node:hover{background:var(--el-bg-color,#fff);border-color:var(--el-border-color-lighter,#ebeef5)}
.xr-rev-node:focus-visible{outline:2px solid var(--el-color-primary,#409eff);outline-offset:-1px}
.xr-rev-node.is-current{background:var(--el-bg-color,#fff);border-color:var(--el-color-primary-light-5,#a0cfff);box-shadow:inset 2px 0 0 var(--el-color-primary,#409eff)}
.xr-rev-mark{display:grid;place-items:center;padding-top:2px}
.xr-rev-dot{width:9px;height:9px;border-radius:50%;background:var(--el-color-primary,#409eff);box-shadow:0 0 0 3px var(--el-color-primary-light-9,#ecf5ff)}
.xr-rev-node.is-latest .xr-rev-dot{background:var(--el-color-success,#67c23a);box-shadow:0 0 0 3px var(--el-color-success-light-9,#f0f9eb)}
.xr-rev-line{width:1px;flex:1;min-height:14px;margin-top:4px;background:var(--el-border-color-light,#e4e7ed)}
.xr-rev-node:last-child .xr-rev-line{background:transparent}
.xr-rev-node-body{display:flex;flex-direction:column;gap:3px;min-width:0}
.xr-rev-node-top{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.xr-rev-node-top b{color:var(--el-text-color-primary,#303133);font-size:12.5px;font-weight:650}
.xr-rev-tag{display:inline-flex;align-items:center;min-height:17px;padding:0 6px;border:1px solid;border-radius:3px;font-size:9.5px;font-style:normal;font-weight:700;white-space:nowrap}
.xr-rev-tag.is-latest{border-color:#b3e19d;background:#f0f9eb;color:#529b2e}
.xr-rev-tag.is-old{border-color:var(--el-border-color,#dcdfe6);background:var(--el-fill-color,#f0f2f5);color:var(--el-text-color-secondary,#909399)}
.xr-rev-node-when{color:var(--el-text-color-regular,#606266);font-size:11.5px}
.xr-rev-node-who{color:var(--el-text-color-secondary,#909399);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.xr-rev-panel{display:flex;flex-direction:column;gap:10px;min-width:0}
.xr-rev-panel-head{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.xr-rev-panel-head h3{margin:0;color:var(--el-text-color-primary,#303133);font-size:13.5px;font-weight:700}
.xr-rev-diff{margin-left:auto}
.xr-rev-ln{display:block;padding-left:11px;border-left:2px solid transparent}
.xr-rev-ln.is-head{color:var(--el-text-color-primary,#303133);font-weight:650}
.xr-rev-ln.is-changed{border-left-color:#f3d19e;background:#fdf6ec;color:var(--el-text-color-primary,#303133)}
.xr-rev-kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px 16px;padding:11px 13px;border:1px solid var(--el-border-color-lighter,#ebeef5);border-radius:6px;background:var(--el-fill-color-light,#f5f7fa)}
.xr-rev-kv>div{min-width:0}
.xr-rev-kv span{display:block;margin-bottom:2px;color:var(--el-text-color-secondary,#909399);font-size:10.5px;font-weight:650}
.xr-rev-kv strong{display:block;color:var(--el-text-color-primary,#303133);font-size:12px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media(max-width:760px){.xr-rev-split{grid-template-columns:minmax(0,1fr)}.xr-rev-rail{order:-1}}
`

/* ── Dark mode ของป้ายสถานะและชิป (ผู้ใช้แจ้ง 2026-09-15) ────────────────────
   ป้ายพวกนี้ hard-code สีอ่อนไว้ตั้งแต่ต้น พอสลับธีมมืดจึงกลายเป็นก้อนสว่างจ้า
   ทั้งแท็บ order และแท็บผลอ่าน (รวมชิป RIS ที่ผู้ใช้ชี้มาด้วย)
   🔴 ต่อท้ายอย่างเดียว ทุกกฎขึ้นต้นด้วย .dark ⇒ โหมดสว่างไม่เปลี่ยนแม้แต่พิกเซลเดียว
   🔴 ไม่ scope ใต้ .xray-cpoe สำหรับคลาสของ dialog เพราะ el-dialog ถูก teleport ออกไป
   สีพื้นใช้ rgba โปร่งบนพื้นมืด + ตัวอักษรสีอ่อนของโทนเดียวกัน ให้อ่านออกโดยไม่แสบตา */
form.formConfig.cssCode += `
.dark .xray-cpoe .xr-st-dispatched,.dark .xray-cpoe .xr-st-partial{border-color:#7a5a22;background:rgba(230,162,60,.16);color:#ffc978}
.dark .xray-cpoe .xr-st-complete{border-color:#3f6b30;background:rgba(103,194,58,.16);color:#a6e08a}
.dark .xray-cpoe .xr-st-cancelled,.dark .xray-cpoe .xr-st-failed{border-color:#7a3a3a;background:rgba(245,108,108,.16);color:#ffa8a8}
.dark .xray-cpoe .xr-st-waiting{border-color:#8a6d00}
.dark .xray-cpoe .xr-ris-a{background:rgba(90,171,255,.16);border-color:#2f4a68;color:#9ccbff}
.dark .xray-cpoe .xr-ris-c{background:rgba(103,194,58,.16);border-color:#3f6b30;color:#a6e08a}
.dark .xray-cpoe .xr-alert-box{border-color:#7a3a3a;background:rgba(245,108,108,.16);color:#ffa8a8}
.dark .xray-cpoe .xr-create-notice{color:#ffe0e0}
.dark .xray-cpoe .xr-urgent-tag{border-color:#7a3a3a;background:rgba(245,108,108,.16);color:#ffa8a8}
.dark .xray-cpoe .xr-transport-note{color:#ffa8a8}
.dark .xray-cpoe .xr-notice.is-warning{border-color:#7a5a22;background:rgba(230,162,60,.14);color:#ffc978}
.dark .xray-cpoe .xr-scan-context{border-color:#2f4a68;background:rgba(90,171,255,.14);color:#9ccbff}
.dark .xray-cpoe .xr-context-top .xr-source-pill{border-color:#2f4a68;background:rgba(90,171,255,.14);color:#9ccbff}
.dark .xray-cpoe .xr-context-top .xr-payment-pill{border-color:#3f6b30;background:rgba(103,194,58,.14);color:#a6e08a}
.dark .xray-cpoe .xr-context-top .xr-payment-pill.is-unpaid{border-color:#7a3a3a;background:rgba(245,108,108,.16);color:#ffa8a8}
.dark .xray-cpoe .xr-context-top .xr-coverage-pill{border-color:#7a5a22;background:rgba(230,162,60,.14);color:#ffc978}
.dark .xray-cpoe .xr-status-legend-dot.is-waiting{background:#d4bb1a}
.dark .xr-report-pending{border-color:#7a5a22;background:rgba(230,162,60,.14);color:#ffc978}
.dark .xr-cancel-summary{border-color:#7a3a3a;background:rgba(245,108,108,.14);color:#ffa8a8}
.dark .xr-rev-alert{border-color:#7a5a22;background:rgba(230,162,60,.16);color:#ffc978}
.dark .xr-rev-tag.is-latest{border-color:#3f6b30;background:rgba(103,194,58,.16);color:#a6e08a}
.dark .xr-rev-ln.is-changed{border-left-color:#7a5a22;background:rgba(230,162,60,.14)}
.dark .xray-queue .xq-state.is-wait{border-color:#7a5a22;background:rgba(230,162,60,.16);color:#ffc978}
.dark .xray-queue .xq-state.is-room{border-color:#3f6b30;background:rgba(103,194,58,.16);color:#a6e08a}
.dark .xray-queue .xq-state.is-done{border-color:#4a4f57;background:rgba(144,147,153,.16);color:#b9bec8}
/* ลิงก์ "ดูภาพ" ที่สวมคลาสของ el-button — ต้องลบเส้นใต้และบังคับ box ให้เท่าปุ่มจริง
   ไม่งั้นแถวจะสูงไม่เท่ากันและมีขีดใต้ตัวอักษรโผล่มา (เพิ่ม 2026-09-17) */
.xray-cpoe a.xr-viewer-link{display:inline-flex;align-items:center;justify-content:center;
  text-decoration:none;vertical-align:middle}
.xray-cpoe a.xr-viewer-link:hover,.xray-cpoe a.xr-viewer-link:focus{text-decoration:none}
/* HN / Order No. ใน dialog ยาวเกินช่องแล้วถูกตัดด้วย ellipsis (ผู้ใช้แจ้ง 2026-09-15)
   ให้เฉพาะช่องนี้ตัดบรรทัดได้ ช่องอื่นยัง nowrap เหมือนเดิมทุกช่อง */
.xr-report-head strong.xr-report-wrap{white-space:normal;overflow:visible;overflow-wrap:anywhere;line-height:1.35}
`

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(form, null, 2) + '\n')
console.log('wrote ' + path.relative(root, outPath))
