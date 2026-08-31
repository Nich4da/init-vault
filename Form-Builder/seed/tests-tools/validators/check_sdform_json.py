#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ตรวจไฟล์ SDForm JSON ก่อนส่งให้ผู้ใช้ import

ใช้:  python3 check_sdform_json.py <ไฟล์.json> [ไฟล์.json ...]
คืน exit code 1 ถ้าไม่ผ่าน — ห้ามส่งไฟล์ที่ไม่ผ่านให้ผู้ใช้

กฎที่ตรวจ (ที่มา: SDFORM_JSON_RULES.md)
  1. options ของทุก widget ต้องครบตามแม่แบบ  ← สาเหตุอันดับหนึ่งของอาการ "preview ว่าง"
  2. widget ลูกต้องอยู่ใน .fields ไม่ใช่ .widgetList
  3. ต้องมี container (grid/card/tab) ห่อ widget
  4. id ห้ามซ้ำ
  5. options.name ห้ามซ้ำ
  (key ไม่บังคับ — ฟอร์มที่ใช้งานจริงอย่าง Lab_Bio_Order_CRUD.json ไม่มี key ก็ทำงานได้)
"""
import json, os, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
FORMS_DIR = os.path.abspath(os.path.join(HERE, '..', '..', '..', 'SDForm', 'form-factory', 'forms'))

# ฟอร์มแม่แบบ — ระบบ export มา หรือใช้งานจริงอยู่แล้ว ใช้เป็นแหล่งอ้างอิงชุด options
GOLD = ['person.json', 'disease.json', 'EMR.json', 'ฟอร์มปลายทาง.json',
        'Lab_Result_Inbound_Receive.json', 'Lab_Result_Inbound_Receive_User_View_EMR_Person_v2.json',
        'Lab_Bio_Order_CRUD.json', 'Center_Lab_Order_Master_Bound.json',
        'Lab_Result_Inbound_ListView_EMR_Person.json',
        'Lab_Result_Output_Tab_ListView_EMR_Person.json',
        'Lab_Result_Output_Tab_Layout_ListView_Draft.json',
        'TEMPLATE_file_upload_from_builder.json']

# จำนวนช่อง options ขั้นต่ำที่ยืนยันแล้ว (2026-08-25) — ใช้เมื่อหาไฟล์แม่แบบไม่เจอ
SNAPSHOT = {'list-ui': 62, 'select-form-input': 54, 'select-path-input': 46, 'autonumber-input': 45,
            'text-input': 43, 'tags-input': 40, 'select-data-input': 38, 'select-input': 37,
            'number-input': 36, 'date-input': 36, 'textarea-input': 34, 'masked-input': 33,
            'picture-upload-input': 32, 'html-input': 31, 'radio-input': 29, 'switch-input': 28,
            'smart-card-ui': 23, 'card': 19, 'sub-form': 16, 'button-ui': 15, 'vue-ui': 9,
            'tab': 6, 'grid': 5}


CONTAINERS = {'grid', 'card', 'tab', 'sub-form', 'table', 'collapse', 'affix', 'object-group', 'space'}


def walk(lst, out=None):
    out = out if out is not None else []
    for f in lst or []:
        out.append(f)
        for kid in ('fields', 'widgetList'):
            if isinstance(f.get(kid), list):
                walk(f[kid], out)
        if isinstance(f.get('cols'), list):
            for c in f['cols']:
                walk(c.get('widgetList') or c.get('fields') or [], out)
    return out


def load_reference():
    """ช่องที่ 'บังคับ' = ช่องที่ widget ตัวอย่างของ component นั้น **ทุกตัว** มีเหมือนกันหมด
    (ใช้ intersection ไม่ใช่ union — union จะเข้มเกินจนฟอร์มที่ระบบ export มาเองยังไม่ผ่าน
    เพราะ widget รุ่นใหม่มีช่องเพิ่มที่รุ่นเก่าไม่มี)"""
    seen = collections.defaultdict(list)
    for fn in GOLD:
        p = os.path.join(FORMS_DIR, fn)
        if not os.path.exists(p):
            continue
        try:
            d = json.load(open(p, encoding='utf-8'))
        except Exception:
            continue
        for f in walk(d.get('fields')):
            if f.get('component'):
                seen[f['component']].append(set(f.get('options') or {}))
    return {c: set.intersection(*sets) for c, sets in seen.items() if sets}


def load_keyless():
    """component ที่ฟอร์มแม่แบบ 'ไม่เคยใส่ key' เลย — ใส่เพิ่มเข้าไปแล้ว Builder ไม่ render
    ยืนยันแล้ว 2026-08-25: list-ui ที่มี key จะขึ้นเป็น col ว่าง เอา key ออกแล้วขึ้นทันที"""
    tot, keyed = collections.Counter(), collections.Counter()
    for fn in GOLD:
        p = os.path.join(FORMS_DIR, fn)
        if not os.path.exists(p):
            continue
        try:
            d = json.load(open(p, encoding='utf-8'))
        except Exception:
            continue
        for f in walk(d.get('fields')):
            c = f.get('component')
            if not c:
                continue
            tot[c] += 1
            if 'key' in f:
                keyed[c] += 1
    return {c for c, n in tot.items() if n >= 3 and keyed[c] == 0}


def bad_child_key(node):
    """ฟอร์มที่แสดงผลได้ทุกไฟล์เก็บ widget ลูกไว้ใน .fields เสมอ — widgetList ถูกใช้ 0 ครั้ง
    ถ้าลูกไปอยู่ใน widgetList ตัว Builder จะ render container ว่าง"""
    bad = []
    def rec(lst):
        for f in lst or []:
            if isinstance(f.get('widgetList'), list) and f['widgetList']:
                bad.append(f.get('id') or f.get('component'))
            for k in ('fields', 'widgetList'):
                if isinstance(f.get(k), list):
                    rec(f[k])
            for c in (f.get('cols') or []):
                if isinstance(c.get('widgetList'), list) and c['widgetList']:
                    bad.append(c.get('id') or 'grid-col')
                for k in ('fields', 'widgetList'):
                    if isinstance(c.get(k), list):
                        rec(c[k])
    rec(node)
    return bad


def check(path, ref, keyless=frozenset()):
    name = os.path.basename(path)
    try:
        d = json.load(open(path, encoding='utf-8'))
    except Exception as e:
        print(f"❌ {name}: อ่าน JSON ไม่ได้ — {e}")
        return False
    widgets = walk(d.get('fields'))
    if not widgets:
        print(f"❌ {name}: ไม่มี fields")
        return False

    errs, warns, nokey = [], [], []
    # ฟอร์มที่แสดงผลได้ทุกไฟล์ที่ยืนยันแล้ว มี container อย่างน้อย 1 ตัว และ widget ห่อไว้ข้างใน
    # ไฟล์ที่ preview ว่างมีทั้งแบบ options ไม่ครบ และแบบ options ครบแต่ไม่มี container เลย
    bad = bad_child_key(d.get('fields'))
    if bad:
        errs.append(f"widget ลูกอยู่ใน .widgetList แทนที่จะเป็น .fields ({len(bad)} จุด: "
                    f"{', '.join(str(x) for x in bad[:4])}{' …' if len(bad) > 4 else ''}) — "
                    "ฟอร์มที่แสดงผลได้ใช้ .fields ทุกที่ Builder จะ render container ว่าง")
    if not any(f.get('component') in CONTAINERS for f in widgets):
        errs.append('ไม่มี container (grid/card/tab) เลยทั้งฟอร์ม — widget ลอยอยู่ที่ root ทั้งหมด '
                    'ทำให้ columnSpan ไม่มีผลและ canvas ไม่ render · ต้องห่อด้วย grid ที่ก๊อปจากฟอร์มแม่แบบ')
    bare = [f for f in (d.get('fields') or []) if f.get('component') not in CONTAINERS]
    if bare and any(f.get('component') in CONTAINERS for f in widgets):
        warns.append(f'มี widget {len(bare)} ตัวลอยอยู่ที่ root นอก container — columnSpan ของตัวพวกนี้จะไม่มีผล')
    ids, names = collections.Counter(), collections.Counter()
    for f in widgets:
        comp, opts = f.get('component'), (f.get('options') or {})
        label = opts.get('label') or opts.get('name') or f.get('id')
        ids[f.get('id')] += 1
        if opts.get('name'):
            names[opts['name']] += 1
        if comp in ref:
            miss = sorted(ref[comp] - set(opts))
            if miss:
                errs.append(f"options ไม่ครบ · {comp} “{label}” ขาด {len(miss)} ช่อง: "
                            f"{', '.join(miss[:8])}{' …' if len(miss) > 8 else ''}")
        elif comp in SNAPSHOT:
            if len(opts) < SNAPSHOT[comp]:
                errs.append(f"options ไม่ครบ · {comp} “{label}” มี {len(opts)} ช่อง "
                            f"ควรมีอย่างน้อย {SNAPSHOT[comp]} (เทียบจาก snapshot ไม่ใช่ไฟล์แม่แบบ)")
        else:
            warns.append(f"{comp} “{label}” ไม่มีฟอร์มแม่แบบให้เทียบ — ยืนยันเองในระบบจริงก่อนส่ง")
        if 'key' not in f:
            nokey.append(f"{comp} “{label}”")
        elif comp in keyless:
            errs.append(f"{comp} “{label}” ไม่ควรมี key — ฟอร์มแม่แบบไม่เคยใส่ให้ component นี้เลย "
                        "และ Builder จะ render เป็นช่องว่าง (ยืนยันแล้ว 2026-08-25)")
    for i, n in ids.items():
        if n > 1:
            errs.append(f"id ซ้ำ {n} ครั้ง: {i}")
    for i, n in names.items():
        if n > 1:
            errs.append(f"options.name ซ้ำ {n} ครั้ง: {i}")

    if errs:
        print(f"❌ {name} — ไม่ผ่าน ({len(widgets)} widget)")
        for e in errs[:20]:
            print(f"     • {e}")
        if len(errs) > 20:
            print(f"     • … อีก {len(errs)-20} ข้อ")
    else:
        print(f"✅ {name} — ผ่าน ({len(widgets)} widget)")
    for w in warns[:5]:
        print(f"   ⚠️  {w}")
    if nokey:
        print(f"   ℹ️  ไม่มี key {len(nokey)} widget (ไม่บังคับ ระบบ import ได้)")
    return not errs


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    ref = load_reference()
    print(f"อ้างอิงชุด options จากฟอร์มแม่แบบ {len(ref)} component "
          f"({'พบไฟล์แม่แบบ' if ref else 'ไม่พบไฟล์แม่แบบ — ใช้ snapshot แทน'})\n")
    keyless = load_keyless()
    ok = all([check(p, ref, keyless) for p in sys.argv[1:]])
    sys.exit(0 if ok else 1)
