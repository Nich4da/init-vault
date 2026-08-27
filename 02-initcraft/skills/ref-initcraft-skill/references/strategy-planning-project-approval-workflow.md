# Strategy and Planning Project Approval Workflow

Source: Google Docs manual provided by user, `https://docs.google.com/document/d/1husPfRlu2gyxbWI6jYCBQvuWjcjD4nMT/edit`, exported 2026-07-08.

Use this reference when designing ERP forms, workflow states, validation rules, document checklists, reports, and dashboards for กลุ่มงานยุทธศาสตร์และแผนงาน.

## Scope

Manual title: คู่มือการปฏิบัติงาน การขออนุมัติจัดโครงการ.

Responsible unit: กลุ่มงานยุทธศาสตร์และแผนงาน.

Purpose: ensure projects are effective, aligned with organizational plans, resource-conscious, regulation-compliant, and trackable/evaluable.

## Key Definitions for Data Model

- Project: planned work made of multiple activities and resources to achieve objectives/targets.
- Activity: a prepared/planned action set with its own expected outcome and objective.
- Budget project: project funded by annual government budget.
- Maintenance-fund project: project funded by institute maintenance funds.
- Other-source project: project funded by other support sources outside budget/maintenance fund, including donation-like sources.
- Out-of-plan project: project not included in institute maintenance fund plan and requested during the fiscal year.
- Responsible unit: group/work unit in Queen Sirikit National Institute of Child Health.
- Project owner/responsible person: project writer/coordinator with name, position, unit, phone, and Gmail.

## Core Workflow After Project Approval

1. Plan activity execution.
   - Hold working-group meeting.
   - Set activity date/time/place.
   - Coordinate relevant parties.
   - Contact venue.
   - Prepare food/snacks/drinks.
   - Start procurement through procurement process when materials are needed.
   - Rule: procurement approval must be requested 30 days in advance.

2. Publicize activity.
   - Send invitation/announcement.
   - Collect participant list.

3. Request approval to hold activity and approve participant list.
   - Memo addressed to institute director through head of Strategy and Planning.
   - Include project name, project code, activity name, activity date/time/place, expense details, and participant list.

4. Request borrowing/advance money after activity approval.
   - Coordinate with Finance and Accounting.
   - Attach certified copies on every copied page.
   - Rule: borrowing request must be submitted at least 7 working days in advance.
   - Required attachments:
     - Copy of approved activity and approved participant list.
     - Activity agenda/schedule.
     - Borrowing contract.
     - Copy of project.
     - Copy of participant invitation / speaker invitation.

5. Prepare activity.
   - Order food/snacks/drinks.
   - Prepare venue.
   - Prepare chairperson invitation/opening-report speech.
   - Prepare training/activity documents.
   - Prepare satisfaction questionnaire and pre/post tests.
   - Prepare parking request for speakers when needed.
   - Prepare registration sheet and other operational documents.
   - Coordinate photographer.

6. Conduct activity.
   - Prepare receipt/payment voucher documents.
   - Take photos and collect proof of activity.
   - Collect evidence:
     - Receipts for food/snacks/drinks.
     - Satisfaction questionnaire / pre-post tests.
     - Photos and activity topics for public relations.
   - Rule: verify disbursement documents are complete.

7. Return money / disburse payment.
   - Collect documents:
     - Expense summary memo.
     - Tax invoice / substitute receipt certificate for food/snacks.
     - Speaker payment documents / speaker invitation / response form.
     - If speaker has home organization, include official response from that organization.
     - Training registration sheet.
     - Photos/activity evidence.
     - Copy of project and related memos/documents.
   - Rule: verify disbursement documents are complete.

8. Report and summarize project.
   - Report every activity result through Strategy and Planning Google Sheet.
   - Report monthly progress.
   - At project end, create project summary report with success details, outcomes, and photos.
   - Progress data is used for monthly head-of-unit meetings and Department of Medical Services reporting for important projects.

## Forms and Documents Mentioned

- Activity approval request.
- Borrowing contract.
- Payment voucher.
- Substitute receipt certificate.
- Example participant invitation memo.
- Example schedule/agenda.
- Example money return document.
- Progress report.

## Records and Storage

- Store paper documents in folders separated by fiscal year and project code.
- Progress reporting currently uses a Google Sheet supplied by Strategy and Planning.

## ERP Design Implications

Suggested modules:

- `project_master`: project identity, fiscal year, project type/source, responsible unit, owner/coordinator, strategic alignment, objectives, planned budget.
- `project_activity`: activity records under a project, activity date/time/place, target participants, agenda, status.
- `activity_approval`: request memo data, participant list, expenses, approval status, attachments.
- `advance_borrowing`: borrowing request, due dates, finance status, required attachments, certified-copy checklist.
- `procurement_tracking`: procurement-needed flag, 30-day deadline, procurement status, linked materials/items.
- `activity_execution`: preparation checklist, registration, questionnaires/tests, photos, PR topics.
- `disbursement_return`: expense summary, receipts, speaker payment docs, invoices, return/disbursement status.
- `monthly_progress`: monthly progress percent, spending, result narrative, issues, next steps, Google Sheet replacement/export.
- `final_report`: final success, outputs/outcomes, photos, closure status.

Suggested status flow:

```text
approved_project
-> planning_activity
-> publicizing
-> activity_approval_requested
-> activity_approved
-> borrowing_requested
-> borrowing_approved
-> preparing_activity
-> activity_completed
-> disbursement_pending
-> disbursement_completed
-> monthly_reporting
-> final_report_submitted
-> closed
```

Rules to enforce:

- Procurement-related requests should warn/block when activity date is less than 30 days away.
- Borrowing requests should warn/block when activity date is less than 7 working days away.
- Required attachment checklist should be tied to workflow stage.
- Monthly progress should be required until project closure.
- Participant list should be captured before activity approval.
- Activity evidence/photos should be required before final report/disbursement completion.
