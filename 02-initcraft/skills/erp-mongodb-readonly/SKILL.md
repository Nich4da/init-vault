---
name: erp-mongodb-readonly
description: Read-only MongoDB workflow for the Softmax ERP database. Use when Codex needs to inspect ERP MongoDB databases, list collections, verify whether a collection/table exists, sample documents, infer schema, map initCraft/ERP form data collections such as zdata_* names, or update local ERP MongoDB schema notes. Never use for writes; this skill is explicitly read-only.
---

# ERP MongoDB Readonly

## Safety Rules

- Treat ERP MongoDB as production unless the user clearly says otherwise.
- Only run read-only operations: `ping`, `list_database_names`, `list_collection_names`, `find`, `count_documents`, `estimated_document_count`, `distinct`, and aggregation pipelines with read-only stages.
- Never run `insert`, `update`, `delete`, `drop`, `rename`, `$out`, `$merge`, index changes, user/admin changes, or migrations.
- Do not store credentials in this skill, memory files, references, scripts, git, shell history, or final answers.
- Prefer `MDB_MCP_CONNECTION_STRING` or a one-off in-memory variable. If the user pasted a URI in the current conversation, use it only for the current task and do not write it to disk.

## Quick Workflow

1. Check whether MongoDB MCP tools are available. If `mcp__mongodb__*` tools are exposed, use them in read-only mode.
2. If MCP tools are not available, use `scripts/erp_mongo_readonly.py` with `pymongo`.
3. Default database is `erp`.
4. For existence checks, list collection names first, then compare exact names and likely aliases.
5. When useful, update `references/schema-notes.md` with non-secret schema discoveries.

## Script Usage

Set the URI only in process memory or environment:

```powershell
$env:MDB_MCP_CONNECTION_STRING = "<mongodb-uri>"
python C:\Users\marni\.codex\skills\erp-mongodb-readonly\scripts\erp_mongo_readonly.py list --database erp
```

Common commands:

```powershell
python ...\erp_mongo_readonly.py list --database erp
python ...\erp_mongo_readonly.py exists --database erp --collection vehicle_booking_list
python ...\erp_mongo_readonly.py match --database erp --pattern "vehicle|booking|book|vms|car"
python ...\erp_mongo_readonly.py sample --database erp --collection zdata_vms_car_bookin --limit 3
python ...\erp_mongo_readonly.py schema --database erp --collection zdata_vms_car_bookin --limit 20
```

If the URI is not in `MDB_MCP_CONNECTION_STRING`, pass `--uri-env SOME_ENV_NAME`. Do not pass secrets as command-line arguments because commands may be logged.

## Known ERP Notes

Read `references/schema-notes.md` before answering questions about known ERP collections or form-data mappings. Update it when live read-only checks reveal stable new information.

## sdform_manage Learning

When the user asks about initCraft form definitions, inspect `sdform_manage` first.

- Use `form_name`, `_id`, `dataid`, `form_table`, `form_type`, `form_category`, `form_enable`, `updated_at` for the form catalog.
- Use `form_db.schema` as the readable source of field keys, labels, component types, defaults, hidden/required flags, and joined/ref fields.
- Use `form_options.display_fields` and `form_options.search_fields` to understand list/search defaults.
- Treat `form_model` as encrypted app payload when it contains `key`, `iv`, and `data`; do not rely on it for readable canvas/layout structure from MongoDB.
- For initCraft scripts, verify field names against `form_db.schema` before writing `where`, template variables, or `refField` logic.
- Keep notes about `sdform_manage` structure in `references/schema-notes.md`; do not store credentials or raw encrypted payloads.
