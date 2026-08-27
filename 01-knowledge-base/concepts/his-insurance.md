---
type: concept
title: HIS insurance / สิทธิการรักษา (inscl_*)
created: 2026-07-20
updated: 2026-07-20
tags: [initcraft, his, insurance, entitlement, healthcare]
sources: ["[[his-patient-form]]", "[[his-visit-form]]"]
---

# HIS insurance — สิทธิการรักษา (`inscl_*`)

> The patient-entitlement model of the [[his|HIS]] — the **เช็คสิทธิ์** step of [[his-opd-flow]].
> Rights live on the **PERSON**, are verified via a process, and are **snapshotted onto each
> [[his-visit-form|visit]]**.

## The `inscl_*` fields (on PERSON, `pid`)
Shown by the [[his-patient-form|workspace]] `person_info` panel; all are coded objects `{value,label}`:

| Field | Meaning |
|---|---|
| `inscl_main_code` | สิทธิหลัก (main scheme) |
| `inscl_sub_code` | สิทธิย่อย (sub scheme) |
| `inscl_hos_main` | โรงพยาบาลต้นสิทธิหลัก (main contracting hospital) |
| `inscl_hos_sub` | โรงพยาบาลต้นสิทธิรอง (secondary hospital) |
| `inscl_hos` | **array** — สิทธิในโรงพยาบาล; each item `{ inscl_item_main, inscl_item_sub }` |

On the **visit**, the same rights appear as `inscl_item_main` (ประเภทผู้ป่วย), `inscl_item_sub`
(ประเภทการรักษา), and the `inscl_hos` array (in `inscl_hos_box`).

## Flow — check, edit, inherit
1. **ตรวจสอบสิทธิ (`checkRight`)** — [[his-patient-form]] runs process
   **`6a4ccaef49285083acfeb081`** `({ pid, date: today })` → returns `insuranceId`, then opens the
   **PERSON INSURANCE** form `6a467fb539179670f85ba29e` (parent = person). On save, the keys
   `inscl_main_code, inscl_sub_code, inscl_hos_main, inscl_hos_sub, inscl_hos` merge back into the
   live `pid` (reactive re-render).
2. **Open Visit** — the [[his-visit-form|visit]] `onFormMounted` (if `visit_date` = today &
   `inscl_hos` empty) runs process **`6a4c705049285083acfeb076`** `({ personId })` → sets the
   visit's `inscl_hos` from the person's active rights. So a visit **carries the rights that applied
   that day**, independent of later person edits.

## Relation to the earlier data probe
Matches the earlier read-only finding (when `his` was reachable): person →
`zdata_person_insurance` (`xparentx = person._id`) → `inscl_main` by `inscl_main_code.value`; the
**sub** scheme is null at top level because it lives inside the **`inscl_hos` array**, not as a flat
field — consistent with the model above.

## For the report
The [[his-medical-record-report|เวชระเบียน report]] prints สิทธิการรักษา from these fields. Because
`inscl_hos` is an **array**, a flat SQL join can multiply rows — treat it like the relatives case
(loop in the LaTeX template, or pick `[0]`). See [[report-latex]].

## Related
- Step in [[his-opd-flow]] (เช็คสิทธิ์) · sources [[his-patient-form]] · [[his-visit-form]].
- Coded-value display handled by [[report-factory|Report Factory]]'s form-model conversion.
