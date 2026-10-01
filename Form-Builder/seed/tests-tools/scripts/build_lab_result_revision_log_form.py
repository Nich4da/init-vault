#!/usr/bin/env python3
"""Build the immutable whole-result LAB revision log SDForm candidate.

The generated form follows the approved LAB Result Revision Log mock-up:
one accepted Agent callback becomes one immutable full-sheet snapshot.  Widget
definitions are cloned from the Builder-exported LAB Result Item form so the
candidate keeps the complete initCraft option shape required by the renderer.
"""

import json
from copy import deepcopy
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
SOURCE = ROOT / "Form-Builder/SDForm/Lab/LAB_result_item.json"
TARGET = ROOT / "Form-Builder/SDForm/Lab/lab-result-revision-log-v1.json"


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

sequence = 98000


def next_number():
    global sequence
    sequence += 1
    return sequence


def make_field(component, name, label, *, span=12, hidden=False, required=False):
    source = textarea_source if component == "textarea-input" else text_source
    field = deepcopy(source)
    number = next_number()
    field["key"] = number
    field["id"] = f"{component}-lab-result-revision-log-{number}"
    field["fieldLength"] = 50000 if component == "textarea-input" else 500
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
        options.update({"rows": 4, "autoSize": False, "showWordLimit": False})
    else:
        options.update({"clearable": False, "showPassword": False})
    return field


def make_col(spec):
    component, name, label, span, hidden, required = spec
    col = deepcopy(col_source)
    number = next_number()
    col["key"] = number
    col["id"] = f"grid-col-lab-result-revision-log-{number}"
    col["fields"] = [make_field(
        component, name, label, span=span, hidden=hidden, required=required
    )]
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
# Keep this schema aligned with the approved HTML contract in
# 02-his/ui/lab-result-visibility-policy-mockup.html.
field_specs = [
    ("text-input", "revision_id", "Revision ID", 12, True, True),
    ("text-input", "order_no", "Order No.", 8, False, True),
    ("text-input", "filler_order_no", "LAB NO.", 8, False, True),
    ("text-input", "result_uid", "Result UID", 8, False, True),
    ("text-input", "report_seq", "Report Sequence", 8, False, True),
    ("text-input", "stage", "Stage", 8, False, True),
    ("text-input", "receipt_seq", "Receipt Sequence", 8, False, False),
    ("text-input", "source_reported_at", "Source Reported At", 12, False, False),
    ("text-input", "received_at", "Received At", 12, False, True),
    ("text-input", "receipt_id", "Technical Receipt ID", 12, True, True),
    ("text-input", "report_id", "Result Report ID", 12, True, True),
    ("text-input", "previous_revision_id", "Previous Revision ID", 12, True, False),
    ("textarea-input", "items_snapshot_json", "Items Snapshot JSON", 24, False, True),
    ("text-input", "item_count", "Item Count", 8, False, True),
    ("text-input", "changed_item_count", "Changed Item Count", 8, False, True),
    ("text-input", "ingest_status", "Ingest Status", 8, False, True),
    ("text-input", "schema_version", "Schema Version", 8, False, True),
    ("text-input", "payload_hash", "Payload Hash", 16, True, True),
]

root = deepcopy(grid_source)
root["key"] = next_number()
root["id"] = "grid-lab-result-revision-log-v1"
root["options"].update({
    "name": "lab_result_revision_log_v1_root",
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
    "cssCode": ".lab-result-revision-log-v1 .el-form-item{margin-bottom:14px}",
    "customClass": ["lab-result-revision-log-v1"],
    "functions": "",
    "onFormCreated": "",
    "onFormMounted": "",
    "onParentChange": "",
    "onFormDataChange": "",
    "onFormUnmounted": "",
})

TARGET.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(TARGET)
