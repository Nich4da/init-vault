---
type: concept
title: HIS billing (FA / fa_trans / ปิดสิทธิ์)
created: 2026-07-19
updated: 2026-07-19
tags: [initcraft, his, billing, finance, healthcare]
sources: ["[[his-system-flow]]"]
---

# HIS billing — FA / `fa_trans` / ปิดสิทธิ์

> The finance step of the [[his|HIS]]: turn a visit's orders into charges, then close the
> entitlement and recognize the revenue.

## In the flow
Per [[his-system-flow]], **FA** sits after the clinical modules and before **End**. It:
- writes **`fa_trans`** (financial transactions), and
- performs **ปิดสิทธิ์ (รับรู้ยอดเงิน)** — "close entitlement / recognize revenue" — the
  billing finalisation that ends the visit.

## What it is (domain — "FA" unconfirmed)
FA is read as the **finance / charging** module (likely "Financial Accounting" / การเงิน —
label unconfirmed, see [[his-system-flow]]). It aggregates the charge lines raised by
[[cpoe|CPOE]] / [[pis|PIS]] / [[lis|LIS]] against the patient's verified **สิทธิ**
(entitlement, from the เช็คสิทธิ์ step), splits payable vs. claimable, then **ปิดสิทธิ์**
locks the visit's amount so it can be recognized as revenue and handed to the
[[his-claims|claim system]].

## Data
- Write target (from diagram): **`fa_trans`** — [[zdata-collections|`zdata_*`]] candidate,
  **unverified** ([[erp-mongodb]]).

## Open questions
- Confirm "FA" = การเงิน/Financial Accounting.
- How `fa_trans` links back to `order_tran` charge lines and to the entitlement (สิทธิ) split.
- What "รับรู้ยอดเงิน" (revenue recognition) implies for accounting posting downstream.

## Related
- Feeds: [[his-claims]] · upstream orders: [[cpoe]] · [[pis]] · [[lis]] · flow: [[his-opd-flow]].
