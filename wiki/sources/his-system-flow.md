---
type: source
title: HIS — System Flow Diagram (architecture)
created: 2026-07-19
updated: 2026-07-19
tags: [initcraft, his, architecture, flow, healthcare, diagram]
sources: []
source_file: "raw/his-system-flow.drawio"   # not yet in raw/ — see note below
source_type: image
source_date: unknown
author: unknown
url: https://app.diagrams.net/#G1cN65pFSZG1zCya3A5Wm53LIfUHXjnF89
---

# HIS — System Flow Diagram (`architecture`)

> A draw.io / diagrams.net flowchart (labelled **"architecture"**) of the end-to-end
> **OPD patient journey** through the [[his|HIS]] built on [[initcraft]] — from patient
> registration through billing, claims, and outbound data feeds. Ingested from a screenshot
> the user provided (the `.drawio` lives on Google Drive; not yet copied into `raw/`).

## Summary
The diagram reads left → right as one OPD flow, then fans out to payer/claim systems on the
right. Node shapes follow flowchart convention: **ellipse** = start/end, **rectangle** =
process/module, **parallelogram** = data in/out.

- **Front desk:** `start` → **Person (HN)** (patient master, Hospital Number) → **visit (VN)**
  (opens an encounter, Visit Number). Person also triggers **เช็คสิทธิ์** (verify insurance
  entitlement). Visit spawns **opd_trans (EMR)** (the OPD encounter transaction / EMR).
- **Clinical modules (fan-out from `visit`):** a row of service modules run during the visit —
  **Clinical Doc** (written "Cinical Doc"), **Diag** (diagnosis), **CPOE** (order entry),
  **PIS** (pharmacy), **LIS** (lab).
- **Per-module outputs:** Clinical Doc → **IOT**; Diag → **coder**; CPOE / PIS → **order_tran**
  (order transactions); LIS ↔ **ผลแล็บ** (lab results, two-way).
- **Billing:** **FA** (finance/charging) → **fa_trans** (financial transactions) and →
  **ปิดสิทธิ์ (รับรู้ยอดเงิน)** (close entitlement / recognize revenue) → **End**.
- **Claims (post-visit, right side):** `End` → **ระบบเคลม** (claim system) → **CSOP
  (จ่ายตรง, โครงการ)** and → **e-claim (บัตรทอง)**.
- **Outbound data feeds (standalone boxes):** **FDH (api)**, **43 แฟ้ม (api)**, **refer (api)**.

## Key takeaways
- This is the **architecture-level map** of the HIS: the two exported forms already ingested
  fit into it — [[his-patient-form]] = the **Person (HN)** / เช็คสิทธิ์ / visit front-desk step;
  [[his-emr-form]] = the **opd_trans (EMR)** clinical step.
- **Three transaction tables** are named as the write targets: `opd_trans`, `order_tran`,
  `fa_trans`. These are candidates for real [[zdata-collections|`zdata_*`]] collections in the
  live `his` db — **to be verified** ([[erp-mongodb]]).
- The clinical layer is a standard HIS module split — **CPOE / PIS / LIS** (order entry /
  pharmacy / lab) — each writing orders or results; **FA** aggregates charges for billing.
- The right edge is the **Thai reimbursement stack**: บัตรทอง via **e-claim** (NHSO),
  ข้าราชการ **จ่ายตรง** via CSOP, plus the mandatory **43-แฟ้ม** MOPH dataset and a **refer**
  (referral) feed.

## Faithful node/edge transcription
_As drawn (so the interpretation above stays checkable):_
```
start ─▶ Person (HN) ─▶ เช็คสิทธิ์            (parallelogram, left)
Person (HN) ─▶ visit (VN)
visit (VN) ─▶ opd_trans (EMR)               (right)
visit (VN) ─▶ [ Cinical Doc | Diag | CPOE | PIS | LIS ]   (fan-out row)
   Cinical Doc ─▶ IOT            (parallelogram)
   Diag        ─▶ coder
   CPOE, PIS   ─▶ order_tran
   LIS        ◀─▶ ผลแล็บ         (parallelogram, two-way)
FA ─▶ fa_trans
FA ─▶ ปิดสิทธิ์ (รับรู้ยอดเงิน)  (parallelogram) ─▶ End
End ─▶ ระบบเคลม ─▶ CSOP (จ่ายตรง, โครงการ)
                 └▶ e-claim (บัตรทอง)
[ standalone ]  FDH (api)   ·   43 แฟ้ม (api)   ·   refer (api)
label: "architecture"
```

## Entities & concepts touched
- [[his]] — the application this diagram maps end to end.
- [[his-patient-form]] — realises the **Person (HN) / เช็คสิทธิ์ / visit** front-desk step.
- [[his-emr-form]] — realises the **opd_trans (EMR)** clinical step.
- [[his-opd-flow]] — the synthesis narrating this journey (filed from this source).
- [[cpoe]] · [[pis]] · [[lis]] — the clinical order/result modules.
- [[his-billing]] — FA / fa_trans / ปิดสิทธิ์ (revenue recognition).
- [[his-claims]] — ระบบเคลม, CSOP/จ่ายตรง, e-claim/บัตรทอง.
- [[his-data-integrations]] — 43 แฟ้ม, FDH, refer outbound feeds.
- [[zdata-collections]] — where `opd_trans` / `order_tran` / `fa_trans` should resolve.

## Contradictions / open questions
- **Provenance gap:** the source `.drawio` (Google Drive `1cN65pFSZG1zCya3A5Wm53LIfUHXjnF89`)
  is **not yet in `raw/`** — the connector token was expired at ingest time. This page is read
  from a screenshot; copy the real file to `raw/` when Drive access is restored.
- **Ambiguous labels (interpretation — awaiting user confirmation):**
  - **IOT** (under Clinical Doc) — IoT / medical-device vital capture? unclear.
  - **coder** (under Diag) — an ICD-10 coding module, or the "coder" job role?
  - **FA** — "Financial Accounting" / การเงิน (charging)? high-likely but unconfirmed.
  - **CSOP** — the acronym behind จ่ายตรง/โครงการ direct billing is unresolved.
  - **FDH (api)** — meaning of the acronym unknown.
- **Edges among CPOE / PIS / LIS / order_tran** are drawn with crossing connectors; the exact
  routing (which module writes `order_tran` vs exchanges `ผลแล็บ`) is read as best-effort.
- Transaction collections (`opd_trans`, `order_tran`, `fa_trans`) are **unverified** against the
  live `his` db — a natural next step (aligns with verifying against real Mongo).
