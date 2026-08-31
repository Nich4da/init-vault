---
type: checklist
title: LAB CPOE Integration Checklist
created: 2026-08-30
updated: 2026-08-30
status: active
tags: [lab, cpoe, worklist, integration, checklist]
---

# LAB CPOE Integration Checklist

## เป้าหมายรอบนี้

ทำให้ LAB Workbench JSON อ่านใบสั่งจริงจาก `zdata_cpoe_order` และ
`zdata_cpoe_order_item` แยกรายการเข้าห้อง LAB ตาม section และใช้ flow
ระดับ Order/Item ที่พิสูจน์ไว้ใน HTML ต่อได้ โดยไม่สร้างฟอร์มกลางที่ copy
ใบสั่ง CPOE ซ้ำอีกชุด

## ข้อตกลงที่ยืนยันแล้ว

- [x] `CPOE Order` เป็นหัวใบเดียวของโรงพยาบาลและเป็นขอบเขตระดับการเงิน
- [x] หนึ่ง Order มี Item ได้หลาย LAB section
- [x] LAB NO. สร้างตอนรับ specimen และหนึ่งเลขต่อหนึ่ง CPOE Item
- [x] Worklist routing ใช้ section ของ Item เป็นแกน
- [x] Organization ใช้กำหนดสิทธิ/ห้องของผู้ใช้ แล้วแปลงเป็น section ที่มองเห็นได้
- [x] Specimen ผูกกับ Item และต้องบันทึกตั้งแต่ตอนสั่ง
- [x] รายการที่ LAB ปฏิเสธและต้องตรวจใหม่ให้สร้าง Order/Item ใหม่ โดยเก็บลิงก์กลับรายการเดิม
- [x] ผลตรวจละเอียดใช้ Result Receipt, Result Report และ Result Item ที่มีอยู่แล้ว
- [x] การรับ JSON ผลจาก Agent ใช้ `hl7_result_upsert_api.js`; ไม่สร้าง result persistence ซ้ำ
- [x] การแก้ผลใช้ current-value overwrite: ทับค่าผลเดิมและทับชื่อ/เวลาเป็นผู้แก้ล่าสุด
  ไม่เก็บรายชื่อผู้แก้ก่อนหน้าใน clinical Result Item
- [x] Technical Receipt ของ Agent ยังคงใช้รับ payload/deduplicate แต่ไม่ใช้แสดง correction history
- [x] Diagnosis ดึงจาก EMR การรักษาของ VN และเปิดผ่านปุ่ม EMR ที่แนบกับแต่ละ Order

## หลักฐานจาก CPOE ปัจจุบัน

- [x] Order `_id=6a9422bf422c1ca959829d56` เป็น Lab, `sent`, มี 2 Items
  (C2 Total Protein และ C3 Albumin)
- [x] Item อ้าง master ด้วย `item_data_id`; transaction ยังไม่มี section/LIS mapping snapshot
- [x] Master ของ C2/C3 ชี้ section `BC`; `zdata_section` ชี้ unit `10 Biochemistry`
  และ Organization parent `LAB`
- [x] Order ล่าสุดมี `R...` order number และ `order_to_location=m01.p`; ห้ามใช้สอง field
  นี้เป็น LAB routing จนกว่า CPOE owner จะแก้ contract
- [x] `lab_data` ของ Order ล่าสุดเป็น `null` แม้ master item มี specimen; ต้องตรวจ save/send path

### Panel / set behavior ที่พบจริง

- [x] แบบ `sub_order` (group): master head เก็บ `sub_order.value` เป็น array ของ child codes
  เช่น C25-CD → C25.1-CD ถึง C25.4-CD
- [x] CPOE App แตก group เป็นหลาย cart lines และ DB มี 4 `CPOE Order Item` จริง
- [x] Transaction children ปัจจุบันไม่เก็บ `set_code`, parent code หรือ array ที่บอกว่า 4 Item
  มาจากการสั่งชุดเดียวกัน; ความสัมพันธ์หายหลัง save
- [x] แบบ `lab_parent` (exclusive): C1 LFT และลูกเป็นทางเลือกแทนกัน (parent XOR child)
  ตาม CPOE App; ไม่ใช่กติกาแตก child แบบ `sub_order`
- [ ] ทดสอบสั่ง C1 จริงหนึ่งครั้งและยืนยัน DB ว่าเก็บ C1 เดี่ยวตามกติกา exclusive
- [ ] ตกลงว่าจะเก็บ `ordered_as`/`set_code` snapshot ใน Item เพื่อรักษา provenance ของชุด

## สถาปัตยกรรมที่ใช้เดินงาน

```text
LAB Workbench JSON
  → lab-cpoe-worklist API
    → query CPOE Order Item (service_type=lab)
      → join CPOE Order เพื่อข้อมูลหัวใบ/ผู้ป่วย/การเงิน
      → ใช้ item.section_snapshot ถ้ามี
      → fallback join zdata_master_item_order.section
      → join zdata_section.unit / Organization เพื่อ routing และสิทธิ

รับ specimen ราย Item
  → LAB receive API สร้าง LAB NO. แบบ atomic
  → update CPOE Order Item

รับผล
  → Agent → hl7_result_upsert_api.js
  → Receipt → Result Report → Result Item
  → Workbench อ่าน Report/Items ด้วย LAB NO. / CPOE Item reference
```

ไม่สร้าง Lab Order mirror หรือฟอร์มกลางสำหรับ copy CPOE Order/Item

## P0 — ทำก่อนเพื่อปลดล็อก LAB JSON

### 1. Freeze read contract

- [x] หน่วย worklist/routing = CPOE Item
- [x] หน่วย grouping บนหน้าจอ = CPOE Order
- [x] route หลัก = `section_id`/`section_code`
- [x] Organization เป็น access mapping ไม่ใช่ replacement ของ section
- [x] canonical route key ใช้ section ObjectId พร้อม snapshot code; API คืนทั้ง id/code
- [x] API คำนวณ allowed sections จาก Organization context; UI ไม่ให้ผู้ใช้เลือกห้องซ้ำใน Form

### 2. สร้าง `lab-cpoe-worklist` read API

- [x] รับ allowed section codes จาก authenticated Organization unit context แบบ fail-closed
- [x] เริ่ม query ที่ `zdata_cpoe_order_item`
- [x] filter `service_type.value='lab'`
- [x] filter Item status สำหรับ tab รอรับ (default `sent`)
- [x] join `zdata_cpoe_order` ด้วย `order_id.value`/`xparentx`
- [x] route ด้วย `section_snapshot`; ถ้ายังไม่มีให้ fallback ผ่าน `item_data_id` ไป master
- [x] join `zdata_section` และรับเฉพาะ `enable=true`
- [x] group response กลับเป็นหนึ่ง Order พร้อม `items[]`
- [x] ห้าม parse HN/ชื่อจาก `order_id.label`; ใช้ structured `order.vid`
- [x] รองรับ date range, exact HN search, priority และ pagination
- [ ] ทดสอบ deployed runtime ว่าไม่คืนข้อมูลข้าม section ที่ผู้ใช้ไม่มีสิทธิ

### 3. กำหนด response ขั้นต่ำสำหรับหน้า HTML/JSON

- [x] Order: `order_id`, `order_number`, `requested_at`, patient/visit snapshot,
  priority, coverage/financial summary, aggregate display status
- [x] Item: `item_id`, code/name, quantity, section id/code/name, organization unit,
  specimen snapshot, current status, LAB NO., received/rejected metadata
- [x] Panel provenance: `ordered_as`, `set_code`/`parent_code` เมื่อมี; ปัจจุบัน fallback จาก master
- [ ] Result summary: report reference, result status, latest result version
- [x] EMR context: VN และ visit id สำหรับเปิด EMR ของ Order

### 4. พิสูจน์ API ก่อนผูก UI

- [x] Pipeline regression ยืนยันว่ากรอง `resolved_section.code` ระดับ Item ก่อน group Order
  จึงคง Order ID/number เดิมและแยก Item ต่อห้องได้ (deployed multi-room UAT ยังรอ)
- [x] Read-only pipeline พบ C25-CD child 4 Item ครบและ derive `set_code=C25-CD` ได้
- [x] รายการที่ `lab_data=null` ถูกคืน `specimen.complete=false` ไม่เดา specimen ที่เก็บจริง
- [x] default query รับเฉพาะ `sent`; cancelled/rejected ไม่เข้าคิวรอรับ
- [ ] ไม่มีข้อมูลผู้ป่วยหรือ section อื่นรั่วข้ามสิทธิ

## P1 — แก้ CPOE แบบ additive ก่อน production

เจ้าของหลักคือ `cpoe-order-save`/`cpoe-order-send`; งานนี้ไม่ควรแก้ด้วยฟอร์มกลาง

Local Step 1 artifact: `Form-Builder/API/api-factory/processes/lab_cpoe_worklist_api.js`
พร้อม test `Form-Builder/API/tests-tools/tests/test_lab_cpoe_worklist_api.js` (ผ่าน local harness)

- [x] ผู้ใช้สร้าง API Factory process แล้ว: `6a9434c3422c1ca959829d5e`
- [ ] ยืนยันว่า body ใน process ที่ deploy ตรงกับ local artifact และทดสอบ response จริงด้วยบัญชี LAB

- [ ] เพิ่ม Item `section_snapshot`: id, code, name, ref_code, unit code/name
- [ ] เพิ่ม Item `lab_mapping_snapshot`: master id/version, HIS/LIS order code, c_test,
  specimen code/name และ mapping version
- [ ] เพิ่ม Item panel provenance: `ordered_as`, `set_code`, `parent_code`, `set_kind`
- [ ] ทำให้ specimen จาก master + ข้อมูลเก็บจริง persist ลง `lab_data` ทุก Item ที่ต้องใช้
- [ ] ยืนยัน mapping ชื่อ payload `source/storage/at/by/by_id` กับ field ที่บันทึก
  `spec_source/ship_storage/specimen_at/specimen_by`
- [ ] แก้ Lab order prefix/location ที่ปัจจุบันได้ `R...` และห้องยาพรีเมี่ยม
- [ ] เพิ่ม validation: ห้าม send Lab Item ที่ขาด section, specimen หรือ LIS mapping ที่จำเป็น
- [ ] เก็บ snapshot ตอน `sent`; ห้ามเปลี่ยนย้อนหลังตาม master ปัจจุบัน

## P2 — ผูก LAB Workbench JSON ตาม HTML

- [x] สร้าง local candidate `Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json`
- [x] เริ่มหน้า `รอรับ` โดยผูก API Process `6a9434c3422c1ca959829d5e`
- [x] filter ห้องจาก authenticated organization → allowed sections ผ่าน API แบบ fail-closed
- [x] group หน้าจอเป็น Order แต่ checkbox/action ทำระดับ Item
- [x] ใช้ Order/Item IDs จาก API; ไม่อ่าน state จาก DOM หรือ label
- [x] จัดโครง interaction, filters, expansion และ responsive behavior ตาม HTML/design contract ใน local JSON
- [x] จำกัดข้อความสรุปหน้า UI เป็น `แสดง X Order จากทั้งหมด Y`; ไม่แสดง section หรือข้อความ technical/read-only
- [x] ใช้โครง/สเกล Drug & Stock > Stock สำหรับ toolbar, status chips, list header,
  expandable row และรายละเอียด Item แบบ grid เส้นคั่นบาง; ไม่มี boxed table
- [x] ชื่อแพทย์บน worklist แสดงเฉพาะชื่อและตัด email suffix ออก
- [x] อายุแสดงค่าจาก snapshot ตรงตัว เช่น `3y 3m 3d` โดยไม่คำนวณใหม่จากวันเกิด
- [x] ไม่มี Section dropdown; App Organization เป็นตัวกำหนดห้องและเปลี่ยนแล้ว reload อัตโนมัติ
- [x] specimen เป็น searchable dropdown และ persist ค่าใหม่ผ่าน Worklist API ลง
  `lab_data.spec_source/spec_source_code` โดยคงข้อมูลเวลา/ผู้เก็บเดิม
- [x] ปุ่มรับ specimen เชื่อม Receive Process `6a94f634422c1ca959829d70`, บังคับเลือก
  ครั้งละ 1 Item, ตรวจเวลาเก็บก่อนเรียก และแยกข้อความ “รับแล้วแต่ Agent ส่งไม่ผ่าน”
  ออกจากกรณีรับไม่สำเร็จ; deployed Builder/runtime UAT ยังรอ
- [x] ปุ่มสร้างรายการเปิด CPOE Order App `6a927860422c1ca959829d26` ในโหมดเลือก VN เอง
  และ CPOE App แสดง patient/EMR-style card ของ Visit ที่เลือก
- [x] ปุ่ม EMR เปิด Form `6a4f64e7f8cdfc54cec16488` แบบ read-only และ deep-link ด้วย Visit ID ของ Order
- [x] responsive: desktop เป็น aligned grid, tablet ยุบหัวตาราง และ mobile reflow Order/Item เป็นสอง/หนึ่งคอลัมน์
- [x] validate Worklist, CPOE App และ EMR source ด้วย `check_sdform_json.py` (ผ่าน 2026-08-30)
- [ ] ตรวจ Builder/Preview และ runtime query จริง

## P3 — Receive / reject / reorder ระดับ Item

- [x] สร้าง local atomic LAB NO. generator ต่อ CPOE Item พร้อม idempotency จาก `item_id`:
  `Form-Builder/API/api-factory/processes/lab_no_generate_api.js`; รูปแบบ `SSYY######`,
  counter แยก section + ปี พ.ศ., ขึ้นปีใหม่เริ่ม `000001`, overflow วน `000001`
  แต่ fail-safe หากเลขที่วนมายังใช้งานอยู่; Process ID `6a94f1ed422c1ca959829d6e`
  สร้างแล้ว แต่ deployed body/runtime UAT ยังรอ
- [x] สร้าง local Receive API: validate outbound data + `sent` → เรียก LAB NO. generator →
  set Item `accepted` + audit received time/user/location → ส่ง Agent นอก transaction → เก็บ
  transport outcome โดยไม่ rollback การรับเมื่อ Agent ล้มเหลว:
  `Form-Builder/API/api-factory/processes/lab_cpoe_receive_api.js`; Process ID
  `6a94f634422c1ca959829d70`; สร้างแล้วและเชื่อม local Form แต่ deployed body/runtime UAT ยังรอ
- [x] local test ป้องกัน double-click/retry ไม่ให้ได้ LAB NO. ซ้ำหรือส่งซ้ำเมื่อ Item queued แล้ว
- [x] v1 ใช้ `master.lab_item.his_lab_code` เป็น outbound `test_code` เพียงแหล่งเดียวและ
  fail ก่อนรับถ้าไม่มีค่า; ไม่ fallback เป็น `c_test` โดยเงียบ
- [x] fail-closed เมื่อ Order เดิมมี Item อื่น queued แล้ว เพราะ Agent ปัจจุบัน dedupe ทั้ง
  `order_no`; ยังต้องแก้ Agent contract ก่อนรองรับ Item ถัดไปของ Order เดิม
- [ ] Reject API: เก็บ reason/user/time และชนิดเหตุการณ์ `specimen_rejected`
- [ ] ถ้าใช้ `current_status=cancelled` ร่วมกับ EMR cancellation ต้องมี `cancel_type`
  แยก `requester_cancelled` กับ `specimen_rejected`
- [ ] `ตรวจใหม่`: สร้าง CPOE Order/Item ใหม่และเก็บ `reorder_of_order_id`/
  `reorder_of_item_id`; ห้ามแก้หรือลบประวัติเดิม
- [ ] ตกลงผลกระทบการเงินของ Item เดิมและ Item ใหม่กับ CPOE/การเงิน

## P4 — Result tab ใช้ของที่มีอยู่แล้ว

- [x] Technical Receipt form candidate มีแล้ว
- [x] Result Report form candidate มีแล้ว
- [x] Result Item form candidate มีแล้ว
- [x] Result Viewer และ `hl7_result_upsert_api.js` มี regression test แล้ว
- [ ] ปรับ result persistence เดิมจาก append stage snapshots เป็น current-value overwrite ตาม
  ข้อตกลงล่าสุด โดยคง Technical Receipt สำหรับรับ payload/deduplicate
- [ ] Result Item เดิมถูก update ด้วยค่าล่าสุด; `edited_by`/`edited_at` ถูกทับเป็นผู้แก้ล่าสุด
- [ ] ไม่สร้าง `edit_history_json` สำหรับการแก้ผลใน LAB UI และไม่แสดงผู้แก้ก่อนหน้า
- [ ] ปรับ regression tests ที่ปัจจุบันคาดหวัง partial/final/corrected แบบ append-only
- [ ] Deploy API body รุ่นที่ปรับแล้วและทำ safe UAT
- [ ] Workbench join result ด้วย LAB NO. และ stable CPOE Item reference
- [x] Local Worklist candidate เพิ่ม Manual Result dialog เฉพาะ Item `section.code=MY`
  และเฉพาะสถานะหลังรับ specimen (`accepted` ถึง `resulted`); M1005 ที่เห็นทั้ง MB+MY
  ไม่ทำให้ MB ได้สิทธิ Manual
- [x] Local Worklist API รองรับ `get_manual_result` / `save_manual_result` โดยผูก
  Result Item เดิมกับ stable `source_item_id`, ตรวจ Organization/section ซ้ำฝั่ง server,
  และรับ result value/unit/interpretation/reference range แบบ optional ทั้งหมด
- [x] Previous result lookup ใช้ HN + test code, ตัด CPOE Item ปัจจุบัน และคืน VN/เวลา
  ของผลก่อนหน้าล่าสุดเพื่อแสดง read-only; deployed runtime/UAT ยังรอ
- [ ] แสดง partial/final/corrected จาก Report/Result Item; ไม่สร้าง result master ใหม่
- [ ] CPOE Item เก็บเพียง result summary/reference ถ้าต้องใช้กรองเร็ว
- [ ] ทดสอบ real order: partial → final → corrected → duplicate retry

## Header status เมื่อ Item ไปคนละจังหวะ

ตัวอย่าง Order เดียวมี BC และ HM: BC อาจรับ specimen/ออกผลแล้ว ขณะที่ HM ยังรอรับ
ดังนั้นสถานะทำงานจริงต้องอยู่ที่ Item และหน้าจอคำนวณ aggregate จาก Item

- [ ] ตกลงกับ CPOE/การเงินว่า Order header ใช้ generic state ใด
- [ ] ห้ามเปลี่ยน Order เป็น complete เมื่อยังมี Item ที่ไม่ terminal
- [ ] ห้ามให้การรับ Item แรกทำให้ Item อื่นเปลี่ยนเป็น accepted
- [ ] cancellation ระดับ Order ต้อง cascade ทุก Item แบบ atomic ตาม contract เดิม

## รายการค้าง / ต้องถาม

- [x] Diagnosis มาจาก EMR treatment ของ VN; Workbench ใช้ VN/visit reference เปิด EMR ต่อ Order
- [x] ยืนยัน EMR Form `6a4f64e7f8cdfc54cec16488` และ Visit Tran Form `6a461235e521219e514d1c4b`
  สำหรับปุ่มเปิด EMR ของ Order; deployed deep-link runtime ยังรอทดสอบ
- [ ] ยืนยัน field ของ diagnosis summary หากต้องการแสดงบรรทัด Diagnosis บน Worklist
- [ ] C1 exclusive parent ต้องมี required LIS result components ใดบ้าง
- [ ] ยืนยันกับ Agent/LIS ใน UAT ว่า outbound `test_code=his_lab_code` route ได้จริง
- [ ] inbound `obs_code` เท่ากับ order code หรือเป็น result component code
- [x] การแก้ผลไม่สร้าง corrected history ใน clinical Result Item; ค่าผลและผู้แก้ล่าสุดถูกทับ
- [ ] ตกลงว่า CPOE Item จะคง `result_status=complete` และเพียง refresh `result_updated_at`
  หรือใช้ flag อื่นสำหรับบอกว่ามีการแก้ผล โดยไม่เก็บประวัติผู้แก้
- [ ] exact Organization → allowed section mapping และ RBAC source

## UAT Orders ที่ขอให้สร้าง

ใช้ผู้ป่วยทดสอบ/UAT และส่งใบให้ถึงสถานะ `sent`; ไม่ส่ง identifier ผู้ป่วยในเอกสารหรือแชต

- [ ] Order A — สั่ง `C1 Liver Function Test` เพียงรายการเดียว เพื่อพิสูจน์ว่า exclusive
  parent ถูกเก็บเป็น C1 เดี่ยวหรือแตก child
- [ ] Order B — สั่ง `C25-CD Electrolyte จาก Clotted blood` เพียงชุดเดียว กรอก specimen
  และส่งใบ เพื่อพิสูจน์ group child 4 รายการพร้อม `lab_data`
- [ ] Order C — สั่งข้าม section ใน Order เดียว: `C2 Total Protein` (BC) + `MS1 CBC`
  (Hematology) กรอก specimen ทั้งสองและส่งใบ เพื่อพิสูจน์ Item routing หลายห้อง
- [ ] ส่งเฉพาะ Order `_id` ของทั้งสามใบให้ตรวจ DB แบบ read-only

## Definition of done สำหรับเริ่ม flow ต่อจาก HTML

- [ ] API คืน Order จริงโดยไม่เปิดเผยข้ามห้อง
- [ ] Item ทุกตัวมี section/specimen ที่เชื่อถือได้หรือถูก flag ว่าข้อมูลไม่ครบ
- [ ] หน้า `รอรับ` ของ LAB JSON แสดง Order จริง แยกห้องถูกต้อง และ action ระดับ Item
- [ ] IDs พร้อมสำหรับ receive API และ LAB NO. generator
- [ ] Result tab ชี้ไป persistence เดิม ไม่สร้างข้อมูลผลซ้ำ

## References

- Worklist entry points reuse the existing main Forms: CPOE Order App
  `6a927860422c1ca959829d26` and EMR `6a4f64e7f8cdfc54cec16488`. The JSON files
  below are working definitions for updating those Forms in place, not new Form
  records to import under new IDs.
- `Form-Builder/SDForm/sdform_module/EMR_form/CPOE_app.json`
- `Form-Builder/SDForm/sdform_module/EMR_form/CPOE Order.json`
- `Form-Builder/SDForm/sdform_module/EMR_form/CPOE Order Item.json`
- `Form-Builder/SDForm/sdform_module/EMR_form/section.json`
- `design/Lab_design.md`
- `design/Lab_implementation-handoff.md`
- `02-his/handoff/lab-result-api-readiness.md`
- `Form-Builder/API/api-factory/processes/hl7_result_upsert_api.js`
