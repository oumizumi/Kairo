import api from '@/lib/api';

// Interface for a single course in the sequence
export interface CourseSequenceItem {
    code: string;
    title?: string;
    isElective?: boolean;
    description?: string;
}

// Interface for a term's courses
export interface TermSequence {
    term: string;
    courses: CourseSequenceItem[];
}

// Interface for a year's structure
export interface YearSequence {
    year: number;
    terms: TermSequence[];
}

// Interface for a complete program sequence
export interface ProgramSequence {
    programId: string;
    programName: string;
    degree: string;
    faculty: string;
    academicYear: string;
    totalUnits: number;
    years: YearSequence[];
    notes: string[];
}

// Interface for program index metadata
export interface ProgramMeta {
    id: string;
    name: string;
    code: string;
    faculty: string;
    degree: string;
    file: string;
    hasContent: boolean;
}

// Search result interface
export interface ProgramSearchResult {
    program: ProgramMeta;
    matchScore: number;
    matchReason: string;
}

// Query result interface
export interface ProgramQueryResult {
    success: boolean;
    message: string;
    programSequence?: ProgramSequence;
    yearRequested?: number;
    termRequested?: string;
    isFullSequence?: boolean;
    structuredMessage?: string;
}

class ProgramSequenceService {
    private programIndex: any = null;
    private sequenceCache: Map<string, ProgramSequence> = new Map();
    
    // Term dates for scheduling context


    /**
     * Load the program index if not already loaded
     */
    private async loadProgramIndex(): Promise<void> {
        if (this.programIndex) return;

        try {
            const response = await fetch('/curriculums/index.json');
            if (!response.ok) {
                throw new Error(`Failed to load program index: ${response.status}`);
            }
            this.programIndex = await response.json();
        } catch (error) {
            console.error('Error loading program index:', error);
            throw new Error('Could not load program database');
        }
    }

    /**
     * Get all available programs
     */
    async getAllPrograms(): Promise<ProgramMeta[]> {
        await this.loadProgramIndex();
        return this.programIndex.programs.filter((p: any) => p.hasContent);
    }

    /**
     * Search for programs using semantic matching
     */
    async searchPrograms(query: string): Promise<ProgramSearchResult[]> {
        await this.loadProgramIndex();
        const programs = this.programIndex.programs.filter((p: any) => p.hasContent);
        
        const queryLower = query.toLowerCase().trim();
        const results: ProgramSearchResult[] = [];

        for (const program of programs) {
            const matchResult = this.calculateProgramMatch(program, queryLower);
            if (matchResult.matchScore > 0) {
                results.push({
                    program,
                    matchScore: matchResult.matchScore,
                    matchReason: matchResult.matchReason
                });
            }
        }

        // Sort by match score (highest first)
        return results.sort((a, b) => b.matchScore - a.matchScore);
    }

    /**
     * Calculate how well a program matches a search query
     */
    private calculateProgramMatch(program: any, query: string): { matchScore: number; matchReason: string } {
        const name = program.name.toLowerCase();
        const code = (program.code || '').toLowerCase();
        const faculty = (program.faculty || '').toLowerCase();
        const degree = (program.degree || '').toLowerCase();

        const stop = new Set<string>(['in','of','and','with','the','for','to','a','an','year','yr','fall','winter','summer','autumn','spring','term','co','coop','co-op']);

        // Exact name/code matches
        const trimmedQuery = query.trim();
        if (name === trimmedQuery) return { matchScore: 100, matchReason: 'Exact program name match' };
        if (code && code === trimmedQuery) return { matchScore: 95, matchReason: 'Exact program code match' };

        const tokenize = (s: string) => s.split(/[^a-z0-9]+/g).filter(t => t && t.length >= 3 && !stop.has(t));
        const queryTrim = query.toLowerCase().trim();
        const qTokens = tokenize(query);
        const nTokens = tokenize(name);

        // All filtered query tokens appear as whole tokens in name
        if (qTokens.length > 0 && qTokens.every(q => nTokens.includes(q))) {
            return { matchScore: 90, matchReason: 'All key words match' };
        }

        // Individual token overlap
        const overlap = qTokens.filter(q => nTokens.includes(q)).length;
        if (overlap > 0) {
            const score = 60 + (overlap / Math.max(1, qTokens.length)) * 20;
            return { matchScore: score, matchReason: `${overlap}/${qTokens.length} key words match` };
        }

        // Faculty/degree mentions
        const metaTokens = new Set([...tokenize(faculty), ...tokenize(degree)]);
        const metaOverlap = qTokens.filter(q => metaTokens.has(q)).length;
        if (metaOverlap > 0) {
            return { matchScore: 45 + metaOverlap * 5, matchReason: 'Faculty/degree tokens match' };
        }

        // Alias coverage (allow 2-letter acronyms like 'cs', 'ee', 'se', 'me' ONLY if exact token)
        const aliases = this.getCommonAliases(name, code);
        let aliasHits = 0;
        for (const alias of aliases) {
            if (!alias) continue;
            if (alias.length < 3) {
                // Accept 2-letter acronym only on exact query match
                if (alias.length === 2 && queryTrim === alias) aliasHits += 1;
                continue;
            }
            if (qTokens.includes(alias)) aliasHits += 1;
        }
        if (aliasHits > 0) {
            const bonus = aliasHits >= 2 ? 15 : 0;
            return { matchScore: 65 + bonus, matchReason: `Alias token match (${aliasHits})` };
        }

        return { matchScore: 0, matchReason: 'No match found' };
    }

    /**
     * Get common aliases for a program
     */
    private getCommonAliases(name: string, code: string): string[] {
        const aliases = new Set<string>();
        const lowerName = name.toLowerCase().trim();
        const isGood = (t: string) => t && t.length >= 3;

        // Tokenize program name
        const tokens = lowerName.split(/[^a-z0-9]+/g).filter(isGood);
        for (const t of tokens) {
            aliases.add(t);
            if (t.length >= 5) {
                aliases.add(t.slice(0, 3));
                aliases.add(t.slice(0, 4));
            }
        }

        // Global acronym from significant tokens
        const stop = new Set(['and','of','in','with','the','honours','honors','program','joint','co-op','coop']);
        const sig = tokens.filter(t => !stop.has(t));
        if (sig.length >= 2) {
            const acr = sig.map(t => t[0]).join('');
            if (acr.length >= 2) aliases.add(acr);
            for (let i = 0; i < sig.length - 1; i++) {
                const big = sig[i][0] + sig[i + 1][0];
                if (big.length >= 2) aliases.add(big);
            }
        }

        // Sub-phrase acronyms (handles joint/double)
        const parts = lowerName.split(/\band\b|\+|&|,/g).map(p => p.trim()).filter(Boolean);
        const partAcrs: string[] = [];
        for (const part of parts) {
            const ptokens = part.split(/[^a-z0-9]+/g).filter(isGood);
            if (ptokens.length >= 1) {
                const pacr = ptokens.map(t => t[0]).join('');
                if (pacr.length >= 2) partAcrs.push(pacr);
            }
        }
        for (let i = 0; i < partAcrs.length; i++) {
            for (let j = 0; j < partAcrs.length; j++) {
                if (i === j) continue;
                const a = partAcrs[i];
                const b = partAcrs[j];
                if (a.length >= 2 && b.length >= 2) {
                    aliases.add(`${a}${b}`);
                    aliases.add(`${a} ${b}`);
                    aliases.add(`${a}+${b}`);
                    aliases.add(`${a}&${b}`);
                    aliases.add(`${a}/${b}`);
                }
            }
        }

        // Program code variants (e.g., CSI+MAT)
        const codeLower = (code || '').toLowerCase();
        if (codeLower) {
            if (isGood(codeLower)) aliases.add(codeLower);
            for (const part of codeLower.split(/\+|\//g)) {
                if (part && isGood(part)) aliases.add(part);
            }
        }

        return Array.from(aliases);
    }

    /**
     * Load a specific program sequence
     */
    async loadProgramSequence(programFile: string): Promise<ProgramSequence> {
        if (this.sequenceCache.has(programFile)) {
            return this.sequenceCache.get(programFile)!;
        }

        try {
            const response = await fetch(`/curriculums/${programFile}`);
            if (!response.ok) {
                throw new Error(`Failed to load program sequence: ${response.status}`);
            }
            
            const rawData = await response.json();
            const sequence = this.normalizeProgramSequence(rawData, programFile);
            
            this.sequenceCache.set(programFile, sequence);
            return sequence;
        } catch (error) {
            console.error(`Error loading program sequence ${programFile}:`, error);
            throw new Error(`Could not load program sequence for ${programFile}`);
        }
    }

    /**
     * Normalize raw curriculum data into standard format
     */
    private normalizeProgramSequence(rawData: any, programFile: string): ProgramSequence {
        const years: YearSequence[] = [];

        // Handle the standard "years" format used by most programs
        if (rawData.years && Array.isArray(rawData.years)) {
            for (const yearData of rawData.years) {
                const terms: TermSequence[] = [];
                
                for (const termData of yearData.terms) {
                    const courses: CourseSequenceItem[] = termData.courses.map((course: string) => {
                        // Handle "CSI2110 | Course Title" format or just "CSI2110"
                        const parts = course.split(' | ');
                        const code = parts[0].trim();
                        const title = parts[1]?.trim();
                        
                        return {
                            code,
                            title,
                            isElective: code.toLowerCase().includes('elective'),
                            description: title
                        };
                    });

                    terms.push({
                        term: termData.term,
                        courses
                    });
                }
                
                years.push({
                    year: yearData.year,
                    terms
                });
            }
        }
        
        // Handle "requirements" format (used by some programs)
        else if (rawData.requirements && Array.isArray(rawData.requirements)) {
            const yearMap = new Map<number, TermSequence[]>();
            
            for (const req of rawData.requirements) {
                if (req.year) {
                    // Parse year from strings like "1st Year", "2nd Year"
                    const yearMatch = req.year.match(/(\d+)/);
                    const yearNumber = yearMatch ? parseInt(yearMatch[1]) : 1;
                    
                    if (!yearMap.has(yearNumber)) {
                        yearMap.set(yearNumber, []);
                    }
                    
                    const terms = yearMap.get(yearNumber)!;
                    
                    // Add terms if they have courses
                    ['Fall', 'Winter', 'Summer'].forEach(termName => {
                        if (req[termName] && req[termName].length > 0) {
                            const courses: CourseSequenceItem[] = req[termName].map((course: string) => ({
                                code: course.trim(),
                                isElective: course.toLowerCase().includes('elective')
                            }));
                            
                            terms.push({
                                term: termName,
                                courses
                            });
                        }
                    });
                }
            }
            
            // Convert map to array
            for (const [yearNumber, terms] of yearMap) {
                years.push({ year: yearNumber, terms });
            }
        }

        return {
            programId: programFile.replace('.json', ''),
            programName: rawData.program || 'Unknown Program',
            degree: this.extractDegreeFromName(rawData.program || ''),
            faculty: 'Unknown Faculty', // This would be filled from the index
            academicYear: rawData.academicYear || '2025-2026',
            totalUnits: rawData.totalUnits || 120,
            years: years.sort((a, b) => a.year - b.year),
            notes: rawData.notes || []
        };
    }

    /**
     * Extract degree type from program name
     */
    private extractDegreeFromName(programName: string): string {
        const name = programName.toLowerCase();
        if (name.includes('honours bsc') || name.includes('honours b.sc')) return 'Honours BSc';
        if (name.includes('honours ba') || name.includes('honours b.a')) return 'Honours BA';
        if (name.includes('honours bhk')) return 'Honours BHK';
        if (name.includes('honours bhsc')) return 'Honours BHSc';
        if (name.includes('basc') || name.includes('b.a.sc')) return 'BASc';
        if (name.includes('bsc') || name.includes('b.sc')) return 'BSc';
        if (name.includes('ba') || name.includes('b.a')) return 'BA';
        if (name.includes('minor')) return 'Minor';
        if (name.includes('master')) return 'Master';
        if (name.includes('phd') || name.includes('doctor')) return 'PhD';
        return 'Undergraduate';
    }

    /**
     * Process a natural language query about program sequences
     */
    async processQuery(query: string): Promise<ProgramQueryResult> {
        try {
            // Use AI to understand the query intent
            const interpretation = await this.interpretQuery(query);
            
            if (!interpretation.programName) {
                return {
                    success: false,
                    message: "I couldn't identify which program you're asking about. Could you specify a program like 'Computer Science', 'Software Engineering', or 'Data Science'?"
                };
            }

            // Always search using BOTH the raw query and the interpreted program name (if any)
            const rawQuery = query;
            const searchResultsFromRaw = await this.searchPrograms(rawQuery);
            const searchResultsFromInterpreted = interpretation.programName
                ? await this.searchPrograms(interpretation.programName)
                : [];

            // Merge and dedupe
            const mergedMap = new Map<string, ProgramSearchResult>();
            for (const r of [...searchResultsFromRaw, ...searchResultsFromInterpreted]) {
                const key = r.program.file;
                if (!mergedMap.has(key)) {
                    mergedMap.set(key, r);
                } else {
                    // Keep the higher score if duplicate
                    const existing = mergedMap.get(key)!;
                    if (r.matchScore > existing.matchScore) mergedMap.set(key, r);
                }
            }
            let mergedResults = Array.from(mergedMap.values());

            // Re-rank to prefer candidates whose aliases cover tokens in the RAW query (not just when connectors are present)
            const queryTokensAll = rawQuery.toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean);
            const stop = new Set<string>([
                'year','yrs','yr','fall','winter','summer','autumn','spring','term','co','coop','co-op','program','degree','honours','honors','bsc','ba','basc','bhsc','major','minor','option','with','and','of','in','for','the','third','3rd','second','2nd','first','1st','fourth','4th'
            ]);
            const queryTokens = queryTokensAll.filter(t => t.length > 2 && !stop.has(t));
            const tokenSet = new Set(queryTokens);
            const queryParts = rawQuery.toLowerCase().split(/\band\b|\+|&|\//g).map(p => p.trim()).filter(Boolean);

            const partCoverage = (name: string, code: string) => {
                // Build alias set from program name and code
                const aliases = new Set(this.getCommonAliases(name, code));
                const nameTokens = name.toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean);
                for (const t of nameTokens) aliases.add(t);

                let covered = 0;
                for (const qp of queryParts) {
                    const ptokens = qp.split(/[^a-z0-9]+/g).filter(Boolean);
                    const acr = ptokens.map(t => t[0]).join('');
                    const hit = ptokens.some(t => aliases.has(t) || aliases.has(t.slice(0,4))) || (acr && aliases.has(acr));
                    if (hit) covered++;
                }
                return covered;
            };

            // Prefer candidates that cover many tokens from the raw query; also handle joint programs when connectors exist
            const hasConnectors = /\b(and|&)\b|\+|\//i.test(rawQuery);
            const boosted = mergedResults.map(r => {
                const coveredParts = partCoverage(r.program.name, r.program.code);
                // Token coverage across aliases and name tokens
                const aliases = new Set(this.getCommonAliases(r.program.name, r.program.code));
                for (const t of r.program.name.toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean)) aliases.add(t);
                let tokenCoverage = 0;
                for (const t of tokenSet) {
                    if (aliases.has(t) || Array.from(aliases).some(a => a.includes(t) || t.includes(a))) tokenCoverage++;
                }
                let score = r.matchScore + tokenCoverage * 20;
                if (hasConnectors) {
                    if (coveredParts >= 2) score += 100; else score -= 20;
                }
                // Penalize joint/double programs when the query does NOT include multiple subjects
                const nameLower = r.program.name.toLowerCase();
                const codeLower = (r.program.code || '').toLowerCase();
                const looksJoint = /\bjoint\b/.test(nameLower) || /\band\b|\+|\//.test(nameLower) || codeLower.includes('+') || codeLower.includes('/');
                if (!hasConnectors && looksJoint) {
                    score -= 60; // prefer single-subject program for single-subject queries
                }
                return { ...r, matchScore: score, _covered: coveredParts, _tokenCoverage: tokenCoverage } as any;
            }).sort((a, b) => b.matchScore - a.matchScore);

            // If any candidate covers 2+ parts, pick among those, else use boosted order
            const withCoverage = boosted.filter((r: any) => r._covered >= 2);
            const finalResults = withCoverage.length > 0 ? withCoverage : boosted;

            // Prefer candidates that have at least some token coverage from the raw query
            const tokenPositive = finalResults.filter((r: any) => (r as any)._tokenCoverage > 0);
            
            if (mergedResults.length === 0) {
                return {
                    success: false,
                    message: `I couldn't find a program matching your query. Would you like to see all available programs?`
                };
            }

            // Take the best match
            let bestMatch = (tokenPositive.length > 0 ? tokenPositive : finalResults)[0];
            let programSequence: ProgramSequence | null = null;
            try {
                programSequence = await this.loadProgramSequence(bestMatch.program.file);
            } catch (e) {
                // Index might be stale; reload and retry with fresh file mapping for the same program id/name
                this.programIndex = null;
                await this.loadProgramIndex();
                const fresh = (this.programIndex?.programs || []).find((p: any) => p.id === bestMatch.program.id || p.name === bestMatch.program.name);
                if (fresh && fresh.file && fresh.file !== bestMatch.program.file) {
                    bestMatch = { ...bestMatch, program: fresh } as any;
                    programSequence = await this.loadProgramSequence(fresh.file);
                } else {
                    throw e;
                }
            }
            if (!programSequence || !programSequence.years) {
                throw new Error(`Curriculum file not found or invalid: ${bestMatch.program.file}`);
            }
            
            // Fill metadata from index (no string heuristics)
            programSequence.faculty = bestMatch.program.faculty;
            programSequence.degree = bestMatch.program.degree;
            
            // Format response based on what was requested
            const structuredMessage = this.formatProgramResponse(
                programSequence, 
                interpretation.year, 
                interpretation.term,
                interpretation.intent
            );

            return {
                success: true,
                message: structuredMessage,
                programSequence,
                yearRequested: interpretation.year || undefined,
                termRequested: interpretation.term || undefined,
                isFullSequence: !interpretation.year && !interpretation.term,
                structuredMessage
            };

        } catch (error) {
            console.error('Error processing program query:', error);
            return {
                success: false,
                message: "Sorry, I encountered an error while looking up that program. Please try again."
            };
        }
    }

    /**
     * Use AI to interpret the user's query
     */
    private async interpretQuery(query: string): Promise<{
        programName: string | null;
        year: number | null;
        term: string | null;
        intent: string;
    }> {
        try {
            // Inject live catalog to avoid hardcoded mappings
            if (!this.programIndex) {
                await this.loadProgramIndex();
            }
            const available = (this.programIndex?.programs || []).filter((p: any) => p.hasContent);
            const catalogList = available
                .map((p: any) => `- ${p.name} | ${p.code} | ${p.faculty} | ${p.degree}`)
                .join('\n');

            const response = await api.post('/api/ai/classify/', {
                message: query,
                prompt: `Analyze this query about university program course sequences. Extract:

1. Program name (choose ONLY from the provided catalog by exact name)
2. Year number (1, 2, 3, 4, 5, or null if asking for full program)
3. Term ("Fall", "Winter", "Summer", or null if asking for full year)
4. Intent (e.g., "full_sequence", "specific_year", "specific_term")

Catalog of available programs (name | code | faculty | degree):
${catalogList}

Rules:
- programName must be EXACTLY one of the names in the catalog above; if none clearly fits, set programName to null.
- Do not invent or guess program names that are not in the catalog.

Examples:
- "show me computer science" → program: "Honours BSc in Computer Science", year: null, term: null, intent: "full_sequence"
- "CS year 2 winter" → program: "Honours BSc in Computer Science", year: 2, term: "Winter", intent: "specific_term"  
- "health sci 3rd year fall" → program: "Honours Bachelor of Health Sciences", year: 3, term: "Fall", intent: "specific_term"

Return JSON format: {"programName": "...", "year": number|null, "term": "..."|null, "intent": "..."}`,
                model: 'gpt-4o-mini',
                temperature: 0.1,
                max_tokens: 200
            });

            const result = response.data.classification || response.data.raw_content;
            
            try {
                const parsed = JSON.parse(result);
                return {
                    programName: parsed.programName,
                    year: parsed.year,
                    term: parsed.term,
                    intent: parsed.intent || 'full_sequence'
                };
            } catch (parseError) {
                // Fallback parsing
                return await this.fallbackQueryParsing(query);
            }

        } catch (error) {
            console.error('AI query interpretation failed:', error);
            return await this.fallbackQueryParsing(query);
        }
    }

    /**
     * Fallback query parsing when AI is unavailable - uses dynamic program matching
     */
    private async fallbackQueryParsing(query: string): Promise<{
        programName: string | null;
        year: number | null;
        term: string | null;
        intent: string;
    }> {
        const queryLower = query.toLowerCase();
        
        // Extract program name using dynamic search
        let programName: string | null = null;
        
        try {
            // Load program index if not already loaded
            if (!this.programIndex) {
                await this.loadProgramIndex();
            }
            
            // Use the dynamic program search
            const searchResults = await this.searchPrograms(queryLower);
            
            if (searchResults.length > 0 && searchResults[0].matchScore >= 50) {
                programName = searchResults[0].program.name;
    
            }
        } catch (error) {
            console.error('Error in dynamic program search fallback:', error);
            // Continue with manual parsing if dynamic search fails
        }
        
        // Extract year
        let year: number | null = null;
        const yearPatterns = [
            { pattern: /(?:year\s*)?1|first year|1st year/i, year: 1 },
            { pattern: /(?:year\s*)?2|second year|2nd year/i, year: 2 },
            { pattern: /(?:year\s*)?3|third year|3rd year/i, year: 3 },
            { pattern: /(?:year\s*)?4|fourth year|4th year/i, year: 4 },
            { pattern: /(?:year\s*)?5|fifth year|5th year/i, year: 5 },
        ];
        
        for (const { pattern, year: yearNum } of yearPatterns) {
            if (pattern.test(queryLower)) {
                year = yearNum;
                break;
            }
        }
        
        // Extract term
        let term: string | null = null;
        if (/fall|autumn|september|sept/i.test(queryLower)) term = 'Fall';
        else if (/winter|january|january/i.test(queryLower)) term = 'Winter';
        else if (/summer|may|june|july|august/i.test(queryLower)) term = 'Summer';
        
        const intent = year && term ? 'specific_term' : year ? 'specific_year' : 'full_sequence';
        
        return { programName, year, term, intent };
    }

    /**
     * Format the program response in a readable way
     */
    private formatProgramResponse(
        program: ProgramSequence, 
        year: number | null, 
        term: string | null,
        intent: string
    ): string {
        let response = `## ${program.programName}\n`;
        response += `**${program.degree}** • ${program.faculty} • ${program.totalUnits} units\n\n`;

        if (year && term) {
            // Specific term requested
            const yearData = program.years.find(y => y.year === year);
            const termData = yearData?.terms.find(t => t.term === term);
            
            if (termData) {
                response += `### Year ${year} - ${term} Term\n`;

                response += '\n**Courses:**\n';
                termData.courses.forEach((course) => {
                    response += `- ${course.code}`;
                    if (course.title) {
                        response += ` - ${course.title}`;
                    }
                    response += '\n';
                });
            } else {
                response += `Year ${year} ${term} term is not available for this program.`;
            }
        } else if (year) {
            // Specific year requested
            const yearData = program.years.find(y => y.year === year);
            
            if (yearData) {
                response += `### Year ${year}\n\n`;
                
                yearData.terms.forEach(termData => {
                    response += `**${termData.term} Term**\n`;
                    termData.courses.forEach(course => {
                        response += `- ${course.code}`;
                        if (course.title) {
                            response += ` - ${course.title}`;
                        }
                        response += '\n';
                    });
                    response += '\n';
                });
            } else {
                response += `Year ${year} is not available for this program.`;
            }
        } else {
            // Full program sequence
            response += `### Complete Course Sequence\n\n`;
            
            program.years.forEach(yearData => {
                response += `## Year ${yearData.year}\n\n`;
                
                yearData.terms.forEach(termData => {
                    response += `### ${termData.term} Term\n`;
                    termData.courses.forEach(course => {
                        response += `- ${course.code}`;
                        if (course.title) {
                            response += ` - ${course.title}`;
                        }
                        response += '\n';
                    });
                    response += '\n';
                });
            });
        }

        // Add important notes
        if (program.notes && program.notes.length > 0) {
            response += '\n### Important Notes\n';
            program.notes.forEach(note => {
                response += `• ${note}\n`;
            });
        }

        return response;
    }
}

export const programSequenceService = new ProgramSequenceService();