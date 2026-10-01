# EMR Sensitive Result — Re-auth & Access Log

> สถานะ 2026-09-28: local/UAT candidate พร้อม replace เพื่อทดสอบทีละจุด; ยังไม่ deploy production

## ขอบเขตที่ยืนยัน

- Database `his`; master `zdata_master_item_order.is_hide_result`
- Sensitive: `IM2`, `I0058`, `I0059`; `BB543` ยังไม่รวม
- ทุกห้อง LAB รวม Immunology (`IM`, `MI-OUT`) ไม่มี same-room/owner-room bypass
- LAB lookup/full sheet/PDF ไม่มี re-auth: แถวทั่วไปแสดงผลและค่าปกติตามเดิม; เฉพาะแถว
  Sensitive แสดงชื่อ/รหัสรายการและสถานะ `ปกปิดผล`
- EMR เท่านั้นที่ใช้ username/password ของบัญชี `DOCTOR` ก่อนเปิดค่าผล Sensitive
- correction/recheck hold เป็นอีก flow และไม่ใช้เป็น Sensitive policy

## Flow ที่ทำเสร็จใน candidate นี้

1. `emr-lab-board-get` derive HN/patient จาก `visit_id` ที่ server แล้ว resolve
   Result → CPOE Item → current Item Master
2. ก่อน re-auth ผล Sensitive คืนเพียง locked placeholder; ไม่คืน value, comment,
   flag/critical, previous, trend, Result Report id หรือ attachment
3. `emr-summary-get.lab[]` รับ `summary_lab` จาก board ที่ผ่าน policy แล้ว จึงไม่มี
   direct Result Item bypass
4. Treat Summary และ EMR History แสดง “Sensitive — ต้องยืนยันตัวตนก่อนดูผล”
5. กดเปิดแล้วเรียก process เดิมด้วย `action: open_sensitive`; server ตรวจ:
   - บัญชีที่กรอกมี role ปัจจุบันเป็น `DOCTOR` (อาจเป็นคนละบัญชีกับ viewer session)
   - บัญชีไม่ blocked
   - password ด้วย `this.compareHash(password_hash, password)`
   - visit → order → LAB item → current master → result scope ใหม่ทั้งหมด
6. PDF ผลทั่วไปของ EMR เปิดได้ตามปกติ. ถ้าใบที่เลือกมี Sensitive ทุกครั้งที่กด PDF ต้องกรอก
   บัญชี `DOCTOR` ใหม่ และ UI ขอ grant ใหม่ด้วย `screen: treat_summary_pdf` หรือ
   `screen: emr_history_pdf`; ห้ามนำ grant อายุ 5 นาทีจากการดูผลบนหน้าจอมาเปิด PDF
7. Server insert `zdata_emr_sensitive_access_log` ก่อนคืนผล; log ล้ม = ไม่คืนผล
8. Server ออก grant token ผูก viewer+Order+Section อายุ 5 นาทีใน
   `zdata_emr_sensitive_access_grant`; Report SQL ตรวจ token ซ้ำก่อนคืนค่าของแถว Sensitive
9. UI ล้าง password ทันทีหลัง submit; เมื่อปิด result viewer จะล้างค่าที่เปิดเผยออกจาก UI แต่เก็บ
   opaque grant สำหรับ **การดูบนหน้าจอ** ไว้ใน memory จนหมดอายุ. PDF grant แยกจาก screen grant
   และถูกล้างก่อนการกด PDF ครั้งถัดไป จึงต้องยืนยันใหม่ทุกครั้ง

Access Log ไม่เก็บ password/hash/result/comment/URL; เก็บ event/request, outcome/reason,
actor/roles/site/unit, patient/visit/order/item/revision, policy snapshot, purpose และ screen.

## UAT policy ที่ยืนยันล่าสุด

ทุกห้อง LAB รวม `IM`/`MI-OUT` ไม่มีฟอร์ม credential และไม่มีสิทธิ์เปิดค่าผล Sensitive;
grant เดิมหรือสิทธิ์เจ้าของห้องต้องไม่เปลี่ยนผลลัพธ์. เฉพาะ EMR ใช้ `DOCTOR`;
admin/super/NURSE/MR ไม่ผ่านแทนแพทย์.
grant ดูผลบนหน้าจอใช้ได้เฉพาะ viewer เดิม + Order+Section เดิม และหมดอายุใน 5 นาที. แต่การกด
PDF ที่มี Sensitive ต้องยืนยันแพทย์ใหม่ทุกครั้งและไม่ reuse screen grant. ทุกคำขอเปิดเผย server
ต้องตรวจ token/scope/role และบันทึก Access Log ใหม่; หมดอายุหรือผิด scopeต้อง fail closed.
การปิด popup/reload EMR ล้างค่าที่เปิดแล้วจาก UI. Attachment ของ EMR ยังไม่เปิดในรอบนี้.

## ไฟล์สำหรับ replace

### 1. Server redaction + re-auth + Access Log

- Process `emr-lab-board-get` — ID `6ab3be31cec3020e8562a2c9`
- Body: `Form-Builder/API/api-factory/processes/emr-lab-board-get.js`

Collection `zdata_emr_sensitive_access_log` จะถูกเขียนด้วย `app.dbInsert` ตอนทดสอบครั้งแรก.
ถ้า runtime ไม่อนุญาตให้สร้าง/เขียน collection นี้ API จะตอบ `audit_failed` และไม่เปิดผล
ซึ่งเป็น fail-closed ที่ตั้งใจไว้.
Collection `zdata_emr_sensitive_access_grant` ใช้เก็บ token อายุสั้น; ไม่เก็บ password/hash/result.

ฟอร์มดู Audit Log แบบอ่านอย่างเดียวอยู่ที่
`Form-Builder/SDForm/form-factory/forms/emr-sensitive-access-log-v1.json` และชุดส่งมอบอยู่ที่
`02-his/handoff/emr-sensitive-access-log-form-v1.zip`. ตอน Import ให้ตั้งชื่อ Form เป็น
`emr_sensitive_access_log` เพื่ออ่าน collection `zdata_emr_sensitive_access_log`; อนุญาตเฉพาะ
View/Search และปิด Add/Update/Delete. ฟอร์มนี้ไม่สร้าง Log และไม่แก้ flow disclosure เดิม.

สถานะ 2026-09-29: Import แล้วเป็น Form `emr_sensitive_access_log` ID
`6abb380fc54b3f93ce796543`. Runtime ยืนยันว่า Table Name เป็น
`zdata_emr_sensitive_access_log` และโหลด Log ได้ 71 รายการโดยไม่แก้ข้อมูล. ยังไม่ผ่าน permission
UAT เพราะบัญชี admin ที่ทดสอบยังเห็น Add/Edit/Delete; Display/Search Fields ยังว่าง ทำให้ตารางกว้าง.

### 2. ปิด Summary bypass

- Process `emr-summary-get` — ID `6a9574cc1812c7078a067299`
- ใช้ body: `Form-Builder/API/api-factory/processes/emr-summary-get-READY-v2.js`
- `emr-summary-get-CALLS-BOARD-v1.js` เป็น synchronized reference ไม่ต้อง replace ซ้ำ

### 3. Treat Summary

- Form EMR `6a4f64e7f8cdfc54cec16488`, widget `treat_summary`
- Replace Template ด้วย `02-his/form-factory/treat-summary-template-FULL-v1.html`
- ถ้าต้องการข้อความพร้อม paste ใช้ `02-his/form-factory/treat-summary-template-FULL-v1.txt`
- Replace onCreated ด้วย
  `Form-Builder/API/form-factory/events/treat-summary-onCreated-FULL-v1.js`

ไฟล์ `treat-summary-lab-xray-template-v1.html` และ
`treat-summary-lab-xray-oncreated-v1.js` เป็น fragment reference ไม่ต้องวางเพิ่มเมื่อใช้ FULL.

### 4. EMR History

- Form `6a96557e422c1ca959829eae`, widget `emr_view`
- Replace Template ด้วย `02-his/form-factory/emr-history-template-FULL-v1.html`
- ถ้าต้องการข้อความพร้อม paste ใช้ `02-his/form-factory/emr-history-template-FULL-v1.txt`
- Replace onCreated ด้วย
  `Form-Builder/API/form-factory/events/emr-history-onCreated-FULL-v1.js`

### 5. LAB Manual Result — Partial → Final

- Process `lab_cpoe_worklist_api` — ID `6a9434c3422c1ca959829d5e`
- Replace body ด้วย
  `Form-Builder/API/api-factory/processes/lab_cpoe_worklist_api.js`
- Replace/import LAB Worklist ด้วย
  `Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json`

การกด `บันทึกผล` ยังคงสร้างผล Manual เป็น `ออกผลบางส่วน`. เมื่อ Active Item ทุกตัวใน
Order+Section เดียวกันมี Result Item ที่บันทึกจริงและ `result_source=manual` หน้า Order Result
จะแสดงปุ่ม `ยืนยันออกผลครบ`. Server ตรวจเงื่อนไขซ้ำก่อนเปลี่ยน Result Item เป็น `final`,
Result Report/Work Item/CPOE Item เป็น `completed` และเก็บผู้ยืนยันกับเวลา. ปุ่มนี้ไม่ Final
ผล Agent/LIS และการกดซ้ำไม่เขียนทับเวลา Final เดิม.

### 6. LAB Sensitive permanent redaction + PDF parent

- `get_manual_result` ของทุกห้อง LAB คืนชื่อ/รหัส test และ locked metadata เท่านั้น
- LAB Form ไม่มีปุ่ม/หน้าต่าง/ช่อง Username และ Password สำหรับ Sensitive
- `authorize_sensitive_result` ปฏิเสธคำขอจากทุกห้อง LAB ก่อนอ่าน credential หรือสร้าง grant
- `get_manual_result` และ `prepare_result_pdf` เพิกเฉยต่อ grant เก่าในบริบท LAB; PDF คง redacted
- PDF ฝั่ง LAB ยังแสดงค่า/หน่วย/แปลผล/ค่าปกติของรายการทั่วไปตามเดิม; ปิดเฉพาะแถว Sensitive
- Manual Result ใหม่ทุก Item ใน Order+Section ใช้ Result Report parent เดียว
- `prepare_result_pdf` รวม Result Item เก่าเข้าหา parent หลักโดยไม่ลบ Result Report เดิม

### 6.1 ล็อก specimen เฉพาะ Immunology

- LAB Worklist ตรวจ Section ของแต่ละ Item; เฉพาะ `IM` และ `MI-OUT` แสดง specimen ในช่อง
  disabled รูปแบบเดิม ไม่มี focus/click/dropdown/ลูกศร และเรียก `update_specimen` ไม่ได้
- Process ปฏิเสธ `update_specimen` ของ `IM`/`MI-OUT` ซ้ำที่ server ก่อนค้น specimen master
  หรือเขียน CPOE Item เพื่อกันการเรียก API โดยตรง
- Section อื่นยังใช้ dropdown และ flow แก้ specimen เดิมทั้งหมด
- ใช้ไฟล์ replace เดิมในข้อ 5: Process `6a9434c3422c1ca959829d5e` ก่อน แล้ว import LAB
  Worklist Form JSON; ไม่ต้อง replace Process/Form อื่น

### 6.2 ป้ายสถานะผ่านการเงินของเงินสดทุกห้อง LAB

- Order เงินสดที่ `total_amount > 0` แสดงป้ายในตำแหน่งเดิมทุกห้อง LAB
- ใช้ Finance gate ของ Item ไม่ใช้ยอดเงินเป็นตัวตัดสิน: `sent` แสดงป้ายแดง
  `ยังไม่ได้ชำระเงิน`; `ready` และสถานะหลังรับ/ออกผลแสดงป้ายเขียว `ชำระเงินแล้ว`
- ถ้า Order มีหลาย Item ต้องผ่านการเงินครบทุก Active Item จึงเป็นป้ายเขียว
- สิทธิ์อื่นยังแสดงรหัสสิทธิ์เดิม และเงื่อนไข Finance gate/รับ specimen ไม่เปลี่ยน
- รอบนี้เป็น Form presentation เท่านั้น; ใช้ finance payload เดิมและไม่แก้ Process

### 6.3 รูปแบบอายุระดับ Order ทุกห้อง LAB

- Order row ปกติและ CBC แสดงอายุเป็น `<ปี> ปี <เดือน> เดือน <วัน> วัน`
- ใช้ค่า `order.vid.pid.age` เดิมเท่านั้น ไม่คำนวณจากวันเกิด; ระบบจริงพบทั้งค่าปีอย่างเดียว
  และรูปแบบ `25y 1m 14d`
- ถ้าไม่มีเดือนหรือวันให้เว้นเฉพาะค่า แต่คงหน่วย เช่น `41 ปี  เดือน  วัน`
- เป็น Form presentation เท่านั้น; ไม่เปลี่ยน Result/PDF/API หรือข้อมูลผู้ป่วย

### 7. Report Factory SQL row redaction — owner-team handoff only

- SQL provider `lab_result_slip` — ID `6ab0a1c4d0c3ef2e97911e55`
- SQL Provider เป็นของทีมอื่น: **ห้ามทีม EMR/LAB ชุดนี้ replace เอง**
- Reference proposal สำหรับส่งให้เจ้าของตรวจและนำไปปรับใน branch/process ของทีม:
  `Form-Builder/SDForm/sql-factory/lab-result-slip-sensitive-redacted-PROPOSAL-v2.json`
- Proposal สร้างจาก live export แบบ read-only แล้วเติม `grant_token` และ server-side row redaction
- ไม่มี/หมดอายุ token: PDF ยังเปิดและรายการทั่วไปยังแสดง แต่ Sensitive row แสดงชื่อ Test
  โดยช่อง result value, unit, interpretation, reference range และ comment เป็นค่าว่าง
- token ถูกต้อง: Sensitive row แสดงค่าปกติ
- Builder สำหรับสร้างใหม่จาก export ภายหลัง:
  `Form-Builder/API/report_factory/builders/patch_lab_result_slip_sensitive_gate.js`
- สถานะ: **รอทีม Report ตรวจและยืนยันก่อน Import**

## ลำดับ replace และ smoke test

1. Replace board process ก่อน แล้วเปิด EMR: Sensitive ต้องเป็น locked card; `BB543`/ผลทั่วไป
   ต้องยังเห็นปกติ. หาก UI เก่ายังอยู่ ผล Sensitive ต้องไม่รั่วเพราะ server ไม่ส่งค่าแล้ว.
2. Replace summary process แล้วตรวจ legacy Lab list ว่าไม่มี Sensitive value.
3. Replace Treat Summary FULL Template + onCreated; ทดสอบโดย viewer ปกติกรอกบัญชี `DOCTOR`:
   password ผิด, password ถูก, ปิด viewer แล้วผลกลับมาล็อก; เปิด Order+Section เดิมซ้ำภายใน
   5 นาทีต้องเปิดได้โดยไม่ถาม password และหลัง 5 นาทีต้องถามใหม่. จากนั้นกด PDF ที่มี Sensitive
   สองครั้ง: ทั้งสองครั้งต้องถามรหัสใหม่ และ screen grant เดิมต้องไม่เปิด PDF ให้เอง.
4. ตรวจ `zdata_emr_sensitive_access_log`: มี denied/success แต่ไม่มีข้อมูลต้องห้าม.
5. Replace EMR History FULL Template + onCreated แล้วทำกรณีเดียวกัน.
6. Replace Worklist process ก่อน Form. ทุกห้อง LAB รวม `IM`/`MI-OUT` ใน “สืบค้นผลแลป”
   ต้องเห็นชื่อ/รหัส test และข้อความสีแดง `ปกปิดผล` โดยไม่มีปุ่มหรือช่องยืนยันแพทย์;
   ค่า/หน่วย/แปลผล/ช่วงอ้างอิง/comment/ไฟล์ต้องไม่ถูกส่ง และ PDF ต้องคง redacted แม้ส่ง grant เก่า.
7. ให้ทีมเจ้าของ SQL deploy หลัง review แล้วตรวจ PDF: ฝั่งหมอไม่มี/หมดอายุ token ต้องได้ใบรายงาน
   ที่แถว Sensitive เป็นค่าว่าง; หลังยืนยันใหม่จากปุ่ม PDF จึงได้ค่าครบ. ฝั่ง LAB ไม่ส่ง token,
   แถว Sensitive จึงคงปกปิด แต่รายการทั่วไปยังแสดงค่าผลและค่าปกติและพิมพ์ได้ตามปกติ.
8. ทดสอบ Manual: รับ specimen → กรอกผลทุก Item →
   บันทึกผล (ต้องเป็น `ออกผลบางส่วน`) → เปิด Order Result → `ยืนยันออกผลครบ` → reload แล้ว
   ทุก Item ต้องเป็น `ออกผลครบ`. เว้นหนึ่ง Item ไม่กรอก ปุ่มต้องไม่ปรากฏและ server ต้องไม่ Final.
9. ก่อนรับ specimen ให้เปิดรายการ `IM` และ `MI-OUT`: ต้องเห็นชื่อ specimen อยู่ในช่องรูปแบบเดิม
   แต่ไม่มีลูกศรและเปลี่ยนไม่ได้; เปิดห้องอื่นต้องยังเห็น dropdown และเปลี่ยน specimen ได้ตามเดิม.

ห้ามทดสอบด้วยข้อมูลผู้ป่วยจริงในหลักฐาน/ภาพหน้าจอ และไม่ควร replace UI ก่อน server.

## Automated verification

ผ่าน 2026-09-25:

- source compile 6 ไฟล์
- redaction/current-master + historical result
- server re-auth success/bad password/username mismatch/role/blocked/scope/audit failure
- viewer กับ authorizing doctor แยกคน, doctor-only, grant binding/expiry contract
- universal LAB locked response รวม Immunology, ไม่มี re-auth UI, ไม่มี owner-room/passwordless grant
- LAB ปฏิเสธ authorize ก่อนอ่าน credential และไม่รับ grant เก่าสำหรับหน้าจอหรือ PDF
- legacy multi-parent normalization และ future one-parent-per-Order+Section
- Report SQL per-row redaction ก่อน grant และ disclosure หลัง grant
- forged client HN ถูกเพิกเฉย
- Treat Summary + EMR History locked UI, password clearing, disclosure merge, purge on close
- Treat Summary + EMR History แยก PDF grant จาก screen grant และบังคับยืนยันใหม่ทุก PDF click
- summary bypass, full-result dialog และ exact-order History regression

อัปเดตล่าสุด 2026-09-28: TTL 5 นาทีใช้เฉพาะการดูผลบนหน้าจอ EMR; PDF ที่มี Sensitive ต้อง
ยืนยันแพทย์ใหม่ทุกครั้ง. LAB Worklist/PDF ปิดเฉพาะค่า Sensitive แบบถาวรโดยไม่มี re-auth และ
ยังแสดงค่าของรายการทั่วไป. X-ray ไม่อยู่ในรอบ replace นี้เพราะ candidate ยังไม่เคย import.
- `git diff --check`

คำสั่งทดสอบอยู่ใน `Form-Builder/API/tests-tools/tests/`:

- `test_emr_lab_sensitive_result_redaction.js`
- `test_emr_sensitive_result_reauth.js`
- `test_emr_sensitive_result_ui.js`
- `test_emr_summary_get_board.js`
- `test_emr_lab_full_result_dialog.js`
- `test_emr_history_lab_result_card.js`

## Runtime check หลัง replace — 2026-09-25

- เปิด EMR History จาก LAB Worklist ได้และกดโหลด board ซ้ำได้โดยไม่เกิด
  `Unable to display this content`
- พบ `IM2 Anti-HIV` ในเคสทดสอบ แต่ยังอยู่ขั้นรอรับ/ready และยังไม่มี Result Item
  จึงยืนยันได้เฉพาะ pending/non-crash path; ยังทดสอบ locked card, password และ Access Log ไม่ได้
- ขั้นถัดไปต้องให้ LAB รับรายการและมีผลจาก flow ปกติ (LIS หรือ Manual ตาม UAT)
  แล้วจึง reload EMR. ผลจะเป็นบวกหรือลบก็ได้—Sensitive policy ผูกกับรหัสรายการ ไม่ผูกค่าผล
- ห้ามสร้างหรือแก้ผลผู้ป่วยจริงเพียงเพื่อทดสอบ; ใช้ UAT/test patient และบัญชี `DOCTOR`

## ยังไม่รวมใน step นี้

- policy สำหรับ NURSE/MR, retention/log viewers/SIEM และ brute-force rate limit
- attachment download ของ EMR (PDF ใช้ server-side row redaction แล้วเมื่อ replace SQL provider)
- revision-scoped correction hold ที่จะแยกจาก CPOE Item `is_hide_result`
- Builder/Preview และ runtime UAT หลัง replace
