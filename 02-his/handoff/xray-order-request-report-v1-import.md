# X-ray Order Request v1 — SQL and Report import

## Revision 2026-09-03 12:05 — เปลี่ยนเป็น A4 portrait ตาม LAB (ใช้ไฟล์นี้)

ผู้ใช้ยืนยันกระดาษเป็น **A4 portrait** และ LAB ทำใหม่เสร็จแล้ว
(`backup-data_report-factory_2026_09_03_11_55_00.zip`, Report `6a977ac8422c1ca959829f97`)
รอบนี้จึงพอร์ต layout ของ LAB มาใส่ X-ray ให้พิมพ์บนกระดาษเดียวกันและหน้าตาเข้าชุดกัน

แก้ **เฉพาะ Report เดิม**; SQL เดิมใช้ต่อได้ ไม่ต้อง import ซ้ำ:

1. Report Factory → Import Report
2. เลือก **Restore Data (Upsert)** ห้าม Clone
3. import `02-his/report_factory/exports/backup-data_report-factory_2026_09_03_12_05_00.zip`
4. target Report ต้องเป็น `6a97f826422c1ca95982a048`; Data Source ต้องเป็น SQL
   `6a97f46b422c1ca95982a03e`
5. Hard refresh หน้า X-ray Workbench แล้วกด PDF ของ Order เดิม

### ค่าที่ยกมาจาก LAB 11:55 ทั้งหมด

| จุด | ค่า (ตรงกับ LAB) |
|---|---|
| หน้ากระดาษ | **A4 portrait** ขอบ 24 |
| โลโก้ | 62 × 86, ml 12, mt 10 |
| หัวสถาบัน | 26 / 17 / 17 px, colgroup 22/56/22, `content_mt −96` |
| Barcode | 104 × 22, mt 0, mr 2, ชิดขวา |
| ชื่อหน่วย | 19 px, fs 17, mt 28, mb 8 |
| บล็อกรายละเอียด | 17 px, 52/48, Diagnosis คอลัมน์ซ้าย |
| ตาราง | 13 pt · footer 12 pt |
| `pdf_fontsize` | **13** (LAB ยังเป็น 12 ใต้หัวตาราง 13 — ของ X-ray ตั้งให้เท่าหัวตาราง) |

### ส่วนที่ยังเป็นของ X-ray เอง

- ไม่มีบล็อก specimen; ใช้บล็อก `exam_info` (ผู้ส่งตรวจ · ความเร่งด่วน · ประเภทการตรวจวินิจฉัย · หมายเหตุ)
- ตาราง 5 คอลัมน์ `#` / `Accession No.` / `รายการตรวจ` / `เครื่อง` / `ตำแหน่ง`
  กว้าง **26 / 104 / \* / 62 / 120** — `#`, `Accession No.`, `ตำแหน่ง` ใช้ค่าเดียวกับ LAB
  ส่วน `เครื่อง` เป็นคอลัมน์ที่ LAB ไม่มี
- คงฟิลด์ `เพศ` ไว้ (LAB ตัดออก แต่ของ X-ray มีมาแต่เดิมและอยู่ในเฟรม Figma)
- พารามิเตอร์ยังเป็น 4 ตัว `order_id`, `visit_id`, `printed_by`, `printed_at`
  (LAB มี `section_code` เพิ่ม เพราะ LAB แบ่งด้วย section ส่วนรังสีไม่แบ่ง)

### หลักฐานการตรวจ

เรนเดอร์ทั้ง LAB 11:55 และ X-ray 12:05 ผ่าน pipeline จริงเดียวกันแล้ววัดตำแหน่งทุกแถว
ที่สเกลเดียวกัน — แถวที่มีร่วมกันตรงกันเกือบทั้งหมด:

| แถว | LAB (y) | X-ray (y) | ต่าง |
|---|---|---|---|
| บล็อกหัวกระดาษ | 50 | 50 | 0 |
| ชื่อหน่วย | 215 | 211 | −4 |
| ชื่อ / อายุ | 256 | 256 | 0 |
| คลินิกที่ส่ง | 288 | 288 | 0 |
| ยาที่เคยได้รับ | 320 | 320 | 0 |
| Diagnosis บรรทัด 1–2 | 358 / 382 | 358 / 382 | 0 |
| บล็อกที่สอง แถว 1–3 | 428 / 463 / 495 | 430 / 464 / 491 | +2 / +1 / −4 |
| หัวตาราง | 559 | 553 | −6 |
| แถวข้อมูล | 580 | 580 | 0 |

ที่ต่าง −4/−6 มาจากความสูงตัวอักษรของข้อความคนละชุด ไม่ใช่ layout เพี้ยน

ไฟล์เทียบภาพ: `tmp/pdfs/xray-vs-lab-portrait.png`
PDF ผลลัพธ์: `output/pdf/xray-order-request-v1-sdreport-preview.pdf`

Static contract, ZIP integrity, `pdfinfo` (A4 portrait 1 หน้า) และเทสรีเกรสชันผ่านทั้งหมด
(report 1 + xray api/form 8); **initCraft runtime หลัง Upsert ยังเป็น final gate**

> แพ็กเกจ landscape `...11_50_00.zip` ยังอยู่ครบ ถ้าต้องย้อนกลับไปแนวนอนก็ import ตัวนั้นได้

> Cleanup 2026-09-03: superseded X-ray Order SQL/Report exports were moved to macOS Trash.
> Only SQL `00_45_00` and Report `11_50_00` remain import candidates; historical paths below
> are provenance notes, not usable files.

## Revision 2026-09-03 11:50 — คาลิเบรตตัวอักษร/ระยะห่างให้ตรง Figma จริง (ใช้ไฟล์นี้)

แก้ **เฉพาะ Report เดิม** ตามเฟรม Figma `2974:72`; SQL เดิมใช้ต่อได้ ไม่ต้อง import ซ้ำ:

1. Report Factory → Import Report
2. เลือก **Restore Data (Upsert)** ห้าม Clone
3. import `02-his/report_factory/exports/backup-data_report-factory_2026_09_03_11_50_00.zip`
4. target Report ต้องเป็น `6a97f826422c1ca95982a048`; Data Source ต้องเป็น SQL
   `6a97f46b422c1ca95982a03e`
5. Hard refresh หน้า X-ray Workbench แล้วกด PDF ของ Order เดิม

### ทำไมรอบ 10:35 ถึงไม่ตรง mockup

ถอด bundle ของ renderer ที่ deploy อยู่ (`SdReport.vue`) แล้วพบสามข้อที่ทำให้ค่าที่แปลงจาก
Figma ตรง ๆ ออกมาไม่เหมือน:

- ฟอนต์จริงของ PDF คือ **THSarabun** ซึ่งแคบและเตี้ยกว่าฟอนต์ใน Figma มาก ที่ขนาด pt เท่ากัน
  ตัวอักษรจึงเล็กกว่าราว **1.5 เท่า**
- HTML ถูกส่งผ่าน `html-to-pdfmake` ด้วย `ignoreStyles: ["line-height","font-family"]`
  → **`line-height` ถูกทิ้งทั้งหมด** ระยะห่างบรรทัดจึงยุบเหลือเท่าขนาดฟอนต์
- `padding` ของ `<td>` ก็ถูกทิ้งเช่นกัน ระยะเยื้องต้องทำด้วย `margin` ของ `<div>` แทน
- ตัวเลขในตารางใช้ `pdf_fontsize` ไม่ใช่ `content_fontsize` ของ widget ตาราง

### ค่าที่ปรับ (เทียบกับ 10:35)

| จุด | เดิม | ใหม่ |
|---|---|---|
| ชื่อสถาบัน 3 บรรทัด | 28 / 18 / 18 px | **44 / 27 / 27 px** |
| Order No. / วันที่ / เวลา | 16 px | **24 px** |
| บล็อกผู้ป่วย และบล็อกการตรวจ | 16 px + `line-height` | **24 px + margin จริง** |
| ชื่อหน่วย X-ray | 18 px | **27 px** |
| ตาราง + footer | 12 / 14 pt | **18 pt** |
| `pdf_fontsize` (ตัวเลขในแถวตาราง) | 12 | **18** |
| โลโก้ | 81 × 112.5, ml 27 | 81 × 112.5, ml 27, **mt 3.5** |
| Barcode | 154 × 30, mt −4 | **144 × 28, mt −35.75** |
| Diagnosis | เต็มแถว `colspan=2` | **อยู่คอลัมน์ซ้าย** ตัดบรรทัดเหมือน Figma |
| คอลัมน์รายละเอียด | 51 / 49 | **53 / 47** |

### หลักฐานการตรวจ

สร้าง renderer จำลองที่ใช้ pipeline เดียวกับของจริง (pdfmake + html-to-pdfmake +
ฟอนต์ THSarabun ที่แกะออกมาจาก bundle ที่ deploy อยู่) แล้ววัดตำแหน่งทุกแถวเทียบกับ
เฟรม Figma ที่สเกลเดียวกัน (หน้า 1121 × 792 px):

| แถว | Figma (y) | ผลลัพธ์ (y) | ต่าง |
|---|---|---|---|
| ชื่อหน่วย X-ray | 209 | 210 | +1 |
| ชื่อ / อายุ | 239 | 232 | −7 |
| คลินิกที่ส่ง | 273 | 269 | −4 |
| ยาที่เคยได้รับ | 299 | 298 | −1 |
| Diagnosis บรรทัด 1 | 337 | 337 | 0 |
| Diagnosis บรรทัด 2 | 367 | 364 | −3 |
| ผู้ส่งตรวจ | 410 | 409 | −1 |
| ความเร่งด่วน | 445 | 448 | +3 |
| หมายเหตุ | 474 | 481 | +7 |
| หัวตาราง | 528 | 528 | 0 |
| แถวข้อมูล | 574 | 574 | 0 |
| Print by | 646 | 649 | +3 |

โลโก้ `x73-170 / y42-174` เทียบ `x71-171 / y43-181`; barcode `y107-144` ตรงกันพอดี;
Order No. `y36-47` เทียบ `y36-48`. ที่เหลือ ±7 px มาจาก padding ของแถวตารางใน pdfmake
ซึ่งปรับผ่านเรกคอร์ดไม่ได้

ไฟล์เทียบภาพ: `tmp/pdfs/xray-order-request-v1-mockup-vs-result.png`
PDF ผลลัพธ์: `output/pdf/xray-order-request-v1-sdreport-preview.pdf`

Static contract, ZIP integrity, `pdfinfo` (A4 landscape 1 หน้า) และเทสรีเกรสชัน
`test_xray_order_request_report.js` ผ่าน; **initCraft runtime หลัง Upsert ยังเป็น final gate**

> ค้างอยู่: LAB Order Report (`6a977ac8422c1ca959829f97`) มีอาการเดียวกันหนึ่งจุด —
> `pdf_fontsize` ยังเป็น 12 ขณะที่หัวตารางขาวถูกตั้งไว้ 18 ทำให้ตัวเลขในแถวเล็กกว่าหัวตาราง
> ยังไม่แก้ให้เพราะเป็นเรกคอร์ดคนละตัว รอผู้ใช้สั่ง

## Revision 2026-09-03 10:35 — ตรงตาม Figma หน้า earn (ใช้ไฟล์นี้)

แก้ **เฉพาะ Report เดิม** ตามเฟรม Figma `2974:72`; SQL เดิมใช้ต่อได้:

1. Report Factory → Import Report
2. เลือก **Restore Data (Upsert)** ห้าม Clone
3. import `02-his/report_factory/exports/backup-data_report-factory_2026_09_03_10_35_00.zip`
4. target Report ต้องเป็น `6a97f826422c1ca95982a048`; Data Source ต้องเป็น SQL
   `6a97f46b422c1ca95982a03e`
5. Hard refresh หน้า X-ray Workbench แล้วกด PDF ของ Order เดิม

ค่าที่ถอดจาก Figma โดยแปลง `1 px = 0.75 pt`: A4 landscape ขอบ 24 pt, โลโก้
`81 × 112.5 pt` และเยื้องซ้าย 27 pt, ชื่อสถาบัน `28/18/18 px`, barcode
`154 × 30 pt`, patient/exam สองคอลัมน์ `51/49`, ตารางกว้าง
`33 / 143 / * / 105 / 167 pt`, หัวตารางขาว และเส้นแนวนอนเท่านั้น
(`lightHorizontalLines`). AN ใช้ binding เดิมซึ่งคืนค่าว่างเมื่อไม่มีข้อมูล

สาเหตุของ Loading รอบ 09:10 ระบุได้จาก `SdReport.vue`: `pdf_tb_header` ต้องเป็น
array ของแถว แต่แพ็กเกจเดิมส่ง flat array ทำให้ห้าช่องถูกตีความเป็นห้าแถว รอบนี้ใช้
`[[cell1, ..., cell5]]` ซึ่งตรง contract ของ renderer และทำให้กำหนดหัวตารางขาวได้โดยไม่
ต้องกลับไปใช้หัวตารางเทาอัตโนมัติ. Static contract, ZIP integrity และ PDF จำลอง A4
landscape 1 หน้าผ่านแล้ว; initCraft runtime หลัง Upsert ยังเป็น final gate

## Hotfix 2026-09-03 09:20 — แก้ PDF ค้าง Loading (เก็บเป็นประวัติ; 10:35 แทนที่แล้ว)

ภาพ runtime 09:07 ยืนยันว่า Workbench ส่ง `order_id`, `visit_id`, `printed_by`,
`printed_at` ถึง SQL แล้ว แต่หน้าเว็บค้างในช่วงประกอบ PDF หลัง SQL response. จุดเปลี่ยนเชิง
โครงสร้างเพียงจุดเดียวจาก revision ที่เคยเปิดได้คือ custom `pdf_tb_header`; hotfix นี้จึงถอด
custom header ออกและกลับไปให้ `SdReport.vue` สร้างหัวตารางจาก `pdf_column` ตามปกติ

1. Report Factory → Import Report
2. เลือก **Restore Data (Upsert)** ห้าม Clone
3. import `02-his/report_factory/exports/backup-data_report-factory_2026_09_03_09_20_00.zip`
4. target Report ต้องเป็น `6a97f826422c1ca95982a048`; Data Source ต้องเป็น SQL
   `6a97f46b422c1ca95982a03e`
5. Hard refresh หน้า X-ray Workbench แล้วกด PDF ใหม่

SQL, logo `54 × 76`, ชื่อสถาบัน `20/15/15`, barcode `154 × 32`, grid `17/54/29`
และ `lightHorizontalLines` ไม่เปลี่ยน. การถอด custom header อาจทำให้พื้นหัวตารางกลับเป็นสี
มาตรฐานของ renderer; ต้องยืนยันว่า PDF เปิดได้ก่อน แล้วค่อยแก้สีหัวตารางด้วยวิธีที่ renderer
รุ่นนี้รองรับ. ถ้ายังค้าง ให้เปิด Console และเก็บ error สีแดงบรรทัดแรก

## Update 2026-09-03 09:10 — จัด Header ให้ตรง Preview จริง (เก็บเป็นประวัติ)

รอบนี้แก้ **เฉพาะ Report เดิม**; SQL จากรอบ 00:45 ใช้ต่อได้ ไม่ต้อง import ซ้ำ:

1. Report Factory → Import Report
2. เลือก **Restore Data (Upsert)** ห้าม Clone
3. import `02-his/report_factory/exports/backup-data_report-factory_2026_09_03_09_10_00.zip`
4. ตรวจว่า target Report ยังเป็น `6a97f826422c1ca95982a048` และ Data Source ยังเป็น
   SQL `6a97f46b422c1ca95982a03e`

สิ่งที่ปรับจาก Preview 08:53:

- โลโก้ใช้สัดส่วนเดียวกับ mockup `54 × 76 pt` และหัว HTML ซ้อนจากระยะ `-76 pt`
  จึงเริ่มในแถวเดียวกันโดยไม่กินพื้นที่ชื่อหน่วย X-ray ด้านล่าง
- ชื่อสถาบันเพิ่มจาก 16 เป็น 20, บรรทัดอังกฤษ/กรมการแพทย์เพิ่มจาก 13 เป็น 15
- Barcode ลดจาก `190 × 28` เป็น `154 × 32 pt`; ความกว้าง 154 เท่ากับคอลัมน์ขวา
  29% ของพื้นที่พิมพ์ที่ใช้แสดง Order No./วันที่/เวลา
- เพิ่มช่องว่าง 12 pt ก่อนชื่อหน่วย X-ray เพื่อกันโลโก้ทับ
- กำหนด `pdf_tb_header` ทุกช่องเป็น `fillColor: #FFFFFF` และคง
  `lightHorizontalLines`; หัวตารางจึงขาว ไม่มีพื้นเทาและไม่มีเส้นตั้ง

ไฟล์ preview จากข้อมูลจำลองที่อัปเดตแล้วคือ `output/pdf/xray-order-request-v1-preview.pdf`.
หลัง Upsert ต้องตรวจ Report Preview ใน initCraft อีกครั้ง เพราะ renderer จริงคือ `SdReport.vue`.

## Update 2026-09-03 — ปรับหน้ารายงานตามแบบใหม่ (ใช้ 2 ไฟล์นี้)

รอบนี้แก้ **เรกคอร์ดเดิม** ไม่สร้าง SQL/Report ซ้ำ ให้ import ตามลำดับนี้:

1. SQL Factory → Import SQL → **Restore Data (Upsert)**
   `02-his/sql-factory/exports/backup-data_sql-factory_2026_09_03_00_45_00.zip`
   เป้าหมายเดิม `6a97f46b422c1ca95982a03e`
2. Report Factory → Import Report → **Restore Data (Upsert)**
   `02-his/report_factory/exports/backup-data_report-factory_2026_09_03_00_50_00.zip`
   เป้าหมายเดิม `6a97f826422c1ca95982a048`

ต้องลง SQL ก่อน Report เพราะ SQL รอบนี้เพิ่มการแปลงค่าที่ใช้พิมพ์:

- AN ที่ไม่มีค่าและถูกเก็บเป็น `0`/`0.0` แสดงว่าง
- priority code `1–5` แสดง label ตาม CPOE Order (`ปกติ`, `ด่วน`, `ด่วนที่สุด`,
  `ด่วน OR`, `ด่วน อุบัติเหตุ`)
- ชื่อผู้ส่งตรวจและแพทย์ผู้ส่งตรวจตัด account/email ในวงเล็บออก

Report รอบใหม่ใช้โลโก้ที่ผู้ใช้ส่งไว้ฝั่งซ้าย, ชื่อสถาบัน 3 บรรทัดอยู่กลาง,
Order No./วันที่/เวลาและ Barcode อยู่ขวา, ใช้ label `ชื่อ`, `คลินิกที่ส่ง`, `วันที่`,
`ประเภทการตรวจวินิจฉัย` และตั้งตารางเป็น `lightHorizontalLines` เพื่อแสดงเฉพาะ
เส้นแนวนอน ไม่มีเส้นแบ่งคอลัมน์

ไฟล์ preview จากข้อมูลจำลองล้วนอยู่ที่
`output/pdf/xray-order-request-v1-preview.pdf`; ผ่านการตรวจ 1 หน้า A4 และไม่มี label เก่า/email
แต่หลัง Upsert ยังต้องเปิด **Report Preview ใน initCraft** ด้วย Order UAT จริง เพราะ preview
ในเครื่องไม่ใช่ renderer ตัวเดียวกับ `SdReport.vue`.

ชุดเดียวกับ `lab-order-request-report-v1-import.md` ทุกประการ ต่างกันที่ **ตัดบล็อก
specimen ออกทั้งหมด** และ **ไม่ scope ด้วย `section_code`** เพราะงานรังสีไม่ได้แบ่งย่อย
ด้วย `zdata_section` แบบ LAB (ยืนยันจาก `xray_cpoe_worklist_api.js`)

| ของ | ค่า |
|---|---|
| SQL name | `X-ray Order Request PDF v1` |
| Report name | `X-ray Order Request v1` |
| SQL ID ที่ตั้งไว้ในแพ็กเกจ | `6a98a1c0422c1ca95982a1c0` |
| Report ID ที่ตั้งไว้ในแพ็กเกจ | `6a98a1c1422c1ca95982a1c1` |
| SQL ID จริงหลัง Clone รอบล่าสุด | `6a97f46b422c1ca95982a03e` |
| Report ID จริงหลัง Clone รอบล่าสุด | `6a97f826422c1ca95982a048` |
| Form · X-ray Workbench เดิม | `6a953fb6422c1ca959829e14` |
| พารามิเตอร์ | `order_id`, `visit_id`, `printed_by`, `printed_at` |

## ไฟล์ import รอบสร้างครั้งแรก (เก็บไว้เป็นประวัติ)

| ลำดับ | ไฟล์ | เมนู |
|---|---|---|
| 1 | `02-his/sql-factory/exports/backup-data_sql-factory_2026_09_02_16_00_00.zip` | SQL Factory → Import SQL |
| 2 | `02-his/report_factory/exports/backup-data_report-factory_2026_09_02_17_15_00.zip` | Report Factory → Import Report |
| 3 (ไม่จำเป็น) | `02-his/sql-factory/exports/backup-data_sql-factory_2026_09_02_16_40_00.zip` | SQL Factory → Import SQL (ตัวหา ID ไว้เทสเท่านั้น) |
| 4 | `Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json` | Form Factory → Restore Data (Upsert) ฟอร์มเดิม |

> รอบแก้ 17:15: ผู้ใช้ลบ Report clone เดิมแล้ว ไฟล์ Report ล่าสุดจึงสร้างสำหรับ
> **Clone Data (Insert new id)** และผูก `pdf_sql` กับ SQL จริง
> `6a97f46b422c1ca95982a03e` โดยตรง ห้ามใช้ Report ZIP เวลา 16:10 กับ SQL clone นี้
> เพราะไฟล์เก่ายังชี้ preset ID ที่ไม่มีในระบบและจะขึ้น `Data not found`/PDF ว่าง

## Stage 1 — SQL Factory

1. เปิด **SQL Factory → Import SQL**
2. เลือก **Clone Data (Insert new id)**
3. import ZIP ข้อ 1
4. เปิดเรกคอร์ด **X-ray Order Request PDF v1** ต้องขึ้น **NoSQL / Aggregate**
   และ SQL Select ว่างโดยตั้งใจ
5. ตรวจ Variables ต้องมี 31 ชื่อ และ Parameters ต้องมี 4 ตัวตามตารางข้างบน
6. **คัดลอก 24-character ID ของเรกคอร์ดใหม่ไว้** — ใช้ยืนยัน Data Source ใน Stage 2

Variables ที่ต้องได้:
`row_no`, `order_id`, `order_number`, `order_date`, `order_time`, `patient_name`,
`hn`, `age_display`, `gender_display`, `an`, `ward_clinic`, `insurance_display`,
`prior_medication_display`, `diagnosis_display`, `priority_display`, `order_note`,
`requester_name`, `submitter_name`, `accession_no`, `item_code`, `item_name`,
`test_display`, `modality_code`, `modality_display`, `body_part`, `item_status`,
`section_code`, `section_name`, `section_unit`, `printed_by`, `printed_at`

รัน SQL Test ด้วย `order_id` + `visit_id` ของ CPOE X-ray order จริงหนึ่งใบ
`visit_id` คือ **Visit record ID (`order.xparentx`)** ตัวเดียวกับที่ deep link EMR ใช้
ไม่ใช่ข้อความ VN ที่แสดงบนจอ

## Stage 2 — Report Factory

1. เปิด **Report Factory → Import Report**
2. เลือก **Clone Data (Insert new id)**
3. import ZIP ข้อ 2
4. เปิด **X-ray Order Request v1** แล้วตรวจช่อง Data Source ต้องเป็น
   `X-ray Order Request PDF v1` ที่ ID `6a97f46b422c1ca95982a03e`
5. รัน Report Preview ด้วยพารามิเตอร์ชุดเดียวกับที่ SQL Test ผ่านแล้ว

แพ็กเกจ Report เวลา 17:15 ผูกกับ SQL clone จริงข้างบนแล้ว การ Clone Report จะเปลี่ยน
เฉพาะ Report ID ใหม่ แต่ต้องรักษา Data Source นี้ไว้

## Stage 3 — X-ray Order ID Finder v1 (ไฟล์ที่ 3 · ไม่ต้อง import ก็ได้)

ตัวช่วยหา `order_id` + `visit_id` ไว้ป้อนให้ Report ไม่ใช่ส่วนหนึ่งของใบสั่งตรวจ
import แบบ **Clone Data (Insert new id)** เหมือนกัน

ตอนนี้มีคู่ UAT ที่พิสูจน์กับ pipeline จริงแล้ว จึง **ไม่จำเป็นต้อง import ตัวช่วยนี้**:
`order_id=6a97f15d422c1ca95982a032` และ `visit_id=6a97a644422c1ca959829fb1`
(Order No. `R2609020005`)

- SQL ID ที่ตั้งไว้: `6a98a1c2422c1ca95982a1c2` · ชื่อ `X-ray Order ID Finder v1`
- อ่าน **`zdata_cpoe_order`** ตรง ๆ ไม่ `$lookup` เพื่อกรอง และ **ไม่พึ่ง `service_type`**
  จึงใช้ได้แม้ในกรณีที่ `X-ray Order Request PDF v1` คืน 0 แถว
- Parameter เดียว: `order_number` — ใส่เลขที่อ่านจากคอลัมน์ Order No. บนหน้า
  X-ray Workbench เช่น `R2609020004`
- Variables 10 ชื่อ: `order_id`, `visit_id`, `order_number`, `order_created_at`, `hn`,
  `vn`, `patient_name`, `item_count`, `xray_item_count`, `service_types`

`order_id` และ `visit_id` ที่คืนมาคำนวณด้วยนิพจน์เดียวกับที่ Report ใช้กรอง มี test ล็อกไว้

คอลัมน์ `service_types` คือค่า `service_type` ที่ item ในใบนั้นใช้จริง ใช้วินิจฉัยได้ทันที:
ถ้า `xray_item_count` เป็น 0 แต่ `service_types` ขึ้นค่าอื่น แปลว่าคำว่า `xray`
ในระบบสะกดต่างจากที่ pipeline ของใบสั่งตรวจใช้อยู่ ส่งค่าที่เห็นกลับมาแล้วจะแก้ให้

> `vn` ที่คืนมาไว้ดูเฉย ๆ **ห้ามเอาไปใส่ `visit_id`** — `visit_id` ต้องเป็น Visit record ID

## หน้าตาเอกสาร PDF

A4 แนวนอน ขอบ 24 pt รอบด้าน ตาม Figma หน้า earn:

1. โลโก้ใหม่ 81 × 112.5 pt ชิดซ้ายและเยื้อง 27 pt
2. หัวเอกสารสามคอลัมน์ 23/54/23 — กลางเป็นชื่อสถาบันภาษาไทย/อังกฤษและกรมการแพทย์;
   ขวา Order No. / วันที่ / เวลา
3. บาร์โค้ด `order_number` ชิดขวา และชื่อหน่วย X-ray อยู่ซ้ายใต้หัวเอกสาร
4. บล็อกผู้ป่วยสองคอลัมน์ 52/48 — ชื่อ · อายุ/เพศ/HN · คลินิกที่ส่ง · วันที่/AN ·
   ยาที่เคยได้รับ · สิทธิการรักษา · Diagnosis
5. **บล็อก exam_info (แทนที่บล็อก specimen ของ LAB)** — ผู้ส่งตรวจ · แพทย์ผู้ส่งตรวจ ·
   ความเร่งด่วน · ประเภทการตรวจวินิจฉัย · หมายเหตุ/ข้อบ่งชี้
6. ตารางรายการ 5 คอลัมน์: `#` 33 · `Accession No.` 143 · `รายการตรวจ` `*` ·
   `เครื่อง` 105 · `ตำแหน่ง` 167; หัวขาวและมีเฉพาะเส้นแนวนอน
   (`lightHorizontalLines`)
7. ฟุตเตอร์ Print by / Date

บล็อกข้อมูลผู้ป่วยและข้อมูลการตรวจใช้ font size `16`, ตารางใช้ `12`, ฟุตเตอร์ใช้ `14`;
หัวชื่อสถาบันกำหนดใน HTML เป็น `28/18/18 px` ตาม Figma

## สิ่งที่ต่างจากใบ LAB

| LAB | X-ray |
|---|---|
| `lab_no` (ว่างจนกว่าจะรับ specimen) | `accession_no` (ว่างจนกว่าจะส่งเข้าเครื่อง) |
| คอลัมน์ `Specimen` | คอลัมน์ `เครื่อง` + `ตำแหน่ง` |
| บล็อก specimen (source/เก็บเมื่อ/ผู้เก็บ/การเก็บรักษา) | บล็อก exam_info (ความเร่งด่วน/Section/หมายเหตุ) |
| scope = `order_id` + `visit_id` + `section_code` | scope = `order_id` + `visit_id` |
| join `zdata_lab_work_item` | ไม่มี — Accession อยู่บน CPOE item เอง |

`section_code` / `section_name` / `section_unit` ยังคำนวณและแสดงอยู่ แต่ **ใช้แสดงผล
อย่างเดียว ไม่ได้เป็นตัวกรอง** ดังนั้นถ้า master ไม่ได้ผูก section ไว้ ช่องจะว่าง
แต่รายการตรวจจะไม่หายไปจากใบ

modality อ่านตามลำดับเดียวกับ Workbench เป๊ะ ๆ
(`master.xray_item.modality` → `.modality_type` → `section.modality_type`)
เพื่อไม่ให้ใบที่พิมพ์ออกมาขัดกับสิ่งที่เห็นบนหน้าจอ มี test คุมไว้ว่า enum 11 ค่า
ต้องตรงกับ `xray_cpoe_worklist_api.js` เสมอ

## สิทธิ์การเข้าถึง

SQL provider ตั้งเป็น `public` ชั่วคราวสำหรับ UAT ด้วยเหตุผลเดียวกับ LAB — Report Preview
ได้ 403 จาก `crud/getdata-all` ถ้า provider เป็น private ส่วน Report เป็น `private`
**หลัง UAT ผ่านให้จำกัด SQL/Report ให้เฉพาะ role รังสี**

## UAT

- SQL คืน 1 แถวต่อ X-ray item ที่ยังไม่ถูกลบ ของ Order + Visit นั้นเท่านั้น
- Order No. มาจาก CPOE
- Accession No. ว่างก่อนส่งเข้าเครื่อง และเท่ากับเลขที่ `xray-accession-generate` ออกให้หลังส่ง
- Preview เรนเดอร์ A4 แนวตั้ง ไม่มี binding ค้าง ไม่มีข้อความไทยถูกตัด
- ใบที่มีหลายรายการต้องขึ้นครบทุกแถว เลข `#` เรียง 1..n
- รายการที่ยกเลิก/ถูกปฏิเสธไม่ควรปรากฏบนใบสั่ง (กรองด้วย `xrstatx`)

## Stage 4 — ต่อปุ่ม PDF เข้า X-ray Workbench

ต่อ Report ID `6a97f826422c1ca95982a048` เข้าแถว Order แล้ว โดยใช้ `<sd-report>` ส่ง
`order_id`, `visit_id`, `printed_by`, `printed_at` จาก Order ที่กดโดยตรง

- import ไฟล์ข้อ 4 ด้วย **Restore Data (Upsert)** เพื่ออัปเดต Form เดิม ID
  `6a953fb6422c1ca959829e14` — ห้าม Clone เพราะจะเกิด Workbench อีกตัว
- Order ปกติ: แสดง `PDF` ใบสั่งตรวจ แล้วตามด้วย `EMR`
- Order ที่ขาด Order ID หรือ Visit ID: แสดง PDF แบบ disabled พร้อมเหตุผล
- Order ที่ยกเลิก: ซ่อน PDF/EMR และคง `ตรวจใหม่`
- ปุ่ม `PDF ผลอ่าน` ในแท็บผลอ่านยังอยู่ระดับ item และเปิดได้หลังมีผลเหมือนเดิม
- ปุ่ม Report บน toolbar ยังเป็น placeholder เพราะคำขอนี้ครอบคลุมเฉพาะแต่ละ Order

หลัง Restore ให้เปิด Builder/Preview แล้วกด PDF จาก Order No. `R2609020005` ตรวจว่า
เอกสารไม่ว่างและตรงผู้ป่วย/Order ที่กด

## regenerate

```bash
# ทั้งสองแพ็กเกจ (ใช้ SQL ID ที่ตั้งไว้ล่วงหน้า)
node Form-Builder/API/report_factory/builders/build_xray_order_request_report.js

# ผูก Report เข้ากับ SQL ID จริงที่ Clone Data ออกให้
node Form-Builder/API/report_factory/builders/build_xray_order_request_report.js \
  --sql-id=<SQL ID จริง>

# แพ็กเกจ Restore Data (Upsert) สำหรับแก้เรกคอร์ดที่ import ไปแล้ว
node Form-Builder/API/report_factory/builders/build_xray_order_request_report.js \
  --sql-id=<SQL ID จริง> \
  --restore-sql-id=<SQL ID จริง> \
  --restore-report-id=<Report ID จริง>
```

แล้ว zip ตามชื่อระบบ:

```bash
zip -j 02-his/sql-factory/exports/backup-data_sql-factory_2026_09_02_16_00_00.zip \
  Form-Builder/SDForm/sql-factory/exports/backup-data-module_sql-Earn_admin-2026_09_02_16_00_00.json
zip -j 02-his/sql-factory/exports/backup-data_sql-factory_2026_09_02_16_40_00.zip \
  Form-Builder/SDForm/sql-factory/exports/backup-data-module_sql-Earn_admin-2026_09_02_16_40_00.json
zip -j 02-his/report_factory/exports/backup-data_report-factory_2026_09_02_16_10_00.zip \
  Form-Builder/SDForm/report_factory/exports/backup-data-module_report-Earn_admin-2026_09_02_16_10_00.json
```

test แบบ static:

```bash
node Form-Builder/API/report_factory/tests/test_xray_order_request_report.js
```
