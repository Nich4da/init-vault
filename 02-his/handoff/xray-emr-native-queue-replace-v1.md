---
title: X-ray EMR-native queue replacement v1
date: 2026-10-13
status: corrected-local-form-and-api-ready-for-replace; builder-runtime-uat-pending
scope: X-ray only; EMR read-only
---

# X-ray EMR-native queue replacement v1

ชุดนี้เปลี่ยนเฉพาะ X-ray ให้ใช้ flow คิวกลางแบบ EMR โดยไม่แก้ EMR สด และไม่สร้าง
queue lifecycle ของ X-ray เพิ่ม

## Latest-source audit 2026-10-12

ตรวจ EMR live Form `6a4f64e7f8cdfc54cec16488` แบบ read-only แล้วพบว่า clone เดิม
ยังไม่ใช่ฉบับล่าสุด:

- live metadata: `updated_at = 2026-10-10 23:58:38`
- `Created By / Owner = SuperAdmin InitAPI` จึงห้ามแก้ live EMR
- clone เดิมอ้าง snapshot ก่อน live update และขาดหัว My Room แบบ grid สองคอลัมน์
  กับปุ่ม `Check-in`
- clone เดิมขาดสถานะคิวที่ถูกเรียกกลับ: glyph `↺`, สี warning และ tooltip
  `เรียกกลับ`

แพ็กเกจ local ปัจจุบันเติม delta ที่ตรวจจาก Builder live ครบแล้ว:

- My Room มี `เรียกคิวถัดไป` ด้านซ้าย และ `Check-in` ด้านขวา
- `Check-in` เปิด Form กลาง `6ac9f156481c196fbb330cab` แล้ว refresh
  `visit_unit` และ `visit_room`
- Unit Queue, My Room และ Completed ใช้การแสดงสถานะเรียกกลับแบบ live
- action `EMR` ใน My Room/Completed ยังถูกเปลี่ยนเป็น `X-ray` ตาม requirement ของห้อง
  และ My Room จะ start คิวก่อนเปิด Worklist พร้อมกาง Order ของ Visit อัตโนมัติ

### Re-audit correction 2026-10-13

ตรวจ EMR Builder และ X-ray Builder live ซ้ำตามภาพผู้ใช้แล้วพบว่าแพ็กเกจยังไม่ตรง
EMR ล่าสุดหนึ่งจุด:

- EMR `Unit Queue` มีเฉพาะ `List View`; ไม่มี `button-ui` หัวแท็บ
- การเรียกคิวของ Unit Queue อยู่ที่ row action `เรียก` ร่วมกับ `ซักประวัติ`,
  `ย้ายห้อง`, `ส่งต่อ`
- X-ray ที่ Replace แล้วและ JSON local ยังมี `btn_unit` / `เรียกคิวถัดไป` เพิ่มอยู่เหนือ
  List View แม้จะมี row action `เรียก` อยู่แล้ว

แก้แพ็กเกจ local แล้วโดยถอดเฉพาะ `btn_unit` ออกจาก Unit Queue และคง row action
`เรียก` ไว้ครบ ส่วน My Room ยังคง header `เรียกคิวถัดไป` + `Check-in` ตาม EMR live
เพราะเป็นคนละแท็บกับ mismatch ข้างต้น ชุด regression และ validator ผ่านแล้ว จึงพร้อมให้
ผู้ใช้ Replace Form JSON รอบใหม่; live X-ray จะยังเป็นรุ่นเดิมจนกว่าจะ Replace และ UAT

กฎใหม่ที่ผู้ใช้ระบุไม่ต้องเพิ่ม lifecycle หรือเขียน API ซ้ำ เพราะโครงปัจจุบันตรงอยู่แล้ว:

- Order X-ray ทุกใบที่ผ่าน vocabulary ปกติอ่านจาก CPOE item และเข้า Worklist โดยไม่อิง
  Visit Tran/สถานะคิว
- Queue ที่การเงินหรือห้องตรวจส่งเข้า X-ray อ่านจาก Visit Tran กลางและขึ้น Unit Queue
  พร้อมกันได้ โดยไม่ได้ย้ายหรือลบ Order ออกจาก Worklist
- หลังเรียกคิวเข้า My Room จะมี action `X-ray`; ถ้าสถานะ `called` ระบบ start คิวกลาง
  ก่อนสลับไป Worklist และกางทุก Order ของ Visit นั้นอัตโนมัติ ถ้า `in_progress` จะเปิดตรง

จึงไม่แก้ business logic เพิ่มหลัง refresh clone; เพิ่ม regression assertion เพื่อกันการนำ
queue gate กลับมาครอบ Worklist ในอนาคต

### Read-only tracking tab 2026-10-13

เพิ่มแท็บ `ติดตามคิว` ตาม mockup ที่ผู้ใช้ยืนยัน โดยวางลำดับ
`Completed → ติดตามคิว → สืบค้นผลแลป` เท่านั้น:

- แสดงตำแหน่งล่าสุดจาก `zdata_visit_tran.unit_to/room_to` และเส้นทางล่าสุดจาก
  `unit_from → unit_to/room_to`
- แสดงสถานะ `รอรับ` / `ตรวจอยู่` / `ออกผลแล้ว`; สถานะออกผลอ่านจาก RIS
  `ResultText` ครบทุก X-ray item ที่ยัง active ไม่ใช้ queue `done` แทนผลตรวจ
- เพิ่ม read action `queue_tracking` ใน Worklist API เดิม; action นี้ใช้ aggregate อ่านอย่างเดียว
  ไม่มี `$out`/`$merge` และไม่เรียก process รับคิว/ย้ายห้อง/start/done
- Unit Queue, My Room, X-ray, Completed และ LAB lookup เดิมไม่เปลี่ยน contract

## ไฟล์สำหรับ Replace

Form Factory: `Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json`

API Factory body ของ Process `xray-cpoe-worklist` (`6a957009422c1ca959829e45`):
`Form-Builder/API/api-factory/processes/xray_cpoe_worklist_api.js`

ต้อง Replace ทั้งสองไฟล์ในรอบนี้ เพราะ Form ใหม่เรียก action `queue_tracking` ที่เพิ่มใน API;
ถ้า Replace เฉพาะ JSON แท็บใหม่จะขึ้นข้อความว่า API ไม่รองรับ action แต่ flow เดิมยังคงอยู่

## Queue contract

- Unit Queue เป็น `list-ui` อย่างเดียวและเรียกคิวจาก row action `เรียก`; My Room เป็น
  action header + `list-ui`; Completed เป็น `list-ui` ตาม EMR live
- source of truth คือ Visit Tran Form `6a461235e521219e514d1c4b`
- หน้า center เลือก Unit `m0900` และไม่เลือก Room: เห็นคิว `FRONT`
- เจ้าหน้าที่ center ใช้ “ย้ายห้อง” เพื่อส่งเข้าห้องลูก
- เมื่อเลือก Room: Unit Queue เห็นเฉพาะคิวรอของห้องนั้น และ My Room เห็นเฉพาะ
  `called/in_progress/skipped` ของห้องนั้น
- Completed เห็นรายการ `done` ระดับทั้งสายหน่วยผ่าน `unit_path`
- ไม่มีรายการห้องใหญ่ 4 ห้องแบบ custom และไม่มีการกระจายคิวเดียวไปทุกห้อง

## Central EMR dependencies (ห้ามสร้างสำเนา)

- `queue-call-front`: `6ab0bb0afc8b9ef3e717b010`
- `call-next-queue`: `6a4b942bac48023662b1b42a`
- start/queue transition: `6a4f852422f95f21b606d9a3`
- Move Room form: `6a9524df422c1ca959829d9e`
- Move Unit/Forward form: `6a4f828d22f95f21b606d9a2`
- Check-in form: `6ac9f156481c196fbb330cab`

ปุ่ม Check-in clone มาจาก EMR ครบ แต่ runtime สำหรับ `m0900` ยังติด validation ของ
API กลาง `checkin` ที่อนุญาตเฉพาะ `clinic`; เจ้าของ `SuperAdmin InitAPI` ต้องเพิ่ม
allowlist แบบ exact ตาม `02-his/handoff/xray-finance-center-checkin.md` ก่อน UAT เส้นนี้

## Master-data gate ก่อน UAT

ตรวจ Organization `m0900` แบบ read-only ก่อนใช้งานจริง:

- ต้องทำหน้าที่ front desk/center ของสาย X-ray
- `custom_queue` ต้องว่าง/ไม่จำกัด ตามคำสั่งผู้ใช้
- ห้องลูกต้องผูกกับหน่วยที่ถูกต้อง เพื่อให้ Move Room กรองห้องได้เหมือน EMR

ชุดนี้ไม่ได้แก้ Organization master หรือ EMR สด ผู้ใช้เป็นผู้ Replace เอง

## UAT ขั้นต่ำ

1. เลือก Unit `m0900` โดยไม่เลือก Room แล้วตรวจว่าคิวใหม่อยู่ Unit Queue เท่านั้น
2. กด row action “เรียก” จาก center แล้วตรวจว่าคิวไป My Room ของ `FRONT` และไม่มี
   ปุ่มหัวข้อ “เรียกคิวถัดไป” บน Unit Queue
3. กด “ย้ายห้อง” ไปห้องลูก แล้วตรวจว่าหายจาก center และเห็นเฉพาะห้องลูกนั้น
4. ที่ห้องลูก กดเรียก/เริ่มตรวจ และเปิดแท็บ X-ray ได้พร้อม Visit เดิม
5. ส่งต่อ/จบคิว แล้วตรวจ Completed ระดับหน่วย
6. ตรวจ Worklist, สืบค้นผล LAB, Accession, RIS, Finance ready, นัดหมาย,
   สารทึบ และการพิมพ์ว่าไม่ถดถอย
7. ตรวจ My Room มีปุ่ม Check-in ด้านขวา; หลังเจ้าของ API แก้ allowlist แล้ว ให้ทดสอบ
   Check-in เข้า `m0900` และตรวจว่า Unit Queue/My Room refresh
8. สร้างเคส skip แล้ว recall และตรวจป้าย `↺` พร้อม tooltip `เรียกกลับ`
9. เปิด `ติดตามคิว`: ตรวจตำแหน่งปัจจุบันหลังย้ายระหว่างชั้น/ห้อง และตรวจสถานะ
   `รอรับ → ตรวจอยู่ → ออกผลแล้ว`; ยืนยันว่าแท็บนี้ไม่มีปุ่มเรียก/ย้าย/start/done

## Static verification

- `test_xray_queue_widget.js` ผ่าน
- `test_xray_queue_deeplink.js` ผ่าน
- `test_xray_cpoe_worklist_form.js` ผ่าน
- `test_xray_queue_api.js` ผ่าน
- `test_xray_cpoe_worklist_api.js` ผ่าน
- `check_sdform_json.py` ผ่าน exit 0
- `git diff --check` ผ่าน

Static validation ยังไม่ใช่หลักฐานว่า Builder/Preview และ runtime live ผ่าน ต้อง import/replace
โดยผู้ใช้และทำ UAT ข้างต้นก่อนประกาศใช้งานจริง
