# Implementation Plan: Multi-Provider Insurance Quote Integration

**Branch**: `002-multi-provider-integration` | **Date**: 2026-05-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-multi-provider-integration/spec.md`

## Summary

Add real-time API integration with MTI (Muang Thai Insurance) and Viriyah Insurance while preserving the existing Allianz import flow. Introduce a Provider abstraction so each insurer is encapsulated behind a uniform interface. Vehicle master data from API-based providers is synchronized into the local database on a configurable daily schedule and on demand from a new admin page. Search aggregates plans from every active provider in parallel with per-provider timeouts and Circuit Breaker resilience; UI renders progressively as each provider responds. Cache layer reduces external API load and serves stale data with a clear badge during partner outages.

## Technical Context

**Language/Version**: C# 13 / .NET 10 (backend) · TypeScript / Angular 21 LTS (frontend)
**Primary Dependencies**:
- Backend: ASP.NET Core, Entity Framework Core 10 (PostgreSQL provider), Polly (resilience — timeout, circuit breaker, retry), built-in `IHostedService` (scheduled sync), `IDistributedCache` (in-memory initially, Redis-compatible later), Serilog (logging), MediatR-style mediator (existing in `Ihos.Application.Mediator`).
- Frontend: Angular Signals (state), Tailwind CSS 4, Angular Material 21 (existing components), RxJS for streaming sync progress.

**Storage**: PostgreSQL 16 (existing instance on port 5431, db `ihos_dev`). Schema extensions add one column (`InsuranceCompany.DataSource`) and one table (`VehicleSyncLogs`). No destructive migrations.

**Testing**:
- Backend: xUnit (existing in `backend/tests/Ihos.*.Tests`), integration tests via `WebApplicationFactory` in `Ihos.API.IntegrationTests`.
- Frontend: Vitest 4 + jsdom 27 (existing).
- Provider adapters: integration-tested with mocked HTTP responses (WireMock.NET or `HttpMessageHandler` fake).

**Target Platform**: Linux/Windows server (.NET 10) for backend, modern browsers (Angular 21) for frontend.

**Project Type**: Web application (existing backend + frontend monorepo at `ihos/`).

**Performance Goals**:
- Search aggregation p95 ≤ 3 seconds (Spec SC-002)
- Vehicle dropdown response p95 ≤ 200 ms (Spec SC-003)
- Daily sync completes within 10 minutes per provider (operational target)

**Constraints**:
- Constitution Principle VIII: Search SLA < 2 s p95 — this feature loosens to 3 s for multi-provider aggregation; the cache-served path retains the < 2 s target.
- Constitution Principle V: All deletes must be soft. Sync uses upsert; no row deletion.
- MTI `GetCoverage` requires `Fund: -1` magic value (encapsulated inside MTI adapter as a private constant).
- Viriyah password contains backslash and special characters — must be stored as a verbatim string in configuration (no escape interpretation).
- Token refresh: Viriyah JWT expires every 3600 s; adapter refreshes ≥ 60 s before expiry.

**Scale/Scope**:
- 3 active providers at initial launch (MTI, Viriyah, Allianz).
- Designed per Constitution Principle IX to scale to ≥ 30 providers without code changes (provider rows added via DB config).
- Vehicle master data volume per provider: ~ 15 k records (Viriyah CSV reference); MTI similar order of magnitude.

## Constitution Check

*Gate evaluation against `.specify/memory/constitution.md` v1.1.0. Re-checked after Phase 1 design — see end of file.*

| Principle | Compliance | Justification |
|---|---|---|
| **I. Accuracy over Automation** | ✅ Pass | Cache serves data that was previously validated by a successful live call. Sync writes flagged auto-suggestions still require human review under existing Mapping module — unchanged. |
| **II. Standardization** | ✅ Pass | Each provider adapter normalizes incoming data into the canonical `InsurancePlan` / `VehicleModel` schemas before persisting. Raw provider codes live only inside `*ApiQuoteProvider` and `*MasterSyncer` classes. |
| **III. Mapping-First** | ✅ Pass | All provider-specific vehicle codes resolved via existing `VehicleModelMapping` table. New MTI/Viriyah vehicle records create mapping entries during sync; unresolved entries flagged for review (existing flow). |
| **IV. Traceability** | ✅ Pass | New `VehicleSyncLogs` table captures provider, trigger type, actor (for manual), timestamps, outcome, and error details — immutable per Principle V. |
| **V. Safety-First Data Handling** | ✅ Pass | Schema migration is additive only (one new column, one new table). Sync uses upsert semantics; existing soft-delete columns inherited from `BaseEntity` on new table. |
| **VI. Modular Architecture** | ✅ Pass | Provider abstraction lives in `Ihos.Application/Providers/`. Search module fans out via interface; no direct EF Core or HTTP calls from Search module. Admin sync endpoints live in dedicated controller. |
| **VII. Human-in-the-Loop** | ✅ Pass | Auto-mapping suggestions during sync still enter pending-review state (existing `IsAutoSuggested` flag on `VehicleModelMapping`). Sync does not auto-publish unreviewed plans. |
| **VIII. Performance** | ⚠️ Justified deviation | Search SLA loosens from 2 s to 3 s (p95) for **multi-provider aggregation case**. Cache-hit path and single-provider path retain < 2 s. See Complexity Tracking. |
| **IX. Scalability** | ✅ Pass | Provider registration is data-driven (DB row + DI registration by short-code). Adding a new provider requires only a new adapter class and a DB row. |
| **X. Technology Constraints** | ✅ Pass | All new code in .NET 10 + EF Core + PostgreSQL + Angular 21. Clean Architecture preserved. |
| **Auth & Authorization** | ✅ Pass | Manual sync endpoint requires `RequireSeniorStaff` policy minimum. JWT-protected. Sync log includes actor identity. |

**Gate result**: **PASS with one documented deviation** (Principle VIII, see Complexity Tracking).

## Project Structure

### Documentation (this feature)

```text
specs/002-multi-provider-integration/
├── plan.md              # This file
├── research.md          # Phase 0 output — design decisions
├── data-model.md        # Phase 1 output — entities & migrations
├── quickstart.md        # Phase 1 output — local setup steps
├── contracts/
│   ├── admin-sync.md    # Manual sync API contract
│   └── search.md        # Search aggregation contract (modified)
└── checklists/
    └── requirements.md  # From /speckit.specify
```

### Source Code (repository root)

Existing layout under `ihos/` preserved. Additions and modifications:

```text
ihos/backend/src/
├── Ihos.Domain/
│   ├── Enums/
│   │   └── DataSourceType.cs              [NEW]   enum { Import, Api }
│   └── Entities/
│       ├── InsuranceCompany.cs            [EDIT]  + DataSource property
│       └── VehicleSyncLog.cs              [NEW]   sync history row
│
├── Ihos.Application/
│   ├── Providers/                         [NEW MODULE]
│   │   ├── IInsurerQuoteProvider.cs       [NEW]   per-provider quote interface
│   │   ├── IVehicleMasterSyncer.cs        [NEW]   per-provider sync interface
│   │   ├── ImportQuoteProvider.cs         [NEW]   wraps existing import flow
│   │   ├── ProviderRegistry.cs            [NEW]   maps CompanyId → providers
│   │   ├── ProviderQuoteRequest.cs        [NEW]   canonical request DTO
│   │   └── ProviderQuoteResult.cs         [NEW]   canonical response DTO
│   ├── Sync/
│   │   ├── Commands/
│   │   │   ├── TriggerVehicleSyncCommand.cs       [NEW]
│   │   │   └── TriggerVehicleSyncCommandHandler.cs [NEW]
│   │   ├── Queries/
│   │   │   └── GetSyncStatusQuery.cs              [NEW]
│   │   └── SyncOrchestrator.cs                    [NEW]
│   └── Search/
│       └── Queries/SearchPlansQuery.cs    [EDIT]  fan out via ProviderRegistry
│
├── Ihos.Infrastructure/
│   ├── Providers/
│   │   ├── Mti/
│   │   │   ├── MtiApiQuoteProvider.cs              [NEW]
│   │   │   ├── MtiHttpClient.cs                    [NEW]
│   │   │   ├── MtiOptions.cs                       [NEW]
│   │   │   └── MtiVehicleMasterSyncer.cs           [NEW]
│   │   └── Viriyah/
│   │       ├── ViriyahCmiQuoteProvider.cs          [NEW]
│   │       ├── ViriyahVmiQuoteProvider.cs          [NEW]
│   │       ├── ViriyahHttpClient.cs                [NEW]
│   │       ├── ViriyahOptions.cs                   [NEW]
│   │       ├── ViriyahTokenCache.cs                [NEW]
│   │       └── ViriyahCsvMasterImporter.cs         [NEW]
│   ├── Resilience/
│   │   └── PollyPolicyFactory.cs                   [NEW]   timeout + breaker config
│   ├── Caching/
│   │   └── QuoteCacheService.cs                    [NEW]   SWR cache wrapper
│   ├── BackgroundServices/
│   │   └── VehicleSyncBackgroundService.cs         [NEW]   daily schedule
│   └── Persistence/
│       ├── Configurations/
│       │   └── VehicleSyncLogConfiguration.cs      [NEW]
│       └── Migrations/
│           └── 00X_AddProviderDataSourceAndSyncLog.cs  [NEW]
│
├── Ihos.API/
│   ├── Controllers/
│   │   └── AdminSyncController.cs                  [NEW]
│   └── Program.cs                                  [EDIT]  register providers + HostedService
│
└── tests/
    ├── Ihos.Infrastructure.Tests/Providers/
    │   ├── MtiApiQuoteProviderTests.cs             [NEW]
    │   └── ViriyahCmiQuoteProviderTests.cs         [NEW]
    └── Ihos.API.IntegrationTests/
        └── AdminSyncControllerTests.cs             [NEW]

ihos/frontend/src/app/
└── mapping/
    └── sync/                                       [NEW FEATURE]
        ├── sync.component.ts
        ├── sync.component.html
        ├── sync.routes.ts
        └── sync-api.service.ts
```

**Structure Decision**: Existing **Web application** layout retained (backend + frontend at `ihos/`). New code adheres to the Clean Architecture boundaries already established in `Ihos.Domain` → `Ihos.Application` → `Ihos.Infrastructure` → `Ihos.API`. The Provider abstraction lives in the Application layer (Constitution Principle VI — module boundary). Concrete adapters live in Infrastructure.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Principle VIII — Search SLA relaxed from 2 s to 3 s p95 for the multi-provider aggregation path | External provider APIs have round-trip latency outside our control (MTI live tests showed 1.5–2.5 s for `GetCoverage` alone). Aggregating three providers in parallel with a 3 s timeout each is the tightest bound the feature can guarantee without dropping providers. | Hard 2 s timeout would force premature drops of slow-but-responsive providers, reducing comparison breadth — the core value proposition of the feature. Caching mitigates this on repeat searches (cache-hit responses remain under 100 ms). |

## Post-Phase-1 Constitution Re-check

After completing Phase 1 design artifacts (data-model.md, contracts/, quickstart.md), the gates remain:

- All ten principles still satisfied per the entries above.
- Auth & Authorization: confirmed `AdminSyncController` uses `[Authorize(Policy = "RequireSeniorStaff")]` and audit-logs sync triggers.
- The relaxed Search SLA (3 s) is fenced to the multi-provider live path only; existing single-provider import path stays under the original 2 s budget.

**Final gate result**: **PASS**.
