---
type: synthesis
title: HIS OPD Flow — end-to-end patient journey
created: 2026-07-19
updated: 2026-07-19
tags: [initcraft, his, architecture, flow, healthcare, overview]
sources: ["[[his-system-flow]]", "[[his-patient-form]]", "[[his-emr-form]]"]
---

# HIS OPD Flow — end-to-end patient journey

The architecture-level map of the [[his|HIS]] (สถาบันสุขภาพเด็กฯ), read off the
[[his-system-flow|"architecture" flow diagram]]. It stitches together the pieces the wiki
already knew as isolated forms ([[his-patient-form]], [[his-emr-form]]) into one journey:
**register → verify entitlement → open visit → clinical work → billing → claims → data feeds.**

> This is the *sequence* and the *module map*. Field-level detail for each step lives on the
> linked module pages; unverified labels are flagged in [[his-system-flow]].

## The journey (start → End)

1. **Person (HN)** — patient master record, keyed by **HN** (Hospital Number). Registration /
   lookup, Thai smart-card read, search. → realised by [[his-patient-form]].
2. **เช็คสิทธิ์** — verify the patient's **insurance entitlement** (สิทธิการรักษา) before the
   visit. Ties to the known insurance query: `person → zdata_person_insurance → inscl_main`
   (see [[his-patient-form]] `checkRight()` and the hotcache insurance note).
3. **visit (VN)** — open an **encounter**, keyed by **VN** (Visit Number) → `zdata_visit`.
   One person (HN) has many visits (VN).
4. **opd_trans (EMR)** — the OPD **encounter transaction / EMR**: the doctor's SOAP screen
   (CC / PE / Dx / Plan), vitals/BMI, consult, disease registry. → realised by [[his-emr-form]].
5. **Clinical modules** (run within the visit, fan out from step 3):
   - **Clinical Doc** → `IOT` — clinical documentation (device/vitals capture? — unconfirmed).
   - **[[his-diagnosis|Diag]]** → `coder` — diagnosis + ICD coding.
   - **[[cpoe|CPOE]]** — computerised physician **order entry** → `order_tran`.
   - **[[pis|PIS]]** — **pharmacy** information system → `order_tran` (drug orders / dispense).
   - **[[lis|LIS]]** — **laboratory** information system ↔ `ผลแล็บ` (order out, results back).
6. **[[his-billing|FA]]** — finance / **charge capture**: aggregates the visit's orders into
   `fa_trans`, then **ปิดสิทธิ์ (รับรู้ยอดเงิน)** closes the entitlement and recognizes revenue.
7. **End** — visit complete.

## After the visit — claims & data feeds (right side)

- **[[his-claims|ระบบเคลม]]** (claim system) routes the closed visit to the right payer:
  - **CSOP — จ่ายตรง, โครงการ**: direct-billing schemes (ข้าราชการ จ่ายตรง กรมบัญชีกลาง + special projects).
  - **e-claim — บัตรทอง**: NHSO Universal Coverage via the **e-Claim** system.
- **[[his-data-integrations|Outbound feeds]]** (standalone APIs): **43 แฟ้ม** (mandatory MOPH
  standard dataset), **FDH** (api — meaning TBD), **refer** (api — referral / ส่งต่อ).

## Module → transaction-table map

| Step | Module | Writes / exchanges | Wiki page |
|------|--------|--------------------|-----------|
| Register | Person (HN) | person master | [[his-patient-form]] |
| Entitlement | เช็คสิทธิ์ | `zdata_person_insurance` / `inscl_main` | [[his-patient-form]] |
| Encounter | visit (VN) | `zdata_visit` | [[his]] |
| EMR | opd_trans (EMR) | `opd_trans` | [[his-emr-form]] |
| Orders | CPOE | `order_tran` | [[cpoe]] |
| Pharmacy | PIS | `order_tran` (dispense) | [[pis]] |
| Lab | LIS | `ผลแล็บ` (results) | [[lis]] |
| Diagnosis | Diag | `coder` (ICD) | [[his-diagnosis]] |
| Billing | FA | `fa_trans` | [[his-billing]] |
| Claims | ระบบเคลม | CSOP / e-claim | [[his-claims]] |

_Transaction table names (`opd_trans`, `order_tran`, `fa_trans`) are read from the diagram and
**not yet verified** against the live `his` db — see [[erp-mongodb]]._

## Why this matters
- Gives every future ingest a **place to hang** — a new form/report/query now maps to a known
  step (e.g. the pending **ใบฎีกาจ่ายยา** report → the **[[pis|PIS]] / order_tran** step, see
  [[his-med-dispense-voucher-report]]).
- Surfaces the **billing → claims → 43-แฟ้ม** tail, which is where most Thai-HIS reporting and
  government-document work lives (the user's focus per project memory).

## Open questions / next steps
- **Verify the 3 transaction collections** exist in `his` (`opd_trans`, `order_tran`,
  `fa_trans`) and inspect their schema — read-only via the `erp-mongodb-readonly` skill.
- Resolve the ambiguous labels (IOT, coder, FA, CSOP, FDH) — see [[his-system-flow]].
- The **PIS / order_tran** step is the direct backing for the paused
  [[his-med-dispense-voucher-report|ใบฎีกาจ่ายยา report SQL]] — likely the same collection.

## Related
- Source: [[his-system-flow]] · app: [[his]] · platform: [[initcraft]].
- Steps: [[his-patient-form]] · [[his-emr-form]] · [[cpoe]] · [[pis]] · [[lis]] ·
  [[his-billing]] · [[his-claims]] · [[his-data-integrations]].
