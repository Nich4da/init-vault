---
type: entity
title: Element Plus
created: 2026-08-27
updated: 2026-08-27
tags: [element-plus, vue, component-library, ui]
aliases: [ElementPlus]
sources: ["[[element-plus-component-overview]]", "[[llm-field-docs]]", "[[his-module-packages-backup]]"]
---

# Element Plus

Element Plus is a Vue 3 component library for designers and developers. Its
official overview organizes reusable UI building blocks into Basic,
Configuration, Form, Data, Navigation, Feedback, and Others
([[element-plus-component-overview]]).

## Catalog snapshot

| Category | Components |
|---|---:|
| Basic | 12 |
| Configuration | 1 |
| Form | 25 |
| Data | 23 |
| Navigation | 9 |
| Feedback | 10 |
| Others | 2 |
| **Total** | **82** |

The count is the clipped 2026-08-27 snapshot, not a permanent total
([[element-plus-component-overview]]).

## Relationship to initCraft

initCraft artifacts use an `el-*` icon namespace identified as Element Plus
([[his-module-packages-backup]]), and its own [[field-components|field component
catalog]] includes many familiar form, data, navigation, feedback, and container
concepts ([[llm-field-docs]]).

The catalogs are not interchangeable. initCraft exposes SDForm-specific wrappers
and platform components such as SQL/Form-bound selectors, `record-ui`, `list-ui`,
report widgets, smart-card integration, and `vue-ui`. An Element Plus component or
prop appearing in official documentation is therefore not proof that the same API
is exposed by initCraft; verify against a real exported form and runtime behavior.

## Related

- Official catalog snapshot: [[element-plus-component-overview]]
- initCraft catalog: [[field-components]]
- Custom Vue surface: [[vue-ui-pattern]]
- Platform: [[initcraft]]

