# Lab_CHE — เอกสารอ้างอิงหน่วยงานชีวเคมี

## แบบฟอร์มและสิ่งส่งตรวจ

หัวกระดาษ: งานชีวเคมี กลุ่มงานพยาธิวิทยาคลินิกและเทคนิคการแพทย์; สถาบันสุขภาพเด็กแห่งชาติมหาราชินี ตึกมหิตลาธิเบศร ชั้น 5 ห้อง 503 โทร 3505-7; เลขที่มองเห็น 148-1-8 / ม.ย.69 และ C-20 / L3.1

ช่องข้อมูล: Name, H.N., Age, Ward, Tel., แพทย์ที่สั่งตรวจ, Lab No. (สำหรับเจ้าหน้าที่ Lab เท่านั้น), ผู้เก็บตัวอย่าง, เวลาเก็บตัวอย่าง, Report by, สำหรับเจ้าหน้าที่การเงิน

สิ่งส่งตรวจ:
- Blood: Clotted, Ionized Calcium, Lithium heparin, NaF, EDTA
- Urine: spot หรือ 24 hr. พร้อมปริมาตร ml.
- CSF
- Body Fluid พร้อมระบุชนิด

## รายการตรวจและรหัส

- Liver: C1 Liver Function Test; C2 Protein; C3 Albumin; “สั่ง Globulin = C2 + C3”; C5.1 Bilirubin Total; C5.2 Bilirubin Direct; C6 AST (SGOT); C7 ALT (SGPT); C8 Alk. Phosphatase
- Special Liver: C34 Gamma GT (GGT); C64 Ammonia (NH3)
- Lipid: C4 Cholesterol; C29 Triglyceride; C30 HDL-Chol; C31 LDL-Chol
- Renal/Other: C20 BUN; C21 Creatinine; C22 Uric acid; C59 Lactate (NaF); C41 LDH; C42 CK (CPK) (Total)
- Diabetes: C23 Sugar (Glucose); C57 Insulin; C75 Blood Ketone (heparin); C35 Glucose Tolerance Test; C352–C356 GTT T1–T5 พร้อมช่องนาที
- Blood Gas/Electrolyte: C36 Blood Gas, E’lyte (iCa2+), Ionized Ca2+; C25 Electrolyte (Clot Blood); C25.1 Sodium; C25.2 Potassium; C25.3 Chloride; C25.4 CO2
- Trace: C26 Total Calcium; C28 Phosphorus; C33 Magnesium
- Iron: C71 Ferritin; C85 Serum Iron; C86 TIBC
- Pancreas: C32 Amylase; C51 Lipase; C53 Amylase Pancreatic
- Osmolality: C43 Serum; C44 Urine
- Urine: C9.1 Sodium; C9.2 Potassium; C9.3 Chloride; C12 Protein; C121 Protein 24 hr.; C13 Creatinine; C131 Creatinine 24 hr.; C58 Microalbumin; C10 Calcium; C11 Phosphorus; C15 Amylase; C16 BUN; C17 Uric acid; C19 Magnesium
- CSF: C24.2 Protein; C24.1 Sugar
- Body Fluid: C52 pH (Other Fluid)
- TDM: C45 Phenobarbital; C46 Phenytoin (Dilantin); C47 Valproic acid (Depakin); C48 Carbamazepin (Tegretol); C78 Vancomycin; C89 Theophylline (Aminophylline)
- Thyroid: C38 T3; C39 TSH; C40 Free T4
- Fertility: C61 Serum β-HCG; C62 LH; C63 FSH; C74 Estradiol (E2); C76 Testosterone; C79 Prolactin; C82 DHEAS
- Bone: C87 Vitamin D total; C77 PTH (intact)
- Cardiac: C83 CK-MB stat; C84 Troponin T; C93 NT-proBNP
- Inflammatory: C69 Procalcitonin
- Endocrine: C56 Cortisol
- Tumor: C55 AFP; C65 NSE (ส่งภายใน 1 ชม.)
- L1 Activated clotting time

## โมดูลเดิมที่ไม่ได้ใช้งาน

- 3.4.4.1 รายการแสดงของผู้ป่วยนัด (LAB)
- 3.4.4.3 รายการแสดงของผู้ป่วยส่งต่อ (LAB)
- 3.4.4.10 ส่ง Order Work List ไประบบ List และสั่งทั้งหมดโดยกดครั้งเดียว (LAB)
- 3.4.4.11 ประสาน IT out lab (PCT lab): สร้างรายละเอียดส่ง order และรับผลกลับเป็นไฟล์รูปภาพ (LAB)

## โมดูลที่ใช้งานแต่ไม่อยู่ในข้อมูลข้างต้น

1. Lab Request Monitoring
2. สถานะการสั่งแลบ
3. ข้อมูลห้องแลบ
4. บันทึกความเสี่ยง (หน่วยงาน)

## ความสามารถที่ HIS/LIS ต้องรองรับ

### Order และสถานะ
- LAB ที่แพทย์ order ล่วงหน้าขึ้น “รอรับเข้าดำเนินการ” อัตโนมัติเมื่อถึงวันนัด
- สร้าง order โดยติ๊กหลายรายการและเรียงตามใบส่งตรวจ
- หน้าหลักแยก รอรับเข้า / รับเข้าดำเนินการ / ออกผลแล้ว

### หน้ารอรับเข้า
- แก้ไข/ลบรายการ; เปลี่ยน LAB NO.; รับ LAB พร้อมเวลารับ
- ปฏิเสธสิ่งส่งตรวจพร้อมเหตุผลและชื่อผู้ปฏิเสธ
- ตรวจสิทธิการรักษา/สถานะชำระเงิน; พิมพ์ใบสั่งตรวจ

### ผลตรวจและ downtime
- หน้าออกผลแล้วแสดงผล, Comment, Ref. Range ตามลำดับ Report LIS
- เตือนค่าวิกฤติระดับ order และแต่ละรายการ
- แก้ไขหรือปกปิดผลในหน้าดูผล; พิมพ์ผล
- มีหน้าลงผล Manual และแสดงบน HIS เมื่อ LIS ล่มหรือใช้ไม่ได้ พร้อมพิมพ์ผล

### ข้อมูลผู้ป่วยเพื่อยืนยันตัวตน
ชื่อ-สกุล (Remark เมื่อเปลี่ยนชื่อ), วันเกิด, เลขบัตรประชาชน, ช่องทางติดต่อ, ที่อยู่, โทรศัพท์, ผู้ติดต่อ, สิทธิการรักษา, จุด Check in/Admit และนัดครั้งต่อไป

### หน้าดูผลแพทย์ (เมนูเดิม “สถานะการสั่งแลบ”)
- แสดงผล/Comment/Ref. Range ตาม Report LIS
- order ที่ออกผลบางส่วนให้รายการที่เหลือเป็น pending (รอผล)
- เตือนค่าวิกฤติตรง LAB NO.
- สำเนาพิมพ์ระบุ “สำเนาพิมพ์ออนไลน์”, ชื่อผู้พิมพ์, วันเวลา
- สำเนาออนไลน์ใช้ดูแลรักษาเท่านั้น; ใช้ทางกฎหมาย/ส่งภายนอกต้องเป็นฉบับจริงมีลายเซ็นนักเทคนิคการแพทย์
- หลายหน้ามีเลขหน้า เช่น page 1/2

### รายงาน ค้นคืน ความเสี่ยง และข้อมูลห้องแลบ
- รายงานรายเดือน: สถิติรายการตรวจทั้งหมด; จำนวน Order ตาม LAB NO. ที่ออกผล; จำนวนตาม Specimen type—เลือกวัน/เวลา แยก Ward/Clinic และ export Excel
- ค้นคืนผลโดยเลือกรายการตรวจและช่วงเวลาผล แล้ว export Excel
- บันทึกความเสี่ยง: ดึงรายงานความเสี่ยง/การปฏิเสธ และ export ตามแบบฟอร์ม
- ข้อมูลห้องแลบ: เพิ่ม comment เหตุผลปฏิเสธ; ตรวจ code ที่ HIS ส่ง LIS; ตรวจราคาค่าตรวจ ราคาต่อหน่วย และราคาเบิกได้ แยกสิทธิ

## ข้อจำกัดต้นฉบับ

เก็บ “Globulin = C2 + C3” และ “Carbamazepin” ตามเอกสาร ห้ามแก้ด้วยความรู้ภายนอกโดยไม่ยืนยัน ต้นฉบับไม่ให้ Ref. Range, หน่วย, ราคาจริง, เกณฑ์วิกฤติ, tube color, turnaround time หรือ API และบางขอบบรรทัดถูกตัดจึงห้ามเดา
## รูปแบบหน้ารับงาน CHE ที่ผู้ใช้ยืนยัน (2026-08-04)

- หน้า desktop ไม่มี sidebar และแบ่ง 3 tab: รอรับ, รับเข้าแล้ว, ออกผลแล้ว
- Order จากแพทย์เป็นจุดเริ่มต้น ต้องเก็บเวลาส่ง; เมื่อกดรับสิ่งส่งตรวจให้สร้าง/แสดง LAB NO. และบันทึกเวลารับเป็นเวลาปัจจุบัน ห้ามนำเวลาส่งเดิมมาใช้เป็นเวลารับ
- หน้า รับเข้าแล้ว แสดงคิวผู้ป่วยด้านซ้ายและ List Order ของ HN ที่เลือกด้านขวา
- วางปุ่ม แก้ไขรายการส่งตรวจ ข้าง ปฏิเสธสิ่งส่งตรวจ
- Popup แก้ไขใช้รายการและการแบ่งหมวดจาก C:UsersmarniDownloadsLab_CHE_Order_Component_price_update.before_gtt_minutes.json (field lab_che_order_ui) จนกว่าจะยืนยันไฟล์ final อื่น
- Popup จำ baseline รายการแพทย์สั่งและติ๊กไว้พร้อมป้าย แพทย์สั่งเดิม; รองรับค้นหา กรองหมวด เลือกรายการ และเลือกทั้งหมวด
- ก่อนบันทึกต้องมีการเปลี่ยนแปลงจริงและระบุเหตุผล
- หลังบันทึกให้อัปเดต List Order ของ HN ทันทีและเก็บ audit history: เวลา ผู้แก้ เหตุผล รายการเพิ่มสีเขียว และรายการลบสีแดง
- อย่า hard-code ชื่อผู้ใช้งานบนหัวหน้า UI; ถ้าต้องแสดงผู้แก้ใน audit ให้ดึงจาก runtime user context ในงาน production