import json

PATH = 'Lab_Biochem_initCraft_import.json'
CENTER_FORM_ID = '6a75a7810796231c653df996'


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


with open(PATH, encoding='utf-8') as source:
    form = json.load(source)

nodes = {node.get('options', {}).get('name'): node for node in walk(form) if isinstance(node, dict)}

# New order button: Lab Center is now the one and only order-entry form.
create = nodes['create_biochemistry_order']['options']
create['content'] = create['content'].replace('@click="createNewBioOrder"', '@click="createNewLabOrder"')
script = create['onCreated']
old_create = "s.createNewBioOrder=()=>{const f=field.getFormRef();if(!f)return;f.openForm('6a771f20cc7d0a8451130339',null,null,{}, {params:{from:'lab-biochemistry-dashboard'},popupType:'dialog',backdrop:false,afterSaveCallback:()=>{const waiting=field.refField('lab_waiting_orders');if(waiting&&waiting.vueState&&waiting.vueState.loadWaitingOrders)waiting.vueState.loadWaitingOrders();const list=field.refField('lab_waiting_listview');const editor=list&&list.getFieldEditor&&list.getFieldEditor();if(editor&&editor.handleRefresh)editor.handleRefresh()}})}"
new_create = "s.createNewLabOrder=()=>{const f=field.getFormRef();if(!f||typeof f.openForm!=='function'){field.notify('ไม่พบตัวเปิดฟอร์ม Lab Center','error',3000);return}const ctx={from:'lab-workbench',lab_section:s.currentLabSection(),lab_name:s.currentLabName(),lab_unit_code:s.labUnitCode()};f.openForm('" + CENTER_FORM_ID + "',null,null,{}, {params:ctx,popupType:'dialog',backdrop:false,afterSaveCallback:()=>{['lab_waiting_orders','lab_received_component','lab_resulted_component'].forEach(n=>{const ref=field.refField(n);if(ref&&ref.vueState&&typeof ref.vueState.load==='function')ref.vueState.load();if(ref&&ref.vueState&&typeof ref.vueState.loadWaitingOrders==='function')ref.vueState.loadWaitingOrders()});['lab_all_orders_listview','lab_waiting_listview','lab_cancelled_listview_final'].forEach(n=>{const ref=field.refField(n);const ed=ref&&ref.getFieldEditor&&ref.getFieldEditor();if(ed&&ed.handleRefresh)ed.handleRefresh()})}})}"
if old_create in script:
    script = script.replace(old_create, new_create)
elif 's.createNewLabOrder=' not in script:
    raise AssertionError('create button anchor not found')
create['onCreated'] = script

# Edit button: open the same Lab Center order. A future Lab work-item can store
# center_order_id; while the workbench reads Center directly its _id is used.
received = nodes['lab_received_component']['options']
script = received['onCreated']
old_id = "const id=row&&String(row._id||row.id||'');if(!id){field.notify('กรุณาเลือกรายการก่อน','warning',3000);return}if(!form||typeof form.openForm!=='function'){field.notify('ไม่พบตัวเปิดฟอร์มใบสั่งตรวจ','error',3000);return}form.openForm('6a771f20cc7d0a8451130339',id,null,{}, {popupType:'dialog',backdrop:false,afterSaveCallback:()=>{s.load();const waiting=field.refField('lab_waiting_orders');if(waiting&&waiting.vueState&&typeof waiting.vueState.loadWaitingOrders==='function')waiting.vueState.loadWaitingOrders()}})}"
new_id = "const id=row&&String(row.center_order_id||row.lab_center_order_id||row.source_center_order_id||row._id||row.id||'');if(!id){field.notify('กรุณาเลือกรายการก่อน','warning',3000);return}if(!form||typeof form.openForm!=='function'){field.notify('ไม่พบตัวเปิดฟอร์ม Lab Center','error',3000);return}form.openForm('" + CENTER_FORM_ID + "',id,null,{}, {params:{from:'lab-workbench-edit',lab_section:s.currentLabSection(),lab_name:s.currentLabName(),lab_unit_code:s.labUnitCode()},popupType:'dialog',backdrop:false,afterSaveCallback:()=>{s.load();const waiting=field.refField('lab_waiting_orders');if(waiting&&waiting.vueState&&typeof waiting.vueState.loadWaitingOrders==='function')waiting.vueState.loadWaitingOrders();const all=field.refField('lab_all_orders_listview');const ed=all&&all.getFieldEditor&&all.getFieldEditor();if(ed&&ed.handleRefresh)ed.handleRefresh()}})}"
if old_id in script:
    received['onCreated'] = script.replace(old_id, new_id)
elif "form.openForm('" + CENTER_FORM_ID + "'" not in script:
    raise AssertionError('edit button anchor not found')

with open(PATH, 'w', encoding='utf-8') as target:
    json.dump(form, target, ensure_ascii=False, indent=2)
    target.write('\n')
print('Lab Center wired to create/edit actions')
