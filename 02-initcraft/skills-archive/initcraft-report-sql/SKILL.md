regest it!---
name: initcraft-report-sql
description: Build, review, and debug initCraft SQL Factory providers that feed Report Factory PDF/HTML reports. Use for SQL Factory type sql/NoQL SELECTs, joins, parameters, aliases, nested objects and sub-form arrays, missing-value fallbacks, Report Factory {{field}} binding, HTML report layout, bullets or numbered lists, and HIS reports using zdata_person, zdata_visit, or insurance fields.
---

# initCraft Report + SQL

Build the provider and report as one pipeline:

```text
form collections -> SQL Factory SELECT -> result aliases -> Report Factory {{aliases}}
```

Never design the report before confirming the provider result shape.

## Workflow

1. Identify the report, SQL provider, base collection, joins, parameters, and output type.
2. Inspect the current SQL Factory export or `module_sql` record before changing it.
3. Verify field names from `sdform_manage.form_db.schema`, exported form JSON, or read-only collection schema. Do not infer paths from UI labels.
4. Keep `sql_type: sql` when the provider already uses SELECT syntax. MongoDB storage does not require changing it to `nosql`.
5. Give every report value a stable alias.
6. Make optional aliases exist by using `IFNULL(..., '-')` or `CASE ... ELSE '-' END`.
7. Test SQL first; confirm keys, types, arrays, newlines, and fallbacks.
8. Bind the exact aliases with `{{alias}}`.
9. Preview complete, null-field, empty-array, and multi-item records.

## Choose the Correct Source

- Use person/master data for current demographics and per-person configuration.
- Use visit data for values selected or frozen for a visit.
- Use history data only when a dated record is required.
- Limit one-to-many history joins with an ordered subquery plus `FIRST`; otherwise one report can duplicate.
- Do not join lookup masters merely to print a stored Select By Form label; selected objects usually contain `value` and `label`.

### Verified HIS insurance fields

```text
zdata_person
├─ inscl_main_code.value / label        registered main right
├─ inscl_sub_code.value / label         registered sub-right
├─ inscl_hos_main.value / label         primary entitlement hospital
├─ inscl_hos_sub.value / label          secondary entitlement hospital
└─ inscl_hos[]                          per-person hospital-right sub-form
   ├─ inscl_item_main.value / label     patient type / hospital right
   └─ inscl_item_sub.value / label      treatment type
```

In `person_form.json`, `inscl_hos` is the array container. Display `inscl_item_main.label`; do not display the container or confuse it with `inscl_hos_main`.

`zdata_visit` also stores an `inscl_hos` array. Treat it as a visit snapshot only when the workflow confirms rights are copied/selected at visit creation.

Observed patient links:

```text
zdata_visit.xparentx = zdata_person._id
zdata_visit.pid.value = zdata_person._id
```

`zdata_person_insurance` is dated insurance history with `pid.value`, `xparentx`, `inscl_date`, `inscl_status`, `inscl_token`, main/sub rights, entitlement hospitals, and `inscl_hos[]`. A patient can have multiple records. For historical fallback, choose the latest valid record on or before the visit date. Do not assume status-code meanings without verifying their option mapping.

Recommended precedence:

```text
Current registration report:
  person.inscl_hos -> person main/sub fallback

Visit or historical billing report:
  visit.inscl_hos -> dated person_insurance fallback -> person main/sub informational fallback
```

Do not silently map registered-right codes to hospital-right codes; their catalogs overlap but are not identical.

## SQL Factory Rules

- Preserve field case and quote nested paths with backticks.
- Fully qualify fields when joins exist:

```sql
`zdata_person`.`inscl_main_code.label`
```

- Alias every custom expression/function.
- Use `CONCAT`, not `+`, for strings.
- Use `JOIN(array, delimiter)` for multiline label strings.
- Use `SIZE_OF_ARRAY(IFNULL(array, PARSE_JSON('[]')))` for optional arrays.
- Use `ARRAY_ELEM_AT(array, zero_based_index)` only for fixed-position output.
- Keep `ELSE ''` for optional continuation fragments; use `ELSE '-'` for the entire missing value.
- Avoid HTML tags inside SQL expressions. Plain strings are more reliable.

### Object label with fallback

```sql
IFNULL(`zdata_person`.`inscl_main_code.label`, '-') AS `insurance_name`
```

```sql
IFNULL(`zdata_person`.`inscl_sub_code.label`, '-') AS `insurance_sub_name`
```

If SQL projects a missing nested path directly, MongoDB may omit the alias. Report Factory then prints `{{alias}}` literally. `IFNULL` ensures the key exists.

### CASE mapping

```sql
CASE
  WHEN `zdata_visit`.`visit_type` = '1' THEN 'ตรวจสุขภาพ'
  WHEN `zdata_visit`.`visit_type` = '2' THEN 'ตรวจตามนัด'
  WHEN `zdata_visit`.`visit_type` = '3' THEN 'รับส่งต่อ'
  WHEN `zdata_visit`.`visit_type` = '4' THEN 'ตรวจรักษาโรค'
  WHEN `zdata_visit`.`visit_type` = '5' THEN 'อื่นๆ'
  ELSE '-'
END AS `visit_type_text`
```

### Multiline hospital-right list

```sql
CASE
  WHEN SIZE_OF_ARRAY(
    IFNULL(`zdata_person`.`inscl_hos`, PARSE_JSON('[]'))
  ) > 0
  THEN CONCAT(
    '• ',
    JOIN(`zdata_person`.`inscl_hos.inscl_item_main.label`, '\n• ')
  )
  ELSE '-'
END AS `insurance_display`
```

### Nested array for subtable

```sql
(
  SELECT
    `inscl_item_main.value` AS `right_code`,
    `inscl_item_main.label` AS `right_label`,
    `inscl_item_sub.value` AS `treatment_code`,
    `inscl_item_sub.label` AS `treatment_label`
  FROM `zdata_person.inscl_hos`
) AS `insurance_items`
```

### Fixed numbered list

NoQL does not provide a convenient unbounded array-map with an index in this workflow. Use table/subtable for unbounded numbering. For a known maximum, use `ARRAY_ELEM_AT`:

```sql
CASE
  WHEN SIZE_OF_ARRAY(IFNULL(`rights`, PARSE_JSON('[]'))) > 0
  THEN CONCAT(
    '1. ', IFNULL(ARRAY_ELEM_AT(`rights.label`, 0), '-'),
    CASE
      WHEN SIZE_OF_ARRAY(`rights`) > 1
      THEN CONCAT('\n2. ', IFNULL(ARRAY_ELEM_AT(`rights.label`, 1), '-'))
      ELSE ''
    END
  )
  ELSE '-'
END AS `numbered_rights`
```

Use `ELSE ''` for absent items 2+, or an unwanted numbered dash will appear.

### Person-visit join and report parameter

```sql
FROM `zdata_person`
INNER JOIN `zdata_visit|unwind`
  ON `zdata_person`.`_id` = `zdata_visit`.`xparentx`
WHERE `zdata_visit`.`_id` = CONVERT(:xparentx, 'objectId')
  AND `zdata_visit`.`xrstatx` NOT IN (0, 3)
  AND `zdata_person`.`xrstatx` NOT IN (0, 3)
```

The SQL Factory UI may represent this as table `zdata_visit` with hint `UNWIND`.

## Report Factory Rules

- `{{field}}` binds the SQL alias, not the form field name or `content_var`.
- Text, HTML, image, QR, barcode, and sub-report widgets use the first SQL row.
- A table widget iterates all SQL rows.
- A `subtable` iterates an array nested in the first row.
- Excel skips ordinary text/HTML/image/QR/barcode widgets; use table, subtable, or sub-report for exportable data.
- Use `white-space:pre-line` for SQL strings containing `\n`.
- Fix missing placeholders in SQL, not HTML.

### Stable report block

```html
<table style="width:100%; border-collapse:collapse; border:none; border-top:1px solid #000; font-size:22px; font-weight:bold;">
  <tbody>
    <tr><td style="border:none; padding-top:5px; padding-bottom:1px;">ขอรับบริการ : <span style="font-weight:normal;">{{visit_type_text}}</span></td></tr>
    <tr><td style="border:none; padding:1px 0;">วันที่ขอรับบริการ : <span style="font-weight:normal;">{{visit_date}}</span></td></tr>
    <tr><td style="border:none; padding:1px 0;">หน่วยงาน : <span style="font-weight:normal;">{{visit_clinic_text}}</span></td></tr>
    <tr><td style="border:none; padding:1px 0;">สิทธิ์หลัก : <span style="font-weight:normal;">{{insurance_name}}</span></td></tr>
    <tr><td style="border:none; padding:1px 0;">สิทธิ์ย่อย : <span style="font-weight:normal;">{{insurance_sub_name}}</span></td></tr>
    <tr>
      <td style="border:none; padding:1px 0; vertical-align:top; line-height:1.2;">
        <span style="font-weight:bold;">สิทธิ์ในโรงพยาบาล :</span><br>
        <span style="font-weight:normal; white-space:pre-line; line-height:1.2;">{{insurance_display}}</span>
      </td>
    </tr>
  </tbody>
</table>
```

### HTML renderer limitations

The PDF HTML converter may ignore CSS and HTML table widths, equalize columns, add spacing around `div`/`ol`/`ul`, ignore flex/inline-block hanging indents, collapse whitespace, and wrap long list items without a true hanging indent.

Do not repeatedly tune unsupported CSS. Prefer:

- one-column structures;
- explicit `<br>` plus newline text;
- plain SQL strings;
- native Report Factory table/subtable widgets.

## Debugging

`Data not found` can mean:

- WHERE parameter mismatch or invalid ObjectId conversion;
- INNER JOIN removed the base record;
- custom expression parse/runtime failure;
- `SIZE_OF_ARRAY` received null/non-array;
- embedded HTML confused SQL parsing.

Reduce the provider to identifiers and restore one expression at a time. Inspect saved `sql_options.select` and `sql_options.variable` to confirm the builder persisted the expression and alias.

## Validation Checklist

- SQL preview returns a record for the report parameter.
- Every `{{alias}}` is present even when optional.
- Alias spelling matches exactly.
- No duplicate SELECT rows or aliases exist.
- Joins do not multiply the report unexpectedly.
- Empty values show `-`, not `null`, `[object Object]`, or `{{alias}}`.
- Arrays render all intended elements in stored order.
- PDF preview honors newlines.
- Historical reports do not pull newer master/history values accidentally.
