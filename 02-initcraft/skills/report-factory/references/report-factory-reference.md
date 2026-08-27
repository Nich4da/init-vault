# initCraft Report Factory Reference

## Sources

Observed from the initCraft v1.6.0 SPA loaded by:

- `https://softmax-one.com/module/report-factory`
- `https://softmax-one.com/assets/sd-core-BhXK5y5w.js`
- `https://softmax-one.com/assets/sd-builder-Rj8FEiq0.js`

The page HTML is only a Vite shell; report behavior lives in the bundled JS assets.

## Providers and Module

Report Factory screen:

```js
{
  formId: "68a19d8faa24c49e95375c8c",
  originFormId: window.APP_CONFIG.FORM_REPORT,
  dataProvider: {
    providerId: "getreport-factory-all",
    providerType: "SYS",
    params: { license: connectInfo.register_id }
  }
}
```

Report lookup and selection:

```text
getreport-one
report-list
```

The builder's `report-editor` selects from `report-list` with:

```text
value-field: _id
label-field: pdf_name
search-field: pdf_name
```

## Important Report Fields

```text
pdf_name          Report name / output file name
pdf_type          Report type; temp reports enable Word test button
pdf_sql           SQL provider used to query data
pdf_form_id       Form schema used for value mapping
pdf_content       Ordered report sections
pdf_column        Table/export columns
pdf_tb_header     Additional table header rows
pdf_tb_layout     pdfmake table layout
pdf_fontsize      Default report font size
pdf_params        Parameter definitions
pdf_temp          Word template attachment
pdf_page_size     Page size such as A4 or custom
pdf_orientation   Page orientation
pdf_custom_size   Custom page width/height
pdf_ml            Left margin
pdf_mt            Top margin
pdf_mr            Right margin
pdf_mb            Bottom margin
pdf_title         Report title
pdf_showheader    firstPage or everyPage behavior
pdf_page_num      Show footer page number
pdf_page_date     Show print date in header
pdf_watermark     Watermark text
pdf_bg            Background image
pdf_share         private / assign / public-like
pdf_assign_roles  Roles allowed when pdf_share is assign
```

## Content Widgets

`pdf_content` is processed in order. Supported `content_widget` values:

```text
text       Pushes a pdfmake text node.
html       Converts HTML to pdfmake content.
image      Adds an image with cover width/height.
qrcode     Adds a QR code.
table      Builds a table from the SQL result.
subtable   Builds a table from an array field in a row.
sub_report Loads another report with getreport-one and appends it.
```

Common content styling fields:

```text
content_value
content_align
content_ml
content_mr
content_mt
content_mb
content_fontsize
content_bold
content_italics
content_color
content_bgcolor
content_decoration
content_linestyle
content_width
content_height
```

### Report Content vs Table Column Setting

`Report Content (Render)` is the report body builder. It decides what appears in the PDF and in what order. Use it to place title text, document metadata, HTML layout blocks, images, QR codes, the main table, subtables, and sub reports.

`Table (Column Setting) - JSVar {{expressions}}` is the table/export column builder. It only matters when the report body contains a `table` widget or when Excel export needs shaped columns. It decides which SQL result fields become columns, how headers are labeled, how values are formatted, whether values are summed/grouped, and whether a calculated `{{expressions}}` value is used.

Decision rules:

```text
Fixed certificate / memo / form-like PDF:
  Use Report Content only unless a table is needed.

PDF with one or more data tables:
  Use Report Content to place a table widget.
  Use Table Column Setting to define the table columns.

Excel export:
  Use Table Column Setting when the raw SQL fields need labels, order, formats, or calculated values.

Route or status display that combines fields:
  Use Table Column Setting Custom Value or Expressions(JS).
```

Example report body:

```text
text  -> "รายงานการจองรถ"
text  -> "วันที่พิมพ์: {{doc_date}}"
table -> main SQL result table
```

Example table columns:

```text
Field           Label
doc_no          เลขที่
doc_date        วันที่
vehicle_type    ประเภทรถ
origin          ต้นทาง
destination     ปลายทาง
booking_status  สถานะ
```

Example custom value to combine fields:

```text
Field: destination
Label: เส้นทาง
Custom Value: {{origin}} -> {{destination}}
```

Example expression:

```js
row.booking_status === "draft" ? "บันทึกร่าง" : row.booking_status
```

Then set `Custom Value` to:

```text
{{expressions}}
```

## Variable Substitution

Use double braces:

```text
{{field_name}}
{{doc_no}}
{{destination}}
```

The renderer builds substitutions from SQL result rows and the selected form schema. If a value does not render, first verify the SQL result field name.

## Parameters

Supported param field names:

```text
param_var       Variable name inserted into SQL params
param_label     Label shown in the dialog
param_required  Element Plus required flag
param_type      text | number | boolean | datetime | date | form
param_default   Default value; "date()" becomes current datetime
param_sform     Form selector for form params
param_svalue    Value field for form params
param_slabel    Label/search field for form params
```

Date formats used by the UI:

```text
datetime value-format: YYYY-MM-DD HH:mm:ss
date value-format:     YYYY-MM-DD
```

## Table and Export Columns

`pdf_column` controls both PDF tables and Excel export when present.

Common column fields observed in renderer:

```text
col_field
col_label
col_value
col_expressions
col_format
col_group
col_sum
col_fillcolor
col_alignment
```

Formats:

```text
num       integer-style number
num1      1 decimal
num2      2 decimals
date      DD/MM/YYYY
datetime  DD/MM/YYYY HH:mm
boolean   True / False
```

Column expressions run as JavaScript with `row` available. Keep expressions simple and avoid unsafe side effects.

## Page Rendering

PDF generation uses pdfmake. Report Factory sets:

```js
defaultStyle = { font: "THSarabun", fontSize: pdf_fontsize || 14 }
```

Title behavior:

- `pdf_showheader === "firstPage"` prepends title to content.
- `pdf_showheader === "everyPage"` renders title in the header function.

Margins:

- If all `pdf_ml`, `pdf_mt`, `pdf_mr`, and `pdf_mb` are set, use those.
- Otherwise default to `20`.
- When a title is present and not first-page-only, top margin may be increased.

## Report Items Example

Use in a component/page builder property named `Report Items`:

```js
[
  { reportId: "REPORT_ID", label: "Preview", type: "pdf" },
  { reportId: "REPORT_ID", label: "Download", type: "excel" }
]
```

For temp reports, Report Factory's test action uses:

```js
[
  { reportId: row._id, label: "Preview", type: "pdf" },
  { reportId: row._id, label: "Download", type: "excel" },
  { reportId: row._id, label: "Doc", type: "word" }
]
```

## Step-by-step Creation Workflow

Use this workflow when explaining how to create a Report Factory report from scratch.

1. Prepare the SQL provider first.
   - The SQL result must include every field used later in `{{field_name}}`, `pdf_column`, and expressions.
   - If the report is opened from a selected list/grid row, add a SQL parameter such as `_id`, `dataid`, or another stable row key and make its name match `pdf_params[].param_var`.

2. Create a new Report Factory record at `/module/report-factory`.
   - Set `pdf_name` to the report/output name.
   - Set `pdf_sql` to the SQL provider.
   - Set `pdf_form_id` when field display mapping should follow an SDForm schema.
   - Set page options such as `pdf_page_size`, `pdf_orientation`, `pdf_fontsize`, and margins.
   - Set `pdf_share` / `pdf_assign_roles` based on who may run the report.

3. Configure `pdf_params` only when the SQL needs runtime input.
   - Use `param_var` as the exact SQL parameter name.
   - Use `param_type` from `text`, `number`, `boolean`, `datetime`, `date`, or `form`.
   - Use `param_default: "date()"` only when current date/time is appropriate.
   - For `form` params, also configure `param_sform`, `param_svalue`, and `param_slabel`.

4. Configure `pdf_content` as the report body.
   - Use `text` for headings and fixed labels.
   - Use `html` for form-like one-page documents such as booking forms, approval forms, receipts, or certificates.
   - Use `table` when showing SQL result rows.
   - Use `subtable` when a selected SQL row contains an array that needs its own table.
   - Use `sub_report` only when another report should be appended.

5. Configure `pdf_column` when a table or Excel export needs shaped columns.
   - Use `col_field` for the SQL field.
   - Use `col_label` for the visible/export label.
   - Use `col_format` for common date/number/boolean formats.
   - Use `col_expressions` with `row` for simple derived values, then set the displayed/custom value to `{{expressions}}` where the editor expects it.

6. Test from Report Factory.
   - Use the row action `Report Test`.
   - Test PDF first.
   - Test Excel if `pdf_column` is used for export.
   - Test Word only when `pdf_temp[0].url` exists.

7. Attach the report to a form/page.
   - In Form Builder, use the `Report Items` / `report-editor` property on `report-ui`, `list-ui`, `datagrid-*`, `record-ui`, or another supported component.
   - Use `type: "pdf"` for preview, `type: "excel"` for `.xlsx`, and `type: "word"` only with a Word template.

### Vehicle Booking Report Example

For a vehicle booking document/report:

```text
Data source: SQL provider over zdata_vms_car_bookin or the form's provider-backed data.
Common row key: _id or dataid.
Common fields: doc_no, doc_date, purpose, origin, destination, vehicle_type_req, booking_status, file_upload_car.
```

Single-record PDF:

```text
pdf_content:
  text -> "ใบจองรถ"
  html -> use {{doc_no}}, {{doc_date}}, {{purpose}}, {{origin}}, {{destination}}, {{booking_status}}
```

List/Excel report:

```text
pdf_content:
  text -> report title
  table -> main SQL result table

pdf_column:
  doc_no, doc_date, purpose, origin, destination, vehicle_type_req, booking_status
```

When the report is launched from `list-ui.reportList`, the report item shape is:

```js
[
  { reportId: "REPORT_ID", label: "ดูเอกสาร", type: "pdf" }
]
```

## Debug Checklist

1. Does `report-list` show the report by `pdf_name`?
2. Does `getreport-one` return the report by `_id`?
3. Does the current user pass `pdf_share` permission?
4. Are required `pdf_params` supplied or shown in the parameter popup?
5. Does `pdf_sql.value` point to a valid SQL provider?
6. Do SQL param names match `param_var` exactly?
7. Does the SQL result include the fields used in `{{field}}`, `pdf_column`, and expressions?
8. For Word, does `pdf_temp[0].url` exist?
9. For subtable, does `content_value.subTableField` exist and contain an array?
10. For Thai PDF font issues, inspect pdfmake font settings rather than CSS.
