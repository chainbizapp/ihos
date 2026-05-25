# Quickstart: Multi-Provider Insurance Quote Integration

**Feature**: 002-multi-provider-integration
**Audience**: Developer setting up the feature locally for the first time.

## Prerequisites

- .NET 10 SDK installed
- Node 22+ / npm
- Docker (for PostgreSQL on port 5431) — already running per existing project setup
- Access to MTI sandbox credentials and Viriyah UAT credentials (see `ihos/restclient/*.http`)

## 1. Pull the feature branch

```bash
git fetch origin
git checkout 002-multi-provider-integration
```

## 2. Configure provider credentials

Copy the sample secrets to your local user-secrets store (DO NOT commit):

```bash
cd ihos/backend/src/Ihos.API

dotnet user-secrets set "Providers:Mti:BaseUrl"        "https://uat-api.muangthaiinsurance.com"
dotnet user-secrets set "Providers:Mti:ApiKey"         "GsQFRna07c0oQz9Y0nUbFCLVtwGkO9xM"
dotnet user-secrets set "Providers:Mti:BasicAuth"      "SVNIQFRFU1Q6VEVTVA=="

dotnet user-secrets set "Providers:Viriyah:BaseUrl"      "https://uat-api.viriyah.co.th"
dotnet user-secrets set "Providers:Viriyah:ClientId"     "5a37a3ff-2491-477b-9335-e6378be6fc96"
dotnet user-secrets set "Providers:Viriyah:ClientSecret" "CiZyJ5hDheb9hFBFLBt0jjjqIBOOIBZ4"
dotnet user-secrets set "Providers:Viriyah:UserName"     "19443_uat"
# Note: the password contains a backslash. Pass it as-is; PowerShell users wrap in single quotes.
dotnet user-secrets set "Providers:Viriyah:Password"     'woF_4j^8Rz5?1+4\YQK}'
dotnet user-secrets set "Providers:Viriyah:AgentCode"    "19443"
```

## 3. Apply database migration

```bash
cd ihos/backend
dotnet ef database update --project src/Ihos.Infrastructure --startup-project src/Ihos.API
```

Verify:
- `InsuranceCompanies` has a `DataSource` column (0 = Import, 1 = Api).
- `VehicleSyncLogs` table exists.
- `MTI` row exists with `DataSource = 1`; `VIRIYAH` row updated to `DataSource = 1`; `ALA` stays at `0`.

```sql
SELECT "ShortCode", "DataSource", "IsActive" FROM "InsuranceCompanies";
```

## 4. Run the backend

```bash
cd ihos/backend/src/Ihos.API
dotnet run
```

The scheduled sync (`VehicleSyncBackgroundService`) runs daily at 02:00 local time. It will skip on first startup if the configured time has already passed today.

## 5. Trigger a manual sync (smoke test)

```bash
# Get a senior-staff JWT from /api/auth/login first.
TOKEN="<jwt>"
MTI_ID="<companyId from step 3>"

curl -X POST http://localhost:5000/api/admin/sync/vehicle-master/$MTI_ID \
  -H "Authorization: Bearer $TOKEN"
```

Expect `202 Accepted` with a `syncLogId`. Poll:

```bash
curl http://localhost:5000/api/admin/sync/status?companyId=$MTI_ID \
  -H "Authorization: Bearer $TOKEN"
```

Should reach `Status: "Succeeded"` within ~5 minutes.

## 6. Test multi-provider search

```bash
curl -X POST http://localhost:5000/api/search/plans \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleModelId": "<a vehicle present in all 3 providers>",
    "year": 2025,
    "coverageType": "Type1",
    "sumInsured": 500000
  }'
```

Expect a `results[]` array with 3 entries (MTI, VIRIYAH, ALA). MTI and VIRIYAH come from live API; ALA from imported data.

## 7. Run the frontend

```bash
cd ihos/frontend
npm install
npm run start
```

Navigate to `/mapping/sync` (route added by this feature). You should see:
- One row per API-sourced provider (MTI, VIRIYAH).
- Last sync timestamp + status badge.
- A "Sync Now" button (visible only to Senior Staff+).

## 8. Run tests

```bash
cd ihos/backend
dotnet test
```

Key test projects:
- `Ihos.Infrastructure.Tests` — provider adapter tests with mocked HTTP.
- `Ihos.API.IntegrationTests` — `AdminSyncControllerTests`, end-to-end search aggregation.

## Common Issues

| Symptom | Likely cause | Fix |
|---|---|---|
| `401` from Viriyah token endpoint | Password backslash got escaped | Re-set user-secret with single-quoted value |
| MTI `GetCoverage` returns empty `Coverages` | Sent `Fund: 0` | Adapter must send `Fund: -1` (magic value, encapsulated) |
| Search shows all providers as `Timeout` | Backend can't reach UAT hosts | Check VPN / firewall |
| `Sync already running` 409 | Previous run hung | Inspect `VehicleSyncLogs` row; update `Status=Failed` manually if truly stuck |
