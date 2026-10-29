---
name: emr-v2-ui
description: QSNICH EMR v2 interface and Form Factory model reference for studying, auditing, designing, implementing, or debugging initCraft clinical screens that should follow the observed EMR v2 layout, widget topology, state flow, integration hooks, status language, and interaction patterns. Use for EMR v2 UI work, exported SDForm JSON/code analysis, comparisons with older EMR screens, or clinical dashboard components; do not use it as authority for clinical rules, backend implementations, or permission to change live patient data or factory artifacts.
---

# EMR v2 UI

Use this skill to preserve the recognizable UI and implementation language of the current QSNICH EMR v2 while keeping runtime observation, exported-model evidence, and inference separate.

## Reference routing

- For visual design, runtime behavior, hierarchy, density, status language, and interaction states, read [references/qsnich-emr-v2-ui.md](references/qsnich-emr-v2-ui.md).
- For historical LAB result tables, including Order grouping, Profile/Test hierarchy, standard versus narrative MLab rows, comments, previous-result comparison, sensitive-result disclosure, tooltips, and compact light/dark styling, read [references/emr-history-lab-result-table.md](references/emr-history-lab-result-table.md).
- For exported JSON structure, widget code, state propagation, Form/API/Report coupling, queue filters, lifecycle cleanup, or implementation debugging, read [references/qsnich-emr-v2-form-model.md](references/qsnich-emr-v2-form-model.md).
- Read both references for implementation or audit work that crosses presentation and behavior.

## Working method

1. Identify the requested surface: queue, room list, completed list, patient header, prior history, SOAP workspace, order panel, billing summary, result tracking, or a cross-surface redesign.
2. When the user explicitly confirms a mockup, update this skill or its relevant reference before starting production code, SDForm JSON, a replacement package, or live-artifact work. Capture only approved reusable design decisions, their provenance, scope, and unverified boundaries; do not convert clinical or backend assumptions into UI rules.
3. Reuse the matching hierarchy and interaction pattern from the reference. Preserve the distinction between current visit, prior visits, current clinic, and other clinics.
4. Keep clinical state legible in text. Color may reinforce status but must not be the only carrier of meaning.
5. Use Element Plus as the component vocabulary for initCraft runtime UI. Pair this skill with `element-plus-initcraft` when writing `el-*` templates or component behavior.
6. When changing exported JSON, preserve the `fields` tree and `formConfig` contract, edit the smallest owning widget, and validate with the repository SDForm validator. Do not assume static validation proves Builder, Preview, runtime, permission, or clinical behavior.
7. Treat generator-marked blocks such as `emr2-*` add-ons as generated output. Locate and change the authoritative generator or source fragment when available instead of hand-editing generated blocks in Builder.
8. Treat anything not directly observed or present in the export as an inference. Label proposals, mobile behavior, backend behavior, and new workflow rules explicitly rather than presenting them as v2 facts.
9. Use sanitized examples only. Never copy a patient name, HN, VN, birth date, phone number, clinician email, result text, credential, token, or other production/medical data into code, documentation, screenshots, fixtures, or prompts.
10. Validate visual work at desktop width against the three-column composition and verify compact, full, hidden, empty, loading, read-only, warning, and disabled states relevant to the surface.
11. After each completed and verified user-visible function or self-contained UI component, reconcile the result into the relevant skill reference before starting the next function. Add confirmed behavior, verification evidence, and limitations. If it only implements an existing rule, update the evidence/status without duplicating the instruction. Keep the active skill and repository snapshot synchronized.

## Safety and ownership boundary

- Studying the live UI is read-only. Do not trigger clinical actions such as saving a note, ordering, checking in, completing a visit, referring, admitting, moving rooms, administering vaccines, or changing disease registry data merely to inspect the interface.
- A live Form/API/Report/SQL artifact may be changed only after authoritative ownership is resolved and the user chooses the delivery mode for that exact artifact. Otherwise prepare a local replacement or implementation handoff.
- The references describe presentation and the exported client model. They are not substitutes for verified clinical policy, validation rules, server implementations, permissions, or live API behavior.

## Deliverables

For audits, report which v2 pattern applies, the observed evidence, deviations, and whether the deviation is intentional. For implementations, state what was preserved, what was added, and which behavior remains unverified in live Builder/Preview/runtime.
