# Feature Specification: Multi-Provider Insurance Quote Integration

**Feature Branch**: `002-multi-provider-integration`
**Created**: 2026-05-25
**Status**: Draft
**Input**: User description: "Multi-provider insurance quote integration with vehicle master data sync. Currently the system only displays insurance plans from Allianz (imported from Excel files). We need to add real-time API integration with two insurers — MTI (Muang Thai Insurance) and Viriyah Insurance — while keeping Allianz on the existing import flow. Each insurer is treated as a Provider with its own adapter. Vehicle master data must be synchronized into our local database. Sync runs automatically once per day and can be triggered manually by admin users. Calls to providers run in parallel with a 3-second timeout each. When a provider fails repeatedly, the system temporarily suspends calls and serves cached data with a badge. One provider's failure must not block others."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Customer compares quotes across multiple insurers (Priority: P1)

A sales agent or end-user searches for vehicle insurance on the platform. Today the comparison page only shows results from one insurer (Allianz) sourced from imported data. After this feature ships, the comparison page shows plans from all active insurers — including those whose data comes from a live API call — in the same comparison view, with prices reflecting the insurer's current pricing at the moment of search.

**Why this priority**: This is the core business value driving the feature. Without multi-provider results, users cannot perform their primary task of comparing options across the market.

**Independent Test**: A user searches for a specific vehicle (e.g., Toyota Camry 2020). The result list contains plans from at least two distinct insurers, including the newly integrated ones, with each row clearly attributing the source insurer. Removing any single provider (toggling it off) leaves the rest functional.

**Acceptance Scenarios**:

1. **Given** all providers are healthy, **When** a user searches for a known vehicle, **Then** the result list aggregates plans from every active provider and clearly identifies each plan's insurer.
2. **Given** the user searches for a vehicle covered by only some insurers, **When** results are returned, **Then** plans from non-covering insurers are simply absent (no error shown to the user).
3. **Given** a user repeats the same search within a short interval, **When** results are returned the second time, **Then** the response is noticeably faster than the first time (served from cache).

---

### User Story 2 — Search dropdowns load instantly without depending on external APIs (Priority: P1)

When a user is selecting their vehicle from cascading dropdowns (brand → model → year → sub-model), each click must respond in well under a second. Calling external insurer APIs on every dropdown click would make the experience sluggish and fragile.

**Why this priority**: Same priority as Story 1 because the search funnel must feel fast end-to-end. A slow funnel breaks the comparison value of Story 1.

**Independent Test**: A user opens the search page, expands each cascading dropdown one at a time, and observes that values populate quickly with no perceptible lag from network round-trips to external systems.

**Acceptance Scenarios**:

1. **Given** the vehicle master database has been populated, **When** a user clicks the brand dropdown, **Then** the list of brands appears within 200 ms from a local data source.
2. **Given** an upstream provider's API is unreachable, **When** a user browses dropdowns, **Then** the dropdowns still populate normally because they read from local data, not the provider.

---

### User Story 3 — Vehicle master data refreshes automatically each day (Priority: P2)

To keep dropdowns and mappings current, the system synchronizes vehicle master data (brands, models, years, sub-models) from each API-based provider once per day, automatically, without manual intervention. The schedule is configurable by an administrator.

**Why this priority**: Important for long-term data hygiene but not blocking initial launch — an admin can also trigger sync manually (Story 4) if scheduled sync isn't ready.

**Independent Test**: After waiting until the scheduled time (or running the schedule with a shortened interval for testing), check the sync log: a new entry exists with status "Success", and database counts for the relevant provider have increased (or remained accurate if no upstream changes).

**Acceptance Scenarios**:

1. **Given** the scheduled sync time arrives, **When** the daily job triggers, **Then** every provider configured for API sync attempts a fresh data pull and records the outcome in the sync log.
2. **Given** a previous sync failed, **When** the next scheduled sync runs, **Then** the system retries without operator intervention and the failure does not prevent other providers from syncing.

---

### User Story 4 — Admin triggers a manual data refresh from the web UI (Priority: P2)

A senior staff member or administrator needs to force an immediate refresh of vehicle master data for a specific provider (e.g., after an insurer notifies us of new product lines mid-day). A dedicated admin page lists each API-based provider, shows the last sync time and outcome, and offers an "Update Now" button per provider.

**Why this priority**: Operationally important but not blocking Story 1. Admin could fall back to re-running the scheduled job manually if this UI is unavailable.

**Independent Test**: A user with Senior Staff role or above signs in, navigates to the sync admin page, clicks "Update Now" for a provider, and observes a status indicator that progresses from "Running" to "Success" within the expected duration. The sync log shows a new entry with the manual trigger noted.

**Acceptance Scenarios**:

1. **Given** an authorized admin is on the sync page, **When** they click Update Now for MTI, **Then** the page shows live progress and the result is recorded as a manual sync in the log.
2. **Given** a sync is already in progress for a provider, **When** the admin clicks Update Now again on the same provider, **Then** the system rejects the duplicate request with a clear message.
3. **Given** a non-admin (regular Staff) user navigates to the sync page, **When** they attempt to load it, **Then** they receive a permission-denied response.

---

### User Story 5 — System remains operational when one provider is unhealthy (Priority: P2)

When a provider's API is slow, returning errors, or completely down, the system isolates the failure: the user still sees results from healthy providers, and the unhealthy provider's row either disappears, shows the most recent cached pricing labelled as cached, or is omitted gracefully. Persistent failure triggers a temporary suspension so the failing provider is not retried on every search.

**Why this priority**: Critical for production reliability but the system can technically operate without it (failures would simply slow down searches). Marked P2 because the user-visible benefit is "no degraded experience" rather than a new capability.

**Independent Test**: With one provider's endpoint blocked (firewall or fake unavailable URL), perform searches: results from healthy providers return in normal time; the unhealthy provider's row either shows cached pricing with a visible badge or is omitted. After enough failures, subsequent searches skip that provider entirely until a recovery probe succeeds.

**Acceptance Scenarios**:

1. **Given** one provider's API consistently returns errors or timeouts, **When** a user searches, **Then** the user sees results from healthy providers within the normal response time, and the unhealthy provider is either omitted or shown with a cached-data badge.
2. **Given** a provider has been suspended by the resilience mechanism, **When** the suspension period expires, **Then** the next search attempts the provider once; on success it is reinstated for all subsequent requests, on continued failure it is suspended again.
3. **Given** results are returning at staggered times, **When** a fast provider responds first, **Then** that provider's results appear immediately while slower providers continue loading (progressive rendering).

---

### Edge Cases

- **Search for a vehicle that no provider covers**: User sees an empty result set with a clear "no plans found" message, not an error.
- **All providers fail simultaneously**: User sees an explanatory message and the option to retry; cached data is shown where available with stale badges.
- **A scheduled sync starts while a manual sync for the same provider is running**: The scheduled sync is skipped for that provider; the next day's schedule continues normally.
- **Provider returns malformed data or unexpected fields**: The sync logs a partial-success state with an error count; valid records are persisted, invalid records are reported.
- **A provider is removed from the active list while data exists in the database**: The provider's historical data remains queryable for already-issued quotations but does not appear in new search results.
- **Daily sync time crosses a daylight-saving boundary**: The sync runs once per civil day at the configured local time (no double-run on the "extra" hour, no skip on the "lost" hour).
- **Network blip during a manual sync**: The user sees a clear failure message; the system rolls back to the previous successful state and logs the partial progress for diagnosis.

## Requirements *(mandatory)*

### Functional Requirements

**Provider abstraction & integration**

- **FR-001**: The system MUST treat each insurer as a Provider — a logical unit with a unique identifier, a human-readable name, and a data-source designation (either live API or imported data).
- **FR-002**: The system MUST allow a Provider's data source to be changed (e.g., from imported data to live API) without changing the search experience for end-users.
- **FR-003**: The system MUST aggregate search results from every active Provider into a single comparison view, attributing each plan to its source Provider.
- **FR-004**: Adding a new Provider in the future MUST NOT require modifying the core search or quotation logic — only adding a new provider-specific adapter.

**Vehicle master data synchronization**

- **FR-005**: For each Provider whose data source is a live API and which exposes vehicle master endpoints, the system MUST synchronize brand, model, year, and sub-model data into the local database.
- **FR-006**: The system MUST execute the synchronization automatically at a configurable time each day (default 02:00 local time).
- **FR-007**: Authorized administrators (Senior Staff role and above) MUST be able to trigger a synchronization for any individual API-based Provider on demand from a dedicated admin page in the web application.
- **FR-008**: The system MUST prevent concurrent synchronizations for the same Provider; subsequent triggers while one is running MUST be rejected with a clear message.
- **FR-009**: Each synchronization attempt — scheduled or manual — MUST be recorded with started timestamp, finished timestamp, source Provider, trigger type (scheduled / manual), final status, count of records added, count of records updated, and error details when applicable.
- **FR-010**: Synchronization records MUST be queryable and visible on the admin sync page, showing at minimum the last successful sync per Provider.

**Search & quotation behavior**

- **FR-011**: When a user browses cascading vehicle dropdowns (brand, model, year, sub-model), the values MUST be served from local data without contacting any external Provider.
- **FR-012**: When a user requests a price comparison, the system MUST issue requests to all relevant API-based Providers in parallel.
- **FR-013**: Each Provider request MUST be subject to a per-Provider response-time limit of 3 seconds; Providers exceeding the limit MUST NOT delay the overall response.
- **FR-014**: The system MUST cache successful Provider responses so that repeated searches with the same parameters can be served from cache rather than from the live Provider.
- **FR-015**: When a cached entry is returned in place of a live response, the user-facing display MUST clearly indicate the cached state (e.g., a visible badge with the cache timestamp).

**Resilience**

- **FR-016**: When a Provider's recent calls fail repeatedly (consecutive failures exceeding a configured threshold), the system MUST suspend further calls to that Provider for a configured cool-down period.
- **FR-017**: While a Provider is suspended, requests to that Provider MUST be skipped immediately (no waiting) and the most recent cached data, if any, MUST be returned in its place with the cached badge.
- **FR-018**: After the cool-down period elapses, the system MUST attempt a single probe call; on success the Provider returns to normal operation, on failure the cool-down restarts.
- **FR-019**: One Provider's failure or suspension MUST NOT affect calls to other Providers in the same request.
- **FR-020**: The frontend MUST progressively render results as each Provider responds, showing a temporary placeholder for Providers still in flight.

**Configuration & operations**

- **FR-021**: Credentials and connection settings for each API-based Provider MUST be stored securely in configuration external to source code and changeable without redeployment.
- **FR-022**: The daily sync time, per-Provider response timeout, failure threshold, and cool-down period MUST be adjustable through configuration without code changes.
- **FR-023**: All Provider integrations MUST log activity at a level sufficient to diagnose connectivity issues, including request identifiers and response codes (excluding sensitive credential data).

### Key Entities *(include if feature involves data)*

- **Provider** — Represents a single insurer. Holds a stable identifier, display name, short code, active flag, data-source designation, and contact metadata. Existing insurance company records map to this concept.
- **Vehicle Master Record** — A canonical representation of a vehicle make/model/year/sub-model used to power search dropdowns and inter-Provider mappings. Synchronization populates and updates these.
- **Provider Vehicle Mapping** — A link between a canonical Vehicle Master Record and a Provider-specific reference code (e.g., a Provider's internal vehicle code or SKU).
- **Sync Log Entry** — A historical record of a single synchronization attempt: provider, trigger type (scheduled or manual), start time, end time, status (running / success / partial / failed), records added/updated, error summary, and the operator's identity if manually triggered.
- **Cached Quote Entry** — A logical concept: the most recent successful response from a Provider for a given search query, with a timestamp used to compute freshness and the "cached" badge.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can see plans from all active Providers — including any newly integrated API-based Provider — within the comparison view in the same search session.
- **SC-002**: For a search across all healthy Providers, the total response time observed by the user is no greater than 3 seconds in the 95th percentile.
- **SC-003**: Search dropdown values for vehicle selection appear within 200 ms of user click in the 95th percentile.
- **SC-004**: When one Provider's API is unavailable for any reason, the user still receives results from the remaining Providers within the same 3-second window.
- **SC-005**: A configured daily synchronization completes successfully for all API-based Providers at least 99 % of the time over a rolling 30-day window.
- **SC-006**: An authorized administrator can trigger a manual synchronization from the admin web page and observe progress and completion within the same browser session, without inspecting server logs.
- **SC-007**: After the feature is shipped, adding a future API-based insurer requires no changes to search or quotation code paths — only adding a Provider-specific adapter and configuration.
- **SC-008**: The volume of outbound calls to each Provider's API during normal browsing (cascading dropdown selection, repeated similar searches) is reduced by at least 90 % compared to a naive "call API on every interaction" baseline.

## Assumptions

- The existing imported-data flow for Allianz remains operational and unchanged for the duration of this feature; this feature is additive.
- Credentials for MTI and Viriyah are provisioned and supplied separately by the partner integration team before development of the corresponding Provider adapter begins.
- The PostgreSQL database schema already contains the canonical vehicle tables and an insurance-companies table; the feature extends these rather than replacing them.
- Roles and permissions (Admin, Manager, Senior Staff, Staff) are already implemented; this feature relies on the existing role boundary for "Senior Staff and above" access to the sync admin page.
- The existing Allianz import workflow will be wrapped as a "Provider" implementation, preserving its behavior, so that the new Provider abstraction applies uniformly across imported and API-based insurers.
- Out of scope for this feature: Chubb and AIOI Providers (planned for a later iteration), policy issuance flows (Validate/Issue), and clean-up of previously seeded companies that fall outside the motor-insurance scope.
- A single shared cache and Circuit Breaker per Provider are assumed; cross-cluster cache coherence is not required for the initial deployment.

## Provider-Specific Notes

These integration notes are recorded here to ensure they are honored during planning; they do not change the user-facing requirements.

- **MTI**: The pricing endpoint requires a specific magic value for the "Fund" parameter that is not documented in the official specification; this value must be applied by the MTI Provider adapter when issuing pricing calls. The exact value is to be propagated as a configuration constant referenced only inside the MTI adapter.
- **Viriyah**: The Viriyah account password contains special characters; configuration must preserve the exact value byte-for-byte (no escape interpretation). Token expiry is 1 hour; the adapter must refresh proactively before expiration.
- **Allianz** (existing): Retains its imported-data behavior; the new Provider abstraction wraps the existing import-driven query path so that it participates in aggregation alongside API-based Providers.
