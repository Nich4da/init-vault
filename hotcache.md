---
type: meta
title: Hot Cache
updated: 2026-08-25
---

# 🔥 Hot Cache — read me first

> Fast-path snapshot of recent work (~500 words max). A cache, **not** source of truth —
> if this disagrees with a page, the page wins ([[CLAUDE]] §7).

**Domain:** [[initcraft|initCraft / SDForm]] + its real app **[[his|HIS]]** (สถาบันสุขภาพเด็กฯ).
User = developer, Thai, wants step-by-step + real-data verification, **replies must be in Thai**.
**Counts:** 24 sources · 8 entities · 30 concepts · 4 syntheses. **As of:** 2026-08-24.

## 🆕 ล่าสุด 2026-08-24 — HIS ↔ LISconnect flow deck (ไม่ใช่งาน wiki, เป็นงานออกแบบผัง)
`HIS/draw_design/request_reciece_agents_flow.drawio` เดิม 4 หน้า → **12 หน้า** แล้ว:
9 หน้าใหม่ (Overview · Receive Flow · Order Submit Flow · Order Payload · Result Callback ·
Status Lifecycle · Field Mapping · Errors & Edge Cases · Open Questions) + `Raw · Screenshots`
(หน้าสเก็ตช์เดิม 15 screenshot ยังครบ) + `(v1)` 2 หน้าของรอบก่อนที่ถูกแทนที่
- **ดีไซน์ลอกจาก** ผัง "FA V2 · ห้องการเงิน" ที่ผู้ใช้ให้ลิงก์ Google Drive มา (public ดึงได้):
  `light-dark()` ทุกสี · แถบหัว `#647687` · การ์ด 12px + คำอธิบาย 10px · swimlane · แถบ
  "ทางที่ไม่ใช่ทางหลัก" · LEGEND ท้ายหน้า · เขียว=ของเดิม ฟ้า=มีแล้ว ม่วง=ต้องสร้าง แดง=ห้ามพัง เหลือง=รอเคาะ
- **สร้างด้วย generator Python + renderer ตรวจ layout เป็นภาพ** (อยู่ใน scratchpad ยังไม่เก็บเข้า repo —
  ถ้าจะแก้ผังอีก ควรกู้/เขียนใหม่แทนแก้ XML มือ)
- 🔴 **`/Users/nichada/Documents/LIS/` อยู่นอก vault และยังไม่ได้ ingest** — `his-order-submit-spec.md`
  (68 KB, 2026-08-23) + `his-order-sample.json` + `his-result-sample.json` เป็นสัญญาจริงกับทีม LISconnect

## 🔑 ข้อเท็จจริงจากสเปค LIS (ใช้ได้เลย ไม่ต้องเปิดไฟล์ซ้ำ)
- เส้นเดียว `POST {AGENT_URL}/api/orders` + `X-Agent-Key` · ตอบทันทีที่ commit ไม่รอไฟล์ถึงแล็บ ·
  202 queued / **200 duplicate = สำเร็จ** (unique constraint กันใบซ้ำให้เอง)
- **`labno` — เคาะแล้วว่า HIS เป็นผู้ออก** รูปแบบ `{ปีพ.ศ.2}{MM}{DD}{ลำดับ4}` · เป็นกุญแจดอกเดียวที่ผูกผลกลับใบสั่ง ·
  กลับมาในชื่อ `filler_order_no`
- ต้องเพิ่ม field: **14 ระดับใบสั่ง + 3 ใน items[]** (rax-file) + **8 ของ mLab** (endpoint ยังปิด) — ฝั่งเขาต่อรอครบ 25 แล้ว
- 🔴 **เวลาต้องเป็นเวลาไทย** (เขาอ่านตัวเลขตามที่เห็น ไม่แปลงโซน) · 🔴 **ไฟล์เป็น TIS-620** อักขระนอกชุด = ทั้งใบเข้า DLQ
- `hl7_status` **12 ค่า** ต้องเก็บสำเนาเต็ม ห้าม map: new/queued/sending/sent/in_progress/resulted +
  🆕 stalled/failed + 🆕 cancel_requested/cancelled/cancel_rejected (+ awaiting_result/ack_err สงวนไว้)
- ขารับผล: `hl7_result_upsert` + `hl7_order_status_sync` (**คนละ pid**) · **`result_uid` = กุญแจกันซ้ำ ต้อง upsert** ·
  เก็บ append ห้ามทับ (`receipt_seq` ≠ `result_version`) · **critical HIS ประเมินเอง** เขาส่งแค่เกณฑ์ดิบ
- ⏳ ยังบล็อก UAT: `PV1-28/29` แปลว่าอะไร · `LABO`/`ORC-20`/`OBR-11` คงที่จริงไหม · รูปแบบ `NTE-3` ·
  mLab `priority:"A"` → N หรือ S · และฝั่ง HIS ยังไม่ส่ง `baseUrl` · pid ×2 · JWT

## 🔨 งานเดิมที่ยังค้าง
- **[[his-medical-record-report]]** — ชิปแล้ว 08-18 เหลือบั๊ก `{{prename_text}}` โชว์เป็น tag ดิบใน widget/แอปจริง
  (ยังไม่ทดสอบวิธีแก้: deselect/reselect รายงานใน dropdown ของ widget)
- **LAB Workbench** (build จริงอยู่นอก vault ที่ `~/Documents/codex-backup/`) เริ่มที่ [[his-lab-workbench-handoff]] ·
  Biochemistry เป็น section เดียวที่ lifecycle ครบ · [[his-lab-center-specimen-hub]] ยังมีบั๊ก zero-row
- **Clinic Master** [[his-clinic-master-handoff]] — ฟอร์มมี แต่ยังไม่มี logic/event, P0–P2 ค้าง
- อื่น ๆ: drug-label printing · [[pis|PIS]] เริ่มแล้ว · [[open-design]] (โดเมนที่ 2) · [[report-latex]] พัก (server ไม่มี Tectonic/Sarabun)

## 🎓 กฎแพลตฟอร์มที่ต้องจำ
- 🔴 **SDForm import: canvas ว่างแต่ Tree View ขึ้นครบ = มี 4 สาเหตุ ต้องผ่านครบ**
  (ก) `options` ครบชุดตามแม่แบบ · (ข) มี container ห่อ + ลูกอยู่ใน **`.fields` ไม่ใช่ `.widgetList`** ·
  (ค) ห้ามใส่ `key` ให้ component ที่แม่แบบไม่เคยใส่ (`list-ui`) · (ง) **ห้ามแต่งค่า presentation เอง**
  (`labelIconClass:"el-paperclip"` ทำให้ file-upload ไม่ render) แก้ได้เฉพาะค่าข้อมูล
  **หลักการเดียว: ก๊อป widget จากฟอร์มที่ระบบ export มา แล้วแก้ให้น้อยที่สุด อย่าเติมให้ครบกว่าแม่แบบ**
- 🔴 **การยืนยันว่า "ขึ้นแล้ว" ต้องเป็นภาพหลัง import ที่ไม่คลิกอะไรเลย** (Property = Form Setting) —
  คลิก widget ทำให้ canvas re-render แล้วดูเหมือนหาย ⚠️ เคยสรุปผิดเพราะเรื่องนี้ 2 ครั้ง
  📌 กฎเต็ม + validator: `~/Documents/codex-backup/SDFORM_JSON_RULES.md` · `check_sdform_json.py`
  (exit 0 ก่อนส่งเสมอ) · **เคสค้าง `list-ui` ยัง render ไม่ได้ → `HANDOFF_SDFORM_LIST_UI.md`**
- **SQL Factory เก็บ JOIN สองที่** — `sql_join` (แสดง) vs `sql_options.join` (ที่รันจริง) แก้ไม่ครบ = เงียบ 0 แถว
- ใช้ได้: `CASE`/`IFNULL`/`CONVERT`/`SIZE_OF_ARRAY`/`CONCAT`/`ARRAY_ELEM_AT`/`PARSE_JSON` · **`RIGHT` พัง**
- **บันทึกรายงาน ≠ ขึ้นจริง** — Report Factory → widget "Report Items" → **App Factory publish** → แอป
- `zdata_person.legacy.*` = snapshot HOSXP เก่า มีเฉพาะคนไข้ ~94k คนก่อนขึ้นระบบใหม่
- [[his-data-model]]: `zdata_visit`↔`zdata_person` ผ่าน `pid.value` (≡ `xparentx`) · ↔`zdata_visit_tran` ผ่าน `vid.value`
- 🔐 ห้ามวาง DB URI/credential ในแชท (เคยหลุดมาแล้ว 2 ครั้ง) · `mongo-his` MCP ใช้งานได้จริง
- MCP/extension ที่เพิ่งต่อ **ไม่โหลดเข้า session ที่รันอยู่** ต้อง restart ก่อน
