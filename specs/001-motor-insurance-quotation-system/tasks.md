# Tasks: Motor Insurance Search and Quotation System

**Input**: Design documents from `/specs/001-motor-insurance-quotation-system/`
**Prerequisites**: plan.md ✓ · spec.md ✓ · research.md ✓ · data-model.md ✓ · contracts/ ✓

**Organization**: Tasks grouped by user story to enable independent implementation and testing per story.
**Tests**: Integration tests included for search (p95 SLA) and import pipeline (critical paths).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependency on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US7, maps to spec.md)

## Path Conventions

```
backend/src/Ihos.Domain/         ← Entities, enums, domain events
backend/src/Ihos.Application/    ← Use cases, commands, queries, validators
backend/src/Ihos.Infrastructure/ ← EF Core, JWT, parsers, JasperReports, email
backend/src/Ihos.API/            ← Controllers, middleware, startup
backend/tests/                   ← Unit + integration tests
frontend/src/app/                ← Angular feature modules
reports/templates/               ← JasperReports .jrxml files
docker/                          ← Docker Compose config
```

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project scaffolding and infrastructure configuration. No user story work until this is complete.

- [X] T001 Create .NET 10 solution with four projects: `Ihos.Domain`, `Ihos.Application`, `Ihos.Infrastructure`, `Ihos.API` in `backend/`
- [X] T002 Create Angular 19 workspace with lazy-loaded feature modules: `auth`, `admin`, `import`, `mapping`, `search`, `quotation`, `reporting` in `frontend/`
- [X] T003 [P] Configure Docker Compose with PostgreSQL 16, JasperReports Server CE, and MailHog in `docker/docker-compose.yml`
- [X] T004 [P] Add NuGet packages to solution: `MediatR`, `FluentValidation.AspNetCore`, `Microsoft.AspNetCore.Authentication.JwtBearer`, `Npgsql.EntityFrameworkCore.PostgreSQL`, `ClosedXML`, `CsvHelper`, `Isopoh.Cryptography.Argon2`, `MailKit` in `backend/`
- [X] T005 [P] Configure Tailwind CSS and Angular Material in `frontend/` per `design.md` token values (primary #006874, secondary #8c4f00, tertiary #435d98)
- [X] T006 [P] Register MediatR pipeline with FluentValidation behavior and logging behavior in `backend/src/Ihos.API/Program.cs`
- [X] T007 [P] Configure `appsettings.Development.json.example` with JWT, DB, JasperReports, and SMTP placeholders in `backend/src/Ihos.API/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core domain conventions, DB context, auth middleware, and audit infrastructure that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T008 Create `BaseEntity` abstract class with `Id` (UUID), `CreatedAt`, `UpdatedAt`, `IsDeleted`, `CreatedBy` in `backend/src/Ihos.Domain/Common/BaseEntity.cs`
- [X] T009 [P] Create `ICurrentUserService` interface and `HttpContextCurrentUserService` implementation (reads JWT claims) in `backend/src/Ihos.Application/Common/Interfaces/ICurrentUserService.cs` and `backend/src/Ihos.Infrastructure/Services/CurrentUserService.cs`
- [X] T010 [P] Create `AuditLog` entity (no `IsDeleted`, immutable) and `IAuditLogRepository` interface in `backend/src/Ihos.Domain/Entities/AuditLog.cs` and `backend/src/Ihos.Application/Common/Interfaces/`
- [X] T011 Create `ApplicationDbContext` with `AuditLog` DbSet, `SaveChangesAsync` override for `UpdatedAt` auto-stamp, and `ICurrentUserService` injection in `backend/src/Ihos.Infrastructure/Persistence/ApplicationDbContext.cs`
- [X] T012 Create initial EF Core migration creating `audit_logs` table in `backend/src/Ihos.Infrastructure/Migrations/`
- [X] T013 [P] Configure JWT Bearer authentication (HS256, validate lifetime, validate issuer/audience) in `backend/src/Ihos.API/Program.cs`
- [X] T014 [P] Configure global error handling middleware (map domain exceptions to HTTP status codes), CORS policy, and Serilog request logging in `backend/src/Ihos.API/Middleware/`
- [X] T015 [P] Define `AuthorizationPolicies` constants and register role-based policies (`RequireAdmin`, `RequireManager`, `RequireSeniorStaff`) in `backend/src/Ihos.API/Authorization/AuthorizationPolicies.cs`

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel.

---

## Phase 3: User Story 4 — User Account Management (Priority: P1) 🎯 MVP prerequisite

**Goal**: Admin can create accounts via invite; users set passwords; self-registration enters pending approval; managers approve/reject; all actions audit-logged.

**Independent Test**: Admin logs in → invites a Manager → Manager accepts invite and logs in → Manager invites a Staff user → Staff user logs in → Admin views audit log showing all events.

### Backend — US4

- [X] T016 [P] [US4] Create `User` domain entity (email, fullName, passwordHash, role enum, status enum, inviteTokenHash, inviteExpiresAt) extending `BaseEntity` in `backend/src/Ihos.Domain/Entities/User.cs`
- [X] T017 [P] [US4] Create `RefreshToken` entity (userId, tokenHash, expiresAt, revokedAt) in `backend/src/Ihos.Domain/Entities/RefreshToken.cs`
- [X] T018 [US4] Add `users` and `refresh_tokens` DbSets to `ApplicationDbContext` with Fluent API config (unique indexes on email, token_hash) and create EF Core migration in `backend/src/Ihos.Infrastructure/Migrations/`
- [X] T019 [US4] Implement `UserRepository` and `RefreshTokenRepository` implementing their respective interfaces in `backend/src/Ihos.Infrastructure/Repositories/`
- [X] T020 [P] [US4] Implement `Argon2idPasswordHasher` (hash + verify, OWASP params: memory=65536, iterations=3, parallelism=4) in `backend/src/Ihos.Infrastructure/Services/Argon2idPasswordHasher.cs`
- [X] T021 [P] [US4] Implement `JwtTokenService` (generate signed access JWT with sub/role/jti claims, generate + hash refresh UUID, validate + rotate refresh token) in `backend/src/Ihos.Infrastructure/Services/JwtTokenService.cs`
- [X] T022 [US4] Implement `LoginCommand` + handler (verify password, issue JWT pair, audit log success/failure, return 403 if Inactive/PendingInvite) in `backend/src/Ihos.Application/Auth/Commands/LoginCommand.cs`
- [X] T023 [US4] Implement `RefreshTokenCommand` + handler (validate hash, rotate, return new pair) in `backend/src/Ihos.Application/Auth/Commands/RefreshTokenCommand.cs`
- [X] T024 [US4] Implement `LogoutCommand` + handler (revoke refresh token, audit log) in `backend/src/Ihos.Application/Auth/Commands/LogoutCommand.cs`
- [X] T025 [US4] Implement `InviteUserCommand` + handler (create user with status PendingInvite, generate UUID token, hash + store, send email with invite link via `IEmailService`) in `backend/src/Ihos.Application/Users/Commands/InviteUserCommand.cs`
- [X] T026 [US4] Implement `AcceptInviteCommand` + handler (validate token hash + expiry, set passwordHash, clear token, set status Active, auto-login) in `backend/src/Ihos.Application/Users/Commands/AcceptInviteCommand.cs`
- [X] T027 [US4] Implement `SelfRegisterCommand` + handler (create user status PendingApproval, no auto-login) in `backend/src/Ihos.Application/Auth/Commands/SelfRegisterCommand.cs`
- [X] T028 [US4] Implement `ApproveRegistrationCommand` + `RejectRegistrationCommand` handlers (set status Active/Rejected, audit log with approver identity) in `backend/src/Ihos.Application/Users/Commands/`
- [X] T029 [US4] Implement `ChangeUserRoleCommand` + `DeactivateUserCommand` handlers (Admin only, audit log) in `backend/src/Ihos.Application/Users/Commands/`
- [X] T030 [US4] Implement `GetUsersQuery` (paginated, filterable by role/status) and `GetPendingRegistrationsQuery` in `backend/src/Ihos.Application/Users/Queries/`
- [X] T031 [US4] Implement `MailKitEmailService` (SMTP invite link delivery, configurable host/port/from) in `backend/src/Ihos.Infrastructure/Services/MailKitEmailService.cs`
- [X] T032 [US4] Create `AuthController` (POST login, POST refresh, POST logout, POST register, POST invite/accept) with correct role guards in `backend/src/Ihos.API/Controllers/AuthController.cs`
- [X] T033 [US4] Create `UsersController` (GET list, POST invite, PUT role, PUT status, GET registrations/pending, PUT registrations/{id}/approve, PUT registrations/{id}/reject) in `backend/src/Ihos.API/Controllers/UsersController.cs`

### Frontend — US4

- [X] T034 [P] [US4] Create `AuthService` (Angular Signal for currentUser, login(), logout(), refreshToken(), hasRole()) in `frontend/src/app/core/auth.service.ts`
- [X] T035 [P] [US4] Create `JwtInterceptor` (attach Bearer token, handle 401 → attempt refresh → redirect to login on failure) in `frontend/src/app/core/jwt.interceptor.ts`
- [X] T036 [US4] Create login page component (email + password form, error states) in `frontend/src/app/auth/login/login.component.ts`
- [X] T037 [US4] Create accept-invite page (token from URL, set password form, auto-login on success) in `frontend/src/app/auth/accept-invite/accept-invite.component.ts`
- [X] T038 [US4] Create self-registration page (name, email, password form, pending confirmation message) in `frontend/src/app/auth/register/register.component.ts`
- [X] T039 [US4] Create `AuthGuard` (redirect to login if no token) and `RoleGuard` (redirect to 403 if insufficient role) in `frontend/src/app/core/guards/`
- [X] T040 [US4] Create user management page (paginated user table, invite modal with role selector, role change action) in `frontend/src/app/admin/users/users.component.ts`
- [X] T041 [US4] Create pending registrations component (list with approve/reject buttons and reason modal) in `frontend/src/app/admin/registrations/registrations.component.ts`
- [X] T042 [US4] Configure app routing (lazy modules, AuthGuard on all protected routes, role constraints) in `frontend/src/app/app.routes.ts`

**Checkpoint**: US4 complete — login, invite, and user management are fully functional and testable independently.

---

## Phase 4: User Story 5 — Import Insurance Data (Priority: P1)

**Goal**: Senior Staff uploads Excel/CSV; system parses, resolves mappings where possible, flags unresolved, creates batch for review.

**Independent Test**: Upload `samples/excel/sample_rates.xlsx` → batch created → batch detail shows resolved + pending rows → parse-fail file returns structured error report with no batch created.

### Backend — US5

- [X] T043 [P] [US5] Create `InsuranceCompany` entity (name, shortCode, isActive) in `backend/src/Ihos.Domain/Entities/InsuranceCompany.cs`
- [X] T044 [P] [US5] Create `VehicleMake` and `VehicleModel` entities (make→model 1:N, subModel optional) in `backend/src/Ihos.Domain/Entities/`
- [X] T045 [P] [US5] Create `VehicleModelMapping` entity (companyId, rawName, canonicalModelId, isAutoSuggested) and `PlanTypeMapping` entity (companyId, rawName, canonicalPlanType enum) in `backend/src/Ihos.Domain/Entities/`
- [X] T046 [P] [US5] Create `ImportBatch` entity (companyId, sourceFileName, sourceFilePath, uploadedBy, status enum, row counts) and `ImportRecord` entity (batchId, rowNumber, rawData JSONB, mappingStatus, reviewStatus) in `backend/src/Ihos.Domain/Entities/`
- [X] T047 [US5] Add all new entities to `ApplicationDbContext`, define unique constraints (`(companyId, rawName)` on mapping tables, `(companyId, rawName)` unique), create EF Core migration in `backend/src/Ihos.Infrastructure/Migrations/`
- [X] T048 [US5] Implement `ImportBatchRepository` and `ImportRecordRepository` in `backend/src/Ihos.Infrastructure/Repositories/`
- [X] T049 [US5] Implement `ExcelImportParser` using ClosedXML (column mapping per company config, structured error on parse fail with row+column+reason) in `backend/src/Ihos.Infrastructure/Import/ExcelImportParser.cs`
- [X] T050 [US5] Implement `CsvImportParser` using CsvHelper (same error contract as Excel parser) in `backend/src/Ihos.Infrastructure/Import/CsvImportParser.cs`
- [X] T051 [US5] Implement `MappingResolverService` (exact match lookup → Levenshtein auto-suggest ≤2 distance → mark PendingMapping if unresolved) in `backend/src/Ihos.Application/Import/Services/MappingResolverService.cs`
- [X] T052 [US5] Implement `UploadImportFileCommand` + handler (select parser by extension, parse, create ImportBatch + ImportRecords with mapping resolution, return batch summary) in `backend/src/Ihos.Application/Import/Commands/UploadImportFileCommand.cs`
- [X] T053 [US5] Implement `GetImportBatchesQuery` (paginated, filterable by company/status/date) and `GetImportBatchDetailQuery` (batch + paginated records) in `backend/src/Ihos.Application/Import/Queries/`
- [X] T054 [US5] Create `ImportsController` (POST upload multipart, GET batches, GET batches/{id}, GET batches/{id}/records) in `backend/src/Ihos.API/Controllers/ImportsController.cs`

### Frontend — US5

- [X] T055 [P] [US5] Create `ImportApiService` (typed HTTP wrapper: upload, getBatches, getBatchDetail, getRecords) in `frontend/src/app/core/import-api.service.ts`
- [X] T056 [US5] Create import upload page (company selector dropdown, file drag-and-drop, upload progress, parse error display with row/column table) in `frontend/src/app/import/upload/upload.component.ts`
- [X] T057 [US5] Create import batch list page (paginated table with company, date, status, row counts) in `frontend/src/app/import/batch-list/batch-list.component.ts`
- [X] T058 [US5] Create import batch detail page (batch header + virtual-scrolled records table showing rawData, resolvedValue, mappingStatus, reviewStatus) in `frontend/src/app/import/batch-detail/batch-detail.component.ts`

**Checkpoint**: US5 complete — upload, parse errors, and batch browsing are fully functional.

---

## Phase 5: User Story 6 — Review and Publish (Priority: P1)

**Goal**: Manager approves/rejects individual records, resolves unmapped models, publishes batch; plans become searchable.

**Independent Test**: Open pending batch → approve 3 records → reject 1 → resolve unmapped model → publish → search returns plans from that batch.

### Backend — US6

- [X] T059 [P] [US6] Create `InsurancePlan` entity (companyId, vehicleModelId, planType, repairType, minYear, maxYear, sumInsured, premiumTotal, excessAmount, coverageDetails JSONB, sourceImportRecordId, sourceBatchId, isPublished) in `backend/src/Ihos.Domain/Entities/InsurancePlan.cs`
- [X] T060 [US6] Add `insurance_plans` DbSet to context, define unique constraint `(companyId, vehicleModelId, planType, repairType, minYear, maxYear)` and partial search indexes (`WHERE is_published AND NOT is_deleted`), create EF Core migration in `backend/src/Ihos.Infrastructure/Migrations/`
- [X] T061 [US6] Implement `InsurancePlanRepository` in `backend/src/Ihos.Infrastructure/Repositories/InsurancePlanRepository.cs`
- [X] T062 [US6] Implement `ApproveImportRecordCommand` handler (set reviewStatus=Approved, audit log) — reject if mappingStatus=PendingMapping, return 409 in `backend/src/Ihos.Application/Import/Commands/ApproveImportRecordCommand.cs`
- [X] T063 [US6] Implement `RejectImportRecordCommand` handler (set reviewStatus=Rejected, optional reason, audit log) in `backend/src/Ihos.Application/Import/Commands/RejectImportRecordCommand.cs`
- [X] T064 [US6] Implement `PublishImportBatchCommand` handler (verify no Pending/Unresolved records remain → 409 if any, create/update InsurancePlan records with is_published=true, set batch status=Published, audit log) in `backend/src/Ihos.Application/Import/Commands/PublishImportBatchCommand.cs`
- [X] T065 [US6] Add approve, reject, and publish endpoints to `ImportsController` in `backend/src/Ihos.API/Controllers/ImportsController.cs`
- [X] T066 [US6] Implement `GetVehicleModelMappingsQuery`, `CreateVehicleModelMappingCommand`, `UpdateVehicleModelMappingCommand` and plan-type equivalents in `backend/src/Ihos.Application/Mapping/`
- [X] T067 [US6] Create `MappingsController` (GET/POST/PUT vehicle-models, GET/POST/PUT plan-types) with Senior Staff minimum role in `backend/src/Ihos.API/Controllers/MappingsController.cs`

### Frontend — US6

- [X] T068 [US6] Add approve/reject action buttons to each record row in batch detail, plus batch-level publish button (disabled while pending records exist) in `frontend/src/app/import/batch-detail/batch-detail.component.ts`
- [X] T069 [US6] Create vehicle model mapping page (paginated mapping table, create/edit mapping dialog with canonical model search) in `frontend/src/app/mapping/vehicle-models/vehicle-models.component.ts`
- [X] T070 [US6] Create plan type mapping page (table, create/edit mapping dialog with canonical plan type dropdown) in `frontend/src/app/mapping/plan-types/plan-types.component.ts`

**Checkpoint**: US5 + US6 complete — full import pipeline from upload to published/searchable plans.

---

## Phase 6: User Story 1 — Search Insurance Plans (Priority: P1)

**Goal**: Staff searches published plans by vehicle + plan criteria; results paginated and sorted by price ascending by default; year eligibility enforced.

**Independent Test**: Staff logs in → enters Toyota Corolla 2020, Type 1, Garage → sees plans sorted by premium ascending → applies optional company filter → changes sort to sum_insured_desc → page 2 loads correctly.

### Backend — US1

- [X] T071 [US1] Implement `SearchPlansQuery` + handler (filter on vehicleModelId, planType, repairType, year eligibility `minYear ≤ age ≤ maxYear`, optional company/excess filters, default sort premiumTotal ASC, paginate 20/page) using partial indexes in `backend/src/Ihos.Application/Search/Queries/SearchPlansQuery.cs`
- [X] T072 [US1] Implement `GetPlanDetailQuery` + handler in `backend/src/Ihos.Application/Search/Queries/GetPlanDetailQuery.cs`
- [X] T073 [US1] Create `PlansController` (GET search, GET {id}) with Staff minimum role in `backend/src/Ihos.API/Controllers/PlansController.cs`
- [X] T074 [US1] Write xUnit integration test (Testcontainers) verifying: results within 2 seconds, year filter excludes ineligible plans, no-result case returns empty array, page 2 returns correct offset in `backend/tests/Ihos.API.IntegrationTests/Search/SearchPlansTests.cs`

### Frontend — US1

- [X] T075 [US1] Create `SearchApiService` (typed HTTP: search, getDetail) in `frontend/src/app/core/search-api.service.ts`
- [X] T076 [US1] Create cascading vehicle make/model selector (make dropdown → loads models, signals-based) in `frontend/src/app/shared/vehicle-selector/vehicle-selector.component.ts`
- [X] T077 [US1] Create search form component (make/model selector, year input, plan type select, repair type toggle, optional company/excess filters, submit button) in `frontend/src/app/search/search-form/search-form.component.ts`
- [X] T078 [US1] Create search results list component (plan cards with company, premium, sum insured, excess, coverage summary; sort toggle price/sum-insured; pagination; no-results empty state) in `frontend/src/app/search/results/results.component.ts`
- [X] T079 [US1] Create search page shell (form + results layout, routing) in `frontend/src/app/search/search.routes.ts`

**Checkpoint**: US1 complete — search is fully functional end-to-end and meets the 2s SLA.

---

## Phase 7: User Story 2 — Compare Plans Side-by-Side (Priority: P2)

**Goal**: User selects up to 3 plans; side-by-side comparison highlights differences; "Generate Quotation" flows into quotation creation.

**Independent Test**: Search → select 3 plans → click Compare → comparison table shows 3 columns with highlighted differences → trying to add a 4th shows "Maximum 3" message.

### Backend — US2

- [X] T080 [US2] Implement `GetMultiplePlansQuery` + handler (fetch list by IDs, max 3, return full detail per plan) in `backend/src/Ihos.Application/Search/Queries/GetMultiplePlansQuery.cs`
- [X] T081 [US2] Add `GET /plans/compare?ids=id1,id2,id3` endpoint to `PlansController` in `backend/src/Ihos.API/Controllers/PlansController.cs`

### Frontend — US2

- [X] T082 [US2] Add plan selection state (Signal, max 3 with toast on overflow) and "Compare" button to search results in `frontend/src/app/search/results/results.component.ts`
- [X] T083 [US2] Create compare view component (side-by-side table, one column per plan, highlight differing cells, "Generate Quotation" button per plan column) in `frontend/src/app/search/compare/compare.component.ts`
- [X] T084 [US2] Add compare route and navigation from results to compare view in `frontend/src/app/search/search.routes.ts`

**Checkpoint**: US1 + US2 complete — search and compare work independently.

---

## Phase 8: User Story 3 — Generate PDF Quotation (Priority: P2)

**Goal**: Staff selects a plan, enters customer details, downloads a PDF quotation; quotation recorded with premium snapshot.

**Independent Test**: From search results select a plan → fill customer name → click Generate → PDF downloads → quotation appears in history with correct date, staff, plan, and premium.

### Backend — US3

- [X] T085 [P] [US3] Create `Quotation` entity (createdBy, planId, customerName, vehicleRegistration, vehicleMake, vehicleModelName, vehicleYear, premiumAtGeneration, generatedAt) in `backend/src/Ihos.Domain/Entities/Quotation.cs`
- [X] T086 [US3] Add `quotations` DbSet, create EF Core migration in `backend/src/Ihos.Infrastructure/Migrations/`
- [X] T087 [US3] Implement `JasperReportsClient` (HTTP Basic auth, POST to `/rest_v2/reports/reports/ihos/quotation.pdf` with parameters, return PDF byte stream, 10s timeout) in `backend/src/Ihos.Infrastructure/Reporting/JasperReportsClient.cs`
- [X] T088 [US3] Create `quotation.jrxml` report template (company name, plan type, repair type, premium, coverage summary, excess, validity period, agent name, generated date) in `reports/templates/quotation.jrxml`
- [X] T089 [US3] Implement `GenerateQuotationCommand` + handler (persist Quotation record with premium snapshot, call JasperReportsClient, return PDF blob + quotation ID) in `backend/src/Ihos.Application/Quotation/Commands/GenerateQuotationCommand.cs`
- [X] T090 [US3] Implement `GetQuotationPdfQuery` + `GetQuotationsQuery` (paginated history) in `backend/src/Ihos.Application/Quotation/Queries/`
- [X] T091 [US3] Create `QuotationsController` (POST generate, GET {id}/pdf as file stream, GET list for history) in `backend/src/Ihos.API/Controllers/QuotationsController.cs`

### Frontend — US3

- [X] T092 [US3] Create quotation form component (customer name input, optional vehicle registration, pre-filled plan summary card, Generate button) in `frontend/src/app/quotation/form/quotation-form.component.ts`
- [X] T093 [US3] Create `QuotationService` (HTTP: generate, downloadPdf as Blob, getHistory) in `frontend/src/app/quotation/quotation.service.ts`
- [X] T094 [US3] Create quotation success page (success message, Download PDF button triggering blob download, Back to Search link) in `frontend/src/app/quotation/success/quotation-success.component.ts`
- [X] T095 [US3] Wire "Generate Quotation" navigation from compare view (T083) and from search results plan card to quotation form in `frontend/src/app/quotation/quotation.routes.ts`

**Checkpoint**: US1 + US2 + US3 complete — search → compare → quotation end-to-end is fully operational.

---

## Phase 9: User Story 7 — View Reports (Priority: P3)

**Goal**: Manager/Admin views Usage Statistics, Top Vehicle Models, Import Errors reports and exports as PDF or Excel.

**Independent Test**: Manager opens Reports → Usage Statistics for last 30 days shows quotation counts per day → Top Models shows ranked list → Export PDF downloads within 10 seconds.

### Backend — US7

- [X] T096 [US7] Implement `GetUsageStatisticsQuery` + handler (quotation and search counts grouped by day/week/month for date range) in `backend/src/Ihos.Application/Reporting/Queries/GetUsageStatisticsQuery.cs`
- [X] T097 [US7] Implement `GetTopVehicleModelsQuery` + handler (models ranked by search + quotation frequency for date range) in `backend/src/Ihos.Application/Reporting/Queries/GetTopVehicleModelsQuery.cs`
- [X] T098 [US7] Implement `GetImportErrorsQuery` + handler (batches with unresolved/rejected/approved counts, filterable by company/date) in `backend/src/Ihos.Application/Reporting/Queries/GetImportErrorsQuery.cs`
- [X] T099 [US7] Implement `ReportExportService` (PDF via JasperReportsClient, Excel via ClosedXML workbook generation) for all three report types in `backend/src/Ihos.Infrastructure/Reporting/ReportExportService.cs`
- [X] T100 [US7] Create `ReportsController` (GET usage-statistics, GET top-vehicle-models, GET import-errors, GET {type}/export?format=pdf|xlsx) with Manager minimum role in `backend/src/Ihos.API/Controllers/ReportsController.cs`

### Frontend — US7

- [X] T101 [US7] Create `ReportingApiService` (typed HTTP: getUsageStatistics, getTopModels, getImportErrors, exportReport as Blob) in `frontend/src/app/core/reporting-api.service.ts`
- [X] T102 [US7] Create usage statistics report view (date range picker, granularity toggle, bar/line chart, Export button) in `frontend/src/app/reporting/usage-statistics/usage-statistics.component.ts`
- [X] T103 [US7] Create top vehicle models report view (date range picker, ranked table, Export button) in `frontend/src/app/reporting/top-models/top-models.component.ts`
- [X] T104 [US7] Create import errors report view (company filter, batch table with error counts, Export button) in `frontend/src/app/reporting/import-errors/import-errors.component.ts`
- [X] T105 [US7] Create reports dashboard page (3 report cards with entry links) in `frontend/src/app/reporting/dashboard/dashboard.component.ts`

**Checkpoint**: All user stories US1–US7 complete.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Shared UX shell, audit visibility, performance validation, and hardening.

- [X] T106 [P] Create global app shell (navigation sidebar with role-based menu items, breadcrumbs, loading skeleton states, 404 page) in `frontend/src/app/shared/shell/`
- [X] T107 [P] Create audit log viewer page for Admin (paginated, filterable by action_type and date) in `frontend/src/app/admin/audit-log/audit-log.component.ts`
- [X] T108 [P] Write k6 performance load test asserting p95 < 2000ms on `GET /api/plans/search` under 50 VUs for 60 seconds in `tests/performance/search_load.js`
- [X] T109 [P] Write xUnit integration tests for import pipeline: upload valid Excel → batch created → approve all records → publish → search returns plans; upload corrupt file → 400 with error details; parse-fail → no batch in DB in `backend/tests/Ihos.API.IntegrationTests/Import/`
- [X] T110 Create sample data seed script (5 insurance companies, 10 vehicle makes/models, sample mapping entries, sample import batch) in `docker/postgres/seed.sql`
- [X] T111 Run end-to-end quickstart.md validation (docker compose up → migrate → login as admin → upload sample file → map unresolved models → approve → publish → search → compare → generate PDF → verify download)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Requires Phase 1 — **BLOCKS** all user stories
- **Phase 3 (US4 — Users)**: Requires Phase 2 — first user story; all others depend on auth
- **Phase 4 (US5 — Import)**: Requires Phase 2 + US4 (auth guards); can start with Phase 3 in progress if auth endpoints are done
- **Phase 5 (US6 — Review/Publish)**: Requires US5 complete (records must exist to approve)
- **Phase 6 (US1 — Search)**: Requires US6 complete (published plans must exist)
- **Phase 7 (US2 — Compare)**: Requires US1 complete (search results must exist)
- **Phase 8 (US3 — Quotation)**: Requires US1 complete; US2 optional (compare view adds "Generate" shortcut)
- **Phase 9 (US7 — Reports)**: Requires US3 + US5 + US6 complete (needs quotation + import data)
- **Phase 10 (Polish)**: Requires all desired stories complete

### User Story Dependencies

```
Phase 2 (Foundation)
  └─▶ US4 (Users + Auth)
        └─▶ US5 (Import)
              └─▶ US6 (Review + Publish)
                    └─▶ US1 (Search)
                          ├─▶ US2 (Compare)
                          └─▶ US3 (Quotation)
                                └─▶ US7 (Reports)  ◀─ also needs US5, US6
```

### Within Each User Story

- Domain entities → EF Core migration → Repository → Application handlers → Controller → Frontend service → Frontend components
- Each story independently testable after its checkpoint

### Parallel Opportunities

- All `[P]` tasks within the same phase can run simultaneously
- Phase 1 setup tasks (T003–T007): 5 parallel streams
- Phase 2 foundational tasks (T009–T015): 4 parallel streams after T008
- US4: backend (T016–T033) and frontend (T034–T042) can run in parallel once API contracts are defined
- US5 domain entities (T043–T046) all parallel; parsers (T049, T050) parallel
- US2, US3 can be developed in parallel once US1 search results are available

---

## Parallel Example: User Story 4 (Users + Auth)

```bash
# Stream 1 — Domain + Infrastructure:
T016 Create User entity
T017 Create RefreshToken entity
# then:
T018 Migration
T019 Repositories
T020 PasswordHasher  # parallel with T021
T021 JwtTokenService # parallel with T020

# Stream 2 — Application handlers (after T019):
T022 LoginCommand
T023 RefreshTokenCommand
T024 LogoutCommand
T025 InviteUserCommand
# ... through T033

# Stream 3 — Frontend (after contracts/auth.md reviewed):
T034 AuthService       # parallel with T035
T035 JwtInterceptor    # parallel with T034
T036 Login page
T037 AcceptInvite page
# ...
```

---

## Implementation Strategy

### MVP First (Phase 1 → Phase 3)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US4 (Auth + User Management)
4. **STOP and VALIDATE**: Admin creates a Staff user; Staff logs in
5. System is usable for access control — no insurance data yet

### Primary Value Delivery (Add Phases 4–6)

6. Complete US5: Import → upload and parse rates files
7. Complete US6: Review + Publish → data live in system
8. Complete US1: Search → staff can find plans
9. **STOP and VALIDATE**: Full pipeline from upload to search result — core value delivered

### Full Feature Completion

10. Add US2: Compare plans
11. Add US3: Generate PDF quotations
12. **Deliver MVP to users** — search + quote workflow complete
13. Add US7: Reports
14. Complete Phase 10: Polish

### Parallel Team Strategy (3 developers)

After Phase 2 foundation:
- **Dev A**: US4 (Auth) → US5 (Import) → US6 (Publish)
- **Dev B**: US4 (Auth shared foundation) → US1 (Search) → US2 (Compare)
- **Dev C**: US3 (Quotation + JasperReports) → US7 (Reports)

---

## Notes

- `[P]` = different files, no blocking dependency on an incomplete task in the same group
- `[Story]` label provides traceability from task → user story → acceptance criteria in spec.md
- Each checkpoint must be manually verified before proceeding to the next story
- Constitution compliance is maintained throughout: no auto-publish, no cross-module direct DB access, all audit events logged
- Commit after each task or logical group using `/speckit.git.commit`
- Performance CI gate (T108 k6 test) must be added to the CI pipeline before first deployment
