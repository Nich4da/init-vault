# -*- coding: utf-8 -*-
"""Add hidden VN/patient snapshot fields to the Specimen Status form export."""

import json
from pathlib import Path


PATH = Path('Lab_Specimen_Collection_Status_Form_initCraft_import.json')


def text_field(name, label, field_id):
    return {
        'name': 'Text Input',
        'component': 'text-input',
        'category': 'basic_input',
        'icon': 'text-input',
        'fieldType': 'String',
        'fieldLength': None,
        'children': False,
        'enable': True,
        'formItemFlag': True,
        'id': field_id,
        'options': {
            'name': name, 'label': label, 'labelAlign': '', 'type': 'text',
            'defaultValue': '', 'placeholder': '', 'columnSpan': 8, 'size': '',
            'labelWidth': None, 'labelHidden': False, 'readonly': True,
            'disabled': False, 'hidden': True, 'clearable': False,
            'showPassword': False, 'required': False, 'requiredHint': '',
            'validation': '', 'validationHint': '', 'customClass': '',
            'labelIconClass': None, 'labelIconPosition': 'rear',
            'labelTooltip': None, 'labelColor': None, 'minLength': None,
            'maxLength': None, 'showWordLimit': False, 'prefixIcon': '',
            'suffixIcon': '', 'prefixText': '', 'suffixText': '',
            'appendButton': False, 'appendButtonDisabled': False,
            'buttonIcon': 'el-search', 'onCreated': '', 'onMounted': '',
            'onUnmount': '', 'onInput': '', 'onChange': '', 'onFocus': '',
            'onBlur': '', 'onValidate': '', 'onAppendButtonClick': ''
        }
    }


def json_field(name, label, field_id, default_value='{}'):
    return {
        'name': 'Textarea',
        'component': 'textarea-input',
        'category': 'basic_input',
        'icon': 'textarea-input',
        'fieldType': 'String',
        'fieldLength': None,
        'children': False,
        'enable': True,
        'formItemFlag': True,
        'id': field_id,
        'options': {
            'name': name, 'label': label, 'labelAlign': '', 'defaultValue': default_value,
            'placeholder': '', 'columnSpan': 12, 'size': '', 'labelWidth': None,
            'labelHidden': False, 'readonly': True, 'disabled': False,
            'hidden': True, 'clearable': False, 'autoSize': False, 'rows': 3,
            'required': False, 'maxLength': None, 'showWordLimit': False,
            'validation': '', 'validationHint': '', 'customClass': '',
            'labelIconClass': None, 'labelIconPosition': 'rear',
            'labelTooltip': None, 'labelColor': None, 'onCreated': '',
            'onMounted': '', 'onUnmount': '', 'onInput': '', 'onChange': '',
            'onFocus': '', 'onBlur': '', 'onValidate': ''
        }
    }


CONTEXT_FIELDS = [
    text_field('center_order_id', 'Center Lab Order ID', 'text-input-center-order-id'),
    text_field('visit_id', 'Visit ID', 'text-input-visit-id'),
    text_field('visit_vn', 'VN', 'text-input-visit-vn'),
    text_field('visit_time', 'Visit Time', 'text-input-visit-time'),
    text_field('visit_type', 'Visit Type', 'text-input-visit-type'),
    text_field('person_id', 'Person ID', 'text-input-person-id'),
    text_field('patient_birth_date', 'Patient Birth Date', 'text-input-patient-birth-date'),
    text_field('patient_age', 'Patient Age', 'text-input-patient-age'),
    text_field('patient_gender', 'Patient Gender', 'text-input-patient-gender'),
    text_field('blood_group', 'Blood Group', 'text-input-blood-group'),
    text_field('patient_phone', 'Patient Phone', 'text-input-patient-phone'),
    text_field('patient_photo', 'Patient Photo URL', 'text-input-patient-photo'),
    json_field('allergy_tags_json', 'Drug Allergies (JSON)', 'textarea-input-allergy-tags-json', '[]'),
    text_field('source_unit_code', 'Source Unit Code', 'text-input-source-unit-code'),
    text_field('source_unit_name', 'Source Unit Name', 'text-input-source-unit-name'),
    json_field('inscl_hos_json', 'Hospital Benefits (JSON)', 'textarea-input-inscl-hos-json', '[]'),
    json_field('vital_signs_json', 'Latest Vital Signs (JSON)', 'textarea-input-vital-signs-json'),
    json_field('bmi_json', 'Latest BMI (JSON)', 'textarea-input-bmi-json'),
    json_field('order_change_history_json', 'Order Change History (JSON)', 'textarea-input-order-change-history-json', '[]'),
]


doc = json.loads(PATH.read_text(encoding='utf-8'))
fields = doc['fields']
existing = set()


def collect(nodes):
    for node in nodes:
        options = node.get('options', {})
        if options.get('name'):
            existing.add(options['name'])
        if isinstance(node.get('children'), list):
            collect(node['children'])


collect(fields)
missing = [field for field in CONTEXT_FIELDS if field['options']['name'] not in existing]
if missing:
    context_card = next((field for field in fields
                         if field.get('id') == 'card-visit-patient-snapshot'), None)
    if context_card:
        context_card['children'] = list(context_card.get('children') or []) + missing
    else:
        context_card = {
            'name': 'Card',
            'component': 'card',
            'category': 'container',
            'icon': 'card',
            'fieldType': 'None',
            'fieldLength': None,
            'children': missing,
            'enable': True,
            'formItemFlag': False,
            'id': 'card-visit-patient-snapshot',
            'options': {
                'name': 'visit_patient_snapshot',
                'label': 'VN / Patient Snapshot',
                'labelAlign': '',
                'hidden': True,
                'showHeader': True,
                'header': True,
                'shadow': 'never',
                'customClass': '',
                'onCreated': '',
                'onMounted': '',
                'onUnmount': ''
            }
        }
        insert_at = next((i for i, node in enumerate(fields)
                          if node.get('options', {}).get('name') == 'status_information'), len(fields))
        fields.insert(insert_at, context_card)

PATH.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
