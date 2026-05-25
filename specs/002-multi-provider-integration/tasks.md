# Tasks: Multi-Provider Insurance Quote Integration

**Feature Branch**: `002-multi-provider-integration`
**Input**: Design documents from `/specs/002-multi-provider-integration/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Included for provider adapters and admin sync endpoints — these are the highest-risk integration surfaces (per plan.md test strategy). Other layers ship without dedicated test tasks (covered by integration tests + manual QA).

**Organization**: Grouped by user story. Stories 1–2 (P1) form the MVP. Stories 3–5 (P2) strengthen ops/resilience.

## User Stories (from spec.md)

- **US1 (P1)** — Multi-provider quote aggregation with live MTI + Viriyah results alongside Allianz
- **US2 (P1)** — Fast vehicle dropdown backed by synced/cached master data
- **US3 (P2)** — Admin-triggered manual vehicle-master sync with status visibility
- **US4 (P2)** — Daily scheduled vehicle-master sync per API-sourced provider
- **US5 (P2)** — Resilient search: per-provider timeouts, circuit breaker, stale-cache fallback with badge

## Path Conventions

Web app monorepo at `ihos/`:
- Backend: `ihos/backend/src/Ihos.{Domain,Application,Infrastructure,API}/`
- Tests: `ihos/backend/tests/Ihos.{Infrastructure,API.Integration}.Tests/`
- Frontend: `ihos/frontend/src/app/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Branch, packages, configuration scaffolding.

- [ ] T001 Confirm branch `002-multi-provider-integration` checked out; verify clean working tree with `git status`
- [ ] T002 [P] Add NuGet `Polly` (v8) and `Microsoft.Extensions.Http.Resilience` to `ihos/backend/src/Ihos.Infrastructure/Ihos.Infrastructure.csproj`
- [ ] T003 [P] Add NuGet `Microsoft.Extensions.Caching.Memory` (for `MemoryDistributedCache`) reference confirmed in `ihos/backend/src/Ihos.API/Ihos.API.csproj`
- [ ] T004 [P] Add NuGet `WireMock.Net` to `ihos/backend/tests/Ihos.Infrastructure.Tests/Ihos.Infrastructure.Tests.csproj`
- [ ] T005 [P] Add `Providers:Mti` and `Providers:Viriyah` placeholder sections to `ihos/backend/src/Ihos.API/appsettings.Development.json` (empty values; real values via user-secrets per quickstart.md)
- [ ] T006 [P] Create folder skeletons: `ihos/backend/src/Ihos.Application/Providers/`, `ihos/backend/src/Ihos.Application/Sync/{Commands,Queries}/`, `ihos/backend/src/Ihos.Infrastructure/Providers/{Mti,Viriyah}/`, `ihos/backend/src/Ihos.Infrastructure/{Resilience,Caching,BackgroundServices}/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, domain types, provider abstraction skeleton — everything every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Domain layer

- [ ] T007 [P] Create `DataSourceType` enum in `ihos/backend/src/Ihos.Domain/Enums/DataSourceType.cs` (values: `Import=0`, `Api=1`)
- [ ] T008 [P] Create `SyncTriggerType` enum in `ihos/backend/src/Ihos.Domain/Enums/SyncTriggerType.cs` (values: `Scheduled=0`, `Manual=1`)
- [ ] T009 [P] Create `SyncStatus` enum in `ihos/backend/src/Ihos.Domain/Enums/SyncStatus.cs` (values: `Running=0`, `Succeeded=1`, `Failed=2`, `PartialSuccess=3`)
- [ ] T010 [P] Create `VehicleSyncLog` entity in `ihos/backend/src/Ihos.Domain/Entities/VehicleSyncLog.cs` (inherits `BaseEntity`; properties per data-model.md §3)
- [ ] T011 Add `DataSource` property (default `Import`) to `InsuranceCompany` entity in `ihos/backend/src/Ihos.Domain/Entities/InsuranceCompany.cs`

### Application layer — provider abstraction

- [ ] T012 [P] Create `ProviderQuoteRequest` DTO in `ihos/backend/src/Ihos.Application/Providers/ProviderQuoteRequest.cs` (fields: VehicleModelId, Year, CoverageType, SumInsured, Deductible, DriverAgeBand, UsageType, RequestId)
- [ ] T013 [P] Create `ProviderQuoteResult` DTO in `ihos/backend/src/Ihos.Application/Providers/ProviderQuoteResult.cs` (fields: CompanyShortCode, Status enum, IsStale, Plans, ErrorCode, ErrorMessage, ProviderLatencyMs)
- [ ] T014 [P] Create `ProviderQuoteStatus` enum in `ihos/backend/src/Ihos.Application/Providers/ProviderQuoteStatus.cs` (Success, NoMatch, Timeout, BreakerOpen, Failed)
- [ ] T015 [P] Define `IInsurerQuoteProvider` interface in `ihos/backend/src/Ihos.Application/Providers/IInsurerQuoteProvider.cs` with `string ShortCode { get; }` and `Task<ProviderQuoteResult> GetQuoteAsync(ProviderQuoteRequest, CancellationToken)`
- [ ] T016 [P] Define `IVehicleMasterSyncer` interface in `ihos/backend/src/Ihos.Application/Providers/IVehicleMasterSyncer.cs` with `string ShortCode { get; }` and `Task<SyncOutcome> SyncAsync(SyncTriggerType, Guid? actorUserId, CancellationToken)`
- [ ] T017 [P] Create `SyncOutcome` record in `ihos/backend/src/Ihos.Application/Providers/SyncOutcome.cs` (counts + status + error message)
- [ ] T018 Create `ProviderRegistry` class in `ihos/backend/src/Ihos.Application/Providers/ProviderRegistry.cs` — resolves active `IInsurerQuoteProvider`/`IVehicleMasterSyncer` instances by `ShortCode` from DB-backed `InsuranceCompany` list (depends on T015–T017)

### Infrastructure — persistence

- [ ] T019 Create EF Core configuration for `VehicleSyncLog` in `ihos/backend/src/Ihos.Infrastructure/Persistence/Configurations/VehicleSyncLogConfiguration.cs` (PK, indexes per data-model.md §3, FK to `InsuranceCompany`)
- [ ] T020 Add `DbSet<VehicleSyncLog> VehicleSyncLogs` to `IhosDbContext` in `ihos/backend/src/Ihos.Infrastructure/Persistence/IhosDbContext.cs`
- [ ] T021 Generate EF migration `AddProviderDataSourceAndSyncLog` in `ihos/backend/src/Ihos.Infrastructure/Persistence/Migrations/`: column `InsuranceCompanies.DataSource int NOT NULL DEFAULT 0`, table `VehicleSyncLogs` with indexes, seed `UPDATE` to set MTI/VIRIYAH `DataSource=1` and INSERT MTI row if missing
- [ ] T022 Apply migration locally and verify schema via `psql` or MCP `ihos-db` (depends on T021)

### Infrastructure — resilience + cache skeletons

- [ ] T023 [P] Create `PollyPolicyFactory` in `ihos/backend/src/Ihos.Infrastructure/Resilience/PollyPolicyFactory.cs` exposing `BuildQuotePipeline(string providerKey)` per research.md §2 (timeout 3 s → breaker → retry once)
- [ ] T024 [P] Create `QuoteCacheService` in `ihos/backend/src/Ihos.Infrastructure/Caching/QuoteCacheService.cs` wrapping `IDistributedCache` with SWR semantics (fresh 15 min, stale 24 h) — exposes `GetOrCallAsync<T>(key, factory, ct)` returning `(value, isStale)`
- [ ] T025 [P] Create `ImportQuoteProvider` in `ihos/backend/src/Ihos.Application/Providers/ImportQuoteProvider.cs` — reads pre-imported `InsurancePlan` rows for `DataSource=Import` companies (handles Allianz path)

### API + DI

- [ ] T026 Register foundational services in `ihos/backend/src/Ihos.API/Program.cs`: `AddMemoryCache()` + `AddDistributedMemoryCache()`, `ProviderRegistry`, `PollyPolicyFactory`, `QuoteCacheService`, `ImportQuoteProvider` keyed by each Import-source `ShortCode` (depends on T018, T023–T025)

**Checkpoint**: Foundation ready — schema migrated, abstractions in place, DI wired. User-story work can begin.

---

## Phase 3: User Story 1 — Multi-Provider Live Quote Aggregation (P1) 🎯 MVP

**Goal**: When a user searches, the response includes live quotes from MTI and Viriyah alongside Allianz (import), aggregated per-provider with per-provider status.

**Independent Test**: Hit `POST /api/search/plans` with a valid vehicle/year/coverage. Response contains 3 entries (MTI, VIRIYAH, ALA) with `status=Success` and non-empty `plans`. Aggregated p95 latency ≤ 3 s.

### MTI adapter

- [ ] T027 [P] [US1] Create `MtiOptions` in `ihos/backend/src/Ihos.Infrastructure/Providers/Mti/MtiOptions.cs` (BaseUrl, ApiKey, BasicAuth)
- [ ] T028 [P] [US1] Create `MtiHttpClient` typed client in `ihos/backend/src/Ihos.Infrastructure/Providers/Mti/MtiHttpClient.cs` — registered via `IHttpClientFactory` with PascalCase JSON, `apikey` + `Authorization: Basic` default headers
- [ ] T029 [US1] Implement `MtiApiQuoteProvider : IInsurerQuoteProvider` in `ihos/backend/src/Ihos.Infrastructure/Providers/Mti/MtiApiQuoteProvider.cs` — call `GetCoverage` with `Fund = -1` (encapsulated `private const int CoverageFundMagicValue = -1;` with comment), map response → `ProviderQuoteResult`, classify errors to `ProviderQuoteStatus` (depends on T028)
- [ ] T030 [P] [US1] Test `MtiApiQuoteProviderTests` in `ihos/backend/tests/Ihos.Infrastructure.Tests/Providers/MtiApiQuoteProviderTests.cs` — WireMock fixture: (a) success path with sample MTI JSON returns ≥1 plan, (b) verifies request body contains `Fund=-1`, (c) HTTP 500 → `Failed` status, (d) timeout → `Timeout` status

### Viriyah adapter

- [ ] T031 [P] [US1] Create `ViriyahOptions` in `ihos/backend/src/Ihos.Infrastructure/Providers/Viriyah/ViriyahOptions.cs` (BaseUrl, ClientId, ClientSecret, UserName, Password, AgentCode) — bound from user-secrets
- [ ] T032 [P] [US1] Create `ViriyahHttpClient` typed client in `ihos/backend/src/Ihos.Infrastructure/Providers/Viriyah/ViriyahHttpClient.cs` with camelCase JSON; separate `"viriyah-token"` named client for token endpoint
- [ ] T033 [US1] Implement `ViriyahTokenCache` in `ihos/backend/src/Ihos.Infrastructure/Providers/Viriyah/ViriyahTokenCache.cs` — singleton, `SemaphoreSlim`-gated, refreshes ≥ 60 s before expiry (depends on T032)
- [ ] T034 [US1] Implement `ViriyahCmiQuoteProvider : IInsurerQuoteProvider` in `ihos/backend/src/Ihos.Infrastructure/Providers/Viriyah/ViriyahCmiQuoteProvider.cs` — uses token cache, calls CMI quotation endpoint, maps to `ProviderQuoteResult` (depends on T033)
- [ ] T035 [US1] Implement `ViriyahVmiQuoteProvider : IInsurerQuoteProvider` in `ihos/backend/src/Ihos.Infrastructure/Providers/Viriyah/ViriyahVmiQuoteProvider.cs` — VMI variant, distinguishes by `CoverageType` (depends on T033)
- [ ] T036 [P] [US1] Test `ViriyahCmiQuoteProviderTests` in `ihos/backend/tests/Ihos.Infrastructure.Tests/Providers/ViriyahCmiQuoteProviderTests.cs` — WireMock: (a) token acquisition then quote, (b) token expiry triggers refresh, (c) 401 → token re-fetch + retry

### Search aggregation

- [ ] T037 [US1] Edit `SearchPlansQuery` handler in `ihos/backend/src/Ihos.Application/Search/Queries/SearchPlansQuery.cs` (or its handler file): replace direct DB read with `ProviderRegistry.GetActiveQuoteProvidersAsync()` → `Task.WhenAll` per provider, exception-isolated, results aggregated into `SearchPlansResult` per contracts/search.md
- [ ] T038 [US1] Update `SearchController` (or existing search endpoint) in `ihos/backend/src/Ihos.API/Controllers/` to return the new response shape (per-provider `status`, `isStale`, `plans`, `providerLatencyMs`, `errorMessage`)
- [ ] T039 [US1] Register MTI + Viriyah providers in `ihos/backend/src/Ihos.API/Program.cs` keyed by `"MTI"`, `"VIRIYAH"`; bind options from configuration; wire `AddHttpClient` + resilience handler per research.md §5 (depends on T029, T034, T035)

### Frontend — search results

- [ ] T040 [P] [US1] Update search results component in `ihos/frontend/src/app/search/results/` to render per-provider cards with status badges (Success / Unavailable / Cached); show `errorMessage` for `Failed`
- [ ] T041 [P] [US1] Update search API service in `ihos/frontend/src/app/search/search-api.service.ts` to match new response shape

**Checkpoint**: User Story 1 fully functional. Manual smoke test: search for TOYO YARIS 2025 — returns ≥ 2 live providers + Allianz.

---

## Phase 4: User Story 2 — Fast Vehicle Dropdown from Master Data (P1)

**Goal**: Vehicle dropdown on the search form responds in p95 ≤ 200 ms by reading from local synced master data (no live API calls on dropdown).

**Independent Test**: Open the search form. Vehicle dropdown loads within 200 ms (network panel) and contains entries from all 3 providers including MTI- and Viriyah-sourced rows.

### Master data sync — MTI

- [ ] T042 [US2] Implement `MtiVehicleMasterSyncer : IVehicleMasterSyncer` in `ihos/backend/src/Ihos.Infrastructure/Providers/Mti/MtiVehicleMasterSyncer.cs` — call MTI master endpoints, upsert into `VehicleModel`, soft-deactivate missing, flag new rows for mapping review per data-model.md §8

### Master data sync — Viriyah

- [ ] T043 [US2] Implement `ViriyahCsvMasterImporter : IVehicleMasterSyncer` in `ihos/backend/src/Ihos.Infrastructure/Providers/Viriyah/ViriyahCsvMasterImporter.cs` — Viriyah master data delivered via reference CSV (~15k rows); parse + upsert (note: until Viriyah exposes a master API, this reads a configured CSV path; document fallback in code comment)

### Vehicle dropdown endpoint

- [ ] T044 [P] [US2] Confirm existing `GET /api/vehicles?search=...` endpoint reads from DB only (no provider calls); add index `IX_VehicleModels_CompanyId_IsActive_DisplayName` migration in `ihos/backend/src/Ihos.Infrastructure/Persistence/Migrations/` if missing
- [ ] T045 [P] [US2] Add output caching (60 s) on the vehicle dropdown endpoint in `ihos/backend/src/Ihos.API/Controllers/VehiclesController.cs` to serve repeat keystrokes from cache

### DI registration

- [ ] T046 [US2] Register `MtiVehicleMasterSyncer` and `ViriyahCsvMasterImporter` keyed by `ShortCode` in `Program.cs` (depends on T042, T043)

**Checkpoint**: Dropdown loads fast; reflects synced data from MTI + Viriyah + Allianz.

---

## Phase 5: User Story 3 — Manual Vehicle Master Sync (Admin) (P2)

**Goal**: Senior Staff can trigger a vehicle-master sync per provider from the admin UI and observe progress + history.

**Independent Test**: As Senior Staff, navigate to `/mapping/sync`, click "Sync Now" for MTI. Status transitions Running → Succeeded within ~5 min; counts displayed.

### Application layer

- [ ] T047 [P] [US3] Create `TriggerVehicleSyncCommand` in `ihos/backend/src/Ihos.Application/Sync/Commands/TriggerVehicleSyncCommand.cs` (CompanyId, ActorUserId)
- [ ] T048 [US3] Create `SyncOrchestrator` in `ihos/backend/src/Ihos.Application/Sync/SyncOrchestrator.cs` — inserts `VehicleSyncLog` Running, invokes `IVehicleMasterSyncer.SyncAsync`, updates log row on completion; rejects if a Running log already exists for the company
- [ ] T049 [US3] Create `TriggerVehicleSyncCommandHandler` in `ihos/backend/src/Ihos.Application/Sync/Commands/TriggerVehicleSyncCommandHandler.cs` — validates company is `DataSource=Api`, fires `SyncOrchestrator.StartAsync` in background, returns `syncLogId`
- [ ] T050 [P] [US3] Create `GetSyncStatusQuery` + handler in `ihos/backend/src/Ihos.Application/Sync/Queries/GetSyncStatusQuery.cs` — per contracts/admin-sync.md §GET /status
- [ ] T051 [P] [US3] Create `GetSyncHistoryQuery` + handler in `ihos/backend/src/Ihos.Application/Sync/Queries/GetSyncHistoryQuery.cs` — paginated per contracts/admin-sync.md §GET /history

### API

- [ ] T052 [US3] Create `AdminSyncController` in `ihos/backend/src/Ihos.API/Controllers/AdminSyncController.cs` with `[Authorize(Policy = "RequireSeniorStaff")]` covering `POST /api/admin/sync/vehicle-master/{companyId}`, `GET /api/admin/sync/status`, `GET /api/admin/sync/history` (depends on T049–T051)
- [ ] T053 [US3] Integration tests `AdminSyncControllerTests` in `ihos/backend/tests/Ihos.API.IntegrationTests/AdminSyncControllerTests.cs` — (a) Staff role gets 403, (b) Senior Staff triggers sync returns 202 + syncLogId, (c) second concurrent trigger returns 409, (d) status reflects completion

### Frontend

- [ ] T054 [P] [US3] Create `sync-api.service.ts` in `ihos/frontend/src/app/mapping/sync/sync-api.service.ts` — typed client for the 3 admin endpoints
- [ ] T055 [P] [US3] Create `sync.component.ts/html` in `ihos/frontend/src/app/mapping/sync/` — table of API-sourced providers, last sync timestamp + status badge, "Sync Now" button (visible per `RequireSeniorStaff`), live progress polling every 5 s
- [ ] T056 [US3] Register route in `ihos/frontend/src/app/mapping/sync/sync.routes.ts` and add nav entry under Mapping (depends on T055)

**Checkpoint**: Manual sync end-to-end working with audit + UI.

---

## Phase 6: User Story 4 — Scheduled Daily Sync (P2)

**Goal**: Every API-sourced provider's vehicle master refreshes automatically at 02:00 local time daily.

**Independent Test**: Configure schedule to a near-future time, wait, verify `VehicleSyncLog` row with `Trigger=Scheduled` and `TriggeredByUserId=NULL` appears with `Status=Succeeded`.

- [ ] T057 [US4] Implement `VehicleSyncBackgroundService : BackgroundService` in `ihos/backend/src/Ihos.Infrastructure/BackgroundServices/VehicleSyncBackgroundService.cs` per research.md §4 — computes next 02:00 local, `Task.Delay`, iterates active `DataSource=Api` companies, calls `SyncOrchestrator` for each (depends on T048)
- [ ] T058 [US4] Add `SyncScheduleOptions` bound from `Providers:SyncSchedule:DailyAtLocal` (default `"02:00"`) in `ihos/backend/src/Ihos.Infrastructure/BackgroundServices/SyncScheduleOptions.cs`
- [ ] T059 [US4] Register `AddHostedService<VehicleSyncBackgroundService>()` and bind `SyncScheduleOptions` in `ihos/backend/src/Ihos.API/Program.cs` (depends on T057)

**Checkpoint**: Daily sync runs unattended; same audit trail as manual.

---

## Phase 7: User Story 5 — Resilience & Stale-Cache Fallback (P2)

**Goal**: When a provider is slow or down, search degrades gracefully: timeout-bounded, circuit-broken, stale-cache served with a clear UI badge.

**Independent Test**: Kill a provider (e.g., point MTI BaseUrl to a non-routable host). Search still returns within 3 s; MTI shows `status=Timeout` or `BreakerOpen`; other providers unaffected. With cache populated, MTI returns stale data with `isStale=true` badge in UI.

- [ ] T060 [US5] Wire `PollyPolicyFactory.BuildQuotePipeline` into each provider's `IHttpClientFactory` registration in `Program.cs` (per-provider pipeline instance — failures isolated) (depends on T023, T039)
- [ ] T061 [US5] Integrate `QuoteCacheService` into `MtiApiQuoteProvider`, `ViriyahCmiQuoteProvider`, `ViriyahVmiQuoteProvider` — wrap outbound call in `GetOrCallAsync` so stale responses are returned with `IsStale=true` on provider failure (depends on T024, T029, T034, T035)
- [ ] T062 [US5] Ensure `SearchPlansQuery` handler maps Polly `BrokenCircuitException` → `ProviderQuoteStatus.BreakerOpen` and `TimeoutRejectedException` → `ProviderQuoteStatus.Timeout` (depends on T037)
- [ ] T063 [P] [US5] Add Serilog enrichers + `System.Diagnostics.Metrics` counters per research.md §10 in `ihos/backend/src/Ihos.Infrastructure/Observability/ProviderMetrics.cs` — emitted from each adapter
- [ ] T064 [P] [US5] Frontend: add "Cached" badge component rendering when `result.isStale === true`; add "Unavailable" state rendering for `Timeout`/`BreakerOpen`/`Failed` in `ihos/frontend/src/app/search/results/`
- [ ] T065 [US5] Integration test in `ihos/backend/tests/Ihos.API.IntegrationTests/SearchResilienceTests.cs` — (a) provider returning 500 results in cached-stale response, (b) provider that exceeds 3 s yields `Timeout` while other providers succeed within budget

**Checkpoint**: Partial outages are visible, bounded, and non-blocking.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T066 [P] Update `ihos/CLAUDE.md` Recent Changes section confirmed (already done during /plan; verify still current)
- [ ] T067 [P] Add operator runbook section to `ihos/specs/002-multi-provider-integration/quickstart.md` covering "stuck Running sync log" remediation
- [ ] T068 [P] Add p95 latency dashboard query examples (Serilog filters / Prometheus) to `ihos/docs/observability.md` (create file if missing)
- [ ] T069 Run full `dotnet test` in `ihos/backend/` and ensure all green
- [ ] T070 Run frontend `npm test` in `ihos/frontend/`
- [ ] T071 Execute quickstart.md steps 5–6 end-to-end on a clean checkout to validate the developer onboarding path
- [ ] T072 Confirm Constitution gate still PASS: verify no hard deletes introduced, all admin endpoints carry `RequireSeniorStaff`, `VehicleSyncLog` immutable-after-completion enforced

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: no deps
- **Phase 2 (Foundational)**: depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1)**, **Phase 4 (US2)**, **Phase 5 (US3)**, **Phase 6 (US4)**, **Phase 7 (US5)**: all start once Phase 2 done
  - US3 and US4 both depend on the `SyncOrchestrator` (T048), so US4 needs at least T048 from US3
  - US5 depends on adapters from US1 (T029, T034, T035) and the cache service (T024)
- **Phase 8 (Polish)**: after all desired user stories

### User Story Dependencies

- **US1 (P1)**: independent — only Phase 2 needed
- **US2 (P1)**: independent — only Phase 2 needed
- **US3 (P2)**: independent core path; benefits from US2 adapters being present (T042, T043) for end-to-end testing but can be coded against any `IVehicleMasterSyncer`
- **US4 (P2)**: depends on T048 (SyncOrchestrator from US3)
- **US5 (P2)**: depends on US1 adapters (live providers to make resilient)

### Within Each User Story

- DTOs / Options classes [P] → typed HTTP client → adapter implementation → DI registration → frontend wiring
- Tests for adapters (US1) sit alongside the adapter task and gate the checkpoint

### Parallel Opportunities

- All `[P]` tasks within Phase 1 (T002–T006)
- All `[P]` tasks within Phase 2 (T007–T010, T012–T017, T023–T025)
- Within US1: T027/T028 ∥ T031/T032 (independent providers), T040/T041 (frontend) ∥ backend
- Within US3: T047, T050, T051 in parallel; frontend T054/T055 in parallel with API
- Polish phase: T066–T068 in parallel

---

## Parallel Example: Phase 2 Foundational

```
# Domain enums + entity (independent files):
T007 DataSourceType.cs
T008 SyncTriggerType.cs
T009 SyncStatus.cs
T010 VehicleSyncLog.cs

# Application provider DTOs + interfaces (independent files):
T012 ProviderQuoteRequest.cs
T013 ProviderQuoteResult.cs
T014 ProviderQuoteStatus.cs
T015 IInsurerQuoteProvider.cs
T016 IVehicleMasterSyncer.cs
T017 SyncOutcome.cs

# Resilience + cache scaffolding (independent files):
T023 PollyPolicyFactory.cs
T024 QuoteCacheService.cs
T025 ImportQuoteProvider.cs
```

---

## Implementation Strategy

### MVP First (US1 + US2 only)

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 (US1: live quotes) → smoke test multi-provider search
3. Phase 4 (US2: fast dropdown) → smoke test dropdown latency
4. **STOP and VALIDATE**: SC-001 (provider count visible), SC-002 (3 s p95), SC-003 (200 ms dropdown)
5. Ship MVP to UAT

### Incremental Delivery After MVP

1. Add US3 (admin manual sync) → ops can refresh on demand
2. Add US4 (scheduled sync) → fully unattended freshness
3. Add US5 (resilience + cache badges) → graceful degradation

### Parallel Team Strategy

- Dev A: US1 (MTI adapter + Viriyah adapter + search aggregation)
- Dev B: US2 (master syncers + dropdown wiring) — coordinates with A on adapter shape
- Dev C: US3 (admin sync UI + API) — picks up T048 SyncOrchestrator
- Once US1 lands, Dev A pivots to US5 (resilience uses A's adapters)
- US4 is small; whoever finishes first picks it up

---

## Task Summary

| Phase | Tasks | Story |
|---|---|---|
| 1 Setup | T001–T006 | — |
| 2 Foundational | T007–T026 | — |
| 3 US1 | T027–T041 | US1 (P1) |
| 4 US2 | T042–T046 | US2 (P1) |
| 5 US3 | T047–T056 | US3 (P2) |
| 6 US4 | T057–T059 | US4 (P2) |
| 7 US5 | T060–T065 | US5 (P2) |
| 8 Polish | T066–T072 | — |
| **Total** | **72 tasks** | |

**Suggested MVP scope**: T001–T046 (Phases 1–4) = US1 + US2 = 46 tasks.

**Format validation**: All 72 tasks follow `- [ ] Tnnn [P?] [USx?] Description with path` ✅.

**Independent test criteria** are documented at the head of each user-story phase.
