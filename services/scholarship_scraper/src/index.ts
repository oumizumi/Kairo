import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

// ── Env validation ────────────────────────────────────────────────────────────

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// ── Supabase client ───────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface Scholarship {
  program_id:         string;
  competition_id:     string;
  name:               string | null;
  deadline:           string | null;
  start_date:         string | null;
  is_open:            boolean | null;
  prospectus_url:     string | null;
  min_amount:         number | null;
  max_amount:         number | null;
  eligible_faculties: string[];
  application_url:    string;
  scraped_at:         string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a Synto timestamp (ms or s) to an ISO date string, or null. */
function toISODate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'string' ? Number(value) : (value as number);
  if (isNaN(num) || num === 0) return null;
  const ms = num < 1e10 ? num * 1000 : num;
  return new Date(ms).toISOString().split('T')[0];
}

/** Safely navigate nested object paths without throwing. */
function dig(obj: unknown, ...keys: string[]): unknown {
  let cur = obj;
  for (const key of keys) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur ?? null;
}

/** Parse eligible faculty codes from criteriaJsonData. */
function parseFaculties(criteriaJsonData: unknown): string[] {
  const info = dig(criteriaJsonData, 'cmpComplementaryInformation') as Record<string, unknown> | null;
  if (!info) return [];

  const field = info['checkbox_code_faculte'];
  if (!Array.isArray(field)) return [];

  return field
    .filter((entry: unknown) => {
      if (typeof entry !== 'object' || entry === null) return false;
      const e = entry as Record<string, unknown>;
      return e['value'] === true;
    })
    .map((entry: unknown) => {
      const e = entry as Record<string, unknown>;
      const label = dig(e, 'option', 'label', 'en');
      return typeof label === 'string' ? label.trim() : '';
    })
    .filter(Boolean);
}

/**
 * Each top-level item is a program with a nested `competitions` array.
 * We flatten them into one Scholarship per competition.
 */
function parseProgram(raw: unknown): Scholarship[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const r = raw as Record<string, unknown>;

  const programId = r['programId'];
  if (!programId) return [];

  const name = (dig(r, 'programFullName', 'en') as string | null)?.trim() ?? null;
  const competitions = r['competitions'];
  if (!Array.isArray(competitions)) return [];

  const results: Scholarship[] = [];

  for (const comp of competitions) {
    if (typeof comp !== 'object' || comp === null) continue;
    const c = comp as Record<string, unknown>;

    const competitionId = c['competitionId'];
    if (!competitionId) continue;

    const criteriaJsonData = c['criteriaJsonData'];
    const compInfo = dig(criteriaJsonData, 'cmpComplementaryInformation') as Record<string, unknown> | null;

    const minAmountRaw = dig(compInfo, 'text_minimum_granted_amount', 'value');
    const maxAmountRaw = dig(compInfo, 'text_maximum_granted_amount', 'value');
    const minAmount = minAmountRaw !== null ? parseFloat(String(minAmountRaw)) : null;
    const maxAmount = maxAmountRaw !== null ? parseFloat(String(maxAmountRaw)) : null;

    results.push({
      program_id:         String(programId),
      competition_id:     String(competitionId),
      name,
      deadline:           toISODate(c['competitionDeadline']),
      start_date:         toISODate(c['competitionStartDate']),
      is_open:            typeof c['isOpen'] === 'boolean' ? c['isOpen'] : null,
      prospectus_url:     (dig(c, 'prospectus', 'url', 'en') as string | null) ?? null,
      min_amount:         isNaN(minAmount as number) ? null : minAmount,
      max_amount:         isNaN(maxAmount as number) ? null : maxAmount,
      eligible_faculties: parseFaculties(criteriaJsonData),
      application_url:    'https://uottawa.syntosolution.com/dashboard/opportunity',
      scraped_at:         new Date().toISOString(),
    });
  }

  return results;
}

// ── Browser login + fetch ─────────────────────────────────────────────────────

async function loginAndFetch(): Promise<unknown[]> {
  console.log('Opening browser — please log in to uOttawa Synto...');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page    = await context.newPage();

  await page.goto('https://uottawa.syntosolution.com');

  // Wait until the user is logged in (dashboard appears)
  console.log('Waiting for you to log in (the browser will close automatically once detected)...');
  await page.waitForURL('**/dashboard**', { timeout: 5 * 60 * 1000 });
  console.log('Login detected. Grabbing session cookies...');

  // Give the app a moment to settle and set all cookies
  await page.waitForTimeout(2000);

  const cookies = await context.cookies();
  const cookieHeader = cookies
    .map(c => `${c.name}=${c.value}`)
    .join('; ');

  console.log(`Captured ${cookies.length} cookie(s). Fetching scholarships...`);

  // Call the API from within the same browser context so cookies apply
  const response = await page.evaluate(async (cookie) => {
    const res = await fetch('/api/getAllOpportunities', {
      headers: {
        'Accept': 'application/json',
        'Cookie': cookie,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, cookieHeader);

  await browser.close();

  let items: unknown[] = [];

  if (Array.isArray(response)) {
    items = response;
  } else if (typeof response === 'object' && response !== null) {
    const b = response as Record<string, unknown>;
    if (Array.isArray(b['data']))          items = b['data'] as unknown[];
    else if (Array.isArray(b['opportunities'])) items = b['opportunities'] as unknown[];
    else if (Array.isArray(b['results']))  items = b['results'] as unknown[];
    else throw new Error(`Unexpected API response shape: ${JSON.stringify(response).slice(0, 200)}`);
  } else {
    throw new Error(`Unexpected API response shape: ${JSON.stringify(response).slice(0, 200)}`);
  }

  // Log first item so we can inspect field names
  if (items.length > 0) {
    console.log('\n── Sample raw opportunity (first item) ──');
    console.log(JSON.stringify(items[0], null, 2).slice(0, 2000));
    console.log('─────────────────────────────────────────\n');
  }

  return items;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const raw = await loginAndFetch();
  console.log(`Fetched ${raw.length} raw opportunities.`);

  const scholarships: Scholarship[] = [];
  let skipped = 0;

  for (const item of raw) {
    const parsed = parseProgram(item);
    if (parsed.length > 0) {
      scholarships.push(...parsed);
    } else {
      skipped++;
    }
  }

  console.log(`Parsed ${scholarships.length} valid scholarships from ${raw.length - skipped} programs (${skipped} skipped).`);

  if (scholarships.length === 0) {
    console.log('Nothing to upsert.');
    return;
  }

  const BATCH = 100;
  let upserted = 0;

  for (let i = 0; i < scholarships.length; i += BATCH) {
    const batch = scholarships.slice(i, i + BATCH);
    const { error } = await supabase
      .from('scholarships')
      .upsert(batch, { onConflict: 'program_id,competition_id' });

    if (error) throw new Error(`Supabase upsert error: ${error.message}`);
    upserted += batch.length;
    console.log(`  Upserted ${upserted}/${scholarships.length}...`);
  }

  console.log(`Done. ${upserted} scholarship(s) upserted into Supabase.`);
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
