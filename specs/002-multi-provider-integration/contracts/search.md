# Contract: Multi-Provider Plan Search

**Module**: Search
**Auth**: Authenticated user (any role).
**Endpoint**: `POST /api/search/plans` *(modified — existing endpoint, new behavior)*

---

## Behavior Change (vs Feature 001)

Previously: Search read pre-imported `InsurancePlan` rows from DB for all providers.

Now: Search fans out to every active `InsuranceCompany`, resolving each via `ProviderRegistry` → `IInsurerQuoteProvider`:
- `DataSource = Import` providers → `ImportQuoteProvider` (DB read, same data as before).
- `DataSource = Api` providers → live API call wrapped in Polly pipeline (timeout 3 s, breaker, retry).

The response shape is **extended** (additive); existing clients continue to work.

---

## Request

```json
POST /api/search/plans
Content-Type: application/json

{
  "vehicleModelId": "f2f0…",
  "year": 2025,
  "coverageType": "Type1",
  "sumInsured": 500000,
  "deductible": 5000,
  "driverAgeBand": "30-39",
  "usageType": "Personal"
}
```

All fields required except `deductible` (defaults to 0) and `driverAgeBand` / `usageType` (provider-specific; ignored if a provider doesn't use them).

---

## Response — `200 OK`

```json
{
  "requestId": "8a91…",
  "elapsedMs": 2418,
  "results": [
    {
      "companyShortCode": "MTI",
      "companyDisplayName": "Muang Thai Insurance",
      "status": "Success",
      "isStale": false,
      "plans": [ /* InsurancePlanDto[] */ ],
      "errorCode": null,
      "errorMessage": null,
      "providerLatencyMs": 1820
    },
    {
      "companyShortCode": "VIRIYAH",
      "status": "Success",
      "isStale": true,
      "plans": [ /* … */ ],
      "errorCode": null,
      "errorMessage": null,
      "providerLatencyMs": 42
    },
    {
      "companyShortCode": "ALA",
      "status": "Success",
      "isStale": false,
      "plans": [ /* from import */ ],
      "providerLatencyMs": 8
    }
  ]
}
```

### Per-provider `status` values

| Value | Meaning | UI hint |
|---|---|---|
| `Success` | Plans returned; check `isStale` | Show plans; show "cached" badge if `isStale=true` |
| `NoMatch` | Provider responded but has no plan for this request | Show "no plans available from {provider}" |
| `Timeout` | Exceeded 3 s | Show "{provider} unavailable" |
| `BreakerOpen` | Circuit broken (provider already failing) | Show "{provider} unavailable" |
| `Failed` | Other error (HTTP non-2xx, deserialize error) | Show "{provider} unavailable" + `errorMessage` (sanitized) |

`errorMessage` is a short human-readable string. Detailed exception traces stay in server logs only.

---

## Caching Behavior (per Provider)

For each `(provider, request signature)`:

1. Look up in `IDistributedCache`.
2. If fresh (age < 15 min) → return cached, `isStale=false`. No provider call.
3. If stale (15 min ≤ age < 24 h) → return cached, `isStale=true`. **Fire-and-forget** background refresh.
4. If miss or expired → call provider; on success cache the result; on failure attempt step 3 fallback.

The cache key includes provider so failures don't poison other providers' entries.

---

## SLA

- p95 latency ≤ 3000 ms (aggregated) — Spec SC-002.
- Cache-hit path: p95 ≤ 200 ms.
- A slow provider does **not** delay other providers beyond its own 3 s timeout (parallel `Task.WhenAll`).

---

## Idempotency & Side Effects

- **Read-only.** No DB writes during search.
- Cache writes are an implementation detail; not visible to callers.
- Each request gets a `requestId` (also propagated to provider logs).
