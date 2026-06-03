import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // service role key (bypasses RLS)

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

export interface TaPosition {
  job_req_id:      string;
  title:           string;
  location:        string | null;
  posted_on:       string | null;
  end_date:        string | null;
  time_type:       string | null;
  external_url:    string;
  course_code:     string | null;
  faculty:         string | null;
  supervisor:      string | null;
  hourly_rate:     number | null;
  total_hours:     number | null;
  work_start_date: string | null;
  work_end_date:   string | null;
  language:        string | null;
}

/**
 * Verify the connection works. Table must already exist — run
 * services/ta_scraper/migration.sql in your Supabase SQL editor first.
 */
export async function initDb(): Promise<void> {
  const { error } = await supabase.from('ta_positions').select('id').limit(1);
  if (error) throw new Error(`Supabase connection check failed: ${error.message}`);
  console.log('Supabase connected — ta_positions table reachable.');
}

export async function upsertPosition(pos: TaPosition): Promise<void> {
  const { error } = await supabase
    .from('ta_positions')
    .upsert(
      { ...pos, scraped_at: new Date().toISOString() },
      { onConflict: 'job_req_id' }
    );

  if (error) throw new Error(`Upsert failed for ${pos.job_req_id}: ${error.message}`);
}
