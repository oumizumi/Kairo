interface ClassificationResult {
    intent: string;
    course?: string;
    program?: string;
    year?: number | 'full';
    term?: string;
    confidence: number;
    reasoning?: string;
}

export class DynamicClassificationService {
    private programs: Array<{ name: string; code?: string }> = [];

    async loadPrograms(): Promise<void> {
        try {
            const response = await fetch('/curriculums/index.json');
            const index = await response.json();
            this.programs = index.programs || [];
        } catch (error) {
            console.error('Failed to load program index:', error);
            this.programs = [];
        }
    }

    async classifyMessage(message: string): Promise<ClassificationResult> {
        if (this.programs.length === 0) {
            await this.loadPrograms();
        }

        const normalized = message.toLowerCase();
        const course = this.extractCourseCode(message);
        const term = this.extractTerm(normalized);
        const year = this.extractYear(normalized);
        const program = this.extractProgram(normalized);

        let intent = 'general_chat';
        let confidence = 0.3;
        let reasoning = 'Default fallback';

        if (/(build|generate|create)\s+(a\s+)?schedule/.test(normalized)) {
            intent = 'build_schedule';
            confidence = 0.7;
            reasoning = 'Detected schedule creation request';
        } else if (/when\s+is/.test(normalized) && course) {
            intent = 'when_is_course_taken';
            confidence = 0.6;
            reasoning = 'Detected course timing question';
        } else if (/(program|sequence|curriculum|degree)/.test(normalized)) {
            intent = 'program_sequence';
            confidence = 0.6;
            reasoning = 'Detected program/sequence request';
        } else if (/(prereq|prerequisite|about|description|details|info)/.test(normalized) && course) {
            intent = 'course_info';
            confidence = 0.6;
            reasoning = 'Detected course info request';
        } else if (course) {
            intent = 'course_info';
            confidence = 0.5;
            reasoning = 'Detected course code mention';
        }

        return {
            intent,
            course: course || undefined,
            program: program || undefined,
            year: year || undefined,
            term: term || undefined,
            confidence,
            reasoning
        };
    }

    private extractCourseCode(text: string): string | null {
        const match = text.toUpperCase().match(/\b([A-Z]{2,4})\s*(\d{3,4})\b/);
        if (!match) return null;
        return `${match[1]} ${match[2]}`;
    }

    private extractTerm(text: string): string | undefined {
        if (/fall|autumn|sept|oct|nov|dec/.test(text)) return 'Fall';
        if (/winter|jan|feb|mar|apr/.test(text)) return 'Winter';
        if (/summer|spring|may|jun|jul|aug/.test(text)) return 'Summer';
        return undefined;
    }

    private extractYear(text: string): number | undefined {
        if (/(first|1st|\b1\b).*year/.test(text)) return 1;
        if (/(second|2nd|\b2\b).*year/.test(text)) return 2;
        if (/(third|3rd|\b3\b).*year/.test(text)) return 3;
        if (/(fourth|4th|\b4\b).*year/.test(text)) return 4;
        if (/(fifth|5th|\b5\b).*year/.test(text)) return 5;
        return undefined;
    }

    private extractProgram(text: string): string | undefined {
        if (this.programs.length === 0) return undefined;

        const normalized = text.toLowerCase();
        let bestMatch: { name: string; score: number } | null = null;

        for (const program of this.programs) {
            const name = program.name?.toLowerCase() || '';
            const code = program.code?.toLowerCase() || '';
            let score = 0;

            if (code && normalized.includes(code)) score += 2;
            if (name && normalized.includes(name)) score += 3;

            if (score > 0 && (!bestMatch || score > bestMatch.score)) {
                bestMatch = { name: program.name, score };
            }
        }

        return bestMatch ? bestMatch.name : undefined;
    }
}

export const dynamicClassificationService = new DynamicClassificationService();
