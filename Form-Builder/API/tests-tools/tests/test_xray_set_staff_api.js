const assert = require('assert')
const fs = require('fs')
const path = require('path')

/* action `set_staff` ของ Process worklist — บันทึก Radiographer ระดับ item พร้อม log
   ผู้ใช้สั่ง 2026-09-03: "เปลี่ยนคอลัม ผู้ส่ง เป็นคำว่า radiographer ทำเป็น dropdown
   … แล้วก็ต้องเก็บ log ด้วยนะ"

   อยู่ใน Process worklist ตัวเดิม ไม่มี Process ID ใหม่ (ทรงเดียวกับ cancel_order)
   ถ้าใครย้ายออกไปเป็น Process แยก ต้องแก้ฟอร์มด้วย ไม่งั้น dropdown จะยิงผิดที่ */
const apiBody = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/xray_cpoe_worklist_api.js'),
  'utf8',
)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const Process = new AsyncFunction('params', 'userInfo', 'app', apiBody)

assert(apiBody.includes("action === 'set_staff'"), 'set_staff lives in the worklist Process')
assert(!apiBody.includes('mongoTxn'), 'MongoDB standalone — ห้ามเปิด transaction ที่นี่')

const ITEM = 'bbbbbbbbbbbbbbbbbbbbbbb1'
const ITEM_LAB = 'bbbbbbbbbbbbbbbbbbbbbbb2'
const ITEM_CANCELLED = 'bbbbbbbbbbbbbbbbbbbbbbb3'
const NAME_A = 'นางสุกัญญา ประจะเน'
const NAME_B = 'นายศุภกร ทองนิ่ม'

const clone = value => JSON.parse(JSON.stringify(value))
const radiologyUser = {
  roles: ['auth'], username: 'xray-test', employee_code: 'XR01',
  unit: { code: 'M0901' }, account: { name: 'xray-test' }, fullname: 'เจ้าหน้าที่ รังสี',
}
const wardUser = { roles: ['auth'], username: 'ward', employee_code: 'W1', unit: { code: '19.P' } }

const makeHarness = () => {
  const rows = [
    {
      _id: ITEM, xrstatx: 1, service_type: { value: 'xray' }, current_status: 'dispatched',
      item_code: 'RD015', item_name: 'Neck AP',
      /* คนกดปุ่มส่งเข้าเครื่อง — คนละความหมายกับ Radiographer ห้ามถูกเขียนทับ */
      dispatched_by: { name: 'คนกดส่ง เดิม' },
    },
    { _id: ITEM_LAB, xrstatx: 1, service_type: { value: 'lab' }, current_status: 'sent' },
    { _id: ITEM_CANCELLED, xrstatx: 1, service_type: { value: 'xray' }, current_status: 'cancelled' },
  ]
  const itemMap = new Map(rows.map(row => [row._id, clone(row)]))
  const itemCollection = {
    findOne: async query => clone(itemMap.get(String(query._id)) || null),
    updateOne: async (query, update) => {
      const row = itemMap.get(String(query._id))
      if (!row) return { matchedCount: 0, modifiedCount: 0 }
      Object.assign(row, clone(update.$set || {}))
      Object.keys(update.$push || {}).forEach(field => {
        if (!Array.isArray(row[field])) row[field] = []
        row[field].push(clone(update.$push[field]))
      })
      return { matchedCount: 1, modifiedCount: 1 }
    },
  }
  const app = {
    isAuth: () => true,
    curDate: () => '2026-09-03 11:00:00',
    dbObjectId: id => String(id),
    dbFindAll: async () => ({ success: true, reply: { data: [] } }),
    db: { collection: name => ({ zdata_cpoe_order_item: itemCollection })[name] },
  }
  return { app, items: itemMap }
}

const save = (h, extra, user) => Process(
  Object.assign({ action: 'set_staff', item_id: ITEM }, extra || {}),
  user || radiologyUser,
  h.app,
)

;(async () => {
  /* ── บันทึกครั้งแรก ─────────────────────────────────────────────────── */
  {
    const h = makeHarness()
    const out = await save(h, { radiographer: NAME_A })
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(out.data.radiographer, NAME_A)
    assert.strictEqual(out.data.previous, '')
    assert.strictEqual(out.data.changed, true)

    const row = h.items.get(ITEM)
    assert.strictEqual(row.radiographer, NAME_A)
    assert.strictEqual(row.radiographer_at, '2026-09-03 11:00:00')
    assert.strictEqual(row.radiographer_by.name, 'เจ้าหน้าที่ รังสี', 'เก็บว่าใครเป็นคนบันทึก')

    /* log คือหัวใจของคำสั่งนี้ — ต้องมีค่าเก่า ค่าใหม่ เวลา และคนแก้ครบ */
    assert.strictEqual(row.radiographer_log.length, 1)
    assert.deepStrictEqual(
      { value: row.radiographer_log[0].value, previous: row.radiographer_log[0].previous, action: row.radiographer_log[0].action, at: row.radiographer_log[0].at },
      { value: NAME_A, previous: '', action: 'set', at: '2026-09-03 11:00:00' },
    )
    assert.strictEqual(row.radiographer_log[0].by.name, 'เจ้าหน้าที่ รังสี')

    /* ผู้กดส่งเข้าเครื่องเดิมห้ามถูกแตะ — คนละฟิลด์ คนละความหมาย */
    assert.deepStrictEqual(row.dispatched_by, { name: 'คนกดส่ง เดิม' })
  }

  /* ── เปลี่ยนคน: log ต้องต่อท้าย ไม่ทับของเดิม ────────────────────────── */
  {
    const h = makeHarness()
    await save(h, { radiographer: NAME_A })
    const out = await save(h, { radiographer: NAME_B })
    assert.strictEqual(out.success, true, out.message)
    assert.strictEqual(out.data.previous, NAME_A, 'ตอบกลับบอกค่าเดิมด้วย')

    const row = h.items.get(ITEM)
    assert.strictEqual(row.radiographer, NAME_B)
    assert.strictEqual(row.radiographer_log.length, 2, 'ประวัติต้องสะสม ไม่ใช่เขียนทับ')
    assert.deepStrictEqual(
      row.radiographer_log.map(entry => [entry.previous, entry.value]),
      [['', NAME_A], [NAME_A, NAME_B]],
    )
  }

  /* ── ล้างค่า: ต้องถูกบันทึกเป็น log เหมือนกัน ไม่ใช่ลบเงียบ ─────────── */
  {
    const h = makeHarness()
    await save(h, { radiographer: NAME_A })
    const out = await save(h, { radiographer: '' })
    assert.strictEqual(out.success, true, out.message)
    const row = h.items.get(ITEM)
    assert.strictEqual(row.radiographer, '')
    assert.strictEqual(row.radiographer_at, '', 'ไม่มีคนแล้วก็ไม่ควรค้างเวลาไว้')
    assert.strictEqual(row.radiographer_log.length, 2)
    assert.strictEqual(row.radiographer_log[1].action, 'clear')
    assert.strictEqual(row.radiographer_log[1].previous, NAME_A, 'ยังรู้ว่าลบใครออก')
  }

  /* ── ค่าเดิมซ้ำ: ไม่ต้องเขียน ไม่ต้องเพิ่ม log ───────────────────────── */
  {
    const h = makeHarness()
    await save(h, { radiographer: NAME_A })
    const out = await save(h, { radiographer: NAME_A })
    assert.strictEqual(out.success, true)
    assert.strictEqual(out.data.changed, false)
    assert.strictEqual(h.items.get(ITEM).radiographer_log.length, 1, 'ไม่มี log ขยะจากการกดซ้ำ')
  }

  /* ── ของที่ต้องปฏิเสธ ───────────────────────────────────────────────── */
  {
    const h = makeHarness()

    assert.strictEqual((await save(h, { radiographer: NAME_A }, wardUser)).success, false,
      'หน่วยงานที่ไม่ใช่รังสีบันทึกไม่ได้')

    let out = await save(h, { item_id: 'not-an-id', radiographer: NAME_A })
    assert.strictEqual(out.error, 'invalid_item_id')

    out = await save(h, {})
    assert.strictEqual(out.error, 'nothing_to_save', 'ไม่ส่งฟิลด์มาเลย = ไม่ใช่การล้างค่า')

    out = await save(h, { radiographer: 'ก'.repeat(121) })
    assert.strictEqual(out.error, 'radiographer_too_long')

    out = await save(h, { item_id: ITEM_LAB, radiographer: NAME_A })
    assert.strictEqual(out.error, 'not_xray_item', 'รายการ LAB ไม่ใช่งานของหน้าจอนี้')
    assert.strictEqual(h.items.get(ITEM_LAB).radiographer, undefined)

    out = await save(h, { item_id: ITEM_CANCELLED, radiographer: NAME_A })
    assert.strictEqual(out.error, 'item_terminal', 'ใบที่ยกเลิกแล้วไม่ต้องบันทึกผู้ถ่าย')
    assert.strictEqual(h.items.get(ITEM_CANCELLED).radiographer, undefined)

    out = await save(h, { item_id: 'cccccccccccccccccccccccc', radiographer: NAME_A })
    assert.strictEqual(out.error, 'item_not_found')

    /* ทุกกรณีข้างบนต้องไม่ทิ้ง log ไว้เลย */
    assert.strictEqual(h.items.get(ITEM).radiographer_log, undefined)
  }

  /* ── ค่าที่บันทึกไว้ต้องถูกส่งกลับให้หน้าจอผ่าน action list ───────────── */
  assert(
    apiBody.includes("radiographer: '$radiographer'"),
    'list ต้องคืน radiographer ไม่งั้นรีเฟรชแล้วค่าที่เลือกจะหายทั้งที่บันทึกแล้ว',
  )
  assert(apiBody.includes("radiographer_at: '$radiographer_at'"))

  console.log('X-ray set_staff (Radiographer) API tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
