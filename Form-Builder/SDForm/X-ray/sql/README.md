# X-ray — NoSQL pipelines สำหรับ SQL Factory

ไฟล์ในโฟลเดอร์นี้เป็น **pipeline ล้วน ๆ** เอาไปวางในช่อง NoSQL Pipeline ของ SQL Factory
ไม่ใช่แพ็กเกจ import (แพ็กเกจ import ของใบสั่งตรวจอยู่ที่ `02-his/sql-factory/exports/`)

| ไฟล์ | ใช้ทำอะไร | พารามิเตอร์ | from |
|---|---|---|---|
| `xray-order-ids-by-number.nosql.json` | **เอา `order_id` + `visit_id` จากเลขใบที่เห็นบนจอ** | `order_number` | `zdata_cpoe_order` |
| `xray-order-visit-ids.nosql.json` | ไล่ X-ray order ล่าสุด 20 ใบ | ไม่มี | `zdata_cpoe_order_item` |
| `xray-diagnose-service-type.nosql.json` | หาสาเหตุตอน SQL คืน 0 แถว | ไม่มี | `zdata_cpoe_order_item` |
| `xray-hn-test.nosql.json` | ไล่รายการ X-ray ของ HN หนึ่งคน | `hn` | `zdata_cpoe_order_item` |

`xray-order-ids-by-number.nosql.json` ใช้ `From` = **`zdata_cpoe_order`** และ
`NoSQL Collections` = `["zdata_cpoe_order"]` ต่างจากไฟล์อื่นในโฟลเดอร์นี้

## ตั้งค่า SQL Factory (เหมือนกันทุกไฟล์ ยกเว้น From ตามตารางข้างบน)

| ช่อง | ค่า |
|---|---|
| SQL Type | `NoSQL` |
| NoSQL Type | `aggregate` |
| Form / From | `CPOE Order Item` → `zdata_cpoe_order_item` (ยกเว้น `xray-order-ids-by-number` ใช้ `CPOE Order` → `zdata_cpoe_order`) |
| NoSQL Collections | ชื่อ collection ของ `From` ตัวเดียว เช่น `["zdata_cpoe_order_item"]` |
| SQL Select | เว้นว่าง |
| NoSQL Pipeline | วางเนื้อไฟล์ทั้งก้อน |
| Variables | **ต้องประกาศให้ครบทุกชื่อ** ไม่งั้นตารางผลจะว่างทั้งที่ query คืนแถวมาจริง |

## ทำไม LAB ใช้ได้ แต่ pipeline ที่วางเองแล้วผลว่าง

ไม่ได้ต่างกันที่ LAB กับ X-ray และไม่ได้ต่างกันที่คอลเลกชัน — ทั้งคู่อ่าน
`zdata_cpoe_order_item` ด้วย Form `CPOE Order Item` ตัวเดียวกัน เทียบเรกคอร์ดจริงแล้ว
`sql_type` · `nosql_type` · `sql_from` · `nosql_collections` · `sql_form_id` ·
`sql_share` · `sql_select` **เท่ากันทุกช่อง**

ที่ต่างคือ **วิธีสร้างเรกคอร์ด**:

| | `LAB Order Request PDF v1` | pipeline ที่วางเอง |
|---|---|---|
| ที่มา | import จาก ZIP | สร้างเรกคอร์ดใหม่แล้ววาง pipeline |
| Variables | มาพร้อมแล้ว 29 ชื่อ | **ว่าง** จนกว่าจะพิมพ์เอง |
| Parameters | มาพร้อมแล้ว 5 ตัว | ว่าง |
| From / Collections / Share | มาพร้อมแล้ว | ต้องตั้งเอง |

`sql_options.variable` คือตัวกำหนดว่าตารางผลจะโชว์คอลัมน์ไหน **ไม่ประกาศ = ตารางว่าง
ทั้งที่ aggregate คืนแถวมาจริง** อาการจึงเหมือน "ไม่มีข้อมูล" ทั้งที่ข้อมูลมี

ดังนั้นก่อนกด Test ทุกครั้งที่วาง pipeline เอง ต้องพิมพ์ชื่อ variable ให้ครบตามหัวข้อ
ของไฟล์นั้น รวมถึง `xray-diagnose-service-type` เองด้วย — ถ้าไม่ประกาศ 4 ชื่อของมัน
ตัววินิจฉัยก็จะโกหกว่าไม่มีข้อมูลเหมือนกัน

แพ็กเกจ `X-ray Order Request PDF v1` ที่ส่งไปเป็น ZIP ไม่มีปัญหานี้ เพราะประกาศ
variable ทั้ง 31 และ parameter ทั้ง 4 มาให้แล้วในตัวไฟล์

## `xray-order-visit-ids.nosql.json` — เอาไว้หาเลขมาเทส

คืน X-ray order ล่าสุด 20 ใบ ใบละหนึ่งแถว ไม่ต้องใส่พารามิเตอร์อะไรเลย

Variables (`sql_options.variable`) ที่ต้องประกาศ:
`order_id`, `visit_id`, `order_number`, `order_created_at`, `hn`, `patient_name`,
`item_count`, `accession_count`, `item_codes`

| คอลัมน์ | ความหมาย |
|---|---|
| `order_id` | ค่าที่ต้องวางในพารามิเตอร์ `order_id` ของ Report |
| `visit_id` | ค่าที่ต้องวางในพารามิเตอร์ `visit_id` ของ Report |
| `order_number` | เลขที่ใบสั่งที่จะขึ้นบนบาร์โค้ด |
| `item_count` | จำนวนรายการในใบ — เลือกใบที่ > 1 จะได้เห็นตารางหลายแถว |
| `accession_count` | จำนวนรายการที่ออก Accession แล้ว — `0` คือใบที่ยังไม่ส่งเข้าเครื่อง |
| `item_codes` | รหัสรายการในใบ ไว้ดูว่าใบไหนน่าเอามาเทส |

`order_id` และ `visit_id` ที่คืนมา คำนวณด้วย **นิพจน์เดียวกับที่ Report ใช้กรอง**
(`_order_key` / `_visit_key`) มี test ล็อกไว้ใน
`Form-Builder/API/report_factory/tests/test_xray_order_request_report.js`
ว่าสองที่ห้ามเพี้ยนจากกัน — เลขที่ก็อปจากตารางนี้จึงรับประกันว่าตรง

### วิธีเทส Report

1. รัน SQL นี้ → เลือกหนึ่งแถว
2. ก็อป `order_id` และ `visit_id` ไปใส่ SQL Test ของ `X-ray Order Request PDF v1`
   พร้อม `printed_by` (ชื่อคนเทส) และ `printed_at` (วัน/เวลาจริง)
3. ได้กี่แถว = จำนวนรายการในใบนั้น ถ้าได้ 0 แถวแปลว่าเลขผิดคู่ ไม่ใช่ pipeline พัง
4. เอาสี่ค่าเดิมไปรัน Report Preview ต่อ

ถ้าได้ 0 แถวทั้งที่ก็อปมาจากตารางนี้ ให้ดูว่า `visit_id` ถูกกรอกเป็น **VN ที่แสดงบนจอ**
หรือเปล่า — ต้องเป็น Visit record ID (`order.xparentx`) เท่านั้น

## `xray-order-ids-by-number.nosql.json` — ทางลัดที่แน่นอนที่สุด

อ่านจาก `zdata_cpoe_order` ตรง ๆ ไม่ต้อง `$lookup` ไม่ต้องพึ่ง `service_type`
ใส่เลขใบที่อ่านได้จากคอลัมน์ Order No. บนหน้า X-ray Workbench เช่น `R2609020004`

Variables: `order_id`, `visit_id`, `patient_name`, `order_number`,
`order_created_at`, `hn`, `vn`
Parameters: `[{ pname: "order_number", ptype: "text" }]`

`visit_id` ที่คืนมาคือ `_visit_key` ของ Report ที่ถอดคำนำหน้า `$_order.` ออก และ
`order_id` คือ `_id` ตัวเดียวกับที่ Report `$lookup` ด้วย `order_id.value` → `_id`
มี test ล็อกความเท่ากันไว้ทั้งสองตัว

> ระวัง: `vn` ที่คืนมาไว้ดูเฉย ๆ **ห้ามเอาไปใส่ `visit_id`**

## `xray-diagnose-service-type.nosql.json` — ตอน SQL คืน 0 แถว

ไม่มีพารามิเตอร์ คืนหนึ่งแถวต่อค่า `service_type` หนึ่งค่าที่มีจริงในคอลเลกชัน
Variables: `service_type`, `items`, `alive_items`, `with_accession`

อ่านผลแบบนี้:

| ผลที่ได้ | แปลว่า | ทำต่อ |
|---|---|---|
| ไม่มีแถวเลยสักแถว | SQL Factory มองไม่เห็น `zdata_cpoe_order_item` ทั้งคอลเลกชัน | ตรวจ `From` / `NoSQL Collections` / สิทธิ์ของ SQL record (ตั้ง `sql_share` เป็น public ชั่วคราวเหมือนของ LAB) |
| มีแถว แต่ไม่มีค่า `xray` | `service_type` สะกดไม่ตรง | ใช้ค่าที่เห็นจริงในคอลัมน์ `service_type` ไปแทนคำว่า `xray` ใน pipeline |
| มี `xray` แต่ `alive_items` = 0 | โดน `xrstatx` กรองหมด | รายการถูกลบ/ยกเลิกในระดับเรกคอร์ด |
| มี `xray` และ `alive_items` > 0 | pipeline ถูกแล้ว | ปัญหาอยู่ที่ **ยังไม่ได้ประกาศ Variables** ในหน้า SQL Factory — ไม่ประกาศแล้วตารางผลจะว่างทั้งที่ query คืนแถวมาจริง |

ช่องสุดท้ายคือสาเหตุที่เจอบ่อยที่สุด: `sql_options.variable` เป็นตัวกำหนดว่า
คอลัมน์ไหนจะโผล่ ถ้าไม่ประกาศชื่อไว้ครบ ผลจะดูเหมือนไม่มีข้อมูล

## `xray-hn-test.nosql.json` — ไล่ตาม HN

พารามิเตอร์เดียวคือ `hn` (`sql_options.param` = `[{pname:"hn", ptype:"text"}]`)
`CPOE Order Item` ไม่มีฟิลด์ `hn` ในตัวเอง จึงต้อง `$lookup` ไป
`zdata_cpoe_order.vid.pid.hn` เสมอ

ข้อควรระวัง: ถ้าฐานเก็บ `0006900002` แต่สแกนได้ `6900002` จะไม่แมตช์
ลองรันทั้งสองค่าเพื่อดูว่าต้องเติมศูนย์นำหน้าไหม
