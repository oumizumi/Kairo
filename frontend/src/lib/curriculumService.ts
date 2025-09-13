import conversationContext from '../services/conversationContext';
import { dynamicClassificationService } from './dynamicClassificationService';

export interface CurriculumProgram {
    program: string;
    academicYear: string;
    totalUnits: number;
    notes: string[];
    years?: {
        year: number;
        terms: {
            term: string;
            courses: string[];
        }[];
    }[];
    requirements?: {
        year?: string;
        type?: string;
        courses?: string[];
        Fall?: string[];
        Winter?: string[];
        Summer?: string[];
        [key: string]: any;
    }[];
}

export interface ProgramIndex {
    university: string;
    academicYear: string;
    lastUpdated: string;
    totalPrograms: number;
    programs: {
        id: string;
        name: string;
        code: string;
        faculty: string;
        degree: string;
        file: string;
        hasContent: boolean;
    }[];
}

export interface MatchResult {
    program: CurriculumProgram;
    year: number | 'full' | string;
    term: string;
    courses: string[];
    notes: string[];
    isFullSequence?: boolean;
    isFullYear?: boolean;
    fallCourses?: string[];
    winterCourses?: string[];
    structuredData?: {
        years: {
            year: number;
            terms: {
                term: string;
                courses: string[];
            }[];
        }[];
    };
}

export interface WhenIsCourseResult {
    found: boolean;
    course: string;
    program: string;
    year?: number;
    term?: string;
    message: string;
}

class CurriculumService {
    private programIndex: ProgramIndex | null = null;
    private curriculumCache: Map<string, CurriculumProgram> = new Map();

    // Random emojis for different contexts
    private readonly academicEmojis = ['📚', '📖', '📝', '🎓', '📋', '🔬', '⚡', '🔧', '💻', '🧮', '📐', '⚙️', '🎯', '💡', '🚀'];
    private readonly termEmojis = ['🗓️', '📅', '🌟', '⭐', '🔹', '🔸', '📌', '🎯', '🌀', '⚡'];

    // Get a random emoji from a given array
    private getRandomEmoji(emojiArray: string[]): string {
        return emojiArray[Math.floor(Math.random() * emojiArray.length)];
    }

    // Fallback program matching for when dynamic service doesn't have this method
    private findBestProgramMatchFallback(programName: string): string | null {
        if (!this.programIndex) return null;

        const query = programName.toLowerCase();

        // Try exact name match first
        const exactMatch = this.programIndex.programs.find(p =>
            p.name.toLowerCase() === query
        );
        if (exactMatch) return exactMatch.name;

        // Try partial name match
        const partialMatch = this.programIndex.programs.find(p =>
            p.name.toLowerCase().includes(query) || query.includes(p.name.toLowerCase())
        );
        if (partialMatch) return partialMatch.name;

        // Try code match
        const codeMatch = this.programIndex.programs.find(p =>
            p.code.toLowerCase() === query
        );
        if (codeMatch) return codeMatch.name;

        return null;
    }

    // Term dates configuration
    private readonly termDates = {
        Fall: {
            start: 'Sept 3',
            end: 'Dec 2',
            breaks: ['Oct 12–18']
        },
        Winter: {
            start: 'Jan 12',
            end: 'Apr 15',
            breaks: ['Feb 15–21']
        },
        Summer: {
            start: 'May 5',
            end: 'Jul 29',
            breaks: []
        }
    };

    // Normalize curriculum data to handle all three formats
    private normalizeCurriculum(curriculum: CurriculumProgram): CurriculumProgram & { years: { year: number; terms: { term: string; courses: string[]; }[]; }[] } {
        // If it already has years format, return as is
        if (curriculum.years && curriculum.years.length > 0) {
            return {
                ...curriculum,
                years: curriculum.years
            };
        }

        // If it has requirements format, convert to years format
        if (curriculum.requirements && curriculum.requirements.length > 0) {
            // Check if this is a year-based requirements format (like honours/major programs)
            const hasYearBasedRequirements = curriculum.requirements.some(req => req.year);

            if (hasYearBasedRequirements) {
                // Format 2: Year-based requirements (like honours_political_science.json)
                const years = curriculum.requirements
                    .filter(req => req.year) // Only process items with year property
                    .map(req => {
                        // Parse year number from strings like "1st Year", "2nd Year"
                        const yearMatch = req.year!.match(/(\d+)/);
                        const yearNumber = yearMatch ? parseInt(yearMatch[1]) : 1;

                        const terms = [];

                        // Add Fall term if courses exist
                        if (req.Fall && req.Fall.length > 0) {
                            terms.push({
                                term: 'Fall',
                                courses: req.Fall
                            });
                        }

                        // Add Winter term if courses exist
                        if (req.Winter && req.Winter.length > 0) {
                            terms.push({
                                term: 'Winter',
                                courses: req.Winter
                            });
                        }

                        // Add Summer term if courses exist
                        if (req.Summer && req.Summer.length > 0) {
                            terms.push({
                                term: 'Summer',
                                courses: req.Summer
                            });
                        }

                        return {
                            year: yearNumber,
                            terms
                        };
                    })
                    .filter(year => year.terms.length > 0); // Only include years with courses

                return {
                    ...curriculum,
                    years
                };
            }
        }

        // Fallback: empty years structure
        return {
            ...curriculum,
            years: []
        };
    }

    // Public: expose normalized curriculum without duplicating logic
    public normalizeCurriculumPublic(curriculum: CurriculumProgram): CurriculumProgram & { years: { year: number; terms: { term: string; courses: string[]; }[]; }[] } {
        return this.normalizeCurriculum(curriculum);
    }

    // Load the program index
    async loadProgramIndex(): Promise<void> {
        if (this.programIndex) return;

        try {
            const response = await fetch('/curriculums/index.json');
            if (!response.ok) {
                throw new Error(`Failed to load program index: ${response.status}`);
            }
            this.programIndex = await response.json();
        } catch (error) {
            console.error('Error loading program index:', error);
            throw error;
        }
    }

    // Public: get the loaded program index (loads on demand)
    async getProgramIndex(): Promise<ProgramIndex> {
        await this.loadProgramIndex();
        return this.programIndex!;
    }

    // Load curriculum data from a file
    async loadCurriculumData(filename: string): Promise<CurriculumProgram> {
        if (this.curriculumCache.has(filename)) {
            return this.curriculumCache.get(filename)!;
        }

        try {
            const response = await fetch(`/curriculums/${filename}`);
            if (!response.ok) {
                throw new Error(`Failed to load curriculum ${filename}: ${response.status}`);
            }
            const curriculum: CurriculumProgram = await response.json();
            this.curriculumCache.set(filename, curriculum);
            return curriculum;
        } catch (error) {
            console.error(`Error loading curriculum ${filename}:`, error);
            throw error;
        }
    }

    // Public: best-effort fuzzy program name match using the loaded index
    public async findBestProgramMatch(programText: string): Promise<string | null> {
        await this.loadProgramIndex();
        if (!this.programIndex) return null;

        const query = programText.toLowerCase();
        const queryTokens = query.split(/[^a-z0-9]+/g).filter(Boolean);
        const querySet = new Set(queryTokens);

        // Fast paths: exact name or direct inclusion
        const exact = this.programIndex.programs.find(p => p.name.toLowerCase() === query.trim());
        if (exact) return exact.name;
        const partial = this.programIndex.programs.find(p => query.includes(p.name.toLowerCase()));
        if (partial) return partial.name;

        // Build alias set for each program algorithmically (no hardcoded keywords)
        const buildAliases = (name: string, code: string, faculty?: string, degree?: string): Set<string> => {
            const aliases = new Set<string>();
            const lowerName = name.toLowerCase();

            // Base tokens from name
            const tokens = lowerName.split(/[^a-z0-9]+/g).filter(Boolean);
            for (const t of tokens) {
                aliases.add(t);
                // Prefixes to catch common shorthand (e.g., math -> mathematics)
                if (t.length >= 4) {
                    aliases.add(t.slice(0, 3));
                    aliases.add(t.slice(0, 4));
                }
            }

            // Sub-phrase acronyms based on natural separators
            const subPhrases = lowerName.split(/\band\b|\+|&|,/g);
            for (const phrase of subPhrases) {
                const phraseTokens = phrase.split(/[^a-z0-9]+/g).filter(tok => tok.length >= 3);
                if (phraseTokens.length >= 2) {
                    // Full acronym of the sub-phrase
                    const fullAcr = phraseTokens.map(tok => tok[0]).join('');
                    if (fullAcr.length >= 2) aliases.add(fullAcr);
                    // Sliding-window bigram acronyms (e.g., "computer science" -> "cs")
                    for (let i = 0; i < phraseTokens.length - 1; i++) {
                        const bigramAcr = phraseTokens[i][0] + phraseTokens[i + 1][0];
                        aliases.add(bigramAcr);
                    }
                }
            }

            // Add code tokens (split combined codes as well)
            const codeLower = (code || '').toLowerCase();
            if (codeLower) {
                aliases.add(codeLower);
                for (const part of codeLower.split(/\+|\//g)) {
                    if (part) aliases.add(part);
                }
            }

            // Add faculty and degree tokens to bias matching by meta without hardcoding
            const addMeta = (text?: string) => {
                if (!text) return;
                for (const tok of text.toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean)) {
                    aliases.add(tok);
                }
            };
            addMeta(faculty);
            addMeta(degree);

            // Add smart acronyms (2-letter combos for significant tokens) for short forms like cs, se, me, ee, ps, eco
            const significant = tokens.filter(t => t.length >= 4);
            if (significant.length >= 1) {
                for (let i = 0; i < significant.length; i++) {
                    for (let j = i + 1; j < significant.length; j++) {
                        const two = significant[i][0] + significant[j][0];
                        if (two.length === 2) aliases.add(two);
                    }
                }
            }
            return aliases;
        };

        // Score programs by number of matched tokens; prefer multi-token matches (e.g., cs + math)
        let bestName: string | null = null;
        let bestScore = 0;
        let bestMultiHitBonus = 0;

        for (const p of this.programIndex.programs) {
            const aliases = buildAliases(p.name, p.code, p.faculty, p.degree);
            const nameLower = p.name.toLowerCase();
            const nameTokens = nameLower.split(/[^a-z0-9]+/g).filter(Boolean);
            let score = 0;
            let hits = 0;
            for (const q of querySet) {
                if (aliases.has(q)) {
                    score += 1;
                    hits += 1;
                }
            }
            // Bonus if we covered at least two distinct tokens in the query
            const multiHitBonus = hits >= 2 ? 1 : 0;
            // Soft bonus if query mentions the program's faculty/degree
            let metaBonus = 0;
            const metaTokens = new Set<string>();
            for (const t of (p.faculty || '').toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean)) metaTokens.add(t);
            for (const t of (p.degree || '').toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean)) metaTokens.add(t);
            for (const q of querySet) {
                if (metaTokens.has(q)) metaBonus += 0.5;
            }
            // Strong boost for direct whole-word hits of significant query tokens in the program name
            const significantQueryTokens = Array.from(querySet).filter(t => t.length >= 4);
            let directHitBoost = 0;
            for (const t of significantQueryTokens) {
                if (nameTokens.includes(t)) directHitBoost += 5;
            }
            if (score > 0) {
                if (
                    score + metaBonus + directHitBoost > bestScore ||
                    (score + metaBonus + directHitBoost === bestScore && multiHitBonus > bestMultiHitBonus)
                ) {
                    bestScore = score + metaBonus + directHitBoost;
                    bestMultiHitBonus = multiHitBonus;
                    bestName = p.name;
                }
            }
        }

        return bestName;
    }

    // Parse natural language input using GPT classification
    async parseInput(input: string): Promise<{ program: string; year: number | 'full' | string; term: string } | null> {
        try {
            const result = await dynamicClassificationService.classifyMessage(input);

            if (result.intent === 'when_is_course_taken' || result.intent === 'build_schedule') {
                return {
                    program: result.program || '',
                    year: result.year || 1,
                    term: result.term || 'Fall'
                };
            }

            return null;
        } catch (error) {
            console.error('Failed to parse input with GPT:', error);

            // Fallback to simple parsing
            const normalizedInput = input.toLowerCase().trim();

            // Default extraction
            let year: number | 'full' = 1;
            let term = 'Fall';
            let program = '';

            // Extract year patterns
            const yearPatterns = [
                { pattern: /(?:first|1st|\b1\b|freshman)[\s\-]*year/i, year: 1 },
                { pattern: /(?:second|2nd|\b2\b|sophomore)[\s\-]*year/i, year: 2 },
                { pattern: /(?:third|3rd|\b3\b|junior)[\s\-]*year/i, year: 3 },
                { pattern: /(?:fourth|4th|\b4\b|senior)[\s\-]*year/i, year: 4 },
                { pattern: /(?:fifth|5th|\b5\b)[\s\-]*year/i, year: 5 },
            ];

            for (const { pattern, year: yearNum } of yearPatterns) {
                if (pattern.test(normalizedInput)) {
                    year = yearNum;
                    break;
                }
            }

            // Extract term patterns
            const termPatterns = [
                { pattern: /fall|autumn|september|sept|october|oct|november|nov|december|dec/i, term: 'Fall' },
                { pattern: /winter|january|jan|february|feb|march|mar|april|apr/i, term: 'Winter' },
                { pattern: /summer|may|june|jun|july|jul|august|aug/i, term: 'Summer' }
            ];

            for (const { pattern, term: termName } of termPatterns) {
                if (pattern.test(normalizedInput)) {
                    term = termName;
                    break;
                }
            }

            return { program, year, term };
        }
    }

    // Find when a course is taken in a program
    async findWhenCourseIsTaken(courseCode: string, programName: string): Promise<WhenIsCourseResult> {
        try {
            await this.loadProgramIndex();

            // Use fallback program matching (no longer hardcoded to specific GPT service)
            const matchedProgram = this.findBestProgramMatchFallback(programName);

            if (!matchedProgram) {
                return {
                    found: false,
                    course: courseCode,
                    program: programName,
                    message: `I couldn't find the program "${programName}". Please check the spelling or try a different variation.`
                };
            }

            // Find the program file
            const programEntry = this.programIndex!.programs.find(p => p.name === matchedProgram);
            if (!programEntry || !programEntry.hasContent) {
                return {
                    found: false,
                    course: courseCode,
                    program: matchedProgram,
                    message: `Program "${matchedProgram}" was found but doesn't have curriculum data available yet.`
                };
            }

            // Load curriculum data
            const curriculum = await this.loadCurriculumData(programEntry.file);
            const normalized = this.normalizeCurriculum(curriculum);

            // Search for the course
            for (const yearData of normalized.years) {
                for (const termData of yearData.terms) {
                    // Handle curriculum format where courses are stored as "CSI2110 | Course Title"
                    if (termData.courses.some(course => {
                        const courseCodeOnly = course.split('|')[0].trim().toUpperCase();
                        return courseCodeOnly === courseCode.toUpperCase();
                    })) {
                        // Use AI to generate intelligent timing explanation
                        return this.generateIntelligentTimingResponse(courseCode, matchedProgram, yearData.year, termData.term);
                    }
                }
            }

            return {
                found: false,
                course: courseCode,
                program: matchedProgram,
                message: `${courseCode} was not found in the ${matchedProgram} curriculum. It might be an elective or from a different program.`
            };
        } catch (error) {
            console.error('Error finding course timing:', error);
            return {
                found: false,
                course: courseCode,
                program: programName,
                message: `Sorry, I encountered an error while looking up ${courseCode} in ${programName}. Please try again.`
            };
        }
    }

    // Generate intelligent timing response using AI instead of hardcoded templates
    private async generateIntelligentTimingResponse(courseCode: string, program: string, year: number, term: string): Promise<WhenIsCourseResult> {
        try {
            // Use AI to generate context-aware timing explanation
            const response = await fetch('/api/ai/classify/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: `Generate an intelligent explanation for when ${courseCode} should be taken in ${program} program. It's typically taken in Year ${year}, ${term} term.`,
                    prompt: `You are an academic advisor explaining course timing. Generate a natural, helpful response about when to take ${courseCode} in the ${program} program. Include context about why this timing makes sense (prerequisites, course sequence, etc.). Keep it conversational and informative.

Examples:
- "In ${program}, you'll typically take ${courseCode} in Year ${year} during the ${term} term. This timing works well because..."
- "${courseCode} is scheduled for Year ${year} ${term} in the ${program} program, which gives you time to..."

Be specific about the program and year, and explain the academic reasoning behind this timing.`,
                    context: {
                        recentMessages: [],
                        detectedPatterns: ['course_timing', 'academic_planning'],
                        userPreferences: {
                            preferredPrograms: [program],
                            commonIntents: ['when_is_course_taken'],
                            conversationStyle: 'academic_advisor'
                        }
                    }
                })
            });

            if (response.ok) {
                const result = await response.json();
                return {
                    found: true,
                    course: courseCode,
                    program: program,
                    year: year,
                    term: term,
                    message: result.classification?.reasoning || `In ${program}, ${courseCode} is typically taken in Year ${year}, ${term} term.`
                };
            }
        } catch (error) {
            console.error('AI timing response failed:', error);
        }

        // Fallback to basic but still better than hardcoded response
        return {
            found: true,
            course: courseCode,
            program: program,
            year: year,
            term: term,
            message: `In the ${program} program, ${courseCode} is typically taken in Year ${year} during the ${term} term. This timing aligns with the curriculum structure and prerequisite requirements.`
        };
    }

    // Generate schedule with term inference
    async generateSchedule(input: string): Promise<MatchResult[]> {
        try {
            const classification = await dynamicClassificationService.classifyMessage(input);

            if (classification.intent !== 'build_schedule' || !classification.program) {
                throw new Error('Invalid schedule generation request');
            }

            await this.loadProgramIndex();

            // Find the program
            const programEntry = this.programIndex!.programs.find(p => p.name === classification.program);
            if (!programEntry || !programEntry.hasContent) {
                throw new Error(`Program "${classification.program}" not found or has no curriculum data`);
            }

            // Load curriculum
            const curriculum = await this.loadCurriculumData(programEntry.file);
            const normalized = this.normalizeCurriculum(curriculum);

            const results: MatchResult[] = [];
            const year = classification.year || 1;
            const requestedTerm = classification.term;

            // Find the year data
            const yearData = normalized.years.find(y => y.year === year);
            if (!yearData) {
                throw new Error(`Year ${year} not found in ${classification.program} curriculum`);
            }

            // If no term specified, generate for all available terms
            if (!requestedTerm) {
                const availableTerms = yearData.terms.map(t => t.term);
                const emoji = this.getRandomEmoji(this.academicEmojis);

                for (const termData of yearData.terms) {
                    const termDates = this.termDates[termData.term as keyof typeof this.termDates];
                    let message = `Year ${year} ${termData.term} Schedule for ${classification.program}\n`;
                    message += `${termDates.start} - ${termDates.end}`;
                    if (termDates.breaks.length > 0) {
                        message += ` (Break: ${termDates.breaks.join(', ')})`;
                    }

                    // Extract just the course codes from the full course descriptions
                    const courseCodes = termData.courses.map(course => {
                        // Handle formats like "CEG2136 | Computer Architecture I" or just "CEG2136"
                        const courseCode = course.split(' | ')[0].trim();
                        return courseCode === 'Elective' ? 'Elective' : courseCode;
                    });

                    results.push({
                        program: curriculum,
                        year,
                        term: termData.term,
                        courses: courseCodes,
                        notes: [message, ...curriculum.notes]
                    });
                }
            } else {
                // Generate for specific term
                const termData = yearData.terms.find(t => t.term === requestedTerm);
                if (!termData) {
                    throw new Error(`${requestedTerm} term not found for Year ${year} in ${classification.program}`);
                }

                const termDates = this.termDates[requestedTerm as keyof typeof this.termDates];
                let message = `Year ${year} ${requestedTerm} Schedule for ${classification.program}\n`;
                message += `${termDates.start} - ${termDates.end}`;
                if (termDates.breaks.length > 0) {
                    message += ` (Break: ${termDates.breaks.join(', ')})`;
                }

                // Extract just the course codes from the full course descriptions
                const courseCodes = termData.courses.map(course => {
                    // Handle formats like "CEG2136 | Computer Architecture I" or just "CEG2136"
                    const courseCode = course.split(' | ')[0].trim();
                    return courseCode === 'Elective' ? 'Elective' : courseCode;
                });

                results.push({
                    program: curriculum,
                    year,
                    term: requestedTerm,
                    courses: courseCodes,
                    notes: [message, ...curriculum.notes]
                });
            }

            return results;
        } catch (error) {
            console.error('Error generating schedule:', error);
            throw error;
        }
    }

    // Check which terms exist for a given program and year
    async getAvailableTerms(programName: string, year: number): Promise<string[]> {
        try {
            await this.loadProgramIndex();

            const matchedProgram = this.findBestProgramMatchFallback(programName);
            if (!matchedProgram) return [];

            const programEntry = this.programIndex!.programs.find(p => p.name === matchedProgram);
            if (!programEntry || !programEntry.hasContent) return [];

            const curriculum = await this.loadCurriculumData(programEntry.file);
            const normalized = this.normalizeCurriculum(curriculum);

            const yearData = normalized.years.find(y => y.year === year);
            return yearData ? yearData.terms.map(t => t.term) : [];
        } catch (error) {
            console.error('Error getting available terms:', error);
            return [];
        }
    }

    // Legacy methods for compatibility
    async searchProgram(input: string): Promise<MatchResult[]> {
        const parsed = await this.parseInput(input);
        if (!parsed || !parsed.program) {
            return [];
        }

        return this.generateSchedule(input);
    }

    async matchCurriculum(input: string): Promise<MatchResult | null> {
        try {
            const results = await this.generateSchedule(input);
            return results.length > 0 ? results[0] : null;
        } catch (error) {
            console.error('Error matching curriculum:', error);
            return null;
        }
    }

    async getAllPrograms(): Promise<{ id: string; name: string; code: string; faculty: string; degree: string; }[]> {
        await this.loadProgramIndex();
        return this.programIndex!.programs.map(p => ({
            id: p.id,
            name: p.name,
            code: p.code,
            faculty: p.faculty,
            degree: p.degree
        }));
    }
}

export const curriculumService = new CurriculumService();