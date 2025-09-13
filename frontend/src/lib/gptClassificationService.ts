import api from './api';

interface ClassificationResult {
  intent: string;
  course?: string;
  program?: string;
  year?: number | 'full';
  term?: string;
  confidence: number;
}

interface ProgramInfo {
  id: string;
  name: string;
  code: string;
  faculty: string;
  degree: string;
  file: string;
  hasContent: boolean;
}

export class GPTClassificationService {
  private programs: ProgramInfo[] = [];

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

    const prompt = this.buildClassificationPrompt(message);

    try {
      const response = await api.post('/api/ai/classify/', {
        message: message,
        prompt: prompt,
        programs: this.programs.map(p => ({ name: p.name, code: p.code }))
      });

      return this.parseClassificationResult(response.data.classification);
    } catch (error) {
      console.error('GPT classification failed:', error);
      return this.fallbackClassification(message);
    }
  }

  private buildClassificationPrompt(message: string): string {
    const programList = this.programs.map(p => `- ${p.name} (${p.code})`).join('\n');

    return `You are Kairo, the uOttawa academic assistant. Classify the user's message and extract relevant information with high accuracy.

Available Programs:
${programList}

Instructions:
1. Determine the user's intent from these options:
   - "when_is_course_taken": User asks when a course is taken in a program (e.g., "When do I take CSI2110 in Software Engineering?")
   - "course_info": User asks about course details, description, prerequisites, what to focus on (e.g., "What is CSI2110 about?", "Tell me about MAT1341", "What are the prerequisites for ITI1120?")
   - "build_schedule": User wants to generate/create a schedule (e.g., "Create my Year 2 schedule", "Generate a new one", "Make me a Fall schedule")
   - "remove_course": User wants to delete/remove specific courses from calendar (e.g., "Remove CSI2110", "Delete CSI 2372", "Remove all courses", "Clear my calendar")
   - "general_chat": General conversation or other requests

2. Extract information based on intent:

For "when_is_course_taken":
- Extract course code (e.g., CSI2110, MAT1341, ITI1120)
- Identify the program name using intelligent fuzzy matching
- Handle misspellings naturally (e.g., "softwre eng" → "Software Engineering Co-op")
- Match abbreviations (e.g., "cs" → "Honours BSc in Computer Science")
- Match casual names (e.g., "soft eng" → "Software Engineering Co-op")

For "course_info":
- Extract course code (e.g., CSI2110, MAT1341, ITI1120)
- Program name is optional for course info queries
- Handle variations like "what is", "tell me about", "describe", "prerequisites for", "what should I focus on"

For "build_schedule":
- Identify the program name using the same fuzzy matching rules
- Extract year (1, 2, 3, 4, 5, or "full" for complete program sequence)
- Extract term if specified ("Fall", "Winter", "Summer")
- If term is NOT specified, leave it null (system will infer all available terms)
- Detect "new schedule" requests (e.g., "create a new one", "generate another", "make a different one")

For "remove_course":
- Extract course code if specific course mentioned (e.g., CSI2110, MAT1341)
- Handle "all" or "everything" to indicate removing all courses
- Detect various deletion keywords: "remove", "delete", "clear", "get rid of", "unschedule"

3. Program Matching Examples:
   - "software eng", "soft eng", "swe", "software engineering" → "Software Engineering Co-op"
   - "comp sci", "cs", "computer science", "computing" → "Honours BSc in Computer Science"
   - "math econ", "mathematics and economics" → "Joint Honours in Mathematics and Economics"  
   - "elec eng", "electrical", "electrical engineering" → "Electrical Engineering"
   - "mech eng", "mechanical", "mechanical engineering" → "Mechanical Engineering"
   - "chem eng", "chemical", "chemical engineering" → "Chemical Engineering"
   - "civil eng", "civil", "civil engineering" → "Civil Engineering"

4. Handle misspellings, typos, and variations naturally. Be very flexible.

5. For schedule generation, also detect if user wants:
   - All terms (if no term specified)
   - Specific year + term combination
   - Complete program sequence (if they say "full" or "entire")

Respond with ONLY a JSON object in this format:
{
  "intent": "when_is_course_taken" | "course_info" | "build_schedule" | "remove_course" | "general_chat",
  "course": "course_code_if_applicable",
  "program": "exact_program_name_from_list_above",
  "year": number_or_"full"_if_applicable,
  "term": "Fall" | "Winter" | "Summer" | null,
  "confidence": 0.0_to_1.0
}

User message: "${message}"`;
  }

  private parseClassificationResult(result: any): ClassificationResult {
    try {
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      return {
        intent: parsed.intent || 'general_chat',
        course: parsed.course || undefined,
        program: parsed.program || undefined,
        year: parsed.year || undefined,
        term: parsed.term || undefined,
        confidence: parsed.confidence || 0.5
      };
    } catch (error) {
      console.error('Failed to parse classification result:', error);
      return this.fallbackClassification('');
    }
  }

  private fallbackClassification(message: string): ClassificationResult {
    const normalized = message.toLowerCase();

    let intent = 'general_chat';
    if (normalized.includes('when') && (normalized.includes('take') || normalized.includes('course'))) {
      intent = 'when_is_course_taken';
    } else if (normalized.includes('schedule') || normalized.includes('generate') || normalized.includes('create')) {
      intent = 'build_schedule';
    }

    return {
      intent,
      confidence: 0.3
    };
  }

  async findBestProgramMatch(query: string): Promise<string | null> {
    if (this.programs.length === 0) {
      await this.loadPrograms();
    }

    const prompt = `Match the user's program query to the best available program name.

Available Programs:
${this.programs.map(p => `- ${p.name}`).join('\n')}

User query: "${query}"

Rules:
1. Be very flexible with matching
2. Handle abbreviations, misspellings, and casual terms
3. Return the EXACT program name from the list above
4. If no good match exists, return "NO_MATCH"

Examples:
- "software eng" → "Software Engineering Co-op"
- "comp sci" → "Honours BSc in Computer Science"
- "math econ" → "Joint Honours in Mathematics and Economics"

Respond with only the exact program name or "NO_MATCH".`;

    try {
      const response = await api.post('/api/ai/classify/', {
        message: query,
        prompt: prompt
      });

      const match = response.data.classification?.trim();

      return match === 'NO_MATCH' ? null : match;
    } catch (error) {
      console.error('Program matching failed:', error);
      return null;
    }
  }

  async getAvailableTermsForProgram(programName: string, year: number): Promise<string[]> {
    try {
      // Find the program file from the index
      const programInfo = this.programs.find(p =>
        p.name.toLowerCase() === programName.toLowerCase()
      );

      if (!programInfo) {
  
        return [];
      }

      // Load the program's curriculum data
      const response = await fetch(`/curriculums/${programInfo.file}`);
      if (!response.ok) {
  
        return [];
      }

      const curriculum = await response.json();
      const targetYear = curriculum.years?.find((y: any) => y.year === year);

      if (!targetYear) {
  
        return [];
      }

      // Extract available terms for this year
      const availableTerms = targetYear.terms?.map((term: any) => term.term) || [];

  
      return availableTerms;
    } catch (error) {
      console.error('Error getting available terms:', error);
      return [];
    }
  }

  async enhancedClassifyWithTermInference(message: string): Promise<ClassificationResult & { availableTerms?: string[] }> {
    // First, get the basic classification
    const classification = await this.classifyMessage(message);

    // If it's a schedule generation request and no term was specified, get available terms
    if (classification.intent === 'build_schedule' &&
      classification.program &&
      classification.year &&
      !classification.term) {

      const year = typeof classification.year === 'number' ? classification.year : 1;
      const availableTerms = await this.getAvailableTermsForProgram(classification.program, year);

      return {
        ...classification,
        availableTerms
      };
    }

    return classification;
  }
}

export const gptClassificationService = new GPTClassificationService();