/* X-ray PDF catalog. Copy the validated LAB grid/grid-col/vue-ui structure.
 * Existing Report Factory PDFs remain the source; this form only lists them.
 */
const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../..')
const source = path.join(root, 'Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json')
const target = path.join(root, 'Form-Builder/SDForm/X-ray/xray-consent-document-library-v1.json')
const form = JSON.parse(fs.readFileSync(source, 'utf8'))
const grid = form.fields.find(field => field.component === 'grid')
if (!grid || !grid.cols?.[0]?.fields?.[0] || grid.cols[0].fields[0].component !== 'vue-ui') {
  throw new Error('Validated grid/grid-col/vue-ui template was not found')
}
form.fields = [grid]
grid.options.name = 'xray_document_library_root'
grid.id = 'grid-xray-document-library-root'
const col = grid.cols[0]
col.options.name = 'xray_document_library_col'
col.id = 'grid-col-xray-document-library'
const widget = col.fields[0]
widget.options.name = 'xray_document_library'
widget.options.label = 'คลังเอกสาร X-ray'
widget.id = 'vue-ui-xray-document-library'

/* Confirmed read-only in HIS module_report on 2026-09-17: all are public PDF
 * reports with no required params and the static_report_dummy_row provider. */
const pairs = [
  ['6aa3b2df8f9a0e702f2deacf', '6aa3ba38b92813319a86e9d7'],
  ['6aa3c0556c01b91cd929807a', '6aa3c059951e69eaf6f574c0'],
  ['6aa3c05c4450eda3107a5bcd', '6aa3c05f91aa378567d9cdbd'],
  ['6aa3c06118ba3bc2899b37ec', '6aa3c0696943d27dbf198b07'],
  ['6aa3c06f23e6140d107bc6c3', '6aa3c076d0cf5dff9d8d716a']
]
/* Short folder labels and document titles follow the descriptions shown in
 * Report Factory. The exact pdf_name remains searchable and visible per file. */
const titles = [
  { folder: 'รับทราบและยินยอมตรวจพิเศษ', th: 'หนังสือรับทราบข้อมูลและยินยอมตรวจพิเศษทางรังสี',
    en: 'Acknowledgement and Consent for Special Radiological Examination' },
  { folder: 'ยินยอมตรวจ FLU / IVP / CT', th: 'ใบยินยอมตรวจพิเศษทางรังสีวิทยา (FLU, IVP, CT)',
    en: 'Consent for Special Radiological Examinations (FLU, IVP, CT)' },
  { folder: 'ยินยอมรับการรักษา', th: 'คำยินยอมให้ทำการรักษา',
    en: 'Consent for Medical Treatment' },
  { folder: 'ประวัติก่อนตรวจ MRI / สารทึบ', th: 'ใบซักประวัติก่อนตรวจ MRI และฉีดสารทึบรังสี',
    en: 'MRI and Contrast Media Pre-Examination History' },
  { folder: 'ยินยอมบันทึกภาพและข้อมูล', th: 'ยินยอมบันทึกภาพและเสียงและใช้ข้อมูลด้านสุขภาพ',
    en: 'Consent for Photography, Audio/Video and Health Information Use' }
]
if (new Set(pairs.flat()).size !== 10 || pairs.some(pair => pair.some(id => !/^[a-f0-9]{24}$/.test(id)))) {
  throw new Error('Catalog must have ten unique Report Factory IDs')
}
const folders = pairs.map((pair, index) => {
  const pdfName = 'Xray static report ' + (index + 1)
  const title = titles[index]
  return {
    id: String(index + 1), name: title.folder,
    files: [
      { id: pair[0], name: pdfName + ' TH', title: title.th, language: 'ภาษาไทย',
        search: (pdfName + ' TH ไทย ' + title.folder + ' ' + title.th).toLowerCase(),
        reportList: [{ reportId: pair[0], label: 'ดูตัวอย่าง / พิมพ์', type: 'pdf' }] },
      { id: pair[1], name: pdfName + ' EN', title: title.en, language: 'English',
        search: (pdfName + ' EN English อังกฤษ ' + title.folder + ' ' + title.en).toLowerCase(),
        reportList: [{ reportId: pair[1], label: 'ดูตัวอย่าง / พิมพ์', type: 'pdf' }] }
    ]
  }
})

form.formConfig.cssCode = `.xray-doc-library{--xd-blue:var(--el-color-primary,#409eff);--xd-ink:var(--el-text-color-primary,#303133);--xd-muted:var(--el-text-color-secondary,#909399);--xd-line:var(--el-border-color-light,#e4e7ed);--xd-bg:var(--el-bg-color,#fff);--xd-soft:var(--el-fill-color-light,#f5f7fa);box-sizing:border-box;width:100%;padding:18px 20px 28px;background:var(--xd-bg);color:var(--xd-ink);font-family:"Leelawadee UI","Noto Sans Thai",Tahoma,"Segoe UI",sans-serif}
.xray-doc-library *{box-sizing:border-box}
.xray-doc-library .xd-header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:20px}
.xray-doc-library .xd-title{margin:0;font-size:22px;font-weight:750}
.xray-doc-library .xd-subtitle{margin:5px 0 0;color:var(--xd-muted);font-size:13px}
.xray-doc-library .xd-search{width:min(340px,100%)}
.xray-doc-library .xd-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px 24px}
.xray-doc-library .xd-folder{display:flex;min-height:160px;flex-direction:column;align-items:flex-start;justify-content:space-between;width:100%;padding:19px 20px 17px;border:1px solid var(--xd-line);border-radius:14px;background:var(--xd-bg);box-shadow:0 3px 8px rgba(18,38,63,.08);color:var(--xd-ink);font:inherit;text-align:left;cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .15s}
.xray-doc-library .xd-folder:hover,.xray-doc-library .xd-folder:focus-visible{border-color:var(--xd-blue);box-shadow:0 6px 14px rgba(18,38,63,.14);transform:translateY(-1px);outline:none}
.xray-doc-library .xd-folder.is-active{border-color:var(--xd-blue);box-shadow:0 0 0 2px var(--el-color-primary-light-7,#a0cfff)}
.xray-doc-library .xd-folder-icon{display:block;width:34px;height:34px;color:#347ecc}
.xray-doc-library .xd-folder-name{display:block;margin-top:17px;font-size:17px;font-weight:700;line-height:1.3;overflow-wrap:anywhere}
.xray-doc-library .xd-folder-count{display:block;margin-top:5px;color:var(--xd-muted);font-size:12px}
.xray-doc-library .xd-panel{margin-top:22px;padding:16px 18px;border:1px solid var(--xd-line);border-radius:12px;background:var(--xd-bg)}
.xray-doc-library .xd-panel-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:10px}
.xray-doc-library .xd-panel-title{margin:0;font-size:16px;font-weight:700}
.xray-doc-library .xd-panel-hint{color:var(--xd-muted);font-size:12px}
.xray-doc-library .xd-file{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;min-height:62px;padding:10px 0;border-top:1px solid var(--xd-line)}
.xray-doc-library .xd-file-name{display:block;font-size:13px;font-weight:650;overflow-wrap:anywhere}
.xray-doc-library .xd-file-language{display:block;margin-top:3px;color:var(--xd-muted);font-size:11px}
.xray-doc-library .xd-empty{padding:30px 15px;border:1px dashed var(--xd-line);border-radius:12px;background:var(--xd-soft);color:var(--xd-muted);text-align:center}
@media(max-width:900px){.xray-doc-library .xd-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.xray-doc-library{padding:12px}.xray-doc-library .xd-header{display:block}.xray-doc-library .xd-search{margin-top:12px;width:100%}.xray-doc-library .xd-grid{grid-template-columns:1fr;gap:12px}.xray-doc-library .xd-folder{min-height:120px}.xray-doc-library .xd-panel-head{display:block}.xray-doc-library .xd-panel-hint{display:block;margin-top:4px}.xray-doc-library .xd-file{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.xray-doc-library *{transition-duration:.001ms!important}}`

widget.options.content = `<div class="xray-doc-library">
  <header class="xd-header">
    <div><h2 class="xd-title">คลังเอกสาร X-ray</h2>
      <p class="xd-subtitle">เลือกชุดเอกสารเพื่อดูตัวอย่างและพิมพ์รายงาน PDF</p></div>
    <el-input class="xd-search" :model-value="search" clearable prefix-icon="Search"
      placeholder="ค้นหาชื่อไฟล์" aria-label="ค้นหาชื่อไฟล์เอกสาร X-ray"
      @input="setSearch" @clear="setSearch('')" />
  </header>
  <div v-if="visibleFolders().length" class="xd-grid" role="group" aria-label="ชุดเอกสาร">
    <button v-for="folder in visibleFolders()" :key="folder.id" type="button"
      class="xd-folder" :class="{'is-active':selectedFolderId===folder.id}"
      :aria-pressed="selectedFolderId===folder.id" @click="selectFolder(folder.id)">
      <svg class="xd-folder-icon" viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <path d="M4 9.5A4.5 4.5 0 0 1 8.5 5h6.8l3.5 3.7h8.7A4.5 4.5 0 0 1 32 13.2v15.3a4.5 4.5 0 0 1-4.5 4.5h-19A4.5 4.5 0 0 1 4 28.5v-19Z" fill="currentColor"/>
        <path d="M12.5 21h11" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
      </svg>
      <span><span class="xd-folder-name">{{ folder.name }}</span>
        <span class="xd-folder-count">{{ folder.files.length }} ไฟล์ · ไทย / English</span></span>
    </button>
  </div>
  <div v-else class="xd-empty">ไม่พบชื่อไฟล์ที่ค้นหา</div>
  <section v-if="visibleFiles().length" class="xd-panel" aria-label="ไฟล์ในชุดเอกสาร">
    <div class="xd-panel-head">
      <h3 class="xd-panel-title">{{ search && !selectedFolderId ? 'ผลการค้นหา' : selectedFolderName() }}</h3>
      <span class="xd-panel-hint">พรีวิว PDF ก่อนเลือกพิมพ์ได้</span>
    </div>
    <div v-for="file in visibleFiles()" :key="file.id" class="xd-file">
      <div><span class="xd-file-name">{{ file.title }}</span>
        <span class="xd-file-language">{{ file.name }} · {{ file.language }}</span></div>
      <sd-report :report-list="file.reportList" :params="{}" size="small" />
    </div>
  </section>
</div>`

widget.options.onCreated = 'const s=this.vueState;\n' +
  's.folders=' + JSON.stringify(folders) + ';\n' +
  `s.search='';
s.selectedFolderId='';
s.normalize=value=>String(value==null?'':value).trim().toLowerCase();
s.setSearch=value=>{s.search=String(value==null?'':value);s.selectedFolderId='';};
s.matches=file=>!s.normalize(s.search)||file.search.includes(s.normalize(s.search));
s.visibleFolders=()=>s.folders.map(folder=>({...folder,files:folder.files.filter(s.matches)})).filter(folder=>folder.files.length);
s.selectFolder=id=>{s.selectedFolderId=s.selectedFolderId===id?'':id;};
s.selectedFolderName=()=>{const folder=s.folders.find(item=>item.id===s.selectedFolderId);return folder?folder.name:'';};
s.visibleFiles=()=>{
  const folders=s.visibleFolders();
  if(s.selectedFolderId){const selected=folders.find(folder=>folder.id===s.selectedFolderId);return selected?selected.files:[];}
  return s.normalize(s.search)?folders.flatMap(folder=>folder.files):[];
};`
widget.options.onMounted = ''
widget.options.onUnmount = ''

fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, JSON.stringify(form, null, 2) + '\n')
console.log('wrote ' + path.relative(root, target))
