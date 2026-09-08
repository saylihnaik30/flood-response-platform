/*
# FloodPulse: Create reports and resources tables

1. New Tables

- `reports` — stores citizen disaster reports submitted from the /report page.
  - `id` (uuid, primary key, auto-generated)
  - `location` (text, not null) — where the citizen is
  - `description` (text, not null) — situation details
  - `need_type` (text, not null) — one of: rescue, medical, shelter, food
  - `photo_url` (text, nullable) — optional uploaded photo URL
  - `status` (text, not null, default 'pending') — report processing status
  - `urgency` (integer, nullable, default null) — reserved for future AI scoring
  - `credibility` (integer, nullable, default null) — reserved for future AI scoring
  - `created_at` (timestamptz, default now()) — submission timestamp

- `resources` — stores deployable emergency resources across the city.
  - `id` (uuid, primary key, auto-generated)
  - `name` (text, not null) — resource name/title
  - `type` (text, not null) — one of: rescue, medical, shelter, food
  - `location` (text, not null) — where the resource is stationed
  - `available` (boolean, not null, default true) — whether the resource is deployable

2. Security

- This is a no-auth app (no sign-in screen). Both tables are intentionally
  public/shared — citizens submit reports and responders view them, all via
  the anon key. RLS is enabled on both tables with permissive CRUD policies
  scoped to `anon, authenticated`.

3. Seed Data

- 6 sample resources of varying types seeded across a fictional city.
*/

-- ── reports table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location    text NOT NULL,
  description text NOT NULL,
  need_type   text NOT NULL CHECK (need_type IN ('rescue', 'medical', 'shelter', 'food')),
  photo_url   text,
  status      text NOT NULL DEFAULT 'pending',
  urgency     integer,
  credibility integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_reports" ON reports;
CREATE POLICY "anon_select_reports" ON reports FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_reports" ON reports;
CREATE POLICY "anon_insert_reports" ON reports FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_reports" ON reports;
CREATE POLICY "anon_update_reports" ON reports FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_reports" ON reports;
CREATE POLICY "anon_delete_reports" ON reports FOR DELETE
  TO anon, authenticated USING (true);

-- ── resources table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resources (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name      text NOT NULL,
  type      text NOT NULL CHECK (type IN ('rescue', 'medical', 'shelter', 'food')),
  location  text NOT NULL,
  available boolean NOT NULL DEFAULT true
);

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_resources" ON resources;
CREATE POLICY "anon_select_resources" ON resources FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_resources" ON resources;
CREATE POLICY "anon_insert_resources" ON resources FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_resources" ON resources;
CREATE POLICY "anon_update_resources" ON resources FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_resources" ON resources;
CREATE POLICY "anon_delete_resources" ON resources FOR DELETE
  TO anon, authenticated USING (true);

-- ── seed resources ─────────────────────────────────────────────
INSERT INTO resources (name, type, location, available) VALUES
  ('Riverside Swift Rescue Team',  'rescue',  'Riverside District, Near North Bridge', true),
  ('St. Mary Emergency Medical Unit', 'medical', 'Downtown, Central Hospital Campus', true),
  ('Greenfield Community Shelter', 'shelter', 'Greenfield, West Side High School Gym', true),
  ('Harbor Food Distribution Hub', 'food',    'Harbor Port, Warehouse 7', true),
  ('Eastside Flood Rescue Boat Squad', 'rescue', 'Eastside, Canal Lock 3', true),
  ('Mercy Clinic Mobile Unit',     'medical', 'Southgate, Civic Center Parking Lot', true)
ON CONFLICT DO NOTHING;