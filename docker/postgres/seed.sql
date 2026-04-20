-- IHOS Sample Data Seed
-- Run AFTER migrations: psql -U ihos -d ihos_dev -f seed.sql
-- Idempotent: uses INSERT ... ON CONFLICT DO NOTHING

\c ihos_dev

-- ── 1. Insurance Companies (5) ────────────────────────────────────────────────
INSERT INTO insurance_companies (id, name, short_code, is_active, is_deleted, created_at, updated_at)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'Bangkok Insurance',    'BKI',  true, false, NOW(), NOW()),
  ('11111111-0000-0000-0000-000000000002', 'Muang Thai Life',      'MTL',  true, false, NOW(), NOW()),
  ('11111111-0000-0000-0000-000000000003', 'Viriyah Insurance',    'VRI',  true, false, NOW(), NOW()),
  ('11111111-0000-0000-0000-000000000004', 'Allianz Ayudhya',      'ALA',  true, false, NOW(), NOW()),
  ('11111111-0000-0000-0000-000000000005', 'Southeast Insurance',  'SEI',  false, false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ── 2. Vehicle Makes (10) ─────────────────────────────────────────────────────
INSERT INTO vehicle_makes (id, name, is_deleted, created_at, updated_at)
VALUES
  ('22222222-0000-0000-0000-000000000001', 'Toyota',   false, NOW(), NOW()),
  ('22222222-0000-0000-0000-000000000002', 'Honda',    false, NOW(), NOW()),
  ('22222222-0000-0000-0000-000000000003', 'Isuzu',    false, NOW(), NOW()),
  ('22222222-0000-0000-0000-000000000004', 'Mitsubishi', false, NOW(), NOW()),
  ('22222222-0000-0000-0000-000000000005', 'Ford',     false, NOW(), NOW()),
  ('22222222-0000-0000-0000-000000000006', 'Mazda',    false, NOW(), NOW()),
  ('22222222-0000-0000-0000-000000000007', 'Nissan',   false, NOW(), NOW()),
  ('22222222-0000-0000-0000-000000000008', 'Suzuki',   false, NOW(), NOW()),
  ('22222222-0000-0000-0000-000000000009', 'BMW',      false, NOW(), NOW()),
  ('22222222-0000-0000-0000-000000000010', 'Mercedes-Benz', false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ── 3. Vehicle Models (10) ────────────────────────────────────────────────────
INSERT INTO vehicle_models (id, make_id, name, is_deleted, created_at, updated_at)
VALUES
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'Corolla',      false, NOW(), NOW()),
  ('33333333-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', 'Camry',        false, NOW(), NOW()),
  ('33333333-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000001', 'Fortuner',     false, NOW(), NOW()),
  ('33333333-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000002', 'Civic',        false, NOW(), NOW()),
  ('33333333-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000002', 'CR-V',         false, NOW(), NOW()),
  ('33333333-0000-0000-0000-000000000006', '22222222-0000-0000-0000-000000000003', 'D-Max',        false, NOW(), NOW()),
  ('33333333-0000-0000-0000-000000000007', '22222222-0000-0000-0000-000000000004', 'Triton',       false, NOW(), NOW()),
  ('33333333-0000-0000-0000-000000000008', '22222222-0000-0000-0000-000000000005', 'Ranger',       false, NOW(), NOW()),
  ('33333333-0000-0000-0000-000000000009', '22222222-0000-0000-0000-000000000006', 'CX-5',         false, NOW(), NOW()),
  ('33333333-0000-0000-0000-000000000010', '22222222-0000-0000-0000-000000000007', 'Navara',       false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ── 4. Default User ───────────────────────────────────────────────────────────
-- The bootstrap Admin is created automatically by DbInitializer on first `dotnet run`.
-- Default credentials:  admin@ihos.local  /  Admin@1234!
-- (Override via appsettings: Bootstrap:AdminPassword)
-- The sentinel UUID below is used only as a placeholder FK for seed data below.
-- It will NOT match the actual seeded user's auto-generated UUID — update after first run.
-- Alternatively register additional users via Admin → Registrations in the UI.

-- ── 5. Vehicle Model Mappings (sample aliases per company) ───────────────────
INSERT INTO vehicle_model_mappings (id, company_id, raw_value, canonical_model_id, is_deleted, created_at, updated_at, created_by)
VALUES
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000001', 'Toyota Corolla',    '33333333-0000-0000-0000-000000000001', false, NOW(), NOW(), '44444444-0000-0000-0000-000000000001'),
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000001', 'COROLLA',           '33333333-0000-0000-0000-000000000001', false, NOW(), NOW(), '44444444-0000-0000-0000-000000000001'),
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000001', 'Toyota Camry',      '33333333-0000-0000-0000-000000000002', false, NOW(), NOW(), '44444444-0000-0000-0000-000000000001'),
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000002', 'Honda CIVIC',       '33333333-0000-0000-0000-000000000004', false, NOW(), NOW(), '44444444-0000-0000-0000-000000000001'),
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000002', 'CRV',               '33333333-0000-0000-0000-000000000005', false, NOW(), NOW(), '44444444-0000-0000-0000-000000000001'),
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000003', 'D MAX',             '33333333-0000-0000-0000-000000000006', false, NOW(), NOW(), '44444444-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ── 6. Plan Type Mappings ─────────────────────────────────────────────────────
INSERT INTO plan_type_mappings ("Id", "CompanyId", "RawName", "CanonicalPlanType", "IsDeleted", "CreatedAt", "UpdatedAt", "CreatedBy")
VALUES
  -- Bangkok Insurance (BKI)
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000001', 'Type1',    'Type1',    false, NOW(), NOW(), '44444444-0000-0000-0000-000000000001'),
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000001', 'ประเภท 1', 'Type1',    false, NOW(), NOW(), '44444444-0000-0000-0000-000000000001'),
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000001', 'Type2',    'Type2',    false, NOW(), NOW(), '44444444-0000-0000-0000-000000000001'),
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000001', 'Type3',    'Type3',    false, NOW(), NOW(), '44444444-0000-0000-0000-000000000001'),
  -- Muang Thai Life (MTL)
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000002', 'Compulsory','Type1',   false, NOW(), NOW(), '44444444-0000-0000-0000-000000000001'),
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000002', 'Type1',    'Type1',    false, NOW(), NOW(), '44444444-0000-0000-0000-000000000001'),
  -- Viriyah (VRI) — values emitted by ViriyahInsuranceAdapter
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000003', 'Type1',    'Type1',    false, NOW(), NOW(), '44444444-0000-0000-0000-000000000001'),
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000003', 'Type2',    'Type2',    false, NOW(), NOW(), '44444444-0000-0000-0000-000000000001'),
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000003', 'Type3',    'Type3',    false, NOW(), NOW(), '44444444-0000-0000-0000-000000000001'),
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000003', 'Type3Plus', 'Type3Plus',false, NOW(), NOW(), '44444444-0000-0000-0000-000000000001'),
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000003', 'Type2Plus', 'Type2Plus',false, NOW(), NOW(), '44444444-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ── 7. Sample Insurance Plans (published, for search testing) ────────────────
INSERT INTO insurance_plans
  (id, company_id, vehicle_model_id, plan_type, repair_type, min_year, max_year,
   sum_insured, premium_total, excess_amount, coverage_details, is_published,
   is_deleted, created_at, updated_at)
VALUES
  -- Bangkok Insurance — Corolla — Type1 — Garage — 0-5 yrs
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001',
   0, 0, 0, 5, 800000, 18500, 2000, '{"windshield":true,"flood":false}', true, false, NOW(), NOW()),

  -- Bangkok Insurance — Corolla — Type1 — Garage — 6-10 yrs
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001',
   0, 0, 6, 10, 600000, 14000, 3000, '{"windshield":true,"flood":false}', true, false, NOW(), NOW()),

  -- Bangkok Insurance — Camry — Type1 — Dealer
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002',
   0, 1, 0, 5, 1200000, 28000, 1000, '{"windshield":true,"flood":true}', true, false, NOW(), NOW()),

  -- Muang Thai — Civic — Type1 — Garage
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000004',
   0, 0, 0, 7, 700000, 16500, 2500, '{"windshield":true,"flood":false}', true, false, NOW(), NOW()),

  -- Viriyah — D-Max — Type2 — Garage
  (gen_random_uuid(), '11111111-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000006',
   1, 0, 0, 8, 500000, 9500, 5000, '{}', true, false, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ── 8. Sample Import Batch ────────────────────────────────────────────────────
INSERT INTO import_batches
  (id, company_id, source_file_name, source_file_path, uploaded_by, uploaded_at,
   status, total_rows, resolved_rows, pending_rows, approved_rows, rejected_rows,
   is_deleted, created_at, updated_at, created_by)
VALUES
  ('55555555-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000001',
   'bki_plans_2026_q1.xlsx',
   'imports/BKI/20260101/sample/bki_plans_2026_q1.xlsx',
   '44444444-0000-0000-0000-000000000002',
   '2026-01-15 08:30:00',
   2, -- Published
   5, 5, 0, 5, 0,
   false, '2026-01-15 08:30:00', '2026-01-15 09:00:00',
   '44444444-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- Done
SELECT 'Seed complete.' AS status;
