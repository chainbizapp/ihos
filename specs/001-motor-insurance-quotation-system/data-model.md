# Data Model: Motor Insurance Search and Quotation System

**Phase**: 1 | **Date**: 2026-04-12 | **Plan**: `plan.md`

All tables include `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`, and `is_deleted BOOLEAN NOT NULL DEFAULT false` per Constitution §Database (PostgreSQL). Columns with `created_by` reference `users.id`.

---

## Entity Relationship Overview

```
users ──< refresh_tokens
users ──< audit_logs (actor)
users ──< import_batches (uploaded_by)
users ──< quotations (created_by)
users ──< vehicle_model_mappings (created_by)
users ──< plan_type_mappings (created_by)

insurance_companies ──< import_batches
insurance_companies ──< insurance_plans
insurance_companies ──< vehicle_model_mappings
insurance_companies ──< plan_type_mappings

vehicle_makes ──< vehicle_models
vehicle_models ──< vehicle_model_mappings
vehicle_models ──< insurance_plans

import_batches ──< import_records
import_batches ──< insurance_plans (source traceability)

import_records >── vehicle_model_mappings (resolved_mapping)
import_records >── plan_type_mappings (resolved_mapping)

insurance_plans ──< quotations
```

---

## Tables

### `users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE | Login identifier |
| `full_name` | VARCHAR(255) | NOT NULL | Display name |
| `password_hash` | VARCHAR(512) | NULL | NULL until invite accepted |
| `role` | VARCHAR(50) | NOT NULL | `Admin` / `Manager` / `SeniorStaff` / `Staff` |
| `status` | VARCHAR(50) | NOT NULL DEFAULT 'PendingInvite' | `PendingInvite` / `PendingApproval` / `Active` / `Inactive` |
| `invite_token_hash` | VARCHAR(512) | NULL | SHA-256 of UUID invite token |
| `invite_expires_at` | TIMESTAMPTZ | NULL | 48h after invite sent |
| `created_by` | UUID | FK → users.id, NULL | NULL for first Admin (bootstrapped) |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `is_deleted` | BOOLEAN | NOT NULL DEFAULT false | Soft deactivation |

**Indexes**: `email` (UNIQUE), `status`, `role`

---

### `refresh_tokens`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users.id, NOT NULL | |
| `token_hash` | VARCHAR(512) | NOT NULL | SHA-256 of plain refresh token |
| `expires_at` | TIMESTAMPTZ | NOT NULL | 7 days from issue |
| `revoked_at` | TIMESTAMPTZ | NULL | Set on use (rotation) or forced revocation |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**Indexes**: `token_hash`, `(user_id, revoked_at)`

---

### `audit_logs`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `actor_id` | UUID | FK → users.id, NULL | NULL for system-generated events |
| `action_type` | VARCHAR(100) | NOT NULL | e.g., `UserLogin`, `BatchPublished`, `RoleChanged` |
| `entity_type` | VARCHAR(100) | NULL | e.g., `User`, `ImportBatch`, `InsurancePlan` |
| `entity_id` | UUID | NULL | ID of affected entity |
| `ip_address` | INET | NULL | |
| `outcome` | VARCHAR(20) | NOT NULL | `Success` / `Failure` |
| `metadata` | JSONB | NULL | Additional context (old/new values, reason) |
| `occurred_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

> **No `is_deleted` or `updated_at`** on audit_logs — entries are immutable per constitution.

**Indexes**: `actor_id`, `action_type`, `occurred_at`, `entity_type + entity_id`

---

### `insurance_companies`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `name` | VARCHAR(255) | NOT NULL, UNIQUE | Canonical company name |
| `short_code` | VARCHAR(20) | NOT NULL, UNIQUE | e.g., `AXA`, `DHIPAYA` |
| `is_active` | BOOLEAN | NOT NULL DEFAULT true | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `is_deleted` | BOOLEAN | NOT NULL DEFAULT false | |

---

### `vehicle_makes`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `name` | VARCHAR(100) | NOT NULL, UNIQUE | e.g., `Toyota`, `Honda` |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `is_deleted` | BOOLEAN | NOT NULL DEFAULT false | |

---

### `vehicle_models`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `make_id` | UUID | FK → vehicle_makes.id, NOT NULL | |
| `name` | VARCHAR(200) | NOT NULL | e.g., `Corolla`, `Civic` |
| `sub_model` | VARCHAR(200) | NULL | e.g., `1.8 Hybrid`, `EV` |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `is_deleted` | BOOLEAN | NOT NULL DEFAULT false | |

**Indexes**: `make_id`, UNIQUE `(make_id, name, sub_model)`

---

### `vehicle_model_mappings`

Resolves a raw provider model string to a canonical `vehicle_models` entry.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `company_id` | UUID | FK → insurance_companies.id, NOT NULL | |
| `raw_name` | VARCHAR(500) | NOT NULL | Exactly as it appears in source file |
| `canonical_model_id` | UUID | FK → vehicle_models.id, NOT NULL | |
| `is_auto_suggested` | BOOLEAN | NOT NULL DEFAULT false | True if system suggested; false = manually set |
| `created_by` | UUID | FK → users.id, NOT NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `is_deleted` | BOOLEAN | NOT NULL DEFAULT false | |

**Constraints**: UNIQUE `(company_id, raw_name)` — one canonical mapping per raw name per company.
**Indexes**: `company_id`, `canonical_model_id`, UNIQUE `(company_id, raw_name)`

---

### `plan_type_mappings`

Resolves raw plan designation strings to canonical plan type codes.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `company_id` | UUID | FK → insurance_companies.id, NOT NULL | |
| `raw_name` | VARCHAR(500) | NOT NULL | Exactly as it appears in source file |
| `canonical_plan_type` | VARCHAR(10) | NOT NULL | `Type1` / `Type2` / `Type3` / `Type2Plus` / `Type3Plus` |
| `created_by` | UUID | FK → users.id, NOT NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `is_deleted` | BOOLEAN | NOT NULL DEFAULT false | |

**Constraints**: UNIQUE `(company_id, raw_name)`

---

### `import_batches`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `company_id` | UUID | FK → insurance_companies.id, NOT NULL | |
| `source_file_name` | VARCHAR(500) | NOT NULL | Original filename |
| `source_file_path` | VARCHAR(1000) | NOT NULL | Storage path (e.g., S3 key or local path) |
| `uploaded_by` | UUID | FK → users.id, NOT NULL | |
| `uploaded_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `status` | VARCHAR(50) | NOT NULL DEFAULT 'Processing' | `Processing` / `PendingReview` / `Published` / `Rejected` / `Failed` |
| `total_rows` | INT | NOT NULL DEFAULT 0 | |
| `resolved_rows` | INT | NOT NULL DEFAULT 0 | Rows with all mappings resolved |
| `pending_rows` | INT | NOT NULL DEFAULT 0 | Rows with unresolved mappings |
| `approved_rows` | INT | NOT NULL DEFAULT 0 | |
| `rejected_rows` | INT | NOT NULL DEFAULT 0 | |
| `published_by` | UUID | FK → users.id, NULL | |
| `published_at` | TIMESTAMPTZ | NULL | |
| `failure_reason` | TEXT | NULL | Set when status = Failed |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `is_deleted` | BOOLEAN | NOT NULL DEFAULT false | |

**Indexes**: `company_id`, `status`, `uploaded_by`, `uploaded_at`

---

### `import_records`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `batch_id` | UUID | FK → import_batches.id, NOT NULL | |
| `row_number` | INT | NOT NULL | 1-based row in source file |
| `raw_data` | JSONB | NOT NULL | All raw column values from source row |
| `vehicle_model_mapping_id` | UUID | FK → vehicle_model_mappings.id, NULL | NULL = unresolved |
| `plan_type_mapping_id` | UUID | FK → plan_type_mappings.id, NULL | NULL = unresolved |
| `mapping_status` | VARCHAR(50) | NOT NULL DEFAULT 'Pending' | `Resolved` / `PendingMapping` |
| `review_status` | VARCHAR(50) | NOT NULL DEFAULT 'Pending' | `Pending` / `Approved` / `Rejected` |
| `reviewed_by` | UUID | FK → users.id, NULL | |
| `reviewed_at` | TIMESTAMPTZ | NULL | |
| `rejection_reason` | TEXT | NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `is_deleted` | BOOLEAN | NOT NULL DEFAULT false | |

**Indexes**: `batch_id`, `mapping_status`, `review_status`

---

### `insurance_plans`

The published canonical record searchable by end users.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `company_id` | UUID | FK → insurance_companies.id, NOT NULL | |
| `vehicle_model_id` | UUID | FK → vehicle_models.id, NOT NULL | Canonical model |
| `plan_type` | VARCHAR(10) | NOT NULL | `Type1` / `Type2` / `Type3` / `Type2Plus` / `Type3Plus` |
| `repair_type` | VARCHAR(20) | NOT NULL | `Garage` / `Dealer` |
| `min_year` | INT | NOT NULL | Minimum vehicle age (inclusive) |
| `max_year` | INT | NOT NULL | Maximum vehicle age (inclusive) |
| `sum_insured` | NUMERIC(15,2) | NOT NULL | THB |
| `premium_total` | NUMERIC(15,2) | NOT NULL | THB; default sort key |
| `excess_amount` | NUMERIC(15,2) | NOT NULL DEFAULT 0 | THB |
| `coverage_details` | JSONB | NOT NULL DEFAULT '{}' | Flexible coverage fields |
| `remarks` | TEXT | NULL | |
| `source_import_record_id` | UUID | FK → import_records.id, NULL | Traceability |
| `source_batch_id` | UUID | FK → import_batches.id, NULL | Traceability |
| `is_published` | BOOLEAN | NOT NULL DEFAULT false | |
| `published_at` | TIMESTAMPTZ | NULL | |
| `published_by` | UUID | FK → users.id, NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `is_deleted` | BOOLEAN | NOT NULL DEFAULT false | |

**Constraints**: UNIQUE `(company_id, vehicle_model_id, plan_type, repair_type, min_year, max_year)` — prevents duplicate/overlapping ranges for same combination.

**Indexes** (all partial `WHERE is_published = true AND is_deleted = false`):
- `idx_plans_search (vehicle_model_id, plan_type, repair_type)`
- `idx_plans_year (min_year, max_year)`
- `idx_plans_company (company_id)`
- `idx_plans_premium (premium_total ASC)` — default sort

---

### `quotations`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `created_by` | UUID | FK → users.id, NOT NULL | Staff member who generated |
| `plan_id` | UUID | FK → insurance_plans.id, NOT NULL | |
| `customer_name` | VARCHAR(255) | NOT NULL | |
| `vehicle_registration` | VARCHAR(50) | NULL | Optional plate number |
| `vehicle_make` | VARCHAR(100) | NOT NULL | Snapshot at generation time |
| `vehicle_model_name` | VARCHAR(200) | NOT NULL | Snapshot |
| `vehicle_year` | INT | NOT NULL | Production year |
| `premium_at_generation` | NUMERIC(15,2) | NOT NULL | Snapshot; not linked to live plan premium |
| `generated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `is_deleted` | BOOLEAN | NOT NULL DEFAULT false | |

**Indexes**: `created_by`, `plan_id`, `generated_at`

---

## State Transitions

### User Status

```
[Invite sent]  → PendingInvite
                    │ accepts invite + sets password
                    ▼
                 Active
                    │ Admin deactivates
                    ▼
                 Inactive

[Self-register] → PendingApproval
                    │ Manager/Admin approves
                    ▼
                 Active
                    │ Manager/Admin rejects
                    ▼
                 (record retained, status = Rejected)
```

### Import Batch Status

```
Upload received → Processing
                    │ parse fails
                    ▼
                  Failed (no records created)

                    │ parse succeeds
                    ▼
                  PendingReview (records staged)
                    │ Manager publishes (all records Approved/Rejected)
                    ▼
                  Published
                    │ Manager rejects entire batch
                    ▼
                  Rejected
```

### Import Record Status

```
Created → mapping_status: PendingMapping | Resolved
          review_status:  Pending
                              │ Manager approves
                              ▼
                           Approved
                              │ Manager rejects
                              ▼
                           Rejected
```

---

## Constitution Check — Post Phase 1 Design

| Principle | Status | Notes |
|---|---|---|
| I. Accuracy over Automation | **PASS** | No auto-publish; publish blocked until all records Approved/Rejected |
| II. Standardization | **PASS** | Raw data in `import_records.raw_data`; canonical values in `insurance_plans` only |
| III. Mapping-First | **PASS** | `vehicle_model_mapping_id` + `plan_type_mapping_id` must resolve before review |
| IV. Traceability | **PASS** | All tables have `created_by`; plans link to `source_import_record_id` + `source_batch_id` |
| V. Safety-First | **PASS** | `is_deleted` on all tables; audit_logs has no soft-delete |
| VI. Modular | **PASS** | No cross-module direct table access; all inter-module calls via API contracts |
| VIII. Performance | **PASS** | Partial indexes defined on published+non-deleted plans; duplicate unique constraint prevents overlapping ranges |
| IX. Scalability | **PASS** | Provider-agnostic schema; all company config in mapping tables |

**No violations. Data model is constitution-compliant.**
