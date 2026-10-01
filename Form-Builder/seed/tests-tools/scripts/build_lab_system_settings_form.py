"""Build the import-ready LAB System Settings SDForm.

The form stores one effective settings profile per scope.  `ALL` is the global
fallback; a Section-specific active profile may override it after the LAB APIs
are wired to read this form.  Runtime wiring is intentionally outside this
builder so importing the form alone cannot change an established LAB flow.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
PERSON_PATH = ROOT / "Form-Builder/SDForm/form-factory/forms/person.json"
INBOUND_PATH = ROOT / "Form-Builder/SDForm/form-factory/forms/Lab_Result_Inbound_Receive.json"
TARGET_PATH = ROOT / "Form-Builder/SDForm/Lab/lab-system-settings-v1.json"


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def components(form, component):
    return [node for node in walk(form) if node.get("component") == component]


with PERSON_PATH.open(encoding="utf-8") as source:
    person = json.load(source)
with INBOUND_PATH.open(encoding="utf-8") as source:
    inbound = json.load(source)


def editable_template(component):
    candidates = components(inbound, component) + components(person, component)
    for node in candidates:
        options = node.get("options", {})
        if not options.get("disabled", False) and not options.get("readonly", False):
            return node
    if candidates:
        return candidates[0]
    raise RuntimeError(f"template component not found: {component}")


templates = {
    "grid": components(person, "grid")[0],
    "grid-col": components(person, "grid-col")[0],
    "tab": components(person, "tab")[0],
    "text-input": editable_template("text-input"),
    "textarea-input": editable_template("textarea-input"),
    "number-input": editable_template("number-input"),
    "select-input": editable_template("select-input"),
    "switch-input": editable_template("switch-input"),
}
tab_pane_templates = components(person, "tab-pane")

serial = 97500


def next_serial():
    global serial
    serial += 1
    return serial


def clone_node(node, component=None):
    copied = copy.deepcopy(node)
    current = next_serial()
    kind = component or copied.get("component", "field")
    copied["id"] = f"{kind}-lab-settings-{current}"
    if "key" in copied:
        copied["key"] = current
    return copied


def text_field(name, label, *, default="", span=12, required=False,
               readonly=False, placeholder=""):
    node = clone_node(templates["text-input"], "text-input")
    node["fieldLength"] = 500
    node["options"].update({
        "name": name,
        "label": label,
        "defaultValue": default,
        "placeholder": placeholder,
        "columnSpan": span,
        "readonly": readonly,
        "disabled": False,
        "hidden": False,
        "clearable": not readonly,
        "required": required,
        "requiredHint": f"กรุณาระบุ {label}" if required else "",
        "validation": "",
        "validationHint": "",
        "minLength": None,
        "maxLength": 500,
        "showWordLimit": False,
        "onCreated": "",
        "onMounted": "",
        "onUnmount": "",
        "onInput": "",
        "onChange": "",
        "onFocus": "",
        "onBlur": "",
        "onValidate": "",
        "onAppendButtonClick": "",
    })
    return node


def textarea_field(name, label, *, default="", span=24, readonly=False,
                   rows=4, placeholder=""):
    node = clone_node(templates["textarea-input"], "textarea-input")
    node["fieldLength"] = 4000
    node["options"].update({
        "name": name,
        "label": label,
        "defaultValue": default,
        "placeholder": placeholder,
        "columnSpan": span,
        "rows": rows,
        "readonly": readonly,
        "disabled": False,
        "hidden": False,
        "required": False,
        "requiredHint": "",
        "validation": "",
        "validationHint": "",
        "minLength": None,
        "maxLength": 4000,
        "showWordLimit": not readonly,
        "onCreated": "",
        "onMounted": "",
        "onUnmount": "",
        "onInput": "",
        "onChange": "",
        "onFocus": "",
        "onBlur": "",
        "onValidate": "",
    })
    return node


def number_field(name, label, *, default, minimum, maximum, span=8):
    node = clone_node(templates["number-input"], "number-input")
    node["options"].update({
        "name": name,
        "label": label,
        "defaultValue": default,
        "placeholder": str(default),
        "columnSpan": span,
        "disabled": False,
        "hidden": False,
        "required": True,
        "requiredHint": f"กรุณาระบุ {label}",
        "validation": "",
        "validationHint": "",
        "min": minimum,
        "max": maximum,
        "precision": 0,
        "step": 1,
        "onCreated": "",
        "onMounted": "",
        "onUnmount": "",
        "onChange": "",
        "onFocus": "",
        "onBlur": "",
        "onValidate": "",
    })
    return node


def select_field(name, label, options, *, default, span=12, required=True):
    node = clone_node(templates["select-input"], "select-input")
    node["options"].update({
        "name": name,
        "label": label,
        "defaultValue": default,
        "placeholder": "เลือกหนึ่งรายการ",
        "columnSpan": span,
        "disabled": False,
        "hidden": False,
        "clearable": not required,
        "filterable": True,
        "allowCreate": False,
        "remote": False,
        "automaticDropdown": False,
        "multiple": False,
        "multipleLimit": None,
        "optionItems": options,
        "required": required,
        "requiredHint": f"กรุณาเลือก {label}" if required else "",
        "validation": "",
        "validationHint": "",
        "onCreated": "",
        "onMounted": "",
        "onUnmount": "",
        "onRemoteQuery": "",
        "onChange": "",
        "onClear": "",
        "onFocus": "",
        "onBlur": "",
        "onValidate": "",
    })
    return node


def switch_field(name, label, *, default, span=12, disabled=False):
    node = clone_node(templates["switch-input"], "switch-input")
    node["options"].update({
        "name": name,
        "label": label,
        "defaultValue": default,
        "columnSpan": span,
        "disabled": disabled,
        "hidden": False,
        "onCreated": "",
        "onMounted": "",
        "onUnmount": "",
        "onChange": "",
        "onValidate": "",
    })
    return node


def grid_col(field):
    node = clone_node(templates["grid-col"], "grid-col")
    span = int(field.get("options", {}).get("columnSpan", 24) or 24)
    node["options"].update({
        "name": f'{field["options"]["name"]}_col',
        "hidden": False,
        "span": span,
        "offset": 0,
        "push": 0,
        "pull": 0,
        "responsive": False,
        "md": 12 if span <= 12 else 24,
        "sm": 24,
        "xs": 24,
        "bgColor": None,
        "customClass": "",
    })
    node["fields"] = [field]
    return node


def grid(fields, name):
    node = clone_node(templates["grid"], "grid")
    node["options"].update({
        "name": name,
        "hidden": False,
        "gutter": 18,
        "colHeight": None,
        "customClass": "",
    })
    node["cols"] = [grid_col(field) for field in fields]
    return node


def tab_pane(index, name, label, fields, active=False):
    template = tab_pane_templates[index % len(tab_pane_templates)]
    node = clone_node(template, "tab-pane")
    node["options"].update({
        "name": name,
        "label": label,
        "hidden": False,
        "active": active,
        "disabled": False,
        "customClass": "",
    })
    node["fields"] = [grid(fields, f"{name}_grid")]
    return node


section_options = [
    {"label": "ALL — ค่ากลางสำหรับทุกห้อง LAB", "value": "ALL"},
    {"label": "BC — Biochemistry", "value": "BC"},
    {"label": "BB — Blood Bank", "value": "BB"},
    {"label": "ML — Microscopy", "value": "ML"},
    {"label": "HM — Hematology", "value": "HM"},
    {"label": "HH — Hemoglobin / Hematology", "value": "HH"},
    {"label": "MB — Microbiology", "value": "MB"},
    {"label": "IM — Immunology", "value": "IM"},
    {"label": "MI-OUT — Immunology ส่งตรวจนอก", "value": "MI-OUT"},
    {"label": "MY — Manual-result room", "value": "MY"},
    {"label": "BG — Blood Gas", "value": "BG"},
]

scope_fields = [
    text_field(
        "profile_code",
        "รหัสชุดการตั้งค่า (ใช้ระบุชุดนี้ใน API)",
        default="LAB_DEFAULT",
        required=True,
        placeholder="เช่น LAB_DEFAULT หรือ LAB_IM",
    ),
    text_field(
        "profile_name",
        "ชื่อชุดการตั้งค่า (ชื่อที่ผู้ดูแลอ่านเข้าใจ)",
        default="ค่ากลางระบบ LAB",
        required=True,
        placeholder="เช่น ค่ากลางทุกห้อง หรือ ห้องภูมิคุ้มกัน",
    ),
    select_field(
        "setting_scope",
        "ชุดนี้ใช้กับทุกห้องหรือเฉพาะห้องเดียว",
        [
            {"label": "ใช้เป็นค่ากลางสำหรับทุกห้อง LAB", "value": "GLOBAL"},
            {"label": "ใช้เฉพาะห้อง LAB ที่เลือก", "value": "SECTION"},
        ],
        default="GLOBAL",
    ),
    select_field(
        "section_code",
        "ห้อง LAB ที่ใช้ชุดนี้ (เลือก ALL เมื่อเป็นค่ากลาง)",
        section_options,
        default="ALL",
    ),
    switch_field(
        "is_active",
        "เปิดใช้ชุดการตั้งค่านี้ (ปิด = API ต้องข้ามชุดนี้)",
        default=True,
    ),
    number_field(
        "setting_version",
        "เวอร์ชันของชุดการตั้งค่า",
        default=1,
        minimum=1,
        maximum=9999,
        span=12,
    ),
    textarea_field(
        "configuration_guidance",
        "วิธีใช้ชุดการตั้งค่า",
        default=(
            "สร้างชุด ALL ไว้เป็นค่ากลางหนึ่งชุด แล้วสร้างชุดเฉพาะห้องเมื่อห้องนั้นต้องใช้ค่าไม่เหมือนส่วนกลาง "
            "API ต้องเลือกชุดเฉพาะห้องก่อน และใช้ ALL เป็น fallback เมื่อไม่พบชุดเฉพาะห้อง"
        ),
        readonly=True,
        rows=3,
    ),
]

worklist_fields = [
    switch_field(
        "show_create_order_button",
        "แสดงปุ่ม “สร้างรายการใหม่” บน Worklist (ปิด = สร้าง Order จากหน้านี้ไม่ได้)",
        default=True,
    ),
    switch_field(
        "cross_section_lookup_enabled",
        "เปิดสืบค้นผล LAB ข้ามห้องแบบอ่านอย่างเดียว (ปิด = เห็นเฉพาะห้องตนเอง)",
        default=True,
    ),
    switch_field(
        "auto_refresh_enabled",
        "รีเฟรชรายการอัตโนมัติ (ปิด = ผู้ใช้กดปุ่มรีเฟรชเอง)",
        default=False,
    ),
    number_field(
        "auto_refresh_seconds",
        "รีเฟรชอัตโนมัติทุกกี่วินาที (ใช้เมื่อเปิดรีเฟรชอัตโนมัติ)",
        default=30,
        minimum=15,
        maximum=300,
        span=12,
    ),
    number_field(
        "worklist_page_size",
        "จำนวน Order เริ่มต้นต่อหน้า (10–100)",
        default=30,
        minimum=10,
        maximum=100,
        span=12,
    ),
    switch_field(
        "cbc_swap_enabled",
        "แสดงเมนูสลับ CBC ระหว่าง HM และ ML (API ยังตรวจสิทธิ์สองห้องนี้เสมอ)",
        default=True,
    ),
]

order_fields = [
    switch_field(
        "bulk_select_all_enabled",
        "แสดงปุ่ม “เลือกทั้งหมด” ตอนสร้างรายการ (ปิด = เลือกรายการทีละข้อ)",
        default=True,
    ),
    switch_field(
        "specimen_editable_before_receive",
        "อนุญาตให้เปลี่ยน Specimen ก่อนรับ (ปิด = แสดงค่าเดิมแต่กดเปลี่ยนไม่ได้)",
        default=True,
    ),
    switch_field(
        "source_specimen_required",
        "บังคับกรอก Source of specimen ก่อนบันทึก (ปิด = เว้นว่างได้)",
        default=False,
    ),
    switch_field(
        "labno_generate_on_order_enabled",
        "ออก LAB No. ตั้งแต่ส่งคำสั่งตรวจ — เฉพาะ IM และยังรอทีมยืนยัน",
        default=False,
        disabled=True,
    ),
    textarea_field(
        "order_setting_note",
        "หมายเหตุสำหรับการตั้งค่าสั่งตรวจและ Specimen (ไม่บังคับ)",
        placeholder="ระบุเหตุผลหรือขอบเขตที่ต้องการให้ทีมตรวจสอบก่อนเชื่อม API",
        rows=3,
    ),
]

result_fields = [
    switch_field(
        "manual_result_entry_enabled",
        "อนุญาตกรอกผล Manual หลังรับ Specimen (ปิด = ดูผลได้แต่กรอกใหม่ไม่ได้)",
        default=True,
    ),
    switch_field(
        "result_correction_enabled",
        "อนุญาตแก้ไขผลที่ออกแล้ว (เปิด = ต้องบันทึก LAB Result Edit Log ทุกครั้ง)",
        default=True,
    ),
    switch_field(
        "correction_reason_required",
        "บังคับกรอกเหตุผลเมื่อแก้ไขผล (ปิด = เหตุผลไม่บังคับตาม flow ปัจจุบัน)",
        default=False,
    ),
    switch_field(
        "result_visibility_control_enabled",
        "แสดงปุ่มปกปิด/ยกเลิกปกปิดผลทั่วไป (ไม่เปลี่ยนกติกา Sensitive)",
        default=True,
    ),
    switch_field(
        "result_attachment_enabled",
        "อนุญาตแนบไฟล์ผลตรวจ (ปิด = ซ่อนส่วนอัปโหลด แต่ไฟล์เดิมยังอ่านได้ตามสิทธิ์)",
        default=True,
    ),
    switch_field(
        "revision_viewer_enabled",
        "แสดงประวัติผลทั้งใบจาก Agent (ปิด = ซ่อนหน้าดูประวัติ แต่ยังต้องเก็บ Revision Log)",
        default=True,
    ),
    switch_field(
        "result_pdf_enabled",
        "แสดงปุ่ม PDF ผลตรวจ (ปิด = ไม่สร้าง PDF จากหน้าผล LAB)",
        default=True,
    ),
    number_field(
        "revision_display_limit",
        "จำนวน Revision สูงสุดที่โหลดมาแสดง (1–200)",
        default=200,
        minimum=1,
        maximum=200,
        span=12,
    ),
    number_field(
        "attachment_max_files",
        "จำนวนไฟล์แนบสูงสุดต่อผลตรวจ (ลดได้ แต่ห้ามเกิน 10)",
        default=10,
        minimum=1,
        maximum=10,
        span=8,
    ),
    number_field(
        "attachment_max_file_mb",
        "ขนาดสูงสุดต่อไฟล์เป็น MB (ลดได้ แต่ห้ามเกิน 10)",
        default=10,
        minimum=1,
        maximum=10,
        span=8,
    ),
    number_field(
        "attachment_max_total_mb",
        "ขนาดรวมไฟล์แนบเป็น MB (ลดได้ แต่ห้ามเกิน 50)",
        default=50,
        minimum=1,
        maximum=50,
        span=8,
    ),
    number_field(
        "sensitive_reauth_seconds",
        "เวลาที่แพทย์ดูผล Sensitive ได้หลังยืนยันตัวตน (30–300 วินาที)",
        default=300,
        minimum=30,
        maximum=300,
        span=12,
    ),
]

report_fields = [
    text_field(
        "order_request_report_id",
        "Report ID สำหรับใบสั่งตรวจ LAB",
        default="6a977ac8422c1ca959829f97",
        placeholder="ObjectId 24 ตัวอักษร",
    ),
    text_field(
        "hn_label_report_id",
        "Report ID สำหรับป้าย HN",
        default="6a9a355c422c1ca95982a1a2",
        placeholder="ObjectId 24 ตัวอักษร",
    ),
    text_field(
        "lab_result_pdf_report_id",
        "Report ID สำหรับ PDF ผล LAB ทั่วไป",
        default="6aa8f5a8b92813319a86ea11",
        placeholder="ObjectId 24 ตัวอักษร",
    ),
    text_field(
        "microbiology_result_pdf_report_id",
        "Report ID สำหรับ PDF ผล Microbiology",
        default="6ab1c2d3e4f5061728394a5b",
        placeholder="ObjectId 24 ตัวอักษร",
    ),
    textarea_field(
        "report_setting_note",
        "หมายเหตุการเปลี่ยน Report ID (ไม่บังคับ)",
        placeholder="ควรทดสอบ Preview ของ Report ใหม่ก่อนเปิดใช้จริง",
        rows=3,
    ),
]

audit_fields = [
    textarea_field(
        "protected_rules_note",
        "กติกาความปลอดภัยที่ฟอร์มนี้ไม่อนุญาตให้ปิด",
        default=(
            "1) ตรวจสิทธิ์ผู้ใช้และขอบเขตห้อง LAB ฝั่ง API\n"
            "2) ปกปิดผล Sensitive และให้แพทย์ยืนยันตัวตน\n"
            "3) บันทึก Receipt, Revision Log, Edit Log และ Sensitive Access Log\n"
            "4) กันผลซ้ำ ตรวจ result_uid/report_seq และ mapping Order/LAB No./Result Item\n"
            "5) รับ Specimen ก่อนกรอกผล และตรวจสถานะ Final/Completed\n"
            "6) API ใช้ hard safety cap ของไฟล์แนบ แม้ค่าหน้าจอจะถูกตั้งสูงกว่า"
        ),
        readonly=True,
        rows=8,
    ),
    textarea_field(
        "change_note",
        "เหตุผลหรือรายละเอียดการเปลี่ยนชุดการตั้งค่า (ไม่บังคับ)",
        placeholder="ตัวอย่าง: ปิดการเปลี่ยน Specimen เฉพาะห้อง IM ตามมติทีม LAB",
        rows=4,
    ),
]

tab = clone_node(templates["tab"], "tab")
tab["options"].update({
    "name": "lab_system_settings_tabs",
    "hidden": False,
    "displayType": "border-card",
    "tabPosition": "top",
    "customClass": "",
    "lazy": False,
})
tab["tabs"] = [
    tab_pane(0, "settings_scope", "ขอบเขตการใช้งาน", scope_fields, active=True),
    tab_pane(1, "settings_worklist", "รายการและการค้นหา", worklist_fields),
    tab_pane(2, "settings_order", "สั่งตรวจและ Specimen", order_fields),
    tab_pane(3, "settings_result", "ผลตรวจและประวัติ", result_fields),
    tab_pane(4, "settings_report", "Report และ PDF", report_fields),
    tab_pane(5, "settings_audit", "ข้อจำกัดและหมายเหตุ", audit_fields),
]

root_grid = clone_node(templates["grid"], "grid")
root_grid["options"].update({
    "name": "lab_system_settings_root",
    "hidden": False,
    "gutter": 0,
    "colHeight": None,
    "customClass": "",
})
root_col = clone_node(templates["grid-col"], "grid-col")
root_col["options"].update({
    "name": "lab_system_settings_root_col",
    "hidden": False,
    "span": 24,
    "offset": 0,
    "push": 0,
    "pull": 0,
    "responsive": False,
    "md": 24,
    "sm": 24,
    "xs": 24,
    "bgColor": None,
    "customClass": "",
})
root_col["fields"] = [tab]
root_grid["cols"] = [root_col]

form = {
    "fields": [root_grid],
    "formConfig": copy.deepcopy(inbound["formConfig"]),
}
form["formConfig"].update({
    "modelName": "LabSystemSettingsForm",
    "refName": "labSystemSettingsFormRef",
    "rulesName": "labSystemSettingsRules",
    "labelWidth": 0,
    "labelPosition": "top",
    "size": "",
    "labelAlign": "label-left-align",
    "cssCode": ".el-form{max-width:1180px;margin:0 auto;}\n.el-form-item__label{font-weight:600;line-height:1.45;}\n",
    "customClass": [],
    "functions": "",
    "layoutType": "PC",
    "jsonVersion": 3,
    "onFormCreated": "",
    "onFormMounted": "",
    "onParentChange": "",
    "onFormDataChange": "",
    "onFormUnmounted": "",
})

TARGET_PATH.parent.mkdir(parents=True, exist_ok=True)
with TARGET_PATH.open("w", encoding="utf-8") as target:
    json.dump(form, target, ensure_ascii=False, indent=2)
    target.write("\n")

print(TARGET_PATH)
