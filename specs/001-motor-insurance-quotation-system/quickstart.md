# Quickstart: Motor Insurance Search and Quotation System

**Date**: 2026-04-12

Developer onboarding guide — from clone to running system in under 15 minutes.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| .NET SDK | 10.x | https://dotnet.microsoft.com/download |
| Node.js | 22 LTS | https://nodejs.org |
| Angular CLI | 19.x | `npm install -g @angular/cli` |
| Docker Desktop | latest | https://www.docker.com/products/docker-desktop |
| PostgreSQL client | any | optional, for direct DB inspection |

---

## 1. Clone and Configure

```bash
git clone <repo-url>
cd ihos
```

Copy environment templates:

```bash
cp backend/src/Ihos.API/appsettings.Development.json.example \
   backend/src/Ihos.API/appsettings.Development.json
```

Edit `appsettings.Development.json` — minimum required values:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5431;Database=ihos_dev;Username=ihos;Password=ihos_dev_password"
  },
  "Jwt": {
    "SecretKey": "CHANGE_ME_TO_A_32_CHAR_OR_LONGER_SECRET",
    "AccessTokenExpiryMinutes": 60,
    "RefreshTokenExpiryDays": 7
  },
  "JasperReports": {
    "BaseUrl": "http://localhost:7030/"
  },
  "Smtp": {
    "Host": "localhost",
    "Port": 1025,
    "From": "noreply@ihos.local"
  }
}
```

---

## 2. Start Infrastructure

```bash
docker compose -f docker/docker-compose.yml up -d
```

This starts:
- **PostgreSQL 16** on port `5432`
- **JasperReports Spring Boot API** on port `7030` (custom wrapper using JasperReports library; `POST /report` with `{srcFile, param1, param2, param3, outputType, forceDownload}`)
- **MailHog** (SMTP catch-all) on port `1025`; web UI at `http://localhost:8025`

Check services are ready:

```bash
docker compose -f docker/docker-compose.yml ps
```

---

## 3. Run Database Migrations

```bash
cd backend
dotnet ef database update --project src/Ihos.Infrastructure --startup-project src/Ihos.API
```

This applies all EF Core migrations and seeds the bootstrap Admin account.

**Bootstrap credentials** (development only):

| Email | Password | Role |
|---|---|---|
| `admin@ihos.local` | `Admin@1234!` | Admin |

> Change this password immediately after first login.

---

## 4. Start the Backend

```bash
cd backend
dotnet run --project src/Ihos.API
```

API is available at `https://localhost:7001` (HTTPS) or `http://localhost:5001` (HTTP).

Swagger UI: `https://localhost:7001/swagger`

---

## 5. Start the Frontend

```bash
cd frontend
npm install
ng serve
```

App is available at `http://localhost:4200`.

The Angular dev server proxies `/api` to `https://localhost:7001`.

---

## 6. Verify End-to-End

1. Open `http://localhost:4200`
2. Log in with `admin@ihos.local` / `Admin@1234!`
3. Confirm the navigation sidebar shows all role-appropriate menu items
4. Navigate to **Admin → Users** — confirm the Admin account is listed
5. Navigate to **Import** → upload `docker/postgres/seed.sql` companion Excel, or any `.xlsx` with columns `vehicle_model, plan_type, repair_type, min_year, max_year, sum_insured, premium_total, excess_amount`
6. Navigate to **Mapping** — resolve any `PendingMapping` records
7. Back in **Import** → batch detail → approve all records → click **Publish**
8. Navigate to **Search** → select a vehicle model + production year + plan type → click Search → results appear
9. Select 2–3 plans → click **Compare** → side-by-side table with diffs highlighted
10. Click **Generate Quotation** on one plan → fill customer name → click Generate → PDF downloads
11. Navigate to **Reports → Usage Statistics** → load last 30 days → chart renders
12. Navigate to **Reports → Top Vehicle Models** → ranked list renders
13. Navigate to **Admin → Audit Log** → events for login / batch upload are visible

**Seed sample data** (optional, for faster first run):

```bash
psql -U ihos -d ihos_dev -f docker/postgres/seed.sql
```

> Note: Seed users have placeholder Argon2id hashes — use the bootstrap account created by EF migrations for login, or register via Admin → Registrations.

---

## Running Tests

### Backend unit tests

```bash
cd backend
dotnet test tests/Ihos.Domain.Tests
dotnet test tests/Ihos.Application.Tests
```

### Backend integration tests (requires Docker)

```bash
dotnet test tests/Ihos.API.IntegrationTests
```

Testcontainers spins up a dedicated PostgreSQL instance per test run; no manual DB setup needed.

### Frontend tests

```bash
cd frontend
ng test            # unit (Jasmine/Karma)
ng e2e             # E2E (Playwright)
```

### Performance test (k6)

```bash
k6 run tests/performance/search_load.js
# Assert: p95 < 2000ms at 50 VUs
```

---

## Project Structure Reference

```
ihos/
├── backend/
│   ├── src/
│   │   ├── Ihos.Domain/          # Entities, enums, domain events
│   │   ├── Ihos.Application/     # Use cases, handlers, DTOs, validators
│   │   ├── Ihos.Infrastructure/  # EF Core, JWT, JasperReports, email
│   │   └── Ihos.API/             # Controllers, middleware, startup
│   └── tests/
│       ├── Ihos.Domain.Tests/
│       ├── Ihos.Application.Tests/
│       ├── Ihos.Infrastructure.Tests/
│       └── Ihos.API.IntegrationTests/
├── frontend/
│   └── src/app/
│       ├── auth/                 # Login, invite accept
│       ├── admin/                # User management, audit log
│       ├── import/               # Upload, batch review
│       ├── mapping/              # Vehicle and plan mappings
│       ├── search/               # Search + compare
│       ├── quotation/            # Generate PDF
│       ├── reporting/            # Reports dashboard
│       ├── core/                 # AuthService, guards, interceptors
│       └── shared/               # Design system components
├── reports/
│   └── templates/                # JasperReports .jrxml files
├── docker/
│   └── docker-compose.yml
├── samples/
│   └── excel/                    # Sample insurance rate files for testing
└── specs/
    └── 001-motor-insurance-quotation-system/
```

---

## Common Tasks

### Add a new database migration

```bash
cd backend
dotnet ef migrations add <MigrationName> \
  --project src/Ihos.Infrastructure \
  --startup-project src/Ihos.API
```

Always include a rollback migration (EF Core supports `Down()` methods — implement them).

### Add a new API endpoint

1. Define command/query in `Ihos.Application/{Module}/`
2. Add handler implementing `IRequestHandler<TCommand, TResult>`
3. Add FluentValidation validator for the command/query
4. Add controller action in `Ihos.API/Controllers/`
5. Declare minimum role with `[Authorize(Roles = "Manager,Admin")]`
6. Write integration test in `Ihos.API.IntegrationTests`

### Deploy JasperReports templates

The JasperReports Spring Boot API (`localhost:7030`) reads `.jrxml` files from a configured directory.
Place templates in `reports/templates/` and ensure the Spring Boot service mounts that path.
The `srcFile` parameter sent by the backend maps to the template filename (without `.jrxml`).

To verify the JasperReports service:

```bash
curl -s -X POST http://localhost:7030/report \
  -H 'Content-Type: application/json' \
  -d '{"srcFile":"quotation","param1":"<quotation-uuid>","outputType":"PDF","forceDownload":true}' \
  -o test_quotation.pdf
```
