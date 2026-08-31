# X-ray Workbench Design and Functional Specification

สถานะเอกสาร: implementation baseline สำหรับหน่วยงาน X-ray ดัดแปลงจาก `Lab_design.md` ที่ผู้ใช้ตรวจทานแล้ว

อัปเดต: 2026-08-31 (รอบแก้ที่ 4 ตาม feedback ผู้ใช้)

หน้าต้นแบบ: `../02-his/ui/xray-workbench-mockup.html` (ตรวจด้วย headless Chrome แล้ว ไม่มี console error)

ฐานอ้างอิง: `design/Lab_design.md` · `design/Lab_design-contract.md` · `design/lab-cpoe-integration-checklist.md` · `02-his/ui/lab-workbench-stock-pattern-mockup.html`

ขอบเขต: Desktop-first one-page X-ray workbench สำหรับดูใบสั่งที่มาจาก CPOE, กรองตามเครื่อง/ประเภทการตรวจ, รับรายการและส่งเข้าเครื่องผ่าน API → Agent, ติดตามสถานะและผลอ่าน

> **กติกาแม่**: X-ray ใช้ระบบภาพ (สี ตัวอักษร ระยะ ขนาด component motion) **เหมือน LAB ทุกประการ** เอกสารนี้พูดเฉพาะสิ่งที่ต่าง ส่วนที่เขียนว่า "เหมือน LAB" ให้ยึด `Lab_design.md` เป็นต้นฉบับเดียว ห้าม re-derive ค่าใหม่ ถ้า `Lab_design.md` §2–§4, §6–§7 ถูกแก้ ต้องกลับมาตรวจว่ากระทบ X-ray หรือไม่
>
> ค่าผล ชื่อบุคคล จำนวนรายการ และรหัสเครื่องในเอกสารนี้เป็นตัวอย่าง ห้าม hard-code ลงระบบจริง

---

## 0. สรุปความต่างจาก LAB (อ่านก่อนสิ่งอื่น)

| # | หัวข้อ | LAB | X-ray |
|---|---|---|---|
| 1 | ตัวกรองห้อง/ประเภท | ไม่มี dropdown; ระบบ derive section จาก Organization ของผู้ login | **มี dropdown เลือกเครื่อง** วางระหว่าง Date Range กับปุ่ม Search ค่าเริ่มต้น `Select all` |
| 2 | Specimen | มีคอลัมน์ specimen + combobox ต้องเลือกก่อนรับ | **ไม่มี** ทั้งคอลัมน์และการบังคับกรอก |
| 3 | โครงสร้างใบ | **1 order มีได้หลาย test** | **1 order = 1 accession = 1 test** — ผู้ใช้ยืนยัน 2026-08-31 |
| 3ก | เลขอ้างอิง | Lab No. สร้างตอนรับ specimen ครั้งแรก | **ไม่มี Lab No.** ใช้ **Accession No.** ซึ่งเป็นคนละเลขกับ Order No. อยู่ **ระดับ test** และห้องรังสีออกเองตอนส่งเข้าเครื่อง |
| 4 | การรับรายการ | รับ specimen ราย test ด้วย checkbox → ตรวจ specimen master → สร้าง Lab No. → ส่ง Agent | **กดรับแล้วส่งเข้าเครื่องได้ทันที ทั้งใบ** ไม่มีด่าน specimen และ **ไม่มี checkbox เลือกราย item** |
| 5 | เวลาเก็บ / เวลารับ specimen | สองเวลาแยกกัน | ใช้ **เวลาส่งเข้าเครื่อง** เวลาเดียว |
| 6 | คอลัมน์ที่ 5 ของ worklist | จำนวน specimen | **เครื่อง / ประเภทการตรวจ** |
| 7 | ผลตรวจ | ค่าเชิงตัวเลข + unit + reference range + critical | **ผลอ่าน (report text) + ภาพ** โครงสร้างผลต่างกัน → decision **X6** |
| 8 | ชุดแม่-ลูก | มี `sub_order` (แชร์หลอดเดียว) และ `lab_parent` (exclusive) | ยังไม่ยืนยันว่า X-ray ใช้ชุดหรือไม่ → decision **X5** |
| 9 | หน่วยของการทำงาน | Item — รับ/ปฏิเสธ ราย test ได้ | **Order** — และเพราะ 1 order = 1 test หน่วยนี้จึงเท่ากับ test พอดี |
| 12 | เครื่อง/ประเภทการตรวจ | specimen ต้องเลือกตอนรับ | **ผูกมากับ test ตั้งแต่ตอนสั่งใน CPOE เสมอ** ไม่มีเคส "ไม่ระบุเครื่อง" |
| 13 | เลขที่ใบ (Order No.) | ตาม CPOE ปัจจุบัน | **มาจากใบสั่ง CPOE — รังสีเป็นฝ่ายรอรับ ไม่ได้ออกเอง** `YYYYMMDD` + running 3 หลัก เช่น `20260831011` |
| 14 | Accession No. | ไม่มีแนวคิดนี้ | **ห้องรังสีออกเองตอนส่งเข้าเครื่อง** `YYYYMMDD` + code เครื่อง + running 3 หลัก เช่น `20260831CT001` · **running นับแยกตาม modality และแยกตามวัน** |
| 10 | ปุ่มใน detail | `รับ specimen` · `ปฏิเสธรายการที่เลือก` · `ยกเลิก order` | **`ส่งเข้าเครื่อง` · `ยกเลิก order`** เท่านั้น |
| 11 | PDF ของใบที่ยกเลิก | แสดงปุ่ม PDF | **ไม่แสดงปุ่ม PDF** |

ทุกข้ออื่นให้ถือว่าเหมือน LAB

---

## 1. Visual Theme & Atmosphere

เหมือน `Lab_design.md` §1 ทุกข้อ ยกเว้นข้อเดียว:

- LAB: "Worklist ถูกกำหนดจาก organization/lab section ของผู้ใช้ที่ login; UI ไม่แสดงตัวเลือกห้อง LAB ให้ผู้ใช้เลือกเอง"
- **X-ray**: Worklist ถูกจำกัดที่ระดับ **หน่วยงานรังสี** จาก Organization ของผู้ใช้ (server enforce, fail-closed) แต่ **ภายในหน่วยงานผู้ใช้เลือกเครื่องเองได้** ผ่าน dropdown บน toolbar
- Dropdown เครื่องเป็น **ตัวกรองการแสดงผล** ไม่ใช่ตัวให้สิทธิ์ การเลือก `Select all` ต้องไม่ทำให้เห็นงานนอกหน่วยงานของผู้ใช้

---

## 2. Color

**เหมือน `Lab_design.md` §2 ทั้งหมด** — token, semantic mapping, patient context pill, filter chip, accessibility

X-ray เพิ่มการใช้งาน token เดิมสองจุด ไม่มี token ใหม่:

| จุดใช้งาน | Border | Background | Text |
|---|---|---|---|
| รอรับ / รอผลอ่าน | `warning-200` | `warning-50` | `#b88230` |
| รับแล้ว / ส่งเครื่องแล้ว / ออกผลแล้ว | `success-200` | `success-50` | `#529b2e` |
| ปฏิเสธ / ยกเลิก / เร่งด่วน | `danger-200` | `danger-50` | `#c45656` |
| ป้ายเครื่อง (modality tag) | `#c8c9cc` | `#f4f4f5` | `#73767a` |
| ส่งเครื่องไม่สำเร็จ (transport failed) | `danger-200` | `danger-50` | `#c45656` |

- ป้ายเครื่องเป็น **neutral** เสมอ ห้ามแจกสีประจำเครื่องแต่ละตัว (19 ค่า = 19 สี = อ่านไม่ออก)
- `ส่งเครื่องไม่สำเร็จ` ต้องมีข้อความกำกับ ไม่ใช้สีอย่างเดียว และต้องแยกจาก `ปฏิเสธ` ให้ชัด เพราะรายการยัง **รับแล้ว** อยู่
- X-ray **ไม่มี critical value marker** ที่ระดับ worklist; ถ้า Agent ส่ง flag ผลผิดปกติมาให้ใช้ข้อความ ไม่ใช่วงกลมสี

---

## 3. Typography

**เหมือน `Lab_design.md` §3 ทั้งหมด** ไม่มีข้อยกเว้น

เพิ่มเฉพาะกฎการใช้:

- ชื่อเครื่อง/modality ใน dropdown และในแถวรายการใช้ค่า **ตามที่ master ส่งมา** ห้ามแปลงเป็นตัวพิมพ์ใหญ่ทั้งหมดและห้ามแปลเป็นไทยเอง
- เลขอ้างอิงส่งตรวจ (ถ้ามีตาม X1) ใช้ mono/tabular เหมือน Lab No.

---

## 4. Spacing & Grid

### 4.1 Page และ toolbar — **มีการเปลี่ยน**

- Page padding, header margin, toolbar gap `10px`, bottom margin `18px`: เหมือน LAB
- **Toolbar columns เปลี่ยนจาก 6 เป็น 7 คอลัมน์** เพราะแทรก dropdown เครื่อง:

```css
/* LAB (เดิม) */
minmax(230px,310px) minmax(250px,310px) auto auto minmax(24px,1fr) auto

/* X-ray */
minmax(230px,310px) minmax(250px,310px) minmax(170px,220px) auto auto minmax(24px,1fr) auto
```

ลำดับคอลัมน์: `ค้นหา` · `Date Range` · **`เครื่อง (dropdown)`** · `Search` · `Report` · spacer · `สร้างรายการใหม่`

> ตำแหน่งนี้ตีความจาก "แทรกระหว่างปุ่ม search กับ daterange" ตามลำดับจริงใน mockup ซึ่งเรียง `Date Range` ก่อน `ปุ่ม Search` หากต้องการให้อยู่ก่อน Date Range แทน ให้สลับคอลัมน์ที่ 2 กับ 3 เป็นการแก้บรรทัดเดียว ไม่กระทบสเปกอื่น

- Status filters: เหมือน LAB (flex row, gap `8px`, bottom margin `18px`)

### 4.2 Worklist — **มีการเปลี่ยน**

- Outer shell, row min-height `84px`, row padding `10px 12px`, column gap `10px`: เหมือน LAB
- **Desktop worklist minimum width ลดจาก `1390px` เป็น `1310px`** เพื่อให้พอดีจอ 1440 โดยไม่ต้องเลื่อนแนวนอน
  (LAB กว้างกว่าเพราะมีคอลัมน์ specimen; X-ray ตัดออกแล้วบีบทุกคอลัมน์ลงเล็กน้อย)
- Column pattern:

```css
30px
minmax(165px,1.3fr)
minmax(142px,1fr)
minmax(145px,1.25fr)  /* LAB = จำนวนรายการ → X-ray = ชื่อรายการตรวจ (1 order = 1 test) */
92px                  /* LAB = จำนวน specimen → X-ray = เครื่อง (ค่าเดียว) */
126px
100px
minmax(110px,.95fr)
84px
196px                 /* คอลัมน์ปุ่มรวม — LAB แยกเป็น 3 คอลัมน์ 54/62/54 */
```

- คอลัมน์ context แคบกว่า LAB ⇒ **`.context-top` ต้อง `flex-wrap:wrap`** ไม่งั้น pill ที่สอง
  จะล้นไปทับคอลัมน์ `รายการ` (เจอจริงตอนรีวิว 2026-08-31)
- คอลัมน์ `เครื่อง` มีค่าเดียวเสมอ (1 order = 1 test) แสดงเป็น tag เดียว
  ห้ามใช้รูปแบบ `เครื่องแรก +N` เพราะผู้อ่านไม่รู้ว่า `+N` หมายถึงอะไร
- คอลัมน์ `รายการตรวจ` แสดงชื่อ test บรรทัดเดียวตัดท้ายด้วย ellipsis และรหัส test บรรทัดล่างขนาด `10px`
- **ปุ่มท้ายแถวอยู่ในคอลัมน์เดียว** จัดชิดขวา `display:flex`, gap `6px` ปุ่มต่อกันเสมอ
  ต่างจาก LAB ที่แยกเป็นสามคอลัมน์คงที่ **ห้ามเว้นช่องว่างหรือใส่ `–` แทนปุ่มที่ไม่มี**
  (ผู้ใช้สั่งตัดคอลัมน์ `–` ออก 2026-08-31)

ลำดับคอลัมน์: expand · patient · context pills · จำนวนรายการ · **เครื่อง** · เวลาสั่ง/Order No. · เวลาสถานะ · แพทย์/Diagnosis · สถานะ Order · PDF/detail · ส่งเครื่อง/ยกเลิก · EMR

### 4.3 Expanded detail — **มีการเปลี่ยน**

- Panel padding, detail header, tab, bulk action, summary: เหมือน LAB
- **ตารางรายการตรวจ minimum width ลดจาก `1340px` เป็น `860px`** (ตัดคอลัมน์ Lab No., specimen combobox, เวลาเก็บ specimen, checkbox และคอลัมน์ปฏิเสธออก)
- Standard detail table minimum width `990px`, heading height `36px`, row cell height `52px`: เหมือน LAB
- **ไม่มีบรรทัดสรุป (`detail-summary`) คั่นระหว่างหัว Order กับตาราง** — ตัวเลขสรุปไม่มีประโยชน์
  เมื่อใบมี test เดียว ให้ตารางเริ่มทันทีหลังแถบแท็บ/ปุ่ม

### 4.4 Dialog และ responsive — เหมือน LAB ทั้งหมด

เพิ่มกฎ breakpoint สำหรับ dropdown เครื่อง:

- `980px`: dropdown เครื่องอยู่แถวเดียวกับ Date Range เต็มความกว้างครึ่งหนึ่ง
- `680px`: dropdown เครื่องเป็นแถวเต็มของตัวเอง วางใต้ Date Range เหนือปุ่ม Search
- dropdown ต้อง render เหนือแถว Order เสมอ (menu z-index `120`, active Order z-index `60`) เหมือนกฎ combobox ของ LAB

---

## 5. Layout & Composition

### 5.1 Page hierarchy

1. Page title และคำอธิบายสั้น
2. `ค้นหา` · `Date Range` · **`เครื่อง`** · `Search` · `Report` · `สร้างรายการใหม่`
3. Filter chips สี่ตัว
4. Order worklist แบบขยายได้
5. Implementation remark panel เฉพาะบริบท prototype
6. Dialog layers: ผลอ่าน, ยืนยันส่งเครื่อง, ปฏิเสธ, ยกเลิก, ตรวจใหม่

### 5.2 Order summary content

เก็บทุกอย่างเหมือน LAB ยกเว้น:

- **ตัด** `จำนวน specimen` และ **ตัด** `จำนวนรายการ` (ไม่มีความหมายเมื่อใบมี test เดียว)
- **เพิ่ม** `รายการตรวจ` — ชื่อ test และรหัส test ของใบนั้น
- **เพิ่ม** `เครื่อง` — เครื่องเดียวของ test นั้น
- ปุ่มท้ายแถวเรียงต่อกันในคอลัมน์เดียว: `PDF` (เมื่อไม่ใช่ใบที่ยกเลิก) · `ดูผลอ่าน` (เมื่อมีผล) · `EMR` (เสมอ)
- ใบที่ยกเลิกแล้วเหลือ **`EMR` ปุ่มเดียว** — ไม่มี `PDF` และไม่มีปุ่ม `ดู` รายละเอียดการยกเลิก
  เหตุผลและผู้ยกเลิกไปอยู่เป็นคอลัมน์ในตารางระดับ test แทน (§5.4)
- `เวลาสถานะ` เปลี่ยนความหมายเป็น: เวลาสั่ง → **เวลาส่งเครื่อง** → เวลาออกผล → เวลายกเลิก
- EMR ยังคงเปิดได้ทุกสถานะเหมือน LAB

### 5.3 Order detail tabs

- `order`: รายการตรวจและประวัติการดำเนินการ
- `ผลอ่าน`: รายการผลและ action ของผล
- Order ที่ยังไม่ส่งเครื่องและไม่มีผล → แท็บ `ผลอ่าน` disabled พร้อมคำอธิบายเหตุผล
- การยกเลิก Order แทนที่ detail ด้วยมุมมองรายการที่ถูกยกเลิก ไม่ลบรายการเดิม

### 5.4 ตารางรายการตรวจ (แทน specimen table ของ LAB)

1. **Accession No.**
2. รายการตรวจ (ชื่อ + รหัส)
3. เครื่อง / ประเภทการตรวจ
4. เวลาสั่ง
5. เวลาส่งเข้าเครื่อง
6. ผู้ส่ง
7. สถานะ
8. **ปฏิเสธ** (เหตุผล)
9. **คนปฏิเสธ**

- **Accession No. อยู่ที่ตารางระดับ test เท่านั้น ไม่ใช่ระดับ Order** (ผู้ใช้ยืนยัน 2026-08-31)
  ว่างเป็น `–` จนกว่าจะกดส่งเข้าเครื่อง แสดงด้วย mono/tabular numerals
- คอลัมน์ `ปฏิเสธ` / `คนปฏิเสธ` ใช้ชื่อเดียวกับตาราง LAB และเติมค่าจากเหตุการณ์ยกเลิกใบ
  (เหตุผล + ผู้ทำ) **แทนการเปิด popup รายละเอียดการยกเลิก** ซึ่งถูกตัดออกแล้ว

- ตารางมีแถวเดียวเสมอ (1 order = 1 test) จึง **ไม่มีคอลัมน์ `ลำดับ`**
  และเพิ่ม `ผู้ส่ง` แทน เพราะเป็นข้อมูลที่แถว worklist ไม่ได้แสดง
- **ไม่มี** checkbox — X-ray ทำงานที่ระดับใบ ไม่ต้องเลือกรายการ
- **ไม่มี** คอลัมน์ Lab No., specimen, เวลาเก็บ specimen

- คอลัมน์ `เครื่อง` เป็น **read-only** มาจาก master/section ของรายการ ไม่ใช่ dropdown ให้ผู้ใช้เลือก — การเลือกเครื่องเป็นเรื่องของ CPOE/master ไม่ใช่ห้องรังสีมาเปลี่ยนทีหลัง (ถ้าจำเป็นต้องแก้ได้ ให้เปิดเป็น decision ใหม่ อย่าเงียบ ๆ ทำเป็น editable)
- **ทุก test ผูกเครื่องไว้แล้วตั้งแต่ตอนสั่ง** (ผู้ใช้ยืนยัน 2026-08-31) จึงไม่ต้องออกแบบสถานะ
  "ไม่ระบุเครื่อง" ในหน้าจอ ถ้า API คืนรายการที่ไม่มีเครื่อง ให้ถือเป็น **ข้อผิดพลาดของข้อมูล**
  แจ้งให้ผู้ดูแลตรวจสอบ ไม่ใช่สถานะปกติที่ผู้ใช้ต้องจัดการเอง

### 5.5 Result list และ result popup

- Result list: ลำดับ, ชื่อรายการ, เครื่อง, เวลาออกผล, action, สถานะ
- action มีสองปุ่ม: **`ดูผลอ่าน`** เปิด popup ข้อความผล และ **`ดูภาพ`** สำหรับเปิดภาพ
  ปัจจุบัน `ดูภาพ` ยังไม่ต่อระบบจริง ให้แจ้งว่า **รอเชื่อมกับโปรแกรม RIS** ไม่ใช่ปุ่มตายที่ไม่ตอบสนอง
- Popup ผลอ่าน X-ray ใช้โครง **document** ไม่ใช่ตารางค่าเชิงตัวเลขแบบ LAB:
  1. หัวเรื่อง: รายการตรวจ · เครื่อง · เวลาถ่าย · เวลาออกผล
  2. `Findings` — ข้อความยาว ต้อง wrap เต็ม ห้ามตัดบรรทัด
  3. `Impression` — ข้อความยาว ต้อง wrap เต็ม
  4. ผู้อ่านผล และเวลาอ่าน
  5. ลิงก์/ปุ่มไปยังภาพ (PACS) ถ้า contract มีให้ — ถ้ายังไม่มีให้ซ่อนปุ่ม ไม่ใช่แสดงปุ่มตาย
- โครงสร้างผลจริงต้องยืนยันกับ contract ก่อน implement → decision **X6**

---

## 6. Components

### 6.1 Dimension contract

**เหมือน `Lab_design.md` §6.1 ทั้งตาราง** ยกเว้น:

- **ตัดออก**: `Specimen combobox`, `Specimen toggle`, `Specimen option`
- **เพิ่ม**:

| Component | Binding size/style |
|---|---|
| Modality dropdown trigger | height `36px`, padding `0 10px`, gap `9px`, border `1px #dcdfe6`, radius `5px` |
| Modality dropdown menu | min-width = ความกว้าง trigger, max-height `320px`, scroll ในตัว, radius `6px`, shadow `0 12px 32px rgba(31,35,41,.14)` |
| Modality option | min-height `32px`, padding `6px 10px`, radius `4px` |
| Modality tag ในแถว | min-height `22px`, padding `1px 7px`, radius `4px`, neutral |

### 6.2 Dropdown เครื่อง — สเปกผูกพัน

**รายการค่าที่ผู้ใช้ยืนยัน (v1)**

| # | Label |
|---:|---|
| 1 | Select all |
| 2 | Air Reduction |
| 3 | CR |
| 4 | CT |
| 5 | CT Service |
| 6 | CTA |
| 7 | DX |
| 8 | GI |
| 9 | IO |
| 10 | IVP |
| 11 | MRI |
| 12 | MRI Service |
| 13 | Portable |
| 14 | RF |
| 15 | UN |
| 16 | US |
| 17 | US (D) |
| 18 | US (P) |
| 19 | VCUG |

พฤติกรรม:

- ค่าเริ่มต้น `Select all` — แสดงงานทุกเครื่องในหน่วยงานของผู้ใช้
- เลือกได้ทีละค่า (single select) ใน v1; ถ้าต้องการหลายค่าให้เปิดเป็น requirement ใหม่ อย่าใส่ multi-select เงียบ ๆ
- เลือกแล้ว **กรองทันที** ไม่ต้องกด Search ซ้ำ และต้อง reset ไปหน้า 1
- ค่าที่เลือกต้องคงอยู่เมื่อเปลี่ยน status chip เปลี่ยนหน้า หรือ refresh รายการ
- ตัวเลขบน status chip ต้องนับ **ภายใต้ตัวกรองเครื่องปัจจุบัน** ไม่ใช่นับทั้งหน่วยงาน มิฉะนั้นตัวเลขกับรายการจะไม่ตรงกัน
- ต้องมี `aria-label` และรองรับคีย์บอร์ดเต็ม (เปิด/ปิด/เลื่อน/เลือก/Esc)
- ถ้า master คืนค่าว่างหรือโหลดไม่สำเร็จ ให้ disable dropdown พร้อมข้อความบอกสาเหตุ **ห้าม fallback เป็นรายการ hard-code**
- Mockup รองรับ `?open=<order_id,…>` และ `?modality=<ชื่อเครื่อง>` สำหรับรีวิวเท่านั้น ไม่ใช่ requirement ของหน้าจริง

> **ข้อควรระวังที่ตรวจพบจริง**: รายการ 19 ค่านี้ **ไม่ตรง** กับ enum `modality_type` ที่มีอยู่ใน `Form-Builder/SDForm/sdform_module/EMR_form/section.json` ซึ่งมี 11 ค่า (`DX, MG, US, CT, RF, CR, VCUG, MR, IO, UN, OT`) — ตรงกันเพียง 8 ค่า, ฝั่ง master มี `MG/MR/OT` ที่ผู้ใช้ไม่ได้ระบุ, ฝั่งผู้ใช้มี `Air Reduction, CT Service, CTA, GI, IVP, MRI, MRI Service, Portable, US (D), US (P)` ที่ master ไม่มี และ `MRI` กับ `MR` เขียนไม่ตรงกัน ต้องตัดสิน decision **X2** ก่อนผูก dropdown กับ master จริง

### 6.3 ปุ่มและ action

- Primary/neutral/destructive: เหมือน LAB §6.2
- ใน detail panel มีปุ่มเพียงสองตัว: **`ส่งเข้าเครื่อง`** และ **`ยกเลิก order`**
  (ใบที่ยกเลิกแล้วเปลี่ยนเป็น `ตรวจใหม่` ตัวเดียว)
- `ส่งเข้าเครื่อง` ปุ่มเขียว ทำงานกับ **ทุกรายการที่ยังรอรับในใบนั้น** ไม่มีการเลือกราย item
  ซ่อนปุ่มเมื่อไม่มีรายการที่รอรับแล้ว
- **ไม่มี** `ปฏิเสธรายการที่เลือก` — X-ray ไม่ปฏิเสธราย item ถ้าไม่ทำรายการให้ยกเลิกทั้งใบ
- `ยกเลิก order` ทำกับทุกรายการใน Order แบบ atomic เหมือน LAB
- `ตรวจใหม่` มีเฉพาะ Order ที่ยกเลิก สร้าง Order ใหม่ที่ลิงก์กลับรายการเดิม
- **ไม่มีปุ่ม `ดู`** สำหรับรายละเอียดการยกเลิกอีกแล้ว — ข้อมูลนั้นอยู่ในคอลัมน์ระดับ test
- ปุ่มที่ disabled ต้องยังมองเห็นพร้อมเหตุผล เช่น PDF ผลก่อนออกผลครบ
- **ไม่มี** ด่านตรวจ specimen ก่อนส่ง — เงื่อนไขเดียวที่กันไว้คือ รายการต้องมีเครื่องปลายทางและรหัสส่งตรวจครบตาม contract

### 6.4 Result viewer

- เปิดมาเป็น `โหมดดูอย่างเดียว` เหมือน LAB
- การแก้ไขผลอ่านต้องมีสิทธิ์และเหตุผล และใช้ in-page confirmation ห้ามใช้ native confirm
- ผลอ่านเป็นข้อความยาว: ต้อง wrap และเพิ่มความสูงแถว ห้ามตัดเป็นบรรทัดเดียว
- ค่าทั้งหมดมาจาก API/contract ไม่ใช่ mock

### 6.5 Accessibility

เหมือน `Lab_design.md` §6.5 ทั้งหมด บวก:

- Dropdown เครื่องต้องประกาศค่าที่เลือกให้ screen reader และบอกจำนวนผลลัพธ์หลังกรอง
- สถานะ `ส่งเครื่องไม่สำเร็จ` ต้องมีข้อความ ไม่พึ่งสีอย่างเดียว

---

## 7. Motion & Interaction

เหมือน `Lab_design.md` §7 ทั้งหมด ยกเว้นกฎวันที่และ dropdown:

- Dropdown เครื่อง: เปิด/ปิดด้วย transition `.15s` ไม่มี animation ตกแต่ง
- Default date scope เป็นวันปัจจุบัน โดยผูกกับเวลาของสถานะ:
  - รอรับ → เวลาสั่ง
  - ส่งเครื่องแล้ว → **เวลาส่งเครื่อง**
  - ออกผลแล้ว → เวลาออกผล
  - ยกเลิก → เวลายกเลิก
- ค้นหา HN แบบตรงตัวดึงประวัติ Order ที่ออกผลแล้วทั้งหมดได้ และ Date Range ที่เลือกเองจะจำกัดประวัตินั้น (เหมือน LAB)
- **ตัวกรองเครื่องมีผลกับทุกโหมดค้นหา** รวมถึงการค้นด้วย HN แบบตรงตัว

---

## 8. Voice & Brand

### 8.1 Binding Thai labels

- Page: `หน่วยรังสีวิทยา`
- Search placeholder: `ค้นหา HN / VN / Order No. / ชื่อผู้ป่วย…`
- Date control: `Date Range`
- Machine control: `เครื่อง` · ค่าเริ่มต้นแสดง `Select all`
- Identifier labels: `Order No.` (มาจาก CPOE) และ `Accession No.` (ห้องรังสีออกเอง) ห้ามสลับกัน
- Filters: `ทั้งหมด`, `รอรับ / รอผลอ่าน`, `ออกผลครบ`, `ยกเลิก`
- Order actions: `ส่งเข้าเครื่อง`, `ยกเลิก order` (ไม่มีปุ่มปฏิเสธราย item)
- Context action: `EMR`
- Result actions: `ดูผลอ่าน`, `ดูภาพ`
- Result modes: `โหมดดูอย่างเดียว`, `โหมดแก้ไข`
- Result status: `รอผลอ่าน`, `ออกผลแล้ว`, `ออกผลบางส่วน`, `ออกผลครบ`
- Transport: `ส่งเครื่องแล้ว`, `ส่งเครื่องไม่สำเร็จ`
- Cancellation: `ตรวจใหม่` (ไม่มีปุ่ม `ดู` แล้ว)

### 8.2 Writing rules

เหมือน `Lab_design.md` §8.2 ทั้งหมด บวก:

- แยก `ส่งเครื่องไม่สำเร็จ` (ยังรับแล้ว ต้องลองใหม่) ออกจาก `ยกเลิก` (ไม่ทำใบนี้) ให้ชัด ห้ามใช้คำเดียวกัน
- คอลัมน์ `ปฏิเสธ` / `คนปฏิเสธ` เป็นการ **แสดงผล** ของเหตุการณ์ยกเลิกใบ ไม่ใช่ปุ่ม action
  จึงไม่มีปุ่มชื่อ `ปฏิเสธรายการ` ในหน้านี้
- ห้ามใช้คำว่า `specimen` หรือ `Lab No.` ที่ใดในหน้า X-ray
- ใช้คำว่า `เครื่อง` สม่ำเสมอจนกว่าเจ้าของงานจะอนุมัติคำอื่น

---

## 9. Anti-patterns

รับทุกข้อจาก `Lab_design.md` §9 ที่ยังใช้ได้ และเพิ่ม/แทนที่ดังนี้:

- ห้ามใส่คอลัมน์ specimen, Lab No. หรือ combobox specimen กลับเข้ามาในหน้า X-ray
- ห้ามบังคับกรอกอะไรก่อนส่งเครื่อง นอกจากสิ่งที่ contract บังคับจริง
- ห้ามใช้ dropdown เครื่องเป็นตัวให้สิทธิ์ — สิทธิ์เป็นของ server ตาม Organization เสมอ
- ห้าม hard-code รายชื่อเครื่อง 19 ค่าเป็น constant ในหน้าจอเมื่อผูก master แล้ว
- ห้ามให้ `Select all` ดึงงานข้ามหน่วยงาน
- ห้ามนับ status chip โดยไม่คิดตัวกรองเครื่อง
- ห้ามแจกสีประจำเครื่องแต่ละตัว
- ห้ามรวม `ส่งเครื่องไม่สำเร็จ` เข้ากับ `ยกเลิก` หรือทำให้การส่งไม่สำเร็จ rollback การรับ
- ห้ามใส่ checkbox เลือกราย item หรือ action ระดับ item กลับเข้ามา — X-ray ทำงานที่ระดับใบ
- ห้ามแสดงเครื่องแบบ `ตัวแรก +N` — ผู้อ่านตีความ `+N` ไม่ได้
- ห้ามออกแบบให้ใบหนึ่งมีหลาย test หรือหลาย accession
- ห้ามใส่บรรทัดสรุปจำนวนรายการคั่นระหว่างหัว Order กับตาราง
- ห้ามคำนวณเลขที่ใบหรือเลข accession ที่ฝั่งหน้าจอ
- ห้ามใช้ Order No. แทน Accession No. หรือรวมเป็นเลขเดียว
- ห้ามวางคอลัมน์ Accession No. ไว้ที่ระดับ Order
- ห้ามนับ running ของ accession รวมทุก modality
- ห้ามแสดงปุ่ม PDF บนใบที่ยกเลิกแล้ว
- ห้ามเว้นคอลัมน์ว่างหรือใส่ `–` แทนปุ่มที่ไม่มี — ปุ่มที่มีต้องเรียงต่อกันในคอลัมน์เดียว
- ห้ามซ่อนเหตุผล/ผู้ยกเลิกไว้หลัง popup ต้องแสดงเป็นคอลัมน์ในตารางระดับ test
- ห้ามทำปุ่ม `ดูภาพ` เป็นปุ่มตาย ต้องบอกว่ารอเชื่อมกับ RIS
- ห้ามเดารหัสเครื่องเองเมื่อ master ไม่มีค่า — ให้ flag ว่าข้อมูลไม่ครบ
- ห้ามใช้ contract ของ LAB ส่ง X-ray โดยยัด `labno`/`specimen_code` ปลอม (ดู Appendix C)
- ห้ามตัดข้อความผลอ่านยาวให้เหลือบรรทัดเดียว
- ห้ามใช้ข้อมูลผู้ป่วย/production ใน mockup หรือ test

---

# Appendix A — Functional State Contract

## A.1 Primary filter mapping

| Main filter | Included Order states |
|---|---|
| ทั้งหมด | ทุกสถานะในขอบเขตวันที่ปัจจุบัน บวกข้อยกเว้นการค้นหา |
| รอรับ / รอผลอ่าน | waiting, ส่งเครื่องบางรายการ, ส่งเครื่องแล้วรอผล, ออกผลบางส่วน |
| ออกผลครบ | ทุกรายการที่รับไว้ออกผลครบแล้ว |
| ยกเลิก | ยกเลิกทั้ง Order เท่านั้น |

ตัวกรองเครื่อง **ซ้อนทับ** filter นี้เสมอ ทั้งรายการและตัวเลขนับ

## A.2 การรับและส่งเครื่อง

**1 order = 1 accession = 1 test** — หน่วยของการทำงานคือ "ใบ" และเพราะใบมี test เดียว
หน่วยนี้จึงเท่ากับ test พอดี ต่างจาก LAB ที่หนึ่งใบมีได้หลาย test

1. CPOE สร้าง Order หนึ่งใบต่อหนึ่งรายการตรวจ พร้อม `order_no` ตามรูปแบบใน Appendix F
   และผูกเครื่องปลายทางไว้ตั้งแต่ตอนสั่ง รายการเริ่มที่สถานะ waiting
2. ผู้ใช้กด `ส่งเข้าเครื่อง` ที่ใบ — ไม่มีการเลือกราย item
3. ระบบตรวจว่ารหัสส่งตรวจครบตาม contract ถ้าขาดต้องหยุดพร้อมบอกเหตุผล
4. ออก accession no. ของใบ (idempotent ต่อ Order) → บันทึกเวลาส่งและผู้ทำ → เรียก API → Agent
5. ความล้มเหลวของ Agent **ไม่ rollback** การรับ รายการยังเป็น `รับแล้ว` และแสดง `ส่งเครื่องไม่สำเร็จ`
   พร้อมให้ลองใหม่ได้ด้วย accession เดิม
6. **ไม่มีการปฏิเสธราย item** ถ้าไม่ทำรายการต้องยกเลิกทั้งใบ
7. การยกเลิกทั้ง Order ยกเลิกทุกรายการแบบ atomic บันทึกเหตุผล/ผู้ทำ/เวลา และซ่อนปุ่ม PDF ของใบนั้น
8. `ตรวจใหม่` เก็บ Order เดิมไว้ สร้าง Order ใหม่ที่ลิงก์กลับ ใช้เวลาสั่งปัจจุบัน และออก accession ใหม่ตอนส่งเครื่อง

## A.3 การรวมสถานะ

เพราะใบมี test เดียว สถานะของใบจึงเท่ากับสถานะของ test นั้นตรง ๆ:

- ยังไม่ส่งเครื่อง → `รอรับ`
- ส่งเครื่องแล้วยังไม่มีผล → `ส่งเครื่องแล้ว` (ถ้า transport ล้มเหลวให้เพิ่มป้าย `ส่งเครื่องไม่สำเร็จ`)
- มีผลอ่านแล้ว → `ออกผลครบ`
- ยกเลิก → `ยกเลิก` และไม่เข้าการนับข้างต้น

**`ออกผลบางส่วน` เกิดขึ้นไม่ได้ในโมเดลนี้** เก็บ label ไว้ในระบบสีเผื่อกรณีที่ contract
เปลี่ยนภายหลังเท่านั้น ห้ามสร้าง UI ที่ทำให้ผู้ใช้คาดหวังสถานะนี้
- ทุก inbound ต้อง dedupe ด้วยคีย์ที่ contract กำหนด
- การแก้ผลใช้กติกาเดียวกับที่ตกลงไว้ใน `design/lab-cpoe-integration-checklist.md` (current-value overwrite, Technical Receipt ยังเก็บ payload)

---

# Appendix B — Search and Date Rules

เหมือน `Lab_design.md` Appendix B ทั้งหมด โดยแทน "Lab No." ด้วย **Accession No.** และเพิ่ม:

- Searchable identifiers: HN, VN, **Order No., Accession No.** และชื่อผู้ป่วย
- ตัวกรองเครื่องมีผลกับทุกการค้นหา รวมถึง exact HN history
- Timezone ต้องเป็นเวลาไทยหรือ ISO 8601 `+07:00` ห้ามตีความ `Z` เป็นเวลาท้องถิ่น

---

# Appendix C — Integration and Persistence Contract

## C.1 แหล่งข้อมูล

เหมือนสถาปัตยกรรมของ LAB ใน `design/lab-cpoe-integration-checklist.md` — อ่านจาก CPOE ตรง ไม่สร้างฟอร์ม mirror:

```text
X-ray Workbench JSON
  → xray-cpoe-worklist API
    → query zdata_cpoe_order_item  (service_type = 'xray')
      → join zdata_cpoe_order เพื่อข้อมูลหัวใบ/ผู้ป่วย/การเงิน
      → join zdata_master_item_order เพื่อเครื่อง/รหัสส่งตรวจ
      → join zdata_section เพื่อ modality และหน่วยงาน
      → group กลับเป็นหนึ่ง Order พร้อม items[]

ส่งเข้าเครื่อง (ราย Item)
  → xray-cpoe-dispatch API
    → บันทึกเวลาส่ง/ผู้ส่ง → เรียก Agent submit → เก็บ transport outcome

รับผลอ่าน
  → Agent → result upsert → Report → Result Item
  → Workbench อ่านกลับด้วย CPOE Item reference
```

- `service_type` ของ X-ray มาจากฟอร์มประเภทค่าบริการ `6a58d02cd448dfc9d33e2bd6` โดย CPOE App ใช้ code `xray` (ยืนยันแล้วใน `CPOE_app.json`)
- การเปิดภาพต้องต่อกับ **โปรแกรม RIS** ซึ่งยังไม่มี contract ในรีโปนี้ → decision **X17**
- Server ต้อง enforce ขอบเขตหน่วยงานทุก request แบบ fail-closed เหมือน LAB
- Audit actor มาจาก runtime identity เท่านั้น

## C.2 ข้อจำกัดของ Agent contract ปัจจุบัน — **บล็อกเกอร์**

ตรวจจาก `Form-Builder/API/api-factory/processes/lab_agent_order_submit_api.js` (Process `6a9468c7422c1ca959829d6a`):

- `ROOT_REQUIRED = ['order_no', 'labno', 'hn', 'ordered_at', 'priority', 'items']` — **บังคับ `labno`**
- `ITEM_REQUIRED = ['seq','test_code','test_name','specimen_code','collected_at','received_at','receiver']` — **บังคับ `specimen_code`** และ `collected_at`
- validator ใช้ allowlist เข้ม: field ที่ไม่อยู่ใน `ROOT_KEYS`/`ITEM_KEYS` จะถูกตีกลับว่า `ไม่รองรับ field` และไม่มี key ใดสำหรับเครื่อง/modality
- diagram `02-his/draw_design/request_reciece_agents_flow.drawio` มีป้าย `TYPE- item_type(Lab / Xray)` ในหน้า Order Payload แต่ **`item_type` ไม่มีอยู่จริงใน validator ที่ implement แล้ว**

สรุป: **X-ray ส่งผ่าน process นี้ตามสภาพปัจจุบันไม่ได้** ต้องเลือกทางใดทางหนึ่ง (decision **X3**) และห้ามยัด `labno`/`specimen_code` ปลอมเพื่อให้ผ่าน validator

## C.3 การแยกข้อมูล

- แยก Order, รายการตรวจ, technical receipt, report และ result item เป็นคนละ record เหมือน LAB
- Persistence: append-only Technical Receipt → Report → Result Items
- ต้องมี concurrency control ไม่ให้ผู้ใช้สองคนส่งเครื่องรายการเดียวกันด้วย state เก่า

---

# Appendix D — Open Decisions Before Backend Wiring

| ID | ต้องตัดสิน | Baseline ที่แนะนำ |
|---|---|---|
| ~~X1~~ | ~~accession มีหรือไม่~~ | **เคาะแล้ว 2026-08-31: มี และเป็น 1 accession ต่อ 1 order (1:1) ออกตอนกดส่งเข้าเครื่อง idempotent ต่อ Order** · เหลือยืนยันเฉพาะรูปแบบเลข (X10) |
| X2 | รายการ 19 ค่าในdropdown คือ section ของหน่วยรังสี, master เครื่องแยกใหม่ หรือ enum `modality_type` | ผูกกับ section/เครื่องของหน่วยรังสีใน `zdata_section` และให้ API คืนทั้ง code และ label; ต้อง reconcile `MRI` vs `MR` และค่าที่ master ยังไม่มีก่อนใช้จริง |
| X3 | ช่องทางส่ง X-ray ไป Agent | เพิ่ม process ใหม่สำหรับ X-ray ที่มี schema ของตัวเอง แทนการผ่อนกฎ validator ของ LAB; ถ้าจะใช้ endpoint เดียวกันต้องให้ Agent รองรับ `item_type` และทำ `labno`/`specimen_code` เป็น optional อย่างเป็นทางการ |
| X4 | รหัสส่งตรวจขาออกของ X-ray (เทียบเท่า `master.lab_item.his_lab_code`) | ยืนยันชื่อ field ใน `zdata_master_item_order` สำหรับ X-ray และ fail ก่อนส่งถ้าไม่มีค่า ห้าม fallback เงียบ |
| X5 | X-ray มีชุดแม่-ลูกแบบ `sub_order`/`lab_parent` หรือไม่ | ยืนยันจากข้อมูลจริงก่อน ถ้ามีให้ใช้กติกาเดียวกับ LAB และเก็บ provenance ของชุด |
| X6 | โครงสร้างผลอ่าน (findings/impression/ภาพ) | นิยาม schema ผลอ่านให้ชัดก่อนทำ viewer; v1 แสดงข้อความยาวสองส่วนและผู้อ่านผล ไม่ต้องมีตารางค่าเชิงตัวเลข |
| X7 | Order เดียวมีรายการหลายเครื่อง | เก็บสถานะที่ระดับรายการ และคำนวณ aggregate ที่หน้าจอ; ห้ามให้การส่งรายการแรกเปลี่ยนสถานะรายการอื่น |
| X8 | สิทธิ์และขอบเขตหน่วยงานรังสี | ใช้ Organization → หน่วยงาน แบบ fail-closed เหมือน LAB และ dropdown เครื่องกรองภายในขอบเขตนั้นเท่านั้น |
| ~~X10~~ | ~~รูปแบบเลขที่ใบ~~ | **เคาะแล้ว 2026-08-31 — ดู Appendix F** |
| ~~X11~~ | ~~accession ใช้เลขเดียวกับ Order No.~~ | **เคาะแล้ว 2026-08-31: เป็นคนละเลข — ดู Appendix F** |
| ~~X13~~ | ~~ใครออกเลข~~ | **เคาะแล้ว: Order No. จาก CPOE · Accession No. จากห้องรังสีตอนส่งเข้าเครื่อง** |
| X12 | accession วนกลับ `001` หลังครบ 999 ใน modality/วันเดียวกัน | ผู้ใช้ระบุให้วนกลับ `001` — ต้องมี guard ไม่ให้ทับเลขที่ยังใช้งานอยู่ และตกลงว่าจะทำอย่างไรเมื่อเต็มจริง (LAB generator ใช้ fail-safe แบบเดียวกัน) |
| X14 | code เครื่อง 10 ค่าที่ไม่มีใน `modality_type` | ต้องให้เจ้าของงานกำหนด code จริง ห้ามใช้ค่าสมมติใน Appendix F.3 |
| X15 | ความยาว accession ไม่คงที่ (13–15 ตัว) | ตกลงว่ายอมรับความยาวแปรผัน หรือบังคับ code ให้ยาวเท่ากันทุกตัว |
| X17 | การเปิดภาพผ่านปุ่ม `ดูภาพ` | ต้องได้ contract ของ RIS/PACS ก่อน (deep-link ด้วย accession, สิทธิ์, การเปิดในแท็บใหม่) ระหว่างนี้ให้แจ้งว่ารอเชื่อมต่อ |
| X16 | ตัวพิมพ์ของ code ในเลข accession | mockup ใช้ **ตัวพิมพ์ใหญ่** ตาม `modality_type` และรหัสอื่นในระบบ ผู้ใช้เขียนตัวอย่างเป็น `dx` ตัวเล็ก — ต้องยืนยัน |
| X9 | การยกเลิกหลังส่งเครื่องแล้ว | ยังไม่ส่ง: ยกเลิกในระบบ; ส่งแล้วยังไม่มีผล: ขอ Agent ยกเลิก; มีผลแล้ว: ปฏิเสธการยกเลิก |

---

# Appendix F — เลขสองชุด: Order No. และ Accession No.

**เป็นคนละเลข คนละเจ้าของ คนละระดับ** ห้ามใช้แทนกันหรือรวมเป็นเลขเดียว

## F.1 Order No. — มาจากใบสั่ง CPOE

```text
YYYY MM DD NNN
2026 08 31 011   ->  20260831011
```

- ห้องรังสี **ไม่ได้ออกเลขนี้** เป็นฝ่ายรอรับใบสั่งที่มีเลขนี้มาแล้ว
- `YYYY` ปี **ค.ศ.** สี่หลัก · `MM` เดือน · `DD` วันที่สั่ง · `NNN` ลำดับใบของวันนั้น
- ไม่มี prefix ตัวอักษร · แสดงระดับ Order ในแถว worklist

## F.2 Accession No. — ห้องรังสีออกเอง (ตามคำสั่งใน draw.io ของผู้ใช้)

```text
YYYY MM DD <MODALITY> NNN
2026 08 31     CT     001   ->  20260831CT001
```

- **อยู่ระดับ test ไม่ใช่ระดับ Order** — แสดงเป็นคอลัมน์แรกของตารางในหน้ารายละเอียด
- ออกตอนกดส่งเข้าเครื่อง และต้อง **idempotent ต่อ Item** (ส่งซ้ำต้องได้เลขเดิม)
- `<MODALITY>` = code ของเครื่องที่ผูกกับ test นั้น
- `NNN` running สามหลัก **นับแยกตาม modality และแยกตามวัน** ครบ `999` แล้ววนกลับ `001`
- ต้องออกจาก server แบบ atomic ห้ามคำนวณที่หน้าจอ

## F.3 ตาราง code ของเครื่อง

| Label ใน dropdown | Code ที่ใช้ประกอบเลข | ยืนยันแล้ว? |
|---|---|---|
| Air Reduction | `AR` | ไม่ — ค่าสมมติ |
| CR | `CR` | ใช่ (มีใน `modality_type`) |
| CT | `CT` | ใช่ |
| CT Service | `CTS` | ไม่ — ค่าสมมติ |
| CTA | `CTA` | ไม่ — ค่าสมมติ |
| DX | `DX` | ใช่ |
| GI | `GI` | ไม่ — ค่าสมมติ |
| IO | `IO` | ใช่ |
| IVP | `IVP` | ไม่ — ค่าสมมติ |
| MRI | `MRI` | ไม่ — master เขียน `MR` |
| MRI Service | `MRS` | ไม่ — ค่าสมมติ |
| Portable | `PT` | ไม่ — ค่าสมมติ |
| RF | `RF` | ใช่ |
| UN | `UN` | ใช่ |
| US | `US` | ใช่ |
| US (D) | `USD` | ไม่ — ค่าสมมติ |
| US (P) | `USP` | ไม่ — ค่าสมมติ |
| VCUG | `VCUG` | ใช่ |

**code ที่ยังไม่ยืนยัน 10 ค่าเป็นค่าที่ตั้งขึ้นเพื่อให้ mockup ทำงานได้ ห้ามนำไปใช้จริง
ก่อนเจ้าของงานยืนยัน (decision X14)** และเพราะ code ยาว 2–4 ตัว **ความยาวเลข accession
จึงไม่คงที่** (`20260831CT001` = 13 ตัว, `20260831VCUG001` = 15 ตัว) ต้องตัดสินว่ายอมรับได้
หรือจะบังคับความยาว code (decision X15)

---

# Appendix E — Acceptance Checklist for the First X-ray SDForm

รอบแรกตามที่ผู้ใช้กำหนด: **แสดงรายการที่สั่งมาจาก CPOE ให้ได้ก่อน**

- [ ] หน้าเดียว layout และฟิลด์สรุป Order ครบตาม §5.2
- [ ] Toolbar เรียง `ค้นหา · Date Range · เครื่อง · Search · Report · สร้างรายการใหม่`
- [ ] Dropdown เครื่องมี 19 ค่า ค่าเริ่มต้น `Select all` กรองทันที และคงค่าเมื่อเปลี่ยน chip/หน้า
- [ ] ทุกใบมี test เดียว และ worklist หนึ่งแถวคือหนึ่งรายการตรวจ
- [ ] Order No. มาจาก CPOE และ Accession No. ออกจาก server ตอนส่งเข้าเครื่อง ทั้งคู่ตรง Appendix F
- [ ] Accession No. เป็นคอลัมน์ในตารางระดับ test และว่างจนกว่าจะส่งเข้าเครื่อง
- [ ] running ของ accession นับแยกตาม modality และแยกตามวัน และ idempotent เมื่อส่งซ้ำ
- [ ] ไม่มี checkbox ราย item และ detail มีเพียงปุ่ม `ส่งเข้าเครื่อง` กับ `ยกเลิก order`
- [ ] ไม่มีบรรทัดสรุปคั่นระหว่างหัว Order กับตาราง
- [ ] คอลัมน์เครื่องมีค่าเดียว ไม่ใช้ `+N` และไม่มีสถานะ "ไม่ระบุเครื่อง" ในหน้าจอ
- [ ] ใบที่ยกเลิกเหลือปุ่ม `EMR` ปุ่มเดียว และปุ่มท้ายแถวเรียงต่อกันไม่มีช่อง `–`
- [ ] ตารางระดับ test มีคอลัมน์ `ปฏิเสธ` และ `คนปฏิเสธ` และเติมค่าจากการยกเลิกใบ
- [ ] แท็บผลอ่านมีปุ่ม `ดูภาพ` ที่แจ้งว่ารอเชื่อมกับ RIS
- [ ] worklist กว้างไม่เกิน 1290px และไม่มี pill ล้นทับคอลัมน์ข้างเคียง
- [ ] Filter chips สี่ตัว และตัวเลขมาจากข้อมูลจริงภายใต้ตัวกรองเครื่อง ไม่ใช่ค่าคงที่
- [ ] Worklist ดึงจาก `zdata_cpoe_order_item` ที่ `service_type='xray'` และ group กลับเป็น Order
- [ ] ไม่มีคอลัมน์ specimen และไม่มี Lab No. ที่ใดในหน้า
- [ ] แถว Order ขยาย/ย่อได้ และ dropdown render เหนือแถวข้างเคียง
- [ ] Search และ Date Range ทำงานตาม Appendix B
- [ ] ขอบเขตหน่วยงานถูก enforce ที่ server แบบ fail-closed และไม่มีข้อมูลข้ามหน่วยงานรั่ว
- [ ] EMR เปิดได้ทุกสถานะ
- [ ] รายการที่ไม่มีเครื่องถูก flag ว่าข้อมูลไม่ครบ ไม่ใช่เดาค่า
- [ ] ไม่มี identifier ผู้ป่วยจริง ค่าผลจริง credential หรือ URI ของ environment ฝังใน JSON
- [ ] สร้างไฟล์ใน `Form-Builder/SDForm/X-ray/` ตาม `spec.md` ของโฟลเดอร์นั้น
- [ ] SDForm JSON ผ่าน `Form-Builder/seed/tests-tools/validators/check_sdform_json.py`
- [ ] ตรวจ Builder/Preview และ runtime query จริงก่อนอ้างว่าใช้งานได้

รอบถัดไป (หลังตัดสิน X1/X3/X4): ปุ่มส่งเข้าเครื่อง, ปฏิเสธ, ยกเลิก, ตรวจใหม่ และแท็บผลอ่าน
