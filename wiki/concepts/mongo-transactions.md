---
type: concept
title: Transactions & optimistic locking (mongoTxn / withVersion)
created: 2026-07-16
updated: 2026-07-16
tags: [initcraft, mongodb, transactions, concurrency]
sources: ["[[llm-api-docs]]"]
---

# Transactions & optimistic locking

For multi-document atomicity and safe concurrent updates in an [[api-factory|API Factory]]
process, from the "Transactions & Optimistic Lock" section of [[llm-api-docs]]. Two helpers,
both on `this.*`:

- **`this.mongoTxn()`** — run a set of writes inside a single MongoDB transaction so they
  commit or roll back together.
- **`this.withVersion()`** — optimistic locking: guard an update against a stale read so two
  concurrent writers can't clobber each other.

## When to use
- Money/stock movements and any invariant spanning multiple documents → `mongoTxn`.
- Read-modify-write on a record that others might edit concurrently → `withVersion`.
- These operate on [[mongodb|MongoDB]] / [[zdata-collections]] and pair naturally with
  [[xformdatax]] to return the committed result to the form.

## Gaps
The source lists common patterns and an "error handling & ข้อควรระวัง" (caveats) subsection;
the exact signatures/retry semantics are not yet distilled here — expand on next need or a
follow-up source.

## Related
- Part of the [[server-api-app|server API]] surface.
