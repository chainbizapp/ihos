# Contract: Admin Vehicle Master Sync

**Module**: Admin Sync
**Auth**: All endpoints require `[Authorize(Policy = "RequireSeniorStaff")]` minimum.
**Base path**: `/api/admin/sync`

---

## POST /api/admin/sync/vehicle-master/{companyId}

Trigger a manual vehicle-master sync for one provider.

### Request

- **Path**: `companyId` (Guid) — must reference an `InsuranceCompany` with `DataSource = Api` and `IsActive = true`.
- **Body**: none.

### Responses

| Status | Body | When |
|---|---|---|
| `202 Accepted` | `{ "syncLogId": "<guid>", "status": "Running", "startedAtUtc": "..." }` | Sync enqueued. The orchestrator runs it in the background. |
| `400 Bad Request` | `{ "error": "Company is not API-sourced" }` | `DataSource != Api` |
| `404 Not Found` | — | Company id does not exist |
| `409 Conflict` | `{ "error": "Sync already running", "syncLogId": "<guid>" }` | A `Running` log exists for this company |
| `403 Forbidden` | — | Caller lacks `RequireSeniorStaff` |

### Side effects

- Inserts a `VehicleSyncLog` row with `Status=Running`, `Trigger=Manual`, `TriggeredByUserId=<caller>`.
- The background task updates the same row on completion.

---

## GET /api/admin/sync/status

List the latest sync per provider, plus any in-progress runs.

### Request

- **Query**: `companyId` (Guid, optional) — filter to one provider.

### Response — `200 OK`

```json
{
  "items": [
    {
      "companyId": "…",
      "companyShortCode": "MTI",
      "companyDisplayName": "Muang Thai Insurance",
      "dataSource": "Api",
      "latestSync": {
        "syncLogId": "…",
        "trigger": "Scheduled",
        "triggeredByUserId": null,
        "startedAtUtc": "2026-05-25T02:00:00Z",
        "completedAtUtc": "2026-05-25T02:03:42Z",
        "status": "Succeeded",
        "insertedCount": 12,
        "updatedCount": 8,
        "deactivatedCount": 0,
        "errorCount": 0,
        "durationMs": 222000
      },
      "currentRun": null
    }
  ]
}
```

`currentRun` is non-null while a sync is in progress (mirrors `latestSync` shape, but `completedAtUtc=null`, `status="Running"`).

---

## GET /api/admin/sync/history

Paginated history of sync runs.

### Request

- **Query**: `companyId` (Guid, optional), `page` (default 1), `pageSize` (default 20, max 100).

### Response — `200 OK`

```json
{
  "page": 1,
  "pageSize": 20,
  "totalCount": 142,
  "items": [ /* VehicleSyncLog DTOs, newest first */ ]
}
```

---

## Audit

Every successful `POST /vehicle-master/{companyId}` writes:
- `VehicleSyncLog` row with `TriggeredByUserId`.
- Serilog audit event `"AdminSyncTriggered"` with `{ userId, companyId, syncLogId }`.

Per Constitution Principle IV (Traceability), these records are immutable after completion.
