# Handoff: Clinic Master และกระบวนการคลินิกจนจบงาน

เอกสารนี้ใช้ส่งต่องานหลังจากสร้าง Clinic Master แล้ว จุดประสงค์คือให้ผู้รับช่วงงานรู้ว่าโครงสร้างที่มีอยู่คืออะไร ต้องเชื่อมกับส่วนใดต่อ และต้องทดสอบอย่างไรจนถึง end process

สถานะเอกสาร: handoff ฉบับทำงานต่อได้
วันที่อ้างอิง: 2026-08-08

## 1. ขอบเขตและผลลัพธ์ที่ต้องได้

ระบบปลายทางต้องทำให้ผู้ดูแลระบบสามารถกำหนดคลินิกได้จากที่เดียว แล้วผู้ใช้งานสามารถทำงานตามคลินิกได้ตั้งแต่รับผู้รับบริการ เลือกคลินิก เปิดฟอร์มเฉพาะคลินิก บันทึกสถานะการรักษา และปิดกระบวนการ โดยข้อมูลที่บันทึกต้องค้นย้อนหลังและใช้ทำรายงานได้

ผลลัพธ์สุดท้ายที่ถือว่างานเสร็จคือ

- มี Clinic Master ที่สร้าง/แก้ไข/ปิดการใช้งานได้
- ผู้ใช้เลือกคลินิกจากข้อมูล master ได้ ไม่พิมพ์ค่าอิสระซ้ำในแต่ละฟอร์ม
- ฟอร์มเป้าหมายเปิดตามคลินิกและบันทึกข้อมูลผู้รับบริการคนเดียวกันได้ถูกคน/ถูก visit
- สถานะที่แสดงในคิวและปุ่มกรองตรงกับค่าที่จัดเก็บจริง
- สิทธิ์ผู้ใช้และหน่วยงานถูกบังคับใช้
- มี audit, validation, test case และคู่มือใช้งาน
- กรณีปิดคลินิกหรือเปลี่ยนฟอร์มเป้าหมายไม่ทำให้ข้อมูลเก่าหายหรือเปิดไม่ได้

## 2. ไฟล์และ artefact ที่มีอยู่

| ไฟล์ | ความหมาย |
|---|---|
| `clinic-master.json` | แบบฟอร์ม Clinic Master ที่สร้างไว้แล้ว |
| `disease.json` | โครงสร้าง master ลักษณะใกล้เคียงกัน ใช้เทียบ pattern ได้ แต่ไม่ควรนำไปแทน Clinic Master โดยไม่ตรวจ requirement |
| `EMR.json` | แบบฟอร์ม/หน้าจอ EMR ที่มีรายการคิวตามหน่วยงานและห้องตรวจ |
| `ฟอร์มปลายทาง.json` | ตัวอย่างฟอร์มปลายทางที่มี `r_status`, `r_teatment`, `soap_s`, `soap_o`, `soap_a`, `soap_p` |
| `config.toml`, `disease.json`, `EMR.json` | ไฟล์อ้างอิงของ workspace เดิม ห้ามแก้เพื่อ deploy โดยไม่ตรวจ environment และ version |

หมายเหตุ: JSON เป็น export ของ form builder ไม่ใช่ migration ที่รับประกันว่า form/database record ในทุก environment มีอยู่แล้ว ต้องตรวจ ID และ collection ใน environment ที่จะใช้งานจริงก่อน import หรือสร้างซ้ำ

## 3. Clinic Master ที่ทำไว้แล้ว

ไฟล์อ้างอิง: `clinic-master.json`

### 3.1 Form configuration

- `modelName`: `formData`
- `refName`: `sdForm`
- layout: `PC`
- `labelPosition`: `top`
- ยังไม่มี `functions`, `onFormCreated`, `onFormMounted`, `onFormDataChange` หรือ event ระดับฟอร์ม

ข้อสรุป: ส่วน UI และ field schema ถูกวางไว้แล้ว แต่ logic เชื่อมระบบทั้งหมดต้องทำต่อในฟอร์มปลายทาง/หน้าคิว/SQL/API Factory หรือ event ที่เหมาะสม

### 3.2 ฟิลด์หลัก

| ชื่อ field | ป้ายกำกับ | ชนิด/แหล่งข้อมูล | บังคับ | หน้าที่ |
|---|---|---|---|---|
| `code` | รหัสคลินิก | Text | ใช่ | key สำหรับอ้างอิง ต้องไม่ซ้ำ (`unique`, `code`) |
| `name` | ชื่อคลินิก | Text | ใช่ | ชื่อที่ผู้ใช้เห็น |
| `target_form` | ฟอร์มเป้าหมายของคลินิก | Select Data List จาก `sdform-db-list` | ใช่ | เลือก form ที่จะเปิด/ใช้บันทึกข้อมูล |
| `status_field` | ฟิลด์สถานะในฟอร์มเป้าหมาย | Select By Path | ใช่ | เลือก field จาก `target_form.form_db.schema` |
| `clinic_type` | ประเภทคลินิก | Static select | ใช่ | `outside_clinic`, `specialty_clinic`, `disease_clinic`, `external_service` |
| `owner_unit` | หน่วยงานรับผิดชอบ | Select By Form | ไม่ | เลือกหน่วยงานจาก form ID `6a3790c04cfbfdbe257f86fb` โดยกรอง `unit_type = 'clinic'` |
| `by_form` | ผูกข้อมูลตาม | Radio | ไม่ | `pid` = ผูกระดับผู้ป่วย, `vid` = ผูกระดับ visit; ค่าเริ่มต้นคือ `vid` |
| `owner_user` | มอบหมายให้ผู้ใช้ | Select Data List | ไม่ | ใช้ `user-list`, รองรับหลายผู้ใช้ และเก็บ object id |
| `status_options` | ตั้งค่าสถานะของคลินิก | Sub Form | ไม่ | รายการสถานะที่คลินิกกำหนดเอง |
| `status_options.op_value` | Value | Text | ไม่ | ค่าที่เก็บจริงในฟอร์มปลายทาง |
| `status_options.op_label` | Label | Text | ไม่ | ข้อความที่แสดงผู้ใช้ |
| `status_options.op_color` | สี | Static select | ไม่ | `primary`, `success`, `warning`, `danger`, `info` |
| `desc` | Description | Textarea | ไม่ | รายละเอียดคลินิก สูงสุด 200 ตัวอักษร |
| `sort` | Sort | Number | ไม่ | ลำดับการแสดง ค่าเริ่มต้น 0 |
| `enable` | Enable | Switch | ไม่ | เปิด/ปิดการใช้งาน master record ค่าเริ่มต้น `true` |
| `is_show` | แสดงทันที | Switch | ไม่ | ถ้า `true` ให้แสดง/ค้นพบคลินิกทันทีตามกติกาของหน้าปลายทาง |

### 3.3 ความหมายของการตั้งค่าที่สำคัญ

1. `code` คือ business key ห้ามเปลี่ยนเพื่อแก้ชื่อ หากมีข้อมูลใช้งานแล้ว ให้ปิด `enable` แล้วสร้าง record ใหม่เมื่อเป็นคนละคลินิก
2. `target_form` ต้องเป็น form ที่มีอยู่จริงและผู้ใช้มีสิทธิ์เข้าถึง
3. `status_field` ต้องเป็น field ใน schema ของ `target_form` และต้องใช้ค่าจริงของ field นั้น ไม่ใช่ label ภาษาไทย
4. ค่าใน `status_options.op_value` ต้องตรงกับค่าที่บันทึกใน `status_field` แบบตัวพิมพ์/ชนิดข้อมูลตรงกัน
5. `by_form = vid` หมายถึงข้อมูลแยกตาม visit; ถ้าเลือก `pid` ต้องออกแบบการป้องกันข้อมูลข้าม visit ให้ชัดเจนก่อนใช้งาน
6. `owner_unit` และ `owner_user` เป็น metadata สำหรับ routing/permission ต้องนำไปใช้จริงใน query และ action guard ไม่ใช่เก็บไว้เฉย ๆ
7. `enable = false` ไม่ควรลบ master record เพราะข้อมูลเดิมอาจอ้างถึง `_id` ของ record นี้

## 4. Flow ของ Clinic Master ที่ทำไว้แล้ว

### 4.1 การสร้าง/ตั้งค่าคลินิกโดยผู้ดูแล

1. เปิด form Clinic Master
2. กรอก `code` และ `name`
3. เลือก `clinic_type`
4. เลือก `target_form`
5. หลังเลือก target form ให้เลือก `status_field` จาก schema ที่โหลดได้
6. กำหนด `status_options` โดยใส่ value ที่ระบบเก็บจริง, label ที่ผู้ใช้เห็น และสี
7. เลือก `owner_unit` และ/หรือ `owner_user`
8. เลือก `by_form` ให้ตรงกับระดับข้อมูลที่ต้องการ
9. กำหนด `sort`, `enable`, `is_show`, `desc`
10. บันทึกและตรวจว่า record ถูกสร้างใน collection/form ที่กำหนด

### 4.2 การนำ master ไปใช้ (ส่วนที่ต้องทำต่อ)

1. หน้าลงทะเบียน/รับบริการโหลดเฉพาะ Clinic Master ที่ `enable = true`
2. กรองตามสิทธิ์ผู้ใช้/หน่วยงาน ถ้า user ไม่อยู่ใน `owner_user` และไม่อยู่ใน `owner_unit` ให้ไม่แสดงหรือไม่อนุญาตดำเนินการตาม policy
3. เมื่อเลือกคลินิก ให้เก็บอย่างน้อย `clinic.value` (ObjectId หรือ code ตามมาตรฐานที่ตกลง) และ `clinic.label` ใน visit/record ปลายทาง
4. อ่าน `target_form` เพื่อเปิด form ปลายทาง
5. อ่าน `status_field` และ `status_options` เพื่อสร้าง filter, badge, transition และ validation
6. ส่ง context ของผู้ป่วย/visit เช่น patient id, HN, VN/visit id และ clinic id เข้า form ปลายทาง
7. เมื่อบันทึก ให้ตรวจว่าข้อมูลอ้างอิงผู้ป่วยและ visit ไม่ถูกสลับ

ปัจจุบันใน `clinic-master.json` ยังไม่มี event/function ที่ทำข้อ 4.2 โดยอัตโนมัติ จึงถือเป็นงานค้างสำคัญ

## 5. Flow ธุรกิจเต็มรูปแบบจนจบกระบวนการ

```text
กำหนด master
  -> เปิดคลินิกและกำหนด target form/status/ผู้รับผิดชอบ
  -> ลงทะเบียนหรือค้นหาผู้รับบริการ
  -> สร้าง visit (VN) หรือเลือก visit เดิม
  -> เลือกคลินิกจาก Clinic Master
  -> ตรวจสิทธิ์หน่วยงาน/ผู้ใช้
  -> เปิด target form พร้อม patient + visit + clinic context
  -> บันทึกข้อมูลการตรวจ/การรักษา
  -> ตั้งสถานะตาม status_options
  -> แสดงคิว/รายการตาม clinic และ status
  -> ผู้รับผิดชอบดำเนินการและเปลี่ยนสถานะ
  -> ปิดงาน/บันทึกผล/ลงเวลา/ผู้ทำรายการ
  -> รายงานและ audit ย้อนหลัง
```

### 5.1 ขั้นตอนรายละเอียด

**A. Master data**

- Admin สร้าง/แก้ไข Clinic Master
- ตรวจ duplicate `code`, target form, status field และ status values
- เปิดใช้งานเมื่อผ่านการตรวจสอบเท่านั้น

**B. Registration และ visit**

- ค้นหาผู้ป่วยหรือสร้าง patient ตาม flow เดิม
- สร้าง/เลือก visit ที่ถูกต้อง
- เลือก clinic จาก master ที่ active
- บันทึก clinic reference แบบ value + label และเก็บ clinic master id เพื่อรองรับการเปลี่ยนชื่อในอนาคต

**C. Routing**

- ใช้ `owner_unit`/`owner_user` กำหนดผู้เห็นคิวและผู้ดำเนินการ
- ใช้ `target_form` เปิดฟอร์มเฉพาะคลินิก
- ส่ง `pid` หรือ `vid` ตาม `by_form`

**D. Clinical form**

- ฟอร์มปลายทางต้องมี field สถานะที่เลือกได้จาก Clinic Master
- ตัวอย่าง `ฟอร์มปลายทาง.json` มี `r_status` ค่า `1` = กำลังรักษา, `2` = หาย, `3` = เสียชีวิต และ `r_teatment` เป็น treatment option ที่บังคับกรอก
- ตัวอย่างนี้ยังไม่ถือว่าเป็น target form ของทุกคลินิก ต้องยืนยัน form id/collection จริงก่อนผูก
- บันทึก S/O/A/P หรือข้อมูลเฉพาะคลินิก พร้อม patient id, visit id, clinic id และผู้ทำรายการ

**E. Queue และ status**

- Query ต้องกรอง clinic id, active record, วันที่/visit และสถานะตามจริง
- ปุ่มสถานะต้องใช้ `op_value` ไม่ใช้ `op_label`
- เมื่อเปลี่ยนสถานะต้อง refresh list และเขียน audit
- ป้องกัน transition ที่ไม่อนุญาต เช่น ปิดงานก่อนกรอกข้อมูลบังคับ

**F. End process**

- ผู้รับผิดชอบกรอกผล/คำแนะนำ/ข้อมูลที่จำเป็น
- เปลี่ยนเป็นสถานะสุดท้ายตามกติกาคลินิก
- บันทึกเวลา ผู้ทำรายการ และเหตุผลการแก้ไขถ้ามี
- ทำให้ record ปรากฏในรายงาน/ประวัติผู้ป่วย
- ทดสอบเปิดย้อนหลังจาก patient, visit และ clinic แล้วได้ข้อมูลชุดเดียวกัน

## 6. งานที่ต้องทำต่อ (เรียงตามลำดับ)

### P0: ยืนยันข้อมูลก่อนพัฒนา

- [ ] ยืนยัน form/collection จริงของ Clinic Master ใน environment เป้าหมาย
- [ ] ยืนยัน form id และ database table ของทุก target form
- [ ] ยืนยันว่า `target_form` ต้องเก็บเป็น ObjectId, form id หรือ object value แบบใด
- [ ] ยืนยันมาตรฐาน clinic reference ใน visit เช่น `visit_clinic.value`, `visit_clinic.label`, `clinic_master_id`, `clinic_code`
- [ ] ยืนยันว่าแต่ละคลินิกผูกระดับ `pid` หรือ `vid`
- [ ] ยืนยันสถานะและ transition ที่อนุญาตของแต่ละคลินิก

### P1: ทำ integration หลัก

- [ ] เพิ่ม clinic selector ในหน้ารับบริการ/ลงทะเบียน/หน้าที่เริ่ม clinical workflow
- [ ] บันทึก clinic reference พร้อม patient/visit context
- [ ] ทำตัวเปิด `target_form` และส่ง parent/context ให้ถูกต้อง
- [ ] ทำ permission guard จาก `owner_unit` และ `owner_user`
- [ ] ทำ query/list ที่กรอง clinic และ status ได้
- [ ] ทำปุ่มเปลี่ยนสถานะและ refresh list หลังบันทึก

### P1: ทำ validation และ data integrity

- [ ] ห้ามบันทึกเมื่อ target form หรือ status field ถูกลบ/ปิดใช้งาน
- [ ] ตรวจชนิดข้อมูล status value เช่น string กับ number ต้องไม่ปนกัน
- [ ] ป้องกันการเปิดข้อมูลของคนไข้/visit คนอื่นด้วยการแก้ URL หรือ payload
- [ ] กำหนด duplicate rule ระหว่าง code, clinic type และช่วงเวลาที่ใช้งาน
- [ ] เก็บ created/updated by, timestamp และเหตุผลการแก้ไข

### P2: ทำหน้าจอและรายงาน

- [ ] หน้ารายการคลินิก: ค้นหา, sort, filter enable/disable, เปิด/ปิดใช้งาน
- [ ] หน้าคิวคลินิก: ตัวกรองสถานะ, วันที่, ผู้รับผิดชอบ และ visit
- [ ] หน้ารายละเอียด: ข้อมูลผู้ป่วย, visit, clinic, ประวัติการเปลี่ยนสถานะ
- [ ] รายงานจำนวนผู้รับบริการแยก clinic/status/ช่วงเวลา
- [ ] รองรับ export ตามสิทธิ์

### P2: ทดสอบและ deploy

- [ ] ทดสอบด้วย clinic อย่างน้อย 1 รายการต่อประเภท
- [ ] ทดสอบ target form ที่มี status field ต่างชื่อ/ต่างชุดค่า
- [ ] ทดสอบ `enable = false`, เปลี่ยนชื่อ, เปลี่ยนผู้รับผิดชอบ และเปลี่ยน target form
- [ ] ทดสอบสิทธิ์ admin, หน่วยงาน, user ที่ได้รับมอบหมาย และ user ที่ไม่มีสิทธิ์
- [ ] ทดสอบ duplicate submit, refresh, timeout และเปิดหลาย tab
- [ ] ทำ backup/export ก่อน import หรือแก้ form ใน production
- [ ] UAT กับผู้ใช้งานจริงและบันทึกผล sign-off

## 7. แนวทาง implement ใน initCraft

1. ตรวจ form id และ schema จาก Form Manage/SDForm ก่อนเขียน `Select By Path`
2. ใช้ `target_form` เป็น source ของ `status_field` ผ่าน `form_db.schema` ตามที่ตั้งไว้ใน JSON
3. ใน event ของปุ่ม/ฟอร์ม ใช้ชื่อ field ด้วย `this.refField("field_name")` และอ่านค่าด้วย `getValue()`/`setValue()` ตาม runtime ที่ระบบใช้งานจริง
4. สำหรับ List View ให้ตรวจ schema และ raw row จริงก่อนเขียน where; อย่าเดาชื่อ field จาก label
5. เมื่อเปลี่ยน where ของ list ที่ mount แล้ว ให้ update ตัวเลือกของ list และ editor state ที่ runtime ใช้ แล้วเรียก refresh
6. หาก logic เกิน event ของ form ให้แยกเป็น SQL Factory/API Factory โดยส่ง parameter ชัดเจน เช่น `clinic_id`, `visit_id`, `status`, `user_id`
7. ทดสอบในข้อมูลจำนวนน้อยก่อน แล้วค่อยเปิดใช้กับข้อมูลจริง

## 8. Data contract ที่ควรตกลงร่วมกัน

ตัวอย่างโครงสร้างเชิงตรรกะ (ปรับชื่อให้ตรง schema จริงก่อนใช้):

```json
{
  "clinic": {
    "value": "<clinic-master-id>",
    "code": "COVID",
    "label": "คลินิกโรคติดเชื้อ"
  },
  "patient_id": "<patient-id>",
  "visit_id": "<visit-id>",
  "status": "<status-op_value>",
  "target_form_id": "<form-id>",
  "created_by": "<user-id>",
  "updated_at": "<datetime>"
}
```

ห้ามใช้ `label` เป็น key หลัก เพราะชื่ออาจเปลี่ยนหรือสะกดต่างกันระหว่างภาษา ให้ใช้ master id/code และ status value เป็นตัวอ้างอิง

## 9. Acceptance checklist ก่อนปิดงาน

- [ ] สร้างคลินิกใหม่แล้วปรากฏใน selector ของผู้มีสิทธิ์
- [ ] ผู้ไม่มีสิทธิ์ไม่เห็นหรือไม่สามารถเปิดข้อมูลคลินิกนั้นได้
- [ ] เลือก target form แล้วเปิดฟอร์มถูกตัว
- [ ] status field ใน Clinic Master แสดงเฉพาะ field ของ target form
- [ ] status badge/ปุ่มใช้ค่าและสีจาก `status_options`
- [ ] บันทึกข้อมูลแล้วผูก patient/visit/clinic ถูกต้อง
- [ ] คิวกรองตาม clinic และ status ได้จริงหลัง refresh
- [ ] เปลี่ยนสถานะจนถึงสถานะสุดท้ายแล้ว record อยู่ในรายการปิดงาน/รายงาน
- [ ] เปิดประวัติย้อนหลังจาก patient, visit และ clinic ได้
- [ ] ปิดคลินิกแล้วข้อมูลเดิมยังเปิดย้อนหลังได้ แต่ไม่รับงานใหม่
- [ ] มี audit และผล UAT ที่ผู้รับผิดชอบลงชื่อรับรอง

## 10. จุดที่ต้องระวังในการรับช่วง

- อย่าเปลี่ยน `code` ของคลินิกที่มีข้อมูลอ้างอิงแล้วโดยไม่ทำ migration
- อย่าลบ `target_form` หรือ status field ที่ master ใช้อยู่โดยไม่จัดการ record เดิม
- อย่าใช้ label เช่น “กำลังรักษา” ไปทำ query แทน value เช่น `1`
- อย่าผูกข้อมูลด้วย HN อย่างเดียว ต้องมี patient id และ visit id ตามระดับที่ตกลง
- อย่าถือว่า `ฟอร์มปลายทาง.json` เป็น production target จนกว่าจะตรวจ form id และ collection จริง
- ถ้าเปลี่ยนจาก `vid` เป็น `pid` ต้องทดสอบผลกระทบต่อ visit ซ้ำและรายงานย้อนหลัง

## 11. Definition of Done

งานนี้ปิดได้เมื่อ P0/P1 ครบ, acceptance checklist ผ่านทุกข้อ, ผู้ใช้งานจริงทำ scenario ตั้งแต่เลือกคลินิกจนปิดงานได้ และมี export/backup กับเอกสาร mapping ของ form, collection, field และ status เก็บไว้ใน repository เดียวกับเอกสารนี้
