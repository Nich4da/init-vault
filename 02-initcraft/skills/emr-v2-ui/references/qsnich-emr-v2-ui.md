# QSNICH EMR v2 UI reference

## Provenance and confidence

- Observed read-only in the authenticated HIS runtime on 2026-10-24 (Asia/Bangkok).
- Surface label: `EMR v2`; runtime route: `/module/app-viewer?appId=6ada0c689291822e416c2220`.
- Desktop observation: 1470 × 779 CSS px, device pixel ratio 2.
- No screenshots are packaged because the live screen contained medical and identifying data.
- Facts below marked **Observed** came from the visible runtime. Items marked **Inferred** are design conclusions, not confirmed requirements.
- The embedded full-record view identifies itself as `EMR History v1`; do not treat that legacy view as the primary v2 shell.

## Information architecture

### Application shell

**Observed**

- A persistent 64 px left navigation rail and an approximately 60 px top application bar frame the workspace.
- The EMR area begins with a title and four top-level tabs: `Unit Queue`, `My Room`, `EMR`, and `Completed`.
- The top bar retains the active clinic/room context. Content below it is scoped to that operational context.

### Unit Queue

**Observed**

- A full-width list card headed `ผู้ป่วยรอเข้าห้องตรวจ` with an explicit count.
- Empty state is a quiet single-line `หมดรายการ`, leaving the list structure visible.

### My Room

**Observed**

- A split toolbar places `เรียกคิวถัดไป` at the left and `Check-in` at the right.
- The room list is headed `ผู้ป่วยรอตรวจ` with a count.
- Each row groups queue number, elapsed time, visit state, patient identity, demographic summary, room, coverage, allergy flag, CC/diagnosis, and note.
- Row actions include history-taking, opening EMR, skip/recall, move room, and refer. These are clinical actions, not inspection controls.
- The active row uses a pale blue surface and a stronger left accent.

### Completed

**Observed**

- A full-width list headed `ผู้ป่วยที่ตรวจเสร็จ/ส่งต่อแล้ว`, followed by search and refresh controls.
- Completed rows reuse the room-list information architecture but replace the active status with a completion state.

## EMR workspace

### Patient header

**Observed**

- The patient summary is a full-width card above the working columns.
- Left-to-right hierarchy: avatar; name and identifiers; age/sex/blood group; visit and coverage chips; visit time; anthropometrics; vital-sign cards; utility actions; elapsed exam timer.
- Vital values use compact individual cards. Abnormal values use semantic danger or warning surfaces, not a separate chart.
- Secondary actions include growth chart, vital trend, OPD card print, all-visit history, vaccination book, and fullscreen.
- A full-width light-red band directly below the main header holds allergy severity and allergen. Vaccine overdue/recommendation counts sit on the same alert row.

### Main grid

**Observed**

- Desktop layout uses a 24-column grid with approximate spans `6 / 11 / 7`: prior history / clinical note / current-visit orders and costs.
- Gutters visually separate three independently scrollable or tall work zones while keeping the patient header anchored above them.
- The runtime classes include `el-col-xs-24`, suggesting stacked narrow-screen intent. **Inferred:** mobile stacking exists, but it was not runtime-tested.

### Left column: longitudinal context

**Observed**

- A compact PMH summary card precedes the main history card.
- History card tabs are `ประวัติครั้งก่อน` and `ทะเบียนโรค`; a collapse control can reduce the rail.
- Prior-visit view shows date, VN, clinic, a `ดูทั้งใบ` action, clinic-selection checkboxes, latest CC/HPI/PE/diagnosis, and secondary tabs for medicine, Lab, X-Ray, and procedures.
- Empty secondary tabs use explicit messages such as no prior X-ray or no procedure rather than disappearing.
- Disease Registry shows disease name, occurrence count, current-visit state, previous date, and a compact status timeline.
- `ดูทั้งใบ` opens the embedded `EMR History v1` view. `ประวัติการรักษาทุกครั้ง` opens a wider patient-history drawer with a chronological visit timeline and expandable visit details.

### Center column: clinical documentation

**Observed**

- The toolbar leads with a high-emphasis green `บันทึกการตรวจรักษา` button and a clinic selector/count for today's visit.
- SOAP information is divided into readable sections: S/Subjective, O/Objective, A/Assessment, Consult, and P/Plan.
- Current-clinic gaps present `ยังไม่บันทึก` plus a nearby `+ เพิ่ม`; saved content carries author and time.
- Content from another clinic is labeled with its clinic, ownership, and `อ่านอย่างเดียว` state.
- Clinic-specific subforms appear inline between SOAP sections.
- Three density controls govern other-clinic sheets:
  - `ย่อ`: condenses other-clinic content to a short one-line summary.
  - `เต็ม`: restores full readable detail.
  - `ซ่อน`: hides other-clinic sheets and leaves explicit hidden-item counts in relevant sections.

### Right column: current-visit work

**Observed**

- Tabs are `ยา`, `สั่งตรวจ`, `วัคซีน`, and `นัด`; count badges appear only where items exist.
- Order cards are grouped by owning clinic and explicitly mark other-clinic ownership.
- Each order summary includes order number, item count and type counts, status, time, coverage class, total, reimbursable amount, and patient-pay amount.
- Item rows retain type labels (`Lab`, `X-ray`, etc.), item name, quantity, and price.
- Edit/send/cancel authority is explained in-line; cross-clinic orders are read-only.
- Empty tabs keep their command surface visible: an empty message, contextual add button, and reload action.
- Vaccine UI separates required schedule items from risk-based recommendations, surfaces contraindication warnings, labels overdue/optional state, and keeps the dispatch-to-nurse action visually distinct.
- A cost card below the tabs summarizes the visit by clinic and separates total, reimbursable, and payable values. Cancelled orders are excluded explicitly.

### Bottom action bar and supporting cards

**Observed**

- The bottom bar keeps `ผลตรวจวันนี้` and visit-disposition actions close to the workspace: medical certificate, refer, admit, complete, move room, custom transfer, automatic transfer, and combined complete+transfer.
- Disposition buttons use outline styles; the combined terminal action receives the strongest green fill.
- A separate Refer Out card records outbound transfer state and has its own reload action.

## Drawers and progressive disclosure

### Results today

**Observed**

- `ผลตรวจวันนี้` opens a right-side drawer scoped to the current VN and all clinics in the visit.
- Lab and X-Ray are separate tabs with counts.
- Each item uses a compact stage rail with textual milestones. Lab showed order → specimen receipt → result; X-Ray showed order → imaging → interpretation.
- A footer points the user to the left history rail for results from other visits, preventing current and historical scope from blending.

### History views

**Observed**

- The all-visit drawer uses a vertical timeline with month/date grouping, a current-visit marker, visit tags, clinic chips, allergy summary, vitals, and SOAP sections.
- It favors progressive disclosure: collapsed visits stay concise; expanded visits reveal clinic filters and clinical content.
- The embedded full-record view provides previous/next visit navigation, print/reload actions, full clinical sections, source orders, finance summary, and legacy LAB/X-ray result components.

## Visual language

### Foundations

**Observed**

- Element Plus base font stack: `Helvetica Neue`, Helvetica, `PingFang SC`, `Hiragino Sans GB`, `Microsoft YaHei`, Arial, sans-serif.
- Base size is 14 px; compact labels and chips are approximately 12–12.5 px.
- Main text `#303133`; regular text `#606266`; muted text `#909399`; lighter metadata `#a8abb2`.
- Element Plus semantic colors remain visible: primary `#409eff`, success `#67c23a`, warning `#e6a23c`, danger `#f56c6c`, info `#909399`.
- A secondary indigo accent appears frequently around `#626aef`; clinical green text appears near `#126c41`.
- Common surfaces: white; soft gray `#f5f7fa`/`#fafafa`; danger tint `#fef0f0`; success tints around `#e2f3e9` and `#e2f3f0`; warning tint `#fdf6ec`.

### Shape and density

**Observed**

- Base Element Plus controls use 4 px radius; identity chips use about 6 px; vital cards use about 10 px; major history/order cards reach about 12 px.
- Patient-header body padding is approximately 16 px vertical and 22 px horizontal.
- Shadows are subtle and shallow, used to separate large cards rather than every row.
- The design is dense but grouped: information is compressed with chips, tabs, hairline dividers, and short metadata lines instead of large empty spacing.
- Icons precede labels but do not replace the label for important actions.

## Reproduction rules

- Keep the patient header and allergy band visually inseparable; safety alerts must remain visible when the body columns change mode.
- Preserve the desktop `6 / 11 / 7` hierarchy unless the task has an explicit reason to reprioritize a surface.
- Keep current-visit actions on the right and longitudinal context on the left. Do not mix historical orders into the current-visit order card.
- Show clinic ownership and read-only state directly on the card or row, not only in a tooltip.
- Pair every count badge with a label and every state color with text.
- Use explicit empty, loading, disabled, and permission-denied states. Do not hide an entire functional area merely because its collection is empty.
- Keep terminal clinical actions separated from content-edit actions and use the strongest emphasis only for the intended terminal action.
- When reproducing the UI, substitute obvious synthetic data such as `HN0000000`, `VN0000000`, generic clinic names, and non-clinical placeholder text.

## Known limitations

- The live Form Factory model was later exported read-only and documented separately in [qsnich-emr-v2-form-model.md](qsnich-emr-v2-form-model.md). That export proves client-side structure and embedded scripts, not server implementation, permission correctness, or clinical-policy validity.
- Narrow-screen behavior, keyboard navigation, screen-reader announcements, and print layout were not verified.
- The patient-history and full-record views are separate embedded surfaces and may evolve independently from the EMR v2 shell.
