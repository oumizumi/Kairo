-- Run once in your Supabase SQL editor before running the scraper.

CREATE TABLE IF NOT EXISTS scholarships (
  id                  BIGSERIAL     PRIMARY KEY,
  program_id          TEXT          NOT NULL,
  competition_id      TEXT          NOT NULL,
  name                TEXT,
  deadline            DATE,
  start_date          DATE,
  is_open             BOOLEAN,
  prospectus_url      TEXT,
  min_amount          NUMERIC,
  max_amount          NUMERIC,
  eligible_faculties  TEXT[],
  application_url     TEXT,
  scraped_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  UNIQUE (program_id, competition_id)
);

-- Allow public read access (no login required)
ALTER TABLE scholarships DISABLE ROW LEVEL SECURITY;

-- Useful indexes
CREATE INDEX IF NOT EXISTS scholarships_is_open_idx  ON scholarships (is_open);
CREATE INDEX IF NOT EXISTS scholarships_deadline_idx ON scholarships (deadline);
