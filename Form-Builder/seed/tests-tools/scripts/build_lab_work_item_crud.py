"""Generate the single cross-section CRUD form for Lab Work Items."""

import copy
import json


SOURCE = 'Lab_Bio_Order_CRUD.json'
CONTAINER_SOURCE = 'Lab_Result_Inbound_Receive.json'
TARGET = 'Lab_Work_Item_CRUD.json'


def find_field(form, name):
    for field in form['fields']:
        if field.get('options', {}).get('name') == name:
            return field
    raise RuntimeError(f'template field not found: {name}')


def text(template, key, label, *, hidden=False, readonly=False, required=False, span=12):
    item = copy.deepcopy(template)
    item['id'] = 'text-input-work-item-' + key
    opts = item['options']
    opts.update({
        'name': key, 'label': label, 'defaultValue': '', 'columnSpan': span,
        'hidden': hidden, 'readonly': readonly, 'required': required,
        'requiredHint': f'กรุณาระบุ{label}' if required else '',
        'placeholder': '' if hidden else label,
        'onCreated': '', 'onMounted': '', 'onUnmount': '', 'onInput': '',
        'onChange': '', 'onFocus': '', 'onBlur': '', 'onValidate': '',
    })
    return item


def status_select():
    return {
        'key': 94120, 'name': 'Select Input', 'component': 'select-input',
        'category': 'basic_input', 'icon': 'select-input', 'fieldType': 'String|Array',
        'fieldLength': None, 'children': False, 'enable': True, 'formItemFlag': True,
        'id': 'select-input-work-status',
        'options': {
            'name': 'work_status', 'label': 'สถานะงาน Lab', 'labelAlign': '',
            'defaultValue': 'waiting_receive', 'placeholder': 'เลือกสถานะ',
            'columnSpan': 12, 'size': '', 'labelWidth': None, 'labelHidden': False,
            'disabled': False, 'hidden': False, 'clearable': False, 'filterable': False,
            'allowCreate': False, 'remote': False, 'automaticDropdown': False,
            'multiple': False, 'multipleLimit': None,
            'optionItems': [
                {'label': 'รอรับสิ่งส่งตรวจ', 'value': 'waiting_receive'},
                {'label': 'รับสิ่งส่งตรวจแล้ว', 'value': 'received'},
                {'label': 'กำลังตรวจ', 'value': 'processing'},
                {'label': 'ออกผลบางส่วน', 'value': 'resulted'},
                {'label': 'ออกผลครบ', 'value': 'completed'},
                {'label': 'ปฏิเสธสิ่งส่งตรวจ', 'value': 'rejected'},
                {'label': 'ยกเลิก', 'value': 'cancelled'},
            ],
            'required': True, 'requiredHint': 'กรุณาระบุสถานะงาน Lab',
            'validation': '', 'validationHint': '', 'customClass': '',
            'labelIconClass': None, 'labelIconPosition': 'rear', 'labelTooltip': None,
            'labelColor': None, 'onCreated': '', 'onMounted': '', 'onUnmount': '',
            'onRemoteQuery': '', 'onChange': '', 'onClear': '', 'onFocus': '',
            'onBlur': '', 'onValidate': '',
        },
    }


with open(SOURCE, encoding='utf-8') as source:
    form = json.load(source)
with open(CONTAINER_SOURCE, encoding='utf-8') as source:
    container_form = json.load(source)

template = find_field(form, 'patient_name')
fields = [
    text(template, 'source_order_id', 'Source Center Order ID', hidden=True),
    text(template, 'source_order_number', 'เลขที่ใบสั่งต้นทาง', hidden=True),
    text(template, 'source_specimen_record_id', 'Source Specimen Record ID', hidden=True),
    # A pre-receipt rejection owns a Work Item but intentionally has no LAB NO.
    # Receipt remains the only flow that allocates a LAB NO.
    text(template, 'lab_no', 'LAB NO.', readonly=True, required=False, span=8),
    text(template, 'section_code', 'รหัสห้อง Lab', readonly=True, required=True, span=8),
    text(template, 'section_name', 'ห้องปฏิบัติการ', readonly=True, required=True, span=8),
    status_select(),
    text(template, 'patient_hn', 'HN', readonly=True, required=True, span=8),
    text(template, 'visit_id', 'VN / Visit ID', readonly=True, required=True, span=8),
    text(template, 'patient_name', 'ชื่อ-สกุลผู้ป่วย', readonly=True, required=True, span=16),
    text(template, 'ward_clinic', 'Ward / Clinic', readonly=True, span=12),
    text(template, 'ordered_at', 'เวลาสั่งตรวจ', readonly=True, span=12),
    text(template, 'specimen_json', 'Specimen Snapshot JSON', hidden=True),
    text(template, 'selected_items_json', 'Selected Items Snapshot JSON', hidden=True),
    text(template, 'central_checked_at', 'เวลาตรวจโดยศูนย์กลาง', hidden=True),
    text(template, 'central_checked_by', 'ผู้ตรวจศูนย์กลาง', hidden=True),
    text(template, 'central_forwarded_at', 'เวลาส่งต่อจากศูนย์กลาง', hidden=True),
    text(template, 'central_forwarded_by', 'ผู้ส่งต่อจากศูนย์กลาง', hidden=True),
    text(template, 'received_at', 'เวลารับสิ่งส่งตรวจ', hidden=True),
    text(template, 'received_by', 'ผู้รับสิ่งส่งตรวจ', hidden=True),
    text(template, 'processing_at', 'เวลาเริ่มตรวจ', hidden=True),
    text(template, 'processing_by', 'ผู้เริ่มตรวจ', hidden=True),
    text(template, 'resulted_at', 'เวลาออกผล', hidden=True),
    text(template, 'resulted_by', 'ผู้ออกผล', hidden=True),
    text(template, 'rejected_at', 'เวลาปฏิเสธ', hidden=True),
    text(template, 'rejected_by', 'ผู้ปฏิเสธ', hidden=True),
    text(template, 'rejection_record_id', 'Rejection Log Record ID', hidden=True),
    text(template, 'reject_reason_code', 'รหัสเหตุผลปฏิเสธ', hidden=True),
    text(template, 'reject_reason_detail', 'รายละเอียดเหตุผลปฏิเสธ', hidden=True),
    text(template, 'cancellation_record_id', 'Cancellation Log Record ID', hidden=True),
    text(template, 'cancel_type', 'ชนิดการยกเลิก', hidden=True),
    text(template, 'cancel_reason', 'เหตุผลการยกเลิก Order', hidden=True),
    text(template, 'cancelled_at', 'เวลายกเลิก Order', hidden=True),
    text(template, 'cancelled_by', 'ผู้ยกเลิก Order', hidden=True),
]

root = copy.deepcopy(container_form['fields'][0])
root['id'] = 'grid-lab-work-item-root'
root['options']['name'] = 'lab_work_item_root'
root_col = root['cols'][0]
root_col['id'] = 'grid-col-lab-work-item-root'
root_col['options']['name'] = 'lab_work_item_root_col'
root_col['fields'] = fields
root['cols'] = [root_col]
form['fields'] = [root]
cfg = form['formConfig']
cfg.update({
    'modelName': 'LabWorkItemForm', 'refName': 'labWorkItemFormRef',
    'rulesName': 'labWorkItemRules', 'labelPosition': 'top', 'labelWidth': 0,
    'cssCode': '.el-form{max-width:1040px;margin:0 auto}',
    'onFormDataChange': '',
})

with open(TARGET, 'w', encoding='utf-8') as target:
    json.dump(form, target, ensure_ascii=False, indent=2)
    target.write('\n')

print(TARGET)
