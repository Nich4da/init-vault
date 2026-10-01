const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
const library = read('Form-Builder/SDForm/X-ray/xray-consent-document-library-v1.json')
const worklist = read('Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json')

assert.deepStrictEqual(library.fields.map(field => field.component), ['grid'])
const widget = library.fields[0].cols[0].fields[0].options
assert.strictEqual(widget.name, 'xray_document_library')
assert(widget.content.includes('placeholder="ค้นหาชื่อไฟล์"'))
assert(widget.content.includes('<sd-report :report-list="file.reportList" :params="{}"'))
assert(library.formConfig.cssCode.includes('grid-template-columns:repeat(3,minmax(0,1fr))'))

const state = {}
new Function(widget.onCreated).call({ vueState: state })
assert.strictEqual(state.folders.length, 5)
assert.deepStrictEqual(state.folders.map(folder => folder.files.length), [2, 2, 2, 2, 2])
const ids = state.folders.flatMap(folder => folder.files.map(file => file.reportList[0].reportId))
assert.strictEqual(new Set(ids).size, 10)
assert(ids.every(id => /^[a-f0-9]{24}$/.test(id)))
assert(state.folders.every(folder => folder.files.every(file => file.reportList[0].type === 'pdf')))
assert.deepStrictEqual(state.visibleFiles(), [])
state.selectFolder('2')
assert.deepStrictEqual(state.visibleFiles().map(file => file.name), ['Xray static report 2 TH', 'Xray static report 2 EN'])
state.setSearch('MRI')
assert.strictEqual(state.selectedFolderId, '')
assert.deepStrictEqual(state.visibleFiles().map(file => file.name), ['Xray static report 4 TH', 'Xray static report 4 EN'])
state.setSearch('report 5 EN')
assert.deepStrictEqual(state.visibleFiles().map(file => file.name), ['Xray static report 5 EN'])
state.setSearch('ไม่พบไฟล์')
assert.deepStrictEqual(state.visibleFolders(), [])
assert.deepStrictEqual(state.visibleFiles(), [])

const worklistWidget = worklist.fields[0].tabs[2].fields[0].cols[0].fields[0].options
/* ── 🔴 ปุ่ม "นัดล่วงหน้า" ถูกถอดออก 2026-09-26 ตามคำสั่งผู้ใช้ ─────────────────
   ("เอาปุ่มนัดล่วงหน้าออกได้เลย ฉันเปลี่ยนแพลนว่าควรแยก module ดีกว่า
     เพราะในระบบนัดล่วงหน้ามีทุกอย่างครบแล้ว")
   assertion เดิมที่ล็อกว่า "ปุ่มต้องมีและต้องเชื่อมจอ XR Staff Booking" ถูกแทนด้วย
   assertion ตรงข้าม เพื่อกันไม่ให้ปุ่มแอบกลับมาโดยไม่มีคำสั่งผู้ใช้
   สิ่งที่เทสเดิมปกป้อง (ปุ่มอื่นในกลุ่มต้องไม่หายและไม่เปลี่ยนปลายทาง) ยังตรวจครบด้านล่าง */
assert(!worklistWidget.content.includes('>นัดล่วงหน้า</el-button>'), 'the appointment button is gone for good')
assert(!worklistWidget.onCreated.includes('openAppointment'), 'and so is its handler')
const create = worklistWidget.content.indexOf('>สร้างรายการใหม่</el-button>')
const consent = worklistWidget.content.indexOf('>หนังสือยินยอม</el-button>')
assert(create > 0 && consent > create, 'consent still sits after the create button in the same group')
assert(worklistWidget.content.includes('class="xr-create-group"'))
assert(!worklistWidget.content.includes('class="xr-toolbar-spacer"'))
assert(worklist.formConfig.cssCode.includes('.xray-cpoe .xr-toolbar{display:flex;flex-wrap:wrap;align-items:flex-start;'))
assert(!worklist.formConfig.cssCode.includes('.xr-appointment-button'), 'its layout rule is gone too')
/* หนังสือยินยอมเลื่อนขึ้นแถวแรกแทนช่องที่ว่างลง ไม่ปล่อยให้เหลือแถวที่ 2 ว่างเปล่า */
assert(worklist.formConfig.cssCode.includes('.xray-cpoe .xr-consent-button{grid-column:2;grid-row:1;'))
assert(worklistWidget.onCreated.includes('s.openConsentLibrary=()=>{'))
assert(worklistWidget.onCreated.includes("const CONSENT_LIBRARY_FORM_ID='6aab93911c5232627d0c6ee1';"))
assert(worklistWidget.onCreated.includes('form.openForm(CONSENT_LIBRARY_FORM_ID'))
assert(worklistWidget.onCreated.includes("const RIS_VIEWER_ENABLED=true;"), 'existing viewer stays enabled')

console.log('X-ray consent document library tests passed')
