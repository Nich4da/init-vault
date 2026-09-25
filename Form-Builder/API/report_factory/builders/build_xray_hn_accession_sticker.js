const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../../..')
const SQL_STAMP = '2026_09_02_19_00_00'
const REPORT_STAMP = '2026_09_02_19_10_00'

const SQL_TEMPLATE = path.join(
  ROOT,
  'Form-Builder/SDForm/sql-factory/exports/backup-data-module_sql-drug-label-all-sigs-2026_08_06.json',
)
const REPORT_TEMPLATE = path.join(
  ROOT,
  'Form-Builder/SDForm/report_factory/exports/backup-data-module_report-drug-label-8x6-figma-final-2026_08_06.json',
)
const SQL_OUTPUT = path.join(
  ROOT,
  `Form-Builder/SDForm/sql-factory/exports/backup-data-module_sql-Earn_admin-${SQL_STAMP}.json`,
)
const REPORT_OUTPUT = path.join(
  ROOT,
  `Form-Builder/SDForm/report_factory/exports/backup-data-module_report-Earn_admin-${REPORT_STAMP}.json`,
)
const sqlOutputForStamp = stamp => path.join(
  ROOT,
  `Form-Builder/SDForm/sql-factory/exports/backup-data-module_sql-Earn_admin-${stamp}.json`,
)
const reportOutputForStamp = stamp => path.join(
  ROOT,
  `Form-Builder/SDForm/report_factory/exports/backup-data-module_report-Earn_admin-${stamp}.json`,
)

/* Live Clone IDs confirmed read-only after the first import. Current packages are Upserts. */
const XRAY_HN_STICKER_SQL_ID = '6a980809422c1ca95982a053'
const XRAY_HN_STICKER_REPORT_ID = '6a980831422c1ca95982a054'

const ORDER_ITEM_FORM_ID = '6a6f7db2265885c2377cc222'
const TOOL_LICENSE = '6a3113a619ee74c8f82854a0'
const HOSPITAL_NAME = 'สถาบันสุขภาพเด็กแห่งชาติมหาราชินี'
const PAGE_WIDTH_PT = 8.5 * 72 / 2.54
const PAGE_HEIGHT_PT = 2 * 72 / 2.54

const BASE = 'zdata_cpoe_order_item'
const ORDER = 'zdata_cpoe_order'
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
  'hospital_name', 'accession_no', 'patient_name', 'birth_date_display',
  'age_display', 'print_date', 'hn', 'order_id', 'visit_id', 'item_id',
]

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

const nosqlPipeline = [
  {
    $addFields: {
      _order_key: { $toString: { $ifNull: ['$order_id.value', '$xparentx'] } },
      _item_key: { $toString: '$_id' },
    },
  },
  {
    $match: {
      xrstatx: { $nin: [0, 3] },
      _order_key: '{{order_id}}',
      _item_key: '{{item_id}}',
      $or: [{ 'service_type.value': 'xray' }, { service_type: 'xray' }],
    },
  },
  { $lookup: { from: ORDER, localField: 'order_id.value', foreignField: '_id', as: '_order_rows' } },
  { $addFields: { _order: { $arrayElemAt: ['$_order_rows', 0] } } },
  {
    $addFields: {
      _visit_key: { $toString: { $ifNull: ['$_order.xparentx', '$_order.vid.value'] } },
    },
  },
  {
    $match: {
      '_order.xrstatx': { $nin: [0, 3] },
      _visit_key: '{{visit_id}}',
    },
  },
  { $lookup: { from: VISIT, localField: '_order.xparentx', foreignField: '_id', as: '_visit_rows' } },
  {
    $addFields: {
      _visit: { $arrayElemAt: ['$_visit_rows', 0] },
      _patient: { $ifNull: [{ $arrayElemAt: ['$_visit_rows.pid', 0] }, '$_order.vid.pid'] },
    },
  },
  {
    $addFields: {
      _birth_raw: {
        $ifNull: [
          '$_patient.birth_date',
          { $ifNull: ['$_visit.birth_date', '$_order.vid.pid.birth_date'] },
        ],
      },
    },
  },
  {
    $addFields: {
      _birth_date: {
        $convert: { input: '$_birth_raw', to: 'date', onError: null, onNull: null },
      },
    },
  },
  {
    $project: {
      _id: 1,
      hospital_name: HOSPITAL_NAME,
      accession_no: { $ifNull: ['$accession_no', ''] },
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
      print_date: '{{printed_date}}',
      hn: { $ifNull: ['$_patient.hn', { $ifNull: ['$_order.vid.pid.hn', ''] }] },
      order_id: { $toString: '$_order._id' },
      visit_id: '$_visit_key',
      item_id: '$_item_key',
    },
  },
  { $limit: 1 },
]

const buildSqlRecord = (
  sqlId = XRAY_HN_STICKER_SQL_ID,
  timestamps = { createdAt: '2026-09-02 18:27:05', updatedAt: '2026-09-02 19:00:00' },
) => {
  if (!/^[a-f0-9]{24}$/i.test(String(sqlId || ''))) {
    throw new Error('--sql-id must be a 24-character SQL Factory record ID')
  }
  return ({
  ...clone(sqlTemplate),
  _id: oid(sqlId),
  dataid: sqlId,
  created_at: timestamps.createdAt,
  updated_at: timestamps.updatedAt,
  nosql_collections: JSON.stringify([BASE]),
  nosql_filter: null,
  nosql_options: null,
  nosql_pipeline: JSON.stringify(nosqlPipeline),
  nosql_type: 'aggregate',
  pg_sql: null,
  sql_assign_roles: null,
  sql_category: null,
  sql_desc: 'ข้อมูลสติ๊กเกอร์ HN สำหรับ X-ray item ที่กด: ผู้ป่วย วันเกิด อายุ HN และ Accession No.',
  sql_form_id: { value: ORDER_ITEM_FORM_ID, label: 'CPOE Order Item' },
  sql_from: BASE,
  sql_group_by: null,
  sql_join: [],
  sql_limit: null,
  sql_name: 'X-ray HN Accession Sticker v1',
  sql_note: 'Fail-closed ด้วย order_id + visit_id + item_id; เปิดพิมพ์ได้ก่อนมี Accession และเมื่อมีเลขจะคืนของ item ที่กดเท่านั้น',
  sql_options: {
    variable: outputVariables.map(name => ({ vname: name, origin: name, as: null })),
    param: [
      { pname: 'order_id', ptype: 'text', pdefault: null },
      { pname: 'visit_id', ptype: 'text', pdefault: null },
      { pname: 'item_id', ptype: 'text', pdefault: null },
      { pname: 'printed_date', ptype: 'text', pdefault: null },
    ],
  },
  sql_order_by: [],
  sql_rstat: false,
  sql_select: [],
  sql_share: 'public',
  sql_tags: ['XRAY', 'HN', 'accession', 'sticker'],
  sql_type: 'nosql',
  sql_where: null,
  tool_feature: 'sql',
  tool_license: TOOL_LICENSE,
  })
}

const contentBase = (widget, variable, value, extra = {}) => ({
  content_widget: widget,
  content_var: variable,
  content_align: 'left',
  content_decoration: '',
  content_linestyle: 'dotted',
  content_bold: false,
  content_italics: false,
  content_color: '#000000',
  content_bgcolor: null,
  content_fontsize: 11,
  content_ml: null,
  content_mt: null,
  content_mr: null,
  content_mb: 0,
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

const stickerHtml = '<table style="width:100%;border-collapse:collapse;border:none;table-layout:fixed;font-size:8px;line-height:9px;margin:0;padding:0"><colgroup><col style="width:57%"><col style="width:43%"></colgroup><tr><td style="border:none;padding:0;font-size:7px;font-weight:bold;white-space:nowrap">{{hospital_name}}</td><td style="border:none;padding:0;text-align:right;font-size:7px;font-weight:bold;white-space:nowrap">{{accession_no}}</td></tr><tr><td colspan="2" style="border:none;padding:0;font-size:8px;font-weight:bold;white-space:nowrap">{{patient_name}}</td></tr><tr><td style="border:none;padding:0;white-space:nowrap"><b>วันเกิด</b> {{birth_date_display}}</td><td style="border:none;padding:0;white-space:nowrap"><b>อายุ</b> {{age_display}}</td></tr><tr><td style="border:none;padding:0;white-space:nowrap"><b>วันที่</b> {{print_date}}</td><td style="border:none;padding:0;white-space:nowrap"><b>HN</b> {{hn}}</td></tr></table>'

const buildReportRecord = (
  sqlId = XRAY_HN_STICKER_SQL_ID,
  reportId = XRAY_HN_STICKER_REPORT_ID,
  timestamps = { createdAt: '2026-09-02 18:27:45', updatedAt: '2026-09-02 19:10:00' },
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
    created_at: timestamps.createdAt,
    updated_at: timestamps.updatedAt,
    pdf_assign_roles: null,
    pdf_bg: null,
    pdf_category: null,
    pdf_column: [],
    pdf_content: [contentBase('html', 'hn_accession_sticker', stickerHtml, { content_fontsize: 8 })],
    pdf_custom_size: { width: PAGE_WIDTH_PT, height: PAGE_HEIGHT_PT },
    pdf_desc: 'สติ๊กเกอร์ HN ผู้ป่วย X-ray พร้อม Accession No. ของรายการที่กด ขนาด 8.5 × 2 ซม.',
    pdf_fontsize: 8,
    pdf_form_id: ORDER_ITEM_FORM_ID,
    pdf_from: BASE,
    pdf_latex: null,
    pdf_mb: 2,
    pdf_ml: 4,
    pdf_mr: 4,
    pdf_mt: 2,
    pdf_name: 'X-ray HN Accession Sticker 8.5x2 cm v2',
    pdf_note: 'พิมพ์จากปุ่มระดับ X-ray item ได้ก่อนมี Accession; เมื่อมีเลขต้องแสดงของ item ที่กดเท่านั้น; ใช้คำว่า วันเกิดแทน DOB',
    pdf_orientation: 'landscape',
    pdf_page_date: false,
    pdf_page_num: false,
    pdf_page_size: 'custom',
    pdf_params: [
      param('order_id', 'Order ID'),
      param('visit_id', 'Visit ID'),
      param('item_id', 'Item ID'),
      param('printed_date', 'วันที่พิมพ์'),
    ],
    pdf_share: 'private',
    pdf_showheader: 'firstPage',
    pdf_sql: { value: oid(sqlId), label: 'X-ray HN Accession Sticker v1' },
    pdf_tags: ['XRAY', 'HN', 'accession', 'sticker'],
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
  const sqlId = cliValue('sql-id') || XRAY_HN_STICKER_SQL_ID
  const reportId = cliValue('report-id') || XRAY_HN_STICKER_REPORT_ID
  const sqlStamp = cliValue('sql-stamp') || SQL_STAMP
  const reportStamp = cliValue('report-stamp') || REPORT_STAMP
  const sqlCreatedAt = cliValue('sql-created-at') || '2026-09-02 18:27:05'
  const sqlUpdatedAt = cliValue('sql-updated-at') || '2026-09-02 19:00:00'
  const reportCreatedAt = cliValue('report-created-at') || '2026-09-02 18:27:45'
  const reportUpdatedAt = cliValue('report-updated-at') || '2026-09-02 19:10:00'
  const sqlOutput = sqlOutputForStamp(sqlStamp)
  const reportOutput = reportOutputForStamp(reportStamp)
  if (!process.argv.includes('--report-only')) writeRecord(
    SQL_OUTPUT === sqlOutput ? SQL_OUTPUT : sqlOutput,
    buildSqlRecord(sqlId, { createdAt: sqlCreatedAt, updatedAt: sqlUpdatedAt }),
  )
  writeRecord(REPORT_OUTPUT === reportOutput ? REPORT_OUTPUT : reportOutput, buildReportRecord(
    sqlId,
    reportId,
    { createdAt: reportCreatedAt, updatedAt: reportUpdatedAt },
  ))
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
  XRAY_HN_STICKER_SQL_ID,
  XRAY_HN_STICKER_REPORT_ID,
  PAGE_WIDTH_PT,
  PAGE_HEIGHT_PT,
  HOSPITAL_NAME,
  outputVariables,
  nosqlPipeline,
  stickerHtml,
  buildSqlRecord,
  buildReportRecord,
}
