---
type: concept
title: HIS data integrations (43 แฟ้ม / FDH / refer)
created: 2026-07-19
updated: 2026-07-19
tags: [initcraft, his, integration, api, healthcare, thailand]
sources: ["[[his-system-flow]]"]
---

# HIS data integrations — 43 แฟ้ม / FDH / refer

> Outbound API feeds from the [[his|HIS]] to national / inter-hospital systems.

## In the flow
Per [[his-system-flow]], three **standalone `(api)` boxes** sit on the right, beside the
[[his-claims|claim system]] — outbound data feeds rather than steps in the visit:
- **43 แฟ้ม (api)**
- **FDH (api)**
- **refer (api)**

## What they are (domain)
- **43 แฟ้ม** — the Thai **MOPH standard 43-file health dataset** every provider must export
  (population, visits, diagnoses, procedures, drugs, lab, etc.) for the national health data
  warehouse (HDC). A core, mandatory reporting obligation.
- **refer (api)** — a **referral / ส่งต่อผู้ป่วย** feed (referring patients to/from other
  hospitals). Relates to the EMR's consult/referral workflow ([[his-emr-form]] `consult`).
- **FDH (api)** — **acronym unresolved** (see [[his-system-flow]]); another API-based external
  feed. To confirm with the user.

## Open questions
- Resolve **FDH**.
- Whether **43 แฟ้ม** is generated from the same billed/claim data as [[his-claims|ระบบเคลม]].
- Whether **refer** shares the EMR consult data model or is a separate national refer standard.

## Related
- Sibling: [[his-claims]] · consult source: [[his-emr-form]] · flow: [[his-opd-flow]].
