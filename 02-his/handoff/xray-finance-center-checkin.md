---
title: X-ray finance-to-center checkin handoff
date: 2026-10-09
status: ready-for-api-owner
scope: Central checkin API support for X-ray center m0900
live_change: none
---

# X-ray: ส่งคิวจากการเงินเข้า Center `m0900`

## จุดประสงค์

ทำให้ทีมการเงินส่งคิวผู้ป่วยมายัง X-ray Center `m0900` ได้ โดยคง flow คิว
EMR เดิมของคลินิกทั้งหมด และไม่สร้างห้องตรวจจำลองให้หน่วย Center

## ข้อสรุปที่ต้อง Confirm

- `m0900` เป็นหน่วยแม่/Front Desk ของสาย X-ray และตั้งใจให้มี
  `unit_type = xray`
- การเงินต้องส่งคิวมายัง `m0900` **โดยไม่ต้องระบุ Room**
- คิวใหม่ต้องอยู่ใน bucket `FRONT` ของ Center ก่อน
- เจ้าหน้าที่ X-ray Center เป็นผู้ย้ายคิวจาก `FRONT` ไปยังห้องลูกที่เหมาะสม
- ไม่ต้องเปลี่ยน `m0900` เป็น `unit_type = clinic`
- ไม่ต้องสร้าง Room ปลอมสำหรับ `m0900`

`FRONT` ใน flow นี้เป็นสถานะการจัดคิวของหน้าจอ Center ไม่ใช่ master Room:
ข้อมูล Visit Tran ยังคงเก็บ `room_to = null` จนกว่าจะมีการย้ายเข้าห้องลูก

## ข้อความสำหรับตอบทีมการเงิน

> ยืนยันให้การเงินส่งคิวมาที่หน่วย `m0900` ได้โดยไม่ต้องระบุห้องค่ะ
> `m0900` เป็นจุดรับคิวกลางของ X-ray เมื่อรับคิวแล้วรายการต้องเข้า `FRONT`
> ก่อน จากนั้นเจ้าหน้าที่ X-ray Center จึงย้ายคิวเข้าห้องตรวจลูก
> รบกวนเจ้าของ API `checkin` ปรับเงื่อนไขให้รองรับ `m0900` เป็นกรณีเฉพาะ
> โดยคงการทำงานของหน่วย `clinic` เดิมทั้งหมด ไม่ต้องเปลี่ยน `unit_type`
> ของ `m0900` เป็น `clinic` และไม่ต้องสร้างห้องจำลองให้ `m0900`

## สาเหตุที่ยืนยันจากระบบจริง

ตรวจ API Factory แบบ read-only เมื่อวันที่ 2026-10-09 พบว่า API กลาง
`checkin` ปฏิเสธหน่วยที่ไม่ใช่ `clinic` ที่เงื่อนไขบรรทัด 131:

```js
if (org.unit_type !== 'clinic') {
  return fail(`unit "${unitCode}" is not clinic (unit_type=${org.unit_type})`)
}
```

จึงปฏิเสธ `m0900` ก่อนถึงขั้นสร้าง Visit Tran ทั้งที่โค้ดช่วงถัดไปรองรับ
กรณีไม่มีห้องอยู่แล้ว:

```js
room_to: roomTo // null = ยังไม่ระบุห้อง
```

สาเหตุจึงเป็น **validation gate ของ API ยังไม่รองรับ X-ray Center**
ไม่ใช่ปัญหาว่า Organization `m0900` ขาด Room

## วิธีแก้ที่แนะนำสำหรับเจ้าของ API

ให้แก้เฉพาะเงื่อนไขอนุญาตหน่วยแบบ additive และ fail-closed:

1. คงการอนุญาต `unit_type === 'clinic'` แบบเดิมทุกประการ
2. เพิ่ม allowlist เฉพาะรหัส Center ที่ยืนยันแล้ว คือ `m0900`
3. ห้ามอนุญาต `unit_type === 'xray'` ทุกหน่วยแบบกว้าง เพราะอาจเปิดคิวให้
   หน่วย X-ray อื่นที่ไม่ได้ทำหน้าที่เป็น Center
4. ไม่เปลี่ยน logic สร้างเลขคิว, ป้องกันคิวซ้ำ, reactivate, WebSocket,
   `unit_path` หรือการบันทึก Visit Tran

ตัวอย่าง patch สำหรับนำไปปรับใน API `checkin`:

```js
const QUEUE_CENTER_UNIT_CODES = new Set(['m0900'])

const normalizedUnitCode = String(org.unit_code || '').trim().toLowerCase()
const isClinic = org.unit_type === 'clinic'
const isApprovedQueueCenter = QUEUE_CENTER_UNIT_CODES.has(normalizedUnitCode)

if (!isClinic && !isApprovedQueueCenter) {
  return fail(
    `unit "${unitCode}" cannot receive queue (unit_type=${org.unit_type})`
  )
}
```

หลังผ่าน gate นี้ ให้ใช้ flow เดิมของ API ต่อโดยไม่เพิ่ม branch พิเศษ:

- `unit_to = m0900`
- `room_to = null`
- `vtran_status = waiting`
- หน้าจอ Center แสดงเป็น `FRONT`
- เมื่อเจ้าหน้าที่เลือกห้องลูก ระบบ Move Room จึงเติมปลายทางห้อง

## Ownership และข้อจำกัดการแก้สด

ข้อมูล live แสดง `Created By = SuperAdmin InitAPI` ดังนั้น API `checkin`
เป็น artifact ของทีมเจ้าของ API กลาง ไม่ใช่ artifact ที่ X-ray เป็นเจ้าของ

- เอกสารนี้เป็น replacement guidance/handoff เท่านั้น
- ผู้ดูแล X-ray ไม่ควร Edit, Save หรือ Publish API กลางเอง
- ให้เจ้าของ API กลางตรวจ patch, deploy และรับผิดชอบ regression test
- การอนุมัติแก้ API นี้ไม่ถือเป็นสิทธิ์แก้ Form/API/SQL/Report รายการอื่น

## UAT ขั้นต่ำหลังเจ้าของ API Deploy

| ลำดับ | กรณีทดสอบ | ผลที่ต้องได้ |
|---|---|---|
| 1 | การเงินส่ง Visit ไป `m0900` โดยไม่ส่ง `room_id` | API สำเร็จและสร้าง Visit Tran หนึ่งรายการ |
| 2 | เปิดหน้า X-ray Center ที่ `m0900` โดยไม่เลือก Room | พบคิวใหม่ใน `FRONT`/Unit Queue |
| 3 | ตรวจข้อมูล Visit Tran | `unit_to.value = m0900`, `room_to = null`, `vtran_status = waiting` |
| 4 | กดส่งซ้ำด้วย Visit เดิมในวันเดียวกัน | ได้ผล idempotent/คิวเดิม ไม่สร้างคิวซ้ำ |
| 5 | Center ย้ายคิวไปห้องลูก | คิวหายจาก `FRONT` และปรากฏเฉพาะห้องที่เลือก |
| 6 | ห้องลูกเรียกและเริ่มตรวจ | สถานะเดินตาม EMR queue lifecycle เดิม |
| 7 | ส่ง Visit ไปหน่วย `clinic` เดิม | ทำงานเหมือนก่อนแก้ทุกประการ |
| 8 | ส่งไปหน่วย non-clinic/non-allowlist | API ยังปฏิเสธแบบ fail-closed |

## สิ่งที่ห้ามเปลี่ยนในงานนี้

- ห้ามแก้ `unit_type` ของ `m0900`
- ห้ามสร้าง Room ชื่อ `FRONT` เพื่อแก้ปัญหาเฉพาะหน้า
- ห้ามเพิ่มสิทธิ์ให้ X-ray ทุก Organization โดยอัตโนมัติ
- ห้ามถอด validation เดิมของ clinic
- ห้ามเปลี่ยน contract ของ response หรือความหมายของสถานะคิวเดิม

## เกณฑ์จบงาน

ถือว่างานสมบูรณ์เมื่อ UAT ข้อ 1–8 ผ่าน และมีหลักฐานว่า flow clinic เดิมไม่ถดถอย
หากข้อใดไม่ผ่าน ให้ rollback เฉพาะ patch allowlist ของ API `checkin` โดยไม่แก้
Organization หรือ Room master

## เอกสารอ้างอิงใน repository

- `02-his/handoff/xray-emr-native-queue-replace-v1.md`
- `Form-Builder/API/api-factory/processes/xray_cpoe_worklist_api.js`
- `Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json`

