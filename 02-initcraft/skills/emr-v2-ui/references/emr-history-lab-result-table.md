# EMR history LAB result table pattern

## Provenance and authority

- User-confirmed through iterative local mockup review on 2026-10-26. Later confirmed corrections place the Order heading above its column-heading row in both V1 and V2, move the result time after the Profile/Test summary without the `ผล` prefix, format it as 12-hour time with `AM`/`PM`, add an explicit high/low direction arrow beside the current result, and introduce a horizontally scrollable multi-result comparison layout with sticky identity/current columns.
- Local-browser verification on 2026-10-26 confirmed the remaining V2/V4 layouts, Light/Dark, independent Order collapse, 1/5/10 history columns, direct reports and persistent attachments. V1/V3 were removed. At 1440 px, V4 with 10 histories measured a 924 px corridor showing seven complete 132 px columns. At 472 px and 612 px narrow/zoomed hosts, responsive sticky widths preserved complete history columns without left/right collision. Opaque sticky cells and structural fills covered history content during scrolling. A final correction stretched each sticky column-heading cell across the full computed row height; visual checks at the first and last history positions showed no residual date/time strip above or below `รายการ/ครั้งนี้/ค่าปกติ/แปลผล`. The compact 28 px standard, 24 px Profile and 26 px attachment rows retained the 13 px Test/result type. Console error/warning logs were empty.
- A later 2026-10-26 verification removed whole-column snap and added frame-level clipping plus explicit lower stacking for history cells. V4 at 1440 px and V2 at 472 px both remained at a non-column-aligned 37 px offset with range `step=1`, zero document-level horizontal overflow, and clean sticky/history ownership on both sides of the corridor. `Final`, `รายงานผล`, chevron, and sensitive-result controls measured 24 px high; the action controls used 4 px horizontal padding and every locked result rendered the complete visible label `ยืนยันดูผล`.
- A screenshot-led correction later exposed residual Profile-row border and sticky-shadow fragments that the earlier boundary checks missed. The Profile row is now one solid structural band: it has no partial bottom border, and every sticky Profile fill suppresses left/right borders and box shadows. Visual checks covered V2 and V4 in both Light and Dark at 680 px, plus V4 at 1440 px; no fragment remained and console warning/error logs were empty.
- A further max-scroll screenshot exposed the actual blank overlap: row-level sticky pseudo-element shields were constrained independently from the overflowing grid and covered the end of the history corridor. The fix removed those shields and the V4 `width:100%` override so every grid row's containing block spans its full column track. Real sticky cells now meet the final history cell at a zero-gap boundary. V2/V4 were checked at 472, 768 and 1440 px, including maximum and 37 px fractional offsets, with both sticky edges at zero offset and no page overflow.
- VN history selection was verified on 2026-10-26 with a compact multi-select dropdown beside the count select. Twelve synthetic VN choices each exposed a full Buddhist visit date and concise LAB order summary; abnormal badges appeared only for positive counts. The trigger now contains text plus chevron only, the list heading is `Visit ที่มีการสั่ง LAB`, and every draft selection appears below as a VN/date box with an individually labelled `×`. Selecting three VNs produced three newest-first columns. At the 10-VN cap, removing one selection from its box kept the dropdown open, unchecked the matching option, updated the count and limit, re-enabled the two locked options, and moved keyboard focus to the next remove control. Cancel preserved the applied selection, Escape returned focus, V2/V4 and Light/Dark retained zero page overflow, and console warning/error logs were empty.
- A follow-up correction established that the production contract supplies complete VN strings such as `VN6900470`; the client must not prepend `VN` or insert a hyphen. Synthetic choices were aligned to that shape, the primary action changed from `ใช้ VN` to `เลือก`, and the count/VN chevrons were inset 13/14 px from the right edge. Browser verification confirmed exact VN rendering, one-VN apply, the expected history column, zero page overflow and no console warnings/errors.
- A later user decision superseded the 10-VN cap: all available LAB-order Visits may now be selected without a client-side maximum. Browser verification selected all 12 synthetic Visits with zero disabled options, rendered 12 history columns, and measured the selected-summary region at 166 px for both client and scroll height with `overflow: visible`, proving vertical growth without an internal scrollbar. V2/V4, Light/Dark, zero page overflow and console logs remained clean.
- On 2026-10-26 the user selected Choice 2 from `02-his/ui/emr-history-lab-vn-context-tag-choice-mockup.html`: show one compact primary-diagnosis tag in the space between the VN and visit date. The tag must read as a real amber box, with an explicit light amber background, visible amber border, rounded corners and amber text in both themes; plain inline `Dx:` text does not satisfy the selected choice. Prefix the supplied label with `Dx:`, truncate long visible text with an ellipsis while exposing the full value on hover/focus, and omit the tag when no authoritative primary diagnosis is available. Do not infer a diagnosis from LAB orders, results, abnormal flags, clinic, or visit type.
- Local-browser verification covered V2/Light and V4/Dark at a 472 px viewport. Eleven synthetic diagnosis tags and one intentional missing-diagnosis row rendered with zero VN/tag/date overlap and zero page overflow. Every visible tag exposed matching `data-tooltip`, focusability and accessible text. Selecting all 12 Visits still produced zero disabled options, 12 removable summary boxes, matching 166 px client/scroll summary heights with visible overflow, and a 12-occurrence result table.
- A user screenshot then exposed that the first canonical implementation referenced an undefined `--warning` token, so its diagnosis border/background/color declarations were invalid and only plain text rendered. The corrected implementation uses dedicated light/dark diagnosis tokens. Browser-computed styles now confirm a non-transparent amber background, explicit 1 px amber border and amber text in V2/Light and V4/Dark, with zero tag overlap and zero page overflow.
- Production handoff decision confirmed on 2026-10-26: ship one responsive LAB history component. The visible `V2`/`V4` selector and `Light`/`Dark` selector belong to the comparison mockup only and must not appear in the clinician-facing UI. Treat V2 and V4 as QA width fixtures for the same component; choose layout from the actual container width and inherit the host application's theme tokens. Changing host width or theme must not reset the room filter, history mode, selected Visits, horizontal position, or per-Order collapse state.
- Production sensitive-result decision confirmed on 2026-10-26: a locked current or historical cell shows `ยืนยันดูผล`; activation invokes the host re-authentication contract and, after successful authorization for that exact result/cell scope, replaces the lock control with the authorized value inline in the same table. Do not open the former centered full-result popup. Cancel, failure, expiry, or denied scope leaves the cell locked and must not leak value, comment, unit, reference, flag, previous value, Result Item ID, or Result Report ID.
- The canonical HTML's `../../output/pdf/emr-history-lab-report-<room>.pdf` links are local visual fixtures only. Production uses the verified Report Factory IDs and authoritative Result Report parent supplied by the API; never derive a production Report ID from the room code or fixture filename.
- Reference artifact: `02-his/ui/emr-history-mlab-mycology-comparison-mockup.html` in the InitCraft knowledge repository.
- This is an accepted presentation contract for a proposed historical LAB result surface. It is not proof of deployed EMR runtime behavior, a clinical interpretation rule, a backend schema, or permission to modify a live Form/API/Report/SQL artifact.
- All examples must remain obviously synthetic and contain no patient identifiers or production result data.

Read this reference when designing, implementing, or reviewing a doctor-facing historical LAB result table in EMR v2.

## Core information model

- One bordered table block represents one LAB Order, not one laboratory room.
- The doctor-facing Order heading identifies the ordered Test/Profile content. Do not lead with the room name or room code.
- Room/section codes are filter metadata and may remain in the filter control; they are not the primary heading inside each Order block.
- A Profile is a structural grouping row. Its component Tests appear immediately below and are indented. A standalone Test remains a normal result row.
- When the same Test has multiple collection or examination sites, show the Test once as a Profile and show each site as a child row. Keep a clinically meaningful site under a standalone Test only when it belongs to that single result.

## Order heading

Within each Order block, render the Order heading before the column-heading row. The visual order is:

```text
Order summary / comment                         Status  Order action  [collapse toggle]
รายการ | previous result columns | ครั้งนี้ | ค่าปกติ | แปลผล
Profile/Test result rows
```

This ordering follows the doctor-first reading sequence: identify which Test/Profile Order is being
reviewed, then read the column meanings, then scan its results. Keep the established Order-heading
content and hierarchy unchanged; this rule only changes its position relative to the column labels.

Use this reading order:

```text
Profile/Test summary  hh:mm AM/PM                     Status  Order action
optional Order comment
```

- Profile/Test summary: 13 px, weight 500, regular text color. It is deliberately quieter than Test names.
- Result time follows the summary on the same line, without a `ผล` prefix. Format it as `hh:mm AM/PM`, for example `12:44 AM` or `02:42 PM`; use 11 px, weight 400, muted. Show it once at Order level and never repeat it on every Test row.
- Test names: 13 px, weight 600.
- Derive the summary from the Test/Profile content:
  - one standalone Test: exact Test name;
  - one Profile: Profile name;
  - two or three top-level items: join with ` · `;
  - longer lists: show the first two meaningful top-level names plus `และอีก N รายการ`;
  - repeated-site Test: `Test name (N ตำแหน่ง)`.
- Hover and keyboard focus on the summary must expose a tooltip listing every Profile and component Test hierarchically.
- An optional Order comment sits on a second line aligned with the Profile/Test summary.
- Both remaining V2 and V4 layouts label the PDF action `รายงานผล`. It links directly to the Order's authoritative LAB report PDF rather than opening the former centered “ดูผลทั้งใบ” result modal. Keep the visible label short and stable; put the Order/Test summary in its accessible name and native title instead of inside the button text.
- Place the Order collapse/expand button immediately after `รายงานผล` in the Order-heading action group, not in the column-heading row.
- Do not place a `ไฟล์แนบ (N)` action in the Order heading. When attachments exist, append one full-width attachment row per file after the Test/Profile result rows so filenames and metadata are visible without opening an attachment-list dialog. Use the filename as the row's primary text; do not prepend `ไฟล์แนบ N`. Omit attachment rows when the count is zero.

## Columns, history count and sticky behavior

Use a `จำนวนผลก่อนหน้า` select with exactly `1 ครั้ง`, `5 ครั้ง`, and `10 ครั้ง`. Changing it must preserve the active room filter, selected Visits and per-Order collapse state. Host-width and host-theme changes must preserve the same state as well.

Provide a second history-selection mode beside the count select: a compact `เลือก VN` dropdown containing only encounters that have LAB orders. The trigger contains only the `เลือก VN` text and dropdown chevron; do not add a redundant `VN` badge or icon. Inset the chevrons of both the history-count select and VN trigger from their right edges so they do not touch the control border. Label the dropdown list `Visit ที่มีการสั่ง LAB`. It is an unrestricted multi-select list so users can choose any number of available VN comparison occurrences; do not disable unchecked options or impose a client-side maximum based on selection count. Each option shows the authoritative VN string and full Thai visit date as its primary context, one compact `Dx:` tag for the authoritative primary diagnosis between the VN and date, a concise Test/Profile order summary, and—only when present—a compact `ผิดปกติ N รายการ` count. Truncate a long diagnosis tag visually with an ellipsis and expose its complete text on hover/focus; omit the tag when diagnosis is unavailable and never infer it from LAB data. Omit the abnormal indicator when the count is zero. Production VN values already include their display prefix, for example `VN6900470`: render the received value verbatim and never prepend `VN`, insert a hyphen, or otherwise synthesize the identifier. Keep selected state visible with checkboxes, show the selected count in the trigger, and provide clear/cancel/apply behavior with the primary action visibly labelled `เลือก`. Below the options, summarize every draft selection as a compact box containing the VN and short visit date, with a small individually labelled `×` control that removes that selection immediately without closing the dropdown; removal must also update the checkbox and selected count. Let this selected-summary region wrap and grow vertically with every selection without its own maximum height or scrollbar. The option list itself may retain a bounded scroll area. Applying selected VNs switches every visible Order to the same newest-first occurrence columns; an Order/Test without a result in a selected VN shows `—`. Returning to count mode restores the chosen 1/5/10 count without resetting saved VN selection, room or collapse state. VN data, primary diagnosis, order summaries and abnormal counts must come from the authoritative encounter/order/result contract in production; mockups use explicitly synthetic examples only.

- Create exactly the selected number of previous-result columns for every visible Order, including empty cells when a Test has no value for a selected historical occurrence.
- Each count-mode previous-result header shows `D MMM` on the first line and `hh:mm AM/PM` on the second. Custom-date mode adds the two-digit Buddhist year as `D MMM YY`. Use spaces without dash separators in both modes.
- Previous-result body cells show the value only. Do not repeat the unit in every historical cell; current result retains its unit and the normal range remains separate.
- Column sequence for standard rows is: sticky `รายการ`, scrollable previous-result columns, sticky `ครั้งนี้`, sticky `ค่าปกติ`, sticky `แปลผล`.
- Narrative MLab uses: sticky `รายการ`, scrollable previous-result columns, sticky `ครั้งนี้`, sticky `แปลผล`; it still has no normal-range column.
- Freeze `รายการ` against the left edge. Freeze `ครั้งนี้`, `ค่าปกติ` when present, and `แปลผล` against the right edge. Only the previous-result columns move horizontally.
- Sticky cells need opaque theme backgrounds, visible boundary separators, and a z-index order that keeps column headers above result cells without hiding focus rings.
- Every sticky cell in the column-heading row must stretch to the full computed row height. Do not let grid `align-items: center` shrink its painted background to the text line; otherwise the date/time of a history header can remain visible in the uncovered top or bottom strip.
- Sticky left/right regions must fully cover scrolled history content at every scroll offset. Never allow a history header, value, border, or scrollbar detail to bleed through or sit above the sticky regions. Give every column-heading, Profile and result row a real opaque sticky cell or structural fill, and make the row's containing block span the full scrollable column track. Do not use a separate row-level sticky pseudo-element shield; its sticky constraint can diverge from the real cells and create a blank overlay at maximum scroll.
- Profile/structural bands do not contain history cells. Paint each such band as one unsegmented opaque strip and give its separator one deliberate full-row treatment. Do not leave a vertical history divider or a horizontal border fragment that stops at a sticky boundary; those fragments read as scrolled content bleeding underneath the fixed columns in both light and dark themes.
- The history corridor must meet the sticky current region at one exact vertical boundary. Do not create a blank shielding gutter between the last visible history column and `ครั้งนี้`, and do not let a history-cell border or header rule remain visible inside that boundary zone. Verify this visually at the minimum, a fractional middle offset, and the maximum scroll position in V2 and V4, not only at the initial position.
- Hide the browser's full-width native table scrollbar. When history columns overflow, expose one slim accessible horizontal scrollbar whose track is limited to the scrollable history corridor between sticky `รายการ` and the sticky right-side result columns. Let the slider, trackpad, mouse-wheel/shift-wheel and keyboard move continuously at native pixel precision; do not snap, auto-align, or pull the viewport back to a whole-column boundary after scrolling. A partially visible history column is acceptable while moving, but it must be clipped cleanly at the sticky boundaries with no text, border, or background bleeding through either sticky region.

V2 is the accepted half-width embedded layout for standard numeric rows:

- place `ครั้งนี้` and `ค่าปกติ` in adjacent columns with a shared visual boundary;
- right-align the `ครั้งนี้` header and values toward that boundary;
- left-align the `ค่าปกติ` header and values away from that boundary;
- use small, equal inner insets (the verified mockup uses 6 px on each side) so the current value and reference range read as a pair;
- keep `รายการ`, previous-result columns, and narrative MLab alignment unchanged. Do not add a normal-range column to narrative MLab.

V4 is the full-width form of V2, not a new clinical table semantic:

- V4 reuses V2 current/reference pairing and behavior while expanding the component shell to the available viewport width.
- V2 remains the approximately half-width embedded layout. V1 and V3 are removed from the confirmed mockup. Switching between V2 and V4 must preserve the active room filter, history count, theme and per-Order collapse state.
- Full-width layout may fit more history columns and therefore omit the slim history scrollbar when there is no actual overflow; it must reappear for larger history counts when overflow returns.

Standard result grid:

```text
รายการ | D MMM / hh:mm AM/PM × N | ครั้งนี้ | ค่าปกติ | แปลผล
```

Narrative MLab grid:

```text
รายการ | D MMM / hh:mm AM/PM × N | ครั้งนี้ | แปลผล
```

- Label the final sticky interpretation column `แปลผล`.
- Historical header timestamps must come from the authoritative comparison occurrence. Do not invent a production timestamp; synthetic mockup timestamps must remain clearly sample data.
- Missing or unavailable values render as an em dash `—` only. Do not add explanatory copy such as “ไม่พบผลก่อนหน้า”.

## Typography and density

Use the EMR/Element Plus font stack:

```css
"Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB",
"Microsoft YaHei", Arial, "Noto Sans Thai", sans-serif
```

Binding hierarchy:

| Element | Size | Weight | Color role |
|---|---:|---:|---|
| Column heading | 12.5 px | 600 | muted |
| Profile heading | 13 px | 600 | main |
| Test name | 13 px | 600 | main or danger |
| Current/reference/previous result | 13 px | 400 | main/muted |
| Order summary | 13 px | 500 | regular |
| Unit | 12 px | 400 | muted |
| Time, date, Order comment, Test comment | 11 px | 400 | muted |
| Buttons/status chips | 12 px | 600 | semantic/regular |

Do not make numerical results larger or heavier than Test names. Abnormal emphasis changes color, not font weight.

Target compact dimensions:

- column header: 28 px minimum height;
- Order header: 30 px minimum height;
- Profile row: 24 px minimum height;
- standard result row: 28 px minimum height;
- narrative MLab row: 64 px minimum height;
- normal cell vertical padding: 1 px;
- Profile/column header vertical padding: 1 px;
- Order header vertical padding: 1 px;
- status, `รายงานผล`, and sensitive-result controls: 24 px minimum height, 4 px radius, and tight 1 px vertical / 4 px horizontal padding so they remain separated from Order-header boundaries and `ยืนยันดูผล` remains complete inside a narrow history cell;
- attachment row: 26 px minimum height with thin muted-gray filename text and quieter type/size metadata.

The compact density target is quantity-first: show more results per viewport without reducing the
13 px Test/result text hierarchy. Remove excess top/bottom space before reducing type size.

Control borders must never default to black. Use a darker tone from the control's own semantic family: success controls use the success/green border token, warning controls use the warning/amber border token, and neutral controls use a medium neutral-gray border token. Preserve the same relationship in light and dark themes.

## Profiles, comments, and row content

- Show a Profile name once as a separate band. Do not repeat it in each child name.
- Indent Profile children by 16 px beyond the normal first-column inset.
- Keep Profile name, standalone Test name, and Profile child Test name at the same 13 px/600 hierarchy.
- Order comments and Test comments are optional, 11 px/400/muted, and appear immediately below their owning heading or Test.
- Comments are not specimen labels. Do not expose repeated specimen helper text in the doctor-facing table unless the product requirement explicitly elevates it as clinically necessary.
- Preserve a standalone Test's meaningful site/detail as 12 px/400 muted subtext when it is necessary to interpret that result.

## Result states

- Normal results use the standard text color and weight 400.
- For abnormal results, color both the Test name and the current result with the danger token; keep their normal weights.
- Show `H`, `L`, or `Critical` in the final sticky `แปลผล` column when supplied by the authoritative result contract. Never infer these flags from a displayed reference range in the client.
- When the authoritative result contract supplies `H` or `L`, place a compact direction glyph immediately after the current value/unit: `H` maps to `↑` and `L` maps to `↓`. Keep the final `H`/`L` flag column for explicit interpretation. Do not infer direction from the displayed reference range, and do not invent a direction for `Critical` unless the contract supplies separate high/low direction metadata.
- Status chips retain text and semantic color: `Final` uses success; `Partial result` and pending states use warning.
- Pending MLab text such as `รอผลจาก MLab` is one muted text line, not a badge.

## Narrative MLab results

- MLab/narrative results have no normal-range column.
- Preserve source line breaks.
- Clamp long current and previous narrative text to two lines in the table.
- Hover and keyboard focus reveal the complete text in a tooltip.
- The tooltip is supplemental; essential status and availability must remain readable without hover.

## Sensitive results, report and attachments

- A locked sensitive result shows a compact neutral bordered control whose visible label is exactly `ยืนยันดูผล`. Keep the fuller disclosure purpose in `aria-label`/`title` rather than truncating a long visible label.
- Do not show explanatory helper copy such as “ผลปกปิดตามสิทธิ์” in the compact table.
- Invoke the verified host re-authentication contract for the exact Order/Result Item/occurrence and requested current-or-history scope. On success, reveal the authorized value inline in the same cell. Do not open a central result popup. Authorization, audit logging, timeout and returned disclosure payload remain backend contracts; the client must not infer or broaden them.
- In V2 and V4, `รายงานผล` targets the Order's authoritative LAB report PDF and opens it in the product's established PDF viewer/new-tab flow. Do not route it to the former centered full-result modal. A local mockup may link to an explicitly synthetic sample PDF, but production report identity, authorization, and URL lifetime require verified contracts.
- Render each attachment as its own full-width row after the result rows. Show a neutral file label/name plus supplied type and size; the row may link directly to the file or the product's file viewer. Do not require a separate attachment-list popup before the user can identify the files.
- Attachment rows remain visible when the Order's result rows are collapsed. Production open/download behavior, authorization, storage URL lifetime, malware scanning, and audit requirements remain backend/security contracts and must not be invented in the UI.
- Do not use browser-native alert/confirm UI for reports, attachments, or sensitive disclosure. The host re-authentication UI must return focus to the triggering cell on cancel/failure and move focus to the revealed inline result on success.

## Order collapse and expansion

- Every Order block has a compact chevron toggle immediately after `รายงานผล` in the Order-heading action group.
- All Orders are expanded by default on initial load.
- Activating the toggle hides or reveals that Order's entire comparison region: both its column-heading row and Profile/Test result rows. Keep only the Order heading with summary/status/`รายงานผล`/collapse control and all attachment rows visible while collapsed.
- Use a real button with a visible focus state, `aria-expanded`, `aria-controls`, and an accessible label that changes between `ยุบผลตรวจ` and `กางผลตรวจ`.
- Use a down chevron for expanded and a right chevron for collapsed. Do not use color alone to communicate the state.
- Collapsing one Order must not change any other Order. Re-rendering a filter may preserve the local per-Order state, but a fresh page load starts with every Order expanded.

## Filters, themes, and responsive behavior

- Include `ทั้งหมด` plus room/section filters. Combined operational categories may group multiple codes while keeping their codes visible as secondary filter metadata.
- Support light and dark theme tokens with identical hierarchy, spacing, and semantic meaning.
- Do not expose V2/V4 or Light/Dark selectors in production. They are comparison/QA controls in the canonical mockup only.
- Build one responsive component: the V2 fixture represents an approximately half-width embedding near 650–820 px, and the V4 fixture represents the same component using the available full width.
- Let selected history columns widen only the inner comparison grid. At narrow/zoomed widths, responsively reduce sticky-column widths before they collide while retaining a visible history corridor and the confirmed text size. Inherit Light/Dark values from the host theme rather than maintaining a component-level theme switch.
- On a narrow host surface, allow the component shell to expand to available width while preserving the table's internal minimum width.

## Accessibility and implementation checks

- Use real controls for room/history filters and sensitive disclosure. Use a real link for `รายงานผล` and for an attachment row when the destination is a document URL. Mockup-only theme/version controls do not ship.
- Verify each Order's independent collapse/expand control in the Order heading, default-expanded state, chevron direction, and accessible state/name.
- Give the history-count select an associated visible label and verify 1/5/10 by pointer and keyboard. Give the VN trigger `aria-expanded`/`aria-controls`, expose each option as a labelled checkbox, and give every selected-summary `×` an accessible name containing the VN and visit date. Verify unrestricted multi-selection across all available options, selected-summary growth without an internal scrollbar, checkbox deselection, selected-summary removal without closing, focus continuity after removal, cancel, clear, apply, newest-first ordering and missing-value placeholders. Confirm the rendered history-column count, continuous non-snapping scroll at fractional-column offsets, and sticky behavior in both count and VN-selection modes.
- Implement filter tabs with tab semantics and left/right keyboard navigation.
- Tooltips must work on hover and focus; hide them on blur, scroll, and resize.
- Keep visible focus indicators.
- Pair state color with visible text. Color is never the only state carrier.
- Verify host Light/Dark themes, half-width and full-width containers, narrow/zoomed hosts, all/individual filters, Profile/standalone/multi-site Tests, long narrative text, comments, missing values, 1/5/10 previous-result columns and timestamps, sticky columns, the history-only slim scrollbar when overflow exists, scrollbar omission when it does not, abnormal flags, partial/pending status, inline sensitive disclosure, direct report-PDF navigation, the hidden comparison region plus persistent filename-only attachment rows while collapsed, and conditional attachment visibility.
