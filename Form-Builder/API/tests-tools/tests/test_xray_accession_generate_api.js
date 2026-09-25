const assert = require('assert')
const fs = require('fs')
const path = require('path')

const apiBody = fs.readFileSync(
  path.join(__dirname, '../../api-factory/processes/xray_accession_generate_api.js'),
  'utf8',
)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const Process = new AsyncFunction('params', 'userInfo', 'app', apiBody)

/* Process ID ที่ deploy จริง — ผู้ใช้แจ้ง 2026-09-01
   ล็อกไว้เพื่อให้ dispatch (X3) อ้าง ID เดียวกันได้โดยไม่ต้องเดา */
const DEPLOYED_PROCESS_ID = '6a95cd58422c1ca959829e8d'
assert(
  apiBody.includes('Deployed Process ID: ' + DEPLOYED_PROCESS_ID),
  'the process header must record the deployed Process ID',
)

/* ลิมิตของ RIS — xray_order.json: "เลข Unique ของระบบ PACS; รองรับไม่เกิน 16 ตัวอักษร" */
const RIS_ACCESSION_MAX_LENGTH = 16
/* enum เครื่องทั้ง 11 ค่าจาก Radio Exam master (ตรงกับ MODALITY_MASTER ของ worklist API) */
const MASTER_MODALITY_CODES = ['DX', 'MG', 'US', 'CT', 'RF', 'CR', 'VCUG', 'MR', 'IO', 'UN', 'OT']

const ids = {
  ct1: '111111111111111111111111',
  ct2: '222222222222222222222222',
  cr1: '333333333333333333333333',
  vcug: '444444444444444444444444',
  wrap: '555555555555555555555555',
  lab: '666666666666666666666666',
  noModality: '777777777777777777777777',
  dispatched: '888888888888888888888888',
  sectionOnly: '999999999999999999999999',
  badModality: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  unaliased: 'bbbbbbbbbbbbbbbbbbbbbbbb',
}

const clone = value => JSON.parse(JSON.stringify(value))

const xrayItem = (id, masterId, status) => [id, {
  _id: id,
  xrstatx: 1,
  current_status: status || 'ready',
  service_type: { value: 'xray' },
  item_data_id: masterId,
}]

const makeHarness = ({
  now = '2026-08-31 10:00:00',
  counters = {},
  seededAccession = null,
  extraMasters = {},
  extraItems = {},
  standalone = false,
} = {}) => {
  const items = new Map([
    xrayItem(ids.ct1, 'MASTER-CT'),
    xrayItem(ids.ct2, 'MASTER-CT'),
    xrayItem(ids.cr1, 'MASTER-CR'),
    xrayItem(ids.vcug, 'MASTER-VCUG'),
    xrayItem(ids.wrap, 'MASTER-CT'),
    xrayItem(ids.noModality, 'MASTER-EMPTY'),
    xrayItem(ids.dispatched, 'MASTER-CT', 'accepted'),
    xrayItem(ids.sectionOnly, 'MASTER-SECTION'),
    xrayItem(ids.badModality, 'MASTER-BAD'),
    xrayItem(ids.unaliased, 'MASTER-UNALIASED'),
    [ids.lab, {
      _id: ids.lab, xrstatx: 1, current_status: 'sent', service_type: { value: 'lab' },
    }],
  ])
  Object.entries(extraItems).forEach(([id, masterId]) => {
    const [key, row] = xrayItem(id, masterId)
    items.set(key, row)
  })
  if (seededAccession) {
    items.set('SEEDED', { _id: 'SEEDED', xrstatx: 1, accession_no: seededAccession })
  }

  const masters = new Map([
    ['MASTER-CT', { _id: 'MASTER-CT', xrstatx: 1, xray_item: { modality: 'ct' } }],
    ['MASTER-CR', { _id: 'MASTER-CR', xrstatx: 1, xray_item: { modality: 'CR' } }],
    ['MASTER-VCUG', { _id: 'MASTER-VCUG', xrstatx: 1, xray_item: { modality: 'VCUG' } }],
    ['MASTER-EMPTY', { _id: 'MASTER-EMPTY', xrstatx: 1, xray_item: {} }],
    ['MASTER-BAD', { _id: 'MASTER-BAD', xrstatx: 1, xray_item: { modality: 'CT SCAN!' } }],
    ['MASTER-UNALIASED', { _id: 'MASTER-UNALIASED', xrstatx: 1, xray_item: { modality: 'XYZ' } }],
    ['MASTER-SECTION', { _id: 'MASTER-SECTION', xrstatx: 1, section: { modality_type: 'us' } }],
    ...Object.entries(extraMasters),
  ])
  const counterRows = new Map(Object.entries(counters).map(([key, value]) => [key, clone(value)]))

  const matches = (row, query) => {
    if (!row) return false
    if (query._id && typeof query._id === 'object' && query._id.$ne != null && row._id === query._id.$ne) return false
    if (typeof query._id === 'string' && row._id !== query._id) return false
    if (query.accession_no != null && row.accession_no !== query.accession_no) return false
    if (query.current_status) {
      /* Process ใช้ทั้งค่าเดี่ยวและ $in — mock ต้องรองรับทั้งสองแบบเหมือน MongoDB จริง */
      const rule = query.current_status
      const allowed = (rule && Array.isArray(rule.$in)) ? rule.$in : [rule]
      if (!allowed.includes(row.current_status)) return false
    }
    if (query.$or && !query.$or.some(condition => {
      if (condition.accession_no && condition.accession_no.$exists === false) {
        return !Object.prototype.hasOwnProperty.call(row, 'accession_no')
      }
      if (Object.prototype.hasOwnProperty.call(condition, 'accession_no')) {
        return row.accession_no === condition.accession_no
      }
      return false
    })) return false
    return true
  }

  const itemCollection = {
    findOne: async query => {
      if (typeof query._id === 'string') return clone(items.get(query._id) || null)
      for (const row of items.values()) if (matches(row, query)) return clone(row)
      return null
    },
    updateOne: async (query, update) => {
      const row = items.get(query._id)
      if (!matches(row, query)) return { matchedCount: 0, modifiedCount: 0 }
      Object.assign(row, clone(update.$set || {}))
      return { matchedCount: 1, modifiedCount: 1 }
    },
  }

  /* counter จริงเพิ่มขึ้นเรื่อยๆ ไม่วนกลับ — การหยุดที่ 999 เป็นหน้าที่ของ Process */
  const counterCollection = {
    findOneAndUpdate: async query => {
      const current = counterRows.get(query._id) || { _id: query._id, sequence: 0 }
      const parts = query._id.split(':')
      const next = {
        ...current,
        prefix: parts[1],
        date_key: parts[2],
        modality_code: parts[3],
        sequence: Number(current.sequence || 0) + 1,
      }
      counterRows.set(query._id, next)
      return { value: clone(next) }
    },
  }

  const app = {
    isAuth: () => true,
    curDate: () => now,
    dbObjectId: id => String(id),
    db: {
      collection: name => ({
        zdata_cpoe_order_item: itemCollection,
        zdata_master_item_order: { findOne: async query => clone(masters.get(query._id) || null) },
        zdata_section: { findOne: async () => null },
        zdata_xray_accession_counter: counterCollection,
      })[name],
    },
  }

  /* transaction จำลอง — throw แล้วต้อง rollback ทั้ง item และ counter
     เพราะ Process พึ่ง rollback ตรงนี้เพื่อไม่ให้ครั้งที่ล้มเหลวเผาเลขทิ้ง */
  const snapshot = source => new Map([...source].map(([key, value]) => [key, clone(value)]))
  const restore = (target, saved) => {
    target.clear()
    saved.forEach((value, key) => target.set(key, value))
  }
  const context = {
    mongoTxn: async fn => {
      /* MongoDB ของระบบจริงเป็น standalone — driver ปฏิเสธ session ด้วยข้อความนี้
         Process ต้องมีเส้นทางสำรอง ไม่งั้นออกเลขไม่ได้เลยสักครั้ง (อาการ 2026-09-01) */
      if (standalone) throw new Error('Transaction numbers are only allowed on a replica set member or mongos')
      const itemsBefore = snapshot(items)
      const countersBefore = snapshot(counterRows)
      try {
        return await fn({ id: 'mock-session' })
      } catch (error) {
        restore(items, itemsBefore)
        restore(counterRows, countersBefore)
        throw error
      }
    },
  }
  return { app, context, items, counterRows }
}

const radiologyUser = { roles: ['auth'], username: 'xray-test', unit: { code: 'm0901' } }
const labUser = { roles: ['auth'], username: 'lab-test', unit: { code: '19.P' } }

;(async () => {
  /* ── รูปแบบเลข: SM + YYYYMMDD + MM + NNN · ยาว 15 ตัวเสมอ ────────────── */
  {
    const h = makeHarness()
    const first = await Process.call(h.context, { item_id: ids.ct1 }, radiologyUser, h.app)
    assert.strictEqual(first.success, true)
    assert.strictEqual(first.data.accession_no, 'SM20260831CT001')
    assert.strictEqual(first.data.prefix, 'SM')
    assert.strictEqual(first.data.modality_code, 'CT', 'the master stores "ct"; the number uses uppercase')
    assert.strictEqual(first.data.sequence, 1)
    assert.strictEqual(first.data.remaining, 998)
    assert.strictEqual(first.data.already_assigned, false)
    assert.strictEqual(first.warning, '', 'no warning this early in the day')

    /* running นับต่อภายใน modality เดียวกัน */
    const second = await Process.call(h.context, { item_id: ids.ct2 }, radiologyUser, h.app)
    assert.strictEqual(second.data.accession_no, 'SM20260831CT002')

    /* คนละเครื่อง = คนละสาย ไม่ปนกัน */
    const cr = await Process.call(h.context, { item_id: ids.cr1 }, radiologyUser, h.app)
    assert.strictEqual(cr.data.accession_no, 'SM20260831CR001')

    /* กุญแจ counter ต้องเท่ากับฟิลด์ที่พิมพ์ลงในเลขเป๊ะๆ ห้ามมี Section/Organization */
    assert.strictEqual(h.counterRows.get('xray_accession:SM:20260831:CT').sequence, 2)
    assert.strictEqual(h.counterRows.get('xray_accession:SM:20260831:CR').sequence, 1)
    ;[...h.counterRows.keys()].forEach(key => {
      assert.strictEqual(key.split(':').length, 4, 'counter key = prefix + date + modality only: ' + key)
    })

    /* VCUG ย่อเป็น VC เพื่อให้ยาว 15 ตัวเท่ากันหมดและไม่เกินลิมิต RIS */
    const vcug = await Process.call(h.context, { item_id: ids.vcug }, radiologyUser, h.app)
    assert.strictEqual(vcug.data.accession_no, 'SM20260831VC001')
    assert.strictEqual(vcug.data.modality_code, 'VC')
    assert.strictEqual(vcug.data.modality_source, 'VCUG', 'the full code stays on the record for audit')

    ;[first, second, cr, vcug].forEach(result => {
      assert.strictEqual(result.data.accession_no.length, 15, 'every number is a fixed 15 characters')
    })

    /* idempotent — เรียกซ้ำต้องได้เลขเดิม และ counter ต้องไม่ขยับ */
    const repeated = await Process.call(h.context, { item_id: ids.ct1 }, radiologyUser, h.app)
    assert.strictEqual(repeated.data.accession_no, 'SM20260831CT001')
    assert.strictEqual(repeated.data.already_assigned, true)
    assert.strictEqual(h.counterRows.get('xray_accession:SM:20260831:CT').sequence, 2, 'a repeat must not burn a number')
  }

  /* ── ทุก code ใน master ต้องไม่เกินลิมิต 16 ตัวของ RIS ─────────────────── */
  {
    const extraMasters = {}
    const extraItems = {}
    MASTER_MODALITY_CODES.forEach((code, index) => {
      const masterId = 'MASTER-ENUM-' + code
      extraMasters[masterId] = { _id: masterId, xrstatx: 1, xray_item: { modality: code } }
      extraItems[String(index + 10).padStart(24, 'c')] = masterId
    })
    const h = makeHarness({ extraMasters, extraItems })
    for (const itemId of Object.keys(extraItems)) {
      const result = await Process.call(h.context, { item_id: itemId }, radiologyUser, h.app)
      assert.strictEqual(result.success, true, 'every master modality must be able to produce a number')
      assert.strictEqual(result.data.accession_no.length, 15)
      assert(
        result.data.accession_no.length <= RIS_ACCESSION_MAX_LENGTH,
        'AccessionNo must fit the RIS limit of ' + RIS_ACCESSION_MAX_LENGTH + ': ' + result.data.accession_no,
      )
    }
  }

  /* ── running แยกตามวัน · ขึ้นวันใหม่เริ่ม 001 เอง ────────────────────── */
  {
    const h = makeHarness({
      now: '2026-09-01 08:15:00',
      counters: { 'xray_accession:SM:20260831:CT': { _id: 'xray_accession:SM:20260831:CT', sequence: 47 } },
    })
    const nextDay = await Process.call(h.context, { item_id: ids.ct1 }, radiologyUser, h.app)
    assert.strictEqual(nextDay.data.accession_no, 'SM20260901CT001', 'a new day restarts at 001')
    assert.strictEqual(
      h.counterRows.get('xray_accession:SM:20260831:CT').sequence, 47, 'yesterday is untouched',
    )
  }

  /* ── 999 ใช้ได้ · รายการที่ 1000 หยุด ไม่วนกลับ (decision X19) ───────── */
  {
    const h = makeHarness({
      counters: { 'xray_accession:SM:20260831:CT': { _id: 'xray_accession:SM:20260831:CT', sequence: 998 } },
    })
    const last = await Process.call(h.context, { item_id: ids.ct1 }, radiologyUser, h.app)
    assert.strictEqual(last.success, true, '999 is a usable number')
    assert.strictEqual(last.data.accession_no, 'SM20260831CT999')
    assert.strictEqual(last.data.remaining, 0)
    assert(last.warning.includes('999'), 'the last number warns loudly')

    const overflow = await Process.call(h.context, { item_id: ids.ct2 }, radiologyUser, h.app)
    assert.strictEqual(overflow.success, false, 'the 1000th item must stop, never wrap to 001')
    assert(overflow.message.includes('ครบ 999'))
    assert.strictEqual(h.items.get(ids.ct2).accession_no, undefined, 'no number is written when exhausted')
    assert.strictEqual(
      h.counterRows.get('xray_accession:SM:20260831:CT').sequence, 999,
      'a failed attempt rolls the counter back — it must not creep past 999',
    )
  }

  /* ── เตือนล่วงหน้าตั้งแต่ 950 ────────────────────────────────────────── */
  {
    const h = makeHarness({
      counters: { 'xray_accession:SM:20260831:CT': { _id: 'xray_accession:SM:20260831:CT', sequence: 949 } },
    })
    const warned = await Process.call(h.context, { item_id: ids.ct1 }, radiologyUser, h.app)
    assert.strictEqual(warned.success, true)
    assert.strictEqual(warned.data.sequence, 950)
    assert.strictEqual(warned.data.remaining, 49)
    assert(warned.warning.includes('49'), 'the warning names how many numbers are left')
  }

  {
    const h = makeHarness({
      counters: { 'xray_accession:SM:20260831:CT': { _id: 'xray_accession:SM:20260831:CT', sequence: 948 } },
    })
    const quiet = await Process.call(h.context, { item_id: ids.ct1 }, radiologyUser, h.app)
    assert.strictEqual(quiet.data.sequence, 949)
    assert.strictEqual(quiet.warning, '', 'the warning starts at 950, not before')
  }

  /* ── เลขชนของเดิม (counter ถูกแก้มือ/restore ทับ) = หยุด ─────────────── */
  {
    const h = makeHarness({ seededAccession: 'SM20260831CT001' })
    const collided = await Process.call(h.context, { item_id: ids.wrap }, radiologyUser, h.app)
    assert.strictEqual(collided.success, false)
    assert(collided.message.includes('ถูกใช้ไปแล้ว'))
    assert.strictEqual(h.items.get(ids.wrap).accession_no, undefined, 'no number is written on a collision')
  }

  /* ── ทางสำรองของ modality ───────────────────────────────────────────── */
  {
    const h = makeHarness()
    const fromSection = await Process.call(h.context, { item_id: ids.sectionOnly }, radiologyUser, h.app)
    assert.strictEqual(fromSection.success, true)
    assert.strictEqual(fromSection.data.accession_no, 'SM20260831US001', 'falls back to section.modality_type')
  }

  /* ── การปฏิเสธ ──────────────────────────────────────────────────────── */
  {
    const h = makeHarness()

    const unpaid = 'eeeeeeeeeeeeeeeeeeeeeeee'
    h.items.set(unpaid, {
      _id: unpaid, xrstatx: 1, current_status: 'sent',
      service_type: { value: 'xray' }, item_data_id: 'MASTER-CT',
    })
    const financeBlocked = await Process.call(h.context, { item_id: unpaid }, radiologyUser, h.app)
    assert.strictEqual(financeBlocked.success, false)
    assert(financeBlocked.message.includes('ยังไม่ผ่านการเงิน'))
    assert.strictEqual(h.items.get(unpaid).accession_no, undefined)
    assert.strictEqual(h.counterRows.size, 0, 'an unpaid item must not consume an accession counter')

    /* ทั้งสามหน่วยของกลุ่มรังสีออกเลขได้ (ผู้ใช้ยืนยันผัง 2026-09-01) */
    for (const code of ['m0900', 'm0901', 'CT']) {
      const scoped = makeHarness()
      const user = { roles: ['auth'], username: 'xray-test', unit: { code } }
      const out = await Process.call(scoped.context, { item_id: ids.ct1 }, user, scoped.app)
      assert.strictEqual(out.success, true, code + ' must be allowed to issue a number')
    }

    const noOrg = await Process.call(h.context, { item_id: ids.ct1 }, labUser, h.app)
    assert.strictEqual(noOrg.success, false)
    assert(noOrg.message.includes('ไม่ใช่หน่วยงานรังสี'))
    assert.strictEqual(h.items.get(ids.ct1).accession_no, undefined)

    const badId = await Process.call(h.context, { item_id: 'nope' }, radiologyUser, h.app)
    assert.strictEqual(badId.success, false)
    assert(badId.message.includes('item_id'))

    const labItem = await Process.call(h.context, { item_id: ids.lab }, radiologyUser, h.app)
    assert.strictEqual(labItem.success, false)
    assert(labItem.message.includes('เฉพาะรายการทางรังสี'))

    /* `ids.dispatched` เก็บสถานะ 'accepted' ซึ่งอยู่ในกลุ่ม "รับแล้ว" ⇒ ซ่อมได้
       ตัวที่ห้ามจริงคือรายการที่ออกผล/ยกเลิกไปแล้ว */
    const repairable = await Process.call(h.context, { item_id: ids.dispatched }, radiologyUser, h.app)
    assert.strictEqual(repairable.success, true, 'a received item with no number must be repairable')

    const finished = 'ffffffffffffffffffffffff'
    h.items.set(finished, {
      _id: finished, xrstatx: 1, current_status: 'completed',
      service_type: { value: 'xray' }, item_data_id: 'MASTER-CT',
    })
    const already = await Process.call(h.context, { item_id: finished }, radiologyUser, h.app)
    assert.strictEqual(already.success, false)
    assert(already.message.includes('completed'), 'a finished item cannot be numbered: ' + already.message)

    /* ไม่มีเครื่อง = ข้อมูลผิด ต้องหยุดและบอกให้ไปแก้ master (ผู้ใช้ยืนยัน 2026-09-01) */
    const missing = await Process.call(h.context, { item_id: ids.noModality }, radiologyUser, h.app)
    assert.strictEqual(missing.success, false)
    assert(missing.message.includes('item master'))
    assert(!missing.message.includes('UN'), 'an unmapped item must never silently become UN')

    const bad = await Process.call(h.context, { item_id: ids.badModality }, radiologyUser, h.app)
    assert.strictEqual(bad.success, false)
    assert(bad.message.includes('รูปแบบ'))

    /* code ยาวเกิน 2 ตัวและยังไม่มีตัวย่อ = หยุด ห้ามตัดคำเองจนเลขย่อชนกัน */
    const unaliased = await Process.call(h.context, { item_id: ids.unaliased }, radiologyUser, h.app)
    assert.strictEqual(unaliased.success, false)
    assert(unaliased.message.includes('XYZ'))
    assert(unaliased.message.includes('MODALITY_SEGMENT_ALIAS'))
    assert.strictEqual(h.items.get(ids.unaliased).accession_no, undefined)
  }

  /* ── server ตั้งเป็น พ.ศ. ต้องพังแบบดัง ไม่ใช่ออกเลขผิดถาวร ──────────── */
  {
    const h = makeHarness({ now: '2569-08-31 10:00:00' })
    const buddhist = await Process.call(h.context, { item_id: ids.ct1 }, radiologyUser, h.app)
    assert.strictEqual(buddhist.success, false)
    assert(buddhist.message.includes('ค.ศ.'))
    assert.strictEqual(h.items.get(ids.ct1).accession_no, undefined)
  }

  /* ── MongoDB standalone: ต้องออกเลขได้ ไม่ใช่ล้มทุกครั้ง ─────────────────
     นี่คือสาเหตุจริงของอาการ "สถานะเปลี่ยนแต่ไม่มีเลข Accession" 2026-09-01
     เดิมเรียก mongoTxn ตรง ๆ แล้วทั้ง Process ตายก่อนแตะ counter ด้วยซ้ำ */
  {
    const h = makeHarness({ standalone: true })
    const first = await Process.call(h.context, { item_id: ids.ct1 }, radiologyUser, h.app)
    assert.strictEqual(first.success, true, 'standalone MongoDB must still issue a number: ' + first.message)
    assert.strictEqual(first.data.accession_no, 'SM20260831CT001')
    assert.strictEqual(h.items.get(ids.ct1).accession_no, 'SM20260831CT001')
    assert.strictEqual(h.items.get(ids.ct1).accession_sequence, 1)

    /* idempotent ยังต้องจริงเมื่อไม่มี transaction */
    const again = await Process.call(h.context, { item_id: ids.ct1 }, radiologyUser, h.app)
    assert.strictEqual(again.success, true)
    assert.strictEqual(again.data.accession_no, 'SM20260831CT001')
    assert.strictEqual(again.data.already_assigned, true)
    assert.strictEqual(h.counterRows.get('xray_accession:SM:20260831:CT').sequence, 1, 'a retry must not burn a number')

    /* รายการที่สองของเครื่องเดียวกันเดินต่อเป็น 002 */
    const second = await Process.call(h.context, { item_id: ids.ct2 }, radiologyUser, h.app)
    assert.strictEqual(second.data.accession_no, 'SM20260831CT002')

    /* ข้อผิดพลาดยังต้องรายงานตามเดิม ไม่ใช่กลืนเพราะไม่มี transaction */
    const noModality = await Process.call(h.context, { item_id: ids.noModality }, radiologyUser, h.app)
    assert.strictEqual(noModality.success, false)
    assert(noModality.message.includes('master'), noModality.message)
    assert.strictEqual(h.items.get(ids.noModality).accession_no, undefined)
  }

  /* service_type ที่เก็บเป็น string ตรง ๆ ต้องอ่านได้เหมือน dispatch/worklist
     ไม่งั้นจะมีรายการที่หน้าจอเห็นแต่ออกเลขไม่ได้ โดยไม่มีใครเดาสาเหตุถูก */
  {
    const plainId = 'cccccccccccccccccccccccc'
    const h = makeHarness()
    h.items.set(plainId, {
      _id: plainId, xrstatx: 1, current_status: 'ready',
      service_type: 'xray', item_data_id: 'MASTER-CT',
    })
    const out = await Process.call(h.context, { item_id: plainId }, radiologyUser, h.app)
    assert.strictEqual(out.success, true, 'a plain string service_type must be accepted: ' + out.message)
    assert.strictEqual(out.data.accession_no, 'SM20260831CT001')
  }

  /* ── ซ่อมรายการที่ค้างครึ่งทาง (ผลพวงบั๊ก standalone 2026-09-01) ────────
     ถูก mark ว่า dispatched แล้วแต่ไม่เคยได้เลข ⇒ ต้องออกเลขย้อนหลังได้
     ไม่งั้นสองแถวที่ค้างอยู่หน้าจอจริงจะซ่อมไม่ได้เลยนอกจากแก้ DB มือ */
  {
    /* CPOE เขียนสถานะ "รับแล้ว" ได้หลายคำ — ต้องซ่อมได้ทุกคำในกลุ่ม ไม่ใช่แค่
       'dispatched' ตรงตัว (ของจริงที่ผู้ใช้เจอ 2026-09-01 เป็นคำอื่นในกลุ่มนี้) */
    const received = ['accepted', 'prepared', 'dispensed', 'dispatched', 'in_progress']
    let seq = 0
    for (const status of received) {
      seq += 1
      const stuckId = 'dddddddddddddddddddddd' + String(seq).padStart(2, '0')
      const h = makeHarness()
      h.items.set(stuckId, {
        _id: stuckId, xrstatx: 1, current_status: status,
        service_type: { value: 'xray' }, item_data_id: 'MASTER-CT',
        dispatched_at: '2026-08-31 17:54:11',
      })
      const out = await Process.call(h.context, { item_id: stuckId }, radiologyUser, h.app)
      assert.strictEqual(out.success, true, status + ' with no accession must be repairable: ' + out.message)
      assert.strictEqual(out.data.accession_no, 'SM20260831CT001')
      assert.strictEqual(h.items.get(stuckId).current_status, status, 'the repair must not rewind the status')

      /* กดซ้ำยังต้องได้เลขเดิม ไม่กินเลขใหม่ */
      const again = await Process.call(h.context, { item_id: stuckId }, radiologyUser, h.app)
      assert.strictEqual(again.data.accession_no, 'SM20260831CT001')
      assert.strictEqual(again.data.already_assigned, true)
      assert.strictEqual(h.counterRows.get('xray_accession:SM:20260831:CT').sequence, 1)
    }
  }

  /* ออกผลแล้ว/ยกเลิกแล้ว = ห้ามออกเลขย้อนหลังเด็ดขาด เปิดแค่ sent กับ dispatched */
  {
    const h = makeHarness()
    for (const status of ['resulted', 'completed', 'cancelled', 'rejected', 'returned', 'reversed']) {
      const id = 'eeeeeeeeeeeeeeeeeeeeeee' + '0'
      h.items.set(id, {
        _id: id, xrstatx: 1, current_status: status,
        service_type: { value: 'xray' }, item_data_id: 'MASTER-CT',
      })
      const out = await Process.call(h.context, { item_id: id }, radiologyUser, h.app)
      assert.strictEqual(out.success, false, status + ' must never get a number')
      assert(out.message.includes(status), 'the refusal must name the real status: ' + out.message)
      assert.strictEqual(h.items.get(id).accession_no, undefined)
    }
  }

  console.log('X-ray Accession No. generator API tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
