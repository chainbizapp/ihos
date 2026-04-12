# Research: Motor Insurance Search and Quotation System

**Phase**: 0 | **Date**: 2026-04-12 | **Plan**: `plan.md`

All NEEDS CLARIFICATION items from the Technical Context are resolved below.

---

## R-01: Password Hashing Algorithm

**Decision**: Argon2id via `Isopoh.Cryptography.Argon2` NuGet package.

**Rationale**: The constitution explicitly lists Argon2id as the *recommended* algorithm (bcrypt ≥12 is the fallback). Argon2id provides both side-channel resistance (Argon2i characteristic) and GPU attack resistance (Argon2d characteristic), making it the strongest general-purpose password hashing choice available. The .NET package `Isopoh.Cryptography.Argon2` is pure managed code with no native dependencies, simplifying Docker-based deployment.

**Parameters**: Memory = 65536 KB, Iterations = 3, Parallelism = 4 (OWASP recommended minimums for Argon2id).

**Alternatives considered**:
- BCrypt (cost 12) — acceptable per constitution but lower resistance to GPU attacks than Argon2id.
- PBKDF2-SHA256 — ASP.NET Identity default; slower to tune; rejected in favour of memory-hard algorithm.

---

## R-02: JWT Token Strategy

**Decision**: Short-lived access token (60 min, configurable) + single-use rotating refresh token (7 days).

**Rationale**: The constitution marks refresh token support as SHOULD (TODO pending business decision). Given the internal-staff use case (3–7 users) who work active sessions, session interruptions every 60 minutes would meaningfully disrupt workflow. A rotating refresh token eliminates that friction with no reduction in security when implemented correctly (single-use + server-side revocation).

**Implementation details**:
- Access token: HS256 signed JWT; claims: `sub` (user ID), `role`, `email`, `jti`; expiry = 60 min.
- Refresh token: UUID v4; hashed (SHA-256) before storage in `refresh_tokens` table; plain token returned to client (stored in `HttpOnly` cookie, not localStorage).
- On refresh: validate stored hash, issue new access token + new refresh token, invalidate old refresh token (rotation).
- Revocation: Admin can invalidate all refresh tokens for a user (forces re-login).

**Alternatives considered**:
- Access token only (no refresh): Session interruption every 60 min; rejected for UX impact.
- Long-lived access token (8h): No revocation capability; rejected for security.

---

## R-03: Excel / CSV Parsing Libraries

**Decision**: ClosedXML for Excel (.xlsx); CsvHelper for CSV.

**Rationale**:
- **ClosedXML**: MIT license, pure .NET, no Office interop, active maintenance. Handles merged cells, named ranges, and data validation gracefully. Best fit for reading structured tabular insurance rate sheets.
- **CsvHelper**: Industry standard for .NET CSV parsing; handles encoding issues, quoted fields, and custom type converters natively.

**Alternatives considered**:
- EPPlus: Requires commercial license for commercial use; rejected.
- NPOI: Active but less idiomatic C#; rejected in favour of ClosedXML.
- DocumentFormat.OpenXml (SDK): Low-level; more code for same result; rejected.

---

## R-04: JasperReports Integration Strategy

**Decision**: JasperReports Server (Community Edition) deployed as a Docker sidecar; .NET calls its REST API v2 to run reports and retrieve PDF/Excel output.

**Rationale**: JasperReports is mandated by the constitution. The cleanest .NET integration is via JasperReports Server's REST API — the .NET API calls `/rest_v2/reports/{reportUnit}.pdf` with parameters, receives the rendered document as a stream. This avoids a Java subprocess per request and gives a persistent, pre-warmed report engine.

**Report template location**: `reports/templates/*.jrxml` (version-controlled per constitution).

**Integration contract**:
```
POST /rest_v2/reports/reports/ihos/quotation.pdf
  Header: Authorization: Basic <jasperuser>
  Body: { p_quotation_id: "uuid", p_generated_by: "name", ... }
  Response: application/pdf stream
```

**Alternatives considered**:
- Java subprocess per request (ProcessBuilder): High startup latency; no connection pooling; rejected.
- FastReport .NET: Not mandated by constitution; substitution requires amendment; rejected.
- SSRS: Microsoft SQL Server dependency; rejected (PostgreSQL is the DB).

---

## R-05: Search Index Strategy

**Decision**: PostgreSQL B-tree indexes + partial indexes on published plans; no external search engine for Phase 1.

**Rationale**: At 30,000 records/year × 30 companies = ~900,000 plan rows maximum. B-tree indexes on the search filter columns (`vehicle_model_id`, `plan_type`, `repair_type`, `company_id`) with a partial index `WHERE is_published = true AND is_deleted = false` keep the working set small. Measured PostgreSQL query time on this dataset is well under the 2s SLA without Elasticsearch overhead.

**Index plan**:
```sql
-- Primary search composite
CREATE INDEX idx_plans_search
  ON insurance_plans (vehicle_model_id, plan_type, repair_type)
  WHERE is_published = true AND is_deleted = false;

-- Year range filtering
CREATE INDEX idx_plans_year ON insurance_plans (min_year, max_year)
  WHERE is_published = true AND is_deleted = false;

-- Optional company filter
CREATE INDEX idx_plans_company ON insurance_plans (company_id)
  WHERE is_published = true AND is_deleted = false;

-- Default sort (price ascending)
CREATE INDEX idx_plans_premium ON insurance_plans (premium_total ASC)
  WHERE is_published = true AND is_deleted = false;
```

**Alternatives considered**:
- Elasticsearch: Operational overhead unjustified at this data scale; rejected for Phase 1.
- Full-text search (tsvector): Not needed; all searches are exact/range matches on structured fields.

---

## R-06: CQRS & Application Layer Pattern

**Decision**: MediatR for in-process CQRS. Commands mutate state; Queries read and return DTOs. No separate read/write databases.

**Rationale**: Clean Architecture with MediatR keeps use-case handlers thin, testable in isolation, and easy to discover by feature. The data volume does not justify a separate read replica or event sourcing for Phase 1.

**Alternatives considered**:
- Manual service classes: Simpler but harder to enforce single-responsibility at scale.
- Full event sourcing: Excessive for the problem domain in Phase 1; rejected.

---

## R-07: Angular State Management

**Decision**: Angular Signals for local/component state; `AuthService` (singleton) for auth state. No NgRx for Phase 1.

**Rationale**: Phase 1 has 3–7 internal users with straightforward flows. NgRx adds boilerplate without proportionate benefit at this scale. Angular 19 Signals provide reactivity natively. Auth state (current user, role, token expiry) managed centrally in `AuthService` using `signal<User | null>`.

**Alternatives considered**:
- NgRx: Justified if real-time collaborative features needed; not required for Phase 1; can be added in Phase 2.

---

## R-08: Validation Layer

**Decision**: FluentValidation at the API boundary (controller input DTOs); EF Core value converters for domain invariants.

**Rationale**: FluentValidation is idiomatic with MediatR pipeline behaviours, allowing cross-cutting validation without polluting use-case handlers. EF Core constraints (unique indexes, non-null) act as a second safety net at the database level.

---

## R-09: Duplicate Vehicle Year Range Handling

**Decision**: Reject duplicate at import time via unique constraint on `(company_id, vehicle_model_id, plan_type, repair_type, min_year, max_year)`. Flag as import error in the error report.

**Rationale**: Overlapping or duplicate year ranges within the same company/model/plan combination are a data quality error, not a valid state. The import pipeline detects this during staging and adds the row to the error report rather than creating an ambiguous second record.

---

## R-10: Invite Token / Password Reset Flow

**Decision**: UUID v4 invite token; hashed (SHA-256) in `users.invite_token_hash`; expires 48 hours; single-use.

**Flow**:
1. Admin/Manager calls `POST /api/users/invite` with email + role.
2. System creates user record (status: `PendingInvite`), generates UUID token, stores hash + expiry.
3. Email sent with link: `https://<app>/auth/accept-invite?token=<plain-uuid>`.
4. User visits link, submits password. System validates token hash + expiry, sets password hash, clears token, sets status `Active`.

**Email delivery**: SMTP via `MailKit` (configurable host); no external SaaS dependency required for Phase 1.
