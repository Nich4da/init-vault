---
type: design
title: X-ray Workbench SDForm — Design Reference
created: 2026-08-31
updated: 2026-08-31
tags: [xray, sdform, worklist, design]
---

# X-ray Workbench SDForm — Design Reference

โฟลเดอร์นี้คือ **working location ที่ผู้ใช้อนุมัติ** สำหรับสร้าง SDForm ของหน่วยรังสีวิทยา

ยังไม่มี SDForm JSON ในโฟลเดอร์นี้ — ไฟล์นี้กับ `spec.md` เป็นเอกสารตั้งต้นก่อนสร้าง

## แหล่งอ้างอิงตามลำดับ

| ลำดับ | ไฟล์ | ใช้ทำอะไร |
|---:|---|---|
| 1 | `../../../design/Xray_design.md` | สเปกภาพ + business rule + Appendix A–F ทั้งหมด · **ต้นฉบับเดียว** |
| 2 | `../../../design/Xray_design-contract.md` | decision record · evidence · keep/change/do-not-copy |
| 3 | `../../../design/Xray_implementation-handoff.md` | ลำดับงาน · สิ่งที่ artifact แรกต้องพิสูจน์ |
| 4 | `../../../02-his/ui/xray-workbench-mockup.html` | หน้าต้นแบบที่ผู้ใช้ตรวจแล้ว 4 รอบ |
| 5 | `../../../design/Lab_design.md` | ต้นฉบับระบบภาพ (สี ตัวอักษร ระยะ ขนาด motion) **ห้าม re-derive** |
| 6 | `../../../02-initcraft/governance/from-codex-backup/SDFORM_JSON_RULES.md` | **ต้องอ่านก่อนแตะ JSON ทุกครั้ง** |
| 7 | `./spec.md` | สเปกการสร้างไฟล์ JSON ตัวจริง |

## สรุปสิ่งที่ต้องสร้าง

หน้าเดียว desktop-first สำหรับหน่วยรังสีวิทยา แสดงใบสั่งที่มาจาก CPOE
รับรายการและส่งเข้าเครื่องผ่าน API → Agent แล้วติดตามผลอ่าน

## กติกาที่ต่างจาก LAB — จำให้ครบก่อนเริ่ม

| # | กติกา |
|---:|---|
| 1 | **1 order = 1 accession = 1 test** — LAB คือ 1 order หลาย test · หนึ่งแถวใน worklist คือหนึ่งรายการตรวจ |
| 2 | **ไม่มี specimen** และ **ไม่มี Lab No.** ห้ามมีคอลัมน์หรือด่านตรวจใด ๆ ที่เกี่ยวกับ specimen |
| 3 | **ไม่มี checkbox ราย item** และไม่มีการปฏิเสธราย item — ทุก action กินทั้งใบ |
| 4 | ปุ่มใน detail มีเพียง `ส่งเข้าเครื่อง` และ `ยกเลิก order` (ใบที่ยกเลิกเปลี่ยนเป็น `ตรวจใหม่`) |
| 5 | **dropdown เลือกเครื่อง** แทรกระหว่าง `Date Range` กับปุ่ม `Search` · 19 ค่า · ค่าเริ่มต้น `Select all` · กรองทันที |
| 6 | ตัวเลขบน status chip ต้องนับ **ภายใต้ตัวกรองเครื่องปัจจุบัน** |
| 7 | **เลขสองชุด**: `Order No.` มาจาก CPOE (ระดับ order) · `Accession No.` ห้องรังสีออกเอง (**ระดับ test**) |
| 8 | ทุก test ผูกเครื่องไว้ตั้งแต่ตอนสั่ง — **ไม่มีสถานะ "ไม่ระบุเครื่อง"** ในหน้าจอ |
| 9 | ปุ่มท้ายแถวอยู่คอลัมน์เดียว เรียงต่อกัน **ห้ามเว้นช่อง `–`** · ใบที่ยกเลิกเหลือ `EMR` ปุ่มเดียว |
| 10 | เหตุผล/ผู้ยกเลิกแสดงเป็นคอลัมน์ `ปฏิเสธ` / `คนปฏิเสธ` ในตารางระดับ test ไม่ใช้ popup |
| 11 | ผลเป็น **document** (findings / impression) ไม่ใช่ตารางค่าเชิงตัวเลขแบบ LAB |
| 12 | แท็บผลอ่านมีปุ่ม `ดูภาพ` ที่ยังไม่ต่อระบบ — ต้องบอกว่ารอเชื่อมกับโปรแกรม RIS |
| 13 | `ส่งเครื่องไม่สำเร็จ` แยกจากการยกเลิก และ **ห้าม rollback การรับ** |
| 14 | ขอบเขตหน่วยงาน enforce ที่ server แบบ fail-closed · dropdown เครื่องเป็นตัวกรองการแสดงผลเท่านั้น ไม่ใช่ตัวให้สิทธิ์ |

## ระบบภาพ

ยกจาก `Lab_design.md` ทั้งชุด ไม่มี token ใหม่ ค่าที่เปลี่ยนมีเฉพาะที่ระบุใน
`Xray_design.md` §4 (toolbar 10 คอลัมน์ · worklist min-width `1310px` · ตาราง test min-width `1180px`)

## ข้อห้ามเด็ดขาด

- ห้าม hard-code รายชื่อเครื่อง ค่าผล ชื่อผู้ใช้ organization หรือ mapping ใด ๆ ลงในฟอร์ม
- ห้ามฝังข้อมูลผู้ป่วยจริง credential URI หรือค่าเฉพาะ environment
- ห้ามคำนวณ `Order No.` หรือ `Accession No.` ที่ฝั่งหน้าจอ
- ห้ามผูกพฤติกรรม Agent ที่ยังไม่เคาะ (D-X2, D-X3, D-X12, D-X14 ถึง D-X17) เหมือนว่าเป็นข้อสรุปแล้ว
- ห้ามแก้ไฟล์ใน `../backup/` และ `../best-practices/`

## สถานะ decision ที่ยังค้าง

อ่านรายละเอียดใน `Xray_design.md` Appendix D — ตัวที่บล็อกการต่อ backend:

- **D-X2 / D-X14** รายชื่อและ code ของเครื่อง 19 ค่ายังไม่ตรงกับ `modality_type` ใน `section.json`
- **D-X3** Agent submit validator ปัจจุบันบังคับ `labno` และ `specimen_code` → X-ray ใช้ไม่ได้ตามสภาพ
- **D-X6** โครงสร้างผลอ่านจริง
- **D-X17** contract ของ RIS สำหรับปุ่ม `ดูภาพ`

รอบแรกที่ผู้ใช้สั่ง — **แสดงรายการที่สั่งมาจาก CPOE ให้ได้ก่อน** — ไม่ติด decision เหล่านี้
