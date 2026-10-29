---
type: design-contract
title: EMR History LAB Results Design Contract
created: 2026-10-26
updated: 2026-10-26
status: approved-for-local-implementation
---

# EMR History LAB Results Design Contract

> Production clarification (2026-10-26): ship one responsive component. The visible `V2/V4` and `Light/Dark` selectors remain mockup/QA controls only and must not appear to clinicians. Production inherits the host theme and selects its geometry from the actual container width. Sensitive re-authentication reveals the authorized result inline in the triggering cell; the former central result popup is not part of production.

## Goal and target artifact

สร้างตารางประวัติผล LAB สำหรับแพทย์ใน EMR ที่อ่านเปรียบเทียบผลครั้งนี้กับครั้งก่อนได้เร็ว รองรับผลตัวเลข ผล narrative จาก MLab, Profile, Test เดี่ยว, หลายตำแหน่ง, comment, sensitive result และทุกห้อง LAB โดยยังคงความหนาแน่นและภาษาภาพของ EMR v2

Audience: แพทย์ผู้เปิดประวัติผล, product owner, frontend/Form Factory implementer, API adapter implementer, QA และ coding agent ที่รับช่วงต่อ

Target artifacts:

- local interactive HTML mockup
- EMR History LAB result component
- Form Factory/SDForm implementation package เมื่อ ownership และ delivery mode ได้รับการยืนยันแยกต่างหาก

## Evidence

| Evidence | Confidence | Use |
|---|---|---|
| `02-his/ui/emr-history-mlab-mycology-comparison-mockup.html` | observed local artifact | canonical interaction, spacing, themes, example states |
| User corrections and approvals through 2026-10-26 | provided | binding hierarchy, wording, Profile logic, time/date/comment placement |
| `02-initcraft/skills/emr-v2-ui/references/qsnich-emr-v2-ui.md` | observed live runtime, sanitized | EMR v2/Element Plus visual language and density |
| `02-his/handoff/emr-history-lab-xray-result-data-ui-handoff.md` | observed/read-only analysis | data and integration boundaries; not visual authority |
| Responsive/touch production behavior | inferred/unverified | implementation target requiring runtime verification |

## Keep / Change / Do not copy

| Keep | Change/adapt | Do not copy |
|---|---|---|
| EMR v2 type stack, neutral surfaces, semantic status colors | Bind synthetic data to verified view-model adapter | patient names, identifiers, real results, credentials or screenshots containing PHI |
| Dense Order blocks and table comparison | Replace local modal content with authorized product result view | legacy screen's room-first heading when it does not help the doctor |
| Profile band + indented component Tests | Derive summary and tooltip from real hierarchy | backend or clinical rules inferred from visual output |
| Standard and narrative MLab grids | Map actual status/flags/locks from authoritative contracts | browser-native alert/confirm UI |
| Half-screen embedded target and horizontal overflow | Integrate host theme if EMR already owns the theme | exact surrounding shell or unrelated EMR patient data |
| Light/dark visual parity | Add verified touch alternative for tooltips | duplicated specimen/helper text with no clinical need |

## Final design stance

ใช้ Order เป็นหน่วยการอ่านหลัก และให้ชื่อ Profile/Test เป็นข้อมูลเด่นที่แพทย์ต้องรู้ ภายในตารางใช้ตัวอักษร 13px อย่างสม่ำเสมอ ชื่อ Test หนากว่าผล ส่วนเวลา วันที่ unit และ comment ลดระดับอย่างชัดเจน ผลผิดปกติใช้สีโดยไม่เพิ่มน้ำหนัก MLab ใช้ narrative grid เฉพาะทางแต่ยังคง pattern ตารางเดียวกัน ทั้งหมดต้อง responsive ตั้งแต่พื้นที่ฝังครึ่งจอถึงเต็ม container และเปิดรายละเอียดเสริมผ่าน tooltip เมื่อจำเป็น; Sensitive result ใช้ host re-auth แล้วแสดง inline

## Binding decisions

1. หนึ่ง bordered block เท่ากับหนึ่ง Order
2. ชื่อห้อง LAB ไม่ใช่หัว Order; ห้องเป็น filter metadata
3. หัว Order คือ Test/Profile summary + เวลา `hh:mm AM/PM` ต่อท้ายโดยไม่มี prefix `ผล`
4. เวลาอยู่หัว Order เพียงครั้งเดียว ใช้ 11px/400/muted
5. Summary 13px/500; Test/Profile 13px/600; ผล 13px/400
6. หัว previous โหมดจำนวนครั้งแสดง `D MMM` และ `hh:mm AM/PM` สองบรรทัด; โหมดเลือก VN แสดง `D MMM YY`; ทั้งสองโหมดไม่มีขีดคั่น
7. ค่าที่ไม่มีใช้ `—` อย่างเดียว
8. interpretation column มี visible heading `แปลผล` และ sticky ขวาสุด
9. Profile แสดงครั้งเดียว; children ย่อหน้าเพิ่ม 16px
10. Test เดียวหลายตำแหน่งใช้ Profile pattern
11. Order/Test comments ใช้ 11px/400/muted ใต้เจ้าของข้อมูล
12. MLab ไม่มี normal-range column, clamp 2 บรรทัด และมี full-text tooltip
13. sensitive result ใช้ neutral re-auth button; ไม่แสดง helper sentence ในตาราง
14. `รายงานผล` เปิด PDF report ของ Order โดยตรงในทั้ง V2/V4 ไม่ใช้ Popup “ดูผลทั้งใบ” เดิม
15. default filter คือ `ทั้งหมด`; รองรับทุกหมวดที่ระบุใน spec
16. Light/Dark ใช้ hierarchy และความหมายเดียวกัน
17. Border ของ control ใช้สีเข้มใน semantic family เดียวกับกล่อง ไม่ใช้สีดำเป็นค่า default
18. ทุก Order มี chevron ยุบ–กางต่อจาก `รายงานผล` ในหัว Order และเริ่มต้นกางทั้งหมด
19. การยุบซ่อน comparison region ทั้งหัวคอลัมน์และ result body ของ Order นั้น; หัว Order/actions และไฟล์แนบยังแสดง ส่วน Order อื่นไม่เปลี่ยน
20. Mockup มี V2/V4 segmented control ข้าง Light/Dark และเริ่มต้นที่ V2; V2 เป็นครึ่งจอ ส่วน V4 เป็นเต็มจอ
21. V2 standard numeric grid วาง `ครั้งนี้` และ `ค่าปกติ` ติดกันเป็นคู่ โดยครั้งนี้ชิดขวาและค่าปกติชิดซ้าย; narrative MLab ไม่เปลี่ยน
22. ทั้ง V2/V4 ใช้ลิงก์ `รายงานผล` เหมือนกันและชี้ไป PDF report ของ Order; ชื่อ Order อยู่ใน accessible name/title ไม่อยู่ใน visible label
23. Order ที่มีไฟล์แสดงหนึ่ง full-width row ต่อหนึ่งไฟล์ท้ายตาราง โดยใช้ชื่อไฟล์เป็น primary text ไม่เติม `ไฟล์แนบ N`, ไม่มีปุ่ม `ไฟล์แนบ (N)` และยังเห็น rows เมื่อหุบผลตรวจ; Order ที่ไม่มีไฟล์ไม่สร้าง row
24. ภายใน Order ให้หัว Order (Test/Profile summary + `hh:mm AM/PM` + status/actions) อยู่ก่อนหัวคอลัมน์ แล้วจึงเป็น result rows; ทั้ง V2/V4 ใช้ลำดับเดียวกัน
25. เมื่อ contract ส่ง `H/L` ให้แสดง `↑/↓` ต่อท้ายผลครั้งนี้ และยังคง final flag column; ห้ามคำนวณจากค่าปกติหรือเดาทิศทางของ `Critical`
26. `จำนวนผลก่อนหน้า` มี 1/5/10 ครั้งและสร้าง previous columns ครบตามจำนวน แม้บาง Test ไม่มีค่า; ค่าไม่มีเป็น `—`
27. ลำดับคอลัมน์ standard คือ sticky `รายการ` ซ้าย → previous columns ที่เลื่อนได้ → sticky `ครั้งนี้/ค่าปกติ/แปลผล` ขวา; narrative ไม่มีค่าปกติ
28. historical cell แสดงเฉพาะค่า ไม่ซ้ำ unit; timestamp ในหัวคอลัมน์ต้องมาจาก authoritative occurrence
29. V4 ใช้ alignment ของ V2 แบบเต็มจอ โดยไม่เปลี่ยนข้อมูลหรือ action; V1/V3 ถูกตัดออก
30. ซ่อน native scrollbar เต็มตาราง และใช้ slim accessible scrollbar เฉพาะ history corridor เมื่อ overflow; scrollbar ต้องไม่กินพื้นที่ใต้ sticky columns และต้องเลื่อนได้อิสระแบบต่อเนื่องโดยไม่ snap/auto-align/ดึงกลับ เศษ previous column ระหว่างเลื่อนยอมรับได้แต่ต้องถูก clip ที่ขอบ sticky อย่างสมบูรณ์
31. เมื่อ full-width มีพื้นที่พอและไม่ overflow ให้ omit scrollbar; เมื่อเลือก 10 ครั้งจน overflow ให้แสดงกลับอัตโนมัติ
32. Profile/structural band ต้องเป็นแถบทึบผืนเดียว ไม่มี history divider หรือ separator ที่หยุดตรงขอบ sticky; แยก band จาก result rows ด้วยสีพื้นแทนเศษเส้น grid
32. ลด top/bottom spacing เพื่อเน้นจำนวนผลที่เห็นต่อ viewport โดยคงขนาดตัวอักษรเดิม: standard row 28px, Profile 24px, column header 28px และ Order header 30px; sticky regions ต้องเป็นพื้นทึบต่อเนื่อง อยู่เหนือ และปิดทับ history content เสมอ รวม blank fill ของ Profile row
33. ชื่อไฟล์แนบใช้ muted gray 11px/400 และ attachment row สูงขั้นต่ำ 26px
34. เมื่อ host แคบหรือ browser zoom สูง ต้องลดความกว้าง sticky columns ก่อนชนกันและสงวน history corridor อย่างน้อยหนึ่งคอลัมน์เต็ม โดยคง font size เดิม
35. sticky cells ใน column-heading row ต้อง stretch เต็มความสูงแถวและทึบทั้งช่อง; ห้ามมี uncovered strip ด้านบน/ล่างที่เผย date/time ของ history column
36. grid row ต้องกว้างเท่ากับ column track ที่ overflow จริง และใช้ sticky cells/structural fills โดยตรง ห้ามใช้ row-level sticky pseudo-element shield เพราะอาจเกิดพื้นว่างทับปลาย history corridor ที่ max scroll
37. เพิ่มโหมด `เลือก VN` ข้างจำนวนครั้ง เปิด multi-select dropdown ที่มีเฉพาะ VN ซึ่งมีการสั่ง LAB และไม่จำกัดจำนวนที่เลือก; trigger มีเฉพาะ `เลือก VN` กับ chevron ไม่มี badge/icon ซ้ำ หัวรายการใช้ `Visit ที่มีการสั่ง LAB` และ chevron ของทั้ง count select/VN trigger ต้อง inset จากขอบขวา; แสดง authoritative VN string ตามที่รับมา เช่น `VN6900470` โดยห้ามเติม prefix หรือขีดเอง, วัน/เดือน/ปี, tag `Dx:` จาก authoritative primary diagnosis 1 รายการระหว่าง VN กับวันที่, รายการสั่งแบบย่อ และ badge `ผิดปกติ N รายการ` เฉพาะเมื่อมีค่าผิดปกติ; tag diagnosis ต้องเป็น amber box ที่มีพื้นทึบอ่อน เส้นขอบ 1px มุมโค้งและข้อความ amber ในทั้ง Light/Dark, diagnosis ยาวต้อง ellipsis พร้อมดูเต็มได้เมื่อ hover/focus, ไม่มีข้อมูลให้เว้น tag และห้ามอนุมานจาก LAB; ใต้ options แสดงกล่องสรุป VN + วันที่ย่อของ draft selection ทุกตัว พร้อม `×` ที่มี accessible name สำหรับลบรายตัวโดยไม่ปิด dropdown และต้องอัปเดต checkbox/count; selected-summary wrap/ยืดลงโดยไม่มี max-height หรือ scrollbar ของตัวเอง ส่วน option list มี scroll ได้; ปุ่ม apply ใช้ visible label `เลือก`; clear/cancel/apply ต้องทำงานและ Apply ใช้ VN ชุดเดียวกันทุก Order เรียงล่าสุดก่อน โดยผลที่ไม่มีใน VN นั้นแสดง `—`
38. Production ไม่แสดง V2/V4 หรือ Light/Dark control; V2/V4 เป็นเพียง QA width fixtures ของ responsive component เดียว และ theme มาจาก host
39. Sensitive re-auth สำเร็จแล้วแทน control ด้วยค่าที่ได้รับอนุญาตใน cell เดิม; ไม่มี central full-result popup. Current และ historical occurrence เป็นคนละ authorization scope และต้อง fail closed เมื่อ backend ยังไม่รองรับ

## Risks and explicit unknowns

- Mockup ยังไม่ใช่ Builder/Preview/deployed-runtime evidence
- API อาจยังไม่ส่ง Profile hierarchy, comment level, explicit interpretation, previous-result linkage หรือ sensitive state ครบ
- การเลือก previous result อาจต้องใช้ Test code, specimen/site และ version/correction rules ที่ยังไม่ยืนยัน
- Critical และ sensitive permission ห้ามอนุมานจากค่าหรือชื่อ Test
- Touch tooltip, screen reader announcements และ print layout ยังไม่ได้ทดสอบใน runtime จริง
- Ownership ของ live EMR/Form/API/Report/SQL ไม่ได้อนุญาตให้แก้จากเอกสารนี้

## Quality gate

- [x] Target surface และ audience ชัดเจน
- [x] Evidence แยก observed/provided/inferred
- [x] Keep/change/do-not-copy ชัดเจน
- [x] เลือก visual direction เดียว
- [x] มี palette, typography, spacing, grid และ component rules ที่ระบุค่าได้
- [x] มี responsive, interaction และ accessibility requirements
- [x] มี anti-patterns แบบตรวจได้
- [x] มี coding data contract และ test matrix
- [x] Local browser ยืนยัน Light/Dark, independent collapse, V2 ครึ่งจอ, V4 เต็มจอ, narrow host 472px, 1/5/10 history counts, responsive sticky columns แบบ opaque ต่อเนื่อง, free-scroll โดยไม่ snap, current-reference pairing, slim history-only scrollbar เมื่อ overflow และการ omit เมื่อไม่ overflow, direct `รายงานผล`, filename-first attachments และการหุบทั้ง comparison region
- [ ] API/view-model mapping ผ่าน review
- [ ] Local implementation ผ่าน automated checks และ visual review
- [ ] Form Factory implementation ผ่าน static validator
- [ ] Builder/Preview/runtime behavior ได้รับการตรวจใน environment ที่ได้รับอนุญาต
- [ ] Sensitive-result flow ผ่าน security/permission/audit review

