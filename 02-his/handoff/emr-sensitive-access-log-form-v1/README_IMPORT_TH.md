# ฟอร์ม EMR Sensitive Access Log v1

## วัตถุประสงค์

ฟอร์มนี้ใช้ **ดู Audit Log แบบอ่านอย่างเดียว** สำหรับการขอเปิดดูผล LAB Sensitive ที่ Process
`emr-lab-board-get` บันทึกลง collection `zdata_emr_sensitive_access_log` อยู่แล้ว

ฟอร์มนี้ไม่สร้าง Log เอง และไม่เปลี่ยน flow ยืนยันตัวตน/เปิดผลเดิม

## วิธี Import

1. Import `emr-sensitive-access-log-v1.json` เข้า Form Factory
2. ตั้งชื่อ Form ให้ตรงกับ collection เป็น `emr_sensitive_access_log`
3. เปิด Form ใน Builder/Preview เพื่อตรวจ layout และ field binding
4. ตั้งสิทธิ์เฉพาะผู้ตรวจสอบที่ได้รับอนุญาต เช่น Audit/Admin/Medical Governance
5. ปิดสิทธิ์ Add, Update และ Delete ทุกกรณี; ให้เฉพาะ View/Search
6. ห้ามตั้งเป็น Public และห้ามให้ผู้ใช้ทั่วไปหรือห้อง LAB แก้ไขรายการ Log

## ข้อมูลที่แสดง

- เวลา การดำเนินการ ผลการยืนยัน และเหตุผล
- ผู้ขอดูผล/บทบาท ณ เวลานั้น และบัญชีแพทย์ที่ใช้ยืนยัน
- Source/Screen/Site/Unit
- Visit, Parent Order, CPOE Order Item, Item code, Result revision และ Request ID
- Technical IDs บางส่วนถูกเก็บเป็น field ซ่อนเพื่อช่วยตรวจสอบย้อนหลัง

ไม่มี field รหัสผ่าน, password hash, grant token, ค่าผลตรวจ, comment ผลตรวจ หรือ URL ไฟล์แนบ

## ข้อจำกัดการยืนยัน

- ผ่าน static SDForm validator และ contract test แล้ว
- ยังไม่ถือว่าผ่าน Builder/Preview หรือ runtime จนกว่าจะ Import และทดสอบใน UAT
- ทดสอบด้วยข้อมูล UAT เท่านั้น และตรวจว่าการเปิดฟอร์มไม่ทำให้เกิดการเขียน/แก้ไข Log
