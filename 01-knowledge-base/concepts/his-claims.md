---
type: concept
title: HIS claims (ระบบเคลม — CSOP / e-claim)
created: 2026-07-19
updated: 2026-07-19
tags: [initcraft, his, claims, reimbursement, healthcare, thailand]
sources: ["[[his-system-flow]]"]
---

# HIS claims — ระบบเคลม (CSOP / e-claim)

> Post-visit reimbursement: route each closed, billed visit to the correct Thai payer scheme.

## In the flow
Per [[his-system-flow]], after **End** the visit enters **ระบบเคลม** (the claim system), which
routes to two payer channels:
- **CSOP — จ่ายตรง, โครงการ** — direct-billing schemes.
- **e-claim — บัตรทอง** — Universal Coverage claims.

## What it is (domain)
Thailand's health financing runs mostly through payer schemes that hospitals must **claim**
against; ระบบเคลม assembles each visit's billed data ([[his-billing|fa_trans]]) into the
payer's required claim format and submits it.

- **บัตรทอง (UC) → e-Claim** — the **NHSO** Universal Coverage scheme; claims go through NHSO's
  **e-Claim** system.
- **จ่ายตรง (direct payment) → CSOP** — civil-servant (CSMBS, กรมบัญชีกลาง) **direct-billing**
  and other **โครงการ** (special projects). *"CSOP" acronym unconfirmed — see [[his-system-flow]].*

## Open questions
- Resolve **CSOP** (the direct-billing/โครงการ channel's full name / system).
- Which scheme(s) apply for สถาบันสุขภาพเด็กฯ (a specialty children's hospital) and the claim
  formats each requires.
- Relationship between ระบบเคลม output and the **43 แฟ้ม** feed ([[his-data-integrations]]).

## Related
- Upstream: [[his-billing]] · entitlement check: [[his-patient-form]] (`checkRight`) ·
  data feeds: [[his-data-integrations]] · flow: [[his-opd-flow]].
