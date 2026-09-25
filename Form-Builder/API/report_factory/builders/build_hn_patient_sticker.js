/* build_hn_patient_sticker.js
 *
 * สร้างคู่ SQL + Report ของ "ป้ายติดแฟ้ม HN" (สติ๊กเกอร์ผู้ป่วย ค้นด้วย HN อย่างเดียว)
 *
 * ผู้ใช้ขอ 2026-09-04:
 *   "ทำ report สำหรับ สติ้กเกอร์ hn … เหมือนอันนี้ [ป้ายติดแฟ้ม (VN)] …
 *    จะใช้สำหรับทั้ง lab และ xray เลย เพราะอันนี้มัน filter จับแค่ hn"
 *   ยืนยันเนื้อหาตอนถามกลับ:
 *   "ไม่ต้องเอาข้อมูลไรเลย เกี่ยวกับ lab /xray เอาแค่ hn ข้อมูลผู้ป่วย วาร์ดต้นทาง บาร์โคเด hn"
 *
 * ⇒ ป้ายนี้ **ห้ามมีข้อมูล LAB/X-ray** (ไม่มี order/item/accession/lab no./section/modality)
 *   เพราะเป็นป้ายระดับผู้ป่วย ปุ่ม HN ของทั้งสองหน้าจึงเรียกตัวเดียวกันได้
 *
 * ต้นแบบหน้าตา/ขนาด: Report "ป้ายติดแฟ้ม (VN)" (`06b8f72c39fdde6064981a4e`) ที่ผู้ใช้ส่งมาใน
 *   backup-data_report-factory_2026_09_04_09_02_51.zip — custom landscape 247 × 67 pt,
 *   html หนึ่งก้อน + barcode หนึ่งก้อน  ต่างกันแค่ผูกกับ HN แทน VN และเพิ่มวาร์ดต้นทาง
 *
 * ของเดิมที่ห้ามแตะ (ยังใช้งานอยู่จริงทั้งคู่):
 *   · Report `5256d813009293b480d0a15c` "ป้ายติดแฟ้ม" (VN) — ปุ่ม HN ของ LAB/X-ray ย้ายมาใช้
 *     ป้ายใหม่แล้ว 2026-09-04 แต่ record เดิมยังอยู่ ห้ามนำ _id นี้มาใช้ซ้ำ
 *   · SQL `6a980809422c1ca95982a053` / Report `6a980831422c1ca95982a054`
 *     "X-ray HN Accession Sticker" ระดับ item — คนละใบ คนละพารามิเตอร์ ไม่ถูกแก้จากสคริปต์นี้
 *   สคริปต์นี้สร้าง record ใหม่ด้วย _id ใหม่เท่านั้น จึงไม่ทับของเดิมตอน Restore (Upsert)
 *
 * รันใหม่ได้เสมอ:  node Form-Builder/API/report_factory/builders/build_hn_patient_sticker.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../../..')
const SQL_STAMP = '2026_09_04_10_00_00'
const REPORT_STAMP = '2026_09_04_10_05_00'

/* ใช้ export ของจริงเป็นแม่แบบ เพื่อให้ field ระบบ (tool_license/xsitex/xunitx/…) ตรงกับที่
   Factory เขียนเอง — ห้ามประดิษฐ์ schema เอง */
const SQL_TEMPLATE = path.join(
  ROOT,
  'Form-Builder/SDForm/sql-factory/exports/backup-data-module_sql-drug-label-all-sigs-2026_08_06.json',
)
const REPORT_TEMPLATE = path.join(
  ROOT,
  'Form-Builder/SDForm/report_factory/exports/backup-data-module_report-drug-label-8x6-figma-final-2026_08_06.json',
)
const sqlOutputForStamp = stamp => path.join(
  ROOT,
  `Form-Builder/SDForm/sql-factory/exports/backup-data-module_sql-Earn_admin-${stamp}.json`,
)
const reportOutputForStamp = stamp => path.join(
  ROOT,
  `Form-Builder/SDForm/report_factory/exports/backup-data-module_report-Earn_admin-${stamp}.json`,
)
const SQL_OUTPUT = sqlOutputForStamp(SQL_STAMP)
const REPORT_OUTPUT = reportOutputForStamp(REPORT_STAMP)

/* _id ใหม่ทั้งคู่ — ยังไม่มีใน live ⇒ Restore (Upsert) จะสร้างรายการใหม่ ไม่ทับของเดิม
   ถ้าจะ import ทับ record ที่มีอยู่แล้ว ให้ส่ง --sql-id / --report-id */
const HN_STICKER_SQL_ID = '6a9a355c422c1ca95982a1a1'
const HN_STICKER_REPORT_ID = '6a9a355c422c1ca95982a1a2'

const VISIT_FORM_ID = '6a40fdec4b6dfdf45acbfbce'
const TOOL_LICENSE = '6a3113a619ee74c8f82854a0'
const HOSPITAL_NAME = 'สถาบันสุขภาพเด็กแห่งชาติมหาราชินี'
/* ขนาดเดียวกับ "ป้ายติดแฟ้ม (VN)" ที่ผู้ใช้ส่งมา (pdf_custom_size 247 × 67 pt) */
const PAGE_WIDTH_PT = 247
const PAGE_HEIGHT_PT = 67

const VISIT = 'zdata_visit'

const oid = value => ({ $oid: value })
const clone = value => JSON.parse(JSON.stringify(value))
const readBackupRecord = filename => {
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'))
  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error(`Backup template must contain exactly one record: ${filename}`)
  }
  return data[0]
}

const sqlTemplate = readBackupRecord(SQL_TEMPLATE)
const reportTemplate = readBackupRecord(REPORT_TEMPLATE)

const outputVariables = [
  'hospital_name', 'hn', 'patient_name', 'birth_date_display', 'age_display',
  'gender_text', 'blood_group', 'ward_display',
]

/* อายุ ปี/เดือน/วัน ณ เวลาพิมพ์ — คัดลอกสูตรที่ผ่าน UAT แล้วจาก X-ray HN sticker
   (build_xray_hn_accession_sticker.js) โดยไม่แก้ตรรกะ: ปี/เดือนที่ยังไม่ครบถูกลดลง 1
   ก่อนคิดขั้นถัดไป จึงไม่มีทางได้จำนวนวันติดลบ */
const ageDisplay = birthExpression => ({
  $let: {
    vars: { birth: birthExpression },
    in: {
      $cond: [
        { $and: [{ $ne: ['$$birth', null] }, { $lte: ['$$birth', '$$NOW'] }] },
        {
          $let: {
            vars: {
              rawYears: {
                $dateDiff: {
                  startDate: '$$birth', endDate: '$$NOW', unit: 'year', timezone: 'Asia/Bangkok',
                },
              },
            },
            in: {
              $let: {
                vars: {
                  years: {
                    $cond: [
                      {
                        $gt: [
                          {
                            $dateAdd: {
                              startDate: '$$birth', unit: 'year', amount: '$$rawYears',
                              timezone: 'Asia/Bangkok',
                            },
                          },
                          '$$NOW',
                        ],
                      },
                      { $subtract: ['$$rawYears', 1] },
                      '$$rawYears',
                    ],
                  },
                },
                in: {
                  $let: {
                    vars: {
                      yearAnchor: {
                        $dateAdd: {
                          startDate: '$$birth', unit: 'year', amount: '$$years',
                          timezone: 'Asia/Bangkok',
                        },
                      },
                    },
                    in: {
                      $let: {
                        vars: {
                          rawMonths: {
                            $dateDiff: {
                              startDate: '$$yearAnchor', endDate: '$$NOW', unit: 'month',
                              timezone: 'Asia/Bangkok',
                            },
                          },
                        },
                        in: {
                          $let: {
                            vars: {
                              months: {
                                $cond: [
                                  {
                                    $gt: [
                                      {
                                        $dateAdd: {
                                          startDate: '$$yearAnchor', unit: 'month', amount: '$$rawMonths',
                                          timezone: 'Asia/Bangkok',
                                        },
                                      },
                                      '$$NOW',
                                    ],
                                  },
                                  { $subtract: ['$$rawMonths', 1] },
                                  '$$rawMonths',
                                ],
                              },
                            },
                            in: {
                              $let: {
                                vars: {
                                  monthAnchor: {
                                    $dateAdd: {
                                      startDate: '$$yearAnchor', unit: 'month', amount: '$$months',
                                      timezone: 'Asia/Bangkok',
                                    },
                                  },
                                },
                                in: {
                                  $concat: [
                                    { $toString: '$$years' }, ' ปี ',
                                    { $toString: '$$months' }, ' เดือน ',
                                    {
                                      $toString: {
                                        $dateDiff: {
                                          startDate: '$$monthAnchor', endDate: '$$NOW', unit: 'day',
                                          timezone: 'Asia/Bangkok',
                                        },
                                      },
                                    },
                                    ' วัน',
                                  ],
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '',
      ],
    },
  },
})

/* ── pipeline ────────────────────────────────────────────────────────────────
   ฐานคือ zdata_visit ไม่ใช่ zdata_person เพราะ "วาร์ดต้นทาง" อยู่ที่ Visit
   (zdata_person ไม่มีแผนก/คลินิก) และ pid บน Visit เป็น snapshot ของผู้ป่วยครบอยู่แล้ว
   ⇒ ไม่ต้อง $lookup ผู้ป่วยเพิ่ม

   เลือกแถวเดียว: Visit ที่ยังเปิดอยู่มาก่อน แล้วค่อยเรียงวันที่ล่าสุด
   (visit_date/created_at เป็น string ISO ⇒ เรียงตัวอักษร = เรียงเวลา)
   ⇒ HN ที่มีหลาย Visit จะได้วาร์ดของ Visit ปัจจุบันเสมอ */
const nosqlPipeline = [
  /* 🔴 แก้ 2026-09-04 หลัง Preview ออกมาขาวทั้งใบ (= SQL คืน 0 แถว)
     ของเดิม match ตรง ๆ ที่ dotted path `'pid.hn': '{{hn}}'` ซึ่งต่างจากทุก pipeline ที่ผ่าน
     runtime มาแล้วในรีโปนี้ — X-ray HN sticker สร้าง alias ระดับบนสุดด้วย $addFields ก่อน
     แล้วค่อย $match กับ alias นั้นเสมอ (`_order_key` / `_item_key` / `_visit_key`)
     ⇒ ทำตามแบบเดียวกัน และ $toString ให้ด้วย เผื่อ hn บางแถวไม่ได้เก็บเป็น string
     _hn_key_prefixed มีไว้ให้พิมพ์ได้ทั้ง `6900001` และ `HN6900001` (หน้าจอโชว์แบบมีคำนำหน้า)
     ทั้งสองทางชี้ไปที่ผู้ป่วยคนเดียวกันเสมอ จึงไม่ได้ทำให้กรองหลวมข้ามคน */
  {
    $addFields: {
      _hn_key: { $trim: { input: { $toString: { $ifNull: ['$pid.hn', ''] } } } },
    },
  },
  {
    $addFields: {
      _hn_key_prefixed: { $concat: ['HN', '$_hn_key'] },
    },
  },
  {
    $match: {
      xrstatx: { $nin: [0, 3] },
      $or: [
        { _hn_key: '{{hn}}' },
        { _hn_key_prefixed: '{{hn}}' },
      ],
    },
  },
  {
    $addFields: {
      _open_rank: { $cond: [{ $eq: ['$visit_status', false] }, 0, 1] },
      _visit_sort: { $ifNull: ['$visit_date', ''] },
      _created_sort: { $ifNull: ['$created_at', ''] },
    },
  },
  { $sort: { _open_rank: -1, _visit_sort: -1, _created_sort: -1 } },
  { $limit: 1 },
  {
    $addFields: {
      _patient: '$pid',
      _birth_raw: { $ifNull: ['$pid.birth_date', '$birth_date'] },
    },
  },
  {
    $addFields: {
      _birth_date: { $convert: { input: '$_birth_raw', to: 'date', onError: null, onNull: null } },
    },
  },
  {
    $project: {
      _id: 1,
      hospital_name: HOSPITAL_NAME,
      hn: { $ifNull: ['$_hn_key', { $ifNull: ['$_patient.hn', ''] }] },
      patient_name: {
        $trim: {
          input: {
            $concat: [
              { $ifNull: ['$_patient.prename.label', ''] },
              { $ifNull: ['$_patient.p_fname', ''] },
              ' ',
              { $ifNull: ['$_patient.p_lname', ''] },
            ],
          },
        },
      },
      birth_date_display: {
        $cond: [
          { $ne: ['$_birth_date', null] },
          {
            $concat: [
              { $dateToString: { date: '$_birth_date', format: '%d/%m/', timezone: 'Asia/Bangkok' } },
              { $toString: { $add: [{ $year: '$_birth_date' }, 543] } },
            ],
          },
          '',
        ],
      },
      age_display: {
        $cond: [
          { $ne: ['$_birth_date', null] },
          ageDisplay('$_birth_date'),
          {
            $cond: [
              { $ne: [{ $ifNull: ['$_patient.age', null] }, null] },
              { $concat: [{ $toString: '$_patient.age' }, ' ปี'] },
              '',
            ],
          },
        ],
      },
      /* เพศ: ใช้ค่าที่ Visit denormalize ไว้ก่อน แล้วค่อยแปลจากรหัสของผู้ป่วย */
      gender_text: {
        $ifNull: [
          '$gender_text',
          {
            $switch: {
              branches: [
                { case: { $eq: [{ $toString: { $ifNull: ['$_patient.p_gender', ''] } }, '1'] }, then: 'ชาย' },
                { case: { $eq: [{ $toString: { $ifNull: ['$_patient.p_gender', ''] } }, '2'] }, then: 'หญิง' },
              ],
              default: '',
            },
          },
        ],
      },
      blood_group: { $ifNull: ['$abogroup_text', { $ifNull: ['$_patient.p_abogroup', ''] }] },
      /* วาร์ดต้นทาง — ฟอร์ม Visit เก็บเป็น visit_clinic (แผนก/คลินิก) ซึ่งเป็นค่าที่จอ
         "ผู้มารับบริการวันนี้" แสดงอยู่  เผื่อ ward ไว้ก่อนสำหรับข้อมูลที่มีฟิลด์นั้นจริง
         🔴 fallback สุดท้ายต้องเป็น .value ไม่ใช่ตัว object — visit_clinic เป็น select-form-input
            ({value,label}) ถ้า fallback ไปที่ object ตรง ๆ ป้ายจะพิมพ์ "[object Object]" */
      ward_display: {
        $ifNull: [
          '$ward.label',
          { $ifNull: ['$visit_clinic.label', { $ifNull: ['$visit_clinic.value', ''] }] },
        ],
      },
    },
  },
  { $limit: 1 },
]

const buildSqlRecord = (
  sqlId = HN_STICKER_SQL_ID,
  timestamps = { createdAt: '2026-09-04 10:00:00', updatedAt: '2026-09-04 10:00:00' },
) => {
  if (!/^[a-f0-9]{24}$/i.test(String(sqlId || ''))) {
    throw new Error('--sql-id must be a 24-character SQL Factory record ID')
  }
  return {
    ...clone(sqlTemplate),
    _id: oid(sqlId),
    dataid: sqlId,
    xparentx: oid(sqlId),
    created_at: timestamps.createdAt,
    updated_at: timestamps.updatedAt,
    nosql_collections: JSON.stringify([VISIT]),
    nosql_filter: null,
    nosql_options: null,
    nosql_pipeline: JSON.stringify(nosqlPipeline),
    nosql_type: 'aggregate',
    pg_sql: null,
    sql_assign_roles: null,
    sql_category: null,
    sql_desc: 'ข้อมูลป้ายติดแฟ้ม HN: ชื่อผู้ป่วย HN วันเกิด อายุ เพศ หมู่เลือด และวาร์ดต้นทาง ค้นด้วย HN อย่างเดียว',
    sql_form_id: { value: VISIT_FORM_ID, label: 'Visit' },
    sql_from: VISIT,
    sql_group_by: null,
    sql_join: [],
    sql_limit: null,
    sql_name: 'HN Patient Sticker v1',
    sql_note: 'พารามิเตอร์เดียวคือ hn ⇒ ใช้ได้ทั้ง LAB และ X-ray โดยไม่มีข้อมูลของสองระบบนั้นเลย; เลือก Visit ที่ยังเปิดอยู่ก่อน แล้วจึงเอาล่าสุด',
    sql_options: {
      variable: outputVariables.map(name => ({ vname: name, origin: name, as: null })),
      param: [{ pname: 'hn', ptype: 'text', pdefault: null }],
    },
    sql_order_by: [],
    sql_rstat: false,
    sql_select: [],
    sql_share: 'public',
    sql_tags: ['HN', 'sticker', 'patient', 'label'],
    sql_type: 'nosql',
    sql_where: null,
    tool_feature: 'sql',
    tool_license: TOOL_LICENSE,
  }
}

const contentBase = (widget, variable, value, extra = {}) => ({
  content_widget: widget,
  content_var: variable,
  content_align: 'left',
  content_decoration: '',
  content_linestyle: 'dotted',
  content_bold: false,
  content_italics: false,
  content_color: null,
  content_bgcolor: null,
  content_fontsize: null,
  content_ml: null,
  content_mt: null,
  content_mr: null,
  content_mb: null,
  content_width: null,
  content_height: null,
  content_value: value,
  ...extra,
})

const param = (variable, label) => ({
  param_var: variable,
  param_label: label,
  param_default: null,
  param_required: true,
  param_type: 'text',
  param_sform: null,
  param_svalue: null,
  param_slabel: null,
})

/* หน้าตาเดียวกับ "ป้ายติดแฟ้ม (VN)": ตารางสองคอลัมน์ 60/40 ไม่มีเส้น ตัวหนา 14px/14px
   ซ้าย = ตัวผู้ป่วย · ขวา = วาร์ดต้นทาง แล้วเว้นบรรทัดก่อนเพศ/หมู่เลือด ให้เลย์เอาต์ตรงกับต้นแบบ
   🔴 pdfmake ไม่สน padding/margin ของ td — คุมตำแหน่งด้วย width เท่านั้น */
const stickerHtml = '<table style="width:100%;border-collapse:collapse;border:none;">\n' +
  '  <tbody>\n' +
  '    <tr>\n' +
  '      <td style="border:none;color:#000;width:60%;vertical-align:top;text-align:left;font-size:14px;line-height:14px;font-weight:bold;">' +
  '{{patient_name}}<br>HN {{hn}}<br>วันเกิด : {{birth_date_display}}<br>อายุ {{age_display}}</td>\n' +
  '      <td style="border:none;color:#000;width:40%;vertical-align:top;text-align:right;font-size:14px;line-height:14px;font-weight:bold;">' +
  '{{ward_display}}<br><br>{{gender_text}} {{blood_group}}</td>\n' +
  '    </tr>\n' +
  '  </tbody>\n' +
  '</table>'

const buildReportRecord = (
  sqlId = HN_STICKER_SQL_ID,
  reportId = HN_STICKER_REPORT_ID,
  timestamps = { createdAt: '2026-09-04 10:05:00', updatedAt: '2026-09-04 10:05:00' },
) => {
  if (!/^[a-f0-9]{24}$/i.test(String(sqlId || ''))) {
    throw new Error('--sql-id must be a 24-character SQL Factory record ID')
  }
  if (!/^[a-f0-9]{24}$/i.test(String(reportId || ''))) {
    throw new Error('--report-id must be a 24-character Report Factory record ID')
  }
  return {
    ...clone(reportTemplate),
    _id: oid(reportId),
    dataid: reportId,
    xparentx: oid(reportId),
    created_at: timestamps.createdAt,
    updated_at: timestamps.updatedAt,
    pdf_assign_roles: null,
    pdf_bg: null,
    pdf_category: null,
    pdf_column: [],
    pdf_content: [
      contentBase('html', 'widget_header', stickerHtml),
      /* barcode = HN (ต้นแบบใช้ VN) — JsBarcode CODE128 แท่งล้วน ไม่มีตัวเลขใต้แท่ง
         ค่า mt -16 / width 70 / height 8 ยกมาจากต้นแบบเพื่อให้ตกร่องเดียวกันบนสติ๊กเกอร์ */
      contentBase('barcode', 'widget_barcode', '{{hn}}', {
        content_align: 'right',
        content_mt: -16,
        content_width: 70,
        content_height: 8,
      }),
    ],
    pdf_custom_size: { width: PAGE_WIDTH_PT, height: PAGE_HEIGHT_PT },
    pdf_desc: 'ป้ายติดแฟ้มระดับผู้ป่วย: ชื่อ HN วันเกิด อายุ เพศ หมู่เลือด วาร์ดต้นทาง และบาร์โค้ด HN',
    pdf_fontsize: 11,
    pdf_form_id: VISIT_FORM_ID,
    pdf_from: VISIT,
    pdf_latex: null,
    pdf_mb: 3,
    pdf_ml: 1,
    pdf_mr: 4,
    pdf_mt: 1,
    pdf_name: 'ป้ายติดแฟ้ม (HN)',
    pdf_note: 'ค้นด้วย HN อย่างเดียว จึงใช้ปุ่ม HN ได้ทั้ง LAB และ X-ray; ห้ามเพิ่มข้อมูล Order/Accession/LAB NO. ลงในป้ายนี้ (ผู้ใช้กำหนด 2026-09-04)',
    pdf_orientation: 'landscape',
    pdf_page_date: false,
    pdf_page_num: false,
    pdf_page_size: 'custom',
    pdf_params: [param('hn', 'HN')],
    pdf_share: 'public',
    pdf_showheader: 'firstPage',
    pdf_sql: { value: oid(sqlId), label: 'HN Patient Sticker v1' },
    pdf_tags: ['HN', 'sticker', 'patient', 'label'],
    pdf_tb_header: [],
    pdf_tb_layout: '',
    pdf_temp: null,
    pdf_title: null,
    pdf_type: 'report',
    pdf_watermark: null,
    tool_license: TOOL_LICENSE,
  }
}

const cliValue = name => {
  const prefix = `--${name}=`
  const argument = process.argv.find(value => value.startsWith(prefix))
  return argument ? argument.slice(prefix.length).trim() : ''
}

const writeRecord = (filename, record) => {
  fs.mkdirSync(path.dirname(filename), { recursive: true })
  fs.writeFileSync(filename, `${JSON.stringify([record], null, 2)}\n`)
  console.log(`Wrote ${path.relative(ROOT, filename)}`)
}

if (require.main === module) {
  const sqlId = cliValue('sql-id') || HN_STICKER_SQL_ID
  const reportId = cliValue('report-id') || HN_STICKER_REPORT_ID
  const sqlOutput = sqlOutputForStamp(cliValue('sql-stamp') || SQL_STAMP)
  const reportOutput = reportOutputForStamp(cliValue('report-stamp') || REPORT_STAMP)
  if (!process.argv.includes('--report-only')) writeRecord(sqlOutput, buildSqlRecord(sqlId))
  writeRecord(reportOutput, buildReportRecord(sqlId, reportId))
  console.log(`Report data source SQL ID: ${sqlId}`)
  console.log(`Report record ID: ${reportId}`)
}

module.exports = {
  SQL_STAMP,
  REPORT_STAMP,
  SQL_OUTPUT,
  REPORT_OUTPUT,
  sqlOutputForStamp,
  reportOutputForStamp,
  HN_STICKER_SQL_ID,
  HN_STICKER_REPORT_ID,
  VISIT_FORM_ID,
  PAGE_WIDTH_PT,
  PAGE_HEIGHT_PT,
  HOSPITAL_NAME,
  outputVariables,
  nosqlPipeline,
  stickerHtml,
  buildSqlRecord,
  buildReportRecord,
}
