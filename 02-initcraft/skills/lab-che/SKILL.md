---
name: lab-che
description: Detailed clinical laboratory reference for CHE request forms, specimen and test codes, hospital LAB workflows, and QSNICH HIS-LIS integration. Use when Codex needs to explain, document, audit, design, implement, test, diagram, or troubleshoot laboratory ordering, receiving, rejection, results, critical values, LISconnect, HL7 ORM/OBR/OBX, .req/.res files, CPOE-to-LIS mappings, order-status synchronization, partial/final/corrected results, LAB screens, reports, or source-document requirements.
---

# Lab CHE

Read the relevant reference completely before acting:

- Read [references/Lab_CHE.md](references/Lab_CHE.md) for CHE request forms,
  laboratory operations, screens, reports, risks, specimen types, and test codes.
- Read [references/LIS_HIS_Integration.md](references/LIS_HIS_Integration.md)
  for LISconnect, HIS-to-LIS orders, LIS-to-HIS results, `.req`/`.res`, HL7,
  CPOE mappings, status synchronization, idempotency, and integration diagrams.
- Read both references when a task crosses operational Lab workflow and LIS
  transport behavior.

## Rules

1. Separate source facts from implementation assumptions.
2. Keep HIS, LIS, LISconnect, order, LAB NO., specimen, report, and result-item
   concepts distinct.
3. Trace forms, models, APIs, diagrams, checklists, and tests to the applicable
   source reference.
4. Do not invent ranges, units, prices, turnaround times, tube colors,
   interpretation, mapping equivalence, or validation absent from documents.
5. Treat `his_code_id`, outbound `test_code`, inbound `obs_code`, TMLT, and
   specimen codes as distinct until the contract explicitly equates them.
6. Preserve idempotency and append-only result/correction history.
7. Flag ambiguities and contract gaps rather than guessing.
8. Treat patient identifiers and results as sensitive clinical data.
9. Separate persistence wiring from presentation wiring: an inbound API may
   already populate Receipt, Report, and Result Item data forms even when the
   aggregate Lab UI/ListView is not built yet. Verify each layer independently.
10. For machine LIS/Mlab results, use the explicit critical decision received
    from the integration. Do not infer a clinical critical event solely from
    the presence of low/high threshold text; keep rules as snapshots unless an
    approved contract explicitly defines otherwise.
11. Do not claim production readiness from schema checks, Preview rendering,
    or one partial-result test. Require a real Order end-to-end through HIS →
    Agent → LIS → Agent → HIS plus final/corrected/idempotency verification.
