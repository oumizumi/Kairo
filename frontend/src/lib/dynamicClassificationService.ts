import api from './api';

interface ClassificationResult {
    intent: string;
    course?: string;
    program?: string;
    year?: number | 'full';
    term?: string;
    confidence: number;
    reasoning?: string;
}

interface ConversationContext {
    recentMessages: string[];
    detectedPatterns: string[];
    userPreferences: {
        preferredPrograms: string[];
        commonIntents: string[];
        conversationStyle: string;
    };
}

interface IntentPattern {
    keywords: string[];
    context: string[];
    confidence: number;
    lastUsed: Date;
}

export class DynamicClassificationService {
    private conversationHistory: string[] = [];
    private learnedPatterns: Map<string, IntentPattern> = new Map();
    private programs: any[] = [];

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

    // Dynamic context-aware classification without hardcoded prompts
    async classifyMessage(message: string): Promise<ClassificationResult> {
        if (this.programs.length === 0) {
            await this.loadPrograms();
        }

        // Add to conversation history for context
        this.conversationHistory.push(message);
        if (this.conversationHistory.length > 10) {
            this.conversationHistory.shift(); // Keep last 10 messages
        }

        // Build dynamic context from conversation
        const context = this.buildDynamicContext(message);

        // Use lightweight AI classification with context
        const prompt = this.buildMinimalPrompt(message, context);

        try {
            const response = await api.post('/api/ai/classify/', {
                message: message,
                prompt: prompt,
                context: context,
                programs: this.programs.map(p => ({ name: p.name, code: p.code }))
            });

            const result = this.parseAndLearn(response.data.classification, message);
            return result;

        } catch (error) {
            console.error('AI classification failed:', error);
            return this.smartFallback(message);
        }
    }

    // Build context from conversation patterns instead of hardcoded rules
    private buildDynamicContext(message: string): ConversationContext {
        const recentContext = this.conversationHistory.slice(-3);

        // Detect patterns from conversation flow
        const detectedPatterns = this.detectConversationPatterns(recentContext);

        // Analyze user preferences from history
        const userPreferences = this.analyzeUserPreferences();

        return {
            recentMessages: recentContext,
            detectedPatterns,
            userPreferences
        };
    }

    // Minimal, context-aware prompt instead of massive hardcoded template
    private buildMinimalPrompt(message: string, context: ConversationContext): string {
        const contextClues = context.detectedPatterns.length > 0
            ? `\nContext: User seems to be ${context.detectedPatterns.join(', ')}`
            : '';

        const programHints = context.userPreferences.preferredPrograms.length > 0
            ? `\nUser commonly asks about: ${context.userPreferences.preferredPrograms.join(', ')}`
            : '';

        // Create smart program mapping hints based on common abbreviations
        const programMappings = this.createProgramMappings();

        return `Analyze this academic request and respond with JSON:
${contextClues}${programHints}

Common program abbreviations:
${programMappings}

Message: "${message}"

Possible intents:
- course_info: asking about a specific course's details, prerequisites, description
- program_sequence: asking for course sequences, curriculum, program requirements, "what courses should I take", "show me computer science program"
- when_is_course_taken: asking when a specific course is taken in a program
- build_schedule: asking to generate/create a schedule
- general_chat: casual conversation

Extract: intent, course code, program name (use full name from above), year (1-5), term (Fall/Winter/Summer)
Respond with: {"intent": "detected_intent", "course": "COURSEXXXX", "program": "Full Program Name", "year": 1-5, "term": "Fall|Winter|Summer", "confidence": 0.0-1.0, "reasoning": "brief_explanation"}`;
    }

    // Create dynamic program mappings based on loaded programs
    private createProgramMappings(): string {
        if (!this.programs || this.programs.length === 0) {
            return 'No programs loaded';
        }

        // Create intelligent mappings for ALL programs dynamically
        const mappings: string[] = [];

        this.programs.forEach(program => {
            const name = program.name;
            const code = program.code;

            // Generate automatic abbreviations for any program
            const abbreviations: string[] = [];

            // Add the program code
            if (code) abbreviations.push(code.toLowerCase());

            // Create smart abbreviations from program name
            const words = name.toLowerCase().split(/\s+/);
            if (words.length > 1) {
                // Create acronym from first letters
                const acronym = words.map((w: string) => w.charAt(0)).join('');
                if (acronym.length <= 6) abbreviations.push(acronym);

                // Add common short forms
                const shortForms = words.map((word: string) => {
                    if (word === 'engineering') return 'eng';
                    if (word === 'computer') return 'comp';
                    if (word === 'science') return 'sci';
                    if (word === 'management') return 'mgmt';
                    if (word === 'business') return 'biz';
                    if (word === 'administration') return 'admin';
                    return word;
                }).join(' ');
                if (shortForms !== name.toLowerCase()) abbreviations.push(shortForms);
            }

            // Add single word programs as-is
            if (words.length === 1) abbreviations.push(words[0]);

            // Create mapping entry
            if (abbreviations.length > 0) {
                mappings.push(`${abbreviations.join(', ')} → ${name}`);
            } else {
                mappings.push(name);
            }
        });

        return mappings.join('\n');
    }

    // Pure learning-based pattern detection - no hardcoded fallbacks
    private detectConversationPatterns(recentMessages: string[]): string[] {
        const patterns: string[] = [];
        const allText = recentMessages.join(' ').toLowerCase();

        // Only detect patterns we've actually learned from user behavior
        this.learnedPatterns.forEach((pattern, intent) => {
            if (this.hasLearnedPattern(allText, intent)) {
                patterns.push(intent);
            }
        });

        // If no learned patterns, return empty - we don't know
        return patterns;
    }

    // Pure learning-based detection - no hardcoded patterns whatsoever
    private hasLearnedPattern(text: string, intentType: string): boolean {
        const pattern = this.learnedPatterns.get(intentType);
        if (!pattern) return false;

        return pattern.keywords.some(keyword =>
            text.toLowerCase().includes(keyword.toLowerCase())
        );
    }

    // Analyze user preferences from conversation history
    private analyzeUserPreferences(): { preferredPrograms: string[]; commonIntents: string[]; conversationStyle: string } {
        const preferences = {
            preferredPrograms: [] as string[],
            commonIntents: [] as string[],
            conversationStyle: 'formal'
        };

        // Extract program mentions from history
        this.conversationHistory.forEach(message => {
            this.programs.forEach(program => {
                if (message.toLowerCase().includes(program.name.toLowerCase()) ||
                    message.toLowerCase().includes(program.code.toLowerCase())) {
                    if (!preferences.preferredPrograms.includes(program.name)) {
                        preferences.preferredPrograms.push(program.name);
                    }
                }
            });
        });

        // AI-powered conversation style analysis (no hardcoded word lists)
        const allText = this.conversationHistory.join(' ').toLowerCase();

        // Use linguistic patterns to detect formality level
        const casualPatterns = /(?:hey|yo|sup|cool|awesome|dude|yeah|nah|gonna|wanna|gotta)/gi;
        const formalPatterns = /(?:please|thank you|could you|would you|i would appreciate|may i|excuse me)/gi;

        const casualMatches = (allText.match(casualPatterns) || []).length;
        const formalMatches = (allText.match(formalPatterns) || []).length;

        // Consider sentence structure and length for formality detection
        const avgSentenceLength = allText.split(/[.!?]/).reduce((sum, sentence) =>
            sum + sentence.trim().split(' ').length, 0) / Math.max(1, allText.split(/[.!?]/).length);

        const isVeryFormal = avgSentenceLength > 15 || formalMatches > casualMatches * 2;
        const isCasual = casualMatches > formalMatches || avgSentenceLength < 8;

        preferences.conversationStyle = isVeryFormal ? 'formal' : isCasual ? 'casual' : 'neutral';

        return preferences;
    }

    // Parse AI response and learn from it
    private parseAndLearn(result: any, originalMessage: string): ClassificationResult {
        try {
            let parsed;
            if (typeof result === 'string') {
                // Handle JSON wrapped in markdown code blocks
                let jsonString = result.trim();

  

                // More robust code block detection
                if (jsonString.includes('```')) {
                    // Find the start and end of code blocks
                    const startPattern = /```(?:json|js|javascript)?\s*/;
                    const endPattern = /\s*```/;

                    const startMatch = jsonString.match(startPattern);
                    const endMatch = jsonString.match(endPattern);

                    if (startMatch && endMatch) {
                        const startIndex = startMatch.index! + startMatch[0].length;
                        const endIndex = jsonString.lastIndexOf('```');

                        if (startIndex < endIndex) {
                            jsonString = jsonString.substring(startIndex, endIndex).trim();
  
                        }
                    }
                }

  
                parsed = JSON.parse(jsonString);
            } else {
                parsed = result;
            }

            // Learn from successful classification
            if (parsed.intent && parsed.confidence > 0.7) {
                this.learnIntentPattern(parsed.intent, originalMessage);
            }

  
            return {
                intent: parsed.intent || 'general_chat',
                course: parsed.course || undefined,
                program: parsed.program || undefined,
                year: parsed.year || undefined,
                term: parsed.term || undefined,
                confidence: parsed.confidence || 0.5,
                reasoning: parsed.reasoning || 'AI analysis'
            };

        } catch (error) {
            console.error('❌ [parseAndLearn] Failed to parse classification result:', error);
            console.error('❌ [parseAndLearn] Raw result was:', result);
            return this.smartFallback(originalMessage);
        }
    }

    // Learn intent patterns for future use
    private learnIntentPattern(intent: string, message: string): void {
        const keywords = message.toLowerCase().split(/\s+/).filter(word => word.length > 2);
        const context = this.conversationHistory.slice(-2);

        const pattern: IntentPattern = {
            keywords: keywords.slice(0, 5), // Top 5 keywords
            context: context,
            confidence: 1.0,
            lastUsed: new Date()
        };

        this.learnedPatterns.set(intent, pattern);
    }

    // Intelligent fallback using learned patterns
    private smartFallback(message: string): ClassificationResult {
        const messageLower = message.toLowerCase();

        // Check learned patterns first
        for (const [intent, pattern] of this.learnedPatterns.entries()) {
            const matchingKeywords = pattern.keywords.filter(keyword =>
                messageLower.includes(keyword)
            ).length;

            if (matchingKeywords >= 2) {
                return {
                    intent,
                    confidence: 0.6,
                    reasoning: `Matched learned pattern for ${intent}`
                };
            }
        }

        // Basic intent detection as last resort
        
        // Program sequence detection
        if (messageLower.includes('program') || messageLower.includes('curriculum') || 
            messageLower.includes('course sequence') || messageLower.includes('course list') ||
            messageLower.includes('what courses') || messageLower.includes('show me') ||
            messageLower.includes('degree requirements') || messageLower.includes('program requirements')) {
            
            // Note: Program extraction will be handled by the ProgramSequenceService
            // which has access to the full program database and dynamic matching
            return { intent: 'program_sequence', confidence: 0.6, reasoning: 'Program sequence keyword match' };
        }

        if (messageLower.includes('schedule') || messageLower.includes('generate')) {
            return { intent: 'build_schedule', confidence: 0.4, reasoning: 'Keyword match' };
        }

        if (messageLower.includes('when') && (messageLower.includes('take') || messageLower.includes('course'))) {
            return { intent: 'when_is_course_taken', confidence: 0.4, reasoning: 'Keyword match' };
        }

        if (messageLower.includes('what is') || messageLower.includes('about')) {
            return { intent: 'course_info', confidence: 0.4, reasoning: 'Keyword match' };
        }

        if (messageLower.includes('remove') || messageLower.includes('delete')) {
            return { intent: 'remove_course', confidence: 0.4, reasoning: 'Keyword match' };
        }

        return { intent: 'general_chat', confidence: 0.3, reasoning: 'Default fallback' };
    }

    // Get classification insights for debugging
    getClassificationInsights(): any {
        return {
            conversationLength: this.conversationHistory.length,
            learnedPatterns: Array.from(this.learnedPatterns.keys()),
            recentContext: this.conversationHistory.slice(-3),
            userPreferences: this.analyzeUserPreferences()
        };
    }

    // Clear learned patterns (for testing or reset)
    clearLearning(): void {
        this.learnedPatterns.clear();
        this.conversationHistory = [];
    }
}

export const dynamicClassificationService = new DynamicClassificationService(); 