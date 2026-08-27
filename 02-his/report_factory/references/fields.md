# Report Factory — Field Reference

โครงสร้าง record ของรายงาน (seed = `sdform/report-model.json`). ฟอร์มมี header (identity) + แท็บ `tab_pdf` 3 pane: **Builder** / **Parameters** / **Setting**. แท็บ `tab_pdf` ซ่อนจนกว่า `pdf_sql` มีค่า.

## A. Identity (header)
| field | widget | label | default | หมายเหตุ |
|---|---|---|---|---|
| `pdf_name` | text-input | Report Name | null | required, maxLength 255 |
| `pdf_category` | group-list-input | Category | null | group จาก formId `68bfea85c2a677c3ca405312` |
| `pdf_sql` | select-data-input | SQL | null | **required**, `listId: sql-list`, `valueObjectId: true`. data source. onChange → เติม `pdf_from`/`pdf_form_id`, สร้างปุ่ม `btn_var`, โชว์แท็บ |
| `pdf_desc` | text-input | Descriptions | null | |
| `pdf_tags` | tags-input | Packages Tags | null | multiple |
| `pdf_type` | radio-input | Type | `report` | report / latex / temp — toggle field group |

## B. Builder tab (`tab1`)
| field | widget | label | หมายเหตุ |
|---|---|---|---|
| `btn_var` | button-ui | Buttons | ไม่ใช่ data field — ปุ่ม copy `{{vname}}` ลง clipboard |
| `pdf_temp` | file-upload-input | Doc Template | .doc/.docx (สำหรับ type=temp/word) |
| `pdf_title` | text-input | Title | หัวรายงาน |
| `pdf_latex` | code-input | LaTeX Code | เฉพาะ type=latex |
| `pdf_content` | sub-form | Report Content | รายการ content item (§D) |
| `pdf_column` | sub-form | Column | คอลัมน์ตาราง (§E) |
| `pdf_tb_layout` | select-input | Table Layout | `noBorders` / `headerLineOnly` / `lightHorizontalLines` |
| `pdf_tb_header` | json-input | Custom Header | Array — หัวตาราง custom (rowSpan/colSpan/fillColor) |

## C. Setting tab (`tab_pane_80801`)
| field | widget | label | default | option/หมายเหตุ |
|---|---|---|---|---|
| `pdf_share` | radio-input | Report Sharing | `public` | private / public / assign (→ โชว์ `pdf_assign_roles`) |
| `pdf_assign_roles` | select-data-input | Roles | null | multiple, `listId: roles-list` |
| `pdf_orientation` | select-input | Orientation | `portrait` | portrait / landscape |
| `pdf_page_size` | select-input | Page Size | `A4` | A0–A10, LETTER, LEGAL, FOLIO, EXECUTIVE, TABLOID, custom (→ โชว์ `pdf_custom_size`) |
| `pdf_custom_size` | object-group | Custom Size | — | number `width` + `height` (pt) |
| `pdf_ml/mt/mr/mb` | number-input | Margin L/T/R/B | 20 | ขอบกระดาษ |
| `pdf_fontsize` | number-input | Font Size | 14 | base font |
| `pdf_showheader` | select-input | Show Header | `firstPage` | firstPage / everyPage |
| `pdf_page_date` | switch-input | Show Print Date | true | footer |
| `pdf_page_num` | switch-input | Show Page Number | true | footer `Page X of Y` |
| `pdf_watermark` | text-input | Watermark | null | opacity 0.1, 45° |
| `pdf_bg` | picture-upload-input | Background | — | jpg/png ภาพพื้นหลัง |
| `pdf_note` | html-input | Note | null | mini HTML |
| `pdf_from` | text-input | Table | null | **hidden** auto จาก `pdf_sql` (`sql_from`) |
| `pdf_form_id` | text-input | FormId | null | **hidden** auto จาก `pdf_sql` (`sql_form_id.value`) — ใช้แปลงค่า field เป็น display value |

## D. Content item (`pdf_content` — sub-form, ลากสลับได้)
1 row = 1 block:
| field | widget | default | หมายเหตุ |
|---|---|---|---|
| `content_widget` | select-input | `text` | text / html / table / subtable / image / qrcode / barcode / sub_report |
| `content_var` | text-input | null | design-time label เท่านั้น (ไม่ใช้ runtime); auto = `widget_<rowId>` |
| `content_align` | select-input | `left` | left/center/right |
| `content_decoration` | select-input | `""` | underline/lineThrough/overline |
| `content_linestyle` | select-input | `dotted` | dotted/solid/dashed/double/wavy |
| `content_bold` | switch-input | false | |
| `content_italics` | switch-input | false | |
| `content_color` | color-input | null | font |
| `content_bgcolor` | color-input | null | พื้นหลัง |
| `content_fontsize` | number-input | null | |
| `content_ml/mt/mr/mb` | number-input | null | margin |
| `content_width` | number-input | null | image/qrcode/barcode เท่านั้น |
| `content_height` | number-input | null | image/qrcode/barcode เท่านั้น |
| `content_value` | dynamic-input | `""` | payload — editor morph ตาม widget |

**content_widget.onChange (editor morph):**
- text → `content_value.inputType = textarea-editor`
- html → `html-mini-editor`
- subtable → `json-editor` + seed `{ subTableField:'', column:[], widths:[], alignment:[], header:[] }`
- table → `content_value` **ซ่อน** (data มาจาก `pdf_column`)
- image/qrcode/barcode/sub_report → `text-editor`; image/qrcode/barcode โชว์ width+height

## E. Table column (`pdf_column` — sub-form) — ใช้กับ widget `table`
| field | widget | default | หมายเหตุ |
|---|---|---|---|
| `col_field` | select-path-input | null | เลือก variable จาก `pdf_sql` (`sql_options.variable`, valueProp `vname`) — ผูกค่าคอลัมน์ |
| `col_label` | text-input | null | หัวคอลัมน์ |
| `col_alignment` | select-input | `left` | |
| `col_width` | number-input | null | ว่าง = auto (`*`) |
| `col_format` | select-input | `""` | date/datetime/boolean/num/num1/num2 |
| `col_sum` | select-input | `""` | totalOnly = รวมยอดท้ายตาราง |
| `col_group` | switch-input | false | group-by คอลัมน์นี้ |
| `col_html` | switch-input | false | render cell เป็น HTML |
| `col_value` | text-input | null | ค่า custom (template `{{...}}` + `{{expressions}}`) |
| `col_expressions` | text-input | null | JS expression ต่อ cell (sandbox) → เรียกผ่าน `{{expressions}}` |
| `col_fillcolor` | color-input | null | สีพื้น cell |

## F. Parameters (`pdf_params` — sub-form, แท็บ Parameters)
1 row = 1 runtime param:
| field | widget | default | หมายเหตุ |
|---|---|---|---|
| `param_var` | text-input | null | ชื่อตัวแปร (validation variableFull) |
| `param_label` | text-input | null | label ใน dialog |
| `param_default` | text-input | null | `date()` = วันนี้ |
| `param_required` | switch-input | false | |
| `param_type` | select-input | `text` | text/number/date/datetime/boolean/form (form → โชว์ `param_sform/param_svalue/param_slabel`) |
| `param_sform` | select-data-input | null | `listId: sdform-db-list` |
| `param_svalue` | select-path-input | null | source `param_sform` path `form_db.schema`, valueProp `fieldName` |
| `param_slabel` | select-path-input | null | multiple, labelCustom `[ {{fieldName}} ] {{label}}` |

## Subtable content_value (JSON)
เมื่อ `content_widget = subtable`, `content_value` เป็น object:
```json
{ "subTableField": "items", "column": ["name","qty"], "header": ["ชื่อ","จำนวน"], "widths": ["*",60], "alignment": ["left","right"] }
```
- `subTableField` = ชื่อ field array ซ้อนใน record (เช่น `record.items[]`)
- `column` = key ที่จะเอา (ว่าง = ทุก key), `header/widths/alignment` = ต่อคอลัมน์
