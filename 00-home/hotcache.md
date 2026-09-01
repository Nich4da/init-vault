---
type: meta
title: Hot Cache
updated: 2026-09-01
---

# 🔥 Hot Cache — read this first

> Working-state cache; cap 500 words. Vault root: `~/Documents/Initcraft skill`.

## LAB current state

- Work Item `6a95c750422c1ca959829e8a` → `zdata_lab_work_item`
- Outbound `6a95cb80422c1ca959829e8c` → `zdata_lab_outband_order` (`outband` is exact)
- Worklist `6a9434c3422c1ca959829d5e`; LAB NO. `6a94f1ed422c1ca959829d6e`; Receive `6a94f634422c1ca959829d70`; Reject `6a79ff46d5218a5b6a26bebc`; Agent Submit `6a9468c7422c1ca959829d6a`

MongoDB is standalone. LAB NO./Receive use atomic daily `SSYYMMDDNNNN`, idempotency and compare-and-set. CPOE remains read-only.

Agent outbound works from Mac VPN (`202`) but API Factory server cannot route to private Agent. Inbound callback UAT remains with Agent team. External LAB upload supports PDF/JPG/JPEG/PNG, 10 MB/file, 3/report; upload alone does not complete a result.

## LAB Worklist

Whole-Order cancellation is implemented locally as Worklist action `cancel_order`; no new Process ID. It requires a reason and creates one `zdata_lab_order_cancellation` audit/lock keyed by CPOE Order `_id` (`pending/applied/conflict`), then idempotently cancels eligible Work Items. Prior terminal Items remain unchanged. A never-attempted Outbound is cancelled first through CAS; an attempted/sent Outbound fails with `lis_cancel_required`. LAB NO., Receive, Reject and Worklist specimen/result writes block active cancellation. Form button/dialog and Work Item audit fields are generated. Six LAB suites and both SDForm validators pass; runtime UAT is pending.

Cancelled/rejected Worklist rows now hide PDF and EMR and show `ตรวจใหม่`. This is a UI mock only: it makes no Process call or data change. The future write flow creates a linked new Order No.; LAB NO. is still created only on specimen receipt. Form tests and SDForm validation pass; Builder/runtime import is pending.

Manual CPOE launcher is local and LAB-scoped, but user paused it after preferring a separate LAB launcher. Do not deploy/extend until resumed; server enforcement still needs exported `cpoe-order-save` (`6a71edd247075049ef0245af`).

Reject normalizes legacy CPOE `accepted/prepared/ready/dispensed` without Work Item, LAB NO. or `received_at` to effective `sent`, matching Worklist. Real receipt evidence stays fail-closed.

## X-ray (2026-09-01)

MongoDB is standalone; accession/dispatch use no-transaction fallback. Dispatch is one Item per call and received-state vocabulary is synchronized across API/Form. Half-dispatched rows repair without rewinding status. Item reject exists locally; dispatched cancellation needs the RIS cancel contract.

Runtime 2026-09-01: `SM20260901CT001` was issued and the receipt committed — **only the RIS call still fails**. Dispatch now pre-checks the team's 9 required fields (drift-tested against their `xray_api_order.js`) and names the gap in Thai; `toIsoDate` reads `DD/MM/YYYY`, `YYYYMMDD`, and พ.ศ.; the Form shows the real `transport.message`.

Order cancellation is wired: `action:'cancel_order'` inside the existing worklist Process (LAB's shape, no new Process ID), free-text reason in a dialog, idempotent log in `zdata_xray_order_cancellation`. An issued Accession blocks it (`ris_cancel_required`, D-X9); unnumbered items cancel normally. Eight suites pass.

## Waiting / next

1. Paste updated Worklist, LAB NO., Receive and Reject Processes; re-import Work Item and Worklist Forms; UAT cancellation before receipt and after receipt/before Agent.
2. Verify cancelled/rejected rows show only `ตรวจใหม่`; clicking it must only show the mock notice.
3. Confirm attempted/sent Order refuses cancellation pending LIS cancel API; then resolve Agent routing/callback.

Dirty worktree has overlapping LAB/X-ray/Obsidian changes. Never discard, `git add -A`, or auto-commit.
