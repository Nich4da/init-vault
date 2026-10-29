const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'))
const walk = (value, fn) => {
  if (!value || typeof value !== 'object') return
  fn(value)
  if (Array.isArray(value)) value.forEach(item => walk(item, fn))
  else Object.values(value).forEach(item => walk(item, fn))
}
const named = (form, name) => {
  let hit = null
  walk(form, value => { if (value.name === name) hit = value })
  assert(hit, 'missing field ' + name)
  return hit
}

const form = read('Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json')
const template = read('Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json')
const widget = named(form, 'xray_cpoe_worklist')
const queueTracking = named(form, 'xray_queue_tracking')
const labLookup = named(form, 'xray_lab_lookup')
const css = form.formConfig.cssCode

/* structure — โครง container + options ทุกช่องต้องเท่าฟอร์มแม่แบบที่ผ่าน validator */
/* 🔴 root เปลี่ยนโครง 2026-09-08 ตามคำสั่งผู้ใช้ ("แทรก flow คิวที่เหมือนกับฟอร์ม EMR
   … tab unit queue / tab myroom / tab EMR → จะกลายเป็นหน้า xray ของเรา")
   ของเดิม root เป็น grid ตรง ๆ · ของใหม่เป็น tab 3 pane โดย pane "X-ray"
   **ถือ grid ก้อนเดิมทั้งก้อนโดยไม่แก้ข้างใน** ⇒ assertion ทุกข้อถัดจากนี้
   ยังตรวจ grid / grid-col / vue-ui ชุดเดิมเป๊ะเหมือนก่อนเปลี่ยน
   และยังตรึงรูปร่าง root แบบเป๊ะ ไม่ผ่อนเป็น "มีกี่ตัวก็ได้" ตามเจตนาเดิมของเทสนี้ */
const tabRoot = form.fields[0]
assert.strictEqual(tabRoot.component, 'tab', 'root container is the queue tab')
assert.strictEqual(tabRoot.options.name, 'xray_app')
/* lazy = true คือเหตุผลที่ deep link ต้องฝากค่าไว้ที่ form.$xrayQueueTarget
   ถ้าวันหนึ่งมีคนปิด lazy แล้วลบกลไกฝากค่าทิ้ง ปุ่ม X-ray จากคิวจะเงียบ */
assert.strictEqual(tabRoot.options.lazy, true)
/* เพิ่ม Completed เป็นแท็บที่ 4 · 2026-09-08 ตามคำสั่งผู้ใช้ ("tab ที่4 ของ EMR ที่มีความหมายว่า
   สำเร็จ/ส่งต่อคิว ต้องมีด้วย เพราะมันคนละความหมายกับผลออกครบ")
   2026-09-24 แทรกแท็บสืบค้นผลแลประหว่าง X-ray กับ Completed
   🔴 แก้ลำดับ 2026-09-27 ตามคำสั่งผู้ใช้ — ย้ายสืบค้นผลแลปไปท้ายสุด
      ("ตอนนี้มันเป็น tab รวมใหญ่ มันคนละหน้าที่ tab ใหญ่คือสำหรับคิว"
       → "แค่ย้าย tab สืบค้นผลแลปไปอยู่สุดท้าย")
      สี่แท็บแรกเป็นเรื่องคิว/ใบสั่งของห้องรังสี · แท็บท้ายเป็นการสืบค้นผล LAB
      ข้ามห้องแบบอ่านอย่างเดียว จึงไม่แทรกกลางกลุ่มคิว
      2026-10-13 เพิ่มแท็บติดตามคิวแบบ read-only ก่อนสืบค้นผลแลปตาม mockup ที่ยืนยัน
      สิ่งที่ assertion เดิมปกป้อง (ต้องมี 6 แท็บครบ ไม่มีตัวไหนหาย และรูปร่าง root
      ยังตรึงแบบเป๊ะ) ยังตรวจครบ — เปลี่ยนเฉพาะลำดับที่คาดหวัง */
assert.deepStrictEqual(
  tabRoot.tabs.map(pane => pane.options.name),
  ['xray_tab_unit', 'xray_tab_room', 'xray_tab_worklist', 'xray_tab_done', 'xray_tab_tracking', 'xray_tab_lab_lookup'],
)
assert.deepStrictEqual(
  tabRoot.tabs.map(pane => pane.options.label),
  ['Unit Queue', 'My Room', 'X-ray', 'Completed', 'ติดตามคิว', 'สืบค้นผลแลป'],
)
/* แท็บที่เปิดมาเป็นค่าเริ่มต้นต้องยังเป็น X-ray ไม่ใช่แท็บที่เพิ่งย้าย */
assert.deepStrictEqual(
  tabRoot.tabs.filter(pane => pane.options.active === true).map(pane => pane.options.name),
  ['xray_tab_worklist'],
  'the X-ray worklist stays the tab that opens first',
)
/* สืบค้นผลแลปต้องอยู่ท้ายสุดจริง ไม่ใช่แค่ไม่อยู่ตำแหน่งเดิม */
assert.strictEqual(
  tabRoot.tabs[tabRoot.tabs.length - 1].options.name, 'xray_tab_lab_lookup',
  'the read-only LAB lookup sits after every queue tab',
)
/* เปิดฟอร์มมาต้องเห็นตาราง X-ray ก่อนเหมือนเดิม — คิวเป็นของที่เพิ่มเข้ามา ไม่ใช่ของที่มาแทน */
assert.deepStrictEqual(tabRoot.tabs.map(pane => pane.options.active), [false, false, true, false, false, false])

/* แท็บติดตามคิวเป็น display-only: เรียกได้เฉพาะ queue_tracking และต้องไม่มี
   Process/action ที่เขียน lifecycle คิวของ EMR ปะปนเข้ามา */
assert.strictEqual(tabRoot.tabs[4].options.name, 'xray_tab_tracking')
assert.strictEqual(tabRoot.tabs[5].options.name, 'xray_tab_lab_lookup')
assert(queueTracking.onCreated.includes("action:'queue_tracking'"))
assert(queueTracking.onCreated.includes("const PROCESS_ID='6a957009422c1ca959829e45'"))
assert(queueTracking.content.includes('ใช้ดูอย่างเดียว'))
assert(queueTracking.content.includes('คิวอยู่ที่ไหนตอนนี้'))
/* 2026-10-15: ผู้ใช้สั่งตัดเฉพาะกล่องสถานะงานในแต่ละแถว แต่คง status chips
   และสถานะย่อในเลขคิวเพื่อไม่เปลี่ยน flow/ความสามารถในการกรอง */
assert(queueTracking.content.includes('aria-label="กรองสถานะงาน X-ray"'))
assert(!queueTracking.content.includes("['xqt-field','xqt-work'"))
assert(!queueTracking.content.includes('<label>◉ สถานะงาน X-ray</label>'))
assert(!css.includes('.xqt-work'))
assert(queueTracking.content.includes('v-if="patientPhoto(row)"'))
assert(queueTracking.content.includes(':src="patientPhoto(row)"'))
assert(queueTracking.content.includes('<span v-else>{{ initials(row) }}</span>'))
assert(queueTracking.content.includes('<svg viewBox="0 0 24 24"'))
/* 2026-10-15: คลิกพื้นที่สรุปตรงไหนก็ได้ต้องกางรายละเอียด โดยปุ่มลูกศรยังทำงานเดิมและไม่ bubble จน toggle สองรอบ */
assert(queueTracking.content.includes('@click="toggleRouteFromRow(row,$event)"'))
assert(queueTracking.content.includes('@click.stop="toggleRoute(row)"'))
assert(queueTracking.onCreated.includes('s.toggleRouteFromRow='))
assert(css.includes('grid-template-columns:100px minmax(250px,.95fr) minmax(280px,1.35fr) 40px'))
assert(css.includes('.xqt-box-icon svg,.xqt-expand svg{display:block;'))
/* 2026-10-15: ผู้ใช้สั่งตัด dropdown “ทุกตำแหน่ง” ออก และให้คำค้นหาครอบคลุม
   เฉพาะ HN, VN, เลขคิว และชื่อผู้ป่วย โดยคง status chips/refresh ไว้เดิม */
assert(queueTracking.content.includes('placeholder="ค้นหา HN, VN, เลขคิว หรือชื่อผู้ป่วย"'))
assert(!queueTracking.content.includes('<el-select'))
assert(!queueTracking.onCreated.includes('filters.location'))
assert(!queueTracking.onCreated.includes('locationOptions'))
const trackingSearchCode = queueTracking.onCreated.slice(
  queueTracking.onCreated.indexOf('s.searchText='),
  queueTracking.onCreated.indexOf('s.countFor='),
)
for (const searchable of ['row&&row.queue_label', 'row&&row.queue_no', 'p.hn', 'p.vn', 'p.first_name', 'p.last_name']) {
  assert(trackingSearchCode.includes(searchable), 'tracking search keeps ' + searchable)
}
assert(!trackingSearchCode.includes('row&&row.location_label'), 'location is not a search field')
assert(!trackingSearchCode.includes('item&&item.item_name'), 'X-ray item name is not a search field')
assert(css.includes('.xqt-toolbar{display:grid;grid-template-columns:minmax(240px,1fr) auto;'))
const trackingState = {}
new Function(queueTracking.onCreated).call({ vueState: trackingState })
trackingState.rows = [{
  tran_id: 'tran-1',
  queue_label: 'XR-042', queue_no: 42, work_state: 'waiting', location_label: 'CT ROOM',
  patient: { hn: '6900001', vn: 'VN69001', prename: { label: 'น.ส.' }, first_name: 'มาลัย', last_name: 'ใจดี', age: '25', picture: [{ url: '/patient.jpg' }] },
  items: [{ item_name: 'Chest PA' }],
}]
trackingState.toggleRouteFromRow(trackingState.rows[0], { target: { closest: () => null } })
assert.strictEqual(trackingState.expanded['tran-1'], true, 'clicking the tracking summary row expands it')
trackingState.toggleRouteFromRow(trackingState.rows[0], { target: { closest: () => ({}) } })
assert.strictEqual(trackingState.expanded['tran-1'], true, 'interactive/expanded detail targets do not toggle the row again')
assert.strictEqual(trackingState.patientPhoto(trackingState.rows[0]), '/patient.jpg')
assert.strictEqual(trackingState.patientPhoto({ patient: {} }), '')
assert.strictEqual(trackingState.patientMeta(trackingState.rows[0]), 'VN69001 · อายุ 25 ปี  เดือน  วัน')
assert.strictEqual(trackingState.ageValue('3y 2m 1d'), '3 ปี 2 เดือน 1 วัน')
assert.strictEqual(trackingState.ageValue({ year: 4, month: 5, day: 6 }), '4 ปี 5 เดือน 6 วัน')
for (const term of ['6900001', 'vn69001', 'xr-042', '42', 'มาลัย', 'ใจดี']) {
  trackingState.filters.q = term
  assert.strictEqual(trackingState.visibleRows().length, 1, 'tracking search finds ' + term)
}
for (const excludedTerm of ['ct room', 'chest pa']) {
  trackingState.filters.q = excludedTerm
  assert.strictEqual(trackingState.visibleRows().length, 0, 'tracking search excludes ' + excludedTerm)
}
for (const forbidden of ['queue_call', 'queue_done', "action:'start'", "action:'done'", 'ย้ายห้อง', 'เรียกคิวถัดไป']) {
  assert(
    !queueTracking.onCreated.includes(forbidden),
    'read-only tracking widget must not contain queue mutation: ' + forbidden,
  )
}

const grid = tabRoot.tabs[2].fields[0]
const col = grid.cols[0]
const node = col.fields[0]
const templateNode = template.fields[0].cols[0].fields[0]
const expectedLabLookupContent = source => {
  let content = String(source || '')
  const viewTabsStart = content.indexOf('    <div class="lab-view-tabs"')
  const lookupStripStart = content.indexOf('    <div v-if="viewMode===\'today\'" class="lab-status-strip"')
  assert(viewTabsStart >= 0 && lookupStripStart > viewTabsStart, 'LAB lookup parity markers must exist')
  content = content.slice(0, viewTabsStart) + content.slice(lookupStripStart)
  return content.replace('<div class="lab-cpoe">', '<div class="lab-cpoe xray-lab-lookup">')
}
/* กันของฝั่ง LAB รั่วเข้ามา — generator ลอกโครงจากไฟล์ LAB ทั้งไฟล์ ทุก field ที่
   LAB เพิ่มที่ระดับ root จะติดมาด้วยถ้าไม่ตัดทิ้ง (เกิดจริง 2026-09-02: widget
   "Scan HN" ของ LAB โผล่ในฟอร์ม X-ray) ⇒ root ต้องมีเฉพาะของที่ X-ray สร้างเอง
   ตอนนี้คือ container + วิดเจ็ตสแกนของ X-ray ที่ generator สร้างอย่างตั้งใจ
   **ห้ามผ่อนเป็น "มีกี่ตัวก็ได้"** เพราะนี่คือตัวที่จับการรั่วได้ */
/* 2 → 3 เมื่อ 2026-09-11 ตามคำสั่งผู้ใช้ ("คอลัมระดับ order มันจะมีปุ่มนึงชื่อ ปริ้น HN
   เอามาแค่ปุ่มนั้นปุ่มเดียวมาเพิ่มใน json ของเรา") — ปุ่ม "พิมพ์ HN" สั่งงานผ่าน
   widget local-agent-ui เท่านั้น ถ้า root ไม่มีตัวนี้ ปุ่มจะกดแล้วเตือนอย่างเดียวตลอด
   ตัวเลขยังตรึงเป๊ะเหมือนเดิม ไม่ผ่อนเป็น "มีกี่ตัวก็ได้" — หน้าที่จับ LAB รั่วยังอยู่ครบ */
assert.strictEqual(form.fields.length, 3, 'root holds the X-ray container, its scanner, and its print agent')
assert.strictEqual(form.fields[0].component, 'tab', 'the X-ray container is now the tab')
const scanField = form.fields[1]
assert.strictEqual(scanField.component, 'scan-code-ui')
assert.strictEqual(scanField.id, 'scan-code-ui-xray-hn', 'the scanner must be the X-ray one, not LAB\'s')
const agentField = form.fields[2]
assert.strictEqual(agentField.component, 'local-agent-ui')
assert.strictEqual(agentField.id, 'local-agent-ui-xray-printer')
assert.strictEqual(agentField.options.name, 'local_agent', 'printHnLabel looks the agent up by this exact name')
assert.strictEqual(agentField.options.agentKind, 'printer')
/* token ของ print agent — ผู้ใช้สั่งให้ใส่ค่าจริงลงไฟล์ 2026-09-11 ("เอา token เอาอะไรของ
   agent ใส่มาให้เลย") ยกจากฟอร์มที่ deploy อยู่จริง `x-ray-module.json`
   ตรึงค่าไว้เพื่อให้รู้ทันทีถ้ามีใคร generate แล้วมันกลายเป็นค่าว่าง — agent จะไม่เชื่อมต่อ
   และปุ่มพิมพ์จะกดไม่ได้ทั้งหน้าจอโดยไม่มีอะไรฟ้อง
   2026-10-16 ผู้ใช้สั่งให้แทนค่าจริงใน repo ด้วย placeholder ก่อน push repo public
   — ยังตรึงไว้ว่าห้ามว่าง และต้องเป็น placeholder หรือค่าที่ส่งผ่าน XRAY_LOCAL_AGENT_TOKEN */
assert.strictEqual(
  agentField.options.token,
  String(process.env.XRAY_LOCAL_AGENT_TOKEN || '__XRAY_LOCAL_AGENT_TOKEN__').trim(),
  'the agent token must be the placeholder or the env-supplied value, and must never regenerate blank',
)
assert(agentField.options.token.length > 0, 'the agent token must never regenerate blank')
assert.strictEqual(agentField.options.host, '127.0.0.1')
assert.strictEqual(agentField.options.port, 8766)
assert.strictEqual(agentField.options.autoConnect, true, 'the agent must connect without the user clicking Agents')
assert.strictEqual(agentField.options.settingsLabel, 'Agents')
assert(
  !JSON.stringify(form.fields).includes('lab_cpoe_worklist'),
  'nothing LAB-specific may ride along from the template',
)
assert(
  !JSON.stringify(form.fields).includes('scan-code-ui-lab-hn'),
  'and never LAB\'s scanner node',
)
assert.strictEqual(grid.component, 'grid')
assert.strictEqual(col.component, 'grid-col')
assert.strictEqual(node.component, 'vue-ui')
assert.deepStrictEqual(Object.keys(grid.options), Object.keys(template.fields[0].options))
assert.deepStrictEqual(Object.keys(col.options), Object.keys(template.fields[0].cols[0].options))
assert.deepStrictEqual(Object.keys(node.options), Object.keys(templateNode.options))
assert.deepStrictEqual(Object.keys(node), Object.keys(templateNode), 'widget node must keep every template key')
assert.strictEqual(Object.keys(widget).length, 9)
assert.strictEqual(node.formItemFlag, false)
assert(Array.isArray(col.fields) && col.fields.length === 1, 'children live in .fields, never .widgetList')
assert(!('widgetList' in col), 'widgetList does not exist in this schema')

/* ── X-ray ต่างจาก LAB: ไม่มี specimen / Lab No. ─────────────────────────
   แต่ **มี checkbox ราย item เหมือน LAB** — ผู้ใช้ยืนยัน 2026-09-01 ว่า
   1 order มีได้หลาย test และหลาย accession จึงต้องเลือกได้ว่าจะส่งอันไหน */
assert(!widget.content.includes('specimen'), 'X-ray must not carry specimen UI')
assert(!widget.content.includes('Lab no'), 'X-ray has no Lab No.')
assert(widget.content.includes('<el-checkbox :model-value="item.selected"'), 'per-item checkbox, like LAB')
assert(widget.content.includes('@change="toggleItem(item.id)"'))
assert(widget.content.includes(':disabled="!item.can_select"'), 'only actionable items can be ticked')
assert(widget.content.includes('v-if="row.action_locked" class="xr-action-lock-notice"'), 'foreign-unit orders show a read-only notice')
assert(widget.content.includes('{{ row.action_lock_reason }}'), 'the notice says which unit owns the queue/order')
assert(widget.onCreated.includes('can_action:canAction'), 'API action access is copied into every rendered row')
assert(widget.onCreated.includes('can_select:canAction&&'), 'foreign-unit items cannot be selected for write actions')
/* เปลี่ยนตามคำสั่งผู้ใช้ 2026-09-03: จากเดิมเลือกได้ทีละ item เป็น multi-select
   พร้อม checkbox ที่หัวคอลัมน์สำหรับเลือก/ล้างทุกรายการที่ดำเนินการได้ */
assert(
  widget.content.includes(':disabled="!row.can_action||row.dispatching||row.rejecting||row.retesting||!row.dispatch_ready"'),
  'ส่งเข้าเครื่อง accepts selected dispatchable items only; cancelled selections cannot dispatch (2026-09-18)',
)
assert(widget.content.includes(':content="row.dispatch_disabled_reason"'))
assert(widget.content.includes('class="xr-dispatch-tooltip"'))
assert(widget.onCreated.includes("s.isFinanceReadyItem=i=>s.text(i&&i.current_status).toLowerCase()==='ready'"))
assert(widget.onCreated.includes("'ยังไม่ผ่านการเงิน'"))
assert(widget.content.includes('v-if="row.show_payment_status"'), 'the Finance badge is available beside non-cash coverage')
assert(widget.content.includes('@change="toggleAllItems(row)"'), 'the item header has select all')
assert(widget.content.includes(':indeterminate="someSelectableSelected(row)"'))
assert(
  widget.content.includes('<div class="xr-item-check-cell"><el-checkbox :model-value="allSelectableSelected(row)"'),
  'the select-all checkbox has the sticky item-checkbox cell',
)
assert(
  widget.content.includes('<div data-label="เลือก" class="xr-item-check-cell">'),
  'each item checkbox has the same sticky cell',
)
assert(
  css.includes('.xray-cpoe .xr-item-grid-wrap{overflow-x:auto;margin-left:-42px;padding-top:0}'),
  'the item header touches the tab divider and the scroll area includes the left checkbox gutter',
)
/* 1481px → 1621px: ผู้ใช้สั่ง 2026-09-23 ให้เพิ่มคอลัมน์ "สารทึบ" 130px (+ gap 10px)
   ตามตัวเลือก A ⇒ ผลรวม tracks จริงเปลี่ยน assertion จึงต้องตามไปด้วย
   สิ่งที่เทสนี้ปกป้อง (sticky track 42px ตัวแรก + พื้นหลังหัวตารางคลุมทุกคอลัมน์)
   ยังถูกตรวจครบเหมือนเดิม */
assert(
  css.includes('grid-template-columns:42px 150px minmax(215px,1.9fr)') && css.includes('min-width:1621px'),
  'the compact sticky track aligns with the order tab and the blue header covers every real grid track',
)
assert(
  css.includes('.xray-cpoe .xr-item-check-cell{position:sticky;left:0;'),
  'item checkboxes stay visible while the detail table scrolls horizontally',
)
assert(widget.onCreated.includes('s.selectableItemIds='))
assert(widget.onCreated.includes('s.allSelectableSelected='))
assert(widget.onCreated.includes('s.toggleAllItems='))
/* ปุ่มปฏิเสธระดับ item เหมือน LAB (ผู้ใช้ขอ 2026-09-01) */
assert(widget.content.includes('@click="rejectSelected(row)"'), 'item-level reject button, like LAB')
assert(
  widget.content.includes(':disabled="!row.can_action||row.dispatching||row.rejecting||!row.reject_ready"'),
  'reject needs exactly one ticked item that has not been dispatched yet',
)
assert(widget.content.includes('>ปฏิเสธรายการ</el-button>'))
/* ปุ่ม action ระดับ item ใช้สี semantic แบบทึบตาม UI ที่อนุมัติ 2026-09-11 */
assert(
  widget.content.includes('<el-tooltip v-if="row.can_dispatch" placement="top"'),
  'send-to-machine stays a solid green success button',
)
assert(
  widget.content.includes('<el-button v-if="row.can_reject" size="small" type="warning"\n'),
  'item reject is a solid yellow/orange warning button',
)
assert(
  !widget.content.includes('<el-button v-if="row.can_reject" size="small" type="warning" plain'),
  'item reject must not fall back to the pale plain variant',
)
assert(
  widget.content.includes('<el-button v-if="!row.cancelled" size="small" type="danger"\n'),
  'cancel order is a solid red danger button',
)
assert(
  !widget.content.includes('<el-button v-if="!row.cancelled" size="small" type="danger" plain'),
  'cancel order must not fall back to the pale plain variant',
)
/* รายการที่ค้างครึ่งทาง (ส่งเครื่องแล้วแต่ไม่มีเลข) ต้องมองเห็นและกดซ้ำได้ */
assert(
  widget.content.includes('v-else-if="item.needs_accession"'),
  'a half-dispatched row must say it is still missing its accession number',
)
/* แถวที่ส่ง RIS ไม่ผ่านต้องบอกเหตุผลจริงที่ RIS ตอบ ไม่ใช่ประโยคสำเร็จรูป
   (ผู้ใช้ทักท้วง 2026-09-01 ว่า "ส่งเครื่องไม่สำเร็จ · ลองใหม่ได้" ไม่ได้บอกอะไร) */
assert(widget.content.includes('{{ item.transport_note }}'), 'the row shows the real RIS reason')
assert(
  !widget.content.includes('ส่งเครื่องไม่สำเร็จ · ลองใหม่ได้'),
  'the canned retry line must be gone',
)
/* ระดับ order บอก "จำนวน test" ไม่ใช่ชื่อ test ตัวแรก (ผู้ใช้ขอ 2026-09-01 · เหมือน LAB)
   ชื่อครบดูได้ตอน hover ผ่าน el-tooltip ที่ teleport ออกไป จึงไม่โดน overflow ของตารางตัด */
assert(widget.content.includes('{{ row.test_summary }}'), 'the summary row shows a count')
assert(!widget.content.includes('{{ row.test_name }}'), 'never the first test name alone')
assert(!widget.onCreated.includes('more_tests'), 'the +N hint is replaced by the count')
assert(widget.content.includes('<el-tooltip placement="top" :disabled="!row.test_count"'))
assert(widget.content.includes('v-for="line in row.test_list"'), 'hover lists every test')
assert(
  css.includes('.xray-cpoe-test-popper .xr-test-pop-line'),
  'the teleported popper must be styled without the page-root prefix',
)
/* IPD แสดง AN เหนือ HN เท่านั้น; OPD ไม่มีค่าแล้ว v-if ต้องไม่สร้างป้ายเปล่า */
const admissionMarkup = '<div v-if="row.an" class="xr-admission-badge" :title="\'AN : \'+row.an">AN : {{ row.an }}</div>'
assert(widget.content.includes(admissionMarkup), 'IPD AN uses one conditional badge')
assert(
  widget.content.indexOf(admissionMarkup) < widget.content.indexOf('<div class="xr-patient-hn">'),
  'the AN badge sits above HN in the patient column',
)
assert(css.includes('.xray-cpoe .xr-admission-badge{display:flex;width:max-content;max-width:100%'))
assert(css.includes('border:1px solid #f9a8d4;border-radius:999px;background:#fdf2f8;color:#be185d'))
/* หมายเหตุระดับใบอยู่ใต้จำนวนรายการ ตัดด้วย CSS และ hover ดูเต็ม โดยใช้ order_comment
   ที่ API ส่งมาอยู่แล้ว — ไม่เพิ่ม Process/API call และไม่แตะ lifecycle ของ Order */
assert(widget.content.includes('v-if="row.order_note_has"'))
assert(widget.content.includes('popper-class="xray-cpoe-note-popper"'))
assert(widget.content.includes('{{ row.order_note_short }}'))
assert(widget.content.includes('{{ row.order_note_full }}'))
assert(css.includes('.xray-cpoe .xr-order-note{display:block;max-width:100%;margin-top:2px;overflow:hidden'))
assert(css.includes('text-overflow:ellipsis;white-space:nowrap;cursor:default}'))
assert(css.includes('.xray-cpoe-note-popper{max-width:420px}'))
assert(css.includes('.xray-cpoe-note-popper .xr-note-pop{line-height:1.5;white-space:normal'))

/* ระยะห่างคอลัมน์เครื่อง และกล่อง tag ที่รัดตามข้อความจริง */
assert(css.includes('.xray-cpoe .xr-modality-cell,.xray-cpoe .xr-item-modality{padding-right:26px}'))
/* คอลัมน์เครื่องกว้างขึ้นเท่ากับช่องไฟที่เพิ่ม ⇒ tag ยังได้เนื้อที่เท่าเดิม ไม่ตัดบรรทัดถี่ขึ้น */
/* คอลัมน์เครื่องแคบลงเพราะเหลือแค่ตัวย่อ (ผู้ใช้ขอ 2026-09-01) */
assert(css.includes('minmax(142px,1fr) 92px 94px 126px'), 'order row: modality column is code-sized')
assert(css.includes('minmax(215px,1.9fr) 78px 132px'), 'item row: modality column is code-sized too')
/* 2026-10-18: 42331 ในภาพเป็น CPOE item_code ไม่ใช่ Radio Exam code
   เอาออกเฉพาะการ render แต่ห้ามลบออกจาก row data/payload ที่ flow เดิมยังใช้ */
assert(widget.content.includes('<div data-label="รายการตรวจ" class="xr-test-name">{{ item.name }}</div>'))
assert(!widget.content.includes('xr-test-code-inline">{{ item.code }}'), 'internal CPOE item code is hidden from the worklist')
assert(widget.onCreated.includes('code:s.text(i&&i.item_code)'), 'item_code remains available to existing actions/payloads')
assert(widget.onCreated.includes('selected_items_json:JSON.stringify([{source_item_id:itemId,item_code:s.text(item.code)'))
assert(widget.content.includes('<div data-label="เครื่อง" class="xr-item-modality">'))
/* ตัวย่อในตาราง ชื่อเต็มตอน hover — ทั้งระดับ order และ item (ผู้ใช้ขอ 2026-09-01) */
assert(widget.content.includes('v-for="m in row.modalities"'), 'the order row lists every modality it holds')
assert(widget.content.includes(':title="m.label">{{ m.code }}'), 'code in the cell, full name on hover')
assert(widget.content.includes(':title="item.modality_label">{{ item.modality }}'), 'item rows do the same')

/* เปลี่ยน 2026-10-15 ตามคำสั่งผู้ใช้: เหมือน LAB โดยคงตัวย่อสิทธิ์ไว้ และแสดง
   สถานะการเงินร่วมกันตาม Item current_status ชุดเดียวกับปุ่มส่งเข้าเครื่อง */
assert(widget.content.includes('xr-meta-pill xr-source-pill'))
assert(widget.content.includes('v-if="row.show_payment_status" class="xr-inline-tag xr-meta-pill xr-payment-pill"'))
assert(widget.content.includes(':class="{\'is-unpaid\':!row.finance_passed}"'))
assert(widget.content.includes("{{ row.finance_passed ? 'ชำระเงินแล้ว' : 'ยังไม่ได้ชำระเงิน' }}"))
assert(widget.content.includes('xr-meta-pill xr-coverage-pill'))
assert(css.includes('.xr-context-top .xr-payment-pill.is-unpaid{border-color:var(--el-color-danger-light-5,#fab6b6);background:var(--el-color-danger-light-9,#fef0f0);color:var(--danger)}'))
assert(css.includes('.xr-context-top .xr-coverage-pill{border-color:var(--el-color-warning-light-5'))

/* 2026-10-19: ตัดปุ่มตรวจใหม่ระดับ Order; คง action ราย item ในรายละเอียดเท่านั้น */
assert(widget.content.includes('<el-button v-if="!row.cancelled" class="xr-plain-action" size="small"\n              @click="openEmr(row)">EMR</el-button>'), 'EMR hides on a cancelled order')
assert(!widget.content.includes('openRetestSelection'), 'the redundant Order-level retest shortcut is removed')
assert(widget.content.includes('@click="retestOrder(row)">ตรวจใหม่เฉพาะที่เลือก</el-button>'), 'detail button invokes selected-item action')
assert(widget.content.includes(':disabled="!row.can_action||row.retesting||row.dispatching||row.rejecting||!row.retest_ready"'))
assert(widget.content.includes(':loading="row.retesting"'), 'กันกดซ้ำระหว่างรอ server')
assert(!widget.content.includes("explainWriteBlock('ตรวจใหม่')"), 'ไม่เหลือปุ่มที่กดแล้วขึ้นข้อความบล็อกอีก')
assert(css.includes('.xray-cpoe .xr-modality-tag{display:inline-block;width:fit-content'), 'the tag hugs its text')
assert(css.includes('white-space:nowrap;cursor:default}'), 'a code never wraps')
assert(
  css.includes('.xray-cpoe .xr-modality-cell{display:flex;flex-wrap:wrap'),
  'an order may carry several modalities, so the cell wraps them',
)

/* ── กดตรงไหนของแถวก็เลือกได้ ไม่ต้องเล็ง checkbox (ผู้ใช้ขอ 2026-09-01) ── */
assert(widget.content.includes('@click="selectRow(item,$event)"'))
assert(widget.content.includes("'is-selectable':item.can_select"), 'only selectable rows look clickable')
assert(widget.content.includes("'is-selected':item.selected"), 'a picked row is visibly picked')
assert(css.includes('.xray-cpoe .xr-item-row.is-selectable{cursor:pointer}'))
assert(css.includes('.xray-cpoe .xr-item-row.is-selected{background:var(--primary-50)}'))
assert(!widget.content.includes('ปฏิเสธรายการที่เลือก'), 'X-ray never rejects a single item')

/* 2026-09-17: fixed grid ทำให้ Report ทับปุ่มสร้างเมื่อพื้นที่แคบลง
   เปลี่ยน assertion เป็นสัญญาเดิมที่ต้องรักษา: เครื่องขยายตาม code ที่เลือกได้
   และ toolbar ต้องห่อแถวโดยไม่เบียดปุ่มอื่น */
assert(
  css.includes('.xray-cpoe .xr-toolbar{display:flex;flex-wrap:wrap;align-items:flex-start;'),
  'toolbar controls wrap instead of overlapping as the viewport narrows',
)
assert(css.includes('.xray-cpoe .xr-modality-field{display:flex;flex:0 1 auto;width:max-content;max-width:100%'),
  'the machine field still grows to its selected-code trigger width within the available space')
assert(widget.content.includes('class="xr-modality-select"'))
/* ตัวกรองเครื่องเป็น multi-select แล้ว (ผู้ใช้ขอ 2026-09-02)
   ตัวเลือก "Select all" เดิมถูกแทนด้วย clearable + placeholder ซึ่งให้ผลเดียวกัน
   คือ "ไม่เลือกอะไร = ไม่กรอง" — ความสามารถเดิมไม่หาย */
assert(widget.content.includes('multiple clearable'), 'several machines can be picked')
assert(!widget.content.includes('<el-option value="" label="Select all" />'), 'the empty option is replaced by clearable')
assert(widget.content.includes('@change="setModality"'))

/* ── dropdown เลือกลำดับการจัดเรียง (ผู้ใช้ขอ 2026-09-25 · TOR §3.4.3.1) ──────
   ผู้ใช้สั่งให้อยู่ "ข้างๆ filter เลือกเครื่อง modality เลย" ⇒ ล็อกตำแหน่งไว้ด้วย
   ไม่ใช่แค่ล็อกว่ามีอยู่ ไม่งั้นวันหลังถูกย้ายไปท้าย toolbar แล้วเทสไม่จับ */
assert(widget.content.includes('class="xr-sort-field"'), 'the sort control must exist')
assert(widget.content.includes('<span class="xr-sort-label">เรียงตาม</span>'))
assert(widget.content.includes('@change="setSort"'))
assert(
  widget.content.indexOf('class="xr-sort-field"') > widget.content.indexOf('class="xr-modality-field"'),
  'the sort control sits right after the machine filter, as the user asked',
)
assert(
  widget.content.indexOf('class="xr-sort-field"') < widget.content.indexOf('@click="applyFilters"'),
  'it stays before the Search button — i.e. next to the machine filter, not at the end',
)
assert(css.includes('.xray-cpoe .xr-sort-field{display:flex;flex:0 1 auto'), 'the sort field keeps the machine-filter shape')
assert(css.includes('.xray-cpoe .xr-sort-field{flex:1 1 100%;width:100%}'), 'it goes full width on a narrow screen like the machine filter')
/* ตัวกรองเครื่องต้องไม่ถูกแทนที่หรือย้าย — ของเดิมที่ผู้ใช้ยืนยันแล้ว 17 ก.ย. */
assert(widget.content.includes('class="xr-modality-select"'), 'the machine filter must still be there')
assert(widget.content.includes('@change="setModality"'), 'the machine filter handler must stay')
/* ผู้ใช้ตัดปุ่มกากบาทรายเครื่องทิ้ง 2026-09-02 — กดซ้ำที่แถวก็ยกเลิกได้อยู่แล้ว
   เมธอด unpickModality ยังอยู่ (ยังมีเทสคุมพฤติกรรมอยู่) แค่ไม่มีปุ่มเรียก */
assert(!widget.content.includes('xr-opt-clear'), 'the per-option clear icon is gone')
assert(!css.includes('.xr-opt-clear'), 'and so is its style')
assert(widget.onCreated.includes('s.unpickModality='), 'the single-remove method is kept')

/* เปลี่ยนตามคำสั่งผู้ใช้ 2026-09-03: แสดง code ของเครื่องที่เลือกครบทุกตัว
   กล่องขยายตาม tag และห้ามยุบเป็น +N */
assert(!widget.content.includes('collapse-tags'), 'selected machine codes never collapse to +N')
assert(widget.content.includes(':style="{width:modalitySelectWidth()}"'))
assert(widget.onCreated.includes('s.modalitySelectWidth='))
assert(widget.content.includes(':label="m.value" :value="m.value"'), 'dropdown options display abbreviations')
assert(widget.content.includes(':title="m.label">{{ m.value }}'), 'full machine name remains available on hover')
/* nowrap → wrap เมื่อ 2026-09-11 ตามคำสั่งผู้ใช้ ("พอเลือกรายการเยอะเกิน ทำให้เบียดปุ่ม
   เอาเป็นยาวลงมาด้านล่างแทนด้านข้าง") · เจตนาเดิมของ 09-03 ที่ assertion นี้ปกป้อง
   คือ "ต้องเห็นทุก code ไม่ยุบเป็น +N" — ยังคุมอยู่ครบด้วยบรรทัด collapse-tags และ
   max-width:none ด้านล่าง สิ่งที่เปลี่ยนคือทิศทางการขยายเท่านั้น */
assert(
  css.includes('.xray-cpoe .xr-modality-select .el-select__selection,.xray-cpoe .xr-modality-select .el-select__tags{flex-wrap:wrap'),
  'many tags must fall to a new line instead of stretching the toolbar',
)
/* ผู้ใช้แก้ 2026-09-17: เดิมคำนวณจาก 4 tag แต่ flex ยังใส่ 5 tag สั้นในแถวแรก
   คุมจำนวนจริงด้วย 3-column grid โดยคงทุก code และ input ค้นหาของ Element Plus */
assert(css.includes('.xray-cpoe .xr-modality-field.is-multirow .xr-modality-select .el-select__selection{display:grid!important;grid-template-columns:repeat(3,max-content)!important;grid-auto-flow:row'),
  'selected machine tags occupy at most three columns before wrapping')
assert(css.includes('.xray-cpoe .xr-modality-field.is-multirow .xr-modality-select .el-select__input-wrapper{grid-column:1/-1;min-width:0;max-width:100%;contain:inline-size}'),
  'the filter input spans the grid instead of widening a tag column')
assert(css.includes('.el-select__input-wrapper:nth-child(3n+2){grid-column:2/-1}') &&
  css.includes('.el-select__input-wrapper:nth-child(3n){grid-column:3}'),
  'the input uses the remaining space after the fourth or fifth tag')
assert(css.includes('.el-select__input{max-width:100%}'),
  'the filter input cannot stretch a grid track beyond its tag width')
assert(css.includes('.xray-cpoe .xr-modality-field.is-multirow .xr-modality-select .el-select__selection{grid-template-columns:repeat(2,max-content)!important}'),
  'very narrow screens use no more than two columns')
assert(css.includes('.el-select__input-wrapper:nth-child(2n){grid-column:2}'),
  'on very narrow screens the filter input can use the second column')
assert(css.includes('.xray-cpoe .xr-modality-select .el-select__wrapper{min-height:30px;height:auto'),
  'the box grows taller as tags wrap')
assert(css.includes('.xray-cpoe .xr-modality-select .el-tag{max-width:none'), 'every selected abbreviation remains visible')
/* ก่อนเลือก placeholder อยู่กึ่งกลาง; หลังเลือก tag จึงชิดบนเพื่อรองรับหลายแถว */
assert(widget.content.includes(`<div class="xr-modality-field" :class="{'is-picked':modality.length,'is-multirow':modality.length>3}">`),
  'the field uses grid only once a fourth machine needs a new line')
assert(css.includes('.xray-cpoe .xr-modality-select .el-select__wrapper{min-height:30px;height:auto;align-items:center'),
  'the empty Select all placeholder must stay vertically centered')
assert(css.includes('.xray-cpoe .xr-modality-field.is-picked .el-select__wrapper{align-items:flex-start}'),
  'selected tags align to the top while the box grows downward')
/* สีอยู่เฉพาะ tag ใน textbox; กล่อง/label/dropdown คงขาวเทาตาม Element Plus เดิม */
assert(!css.includes('.xr-modality-field.is-picked .el-select__wrapper{background:'),
  'the selected field background must not turn blue')
assert(!css.includes('.xr-modality-field.is-picked .xr-modality-label{color:'),
  'the machine label keeps its normal neutral color')
assert(css.includes('.el-tag{max-width:none;flex:none;border-color:#a0cfff;background:#ecf5ff;color:#337ecc;font-weight:700}'),
  'selected codes are tinted, not plain grey')
/* ความกว้างขึ้นกับแท็กที่กว้างสุดในแต่ละหนึ่งจาก 3 คอลัมน์ ไม่ขึ้นกับจำนวนแถว */
assert(widget.onCreated.includes('columns[index%3]=Math.max('),
  'the trigger width is bounded by three tag columns')
assert(widget.content.indexOf('xr-date-control') < widget.content.indexOf('xr-modality-field'))
assert(widget.content.indexOf('xr-modality-field') < widget.content.indexOf('>Search</el-button>'))
assert(!widget.content.includes('xr-toolbar-spacer'), 'the fixed-grid spacer no longer consumes toolbar width')

/* ── ห้าม hard-code รายชื่อเครื่อง (Xray_design.md §6.2) ─────────────────── */
;['VCUG', 'Air Reduction', 'CT Service', 'MRI Service', 'Portable', 'IVP'].forEach(label => {
  assert(!widget.content.includes(label), 'modality list must not be hard-coded in the template: ' + label)
  assert(!widget.onCreated.includes(label), 'modality list must not be hard-coded in onCreated: ' + label)
})

/* ── worklist 10 คอลัมน์ · min-width 1336px ─────────────────────────────── */
/* คอลัมน์ "เวลาสถานะ" ถูกตัดออก 2026-09-02 (ผู้ใช้ขอ — ระดับ item มีเวลาส่งเข้าเครื่องแล้ว)
   เหลือ 9 คอลัมน์ · ความกว้างรวมลดลงเท่ากับคอลัมน์ที่หายไปพอดี (100px + gap 10px) */
/* แก้ตามคำสั่งผู้ใช้ 2026-09-03: คอลัมน์ "สถานะ" เปลี่ยนจากป้ายเดียวเป็นเช็คลิสต์ 4 ช่อง
   จึงกว้างขึ้น 84px → 108px และ min-width รวมขยับตามพอดี 1149px → 1173px
   คอลัมน์อื่นคงเดิมทุกตัว — การเปลี่ยนนี้จำกัดอยู่ที่คอลัมน์สถานะเท่านั้น */
assert(css.includes('.xray-cpoe .xr-worklist{min-width:1173px'))
assert(css.includes('grid-template-columns:30px minmax(165px,1.3fr) minmax(142px,1fr) 92px 94px 126px minmax(110px,.95fr) 108px 196px'))
assert(!widget.content.includes('xr-statustime-cell'), 'the status-time cell is gone from the table')
/* ── คอลัมน์ "สถานะ" ระดับ order = เช็คลิสต์ 4 ช่อง (ผู้ใช้ขอ 2026-09-03) ──
   หน้าทั่วไปเท่านั้น — ป้ายสถานะระดับ item ในแท็บ order/ผลอ่าน ต้องเหมือนเดิม */
assert(widget.content.includes('<div class="xr-row-status-check"'))
assert(widget.content.includes('v-for="step in row.status_steps"'))
assert(widget.content.includes('{{ step.count }}'), 'แต่ละช่องบอกจำนวนรายการ')
assert(widget.content.includes('v-else-if="step.done"'), 'ขั้นที่ผ่านแล้วขึ้นเครื่องหมายถูกแทนตัวเลข')
assert(widget.content.includes("'is-on':step.active||step.done"), 'ขั้นที่ผ่านแล้วจุดต้องติดด้วย')
assert(widget.content.includes('class="xr-status-check"'))
assert(css.includes('.xray-cpoe .xr-status-check{width:11px;height:11px'), 'เครื่องหมายถูกเท่าจุด ช่องไม่ขยับ')
assert(css.includes('.xray-cpoe .xr-status-step.is-done.xr-dot-waiting .xr-status-check{color:#8a6d00}'))
assert(widget.onCreated.includes('s.STEP_ORDER='), 'ลำดับขั้นต้องเป็นข้อมูล ไม่ใช่เดาในเทมเพลต')
assert(widget.content.includes(':title="step.title"'), 'hover ดอตเห็นชื่อสถานะ')
assert(widget.content.includes(':aria-label="row.status_aria"'), 'ป้ายรวมทั้งใบยังอ่านออกเสียงได้')
assert(!widget.content.includes('{{ row.status_label }}'), 'ป้ายเดียวรวมทั้งใบถูกแทนที่ด้วยเช็คลิสต์')
assert(widget.onCreated.includes('s.statusSteps='), 'เช็คลิสต์คำนวณจาก item state จริง')
assert(css.includes('.xray-cpoe .xr-status-step{display:inline-flex;width:24px'), 'ทุกช่องกว้างเท่ากัน')
assert(css.includes('.xray-cpoe .xr-status-step.is-on.xr-dot-waiting .xr-status-dot{background:#fadb14}'))
assert(css.includes('.xray-cpoe .xr-status-step.is-on.xr-dot-cancelled .xr-status-dot{background:#fab6b6}'))
/* legend อธิบายสีของสถานะหลักครบทุกช่วงโดยไม่ต้อง hover */
assert(widget.content.includes('class="xr-status-legend" aria-label="คำอธิบายสีสถานะ"'))
assert(widget.content.includes('xr-status-legend-dot is-waiting'))
assert(widget.content.includes('<span>รอรับ</span>'))
assert(widget.content.includes('xr-status-legend-dot is-pending'))
assert(widget.content.includes('<span>รอผลตรวจ</span>'))
assert(widget.content.includes('xr-status-legend-dot is-resulted'))
assert(widget.content.includes('<span>ออกผลแล้ว</span>'))
assert(widget.content.includes('xr-status-legend-dot is-cancelled'))
assert(widget.content.includes('<span>ยกเลิก</span>'))
assert(css.includes('.xray-cpoe .xr-status-legend-dot.is-waiting{background:#fadb14}'))
assert(css.includes('.xray-cpoe .xr-status-legend-dot.is-pending{background:#e6a23c}'))
assert(css.includes('.xray-cpoe .xr-status-legend-dot.is-resulted{background:#67c23a}'))
assert(css.includes('.xray-cpoe .xr-status-legend-dot.is-cancelled{background:#f56c6c}'))
assert(css.includes('.xray-cpoe .xr-status-step.is-on.xr-dot-dispatched .xr-status-dot{background:#e6a23c}'))
assert(widget.onCreated.includes("{key:'waiting',label:'รอรับ'}"))
assert(widget.onCreated.includes("{key:'pending',label:'รอผลตรวจ'}"))
assert(css.includes('.xray-cpoe .xr-status-chip[data-status="waiting"]{--chip-color:#fadb14;--chip-border:#fadb14}'))
assert(css.includes('.xray-cpoe .xr-status-chip[data-status="pending"]{--chip-color:#e6a23c;--chip-border:#e6a23c}'))
/* ป้ายสถานะระดับ item (แท็บ order + แท็บผลอ่าน) ห้ามเปลี่ยนตาม */
assert(widget.content.includes('<span class="xr-state-tag" :class="item.status_class">{{ item.status_label }}</span>'))
assert(widget.content.includes('<span class="xr-state-tag" :class="item.state_class">{{ item.state_label }}</span>'))
assert(widget.content.includes('placeholder="HN / VN / ON / Acc. / AN / บัตร ปชช. / ชื่อ"'))
assert(widget.content.includes('title="ค้นหา HN, VN, Order No., Accession No., AN ผู้ป่วยใน, เลขบัตรประชาชน หรือชื่อผู้ป่วย"'))
assert(widget.content.includes('aria-label="ค้นหา HN VN Order No. Accession No. AN ผู้ป่วยใน เลขบัตรประชาชน หรือชื่อผู้ป่วย"'), 'คำเต็มต้องยังอยู่สำหรับ accessibility')
assert(css.includes('.xray-cpoe .xr-item-head{min-height:44px;color:var(--ink);font-size:11px;font-weight:650;border-top:1px solid var(--el-color-primary-light-7,#c6e2ff);border-bottom:1px solid var(--el-color-primary-light-7,#c6e2ff);background:var(--primary-50)}'))
/* ค่ายังคำนวณอยู่ — แกนเดียวกับที่ API ใช้กรอง Date Range เอากลับมาแสดงได้ทันที */
assert(widget.onCreated.includes('s.statusTime='), 'the calculation is kept, only the column was removed')

/* ── คอลัมน์ "เครื่อง" แสดงตัวย่อ ชื่อเต็มอยู่ใน title ─────────────────────
   กลับทิศจากรอบก่อนที่ให้แสดงเต็มคำ — ผู้ใช้เปลี่ยนใจ 2026-09-01 เพราะชื่อเต็ม
   กินที่จนใบที่มีหลายเครื่องแสดงไม่ครบ · ชื่อเต็มยังต้องไม่ถูกตัดทิ้ง ย้ายไป hover */
const modalityTagCss = (css.match(/\.xray-cpoe \.xr-modality-tag\{[^}]*\}/) || [''])[0]
assert(modalityTagCss, 'xr-modality-tag rule must exist')
assert(modalityTagCss.includes('white-space:nowrap'), 'a two-letter code never wraps')
assert(!modalityTagCss.includes('text-overflow:ellipsis'), 'a code must never be truncated either')
/* ป้ายที่ผู้ใช้วงต้องใช้ theme variables เพื่อไม่เป็นพื้นขาวจ้าใน dark mode
   ยกเว้นสีเหลืองหลัก #FADB14 ซึ่งคงเดิม แต่เปลี่ยนพื้น/ข้อความผ่าน custom variables */
assert(css.includes('.dark .xray-cpoe{--xr-wait-bg:rgba(250,219,20,.14);--xr-wait-text:#ffe45c}'))
assert(css.includes('.xray-cpoe .xr-urgent-tag{min-height:18px;padding:0 5px;border-color:var(--el-color-danger-light-5'))
assert(css.includes('.xr-context-top .xr-source-pill{border-color:var(--el-color-primary-light-5'))
assert(css.includes('.xr-context-top .xr-payment-pill{border-color:var(--el-color-success-light-5'))
assert(css.includes('.dark .xray-cpoe .xr-context-top .xr-payment-pill.is-unpaid{border-color:#7a3a3a;background:rgba(245,108,108,.16);color:#ffa8a8}'))
assert(css.includes('.xray-cpoe .xr-order-no-tag{display:inline-flex;max-width:100%;min-height:18px;align-items:center;padding:0 6px;overflow:hidden;border:1px solid var(--el-color-primary-light-5'))
assert(modalityTagCss.includes('border:1px solid var(--border)'))
assert(modalityTagCss.includes('background:var(--fill)'))
assert(modalityTagCss.includes('color:var(--text)'))
assert(css.includes('.xray-cpoe .xr-st-waiting{border-color:#fadb14;background:var(--xr-wait-bg);color:var(--xr-wait-text)}'))
assert(!widget.content.includes('{{ row.modality_label }}'), 'the order cell shows codes now')
assert(!widget.content.includes(':title="item.modality">'), 'the item title must carry the full name')
assert(widget.content.includes('<div></div><div>ผู้ป่วย</div><div></div><div>รายการตรวจ</div><div>เครื่อง</div>'))
assert(widget.content.includes('<div>เวลาสั่ง / Order No.</div><div>แพทย์ / Diagnosis</div><div>สถานะ</div><div></div>'))

/* ── สแกนบาร์โค้ด HN — pattern เดียวกับ LAB (ผู้ใช้ขอ 2026-09-02) ────────── */
assert.strictEqual(scanField.options.name, 'scan_code')
assert.strictEqual(scanField.options.target, 'document', 'document-level scanner like PIS/LAB')
assert.strictEqual(scanField.options.preset, 'keyboard', 'X-ray scanner must use the Keyboard preset, never Both')
assert.strictEqual(scanField.options.minLength, 6)
assert.deepStrictEqual(scanField.options.suffixKeyCodes, [13], 'Enter ends the scan')
assert(scanField.options.onScan.includes("getFieldRef('xray_cpoe_worklist')"), 'it hands the HN to the X-ray widget')
assert(scanField.options.onScan.includes("searchOwner==='lab'&&searchValue===raw"), 'LAB-owned input makes the document scanner return before X-ray routing')
assert(scanField.options.onScan.includes("form.$xraySearchOwner=''"), 'the LAB ownership marker is one-shot')
assert(!scanField.options.onScan.includes('globalThis.document'), 'Field Event sandbox must not depend on document/activeElement')
assert(!scanField.options.onScan.includes('labSearchInput'), 'the scanner no longer guesses ownership from DOM focus')
assert(scanField.options.onScan.includes('state.scanPatientHn(raw)'), 'the raw value is handed over; the widget decides')
assert(scanField.options.onScan.includes('if(form.showPopupFlag)return;'), 'an open popup blocks patient switching')
assert(!scanField.options.onScan.includes('lab_cpoe_worklist'), 'never points at the LAB widget')
assert(labLookup.onCreated.includes('const xrayLabBaseSetSearch=s.setSearch;'), 'the X-ray clone wraps the existing LAB setSearch without replacing LAB logic')
assert(labLookup.onCreated.includes("parent.$xraySearchOwner='lab'"), 'LAB input marks itself as the scan owner')
assert(labLookup.onCreated.includes('return xrayLabBaseSetSearch(value);'), 'LAB setSearch still performs the original search behavior')
assert(widget.content.includes('@click="clearScan"'), 'the scan bar can be cleared')
assert(widget.content.includes('v-if="scanMode"'), 'and it only shows while scanning')
assert(widget.content.includes(':disabled="scanMode"'), 'Date Range is disabled while scanning')
assert(css.includes('.xray-cpoe .xr-scan-context{'), 'the scan bar is styled under the page root')

/* ── PDF แยกตามหน้าที่: ใบสั่งตรวจอยู่ระดับ Order · ผลอ่านอยู่ระดับ item ─────
   ผู้ใช้ยืนยัน 2026-09-02 ว่าผลอ่านต้องอยู่ราย item เพราะส่งและออกผลคนละเวลา
   ต่อมาให้เพิ่มใบสั่งตรวจ PDF ต่อ Order โดยไม่เปลี่ยนพฤติกรรมผลอ่านเดิม */
assert(widget.content.includes('>ดูผล</el-button>'), 'the result button lives on the item row')
assert(widget.content.includes('>ดูภาพ</el-button>'), 'and the image button sits next to it')
/* เปลี่ยนตามคำสั่งผู้ใช้ 2026-09-03: ตัดปุ่ม PDF ระดับ item ในแท็บผลอ่านออก
   สิ่งที่ assertion เดิมปกป้องยังถูกคุมไว้ครบ — ห้ามมี PDF ผลอ่านระดับ Order (สองบรรทัดล่าง)
   และค่า can_pdf/pdf_hint ยังคำนวณอยู่ในข้อมูลแถว เอาปุ่มกลับมาได้ทันทีถ้าเปลี่ยนใจ */
assert(!widget.content.includes("notifyPending('PDF ผลอ่าน')"), 'ปุ่ม PDF ระดับ item ในแท็บผลอ่านถูกตัดออกแล้ว')
assert(widget.onCreated.includes('can_pdf:done'), 'ค่า can_pdf ของ item ยังคำนวณเหมือนเดิม')
assert(widget.onCreated.includes("pdf_hint:done?'พิมพ์ผลอ่าน'"), 'คำอธิบายปุ่มยังอยู่ในข้อมูล')
assert(!widget.content.includes('@click="notifyPending(\'PDF ผลอ่าน\')">PDF</el-button>\n            <el-button v-if="row.has_result"'), 'no order-level result PDF')
assert(!widget.content.includes('openReport(row,row.first_result_item)'), 'no order-level result button')
assert(!widget.content.includes(':disabled="!row.can_pdf"'), 'the order-request PDF never reuses result completion state')
assert(widget.content.includes('<sd-report v-if="!row.cancelled&&orderReportReady(row)"'), 'order row binds the verified order-request Report')
assert(widget.content.includes(':report-list="orderRequestReportList" :params="orderReportParams(row)"'))
assert(widget.content.includes('title="Order นี้ไม่มี Order ID หรือ Visit ID สำหรับสร้างใบสั่ง"'), 'missing report scope fails closed')
assert(widget.content.includes('>ใบสั่ง</el-button>'), 'the order report action uses the requested Thai label')
/* ── ปุ่ม HN (sd-report เปิด PDF) ถูกเอาออกจากแถว Order 2026-09-11 ──────────
   ผู้ใช้สั่ง: "เอาปุ่มนี้ระดับ Order เราออกไปเลย" หลังได้ปุ่ม "พิมพ์ HN" ที่กดแล้วพิมพ์เลย
   assertion เดิมเคยการันตีว่าปุ่มนี้ผูก Report ถูกตัว + ส่ง hn + fail closed เมื่อไม่มี HN
   สิ่งที่มันปกป้องไม่ได้หายไป — ย้ายไปคุมที่ปุ่มพิมพ์แทน (ผูก Report เดียวกัน ใช้
   hnOrderReportReady ตัวเดียวกันเป็นตัว disable) ⇒ สามบรรทัดล่างนี้จับได้ถ้ามีใครเผลอ
   ลบฟังก์ชันพวกนั้นทิ้งตาม เพราะคิดว่ามันตายไปพร้อมปุ่ม */
assert(
  !widget.content.includes('<sd-report v-if="!row.cancelled&&hnOrderReportReady(row)"'),
  'the order-level HN PDF button must stay gone',
)
assert(
  !widget.content.includes('title="Order นี้ไม่มี HN สำหรับสร้างป้ายติดแฟ้ม"'),
  'and so must its disabled fallback',
)
assert(
  !widget.content.includes(':report-list="hnOrderReportList" :params="hnOrderReportParams(row)"'),
  'nothing renders the HN report-list any more — the button is gone (2026-09-11)',
)
// ข้อความ disabled เปลี่ยนตามเงื่อนไขใหม่ 2026-09-04: กันที่ HN ไม่ใช่ Visit ID แล้ว
assert(widget.onCreated.includes("const ORDER_REQUEST_REPORT_ID='6a97f826422c1ca95982a048'"))
assert(widget.onCreated.includes("s.orderRequestReportList=ORDER_REQUEST_REPORT_ID?[{reportId:ORDER_REQUEST_REPORT_ID,label:'ใบสั่ง',type:'pdf'}]:[]"))
/* เปลี่ยน assertion เดิม 2026-09-04 ตามคำสั่งผู้ใช้: ปุ่ม HN ของ X-ray ย้ายจาก
   `5256d813009293b480d0a15c` (ป้ายติดแฟ้ม/VN · รับ xparentx) ไปเป็น `ป้ายติดแฟ้ม (HN)`
   `6a9a355c422c1ca95982a1a2` (รับ hn อย่างเดียว) · หน้า LAB ยังใช้ตัวเดิมและไม่ถูกแตะ */
assert(widget.onCreated.includes("const HN_ORDER_REPORT_ID='6a9a355c422c1ca95982a1a2'"))
assert(!widget.onCreated.includes('5256d813009293b480d0a15c'), 'X-ray ต้องไม่เรียกป้ายตัวเดิมแล้ว')
assert(widget.onCreated.includes("s.hnOrderReportList=HN_ORDER_REPORT_ID?[{reportId:HN_ORDER_REPORT_ID,label:'HN',type:'pdf'}]:[]"))
assert(widget.onCreated.includes('s.orderReportReady=row=>'))
assert(widget.onCreated.includes('s.orderReportParams=row=>'))
assert(widget.onCreated.includes('order_id:s.text(row&&row.id)'))
assert(widget.onCreated.includes('visit_id:s.text(row&&row.emr&&row.emr.visit_id)'))
assert(widget.onCreated.includes('s.hnOrderReportReady=row=>'))
assert(widget.onCreated.includes('s.hnOrderReportParams=row=>({hn:s.text(row&&row.hn)})'),
  'ป้ายใหม่รับ hn อย่างเดียว ⇒ ห้ามส่ง xparentx ต่อ')
assert(!widget.onCreated.includes('xparentx:s.text(row&&row.emr&&row.emr.visit_id)'))

/* ── ปุ่ม "พิมพ์ HN" (ผู้ใช้สั่ง 2026-09-11 · ยกจากฟอร์มที่ deploy อยู่จริง) ──────
   คนละปุ่มกับ HN ข้าง ๆ: HN เปิด PDF · ปุ่มนี้ยิงตรงไป print agent ไม่มี dialog */
assert(
  widget.content.includes('<el-button v-if="!row.cancelled" class="xr-plain-action xr-hn-print" size="small"'),
  'the print button must sit in the order row actions',
)
assert(widget.content.includes(':title="hnPrintHint(row)" @click="printHnLabel(row)">พิมพ์ HN</el-button>'))
assert(widget.content.includes(':disabled="!hnOrderReportReady(row)||!!hnPrinting[row.id]"'),
  'no HN ⇒ disabled, and no double-fire while a job is in flight')
assert(css.includes('.xray-cpoe .xr-hn-print{white-space:nowrap}'))
assert(widget.onCreated.includes("const HN_LABEL_PRINTER='HN/VN Sticker'"),
  'the printer alias must match the one configured in the Agents panel')
assert(widget.onCreated.includes("form.getFieldRef('local_agent')"))
assert(widget.onCreated.includes('agent.printReport(HN_ORDER_REPORT_ID,{'),
  'the print button reuses the HN Report — it must not introduce a second Report ID')
/* ปุ่มพิมพ์ HN เป็นตัวเดียวที่เหลือของฝั่ง HN แล้ว (2026-09-11) — ทั้งสองอย่างนี้
   คือสิ่งที่ assertion ของปุ่ม HN เดิมเคยปกป้อง ต้องยังอยู่ */
assert(widget.onCreated.includes('s.hnOrderReportReady=row=>!!(HN_ORDER_REPORT_ID&&s.text(row&&row.hn))'),
  'no HN ⇒ the print button is disabled — this is the guard the old HN button used')
assert(widget.onCreated.includes("const HN_ORDER_REPORT_ID='6a9a355c422c1ca95982a1a2'"),
  'the HN Report ID must survive the button removal')
/* แถว Order เหลือ PDF · พิมพ์ HN · EMR; ไม่มีปุ่มตรวจใหม่ซ้ำกับ detail */
const rowActionsBlock = widget.content.slice(
  widget.content.indexOf('xr-row-actions'),
  widget.content.indexOf('xr-detail-panel'),
)
assert.strictEqual(
  (rowActionsBlock.match(/<(el-button|sd-report)/g) || []).length,
  4,
  'order row renders PDF + its fallback · พิมพ์ HN · EMR — no duplicate retest action',
)
assert(!rowActionsBlock.includes('>HN</el-button>'), 'the plain HN button is gone from the row')
/* สติ๊กเกอร์ HN เป็น PDF อีกชนิดที่อยู่ระดับ item
   แก้เป็น 8.5 × 2 ซม. และเปิดพิมพ์ได้ก่อนมี Accession; ห้ามกระทบ PDF ผลอ่านเดิม */
assert(widget.content.includes('<div>คนปฏิเสธ</div><div>สติ๊กเกอร์ HN</div>'))
assert(widget.content.includes('<sd-report v-if="itemStickerReady(row,item)"'))
assert(widget.content.includes(':report-list="hnStickerReportList" :params="itemStickerParams(row,item)"'))
assert(widget.content.includes(':title="item.sticker_hint">สติ๊กเกอร์ HN</el-button>'))
assert(widget.onCreated.includes("const HN_STICKER_REPORT_ID='6a980831422c1ca95982a054'"))
assert(widget.onCreated.includes("s.hnStickerReportList=HN_STICKER_REPORT_ID?[{reportId:HN_STICKER_REPORT_ID,label:'สติ๊กเกอร์ HN',type:'pdf'}]:[]"))
assert(widget.onCreated.includes('s.itemStickerReady=(row,item)=>'))
assert(widget.onCreated.includes('s.itemStickerParams=(row,item)=>'))
assert(widget.onCreated.includes('item_id:s.text(item&&item.id)'))
assert(widget.onCreated.includes('printed_date:s.currentPrintDate()'))
/* ปุ่มต้องกดได้เสมอ ไม่ผูกกับ item.done — ยังไม่มีผลก็เปิดดูสถานะรอผลได้ */
assert(!widget.content.includes('<el-button v-if="item.done"'), 'result buttons are never hidden')

/* ผู้ส่ง (คนกดส่งเข้าเครื่อง) ต้องมีในตารางผลอ่านด้วย */
assert(widget.content.includes('<div>ผู้ส่ง</div>'), 'the result table shows who dispatched it')
assert(widget.content.includes('<div>{{ item.dispatched_by }}</div>'))

/* ช่องผู้รับรองผลใน popup ถูก **ตัดออก** ตามคำสั่งผู้ใช้ 2026-09-03
   เดิม assertion นี้คุมว่า "ถ้ามีช่องนี้ ต้องบอกให้ชัดว่ายังไม่บันทึก และห้ามทำปุ่มบันทึกหลอก"
   เจตนานั้นยังอยู่: ไม่มีช่อง = ไม่มีทางเข้าใจผิดว่าบันทึกแล้ว · state/setter ยังอยู่ครบ
   เอากลับมาแสดงได้ทันทีโดยไม่ต้องเขียน logic ใหม่ */
assert(!widget.content.includes('xr-report-certify'), 'ช่องผู้รับรองผลถูกตัดออกจาก popup แล้ว')
assert(!widget.content.includes('ชื่อผู้รับรองผลอ่าน'), 'ไม่มี input ค้างอยู่')
assert(widget.onCreated.includes('s.setReportCertifier='), 'แต่ setter ยังอยู่ ไม่ได้ลบทิ้ง')
assert(widget.onCreated.includes("certified_by:''"), 'และ state ยังถูกรีเซ็ตเหมือนเดิม')

/* แท็บ "ผลอ่าน" เปิดดูโครงตารางได้เสมอ แม้ยังไม่มีผล (ผู้ใช้ขอ 2026-09-02) */
assert(!widget.content.includes(':disabled="!row.has_result"'), 'the results tab is never disabled')
assert(widget.content.includes("'ยังไม่มีผลอ่าน — เปิดดูโครงตารางได้'"), 'and its title says so')
assert(css.includes('.xray-cpoe .xr-result-list{padding-top:0;overflow-x:auto;margin-left:-42px}'), 'the result header touches the tab divider and reaches the same left edge as the order header')
assert(
  css.includes('.xray-cpoe .xr-result-list-head,.xray-cpoe .xr-result-list-row{display:grid;grid-template-columns:56px minmax(230px,2.6fr) 78px minmax(120px,1fr) 130px 120px 150px;gap:12px;align-items:center;min-width:998px;padding:6px 0 6px 42px}'),
  'the result table reserves the same empty left gutter without adding a checkbox',
)
assert(
  css.includes('.xray-cpoe .xr-result-list-head{min-height:44px;border-top:1px solid var(--el-color-primary-light-7,#c6e2ff);border-bottom:1px solid var(--el-color-primary-light-7,#c6e2ff);background:var(--primary-50);color:var(--ink);'),
  'the result header matches the order header height, primary tint, and borders',
)
assert(css.includes('.xray-cpoe .xr-item-head{min-height:44px;'), 'the order and result headers share the same explicit height')
assert(
  widget.content.includes('<div class="xr-patient-row" @click="toggleOrderFromRow(row,$event)">'),
  'the whole order row opens and closes its detail',
)
assert(css.includes('.xray-cpoe .xr-patient-row{min-height:84px;background:var(--white);cursor:pointer;'))

/* ระดับ item ไม่ต้องมี tooltip ตามเมาส์ (ผู้ใช้ขอ 2026-09-02) */
assert(!widget.content.includes(':title="item.select_hint"'), 'no hover tooltip on item rows or checkboxes')
assert(widget.onCreated.includes('select_hint:'), 'the hint text itself is kept as row data')

/* ── ตารางระดับ test · Accession No. อยู่ที่นี่เท่านั้น ──────────────────── */
/* เพิ่มคอลัมน์ "รังสีแพทย์" และเปลี่ยน "ผู้ส่ง" เป็น dropdown Radiographer
   ตามคำสั่งผู้ใช้ 2026-09-03 · min-width 1226 → 1386 → 1420
   และ 2026-09-11 ย้าย checkbox ไป gutter ซ้าย 42px + แก้ความกว้างให้ครบผลรวม tracks จริง = 1481
   และ 2026-09-23 ผู้ใช้สั่งเพิ่มคอลัมน์ "สารทึบ" 130px + gap 10px ⇒ 1481 → 1621 */
assert(css.includes('min-width:1621px'), 'item grid reserves space for both staff dropdowns, the compact sticky checkbox and the contrast column')
assert(
  css.includes('minmax(105px,.9fr) 126px 130px;gap:10px'),
  'the contrast column is appended after สติ๊กเกอร์ HN — every earlier track keeps its old size',
)
assert(css.includes('grid-template-columns:42px 150px minmax(215px,1.9fr)'), 'เลือก remains the compact first column')
assert(widget.content.includes('aria-label="เลือกทุกรายการที่ดำเนินการได้"'))
assert(widget.content.includes('</div>\n              <div>Accession No.</div><div>รายการตรวจ</div><div>เครื่อง</div>'))
/* เวลาสั่งอยู่ที่ระดับ order แล้ว ไม่ต้องซ้ำในระดับ test (ผู้ใช้ขอ 2026-09-01) */
assert(!widget.content.includes('data-label="เวลาสั่ง"'), 'no duplicate order-time column per item')
assert(!widget.onCreated.includes('ordered_text'), 'and no dead field left behind')
assert(widget.content.includes('data-label="เวลาสั่ง / Order No."'), 'the order-level one stays')
/* ชื่อคอลัมน์เป็น Radiologist ตามที่ผู้ใช้ขอ 2026-09-03 (เดิม "รังสีแพทย์") */
assert(widget.content.includes('<div>เวลาส่งเข้าเครื่อง</div><div>Radiographer</div><div>Radiologist</div><div>สถานะ</div><div>ปฏิเสธ</div><div>คนปฏิเสธ</div>'))
assert(widget.content.includes('<div data-label="Radiologist" class="xr-item-radiologist">'))
assert(!widget.content.includes('data-label="รังสีแพทย์"'), 'ชื่อเดิมถูกเปลี่ยนครบทุกที่')

/* ── Staff selectors เชื่อม X-ray Member Master (ผู้ใช้ยืนยัน 2026-09-30) ────
   แก้ contract เดิมที่ hard-code/mockup: Radiographer เลือก master เท่านั้น;
   Radiologist เลือก master หรือพิมพ์แพทย์ภายนอก และทั้งคู่บันทึกจริงระดับ item */
assert(widget.content.includes('<div data-label="Radiographer" class="xr-item-radiographer"'))
assert(widget.content.includes("('ผู้กดส่งเข้าเครื่อง: '+item.dispatched_by)"), 'ค่าเดิมยังอ่านได้ที่ hover')
assert(widget.content.includes('v-for="tech in radiographerOptions"'))
assert(widget.content.includes('@change="value=>setRadiographer(row,item,value)"'))
assert(widget.content.includes(':model-value="item.radiographer" size="small" clearable filterable'))
const radiographerSelector = widget.content.slice(
  widget.content.indexOf('<div data-label="Radiographer"'),
  widget.content.indexOf('</el-select>', widget.content.indexOf('<div data-label="Radiographer"')),
)
assert(!radiographerSelector.includes('allow-create'), 'Radiographer ห้ามพิมพ์รายชื่อเอง')
assert(widget.onCreated.includes("action:'set_staff'"), 'บันทึกผ่าน action ของ Process worklist')
/* ── กันหน้าจอโกหกเมื่อ Process ที่ deploy อยู่ยังไม่มี action ใหม่ (2026-09-03) ──
   Process รุ่นเก่าไม่รู้จัก action → ตกไปทำ list แล้วตอบ success:true พร้อม data.orders
   ถ้าดูแค่ success จะขึ้นข้อความว่าสำเร็จทั้งที่ไม่มีอะไรเปลี่ยน (อาการ "ปุ่มตรวจใหม่ใช้ไม่ได้") */
assert(widget.onCreated.includes('s.actionAnswered='), 'ต้องตรวจทรงของคำตอบ ไม่ใช่ดูแค่ success')
assert(widget.onCreated.includes('Array.isArray(d.orders))return false'), 'คำตอบทรง list = Process ยังไม่รู้จัก action')
assert(widget.onCreated.includes("s.actionAnswered(p,'reopened_item_count')"), 'ตรวจฝั่งตรวจใหม่')
assert(widget.onCreated.includes("s.actionAnswered(p,'item_id')"), 'ตรวจฝั่งบันทึก Radiographer')
assert(widget.onCreated.includes('s.staleProcessNote='), 'บอกตรง ๆ ว่าต้องไป replace body ของ Process')
assert(widget.onCreated.includes('s.applyItemField('), 'อัปเดตค่าในข้อมูลดิบ ไม่โหลดใหม่ทั้งหน้า')
assert(widget.onCreated.includes('radiographer:s.text(i&&i.radiographer)'), 'ค่าที่แสดงมาจากฐานข้อมูล')
assert(widget.onCreated.includes('radiologist:s.text(i&&i.radiologist)'), 'Radiologist ต้องอ่านกลับจากฐานข้อมูลด้วย')
assert(!widget.content.includes('<div data-label="ผู้ส่ง">'), 'คอลัมน์ผู้ส่งเดิมถูกแทนที่แล้ว')
/* แท็บผลอ่านยังมีคอลัมน์ผู้ส่งแบบอ่านอย่างเดียวเหมือนเดิม ไม่ถูกแตะ */
assert(widget.content.includes('<div>{{ item.dispatched_by }}</div>'), 'ตารางผลอ่านยังแสดงผู้ส่งเหมือนเดิม')

/* กล่องเตือนแพ้ยา/COVID อยู่คอลัมน์เดียวกับห้องต้นทาง/การเงิน (ผู้ใช้ขอ 2026-09-03) */
assert(widget.content.includes('<div v-if="row.alert_text" class="xr-alert-box" role="alert"'))
assert(widget.content.includes(':title="row.alert_full"'), 'ข้อความเต็มอยู่ที่ hover')
assert(css.includes('.xray-cpoe .xr-alert-box{'), 'มีสไตล์กล่องแดง')
assert(css.includes('border:1px solid #f56c6c'), 'ขอบแดงตามที่ผู้ใช้ขอ')
assert(widget.onCreated.includes('s.alertList='), 'ข้อความเตือนคำนวณจากข้อมูล API')
assert(widget.onCreated.includes('alerts.covid===true'), 'COVID อ่านค่าจาก API ตรง ๆ ไม่เดาจากข้อความ')
assert(widget.content.includes('v-for="doc in radiologistOptions"'), 'ตัวเลือกมาจาก state ไม่ hard-code ในเทมเพลต')
assert(widget.content.includes('@change="value=>setRadiologist(row,item,value)"'), 'เลือกแล้วผูกกับ item ที่กด')
assert(widget.content.includes('allow-create default-first-option'), 'Radiologist ต้องพิมพ์ชื่อแพทย์ภายนอกได้')
assert(widget.onCreated.includes("const XRAY_MEMBER_FORM_ID='6abcb7c0c54b3f93ce7a0489'"))
assert(widget.onCreated.includes('api.crudGetAll({sdProvider:XRAY_MEMBER_PROVIDER,totalEnable:true}'))
assert(widget.onCreated.includes("const RADIOGRAPHER_POSITIONS=['RADIOGRAPHER_PRO','RADIOGRAPHER_PRACTICE']"))
assert(widget.onCreated.includes("const RADIOLOGIST_POSITIONS=['RADIOLOGIST_PRO','RADIOLOGIST_SENIOR']"))
assert(!widget.onCreated.includes("{value:'พญ.กนกพร"), 'ห้าม hard-code รายชื่อแพทย์ใน Worklist อีก')
assert(!widget.onCreated.includes("{value:'นางสุกัญญา"), 'ห้าม hard-codeรายชื่อผู้ถ่ายใน Worklist อีก')
assert(widget.onCreated.includes('s.setRadiologist='), 'มีตัวรับค่าที่เลือก')
assert(widget.onCreated.includes('s.setRadiographer='))
assert(widget.onCreated.includes("s.setStaff=async(row,item,kind,value)=>"), 'ทั้งสองช่องใช้เส้นบันทึกเดียวกัน')
assert(widget.onCreated.includes("payload[kind+'_source']=source"), 'ต้องเก็บ master/external source')
assert(widget.onCreated.includes("payload[kind+'_member_id']=memberId"), 'ต้องเก็บ member id สำหรับค่าจาก master')
/* แท็บผลอ่านต้องไม่มี dropdown นี้ — มันอยู่แท็บ order เท่านั้น */
const resultBlock = widget.content.slice(widget.content.indexOf('xr-result-list'))
assert(!resultBlock.includes('setRadiologist'), 'แท็บผลอ่านต้องไม่มี dropdown รังสีแพทย์')
assert(!widget.content.includes('xr-order-cell">\n            <span class="xr-accession'), 'accession must stay at test level')

/* ── chip กับตารางต้องนับชุดสถานะเดียวกันเสมอ ─────────────────────────────
   API แบ่ง bucket จาก STATUS_VOCABULARY ของตัวเอง (facet `buckets` ไม่กรองสถานะ)
   ส่วนตาราง (`rows`/`meta`) กรองด้วย statuses[] ที่ฟอร์มส่งไป
   ถ้าสองอย่างไม่ตรงกัน chip จะขึ้นตัวเลขแต่ตารางว่าง — เกิดจริงเมื่อ 2026-09-01
   เพราะฟอร์มไม่ได้ส่ง `draft` · เทสต์นี้อ่าน vocabulary จากซอร์ส API ทุกครั้ง */
const worklistApi = fs.readFileSync(
  path.join(root, 'Form-Builder/API/api-factory/processes/xray_cpoe_worklist_api.js'), 'utf8',
)
assert(
  worklistApi.includes("order_comment: '$order.order_comment'"),
  'the existing Worklist API projection must keep the order-level note used by the UI',
)

assert(
  worklistApi.includes("an: '$order.vid.an'"),
  'the existing Worklist API projection must keep visit.an for the conditional IPD badge',
)

/* ── ปุ่มสร้างรายการใหม่ต้องสลับฟอร์มได้โดยไม่ต้องแก้โค้ด (ผู้ใช้ขอ 2026-09-03) ──
   🔴 เปลี่ยนค่าเริ่มต้น 2026-09-08 ตามที่ผู้ใช้รายงานว่ากดแล้วขึ้น
   "ไม่ได้รับ patient context" — CPOE ตัวจริงต้องเปิดจากฟอร์มแม่เท่านั้น
   ค่าเริ่มต้นจึงต้องเป็นโคลนที่มีช่องเลือก VN (ตัวเดียวกับที่ LAB ใช้)
   ของเดิมต่อผ่าน env ⇒ generate ใหม่ทีไรก็เด้งกลับฟอร์มที่เปิดไม่ได้ทุกที
   assertion นี้คือตัวที่กันไม่ให้มันเด้งกลับอีก */
const worklistBuilder = fs.readFileSync(
  path.join(root, 'Form-Builder/seed/tests-tools/scripts/build_xray_cpoe_worklist_ui.js'), 'utf8',
)
assert(
  worklistBuilder.includes("const defaultCpoeOrderAppId = '6a995d064744260ea8c9498c'"),
  'ค่าเริ่มต้นของปุ่มต้องเป็นโคลนที่เลือก VN ได้เอง ไม่ใช่ CPOE ตัวจริงที่ต้องมีฟอร์มแม่',
)
assert(
  widget.onCreated.includes("const CPOE_ORDER_APP_ID='6a995d064744260ea8c9498c'"),
  'และฟอร์มที่ generate ออกมาต้องชี้ไปที่โคลนจริง ๆ ไม่ใช่แค่ค่าในสคริปต์',
)
assert(widget.onCreated.includes('on_order_sent:()=>{s.page={...s.page,current:1};s.loadOrders();}'), 'successful Order refreshes the Worklist')
assert(!widget.onCreated.includes('MOVE_UNIT_FORM_ID'), 'creating an X-ray Order must not open Move Unit')
assert(!widget.onCreated.includes('openMoveUnitAfterOrder'), 'creating an X-ray Order must not move or create Visit Tran')
assert(worklistBuilder.includes('process.env.XRAY_CPOE_ORDER_APP_ID'), 'สลับฟอร์มได้ด้วย env')
assert(
  worklistBuilder.includes("throw new Error('XRAY_CPOE_ORDER_APP_ID must be the 24-character Form ID"),
  'ค่าที่ผิดรูปต้องล้มตอน generate ไม่ใช่ไปเงียบอยู่ในฟอร์ม',
)
const vocabularyBlock = (worklistApi.match(/const STATUS_VOCABULARY = \{([\s\S]*?)\}/) || [])[1]
assert(vocabularyBlock, 'cannot read STATUS_VOCABULARY from the worklist API')
const apiBuckets = {}
vocabularyBlock.split('\n').forEach(line => {
  const hit = /^\s*([a-z_]+):\s*'(waiting|pending|complete|cancelled)'/.exec(line)
  if (!hit) return
  ;(apiBuckets[hit[2]] = apiBuckets[hit[2]] || []).push(hit[1])
})

const formStatusMap = (widget.onCreated.match(/s\.statusMap=\{([\s\S]*?)\};/) || [])[1]
assert(formStatusMap, 'cannot read statusMap from the form')
const formBucket = name => {
  const hit = new RegExp(name + ':\\[([^\\]]*)\\]').exec(formStatusMap)
  assert(hit, 'statusMap is missing ' + name)
  return (hit[1].match(/'([a-z_]+)'/g) || []).map(x => x.replace(/'/g, '')).sort()
}
;['waiting', 'pending', 'complete', 'cancelled'].forEach(bucket => {
  assert.deepStrictEqual(
    formBucket(bucket),
    apiBuckets[bucket].sort(),
    'chip "' + bucket + '" must request exactly the statuses the API puts in that bucket',
  )
})
assert.deepStrictEqual(formBucket('all'), [], 'the all chip must send no statuses so the API uses its own vocabulary')

/* ── Diagnosis จาก EMR ────────────────────────────────────────────────────
   ตัดข้อความด้วย CSS ตามความกว้างคอลัมน์จริง ไม่ใช่นับตัวอักษรใน JS
   แล้ว hover เห็นเต็มผ่าน el-tooltip ที่ teleport ออกไป (ไม่โดน overflow ตัด) */
assert(widget.content.includes('popper-class="xray-cpoe-dx-popper"'))
assert(widget.content.includes(':disabled="!row.dx_has"'), 'no tooltip when there is no diagnosis')
assert(widget.content.includes('{{ row.dx_full }}'), 'hover shows the untruncated text')
assert(!widget.onCreated.includes('s.shorten(dx'), 'JS character truncation must be gone')
assert(css.includes('.xray-cpoe .xr-diagnosis-summary{display:block;margin-top:2px;overflow:hidden'))
assert(css.includes('text-overflow:ellipsis;white-space:nowrap}'), 'CSS does the truncating')
assert(css.includes('.xray-cpoe-dx-popper{max-width:420px}'), 'a long diagnosis must not make a huge tooltip')
assert(css.includes('.xray-cpoe-dx-popper .xr-dx-pop{line-height:1.5;white-space:normal'))

/* ── เลข Accession มีทางออกทางเดียว: ผ่าน dispatch ─────────────────────────
   เคยมีปุ่ม "ออกเลข" แยกไว้ตอน dispatch ยังไม่เสร็จ · ถอดออก 2026-09-01 เพราะเปิดทาง
   ให้ได้เลขมาโดยที่ยังไม่ได้รับและ RIS ไม่รู้เรื่อง */
assert(!widget.content.includes('issueAccession'), 'no manual accession button may come back')
assert(!widget.onCreated.includes('issueAccession'), 'no manual accession method may come back')
assert(
  !widget.onCreated.includes('ACCESSION_PROCESS_ID='),
  'the form must not call the accession Process directly — dispatch owns it',
)
/* แก้ 2026-09-09 ตามคำสั่งผู้ใช้ ("A") ที่ให้เอาสถานะจาก RIS มาแสดงบน worklist
   เดิม assert สตริงเต็มบรรทัดว่าช่องนี้มีแค่ {{ item.accession_no }} ซึ่งผูกกับ
   *รูปแบบ* ไม่ใช่สัญญาจริง · สัญญาจริงคือ "ช่องนี้ห้ามมีตัวออกเลข Accession"
   ⇒ ยังเช็คเหมือนเดิมว่าช่องนี้โชว์เลข และ **เพิ่มการเช็คให้เข้มกว่าเดิม** ว่า
     ในช่องนี้ต้องไม่มีปุ่ม/ตัวคลิกใด ๆ ปนมา ซึ่งของเดิมไม่เคยเช็คตรง ๆ เลย */
const accessionCell = widget.content.slice(
  widget.content.indexOf('<div data-label="Accession No."'),
  widget.content.indexOf('<div data-label="รายการตรวจ"'),
)
assert(accessionCell, 'the Accession cell must exist')
assert(accessionCell.includes('{{ item.accession_no }}'), 'the Accession cell still shows the number')
assert(!/@click|<el-button|<button/.test(accessionCell), 'the Accession cell stays display-only')

/* ── ชิปสถานะที่ RIS แจ้งกลับ (เพิ่ม 2026-09-09 · ผู้ใช้เลือก A) ────────────
   ขา xray_order_status_change เป็นขา **เข้า** — ห้ามฟอร์มยิงออกไปเองเด็ดขาด */
assert(accessionCell.includes('xr-ris-chip'), 'the RIS status chip lives in the Accession cell')
assert(
  accessionCell.includes('v-if="item.ris_status_label"'),
  'no chip at all when RIS has not reported yet',
)
assert(
  widget.onCreated.includes("s.RIS_STATUS_LABEL={A:'RIS: เครื่องรับรายการแล้ว',C:'RIS: มีภาพแล้ว · รอแพทย์อ่าน'};"),
  'only Arrival and Completed are labelled',
)
assert(
  widget.onCreated.includes("return (v==='A'||v==='C')?v:'';"),
  'any other Status (including N) must not render a chip',
)
assert(
  !widget.onCreated.includes('STATUS_CHANGE_PROCESS_ID'),
  'the form must never call the inbound status-change Process',
)
assert(css.includes('.xray-cpoe .xr-ris-chip{'), 'the chip needs its own style')
assert(
  !/xr-item-grid\{[^}]*grid-template-columns[^}]*\}/.test(css) ||
  css.includes('.xray-cpoe .xr-ris-chip{display:inline-block'),
  'the chip must sit inline inside the existing cell, not add a column',
)

/* ปุ่ม ส่งเข้าเครื่อง เรียก dispatch Process ตัวเดียว ลำดับอยู่ฝั่ง server */
assert(widget.content.includes('@click="dispatchOrder(row)"'))
assert(widget.content.includes('{{ row.dispatch_label }}'), 'label switches to ส่งเข้าเครื่องใหม่ on a retry')
assert(
  widget.onCreated.includes("const DISPATCH_PROCESS_ID='6a967029422c1ca959829edc'"),
  'the deployed dispatch Process ID must be wired into onCreated',
)
assert(
  !widget.content.includes("explainWriteBlock('ส่งเข้าเครื่อง')"),
  'dispatch is wired now — it must not fall back to the write-block notice',
)

/* ── ปุ่มท้ายแถวคอลัมน์เดียว ไม่มีช่อง – · ใบยกเลิกเหลือ EMR ────────────── */
assert(css.includes('.xray-cpoe .xr-row-actions{display:flex;align-items:center;justify-content:flex-end'))
assert(widget.content.includes('<el-button v-if="!row.cancelled" class="xr-plain-action" size="small"'))
assert(widget.content.includes('@click="openEmr(row)">EMR</el-button>'))
/* ผูก EMR History แบบเดียวกับ LAB — ID และทรงการเรียกต้องตรงกัน */
assert(widget.onCreated.includes("const EMR_FORM_ID='6a96557e422c1ca959829eae'"))
assert(
  widget.onCreated.includes("form.openForm(EMR_FORM_ID,'','',null,"),
  "the third argument must stay '' — visit_id travels in params, as LAB does",
)
/* ยกเลิก order เชื่อมแล้ว 2026-09-01 (ทรงเดียวกับ LAB) — ไม่ใช่ปุ่มที่บอกว่ายังทำไม่ได้ */
assert(widget.content.includes('@click="openCancelOrder(row)"'), 'cancel is wired, not blocked')
/* ป้ายความเร่งด่วนต้องอ่านชื่อจากแถว ไม่ใช่คำตายตัว (ผู้ใช้สั่ง 2026-09-11) */
assert(
  widget.content.includes('<span v-if="row.urgent" class="xr-inline-tag xr-urgent-tag">{{ row.urgent_label }}</span>'),
  'the urgency tag must render the level name the order actually carries',
)
assert(
  !widget.content.includes('xr-urgent-tag">เร่งด่วน<'),
  'the hardcoded single-word tag must stay gone',
)
assert(
  widget.onCreated.includes("const PRIORITY_LABEL={'2':'ด่วน','3':'ด่วนที่สุด','4':'ด่วน OR','5':'ด่วน อุบัติเหตุ'};"),
  'the five CPOE priority levels must stay in sync with the CPOE Order App',
)
assert(!widget.content.includes("explainWriteBlock('ยกเลิก order')"), 'the placeholder must be gone')
assert(widget.content.includes(':disabled="!row.can_action||row.dispatching||row.rejecting||cancelDialog.loading||!row.can_cancel"'))
assert(widget.content.includes('cancelDialog.financeLoading||cancelDialog.reasonLoading||!cancelDialog.financeChecked||!cancelDialog.canCancel'),
  'cancel confirmation must stay disabled until finance preflight passes')
assert(widget.content.includes('@click="submitCancelOrder"'), 'the confirm dialog submits the cancel')
/* ผู้ใช้ยืนยัน 2026-09-18: ปุ่มเดิมยกเลิกเฉพาะ item ที่ติ๊ก จึงเปลี่ยน copy
   แต่ยังคง assertion ว่าต้องมี dialog ยืนยันและส่งผ่าน Process เดิม */
assert(widget.content.includes('ยืนยันยกเลิกรายการที่เลือก'))
assert(widget.content.includes('@click="retestOrder(row)"'), 'ตรวจใหม่เฉพาะที่เลือก ต่อ API แล้ว')
/* ── ปุ่ม "ดูภาพ" ต่อกับ viewer ของ RIS แล้ว · เปลี่ยนตามคำสั่งผู้ใช้ 2026-09-15 ──
   ทีม RIS ส่ง contract มาครบสอง level ด้วย base เดียวกัน:
     QueryMode=AN&Value=<Accession No.>  ← ราย study · QueryMode=PID&Value=<HN> ← รายคนไข้
   assertion เดิมคือ widget.content.includes('รอเชื่อมกับโปรแกรม RIS') ซึ่งปกป้อง D-X17
   "ห้ามเป็นปุ่มตาย" — เจตนานั้นยังถูกคุมครบด้านล่าง: ตราบใดที่ viewer ยังปิดอยู่
   ปุ่มต้องบอกผู้ใช้ทั้งตอนกดและตอน hover ว่ารอ RIS เปิดลิงก์ ไม่ใช่กดแล้วเงียบ */
assert(widget.content.includes('@click="openImage(row,item)"'), 'ปุ่มดูภาพเรียก viewer ของ RIS')
assert(widget.content.includes(':title="imageHint(row,item)"'), 'และบอกล่วงหน้าว่าจะเปิดด้วย AN หรือ HN')
assert(
  widget.onCreated.includes("s.notifyPending('ดูภาพ · RIS ยังไม่เปิดลิงก์')"),
  'ปิดอยู่ = ยังต้องแจ้งผู้ใช้ ห้ามเงียบและห้ามเปิดแท็บ error (D-X17)',
)
assert(
  widget.onCreated.includes("return 'ดูภาพ · รอ RIS เปิดลิงก์ให้ใช้งาน'"),
  'tooltip ก็ต้องบอกสถานะรอเชื่อมต่อเหมือนกัน',
)
assert(
  widget.onCreated.includes("const mode=an?'AN':(hn?'PID':'')"),
  'มีเลข Accession ใช้ AN เจาะ study นั้น · ยังไม่มีจึงตกไป PID ของคนไข้',
)
assert(
  widget.onCreated.includes("'QueryMode='+mode+'&Value='+encodeURIComponent(an||hn)"),
  'URL ตาม contract ของ RIS และ escape ค่าเสมอ',
)

/* ── ต้องเป็น <a> จริง ไม่ใช่ window.open (ผู้ใช้เจอของจริง 2026-09-17) ──────────
   ของเดิมเป็นปุ่มที่เรียก window.open() ⇒ เบราว์เซอร์นับเป็นป๊อปอัปที่สคริปต์สั่งเปิด
   ผู้ใช้ตั้ง "Pop-ups and redirects = Allow" ให้ his.softmax-one.com แล้วยังโดนบล็อก
   เพราะหน้าฟอร์มถูกฝังใน iframe ที่ไม่อนุญาต popup ⇒ ตั้งค่าเบราว์เซอร์แก้ไม่ได้เลย
   ลิงก์ที่คนคลิกเองเป็น navigation ปกติ เบราว์เซอร์ไม่บล็อก และไม่ต้องตั้งค่าทีละเครื่อง
   🔴 เจตนาเดิมทุกข้อยังอยู่: ปิดอยู่/ไม่มีเลข = ตกไปใช้ปุ่มที่แจ้งเหตุผล (assert ด้านบน) */
assert(
  widget.content.includes('<a v-if="viewerHref(row,item)"'),
  'ดูภาพต้องเป็นลิงก์จริงเมื่อมี URL ไม่งั้นโดน popup blocker',
)
assert(widget.content.includes('target="_blank"'), 'เปิดแท็บใหม่ ไม่ทับหน้างานที่ค้างอยู่')
assert(
  widget.content.includes('rel="noopener noreferrer"'),
  'ตัด opener ทิ้ง — หน้าปลายทางต้องเข้าถึง window.opener ของ HIS ไม่ได้',
)
assert(
  widget.content.includes('<el-button v-else size="small" :title="imageHint(row,item)" @click="openImage(row,item)"'),
  'ไม่มี URL ต้องตกกลับไปใช้ปุ่มเดิมที่อธิบายเหตุผล ห้ามเป็นลิงก์ตาย',
)
assert(
  css.includes('a.xr-viewer-link') && css.includes('text-decoration:none'),
  'ลิงก์ต้องหน้าตาเหมือนปุ่ม ไม่มีขีดใต้',
)
assert(
  !widget.onCreated.includes("window.open(url,'_blank','noopener"),
  'ห้ามใส่ noopener ใน window features — browser คืน null จนแยก popup blocker ไม่ออก',
)
/* ไม่มี Process/endpoint ใหม่ — HN กับ Accession มาจาก payload ของ worklist API เดิม
   ถ้าวันหนึ่งมีคนเติม API ตัวใหม่เพื่อเรื่องนี้ แปลว่าเข้าใจผิด: viewer อยู่บนเครื่อง
   ผู้ใช้ (localhost) ฝั่ง server ยิงไปไม่ถึง */
assert(widget.onCreated.includes("const RIS_VIEWER_BASE='http://localhost:9090';"))
/* 🔴 เปิดใช้งานแล้ว — ผู้ใช้สั่งเอง 2026-09-15 ("ก็ใส่ลิ้งแล้วเปิดให้กดเป็น newtab ได้เลย")
   หลังทีม RIS ยืนยัน contract ครบสอง level · ก่อนหน้านี้บรรทัดนี้ตรึง false ไว้ระหว่างรอ
   RIS เปิดเส้นทาง — เจตนาเดิมคือกันไม่ให้ ship ปุ่มที่พาไป ERR_CONNECTION_REFUSED
   ผู้ใช้รับทราบข้อนั้นแล้วและเลือกเปิด เพราะจะได้ใช้ได้ทันทีในวินาทีที่ RIS เปิดเส้นทาง
   โดยไม่ต้อง import ฟอร์มใหม่อีกรอบ
   ⚠️ เพราะเปิดอยู่ ปุ่มจะเปิดแท็บใหม่จริงทุกครั้ง — ระหว่างที่ RIS ยังไม่เปิดเส้นทาง
   แท็บนั้นจะขึ้นหน้า error ของ browser ไม่ใช่ข้อความของเรา (ยอมรับแล้ว)
   จะกลับไปปิด: generate ใหม่โดยไม่ตั้ง XRAY_RIS_VIEWER_ENABLED แล้วแก้บรรทัดนี้กลับ */
assert(
  widget.onCreated.includes('const RIS_VIEWER_ENABLED=true;'),
  'viewer เปิดใช้งานแล้วตามคำสั่งผู้ใช้ 2026-09-15',
)
/* สวิตช์ปิดยังต้องทำงานได้เหมือนเดิม — โค้ดเส้นทาง "ยังไม่เปิด" ห้ามหายไปจากฟอร์ม
   ไม่งั้นวันที่ต้องปิดกลับจะไม่มีอะไรให้ปิด (D-X17 ห้ามปุ่มตาย) */
assert(
  widget.onCreated.includes("if(!RIS_VIEWER_ENABLED){s.notifyPending('ดูภาพ · RIS ยังไม่เปิดลิงก์');return;}"),
  'เส้นทางตอนปิดสวิตช์ยังอยู่ครบ',
)

/* ── popup ผลอ่าน: ประวัติการแก้ (เพิ่ม 2026-09-15) ────────────────────────
   ของเดิมที่ต้องไม่หาย: dialog ยังเปิดที่ฉบับล่าสุด · ยังมีบล็อกผลก้อนเดียว
   · ข้อความ "ยังไม่มีผลอ่าน" ยังอยู่ · ช่อง PDF ผลอ่านยังไม่มีเหมือนเดิม */
assert(widget.content.includes('@click="toggleReportHistory"'), 'มีปุ่มประวัติการแก้')
assert(widget.content.includes('ประวัติการแก้ {{ report.versions.length }} ฉบับ'))
assert(widget.content.includes('v-if="report.versions.length > 1"'), 'ฉบับเดียวไม่ต้องมีปุ่ม')
assert(widget.content.includes('@click="selectReportVersion(vi)"'), 'กดที่ฉบับในไทม์ไลน์เพื่อสลับ')
assert(widget.content.includes('@click="goLatestReportVersion"'), 'มีทางกลับไปฉบับล่าสุด')
assert(
  widget.content.includes('ซึ่งถูกแทนที่แล้ว — ไม่ใช่ผลที่ใช้อ้างอิง'),
  'ดูฉบับเก่าต้องมีแถบเตือน ไม่ให้เผลออ่านผลที่ถูกแทนแล้ว',
)
assert(widget.content.includes('class="xr-rev-ln"'), 'เนื้อผลเรนเดอร์ทีละบรรทัดเพื่อไฮไลต์ความต่าง')
assert(widget.content.includes("'is-changed':ln.changed && report.diff"), 'ปิดไฮไลต์แล้วต้องหายจริง')
assert(widget.content.includes('@change="setReportDiff"'))
assert(
  widget.content.includes('<p v-else class="xr-report-body">{{ report.data.result_text }}</p>'),
  'ไม่มี versions (Process เก่า) ต้องยังแสดงผลก้อนเดียวแบบเดิม',
)
assert(widget.content.includes('{{ report.data.pending_message }}'), 'ข้อความรอผลเดิมยังอยู่')
assert(
  widget.content.includes('class="xr-report-modality"') &&
    widget.content.includes(':title="report.data.modality_label"'),
  'ช่องเครื่องใน dialog เหลือตัวย่อ ชื่อเต็มอยู่ที่ tooltip (ผู้ใช้ขอ 2026-09-15)',
)
assert(widget.content.includes('{{ shownRadiologist() }}'), 'ท้าย dialog ตามฉบับที่กำลังดู')
assert(widget.content.includes('{{ shownReported() }}'))
/* เพิ่มตามคำสั่งผู้ใช้ 2026-10-15: ปุ่มดินสออยู่ใน header ของ popup ผลอ่านเดิม
   เท่านั้น ไม่เพิ่ม action ในแถวและไม่เปลี่ยน dialog/flow ส่วนอื่น */
assert(widget.content.includes('class="xr-report-dialog-title"'), 'หัว popup ผลอ่านใช้พื้นที่เดิม')
assert(widget.content.includes('class="xr-report-edit"'), 'มีปุ่มดินสอข้างหัวข้อผลอ่าน')
assert(widget.content.includes('@click="toggleManualReport"'), 'ดินสอสลับโหมดใน popup เดิม')
assert(widget.content.includes("report.editing?'โหมดกรอก Manual':'โหมดดูอย่างเดียว'"))
assert(widget.content.includes('@click="saveManualReport"'), 'มีปุ่มบันทึกเฉพาะในโหมด Manual')
assert(widget.content.includes('@click="cancelManualReport"'), 'ยกเลิกแล้วกลับโหมดดู')
assert(widget.content.includes("@update:model-value=\"value=>setManualReportField('result_text',value)\""))
assert(widget.onCreated.includes("action:'save_manual_report'"), 'ใช้ action เพิ่มใน Process เดิม')
assert(widget.onCreated.includes("action:'get_report'"), 'บันทึกแล้วอ่านกลับด้วย flow เดิม')
assert(css.includes('.xr-report-dialog-title{'), 'เพิ่ม CSS เฉพาะ header/result editor')
assert(css.includes('.xr-manual-report-form{'))
/* CSS ของ dialog ห้าม scope ใต้ .xray-cpoe — el-dialog ถูก teleport ออกไปนอก widget */
assert(css.includes('.xr-rev-split{'), 'สไตล์ประวัติถูกต่อท้ายไว้แล้ว')
assert(!css.includes('.xray-cpoe .xr-rev-'), 'ห้าม scope ใต้ .xray-cpoe ไม่งั้นไม่โดน dialog')

/* ── ผลอ่านถูกนับเสมอเมื่อมีผล (เปลี่ยนตามคำสั่งผู้ใช้ 2026-09-16) ────────────
   ของเดิม (2026-09-02) ตัดผลที่เก่ากว่า dispatched_at ทิ้ง — จำเป็นตอนที่ส่งตรวจซ้ำ
   ยังใช้เลข Accession เดิม · 2026-09-03 เปลี่ยนเป็นออกเลขใหม่ทุกรอบแล้ว กติกานี้
   จึงเหลือแต่ตัดผลจริงทิ้ง (พบว่ากินทุกใบที่มีผลในระบบ) ⇒ ถอนออก
   สิ่งที่กติกาเดิมปกป้อง (ผลรอบก่อนต้องไม่ปนรอบใหม่) ยังถูกคุมด้วยเลข Accession:
   ตรวจใหม่/ส่งตรวจซ้ำล้างเลขแล้วออกใหม่ ⇒ ผลเก่าผูกกับเลขเดิม ไม่ถูก join มา */
/* 🔴 เปลี่ยนตามคำสั่งผู้ใช้ 2026-09-16: **ตัดกติกาเทียบเวลาออกทั้งหมด**
   assertion เดิมสองข้อ (`result_stale_note` · `xr-stale-time`) ปกป้อง "ต้องอธิบายว่า
   ทำไมผลไม่ถูกนับ" ซึ่งเกิดจากกติกา 2026-09-02 ที่บังคับ resulted_at >= dispatched_at
   กติกานั้นถูกถอนแล้ว (รอบใหม่ = เลข Accession ใหม่เสมอตั้งแต่ 2026-09-03 ⇒ เทียบเวลา
   มีแต่ตัดผลจริงทิ้ง) ⇒ สภาพที่ข้อความนั้นอธิบายจะไม่มีวันเกิดอีก จึงเอาออกทั้งคู่
   สิ่งที่ยังต้องคุมแทนคือ **ผลต้องถูกนับเสมอเมื่อมีผล** — assert ไว้ด้านล่าง */
assert(!widget.content.includes('result_stale_note'), 'แถบเตือนผลเก่าถูกถอนออกแล้ว')
assert(!widget.content.includes('xr-stale-time'), 'ป้ายเวลาจางถูกถอนออกแล้ว')

/* ── popup กว้างขึ้นและ HN/Order No. ต้องไม่ถูกตัด (ผู้ใช้ขอ 2026-09-15) ──── */
assert(widget.content.includes('width="min(1060px,96vw)"'), 'popup ผลอ่านกว้างขึ้น')
assert(widget.content.includes('class="xr-mono xr-report-wrap"'), 'ช่อง HN/Order No. ตัดบรรทัดได้')
assert(css.includes('.xr-report-head strong.xr-report-wrap{white-space:normal'), 'และมีสไตล์รองรับ')
assert(
  css.includes('.xr-report-head strong{display:block;overflow:hidden;color:var(--el-text-color-primary,#303133);text-overflow:ellipsis;white-space:nowrap}'),
  'ช่องอื่นใน dialog ยัง nowrap เหมือนเดิม ไม่ได้ถูกรื้อ',
)

/* ── Dark mode ของป้ายสถานะ/ชิป (ผู้ใช้แจ้ง 2026-09-15) ───────────────────
   ทุกกฎต้องขึ้นต้นด้วย .dark เท่านั้น — โหมดสว่างห้ามขยับแม้แต่พิกเซลเดียว */
;[
  '.dark .xray-cpoe .xr-st-dispatched', '.dark .xray-cpoe .xr-st-complete',
  '.dark .xray-cpoe .xr-st-cancelled', '.dark .xray-cpoe .xr-ris-a',
  '.dark .xray-cpoe .xr-ris-c', '.dark .xr-report-pending', '.dark .xr-rev-alert',
].forEach(selector => assert(css.includes(selector), 'ต้องมี dark mode ให้ ' + selector))
/* ป้ายเดิมของโหมดสว่างยังอยู่ครบ ไม่ได้ถูกเขียนทับ */
assert(css.includes('.xray-cpoe .xr-st-complete{border-color:#b3e19d;background:#f0f9eb;color:#529b2e}'))
assert(css.includes('.xray-cpoe .xr-ris-a{background:#eef3fe;border:1px solid #bcd0f7;color:#3a67c4}'))

/* ── connector เดียวกับ LAB · ไม่มี raw fetch ───────────────────────────── */
assert(widget.onCreated.includes('api.runProcess(id,params||{}'))
assert(!widget.onCreated.includes('globalThis.fetch('))
assert(widget.onMounted.includes('s.loadOrders()'))
assert(
  widget.onCreated.includes("const WORKLIST_PROCESS_ID='6a957009422c1ca959829e45'"),
  'the Form must call the deployed xray-cpoe-worklist Process',
)

/* ── สืบค้นผล LAB จาก X-ray: read-only และครอบคลุมทุกห้อง ──────────────── */
/* 2026-10-05: LAB ต้นทางมีงานอื่นค้างอยู่หลายร้อยบรรทัด จึงห้ามบังคับ byte parity
   แล้วลากทุกการเปลี่ยนเข้าฟอร์ม X-ray เมื่อโจทย์อนุญาตให้แก้เฉพาะ Sensitive policy.
   สิ่งที่ assertion เดิมปกป้องยังอยู่ด้านล่าง: โครง lookup จริง, toolbar/search,
   result dialog, lifecycle, read-only guard และ Sensitive redaction contract. */
assert(labLookup.content.startsWith('<div class="lab-cpoe xray-lab-lookup">'))
assert(labLookup.content.includes('อ่านอย่างเดียว · ทุกห้องแลป'))
assert(labLookup.content.includes('โปรดระบุ HN / เลือกวันที่'))
assert(labLookup.content.includes("@click=\"setLookupMode('results')\""))
assert(labLookup.content.includes("@click=\"setLookupMode('orders')\""))
assert(labLookup.content.includes('@click="openOrderResults(order)"'))
assert(labLookup.content.includes('class="lab-result-dialog"'))
assert(labLookup.content.includes('resultGroupsForDisplay()'))
assert(labLookup.content.includes('class="lab-sensitive-result-locked"'))
assert(labLookup.content.includes('class="lab-sensitive-result-label">ปกปิดผล</strong>'))
assert(!labLookup.content.includes('requestSensitiveAccess'))
assert(!labLookup.content.includes('submitSensitiveAccess'))
assert(!labLookup.content.includes('sensitiveAuth'))
assert(!labLookup.content.includes('class="lab-view-tabs"'), 'the X-ray top tab already selects LAB lookup')
assert(!labLookup.content.includes('xll-'), 'the rejected custom X-ray LAB lookup UI must be gone')
assert(labLookup.onCreated.includes("const PROCESS_ID='6a9434c3422c1ca959829d5e'"))
assert(labLookup.onCreated.includes("s.viewMode='lookup'"))
assert(labLookup.onCreated.includes("const xrayLabReadActions=['','list','get_manual_result']"))
assert(labLookup.onCreated.includes("id!==PROCESS_ID||!xrayLabReadActions.includes(action)"))
assert(labLookup.onCreated.includes("action:'get_manual_result'"))
assert(labLookup.onCreated.includes("const sensitiveLocked=d.sensitive_locked===true;"))
assert(labLookup.onCreated.includes("const key=!sensitiveLocked&&panelGroupingAllowed&&parentCode?'panel:'"))
assert(!labLookup.onCreated.includes('requestSensitiveAccess'))
assert(!labLookup.onCreated.includes('submitSensitiveAccess'))
assert(!labLookup.onCreated.includes("action:'authorize_sensitive_result'"))
assert(!labLookup.onCreated.includes('sensitive_grant_token'))
assert(!labLookup.onCreated.includes('sensitiveGrants'))
assert(!labLookup.onCreated.includes('globalThis.fetch('), 'LAB lookup uses only the Process connector')
assert(labLookup.onMounted.includes("params.action==='get_manual_result'&&s.viewMode==='lookup'"))
assert(labLookup.onMounted.includes('s.refreshWorklist()'), 'the current LAB clone loads rows and counts together')
assert(labLookup.onCreated.includes('s.refreshWorklist=()=>'))
assert(labLookup.onMounted.includes('s.__unitWatch=setInterval(()=>s.handleUnitChange(),1000)'))
assert(css.includes('.lab-sensitive-result-label{'), 'the locked Sensitive row keeps the LAB redaction badge')
assert(!css.includes('.lab-sensitive-auth'), 'the retired doctor re-auth dialog CSS must not remain')
assert(!css.includes('.xll-'), 'the generated Form must not carry the rejected custom X-ray LAB stylesheet')

/* ── behaviour ──────────────────────────────────────────────────────────── */
const TEST_PROCESS_ID = '6a957009422c1ca959829e45'
const bootable = widget.onCreated

const order = (id, modality, status, extra) => Object.assign({
  order_id: id,
  can_action: true,
  order_number: '2026083101' + id.slice(-1),
  requested_at: '2026-08-31T08:1' + id.slice(-1) + ':00+07:00',
  priority: '1',
  patient: { hn: 'HN-00' + id.slice(-1), prename: 'นาย', first_name: 'ทดสอบ', last_name: 'ระบบ', age: '40y', gender_text: 'ชาย' },
  visit: { visit_id: 'VISIT-' + id, vn: 'VN-' + id, clinic: 'OPD' },
  finance: {
    total_amount: 100,
    paid_amount: 100,
    coverage: [{ inscl_item_main: { value: 'UCS', label: 'UCS หลักประกันสุขภาพ' }, inscl_item_sub: null }],
  },
  requester: { visit_doctor: 'ศิรชัย ปิยะชน (doctor@example.com)' },
  emr_context: { visit_id: 'VISIT-' + id, vn: 'VN-' + id, diagnosis: 'Pneumonia, community acquired, right lower lobe' },
  items: [{
    item_id: 'ITEM-' + id,
    item_code: 'XR-' + modality,
    item_name: 'Chest PA ' + modality,
    modality: { code: modality, label: modality + '-เครื่องเต็มชื่อยาว' },
    accession_no: status === 'sent' ? '' : '20260831' + modality + '001',
    current_status: status,
    dispatched_at: status === 'sent' ? '' : '2026-08-31T09:00:00+07:00',
    dispatched_by: status === 'sent' ? '' : { first_name: 'เจ้าหน้าที่', last_name: 'รังสี' },
    resulted_at: status === 'resulted' ? '2026-08-31T10:30:00+07:00' : '',
    cancel_reason: status === 'cancelled' ? 'แพทย์ยกเลิกคำสั่ง' : '',
    cancelled_by: status === 'cancelled' ? { first_name: 'หมอ', last_name: 'ก' } : '',
  }],
}, extra || {})

const ALL = [
  order('ORD-1', 'CR', 'sent'),
  order('ORD-2', 'CT', 'accepted'),
  order('ORD-3', 'CT', 'resulted'),
  order('ORD-4', 'CR', 'cancelled'),
]
const BUCKET = { sent: 'waiting', accepted: 'pending', resulted: 'complete', cancelled: 'cancelled' }

const calls = []
let withModalityMaster = false
let withSplitCounts = true
let unmappedCount = 0
let serverMessage = ''
/* Process ที่ deploy แล้ว — ผู้ใช้แจ้ง 2026-09-01 */
const DISPATCH_PROCESS_ID = '6a967029422c1ca959829edc'
let dispatchReply = {
  success: true,
  accession_no: 'SM20260901CT001',
  transport: { status: 'ok', ack: 'AA', error: '' },
  message: 'ส่งเข้าเครื่องแล้ว',
}
let cancelReply = { success: true, data: {}, message: 'ยกเลิก Order แล้ว' }
let financeReply = { success: true, data: { can_cancel: true, finance_status: 'not_billed', finance_message: 'ยังไม่มีรายการการเงิน', receipt_numbers: [] } }
let retestReply = null
let openVisitReply = { success: true, data: { hn: '6900040', visit: null } }
const memberRows = [
  {
    _id: '111111111111111111111111', xrstatx: 1,
    prename: { value: 'PN1', label: 'นาง' }, first_name: 'สุกัญญา', last_name: 'ประจะเน',
    position: { value: 'RADIOGRAPHER_PRO', label: 'นักรังสีการแพทย์ชำนาญการ' },
  },
  {
    _id: '222222222222222222222222', xrstatx: 1,
    prename: { value: 'PN2', label: 'พญ.' }, first_name: 'กนกพร ', last_name: 'ชุติวงศ์ธนะพัฒน์',
    position: { value: 'RADIOLOGIST_PRO', label: 'นายแพทย์ชำนาญการ' },
    professional_code: 'RAD-MANUAL',
  },
  {
    _id: '333333333333333333333333', xrstatx: 1,
    prename: { value: 'PN3', label: 'นาย' }, first_name: 'ไม่ใช้', last_name: 'งานอื่น',
    position: { value: 'OTHER', label: 'อื่น ๆ' },
  },
]
const runProcess = (id, params, ok) => {
  calls.push({ id, params })
  if (id === DISPATCH_PROCESS_ID) {
    ok({ data: dispatchReply })
    return
  }
  /* ยกเลิกทั้งใบใช้ Process worklist ตัวเดิม ไม่มี Process ID ใหม่ (ทรงเดียวกับ LAB) */
  if (params.action === 'cancel_order') {
    ok({ data: cancelReply })
    return
  }
  if (params.action === 'check_cancel_finance') {
    ok({ data: financeReply })
    return
  }
  if (params.action === 'get_reason_options') {
    const options = [
      { value: 'PATIENT_ABSENT', label: 'ผู้ป่วยไม่มาตามนัด' },
      { value: 'PHYSICIAN_CANCELLED', label: 'แพทย์ยกเลิกคำสั่ง' },
      { value: 'WRONG_PATIENT', label: 'สั่งผิดคน' },
      { value: 'OTHER', label: 'อื่น ๆ' },
    ]
    ok({ data: { success: true, data: { options, reason_type: params.reason_type } } })
    return
  }
  if (params.action === 'retest_items') {
    ok({ data: retestReply || { success: true, data: {
      reopened_item_count: params.item_ids.length, item_ids: params.item_ids,
    } } })
    return
  }
  if (params.action === 'set_staff') {
    ok({ data: { success: true, data: { item_id: params.item_id } } })
    return
  }
  if (params.action === 'save_manual_report') {
    ok({ data: { success: true, data: { item_id: params.item_id, source: 'manual' }, message: 'บันทึกผล Manual เรียบร้อยแล้ว' } })
    return
  }
  if (params.action === 'resolve_open_visit') {
    ok({ data: openVisitReply })
    return
  }
  if (params.action === 'get_report') {
    /* ทรงที่ API คืนจริงหลังผูกกับ zdata_xray_result (D-X6 · 2026-09-02):
       ข้อความก้อนเดียว + รหัสรังสีแพทย์ + จำนวนฉบับ */
    ok({ data: { success: true, data: {
      result_text: 'Normal chest radiograph. No focal consolidation.',
      result_versions: 2,
      radiologist_uid: 'RAD-007',
      severity_uid: 'N',
      reported_at: '2026-08-31T10:30:00+07:00',
      /* เพิ่ม 2026-09-15: ประวัติทุกฉบับที่ get_report คืนมา (ใหม่→เก่า)
         ฟิลด์ด้านบนยังเป็นฉบับล่าสุดเหมือนเดิม — assertion เดิมจึงไม่ขยับ */
      versions: [
        {
          no: 2, latest: true,
          result_text: 'Normal chest radiograph. No focal consolidation.',
          reported_at: '2026-08-31T10:30:00+07:00',
          radiologist_uid: 'RAD-007', severity_uid: 'N', result_status: 'C',
          received_at: '2026-08-31T10:30:08+07:00', message_control_id: 'MSG-2',
        },
        {
          no: 1, latest: false,
          result_text: 'Normal chest radiograph. Pending review.',
          reported_at: '2026-08-31T09:00:00+07:00',
          radiologist_uid: '', severity_uid: '', result_status: 'P',
          received_at: '2026-08-31T09:00:05+07:00', message_control_id: 'MSG-1',
        },
      ],
      versions_capped: false,
    } } })
    return
  }
  let rows = ALL.slice()
  /* API รับได้ทั้ง array และ CSV — mock ต้องรองรับเหมือนของจริง */
  if (params.modality && params.modality.length) {
    const picked = Array.isArray(params.modality) ? params.modality : String(params.modality).split(',')
    rows = rows.filter(o => o.items.some(i => picked.indexOf(i.modality.code) >= 0))
  }
  const countRows = rows.slice()
  /* statuses ว่าง = ให้ server ใช้ vocabulary เต็ม (เหมือน API จริง) */
  if (params.statuses.length) rows = rows.filter(o => params.statuses.indexOf(o.items[0].current_status) >= 0)
  const payload = {
    orders: rows.slice(0, params.limit),
    total: rows.length,
    page: params.page,
    limit: params.limit,
    date_scope: params.date_from
      ? { from: params.date_from, to: params.date_to, defaulted: false, include_backlog: false, axis: 'status_time' }
      : { from: '2026-08-31', to: '2026-08-31', defaulted: true, include_backlog: true, axis: 'status_time' },
  }
  if (withSplitCounts) {
    payload.counts = {
      all: countRows.length,
      waiting: countRows.filter(o => BUCKET[o.items[0].current_status] === 'waiting').length,
      pending: countRows.filter(o => BUCKET[o.items[0].current_status] === 'pending').length,
      complete: countRows.filter(o => BUCKET[o.items[0].current_status] === 'complete').length,
      cancelled: countRows.filter(o => BUCKET[o.items[0].current_status] === 'cancelled').length,
    }
  }
  if (withModalityMaster) payload.modalities = [{ code: 'CR', label: 'CR', count: 2 }, { code: 'CT', label: 'CT', count: 2 }]
  if (unmappedCount) payload.modality_unmapped = unmappedCount
  ok({ data: { success: true, data: payload, message: serverMessage } })
}

const opened = []
const notes = []
const printJobs = []
let printAgentStub = null
let closedPopups = 0
const field = {
  vueState: {},
  globalUserState: {
    user: { unit: { code: '10' } }, runProcess,
    crudGetAll: (request, ok) => ok({ data: memberRows }),
  },
  /* getFieldRef เพิ่ม 2026-09-11 เพื่อทดสอบปุ่ม "พิมพ์ HN" — printAgent() หา widget
     ชื่อ 'local_agent' ผ่านทางนี้ · ตั้ง printAgentStub=null = จำลองว่ายังไม่ได้ต่อ agent */
  getFormRef: () => ({
    /* จำลองหน้า X-ray ที่ถูกเปิดมาจาก Order เดิม: ปุ่มสร้างรายการใหม่ต้องไม่พา
       order_id นี้เข้า CPOE แต่บริบทอื่นของฟอร์มแม่ยังต้องเดินทางต่อเหมือนเดิม */
    formParams: { xsitex: 'SITE-1', order_id: 'STALE-ORDER-ID' },
    openForm: (...args) => opened.push(args),
    subFormClose: () => { closedPopups += 1 },
    getFieldRef: name => (name === 'local_agent' && printAgentStub
      ? { getFieldEditor: () => printAgentStub }
      : null),
  }),
  notify: message => notes.push(message),
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

;(async () => {
  /* LAB lookup เปิดว่างและอ่านข้าม section ผ่าน LAB Process เดิมเท่านั้น */
  const LAB_PROCESS_ID = '6a9434c3422c1ca959829d5e'
  const labRows = [{
    row_key: 'LAB-ORDER|HM', order_id: 'LAB-ORDER', order_number: 'ON-LAB-1',
    requested_at: '2026-09-24T09:00:00+07:00', section_code: 'HM',
    patient: { hn: '6900049', prename: 'ด.ช.', first_name: 'ทดสอบ', last_name: 'แลป', gender_text: 'ชาย', age: '7y' },
    items: [{
      item_id: 'aaaaaaaaaaaaaaaaaaaaaaaa', item_code: 'HM1', item_name: 'CBC',
      current_status: 'completed', work_status: 'completed', lab_no: 'HM2609240001',
      section: { code: 'HM', name: 'โลหิตวิทยา' }, specimen: { display: 'EDTA blood' },
      latest_result_at: '2026-09-24T10:00:00+07:00',
    }, {
      item_id: 'bbbbbbbbbbbbbbbbbbbbbbbb', item_code: 'HM2', item_name: 'ESR',
      current_status: 'resulted', work_status: 'resulted', lab_no: 'HM2609240001',
      section: { code: 'HM', name: 'โลหิตวิทยา' }, specimen: { display: 'EDTA blood' },
      latest_result_at: '2026-09-24T10:05:00+07:00',
    }],
  }]
  const sensitiveReportId = 'dddddddddddddddddddddddd'
  const sensitiveItemId = 'cccccccccccccccccccccccc'
  const sensitiveOrder = {
    row_key: 'LAB-SENSITIVE|IM', order_id: 'LAB-SENSITIVE', order_number: 'ON-LAB-SENSITIVE',
    requested_at: '2026-09-24T11:00:00+07:00', section_code: 'IM',
    patient: { hn: '6900049', prename: 'ด.ช.', first_name: 'ทดสอบ', last_name: 'สิทธิ์', gender_text: 'ชาย', age: '7y' },
    items: [{
      item_id: sensitiveItemId, item_code: 'I0058', item_name: 'Sensitive test',
      current_status: 'completed', work_status: 'completed', lab_no: 'IM2609240001',
      section: { code: 'IM', name: 'ภูมิคุ้มกันวิทยา' }, specimen: { display: 'Serum' },
      latest_result_at: '2026-09-24T11:30:00+07:00',
    }],
  }
  const labCalls = []
  const labNotes = []
  const labRunProcess = (id, params, ok) => {
    labCalls.push({ id, params })
    if (params.action === 'get_manual_result') {
      if (params.item_id === sensitiveItemId) {
        ok({ data: { success: true, data: {
          order_id: sensitiveOrder.order_id, patient_hn: '6900049', lab_no: 'IM2609240001', section_code: 'IM',
          test_code: 'I0058', test_name: 'Sensitive test', result_report_id: sensitiveReportId,
          result_report_ids: [sensitiveReportId], sensitive_locked: true, reauth_required: true,
          visibility: { state: 'reauth_required', sensitive: true, source: 'item_master' },
          results: [], result_attachments: [],
        }, message: 'ผล Sensitive ถูกปกปิดตามนโยบาย LAB Worklist' } })
        return
      }
      const isEsr = params.item_id === 'bbbbbbbbbbbbbbbbbbbbbbbb'
      ok({ data: { success: true, data: {
        patient_hn: '6900049', lab_no: 'HM2609240001', section_code: 'HM',
        test_code: isEsr ? 'HM2' : 'HM1', test_name: isEsr ? 'ESR' : 'CBC',
        results: [{ result_item_id: isEsr ? 'RESULT-2' : 'RESULT-1', test_code: isEsr ? 'ESR' : 'WBC', test_name: isEsr ? 'ESR' : 'WBC', result_value: isEsr ? '12' : '7.0', unit: isEsr ? 'mm/hr' : '10^3/uL', reference_range: isEsr ? '0-15' : '4.0-10.0', interpretation: 'N', reported_at: '2026-09-24T10:00:00+07:00' }],
      }, message: 'อ่านผลตรวจแล้ว' } })
      return
    }
    ok({ data: { success: true, data: {
      orders: labRows, total: params.lookup_mode === 'results' ? 1 : 2,
      page: params.page, limit: params.limit,
    } } })
  }
  const labField = {
    vueState: {},
    globalUserState: { user: { unit: { code: 'M0900' } }, runProcess: labRunProcess },
    getFormRef: () => ({}),
    notify: message => labNotes.push(message),
  }
  new Function(labLookup.onCreated).call(labField)
  const ls = labField.vueState
  new Function(labLookup.onMounted).call(labField)
  assert.strictEqual(ls.viewMode, 'lookup', 'the X-ray tab is locked to the real LAB lookup view')
  assert.strictEqual(ls.lookupSearched, false, 'LAB lookup opens blank')
  assert.deepStrictEqual(ls.orders, [])
  assert.strictEqual(labCalls.length, 0, 'LAB lookup does not query before the user supplies a scope')

  ls.applyFilters()
  assert.strictEqual(labCalls.length, 0, 'a blank search must never become an all-patient query')
  assert.strictEqual(ls.lookupSearched, false)

  ls.setSearch('6900049')
  ls.applyFilters()
  await flush()
  assert.strictEqual(labCalls.length, 3, 'one HN search loads rows and both mode counts')
  labCalls.forEach(call => assert.strictEqual(call.id, LAB_PROCESS_ID))
  labCalls.forEach(call => assert.strictEqual(call.params.cross_section, true, 'every LAB read spans enabled sections'))
  const hnList = labCalls.find(call => !call.params.action && call.params.limit === 30)
  assert.strictEqual(hnList.params.lookup_mode, 'results')
  assert.strictEqual(hnList.params.hn, '6900049')
  assert.strictEqual(hnList.params.all_dates, true, 'exact HN without dates searches all dates')
  assert(!('date_from' in hnList.params))
  assert.strictEqual(hnList.params.organization_code, 'M0900')
  assert.strictEqual(ls.orders.length, 1)
  assert.strictEqual(ls.isExpanded(labRows[0]), false, 'ผลค้นหาต้องเริ่มแบบพับที่ระดับ Order')
  ls.toggleOrder(labRows[0])
  assert.strictEqual(ls.isExpanded(labRows[0]), true, 'ผู้ใช้ยังกางดูรายละเอียด Item ได้เหมือน LAB')
  ls.toggleOrder(labRows[0])
  assert.deepStrictEqual(new Set(labCalls.map(call => call.params.lookup_mode)), new Set(['results', 'orders']))

  const beforeOrders = labCalls.length
  ls.setLookupMode('orders')
  await flush()
  assert.strictEqual(labCalls.length, beforeOrders + 1)
  assert.strictEqual(labCalls[labCalls.length - 1].params.lookup_mode, 'orders')
  assert.strictEqual(labCalls[labCalls.length - 1].params.cross_section, true)

  ls.setSearch('')
  ls.setDates(['2026-09-01', '2026-09-24'])
  ls.applyFilters()
  await flush()
  const dateList = labCalls.filter(call => !call.params.action && call.params.limit === 30).pop()
  assert.strictEqual(dateList.params.date_from, '2026-09-01')
  assert.strictEqual(dateList.params.date_to, '2026-09-24')
  assert(!('all_dates' in dateList.params), 'date-range lookup must not silently widen to all dates')
  assert(!('hn' in dateList.params))

  const beforeOrderResult = labCalls.length
  await ls.openOrderResults(labRows[0])
  const resultCalls = labCalls.slice(beforeOrderResult)
  assert.strictEqual(resultCalls.length, 2, 'เปิดผลระดับ Order ต้องอ่านผลของทุก Item ในใบเดียวกัน')
  resultCalls.forEach(resultCall => {
    assert.strictEqual(resultCall.id, LAB_PROCESS_ID)
    assert.strictEqual(resultCall.params.action, 'get_manual_result')
    assert.strictEqual(resultCall.params.organization_code, 'M0900')
    assert.strictEqual(resultCall.params.cross_section, true)
    assert.strictEqual(resultCall.params.lookup_mode, 'results')
  })
  assert.deepStrictEqual(resultCalls.map(call => call.params.item_id).sort(), [
    'aaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbb',
  ])
  assert.strictEqual(ls.manual.loading, false)
  assert.strictEqual(ls.manual.order, labRows[0])
  assert.strictEqual(ls.manual.groups.length, 2)
  assert.deepStrictEqual(ls.manual.groups.map(group => group.results[0].result_value), ['7.0', '12'])
  assert(
    labCalls.every(call => !call.params.action || call.params.action === 'get_manual_result'),
    'X-ray LAB lookup must never invoke a LAB write action',
  )
  const beforeBlockedWrite = labCalls.length
  await assert.rejects(
    () => ls.processCall(LAB_PROCESS_ID, { action: 'save_manual_result', item_id: 'aaaaaaaaaaaaaaaaaaaaaaaa' }),
    /อ่านอย่างเดียว/,
  )
  assert.strictEqual(labCalls.length, beforeBlockedWrite, 'blocked writes must never reach the connector')

  /* 2026-10-05: สิทธิ์ดูผลต้องเหมือน LAB ปัจจุบัน — Worklist/Lookup ไม่มี re-auth,
     ไม่ส่ง credential/grant และค่าที่ server ปกปิดต้องคง fail-closed พร้อม PDF redacted. */
  const beforeSensitive = labCalls.length
  await ls.openOrderResults(sensitiveOrder)
  const lockedCall = labCalls.slice(beforeSensitive).find(call => call.params.action === 'get_manual_result')
  assert(lockedCall, 'Sensitive result must be loaded through the LAB Process')
  assert.strictEqual(lockedCall.params.cross_section, true)
  assert.strictEqual(lockedCall.params.lookup_mode, 'results')
  assert.strictEqual(lockedCall.params.sensitive_grant_token, undefined)
  assert.strictEqual(ls.manual.groups.length, 1)
  assert.strictEqual(ls.manual.groups[0].sensitive_locked, true)
  assert.deepStrictEqual(ls.manual.groups[0].results, [], 'locked X-ray lookup must never receive a clinical value')
  assert.deepStrictEqual(ls.manual.groups[0].attachments, [], 'locked X-ray lookup must never receive an attachment')
  assert.deepStrictEqual(ls.labResultPdfParams(), { xparentx: sensitiveReportId }, 'redacted PDF must never receive a grant')
  assert.strictEqual(typeof ls.requestSensitiveAccess, 'undefined')
  assert.strictEqual(typeof ls.submitSensitiveAccess, 'undefined')
  const beforeBlockedAuth = labCalls.length
  await assert.rejects(
    () => ls.processCall(LAB_PROCESS_ID, {
      action: 'authorize_sensitive_result',
      item_id: sensitiveItemId,
      username: 'doctor.one',
      password: 'must-not-leave-the-form',
    }),
    /อ่านอย่างเดียว/,
  )
  assert.strictEqual(labCalls.length, beforeBlockedAuth, 'retired Sensitive auth must never reach the connector')

  ls.setViewMode('today')
  assert.strictEqual(ls.viewMode, 'lookup', 'hidden LAB modes cannot be activated from the X-ray lookup')
  assert(labNotes.some(message => message.includes('อ่านอย่างเดียว')))
  new Function(labLookup.onUnmount).call(labField)

  new Function(bootable).call(field)
  const s = field.vueState

  /* ทุก key ที่เทมเพลตอ้างต้องมีค่าตั้งแต่ onCreated */
  ;['rows', 'counts', 'modalities', 'modalityReady', 'modalityPlaceholder', 'modalityAria', 'modalityNote', 'summary', 'configWarning']
    .forEach(key => assert(key in s.view, 'view.' + key + ' must exist before mount'))
  assert.strictEqual(s.report.visible, false)
  assert.deepStrictEqual(s.modality, [], 'nothing picked means no modality filter')
  assert.deepStrictEqual(s.orderRequestReportList, [{ reportId: '6a97f826422c1ca95982a048', label: 'ใบสั่ง', type: 'pdf' }])
  assert.deepStrictEqual(s.hnOrderReportList, [{ reportId: '6a9a355c422c1ca95982a1a2', label: 'HN', type: 'pdf' }])
  assert.deepStrictEqual(s.hnStickerReportList, [{ reportId: '6a980831422c1ca95982a054', label: 'สติ๊กเกอร์ HN', type: 'pdf' }])
  /* 2026-10-15: รูปแบบอายุของ X-ray ต้องตรงกับ LAB โดยเปลี่ยนเฉพาะ display text */
  assert.strictEqual(s.orderAgeText({ patient: { age: '25' } }), '25 ปี  เดือน  วัน')
  assert.strictEqual(s.orderAgeText({ patient: { age: '3y 2m 1d' } }), '3 ปี 2 เดือน 1 วัน')
  assert.strictEqual(s.orderAgeText({ patient: { age: { year: 4, month: 5, day: 6 } } }), '4 ปี 5 เดือน 6 วัน')
  assert.strictEqual(s.buildRow(order('ORD-AGE', 'CR', 'sent', { patient: { age: '25' } })).age, '25 ปี  เดือน  วัน')
  assert.strictEqual(s.buildRow(order('ORD-IPD', 'CR', 'sent', { visit: { an: 'AN69001234' } })).an, 'AN69001234')
  assert.strictEqual(s.buildRow(order('ORD-OPD', 'CR', 'sent')).an, '', 'OPD keeps the existing row without an AN badge')
  const noteRow = s.buildRow(order('ORD-NOTE', 'CR', 'sent', { order_comment: 'งดน้ำงดอาหาร 6 ชั่วโมงก่อนตรวจ' }))
  assert.strictEqual(noteRow.order_note_has, true)
  assert.strictEqual(noteRow.order_note_short, 'หมายเหตุ: งดน้ำงดอาหาร 6 ชั่วโมงก่อนตรวจ')
  assert.strictEqual(noteRow.order_note_full, 'งดน้ำงดอาหาร 6 ชั่วโมงก่อนตรวจ')
  assert.deepStrictEqual(noteRow.test_list, ['Chest PA CR'], 'the summary tooltip shows names without internal CPOE codes')
  const noNoteRow = s.buildRow(order('ORD-NO-NOTE', 'CR', 'sent'))
  assert.strictEqual(noNoteRow.order_note_has, false)
  assert.strictEqual(noNoteRow.order_note_full, '')

  const rightCoverage = [{ inscl_item_main: { value: 'OFC', label: 'OFC สิทธิข้าราชการ' } }]
  const cashCoverage = [{ inscl_item_main: { value: 'CASH', label: 'CASH ชำระเงินเอง' } }]
  assert.strictEqual(s.coverageAbbrev({ finance: { coverage: rightCoverage } }), 'OFC')
  assert.strictEqual(s.coverageAbbrev({ finance: { coverage: JSON.stringify(cashCoverage) } }), '')
  assert.strictEqual(s.coverageAbbrev({ finance: { coverage: [] } }), '')
  assert.strictEqual(s.showPaid({ finance: { coverage: rightCoverage, total_amount: 100, paid_amount: 100 } }), false)
  assert.strictEqual(s.showPaid({ finance: { coverage: cashCoverage, total_amount: 100, paid_amount: 100 } }), true)
  assert.strictEqual(s.showPaid({ finance: { coverage: [], total_amount: 100, paid_amount: 100 } }), true)
  assert.strictEqual(s.showPaid({ finance: { coverage: cashCoverage, total_amount: 100, paid_amount: 0 } }), false)
  /* เปลี่ยนจาก cash-only เป็น pattern เดียวกับ LAB ตามคำสั่งผู้ใช้ 2026-10-15:
     มีสิทธิ์ก็ยังแสดงสิทธิ์และต้องมีกล่องสถานะการเงินร่วมกัน แม้ยอดยังไม่มา */
  assert.strictEqual(s.showPaymentStatus({ finance: { coverage: cashCoverage, total_amount: 100, paid_amount: 100 } }), true)
  assert.strictEqual(s.showPaymentStatus({ finance: { coverage: cashCoverage, total_amount: 100, paid_amount: 0 } }), true)
  assert.strictEqual(s.showPaymentStatus({ finance: { coverage: [], total_amount: 100, paid_amount: 0 } }), true)
  assert.strictEqual(s.showPaymentStatus({ finance: { coverage: rightCoverage, total_amount: 100, paid_amount: 0 } }), true)
  assert.strictEqual(s.showPaymentStatus({ finance: { coverage: rightCoverage, total_amount: 0, paid_amount: 0 } }), true)
  assert.strictEqual(s.showPaymentStatus({ finance: { coverage: cashCoverage, total_amount: 0, paid_amount: 0 } }), false)
  assert.strictEqual(s.isFinancePassed({ items: [{ current_status: 'sent' }], finance: { total_amount: 100, paid_amount: 100 } }), false, 'sent stays blocked even if amount fields look paid')
  assert.strictEqual(s.isFinancePassed({ items: [{ current_status: 'ready' }], finance: { total_amount: 100, paid_amount: 0 } }), true, 'ready is the explicit Finance-passed state')
  assert.strictEqual(s.isFinancePassed({ items: [{ current_status: 'dispatched' }], finance: { total_amount: 100, paid_amount: 0 } }), true, 'post-dispatch rows must not turn the payment badge red again')
  assert.strictEqual(s.isFinancePassed({ items: [{ current_status: 'ready' }, { current_status: 'sent' }], finance: { total_amount: 100, paid_amount: 100 } }), false, 'every active Item must pass Finance')
  assert.strictEqual(s.isFinancePassed({ items: [{ current_status: 'cancelled' }], finance: { total_amount: 100, paid_amount: 0 } }), false, 'cancelled items are not Finance-passed evidence')
  assert.strictEqual(s.isFinancePassed({ items: [{ current_status: 'cancelled' }], finance: { total_amount: 100, paid_amount: 100 } }), false, 'cancelling must not flip the Finance badge to paid')
  assert.strictEqual(s.isFinancePassed({ items: [{ current_status: 'rejected' }], finance: { total_amount: 100, paid_amount: 100 } }), false, 'rejecting must not flip the Finance badge to paid')

  const reportRow = s.buildRow(order('ORD-PDF', 'CR', 'sent'))
  assert.strictEqual(s.orderReportReady(reportRow), true)
  const reportParams = s.orderReportParams(reportRow)
  assert.strictEqual(reportParams.order_id, 'ORD-PDF')
  assert.strictEqual(reportParams.visit_id, 'VISIT-ORD-PDF')
  assert(reportParams.printed_by)
  assert(reportParams.printed_at)
  assert.strictEqual(s.orderReportReady({ id: 'ORD-MISSING-VISIT', emr: {} }), false)
  assert.strictEqual(s.hnOrderReportReady(reportRow), true)
  assert.deepStrictEqual(s.hnOrderReportParams(reportRow), { hn: reportRow.hn })
  /* ปุ่มผูกกับ HN แล้ว ⇒ Order ที่ไม่มี Visit ID แต่มี HN ยังพิมพ์ป้ายได้
     ส่วนแถวที่ไม่มี HN ต้อง disabled เหมือนเดิม */
  assert.strictEqual(s.hnOrderReportReady({ id: 'ORD-NO-VISIT', hn: '6900001', emr: {} }), true)
  assert.strictEqual(s.hnOrderReportReady({ id: 'ORD-MISSING-HN', emr: { visit_id: 'V1' } }), false)

  /* request contract */
  assert.strictEqual(s.view.configWarning, '', 'a wired Process ID leaves no warning banner')

  const p = s.params(s.statusMap.all, 30, 1)
  assert.strictEqual(p.action, 'list')
  assert.strictEqual(p.organization_code, '10')
  assert.strictEqual(p.limit, 30)
  assert(!('modality' in p), 'no modality key while Select all')

  calls.length = 0
  s.loadOrders()
  await flush()

  /* optimize 2026-10-18: Process ปัจจุบันคืน rows + split counts ในก้อนเดียว
     จึงต้องยิงเพียงครั้งเดียว แต่ยังมี fallback เดิมสำหรับ Process รุ่นเก่า */
  assert.strictEqual(calls.length, 1, 'current Process loads rows and all status counts in one request')
  assert.strictEqual(calls[0].id, TEST_PROCESS_ID, 'every call goes to the deployed Process ID')
  assert.strictEqual(s.view.rows.length, 4, 'Select all shows every order')
  assert.strictEqual(s.view.counts.all, 4)
  assert.strictEqual(s.view.counts.waiting, 1)
  assert.strictEqual(s.view.counts.pending, 1)
  assert.strictEqual(s.view.counts.complete, 1)
  assert.strictEqual(s.view.counts.cancelled, 1)

  withSplitCounts = false
  calls.length = 0
  s.loadOrders()
  await flush()
  assert.strictEqual(calls.length, 6, 'legacy Process falls back to one row request plus five status counts')
  assert.strictEqual(calls.filter(call => call.params.limit === 1).length, 5)
  assert.deepStrictEqual(s.view.counts, { all: 4, waiting: 1, pending: 1, complete: 1, cancelled: 1 })
  withSplitCounts = true

  /* API ตอบ success:true พร้อมเหตุผลได้ — ต้องเอาขึ้นจอ ไม่ใช่ปล่อยให้เห็นแค่ 'ไม่พบรายการ' */
  serverMessage = 'ยังไม่ได้กำหนดหน่วยงานรังสีใน Process — Organization ปัจจุบันคือ "M1001"'
  unmappedCount = 3
  s.setSearch('ไม่มีใครชื่อนี้')
  s.loadOrders()
  await flush()
  assert.strictEqual(s.view.rows.length, 0)
  assert.strictEqual(s.view.serverNote, serverMessage, 'an empty list must explain itself')
  assert(s.view.dataNote.includes('3 รายการที่ยังไม่มีเครื่องผูกไว้'))
  serverMessage = ''
  unmappedCount = 0
  s.setSearch('')
  s.loadOrders()
  await flush()
  assert.strictEqual(s.view.serverNote, '', 'a healthy list shows no notice')
  assert.strictEqual(s.view.dataNote, '')

  /* ช่วงวันที่จริงมาจาก API — ค่าเริ่มต้นเป็นวันนี้ ต้องบอกผู้ใช้ ไม่ปล่อยให้เดาจากช่องว่าง */
  /* ค่าเริ่มต้นแถมงานค้างข้ามวันมาด้วย ป้ายต้องบอกให้ตรง ไม่ใช่ "วันนี้" ลอย ๆ
     ไม่งั้นผู้ใช้เห็นใบเมื่อวานแล้วนึกว่าตัวกรองเพี้ยน (แก้ 2026-09-02) */
  assert.strictEqual(s.view.dateScopeText, 'วันนี้ + งานค้างทุกวัน (ค่าเริ่มต้น)')
  assert(s.view.summary.includes('ช่วงวันที่: วันนี้ + งานค้างทุกวัน (ค่าเริ่มต้น)'))

  /* organize: หนึ่งแถว = หนึ่งรายการตรวจ พร้อมสถานะ/เวลาสถานะที่คำนวณไว้แล้ว */
  const waiting = s.view.rows.find(r => r.id === 'ORD-1')
  assert.strictEqual(waiting.status_label, 'รอรับ')
  assert.strictEqual(waiting.status_class, 'xr-st-waiting')
  assert.strictEqual(waiting.status_time_label, 'เวลาสถานะ')
  assert.strictEqual(waiting.status_time_date, '')
  assert.strictEqual(waiting.can_dispatch, true)
  assert.strictEqual(waiting.items[0].finance_blocked, true)
  assert.strictEqual(waiting.dispatch_ready, false)
  assert.strictEqual(waiting.dispatch_disabled_reason, 'ยังไม่ผ่านการเงิน')
  assert.strictEqual(waiting.can_pdf, false)
  assert.strictEqual(waiting.has_result, false)
  /* เปลี่ยนตามคำสั่งผู้ใช้ 2026-09-03: ไม่มีข้อมูลให้เป็นค่าว่าง ไม่ใช้ขีดแทน */
  assert.strictEqual(waiting.items[0].accession_no, '', 'accession stays visually blank until dispatch')
  assert.deepStrictEqual(
    waiting.modalities,
    [{ code: 'CR', label: 'CR-เครื่องเต็มชื่อยาว' }],
    'the cell shows the code; the full name rides along for the hover',
  )
  assert.strictEqual(waiting.items[0].modality, 'CR', 'item cells show the code too')
  assert.strictEqual(waiting.items[0].modality_label, 'CR-เครื่องเต็มชื่อยาว')
  assert.strictEqual(waiting.doctor, 'ศิรชัย ปิยะชน', 'email must be stripped from the requester')
  assert(waiting.dx_short.startsWith('Diagnosis: '))
  assert.strictEqual(waiting.coverage, 'UCS', 'hospital coverage shows only its abbreviation')
  assert.strictEqual(waiting.paid, false, 'the legacy cash-only flag remains false for hospital coverage')
  /* เปลี่ยน assertion เดิม 2026-10-15 ตามคำสั่งผู้ใช้: สิทธิ์ยังแสดงเหมือนเดิม แต่ต้อง
     แสดงกล่องการเงินเพิ่มและใช้ status ready ชุดเดียวกับปุ่มส่งเข้าเครื่องตัดสินสี */
  assert.strictEqual(waiting.show_payment_status, true, 'non-cash rights still show the Finance badge')
  assert.strictEqual(waiting.finance_passed, false, 'sent shows the red unpaid Finance badge even when coverage exists')

  s.selected = { 'ITEM-ORD-READY': true }
  const financeReady = s.buildRow(order('ORD-READY', 'CR', 'ready', {
    items: [{ item_id: 'ITEM-ORD-READY', current_status: 'ready', item_name: 'Chest PA', item_code: 'XR-CHEST-PA', modality: { code: 'CR', label: 'CR' } }],
  }))
  assert.strictEqual(financeReady.status_label, 'รอรับ', 'ready remains visually in the waiting queue')
  assert.strictEqual(financeReady.items[0].finance_blocked, false)
  assert.strictEqual(financeReady.dispatch_ready, true, 'Finance-ready X-ray may be received')
  assert.strictEqual(financeReady.dispatch_disabled_reason, '')
  assert.strictEqual(financeReady.show_payment_status, true, 'coverage remains visible together with the Finance badge')
  assert.strictEqual(financeReady.finance_passed, true, 'ready drives the green cash-payment badge and dispatch gate')
  s.selected = {}

  const cashRow = s.buildRow(order('ORD-CASH', 'CR', 'sent', {
    finance: { total_amount: 100, paid_amount: 100, coverage: cashCoverage },
  }))
  assert.strictEqual(cashRow.coverage, '')
  assert.strictEqual(cashRow.paid, true, 'paid CASH orders keep the payment badge')
  assert.strictEqual(cashRow.show_payment_status, true)
  assert.strictEqual(cashRow.finance_passed, false, 'sent remains red/unpaid until Finance changes the Item to ready')

  const unpaidCashRow = s.buildRow(order('ORD-CASH-UNPAID', 'CR', 'sent', {
    finance: { total_amount: 100, paid_amount: 0, coverage: cashCoverage },
  }))
  assert.strictEqual(unpaidCashRow.show_payment_status, true)
  assert.strictEqual(unpaidCashRow.finance_passed, false)

  const dispatched = s.view.rows.find(r => r.id === 'ORD-2')
  assert.strictEqual(dispatched.status_label, 'รอผลตรวจ')
  assert.strictEqual(dispatched.status_time_label, 'เวลาส่งเครื่อง')
  assert(dispatched.status_time_date)
  assert.strictEqual(dispatched.items[0].accession_no, '20260831CT001')
  assert.strictEqual(dispatched.items[0].dispatched_by, 'เจ้าหน้าที่ รังสี')

  const done = s.view.rows.find(r => r.id === 'ORD-3')
  assert.strictEqual(done.status_label, 'ออกผลครบ')
  assert.strictEqual(done.status_time_label, 'เวลาออกผล')
  assert.strictEqual(done.can_pdf, true)
  assert.strictEqual(done.has_result, true)
  assert.strictEqual(done.result_items[0].done, true)
  /* ออกผลแล้วยัง "ส่งตรวจซ้ำ" ได้ด้วยเลขเดิม (ผู้ใช้ยืนยัน 2026-09-02) */
  assert.strictEqual(done.can_dispatch, true, 'a finished exam can be repeated')
  assert.strictEqual(done.items[0].can_resend, true)

  const cancelled = s.view.rows.find(r => r.id === 'ORD-4')
  assert.strictEqual(cancelled.status_label, 'ยกเลิก')
  assert.strictEqual(cancelled.cancelled, true)
  assert.strictEqual(cancelled.can_dispatch, false)
  assert.strictEqual(cancelled.items[0].reject_reason, 'แพทย์ยกเลิกคำสั่ง')
  assert.strictEqual(cancelled.items[0].rejected_by, 'หมอ ก')

  /* ── เช็คลิสต์สถานะระดับ order ───────────────────────────────────────────
     4 ช่องคงที่เสมอ เรียง รอรับ → รอผลตรวจ → ออกผลแล้ว → ยกเลิก/ปฏิเสธ
     ป้ายรวมเดิม (status_label/status_class) ยังอยู่ครบ — ย้ายไปเป็น title/aria เท่านั้น */
  const stepKeys = r => r.status_steps.map(x => x.key)
  const stepOn = r => r.status_steps.filter(x => x.active).map(x => x.key + ':' + x.count)

  assert.deepStrictEqual(stepKeys(waiting), ['waiting', 'dispatched', 'resulted', 'cancelled'])
  assert.strictEqual(waiting.status_steps.length, 4, 'ทุกแถวมี 4 ช่องเท่ากัน ดอตจึงเรียงตรงกัน')
  assert.deepStrictEqual(
    waiting.status_steps.map(x => x.dot_class),
    ['xr-dot-waiting', 'xr-dot-dispatched', 'xr-dot-resulted', 'xr-dot-cancelled'],
  )
  assert.deepStrictEqual(stepOn(waiting), ['waiting:1'])
  assert.strictEqual(waiting.status_steps[0].title, 'รอรับ · 1 รายการ')
  assert.strictEqual(waiting.status_steps[1].title, 'รอผลตรวจ · ไม่มีรายการ')
  assert.strictEqual(waiting.status_aria, 'รอรับ · รอรับ 1 รายการ')

  assert.deepStrictEqual(stepOn(dispatched), ['dispatched:1'])
  assert.deepStrictEqual(stepOn(done), ['resulted:1'])
  assert.deepStrictEqual(stepOn(cancelled), ['cancelled:1'])
  assert.strictEqual(cancelled.status_steps[3].label, 'ยกเลิก / ปฏิเสธ', 'ช่องสุดท้ายรวมการปฏิเสธด้วย')

  /* ใบเดียวมีหลายรายการคนละขั้นได้ — เช็คลิสต์ต้องบอกจำนวนของแต่ละขั้น ไม่ใช่ขั้นเดียวรวบ */
  const stepMix = s.buildRow({
    order_id: 'ORD-STEPS',
    items: [
      { item_id: 'S1', current_status: 'sent' },
      { item_id: 'S2', current_status: 'sent' },
      { item_id: 'S3', current_status: 'accepted' },
      { item_id: 'S4', current_status: 'resulted', result_text: 'normal chest',
        dispatched_at: '2026-08-31T09:00:00+07:00', resulted_at: '2026-08-31T10:00:00+07:00' },
      { item_id: 'S5', current_status: 'rejected' },
    ],
  })
  assert.deepStrictEqual(stepOn(stepMix), ['waiting:2', 'dispatched:1', 'resulted:1', 'cancelled:1'])
  assert.strictEqual(
    stepMix.status_aria,
    'รอผลตรวจ · รอรับ 2 รายการ · รอผลตรวจ 1 รายการ · ออกผลแล้ว 1 รายการ · ยกเลิก / ปฏิเสธ 1 รายการ',
  )

  /* ยกเลิกทั้งใบแล้ว item รายตัวอาจยังไม่ถูกอัปเดต — ห้ามโชว์ดอต "รอรับ" ค้าง */
  const cancelledHead = s.buildRow({
    order_id: 'ORD-CANCELLED-HEAD',
    cancelled: true,
    items: [{ item_id: 'C1', current_status: 'sent' }, { item_id: 'C2', current_status: 'sent' }],
  })
  assert.deepStrictEqual(stepOn(cancelledHead), ['cancelled:2'])

  /* ไม่มีรายการ = ทุกช่องว่าง (กติกา "ไม่มีค่าให้เว้นว่าง" ไม่ใช้ขีดแทน) */
  const noItems = s.buildRow({ order_id: 'ORD-NO-ITEM', items: [] })
  assert.deepStrictEqual(stepOn(noItems), [])
  assert.strictEqual(noItems.status_steps.length, 4)
  assert.strictEqual(noItems.status_aria, 'รอรับ')

  /* ── เช็คลิสต์เป็น "ความคืบหน้า" ไม่ใช่ภาพนิ่ง (ผู้ใช้แก้ 2026-09-03 รอบสอง) ──
     เดินไปถึงขั้นถัดไปแล้ว ขั้นก่อนหน้าต้องขึ้นเครื่องหมายถูก ไม่ใช่เว้นว่าง
     เหมือนไม่เคยเกิดขึ้น · ยกเลิกไม่ได้เดินต่อ จึงไม่ทำให้ขั้นก่อนหน้าเป็นผ่าน */
  const stepDone = r => r.status_steps.filter(x => x.done).map(x => x.key)

  assert.deepStrictEqual(stepDone(waiting), [], 'ยังค้างที่ขั้นแรก ยังไม่ผ่านอะไรเลย')
  assert.deepStrictEqual(stepDone(dispatched), ['waiting'], 'รอผลตรวจ ⇒ รอรับผ่านแล้ว')
  assert.strictEqual(dispatched.status_steps[0].active, false, 'ผ่านแล้วไม่ใช่ค้างอยู่')
  assert.strictEqual(dispatched.status_steps[0].passed, 1)
  assert.strictEqual(dispatched.status_steps[0].title, 'รอรับ · ผ่านขั้นนี้แล้ว 1 รายการ')
  assert.strictEqual(dispatched.status_aria, 'รอผลตรวจ · รอรับ ผ่านแล้ว · รอผลตรวจ 1 รายการ')

  assert.deepStrictEqual(stepDone(done), ['waiting', 'dispatched'], 'ออกผลแล้ว ⇒ ผ่านมาสองขั้น')
  assert.deepStrictEqual(stepOn(done), ['resulted:1'])

  /* ยกเลิกไม่ใช่ขั้นในเส้นทาง — ห้ามทำให้ขั้นก่อนหน้ากลายเป็นผ่าน และตัวมันเองไม่มีวันผ่าน */
  assert.deepStrictEqual(stepDone(cancelled), [], 'ยกเลิกแล้วไม่ได้เดินต่อ')
  assert.deepStrictEqual(stepDone(cancelledHead), [])
  assert.strictEqual(cancelled.status_steps[3].done, false)

  /* ยังมีรายการค้างอยู่ที่ขั้นนั้น = แสดงจำนวน ไม่ใช่เครื่องหมายถูก แม้จะมีตัวอื่นเดินไปไกลแล้ว */
  assert.deepStrictEqual(stepDone(stepMix), [], 'ทุกขั้นยังมีรายการค้างอยู่')
  assert.strictEqual(stepMix.status_steps[0].passed, 2, 'ผ่านไปแล้ว 2 (ส่งเครื่อง 1 + ออกผล 1)')

  /* ── แถบเตือนแพ้ยา / COVID (ผู้ใช้ขอ 2026-09-03) ────────────────────────
     ข้อมูลมาจาก API เท่านั้น · ฟอร์มห้าม derive เอง · ไม่มีข้อมูล = ไม่ขึ้นกล่อง */
  const alerted = s.buildRow({
    order_id: 'ORD-ALERT',
    patient: { hn: 'HN-ALERT', alerts: { covid: true, allergies: ['Penicillin', 'Sulfa'] } },
    items: [],
  })
  assert.strictEqual(alerted.alert_full, 'COVID · แพ้ Penicillin, Sulfa')
  assert(alerted.alert_text, 'มีข้อความให้แสดงในกล่องแดง')

  const allergyOnly = s.buildRow({
    order_id: 'ORD-ALLERGY',
    patient: { hn: 'HN-ALLERGY', alerts: { allergies: ['Aspirin'] } },
    items: [],
  })
  assert.strictEqual(allergyOnly.alert_full, 'แพ้ Aspirin', 'ไม่มี COVID ก็ขึ้นเฉพาะแพ้ยา')

  const noAlert = s.buildRow({ order_id: 'ORD-NO-ALERT', patient: { hn: 'HN-OK' }, items: [] })
  assert.strictEqual(noAlert.alert_text, '', 'ไม่มีข้อมูลจาก EMR = ไม่ขึ้นกล่อง ห้ามขึ้นกล่องเปล่า')
  assert.strictEqual(noAlert.alert_full, '')

  /* Process รุ่นเก่าที่ยังไม่คืน alerts ต้องไม่ทำให้แถวพัง */
  assert.strictEqual(s.buildRow({ order_id: 'ORD-OLD-API', items: [] }).alert_text, '')

  /* ยาวเกินช่องให้ตัด แต่ข้อความเต็มต้องไม่หาย — ไปอยู่ที่ hover */
  const longAlert = s.buildRow({
    order_id: 'ORD-LONG',
    patient: { hn: 'HN-LONG', alerts: { allergies: ['Penicillin', 'Sulfonamide', 'Ibuprofen', 'Cephalosporin'] } },
    items: [],
  })
  assert(longAlert.alert_text.length <= 42)
  assert(longAlert.alert_full.length > longAlert.alert_text.length, 'ข้อความเต็มยังอยู่ครบ')

  /* ── Staff selectors ต่อ Member Master จริง (ผู้ใช้เปลี่ยน contract 2026-09-30) ── */
  s.loadStaffOptions()
  assert.deepStrictEqual(s.radiographerOptions.map(x => x.value), ['นางสุกัญญา ประจะเน'])
  assert.deepStrictEqual(s.radiologistOptions.map(x => x.value), ['พญ.กนกพร ชุติวงศ์ธนะพัฒน์'])
  assert.strictEqual(s.staffOptionsLoaded, true)
  const originalOrders = s.orders
  s.orders = [{ order_id: 'ORD-RAD', can_action: true, items: [{ item_id: 'aaaaaaaaaaaaaaaaaaaaaaa9', current_status: 'sent' }] }]
  let radRow = s.buildRow(s.orders[0])
  assert.strictEqual(radRow.items[0].radiologist, '', 'ยังไม่เลือก = ว่าง')
  await s.setRadiologist(radRow, radRow.items[0], 'พญ.แพทย์ ภายนอก')
  radRow = s.buildRow(s.orders[0])
  assert.strictEqual(radRow.items[0].radiologist, 'พญ.แพทย์ ภายนอก')
  assert.strictEqual(radRow.items[0].radiologist_source, 'external')
  let staffCall = calls.filter(call => call.params.action === 'set_staff').pop()
  assert.strictEqual(staffCall.params.radiologist_source, 'external')
  assert.strictEqual(staffCall.params.radiologist_member_id, '')
  await s.setRadiographer(radRow, radRow.items[0], s.radiographerOptions[0].value)
  radRow = s.buildRow(s.orders[0])
  assert.strictEqual(radRow.items[0].radiographer, 'นางสุกัญญา ประจะเน')
  assert.strictEqual(radRow.items[0].radiographer_source, 'master')
  staffCall = calls.filter(call => call.params.action === 'set_staff').pop()
  assert.strictEqual(staffCall.params.radiographer_member_id, '111111111111111111111111')
  s.orders = originalOrders
  s.recompute()

  /* ออกผลแล้ว 1 + ยกเลิก 1 — สองขั้นแรกต้องเป็นเครื่องหมายถูกจากตัวที่ออกผล */
  const doneAndCancelled = s.buildRow({
    order_id: 'ORD-DONE-CANCEL',
    can_action: true,
    items: [
      { item_id: 'D1', current_status: 'resulted', result_text: 'clear',
        dispatched_at: '2026-08-31T09:00:00+07:00', resulted_at: '2026-08-31T10:00:00+07:00' },
      { item_id: 'D2', current_status: 'cancelled' },
    ],
  })
  assert.deepStrictEqual(stepDone(doneAndCancelled), ['waiting', 'dispatched'])
  assert.deepStrictEqual(stepOn(doneAndCancelled), ['resulted:1', 'cancelled:1'])
  assert.strictEqual(doneAndCancelled.can_retest, true, 'partially cancelled Order exposes item-level retest')
  assert.strictEqual(doneAndCancelled.items[1].can_select, true, 'cancelled item can be checked')
  assert.strictEqual(doneAndCancelled.retest_ready, false, 'nothing checked cannot retest')
  s.toggleItem('D2')
  const selectedRetest = s.buildRow({ order_id: 'ORD-DONE-CANCEL', can_action: true, items: [
    { item_id: 'D1', current_status: 'resulted' }, { item_id: 'D2', current_status: 'cancelled' },
  ] })
  assert.strictEqual(selectedRetest.retest_ready, true)
  assert.strictEqual(selectedRetest.can_dispatch, false, 'resulted sibling is never dispatched')
  s.toggleItem('D2')
  s.toggleItem('D2')
  s.toggleItem('D3')
  const mixedRetest = s.buildRow({ order_id: 'ORD-MIX-RETEST', can_action: true, items: [
    { item_id: 'D2', current_status: 'cancelled' }, { item_id: 'D3', current_status: 'sent' },
  ] })
  assert.strictEqual(mixedRetest.retest_ready, false, 'mixed checked states cannot retest')
  assert.strictEqual(mixedRetest.dispatch_ready, false, 'mixed checked states cannot dispatch')
  s.toggleItem('D2')
  s.toggleItem('D3')
  assert.strictEqual(
    doneAndCancelled.status_aria,
    /* ป้ายรวมเดิมนับเฉพาะรายการที่ยังไม่ถูกยกเลิก ⇒ เหลือตัวที่ออกผลตัวเดียว = ออกผลครบ */
    'ออกผลครบ · รอรับ ผ่านแล้ว · รอผลตรวจ ผ่านแล้ว · ออกผลแล้ว 1 รายการ · ยกเลิก / ปฏิเสธ 1 รายการ',
  )

  /* modality dropdown มาจากข้อมูล ไม่ใช่ค่าที่ hard-code */
  assert.deepStrictEqual(s.view.modalities.map(m => m.value), ['CR', 'CT'])
  assert.strictEqual(s.view.modalities[0].count, null, 'derived options must not claim a count')
  assert.strictEqual(s.view.modalities[0].selected, false)
  assert.strictEqual(s.view.modalityReady, true)

  /* เลือกเครื่อง → กรองทันที ไม่ต้องกด Search · reset ไปหน้า 1 */
  s.page = { ...s.page, current: 3 }
  calls.length = 0
  s.setModality(['CT'])
  await flush()
  assert.strictEqual(s.page.current, 1, 'modality change resets to page 1')
  assert(
    calls.every(c => JSON.stringify(c.params.modality) === '["CT"]'),
    'every request carries the modality filter',
  )
  assert.strictEqual(s.view.rows.length, 2)
  assert(s.view.rows.every(r => r.modalities.every(m => m.code === 'CT')))

  /* chip counts นับภายใต้ตัวกรองเครื่องปัจจุบัน */
  assert.strictEqual(s.view.counts.all, 2)
  assert.strictEqual(s.view.counts.waiting, 0)
  assert.strictEqual(s.view.counts.pending, 1)
  assert.strictEqual(s.view.counts.complete, 1)
  assert.strictEqual(s.view.counts.cancelled, 0)

  /* ตัวเลือกเครื่องยังครบหลังกรอง — เปลี่ยนกลับไปเครื่องอื่นได้ */
  assert.deepStrictEqual(s.view.modalities.map(m => m.value), ['CR', 'CT'])

  /* ── เลือกหลายเครื่องพร้อมกัน (ผู้ใช้ขอ 2026-09-02) ─────────────────── */
  calls.length = 0
  s.setModality(['CT', 'CR'])
  await flush()
  assert.deepStrictEqual(calls[0].params.modality, ['CT', 'CR'])
  assert.strictEqual(s.view.rows.length, 4, 'both machines are shown together')
  const twoWide = Number.parseInt(s.modalitySelectWidth(), 10)
  assert.strictEqual(twoWide, 186, 'two short codes keep the standard trigger width')
  /* ผู้ใช้สั่ง 2026-09-17 ให้ 3 tag ต่อแถว — code สั้นตัวที่ 4 เป็นต้นไป
     ต้องเพิ่มแถว ไม่ขยายช่องด้านข้าง; code ยาวกว่าปรับความกว้างของคอลัมน์นั้นได้ */
  const pickedBefore = s.modality
  s.modality = ['DX', 'MG', 'US']
  const threeWide = Number.parseInt(s.modalitySelectWidth(), 10)
  assert.strictEqual(threeWide, twoWide,
    'two and three short codes use the same box width without excessive blank space')
  s.modality = ['DX', 'MG', 'US', 'CT']
  assert.strictEqual(Number.parseInt(s.modalitySelectWidth(), 10), threeWide,
    'a fourth short machine starts another row without widening the trigger')
  s.modality = ['DX', 'MG', 'US', 'CT', 'CR', 'RF', 'MR', 'NM', 'XR']
  assert.strictEqual(Number.parseInt(s.modalitySelectWidth(), 10), threeWide,
    'later short machines keep wrapping within the same three columns')
  s.modality = ['VCUG', 'MG', 'US']
  assert(Number.parseInt(s.modalitySelectWidth(), 10) > threeWide,
    'a longer code still gets enough room in its tag column')
  s.modality = ['DX']
  assert.strictEqual(Number.parseInt(s.modalitySelectWidth(), 10), threeWide,
    'one short code uses the same stable width')
  s.modality = pickedBefore
  assert.deepStrictEqual(
    s.view.modalities.filter(m => m.selected).map(m => m.value), ['CR', 'CT'],
    'both options are flagged so each gets its own clear button',
  )
  /* สรุปโชว์ชื่อเต็มตามลำดับที่ผู้ใช้เลือก ไม่ใช่รหัสและไม่เรียงใหม่ */
  assert(s.view.summary.includes('เครื่อง: CT-'), s.view.summary)
  assert(s.view.summary.includes(', CR-'), s.view.summary)

  /* ค่าซ้ำต้องถูกยุบ และค่าว่างต้องถูกคัดทิ้ง ไม่ส่งขยะไป server */
  calls.length = 0
  s.setModality(['CT', 'CT', '', 'CR'])
  await flush()
  assert.strictEqual(calls.length, 0, 'the same selection must not refetch')

  /* กากบาทข้างเครื่อง: เอาออกทีละตัว ตัวที่เหลือต้องยังกรองอยู่ */
  calls.length = 0
  s.unpickModality('CR')
  await flush()
  assert.deepStrictEqual(s.modality, ['CT'])
  assert.deepStrictEqual(calls[0].params.modality, ['CT'])
  assert.strictEqual(s.view.rows.length, 2)

  /* เอาออกตัวที่ไม่ได้เลือกไว้ = ไม่เกิดอะไร ไม่ยิงซ้ำ */
  calls.length = 0
  s.unpickModality('MG')
  await flush()
  assert.strictEqual(calls.length, 0)
  assert.deepStrictEqual(s.modality, ['CT'])

  /* เอาออกตัวสุดท้าย = กลับไปไม่กรอง เท่ากับ Select all เดิม */
  calls.length = 0
  s.unpickModality('CT')
  await flush()
  assert.deepStrictEqual(s.modality, [])
  assert.strictEqual(s.modalitySelectWidth(), '186px', 'the empty trigger keeps the stable base width')
  assert(!('modality' in calls[0].params), 'an empty selection sends no modality key')
  assert.strictEqual(s.view.rows.length, 4)
  assert(s.view.summary.includes('เครื่อง: ทุกเครื่อง'), s.view.summary)

  /* ผู้เรียกเก่าที่ส่งค่าเดี่ยวมาต้องยังใช้ได้
     และคืนสถานะเป็น ['CT'] ให้เทสถัดไปทำงานต่อได้เหมือนเดิม (CLAUDE.md §14) */
  calls.length = 0
  s.setModality('CT')
  await flush()
  assert.deepStrictEqual(s.modality, ['CT'], 'a bare string still works')

  /* ── ผู้ใช้เลือกลำดับการจัดเรียงเองได้ (ผู้ใช้ขอ 2026-09-25 · TOR §3.4.3.1) ────
     ก่อนหน้านี้เรียงตายตัวใหม่→เก่า · เพิ่ม dropdown ข้างตัวกรองเครื่อง
     🔴 สัญญาที่ห้ามพัง: ค่าเริ่มต้นต้อง "ไม่ส่ง sort" ⇒ คำขอเหมือนเดิมทุกไบต์ */
  assert.strictEqual(s.sortKey, 'latest', 'the default order is the old fixed order')
  assert.deepStrictEqual(
    s.sortOptions,
    [{ value: 'latest', label: 'เวลาสั่งล่าสุดก่อน' }, { value: 'oldest', label: 'เวลาสั่งเก่าสุดก่อน' }],
    'two choices exactly as the user asked for',
  )
  assert(!('sort' in s.params(s.statusMap.all, 30, 1)), 'the default must send no sort key at all')

  calls.length = 0
  s.page = { ...s.page, current: 3 }
  s.setSort('oldest')
  await flush()
  assert.strictEqual(s.sortKey, 'oldest')
  assert.strictEqual(calls[0].params.sort, 'oldest', 'the chosen order reaches the API')
  assert.strictEqual(s.page.current, 1, 'a new order starts from page 1')
  assert.deepStrictEqual(s.modality, ['CT'], 'sorting must not disturb the machine filter')
  assert.deepStrictEqual(calls[0].params.modality, ['CT'], 'the machine filter still rides along')

  /* กดค่าเดิมซ้ำต้องไม่ยิงซ้ำ — ทรงเดียวกับ setModality */
  calls.length = 0
  s.setSort('oldest')
  await flush()
  assert.strictEqual(calls.length, 0, 'picking the same order again must not refetch')

  /* ค่าที่ไม่รู้จักตกกลับค่าเริ่มต้น ไม่ค้างอยู่ที่ค่าพิการ */
  calls.length = 0
  s.setSort('bogus')
  await flush()
  assert.strictEqual(s.sortKey, 'latest', 'an unknown choice falls back to the old order')
  assert(!('sort' in calls[0].params), 'back at the default it stops sending the key')

  /* โหมดสแกนต้องเรียงตามที่เลือกด้วย — ใส่ sort ก่อน early return ทุกอัน */
  s.setSort('oldest')
  await flush()
  s.scanMode = true
  s.scanType = 'hn'
  s.scannedHn = '6900040'
  const scanSorted = s.params(s.statusMap.all, 30, 1)
  assert.strictEqual(scanSorted.sort, 'oldest', 'scan mode honours the chosen order')
  assert.strictEqual(scanSorted.hn, '6900040', 'scan mode still sends the scanned HN')
  /* โหมดเปิดจากคิวเป็น early return คนละอันและอยู่ถัดจากโหมดสแกน
     ⇒ ต้องปิดโหมดสแกนก่อน ไม่งั้นได้ params ของสแกนแทน */
  s.scanMode = false
  s.scannedHn = ''
  s.focusVisitId = 'VISIT-SORT'
  const queueSorted = s.params(s.statusMap.all, 30, 1)
  assert.strictEqual(queueSorted.sort, 'oldest', 'queue focus honours it too')
  assert.strictEqual(queueSorted.visit_id, 'VISIT-SORT', 'queue focus still filters by visit')
  /* คืนสถานะให้เทสถัดไปทำงานต่อได้เหมือนเดิม (CLAUDE.md §14) */
  s.focusVisitId = ''
  s.setSort('latest')
  await flush()
  assert.strictEqual(s.sortKey, 'latest')
  calls.length = 0

  /* เปลี่ยน chip แล้วค่าเครื่องต้องคงอยู่ */
  calls.length = 0
  s.setStatus('complete')
  await flush()
  assert.deepStrictEqual(s.modality, ['CT'], 'modality survives a status change')
  assert.deepStrictEqual(calls[0].params.modality, ['CT'])
  assert.deepStrictEqual(calls[0].params.statuses, ['resulted', 'completed'])
  assert.strictEqual(s.page.current, 1)

  /* เปลี่ยนหน้าแล้วค่าเครื่องต้องคงอยู่ */
  calls.length = 0
  s.setStatus('all')
  await flush()
  s.setPage(2)
  await flush()
  assert.deepStrictEqual(calls.at(-1).params.modality, ['CT'])
  assert.strictEqual(calls.at(-1).params.page, 2)

  /* ค้นหา: ส่ง q ให้ server เสมอ · ส่ง hn เพิ่มเมื่อดูเป็นรหัส · กรองซ้ำฝั่งจอเป็นตาข่ายกันพลาด */
  s.setModality([])
  await flush()
  s.setSearch('HN-003')
  assert.strictEqual(s.view.rows.length, 1, 'client-side guard filters the loaded rows')
  assert.strictEqual(s.view.rows[0].hn, 'HN-003')
  const searchParams = s.params(s.statusMap.all, 30, 1)
  assert.strictEqual(searchParams.q, 'HN-003')
  assert.strictEqual(searchParams.hn, 'HN-003')
  s.setSearch('ทดสอบ ระบบ')
  const nameParams = s.params(s.statusMap.all, 30, 1)
  assert.strictEqual(nameParams.q, 'ทดสอบ ระบบ')
  assert(!('hn' in nameParams), 'a name search must not be sent as an exact HN')
  s.setSearch('AN-0001')
  const anParams = s.params(s.statusMap.all, 30, 1)
  assert.strictEqual(anParams.q, 'AN-0001')
  assert.strictEqual(anParams.hn, 'AN-0001', 'the old numeric-code hint remains in the request')
  assert(s.matchesQuery({ visit: { an: 'AN-0001' }, items: [] }),
    'the client guard must retain inpatient AN rows returned by the API')
  s.setSearch('1234567890123')
  const cidParams = s.params(s.statusMap.all, 30, 1)
  assert.strictEqual(cidParams.q, '1234567890123')
  assert(!('hn' in cidParams), 'typing a citizen ID in Search must not turn it into an HN')
  assert(!('citizen_id' in cidParams), 'the ordinary Search box stays a free-text query')
  assert(!s.matchesQuery({ patient: { hn: 'OTHER' }, items: [] }),
    'a stale row must not pass the citizen ID guard before the matching response arrives')
  s.loadedQuery='1234567890123'
  assert(s.matchesQuery({ patient: { hn: 'OTHER' }, items: [] }),
    'citizen ID results are trusted after the server returns the same query without exposing the ID')
  s.loadedQuery='';
  s.setSearch('')
  await flush()

  /* Date Range กรองทันทีและ reset ไปหน้า 1 */
  calls.length = 0
  s.setDates(['2026-08-01', '2026-08-31'])
  await flush()
  assert.strictEqual(calls[0].params.date_from, '2026-08-01')
  assert.strictEqual(calls[0].params.date_to, '2026-08-31')
  assert.strictEqual(s.page.current, 1)
  assert.strictEqual(s.view.dateScopeText, '01/08/69 – 31/08/69')

  /* ── ปุ่ม "พิมพ์ HN" (ผู้ใช้สั่ง 2026-09-11) ────────────────────────────────
     เป็นของ **เพิ่ม** ล้วน: ไม่แตะ hnOrderReportReady/hnOrderReportParams ของปุ่ม HN เดิม */
  const printRow = { id: 'ORD-PRINT', hn: '6900040', emr: { visit_id: 'VISIT-PRINT' } }
  assert.strictEqual(s.hnPrintHint(printRow), 'พิมพ์ป้ายติดแฟ้มที่เครื่อง HN/VN Sticker โดยไม่เปิด PDF')
  assert.strictEqual(s.hnPrintHint({ id: 'ORD-NO-HN' }), 'Order นี้ไม่มี HN สำหรับพิมพ์ป้ายติดแฟ้ม')

  /* ไม่มี HN = เตือนแล้วจบ ห้ามยิงงานพิมพ์ */
  printAgentStub = null
  notes.length = 0
  s.printHnLabel({ id: 'ORD-NO-HN' })
  assert.strictEqual(notes.at(-1), 'Order นี้ไม่มี HN')

  /* ยังไม่ได้ต่อ agent = บอกให้ชัดว่าต้องไปทำอะไร ไม่ใช่เงียบหาย */
  notes.length = 0
  s.printHnLabel(printRow)
  assert(String(notes.at(-1)).includes('print agent'), 'a missing agent must say so')
  assert.strictEqual(s.hnPrinting['ORD-PRINT'], undefined, 'a failed lookup must not leave the row spinning')

  /* ต่อ agent แล้ว: ส่ง Report เดียวกับปุ่ม HN + เครื่องพิมพ์ที่ตั้งไว้ + hn ของแถว */
  let resolveJob = null
  printAgentStub = {
    printReport: (reportId, opts) => {
      printJobs.push({ reportId, opts })
      return new Promise(done => { resolveJob = done })
    },
  }
  notes.length = 0
  s.printHnLabel(printRow)
  assert.strictEqual(printJobs.length, 1)
  assert.strictEqual(printJobs[0].reportId, '6a9a355c422c1ca95982a1a2', 'reuses the HN Report, no second ID')
  assert.strictEqual(printJobs[0].opts.printer, 'HN/VN Sticker')
  assert.deepStrictEqual(printJobs[0].opts.params, { hn: '6900040' })
  assert(String(printJobs[0].opts.jobKey).startsWith('xray-hn-6900040-'), 'jobKey must be unique per click')
  assert.strictEqual(s.hnPrinting['ORD-PRINT'], true, 'the row spins while the job is in flight')
  /* กดซ้ำระหว่างรอต้องไม่ยิงงานที่สอง — ปุ่ม disabled อยู่ แต่กันไว้อีกชั้น */
  resolveJob()
  await flush()
  assert.strictEqual(s.hnPrinting['ORD-PRINT'], false, 'the spinner clears when the agent replies')
  assert(String(notes.at(-1)).includes('ส่งพิมพ์ป้ายติดแฟ้ม HN 6900040'))

  /* agent ปฏิเสธ = เตือนพร้อมเหตุผลจริง และเลิกหมุน */
  printJobs.length = 0
  printAgentStub = { printReport: () => Promise.reject(new Error('printer offline')) }
  notes.length = 0
  s.printHnLabel(printRow)
  await flush()
  assert.strictEqual(s.hnPrinting['ORD-PRINT'], false)
  assert.strictEqual(notes.at(-1), 'พิมพ์ไม่สำเร็จ: printer offline')
  printAgentStub = null

  /* ── ป้ายความเร่งด่วน: ชื่อต้องตรงระดับที่ CPOE ส่งมา (ผู้ใช้สั่ง 2026-09-11) ──
     เดิมทุกระดับโชว์ 'เร่งด่วน' คำเดียว · zdata_cpoe_order.priority เป็นรหัสสตริง '1'..'5' */
  assert.strictEqual(s.isUrgent({ priority: '1' }), false, 'ปกติ ไม่ติดป้าย')
  assert.strictEqual(s.urgentLabel({ priority: '1' }), '', 'ปกติ ต้องไม่มีข้อความป้าย')
  assert.strictEqual(s.urgentLabel({ priority: '2' }), 'ด่วน')
  assert.strictEqual(s.urgentLabel({ priority: '3' }), 'ด่วนที่สุด')
  assert.strictEqual(s.urgentLabel({ priority: '4' }), 'ด่วน OR')
  assert.strictEqual(s.urgentLabel({ priority: '5' }), 'ด่วน อุบัติเหตุ')
  /* ของเดิมต้องไม่หาย: ค่าที่ไม่ใช่รหัส 1–5 ยังติดป้ายเหมือนเดิม */
  ;['urgent', 'STAT', 'Urgent-1'].forEach(v =>
    assert.strictEqual(s.isUrgent({ priority: v }), true, v + ' ยังต้องนับว่าด่วน'))
  assert.strictEqual(s.urgentLabel({ priority: 'urgent' }), 'เร่งด่วน', 'รหัสที่ไม่รู้จักตกกลับไปคำเดิม')
  assert.strictEqual(s.urgentLabel({ priority: 'STAT' }), 'เร่งด่วน')
  assert.strictEqual(s.urgentLabel({ priority: 'ด่วนที่สุด' }), 'ด่วนที่สุด', 'ชื่อไทยที่ส่งมาตรง ๆ ใช้ได้เลย')
  assert.strictEqual(s.isUrgent({}), false, 'ไม่มี priority = ไม่ด่วน')
  assert.strictEqual(s.urgentLabel({}), '')

  /* API คืน modalities[] เมื่อไหร่ ให้ใช้ของ API พร้อมจำนวน */
  withModalityMaster = true
  s.applyFilters()
  await flush()
  /* `selected` บอกเทมเพลตว่าจะโชว์กากบาทให้เครื่องไหน (multi-select · 2026-09-02) */
  assert.deepStrictEqual(s.view.modalities, [
    { value: 'CR', label: 'CR', count: 2, selected: false },
    { value: 'CT', label: 'CT', count: 2, selected: false },
  ])
  assert.strictEqual(s.view.modalityNote, '', 'no fallback note once the API supplies the master')

  /* ผลอ่าน: อ่านอย่างเดียว · ค่ามาจาก API เท่านั้น */
  const target = s.view.rows.find(r => r.id === 'ORD-3')
  await s.openReport(target, target.first_result_item)
  assert.strictEqual(calls.at(-1).params.action, 'get_report')
  assert.strictEqual(calls.at(-1).params.item_id, 'ITEM-ORD-3')
  assert.strictEqual(s.report.visible, true)
  assert.strictEqual(s.report.data.has_report, true)
  assert.strictEqual(s.report.data.result_text, 'Normal chest radiograph. No focal consolidation.')
  /* RIS ส่งรหัสรังสีแพทย์มา ไม่ใช่ชื่อ — ห้ามเดาชื่อคนจากรหัส */
  assert.strictEqual(s.report.data.radiologist, 'RAD-007')
  assert.strictEqual(s.report.data.severity, 'N')
  assert(s.report.data.version_note.includes('2 ฉบับ'), 'the user must see there are several reports')

  /* ปุ่มดินสอแก้เฉพาะ popup เดิม: เริ่มเป็น read-only แล้วสลับเข้า Manual
     การ save ใช้ Process เดิมและอ่าน get_report กลับ โดยไม่แตะ dispatch/cancel */
  assert.strictEqual(s.report.editing, false)
  s.beginManualReport()
  assert.strictEqual(s.report.editing, true)
  assert.strictEqual(s.report.manual.radiologist_uid, 'RAD-007', 'แก้ผลเดิมต้องตั้งต้นจากรหัสแพทย์ฉบับล่าสุด')
  assert(/^xray-/.test(s.report.manual.manual_request_id), 'ทุกการบันทึกมี idempotency key')
  s.setManualReportField('result_text', 'Manual correction text')
  s.setManualReportField('result_datetime', '2026-10-15 13:45:00')
  s.setManualReportField('result_status', 'C')
  s.setManualReportField('severity_uid', 'U')
  assert.strictEqual(s.canSaveManualReport(), true)
  await s.saveManualReport()
  const manualCall = calls.filter(call => call.params.action === 'save_manual_report').pop()
  assert(manualCall, 'กดบันทึกต้องเรียก save_manual_report')
  assert.strictEqual(manualCall.params.item_id, 'ITEM-ORD-3')
  assert.strictEqual(manualCall.params.result_text, 'Manual correction text')
  assert.strictEqual(manualCall.params.radiologist_uid, 'RAD-007')
  assert.strictEqual(manualCall.params.result_status, 'C')
  assert.strictEqual(s.report.editing, false, 'สำเร็จแล้วกลับโหมดดูใน popup เดิม')
  assert.strictEqual(s.report.visible, true, 'ไม่เปิด popup ใหม่และไม่ปิด popup เดิม')

  /* ── ประวัติการแก้ผลอ่าน (เพิ่ม 2026-09-15 · ตามดีไซน์ที่ผู้ใช้อนุมัติ) ────────
     assertion ด้านบนคือ "dialog เปิดมาที่ฉบับล่าสุด" ซึ่งยังต้องจริงเหมือนเดิม */
  assert.strictEqual(s.report.versions.length, 2, 'ผลอ่านทุกฉบับถูกเก็บไว้ให้ดูได้')
  assert.strictEqual(s.report.history_open, false, 'เปิด dialog มาต้องพับประวัติไว้ก่อน')
  assert.strictEqual(s.report.selected, 0)
  assert.strictEqual(s.currentReportVersion().latest, true, 'เริ่มที่ฉบับล่าสุดเสมอ')
  /* mock นี้ไม่ได้ส่ง modality มากับผล ⇒ ต้องตกกลับไปใช้ของ item เหมือนเดิม */
  assert.strictEqual(s.report.data.modality_code, 'CT', 'ช่องเครื่องโชว์ตัวย่อ')
  assert.strictEqual(s.report.data.modality, 'CT', 'ค่าเดิมยังคำนวณเหมือนเดิม')
  /* API ส่ง {code,label} มาเมื่อไหร่ ต้องแยกตัวย่อกับชื่อเต็มออกจากกันให้ถูก */
  const withModality = s.buildReport({ modality: { code: 'CR', label: 'CR-Computed Radiography' } }, {}, {})
  assert.strictEqual(withModality.modality_code, 'CR', 'ตัวย่ออยู่ในช่อง')
  assert.strictEqual(withModality.modality_label, 'CR-Computed Radiography', 'ชื่อเต็มไปอยู่ที่ tooltip')
  assert.strictEqual(withModality.modality, 'CR-Computed Radiography', 'ค่าเดิมยังเป็นชื่อเต็มเหมือนเดิม')
  assert(s.report.data.version_summary.includes('2 ฉบับ'), s.report.data.version_summary)
  assert(s.report.data.version_summary.includes('รังสีแพทย์ 1 คน'), 'นับเฉพาะรหัสที่มีจริง ไม่นับช่องว่าง')
  assert.strictEqual(s.report.data.version_stale, '', 'Process คืน versions แล้วจึงไม่ต้องเตือน')

  /* เลือกฉบับเก่า: เนื้อผล หัว dialog และท้าย dialog ต้องเดินตามฉบับนั้นพร้อมกัน
     ไม่งั้นจะอ่านผลฉบับหนึ่งแต่เห็นชื่อคนอ่านของอีกฉบับ */
  s.toggleReportHistory()
  assert.strictEqual(s.report.history_open, true)
  s.selectReportVersion(1)
  const older = s.currentReportVersion()
  assert.strictEqual(older.no, 1)
  assert.strictEqual(older.latest, false)
  assert.strictEqual(older.status_label, 'ผลเบื้องต้น (P)')
  assert.strictEqual(older.radiologist, '', 'ฉบับที่ไม่มีรหัสแพทย์ต้องว่าง ห้ามยืมของฉบับล่าสุด')
  assert.strictEqual(s.shownRadiologist(), '', 'ท้าย dialog เดินตามฉบับที่กำลังดู')
  assert.strictEqual(s.shownReported(), s.compactDateTime('2026-08-31T09:00:00+07:00'))
  /* ไฮไลต์เทียบกับ "ฉบับก่อนหน้าของมันเอง" ⇒ ฉบับล่าสุดมีของให้เทียบ
     ส่วนฉบับแรกสุดไม่มี จึงต้องไม่มีบรรทัดไหนถูกมาร์กว่าแก้ */
  assert(s.report.versions[0].lines.some(line => line.changed), 'ฉบับใหม่ต้องไฮไลต์ส่วนที่ต่างจากฉบับก่อน')
  assert.strictEqual(s.report.versions[1].has_previous, false, 'ฉบับแรกสุดไม่มีของก่อนหน้าให้เทียบ')
  assert(!older.lines.some(line => line.changed), 'ฉบับแรกสุดจึงไม่มีอะไรถูกมาร์กว่าแก้')

  /* ปิดประวัติแล้วต้องกลับไปฉบับล่าสุด — ห้ามเหลือฉบับเก่าค้างบนจอโดยไม่มีแถบเตือน */
  s.toggleReportHistory()
  assert.strictEqual(s.report.history_open, false)
  assert.strictEqual(s.currentReportVersion().latest, true)
  assert.strictEqual(s.shownRadiologist(), 'RAD-007')

  s.setReportDiff(false)
  assert.strictEqual(s.report.diff, false, 'ปิดไฮไลต์ได้')

  /* Process เก่าที่ยังไม่คืน versions[] — dialog ต้องกลับไปหน้าตาเดิมทุกประการ
     (ข้อความ version_note เดิม + ผลก้อนเดียว) แล้วบอกให้ไปอัปเดต Process */
  const legacy = s.buildReport({ result_text: 'X', result_versions: 2, radiologist_uid: 'RAD-009' }, {}, {})
  assert.deepStrictEqual(s.buildVersions({ result_text: 'X', result_versions: 2 }), [])
  assert(legacy.version_note.includes('2 ฉบับ'), 'ข้อความเดิมยังอยู่ให้เส้นทางเก่า')
  assert(legacy.version_stale.includes('versions[]'), 'และบอกตรง ๆ ว่าต้องอัปเดต Process ตัวไหน')

  s.setReportVisible(false)
  s.resetReport()
  assert.strictEqual(s.report.visible, false)
  assert.deepStrictEqual(s.report.versions, [], 'ปิด dialog แล้วประวัติต้องถูกล้าง')
  assert.strictEqual(s.report.history_open, false)

  /* เคสจริงจาก 2026-09-10: ส่งเข้าเครื่อง 15:36 · ผลที่ RIS ส่งมา 10:05 */
  const stale = s.buildResultItem({}, {
    item_id: 'I-STALE', item_name: 'Neck AP', current_status: 'dispatched',
    dispatched_at: '2026-09-10 15:36:10', resulted_at: '2026-09-10 10:05:00',
    result_text: 'NECK AP VIEW',
  }, 0)
  assert.strictEqual(stale.done, true, 'มีผล = ออกผลแล้ว ไม่สนว่าผลเก่ากว่าเวลาส่ง')
  assert(stale.resulted_text.includes('10:05'), 'และเวลาออกผลต้องขึ้นตามจริง')
  assert.strictEqual(stale.state_label, 'ออกผลแล้ว')
  assert.strictEqual(stale.stale_result, undefined, 'ไม่มีป้าย "ไม่ใช่ผลรอบนี้" อีกแล้ว')

  /* ผลที่ใหม่กว่ารอบส่ง = ปกติเหมือนเดิมทุกประการ */
  const fresh = s.buildResultItem({}, {
    item_id: 'I-OK', item_name: 'Neck AP', current_status: 'dispatched',
    dispatched_at: '2026-09-10 09:00:00', resulted_at: '2026-09-10 10:05:00',
    result_text: 'NECK AP VIEW',
  }, 0)
  assert.strictEqual(fresh.done, true)
  assert(fresh.resulted_text.includes('10:05'))

  /* ยังไม่มีผล = ยังไม่ออกผล — ของเดิมที่ต้องไม่พังไปกับการตัดกติกาเวลา */
  const noResultYet = s.buildResultItem({}, {
    item_id: 'I-WAIT', item_name: 'Neck AP', current_status: 'dispatched',
    accession_no: 'SM20260910DX009', dispatched_at: '2026-09-10 09:00:00',
  }, 0)
  assert.strictEqual(noResultYet.done, false, 'ไม่มี result_text = ยังไม่ออกผล')
  assert.strictEqual(noResultYet.resulted_text, '')
  assert.strictEqual(noResultYet.state_label, 'ส่งเครื่องแล้ว')

  /* ── มีผลอ่านแล้ว ป้ายต้องขึ้น "ออกผลแล้ว" ไม่ใช่ "ส่งเครื่องไม่สำเร็จ" ──────
     (ผู้ใช้สั่ง 2026-09-16 · เจอจริงกับ R2609100001 ที่ RIS ส่งผลกลับมา 6 ฉบับ
     แต่ป้ายยังค้างที่ transport ล้มของ 10/09 13:46)
     🔴 ข้อความ transport ที่ล้มต้องยังอยู่ครบ ไม่ได้ถูกซ่อน */
  const failedButResulted = s.buildItem({}, {
    item_id: 'I-FAIL-RESULTED', item_name: 'Skull AP', current_status: 'accepted',
    accession_no: 'SM20260910DX001', dispatched_at: '2026-09-10 13:43:04',
    resulted_at: '2026-09-10 09:40:00', result_text: 'SKULL AP VIEW',
    transport: { status: 'failed', message: 'ต่อ Envision ไม่ได้ (ECONNABORTED)' },
  })
  assert.strictEqual(failedButResulted.status_label, 'ออกผลแล้ว', 'ผลใหม่กว่า ต้องชนะป้าย transport')
  assert.strictEqual(failedButResulted.status_class, 'xr-st-complete')
  assert.strictEqual(failedButResulted.transport_failed, true, 'ยังรู้ว่า transport ล้ม')
  assert(
    failedButResulted.transport_note.includes('ECONNABORTED'),
    'ข้อความ transport ที่ล้มต้องยังอยู่ให้เห็นในคอลัมน์เวลาส่งเข้าเครื่อง',
  )

  /* transport ล้มและยังไม่มีผล = ป้ายเดิมทุกประการ ห้ามเปลี่ยน */
  const failedNoResult = s.buildItem({}, {
    item_id: 'I-FAIL', item_name: 'Skull AP', current_status: 'accepted',
    accession_no: 'SM20260910DX002', dispatched_at: '2026-09-10 13:43:04',
    transport: { status: 'failed', message: 'ต่อ Envision ไม่ได้' },
  })
  assert.strictEqual(failedNoResult.status_label, 'ส่งเครื่องไม่สำเร็จ')
  assert.strictEqual(failedNoResult.status_class, 'xr-st-failed')

  /* explainWriteBlock ยังอยู่เป็นตัวอธิบายของที่ยังไม่เปิดใช้ (ไม่มีปุ่มไหนเรียกแล้ว
     หลังต่อ ตรวจใหม่ เข้า API 2026-09-03) — คงไว้เพราะยังมีของรอ contract จาก RIS อยู่ */
  notes.length = 0
  s.explainWriteBlock('ตัวอย่างของที่ยังไม่เปิด')
  assert(notes[0].includes('RIS'), notes[0])
  assert(notes[0].includes('X9'), 'it names the open decision')

  /* ── ตรวจใหม่: เลือก item ใน Order เดิมก่อน; ไม่มีปุ่มลัดระดับ Order ── */
  {
    calls.length = 0
    notes.length = 0
    await s.retestOrder({ id: 'ORD-1', can_action: true, order_no: 'R2609010003' })
    assert.strictEqual(calls.length, 0, 'missing selection must not call Process')
    assert(notes[0].includes('เลือกรายการ'))
    notes.length = 0
    await s.retestOrder({ id: 'ORD-1', can_action: true, order_no: 'R2609010003', items: [
      { id: 'ITEM-A', selected: true, can_retest: true },
      { id: 'ITEM-B', selected: false, can_retest: true },
    ] })
    const call = calls.filter(c => c.params.action === 'retest_items').slice(-1)[0]
    assert.strictEqual(call.id, TEST_PROCESS_ID, 'ใช้ Process worklist ตัวเดิม ไม่มี Process ใหม่')
    assert.strictEqual(call.params.action, 'retest_items')
    assert.strictEqual(call.params.order_id, 'ORD-1')
    assert.strictEqual(call.params.order_number, 'R2609010003', 'เลข Order เดิมถูกส่งไปยืนยัน')
    assert.deepStrictEqual(call.params.item_ids, ['ITEM-A'], 'เลือก A ไม่ส่ง B')
    assert(!('accession_no' in call.params), 'ฟอร์มไม่ยุ่งกับเลข Accession เอง — server ล้างให้')
    calls.length = 0
    await s.retestOrder({ id: 'ORD-1', can_action: true, items: [
      { id: 'ITEM-A', selected: true, can_retest: true },
      { id: 'ITEM-B', selected: true, can_retest: false },
    ] })
    assert.strictEqual(calls.length, 0, 'mixed selection is rejected')
    calls.length = 0
    await s.retestOrder({ id: 'ORD-1', can_action: true, items: [
      { id: 'ITEM-A', selected: true, can_retest: true },
      { id: 'ITEM-B', selected: true, can_retest: true },
    ] })
    assert.deepStrictEqual(calls.filter(c => c.params.action === 'retest_items').slice(-1)[0].params.item_ids, ['ITEM-A', 'ITEM-B'])
    calls.length = 0
    notes.length = 0
    retestReply = { success: true, data: { orders: [] } }
    await s.retestOrder({ id: 'ORD-1', can_action: true, items: [{ id: 'ITEM-A', selected: true, can_retest: true }] })
    assert(notes.some(note => note.includes('replace body')), 'old Process list response is rejected')
    retestReply = null
  }

  /* ── ส่งเข้าเครื่อง — Process ที่ deploy แล้ว ────────────────────────── */
  const w = s

  /* ไม่ติ๊กอะไรเลย = ห้ามยิง และห้ามเดาว่าหมายถึงทั้งใบ */
  notes.length = 0
  calls.length = 0
  await w.dispatchOrder({ id: 'ORD-1', can_action: true, items: [{ id: 'ITEM-A', selected: false }] })
  assert.strictEqual(calls.length, 0, 'nothing ticked ⇒ nothing sent')
  assert(notes[0].includes('เลือกรายการ'), 'and the form asks the user to make a selection')

  calls.length = 0
  await w.dispatchOrder({ id: 'ORD-1', can_action: true, items: [{ id: 'ITEM-A', selected: true, can_retest: true }] })
  assert.strictEqual(calls.length, 0, 'selected cancelled item cannot be dispatched')

  /* เปลี่ยนตามคำสั่งผู้ใช้ 2026-09-03: ติ๊กหลายรายการแล้วปุ่มเดียวเรียก Process เดิม
     ตามลำดับทีละ item_id เพื่อไม่เปลี่ยน contract ฝั่ง server */
  notes.length = 0
  calls.length = 0
  dispatchReply = { success: true, accession_no: 'SM20260901CT001', transport: { status: 'ok' }, message: 'ส่งเข้าเครื่องแล้ว' }
  await w.dispatchOrder({
    id: 'ORD-1',
    can_action: true,
    items: [{ id: 'ITEM-A', selected: true }, { id: 'ITEM-C', selected: true }],
  })
  const multiDispatchCalls = calls.filter(call => call.id === DISPATCH_PROCESS_ID)
  assert.deepStrictEqual(
    multiDispatchCalls.map(call => call.params),
    [{ order_id: 'ORD-1', item_id: 'ITEM-A' }, { order_id: 'ORD-1', item_id: 'ITEM-C' }],
    'each selected item is sent through the existing single-item Process contract',
  )
  assert(notes.some(note => note.includes('ส่งสำเร็จ 2 รายการ')))

  /* ติ๊กรายการเดียว = ส่งรายการนั้นรายการเดียว */
  notes.length = 0
  calls.length = 0
  dispatchReply = { success: true, accession_no: 'SM20260901CT001', transport: { status: 'ok' }, message: 'ส่งเข้าเครื่องแล้ว · Accession No. SM20260901CT001' }
  const rowWithSelection = {
    id: 'ORD-1',
    can_action: true,
    items: [
      { id: 'ITEM-A', selected: true },
      { id: 'ITEM-B', selected: false },
      { id: 'ITEM-C', selected: false },
    ],
  }
  await w.dispatchOrder(rowWithSelection)
  const dispatchCall = calls.find(call => call.id === DISPATCH_PROCESS_ID)
  assert(dispatchCall, 'the button must call the dispatch Process')
  assert.deepStrictEqual(
    dispatchCall.params,
    { order_id: 'ORD-1', item_id: 'ITEM-A' },
    'exactly one item travels, as item_id',
  )
  assert(notes.some(note => note.includes('SM20260901CT001')))
  assert(calls.some(call => call.params && call.params.action === 'list'), 'the list refreshes after dispatch')
  assert.deepStrictEqual(w.selected, {}, 'a successful dispatch clears the selection')

  /* toggleItem สลับอิสระ และหัวตารางเลือก/ล้างได้ทุก item ที่ดำเนินการได้ */
  w.toggleItem('ITEM-A')
  assert.strictEqual(w.selected['ITEM-A'], true)
  w.toggleItem('ITEM-A')
  assert.strictEqual(w.selected['ITEM-A'], undefined, 'ticking twice unticks')
  w.toggleItem('ITEM-A')
  w.toggleItem('ITEM-C')
  assert.strictEqual(w.selected['ITEM-C'], true)
  assert.strictEqual(w.selected['ITEM-A'], true, 'the previous pick remains selected')
  assert.strictEqual(Object.keys(w.selected).length, 2)
  const selectableRow = { items: [
    { id: 'ITEM-A', can_select: true },
    { id: 'ITEM-B', can_select: false },
    { id: 'ITEM-C', can_select: true },
  ] }
  assert.strictEqual(w.allSelectableSelected(selectableRow), true)
  assert.strictEqual(w.someSelectableSelected(selectableRow), false)
  w.toggleAllItems(selectableRow)
  assert.deepStrictEqual(w.selected, {}, 'select all clears when every selectable item is already selected')
  w.toggleAllItems(selectableRow)
  assert.deepStrictEqual(w.selected, { 'ITEM-A': true, 'ITEM-C': true }, 'select all ignores disabled items')
  w.toggleItem('ITEM-C')
  assert.strictEqual(w.someSelectableSelected(selectableRow), true, 'one of several selected is indeterminate')
  w.selected = {}

  /* ── คลิกทั้งแถว ─────────────────────────────────────────────────────── */
  const plainClick = { target: {} }
  const selectable = { id: 'ITEM-A', can_select: true }

  /* คลิกพื้นที่ว่างในแถว order เปิด/ย่อได้ทั้งแถว แต่ control ภายในยังทำงานของตัวเอง */
  w.expanded = {}
  w.selected = {}
  const originalRecompute = w.recompute
  let toggleRecomputeCalls = 0
  w.recompute = () => { toggleRecomputeCalls++; originalRecompute() }
  w.toggleOrderFromRow({ id: 'ORD-ROW' }, plainClick)
  assert.strictEqual(w.expanded['ORD-ROW'], true, 'clicking the order row opens its detail')
  assert.strictEqual(toggleRecomputeCalls, 0, 'expanding without a selection does not rebuild every row')
  w.selected = { 'ITEM-A': true }
  toggleRecomputeCalls = 0
  w.toggleOrderFromRow({ id: 'ORD-ROW' }, plainClick)
  assert.strictEqual(w.expanded['ORD-ROW'], false, 'clicking the row again closes its detail')
  assert.deepStrictEqual(w.selected, {}, 'opening or closing an order keeps the existing selection-safety rule')
  assert.strictEqual(toggleRecomputeCalls, 1, 'closing with a selection still rebuilds action state exactly once')
  const orderButtonClick = { target: { closest: selector => (selector.includes('button') ? {} : null) } }
  w.toggleOrderFromRow({ id: 'ORD-ROW' }, orderButtonClick)
  assert.strictEqual(w.expanded['ORD-ROW'], false, 'buttons inside the order row must not toggle it again')
  w.recompute = originalRecompute

  w.selectRow(selectable, plainClick)
  assert.strictEqual(w.selected['ITEM-A'], true, 'clicking the row picks it')
  w.selectRow(selectable, plainClick)
  assert.strictEqual(w.selected['ITEM-A'], undefined, 'clicking again unpicks it')

  /* แถวที่ส่งไปแล้วกดไม่ได้ */
  w.selectRow({ id: 'ITEM-B', can_select: false }, plainClick)
  assert.strictEqual(w.selected['ITEM-B'], undefined, 'a dispatched row must ignore the click')

  /* กดที่ checkbox เอง — el-checkbox ยิง toggleItem อยู่แล้ว แถวต้องไม่สลับซ้ำ */
  const insideCheckbox = { target: { closest: selector => (selector.includes('.el-checkbox') ? {} : null) } }
  w.selectRow(selectable, insideCheckbox)
  assert.strictEqual(w.selected['ITEM-A'], undefined, 'the checkbox owns its own click')

  /* กดปุ่ม/ลิงก์ในแถว ต้องไม่กลายเป็นการเลือกแถว */
  const insideButton = { target: { closest: selector => (selector.includes('button') ? {} : null) } }
  w.selectRow(selectable, insideButton)
  assert.strictEqual(w.selected['ITEM-A'], undefined, 'controls inside the row keep their click')

  /* เพิ่งลากเลือกข้อความไว้ (เช่นจะ copy เลข) — ปล่อยคลิกจบ ไม่สลับ */
  const realGetSelection = global.window && global.window.getSelection
  global.window = Object.assign({}, global.window, { getSelection: () => ({ toString: () => 'SM20260901CT001' }) })
  w.selectRow(selectable, plainClick)
  assert.strictEqual(w.selected['ITEM-A'], undefined, 'finishing a text selection must not toggle')
  if (realGetSelection) global.window.getSelection = realGetSelection
  else delete global.window
  w.selected = {}

  /* ── 1 order หลายเครื่อง ต้องโชว์ครบ ไม่ใช่แค่ของ item ตัวแรก ────────
     เคสจริงของผู้ใช้ 2026-09-01: ใบเดียวมี CT Fistulogram (CT) + Skull (DX)
     แต่แถวสรุปโชว์ CT ตัวเดียว ทำให้เข้าใจผิดว่าใบนี้ใช้เครื่องเดียว */
  {
    const mixed = w.buildRow({
      order_id: 'ORD-MIX',
      items: [
        { item_id: 'I1', item_name: 'CT Fistulogram', item_code: '44020',
          modality: { code: 'CT', label: 'CT-Computed Tomography' }, current_status: 'sent' },
        { item_id: 'I2', item_name: "Skull Towne's", item_code: 'RD021',
          modality: { code: 'DX', label: 'DX-Digital Radiography' }, current_status: 'sent' },
        { item_id: 'I3', item_name: 'Neck AP', item_code: 'RD015',
          modality: { code: 'DX', label: 'DX-Digital Radiography' }, current_status: 'sent' },
      ],
    })
    assert.deepStrictEqual(
      mixed.modalities,
      [{ code: 'CT', label: 'CT-Computed Tomography' }, { code: 'DX', label: 'DX-Digital Radiography' }],
      'every distinct modality shows, in item order, with no duplicates',
    )
    assert.deepStrictEqual(mixed.items.map(i => i.modality), ['CT', 'DX', 'DX'])
    assert.strictEqual(mixed.items[1].modality_label, 'DX-Digital Radiography')

    const empty = w.buildRow({ order_id: 'ORD-EMPTY', items: [] })
    assert.deepStrictEqual(empty.modalities, [], 'an order with no item shows no tag')
  }

  /* ── โหมดสแกน HN (ผู้ใช้ขอ 2026-09-02 · pattern เดียวกับ LAB) ────────── */
  {
    /* ตั้งช่วงวันที่และคำค้นไว้ก่อน เพื่อพิสูจน์ว่าสแกนแล้วทั้งคู่ต้องถูกตัดออก */
    s.setDates(['2026-08-01', '2026-08-31'])
    await flush()
    s.setSearch('เดิม')

    notes.length = 0
    calls.length = 0
    s.scanPatientHn('  HN-690-0002  ')
    await flush()
    assert.strictEqual(s.scanMode, true)
    assert.strictEqual(s.scannedHn, '6900002', 'only the digits survive')
    assert.strictEqual(s.filters.q, '', 'the old keyword is cleared so the two do not fight')

    /* Process ปัจจุบันคืนตารางและ chip ในคำขอเดียว; ทุก scope ต้องยังตรงกัน */
    assert.strictEqual(calls.length, 1, 'rows and chip counts reload together')
    assert(calls.every(c => c.params.hn === '6900002'), 'every request carries the scanned HN')
    assert(calls.every(c => !('date_from' in c.params) && !('date_to' in c.params)), 'no date scope while scanning')
    assert(calls.every(c => !('q' in c.params)), 'no keyword while scanning')
    assert(notes.some(note => note.includes('6900002')), 'the user is told what was found: ' + notes.join(' | '))

    /* เปลี่ยนแท็บสถานะแล้ว HN ต้องยังอยู่ */
    calls.length = 0
    s.setStatus('complete')
    await flush()
    assert.strictEqual(s.scanMode, true, 'the scanned patient survives a status change')
    assert.strictEqual(calls[0].params.hn, '6900002')
    assert.deepStrictEqual(calls[0].params.statuses, ['resulted', 'completed'])

    /* คีย์บอร์ดค้างโหมดไทย: เครื่องสแกนพิมพ์อักษรไทยตามผัง Kedmanee แทนตัวเลข
       HN 6900001 อ่านได้เป็น ุตจจจจๅ (ยืนยันจาก runtime ฝั่ง LAB 2026-09-02)
       ถ้าไม่แปลงกลับ จะโดนตัดเป็นค่าว่างแล้วขึ้นว่า HN ไม่ถูกต้องทุกครั้ง */
    s.clearScan()
    await flush()
    calls.length = 0
    s.scanPatientHn('ุตจจจจๅ')
    await flush()
    assert.strictEqual(s.scanMode, true, 'a Thai-keyboard scan must still work')
    assert.strictEqual(s.scannedHn, '6900001')
    assert.strictEqual(calls[0].params.hn, '6900001')

    /* สแกนเลขบัตร = เส้นทางแยกจาก HN; ไม่เผยเลขเต็มในข้อความแจ้ง */
    s.clearScan()
    await flush()
    calls.length = 0
    notes.length = 0
    s.scanPatientHn('1234567890123')
    await flush()
    assert.strictEqual(s.scanType, 'citizen_id')
    assert.strictEqual(s.scannedHn, '')
    assert.strictEqual(calls.length, 1, 'citizen ID reload also receives rows and counts together')
    assert(calls.every(c => c.params.citizen_id === '1234567890123'))
    assert(calls.every(c => !('hn' in c.params) && !('q' in c.params)),
      'citizen ID scans must not be sent as HN or ordinary text')
    assert(notes.some(note => note.includes('เลขบัตรประชาชน') && note.includes('0123')))
    assert(notes.every(note => !note.includes('1234567890123')), 'notifications must mask the citizen ID')

    /* ตัวเลขล้วนต้องไม่ถูกแตะ — '-' ใน barcode ปกติห้ามกลายเป็น 3 */
    assert.strictEqual(s.normalizeScanDigits('HN-6900002'), 'HN-6900002', 'plain ASCII is left alone')
    assert.strictEqual(s.normalizeScanDigits('ุตจจจจๅ'), '6900001')

    /* HN สั้นเกิน = ไม่เข้าโหมด และต้องบอกเหตุผล */
    s.clearScan()
    await flush()
    notes.length = 0
    calls.length = 0
    s.clearScan()
    await flush()
    notes.length = 0
    calls.length = 0
    s.scanPatientHn('123')
    assert.strictEqual(s.scanMode, false, 'a short code never enters scan mode')
    assert.strictEqual(calls.length, 0)
    assert(notes[0].includes('123'), 'and the message shows what was actually read: ' + notes[0])

    /* กด Search เอง = ออกจากโหมดสแกน */
    s.scanPatientHn('6900002')
    await flush()
    assert.strictEqual(s.scanMode, true)
    calls.length = 0
    s.applyFilters()
    await flush()
    assert.strictEqual(s.scanMode, false, 'pressing Search leaves scan mode')
    assert.strictEqual(s.scannedHn, '')
    assert(!('hn' in calls[0].params) || calls[0].params.hn !== '6900002')

    /* คืนสถานะให้เทสถัดไปทำงานต่อได้เหมือนเดิม (CLAUDE.md §14) */
    s.setSearch('')
    s.setDates([])
    await flush()
    s.setStatus('all')
    await flush()
  }

  /* ── ตารางผลอ่าน: สถานะเต็ม + ผู้ส่ง + สิทธิ์ PDF (ผู้ใช้ขอ 2026-09-02) ──
     ส่งเข้าเครื่องทีละรายการ รายการในใบเดียวกันจึงอยู่คนละขั้นได้
     ถ้าโชว์แค่ "รอผลอ่าน/ออกผลแล้ว" จะไม่รู้ว่าอันไหนยังไม่ได้ส่งเลย */
  {
    const mixedRow = w.buildRow({
      order_id: 'ORD-RT',
      items: [
        { item_id: 'A', item_name: 'Neck AP', current_status: 'sent',
          modality: { code: 'DX', label: 'DX' } },
        { item_id: 'B', item_name: 'Chest PA', current_status: 'dispatched',
          accession_no: 'SM20260902DX002', dispatched_at: '2026-09-02 09:00:00',
          dispatched_by: { first_name: 'เจ้าหน้าที่', last_name: 'รังสี' },
          modality: { code: 'DX', label: 'DX' } },
        { item_id: 'C', item_name: 'Skull', current_status: 'dispatched',
          accession_no: 'SM20260902DX003', dispatched_at: '2026-09-02 09:00:00',
          result_text: 'Normal.', resulted_at: '2026-09-02 10:00:00',
          modality: { code: 'DX', label: 'DX' } },
      ],
    })
    assert.deepStrictEqual(
      mixedRow.result_items.map(r => r.state_label),
      ['รอรับ', 'ส่งเครื่องแล้ว', 'ออกผลแล้ว'],
      'the result tab shows the real stage of each item',
    )
    assert.strictEqual(mixedRow.result_items[1].dispatched_by, 'เจ้าหน้าที่ รังสี')
    assert.strictEqual(mixedRow.result_items[0].dispatched_by, '', 'not dispatched yet stays visually blank')
    assert.deepStrictEqual(mixedRow.result_items.map(r => r.can_pdf), [false, false, true])
    assert(mixedRow.result_items[0].pdf_hint.includes('ออกผล'), mixedRow.result_items[0].pdf_hint)
    assert.deepStrictEqual(mixedRow.items.map(item => item.can_sticker), [true, true, true])
    assert(mixedRow.items[0].sticker_hint.includes('เว้นว่าง'))
    assert.strictEqual(w.itemStickerReady(mixedRow, mixedRow.items[1]), false, 'missing Visit ID fails closed')

    const scopedStickerRow = { ...mixedRow, emr: { visit_id: 'VISIT-STICKER-1' } }
    assert.strictEqual(w.itemStickerReady(scopedStickerRow, scopedStickerRow.items[0]), true, 'blank Accession remains printable')
    assert.strictEqual(w.itemStickerReady(scopedStickerRow, scopedStickerRow.items[1]), true)
    const stickerParams = w.itemStickerParams(scopedStickerRow, scopedStickerRow.items[1])
    assert.strictEqual(stickerParams.order_id, scopedStickerRow.id)
    assert.strictEqual(stickerParams.visit_id, 'VISIT-STICKER-1')
    assert.strictEqual(stickerParams.item_id, 'B')
    assert(/^\d{2}-\d{2}-\d{4}$/.test(stickerParams.printed_date), stickerParams.printed_date)
  }

  /* ── ช่องผู้รับรองผล — เก็บในหน้าจอ ล้างทุกครั้งที่เปิดใหม่ ───────────── */
  {
    w.setReportCertifier('  พ.ต. ผู้รับรอง  ')
    assert.strictEqual(w.report.certified_by, 'พ.ต. ผู้รับรอง', 'the name is trimmed')
    w.resetReport()
    assert.strictEqual(w.report.certified_by, '', 'closing the dialog clears it')
  }

  /* ── ผลอ่านจาก RIS เป็นตัวตัดสินสถานะ ไม่ใช่ current_status ────────────
     RIS เขียน zdata_xray_result ของมันเอง ไม่แตะ CPOE item ⇒ ถ้ารอสถานะจาก CPOE
     รายการจะค้างที่ "ส่งเครื่องแล้ว" ตลอดกาลทั้งที่ผลมาแล้ว */
  {
    const withResult = w.buildRow({
      order_id: 'ORD-RES',
      items: [{
        item_id: 'I1', item_name: 'Chest PA', item_code: 'XR-CHEST',
        modality: { code: 'DX', label: 'DX-Digital Radiography' },
        current_status: 'dispatched',
        accession_no: 'SM20260901DX001',
        dispatched_at: '2026-09-01 09:00:00',
        result_text: 'Normal chest radiograph.',
        resulted_at: '2026-09-01 10:30:00',
        result_versions: 1,
      }],
    })
    assert.strictEqual(withResult.items[0].status_label, 'ออกผลแล้ว', 'the RIS result wins over CPOE status')
    assert.strictEqual(withResult.status_label, 'ออกผลครบ')
    assert.strictEqual(withResult.has_result, true)
    assert.strictEqual(withResult.can_pdf, true)

    /* ── ส่งตรวจซ้ำแล้วต้องรอผลของรอบใหม่ (เจตนาเดิม · fixture ปรับ 2026-09-16) ──
       ของเดิมจำลองด้วย "เลข Accession เดิม + ผลเก่า + เลื่อน dispatched_at มาทีหลัง"
       แล้วพึ่งกติกาเทียบเวลาเป็นตัวตัดผลเก่าออก — ซึ่งเป็นพฤติกรรมก่อน 2026-09-03
       ตั้งแต่ 2026-09-03 ผู้ใช้สั่งให้ **ส่งตรวจซ้ำล้างเลขแล้วออกเลขใหม่** ⇒ ของจริง
       ผลรอบก่อนผูกกับเลขเดิม ไม่ถูก join เข้ามาตั้งแต่ต้น · กติกาเทียบเวลาจึงถูกถอน
       2026-09-16 (ผู้ใช้สั่ง) และ fixture นี้เปลี่ยนมาจำลองของจริง: เลขใหม่ ยังไม่มีผล
       **เจตนาที่เทสนี้ปกป้องไม่เปลี่ยน** — ส่งตรวจซ้ำแล้วต้องกลับไปรอผลของรอบตัวเอง
       ป้ายปุ่มอ่านจากรายการที่ติ๊กไว้ จึงต้องติ๊กก่อนถึงจะเห็นคำว่า "ส่งตรวจซ้ำ" */
    w.selected = { I1: true }
    const repeated = w.buildRow({
      order_id: 'ORD-RES',
      can_action: true,
      items: [{
        item_id: 'I1', item_name: 'Chest PA', item_code: 'XR-CHEST',
        modality: { code: 'DX', label: 'DX-Digital Radiography' },
        current_status: 'dispatched',
        /* เลขใหม่ที่ออกตอนกดส่งตรวจซ้ำ — ผลของรอบก่อนผูกกับ SM20260901DX001 */
        accession_no: 'SM20260901DX007',
        dispatched_at: '2026-09-01 14:00:00',
      }],
    })
    assert.strictEqual(
      repeated.items[0].status_label, 'ส่งเครื่องแล้ว',
      'a repeat exam waits for its own report again',
    )
    assert.strictEqual(repeated.has_result, false)
    assert.strictEqual(repeated.items[0].can_resend, true)
    assert.strictEqual(repeated.dispatch_label, 'ส่งตรวจซ้ำ')

    /* ยังไม่มีเลข = ยังส่งตรวจซ้ำไม่ได้ ต้องส่งเข้าเครื่องรอบแรกก่อน */
    w.selected = { I9: true }
    const fresh = w.buildRow({
      order_id: 'ORD-NEW',
      can_action: true,
      items: [{ item_id: 'I9', item_name: 'Neck AP', current_status: 'sent',
        modality: { code: 'DX', label: 'DX' } }],
    })
    assert.strictEqual(fresh.items[0].can_resend, false)
    assert.strictEqual(fresh.dispatch_label, 'ส่งเข้าเครื่อง')
    w.selected = {}
  }

  /* ผู้ใช้ยืนยัน 2026-09-18: ปุ่มเดิมส่งเฉพาะ item_ids ที่ติ๊ก; item พี่น้อง
     ที่ออกผลแล้วไม่ต้องขวาง item ที่เลือก และยังใช้ Process worklist เดิม */
  {
    w.selected = { 'ITEM-RIS': true }
    const sentToRis = w.buildRow({ order_id: 'ORD-RIS', can_action: true, items: [{ item_id: 'ITEM-RIS',
      item_name: 'Chest PA', current_status: 'dispatched', accession_no: 'SM20260901DX001' }] })
    assert.strictEqual(sentToRis.can_cancel, true)
    const mixed = w.buildRow({ order_id: 'ORD-MIX', can_action: true, items: [
      { item_id: 'ITEM-RIS', item_name: 'Chest PA', current_status: 'dispatched', accession_no: 'SM20260901DX001' },
      { item_id: 'ITEM-RESULT', item_name: 'CT', current_status: 'resulted', accession_no: 'SM20260901CT001' },
    ] })
    assert.strictEqual(mixed.can_cancel, true, 'resulted sibling does not block selected pre-result item')
    w.selected = { 'ITEM-RESULT': true }
    const resulted = w.buildRow({ order_id: 'ORD-RESULT', can_action: true, items: [{ item_id: 'ITEM-RESULT',
      item_name: 'Chest PA', current_status: 'resulted', accession_no: 'SM20260901DX002' }] })
    assert.strictEqual(resulted.can_cancel, false)
    w.selected = {}
    assert.strictEqual(w.buildRow({ order_id: 'ORD-RIS', can_action: true, items: [{ item_id: 'ITEM-RIS',
      current_status: 'dispatched', accession_no: 'SM20260901DX001' }] }).can_cancel, false,
    'empty selection disables cancellation')
  }
  notes.length = 0
  calls.length = 0
  await w.openCancelOrder({ id: 'ORD-1', can_action: true, order_no: 'R2609010003', can_cancel: false, cancel_hint: 'มีรายการที่ออกเลขแล้ว' })
  assert.strictEqual(w.cancelDialog.visible, false, 'an ineligible order must not open the dialog')
  assert(notes[0].includes('ออกเลข'), 'and it says why: ' + notes[0])

  await w.openCancelOrder({ id: 'ORD-1', can_action: true, order_no: 'R2609010003', can_cancel: true,
    items: [{ id: 'ITEM-ORD-1', name: 'Chest PA', selected: true }] })
  assert.strictEqual(w.cancelDialog.visible, true)
  assert.strictEqual(w.cancelDialog.order_no, 'R2609010003')
  assert.deepStrictEqual(w.cancelDialog.item_ids, ['ITEM-ORD-1'])
  assert.strictEqual(w.cancelDialog.financeChecked, true)
  assert.strictEqual(w.cancelDialog.canCancel, true)
  assert.strictEqual(w.cancelDialog.reasonLoading, false)
  assert.strictEqual(w.cancelDialog.reason_options.length, 4)

  /* เหตุผลว่าง = ห้ามยิง */
  notes.length = 0
  calls.length = 0
  await w.submitCancelOrder()
  assert.strictEqual(calls.length, 0, 'an empty reason must not reach the API')
  assert(notes[0].includes('เหตุผล'))

  w.setCancelReasonCode('PHYSICIAN_CANCELLED')
  w.setCancelReasonDetail('  ตามคำสั่งแพทย์  ')
  assert.strictEqual(w.cancelDialog.reason_label, 'แพทย์ยกเลิกคำสั่ง')
  assert.strictEqual(w.cancelDialog.reason_detail, 'ตามคำสั่งแพทย์', 'the detail is trimmed')

  notes.length = 0
  calls.length = 0
  cancelReply = { success: true, data: { cancelled_item_count: 2, audit_sync_pending: false }, message: 'ยกเลิก Order แล้ว' }
  await w.submitCancelOrder()
  const cancelCall = calls.find(call => call.params && call.params.action === 'cancel_order')
  assert(cancelCall, 'cancel goes through the worklist Process, no new Process ID')
  assert.strictEqual(cancelCall.id, TEST_PROCESS_ID)
  assert.strictEqual(cancelCall.params.order_id, 'ORD-1')
  assert.strictEqual(cancelCall.params.order_number, 'R2609010003')
  assert.deepStrictEqual(cancelCall.params.item_ids, ['ITEM-ORD-1'])
  assert.strictEqual(cancelCall.params.cancel_reason, 'แพทย์ยกเลิกคำสั่ง — ตามคำสั่งแพทย์')
  assert.strictEqual(cancelCall.params.cancel_reason_code, 'PHYSICIAN_CANCELLED')
  assert.strictEqual(cancelCall.params.cancel_reason_detail, 'ตามคำสั่งแพทย์')
  assert.strictEqual(w.cancelDialog.visible, false, 'a successful cancel closes the dialog')
  assert(notes.some(note => note.includes('ยกเลิก Order แล้ว')))

  /* API Order รับแล้วแต่ RIS ยัง 401: ปิด dialog และแสดงคำเตือน upstream */
  notes.length = 0
  await w.openCancelOrder({ id: 'ORD-1', can_action: true, order_no: 'R2609010003', can_cancel: true,
    items: [{ id: 'ITEM-ORD-1', name: 'Chest PA', selected: true }] })
  w.setCancelReasonCode('PHYSICIAN_CANCELLED')
  cancelReply = { success: true, data: { upstream_delivery_issue: true },
    message: 'ยกเลิกแล้ว · API Order รับคำขอแล้ว แต่ RIS ยัง HTTP 401' }
  await w.submitCancelOrder()
  assert.strictEqual(w.cancelDialog.visible, false)
  assert(notes.some(note => note.includes('HTTP 401')))

  /* server ปฏิเสธ = dialog ต้องเปิดค้างไว้พร้อมเหตุผล ผู้ใช้จะได้ไม่ต้องพิมพ์ใหม่ */
  notes.length = 0
  await w.openCancelOrder({ id: 'ORD-1', can_action: true, order_no: 'R2609010003', can_cancel: true,
    items: [{ id: 'ITEM-ORD-1', name: 'Chest PA', selected: true }] })
  w.setCancelReasonCode('WRONG_PATIENT')
  cancelReply = { success: false, message: 'รายการ RD015 ออกเลข Accession SM20260901DX001 และส่งเข้า RIS ไปแล้ว' }
  await w.submitCancelOrder()
  assert.strictEqual(w.cancelDialog.visible, true, 'a refused cancel keeps the dialog open')
  assert.strictEqual(w.cancelDialog.loading, false)
  assert.strictEqual(w.cancelDialog.reason_label, 'สั่งผิดคน', 'and keeps the selected master reason')
  assert(notes.some(note => note.includes('SM20260901DX001')), 'the real reason reaches the user')
  w.cancelDialog = w.emptyCancelDialog()

  /* ── ปฏิเสธระดับ item ────────────────────────────────────────────────
     Process/ฟอร์มมี ID จริงแล้ว ⇒ ต้องเปิดฟอร์มหลักฐานก่อนเรียก Process */
  notes.length = 0
  calls.length = 0
  const openedBeforeReject = opened.length
  await w.rejectSelected({ id: 'ORD-1', can_action: true, order_no: 'R2609010003', hn: '6900001', name: 'น.ส. ดำ ใจดี',
    items: [{ id: 'ITEM-A', name: 'Chest PA', code: 'RD001', modality: 'DX', can_reject: true }],
    selected_item_id: 'ITEM-A' })
  assert.strictEqual(opened.length, openedBeforeReject + 1, 'reject must open the evidence form')
  assert.strictEqual(opened.at(-1)[0], '6ad4ace5481c196fbb338fe4')
  assert.strictEqual(opened.at(-1)[4].params.reason_options.length, 4)

  notes.length = 0
  w.rejectSelected({ id: 'ORD-1', can_action: true, selected_item_id: '', items: [] })
  assert(notes[0].includes('1 รายการ'), 'no pick ⇒ ask for exactly one')

  /* รับไว้แล้วแต่ RIS ไม่รับ — ต้องเตือน ไม่ใช่บอกว่าสำเร็จ */
  notes.length = 0
  dispatchReply = { success: true, transport: { status: 'failed', error: 'Missing required field(s): Hn' }, message: 'รับรายการแล้วแต่ส่งเข้า RIS ไม่สำเร็จ — กดส่งใหม่ได้' }
  await w.dispatchOrder(rowWithSelection)
  assert(notes.some(note => note.includes('กดส่งใหม่ได้')), 'a partial success must not read as success')

  /* ล้มตั้งแต่ต้น — ข้อความจาก API ต้องขึ้นตรงตัว */
  notes.length = 0
  notes.length = 0
  calls.length = 0
  w.selected = { 'ITEM-A': true }
  dispatchReply = { success: false, message: 'รายการนี้ยังไม่มีเครื่องผูกไว้ใน master' }
  await w.dispatchOrder(rowWithSelection)
  assert(notes.some(note => note.includes('item master') || note.includes('master')))
  /* ล้มก่อนแตะข้อมูล = อย่าล้างที่ติ๊กและอย่า reload ให้เสียเวลาผู้ใช้ */
  assert.deepStrictEqual(w.selected, { 'ITEM-A': true }, 'a refusal must keep the selection')
  assert(
    !calls.some(call => call.params && call.params.action === 'list'),
    'a refusal must not reload the list — nothing changed',
  )
  w.selected = {}
  dispatchReply = { success: true, accession_no: 'SM20260901CT001', transport: { status: 'ok' }, message: 'ส่งเข้าเครื่องแล้ว' }

  /* ถ้า Process ID ถูกล้างออก ปุ่มต้องบอกว่าต้องไปตั้งค่าที่ไหน ไม่ยิงมั่ว */
  notes.length = 0
  calls.length = 0
  const unwired = {
    vueState: {},
    globalUserState: { user: { unit: { code: '10' } }, runProcess },
    getFormRef: () => ({}),
    notify: message => notes.push(message),
  }
  new Function(widget.onCreated.replace("const DISPATCH_PROCESS_ID='" + DISPATCH_PROCESS_ID + "'", "const DISPATCH_PROCESS_ID=''")).call(unwired)
  await unwired.vueState.dispatchOrder(rowWithSelection)
  assert.strictEqual(calls.length, 0, 'without a Process ID nothing may be sent')
  assert(notes[0].includes('DISPATCH_PROCESS_ID'), 'the form says exactly what is missing')

  /* API ส่ง primary_dx ดิบมาเป็น {value:<ICD>, label:<ชื่อโรค>} เหมือน LAB */
  assert.strictEqual(
    s.diagnosisText({ diagnosis: { value: 'J18.9', label: 'Pneumonia, unspecified organism' } }),
    'Pneumonia, unspecified organism',
    'the label is what a person reads',
  )
  assert.strictEqual(
    s.diagnosisText({ diagnosis: { value: 'J18.9', label: '' } }),
    'J18.9',
    'no label ⇒ fall back to the ICD code rather than showing nothing',
  )
  assert.strictEqual(s.diagnosisText({ diagnosis: null }), '', 'no diagnosis is empty, not a guess')
  assert.strictEqual(s.diagnosisText({ diagnosis: 'Asthma' }), 'Asthma', 'a plain string still works')

  const dxRow = s.buildRow({
    order_id: 'ORD-DX',
    items: [],
    diagnosis: { value: 'J18.9', label: 'Pneumonia, unspecified organism' },
  })
  assert.strictEqual(dxRow.dx_full, 'Pneumonia, unspecified organism')
  assert.strictEqual(
    dxRow.dx_short,
    'Diagnosis: Pneumonia, unspecified organism',
    'the full text goes to the DOM; CSS truncates',
  )
  assert.strictEqual(dxRow.dx_has, true)
  const noDxRow = s.buildRow({ order_id: 'ORD-NODX', items: [] })
  assert.strictEqual(noDxRow.dx_has, false, 'no tooltip when there is nothing to show')
  /* ไม่มีค่า = แสดงแค่ "Diagnosis:" (ผู้ใช้ขอ 2026-09-02 · เหมือน LAB)
     ข้อความ "รอเชื่อม EMR" เดิมทำให้เข้าใจผิดว่าระบบยังไม่ได้ต่อ EMR */
  assert.strictEqual(noDxRow.dx_short, 'Diagnosis: ')
  assert(!noDxRow.dx_short.includes('รอเชื่อม EMR'), 'the misleading placeholder is gone')

  /* deep link */
  s.resetScan()
  s.filters = { ...s.filters, q: '' }
  const createOrderOpenIndex = opened.length
  await s.openCreateOrder()
  /* ปุ่ม "สร้างรายการใหม่" เปิดฟอร์มตาม CPOE_ORDER_APP_ID ที่ generate มา — ตั้งค่าได้ด้วย env
     XRAY_CPOE_ORDER_APP_ID เพื่อสลับไปฟอร์มโคลนที่มีช่องเลือก VN (ผู้ใช้ขอ 2026-09-03)
     เทสไม่ผูกกับเลขตายตัว ไม่งั้นวันที่สลับฟอร์ม เทสจะแดงทั้งที่ตั้งใจเปลี่ยน */
  const cpoeAppId = (widget.onCreated.match(/const CPOE_ORDER_APP_ID='([a-f0-9]{24})'/) || [])[1]
  assert(cpoeAppId, 'ปุ่มต้องถือ Form ID 24 ตัวอักษรเสมอ — ว่างแล้วกดไม่เกิดอะไร')
  assert.strictEqual(opened[createOrderOpenIndex][0], cpoeAppId)
  assert.strictEqual(opened[createOrderOpenIndex][4].params.source, 'xray-worklist')
  assert.strictEqual(opened[createOrderOpenIndex][4].params.xray_scope, true)
  assert.strictEqual(opened[createOrderOpenIndex][4].params.order_id, undefined, 'Create New must never reopen the parent Order')
  assert.strictEqual(opened[createOrderOpenIndex][4].params.xsitex, 'SITE-1', 'non-Order host context remains intact')
  assert.strictEqual(typeof opened[createOrderOpenIndex][4].params.on_order_sent, 'function')
  /* ฟอร์มโคลนใช้ค่านี้เลือกโหมด — ขาดไปจะกลายเป็นจอที่ไม่มีคนไข้และเลือก VN ไม่ได้ */
  assert.strictEqual(opened[createOrderOpenIndex][4].params.manual_visit, true)
  /* EMR History — ทรงเดียวกับ LAB ที่ใช้งานได้จริง (ผู้ใช้ยืนยัน 2026-09-01)
     arg ที่ 3 ต้องเป็น '' · visit_id เดินทางไปทาง params ไม่ใช่ dataId */
  s.openEmr({ emr: { visit_id: 'VISIT-ORD-1' } })
  const emrOpen = opened[createOrderOpenIndex + 1]
  assert.strictEqual(emrOpen[0], '6a96557e422c1ca959829eae', 'the EMR History form')
  assert.strictEqual(emrOpen[2], '', 'visit_id must not be passed as the dataId')
  assert.strictEqual(emrOpen[4].params.visit_id, 'VISIT-ORD-1')
  assert.strictEqual(emrOpen[4].params.source, 'xray-worklist')
  assert.strictEqual(emrOpen[4].params.xray_deep_link, true)
  assert.strictEqual(emrOpen[4].readonly, true)
  assert.strictEqual(emrOpen[4].popupType, 'dialog')

  /* ไม่มี Visit ID = ไม่เปิด แล้วบอกเหตุผล */
  notes.length = 0
  s.openEmr({ emr: {} })
  assert.strictEqual(opened.length, createOrderOpenIndex + 2, 'nothing opens without a visit')
  assert(notes[0].includes('EMR History'))

  /* เพิ่มบริบท HN แบบ LAB โดยคงทางเปิด manual เดิมไว้เมื่อไม่มี HN */
  openVisitReply = { success: true, data: { hn: '6900040', visit: {
    _id: 'VISIT-6900040', vn: '6900231', visit_date: '2026-09-17 09:00:00',
    pid: { value: 'PERSON-40', hn: '6900040', prename: 'น.ส.', p_fname: 'ตัวอย่าง', p_lname: 'ทดสอบ', p_gender: '2' },
    inscl_hos: [{ inscl_item_main: { value: 'OFC' } }],
  } } }
  s.filters = { ...s.filters, q: 'HN 6900040' }
  await s.openCreateOrder()
  const typedOpen = opened[createOrderOpenIndex + 2]
  assert.strictEqual(typedOpen[4].params.xsitex, 'SITE-1')
  assert.strictEqual(typedOpen[3], null, 'patient context travels in params')
  assert.strictEqual(typedOpen[4].params.hn, '6900040')
  assert.strictEqual(typedOpen[4].params.vn, '6900231')
  assert.strictEqual(typedOpen[4].params.visit_id, 'VISIT-6900040')
  assert.strictEqual(typedOpen[4].params.full_name, 'น.ส. ตัวอย่าง ทดสอบ')
  assert.strictEqual(typedOpen[4].params.sex, 'หญิง')
  assert(calls.some(c => c.params.action === 'resolve_open_visit' && c.params.hn === '6900040'))

  s.scanPatientHn('6900040')
  await s.openCreateOrder()
  assert.strictEqual(opened[createOrderOpenIndex + 3][4].params.hn, '6900040', 'scanned HN uses the same Visit')
  s.scanPatientHn('1234567890123')
  await s.openCreateOrder()
  assert.strictEqual(opened[createOrderOpenIndex + 4][4].params.hn, '6900040', 'citizen scan resolves HN before opening')
  assert(calls.some(c => c.params.action === 'resolve_open_visit' && c.params.citizen_id === '1234567890123'))

  openVisitReply = { success: true, data: { hn: '6900999', visit: null } }
  s.resetScan()
  s.filters = { ...s.filters, q: '6900999' }
  await s.openCreateOrder()
  assert.strictEqual(opened.length, createOrderOpenIndex + 5, 'no open VN must not launch CPOE')
  // 2026-09-17: this specific warning uses a compact in-form banner because the
  // initCraft notify wrapper renders its numeric duration as a visible heading.
  assert.strictEqual(s.createOrderNotice, 'HN 6900999 ยังไม่ได้เปิด VN วันนี้')
  assert(widget.content.includes('v-if="createOrderNotice"') && widget.content.includes('role="alert"'))
  assert(css.includes('.xr-create-notice') && css.includes('border:0;border-radius:6px;background:rgba(245,108,108,.2)'), 'borderless banner uses translucent cancel-order red')
  assert(css.includes('.dark .xray-cpoe .xr-create-notice{color:#ffe0e0}'), 'dark-mode banner text stays readable')
  assert(!notes.some(n => n.includes('HN 6900999 ยังไม่ได้เปิด VN วันนี้')), 'no duplicate native notification')
  assert(s.__createOrderNoticeTimer, 'banner schedules automatic dismissal')
  s.dismissCreateOrderNotice()
  assert.strictEqual(s.createOrderNotice, '', 'banner can be dismissed')
  assert.strictEqual(s.__createOrderNoticeTimer, null)
  assert.strictEqual(s.createOrderLoading, false)
  openVisitReply = { success: true, data: { orders: [] } }
  await s.openCreateOrder()
  assert.strictEqual(opened.length, createOrderOpenIndex + 5, 'old Process must not open CPOE with missing patient context')
  assert(notes.some(n => n.includes('resolve_open_visit') && n.includes('replace body')))
  s.filters = { ...s.filters, q: 'ชื่อผู้ป่วย' }
  await s.openCreateOrder()
  assert.strictEqual(opened[createOrderOpenIndex + 5][4].params.manual_visit, true, 'other searches retain the VN picker')

  /* ถ้า Process ID ถูกล้างออก ฟอร์มต้องเตือน ไม่ใช่หมุนค้าง */
  const blank = { vueState: {}, globalUserState: { user: { unit: { code: '10' } }, runProcess }, getFormRef: () => ({}), notify: () => {} }
  new Function(widget.onCreated.replace("'" + TEST_PROCESS_ID + "'", "''")).call(blank)
  assert(blank.vueState.view.configWarning.includes('WORKLIST_PROCESS_ID'))
  blank.vueState.loadOrders()
  await flush()
  assert.strictEqual(blank.vueState.loading, false)
  assert(blank.vueState.errorMessage.includes('Process ID'))

  /* ── คิวห้องรังสี (เพิ่ม 2026-09-08) ───────────────────────────────────────
   ผู้ใช้สั่ง: "จากตอนแรก ถ้ามีการสั่ง → เข้าห้องเลย เปลี่ยนเป็นเข้าคิวก่อน"
   และ "ปุ่ม xray กดปุ๊บ จะเด้งมาที่ tab xray … แบบแค่กาง order ให้ดู" */
/* 🔴 2026-09-27 เลิกอ้าง pane ด้วยเลข index — ผู้ใช้ย้ายแท็บสืบค้นผลแลปไปท้ายสุด
   แล้วเลขเลื่อนทั้งแถว · หาด้วยชื่อ pane แทน เพื่อให้เทสยังปกป้องสิ่งเดิม
   (วิดเจ็ตคิวถูกตัวและรูปร่าง node ตรงแม่แบบ) โดยไม่ผูกกับลำดับที่ผู้ใช้สั่งย้ายได้ */
/* Historical assertions for the retired custom Vue queue are kept as a
   readable migration record, but the active contract below validates the
   native EMR button-ui/list-ui panes. */
if (false) {
const paneWidget = name => {
  const pane = tabRoot.tabs.filter(p => p.options.name === name)[0]
  assert(pane, 'missing tab pane ' + name)
  return pane.fields[0].cols[0].fields[0]
}
const unitQueue = paneWidget('xray_tab_unit')
const roomQueue = paneWidget('xray_tab_room')
const doneQueue = paneWidget('xray_tab_done')
assert.strictEqual(unitQueue.options.name, 'xray_queue_unit')
assert.strictEqual(roomQueue.options.name, 'xray_queue_room')
assert.strictEqual(doneQueue.options.name, 'xray_queue_done')
/* วิดเจ็ตคิวต้องมีรูปร่าง node เท่าแม่แบบเดียวกับตาราง ไม่ใช่ node ที่ประดิษฐ์เอง */
assert.deepStrictEqual(Object.keys(unitQueue), Object.keys(templateNode))
assert.deepStrictEqual(Object.keys(unitQueue.options), Object.keys(templateNode.options))
assert.deepStrictEqual(Object.keys(roomQueue.options), Object.keys(templateNode.options))
assert.deepStrictEqual(Object.keys(doneQueue.options), Object.keys(templateNode.options))
assert(doneQueue.options.onCreated.includes("const BUCKET='done'"))

/* Unit Queue เรียกคิวถัดไปผ่าน Process กลาง; ไม่มี action รายแถวของ X-ray */
assert(unitQueue.options.content.includes('เรียกคิวถัดไป'), 'unit queue exposes central call-next')
assert(unitQueue.options.onCreated.includes("const BUCKET='unit'"))
assert(roomQueue.options.onCreated.includes("const BUCKET='room'"))
assert(unitQueue.options.onCreated.includes("const CENTRAL_CALL_PROCESS_ID='6a4b942bac48023662b1b42a'"))
assert(!unitQueue.options.onCreated.includes("action:'queue_call'"), 'no X-ray queue call action remains')
assert(unitQueue.options.onCreated.includes("action:'queue'"))
for (const queue of [unitQueue, roomQueue, doneQueue]) {
  assert(queue.options.onMounted.includes('s.connectRealtime()'), 'every mounted queue subscribes to central Visit Tran')
  assert(queue.options.onUnmount.includes('s.disconnectRealtime()'), 'the central queue subscription is cleaned up')
}

/* 🔴 ปุ่ม X-ray "แค่กาง order" — ห้ามยิง dispatch หรือเปลี่ยนสถานะใด ๆ
   (ต่างจากปุ่ม EMR ของฟอร์มต้นแบบที่ stamp เริ่มตรวจ · ผู้ใช้ยืนยัน 2026-09-08) */
assert(roomQueue.options.onCreated.includes('form.$xrayQueueTarget=target'), 'deep link is stashed for the lazy tab')
assert(roomQueue.options.onCreated.includes("tab.activeTabName=XRAY_PANE"))
/* ตรวจ "โค้ดจริง" ไม่ใช่คอมเมนต์ — คอมเมนต์ในไฟล์อธิบายไว้ว่าห้ามแตะ current_status
   ถ้าไม่ตัดคอมเมนต์ทิ้งก่อน assertion จะไปเจอคำในคอมเมนต์แล้วแดงทั้งที่โค้ดถูก */
const codeOnly = source => String(source).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const roomCode = codeOnly(roomQueue.options.onCreated)
assert(!roomCode.includes("action:'dispatch'"), 'the X-ray button must never dispatch')
assert(!roomCode.includes('current_status'), 'the X-ray button must never touch order status')
/* คิวสองแท็บใช้โค้ดก้อนเดียวกัน ต่างกันที่ BUCKET — ปุ่มจึงถูกแยกด้วย v-if ในเทมเพลต
   ไม่ใช่ด้วยการมี/ไม่มีฟังก์ชัน · ตรวจที่เทมเพลตว่ากั้นถูกฝั่ง */
assert(!roomQueue.options.content.includes('callVisit(row)'), 'there is no per-row queue claim')
assert(roomQueue.options.content.includes('@click="callNextQueue"'), 'the header owns central FIFO calling')
/* เปลี่ยนโครงตรงนี้ 2026-09-08 ตอนเพิ่มปุ่มส่งต่อ: ฝั่ง else เดิมเป็นปุ่มเดี่ยว
   ตอนนี้เป็น <template v-else> ที่ถือ X-ray + ส่งต่อ · สิ่งที่ assertion เดิม
   ปกป้องคือ "ฝั่งที่ไม่ใช่ Unit Queue ต้องได้ปุ่ม X-ray" ซึ่งยังตรวจอยู่ครบ */
assert(roomQueue.options.content.includes('<template v-else>'), 'the non-unit buckets share the other branch')
assert(roomQueue.options.content.includes('@click="goXray(row)"'), 'and My Room shows the X-ray button')

/* ฝั่งตาราง: อ่าน deep link ก่อนโหลดครั้งแรก และกรองด้วย visit_id แบบ exact */
assert(widget.onMounted.includes('$xrayQueueTarget'), 'the worklist consumes the stashed deep link')
assert(widget.onCreated.includes('p.visit_id=s.focusVisitId'), 'focus mode filters by exact visit_id')
assert(widget.onCreated.includes('s.focusVisit='))
assert(widget.onCreated.includes('s.clearFocusVisit='), 'the user can always get back to the full list')
assert(widget.content.includes('clearFocusVisit'), 'and the banner exposes that escape hatch')
/* 2026-10-18: ผู้ใช้สั่งตัด VN/วันที่/เพศ/อายุ/เลือด/โทรศัพท์ออกจากแบนเนอร์คิว */
assert(widget.content.includes("HN{{ focusVisitHn || '-' }}"), 'the queue banner shows HN')
assert(widget.content.includes("{{ focusVisitPatientName || '' }}"), 'the queue banner shows the patient name')
assert(!widget.content.includes("VN {{ focusVisitVn || '-' }}"), 'the queue banner no longer renders the verbose VN label')
assert(widget.onMounted.includes('s.focusVisitHn=s.text(pending.hn)'), 'the lazy-mounted worklist keeps the queue HN')
assert(widget.onMounted.includes('s.focusVisitPatientName=s.text(pending.patient_name)'), 'and keeps the queue patient name')
/* โหลดครั้งแรกของ deep link ต้องยิงรอบเดียว — ไม่ใช่โหลดทั้งหมดก่อนแล้วโหลดซ้ำ */
assert(widget.onMounted.includes('if(s.__initialLoadStarted)s.loadOrders();'))
assert(widget.onCreated.includes('if(!countsReady)s.refreshCounts();'), 'legacy Process keeps the split-count fallback')

/* สแกน HN ต้องใช้ได้จากทุกแท็บ — ต้องสลับมาแท็บ X-ray ก่อนเรียก widget ที่ lazy mount */
const scanHandler = form.fields[1].options.onScan
assert(scanHandler.includes("getFieldRef('xray_app')"), 'the scanner switches tabs before reaching the worklist')
assert(scanHandler.includes("tab.activeTabName='xray_tab_worklist'"))
assert(scanHandler.includes('state.scanPatientHn(raw)'), 'and still hands the raw code to the worklist')
/* เครื่องสแกนฟังทั้ง document: LAB setSearch เป็นเจ้าของค่าที่พิมพ์/วาง และ marker
   ต้องเป็น one-shot เพื่อให้สแกนจริงครั้งถัดไปนอก LAB ยังเข้า X-ray ตามเดิม */
{
  const tab = { activeTabName: 'xray_tab_worklist' }
  const runtimeForm = {
    showPopupFlag: false,
    $xraySearchOwner: '',
    $xraySearchValue: '',
    $xraySearchOwnerAt: 0,
    getFieldRef: name => name === 'xray_cpoe_worklist'
      ? { vueState: s }
      : (name === 'xray_app' ? tab : null),
  }
  const scanner = new Function('value', scanHandler)
  const scannerContext = {
    getFormRef: () => runtimeForm,
    notify: message => notes.push(message),
  }
  tab.activeTabName = 'xray_tab_lab_lookup'
  runtimeForm.$xraySearchOwner = 'lab'
  runtimeForm.$xraySearchValue = '6900031'
  runtimeForm.$xraySearchOwnerAt = Date.now()
  calls.length = 0
  scanner.call(scannerContext, '6900031')
  await flush()
  assert.strictEqual(calls.length, 0, 'LAB input must never call the X-ray worklist Process')
  assert.strictEqual(s.scanMode, false, 'LAB input must never enter X-ray scan mode')
  assert.strictEqual(tab.activeTabName, 'xray_tab_lab_lookup', 'LAB input must never switch tabs')
  assert.strictEqual(runtimeForm.$xraySearchOwner, '', 'the LAB ownership marker is consumed once')

  tab.activeTabName = 'xray_tab_lab_lookup'
  calls.length = 0
  scanner.call(scannerContext, '6900002')
  await flush()
  assert.strictEqual(tab.activeTabName, 'xray_tab_worklist', 'the next real scan outside LAB still opens the X-ray worklist')
  assert.strictEqual(s.scanMode, true, 'the next real scan outside LAB still uses the HN scan flow')
  assert(calls.length > 0 && calls.every(call => call.params.hn === '6900002'))
  s.clearScan()
  await flush()
  s.setSearch('')
}


/* ── ปุ่ม "ส่งต่อ" ใน My Room (เพิ่ม 2026-09-08 ตามคำสั่งผู้ใช้) ────────────
   ยกมาจากปุ่มเดียวกันของฟอร์ม EMR — ต้องใช้ฟอร์ม/Process ตัวเดิม ไม่สร้างใหม่ */
assert(roomQueue.options.content.includes('@click="forwardVisit(row)"'), 'My Room gained the forward button')
assert(roomQueue.options.content.includes('v-if="isRoom"'), 'and only My Room shows it')
assert(roomCode.includes("const MOVE_FORM_ID='6a4f828d22f95f21b606d9a2'"), "EMR's own move form, not a new one")
assert(roomCode.includes("const ORDER_DEST_PROCESS_ID='6a75820bb902d8cb04375f69'"), "and EMR's cpoe-order-dest")
/* ลำดับ prefill ต้องเหมือน EMR: consult ก่อน แล้วค่อยเดาจากใบสั่งยา */
assert(roomCode.includes('ctx.consult_id=ci.consult_id'), 'consult keeps priority over the drug-order guess')
assert(roomCode.includes('ใบสั่งยา '), 'and the drug-order fallback note is kept')
/* 🔴 ต้นฉบับเป็น sync handler — ใช้ await แล้วปุ่มจะพัง */
assert(!/forwardVisit=async/.test(roomCode), 'the forward handler must stay synchronous like EMR\'s')
/* ส่งต่อไม่ได้ต้องบอกเหตุผล ไม่ใช่เปิดฟอร์มที่ไม่มี tran_id */
assert(roomQueue.options.content.includes(':disabled="!row.tran_id"'), 'no visit_tran row, no forwarding')
assert(roomCode.includes('s.forwardHint='))

/* ── แท็บ Completed อ่านสถานะคิวกลางอย่างเดียว ───────────────────────────── */
const doneCode = codeOnly(doneQueue.options.onCreated)
assert(!doneCode.includes("action:'queue_done'"), 'X-ray does not close a parallel queue')
assert(doneCode.includes('s.isDone=BUCKET===\'done\''))
assert(roomCode.includes('afterSaveCallback:()=>{'), 'the Move Unit form refreshes after its central save')
assert(!roomCode.includes('s.closeQueue(row)'))
assert(!doneCode.includes('current_status'), 'queue display must not touch order status')
assert(!doneCode.includes("action:'dispatch'"))
}

const nativePane = name => {
  const pane = tabRoot.tabs.find(item => item.options && item.options.name === name)
  assert(pane, 'missing native queue pane ' + name)
  return pane
}
const nativeField = (pane, name) => {
  const field = pane.fields.find(item => item.options && item.options.name === name)
  assert(field, 'missing native queue field ' + name)
  return field
}
const nativeUnit = nativePane('xray_tab_unit')
const nativeRoom = nativePane('xray_tab_room')
const nativeDone = nativePane('xray_tab_done')
const nativeUnitList = nativeField(nativeUnit, 'visit_unit')
const nativeRoomList = nativeField(nativeRoom, 'visit_room')
const nativeDoneList = nativeField(nativeDone, 'visit_done')

/* 2026-10-15: UI-only alignment with current EMR My Room.  Keep the action
   handlers intact while matching its bottom spacing and orange Check-in. */
const nativeRoomActions = nativeField(nativeRoom, 'xray_room_actions_grid')
const nativeRoomActionFields = nativeRoomActions.cols.flatMap(col => col.fields || [])
const nativeCallNext = nativeRoomActionFields.find(field => field.options && field.options.name === 'btn_room')
const nativeCheckin = nativeRoomActionFields.find(field => field.id === 'button-ui-xray-room-checkin')
assert(nativeCallNext, 'My Room keeps the EMR call-next action')
assert(nativeCheckin, 'My Room keeps the EMR Check-in action')
assert.deepStrictEqual(nativeCallNext.options.customClass, ['mb15'])
assert.deepStrictEqual(nativeCheckin.options.customClass, ['mb15'])
assert(form.formConfig.cssCode.includes('.mb15{\n  margin-bottom: 15px\n}'), 'EMR My Room spacing ships with X-ray')
assert.strictEqual(nativeCheckin.options.buttons[0].type, 'warning')
assert.strictEqual(nativeCheckin.options.buttons[0].plain, true)
assert.strictEqual(nativeCheckin.options.buttons[0].color, '', 'no inherited purple custom color may override warning')
assert.strictEqual(nativeCheckin.options.buttons[0].label, 'Check-in')
assert(nativeCheckin.options.buttons[0].onClick.includes("const CHECKIN_FORM = '6ac9f156481c196fbb330cab';"))
assert(nativeCheckin.options.buttons[0].onClick.includes('afterSaveCallback: (saved, autoSave) => {'))

assert.strictEqual(nativeUnitList.component, 'list-ui')
assert.strictEqual(nativeRoomList.component, 'list-ui')
assert.strictEqual(nativeDoneList.component, 'list-ui')
/* 2026-10-13: changed by user-confirmed current EMR behavior. Unit Queue no
   longer has a header call-next button; its per-row "เรียก" action remains. */
assert.deepStrictEqual(nativeUnit.fields.map(field => field.component), ['list-ui'])
assert(!nativeUnit.fields.some(field => field.component === 'button-ui'))
assert.strictEqual(nativeUnitList.options.formId, '6a461235e521219e514d1c4b')
assert(nativeUnitList.options.where.includes("COALESCE(`room_to.value`, 'FRONT')"))
assert(nativeRoomList.options.where.includes("CASE WHEN :xroom_codex = '__NONE__' THEN 'FRONT' ELSE :xroom_codex END"))
assert(nativeDoneList.options.where.includes("vtran_status = 'done'"))
/* 2026-10-18: ผู้ใช้สั่งลบ action “ซักประวัติ” ออกจาก X-ray Unit Queue;
   ตรึง action ที่เหลือและลำดับเดิมแบบ exact เพื่อกัน regression */
assert.deepStrictEqual(nativeUnitList.options.buttonsRow.map(button => button.label), ['เรียก', 'ย้ายห้อง', 'ส่งต่อ'])
/* 2026-10-15: เปลี่ยนตามคำสั่งผู้ใช้และภาพ My Room — ลบเฉพาะ “ซักประวัติ”
   โดยตรึง action ที่เหลือแบบ exact เพื่อไม่ให้ปุ่มอื่นหายหรือสลับลำดับ */
assert.deepStrictEqual(nativeRoomList.options.buttonsRow.map(button => button.label), ['X-ray', 'ข้าม/เรียกกลับ', 'ย้ายห้อง', 'ส่งต่อ'])
const nativeQueueCode = JSON.stringify([nativeUnit, nativeRoom, nativeDone])
assert(nativeQueueCode.includes('6ab0bb0afc8b9ef3e717b010'), 'front desk uses queue-call-front')
assert(nativeQueueCode.includes('6a4b942bac48023662b1b42a'), 'child rooms use call-next-queue')
assert(nativeQueueCode.includes('pick_id: String(dataRow._id)'), 'per-row room call stays exact')
assert(nativeQueueCode.includes('6a9524df422c1ca959829d9e'), 'Move Room remains the EMR form')
assert(nativeQueueCode.includes('6a4f828d22f95f21b606d9a2'), 'Forward remains the EMR form')
assert(nativeQueueCode.includes('form.$xrayQueueTarget = target'), 'My Room opens the preserved X-ray Worklist')
assert(!nativeQueueCode.includes('xray_queue_'), 'no custom X-ray queue widget remains')
assert(!nativeQueueCode.includes("action:'queue'"), 'no X-ray queue adapter is called')
assert(!form.formConfig.cssCode.includes('.xray-queue{'), 'the retired mutable custom X-ray queue CSS stays removed')
assert(form.formConfig.cssCode.includes('.xray-queue-tracking{'), 'the new read-only tracking tab has isolated CSS')


/* ── ปุ่ม "นัดล่วงหน้า" → จอ XR Staff Booking ─────────────────────────────────
   🔴 assertion ชุดนี้ถูกพลิกกลับ **2026-10-05 ตามคำสั่งผู้ใช้** ("ปุ่มที่เราเคยผูก
      โมดูลการนัดล่วงหน้าไว้ เอากลับมาเหมือนเดิม") — ไม่ใช่การลดความเข้มของเทสเพื่อให้
      ของใหม่ผ่าน แต่เป็นการกลับไปสู่พฤติกรรมที่ผู้ใช้สั่งไว้เดิม
   ไทม์ไลน์: สั่งทำ 2026-09-08 → เชื่อมจอ 2026-09-23 → ถอดออก 2026-09-26 → เอากลับ 2026-10-05
   สิ่งที่ assertion ช่วงถอดออกปกป้องไว้ยังอยู่ครบ: ปุ่มที่เหลือต้องไม่หายและอยู่กลุ่มเดียวกัน */
assert(widget.content.includes('>นัดล่วงหน้า</el-button>'), 'the appointment button is back')
assert(widget.content.includes('@click="openAppointment"'), 'and it is bound to its handler')
assert(widget.content.includes('class="xr-appointment-button"'), 'with its own layout hook')
assert(
  widget.onCreated.includes("const APPOINTMENT_FORM_ID='6ab207459a834d51703fc158';"),
  'wired to the XR Staff Booking screen it was wired to on 2026-09-23',
)
assert(widget.onCreated.includes('s.openAppointment='), 'the handler ships')
assert(widget.onCreated.includes('s.appointmentHint='), 'and its tooltip')
/* จอกั้นสิทธิ์ RIS/XRAY/ADMIN — tooltip ต้องบอกไว้ ไม่งั้นคนกดแล้วโดนปฏิเสธจะคิดว่าปุ่มพัง */
assert(widget.onCreated.includes('RIS หรือ XRAY หรือ ADMIN'), 'the tooltip names the roles the screen needs')
/* จอเป็น form_ui ไม่มีฟิลด์ ⇒ ห้ามส่ง initData */
assert(
  widget.onCreated.includes("form.openForm(APPOINTMENT_FORM_ID,'','',null,"),
  'the booking screen is opened without initData',
)
assert(css.includes('.xray-cpoe .xr-appointment-button{grid-column:2;grid-row:1;'), 'its layout rule is back')
assert(
  worklistBuilder.includes('process.env.XRAY_APPOINTMENT_FORM_ID'),
  'and the generator keeps the env switch that can unwire it again',
)
/* ของเดิมที่ต้องอยู่ต่อ — ปุ่มทั้งกลุ่มยังอยู่ด้วยกันเวลา toolbar ห่อบรรทัด */
assert(widget.content.includes('<div class="xr-create-group">'), 'create, appointment and consent stay grouped')
assert(css.includes('.xray-cpoe .xr-create-group'), 'and that cell keeps its layout rule')
assert(widget.content.includes('สร้างรายการใหม่'), 'the create button stays')
assert(widget.content.includes('หนังสือยินยอม'), 'the consent button stays')
/* เพิ่มเฉพาะปุ่ม toolbar สำหรับ Xray Print Stickers Set ตามคำสั่งผู้ใช้ 2026-10-05 */
assert(widget.content.includes('>ปริ้นสติ้กเกอร์</el-button>'), 'the sticker form button is present')
assert(widget.content.includes('@click="openStickerForm"'), 'and it is bound to its own handler')
assert(
  widget.onCreated.includes("const PRINT_STICKERS_FORM_ID='6abc9291c54b3f93ce79f520';"),
  'the button is wired to Xray Print Stickers Set',
)
assert(widget.onCreated.includes('s.openStickerForm='), 'the sticker form handler ships')
assert(css.includes('.xray-cpoe .xr-sticker-button{grid-column:1;grid-row:2;'), 'it occupies the circled toolbar cell')
/* หนังสือยินยอมกลับไปแถวสองใต้ปุ่มนัด ตามผังเดิมก่อน 2026-09-26 */
assert(css.includes('.xray-cpoe .xr-consent-button{grid-column:2;grid-row:2;'))


/* ── คอลัมน์ "สารทึบ" ระดับ item (ผู้ใช้เลือกตัวเลือก A 2026-09-23) ──────────
   คำสั่ง: "เพิ่มคอลัมผูกปุ่มของ xray ตามนี้หน่อย ห้ามกระทบ flow อื่นนะแค่เพิ่มมา"
   เทสชุดนี้จึงคุมทั้งของใหม่ที่ต้องมี และของเดิมในแถวเดียวกันที่ต้องไม่ขยับ */
assert(
  widget.content.includes('<div>สติ๊กเกอร์ HN</div><div>สารทึบ</div>'),
  'the contrast column is the 12th — appended after สติ๊กเกอร์ HN, never inserted in the middle',
)
assert(widget.content.includes('<div data-label="สารทึบ" class="xr-item-contrast">'))
assert(widget.content.includes('@click="openContrastRecord(row,item)">+ บันทึก</el-button>'))
assert(
  widget.content.includes('<button v-if="item.contrast_label" type="button" class="xr-contrast-chip"'),
  'a recorded item shows the chip instead of the button, and the chip reopens the same form',
)
assert(css.includes('.xray-cpoe .xr-item-contrast{'), 'the new cell has its own layout rule')
assert(css.includes('.xray-cpoe .xr-contrast-chip{'))

/* ผูกกับ Form ID ที่ import แล้วตาม spec.md — เทสไม่ผูกกับเลขตายตัว ไม่งั้นวันที่
   ผู้ใช้สลับฟอร์ม เทสจะแดงทั้งที่ตั้งใจเปลี่ยน (ทรงเดียวกับ CPOE_ORDER_APP_ID) */
const contrastFormId = (widget.onCreated.match(/const CONTRAST_FORM_ID='([a-f0-9]{24})'/) || [])[1]
assert(contrastFormId, 'the contrast button must ship wired to the imported form')
/* ห้ามมีปุ่มตาย (decision X17) — ปิดปุ่มด้วย env ก็ยังขึ้นและบอกเหตุผล ไม่ซ่อนหาย */
assert(worklistBuilder.includes('process.env.XRAY_CONTRAST_FORM_ID'), 'wiring it must not need a code edit')
assert(
  worklistBuilder.includes("throw new Error('XRAY_CONTRAST_FORM_ID must be the 24-character"),
  'a malformed id fails at generate time, not silently inside the form',
)
assert(!widget.content.includes('v-if="item.can_contrast"'), 'the button is never hidden per row')
const contrastHandler = widget.onCreated.slice(
  widget.onCreated.indexOf('s.openContrastRecord='),
  widget.onCreated.indexOf('s.createOrderTarget=', widget.onCreated.indexOf('s.openContrastRecord=')),
)
assert(!contrastHandler.includes('guardRowAction'), 'contrast recording remains freestyle and is not unit-locked')

/* 🔴 ของเดิมในแถว item ต้องอยู่ครบเท่าเดิม */
assert(widget.content.includes(':title="item.sticker_hint">สติ๊กเกอร์ HN</el-button>'), 'the sticker button is untouched')
assert(widget.content.includes('<div data-label="Radiographer"'), 'the Radiographer dropdown is untouched')
assert(widget.content.includes('<div data-label="Radiologist"'), 'the Radiologist dropdown is untouched')
assert(widget.content.includes('@click="dispatchOrder(row)">{{ row.dispatch_label }}</el-button>'), 'ส่งเข้าเครื่อง remains wired')

/* ── runtime: ไม่มีข้อมูล = ปุ่ม · มีข้อมูล = ชิป ─────────────────────────── */
const plainItem = s.buildItem({}, { item_id: 'IT-NOCM', item_name: 'Chest PA', item_code: 'DXC010' })
assert.strictEqual(plainItem.contrast_label, '', 'no payload means no chip — never guess "not injected"')
assert.strictEqual(plainItem.contrast_hint, s.contrastHint)
const cmItem = s.buildItem({}, {
  item_id: 'IT-CM', item_name: 'CT Whole Abdomen', item_code: 'CTA001',
  contrast: { record_id: 'CM-RECORD-1', brand: 'Iohexol 350', volume_ml: 80, used_at: '2026-09-23T09:40:00+07:00', recorded_by: 'นาย ก.' },
})
assert.strictEqual(cmItem.contrast_label, 'Iohexol 350 · 80 ml', 'the chip shows brand and volume')
assert(cmItem.contrast_title.includes('แก้ไข'), 'the saved chip explains that the existing record can be edited')
assert(!cmItem.contrast_title.includes('อ่านอย่างเดียว'))
assert.strictEqual(cmItem.contrast_record_id, 'CM-RECORD-1', 'the saved record id reaches the chip handler')
const typeOnlyItem = s.buildItem({}, {
  item_id: 'IT-TYPE', contrast: { record_id: 'CM-RECORD-2', types: ['barium_sulphate'], volume_ml: 3 },
})
assert.strictEqual(typeOnlyItem.contrast_label, 'Barium Sulphate · 3 ml', 'a stored type supplies the label when brand is empty')
/* ทรงแบนก็ต้องอ่านได้ เผื่อ API รุ่นแรกคืนคีย์แบบนี้ */
const flatItem = s.buildItem({}, { item_id: 'IT-FLAT', contrast_brand: 'Omnipaque', contrast_volume_ml: 50 })
assert.strictEqual(flatItem.contrast_label, 'Omnipaque · 50 ml')
/* 🔴 ค่าที่เพิ่มมาเป็นข้อมูลแสดงผลล้วน ห้ามไปเปลี่ยนสิทธิ์ของแถว */
assert.strictEqual(cmItem.can_select, plainItem.can_select)
assert.strictEqual(cmItem.can_sticker, plainItem.can_sticker)
assert.strictEqual(cmItem.can_dispatch_item, plainItem.can_dispatch_item)
assert.strictEqual(cmItem.status_label, plainItem.status_label)

/* ── ตัวระบุรายการต้องเดินทางครบ ─────────────────────────────────────────── */
s.openContrastRecord(
  { id: 'ORD-CM', order_no: 'ON-1', hn: '6801234', name: 'ด.ญ. ตัวอย่าง ทดสอบ', age: '7', emr: { visit_id: 'VISIT-CM' } },
  { id: 'IT-CM', accession_no: 'A690917004', code: 'CTA001', name: 'CT Whole Abdomen', modality: 'CT' },
)
const cmOpen = opened[opened.length - 1]
assert.strictEqual(cmOpen[0], contrastFormId, 'the button opens the contrast form')
assert.strictEqual(cmOpen[1], null, 'a new record uses null dataId and does not create a blank saved row on open')
assert.strictEqual(cmOpen[2], '', 'the item id must never travel as the parentId')
/* 🔴 แก้ assertion 2026-09-23 ตามคำสั่งผู้ใช้ ("ควรเพิ่ม field เก็บไว้ที่ฟอร์มสารทึบ")
   ของเดิมล็อกไว้ 3 คีย์ เพราะตอนนั้นฟอร์มสารทึบยังไม่มีช่องรับตัวระบุรายการ
   ตอนนี้มีการ์ด cmr_link แล้ว ⇒ ตัวระบุต้องไปทาง initData ไม่ใช่ params
   (params ลงที่ form.formParams ซึ่งไม่เขียนค่าลงฟิลด์ ⇒ ของเดิมบันทึกไม่ติดจริง)
   สิ่งที่ assertion เดิมปกป้อง ("ห้ามส่งคีย์ที่ฟอร์มปลายทางไม่มี") ยังอยู่ครบและแข็งขึ้น
   เพราะเทียบกับชื่อฟิลด์จริงใน xray-contrast-media-record-v1.json ตรง ๆ
   ⇒ วันไหนมีคนลบช่องในฟอร์มสารทึบ เทสนี้จะแดงทันที ไม่ปล่อยให้ค่าหายเงียบ */
const contrastForm = read('Form-Builder/SDForm/X-ray/xray-contrast-media-record-v1.json')
const contrastFieldNames = new Set()
walk(contrastForm.fields, node => {
  if (node && node.options && typeof node.options.name === 'string') contrastFieldNames.add(node.options.name)
})
assert(contrastFieldNames.has('cmr_link'), 'the contrast form must carry the linkage card')
Object.keys(cmOpen[3]).forEach(key => assert(
  contrastFieldNames.has(key),
  'initData key "' + key + '" has no matching field in the contrast form',
))
assert.deepStrictEqual(
  cmOpen[3],
  {
    hn: '6801234', patient_name: 'ด.ญ. ตัวอย่าง ทดสอบ', patient_age: '7',
    item_id: 'IT-CM', accession_no: 'A690917004',
    order_id: 'ORD-CM', order_no: 'ON-1', visit_id: 'VISIT-CM',
    modality: 'CT', item_code: 'CTA001', item_name: 'CT Whole Abdomen',
  },
  'the exam identifiers must be saved with the record, not only passed as params',
)
/* item_id คือกุญแจที่ worklist API จะใช้ดึงกลับมาโชว์ชิป — ขาดไม่ได้เด็ดขาด */
assert.strictEqual(cmOpen[3].item_id, 'IT-CM', 'item_id is the key that links the record back')
/* HN ผูกอยู่แล้วตั้งแต่ก่อนหน้านี้ ผ่านช่อง hn เดิมของฟอร์ม ไม่ได้สร้างช่องซ้ำ */
assert(contrastFieldNames.has('hn'), 'HN is linked through the existing field, no duplicate')
assert.strictEqual(cmOpen[4].params.order_id, 'ORD-CM')
assert.strictEqual(cmOpen[4].params.item_id, 'IT-CM')
assert.strictEqual(cmOpen[4].params.accession_no, 'A690917004')
assert.strictEqual(cmOpen[4].params.item_code, 'CTA001')
assert.strictEqual(cmOpen[4].params.modality, 'CT')
assert.strictEqual(cmOpen[4].params.visit_id, 'VISIT-CM')
assert.strictEqual(cmOpen[4].params.source, 'xray-worklist')
assert.strictEqual(cmOpen[4].params.xsitex, 'SITE-1', 'host form params are carried through, like every other button')
assert.strictEqual(cmOpen[4].readonly, undefined, 'the new-record form remains editable')
assert.strictEqual(typeof cmOpen[4].afterSaveCallback, 'function', 'saving a new record reloads the worklist so the chip appears')
/* autoSave เป็นการบันทึกเบื้องหลัง ห้ามปิดใบที่ผู้ใช้กำลังกรอก ส่วน Submit สำเร็จ
   ต้องปิด popup หนึ่งครั้งและ reload หนึ่งครั้ง โดยไม่แตะ flow การ save เอง */
const originalContrastLoadOrders = s.loadOrders
let contrastReloads = 0
s.loadOrders = () => { contrastReloads += 1 }
const closedBeforeContrastSave = closedPopups
cmOpen[4].afterSaveCallback({}, true)
assert.strictEqual(closedPopups, closedBeforeContrastSave, 'autoSave keeps the contrast popup open')
assert.strictEqual(contrastReloads, 0, 'autoSave does not reload the worklist while the form is still open')
cmOpen[4].afterSaveCallback({}, false)
assert.strictEqual(closedPopups, closedBeforeContrastSave + 1, 'successful Submit closes the contrast popup exactly once')
assert.strictEqual(contrastReloads, 1, 'successful Submit reloads the worklist exactly once')
s.loadOrders = originalContrastLoadOrders

/* 2026-10-18 ผู้ใช้เปลี่ยน requirement จาก read-only เป็นแก้ไข record เดิมเหมือนปุ่ม Edit
   สิ่งที่ assertion เดิมปกป้องยังคงอยู่: ต้องเปิด _id เดิมและห้ามส่ง initData ไปทับค่าเดิม */
s.openContrastRecord(
  { id: 'ORD-CM', order_no: 'ON-1', hn: '6801234', name: 'ด.ญ. ตัวอย่าง ทดสอบ', age: '7', emr: { visit_id: 'VISIT-CM' } },
  { id: 'IT-CM', contrast_record_id: 'CM-RECORD-1', accession_no: 'A690917004', code: 'CTA001', name: 'CT Whole Abdomen', modality: 'CT' },
)
const savedCmOpen = opened[opened.length - 1]
assert.strictEqual(savedCmOpen[0], contrastFormId)
assert.strictEqual(savedCmOpen[1], 'CM-RECORD-1', 'the chip opens exactly the saved record')
assert.strictEqual(savedCmOpen[3], null, 'edit mode never overlays saved values with Worklist initData')
assert.strictEqual(savedCmOpen[4].readonly, undefined, 'the saved record opens in editable mode')
assert.strictEqual(typeof savedCmOpen[4].afterSaveCallback, 'function', 'updating the record refreshes its chip')
const originalContrastEditLoadOrders = s.loadOrders
let contrastEditReloads = 0
s.loadOrders = () => { contrastEditReloads += 1 }
const closedBeforeContrastEdit = closedPopups
savedCmOpen[4].afterSaveCallback({}, true)
assert.strictEqual(closedPopups, closedBeforeContrastEdit, 'edit autoSave keeps the popup open')
assert.strictEqual(contrastEditReloads, 0, 'edit autoSave does not reload mid-edit')
savedCmOpen[4].afterSaveCallback({}, false)
assert.strictEqual(closedPopups, closedBeforeContrastEdit + 1, 'successful Update closes the edit popup exactly once')
assert.strictEqual(contrastEditReloads, 1, 'successful Update reloads the updated chip exactly once')
s.loadOrders = originalContrastEditLoadOrders

/* ── ปิดปุ่มด้วย env: ต้องไม่เปิดอะไร แต่บอกให้ครบว่าต้องทำอะไรต่อ ─────────
   boot ซ้ำโดยล้างค่า CONTRAST_FORM_ID เท่ากับ generate ด้วย XRAY_CONTRAST_FORM_ID=
   จึงทดสอบกติกา "ห้ามปุ่มตาย" ได้โดยไม่ต้องแตะ JSON ที่ deploy */
const unwiredNotes = []
const unwiredOpened = []
const unwiredField = {
  vueState: {},
  globalUserState: { user: { unit: { code: '10' } }, runProcess },
  getFormRef: () => ({ formParams: {}, openForm: (...args) => unwiredOpened.push(args), getFieldRef: () => null }),
  notify: message => unwiredNotes.push(message),
}
new Function(
  bootable.replace("const CONTRAST_FORM_ID='" + contrastFormId + "';", "const CONTRAST_FORM_ID='';"),
).call(unwiredField)
unwiredField.vueState.openContrastRecord({ id: 'ORD-CM', hn: '6801234' }, { id: 'IT-CM' })
assert.strictEqual(unwiredOpened.length, 0, 'an unwired button opens nothing')
assert(
  unwiredNotes[unwiredNotes.length - 1].includes('XRAY_CONTRAST_FORM_ID'),
  'and it names exactly what is missing instead of failing silently',
)
assert(unwiredField.vueState.contrastHint.includes('XRAY_CONTRAST_FORM_ID'), 'the tooltip says it too')


/* ── runtime: ปุ่มนัดล่วงหน้ากดแล้วต้องเปิดจอ XR Staff Booking (เอากลับ 2026-10-05) ──
   ตรวจสามอย่าง: เปิดจอถูกตัว · ไม่ส่ง initData · พา HN/เลขบัตรที่อยู่ในบริบทไปให้
   🔴 ปุ่ม "สร้างรายการใหม่" ใช้ s.createOrderTarget() ตัวเดียวกัน — ต้องไม่พังตามไปด้วย */
s.resetScan()
s.filters = { ...s.filters, q: '' }
assert.strictEqual(typeof s.openAppointment, 'function', 'the appointment handler is back at runtime')
assert(s.appointmentHint.includes('XR Staff Booking'), 'and its tooltip names the screen')
const beforeAppointment = opened.length
s.openAppointment()
assert.strictEqual(opened.length, beforeAppointment + 1, 'pressing it opens the booking screen')
const appointmentCall = opened[opened.length - 1]
assert.strictEqual(appointmentCall[0], '6ab207459a834d51703fc158', 'it opens XR Staff Booking')
assert.strictEqual(appointmentCall[3], null, 'the screen has no fields, so no initData')
assert.strictEqual(appointmentCall[4].params.appointment, true, 'and it carries the appointment flag')
assert.strictEqual(appointmentCall[4].params.hn, undefined, 'no patient in context means no HN key at all')
/* มีคนไข้ในบริบท (พิมพ์ HN ค้างไว้ในช่องค้นหา) ⇒ ต้องพา HN ไปให้จอ */
s.filters = { ...s.filters, q: '6801234' }
s.openAppointment()
assert.strictEqual(opened[opened.length - 1][4].params.hn, '6801234', 'a scanned/typed HN rides along')
s.filters = { ...s.filters, q: '' }
assert.strictEqual(typeof s.createOrderTarget, 'function', 'the shared target helper must survive')
assert.strictEqual(typeof s.openCreateOrder, 'function', 'the create button still works')
assert.strictEqual(typeof s.openConsentLibrary, 'function', 'the consent button still works')
assert.strictEqual(typeof s.openStickerForm, 'function', 'the sticker form button is callable')
const beforeSticker = opened.length
s.openStickerForm()
assert.strictEqual(opened.length, beforeSticker + 1, 'pressing it opens exactly one form')
const stickerCall = opened[opened.length - 1]
assert.strictEqual(stickerCall[0], '6abc9291c54b3f93ce79f520', 'it opens Xray Print Stickers Set')
assert.strictEqual(stickerCall[1], '', 'it does not invent a record id')
assert.strictEqual(stickerCall[2], '', 'it does not invent a parent id')
assert.strictEqual(stickerCall[3], null, 'it does not send initData')
assert.deepStrictEqual(stickerCall[4], { backdrop: false }, 'it only uses the normal popup option')
const beforeCreate = opened.length
s.openCreateOrder()
assert.strictEqual(opened.length, beforeCreate + 1, 'creating an order still opens its form')
assert.strictEqual(
  opened[opened.length - 1][4].params.appointment, undefined,
  'and it never carries the appointment flag',
)
/* หลังส่งใบสำเร็จให้รีเฟรช Worklist เท่านั้น — การสั่ง Order ไม่ใช่การย้ายคิว
   การเงินเรียก VN มาคิดเงิน และระบบคิวกลางเป็นผู้ดูแล Visit Tran */
const createCall = opened[opened.length - 1]
const beforeMove = opened.length
createCall[4].params.on_order_sent()
assert.strictEqual(opened.length, beforeMove, 'successful send must not open Move Unit')
assert.strictEqual(s.page.current, 1, 'successful send refreshes from the first Worklist page')
s.resetScan()

console.log('X-ray CPOE worklist Form tests passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
