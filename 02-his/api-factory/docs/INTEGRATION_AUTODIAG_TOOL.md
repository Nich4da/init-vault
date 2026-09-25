---
type: reference
title: LAB and X-ray Integration Auto-Diagnostic Tool
created: 2026-09-23
updated: 2026-09-23
tags: [lab, xray, integration, debugging, testing]
---

# LAB / X-ray Integration Auto-Diagnostic Tool

เครื่องมืออยู่ที่
`Form-Builder/API/tests-tools/scripts/integration_autodiag.js` ใช้ตรวจเส้นทางส่ง Order
และรับ Result ของ LAB/X-ray แบบเดียวกันทั้งหมด พร้อมสรุป `PASS/WARN/FAIL/SKIP`
ราย checkpoint และสร้างรายงาน Markdown + JSON ที่ตัด credential/PHI ออกแล้ว

เครื่องมือนี้ **ไม่แก้ Process เดิมและไม่แตะฐานข้อมูลใน dry-run** ค่าเริ่มต้นไม่ออก network
และ valid payload จะยิงไม่ได้หากไม่มี `--send --confirm-write` ครบทั้งสอง flag

## Flow ที่รองรับ

| Flow | จุดที่ตรวจ | Endpoint/credential env |
|---|---|---|
| `lab-order` | Gateway → `lis.submit` → submit Process → Agent response | `LAB_ORDER_URL`, `LAB_ORDER_API_KEY`, optional `LAB_ORDER_HEADER` |
| `lab-agent` | Mac/VPN → Agent โดยตรง เพื่อแยก network จาก initCraft server | `LAB_AGENT_URL`, `LAB_AGENT_KEY` |
| `lab-result` | Gateway → `lis.receive` → Receipt/Report/Result Item | `LAB_RESULT_URL`, `LAB_RESULT_API_KEY`, optional `LAB_RESULT_HEADER` |
| `xray-dispatch` | CPOE item → Accession → dispatch → RIS ACK | `XRAY_DISPATCH_URL`, `XRAY_DISPATCH_TOKEN` |
| `xray-order` | RIS order bridge โดยตรง เพื่อแยกปัญหา dispatch/bridge | `XRAY_ORDER_URL`, `XRAY_ORDER_TOKEN` |
| `xray-result` | RIS callback → result Process → current/log result | `XRAY_RESULT_URL`, `XRAY_RESULT_TOKEN` |

`LAB_*_HEADER` ค่าเริ่มต้นคือ `x-api-key`; direct Agent ใช้ `X-Agent-Key` ตาม contract.
X-ray ใช้ `Authorization: Bearer` และส่ง query token เพื่อรองรับ public Process รุ่นปัจจุบัน
แต่ URL/token จริงจะไม่ถูกเขียนลงรายงาน

## วิธีใช้ที่ปลอดภัย

เริ่มจาก local validation โดยไม่ออก network:

```bash
node Form-Builder/API/tests-tools/scripts/integration_autodiag.js \
  --flow lab-result \
  --payload Form-Builder/SDForm/api-factory/examples/agent_result_partial.json
```

ทดสอบทางเชื่อมทุก endpoint แบบ **no-write smoke**; payload ว่างถูกส่งโดยตั้งใจและต้องถูก
validation ปฏิเสธก่อนเขียนข้อมูล:

```bash
node Form-Builder/API/tests-tools/scripts/integration_autodiag.js \
  --flow all --smoke --send \
  --report-dir output/integration-autodiag
```

ยิง valid UAT จริงต้องยืนยันสองชั้น:

```bash
node Form-Builder/API/tests-tools/scripts/integration_autodiag.js \
  --flow lab-result \
  --payload Form-Builder/SDForm/api-factory/examples/agent_result_partial.json \
  --send --confirm-write \
  --report-dir output/integration-autodiag
```

ใช้เฉพาะ UAT identity ที่เตรียมไว้ ห้ามเก็บผู้ป่วยจริง ผลจริง token หรือ URL ที่มี token
ใน repository. `order_no`, `LAB NO.`, `result_uid`, `AccessionNo` ที่ปรากฏในรายงานจะถูก
แปลงเป็น SHA-256 fingerprint สั้น ๆ เพื่อเทียบกันได้โดยไม่เปิดเผยค่าจริง

## Payload contract

### LAB order

รับ object ตรงตาม `his-to-agent-order.schema.json`; ถ้าไฟล์มี wrapper `{ "payload": {...} }`
เครื่องมือจะแกะให้เอง ต้องมี `order_no`, `labno`, `hn`, `ordered_at`, `priority`, `sex`
และ `items[]`. แต่ละ item ต้องมี `seq`, `test_code`, `test_name`, `specimen_code`,
`received_at`, `receiver`. หากส่ง `collected_at` ต้องเป็นเวลาไทยที่ถูกต้องและห้ามเป็น `null`.

### LAB result

ตรงตาม `agent-to-his-result-v2.schema.json`; ต้องมี stable order/LAB/visit identity,
`result_uid`, stage/status/sequence, reported identity/time และอย่างน้อยหนึ่ง Result Item.
การมี critical rule แต่ไม่มี explicit `is_critical` จะถูกปฏิเสธก่อนยิง
เพราะ HIS ห้ามอนุมานค่าวิกฤติจาก rule text.

### X-ray dispatch

```json
{
  "order_id": "<CPOE Order ObjectId 24 ตัว>",
  "item_ids": ["<CPOE Item ObjectId 24 ตัว>"]
}
```

### X-ray order

ต้องมีอย่างน้อย `Hn`, `PatientFName`, `PatientGender`, `PatientDob`,
`PatientClassUid`, `VisitNo`, `AccessionNo`, `ExamUid`, `ExamName` และ Accession ไม่เกิน
16 ตัว. `AdmissionNo`/`PatientSsn` ไม่บังคับตาม contract ล่าสุด
แต่ endpoint Envision จริงอาจมี requirement เพิ่มที่ยังไม่มี Order specification ยืนยัน

### X-ray result

ต้องมี `Hn`, `AccessionNo`, `ExamUid`, `ExamName`, `RadiologistUid`, `ResultText`,
`ResultDateTime`. อย่ายิงเลขสมมติ เพราะ result Process รุ่นที่มีใน repository ยังไม่พิสูจน์
ว่า reject Accession ที่ไม่มี Order และอาจสร้าง orphan result ได้

## ตรวจหลังเขียนด้วย evidence

HTTP/ACK สำเร็จไม่ใช่ end-to-end proof. ส่ง snapshot ที่ export แบบชั่วคราวผ่าน
`--evidence` เพื่อให้เครื่องมือตรวจ persistence/correlation ต่อ โดยไม่ใส่ raw payload:

```json
{
  "lab-order": {
    "outbound": { "order_no": "...", "lab_no": "...", "hl7_status": "queued" },
    "agent": { "order_no": "...", "accepted": true, "dispatch_id": "..." },
    "lis": { "registered": true }
  },
  "lab-result": {
    "receipt": { "result_uid": "...", "receipt_status": "processed" },
    "report": { "order_no": "..." },
    "items": [{ "obs_code": "..." }],
    "work_item": { "status": "resulted" },
    "cpoe_item": { "status": "completed" },
    "outbound": { "hl7_status": "resulted" }
  },
  "xray-dispatch": {
    "expected_accession_no": "...",
    "cpoe_item": { "accession_no": "..." },
    "xray_order": { "AccessionNo": "..." },
    "ris_ack": { "AcknowledgementCode": "AA" }
  },
  "xray-result": {
    "result_log": { "AccessionNo": "..." },
    "current_result": { "AccessionNo": "..." },
    "worklist_item": { "status": "resulted", "resulted": true }
  }
}
```

ใช้ไฟล์ evidence ชั่วคราวนอก repository เมื่อจำเป็นต้องมี identifier จริง และอย่าแนบผลตรวจ
หรือชื่อผู้ป่วย เครื่องมืออ่าน evidence แล้วเทียบ identity/status/จำนวน result item; รายงานไม่เก็บ
ค่าตัวระบุจริง

## ความหมายผลวิเคราะห์

- `FAIL` — จุดผิดที่ต้องแก้ เช่น schema, auth, network, ACK, correlation หรือ persistence
- `WARN` — ผ่านบางชั้นแต่ยังมี contract gap เช่น X-ray result ตอบ `AA` แต่ไม่พิสูจน์ Order link
- `SKIP` — ไม่มี evidence ยืนยันจุดนั้น จึงห้ามนับเป็น pass
- `PASS` — ผ่านเฉพาะ checkpoint ที่ระบุ ไม่ได้ยืนยันจุดถัดไปโดยอัตโนมัติ

จุดแยกปัญหาสำคัญ:

1. `lab-order` fail แต่ `lab-agent --smoke` pass → route/timeout จาก initCraft runtime ไป Agent
2. Gateway 401/403 → credential/scope/action mapping; Process ยังไม่ถูกเรียก
3. `INVALID_PAYLOAD`/ACK `AE` ใน smoke → transport/auth ผ่านและถึง Process แล้วตามตั้งใจ
4. HTTP/ACK pass แต่ evidence ขาด → ยังต้องตรวจ DB/downstream/UI; อย่าปิด incident
5. X-ray Order `LocalSaved=true` แต่ ACK ไม่ใช่ `AA` → HIS เขียนแล้วแต่ forward RIS fail;
   reconcile ด้วย Accession เดิม ห้ามออกเลขใหม่
6. X-ray result มี current result แต่ไม่มี log → ตรวจ deployment สองตาราง
   `zdata_xray_result` กับ `zdata_zdata_xray_result_log` ก่อนถือว่าประวัติครบ

## Verification ของตัวเครื่องมือ

```bash
node Form-Builder/API/tests-tools/tests/test_integration_autodiag.js
node --check Form-Builder/API/tests-tools/scripts/integration_autodiag.js
```

ชุดทดสอบครอบคลุม schema guard, no-write smoke, correlation mismatch, credential/PHI
redaction, request envelope/header และ guard ที่ห้าม valid request ออก network ถ้าไม่มี
`--confirm-write`.
