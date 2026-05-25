# Phase 1 Data Model: Multi-Provider Insurance Quote Integration

**Feature**: 002-multi-provider-integration
**Date**: 2026-05-25

## Overview

The migration is **additive only** — one new enum, one new column on an existing table, and one new entity. No destructive operations. Existing entities (`InsurancePlan`, `VehicleModel`, `VehicleModelMapping`, `Quotation`) are unchanged in shape; only their producers change.

---

## 1. New Enum — `DataSourceType`

**Location**: `Ihos.Domain/Enums/DataSourceType.cs`

```csharp
public enum DataSourceType
{
    Import = 0,   // Plans/vehicles loaded from Excel/CSV (legacy path; Allianz today)
    Api    = 1    // Plans quoted live and vehicle master synced from provider API (MTI, Viriyah)
}
```

**Persistence**: stored as `int` (EF Core default for enums). PostgreSQL column type: `integer NOT NULL DEFAULT 0`.

---

## 2. Modified Entity — `InsuranceCompany`

**Location**: `Ihos.Domain/Entities/InsuranceCompany.cs` (existing — add one property)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `DataSource` | `DataSourceType` | ✅ | `Import` | Determines which `IInsurerQuoteProvider` impl resolves at runtime |

**Validation**:
- `DataSource = Api` requires `ShortCode` to be present in DI keyed registrations (validated at startup).
- Existing rows default to `Import` via migration backfill (`UPDATE "InsuranceCompanies" SET "DataSource" = 0;`).

**Provider Resolution Rule**:
```
DataSource = Import → ImportQuoteProvider (reads pre-loaded plans from DB)
DataSource = Api    → keyed provider by ShortCode (MtiApiQuoteProvider, ViriyahCmiQuoteProvider, …)
```

---

## 3. New Entity — `VehicleSyncLog`

**Location**: `Ihos.Domain/Entities/VehicleSyncLog.cs`

Inherits `BaseEntity` (Id, CreatedAtUtc, CreatedBy, UpdatedAtUtc, UpdatedBy, IsDeleted, DeletedAtUtc, DeletedBy).

| Field | Type | Required | Notes |
|---|---|---|---|
| `Id` | `Guid` | ✅ | PK |
| `CompanyId` | `Guid` | ✅ | FK → `InsuranceCompanies.Id` |
| `Trigger` | `SyncTriggerType` enum | ✅ | `Scheduled` (0) or `Manual` (1) |
| `TriggeredByUserId` | `Guid?` | ⚪ | NULL for `Scheduled`; user Id for `Manual` |
| `StartedAtUtc` | `DateTime` | ✅ | UTC |
| `CompletedAtUtc` | `DateTime?` | ⚪ | NULL while running |
| `Status` | `SyncStatus` enum | ✅ | `Running` (0), `Succeeded` (1), `Failed` (2), `PartialSuccess` (3) |
| `InsertedCount` | `int` | ✅ | New vehicle rows created |
| `UpdatedCount` | `int` | ✅ | Existing rows refreshed |
| `DeactivatedCount` | `int` | ✅ | Soft-deactivated (missing from source) |
| `ErrorCount` | `int` | ✅ | Records that failed processing |
| `ErrorMessage` | `string?` | ⚪ | Truncated to 2000 chars; full detail in logs |
| `DurationMs` | `long?` | ⚪ | Set on completion |

**Indexes**:
- `IX_VehicleSyncLogs_CompanyId_StartedAtUtc` (descending) — supports "latest sync per provider" query.
- `IX_VehicleSyncLogs_Status` — supports admin filtering.

**Immutability**: A sync log row is **append-only after completion**. The orchestrator inserts with `Status=Running`, then `UPDATE` once when finished. No further mutation. Aligns with Principle IV (Traceability).

---

## 4. New Enums (Sync)

**Location**: `Ihos.Domain/Enums/`

```csharp
public enum SyncTriggerType { Scheduled = 0, Manual = 1 }
public enum SyncStatus      { Running = 0, Succeeded = 1, Failed = 2, PartialSuccess = 3 }
```

---

## 5. Migration Plan

**File**: `Ihos.Infrastructure/Persistence/Migrations/00X_AddProviderDataSourceAndSyncLog.cs`

```text
Up:
  1. ALTER TABLE "InsuranceCompanies" ADD COLUMN "DataSource" integer NOT NULL DEFAULT 0;
  2. CREATE TABLE "VehicleSyncLogs" ( … columns above …, plus BaseEntity audit cols );
  3. CREATE INDEX "IX_VehicleSyncLogs_CompanyId_StartedAtUtc" ON "VehicleSyncLogs" ("CompanyId", "StartedAtUtc" DESC);
  4. CREATE INDEX "IX_VehicleSyncLogs_Status" ON "VehicleSyncLogs" ("Status");
  5. Seed updates:
     UPDATE "InsuranceCompanies" SET "DataSource" = 1 WHERE "ShortCode" IN ('MTI','VIRIYAH');
     -- Allianz (ALA) stays at default 0 (Import).
     -- INSERT MTI row if not present (ShortCode='MTI', DataSource=1, IsActive=true).

Down:
  1. DROP TABLE "VehicleSyncLogs";
  2. ALTER TABLE "InsuranceCompanies" DROP COLUMN "DataSource";
```

**Safety check**: This migration only **adds**. No existing data is altered destructively. Per Constitution Principle V.

---

## 6. Relationships (ER Snapshot)

```text
InsuranceCompany 1 ──< VehicleSyncLog
                  │
                  └─< VehicleModel ──< VehicleModelMapping  (unchanged)
                  │
                  └─< InsurancePlan                           (unchanged)
```

No new foreign keys outside `VehicleSyncLog.CompanyId`.

---

## 7. Provider-Specific Configuration (NOT a DB entity)

Provider connection details (URLs, credentials, timeouts) live in `appsettings.{env}.json` bound to strongly-typed options classes (`MtiOptions`, `ViriyahOptions`) — **not** in the database. This keeps secrets out of the schema and allows env-specific values without DB writes.

The DB stores only: `ShortCode` (DI key), `DisplayName`, `IsActive`, `DataSource`. Everything else needed to call the provider comes from configuration.

---

## 8. Out of Scope (Schema-wise)

- No new tables for caching (cache is in-process / Redis).
- No new tables for quote history (existing `Quotation` unchanged).
- No new columns on `InsurancePlan` or `VehicleModel`.
