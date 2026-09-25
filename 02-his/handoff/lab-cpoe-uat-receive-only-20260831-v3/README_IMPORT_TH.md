# LAB Worklist UAT — Receive only v3

เป้าหมายของชุดนี้คือทดสอบ flow หน้า LAB Worklist ให้จบก่อน โดยยังไม่ทดสอบ Agent

## สิ่งที่เปลี่ยน

- Form กลับไปใช้ `userState.runProcess` connector แบบเดิมที่เคยโหลด Worklist ได้
- ปุ่ม `รับ specimen` บันทึกเวลารับ, ผู้รับ, สร้าง Lab No. และเปลี่ยน Item เป็น `accepted`
- ไม่บังคับเวลาเก็บ specimen, priority, specimen code หรือข้อมูล Agent
- ไม่เรียก Agent submit และเก็บ `agent_transport_state: uat_receive_only`

## ไฟล์ที่ต้องแทนจริง

1. แทนโค้ด Process ID `6a94f634422c1ca959829d70` ด้วย
   `03_receive-uat-only__6a94f634422c1ca959829d70.js`
2. Import/Replace Form ด้วย
   `04_form-original-connector__lab-cpoe-worklist.json`
3. ปิด App tab เดิม เปิดใหม่ หรือ Hard Refresh

## ไฟล์อ้างอิงเดิม

- `01_worklist-existing__6a9434c3422c1ca959829d5e.js`
- `02_lab-no-existing__6a94f1ed422c1ca959829d6e.js`

สองไฟล์นี้รวมไว้ให้เทียบหรือแทนใหม่ได้ แต่ถ้า Process เดิมยังทำงาน ไม่จำเป็นต้องแก้

## ผลที่ควรเห็น

1. เปิดหน้าแล้วรายการและ count ต้องกลับมา
2. เลือก Item สถานะรอรับ แล้วกด `รับ specimen`
3. ยืนยัน popup
4. Item เปลี่ยนเป็นรับแล้ว, มี Lab No. และข้อความ `รับ specimen แล้ว (UAT: ยังไม่ส่ง Agent)`
5. Tab ออกผลเปิดดูได้ และปุ่มดินสอเปิดให้ลงผลหลังรับ

ชุดนี้ไม่ใช้ `01_agent-submit` และยังไม่ใช่การทดสอบ HIS → Agent → LIS
