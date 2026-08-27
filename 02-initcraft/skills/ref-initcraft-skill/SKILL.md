---
name: ref-initcraft-skill
description: initCraft complete reference snapshot for SDForm/Form Manage, widget options, field/form events, openForm popup options, vue-ui/vueData behavior, ListView/DataGrid patterns, SQL Factory, API Factory, xformDatax, mongo transactions, security, and live builder debugging. Use when Codex needs deeper initCraft platform behavior beyond the shorter feilds-init or report-factory skills.
---

# Ref InitCraft Skill

## Purpose

Use this skill as the deep reference for initCraft / softmax-one behavior. It complements the smaller task-oriented skills:

- Use `feilds-init` first for normal SDForm builder field configuration and event snippets.
- Use `report-factory` first for Report Factory specific work.
- Use this skill when the task needs broader or lower-level initCraft knowledge: widget catalog, event contexts, `openForm`, `vue-ui` reactivity, SQL/API Factory, `xformDatax`, transactions, security, or live builder debugging.

## Required Reference

Read [references/initcraft-reference.md](references/initcraft-reference.md) when this skill is triggered. It is the source snapshot supplied by the user from July 2026 and includes:

- Platform architecture and widget counts.
- Basic Input, Advanced Input, Display UI, Container, LINE LIFF, and SD Custom Content notes.
- Field event context variables and function signatures.
- Field functions, form functions, API functions, and form-level events.
- Popup Form Guide with `openForm()` options and gotchas.
- `vue-ui` / Components widget `vueData` reactive bus behavior.
- ListView, DataGrid Form, DataGrid SQL, SelectByForm, and SelectBySQL behavior.
- SQL Factory and API Factory patterns.
- `xformDatax` return-values-to-form behavior.
- `this.mongoTxn` / `this.withVersion` transaction/versioning semantics.
- Security rules and common mistakes.
- Browser/live builder debugging workflow.

Read [references/strategy-planning-project-approval-workflow.md](references/strategy-planning-project-approval-workflow.md) when building ERP flows for กลุ่มงานยุทธศาสตร์และแผนงาน, project approval, activity approval, budget borrowing/disbursement, monthly progress reporting, or strategic planning forms.

## Operating Rules

- Prefer exact internal option names and method names from the reference.
- State when a behavior is from the July 2026 reference snapshot rather than live inspection.
- For user-facing answers in this workspace, answer in Thai when the user is working in Thai.
- Do not expose secrets, tokens, connection strings, or private credentials while applying examples from the reference.
- If the user is asking for a narrow SDForm field snippet, use this reference to verify behavior but keep the final answer practical and short.
