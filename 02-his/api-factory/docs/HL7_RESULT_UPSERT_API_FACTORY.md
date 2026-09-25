# API Factory: `hl7_result_upsert`

อัปเดต: 24 กันยายน 2569 (Asia/Bangkok)

ไฟล์ Process ที่ต้องใช้:

- `hl7_result_upsert_api.js`
- API Factory Process ID ที่สร้างใน initCraft: `6a8da8a6f851000f28e50299`
- Contract: `schemas/agent-to-his-result-v2.schema.json`
- Test payload: `fixtures/agent_result_partial.json` และ `fixtures/agent_result_final.json`

## หน้าที่

Process นี้รับ Result JSON จาก Agent และทำงานตามลำดับ:

```text
Agent JSON
  -> Lab_Result_Inbound_Receive (Receipt ต่อ Order identity + result_uid)
  -> จับคู่ Lab Order ด้วย LAB NO. + order_no + HN + VN
  -> Result_Report_Manual_Entry (หนึ่ง Report ต่อ report_seq/stage)
  -> LAB_result_item (หนึ่ง current row ต่อ Work Item + obs_code)
  -> sync zdata_lab_work_item.work_status และ CPOE Item
  -> reconcile Outbound จาก callback ที่ตรวจสอบแล้ว
  -> complete Parent CPOE Order เมื่อ active Items ทุกตัว completed
```

Process ไม่แก้ logic เก็บ specimen, รับ specimen, reject, priority, search หรือ ListView
และไม่คำนวณ critical threshold ซ้ำ

## Form IDs ที่ Process ใช้

| บทบาท | Form ID | Collection |
|---|---|---|
| Technical Receipt | `6a8b1c03f851000f28e501ef` | `zdata_lab_result_inbound` |
| Result Report | `6a8d4334f851000f28e5025b` | `zdata_lab_report_manual_entry` |
| Result Item | `6a8bc91df851000f28e501fb` | `zdata_lab_result_item` |
| Lab Work Item | `6a95c750422c1ca959829e8a` | `zdata_lab_work_item` |

## วิธีสร้างใน API Factory

1. เปิด `API Factory` แล้วสร้าง Process ชื่อ `hl7_result_upsert`.
2. วางเนื้อหาทั้งไฟล์ `hl7_result_upsert_api.js` ใน `Process(params, userInfo)`.
3. ให้ External API action `lis.receive` map มาที่ Process นี้ และจำกัด API key scope
   ไว้ที่ action ที่ต้องใช้เท่านั้น ห้ามเปิด legacy public-token/direct Process endpoint
   เป็นช่องรับผลจากภายนอก.
4. Service account ต้องมีสิทธิ์ดังนี้:
   - Read/Insert/Update: Receipt, Report, Result Item
   - Read/Update: Lab Work Item, CPOE Item, Parent CPOE Order และ LAB Outbound ที่อ้างถึง
5. Publish แล้วเรียกผ่าน External API action:

```text
POST https://apihis.softmax-one.com/api/v1/external/lis.receive
x-api-key: <LIS API key>
Content-Type: application/json
```

Gateway อาจเติม `xpartnerx` ใน Process params. Receiver จะแยก field นี้ออกก่อน
ตรวจ schema, hash และเก็บ `raw_payload_json`; `xpartnerx` ไม่ใช่ข้อมูลผล Lab และ
ไม่ใช้แทนการตรวจสิทธิ์ของ Gateway ส่วน top-level field อื่นที่ไม่อยู่ใน schema ยังถูกปฏิเสธ.

Body ภายนอก:

```json
{
  "params": {
    "order_no": "...",
    "filler_order_no": "...",
    "hn": "...",
    "visit_id": "...",
    "result_uid": "...",
    "report_seq": "1",
    "stage": "partial",
    "overall_status": "in_progress",
    "reported_at": "2026-08-25T10:00:00+07:00",
    "reported_by": {
      "source_id": "...",
      "source_name": "..."
    },
    "items": [
      {
        "obs_code": "...",
        "obs_name": "...",
        "value": "...",
        "comment": "hemolyzed sample\nrepeat confirmed",
        "obx_status": "P",
        "change_kind": "first",
        "receipt_seq": "1",
        "result_version": "1",
        "interpretation_code": "N",
        "is_critical": false
      }
    ]
  }
}
```

เวลาทดสอบให้ใช้ JSON เต็มจาก fixture เพราะ `items` ต้องมีอย่างน้อยหนึ่งรายการ

`items[].comment` เป็น string แบบ optional สำหรับหมายเหตุระดับรายการผลจาก HL7 NTE.
ถ้ามีหลาย NTE ให้ Agent รวมเป็นข้อความเดียวคั่นด้วย `\n`; ถ้ารายการนั้นไม่มีหมายเหตุ
ไม่ต้องส่ง field นี้. Receiver เก็บค่าลง `LAB_result_item.result_comment` และเก็บข้อความ
เดิมไว้ใน Receipt `raw_payload_json` ด้วย

Agent corrected resend ใช้ `stage=corrected`, `overall_status=corrected` และ item version
ใหม่โดยไม่ส่ง `corrected_by`/`corrected_at`. สอง field นี้เป็น audit ของผู้ใช้ที่กดดินสอ
แก้ผลใน HIS เท่านั้น; receiver จะรักษา `last_edited_by`/`last_edited_at` เดิมไว้.

## Matching ที่บังคับ

Process จะอ่าน `zdata_lab_work_item` และยอมรับผลเมื่อครบทุกข้อ:

| Agent | Lab status |
|---|---|
| `filler_order_no` หรือ `labno`/`lab_no` | `lab_no` |
| `order_no` | Work Item `_id` / `dataid` ตาม canonical identity |
| `hn` | `patient_hn` |
| `visit_id` | `visit_id` |
| `items[].obs_code` | `selected_items[].his_code_id/item_code/test_code` โดยตรง หรือ local result code ที่อยู่ใน mapping ของ group code นั้น |
| `items[].panel_code` / `panel_name` | metadata จาก LIS/Agent ที่เก็บกับ Result Item เพื่อแสดงผล/ตรวจสอบย้อนหลัง; ไม่ใช้เป็น matching key |

ถ้า key ไม่ตรง หรือมี `obs_code` ที่ไม่ได้สั่ง Process จะเก็บ Receipt เป็น `unmatched`
แต่ไม่สร้าง Report และ Result Item
เพื่อป้องกันผลไปผูกผิดคนหรือผิดงาน

เมื่อ `overall_status=resulted` รายการ `items` ต้องครบทุก `selected_items` ใน Lab Order
มิฉะนั้นตอบ `FINAL_ITEMS_INCOMPLETE` และยังไม่ materialize ผล final

Process ฝัง allowlist group → local result จาก
`catalog-configured-tests-Group.numbers` ฉบับตรวจเมื่อ 15 กันยายน 2569
(30 group codes, 215 local codes, SHA-256
`d147d6b9785cc7cc7b5695a7132b1798d8bd976b45087e69c6791b796dbf382b`). ตัวอย่าง:

```text
ordered test 100802CD Creatinine
  -> รับผล 100802CD Creatinine
  -> รับผลย่อย 101120CD eGFR
```

ไฟล์ต้นทางไม่มี field บอก required/optional จึงใช้ mapping เป็นรายการ code ที่อนุญาต
ไม่ถือว่าผลย่อยทุกตัวเป็นข้อบังคับ. ถ้า mapping มี ordered/group code อยู่ด้วย เช่น
Creatinine, final ยังต้องมี `100802CD`; ส่งเฉพาะ eGFR จะได้ `FINAL_ITEMS_INCOMPLETE`.
สำหรับ panel ที่ mapping มีแต่ child codes การมี mapped child อย่างน้อยหนึ่งตัวถือว่า
ครอบคลุม ordered group โดยสถานะ final ยังคงอ้าง `overall_status` ที่ Agent/LIS ส่งมา.
Code ที่ไม่อยู่ทั้งในรายการสั่งและ mapping ยังได้ `OBS_CODE_NOT_MATCHED` หรือ
`OBS_CODE_PARTIAL_MISMATCH` และไม่สร้าง Report/Result Item.

`panel_code` ไม่ใช่ `group_code`/`his_code_id` โดยอัตโนมัติ. Payload จริงอาจให้
`panel_code` ต่างกันในแต่ละผลย่อย จึงห้ามใช้ field นี้ตัดสินว่า Result Item ใดเป็นลูกของ
Order ใด. ความสัมพันธ์หนึ่ง Order test → หลาย Result Items ต้องอ่านจาก
`RESULT_COMPONENT_CODES_BY_GROUP` โดยเทียบ outbound `test_code` กับ inbound `obs_code`.
Worklist ใช้ mapping ชุดเดียวกับ receiver และมี regression ตรวจ parity เพื่อให้ผลย่อยที่
บันทึกไว้แล้วแสดงได้โดยไม่ต้องให้ Agent resend.

Lab Order ต้องอยู่ใน `received`, `processing`, `resulted` หรือ `completed` ก่อนรับ Result

## Idempotency และ version

- ขอบเขต idempotency คือ `order_no + filler_order_no + hn + visit_id + result_uid`
  ไม่ใช่ `result_uid` แบบ global เพราะ LISconnect อาจสร้าง UID สั้นซ้ำในคนละ Order
- UID + Order identity เดิมและ payload เดิม:
  - Receipt `processed` ตอบ `DUPLICATE_RESULT_UID`, `created:false`, `duplicate:true`
    และไม่เพิ่ม Receipt/Report/Item; อาจซ่อมสถานะ Outbound/CPOE จาก Receipt เดิม
  - Receipt `unmatched`/`error` นำ Receipt record เดิมกลับมาประมวลผล (`created:false`,
    `reprocessed_receipt:true`) เพื่อให้ retry หลังแก้สาเหตุสำเร็จได้; ถ้ารอบก่อนสร้าง Report
    ไปแล้วแต่ล้มใน Item/status write จะ resume Report เดิมแทนการสร้างซ้ำ
- UID + Order identity เดิมแต่ clinical payload เปลี่ยน: ตอบ `RESULT_UID_PAYLOAD_CONFLICT`
  และไม่เขียนผล เพื่อกันการใช้ UID เดิมทับข้อความคนละก้อน
- UID เดิมแต่คนละ Order identity: สร้าง Receipt แยกได้
- UID ใหม่แต่ Order เดิม: รับเป็นข้อความรอบใหม่ได้เมื่อ `report_seq`, `stage` และ
  `result_version` ผ่านกติกาประวัติเดิม; ถ้าใช้ report stage เดิมจะยังถูกกันด้วย
  `REPORT_STAGE_CONFLICT`/`REPORT_SEQUENCE_REUSED`
- Payload fingerprint สร้างจาก canonical JSON จึงไม่ชนเพียงเพราะลำดับ key ต่างกัน
- Report ใช้ `report_key = order_no|filler_order_no|visit_id|order_status_id|report_seq|stage`
- partial/final/corrected เป็น Report คนละ record สำหรับ technical stage history
- Report ต้องมี `xparentx = Lab Work Item ID`
- Result Item เดิมของ Work Item + `obs_code` ถูกอัปเดตเป็นค่าปัจจุบัน และชี้
  `xparentx`, `parent_id.value`, `result_report_id` ไป Report ล่าสุดที่อัปเดตมัน
- `result_version` ต่ำกว่าเวอร์ชันล่าสุด: ตอบ `STALE_ITEM_VERSION`
- `result_version` เท่าเดิมและ value เท่าเดิม: สร้าง snapshot ใน stage ใหม่ได้โดยไม่เพิ่ม edit history
- `result_version` เท่าเดิมแต่ value ต่าง: ตอบ `RESULT_VERSION_CONFLICT`
- version ใหม่: สร้าง Item snapshot และ append `edit_history_json` จากประวัติก่อนหน้า
- `report_seq` ต้องเพิ่มขึ้น และห้ามย้อนสถานะจาก completed/corrected กลับเป็น partial

## Status mapping และ reconciliation

| Agent | Report | Lab work | CPOE Item | Outbound |
|---|---|---|---|---|
| `in_progress` | `partial` | `resulted` | ไม่เปลี่ยน | `in_progress` |
| `resulted` | `completed` | `completed` | `completed` | `resulted` |
| `corrected` | `corrected` | คง `completed` | คง/ตั้ง `completed` | คง/ตั้ง `resulted` |
| `cancelled` | `cancelled` | `cancelled` | `rejected` | ไม่เปลี่ยน; รอ status-sync contract |

การได้ callback ที่ผ่าน LAB NO./order_no/HN/VN/obs_code แล้วเป็นหลักฐาน downstream
สำหรับปิด retry และ active error ของ Outbound แม้การส่งครั้งแรกเคย timeout. ระบบเก็บ
`attempt_history_json` เดิมไว้, ไม่สร้าง outbound success acknowledgment ปลอม และบันทึก
`result_callback_received_at`, `result_uid`, `result_receipt_id` สำหรับ audit.

Parent CPOE Order เปลี่ยนเป็น `completed` เฉพาะเมื่อ active CPOE Items ทุกตัวของ Order
เป็น `completed`; ผลบางส่วนหรือ sibling Item ที่ยังรอผลจะไม่ปิด Parent. Reconciliation
เป็น best-effort หลัง clinical persistence: ถ้าซ่อมสถานะไม่ได้ ผลยังถูกเก็บและ response
เป็น `PROCESSED_WITH_WARNING` พร้อม `*_sync_pending`/`warnings`.

Critical ใช้คำตัดสินที่ Agent ส่งมาอย่างชัดเจน:

```text
is_critical = items[].is_critical
หรือ derive จาก interpretation_code: LL / HH / AA = critical
```

`critical_low_rule` และ `critical_high_rule` เป็น snapshot ของกติกาเท่านั้น การมี rule
ไม่ได้แปลว่าค่าผลครั้งนั้น critical หาก Agent ไม่ส่งคำตัดสิน API จะเก็บผลเป็น non-critical
พร้อม `PROCESSED_WITH_WARNING`

## ชุดทดสอบ

Local regression (ไม่ออกเน็ตและไม่เขียน HIS):

```bash
node Form-Builder/API/tests-tools/scripts/run_hl7_result_suite.js
```

Runner นี้รวม receiver behavior, schema/form contract, manual-pencil identity,
Worklist/result-view regressions และ SDForm validator ของ Receipt/Report/Result Item.

ดู case สำหรับ External API ก่อนยิงจริง (dry-run เป็นค่าเริ่มต้น):

```bash
node Form-Builder/API/tests-tools/scripts/post_lis_receive_case.js --list
node Form-Builder/API/tests-tools/scripts/post_lis_receive_case.js invalid
node Form-Builder/API/tests-tools/scripts/post_lis_receive_case.js legacy-corrector
```

`invalid --send` และ `legacy-corrector --send` เป็น no-write smoke เพราะต้องตกที่
validation ก่อนสร้าง Receipt. Case `partial`, `final`, `corrected` เขียนข้อมูลจริง
และต้องเปลี่ยน synthetic IDs ใน fixture ให้ตรง UAT Work Item ก่อนใช้.

### Test sequence หลัง Publish

1. เตรียม UAT Work Item ที่มี `_id`/`dataid`, `lab_no`, `patient_hn`, `visit_id`
   และ `selected_items_json[].his_code_id` ตรงกับ fixture.
2. ส่ง `agent_result_partial.json` — ต้องได้ `code=PROCESSED`, Report 1 record,
   Item Sodium 1 record และ work status `resulted`.
3. ส่ง partial ที่ processed แล้วซ้ำด้วย UID + identity + payload เดิม — ต้องได้
   `DUPLICATE_RESULT_UID` และจำนวน record ไม่เพิ่ม.
4. สร้าง callback ที่ยังจับคู่ Order ไม่ได้ แล้วส่งก้อนเดิมซ้ำหลังแก้ Order — ต้อง reuse Receipt เดิม,
   `created:false`, `reprocessed_receipt:true` และประมวลผลสำเร็จโดยไม่เพิ่ม Receipt.
5. ส่ง UID เดิม + Order identity เดิมแต่เปลี่ยน value — ต้องได้
   `RESULT_UID_PAYLOAD_CONFLICT` และไม่มี clinical write.
6. ส่ง UID เดิมบน Order identity อื่น — ต้องสร้าง Receipt แยกได้.
7. ส่ง UID ใหม่บน Order เดิมพร้อม `report_seq`/`result_version` รอบใหม่ — ต้องรับได้;
   ถ้า sequence/stage ซ้ำต้องยังถูกปฏิเสธ.
8. ส่ง final ที่ขาด Potassium — ต้องได้ `FINAL_ITEMS_INCOMPLETE` และยังไม่สร้าง Report/Item.
9. ส่ง `agent_result_final.json` — ต้องสร้าง Report stage ใหม่, สร้าง Sodium/Potassium snapshots
   และเปลี่ยน work status เป็น `completed` โดยไม่แก้ partial เดิม.
10. เปิด `ดูผล` จาก Worklist หรือ Result Report ที่ใช้งานอยู่ด้วย Report ID ที่ API ตอบกลับ —
   ตรวจว่า Report `xparentx` เป็น Work Item ID และ Item `xparentx`, `parent_id.value`,
   `result_report_id` เป็น Report ID เดียวกัน.
11. ส่ง corrected ด้วย `report_seq`/`result_version` ใหม่และไม่มี
   `corrected_by`/`corrected_at` — ต้องสร้าง corrected Report, อัปเดต Result Item
   current row เดิม และไม่สร้าง/ทับ `last_edited_*` จาก Agent.
12. ทดสอบ `order_no` ผิดหนึ่งตัว — ต้องได้ `ORDER_NOT_MATCHED` และมีเพียง Receipt `unmatched`.
13. จำลอง Outbound timeout แล้วรับ partial/final — ต้องเปลี่ยน Outbound เป็น
   `in_progress`/`resulted`, ปิด retry/error ปัจจุบัน และรักษา `attempt_history_json`.
14. Parent ที่ยังมี sibling pending ต้องคงสถานะเดิม; เมื่อทุก Item completed ให้ callback
    final เดิมซ้ำเพื่อยืนยันว่า duplicate repair ปิด Parent ได้โดยไม่เพิ่ม clinical records.
15. สั่ง `100802CD` แล้วส่ง callback ที่มีทั้ง `100802CD` และ `101120CD` — ต้องสร้าง
    Result Item 2 รายการ; เพิ่ม code นอก mapping ต้องถูกปฏิเสธทั้ง callback.

## ข้อจำกัดก่อน Production

การทดสอบใน repository เป็น mock behavioral test ยังไม่ใช่การยิง Process บน initCraft จริง
และ API นี้ใช้ SDForm pipeline หลาย write จึงไม่ใช่ transaction เดียวทั้ง Receipt/Report/Items.

ก่อน production ควรสร้าง/ยืนยัน unique index:

- Receipt: `order_no + filler_order_no + hn + visit_id + result_uid`
- Report: `report_key`
- Result Item: `order_no + filler_order_no + visit_id + obs_code`

Read-only check เมื่อ 15 กันยายน 2569 พบว่า `zdata_lab_result_inbound` มีเพียง `_id_`
index ยังไม่มีทั้ง global `result_uid` index และ compound index ข้างต้น; Process จึงบังคับ
กติกาใน application layer แล้ว แต่ concurrency race ยังต้องทดสอบและปิดด้วย compound index
ก่อน Production.

จากนั้นต้องทำ paired test กับ Agent และ concurrency/retry test จริงก่อนประกาศพร้อมใช้งาน
