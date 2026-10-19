---
type: meta
title: Hot Cache
updated: 2026-10-16
---

# 🔥 Hot Cache — read this first

## LAB / EMR

- 2026-10-18 LAB live check: processes match local. Judge by resulted orders (pending ≠ failure): 13/14 receipts processed, all matched. Open: `400305` in Agent catalog, critical decision, UAT corrected/duplicate, BB/ML/BG, backlog. UAT covered `m1001`–`m1007`.
- MB Form split actions/date/time; tests pass. Reason migration is complete. MY form `6acc8587481c196fbb332c60` has a staged 37-row import; deploy/UAT remain.
- EMR History “ดูผลทั้งใบ” is ready; not deployed.

## HIS local · LISconnect endpoint handoff

- Outbound Order: update only protected `LAB Agent Order Submit` configuration with the new complete LISconnect `/api/orders` URL and `X-Agent-Key`; never place the key in SDForm/Vue/repository.
- Inbound Result: Agent calls local HIS action `POST https://<local-his-host>/api/v1/external/lis.receive`, header `x-api-key`, body `{ "params": <result JSON> }`. Admin must issue hostname/key; do not reuse the outbound key. Status callback remains unconfirmed.

## X-ray

- X-ray audit (2026-10-16): Radio Exam `6a8fde8a4c725771c62b1bc1` matches all 1,825 QSNICH EXAM codes/names. Of 621 active masters, 571 resolve; 50 lack mapping. Candidates: `47508→D891`, `RD076→D076`, `RD117→RD117`; confirm clinically.
- Mapping fix is local: Dispatch `6a967029422c1ca959829edc` sends the mapped value/label; Worklist preserves mapped/legacy codes. Focused suites pass; stale suites remain. RIS Order `6a8f1ef87632d182ef6914fe` passes `D891` unchanged, so `xray_api_order` needs no mapping change. Team issues: pre-trim `AccessionNo`, no auth header (prior 401), forced `xrstatx=1`, unnormalized `IsDeleted`, and policy for missing Exam fields. Not deployed; files overlap user changes.
- CPOE UAT (HN6900049/VN6900438): live order `R2610160001` created 1 linked Order + 6 X-ray Items and its EMR card shows 6 items/sent/฿26,550. No duplicate order was created by Codex. Defects: Order destination remains `m01.p ห้องยาพรีเมี่ยม`; no separate creation status/audit record was found.
- Shared user-owned clone `6a995d064744260ea8c9498c` is stale versus admin original `6a927860422c1ca959829d26`. X-ray entry still shows all categories and defaults to Lab. Proposed only after approval: rebase while preserving VN/insurance/LAB deltas; add `xray_scope` (all X-ray sections, no room split); add top `ส่งต่อ (กำหนดเอง)` using existing Move Unit `6a4f828d22f95f21b606d9a2`. Move Unit requires active Visit Tran `_id`, not Visit `_id`; APIs must return it. No live Form/API change yet.
- Queue scope parked (staff pick X-ray rooms only); EMR read-only.
- Local `ติดตามคิว` search covers HN/VN/queue/name; tests pass.
- Local Worklist Finance: `sent` red unpaid; `ready` green paid. My Room has Check-in; Unit Queue keeps `ซักประวัติ`. Live Form unchanged.
- Dispatch uses `RadiologistFName` only. Manual X-ray result (current + immutable log) not deployed. Unit Queue changes need ListView reload.

## Guardrails

- Live `mongo-his` is read-only in every case (user rule 2026-10-09).
- Live EMR and non-user-owned/unknown Form/API/Report/SQL remain read-only. Ask before each user-owned live mutation.
- Worktree is heavily dirty; never broad-stage/revert/mix changes. No commit for incomplete/read-only work.
- Origin is PUBLIC. Repo files use placeholders (`__XRAY_LOCAL_AGENT_TOKEN__`, `staffNN@example.invalid`); real token in gitignored `.env`. 2026-10-16 work committed `0a36cdd`..`23668f8`. **Push blocked:** older unpushed `68caf35`..`7163b88` still hold the token (`39338ec` an email); the approved history rewrite was denied by auto mode — user must allow it. Never push `backup/pre-scrub-20261016`.
