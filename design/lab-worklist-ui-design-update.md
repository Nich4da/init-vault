---
type: design
title: LAB Worklist UI Design Update
created: 2026-09-11
updated: 2026-09-11
status: approved-implemented
tags: [lab, worklist, ui, sdform, element-plus, dark-mode]
---

# LAB Worklist UI Design Update

เอกสารนี้สรุปการนำ visual pattern ที่ผู้ใช้อนุมัติใน X-ray Worklist มาใช้กับ LAB Worklist เฉพาะส่วนที่ LAB มีโครงสร้างร่วมกัน ไม่เปลี่ยน business rule, status mapping, permission, API action, request payload, selection rule หรือ flow รับ–ปฏิเสธ–ยกเลิก–ออกผลของ LAB

## 1. ขอบเขต

ปรับเฉพาะ:

- สี filter, สถานะระดับ Order และ legend
- สีปุ่ม action ระดับ Item/Detail
- Dark mode ของ tag และสถานะที่เกี่ยวข้อง
- พื้นที่กดเปิด–ย่อแถว Order
- หัวตารางในแท็บ `order` และ `ออกผล`
- checkbox แบบ sticky ขณะเลื่อนตาราง Item แนวนอน
- responsive behavior ของส่วนที่แก้

ไม่นำส่วนเฉพาะ X-ray มาใช้ เช่น ตัวกรองเครื่อง, Accession No., สถานะส่งเข้าเครื่อง หรือ RIS substatus

## 2. สถานะและสีของ LAB

LAB คง 5 สถานะงานเดิม และมี `ทั้งหมด` เป็นตัวกรองรวม:

| ลำดับ | Filter / Order status | ความหมายเดิมของ LAB | สีหลัก |
|---:|---|---|---|
| 1 | `รอรับ` | CPOE Item ยังอยู่สถานะ `sent` | เหลือง `#FADB14` |
| 2 | `รับแล้ว` | `accepted`, `prepared`, `ready` หรือ `dispensed` | ส้ม `#E6A23C` |
| 3 | `ออกผลบางส่วน` | มี Item ที่ `resulted` แต่ Order ยังไม่ครบ | เขียวอ่อน `#95D475` |
| 4 | `ออกผลครบ` | Item ใน Order ครบตามเงื่อนไขเดิม | เขียว `#67C23A` |
| 5 | `ยกเลิก / ปฏิเสธ` | `cancelled` หรือ `rejected` | แดง `#F56C6C` |

`ทั้งหมด` ไม่ใช่ clinical status และยังใช้ primary blue เมื่อถูกเลือก สีใช้ช่วยสแกนข้อมูลเท่านั้น ทุกสถานะต้องมีข้อความกำกับเสมอ

### Legend

แสดงคำอธิบายสีในแถบเดียวกับ filter:

`● รอรับ  ● รับแล้ว  ● ออกผลบางส่วน  ● ออกผลครบ  ● ยกเลิก / ปฏิเสธ`

สีของ legend, filter และ Order status ต้องตรงกัน ห้ามเปลี่ยนจำนวน bucket หรือ mapping ของ API เพื่อให้เหมือน X-ray

### สถานะระดับ Order และ Item

- ระดับ Order แสดงเป็นจุดสีกลมขนาด `10px` ตามด้วยจำนวน Item ในสถานะนั้น แบบเดียวกับ X-ray; ชื่อสถานะอ่านจาก legend
- ถ้า Order มีหลายสถานะ ให้แสดงหลายคู่จุด–จำนวน เช่น เหลือง `1` และส้ม `8`; ไม่ยุบเป็นคำว่า `รอรับ · รับแล้ว`
- ระดับ Item แสดงเป็น textbox/tag มีกรอบและพื้นสีอ่อน โดยใช้สีกรอบหลักตรงกับ legend
- สีประจำสถานะคือ เหลือง `#FADB14`, ส้ม `#E6A23C`, เขียวอ่อน `#95D475`, เขียว `#67C23A` และแดง `#F56C6C`
- ทั้งสองระดับคงข้อความไว้เสมอเพื่อไม่ใช้สีเป็นตัวบอกสถานะเพียงอย่างเดียว
- การเปลี่ยนนี้เป็น presentation เท่านั้น; ค่า `current_status`, `statusText()` และ `statusClass()` ไม่เปลี่ยน

## 3. Dark mode และ tag

- พื้น ตัวอักษร และเส้นขอบอ่านค่าจาก Element Plus theme variables
- tag ความเร่งด่วน, เพศ, หน่วยต้นทาง, การชำระเงิน, สิทธิ์, ยาก่อนหน้า, Order No. และสถานะต้องอ่านง่ายทั้ง Light/Dark mode
- `รอรับ` คงสีเหลือง `#FADB14`; Dark mode ใช้พื้นเหลืองโปร่งและข้อความเหลืองอ่อน
- ไม่ใช้พื้นขาว hard-code กับ tag ในส่วนที่ปรับ

## 4. แถว Order และพื้นที่กด

- คลิกพื้นที่ว่างส่วนใดของแถว Order เพื่อเปิดหรือย่อ detail panel ได้
- ปุ่มลูกศรยังทำงานเดิม
- การคลิก button, link, input, select, checkbox, dropdown หรือ control ภายในแถวต้องไม่ทำให้ Order toggle ซ้ำ
- การปล่อยเมาส์หลังลากเลือกข้อความต้องไม่ toggle แถว
- เมื่อย่อ Order ให้ใช้ behavior เดิมของ `toggleOrder` ซึ่งล้าง selection ที่ซ่อนไว้
- การเปลี่ยนนี้เพิ่ม hit area เท่านั้น ไม่แก้ข้อมูลหรือ action ใด

## 5. ปุ่ม Action ระดับ Item/Detail

| ปุ่ม LAB | Element Plus type | รูปแบบ |
|---|---|---|
| `รับ specimen` | `success` | เขียวทึบ |
| `ปฏิเสธรายการที่เลือก` | `warning` | เหลือง/ส้มทึบ |
| `ยกเลิก order` | `danger` | แดงทึบ |

คง `v-if`, disabled, loading, permission และ click handler เดิมทั้งหมด

## 6. ตารางแท็บ `order`

- หัวตารางสูง `44px`
- background `primary-50`, ตัวอักษรสีหลัก และเส้นบน–ล่าง `primary-light-7`
- หัวตารางชิดเส้นใต้แท็บและเต็มความกว้างของ grid
- grid คงคอลัมน์ LAB เดิมและใช้ `min-width: 1210px`
- checkbox หัวตารางและแต่ละ Item อยู่คอลัมน์แรกกว้าง `42px`
- checkbox ใช้ `position: sticky; left: 0` เมื่อเลื่อนแนวนอน
- sticky cell มีพื้นตาม header, hover และ selected เพื่อไม่ให้ข้อความเลื่อนซ้อนด้านหลัง
- selection, select-all, indeterminate และเงื่อนไขเลือกเฉพาะ Item `sent` ไม่เปลี่ยน

## 7. ตารางแท็บ `ออกผล`

ใช้ pattern เดียวกับแท็บ `order` โดยไม่มี checkbox:

- หัวตารางสูง `44px` และใช้ชุดสีเดียวกัน
- ไม่มีช่องว่างเหนือหัวตาราง
- เว้น gutter ซ้าย `42px` ให้แนวข้อความตรงกับตาราง order
- แถวข้อมูลสูงขั้นต่ำ `52px`
- grid ใช้ `min-width: 772px` เพื่อรักษาความอ่านง่ายเมื่อเลื่อนแนวนอน
- ไม่มี select-all หรือ selection logic ในแท็บออกผล

## 8. Responsive behavior

- Desktop ใช้ตารางแนวนอนและ sticky checkbox
- viewport ไม่เกิน `900px`: ตาราง Item เปลี่ยนเป็น card/grid, ยกเลิก sticky และ reset gutter; ตารางออกผล reset gutter และคง horizontal scroll เท่าที่จำเป็น
- viewport ไม่เกิน `720px`: ซ่อนหัวตารางออกผลตาม pattern เดิม, แถวผลกลับเป็น layout ย่อย และ status strip/legend เลื่อนได้โดยไม่บีบข้อความ

## 9. Acceptance criteria สำหรับ UAT

- [ ] Filter และ legend แสดงสถานะ LAB ครบ 5 กลุ่มและสีตรงกัน
- [ ] สถานะระดับ Order เป็นจุดสีสดตาม legend พร้อมจำนวน Item ไม่แสดงชื่อสถานะซ้ำในแถว
- [ ] สถานะระดับ Item เป็น textbox/tag ที่มีกรอบสีสดตรงกับ legend
- [ ] `รอรับ` เป็นเหลือง, `รับแล้ว` เป็นส้ม, ผลบางส่วน/ครบเป็นเขียวต่างระดับ และยกเลิก/ปฏิเสธเป็นแดง
- [ ] Light/Dark mode อ่าน tag และ status ได้ชัด ไม่มีพื้นขาวจ้าในส่วนที่ปรับ
- [ ] ปุ่มสามปุ่มเป็นสีทึบเขียว/ส้ม/แดง โดย action และ disabled state ยังเหมือนเดิม
- [ ] คลิกพื้นที่ว่างของแถว Order แล้วเปิด–ย่อได้
- [ ] คลิก control ภายในแถวไม่ toggle Order ซ้ำ และการเลือกข้อความไม่ toggle
- [ ] หัวตาราง order/ออกผลสูง สี และระยะเป็น pattern เดียวกัน
- [ ] เลื่อนตาราง order แนวนอนแล้ว checkbox ยังมองเห็นด้านซ้าย
- [ ] หน้าแคบไม่เกิด sticky checkbox บัง card content
- [ ] Receive, Reject, Cancel, Result, PDF/HN/EMR และ status counts ทำงานเหมือนก่อนปรับ design

## 10. Implementation trace

| Artifact | หน้าที่ |
|---|---|
| [`update_lab_cpoe_worklist_ui.js`](../Form-Builder/seed/tests-tools/scripts/update_lab_cpoe_worklist_ui.js) | Source generator ของ template, CSS และ row interaction |
| [`lab-cpoe-worklist-waiting-v1.json`](../Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json) | ไฟล์สำหรับ Replace/Import ใน Form Builder |
| [`test_lab_cpoe_worklist_form.js`](../Form-Builder/API/tests-tools/tests/test_lab_cpoe_worklist_form.js) | Regression tests ของ UI, status mapping และ interaction |
| [`test_lab_cpoe_worklist_api.js`](../Form-Builder/API/tests-tools/tests/test_lab_cpoe_worklist_api.js) | Regression tests ยืนยัน flow/API เดิม |

การเปลี่ยนครั้งนี้ไม่ต้อง Replace LAB API เพราะไม่ได้เปลี่ยน status bucket หรือ data contract ให้ Replace เฉพาะ Form JSON หลังตรวจ Builder/Preview และทำ UAT ตาม checklist ข้างต้น
