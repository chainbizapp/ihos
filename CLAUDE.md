# ihos Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-05-25

## Active Technologies

- C# 13 / .NET 10 (backend) · TypeScript / Angular 21 LTS (frontend)
- EF Core 10 + PostgreSQL 16 (port 5431, db `ihos_dev`)
- Polly v8 (resilience: timeout, circuit breaker, retry)
- `IDistributedCache` (in-memory; Redis-ready)
- `IHostedService` for scheduled vehicle-master sync
- Serilog + `System.Diagnostics.Metrics` for observability
- xUnit + WireMock.NET (backend tests); Vitest 4 + jsdom (frontend tests)

## Project Structure

```text
ihos/backend/src/
  Ihos.Domain/        # entities, enums (DataSourceType, SyncStatus)
  Ihos.Application/   # IInsurerQuoteProvider, IVehicleMasterSyncer, ProviderRegistry
  Ihos.Infrastructure/# Providers/Mti, Providers/Viriyah, Resilience, Caching, BackgroundServices
  Ihos.API/           # Controllers (incl. AdminSyncController)
  tests/
ihos/frontend/src/app/
  mapping/sync/       # admin sync UI
```

## Commands

```bash
# Backend
dotnet test
dotnet ef database update --project src/Ihos.Infrastructure --startup-project src/Ihos.API

# Frontend
npm test && npm run lint
```

## Code Style

- C# 13 / .NET 10: Clean Architecture boundaries — never call EF Core or HTTP from `Ihos.Application`.
- Provider adapters live ONLY in `Ihos.Infrastructure/Providers/{ProviderName}`; canonical DTOs only cross module boundaries.
- All deletes must be soft (Constitution Principle V).
- Provider-specific magic values (e.g., MTI `Fund: -1`) encapsulated inside the adapter with a comment explaining why.
- Angular 21: signals for state, RxJS for streams.

## Recent Changes

- 002-multi-provider-integration: Added Provider abstraction (MTI, Viriyah API + Allianz import), `IDistributedCache` SWR layer, scheduled `IHostedService` sync, `VehicleSyncLog` audit, Polly v8 resilience pipelines.
- master: Initial C# 13 / .NET 10 + Angular 21 LTS stack.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
