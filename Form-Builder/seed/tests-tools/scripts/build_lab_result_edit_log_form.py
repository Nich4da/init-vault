#!/usr/bin/env python3
"""Build the append-only LAB result correction log SDForm candidate.

The generated model intentionally reuses complete Builder-exported widget
definitions from LAB_result_item.json.  It is a storage/audit form: every field
is read-only and the Worklist API is the only approved writer.
"""

import json
from copy import deepcopy
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
SOURCE = ROOT / "Form-Builder/SDForm/Lab/LAB_result_item.json"
TARGET = ROOT / "Form-Builder/SDForm/Lab/lab-result-edit-log-v1.json"


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


model = json.loads(SOURCE.read_text(encoding="utf-8"))
nodes = list(walk(model))
grid_source = next(node for node in nodes if node.get("component") == "grid")
col_source = next(node for node in nodes if node.get("component") == "grid-col")
text_source = next(node for node in nodes if node.get("component") == "text-input")
textarea_source = next(node for node in nodes if node.get("component") == "textarea-input")

sequence = 97000


def next_number():
    global sequence
    sequence += 1
    return sequence


def make_field(component, name, label, *, span=12, hidden=False, required=False):
    source = textarea_source if component == "textarea-input" else text_source
    field = deepcopy(source)
    number = next_number()
    field["key"] = number
    field["id"] = f"{component}-lab-result-edit-log-{number}"
    field["fieldLength"] = 10000 if component == "textarea-input" else 500
    options = field["options"]
    options.update({
        "name": name,
        "label": label,
        "columnSpan": span,
        "defaultValue": None,
        "placeholder": "",
        "readonly": True,
        "disabled": False,
        "hidden": hidden,
        "required": required,
        "requiredHint": f"กรุณาระบุ{label}" if required else "",
        "customClass": "",
        "onCreated": "",
        "onMounted": "",
        "onUnmount": "",
        "onInput": "",
        "onChange": "",
        "onFocus": "",
        "onBlur": "",
        "onValidate": "",
    })
    if component == "textarea-input":
        options.update({"rows": 3, "autoSize": False, "showWordLimit": False})
    else:
        options.update({"clearable": False, "showPassword": False})
    return field


def make_col(spec):
    component, name, label, span, hidden, required = spec
    col = deepcopy(col_source)
    number = next_number()
    col["key"] = number
    col["id"] = f"grid-col-lab-result-edit-log-{number}"
    col["fields"] = [make_field(component, name, label, span=span, hidden=hidden, required=required)]
    col["options"].update({
        "name": f"{name}_col",
        "hidden": hidden,
        "span": span,
        "md": span,
        "sm": 24,
        "xs": 24,
        "customClass": "",
    })
    return col


# component, field name, label, span, hidden, required
field_specs = [
    ("text-input", "event_id", "Event ID", 12, True, True),
    ("text-input", "request_id", "Request ID", 12, True, False),
    ("text-input", "correction_group_id", "Correction Group ID", 12, True, True),
    ("text-input", "action", "การดำเนินการ", 8, False, True),
    ("text-input", "outcome", "ผลการดำเนินการ", 8, False, True),
    ("text-input", "source", "แหล่งที่มา", 8, False, True),
    ("text-input", "source_result_item_id", "Result Item ID", 12, True, True),
    ("text-input", "source_result_report_id", "Result Report ID", 12, True, False),
    ("text-input", "source_work_item_id", "LAB Work Item ID", 12, True, False),
    ("text-input", "source_cpoe_order_id", "CPOE Order ID", 12, True, False),
    ("text-input", "source_cpoe_item_id", "CPOE Item ID", 12, True, True),
    ("text-input", "order_number", "Order No.", 8, False, False),
    ("text-input", "lab_no", "LAB NO.", 8, False, False),
    ("text-input", "section_code", "LAB Section", 8, False, True),
    ("text-input", "hn", "HN", 8, False, False),
    ("text-input", "visit_id", "VN / Visit ID", 8, False, False),
    ("text-input", "test_code", "Test Code", 8, False, True),
    ("text-input", "obs_code", "OBS Code", 8, True, False),
    ("text-input", "test_name", "รายการตรวจ", 16, False, True),
    ("textarea-input", "correction_reason", "เหตุผลการแก้ไขผล", 24, False, False),
    ("textarea-input", "changed_fields_json", "Changed Fields JSON", 24, True, True),
    ("textarea-input", "before_result_value", "ค่าผลก่อนแก้", 12, False, False),
    ("textarea-input", "after_result_value", "ค่าผลหลังแก้", 12, False, False),
    ("text-input", "before_unit", "หน่วยก่อนแก้", 12, False, False),
    ("text-input", "after_unit", "หน่วยหลังแก้", 12, False, False),
    ("text-input", "before_interpretation", "แปลผลก่อนแก้", 12, False, False),
    ("text-input", "after_interpretation", "แปลผลหลังแก้", 12, False, False),
    ("textarea-input", "before_reference_range", "ค่าปกติก่อนแก้", 12, False, False),
    ("textarea-input", "after_reference_range", "ค่าปกติหลังแก้", 12, False, False),
    ("text-input", "corrected_by_user_id", "User ID ผู้แก้", 12, True, False),
    ("text-input", "corrected_by_username", "Username ผู้แก้", 8, False, True),
    ("text-input", "corrected_by_name", "ผู้แก้ไข", 8, False, True),
    ("text-input", "corrected_at", "เวลาแก้ไข", 8, False, True),
]

root = deepcopy(grid_source)
root["key"] = next_number()
root["id"] = "grid-lab-result-edit-log-v1"
root["options"].update({
    "name": "lab_result_edit_log_v1_root",
    "hidden": False,
    "gutter": 16,
    "customClass": "",
})
root["cols"] = [make_col(spec) for spec in field_specs]

output = {
    "fields": [root],
    "formConfig": deepcopy(model["formConfig"]),
}
output["formConfig"].update({
    "labelPosition": "top",
    "cssCode": ".lab-result-edit-log-v1 .el-form-item{margin-bottom:14px}",
    "customClass": ["lab-result-edit-log-v1"],
    "functions": "",
    "onFormCreated": "",
    "onFormMounted": "",
    "onParentChange": "",
    "onFormDataChange": "",
    "onFormUnmounted": "",
})

TARGET.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(TARGET)
