const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const formPath = path.join(root, 'Form-Builder/SDForm/Lab/lab-cpoe-worklist-waiting-v1.json')
const xrayFormPath = path.join(root, 'Form-Builder/SDForm/X-ray/xray-cpoe-worklist-v1.json')
const outputPath = process.env.LAB_WORKLIST_OUTPUT || formPath
const defaultOrderRequestReportId = '6a977ac8422c1ca959829f97'
const resultReportFormId = '6a8d4334f851000f28e5025b'
const defaultLabResultPdfReportId = '6aa8f5a8b92813319a86ea11'
const defaultMicrobiologyResultPdfReportId = '6ab1c2d3e4f5061728394a5b'
const defaultMicrobiologyRequestPdfReportId = '6ab4fa2200000000000f001a'
/* ปุ่ม HN ระดับ Order — เปลี่ยนเป็น "ป้ายติดแฟ้ม (HN)" ตามคำสั่งผู้ใช้ 2026-09-04
   ("เอาเข้า lab ให้ด้วย") ต่อจากฝั่ง X-ray ที่ย้ายไปแล้วในวันเดียวกัน
   ของเดิม `5256d813009293b480d0a15c` (ป้ายติดแฟ้ม/VN) รับ `xparentx` = Visit ID
   ของใหม่รับ `hn` อย่างเดียว ⇒ ต้องเปลี่ยน ready()/params() คู่กันเสมอ ไม่ใช่แค่เลข Report */
const defaultHnOrderReportId = '6a9a355c422c1ca95982a1a2'
const orderRequestReportId = String(
  process.env.LAB_ORDER_REQUEST_REPORT_ID === undefined
    ? defaultOrderRequestReportId
    : process.env.LAB_ORDER_REQUEST_REPORT_ID
).trim()
if (orderRequestReportId && !/^[a-f0-9]{24}$/i.test(orderRequestReportId)) {
  throw new Error('LAB_ORDER_REQUEST_REPORT_ID must be the 24-character existing Report Factory ID')
}
const hnOrderReportId = String(
  process.env.LAB_HN_ORDER_REPORT_ID === undefined
    ? defaultHnOrderReportId
    : process.env.LAB_HN_ORDER_REPORT_ID
).trim()
if (hnOrderReportId && !/^[a-f0-9]{24}$/i.test(hnOrderReportId)) {
  throw new Error('LAB_HN_ORDER_REPORT_ID must be the 24-character existing Report Factory ID')
}
const labResultPdfReportId = String(
  process.env.LAB_RESULT_PDF_REPORT_ID === undefined
    ? defaultLabResultPdfReportId
    : process.env.LAB_RESULT_PDF_REPORT_ID
).trim()
if (labResultPdfReportId && !/^[a-f0-9]{24}$/i.test(labResultPdfReportId)) {
  throw new Error('LAB_RESULT_PDF_REPORT_ID must be the 24-character existing Report Factory ID')
}
const microbiologyResultPdfReportId = String(
  process.env.LAB_MICROBIOLOGY_RESULT_PDF_REPORT_ID === undefined
    ? defaultMicrobiologyResultPdfReportId
    : process.env.LAB_MICROBIOLOGY_RESULT_PDF_REPORT_ID
).trim()
if (microbiologyResultPdfReportId && !/^[a-f0-9]{24}$/i.test(microbiologyResultPdfReportId)) {
  throw new Error('LAB_MICROBIOLOGY_RESULT_PDF_REPORT_ID must be the 24-character existing Report Factory ID')
}
const microbiologyRequestPdfReportId = String(
  process.env.LAB_MICROBIOLOGY_REQUEST_PDF_REPORT_ID === undefined
    ? defaultMicrobiologyRequestPdfReportId
    : process.env.LAB_MICROBIOLOGY_REQUEST_PDF_REPORT_ID
).trim()
if (microbiologyRequestPdfReportId && !/^[a-f0-9]{24}$/i.test(microbiologyRequestPdfReportId)) {
  throw new Error('LAB_MICROBIOLOGY_REQUEST_PDF_REPORT_ID must be the 24-character existing Report Factory ID')
}
const orderRequestPdfAction = orderRequestReportId
  ? `<template v-if="!isCancelledOrder(order)">
            <sd-report v-if="detailTab(order)==='order'&&orderReportReady(order)" class="lab-plain-action lab-order-report"
              :report-list="orderRequestReportList" :params="orderReportParams(order)" size="small" />
            <el-button v-else-if="detailTab(order)==='order'" class="lab-plain-action" size="small" disabled
              title="Order นี้ไม่มี Order ID, Visit ID หรือ LAB Section สำหรับสร้าง PDF">ใบสั่ง</el-button>
            <span v-else class="lab-action-placeholder" aria-hidden="true"></span>
          </template>`
  : `<template v-if="!isCancelledOrder(order)">
            <el-button v-if="detailTab(order)==='order'" class="lab-plain-action" size="small"
              @click="notifyPending('ใบสั่ง')">ใบสั่ง</el-button>
            <span v-else class="lab-action-placeholder" aria-hidden="true"></span>
          </template>`
/* ผู้ใช้ยืนยัน 2026-09-21: ช่อง HN เดิมต้องพิมพ์ผ่าน local print agent ทันที ไม่เปิด
   sd-report preview; ช่องเดียวกันยังสลับเป็น "ดูผล" เมื่ออยู่แท็บ results เหมือนเดิม */
const hnPrintAction = hnOrderReportId
  ? `<el-button v-if="!isCancelledOrder(order)" class="lab-plain-action lab-hn-print" size="small"
            :loading="!!hnPrinting[orderRowKey(order)]"
            :disabled="!hnOrderReportReady(order)||!!hnPrinting[orderRowKey(order)]"
            :title="hnPrintHint(order)" @click="printHnLabel(order)">ปริ้น HN</el-button>`
  : `<el-button v-if="!isCancelledOrder(order)" class="lab-plain-action lab-hn-print" size="small" disabled
            title="ยังไม่ได้ตั้งค่า Report สำหรับพิมพ์ป้าย HN">ปริ้น HN</el-button>`
const form = JSON.parse(fs.readFileSync(formPath, 'utf8'))

/* ใช้ print-agent widget ชุดเดียวกับ X-ray ที่ผู้ใช้เคยให้นำเข้าและพิสูจน์แล้ว
   (รวมการตั้งค่าเชื่อมต่อของเครื่อง) เพื่อไม่สร้าง token/config ชุดใหม่ขึ้นเอง */
const xrayForm = JSON.parse(fs.readFileSync(xrayFormPath, 'utf8'))
const provenAgentField = Array.isArray(xrayForm.fields)
  ? xrayForm.fields.find(field => field && field.component === 'local-agent-ui' && field.options && field.options.name === 'local_agent')
  : null
if (!provenAgentField) throw new Error('proven X-ray local_agent print widget not found')
const localAgentField = JSON.parse(JSON.stringify(provenAgentField))
localAgentField.id = 'local-agent-ui-lab-printer'

// Reuse the proven document-level scanner settings from PIS_ห้องจ่ายยา, but keep
// LAB behavior deliberately smaller: HN selects patient context only. It never
// receives a specimen, creates a LAB NO., changes status, or sends to Agent.
const scanField = {
  key: 73904,
  name: 'Scan HN',
  component: 'scan-code-ui',
  category: 'display_ui',
  icon: 'scan-ui',
  fieldType: 'None',
  fieldLength: null,
  children: false,
  enable: true,
  formItemFlag: false,
  options: {
    name: 'scan_code',
    columnSpan: 4,
    hidden: false,
    disabled: false,
    preset: 'both',
    target: 'document',
    minLength: 6,
    avgTimeByChar: 30,
    extendedCharset: true,
    singleScanQty: 1,
    suffixKeyCodes: [13],
    indicator: 'badge',
    indicatorCorner: 'bottom-right',
    indicatorTimeout: 1,
    indicatorScanOnly: true,
    customClass: '',
    onCreated: '',
    onMounted: '',
    onUnmount: '',
    onScan: `const form=this.getFormRef&&this.getFormRef();
if(!form)return;
if(form.showPopupFlag)return;
const hn=String(value==null?'':value).replace(/\\D/g,'');
if(hn.length<6){this.notify('อ่าน HN ไม่ได้: '+String(value==null?'':value),'warning');return;}
const worklist=form.getFieldRef&&form.getFieldRef('lab_cpoe_worklist');
const state=worklist&&worklist.vueState;
if(!state||typeof state.scanPatientHn!=='function'){this.notify('ไม่พบ LAB Worklist สำหรับรับค่า HN','error');return;}
state.scanPatientHn(hn);`,
    onScanError: '',
    label: 'Scan HN'
  },
  id: 'scan-code-ui-lab-hn'
}

form.fields = Array.isArray(form.fields) ? form.fields : []
form.fields = form.fields.filter(field => !(field && field.options && ['scan_code', 'local_agent'].includes(field.options.name)))
form.fields.push(scanField)
form.fields.push(localAgentField)

const walk = (value, fn) => {
  if (!value || typeof value !== 'object') return
  fn(value)
  if (Array.isArray(value)) value.forEach(item => walk(item, fn))
  else Object.values(value).forEach(item => walk(item, fn))
}

let widget = null
walk(form, value => {
  if (value.name === 'lab_cpoe_worklist') widget = value
})
if (!widget) throw new Error('lab_cpoe_worklist widget not found')

widget.content = `<div class="lab-cpoe">
  <section aria-label="ค้นหาและกรองรายการ">
    <div class="lab-toolbar">
      <el-input class="lab-search-control" :model-value="filters.hn" size="small" clearable
        prefix-icon="Search" :placeholder="viewMode==='lookup'?'ระบุ HN…':(viewMode==='cbc_swap'?'ค้นหา HN ในรายการ CBC…':'ค้นหา HN / VN / LN / Order No. / ชื่อผู้ป่วย…')"
        @input="setSearch" @clear="applyFilters" @keyup.enter="applyFilters" />
      <el-date-picker class="lab-date-control" :model-value="filters.dates" size="small" type="daterange"
        :disabled="scanMode && statusKey==='complete'"
        range-separator="ถึง" start-placeholder="Date Range" end-placeholder="Date Range"
        value-format="YYYY-MM-DD" format="DD/MM/YYYY" @update:model-value="setDates" />
      <el-button size="small" type="primary" :loading="loading" @click="applyFilters">Search</el-button>
      <el-dropdown trigger="click" @command="reportCommand">
        <el-button size="small">Report <span class="lab-dropdown-caret">⌄</span></el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="pdf">PDF</el-dropdown-item>
            <el-dropdown-item command="excel">Excel</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-button class="lab-create-button" size="small" type="primary" :loading="createOrderLoading"
        :disabled="viewMode!=='today'" :title="viewMode!=='today'?'ใช้ปุ่มนี้จากแท็บรายการวันนี้':''"
        @click="openCreateOrder">สร้างรายการใหม่</el-button>
      <el-button class="lab-refresh-button" size="small" circle :loading="loading"
        title="รีเฟรชรายการ" aria-label="รีเฟรชรายการ" @click="refreshWorklist">
        <svg v-if="!loading" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 11a8 8 0 0 0-14.93-4M4 4v5h5M4 13a8 8 0 0 0 14.93 4M20 20v-5h-5" />
        </svg>
      </el-button>
    </div>

    <div v-if="scanMode" class="lab-scan-context" role="status" aria-live="polite">
      <span class="lab-scan-context-label">โหมดผู้ป่วยจากการสแกน</span>
      <strong class="lab-mono">HN {{ scannedHn }}</strong>
      <span v-if="statusKey==='complete'">แสดงประวัติออกผลครบทุกวัน</span>
      <span v-else>คง HN นี้ไว้เมื่อเปลี่ยนแท็บสถานะ</span>
      <el-button size="small" plain @click="clearScan">ล้าง HN ที่สแกน</el-button>
    </div>

    <div class="lab-view-tabs" role="tablist" aria-label="เลือกมุมมอง LAB Worklist">
      <button type="button" role="tab" :aria-selected="viewMode==='today'" :class="{'is-active':viewMode==='today'}" @click="setViewMode('today')">รายการวันนี้</button>
      <button type="button" role="tab" :aria-selected="viewMode==='lookup'" :class="{'is-active':viewMode==='lookup'}" @click="setViewMode('lookup')">สืบค้นผลแลป</button>
      <button v-if="canUseCbcSwap()" type="button" role="tab" :aria-selected="viewMode==='cbc_swap'" :class="{'is-active':viewMode==='cbc_swap'}" @click="setViewMode('cbc_swap')">
        สลับรายการ CBC <span v-if="cbcSwapCount" class="lab-tab-count">{{ cbcSwapCount }}</span>
      </button>
    </div>

    <div v-if="viewMode==='today'" class="lab-status-strip" role="group" aria-label="กรองรายการตามสถานะ">
      <button v-for="filter in statusFilters" :key="filter.key" type="button"
        class="lab-status-chip" :class="{'is-active':statusKey===filter.key}"
        :data-status="filter.key==='all'?'':filter.key" :aria-pressed="statusKey===filter.key"
        @click="setStatus(filter.key)">
        <strong>{{ counts[filter.key] || 0 }}</strong><span>{{ filter.label }}</span>
      </button>
      <div class="lab-status-legend" aria-label="คำอธิบายสีสถานะ">
        <span class="lab-status-legend-item"><i class="lab-status-legend-dot is-waiting" aria-hidden="true"></i><span>รอรับ</span></span>
        <span class="lab-status-legend-item"><i class="lab-status-legend-dot is-received" aria-hidden="true"></i><span>รับแล้ว</span></span>
        <span class="lab-status-legend-item"><i class="lab-status-legend-dot is-partial" aria-hidden="true"></i><span>ออกผลบางส่วน</span></span>
        <span class="lab-status-legend-item"><i class="lab-status-legend-dot is-complete" aria-hidden="true"></i><span>ออกผลครบ</span></span>
        <span class="lab-status-legend-item"><i class="lab-status-legend-dot is-cancelled" aria-hidden="true"></i><span>ยกเลิก / ปฏิเสธ</span></span>
      </div>
    </div>

    <div v-else-if="viewMode==='lookup'" class="lab-lookup-strip" role="tablist" aria-label="ประเภทข้อมูลที่ต้องการสืบค้น">
      <button type="button" role="tab" :aria-selected="lookupMode==='results'" :class="{'is-active':lookupMode==='results'}" @click="setLookupMode('results')">
        <span>ผลห้องแลป</span><strong>{{ lookupCounts.results || 0 }}</strong>
      </button>
      <button type="button" role="tab" :aria-selected="lookupMode==='orders'" :class="{'is-active':lookupMode==='orders'}" @click="setLookupMode('orders')">
        <span>รายการที่สั่ง</span><strong>{{ lookupCounts.orders || 0 }}</strong>
      </button>
      <small>อ่านอย่างเดียว · ทุกห้องแลป</small>
    </div>
    <div v-else class="lab-cbc-context" role="status">
      <div><strong>สลับรายการ CBC ระหว่าง HM และ ML</strong><span>แสดงทั้ง Order ที่มีรหัส HM1 หรือ MS1 แบบตรงตัว · สลับได้ก่อนรับ specimen เท่านั้น</span></div>
      <span class="lab-inline-tag lab-meta-pill">HM · ML</span>
    </div>
  </section>

  <div v-if="viewMode==='lookup'&&!lookupSearched" class="lab-lookup-empty" role="status">
    <strong>โปรดระบุ HN / เลือกวันที่</strong>
    <span>หากต้องการค้นหาทุกช่วงเวลา ต้องระบุ HN ก่อน</span>
  </div>
  <div v-else-if="loading" class="lab-list-summary">กำลังโหลดรายการ…</div>
  <div v-else-if="errorMessage" class="lab-list-summary is-error">
    {{ errorMessage }} <el-button size="small" @click="loadOrders">ลองใหม่</el-button>
  </div>
  <div v-else class="lab-list-summary">
    แสดง {{ orders.length }} Order จากทั้งหมด {{ page.total }}
    <span v-if="scanMode">· HN {{ scannedHn }}<template v-if="statusKey==='complete'"> · ทุกวันที่เคยออกผลครบ</template></span>
    <span v-if="viewMode==='lookup'">· ทุกห้องแลป · {{ filters.dates&&filters.dates.length===2 ? 'ช่วงวันที่ที่เลือก' : 'ทุกช่วงเวลา' }}</span>
  </div>

  <section v-if="viewMode==='cbc_swap'" class="lab-worklist-shell lab-cbc-shell" aria-label="รายการสลับ CBC">
    <div class="lab-cbc-table">
      <div class="lab-cbc-head" aria-hidden="true">
        <div></div><div>ผู้ป่วย</div><div></div><div>รายการ</div><div>Specimen</div><div>ห้องแลป</div>
        <div>เวลาสั่ง / Order No.</div><div>แพทย์</div><div>สถานะ</div><div>ดำเนินการ</div>
      </div>
      <article v-for="order in orders" :key="order.row_key||order.order_id" class="lab-patient-block" :class="{'is-open':isExpanded(order)}">
        <div class="lab-cbc-row" @click="toggleOrderFromRow(order,$event)">
          <button class="lab-expand-button" type="button" :aria-label="isExpanded(order)?'ย่อรายละเอียด':'ขยายรายละเอียด'" :aria-expanded="isExpanded(order)" @click="toggleOrder(order)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"></path></svg></button>
          <div class="lab-patient-summary">
            <div class="lab-patient-hn"><span class="lab-mono">{{ text(order.patient&&order.patient.hn) }}</span><span v-if="isUrgent(order)" class="lab-inline-tag lab-urgent-tag">เร่งด่วน</span></div>
            <div class="lab-patient-name">{{ patientName(order) }}</div>
            <div class="lab-patient-demographic"><span v-if="text(order.patient&&order.patient.gender_text)" class="lab-inline-tag lab-gender-pill">{{ text(order.patient.gender_text) }}</span><span v-if="orderAgeText(order)">{{ orderAgeText(order) }}</span></div>
          </div>
          <div class="lab-context-tags">
            <div class="lab-context-top"><span v-if="sourceRoom(order)" class="lab-inline-tag lab-meta-pill lab-source-pill">{{ sourceRoom(order) }}</span><span v-if="coverageAbbrev(order)" class="lab-inline-tag lab-meta-pill lab-coverage-pill">{{ coverageAbbrev(order) }}</span><span v-if="showPaymentStatus(order)" class="lab-inline-tag lab-meta-pill lab-payment-pill" :class="{'is-unpaid':!isFinancePassed(order)}">{{ isFinancePassed(order) ? 'ชำระเงินแล้ว' : 'ยังไม่ได้ชำระเงิน' }}</span></div>
            <span v-if="admissionNumber(order)" class="lab-admission-badge">AN : {{ admissionNumber(order) }}</span>
            <span class="lab-cbc-flag">🩸 CBC <span class="lab-mono">{{ text(cbcItem(order).item_code) }}</span> · {{ cbcItemCountText(order) }}</span>
          </div>
          <div class="lab-metric lab-items-cell" data-label="รายการ"><span class="lab-field-value">{{ displayItemCount(order) }} orders</span></div>
          <div class="lab-metric lab-specimen-cell" data-label="Specimen"><span class="lab-field-value">{{ specimenCount(order) }} specimens</span></div>
          <div class="lab-cbc-section-cell"><span v-for="code in cbcSectionCodes(order)" :key="code" class="lab-section-code" :class="{'is-other':code!==text(cbcItem(order).section_code)}">{{ code }}</span></div>
          <div class="lab-metric lab-order-cell"><span class="lab-order-no-tag">{{ text(order.order_number) }}</span><span class="lab-field-value lab-time-value lab-mono"><span>{{ datePart(order.requested_at) }}</span><span>{{ timePart(order.requested_at) }}</span></span></div>
          <div class="lab-doctor-cell"><span class="lab-field-value" :title="requesterName(order)">{{ requesterName(order) }}</span><span class="lab-diagnosis-summary">Diagnosis:<template v-if="diagnosisText(order)"> {{ diagnosisText(order) }}</template></span></div>
          <div class="lab-row-status-check" role="img" :aria-label="orderStatusCountAria(order)" :title="orderStatusCountAria(order)"><span v-for="step in orderStatusCounts(order)" :key="step.key" class="lab-order-status-step" :class="step.dot_class" :title="step.title"><i class="lab-order-status-dot" aria-hidden="true"></i><b>{{ step.count }}</b></span></div>
          <div class="lab-cbc-action"><el-button type="primary" size="small" :disabled="!cbcItem(order).swap_allowed" :title="cbcItem(order).swap_allowed?'สลับเฉพาะรายการ CBC ไปยังอีกห้อง':'รายการ CBC นี้รับ specimen หรือเริ่มดำเนินการแล้ว'" @click.stop="openCbcSwap(order)">สลับรายการ</el-button><small v-if="order.item_count>1">สลับเฉพาะรายการ CBC</small></div>
        </div>
        <div v-if="isExpanded(order)" class="lab-detail-panel lab-cbc-detail">
          <div class="lab-detail-top" role="tablist">
            <button class="lab-detail-tab" :class="{'is-active':detailTab(order)==='order'}" type="button" role="tab" :aria-selected="detailTab(order)==='order'" @click="setDetailTab(order,'order')">order</button>
            <button class="lab-detail-tab" :class="{'is-active':detailTab(order)==='results'}" type="button" role="tab" :aria-selected="detailTab(order)==='results'" @click="setDetailTab(order,'results')">ออกผล</button>
            <span class="lab-cbc-readonly-note">แท็บนี้ดูอย่างเดียว — รับ specimen / ปฏิเสธ / ยกเลิก ทำที่แท็บ “รายการวันนี้”</span>
          </div>
          <div v-if="detailTab(order)==='order'" class="lab-cbc-item-wrap">
            <div class="lab-cbc-item-grid lab-cbc-item-head"><div></div><div>ลำดับ</div><div>Lab no.</div><div>รายการสั่งตรวจ</div><div>specimen</div><div>เวลาเก็บ specimen</div><div>ห้องแลป</div><div>สถานะ</div><div>หมายเหตุ</div></div>
            <div v-for="(item,index) in order.items" :key="item.item_id" class="lab-cbc-item-grid lab-cbc-item-row" :class="{'is-cbc':isCbcSwapItem(order,item)}">
              <div></div><div class="lab-mono">{{ index+1 }}</div><div class="lab-mono">{{ text(item.lab_no)||'—' }}</div>
              <div class="lab-test-name"><span :class="{'lab-cbc-item-code':isCbcSwapItem(order,item)}">{{ text(item.item_code) }}</span> {{ text(item.item_name) }}</div>
              <div>{{ specimenDisplay(item) }}</div><div class="lab-mono">{{ cbcDateTime(item.specimen&&item.specimen.ordered&&item.specimen.ordered.collected_at) }}</div>
              <div><span class="lab-section-code" :class="{'is-other':!isCbcSwapItem(order,item)}">{{ text(item.section_code)||'-' }}</span></div>
              <div><span class="lab-state-tag" :class="statusClass(item.current_status)">{{ statusText(item.current_status) }}</span></div>
              <div><span v-if="isCbcSwapItem(order,item)" class="lab-cbc-swappable-tag">{{ cbcItem(order).swap_allowed?'สลับได้':'สลับไม่ได้' }}</span></div>
            </div>
          </div>
          <div v-else class="lab-result-list is-lookup">
            <div class="lab-result-list-head"><div>ลำดับ</div><div>รายการสั่งตรวจ</div><div>เวลาออกผล</div><div>สถานะ</div></div>
            <div v-for="(item,index) in resultItems(order)" :key="'cbc-result-'+item.item_id" class="lab-result-list-row"><div class="lab-mono">{{ index+1 }}</div><div class="lab-test-name">{{ text(item.item_code) }} {{ text(item.item_name) }}</div><div class="lab-mono">{{ resultTime(item) }}</div><div class="lab-result-list-status"><span class="lab-critical-status" :class="resultStatusClass(item)">{{ resultStatusText(item) }}</span><span v-if="criticalValue(item)===true" class="lab-critical-status is-critical">ค่าวิกฤติ</span><span v-if="resultHiddenItem(item)" class="lab-result-hidden-tag">ปกปิด</span></div></div>
            <div v-if="!resultItems(order).length" class="lab-empty">ไม่มีรายการผลตรวจใน Order นี้</div>
          </div>
        </div>
      </article>
      <div v-if="!loading&&!orders.length" class="lab-empty"><strong>ไม่พบรายการ HM1 / MS1 ที่สลับได้</strong><br />รายการที่รับ specimen แล้วจะไม่แสดงเป็นรายการที่ดำเนินการได้</div>
    </div>
  </section>

  <section v-else-if="viewMode==='today'||lookupSearched" class="lab-worklist-shell" aria-label="รายการผู้ป่วย">
    <div class="lab-worklist">
      <div class="lab-list-head" :class="{'is-lookup':viewMode==='lookup'}" aria-hidden="true">
        <div></div><div>ผู้ป่วย</div><div></div><div>รายการ</div><div>Specimen</div><div v-if="viewMode==='lookup'">ห้องแลป</div>
        <div>เวลาสั่ง / Order No.</div><div>แพทย์</div><div>สถานะ</div>
        <div>{{ statusKey==='cancelled' ? 'ดำเนินการ' : 'PDF' }}</div><div>{{ statusKey==='cancelled' ? '' : (detailTab(order)==='results' ? 'ดูผล' : 'HN') }}</div><div>{{ statusKey==='cancelled' ? '' : 'EMR' }}</div>
      </div>

      <article v-for="order in orders" :key="order.row_key||order.order_id" class="lab-patient-block"
        :class="{'is-open':isExpanded(order)}">
        <div class="lab-patient-row" :class="{'is-lookup':viewMode==='lookup'}" @click="toggleOrderFromRow(order,$event)">
          <button class="lab-expand-button" type="button"
            :aria-label="isExpanded(order)?'ย่อรายละเอียด':'ขยายรายละเอียด'"
            :aria-expanded="isExpanded(order)" @click="toggleOrder(order)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"></path></svg>
          </button>

          <div class="lab-patient-summary">
            <div class="lab-patient-hn">
              <span class="lab-mono">{{ text(order.patient && order.patient.hn) || '' }}</span>
              <span v-if="isUrgent(order)" class="lab-inline-tag lab-urgent-tag">เร่งด่วน</span>
            </div>
            <div class="lab-patient-name">{{ patientName(order) || '' }}</div>
            <div class="lab-patient-demographic">
              <span v-if="text(order.patient && order.patient.gender_text)" class="lab-inline-tag lab-gender-pill">
                {{ text(order.patient.gender_text) }}
              </span>
              <span v-if="orderAgeText(order)">{{ orderAgeText(order) }}</span>
            </div>
          </div>

          <div class="lab-context-tags">
            <div class="lab-context-top">
              <span v-if="sourceRoom(order)" class="lab-inline-tag lab-meta-pill lab-source-pill">{{ sourceRoom(order) }}</span>
              <span v-if="coverageAbbrev(order)" class="lab-inline-tag lab-meta-pill lab-coverage-pill">{{ coverageAbbrev(order) }}</span>
              <span v-if="showPaymentStatus(order)" class="lab-inline-tag lab-meta-pill lab-payment-pill" :class="{'is-unpaid':!isFinancePassed(order)}">{{ isFinancePassed(order) ? 'ชำระเงินแล้ว' : 'ยังไม่ได้ชำระเงิน' }}</span>
            </div>
            <span v-if="admissionNumber(order)" class="lab-admission-badge">AN : {{ admissionNumber(order) }}</span>
            <span v-if="hasPriorMedication(order)" class="lab-prior-medication">💊 {{ priorMedicationText(order) }}</span>
          </div>

          <div class="lab-metric lab-items-cell" data-label="รายการ">
            <el-tooltip placement="top" :disabled="!itemTooltipLines(order).length" popper-class="lab-cpoe-list-popper">
              <span class="lab-field-value lab-hover-summary">{{ displayItemCount(order) }} orders</span>
              <template #content>
                <div v-for="(line,index) in itemTooltipLines(order)" :key="'item-'+index" class="lab-pop-line">{{ line }}</div>
              </template>
            </el-tooltip>
          </div>
          <div class="lab-metric lab-specimen-cell" data-label="Specimen">
            <el-tooltip placement="top" :disabled="!specimenTooltipLines(order).length" popper-class="lab-cpoe-list-popper">
              <span class="lab-field-value lab-hover-summary">{{ specimenCount(order) }} specimens</span>
              <template #content>
                <div v-for="(line,index) in specimenTooltipLines(order)" :key="'specimen-'+index" class="lab-pop-line">{{ line }}</div>
              </template>
            </el-tooltip>
          </div>
          <div v-if="viewMode==='lookup'" class="lab-metric lab-section-cell" data-label="ห้องแลป"><span class="lab-section-code">{{ reportSectionCode(order) || '-' }}</span></div>
          <div class="lab-metric lab-order-cell" data-label="เวลาสั่ง / Order No.">
            <span class="lab-order-no-tag">{{ text(order.order_number) || '' }}</span>
            <span class="lab-field-value lab-time-value lab-mono">
              <span>{{ datePart(order.requested_at) }}</span><span>{{ timePart(order.requested_at) }}</span>
            </span>
          </div>

          <div class="lab-doctor-cell" data-label="แพทย์">
            <span class="lab-field-value" :title="requesterName(order)">{{ requesterName(order) || '' }}</span>
            <el-tooltip placement="top" :disabled="!diagnosisText(order)" popper-class="lab-cpoe-diagnosis-popper">
              <span class="lab-diagnosis-summary">Diagnosis:<template v-if="diagnosisText(order)"> {{ diagnosisText(order) }}</template></span>
              <template #content><div class="lab-diagnosis-pop">{{ diagnosisText(order) }}</div></template>
            </el-tooltip>
          </div>
          <!-- สถานะระดับ Order แสดงจำนวน Item ต่อสี; ชื่อสถานะอ่านจาก legend ด้านบน -->
          <div class="lab-row-status-check" role="img" :aria-label="orderStatusCountAria(order)" :title="orderStatusCountAria(order)">
            <span v-for="step in orderStatusCounts(order)" :key="step.key" class="lab-order-status-step" :class="step.dot_class" :title="step.title">
              <i class="lab-order-status-dot" aria-hidden="true"></i><b>{{ step.count }}</b>
            </span>
          </div>
          <div class="lab-row-action lab-row-action-pdf">
            ${orderRequestPdfAction}
            <el-button v-else-if="viewMode==='today'" class="lab-plain-action" type="primary" size="small"
              :loading="isRetesting(order)" :disabled="isRetesting(order)"
              title="นำรายการเดิมกลับไปรอรับ specimen · ล้าง LAB NO. เดิมและสร้างใหม่เมื่อกดรับ"
              @click="retestOrder(order)">ตรวจใหม่</el-button>
            <span v-else class="lab-action-placeholder" aria-hidden="true"></span>
          </div>
          <div class="lab-row-action lab-row-action-hn">
            <el-button v-if="!isCancelledOrder(order)&&detailTab(order)==='results'&&!isMicrobiologyOrder(order)" class="lab-plain-action" size="small"
              :disabled="!resultItems(order).length"
              :aria-label="(isManualPathologyOrder(order)?'ลงผล':'ดูผล')+'ของ '+(text(order.patient&&order.patient.hn)||'Order นี้')"
              @click="openOrderResults(order)">{{ isManualPathologyOrder(order) ? 'ลงผล' : 'ดูผล' }}</el-button>
            <span v-else-if="!isCancelledOrder(order)&&detailTab(order)==='results'" class="lab-action-placeholder" aria-hidden="true"></span>
            <template v-else>
              ${hnPrintAction}
              <span v-else class="lab-action-placeholder" aria-hidden="true"></span>
            </template>
          </div>
          <div class="lab-row-action lab-row-action-emr">
            <el-button v-if="!isCancelledOrder(order)" class="lab-plain-action" size="small" @click="openEmr(order)">EMR</el-button>
            <span v-else class="lab-action-placeholder" aria-hidden="true"></span>
          </div>
        </div>

        <div v-if="isExpanded(order)" class="lab-detail-panel">
          <div class="lab-detail-top" role="tablist">
            <button class="lab-detail-tab" :class="{'is-active':detailTab(order)==='order'}" type="button"
              role="tab" :aria-selected="detailTab(order)==='order'" @click="setDetailTab(order,'order')">order</button>
            <button class="lab-detail-tab" :class="{'is-active':detailTab(order)==='results'}" type="button"
              role="tab" :aria-selected="detailTab(order)==='results'"
              title="ดูผลตรวจของรายการใน Order"
            @click="setDetailTab(order,'results')">ออกผล</button>
            <div v-if="detailTab(order)==='order'&&viewMode==='today'" class="lab-bulk-actions">
              <el-tooltip placement="top" :disabled="!receiveDisabledReason(order)"
                :content="receiveDisabledReason(order)" popper-class="lab-cpoe-list-popper">
                <span class="lab-receive-tooltip">
                  <el-button size="small" type="success" :loading="receiveLoading"
                    :disabled="!canReceiveOrder(order)||receiveLoading||rejectLoading||cancelDialog.loading" @click="receiveSelected(order)">รับ specimen</el-button>
                </span>
              </el-tooltip>
              <el-button size="small" type="warning" :loading="rejectLoading"
                :disabled="selectedCount(order)!==1||receiveLoading||rejectLoading||cancelDialog.loading"
                @click="rejectSelected(order)">ปฏิเสธรายการที่เลือก</el-button>
              <el-button size="small" type="danger" :loading="cancelDialog.loading&&cancelDialog.order===order"
                :disabled="!canCancelOrder(order)||receiveLoading||rejectLoading||cancelDialog.loading"
                @click="openCancelOrder(order)">ยกเลิก order</el-button>
            </div>
          </div>

          <div v-if="detailTab(order)==='order'" class="lab-item-grid-wrap">
            <div class="lab-item-grid lab-item-head" :class="{'is-microbiology':isMicrobiologyOrder(order)}">
              <div class="lab-item-check-cell"><el-checkbox :model-value="allSelectableChecked(order)"
                :indeterminate="someSelectableChecked(order)" :disabled="viewMode==='lookup'||!selectableItems(order).length"
                aria-label="เลือกทุกรายการที่รอรับ" @change="toggleAll(order)" /></div>
              <div>ลำดับ</div><div>Lab no.</div><div>รายการสั่งตรวจ</div><div>specimen</div>
              <div>เวลาเก็บ / การเก็บรักษา</div><div>เวลารับ specimen</div><div>สถานะ</div><div>เหตุผล</div><div>ผู้ดำเนินการ</div><div v-if="isMicrobiologyOrder(order)">ลงผล</div><div>ดำเนินการ</div>
            </div>
            <div v-for="(item,index) in displayItems(order)" :key="displayItemKey(item,index)" class="lab-item-grid lab-item-row"
              :class="{'is-selectable':viewMode==='today'&&isPendingReceiveItem(item),'is-selected':isSelected(item.item_id),'is-microbiology':isMicrobiologyOrder(order)}"
              @click="selectRow(order,item,$event)">
              <div data-label="เลือก" class="lab-item-check-cell"><el-checkbox v-if="isFirstQuantityRow(item)||isManualPathologyItem(item)" :model-value="isSelected(item.item_id)"
                :disabled="viewMode==='lookup'||!isPendingReceiveItem(item)" @change="toggleItem(order,item.item_id)" /></div>
              <div data-label="ลำดับ" class="lab-mono">{{ index+1 }}</div>
              <div data-label="Lab no." class="lab-mono">{{ text(item.lab_no) || '' }}</div>
              <div data-label="รายการสั่งตรวจ" class="lab-test-name">
                <div>{{ text(item.item_code) }} {{ text(item.item_name) }}</div>
                <div v-if="requiresItemComment(item)" class="lab-order-condition" :class="{'is-missing':!itemCommentText(item)}">
                  <span>ต้องระบุหมายเหตุ</span>
                  <strong>{{ itemCommentText(item) || 'ไม่พบหมายเหตุจากใบสั่ง' }}</strong>
                </div>
              </div>
              <div data-label="specimen" class="lab-item-specimen-cell">
                <div v-if="usesSpecimenDetailPattern(item)" class="lab-multi-specimen-list">
                  <div v-for="(row,rowIndex) in multiSpecimenRows(item)" :key="item.item_id+'-specimen-'+specimenRowOriginalIndex(item,rowIndex)" class="lab-multi-specimen-entry">
                    <el-input v-if="isSpecimenLockedItem(item)" class="lab-specimen-select lab-specimen-locked"
                      size="small" :model-value="specimenRowName(row)" disabled
                      @mousedown.prevent @click.stop />
                    <el-select v-else class="lab-specimen-select" :class="{'lab-specimen-changed':specimenRowChanged(item,row,specimenRowOriginalIndex(item,rowIndex))}"
                      size="small" :model-value="specimenRowValue(item,row,specimenRowOriginalIndex(item,rowIndex))" placeholder="ค้นหา / เลือก specimen"
                      filterable default-first-option :loading="!!specimenSaving[specimenSelectionKey(item,specimenRowOriginalIndex(item,rowIndex))]"
                      :disabled="viewMode==='lookup'||!isPendingReceiveItem(item)||!!specimenSaving[specimenSelectionKey(item,specimenRowOriginalIndex(item,rowIndex))]"
                      @change="setSpecimen(item,$event,specimenRowOriginalIndex(item,rowIndex))">
                      <el-option v-for="option in specimenOptions(item)" :key="option.value"
                        :label="option.label" :value="option.value" />
                    </el-select>
                    <span v-if="specimenRowSite(row)" class="lab-specimen-site">ตำแหน่ง&nbsp; {{ specimenRowSite(row) }}</span>
                  </div>
                  <div v-if="!multiSpecimenRows(item).length" class="lab-multi-specimen-empty">ไม่พบรายการ specimen จากใบสั่ง</div>
                </div>
                <el-input v-else-if="isSpecimenLockedItem(item)" class="lab-specimen-select lab-specimen-locked"
                  size="small" :model-value="specimenDisplay(item)" disabled
                  @mousedown.prevent @click.stop />
                <el-select v-else class="lab-specimen-select" :class="{'lab-specimen-changed':specimenChanged(item)}"
                  size="small" :model-value="specimenValue(item)" placeholder="ค้นหา / เลือก specimen"
                  filterable default-first-option :loading="!!specimenSaving[item.item_id]"
                  :disabled="viewMode==='lookup'||!isPendingReceiveItem(item)||!!specimenSaving[item.item_id]"
                  @change="setSpecimen(item,$event)">
                  <el-option v-for="option in specimenOptions(item)" :key="option.value"
                    :label="option.label" :value="option.value" />
                </el-select>
              </div>
              <div data-label="เวลาเก็บ / การเก็บรักษา" class="lab-item-collected-time">
                <template v-if="usesSpecimenDetailPattern(item)">
                  <div v-for="(row,rowIndex) in multiSpecimenRows(item)" :key="item.item_id+'-collection-'+specimenRowOriginalIndex(item,rowIndex)" class="lab-multi-collection-entry">
                    <div class="lab-mono lab-collected-date-time">
                      <span>{{ datePart(specimenRowCollectedAt(row)) }}</span>
                      <span>{{ timePart(specimenRowCollectedAt(row)) }}</span>
                    </div>
                    <div v-if="specimenRowStorageText(row) || specimenRowTemperatureText(row)" class="lab-specimen-condition-line">
                      <span v-if="specimenRowStorageText(row)" class="lab-specimen-storage" :class="specimenRowStorageClass(row)">{{ specimenRowStorageText(row) }}</span>
                      <span v-if="specimenRowTemperatureText(row)" class="lab-specimen-temperature" :class="specimenRowStorageClass(row)">{{ specimenRowTemperatureText(row) }}</span>
                    </div>
                    <div class="lab-specimen-source-line">
                      <span class="lab-specimen-source-label">Source:</span>
                      <el-tooltip placement="top" :disabled="!specimenRowSourceText(row)"
                        :content="specimenRowSourceText(row)" popper-class="lab-cpoe-source-popper">
                        <span class="lab-specimen-source" :class="{'is-empty':!specimenRowSourceText(row)}">{{ specimenRowSourceText(row) || 'ไม่ระบุ' }}</span>
                      </el-tooltip>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <div class="lab-mono lab-collected-date-time">
                    <span>{{ datePart(item.specimen && item.specimen.ordered && item.specimen.ordered.collected_at) }}</span>
                    <span>{{ timePart(item.specimen && item.specimen.ordered && item.specimen.ordered.collected_at) }}</span>
                  </div>
                  <span v-if="specimenStorageText(item)" class="lab-specimen-storage" :class="specimenStorageClass(item)">{{ specimenStorageText(item) }}</span>
                  <div class="lab-specimen-source-line">
                    <span class="lab-specimen-source-label">Source:</span>
                    <el-tooltip placement="top" :disabled="!specimenSourceText(item)"
                      :content="specimenSourceText(item)" popper-class="lab-cpoe-source-popper">
                      <span class="lab-specimen-source" :class="{'is-empty':!specimenSourceText(item)}">{{ specimenSourceText(item) || 'ไม่ระบุ' }}</span>
                    </el-tooltip>
                  </div>
                </template>
              </div>
              <div data-label="เวลารับ specimen" class="lab-item-received-time">
                <div class="lab-mono lab-received-date-time">
                  <span>{{ datePart(item.received_at) || compactDateTime(item.received_at) }}</span>
                  <span v-if="timePart(item.received_at)">{{ timePart(item.received_at) }}</span>
                </div>
              </div>
              <div data-label="สถานะ"><span class="lab-state-tag" :class="statusClass(item.current_status)">
                {{ statusText(item.current_status) }}</span></div>
              <div data-label="เหตุผล">{{ actionReasonText(item) }}</div>
              <div data-label="ผู้ดำเนินการ" class="lab-item-actor-cell">{{ actionActorText(item) }}</div>
              <div v-if="isMicrobiologyOrder(order)" data-label="ลงผล" class="lab-mb-order-result-entry" @click.stop>
                <sd-report v-if="isMicrobiologyItem(item)&&microbiologyRequestPdfReady(item)" :report-list="microbiologyRequestPdfReportList" :params="microbiologyRequestPdfParams(item)" size="small" />
                <el-button v-else size="small" plain disabled :title="microbiologyRequestPdfHint(item)">ลงผล</el-button>
              </div>
              <div data-label="ดำเนินการ" class="lab-item-action-cell">
                <el-button v-if="canRetestItem(item)" size="small" plain type="primary"
                  :loading="itemRetestDialog.loading&&itemRetestDialog.item===item"
                  :disabled="itemRetestDialog.loading" @click.stop="openItemRetest(order,item)">ตรวจใหม่</el-button>
              </div>
            </div>
          </div>

          <div v-else class="lab-result-list" :class="{'is-lookup':viewMode==='lookup','is-microbiology':isMicrobiologyOrder(order)}">
            <div class="lab-result-list-head"><div>ลำดับ</div><div>รายการสั่งตรวจ</div><div>เวลาออกผล</div><div v-if="viewMode==='today'">การแสดงผล</div><div>สถานะ</div><div>ผู้ออกผล</div><div>ผู้ยืนยัน</div><div v-if="isMicrobiologyOrder(order)">ดูผล</div></div>
            <div v-for="(item,index) in resultDisplayItems(order)" :key="'result-'+displayItemKey(item,index)" class="lab-result-list-row">
              <div class="lab-mono">{{ index+1 }}</div>
              <div class="lab-test-name">{{ text(item.item_code) }} {{ text(item.item_name) }}</div>
              <div class="lab-mono">{{ resultTime(item) }}</div>
              <div v-if="viewMode==='today'">
                <el-button size="small" plain
                  :type="resultHiddenItem(item) ? 'primary' : 'danger'"
                  :loading="visibilityDialog.loading && manual.item===item"
                  :disabled="visibilityDialog.loading"
                  @click="openItemResultVisibility(item,order)">
                  {{ resultHiddenItem(item) ? 'ยกเลิกปกปิด' : 'ปกปิดผล' }}
                </el-button>
              </div>
              <div class="lab-result-list-status"><span class="lab-critical-status" :class="resultStatusClass(item)">{{ resultStatusText(item) }}</span><span v-if="criticalValue(item)===true" class="lab-critical-status is-critical">ค่าวิกฤติ</span><span v-if="resultHiddenItem(item)" class="lab-result-hidden-tag">ปกปิด</span></div>
              <div class="lab-result-actor" data-label="ผู้ออกผล" :title="resultReporterFor(item)">{{ resultReporterFor(item) }}</div>
              <div class="lab-result-actor" data-label="ผู้ยืนยัน" :title="resultVerifierFor(item)">{{ resultVerifierFor(item) }}</div>
              <div v-if="isMicrobiologyOrder(order)" class="lab-result-test-action" data-label="ดูผล">
                <el-button size="small" type="primary" plain @click.stop="openResult(item,order,false)">ดูผล</el-button>
              </div>
            </div>
            <div v-if="!resultItems(order).length" class="lab-empty">ไม่มีรายการผลตรวจใน Order นี้</div>
          </div>
        </div>
      </article>

      <div v-if="!loading && !orders.length" class="lab-empty">
        <strong>ไม่พบรายการ</strong><br />
        <template v-if="scanMode">ไม่พบ Order ของ HN {{ scannedHn }} ในสถานะนี้</template>
        <template v-else-if="viewMode==='lookup'">ไม่พบข้อมูลตาม HN หรือช่วงวันที่ที่ระบุ</template>
        <template v-else>ลองเปลี่ยนคำค้น ช่วงวันที่ หรือสถานะ</template>
      </div>
    </div>
  </section>

  <div v-if="(viewMode==='today'||viewMode==='cbc_swap'||lookupSearched)&&page.total>page.size" class="lab-pagination">
    <el-pagination :current-page="page.current" :page-size="page.size"
      :page-sizes="[10,20,30,50,100]" :total="page.total" size="small" background
      layout="total, sizes, prev, pager, next, jumper"
      @current-change="setPage" @size-change="setPageSize" />
  </div>

  <el-dialog v-model="cbcSwapDialog.visible" class="lab-cbc-swap-dialog" width="min(760px,94vw)"
    :close-on-click-modal="false" :close-on-press-escape="!cbcSwapDialog.loading" :show-close="!cbcSwapDialog.loading" @closed="resetCbcSwapDialog">
    <template #header>
      <div class="lab-cbc-dialog-head">
        <strong>ยืนยันสลับรายการ CBC</strong>
        <small>Order No. {{ text(cbcSwapOrder().order_number) || '-' }} · {{ cbcDateTime(cbcSwapOrder().requested_at) }}</small>
      </div>
    </template>
    <div class="lab-cbc-dialog-body">
      <div class="lab-cbc-patient-card">
        <span class="lab-cbc-avatar">{{ cbcSwapPatientInitials() }}</span>
        <div><strong>{{ patientName(cbcSwapOrder()) }}</strong><small>{{ cbcSwapPatientMeta() }}</small></div>
        <span class="lab-inline-tag lab-meta-pill lab-source-pill">{{ cbcSwapOrder().item_count || 0 }} รายการใน Order</span>
      </div>
      <div class="lab-cbc-swap-summary">
        <div class="lab-cbc-swap-cell is-from"><span>รายการเดิม</span><strong>{{ cbcSwapFromCode() }}</strong><b>{{ text(cbcSwapDialog.item && cbcSwapDialog.item.item_name) }}</b><small class="lab-section-code">{{ cbcSwapFromSection() }}</small></div>
        <i aria-hidden="true">→</i>
        <div class="lab-cbc-swap-cell is-target"><span>เปลี่ยนเป็น</span><strong>{{ cbcSwapTargetCode() }}</strong><b>{{ text(cbcSwapDialog.item && cbcSwapDialog.item.item_name) }}</b><small class="lab-section-code">{{ cbcSwapTargetSection() }}</small></div>
      </div>
      <ul class="lab-cbc-swap-facts">
        <li>Order นี้จะเข้าคิว <b>ห้อง {{ cbcSwapTargetSection() }} — {{ cbcSwapTargetSectionName() }}</b> ในแท็บ “รายการวันนี้” ตามปกติ</li>
        <li>รายการอื่นใน Order ยังอยู่ห้องเดิม ไม่ถูกย้ายตาม</li>
        <li>รายการเดิมที่แพทย์สั่งถูกเก็บเป็นประวัติ · LAB NO. ยังไม่ออกจนกว่าจะกดรับ specimen</li>
      </ul>
      <label class="lab-cbc-reason"><span>เหตุผลที่สลับ <small>(ไม่บังคับ)</small></span><el-select v-model="cbcSwapDialog.reasonCode" clearable filterable placeholder="— ไม่ระบุ —"><el-option v-for="option in cbcSwapReasonOptions" :key="option.value" :label="option.label" :value="option.value" /></el-select></label>
      <label v-if="cbcSwapDialog.reasonCode==='other'" class="lab-cbc-reason"><span>รายละเอียดเพิ่มเติม</span><el-input v-model="cbcSwapDialog.reasonDetail" type="textarea" :rows="2" maxlength="1000" show-word-limit placeholder="ระบุเหตุผลเพิ่มเติม" /></label>
    </div>
    <template #footer><el-button :disabled="cbcSwapDialog.loading" @click="cbcSwapDialog.visible=false">ยกเลิก</el-button><el-button type="primary" :loading="cbcSwapDialog.loading" @click="submitCbcSwap">ยืนยันสลับรายการ</el-button></template>
  </el-dialog>

  <el-dialog v-model="cancelDialog.visible" title="ยกเลิก LAB Order" width="min(560px,94vw)"
    :close-on-click-modal="false" :close-on-press-escape="!cancelDialog.loading" :show-close="!cancelDialog.loading"
    @closed="resetCancelDialog">
    <div class="lab-cancel-summary">
      <strong>Order No. {{ text(cancelDialog.order && cancelDialog.order.order_number) || '' }}</strong>
      <span>ระบบจะยกเลิกเฉพาะ LAB Item ของ Section นี้ใน Order เดิม และเก็บผู้ทำรายการกับเวลาไว้ใน audit</span>
      <span>ยกเลิกเฉพาะฝั่ง HIS โดยไม่ส่งคำสั่งยกเลิกไป Agent/LIS</span>
    </div>
    <div class="lab-cancel-finance" :class="cancelFinanceClass()">
      <template v-if="cancelDialog.financeLoading">
        <strong>กำลังตรวจสอบสถานะการเงิน...</strong>
        <span>กรุณารอสักครู่ ระบบกำลังตรวจ Bill และใบเสร็จล่าสุด</span>
      </template>
      <template v-else>
        <strong>{{ cancelFinanceTitle() }}</strong>
        <span>{{ cancelDialog.financeMessage || 'ยังไม่ได้ตรวจสอบสถานะการเงิน' }}</span>
        <span v-if="cancelDialog.receiptNumbers && cancelDialog.receiptNumbers.length">
          ใบเสร็จ: {{ cancelDialog.receiptNumbers.join(', ') }}
        </span>
        <el-button v-if="cancelDialog.financeChecked && !cancelDialog.canCancel" size="small" plain
          :loading="cancelDialog.financeLoading" :disabled="cancelDialog.loading"
          @click="checkCancelFinance">ตรวจสอบสถานะการเงินอีกครั้ง</el-button>
      </template>
    </div>
    <label class="lab-cancel-reason"><span>เหตุผลการยกเลิก <b>*</b></span>
      <el-select v-model="cancelDialog.reason" filterable clearable
        :disabled="cancelDialog.loading||cancelDialog.financeLoading||!cancelDialog.canCancel"
        placeholder="กรุณาเลือกเหตุผล">
        <el-option v-for="option in cancelReasonOptions" :key="option.value"
          :label="option.label" :value="option.value" />
      </el-select>
    </label>
    <template #footer>
      <el-button :disabled="cancelDialog.loading" @click="cancelDialog.visible=false">ไม่ยกเลิก</el-button>
      <el-button type="danger" :loading="cancelDialog.loading"
        :disabled="cancelDialog.financeLoading||!cancelDialog.financeChecked||!cancelDialog.canCancel||!text(cancelDialog.reason)"
        @click="submitCancelOrder">ยืนยันยกเลิก Section นี้</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="itemRetestDialog.visible" title="เปิดตรวจใหม่เฉพาะรายการ" width="min(560px,94vw)"
    :close-on-click-modal="false" :close-on-press-escape="!itemRetestDialog.loading" :show-close="!itemRetestDialog.loading"
    @closed="resetItemRetestDialog">
    <div class="lab-cancel-summary">
      <strong>{{ text(itemRetestDialog.item && itemRetestDialog.item.item_code) }} {{ text(itemRetestDialog.item && itemRetestDialog.item.item_name) }}</strong>
      <span>รายการที่ปฏิเสธเดิมและ LAB NO. เดิมจะถูกเก็บเป็นประวัติ แล้วสร้างรอบตรวจใหม่ใน Order เดิม</span>
      <span>LAB NO. ใหม่จะออกเมื่อกดรับ specimen รอบใหม่</span>
    </div>
    <label class="lab-cancel-reason"><span>เหตุผลเปิดตรวจใหม่ <b>*</b></span>
      <el-select v-model="itemRetestDialog.reasonCode" :disabled="itemRetestDialog.loading" placeholder="กรุณาเลือกเหตุผล">
        <el-option v-for="option in itemRetestReasonOptions" :key="option.value" :label="option.label" :value="option.value" />
      </el-select>
    </label>
    <label class="lab-cancel-reason lab-item-retest-detail"><span>รายละเอียด<span v-if="itemRetestDialog.reasonCode==='other'"> *</span></span>
      <el-input v-model="itemRetestDialog.reasonDetail" type="textarea" :rows="3" maxlength="500" show-word-limit
        :disabled="itemRetestDialog.loading" placeholder="ระบุรายละเอียดเพิ่มเติม" />
    </label>
    <template #footer>
      <el-button :disabled="itemRetestDialog.loading" @click="itemRetestDialog.visible=false">ยกเลิก</el-button>
      <el-button type="primary" :loading="itemRetestDialog.loading" :disabled="!itemRetestReasonValid()"
        @click="submitItemRetest">ยืนยันเปิดตรวจใหม่</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="pathology.visible" class="lab-pathology-dialog" width="min(1320px,calc(100vw - 64px))"
    :close-on-click-modal="false" :close-on-press-escape="!pathology.saving&&!pathology.finalizing"
    :show-close="!pathology.saving&&!pathology.finalizing" destroy-on-close @closed="resetPathology">
    <template #header>
      <div class="lab-pathology-head">
        <div>
          <div class="lab-pathology-title"><strong>ลงผลตรวจห้องพยาธิ</strong><span>MY</span><span class="is-manual">Manual result</span>
            <button v-if="viewMode==='today'" class="lab-result-edit-button" type="button"
              :disabled="!pathologyCanEdit()" :aria-pressed="pathology.editing"
              :aria-label="pathology.editing ? 'ยกเลิกการแก้ไขผลห้องพยาธิ' : 'แก้ไขผลห้องพยาธิ'"
              :title="pathology.editing ? 'ยกเลิกการแก้ไข' : 'แก้ไขผลห้องพยาธิ'" @click="togglePathologyEdit">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.2-1 10-10a2 2 0 0 0-5-5l-10 10L4 20Z"></path><path d="m12 6 5 5"></path></svg>
            </button>
            <span class="lab-result-mode" :class="{'is-editing':pathology.editing}">{{ pathology.editing ? 'โหมดแก้ไข' : 'โหมดดูอย่างเดียว' }}</span>
          </div>
          <small>รายการที่สั่งคูณจะแสดงแยกเป็นแต่ละ Item เหมือนแท็บ Order/ออกผล และเพิ่มตำแหน่งตรวจจริงได้ภายใน Item นั้น</small>
        </div>
        <span class="lab-result-report-slot">
          <sd-report v-if="pathologyPdfReady()" class="lab-result-report-action" :report-list="labResultPdfReportList" :params="pathologyPdfParams()" size="small" />
          <el-button v-else class="lab-result-report-action" size="small" plain disabled title="รายงานผลเปิดได้เมื่อมีผลที่บันทึกแล้ว"><span aria-hidden="true">📄</span> รายงานผล</el-button>
        </span>
      </div>
    </template>
    <div v-loading="pathology.loading" class="lab-pathology-body">
      <section class="lab-pathology-patient-strip" aria-label="ข้อมูล Order ห้อง MY">
        <div><span>ผู้ป่วย</span><strong>{{ patientName(pathology.order) || '-' }}</strong><small class="lab-mono">HN {{ text(pathology.order&&pathology.order.patient&&pathology.order.patient.hn)||'-' }}</small></div>
        <div><span>LAB NO.</span><strong class="lab-mono">{{ pathologyLabNo() || '-' }}</strong></div>
        <div><span>รายการตรวจ</span><strong>{{ pathologyTestSummary() }}</strong></div>
        <div><span>จำนวนที่สั่ง</span><strong>{{ pathologySpecimenCount() }} items</strong></div>
        <div><span>สถานะ</span><strong>{{ pathologyStatusText() }}</strong></div>
      </section>

      <div class="lab-pathology-summary">
        <div><strong>รายการลงผล</strong><small>{{ pathologySpecimenCount() }} รายการตามคำสั่ง · {{ pathologySubCount() }} ตำแหน่งตรวจจริง</small></div>
        <div class="lab-pathology-summary-actions"><span><b>{{ pathologyDoneCount() }}</b>/{{ pathologySubCount() }} ลงผลแล้ว</span><el-button v-if="pathologyRevisionCount()" plain type="primary" size="small" :disabled="pathology.editing" @click="togglePathologyRevisionHistory">{{ pathology.revisionHistoryOpen ? 'กลับผลล่าสุด' : 'ประวัติการแก้ไข '+pathologyRevisionCount()+' ชุด' }}</el-button></div>
      </div>

      <section v-if="pathology.revisionHistoryOpen&&selectedPathologyRevision()" class="lab-pathology-revisions" aria-label="ประวัติการแก้ไขผลห้อง MY">
        <aside>
          <strong>Revision จากการแก้ไขผล</strong>
          <button v-for="revision in pathologyRevisions()" :key="revision.revision_id" type="button" :class="{'is-active':revision.revision_id===pathology.selectedRevisionId}" @click="selectPathologyRevision(revision)"><span>Revision {{ revision.no }} · {{ compactDateTime(revision.corrected_at)||'-' }}</span><small>{{ revision.corrected_by||'-' }} · {{ revision.changes.length }} รายการ</small></button>
        </aside>
        <div class="lab-pathology-revision-sheet">
          <header><div><strong>Revision {{ selectedPathologyRevision().no }}</strong><small>{{ selectedPathologyRevision().reason||'ไม่ได้ระบุเหตุผลการแก้ไข' }}</small></div><span>{{ selectedPathologyRevision().changes.length }} รายการเปลี่ยนแปลง</span></header>
          <div class="lab-pathology-revision-head"><span>รายการ / specimen</span><span>ตำแหน่งตรวจจริง</span><span>ค่าก่อนแก้</span><span>ค่าหลังแก้</span></div>
          <div v-for="(change,index) in selectedPathologyRevision().changes" :key="change.event_id||index" class="lab-pathology-revision-row"><span><strong>{{ change.test_code }} {{ change.test_name }}</strong><small>{{ change.specimen_name||'-' }}</small></span><span>{{ change.actual_site_name||'-' }}</span><span>{{ change.before_result_value||'-' }}</span><strong>{{ change.after_result_value||'-' }}</strong></div>
        </div>
      </section>

      <div v-else class="lab-pathology-table">
        <div class="lab-pathology-table-head"><div>#</div><div>รายการตรวจ</div><div>Specimen ตามคำสั่ง</div><div>ตำแหน่งตรวจจริง / ผลตรวจ</div></div>
        <article v-for="(entry,itemIndex) in pathologyItems()" :key="entry.group.item_id+'-specimen-'+entry.specimen.specimen_index" class="lab-pathology-item-row">
          <div class="lab-pathology-item-index lab-mono">{{ String(itemIndex+1).padStart(2,'0') }}</div>
          <aside class="lab-pathology-test-cell"><strong><span class="lab-mono">{{ entry.group.test_code||'-' }}</span> {{ entry.group.test_name||'-' }}</strong><small>Item ที่ {{ itemIndex+1 }} จากจำนวนที่สั่ง ×{{ entry.group.specimens.length }}</small></aside>
          <aside class="lab-pathology-specimen-cell"><strong>{{ entry.specimen.specimen_name||'ไม่ระบุ specimen' }}</strong><span class="lab-pathology-ordered-site">ตำแหน่ง&nbsp; <b>{{ entry.specimen.ordered_site_name||'-' }}</b></span></aside>
          <div class="lab-pathology-subresults">
            <header class="lab-pathology-addbar"><el-button v-if="viewMode==='today'&&pathology.editing" text type="primary" size="small" :disabled="pathology.saving||pathology.finalizing" @click="addPathologySub(entry.group,entry.specimen)">＋ เพิ่มตำแหน่ง</el-button></header>
            <div v-for="(row,rowIndex) in entry.specimen.rows" :key="row.pathology_row_key" class="lab-pathology-subrow">
              <label class="lab-pathology-site-entry"><span>ตำแหน่งตรวจจริง <b>*</b></span>
                      <el-select v-model="row.actual_site_name" filterable allow-create default-first-option clearable
                        :loading="pathologySiteMasterLoading"
                        :disabled="viewMode!=='today'||!pathology.editing||pathology.saving||pathology.finalizing" placeholder="เลือก / พิมพ์ตำแหน่ง"
                        @change="pathologySiteChanged(entry.group,entry.specimen,row,$event)">
                        <el-option v-for="option in pathologySiteOptions(entry.group,entry.specimen,row)" :key="option.value" :label="option.label" :value="option.value" />
                      </el-select>
                <small>{{ row.seeded_from_order ? 'ค่าเริ่มต้นจากตำแหน่งที่แพทย์เลือก' : 'ตำแหน่งเพิ่มเติมจากการตรวจจริงในห้องแล็บ' }}</small>
              </label>
              <label class="lab-pathology-result-entry"><span>ผลตรวจ</span>
                <el-select v-model="row.result_choices" multiple filterable allow-create default-first-option clearable reserve-keyword
                  :loading="pathologyResultMasterLoading"
                  :disabled="viewMode!=='today'||!pathology.editing||pathology.saving||pathology.finalizing" placeholder="เลือกหรือพิมพ์ผลตรวจได้มากกว่า 1 ผล"
                  @change="pathologyResultChanged(row,$event)">
                  <el-option v-for="option in pathologyResultOptions(row)" :key="option.value" :label="option.label" :value="option.value" />
                </el-select>
                <small>เลือกได้หลายผลจาก LAB Manual Result Detail Settings หรือพิมพ์ผลอื่นแล้วกด Enter</small>
              </label>
              <div class="lab-pathology-remove"><el-button v-if="canRemovePathologySub(entry.specimen,row,rowIndex)" text type="danger" :disabled="pathology.saving||pathology.finalizing" aria-label="ลบตำแหน่งตรวจจริงที่เพิ่ม" title="ลบตำแหน่งที่เพิ่ม" @click="removePathologySub(entry.group,entry.specimen,row,rowIndex)">×</el-button></div>
            </div>
          </div>
        </article>
        <div v-if="!pathology.loading&&!pathology.groups.length" class="lab-empty">ไม่พบรายการห้อง MY สำหรับลงผล</div>
      </div>

      <label v-if="pathology.editing&&pathologyHasPersistedResults()" class="lab-correction-reason lab-pathology-correction-reason"><span>เหตุผลการแก้ไขผล <small>(ไม่บังคับ)</small></span><el-input v-model="pathology.correctionReason" type="textarea" :rows="2" maxlength="1000" show-word-limit placeholder="ระบุเหตุผล (ถ้ามี)" /><small>การกดบันทึกหนึ่งครั้งจะถูกเก็บเป็น Revision ชุดเดียว พร้อมค่าก่อน–หลัง ผู้แก้ไข และเวลา</small></label>

      <section class="lab-result-attachments lab-pathology-attachments" aria-label="ไฟล์แนบผลตรวจห้อง MY">
        <div class="lab-result-attachments-head"><div><strong>ไฟล์แนบผลตรวจ</strong><small>PDF / JPG / JPEG / PNG · ไม่เกิน 10 MB ต่อไฟล์ · สูงสุด 10 ไฟล์ · รวมไม่เกิน 50 MB</small></div><span>{{ pathology.attachments.length }}/10</span></div>
        <div v-if="pathology.attachments.length" class="lab-result-file-list"><div v-for="fileItem in pathology.attachments" :key="attachmentKey(fileItem)" class="lab-result-file-row"><a :href="attachmentUrl(fileItem)" target="_blank" rel="noopener" class="lab-result-file"><span>เอกสาร</span><strong>{{ attachmentName(fileItem) }}</strong><small>{{ attachmentSize(fileItem) }}</small></a><el-button v-if="viewMode==='today'" class="lab-result-file-remove" type="danger" plain circle size="small" :aria-label="'นำไฟล์ '+attachmentName(fileItem)+' ออก'" title="นำไฟล์ออก" :disabled="!canRemovePathologyFile()" @click="requestRemovePathologyFile(fileItem)"><span aria-hidden="true">×</span></el-button></div></div>
        <el-upload v-if="viewMode==='today'" class="lab-result-upload" :action="resultUploadAction()" :headers="resultUploadHeaders()" :data="resultUploadData()"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" :multiple="true" :show-file-list="false"
          :disabled="!canUploadPathologyFile()" :before-upload="beforePathologyUpload" :on-progress="pathologyUploadProgress"
          :on-success="pathologyUploadSuccess" :on-error="pathologyUploadError">
          <el-button plain type="primary" :loading="pathology.uploading" :disabled="!canUploadPathologyFile()||pathology.attachments.length>=10">Import file</el-button>
        </el-upload>
        <small v-if="viewMode==='lookup'" class="lab-result-upload-note">โหมดสืบค้นอ่านไฟล์แนบได้อย่างเดียว</small>
      </section>
    </div>
    <template #footer>
      <div class="lab-pathology-footer"><span>{{ pathologyDoneCount() ? 'ลงผลแล้ว '+pathologyDoneCount()+' จาก '+pathologySubCount()+' ตำแหน่ง' : 'ยังไม่มีผลที่กรอก' }}</span><el-button :disabled="pathology.saving||pathology.finalizing||pathology.uploading" @click="pathology.visible=false">ปิด</el-button><el-button v-if="viewMode==='today'&&pathology.editing" type="primary" :loading="pathology.saving" :disabled="pathology.finalizing||pathology.uploading" @click="requestSavePathologyResults">บันทึกผล</el-button><el-button v-if="viewMode==='today'&&!pathology.editing&&!pathologyIsFinal()" type="success" :loading="pathology.finalizing" :disabled="pathology.saving||pathology.uploading||!canFinalizePathologyResults()" @click="requestFinalizePathologyResults">ยืนยันออกผลครบ</el-button></div>
    </template>
  </el-dialog>

  <el-dialog v-model="manual.visible" class="lab-result-dialog" :class="{'is-microbiology':isMicrobiologyResult()}"
    :width="isMicrobiologyResult()?'min(1180px,calc(100vw - 32px))':'min(1320px,calc(100vw - 48px))'"
    :close-on-click-modal="false" destroy-on-close @closed="resetManual">
    <template #header>
      <div class="lab-result-dialog-head">
        <div>
          <div class="lab-result-title-row">
            <strong>ผลตรวจทางห้องปฏิบัติการ</strong>
            <span v-if="isMicrobiologyResult()" class="lab-micro-source-tag">จุลชีววิทยา · MLab</span>
            <span v-if="isMicrobiologyResult() && manualCriticalCount()" class="lab-micro-critical-tag">Critical {{ manualCriticalCount() }}</span>
            <button v-if="viewMode==='today'&&!isMicrobiologyResult()" class="lab-result-edit-button" type="button"
            :disabled="manual.loading || manual.saving || manual.finalizing || !canEditResult()" :aria-pressed="manual.editing"
            :aria-label="manual.editing ? 'ออกจากโหมดแก้ไขผลตรวจ' : 'แก้ไขผลตรวจทั้งหมด'"
            :title="editResultTitle()" @click="toggleResultEdit">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.2-1 10-10a2 2 0 0 0-5-5l-10 10L4 20Z"></path><path d="m12 6 5 5"></path></svg>
            </button>
            <span class="lab-result-mode" :class="{'is-editing':manual.editing}">{{ manual.editing ? 'โหมดแก้ไข' : 'โหมดดูอย่างเดียว' }}</span>
            <span v-if="!isMicrobiologyResult() && standardResultStatusValue()!=='pending'" class="lab-result-summary-tag" :class="'is-'+standardResultStatusValue()">{{ standardResultStatusText() }}</span>
            <span v-if="!isMicrobiologyResult() && manualCriticalCount()" class="lab-result-summary-tag is-critical">วิกฤติ {{ manualCriticalCount() }}</span>
            <span v-if="!isMicrobiologyResult() && manualAbnormalCount()" class="lab-result-summary-tag is-abnormal">ผิดปกติ {{ manualAbnormalCount() }}</span>
            <el-button v-if="viewMode==='today'&&!manual.orderView && hasPersistedResult()" class="lab-result-visibility-button" size="small" plain
              :type="resultHidden() ? 'warning' : 'danger'"
              :loading="visibilityDialog.loading"
              :disabled="manual.loading || manual.saving || manual.uploading || manual.editing || visibilityDialog.loading"
              @click="openResultVisibilityDialog">
              {{ resultHidden() ? 'ยกเลิกปกปิด' : 'ปกปิดผล' }}
            </el-button>
            <span v-if="resultHidden()" class="lab-result-hidden-tag">ตั้งสถานะปกปิดแล้ว</span>
          </div>
          <small><span class="lab-mono">{{ manual.data.patient_hn || '-' }}</span> · {{ resultTestCount() }} tests · ผลล่าสุด</small>
          <div v-if="!isMicrobiologyResult() && (resultReporterName() || resultVerifierName() || resultReportedAt())" class="lab-result-byline" aria-label="ข้อมูลผู้ออกผลและผู้ยืนยันผล">
            <span v-if="resultReporterName()"><b>Reported by:</b> <strong>{{ resultReporterName() }}</strong></span>
            <span v-if="resultVerifierName()"><b>Approve name:</b> <strong>{{ resultVerifierName() }}</strong></span>
            <span v-if="resultReportedAt()"><b>ออกผลเมื่อ:</b> <strong class="lab-mono">{{ compactDateTime(resultReportedAt()) }}</strong></span>
          </div>
        </div>
        <span v-if="manual.orderView || isMicrobiologyResult()" class="lab-result-report-slot">
          <sd-report v-if="labResultPdfReady()" class="lab-result-report-action"
            :report-list="activeLabResultPdfReportList()" :params="labResultPdfParams()" size="small" />
          <el-button v-else class="lab-result-report-action" size="small" plain disabled
            :title="labResultPdfHint()"><span aria-hidden="true">📄</span> รายงานผล</el-button>
        </span>
      </div>
    </template>
    <div v-loading="manual.loading" class="lab-manual-form lab-result-viewer">
      <div v-if="!manual.orderView && resultHidden()" class="lab-result-hidden-notice" role="status">
        <strong>ผลนี้ถูกตั้งสถานะปกปิด</strong>
        <span>{{ manual.data.result_visibility_reason || 'ไม่ได้ระบุเหตุผล' }}</span>
        <small><template v-if="resultVisibilityActor()">โดย {{ resultVisibilityActor() }}</template><template v-if="manual.data.result_visibility_at"> · {{ compactDateTime(manual.data.result_visibility_at) }}</template></small>
      </div>
      <template v-if="isMicrobiologyResult()">
        <section class="lab-micro-patient-strip" aria-label="ข้อมูลผู้ป่วยและสิ่งส่งตรวจ">
          <div class="lab-micro-patient-main">
            <span class="lab-micro-avatar">{{ patientInitials(manual.data.patient_name) }}</span>
            <div><strong>{{ manual.data.patient_name || '-' }}</strong><small>{{ manual.data.patient_hn || '-' }}<template v-if="manual.data.patient_age"> · {{ manual.data.patient_age }}</template><template v-if="manual.data.ward_clinic"> · {{ manual.data.ward_clinic }}</template></small></div>
          </div>
          <div class="lab-micro-meta"><span>LAB NO.</span><strong>{{ manual.data.lab_no || '-' }}</strong></div>
          <div class="lab-micro-meta"><span>สิ่งส่งตรวจ</span><strong>{{ manual.data.specimen_name || '-' }}</strong></div>
          <div class="lab-micro-meta"><span>สถานะผล</span><strong><i class="lab-micro-status" :class="microOverallStatusClass()">{{ microOverallStatusText() }}</i></strong></div>
        </section>

        <section v-if="manualCriticalCount()" class="lab-result-critical-banner" role="alert" aria-label="แจ้งเตือนผลวิกฤติ">
          <strong>Critical Result {{ manualCriticalCount() }} รายการ</strong>
          <span>{{ microCriticalInterpretations() || 'Agent ระบุผลวิกฤติ' }}</span>
        </section>

        <section v-if="resultOrderNote()" class="lab-result-order-note" role="note" aria-label="หมายเหตุระดับ Order">
          <span class="lab-result-order-note-icon" aria-hidden="true">i</span>
          <div><strong>หมายเหตุระดับ Order</strong><p>{{ resultOrderNote() }}</p></div>
        </section>

        <section v-if="microUnmatchedFallback()" class="lab-micro-unmatched" aria-label="ข้อความต้นฉบับจาก MLab ที่ยังจับคู่รายการไม่ได้">
          <button type="button" class="lab-micro-unmatched-head" :aria-expanded="microUnmatchedOpen" @click="microUnmatchedOpen=!microUnmatchedOpen"><strong>ข้อความต้นฉบับจาก MLab</strong><span>{{ microUnmatchedOpen ? 'ซ่อน ▲' : 'แสดง ▼' }}</span></button>
          <pre v-if="microUnmatchedOpen">{{ microUnmatchedRawText() }}</pre>
        </section>

        <template v-else>
        <div class="lab-micro-timeline">
          <div><span>เก็บสิ่งส่งตรวจ</span><strong>{{ compactDateTime(manual.data.collected_at) || '-' }}</strong></div>
          <div><span>รับสิ่งส่งตรวจ</span><strong>{{ compactDateTime(manual.data.received_at) || '-' }}</strong></div>
          <div><span>ออกรายงานล่าสุด</span><strong>{{ compactDateTime(microLatestReportedAt()) || '-' }}</strong></div>
        </div>

        <div class="lab-micro-notice" role="note"><strong>หลักการแสดงผล</strong><span>HIS จับคู่ผลด้วยรหัสรายการที่บันทึกไว้เท่านั้น และแสดงข้อความจาก MLab ตามที่ได้รับ โดยไม่อ่านหัวข้อในข้อความเพื่อย้ายผลหรือแตก Gram stain, เชื้อ, MIC และ S/I/R อัตโนมัติ หากรหัสกับข้อความไม่ตรงกันต้องแก้ที่ MLab/LISconnect</span></div>

        <section class="lab-micro-results" aria-label="รายละเอียดผลจุลชีววิทยา">
          <div class="lab-micro-section-head"><strong>รายการตรวจ</strong><span>{{ microResultCountText() }}</span></div>
          <article v-for="(group,groupIndex) in resultGroupsForDisplay()" :key="group.group_key || group.item_id || group.test_code || groupIndex" class="lab-micro-result-card" :class="{'is-open':microExpanded(group)}">
            <button type="button" class="lab-micro-result-head" :aria-expanded="microExpanded(group)" @click="toggleMicroGroup(group)">
              <span class="lab-mono">{{ String(groupIndex+1).padStart(2,'0') }}</span>
              <span><strong>{{ group.test_name || '-' }}</strong><small>รหัสรายการ HIS {{ group.test_code || '-' }}</small></span>
              <span><small>เวลารายงาน</small><strong>{{ compactDateTime(microGroupReportedAt(group)) || '-' }}</strong></span>
              <i class="lab-micro-status" :class="microGroupStatusClass(group)">{{ microGroupStatusText(group) }}</i>
              <span class="lab-micro-chevron">⌄</span>
            </button>

            <div v-if="microExpanded(group)" class="lab-micro-result-body">
              <div v-if="microGroupHasResult(group)" class="lab-micro-wire-results">
                <section v-for="(result,resultIndex) in microResultRows(group)" :key="result.result_item_id || result.test_code || result.entered_at || resultIndex" class="lab-micro-wire-result">
                  <div class="lab-micro-wire-meta">
                    <div><span>รหัสผลที่บันทึกใน HIS</span><strong class="lab-mono">{{ result.test_code || group.test_code || '-' }}</strong></div>
                    <div><span>ชื่อ/รหัสที่มากับผล</span><strong>{{ result.test_name || '-' }}</strong></div>
                    <div><span>สถานะผล</span><strong>{{ result.result_status || '-' }}</strong><i v-if="result.is_critical===true" class="lab-micro-critical-tag">Critical · {{ result.interpretation || '-' }}</i></div>
                    <div><span>เวลารายงาน</span><strong>{{ compactDateTime(microResultReportedAt(result)) || '-' }}</strong></div>
                  </div>
                  <div class="lab-micro-wire-value"><strong>ผลจาก MLab</strong><pre>{{ result.result_value }}</pre></div>
                </section>
              </div>

              <div v-if="!microGroupHasResult(group)" class="lab-micro-pending"><span>◷</span><div><strong>ยังไม่มีผลจาก MLab</strong><small>ระบบจะแสดงรายละเอียดเมื่อได้รับ partial หรือ final result</small></div></div>
            </div>
          </article>
        </section>
        </template>
      </template>

      <template v-else>
      <section v-if="resultOrderNote()" class="lab-result-order-note" role="note" aria-label="หมายเหตุระดับ Order">
        <span class="lab-result-order-note-icon" aria-hidden="true">i</span>
        <div><strong>หมายเหตุระดับ Order</strong><p>{{ resultOrderNote() }}</p></div>
      </section>
      <div class="lab-result-profile-toolbar">
        <div><strong>รายการผลตรวจ</strong><small>{{ resultTestCount() }} รายการสั่งตรวจ · {{ resultRowsForDisplay().length }} ผลย่อย</small></div>
        <div class="lab-result-section-actions">
          <el-button v-if="resultRevisionCount()" plain type="primary" size="small" :disabled="manual.editing" @click="toggleResultRevisionHistory">{{ manual.revisionHistoryOpen ? 'กลับผลล่าสุด' : 'ประวัติผล '+resultRevisionCount()+' ฉบับ' }}</el-button>
          <el-button v-if="resultProfileCount()&&!manual.revisionHistoryOpen" text type="primary" size="small" @click="expandAllResultGroups">กาง Profile ทั้งหมด</el-button>
          <el-button v-if="resultProfileCount()&&!manual.revisionHistoryOpen" text type="primary" size="small" @click="collapseAllResultGroups">พับทั้งหมด</el-button>
        </div>
      </div>
      <section v-if="manual.revisionHistoryOpen && selectedResultRevision()" class="lab-result-revision-view" aria-label="ประวัติผลตรวจทั้งฉบับ">
        <aside class="lab-result-revision-rail">
          <strong>ประวัติ CALLBACK ของ LAB NO. นี้</strong>
          <button v-for="revision in resultRevisions()" :key="revision.revision_id" type="button" :class="{'is-active':revision.revision_id===manual.selectedRevisionId}" @click="selectResultRevision(revision)">
            <span>Revision {{ revision.no }} · {{ compactDateTime(revision.source_reported_at || revision.received_at) || '-' }}</span>
            <small>{{ revisionStageText(revision.stage) }} · report_seq {{ revision.report_seq || '-' }}</small>
            <i v-if="revision.latest">CURRENT</i><i v-else>ถูกแทนที่</i>
          </button>
        </aside>
        <div class="lab-result-revision-sheet">
          <header><div><strong>Revision {{ selectedResultRevision().no }} · snapshot ผลทั้งฉบับ</strong><small>{{ selectedResultRevision().items.length }} รายการที่มองเห็น · เปลี่ยนจากรอบก่อน {{ selectedResultRevision().items.filter(item=>item.changed).length }} รายการ</small></div><span>{{ revisionStageText(selectedResultRevision().stage) }}</span></header>
          <div v-if="!selectedResultRevision().latest" class="lab-result-revision-warning">นี่คือผลประวัติที่ถูก revision ใหม่แทนที่แล้ว · ไม่ใช่ผลปัจจุบัน</div>
          <div class="lab-result-revision-table">
            <div class="lab-result-revision-head"><span>#</span><span>รายการตรวจ</span><span>ค่าใน revision</span><span>ค่ารอบก่อน</span><span>สถานะ</span></div>
            <div v-for="(item,index) in selectedResultRevision().items" :key="item.test_code || index" class="lab-result-revision-row" :class="{'is-changed':item.changed}">
              <span>{{ index+1 }}</span><span><strong>{{ item.test_name || '-' }}</strong><small>{{ item.test_code || '-' }}</small></span><strong>{{ item.result_value || '-' }}<small v-if="item.unit"> {{ item.unit }}</small></strong><span>{{ item.previous_value || '-' }}</span><span>{{ item.changed ? 'เปลี่ยน' : 'คงเดิม' }}</span>
            </div>
          </div>
          <footer><span>result_uid</span><strong class="lab-mono">{{ selectedResultRevision().result_uid || '-' }}</strong><span>receipt_id / report_id</span><strong class="lab-mono">{{ selectedResultRevision().receipt_id || '-' }} / {{ selectedResultRevision().report_id || '-' }}</strong></footer>
        </div>
      </section>
      <div v-else class="lab-result-values">
        <div class="lab-result-value-head"><span>#</span><span><span class="lab-sr-only">สถานะ</span></span><span>รายการ</span><span title="ประวัติค่าที่เคยบันทึกของ Item นี้ · อ่านอย่างเดียว">ค่าก่อนหน้า</span><span>ค่าที่ตรวจได้</span><span>หน่วย</span><span>แปลผล</span><span>ค่าปกติ</span></div>
        <template v-for="(group,groupIndex) in resultGroupsForDisplay()" :key="resultGroupKey(group,groupIndex)">
          <div v-if="group.sensitive_locked" class="lab-sensitive-result-locked">
            <div><strong>{{ group.test_name || 'ผลตรวจ Sensitive' }}</strong><small>{{ group.test_code || '-' }}</small></div>
            <strong class="lab-sensitive-result-label">ปกปิดผล</strong>
          </div>
          <button v-else-if="resultGroupIsProfile(group)" type="button" class="lab-result-profile-row" :class="{'is-open':resultGroupExpanded(group,groupIndex)}" :aria-expanded="resultGroupExpanded(group,groupIndex)" @click="toggleResultGroup(group,groupIndex)">
            <span class="lab-result-profile-index lab-mono">{{ groupIndex+1 }}</span>
            <span class="lab-result-profile-main"><strong>{{ group.test_name || '-' }}</strong><small>Profile · คลิกเพื่อ{{ resultGroupExpanded(group,groupIndex) ? 'พับ' : 'กาง' }}ผลย่อย {{ group.results.length }} รายการ</small></span><i aria-hidden="true">⌄</i>
          </button>
          <template v-if="!group.sensitive_locked && (!resultGroupIsProfile(group) || resultGroupExpanded(group,groupIndex))">
          <div v-for="(result,index) in group.results" :key="result.result_item_id || result.test_code || result.entered_at || index" class="lab-result-value-row" :class="{'is-profile-child':resultGroupIsProfile(group),'is-critical':result&&result.is_critical===true,'is-redacted':result&&result.redacted===true}">
            <div class="lab-result-index lab-mono">{{ resultRowNumber(group,groupIndex,index) }}</div>
            <div><i v-if="!result.redacted && hasResultValue(result)" class="lab-result-signal" :class="resultSignalClass(result)" :title="resultSignalText(result)"></i></div>
            <div class="lab-result-test-name"><strong>{{ result.test_name || group.test_name || '-' }}</strong><small>{{ result.test_code || group.test_code || '-' }}<template v-if="resultSourceText(result.result_source)"> · ผลจาก {{ resultSourceText(result.result_source) }}</template></small></div>
            <div class="lab-result-previous lab-mono">{{ result.redacted ? '-' : (result.previous && result.previous.value || '-') }}</div>
            <div><strong v-if="result.redacted" class="lab-result-redacted-value">ปกปิดผล</strong><el-input v-else-if="manual.editing && manual.editMap[result._edit_key]" v-model="manual.editMap[result._edit_key].result_value" type="textarea" :autosize="{minRows:1,maxRows:5}" /><strong v-else class="lab-result-measured" :class="resultMeasuredClass(result)">{{ result.result_value || 'รอผล' }}</strong></div>
            <div><template v-if="result.redacted">-</template><el-input v-else-if="manual.editing && manual.editMap[result._edit_key]" v-model="manual.editMap[result._edit_key].unit" /><template v-else>{{ result.unit || '-' }}</template></div>
            <div><template v-if="result.redacted">-</template><el-select v-else-if="manual.editing && manual.editMap[result._edit_key]" v-model="manual.editMap[result._edit_key].interpretation" clearable filterable allow-create default-first-option><el-option v-for="option in interpretationOptions" :key="option.value" :label="option.label" :value="option.value" /></el-select><span v-else class="lab-result-interpretation" :class="resultInterpretationClass(result)">{{ result.interpretation || '-' }}</span></div>
            <div class="lab-mono"><template v-if="result.redacted">-</template><el-input v-else-if="manual.editing && manual.editMap[result._edit_key]" v-model="manual.editMap[result._edit_key].reference_range" /><template v-else>{{ result.reference_range || '-' }}</template></div>
            <div v-if="result.result_comment && !result.redacted" class="lab-result-comment" role="note" aria-label="หมายเหตุผลตรวจ"><span>หมายเหตุผลตรวจ</span><p>{{ result.result_comment }}</p></div>
          </div>
          </template>
        </template>
      </div>
      <div v-if="!manual.loading && !hasRecordedResult()" class="lab-previous-result is-empty">ยังไม่มีผลตรวจ · รอผลจาก LIS หรือกดดินสอเพื่อกรอกผล</div>
      <label v-if="manual.editing && correctionReasonRequired()" class="lab-correction-reason"><span>เหตุผลการแก้ไขผล <small>(ไม่บังคับ)</small></span><el-input v-model="manual.correctionReason" type="textarea" :rows="2" maxlength="1000" show-word-limit placeholder="ระบุเหตุผล (ถ้ามี)" /><small>ระบบจะเก็บค่าก่อน–หลัง ผู้แก้ไข เวลา และเหตุผลเมื่อมีการระบุใน LAB Result Edit Log</small></label>
      <div v-if="manual.editing" class="lab-manual-hint">ผลเดิมที่แก้ไขจะเก็บประวัติแบบ append-only; ระบบไม่คำนวณ Critical ใหม่ และยังคงใช้ค่า Critical ที่ Agent/LIS ส่งมา</div>
      </template>
      <section v-if="manual.orderView || isMicrobiologyResult()" class="lab-result-attachments" aria-label="ไฟล์แนบผลตรวจระดับ Order">
        <div class="lab-result-attachments-head"><div><strong>ไฟล์แนบผลตรวจ</strong><small>PDF / JPG / JPEG / PNG · ไม่เกิน 10 MB ต่อไฟล์ · สูงสุด 10 ไฟล์ · รวมไม่เกิน 50 MB</small></div><span>{{ manual.attachments.length }}/10</span></div>
        <div v-if="manual.attachments.length" class="lab-result-file-list"><div v-for="fileItem in manual.attachments" :key="attachmentKey(fileItem)" class="lab-result-file-row"><a :href="attachmentUrl(fileItem)" target="_blank" rel="noopener" class="lab-result-file"><span>เอกสาร</span><strong>{{ attachmentName(fileItem) }}</strong><small>{{ attachmentSize(fileItem) }}</small></a><el-button v-if="viewMode==='today'" class="lab-result-file-remove" type="danger" plain circle size="small" :aria-label="'นำไฟล์ '+attachmentName(fileItem)+' ออก'" title="นำไฟล์ออก" :disabled="!canRemoveResultFile()" @click="requestRemoveResultFile(fileItem)"><span aria-hidden="true">×</span></el-button></div></div>
        <el-upload v-if="viewMode==='today'" class="lab-result-upload" :action="resultUploadAction()" :headers="resultUploadHeaders()" :data="resultUploadData()"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" :multiple="true" :show-file-list="false"
          :disabled="!canUploadResultFile() || manual.saving"
          :before-upload="beforeResultUpload" :on-progress="resultUploadProgress"
          :on-success="resultUploadSuccess" :on-error="resultUploadError">
          <el-button plain type="primary" :loading="manual.uploading" :disabled="!canUploadResultFile() || manual.attachments.length>=10">แนบไฟล์</el-button>
        </el-upload>
        <small v-if="viewMode==='today'&&!canUploadResultFile()" class="lab-result-upload-note">ไม่พบ LAB Item ใน Order สำหรับผูกไฟล์แนบ</small>
        <small v-if="viewMode==='lookup'" class="lab-result-upload-note">โหมดสืบค้นอ่านไฟล์แนบได้อย่างเดียว</small>
      </section>
    </div>
    <template #footer><el-button v-if="isMicrobiologyResult()" @click="copyMicrobiologyResult">คัดลอกผลที่แสดง</el-button><el-button :disabled="manual.finalizing" @click="manual.editing ? cancelResultEdit() : manual.visible=false">{{ manual.editing ? 'ยกเลิก' : 'ปิด' }}</el-button><el-button v-if="canFinalizeManualResults()" type="success" :loading="manual.finalizing" :disabled="manual.loading || manual.saving || manual.uploading" @click="requestFinalizeManualResults">ยืนยันออกผลครบ</el-button><el-button v-if="manual.editing && !isMicrobiologyResult()" type="primary" :loading="manual.saving" :disabled="manual.finalizing" @click="requestSaveResult">บันทึกผล</el-button></template>
  </el-dialog>

  <el-dialog v-model="visibilityDialog.visible" :title="visibilityDialog.targetHidden ? 'ยืนยันปกปิดผล' : 'ยืนยันยกเลิกการปกปิดผล'"
    width="min(560px,94vw)" :close-on-click-modal="false"
    :close-on-press-escape="!visibilityDialog.loading" :show-close="!visibilityDialog.loading"
    @closed="resetVisibilityDialog">
    <div class="lab-visibility-summary">
      <strong>{{ manual.data.test_code || '' }} {{ manual.data.test_name || '' }}</strong>
      <span>LAB NO. {{ manual.data.lab_no || '-' }} · HN {{ manual.data.patient_hn || '-' }}</span>
      <span v-if="visibilityDialog.targetHidden">แพทย์จะเห็นว่ามีรายการตรวจ แต่จะไม่เห็นค่าผลจากหน้าที่เชื่อมกับสถานะนี้ ข้อมูลผลจริงยังคงอยู่ในระบบ</span>
      <span v-else>ค่าผลจะกลับมาแสดงในหน้าที่เชื่อมกับสถานะนี้</span>
      <span v-if="manualCriticalCount()" class="is-critical">รายการนี้มี Critical Result {{ manualCriticalCount() }} ค่า · การปกปิดจะไม่ล้างสถานะหรือ workflow แจ้งค่าวิกฤติ</span>
    </div>
    <label class="lab-visibility-reason"><span>เหตุผล <small>(ไม่บังคับ)</small></span>
      <el-input v-model="visibilityDialog.reason" type="textarea" :rows="4" maxlength="1000"
        show-word-limit :disabled="visibilityDialog.loading"
        :placeholder="visibilityDialog.targetHidden ? 'ระบุเหตุผลที่ต้องปกปิดผล (ถ้ามี)' : 'ระบุเหตุผลที่ยกเลิกการปกปิดผล (ถ้ามี)'" />
    </label>
    <template #footer>
      <el-button :disabled="visibilityDialog.loading" @click="visibilityDialog.visible=false">ยกเลิก</el-button>
      <el-button :type="visibilityDialog.targetHidden ? 'danger' : 'primary'"
        :loading="visibilityDialog.loading"
        @click="submitResultVisibility">
        {{ visibilityDialog.targetHidden ? 'ยืนยันปกปิดผล' : 'ยืนยันแสดงผล' }}
      </el-button>
    </template>
  </el-dialog>
</div>`

widget.onCreated = `const s=this.vueState;
const field=this;
const PROCESS_ID='6a9434c3422c1ca959829d5e';
const RECEIVE_PROCESS_ID='6a94f634422c1ca959829d70';
const REJECT_PROCESS_ID='6a79ff46d5218a5b6a26bebc';
const REJECTION_FORM_ID='6a7713fdcc7d0a8451130331';
const CPOE_ORDER_APP_ID='6a995d064744260ea8c9498c';
/* เปิดหลัง CPOE ยืนยันส่งสำเร็จเท่านั้น; launcher เป็นเจ้าของ flow คิว */
const MOVE_UNIT_FORM_ID='6a4f828d22f95f21b606d9a2';
const LAB_SPECIMEN_FORM_ID='6a597657d448dfc9d33e2d3a';
/* ใช้แหล่งตำแหน่งเดียวกับใบสั่ง CPOE: PE Items (code + name_th)
   จำกัดการใช้งานไว้ที่ popup ลงผล Manual ของห้อง MY เท่านั้น */
const PATHOLOGY_SITE_FORM_ID='6a473b6cd54977f38061dde0';
const PATHOLOGY_SITE_PROVIDER={providerId:PATHOLOGY_SITE_FORM_ID,providerType:'FORM',params:{},options:{where:'\`enable\` = true',orderBy:[{column:'sort',sort:'ASC'}],limit:2000,page:1}};
/* 🌼 ผลตรวจสำเร็จรูปใช้เฉพาะ popup Manual ของ section code MY เท่านั้น
   UI เลือก/พิมพ์ได้หลายค่า แต่ยังรวมด้วยบรรทัดใหม่ลง result_value เป็น String เดิม
   เพื่อไม่เปลี่ยน payload/API, correction history และ flow ของห้องอื่น */
const PATHOLOGY_RESULT_DETAIL_FORM_ID='6acc8587481c196fbb332c60';
const PATHOLOGY_RESULT_DETAIL_PROVIDER={providerId:PATHOLOGY_RESULT_DETAIL_FORM_ID,providerType:'FORM',params:{},options:{where:'\`is_active\` = true',orderBy:[{column:'display_order',sort:'ASC'},{column:'result_code',sort:'ASC'}],limit:2000,page:1}};
const EMR_FORM_ID='6a96557e422c1ca959829eae';
const RESULT_REPORT_FORM_ID='${resultReportFormId}';
const ORDER_REQUEST_REPORT_ID='${orderRequestReportId}';
const HN_ORDER_REPORT_ID='${hnOrderReportId}';
const LAB_RESULT_PDF_REPORT_ID='${labResultPdfReportId}';
const MICROBIOLOGY_RESULT_PDF_REPORT_ID='${microbiologyResultPdfReportId}';
const MICROBIOLOGY_REQUEST_PDF_REPORT_ID='${microbiologyRequestPdfReportId}';
const REJECT_REASON_LABELS={
  'LABR-00017':'อื่น ๆ',
  specimen_incorrect:'สิ่งส่งตรวจไม่ถูกต้อง',
  specimen_insufficient:'ปริมาณสิ่งส่งตรวจไม่เพียงพอ',
  container_incorrect:'ภาชนะบรรจุไม่ถูกต้อง',
  patient_mismatch:'ระบุตัวผู้ป่วยผิดคน',
  specimen_unsuitable:'สิ่งส่งตรวจเสื่อมสภาพหรือปนเปื้อน',
  ward_cancel:'Ward ยกเลิกการส่งตรวจ',
  change_draw:'คลินิกนมแม่ขอเปลี่ยนสิทธิ์คนไข้',
  change_draw_1:'คนไข้ขอเปลี่ยนใช้สิทธิ์บัตรทอง',
  finance_error:'รายการไม่ส่งไปการเงิน',
  other:'อื่น ๆ'
};
const REJECT_REASON_OPTIONS=Object.keys(REJECT_REASON_LABELS).map(value=>({value:value,label:REJECT_REASON_LABELS[value]}));
const CANCEL_REASON_LABELS={
  doctor_cancel:'แพทย์ยกเลิกคำสั่งตรวจ',
  duplicate_order:'สั่งตรวจซ้ำ',
  wrong_patient:'สั่งผิดผู้ป่วย',
  wrong_test:'สั่งผิดรายการตรวจ',
  patient_declined:'ผู้ป่วยปฏิเสธการตรวจ',
  ward_cancel:'Ward ยกเลิกการส่งตรวจ',
  other:'อื่น ๆ'
};
const CANCEL_REASON_OPTIONS=Object.keys(CANCEL_REASON_LABELS).map(value=>({value:value,label:CANCEL_REASON_LABELS[value]}));
const ITEM_RETEST_REASON_LABELS={reject_mistake:'ปฏิเสธผิดรายการ',recollect:'เก็บ specimen ใหม่',other:'อื่น ๆ'};
const ITEM_RETEST_REASON_OPTIONS=Object.keys(ITEM_RETEST_REASON_LABELS).map(value=>({value:value,label:ITEM_RETEST_REASON_LABELS[value]}));
/* ค่า fallback สำหรับ UI เท่านั้น จนกว่าจะมี CBC Swap Reason Master ที่ผู้ดูแลเพิ่ม/ปิดใช้งานได้ */
const CBC_SWAP_REASON_LABELS={doctor_wrong_room:'แพทย์เลือกรหัสผิดห้อง',actual_testing_room:'ห้องปลายทางเป็นผู้ตรวจจริง',work_allocation:'ปรับตามข้อตกลงการแบ่งงานระหว่างห้อง',other:'อื่น ๆ'};
const CBC_SWAP_REASON_OPTIONS=Object.keys(CBC_SWAP_REASON_LABELS).map(value=>({value:value,label:CBC_SWAP_REASON_LABELS[value]}));

s.orders=[];
s.loading=false;
s.errorMessage='';
s.expanded={};
s.detailTabs={};
s.selected={};
s.specimenEdits={};
s.specimenDropdownOptions=[];
s.specimenMasterLoading=false;
s.specimenMasterLoaded=false;
s.pathologySiteMasterOptions=[];
s.pathologySiteMasterLoading=false;
s.pathologySiteMasterLoaded=false;
s.pathologyResultMasterOptions=[];
s.pathologyResultMasterLoading=false;
s.pathologyResultMasterLoaded=false;
s.allowedSectionCodes=[];
s.orderRequestReportList=ORDER_REQUEST_REPORT_ID?[{reportId:ORDER_REQUEST_REPORT_ID,label:'ใบสั่ง',type:'pdf'}]:[];
s.hnOrderReportList=HN_ORDER_REPORT_ID?[{reportId:HN_ORDER_REPORT_ID,label:'HN',type:'pdf'}]:[];
s.labResultPdfReportList=LAB_RESULT_PDF_REPORT_ID?[{reportId:LAB_RESULT_PDF_REPORT_ID,label:'รายงานผล',type:'pdf'}]:[];
s.microbiologyResultPdfReportList=MICROBIOLOGY_RESULT_PDF_REPORT_ID?[{reportId:MICROBIOLOGY_RESULT_PDF_REPORT_ID,label:'รายงานผล',type:'pdf'}]:[];
s.microbiologyRequestPdfReportList=MICROBIOLOGY_REQUEST_PDF_REPORT_ID?[{reportId:MICROBIOLOGY_REQUEST_PDF_REPORT_ID,label:'ลงผล',type:'typst'}]:[];
s.specimenSaving={};
s.receiveLoading=false;
s.agentDispatching={};
s.rejectLoading=false;
s.rejectReasonOptions=REJECT_REASON_OPTIONS;
s.cancelReasonOptions=CANCEL_REASON_OPTIONS;
s.rejectReasonLabels={...REJECT_REASON_LABELS};
s.cancelReasonLabels={...CANCEL_REASON_LABELS};
s.reasonOptionCache={};
s.emptyCancelDialog=()=>({visible:false,loading:false,financeLoading:false,financeChecked:false,financeStatus:'',financeMessage:'',canCancel:false,receiptNumbers:[],order:null,reason:''});
s.cancelDialog=s.emptyCancelDialog();
s.cbcSwapReasonOptions=CBC_SWAP_REASON_OPTIONS;
s.cbcSwapDialog={visible:false,loading:false,order:null,item:null,reasonCode:'',reasonDetail:''};
s.cbcSwapCount=0;
s.itemRetestReasonOptions=ITEM_RETEST_REASON_OPTIONS;
s.itemRetestDialog={visible:false,loading:false,order:null,item:null,reasonCode:'',reasonDetail:''};
s.visibilityDialog={visible:false,loading:false,targetHidden:true,reason:''};
s.resultActorMeta={};
s.resultActorLoading={};
s.manual={visible:false,loading:false,saving:false,finalizing:false,uploading:false,editing:false,orderView:false,item:null,order:null,data:{results:[]},groups:[],editRows:[],editMap:{},attachments:[],pdfParentId:'',correctionReason:'',revisions:[],revisionHistoryOpen:false,selectedRevisionId:''};
s.pathology={visible:false,loading:false,saving:false,finalizing:false,uploading:false,editing:false,order:null,groups:[],attachments:[],removedRows:[],revisions:[],revisionHistoryOpen:false,selectedRevisionId:'',correctionReason:'',reportedAt:'',reportedBy:'',verifiedBy:''};
s.pathologyUploadReservations={};
s.pathologyUploadPersistPending=0;
s.pathologyUploadBatchSucceeded=0;
s.pathologyUploadBatchFailed=0;
s.pathologyUploadQueue=Promise.resolve();
s.resultUploadReservations={};
s.resultUploadPersistPending=0;
s.resultUploadBatchSucceeded=0;
s.resultUploadBatchFailed=0;
s.resultUploadQueue=Promise.resolve();
s.resultGroupOpen={};
s.microGroupOpen={};
s.microUnmatchedOpen=true;
s.interpretationOptions=[
  {label:'ปกติ (N)',value:'N'},
  {label:'สูง (H)',value:'H'},
  {label:'ต่ำ (L)',value:'L'},
  {label:'ผิดปกติ (A)',value:'A'},
  {label:'พบเชื้อ / Positive',value:'POS'},
  {label:'ไม่พบเชื้อ / Negative',value:'NEG'}
];
s.bangkokToday=()=>new Date(Date.now()+(7*60*60*1000)).toISOString().slice(0,10);
s.currentDay=s.bangkokToday();
s.viewMode='today';
s.lookupMode='results';
s.lookupSearched=false;
s.lookupCounts={results:0,orders:0};
s.todayFilters={hn:'',dates:[s.currentDay,s.currentDay]};
s.lookupFilters={hn:'',dates:[]};
s.filters={...s.todayFilters};
s.scanMode=false;
s.scannedHn='';
s.scanNoticePending=false;
s.createOrderLoading=false;
s.statusKey='all';
s.counts={all:0,waiting:0,received:0,partial:0,complete:0,cancelled:0};
s.page={current:1,size:30,total:0};
s.loadSeq=0;
s.countSeq=0;
s.cbcCountSeq=0;
s.statusFilters=[
  {key:'waiting',label:'รอรับ'},
  {key:'received',label:'รับแล้ว'},
  {key:'partial',label:'ออกผลบางส่วน'},
  {key:'complete',label:'ออกผลครบ'},
  {key:'cancelled',label:'ยกเลิก / ปฏิเสธ'},
  {key:'all',label:'ทั้งหมด'}
];
s.statusMap={
  all:['sent','accepted','prepared','ready','dispensed','resulted','completed','cancelled','rejected'],
  waiting:['sent','ready'],
  received:['accepted','prepared','dispensed'],
  partial:['resulted'],
  complete:['completed'],
  cancelled:['cancelled','rejected']
};
s.lookupStatusMap={
  results:['resulted','completed'],
  orders:['sent','accepted','prepared','ready','dispensed','resulted','completed','cancelled','rejected']
};
s.canUseCbcSwap=()=>{const code=s.unitCode();return ['M1003','M0104','M1004','20','20-22','21','HM','ML'].includes(code);};
s.cbcItem=o=>o&&o.cbc_item||o&&Array.isArray(o.cbc_items)&&o.cbc_items[0]||{};
s.isCbcSwapItem=(o,i)=>!!(i&&s.text(i.item_id)&&s.text(i.item_id)===s.text(s.cbcItem(o).item_id));
s.cbcItemCountText=o=>{const total=Number(o&&o.item_count||0),count=o&&Array.isArray(o.cbc_items)?o.cbc_items.length:(s.cbcItem(o).item_id?1:0);return total>1?count+' ใน '+total+' รายการ':count+' รายการ';};
s.cbcSectionCodes=o=>{const first=s.text(s.cbcItem(o).section_code).toUpperCase(),out=[];if(first)out.push(first);(o&&Array.isArray(o.items)?o.items:[]).forEach(i=>{const code=s.text(i&&i.section_code).toUpperCase();if(code&&!out.includes(code))out.push(code);});return out.length?out:['-'];};
s.cbcSwapFromCode=()=>s.text(s.cbcSwapDialog.item&&s.cbcSwapDialog.item.item_code);
s.cbcSwapFromSection=()=>s.text(s.cbcSwapDialog.item&&s.cbcSwapDialog.item.section_code);
s.cbcSwapTargetCode=()=>s.cbcSwapFromCode()==='HM1'?'MS1':'HM1';
s.cbcSwapTargetSection=()=>s.cbcSwapTargetCode()==='HM1'?'HM':'ML';
s.cbcSwapOrder=()=>s.cbcSwapDialog.order||{};
s.cbcSwapPatientInitials=()=>{const p=s.cbcSwapOrder().patient||{},first=s.text(p.first_name),last=s.text(p.last_name);return (first.charAt(0)+last.charAt(0))||s.text(p.hn).slice(-2)||'LAB';};
s.cbcSwapPatientMeta=()=>{const o=s.cbcSwapOrder(),p=o.patient||{},parts=[];const hn=s.text(p.hn),gender=s.text(p.gender_text),age=s.ageText(o),room=s.sourceRoom(o);if(hn)parts.push('HN '+hn);if(gender)parts.push(gender);if(age)parts.push(age);if(room)parts.push(room);return parts.join(' · ');};
s.cbcSwapTargetSectionName=()=>s.cbcSwapTargetSection()==='HM'?'งานโลหิตวิทยา':'งานจุลทรรศนศาสตร์คลินิก';
s.cbcSwapReasonText=()=>{const code=s.text(s.cbcSwapDialog.reasonCode),detail=s.text(s.cbcSwapDialog.reasonDetail),label=CBC_SWAP_REASON_LABELS[code]||code;if(label&&detail)return label+' · '+detail;return detail||label||'';};
s.resetCbcSwapDialog=()=>{if(s.cbcSwapDialog.loading)return;s.cbcSwapDialog={visible:false,loading:false,order:null,item:null,reasonCode:'',reasonDetail:''};};
s.openCbcSwap=order=>{const item=s.cbcItem(order);if(!item||!item.item_id||!item.swap_allowed){field.notify('รายการ CBC นี้รับ specimen หรือเริ่มดำเนินการแล้ว','warning',4000);return;}s.cbcSwapDialog={visible:true,loading:false,order:order,item:item,reasonCode:'',reasonDetail:''};};
s.submitCbcSwap=async()=>{const d=s.cbcSwapDialog,item=d.item,order=d.order;if(d.loading||!item||!item.item_id)return;s.cbcSwapDialog={...d,loading:true};try{const p=await s.processCall(PROCESS_ID,{action:'swap_cbc_item',item_id:item.item_id,order_id:order&&order.order_id,reason:s.cbcSwapReasonText(),organization_code:s.unitCode()});if(!p||p.success===false){s.cbcSwapDialog={...s.cbcSwapDialog,loading:false};field.notify(s.text(p&&p.message)||'สลับรายการ CBC ไม่สำเร็จ','error',6000);return;}const key=s.orderRowKey(order);s.orders=s.orders.filter(row=>s.orderRowKey(row)!==key);s.page={...s.page,total:Math.max(0,s.page.total-1)};s.cbcSwapCount=Math.max(0,s.cbcSwapCount-1);s.cbcSwapDialog={visible:false,loading:false,order:null,item:null,reasonCode:'',reasonDetail:''};field.notify(s.text(p.message)||'สลับรายการ CBC แล้ว','success',4000);}catch(error){s.cbcSwapDialog={...s.cbcSwapDialog,loading:false};field.notify(s.text(error&&error.message)||'เรียก API สลับ CBC ไม่สำเร็จ','error',6000);}};

s.text=v=>{
  if(v==null)return '';
  if(typeof v==='object')return s.text(v.label||v.name||v.display_name||v.full_name||v.username||v.code||v.value||v._id||'');
  return String(v).trim();
};
s.stripEmail=v=>String(v||'')
  .replace(/\\s*[\\(<\\[]?[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}[\\)>\\]]?\\s*/ig,' ')
  .replace(/\\(\\s*\\)|\\[\\s*\\]|<\\s*>/g,' ')
  .replace(/\\s{2,}/g,' ')
  .trim();
s.personName=v=>{
  if(!v)return '';
  if(typeof v==='object'){
    const parts=[s.text(v.prename||v.prefix||v.title),s.text(v.first_name||v.p_fname||v.firstname),s.text(v.last_name||v.p_lname||v.lastname)].filter(Boolean);
    if(parts.length>=2)return s.stripEmail(parts.join(' '));
    return s.stripEmail(s.text(v.display_name||v.full_name||v.name||v.label||v.username||''));
  }
  return s.stripEmail(v);
};
s.rejectReasonText=i=>{
  const fallback=s.text(i&&i.reject_reason),detail=s.text(i&&i.reject_reason_detail);
  const directCode=s.text(i&&i.reject_reason_code),code=directCode||(s.rejectReasonLabels[fallback]?fallback:'');
  const label=s.rejectReasonLabels[code]||code;
  if(label&&detail&&label!==detail)return label+' · '+detail;
  return detail||label||fallback||'';
};
s.actionReasonText=i=>s.text(i&&i.current_status).toLowerCase()==='cancelled'?(s.text(i&&i.cancel_reason)||'ยกเลิก order'):s.rejectReasonText(i);
s.actionActorText=i=>s.personName(s.text(i&&i.current_status).toLowerCase()==='cancelled'?(i&&i.cancelled_by):(i&&i.rejected_by))||'';
s.canRetestItem=i=>s.viewMode==='today'&&s.text(i&&i.current_status).toLowerCase()==='rejected';
s.patientName=o=>[s.text(o&&o.patient&&o.patient.prename),s.text(o&&o.patient&&o.patient.first_name),s.text(o&&o.patient&&o.patient.last_name)].filter(Boolean).join(' ');
s.optionCode=v=>{if(v==null)return '';if(typeof v==='object')return s.text(v.value||v.code||v.id||v._id||'');return s.text(v);};
s.priorMedicationText=o=>s.text(o&&o.prior_specify);
s.hasPriorMedication=o=>s.optionCode(o&&o.prior_medication)==='2'&&!!s.priorMedicationText(o);
s.coverage=o=>s.text(o&&o.finance&&o.finance.coverage);
s.coverageAbbrev=o=>{
  const raw=o&&o.finance&&o.finance.coverage;
  let list=[];
  if(Array.isArray(raw))list=raw;
  else if(typeof raw==='string'&&['[','{'].includes(raw.trim().charAt(0))){try{const parsed=JSON.parse(raw);list=Array.isArray(parsed)?parsed:[parsed];}catch(e){list=[raw];}}
  else if(raw!=null&&raw!=='')list=[raw];
  for(let index=0;index<list.length;index++){
    const item=list[index],main=item&&typeof item==='object'&&item.inscl_item_main;
    const code=s.text(main&&typeof main==='object'?(main.value||main.code||main.id):(item&&typeof item==='object'?(item.value||item.code||item.id):item));
    if(code)return code.toUpperCase()==='CASH'?'':code;
  }
  return '';
};
s.requesterName=o=>{const r=o&&o.requester||{};return s.personName(r.cosign_user)||s.personName(r.visit_doctor);};
s.sourceRoom=o=>s.text(o&&o.visit&&(o.visit.clinic||o.visit.ward));
s.admissionNumber=o=>s.text(o&&o.visit&&o.visit.an);
s.encounterClass=o=>s.admissionNumber(o)?'IPD':(s.text(o&&o.visit&&o.visit.encounter_class).toUpperCase()==='IPD'?'IPD':'OPD');
s.isPaid=o=>{const f=o&&o.finance||{};const total=Number(f.total_amount||0);return total>0&&Number(f.paid_amount||0)>=total;};
s.showPaid=o=>s.isPaid(o)&&!s.coverageAbbrev(o);
s.showPaymentStatus=o=>{const f=o&&o.finance||{};return Number(f.total_amount||0)>0||!!s.coverageAbbrev(o);};
s.isFinancePassed=o=>{
  const terminal=['cancelled','rejected','returned','reversed'];
  const passed=['ready','accepted','prepared','dispensed','processing','resulted','completed'];
  const items=o&&Array.isArray(o.items)?o.items:[];
  const active=items.filter(item=>!terminal.includes(s.text(item&&item.current_status).toLowerCase()));
  return active.length?active.every(item=>passed.includes(s.text(item&&item.current_status).toLowerCase())):s.isPaid(o);
};
s.isUrgent=o=>{const p=s.text(o&&o.priority).toLowerCase();return p.includes('urgent')||p.includes('stat')||p.includes('ด่วน')||['2','3','4','5'].includes(p);};
s.ageText=o=>s.text(o&&o.patient&&o.patient.age);
s.orderAgeText=o=>{
  const raw=o&&o.patient&&o.patient.age;
  if(raw==null||raw==='')return '';
  let year='',month='',day='';
  if(typeof raw==='object'){
    const value=(...keys)=>{for(let i=0;i<keys.length;i++){const v=raw[keys[i]];if(v!=null&&v!=='')return s.text(v);}return '';};
    year=value('year','years','y');month=value('month','months','m');day=value('day','days','d');
  }else{
    const value=s.text(raw).trim();
    const yearMatch=value.match(/(-?[0-9]+(?:[.][0-9]+)?)[ \t]*(?:y|ปี)/i);
    const monthMatch=value.match(/(-?[0-9]+(?:[.][0-9]+)?)[ \t]*(?:m|เดือน)/i);
    const dayMatch=value.match(/(-?[0-9]+(?:[.][0-9]+)?)[ \t]*(?:d|วัน)/i);
    if(yearMatch||monthMatch||dayMatch){year=yearMatch?yearMatch[1]:'';month=monthMatch?monthMatch[1]:'';day=dayMatch?dayMatch[1]:'';}
    else if(/^-?[0-9]+(?:[.][0-9]+)?$/.test(value))year=value;
  }
  if(!year&&!month&&!day)return '';
  return year+' ปี '+month+' เดือน '+day+' วัน';
};
s.diagnosisText=o=>s.text(o&&(o.diagnosis||(o.emr_context&&o.emr_context.diagnosis)));
s.itemTooltipLines=o=>(o&&Array.isArray(o.items)?o.items:[]).map(i=>[s.text(i&&i.item_code),s.text(i&&i.item_name)].filter(Boolean).join(' ')).filter(Boolean);
s.sourceManagedSections=['IM','MI-OUT','MY','MB'];
s.isSourceManagedItem=i=>i&&i.source_managed===true||s.sourceManagedSections.includes(s.text(i&&i.section&&i.section.code).trim().toUpperCase());
s.isManualPathologyItem=i=>s.text(i&&(i.section&&i.section.code||i.section_code)).trim().toUpperCase()==='MY';
s.isManualPathologyOrder=o=>{const items=s.resultItems(o);return !!items.length&&items.every(s.isManualPathologyItem);};
s.specimenLockedSections=['IM','MI-OUT'];
s.isSpecimenLockedItem=i=>s.specimenLockedSections.includes(s.text(i&&i.section&&i.section.code).trim().toUpperCase());
s.requiresItemComment=i=>s.isSourceManagedItem(i)&&!!(i&&i.order_requirements&&i.order_requirements.req_commt);
s.isMultiSpecimenItem=i=>s.isSourceManagedItem(i)&&!!(i&&i.order_requirements&&i.order_requirements.multi_specimen);
s.itemCommentText=i=>s.text(i&&i.item_comment);
s.itemQuantity=i=>{const value=Math.floor(Number(i&&i.quantity));return Number.isFinite(value)&&value>0?value:1;};
s.displayItems=o=>{const out=[];(o&&Array.isArray(o.items)?o.items:[]).forEach(item=>{const ordered=item&&item.specimen&&item.specimen.ordered||{},rows=Array.isArray(ordered.rows)?ordered.rows:[],count=Math.max(s.itemQuantity(item),rows.length||0,1);if(count===1){out.push(item);return;}for(let index=0;index<count;index++)out.push({...item,_quantityView:true,_quantityIndex:index,_quantityCount:count,_quantitySpecimenRow:rows[index]||null});});return out;};
s.displayItemCount=o=>s.displayItems(o).length;
s.displayItemKey=(i,index)=>s.text(i&&i.item_id)+':'+(i&&i._quantityView===true?i._quantityIndex:index);
s.isFirstQuantityRow=i=>!(i&&i._quantityView===true)||i._quantityIndex===0;
s.specimenRowOriginalIndex=(i,rowIndex)=>i&&i._quantityView===true&&Number.isInteger(i._quantityIndex)?i._quantityIndex:rowIndex;
s.specimenHasRows=i=>!!(i&&i.specimen&&i.specimen.ordered&&Array.isArray(i.specimen.ordered.rows)&&i.specimen.ordered.rows.length);
s.multiSpecimenRows=i=>{
  const ordered=i&&i.specimen&&i.specimen.ordered||{};
  if(i&&i._quantityView===true)return i._quantitySpecimenRow?[i._quantitySpecimenRow]:[];
  if(Array.isArray(ordered.rows)&&ordered.rows.length)return ordered.rows;
  return ordered.source||ordered.source_code||ordered.site_name||ordered.site_code||ordered.collected_at?[ordered]:[];
};
s.specimenRowName=row=>s.text(row&&(row.spec_source||row.specimen_name||row.source||row.spec_source_code||row.specimen_code||row.source_code))||'ไม่ระบุ specimen';
s.specimenRowSite=row=>s.text(row&&(row.spec_site_name||row.site_name||row.spec_site_code||row.site_code));
s.hasSpecimenLocation=i=>s.multiSpecimenRows(i).some(row=>!!s.specimenRowSite(row));
s.usesSpecimenDetailPattern=i=>s.isMultiSpecimenItem(i)||s.hasSpecimenLocation(i);
s.specimenSelectionKey=(i,rowIndex)=>s.text(i&&i.item_id)+(s.specimenHasRows(i)&&Number.isInteger(rowIndex)?':'+rowIndex:'');
s.specimenRowValue=(i,row,rowIndex)=>s.text(s.specimenEdits[s.specimenSelectionKey(i,rowIndex)])||s.text(row&&(row.spec_source_code||row.specimen_code||row.source_code))||s.specimenValue(i);
s.specimenRowCollectedAt=row=>s.text(row&&(row.specimen_at||row.collected_at));
s.specimenRowStorageCode=row=>{const raw=s.text(row&&(row.ship_storage||row.storage)).trim(),upper=raw.toUpperCase();if(upper==='IM'||raw==='ส่งทันที')return'IM';if(upper==='RF'||raw==='ตู้เย็น')return'RF';if(upper==='RT'||raw==='อุณหภูมิห้อง')return'RT';return raw;};
s.specimenRowStorageText=row=>({IM:'ส่งทันที',RF:'ตู้เย็น',RT:'อุณหภูมิห้อง'})[s.specimenRowStorageCode(row)]||s.specimenRowStorageCode(row);
s.specimenRowStorageClass=row=>({IM:'is-immediate',RF:'is-refrigerated',RT:'is-room-temperature'})[s.specimenRowStorageCode(row)]||'is-other';
s.specimenRowTemperatureText=row=>{const value=s.text(row&&(row.ship_temp!=null?row.ship_temp:row.temperature)),upper=value.toUpperCase();return value&&!value.includes('°')&&!value.includes('℃')&&!upper.endsWith('C')?value+'°C':value;};
s.specimenRowSourceText=row=>s.text(row&&(row.spec_note||row.note));
s.specimenDisplay=i=>s.text(i&&i.specimen&&i.specimen.ordered&&i.specimen.ordered.source)||s.text(i&&i.specimen&&i.specimen.master&&i.specimen.master.name)||s.specimenValue(i)||'ไม่ระบุ specimen';
s.specimenTooltipLines=o=>(o&&Array.isArray(o.items)?o.items:[]).map(i=>{const specimen=s.specimenDisplay(i),test=[s.text(i&&i.item_code),s.text(i&&i.item_name)].filter(Boolean).join(' ');return test?specimen+' · '+test:specimen;}).filter(Boolean);
s.specimenCount=o=>s.displayItemCount(o);
s.specimenSourceText=i=>s.text(i&&i.specimen&&i.specimen.ordered&&i.specimen.ordered.note);
s.specimenStorageCode=i=>{const raw=s.text(i&&i.specimen&&i.specimen.ordered&&i.specimen.ordered.storage).trim(),upper=raw.toUpperCase();if(upper==='IM'||raw==='ส่งทันที')return'IM';if(upper==='RF'||raw==='ตู้เย็น')return'RF';if(upper==='RT'||raw==='อุณหภูมิห้อง')return'RT';return raw;};
s.specimenStorageText=i=>({IM:'ส่งทันที',RF:'ตู้เย็น',RT:'อุณหภูมิห้อง'})[s.specimenStorageCode(i)]||s.specimenStorageCode(i);
s.specimenStorageClass=i=>({IM:'is-immediate',RF:'is-refrigerated',RT:'is-room-temperature'})[s.specimenStorageCode(i)]||'is-other';
s.specimenBase=i=>s.text(i&&i.specimen&&i.specimen.ordered&&i.specimen.ordered.source_code)||s.text(i&&i.specimen&&i.specimen.master&&i.specimen.master.code)||s.text(i&&i.specimen&&i.specimen.ordered&&i.specimen.ordered.source);
s.specimenValue=i=>s.text(s.specimenEdits[i&&i.item_id])||s.specimenBase(i);
s.specimenExpected=i=>s.text(i&&i.specimen&&i.specimen.master&&i.specimen.master.code)||s.text(i&&i.specimen&&i.specimen.master&&i.specimen.master.name);
s.specimenChanged=i=>{const expected=s.specimenExpected(i).trim().toUpperCase();const selected=s.specimenValue(i).trim().toUpperCase();return !!(expected&&selected&&expected!==selected);};
s.specimenRowChanged=(i,row,rowIndex)=>{const expected=s.specimenExpected(i).trim().toUpperCase(),selected=s.specimenRowValue(i,row,rowIndex).trim().toUpperCase();return !!(expected&&selected&&expected!==selected);};
s.specimenOptions=i=>{
  return (Array.isArray(s.specimenDropdownOptions)?s.specimenDropdownOptions:[])
    .map(x=>({value:s.text(x&&x.code||x&&x.value||x),label:s.text(x&&x.name||x&&x.label||x&&x.code||x&&x.value||x)}));
};
s.isMycology=i=>s.text(i&&i.section&&i.section.code).toUpperCase()==='MY';
s.isMicrobiologyItem=i=>s.text(i&&(i.section&&i.section.code||i.section_code)).toUpperCase()==='MB';
s.isMicrobiologyOrder=o=>{if(s.reportSectionCode(o)==='MB')return true;const items=s.resultItems(o);return !!items.length&&items.every(s.isMicrobiologyItem);};
s.microbiologyRequestPdfReady=i=>!!(MICROBIOLOGY_REQUEST_PDF_REPORT_ID&&s.isMicrobiologyItem(i)&&/^[a-f0-9]{24}$/i.test(s.text(i&&i.item_id)));
s.microbiologyRequestPdfParams=i=>({item_id:s.text(i&&i.item_id)});
s.microbiologyRequestPdfHint=i=>!MICROBIOLOGY_REQUEST_PDF_REPORT_ID?'ยังไม่ได้ตั้งค่า Report Factory สำหรับใบลงผล MLab':!s.isMicrobiologyItem(i)?'ใช้ใบลงผลนี้เฉพาะห้อง MLab':/^[a-f0-9]{24}$/i.test(s.text(i&&i.item_id))?'พร้อมเปิดใบลงผล MLab':'ไม่พบ Item ID สำหรับสร้างใบลงผล MLab';
s.isMicrobiologyResult=()=>{
  const dataSection=s.text(s.manual&&s.manual.data&&s.manual.data.section_code).toUpperCase();
  if(dataSection)return dataSection==='MB';
  if(s.manual&&s.manual.item)return s.isMicrobiologyItem(s.manual.item);
  const items=s.manual&&s.manual.order&&Array.isArray(s.manual.order.items)?s.manual.order.items:[];
  return !!items.length&&items.every(s.isMicrobiologyItem);
};
s.resultEntryStatuses=['accepted','prepared','dispensed','resulted'];
s.resultEditStatuses=['accepted','prepared','dispensed','resulted','completed'];
s.canEditManual=i=>!!i&&s.resultEntryStatuses.includes(s.text(i&&i.current_status).toLowerCase());
s.canEditResultRow=result=>{if(result&&result.redacted===true)return false;const item=result&&result._item,status=s.text(item&&item.current_status).toLowerCase(),persisted=/^[a-f0-9]{24}$/i.test(s.text(result&&result.result_item_id));return persisted?s.resultEditStatuses.includes(status):s.canEditManual(item);};
s.canEditResult=()=>{
  if(s.viewMode==='lookup')return false;
  if(s.isMicrobiologyResult())return false;
  if(s.manual&&s.manual.orderView)return s.resultGroupsForDisplay().some(group=>(Array.isArray(group&&group.results)?group.results:[]).some(s.canEditResultRow));
  const item=s.manual&&s.manual.item;
  const status=s.text(item&&item.current_status).toLowerCase();
  return s.canEditManual(item)||(s.hasPersistedResult()&&s.resultEditStatuses.includes(status));
};
s.orderAttachmentItem=()=>{
  if(!s.manual)return null;
  if(!s.manual.orderView)return s.isMicrobiologyResult()&&s.manual.item&&s.canViewResult(s.manual.item)?s.manual.item:null;
  const items=s.manual.order&&Array.isArray(s.manual.order.items)?s.manual.order.items:[];
  return items.find(item=>item&&s.canViewResult(item))||null;
};
s.canUploadResultFile=()=>s.viewMode==='today'&&!!s.orderAttachmentItem();
s.canViewResult=i=>['sent','accepted','prepared','ready','dispensed','resulted','completed'].includes(s.text(i&&i.current_status).toLowerCase());
s.resultItems=o=>(o&&Array.isArray(o.items)?o.items:[]).filter(s.canViewResult);
s.resultDisplayItems=o=>{const out=[];s.resultItems(o).forEach(item=>{if(s.isManualPathologyItem(item))out.push(...s.displayItems({items:[item]}));else out.push(item);});return out;};
s.canOpenResultTab=o=>s.resultItems(o).length>0;
s.resultedAt=i=>s.text(i&&(i.resulted_at||(i.result_summary&&i.result_summary.resulted_at)));
s.latestResultAt=i=>s.text(i&&(i.latest_result_at||(i.result_summary&&i.result_summary.reported_at)))||s.resultedAt(i);
s.resultTime=i=>s.latestResultAt(i)?s.timePart(s.latestResultAt(i)):'';
s.criticalValue=i=>{
  const summary=i&&i.result_summary&&typeof i.result_summary==='object'?i.result_summary:{};
  const raw=summary.is_critical!=null?summary.is_critical:i&&i.is_critical;
  const normalized=s.text(raw).toLowerCase();
  if(raw===true||raw===1||['true','1','critical'].includes(normalized))return true;
  if(raw===false||raw===0||['false','0','normal','not_critical'].includes(normalized))return false;
  return null;
};
s.resultStatusKey=i=>{const status=s.text(i&&(i.current_status||i.work_status)).toLowerCase();if(status==='completed')return'complete';if(status==='resulted')return'partial';return s.resultedAt(i)?'complete':'pending';};
s.resultStatusText=i=>({partial:'ออกผลบางส่วน',complete:'ออกผลครบ',pending:'รอผล'})[s.resultStatusKey(i)]||'รอผล';
s.resultStatusClass=i=>s.resultStatusKey(i)==='pending'?'is-pending':'is-resulted';
s.resultHiddenItem=i=>!!(i&&i.is_hide_result===true);
s.detailTab=o=>s.detailTabs[s.orderRowKey(o)]||'order';
s.setDetailTab=(o,tab)=>{const id=s.orderRowKey(o);if(!id)return;s.detailTabs={...s.detailTabs,[id]:tab};if(tab==='results')s.loadResultActorsForOrder(o);};
s.resultSourceText=v=>{const source=s.text(v).toLowerCase();return source==='agent'||source==='lis'?'LIS':source==='manual'?'Manual':source||'';};
s.resultDialogTitle=()=>s.manual.editing?'แก้ไขผลตรวจ':'ผลตรวจทางห้องปฏิบัติการ';
s.editResultTitle=()=>s.canEditResult()?(s.manual.editing?'ออกจากโหมดแก้ไขผลตรวจ':s.manual.orderView?'กรอกหรือแก้ไขผลทุก Item ใน Order':'กรอกหรือแก้ไขผลตรวจ'):'รับ specimen ก่อนกรอกหรือแก้ไขผล';
s.emptyResultData=()=>({reported_at:'',reported_by_source_id:'',reported_by_source_name:'',verified_at:'',verified_by_source_id:'',verified_by_source_name:'',order_note:'',results:[]});
s.resultContext=(item,order)=>({
  item_id:s.text(item&&item.item_id),
  order_id:s.text(order&&order.order_id),
  order_no:s.text(order&&order.order_number),
  section_code:s.text(item&&item.section&&item.section.code).toUpperCase(),
  patient_hn:s.text(order&&order.patient&&order.patient.hn),
  patient_name:s.patientName(order),
  patient_age:s.ageText(order),
  visit_vn:s.text(order&&order.visit&&order.visit.vn||order&&order.emr_context&&order.emr_context.vn),
  ward_clinic:s.sourceRoom(order),
  lab_no:s.text(item&&item.lab_no),
  test_code:s.text(item&&item.item_code),
  test_name:s.text(item&&item.item_name),
  specimen_name:s.specimenDisplay(item),
  collected_at:s.text(item&&item.specimen&&item.specimen.ordered&&item.specimen.ordered.collected_at),
  received_at:s.text(item&&item.received_at),
  reported_at:s.resultedAt(item),
  reported_by_source_id:'',
  reported_by_source_name:'',
  verified_at:'',
  verified_by_source_id:'',
  verified_by_source_name:'',
  order_note:'',
  is_hide_result:s.resultHiddenItem(item),
  result_visibility_action:s.text(item&&item.result_visibility_action),
  result_visibility_reason:s.text(item&&item.result_visibility_reason),
  result_visibility_by:item&&item.result_visibility_by||null,
  result_visibility_at:s.text(item&&item.result_visibility_at),
  results:[]
});
s.patientInitials=name=>{const parts=s.text(name).split(/\\s+/).filter(Boolean);return parts.slice(0,2).map(part=>part.charAt(0)).join('').toUpperCase()||'LAB';};
s.resultRowsFromData=data=>{
  data=data&&typeof data==='object'?data:{};
  if(Array.isArray(data.results)&&data.results.length)return data.results;
  return [{result_item_id:'',test_code:s.text(data.test_code),test_name:s.text(data.test_name),result_value:s.text(data.result_value),result_comment:s.text(data.result_comment),unit:s.text(data.unit),reference_range:s.text(data.reference_range),interpretation:s.text(data.interpretation),result_source:s.text(data.result_source),reported_at:s.text(data.reported_at),reported_by_source_id:s.text(data.reported_by_source_id),reported_by_source_name:s.text(data.reported_by_source_name),verified_at:s.text(data.verified_at),verified_by_source_id:s.text(data.verified_by_source_id),verified_by_source_name:s.text(data.verified_by_source_name),is_critical:false}];
};
s.resultRowsWithEditKeys=(item,rows)=>(Array.isArray(rows)?rows:[]).map((result,index)=>{const itemId=s.text(item&&item.item_id),identity=s.text(result&&result.result_item_id)||s.text(result&&result.test_code)||String(index);return {...result,_item:item,_item_id:itemId,_edit_key:itemId+'|'+identity+'|'+index};});
s.resultGroupsForDisplay=()=>{
  if(s.manual&&s.manual.orderView)return Array.isArray(s.manual.groups)?s.manual.groups:[];
  const data=s.manual&&s.manual.data||{};
  const rows=s.resultRowsWithEditKeys(s.manual&&s.manual.item,s.resultRowsFromData(data));
  return [{item_id:s.text(data.item_id),test_code:s.text(data.test_code),test_name:s.text(data.test_name)||(rows[0]&&rows[0].test_name),panel:s.manual&&s.manual.item&&s.manual.item.panel||{},results:rows,unmatched_receipts:Array.isArray(data.unmatched_receipts)?data.unmatched_receipts:[]}];
};
s.resultGroupKey=(group,index)=>s.text(group&&group.group_key)||s.text(group&&group.item_id)||s.text(group&&group.test_code)||s.text(group&&group.test_name)||'result-group-'+String(index||0);
s.resultGroupIsProfile=group=>{const panel=group&&group.panel&&typeof group.panel==='object'?group.panel:{},rows=Array.isArray(group&&group.results)?group.results:[];return s.text(group&&group.group_key).startsWith('panel:')||!!(s.text(panel.set_code)||s.text(panel.parent_code))||rows.length>1;};
s.resultRowNumber=(group,groupIndex,resultIndex)=>s.resultGroupIsProfile(group)?String((Number(groupIndex)||0)+1)+'.'+String((Number(resultIndex)||0)+1):String((Number(groupIndex)||0)+1);
s.resultGroupExpanded=(group,index)=>s.resultGroupOpen[s.resultGroupKey(group,index)]===true;
s.initResultGroupOpen=()=>{const next={},previous=s.resultGroupOpen||{};let first=true;s.resultGroupsForDisplay().forEach((group,index)=>{if(!s.resultGroupIsProfile(group))return;const key=s.resultGroupKey(group,index);next[key]=Object.prototype.hasOwnProperty.call(previous,key)?previous[key]:first;first=false;});s.resultGroupOpen=next;};
s.toggleResultGroup=(group,index)=>{const key=s.resultGroupKey(group,index);s.resultGroupOpen={...s.resultGroupOpen,[key]:!s.resultGroupExpanded(group,index)};};
s.resultProfileCount=()=>s.resultGroupsForDisplay().filter(s.resultGroupIsProfile).length;
s.mergeResultRevisions=groups=>{
  const byId={},output=[];
  (Array.isArray(groups)?groups:[]).forEach(group=>(Array.isArray(group&&group.revisions)?group.revisions:[]).forEach(revision=>{
    const id=s.text(revision&&revision.revision_id);if(!id)return;
    if(!byId[id]){byId[id]={...revision,items:[]};byId[id]._itemSeen={};output.push(byId[id]);}
    (Array.isArray(revision&&revision.items)?revision.items:[]).forEach(item=>{const key=s.text(item&&item.test_code)||JSON.stringify(item);if(byId[id]._itemSeen[key])return;byId[id]._itemSeen[key]=true;byId[id].items.push({...item});});
  }));
  output.sort((left,right)=>s.text(right&&right.report_seq).localeCompare(s.text(left&&left.report_seq),undefined,{numeric:true})||s.text(right&&right.received_at).localeCompare(s.text(left&&left.received_at)));
  output.forEach((revision,index)=>{delete revision._itemSeen;revision.latest=index===0;revision.no=output.length-index;});
  return output;
};
s.resultRevisions=()=>Array.isArray(s.manual&&s.manual.revisions)?s.manual.revisions:[];
s.resultRevisionCount=()=>s.resultRevisions().length;
s.selectedResultRevision=()=>s.resultRevisions().find(revision=>s.text(revision&&revision.revision_id)===s.text(s.manual&&s.manual.selectedRevisionId))||s.resultRevisions()[0]||null;
s.selectResultRevision=revision=>{s.manual={...s.manual,selectedRevisionId:s.text(revision&&revision.revision_id)};};
s.toggleResultRevisionHistory=()=>{const revisions=s.resultRevisions();if(!revisions.length)return;const open=!s.manual.revisionHistoryOpen;s.manual={...s.manual,revisionHistoryOpen:open,selectedRevisionId:open?s.text(revisions[0]&&revisions[0].revision_id):''};};
s.revisionStageText=stage=>({partial:'PARTIAL',preliminary:'PRELIMINARY',final:'FINAL',corrected:'CORRECTED',cancelled:'CANCELLED'})[s.text(stage).toLowerCase()]||s.text(stage).toUpperCase()||'-';
s.setAllResultGroupsExpanded=open=>{const next={...s.resultGroupOpen};s.resultGroupsForDisplay().forEach((group,index)=>{if(!s.resultGroupIsProfile(group))return;next[s.resultGroupKey(group,index)]=open===true;});s.resultGroupOpen=next;};
s.expandAllResultGroups=()=>s.setAllResultGroupsExpanded(true);
s.collapseAllResultGroups=()=>s.setAllResultGroupsExpanded(false);
s.labResultPdfParentIds=()=>{
  const prepared=s.text(s.manual&&s.manual.pdfParentId);
  if(/^[a-f0-9]{24}$/i.test(prepared))return [prepared];
  const rowIds=[],rowSeen={},fallbackIds=[],fallbackSeen={};
  const add=(target,seen,id)=>{id=s.text(id);if(!/^[a-f0-9]{24}$/i.test(id)||seen[id])return;seen[id]=true;target.push(id);};
  s.resultGroupsForDisplay().forEach(group=>{
    (Array.isArray(group&&group.results)?group.results:[]).forEach(result=>add(rowIds,rowSeen,result&&result.result_report_id));
    add(fallbackIds,fallbackSeen,group&&group.data&&group.data.result_report_id);
    (Array.isArray(group&&group.data&&group.data.result_report_ids)?group.data.result_report_ids:[]).forEach(id=>add(fallbackIds,fallbackSeen,id));
  });
  // Clinical Result Item parents are authoritative. Older API versions reused
  // data.result_report_id for the attachment container, which made an Order
  // with one uploaded file look like two printable result sets and disabled
  // the report button. Locked Sensitive groups have no rows, so they still use
  // the server-supplied redacted-PDF parent as the fallback.
  if(rowIds.length)return rowIds;
  if(fallbackIds.length)return fallbackIds;
  const ids=[];
  if(s.resultRowsForDisplay().some(result=>s.text(result&&result.result_value)!=='')){
    const fallback=s.text(s.manual&&s.manual.data&&s.manual.data.result_report_id);
    if(/^[a-f0-9]{24}$/i.test(fallback))ids.push(fallback);
  }
  return ids;
};
s.labResultPdfParentId=()=>{const ids=s.labResultPdfParentIds();return ids.length===1?ids[0]:'';};
s.activeLabResultPdfReportList=()=>s.isMicrobiologyResult()?s.microbiologyResultPdfReportList:s.labResultPdfReportList;
s.labResultPdfReady=()=>{
  if(!s.manual||s.manual.loading)return false;
  if(s.isMicrobiologyResult())return !!(MICROBIOLOGY_RESULT_PDF_REPORT_ID&&s.labResultPdfParentId());
  if(!s.manual.orderView)return false;
  return !!(LAB_RESULT_PDF_REPORT_ID&&s.labResultPdfParentId());
};
s.labResultPdfParams=()=>{
  if(s.isMicrobiologyResult())return {xparentx:s.labResultPdfParentId()};
  return {xparentx:s.labResultPdfParentId()};
};
s.labResultPdfHint=()=>{
  if(s.manual&&s.manual.loading)return 'กำลังอ่านผลตรวจ';
  if(s.isMicrobiologyResult()){
    if(!MICROBIOLOGY_RESULT_PDF_REPORT_ID)return 'ยังไม่ได้ตั้งค่า Report Factory สำหรับ Microbiology';
    const microIds=s.labResultPdfParentIds();
    if(microIds.length>1)return 'MLab ส่งผลหลายชุด จึงไม่เลือก Result Report ให้เอง';
    return microIds.length?'พร้อมสร้าง PDF รายงานผล Microbiology':'ยังไม่มี Result Report สำหรับสร้าง PDF Microbiology';
  }
  const ids=s.labResultPdfParentIds();
  if(ids.length>1)return 'Order นี้มีผลหลายชุด จึงไม่พิมพ์เพียงบางชุดโดยอัตโนมัติ';
  return ids.length?'พร้อมสร้าง PDF รายงานผล':'ยังไม่มีชุดผลที่ Report Factory ใช้สร้าง PDF';
};
s.microGroupKey=group=>s.text(group&&group.group_key)||s.text(group&&group.item_id)||s.text(group&&group.test_code)||s.text(group&&group.test_name)||'micro-result';
s.microGroupHasResult=group=>(Array.isArray(group&&group.results)?group.results:[]).some(result=>s.text(result&&result.result_value)!=='');
s.microResultRows=group=>(Array.isArray(group&&group.results)?group.results:[]).filter(result=>s.text(result&&result.result_value)!=='');
s.microUnmatchedReceipts=()=>{
  const output=[],seen={};
  s.resultGroupsForDisplay().forEach(group=>{
    (Array.isArray(group&&group.unmatched_receipts)?group.unmatched_receipts:[]).forEach((receipt,index)=>{
      const key=s.text(receipt&&receipt.receipt_id)||s.text(receipt&&receipt.result_uid)||String(index);
      if(seen[key])return;
      seen[key]=true;
      output.push(receipt);
    });
  });
  return output;
};
s.microUnmatchedRawText=()=>s.microUnmatchedReceipts().reduce((values,receipt)=>values.concat(
  (Array.isArray(receipt&&receipt.items)?receipt.items:[]).map(item=>s.text(item&&item.value)).filter(Boolean)
),[]).join('\\n\\n');
s.microUnmatchedFallback=()=>!s.resultGroupsForDisplay().some(s.microGroupHasResult)&&!!s.microUnmatchedRawText();
s.microExpanded=group=>s.microGroupOpen[s.microGroupKey(group)]!==false;
s.toggleMicroGroup=group=>{const key=s.microGroupKey(group);s.microGroupOpen={...s.microGroupOpen,[key]:!s.microExpanded(group)};};
s.microGroupStatusValue=group=>{
  const rows=Array.isArray(group&&group.results)?group.results:[];
  if(!s.microGroupHasResult(group))return 'pending';
  const statuses=rows.map(result=>s.text(result&&result.result_status).toLowerCase()).filter(Boolean);
  return statuses.length&&statuses.every(status=>['f','final','completed','complete'].includes(status))?'final':'partial';
};
s.microGroupStatusText=group=>({final:'Final',partial:'Partial result',pending:'รอผล'})[s.microGroupStatusValue(group)];
s.microGroupStatusClass=group=>'is-'+s.microGroupStatusValue(group);
s.microOverallStatusValue=()=>{const groups=s.resultGroupsForDisplay();if(!groups.length||groups.every(group=>!s.microGroupHasResult(group)))return 'pending';return groups.every(group=>s.microGroupStatusValue(group)==='final')?'final':'partial';};
s.microOverallStatusText=()=>({final:'Final',partial:'Partial result',pending:'รอผล'})[s.microOverallStatusValue()];
s.microOverallStatusClass=()=>'is-'+s.microOverallStatusValue();
s.microResultReportedAt=result=>s.text(result&&result.reported_at)||s.text(result&&result.entered_at);
s.microGroupReportedAt=group=>{
  const times=(Array.isArray(group&&group.results)?group.results:[]).map(s.microResultReportedAt).filter(Boolean).sort();
  return times[times.length-1]||s.text(group&&group.data&&group.data.reported_at);
};
s.microLatestReportedAt=()=>{const times=s.resultGroupsForDisplay().map(s.microGroupReportedAt).filter(Boolean).sort();return times[times.length-1]||s.text(s.manual&&s.manual.data&&s.manual.data.reported_at);};
s.microCriticalInterpretations=()=>Array.from(new Set(s.resultRowsForDisplay().filter(result=>result&&result.is_critical===true).map(result=>s.text(result&&result.interpretation)).filter(Boolean))).join(', ');
s.microResultCountText=()=>{const groups=s.resultGroupsForDisplay(),done=groups.filter(s.microGroupHasResult).length;return 'ทั้งหมด '+groups.length+' · มีผล '+done+' · รอผล '+Math.max(0,groups.length-done);};
s.copyMicrobiologyResult=()=>{
  const fallback=s.microUnmatchedFallback()?s.microUnmatchedRawText():'';
  const orderNote=s.resultOrderNote();
  if(fallback){
    const fallbackText=[orderNote?'หมายเหตุระดับ Order\\n'+orderNote:'',fallback].filter(Boolean).join('\\n\\n');
    if(typeof field.copyClipboard==='function')field.copyClipboard(fallbackText);
    field.notify('คัดลอกผลที่แสดงแล้ว','success',2200);
    return;
  }
  const lines=[];
  if(orderNote)lines.push('หมายเหตุระดับ Order',orderNote,'');
  s.resultGroupsForDisplay().forEach(group=>{
    lines.push([s.text(group&&group.test_code),s.text(group&&group.test_name),s.microGroupStatusText(group)].filter(Boolean).join(' · '));
    s.microResultRows(group).forEach(result=>{
      lines.push(['รหัสผล '+(s.text(result&&result.test_code)||'-'),'ชื่อ/รหัสจาก MLab '+(s.text(result&&result.test_name)||'-')].join(' · '));
      lines.push(s.text(result&&result.result_value));
    });
    if(!s.microGroupHasResult(group))lines.push('รอผล');
    lines.push('');
  });
  const text=lines.join('\\n').trim();
  if(!text){field.notify('ไม่มีผลให้คัดลอก','warning',2500);return;}
  if(typeof field.copyClipboard==='function')field.copyClipboard(text);
  field.notify('คัดลอกผลที่แสดงแล้ว','success',2200);
};
s.resultRowsForDisplay=()=>s.resultGroupsForDisplay().reduce((rows,group)=>rows.concat(Array.isArray(group&&group.results)?group.results:[]),[]);
s.resultTestCount=()=>s.resultGroupsForDisplay().length;
s.resultReporterName=()=>{const names=[],seen={};s.resultRowsForDisplay().forEach(result=>{const name=s.text(result&&result.reported_by_source_name);if(name&&!seen[name]){seen[name]=true;names.push(name);}});const fallback=s.text(s.manual&&s.manual.data&&s.manual.data.reported_by_source_name);if(fallback&&!seen[fallback])names.push(fallback);return names.join(', ');};
s.resultVerifierName=()=>{const names=[],seen={};s.resultRowsForDisplay().forEach(result=>{const name=s.text(result&&result.verified_by_source_name);if(name&&!seen[name]){seen[name]=true;names.push(name);}});const fallback=s.text(s.manual&&s.manual.data&&s.manual.data.verified_by_source_name);if(fallback&&!seen[fallback])names.push(fallback);return names.join(', ');};
s.resultReportedAt=()=>{const times=s.resultRowsForDisplay().map(result=>s.text(result&&result.reported_at)||s.text(result&&result.entered_at)).filter(Boolean).sort();return times[times.length-1]||s.text(s.manual&&s.manual.data&&s.manual.data.reported_at);};
s.resultOrderNote=()=>s.text(s.manual&&s.manual.data&&s.manual.data.order_note);
s.hasRecordedResult=()=>s.resultRowsForDisplay().some(result=>(result&&result.redacted===true)||s.text(result&&result.result_value)!=='');
s.hasPersistedResult=()=>s.resultRowsForDisplay().some(result=>/^[a-f0-9]{24}$/i.test(s.text(result&&result.result_item_id)));
s.manualCriticalCount=()=>s.resultRowsForDisplay().filter(result=>result&&result.is_critical===true).length;
s.manualAbnormalCount=()=>s.resultRowsForDisplay().filter(result=>s.resultTone(result)==='is-abnormal').length;
s.standardResultStatusValue=()=>{
  const order=s.manual&&s.manual.order,status=order?s.orderStatus(order):'';
  if(status==='completed')return'final';
  if(status==='resulted')return'partial';
  const rows=s.resultRowsForDisplay().filter(s.hasResultValue);
  if(!rows.length)return'pending';
  const statuses=rows.map(result=>s.text(result&&result.result_status).toLowerCase()).filter(Boolean);
  return statuses.length&&statuses.every(value=>['f','final','completed','complete'].includes(value))?'final':'partial';
};
s.standardResultStatusText=()=>({final:'Final',partial:'Partial result',pending:'รอผล'})[s.standardResultStatusValue()];
s.manualFinalizeContexts=()=>{
  if(!s.manual||!s.manual.orderView||!s.manual.order)return[];
  const terminal=['cancelled','rejected','returned','reversed'];
  const items=(Array.isArray(s.manual.order.items)?s.manual.order.items:[]).filter(item=>!terminal.includes(s.text(item&&item.current_status).toLowerCase()));
  const rows=s.resultRowsForDisplay();
  return items.map(item=>({item:item,rows:rows.filter(row=>s.text(row&&row._item_id)===s.text(item&&item.item_id))}));
};
s.canFinalizeManualResults=()=>{
  if(s.viewMode!=='today'||!s.manual||!s.manual.orderView||s.manual.loading||s.manual.editing||s.isMicrobiologyResult())return false;
  if((Array.isArray(s.manual.groups)?s.manual.groups:[]).some(group=>group&&group.load_failed))return false;
  const contexts=s.manualFinalizeContexts();
  if(!contexts.length||contexts.every(context=>s.text(context.item&&context.item.current_status).toLowerCase()==='completed'))return false;
  return contexts.every(context=>{
    const status=s.text(context.item&&context.item.current_status).toLowerCase();
    if(!['resulted','completed'].includes(status)||!context.rows.length)return false;
    return context.rows.every(row=>/^[a-f0-9]{24}$/i.test(s.text(row&&row.result_item_id))&&s.hasResultValue(row)&&s.text(row&&row.result_source).toLowerCase()==='manual');
  });
};
s.finalizeManualResults=async()=>{
  if(!s.canFinalizeManualResults()||s.manual.finalizing)return;
  const order=s.manual.order;
  const sectionCode=s.text(order&&order.section_code)||s.text(s.manual&&s.manual.data&&s.manual.data.section_code);
  if(!/^[a-f0-9]{24}$/i.test(s.text(order&&order.order_id))||!sectionCode){field.notify('ไม่พบ Order ID หรือ Section สำหรับยืนยันออกผลครบ','error',4000);return;}
  s.manual={...s.manual,finalizing:true};
  try{
    const p=await s.processCall(PROCESS_ID,{action:'finalize_manual_results',organization_code:s.unitCode(),order_id:s.text(order.order_id),section_code:sectionCode});
    if(!p||p.success===false)throw new Error(s.text(p&&p.message)||'ยืนยันออกผลครบไม่สำเร็จ');
    const d=p.data||{},completedAt=s.text(d.completed_at),verifiedId=s.text(d.verified_by_source_id),verifiedName=s.text(d.verified_by_source_name)||s.text(d.completed_by),ids=Array.isArray(d.item_ids)?d.item_ids.map(s.text):[];
    const idLookup={};ids.forEach(id=>{if(id)idLookup[id]=true;});
    (Array.isArray(order.items)?order.items:[]).forEach(item=>{if(idLookup[s.text(item&&item.item_id)]){item.current_status='completed';item.work_status='completed';item.completed_at=completedAt||item.completed_at;}});
    s.resultRowsForDisplay().forEach(row=>{if(idLookup[s.text(row&&row._item_id)]){row.result_status='final';row.verified_at=completedAt||row.verified_at;row.verified_by_source_id=verifiedId||row.verified_by_source_id;row.verified_by_source_name=verifiedName||row.verified_by_source_name;}});
    s.manual={...s.manual,finalizing:false,data:{...s.manual.data,verified_at:completedAt||s.manual.data.verified_at,verified_by_source_id:verifiedId||s.manual.data.verified_by_source_id,verified_by_source_name:verifiedName||s.manual.data.verified_by_source_name}};
    field.notify(s.text(p.message)||'ยืนยันออกผลครบแล้ว','success',3000);
    s.refreshCounts();
  }catch(error){s.manual={...s.manual,finalizing:false};field.notify(s.text(error&&error.message)||'ยืนยันออกผลครบไม่สำเร็จ','error',5000);}
};
s.requestFinalizeManualResults=()=>{if(!s.canFinalizeManualResults())return;if(typeof field.confirm==='function')return field.confirm('ยืนยันออกผลครบทุก Item ใน Order นี้?\\nหลังยืนยัน ระบบจะบันทึกผู้ยืนยันและเวลา Final',()=>s.finalizeManualResults(),'warning','ยืนยันออกผลครบ');return s.finalizeManualResults();};
s.resultHidden=()=>!!(s.manual&&s.manual.data&&s.manual.data.is_hide_result===true);
s.resultVisibilityActor=()=>s.personName(s.manual&&s.manual.data&&s.manual.data.result_visibility_by);
s.hasResultValue=result=>s.text(result&&result.result_value)!=='';
s.resultTone=result=>{if(result&&result.is_critical===true)return'is-critical';const value=s.text(result&&result.interpretation).toUpperCase();return['H','L','A','HIGH','LOW','ABNORMAL'].includes(value)?'is-abnormal':'is-normal';};
s.resultSignalClass=result=>s.resultTone(result);
s.resultSignalText=result=>{const tone=s.resultTone(result);return tone==='is-critical'?'ค่าวิกฤติ':tone==='is-abnormal'?'ค่าผิดปกติ':'ไม่มีค่าวิกฤติ';};
s.resultMeasuredClass=result=>s.resultTone(result);
s.resultInterpretationClass=result=>s.resultTone(result);
s.editRow=result=>{const row={item_id:s.text(result&&result._item_id),result_item_id:s.text(result&&result.result_item_id),result_value:s.text(result&&result.result_value),unit:s.text(result&&result.unit),interpretation:s.text(result&&result.interpretation),reference_range:s.text(result&&result.reference_range)};return {...row,_initial:[row.result_value,row.unit,row.interpretation,row.reference_range].join('\u001f')};};
s.editRowChanged=row=>s.text(row&&row._initial)!==[s.text(row&&row.result_value),s.text(row&&row.unit),s.text(row&&row.interpretation),s.text(row&&row.reference_range)].join('\u001f');
s.correctionReasonRequired=()=>s.manual.editRows.some(row=>s.editRowChanged(row)&&/^[a-f0-9]{24}$/i.test(s.text(row&&row.result_item_id)));
s.resetManual=()=>{s.manual={visible:false,loading:false,saving:false,finalizing:false,uploading:false,editing:false,orderView:false,item:null,order:null,data:s.emptyResultData(),groups:[],editRows:[],editMap:{},attachments:[],pdfParentId:'',correctionReason:'',revisions:[],revisionHistoryOpen:false,selectedRevisionId:''};s.resultUploadReservations={};s.resultUploadPersistPending=0;s.resultUploadBatchSucceeded=0;s.resultUploadBatchFailed=0;s.resultUploadQueue=Promise.resolve();s.resultGroupOpen={};s.microGroupOpen={};s.microUnmatchedOpen=true;};
s.startManualEdit=()=>{if(!s.canEditResult())return;const editRows=[],editMap={};s.resultRowsForDisplay().forEach(result=>{if(!s.canEditResultRow(result))return;const row=s.editRow(result);editRows.push(row);editMap[result._edit_key]=row;});s.manual={...s.manual,editing:true,editRows:editRows,editMap:editMap,correctionReason:'',revisionHistoryOpen:false,selectedRevisionId:''};};
s.cancelResultEdit=()=>{s.manual={...s.manual,editing:false,editRows:[],editMap:{},correctionReason:''};};
s.toggleResultEdit=()=>{if(s.manual.editing)s.cancelResultEdit();else s.startManualEdit();};
s.resetVisibilityDialog=()=>{s.visibilityDialog={visible:false,loading:false,targetHidden:true,reason:''};};
s.openResultVisibilityDialog=()=>{
  if(s.viewMode==='lookup'){field.notify('โหมดสืบค้นเป็นแบบอ่านอย่างเดียว','warning',3000);return;}
  if(!s.hasPersistedResult()){field.notify('ยังไม่มีผลตรวจที่บันทึกไว้ให้ปกปิด','warning',3200);return;}
  s.visibilityDialog={visible:true,loading:false,targetHidden:!s.resultHidden(),reason:''};
};
s.openItemResultVisibility=async(item,order)=>{
  if(s.viewMode==='lookup'){field.notify('โหมดสืบค้นเป็นแบบอ่านอย่างเดียว','warning',3000);return;}
  if(!s.canViewResult(item)){field.notify('สถานะ Item นี้ไม่อนุญาตให้เปลี่ยนการมองเห็นผล','warning',3000);return;}
  const fallback=s.resultContext(item,order);
  s.manual={...s.manual,visible:false,loading:true,uploading:false,editing:false,orderView:false,item:item,order:order,data:fallback,groups:[],editRows:[],editMap:{},attachments:[],correctionReason:''};
  s.visibilityDialog={visible:false,loading:true,targetHidden:!s.resultHiddenItem(item),reason:''};
  try{
    const p=await s.processCall(PROCESS_ID,{action:'get_manual_result',organization_code:s.unitCode(),item_id:s.text(item&&item.item_id)});
    if(!p||p.success===false){s.manual={...s.manual,loading:false};s.resetVisibilityDialog();field.notify(s.text(p&&p.message)||'อ่านผลตรวจไม่สำเร็จ','error',4000);return;}
    const group=s.resultGroup(item,order,p.data||{});
    s.manual={...s.manual,loading:false,data:group.data,attachments:group.attachments};
    s.initResultGroupOpen();
    s.visibilityDialog={...s.visibilityDialog,loading:false};
    s.openResultVisibilityDialog();
  }catch(error){s.manual={...s.manual,loading:false};s.resetVisibilityDialog();field.notify(s.text(error&&error.message)||'อ่านผลตรวจไม่สำเร็จ','error',4000);}
};
s.submitResultVisibility=async()=>{
  if(s.viewMode==='lookup'){field.notify('โหมดสืบค้นเป็นแบบอ่านอย่างเดียว','warning',3000);return;}
  const item=s.manual&&s.manual.item,reason=s.text(s.visibilityDialog&&s.visibilityDialog.reason);
  if(!item||!s.hasPersistedResult()){field.notify('ไม่พบผลตรวจที่ต้องการเปลี่ยนการมองเห็น','error',3500);return;}
  const hidden=s.visibilityDialog.targetHidden===true;
  s.visibilityDialog={...s.visibilityDialog,loading:true};
  try{
    const p=await s.processCall(PROCESS_ID,{action:'set_result_visibility',organization_code:s.unitCode(),item_id:s.text(item.item_id),hidden:hidden,reason:reason});
    if(!p||p.success===false){s.visibilityDialog={...s.visibilityDialog,loading:false};field.notify(s.text(p&&p.message)||'บันทึกสถานะปกปิดผลไม่สำเร็จ','error',4500);return;}
    const d=p.data||{};
    item.is_hide_result=d.is_hide_result===true;
    item.result_visibility_action=s.text(d.result_visibility_action);
    item.result_visibility_reason=s.text(d.result_visibility_reason);
    item.result_visibility_by=d.result_visibility_by||null;
    item.result_visibility_at=s.text(d.result_visibility_at);
    s.manual={...s.manual,data:{...s.manual.data,...d,is_hide_result:d.is_hide_result===true}};
    s.resetVisibilityDialog();
    field.notify(s.text(p.message)||(hidden?'ปกปิดผลแล้ว':'ยกเลิกการปกปิดผลแล้ว'),'success',3000);
  }catch(error){s.visibilityDialog={...s.visibilityDialog,loading:false};field.notify(s.text(error&&error.message)||'บันทึกสถานะปกปิดผลไม่สำเร็จ','error',4500);}
};
s.attachmentResponse=fileItem=>fileItem&&fileItem.response&&typeof fileItem.response==='object'?fileItem.response:fileItem||{};
s.attachmentKey=fileItem=>s.text(s.attachmentResponse(fileItem).fileId)||s.text(fileItem&&fileItem.uid)||s.text(fileItem&&fileItem.url)||s.text(fileItem&&fileItem.name);
s.attachmentName=fileItem=>s.text(fileItem&&fileItem.name)||s.text(s.attachmentResponse(fileItem).fileName)||'ไฟล์ผลตรวจ';
s.attachmentUrl=fileItem=>s.text(fileItem&&fileItem.url)||s.text(s.attachmentResponse(fileItem).filePath);
s.attachmentSize=fileItem=>{const bytes=Number(fileItem&&fileItem.size||0);if(!bytes)return '';return bytes>=1048576?(bytes/1048576).toFixed(1)+' MB':Math.ceil(bytes/1024)+' KB';};
s.uniqueAttachments=attachments=>{
  const unique=[],seen={};
  (Array.isArray(attachments)?attachments:[]).forEach(fileItem=>{const key=s.attachmentKey(fileItem);if(!key||seen[key])return;seen[key]=true;unique.push(fileItem);});
  return unique;
};
s.normalizeAttachment=(result,fileItem)=>{const response=result&&result.data&&result.data.fileId?result.data:result||{};return {name:s.text(fileItem&&fileItem.name)||s.text(response.fileName)||'ไฟล์ผลตรวจ',percentage:100,status:'success',size:Number(fileItem&&fileItem.size||0),uid:fileItem&&fileItem.uid||Date.now(),url:s.text(response.filePath)||s.text(fileItem&&fileItem.url),response:response};};
s.resultUploadAction=()=>{const api=s.api();return s.text(api&&api.host)+'/v1/files/form-upload';};
s.resultUploadHeaders=()=>{const api=s.api(),token=s.text(api&&api.user&&api.user.token);return token?{Authorization:'Bearer '+token}:{};};
s.resultUploadData=()=>({formId:RESULT_REPORT_FORM_ID,category:'file'});
s.resultUploadFileKey=fileItem=>s.text(fileItem&&fileItem.uid)||[s.text(fileItem&&fileItem.name),Number(fileItem&&fileItem.size||0),Number(fileItem&&fileItem.lastModified||0)].join('|');
s.resultUploadReservedBytes=()=>Object.values(s.resultUploadReservations||{}).reduce((sum,size)=>sum+Number(size||0),0);
s.resultUploadBusy=()=>Object.keys(s.resultUploadReservations||{}).length>0||Number(s.resultUploadPersistPending||0)>0;
s.syncResultUploadState=()=>{const uploading=s.resultUploadBusy();if(s.manual.uploading!==uploading)s.manual={...s.manual,uploading:uploading};};
s.finishResultUploadBatch=()=>{
  s.syncResultUploadState();
  if(s.resultUploadBusy())return;
  const succeeded=Number(s.resultUploadBatchSucceeded||0),failed=Number(s.resultUploadBatchFailed||0);
  if(succeeded)field.notify('อัปโหลดและบันทึกไฟล์แนบแล้ว '+succeeded+' ไฟล์',failed?'warning':'success');
  s.resultUploadBatchSucceeded=0;s.resultUploadBatchFailed=0;
};
s.beforeResultUpload=fileItem=>{
  if(s.viewMode==='lookup'){field.notify('โหมดสืบค้นเป็นแบบอ่านอย่างเดียว','warning',3000);return false;}
  const name=s.text(fileItem&&fileItem.name),ext=(name.split('.').pop()||'').toLowerCase(),mime=s.text(fileItem&&fileItem.type).toLowerCase();
  const allowedExt=['pdf','jpg','jpeg','png'],allowedMime=['application/pdf','image/jpeg','image/png'];
  if(!allowedExt.includes(ext)||mime&&!allowedMime.includes(mime)){field.notify('รองรับเฉพาะ PDF, JPG, JPEG และ PNG','warning',4000);return false;}
  const size=Number(fileItem&&fileItem.size||0);
  if(size>10*1024*1024){field.notify('ไฟล์ต้องมีขนาดไม่เกิน 10 MB','warning',4000);return false;}
  const key=s.resultUploadFileKey(fileItem),reserved=s.resultUploadReservations||{},isReserved=Object.prototype.hasOwnProperty.call(reserved,key);
  if(!isReserved&&s.manual.attachments.length+Object.keys(reserved).length>=10){field.notify('แนบไฟล์ได้สูงสุด 10 ไฟล์ต่อผลตรวจ','warning',3500);return false;}
  const total=s.manual.attachments.reduce((sum,item)=>sum+Number(item&&item.size||0),0)+s.resultUploadReservedBytes()+(isReserved?0:size);
  if(total>50*1024*1024){field.notify('ไฟล์แนบรวมต้องไม่เกิน 50 MB','warning',4000);return false;}
  if(!isReserved)s.resultUploadReservations={...reserved,[key]:size};
  s.syncResultUploadState();
  return true;
};
s.resultUploadProgress=()=>s.syncResultUploadState();
s.persistResultAttachments=async(attachments,change)=>{
  if(s.viewMode==='lookup')throw new Error('โหมดสืบค้นเป็นแบบอ่านอย่างเดียว');
  const item=change&&change.item||s.orderAttachmentItem();
  if(!item)throw new Error('ไม่พบ LAB Item ใน Order สำหรับผูกไฟล์แนบ');
  const operation=change&&change.operation==='remove'?'remove':'replace';
  const p=await s.processCall(PROCESS_ID,{action:'save_result_attachments',attachment_scope:'order',attachment_operation:operation,removed_attachment_key:operation==='remove'?s.text(change&&change.removedKey):'',organization_code:s.unitCode(),item_id:s.text(item.item_id),result_attachments:attachments});
  if(!p||p.success===false)throw new Error(s.text(p&&p.message)||'บันทึกไฟล์แนบไม่สำเร็จ');
  const saved=Array.isArray(p.data&&p.data.result_attachments)?p.data.result_attachments:attachments;
  const visible=change&&change.preserveNewer?s.uniqueAttachments([...saved,...s.manual.attachments]):saved;
  s.manual={...s.manual,uploading:change&&change.keepUploading===true,attachments:visible,data:{...s.manual.data,result_report_id:s.text(p.data&&p.data.result_report_id)||s.manual.data.result_report_id,attachment_report_id:s.text(p.data&&p.data.attachment_report_id)||s.manual.data.attachment_report_id,result_attachments:visible}};
  if(!(change&&change.silent))field.notify(operation==='remove'?'นำไฟล์ออกจากผลตรวจแล้ว':'อัปโหลดและบันทึกไฟล์แนบแล้ว','success',2800);
  return saved;
};
s.canRemoveResultFile=()=>s.viewMode==='today'&&(s.manual.orderView===true||s.isMicrobiologyResult())&&!!s.orderAttachmentItem()&&!s.manual.uploading&&!s.manual.saving;
s.removeResultFile=async fileItem=>{
  if(!s.canRemoveResultFile())return;
  const previous=s.manual.attachments.slice(),removedKey=s.attachmentKey(fileItem),next=previous.filter(item=>s.attachmentKey(item)!==removedKey);
  if(!removedKey||next.length===previous.length){field.notify('ไม่พบไฟล์แนบที่ต้องการนำออก','warning',3200);return;}
  s.manual={...s.manual,uploading:true,attachments:next};
  try{await s.persistResultAttachments(next,{operation:'remove',removedKey:removedKey});}catch(error){s.manual={...s.manual,uploading:false,attachments:previous};field.notify(s.text(error&&error.message)||'นำไฟล์แนบออกไม่สำเร็จ','error',5000);}
};
s.requestRemoveResultFile=fileItem=>{
  if(!s.canRemoveResultFile())return;
  const run=()=>s.removeResultFile(fileItem),message='ยืนยันนำไฟล์ “'+s.attachmentName(fileItem)+'” ออกจากผลตรวจ?\\nไฟล์จะไม่แสดงใน popup ผล Lab แต่จะไม่ลบไฟล์ต้นฉบับออกจากระบบจัดเก็บ';
  if(typeof field.confirm==='function')return field.confirm(message,run,'warning','ยืนยันนำไฟล์ออก');
  return run();
};
s.resultUploadSuccess=async(result,fileItem)=>{
  const reservationKey=s.resultUploadFileKey(fileItem),reservations={...(s.resultUploadReservations||{})};delete reservations[reservationKey];s.resultUploadReservations=reservations;
  const attachment=s.normalizeAttachment(result,fileItem),attachmentKey=s.attachmentKey(attachment),item=s.orderAttachmentItem();
  s.manual={...s.manual,attachments:s.uniqueAttachments([...s.manual.attachments,attachment])};
  s.resultUploadPersistPending+=1;s.resultUploadBatchSucceeded+=1;s.syncResultUploadState();
  const task=s.resultUploadQueue.then(async()=>{
    try{await s.persistResultAttachments(s.uniqueAttachments(s.manual.attachments),{operation:'replace',silent:true,keepUploading:true,preserveNewer:true,item:item});}
    catch(error){s.resultUploadBatchSucceeded=Math.max(0,s.resultUploadBatchSucceeded-1);s.resultUploadBatchFailed+=1;s.manual={...s.manual,attachments:s.manual.attachments.filter(entry=>s.attachmentKey(entry)!==attachmentKey)};field.notify((s.attachmentName(attachment)||'ไฟล์แนบ')+': '+(s.text(error&&error.message)||'บันทึกไฟล์แนบไม่สำเร็จ'),'error',5000);}
    finally{s.resultUploadPersistPending=Math.max(0,s.resultUploadPersistPending-1);s.finishResultUploadBatch();}
  });
  s.resultUploadQueue=task.catch(()=>{});
  return s.resultUploadQueue;
};
s.resultUploadError=(error,fileItem)=>{const key=s.resultUploadFileKey(fileItem),reservations={...(s.resultUploadReservations||{})};delete reservations[key];s.resultUploadReservations=reservations;s.resultUploadBatchFailed+=1;s.syncResultUploadState();field.notify((s.text(fileItem&&fileItem.name)||'ไฟล์แนบ')+': อัปโหลดไฟล์ไม่สำเร็จ','error',4500);s.finishResultUploadBatch();};
s.pathologyAttachmentItem=()=>{const group=(s.pathology.groups||[]).find(entry=>entry&&entry.item);return group&&group.item||null;};
s.canUploadPathologyFile=()=>s.viewMode==='today'&&!s.pathology.loading&&!s.pathology.uploading&&!s.pathology.saving&&!!s.pathologyAttachmentItem()&&s.pathology.attachments.length<10;
s.pathologyUploadReservedBytes=()=>Object.values(s.pathologyUploadReservations||{}).reduce((sum,size)=>sum+Number(size||0),0);
s.pathologyUploadBusy=()=>Object.keys(s.pathologyUploadReservations||{}).length>0||Number(s.pathologyUploadPersistPending||0)>0;
s.syncPathologyUploadState=()=>{const uploading=s.pathologyUploadBusy();if(s.pathology.uploading!==uploading)s.pathology={...s.pathology,uploading:uploading};};
s.finishPathologyUploadBatch=()=>{s.syncPathologyUploadState();if(s.pathologyUploadBusy())return;const succeeded=Number(s.pathologyUploadBatchSucceeded||0),failed=Number(s.pathologyUploadBatchFailed||0);if(succeeded)field.notify('Import และบันทึกไฟล์แนบแล้ว '+succeeded+' ไฟล์',failed?'warning':'success');s.pathologyUploadBatchSucceeded=0;s.pathologyUploadBatchFailed=0;};
s.beforePathologyUpload=fileItem=>{
  if(s.viewMode==='lookup'){field.notify('โหมดสืบค้นเป็นแบบอ่านอย่างเดียว','warning',3000);return false;}
  const name=s.text(fileItem&&fileItem.name),ext=(name.split('.').pop()||'').toLowerCase(),mime=s.text(fileItem&&fileItem.type).toLowerCase(),allowedExt=['pdf','jpg','jpeg','png'],allowedMime=['application/pdf','image/jpeg','image/png'];
  if(!allowedExt.includes(ext)||mime&&!allowedMime.includes(mime)){field.notify('รองรับเฉพาะ PDF, JPG, JPEG และ PNG','warning',4000);return false;}
  const size=Number(fileItem&&fileItem.size||0);if(size>10*1024*1024){field.notify('ไฟล์ต้องมีขนาดไม่เกิน 10 MB','warning',4000);return false;}
  const key=s.resultUploadFileKey(fileItem),reserved=s.pathologyUploadReservations||{},isReserved=Object.prototype.hasOwnProperty.call(reserved,key);
  if(!isReserved&&s.pathology.attachments.length+Object.keys(reserved).length>=10){field.notify('แนบไฟล์ได้สูงสุด 10 ไฟล์ต่อผลตรวจ','warning',3500);return false;}
  const total=s.pathology.attachments.reduce((sum,item)=>sum+Number(item&&item.size||0),0)+s.pathologyUploadReservedBytes()+(isReserved?0:size);
  if(total>50*1024*1024){field.notify('ไฟล์แนบรวมต้องไม่เกิน 50 MB','warning',4000);return false;}
  if(!isReserved)s.pathologyUploadReservations={...reserved,[key]:size};s.syncPathologyUploadState();return true;
};
s.pathologyUploadProgress=()=>s.syncPathologyUploadState();
s.persistPathologyAttachments=async(attachments,change)=>{
  if(s.viewMode==='lookup')throw new Error('โหมดสืบค้นเป็นแบบอ่านอย่างเดียว');
  const item=change&&change.item||s.pathologyAttachmentItem();if(!item)throw new Error('ไม่พบ LAB Item ห้อง MY สำหรับผูกไฟล์แนบ');
  const operation=change&&change.operation==='remove'?'remove':'replace';
  const response=await s.processCall(PROCESS_ID,{action:'save_result_attachments',attachment_scope:'order',attachment_operation:operation,removed_attachment_key:operation==='remove'?s.text(change&&change.removedKey):'',organization_code:s.unitCode(),item_id:s.text(item.item_id),result_attachments:attachments});
  if(!response||response.success===false)throw new Error(s.text(response&&response.message)||'บันทึกไฟล์แนบไม่สำเร็จ');
  const saved=Array.isArray(response.data&&response.data.result_attachments)?response.data.result_attachments:attachments;
  const visible=change&&change.preserveNewer?s.uniqueAttachments([...saved,...s.pathology.attachments]):saved;
  s.pathology={...s.pathology,uploading:change&&change.keepUploading===true,attachments:visible};
  if(!(change&&change.silent))field.notify(operation==='remove'?'นำไฟล์ออกจากผลตรวจแล้ว':'Import และบันทึกไฟล์แนบแล้ว','success',2800);
  return saved;
};
s.canRemovePathologyFile=()=>s.viewMode==='today'&&!!s.pathologyAttachmentItem()&&!s.pathology.uploading&&!s.pathology.saving;
s.removePathologyFile=async fileItem=>{if(!s.canRemovePathologyFile())return;const previous=s.pathology.attachments.slice(),removedKey=s.attachmentKey(fileItem),next=previous.filter(item=>s.attachmentKey(item)!==removedKey);if(!removedKey||next.length===previous.length){field.notify('ไม่พบไฟล์แนบที่ต้องการนำออก','warning',3200);return;}s.pathology={...s.pathology,uploading:true,attachments:next};try{await s.persistPathologyAttachments(next,{operation:'remove',removedKey:removedKey});}catch(error){s.pathology={...s.pathology,uploading:false,attachments:previous};field.notify(s.text(error&&error.message)||'นำไฟล์แนบออกไม่สำเร็จ','error',5000);}};
s.requestRemovePathologyFile=fileItem=>{if(!s.canRemovePathologyFile())return;const run=()=>s.removePathologyFile(fileItem),message='ยืนยันนำไฟล์ “'+s.attachmentName(fileItem)+'” ออกจากผลตรวจ?\\nไฟล์จะไม่แสดงใน Popup ห้อง MY แต่จะไม่ลบไฟล์ต้นฉบับออกจากระบบจัดเก็บ';if(typeof field.confirm==='function')return field.confirm(message,run,'warning','ยืนยันนำไฟล์ออก');return run();};
s.pathologyUploadSuccess=async(result,fileItem)=>{const reservationKey=s.resultUploadFileKey(fileItem),reservations={...(s.pathologyUploadReservations||{})};delete reservations[reservationKey];s.pathologyUploadReservations=reservations;const attachment=s.normalizeAttachment(result,fileItem),attachmentKey=s.attachmentKey(attachment),item=s.pathologyAttachmentItem();s.pathology={...s.pathology,attachments:s.uniqueAttachments([...s.pathology.attachments,attachment])};s.pathologyUploadPersistPending+=1;s.pathologyUploadBatchSucceeded+=1;s.syncPathologyUploadState();const task=s.pathologyUploadQueue.then(async()=>{try{await s.persistPathologyAttachments(s.uniqueAttachments(s.pathology.attachments),{operation:'replace',silent:true,keepUploading:true,preserveNewer:true,item:item});}catch(error){s.pathologyUploadBatchSucceeded=Math.max(0,s.pathologyUploadBatchSucceeded-1);s.pathologyUploadBatchFailed+=1;s.pathology={...s.pathology,attachments:s.pathology.attachments.filter(entry=>s.attachmentKey(entry)!==attachmentKey)};field.notify((s.attachmentName(attachment)||'ไฟล์แนบ')+': '+(s.text(error&&error.message)||'บันทึกไฟล์แนบไม่สำเร็จ'),'error',5000);}finally{s.pathologyUploadPersistPending=Math.max(0,s.pathologyUploadPersistPending-1);s.finishPathologyUploadBatch();}});s.pathologyUploadQueue=task.catch(()=>{});return s.pathologyUploadQueue;};
s.pathologyUploadError=(error,fileItem)=>{const key=s.resultUploadFileKey(fileItem),reservations={...(s.pathologyUploadReservations||{})};delete reservations[key];s.pathologyUploadReservations=reservations;s.pathologyUploadBatchFailed+=1;s.syncPathologyUploadState();field.notify((s.text(fileItem&&fileItem.name)||'ไฟล์แนบ')+': Import ไฟล์ไม่สำเร็จ','error',4500);s.finishPathologyUploadBatch();};
s.resultGroup=(item,order,data)=>{
  const fallback=s.resultContext(item,order),d=data&&typeof data==='object'?data:{};
  const merged={...fallback,...d,
    patient_hn:s.text(d.patient_hn)||fallback.patient_hn,
    patient_name:s.text(d.patient_name)||fallback.patient_name,
    patient_age:s.text(d.patient_age)||fallback.patient_age,
    visit_vn:s.text(d.visit_vn)||fallback.visit_vn,
    ward_clinic:s.text(d.ward_clinic)||fallback.ward_clinic,
    lab_no:s.text(d.lab_no)||fallback.lab_no,
    test_code:s.text(d.test_code)||fallback.test_code,
    test_name:s.text(d.test_name)||fallback.test_name,
    specimen_name:s.text(d.specimen_name)||fallback.specimen_name,
    received_at:s.text(d.received_at)||fallback.received_at,
    reported_at:s.text(d.reported_at)||fallback.reported_at,
    order_note:s.text(d.order_note),
    results:Array.isArray(d.results)?d.results:[]
  };
  const sensitiveLocked=d.sensitive_locked===true;
  const displayRows=s.resultRowsFromData(merged);
  return {item_id:s.text(item&&item.item_id),test_code:merged.test_code,test_name:merged.test_name,panel:item&&item.panel&&typeof item.panel==='object'?item.panel:{},data:merged,results:sensitiveLocked?[]:s.resultRowsWithEditKeys(item,displayRows),revisions:sensitiveLocked?[]:(Array.isArray(d.result_revisions)?d.result_revisions:[]),unmatched_receipts:Array.isArray(d.unmatched_receipts)?d.unmatched_receipts:[],attachments:sensitiveLocked?[]:(Array.isArray(d.result_attachments)?d.result_attachments:[]),sensitive_locked:sensitiveLocked,reauth_required:d.reauth_required===true,load_failed:false};
};
s.groupOrderResultGroups=groups=>{
  const grouped=[],byKey={};
  (Array.isArray(groups)?groups:[]).forEach(group=>{
    const panel=group&&group.panel&&typeof group.panel==='object'?group.panel:{};
    const parentCode=s.text(panel.set_code)||s.text(panel.parent_code);
    const sectionCode=s.text(group&&group.data&&group.data.section_code).toUpperCase();
    const panelGroupingAllowed=sectionCode!=='MB';
    const sensitiveLocked=group&&group.sensitive_locked===true;
    const key=!sensitiveLocked&&panelGroupingAllowed&&parentCode?'panel:'+parentCode:'item:'+s.text(group&&group.item_id);
    const parentName=!sensitiveLocked&&panelGroupingAllowed&&(s.text(panel.set_name)||s.text(panel.parent_name))||s.text(group&&group.test_name)||'-';
    if(!byKey[key]){
      byKey[key]={...group,group_key:key,test_code:panelGroupingAllowed&&parentCode||s.text(group&&group.test_code),test_name:parentName,item_ids:[s.text(group&&group.item_id)].filter(Boolean),results:Array.isArray(group&&group.results)?group.results.slice():[],unmatched_receipts:Array.isArray(group&&group.unmatched_receipts)?group.unmatched_receipts.slice():[],attachments:Array.isArray(group&&group.attachments)?group.attachments.slice():[],sensitive_locked:group&&group.sensitive_locked===true};
      grouped.push(byKey[key]);
      return;
    }
    const target=byKey[key];
    target.item_ids=target.item_ids.concat([s.text(group&&group.item_id)].filter(Boolean));
    target.results=target.results.concat(Array.isArray(group&&group.results)?group.results:[]);
    target.unmatched_receipts=target.unmatched_receipts.concat(Array.isArray(group&&group.unmatched_receipts)?group.unmatched_receipts:[]);
    target.attachments=target.attachments.concat(Array.isArray(group&&group.attachments)?group.attachments:[]);
    target.sensitive_locked=target.sensitive_locked||!!(group&&group.sensitive_locked);
    target.load_failed=target.load_failed||!!(group&&group.load_failed);
  });
  return grouped;
};
s.openResult=async(item,order,startEdit)=>{
  if(!s.canViewResult(item)){field.notify('สถานะ Item นี้ไม่อนุญาตให้เปิดผลตรวจ','warning',3000);return;}
  const fallback=s.resultContext(item,order);
  s.manual={...s.manual,visible:true,loading:true,saving:false,finalizing:false,uploading:false,editing:false,orderView:false,item:item,order:order,data:fallback,groups:[],editRows:[],editMap:{},attachments:[],correctionReason:'',revisions:[],revisionHistoryOpen:false,selectedRevisionId:''};
  try{
    const p=await s.processCall(PROCESS_ID,{action:'get_manual_result',organization_code:s.unitCode(),item_id:s.text(item.item_id)});
    if(!p||p.success===false){s.manual={...s.manual,loading:false};field.notify((p&&p.message)||'อ่านผลตรวจไม่สำเร็จ','error',4000);return;}
    const d=p.data||{};
    const group=s.resultGroup(item,order,d);
    s.manual={...s.manual,loading:false,data:group.data,attachments:group.attachments,revisions:s.mergeResultRevisions([group])};
    if(startEdit)s.startManualEdit();
  }catch(error){s.manual={...s.manual,loading:false};field.notify(s.text(error&&error.message)||'อ่านผลตรวจไม่สำเร็จ','error',4000);}
};
s.loadOrderResultGroup=async(item,order)=>{
  const fallback=s.resultGroup(item,order,{});
  try{
    const request={action:'get_manual_result',organization_code:s.unitCode(),item_id:s.text(item.item_id)};
    const p=await s.processCall(PROCESS_ID,request);
    if(!p||p.success===false)return {...fallback,load_failed:true};
    return s.resultGroup(item,order,p.data||{});
  }catch(error){return {...fallback,load_failed:true};}
};
s.resultActorNames=(data,key)=>{
  const names=[],seen={};
  const add=value=>{const name=s.personName(value);if(name&&!seen[name]){seen[name]=true;names.push(name);}};
  (data&&Array.isArray(data.results)?data.results:[]).forEach(row=>add(row&&row[key]));
  add(data&&data[key]);
  return names.join(', ');
};
s.resultActorFallback=(item,key)=>{
  const summary=item&&item.result_summary&&typeof item.result_summary==='object'?item.result_summary:{};
  return s.personName(item&&item[key])||s.personName(summary&&summary[key]);
};
s.resultActorState=item=>s.resultActorMeta[s.text(item&&item.item_id)]||{};
s.resultReporterFor=item=>s.text(s.resultActorState(item).reported_by_source_name)||s.resultActorFallback(item,'reported_by_source_name');
s.resultVerifierFor=item=>s.text(s.resultActorState(item).verified_by_source_name)||s.resultActorFallback(item,'verified_by_source_name');
s.resultActorIsLoading=item=>!!s.resultActorLoading[s.text(item&&item.item_id)];
s.loadResultActorsForOrder=async order=>{
  const pending=s.resultItems(order).filter(item=>{const id=s.text(item&&item.item_id),state=s.resultActorMeta[id];return id&&!(state&&state.loaded)&&!s.resultActorLoading[id];});
  if(!pending.length)return;
  const loading={...s.resultActorLoading};pending.forEach(item=>{loading[s.text(item.item_id)]=true;});s.resultActorLoading=loading;
  await Promise.all(pending.map(async item=>{
    const id=s.text(item.item_id),request={action:'get_manual_result',organization_code:s.unitCode(),item_id:id,result_actor_only:true};
    if(s.viewMode==='lookup'){request.cross_section=true;request.lookup_mode='results';}
    let next={loaded:false,reported_by_source_name:'',verified_by_source_name:''};
    try{
      const response=await s.processCall(PROCESS_ID,request);
      if(response&&response.success!==false){const data=response.data||{};next={loaded:true,reported_by_source_name:s.resultActorNames(data,'reported_by_source_name'),verified_by_source_name:s.resultActorNames(data,'verified_by_source_name')};}
    }catch(error){}
    s.resultActorMeta={...s.resultActorMeta,[id]:next};
    const remaining={...s.resultActorLoading};delete remaining[id];s.resultActorLoading=remaining;
  }));
};
s.resetPathology=()=>{s.pathology={visible:false,loading:false,saving:false,finalizing:false,uploading:false,editing:false,order:null,groups:[],attachments:[],removedRows:[],revisions:[],revisionHistoryOpen:false,selectedRevisionId:'',correctionReason:'',reportedAt:'',reportedBy:'',verifiedBy:''};s.pathologyUploadReservations={};s.pathologyUploadPersistPending=0;s.pathologyUploadBatchSucceeded=0;s.pathologyUploadBatchFailed=0;s.pathologyUploadQueue=Promise.resolve();};
s.pathologyOrderedSpecimens=item=>{
  const ordered=item&&item.specimen&&item.specimen.ordered||{};
  const sourceRows=Array.isArray(ordered.rows)?ordered.rows:[];
  const count=Math.max(s.itemQuantity(item),sourceRows.length,1);
  const rows=[];
  for(let index=0;index<count;index++)rows.push(sourceRows[index]||((index===0&&!sourceRows.length)?ordered:{}));
  return rows;
};
s.pathologyNewRowKey=(itemId,specimenIndex)=>s.text(itemId)+'|'+String(specimenIndex)+'|draft-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
s.pathologyResultValues=value=>s.text(value).split(/\\r?\\n/).map(entry=>s.text(entry).trim()).filter(Boolean);
s.pathologyBuildGroup=(item,order,data)=>{
  const d=data&&typeof data==='object'?data:{};
  const persisted=Array.isArray(d.results)?d.results:[];
  const specimens=s.pathologyOrderedSpecimens(item).map((ordered,specimenIndex)=>{
    const specimenName=s.specimenRowName(ordered)||(specimenIndex===0?s.specimenDisplay(item):'ไม่ระบุ specimen');
    const orderedSiteName=s.specimenRowSite(ordered);
    const orderedSiteCode=s.text(ordered&&(ordered.spec_site_code||ordered.site_code));
    const rows=persisted.filter(result=>{
      const index=Number(result&&result.specimen_index);
      if(Number.isInteger(index))return index===specimenIndex;
      return specimenIndex===0;
    }).map((result,rowIndex)=>({
      result_item_id:s.text(result&&result.result_item_id),
      pathology_row_key:s.text(result&&result.pathology_row_key)||s.pathologyNewRowKey(item&&item.item_id,specimenIndex),
      specimen_index:specimenIndex,
      pathology_sub_index:Number.isInteger(Number(result&&result.pathology_sub_index))?Number(result.pathology_sub_index):rowIndex,
      actual_site_code:s.text(result&&result.actual_site_code),
      actual_site_name:s.text(result&&result.actual_site_name)||s.text(result&&result.ordered_site_name_snapshot)||orderedSiteName,
      actual_site_detail:s.text(result&&result.actual_site_detail),
      result_value:s.text(result&&result.result_value),
      result_choices:s.pathologyResultValues(result&&result.result_value),
      result_status:s.text(result&&result.result_status).toLowerCase(),
      correction_history:Array.isArray(result&&result.correction_history)?result.correction_history:[],
      seeded_from_order:(Number.isInteger(Number(result&&result.pathology_sub_index))?Number(result.pathology_sub_index):rowIndex)===0
    }));
    if(!rows.length)rows.push({result_item_id:'',pathology_row_key:s.pathologyNewRowKey(item&&item.item_id,specimenIndex),specimen_index:specimenIndex,pathology_sub_index:0,actual_site_code:orderedSiteCode,actual_site_name:orderedSiteName,actual_site_detail:'',result_value:'',result_choices:[],result_status:'draft',seeded_from_order:true});
    rows.sort((left,right)=>Number(left.pathology_sub_index||0)-Number(right.pathology_sub_index||0));
    rows.forEach((row,index)=>{row.pathology_sub_index=index;});
    return {specimen_index:specimenIndex,specimen_code:s.text(ordered&&(ordered.spec_source_code||ordered.specimen_code||ordered.source_code)),specimen_name:specimenName,ordered_site_code:orderedSiteCode,ordered_site_name:orderedSiteName,rows:rows};
  });
  return {item_id:s.text(item&&item.item_id),item:item,test_code:s.text(item&&item.item_code),test_name:s.text(item&&item.item_name),lab_no:s.text(item&&item.lab_no),result_report_id:s.text(d.result_report_id),correction_history_all:Array.isArray(d.pathology_correction_history)?d.pathology_correction_history:[],specimens:specimens};
};
s.pathologySiteOptions=(group,specimen,row)=>{
  const seen={},options=[];
  const add=(value,code)=>{value=s.text(value);if(!value||seen[value])return;seen[value]=true;options.push({value:value,label:value,code:s.text(code)});};
  (Array.isArray(s.pathologySiteMasterOptions)?s.pathologySiteMasterOptions:[]).forEach(entry=>add(entry&&entry.value,entry&&entry.code));
  add(specimen&&specimen.ordered_site_name,specimen&&specimen.ordered_site_code);
  (group&&Array.isArray(group.specimens)?group.specimens:[]).forEach(entry=>add(entry&&entry.ordered_site_name,entry&&entry.ordered_site_code));
  add(row&&row.actual_site_name,row&&row.actual_site_code);
  return options;
};
s.pathologySiteChanged=(group,specimen,row,value)=>{
  if(!row)return;
  const name=s.text(value),master=(Array.isArray(s.pathologySiteMasterOptions)?s.pathologySiteMasterOptions:[]).find(option=>s.text(option&&option.value)===name);
  const specimens=group&&Array.isArray(group.specimens)?group.specimens:[];
  const ordered=(s.text(specimen&&specimen.ordered_site_name)===name?specimen:null)||specimens.find(entry=>s.text(entry&&entry.ordered_site_name)===name);
  row.actual_site_code=master?s.text(master.code):(ordered?s.text(ordered.ordered_site_code):'');
};
s.pathologySiteMasterOption=entry=>({value:s.text(entry&&(entry.name_th||entry.name)),label:s.text(entry&&(entry.name_th||entry.name)),code:s.text(entry&&entry.code)});
s.pathologyResultSections=entry=>{
  const raw=entry&&entry.lab_sections;
  if(Array.isArray(raw))return raw;
  if(raw&&typeof raw==='object')return[raw];
  if(typeof raw==='string'&&raw.trim()){
    try{const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed:(parsed&&typeof parsed==='object'?[parsed]:[]);}catch(error){}
  }
  return[];
};
s.isPathologyResultMasterEntry=entry=>s.pathologyResultSections(entry).some(section=>s.text(section&&(section.code||section.value||section.section_code)||section).trim().toUpperCase()==='MY');
s.pathologyResultMasterOption=entry=>({value:s.text(entry&&entry.detail_rs),label:s.text(entry&&entry.detail_rs),code:s.text(entry&&entry.result_code),display_order:Number(entry&&entry.display_order)||0});
s.pathologyResultOptions=row=>{
  const seen={},options=[];
  const add=option=>{const value=s.text(option&&option.value);if(!value||seen[value])return;seen[value]=true;options.push({value:value,label:s.text(option&&option.label)||value,code:s.text(option&&option.code),display_order:Number(option&&option.display_order)||0});};
  (Array.isArray(s.pathologyResultMasterOptions)?s.pathologyResultMasterOptions:[]).forEach(add);
  (row&&Array.isArray(row.result_choices)?row.result_choices:s.pathologyResultValues(row&&row.result_value)).forEach(value=>add({value:value,label:value}));
  return options;
};
s.pathologyResultChanged=(row,values)=>{
  if(!row)return;
  const seen={},choices=[];
  (Array.isArray(values)?values:[]).forEach(value=>{value=s.text(value).trim();if(!value||seen[value])return;seen[value]=true;choices.push(value);});
  row.result_choices=choices;
  row.result_value=choices.join('\\n');
};
s.addPathologySub=(group,specimen)=>{if(s.viewMode!=='today'||!s.pathology.editing||!group||!specimen)return;const rows=Array.isArray(specimen.rows)?specimen.rows:[];rows.push({result_item_id:'',pathology_row_key:s.pathologyNewRowKey(group.item_id,specimen.specimen_index),specimen_index:specimen.specimen_index,pathology_sub_index:rows.length,actual_site_code:'',actual_site_name:'',actual_site_detail:'',result_value:'',result_choices:[],result_status:'draft',seeded_from_order:false});s.pathology={...s.pathology,groups:s.pathology.groups.slice()};};
s.canRemovePathologySub=(specimen,row,rowIndex)=>s.viewMode==='today'&&s.pathology.editing&&!s.pathology.saving&&!s.pathology.finalizing&&!!specimen&&Array.isArray(specimen.rows)&&specimen.rows.length>1&&rowIndex>0&&!(row&&row.seeded_from_order);
s.removePathologySub=(group,specimen,row,rowIndex)=>{if(!s.canRemovePathologySub(specimen,row,rowIndex))return;const removedRows=Array.isArray(s.pathology.removedRows)?s.pathology.removedRows.slice():[],resultItemId=s.text(row&&row.result_item_id);if(/^[a-f0-9]{24}$/i.test(resultItemId)&&!removedRows.some(entry=>s.text(entry&&entry.result_item_id)===resultItemId))removedRows.push({item_id:s.text(group&&group.item_id),result_item_id:resultItemId});specimen.rows.splice(rowIndex,1);specimen.rows.forEach((entry,index)=>{entry.pathology_sub_index=index;});s.pathology={...s.pathology,groups:s.pathology.groups.slice(),removedRows:removedRows};};
s.pathologyRows=()=>s.pathology.groups.reduce((rows,group)=>rows.concat(group.specimens.reduce((all,specimen)=>all.concat(specimen.rows||[]),[])),[]);
s.pathologyItems=()=>s.pathology.groups.reduce((items,group)=>items.concat((group.specimens||[]).map(specimen=>({group:group,specimen:specimen}))),[]);
s.pathologySpecimenCount=()=>s.pathology.groups.reduce((count,group)=>count+group.specimens.length,0);
s.pathologyTestSummary=()=>{const groups=s.pathology.groups||[];if(!groups.length)return'-';if(groups.length===1){const group=groups[0];return [s.text(group.test_code),s.text(group.test_name)].filter(Boolean).join(' ')+' × '+group.specimens.length;}return groups.length+' tests · '+s.pathologySpecimenCount()+' items';};
s.pathologySubCount=()=>s.pathologyRows().length;
s.pathologyDoneCount=()=>s.pathologyRows().filter(row=>s.text(row&&row.result_value)).length;
s.pathologyLabNo=()=>s.pathology.groups.map(group=>s.text(group&&group.lab_no)).find(Boolean)||'';
s.buildPathologyRevisions=groups=>{
  const byId={},revisions=[];
  (Array.isArray(groups)?groups:[]).forEach(group=>{
    const historyEntries=[];
    if(Array.isArray(group&&group.correction_history_all)&&group.correction_history_all.length)group.correction_history_all.forEach(history=>historyEntries.push({history:history,specimen:null,row:null}));
    else (group.specimens||[]).forEach(specimen=>(specimen.rows||[]).forEach(row=>(row.correction_history||[]).forEach(history=>historyEntries.push({history:history,specimen:specimen,row:row}))));
    historyEntries.forEach(entry=>{const history=entry.history||{},specimen=entry.specimen,row=entry.row;
    const eventId=s.text(history&&history.event_id),groupId=s.text(history&&history.correction_group_id)||s.text(history&&history.request_id)||eventId.replace(/:[^:]+$/,'');
    if(!groupId)return;
    if(!byId[groupId]){byId[groupId]={revision_id:groupId,corrected_at:s.text(history&&history.corrected_at),corrected_by:s.text(history&&history.corrected_by_name)||s.text(history&&history.corrected_by_username),reason:s.text(history&&history.reason),changes:[]};revisions.push(byId[groupId]);}
    const revision=byId[groupId];
    if(s.text(history&&history.corrected_at)>revision.corrected_at)revision.corrected_at=s.text(history.corrected_at);
    if(!revision.corrected_by)revision.corrected_by=s.text(history&&history.corrected_by_name)||s.text(history&&history.corrected_by_username);
    if(!revision.reason)revision.reason=s.text(history&&history.reason);
    revision.changes.push({event_id:eventId,test_code:s.text(history&&history.test_code)||s.text(group&&group.test_code),test_name:s.text(history&&history.test_name)||s.text(group&&group.test_name),specimen_name:s.text(history&&history.specimen_name)||s.text(specimen&&specimen.specimen_name),actual_site_name:s.text(history&&history.actual_site_name)||s.text(row&&row.actual_site_name),before_result_value:s.text(history&&history.before&&history.before.result_value),after_result_value:s.text(history&&history.after&&history.after.result_value),changed_fields:Array.isArray(history&&history.changed_fields)?history.changed_fields:[]});
    });
  });
  revisions.sort((left,right)=>right.corrected_at.localeCompare(left.corrected_at)||right.revision_id.localeCompare(left.revision_id));
  revisions.forEach((revision,index)=>{revision.no=revisions.length-index;});
  return revisions;
};
s.pathologyRevisions=()=>Array.isArray(s.pathology&&s.pathology.revisions)?s.pathology.revisions:[];
s.pathologyRevisionCount=()=>s.pathologyRevisions().length;
s.selectedPathologyRevision=()=>s.pathologyRevisions().find(revision=>s.text(revision&&revision.revision_id)===s.text(s.pathology&&s.pathology.selectedRevisionId))||s.pathologyRevisions()[0]||null;
s.selectPathologyRevision=revision=>{s.pathology={...s.pathology,selectedRevisionId:s.text(revision&&revision.revision_id)};};
s.togglePathologyRevisionHistory=()=>{const revisions=s.pathologyRevisions();if(!revisions.length)return;const open=!s.pathology.revisionHistoryOpen;s.pathology={...s.pathology,revisionHistoryOpen:open,selectedRevisionId:open?s.text(revisions[0]&&revisions[0].revision_id):''};};
s.pathologyRowFinal=row=>['final','corrected','completed'].includes(s.text(row&&row.result_status).toLowerCase());
s.pathologyIsFinal=()=>{const rows=s.pathologyRows();return !!rows.length&&rows.every(row=>/^[a-f0-9]{24}$/i.test(s.text(row&&row.result_item_id))&&s.pathologyRowFinal(row));};
s.pathologyHasPersistedResults=()=>s.pathologyRows().some(row=>/^[a-f0-9]{24}$/i.test(s.text(row&&row.result_item_id)));
s.pathologyCanEdit=()=>s.viewMode==='today'&&!s.pathology.loading&&!s.pathology.saving&&!s.pathology.finalizing&&!s.pathology.uploading&&!!s.pathologyRows().length;
s.startPathologyEdit=()=>{if(!s.pathologyCanEdit())return;s.pathology={...s.pathology,editing:true,revisionHistoryOpen:false,selectedRevisionId:'',correctionReason:''};};
s.cancelPathologyEdit=()=>{const order=s.pathology.order;if(!order)return s.resetPathology();s.openPathologyResults(order);};
s.togglePathologyEdit=()=>{if(s.pathology.editing)return s.cancelPathologyEdit();s.startPathologyEdit();};
s.pathologyStatusText=()=>{const rows=s.pathologyRows();if(s.pathologyIsFinal())return'ออกผลครบ';if(rows.length&&rows.every(row=>s.text(row&&row.result_value)))return'รอยืนยันออกผลครบ';if(rows.some(row=>s.text(row&&row.result_value)))return'ออกผลบางส่วน';return'รับ specimen แล้ว';};
s.pathologyReportIds=()=>Array.from(new Set(s.pathology.groups.map(group=>s.text(group&&group.result_report_id)).filter(id=>/^[a-f0-9]{24}$/i.test(id))));
s.pathologyPdfReady=()=>!!(LAB_RESULT_PDF_REPORT_ID&&s.pathologyReportIds().length===1&&s.pathologyDoneCount());
s.pathologyPdfParams=()=>({xparentx:s.pathologyReportIds()[0]||''});
s.openPathologyResults=async order=>{
  const items=s.resultItems(order).filter(s.isManualPathologyItem);
  if(!items.length){field.notify('ไม่มีรายการห้อง MY สำหรับลงผล','warning',3000);return;}
  s.loadPathologySiteMaster();
  s.loadPathologyResultMaster();
  s.pathology={visible:true,loading:true,saving:false,finalizing:false,uploading:false,editing:false,order:order,groups:[],attachments:[],removedRows:[],revisions:[],revisionHistoryOpen:false,selectedRevisionId:'',correctionReason:'',reportedAt:'',reportedBy:'',verifiedBy:''};
  const loaded=await Promise.all(items.map(async item=>{
    try{const request={action:'get_manual_result',organization_code:s.unitCode(),item_id:s.text(item.item_id)};if(s.viewMode==='lookup'){request.cross_section=true;request.lookup_mode='results';}const response=await s.processCall(PROCESS_ID,request);return response&&response.success!==false?{item:item,data:response.data||{},failed:false}:{item:item,data:{},failed:true};}
    catch(error){return {item:item,data:{},failed:true};}
  }));
  if(!s.pathology.visible||s.pathology.order!==order)return;
  const groups=loaded.map(entry=>s.pathologyBuildGroup(entry.item,order,entry.data));
  groups.forEach(group=>{group.specimens.forEach(specimen=>specimen.rows.forEach((row,index)=>{row.pathology_sub_index=index;}));});
  const meta=loaded.map(entry=>entry.data||{});
  const attachments=s.uniqueAttachments(meta.reduce((files,data)=>files.concat(Array.isArray(data&&data.result_attachments)?data.result_attachments:[]),[]));
  s.pathology={...s.pathology,loading:false,groups:groups,attachments:attachments,revisions:s.buildPathologyRevisions(groups),reportedAt:meta.map(data=>s.text(data.reported_at)).filter(Boolean).sort().pop()||'',reportedBy:Array.from(new Set(meta.map(data=>s.text(data.reported_by_source_name)).filter(Boolean))).join(', '),verifiedBy:Array.from(new Set(meta.map(data=>s.text(data.verified_by_source_name)).filter(Boolean))).join(', ')};
  const failed=loaded.filter(entry=>entry.failed).length;if(failed)field.notify('มี '+failed+' รายการที่อ่านผลไม่สำเร็จ จึงเริ่มจากข้อมูลใบสั่ง','warning',4500);
};
s.pathologyPayload=()=>s.pathology.groups.reduce((all,group)=>all.concat(group.specimens.reduce((rows,specimen)=>rows.concat((specimen.rows||[]).map((row,index)=>({result_item_id:s.text(row&&row.result_item_id),pathology_row_key:s.text(row&&row.pathology_row_key),specimen_index:specimen.specimen_index,pathology_sub_index:index,actual_site_code:s.text(row&&row.actual_site_code),actual_site_name:s.text(row&&row.actual_site_name),actual_site_detail:s.text(row&&row.actual_site_detail),result_value:s.text(row&&row.result_value)}))),[]).map(row=>({...row,item_id:group.item_id}))),[]);
s.savePathologyResults=async()=>{
  if(s.viewMode!=='today'||!s.pathology.editing||s.pathology.saving)return;
  const invalid=s.pathologyRows().find(row=>!s.text(row&&row.actual_site_name));
  if(invalid){field.notify('กรุณาระบุตำแหน่งตรวจจริงให้ครบทุกตำแหน่ง','warning',3500);return;}
  s.pathology={...s.pathology,saving:true};
  try{
    const requestId='my-pathology-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
    for(const group of s.pathology.groups){
      const pathologyResults=s.pathologyPayload().filter(row=>row.item_id===group.item_id).map(({item_id,...row})=>row);
      const removedResultItemIds=(Array.isArray(s.pathology.removedRows)?s.pathology.removedRows:[]).filter(row=>s.text(row&&row.item_id)===s.text(group.item_id)).map(row=>s.text(row&&row.result_item_id)).filter(Boolean);
      const response=await s.processCall(PROCESS_ID,{action:'save_pathology_results',organization_code:s.unitCode(),item_id:group.item_id,pathology_results:pathologyResults,removed_pathology_result_item_ids:removedResultItemIds,correction_reason:s.text(s.pathology.correctionReason),request_id:requestId});
      if(!response||response.success===false)throw new Error(s.text(response&&response.message)||'บันทึกผลห้อง MY ไม่สำเร็จ');
    }
    field.notify('บันทึกผลห้อง MY แล้ว '+s.pathologySubCount()+' ตำแหน่ง','success',3200);
    await s.openPathologyResults(s.pathology.order);
    s.refreshCounts();
  }catch(error){s.pathology={...s.pathology,saving:false};field.notify(s.text(error&&error.message)||'บันทึกผลห้อง MY ไม่สำเร็จ','error',5000);}
};
s.requestSavePathologyResults=()=>{if(typeof field.confirm==='function')return field.confirm('ยืนยันบันทึกผลห้อง MY ตาม specimen และตำแหน่งตรวจจริงที่ระบุ?',()=>s.savePathologyResults(),'warning','ยืนยันการบันทึกผล');return s.savePathologyResults();};
s.canFinalizePathologyResults=()=>{const rows=s.pathologyRows();return s.viewMode==='today'&&!s.pathology.loading&&!s.pathology.editing&&!s.pathologyIsFinal()&&!!rows.length&&rows.every(row=>/^[a-f0-9]{24}$/i.test(s.text(row&&row.result_item_id))&&!!s.text(row&&row.result_value));};
s.finalizePathologyResults=async()=>{if(!s.canFinalizePathologyResults()||s.pathology.finalizing)return;const order=s.pathology.order,orderId=s.text(order&&order.order_id);if(!/^[a-f0-9]{24}$/i.test(orderId)){field.notify('ไม่พบ Order ID สำหรับยืนยันออกผลครบ','error',3500);return;}s.pathology={...s.pathology,finalizing:true};try{const response=await s.processCall(PROCESS_ID,{action:'finalize_manual_results',organization_code:s.unitCode(),order_id:orderId,section_code:'MY'});if(!response||response.success===false)throw new Error(s.text(response&&response.message)||'ยืนยันออกผลครบไม่สำเร็จ');const data=response.data||{},ids=Array.isArray(data.item_ids)?data.item_ids.map(s.text):[],idLookup={};ids.forEach(id=>{if(id)idLookup[id]=true;});(Array.isArray(order&&order.items)?order.items:[]).forEach(item=>{if(idLookup[s.text(item&&item.item_id)]){item.current_status='completed';item.work_status='completed';item.completed_at=s.text(data.completed_at)||item.completed_at;}});s.pathology.groups.forEach(group=>{if(idLookup[s.text(group&&group.item_id)])group.specimens.forEach(specimen=>specimen.rows.forEach(row=>{row.result_status='final';}));});s.pathology={...s.pathology,finalizing:false,editing:false,verifiedBy:s.text(data.verified_by_source_name)||s.pathology.verifiedBy};field.notify(s.text(response.message)||'ยืนยันออกผลครบแล้ว','success',3200);s.refreshWorklist();}catch(error){s.pathology={...s.pathology,finalizing:false};field.notify(s.text(error&&error.message)||'ยืนยันออกผลครบไม่สำเร็จ','error',5000);}};
s.requestFinalizePathologyResults=()=>{if(!s.canFinalizePathologyResults())return;if(typeof field.confirm==='function')return field.confirm('ยืนยันออกผลครบทุก specimen และตำแหน่งตรวจจริงของห้อง MY?\\nหลังยืนยัน ระบบจะบันทึกผู้ยืนยันและเวลา Final',()=>s.finalizePathologyResults(),'warning','ยืนยันออกผลครบ');return s.finalizePathologyResults();};
s.openOrderResults=async order=>{
  if(s.isManualPathologyOrder(order))return s.openPathologyResults(order);
  const items=s.resultItems(order);
  if(!items.length){field.notify('ไม่มีรายการผลตรวจใน Order นี้','warning',3000);return;}
  const fallback=s.resultContext(items[0],order);
  s.manual={...s.manual,visible:true,loading:true,saving:false,finalizing:false,uploading:false,editing:false,orderView:true,item:null,order:order,data:fallback,groups:[],editRows:[],editMap:{},attachments:[],pdfParentId:'',correctionReason:'',revisions:[],revisionHistoryOpen:false,selectedRevisionId:''};
  const loadedGroups=await Promise.all(items.map(item=>s.loadOrderResultGroup(item,order)));
  if(!s.manual.visible||!s.manual.orderView||s.manual.order!==order)return;
  const orderNotes=[],seenOrderNotes={};
  loadedGroups.forEach(group=>{const note=s.text(group&&group.data&&group.data.order_note);if(note&&!seenOrderNotes[note]){seenOrderNotes[note]=true;orderNotes.push(note);}});
  const groups=s.groupOrderResultGroups(loadedGroups);
  const attachments=s.uniqueAttachments(loadedGroups.reduce((all,group)=>all.concat(Array.isArray(group&&group.attachments)?group.attachments:[]),[]));
  const firstData=groups[0]&&groups[0].data||fallback;
  let pdfParentId='';
  if(s.viewMode==='today'&&!groups.some(group=>group.sensitive_locked)&&!s.isMicrobiologyItem(items[0])&&loadedGroups.some(group=>(group.results||[]).some(result=>s.text(result&&result.result_value)!==''))){
    try{
      const pdfRequest={action:'prepare_result_pdf',organization_code:s.unitCode(),item_id:s.text(items[0].item_id),request_id:'lab-pdf-'+Date.now()+'-'+Math.random().toString(36).slice(2,9)};
      const prepared=await s.processCall(PROCESS_ID,pdfRequest);
      if(prepared&&prepared.success!==false){
        pdfParentId=s.text(prepared.data&&prepared.data.result_report_id);
      }
    }catch(error){}
  }
  s.manual={...s.manual,loading:false,saving:false,data:{...fallback,...firstData,order_note:orderNotes.join('\\n\\n'),results:[]},groups:groups,attachments:attachments,pdfParentId:pdfParentId,revisions:s.mergeResultRevisions(loadedGroups),revisionHistoryOpen:false,selectedRevisionId:''};
  s.initResultGroupOpen();
  const failed=loadedGroups.filter(group=>group.load_failed).length;
  if(failed)field.notify('มี '+failed+' รายการที่อ่านผลไม่สำเร็จ จึงแสดงข้อมูลจาก Order แทน','warning',4500);
};
s.saveResult=async()=>{
  if(s.viewMode==='lookup'){field.notify('โหมดสืบค้นเป็นแบบอ่านอย่างเดียว','warning',3000);return;}
  const item=s.manual.item,order=s.manual.order,orderView=s.manual.orderView===true;
  if(!orderView&&!item){field.notify('ไม่พบข้อมูลสำหรับบันทึกผล','error',3000);return;}
  s.manual={...s.manual,saving:true};
  try{
    const rows=s.manual.editRows.filter(s.editRowChanged).map(row=>({...row}));
    if(!rows.length)throw new Error('ไม่มีค่าผลที่เปลี่ยนแปลง');
    const correctionReason=s.text(s.manual&&s.manual.correctionReason).trim();
    const correctionRequestId='lab-result-correction-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
    const byItem={};
    rows.forEach(row=>{const itemId=s.text(row&&row.item_id)||s.text(item&&item.item_id);if(!itemId)return;(byItem[itemId]=byItem[itemId]||[]).push(row);});
    let lastData={};
    for(const itemId of Object.keys(byItem)){
      const itemRows=byItem[itemId],persisted=itemRows.every(row=>/^[a-f0-9]{24}$/i.test(s.text(row&&row.result_item_id)));
      const request=persisted
        ?{action:'save_result_edits',organization_code:s.unitCode(),item_id:itemId,results:itemRows,correction_reason:correctionReason,request_id:correctionRequestId}
        :{action:'save_manual_result',organization_code:s.unitCode(),item_id:itemId,manual_result:{...(itemRows[0]||{})},correction_reason:correctionReason,request_id:correctionRequestId};
      const p=await s.processCall(PROCESS_ID,request);
      if(!p||p.success===false)throw new Error(s.text(p&&p.message)||'บันทึกผลไม่สำเร็จ');
      const d=p.data||{};lastData=d;
      const targetItems=order&&Array.isArray(order.items)?order.items:[];
      const target=targetItems.find(candidate=>s.text(candidate&&candidate.item_id)===itemId)||(!orderView?item:null);
      if(target&&d.result_status==='entered'){target.current_status='resulted';target.resulted_at=s.text(d.entered_at)||target.resulted_at;}
    }
    if(orderView){await s.openOrderResults(order);}else{s.manual={...s.manual,saving:false,editing:false,editRows:[],editMap:{},correctionReason:'',data:{...s.manual.data,...lastData,results:Array.isArray(lastData.results)?lastData.results:s.manual.data.results}};}
    field.notify(orderView?'บันทึกผลระดับ Order แล้ว '+Object.keys(byItem).length+' Item':'บันทึกผลแล้ว','success',2600);
    s.refreshCounts();
  }catch(error){s.manual={...s.manual,saving:false};field.notify(s.text(error&&error.message)||'บันทึกผลไม่สำเร็จ','error',4500);}
};
s.requestSaveResult=()=>{if(s.viewMode==='lookup'){field.notify('โหมดสืบค้นเป็นแบบอ่านอย่างเดียว','warning',3000);return;}if(typeof field.confirm==='function')return field.confirm('ยืนยันบันทึกผลที่แก้ไข?\\nผลเดิมจะถูกเก็บเป็นประวัติแบบ append-only โดยไม่เปลี่ยนค่า Critical ที่ Agent/LIS ส่งมา',()=>s.saveResult(),'warning','ยืนยันการบันทึกผลตรวจ');return s.saveResult();};
s.setSpecimen=async(item,value,rowIndex)=>{
  if(s.viewMode==='lookup'){field.notify('โหมดสืบค้นเป็นแบบอ่านอย่างเดียว','warning',3000);return;}
  if(s.isSpecimenLockedItem(item)){field.notify('ห้อง IM และ MI-OUT ล็อก specimen ตามรายการสั่งตรวจ จึงเปลี่ยนไม่ได้','warning',3000);return;}
  const id=s.text(item&&item.item_id);
  const code=s.text(value).toUpperCase();
  const hasRow=s.specimenHasRows(item)&&Number.isInteger(rowIndex);
  const selectionKey=s.specimenSelectionKey(item,rowIndex);
  if(!id||!code||s.specimenSaving[selectionKey])return;
  s.specimenSaving={...s.specimenSaving,[selectionKey]:true};
  const done=()=>{const next={...s.specimenSaving};delete next[selectionKey];s.specimenSaving=next;};
  try{
    const request={action:'update_specimen',organization_code:s.unitCode(),item_id:id,specimen_code:code};
    if(hasRow)request.specimen_index=rowIndex;
    const p=await s.processCall(PROCESS_ID,request);
    if(!p||p.success===false){done();field.notify((p&&p.message)||'บันทึก specimen ไม่สำเร็จ','error',3500);return;}
    const d=p.data||{};
    s.specimenEdits={...s.specimenEdits,[selectionKey]:s.text(d.specimen_code)||code};
    if(item.specimen){
      item.specimen.complete=true;
      item.specimen.ordered=item.specimen.ordered||{};
      if(hasRow){
        const row=item.specimen.ordered.rows[rowIndex];
        if(row){row.spec_source=s.text(d.specimen_name)||code;row.spec_source_code=s.text(d.specimen_code)||code;}
      }else{
        item.specimen.ordered.source=s.text(d.specimen_name)||code;
        item.specimen.ordered.source_code=s.text(d.specimen_code)||code;
      }
    }
    done();field.notify('อัปเดต specimen แล้ว','success',2200);
  }catch(error){done();field.notify(s.text(error&&error.message)||'บันทึก specimen ไม่สำเร็จ','error',3500);}
};

s.toDate=v=>{if(!v)return null;const d=new Date(String(v).replace(' ','T'));return Number.isNaN(d.getTime())?null:d;};
s.datePart=v=>{const d=s.toDate(v);return d?d.toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit',timeZone:'Asia/Bangkok'}):'';};
s.timePart=v=>{const d=s.toDate(v);return d?d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Asia/Bangkok'}):'';};
s.compactDateTime=v=>{if(!v)return '';const d=s.toDate(v);return d?s.datePart(v)+' '+s.timePart(v):String(v);};
s.cbcDateTime=v=>{if(!v)return '';const d=s.toDate(v);return d?d.toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Bangkok'})+' '+d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Bangkok'}):String(v);};
s.statusText=v=>({sent:'รอรับ',accepted:'รับแล้ว',mixed:'รอรับ · รับแล้ว',prepared:'เตรียม',ready:'รอรับ',dispensed:'ดำเนินการ',resulted:'ออกผลบางส่วน',completed:'ออกผลครบ',cancelled:'ยกเลิก',rejected:'ปฏิเสธ',returned:'ส่งกลับ',reversed:'ย้อนรายการ'})[String(v||'').toLowerCase()]||s.text(v)||'';
s.statusClass=v=>{const x=String(v||'').toLowerCase();if(['sent','ready'].includes(x))return 'status-waiting';if(['accepted','prepared','dispensed'].includes(x))return 'status-received';if(x==='resulted')return 'status-result-partial';if(x==='completed')return 'status-result-complete';if(['cancelled','rejected','returned','reversed'].includes(x))return 'status-cancelled';return 'status-mixed';};
s.orderStatus=o=>{
  const statuses=(o&&Array.isArray(o.items)?o.items:[]).map(item=>s.text(item&&item.current_status).toLowerCase()).filter(Boolean);
  if(!statuses.length)return s.text(o&&o.current_status).toLowerCase()||'sent';
  const active=statuses.filter(status=>!['cancelled','rejected','returned','reversed'].includes(status));
  if(!active.length)return statuses.every(status=>status==='rejected')?'rejected':'cancelled';
  const waitingStatuses=['sent','ready'];
  if(active.every(status=>waitingStatuses.includes(status)))return active.every(status=>status==='ready')?'ready':'sent';
  if(active.some(status=>waitingStatuses.includes(status)))return 'mixed';
  if(active.every(status=>status==='completed'))return 'completed';
  if(active.some(status=>['resulted','completed'].includes(status)))return 'resulted';
  if(active.some(status=>['accepted','prepared','dispensed'].includes(status)))return 'accepted';
  return s.text(o&&o.current_status).toLowerCase()||'mixed';
};
s.isCancelledOrder=o=>['cancelled','rejected'].includes(s.orderStatus(o));
s.orderStatusCounts=o=>{
  const items=o&&Array.isArray(o.items)?o.items:[];
  const statusRows=items.length?items.map(item=>({status:s.text(item&&item.current_status).toLowerCase(),count:s.isManualPathologyItem(item)?s.displayItems({items:[item]}).length:1})):[{status:s.orderStatus(o),count:1}];
  const groups=[
    {key:'waiting',label:'รอรับ',statuses:s.statusMap.waiting,dot_class:'is-waiting'},
    {key:'received',label:'รับแล้ว',statuses:s.statusMap.received,dot_class:'is-received'},
    {key:'partial',label:'ออกผลบางส่วน',statuses:s.statusMap.partial,dot_class:'is-partial'},
    {key:'complete',label:'ออกผลครบ',statuses:s.statusMap.complete,dot_class:'is-complete'},
    {key:'cancelled',label:'ยกเลิก / ปฏิเสธ',statuses:['cancelled','rejected','returned','reversed'],dot_class:'is-cancelled'}
  ];
  return groups.map(group=>{
    const count=statusRows.reduce((total,row)=>total+(group.statuses.includes(row.status)?row.count:0),0);
    return {...group,count:count,title:group.label+' · '+count+' รายการ'};
  }).filter(group=>group.count>0);
};
s.orderStatusCountAria=o=>{
  const groups=s.orderStatusCounts(o);
  return groups.length?groups.map(group=>group.label+' '+group.count+' รายการ').join(' · '):'ไม่พบสถานะรายการ';
};
s.orderVisitId=o=>s.text(o&&o.emr_context&&o.emr_context.visit_id||o&&o.visit&&o.visit.visit_id);
s.reportSectionCode=o=>{
  const scoped=s.text(o&&o.section_code).toUpperCase();
  if(scoped)return scoped;
  const items=o&&Array.isArray(o.items)?o.items:[];
  for(let i=0;i<items.length;i++){
    const code=s.text(items[i]&&items[i].section&&items[i].section.code).toUpperCase();
    if(code)return code;
  }
  return '';
};
s.orderReportReady=o=>!!(s.text(o&&o.order_id)&&s.orderVisitId(o)&&s.reportSectionCode(o));
s.currentUserName=()=>{
  const state=field.globalUserState||{},user=state.user||state.currentUser||{};
  return s.personName(user)||s.personName(state)||'ผู้ใช้งานระบบ';
};
s.currentPrintTime=()=>new Intl.DateTimeFormat('th-TH',{
  day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',
  hour12:false,timeZone:'Asia/Bangkok'
}).format(new Date());
s.orderReportParams=o=>({
  order_id:s.text(o&&o.order_id),
  visit_id:s.orderVisitId(o),
  section_code:s.reportSectionCode(o),
  printed_by:s.currentUserName(),
  printed_at:s.currentPrintTime()
});
/* เปลี่ยน 2026-09-04 พร้อมกับ HN_ORDER_REPORT_ID: ป้ายใหม่ค้นด้วย HN ไม่ใช่ Visit ID
   ⇒ กันไว้ที่ patient.hn แทน orderVisitId · Order ที่ไม่มี HN ปุ่มยัง disabled เหมือนเดิม
   s.orderVisitId ยังถูกใช้ที่อื่น (EMR History, PDF ใบสั่งตรวจ) จึงไม่ถูกแตะ */
s.hnOrderReportReady=o=>!!(HN_ORDER_REPORT_ID&&s.text(o&&o.patient&&o.patient.hn));
s.hnOrderReportParams=o=>({hn:s.text(o&&o.patient&&o.patient.hn)});
/* ช่อง HN ระดับ Order พิมพ์ตรงผ่าน agent — ไม่เปิด PDF/preview (ผู้ใช้ยืนยัน 2026-09-21) */
const HN_LABEL_PRINTER='HN/VN Sticker';
s.hnPrinting={};
s.setHnPrinting=(id,v)=>{s.hnPrinting={...s.hnPrinting,[id]:!!v};};
s.printAgent=()=>{
  const form=field.getFormRef&&field.getFormRef();
  const ref=form&&form.getFieldRef?form.getFieldRef('local_agent'):null;
  const agent=ref&&ref.getFieldEditor?ref.getFieldEditor():null;
  return agent&&typeof agent.printReport==='function'?agent:null;
};
s.hnPrintHint=o=>s.hnOrderReportReady(o)
  ?'พิมพ์ป้ายติดแฟ้มที่เครื่อง '+HN_LABEL_PRINTER+' โดยไม่เปิด PDF'
  :'Order นี้ไม่มี HN สำหรับพิมพ์ป้ายติดแฟ้ม';
s.printHnLabel=o=>{
  const hn=s.text(o&&o.patient&&o.patient.hn),id=s.orderRowKey(o);
  if(!hn){field.notify('Order นี้ไม่มี HN','warning',2500);return;}
  const agent=s.printAgent();
  if(!agent){
    field.notify('ยังไม่ได้เชื่อมต่อ print agent บนเครื่องนี้ — เปิดปุ่ม Agents ท้ายหน้าเพื่อตั้งค่า','error',4000);
    return;
  }
  s.setHnPrinting(id,true);
  const finish=()=>s.setHnPrinting(id,false);
  let done=null;
  try{
    done=agent.printReport(HN_ORDER_REPORT_ID,{
      printer:HN_LABEL_PRINTER,
      params:{hn:hn},
      jobKey:'lab-hn-'+hn+'-'+Date.now()
    });
  }catch(e){
    finish();
    field.notify('พิมพ์ไม่สำเร็จ: '+((e&&e.message)||e),'error',4000);
    return;
  }
  const ok=()=>{finish();field.notify('ส่งพิมพ์ป้ายติดแฟ้ม HN '+hn+' แล้ว','success',2500);};
  if(done&&typeof done.then==='function'){
    done.then(ok).catch(err=>{
      finish();
      field.notify('พิมพ์ไม่สำเร็จ: '+((err&&err.message)||err),'error',4000);
    });
  }else{ok();}
};

s.isOrderNumberSearch=v=>/^R?\\d{10}$/i.test(s.text(v).trim());
s.setSearch=v=>{s.filters={...s.filters,hn:v||''};};
s.setDates=v=>{s.filters={...s.filters,dates:Array.isArray(v)?v:[]};};
s.scanPatientHn=hn=>{
  const raw=s.text(hn).trim(),code=raw.replace(/\\D/g,'');
  if(s.viewMode==='today'&&(s.isOrderNumberSearch(raw)||s.isOrderNumberSearch(code))){
    const orderNumber=s.isOrderNumberSearch(raw)?raw.toUpperCase():code;
    s.scanMode=false;s.scannedHn='';s.scanNoticePending=false;
    s.todayFilters={hn:orderNumber,dates:[]};
    s.filters={...s.filters,hn:orderNumber,dates:[]};
    s.expanded={};s.detailTabs={};s.orders=[];s.page={...s.page,current:1,total:0};
    s.loadOrders();s.refreshCounts();return;
  }
  if(code.length<6){field.notify('HN จากการสแกนไม่ถูกต้อง','warning',3000);return;}
  s.scanMode=true;
  s.scannedHn=code;
  s.scanNoticePending=true;
  // Paste/scan is routed through scan-code-ui. Keep the accepted HN visible in
  // the controlled search input instead of clearing filters.hn after detection.
  s.filters={...s.filters,hn:code,dates:s.viewMode==='lookup'?[]:s.filters.dates};
  if(s.viewMode==='lookup')s.lookupSearched=true;
  s.expanded={};
  s.detailTabs={};
  s.orders=[];
  s.page={...s.page,current:1,total:0};
  s.loadOrders();
  s.refreshCounts();
};
s.clearScan=()=>{
  s.scanMode=false;
  s.scannedHn='';
  s.scanNoticePending=false;
  s.filters={...s.filters,hn:''};
  s.expanded={};
  s.detailTabs={};
  s.page={...s.page,current:1,total:0};
  if(s.viewMode==='lookup'){
    s.lookupSearched=false;s.lookupCounts={results:0,orders:0};s.lookupFilters={hn:'',dates:[]};s.filters={...s.lookupFilters};s.orders=[];s.errorMessage='';
  }else{s.loadOrders();s.refreshCounts();}
};
s.orderRowKey=o=>{if(o&&typeof o==='object')return s.text(o.row_key)||[s.text(o.order_id),s.reportSectionCode(o)].filter(Boolean).join('|');return s.text(o);};
s.isExpanded=o=>!!s.expanded[s.orderRowKey(o)];
s.toggleOrder=o=>{const id=s.orderRowKey(o);if(!id)return;const opening=!s.expanded[id];s.expanded={...s.expanded,[id]:opening};s.selected={};if(opening&&s.detailTab(o)==='results')s.loadResultActorsForOrder(o);};
/* Design parity 2026-09-11: กดพื้นที่ว่างทั้งแถว Order เพื่อเปิด/ย่อได้
   control ภายในแถวและการลากเลือกข้อความยังเป็นเจ้าของ interaction ของตัวเอง */
s.toggleOrderFromRow=(order,event)=>{
  const id=s.orderRowKey(order);
  if(!id)return;
  const el=event&&event.target;
  if(el&&typeof el.closest==='function'&&el.closest('button,a,input,textarea,select,label,.el-button,.el-input,.el-select,.el-checkbox,.el-dropdown,[role="button"]'))return;
  const selection=(typeof window!=='undefined'&&window.getSelection)?window.getSelection():null;
  if(selection&&s.text(selection.toString()))return;
  s.toggleOrder(order);
};
s.isSelected=id=>!!s.selected[id];
s.orderHasItem=(order,id)=>!!(order&&Array.isArray(order.items)&&order.items.some(item=>s.text(item&&item.item_id)===s.text(id)));
s.toggleItem=(order,id)=>{if(s.viewMode==='lookup'||!s.orderHasItem(order,id))return;const next={...s.selected};if(next[id])delete next[id];else next[id]=true;s.selected=next;};
s.isPendingReceiveItem=item=>['sent','ready'].includes(s.text(item&&item.current_status).toLowerCase());
s.isFinanceReadyItem=item=>s.text(item&&item.current_status).toLowerCase()==='ready';
s.selectRow=(order,item,event)=>{
  if(s.viewMode==='lookup')return;
  if(!s.isPendingReceiveItem(item))return;
  const el=event&&event.target;
  if(el&&typeof el.closest==='function'&&el.closest('.el-checkbox,button,a,input,textarea,select,.el-select,.el-input'))return;
  const selection=(typeof window!=='undefined'&&window.getSelection)?window.getSelection():null;
  if(selection&&s.text(selection.toString()))return;
  s.toggleItem(order,item.item_id);
};
s.selectableItems=o=>s.viewMode==='lookup'?[]:(o&&Array.isArray(o.items)?o.items:[]).filter(s.isPendingReceiveItem);
s.allSelectableChecked=o=>{const items=s.selectableItems(o);return !!items.length&&items.every(item=>s.isSelected(item.item_id));};
s.someSelectableChecked=o=>{const items=s.selectableItems(o);const n=items.filter(item=>s.isSelected(item.item_id)).length;return n>0&&n<items.length;};
s.toggleAll=o=>{const next={...s.selected};const items=s.selectableItems(o);const off=items.length&&items.every(item=>next[item.item_id]);items.forEach(item=>{if(off)delete next[item.item_id];else next[item.item_id]=true;});s.selected=next;};
s.selectedItems=order=>(order&&Array.isArray(order.items)?order.items:[]).filter(item=>s.isSelected(s.text(item&&item.item_id)));
s.selectedCount=order=>s.selectedItems(order).length;
s.receiveDisplayCount=items=>(Array.isArray(items)?items:[]).reduce((total,item)=>total+(s.isManualPathologyItem(item)?s.itemQuantity(item):1),0);
s.canReceiveOrder=order=>{if(s.viewMode==='lookup')return false;const items=s.selectedItems(order);return items.length>0&&items.every(s.isFinanceReadyItem);};
s.receiveDisabledReason=order=>{
  if(s.viewMode==='lookup')return 'โหมดสืบค้นเป็นแบบอ่านอย่างเดียว';
  const items=s.selectedItems(order);
  if(items.some(item=>!s.isFinanceReadyItem(item)))return 'ยังไม่ผ่านการเงิน';
  if(!items.length){
    const pending=s.selectableItems(order);
    return pending.length&&pending.every(item=>!s.isFinanceReadyItem(item))?'ยังไม่ผ่านการเงิน':'กรุณาเลือกรายการสั่งตรวจ';
  }
  return '';
};
s.canCancelOrder=order=>{
  if(s.viewMode==='lookup')return false;
  const terminal=['cancelled','rejected','returned','reversed'];
  const items=order&&Array.isArray(order.items)?order.items:[];
  const active=items.filter(item=>!terminal.includes(s.text(item&&item.current_status).toLowerCase()));
  return active.length>0&&active.every(item=>['sent','ready','accepted'].includes(s.text(item&&item.current_status).toLowerCase()));
};
s.findItem=id=>{for(let i=0;i<s.orders.length;i++){const items=Array.isArray(s.orders[i]&&s.orders[i].items)?s.orders[i].items:[];for(let j=0;j<items.length;j++){if(s.text(items[j]&&items[j].item_id)===s.text(id))return items[j];}}return null;};
s.recordId=v=>{if(v==null)return '';if(typeof v==='object')return s.recordId(v.$oid||v._id||v.id||v.value||'');return String(v).trim();};
s.savedRow=v=>{const c=[v&&v.data&&v.data.data,v&&v.reply&&v.reply.data,v&&v.data,v];for(let i=0;i<c.length;i++){if(c[i]&&typeof c[i]==='object'&&!Array.isArray(c[i]))return c[i];}return {};};
s.applyReceiveResult=(item,data)=>{
  const d=data||{};
  item.current_status=s.text(d.current_status)||'accepted';
  if(s.text(d.lab_no))item.lab_no=s.text(d.lab_no);
  if(s.text(d.received_at))item.received_at=s.text(d.received_at);
  if(s.text(d.received_by))item.received_by=s.text(d.received_by);
  item.hl7_status=s.text(d.hl7_status)||item.hl7_status||'new';
  item.agent_transport_state=s.text(d.agent_transport_state)||item.agent_transport_state||'pending';
  const next={...s.selected};delete next[s.text(item.item_id)];s.selected=next;
};
s.receiveGroupKey=item=>item&&item.retest_pending_lab_no===true?'__RETEST__'+s.text(item.item_id):(s.specimenValue(item).trim().toUpperCase()||'__UNSPECIFIED__');
s.receiveGroups=items=>{
  const groups=[];
  const byKey={};
  (Array.isArray(items)?items:[]).forEach(item=>{
    const key=s.receiveGroupKey(item);
    if(!byKey[key]){byKey[key]=[];groups.push(byKey[key]);}
    byKey[key].push(item);
  });
  return groups;
};
s.dispatchAgentInBackground=(items,receiveData)=>{
  const rows=Array.isArray(items)?items.filter(Boolean):[items].filter(Boolean);
  const itemIds=rows.map(item=>s.text(item&&item.item_id)).filter(Boolean);
  const outboundId=s.text(receiveData&&receiveData.outbound_order_id);
  const dispatchKey=s.text(receiveData&&receiveData.receipt_batch_id)||outboundId||itemIds[0];
  if(!itemIds.length||!outboundId||receiveData.agent_dispatch_queued!==true||s.agentDispatching[dispatchKey])return;
  s.agentDispatching={...s.agentDispatching,[dispatchKey]:true};
  // 2026-09-08: ส่งเป็น request แยกหลัง Receive คืน LAB NO. แล้ว
  // Outbound ที่ persist ไว้ทำหน้าที่เป็น durable queue; Receive รอบ sync เดิมเป็น
  // dispatcher/idempotency owner จึงไม่ต้องเปิดเผย payload หรือ Agent key ให้ browser.
  const dispatchParams={item_id:itemIds[0],dispatch_mode:'sync'};
  if(itemIds.length>1)dispatchParams.item_ids=itemIds;
  s.processCall(RECEIVE_PROCESS_ID,dispatchParams).then(p=>{
    const d=p&&p.data||{};
    if(p&&p.success!==false&&d.agent_send_success===true){
      rows.forEach(item=>{
        const live=s.findItem(s.text(item&&item.item_id))||item;
        live.hl7_status=s.text(d.hl7_status)||'queued';
        live.agent_transport_state=s.text(d.agent_transport_state)||'queued';
      });
      return;
    }
    rows.forEach(item=>{
      const live=s.findItem(s.text(item&&item.item_id))||item;
      live.hl7_status=s.text(d.hl7_status)||'new';
      live.agent_transport_state=s.text(d.agent_transport_state)||'failed';
    });
    field.notify('รับ specimen แล้ว แต่ส่ง Agent ไม่สำเร็จ: '+(s.text(d.agent_message)||s.text(p&&p.message)||'รอส่งใหม่จาก Outbound'),'warning',6000);
  }).catch(error=>{
    rows.forEach(item=>{
      const live=s.findItem(s.text(item&&item.item_id))||item;
      live.hl7_status='new';
      live.agent_transport_state='failed';
    });
    field.notify('รับ specimen แล้ว แต่เรียกงานส่ง Agent เบื้องหลังไม่สำเร็จ: '+(s.text(error&&error.message)||'รอส่งใหม่จาก Outbound'),'warning',6000);
  }).then(()=>{const next={...s.agentDispatching};delete next[dispatchKey];s.agentDispatching=next;});
};
s.performReceive=async(order,items)=>{
  s.receiveLoading=true;
  const successItems=[];
  const agentSentGroups=[];
  const agentQueuedGroups=[];
  const manualGroups=[];
  const agentPendingItems=[];
  const failedItems=[];
  const groups=s.receiveGroups(items);
  for(let index=0;index<groups.length;index++){
    const group=groups[index],itemIds=group.map(item=>s.text(item&&item.item_id)).filter(Boolean);
    try{
      const receiveParams={item_id:itemIds[0],dispatch_mode:'deferred'};
      if(itemIds.length>1)receiveParams.item_ids=itemIds;
      const p=await s.processCall(RECEIVE_PROCESS_ID,receiveParams);
      if(!p||p.success===false){group.forEach(item=>failedItems.push({item,message:(p&&p.message)||'รับ specimen ไม่สำเร็จ'}));continue;}
      const receiveData=p.data||{};
      const returnedItems=Array.isArray(receiveData.items)?receiveData.items:[];
      group.forEach(item=>{
        const itemData=returnedItems.find(row=>s.text(row&&row.item_id)===s.text(item&&item.item_id))||receiveData;
        s.applyReceiveResult(item,itemData);
        successItems.push(item);
      });
      if(group.length&&group.every(s.isManualPathologyItem)){
        manualGroups.push(group);
        group.forEach(item=>{item.hl7_status='manual';item.agent_transport_state='manual';});
      }
      else if(receiveData.agent_dispatch_queued===true){agentQueuedGroups.push(group);s.dispatchAgentInBackground(group,receiveData);}
      else if(receiveData.agent_send_success===true)agentSentGroups.push(group);
      else group.forEach(item=>agentPendingItems.push({item,message:s.text(receiveData.agent_message)||s.text(p.message)||'ส่ง Agent ไม่สำเร็จ'}));
    }catch(error){group.forEach(item=>failedItems.push({item,message:s.text(error&&error.message)||'เรียก API รับ specimen ไม่สำเร็จ'}));}
  }
  s.receiveLoading=false;
  const successCount=s.receiveDisplayCount(successItems);
  const manualCount=manualGroups.reduce((total,group)=>total+s.receiveDisplayCount(group),0);
  if(failedItems.length||agentPendingItems.length){
    const receiveFailedNames=failedItems.map(row=>s.text(row.item&&row.item.item_code)||s.text(row.item&&row.item.item_name)).filter(Boolean);
    const agentPendingNames=agentPendingItems.map(row=>s.text(row.item&&row.item.item_code)||s.text(row.item&&row.item.item_name)).filter(Boolean);
    const agentDetail=agentPendingItems.length?s.text(agentPendingItems[0].message):'';
    field.notify('รับ specimen สำเร็จ '+successCount+' รายการ'+(manualCount?' · ห้อง MY ลงผล Manual ไม่ส่ง Agent '+manualCount+' รายการ':'')+(agentQueuedGroups.length?' · กำลังส่ง Agent เบื้องหลัง '+agentQueuedGroups.length+' ชุด ('+agentQueuedGroups.reduce((total,group)=>total+group.length,0)+' รายการ)':'')+(agentSentGroups.length?' · ส่ง Agent แล้ว '+agentSentGroups.length+' ชุด ('+agentSentGroups.reduce((total,group)=>total+group.length,0)+' รายการ)':'')+(agentPendingItems.length?' · ยังไม่พร้อมส่ง/รอตรวจสอบ '+agentPendingItems.length+' รายการ'+(agentPendingNames.length?' ('+agentPendingNames.join(', ')+')':''):'')+(failedItems.length?' · รับไม่สำเร็จ '+failedItems.length+' รายการ'+(receiveFailedNames.length?' ('+receiveFailedNames.join(', ')+')':''):'')+(agentDetail?' · '+agentDetail:''),'warning',7500);
  }else field.notify('รับ specimen สำเร็จ '+successCount+' รายการ'+(manualCount?' · ห้อง MY ลงผล Manual ไม่ส่ง Agent '+manualCount+' รายการ':'')+(agentQueuedGroups.length?' · กำลังส่ง Agent เบื้องหลัง '+agentQueuedGroups.length+' ชุด ('+agentQueuedGroups.reduce((total,group)=>total+group.length,0)+' รายการ)':'')+(agentSentGroups.length?' · ส่ง Agent แล้ว '+agentSentGroups.length+' ชุด ('+agentSentGroups.reduce((total,group)=>total+group.length,0)+' รายการ)':''),'success',4500);
  if(successItems.length){s.loadOrders();s.refreshCounts();}
};
// Deployed initCraft v1.6 confirm is callback-based:
// confirm(message, callback, type, title). Passing the title as argument 2
// makes the runtime call a string and display \"e is not a function\".
s.receiveSelected=order=>{
  if(s.viewMode==='lookup'){field.notify('โหมดสืบค้นเป็นแบบอ่านอย่างเดียว','warning',3000);return;}
  const items=s.selectedItems(order);
  if(!items.length){field.notify('กรุณาเลือก LAB Item ใน Order นี้อย่างน้อย 1 รายการ','warning',3000);return;}
  if(items.some(item=>!s.isFinanceReadyItem(item))){field.notify('ยังไม่ผ่านการเงิน','warning',3000);return;}
  if(typeof field.confirm==='function'){
    const labels=items.map(item=>s.text(item.item_code)||s.text(item.item_name)).filter(Boolean);
    const groupCount=s.receiveGroups(items).length;
    const receiveCount=s.receiveDisplayCount(items);
    const manualOnly=items.every(s.isManualPathologyItem);
    return field.confirm(
      manualOnly
        ? 'รายการห้อง MY นี้ลงผลแบบ Manual และจะไม่ส่ง Agent\\nระบบจะรับ specimen ทั้ง '+receiveCount+' แถวภายใต้ CPOE Item เดียวกัน\\n\\nยืนยันรับ '+receiveCount+' รายการ'+(labels.length?'\\n'+labels.join(' · '):'')+'?'
        : 'ระบบจะสร้าง LAB NO. '+groupCount+' เลขตาม specimen ที่เลือก และรวมรายการ specimen เดียวกันส่ง Agent เป็นชุดเดียว\\nหน้าจอไม่ต้องรอ Agent ตอบ และหากติดต่อไม่ได้ Outbound จะยังอยู่ให้ตรวจสอบและส่งใหม่\\n\\nยืนยันรับ '+receiveCount+' รายการ'+(labels.length?'\\n'+labels.join(' · '):'')+'?',
      ()=>s.performReceive(order,items),
      'warning',
      'รับ specimen'
    );
  }
  return s.performReceive(order,items);
};

s.rejectSelected=async order=>{
  if(s.viewMode==='lookup'){field.notify('โหมดสืบค้นเป็นแบบอ่านอย่างเดียว','warning',3000);return;}
  const items=s.selectedItems(order);
  if(items.length!==1){field.notify('กรุณาเลือก LAB Item ใน Order นี้ที่ต้องการปฏิเสธ 1 รายการ','warning',3000);return;}
  const item=items[0];
  if(!s.isPendingReceiveItem(item)){field.notify('ปฏิเสธได้เฉพาะรายการที่อยู่ในสถานะรอรับ specimen','warning',3500);return;}
  if(!order||!(Array.isArray(order.items)&&order.items.some(row=>s.text(row&&row.item_id)===s.text(item.item_id)))){field.notify('Item ที่เลือกไม่ตรงกับ Order นี้','error',3500);return;}
  const form=field.getFormRef&&field.getFormRef();
  if(!form||typeof form.openForm!=='function'){field.notify('ไม่พบตัวเปิดฟอร์มเหตุผลการปฏิเสธ','error',3500);return;}
  const itemId=s.text(item.item_id),orderId=s.text(order.order_id),orderNumber=s.text(order.order_number),sectionCode=(s.text(item.section&&item.section.code)||s.reportSectionCode(order)).toUpperCase();
  const reasonOptions=await s.loadReasonOptions('SPECIMEN_REJECT',sectionCode);
  if(!reasonOptions.length){field.notify('ห้อง LAB นี้ยังไม่มีเหตุผลปฏิเสธสิ่งส่งตรวจที่เปิดใช้งาน','warning',4500);return;}
  const patientHn=s.text(order.patient&&order.patient.hn),patientName=s.patientName(order);
  const itemSnapshot=[{source_item_id:itemId,item_code:s.text(item.item_code),item_name:s.text(item.item_name),section_code:sectionCode,specimen:item.specimen||{}}];
  const initData={
    source_order_id:itemId,
    order_group_id:orderNumber||orderId,
    patient_hn:patientHn,
    patient_name:patientName,
    patient_display:[patientHn,patientName].filter(Boolean).join(' — '),
    ward_clinic:s.sourceRoom(order),
    lab_section:sectionCode,
    selected_items_json:JSON.stringify(itemSnapshot),
    biochemistry_specimen_json:JSON.stringify(item.specimen||{}),
    treatment_right:s.coverage(order),
    payment_status:s.isPaid(order)?'ชำระเงินแล้ว':'',
    revision_no:'1',
    rejection_status:'recorded'
  };
  form.openForm(REJECTION_FORM_ID,null,null,initData,{
    params:Object.assign({},form.formParams||{},{from:'lab-cpoe-worklist',item_id:itemId,order_id:orderId,order_number:orderNumber,section_code:sectionCode,reason_options:reasonOptions}),
    popupType:'dialog',backdrop:false,
    beforeSaveCallback:()=>({source_order_id:itemId,order_group_id:orderNumber||orderId,lab_section:sectionCode,rejection_status:'recorded'}),
    afterSaveCallback:async saved=>{
      const savedRow=s.savedRow(saved),rejectionRecordId=s.recordId(savedRow._id||savedRow.id);
      if(!rejectionRecordId){field.notify('บันทึกเหตุผลแล้ว แต่ไม่พบ record id สำหรับ Apply สถานะ','error',5000);return;}
      if(s.rejectLoading)return;
      s.rejectLoading=true;
      try{
        const p=await s.processCall(REJECT_PROCESS_ID,{action:'reject_item',item_id:itemId,rejection_record_id:rejectionRecordId,order_id:orderId,order_number:orderNumber,section_code:sectionCode});
        s.rejectLoading=false;
        if(!p||p.success===false){field.notify((p&&p.message)||'ปฏิเสธ LAB Item ไม่สำเร็จ','error',5000);return;}
        const d=p.data||{};
        item.current_status='rejected';item.work_status='rejected';
        item.rejected_at=s.text(d.rejected_at);item.rejected_by=d.rejected_by||'';
        item.reject_reason_code=s.text(d.reject_reason_code);item.reject_reason_detail=s.text(d.reject_reason_detail);
        item.reject_reason=item.reject_reason_detail||item.reject_reason_code||'ปฏิเสธ';
        const next={...s.selected};delete next[itemId];s.selected=next;
        field.notify(p.message||'ปฏิเสธ LAB Item แล้ว',d.audit_sync_pending?'warning':'success',d.audit_sync_pending?5000:3000);
        if(typeof form.subFormClose==='function')form.subFormClose();
        s.loadOrders();s.refreshCounts();
      }catch(error){s.rejectLoading=false;field.notify(s.text(error&&error.message)||'เรียก Reject API ไม่สำเร็จ','error',5000);}
    }
  });
};

s.resetCancelDialog=()=>{if(s.cancelDialog.loading)return;s.cancelDialog=s.emptyCancelDialog();};
s.resetItemRetestDialog=()=>{if(s.itemRetestDialog.loading)return;s.itemRetestDialog={visible:false,loading:false,order:null,item:null,reasonCode:'',reasonDetail:''};};
s.itemRetestReason=()=>{
  const code=s.text(s.itemRetestDialog.reasonCode),label=ITEM_RETEST_REASON_LABELS[code]||code,detail=s.text(s.itemRetestDialog.reasonDetail);
  if(!code)return '';
  if(code==='other')return detail;
  return detail?label+' · '+detail:label;
};
s.itemRetestReasonValid=()=>{
  const code=s.text(s.itemRetestDialog.reasonCode),detail=s.text(s.itemRetestDialog.reasonDetail),reason=s.itemRetestReason();
  return !!code&&(code!=='other'||detail.length>=3)&&reason.length>=3;
};
s.openItemRetest=(order,item)=>{
  if(!s.canRetestItem(item)){field.notify('เปิดตรวจใหม่ได้เฉพาะรายการที่ถูกปฏิเสธ','warning',3500);return;}
  s.selected={};
  s.itemRetestDialog={visible:true,loading:false,order:order,item:item,reasonCode:'',reasonDetail:''};
};
s.submitItemRetest=async()=>{
  const dialog=s.itemRetestDialog,order=dialog.order,item=dialog.item,reason=s.itemRetestReason();
  if(!order||!item){field.notify('ไม่พบรายการที่ต้องการเปิดตรวจใหม่','error',3500);return;}
  if(!s.itemRetestReasonValid()){field.notify('กรุณาระบุเหตุผลเปิดตรวจใหม่','warning',3500);return;}
  const sectionCode=s.text(item&&item.section&&item.section.code)||s.reportSectionCode(order);
  if(!sectionCode){field.notify('ไม่พบ Section ของรายการ จึงเปิดตรวจใหม่ไม่ได้','warning',4200);return;}
  s.itemRetestDialog={...dialog,loading:true};
  try{
    const p=await s.processCall(PROCESS_ID,{action:'retest_item',organization_code:s.unitCode(),section_codes:[sectionCode],item_id:s.text(item.item_id),order_id:s.text(order.order_id),order_number:s.text(order.order_number),retest_reason:reason});
    if(!p||p.success===false){s.itemRetestDialog={...s.itemRetestDialog,loading:false};field.notify(s.text(p&&p.message)||'เปิดตรวจใหม่ไม่สำเร็จ','error',6500);return;}
    s.itemRetestDialog={visible:false,loading:false,order:null,item:null,reasonCode:'',reasonDetail:''};
    s.statusKey='waiting';s.page={...s.page,current:1};s.selected={};
    field.notify(s.text(p.message)||'เปิดตรวจใหม่เฉพาะรายการแล้ว','success',4200);
    s.loadOrders();s.refreshCounts();
  }catch(error){s.itemRetestDialog={...s.itemRetestDialog,loading:false};field.notify(s.text(error&&error.message)||'เรียก API เปิดตรวจใหม่ไม่สำเร็จ','error',6500);}
};
s.cancelFinanceClass=()=>{
  if(s.cancelDialog.financeLoading)return 'is-checking';
  if(!s.cancelDialog.financeChecked)return 'is-unknown';
  return s.cancelDialog.canCancel?'is-ready':'is-blocked';
};
s.cancelFinanceTitle=()=>{
  if(s.cancelDialog.financeLoading)return 'กำลังตรวจสอบสถานะการเงิน';
  const status=s.text(s.cancelDialog.financeStatus);
  if(status==='not_billed')return 'ยังไม่ส่งการเงิน';
  if(status==='unpaid')return 'ยังไม่ชำระเงิน';
  if(status==='receipt_withdrawn')return 'ถอนใบเสร็จแล้ว';
  if(status==='paid_receipt_active')return 'ชำระเงินแล้ว — ยังยกเลิกไม่ได้';
  if(status==='review_required')return 'ต้องให้การเงินตรวจสอบ';
  return 'สถานะการเงิน';
};
s.applyCancelFinance=payload=>{
  const d=payload&&payload.data||{},ok=payload&&payload.success!==false&&d.can_cancel===true;
  s.cancelDialog={...s.cancelDialog,financeLoading:false,financeChecked:true,financeStatus:s.text(d.finance_status)||'review_required',financeMessage:s.text(d.finance_message||payload&&payload.message)||'ตรวจสอบสถานะการเงินไม่สำเร็จ',canCancel:ok,receiptNumbers:Array.isArray(d.receipt_numbers)?d.receipt_numbers:[]};
};
s.checkCancelFinance=async()=>{
  const order=s.cancelDialog.order;
  if(!order)return;
  const sectionCode=s.reportSectionCode(order);
  if(!sectionCode){s.applyCancelFinance({success:false,message:'ไม่พบ Section ของแถว Order'});return;}
  s.cancelDialog={...s.cancelDialog,financeLoading:true,financeChecked:false,canCancel:false,financeMessage:'กำลังตรวจสอบ Bill และใบเสร็จล่าสุด',receiptNumbers:[]};
  try{
    const p=await s.processCall(PROCESS_ID,{action:'check_cancel_finance',organization_code:s.unitCode(),section_codes:[sectionCode],order_id:s.text(order.order_id),order_number:s.text(order.order_number)});
    s.applyCancelFinance(p||{success:false,message:'ไม่พบผลตรวจสอบสถานะการเงิน'});
  }catch(error){s.applyCancelFinance({success:false,message:s.text(error&&error.message)||'เรียกตรวจสอบสถานะการเงินไม่สำเร็จ'});}
};
s.openCancelOrder=async order=>{
  if(s.viewMode==='lookup'){field.notify('โหมดสืบค้นเป็นแบบอ่านอย่างเดียว','warning',3000);return;}
  if(!s.canCancelOrder(order)){field.notify('ยกเลิก Section นี้ได้เฉพาะรายการที่ยังรอรับหรือรับแล้วและยังไม่มีผลตรวจ','warning',4500);return;}
  const sectionCode=s.reportSectionCode(order);
  if(!sectionCode){field.notify('ไม่พบ Section ของแถว Order จึงยกเลิกไม่ได้','warning',4500);return;}
  const reasonOptions=await s.loadReasonOptions('ORDER_CANCEL',sectionCode);
  if(!reasonOptions.length){field.notify('ห้อง LAB นี้ยังไม่มีเหตุผลยกเลิก Order ที่เปิดใช้งาน','warning',4500);return;}
  s.selected={};
  s.cancelDialog={...s.emptyCancelDialog(),visible:true,order:order};
  await s.checkCancelFinance();
};
s.submitCancelOrder=async()=>{
  const order=s.cancelDialog.order,reasonCode=s.text(s.cancelDialog.reason),reason=s.cancelReasonLabels[reasonCode]||reasonCode;
  if(!order){field.notify('ไม่พบ Order ที่ต้องการยกเลิก','error',3500);return;}
  if(!s.cancelDialog.financeChecked||!s.cancelDialog.canCancel){field.notify('กรุณาตรวจสอบสถานะการเงินให้ผ่านก่อนยกเลิก','warning',4500);return;}
  if(!reason){field.notify('กรุณาระบุเหตุผลการยกเลิก Order','warning',3500);return;}
  if(s.cancelDialog.loading)return;
  s.cancelDialog={...s.cancelDialog,loading:true};
  try{
    const p=await s.processCall(PROCESS_ID,{action:'cancel_order',organization_code:s.unitCode(),section_codes:[s.reportSectionCode(order)],order_id:s.text(order.order_id),order_number:s.text(order.order_number),cancel_reason:reason});
    if(!p||p.success===false){
      s.cancelDialog={...s.cancelDialog,loading:false};
      if(p&&['finance_receipt_active','finance_state_unknown','finance_item_sync_failed'].includes(s.text(p.error))){s.applyCancelFinance(p);}
      field.notify((p&&p.message)||'ยกเลิก LAB Order ไม่สำเร็จ','error',6500);return;
    }
    const d=p.data||{},terminal=['cancelled','rejected','returned','reversed'];
    (Array.isArray(order.items)?order.items:[]).forEach(item=>{
      if(terminal.includes(s.text(item&&item.current_status).toLowerCase()))return;
      item.current_status='cancelled';item.work_status='cancelled';
      item.cancel_type=s.text(d.cancel_type)||'lab_order_cancelled';item.cancel_reason=s.text(d.cancel_reason)||reason;
      item.cancelled_at=s.text(d.cancelled_at);item.cancelled_by=d.cancelled_by||'';
    });
    s.cancelDialog=s.emptyCancelDialog();
    field.notify(p.message||'ยกเลิก LAB Order แล้ว',d.audit_sync_pending?'warning':'success',d.audit_sync_pending?5000:3200);
    s.loadOrders();s.refreshCounts();
  }catch(error){s.cancelDialog={...s.cancelDialog,loading:false};field.notify(s.text(error&&error.message)||'เรียก API ยกเลิก Order ไม่สำเร็จ','error',5500);}
};

s.notifyPending=label=>field.notify(label+' รอการเชื่อมต่อ','info',2500);
s.retesting={};
s.isRetesting=order=>!!s.retesting[s.orderRowKey(order)];
s.retestAnswered=p=>{
  const d=p&&p.data||{};
  return !Array.isArray(d.orders)&&Object.prototype.hasOwnProperty.call(d,'reopened_item_count');
};
s.performRetest=async order=>{
  if(s.viewMode==='lookup'){field.notify('โหมดสืบค้นเป็นแบบอ่านอย่างเดียว','warning',3000);return;}
  const key=s.orderRowKey(order),orderId=s.text(order&&order.order_id),sectionCode=s.reportSectionCode(order);
  if(!orderId){field.notify('ไม่พบรหัส Order','error',3200);return;}
  if(!sectionCode){field.notify('ไม่พบ Section ของแถว Order จึงเปิดตรวจใหม่ไม่ได้','warning',4200);return;}
  if(s.retesting[key])return;
  s.retesting={...s.retesting,[key]:true};
  try{
    const p=await s.processCall(PROCESS_ID,{action:'retest_order',organization_code:s.unitCode(),section_codes:[sectionCode],order_id:orderId,order_number:s.text(order&&order.order_number)});
    if(!p||p.success===false){field.notify(s.text(p&&p.message)||'เปิดตรวจใหม่ไม่สำเร็จ','error',6500);return;}
    if(!s.retestAnswered(p)){field.notify('Process worklist ที่ deploy อยู่ยังไม่มี action retest_order — ต้อง replace body ล่าสุดก่อน','error',7000);return;}
    const d=p.data||{};
    field.notify(s.text(p.message)||'เปิดตรวจใหม่แล้ว',d.audit_sync_pending?'warning':'success',d.audit_sync_pending?6500:4000);
    s.selected={};
    s.statusKey='waiting';
    s.page={...s.page,current:1};
    s.loadOrders();
    s.refreshCounts();
  }catch(error){field.notify(s.text(error&&error.message)||'เรียก API ตรวจใหม่ไม่สำเร็จ','error',6500);}
  finally{const next={...s.retesting};delete next[key];s.retesting=next;}
};
s.retestOrder=order=>{
  if(s.viewMode==='lookup'){field.notify('โหมดสืบค้นเป็นแบบอ่านอย่างเดียว','warning',3000);return;}
  const orderNo=s.text(order&&order.order_number)||'Order นี้';
  const run=()=>s.performRetest(order);
  const message='ยืนยันตรวจใหม่ '+orderNo+'?\\nระบบจะนำรายการที่ยกเลิก/ปฏิเสธกลับไปรอรับ specimen ล้าง LAB NO. เดิมโดยเก็บไว้ในประวัติ และสร้าง LAB NO. ใหม่เมื่อกดรับ specimen';
  if(typeof field.confirm==='function')return field.confirm(message,run,'warning','ตรวจใหม่');
  return run();
};
s.reportCommand=type=>s.notifyPending(type==='excel'?'Report Excel':'Report PDF');
s.createOrderSearchHn=()=>{
  const raw=s.text(s.filters&&s.filters.hn).replace(/^HN\\s*/i,'').trim();
  return /^\\d{6,}$/.test(raw)?raw:'';
};
s.createOrderVisitContext=visit=>{
  const p=visit&&visit.pid||{};
  const name=[s.text(p.prename),s.text(p.p_fname),s.text(p.p_lname)].filter(Boolean).join(' ').replace(/\\s+/g,' ').trim();
  const gender=({'1':'ชาย','2':'หญิง'})[s.text(p.p_gender)]||s.text(p.p_gender);
  return {
    person_id:s.text(visit&&visit.xtbxlv1_xfx_id||p.value),
    hn:s.text(p.hn),
    full_name:name,
    sex:gender,
    age:p.age==null?'':p.age,
    blood_group:s.text(p.p_abogroup),
    p_pic:Array.isArray(p.p_pic)?p.p_pic:null,
    allergy_tags:[],
    visit_id:s.text(visit&&visit._id||visit&&visit.value),
    visit_tran_id:s.text(visit&&visit.visit_tran_id),
    visit_tran_count:Number(visit&&visit.visit_tran_count||0),
    visit_tran_ambiguous:!!(visit&&visit.visit_tran_ambiguous),
    current_unit:visit&&(visit.current_unit||visit.unit_to)||null,
    current_room:visit&&(visit.current_room||visit.room_to)||null,
    visit_tran_status:s.text(visit&&visit.visit_tran_status),
    visit_priority:s.text(visit&&visit.visit_priority)||'10',
    vn:s.text(visit&&visit.vn),
    visit_type:s.text(visit&&visit.visit_type),
    an:s.text(visit&&visit.an),
    encounter_class:s.text(visit&&visit.an)?'IPD':'OPD',
    ward:s.text(visit&&visit.ward),
    bed:s.text(visit&&visit.bed),
    visit_datetime:s.text(visit&&visit.visit_date||visit&&visit.created_at),
    visit_clinic:s.text(visit&&visit.visit_clinic),
    visit_doctor:s.text(visit&&visit.visit_doctor),
    dx_summary:'',
    service_type:'',
    inscl_hos:Array.isArray(visit&&visit.inscl_hos)?visit.inscl_hos:[]
  };
};
s.queueUnitCode=context=>{
  const raw=context&&(context.current_unit||context.unit_to);
  return s.text(raw&&typeof raw==='object'?(raw.value||raw.code):raw).toUpperCase();
};
s.openMoveUnitAfterOrder=context=>{
  const ctx=context||{};
  const tranCount=Number(ctx.visit_tran_count||0);
  const tranId=s.text(ctx.visit_tran_id||ctx.tran_id||ctx.vtran_id);
  const currentUnit=s.queueUnitCode(ctx);
  const workUnit=s.unitCode();
  const warn=message=>field.notify('ส่งใบสั่งแล้ว แต่ยังส่งต่อคิวไม่ได้ — '+message,'warning',6500);
  if(ctx.visit_tran_ambiguous||tranCount>1){warn('Visit นี้มีคิวเปิดอยู่มากกว่า 1 คิว กรุณาตรวจสอบคิวปัจจุบันก่อนส่งต่อ');return;}
  if(tranCount!==1||!tranId){warn('ไม่พบ Visit Tran ที่เปิดอยู่สำหรับผู้ป่วยรายนี้');return;}
  if(!workUnit||!currentUnit||currentUnit!==workUnit){warn('คิวปัจจุบันอยู่ที่ '+(currentUnit||'หน่วยงานอื่น')+' ไม่ใช่ห้อง '+(workUnit||'LAB')+' จึงไม่ย้ายคิวอัตโนมัติ');return;}
  const host=field.getFormRef&&field.getFormRef();
  if(!host||typeof host.openForm!=='function'){warn('ไม่พบตัวเปิดฟอร์ม Move Unit');return;}
  const moveContext={tran_id:tranId,cur_unit:currentUnit,visit_priority:s.text(ctx.visit_priority)||'10',tran_note:'',consult_id:''};
  setTimeout(()=>host.openForm(MOVE_UNIT_FORM_ID,'','',moveContext,{params:moveContext,cancelCallback:()=>{
    if(typeof host.subFormClose==='function')host.subFormClose();
    s.page={...s.page,current:1};
    s.refreshWorklist();
  }}),450);
};
s.openCreateOrder=async()=>{
  if(s.viewMode==='lookup'){field.notify('โหมดสืบค้นเป็นแบบอ่านอย่างเดียว','warning',3000);return;}
  const form=field.getFormRef&&field.getFormRef();
  if(!form||typeof form.openForm!=='function'){field.notify('ไม่พบตัวเปิด CPOE Order App','error',3000);return;}
  const sectionCodes=Array.isArray(s.allowedSectionCodes)?s.allowedSectionCodes.slice():[];
  if(!sectionCodes.length){field.notify('Organization นี้ยังไม่ได้ผูก Section LAB จึงสร้างรายการไม่ได้','warning',4000);return;}
  if(s.createOrderLoading)return;
  const launchParams=Object.assign({},form.formParams||{}, {
    manual_visit:true,
    source:'lab-worklist',
    lab_scope:true,
    organization_code:s.unitCode(),
    section_codes:sectionCodes,
    on_order_sent:context=>{s.page={...s.page,current:1};s.refreshWorklist();s.openMoveUnitAfterOrder(context);}
  });
  const hn=s.createOrderSearchHn();
  if(hn){
    s.createOrderLoading=true;
    try{
      const response=await s.processCall(PROCESS_ID,{action:'list_open_visits',organization_code:s.unitCode(),hn:hn});
      if(!response||response.success===false){field.notify(s.text(response&&response.message)||'ตรวจสอบ Visit วันนี้ไม่สำเร็จ','error',4500);return;}
      const visits=response.data&&Array.isArray(response.data.visits)?response.data.visits:[];
      const matches=visits.filter(visit=>s.text(visit&&visit.pid&&visit.pid.hn).replace(/^HN\\s*/i,'')===hn);
      if(!matches.length){field.notify('HN '+hn+' ยังไม่ได้เปิด VN วันนี้','warning',4200);return;}
      Object.assign(launchParams,s.createOrderVisitContext(matches[matches.length-1]));
    }catch(error){field.notify(s.text(error&&error.message)||'ตรวจสอบ Visit วันนี้ไม่สำเร็จ','error',4500);return;}
    finally{s.createOrderLoading=false;}
  }
  form.openForm(CPOE_ORDER_APP_ID,'','',null,{backdrop:false,params:launchParams});
};
s.openEmr=order=>{
  const form=field.getFormRef&&field.getFormRef();
  const visitId=s.orderVisitId(order);
  if(!visitId){field.notify('Order นี้ไม่มี Visit ID สำหรับเปิด EMR History','warning',3000);return;}
  if(!form||typeof form.openForm!=='function'){field.notify('ไม่พบตัวเปิด EMR','error',3000);return;}
  form.openForm(EMR_FORM_ID,'','',null,{backdrop:false,popupType:'dialog',readonly:true,params:Object.assign({},form.formParams||{},{source:'lab-worklist',lab_deep_link:true,visit_id:visitId})});
};

s.extractProcess=out=>{const c=[out,out&&out.data,out&&out.data&&out.data.data,out&&out.reply&&out.reply.data];for(let i=0;i<c.length;i++){const x=c[i];if(x&&typeof x==='object'&&(typeof x.success==='boolean'||(x.data&&Array.isArray(x.data.orders))))return x;}return out||{};};
s.extractPayload=out=>{const p=s.extractProcess(out);const c=[p&&p.data,p,out&&out.data&&out.data.data,out&&out.data];for(let i=0;i<c.length;i++){if(c[i]&&Array.isArray(c[i].orders))return c[i];}return null;};
s.api=()=>field.globalUserState||((field.getFormRef&&field.getFormRef())||{}).userState;
s.extractFormRows=out=>{const c=[out,out&&out.data,out&&out.data&&out.data.data,out&&out.reply&&out.reply.data];for(let i=0;i<c.length;i++)if(Array.isArray(c[i]))return c[i];return[];};
s.loadSpecimenMaster=()=>{
  if(s.specimenMasterLoading||s.specimenMasterLoaded)return;
  const api=s.api();
  if(!api||typeof api.crudGetAll!=='function')return;
  s.specimenMasterLoading=true;
  api.crudGetAll(
    {sdProvider:{providerId:LAB_SPECIMEN_FORM_ID,providerType:'FORM',params:{},options:{limit:2000,page:1}},totalEnable:false},
    out=>{s.specimenDropdownOptions=s.extractFormRows(out);s.specimenMasterLoading=false;s.specimenMasterLoaded=true;},
    ()=>{s.specimenDropdownOptions=[];s.specimenMasterLoading=false;}
  );
};
s.loadPathologySiteMaster=()=>{
  if(s.pathologySiteMasterLoading||s.pathologySiteMasterLoaded)return;
  const api=s.api();
  if(!api||typeof api.crudGetAll!=='function')return;
  s.pathologySiteMasterLoading=true;
  api.crudGetAll(
    {sdProvider:PATHOLOGY_SITE_PROVIDER,totalEnable:false},
    out=>{
      s.pathologySiteMasterOptions=s.extractFormRows(out)
        .map(s.pathologySiteMasterOption)
        .filter(option=>option.value);
      s.pathologySiteMasterLoading=false;
      s.pathologySiteMasterLoaded=true;
    },
    ()=>{s.pathologySiteMasterOptions=[];s.pathologySiteMasterLoading=false;field.notify('โหลดรายการตำแหน่งเดียวกับใบสั่งไม่สำเร็จ','warning',4000);}
  );
};
s.loadPathologyResultMaster=()=>{
  if(s.pathologyResultMasterLoading||s.pathologyResultMasterLoaded)return;
  const api=s.api();
  if(!api||typeof api.crudGetAll!=='function')return;
  s.pathologyResultMasterLoading=true;
  api.crudGetAll(
    {sdProvider:PATHOLOGY_RESULT_DETAIL_PROVIDER,totalEnable:false},
    out=>{
      const seen={};
      s.pathologyResultMasterOptions=s.extractFormRows(out)
        .filter(entry=>entry&&entry.is_active!==false&&s.isPathologyResultMasterEntry(entry))
        .map(s.pathologyResultMasterOption)
        .filter(option=>{if(!option.value||seen[option.value])return false;seen[option.value]=true;return true;})
        .sort((left,right)=>left.display_order-right.display_order||left.code.localeCompare(right.code)||left.label.localeCompare(right.label));
      s.pathologyResultMasterLoading=false;
      s.pathologyResultMasterLoaded=true;
    },
    ()=>{s.pathologyResultMasterOptions=[];s.pathologyResultMasterLoading=false;field.notify('โหลดรายการผลตรวจสำเร็จรูปของห้อง MY ไม่สำเร็จ แต่ยังพิมพ์ผลแบบ free text ได้','warning',4000);}
  );
};
s.processCall=(id,params)=>new Promise((resolve,reject)=>{
  const api=s.api();
  if(!api||typeof api.runProcess!=='function'){reject(new Error('ไม่พบ API Process connector'));return;}
  api.runProcess(id,params||{},out=>resolve(s.extractProcess(out)),error=>reject(error||new Error('เรียก API Process ไม่สำเร็จ')));
});
s.unitCode=()=>{const user=field.globalUserState&&field.globalUserState.user;return s.text(user&&user.unit&&user.unit.code).toUpperCase();};
s.normalizeReasonOptions=rows=>(Array.isArray(rows)?rows:[]).map(row=>({value:s.text(row&&row.value),label:s.text(row&&row.label)})).filter(row=>row.value&&row.label);
s.applyReasonOptions=(reasonType,options)=>{
  const clean=s.normalizeReasonOptions(options),labels=Object.fromEntries(clean.map(option=>[option.value,option.label]));
  if(reasonType==='SPECIMEN_REJECT'){
    s.rejectReasonOptions=clean;
    s.rejectReasonLabels={...s.rejectReasonLabels,...labels};
  }else if(reasonType==='ORDER_CANCEL'){
    s.cancelReasonOptions=clean;
    s.cancelReasonLabels={...s.cancelReasonLabels,...labels};
  }
  return clean;
};
s.loadReasonOptions=async(reasonType,sectionCode)=>{
  const type=s.text(reasonType).toUpperCase(),section=s.text(sectionCode).toUpperCase();
  const fallback=type==='SPECIMEN_REJECT'?REJECT_REASON_OPTIONS:CANCEL_REASON_OPTIONS;
  const key=type+'|'+(section||'ALL');
  if(Object.prototype.hasOwnProperty.call(s.reasonOptionCache,key))return s.applyReasonOptions(type,s.reasonOptionCache[key]);
  try{
    const p=await s.processCall(PROCESS_ID,{action:'get_reason_options',organization_code:s.unitCode(),section_codes:section?[section]:[],reason_section_code:section,reason_type:type});
    const rows=p&&p.success!==false&&p.data&&Array.isArray(p.data.options)?p.data.options:null;
    if(rows===null)return s.applyReasonOptions(type,fallback);
    const clean=s.normalizeReasonOptions(rows);
    s.reasonOptionCache={...s.reasonOptionCache,[key]:clean};
    return s.applyReasonOptions(type,clean);
  }catch(error){return s.applyReasonOptions(type,fallback);}
};
s.params=(statuses,limit,page,lookupModeOverride)=>{
  const scopedStatuses=Array.isArray(statuses)?statuses:[];
  const p={statuses:scopedStatuses,page:page||s.page.current,limit:limit||s.page.size,organization_code:s.unitCode()};
  const search=s.scanMode?s.scannedHn:s.text(s.filters.hn);
  if(search){if(s.scanMode||s.viewMode==='lookup'||s.viewMode==='cbc_swap')p.hn=search;else p.query=search;}
  if(s.viewMode==='cbc_swap'){
    p.action='list_cbc_swap';
    if(s.filters.dates&&s.filters.dates.length===2){p.date_from=s.filters.dates[0];p.date_to=s.filters.dates[1];}
    return p;
  }
  if(s.viewMode==='lookup'){
    p.cross_section=true;
    p.lookup_mode=lookupModeOverride||s.lookupMode;
    if(s.filters.dates&&s.filters.dates.length===2){p.date_from=s.filters.dates[0];p.date_to=s.filters.dates[1];}
    else if(search)p.all_dates=true;
    return p;
  }
  const allCompletedHistory=s.scanMode&&scopedStatuses.length===1&&scopedStatuses[0]==='completed';
  if(allCompletedHistory)p.all_dates=true;
  if(!allCompletedHistory&&!s.isOrderNumberSearch(search)&&s.filters.dates&&s.filters.dates.length===2){p.date_from=s.filters.dates[0];p.date_to=s.filters.dates[1];}
  return p;
};
s.call=(params,ok,fail)=>{s.processCall(PROCESS_ID,params).then(p=>{if(p&&p.success===false){fail(new Error(p.message||'API ปฏิเสธคำขอ'));return;}const payload=s.extractPayload(p);if(!payload){fail(new Error('รูปแบบ response ไม่ตรงกับ LAB worklist contract'));return;}ok(payload);}).catch(error=>fail(error||new Error('เรียก API ไม่สำเร็จ')));};
s.refreshLookupCounts=()=>{if(s.viewMode!=='lookup'||!s.lookupSearched)return;const seq=++s.countSeq;['results','orders'].forEach(mode=>{const p=s.params(s.lookupStatusMap[mode],1,1,mode);p.include_specimens=false;s.call(p,payload=>{if(seq!==s.countSeq)return;s.lookupCounts={...s.lookupCounts,[mode]:Number(payload.total||0)};},()=>{});});};
s.refreshCbcSwapCount=()=>{if(!s.canUseCbcSwap())return;const seq=++s.cbcCountSeq;const dates=s.todayFilters&&s.todayFilters.dates;const p={action:'list_cbc_swap',organization_code:s.unitCode(),page:1,limit:1};if(dates&&dates.length===2){p.date_from=dates[0];p.date_to=dates[1];}s.call(p,payload=>{if(seq!==s.cbcCountSeq)return;s.cbcSwapCount=Number(payload.total||0);},()=>{});};
s.refreshCounts=()=>{if(s.viewMode==='lookup'){s.refreshLookupCounts();return;}if(s.viewMode==='cbc_swap'){s.refreshCbcSwapCount();return;}const seq=++s.countSeq;s.statusFilters.forEach(filter=>{const p=s.params(s.statusMap[filter.key],1,1);p.include_specimens=false;s.call(p,payload=>{if(seq!==s.countSeq)return;s.counts={...s.counts,[filter.key]:Number(payload.total||0)};},()=>{});});s.refreshCbcSwapCount();};
s.loadOrders=(after,includeStatusCounts)=>{if(s.viewMode==='lookup'&&!s.lookupSearched){s.loading=false;s.errorMessage='';s.orders=[];s.page={...s.page,current:1,total:0};if(typeof after==='function')after(null);return;}const seq=++s.loadSeq;if(includeStatusCounts)++s.countSeq;s.loading=true;s.errorMessage='';s.selected={};s.specimenEdits={};s.resultActorMeta={};s.resultActorLoading={};const statuses=s.viewMode==='lookup'?s.lookupStatusMap[s.lookupMode]:(s.viewMode==='cbc_swap'?[]:s.statusMap[s.statusKey]);const request=s.params(statuses);if(includeStatusCounts&&s.viewMode==='today')request.include_status_counts=true;s.call(request,payload=>{if(seq!==s.loadSeq)return;s.orders=payload.orders||[];s.allowedSectionCodes=Array.isArray(payload.section_codes)?payload.section_codes.map(code=>s.text(code).toUpperCase()).filter(Boolean):[];if(s.viewMode==='today')s.allowedSectionCodes.forEach(code=>{s.loadReasonOptions('SPECIMEN_REJECT',code);});s.page={...s.page,current:Number(payload.page||s.page.current),size:Number(payload.limit||s.page.size),total:Number(payload.total||0)};if(s.viewMode==='today')s.counts={...s.counts,[s.statusKey]:Number(payload.total||0)};const batched=payload.status_counts;if(s.viewMode==='today'&&batched&&typeof batched==='object'){const next={...s.counts};s.statusFilters.forEach(filter=>{if(Object.prototype.hasOwnProperty.call(batched,filter.key))next[filter.key]=Number(batched[filter.key]||0);});s.counts=next;}if(s.viewMode==='cbc_swap')s.cbcSwapCount=Number(payload.total||0);s.loading=false;if(s.viewMode==='lookup')s.detailTabs=Object.fromEntries(s.orders.map(order=>[s.orderRowKey(order),s.lookupMode==='results'?'results':'order']));if(s.scanNoticePending){s.scanNoticePending=false;field.notify(s.orders.length?'พบรายการของ HN '+s.scannedHn:'ไม่พบรายการของ HN '+s.scannedHn+' ในสถานะนี้',s.orders.length?'success':'warning',3500);}if(typeof after==='function')after(payload);},()=>{if(seq!==s.loadSeq)return;s.orders=[];s.allowedSectionCodes=[];s.page={...s.page,total:0};s.errorMessage='โหลดรายการไม่สำเร็จ';s.scanNoticePending=false;s.loading=false;if(typeof after==='function')after(null);});};
s.refreshWorklist=()=>{s.loadOrders(payload=>{if(payload&&payload.status_counts&&typeof payload.status_counts==='object'){s.refreshCbcSwapCount();return;}s.refreshCounts();},true);};
s.applyFilters=()=>{s.scanMode=false;s.scannedHn='';s.scanNoticePending=false;s.page={...s.page,current:1};if(s.viewMode==='lookup'){const hn=s.text(s.filters.hn),hasDates=Array.isArray(s.filters.dates)&&s.filters.dates.length===2;if(!hn&&!hasDates){s.lookupSearched=false;s.lookupCounts={results:0,orders:0};s.orders=[];s.errorMessage='';return;}s.lookupSearched=true;s.lookupFilters={hn:hn,dates:hasDates?s.filters.dates.slice():[]};s.filters={...s.lookupFilters};s.loadOrders();s.refreshLookupCounts();return;}const search=s.text(s.filters.hn),selectedDates=Array.isArray(s.filters.dates)?s.filters.dates.slice():[],dates=s.isOrderNumberSearch(search)?[]:selectedDates;s.todayFilters={hn:search,dates:dates};s.filters={...s.filters,dates:dates};s.loadOrders();s.refreshCounts();};
s.setViewMode=mode=>{if(!['today','lookup','cbc_swap'].includes(mode)||s.viewMode===mode)return;if(mode==='cbc_swap'&&!s.canUseCbcSwap())return;if(s.viewMode==='today')s.todayFilters={hn:s.text(s.filters.hn),dates:Array.isArray(s.filters.dates)?s.filters.dates.slice():[]};s.viewMode=mode;s.scanMode=false;s.scannedHn='';s.scanNoticePending=false;s.expanded={};s.detailTabs={};s.selected={};s.errorMessage='';s.page={...s.page,current:1,total:0};if(mode==='lookup'){s.lookupMode='results';s.lookupSearched=false;s.lookupCounts={results:0,orders:0};s.lookupFilters={hn:'',dates:[]};s.filters={...s.lookupFilters};s.orders=[];return;}s.filters={...s.todayFilters,dates:Array.isArray(s.todayFilters.dates)?s.todayFilters.dates.slice():[]};s.loadOrders();s.refreshCounts();};
s.setLookupMode=mode=>{if(!s.lookupStatusMap[mode]||s.lookupMode===mode)return;s.lookupMode=mode;s.expanded={};s.detailTabs={};s.selected={};s.page={...s.page,current:1,total:0};if(s.lookupSearched)s.loadOrders();};
s.setStatus=key=>{if(!s.statusMap[key]||s.statusKey===key)return;s.statusKey=key;s.page={...s.page,current:1};s.loadOrders();};
s.setPage=page=>{s.page={...s.page,current:Number(page)||1};s.loadOrders();};
s.setPageSize=size=>{s.page={...s.page,current:1,size:Number(size)||30};s.loadOrders();};
s.handleUnitChange=()=>{
  const next=s.unitCode(),nextDay=s.bangkokToday();
  const unitChanged=next!==s.currentUnitCode,dayChanged=nextDay!==s.currentDay;
  if(!unitChanged&&!dayChanged)return;
  s.currentUnitCode=next;
  if(s.viewMode==='cbc_swap'&&!s.canUseCbcSwap())s.viewMode='today';
  if(dayChanged){
    s.currentDay=nextDay;
    s.todayFilters={hn:'',dates:[nextDay,nextDay]};
    s.lookupFilters={hn:'',dates:[]};
    s.filters=s.viewMode==='lookup'?{...s.lookupFilters}:{...s.todayFilters};
    s.scanMode=false;
    s.scannedHn='';
    s.scanNoticePending=false;
  }
  s.expanded={};
  s.detailTabs={};
  s.selected={};
  s.page={...s.page,current:1,total:0};
  if(s.viewMode==='lookup'){s.lookupSearched=false;s.lookupCounts={results:0,orders:0};s.orders=[];}
  else{s.loadOrders();s.refreshCounts();}
};`

/* Cross-room lookup is read-only. Intercept only the Result read request after
   onCreated has installed processCall; every write request keeps the original
   organization-scoped params and remains blocked in lookup mode. */
widget.onMounted = `const s=this.vueState;
if(!s.__crossSectionResultReadWrapped){
  const baseProcessCall=s.processCall;
  s.processCall=(id,params)=>{
    const next=params&&params.action==='get_manual_result'&&s.viewMode==='lookup'
      ? {...params,cross_section:true,lookup_mode:'results'}
      : params;
    return baseProcessCall(id,next);
  };
  s.__crossSectionResultReadWrapped=true;
}
if(!s.__initialLoadStarted){
  s.__initialLoadStarted=true;
  s.currentUnitCode=s.unitCode();
  s.loadSpecimenMaster();
  s.refreshWorklist();
}
if(!s.__unitWatch){
  s.__unitWatch=setInterval(()=>s.handleUnitChange(),1000);
}`

form.formConfig.cssCode = `.lab-cpoe{--primary:var(--el-color-primary,#409eff);--primary-50:var(--el-color-primary-light-9,#ecf5ff);--success:var(--el-color-success,#67c23a);--success-50:var(--el-color-success-light-9,#f0f9eb);--warning:var(--el-color-warning,#e6a23c);--warning-50:var(--el-color-warning-light-9,#fdf6ec);--danger:var(--el-color-danger,#f56c6c);--danger-50:var(--el-color-danger-light-9,#fef0f0);--ink:var(--el-text-color-primary,#303133);--text:var(--el-text-color-regular,#606266);--muted:var(--el-text-color-secondary,#909399);--placeholder:var(--el-text-color-placeholder,#a8abb2);--border:var(--el-border-color,#dcdfe6);--border-light:var(--el-border-color-light,#e4e7ed);--border-lighter:var(--el-border-color-lighter,#ebeef5);--fill:var(--el-fill-color,#f0f2f5);--fill-light:var(--el-fill-color-light,#f5f7fa);--fill-lighter:var(--el-fill-color-lighter,#fafafa);--fill-soft:var(--el-fill-color-lighter,#fafafa);--white:var(--el-bg-color,#fff);--lab-wait-bg:#fffbe6;--lab-wait-text:#8a6d00;--mono:"SFMono-Regular","Roboto Mono",Consolas,monospace;width:100%;padding:0 0 36px;background:var(--white);color:var(--text);font-family:"Leelawadee UI","Noto Sans Thai",Tahoma,"Segoe UI",sans-serif;font-size:13px;line-height:1.4}
.dark .lab-cpoe{--lab-wait-bg:rgba(250,219,20,.14);--lab-wait-text:#ffe45c}
.lab-cpoe *{box-sizing:border-box}
.lab-item-actor-cell{min-width:0;overflow-wrap:anywhere}.lab-item-action-cell{display:flex;align-items:center}.lab-item-action-cell .el-button{margin-left:0}.lab-item-retest-detail{margin-top:12px}.lab-item-retest-detail>span>span{color:var(--danger)}
.lab-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.lab-toolbar .el-button+.el-button{margin-left:0}
.lab-refresh-button{width:32px!important;height:32px;padding:0;flex:0 0 32px}
.lab-refresh-button svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.lab-search-control{width:290px}.lab-toolbar .lab-date-control{width:220px!important;flex:0 0 220px}
.lab-dropdown-caret{margin-left:5px;color:var(--muted);font-size:12px}
.lab-scan-context{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:0 0 10px;padding:8px 10px;border:1px solid var(--el-color-primary-light-5,#a0cfff);border-radius:6px;background:var(--primary-50);color:var(--primary)}.lab-scan-context-label{font-size:11px;font-weight:700}.lab-scan-context strong{color:var(--ink);font-size:14px}.lab-scan-context>span:not(.lab-scan-context-label){font-size:11px}.lab-scan-context .el-button{margin-left:auto}
.lab-view-tabs{display:flex;align-items:center;gap:3px;margin:2px 0 10px;border-bottom:1px solid var(--border)}.lab-view-tabs>button{min-height:36px;padding:7px 14px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--muted);font:inherit;font-weight:650;cursor:pointer}.lab-view-tabs>button:hover{color:var(--primary)}.lab-view-tabs>button.is-active{border-bottom-color:var(--primary);color:var(--primary)}
.lab-tab-count{display:inline-grid;min-width:19px;height:19px;margin-left:5px;place-items:center;padding:0 5px;border-radius:999px;background:var(--primary);color:#fff;font-size:10px}.lab-cbc-context{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;padding:9px 12px;border:1px solid var(--el-color-primary-light-5,#a0cfff);border-radius:7px;background:var(--primary-50)}.lab-cbc-context>div{display:grid;gap:2px}.lab-cbc-context strong{color:var(--ink)}.lab-cbc-context span{color:var(--muted);font-size:11px}.lab-cbc-table{width:100%;min-width:0;overflow-x:auto}.lab-cbc-head,.lab-cbc-row{display:grid;grid-template-columns:32px minmax(180px,1.35fr) minmax(170px,1.25fr) 70px 80px 92px minmax(140px,1.1fr) minmax(130px,1.05fr) 104px 116px;gap:9px;align-items:center;min-width:1260px;padding:8px 10px}.lab-cbc-head{border-bottom:1px solid var(--border);color:var(--muted);font-size:11px;font-weight:650;letter-spacing:.02em}.lab-cbc-row{min-height:74px;background:var(--white);cursor:pointer;transition:background-color .15s}.lab-cbc-row:hover{background:var(--fill-light)}.lab-patient-block.is-open>.lab-cbc-row{background:var(--fill)}.lab-cbc-flag{display:inline-flex;width:max-content;max-width:100%;min-height:22px;align-items:center;gap:5px;padding:1px 9px;border:1px solid var(--el-color-primary-light-5,#a0cfff);border-radius:999px;background:var(--primary-50);color:var(--primary);font-size:10px;font-weight:700;white-space:nowrap}.lab-cbc-section-cell{display:flex;align-items:center;gap:4px;flex-wrap:wrap}.lab-section-code.is-other{border-color:var(--el-border-color-darker,#c8c9cc);background:var(--fill);color:var(--muted)}.lab-cbc-action{display:flex;min-width:0;flex-direction:column;align-items:stretch;gap:4px}.lab-cbc-action .el-button{width:100%;margin:0;padding:5px 7px;font-size:11px}.lab-cbc-action small{color:var(--muted);font-size:9px;line-height:1.3;text-align:center}.lab-cbc-detail{min-width:1260px}.lab-cbc-readonly-note{margin-left:auto;padding-bottom:7px;color:var(--muted);font-size:11px}.lab-cbc-item-wrap{overflow-x:auto;margin-left:-42px}.lab-cbc-item-grid{display:grid;grid-template-columns:42px 52px 108px minmax(220px,1.6fr) minmax(150px,1fr) 128px 100px 92px minmax(120px,.9fr);gap:10px;align-items:center;min-width:1120px;padding:6px 0}.lab-cbc-item-head{min-height:44px;border-top:1px solid var(--el-color-primary-light-7,#c6e2ff);border-bottom:1px solid var(--el-color-primary-light-7,#c6e2ff);background:var(--primary-50);color:var(--ink);font-size:11px;font-weight:650}.lab-cbc-item-head>div:first-child,.lab-cbc-item-row>div:first-child{padding-left:12px}.lab-cbc-item-row{min-height:50px;border-bottom:1px dashed var(--border-lighter);font-size:12px}.lab-cbc-item-row:last-child{border-bottom:0}.lab-cbc-item-row.is-cbc{background:var(--primary-50)}.lab-cbc-item-code{color:var(--primary);font-family:var(--mono);font-weight:700}.lab-cbc-swappable-tag{display:inline-flex;min-height:22px;align-items:center;padding:1px 7px;border:1px solid var(--el-color-primary-light-5,#a0cfff);border-radius:999px;background:var(--white);color:var(--primary);font-size:10px;font-weight:700;white-space:nowrap}.lab-cbc-swap-summary{display:grid;grid-template-columns:1fr 32px 1fr;gap:10px;align-items:center}.lab-cbc-swap-summary>div{display:grid;gap:3px;padding:12px;border:1px solid var(--border-light);border-radius:7px;background:var(--fill-lighter);text-align:center}.lab-cbc-swap-summary span,.lab-cbc-swap-summary small{color:var(--muted);font-size:11px}.lab-cbc-swap-summary strong{color:var(--primary);font-family:var(--mono);font-size:20px}.lab-cbc-swap-summary>b{text-align:center;color:var(--muted);font-size:20px}.lab-cbc-swap-warning{margin-top:12px;padding:9px 11px;border:1px solid var(--el-color-warning-light-5,#f3d19e);border-radius:6px;background:var(--warning-50);color:var(--text);font-size:11px}
.lab-cbc-swap-dialog .el-dialog__header{margin:0;padding:18px 22px 14px;border-bottom:1px solid var(--border-lighter)}.lab-cbc-swap-dialog .el-dialog__body{padding:18px 22px}.lab-cbc-swap-dialog .el-dialog__footer{padding:14px 22px 18px;border-top:1px solid var(--border-lighter)}.lab-cbc-dialog-head{display:grid;gap:3px;padding-right:28px}.lab-cbc-dialog-head strong{color:var(--ink);font-size:17px}.lab-cbc-dialog-head small{color:var(--muted);font-size:11px}.lab-cbc-dialog-body{display:grid;gap:14px}.lab-cbc-patient-card{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 14px;border:1px solid var(--border-light);border-radius:8px;background:var(--fill-lighter)}.lab-cbc-patient-card>div{display:grid;gap:3px;min-width:0}.lab-cbc-patient-card strong{overflow:hidden;color:var(--ink);font-size:14px;text-overflow:ellipsis;white-space:nowrap}.lab-cbc-patient-card small{overflow:hidden;color:var(--muted);font-size:11px;text-overflow:ellipsis;white-space:nowrap}.lab-cbc-avatar{display:grid;width:42px;height:42px;place-items:center;border-radius:50%;background:var(--primary-50);color:var(--primary);font-size:12px;font-weight:700}.lab-cbc-swap-summary{grid-template-columns:minmax(0,1fr) 34px minmax(0,1fr);gap:12px}.lab-cbc-swap-summary .lab-cbc-swap-cell{display:grid;min-height:132px;align-content:start;gap:5px;padding:14px;border:1px dashed var(--border-light);border-radius:8px;background:var(--fill-lighter);text-align:left}.lab-cbc-swap-cell span{color:var(--muted);font-size:11px;font-weight:650}.lab-cbc-swap-cell strong{color:var(--muted);font-family:var(--mono);font-size:22px}.lab-cbc-swap-cell>b{overflow:hidden;color:var(--text);font-size:12px;font-weight:500;text-overflow:ellipsis;white-space:nowrap}.lab-cbc-swap-cell .lab-section-code{justify-self:start;margin-top:3px}.lab-cbc-swap-cell.is-from strong{text-decoration:line-through}.lab-cbc-swap-cell.is-target{border-style:solid;border-color:var(--primary);background:var(--white);box-shadow:0 0 0 2px var(--primary-50)}.lab-cbc-swap-cell.is-target strong{color:var(--primary)}.lab-cbc-swap-summary>i{color:var(--primary);font-size:24px;font-style:normal;font-weight:700;text-align:center}.lab-cbc-swap-facts{display:grid;gap:7px;margin:0;padding:11px 14px 11px 30px;border:1px solid var(--el-color-warning-light-5,#f3d19e);border-radius:7px;background:var(--warning-50);color:var(--text);font-size:11px}.lab-cbc-swap-facts li::marker{color:var(--warning)}.lab-cbc-reason{display:grid;gap:6px;color:var(--text);font-size:12px;font-weight:650}.lab-cbc-reason>span small{color:var(--muted);font-weight:400}.lab-cbc-reason .el-select{width:100%}
.lab-lookup-strip{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}.lab-lookup-strip>button{display:inline-flex;min-height:34px;align-items:center;gap:8px;padding:6px 11px;border:1px solid var(--border-light);border-radius:6px;background:var(--fill-light);color:var(--text);font:inherit;cursor:pointer}.lab-lookup-strip>button strong{display:grid;min-width:22px;height:20px;place-items:center;padding:0 5px;border-radius:999px;background:var(--white);color:var(--muted);font-size:10px}.lab-lookup-strip>button.is-active{border-color:var(--primary);background:var(--primary-50);color:var(--primary)}.lab-lookup-strip>button.is-active strong{color:var(--primary)}.lab-lookup-strip>small{margin-left:auto;color:var(--muted);font-size:11px}.lab-lookup-empty{display:grid;min-height:220px;place-content:center;gap:6px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--fill-lighter);text-align:center}.lab-lookup-empty strong{color:var(--ink);font-size:15px}.lab-lookup-empty span{color:var(--muted);font-size:12px}
.lab-status-strip{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.lab-status-chip{--chip-color:#73767a;--chip-border:var(--primary);display:flex;align-items:baseline;gap:6px;padding:6px 12px;border:1px solid var(--border-light);border-radius:6px;background:var(--fill-light);color:var(--muted);font:inherit;cursor:pointer;transition:border-color .15s,background-color .15s;user-select:none}
.lab-status-chip strong{color:var(--chip-color);font-size:18px;line-height:1}.lab-status-chip span{font-size:12px}
.lab-status-chip[data-status="waiting"]{--chip-color:#fadb14;--chip-border:#fadb14}.lab-status-chip[data-status="received"]{--chip-color:#e6a23c;--chip-border:#e6a23c}.lab-status-chip[data-status="partial"]{--chip-color:var(--el-color-success-light-3,#95d475);--chip-border:var(--el-color-success-light-3,#95d475)}.lab-status-chip[data-status="complete"]{--chip-color:#67c23a;--chip-border:#67c23a}.lab-status-chip[data-status="cancelled"]{--chip-color:#f56c6c;--chip-border:#f56c6c}
.lab-status-chip:hover,.lab-status-chip.is-active{border-color:var(--chip-border)}.lab-status-chip.is-active{background:var(--fill)}
.lab-status-legend{display:flex;align-items:center;gap:14px;margin-left:auto;padding:5px 10px;border:1px solid var(--border-light);border-radius:6px;background:var(--white);color:var(--text);font-size:11px;white-space:nowrap}.lab-status-legend-item{display:inline-flex;align-items:center;gap:6px}.lab-status-legend-dot{width:10px;height:10px;flex:none;border-radius:50%}.lab-status-legend-dot.is-waiting{background:#fadb14}.lab-status-legend-dot.is-received{background:#e6a23c}.lab-status-legend-dot.is-partial{background:var(--el-color-success-light-3,#95d475)}.lab-status-legend-dot.is-complete{background:#67c23a}.lab-status-legend-dot.is-cancelled{background:#f56c6c}
.lab-list-summary{margin:0 0 8px;color:var(--muted);font-size:12px}.lab-list-summary.is-error{color:var(--danger)}
.lab-worklist-shell{border-top:1px solid var(--border);border-bottom:1px solid var(--border)}.lab-worklist{width:100%;min-width:0;background:var(--white)}
.lab-list-head,.lab-patient-row{display:grid;grid-template-columns:32px minmax(190px,1.4fr) minmax(190px,1.35fr) 72px 82px minmax(145px,1.15fr) minmax(145px,1.2fr) 110px 72px 78px 64px;gap:9px;align-items:center;padding:8px 10px}.lab-list-head.is-lookup,.lab-patient-row.is-lookup{grid-template-columns:32px minmax(190px,1.4fr) minmax(190px,1.35fr) 72px 82px 64px minmax(145px,1.15fr) minmax(145px,1.2fr) 110px 72px 78px 64px}
.lab-hn-print{white-space:nowrap}
.lab-list-head{color:var(--muted);font-size:11px;font-weight:650;border-bottom:1px solid var(--border);letter-spacing:.02em}
.lab-patient-block{position:relative;border-bottom:1px solid var(--border-lighter);content-visibility:auto;contain-intrinsic-size:74px}.lab-patient-block:last-child{border-bottom:0}
.lab-patient-row{min-height:74px;background:var(--white);cursor:pointer;transition:background-color .15s}.lab-patient-row:hover{background:var(--fill-light)}.lab-patient-block.is-open>.lab-patient-row{background:var(--fill)}
.lab-expand-button{display:grid;width:28px;height:30px;place-items:center;padding:0;border:0;border-radius:4px;background:transparent;color:var(--muted);cursor:pointer}.lab-expand-button:hover{background:var(--fill-light);color:var(--primary)}.lab-expand-button svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;transition:transform .16s}.lab-patient-block.is-open .lab-expand-button svg{transform:rotate(90deg)}
.lab-patient-summary,.lab-context-tags,.lab-metric,.lab-doctor-cell{min-width:0}.lab-patient-hn{display:flex;align-items:center;gap:6px;min-width:0;color:var(--ink);font-weight:700}.lab-patient-hn .lab-mono{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lab-patient-name{margin-top:1px;overflow:hidden;color:var(--ink);font-weight:650;text-overflow:ellipsis;white-space:nowrap}.lab-patient-demographic{display:flex;align-items:center;gap:6px;margin-top:1px;color:var(--muted);font-size:11px}
.lab-inline-tag,.lab-state-tag{display:inline-flex;min-height:20px;align-items:center;justify-content:center;padding:1px 6px;border:1px solid;border-radius:4px;font-size:10px;font-weight:650;white-space:nowrap}.lab-state-tag.status-waiting{border-color:#fadb14;background:var(--lab-wait-bg);color:var(--lab-wait-text)}.lab-state-tag.status-received{border-color:#e6a23c;background:var(--warning-50);color:var(--warning)}.lab-state-tag.status-resulted,.lab-state-tag.status-result-partial{border-color:var(--el-color-success-light-3,#95d475);background:var(--success-50);color:var(--el-color-success-dark-2,#529b2e)}.lab-state-tag.status-result-complete{border-color:#67c23a;background:var(--success-50);color:var(--success)}.lab-state-tag.status-cancelled{border-color:#f56c6c;background:var(--danger-50);color:var(--danger)}.lab-state-tag.status-mixed{border-color:var(--el-text-color-placeholder,#a8abb2);background:var(--fill);color:var(--muted)}.lab-urgent-tag{min-height:18px;padding:0 5px;border-color:var(--el-color-danger-light-5,#fab6b6);background:var(--danger-50);color:var(--danger);font-size:9px}.lab-meta-pill{min-height:21px;padding:1px 8px;border-color:var(--el-border-color-darker,#c8c9cc);border-radius:999px;background:var(--white);color:var(--text)}.lab-gender-pill{min-height:18px;padding:0 6px;border-color:var(--el-border-color-darker,#c8c9cc);border-radius:999px;background:var(--white);color:var(--text);font-size:9px}
.lab-context-top{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:4px}.lab-context-top .lab-source-pill{border-color:var(--el-color-primary-light-5,#a0cfff);background:var(--primary-50);color:var(--primary)}.lab-context-top .lab-payment-pill{border-color:var(--el-color-success-light-5,#b3e19d);background:var(--success-50);color:var(--success)}.lab-context-top .lab-payment-pill.is-unpaid{border-color:var(--el-color-danger-light-5,#fab6b6);background:var(--danger-50);color:var(--danger)}.lab-context-top .lab-coverage-pill{border-color:var(--el-color-warning-light-5,#f3d19e);background:var(--warning-50);color:var(--warning)}.lab-admission-badge{display:flex;width:max-content;max-width:100%;min-height:24px;align-items:center;margin:0 0 5px;padding:3px 10px;overflow:hidden;border-radius:6px;background:var(--el-color-danger,#f56c6c);color:#fff;font-size:12px;font-weight:750;line-height:1.2;text-overflow:ellipsis;white-space:nowrap}.lab-prior-medication{display:flex;width:max-content;max-width:100%;min-height:22px;align-items:center;margin:0 0 4px;padding:1px 9px;overflow:hidden;border:1px solid var(--el-color-danger-light-5,#fab6b6);border-radius:999px;background:var(--danger-50);color:var(--danger);font-size:11px;font-weight:700;text-overflow:ellipsis;white-space:nowrap}
.lab-section-code{display:inline-flex;min-width:36px;min-height:23px;align-items:center;justify-content:center;padding:1px 7px;border:1px solid var(--el-color-primary-light-5,#a0cfff);border-radius:5px;background:var(--primary-50);color:var(--primary);font-family:var(--mono);font-size:11px;font-weight:750}
.lab-field-value{display:block;min-width:0;overflow:hidden;color:var(--ink);font-size:12px;font-weight:650;text-overflow:ellipsis;white-space:nowrap}.lab-hover-summary{cursor:help}.lab-time-value{margin-top:3px;line-height:1.25}.lab-time-value span{display:block}.lab-order-no-tag{display:inline-flex;max-width:100%;min-height:18px;align-items:center;padding:0 6px;overflow:hidden;border:1px solid var(--el-color-primary-light-5,#a0cfff);border-radius:999px;background:var(--primary-50);color:var(--primary);font-family:var(--mono);font-size:9px;text-overflow:ellipsis;white-space:nowrap}.lab-diagnosis-summary{display:block;max-width:100%;margin-top:2px;overflow:hidden;color:var(--muted);font-size:10px;text-overflow:ellipsis;white-space:nowrap;cursor:help}.lab-cpoe-list-popper .lab-pop-line{line-height:1.5;white-space:nowrap}.lab-cpoe-diagnosis-popper{max-width:420px}.lab-cpoe-diagnosis-popper .lab-diagnosis-pop{line-height:1.5;white-space:normal;overflow-wrap:anywhere}
.lab-row-status-check{display:flex;min-width:0;align-items:center;justify-self:start;gap:8px}.lab-order-status-step{display:inline-flex;align-items:center;gap:3px;color:var(--text);font-size:10px;cursor:default}.lab-order-status-step b{font-weight:650;line-height:1}.lab-order-status-dot{width:10px;height:10px;flex:none;border-radius:50%}.lab-order-status-step.is-waiting .lab-order-status-dot{background:#fadb14}.lab-order-status-step.is-waiting b{color:var(--lab-wait-text)}.lab-order-status-step.is-received .lab-order-status-dot{background:#e6a23c}.lab-order-status-step.is-received b{color:var(--warning)}.lab-order-status-step.is-partial .lab-order-status-dot{background:var(--el-color-success-light-3,#95d475)}.lab-order-status-step.is-partial b{color:var(--el-color-success-dark-2,#529b2e)}.lab-order-status-step.is-complete .lab-order-status-dot{background:#67c23a}.lab-order-status-step.is-complete b{color:var(--success)}.lab-order-status-step.is-cancelled .lab-order-status-dot{background:#f56c6c}.lab-order-status-step.is-cancelled b{color:var(--danger)}
.lab-row-action{display:flex;width:100%;min-width:0;max-width:100%;align-items:stretch}.lab-row-action-pdf{grid-column:9}.lab-row-action-hn{grid-column:10}.lab-row-action-emr{grid-column:11}.lab-patient-row.is-lookup>.lab-row-action-pdf{grid-column:10}.lab-patient-row.is-lookup>.lab-row-action-hn{grid-column:11}.lab-patient-row.is-lookup>.lab-row-action-emr{grid-column:12}.lab-action-placeholder{display:block;width:100%;min-width:0}
.lab-plain-action{width:100%;min-width:0;max-width:100%;margin:0!important;padding:5px 7px!important;font-size:11px;white-space:nowrap}
.lab-order-report{display:block;width:100%;min-width:0;max-width:100%;padding:0!important}
.lab-order-report .el-button{width:100%;min-width:0;max-width:100%;margin:0!important;padding:5px 7px!important;font-size:11px}
.lab-detail-panel{padding:0 10px 14px 42px;border-top:1px solid var(--border-lighter);background:var(--fill-lighter)}.lab-detail-top{display:flex;min-height:42px;align-items:flex-end;gap:16px;border-bottom:1px solid var(--border-light)}.lab-detail-tab{height:42px;padding:0;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--muted);font:inherit;font-size:12px;font-weight:650;cursor:pointer}.lab-detail-tab.is-active{border-bottom-color:var(--primary);color:var(--primary)}.lab-detail-tab:disabled{color:var(--placeholder);cursor:not-allowed}.lab-bulk-actions{display:flex;align-items:center;gap:6px;margin-left:auto;padding-bottom:6px}.lab-bulk-actions .el-button+.el-button{margin-left:0}.lab-receive-tooltip{display:inline-flex}.lab-receive-tooltip .el-button{margin-left:0}
/* ใช้ pattern เดียวกับ X-ray เฉพาะงานภาพ: header ชิด tab, ครบความกว้าง และ checkbox sticky
   โครงคอลัมน์/การเลือก specimen/LAB NO. ของ LAB ไม่เปลี่ยน */
.lab-item-grid-wrap{overflow-x:auto;margin-left:-42px;padding-top:0}.lab-item-grid{display:grid;grid-template-columns:42px 52px 100px minmax(190px,1.5fr) minmax(170px,1.1fr) minmax(190px,1.1fr) 125px 86px minmax(115px,.9fr) minmax(105px,.8fr) 96px;gap:10px;align-items:center;min-width:1371px;padding:6px 0}.lab-item-grid.is-microbiology{grid-template-columns:42px 52px 100px minmax(190px,1.5fr) minmax(170px,1.1fr) minmax(190px,1.1fr) 125px 86px minmax(115px,.9fr) minmax(105px,.8fr) 82px 96px;min-width:1463px}.lab-item-head{min-height:44px;color:var(--ink);font-size:11px;font-weight:650;border-top:1px solid var(--el-color-primary-light-7,#c6e2ff);border-bottom:1px solid var(--el-color-primary-light-7,#c6e2ff);background:var(--primary-50)}.lab-item-row{min-height:52px;border-bottom:1px dashed var(--border-lighter);font-size:12px;transition:background-color .12s}.lab-item-row:last-child{border-bottom:0}.lab-item-row.is-selectable{cursor:pointer}.lab-item-row.is-selectable:hover{background:var(--fill-light)}.lab-item-row.is-selected,.lab-item-row.is-selected:hover{background:var(--primary-50)}.lab-item-check-cell{position:sticky;left:0;z-index:2;align-self:stretch;display:flex;align-items:center;padding-left:12px;background:var(--fill-lighter);box-shadow:1px 0 0 var(--border-lighter)}.lab-item-head>.lab-item-check-cell{z-index:3;background:var(--primary-50);box-shadow:1px 0 0 var(--el-color-primary-light-7,#c6e2ff)}.lab-item-row.is-selectable:hover>.lab-item-check-cell{background:var(--fill-light)}.lab-item-row.is-selected>.lab-item-check-cell,.lab-item-row.is-selected:hover>.lab-item-check-cell{background:var(--primary-50)}.lab-test-name{color:var(--ink);font-weight:650}.lab-item-specimen-cell{padding-right:8px;transform:translateX(-8px)}.lab-specimen-select{width:100%}.lab-specimen-select .el-select__wrapper{min-height:30px}.lab-specimen-locked .el-input__wrapper{min-height:30px;background:var(--white);box-shadow:0 0 0 1px var(--border) inset;cursor:default}.lab-specimen-select .el-select__selected-item{color:var(--text);font-weight:700}.lab-specimen-locked .el-input__inner{color:var(--text);font-weight:700;-webkit-text-fill-color:var(--text);cursor:default}.lab-specimen-select.lab-specimen-changed .el-select__selected-item{color:var(--danger);font-weight:700}.lab-item-collected-time,.lab-item-received-time{min-width:0}.lab-collected-date-time span,.lab-received-date-time span{display:block;font-weight:400;line-height:1.35}.lab-specimen-storage{display:inline-flex;max-width:100%;min-height:19px;align-items:center;margin-top:4px;padding:1px 7px;border:1px solid var(--border);border-radius:999px;background:var(--fill-light);color:var(--text);font-size:10px;font-weight:700;line-height:1.4;white-space:nowrap}.lab-specimen-storage.is-immediate{border-color:var(--el-color-success-light-5,#b3e19d);background:var(--success-50);color:var(--el-color-success-dark-2,#529b2e)}.lab-specimen-storage.is-refrigerated{border-color:var(--el-color-primary-light-5,#a0cfff);background:var(--primary-50);color:var(--primary)}.lab-specimen-storage.is-room-temperature{border-color:var(--el-color-warning-light-5,#f3d19e);background:var(--warning-50);color:var(--el-color-warning-dark-2,#b88230)}.lab-specimen-source-line{display:grid;min-width:0;grid-template-columns:max-content minmax(0,1fr);gap:4px;align-items:center;margin-top:4px;color:var(--muted);font-family:"Leelawadee UI","Noto Sans Thai",Tahoma,"Segoe UI",sans-serif;font-size:10px}.lab-specimen-source-label{white-space:nowrap}.lab-specimen-source{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:help}.lab-specimen-source.is-empty{color:var(--placeholder);font-style:italic;cursor:default}.lab-cpoe-source-popper{max-width:420px;overflow-wrap:anywhere;white-space:normal}.lab-item-row [data-label]:before{display:none}
/* แท็บออกผลใช้ขนาด/สีเดียวกับ tab order แต่เว้น gutter 42px โดยไม่มี checkbox */
.lab-result-list{padding-top:0;overflow-x:auto;margin-left:-42px}.lab-result-list-head,.lab-result-list-row{display:grid;grid-template-columns:52px minmax(260px,1.8fr) 130px 120px minmax(120px,.8fr) minmax(140px,.85fr) minmax(140px,.85fr);gap:12px;align-items:center;min-width:1060px;padding:6px 0 6px 42px}.lab-result-list-head{min-height:44px;border-top:1px solid var(--el-color-primary-light-7,#c6e2ff);border-bottom:1px solid var(--el-color-primary-light-7,#c6e2ff);background:var(--primary-50);color:var(--ink);font-size:11px;font-weight:650}.lab-result-list-row{min-height:52px;border-bottom:1px dashed var(--border-lighter)}.lab-result-list-status{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.lab-result-actor{min-width:0;overflow:hidden;color:var(--text);text-overflow:ellipsis;white-space:nowrap}.lab-critical-status{display:inline-flex;min-height:26px;align-items:center;padding:2px 8px;border:1px solid;border-radius:4px;font-size:11px;font-weight:650;white-space:nowrap}.lab-critical-status.is-critical{border-color:var(--el-color-danger-light-5,#fab6b6);background:var(--danger-50);color:var(--danger)}.lab-critical-status.is-normal,.lab-critical-status.is-resulted{border-color:var(--el-color-success-light-5,#b3e19d);background:var(--success-50);color:var(--success)}.lab-critical-status.is-pending{border-color:var(--el-border-color-darker,#c8c9cc);background:var(--fill);color:var(--muted)}.lab-result-hidden-tag{display:inline-flex;min-height:22px;align-items:center;padding:1px 7px;border:1px solid var(--el-color-warning-light-5,#f3d19e);border-radius:999px;background:var(--warning-50);color:var(--warning);font-size:10px;font-weight:700;white-space:nowrap}
.lab-result-list.is-lookup .lab-result-list-head,.lab-result-list.is-lookup .lab-result-list-row{grid-template-columns:52px minmax(300px,2fr) 130px minmax(140px,.9fr) minmax(140px,.85fr) minmax(140px,.85fr);min-width:970px}
.lab-result-list.is-microbiology .lab-result-list-head,.lab-result-list.is-microbiology .lab-result-list-row{grid-template-columns:52px minmax(240px,1.6fr) 120px 120px minmax(120px,.8fr) minmax(130px,.8fr) minmax(130px,.8fr) 82px;min-width:1122px}.lab-result-list.is-microbiology.is-lookup .lab-result-list-head,.lab-result-list.is-microbiology.is-lookup .lab-result-list-row{grid-template-columns:52px minmax(280px,1.8fr) 120px minmax(140px,.9fr) minmax(130px,.8fr) minmax(130px,.8fr) 82px;min-width:1032px}.lab-result-test-action{display:flex;align-items:center;justify-content:flex-start}.lab-mb-order-result-entry{display:flex;align-items:center;justify-content:flex-start}.lab-result-test-action .el-button,.lab-mb-order-result-entry .el-button{min-width:70px;margin:0}.lab-mb-order-result-entry>div{display:block;width:70px}.lab-mb-order-result-entry>div .el-button{width:100%}
.lab-cancel-summary{display:grid;gap:6px;margin-bottom:12px;padding:13px 14px;border:1px solid #fab6b6;border-radius:6px;background:#fef0f0;color:#c45656}.lab-cancel-summary strong{color:var(--ink)}.lab-cancel-summary span{font-size:12px;line-height:1.5}.lab-cancel-finance{display:grid;gap:6px;margin-bottom:14px;padding:12px 14px;border:1px solid var(--border-light);border-radius:6px;background:var(--fill-lighter);color:var(--text)}.lab-cancel-finance strong{color:var(--ink)}.lab-cancel-finance span{font-size:12px;line-height:1.5}.lab-cancel-finance.is-checking{border-color:var(--el-color-primary-light-5,#a0cfff);background:var(--primary-50);color:var(--primary)}.lab-cancel-finance.is-ready{border-color:var(--el-color-success-light-5,#b3e19d);background:var(--success-50);color:var(--el-color-success-dark-2,#529b2e)}.lab-cancel-finance.is-blocked{border-color:var(--el-color-warning-light-5,#f3d19e);background:var(--warning-50);color:#b88230}.lab-cancel-finance .el-button{justify-self:start;margin:4px 0 0}.lab-cancel-reason{display:block}.lab-cancel-reason>span{display:block;margin-bottom:6px;color:var(--ink);font-weight:650}.lab-cancel-reason b{color:var(--danger)}.lab-cancel-reason .el-select{width:100%}
.lab-result-comment{grid-column:3/-1;display:grid;gap:3px;align-self:stretch;padding:0 10px 10px!important}.lab-result-comment>span{display:block;margin:0;color:var(--muted);font-size:10px;font-weight:700}.lab-result-comment>p{margin:0;padding:8px 10px;border-left:3px solid var(--primary);border-radius:4px;background:var(--primary-50);color:var(--text);font-size:12px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
.lab-result-revision-view{display:grid;grid-template-columns:260px minmax(0,1fr);min-height:420px;overflow:hidden;border:1px solid var(--border);border-radius:8px;background:var(--fill-lighter)}.lab-result-revision-rail{display:flex;flex-direction:column;border-right:1px solid var(--border);background:var(--fill-light)}.lab-result-revision-rail>strong{padding:14px 16px 10px;color:var(--muted);font-size:10px;letter-spacing:.04em}.lab-result-revision-rail>button{display:grid;gap:3px;padding:12px 16px;border:0;border-top:1px solid var(--border);background:transparent;color:var(--text);font:inherit;text-align:left;cursor:pointer}.lab-result-revision-rail>button.is-active{background:var(--primary-50);box-shadow:inset 3px 0 var(--primary)}.lab-result-revision-rail>button span{color:var(--ink);font-size:12px;font-weight:750}.lab-result-revision-rail>button small{color:var(--muted);font-size:10px}.lab-result-revision-rail>button i{justify-self:start;padding:1px 6px;border:1px solid var(--border);border-radius:999px;color:var(--muted);font-size:9px;font-style:normal}.lab-result-revision-rail>button.is-active i{border-color:#b3e19d;background:#f0f9eb;color:#529b2e}.lab-result-revision-sheet{display:grid;align-content:start;min-width:0;padding:16px}.lab-result-revision-sheet>header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.lab-result-revision-sheet>header>div{display:grid;gap:3px}.lab-result-revision-sheet>header strong{color:var(--ink);font-size:15px}.lab-result-revision-sheet>header small{color:var(--muted);font-size:10px}.lab-result-revision-sheet>header>span{padding:3px 8px;border:1px solid var(--border);border-radius:999px;color:var(--text);font-size:10px;font-weight:750}.lab-result-revision-warning{margin-top:12px;padding:9px 11px;border:1px solid #f3d19e;border-radius:6px;background:#fdf6ec;color:#b88230;font-size:11px;font-weight:650}.lab-result-revision-table{margin-top:12px;overflow-x:auto;border:1px solid var(--border);border-radius:7px}.lab-result-revision-head,.lab-result-revision-row{display:grid;grid-template-columns:42px minmax(220px,1fr) minmax(130px,.75fr) minmax(110px,.65fr) 80px;min-width:720px;align-items:center}.lab-result-revision-head{min-height:38px;background:var(--fill-light);color:var(--muted);font-size:10px;font-weight:700}.lab-result-revision-head>span,.lab-result-revision-row>span,.lab-result-revision-row>strong{padding:9px 10px}.lab-result-revision-row{min-height:48px;border-top:1px solid var(--border);background:#fff;color:var(--text);font-size:11px}.lab-result-revision-row.is-changed{background:#fffaf0}.lab-result-revision-row>span:nth-child(2){display:grid;gap:2px}.lab-result-revision-row>span:nth-child(2)>strong{color:var(--ink);font-size:12px}.lab-result-revision-row small{color:var(--muted);font-size:9px}.lab-result-revision-row.is-changed>span:last-child,.lab-result-revision-row.is-changed>strong{color:#b88230}.lab-result-revision-sheet>footer{display:grid;grid-template-columns:auto minmax(0,1fr) auto minmax(0,1fr);gap:5px 9px;margin-top:12px;padding:10px;border-radius:6px;background:var(--fill-light);font-size:9px}.lab-result-revision-sheet>footer span{color:var(--muted)}.lab-result-revision-sheet>footer strong{overflow:hidden;color:var(--text);text-overflow:ellipsis;white-space:nowrap}.lab-correction-reason{display:grid;gap:6px;margin-top:12px;padding:12px;border:1px solid #f3d19e;border-radius:7px;background:#fdf6ec}.lab-correction-reason>span{color:var(--ink);font-size:12px;font-weight:700}.lab-correction-reason>span b{color:var(--danger)}.lab-correction-reason>small{color:var(--muted);font-size:10px}
.lab-manual-form{min-height:300px}.lab-result-viewer{color:var(--text)}.lab-result-critical-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;padding:10px 13px;border:1px solid #fab6b6;border-radius:7px;background:#fef0f0;color:#c45656}.lab-result-critical-banner span{font-size:11px}.lab-result-patient-card{display:grid;grid-template-columns:52px minmax(190px,1.35fr) repeat(3,minmax(108px,.7fr));gap:13px 16px;align-items:center;padding:15px;border:1px solid var(--border-light);border-radius:8px;background:var(--fill-lighter)}.lab-result-avatar{display:grid;width:44px;height:44px;grid-row:1/3;place-items:center;border-radius:50%;background:#ecf5ff;color:#337ecc;font-size:13px;font-weight:750}.lab-result-patient-main{min-width:0}.lab-result-patient-main span,.lab-result-meta span,.lab-manual-fields label>span,.lab-result-value-row>div>span{display:block;margin-bottom:4px;color:var(--muted);font-size:11px;font-weight:650}.lab-result-patient-main strong{display:block;overflow:hidden;color:var(--ink);font-size:16px;text-overflow:ellipsis;white-space:nowrap}.lab-result-patient-main small{display:block;margin-top:3px;color:var(--muted);font-size:11px}.lab-result-meta{min-width:0}.lab-result-meta strong{display:block;overflow:hidden;color:var(--ink);font-size:12px;text-overflow:ellipsis;white-space:nowrap}.lab-result-dialog-action{position:relative;padding-right:42px}.lab-result-dialog-action>.el-button{position:absolute;top:0;right:0}.lab-result-section-head{display:flex;align-items:center;justify-content:space-between;margin-top:17px;padding-bottom:8px}.lab-result-section-head strong{color:var(--ink);font-size:14px}.lab-result-section-head span{color:var(--warning);font-size:11px}.lab-result-values{border:1px solid var(--border-light);border-radius:7px;overflow-x:auto}.lab-result-value-head,.lab-result-value-row{display:grid;grid-template-columns:90px minmax(180px,1.45fr) minmax(110px,.8fr) minmax(115px,.8fr) 80px minmax(105px,.8fr) minmax(130px,1fr);gap:12px;min-width:940px;padding:10px 12px}.lab-result-value-head{border-bottom:1px solid var(--border);background:var(--fill);color:var(--muted);font-size:11px;font-weight:700}.lab-result-value-row{align-items:center;border-bottom:1px solid var(--border-lighter)}.lab-result-value-row:last-child{border-bottom:0}.lab-result-value-row>div{min-width:0}.lab-result-value-row strong,.lab-result-value-row small{display:block;overflow-wrap:anywhere}.lab-result-value-row small{margin-top:2px;color:var(--muted);font-size:10px}.lab-result-measured{color:var(--primary);font-size:17px}.lab-result-previous{padding:7px 9px;border-radius:5px;background:var(--fill-light)}.lab-critical-value{color:var(--danger)!important}.lab-previous-result{margin:12px 0;padding:10px 12px;border:1px solid #b3d8ff;border-radius:6px;background:#ecf5ff;color:#337ecc}.lab-previous-result.is-empty{border-color:var(--border-light);background:var(--fill-light);color:var(--muted)}.lab-manual-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.lab-manual-fields label{display:block;min-width:0}.lab-manual-fields .el-select{width:100%}.lab-manual-hint{margin-top:9px;color:var(--muted);font-size:11px}
.lab-result-dialog .el-dialog__body{max-height:calc(100vh - 190px);overflow:auto}.lab-result-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding-right:28px}.lab-result-dialog-head>div:first-child{display:grid;gap:3px}.lab-result-dialog-head strong{color:var(--ink);font-size:18px}.lab-result-dialog-head small{color:var(--muted);font-size:12px}.lab-result-dialog-tools{display:flex;align-items:center;gap:9px}.lab-result-edit-button svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.lab-result-mode{display:inline-flex;min-height:25px;align-items:center;padding:2px 9px;border:1px solid var(--border);border-radius:999px;background:var(--fill-light);color:var(--muted);font-size:11px;font-weight:650;white-space:nowrap}.lab-result-mode.is-editing{border-color:#a0cfff;background:#ecf5ff;color:#337ecc}.lab-result-visibility-button{margin-left:auto!important}.lab-result-hidden-notice{display:grid;gap:3px;margin-bottom:12px;padding:10px 12px;border:1px solid #f3d19e;border-radius:7px;background:#fdf6ec;color:#b88230}.lab-result-hidden-notice strong{color:#b88230}.lab-result-hidden-notice span{font-size:12px}.lab-result-hidden-notice small{color:var(--muted);font-size:11px}.lab-visibility-summary{display:grid;gap:6px;margin-bottom:14px;padding:13px 14px;border:1px solid var(--el-color-warning-light-5,#f3d19e);border-radius:7px;background:var(--el-color-warning-light-9,#fdf6ec);color:var(--el-text-color-regular,#606266)}.lab-visibility-summary strong{color:var(--el-text-color-primary,#303133)}.lab-visibility-summary span{color:var(--el-text-color-regular,#606266);font-size:12px;line-height:1.5}.lab-visibility-summary .is-critical{color:var(--el-color-danger,#f56c6c);font-weight:650}.lab-visibility-reason{display:block}.lab-visibility-reason>span{display:block;margin-bottom:6px;color:var(--ink);font-weight:650}.lab-visibility-reason b{color:var(--danger)}.lab-result-value-head,.lab-result-value-row{grid-template-columns:56px 48px minmax(180px,1fr) 132px 132px 94px 104px 188px;min-width:940px}.lab-result-value-row .el-select{width:100%}.lab-result-signal{display:block;width:10px;height:10px;margin-left:7px;border:1px solid;border-radius:50%}.lab-result-signal.is-normal{border-color:#4e9631;background:#2f761e;box-shadow:0 0 0 3px rgba(103,194,58,.10)}.lab-result-signal.is-critical{border-color:#d46a6a;background:#b84d4d;box-shadow:0 0 0 3px rgba(245,108,108,.12)}.lab-result-attachments{display:grid;gap:10px;margin-top:16px;padding:14px;border:1px solid var(--border-light);border-radius:7px;background:var(--fill-lighter)}.lab-result-attachments-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.lab-result-attachments-head>div{display:grid;gap:3px}.lab-result-attachments-head strong{color:var(--ink);font-size:14px}.lab-result-attachments-head small,.lab-result-upload-note{color:var(--muted);font-size:11px}.lab-result-attachments-head>span{color:var(--muted);font-size:11px}.lab-result-file-list{display:grid;gap:6px}.lab-result-file{display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--border-light);border-radius:6px;background:var(--white);color:var(--text);text-decoration:none}.lab-result-file:hover{border-color:#a0cfff;color:#337ecc}.lab-result-file>span{color:#337ecc;font-size:10px;font-weight:700}.lab-result-file>strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lab-result-file>small{color:var(--muted);font-size:10px}.lab-result-upload .el-upload{display:inline-flex}
.lab-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}.lab-result-dialog .el-dialog__header{margin:0;padding:15px 18px;border-bottom:1px solid var(--border-lighter)}.lab-result-dialog .el-dialog__headerbtn{top:9px;right:10px}.lab-result-dialog .el-dialog__body{max-height:calc(100vh - 160px);padding:18px;overflow:auto;overscroll-behavior:contain}.lab-result-dialog .el-dialog__footer{padding:12px 18px;border-top:1px solid var(--border-lighter)}.lab-result-dialog-head{display:block;padding-right:32px}.lab-result-dialog-head>div:first-child{display:grid;gap:2px}.lab-result-title-row{display:flex;align-items:center;gap:8px}.lab-result-dialog-head strong{font-size:17px}.lab-result-dialog-head small{font-size:11px}.lab-result-edit-button{display:grid;width:28px;height:28px;place-items:center;padding:0;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--muted);cursor:pointer}.lab-result-edit-button:hover:not(:disabled){border-color:#a0cfff;background:#ecf5ff;color:var(--primary)}.lab-result-edit-button[aria-pressed=true]{border-color:var(--primary);background:#ecf5ff;color:var(--primary)}.lab-result-edit-button:disabled{cursor:not-allowed;opacity:.45}.lab-result-edit-button svg{width:15px;height:15px}.lab-result-mode{min-height:20px;margin-left:4px;padding:0 7px;background:var(--fill-lighter);font-size:10px}.lab-result-values{border-color:var(--border);border-radius:7px}.lab-result-value-head,.lab-result-value-row{grid-template-columns:56px 48px minmax(180px,1fr) 132px 132px 94px 104px 188px;gap:0;min-width:940px;padding:0}.lab-result-value-head{min-height:42px;align-items:center;background:var(--fill-soft)}.lab-result-value-head>span,.lab-result-value-row>div{box-sizing:border-box;padding:10px}.lab-result-value-row{min-height:46px;align-items:start}.lab-result-profile-row{display:flex;min-width:940px;min-height:40px;align-items:center;padding:5px 10px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--fill-light)}.lab-result-value-head+.lab-result-profile-row{border-top:0}.lab-result-profile-row strong{color:var(--ink);font-size:13px}.lab-result-test-name{color:var(--ink);font-weight:650}.lab-result-previous{padding:10px!important;border-radius:0;background:transparent;color:var(--muted)}.lab-result-measured{color:var(--ink);font-size:inherit;font-weight:700}.lab-result-value-row .el-input,.lab-result-value-row .el-select{width:100%}
.lab-micro-source-tag{display:inline-flex;min-height:22px;align-items:center;padding:1px 8px;border:1px solid var(--el-color-primary-light-5,#a0cfff);border-radius:999px;background:var(--primary-50);color:var(--primary);font-size:10px;font-weight:700}.lab-result-dialog.is-microbiology .lab-result-dialog-head small{margin-top:2px}.lab-micro-patient-strip{display:grid;grid-template-columns:minmax(270px,1.45fr) repeat(3,minmax(130px,1fr));gap:12px;padding:13px 15px;border:1px solid var(--border-light);border-radius:8px;background:var(--fill-lighter)}.lab-micro-patient-main{display:flex;min-width:0;align-items:center;gap:11px}.lab-micro-avatar{display:grid;width:40px;height:40px;flex:0 0 40px;place-items:center;border-radius:50%;background:var(--primary);color:#fff;font-size:12px;font-weight:800}.lab-micro-patient-main>div{min-width:0}.lab-micro-patient-main strong{display:block;overflow:hidden;color:var(--ink);text-overflow:ellipsis;white-space:nowrap}.lab-micro-patient-main small{display:block;margin-top:3px;color:var(--muted);font-size:10px}.lab-micro-meta{min-width:0}.lab-micro-meta>span,.lab-micro-timeline span,.lab-micro-summary-grid span{display:block;margin-bottom:4px;color:var(--muted);font-size:10px}.lab-micro-meta>strong,.lab-micro-timeline strong,.lab-micro-summary-grid strong{display:block;overflow:hidden;color:var(--ink);font-size:12px;text-overflow:ellipsis;white-space:nowrap}.lab-micro-status{display:inline-flex;min-height:22px;align-items:center;padding:1px 8px;border:1px solid var(--border);border-radius:999px;background:var(--fill);color:var(--muted);font-size:10px;font-style:normal;font-weight:750;white-space:nowrap}.lab-micro-status.is-final{border-color:var(--el-color-success-light-5,#b3e19d);background:var(--success-50);color:var(--success)}.lab-micro-status.is-partial{border-color:var(--el-color-warning-light-5,#f3d19e);background:var(--warning-50);color:var(--warning)}.lab-micro-status.is-pending{border-color:var(--el-border-color-darker,#c8c9cc);background:var(--fill);color:var(--muted)}.lab-micro-timeline{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}.lab-micro-timeline>div,.lab-micro-summary-grid>div{min-width:0;padding:10px 12px;border:1px solid var(--border-light);border-radius:7px;background:var(--white)}.lab-micro-notice{display:flex;align-items:flex-start;gap:10px;margin-top:12px;padding:9px 11px;border:1px solid var(--el-color-primary-light-5,#a0cfff);border-radius:7px;background:var(--primary-50);color:var(--primary);font-size:11px;line-height:1.5}.lab-micro-notice strong{white-space:nowrap}.lab-micro-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:15px;padding-bottom:8px}.lab-micro-section-head strong{color:var(--ink);font-size:14px}.lab-micro-section-head span{color:var(--muted);font-size:11px}.lab-micro-results{display:grid;gap:10px}.lab-micro-result-card{overflow:hidden;border:1px solid var(--border);border-radius:9px;background:var(--white)}.lab-micro-result-card.is-open{border-color:var(--el-color-primary-light-5,#a0cfff)}.lab-micro-result-head{width:100%;display:grid;grid-template-columns:32px minmax(220px,1.4fr) minmax(175px,.9fr) auto 24px;gap:12px;align-items:center;padding:11px 13px;border:0;background:var(--white);color:var(--text);text-align:left;cursor:pointer}.lab-micro-result-card.is-open .lab-micro-result-head{background:var(--primary-50)}.lab-micro-result-head>span:nth-child(2){min-width:0}.lab-micro-result-head>span:nth-child(2)>strong{display:block;overflow:hidden;color:var(--ink);font-size:13px;text-overflow:ellipsis;white-space:nowrap}.lab-micro-result-head small{display:block;color:var(--muted);font-size:10px}.lab-micro-chevron{color:var(--muted);font-size:16px;transition:transform .15s}.lab-micro-result-card.is-open .lab-micro-chevron{transform:rotate(180deg)}.lab-micro-result-body{padding:0 13px 13px 57px;background:var(--primary-50)}.lab-micro-summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.lab-micro-organism{margin-top:10px;overflow:hidden;border:1px solid var(--border-light);border-radius:8px;background:var(--white)}.lab-micro-organism>header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-bottom:1px solid var(--border-lighter)}.lab-micro-organism>header small{display:block;margin-bottom:2px;color:var(--muted);font-size:10px}.lab-micro-organism>header strong{display:block;color:var(--ink);font-size:13px;overflow-wrap:anywhere}.lab-micro-count{display:inline-flex;min-height:22px;align-items:center;padding:1px 7px;border:1px solid var(--el-color-danger-light-5,#fab6b6);border-radius:999px;background:var(--danger-50);color:var(--danger);font-size:10px;font-weight:700;white-space:nowrap}.lab-micro-sir-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;background:var(--fill-lighter);color:var(--muted);font-size:10px}.lab-micro-sir-toolbar>div{display:flex;gap:4px}.lab-micro-sir-toolbar button{min-width:29px;height:25px;padding:0 7px;border:1px solid var(--border);border-radius:5px;background:var(--white);color:var(--muted);font:inherit;font-weight:700;cursor:pointer}.lab-micro-sir-toolbar button.is-active{border-color:var(--primary);background:var(--primary);color:#fff}.lab-micro-table-wrap{overflow-x:auto}.lab-micro-table-head,.lab-micro-table-row{display:grid;grid-template-columns:minmax(220px,1fr) 150px 70px;align-items:center;min-width:500px}.lab-micro-table-head{background:var(--fill-light);color:var(--muted);font-size:10px;font-weight:700}.lab-micro-table-head>span,.lab-micro-table-row>*{padding:8px 11px}.lab-micro-table-row{border-top:1px solid var(--border-lighter);font-size:11px}.lab-micro-table-row strong{color:var(--ink)}.lab-micro-sir{display:grid;width:27px;height:23px;margin-left:11px;place-items:center;border-radius:5px;font-style:normal;font-weight:800}.lab-micro-sir.is-s{background:var(--success-50);color:var(--success)}.lab-micro-sir.is-i{background:var(--warning-50);color:var(--warning)}.lab-micro-sir.is-r{background:var(--danger-50);color:var(--danger)}.lab-micro-empty-filter{padding:13px;text-align:center;color:var(--muted);font-size:11px}.lab-micro-raw{margin-top:10px}.lab-micro-raw>button{width:100%;display:flex;align-items:center;justify-content:space-between;padding:9px 11px;border:1px solid var(--border-light);border-radius:7px;background:var(--white);color:var(--ink);font:inherit;font-size:11px;font-weight:650;cursor:pointer}.lab-micro-raw.is-open>button{border-radius:7px 7px 0 0}.lab-micro-raw pre{max-height:260px;margin:0;padding:12px;overflow:auto;border:1px solid var(--border-light);border-top:0;border-radius:0 0 7px 7px;background:var(--fill-lighter);color:var(--text);font:11px/1.6 var(--mono);white-space:pre-wrap}.lab-micro-pending{display:flex;align-items:center;gap:11px;padding:14px;border:1px dashed var(--border);border-radius:7px;background:var(--white);color:var(--muted)}.lab-micro-pending>span{font-size:18px}.lab-micro-pending strong,.lab-micro-pending small{display:block}.lab-micro-pending strong{color:var(--ink);font-size:12px}.lab-micro-pending small{margin-top:3px;font-size:10px}
.lab-micro-organism-list{display:grid;gap:3px;margin:0;padding-left:20px;color:var(--ink);font-size:13px;font-weight:700}.lab-micro-organism-list li{padding-left:2px;overflow-wrap:anywhere}
.lab-micro-timeline{grid-template-columns:repeat(3,1fr)}.lab-micro-critical-tag{display:inline-flex;width:max-content;min-height:22px;align-items:center;margin-top:4px;padding:1px 8px;border:1px solid var(--el-color-danger-light-5,#fab6b6);border-radius:999px;background:var(--danger-50);color:var(--danger);font-size:10px;font-style:normal;font-weight:750;white-space:nowrap}.lab-result-title-row>.lab-micro-critical-tag{margin-top:0}.lab-result-dialog.is-microbiology .lab-result-critical-banner{margin-top:12px;margin-bottom:0}.lab-micro-wire-results{display:grid;gap:10px}.lab-micro-wire-result{overflow:hidden;border:1px solid var(--border-light);border-radius:8px;background:var(--white)}.lab-micro-wire-meta{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:0;border-bottom:1px solid var(--border-lighter);background:var(--fill-lighter)}.lab-micro-wire-meta>div{min-width:0;padding:9px 11px;border-right:1px solid var(--border-lighter)}.lab-micro-wire-meta>div:last-child{border-right:0}.lab-micro-wire-meta span{display:block;margin-bottom:3px;color:var(--muted);font-size:10px}.lab-micro-wire-meta strong{display:block;overflow:hidden;color:var(--ink);font-size:11px;text-overflow:ellipsis;white-space:nowrap}.lab-micro-wire-value>strong{display:block;padding:9px 11px 0;color:var(--ink);font-size:11px}.lab-micro-wire-value pre{max-height:360px;margin:0;padding:10px 11px 12px;overflow:auto;color:var(--text);font:11px/1.6 var(--mono);white-space:pre-wrap;overflow-wrap:anywhere}
.lab-micro-unmatched{margin-top:14px;overflow:hidden;border:1px solid var(--border-light);border-radius:8px;background:var(--white)}.lab-micro-unmatched-head{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;padding:11px 13px;border:0;border-bottom:1px solid var(--border-light);background:transparent;color:var(--ink);cursor:pointer;text-align:left}.lab-micro-unmatched-head strong{font-size:13px}.lab-micro-unmatched-head span{color:var(--muted);font-size:11px}.lab-micro-unmatched pre{max-height:480px;margin:0;padding:14px;overflow:auto;background:var(--fill-lighter);color:var(--text);font:12px/1.65 var(--mono);white-space:pre;tab-size:4}
.lab-result-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.lab-result-dialog-head>div:first-child{min-width:0}.lab-result-report-slot{display:flex;width:94px;min-width:94px;max-width:94px;flex:0 0 94px;align-items:flex-start;justify-content:flex-end}.lab-result-report-action{flex:none;margin-right:4px}.lab-result-report-action .el-button,.el-button.lab-result-report-action{min-width:94px;margin:0!important}.lab-result-report-action .el-button:not(.is-disabled){border-color:var(--danger)!important;background:var(--danger)!important;color:#fff!important}
.lab-result-byline{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:4px;color:var(--muted);font-size:11px}.lab-result-byline b{font-weight:500}.lab-result-byline strong{color:var(--ink);font-size:11px}.lab-result-profile-row{display:grid;width:100%;grid-template-columns:56px 48px minmax(180px,1fr) 132px 132px 94px 104px 188px;gap:0;min-width:940px;min-height:44px;align-items:center;padding:0;border:0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--fill-light);color:var(--ink);font:inherit;text-align:left;cursor:pointer}.lab-result-value-head+.lab-result-profile-row{border-top:0}.lab-result-profile-index{grid-column:1;padding:10px}.lab-result-profile-main{display:grid;grid-column:3/8;gap:1px;padding:10px}.lab-result-profile-row strong{color:var(--ink);font-size:13px}.lab-result-profile-row small{color:var(--muted);font-size:10px}.lab-result-profile-row i{grid-column:8;justify-self:end;margin-right:10px;color:var(--muted);font-size:16px;font-style:normal;transition:transform .15s}.lab-result-profile-row.is-open i{transform:rotate(180deg)}.lab-result-profile-row:hover{background:var(--primary-50)}
.lab-result-order-note{display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:10px;align-items:start;margin:12px 0;padding:11px 13px;border:1px solid var(--el-color-warning-light-5,#f3d19e);border-radius:8px;background:var(--el-color-warning-light-9,#fdf6ec);color:var(--el-text-color-regular,#606266)}.lab-result-order-note-icon{display:grid;width:24px;height:24px;place-items:center;border-radius:50%;background:var(--el-color-warning,#e6a23c);color:#fff;font:700 13px/1 Arial,sans-serif}.lab-result-order-note>div{min-width:0}.lab-result-order-note strong{display:block;color:var(--el-text-color-primary,#303133);font-size:12px}.lab-result-order-note p{margin:3px 0 0;color:var(--el-text-color-regular,#606266);font-size:12px;line-height:1.6;overflow-wrap:anywhere;white-space:pre-wrap}.lab-result-order-note-key{align-self:center;padding:2px 7px;border:1px solid var(--el-color-warning-light-5,#f3d19e);border-radius:999px;background:var(--el-bg-color,#fff);color:var(--el-text-color-secondary,#909399);font:10px/1.5 var(--mono)}
.lab-result-profile-toolbar{display:flex;align-items:center;gap:10px;margin:0 0 9px}.lab-result-profile-toolbar>div:first-child{display:flex;min-width:0;align-items:baseline;gap:10px}.lab-result-profile-toolbar>div:first-child>strong{color:var(--ink);font-size:15px}.lab-result-profile-toolbar>div:first-child>small{color:var(--muted);font-size:11px}.lab-result-section-actions{display:flex;align-items:center;gap:2px;margin-left:auto}.lab-result-section-actions .el-button+.el-button{margin-left:0}.lab-result-value-row.is-profile-child{padding-left:16px}
.lab-result-dialog:not(.is-microbiology){--lab-result-surface:var(--el-bg-color,#fff);--lab-result-surface-soft:#f7f9fc;--lab-result-surface-blue:#f2f7ff;--lab-result-ink:var(--el-text-color-primary,#303133);--lab-result-text:var(--el-text-color-regular,#606266);--lab-result-muted:var(--el-text-color-secondary,#909399);--lab-result-border:var(--el-border-color,#dcdfe6);--lab-result-border-light:var(--el-border-color-light,#e4e7ed);--lab-result-primary-dark:#337ecc;max-height:calc(100vh - 48px);overflow:hidden;border:1px solid rgba(255,255,255,.65);border-radius:12px;background:var(--lab-result-surface);color:var(--lab-result-text);box-shadow:0 24px 72px rgba(31,45,61,.22);font-family:"Noto Sans Thai","Leelawadee UI",Tahoma,Arial,sans-serif;font-size:13px}.lab-result-dialog:not(.is-microbiology) .el-dialog__header{margin:0;padding:16px 20px 14px;border-bottom:1px solid var(--lab-result-border-light)}.lab-result-dialog:not(.is-microbiology) .el-dialog__headerbtn{top:10px;right:10px;width:34px;height:34px}.lab-result-dialog:not(.is-microbiology) .el-dialog__body{max-height:calc(100vh - 160px);padding:16px 20px 20px;overflow:auto}.lab-result-dialog:not(.is-microbiology) .el-dialog__footer{padding:11px 20px;border-top:1px solid var(--lab-result-border-light);background:var(--lab-result-surface-soft)}.lab-result-dialog:not(.is-microbiology) .lab-result-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding-right:42px}.lab-result-dialog:not(.is-microbiology) .lab-result-title-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.lab-result-dialog:not(.is-microbiology) .lab-result-dialog-head>div:first-child{display:block;min-width:0}.lab-result-dialog:not(.is-microbiology) .lab-result-dialog-head>div:first-child>.lab-result-title-row>strong{color:var(--lab-result-ink);font-size:20px;line-height:1.25}.lab-result-dialog:not(.is-microbiology) .lab-result-dialog-head>div:first-child>small{display:block;margin-top:5px;color:var(--lab-result-muted);font-size:12px}.lab-result-dialog:not(.is-microbiology) .lab-result-mode{min-height:23px;margin-left:0;padding:2px 8px;border:1px solid #a0cfff;border-radius:999px;background:#ecf5ff;color:var(--lab-result-primary-dark);font-size:10px;font-weight:700}.lab-result-dialog:not(.is-microbiology) .lab-result-byline{gap:6px 14px;margin-top:7px;color:var(--lab-result-text);font-size:11px}.lab-result-dialog:not(.is-microbiology) .lab-result-byline span{display:inline-flex;align-items:baseline;gap:4px}.lab-result-dialog:not(.is-microbiology) .lab-result-byline b{color:var(--lab-result-muted);font-size:10px;font-weight:650}.lab-result-dialog:not(.is-microbiology) .lab-result-byline strong{color:var(--lab-result-ink);font-size:11px}.lab-result-dialog:not(.is-microbiology) .lab-result-report-action{flex:none;margin:0 42px 0 0!important}.lab-result-dialog:not(.is-microbiology) .lab-result-report-action .el-button,.lab-result-dialog:not(.is-microbiology) .el-button.lab-result-report-action{min-width:94px;min-height:34px;margin:0!important;padding:6px 14px;border-radius:6px}.lab-result-dialog:not(.is-microbiology) .lab-result-report-action .el-button:not(.is-disabled),.lab-result-dialog:not(.is-microbiology) .el-button.lab-result-report-action:not(.is-disabled){border-color:var(--lab-result-border)!important;background:var(--lab-result-surface)!important;color:var(--lab-result-text)!important}.lab-result-dialog:not(.is-microbiology) .lab-result-report-action .el-button:not(.is-disabled):hover,.lab-result-dialog:not(.is-microbiology) .el-button.lab-result-report-action:not(.is-disabled):hover{border-color:#a0cfff!important;color:var(--lab-result-primary-dark)!important}.lab-result-dialog:not(.is-microbiology) .lab-result-profile-toolbar{margin:18px 0 9px}.lab-result-dialog:not(.is-microbiology) .lab-result-profile-toolbar>div:first-child>strong{color:var(--lab-result-ink);font-size:15px}.lab-result-dialog:not(.is-microbiology) .lab-result-profile-toolbar>div:first-child>small{color:var(--lab-result-muted);font-size:11px}.lab-result-dialog:not(.is-microbiology) .lab-result-section-actions{gap:6px}.lab-result-dialog:not(.is-microbiology) .lab-result-section-actions .el-button{min-height:auto;padding:4px 7px;border:0;border-radius:4px;background:transparent;color:var(--lab-result-primary-dark);font-size:11px}.lab-result-dialog:not(.is-microbiology) .lab-result-section-actions .el-button:hover{background:#ecf5ff}.lab-result-dialog:not(.is-microbiology) .lab-result-values{overflow-x:auto;border:1px solid var(--lab-result-border);border-radius:8px}.lab-result-dialog:not(.is-microbiology) .lab-result-value-head,.lab-result-dialog:not(.is-microbiology) .lab-result-value-row{grid-template-columns:44px 34px minmax(230px,1.5fr) 125px 130px 92px 115px 145px;min-width:920px}.lab-result-dialog:not(.is-microbiology) .lab-result-value-head{min-height:42px;border-bottom:0;background:#f5f7fa;color:var(--lab-result-muted);font-size:11px;font-weight:700}.lab-result-dialog:not(.is-microbiology) .lab-result-value-head>span,.lab-result-dialog:not(.is-microbiology) .lab-result-value-row>div{min-width:0;padding:10px}.lab-result-dialog:not(.is-microbiology) .lab-result-value-row{min-height:52px;align-items:center;border-top:1px solid var(--lab-result-border-light);border-bottom:0;background:var(--lab-result-surface)}.lab-result-dialog:not(.is-microbiology) .lab-result-value-row:hover{background:#fbfcfe}.lab-result-dialog:not(.is-microbiology) .lab-result-value-row.is-critical{background:#fff8f8}.lab-result-dialog:not(.is-microbiology) .lab-result-value-row.is-profile-child{padding-left:16px}.lab-result-dialog:not(.is-microbiology) .lab-result-value-row.is-profile-child>div:first-child{color:var(--lab-result-muted)}.lab-result-dialog:not(.is-microbiology) .lab-result-signal{margin:auto}.lab-result-dialog:not(.is-microbiology) .lab-result-signal.is-abnormal{border-color:#cf8f2b;background:#e6a23c;box-shadow:0 0 0 3px rgba(230,162,60,.11)}.lab-result-dialog:not(.is-microbiology) .lab-result-test-name{color:var(--lab-result-ink);font-size:13px;font-weight:700}.lab-result-dialog:not(.is-microbiology) .lab-result-previous{padding:10px!important;background:transparent;color:var(--lab-result-muted)}.lab-result-dialog:not(.is-microbiology) .lab-result-measured{color:var(--lab-result-ink);font-size:15px;font-weight:800}.lab-result-dialog:not(.is-microbiology) .lab-result-measured.is-abnormal{color:#b88230}.lab-result-dialog:not(.is-microbiology) .lab-result-measured.is-critical{color:#c45656}.lab-result-dialog:not(.is-microbiology) .lab-result-interpretation{display:inline-flex;min-height:23px;align-items:center;padding:2px 8px;border:1px solid var(--lab-result-border);border-radius:999px;background:var(--lab-result-surface-soft);color:var(--lab-result-muted);font-size:10px;font-weight:700;white-space:nowrap}.lab-result-dialog:not(.is-microbiology) .lab-result-interpretation.is-normal{border-color:#b3e19d;background:#f0f9eb;color:#529b2e}.lab-result-dialog:not(.is-microbiology) .lab-result-interpretation.is-abnormal{border-color:#f3d19e;background:#fdf6ec;color:#b88230}.lab-result-dialog:not(.is-microbiology) .lab-result-interpretation.is-critical{border-color:#fab6b6;background:#fef0f0;color:#c45656}.lab-result-dialog:not(.is-microbiology) .lab-result-profile-row{display:grid;width:100%;grid-template-columns:32px minmax(260px,1fr) 28px;gap:10px;min-width:920px;min-height:54px;align-items:center;padding:10px 13px;border:0;border-top:1px solid var(--lab-result-border);border-bottom:0;background:var(--lab-result-surface-soft);color:var(--lab-result-text)}.lab-result-dialog:not(.is-microbiology) .lab-result-value-head+.lab-result-profile-row{border-top:0}.lab-result-dialog:not(.is-microbiology) .lab-result-profile-row:hover{background:#edf4ff}.lab-result-dialog:not(.is-microbiology) .lab-result-profile-row.is-open{background:var(--lab-result-surface-blue)}.lab-result-dialog:not(.is-microbiology) .lab-result-profile-index{grid-column:1;padding:0;color:var(--lab-result-muted)}.lab-result-dialog:not(.is-microbiology) .lab-result-profile-main{display:block;min-width:0;grid-column:2;padding:0}.lab-result-dialog:not(.is-microbiology) .lab-result-profile-main strong{display:block;overflow:hidden;color:var(--lab-result-ink);font-size:13px;text-overflow:ellipsis;white-space:nowrap}.lab-result-dialog:not(.is-microbiology) .lab-result-profile-main small{display:block;margin-top:2px;color:var(--lab-result-muted);font-size:10px}.lab-result-dialog:not(.is-microbiology) .lab-result-profile-row i{grid-column:3;justify-self:end;margin:0;color:var(--lab-result-muted);font-size:17px;transition:transform .16s ease}.lab-result-dialog:not(.is-microbiology) .lab-result-profile-row.is-open i{transform:rotate(180deg)}.lab-result-dialog:not(.is-microbiology) .lab-result-attachments{gap:10px;margin-top:12px;padding:10px 12px;border:1px solid var(--lab-result-border-light);border-radius:7px;background:var(--lab-result-surface-soft)}.lab-result-dialog:not(.is-microbiology) .lab-result-attachments-head strong{font-size:13px}.lab-result-dialog:not(.is-microbiology) .lab-result-attachments-head small,.lab-result-dialog:not(.is-microbiology) .lab-result-upload-note{font-size:10px}
.lab-sensitive-result-locked{display:flex;min-width:920px;align-items:center;justify-content:space-between;gap:16px;padding:13px 16px;border-top:1px solid var(--el-color-danger-light-5,#fab6b6);background:var(--el-color-danger-light-9,#fef0f0)}.lab-sensitive-result-locked>div{display:grid;gap:3px}.lab-sensitive-result-locked>div>strong{color:var(--el-text-color-primary,#303133)}.lab-sensitive-result-locked small{color:var(--el-text-color-secondary,#909399);font-size:11px}.lab-sensitive-result-label{display:inline-flex;min-height:26px;align-items:center;padding:3px 10px;border:1px solid var(--el-color-danger-light-5,#fab6b6);border-radius:999px;background:var(--el-bg-color,#fff);color:var(--el-color-danger,#f56c6c);font-size:12px;white-space:nowrap}
.lab-result-file-row{display:grid;grid-template-columns:minmax(0,1fr) 28px;gap:8px;align-items:center}.lab-result-file-row .lab-result-file{min-width:0}.lab-result-file-remove{width:28px!important;height:28px!important;margin-left:0!important;padding:0!important}.lab-result-file-remove span{font-size:18px;font-weight:400;line-height:1}
/* Standard result popup viewport contract mirrors the approved HTML mockup.
   Keep this scoped away from Microbiology, whose dialog layout is independent. */
.lab-result-dialog:not(.is-microbiology) .lab-result-summary-tag{display:inline-flex;min-height:23px;align-items:center;padding:2px 8px;border:1px solid var(--lab-result-border);border-radius:999px;background:var(--lab-result-surface-soft);color:var(--lab-result-muted);font-size:10px;font-weight:700;white-space:nowrap}.lab-result-dialog:not(.is-microbiology) .lab-result-summary-tag.is-final{border-color:#b3e19d;background:#f0f9eb;color:#529b2e}.lab-result-dialog:not(.is-microbiology) .lab-result-summary-tag.is-partial,.lab-result-dialog:not(.is-microbiology) .lab-result-summary-tag.is-abnormal{border-color:#f3d19e;background:#fdf6ec;color:#b88230}.lab-result-dialog:not(.is-microbiology) .lab-result-summary-tag.is-critical{border-color:#fab6b6;background:#fef0f0;color:#c45656}.lab-result-dialog:not(.is-microbiology) .lab-result-test-name strong{display:block;color:var(--lab-result-ink);font-size:13px}.lab-result-dialog:not(.is-microbiology) .lab-result-test-name small{display:block;margin-top:2px;color:var(--lab-result-muted);font-size:10px;font-weight:400}
.lab-result-dialog:not(.is-microbiology){display:flex;max-height:calc(100vh - 48px);flex-direction:column;margin:24px auto!important}.lab-result-dialog:not(.is-microbiology) .el-dialog__header,.lab-result-dialog:not(.is-microbiology) .el-dialog__footer{flex:none}.lab-result-dialog:not(.is-microbiology) .el-dialog__body{flex:1;min-height:0;max-height:none;overflow:auto;overscroll-behavior:contain}.lab-result-dialog:not(.is-microbiology) .lab-result-index,.lab-result-dialog:not(.is-microbiology) .lab-result-profile-index{white-space:nowrap}.lab-result-dialog:not(.is-microbiology) .lab-result-value-row>.lab-result-index{padding-right:6px;padding-left:6px}
.lab-empty{padding:34px 20px;text-align:center;color:var(--muted);line-height:1.7}.lab-empty strong{color:var(--ink)}.lab-pagination{display:flex;justify-content:flex-end;padding-top:10px}.lab-mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
@media(max-width:1100px){.lab-list-head{display:none}.lab-patient-row{grid-template-columns:32px minmax(160px,1.25fr) minmax(120px,1fr) minmax(125px,1fr) 72px 78px 64px;gap:6px 10px}.lab-expand-button{grid-column:1;grid-row:1/3}.lab-patient-summary{grid-column:2;grid-row:1}.lab-context-tags{grid-column:3;grid-row:1}.lab-row-status-check{grid-column:4;grid-row:1}.lab-patient-row>.lab-row-action-pdf,.lab-patient-row.is-lookup>.lab-row-action-pdf{grid-column:5;grid-row:1}.lab-patient-row>.lab-row-action-hn,.lab-patient-row.is-lookup>.lab-row-action-hn{grid-column:6;grid-row:1}.lab-patient-row>.lab-row-action-emr,.lab-patient-row.is-lookup>.lab-row-action-emr{grid-column:7;grid-row:1}.lab-items-cell{grid-column:2;grid-row:2}.lab-specimen-cell{grid-column:3;grid-row:2}.lab-order-cell{grid-column:4;grid-row:2}.lab-doctor-cell{grid-column:2/8;grid-row:3}.lab-patient-row.is-lookup .lab-section-cell{grid-column:4;grid-row:2}.lab-patient-row.is-lookup .lab-order-cell{grid-column:2;grid-row:3}.lab-patient-row.is-lookup .lab-doctor-cell{grid-column:3/8;grid-row:3}.lab-metric:before,.lab-doctor-cell:before{display:block;content:attr(data-label);margin-bottom:3px;color:var(--muted);font-size:10px;font-weight:650}}
.lab-order-condition{display:grid;gap:2px;margin-top:5px;padding:5px 7px;border-left:2px solid var(--primary);border-radius:0 5px 5px 0;background:var(--primary-50);font-size:10px;font-weight:500;line-height:1.4}
.lab-order-condition span{color:var(--muted);font-weight:700}.lab-order-condition strong{color:var(--text);font-weight:650;white-space:pre-wrap;overflow-wrap:anywhere}.lab-order-condition.is-missing{border-left-color:var(--danger);background:var(--danger-50)}.lab-order-condition.is-missing strong{color:var(--danger)}
.lab-multi-specimen-list,.lab-multi-specimen-entry,.lab-multi-collection-entry{display:grid;min-width:0}.lab-multi-specimen-list{gap:10px}.lab-multi-specimen-entry{gap:5px}.lab-specimen-site{display:inline-flex;width:max-content;max-width:100%;min-height:20px;align-items:center;padding:2px 8px;border:1px solid var(--el-color-primary-light-5,#a0cfff);border-radius:999px;background:var(--primary-50);color:var(--primary);font-size:10px;font-weight:700;line-height:1.4;overflow-wrap:anywhere}.lab-multi-collection-entry{gap:0}.lab-multi-collection-entry+.lab-multi-collection-entry{margin-top:10px}.lab-specimen-condition-line{display:flex;min-width:0;align-items:center;gap:5px;flex-wrap:wrap}.lab-specimen-temperature{display:inline-flex;min-height:19px;align-items:center;margin-top:4px;padding:1px 7px;border:1px solid var(--border);border-radius:999px;background:var(--fill-light);color:var(--text);font-size:10px;font-weight:700;line-height:1.4;white-space:nowrap}.lab-specimen-temperature.is-immediate{border-color:var(--el-color-success-light-5,#b3e19d);background:var(--success-50);color:var(--el-color-success-dark-2,#529b2e)}.lab-specimen-temperature.is-refrigerated{border-color:var(--el-color-primary-light-5,#a0cfff);background:var(--primary-50);color:var(--primary)}.lab-specimen-temperature.is-room-temperature{border-color:var(--el-color-warning-light-5,#f3d19e);background:var(--warning-50);color:var(--el-color-warning-dark-2,#b88230)}.lab-multi-specimen-empty{padding:6px 7px;border:1px dashed var(--danger);border-radius:6px;background:var(--danger-50);color:var(--danger);font-size:10px;font-weight:700}
@media(max-width:900px){.lab-search-control{width:calc(50% - 5px)}.lab-date-control{width:calc(50% - 5px)}.lab-create-button{margin-left:0}.lab-item-grid-wrap{overflow:visible;margin-left:0}.lab-item-head{display:none}.lab-item-grid.lab-item-row{display:grid;grid-template-columns:1fr 1fr;gap:0 14px;min-width:0;padding:10px 0}.lab-item-grid.lab-item-row>.lab-item-check-cell{position:static;z-index:auto;padding-left:0;background:transparent;box-shadow:none}.lab-item-row>div{display:grid;grid-template-columns:minmax(92px,.42fr) minmax(0,1fr);align-items:center;gap:8px;min-height:34px;padding:3px 0;border-bottom:1px dashed var(--border-lighter)}.lab-item-row>div:before{display:block;content:attr(data-label);color:var(--muted);font-size:10px;font-weight:650}.lab-item-row>div:last-child{border-bottom:0}.lab-item-specimen-cell{padding-right:0;transform:none}.lab-item-collected-time{align-items:start}.lab-item-collected-time>.lab-collected-date-time,.lab-item-collected-time>.lab-specimen-storage,.lab-item-collected-time>.lab-specimen-source-line,.lab-item-collected-time>.lab-multi-collection-entry{grid-column:2}.lab-specimen-select{max-width:none}.lab-result-list{margin-left:0}.lab-result-list-head,.lab-result-list-row{grid-template-columns:44px minmax(180px,1fr) 110px 120px 100px 140px 140px;min-width:900px;padding:6px 0}.lab-result-list.is-lookup .lab-result-list-head,.lab-result-list.is-lookup .lab-result-list-row{grid-template-columns:44px minmax(220px,1fr) 110px 120px 140px 140px;min-width:824px}.lab-result-list.is-microbiology .lab-result-list-head,.lab-result-list.is-microbiology .lab-result-list-row{grid-template-columns:44px minmax(180px,1fr) 100px 110px 100px 130px 130px 70px 76px;min-width:980px}.lab-result-list.is-microbiology.is-lookup .lab-result-list-head,.lab-result-list.is-microbiology.is-lookup .lab-result-list-row{grid-template-columns:44px minmax(210px,1fr) 100px 110px 130px 130px 70px 76px;min-width:870px}}
@media(max-width:720px){.lab-toolbar{display:grid;grid-template-columns:1fr 1fr;gap:8px}.lab-search-control,.lab-toolbar .lab-date-control{width:100%!important;max-width:none;flex:auto;grid-column:1/-1}.lab-toolbar>.el-button,.lab-toolbar>.el-dropdown{width:100%}.lab-toolbar>.el-dropdown .el-button{width:100%}.lab-create-button{grid-column:1/-1}.lab-scan-context .el-button{width:100%;margin-left:0}.lab-status-strip{flex-wrap:nowrap;overflow-x:auto;padding-bottom:3px}.lab-status-chip,.lab-status-legend{flex:0 0 auto}.lab-lookup-strip>small{width:100%;margin-left:0}.lab-patient-row{grid-template-columns:28px minmax(0,1fr) 58px 58px 58px;padding:9px 8px}.lab-expand-button{grid-column:1;grid-row:1}.lab-patient-summary{grid-column:2;grid-row:1}.lab-row-status-check{grid-column:3/6;grid-row:1;justify-self:end}.lab-context-tags{grid-column:2/6;grid-row:2}.lab-items-cell{grid-column:2;grid-row:3}.lab-specimen-cell{grid-column:3/6;grid-row:3}.lab-order-cell{grid-column:2/6;grid-row:4}.lab-doctor-cell{grid-column:2/6;grid-row:5}.lab-patient-row.is-lookup .lab-section-cell{grid-column:2;grid-row:4}.lab-patient-row.is-lookup .lab-order-cell{grid-column:3/6;grid-row:4}.lab-patient-row>.lab-row-action-pdf,.lab-patient-row.is-lookup>.lab-row-action-pdf{grid-column:2/6;grid-row:6}.lab-patient-row>.lab-row-action-hn,.lab-patient-row.is-lookup>.lab-row-action-hn{grid-column:2/6;grid-row:7}.lab-patient-row>.lab-row-action-emr,.lab-patient-row.is-lookup>.lab-row-action-emr{grid-column:2/6;grid-row:8}.lab-detail-panel{padding:0 8px 12px}.lab-detail-top{align-items:flex-start;flex-wrap:wrap}.lab-bulk-actions{width:100%;margin:0;padding-bottom:7px;flex-wrap:wrap}.lab-item-grid.lab-item-row{grid-template-columns:1fr}.lab-pagination{justify-content:flex-start;overflow-x:auto}.lab-result-patient-card{grid-template-columns:44px 1fr}.lab-result-avatar{grid-row:auto}.lab-result-patient-main{grid-column:2}.lab-result-meta{grid-column:1/-1}.lab-manual-fields{grid-template-columns:1fr}.lab-result-list-head{display:none}.lab-result-list-row{grid-template-columns:1fr 1fr;min-width:0;padding:8px 0}.lab-result-list-row>div:nth-child(2){grid-column:1/-1;grid-row:1}.lab-micro-patient-strip{grid-template-columns:1fr 1fr}.lab-micro-timeline{grid-template-columns:1fr 1fr}.lab-micro-result-head{grid-template-columns:28px minmax(0,1fr) auto 22px}.lab-micro-result-head>span:nth-child(3){display:none}.lab-micro-result-body{padding-left:13px}.lab-micro-wire-meta{grid-template-columns:1fr 1fr}.lab-micro-wire-meta>div:nth-child(2){border-right:0}}
@media(max-width:820px){.lab-result-revision-view{grid-template-columns:1fr}.lab-result-revision-rail{max-height:190px;overflow:auto;border-right:0;border-bottom:1px solid var(--border)}.lab-result-revision-sheet>footer{grid-template-columns:1fr}.lab-result-revision-sheet>footer span{margin-top:4px}}
@media(max-width:520px){.lab-cbc-patient-card{grid-template-columns:38px minmax(0,1fr)}.lab-cbc-avatar{width:38px;height:38px}.lab-cbc-patient-card>.lab-source-pill{grid-column:1/-1;justify-self:start}.lab-cbc-swap-summary{grid-template-columns:1fr}.lab-cbc-swap-summary>i{transform:rotate(90deg)}.lab-cbc-swap-cell{min-height:auto}.lab-micro-patient-strip,.lab-micro-timeline,.lab-micro-summary-grid,.lab-micro-wire-meta{grid-template-columns:1fr}.lab-micro-wire-meta>div{border-right:0}.lab-micro-notice{flex-direction:column;gap:3px}.lab-micro-result-head{grid-template-columns:24px minmax(0,1fr) auto 20px;gap:7px}.lab-micro-section-head{align-items:flex-start;flex-direction:column;gap:2px}.lab-result-order-note{grid-template-columns:26px minmax(0,1fr)}.lab-result-order-note-key{grid-column:2;justify-self:start}}
.lab-result-value-row.is-redacted{background:var(--danger-50)}.lab-result-redacted-value{color:var(--danger);font-weight:800}
/* MY/pathology manual-result dialog. Keep every selector under lab-pathology-*
   so the shared Standard LAB and Microbiology result viewers remain unchanged. */
.lab-pathology-dialog{display:flex;max-height:calc(100vh - 72px);flex-direction:column;margin:36px auto!important;color:var(--text)}.lab-pathology-dialog .el-dialog__header,.lab-pathology-dialog .el-dialog__footer{flex:none;margin:0}.lab-pathology-dialog .el-dialog__header{padding:14px 20px 12px;border-bottom:1px solid var(--border-lighter)}.lab-pathology-dialog .el-dialog__body{flex:1;min-height:0;padding:0;overflow:hidden}.lab-pathology-dialog .el-dialog__footer{padding:10px 20px;border-top:1px solid var(--border-lighter);background:var(--fill-lighter)}
.lab-pathology-head{display:flex;min-width:0;align-items:flex-start;justify-content:space-between;gap:16px;padding-right:34px}.lab-pathology-head>div:first-child{display:grid;min-width:0;gap:4px}.lab-pathology-head small{color:var(--muted);font-size:11px}.lab-pathology-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.lab-pathology-title>strong{color:var(--ink);font-size:19px}.lab-pathology-title>span{display:inline-flex;min-height:24px;align-items:center;padding:2px 9px;border:1px solid var(--el-color-primary-light-5,#a0cfff);border-radius:999px;background:var(--primary-50);color:var(--primary);font-size:10px;font-weight:800}.lab-pathology-title>span.is-manual{border-color:var(--el-color-warning-light-5,#f3d19e);background:var(--warning-50);color:var(--el-color-warning-dark-2,#b88230)}
.lab-pathology-body{max-height:calc(100vh - 210px);overflow:auto;overscroll-behavior:contain}.lab-pathology-patient-strip{display:grid;grid-template-columns:minmax(220px,1.6fr) minmax(150px,.8fr) minmax(210px,1.15fr) minmax(120px,.65fr) minmax(150px,.8fr);border-bottom:1px solid var(--border-lighter);background:var(--white)}.lab-pathology-patient-strip>div{display:grid;min-width:0;gap:3px;padding:10px 13px;border-right:1px solid var(--border-lighter)}.lab-pathology-patient-strip>div:last-child{border-right:0}.lab-pathology-patient-strip span{color:var(--muted);font-size:10px;font-weight:650}.lab-pathology-patient-strip strong{overflow:hidden;color:var(--ink);font-size:12px;text-overflow:ellipsis;white-space:nowrap}
.lab-pathology-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 18px;color:var(--muted);font-size:11px}.lab-pathology-summary strong{color:var(--ink);font-size:12px}.lab-pathology-summary-actions{display:flex;align-items:center;gap:10px}.lab-pathology-summary-actions>.el-button{margin:0}.lab-pathology-table{min-width:1120px;margin:0 18px 14px;border:1px solid var(--border-light);border-radius:8px;overflow:hidden}.lab-pathology-table-head,.lab-pathology-item-row{display:grid;grid-template-columns:52px minmax(180px,.72fr) minmax(220px,.92fr) minmax(570px,2.25fr)}.lab-pathology-table-head{min-height:38px;align-items:center;background:var(--fill-light);color:var(--muted);font-size:11px;font-weight:750}.lab-pathology-table-head>div{height:100%;padding:10px 12px;border-right:1px solid var(--border-light)}.lab-pathology-table-head>div:last-child{border-right:0}
.lab-pathology-item-row{min-height:154px;border-top:1px solid var(--border-light);background:var(--white)}.lab-pathology-item-row:first-of-type{border-top:0}.lab-pathology-item-index,.lab-pathology-test-cell,.lab-pathology-specimen-cell{border-right:1px solid var(--border-light);background:var(--fill-lighter)}.lab-pathology-item-index{padding:16px 9px;color:var(--muted);font-size:11px;text-align:center}.lab-pathology-test-cell,.lab-pathology-specimen-cell{display:grid;min-width:0;align-content:start;gap:5px;padding:14px 13px}.lab-pathology-test-cell>strong,.lab-pathology-specimen-cell>strong{color:var(--ink);font-size:13px;overflow-wrap:anywhere}.lab-pathology-test-cell>strong>span{margin-right:4px;color:var(--primary);font-size:10px;font-weight:800}.lab-pathology-test-cell>small{color:var(--muted);font-size:10px;line-height:1.5}.lab-pathology-ordered-site{display:inline-flex;width:max-content;max-width:100%;min-height:22px;align-items:center;margin-top:7px;padding:2px 8px;border:1px solid var(--el-color-primary-light-5,#a0cfff);border-radius:999px;background:var(--primary-50);color:var(--primary);font-size:10px;font-weight:700;line-height:1.4;overflow-wrap:anywhere}.lab-pathology-ordered-site>b{font-weight:800}
.lab-pathology-subresults{min-width:0}.lab-pathology-addbar{display:flex;min-height:36px;align-items:center;justify-content:flex-end;gap:10px;padding:4px 9px;border-bottom:1px dashed var(--border-lighter);background:var(--fill-lighter)}.lab-pathology-addbar .el-button{margin:0}.lab-pathology-subrow{display:grid;grid-template-columns:minmax(265px,.92fr) minmax(290px,1.08fr) 40px;min-height:98px;align-items:stretch;border-bottom:1px dashed var(--border-lighter);background:var(--white)}.lab-pathology-subrow:last-child{border-bottom:0}.lab-pathology-subrow>div,.lab-pathology-subrow>label{min-width:0;padding:9px;border-right:1px solid var(--border-lighter)}.lab-pathology-subrow>div:last-child{border-right:0}.lab-pathology-site-entry,.lab-pathology-result-entry{display:grid;align-content:start;gap:6px}.lab-pathology-site-entry>span,.lab-pathology-result-entry>span{color:var(--text);font-size:11px;font-weight:750}.lab-pathology-site-entry>span b{color:var(--danger)}.lab-pathology-site-entry>.el-select,.lab-pathology-result-entry>.el-select{width:100%}.lab-pathology-site-entry>small,.lab-pathology-result-entry>small{color:var(--muted);font-size:9px;line-height:1.4}.lab-pathology-remove{display:flex;align-items:flex-start;justify-content:center}.lab-pathology-remove .el-button{width:28px;height:28px;margin:0;padding:0;border-radius:50%;font-size:20px;font-weight:700}.lab-pathology-revisions{display:grid;grid-template-columns:250px minmax(0,1fr);min-height:260px;margin:0 18px 14px;overflow:hidden;border:1px solid var(--border-light);border-radius:8px;background:var(--white)}.lab-pathology-revisions>aside{display:grid;align-content:start;border-right:1px solid var(--border-light);background:var(--fill-lighter)}.lab-pathology-revisions>aside>strong{padding:11px 12px;color:var(--ink);font-size:11px}.lab-pathology-revisions>aside>button{display:grid;gap:2px;padding:9px 12px;border:0;border-top:1px solid var(--border-lighter);background:transparent;color:var(--text);font:inherit;text-align:left;cursor:pointer}.lab-pathology-revisions>aside>button.is-active{background:var(--primary-50);color:var(--primary)}.lab-pathology-revisions>aside span{font-size:10px;font-weight:750}.lab-pathology-revisions>aside small{color:var(--muted);font-size:9px}.lab-pathology-revision-sheet{min-width:0}.lab-pathology-revision-sheet>header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-bottom:1px solid var(--border-light)}.lab-pathology-revision-sheet>header>div{display:grid;gap:2px}.lab-pathology-revision-sheet>header strong{color:var(--ink);font-size:12px}.lab-pathology-revision-sheet>header small,.lab-pathology-revision-sheet>header>span{color:var(--muted);font-size:9px}.lab-pathology-revision-head,.lab-pathology-revision-row{display:grid;grid-template-columns:minmax(180px,1.2fr) minmax(120px,.75fr) minmax(150px,1fr) minmax(150px,1fr);gap:0}.lab-pathology-revision-head{background:var(--fill-light);color:var(--muted);font-size:9px;font-weight:750}.lab-pathology-revision-head>span,.lab-pathology-revision-row>span,.lab-pathology-revision-row>strong{padding:8px 10px;border-right:1px solid var(--border-lighter)}.lab-pathology-revision-row{border-top:1px solid var(--border-lighter);color:var(--text);font-size:10px}.lab-pathology-revision-row span>strong,.lab-pathology-revision-row span>small{display:block}.lab-pathology-revision-row span>small{margin-top:2px;color:var(--muted);font-size:9px}.lab-pathology-correction-reason,.lab-pathology-attachments{margin:0 18px 14px}.lab-pathology-attachments{padding:11px}.lab-pathology-footer{display:flex;align-items:center;justify-content:flex-end;gap:8px}.lab-pathology-footer>span{margin-right:auto;color:var(--muted);font-size:11px}.lab-pathology-empty{padding:30px;text-align:center;color:var(--muted)}
@media(max-width:900px){.lab-pathology-patient-strip{grid-template-columns:1fr 1fr}.lab-pathology-patient-strip>div{border-bottom:1px solid var(--border-lighter)}.lab-pathology-patient-strip>div:last-child{grid-column:1/-1}.lab-pathology-summary{align-items:flex-start;flex-direction:column}.lab-pathology-dialog{width:calc(100vw - 16px)!important;margin:8px auto!important;max-height:calc(100vh - 16px)}.lab-pathology-body{max-height:calc(100vh - 154px)}}
@media(prefers-reduced-motion:reduce){.lab-cpoe *{scroll-behavior:auto!important;transition-duration:.001ms!important}}`

fs.writeFileSync(outputPath, JSON.stringify(form, null, 2) + '\n')
