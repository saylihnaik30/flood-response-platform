/*
# FloodPulse: Add coordinates and resource assignment tracking

1. Modified Tables

- `reports`
  - `lat` (double precision, nullable) — latitude for map plotting
  - `lng` (double precision, nullable) — longitude for map plotting
  - `assigned_resource_id` (uuid, nullable) — FK to resources.id, tracks which
    resource has been assigned to this report (null = not assigned)

- `resources`
  - `lat` (double precision, nullable) — latitude for map plotting
  - `lng` (double precision, nullable) — longitude for map plotting

2. Security
- No RLS policy changes. Existing anon/authenticated CRUD policies already cover
  the new columns (policies use USING(true) WITH CHECK(true) for this no-auth app).
- The new FK on reports.assigned_resource_id references resources(id) with
  ON DELETE SET NULL — if a resource is deleted, the report's assignment clears
  rather than causing a constraint violation.

3. Seed Data
- All existing reports and resources are updated with realistic Pune-area
  coordinates so every marker renders on the map immediately.
- Only rows with NULL lat/lng are updated — existing valid coordinates are
  never overwritten.

4. Important Notes
- No columns are dropped or renamed. No data types are changed.
- The lat/lng columns are nullable so the report submission page (which does
  not collect coordinates) continues to work without modification.
- assigned_resource_id is nullable so existing reports remain valid.
*/

-- ── Add lat/lng to reports ──────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'lat'
  ) THEN
    ALTER TABLE reports ADD COLUMN lat double precision;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'lng'
  ) THEN
    ALTER TABLE reports ADD COLUMN lng double precision;
  END IF;
END $$;

-- ── Add assigned_resource_id to reports ─────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'assigned_resource_id'
  ) THEN
    ALTER TABLE reports ADD COLUMN assigned_resource_id uuid
      REFERENCES resources(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Add lat/lng to resources ────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resources' AND column_name = 'lat'
  ) THEN
    ALTER TABLE resources ADD COLUMN lat double precision;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resources' AND column_name = 'lng'
  ) THEN
    ALTER TABLE resources ADD COLUMN lng double precision;
  END IF;
END $$;

-- ── Seed resource coordinates (Pune area) ───────────────────────
-- Only update rows where lat/lng are still NULL
UPDATE resources SET lat = 18.5204, lng = 73.8567
  WHERE name = 'Riverside Swift Rescue Team' AND lat IS NULL;

UPDATE resources SET lat = 18.5300, lng = 73.8400
  WHERE name = 'St. Mary Emergency Medical Unit' AND lat IS NULL;

UPDATE resources SET lat = 18.5000, lng = 73.8100
  WHERE name = 'Greenfield Community Shelter' AND lat IS NULL;

UPDATE resources SET lat = 18.5500, lng = 73.9000
  WHERE name = 'Harbor Food Distribution Hub' AND lat IS NULL;

UPDATE resources SET lat = 18.5400, lng = 73.8800
  WHERE name = 'Eastside Flood Rescue Boat Squad' AND lat IS NULL;

UPDATE resources SET lat = 18.4900, lng = 73.8500
  WHERE name = 'Mercy Clinic Mobile Unit' AND lat IS NULL;

-- ── Seed report coordinates (Pune area, spread out) ─────────────
-- Only update rows where lat/lng are still NULL
UPDATE reports SET lat = 18.5300, lng = 73.8600
  WHERE id = 'da953325-5438-44d0-a709-1e4fce5fdc29' AND lat IS NULL;

UPDATE reports SET lat = 18.5350, lng = 73.8450
  WHERE id = '06fa7f50-06b4-4aaa-b966-9b8797d38fb6' AND lat IS NULL;

UPDATE reports SET lat = 18.5100, lng = 73.8200
  WHERE id = 'a549fd47-5390-4e64-93c5-ce922bbb65e4' AND lat IS NULL;

UPDATE reports SET lat = 18.5200, lng = 73.8650
  WHERE id = 'eeecd597-1b4e-40a6-9bc0-07b2c3d55ae2' AND lat IS NULL;

UPDATE reports SET lat = 18.5210, lng = 73.8660
  WHERE id = '89ce6189-5ee5-46cd-8ef2-c5d52374e6d9' AND lat IS NULL;

UPDATE reports SET lat = 18.5220, lng = 73.8670
  WHERE id = 'bb12a88e-af83-4609-99fa-87a48df884e5' AND lat IS NULL;

UPDATE reports SET lat = 18.5230, lng = 73.8680
  WHERE id = '7a5de344-63d1-4ba3-9109-f2f1299d23e0' AND lat IS NULL;

UPDATE reports SET lat = 18.5240, lng = 73.8690
  WHERE id = 'd9891440-ae9b-4d82-b7c7-d04ce854d70d' AND lat IS NULL;

UPDATE reports SET lat = 18.5250, lng = 73.8700
  WHERE id = 'bc3da71b-97cc-4d30-ba07-03a6673c6926' AND lat IS NULL;

UPDATE reports SET lat = 18.5700, lng = 73.9800
  WHERE id = 'bce2d7d1-c9f1-4653-890b-09aa06c0ef13' AND lat IS NULL;

UPDATE reports SET lat = 18.5400, lng = 73.8800
  WHERE id = '2d1acc5a-5c49-498d-af34-3117991d2eaf' AND lat IS NULL;

UPDATE reports SET lat = 18.5204, lng = 73.8567
  WHERE id = '29181df6-f55d-4c11-a8d9-5a85589c15ba' AND lat IS NULL;

UPDATE reports SET lat = 18.5150, lng = 73.8500
  WHERE id = '8e41b7c1-305e-49d7-a603-ab508f1e2cb1' AND lat IS NULL;

-- ── Add more test resources for richer matching ─────────────────
-- Add a few extra resources so critical/high reports have matches
INSERT INTO resources (name, type, location, available, lat, lng) VALUES
  ('Hadapsar Rescue Squad', 'rescue', 'Hadapsar, Pune', true, 18.5080, 73.9290),
  ('Kothrud Medical Camp', 'medical', 'Kothrud, Pune', true, 18.5070, 73.8080),
  ('Baner Shelter Center', 'shelter', 'Baner, Pune', true, 18.5600, 73.7700),
  ('Kharadi Food Relief', 'food', 'Kharadi, Pune', true, 18.5600, 73.9400)
ON CONFLICT DO NOTHING;
