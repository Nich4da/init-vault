# X-ray SDForm Implementation Handoff

Updated: 2026-10-08 (ของเดิมลงวันที่ 2026-08-31 — queue contract แก้ใหม่ตามคำยืนยันล่าสุด)

## สถานะปัจจุบัน (2026-10-06) — อ่านก่อนลงมือ

เอกสารนี้เขียนไว้ตั้งแต่ก่อนเริ่มสร้าง artifact · ตอนนี้ของจริงเดินไปไกลกว่านั้นมาก
ข้อที่ถูกแทนที่แล้วมีหมายเหตุ **[แทนที่แล้ว]** กำกับในหัวข้อ Build constraints ด้านล่าง

### artifact ที่มีอยู่จริง

| ของ | ที่อยู่ | สถานะ |
|---|---|---|
| Form · X-ray Workbench | `Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json` | import แล้ว · Form `6a953fb6422c1ca959829e14` |
| Process · worklist | `Form-Builder/API/api-factory/processes/xray_cpoe_worklist_api.js` | Process `6a957009422c1ca959829e45` |
| Process · dispatch / accession | `xray_cpoe_dispatch_api.js` · `xray_accession_generate_api.js` | `6a967029422c1ca959829edc` · `6a95cd58422c1ca959829e8d` |
| Form · บันทึกการใช้สารทึบรังสี | `xray-contrast-media-record-v1.json` | import แล้ว `6aa2424809c1bad08952da71` |
| Form · ประวัติการใช้สารทึบรังสี | `xray-contrast-history-v1.json` | **ยังไม่ import** · รอ join ฝั่ง API |
| Form · คลังหนังสือยินยอม | `xray-consent-document-library-v1.json` | `6aab93911c5232627d0c6ee1` |
| จอนัดล่วงหน้า (คนละทีม) | XR Staff Booking | `6ab207459a834d51703fc158` |
| generator / เทส | `Form-Builder/seed/tests-tools/scripts/build_xray_*.js` · `Form-Builder/API/tests-tools/tests/test_xray_*.js` | generator เป็นแหล่งความจริง |

### Queue contract corrected (local · 2026-10-08; live deploy pending)

This replaces both the rejected parallel queue and the interim read-only X-ray queue adapter.

- Unit Queue, My Room and Completed now clone the complete EMR `button-ui`/`list-ui` widgets.
  `zdata_visit_tran` via Form `6a461235e521219e514d1c4b` is the only queue source of truth.
- `m0900` is the parent/front-desk center. With no Room selected it sees only `FRONT`; staff call,
  screen and move the Visit into a child room. A selected Room sees/calls only its own rows.
- The custom four-room queue display, eight-second polling and X-ray claim/adapter logic are retired.
  The Worklist Process no longer supports `action: queue` and does not group Orders into queue rows.
- Central EMR dependencies remain: `queue-call-front` `6ab0bb0afc8b9ef3e717b010`,
  `call-next-queue` `6a4b942bac48023662b1b42a`, Move Room `6a9524df422c1ca959829d9e`,
  and Move Unit/Forward `6a4f828d22f95f21b606d9a2`.
- My Room adapts only the EMR action target: the button is labelled `X-ray`, stamps central `start`,
  then opens the preserved Worklist at the same Visit. Completed opens the same Worklist read-only.
- Core Worklist, LAB lookup, Finance gate (`ready`), Accession, Dispatch, RIS, appointment,
  contrast and print paths remain.
- `m0900` must have front-desk behavior and blank/unlimited `custom_queue`; this package does not
  change Organization master or live EMR.
- No live Form/API/Report/SQL was changed. User will replace the prepared X-ray Form/API files.
- Full X-ray queue/Form/API tests, event/API syntax, SDForm validator and `git diff --check` pass.
- Separate pre-existing regression remains in `test_xray_order_ris_params.js`: fixture required-field
  list lacks `AdmissionNo` and `PatientSsn`; it is outside this queue change.
### ลำดับ deploy ที่ต้องเรียงแบบนี้เสมอ

1. รอบ EMR-native queue นี้ให้ import/replace **Form ก่อน** เพื่อหยุดเรียก `action: queue`
2. แล้วค่อย replace **Process** (ไฟล์ `.js` ทั้งไฟล์คือ body) เพื่อลบ adapter ที่ไม่ถูกใช้แล้ว
3. regenerate Form ต้องใส่ `XRAY_RIS_VIEWER_ENABLED=1` เสมอ ไม่งั้นปุ่ม "ดูภาพ" จะถูกปิดเงียบ ๆ

### ตัวขวางที่ยังค้าง (2026-10-05)

- ✅ **Sensitive lookup drift แก้แล้ว 2026-10-05 แบบ surgical:** `xray_lab_lookup` ใช้นโยบายเดียวกับ
  LAB ปัจจุบัน—ไม่มี doctor re-auth/dialog, credential, `authorize_sensitive_result` หรือ grant;
  server-redacted row แสดง `ปกปิดผล` และ PDF ไม่รับ grant. ไม่ sync LAB drift ส่วนอื่นเข้ามา
- ✅ generator เปลี่ยน guard ไปตรวจ fail-closed redaction contract และ allowlist เหลือ list /
  `get_manual_result`; focused Form regression และ SDForm validator ผ่าน
- 🟠 **ยังไม่ import live:** ผู้ใช้จะ replace เอง. รอบ EMR-native queue ต้อง replace Form
  `6a953fb6422c1ca959829e14` ก่อน แล้ว Process `6a957009422c1ca959829e45`; ส่วน Sensitive fix
  ก่อนหน้านี้ยังคงอยู่ใน Form เดียวกัน
- 🔴 Process worklist **ยังไม่ join `zdata_xray_contrast_media`** ⇒ หน้าประวัติสารทึบจะว่างเปล่า
  ต้องเพิ่ม `$lookup` ระดับ item ผูกด้วย `accession_no` แบบ additive ก่อน import ฟอร์มนั้น
- 🔴 JSON ของ Worklist มี token ของ print agent (widget `local_agent`) ⇒ **ห้าม push ขึ้น public remote**

## Read first

0. `Form-Builder/SDForm/X-ray/design.md` แล้วต่อด้วย `spec.md` — เอกสารตั้งต้นในโฟลเดอร์ทำงาน
1. `design/Xray_design.md`
2. `design/Xray_design-contract.md`
3. `02-his/ui/xray-workbench-mockup.html`
4. `design/Lab_design.md` — ต้นฉบับระบบภาพ ห้าม re-derive ค่าใหม่
5. `design/lab-cpoe-integration-checklist.md` — สถาปัตยกรรมอ่านตรงจาก CPOE
6. ก่อนแก้ JSON: `02-initcraft/governance/from-codex-backup/SDFORM_JSON_RULES.md`

## Build constraints

- Working location: **`Form-Builder/SDForm/X-ray/`** (ผู้ใช้อนุมัติและสร้างแล้ว 2026-08-31)
  ในโฟลเดอร์มี `design.md` (สรุปกติกาก่อนสร้าง) และ `spec.md` (สเปกไฟล์ JSON ตัวจริง)
  ห้ามแก้ `../backup/` และ `../best-practices/`
- ใช้ palette/typography/spacing/component dimension จาก `Lab_design.md` ตรง ๆ
- Toolbar เรียง `ค้นหา · Date Range · เครื่อง · Search · Report · สร้างรายการใหม่`
  · **[แทนที่แล้ว 2026-10-05]** ของจริงมี `เรียงตาม` (2026-09-25) และกลุ่มปุ่มขวามี
  `สร้างรายการใหม่` · `นัดล่วงหน้า` (2026-09-08 → ถอด 2026-09-26 → เอากลับ 2026-10-05)
  · `หนังสือยินยอม` (2026-09-17) · ตัวกรองเครื่องเป็น multi-select อ่านจาก `data.modalities[]`
- Filter chip สี่ตัวเท่านั้น และตัวเลขต้องนับภายใต้ตัวกรองเครื่องปัจจุบัน
  · **[แทนที่แล้ว]** ของจริงเป็น **ห้าตัว**: ทั้งหมด · รอรับ · รอผลตรวจ · ออกผลครบ · ยกเลิก
  กติกาการนับภายใต้ตัวกรองเครื่องยังใช้เหมือนเดิมทุกประการ
- ห้ามมีคอลัมน์ specimen, Lab No. หรือด่านตรวจ specimen ก่อนส่งเครื่อง
- ~~**1 order = 1 accession = 1 test**~~ · **[แทนที่แล้ว 2026-09-01 · ผู้ใช้ยืนยันจากข้อมูลจริง]**
  **1 order = หลาย test = หลาย accession เหมือน LAB** · action อยู่ระดับ item ได้ (ติ๊กเลือกรายการ
  แล้วส่งเข้าเครื่อง/ปฏิเสธ/ยกเลิก/ตรวจใหม่เฉพาะที่เลือก) · เลข accession ออกราย item
- **เลขสองชุด** (Appendix F): `Order No.` มาจาก CPOE (`20260831011`) · `Accession No.`
  ห้องรังสีออกเองตอนส่งเข้าเครื่อง อยู่ระดับ test (`20260831CT001`) running แยกตาม modality
  และแยกตามวัน ทั้งคู่ต้องมาจาก server ห้ามคำนวณที่หน้าจอ
- เครื่องผูกมากับ test ตั้งแต่ตอนสั่ง — ไม่ต้องมี UI สำหรับกรณี "ไม่ระบุเครื่อง"
- ขอบเขตหน่วยงาน enforce ที่ server แบบ fail-closed; dropdown เครื่องเป็นตัวกรองการแสดงผลเท่านั้น
- แยก Order, รายการตรวจ, Technical Receipt, Report และ Result Item เป็นคนละ record
- ห้ามฝังข้อมูลผู้ป่วยจริง credential URI หรือค่า environment
- ห้ามผูก Agent behavior ที่ยังไม่เคาะ เหมือนว่าเป็นข้อสรุปแล้ว
  · **[อัปเดต]** D-X2/D-X3/D-X6/D-X8/D-X14/D-X17/D-X21/D-X22 เคาะแล้ว (ดู `spec.md` และ `design.md`)
  ที่ยังค้างอยู่จริงคือ D-X12 (running เต็ม 999) · D-X15/D-X16 (ความยาว/ตัวพิมพ์ของ accession)

## รอบที่ 1 — ที่ผู้ใช้สั่งไว้: แสดงรายการจาก CPOE ให้ได้ก่อน

สิ่งที่ artifact แรกต้องพิสูจน์:

1. Worklist query อ่าน `zdata_cpoe_order_item` ที่ `service_type='xray'` แล้ว join
   `zdata_cpoe_order` และ group กลับเป็นหนึ่ง Order พร้อม `items[]`
2. Dropdown เครื่อง — **[แทนที่แล้ว]** ไม่ใช่ 19 ค่าตายตัว: อ่านจาก `data.modalities[]` ของ API
   เลือกได้หลายตัว ค่าเริ่มต้นว่าง (= ทุกเครื่อง) กรองทันที คงค่าเมื่อเปลี่ยน chip/หน้า
   และตัวเลข chip เปลี่ยนตาม (ข้อหลังยังจริงทุกข้อ)
3. แถว Order ขยาย/ย่อได้โดยไม่เสียคอลัมน์ และ dropdown render เหนือแถวข้างเคียง
4. Search และ Date Range ทำงานตาม `Xray_design.md` Appendix B
5. รายการที่ไม่มีเครื่องปลายทางถูก flag ว่าข้อมูลไม่ครบ ไม่ใช่เดาค่า
6. ทุก popup/action ได้รับ Order/Item ID ที่เสถียร ไม่อ่าน state จาก DOM
7. EMR เปิดได้ทุกสถานะ

## รอบที่ 2 — หลังเคาะ D-X1 / D-X3 / D-X4

1. `xray-cpoe-dispatch` API: บันทึกเวลารับ/ผู้รับ → เรียก Agent นอก transaction →
   เก็บ transport outcome โดย **ไม่ rollback** การรับเมื่อ Agent ล้มเหลว
2. ปฏิเสธรายการ (ครั้งละ 1) และยกเลิกทั้ง Order (atomic) เป็นคนละ action คนละ audit
3. `ตรวจใหม่` สร้าง Order ใหม่ที่ลิงก์กลับรายการเดิม ห้ามแก้/ลบประวัติ
4. แท็บผลอ่านตาม schema ที่ยืนยันแล้ว (D-X6) และปุ่ม `ดูภาพ` ต่อกับ RIS ตาม contract (D-X17)

## Verification

- รัน `python3 Form-Builder/seed/tests-tools/validators/check_sdform_json.py <candidate.json>`
- static validation ไม่ใช่หลักฐาน runtime — ต้องตรวจ Builder/Preview สำหรับ layout
  และ deployed runtime สำหรับ workflow/data
- ก่อนอ้างว่าพร้อม production ต้องรัน HIS → Agent → เครื่อง → Agent → HIS จริงหนึ่งรอบ
  ครอบคลุมกรณีสำเร็จ, ส่งไม่สำเร็จแล้วลองใหม่, ปฏิเสธ, ยกเลิก และผลซ้ำ

## ของที่ยังขาดและต้องขอจากผู้ใช้

- ไฟล์ draw.io ของกรอบงาน X-ray (export เป็น `.drawio`/`.png` เข้ามาที่ `02-his/draw_design/`)
  — ลิงก์ Google Drive ที่ส่งมาเปิดอ่านจากที่นี่ไม่ได้
- ที่มาที่แท้จริงของรายการเครื่อง 19 ค่า (section ของหน่วยรังสี, master เครื่องแยก หรือ enum)
- code เครื่องจริงของ 10 ค่าที่ไม่มีใน `modality_type` (D-X14) — mockup ใช้ค่าสมมติอยู่
- ยอมรับความยาว accession ที่ไม่คงที่ 13–15 ตัวหรือไม่ (D-X15) และตัวพิมพ์ของ code (D-X16)
- guard เมื่อ running ของ modality ใดเต็ม 999 ในวันเดียว (D-X12)
- ชื่อ field รหัสส่งตรวจขาออกของ X-ray ใน `zdata_master_item_order`
- ~~โครงสร้างผลอ่านที่ Agent/PACS จะส่งกลับ~~ **ได้แล้ว**: RIS insert แถวใหม่ทุกฉบับลง
  `zdata_xray_result` + `zdata_zdata_xray_result_log` · ผลเป็น document ก้อนเดียว (`result_text`)
  ไม่ได้แยก Findings/Impression · `get_report` คืน `versions[]` ใหม่→เก่าให้ดูประวัติการแก้ได้
- ~~contract ของโปรแกรม RIS สำหรับปุ่ม `ดูภาพ`~~ **ได้แล้ว 2026-09-15**:
  `<BASE>?QueryMode=AN&Value=<Accession>` หรือ `QueryMode=PID&Value=<HN>` · BASE เป็นเครื่อง
  ของผู้ใช้เอง (`http://localhost:9090`) ⇒ เปิดจาก browser เท่านั้น ห้ามทำเป็น Process ฝั่ง server
