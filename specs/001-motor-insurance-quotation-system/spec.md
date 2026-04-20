# Feature Specification: Motor Insurance Search and Quotation System

**Feature Branch**: `001-motor-insurance-quotation-system`
**Created**: 2026-04-12
**Status**: Draft
**Input**: User description: "Build a Motor Insurance Search and Quotation System"

---

## User Scenarios & Testing *(mandatory)*

Users of this system fall into two groups:

- **Internal staff** (3–7 users today; roles: Admin, Manager, Senior Staff, Staff) who search
  plans, generate quotations, import data, and manage the system.
- **Future online users** (200–500 users) who will search and obtain quotations
  self-service — out of scope for this initial release but the system MUST be architected
  to accommodate them without re-engineering.

---

### User Story 1 — Search Insurance Plans (Priority: P1)

A staff member needs to quickly find all eligible insurance plans for a customer's vehicle.
They enter the vehicle make, model, and production year, select the desired plan type and
repair type, and the system returns a list of matching plans from all available insurance
companies — including premium, coverage summary, and excess amount.

**Why this priority**: This is the core daily task. Without reliable search, the system
delivers no value. Everything else (compare, quotation) depends on search results.

**Independent Test**: A staff member with no other features available can open the search
page, enter a vehicle (e.g., Toyota Corolla, 2020), choose plan type 1 (comprehensive),
garage repair, and see a ranked list of plans with premiums. This alone is a viable
demonstration of system value.

**Acceptance Scenarios**:

1. **Given** a staff member is logged in, **When** they search for a vehicle by make,
   model, and production year with a specific plan type and repair type, **Then** the
   system returns all matching published plans from all insurance companies, each showing
   the company name, plan type, repair type, premium, and key coverage fields.

2. **Given** a staff member applies optional filters (specific company, excess amount
   range), **When** results load, **Then** only plans matching the additional filter
   criteria are displayed, and the filter selections are visibly indicated on screen.

3. **Given** a vehicle's production year makes it ineligible for a plan (outside the
   company's accepted year range), **When** the staff member searches, **Then** that
   plan is excluded from results — no manual filtering required.

4. **Given** no plans match the search criteria, **When** the search executes, **Then**
   the system displays a clear "no results found" message and suggests broadening the
   search (e.g., removing optional filters).

5. **Given** more than 20 results match, **When** results are displayed, **Then** results
   are paginated and the total match count is shown.

---

### User Story 2 — Compare Plans Side-by-Side (Priority: P2)

A staff member or customer wants to evaluate multiple insurance plans before deciding.
They select up to 3 plans from the search results and the system presents a side-by-side
comparison table highlighting key coverage differences and premiums.

**Why this priority**: Comparison reduces the time to advise customers and improves
decision quality. It depends entirely on search results (P1) being available.

**Independent Test**: After searching for plans, a staff member selects 3 plans and
clicks "Compare". A comparison view appears showing the 3 plans in columns with rows
for each coverage attribute. This feature is complete without quotation generation.

**Acceptance Scenarios**:

1. **Given** a staff member has search results, **When** they select 2 or 3 plans and
   click "Compare", **Then** a side-by-side comparison table is displayed with one
   column per plan and one row per coverage field.

2. **Given** a comparison is displayed, **When** a coverage field differs between plans,
   **Then** the difference is visually highlighted to draw the staff member's attention.

3. **Given** a staff member tries to select a 4th plan while 3 are already selected,
   **When** they attempt to add it, **Then** the system prevents selection and shows a
   message: "Maximum 3 plans can be compared at once."

4. **Given** a comparison is displayed, **When** the staff member clicks "Generate
   Quotation" on one of the compared plans, **Then** they are taken to the quotation
   flow for that plan with plan details pre-filled.

---

### User Story 3 — Generate PDF Quotation (Priority: P2)

A staff member selects an insurance plan (from search results or comparison) and generates
a formal PDF quotation for a customer. The quotation document includes vehicle details,
customer information, coverage summary, premium breakdown, and validity period.

**Why this priority**: The quotation is the deliverable that closes the sales process.
It depends on plan selection from search/compare (P1/P2 stories above).

**Independent Test**: A staff member selects a plan, enters customer and vehicle details,
and clicks "Generate PDF". A downloadable PDF quotation is produced. This is independently
testable without the reporting or import features.

**Acceptance Scenarios**:

1. **Given** a staff member has selected a plan, **When** they enter the customer name,
   vehicle registration number (optional), and confirm details, **Then** the system
   generates a PDF quotation containing: company name, plan type, repair type, premium,
   coverage summary, excess, validity period, and the staff member's name as agent.

2. **Given** a quotation PDF is generated, **When** the staff member downloads it,
   **Then** the PDF is legible, correctly formatted, and contains no placeholder text
   or blank mandatory fields.

3. **Given** a quotation has been generated, **When** a manager views the quotation
   history, **Then** the quotation is listed with date, staff member, vehicle, plan,
   and premium — providing a traceable record.

---

### User Story 4 — User Account Management (Priority: P1)

An Admin or Manager needs to control who can access the system. They can create accounts
directly for known staff, or approve/reject self-registration requests submitted by
prospective users. Existing accounts can have their role or status changed.

**Why this priority**: Without user management, no one can access the system. This is a
prerequisite for all other user stories.

**Independent Test**: An Admin creates a Manager account. The Manager logs in and creates
a Staff account. A prospective user submits a self-registration; the Manager approves it
and the new user logs in. This entire flow works without any insurance data in the system.

**Acceptance Scenarios**:

1. **Given** an Admin or Manager is logged in, **When** they create a new user account
   with a name, email, role, and temporary password, **Then** the account is created,
   the user can log in with those credentials, and the action is recorded in the audit log.

2. **Given** a prospective user completes the self-registration form, **When** they
   submit it, **Then** their request enters a "Pending Approval" state, they receive
   on-screen confirmation, and a Manager or Admin is notified of the pending request.

3. **Given** a Manager or Admin views the pending registration list, **When** they
   approve a request, **Then** the user account is activated, the user can log in, and
   the approval action is recorded in the audit log with the approver's identity.

4. **Given** a Manager or Admin rejects a registration request, **When** they confirm
   rejection (optionally with a reason), **Then** the request is marked rejected, the
   account is not created, and the action is audit-logged.

5. **Given** an Admin views the user list, **When** they change a user's role or
   deactivate their account, **Then** the change takes effect immediately, and the
   action is recorded in the audit log.

---

### User Story 5 — Import Insurance Data (Priority: P1)

A Senior Staff member receives an updated insurance rate file from an insurance company
(Excel, CSV, or PDF) and uploads it into the system. The system normalizes the data into
the canonical model, flags any vehicle models or plan names that cannot be automatically
resolved, and creates an import batch for review.

**Why this priority**: Without data, search returns nothing. This story is the primary
data pipeline and must work before Search (US1) can be meaningfully demonstrated.

**Independent Test**: A Senior Staff member uploads an Excel file from a single insurance
company. The system creates an import batch, normalizes rows it can resolve, flags
unresolved rows, and presents the batch for review. This is testable without the search
or quotation features.

**Acceptance Scenarios**:

1. **Given** a Senior Staff member uploads a valid Excel or CSV file, **When** the
   import completes processing, **Then** the system creates an import batch record
   showing: source file name, upload date, uploaded by, total rows, rows resolved,
   and rows pending mapping review.

2. **Given** an imported row contains a vehicle model name not found in the mapping
   table, **When** import processing finishes, **Then** that row is flagged as
   "Pending Mapping" and does not enter the published data set until resolved.

3. **Given** a Senior Staff member uploads a PDF insurance schedule, **When** they
   confirm the file, **Then** the system presents a data entry form pre-populated with
   any OCR-extracted values (where OCR is available). The staff member corrects,
   completes, and confirms the data before it is saved as an import batch.

4. **Given** an uploaded file has an unrecognised format or is corrupted, **When** the
   system attempts to process it, **Then** the import is rejected with a clear error
   message describing the problem and no partial data is saved.

5. **Given** an import batch is created, **When** a Senior Staff member or Manager
   views the batch detail, **Then** each row is displayed with its source value, mapped
   canonical value (or "unresolved"), and current review status.

---

### User Story 6 — Review and Publish Imported Data (Priority: P1)

A Manager reviews pending import batches. For each batch they can accept or reject
individual records, resolve unmapped vehicle models or plan names through the mapping
tool, and publish the batch once satisfied — making the data available for search.

**Why this priority**: Publishing data is the gate between import and search. Without
an approved batch, imported data is not searchable. This story completes the data
pipeline started in US5.

**Independent Test**: A Manager opens a pending import batch (created in US5), maps
an unresolved vehicle model, approves individual records, and publishes the batch. The
published records then appear in a search. This is testable as a standalone approval flow.

**Acceptance Scenarios**:

1. **Given** a Manager views a pending import batch, **When** they click "Approve" on
   an individual record, **Then** the record moves to "Approved" status and the action
   is audit-logged with the Manager's identity and timestamp.

2. **Given** a record has an unresolved vehicle model, **When** the Manager opens the
   mapping resolution tool and selects or creates a canonical model mapping, **Then**
   the record's mapping status changes to "Resolved" and is ready for approval.

3. **Given** all records in a batch are either approved or intentionally rejected,
   **When** the Manager publishes the batch, **Then** all approved records become live
   and searchable, rejected records are retained in the batch with "Rejected" status
   but never deleted, and the publish action is audit-logged.

4. **Given** a Manager rejects an entire import batch, **When** they confirm rejection,
   **Then** none of the batch's records enter the published data set, all records are
   soft-marked as rejected, and the source file reference is preserved.

5. **Given** a batch is published, **When** a staff member immediately performs a
   search for a vehicle covered by the newly published data, **Then** the new plans
   appear in search results.

---

### User Story 7 — View Reports (Priority: P3)

A Manager or Admin needs visibility into system activity to monitor usage trends,
understand which vehicle models generate the most quotations, and track import quality
over time. They access pre-defined reports and can export them as PDF or Excel.

**Why this priority**: Reporting adds analytical value but is not required for the core
search-and-quotation workflow. It can be delivered after the primary stories are stable.

**Independent Test**: A Manager opens the Reports section and views a "Usage Statistics"
report showing quotations generated per day for the past 30 days, a "Top Models" report,
and an "Import Errors" report. Each report can be exported to PDF or Excel.

**Acceptance Scenarios**:

1. **Given** a Manager or Admin opens the Reports section, **When** they select "Usage
   Statistics", **Then** they see a summary of quotations generated per period
   (daily/weekly/monthly), filterable by date range.

2. **Given** a Manager or Admin views the "Top Vehicle Models" report, **When** the
   report loads, **Then** it shows the most-searched vehicle makes and models ranked by
   search frequency, for a user-selected date range.

3. **Given** a Manager or Admin views the "Import Errors" report, **When** it loads,
   **Then** it lists import batches with the count of unresolved, rejected, and approved
   records, allowing the Manager to identify companies or files with persistent data
   quality issues.

4. **Given** any report is displayed, **When** the user clicks "Export", **Then** the
   report is downloaded as a PDF or Excel file (user's choice) within 10 seconds.

---

### Edge Cases

- What happens when an insurance company updates rates mid-month? The existing published
  data remains searchable until a new import batch for that company is approved and
  published. Old data is never deleted — it is superseded by the new batch.
- What if the same vehicle model is spelt differently by two insurance companies? The
  mapping table resolves both spelling variants to the same canonical model. Search
  results aggregate plans from both sources under the canonical model name.
- What if a user's JWT token expires during an active session? The system returns an
  authentication error; the user is prompted to log in again (or a refresh token is
  used silently if refresh token support is enabled).
- What if a Manager bulk-approves a batch but some records still have unresolved
  mappings? The system MUST prevent publishing until all records are either explicitly
  approved or explicitly rejected. Unresolved records block publication.
- What if two Senior Staff members upload files from the same company on the same day?
  Both create separate import batches. Each must be reviewed independently.

---

## Requirements *(mandatory)*

### Functional Requirements

**Authentication & User Management**

- **FR-001**: The system MUST allow users to log in with their email address and a password.
- **FR-002**: The system MUST issue a time-limited access token on successful login.
- **FR-003**: The system MUST enforce role-based access; each role's permitted actions are
  defined in the Roles section below.
- **FR-004**: An Admin or Manager MUST be able to create a user account directly.
- **FR-005**: A prospective user MUST be able to submit a self-registration request that
  enters a pending state requiring Manager or Admin approval before activation.
- **FR-006**: An Admin MUST be able to deactivate or change the role of any user account.
- **FR-007**: The system MUST record login, user creation, approval, and privileged actions
  in an immutable audit log.

**Roles and Permissions**

| Permission | Admin | Manager | Senior Staff | Staff |
|---|:---:|:---:|:---:|:---:|
| Manage users (create, approve, deactivate, change role) | ✓ | ✓ | | |
| Import insurance data (upload files) | ✓ | ✓ | ✓ | |
| Manage mapping tables | ✓ | ✓ | ✓ | |
| Review and publish import batches | ✓ | ✓ | | |
| Search insurance plans | ✓ | ✓ | ✓ | ✓ |
| Compare plans | ✓ | ✓ | ✓ | ✓ |
| Generate PDF quotations | ✓ | ✓ | ✓ | ✓ |
| View reports | ✓ | ✓ | | |
| System configuration | ✓ | | | |

**Search**

- **FR-008**: The system MUST support searching published insurance plans by: vehicle make,
  vehicle model, production year, plan type (1 / 2 / 3 / 2+ / 3+), and repair type
  (garage or dealer).
- **FR-009**: The system MUST support optional search filters for insurance company and
  excess amount range.
- **FR-010**: The system MUST exclude plans where the vehicle's calculated age
  (CurrentYear − ProductionYear + 1) falls outside the plan's accepted year range.
- **FR-011**: Search results MUST be returned in under 2 seconds for any valid query.
- **FR-012**: Search results MUST be paginated when more than 20 plans match.

**Plan Comparison**

- **FR-013**: A user MUST be able to select up to 3 plans from search results for
  side-by-side comparison.
- **FR-014**: The comparison view MUST display all coverage attributes in aligned rows,
  one column per selected plan, with differences visually highlighted.

**Quotation Generation**

- **FR-015**: A user MUST be able to generate a PDF quotation for any selected plan by
  providing customer name and (optionally) vehicle registration number.
- **FR-016**: The generated PDF MUST include: insurance company name, plan type, repair
  type, premium amount, coverage summary, excess amount, validity period, and
  generating staff member's name. PDF generation is performed by a custom Spring Boot
  service (`POST /report`) that wraps JasperReports library; the service accepts
  `srcFile` (report template name), `outputType` (`PDF`), and up to 3 positional
  parameters (`param1`–`param3`).
- **FR-017**: Every generated quotation MUST be recorded in the system with the date,
  staff member, vehicle details, plan, and premium.

**Data Import**

- **FR-018**: The system MUST support uploading Excel (.xlsx) and CSV files for bulk
  data import.
- **FR-019**: The system MUST support uploading PDF files; OCR-extracted values (where
  available) MUST be presented for review and correction before saving.
- **FR-020**: Every import MUST create an import batch record containing: source file
  name, upload timestamp, uploader identity, and processing status.
- **FR-021**: Rows containing vehicle model names or plan names not found in the mapping
  tables MUST be flagged as "Pending Mapping" and excluded from published data until
  resolved.
- **FR-022**: Importing a file with an unrecognised or corrupted format MUST be rejected
  with a descriptive error message; no partial data MUST be saved.

**Mapping Management**

- **FR-023**: The system MUST maintain a vehicle model mapping table that resolves raw
  provider names to canonical vehicle models.
- **FR-024**: The system MUST maintain a plan name mapping table that resolves raw plan
  designations to canonical plan types (1 / 2 / 3 / 2+ / 3+).
- **FR-025**: A Senior Staff member or above MUST be able to add, edit, and view mapping
  entries. Edits to existing mappings MUST be audit-logged.

**Review & Approval**

- **FR-026**: A Manager or Admin MUST be able to approve or reject individual records
  within an import batch.
- **FR-027**: A Manager or Admin MUST be able to publish a batch only when all records
  are in "Approved" or "Rejected" status (no "Pending" or "Unresolved" records remain).
- **FR-028**: Published records MUST become immediately searchable.
- **FR-029**: Rejected records MUST be retained (soft-deleted/flagged) and never
  permanently removed.

**Reporting**

- **FR-030**: The system MUST provide a Usage Statistics report showing quotations
  generated over time, filterable by date range.
- **FR-031**: The system MUST provide a Top Vehicle Models report showing models ranked
  by search and quotation frequency.
- **FR-032**: The system MUST provide an Import Errors report showing batch-level counts
  of unresolved, rejected, and approved records per import.
- **FR-033**: All reports MUST be exportable as PDF or Excel.

### Key Entities

- **User**: System account holder; has a role (Admin / Manager / Senior Staff / Staff),
  status (Active / Pending / Inactive), and an audit trail of actions performed.
- **InsuranceCompany**: One of the 30+ insurance providers; has a canonical name and
  short code used across all modules.
- **VehicleMake**: Canonical make (e.g., Toyota, Honda). Shared across companies.
- **VehicleModel**: Canonical model (e.g., Corolla, Civic) linked to a make. The mapping
  table connects raw provider names to this canonical model.
- **InsurancePlan**: A published rate offered by one company for one canonical vehicle
  model range; has plan type, repair type, year range eligibility, coverage fields, and
  premium.
- **PlanTypeMapping**: Resolves a raw plan designation string (per company) to a
  canonical plan type code.
- **VehicleModelMapping**: Resolves a raw vehicle model string (per company) to a
  canonical VehicleModel.
- **ImportBatch**: A single upload event; groups all records from one file; tracks source
  file, uploader, timestamps, and overall status.
- **ImportRecord**: A single data row within a batch; carries both the raw source value
  and the resolved canonical value; has a mapping status and review status.
- **Quotation**: A generated quote record; links staff member, selected plan, customer
  name, vehicle details, premium at time of generation, and timestamp.
- **AuditLog**: Immutable record of security-significant events; stores actor, action
  type, affected entity, timestamp, and IP address.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Staff can find all eligible insurance plans for a given vehicle within
  2 seconds of submitting a search query.
- **SC-002**: Staff can generate a PDF quotation within 3 minutes of starting a search,
  from empty search form to downloaded PDF.
- **SC-003**: Managers can review and publish a complete import batch (up to 500 records)
  within one working session without system errors or performance degradation.
- **SC-004**: 100% of imported records are traceable to their source file, upload batch,
  and uploader identity.
- **SC-005**: Zero published records exist that have not passed Manager or Admin approval.
- **SC-006**: The system supports at least 30 insurance companies without any code change
  — only data and mapping configuration changes are required.
- **SC-007**: All user actions of a security-sensitive nature are recorded in the audit
  log with no gaps; the audit log cannot be modified by any user including Admin.
- **SC-008**: The system handles up to 50 concurrent internal users (future scalability
  target: 500 concurrent online users) without search latency exceeding 2 seconds.

---

## Assumptions

- **Scope**: This specification covers the initial internal-staff release (3–7 users).
  The architecture supports future online user self-service (200–500 users) but that
  workflow is out of scope for this release.
- **Data source format**: Insurance companies provide rate data as Excel, CSV, or PDF
  files. Real-time API feeds from insurance companies are out of scope.
- **OCR**: OCR extraction from PDF files is an optional enhancement. When unavailable
  or when extraction quality is low, staff complete data entry manually using the form.
  Full OCR automation (zero manual review) is explicitly out of scope.
- **Plan type codes**: The system uses the standard Thai motor insurance plan type
  designations: Type 1 (comprehensive), Type 2, Type 3, Type 2+, Type 3+.
- **Vehicle age calculation**: Vehicle age for eligibility checking is calculated as
  CurrentYear − ProductionYear + 1 (consistent with industry standard).
- **Single currency**: All premiums are in Thai Baht (THB). Multi-currency support is
  out of scope.
- **AI recommendation**: Automated plan recommendation based on user profile or history
  is explicitly out of scope.
- **External API integration**: No real-time connection to insurance company systems is
  required for this release. All data is imported manually.
- **Quotation validity**: Quotations are informational documents. Policy issuance and
  payment processing are out of scope.
- **Existing users at launch**: The Admin account will be provisioned during system
  setup; no bulk user migration is required.

---

## Clarifications

### Session 2026-04-12

- Q: What is the HTTP API contract for the custom JasperReports Spring Boot service? → A: `POST http://localhost:7030/report` with JSON body: `{ srcFile, outputFile, param1, param2, param3, outputType, forceDownload: true }`. Response is a file stream.
- Q: How does the JasperReports template receive the 12+ fields needed for the quotation PDF given only 3 positional params exist? → A: The `.jrxml` template connects directly to the PostgreSQL database and runs its own SQL query. Parameters (`param1`–`param3`) act as query conditions (e.g., `param1` = quotation UUID). The report fetches all required fields via SQL JOIN across quotations, insurance_plans, companies, and vehicle_models tables. → A: `POST http://localhost:7030/report` with JSON body: `{ srcFile, outputFile, param1, param2, param3, outputType, forceDownload: true }`. Response is a file stream. The service is a custom Spring Boot application wrapping the JasperReports library — **not** JasperReports Server. Base URL is configurable (default `http://localhost:7030/`).
