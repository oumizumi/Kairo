/**
 * Universal Program Detection Configuration
 * Central registry for all academic programs and their keywords
 * Used by both schedule generation and curriculum services
 */

export interface ProgramKeyword {
    // Main program name as it appears in curriculum data
    mainName: string;
    // All possible ways users might refer to this program
    keywords: string[];
    // Program codes/abbreviations
    codes?: string[];
    // Categories for grouping
    category: 'engineering' | 'science' | 'social_science' | 'health' | 'business' | 'arts' | 'other';
}

// Central registry of all academic programs with comprehensive nicknames and slang
export const PROGRAM_REGISTRY: ProgramKeyword[] = [
    // Engineering Programs
    {
        mainName: 'Computer Engineering',
        keywords: [
            // Official names
            'computer engineering', 'comp eng', 'computer eng', 'computing engineering',
            // Student slang/nicknames
            'compeng', 'ce', 'comp e', 'computer e', 'hardware engineering', 'hardware eng',
            // Variations
            'computing and engineering', 'computer systems engineering'
        ],
        codes: ['CEG', 'CE'],
        category: 'engineering'
    },
    {
        mainName: 'Software Engineering',
        keywords: [
            // Official names
            'software engineering', 'software eng', 'software development',
            // Student slang/nicknames  
            'softeng', 'se', 'soft eng', 'software e', 'sweng', 'swe', 'soft e',
            // Related terms
            'software dev', 'programming', 'coding', 'app development', 'web development'
        ],
        codes: ['SEG', 'SE', 'SWE'],
        category: 'engineering'
    },
    {
        mainName: 'Electrical Engineering',
        keywords: [
            // Official names
            'electrical engineering', 'electrical eng', 'electric engineering',
            // Student slang/nicknames
            'ee', 'elec eng', 'electrical e', 'elec e', 'electric eng', 'electricity',
            // Related terms
            'electronics', 'circuits', 'power engineering', 'telecommunications'
        ],
        codes: ['ELG', 'EE', 'ELEC'],
        category: 'engineering'
    },
    {
        mainName: 'Mechanical Engineering',
        keywords: [
            // Official names
            'mechanical engineering', 'mechanical eng',
            // Student slang/nicknames
            'me', 'mech eng', 'mechanical e', 'mech e', 'mecheng',
            // Related terms
            'mechanics', 'thermodynamics', 'fluid mechanics', 'machine design'
        ],
        codes: ['MCG', 'ME', 'MECH'],
        category: 'engineering'
    },
    {
        mainName: 'Civil Engineering',
        keywords: [
            // Official names
            'civil engineering', 'civil eng', 'construction engineering',
            // Student slang/nicknames
            'ce', 'civil e', 'civ eng', 'civ e', 'civeng',
            // Related terms
            'construction', 'infrastructure', 'structural engineering', 'transportation'
        ],
        codes: ['CVG', 'CE', 'CIV'],
        category: 'engineering'
    },
    {
        mainName: 'Chemical Engineering',
        keywords: [
            // Official names
            'chemical engineering', 'chemical eng', 'chem eng',
            // Student slang/nicknames
            'che', 'chem e', 'chemical e', 'chemeng',
            // Related terms
            'process engineering', 'petrochemical', 'materials engineering'
        ],
        codes: ['CHG', 'CHE', 'CHEM'],
        category: 'engineering'
    },
    {
        mainName: 'Biomedical Engineering',
        keywords: [
            // Official names
            'biomedical engineering', 'biomed eng', 'bioengineering',
            // Student slang/nicknames
            'bme', 'biomed', 'bio eng', 'biomedical e', 'bio e',
            // Related terms
            'medical engineering', 'biotechnology', 'biotech'
        ],
        codes: ['BME', 'BIOE'],
        category: 'engineering'
    },

    // Computer Science Programs
    {
        mainName: 'Computer Science',
        keywords: [
            // Official names
            'computer science', 'comp sci', 'computing', 'computer studies',
            // Student slang/nicknames
            'cs', 'compsci', 'comp s', 'computer s', 'computing science',
            // Related terms
            'programming', 'coding', 'algorithms', 'software', 'tech', 'it'
        ],
        codes: ['CSI', 'CS', 'COMP'],
        category: 'science'
    },
    {
        mainName: 'Data Science',
        keywords: [
            // Official names
            'data science', 'data sci', 'data analytics', 'data analysis',
            // Student slang/nicknames
            'ds', 'data', 'analytics', 'big data', 'data mining',
            // Related terms
            'machine learning', 'ml', 'ai', 'artificial intelligence', 'statistics', 'stats'
        ],
        codes: ['DSI', 'DS', 'DATA'],
        category: 'science'
    },

    // Health Sciences
    {
        mainName: 'Nursing',
        keywords: [
            // Official names
            'nursing', 'bachelor of nursing', 'bsc nursing', 'nursing studies',
            // Student slang/nicknames
            'nurse', 'rn', 'registered nursing', 'nursing program',
            // Related terms
            'healthcare', 'medical', 'patient care', 'clinical'
        ],
        codes: ['NURS', 'RN'],
        category: 'health'
    },
    {
        mainName: 'Human Kinetics',
        keywords: [
            // Official names
            'human kinetics', 'kinesiology', 'exercise science', 'sports science',
            // Student slang/nicknames
            'hk', 'kin', 'kines', 'kinetics', 'exercise sci', 'sport sci',
            // Related terms
            'physical education', 'pe', 'fitness', 'athletics', 'sports', 'movement'
        ],
        codes: ['HK', 'KIN', 'KINE'],
        category: 'health'
    },
    {
        mainName: 'Health Sciences',
        keywords: [
            // Official names
            'health sciences', 'health studies', 'public health', 'health science',
            // Student slang/nicknames
            'health sci', 'health s', 'pub health', 'health',
            // Related terms
            'epidemiology', 'health promotion', 'community health'
        ],
        codes: ['HLTH', 'PH', 'HESC'],
        category: 'health'
    },

    // Social Sciences
    {
        mainName: 'Psychology',
        keywords: [
            // Official names
            'psychology', 'psychological studies', 'psych',
            // Student slang/nicknames
            'psycho', 'psyc', 'psy', 'psychology studies',
            // Related terms
            'mental health', 'behavior', 'cognitive science', 'neuroscience'
        ],
        codes: ['PSY', 'PSYC', 'PSYCH'],
        category: 'social_science'
    },
    {
        mainName: 'Political Science',
        keywords: [
            // Official names
            'political science', 'politics', 'government studies', 'political studies',
            // Student slang/nicknames
            'poli sci', 'pol sci', 'pols', 'pol', 'polisci', 'politics',
            // Related terms
            'government', 'public policy', 'international relations', 'ir'
        ],
        codes: ['POL', 'POLI', 'GOVT'],
        category: 'social_science'
    },
    {
        mainName: 'Economics',
        keywords: [
            // Official names
            'economics', 'economic studies', 'econ',
            // Student slang/nicknames
            'eco', 'economics', 'economy',
            // Related terms
            'finance', 'business economics', 'econometrics', 'macro', 'micro'
        ],
        codes: ['ECO', 'ECON', 'ECOS'],
        category: 'social_science'
    },
    {
        mainName: 'Criminology',
        keywords: [
            // Official names
            'criminology', 'criminal justice', 'crime studies',
            // Student slang/nicknames
            'crim', 'criminal', 'justice', 'crime',
            // Related terms
            'law enforcement', 'forensics', 'corrections', 'policing'
        ],
        codes: ['CRM', 'CRIM', 'CJ'],
        category: 'social_science'
    },
    {
        mainName: 'Anthropology',
        keywords: [
            // Official names
            'anthropology', 'cultural studies', 'social anthropology',
            // Student slang/nicknames
            'anthro', 'anth', 'anthropo',
            // Related terms
            'culture', 'archaeology', 'ethnography', 'human evolution'
        ],
        codes: ['ANT', 'ANTH', 'ANTHRO'],
        category: 'social_science'
    },
    {
        mainName: 'Sociology',
        keywords: [
            // Official names
            'sociology', 'social studies', 'social science',
            // Student slang/nicknames
            'soc', 'socio', 'sociology studies',
            // Related terms
            'society', 'social theory', 'social research', 'social work'
        ],
        codes: ['SOC', 'SOCI', 'SOCIO'],
        category: 'social_science'
    },
    {
        mainName: 'Social Work',
        keywords: [
            // Official names
            'social work', 'social services', 'social worker',
            // Student slang/nicknames
            'sw', 'social', 'community work',
            // Related terms
            'counseling', 'therapy', 'community services', 'human services'
        ],
        codes: ['SW', 'SOWK'],
        category: 'social_science'
    },
    {
        mainName: 'Public Administration',
        keywords: [
            // Official names
            'public administration', 'public admin', 'government administration',
            // Student slang/nicknames
            'pa', 'pub admin', 'public admin', 'govt admin',
            // Related terms
            'public policy', 'public management', 'civil service'
        ],
        codes: ['PA', 'PADM', 'PUAD'],
        category: 'social_science'
    },

    // Sciences
    {
        mainName: 'Mathematics',
        keywords: [
            // Official names
            'mathematics', 'mathematical studies', 'math', 'maths',
            // Student slang/nicknames
            'calc', 'calculus', 'algebra', 'geometry', 'stats', 'statistics',
            // Related terms
            'pure math', 'applied math', 'mathematical science'
        ],
        codes: ['MAT', 'MATH', 'MATHS'],
        category: 'science'
    },
    {
        mainName: 'Physics',
        keywords: [
            // Official names
            'physics', 'physical sciences', 'physics studies',
            // Student slang/nicknames
            'phys', 'phy', 'physics sci',
            // Related terms
            'quantum', 'mechanics', 'thermodynamics', 'optics', 'astronomy'
        ],
        codes: ['PHY', 'PHYS', 'PHYSICS'],
        category: 'science'
    },
    {
        mainName: 'Chemistry',
        keywords: [
            // Official names
            'chemistry', 'chemical sciences', 'chem',
            // Student slang/nicknames
            'organic', 'inorganic', 'biochem', 'analytical',
            // Related terms
            'chemical analysis', 'molecular science', 'lab science'
        ],
        codes: ['CHM', 'CHEM', 'CHEMISTRY'],
        category: 'science'
    },
    {
        mainName: 'Biology',
        keywords: [
            // Official names
            'biology', 'biological sciences', 'life sciences', 'bio',
            // Student slang/nicknames
            'microbio', 'molecular bio', 'cell bio', 'genetics',
            // Related terms
            'biotechnology', 'biotech', 'ecology', 'botany', 'zoology'
        ],
        codes: ['BIO', 'BIOL', 'BIOLOGY'],
        category: 'science'
    },

    // Arts & Humanities
    {
        mainName: 'Philosophy',
        keywords: [
            // Official names
            'philosophy', 'philosophical studies', 'phil',
            // Student slang/nicknames
            'philo', 'ethics', 'logic',
            // Related terms
            'critical thinking', 'moral philosophy', 'metaphysics'
        ],
        codes: ['PHI', 'PHIL', 'PHILO'],
        category: 'arts'
    },
    {
        mainName: 'History',
        keywords: [
            // Official names
            'history', 'historical studies', 'hist',
            // Student slang/nicknames
            'ancient history', 'modern history', 'canadian history',
            // Related terms
            'archaeology', 'heritage', 'civilization'
        ],
        codes: ['HIS', 'HIST', 'HISTORY'],
        category: 'arts'
    },
    {
        mainName: 'English',
        keywords: [
            // Official names
            'english', 'english literature', 'literature', 'eng',
            // Student slang/nicknames
            'lit', 'creative writing', 'writing', 'poetry',
            // Related terms
            'linguistics', 'language arts', 'composition'
        ],
        codes: ['ENG', 'ENGL', 'LIT'],
        category: 'arts'
    },
    {
        mainName: 'Communication',
        keywords: [
            // Official names
            'communication', 'communications', 'media studies', 'comm',
            // Student slang/nicknames
            'media', 'journalism', 'broadcasting', 'digital media',
            // Related terms
            'public relations', 'pr', 'marketing communications'
        ],
        codes: ['CMN', 'COMM', 'MEDIA'],
        category: 'arts'
    },

    // Business
    {
        mainName: 'Business',
        keywords: [
            // Official names
            'business', 'business administration', 'management', 'commerce',
            // Student slang/nicknames
            'biz', 'admin', 'business admin', 'mba', 'finance', 'accounting',
            // Related terms
            'entrepreneurship', 'marketing', 'operations', 'strategy'
        ],
        codes: ['ADM', 'BUS', 'COMM', 'MGMT'],
        category: 'business'
    }
];

// Generate all possible keywords for pattern matching
export function getAllProgramKeywords(): string[] {
    const allKeywords: string[] = [];
    
    PROGRAM_REGISTRY.forEach(program => {
        // Add main name
        allKeywords.push(program.mainName.toLowerCase());
        
        // Add all keywords
        program.keywords.forEach(keyword => {
            allKeywords.push(keyword.toLowerCase());
        });
        
        // Add codes if any
        if (program.codes) {
            program.codes.forEach(code => {
                allKeywords.push(code.toLowerCase());
            });
        }
    });
    
    // Remove duplicates and sort by length (longer first for better matching)
    return [...new Set(allKeywords)].sort((a, b) => b.length - a.length);
}

// Find program by any keyword
export function findProgramByKeyword(keyword: string): ProgramKeyword | null {
    const normalizedKeyword = keyword.toLowerCase().trim();
    
    return PROGRAM_REGISTRY.find(program => {
        // Check main name
        if (program.mainName.toLowerCase() === normalizedKeyword) {
            return true;
        }
        
        // Check keywords
        if (program.keywords.some(k => k.toLowerCase() === normalizedKeyword)) {
            return true;
        }
        
        // Check codes
        if (program.codes && program.codes.some(c => c.toLowerCase() === normalizedKeyword)) {
            return true;
        }
        
        return false;
    }) || null;
}

// Check if text contains any program keywords
export function containsProgramKeyword(text: string): boolean {
    const normalizedText = text.toLowerCase();
    const keywords = getAllProgramKeywords();
    
    return keywords.some(keyword => {
        // Use word boundaries to avoid partial matches
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        return regex.test(normalizedText);
    });
}

// Extract all program keywords found in text
export function extractProgramKeywords(text: string): string[] {
    const normalizedText = text.toLowerCase();
    const keywords = getAllProgramKeywords();
    const found: string[] = [];
    
    keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(normalizedText)) {
            found.push(keyword);
        }
    });
    
    return found;
}

// Additional course code detection for patterns like CSI2110, MAT1341, etc.
export interface CourseCodePattern {
    prefix: string;
    programName: string;
    category: string;
}

// Map course code prefixes to programs
export const COURSE_CODE_PATTERNS: CourseCodePattern[] = [
    // Computer Science & Engineering
    { prefix: 'CSI', programName: 'Computer Science', category: 'science' },
    { prefix: 'CS', programName: 'Computer Science', category: 'science' },
    { prefix: 'CEG', programName: 'Computer Engineering', category: 'engineering' },
    { prefix: 'SEG', programName: 'Software Engineering', category: 'engineering' },
    { prefix: 'ELG', programName: 'Electrical Engineering', category: 'engineering' },
    { prefix: 'MCG', programName: 'Mechanical Engineering', category: 'engineering' },
    { prefix: 'CVG', programName: 'Civil Engineering', category: 'engineering' },
    { prefix: 'CHG', programName: 'Chemical Engineering', category: 'engineering' },
    
    // Sciences
    { prefix: 'MAT', programName: 'Mathematics', category: 'science' },
    { prefix: 'PHY', programName: 'Physics', category: 'science' },
    { prefix: 'CHM', programName: 'Chemistry', category: 'science' },
    { prefix: 'BIO', programName: 'Biology', category: 'science' },
    { prefix: 'STA', programName: 'Statistics', category: 'science' },
    
    // Social Sciences
    { prefix: 'PSY', programName: 'Psychology', category: 'social_science' },
    { prefix: 'POL', programName: 'Political Science', category: 'social_science' },
    { prefix: 'ECO', programName: 'Economics', category: 'social_science' },
    { prefix: 'SOC', programName: 'Sociology', category: 'social_science' },
    { prefix: 'ANT', programName: 'Anthropology', category: 'social_science' },
    { prefix: 'CRM', programName: 'Criminology', category: 'social_science' },
    
    // Health Sciences
    { prefix: 'NUR', programName: 'Nursing', category: 'health' },
    { prefix: 'HK', programName: 'Human Kinetics', category: 'health' },
    { prefix: 'KIN', programName: 'Kinesiology', category: 'health' },
    
    // Arts & Humanities
    { prefix: 'ENG', programName: 'English', category: 'arts' },
    { prefix: 'FRA', programName: 'French', category: 'arts' },
    { prefix: 'HIS', programName: 'History', category: 'arts' },
    { prefix: 'PHI', programName: 'Philosophy', category: 'arts' },
    { prefix: 'CMN', programName: 'Communication', category: 'arts' },
    
    // Business
    { prefix: 'ADM', programName: 'Business Administration', category: 'business' },
    { prefix: 'FIN', programName: 'Finance', category: 'business' },
    { prefix: 'MKT', programName: 'Marketing', category: 'business' },
    
    // Other common codes
    { prefix: 'ITI', programName: 'Information Technology', category: 'science' },
    { prefix: 'GNG', programName: 'General Engineering', category: 'engineering' },
    { prefix: 'SCI', programName: 'General Science', category: 'science' }
];

// Detect programs from course codes in text (e.g., "CSI2110", "MAT1341")
export function detectProgramFromCourseCodes(text: string): string[] {
    const foundPrograms: string[] = [];
    
    // Pattern to match course codes like CSI2110, MAT 1341, ENG1100, etc.
    const courseCodePattern = /\b([A-Z]{2,4})\s*(\d{3,4})\b/gi;
    const matches = text.matchAll(courseCodePattern);
    
    for (const match of matches) {
        const prefix = match[1].toUpperCase();
        const coursePattern = COURSE_CODE_PATTERNS.find(pattern => pattern.prefix === prefix);
        
        if (coursePattern && !foundPrograms.includes(coursePattern.programName)) {
            foundPrograms.push(coursePattern.programName);
        }
    }
    
    return foundPrograms;
}

// Universal function to detect ANY program mentions in text
export function detectAllPrograms(text: string): {
    fromKeywords: string[];
    fromCourseCodes: string[];
    combined: string[];
} {
    const fromKeywords = extractProgramKeywords(text);
    const fromCourseCodes = detectProgramFromCourseCodes(text);
    const combined = [...new Set([...fromKeywords, ...fromCourseCodes])];
    
    return {
        fromKeywords,
        fromCourseCodes,
        combined
    };
}