/*
# FloodPulse: Add AI scoring columns to reports table

1. Modified Tables

- `reports` — adds AI-powered scoring columns from the Gemini API.
  - `urgency` changed from integer to text — now stores 'critical', 'high', 'medium', or 'low'
  - `credibility` changed from integer to text — now stores 'high', 'medium', or 'low'
  - `reasoning` (text, nullable) — AI's one-sentence explanation of the urgency level

2. Security
- No policy changes. Existing anon/authenticated CRUD policies remain in place.
- The edge function uses the service role key (bypasses RLS) to update scores.

3. Important Notes
- The urgency and credibility columns previously stored integers (all null in practice).
  Since they were never populated, changing the type from integer to text is safe —
  no existing data is lost.
- A CHECK constraint is added to validate urgency and credibility values.
*/

-- Add reasoning column if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'reasoning'
  ) THEN
    ALTER TABLE reports ADD COLUMN reasoning text;
  END IF;
END $$;

-- Change urgency from integer to text
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'urgency'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE reports ALTER COLUMN urgency TYPE text USING NULL;
  END IF;
END $$;

-- Change credibility from integer to text
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'credibility'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE reports ALTER COLUMN credibility TYPE text USING NULL;
  END IF;
END $$;

-- Add CHECK constraints for valid scoring values
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reports_urgency_check'
  ) THEN
    ALTER TABLE reports ADD CONSTRAINT reports_urgency_check
      CHECK (urgency IS NULL OR urgency IN ('critical', 'high', 'medium', 'low'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reports_credibility_check'
  ) THEN
    ALTER TABLE reports ADD CONSTRAINT reports_credibility_check
      CHECK (credibility IS NULL OR credibility IN ('high', 'medium', 'low'));
  END IF;
END $$;