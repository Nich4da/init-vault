---
type: synthesis
title: Report — ใบฎีกาจ่ายยา (medication dispense voucher)
created: 2026-07-17
updated: 2026-07-19
tags: [initcraft, report-factory, his, report, wip]
sources: ["[[report-factory]]", "[[report-factory-skill]]", "[[his-system-flow]]"]
---

# Report — ใบฎีกาจ่ายยา (medication dispense voucher)

A [[report-factory|Report Factory]] PDF being built for the [[his|HIS]] (สถาบันสุขภาพเด็กฯ)
— a pharmacy stock **dispense/requisition voucher**. Built 2026-07-17. **Status: layout done,
data not yet wired** — every `{{placeholder}}` and column `Field` below is a *temporary name*
pending the SQL step.

## Layout (3 Report Content sections, top → bottom)
```
1) html   → หัวกระดาษ (title + ข้อมูลเบิก)
2) table  → ตารางรายการยา   (columns in Table Column Setting)
3) html   → ท้ายกระดาษ (ลงชื่อ)
```
Page: A4 portrait. Table Layout = `Table` (full grid). Watch overflow → see [[report-factory]].

## 1) Header — `html` widget
Title centered bold; a 3-column table (`colgroup` 40/20/40, middle = spacer to push the right
block right) with `border:none` cells. Placeholders:

| ช่อง | placeholder |
|---|---|
| หมายเลข | `{{doc_no}}` |
| ไปยัง | `{{send_to}}` |
| วันที่เบิก | `{{req_date}}` |
| วันที่จ่าย | `{{pay_date}}` |
| ฎีกาของคลัง | `{{stock_dika_no}}` |

Row layout: right column starts one row higher (empty left cell in row 1) →
`วันที่เบิก` · `หมายเลข|วันที่จ่าย` · `ไปยัง|ฎีกาของคลัง`.

## 2) Item table — Table Column Setting (7 columns)
| `Label` (set now) | `Field` (wire later) | Align | Format | Width |
|---|---|---|---|---|
| รายการยา | `item_name` | Left | — | `*` |
| ขนาดบรรจุ | `pack_size` | Center | — | 55 |
| shelf | `shelf` | Center | — | 40 |
| จำนวนเบิก | `qty_request` | Right | num | 50 |
| จำนวนจ่าย | `qty_issue` | Right | num | 50 |
| วันหมดอายุ | `exp_date` | Center | date | 65 |
| มูลค่าทุน | `cost_value` | Right | num2 (`Sum`) | 65 |

`รายการยา` = `Width *` prevents page overflow; `มูลค่าทุน` `Sum` = total row.

## 3) Footer — `html` widget (signature block)
Same 3-column table style. Left = ผู้เบิก / `{{requester_name}}` (centered block);
right = `ผู้จัดยา {{dispenser_name}}` · `ผู้ตรวจสอบ {{checker_name}}` · `ผู้รับยา {{receiver_name}}`.

## How the binding works (confirmed — [[report-factory-skill]])
- Every `{{placeholder}}` above (and each column `Field`/`col_field`) is filled by **`strtr()`**
  from the SQL row: `{{col}}` → the value of the SQL column named `col`. Header/footer html use
  **row[0] only**; the item `table` iterates all rows. So the names below just need to match the
  **real SQL column names** once `pdf_sql` is wired.
- Friendly labels here map to real fields: table `Label`→`col_label`, `Field`→`col_field`,
  `Width`→`col_width`, `Sum`→`col_sum: totalOnly`.

## ⚠ Open — the SQL wiring (next step)
- The report's `pdf_form_id` was mistakenly pointed at the **PERSON** form (the Field dropdown
  listed person demographics — PRENAME, จังหวัด, สิทธิ… — not drug columns). **Root cause:**
  `col_field` reads its options from the selected **`pdf_sql`** (and `pdf_form_id` auto-fills from
  it) — so the fix is to select the correct pharmacy-dispense **SQL provider**; the drug columns
  then appear in the dropdown automatically.
- **TODO:** find the real source in the `his` db ([[erp-mongodb]]) — the pharmacy
  requisition/dispense collection(s) — build a [[sql-factory|SQL query]], point `pdf_sql` at
  it, then replace every `{{}}` and column `Field` with the real SQL field names.
- **Where it sits in the system:** this report backs the **[[pis|PIS]] / `order_tran`** step of
  the [[his-opd-flow|HIS flow]] — the pharmacy dispense collection is the likely SQL source.

## Related
- Technique/gotchas: [[report-factory]] · data: [[erp-mongodb]] · platform: [[his]] / [[initcraft]].
