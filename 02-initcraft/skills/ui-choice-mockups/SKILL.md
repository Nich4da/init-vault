---
name: ui-choice-mockups
description: Create three focused visual variants for a small UI change, rank them with plain-language tradeoffs, collect a clickable choice when available, and defer editing the canonical mockup until explicit confirmation. Use for incremental UI selection before changing a larger mockup; do not use as authority to implement or mutate a live artifact.
---

# UI Choice Mockups

Use this skill when the user wants to decide one small part of an interface before
that decision is applied to the main mockup or implementation.

## Selection Workflow

1. Identify the single decision being tested, the current confirmed baseline, and
   the canonical mockup that must remain unchanged during selection. If those are
   already clear, proceed without another question.
2. Create exactly three genuinely distinct variants of only that decision. Preserve
   every unrelated confirmed behavior, label, data relationship, token, and layout.
   Use the same viewport, crop, content, and surrounding context for all three so the
   visual treatment is the only meaningful variable.
3. Render the variants as images. Prefer one comparison board with three equally
   sized, clearly numbered panels. A selection marker may appear as a visual cue,
   but do not imply that a checkbox drawn inside a static image sends a response.
4. Rank the panels from most recommended to least recommended: Choice 1, Choice 2,
   Choice 3. Base the ranking on the user's confirmed design direction, usability,
   accessibility, density, and implementation fit rather than novelty.
5. Under the image, explain each choice in short plain-language text. State what
   changes, why it may fit, and its main tradeoff. Match the user's language and
   avoid design jargon unless it is necessary.
6. When a native three-choice input tool is available, ask one question with the
   three numbered choices in the same order and mark Choice 1 as recommended. This
   is the clickable selection surface. If it is unavailable, ask the user to reply
   with `1`, `2`, or `3`; static Markdown checkboxes are not a reliable submit UI.
7. Stop before changing the canonical mockup. Treat a choice as confirmed only when
   the user explicitly selects it, approves it, or asks to proceed from it.

If the user wants a hybrid or correction, create a new focused three-choice round
for that unresolved detail instead of broadening the current comparison.

## Choosing the Rendering Method

- When an existing HTML/code mockup is available, build an isolated comparison
  board from its actual styles/components and capture it as an image. Do not edit
  the canonical mockup merely to produce the options.
- When only a description or visual reference exists, generate or draw the three
  image variants with consistent geometry and realistic synthetic content.
- Use patient-safe, synthetic data. Never place credentials, patient data, or
  production identifiers in a choice image.

## After Confirmation

Record the exact selected choice and any requested combination. For repository UI
work, update the relevant UI/design skill with the confirmed reusable decision
before production code, SDForm JSON, a replacement package, or live-artifact work.
Then apply only the confirmed change to the canonical mockup and verify that prior
confirmed behavior remains intact.

Skill use is not authorization to edit a live Form/API/Report/SQL artifact. Preserve
the applicable ownership and write gate.

## Response Contract

Before confirmation, return these together:

- the three-panel image or three consistently framed images;
- plain-text descriptions ordered Choice 1 through Choice 3;
- a native clickable selector when available, otherwise a `1/2/3` reply prompt;
- one explicit line stating that the main mockup has not yet been changed.
