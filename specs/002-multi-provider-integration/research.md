# Phase 0 Research: Multi-Provider Insurance Quote Integration

**Feature**: 002-multi-provider-integration
**Date**: 2026-05-25
**Status**: Complete — no open NEEDS CLARIFICATION items.

This document captures the design decisions made before producing data-model and contract artifacts. Each entry records the **Decision**, the **Rationale**, and the **Alternatives Considered**.

---

## 1. Provider Abstraction Shape

**Decision**: Define two narrow interfaces in `Ihos.Application/Providers/`:

- `IInsurerQuoteProvider` — `Task<ProviderQuoteResult> GetQuoteAsync(ProviderQuoteRequest, CancellationToken)`
- `IVehicleMasterSyncer` — `Task<SyncOutcome> SyncAsync(SyncTrigger, CancellationToken)`

Providers are registered in DI keyed by `InsuranceCompany.ShortCode` (e.g., `"MTI"`, `"VIRIYAH"`, `"ALA"`). A `ProviderRegistry` resolves the active set from the database (`InsuranceCompany.IsActive = true`).

**Rationale**:
- Two interfaces (not one) — quoting and master-data sync have different lifecycles (per-request vs daily/manual). Conflating them leaks concerns.
- Keyed DI registration scales to ≥ 30 providers (Constitution Principle IX) without modifying Application-layer code.
- The Allianz "import" path implements `IInsurerQuoteProvider` via `ImportQuoteProvider` that simply reads pre-imported `InsurancePlans` from the DB — uniform interface, zero special-casing in Search.

**Alternatives Considered**:
- Single `IInsurerProvider` interface with both methods — rejected: forces every provider to implement sync even when (a) Allianz has no sync API, and (b) future providers may quote without master-data exposure.
- Strategy pattern via `switch` on `ShortCode` in Search — rejected: violates Principle IX (adding a provider requires code changes in Search).

---

## 2. Resilience Library

**Decision**: **Polly v8** with `ResiliencePipeline<T>`. Per-provider pipeline composed of: `Timeout(3s)` → `CircuitBreaker(failureRatio=0.5, samplingDuration=30s, minThroughput=5, breakDuration=60s)` → `Retry(maxAttempts=1, delay=200ms, only on transient HTTP 5xx/timeout)`.

**Rationale**:
- Polly is the .NET standard for resilience, already on the team's radar; `ResiliencePipeline` is the v8 idiomatic API and integrates with `IHttpClientFactory` via `AddResilienceHandler`.
- Per-provider pipelines isolate failure domains — one provider's outage doesn't trip another's breaker.
- Tight retry budget (1 attempt, 200 ms) prevents amplifying load during partial outages while still smoothing over transient blips.

**Alternatives Considered**:
- Handwritten `try/catch` + `CancellationTokenSource(timeout)` — rejected: no circuit-breaker semantics, accumulates ad-hoc code.
- Microsoft.Extensions.Http.Resilience — considered; it wraps Polly v8 anyway. Adopted via `AddStandardResilienceHandler` with tuned options where feasible, falling back to direct Polly pipelines for the master-sync HTTP clients (which need different timeouts than the quote path).

---

## 3. Cache Strategy

**Decision**: Two-tier policy keyed by request signature `(providerShortCode, vehicleModelId, year, sumInsured, coverageType)`:

- **Quote cache**: fresh TTL = 15 minutes; stale TTL = 24 hours. On stale hit, return cached value immediately AND enqueue a background refresh (Stale-While-Revalidate). Stale responses are flagged `IsStale=true` so the UI can show a "cached" badge.
- **Vehicle master**: persisted in DB; cache is the DB itself (sync writes; reads always hit DB). No separate vehicle cache layer.

Backend: `IDistributedCache` interface. Concrete: `MemoryDistributedCache` initially (single-instance); the same code switches to Redis later by changing DI registration only.

**Rationale**:
- 15 min fresh TTL aligns with Spec FR-014 (cache-served path must be < 2 s) and matches the rate at which insurers typically refresh tariff data in dev environments.
- 24 h stale ceiling honors Spec edge case "extended outage" — beyond 24 h, cache entries expire and the user sees an explicit "unavailable" state.
- `IDistributedCache` abstraction means no code change when scaling out.

**Alternatives Considered**:
- Output caching on the entire `/api/search` response — rejected: request signatures vary too widely across users (different vehicles); cache hit rate would be near zero.
- Per-provider in-process `MemoryCache` — rejected: doesn't survive process recycles, doesn't share across instances.

---

## 4. Scheduled Sync Mechanism

**Decision**: Built-in `IHostedService` (`VehicleSyncBackgroundService`) with a simple wall-clock loop: at startup compute "next 02:00 local time," `Task.Delay` until then, run sync for each provider whose `DataSource = Api`, then loop.

**Rationale**:
- Single-instance backend at launch — no need for distributed coordination yet.
- Built-in primitives mean zero new dependencies and zero ops overhead.
- Manual triggers go through the same `SyncOrchestrator` so the code path is shared.

**Alternatives Considered**:
- Quartz.NET — rejected for v1: heavier than required, adds a dependency, schema requirements. Revisit if/when we add cron expressions, missed-fire policies, or multi-instance scheduling.
- Hangfire — rejected: persistence model overlaps with our own audit log; introduces a second job table.

**Forward path**: When we scale to multi-instance, swap `VehicleSyncBackgroundService` for a leader-elected scheduler (e.g., `DistributedLock` via PostgreSQL advisory lock) — the orchestrator interface stays the same.

---

## 5. HTTP Client Configuration

**Decision**: `IHttpClientFactory`-named clients per provider:

- `"mti"` — base address from `MtiOptions.BaseUrl`, default headers include `apikey` and `Authorization: Basic …`, no cookies, JSON serialization with `JsonSerializerOptions { PropertyNamingPolicy = null }` because MTI uses PascalCase.
- `"viriyah"` — base address from `ViriyahOptions.BaseUrl`, headers set per-request because token rotates, JSON with camelCase.
- `"viriyah-token"` — separate client with `passWord` as verbatim string (`@"..."` in code) to avoid escape-character corruption witnessed in REST Client tooling.

Each client wired through `AddResilienceHandler` for the quote-path pipeline.

**Rationale**:
- Named clients isolate per-provider HTTP concerns (base URL, default headers, JSON casing).
- Separating Viriyah's token endpoint into its own client prevents the auth header on the main client from interfering with the token request (which uses Basic on a different scheme).
- Verbatim string for the password is the single most fragile detail discovered during testing — codifying it here prevents regression.

**Alternatives Considered**:
- Typed `HttpClient` subclass per provider — possible later; for v1 the factory + options pattern is sufficient.

---

## 6. Token Lifecycle (Viriyah)

**Decision**: `ViriyahTokenCache` is a singleton that stores `(accessToken, expiresAtUtc)`. On every quote call, the adapter calls `GetTokenAsync()`:

- If `now < expiresAt - 60s` → return cached token.
- Else → acquire token via `viriyah-token` HTTP client, update cache, return.

Acquisition is gated by `SemaphoreSlim(1,1)` so concurrent quote requests during expiry don't trigger a token-refresh storm.

**Rationale**:
- 60-second safety margin matches Spec constraint and absorbs clock skew.
- Singleton lifetime is correct because the token is process-wide; multi-instance deployment will switch to `IDistributedCache` (same code shape, different backing store).

**Alternatives Considered**:
- Refresh on 401 only — rejected: causes a guaranteed-failed request before every refresh, hurts p95.
- Background refresh timer — rejected: extra moving part, races with idle-process shutdowns.

---

## 7. MTI `Fund: -1` Magic Value

**Decision**: Encapsulate as `private const int CoverageFundMagicValue = -1;` inside `MtiApiQuoteProvider`. Add a code comment with the date + source ("Confirmed by MTI-ITDEV via email, 2026-05") and the symptom it fixes ("empty Coverages array when Fund=0 is sent"). No exposure of the constant outside the adapter.

**Rationale**:
- Spec Provider-Specific Notes mandates encapsulation (Constitution Principle II — Standardization).
- Documenting the *why* in code prevents future cleanup from re-introducing the bug.

---

## 8. Vehicle Master Data Reconciliation

**Decision**: Upsert by `(CompanyId, ProviderVehicleCode)`:
- New row → insert + flag for mapping review (existing `VehicleModelMapping.IsAutoSuggested` flow).
- Existing row → update mutable fields (`DisplayName`, `EngineCc`, `Year`, `IsActive`), preserve audit columns.
- Missing-from-source rows → set `IsActive = false` (soft-deactivate, **not** delete — Principle V).

Sync writes a single `VehicleSyncLog` row per run with counts: inserted, updated, deactivated, errored.

**Rationale**:
- Upsert keeps mappings stable across syncs.
- Soft-deactivate honors Constitution Principle V (no hard deletes) and lets users still view historical quotes that reference deactivated vehicles.

**Alternatives Considered**:
- Full reload (delete-all + insert-all) — rejected: breaks foreign keys to historical quotes and violates soft-delete principle.

---

## 9. Search Aggregation Concurrency Model

**Decision**: `Task.WhenAll` over `ProviderRegistry.GetActiveAsync()`, each task wrapped in a `try/catch` that converts exceptions to a `ProviderQuoteResult { Status = Failed, Error = ... }`. The aggregator never throws; partial failure is a first-class result type.

For progressive UI: backend returns the full aggregated response in v1 (simpler). UI streaming is deferred — see Out of Scope below.

**Rationale**:
- `Task.WhenAll` + per-task exception isolation is the standard, well-understood pattern.
- Full-batch response keeps API contract simple; the 3 s p95 budget allows it.

**Alternatives Considered**:
- `IAsyncEnumerable<ProviderQuoteResult>` streaming via Server-Sent Events — defers to Phase 2. Spec accepts this trade-off (US3 acceptance criterion is "results appear as they arrive **OR** within 3 s total" — second clause covers v1).

---

## 10. Observability

**Decision**: Structured Serilog with these properties on every provider call:
- `ProviderShortCode`, `Operation` (`"Quote"` / `"VehicleSync"`), `RequestId`, `LatencyMs`, `Outcome` (`"Success"`, `"Timeout"`, `"BreakerOpen"`, `"HttpError"`, `"DeserializeError"`).

Per-provider counters via `System.Diagnostics.Metrics` (`ihos.providers.quote.count`, `.latency`, `.error`).

**Rationale**:
- Required to operate the system (Spec FR-022): without per-provider latency/error visibility, p95 SLA cannot be enforced.
- `Meter`-based metrics export to Prometheus/OpenTelemetry without code changes when monitoring stack is added.

---

## 11. Out of Scope for Phase 1 (Confirmed)

- **Chubb, AIOI providers** — adapters not implemented; rows will be added when credentials arrive.
- **SSE/WebSocket streaming** — full-batch response only.
- **Distributed cache (Redis)** — in-memory only; interface chosen for future swap.
- **Quote persistence (history)** — covered by separate feature (existing `Quotation` entity unchanged).
- **Policy issuance** — explicitly out per spec.

---

## Decisions Pending User Confirmation: NONE

All technical decisions have a chosen path with rationale. No `[NEEDS CLARIFICATION]` markers remain.
