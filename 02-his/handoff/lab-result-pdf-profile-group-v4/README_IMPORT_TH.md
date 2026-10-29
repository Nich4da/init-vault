# LAB Result PDF — Profile/Parent Heading v4

สถานะ: ชุดไฟล์สำหรับให้ผู้ใช้ Replace เอง ยังไม่ได้แก้ live artifact

## สิ่งที่แก้

- รายการที่มีผลย่อยหลายแถวจะแสดงชื่อ Test/Order หลักหนึ่งครั้ง เช่น **Liver Function Test**
- Total protein, Albumin, Total bilirubin, AST และ ALT ยังคงเป็นผลย่อย
- ชื่อหัวดึงจาก CPOE Order Item และ fallback ไป Order Master ไม่ hardcode ชื่อ profile
- Test ที่มีผลเดียวไม่เพิ่มหัวซ้ำ
- คง sensitive-result gate, comment ระดับ Order/Test, คอลัมน์ตำแหน่งของ MY และ layout เดิม
- ไม่เปลี่ยนพฤติกรรม MLab ใน popup; ปุ่ม 1–5 ยังอยู่ตาม prototype

## ลำดับ Replace

1. SQL Factory: `01_sql-factory__lab_result_slip__6ab0a1c4d0c3ef2e97911e55.json`
2. Report Factory: `02_report-factory__Lab-result__6aa8f5a8b92813319a86ea11.json`

ต้อง Replace record เดิมด้วย ID เดิม ห้าม Clone และควร Export backup ก่อน Replace

## Ownership / write gate

Live SQL และ Report มี Created By: Parinya Tumchay จึงไม่ได้ถูก Save/Publish โดย Codex ชุดนี้เตรียมให้ผู้ใช้หรือเจ้าของ artifact ตรวจและ Replace เท่านั้น

## UAT สำคัญ

1. BC profile C1 ต้องเห็น Liver Function Test หนึ่งครั้งและผลย่อย 5 แถว
2. Electrolyte profile ต้องเห็นชื่อรายการหลักหนึ่งครั้งและผลย่อยตามจริง
3. Single test ต้องไม่แสดงชื่อซ้ำสองชั้น
4. MY หลายตำแหน่งต้องยังมีคอลัมน์ตำแหน่งและหัว Test หลักหนึ่งครั้ง
5. IM / MI-OUT sensitive result ต้องยังปกปิดก่อนยืนยันตัวตน
6. MLab popup ต้องยังใช้รูปแบบเดิมและปุ่ม 1–5
