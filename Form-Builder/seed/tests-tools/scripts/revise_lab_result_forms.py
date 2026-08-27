#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Revise Lab result-master import JSON for the popup-result workflow."""

import json
from copy import deepcopy
from pathlib import Path

ROOT = Path('.')
CPOE_ITEM_FORM_ID = '6a79e45fd5218a5b6a26be9e'
UNIT_FORM_ID = '6a7aa575935ed08882467368'


def load(name):
    return json.loads((ROOT / name).read_text())


def save(name, model):
    (ROOT / name).write_text(json.dumps(model, ensure_ascii=False, indent=2) + '\n')


def field_map(model):
    out = {}
    def visit(value):
        if isinstance(value, dict):
            opts = value.get('options', {})
            if value.get('formItemFlag') and opts.get('name'):
                out[opts['name']] = value
            for child in value.values(): visit(child)
        elif isinstance(value, list):
            for child in value: visit(child)
    visit(model)
    return out


def card_fields(model):
    def visit(value):
        if isinstance(value, dict):
            if value.get('component') == 'card' and isinstance(value.get('fields'), list):
                return value['fields']
            for child in value.values():
                found = visit(child)
                if found is not None: return found
        elif isinstance(value, list):
            for child in value:
                found = visit(child)
                if found is not None: return found
        return None
    return visit(model)


def clone_text(source, name, label, *, readonly=False, required=False, column=12, placeholder=''):
    item = deepcopy(source)
    item['id'] = 'text-input-' + name
    opts = item['options']
    opts.update(name=name, label=label, readonly=readonly, required=required,
                requiredHint=('กรุณาระบุ' + label) if required else '', columnSpan=column,
                placeholder=placeholder, defaultValue='')
    return item


def clone_select_form(source, name, label, form_id, value_field, label_field, *, required=False):
    item = deepcopy(source)
    item.update(name='Select By Form', component='select-form-input', category='advanced_input',
                icon='select-form-input', fieldType='String|Object', id='select-form-input-' + name)
    opts = item['options']
    opts.update(name=name, label=label, defaultValue='', placeholder='เลือก' + label,
                required=required, requiredHint=('กรุณาเลือก' + label) if required else '',
                formId=form_id, where='is_active = true', orderBy='', limit=1000,
                valueField=value_field, labelField=label_field, searchField=label_field,
                refField='', labelTemplate='', optionsTemplate='', valueObjectId=True,
                refreshLabel=True, getDataOnLoad=True, formBtnEnable=False,
                parentMode=False, defaultFilterParent=False, parentPath='', showWhenParent='',
                cloneEnableLabelField=True, dependEnable=False, dependField='')
    return item


def revise_definition():
    model = load('Lab_Result_Definition_Master.json')
    fmap = field_map(model)
    fields = card_fields(model)
    item_ref = clone_select_form(fmap['default_unit_code'], 'lab_item_id', 'รายการตรวจ (CPOE)',
                                 CPOE_ITEM_FORM_ID, '_id', 'item_name', required=True)
    unit_ref = clone_select_form(fmap['default_unit_code'], 'default_unit_id', 'หน่วยเริ่มต้น',
                                 UNIT_FORM_ID, '_id', 'unit_symbol')
    keep = ['result_type', 'decimal_places', 'reference_range_text', 'allowed_text_options', 'is_active']
    fields[:] = [item_ref, unit_ref] + [fmap[name] for name in keep]
    card = next(x for x in model['fields'] if x.get('component') == 'card')
    card['options']['subLabel'] = 'กำหนดการแสดงผลของแต่ละ CPOE test: รูปแบบผล หน่วย อ้างอิง และ revision'
    # Keep all clinical ranges/options blank until approved by the laboratory.
    save('Lab_Result_Definition_Master.json', model)


def revise_result_item():
    model = load('Lab_Result_Item.json')
    fmap = field_map(model)
    fields = card_fields(model)
    text = fmap['order_id']
    additions = [
        clone_text(text, 'lab_section', 'Lab / Section', readonly=True, required=True, placeholder='snapshot จาก Order'),
        clone_text(text, 'result_definition_id', 'Result Definition ID', readonly=True, placeholder='snapshot จาก Definition'),
        clone_text(text, 'result_source', 'ที่มาผล', readonly=True, placeholder='manual หรือ lis'),
        clone_text(text, 'unit_code_snapshot', 'รหัสหน่วย', readonly=True, placeholder='snapshot จาก Unit Master'),
        clone_text(text, 'entered_at', 'เวลาบันทึกผล', readonly=True, placeholder='server timestamp'),
        clone_text(text, 'entered_by', 'ผู้บันทึกผล', readonly=True, placeholder='runtime user'),
        clone_text(text, 'verified_at', 'เวลายืนยันผล', readonly=True, placeholder='server timestamp'),
        clone_text(text, 'verified_by', 'ผู้ยืนยันผล', readonly=True, placeholder='runtime user'),
    ]
    # Result Item is an audit record; all identity/snapshot fields are API-only.
    readonly_names = {'order_id', 'lab_no', 'patient_hn', 'test_code', 'test_name',
                      'result_type', 'reference_range_snapshot'}
    for name in readonly_names:
        fmap[name]['options']['readonly'] = True
        fmap[name]['options']['disabled'] = False
    ordered = ['order_id', 'lab_section', 'lab_no', 'patient_hn', 'test_code', 'test_name',
               'result_definition_id', 'result_source', 'result_type', 'result_number', 'result_text',
               'unit_code_snapshot', 'unit_symbol', 'reference_range_snapshot', 'result_comment',
               'result_status', 'is_critical']
    by_name = {x['options']['name']: x for x in additions}
    by_name.update(fmap)
    fields[:] = [by_name[name] for name in ordered] + [by_name['entered_at'], by_name['entered_by'], by_name['verified_at'], by_name['verified_by']]
    card = next(x for x in model['fields'] if x.get('component') == 'card')
    card['options']['subLabel'] = 'ผลจริง 1 record ต่อ 1 test; API เป็นผู้กำหนด snapshot ผู้บันทึก และเวลา'
    save('Lab_Result_Item.json', model)


def revise_unit():
    model = load('Lab_Unit_Master.json')
    card = next(x for x in model['fields'] if x.get('component') == 'card')
    card['options']['subLabel'] = 'หน่วยกลางที่ผ่านการอนุมัติของห้องปฏิบัติการ ใช้สำหรับ dropdown ลงผล'
    save('Lab_Unit_Master.json', model)


if __name__ == '__main__':
    revise_unit()
    revise_definition()
    revise_result_item()
