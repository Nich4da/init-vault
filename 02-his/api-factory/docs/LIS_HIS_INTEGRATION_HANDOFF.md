# HIS-LIS Integration — Persistent Handoff

อัปเดตล่าสุด: 23 สิงหาคม 2569 (Asia/Bangkok)

## Resume trigger

อ่านไฟล์นี้ทั้งไฟล์ก่อนทำงานที่กล่าวถึง LISconnect, HIS→LIS, LIS→HIS,
`his-order-sample.json`, `his-result-sample.json`, `.req`, `.res`, OBR/OBX,
`order_no`, `labno`, `his_code_id`, `test_code`, `obs_code`, CPOE-LIS mapping,
Partial/Final/Corrected Result หรือการวาด flow การเชื่อม LIS

## แหล่งข้อมูลจริง

- `/Users/nichada/Documents/LIS/his-order-submit-spec.md`
- `/Users/nichada/Documents/LIS/his-order-sample.json`
- `/Users/nichada/Documents/LIS/his-result-sample.json`

เอกสารสเปกลงวันที่ 6 สิงหาคม 2569 และไม่รวม Blood Bank

## ไฟล์ไดอะแกรมล่าสุด

- ฉบับใช้นำเสนอ เข้าใจง่าย และควรใช้เป็นค่าเริ่มต้น:
  `LIS_HIS_Integration_Flow_Simple.mmd`
- ฉบับละเอียดสำหรับอ้างอิงทางเทคนิค:
  `LIS_HIS_Integration_Flow.mmd`
- คำอธิบายและรายการคำถาม:
  `LIS_HIS_Integration_Flow_Notes.md`

ผู้ใช้ยืนยันว่าต้องการไดอะแกรมเรียบง่าย ไม่ตกแต่งมาก และไม่ทำเป็นเส้นยาว
ฉบับง่ายจึงแบ่งเป็นสองคอลัมน์: HIS ส่งคำสั่งตรวจ และ LIS ส่งผลกลับ

## Flow ที่ยืนยันจากสเปก

### HIS ส่งคำสั่งตรวจไป LIS

1. HIS สร้าง `order_no` และ `labno` ก่อนส่ง
2. HIS ส่ง JSON ไป `POST {AGENT_URL}/api/orders`
3. Header ใช้ `X-Agent-Key` และ `Content-Type: application/json`
4. LISconnect ตรวจ authentication, JSON, `labno`, `items[]` และ routing
5. เมื่อ commit ลง Queue สำเร็จ ตอบ `202 Accepted`; HIS เปลี่ยนสถานะเป็น
   `queued`
6. ถ้า `order_no` เคยรับแล้ว ตอบ `200` กับ `duplicate:true`; ถือว่าสำเร็จ
   และห้ามสร้างไฟล์ซ้ำ
7. LISconnect แปลง JSON เป็น HL7 `ORM^O01` แล้วสร้าง `.req` แบบ TIS-620
8. LIS รับ `.req`, ลงทะเบียนด้วย Lab No. และดำเนินการตรวจ

`order_no` เป็น idempotency key ของขาส่ง สามารถ retry ได้อย่างปลอดภัย

ข้อมูลรายการตรวจใน transport contract ปัจจุบัน:

```text
items[].seq
items[].test_code
items[].test_name
items[].specimen_code
items[].specimen_name
items[].collector_code
items[].collector_name
```

`priority` อยู่ระดับ header แต่ LISconnect กระจายไปทุก OBR-5

### LIS ส่งผลกลับ HIS

1. LIS สร้างไฟล์ `.res`
2. LISconnect อ่านและ parse `.res`
3. LISconnect map HL7 Result เป็น JSON
4. LISconnect เรียก
   `POST {baseUrl}/v1/process/{hl7_result_upsert_pid}` ด้วย Bearer JWT
5. HIS จับคู่ด้วย `filler_order_no` ซึ่งเป็น Lab No. แล้วตรวจร่วมกับ
   `order_no` และ `visit_id`
6. HIS กันผลซ้ำด้วย `result_uid`
7. รายงานหลายรอบต้อง append ตาม `report_seq` และ `stage`; ห้ามทับรายงานเดิม
8. Correction ต้องเพิ่ม `result_version` และเก็บประวัติค่าเดิม
9. ผลบางรายการออกก่อน ให้สถานะ `ออกผลบางส่วน`; เมื่อรายการที่จำเป็นครบให้
   `ออกผลครบ`

ข้อมูลผลใน transport contract ปัจจุบัน:

```text
items[].obs_code
items[].obs_name
items[].value
items[].units
items[].ref_range
items[].obx_status
items[].change_kind
items[].receipt_seq
items[].result_version
items[].critical_low_rule
items[].critical_high_rule
```

`receipt_seq` คือจำนวนครั้งที่รับ message ไม่ใช่ result version

## Status synchronization

LISconnect เรียก HIS process `hl7_order_status_sync` แยกจาก result upsert

สถานะที่ HIS ต้องรองรับ:

```text
new
queued
sending
sent
in_progress
resulted
stalled
failed
cancel_requested
cancelled
cancel_rejected
```

`awaiting_result` และ `ack_err` สงวนไว้สำหรับ MLLP phase ภายหลัง

## Error behavior

- `400`, `413`, `415`: ข้อมูลหรือ request ผิด ไม่ retry แบบเงียบ
- `401`, `403`: หยุดส่งและแจ้งผู้ดูแล
- `422`: mapping/order ไม่ผ่าน ต้องแสดงเหตุผลให้ผู้ใช้แก้; ห้ามส่งบาง item
- `500`, `503`: เก็บสถานะ `new` และเข้า retry/reconcile ภายหลัง
- อักขระที่ TIS-620 รองรับไม่ได้ทำให้ทั้ง order ล้มและเข้า DLQ; ห้ามสร้าง
  ไฟล์บางส่วน
- เวลาใน payload ต้องเป็นเวลาไทย หรือ ISO ที่มี `+07:00`; ห้ามส่ง UTC `Z`
  แล้วให้ปลายทางตีความเป็นเวลาไทย

## Critical result ownership

LISconnect ส่ง `critical_low_rule` และ `critical_high_rule` เป็นข้อมูลดิบ
แต่ไม่ตัดสิน Critical เอง HIS เป็นผู้ประเมิน/แจ้งเตือนตามกติกาที่ Lab อนุมัติ
ห้ามสร้าง threshold, unit หรือ reference range จากการคาดเดา

## CPOE-LIS mapping decisions

ผู้ใช้ยืนยันแล้ว:

1. CPOE Item หนึ่งรายการสามารถส่ง LIS ได้หลายรหัส
2. Item ที่ mapping LIS ไม่ครบต้องห้ามสั่ง ไม่ให้สั่งแบบ Manual เพื่อเลี่ยง
   error ตอนส่ง LIS
3. Master ต้องแก้ไข/เติม mapping ภายหลังได้ตลอด
4. HIS ต้องส่ง `his_code_id` ตาม requirement จากทีม Center Lab/LIS

ดังนั้น mapping ควรเป็นตารางลูกหนึ่งต่อหลาย ไม่ควรเก็บ LIS code เดียวใน
CPOE Item record หลัก

## Contract gaps ที่ห้ามเดา

สเปกและ JSON ปัจจุบันไม่มี field ชื่อ `his_code_id`, `lis_code_id`, `TMLT`
หรือ `c_specimen` โดยตรง ต้องยืนยันกับทีม integration ก่อนล็อก schema:

1. `items[].test_code` คือ `his_code_id`, LIS order code หรือรหัสชุดอื่น
2. `items[].obs_code` ใช้รหัสเดียวกับ `test_code` หรือเป็น result component
3. `c_specimen` map ไป `items[].specimen_code` ใช่หรือไม่
4. TMLT เป็นข้อมูล Master-only หรือต้องเพิ่มใน API contract
5. หนึ่ง order item แตกเป็น OBX/result component ได้กี่รายการ และ component
   ใดบังคับก่อนถือว่าผลครบ

## Result persistence rules

- ห้าม match result ด้วย `labno` อย่างเดียว
- ใช้ `result_uid` สำหรับ message idempotency
- ใช้ `report_seq`, `stage`, `obs_code` และ stable source key แยกรายงาน/ผลย่อย
- ผล Preliminary อาจไม่มีผู้รับรอง
- ผล Final ต้องเก็บผู้รายงานและผู้รับรองจาก LIS
- ถ้า identity จาก LIS ยัง map ผู้ใช้ HIS ไม่ได้ ให้เก็บเป็น
  `unmapped_identity`; ห้ามทิ้งผล
- แสดงผลทุก report stage และเก็บ correction/audit แบบ append-only

## Cancellation

- ยังไม่ส่ง: ยกเลิกใน HIS ได้
- ส่งแล้วและยังไม่มีผล: ส่งไฟล์ยกเลิก `ORC-1=CA`
- มีผลแล้ว: ตอบ `409 cancel_rejected`, แสดงให้ผู้ใช้ทราบ และไม่ retry เงียบ

## Safety

- แยก Order, Specimen และ Result ไม่ให้ใช้ identifier ปนกัน
- ไม่คัดลอก HN, ชื่อผู้ป่วย หรือผลจริงลง memory/skill/diagram
- ไม่ claim ว่า integration ใช้งานจริงจนผ่าน end-to-end test
- ไม่เปลี่ยน receive, reject, specimen, status, priority, search หรือ ListView
  เดิมเพียงเพราะเพิ่ม LIS integration

## HIS–Agent schema checkpoint — 2026-08-23 evening

ผู้ใช้ล็อกขอบเขตงานรอบนี้ไว้เฉพาะ HIS ↔ Agent ไม่ออกแบบส่วนหลัง Agent

Contract decisions ที่ยืนยันเพิ่ม:

1. HIS เรียก `POST /api/orders` หลังเจ้าหน้าที่ห้อง Lab กดรับ specimen และ
   HIS บันทึก `collected_at`, `received_at`, `receiver` แล้ว
2. `items[].test_code` ส่งค่า `his_code_id`
3. Result `items[].obs_code` ใช้ค่าเดียวกับ `test_code`/`his_code_id`
4. Order Item ต่อ Result Component เป็น 1:1
5. `report_seq`, `receipt_seq`, `result_version` เป็น string บน wire
6. ผลทยอยออกใช้ `overall_status = in_progress`; ผลครบใช้ `resulted`
7. `critical_low_rule`/`critical_high_rule` มีค่าเมื่อ Result นั้น Critical;
   HIS เก็บ/แจ้งเตือนและไม่คำนวณ threshold ซ้ำ ตามคำยืนยันของผู้ใช้ในรอบนี้

Artifacts ล่าสุด:

- `HIS_AGENT_Interface_Schema.md`
- `HIS_AGENT_Interface_ERD.mmd`
- `HIS_AGENT_Interface_Sequence.mmd`
- `HIS_AGENT_Interface_Easy.drawio` — ฉบับอ่านง่ายตามรูปแบบ `fa-design.drawio`;
  มีหน้า Flow Overview และ Field Mapping
- `schemas/his-to-agent-order.schema.json`
- `schemas/agent-to-his-order-response.schema.json`
- `schemas/agent-to-his-result.schema.json`

Implementation notes:

- ฟอร์ม Manual เดิมใช้ internal status `processing/resulted/completed`; adapter
  ต้อง map Agent `in_progress/resulted` โดยไม่ทำลาย Manual flow
- Agent sequence fields เป็น string แต่ฟอร์มเดิมบาง field เป็น Number Input;
  normalize ที่ adapter และเก็บ raw wire value/audit
- `result_uid` เป็น message idempotency key จึงควรมี receipt/audit แบบ append-only
  ไม่เก็บไว้เฉพาะช่อง header ที่ถูกเขียนทับได้
- ยังไม่มี official JSON sample ของ `hl7_order_status_sync`; ห้ามเดาชื่อ field
  และชนิดข้อมูลจน Agent ส่ง contract/sample

## Inbound result receipt form — 2026-08-23

เพิ่ม artifact สำหรับเตรียมรับผลจาก Agent โดยยังไม่แตะฟอร์ม Manual เดิม:

- `Lab_Result_Inbound_Receive.json` — initCraft form JSON สำหรับ technical receipt
  หนึ่ง record ต่อหนึ่ง `result_uid`
- `Lab_Result_Inbound_Receive_Design.md` — mapping จาก Agent result schema,
  internal processing fields, status mapping และขอบเขตงานรอบนี้

แบบที่เลือกคือรับ message ลง append-only receipt ก่อน แล้ว adapter จึง materialize
เข้า Result Report/Result Item เดิม ฟอร์ม receipt ไม่ Join Parent Form เพราะต้องเก็บ
ข้อความ unmatched/duplicate/error ได้ด้วย รุ่นที่ Import สองรอบยังไม่ผ่านการ render
widget ใน Builder/Preview จึงห้ามกล่าวว่าใช้งานจริงแล้ว

### Preview correction

ผู้ใช้ Import รุ่นแรกแล้วพบว่า Builder เห็น input แต่ Preview แสดงเฉพาะหัว Card
สาเหตุคือวาง widget ใต้ `Card.fields` โดยตรง รุ่นปัจจุบันแก้เป็น
`Layout -> Grid Col -> Card -> Layout -> Grid Col -> Widget` และเพิ่ม `id` ให้
container ทุกชั้นแล้ว โดยเก็บรุ่นผิดไว้ที่
`Lab_Result_Inbound_Receive_Broken_CardOnly.json` ห้ามถือว่ารุ่นแก้ Preview ผ่าน
จนกว่าผู้ใช้จะ Import และตรวจใหม่

ผู้ใช้ให้ตัวอย่าง SDForm ขนาดใหญ่สำหรับอ้างอิงโครง container และขอเก็บชื่อ
`person.json`; ไฟล์นี้เป็นสำเนา byte-for-byte จากต้นฉบับ local
`/Users/nichada/Documents/init-vault/HIS/sdform_module/person_form.json`

### Template rebuild after second failed screenshot

หลักฐานรอบสองแสดง Grid Col แต่ widget ส่วนใหญ่ไม่ render รุ่นนั้นยังสร้าง `key`
970xx/980xx เองและมี widget options ไม่ครบ จึง rebuild ด้วยการ clone component
template จาก working exports แทนการเขียน node แบบย่อ:

- `build_lab_result_inbound_receive.js` สร้าง artifact ปัจจุบัน
- `test_lab_result_inbound_receive.js` ตรวจ syntax, component keys/options,
  hierarchy, visibility, wire types และ JSON Schema mapping
- `Lab_Result_Inbound_Receive_Failed_Preview_2026-08-23.json` คือหลักฐานรุ่นที่ล้มเหลว

Static build/tests ผ่านแล้ว แต่ live Builder/Preview ยังเป็น mandatory test และยังไม่ผ่าน
การยืนยัน ห้ามส่งต่อว่า ready/working จนมีหลักฐาน runtime
