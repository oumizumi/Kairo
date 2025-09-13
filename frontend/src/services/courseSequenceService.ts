import { curriculumService, CurriculumProgram, ProgramIndex } from '@/lib/curriculumService';

// Define interfaces for course sequence data
export interface Course {
  code: string;
  name: string;
  credits: number;
  description?: string;
  prerequisites?: string[];
}

export interface TermCourses {
  required: Course[];
  electives?: Course[];
}

export interface YearSequence {
  fall?: TermCourses;
  winter?: TermCourses;
  summer?: TermCourses;
}

export interface ProgramSequence {
  name: string;
  description?: string;
  years: {
    [key: number]: YearSequence;
  };
}

// Type for all available program sequences
export interface ProgramSequences {
  [key: string]: ProgramSequence;
}

// Dynamic registry populated from curriculums at runtime (no hardcoding)
let dynamicProgramSequences: ProgramSequences | null = null;

async function buildDynamicProgramSequences(): Promise<ProgramSequences> {
  if (dynamicProgramSequences) return dynamicProgramSequences;

  const index: ProgramIndex = await curriculumService.getProgramIndex();
  const registry: ProgramSequences = {};

  // Load and normalize every program with content
  const loadPromises = index.programs
    .filter(p => p.hasContent && p.file)
    .map(async (p) => {
      const curriculum: CurriculumProgram = await curriculumService.loadCurriculumData(p.file);
      const normalized = curriculumService.normalizeCurriculumPublic(curriculum);

      // Build YearSequence from normalized data
      const years: { [key: number]: YearSequence } = {};
      for (const y of normalized.years) {
        const yearNum = y.year;
        const yearSeq: YearSequence = {};
        for (const t of y.terms) {
          const termKey = t.term.toLowerCase() as keyof YearSequence;
          // Extract course codes; separate obvious choice/optional groups into electives
          const requiredSet = new Set<string>();
          const electiveSet = new Set<string>();
          for (const entry of t.courses) {
            if (typeof entry !== 'string') continue;
            const text = entry as string;
            const isChoiceOrOptional = /(\b\d+\s*(from|course|courses)\b|optional|recommended|one of|choose)/i.test(text);
            const regex = /\b([A-Z]{2,6})\s?([0-9]{4})\b/g;
            let m: RegExpExecArray | null;
            while ((m = regex.exec(text)) !== null) {
              const code = `${m[1]}${m[2]}`;
              if (isChoiceOrOptional) {
                electiveSet.add(code);
              } else {
                requiredSet.add(code);
              }
            }
          }
          const requiredCourses: Course[] = Array.from(requiredSet).map((code) => ({ code, name: '', credits: 0 }));
          const electiveCourses: Course[] = Array.from(electiveSet).map((code) => ({ code, name: '', credits: 0 }));
          yearSeq[termKey] = electiveCourses.length > 0 ? { required: requiredCourses, electives: electiveCourses } : { required: requiredCourses };
        }
        years[yearNum] = yearSeq;
      }

      // Key by normalized program name (lowercase)
      registry[p.name.toLowerCase()] = {
        name: p.name,
        description: '',
        years,
      } as ProgramSequence;
    });

  await Promise.all(loadPromises);
  dynamicProgramSequences = registry;
  return registry;
}

/**
 * Natural language processing to extract program name, year, and term from user query
 * @param query The user's query string
 * @returns Object containing extracted program, year, and term
 */
export function extractProgramInfo(query: string): { program: string | null; year: number | null; term: string | null } {
  // Convert query to lowercase for case-insensitive matching
  const lowerQuery = query.toLowerCase();
  
  // Extract program name using natural language processing
  let program: string | null = null;
  // Avoid hardcoded keywords: try fuzzy match against dynamic program names
  if (dynamicProgramSequences) {
    const names = Object.keys(dynamicProgramSequences);
    program = names.find(n => lowerQuery.includes(n)) || null;
    if (!program) {
      // token overlap match
      const tokens = new Set(lowerQuery.split(/[^a-z0-9]+/g).filter(Boolean));
      let best: { name: string; score: number } | null = null;
      for (const name of names) {
        const nameTokens = new Set(name.split(/[^a-z0-9]+/g).filter(Boolean));
        const overlap = [...tokens].filter(t => nameTokens.has(t)).length;
        if (overlap > 0 && (!best || overlap > best.score)) best = { name, score: overlap };
      }
      program = best?.name || null;
    }
  }
  
  // Extract year using regex pattern matching
  let year: number | null = null;
  const yearMatch = lowerQuery.match(/year\s*(\d+)|(\d+)(?:st|nd|rd|th)\s*year/i);
  if (yearMatch) {
    year = parseInt(yearMatch[1] || yearMatch[2], 10);
  }
  
  // Extract term using pattern matching
  let term: string | null = null;
  if (dynamicProgramSequences) {
    const termNames = new Set<string>();
    for (const prog of Object.values(dynamicProgramSequences)) {
      for (const year of Object.values(prog.years)) {
        for (const k of Object.keys(year)) {
          termNames.add(k.toLowerCase());
        }
      }
    }
    for (const t of termNames) {
      if (lowerQuery.includes(t)) {
        term = t;
        break;
      }
    }
  }
  
  return { program, year, term };
}

/**
 * Get course sequence for a specific program, year, and term
 * @param program The program name
 * @param year The academic year (1-4)
 * @param term The academic term (fall, winter, summer)
 * @returns The courses for the specified program, year, and term, or null if not found
 */
export function getCourseSequence(
  program: string,
  year: number,
  term: string
): TermCourses | null {
  // Normalize inputs
  const normalizedProgram = program.toLowerCase();
  const normalizedTerm = term.toLowerCase();
  
  // Check if program exists
  if (!dynamicProgramSequences || !(normalizedProgram in dynamicProgramSequences)) {
    return null;
  }
  
  // Check if year exists for the program
  const programData = dynamicProgramSequences![normalizedProgram];
  if (!programData.years[year]) {
    return null;
  }
  
  // Check if term exists for the year
  const yearData = programData.years[year];
  if (!yearData[normalizedTerm as keyof YearSequence]) {
    return null;
  }
  
  // Return the course sequence
  return yearData[normalizedTerm as keyof YearSequence] || null;
}

/**
 * Check if a program is available in the system
 * @param program The program name to check
 * @returns True if the program is available, false otherwise
 */
export function isProgramAvailable(program: string): boolean {
  if (!dynamicProgramSequences) return false;
  return !!dynamicProgramSequences[program.toLowerCase()];
}

/**
 * Get all available program names
 * @returns Array of available program names
 */
export function getAvailablePrograms(): string[] {
  if (!dynamicProgramSequences) return [];
  return Object.values(dynamicProgramSequences).map(program => program.name);
}

export async function getAvailableProgramsAsync(): Promise<string[]> {
  await buildDynamicProgramSequences();
  return Object.values(dynamicProgramSequences!).map(program => program.name);
}

/**
 * Format course sequence data for display
 * @param courses The course sequence data to format
 * @returns Formatted string representation of the course sequence
 */
export function formatCourseSequence(courses: TermCourses): string {
  let result = '';
  
  if (courses.required && courses.required.length > 0) {
    result += 'Required Courses:\n';
    courses.required.forEach(course => {
      result += `- ${course.code}: ${course.name} (${course.credits} credits)\n`;
    });
  }
  
  if (courses.electives && courses.electives.length > 0) {
    result += '\nElective Courses:\n';
    courses.electives.forEach(course => {
      result += `- ${course.code}: ${course.name} (${course.credits} credits)\n`;
    });
  }
  
  return result;
}

/**
 * Process a user query about course sequences
 * @param query The user's query string
 * @returns Response object with status and formatted data or error message
 */
export function processCourseSequenceQuery(query: string): { 
  success: boolean; 
  message: string;
  programName?: string;
  year?: number;
  term?: string;
  courses?: TermCourses;
} {
  // Ensure dynamic registry is built synchronously via blocking promise access
  // Note: Upstream callers should prefer the async variant for reliability
  // This fallback will return a helpful message if registry is not ready
  if (!dynamicProgramSequences) {
    return {
      success: false,
      message: 'Program catalog is still loading. Please try again in a moment.'
    };
  }
  // Extract program info from query
  const { program, year, term } = extractProgramInfo(query);
  
  // Check if we could extract all required information
  if (!program) {
    return { 
      success: false, 
      message: "I couldn't identify a program in your query. Please specify a program like Computer Science, Software Engineering, or Data Science."
    };
  }
  
  if (!year) {
    return { 
      success: false, 
      message: `I found the ${dynamicProgramSequences![program]?.name || program} program, but couldn't determine which year you're asking about. Please specify a year (e.g., year 1, 2nd year).`
    };
  }
  
  if (!term) {
    return { 
      success: false, 
      message: `I found the ${dynamicProgramSequences![program]?.name || program} program for year ${year}, but couldn't determine which term you're asking about. Please specify a term (Fall, Winter, or Summer).`
    };
  }
  
  // Check if the program is available
  if (!isProgramAvailable(program)) {
    return { 
      success: false, 
      message: `The ${program} program is not available yet. More programs will be added soon!`
    };
  }
  
  // Get the course sequence
  const courses = getCourseSequence(program, year, term);
  
  // Check if the course sequence exists
  if (!courses) {
    return { 
      success: false, 
      message: `I couldn't find course information for ${dynamicProgramSequences![program].name}, Year ${year}, ${term.charAt(0).toUpperCase() + term.slice(1)} term. This information may not be available yet.`
    };
  }
  
  // Return success with the course sequence
  return { 
    success: true, 
    message: `Here are the courses for ${dynamicProgramSequences![program].name}, Year ${year}, ${term.charAt(0).toUpperCase() + term.slice(1)} term:`,
    programName: dynamicProgramSequences![program].name,
    year,
    term,
    courses
  };
}

// Async variant for consumers: ensures registry is built and returns enriched data
export async function processCourseSequenceQueryAsync(query: string): Promise<{ 
  success: boolean; 
  message: string;
  programName?: string;
  year?: number;
  term?: string;
  courses?: TermCourses;
}> {
  await buildDynamicProgramSequences();
  // Prefer sync flow, but augment program detection with fuzzy fallback
  let { program, year, term } = extractProgramInfo(query);
  if (!program) {
    const matched = await curriculumService.findBestProgramMatch(query);
    if (matched) program = matched.toLowerCase();
  }
  // If program still ambiguous, try matching only the program phrase by stripping year/term hints
  if (!program) {
    const stripped = query
      .replace(/\b(1st|2nd|3rd|4th|year|yr|fall|winter|summer|autumn|spring|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/gi, ' ')
      .replace(/\b(year\s*\d)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const matched = await curriculumService.findBestProgramMatch(stripped);
    if (matched) program = matched.toLowerCase();
  }
  if (!program || !year || !term) {
    // Defer to sync handler for consistent messaging
    return processCourseSequenceQuery(query);
  }
  const courses = getCourseSequence(program, year, term);
  if (!courses) {
    return {
      success: false,
      message: `I couldn't find course information for ${dynamicProgramSequences![program].name}, Year ${year}, ${term.charAt(0).toUpperCase() + term.slice(1)} term. This information may not be available yet.`
    };
  }
  return {
    success: true,
    message: `Here are the courses for ${dynamicProgramSequences![program].name}, Year ${year}, ${term.charAt(0).toUpperCase() + term.slice(1)} term:`,
    programName: dynamicProgramSequences![program].name,
    year,
    term,
    courses
  };
}