---
name: report-factory
description: "Use when working with initCraft/SDForm Report Factory: creating or editing PDF, Excel, Word, LaTeX, or Typst reports; configuring report records, pdf_* fields, content widgets, SQL-backed binding, parameters, table columns, Report Items/report-ui buttons, sharing permissions, page layout, templates, exports, or debugging preview/download/render failures. Covers SdReport.vue runtime, pdfmake, XLSX, Word templates, server-side Nunjucks/Tectonic LaTeX, and Typst with sdthai.typ."
---

# Report Factory — สร้างรายงาน

รายงาน 1 ตัว = record ในฟอร์ม Report Factory. ทุกโหมดใช้ SQL Factory เป็นแหล่งข้อมูล แต่มี authoring model แยกกัน: Report ใช้ pdfmake + `{{field}}`, LaTeX ใช้ Nunjucks + Tectonic, Typst อ่าน `data.json` ผ่าน `sdthai.typ`, และ Word ใช้ template `.docx`.

## ก่อนเริ่ม (บังคับ)
1. **โจทย์กำกวม → ถามก่อน**: รายงานอะไร, data มาจาก SQL provider ไหน, layout, ขนาดกระดาษ — อย่าเดา
2. **ต้องมี SQL Factory provider ก่อน** — data source ทั้งหมดมาจาก `pdf_sql`. ยังไม่มี query = ผูกข้อมูลไม่ได้
3. **`{{field}}` ต้องตรงชื่อคอลัมน์ที่ SQL คืนจริง** — query ดูชื่อ variable ก่อน อย่าสมมติ

## 🔑 หัวใจ: การผูกข้อมูล = `{{ชื่อคอลัมน์}}`
SQL คืน rows → ทุกที่ที่พิมพ์ `{{col}}` ถูกแทนด้วยค่าจริง (ผ่าน `strtr`)
- **text / html / image / qrcode / barcode / sub_report** → ใช้ค่าจาก **row แรกเท่านั้น** (เหมาะหัวรายงาน)
- **table** → **วนทุก row** เอง ผ่าน config `pdf_column`
- ⚠️ `content_var` (Variable Name) **ไม่ถูกใช้ตอน render** — เป็นแค่ label ใน builder. ผูกข้อมูลด้วย `{{field}}` เท่านั้น
- รายละเอียด strtr / expressions / subtable / sub_report → [references/binding.md](references/binding.md)
- ⚠️ **ยกเว้น LaTeX** (`pdf_type=latex`): คนละโมเดล — ใช้ Nunjucks `\VAR{}`/`\BLOCK{}` bind ฝั่ง server ไม่ใช่ `{{field}}`/pdf_content/pdf_column → [references/latex.md](references/latex.md)
- ⚠️ **ยกเว้น Typst**: template ไม่ถูกแทนค่าด้วย `{{field}}`; มันอ่าน context ที่ server สร้างให้ผ่าน `sdthai.typ` (`data`, `raw`, `rows`, `params`) → [references/typst.md](references/typst.md)

## Workflow สร้างรายงานแบบ Report (pdfmake)
1. **Identity + data source**: `pdf_name` (บังคับ), `pdf_sql` (เลือก SQL provider — บังคับ, เลือกแล้วแท็บอื่นถึงโผล่ + auto เติม `pdf_form_id`), `pdf_type` = report
2. **Parameters** (ถ้ารับ input ตอนพิมพ์) — แท็บ Parameters → `pdf_params`: `param_var`/`param_type`/`param_default` (`date()` = วันนี้)/`param_required`
3. **เนื้อรายงาน** — แท็บ Builder → `pdf_content` (เพิ่ม/ลากสลับ row ได้): เลือก `content_widget` + กรอก `content_value` (ดูตารางล่าง)
4. **คอลัมน์ตาราง** (เมื่อใช้ `table`) — card Column → `pdf_column`: `col_field`/`col_label`/`col_width`/`col_format`/`col_sum`/`col_group`/`col_expressions`
5. **หน้ากระดาษ** — แท็บ Setting → `pdf_page_size`/`pdf_custom_size`/`pdf_orientation`/margin/`pdf_title`/`pdf_watermark` ฯลฯ
6. **render** — กดปุ่มเลือก output (PDF/Excel/Word/LaTeX)

## Workflow สร้างรายงานแบบ Typst

1. สร้าง Report record, ตั้งชื่อ และเลือก SQL provider ก่อน เพื่อให้เห็น field จริงที่ query คืนมา
2. เลือก Type = **Typst** แล้วเขียน template ในช่อง **Typst Code**; เริ่มด้วย `#import "sdthai.typ": *`
3. เลือก `#show: gov` สำหรับหนังสือราชการ, `#show: report-page()` สำหรับรายงานที่ใช้ค่า Setting, หรือ `#show: sdthai` เมื่อกำหนดหน้ากระดาษเอง
4. ใช้ `data.<field>` สำหรับค่าที่แปลงตาม schema, `raw.<field>` สำหรับคำนวณ/วันที่, `rows` สำหรับหลายแถว และ `params` สำหรับ Report Parameters
5. Save อย่างน้อยหนึ่งครั้งก่อน Validate เพราะ server ต้องใช้ reportId เพื่อโหลด SQL และตรวจสิทธิ์ จากนั้นแก้ error ตามบรรทัด/คอลัมน์และทดสอบ PDF

Typst เหมาะกับเอกสารไทยที่ต้องคุม layout ละเอียด, ตารางข้ามหน้า, แบบฟอร์มจุดไข่ปลา, กราฟ/ผังงาน และเอกสารหลายหน้า ส่วนผู้ใช้ที่ต้องลากวาง content เองควรใช้ Type = Report (pdfmake). รายละเอียด helper, รูป, QR/barcode, widget data, multi-dataset, role masking, engine limits และตัวอย่างเต็มอยู่ใน [references/typst.md](references/typst.md).

## content_widget แต่ละแบบ (ใส่อะไรใน content_value)
| widget | content_value |
|---|---|
| text | ข้อความ + `{{field}}` เช่น `HN: {{hn}} {{name}}` |
| html | HTML (mini editor) + `{{field}}` |
| image | URL/path รูป (+ width/height) |
| qrcode | ค่าเข้ารหัส เช่น `{{hn}}` (+ width) |
| barcode | ค่า CODE128 เช่น `{{hn}}` (+ width) — bars only ไม่มี text |
| table | *ไม่กรอก* — data มาจาก `pdf_column` |
| subtable | JSON `{ subTableField, column[], header[], widths[], alignment[] }` — วน array ซ้อนใน record |
| sub_report | reportId อีกรายงาน → แทรกเนื้อเข้ามา |

## Output (ต่างกันที่ path)
| ชนิด | ที่ไหน | รองรับ |
|---|---|---|
| PDF | client (pdfmake) | ครบทุก widget |
| Excel | client (XLSX) | **เฉพาะ table/subtable/sub_report** (text/รูป/qr/barcode ถูกข้าม) |
| Word | server template `pdf_temp` | .docx template |
| LaTeX | server `pdf_latex` (Tectonic) | **Nunjucks `\VAR{}`/`\BLOCK{}` — ไม่ใช่ `{{field}}`** → [references/latex.md](references/latex.md) |
| Typst | server (`typst` CLI) | template อ่าน `data.json` ผ่าน `sdthai.typ`; PDF เท่านั้น ไม่รองรับ Word → [references/typst.md](references/typst.md) |

## Report UI และสิทธิ์ใช้งาน
- ผูกปุ่มรายงานจาก Form Builder ผ่าน property `Report Items` (`report-editor`) โดยใช้รูปแบบ:
  ```js
  [
    { reportId: "REPORT_ID", label: "Preview", type: "pdf" },
    { reportId: "REPORT_ID", label: "Download", type: "excel" },
    { reportId: "REPORT_ID", label: "Doc", type: "word" }
  ]
  ```
- `type: "pdf"` เปิด preview, `excel` ดาวน์โหลด .xlsx, `word` ต้องมี `pdf_temp[0].url` ไม่เช่นนั้นขึ้น "Template not found."
- ถ้า `pdf_params` มี required param ที่ caller ยังไม่ส่ง `report-ui` จะเปิด dialog ให้กรอกก่อน render
- ตรวจสิทธิ์จาก `pdf_share`: `private` = creator เท่านั้น, `assign` = creator หรือ role ใน `pdf_assign_roles`, ค่าอื่นใช้สิทธิ์แอปรอบนอกประกอบ
- เวลา debug Permission denied ให้เทียบ `created_by.id`, current `user_id`, roles, `pdf_share`, `pdf_assign_roles`

## เลือก reference ให้ตรงงาน
- ต้องการชื่อ field/default/widget ครบ → [references/fields.md](references/fields.md)
- ต้องการเข้าใจค่าหาย, row แรก/ทุก row, expressions, subtable, sub-report, page setup, output path → [references/binding.md](references/binding.md)
- ต้องการสร้างหรือ debug LaTeX → [references/latex.md](references/latex.md)
- ต้องการสร้างหรือ debug Typst, เอกสารราชการไทย, helper/กราฟ/สิทธิ์/หลาย dataset → [references/typst.md](references/typst.md)
- ต้องการ workflow แบบ click-by-click, Report Items, ตัวอย่าง และ checklist จากระบบ live → [references/report-factory-reference.md](references/report-factory-reference.md)

## Gotchas
1. ไม่เลือก `pdf_sql` → แท็บอื่นไม่โผล่ + ผูกข้อมูลไม่ได้
2. `{{field}}` ผิดชื่อแม้ตัวเดียว = ค่าว่างเงียบ
3. text/qr/barcode ใช้แค่ row แรก — อยากได้หลายแถวต้อง table
4. `content_var` ไม่มีผล runtime — อย่าเข้าใจผิดว่าผูกข้อมูล
5. Excel ข้าม content ที่ไม่ใช่ตาราง — จะ export ต้องจัดเป็น table
6. seed model = `sdform/report-model.json` แต่ builder อ่าน field option จาก **DB** — แก้ model ต้อง **re-import** ฟอร์มถึงเห็นใน UI
7. Typst ใช้ `data/raw/rows/params` ไม่ใช้ `{{field}}` หรือ `\VAR{}`; ค่าจากฐานข้อมูลไม่ต้อง escape แต่ข้อความตายตัวใน template ยังต้อง escape อักขระ Typst

## References
- [Field reference ครบ (pdf_* / content item / pdf_column / pdf_params)](references/fields.md)
- [Data flow + binding runtime (strtr / expressions / table / subtable / sub_report / page setup)](references/binding.md)
- [LaTeX output (Nunjucks \VAR/\BLOCK, Tectonic, Thai/escaping/gotchas)](references/latex.md)
- [Typst output (sdthai.typ, data context, Thai helpers, tables, images, diagrams, security, limits)](references/typst.md)
- [Live module workflow, Report Items, examples, and debug checklist](references/report-factory-reference.md)

