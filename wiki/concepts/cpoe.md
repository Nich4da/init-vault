---
type: concept
title: CPOE (order entry)
created: 2026-07-19
updated: 2026-07-19
tags: [initcraft, his, clinical, orders, healthcare]
sources: ["[[his-system-flow]]"]
---

# CPOE — Computerised Physician Order Entry

> The order-entry module of the [[his|HIS]]: where the doctor places orders during a visit.

## In the flow
Per [[his-system-flow]], **CPOE** is one of the clinical modules that fan out from the
**visit (VN)** step, alongside [[pis]], [[lis]], [[his-diagnosis|Diag]] and Clinical Doc.
CPOE writes to the **`order_tran`** (order transaction) table — shared with [[pis|PIS]] in the
diagram.

## What it is (domain)
CPOE = the standard HIS component where a physician enters medication, lab, imaging, and
procedure orders electronically (replacing paper order sheets). Orders raised here become the
work items that downstream modules ([[pis|pharmacy]], [[lis|lab]]) fulfil, and the charge lines
that [[his-billing|FA]] later bills.

## Data
- Write target (from diagram): **`order_tran`** — a [[zdata-collections|`zdata_*`]] collection
  candidate, **unverified** against the live `his` db ([[erp-mongodb]]).

## Open questions
- Exact `order_tran` schema and how CPOE vs [[pis|PIS]] rows are distinguished (order type?).
- Whether CPOE is a distinct SDForm or a section of the [[his-emr-form|EMR form]].

## Related
- Flow: [[his-opd-flow]] · siblings: [[pis]] · [[lis]] · [[his-diagnosis]] · downstream: [[his-billing]].
