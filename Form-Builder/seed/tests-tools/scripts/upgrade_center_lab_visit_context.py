# -*- coding: utf-8 -*-
"""Persist the EMR visit link and source room on Center Lab Order.

The popup receives rich patient context through formParams, but formParams is
transient.  These hidden fields retain the specific Visit and the sending
clinic so the insert event can create a complete downstream Lab Status row.
"""

import json
from pathlib import Path


PATH = Path('Center_Lab_Order_Master_Bound.json')


def hidden_text(name, label, field_id):
    return {
        'name': 'Text Input', 'component': 'text-input',
        'category': 'basic_input', 'icon': 'text-input', 'fieldType': 'String',
        'fieldLength': None, 'children': False, 'enable': True,
        'formItemFlag': True, 'id': field_id,
        'options': {
            'name': name, 'label': label, 'labelAlign': '', 'type': 'text',
            'defaultValue': '', 'placeholder': '', 'columnSpan': 4, 'size': '',
            'labelWidth': None, 'labelHidden': False, 'readonly': True,
            'disabled': False, 'hidden': True, 'clearable': False,
            'showPassword': False, 'required': False, 'requiredHint': '',
            'validation': '', 'validationHint': '', 'customClass': [],
            'labelIconClass': None, 'labelIconPosition': 'rear',
            'labelTooltip': None, 'labelColor': None, 'minLength': None,
            'maxLength': None, 'showWordLimit': False, 'prefixIcon': '',
            'suffixIcon': '', 'prefixText': '', 'suffixText': '',
            'appendButton': False, 'appendButtonDisabled': False,
            'buttonIcon': 'el-search', 'onCreated': '', 'onMounted': '',
            'onUnmount': '', 'onInput': '', 'onChange': '', 'onFocus': '',
            'onBlur': '', 'onValidate': '', 'onAppendButtonClick': '',
        },
    }


doc = json.loads(PATH.read_text(encoding='utf-8'))
fields = doc['fields']
existing = {node.get('options', {}).get('name') for node in fields}
new_fields = [
    hidden_text('visit_vn', 'Visit VN', 'text-input-visit-vn'),
    hidden_text('source_unit_code', 'Source Unit Code', 'text-input-source-unit-code'),
    hidden_text('source_unit_name', 'Source Unit Name', 'text-input-source-unit-name'),
]
insert_at = next((i for i, node in enumerate(fields)
                  if node.get('options', {}).get('name') == 'visit_id_link'), len(fields))
for offset, node in enumerate(new_fields):
    if node['options']['name'] not in existing:
        fields.insert(insert_at + offset, node)

doc['formConfig']['onFormMounted'] = r'''const params = this.formParams || {};
const text = value => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return String(value.label || value.name || value.value || value.code || '').trim();
  return String(value).trim();
};
const unit = value => {
  if (!value || typeof value !== 'object') return { code: '', name: text(value) };
  return { code: text(value.code || value.unit_code || value.value || value.id), name: text(value.name || value.unit_name || value.label || value.text) };
};
const put = (name, value) => { const next = text(value); if (next) this.setFieldValue(name, next); };
put('visit_id_link', params.visit_id || params.visit_id_link);
put('visit_vn', params.vn || params.visit_vn);
// Source unit is deliberately not xunitx: downstream Status overwrites
// xunitx with the destination Lab section.  EMR sends visit_clinic from the
// selected Visit, which is the actual originating room for the order.
const clinic = unit(params.source_unit || params.origin_unit || params.visit_clinic);
put('source_unit_code', params.source_unit_code || params.visit_clinic_code || clinic.code);
put('source_unit_name', params.source_unit_name || params.visit_clinic_name || clinic.name || params.ward_clinic);
'''

PATH.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Center Lab Order now persists Visit VN and source room')
