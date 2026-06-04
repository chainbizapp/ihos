# Backend Gaps — Search (SCR-03) punch-list

Fields the **frontend builds (Visual-first / Figma)** but the current backend does **not** support
on the live search path (`/plans/search-aggregated`, used by the results page).

Frontend handles each as **client-side state / client-side filter on the aggregated results** so nothing
is a dead control. Each gap is tagged in code with:

```
// TODO(backend): <field> not supported on /search aggregated
```

| # | Field (Figma SCR-03) | Current backend | Frontend interim behaviour | What backend needs |
|---|----------------------|-----------------|----------------------------|--------------------|
| 1 | ประเภทเชื้อเพลิง (fuelType) | none (not in controller or domain) | mock dropdown, client state only | add `fuelType` to vehicle/plan + search param |
| 2 | ตัวถัง / จำนวนประตู (bodyType/doors) | none | mock dropdown, client state only | add `bodyType` to vehicle/plan + search param |
| 3 | เลือกบริษัทประกัน (multi-select) | aggregated always fans out to ALL providers (no `companyId`) | multi-chip → **client-side filter** on result rows by `companyShortCode` | accept `companyShortCodes[]` to scope the fan-out |
| 4 | ค่าเสียหายส่วนแรก / Deductible (multi) | aggregated accepts a **single** `deductible` decimal | multi-checkbox → **client-side filter** on `excessAmount` | accept `deductibles[]` (or excess range) |
| 5 | ขนาดเครื่องยนต์ CC (filter) | `/plans/search` accepts `engineCC`, but **aggregated does not** | prefilled from selected `variant.engineCC`, editable; not sent on aggregated path | add `engineCC` to aggregated, or route CC searches to `/plans/search` |
| 6 | พื้นที่ใช้งาน → `regionGroup` vocabulary | aggregated accepts `regionGroup` string, but vocabulary unconfirmed | sends ThaiRegion enum name (`Central`/`North`/…); `รวมทุกพื้นที่` sends nothing | confirm expected `regionGroup` codes (ThaiRegion names vs pricing-tier `BKK`/`NE`/`UPC`) |

## Wired for real (no gap)
- `planType`, `repairType` — forwarded to aggregated already.
- `regionGroup` — plumbed through the service (value vocabulary pending, see #6).
- อายุรถ (vehicle age) — display-only, computed client-side per FR-SCH-009. No backend needed.

_Last updated by the SCR-03 step-3 build._
