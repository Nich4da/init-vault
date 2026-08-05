---
type: concept
title: PIS (pharmacy information system)
created: 2026-07-19
updated: 2026-08-04
tags: [initcraft, his, pharmacy, orders, healthcare]
sources: ["[[his-system-flow]]", "[[his-module-packages-backup]]"]
---

# PIS — Pharmacy Information System

> The pharmacy module of the [[his|HIS]]: drug orders, dispensing, and stock — the backing
> domain for the pending **ใบฎีกาจ่ายยา** report.

## In the flow
Per [[his-system-flow]], **PIS** is one of the clinical modules fanning out from the
**visit (VN)** step, next to [[cpoe]] and [[lis]]. In the diagram PIS feeds the
**`order_tran`** (order transaction) table — i.e. medication orders / dispense records.

## What it is (domain)
PIS = the HIS component that turns a doctor's drug order ([[cpoe|CPOE]]) into **dispensing**
and **stock movement**: verify order → dispense to patient → decrement pharmacy inventory →
raise the drug charge for [[his-billing|billing]]. In a hospital pharmacy it also covers
requisition/transfer between stock locations (คลังยา).

## 🆕 It is now a real module (2026-08-04)

[[his-module-packages-backup]] shows a registered [[module-packages|module]]:

| Field | Value |
|---|---|
| `app_code` | **`pis_drug`** |
| `app_name` | **Drug & Stock** |
| `app_desc` | **Pharmacy Back Office** |
| tab | "Drug Items" (icon `addon-capsule-pill`) |
| bound form | `6a68f6cec91cb8030e26d75d` — "Drug & Stock v1" |
| `xunitx` | `B001 เภสัชกรรม` |
| created / updated | 2026-07-29 / 2026-08-02 |

So PIS has moved from a box on the [[his-system-flow|flow diagram]] to something being built —
starting from the **stock / drug-item master** end ("Back Office"), not the dispensing end.
⚠ **The form body has not been exported**, so its actual fields are unknown. Ask for
`6a68f6cec91cb8030e26d75d` before assuming anything about its shape.

## Why it matters here (active work)
This is the **direct backing** for the [[his-med-dispense-voucher-report|ใบฎีกาจ่ายยา
(medication dispense voucher) report]] — whose SQL step is still open. The report's real data
source is almost certainly a **PIS / `order_tran`** (or a pharmacy requisition/dispense)
collection in the `his` db. Finding that collection is the report's next step.

## Data
- Write target (from diagram): **`order_tran`** (shared with [[cpoe]]) — unverified
  [[zdata-collections|`zdata_*`]] candidate ([[erp-mongodb]]).
- Likely additional stock/requisition collection(s) behind the dispense voucher — **to hunt**.

## Open questions
- Which collection holds pharmacy **dispense / requisition** rows for the voucher report?
- How drug orders in `order_tran` are separated from other [[cpoe|CPOE]] order types.
- **(new) What is in the "Drug & Stock v1" form?** Fields, tabs, and whether it covers drug
  master only or also stock movement / requisition. Not yet exported.
- **(new) Does Drug & Stock relate to** `HIS/data/cpoe_items_cleaned_2026_07_29.xlsx` (dated the
  same day the module was created)? Likely the drug/item master import — unverified.

## Related
- Module registration: [[module-packages]] · [[his-module-packages-backup]].
- Report: [[his-med-dispense-voucher-report]] · flow: [[his-opd-flow]] · siblings: [[cpoe]] · [[lis]].
