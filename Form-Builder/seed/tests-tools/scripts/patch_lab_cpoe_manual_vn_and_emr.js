const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const cpoePath = path.join(root, 'Form-Builder/SDForm/sdform_module/EMR_form/CPOE_app.json')
const emrPath = path.join(root, 'Form-Builder/SDForm/sdform_module/EMR_form/EMR.json')

const walk = (value, fn) => {
  if (!value || typeof value !== 'object') return
  fn(value)
  if (Array.isArray(value)) value.forEach(item => walk(item, fn))
  else Object.values(value).forEach(item => walk(item, fn))
}

const findNamed = (form, name) => {
  let hit = null
  walk(form, value => {
    if (value.name === name) hit = value
  })
  if (!hit) throw new Error('Field not found: ' + name)
  return hit
}

const cpoe = JSON.parse(fs.readFileSync(cpoePath, 'utf8'))
const header = findNamed(cpoe, 'pt_header')
const screen = findNamed(cpoe, 'item_screen')

const pickerMarkup = `<div v-if="manualMode()" class="cpoe-vn-picker">
    <div class="cpoe-vn-search">
      <el-input :model-value="vnQuery" size="small" clearable prefix-icon="Search"
        placeholder="กรอก VN เพื่อเลือก Visit" @input="setVnQuery" @keyup.enter="findVisits" />
      <el-button size="small" type="primary" :loading="vnLoading" @click="findVisits">ค้นหา VN</el-button>
    </div>
    <div v-if="vnError" class="cpoe-vn-error">{{ vnError }}</div>
    <button v-for="visit in vnRows" :key="visit._id" type="button" class="cpoe-vn-row"
      :class="{'is-selected':selectedVisitId===String(visit._id)}" @click="selectVisit(visit)">
      <span class="cpoe-vn-code">VN{{ visit.vn || '–' }}</span>
      <span class="cpoe-vn-name">HN{{ visitPatient(visit).hn || '–' }} · {{ visitName(visit) || 'ไม่ทราบชื่อ' }}</span>
      <span class="cpoe-vn-age">{{ visitPatient(visit).age || '' }}</span>
    </button>
  </div>

  `

if (!header.content.includes('cpoe-vn-picker')) {
  header.content = header.content.replace('<div class="cpoe-ph">\n\n  ', '<div class="cpoe-ph">\n\n  ' + pickerMarkup)
}
header.content = header.content.replace(
  '<el-empty v-if="!ptHas()" description="ไม่มีข้อมูลผู้ป่วย — จอนี้ต้องเปิดจากการ์ดใบสั่งยาในหน้า EMR" />',
  '<el-empty v-if="!ptHas()" :description="manualMode()?\'กรอก VN ด้านบนเพื่อเลือก Visit\':\'ไม่มีข้อมูลผู้ป่วย — จอนี้ต้องเปิดจากหน้า EMR\'" />',
)

const oldContext = 'const m = () => field.params || {};'
const manualContext = `s.manualContext = null;
s.vnQuery = '';
s.vnRows = [];
s.vnLoading = false;
s.vnError = '';
s.selectedVisitId = '';
const formRef = () => field.getFormRef && field.getFormRef();
const m = () => s.manualContext || ((formRef() || {}).$labCpoeContext) || field.params || {};
s.manualMode = () => !!((field.params || {}).manual_visit);
s.setVnQuery = value => { s.vnQuery = String(value || '').trim(); s.vnError = ''; };
s.visitPatient = visit => (visit && visit.pid) || {};
s.visitName = visit => {
  const p = s.visitPatient(visit);
  return [((p.prename || {}).label || ''), p.p_fname || '', p.p_lname || ''].join(' ').replace(/\\s+/g, ' ').trim();
};
s.visitContext = visit => {
  const p = s.visitPatient(visit);
  const gender = ({'1':'ชาย','2':'หญิง'})[String(p.p_gender || '')] || '';
  const photo = Array.isArray(p.p_pic) ? p.p_pic : null;
  return {
    person_id: String(visit.xtbxlv1_xfx_id || ((visit.pid || {}).value) || ''),
    hn: p.hn || '',
    full_name: s.visitName(visit),
    sex: gender,
    age: p.age == null ? '' : p.age,
    blood_group: p.p_abogroup || '',
    p_pic: photo,
    allergy_tags: [],
    visit_id: String(visit._id || visit.value || ''),
    vn: visit.vn || '',
    visit_type: (visit.visit_type && (visit.visit_type.label || visit.visit_type.value)) || visit.visit_type || '',
    visit_datetime: visit.visit_date || visit.created_at || '',
    visit_clinic: (visit.visit_clinic && (visit.visit_clinic.label || visit.visit_clinic.value)) || '',
    visit_doctor: (visit.visit_doctor && (visit.visit_doctor.label || visit.visit_doctor.value)) || '',
    dx_summary: '',
    service_type: '',
    inscl_hos: Array.isArray(visit.inscl_hos) ? visit.inscl_hos : []
  };
};
s.selectVisit = visit => {
  const ctx = s.visitContext(visit);
  if(!ctx.visit_id) return;
  s.selectedVisitId = ctx.visit_id;
  s.manualContext = ctx;
  const form = formRef();
  if(form) form.$labCpoeContext = ctx;
  const item = field.getFieldRef && field.getFieldRef('item_screen');
  if(item && item.vueState && typeof item.vueState.setPatientContext === 'function') item.vueState.setPatientContext(ctx);
};
s.findVisits = () => {
  const vn = String(s.vnQuery || '').trim();
  if(!vn){ s.vnError = 'กรอก VN ก่อนค้นหา'; s.vnRows = []; return; }
  const form = formRef();
  if(!form || !form.userState || typeof form.userState.crudGetAll !== 'function'){
    s.vnError = 'ไม่พบตัวเชื่อมข้อมูล Visit'; return;
  }
  s.vnLoading = true;
  s.vnError = '';
  form.userState.crudGetAll({
    sdProvider:{
      providerId:'6a40fdec4b6dfdf45acbfbce',
      providerType:'FORM',
      params:{vn:vn},
      options:{where:'vn = :vn',orderBy:[{column:'visit_date',sort:'DESC'}],limit:10,page:1}
    },
    totalEnable:false
  },res=>{
    s.vnLoading=false;
    s.vnRows=(res&&res.data)||[];
    if(!s.vnRows.length)s.vnError='ไม่พบ VN '+vn;
    if(s.vnRows.length===1)s.selectVisit(s.vnRows[0]);
  },()=>{s.vnLoading=false;s.vnRows=[];s.vnError='ค้นหา VN ไม่สำเร็จ';});
};`
if (header.onCreated.includes(oldContext)) header.onCreated = header.onCreated.replace(oldContext, manualContext)

const oldScreenContext = `s.pt = () => field.params || {};
s.ptOk = () => !!(field.params && field.params.visit_id);
s.itemMode = () => ((field.params || {}).order_id ? 'edit' : 'new');`
const newScreenContext = `s.manualContext = null;
s.pt = () => s.manualContext || (((field.getFormRef && field.getFormRef()) || {}).$labCpoeContext) || field.params || {};
s.ptOk = () => !!(s.pt() && s.pt().visit_id);
s.itemMode = () => ((s.pt() || {}).order_id ? 'edit' : 'new');
s.setPatientContext = ctx => {
  s.manualContext = ctx || null;
  s.cart = [];
  s.specIx = -1;
  s.catErr = '';
  if(typeof s.boot === 'function') s.boot();
};`
if (screen.onCreated.includes(oldScreenContext)) screen.onCreated = screen.onCreated.replace(oldScreenContext, newScreenContext)

const launcherCss = `
/* LAB launcher: เลือก VN ก่อนสร้าง CPOE Order */
.cpoe-vn-picker{margin-bottom:8px;padding:10px 12px;border:1px solid var(--el-border-color-lighter);border-radius:10px;background:var(--el-fill-color-light)}
.cpoe-vn-search{display:flex;gap:8px;align-items:center}.cpoe-vn-search .el-input{width:min(360px,100%)}
.cpoe-vn-error{margin-top:6px;color:var(--el-color-danger);font-size:12px}
.cpoe-vn-row{display:grid;grid-template-columns:130px minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;margin-top:6px;padding:8px 10px;border:0;border-bottom:1px dashed var(--el-border-color-lighter);background:transparent;text-align:left;color:var(--el-text-color-regular)}
.cpoe-vn-row:hover,.cpoe-vn-row.is-selected{background:var(--el-bg-color);color:var(--el-color-primary)}
.cpoe-vn-code{font-family:var(--font-mono);font-weight:700}.cpoe-vn-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cpoe-vn-age{color:var(--el-text-color-secondary);font-size:12px}
@media(max-width:720px){.cpoe-vn-search{align-items:stretch;flex-direction:column}.cpoe-vn-search .el-input{width:100%}.cpoe-vn-row{grid-template-columns:1fr}.cpoe-vn-name{white-space:normal}}
`
const launcherAt = cpoe.formConfig.cssCode.indexOf('/* LAB launcher:')
if (launcherAt >= 0) cpoe.formConfig.cssCode = cpoe.formConfig.cssCode.slice(0, launcherAt).trimEnd()
if (cpoe.formConfig.cssCode.endsWith('</style>')) {
  cpoe.formConfig.cssCode = cpoe.formConfig.cssCode.slice(0, -8).trimEnd() + '\n' + launcherCss + '\n</style>\n'
} else {
  cpoe.formConfig.cssCode += '\n' + launcherCss
}

if (cpoe.fields.length && cpoe.fields.every(field => field.component === 'vue-ui')) {
  const originalFields = cpoe.fields
  cpoe.fields = [{
    key: 92786,
    name: 'Layout',
    component: 'grid',
    category: 'container',
    icon: 'grid',
    fieldType: 'None',
    fieldLength: null,
    children: false,
    enable: true,
    options: { name: 'cpoe_order_app_root', hidden: false, gutter: 0, colHeight: null, customClass: '' },
    id: 'grid-cpoe-order-app-root',
    cols: [{
      key: 92787,
      name: 'Grid Col',
      component: 'grid-col',
      category: 'container',
      icon: 'grid-col',
      fieldType: 'None',
      fieldLength: null,
      children: true,
      enable: true,
      options: {
        name: 'cpoe_order_app_col', hidden: false, span: 24, offset: 0, push: 0, pull: 0,
        responsive: false, md: 24, sm: 24, xs: 24, bgColor: null, customClass: ''
      },
      id: 'grid-col-cpoe-order-app',
      fields: originalFields
    }],
    fields: []
  }]
}

fs.writeFileSync(cpoePath, JSON.stringify(cpoe, null, 2) + '\n')

const emr = JSON.parse(fs.readFileSync(emrPath, 'utf8'))
emr.formConfig.onFormMounted = `const fp=this.formParams||{};
if(fp.lab_deep_link&&fp.visit_id){
  const form=this;
  const visitId=String(fp.visit_id||'');
  const hideQueueTabs=()=>{
    ['tab1','tab_pane_10728','tab_pane_11027'].forEach(name=>{
      const pane=form.getFieldRef&&form.getFieldRef(name);
      if(pane&&typeof pane.hide==='function')pane.hide();
      if(pane&&pane.options)pane.options.hidden=true;
      if(pane&&pane.field&&pane.field.options)pane.field.options.hidden=true;
    });
    const tab=form.getFieldRef&&form.getFieldRef('main_app');
    if(!tab)return;
    if(typeof tab.addCssClass==='function')tab.addCssClass('lab-emr-only-field');
    const host=tab.$el||(tab.$&&tab.$.vnode&&tab.$.vnode.el);
    const tabsEl=host&&(host.matches&&host.matches('.el-tabs')?host:(host.querySelector&&host.querySelector('.el-tabs')));
    if(tabsEl){
      tabsEl.classList&&tabsEl.classList.add('lab-emr-only');
      const header=tabsEl.querySelector&&tabsEl.querySelector(':scope > .el-tabs__header');
      if(header)header.style.display='none';
    }
    const apply=target=>{if(target)target.activeTabName='tab_pane_41691';};
    apply(tab);apply(tab.vueData);apply(tab.vueState);
    const editor=typeof tab.getFieldEditor==='function'&&tab.getFieldEditor();
    apply(editor);apply(editor&&editor.vueData);apply(editor&&editor.vueState);
    [tab.tabs,tab.field&&tab.field.tabs,tab.vueData&&tab.vueData.tabs,tab.vueState&&tab.vueState.tabs].forEach(tabs=>{
      if(!Array.isArray(tabs))return;
      tabs.forEach(pane=>{
        const options=pane&&pane.options||{};
        if(options.name&&options.name!=='tab_pane_41691')options.hidden=true;
      });
    });
  };
  const openTran=row=>{
    if(!row)return;
    form.$examTran=row;
    let attempts=0;
    const show=()=>{
      attempts+=1;
      hideQueueTabs();
      const card=form.getFieldRef&&form.getFieldRef('opd_card');
      if(card&&card.vueState&&typeof card.vueState.setTran==='function'){
        card.vueState.setTran(row);
        return true;
      }
      return attempts>=40;
    };
    if(show())return;
    const timer=setInterval(()=>{if(show())clearInterval(timer);},100);
  };
  const rowsOf=res=>{
    if(!res)return [];
    if(Array.isArray(res))return res;
    if(Array.isArray(res.data))return res.data;
    if(res.data&&Array.isArray(res.data.data))return res.data.data;
    if(res.reply&&Array.isArray(res.reply.data))return res.reply.data;
    return [];
  };
  hideQueueTabs();setTimeout(hideQueueTabs,0);setTimeout(hideQueueTabs,250);
  const request={
    sdProvider:{
      providerId:'6a461235e521219e514d1c4b',
      providerType:'FORM',
      params:{visit_id:visitId},
      options:{where:'\`vid.value\` = CONVERT(:visit_id, \\'objectId\\')',orderBy:[{column:'queue_ts',sort:'DESC'}],limit:1,page:1}
    },
    totalEnable:false
  };
  let settled=false;
  const success=res=>{
    if(settled)return;settled=true;
    const row=rowsOf(res)[0];
    if(row)openTran(row);
    else form.$message&&form.$message.warning('ไม่พบ Visit Tran สำหรับ VN นี้');
  };
  const failure=()=>{if(settled)return;settled=true;form.$message&&form.$message.error('เปิด EMR ของ VN นี้ไม่สำเร็จ');};
  try{
    const out=form.userState.crudGetAll(request,success,failure);
    if(out&&typeof out.then==='function')out.then(success).catch(failure);
  }catch(error){failure();}
}`

const emrDeepLinkCss = `
/* LAB deep-link: ซ่อนเฉพาะ header ของ main_app แต่คง tab ภายใน EMR card ไว้ */
.lab-emr-only>.el-tabs__header{display:none!important}
.lab-emr-only-field>.el-tabs__header{display:none!important}
`
if (!emr.formConfig.cssCode.includes('LAB deep-link:')) {
  if (emr.formConfig.cssCode.endsWith('</style>')) {
    emr.formConfig.cssCode = emr.formConfig.cssCode.slice(0, -8).trimEnd() + '\n' + emrDeepLinkCss + '\n</style>\n'
  } else {
    emr.formConfig.cssCode += '\n' + emrDeepLinkCss
  }
}

fs.writeFileSync(emrPath, JSON.stringify(emr, null, 2) + '\n')
