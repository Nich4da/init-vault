# LAB Order Request PDF v1 — SQL and Report import

> Cleanup 2026-09-03: superseded LAB SQL/Report exports were moved to macOS Trash.
> Only SQL `09_30_00` and Report `11_55_00` remain import candidates; historical paths below
> are provenance notes, not usable files.

## A4 portrait revision 2026-09-03 11:55 — ใช้ Report ไฟล์เดียว

คำขอรอบนี้เป็น **layout-only** จึงไม่ต้อง import หรือแก้ SQL Factory:

1. Report Factory → Import Report → **Restore Data (Upsert)**
2. import `02-his/report_factory/exports/backup-data_report-factory_2026_09_03_11_55_00.zip`
3. เป้าหมายต้องเป็น Report `6a977ac8422c1ca959829f97`
4. Data Source ต้องยังเป็น SQL เดิม `6a97754d422c1ca959829f96`
5. Hard refresh LAB Worklist แล้วกด PDF เดิม

ผู้ใช้ยืนยันว่ารายงานต้องเป็น A4 portrait ไม่ใช่ landscape จึงตั้ง
`pdf_page_size: A4` + `pdf_orientation: portrait` และปรับสัดส่วนให้พอดีกับพื้นที่เนื้อหา
547 pt: header `22/56/22`, logo `62 × 86 pt`, institute `26/17/17 px`, order 16 px,
barcode `104 × 22 pt`, body 17 px, table 13 และ footer 12. ตารางใช้ความกว้าง
`26 / 104 / * / 120 pt` และยังมีเฉพาะเส้นแนวนอน

Report นี้เก็บเฉพาะการปรับขนาดฟอนต์ ระยะ โลโก้ header barcode ข้อมูลสองคอลัมน์
Diagnosis ตารางแนวนอน และ footer เท่านั้น ไม่เพิ่ม SQL alias และไม่เปลี่ยนการแปลงข้อมูล
ห้ามใช้ SQL package `...11_25_00.zip` สำหรับงาน layout รอบนี้

## Runtime overlap hotfix 2026-09-03 11:40 — เก็บเป็นประวัติ ห้ามใช้

รอบนี้ยังตั้ง orientation เป็น landscape จึงถูกแทนที่ด้วย A4 portrait `11_55_00`
ข้างบน

## Scope-corrected revision 2026-09-03 11:35 — เก็บเป็นประวัติ ห้ามใช้

Report-only รอบแรกที่ยังเกิด logo/LAB-title และ barcode/date overlap ใน runtime ถูกแทนที่ด้วย
`11_40_00` ข้างบน

## Runtime-calibrated revision 2026-09-03 11:30 — เก็บเป็นประวัติ ห้ามใช้

ภาพ runtime 11:09 ถูก normalize เทียบกับ Figma frame `2974:72` ที่ขนาดหน้ากระดาษ
เท่ากัน พบว่า `SdReport.vue` ใช้ THSarabun และเรียก `html-to-pdfmake` ด้วย
`ignoreStyles: ["line-height", "font-family"]`; ค่า CSS เดิมจึงเล็กและระยะไม่ตรง mockup
รอบนี้เคยชดเชยตาม renderer จริงพร้อมแก้ SQL display + Report layout แต่เกินขอบเขต
layout-only จึงถูกแทนที่ด้วย Report-only `11_35_00` ข้างบน:

1. SQL Factory → Import SQL → **Restore Data (Upsert)**
   `02-his/sql-factory/exports/backup-data_sql-factory_2026_09_03_11_25_00.zip`
   เป้าหมาย `6a97754d422c1ca959829f96`
2. Report Factory → Import Report → **Restore Data (Upsert)**
   `02-his/report_factory/exports/backup-data_report-factory_2026_09_03_11_30_00.zip`
   เป้าหมาย `6a977ac8422c1ca959829f97` และ Data Source ต้องยังเป็น SQL ข้างบน
3. Hard refresh LAB Worklist แล้วกด PDF เดิม

สิ่งที่แก้จาก runtime 10:50:

- ขยายชื่อสถาบัน/บรรทัดรองเป็น `44/27/27 px` และเลื่อนกลุ่มกลางลง 28 px
- ขยาย Order info เป็น 24 px; ชดเชย barcode เป็น `144 × 28 pt`, ขยับซ้าย 5 pt
  และซ้อนกลับด้วย margin `-53 pt`
- ขยับ/ขยายโลโก้เป็น `89 × 123.75 pt`; ชื่อหน่วยใช้ 27 px
- patient/specimen ใช้ 24 px, ชดเชยคอลัมน์ runtime เป็น `52/48`, gap ขวา 20 px
  และเลื่อนบล็อกซ้าย 5 pt
- Diagnosis จำกัดอยู่คอลัมน์ซ้ายและตัดบรรทัดเหมือน mockup
- ตารางใช้ font 18, หัวสีขาวแบบ nested row และ `lightHorizontalLines`; footer font 18
  พร้อมเพิ่มระยะบน 18 pt
- SQL เพิ่ม `gender_display`, ทำ AN `0`/`0.0` เป็นค่าว่าง และตัด account/email ในวงเล็บ
  ออกจากชื่อผู้ส่งตรวจ/แพทย์ผู้ส่งตรวจ

ไม่ได้แก้ LAB Worklist, Process, status หรือ Agent callback. Static contract, ZIP integrity,
ID/Data Source inspection และ PDF จำลอง A4 landscape 1 หน้าผ่านแล้ว; runtime หลัง import
ยังเป็น final gate

## Revision 2026-09-03 10:50 — layout เดียวกับ Figma หน้า earn (เก็บเป็นประวัติ)

รอบนี้แก้ **เฉพาะ Report เดิม**; SQL และ LAB workflow ไม่เปลี่ยน:

1. Report Factory → Import Report
2. เลือก **Restore Data (Upsert)** ห้าม Clone
3. import `02-his/report_factory/exports/backup-data_report-factory_2026_09_03_10_50_00.zip`
4. target Report ต้องเป็น `6a977ac8422c1ca959829f97`; Data Source ต้องเป็น SQL
   `6a97754d422c1ca959829f96`
5. Hard refresh หน้า LAB Worklist แล้วกด PDF ใบเดิม

ยึด Figma frame `2974:72` เช่นเดียวกับ X-ray: A4 landscape ขอบ 24 pt, โลโก้ใหม่
`81 × 112.5 pt` เยื้องซ้าย 27 pt, ชื่อสถาบัน `28/18/18 px`, barcode
`154 × 30 pt`, patient/specimen สองคอลัมน์ `51/49`, font 16 และ footer 14
ตาราง LAB ยังคง 4 คอลัมน์ `# / Lab Number / รายการตรวจ / Specimen` ที่ความกว้าง
`33 / 143 / * / 167 pt`; หัวตารางขาวและมีเฉพาะเส้นแนวนอน

custom `pdf_tb_header` เป็นหนึ่งแถวซ้อน `[[cell1, ..., cell4]]` ตาม contract ของ
`SdReport.vue` เพื่อหลีกเลี่ยง Loading stall แบบ flat array. Static contract, ZIP integrity
และ PDF จำลอง A4 landscape 1 หน้าผ่านแล้ว; initCraft runtime หลัง Upsert ยังเป็น final gate

This integration must be imported in three stages because SQL Factory and Report Factory create new IDs independently. Do not hardcode an ID before Clone Data returns it.

## Stage 1 — SQL Factory

Import package:

`02-his/sql-factory/exports/backup-data_sql-factory_2026_09_02_08_00_00.zip`

1. Open **SQL Factory → Import SQL**.
2. Select **Clone Data (Insert new id)**.
3. Select the ZIP above and import it.
4. Open the newly created record named **LAB Order Request PDF v1**.
5. Copy its new 24-character record ID from the URL/record.
6. Stop here and provide that SQL ID before building the Report package.

The SQL package is based on an initCraft-generated backup record. The outer ZIP and inner JSON retain the system backup naming pattern and valid creator/update metadata. Clone Data must replace the template identity with a new SQL record identity.

### Final correction based on the exported `08_28_18` backup

The user-exported working example uses `sql_type: nosql`,
`nosql_type: aggregate`, `sql_select: []`, output names in
`sql_options.variable`, and inputs in `sql_options.param`. The final LAB provider
now follows that exact Factory shape instead of keeping blank Field dropdowns in
SQL mode. Its aggregate pipeline performs the joins and projects all Report fields.

It also sets the SQL provider to `public` for UAT because Report Preview received
403 from `crud/getdata-all` while the provider was private. The Report itself stays
private. Restrict the SQL provider to assigned LAB roles after UAT.

For existing SQL ID `6a97754d422c1ca959829f96`, the latest package is:

`02-his/sql-factory/exports/backup-data_sql-factory_2026_09_02_09_30_00.zip`

1. Open **SQL Factory → Import SQL**.
2. Select **Restore Data (Upsert)** — do not select Clone Data.
3. Import the ZIP above. It targets the existing SQL ID and must not create another SQL record.
4. Open **LAB Order Request PDF v1**. It must show **NoSQL / Aggregate**; SQL Select is intentionally empty.
5. Confirm Variables contains the projected names and Parameters contains
   `order_id`, `visit_id`, `section_code`, `printed_by`, `printed_at`.
6. Run SQL Test with the same five parameters. `visit_id` is the Visit record ID
   (`order.xparentx`) used by the EMR deep link, not the displayed VN text.

Expected Variables:
`row_no`, `order_id`, `order_number`, `order_date`, `order_time`,
`patient_name`, `hn`, `age_display`, `an`, `ward_clinic`,
`insurance_display`, `prior_medication_display`, `diagnosis_display`,
`source_specimen`, `collected_at`, `collected_by`, `storage_display`,
`requester_name`, `submitter_name`, `lab_no`, `item_code`, `item_name`,
`test_display`, `specimen_name`, `section_code`, `section_name`,
`section_unit`, `printed_by`, `printed_at`.

Use a real timestamp for `printed_at` during UAT. A free-text value is not the
reported query failure, but the real report should receive its print timestamp.

## Stage 2 — restore the existing Report Factory layout (historical; superseded by 10:50)

The Report already exists as ID `6a977ac8422c1ca959829f97`. To correct its
layout without creating a duplicate, import:

`02-his/report_factory/exports/backup-data_report-factory_2026_09_02_09_30_00.zip`

1. Open **Report Factory → Import Report**.
2. Select **Restore Data (Upsert)** — do not select Clone Data.
3. Import the ZIP above. It targets the existing Report ID and keeps Data Source
   bound to SQL ID `6a97754d422c1ca959829f96`.
4. Open **LAB Order Request v1** and run Report Preview with the five parameters
   that already passed SQL Test.

This layout revision keeps the SQL provider and NoSQL pipeline unchanged. It
uses the hospital logo at `250 × 63`, removes the duplicated hospital/report title
under the logo, and leaves only two header columns: Section at left and Order No./
date/time at right. Because initCraft renders HTML text visibly smaller than table
text at the same numeric setting, all non-table information blocks use HTML/widget
font size `14` so their rendered size matches the item text at table size `11`.
Patient and specimen data are balanced into the same `52/48` two-column rhythm;
the compact right-aligned Order barcode and safe A4 margins remain unchanged.

### Initial Clone package (historical / only when no Report exists)

The Report package has already been generated against SQL ID
`6a97754d422c1ca959829f96`:

`02-his/report_factory/exports/backup-data_report-factory_2026_09_02_08_20_00.zip`

Import it from **Report Factory → Import Report → Clone Data (Insert new id)**
only in an environment where this Report does not exist.
Open **LAB Order Request v1**, verify that Data Source points to
**LAB Order Request PDF v1**, and copy the new Report ID.

The Report record can be created before SQL Test passes, but Report Test/Preview
will continue to fail until its SQL provider runs successfully. Do not bind the
Report ID to the Worklist yet.

To regenerate the Report backup later:

```bash
node Form-Builder/API/report_factory/builders/build_lab_order_request_report.js --sql-id=6a97754d422c1ca959829f96
```

To regenerate the current Restore package for the existing Report:

```bash
node Form-Builder/API/report_factory/builders/build_lab_order_request_report.js \
  --sql-id=6a97754d422c1ca959829f96 \
  --restore-report-id=6a977ac8422c1ca959829f97 \
  '--restore-report-created-at=2026-09-02 08:24:24' \
  '--restore-report-updated-at=2026-09-02 09:30:00'
```

Then package the generated JSON using the Report Factory backup naming pattern:

```bash
zip -j 02-his/report_factory/exports/backup-data_report-factory_2026_09_02_08_20_00.zip \
  Form-Builder/SDForm/report_factory/exports/backup-data-module_report-Earn_admin-2026_09_02_08_20_00.json
```

Do not import a Report package generated with a placeholder or an earlier SQL ID.

## Stage 3 — replace the LAB Worklist with the connected version

The Worklist generator now defaults to the verified Report ID
`6a977ac8422c1ca959829f97`. Regenerate it with:

```bash
node Form-Builder/seed/tests-tools/scripts/update_lab_cpoe_worklist_ui.js
```

Then import/replace the existing Worklist with:

`Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json`

Do not create a duplicate Worklist Form. The active-row PDF now supplies the exact
row's `order_id`, the same `visit_id` used by EMR, `section_code`, `printed_by` and
`printed_at`. If Order ID, Visit ID or Section is missing, the PDF button is disabled
instead of opening an unscoped report. Cancelled/rejected rows still show only
`ตรวจใหม่` and do not expose PDF/EMR.

## SQL and Report UAT

Use one non-production CPOE LAB Order and its visible LAB Section code. Supply:

- `order_id`: cloned SQL receives the CPOE Order `_id`
- `visit_id`: Visit record `_id` from `emr_context.visit_id` / `visit.visit_id`
- `section_code`: LAB Section code shown by that Worklist row
- `printed_by`: tester display name
- `printed_at`: current test date/time

Verify:

- SQL returns one row per active LAB Item for only that Order, Visit and Section.
- `Order No.` comes from CPOE.
- `Lab Number` is blank before specimen receipt and equals LAB Work Item after receipt.
- Report Test renders A4 landscape without missing bindings or clipped Thai text.
- Waiting/received/result rows open the Report directly without a parameter dialog.
- Cancelled/rejected rows have no PDF or EMR and show notification-only `ตรวจใหม่`.

The SQL provider is temporarily public to unblock Report Preview; the Report remains private. After SQL Test, Report Test, Builder/Preview and deployed runtime pass, change SQL/Report sharing to assigned LAB roles only.
