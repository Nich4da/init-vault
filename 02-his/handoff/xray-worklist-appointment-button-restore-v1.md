---
type: handoff
title: Replace widget xray_cpoe_worklist — เอาปุ่ม "นัดล่วงหน้า" กลับ
created: 2026-10-05
updated: 2026-10-05
tags: [xray, worklist, appointment, replace]
---

# Replace `xray_cpoe_worklist` — ปุ่ม "นัดล่วงหน้า" กลับมาแล้ว

Form ปลายทาง: **X-ray Workbench `6a953fb6422c1ca959829e14`** · widget `xray_cpoe_worklist`

## สิ่งที่เปลี่ยนรอบนี้ (2026-10-05 · ผู้ใช้สั่งเอาปุ่มกลับ)

| ส่วน | เปลี่ยน | รายละเอียด |
|---|---|---|
| `formConfig.cssCode` | +1 / −1 บรรทัด | เพิ่ม `.xr-appointment-button{grid-column:2;grid-row:1}` · ย้าย `.xr-consent-button` กลับ `grid-row:2` |
| widget `content` | +2 บรรทัด | ปุ่ม `นัดล่วงหน้า` ใน `.xr-create-group` ระหว่างปุ่มสร้างรายการใหม่กับหนังสือยินยอม |
| widget `onCreated` | +24 บรรทัด | `APPOINTMENT_FORM_ID` = `6ab207459a834d51703fc158` · `s.appointmentHint` · `s.openAppointment` |
| widget `onMounted` / `onUnmount` | **ไม่เปลี่ยน** | ไม่ต้องแตะ |

## ไฟล์สำหรับ paste (ตรงกับ JSON แบบ byte-for-byte)

| ช่องใน Builder | ไฟล์ |
|---|---|
| Form Setting → `cssCode` | `02-his/form-factory/xray-cpoe-worklist-csscode-v1.txt` |
| widget `xray_cpoe_worklist` → Content | `02-his/form-factory/xray-cpoe-worklist-content-v1.txt` |
| widget `xray_cpoe_worklist` → onCreated | `02-his/form-factory/xray-cpoe-worklist-oncreated-v1.txt` |

🔴 **ต้องวางครบทั้งสามช่อง** — ปุ่มอยู่ใน `content` แต่ handler อยู่ใน `onCreated`
และตำแหน่งปุ่มอยู่ใน `cssCode` · วางไม่ครบจะได้ปุ่มที่กดไม่ทำงาน หรือปุ่มซ้อนกัน

ทางเลือก: import ทั้งไฟล์ `Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json`
ทับ Form เดิมก็ได้ผลเดียวกัน (ได้ widget คิว · สืบค้นผลแลป · scan · local agent ไปด้วย)

## ฝั่ง API Process — ปุ่มนี้ไม่ต้องแก้ แต่ถ้าจะ replace รอบเดียวให้ครบ

ปุ่ม "นัดล่วงหน้า" เปิดจออย่างเดียว **ไม่เรียก Process ใด ๆ** ⇒ ไม่ต้อง replace API เพราะปุ่มนี้

ถ้าจะอัปเดต Process ไปด้วยในคราวเดียว:

| ของ | ไฟล์ | Process ID |
|---|---|---|
| X-ray CPOE Worklist (ทั้งไฟล์คือ body) | `Form-Builder/API/api-factory/processes/xray_cpoe_worklist_api.js` | `6a957009422c1ca959829e45` |

- เวอร์ชันในรีโปรองรับ action: `list` · `resolve_open_visit` · `get_report` · `set_staff` ·
  `retest_items` · `retest_order` · `cancel_order` · `queue` · `queue_call` · `queue_done`
- ตรวจแล้ว 2026-10-05: parse เป็น AsyncFunction ผ่าน · `test_xray_cpoe_worklist_api.js` ผ่าน
- 🔴 **ลำดับ: replace Process ก่อน แล้วค่อย Form** เสมอ
- 🔴 เวอร์ชันนี้ **ยังไม่ join `zdata_xray_contrast_media`** ⇒ หน้า "ประวัติการใช้สารทึบรังสี"
  (`xray-contrast-history-v1.json`) จะไม่พบใบไหนเลย ต้องเพิ่ม `$lookup` ระดับ item
  ผูกด้วย `accession_no` ก่อน จึงจะ import ฟอร์มนั้นแล้วใช้งานได้
- วิธีดูว่าได้ Process ตัวใหม่จริง: กด `ตรวจใหม่เฉพาะที่เลือก` · เลือก Radiographer/Radiologist ·
  `ยกเลิกรายการที่เลือก` · `สร้างรายการใหม่` ตอนพิมพ์ HN ค้างไว้ · เปิด `ดูผล` ของรายการที่มีผล
  หลายฉบับแล้วต้องเห็นปุ่มประวัติการแก้ — ถ้าตัวเก่าจะขึ้นข้อความว่า Process ยังไม่มี action นั้น

## ตรวจหลัง replace

- [ ] ปุ่ม **นัดล่วงหน้า** อยู่แถวแรก ขวาของ "สร้างรายการใหม่" · **หนังสือยินยอม** อยู่แถวล่าง
- [ ] hover ปุ่มเห็น tooltip ว่าต้องมีสิทธิ์ **RIS / XRAY / ADMIN**
- [ ] กดแล้วเปิดจอ **XR Staff Booking** `6ab207459a834d51703fc158`
- [ ] พิมพ์ HN ในช่องค้นหาแล้วกดปุ่ม → จอรับ HN ไปด้วย (ไม่มี HN = ไม่ส่งคีย์นั้น)
- [ ] ของเดิมไม่หาย: สร้างรายการใหม่ · หนังสือยินยอม · สารทึบ · สติ๊กเกอร์ HN · พิมพ์ HN ·
      dropdown เรียงตาม · Radiographer/Radiologist · ปุ่ม ดูภาพ (RIS viewer เปิดอยู่)

## ข้อควรรู้

- คนที่ไม่มีสิทธิ์กดแล้วจะเจอข้อความปฏิเสธ **จากจอนัดเอง** ไม่ใช่ปุ่มพัง
  (`ALLOWED_ROLES = ['RIS','XRAY','ADMIN']` ใน Process `xr-staff-data`)
  ตรวจเมื่อ 2026-09-23: role `RIS` มีในระบบแต่ 0 บัญชีถือ · ไม่มี role `XRAY` · `ADMIN` 24 บัญชี
- ปิดปุ่มได้โดยไม่ต้องแก้โค้ด: generate ใหม่ด้วย `XRAY_APPOINTMENT_FORM_ID=` (ค่าว่าง)
- 🔴 **ตอนนี้ generate ใหม่ไม่ได้**: generator ตกด่านของตัวเองที่บังคับว่า widget LAB
  ต้องมี `s.requestSensitiveAccess=` แต่ฟอร์ม LAB ต้นทางถูกแก้เมื่อ 2026-10-02 (เลิกใช้ re-auth)
  ⇒ JSON รอบนี้ถูก patch เฉพาะสามจุดข้างบน ไม่ได้ลาก widget LAB ฉบับกำลังแก้เข้ามา
- 🔴 ห้าม commit ไฟล์กลุ่มนี้ขึ้น public remote ตามกติกาเดิมของ X-ray Worklist
  (JSON เต็มมี token ของ print agent อยู่ · ไฟล์ .txt สามตัวนี้ตรวจแล้วไม่มี token)
