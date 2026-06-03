-- Run this once in your Supabase SQL editor before starting the scraper.

CREATE TABLE IF NOT EXISTS ta_positions (
  id              BIGSERIAL    PRIMARY KEY,
  job_req_id      TEXT         UNIQUE NOT NULL,
  title           TEXT,
  location        TEXT,
  posted_on       TEXT,
  end_date        TEXT,
  time_type       TEXT,
  external_url    TEXT,
  course_code     TEXT,
  faculty         TEXT,
  supervisor      TEXT,
  hourly_rate     NUMERIC,
  total_hours     NUMERIC,
  work_start_date TEXT,
  work_end_date   TEXT,
  language        TEXT,
  scraped_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Optional: index for fast lookups by course code
CREATE INDEX IF NOT EXISTS ta_positions_course_code_idx ON ta_positions (course_code);
