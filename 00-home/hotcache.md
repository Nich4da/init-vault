---
type: meta
title: Hot Cache
updated: 2026-08-31
---

# 🔥 Hot Cache — read this first

> Working-state cache; cap 500 words. Vault: `/Users/nichada/Documents/Initcraft skill`.

## LAB receive/result flow — revised 2026-08-31

- Physical receipt is independent from Agent payload readiness. HIS records receive time, assigns Lab No., and accepts first. Missing collection time parks `awaiting_collection`; missing priority/test/specimen code parks `awaiting_outbound_data`; Agent whole-order dedupe parks a later Item at `awaiting_agent_append`. Receive time never substitutes for collection time.
- Removed the pre-receive Agent `PRECHECK`; missing priority/specimen code now returns received success without calling Agent. Worklist uses `await field.confirm(...)`. All client Process calls now use authenticated `globalThis.fetch` with `{params}` because callback-style `userState.runProcess` caused successful HTTP responses to appear as `API run success` errors.
- The `order` tab has no Item-level result-action column. `ออกผล` is enabled immediately and lists every active Item with `ดูผล`, even before receipt. `ดูผล` opens read-only before receipt; after receipt the pencil enables Manual entry for every section.
- Result, Unit, interpretation, reference range are editable. `ค่าก่อนหน้า` is readonly Item revision history; Manual never overwrites Agent/LIS rows.
- Doctor display strips email decorations and empty brackets: `ศิรชัย ปิยะชน ( )` → `ศิรชัย ปิยะชน`.

Changed: receive/worklist APIs, Worklist generator/JSON/tests, Lab design, and HTML mockup.

Verified: Agent submit, Lab No., receive/worklist API, Form tests, and SDForm validator (2 widgets) pass.

## Git checkpoint and deployment next

Re-import bundle: `02-his/handoff/lab-cpoe-reimport-20260831-v2.zip` (four ID-labelled API bodies, Form JSON, Thai instructions, checksums). Replace existing IDs; creating new IDs requires remapping. Agent URL/key are placeholders; configure only in the protected process and rotate the previously file-stored key. Perform runtime/Agent UAT.

The repository work was checkpointed on `main` and pushed on 2026-08-31. Automated API/Form regressions and SDForm validation passed, including the byte-identical re-import bundle at `02-his/handoff/lab-cpoe-reimport-20260831-v2/`. Obsidian workspace/graph state and the nested `01-knowledge-base/.obsidian/` local configuration were intentionally excluded.

## X-ray — mockup + design, rev 4, 2026-08-31

Artifacts: `02-his/ui/xray-workbench-mockup.html` and `design/Xray_*.md`; full spec is there.

Core rules: **1 order = 1 accession = 1 test** (LAB is 1 order, many tests), so a row is one exam
— no item checkboxes, no item-level reject, detail buttons are only `ส่งเข้าเครื่อง` and
`ยกเลิก order`. No specimen, no Lab No. Every test is machine-bound at order time. The machine
dropdown (19 values, `Select all`) sits between Date Range and Search and its filter also drives
the chip counts. Two numbers: `Order No.` from CPOE (`20260831011`); `Accession No.` issued by
radiology at dispatch as a **test-level column**, `YYYYMMDD` + modality code + 3-digit running
**per modality per day** (`20260831CT001`).

Working folder: **`Form-Builder/SDForm/X-ray/`** with `design.md` and `spec.md`; no SDForm JSON yet.

Open: real modality codes for the 10 dropdown values missing from `section.json` (D-X14, mockup
invents them); accession length 13-15 chars (D-X15); code case (D-X16); 999 wrap guard (D-X12);
the Agent validator requires `labno`/`specimen_code`, so X-ray cannot use it as-is (D-X3). The
draw.io link is unreadable here — export it into `02-his/draw_design/`.
