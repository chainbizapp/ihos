# API Contract: Motor Insurance Search and Quotation System

**Version**: 1.0.0 | **Date**: 2026-04-12 | **Base URL**: `/api`

All protected endpoints require `Authorization: Bearer <access_token>`.
Role annotations show minimum required role: **A** = Admin, **M** = Manager, **SS** = Senior Staff, **S** = Staff (any authenticated user).

---

## Authentication

### POST `/auth/login`
> Public. No auth required.

**Request**
```json
{
  "email": "user@example.com",
  "password": "plaintext"
}
```

**Response 200**
```json
{
  "accessToken": "eyJ...",
  "expiresIn": 3600,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "Chain S.",
    "role": "Manager"
  }
}
```

**Response 401** — Invalid credentials.
**Response 403** — Account inactive or pending.

---

### POST `/auth/refresh`
> Public. Requires valid `refreshToken` in `HttpOnly` cookie.

**Response 200** — New `accessToken` + rotated `refreshToken` cookie.
**Response 401** — Refresh token expired or revoked.

---

### POST `/auth/logout`
> **S** (any authenticated user). Revokes current refresh token.

**Response 204**

---

### POST `/auth/invite/accept`
> Public. Completes invite flow.

**Request**
```json
{
  "token": "plain-uuid-invite-token",
  "password": "newpassword",
  "confirmPassword": "newpassword"
}
```

**Response 200** — Returns `accessToken` + `refreshToken` cookie (auto-login).
**Response 400** — Token invalid, expired, or passwords don't match.

---

## Users

### GET `/users`
> **A, M** — List all users.

**Query params**: `status`, `role`, `page`, `pageSize`

**Response 200**
```json
{
  "items": [
    { "id": "uuid", "email": "", "fullName": "", "role": "", "status": "", "createdAt": "" }
  ],
  "totalCount": 42,
  "page": 1,
  "pageSize": 20
}
```

---

### POST `/users/invite`
> **A, M** — Create user account and send invite link.

**Request**
```json
{
  "email": "newuser@example.com",
  "fullName": "New User",
  "role": "Staff"
}
```

**Response 201**
```json
{ "id": "uuid", "email": "", "status": "PendingInvite" }
```

**Response 409** — Email already registered.

---

### PUT `/users/{id}/role`
> **A** — Change role.

**Request** `{ "role": "Manager" }`
**Response 200** — Updated user object.
**Response 403** — Requester is not Admin.

---

### PUT `/users/{id}/status`
> **A** — Activate or deactivate account.

**Request** `{ "status": "Inactive" }`
**Response 200**

---

### GET `/users/registrations/pending`
> **A, M** — List self-registration requests awaiting approval.

**Response 200** — Array of pending user objects.

---

### PUT `/users/registrations/{id}/approve`
> **A, M**

**Response 200** — User status set to `Active`; audit logged.

---

### PUT `/users/registrations/{id}/reject`
> **A, M**

**Request** `{ "reason": "optional text" }`
**Response 200** — Request marked rejected; audit logged.

---

## Import

### POST `/imports/upload`
> **A, M, SS** — Upload Excel, CSV, or PDF file.

**Request**: `multipart/form-data`
- `file`: the upload
- `companyId`: UUID

**Response 202**
```json
{ "batchId": "uuid", "status": "Processing" }
```

**Response 400**
```json
{
  "error": "ParseFailed",
  "message": "File could not be parsed",
  "details": [
    { "row": 5, "column": "PremiumTotal", "reason": "Non-numeric value 'N/A'" }
  ]
}
```

---

### GET `/imports/batches`
> **A, M, SS** — List import batches.

**Query params**: `companyId`, `status`, `from`, `to`, `page`, `pageSize`

**Response 200** — Paginated list of batch summaries.

---

### GET `/imports/batches/{id}`
> **A, M, SS** — Batch detail.

**Response 200**
```json
{
  "id": "uuid",
  "companyId": "uuid",
  "companyName": "AXA",
  "sourceFileName": "axa_rates_q1.xlsx",
  "uploadedBy": "Chain S.",
  "uploadedAt": "2026-04-12T09:00:00Z",
  "status": "PendingReview",
  "totalRows": 250,
  "resolvedRows": 240,
  "pendingRows": 10,
  "approvedRows": 0,
  "rejectedRows": 0
}
```

---

### GET `/imports/batches/{id}/records`
> **A, M, SS**

**Query params**: `mappingStatus`, `reviewStatus`, `page`, `pageSize`

**Response 200** — Paginated import records with raw and resolved values.

---

### PUT `/imports/records/{id}/approve`
> **A, M**

**Response 200** — Record `review_status` → `Approved`; audit logged.
**Response 409** — Record has unresolved mapping (`mappingStatus = PendingMapping`).

---

### PUT `/imports/records/{id}/reject`
> **A, M**

**Request** `{ "reason": "optional" }`
**Response 200**

---

### POST `/imports/batches/{id}/publish`
> **A, M** — Publish entire batch; all records must be Approved or Rejected.

**Response 200** — Batch published; plans become searchable.
**Response 409**
```json
{
  "error": "PendingRecordsExist",
  "pendingCount": 3
}
```

---

## Mapping

### GET `/mappings/vehicle-models`
> **A, M, SS**

**Query params**: `companyId`, `resolved`, `page`, `pageSize`

**Response 200** — Paginated list of vehicle model mappings.

---

### POST `/mappings/vehicle-models`
> **A, M, SS** — Create new mapping entry.

**Request**
```json
{
  "companyId": "uuid",
  "rawName": "YARIS ATIV 1.2 J",
  "canonicalModelId": "uuid"
}
```

**Response 201**
**Response 409** — Duplicate `(companyId, rawName)`.

---

### PUT `/mappings/vehicle-models/{id}`
> **A, M, SS** — Update canonical target; audit logged.

**Request** `{ "canonicalModelId": "uuid" }`
**Response 200**

---

### GET `/mappings/plan-types`
> **A, M, SS**

**Response 200** — List of plan type mappings.

---

### POST `/mappings/plan-types`
> **A, M, SS**

**Request**
```json
{
  "companyId": "uuid",
  "rawName": "ชั้น 1",
  "canonicalPlanType": "Type1"
}
```

**Response 201**

---

### PUT `/mappings/plan-types/{id}`
> **A, M, SS**

**Request** `{ "canonicalPlanType": "Type1" }`
**Response 200**

---

## Search

### GET `/plans/search`
> **A, M, SS, S** — Search published insurance plans.

**Query params**

| Param | Type | Required | Description |
|---|---|---|---|
| `vehicleModelId` | UUID | Yes | Canonical model ID |
| `productionYear` | INT | Yes | Vehicle production year |
| `planType` | String | Yes | `Type1` / `Type2` / `Type3` / `Type2Plus` / `Type3Plus` |
| `repairType` | String | Yes | `Garage` / `Dealer` |
| `companyId` | UUID | No | Filter by company |
| `excessMin` | Decimal | No | |
| `excessMax` | Decimal | No | |
| `sort` | String | No | `price_asc` (default) / `sum_insured_desc` |
| `page` | INT | No | Default 1 |
| `pageSize` | INT | No | Default 20, max 50 |

**Response 200**
```json
{
  "items": [
    {
      "id": "uuid",
      "companyName": "AXA",
      "planType": "Type1",
      "repairType": "Garage",
      "vehicleModel": "Corolla",
      "vehicleMake": "Toyota",
      "minYear": 1,
      "maxYear": 10,
      "sumInsured": 800000.00,
      "premiumTotal": 18500.00,
      "excessAmount": 2000.00,
      "coverageDetails": {},
      "remarks": null
    }
  ],
  "totalCount": 5,
  "page": 1,
  "pageSize": 20
}
```

**Response 200 (no results)**
```json
{ "items": [], "totalCount": 0, "page": 1, "pageSize": 20 }
```

---

### GET `/plans/{id}`
> **A, M, SS, S** — Single plan detail.

**Response 200** — Full plan object.
**Response 404**

---

## Quotation

### POST `/quotations`
> **A, M, SS, S** — Generate quotation and PDF.

**Request**
```json
{
  "planIds": ["uuid"],
  "customerName": "Somchai Jaidee",
  "vehicleRegistration": "กข 1234",
  "vehicleMake": "Toyota",
  "vehicleModelName": "Corolla Cross",
  "vehicleYear": 2020
}
```

**Response 201**
```json
{
  "id": "uuid",
  "pdfUrl": "/api/quotations/uuid/pdf",
  "generatedAt": "2026-04-12T10:00:00Z"
}
```

---

### GET `/quotations/{id}/pdf`
> **A, M, SS, S** — Download PDF quotation.

**Response 200** — `Content-Type: application/pdf`

---

### GET `/quotations`
> **A, M** — List all quotations (for history/reporting).

**Query params**: `createdBy`, `from`, `to`, `page`, `pageSize`
**Response 200** — Paginated list.

---

## Reporting

### GET `/reports/usage-statistics`
> **A, M**

**Query params**: `from` (date), `to` (date), `granularity` (`daily` / `weekly` / `monthly`)

**Response 200**
```json
{
  "periods": [
    { "period": "2026-04-01", "quotationCount": 12, "searchCount": 45 }
  ]
}
```

---

### GET `/reports/top-vehicle-models`
> **A, M**

**Query params**: `from`, `to`, `limit` (default 20)

**Response 200**
```json
{
  "items": [
    { "make": "Toyota", "model": "Corolla", "searchCount": 120, "quotationCount": 34 }
  ]
}
```

---

### GET `/reports/import-errors`
> **A, M**

**Query params**: `from`, `to`, `companyId`

**Response 200**
```json
{
  "items": [
    {
      "batchId": "uuid",
      "companyName": "AXA",
      "uploadedAt": "2026-04-01T09:00:00Z",
      "totalRows": 250,
      "resolvedRows": 230,
      "pendingRows": 10,
      "rejectedRows": 10
    }
  ]
}
```

---

### GET `/reports/{type}/export`
> **A, M** — Export report as PDF or Excel.

**Path param**: `type` = `usage-statistics` / `top-vehicle-models` / `import-errors`
**Query params**: same filters as GET + `format` = `pdf` / `xlsx`

**Response 200** — File download stream.
**Response 202** — If generation is async; poll `/reports/exports/{jobId}`.

---

## Standard Error Schema

All error responses follow:

```json
{
  "error": "ErrorCode",
  "message": "Human-readable description",
  "details": [ ... ]
}
```

| HTTP | Meaning |
|---|---|
| 400 | Validation failure or bad request |
| 401 | Missing or expired JWT |
| 403 | Authenticated but insufficient role |
| 404 | Resource not found |
| 409 | Business rule conflict (duplicate, pending records, etc.) |
| 500 | Unexpected server error |
