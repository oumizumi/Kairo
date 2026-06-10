import { TaPosition } from './db';
import { parseJobDescription } from './parser';

const BASE     = 'https://uottawa.wd3.myworkdayjobs.com/wday/cxs/uottawa/uOttawa_External_Career_Site';
const LIST_URL = `${BASE}/jobs`;
const DETAIL_DELAY_MS = 400;
const RETRY_DELAY_MS  = 2000;
const MAX_RETRIES     = 3;

// All search terms to run — results are deduplicated by job_req_id
const SEARCH_TERMS = ['teaching assistant', 'research assistant'];

const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; UoSchedScraper/1.0)',
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface WorkdayJob {
  title:           string;
  externalPath:    string;
  jobReqId:        string;
  locationsText:   string;
  postedOn:        string;
  closeDateText:   string;
  jobScheduleType: string;
}

interface ListResponse {
  jobPostings: WorkdayJob[];
  total: number;
}

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, options);
    if (res.ok) return res;
    if (res.status === 429 || res.status >= 500) {
      if (attempt < retries) {
        const delay = RETRY_DELAY_MS * attempt;
        console.log(`  HTTP ${res.status} — retrying in ${delay}ms (attempt ${attempt}/${retries})`);
        await sleep(delay);
        continue;
      }
    }
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  throw new Error(`All ${retries} retries failed for ${url}`);
}

async function fetchPage(offset: number, searchText: string): Promise<ListResponse> {
  const res = await fetchWithRetry(LIST_URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText }),
  });

  const data = await res.json() as any;
  return {
    jobPostings: data.jobPostings ?? [],
    total: data.total ?? 0,
  };
}

async function fetchDetail(externalPath: string): Promise<any> {
  const res = await fetchWithRetry(`${BASE}${externalPath}`, { headers: HEADERS });
  return res.json();
}

function buildPublicUrl(externalPath: string): string {
  return `https://uottawa.wd3.myworkdayjobs.com/en-US/uOttawa_External_Career_Site${externalPath}`;
}

async function scrapeByTerm(searchText: string): Promise<{ positions: TaPosition[]; deadIds: string[] }> {
  const positions: TaPosition[] = [];
  const deadIds:   string[]     = [];
  let offset = 0;
  let total  = Infinity;

  console.log(`\nSearching: "${searchText}"`);

  while (offset < total) {
    const page = await fetchPage(offset, searchText);
    if (offset === 0 || page.total > 0) total = page.total;

    console.log(`  offset=${offset}  fetched=${page.jobPostings.length}  total=${total}`);

    if (page.jobPostings.length === 0) break;

    for (const job of page.jobPostings) {
      await sleep(DETAIL_DELAY_MS);

      const jobId: string = job.jobReqId || job.externalPath;

      let parsed;
      try {
        const detail = await fetchDetail(job.externalPath);
        const info = detail.jobPostingInfo ?? detail;

        // Workday sometimes returns 200 with an error/empty body for removed postings
        if (!info || info.error || info.status === 'NOT_FOUND') {
          console.log(`  dead  ${job.title} [${jobId}]`);
          deadIds.push(jobId);
          continue;
        }

        const descriptionHtml: string = info.jobDescription ?? '';
        parsed = parseJobDescription(descriptionHtml);
        console.log(`  ok  ${job.title} [${jobId}]`);
      } catch (err) {
        const msg = (err as Error).message;
        if (/HTTP 404|HTTP 410/.test(msg)) {
          console.log(`  dead  ${job.title} [${jobId}]`);
          deadIds.push(jobId);
          continue;
        }
        console.error(`  err  ${job.externalPath}: ${msg}`);
        parsed = {
          course_code: null, faculty: null, supervisor: null,
          hourly_rate: null, total_hours: null,
          work_start_date: null, work_end_date: null, language: null,
        };
      }

      positions.push({
        job_req_id:   jobId,
        title:        job.title,
        location:     job.locationsText || null,
        posted_on:    job.postedOn || null,
        end_date:     job.closeDateText || null,
        time_type:    job.jobScheduleType || null,
        external_url: buildPublicUrl(job.externalPath),
        ...parsed,
      });
    }

    offset += page.jobPostings.length;
  }

  return { positions, deadIds };
}

export async function scrapeAllTaPositions(): Promise<{ positions: TaPosition[]; deadIds: string[] }> {
  const seenPos  = new Set<string>();
  const seenDead = new Set<string>();
  const all:      TaPosition[] = [];
  const dead:     string[]     = [];

  for (const term of SEARCH_TERMS) {
    const { positions, deadIds } = await scrapeByTerm(term);
    for (const pos of positions) {
      if (!seenPos.has(pos.job_req_id)) {
        seenPos.add(pos.job_req_id);
        all.push(pos);
      }
    }
    for (const id of deadIds) {
      if (!seenDead.has(id)) {
        seenDead.add(id);
        dead.push(id);
      }
    }
  }

  console.log(`\nScraped ${all.length} unique position(s), ${dead.length} dead/removed.`);
  return { positions: all, deadIds: dead };
}
