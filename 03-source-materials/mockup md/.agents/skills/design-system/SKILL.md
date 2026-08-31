---
name: design-system-worklist-mockup
description: Creates implementation-ready design-system guidance with tokens, component behavior, and accessibility standards. Use when creating or updating UI rules, component specifications, or design-system documentation.
---

<!-- TYPEUI_SH_MANAGED_START -->

# ห้องปฏิบัติการแลป — Worklist Mockup

## Mission
Deliver implementation-ready design-system guidance for ห้องปฏิบัติการแลป — Worklist Mockup that can be applied consistently across dashboard web app interfaces.

## Brand
- Product/brand: ห้องปฏิบัติการแลป — Worklist Mockup
- URL: http://127.0.0.1:8767/02-his/ui/lab-workbench-stock-pattern-mockup.html?open=ord-waiting-0001%2Cord-result-partial-0002%2Cord-rejected-0004
- Audience: authenticated users and operators
- Product surface: dashboard web app

## Style Foundations
- Visual style: structured, accessible, implementation-first
- Main font style: `font.family.primary=Leelawadee UI`, `font.family.stack=Leelawadee UI, Noto Sans Thai, Tahoma, Segoe UI, sans-serif`, `font.size.base=14px`, `font.weight.base=400`, `font.lineHeight.base=20.3px`
- Typography scale: `font.size.xs=11px`, `font.size.sm=12px`, `font.size.md=13px`, `font.size.lg=14px`, `font.size.xl=25px`
- Color palette: `color.text.primary=#606266`, `color.text.secondary=#909399`, `color.surface.base=#000000`, `color.surface.muted=#ffffff`, `color.surface.raised=#f5f7fa`, `color.surface.strong=#409eff`, `color.border.default=rgb(96, 98, 102) rgb(96, 98, 102) rgb(235, 238, 245)`, `color.border.strong=rgb(144, 147, 153) rgb(144, 147, 153) rgb(220, 223, 230)`
- Spacing scale: `space.1=4px`, `space.2=5px`, `space.3=6px`, `space.4=7px`, `space.5=8px`, `space.6=10px`, `space.7=11px`, `space.8=12px`
- Radius/shadow/motion tokens: `radius.xs=4px`, `radius.sm=5px`, `radius.md=6px` | `motion.duration.instant=150ms`

## Accessibility
- Target: WCAG 2.2 AA
- Keyboard-first interactions required.
- Focus-visible rules required.
- Contrast constraints required.

## Writing Tone
concise, confident, implementation-focused

## Rules: Do
- Use semantic tokens, not raw hex values in component guidance.
- Every component must define required states: default, hover, focus-visible, active, disabled, loading, error.
- Responsive behavior and edge-case handling should be specified for every component family.
- Accessibility acceptance criteria must be testable in implementation.

## Rules: Don't
- Do not allow low-contrast text or hidden focus indicators.
- Do not introduce one-off spacing or typography exceptions.
- Do not use ambiguous labels or non-descriptive actions.

## Guideline Authoring Workflow
1. Restate design intent in one sentence.
2. Define foundations and tokens.
3. Define component anatomy, variants, and interactions.
4. Add accessibility acceptance criteria.
5. Add anti-patterns and migration notes.
6. End with QA checklist.

## Required Output Structure
- Context and goals
- Design tokens and foundations
- Component-level rules (anatomy, variants, states, responsive behavior)
- Accessibility requirements and testable acceptance criteria
- Content and tone standards with examples
- Anti-patterns and prohibited implementations
- QA checklist

## Component Rule Expectations
- Include keyboard, pointer, and touch behavior.
- Include spacing and typography token requirements.
- Include long-content, overflow, and empty-state handling.

## Quality Gates
- Every non-negotiable rule must use "must".
- Every recommendation should use "should".
- Every accessibility rule must be testable in implementation.
- Prefer system consistency over local visual exceptions.

<!-- TYPEUI_SH_MANAGED_END -->
