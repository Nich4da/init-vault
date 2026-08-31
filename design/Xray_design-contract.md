# X-ray Design Contract — Decision Record

Updated: 2026-08-31 (รอบแก้ที่ 4 ตาม feedback ผู้ใช้)

## Goal and target artifact

สร้าง contract ที่นำไป implement ได้จริงสำหรับหน่วยงาน X-ray โดยยกระบบภาพและ workflow ของ LAB
มาทั้งชุด และเปลี่ยนเฉพาะสิ่งที่ต่างจริงตามธรรมชาติของงานรังสี

Audience: product owner, initCraft Form Builder implementer, API/Agent implementer, QA และ coding agent รอบถัดไป

Target artifacts:

- X-ray Workbench SDForm ที่ `Form-Builder/SDForm/X-ray/` (สร้างโฟลเดอร์แล้ว 2026-08-31 พร้อม `design.md` + `spec.md`)
- `xray-cpoe-worklist` read API
- `xray-cpoe-dispatch` API (รับ + ส่งเข้าเครื่อง)
- ช่องทางส่ง Agent ของ X-ray (ดู D-X3)
- Result viewer สำหรับผลอ่าน (findings / impression)

## Evidence

| Evidence | Confidence | Use |
|---|---|---|
| `02-his/ui/xray-workbench-mockup.html` | observed | หน้าต้นแบบที่สร้างในรอบนี้ ตรวจด้วย headless Chrome แล้ว |
| `design/Lab_design.md` | observed | ต้นฉบับระบบภาพ/spacing/component/anti-pattern ที่ยกมาทั้งชุด |
| `design/lab-cpoe-integration-checklist.md` | observed | สถาปัตยกรรมอ่านตรงจาก CPOE และข้อตกลงที่ยืนยันแล้ว |
| `Form-Builder/API/api-factory/processes/lab_cpoe_worklist_api.js` | observed | โครง query/join/group และ fail-closed scope ที่นำมาปรับใช้ |
| `Form-Builder/API/api-factory/processes/lab_agent_order_submit_api.js` | observed | Agent payload allowlist ที่พิสูจน์ว่า X-ray ส่งผ่านตามสภาพปัจจุบันไม่ได้ |
| `Form-Builder/SDForm/sdform_module/EMR_form/section.json` | observed | มี `modality_type` 11 ค่า ใช้เทียบกับรายการ 19 ค่าที่ผู้ใช้ให้ |
| `Form-Builder/SDForm/sdform_module/EMR_form/CPOE_app.json` | observed | ยืนยัน service type `xray` และ mode `sheet` ในจอสั่ง |
| `02-his/draw_design/request_reciece_agents_flow.drawio` | observed | มีป้าย `item_type(Lab / Xray)` ในหน้า Order Payload |
| รายการเครื่อง 19 ค่าจากผู้ใช้ 2026-08-31 | provided | รายการที่ dropdown ต้องแสดงใน v1 |
| draw.io ของกรอบงาน X-ray (ลิงก์ที่ผู้ใช้ส่ง) | **not read** | เป็นไฟล์บน Google Drive หลัง `#G…` ดึงเนื้อหาไม่ได้ ต้องให้ผู้ใช้ export เข้ามาในรีโป |

## Keep / Change / Do not copy

| Keep จาก LAB | Change/adapt | Do not copy |
|---|---|---|
| Token สี ตัวอักษร ระยะ ขนาด component motion ทั้งชุด | คอลัมน์ที่ 5 จาก specimen → เครื่อง | คอลัมน์ specimen และ Lab No. |
| One-page worklist ที่ขยาย Order ได้ | toolbar เพิ่ม dropdown เครื่องเป็นคอลัมน์ที่ 3 | combobox specimen และด่านตรวจ specimen ก่อนรับ |
| Filter chip 4 ตัวและกฎการนับจากข้อมูลจริง | label chip เป็น `รอรับ / รอผลอ่าน` | ตัวเลข chip ที่ไม่คิดตัวกรองเครื่อง |
| การยกเลิกทั้งใบแบบ atomic | **1 order = 1 accession = 1 test** (LAB คือ 1 order หลาย test) | checkbox เลือกราย item และการปฏิเสธราย item |
| — | คอลัมน์จำนวนรายการ → ชื่อรายการตรวจ | บรรทัดสรุปจำนวนรายการคั่นก่อนตาราง |
| คอลัมน์ `ปฏิเสธ` / `คนปฏิเสธ` ท้ายตาราง test แบบ LAB | ปุ่มท้ายแถวรวมเป็นคอลัมน์เดียว เรียงต่อกัน | คอลัมน์ว่างที่ใส่ `–` แทนปุ่มที่ไม่มี และ popup รายละเอียดการยกเลิก |
| — | เพิ่มสถานะ `ส่งเครื่องไม่สำเร็จ` ที่ไม่ rollback การรับ | การรวม transport failure เข้ากับการยกเลิก |
| Order เป็นหน่วยแสดงผล / Item เป็นหน่วยทำงาน | ผลเป็น document (findings/impression) ไม่ใช่ตารางค่า | ตารางค่าเชิงตัวเลข unit reference range critical ของ LAB |
| fail-closed organization scope ฝั่ง server | เพิ่ม dropdown เครื่องเป็นตัวกรอง **การแสดงผล** | การใช้ dropdown เป็นตัวให้สิทธิ์ |
| in-page dialog สำหรับทุก action ที่มีผลทางคลินิก | ปุ่ม `รับ specimen` → `ส่งเข้าเครื่อง` | native confirm/alert |
| กฎ Date Range และ exact HN history | แกนเวลาเป็น เวลาส่งเครื่อง แทน เวลารับ specimen | เวลาเก็บ specimen |

## Final design stance

หน้า X-ray คือหน้า LAB เดิมที่ถอด specimen/Lab No. ออก แล้วใส่แกน "เครื่อง" เข้าไปแทน
ผู้ใช้ที่ทำงานสองห้องต้องรู้สึกว่าเป็นระบบเดียวกัน ความต่างที่เห็นได้ควรมีเฉพาะสิ่งที่ต่างจริงในงาน
ไม่ใช่ความต่างจากการออกแบบใหม่โดยไม่จำเป็น การรับรายการเป็นการกระทำเดียวที่รวม "รับ" กับ
"ส่งเข้าเครื่อง" ไว้ด้วยกัน และความล้มเหลวของการส่งต้องไม่ลบล้างการรับ

## Risks and explicit unknowns

1. **Agent contract ปัจจุบันรับ X-ray ไม่ได้** — `ROOT_REQUIRED` บังคับ `labno` และ `ITEM_REQUIRED`
   บังคับ `specimen_code`/`collected_at` พร้อม allowlist ที่ตีกลับ field แปลกปลอม และไม่มี key
   สำหรับเครื่อง/modality เลย (ดู D-X3) ห้ามแก้ด้วยการยัดค่าปลอม
2. **รายการเครื่อง 19 ค่ายังไม่มีที่มาที่ยืนยัน** — ไม่ตรงกับ `modality_type` (11 ค่า) ตรงกัน 8 ค่า
   `MRI` vs `MR` ไม่ตรง และอีก 10 ค่าไม่มีใน master (ดู D-X2)
3. ~~เลขอ้างอิงส่งตรวจ~~ **เคาะแล้ว 2026-08-31: มีเลขสองชุดแยกกัน — `Order No.` จาก CPOE และ
   `Accession No.` ที่ห้องรังสีออกเองระดับ test โดย running นับแยกตาม modality และแยกตามวัน
   (ดู Appendix F ของ `Xray_design.md`)** เหลือ D-X12 (เต็ม 999), D-X14 (code เครื่องจริง),
   D-X15 (ความยาวไม่คงที่) และ D-X16 (ตัวพิมพ์ของ code)
4. **รหัสส่งตรวจขาออกของ X-ray ยังไม่ยืนยัน** — LAB ใช้ `master.lab_item.his_lab_code`
   ของ X-ray ยังไม่รู้ชื่อ field (D-X4)
5. **ไม่ได้อ่าน draw.io ของผู้ใช้** — เอกสารนี้จึงอ้างอิงจาก mockup LAB + CPOE + Agent code เท่านั้น
   เมื่อได้ diagram ต้องเทียบกับ `Xray_design.md` ก่อน implement
6. **โครงสร้างผลอ่านยังเป็นสมมติฐาน** — mockup ใช้ findings/impression/ผู้อ่านผล ต้องยืนยันกับ contract จริง (D-X6)
7. **ยังไม่รู้ว่า X-ray มีชุดแม่-ลูกหรือไม่** เหมือน `sub_order`/`lab_parent` ของ LAB (D-X5)
8. mockup เป็น prototype — EMR, PDF, Report, สร้างรายการใหม่ และ **`ดูภาพ` (RIS)** ยังไม่ได้ต่อ
   integration จริง ปุ่ม `ดูภาพ` ต้องได้ contract ของ RIS/PACS ก่อน (D-X17)

## Quality gate

- [x] Target artifact และ audience ชัดเจน
- [x] Evidence แยกเป็น observed / provided / not read
- [x] ขอบเขต keep / change / do-not-copy ชัดเจน
- [x] เลือกทิศทางภาพเดียว (ยกจาก LAB ทั้งชุด)
- [x] Binding color/typography/spacing/dimension ระบุครบใน `Xray_design.md`
- [x] Responsive และ accessibility ระบุแล้ว
- [x] Anti-pattern ระบุชัด
- [x] แยก business rule ออกจาก open decision
- [x] มีหน้าต้นแบบที่ render ได้จริงและตรวจแล้ว
- [ ] ผู้ใช้ยืนยันตำแหน่ง dropdown (ปัจจุบันวางหลัง Date Range ก่อนปุ่ม Search)
- [x] ผู้ใช้ยืนยันรูปแบบเลขทั้งสองชุดแล้ว: `20260831011` และ `20260831CT001`
- [ ] เจ้าของงานยืนยัน code เครื่องจริงของ 10 ค่าที่ยังเป็นค่าสมมติ
- [ ] ผู้ใช้/เจ้าของงานเคาะ D-X1 ถึง D-X9 ใน `Xray_design.md`
- [ ] ได้ draw.io ของ X-ray เข้ามาในรีโปและเทียบกับเอกสารนี้แล้ว
- [ ] SDForm ตัวแรกผ่าน static validation และตรวจ Builder/Preview
- [ ] Agent/PACS integration ผ่าน UAT จริงก่อนอ้างว่าพร้อม production
