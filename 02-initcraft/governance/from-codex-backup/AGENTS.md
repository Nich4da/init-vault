# Workspace Handoff Rules

## 🔴 HIGHEST PRIORITY — SDForm JSON must never be hand-authored from scratch

Before creating or editing ANY SDForm/initCraft form JSON in this workspace, read
[SDFORM_JSON_RULES.md](SDFORM_JSON_RULES.md) completely.
There is an open case: read [HANDOFF_SDFORM_LIST_UI.md](HANDOFF_SDFORM_LIST_UI.md) and continue from
its step 1 before doing anything else with the LAB_result form.

- **Never write a widget's `options` from scratch.** Copy the whole widget object from one of the
  template forms listed in that document, then change only `name`, `label`, `defaultValue`,
  `columnSpan`, `readonly`, `required`, `hidden`, `placeholder`, and `id`. Do not delete any other
  `options` key, even one that looks unused.
- **Run the validator and get exit code 0 before handing the file to the user:**
  `python3 check_sdform_json.py <file.json>` — a file that exits 1 must not be delivered, ever.
- The "Builder canvas is empty but Tree View lists every widget" failure needs BOTH conditions fixed:
  complete `options` AND a container (`grid`/`card`/`tab`) wrapping the widgets. A form whose
  `options` are complete but which has zero containers still fails — that was confirmed on
  2026-08-25. Only `key` uniqueness and `cssCode` are actually ruled out; the `id` format and `key`
  presence are still unproven, so match a template export on every axis instead of guessing.
- A user screenshot showing an empty canvas means the delivered file failed. Fix it, re-run the
  validator, and say explicitly that Builder confirmation is still pending.
- After reading `SDFORM_JSON_RULES.md`, state its verification token in your reply so the user knows
  the rules were actually loaded. Files under `fixtures/` and `Result_Report_Manual_UI_Validated.json`
  are kept broken on purpose to test this rule — never delete or repair them in place; write your
  fix to a new filename.
- **Do not overwrite a git-tracked file in place without saying so.** Run `git status` on any file
  you are about to write. If it is already committed, either write a new filename or state plainly
  in your reply that you are modifying a committed artifact and what changed.
- **A static Node/Python test proves expression logic, not rendering.** Never write “tested and
  passed” for Builder, preview, readonly/editable, or any runtime behavior unless the user confirmed
  it in the running app. Say “static checks passed; runtime unverified” instead.

## Session start and scope

- Read `MEMORY.md` before continuing any Lab work in a new session.
- If the request mentions Manual Lab results, LIS results, `Lab_Result_Item`, `Lab_Result_Definition_Master`, `Result_Report_Manual_Entry`, critical values, units, or says “ทำต่อ” in that context, read `LAB_MANUAL_RESULT_HANDOFF.md` completely before proposing or making changes.
- Preserve all working Lab receive, specimen, reject, status, priority, search, and ListView functions. A request to add or adjust one feature does not authorize removing or rewriting unrelated working behavior.
- Treat the “files considered latest” section in the applicable handoff as the starting point, but verify live/import status before claiming that a feature works.

## Mandatory Delivery Verification

- Before handing off any created or edited artifact, check syntax and type/schema errors, then run every relevant validator, test, and build available in the workspace.
- Test the actual behavior against the user's requirement. For initCraft/SDForm JSON, static JSON parsing and container-tree checks are not sufficient: run `check_sdform_json.py` (must exit 0), compare component/options schemas with a known working exported form per [SDFORM_JSON_RULES.md](SDFORM_JSON_RULES.md), and verify the imported form in the real Builder/Preview/runtime.
- Treat a user screenshot or report showing incorrect behavior as a failed test. Investigate the cause, fix it, and repeat the relevant checks; do not ask the user to repair an artifact that has not passed verification.
- Never state or imply that work is complete, working, ready, or production-ready without evidence from the required checks. If live/runtime verification is inaccessible, label the result explicitly as unverified, record the exact missing test, and do not present it as a finished deliverable.
- Report which checks were run and their outcomes in the final handoff. Preserve evidence such as validator output or a concise test report when practical.
