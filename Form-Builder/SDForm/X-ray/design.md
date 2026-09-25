---
type: design
title: X-ray Workbench SDForm — Design Reference
created: 2026-08-31
updated: 2026-09-24
tags: [xray, sdform, worklist, design]
---

# X-ray Workbench SDForm — Design Reference

โฟลเดอร์นี้คือ **working location ที่ผู้ใช้อนุมัติ** สำหรับสร้าง SDForm ของหน่วยรังสีวิทยา

SDForm JSON รอบแรกอยู่ที่ `xray-cpoe-worklist-v1.json` แล้ว

| ไฟล์ | หน้าที่ |
|---|---|
| `xray-cpoe-worklist-v1.json` | artifact ที่ import เข้า Builder |
| `../../../design/xray-worklist-ui-design-update.md` | สรุป UI design ที่ผู้ใช้ตรวจและอนุมัติรอบ 2026-09-11 |
| `../../seed/tests-tools/scripts/build_xray_cpoe_worklist_ui.js` | generator — regenerate ได้ ไม่ต้องแก้ JSON ด้วยมือ |
| `../../API/tests-tools/tests/test_xray_cpoe_worklist_form.js` | behaviour test ของตัวกรอง/การจัดกลุ่ม |
| `../../API/api-factory/processes/xray_cpoe_worklist_api.js` | Process อ่าน worklist (read-only) · ID `6a957009422c1ca959829e45` |
| `../../API/api-factory/processes/lab_cpoe_worklist_api.js` | dependency ของแท็บสืบค้นผล LAB ทุกห้อง (read-only) · ID `6a9434c3422c1ca959829d5e` |
| `../../API/tests-tools/tests/test_xray_cpoe_worklist_api.js` | regression test ของ Process |
| `../../API/api-factory/processes/xray_accession_generate_api.js` | ออกเลข Accession No. (atomic + idempotent) · ID `6a95cd58422c1ca959829e8d` |
| `../../API/tests-tools/tests/test_xray_accession_generate_api.js` | regression test ของตัวออกเลข |
| `../../API/api-factory/processes/xray_cpoe_dispatch_api.js` | ส่งเข้าเครื่อง: ออกเลข → บันทึกรับ → ส่ง RIS · ID `6a967029422c1ca959829edc` |
| `../../API/tests-tools/tests/test_xray_cpoe_dispatch_api.js` | regression test ของ dispatch |

สถานะ 2026-09-24: validator และ automated tests ต้องผ่านก่อนส่งมอบ · ฟอร์มเรียก Process
`6a957009422c1ca959829e45` (worklist) และ `6a95cd58422c1ca959829e8d` (ออกเลข Accession)
แล้ว · **ยังไม่ได้ตรวจใน Builder/Preview และ runtime จริง**

Finance gate ใช้แบบเดียวกับ LAB: `sent` และ `ready` ยังอยู่กลุ่ม `รอรับ`; `ready` จึงกด
`ส่งเข้าเครื่อง` และออก Accession ได้. ถ้ายังเป็น `sent` ปุ่มคงมองเห็นแต่ disabled พร้อม
tooltip `ยังไม่ผ่านการเงิน`; ยังเลือก item เพื่อปฏิเสธหรือยกเลิกได้. Process dispatch
`6a967029422c1ca959829edc` และ Process ออกเลข enforce กติกานี้ฝั่ง server ด้วย โดยไม่บล็อก
retry/repair/resend ของรายการที่เคยรับแล้ว.

แท็บระดับบนเรียง `Unit Queue` · `My Room` · `X-ray` · `สืบค้นผลแลป` · `Completed` โดย
ยังเปิดเริ่มต้นที่ `X-ray`. แท็บใหม่ใช้ LAB Process `6a9434c3422c1ca959829d5e` แบบ
read-only: เริ่มว่าง, ค้นด้วย HN แบบตรงตัวหรือ Date Range, ส่ง `cross_section:true`, ดูได้ทั้ง
ผลและรายการสั่งจากทุก LAB section ที่เปิดใช้ และเรียกได้เฉพาะ `list`/`get_manual_result`.
ก่อน deploy ต้องให้สิทธิ์กลุ่ม X-ray เรียก LAB Process นี้และ UAT ด้วยบัญชีจริง; ยังไม่มีหลักฐาน
Builder/Preview หรือ runtime ของแท็บใหม่นี้.

## แหล่งอ้างอิงตามลำดับ

| ลำดับ | ไฟล์ | ใช้ทำอะไร |
|---:|---|---|
| 1 | `../../../design/Xray_design.md` | สเปกภาพ + business rule + Appendix A–F ทั้งหมด · **ต้นฉบับเดียว** |
| 2 | `../../../design/Xray_design-contract.md` | decision record · evidence · keep/change/do-not-copy |
| 3 | `../../../design/Xray_implementation-handoff.md` | ลำดับงาน · สิ่งที่ artifact แรกต้องพิสูจน์ |
| 4 | `../../../02-his/ui/xray-workbench-mockup.html` | หน้าต้นแบบที่ผู้ใช้ตรวจแล้ว 4 รอบ |
| 5 | `../../../design/Lab_design.md` | ต้นฉบับระบบภาพ (สี ตัวอักษร ระยะ ขนาด motion) **ห้าม re-derive** |
| 6 | `../../../02-initcraft/governance/from-codex-backup/SDFORM_JSON_RULES.md` | **ต้องอ่านก่อนแตะ JSON ทุกครั้ง** |
| 7 | `./spec.md` | สเปกการสร้างไฟล์ JSON ตัวจริง |

## สรุปสิ่งที่ต้องสร้าง

หน้าเดียว desktop-first สำหรับหน่วยรังสีวิทยา แสดงใบสั่งที่มาจาก CPOE
รับรายการและส่งเข้าเครื่องผ่าน API → Agent แล้วติดตามผลอ่าน

## กติกาที่ต่างจาก LAB — จำให้ครบก่อนเริ่ม

| # | กติกา |
|---:|---|
| 1 | ~~1 order = 1 accession = 1 test~~ **แก้แล้ว 2026-09-01** — ข้อมูลจริงมีใบที่สั่ง 2 รายการ ผู้ใช้ยืนยันว่า **1 order = หลาย test = หลาย accession เหมือน LAB** · หนึ่งแถวใน worklist คือหนึ่ง **order** และกางออกเพื่อติ๊กเลือกรายการที่จะส่ง |
| 2 | **ไม่มี specimen** และ **ไม่มี Lab No.** ห้ามมีคอลัมน์หรือด่านตรวจใด ๆ ที่เกี่ยวกับ specimen |
| 3 | **ไม่มี checkbox ราย item** และไม่มีการปฏิเสธราย item — ทุก action กินทั้งใบ |
| 4 | ปุ่มใน detail มีเพียง `ส่งเข้าเครื่อง` และ `ยกเลิก order` (ใบที่ยกเลิกเปลี่ยนเป็น `ตรวจใหม่`) |
| 5 | **dropdown เลือกเครื่อง** แทรกระหว่าง `Date Range` กับปุ่ม `Search` · 19 ค่า · ค่าเริ่มต้น `Select all` · กรองทันที |
| 6 | ตัวเลขบน status chip ต้องนับ **ภายใต้ตัวกรองเครื่องปัจจุบัน** |
| 7 | **เลขสองชุด**: `Order No.` มาจาก CPOE (ระดับ order) · `Accession No.` ห้องรังสีออกเอง (**ระดับ test** · หนึ่งใบมีได้หลายเลข) |
| 8 | ทุก test ผูกเครื่องไว้ตั้งแต่ตอนสั่ง — **ไม่มีสถานะ "ไม่ระบุเครื่อง"** ในหน้าจอ |
| 9 | ปุ่มท้ายแถวอยู่คอลัมน์เดียว เรียงต่อกัน **ห้ามเว้นช่อง `–`** · ใบที่ยกเลิกเหลือ `EMR` ปุ่มเดียว |
| 10 | เหตุผล/ผู้ยกเลิกแสดงเป็นคอลัมน์ `ปฏิเสธ` / `คนปฏิเสธ` ในตารางระดับ test ไม่ใช้ popup |
| 11 | ผลเป็น **document** (findings / impression) ไม่ใช่ตารางค่าเชิงตัวเลขแบบ LAB |
| 12 | แท็บผลอ่านมีปุ่ม `ดูภาพ` ที่ยังไม่ต่อระบบ — ต้องบอกว่ารอเชื่อมกับโปรแกรม RIS |
| 13 | `ส่งเครื่องไม่สำเร็จ` แยกจากการยกเลิก และ **ห้าม rollback การรับ** |
| 14 | ขอบเขตหน่วยงาน enforce ที่ server แบบ fail-closed · dropdown เครื่องเป็นตัวกรองการแสดงผลเท่านั้น ไม่ใช่ตัวให้สิทธิ์ |

## ระบบภาพ

ยกจาก `Lab_design.md` ทั้งชุด ไม่มี token ใหม่ ค่าที่เปลี่ยนมีเฉพาะที่ระบุใน
`Xray_design.md` §4 (toolbar 10 คอลัมน์ · worklist min-width `1310px` · ตาราง test min-width `1180px`)

## ข้อห้ามเด็ดขาด

- ห้าม hard-code รายชื่อเครื่อง ค่าผล ชื่อผู้ใช้ organization หรือ mapping ใด ๆ ลงในฟอร์ม
  - **ข้อยกเว้นชั่วคราว 2026-09-03 (ผู้ใช้สั่ง):** รายชื่อรังสีแพทย์ 5 คน และ Radiographer 8 คน
    เป็นตัวเลือก dropdown ในฟอร์มโดยตรง เพราะยังไม่มี master เจ้าหน้าที่ในระบบ ·
    ฝั่ง API ไม่ได้ผูกรายชื่อไว้ ⇒ ย้ายไปอ่านจาก master ได้โดยแก้ที่ฟอร์มที่เดียว
- ห้ามฝังข้อมูลผู้ป่วยจริง credential URI หรือค่าเฉพาะ environment
- ห้ามคำนวณ `Order No.` หรือ `Accession No.` ที่ฝั่งหน้าจอ
- ห้ามผูกพฤติกรรม Agent ที่ยังไม่เคาะ (D-X2, D-X3, D-X12, D-X14 ถึง D-X17) เหมือนว่าเป็นข้อสรุปแล้ว
- ห้ามแก้ไฟล์ใน `../backup/` และ `../best-practices/`

## สถานะ decision ที่ยังค้าง

อ่านรายละเอียดใน `Xray_design.md` Appendix D — ตัวที่บล็อกการต่อ backend:

- **D-X2 เคาะบางส่วนแล้ว 2026-08-31** — เครื่องอ่านจาก `master.xray_item.modality` และ dropdown ใช้ enum 11 ค่า
  ของ master Radio Exam (`6a8fde8a4c725771c62b1bc1`) ไม่ใช่รายการ 19 ค่าเดิม
- **D-X14 เคาะแล้ว 2026-09-01** — เลข accession ใช้ code 2 ตัวจาก enum 11 ค่าของ Radio Exam (`VCUG` → `VC`) รูปแบบเต็มอยู่ใน `spec.md` §4.3
- **D-X8 เคาะแล้ว 2026-08-31 · ขยาย 2026-09-01** — ขอบเขตคุมด้วย Organization ไม่ใช่ Section
  (`XRAY_ORGANIZATION_CODES = ['m0900','m0901','CT']`) ผังจริงคือ `m0900` กลุ่มงานรังสีวิทยา (xray)
  มีลูกสองหน่วยคือ `m0901` งานรังสีวิทยา (X-ray ธรรมดา) และ `CT` CT scan / CT-MRI SCAN
  · **เป็นประตูอย่างเดียว ไม่ได้กรองข้อมูล** — ทุก org ที่ผ่านเข้ามาเห็นรายการรังสีทั้งหมด
  เหมือนกัน ผู้ใช้ยืนยัน 2026-09-01 ว่ายังไม่ต้องแยกให้แต่ละ org เห็นเฉพาะงานตัวเอง
- **D-X3 เคาะทิศทางแล้ว 2026-09-01** — ปุ่ม `ส่งเข้าเครื่อง` = ออกเลข Accession แล้วส่งเข้า RIS
  ด้วย **API ที่ทีมเขียน** (`../../API/api-factory/xray_api_order.js` · Process
  `6a8f1ef87632d182ef6914fe`) ไม่ใช้ Agent submit ของ LAB ที่บังคับ `labno`/`specimen_code`
  ลำดับเต็มและข้อค้นพบจากซอร์สของทีมอยู่ใน `spec.md` §4.2
- **D-X21 ปรับ 2026-09-07 ตามคำสั่งผู้ใช้** — 1 order ส่งหลาย `item_ids[]` ในคำขอเดียวได้
  เหมือน LAB แต่ accession/ผลอ่าน/สัญญา RIS ยังเป็นราย item: server จัดลำดับออกเลขและส่ง
  flat payload ทีละรายการ · `item_id` เดี่ยวยังใช้ได้เหมือนเดิม · preflight batch ทั้งชุดก่อนเริ่ม
  และสถานะระดับใบยังเป็นผลรวมของ item — ใบ `ออกผลครบ` เมื่อทุก item มีผลแล้ว
- **D-X22 เคาะแล้ว 2026-09-01** — **MongoDB เป็น standalone ห้ามใช้ transaction**
  ทุก Process ต้องมีเส้นทางสำรองแบบไม่มี session (รายละเอียดใน `spec.md` §4.3.1)
  นี่คือสาเหตุจริงของอาการ "สถานะเปลี่ยนแต่ไม่มีเลข Accession"
- **D-X23 รอผู้ใช้เคาะ** — ฟอร์มเหตุผลการปฏิเสธของรังสี **แยกจาก LAB หรือใช้ร่วมกัน**
  ข้อเสนอ: **แยก** เพราะชุดเหตุผลไม่ทับกันเลย (LAB = คุณภาพสิ่งส่งตรวจ · รังสี =
  ผู้ป่วยไม่มา/เตรียมตัวไม่พร้อม/ตั้งครรภ์/ข้อห้าม contrast/เครื่องเสีย) และฟอร์ม LAB
  บังคับ `lab_section` + `biochemistry_specimen_json` ซึ่งงานรังสีไม่มี
  · โครง Process รองรับทั้งสองทางแล้ว — เปลี่ยน `REJECTION_COLLECTION` ค่าเดียว
- **D-X24 เคาะแล้ว 2026-09-01** — ปุ่ม **ยกเลิก order** เชื่อมแล้ว ใช้ `action:'cancel_order'`
  ใน Process worklist ตัวเดิม (ทรงเดียวกับ LAB) ไม่ต้องขอ Process ID ใหม่ และไม่ต้องมี
  ฟอร์มเหตุผลแยก — เหตุผลเป็น free text ใน dialog · รายละเอียดใน `spec.md` §4.5
- **D-X9 2026-09-18 — ผู้ใช้ยืนยันเส้นทาง Order cancel:** ส่ง JSON ไป `xray_api_order`
  เส้นเดิมด้วย `AccessionNo` เดิมและ `IsDeleted: true` เมื่อใบอาจถึง RIS แล้ว
  · local `cancel_order` ส่งก่อนประทับ cancelled; ส่งล้ม/ACK ไม่ครบค้าง `ris_pending`
  ให้ลองซ้ำ · ใบยังไม่มีเลขใช้ flow HIS เดิม · **ยังรอ UAT จริง** ว่า modality เอาใบออกจากคิว
  · การปฏิเสธระดับ item หลังส่งเข้า RIS ยังบล็อกเหมือนเดิม (ไม่ใช่ปุ่มยกเลิกทั้งใบ)
- **D-X6 เคาะแล้ว 2026-09-02** — ผู้ใช้อัปโหลดสัญญาที่เหลือครบ · ขาเข้ามีจริง 4 เส้น
  ผลอ่านอยู่ที่ `zdata_xray_result` (`xray-api-ris-result` · `6a861de5f851000f28e44ab3`)
  ผูกด้วย `AccessionNo` · ฟิลด์หลักคือ `ResultText` (ก้อนเดียว ไม่แยก findings/impression),
  `ResultDateTime`, `RadiologistUid`, `SeverityUid`, `ImageCapturedDateTime`
  · endpoint นี้ **insert ทุกครั้ง ไม่ upsert** ⇒ ฝั่งเราต้องเลือกฉบับล่าสุดเอง
  (ข้อสรุป "สัญญาเป็นทางเดียว" ของ 2026-09-01 ผิด เกิดจากมีแค่ `xray_order` ไฟล์เดียว)
- **D-X9 2026-09-02 → 2026-09-18** — `xray_order_status_change` รับ `Status` แค่
  `A` = Arrival และ `C` = **Completed** ⇒ **`C` ไม่ใช่การยกเลิก**;
  ผู้ใช้ยืนยันส่ง `IsDeleted: true` ผ่าน `xray_api_order` เดิม · ผลบน modality รอ UAT
- **D-X17 เคาะแล้ว 2026-09-15** — ทีม RIS ให้ contract ของโปรแกรมดูภาพมาแล้ว เปิดได้ 2 level
  จาก base เดียวกัน (viewer รันที่ `localhost:9090` บน **เครื่องของผู้ใช้**):
  `?QueryMode=AN&Value=<Accession Number>` ราย study · `?QueryMode=PID&Value=<Patient ID>` รายคนไข้
  ⇒ ปุ่ม `ดูภาพ` ใช้ AN เมื่อรายการมีเลข Accession แล้ว ไม่มีจึงตกไป PID (HN)
  · **ไม่ต้องมี API/Process ใหม่** — ค่าทั้งสองอยู่ใน payload ของ worklist API เดิม และ
  viewer อยู่บนเครื่องผู้ใช้ ฝั่ง server ยิงไปไม่ถึง ⇒ ต้องเปิดด้วย `window.open` เท่านั้น
  · **เปิดใช้งานแล้ว** (`RIS_VIEWER_ENABLED=true` · ผู้ใช้สั่ง 2026-09-15) กดแล้วเปิดแท็บใหม่จริง
  ⇒ ใช้ได้ทันทีที่ RIS เปิดเส้นทาง ระหว่างนี้แท็บใหม่จะขึ้น error ของ browser ซึ่งผู้ใช้ยอมรับแล้ว
  · สวิตช์ยังอยู่ ปิดกลับได้ด้วยการ generate ใหม่โดยไม่ตั้ง env — เส้นทาง "แจ้งว่ารอ RIS" ไม่ได้ถูกลบ
  · ข้อค้นพบเดิมยังจริง: ทั้ง 4 ฟอร์มไม่มี `StudyInstanceUid` หรือ URL ของ PACS สักตัว
  — deep link จึงผูกกับ Accession/HN ไม่ใช่ study UID
  · รายละเอียด ปัญหาที่เจอ และคำถาม 9 ข้ออยู่ใน `ris-integration-plan.md`

รอบแรกที่ผู้ใช้สั่ง — **แสดงรายการที่สั่งมาจาก CPOE ให้ได้ก่อน** — ไม่ติด decision เหล่านี้
