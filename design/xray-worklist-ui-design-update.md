---
type: design
title: X-ray Worklist UI Design Update
created: 2026-09-11
updated: 2026-09-11
status: approved-implemented
tags: [xray, worklist, ui, sdform, element-plus, dark-mode]
---

# X-ray Worklist UI Design Update

เอกสารนี้สรุปการปรับ Design ของหน้า X-ray Worklist ที่ผู้ใช้ตรวจจากหน้าจอจริงและอนุมัติเมื่อวันที่ 11 กันยายน 2569 ใช้เป็น UI supplement ของ [`Xray_design.md`](./Xray_design.md) สำหรับหัวข้อที่ระบุด้านล่างเท่านั้น ไม่เปลี่ยน business rule, สิทธิ์, API action หรือ flow อื่นที่ทำเสร็จแล้ว

## 1. เป้าหมาย

- ทำตัวกรองเครื่องให้ใช้งานได้เมื่อเลือกหลายค่า โดยไม่ดัน control อื่นออกจาก toolbar
- ทำสถานะของ Order อ่านเป็นลำดับเดียวกันทั้ง filter, legend และรายการ
- ทำ Light/Dark mode อ่านง่ายและใช้สีอย่างมีความหมาย
- ทำตารางระดับ Item ใช้งานสะดวกเมื่อมีคอลัมน์กว้างและต้องเลื่อนแนวนอน
- ทำแท็บ `order` และ `ผลอ่าน` ใช้ visual pattern เดียวกัน
- เพิ่มพื้นที่กดเปิด Order โดยไม่รบกวนปุ่มภายในแถว

## 2. Toolbar และช่องค้นหา

### 2.1 Search

ข้อความในช่องค้นหาใช้รูปย่อเพื่อไม่ให้ตกบรรทัด:

`ค้นหา HN / VN / ON / AN / ชื่อ`

ความหมายของตัวย่อในหน้าจอนี้:

| ตัวย่อ | ความหมาย |
|---|---|
| HN | Hospital Number |
| VN | Visit Number |
| ON | Order No. |
| AN | Accession No. |

`aria-label` ต้องเก็บคำเต็ม `HN VN Order No. Accession No. หรือชื่อผู้ป่วย` เพื่อ accessibility แม้ข้อความที่เห็นบนหน้าจอใช้ตัวย่อ

### 2.2 ตัวกรองเครื่อง

- ก่อนเลือกค่า placeholder `Select all` ต้องอยู่กึ่งกลางแนวตั้ง ไม่ลอยชิดขอบบน
- ความกว้างเริ่มต้น `170px` และกว้างได้ไม่เกิน `360px`
- แสดงรหัสเครื่องที่เลือกครบทุกตัว ห้ามยุบเป็น `+N`
- หนึ่งแถวแสดงได้ไม่เกิน 4 tag; ตัวที่ 5 เป็นต้นไปขึ้นบรรทัดใหม่
- กล่องสูงลงด้านล่างเมื่อมีหลายแถว ห้ามขยายไปเบียด `Search`, `Report` หรือปุ่มสร้างรายการ
- ใช้สีฟ้าเฉพาะ tag ที่ถูกเลือก: border `#A0CFFF`, background `#ECF5FF`, text `#337ECC`
- พื้นช่อง select, label และรายการใน dropdown ใช้ขาว/เทาตาม Element Plus theme เดิม ไม่ย้อมสีตามชนิดเครื่อง
- dropdown เป็นตัวกรองข้อมูล ไม่ใช่ตัวกำหนดสิทธิ์ และยังต้องแสดงเฉพาะข้อมูลในหน่วยงานของผู้ใช้

## 3. สถานะและสี

### 3.1 ระดับสถานะ

มีสถานะใช้งาน 4 ระดับ และมี `ทั้งหมด` เป็นตัวเลือกดูรวม:

| ลำดับ | Filter | ความหมาย | สีหลัก |
|---:|---|---|---|
| 1 | `รอรับ` | Order ยังไม่ได้ส่งเข้าเครื่อง | เหลือง `#FADB14` |
| 2 | `รอผลตรวจ` | ส่งเข้าเครื่องแล้ว แต่ผลยังไม่ครบ; รวมช่วงรอภาพและรอผลอ่านไว้สถานะเดียว | ส้ม `#E6A23C` |
| 3 | `ออกผลครบ` | รายการตรวจทั้งหมดใน Order มีผลแล้ว | เขียว `#67C23A` |
| 4 | `ยกเลิก` | Order ถูกยกเลิก | แดง `#F56C6C` |

`ทั้งหมด` ไม่ใช่สถานะทางคลินิก จึงใช้ primary blue เฉพาะตอนเลือก filter

### 3.2 Filter, Order และ Item

- กล่อง filter หลักต้องแยกเป็น `ทั้งหมด · รอรับ · รอผลตรวจ · ออกผลครบ · ยกเลิก`
- จำนวนในแต่ละกล่องต้องนับภายใต้ตัวกรองเครื่องและช่วงข้อมูลเดียวกับตาราง
- จุดสถานะระดับ Order ใช้สีเดียวกับ filter เพื่อให้สแกนด้วยสายตาได้
- ระดับ Item หลังส่งเข้าเครื่องใช้คำว่า `ส่งเครื่องแล้ว`; สถานะย่อยจาก RIS แสดงแยกจากสถานะรวมของ Order
- ไม่แยก `รอผลภาพ` และ `รอผลอ่าน` เป็นสอง filter เพราะผู้ใช้ต้องติดตามเป็นช่วงรอเดียวกัน

### 3.3 Legend

แสดง legend แบบมองเห็นได้ตลอดทางขวาของแถบ filter ไม่ต้อง hover:

`● รอรับ   ● รอผลตรวจ   ● ออกผลแล้ว   ● ยกเลิก`

สีของจุดต้องตรงกับสถานะในข้อ 3.1 ทุกจุด

## 4. Dark mode และ Tag

- พื้นหน้า ตัวอักษร เส้นขอบ และ tag ที่รองรับ theme ต้องอ่านค่าจาก Element Plus variables
- ป้ายที่ปรับให้เข้ากับ Dark mode ได้แก่ ความเร่งด่วน, เพศ, คลินิก/หน่วยต้นทาง, สถานะชำระเงิน, เลข Order, เครื่อง และสถานะ `รอรับ`
- `รอรับ` คงสีหลักเหลือง `#FADB14`; ใน Dark mode ใช้พื้นเหลืองโปร่งและข้อความเหลืองอ่อนเพื่อลดกล่องขาวจ้า
- สีต้องเป็นข้อมูลประกอบ ไม่ใช่ข้อมูลเพียงอย่างเดียว ทุกสถานะยังต้องมีข้อความกำกับ
- ห้ามแก้สีด้วยการ hard-code พื้นขาวให้ tag ที่ต้องทำงานใน Dark mode

## 5. แถว Order

### 5.1 พื้นที่กดเปิดรายละเอียด

- คลิกพื้นที่ว่างส่วนใดก็ได้ของแถว Order เพื่อเปิดหรือย่อ detail panel
- icon ลูกศรยังเปิดหรือย่อได้เหมือนเดิม
- click บน `PDF`, `พิมพ์ HN`, `EMR`, button, input, select, checkbox, dropdown หรือลิงก์ภายในแถว ต้องทำงานเฉพาะ control นั้น ไม่ทำให้ Order เปิด–ปิดซ้ำ
- การปล่อยเมาส์หลังลากเลือกข้อความเพื่อคัดลอกต้องไม่เปิดหรือย่อ Order
- เมื่อย่อ Order ให้ล้างรายการที่ติ๊กไว้ตาม safety rule เดิม เพื่อไม่ให้ส่ง Item ที่ผู้ใช้มองไม่เห็น
- แถว Order ใช้ cursor แบบกดได้เพื่อบอก affordance

### 5.2 ปุ่ม Action ระดับ Item/Detail

| ปุ่ม | Element Plus type | รูปแบบ |
|---|---|---|
| `ส่งเข้าเครื่อง` | `success` | เขียวทึบ |
| `ปฏิเสธรายการ` | `warning` | เหลือง/ส้มทึบ |
| `ยกเลิก order` | `danger` | แดงทึบ |

การเปลี่ยนครั้งนี้เปลี่ยนเฉพาะ appearance; เงื่อนไขแสดงปุ่ม, disabled state, loading state, permission และ click handler ใช้ของเดิมทั้งหมด

## 6. ตารางแท็บ `order`

### 6.1 Header

- หัวตารางสูง `44px`
- ใช้ background `primary-50`, ตัวอักษรสีหลัก และเส้นบน–ล่าง `primary-light-7`
- พื้นสีฟ้าต้องชิดเส้นใต้แท็บทันที ไม่มีช่องว่างด้านบน
- ความกว้างพื้น header ต้องคลุมครบถึงคอลัมน์ `สติ๊กเกอร์ HN` ห้ามขาดก่อนขอบตาราง
- grid มี `min-width: 1481px` เพื่อรองรับผลรวมคอลัมน์และช่องว่างจริง

### 6.2 Checkbox แบบ Sticky

- checkbox หัวตารางและ checkbox ของแต่ละ Item อยู่ในคอลัมน์แรกกว้าง `42px`
- คอลัมน์ checkbox อยู่ใน gutter ซ้าย และเส้นแบ่งขวาตรงแนวเริ่มคำว่า `order`
- ใช้ `position: sticky; left: 0` เพื่อให้มองเห็นตลอดเมื่อเลื่อนตารางแนวนอน
- sticky cell ต้องมีพื้นทึบตามสถานะแถวปกติ, hover หรือ selected เพื่อไม่ให้ข้อความที่เลื่อนผ่านด้านหลังซ้อนกับ checkbox
- การทำ sticky เป็นการเปลี่ยน layout เท่านั้น ไม่เปลี่ยน logic `เลือกทั้งหมด`, indeterminate หรือการเลือกหลาย Item

## 7. ตารางแท็บ `ผลอ่าน`

แท็บ `ผลอ่าน` ใช้ pattern เดียวกับแท็บ `order` โดยไม่มี checkbox:

- หัวตารางสูง `44px`
- ใช้ background `primary-50`, ตัวอักษรสีหลัก และเส้นบน–ล่าง `primary-light-7` ชุดเดียวกัน
- ไม่มีช่องว่างระหว่างเส้นใต้แท็บกับหัวตาราง
- พื้นสีฟ้าเริ่มจาก gutter ซ้ายแนวเดียวกับตาราง `order`
- เว้น gutter ซ้าย `42px` เป็นพื้นที่ว่าง แต่คอลัมน์ `ลำดับ` ยังอยู่ตำแหน่งเดิม
- ไม่มี checkbox, select-all หรือ selection logic ในแท็บผลอ่าน
- แถวข้อมูลสูงขั้นต่ำ `52px` เท่ากับแถว Item ของแท็บ order
- grid มี `min-width: 998px`; เมื่อหน้าจอแคบยังเลื่อนแนวนอนได้โดยไม่บีบคอลัมน์จนอ่านไม่ได้

## 8. Responsive behavior

- Desktop ใช้ตารางแนวนอนและ sticky checkbox ตามข้อ 6
- เมื่อ viewport ไม่เกิน `900px` ตาราง Order เปลี่ยนเป็น card/grid ย่อย, ยกเลิก sticky และ reset gutter เพื่อไม่ให้เนื้อหาล้นขอบ
- ที่ขนาดเล็ก แท็บผลอ่านคืน margin ซ้ายและ padding ให้เหมาะกับพื้นที่ แต่ยังคงความหมาย สี และลำดับคอลัมน์เดิม
- ที่ viewport ไม่เกิน `680px` toolbar และ action buttons สามารถ wrap ได้โดยไม่ทับกัน

## 9. Acceptance criteria สำหรับ UAT

- [ ] ก่อนเลือกเครื่อง `Select all` อยู่กึ่งกลางแนวตั้ง
- [ ] เลือกเครื่อง 1–4 ค่าแล้วทุก tag แสดงครบ
- [ ] เลือกเครื่อง 5 ค่าขึ้นไปแล้วค่าที่ 5 ขึ้นบรรทัดใหม่ โดยปุ่มข้างเคียงไม่ถูกเบียด
- [ ] dropdown ยังคงพื้นขาว/เทา และมีสีเฉพาะ tag ที่เลือก
- [ ] มี filter 5 กล่อง และ legend 4 สีตามข้อ 3
- [ ] Light mode และ Dark mode อ่าน tag ทุกชนิดได้ชัด ไม่มีพื้นขาวจ้าในส่วนที่แก้
- [ ] placeholder แสดง `ค้นหา HN / VN / ON / AN / ชื่อ` ในบรรทัดเดียว
- [ ] ปุ่ม action สามปุ่มเป็นสีทึบเขียว/ส้ม/แดง
- [ ] คลิกพื้นที่ว่างของแถว Order แล้วเปิด–ย่อได้
- [ ] คลิก PDF/พิมพ์ HN/EMR แล้วไม่ทำให้ Order เปิด–ปิดซ้ำ
- [ ] หัวตาราง Order ชิดแท็บและพื้นฟ้าคลุมถึงคอลัมน์สุดท้าย
- [ ] เมื่อเลื่อนแนวนอน checkbox หัวตารางและ Item ยังมองเห็นด้านซ้าย
- [ ] เส้นขวาของช่อง checkbox ตรงแนวคำว่า `order`
- [ ] หัวตารางผลอ่านมีขนาด สี ระยะ และแนวเริ่มพื้นเท่ากับ Order แต่ไม่มี checkbox

## 10. Implementation trace และขอบเขตการ Deploy

| Artifact | หน้าที่ |
|---|---|
| [`build_xray_cpoe_worklist_ui.js`](../Form-Builder/seed/tests-tools/scripts/build_xray_cpoe_worklist_ui.js) | Source generator ของ template, CSS และ interaction |
| [`xray-cpoe-worklist-v1.json`](../Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json) | ไฟล์สำหรับ Replace/Import ใน Form Builder |
| [`test_xray_cpoe_worklist_form.js`](../Form-Builder/API/tests-tools/tests/test_xray_cpoe_worklist_form.js) | Regression tests ของ UI และ interaction |
| [`xray_cpoe_worklist_api.js`](../Form-Builder/API/api-factory/processes/xray_cpoe_worklist_api.js) | Count/filter bucket ของ `waiting` และ `pending` |
| [`test_xray_cpoe_worklist_api.js`](../Form-Builder/API/tests-tools/tests/test_xray_cpoe_worklist_api.js) | Regression tests ของ worklist API |

- การเปลี่ยน layout, สี, label และ click area อยู่ใน Form JSON
- การแยกจำนวน `รอรับ` กับ `รอผลตรวจ` ต้อง Deploy Form และ `xray_cpoe_worklist_api.js` รุ่นที่รองรับ `counts.waiting`/`counts.pending` ร่วมกัน
- ณ วันที่จัดทำ: Form tests ผ่าน, Worklist API tests ผ่าน, SDForm validator exit `0` และ generator ให้ผล idempotent
- Static validation ไม่แทนการตรวจ Builder/Preview และ runtime จริง ต้องทำ UAT ตาม checklist หลัง Replace

## 11. ภาพอ้างอิงจากรอบตรวจ

ไฟล์ภาพต้นฉบับอยู่ภายนอก repository บน Desktop ของผู้ตรวจ:

- `Screenshot 2569-09-11 at 12.57.06.png` และ `12.57.13.png` — ตัวกรองเครื่อง
- `13.04.49.png`, `13.05.57.png`, `13.15.08.png`, `13.30.38.png`, `13.47.51.png` — สถานะและ legend
- `13.57.50.png` — Dark mode และ tag
- `14.05.10.png` และ `14.07.33.png` — Search และหัวตาราง
- `14.36.30.png` — สีปุ่ม action
- `14.41.12.png`, `14.43.54.png`, `14.52.03.png` — header, gutter และ sticky checkbox
- `14.56.04.png`, `14.57.28.png`, `15.01.08.png`, `15.01.14.png` — พื้นที่กด Order และ pattern ของแท็บผลอ่าน

