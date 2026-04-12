<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.1.0

Modified principles: None renamed or removed.

Added sections:
  - Authentication & Authorization (new dedicated section, 12 rules)

Removed sections: None

Modified sections:
  - Development Workflow & Quality Gates — security bullet updated to cross-reference
    the new Authentication & Authorization section instead of inline description.

Templates reviewed:
  - .specify/templates/plan-template.md     ✅ aligned (Constitution Check is dynamic)
  - .specify/templates/spec-template.md     ✅ aligned (FR format compatible)
  - .specify/templates/tasks-template.md    ✅ aligned (phased structure compatible)

Follow-up TODOs:
  - TODO(RATIFICATION_DATE): Confirm formal sign-off date with project stakeholders;
    defaulted to initial commit date 2026-04-12.
  - TODO(REFRESH_TOKEN_POLICY): Decide whether refresh token support is MUST or SHOULD
    for the initial release; currently marked SHOULD pending business decision on
    session-continuity requirements.
-->

# IHOS Constitution

## Core Principles

### I. Accuracy over Automation

Data correctness MUST take precedence over throughput or convenience at every stage of the
system. Automated import and OCR pipelines MUST NOT publish results directly to production
without a human review step. When a conflict exists between speed and correctness, correctness
wins. All data transformations MUST be logged so discrepancies can be audited.

**Rationale**: Insurance quotation errors carry legal and financial liability. A wrong premium
or incorrect coverage type cannot be fixed after a policy is issued without significant cost
to the business and customers.

### II. Standardization is Critical

All data ingested from external sources (spreadsheets, PDFs, APIs) MUST be normalized into the
system's canonical data model before being stored or used. Raw input formats MUST NOT be
referenced anywhere beyond the Import module boundary. Canonical models are defined in the
Mapping module and are the single source of truth for all downstream modules.

**Rationale**: With 30+ insurance companies each using their own naming conventions and formats,
building on raw input directly leads to fragile, company-specific code paths that cannot be
maintained at scale.

### III. Mapping-First Design

Vehicle model names, insurance plan names, and coverage category labels from external data
sources MUST be resolved through mapping tables before use in Search, Quotation, or Reporting.
Unresolved mappings MUST be flagged for human review and MUST NOT block the import batch —
they are queued as pending. No hard-coded string comparisons against raw provider names are
permitted outside the Mapping module.

**Rationale**: The same vehicle or plan can appear under dozens of different names across
providers. Centralizing resolution in mapping tables allows corrections to propagate instantly
without re-importing data.

### IV. Traceability

Every record in the system MUST carry metadata identifying: (a) the source file or API origin,
(b) the import batch ID, (c) the timestamp of ingestion, and (d) the user or process that
performed the import. All mapping decisions and review actions MUST be audit-logged with the
reviewer's identity and timestamp. Audit logs MUST be immutable.

**Rationale**: Regulators and internal compliance teams require a full chain-of-custody for
insurance data. Traceability also enables precise rollback of bad import batches without
guessing which records were affected.

### V. Safety-First Data Handling

No imported record MUST ever be permanently deleted. All removal operations MUST use soft
delete (an `is_deleted` flag plus `deleted_at` timestamp) or be replaced by a versioned
superseding record. Schema migrations that drop columns or tables MUST go through an explicit
deprecation period defined in the migration plan. Destructive database operations require a
secondary approval in the deployment pipeline.

**Rationale**: Insurance data is subject to retention requirements. Accidental hard-deletes of
source data are not recoverable and constitute a compliance risk.

### VI. Modular Architecture

The system MUST be structured as six distinct, independently deployable modules:

- **Import**: Ingestion, parsing, and raw-to-canonical transformation.
- **Mapping**: Vehicle model, plan name, and category resolution tables and their management UI.
- **Search**: Query execution, filtering, and results assembly (response < 2 s SLA).
- **Quotation**: Premium computation, comparison, and quote document generation.
- **Reporting**: Scheduled and on-demand reports via JasperReports.
- **Admin**: User management, configuration, and audit log viewing.

Cross-module calls MUST go through well-defined interfaces (service contracts or API endpoints).
Direct database access across module boundaries is prohibited.

**Rationale**: Modular separation allows individual modules to be developed, tested, scaled, and
replaced independently. It also limits the blast radius of breaking changes.

### VII. Human-in-the-Loop

OCR extraction results and automated mapping suggestions MUST enter a "Pending Review" state
before they affect live quotation data. A designated reviewer MUST explicitly approve or reject
each pending item. Bulk approval is permitted only with a confirmation step. The system MUST
NOT auto-publish even when confidence scores are high.

**Rationale**: Automated pipelines will make mistakes. The human review gate is the primary
defence against incorrect data reaching customers. Removing it for convenience is not
acceptable regardless of pipeline accuracy.

### VIII. Performance Expectations

Search query responses MUST complete in under 2 seconds at the 95th percentile under normal
load. Any new Search or Quotation endpoint MUST include a performance test in the CI pipeline
that enforces this threshold. Database queries powering Search MUST use indexed fields only;
full-table scans are prohibited in production query paths. Caching strategies MUST be
documented in the relevant module's design document.

**Rationale**: Users comparing insurance quotes across multiple providers expect near-instant
results. Slow responses lead to abandonment and reduce trust in the platform.

### IX. Scalability

The system MUST be designed from the outset to support at least 30 insurance companies without
code changes — only data (mapping tables, import configurations, and plan definitions) MUST
change when onboarding a new provider. Database schema design MUST use provider-agnostic
identifiers. Any configuration that is provider-specific MUST be stored in configuration tables,
not in application code or environment variables.

**Rationale**: The addressable market requires multi-company support. Hard-coding assumptions
about a fixed set of providers creates costly rework every time a new company is onboarded.

### X. Technology Constraints

The following technology decisions are fixed and MUST NOT be substituted without a formal
constitution amendment:

| Layer | Technology |
|---|---|
| Frontend | Angular (latest LTS) |
| Backend | .NET 10 Web API — Clean Architecture |
| Database | PostgreSQL |
| Reporting | JasperReports |

All backend code MUST follow Clean Architecture layering: Domain → Application → Infrastructure
→ Presentation. Domain and Application layers MUST NOT reference Infrastructure types directly.
ORM: Entity Framework Core. All migrations MUST be code-first and version-controlled.

**Rationale**: Technology standardization reduces onboarding friction, enables shared tooling,
and ensures the entire team operates with the same mental model and library support.

## Authentication & Authorization

All rules in this section are non-negotiable security requirements. They complement Principle IV
(Traceability) and Principle X (Technology Constraints) and apply system-wide.

### Login

The system MUST support application-based login using a username (or email) and password
credential pair via the application's own UI and API. No external identity provider is required
for initial delivery, but the design MUST NOT preclude future SSO integration.

### User Registration

The system MUST support two registration paths:

1. **Admin-initiated**: An authorized user (Admin or Manager role) creates an account for a
   new user directly.
2. **Self-registration with approval**: A prospective user submits a registration request that
   MUST be approved by an authorized user before the account is activated. Self-registration
   MUST NOT grant access without explicit approval.

### Token-Based Authentication

The system MUST use JSON Web Tokens (JWT) for authentication. Every protected API endpoint
MUST reject requests that do not carry a valid, unexpired JWT in the Authorization header.
Tokens MUST be signed; unsigned or improperly signed tokens MUST be rejected with HTTP 401.

### Token Expiration

Access tokens MUST have a finite expiration time. The expiration window MUST be configured
via application settings (not hard-coded) and MUST default to a short-lived value (≤ 60
minutes). Expired tokens MUST be rejected; the client MUST re-authenticate or use a refresh
token to obtain a new access token.

### Refresh Tokens

The system SHOULD implement refresh token support to allow seamless session continuity without
requiring the user to re-enter credentials on every access-token expiry. If implemented,
refresh tokens MUST be single-use (rotation on every use), stored securely (hashed in the
database), and MUST have their own expiration. Compromised refresh tokens MUST be revocable
by an Admin.

TODO(REFRESH_TOKEN_POLICY): Confirm with business stakeholders whether refresh token support
is required for the initial release or can be deferred to a later iteration.

### Password Security

Passwords MUST NEVER be stored, logged, or transmitted in plain text at any point in the
system. Passwords MUST be hashed using a secure, adaptive, salted algorithm before persistence.
Accepted algorithms: **bcrypt** (cost factor ≥ 12) or **Argon2id** (recommended). MD5, SHA-1,
and unsalted SHA-256 are explicitly prohibited.

### Role-Based Authorization

Authorization MUST be role-based (RBAC). The system defines four built-in roles:

| Role | Description |
|---|---|
| **Admin** | Full system access; user management; configuration; audit log viewing. |
| **Manager** | Approves user registrations; reviews import batches and mapping suggestions; can generate reports. |
| **Senior Staff** | Can perform imports, manage mappings, and create quotations. Read access to reports. |
| **Staff** | Can search and create quotations. Read-only access to approved data. |

Role assignment MUST be managed by Admin users only. Each API endpoint and use case MUST
declare its minimum required role. Authorization checks MUST be enforced at the Application
layer (use-case level), not only at the controller level.

### Sensitive Action Restriction

Actions classified as sensitive MUST be restricted to specific roles and MUST require an
active, valid JWT with the appropriate role claim. Sensitive actions include (but are not
limited to): user creation, user approval, role changes, bulk mapping approval, import batch
publish, and report export of raw data. Attempting a sensitive action without the required role
MUST return HTTP 403.

### Security Audit Log

The audit log (see Principle IV — Traceability) MUST capture the following security events
with actor identity, timestamp, IP address, and outcome:

- User login (success and failure)
- User account creation
- User registration approval or rejection
- Role assignment changes
- Privileged action execution (bulk approve, import publish, config change)
- Token revocation or forced logout

Audit log entries for security events MUST be immutable and MUST NOT be soft-deletable by
any role including Admin.

## Technology Stack

### Backend (.NET 10 — Clean Architecture)

- **Domain layer**: Entities, value objects, domain events, and interfaces. No external
  dependencies permitted.
- **Application layer**: Use cases, DTOs, command/query handlers (CQRS encouraged), and
  validation. May reference Domain only.
- **Infrastructure layer**: EF Core repositories, external API clients, file storage adapters,
  JWT issuance/validation, and JasperReports integration. References Domain and Application.
- **Presentation layer**: Web API controllers, auth middleware, and role-authorization filters.
  References Application only.

### Frontend (Angular)

- State management via Angular Signals or NgRx (decision to be documented per module).
- HTTP calls MUST go through typed service classes — no direct HttpClient usage in components.
- Lazy-loaded feature modules aligned to the six system modules.
- Auth state (current user, role, token) MUST be managed in a dedicated AuthService; no raw
  JWT string access in components.

### Database (PostgreSQL)

- All tables MUST have `created_at`, `updated_at`, `created_by`, and `is_deleted` columns.
- Indexes MUST be defined on all foreign keys and all columns used in Search filters.
- Connection pooling via PgBouncer is RECOMMENDED for production deployments.
- The `users` table MUST store only the password hash — never the raw password or any
  reversible encoding.

### Reporting (JasperReports)

- Report templates are version-controlled in the repository under `reports/templates/`.
- Reports are generated server-side and delivered as PDF or XLSX.
- No client-side report generation is permitted.

## Development Workflow & Quality Gates

- All features MUST be developed on a feature branch and pass CI before merging to `main`.
- Constitution Check MUST be performed at plan time and again after Phase 1 design; violations
  must be documented with justification in the Complexity Tracking section of the plan.
- Database schema changes MUST include a rollback migration.
- API contracts MUST be defined (OpenAPI) before implementation begins.
- No endpoint may be merged without at least one integration test covering the happy path.
- Performance tests for Search and Quotation endpoints are mandatory (see Principle VIII).
- Security: All user input MUST be validated at the API boundary. Parameterized queries only —
  no string interpolation in SQL. All authentication and authorization rules MUST comply with
  the Authentication & Authorization section of this constitution.

## Governance

This constitution supersedes all other practices, conventions, or tribal knowledge. When
a conflict arises between any other document and this constitution, this constitution prevails.

**Amendment procedure**:
1. Open a pull request with the proposed change to `.specify/memory/constitution.md`.
2. State the version bump type (MAJOR / MINOR / PATCH) and rationale.
3. Obtain approval from at least one senior team member before merging.
4. Run `/speckit-constitution` after merge to propagate changes to dependent templates.
5. Update the Sync Impact Report embedded in this file.

**Versioning policy**:
- MAJOR: Removal or fundamental redefinition of an existing principle.
- MINOR: New principle or section added; materially expanded guidance.
- PATCH: Clarification, wording improvement, or non-semantic refinement.

**Compliance review**: Constitution compliance MUST be verified at every plan review and at
every pull-request review. Non-compliant code MUST NOT be merged without a documented
justification in the Complexity Tracking section of the relevant plan.

**Version**: 1.1.0 | **Ratified**: 2026-04-12 | **Last Amended**: 2026-04-12
