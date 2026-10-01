"""Build the import-ready LAB reject/cancel reason settings SDForm.

The form stores one selectable reason per record.  Reasons are retired by
turning ``is_active`` off instead of deleting the row, so historical orders can
retain their original reason code/text after the Worklist is wired later.

This builder only creates the data-entry form.  It intentionally does not wire
the form into the LAB Worklist or change any existing rejection/cancellation
flow.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
PERSON_PATH = ROOT / "Form-Builder/SDForm/form-factory/forms/person.json"
INBOUND_PATH = ROOT / "Form-Builder/SDForm/form-factory/forms/Lab_Result_Inbound_Receive.json"
TARGET_PATH = ROOT / "Form-Builder/SDForm/Lab/lab-reject-cancel-reason-settings-v1.json"


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
    "text-input": editable_template("text-input"),
    "textarea-input": editable_template("textarea-input"),
    "number-input": editable_template("number-input"),
    "select-input": editable_template("select-input"),
    "switch-input": editable_template("switch-input"),
}

serial = 98600


def next_serial():
    global serial
    serial += 1
    return serial


def clone_node(node, component=None):
    copied = copy.deepcopy(node)
    current = next_serial()
    kind = component or copied.get("component", "field")
    copied["id"] = f"{kind}-lab-reason-{current}"
    if "key" in copied:
        copied["key"] = current
    return copied


def text_field(name, label, *, span=12, required=False, readonly=False, placeholder=""):
    node = clone_node(templates["text-input"], "text-input")
    node["fieldLength"] = 500
    node["options"].update({
        "name": name,
        "label": label,
        "defaultValue": "",
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


def number_field(name, label, *, default, minimum, maximum, span=12):
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


def select_field(name, label, option_items, *, default, span=12):
    node = clone_node(templates["select-input"], "select-input")
    node["options"].update({
        "name": name,
        "label": label,
        "defaultValue": default,
        "placeholder": "เลือกหนึ่งรายการ",
        "columnSpan": span,
        "disabled": False,
        "hidden": False,
        "clearable": False,
        "filterable": True,
        "allowCreate": False,
        "remote": False,
        "automaticDropdown": False,
        "multiple": False,
        "multipleLimit": None,
        "optionItems": option_items,
        "required": True,
        "requiredHint": f"กรุณาเลือก {label}",
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


def switch_field(name, label, *, default=True, span=12):
    node = clone_node(templates["switch-input"], "switch-input")
    node["options"].update({
        "name": name,
        "label": label,
        "defaultValue": default,
        "columnSpan": span,
        "disabled": False,
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


reason_types = [
    {"label": "ปฏิเสธสิ่งส่งตรวจ", "value": "SPECIMEN_REJECT"},
    {"label": "ยกเลิก Order / รายการสั่งตรวจ", "value": "ORDER_CANCEL"},
]

section_options = [
    {"label": "ALL — ใช้ได้ทุกห้อง LAB", "value": "ALL"},
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

fields = [
    select_field(
        "reason_type",
        "ประเภทเหตุผล",
        reason_types,
        default="SPECIMEN_REJECT",
    ),
    select_field(
        "section_code",
        "ใช้กับห้อง LAB",
        section_options,
        default="ALL",
    ),
    text_field(
        "reason_code",
        "รหัสเหตุผล (ใช้เชื่อม API และไม่ควรเปลี่ยนหลังเริ่มใช้)",
        required=True,
        placeholder="เช่น REJECT_SAMPLE_QUALITY",
    ),
    text_field(
        "reason_text",
        "ข้อความเหตุผลที่แสดงให้ผู้ใช้เลือก",
        required=True,
        placeholder="ระบุข้อความภาษาไทยที่ชัดเจน",
    ),
    number_field(
        "display_order",
        "ลำดับการแสดง (เลขน้อยอยู่ก่อน)",
        default=10,
        minimum=1,
        maximum=9999,
    ),
    switch_field(
        "is_active",
        "เปิดใช้งานเหตุผลนี้ (ปิด = ไม่แสดงให้เลือกใหม่ แต่ประวัติเดิมยังอยู่)",
        default=True,
    ),
    textarea_field(
        "internal_note",
        "หมายเหตุภายใน (ไม่แสดงในตัวเลือก)",
        placeholder="ระบุรายละเอียดสำหรับผู้ดูแลระบบ หากมี",
        rows=3,
    ),
    textarea_field(
        "management_guidance",
        "วิธีจัดการรายการเหตุผล",
        default=(
            "หนึ่ง record ใช้กับหนึ่งประเภทเหตุผลเท่านั้น หากข้อความเดียวกันใช้ทั้งการปฏิเสธสิ่งส่งตรวจและยกเลิก Order "
            "ให้สร้างแยกสอง record เมื่อไม่ต้องการให้เลือกเหตุผลเดิมอีก ให้ปิด ‘เปิดใช้งานเหตุผลนี้’ แทนการลบ "
            "เพื่อให้ Order และประวัติเดิมยังอ้างอิงรหัสและข้อความเดิมได้"
        ),
        readonly=True,
        rows=4,
    ),
]

root_grid = clone_node(templates["grid"], "grid")
root_grid["options"].update({
    "name": "lab_reason_settings_root",
    "hidden": False,
    "gutter": 18,
    "colHeight": None,
    "customClass": "",
})
root_grid["cols"] = [grid_col(field) for field in fields]

form = {
    "fields": [root_grid],
    "formConfig": copy.deepcopy(inbound["formConfig"]),
}
form["formConfig"].update({
    "modelName": "LabReasonSettingsForm",
    "refName": "labReasonSettingsFormRef",
    "rulesName": "labReasonSettingsRules",
    "labelWidth": 0,
    "labelPosition": "top",
    "size": "",
    "labelAlign": "label-left-align",
    "cssCode": ".el-form{max-width:980px;margin:0 auto;}\n.el-form-item__label{font-weight:600;line-height:1.45;}\n",
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

TARGET_PATH.write_text(json.dumps(form, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(TARGET_PATH)
