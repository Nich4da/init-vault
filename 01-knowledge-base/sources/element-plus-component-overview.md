---
type: source
title: Element Plus component overview
created: 2026-08-27
updated: 2026-08-27
tags: [element-plus, vue, component-library, web-clip]
sources: []
source_file: "03-source-materials/web-clips/element-plus.md"
source_type: web
source_date: unknown
author: unknown
url: https://element-plus.org/en-US/component/overview
---

# Element Plus component overview

> An official Element Plus overview page clipped on 2026-08-27, presenting the
> Vue 3 component library as a categorized directory for designers and developers.

## Summary

- The page describes [[element-plus|Element Plus]] as a component library based
  on Vue 3.
- This snapshot lists 82 components across seven categories: Basic (12),
  Configuration (1), Form (25), Data (23), Navigation (9), Feedback (10), and
  Others (2).
- Form controls include inputs, pickers, Form, Select, Upload, Transfer, and
  related variants; Data includes Table, Tree, Pagination, Card, and display
  components.
- Navigation and Feedback cover application-shell behavior such as Menu, Tabs,
  Steps, Dialog, Drawer, Message, Notification, Popover, and Tooltip.
- Some entries show the Element Plus release in which that individual component
  appeared. Those badges are not a version number for the clipped page itself.
- The page links each component to its documentation and links the overview source
  to the official GitHub repository.

## Key takeaways

- This page is a discovery map, not a detailed API or compatibility reference.
- The category counts are a dated snapshot captured on 2026-08-27 and may change
  as Element Plus evolves.
- The catalog provides useful vocabulary for interpreting `el-*` UI references,
  but it does not prove that [[initcraft]] exposes or supports every component.

## Entities & concepts touched

- [[element-plus]] — the Vue 3 component library cataloged by the source.
- [[field-components]] — initCraft's separate component catalog, which overlaps
  with some Element Plus concepts but also contains platform-specific widgets.
- [[initcraft]] — uses Element Plus-related UI vocabulary in local artifacts, but
  compatibility must be verified from real exports and runtime behavior.

## Contradictions / open questions

- The clipped overview does not state the installed Element Plus version used by
  initCraft.
- It does not document wrapper behavior, exposed props/events, or which components
  are enabled inside SDForm or `vue-ui`.

