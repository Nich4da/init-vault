# Report Factory — LaTeX output (คนละโมเดลกับ PDF/Excel/Word)

⚠️ **LaTeX ไม่ใช้ `{{field}}` / `strtr` / `pdf_content` / `pdf_column` เลย** — เป็น authoring model แยก:
bind ฝั่ง **server** ด้วย **Nunjucks (Jinja2-LaTeX)** แล้ว compile ด้วย **Tectonic** (verify แล้ว — case: ทำ doc + generator LaTeX report doc)

เนื้อทั้งหมดเขียนใน field `pdf_latex` (code editor) เมื่อ `pdf_type = latex` — content item/table column ของ PDF report ถูกข้าม.

## Pipeline
```
กดปุ่ม LaTeX → POST /v1/files/create-latex { reportId, params }
  → server โหลด report + รัน pdf_sql ได้ dataList
  → renderLatexTemplate (Nunjucks) bind ค่า
  → tectonicCompile → PDF → stream blob กลับ (ไม่เก็บไฟล์ ไม่มี url)
```
โค้ดจริง: client `SdReport.vue` typeReport('latex') · server `api-builder/src/decorators/TLatexReport.ts` (`latexReport`/`tectonicCompile`) + route `services/v1/files-manage.ts`

## Syntax (Jinja2-LaTeX → Nunjucks)
| เขียนใน pdf_latex | ความหมาย |
|---|---|
| `\VAR{expr}` | output ค่า (auto-escape `\| tex`) |
| `\BLOCK{stmt}` | logic: for / if / set / endfor / endif |
| `\#{comment}` | comment (ไม่ออกใน PDF) |

- ข้างในเป็น Nunjucks expression — filter (`\| default`, `\| length`), `loop.index` ใช้ได้
- **ห้ามมี `{ }` ซ้อนใน expr** (Nunjucks มองเป็น dict) — ใช้แค่ dot/filter เช่น `\VAR{a.b}`, `\VAR{x \| tex}`

## Data context
- **ชื่อ field ตรงๆ** = ค่าจาก **row แรก** (`rows[0]`) — เช่น `\VAR{hn}` เหมาะหัวรายงาน
- **`rows`** = ทุกแถว (array) — วนตารางด้วย `\BLOCK{for row in rows}...\VAR{row.x}...\BLOCK{endfor}`
- **`params`** = report parameters — `rows`/`params` เป็น reserved key
- coded field (select/status) ถูกแปลงเป็น display value ให้แล้ว (ผ่าน form model ของ pdf_sql)

## Escaping (สำคัญ — พังเงียบง่าย)
- `\VAR{}` **auto-escape** อักขระ LaTeX (`\ { } $ & # _ % ~ ^`) ให้อัตโนมัติ
- ⚠️ **`params.*` ไม่ auto-escape** — ต้อง pipe `\| tex` เองทุกครั้ง: `\VAR{params.date_from \| tex}`
- opt-out escape ด้วย `\| raw` / `\| safe` (ใช้เมื่อค่าคือ LaTeX จริงเท่านั้น — ค่า user + `\| raw` = injection)

## Thai
- **word-break อัตโนมัติ** (server แทรก glue ด้วย `Intl.Segmenter('th')`) — ไม่ต้องทำเอง
- **font เป็นหน้าที่ template** — ใส่ `\usepackage{fontspec}\setmainfont{Sarabun}` ใน preamble เอง; font ต้องมีใน build image ของ backend (Tectonic = XeTeX)

## Gotchas
- **ต้อง save report ก่อน render/Validate** — ต้องมี `reportId` ไปโหลด pdf_sql + permission
- **Validate button** (code editor lang=latex) ส่ง draft ไป compile ลอง → error map เป็น squiggle
- error contract: 404 ไม่พบ report · 403 permission · 400 render/bind fail (Nunjucks) · **422 compile fail** (Tectonic) คืน `{errors:[{line,message}], logTail}`
- **timeout 10s** / mem ~1GB (Linux) ต่อ compile → report ใหญ่ให้ SQL รวมยอด/กรองมาก่อน อย่าให้ template ทำงานหนัก
- `\write18`/shell-escape ปิด — เรียก external command ไม่ได้

## Full syntax reference
เขียนไว้ครบที่ **`initcraft/public/LLM-Report.md`** (เจนจาก `scripts/gen-report-docs.mjs` ผ่าน `npm run docs`; ดูในแอปที่ Builder → Docs → **Report Docs**). ดู [[ref-docs-generators]] (memory) สำหรับระบบ docs.

