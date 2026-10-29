#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '../../../..')
const FORM = path.join(ROOT, 'Form-Builder/SDForm/form-factory/forms/lab-emr-result-history-popup-v1.json')
const TEMPLATE = path.join(ROOT, '02-his/form-factory/lab-popup-result-template-FULL-v2-REPLACE.txt')
const ON_CREATED = path.join(ROOT, '02-his/form-factory/lab-popup-result-onCreated-FULL-v6-REPLACE.txt')
const CSS = path.join(ROOT, '02-his/form-factory/lab-popup-result-css-FULL-v3-REPLACE.txt')

const findVueUi = value => {
  if (!value || typeof value !== 'object') return null
  if (value.component === 'vue-ui') return value
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findVueUi(item)
        if (found) return found
      }
    } else {
      const found = findVueUi(child)
      if (found) return found
    }
  }
  return null
}

const form = JSON.parse(fs.readFileSync(FORM, 'utf8'))
const widget = findVueUi(form)
if (!widget) throw new Error('vue-ui widget not found')

/* openForm(..., { params }) exposes the popup context as the form-event
   `formParams` variable. `field.params` is widget-local and may contain only a
   partial/stale object, so merge both and let the form context win. */
const oldParamsHelper = 'const params = () => field.params || {};'
const newParamsHelper = "const params = () => { const direct=field.params&&typeof field.params==='object'?field.params:{}; let inherited={}; try{inherited=typeof formParams!=='undefined'&&formParams&&typeof formParams==='object'?formParams:{};}catch(error){inherited={};} return Object.assign({},direct,inherited); };"
if (widget.options.onCreated.includes(oldParamsHelper)) {
  widget.options.onCreated = widget.options.onCreated.replace(oldParamsHelper, newParamsHelper)
} else if (!widget.options.onCreated.includes(newParamsHelper)) {
  throw new Error('popup params helper anchor not found')
}

const attachmentTemplate = `
      <section v-if="attachmentCount()" class="lab-rh__attachments" aria-label="ไฟล์แนบผลตรวจ">
        <div class="lab-rh__attachments-head">
          <div><h2>ไฟล์แนบผลตรวจ</h2><p>ไฟล์จากห้องปฏิบัติการ · อ่านอย่างเดียวใน EMR</p></div>
          <span class="lab-rh__attachment-count">{{ attachmentCount() }} ไฟล์</span>
        </div>
        <div class="lab-rh__attachment-list">
          <a v-for="(file,index) in attachments()" :key="attachmentKey(file,index)" class="lab-rh__attachment-item" :href="attachmentUrl(file)" target="_blank" rel="noopener noreferrer" :aria-label="'เปิดไฟล์แนบ ' + attachmentName(file)">
            <span class="lab-rh__attachment-icon">FILE</span>
            <span class="lab-rh__attachment-copy"><strong>{{ attachmentName(file) }}</strong><small>{{ attachmentType(file) }}</small></span>
            <span class="lab-rh__attachment-size">{{ attachmentSize(file) }}</span>
            <span class="lab-rh__attachment-open">เปิดไฟล์ ↗</span>
          </a>
        </div>
      </section>`

if (!widget.options.content.includes('lab-rh__attachments')) {
  const anchor = '      </section>\n    </template>\n  </div>'
  if (!widget.options.content.includes(anchor)) throw new Error('template insertion anchor not found')
  widget.options.content = widget.options.content.replace(anchor, `      </section>\n${attachmentTemplate}\n    </template>\n  </div>`)
}

const attachmentLogic = `
s.attachmentUrl = file => {
  const value = asText(file && (file.url || file.response && file.response.filePath));
  return /^(https?:\\/\\/|\\/)/i.test(value) ? value : '';
};
s.attachments = () => asArray(s.currentOrder && s.currentOrder.attachments).filter(file => s.attachmentUrl(file));
s.attachmentCount = () => s.attachments().length;
s.attachmentName = file => asText(file && (file.name || file.response && file.response.fileName)) || 'ไฟล์แนบผลตรวจ';
s.attachmentKey = (file,index) => asText(file && (file.uid || file.url || file.response && file.response.filePath || file.name)) || 'attachment-' + index;
s.attachmentSize = file => {
  const bytes = Number(file && file.size);
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + ' KB';
  return (bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0) + ' MB';
};
s.attachmentType = file => {
  const match = s.attachmentName(file).match(/\\.([^.]+)$/);
  return match ? match[1].toUpperCase() : 'FILE';
};
`

if (!widget.options.onCreated.includes('s.attachmentCount')) {
  const anchor = "s.orderComment = () => asText(s.currentOrder&&s.currentOrder.order_comment);\n"
  if (!widget.options.onCreated.includes(anchor)) throw new Error('onCreated insertion anchor not found')
  widget.options.onCreated = widget.options.onCreated.replace(anchor, anchor + attachmentLogic)
}

const attachmentCss = `
.lab-rh__attachments{display:grid;gap:10px;margin-top:14px;padding:12px;border:1px solid var(--lr-border-light);border-radius:8px;background:var(--lr-fill-soft)}.lab-rh__attachments-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.lab-rh__attachments-head h2{margin:0;color:var(--lr-ink);font-size:13px}.lab-rh__attachments-head p{margin:2px 0 0;color:var(--lr-muted);font-size:9px}.lab-rh__attachment-count{flex:none;padding:3px 8px;border:1px solid #a0cfff;border-radius:999px;background:var(--lr-surface);color:var(--lr-primary-dark);font-size:9px;font-weight:750}.lab-rh__attachment-list{display:grid;gap:7px}.lab-rh__attachment-item{display:grid;grid-template-columns:38px minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:9px 10px;border:1px solid var(--lr-border-light);border-radius:7px;background:var(--lr-surface);color:inherit;text-decoration:none}.lab-rh__attachment-item:hover,.lab-rh__attachment-item:focus-visible{border-color:#79bbff;background:var(--lr-primary-soft);outline:none}.lab-rh__attachment-icon{display:inline-flex;width:34px;height:28px;align-items:center;justify-content:center;border-radius:5px;background:var(--lr-primary-soft);color:var(--lr-primary-dark);font-size:8px;font-weight:800}.lab-rh__attachment-copy{min-width:0}.lab-rh__attachment-copy strong{display:block;overflow:hidden;color:var(--lr-ink);font-size:10px;text-overflow:ellipsis;white-space:nowrap}.lab-rh__attachment-copy small{display:block;margin-top:2px;color:var(--lr-muted);font-size:8px}.lab-rh__attachment-size{color:var(--lr-muted);font-size:9px;white-space:nowrap}.lab-rh__attachment-open{color:var(--lr-primary-dark);font-size:9px;font-weight:750;white-space:nowrap}
`

if (!form.formConfig.cssCode.includes('.lab-rh__attachments{')) {
  const anchor = '.lab-rh__footer{'
  const index = form.formConfig.cssCode.indexOf(anchor)
  if (index < 0) throw new Error('CSS insertion anchor not found')
  form.formConfig.cssCode = form.formConfig.cssCode.slice(0, index) + attachmentCss + form.formConfig.cssCode.slice(index)
}

if (!form.formConfig.cssCode.includes('.lab-rh__attachment-item{grid-template-columns:')) {
  const mobileAnchor = '@media(max-width:620px){'
  const mobilePatch = '@media(max-width:620px){.lab-rh__attachment-item{grid-template-columns:34px minmax(0,1fr) auto}.lab-rh__attachment-size{display:none}.lab-rh__attachment-open{font-size:0}.lab-rh__attachment-open::after{content:"↗";font-size:11px}'
  if (!form.formConfig.cssCode.includes(mobileAnchor)) throw new Error('mobile CSS insertion anchor not found')
  form.formConfig.cssCode = form.formConfig.cssCode.replace(mobileAnchor, mobilePatch)
}

fs.writeFileSync(FORM, `${JSON.stringify(form, null, 2)}\n`)
fs.writeFileSync(TEMPLATE, `${widget.options.content}\n`)
fs.writeFileSync(ON_CREATED, `${widget.options.onCreated}\n`)
fs.writeFileSync(CSS, `${form.formConfig.cssCode}\n`)
console.log('ok - LAB popup attachment replacements generated')
