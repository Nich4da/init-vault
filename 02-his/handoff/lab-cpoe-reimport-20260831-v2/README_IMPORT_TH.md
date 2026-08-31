# LAB CPOE Re-import v2 — 31/08/2026

ชุดนี้แก้ทั้งสองปัญหาที่พบจากหน้าจอจริง:

1. การรับ specimen ไม่ถูกขวางด้วยข้อมูลที่ใช้ส่ง Agent เช่น เวลาเก็บ, priority หรือ specimen code
2. Form ไม่เรียก `userState.runProcess()` แบบ callback อีกต่อไป เพราะทำให้ HTTP สำเร็จแต่ UI แสดง error `API run success` / `e is not a function`

## วิธีที่แนะนำ: แทนที่ Process เดิมตาม ID

อย่าสร้าง API Process ใหม่ถ้าไม่จำเป็น เพราะ Receive และ Form อ้าง Process ID ด้านล่างไว้แล้ว ให้เปิด Process เดิม ลบโค้ดเดิมทั้งหมด วางไฟล์ที่ตรง ID แล้ว Save ตามลำดับ:

1. `01_agent-submit__6a9468c7422c1ca959829d6a.js`
   - Process ID: `6a9468c7422c1ca959829d6a`
   - หลังวางโค้ด ให้กำหนด `AGENT_ORDER_URL` และ `AGENT_KEY` ภายใน Protected API Process เท่านั้น ไฟล์ในชุดนี้ตั้งใจใช้ placeholder และไม่มี key จริง
2. `02_lab-no__6a94f1ed422c1ca959829d6e.js`
   - Process ID: `6a94f1ed422c1ca959829d6e`
3. `03_receive__6a94f634422c1ca959829d70.js`
   - Process ID: `6a94f634422c1ca959829d70`
4. `04_worklist__6a9434c3422c1ca959829d5e.js`
   - Process ID: `6a9434c3422c1ca959829d5e`
5. Import/Replace Form ด้วย `05_form__lab-cpoe-worklist-waiting-v1.json`

หลัง Save แต่ละ API ให้เปิดกลับมาตรวจว่าโค้ดยังอยู่ครบก่อนทำขั้นถัดไป

## ถ้า Import แล้วระบบสร้าง ID ใหม่

หยุดก่อน Import Form เพราะไฟล์ยังอ้าง ID เดิมอยู่ ต้องแก้ mapping ดังนี้:

- ใน Receive: `LAB_NO_PROCESS_ID` และ `AGENT_SUBMIT_PROCESS_ID`
- ใน Form: `PROCESS_ID` และ `RECEIVE_PROCESS_ID`
- ถ้า Form ถูกสร้างเป็น record ใหม่ ต้องเปลี่ยน App Factory ให้เปิด Form record ใหม่นั้นด้วย มิฉะนั้น App จะยังแสดง Form เก่า

วิธีปลอดภัยที่สุดคือแทนที่ Process/Form เดิมและรักษา ID เดิมทั้งหมด

## ตรวจว่าเป็นเวอร์ชันนี้จริง

- Receive ต้องค้นพบ `awaiting_outbound_data` และต้องไม่พบ `PRECHECK`
- Form ต้องค้นพบ `globalThis.fetch` และต้องไม่พบ `.runProcess(`
- กดรับ Item ที่ไม่มีเวลาเก็บ: ต้องได้สถานะรับแล้วและ Lab No.; ระบบพักส่ง Agent โดยไม่ขึ้น error 5000
- หลัง Import ให้ Reload App แบบ hard refresh หรือปิด App tab เดิมแล้วเปิดใหม่ เพื่อไม่ใช้ JavaScript ที่ cache ไว้

## ขอบเขตการยืนยัน

ผ่าน automated tests ของ Agent submit, Lab No., Receive, Worklist, Form และ SDForm validator แล้ว แต่ยังต้องทดสอบ Builder/runtime และ Agent end-to-end ในระบบจริง
