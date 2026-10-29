"""Build import-ready X-ray rejection settings and rejection record forms.

Both outputs are derived from working initCraft exports already present in the
repository.  The settings form stores one selectable reason per record; the
record form is the audit document opened by the X-ray Worklist before the
status-changing reject Process is called.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
LAB_SETTINGS = ROOT / "Form-Builder/SDForm/Lab/lab-reject-cancel-reason-settings-v1.json"
AUTO_NUMBER_TEMPLATE = ROOT / "Form-Builder/SDForm/Lab/lab-manual-result-detail-settings-v1.json"
LAB_REJECTION = ROOT / "Form-Builder/SDForm/form-factory/forms/Lab_Bio_Rejection.json"
SETTINGS_TARGET = ROOT / "Form-Builder/SDForm/X-ray/xray-reject-reason-settings-v1.json"
REJECTION_TARGET = ROOT / "Form-Builder/SDForm/X-ray/xray-rejection-record-v1.json"


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def field_name(node):
    return (node.get("options") or {}).get("name") if isinstance(node, dict) else None


def find_field(form, name):
    for node in walk(form):
        if field_name(node) == name:
            return node
    raise RuntimeError(f"field not found: {name}")


def set_field_id(node, suffix):
    node["id"] = f"{node.get('component', 'field')}-xray-{suffix}"


with LAB_SETTINGS.open(encoding="utf-8") as source:
    settings = copy.deepcopy(json.load(source))
with AUTO_NUMBER_TEMPLATE.open(encoding="utf-8") as source:
    auto_number_template = copy.deepcopy(json.load(source))
with LAB_REJECTION.open(encoding="utf-8") as source:
    rejection = copy.deepcopy(json.load(source))


# ── X-ray reject reason settings (one reason per record) ──────────────────
settings_root = settings["fields"][0]
kept_cols = []
for col in settings_root.get("cols", []):
    fields = col.get("fields") or []
    name = field_name(fields[0]) if fields else ""
    if name in {"section_code", "display_order"}:
        continue
    kept_cols.append(col)
settings_root["cols"] = kept_cols
settings_root["options"]["name"] = "xray_reject_reason_settings_root"
set_field_id(settings_root, "reject-reason-settings-root")

reason_code_node = find_field(settings, "reason_code")
reason_code_key = reason_code_node.get("key")
reason_code_node.clear()
reason_code_node.update(copy.deepcopy(find_field(auto_number_template, "result_code")))
if reason_code_key is not None:
    reason_code_node["key"] = reason_code_key
set_field_id(reason_code_node, "reject-reason-code")
reason_code = reason_code_node["options"]
reason_code.update({
    "name": "reason_code",
    "label": "รหัสเหตุผล X-ray",
    "defaultValue": None,
    "placeholder": "ระบบสร้างอัตโนมัติ เช่น XRAYR-00001",
    "readonly": True,
    "clearable": False,
    "required": False,
    "requiredHint": "",
    "prefix": "XRAYR-",
    "suffix": "",
    "increment": 1,
    "digit": 5,
    "perDay": False,
    "bySite": False,
    "labelTooltip": "ระบบสร้างรหัสอัตโนมัติแบบต่อเนื่องสำหรับใช้อ้างอิง API",
})
reason_type = find_field(settings, "reason_type")["options"]
reason_type.update({
    "label": "ประเภทเหตุผล X-ray",
    "defaultValue": "BOTH",
    "optionItems": [
        {"label": "ใช้ได้ทั้งปฏิเสธรายการและยกเลิกรายการ", "value": "BOTH"},
        {"label": "ปฏิเสธรายการ X-ray", "value": "ITEM_REJECT"},
        {"label": "ยกเลิก Order / รายการ X-ray", "value": "ORDER_CANCEL"},
    ],
    "requiredHint": "กรุณาเลือกประเภทเหตุผล X-ray",
})
find_field(settings, "reason_text")["options"].update({
    "label": "ข้อความเหตุผลที่แสดงให้เจ้าหน้าที่ X-ray เลือก",
    "placeholder": "ระบุข้อความภาษาไทยที่ชัดเจน",
})
find_field(settings, "is_active")["options"]["label"] = (
    "เปิดใช้งานเหตุผลนี้ (ปิด = ไม่แสดงให้เลือกใหม่ แต่ประวัติเดิมยังอยู่)"
)
find_field(settings, "management_guidance")["options"].update({
    "label": "วิธีจัดการรายการเหตุผล",
    "defaultValue": (
        "หนึ่ง record คือหนึ่งเหตุผล เลือกประเภทว่าจะแสดงในเมนูปฏิเสธรายการ "
        "เมนูยกเลิกรายการ หรือใช้ได้ทั้งสองเมนู "
        "เมื่อไม่ต้องการให้เลือกเหตุผลเดิมอีก ให้ปิด ‘เปิดใช้งานเหตุผลนี้’ แทนการลบ "
        "เพื่อให้ประวัติเดิมยังอ้างอิงรหัสและข้อความเดิมได้"
    ),
})
settings["formConfig"].update({
    "modelName": "XrayRejectReasonSettingsForm",
    "refName": "xrayRejectReasonSettingsFormRef",
    "rulesName": "xrayRejectReasonSettingsRules",
})


# ── X-ray rejection record opened by Worklist ────────────────────────────
card = find_field(rejection, "rejection_form_card")
card["options"].update({
    "label": "ปฏิเสธรายการ X-ray",
    "subLabel": "บันทึกเหตุผลก่อนเปลี่ยนสถานะรายการ",
})
set_field_id(card, "rejection-record")

reason_options = [
    {"value": "PATIENT_ABSENT", "label": "ผู้ป่วยไม่มาตามนัด"},
    {"value": "PHYSICIAN_CANCELLED", "label": "แพทย์ยกเลิกคำสั่ง"},
    {"value": "WRONG_PATIENT", "label": "สั่งผิดคน"},
    {"value": "OTHER", "label": "อื่น ๆ"},
]
reject_reason = find_field(rejection, "reject_reason_code")["options"]
reject_reason.update({
    "optionItems": reason_options,
    "onCreated": (
        "const form=this.getFormRef&&this.getFormRef();\n"
        "const params=form&&form.formParams||{};\n"
        "const rows=Array.isArray(params.reason_options)?params.reason_options:null;\n"
        "if(rows!==null){\n"
        "  this.loadOptions(rows.map(row=>({value:String(row&&row.value||'').trim(),"
        "label:String(row&&row.label||'').trim()})).filter(row=>row.value&&row.label));\n"
        "}"
    ),
})

fields = card.get("fields") or []
by_name = {field_name(node): node for node in fields if field_name(node)}
source_template = find_field(rejection, "source_order_id")


def hidden_clone(name, label):
    node = copy.deepcopy(source_template)
    node["options"].update({
        "name": name,
        "label": label,
        "defaultValue": "",
        "readonly": False,
        "disabled": False,
        "hidden": True,
        "required": False,
        "requiredHint": "",
    })
    set_field_id(node, name)
    return node


visible_names = ["patient_display", "reject_reason_code", "reject_reason_detail"]
audit_fields = [
    ("source_item_id", "Source X-ray Item ID"),
    ("source_order_id", "Source CPOE Order ID"),
    ("order_group_id", "Order No."),
    ("patient_hn", "HN"),
    ("patient_name", "ชื่อผู้ป่วย"),
    ("ward_clinic", "หน่วยต้นทาง"),
    ("modality", "Modality"),
    ("accession_no", "Accession No."),
    ("selected_items_json", "Selected X-ray Item JSON"),
    ("treatment_right", "สิทธิการรักษา"),
    ("payment_status", "สถานะการเงิน"),
    ("revision_no", "Revision No."),
    ("rejected_at", "Rejected At"),
    ("rejected_by", "Rejected By"),
    ("rejection_status", "Rejection Status"),
]
card["fields"] = [by_name[name] for name in visible_names]
rejection["fields"] = [card] + [hidden_clone(name, label) for name, label in audit_fields]
rejection["formConfig"].update({
    "modelName": "XrayRejectionRecordForm",
    "refName": "xrayRejectionRecordFormRef",
    "rulesName": "xrayRejectionRecordRules",
})


SETTINGS_TARGET.write_text(json.dumps(settings, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
REJECTION_TARGET.write_text(json.dumps(rejection, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(SETTINGS_TARGET)
print(REJECTION_TARGET)
