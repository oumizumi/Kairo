// App Configuration - Central place for all hardcoded values
export const APP_CONFIG = {
    // Academic Calendar Configuration
    ACADEMIC: {
        // Academic year and terms
        CURRENT_ACADEMIC_YEAR: '2025-2026',

        // Term definitions with their date ranges
        TERMS: {
            FALL: {
                key: 'Fall',
                displayName: 'Fall 2025',
                dataKey: '2025 Fall Term',
                startDate: '2025-09-03',
                endDate: '2025-12-02',
                termCode: '2259',
                readingWeekStart: '2025-10-12',
                readingWeekEnd: '2025-10-18'
            },
            WINTER: {
                key: 'Winter',
                displayName: 'Winter 2026',
                dataKey: '2026 Winter Term',
                startDate: '2026-01-12',
                endDate: '2026-04-15',
                termCode: '2261',
                readingWeekStart: '2026-02-15',
                readingWeekEnd: '2026-02-21'
            },
            SPRING_SUMMER: {
                key: 'Spring/Summer',
                displayName: 'Spring/Summer 2025',
                dataKey: '2025 Spring/Summer Term',
                startDate: '2025-05-06',
                endDate: '2025-08-15',
                termCode: '2255'
            }
        },

        // Default term
        DEFAULT_TERM: 'Fall',

        // Academic calendar bounds
        CALENDAR: {
            START_HOUR: 8,  // 8:00 AM
            END_HOUR: 22,   // 10:00 PM  
            TOTAL_HOURS: 14, // 8 AM to 10 PM = 14 hours
            START_MINUTES: 480, // 8 * 60
            END_MINUTES: 1320,  // 22 * 60
            TOTAL_MINUTES: 840, // 14 * 60

            // Common time slots for course scheduling
            TIME_SLOTS: [
                { time: '8:30 AM', hour: 8, minute: 30 },
                { time: '10:00 AM', hour: 10, minute: 0 },
                { time: '11:30 AM', hour: 11, minute: 30 },
                { time: '1:00 PM', hour: 13, minute: 0 },
                { time: '2:30 PM', hour: 14, minute: 30 },
                { time: '4:00 PM', hour: 16, minute: 0 },
                { time: '5:30 PM', hour: 17, minute: 30 },
                { time: '7:00 PM', hour: 19, minute: 0 }
            ],

            // Week days
            WEEK_DAYS: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            WEEK_DAYS_SHORT: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],

            // Time slot configuration
            TIME_SLOT_INTERVAL: 15, // 15-minute intervals
            CONFLICT_BUFFER_MINUTES: 10, // Buffer between classes
            MINIMUM_EVENT_HEIGHT_PERCENT: 2 // Minimum 2% height for visibility
        }
    },

    // UI Theme and Styling Configuration
    UI: {
        // Color schemes for calendar events (vibrant gradients)
        EVENT_COLOR_SCHEMES: [
            // Warm Sunset (Orange to Red)
            {
                gradient: 'from-orange-400/90 to-red-500/90 dark:from-orange-300/80 dark:to-red-400/80',
                border: 'border-orange-400 dark:border-orange-300',
                hover: 'hover:from-orange-500/95 hover:to-red-600/95 dark:hover:from-orange-200/85 dark:hover:to-red-300/85',
                timeColor: 'text-white dark:text-white'
            },
            // Electric Ocean (Cyan to Blue)
            {
                gradient: 'from-cyan-400/90 to-blue-500/90 dark:from-cyan-300/80 dark:to-blue-400/80',
                border: 'border-cyan-400 dark:border-cyan-300',
                hover: 'hover:from-cyan-500/95 hover:to-blue-600/95 dark:hover:from-cyan-200/85 dark:hover:to-blue-300/85',
                timeColor: 'text-white dark:text-white'
            },
            // Vibrant Forest (Green to Teal)
            {
                gradient: 'from-green-400/90 to-teal-500/90 dark:from-green-300/80 dark:to-teal-400/80',
                border: 'border-green-400 dark:border-green-300',
                hover: 'hover:from-green-500/95 hover:to-teal-600/95 dark:hover:from-green-200/85 dark:hover:to-teal-300/85',
                timeColor: 'text-white dark:text-white'
            },
            // Electric Magenta to Pink
            {
                gradient: 'from-fuchsia-400/90 to-rose-500/90 dark:from-fuchsia-300/80 dark:to-rose-400/80',
                border: 'border-fuchsia-400 dark:border-fuchsia-300',
                hover: 'hover:from-fuchsia-500/95 hover:to-rose-600/95 dark:hover:from-fuchsia-200/85 dark:hover:to-rose-300/85',
                timeColor: 'text-white dark:text-white'
            },
            // Vibrant Sunrise (Yellow to Orange)
            {
                gradient: 'from-yellow-400/90 to-orange-500/90 dark:from-yellow-300/80 dark:to-orange-400/80',
                border: 'border-yellow-400 dark:border-yellow-300',
                hover: 'hover:from-yellow-500/95 hover:to-orange-600/95 dark:hover:from-yellow-200/85 dark:hover:to-orange-300/85',
                timeColor: 'text-white dark:text-white'
            },
            // Electric Turquoise to Cyan
            {
                gradient: 'from-teal-400/90 to-cyan-500/90 dark:from-teal-300/80 dark:to-cyan-400/80',
                border: 'border-teal-400 dark:border-teal-300',
                hover: 'hover:from-teal-500/95 hover:to-cyan-600/95 dark:hover:from-teal-200/85 dark:hover:to-cyan-300/85',
                timeColor: 'text-white dark:text-white'
            },
            // Vibrant Grape (Purple to Indigo)
            {
                gradient: 'from-purple-400/90 to-indigo-500/90 dark:from-purple-300/80 dark:to-indigo-400/80',
                border: 'border-purple-400 dark:border-purple-300',
                hover: 'hover:from-purple-500/95 hover:to-indigo-600/95 dark:hover:from-purple-200/85 dark:hover:to-indigo-300/85',
                timeColor: 'text-white dark:text-white'
            },
            // Electric Lime to Yellow
            {
                gradient: 'from-lime-400/90 to-yellow-500/90 dark:from-lime-300/80 dark:to-yellow-400/80',
                border: 'border-lime-400 dark:border-lime-300',
                hover: 'hover:from-lime-500/95 hover:to-yellow-600/95 dark:hover:from-lime-200/85 dark:hover:to-yellow-300/85',
                timeColor: 'text-white dark:text-white'
            },
            // Vibrant Berry (Red to Fuchsia)
            {
                gradient: 'from-red-400/90 to-fuchsia-500/90 dark:from-red-300/80 dark:to-fuchsia-400/80',
                border: 'border-red-400 dark:border-red-300',
                hover: 'hover:from-red-500/95 hover:to-fuchsia-600/95 dark:hover:from-red-200/85 dark:hover:to-fuchsia-300/85',
                timeColor: 'text-white dark:text-white'
            },
            // Electric Aqua to Sky
            {
                gradient: 'from-sky-400/90 to-cyan-500/90 dark:from-sky-300/80 dark:to-cyan-400/80',
                border: 'border-sky-400 dark:border-sky-300',
                hover: 'hover:from-sky-500/95 hover:to-cyan-600/95 dark:hover:from-sky-200/85 dark:hover:to-cyan-300/85',
                timeColor: 'text-white dark:text-white'
            }
        ],

        // Primary button styling
        PRIMARY_BUTTON: 'from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-700 hover:via-blue-800 hover:to-indigo-800',

        // Term button styling  
        TERM_BUTTON: {
            ACTIVE: 'bg-blue-500 hover:bg-blue-600 text-white border-blue-500',
            INACTIVE: 'bg-gray-200 hover:bg-gray-300 text-gray-700 border-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 dark:border-gray-600'
        },

        // Animation and transition durations
        TRANSITIONS: {
            FAST: 'duration-200',
            NORMAL: 'duration-300',
            SLOW: 'duration-500'
        },

        // Layout breakpoints (responsive design)
        BREAKPOINTS: {
            MOBILE: 'sm:',      // 640px+
            TABLET: 'md:',      // 768px+ 
            DESKTOP: 'lg:',     // 1024px+
            LARGE_DESKTOP: 'xl:', // 1280px+
            THIRTEEN_INCH: '13inch:' // 1024px+ (custom breakpoint)
        },

        // Profile banners (config-driven, no hardcoding elsewhere)
        PROFILE_BANNERS: [
            { key: 'pastel-rainbow', label: 'Pastel Rainbow', className: 'from-pink-50 via-rose-50 to-amber-50 dark:from-pink-900/20 dark:via-rose-900/20 dark:to-amber-900/20' },
            { key: 'sky-lilac', label: 'Sky Lilac', className: 'from-sky-50 via-indigo-50 to-violet-50 dark:from-sky-900/20 dark:via-indigo-900/20 dark:to-violet-900/20' },
            { key: 'mint-peach', label: 'Mint Peach', className: 'from-emerald-50 via-teal-50 to-rose-50 dark:from-emerald-900/20 dark:via-teal-900/20 dark:to-rose-900/20' },
            { key: 'lemon-cream', label: 'Lemon Cream', className: 'from-yellow-50 via-amber-50 to-white dark:from-yellow-900/20 dark:via-amber-900/20 dark:to-white/0' },
            // Replace older red/"GG" style with fresh sets
            { key: 'starry-night', label: 'Starry Night', className: 'from-indigo-900/60 via-slate-900/60 to-black/60' },
            { key: 'cotton-candy', label: 'Cotton Candy', className: 'from-pink-100 via-rose-100 to-sky-100 dark:from-pink-900/20 dark:via-rose-900/20 dark:to-sky-900/20' },
            { key: 'ocean-breeze', label: 'Ocean Breeze', className: 'from-cyan-50 via-teal-50 to-blue-50 dark:from-cyan-900/20 dark:via-teal-900/20 dark:to-blue-900/20' },
            { key: 'sunset-glow', label: 'Sunset Glow', className: 'from-rose-100 via-orange-100 to-amber-100 dark:from-rose-900/20 dark:via-orange-900/20 dark:to-amber-900/20' },
            { key: 'forest-mist', label: 'Forest Mist', className: 'from-emerald-100 via-lime-100 to-teal-100 dark:from-emerald-900/20 dark:via-lime-900/20 dark:to-teal-900/20' },
            { key: 'lavender-dream', label: 'Lavender Dream', className: 'from-violet-100 via-purple-100 to-indigo-100 dark:from-violet-900/20 dark:via-purple-900/20 dark:to-indigo-900/20' },
            { key: 'bubblegum-pop', label: 'Bubblegum Pop', className: 'from-fuchsia-200 via-pink-200 to-rose-200 dark:from-fuchsia-900/20 dark:via-pink-900/20 dark:to-rose-900/20' },
            { key: 'cream-soda', label: 'Cream Soda', className: 'from-amber-100 via-orange-100 to-rose-100 dark:from-amber-900/20 dark:via-orange-900/20 dark:to-rose-900/20' },
            { key: 'mint-latte', label: 'Mint Latte', className: 'from-emerald-50 via-teal-50 to-lime-100 dark:from-emerald-900/20 dark:via-teal-900/20 dark:to-lime-900/20' },
            { key: 'blueberry-milk', label: 'Blueberry Milk', className: 'from-indigo-100 via-sky-100 to-cyan-100 dark:from-indigo-900/20 dark:via-sky-900/20 dark:to-cyan-900/20' },
            { key: 'none', label: 'None', className: '' }
        ],

        PROFILE_MODES: [
            { key: 'lock-in', label: 'Lock-in Mode', emoji: '🔒', hint: 'Focus. No distractions.', overlayClass: 'bg-black/20 backdrop-blur-[1px]' },
            { key: 'study', label: 'Study Mode', emoji: '📚', hint: 'Calm, concentrated vibes.', overlayClass: 'bg-blue-200/20' },
            { key: 'grind', label: 'Grind Mode', emoji: '💪', hint: 'Heads down, get it done.', overlayClass: 'bg-amber-200/20' },
            { key: 'chill', label: 'Chill Mode', emoji: '🧋', hint: 'Relaxed and cozy.', overlayClass: 'bg-emerald-200/20' },
            { key: 'sparkle', label: 'Sparkle Mode', emoji: '✨', hint: 'Cute and shiny.', overlayClass: 'bg-pink-200/20' },
            { key: 'kawaii', label: 'Kawaii Mode', emoji: '🎀', hint: 'Extra adorable UI.', overlayClass: 'bg-rose-200/20' },
            { key: 'night-owl', label: 'Night Owl', emoji: '🌙', hint: 'Best after dark.', overlayClass: 'bg-slate-900/30' },
            { key: 'sunny', label: 'Sunny Mode', emoji: '☀️', hint: 'Bright and upbeat.', overlayClass: 'bg-yellow-200/20' },
            { key: 'none', label: 'None', emoji: '⚙️', hint: 'Default appearance', overlayClass: '' }
        ],

        // Removed PROFILE_BADGES (deprecated)
    },

    // Contact and Support Configuration
    CONTACT: {
        SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@kairo.ai',
        ADMIN_EMAIL: process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@kairo.ai',
        CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contact@kairo.ai',
    },

    // User and Session Configuration
    USER: {
        DEFAULT_AVATAR: '/images/default-avatar.png',
        SESSION_TIMEOUT: 60 * 60 * 1000, // 1 hour in milliseconds
        REMEMBER_ME_DURATION: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
        MAX_LOGIN_ATTEMPTS: 5
    },

    // API and Data Configuration
    API: {
        // API Base URL
        BASE_URL: process.env.NEXT_PUBLIC_API_URL ||
            (typeof window !== 'undefined' && window.location.hostname === 'localhost'
                ? 'http://localhost:8000'
                : 'https://kairopublic-production.up.railway.app'),

        // Course data file mappings
        COURSE_DATA_FILES: {
            'Fall': '/all_courses_fall_2025.json',
            'Spring/Summer': '/all_courses_spring_summer_2025.json',
            'Winter': '/all_courses_winter_2026.json'
        },

        // Default pagination and limits
        PAGINATION: {
            DEFAULT_PAGE_SIZE: 50,
            MAX_PAGE_SIZE: 200,
            SEARCH_RESULTS_LIMIT: 100
        },

        // Request timeouts
        TIMEOUTS: {
            DEFAULT: 10000, // 10 seconds
            SEARCH: 15000,  // 15 seconds
            UPLOAD: 30000   // 30 seconds
        }
    },

    // Schedule Generation Configuration
    SCHEDULING: {
        // Default time preferences
        DEFAULT_PREFERENCES: {
            NO_EARLY_CLASSES: false,      // Allow 8:30 AM classes by default
            NO_LATE_CLASSES: false,       // Allow evening classes by default
            AVOID_FRIDAY: false,          // Allow Friday classes by default
            PREFER_COMPACT: true,         // Prefer classes close together
            MAX_GAP_HOURS: 4              // Maximum 4-hour gap between classes
        },

        // Time validation and constraints
        TIME_CONSTRAINTS: {
            EARLIEST_CLASS: '07:00',      // 7:00 AM
            LATEST_CLASS: '22:00',        // 10:00 PM
            LUNCH_BREAK_MIN: 60,          // Minimum 1-hour lunch break
            TYPICAL_CLASS_DURATION: 80    // 80 minutes (1h 20m)
        },

        // Course load recommendations
        COURSE_LOAD: {
            MINIMUM_COURSES: 3,
            TYPICAL_COURSES: 5,
            MAXIMUM_COURSES: 8,
            FULL_TIME_MINIMUM: 4
        }
    },

    // Application Metadata
    APP: {
        NAME: 'Kairo',
        VERSION: '2.1.0',
        DESCRIPTION: 'University of Ottawa Academic Assistant',
        DEVELOPER: 'Kairo Team',

        // Session and storage configuration
        SESSION: {
            EXPIRY_DAYS: 7,
            MAX_HISTORY_MESSAGES: 10,
            MIN_CONTEXT_MESSAGES: 5
        },

        // Feature flags
        FEATURES: {
            DARK_MODE: true,
            CALENDAR_INTEGRATION: true,
            SCHEDULE_GENERATION: true,
            COURSE_RECOMMENDATIONS: true,
            PROFESSOR_RATINGS: true,
            MOBILE_RESPONSIVE: true
        }
    }
} as const;

// Type definitions for configuration
export type TermKey = keyof typeof APP_CONFIG.ACADEMIC.TERMS;
export type ColorScheme = typeof APP_CONFIG.UI.EVENT_COLOR_SCHEMES[0];

// Helper functions to work with configuration
export const getTermConfig = (termKey: string) => {
    const term = Object.values(APP_CONFIG.ACADEMIC.TERMS).find(t =>
        t.key === termKey || t.dataKey === termKey || t.displayName === termKey
    );
    return term || APP_CONFIG.ACADEMIC.TERMS.FALL; // Fallback to Fall
};

export const getDefaultTerm = () => APP_CONFIG.ACADEMIC.TERMS.FALL;

export const getAllTerms = () => Object.values(APP_CONFIG.ACADEMIC.TERMS);

export const getColorSchemeByIndex = (index: number) => {
    return APP_CONFIG.UI.EVENT_COLOR_SCHEMES[index % APP_CONFIG.UI.EVENT_COLOR_SCHEMES.length];
}; 