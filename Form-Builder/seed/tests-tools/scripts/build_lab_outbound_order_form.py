"""Build the read-only Lab Outbound Order transport record form."""

from __future__ import annotations

import copy
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
TEMPLATE_PATH = ROOT / "Form-Builder/SDForm/form-factory/forms/Lab_Result_Inbound_Receive.json"
PERSON_PATH = ROOT / "Form-Builder/SDForm/form-factory/forms/person.json"
WORK_ITEM_PATH = ROOT / "Form-Builder/SDForm/form-factory/forms/Lab_Work_Item_CRUD.json"
TARGET_PATH = ROOT / "Form-Builder/SDForm/Lab/lab-outbound-order-v1.json"


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def first_component(form, component):
    for node in walk(form):
        if node.get("component") == component:
            return node
    raise RuntimeError(f"template component not found: {component}")


with TEMPLATE_PATH.open(encoding="utf-8") as source:
    inbound = json.load(source)
with PERSON_PATH.open(encoding="utf-8") as source:
    person = json.load(source)
with WORK_ITEM_PATH.open(encoding="utf-8") as source:
    work_item = json.load(source)

templates = {
    component: first_component(inbound, component)
    for component in (
        "grid",
        "grid-col",
        "card",
        "text-input",
        "textarea-input",
        "number-input",
        "select-input",
    )
}
templates["switch-input"] = first_component(person, "switch-input")

serial = 92000


def next_id(component):
    global serial
    serial += 1
    return f"{component}-lab-outbound-{serial}"


def clone(component):
    node = copy.deepcopy(templates[component])
    # Every rendered component needs its own Vue identity. Reusing a template
    # key on every clone can leave Builder blank while Tree view still parses.
    node["id"] = next_id(component)
    node["key"] = serial
    return node


def text(name, label, *, span=8, required=False, default="", max_length=200,
         hidden=False, tooltip=None):
    node = clone("text-input")
    node["fieldLength"] = max_length
    options = node["options"]
    options.update({
        "name": name,
        "label": label,
        "defaultValue": default,
        "placeholder": "API เป็นผู้บันทึกข้อมูล",
        "columnSpan": span,
        "readonly": True,
        "disabled": False,
        "hidden": hidden,
        "clearable": False,
        "required": required,
        "requiredHint": f"ต้องมี {name}" if required else "",
        "validation": "",
        "validationHint": "",
        "maxLength": max_length,
        "showWordLimit": False,
        "labelTooltip": tooltip,
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


def textarea(name, label, *, span=24, required=False, default="", rows=5,
             max_length=200000, tooltip=None):
    node = clone("textarea-input")
    node["fieldLength"] = max_length
    options = node["options"]
    options.update({
        "name": name,
        "label": label,
        "rows": rows,
        "defaultValue": default,
        "placeholder": "API เป็นผู้บันทึกข้อมูล",
        "columnSpan": span,
        "readonly": True,
        "disabled": False,
        "hidden": False,
        "autoSize": False,
        "required": required,
        "requiredHint": f"ต้องมี {name}" if required else "",
        "validation": "",
        "validationHint": "",
        "maxLength": max_length,
        "showWordLimit": False,
        "labelTooltip": tooltip,
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


def number(name, label, *, span=6, default=0, maximum=999999):
    node = clone("number-input")
    options = node["options"]
    options.update({
        "name": name,
        "label": label,
        "defaultValue": default,
        "placeholder": "0",
        "columnSpan": span,
        "disabled": True,
        "hidden": False,
        "required": False,
        "requiredHint": "",
        "validation": "",
        "validationHint": "",
        "min": 0,
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


def switch(name, label, *, span=6, default=False):
    node = clone("switch-input")
    options = node["options"]
    options.update({
        "name": name,
        "label": label,
        "defaultValue": default,
        "columnSpan": span,
        "disabled": True,
        "hidden": False,
        "activeText": "ใช่",
        "inactiveText": "ไม่ใช่",
        "onCreated": "",
        "onMounted": "",
        "onUnmount": "",
        "onChange": "",
        "onValidate": "",
    })
    return node


def status_select():
    node = clone("select-input")
    options = node["options"]
    options.update({
        "name": "hl7_status",
        "label": "สถานะส่ง Agent",
        "defaultValue": "new",
        "placeholder": "",
        "columnSpan": 8,
        "disabled": True,
        "hidden": False,
        "clearable": False,
        "filterable": False,
        "allowCreate": False,
        "remote": False,
        "automaticDropdown": False,
        "multiple": False,
        "multipleLimit": None,
        "optionItems": [
            {"label": "ใหม่ / รอส่ง", "value": "new"},
            {"label": "กำลังส่ง", "value": "sending"},
            {"label": "Agent รับเข้าคิว", "value": "queued"},
            {"label": "ส่งไป LIS แล้ว", "value": "sent"},
            {"label": "LIS กำลังตรวจ", "value": "in_progress"},
            {"label": "ออกผลแล้ว", "value": "resulted"},
            {"label": "ค้าง / ต้อง reconcile", "value": "stalled"},
            {"label": "ส่งไม่สำเร็จ", "value": "failed"},
            {"label": "ร้องขอยกเลิก", "value": "cancel_requested"},
            {"label": "ยกเลิกแล้ว", "value": "cancelled"},
            {"label": "Agent ปฏิเสธการยกเลิก", "value": "cancel_rejected"},
        ],
        "required": True,
        "requiredHint": "ต้องมีสถานะส่ง Agent",
        "validation": "",
        "validationHint": "",
        "labelTooltip": "สถานะ transport แยกจากสถานะรับ specimen ของ Lab Work Item",
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


fields = [
    # Identity and immutable source references.
    text("work_item_id", "Lab Work Item ID", required=True),
    text("source_cpoe_order_id", "Source CPOE Order ID"),
    text("source_cpoe_item_id", "Source CPOE Item ID", required=True),
    text("order_no", "Order No. / Idempotency Key", required=True),
    text("lab_no", "LAB NO.", required=True),
    text("section_code", "รหัสห้อง Lab", required=True),
    text("patient_hn", "HN", required=True),
    text("visit_id", "Visit ID"),
    number("item_count", "จำนวนรายการตรวจ", span=8),
    # Latest transport state.
    status_select(),
    text("transport_channel", "ช่องทาง", default="agent_api", required=True),
    text("schema_version", "Schema version", default="his-agent-order-v1", required=True),
    number("agent_http_status", "HTTP status", maximum=599),
    switch("agent_duplicate", "Agent แจ้ง duplicate"),
    switch("retryable", "อนุญาตให้ retry"),
    number("attempt_count", "จำนวนครั้งที่ส่ง"),
    text("dispatch_id", "Dispatch ID", max_length=200),
    text("order_ref", "Agent Order Ref", max_length=200),
    text("routed_to_json", "Routed To JSON", default="[]", max_length=4000),
    # Timeline and audit actors.
    text("first_attempt_at", "เวลาส่งครั้งแรก"),
    text("last_attempt_at", "เวลาลองส่งล่าสุด"),
    text("next_retry_at", "เวลาที่ควร retry ครั้งถัดไป"),
    text("queued_at", "เวลา Agent รับเข้าคิว"),
    text("sent_at", "เวลาส่งถึง LIS"),
    text("last_success_at", "เวลาสำเร็จล่าสุด"),
    text("last_status_at", "เวลาเปลี่ยนสถานะล่าสุด"),
    text("created_by", "สร้างโดย"),
    text("updated_by", "แก้ไขล่าสุดโดย"),
    # Last error and immutable transport snapshots.
    text("last_error_code", "Error code", max_length=200),
    text("last_error_at", "เวลาที่เกิด error"),
    text("last_error_http_status", "HTTP status ที่ผิดพลาด", max_length=20),
    textarea("last_error_reason", "เหตุผล", rows=3, max_length=4000),
    textarea("last_error_detail_json", "Error detail JSON", default="{}", rows=5),
    text("request_payload_hash", "Request payload hash", span=12, max_length=200),
    text("response_payload_hash", "Response payload hash", span=12, max_length=200),
    textarea(
        "request_payload_json",
        "Normalized request payload JSON",
        required=True,
        default="{}",
        rows=14,
        max_length=1048576,
        tooltip="Snapshot ที่ส่งจริงหลัง normalize; ห้ามมี Agent key",
    ),
    textarea(
        "response_payload_json",
        "Agent response payload JSON",
        default="{}",
        rows=10,
        max_length=400000,
    ),
    textarea(
        "attempt_history_json",
        "Attempt history JSON",
        default="[]",
        rows=10,
        max_length=400000,
        tooltip="Append summary ของแต่ละ attempt; ห้าม overwrite ประวัติเดิม",
    ),
]


def grid_col(field):
    node = clone("grid-col")
    span = field["options"].get("columnSpan", 24)
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


root_grid = clone("grid")
root_grid["options"].update({
    "name": "lab_outbound_order_root",
    "hidden": False,
    "gutter": 16,
    "colHeight": None,
    "customClass": "",
})
root_grid["cols"] = [grid_col(field) for field in fields]

form = {
    # Use one proven container level only: grid -> grid-col -> field. The
    # previous card/grid nesting parsed in Tree view but rendered a blank
    # Builder canvas in initCraft v1.6.0.
    "fields": [root_grid],
    "formConfig": copy.deepcopy(work_item["formConfig"]),
}
form["formConfig"].update({
    "modelName": "LabOutboundOrderForm",
    "refName": "labOutboundOrderFormRef",
    "rulesName": "labOutboundOrderRules",
    "labelWidth": 0,
    "labelPosition": "top",
    "cssCode": ".el-form{max-width:1180px;margin:0 auto;}",
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
