# InitCraft Wiki Instructions for Codex

This repository is an LLM-maintained knowledge base and artifact library for
initCraft, SDForm, HIS, LAB, SQL Factory, API Factory, and Report Factory.

## Mandatory hot-cache-first protocol

Before doing anything else with this repository, read
`00-home/hotcache.md`. Do not inspect other repository files first.

If Hot Cache reports an active conversation reset, read `00-home/handoff.md`
immediately afterward and before `CLAUDE.md` or implementation files.

- If the cache fully answers a read-only question, answer from it without scanning
  more files.
- For edits, uncertain or conflicting claims, exact provenance, or safety-sensitive
  decisions, read `CLAUDE.md` next; it is the full wiki schema and applies to Codex
  as well as Claude Code.
- Use `00-home/index.md` only when more synthesized knowledge is needed, before
  scanning raw artifacts.
- Use `02-initcraft/MIGRATION_MANIFEST.md` when locating skills or implementation
  artifacts by factory.
- After work changes current state, decisions, blockers, paths, or next steps,
  refresh `00-home/hotcache.md` and keep the complete file at 500 words or fewer.

## End-of-task context checkpoint

Before the final response for every completed repository task:

1. Assess remaining context. Context is low if the context meter is near its
   limit, compaction occurred, earlier requirements are becoming uncertain, or
   continuing reliably would require reconstructing the task from many files.
2. Refresh `00-home/hotcache.md` with outcome, decisions, changed paths,
   verification, blockers, and next step; confirm it is at most 500 words.
3. If context is healthy, finish normally without recommending a new chat.
4. If context is low, stop starting new work, verify the completed task, inspect
   Git status/diffs, stage only task-owned files, commit the verified task together
   with Hot Cache, report the hash, and tell the user to open a new chat that reads
   Hot Cache first.

Never use `git add -A` in a dirty worktree and never include unrelated,
pre-existing, user-owned, secret, generated, or unverified changes. If the task's
files cannot be isolated safely, do not commit; record the blocker and paths in
Hot Cache and warn the user. Do not commit read-only, unchanged, incomplete, or
explicitly no-commit tasks, and never amend an existing commit without a direct
request.

## Confirmed-mockup and design-skill checkpoint

This checkpoint applies to UI work in this repository.

1. Treat a mockup as confirmed only when the user explicitly approves the direction,
   selects it, or instructs Codex to proceed from it. Viewing, silence, or an
   unfinished correction cycle is not confirmation.
2. After confirmation and before starting production code, SDForm JSON, a replacement
   package, or any live-artifact work, update the relevant UI/design skill first.
   Capture the approved reusable hierarchy, tokens, interaction rules, responsive
   behavior, accessibility expectations, provenance, and known boundaries. Do not
   promote speculative clinical or backend behavior into a design rule.
3. After each completed and verified user-visible function or self-contained UI
   component, reconcile the result back into the relevant skill before starting the
   next function. Record the confirmed behavior, verification evidence, and limits.
   If the function only implements an existing skill rule, update its evidence/status
   rather than duplicating the rule.
4. Keep the active skill and its repository snapshot synchronized and verify them by
   recursive comparison. Update the repository log and Hot Cache when this checkpoint
   changes durable knowledge or implementation state.
5. A skill update is documentation and continuity, not authorization to modify a live
   Form/API/Report/SQL artifact. The artifact-specific ownership and write gate still
   applies.

## Conversation reset handoff

If user intent becomes materially misunderstood, corrections conflict, the same
requirement is misunderstood again, or no single coherent objective can be stated,
stop implementation rather than guessing. Acknowledge the mismatch and attempt one
concise restatement. If that does not resolve the issue cleanly, or incorrect work
state may already exist:

1. set `00-home/handoff.md` to `status: active`;
2. record the reset trigger, confirmed intent, completed versus unverified work,
   changed paths/Git state, checks, rejected assumptions, open decisions, and exact
   next step;
3. update Hot Cache with a prominent pointer while keeping it at most 500 words;
4. do not commit misunderstood, incomplete, or unverified implementation;
5. tell the user to open a new chat that reads Hot Cache first and the active
   handoff second, restates the objective, and waits for confirmation before edits;
6. stop implementation in the old chat.

After the clean chat resolves the task, mark the handoff inactive and refresh Hot
Cache. Do not trigger a reset for a minor wording issue resolved immediately.

## MCP handshake and handoff continuity

An MCP handshake, discovery, or tool-list failure is not permission to shut down
or disable the integration. Do not set a server or plugin to `enabled = false`,
remove or uninstall it, kill a persistent service, delete its runtime/cache/config,
clear Keychain entries, rotate credentials, or close an in-app browser merely
because one handshake failed. Preserve the last known configuration unless the
user explicitly requests a shutdown/removal or continued operation presents a
verified safety risk. For a safety risk, stop further calls and report it without
silently mutating the configuration.

Before declaring an MCP server unavailable, ending work, or handing the task off:

1. verify the configured server name, command, transport, and enabled state with
   read-only inspection, redacting credentials and connection strings;
2. capture the first error in sanitized form and distinguish server launch,
   authentication, dependency/runtime, client-session cache, and tool-discovery
   failures;
3. test the installed executable or health/version command and perform one
   fresh-client handshake, such as MCP Inspector or a new Codex session;
4. after an in-scope dependency repair, retry once and stop repeated loops if the
   same failure remains; record the blocker and exact next safe test instead.

Existing sessions may retain an earlier failed client or stale tool inventory.
Keep the server enabled and record that a new session or app restart is required;
do not disable a working server because the current session did not reload it.
Use an available read-only fallback to continue diagnosis when possible.

A handoff is a continuity checkpoint, not a shutdown instruction. Do not disable
MCP servers, Computer Use, browser panels, plugins, or safe running services merely
because a handoff is created. Unless the user explicitly asks to pause or disable
them, preserve their state. Every MCP-related handoff must record the server name,
enabled state, non-secret config/runtime paths, pinned version when known,
transport and read-only mode, last successful check, sanitized failure, changes
already made, reload requirement, and exact next read-only verification. Never
copy a credential, URI, Keychain value, token, cookie, or session state into a
handoff. The receiving session must read Hot Cache and the active handoff before
changing MCP configuration and must resume from the recorded verification step
instead of repeating destructive cleanup.

## Live artifact ownership and write gate

This rule applies to live initCraft **Form Factory, API Factory, Report Factory,
and SQL Factory** artifacts.

1. Resolve the artifact owner from the authoritative live `Owner`/`Created By`
   metadata or from an explicit user confirmation. Do not infer ownership from
   `updated_by`, the current editor, a filename, an app relationship, or the fact
   that the artifact is used by X-ray/LAB/HIS. If ownership is unclear, treat the
   artifact as not owned by the user.
2. If the live artifact is **not owned by the user**, Codex is read-only by default.
   It may inspect, compare, document, and copy the behavior into a local user-owned
   replacement package. A live mutation is allowed only through the three-confirmation
   exception below; otherwise give the user verified replacement content/file to apply.
3. The three-confirmation exception for a non-user-owned artifact requires all of the
   following before any Edit, Save, Publish, replace, delete, data-record creation, or
   other live mutation:
   - Resolve the authoritative live `Owner`/`Created By`; an unknown owner cannot use
     this exception.
   - Obtain three separate explicit confirmations in three sequential human-user
     replies. Never bundle, infer, pre-approve, or count one reply more than once.
   - In every confirmation request, state the exact artifact and action, say plainly
     that the artifact is not owned by the user, name the verified owner, show the
     counter as `1/3`, `2/3`, or `3/3`, and ask whether the user confirms both that
     the named owner authorized this exact action and that Codex may proceed.
   - Do not perform the mutation until confirmation `3/3` is received. After `3/3`,
     authorization covers only the exact named artifact and action, for one execution.
   - If the artifact, owner, action, mutation scope, or intended Save/Publish/Submit
     changes before execution, reset the counter to zero and start again.
   - Later actions, retries, additional records, another Save/Publish, or another
     artifact always require a new three-confirmation cycle.
4. If the live artifact **is owned by the user**, both delivery modes are allowed:
   prepare a replacement package for the user, or edit the live artifact. Before
   every live mutation, ask which mode the user wants for that exact artifact and
   wait for the answer. Ownership does not grant standing permission to write.
5. Approval is artifact- and action-specific. A prior approval for one Form/API/
   Report/SQL item does not authorize another item or a later Save/Publish.
6. EMR or another team's artifacts remain read-only unless they complete the same
   three-confirmation exception for the exact action. Never change a source artifact
   merely because its behavior is being cloned into X-ray.

## Storage boundaries

- `01-knowledge-base/` is maintained synthesis. Update cross-references,
  frontmatter dates, the index, log, and hot cache when knowledge changes.
- `02-initcraft/` contains platform-level skills, governance, and the migration
  manifest.
- `design/` contains user-approved system design contracts and implementation
  handoffs. Keep implementation facts traceable to the current artifact and mark
  unresolved decisions explicitly.
- `Form-Builder/` groups the extension-based implementation libraries.
- `Form-Builder/SDForm/` contains JSON artifacts, preserving their original category paths.
- `Form-Builder/SDForm/Lab/` is the user-approved working area for the new LAB
  Workbench Forms. SDForm JSON created there still requires the repository JSON
  rules and validator; the folder is not a backup or a proven best practice.
- `Form-Builder/SDForm/backup/` is read-only reference storage. Never edit,
  delete, rename, move, reformat, or overwrite an existing snapshot. Copy a
  template to `Form-Builder/SDForm/form-factory/forms/` before working on it.
- `Form-Builder/SDForm/best-practices/` contains proven, sanitized, immutable
  reusable Form patterns. Promotion requires an explicit goal, static checks,
  Builder/Preview or runtime evidence appropriate to that goal, and a matching
  evidence sidecar. Keep unverified candidates in their working folder. Reuse a
  best practice by copying it to `form-factory/forms/`; never edit it in place.
- `Form-Builder/API/` contains JavaScript artifacts, preserving their original category paths.
- `Form-Builder/API/backup/` is read-only reference storage. Never edit, delete,
  rename, move, reformat, or overwrite an existing snapshot. Copy a template to
  `Form-Builder/API/api-factory/processes/` before working on it.
- `Form-Builder/seed/` contains Python artifacts, preserving their original category paths.
- `02-his/` contains remaining supporting assets such as Markdown, XLSX, ZIP,
  images, diagrams, and report templates.
- `03-source-materials/` is immutable source material. Never edit or delete an
  ingested source in place; add a new source or version instead.
- `03-source-materials/web-clips/` is the Obsidian Web Clipper inbox. Treat every
  clipped note as an immutable source snapshot; store clip attachments under
  `03-source-materials/assets/` and write synthesized notes separately under
  `01-knowledge-base/sources/`.

## Misplaced-file decision gate

If a user-provided or discovered file appears to be in the wrong folder, do not
relocate, rename, delete, edit, or update references automatically unless the user
already specified the destination. Report the current repository-relative path,
why it conflicts with the directory schema, the recommended destination, any
reasonable alternative, and the consequence of leaving it in place. Ask the user
to choose one of these outcomes:

1. keep the current path;
2. move/copy to the recommended path;
3. provide another path.

After approval, check for collisions, change only the exact approved file, preserve
provenance, update affected references/index/log/Hot Cache/manifest/checksums, and
verify the final path. Stronger immutability rules override relocation: preserve
files in `03-source-materials/` and existing `backup/` snapshots, and offer a copy
to the working path instead. For possible credentials, secrets, session state, or
patient/production data, stop and warn without exposing or ingesting the content.

## Safety and verification

- Never copy `.env`, credentials, database URIs, session histories, SQLite
  state, plugin caches, or OS metadata into the library.
- Treat imported skills and exported artifacts as snapshots. Do not silently
  modify them; write a new version and record provenance.
- Add a file to either `backup/` folder only when the user explicitly requests a
  new backup/template snapshot. Use a new versioned filename; normal Form/API
  creation and editing must always occur outside `backup/`.
- When a Form achieves a distinctive, reusable goal, evaluate it for best-practice
  promotion under `Form-Builder/SDForm/best-practices/README.md`. Preserve the
  working source, sanitize the promoted copy, record evidence and limitations,
  use a new versioned pair, and update manifest/checksums/log/Hot Cache.
- Before creating or editing SDForm JSON, read
  `02-initcraft/governance/from-codex-backup/SDFORM_JSON_RULES.md` and validate
  with `Form-Builder/seed/tests-tools/validators/check_sdform_json.py`. SDForm candidates
  are under `Form-Builder/SDForm/form-factory/forms/`. Static validation
  does not prove Builder or runtime behavior.
- Preserve the original source repositories and active skill locations. A
  library refresh is copy-and-verify, not a destructive move.
