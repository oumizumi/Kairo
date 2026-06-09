// RMP scraper v2 — school-scoped GraphQL teacher search, no browser needed.
//
// Replaces run.js (Puppeteer click-search) + filter_ottawa_only.py (school check):
// the search itself is already filtered to University of Ottawa, and ratings come
// back inline, so this single script produces professors_rmp_data.json directly.
//
// Usage (from services/rmp_scraper/):
//   python src/extract_names.py --all   # regenerate names.csv with every prof
//   node src/find_ids.js                # search + match + write outputs
//
// Outputs:
//   professors_rmp_data.json  keyed by course-data name (what the frontend looks up)
//   names.csv                 ID column filled (kept for pdcsv.py/main.py review pipeline)
//   unmatched_professors.txt  names with no acceptable RMP match

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const RMP_DIR = path.join(__dirname, '..');
const NAMES_CSV = path.join(RMP_DIR, 'names.csv');
const OUTPUT_JSON = path.join(RMP_DIR, 'professors_rmp_data.json');
const UNMATCHED_TXT = path.join(RMP_DIR, 'unmatched_professors.txt');

const GRAPHQL_URL = 'https://www.ratemyprofessors.com/graphql';
const SCHOOL_NAME = 'University of Ottawa';
const WORKERS = 5;
const RETRIES = 3;

const HEADERS = {
  'Authorization': 'Basic dGVzdDp0ZXN0',
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function gql(query, variables) {
  let lastErr;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      const res = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ query, variables }),
      });
      if (res.status === 429) {
        await sleep(2000 * (attempt + 1));
        lastErr = new Error('rate limited');
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.errors) throw new Error(JSON.stringify(json.errors));
      return json.data;
    } catch (e) {
      lastErr = e;
      await sleep(1000 * (attempt + 1));
    }
  }
  throw lastErr;
}

async function resolveSchoolID() {
  const data = await gql(`
    query SchoolSearch($text: String!) {
      newSearch {
        schools(query: { text: $text }) {
          edges { node { id name legacyId } }
        }
      }
    }`, { text: SCHOOL_NAME });
  const node = data.newSearch.schools.edges
    .map(e => e.node)
    .find(n => n.name === SCHOOL_NAME);
  if (!node) throw new Error(`School not found: ${SCHOOL_NAME}`);
  return node.id;
}

async function searchTeachers(text, schoolID) {
  const data = await gql(`
    query TeacherSearch($text: String!, $schoolID: ID!) {
      newSearch {
        teachers(query: { text: $text, schoolID: $schoolID }, first: 10) {
          edges {
            node {
              id legacyId firstName lastName department
              avgRating avgDifficulty numRatings wouldTakeAgainPercent
            }
          }
        }
      }
    }`, { text, schoolID });
  return data.newSearch.teachers.edges.map(e => e.node);
}

// keep in sync with frontend/src/app/api/rmp/route.ts normalizeName
function normalize(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-'’.]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Best match among results: exact full name > first+last tokens (ignores middle
// names on either side) > unique last name + first initial.
function pickMatch(name, teachers) {
  const target = normalize(name);
  const tParts = target.split(' ');
  const tFirst = tParts[0];
  const tLast = tParts[tParts.length - 1];

  let best = null;
  let bestScore = 0;
  let tier3Count = 0;

  for (const t of teachers) {
    const full = normalize(`${t.firstName} ${t.lastName}`);
    const parts = full.split(' ');
    const first = parts[0];
    const last = parts[parts.length - 1];

    let score = 0;
    if (full === target) score = 100;
    else if (first === tFirst && last === tLast) score = 80;
    else if (last === tLast && first[0] === tFirst[0]) { score = 50; tier3Count++; }

    if (score > bestScore || (score === bestScore && score > 0 && t.numRatings > (best?.numRatings ?? -1))) {
      best = t;
      bestScore = score;
    }
  }

  // initial-only matches are risky — only accept when unambiguous
  if (bestScore === 50 && tier3Count > 1) return null;
  return bestScore > 0 ? best : null;
}

async function processName(name, schoolID) {
  let teachers = await searchTeachers(name, schoolID);
  let match = pickMatch(name, teachers);

  // retry without middle names — RMP search chokes on them sometimes
  if (!match) {
    const parts = name.split(/\s+/);
    if (parts.length > 2) {
      const short = `${parts[0]} ${parts[parts.length - 1]}`;
      teachers = await searchTeachers(short, schoolID);
      match = pickMatch(name, teachers);
    }
  }
  return match;
}

async function main() {
  const retryMissing = process.argv.includes('--retry-missing');

  console.log('Resolving school ID...');
  const schoolID = await resolveSchoolID();
  console.log(`School ID: ${schoolID}`);

  const csv = Papa.parse(fs.readFileSync(NAMES_CSV, 'utf8'), { header: true, skipEmptyLines: true });
  const allNames = csv.data.map(r => (r.Name || '').trim()).filter(Boolean);

  // --retry-missing: keep existing matches, only re-query names without one
  let existing = {};
  if (retryMissing && fs.existsSync(OUTPUT_JSON)) {
    existing = JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf8'));
    console.log(`Retry mode: ${Object.keys(existing).length} already matched, skipping those`);
  }
  const names = retryMissing ? allNames.filter(n => !(n in existing)) : allNames;
  console.log(`Searching ${names.length} professors (${WORKERS} workers)...`);

  const results = {};   // course name -> teacher node | null
  let done = 0;

  let cursor = 0;
  async function worker() {
    while (cursor < names.length) {
      const i = cursor++;
      const name = names[i];
      try {
        results[name] = await processName(name, schoolID);
      } catch (e) {
        console.log(`  ERROR ${name}: ${e.message}`);
        results[name] = null;
      }
      done++;
      if (done % 100 === 0) console.log(`  ${done}/${names.length}`);
      await sleep(120);
    }
  }
  await Promise.all(Array.from({ length: WORKERS }, worker));

  // professors_rmp_data.json — keyed by course-data name so frontend lookups hit
  const output = { ...existing };
  for (const name of names) {
    const t = results[name];
    if (!t) continue;
    output[name] = {
      name,
      rmp_name: `${t.firstName.trim()} ${t.lastName.trim()}`,
      avg_rating: t.numRatings > 0 ? Math.round(t.avgRating * 10) / 10 : null,
      avg_difficulty: t.numRatings > 0 ? Math.round(t.avgDifficulty * 10) / 10 : null,
      would_take_again: t.wouldTakeAgainPercent >= 0 ? Math.round(t.wouldTakeAgainPercent) : null,
      department: t.department || 'Unknown',
      total_reviews: t.numRatings,
      rmp_id: String(t.legacyId),
      has_rmp_data: t.numRatings > 0,
    };
  }

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${Object.keys(output).length} matched professors to ${path.basename(OUTPUT_JSON)}`);

  const rated = Object.values(output).filter(p => p.has_rmp_data).length;
  console.log(`  ${rated} with ratings, ${Object.keys(output).length - rated} matched but unrated`);

  const unmatched = allNames.filter(n => !(n in output));
  fs.writeFileSync(
    UNMATCHED_TXT,
    `Professors with no RMP match (${unmatched.length} total):\n` + unmatched.map(n => `- ${n}`).join('\n') + '\n'
  );
  console.log(`${unmatched.length} unmatched -> ${path.basename(UNMATCHED_TXT)}`);

  // keep names.csv IDs for the optional review pipeline (pdcsv.py -> main.py)
  const rows = allNames.map(name => ({ Name: name, ID: output[name]?.rmp_id ?? 'Not Found' }));
  fs.writeFileSync(NAMES_CSV, Papa.unparse(rows));
  console.log(`Updated ${path.basename(NAMES_CSV)} with IDs`);
}

main().catch(e => { console.error(e); process.exit(1); });
