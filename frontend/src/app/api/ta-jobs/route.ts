import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Supabase anon key requires a public read policy on ta_positions:
//   CREATE POLICY "public read" ON ta_positions FOR SELECT USING (true);
// Or disable RLS: ALTER TABLE ta_positions DISABLE ROW LEVEL SECURITY;

const COLS = [
  'job_req_id', 'title', 'course_code', 'faculty', 'supervisor',
  'hourly_rate', 'total_hours', 'language', 'end_date', 'posted_on',
  'external_url', 'work_start_date', 'work_end_date', 'location', 'scraped_at',
].join(',')

export async function GET(_req: NextRequest) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ positions: [] })
  }

  const params = new URLSearchParams({
    select: COLS,
    order: 'scraped_at.desc',
    limit: '300',
  })

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ta_positions?${params}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json({ positions: [] })
    }

    const data = await res.json()
    return NextResponse.json({ positions: Array.isArray(data) ? data : [] })
  } catch {
    return NextResponse.json({ positions: [] })
  }
}
