# Implementation Plan: Motor Insurance Search and Quotation System

**Branch**: `001-motor-insurance-quotation-system` | **Date**: 2026-04-12 | **Spec**: `specs/001-motor-insurance-quotation-system/spec.md`
**Input**: Feature specification from `/specs/001-motor-insurance-quotation-system/spec.md`

---

## Summary

Build an internal web application for searching, comparing, and generating quotations for motor insurance plans from multiple insurance companies. The system ingests data via Excel/CSV/PDF upload, normalises it through a mapping layer with human approval, and exposes a fast search index backed by PostgreSQL. A JasperReports engine generates PDF quotations. Role-based access (Admin / Manager / Senior Staff / Staff) is enforced at every API boundary.

---

## Technical Context

**Language/Version**: C# 13 / .NET 10 (backend) · TypeScript / Angular 19 LTS (frontend)
**Primary Dependencies**:
- Backend: ASP.NET Core 10, Entity Framework Core 9, Npgsql, MediatR (CQRS), FluentValidation, BCrypt.Net-Next (Argon2id preferred — see Research), Microsoft.AspNetCore.Authentication.JwtBearer, ClosedXML (Excel), CsvHelper (CSV), iTextSharp / PDFium (PDF read for OCR scaffold), JasperReports (PDF generation via REST API)
- Frontend: Angular 19, Angular Material, Tailwind CSS, ngx-translate (Thai/EN)

**Storage**: PostgreSQL 16
**Testing**: xUnit + Moq (backend unit), Testcontainers + WebApplicationFactory (integration), Playwright (E2E)
**Target Platform**: Linux container (Docker); local dev on macOS/Windows via Docker Compose
**Project Type**: Web application — Angular SPA + .NET 10 REST API
**Performance Goals**: Search endpoint p95 < 2 s; PDF quotation generation < 5 s
**Constraints**: 50 concurrent internal users (design for 500); ~30,000 insurance plan records/year; 30+ companies without code change
**Scale/Scope**: 4 roles, 7 functional modules, 30+ insurance companies, ≤ 500 concurrent future users

---

## Constitution Check

*GATE: Evaluated before Phase 0. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Accuracy over Automation | **PASS** | Import requires Manager approval before publish; no auto-publish path exists |
| II. Standardization is Critical | **PASS** | All raw data normalized via Mapping module before any downstream use |
| III. Mapping-First Design | **PASS** | Unresolved models flagged "Pending Mapping"; blocked from publish until resolved |
| IV. Traceability | **PASS** | ImportBatch + AuditLog entities carry source, actor, timestamp on every record |
| V. Safety-First Data Handling | **PASS** | All tables include `is_deleted` / `deleted_at`; no hard-delete operations |
| VI. Modular Architecture | **PASS** | Six modules (Import, Mapping, Search, Quotation, Reporting, Admin) with defined contracts |
| VII. Human-in-the-Loop | **PASS** | Manager explicit approve/reject gate before publish; bulk-approve blocked while Pending records exist |
| VIII. Performance Expectations | **PASS** | Search indexed on make, model, plan_type, repair_type, year; performance CI gate mandatory |
| IX. Scalability | **PASS** | Provider-agnostic schema; all company-specific config in mapping tables |
| X. Technology Constraints | **PASS** | Angular 19, .NET 10, PostgreSQL 16, JasperReports — no substitutions |
| Auth & Authorization | **PASS** | JWT (≤60 min), Argon2id hashing, RBAC enforced at Application layer |

**No constitution violations. Proceeding to Phase 0.**

---

## Project Structure

### Documentation (this feature)

```text
specs/001-motor-insurance-quotation-system/
├── plan.md              ← This file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   ├── openapi.md       ← API contract (Phase 1 output)
│   └── auth.md          ← Auth flow detail
└── tasks.md             ← Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── Ihos.Domain/              # Entities, value objects, enums, domain events
│   ├── Ihos.Application/         # Use cases, CQRS handlers, DTOs, validators, interfaces
│   ├── Ihos.Infrastructure/      # EF Core, repositories, JWT, file storage, JasperReports client
│   └── Ihos.API/                 # Controllers, middleware, auth filters, startup
└── tests/
    ├── Ihos.Domain.Tests/
    ├── Ihos.Application.Tests/
    ├── Ihos.Infrastructure.Tests/
    └── Ihos.API.IntegrationTests/ # Testcontainers (real PostgreSQL)

frontend/
├── src/
│   └── app/
│       ├── auth/                 # Login, invite accept, route guards
│       ├── admin/                # User management, audit log viewer
│       ├── import/               # Upload, batch list, batch detail, record review
│       ├── mapping/              # Vehicle model mapping, plan type mapping
│       ├── search/               # Search form, results list, compare view
│       ├── quotation/            # Quotation form, PDF download
│       ├── reporting/            # Reports dashboard, export
│       ├── core/                 # AuthService, HTTP interceptors, guards
│       └── shared/               # Design system components, pipes, models
└── (Angular CLI workspace)

reports/
└── templates/                    # JasperReports .jrxml templates (version-controlled)

docker/
├── docker-compose.yml
├── postgres/
└── jasper/                       # JasperReports Server config
```

**Structure Decision**: Option 2 (Web application). Backend follows Clean Architecture with four projects mirroring the four layers. Frontend uses lazy-loaded feature modules aligned to the six system modules. JasperReports Server runs as a sidecar container.

---

## Complexity Tracking

> No constitution violations requiring justification at plan time.

---

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│              Angular 19 SPA                 │
│  auth · admin · import · mapping ·          │
│  search · quotation · reporting             │
└──────────────────┬──────────────────────────┘
                   │ HTTPS / JWT Bearer
┌──────────────────▼──────────────────────────┐
│           .NET 10 Web API (Kestrel)          │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Auth     │  │ Import   │  │  Search   │  │
│  │ Users    │  │ Mapping  │  │ Quotation │  │
│  │ Admin    │  │ Review   │  │ Reports   │  │
│  └──────────┘  └──────────┘  └───────────┘  │
│        MediatR (CQRS) · FluentValidation     │
└──────────┬─────────────────┬────────────────┘
           │ EF Core / Npgsql│ HTTP REST
┌──────────▼──────┐   ┌──────▼──────────────┐
│  PostgreSQL 16  │   │ JasperReports Server │
│  (PgBouncer)    │   │   (Docker sidecar)   │
└─────────────────┘   └─────────────────────┘
```

---

## Module Breakdown

### M1 — Authentication

| Concern | Decision |
|---|---|
| Mechanism | JWT Bearer (Microsoft.AspNetCore.Authentication.JwtBearer) |
| Access token expiry | 60 minutes (configurable via `appsettings`) |
| Refresh token | Single-use rotation; 7-day expiry; hash stored in DB |
| Password storage | Argon2id via `Isopoh.Cryptography.Argon2` |
| Registration path | Invite-based: Admin/Manager generates invite link; user sets password on first visit |
| Self-registration | Supported: enters Pending state; Manager/Admin approves |

### M2 — User Management (Admin module)

- CRUD for users (Admin/Manager only)
- Pending registration queue with approve/reject
- Role assignment (Admin only)
- Account deactivation (Admin only)
- All actions audit-logged

### M3 — Data Import

**Flow**: Upload → Parse → Validate format → Create ImportBatch → Resolve mappings → Stage ImportRecords → Notify for review

- Parse failure: reject entire file; no rows staged; return structured error report (row, column, error)
- Supported: Excel (.xlsx via ClosedXML), CSV (CsvHelper), PDF (manual entry form; OCR scaffold)
- Each ImportRecord carries: raw source value, resolved canonical value, mapping_status (Resolved / PendingMapping), review_status (Pending / Approved / Rejected)

### M4 — Mapping

- VehicleModelMapping: `raw_name` (per company) → `vehicle_model_id` (canonical)
- PlanTypeMapping: `raw_name` (per company) → `canonical_plan_type` enum
- Auto-suggest on upload using case-insensitive exact match + Levenshtein distance (threshold: ≤2)
- Manual override always available to Senior Staff and above
- All mapping edits audit-logged

### M5 — Search

- Input: make, model, production_year, plan_type, repair_type, [company_id], [excess_min/max]
- Vehicle age = CurrentYear − ProductionYear + 1; plans filtered by `min_year ≤ age ≤ max_year`
- Default sort: price ascending
- Secondary sort: sum_insured descending
- Pagination: 20 per page; total count returned
- Indexes: `(vehicle_model_id, plan_type, repair_type)` composite + `company_id`, `min_year`, `max_year`
- Only published plans (is_published = true, is_deleted = false) returned

### M6 — Quotation

- User selects 1–3 plans; provides customer name + optional registration plate
- System calls JasperReports Server REST API with plan data
- PDF returned as blob; Quotation record persisted with premium snapshot
- Quotation record links: staff_id, plan_id, customer_name, vehicle_details, premium_at_generation, generated_at

### M7 — Reporting

- Reports: Usage Statistics, Top Vehicle Models, Import Errors
- Generated server-side by JasperReports; exported as PDF or Excel
- Only Manager and Admin can access

---

## Data Flow

```
[File Upload]
    │
    ▼
[Parse & Validate] ──fail──▶ [Error Report → Reject]
    │ success
    ▼
[Create ImportBatch (status: Processing)]
    │
    ▼
[Resolve VehicleModelMapping + PlanTypeMapping per row]
    │ unresolved rows → status: PendingMapping
    ▼
[ImportRecords staged (status: Pending)]
    │
    ▼
[Senior Staff / Manager: Review Batch in UI]
    │
    ▼
[Manager: Approve / Reject individual records]
    │ all records Approved or Rejected
    ▼
[Manager: Publish Batch]
    │
    ▼
[InsurancePlans marked is_published=true → searchable]
    │
    ▼
[Staff: Search → Compare → Select → Generate PDF Quotation]
```

---

## Security Design

| Concern | Implementation |
|---|---|
| API protection | All endpoints require `Authorization: Bearer <JWT>` except `/auth/login` and `/auth/invite/accept` |
| Role enforcement | Enforced at Application layer (use-case handler) via `ICurrentUserService`; also declared on controllers as fallback |
| Sensitive actions | Return HTTP 403 if role insufficient; logged in AuditLog |
| Audit events | Login success/fail, user create, approve/reject, role change, batch publish, config change, token revoke |
| SQL injection | Parameterized queries only via EF Core; no string interpolation |
| Input validation | FluentValidation at API boundary; validated before use-case execution |
| Password reset | Invite token (UUID, hashed, expires 48h) sent to email; user sets password on accept |

---

## Performance Strategy

| Concern | Strategy |
|---|---|
| Search p95 < 2s | Composite index on `(vehicle_model_id, plan_type, repair_type)`; `company_id`, `min_year`, `max_year` indexed individually |
| Concurrent users | PgBouncer connection pooling; Kestrel async throughout |
| Quotation PDF | JasperReports sidecar pre-warmed; async generation with 10s timeout |
| Report export | Generated async; streamed as file download |
| CI performance gate | k6 load test: 50 VU, 60s, assert p95 < 2s on `/api/plans/search` |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Inconsistent Excel column headers across companies | High | High | Per-company column mapping config in mapping tables; validation error on unknown columns |
| JasperReports Server startup latency | Medium | Medium | Pre-warm on deploy; health-check before accepting traffic |
| Unresolved vehicle models blocking publish | High | Medium | Auto-suggest reduces manual effort; Senior Staff can batch-resolve |
| PDF OCR inaccuracy | High | Low | Manual review required for all PDF imports; no auto-accept |
| Large batch review performance (500 rows) | Medium | Medium | Virtual scroll + server-side pagination for batch record list |
| Overlapping year ranges for same model/company | Low | Medium | Database constraint: unique index on `(company_id, vehicle_model_id, plan_type, repair_type, min_year, max_year)`; reject duplicates on import |

---

## Phased Delivery Order

| Priority | Story | Depends On |
|---|---|---|
| P0 | Database schema + migrations | — |
| P0 | Auth (login, JWT, invite) | Schema |
| P0 | User Management CRUD + approval | Auth |
| P1 | Import (Excel/CSV) + Mapping resolution | Auth, Schema |
| P1 | Mapping Module UI | Import |
| P1 | Review & Publish workflow | Import, Mapping |
| P1 | Search Module | Published data |
| P2 | Compare Module | Search |
| P2 | Quotation + PDF generation | Search, JasperReports |
| P3 | Reporting Module | Quotation, Audit data |

---

*Constitution Check re-evaluated after Phase 1 design — see data-model.md and contracts/openapi.md.*
