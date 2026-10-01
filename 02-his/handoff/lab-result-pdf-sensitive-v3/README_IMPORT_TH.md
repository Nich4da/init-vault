# LAB Result PDF Sensitive v3 — ชุดส่งทีม Report ตรวจและ Import

สถานะ: **ยังไม่ได้ Import เข้า Production** ไฟล์ชุดนี้เตรียมจาก export `Lab result` ล่าสุดวันที่ 28/09/2026 และ SQL `lab_result_slip` ที่ทดสอบแบบ static แล้ว

## ไฟล์และลำดับ Import

1. `01_sql-factory__lab_result_slip__6ab0a1c4d0c3ef2e97911e55.json`
   - Import/Replace ที่ **SQL Factory**
   - Provider ID: `6ab0a1c4d0c3ef2e97911e55`
   - SQL name: `lab_result_slip`
2. `02_report-factory__Lab-result__6aa8f5a8b92813319a86ea11.json`
   - Import/Replace ที่ **Report Factory**
   - Report ID: `6aa8f5a8b92813319a86ea11`
   - Report name: `Lab result`

ให้เลือก **Replace/Update record เดิมด้วย `_id` เดิม** ห้าม Clone เป็นรายงานใหม่ และควร export backup ของสอง record ก่อน import

## ขอบเขตที่ทีม Report ต้องยืนยัน

- `{{xparentx}}` คือ Result Report ID ที่ใช้เลือกใบรายงาน
- Result Item ถูกเลือกเฉพาะเมื่อ `lab_result_item.xparentx` หรือ `lab_result_item.result_report_id` ตรงกับ Result Report ID
- ห้ามใช้ `report.order_no` ขยายรายการ Result Item
- ตรวจ Sensitive ทีละ Result Item ตามเส้นทาง:
  `lab_result_item.order_no -> cpoe_order_item._id -> item_data_id -> master.is_hide_result`
- หา Parent Order สำหรับตรวจ grant จาก `cpoe_order_item.order_id.value`
- แถว Sensitive ที่ไม่มี grant ยังแสดงชื่อรายการ แต่ปิด `result_value`, หน่วย, การแปลผล, reference range และ comment
- แถวปกติยังแสดงผลตามเดิม
- SQL ยังรับ `grant_token` แบบ optional จาก EMR caller แต่ Report Factory ไม่แสดง `grant_token` ใน Report Parameters
- Report layout, datasource binding, sharing และพารามิเตอร์ `xparentx` คงเดิม

## UAT หลัง Import

1. ใบที่มีหลาย Result Item ต้องแสดงเฉพาะ item ของ Result Report นั้น ไม่มี item จาก Order เดียวกันหลุดเข้ามา
2. ใบ legacy ที่ item ใช้ `result_report_id` ต้องยังแสดงผลได้
3. แพทย์ยังไม่ยืนยัน: รายการ Sensitive แสดงชื่อ แต่ไม่แสดงค่าผล
4. แพทย์ยืนยันและส่ง grant ที่ยังไม่หมดอายุ: แสดงค่าผล Sensitive เฉพาะ Parent Order/section ที่ grant ครอบคลุม
5. grant หมดอายุ ผิด Parent Order หรือผิด section: ต้องยังปิดผล
6. รายการไม่ Sensitive และ PDF ของแลปอื่นต้องไม่เปลี่ยนพฤติกรรม
7. หน้าต่าง Report Parameters ต้องเหลือเฉพาะ `Lab report (xparentx)` ไม่มีช่อง `Sensitive access grant`

## ผลตรวจในชุดนี้

- Node syntax checks: ผ่าน
- SQL patch contract test: ผ่าน
- Report parameter patch test: ผ่าน
- Proposal semantic check และ idempotence: ผ่าน
- `git diff --check`: ผ่าน
