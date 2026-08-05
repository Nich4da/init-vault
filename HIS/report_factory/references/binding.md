# Report Factory — Runtime & Data Binding

Renderer: `initcraft/src/components/sdwidget/SdReport.vue` (Options API, ใช้ pdfmake). อธิบาย pipeline จริงตอน render — เลี่ยงอ้าง line number (เปลี่ยนง่าย) ใช้ชื่อ function/field แทน.

## Pipeline
```
createReport(reportId, type)
  → sdformGetOne (SYS provider getreport-one) → reportData
  → permissionReport() gate
  → ถ้ามี pdf_params ที่ required ยังไม่ครบ → เปิด dialog กรอกก่อน
  → typeReport(type, reportData, params) แยกทาง:
       pdf   → pdfReport() → createPdf()      [client, pdfmake]
       excel → excelReport() → createExcel()  [client, XLSX]
       word  → POST /v1/files/create-word     [server, จาก pdf_temp]
       latex → POST /v1/files/create-latex    [server, คืน PDF blob]
```

## 1. ดึง data
ใน `pdfReport` (และ `excelReport` เหมือนกัน) — ดึงเมื่อ `reportData.pdf_sql.value` มีค่า:
```js
const dpSql = { providerId: reportData.pdf_sql.value, providerType: ProviderType.SQL, params };
const responseSql = await sdformGetAll(dpSql, false, this.useUserState);
const dataList = deepClone(responseSql.data.data);
```
- `pdf_sql` = **SQL Factory provider** รัน server-side, `params` = report params
- **shape ของ dataList** (รองรับ 2 แบบ):
  - **Array of rows** (มี `dataList[0]._id`) → หลายแถว, `pathParams` สร้างจาก `dataList[0]` (แถวแรก)
  - **Single object** (ไม่มี `_id`) → 1 record, `pathParams` สร้างจาก `dataList` ตรงๆ
- `pdf_form_id` → `getFormModel()` โหลด schema มา **แปลงค่า field เป็น display value** เท่านั้น (ไม่ใช่ดึง data)

## 2. สร้าง dict แทนค่า — `value2Path(data, sdformModel)`
ต่อ 1 row สร้าง entry คีย์ `{{key}}`:
```js
path[`{{${key}}}`] = keyMatchesSchema
  ? getValueConvertInput(rawValue, prop, sdformModel)  // แปลง coded → display
  : rawValue;                                          // ค่าดิบ
```
row `{ hn:'123', name:'A' }` → `{ '{{hn}}':'123', '{{name}}':'A' }`

## 3. แทนค่าต่อ content item
```js
let contentValue = '';
if (!!contentItem.content_value) {
  if (typeof contentItem.content_value === 'object') contentValue = contentItem.content_value; // table/subtable
  else contentValue = strtr(contentItem.content_value, pathParams);  // ← binding
}
```
- **`strtr(str, dict)`** (Util.ts) = แทนทุก key ของ dict ที่เจอใน str (two-pass กัน cascade)
- scalar เช่น `"HN: {{hn}} — {{name}}"` → `"HN: 123 — A"`
- ⚠️ ใช้ **row แรกเท่านั้น** สำหรับ text/html/image/qr/barcode/sub_report (การวน row อยู่ใน table)
- **`content_var` ไม่ถูกอ้างใน renderer เลย** — ผูกข้อมูลด้วย `{{field}}` ที่ตรงชื่อคอลัมน์ SQL เท่านั้น

## 4. Table (`tableContent`) — วนทุก row
- คอลัมน์มาจาก **`reportData.pdf_column`** (ไม่ใช่ content_value)
- **วน `dataList` ทุกแถว** — ต่อแถวสร้าง `pathParams` แล้ววนคอลัมน์:
```js
if (!!col.col_field && col.col_value === null) {
  contentValue = strtr(`{{${col.col_field}}}`, pathParams);        // ผูกตรง
} else {
  if (!!col.col_expressions) {
    const conv = strtr(col.col_expressions, pathParams);            // แทน {{}} ก่อน
    const fn = new Function('row', ...restricted, `return ${conv}`);// sandbox (restricted = blocklist)
    pathParams['{{expressions}}'] = fn.call(sdformModel, item);     // eval → เปิดให้ {{expressions}}
  }
  contentValue = strtr(col.col_value ?? '', pathParams);           // col_value อ้าง {{expressions}} ได้
}
```
- `col_format` → post-format (`num/num1/num2/date/datetime/boolean`)
- header/widths สร้างจากแถวแรก: `widths.push(col.col_width || '*')`, header = `col_label || col_field`; override ได้ด้วย `pdf_tb_header`
- `col_group` → แถวหัวกลุ่มเมื่อค่ากลุ่มเปลี่ยน; `col_sum: totalOnly` → แถวรวม bold ท้ายตาราง
- layout เส้นตาราง = `reportData.pdf_tb_layout`

## 5. Subtable
- config อยู่ใน object `content_value`: `subTableField, widths, header, alignment, column`
- row มาจาก **array ซ้อนใน record**: `dataList[0][content_value.subTableField]`
- วน sub-array → ต่อแถว bind `strtr('{{key}}', pathParams)` (กรอง key ตาม `column` ถ้ามี)

## 6. Sub-report
- bound `contentValue` = **reportId string**
- fetch report นั้น → permission-check → เช็คว่า params ครบ (ไม่ครบ = ข้าม) → `pdfReport(sub, params, true)` (subForm=true ข้าม page setup) → **concat content + images เข้า parent** (inline)

## 7. Page setup → docDefinition (เฉพาะ !subForm)
- `defaultStyle`: font `THSarabun`, size `pdf_fontsize` (default 14)
- `pdf_watermark` → `watermark` (opacity 0.1, 45°, size 75)
- `pdf_orientation` → `pageOrientation`
- `pdf_page_size`: `custom` + `pdf_custom_size.w/h` → `pageSize={width,height}`; ไม่งั้น = ค่า string (เช่น 'A4')
- margin: ครบ 4 (`pdf_ml/mt/mr/mb`) → `pageMargins=[ml,mt,mr,mb]`; ไม่ครบ = 20
- `header` fn: print date ถ้า `pdf_page_date`; `pdf_title` กลางทุกหน้าถ้า `pdf_showheader==='everyPage'`
- `footer` fn: `Page X of Y` ถ้า `pdf_page_num`
- `pdf_bg` → image พื้นหลัง cover
- title: `firstPage` → prepend `pdf_title` เข้า content ครั้งเดียว; `everyPage` → ดัน top margin (+25)

## 8. Output ต่าง path
- **PDF** — client, content model เต็ม → pdfmake
- **Excel** — client, `dataConvert` แปลง row เป็น `{ [col_label]: value }` ต่อ sheet; **เฉพาะ table/subtable/sub_report** (text/image/qr/barcode ถูกข้าม)
- **Word** — server, POST `{reportId, params}` → `/v1/files/create-word`, render จาก template `pdf_temp[0].url` (ในไฟล์มี `createWord` แต่เป็น debug stub ไม่ได้ใช้)
- **LaTeX** — server, POST `/v1/files/create-latex` → คืน PDF blob preview

## barcode/qrcode node (ตัวอย่าง render)
- **qrcode** → pdfmake native `{ qr: value, fit }`
- **barcode** → ไม่มี primitive → gen CODE128 เป็น PNG dataURL (`generateBarcodeDataUrl`, JsBarcode `displayValue:false`) → push `{ image: dataURL, width }`
