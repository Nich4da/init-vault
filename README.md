# InitCraft Skill Vault

คลังความรู้และไฟล์งานสำหรับ initCraft, SDForm และระบบ HIS/LAB จัดหมวดไว้ดังนี้:

- `00-home/` — จุดเริ่มต้น สารบัญ แคชบริบทล่าสุด และบันทึกตามเวลา
- `01-knowledge-base/` — ความรู้ที่สรุปแล้ว แยกเป็น concepts, entities, sources และ syntheses
- `02-initcraft/` — active skills, platform governance และ manifest ของคลัง artifacts
- `design/` — design contract และ implementation handoff ระดับระบบที่ใช้เป็น baseline ก่อนสร้าง artifact
- `Form-Builder/` — ศูนย์รวม artifacts สำหรับสร้างและดูแลฟอร์ม
  - `Form-Builder/SDForm/` — ไฟล์ JSON ทั้งหมด พร้อม `backup/` สำหรับ snapshot และ
    `best-practices/` สำหรับต้นแบบ Form ที่ผ่านการพิสูจน์ตามเป้าหมายแล้ว
    และ `Lab/` เป็น working area ที่ผู้ใช้กำหนดสำหรับระบบ LAB ใหม่
  - `Form-Builder/API/` — ไฟล์ JavaScript ทั้งหมด พร้อม `backup/` สำหรับเก็บต้นแบบ API แบบมีเวอร์ชัน
  - `Form-Builder/seed/` — ไฟล์ Python ทั้งหมด แยก data builder, generator, maintenance และ validator
- `02-his/` — ไฟล์สนับสนุนที่เหลือ เช่น Markdown, XLSX, ZIP, รูป และแผนภาพ
- `03-source-materials/` — เอกสารต้นทางแบบอ่านอย่างเดียว; Web Clipper บันทึกที่
  `03-source-materials/web-clips/` และไฟล์แนบอยู่ที่ `03-source-materials/assets/`

เริ่มอ่านที่ `00-home/hotcache.md` แล้วใช้ `00-home/index.md` เป็นสารบัญหลัก
เมื่อต้องหาไฟล์ Form/API/SQL/Report หรือ skill ให้เริ่มที่
`02-initcraft/MIGRATION_MANIFEST.md`

ไฟล์และโฟลเดอร์ซ่อนที่ราก (`.git`, `.obsidian`, `.claude`, `.env`) เป็นการตั้งค่าระบบของ vault และ repository
