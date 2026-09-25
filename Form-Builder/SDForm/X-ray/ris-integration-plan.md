---
type: reference
title: X-ray ↔ RIS Integration Plan
created: 2026-09-01
updated: 2026-09-07
tags: [xray, ris, integration, plan]
---

# X-ray ↔ RIS — สัญญาทั้งชุด และแผนต่อจากนี้

**แก้ข้อสรุปของ 2026-09-01:** รอบก่อนผมอ่านแค่ `xray_order` ไฟล์เดียวแล้วสรุปว่า
"สัญญานี้เป็นทางเดียว ไม่มีช่องทางผลอ่าน" — **ผิด** ผู้ใช้อัปโหลดของที่เหลือมาแล้ว
2026-09-02 มีขาเข้าครบ 4 เส้น ⇒ **D-X6 ปลดล็อกแล้ว** เหลือ D-X17 (ดูภาพ) ที่ยังไม่มีจริง

---

## 1. สัญญาทั้งชุด

| Process | ID | ทิศทาง | ตาราง | ทำอะไร |
|---|---|---|---|---|
| `xray_api_order` | `6a8f1ef8…14fe` | **HIS → RIS** | `zdata_xray_order` | ส่งใบสั่ง · upsert ด้วย `AccessionNo` |
| `xray_order_status_change` | `6a861d99…4ab2` | **RIS → HIS** | `zdata_xray_order` | อัปเดตสถานะใบเดิม `A`/`C` + `ImageCapturedDateTime` · **ไม่ insert** |
| `xray-api-ris-result` | `6a861de5…4ab3` | **RIS → HIS** | `zdata_xray_result` | ส่งผลอ่าน · **insert ทุกครั้ง** |
| `xray_resultreset` | `6a95b6d8…9e88` | **RIS → HIS** | `zdata_xray_resultreset` + `zdata_xray_result` | ถอนผลอ่าน · เก็บ audit แล้ว set `Status='C'` |
| `xray-api-ris-schedule` | `6a861e0b…4ab4` | **RIS → HIS** | `zdata_xray_schedule` | นัดหมาย · upsert ด้วย `AccessionNo` |

**`AccessionNo` เป็นกุญแจร่วมของทุกเส้น** — เลขที่เราออกเองคือสิ่งที่ผูกทุกอย่างเข้าด้วยกัน
การตัดสินใจว่า "ห้ามวนเลขซ้ำ หยุดที่ 999" (decision X19) จึงสำคัญกว่าที่คิดตอนนั้น

### โครงสร้างผลอ่าน (ปิด D-X6)

`zdata_xray_result` — 16 ฟิลด์ · บังคับ 6 ตัว: `Hn` `AccessionNo` `ExamUid` `ExamName`
`RadiologistUid` `ResultText` `ResultDateTime`

| ฟิลด์ | ใช้ทำอะไรบนหน้าจอเรา |
|---|---|
| `ResultText` | **ผลอ่านทั้งก้อน ข้อความเดียว** — ไม่ได้แยก Findings / Impression |
| `ResultDateTime` | เวลาออกผล |
| `RadiologistUid` | **รหัส**รังสีแพทย์ ไม่ใช่ชื่อ — ต้อง map เป็นชื่อเอง |
| `SeverityUid` | ความรุนแรง (ยังไม่รู้ชุดค่า) |
| `ImageCapturedDateTime` | เวลาถ่ายจริง |
| `SentDateTime` / `ReceivedDateTime` | เวลาส่ง/รับของฝั่ง RIS |

⇒ Dialog ผลอ่านของเราที่แยกหัวข้อ **Findings / Impression** ต้องยุบเหลือบล็อกเดียว
หรือขอให้ RIS แยกฟิลด์ให้ (คำถามข้อ 4)

### สถานะ (ปิดครึ่งหนึ่งของ D-X9)

`xray_order_status_change` รับ `Status` แค่ **`A` = Arrival · `C` = Completed**

⇒ **`C` คือ "ตรวจเสร็จ" ไม่ใช่ "ยกเลิก"** — สมมติฐานเดิมของเราผิด
ช่องทางยกเลิกที่เหลือมีทางเดียวคือ `IsDeleted: true` ผ่าน `xray_api_order` (คำถามข้อ 1)

### ภาพ (D-X17 ยังไม่มีจริง)

ค้นทั้ง 4 ฟอร์มแล้ว **ไม่มี `StudyInstanceUid` `SeriesUid` `ImageUrl` `ViewerUrl`
หรือ URL ใด ๆ ของ PACS** ⇒ ปุ่ม `ดูภาพ` ยังเปิดไม่ได้จนกว่าจะขอสัญญาเพิ่ม

---

## 2. ปัญหาที่เจอในสัญญาขาเข้า — ต้องแจ้งทีม

### 🔴 1. ผลอ่าน insert ใหม่ทุกครั้ง ไม่เคย update

`xray-api-ris-result` เขียนไว้ตรง ๆ ว่า *"never updates an existing result"*

- RIS ยิงซ้ำเพราะ timeout ⇒ **ได้ผลอ่านสองแถวของเคสเดียวกัน**
- แก้ผลอ่าน (amended report) ⇒ แถวใหม่ **ไม่มีเลขเวอร์ชันหรือ flag ว่าอันไหนล่าสุด**

ฝั่งเราต้องเลือก "แถวล่าสุด" ด้วย `ResultDateTime` เองอย่างจงใจ และต้องโชว์ให้เห็นว่ามี
หลายฉบับ ไม่ใช่เงียบ ๆ หยิบอันแรก · ทางที่ถูกคือขอให้ทีมใส่ **version หรือ upsert**

### 🔴 2. ผลอ่านไม่ตรวจว่า AccessionNo มีอยู่จริง

ต่างจาก `xray_order_status_change` ที่ตอบ `Order not found for AccessionNo` อย่างถูกต้อง
`xray-api-ris-result` เช็คแค่ว่า **มีค่าและยาวไม่เกิน 16** ⇒ เลขพิมพ์ผิดจะกลายเป็น
ผลอ่านลอยที่ไม่ผูกกับใบสั่งใด และไม่มีใครรู้ ควรตรวจก่อน insert

### 🟠 3. `xray_resultreset` อาจ reset ผิดแถว

มันหาแถวผลด้วย `sdformGetOne` ซึ่งคืนแถวเดียว แต่ข้อ 1 ทำให้มีได้หลายแถวต่อ accession
⇒ ถ้ามีผลซ้ำ จะไป set `Status='C'` ให้แถวใดแถวหนึ่งโดยไม่รู้ว่าอันไหน

### 🟠 4. Schedule ยังใช้กฎเข้มที่ทีมผ่อนให้ order ไปแล้ว

`xray-api-ris-schedule` ยังบังคับ `PatientSsn` **13 หลักเป๊ะ** และ `AdmissionNo`
⇒ **นัดหมายผู้ป่วยนอกและผู้ป่วยต่างชาติจะถูกปฏิเสธ** ทั้งที่ฝั่ง order ผ่อนไปแล้ว
2026-09-01 น่าจะตกหล่นตอนแก้ ควรผ่อนให้ตรงกัน

### 🔒 5. Public token อยู่ในไฟล์ซอร์ส

ไฟล์ที่อัปโหลดมามี JWT เต็ม ๆ อยู่ในคอมเมนต์บรรทัดบน 3 ไฟล์
(`xray_api_order.js`, `xray-api-ris-result.js`, `xray_order_status_change.js`,
`xray-api-ris-schedule.js`) · **ยังไม่ถูก commit** และ **ห้าม commit**
token เหล่านี้เปิดให้ยิงข้อมูลเข้าฐานได้โดยไม่ต้องล็อกอิน
ถ้าจะเก็บไฟล์ไว้ในรีโป ต้องแทนที่ด้วย `<TOKEN>` ก่อน

---

## 3. ต้องแก้ของทีมไหม — **แก้แล้ว 2026-09-07** (ข้อสรุปเดิมถูกแทนที่)

> ข้อสรุปเดิม *"ไม่ต้องแก้"* ใช้ได้ตอนเป้าหมายคือ "อ่านผลเข้าหน้าจอให้ได้ก่อน"
> พอจะเปิดเส้นทางยกเลิกใบและถอนผลจริง มันไม่พออีกต่อไป ผู้ใช้จึงสั่ง 2026-09-07 ว่า
> *"แก้จริงตามเราให้ทำงานได้"* · แก้ 3 ไฟล์ ตามนี้ (เทส `test_xray_ris_team_apis.js` คุมไว้แล้ว)

| ไฟล์ | แก้อะไร | ทำไม |
|---|---|---|
| `xray_resultreset.js` | หาแถวผลอ่านเอง แล้วเลือก **ฉบับล่าสุด** (`ResultDateTime` → `xupdatx` → `_id`) + กรอง `xrstatx` · คงเส้นทางสำรอง `sdformGetOne` ไว้ | เดิมหาด้วย `AccessionNo` อย่างเดียว ไม่เรียงลำดับ ⇒ ถอนผลผิดฉบับได้ |
| `xray_api_order.js` | `IsDeleted` ไม่ส่งมา = ไม่แตะค่าเดิม · `xrstatx = 1` เฉพาะตอน insert | เดิมเขียน `false` ทับทุกครั้ง ⇒ ใบที่ยกเลิกแล้วฟื้นคืนเงียบ ๆ พังช่องทางยกเลิกเดียวที่มี |
| `xray-api-ris-schedule.js` | ตัด `PatientSsn`/`AdmissionNo` ออกจาก required (ยังตรวจรูปแบบเมื่อส่งมา) · `IsDeleted`/`xrstatx` กติกาเดียวกับ order | เดิมเข้มกว่า `xray_api_order` ⇒ นัดผู้ป่วยนอกไม่ได้เลย |

**ตั้งใจไม่แก้ `xray-api-ris-result.js`** — ยัง insert ใหม่ทุกครั้ง เพื่อไม่ให้ประวัติผลอ่านหาย
ฝั่งเราเลือกฉบับล่าสุดเองอยู่แล้ว (`xray_cpoe_worklist_api.js`) และตอนนี้ `resultreset`
ใช้ลำดับเดียวกัน ⇒ ทั้งระบบมองเห็น "ฉบับล่าสุด" ตัวเดียวกัน
ส่วนข้อ "ไม่ตรวจว่า `AccessionNo` มีจริง" **ยังไม่แก้** เพราะถ้าเปลี่ยนเป็นปฏิเสธ
ผลอ่านที่มาถึงก่อนใบสั่งจะหายไปเลย ซึ่งแย่กว่าการเก็บแถวกำพร้า — ต้องถามทีมก่อน (คำถามข้อ 3)

**ต้องแจ้งทีม RIS ก่อน deploy:** พฤติกรรม `IsDeleted` เปลี่ยนจริง ถ้าฝั่งเขาพึ่งการถูก
reset เป็น `false` โดยไม่ส่งค่ามา จะได้ผลต่างจากเดิม

---

## 3ก. ข้อสรุปเดิม (เก็บไว้เป็นบันทึก) — **ไม่ต้อง**

ผู้ใช้ถามตรง ๆ ว่าฟอร์ม/API ชุดนี้ทำมาจาก mockup ไม่ได้ดึงจาก CPOE จะใช้ได้ไหม

**ใช้ได้ตามที่เป็น** สำหรับเป้าหมาย "ส่ง order ออกได้ + รับ result ได้" เพราะ:

- 5 process นั้นเป็น **ขอบเขตติดต่อกับ RIS** ไม่ใช่หน้าจอทำงาน — หน้าที่มันคือรับ/ส่ง
  ข้อมูลเข้าออกตารางกลาง ไม่จำเป็นต้องรู้จัก CPOE เลย
- ฟอร์มทั้ง 4 เป็น **หน้าจอดูข้อมูลของตารางกลาง** ไม่ต้องใช้ในงานประจำวัน
  ห้องรังสีทำงานที่ X-ray Workbench ของเรา ไม่ใช่ที่ฟอร์มพวกนั้น
- ตัวเชื่อมที่ขาดไปคือ **การ join ตารางกลางกลับเข้า worklist ของเรา** ซึ่งเป็นงานฝั่งเรา
  ไม่ใช่ของทีม

⇒ ไม่ต้องขอให้ทีมสร้างอะไรเพิ่มเพื่อให้ใช้งานได้รอบนี้
สิ่งที่ควรแจ้งคือ 4 ข้อในหัวข้อ 2 ซึ่งเป็นเรื่องความถูกต้องระยะยาว ไม่ใช่ตัวบล็อก

---

## 4. งานฝั่งเรา

### ✅ Step 1 — อ่านผลอ่านเข้าหน้าจอ (ทำแล้ว 2026-09-02)

- `get_report` เลิกเดาฟอร์ม `RESULT_ITEM_FORM_ID` แล้ว · อ่าน `zdata_xray_result`
  ด้วย `AccessionNo` เรียง `ResultDateTime` หยิบฉบับล่าสุด และคืน `result_versions`
- Dialog ผลอ่านยุบเหลือบล็อกเดียว `ResultText` ตามที่ RIS ส่งมาจริง
- แสดง **รหัส** รังสีแพทย์ตามจริง ไม่เดาชื่อ (รอคำตอบข้อ 5)
- มีหลายฉบับจะขึ้นเตือนว่า "แสดงฉบับล่าสุด"

### ✅ Step 2 — worklist รู้เองว่า "ออกผลแล้ว" (ทำแล้ว)

เลือกทาง **A · join เอาเอง** — worklist `$lookup` `zdata_xray_result` ด้วย `AccessionNo`
แล้ว derive สถานะจาก `result_text` ไม่ต้องมี process เขียนสถานะกลับเข้า CPOE

กติกาที่ใช้ตัดสิน: **มี `ResultText` และ `ResultDateTime` ไม่เก่ากว่า `dispatched_at`**
⇒ ส่งตรวจซ้ำจะรีเซ็ตเป็น "รอผลอ่าน" เองอัตโนมัติโดยไม่ต้องเขียนสถานะเพิ่ม

### ✅ Step 3 — ส่งตรวจซ้ำด้วยเลขเดิม (ทำแล้ว)

ผู้ใช้ยืนยัน 2026-09-02: ถ่ายซ้ำ = กดส่งเข้าเครื่องอีกรอบ **ใช้ Accession เดิม**

- dispatch รับรายการที่มีเลขแล้วและยังไม่ถูกยกเลิก · ไม่เรียกตัวออกเลขซ้ำ
- เลื่อน `dispatched_at` เป็นรอบล่าสุด + `resent_at` + `dispatch_count`
- รายการที่ออกผลแล้วกลับไปเป็น "รอผลอ่าน" ของรอบใหม่
- ปุ่มเปลี่ยนคำเป็น **ส่งตรวจซ้ำ** เพื่อไม่ให้สับสนกับ "ส่งเข้าเครื่องใหม่" (รอบเดิมที่ส่งไม่ผ่าน)
- **ยกเลิก/ปฏิเสธแล้วส่งซ้ำไม่ได้** — เคสนั้นต้องสั่งใหม่จาก CPOE

### ✅ Step 4 — เวลาถ่ายจริง (ทำแล้ว)

`ImageCapturedDateTime` จาก RIS มาก่อน `performed_at`/`dispatched_at` เสมอ

### 🔴 Step 5 — ให้ใบแรกลง RIS ให้ได้ (ยังเหลืออยู่ข้อเดียว)

pre-flight บอกชื่อฟิลด์ที่ขาดเป็นภาษาไทยแล้ว กดส่งแล้วอ่านบรรทัดแดง

### ⛔ Step 6 — ปุ่มดูภาพ (D-X17)

รอสัญญาใหม่ · ยังไม่มีอะไรให้ทำฝั่งเรา

### Step 7 — Schedule (ถ้าอยากได้)

`zdata_xray_schedule` join ด้วย `AccessionNo` ได้ทันที (`StartDateTime`/`EndDateTime`)
ยังไม่ได้ทำเพราะไม่อยู่ในเป้าหมายรอบนี้

---

## 5. คำถามที่ต้องถามทีม RIS

> **อัปเดต 2026-09-07** — ผู้ใช้ส่ง data dictionary ฉบับเต็ม (rev.3 · 2024-04-10 · Chainarong)
> ทำให้ **ข้อ 3 · 4 · 5 (ครึ่งหนึ่ง) ได้คำตอบแล้ว** และข้อ 1 ได้การยืนยันระดับ catalogue
> รายละเอียดอยู่ในหัวข้อ 7 ด้านล่าง · ข้อความคำถามเดิมคงไว้ทั้งหมดเพื่อไม่ให้เสียบริบท

1. **ยกเลิกใบสั่งทำยังไง** — `IsDeleted: true` ผ่าน `xray_api_order` ใช่ช่องทางเดียวใช่ไหม
   (ยืนยันแล้วว่า `Status: 'C'` = Completed ไม่ใช่ Cancel) · ใบที่ `IsDeleted` หายจาก
   worklist ของ modality จริงไหม
2. **ยกเลิกแล้วส่งใหม่ด้วยเลขเดิมได้ไหม** หรือต้องออก `AccessionNo` ใหม่
3. **ผลอ่านซ้ำ/ผลอ่านแก้ไข** — จะให้เราเลือกฉบับล่าสุดจาก `ResultDateTime` เองใช่ไหม
   หรือทีมจะเพิ่ม version/upsert ให้ · แล้ว `Status` บนแถวผลหมายถึงอะไร
4. **`ResultText` แยก Findings / Impression ได้ไหม** หรือส่งมาเป็นก้อนเดียวเสมอ
5. **`RadiologistUid` map เป็นชื่อจากตารางไหน** และ **`SeverityUid` มีค่าอะไรบ้าง**
6. **ดูภาพเปิดยังไง** — มี URL ที่ผูกกับ `AccessionNo` ไหม หรือต้องใช้ `StudyInstanceUID`
   (ตอนนี้ไม่มีทั้งคู่ในสัญญาทั้ง 4 ตัว)
7. **`xray-api-ris-schedule` ผ่อน `PatientSsn`/`AdmissionNo` ให้เหมือน order ได้ไหม**
   ไม่งั้นนัดผู้ป่วยนอกไม่ได้
8. `Priority` — `S` ในเอกสารเขียนว่า "State" ตั้งใจให้เป็น `Stat` หรือเปล่า
9. `PatientStatusText` (Walk/Wheelchair/Stretcher/Portable) ห้องรังสีใช้จริงไหม

### สถานะคำถามหลังอ่าน data dictionary (2026-09-07)

| ข้อ | สถานะ | สรุป |
|---|---|---|
| 1 ยกเลิกใบสั่ง | 🟡 ยืนยันทิศทาง | catalogue มี **Order Cancel** เป็น message แยก และ Order มีฟิลด์ `IsDeleted` (bit · default false) ⇒ สมมติฐานเดิมถูก · ยังต้องถามว่าใบที่ `IsDeleted` หายจาก worklist ของ modality จริงไหม |
| 2 ยกเลิกแล้วส่งใหม่ | ❌ ยังไม่มีคำตอบ | dictionary ไม่ได้พูดถึงการใช้ `AccessionNo` ซ้ำ |
| 3 ผลอ่านซ้ำ/แก้ไข | ✅ **ตอบแล้ว** | `Status` บนแถวผล = **`P = Prelim` · `F = Finalized`** · catalogue มี **Result Edit** และ **Result Addendum** แยกต่างหาก · แถว Result Reset ในเอกสารเขียนว่า *"รับเพื่อรอการแก้ไขผลอ่าน (กรณีไม่รับ Result Edit)"* ⇒ Reset+Result คือทางสำรองของ Result Edit |
| 4 `ResultText` แยก Findings/Impression | ✅ **ตอบแล้ว — แยกไม่ได้** | มีฟิลด์เดียว `ResultText` = ผลวินิจฉัย ⇒ dialog ผลอ่านของเราต้องยุบเหลือบล็อกเดียวจริง |
| 5 `RadiologistUid` / `SeverityUid` | 🟡 ตอบครึ่ง | `RadiologistUid` map ผ่าน **Doctor service (`GetEmployee`)** → `DoctorUid` + ชื่อไทย/อังกฤษ · **`SeverityUid` ยังไม่มี master service ให้ดึงชุดค่า** |
| 6 ดูภาพ | 🟡 แคบลง | ยังไม่มี `StudyInstanceUid`/URL ในสัญญาเลย แต่ dictionary ระบุว่า **`AccessionNo` = "เลข Unique ของระบบ PACS"** ⇒ เหลือถามแค่ "รูปแบบ URL ของ viewer ที่ผูกกับ AccessionNo" |
| 7 schedule ผ่อน `PatientSsn`/`AdmissionNo` | 🔄 **ต้องกลับด้านคำถาม** | dictionary กำหนดทั้งสองฟิลด์เป็น required **ทั้ง Order และ Schedule** ⇒ schedule ที่เข้มคือ "ตรงสัญญา" ส่วน order ที่ผ่อนคือส่วนที่เบี่ยง · ประเด็นจริงคือ OPD ไม่มี `AdmissionNo` ⇒ ต้องคุยระดับสัญญา ไม่ใช่ขอผ่อนเป็นราย endpoint |
| 8 `Priority` `S` | ❌ ยังกำกวม | rev.3 ยังเขียน `R = Routine (Default)` · **`S = State`** · `U = Urgent` เหมือนเดิม |
| 9 `PatientStatusText` | 🟡 นิยามมี | เอกสารระบุ Walk / Wheelchair / Stretcher / Portable · เหลือถามว่าห้องรังสีใช้จริงไหม |

---

## 7. Data dictionary ฉบับเต็ม — สิ่งที่เพิ่งรู้ (2026-09-07)

อ้างอิง: `Interface data dictionary_RestFUL_ร.พ.เด็ก` rev.3 · 2024-04-10 · Chainarong
(ผู้ใช้ส่งเข้าบทสนทนา ยังไม่ได้เก็บไฟล์ไว้ในรีโป)

### 7.1 สัญญามี 17 message — เรารู้จักแค่ 5

| กลุ่ม | message | สถานะฝั่งเรา |
|---|---|---|
| Patient | Patient Register · Patient Edit · Patient Merge | **ยังไม่ได้ทำเลย** (HIS→RIS) |
| Patient | Patient Request Data (Visit / Allergy / Lab) | ยังไม่ได้ทำ (RIS→HIS ดึงด้วย HN) |
| Order | Order · **Order Edit** · **Order Cancel** · Order Status Change | ทำแล้ว 2 (Order, Status Change) |
| Schedule | Schedule · **Schedule Edit** · **Schedule Cancel** | มีตารางรับ ยังไม่ได้ใช้ |
| Result | Result · **Result Edit** · Result Reset · **Result Addendum** | ทำแล้ว 2 (Result, Reset) |
| Master (เราดึงจาก RIS ได้) | InsuranceType · Unit · Doctor (`GetEmployee`) · Exam (`GetExam`) | **ยังไม่ได้ดึงเลย** |

### 7.2 endpoint อยู่ฝั่ง RIS

`[http|https]://[EnvisionServer]/EnvisionRIE3rdParty/ThirdParty/{GetPatient|GetOrder|GetInsuranceType|GetUnit|GetEmployee|GetExam}`

⚠️ ชื่อขึ้นต้นด้วย `Get` แต่เป็น **POST ที่เราส่งข้อมูลเข้าไป** ไม่ใช่ endpoint สำหรับดึง
อย่าอ่านชื่อแล้วสรุปทิศทางเอง

### 7.3 ค่าคงที่ที่ยืนยันจากเอกสาร

- `AcknowledgementCode`: `AA` = Accepted · `AR` = Rejected · `AE` = Error (ทุก service)
- `PatientGender`: `M` / `F` / `U`
- `PatientClassUid`: `O` = OPD · `I` = IPD · `E` = ER
- **Order `Status`**: `N` = Request · **`A` = Arrival (default)** ← ต่างจาก Order Status Change ที่รับ `A`/`C`
- **Order Status Change `Status`**: `A` = Arrival · `C` = Completed
- **Result `Status`**: `P` = Prelim · `F` = Finalized
- **Result Reset `Status`**: `C` = Reset Result
- `Priority`: `R` = Routine (default) · `S` = State · `U` = Urgent
- วันที่ทุกช่องเป็น **ค.ศ.** (`Request - A.D.`) · `Content-Type` = `application/json`
- `ModalityUid` รองรับ 16 ตัวอักษร · `AccessionNo` = เลข Unique ของระบบ PACS

### 7.4 สองข้อที่กระทบแผนเดิม

1. **ข้อ 4 ในหัวข้อ 2 ต้องกลับด้าน** — ดูตารางสถานะคำถามข้อ 7 ด้านบน
2. **เราอาจข้ามขั้นตอน Patient ทั้งชุด** — เอกสารระบุว่า HIS ต้องส่ง Patient Register
   ทุกครั้งที่ผู้ป่วยลงทะเบียน และ Patient Edit ทุกครั้งที่แก้ข้อมูล ขณะที่เราส่งข้อมูล
   ผู้ป่วยฝังไปกับ Order เท่านั้น · **ถ้า RIS ต้องมีผู้ป่วยอยู่ก่อนจึงรับ Order ได้
   นี่อาจเป็นสาเหตุที่ Step 5 (ใบแรกลง RIS) ยังไม่ผ่าน** — ต้องถามทีมก่อน ห้ามแก้โค้ดจากการเดา

### 7.5 ยังไม่มีคำตอบในเอกสาร

- `SeverityUid` มีฟิลด์แต่ไม่มี master service ให้ดึงชุดค่า
- ความหมายของ `*` / `**` / `***` ไม่ได้นิยามไว้ที่ไหนในเอกสาร
- URL ของ Schedule · Order Status Change · Result · Result Reset (ช่อง Url link ว่าง)
- Result Edit / Result Addendum / Order Edit / Schedule Cancel — ไม่มีหน้าสเปกของตัวเอง
  และไม่รู้ว่าทีมเปิดใช้แล้วหรือยัง

---

## 6. ของเดิมที่ยังค้างอยู่

- ฟอร์ม `xray_order` บังคับ 11 ฟิลด์ แต่ API บังคับ 9 (`AdmissionNo`/`PatientSsn` ต่าง)
- `sdformGetOne` หา `AccessionNo` **ไม่กรอง `xrstatx`** ทั้งใน order, schedule, resultreset
- **ไม่มี unique index บน `AccessionNo`** ทั้งที่เป็นกุญแจร่วมของทั้งระบบ
- เราส่ง 23 จาก 71 ฟิลด์ของ order · ที่ควรเติมจากข้อมูลที่มีอยู่แล้ว:
  `ReferenceUnitName` · `InsuranceTypeDesc` · `ReferringDoctorTitle/FName/LName` แยกช่อง ·
  `MessageControlId` · `ExamRate`/`OrderDtlRate`
- `xray_order_log.json` มี checksum เท่ากับ `xray_order.json` — ไฟล์เดียวกันสองชื่อ
