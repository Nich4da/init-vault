---
type: synthesis
title: LAB worklist UI — 3-tab design (S2/S3/S4)
created: 2026-08-04
updated: 2026-08-04
tags: [his, lab, lis, ui, design, active-build]
sources: ["[[his-lab-biochem-requirements]]", "[[his-lab-che-order-component]]", "[[his-lab-che-request-form]]"]
---

# LAB worklist UI — the 3-tab design

> The main lab working window for **งานชีวเคมี**, covering screens **S2 / S3 / S4** of
> [[his-lab-module-plan]]. Requested 2026-08-04; delivered as a clickable HTML mockup at
> `02-his/ui/lab-worklist-mockup.html` (also published as an artifact) because **there is no Figma
> integration in this environment** — the file can be imported into Figma with the
> `html.to.design` plugin, or reused directly as the `vue-ui` skeleton.

## The structure the user asked for

```
หน้าต่างการทำงานห้อง LAB   (unit = งานชีวเคมี)
├── แท็บ 1  รอรับ            → S3  รายละเอียดคำขอ + รับเข้า/ปฏิเสธ
├── แท็บ 2  รับเข้าแล้ว       → the EXISTING list-order screen, shown per patient
└── แท็บ 3  ออกผลแล้ว        → S4  ผลตรวจ + ค่าวิกฤติ + ปกปิด + พิมพ์
```

Each tab is a **master–detail split**: a queue on the left (380 px), the detail on the right.
Tab 2's detail pane is where [[his-lab-che-order-component|the built order component]] lands —
the user's own framing: *"list order จะอยู่หน้านี้เมื่อกดเลือกคนไข้รายบุคคล"*, and that screen is
only reachable **after** a patient has been pulled into the waiting room.

This matches req. 3 exactly (แยกสถานะ รอรับเข้า / รับเข้าดำเนินการ / ออกผลแล้ว อย่างชัดเจน) —
the tab labels use the user's shorter wording (รอรับ / รับเข้าแล้ว).

## Design decisions and what backs each one

| Decision | Requirement it serves |
|---|---|
| **Left severity stripe** on every queue row (แดง ด่วน/วิกฤติ · เหลือง รอรับ · ฟ้า ดำเนินการ · เขียว ครบ) | scanability — state readable without reading text |
| **LAB NO. rendered as a monospace plate that itself turns red + ⚠** | req. 8 — *"แจ้งเตือนค่าวิกฤติตรง LAB NO. ให้แพทย์เห็นอย่างชัดเจน"*. A floating badge would not satisfy "ตรง LAB NO." |
| Critical shown **twice**: order-level banner + row-level `is-crit` | req. 5 — *"ในระดับ order ละ แต่ละรายการตรวจ"* |
| Tab counts on the tab itself + a **ด่วน / วิกฤติ counter** | the lab's daily triage question is "how much is waiting and how bad" |
| Patient block with ชื่อ + **Remark เปลี่ยนชื่อ-สกุล**, ว/ด/ป เกิด, เลข ปชช, โทร, ผู้ติดต่อได้, สิทธิ, **Check in / Admit ที่ไหน**, นัดถัดไป | req. 7, field for field |
| Tab 1 test table has a **✕ per line** + "เพิ่มรายการตรวจ" + "ออก / แก้ LAB NO." | req. 4 — แก้ไข/ลบรายการ, ปรับเปลี่ยน LAB NO. |
| `รับเข้าดำเนินการ` button says **"— บันทึกเวลารับ"** inline | req. 4 — accepting stamps a time; the control states its effect |
| **ปฏิเสธสิ่งส่งตรวจ** as a destructive-styled sibling | req. 4 — reject + reason + rejecter |
| สิทธิ + สถานะชำระเงิน as tags on both the row and the patient block | req. 4 — ตรวจสอบสิทธิ/สถานะการชำระเงิน |
| Tab 2 lines carry **รอผล** explicitly, never blank | req. 8 — pending must be visible so partial results aren't read as "not ordered" |
| **ลงผล Manual (กรณี LIS ล่ม)** is a primary button on tab 2 | req. 6 |
| Tab 3 footer strip: **สำเนาพิมพ์ออนไลน์** · ผู้พิมพ์ · datetime · `page 1/2` | req. 8, verbatim |
| ปกปิดผล renders the row at 50 % with the reason + who + when | req. 5 — แก้ไข/ปกปิดผล, and governance needs an audit trail |
| Every numeric column `font-variant-numeric: tabular-nums` | value vs Ref. Range comparison is the core reading task |

## Visual system — inherited, not invented

The mockup reuses the tokens [[his-lab-che-order-component]] already ships in its `cssCode`:
Element Plus variables (`--el-color-primary`, `--el-fill-color-light`, …), 10–14 px radii, chip
filters, card headers on `--el-fill-color-dark`. Colours are EP's own
(`#409EFF` / `#E6A23C` / `#67C23A` / `#F56C6C`) so the mockup and the real
[[vue-ui-pattern|`vue-ui`]] render identically.

Thai type uses a system stack (`Leelawadee UI` → `Noto Sans Thai` → `Segoe UI`) rather than a
web font, and data uses a mono stack. Light + dark are both defined at token level.

## ⚠ Marked as unconfirmed inside the mockup itself

Three panels at the bottom of the page flag what is **invented, not sourced**:

1. **ช่อง "ด่วน"** — the urgency control comes from immunology's `C-20/L5.1-1`
   ([[his-lab-immuno-request-forms]]); **biochemistry's `C-20/L3.1` has no such field**.
   If ชีวเคมี doesn't use it, drop the filter chip and the tags.
2. **ราคา** — the numbers in the tab-1 table are placeholders. No price source exists
   ([[his-lab-module-plan]] decision 8); the built component hard-codes `0`.
3. **ลำดับผลในแท็บ 3** — currently ordered by the paper form's groups. Req. 5 says it must follow
   the **Report LIS** order, which nobody has supplied yet (decision 3).

All patient names, HNs, LAB NOs, values, and times are fabricated. Test codes and group names
(`C20`, `C21`, `C25.1–4`, `C23`, `C59`, `C1–C6`, `C26`, `C28`) are real, from
[[his-lab-che-request-form]].

## Not covered by this design

S1 (order entry — already built), S5 (manual result entry — only linked as a button),
S6 (doctor's สถานะการสั่งแลป view), S7 (master data), S8 (risk register), S9 (reports).
The multi-unit header problem from [[his-lab-bg-request-forms]] /
[[his-lab-immuno-request-forms]] is **not** solved here — this design assumes one unit
(ชีวเคมี). A `zdata_lab_unit`-driven header is still needed before genetics/immunology reuse it.

## Related
- [[his-lab-module-plan]] — the screens this implements (S2/S3/S4) and the open decisions.
- [[lis]] — pipeline, LAB NO., critical values, print semantics.
- [[his-lab-che-order-component]] — the component that lives inside tab 2.
- [[vue-ui-pattern]] — how this becomes a real initCraft component.
- [[module-packages]] — the registration still needed to make the module reachable.
