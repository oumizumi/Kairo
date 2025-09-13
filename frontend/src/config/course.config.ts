/**
 * Course Configuration
 * Centralized configuration for course codes, colors, and metadata
 */

export interface CourseColorConfig {
    prefix: string;
    name: string;
    bgColor: string;
    borderColor: string;
    textColor?: string;
    description?: string;
}

export interface CourseType {
    code: string;
    name: string;
    category: 'core' | 'elective' | 'prerequisite' | 'corequisite';
    department: string;
    faculty: string;
}

// Dynamic course color configuration
export const COURSE_COLOR_CONFIG: CourseColorConfig[] = [
    {
        prefix: 'CSI',
        name: 'Computer Science',
        bgColor: 'bg-blue-200',
        borderColor: 'border-blue-400',
        textColor: 'text-blue-800',
        description: 'Computer Science and Software Engineering'
    },
    {
        prefix: 'MAT',
        name: 'Mathematics',
        bgColor: 'bg-red-200',
        borderColor: 'border-red-400',
        textColor: 'text-red-800',
        description: 'Mathematics and Statistics'
    },
    {
        prefix: 'ITI',
        name: 'Information Technology',
        bgColor: 'bg-cyan-200',
        borderColor: 'border-cyan-400',
        textColor: 'text-cyan-800',
        description: 'Information Technology and Computer Engineering'
    },
    {
        prefix: 'CEG',
        name: 'Computer Engineering',
        bgColor: 'bg-orange-200',
        borderColor: 'border-orange-400',
        textColor: 'text-orange-800',
        description: 'Computer Engineering and Electrical Engineering'
    },
    {
        prefix: 'SEG',
        name: 'Software Engineering',
        bgColor: 'bg-purple-200',
        borderColor: 'border-purple-400',
        textColor: 'text-purple-800',
        description: 'Software Engineering and Development'
    },
    {
        prefix: 'ENG',
        name: 'English',
        bgColor: 'bg-yellow-200',
        borderColor: 'border-yellow-400',
        textColor: 'text-yellow-800',
        description: 'English and Communication'
    },
    {
        prefix: 'PHY',
        name: 'Physics',
        bgColor: 'bg-green-200',
        borderColor: 'border-green-400',
        textColor: 'text-green-800',
        description: 'Physics and Physical Sciences'
    },
    {
        prefix: 'CHM',
        name: 'Chemistry',
        bgColor: 'bg-indigo-200',
        borderColor: 'border-indigo-400',
        textColor: 'text-indigo-800',
        description: 'Chemistry and Chemical Sciences'
    },
    {
        prefix: 'BIO',
        name: 'Biology',
        bgColor: 'bg-emerald-200',
        borderColor: 'border-emerald-400',
        textColor: 'text-emerald-800',
        description: 'Biology and Life Sciences'
    },
    {
        prefix: 'ECO',
        name: 'Economics',
        bgColor: 'bg-teal-200',
        borderColor: 'border-teal-400',
        textColor: 'text-teal-800',
        description: 'Economics and Business'
    },
    {
        prefix: 'FRA',
        name: 'French',
        bgColor: 'bg-pink-200',
        borderColor: 'border-pink-400',
        textColor: 'text-pink-800',
        description: 'French Language and Literature'
    },
    {
        prefix: 'HIS',
        name: 'History',
        bgColor: 'bg-amber-200',
        borderColor: 'border-amber-400',
        textColor: 'text-amber-800',
        description: 'History and Social Sciences'
    }
];

// Default color scheme for unknown course codes
export const DEFAULT_COURSE_COLOR: CourseColorConfig = {
    prefix: 'UNK',
    name: 'Unknown',
    bgColor: 'bg-gray-200',
    borderColor: 'border-gray-400',
    textColor: 'text-gray-800',
    description: 'Unknown or Miscellaneous Course'
};

// Elective type colors
export const ELECTIVE_COLOR_CONFIG: Record<string, CourseColorConfig> = {
    'CSI': {
        prefix: 'CSI-ELECTIVE',
        name: 'Computer Science Elective',
        bgColor: 'bg-purple-100',
        borderColor: 'border-purple-300',
        textColor: 'text-purple-700'
    },
    'Free': {
        prefix: 'FREE-ELECTIVE',
        name: 'Free Elective',
        bgColor: 'bg-green-100',
        borderColor: 'border-green-300',
        textColor: 'text-green-700'
    },
    'default': {
        prefix: 'GENERAL-ELECTIVE',
        name: 'General Elective',
        bgColor: 'bg-gray-100',
        borderColor: 'border-gray-300',
        textColor: 'text-gray-700'
    }
};

/**
 * Get course color configuration by course code prefix
 */
export const getCourseColorConfig = (courseCode: string): CourseColorConfig => {
    if (!courseCode) return DEFAULT_COURSE_COLOR;

    const prefix = courseCode.substring(0, 3).toUpperCase();
    const config = COURSE_COLOR_CONFIG.find(c => c.prefix === prefix);

    return config || DEFAULT_COURSE_COLOR;
};

/**
 * Get elective color configuration by elective type
 */
export const getElectiveColorConfig = (electiveType: string): CourseColorConfig => {
    const normalizedType = electiveType.toLowerCase();

    if (normalizedType.includes('csi')) {
        return ELECTIVE_COLOR_CONFIG['CSI'];
    } else if (normalizedType.includes('free')) {
        return ELECTIVE_COLOR_CONFIG['Free'];
    }

    return ELECTIVE_COLOR_CONFIG['default'];
};

/**
 * Get formatted course color classes
 */
export const getCourseColorClasses = (courseCode: string, isElective: boolean = false, electiveType?: string): string => {
    if (isElective && electiveType) {
        const config = getElectiveColorConfig(electiveType);
        return `${config.bgColor} ${config.borderColor} ${config.textColor || 'text-gray-800'}`;
    }

    const config = getCourseColorConfig(courseCode);
    return `${config.bgColor} ${config.borderColor} ${config.textColor || 'text-gray-800'}`;
};

/**
 * Get all unique course prefixes currently configured
 */
export const getConfiguredCoursePrefixes = (): string[] => {
    return COURSE_COLOR_CONFIG.map(config => config.prefix);
};

/**
 * Get course legend data for display
 */
export const getCourseLegendData = (): Array<{ prefix: string; name: string; colorClass: string }> => {
    return COURSE_COLOR_CONFIG.map(config => ({
        prefix: config.prefix,
        name: config.name,
        colorClass: `${config.bgColor} ${config.borderColor}`
    }));
};

// Course code validation patterns (supports 4+ digit courses like APA 46111)
export const COURSE_CODE_PATTERNS = [
    /^([A-Z]{2,4})\s*(\d{4,})$/i,  // Standard format: CSI 2132, MATH 1341, APA 46111
    /^([A-Z]{3})\s*(\d{3,})$/i,    // Alternative format: CSI 101, MAT 1341, APA 46111
    /^([A-Z]{2,4})(\d{4,})$/i,     // No space format: CSI2132, APA46111
    /^([A-Z]{3})(\d{3,})$/i        // No space alternative: CSI101, APA46111
];

/**
 * Validate and normalize course code format
 */
export const normalizeCourseCode = (courseCode: string): string => {
    if (!courseCode) return '';

    const trimmed = courseCode.trim().toUpperCase();

    for (const pattern of COURSE_CODE_PATTERNS) {
        const match = trimmed.match(pattern);
        if (match) {
            const [, prefix, number] = match;
            return `${prefix} ${number}`;
        }
    }

    return trimmed; // Return as-is if no pattern matches
};