import * as cheerio from 'cheerio';

export interface ParsedJobDetails {
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
 * Extract structured fields from a Workday jobDescription HTML blob.
 *
 * Parsing strategy (in priority order):
 *   1. Table rows  <tr><td>Label</td><td>Value</td></tr>
 *   2. Bold labels <p><strong>Label:</strong> Value</p>
 *   3. Plain "Label: Value" text inside <p> and <li> only — NOT <div>,
 *      which causes container text to be concatenated into garbage strings.
 */
export function parseJobDescription(html: string): ParsedJobDetails {
  if (!html) {
    return {
      course_code: null, faculty: null, supervisor: null,
      hourly_rate: null, total_hours: null,
      work_start_date: null, work_end_date: null, language: null,
    };
  }

  const $ = cheerio.load(html);
  const labelMap: Record<string, string> = {};

  // 1. Table rows
  $('tr').each((_, row) => {
    const cells = $(row).find('td, th');
    if (cells.length >= 2) {
      const key = $(cells[0]).text().replace(/:$/, '').trim().toLowerCase();
      const val = $(cells[1]).text().trim();
      if (key && val) labelMap[key] = val;
    }
  });

  // 2. Bold / strong labels inside <p> and <li>
  // e.g. <p><strong>Academic Unit:</strong> Département de français</p>
  $('p, li').each((_, el) => {
    const $el  = $(el);
    const $bold = $el.find('strong, b').first();
    if (!$bold.length) return;
    const key     = $bold.text().replace(/:$/, '').trim().toLowerCase();
    const boldTxt = $bold.text().trim();
    const fullTxt = $el.text().trim();
    const val     = fullTxt.slice(fullTxt.indexOf(boldTxt) + boldTxt.length)
      .replace(/^:?\s*/, '').trim();
    if (key && val && !labelMap[key]) labelMap[key] = val;
  });

  // 3. Plain "Label: Value" — <p> and <li> only, never <div>
  $('p, li').each((_, el) => {
    const $el = $(el);
    if ($el.find('strong, b').length) return; // already handled above
    const text     = $el.text().trim();
    const colonIdx = text.indexOf(':');
    if (colonIdx <= 0 || colonIdx >= 50) return;
    const key = text.slice(0, colonIdx).trim().toLowerCase();
    const val = text.slice(colonIdx + 1).trim();
    // Reject keys that look like mangled container text:
    // only allow letters, spaces, accented chars, slashes — no digits, no extra colons
    if (!key || !val) return;
    if (!/^[a-zA-ZÀ-ÖØ-öø-ÿ\s\/\-]+$/.test(key)) return;
    if (key.split(/\s+/).length > 6) return;
    if (!labelMap[key]) labelMap[key] = val;
  });

  const fullText = $.text().replace(/\s+/g, ' ');

  // Hourly rate
  const hourlyRaw =
    findLabel(labelMap, ['hourly rate', 'taux horaire', 'rate', 'salary', 'wage']) ||
    (fullText.match(/\$\s*(\d+(?:\.\d+)?)\s*(?:\/\s*(?:hour|hr|h)\b)/i)?.[0] ?? null);
  const hourly_rate = parseNum(hourlyRaw);

  // Total hours
  const hoursRaw =
    findLabel(labelMap, ['total hours', 'nombre d\'heures', 'hours', 'work hours', 'number of hours']) ||
    (fullText.match(/(?:total\s+(?:of\s+)?|up\s+to\s+)?(\d+(?:\.\d+)?)\s*hours?\b/i)?.[0] ?? null);
  const total_hours = parseNum(hoursRaw);

  // Course code  e.g. CSI 2110  MAT1320  GNG 1106A
  const courseRaw = findLabel(labelMap, ['course code', 'course number', 'course', 'numéro de cours', 'cours']);
  let course_code: string | null = null;
  const COURSE_RE = /\b([A-Z]{2,4})\s*(\d{4}[A-Z]?)\b/;
  const courseMatch = courseRaw?.match(COURSE_RE) ?? fullText.match(COURSE_RE);
  if (courseMatch) course_code = `${courseMatch[1]} ${courseMatch[2]}`;

  // Faculty / department
  const faculty =
    findLabel(labelMap, ['faculty', 'academic unit', 'department', 'unité académique', 'département', 'school', 'unit of appointment']) ||
    (fullText.match(/(?:faculty|department|faculté|département)\s+of\s+([^\n,;.:]{3,60})/i)?.[1]?.trim() ?? null);

  // Supervisor
  const supervisor =
    findLabel(labelMap, ['supervisor', 'superviseur', 'professor', 'prof', 'instructor', 'pi', 'principal investigator']) ||
    (fullText.match(/(?:supervisor|professor|prof\.?)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/)?.[1]?.trim() ?? null);

  // Dates — labeled fields only (free-form extraction causes false positives from old boilerplate)
  const work_start_date = findLabel(labelMap, ['start date', 'work start', 'date de début', 'commencement', 'begin']) ?? null;
  const work_end_date   = findLabel(labelMap, ['end date', 'work end', 'date de fin', 'completion', 'fin du contrat']) ?? null;

  // Language
  const langRaw = (
    findLabel(labelMap, ['language', 'language of work', 'langue', 'langue de travail']) ||
    fullText.match(
      /(?:language\s+of\s+work|language|langue)\s*:?\s*(English|French|Bilingual|English\s*\/\s*French|French\s*\/\s*English|Anglais|Francais|Français|Bilingue)/i
    )?.[1]?.trim() ||
    null
  );
  const language = normalizeLanguage(langRaw);

  return { course_code, faculty, supervisor, hourly_rate, total_hours, work_start_date, work_end_date, language };
}

function parseNum(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function normalizeLanguage(raw: string | null): string | null {
  if (!raw) return null;
  const l = raw.toLowerCase().trim();
  if (l.includes('/') || l === 'bilingual' || l === 'bilingue') return 'Bilingual';
  if (l === 'french' || l === 'français' || l === 'francais' || l === 'fr') return 'French';
  if (l === 'english' || l === 'anglais' || l === 'en') return 'English';
  if (raw.length <= 20) return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return null;
}

/**
 * Look up a value by trying multiple label candidates.
 * Priority: exact match, then suffix match (e.g. "required start date" matches "start date").
 */
function findLabel(map: Record<string, string>, candidates: string[]): string | null {
  // exact match first
  for (const key of candidates) {
    if (map[key]) return map[key];
  }
  // suffix match: "required start date" ends with " start date"
  for (const key of candidates) {
    for (const mapKey of Object.keys(map)) {
      if (mapKey !== key && mapKey.endsWith(' ' + key) && map[mapKey]) {
        return map[mapKey];
      }
    }
  }
  return null;
}
