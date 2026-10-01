"""Build one import-ready X-ray Member master SDForm.

The form stores personnel master data only. It deliberately does not create
initCraft users, change X-ray Worklist behavior, update the Position master,
map 43-file provider types, or send values to RIS.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
PERSON_PATH = ROOT / "Form-Builder/SDForm/form-factory/forms/person.json"
FORM_CONFIG_PATH = ROOT / "Form-Builder/SDForm/form-factory/forms/Lab_Unit_Master.json"
TARGET_PATH = ROOT / "Form-Builder/SDForm/X-ray/xray-member-master-v1.json"


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def find_component(form, component, field_name=None):
    for node in walk(form):
        if node.get("component") != component:
            continue
        if field_name is None or node.get("options", {}).get("name") == field_name:
            return node
    raise RuntimeError(f"template not found: {component} / {field_name}")


with PERSON_PATH.open(encoding="utf-8") as source:
    person = json.load(source)
with FORM_CONFIG_PATH.open(encoding="utf-8") as source:
    form_config_source = json.load(source)


templates = {
    "grid": find_component(person, "grid"),
    "grid-col": find_component(person, "grid-col"),
    "text": find_component(person, "text-input", "p_fname"),
    "email": find_component(person, "text-input", "p_email"),
    "select": find_component(person, "select-input", "p_abogroup"),
    "prename": find_component(person, "select-form-input", "prename"),
}


serial = 99200


def clone_node(node, component=None):
    global serial
    serial += 1
    copied = copy.deepcopy(node)
    kind = component or copied.get("component", "field")
    copied["id"] = f"{kind}-xray-member-{serial}"
    if "key" in copied:
        copied["key"] = serial
    return copied


def text_field(
    name,
    label,
    *,
    span=8,
    required=False,
    placeholder="",
    email=False,
    hidden=False,
    on_mounted="",
):
    template = templates["email"] if email else templates["text"]
    node = clone_node(template, "text-input")
    node["options"].update({
        "name": name,
        "label": label,
        "defaultValue": "",
        "placeholder": placeholder,
        "columnSpan": span,
        "readonly": False,
        "disabled": False,
        "hidden": hidden,
        "clearable": True,
        "required": required,
        "requiredHint": f"กรุณาระบุ{label}" if required else "",
        "onCreated": "",
        "onMounted": on_mounted,
        "onUnmount": "",
        "onInput": "",
        "onChange": "",
        "onFocus": "",
        "onBlur": "",
        "onValidate": "",
        "onAppendButtonClick": "",
    })
    return node


def prename_field():
    """Reuse the system Person form's PRENAME lookup contract unchanged."""
    node = clone_node(templates["prename"], "select-form-input")
    node["options"].update({
        "name": "prename",
        "label": "คำนำหน้า",
        "defaultValue": None,
        "placeholder": "เลือกคำนำหน้า",
        "columnSpan": 8,
        "required": True,
        "requiredHint": "กรุณาเลือกคำนำหน้า",
        "onCreated": "",
        "onMounted": "",
        "onUnmount": "",
        "onChange": "",
        "onClear": "",
        "onFocus": "",
        "onBlur": "",
        "onValidate": "",
    })
    return node


def position_field():
    node = clone_node(templates["select"], "select-input")
    node["options"].update({
        "name": "position",
        "label": "ตำแหน่ง",
        "defaultValue": "",
        "placeholder": "เลือกตำแหน่ง",
        "columnSpan": 12,
        "disabled": False,
        "hidden": False,
        "clearable": True,
        "filterable": False,
        "allowCreate": False,
        "remote": False,
        "automaticDropdown": False,
        "multiple": False,
        "multipleLimit": None,
        "optionItems": [
            {"label": "นายแพทย์ชำนาญการ", "value": "RADIOLOGIST_PRO"},
            {"label": "นายแพทย์ชำนาญการพิเศษ", "value": "RADIOLOGIST_SENIOR"},
            {"label": "นักรังสีการแพทย์ชำนาญการ", "value": "RADIOGRAPHER_PRO"},
            {"label": "นักรังสีการแพทย์ปฏิบัติการ", "value": "RADIOGRAPHER_PRACTICE"},
            {"label": "อื่นๆ (แพทย์ภายนอก)", "value": "OTHER"},
        ],
        "required": True,
        "requiredHint": "กรุณาเลือกตำแหน่ง",
        "onCreated": "",
        "onMounted": "",
        "onUnmount": "",
        "onRemoteQuery": "",
        "onChange": (
            "const other = this.getFieldRef('position_other')\n"
            "if (!other) return\n"
            "if (value === 'OTHER') {\n"
            "  other.show()\n"
            "  other.setRequired(true, 'กรุณาระบุตำแหน่ง')\n"
            "} else {\n"
            "  other.setRequired(false, '')\n"
            "  other.setValue('')\n"
            "  other.hide()\n"
            "}\n"
        ),
        "onClear": "",
        "onFocus": "",
        "onBlur": "",
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


position_other_mounted = (
    "const position = this.getFieldRef('position')\n"
    "const isOther = position && position.getValue() === 'OTHER'\n"
    "if (isOther) {\n"
    "  this.show()\n"
    "  this.setRequired(true, 'กรุณาระบุตำแหน่ง')\n"
    "} else {\n"
    "  this.setRequired(false, '')\n"
    "  this.hide()\n"
    "}\n"
)

fields = [
    prename_field(),
    text_field("first_name", "ชื่อ", required=True, placeholder="กรอกชื่อ"),
    text_field("last_name", "สกุล", required=True, placeholder="กรอกนามสกุล"),
    text_field("email", "อีเมล", placeholder="example@hospital.go.th", email=True),
    position_field(),
    text_field(
        "position_other",
        "ระบุตำแหน่งอื่น",
        span=12,
        placeholder="กรอกตำแหน่งแพทย์ภายนอก",
        hidden=True,
        on_mounted=position_other_mounted,
    ),
    text_field(
        "professional_code",
        "รหัส ว. / รหัสประจำตำแหน่ง",
        span=12,
        placeholder="เว้นว่างได้ รอระบุรหัสภายหลัง",
    ),
]

root_grid = clone_node(templates["grid"], "grid")
root_grid["options"]["name"] = "xray_member_master_root"
root_grid["cols"] = [grid_col(field) for field in fields]

form = {
    "fields": [root_grid],
    "formConfig": copy.deepcopy(form_config_source["formConfig"]),
}
form["formConfig"].update({
    "modelName": "XrayMemberMasterForm",
    "refName": "xrayMemberMasterFormRef",
    "rulesName": "xrayMemberMasterRules",
    "labelWidth": 0,
    "labelPosition": "top",
    "size": "",
    "labelAlign": "label-left-align",
    "cssCode": "",
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

TARGET_PATH.write_text(
    json.dumps(form, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
print(TARGET_PATH)
