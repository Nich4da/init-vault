# Report Typst Reference

เอกสารราชการ/แบบฟอร์มภาษาไทยที่ต้องจัดหน้าละเอียด — compile ที่ server ได้ PDF ใน ~30ms

## Overview

- Report Factory → Type = **Typst** → เขียน template ในช่อง **Typst Code** → เลือก **SQL** เป็นแหล่งข้อมูล
- ตอนกดพิมพ์ server โหลดข้อมูลจาก SQL provider แล้วเขียนเป็นไฟล์ `data.json` วางข้าง template แล้ว compile ด้วย Typst → ส่ง PDF กลับ
- **ต่างจาก LaTeX ตรงที่ไม่แทนค่าลงใน template** — template อ่านข้อมูลเองผ่าน `sdthai.typ` ⇒ ค่าจาก DB ไม่มีทางกลายเป็นโค้ด ไม่ต้อง escape (`# $ * _ @ <` ในข้อมูลแสดงตามจริง)
- เหมาะกับ: หนังสือภายนอก/บันทึกข้อความ, ใบเสร็จ, สัญญา, แบบฟอร์มกรอกที่มีจุดไข่ปลา, เอกสารหลายหน้า
- ใช้ pdfmake (Type = Report) แทนเมื่อ: อยากให้คนที่ไม่เขียนโค้ดลากวาง content เอง

| ขั้น | เกิดที่ไหน |
|---|---|
| โหลดข้อมูล | SQL provider ของ report (สิทธิ์ตาม data policy เหมือน report อื่น) |
| data.json | `{ ...row แรก, rows, params, raw }` |
| compile | `typst` CLI · ฟอนต์จากเครื่อง server เท่านั้น · ไม่ต่อเน็ต |
| ผลลัพธ์ | PDF (preview ใน popup / download) |

## Setup — เปิดใช้ Typst report

- **1.** Report Factory → **New** → ตั้งชื่อ → เลือก **SQL** (ต้องมี provider ก่อน — SQL Factory)
- **2.** **Type** = `Typst` → ช่อง **Typst Code** โผล่แทน Builder ของ pdfmake
- **3.** วาง template (ดู Full example) → **Save**
- **4.** กด **Validate** → compile ตัวที่พิมพ์อยู่กับข้อมูลจริง · ผิดตรงไหนขึ้นเส้นหยักที่บรรทัดนั้น
- **5.** กลับหน้า list → ปุ่ม **PDF (Typst)** → preview

> Validate ต้อง Save report ก่อนอย่างน้อย 1 ครั้ง (server ใช้ reportId โหลด SQL + ตรวจสิทธิ์)

## Checklist — ออกรายงานเร็ว + ไม่พัง

- บรรทัดแรกเสมอ: `#import "sdthai.typ": *` แล้ว `#show: gov` (หนังสือราชการ) หรือ `#show: sdthai` (กำหนดหน้ากระดาษเอง)
- **ดูชื่อ field จริงของ provider ก่อนเขียน** — ปุ่มชื่อตัวแปรด้านบน editor คือ field ที่ SQL คืนมา · อ้าง field ที่ไม่มี = error ทันที
- ตัวเลข/วันที่ใช้ `raw.<field>` (ค่าดิบ) · ข้อความแสดงผลใช้ `data.<field>` (แปลงตาม schema แล้ว)
- ตัวเลขที่เอามาคำนวณครอบ `float(...)` ก่อน (ค่าจาก DB อาจเป็น string)
- ผูก SQL ให้ตรงกับ template — เปลี่ยน SQL แล้ว field ชุดเดิมหายทั้งชุด
- เขียนข้อความตายตัวที่มี `$` `#` `*` `_` `@` `<` ต้องใส่ `\` นำหน้า (เฉพาะข้อความใน template — ค่าจากข้อมูลไม่ต้อง)

## Template พื้นฐาน

- `#` = เริ่มโค้ดกลางข้อความ · `[...]` = ก้อนข้อความ · `{...}` = ก้อนโค้ด · `//` = comment
- `#set` = ตั้งค่าตั้งแต่จุดนั้นลงไป · `#let` = ประกาศตัวแปร/ฟังก์ชัน · `\` ท้ายบรรทัด = ขึ้นบรรทัดใหม่

```typst
#import "sdthai.typ": *
#show: gov

= หัวเรื่อง
เรียน #data.to_name \
เนื้อความ *ตัวหนา* _ตัวเอียง_
#let total = float(raw.amount) - float(raw.tax)
รวม #money(total) บาท
```

## Data Context — ตัวแปรที่ใช้ได้

| ตัวแปร | คืออะไร | ตัวอย่าง |
|---|---|---|
| `data.<field>` | row แรก (แปลงตาม schema ฟอร์มแล้ว) | `#data.doc_no` |
| `raw.<field>` | row แรก ค่าดิบ (วันที่ ISO / ตัวเลขจริง / object รูป) | `#thaidate(raw.doc_date)` |
| `rows` | ทุก row (array) · แต่ละตัวมี `_raw` | `#for r in rows [...]` |
| `params.<var>` | ค่าจาก Parameters ของ report | `#params.at("copy", default: "ต้นฉบับ")` |
| `data.at("x", default: "")` | อ่าน field ที่อาจไม่มี | ไม่ error ถ้าไม่มี key |

**field ที่เป็นโครงสร้าง** (map-input · drawing-input · sub-form · object-group · json-input · dynamic-input) `data.<field>` เป็น **object/array จริง** ไม่ใช่ข้อความ JSON → ส่งเข้า `#drawing()` `#location()` `#subtable()` ได้ตรง ๆ
ส่วน select-form/select-data/select-sql ได้ **label** มาแล้ว (`#data.visit_clinic` = ชื่อคลินิก) · ต้องการ id ใช้ `raw.visit_clinic.value`

> วันที่จาก DB server แปลงเป็นเวลาท้องถิ่นให้แล้ว (ไม่มี Z) → `thaidate` ได้วันถูก ไม่เพี้ยนย้อน 1 วัน

## Binding — ค่าเดี่ยว / ตาราง

```typst
ที่ #thainum(data.doc_no) #h(1fr) วันที่ #thainum(thaidate(raw.doc_date))

#table(columns: (auto, 1fr, auto), stroke: 0.5pt, inset: (x: 8pt, y: 4pt),
  [*ลำดับ*], [*รายการ*], [*จำนวนเงิน*],
  ..rows.enumerate().map(((i, r)) => (
    thainum(i + 1), r.item_name, align(right, money(r._raw.amount)),
  )).flatten()
)

#for r in rows [
  - #r.item_name #money(r._raw.amount) บาท
]
```

- `..(...).flatten()` = กางทุก row เป็นช่องตาราง (3 คอลัมน์ต่อ row)
- ผลรวม: `#let sum = rows.map(r => float(r._raw.amount)).sum(default: 0)`
- ตารางยาวข้ามหน้าได้เอง · หัวตารางซ้ำทุกหน้า: `table.header([*ลำดับ*], [*รายการ*])`

## ตัวช่วยภาษาไทย

| ฟังก์ชัน | ผล |
|---|---|
| `thaidate(v)` | 22 กันยายน 2569 |
| `thaidate(v, format: "short")` | 22 ก.ย. 2569 |
| `thaidate(v, format: "shortyear")` | 22 ก.ย. 69 |
| `thaidate(v, format: "full")` | วันจันทร์ที่ 22 กันยายน พ.ศ. 2569 |
| `thaidate(v, format: "month")` | กันยายน 2569 |
| `thaidate(v, format: "be")` | 22 กันยายน พ.ศ. 2569 |
| `thainum(v)` | 123/2569 → ๑๒๓/๒๕๖๙ |
| `money(v)` / `money(v, digits: 0)` | 3,346,927.90 / 3,346,928 |
| `bahttext(v)` | หนึ่งร้อยบาทถ้วน · ห้าสิบสตางค์ |

- `thaidate` รับ `YYYY-MM-DD[THH:mm]` และ `DD/MM/YYYY` (ปีเกิน 2400 = พ.ศ.) · คืน string → ต่อ `thainum(thaidate(...))` ได้
- ผลทุกตัวตรงกับตัวช่วยของ LaTeX report (ทดสอบเทียบแล้ว)
- ค่าที่ไม่ใช่ตัวเลข/วันที่ คืนค่าเดิม ไม่ error

## รูป / QR / Barcode

| ฟังก์ชัน | ใช้กับ |
|---|---|
| `img("garuda.png", height: 3cm)` | คลังรูปของระบบ (ครุฑ) |
| `img(data.sign, height: 2cm)` | field รูป/ลายเซ็น (data URI หรือไฟล์ที่อัปโหลดในระบบ) |
| `qr(data.hn)` | QR ขนาด 2cm ระดับกู้ข้อมูล M |
| `qr(data.url, size: 3cm, level: "H")` | L / M / Q / H = 7 / 15 / 25 / 30% |
| `barcode(data.hn, width: 5cm, height: 1.2cm)` | Code128 |

- หารูปไม่เจอ / ค่าว่าง = พื้นที่ว่างขนาดเท่าที่ขอ (รายงานไม่พัง)
- ไม่ดึงรูปจาก URL ภายนอก (ใช้ได้เฉพาะไฟล์ในระบบหรือ data URI)
- รองรับ **png · jpg · gif · webp · svg** (svg เป็น vector คมทุกขนาด) ทั้งจากคลังรูปและจากข้อมูล
- วางตำแหน่งตายตัว: `#place(top + right, dx: -1cm, qr(data.hn))`

## ค่าจาก widget ของฟอร์ม (Drawing Pad / แผนที่)

field พวกนี้เก็บเป็น object ทั้งก้อน — เรียก helper ได้ตรง ๆ ไม่ต้องรู้โครงสร้างข้างใน

| ฟังก์ชัน | ใช้กับ | ได้อะไร |
|---|---|---|
| `drawing(data.signature, width: 7cm)` | Drawing Pad | พื้นหลัง (สี/กระดาษ/รูปแม่แบบ) + ลายเส้น ซ้อนกันเป็นรูปเดียว · ใส่ `stroke-box: 0.5pt` ถ้าอยากได้กรอบ |
| `img(data.signature, width: 4cm)` | Drawing Pad | เฉพาะลายเส้น (ไม่เอาพื้นหลัง) |
| `location(data.home_loc, label: "บ้านผู้ป่วย")` | Map Input | QR เปิด Google Maps + ป้าย + พิกัด (ไม่มีพิกัด = ไม่วาดอะไร) |
| `latlng(data.home_loc)` | Map Input | `13.756300, 100.501800` (string ต่อกับข้อความอื่นได้) |
| `gmapurl(data.home_loc)` | Map Input | ลิงก์ Google Maps ของพิกัดนั้น |

- `location` / `latlng` รับได้ทั้ง GeoJSON Point ที่ฟอร์มเก็บ, `"lat, lng"` และ `(lat: .., lng: ..)`
- ขนาดของ `drawing()` คิดจากสัดส่วน canvas ที่ผู้ใช้วาด — ระบุแค่ `width` หรือ `height` อย่างใดอย่างหนึ่งพอ
- รูปพวกนี้สูงกว่าบรรทัดปกติ → วางในบรรทัดของตัวเอง ไม่งั้นบรรทัดนั้นจะถ่าง

## ข้อความยาวไม่เท่ากัน — ย่อให้พอดีช่อง

```typst
#fitline(7cm)[#data.remark]                       // ย่อจาก 14pt ลงจนพอดี (ต่ำสุด 10pt)
#fitline(6cm, size: 16pt, min-size: 12pt)[#data.title]
```

ค่าจากฐานข้อมูลยาวไม่เท่ากัน ถ้าปล่อยให้ตกบรรทัดจะไปชนบล็อกด้านล่าง — ใช้กับช่องความเห็น/ชื่อยาวในแบบฟอร์มที่จัดตำแหน่งตายตัว

## ตารางรายงาน (สเปกเดียวกับคอลัมน์ของ Report Factory)

```typst
#sdtable(rows, columns: (
  (field: "cat",   group: true),                                          // คอลัมน์จัดกลุ่ม → แถวหัวกลุ่ม
  (field: "name",  label: "รายการยา"),
  (field: "exp",   label: "วันหมดอายุ", width: 3cm, align: center, format: "date"),
  (field: "qty",   label: "คงเหลือ", width: 2.2cm, align: right, format: "num", sum: true),
  (field: "value", label: "มูลค่า", width: 3cm, align: right, format: "num2", sum: true),
))

#subtable(data.med_items, columns: (...))   // ตารางจาก sub-form (array ในเรคคอร์ดเดียว)
```

| ตัวเลือกคอลัมน์ | ผล |
|---|---|
| `field` | ชื่อ field จาก provider |
| `label` | หัวคอลัมน์ (ไม่ใส่ = ใช้ชื่อ field) |
| `width` | `2cm` / `1fr` / ไม่ใส่ = แบ่งเท่ากัน |
| `align` | `left` `center` `right` |
| `format` | `num` `num1` `num2` `money` `date` `datetime` `boolean` `bahttext` · **`qrcode` `barcode` `image` `drawing` `location`** (ทั้งช่องเป็นรูป/รหัส · ขนาดที่ `size:`) |
| `sum: true` | รวมท้ายตาราง (บวกจากค่าดิบก่อน format) |
| `group: true` | ไม่แสดงเป็นคอลัมน์ แต่ขึ้นแถวหัวกลุ่มเมื่อค่าเปลี่ยน (ต้อง `ORDER BY` มาจาก SQL) |

- หัวตารางซ้ำทุกหน้าอัตโนมัติ · ในช่องไม่ยืดคำ (ไม่ถ่าง)
- ปรับสี: `header-fill:` `group-fill:` `stroke-color:` · แถวรวม: `total-label:` `show-total:`
- `group-pagebreak: true` = ขึ้นหน้าใหม่ทุกครั้งที่เปลี่ยนกลุ่ม (ใบสั่งยา/ใบเบิกแยกคนละหน้า — pdfmake ทำไม่ได้)
- รูปทุกรูปใน field เดียว: `#imgs(data.photos, width: 4cm, columns: 3)` (`#img` เอารูปแรกอย่างเดียว)

## หน้ากระดาษรายงาน — ใช้ค่าจากแท็บ Setting

```typst
#show: report-page()      // เอาค่าที่ตั้งไว้ในบิลเดอร์ทั้งหมด
```

`report-page()` อ่านค่าจากแท็บ **Setting** ของรายงานให้เอง: ขนาดกระดาษ (รวม Custom) · แนวกระดาษ · ขอบ 4 ด้าน · ขนาดฟอนต์ · Title + Show Header (firstPage/everyPage) · Show Print Date · Show Page Number · Watermark · Background
⇒ ตั้งในบิลเดอร์แล้วเห็นผลทันที ไม่ต้องเขียน `#set page` ซ้ำ

ทับเฉพาะบางค่าได้ (ที่ไม่ระบุ = ตามบิลเดอร์):
```typst
#show: report-page(
  title: "รายงานยอดคงเหลือคลังยา",   // ทับ Title จากบิลเดอร์
  subtitle: "ณ วันที่ 23 กันยายน 2569",
  numbering-style: "thai",           // thai = หน้า ๑/๓ · arabic = หน้า 1/3 · en = Page 1 of 3 · none
  every-page: true,                  // false = หัวเฉพาะหน้าแรก
  margin: (top: 2cm, bottom: 1.6cm, left: 1.8cm, right: 1.4cm),
  watermark: "สำเนา",
)
#watermark-text("ต้นฉบับ")           // ลายน้ำเฉพาะหน้า (เมื่อไม่อยากใช้ค่าจากบิลเดอร์)
```

- มีหัวกระดาษ → เผื่อขอบบนให้อัตโนมัติ (ไม่ให้หัวทับเนื้อหา) เหมือนที่ Report Factory ทำ
- ใช้แทน `#show: gov` เมื่อเป็น "รายงาน" · หนังสือราชการที่จัดตำแหน่งเองใช้ `gov` เหมือนเดิม

## ข้อความ HTML (จาก html-input / Rich Text)

```typst
#html(data.note)          // <p> <b> <i> <u> <s> <h1-h6> <ul>/<ol> <table> <a> <img> <hr> <span style="color/background/font-size">
```

- server แปลง HTML เป็น Typst ให้ตอนสร้างรายงาน — ค่าจากผู้ใช้ถูก escape แล้ว (พิมพ์ `#set page(...)` ลงในฟอร์มก็แสดงเป็นข้อความ ไม่กลายเป็นคำสั่ง)
- `<img src>` ในเนื้อหา HTML ถูกดึงเข้ารายงานให้เอง (ทั้ง data URI และไฟล์ใต้ `/assets/`)
- ค่าที่ไม่ใช่ HTML → แสดงเป็นข้อความธรรมดา (ไม่โชว์แท็ก)

## หลายชุดข้อมูลในรายงานเดียว

รายงานผูก SQL provider หลักได้ตัวเดียว — ชุดอื่นประกาศในโค้ดได้เลย ไม่ต้องตั้งอะไรเพิ่มในบิลเดอร์

```typst
#let หัวบิล  = dataset-first("req_head")     // provider ที่คืนแถวเดียว → ได้แถวแรก
#let รายการ = dataset("req_items")           // → array ของแถว
#let ยา     = dataset("6ab29b6182443ad9758b97bd")   // อ้างด้วย _id ของ provider ก็ได้

เลขที่ #หัวบิล.at("doc_no", default: "-")
#sdtable(รายการ, columns: (...))
```

- ชื่อในวงเล็บ = **ชื่อ provider (SQL Name)** หรือ **_id ของ provider** · ต้องเป็นข้อความตรง ๆ ไม่ใช่ตัวแปร (server อ่านจากโค้ดก่อน compile)
- ทุกชุดถูกตรวจสิทธิ์เหมือน provider หลัก · ไม่มีสิทธิ์/ไม่พบ = ได้ชุดว่าง รายงานไม่พัง (ดู log ฝั่ง server)
- ค่าถูกแปลงตาม schema ของฟอร์มที่ provider นั้นผูกไว้ (คนละฟอร์มกับ provider หลักได้)
- params ของรายงานถูกส่งให้ทุกชุด → ใช้ `:paramName` ใน WHERE ได้เหมือนกัน
- จำกัด 8 ชุดต่อรายงาน (กันรายงานพิมพ์ช้า)

## สิทธิ์ผู้ใช้ในรายงาน

รู้ว่าใครเป็นคนกดพิมพ์ → เลือกแสดง/ปิดข้อมูลตามสิทธิ์ได้

```typst
#user.username · #user.name · #user.roles · #user.site.name · #user.unit.name

#if-role("pharmacist", "admin")[ต้นทุน #money(raw.cost)]              // ไม่มีสิทธิ์ = ไม่แสดง
#if-role("finance", fallback: [_ไม่มีสิทธิ์ดู_])[ยอดเงิน #money(raw.amount)]
#if has-role("admin") [ ... ] else [ ... ]

#mask(data.cid)                       // 1234567890123 → xxxxxxxxx0123
#mask(data.phone, keep: 3, char: "•")
#redact-unless("admin", data.salary)  // ไม่มีสิทธิ์ = ▮▮▮▮

// ซ่อนทั้งคอลัมน์ (ไม่ถูกนำไปรวมยอดด้วย)
#sdtable(rows, columns: (
  (field: "name", label: "รายการ"),
  (field: "cost", label: "ราคาทุน", align: right, format: "num2", sum: true, roles: ("pharmacist", "admin")),
))
```

**ระดับความปลอดภัย** — ข้อมูลถูกโหลดมาที่ server แล้วเลือก "ไม่พิมพ์ลง PDF" ⇒ **ไฟล์ที่ออกไปไม่มีข้อมูลนั้นจริง** (ต่างจากการซ่อนในหน้าเว็บที่ข้อมูลไปถึงเบราว์เซอร์แล้ว)
ถ้าข้อมูลอ่อนไหวมากจนไม่ควรออกจากฐานข้อมูลเลย ให้กรองที่ SQL provider ด้วยตัวแปรระบบแทน — `:xrolesx` (สิทธิ์ของผู้เรียก) · `:xuser_idx` · `:xsite_codex` · `:xunit_codex`
เช่น คืนค่า `null` เมื่อไม่ใช่เภสัช แล้ว template ค่อยแสดงตามปกติ

> สิทธิ์ "เปิดรายงานนี้ได้ไหม" ยังคุมที่ Report Sharing (private/public/assign + Roles) เหมือนเดิม

## ระบบสี

```typst
#sd.brand  #sd.ok  #sd.warn  #sd.danger  #sd.info  #sd.ink  #sd.muted  #sd.line
#tint(sd.ok)                       // สีอ่อนของสีเดิม — ใช้เป็นพื้นกล่อง/แถบตาราง
#palette.at(0)                     // ชุดสีกราฟ 6 สี วนใช้ตามลำดับชุดข้อมูล
#badge("อนุมัติแล้ว", color: sd.ok)  // ป้ายสถานะพื้นอ่อน ขอบเข้ม
```

ใช้ชุดนี้แทนการพิมพ์ `rgb("#...")` เอง — ทุกรายงานจะสีเดียวกัน และเลือกโทนให้พิมพ์ขาวดำแล้วยังแยกออก

## ผังงาน / กราฟ ในรายงาน

วาดด้วยโค้ด → **ผูกกับข้อมูลจริงได้** (ผังสายอนุมัติเปลี่ยนตามเอกสาร · กราฟเปลี่ยนตามยอด) ไม่ต้องแปะรูปนิ่ง
ชุดวาดภาพ import มาให้แล้วใน `sdthai.typ` — เรียกใช้ได้เลย ไม่ต้อง import เอง

```typst
// ผังงาน (fletcher) — node/edge วางเป็นพิกัดตาราง
#diagram(
  node-stroke: 0.6pt + sd.line, spacing: (10mm, 8mm),
  node((0,0), box(width: 32mm, align(center)[รับคำขอ]), fill: tint(sd.brand), corner-radius: 3pt),
  edge("-|>", text(size: 9pt)[ตรวจสิทธิ์]),
  node((1,0), box(width: 32mm, align(center)[สร้าง PDF]), fill: tint(sd.ok), corner-radius: 3pt),
)

// กราฟแท่ง (cetz-plot)
#cetz.canvas({
  chart.columnchart(size: (11, 4.5), label-key: 0, value-key: 1,
    bar-style: (fill: palette.at(0), stroke: none),
    rows.map(r => (r.month, float(r._raw.amount) / 1000000)))
})

// วาดเองอิสระ (cetz) — สถาปัตยกรรม/ผังห้อง/อะไรที่ต้องคุมพิกัด
#cetz.canvas({
  import cetz.draw: *
  rect((0,0), (4,1.2), fill: tint(sd.brand), stroke: 0.6pt + sd.brand, radius: 0.1)
  content((2,0.6), [ฟอร์ม SDForm])
  line((4.2,0.6), (5.8,0.6), mark: (end: ">"))
})
```

- `chart.columnchart` / `barchart` / `piechart` · กราฟเส้น-จุดใช้ `plot.plot` (ดู cetz-plot)
- **node ที่ข้อความยาวต้องครอบ `box(width: ..)`** ไม่งั้นกล่องยืดจนล้นขอบกระดาษ
- ป้ายบนเส้นชนกล่องเมื่อเส้นสั้น → เพิ่ม `spacing` หรือ `label-sep`
- เวลา compile: รายงานปกติ ~0.05 วิ · มีผัง+กราฟ ~0.27 วิ (เพดาน 10 วิ)
- ภาพนิ่งที่วาดครั้งเดียวจบ ใช้ drawio แล้ว export SVG มา `#img()` เร็วกว่า

## แบบฟอร์มกรอก — จุดไข่ปลา

```typst
ชื่อ #fillin(6cm)[#data.fullname] อายุ #fillin(1.5cm)[#data.age] ปี
ลงชื่อ #dotline(5cm) ผู้ตรวจสอบ
#fillin(8cm, align-to: left)[#data.project]
```

## หน้ากระดาษ / ฟอนต์

- `#show: gov` = A4 · ขอบ บน 2.5 ล่าง 2 ซ้าย 3 ขวา 2 ซม. · TH Sarabun New 16pt · จัดชิดขอบแบบไทย
- `#show: gov.with(size: 15pt)` · `#show: sdthai.with(font: "Sarabun", size: 14pt)`
- แก้เฉพาะบางค่าหลัง show: `#set page(margin: (top: 1.5cm))` · แนวนอน `#set page(flipped: true)`
- ฟอนต์ที่มี: **TH Sarabun New** (ปกติ/หนา/เอียง) · **Sarabun** (Google) — เครื่อง server ไม่มีฟอนต์อื่น
- ย่อหน้าราชการ 2.5 ซม.: `#par(first-line-indent: (amount: 2.5cm, all: true))[...]`
- ขึ้นหน้าใหม่ `#pagebreak()` · เลขหน้า `#set page(numbering: "1")` · เลขไทย `#set page(numbering: (..n) => thainum(n.pos().first()))`

## จัดชิดขอบภาษาไทย

- `gov` / `sdthai` ตั้งให้แล้ว: `linebreaks: "simple"` + ยืดระยะตัวอักษรเล็กน้อย (แบบ "กระจายแบบไทย")
- **อย่าตั้ง `#set par(linebreaks: "optimized")` ทับ** — บางบรรทัดจะขึ้นต้นเยื้องเข้ามา 1 ช่อง (ข้อจำกัดของ Typst กับภาษาไทย)
- ชื่อเฉพาะที่ถูกตัดกลางคำ (ศรีสุว|รรณวงศ์) → `#box(data.fullname)` · แต่บรรทัดนั้นช่องว่างจะถ่างขึ้น — ใช้เฉพาะชื่อที่ไม่มีเว้นวรรค
- ปิดจัดชิดขอบ: `#show: sdthai.with(justify: false)`

## Full example

หนังสือขออนุมัติเบิกจ่าย — ใช้กับ provider ตัวอย่าง `typst_memo_sample` (อยู่ในรีโปที่ `sdform/typst/`)

```typst
#import "sdthai.typ": *
#show: gov
#set page(margin: (top: 1.5cm))

#let net = float(raw.amount) - float(raw.tax) - float(raw.fine)

#place(top + center, img("garuda.png", height: 3cm))
#v(2.4cm)
#grid(columns: (1fr, 1fr),
  [ที่ #thainum(data.doc_no)],
  pad(left: 2.2cm, data.unit_name),
)
#v(0.3em)
#pad(left: 8cm, thainum(thaidate(raw.doc_date)))
#v(0.3em)
#grid(columns: (auto, 1fr), column-gutter: 0.6em, row-gutter: 0.35em,
  [เรื่อง], data.subject,
  [เรียน], data.to_name,
)
#v(0.3em)
#par(first-line-indent: (amount: 2.5cm, all: true))[
  ด้วย #data.unit_name ได้ตรวจสอบหลักฐานการขอเบิกจ่ายเงินให้แก่ #data.pay_to
  ตามสัญญาเลขที่ #thainum(data.contract_no) ลงวันที่ #thainum(thaidate(raw.contract_date))
]
#table(columns: (1fr, auto), stroke: 0.5pt, inset: (x: 8pt, y: 4pt),
  [*รายการ*], [*จำนวนเงิน (บาท)*],
  [จำนวนขอเบิก], align(right, money(raw.amount)),
  [หักภาษี ณ ที่จ่าย], align(right, money(raw.tax)),
  [*คงเหลือจ่ายจริง*], align(right, strong(money(net))),
)
#par(first-line-indent: (amount: 2.5cm, all: true))[
  คงเหลือจ่ายจริงเป็นเงิน #money(net) บาท (#bahttext(net))
]
#v(1em)
#pad(left: 7cm, align(center)[
  ขอแสดงความนับถือ
  #v(2.2em)
  (#data.s4_name) \
  #data.s4_pos
])
```

## Parameters

- ตั้งที่แท็บ **Parameters** ของ report (Variable / Label / Default) → ผู้ใช้กรอกก่อนพิมพ์
- ใน template: `#params.copy_label` · ถ้าอาจไม่ส่งมา `#params.at("copy_label", default: "ต้นฉบับ")`
- params ส่งเข้า SQL provider ด้วย (`:paramName` ใน WHERE) เหมือน report แบบอื่น

## Validate & Errors

- error ขึ้นเป็นบรรทัด/คอลัมน์ในช่อง Typst Code · ข้อความเป็นของ Typst เอง

| ข้อความ | สาเหตุ / แก้ |
|---|---|
| `dictionary does not contain key "x"` | provider ไม่มี field `x` — เช็คชื่อ field / SQL ที่ผูก · หรือใช้ `data.at("x", default: "")` |
| `unknown variable: x` | ลืม `#import "sdthai.typ": *` หรือพิมพ์ชื่อฟังก์ชันผิด |
| `expected integer, float, … or string, found content` | ส่ง `[...]` เข้าฟังก์ชันที่ต้องการข้อความ (เช่น `thainum([x])`) — ส่งค่าตรงๆ แทน |
| `invalid float: …` | `float()` เจอค่าว่าง/ข้อความ — ใช้ `money()` (ทนค่าว่าง) หรือเช็คก่อน `if raw.x not in (none, "")` |
| `failed to download package` | import package จากเน็ตไม่ได้ — ใช้ได้เฉพาะที่ระบบเตรียมไว้ |
| `file not found` | อ่านไฟล์นอก template ไม่ได้ — รูปใช้ `img(...)` |
| `spawn failed (typst)` | server ยังไม่ได้ลง typst (ติดต่อผู้ดูแลระบบ) |

## Engine & Limits

- compile ปกติ 20–60ms · ใบเดิมข้อมูลเดิมพิมพ์ซ้ำภายใน 10 นาทีได้ทันที (cache)
- timeout 10 วินาที · จำกัด memory · รันพร้อมกันได้จำกัด (เกินเข้าคิว)
- template อ่านได้เฉพาะไฟล์ของตัวเอง + `data.json` + `sdthai.typ` + รูปที่ระบบเตรียม
- ไม่ต่อเน็ตตอน compile · package ที่ใช้ได้: ตัวช่วยใน `sdthai.typ` + tiaoma (QR/barcode) · cetz + cetz-plot (วาด/กราฟ) · fletcher (ผังงาน)
- ยังไม่รองรับ: export Word (ใช้ Type = Template แทน)

## Gotchas

- **SQL ที่มีข้อความตายตัวมีจุด** เช่น `'ว.วิทยาศาสตร์' AS project` → field หายเงียบ (NoQL ตีเป็นชื่อ field) → เขียน `CONCAT('ว.วิทยาศาสตร์') AS project`
- **เปลี่ยน SQL ของ report** = field ชุดใหม่ทั้งหมด → template เดิมพังที่ field แรกที่ไม่มี
- `data` = ค่าที่แปลงแล้ว (อาจเป็นข้อความแสดงผล) → คำนวณ/วันที่ใช้ `raw` เสมอ
- `$` ในข้อความตายตัว = เริ่มสูตรคณิต → เขียน `\$` (ค่าในข้อมูลไม่ต้อง)
- `thaidate` / `money` / `thainum` คืน string ต่อกันได้ · `img` / `qr` / `barcode` คืนรูป (วางในบรรทัดได้)
- `#` ในโค้ด (ใน `{}` หรือ argument) ไม่ต้องใส่ — `align(right, money(x))` ไม่ใช่ `align(right, #money(x))`
- หน้าว่าง/เนื้อหาหาย = ค่าเป็น `none` → ตรวจด้วย `#if data.at("x", default: none) != none [...]`
