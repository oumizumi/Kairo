import { Course, CourseGrouped, terms } from '../types/course';

// Course details interface for prerequisites and descriptions
interface CourseDetails {
    courseCode: string;
    courseTitle: string;
    units: string;
    description: string;
    prerequisites: string;
}

// Cache for course details data
let courseDetailsCache: { [subject: string]: CourseDetails[] } | null = null;
let courseDetailsCacheTimestamp: number = 0;

// Map terms to their corresponding data files
const TERM_FILE_MAP: { [key: string]: string } = {
    "2025 Fall Term": "/all_courses_fall_2025.json",
    "2026 Winter Term": "/all_courses_winter_2026.json",
    // Add simple term mappings for schedule generator
    "Fall": "/all_courses_fall_2025.json",
    "Winter": "/all_courses_winter_2026.json"
};

// Cache for storing course data with timestamps
interface CourseDataCache {
    data: CourseGrouped[];
    timestamp: number;
    term: string;
}

const courseCache = new Map<string, CourseDataCache>();
// Track in-flight fetches by term to coalesce concurrent loads
const inflightFetches = new Map<string, Promise<CourseGrouped[]>>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Helper function to check if cache is valid (less than 24 hours old)
function isCacheValid(cache: CourseDataCache): boolean {
    return Date.now() - cache.timestamp < CACHE_DURATION;
}

// Helper function to fetch and parse course data from JSON files (prefer browser cache when possible)
async function fetchCourseData(filePath: string, versionParam?: string): Promise<any> {
    try {
        const url = versionParam ? `${filePath}?v=${encodeURIComponent(versionParam)}` : filePath;
        const response = await fetch(url, { cache: 'force-cache' });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`❌ Error fetching data from ${filePath}:`, error);
        throw error;
    }
}

// Transform raw course data from backend format to CourseGrouped format
function transformToCourseGrouped(courseCode: string, sections: any[], term: string): CourseGrouped {
    // Extract subject code (e.g., "CSI" from "CSI 2110")
    const subjectCode = courseCode.split(' ')[0];

    // Get the first section's title (they should all be the same)
    const courseTitle = sections[0]?.courseTitle?.replace(/\s*\(\+\d+\s+combined\)/, '') || 'Unknown Course';

    // Group sections by type and create section groups
    const sectionGroups: { [key: string]: any } = {};

    sections.forEach((section, index) => {
        const sectionInfo = {
            section: section.section,
            instructor: section.instructor || 'TBA',
            time: section.schedule || 'TBA',
            location: section.location || 'TBA',
            meetingDates: getTermDateRange(term),
            days: parseScheduleDays(section.schedule || ''),
            capacity: 'TBA',
            enrolled: 'TBA',
            waitlist: 'TBA',
            notes: '',
            status: section.status || 'Unknown'
        };

        // Determine section type and group
        const sectionParts = section.section.split('-');
        const sectionType = sectionParts[1] || 'LEC';
        const groupId = sectionParts[0] || String.fromCharCode(65 + index); // A, B, C, etc.

        if (!sectionGroups[groupId]) {
            sectionGroups[groupId] = {
                groupId: groupId,
                lecture: null,
                labs: [],
                tutorials: []
            };
        }

        if (sectionType.includes('LEC')) {
            sectionGroups[groupId].lecture = sectionInfo;
        } else if (sectionType.includes('LAB')) {
            sectionGroups[groupId].labs.push(sectionInfo);
        } else if (sectionType.includes('TUT') || sectionType.includes('DGD')) {
            sectionGroups[groupId].tutorials.push(sectionInfo);
        } else {
            // Default to lecture if type is unclear
            sectionGroups[groupId].lecture = sectionInfo;
        }
    });

    return {
        courseCode: courseCode,
        courseTitle: courseTitle,
        subjectCode: subjectCode,
        term: term,
        sectionGroups: sectionGroups
    };
}

// Helper function to parse days from schedule string
function parseScheduleDays(schedule: string): string[] {
    if (!schedule || schedule === 'TBA') return [];

    const dayMap: { [key: string]: string } = {
        'Mo': 'Monday',
        'Tu': 'Tuesday',
        'We': 'Wednesday',
        'Th': 'Thursday',
        'Fr': 'Friday',
        'Sa': 'Saturday',
        'Su': 'Sunday'
    };

    const days: string[] = [];
    Object.keys(dayMap).forEach(shortDay => {
        if (schedule.includes(shortDay)) {
            days.push(dayMap[shortDay]);
        }
    });

    return days;
}

// Helper function to get date range for a term
function getTermDateRange(term: string): string {
    const termDates: { [key: string]: string } = {
        'Spring/Summer 2025': '2025-05-05 - 2025-07-29',
        'Fall 2025': '2025-09-03 - 2025-12-02',
        'Winter 2026': '2026-01-12 - 2026-04-15',
        'Fall': '2025-09-03 - 2025-12-02',
        'Winter': '2026-01-12 - 2026-04-15',
        'Summer': '2025-05-05 - 2025-07-29'
    };

    return termDates[term] || '2025-01-01 - 2025-12-31';
}

// Helper function to get faculty based on subject code
function getFaculty(subjectCode: string): string {
    const facultyMap: { [key: string]: string } = {
        'ADM': 'Telfer School of Management',
        'CSI': 'Faculty of Engineering',
        'ITI': 'Faculty of Engineering',
        'SEG': 'Faculty of Engineering',
        'CEG': 'Faculty of Engineering',
        'ELG': 'Faculty of Engineering',
        'MCG': 'Faculty of Engineering',
        'CVG': 'Faculty of Engineering',
        'CHG': 'Faculty of Engineering',
        'BMG': 'Faculty of Engineering',
        'ENG': 'Faculty of Arts',
        'FRA': 'Faculty of Arts',
        'ESP': 'Faculty of Arts',
        'MAT': 'Faculty of Science',
        'PHY': 'Faculty of Science',
        'CHM': 'Faculty of Science',
        'BIO': 'Faculty of Science',
        'ECO': 'Telfer School of Management',
        'PSY': 'Faculty of Social Sciences',
        'SOC': 'Faculty of Social Sciences',
        'POL': 'Faculty of Social Sciences',
        'HIS': 'Faculty of Arts',
        'PHI': 'Faculty of Arts'
    };

    return facultyMap[subjectCode] || 'University of Ottawa';
}

// Main function to load courses for a specific term with caching and auto-refresh
export async function loadCoursesForTerm(term: string): Promise<CourseGrouped[]> {
    console.log(`🎯 Loading courses for term: ${term}`);

    // Check if we have valid cached data
    const cached = courseCache.get(term);
    if (cached && isCacheValid(cached)) {
        console.log(`✅ Using cached data for ${term} (${cached.data.length} courses)`);
        return cached.data;
    }

    // Check for data version updates
    let shouldForceRefresh = false;
    let currentVersion: string | undefined = localStorage.getItem('courseDataVersion') || undefined;
    try {
        const versionResponse = await fetch(`/api/data/last_update.json`, { cache: 'no-cache' });
        if (versionResponse.ok) {
            const versionData = await versionResponse.json();
            const newVersion = versionData.version?.toString() || undefined;
            if (newVersion && currentVersion !== newVersion) {
                console.log(`🔄 New course data version detected: ${versionData.version}`);
                shouldForceRefresh = true;
                localStorage.setItem('courseDataVersion', newVersion);
                currentVersion = newVersion;
            }
        }
    } catch (error) {
        console.log('⚠️ Could not check data version, proceeding with normal cache logic');
    }

    // Force refresh if new version detected
    if (shouldForceRefresh) {
        console.log('🔄 Forcing cache refresh due to new data version');
        courseCache.delete(term);
    }

    // Coalesce concurrent loads per term
    if (inflightFetches.has(term)) {
        return inflightFetches.get(term)!;
    }

    const loadPromise = (async () => {
        let kairollData: any;
        try {
            // Fetch from Kairoll API endpoint (respect version for caching)
            const url = currentVersion
                ? `/api/data/all_courses_by_term.json?v=${encodeURIComponent(currentVersion)}`
                : `/api/data/all_courses_by_term.json`;
            const response = await fetch(url, { cache: 'force-cache' });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            kairollData = await response.json();
        // The data is organized by term keys (e.g., 'Fall 2025', 'Winter 2026', etc.)
        // Fix term matching - map frontend terms to JSON keys
        const termMapping: { [key: string]: string } = {
            // Full term names
            "2025 Fall Term": "Fall 2025",
            "2026 Winter Term": "Winter 2026",
            // Simple term names from curriculum service
            "Fall": "Fall 2025",
            "Winter": "Winter 2026"
        };
        let termKey = termMapping[term] || Object.keys(kairollData).find(key => key.toLowerCase().includes(term.toLowerCase()));
        if (!termKey) {
            // Fallback: use the first key if no match
            termKey = Object.keys(kairollData)[0];
        }

        const rawCourses = kairollData[termKey] || [];

        // Group courses by course code first
        const courseGroups: { [courseCode: string]: any[] } = {};
        rawCourses.forEach((section: any) => {
            const courseCode = section.code;
            if (!courseGroups[courseCode]) {
                courseGroups[courseCode] = [];
            }
            courseGroups[courseCode].push(section);
        });

        // Transform to CourseGrouped format
            const transformedCourses: CourseGrouped[] = Object.entries(courseGroups).map(([courseCode, sections]) =>
                transformToCourseGrouped(courseCode, sections as any[], termKey)
            );
            // Cache the new data
            courseCache.set(term, {
                data: transformedCourses,
                timestamp: Date.now(),
                term: term
            });
            return transformedCourses;
        } catch (error) {
            console.error(`❌ Error loading courses for ${term}:`, error);
            // Return cached data if available, even if expired
            if (cached) {
                console.log(`⚠️ Returning expired cached data for ${term}`);
                return cached.data;
            }
            return [];
        } finally {
            inflightFetches.delete(term);
        }
    })();

    inflightFetches.set(term, loadPromise);
    return loadPromise;
}

// Function to preload all terms (useful for initialization)
export async function preloadAllTerms(): Promise<void> {
    console.log(`🚀 Preloading all terms...`);

    const loadPromises = terms.map(async (term) => {
        try {
            await loadCoursesForTerm(term);
            console.log(`✅ Preloaded ${term}`);
        } catch (error) {
            console.error(`❌ Failed to preload ${term}:`, error);
        }
    });

    await Promise.all(loadPromises);
    console.log(`🎉 All terms preloaded`);
}

// Function to force refresh all cached data (manual refresh)
export async function refreshAllCourseData(): Promise<void> {
    console.log(`🔄 Force refreshing all course data...`);

    // Clear all cache
    courseCache.clear();

    // Reload all terms
    await preloadAllTerms();

    console.log(`✅ All course data refreshed`);
}

// Function to force clear cache (useful for debugging)
export function clearCourseCache(): void {
    console.log(`🗑️ Clearing all course data cache...`);
    courseCache.clear();
    console.log(`✅ Course cache cleared`);
}

// Function to check for and download updated course data
export async function checkForUpdates(): Promise<void> {
    // Checking for course data updates

    for (const term of terms) {
        const cached = courseCache.get(term);
        if (!cached || !isCacheValid(cached)) {
            console.log(`📥 Updating data for ${term}...`);
            await loadCoursesForTerm(term);
        }
    }

    console.log(`✅ Update check completed`);
}

// Auto-refresh functionality - call this on app startup
export function startAutoRefresh(): void {
    console.log(`⏰ Starting auto-refresh for course data (24-hour interval)`);

    // Check for updates immediately
    checkForUpdates();

    // Set up daily refresh
    setInterval(checkForUpdates, CACHE_DURATION);

    // Also check every hour for more frequent updates if needed
    setInterval(() => {
        const now = new Date();
        // Only do frequent checks during business hours (8 AM - 8 PM)
        if (now.getHours() >= 8 && now.getHours() <= 20) {
            checkForUpdates();
        }
    }, 60 * 60 * 1000); // Every hour
}

// Get cache status for debugging
export function getCacheStatus(): { [term: string]: { age: number; valid: boolean; courseCount: number } } {
    const status: { [term: string]: { age: number; valid: boolean; courseCount: number } } = {};

    for (const term of terms) {
        const cached = courseCache.get(term);
        if (cached) {
            const age = Date.now() - cached.timestamp;
            status[term] = {
                age: Math.round(age / (1000 * 60 * 60)), // Age in hours
                valid: isCacheValid(cached),
                courseCount: cached.data.length
            };
        } else {
            status[term] = {
                age: -1,
                valid: false,
                courseCount: 0
            };
        }
    }

    return status;
}

// Legacy function for backward compatibility
export async function loadCourseData(): Promise<CourseGrouped[]> {
    console.log(`🔄 Legacy loadCourseData called, defaulting to Fall 2025`);
    return loadCoursesForTerm("2025 Fall Term");
}

// Helper function to load course details from scrapers data
async function loadCourseDetails(): Promise<{ [subject: string]: CourseDetails[] }> {
    try {
        console.log('🔄 Loading course details from scrapers data...');

        // Use the scrapers data path - this should be accessible from the frontend
        const response = await fetch('/all_courses_complete.json');

        if (!response.ok) {
            throw new Error(`Failed to load course details: ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ Successfully loaded course details data');

        courseDetailsCache = data;
        courseDetailsCacheTimestamp = Date.now();

        return data;
    } catch (error) {
        console.error('❌ Error loading course details:', error);
        throw error;
    }
}

// Helper function to clean and format prerequisites
function cleanPrerequisites(prereqs: string): string {
    if (!prereqs || prereqs.trim() === '') {
        return 'None';
    }

    // Remove encoding artifacts (like Â, �, and other non-ASCII characters)
    let cleaned = prereqs.replace(/[ÂâÃ£Ã€Ã¡Ã¢Ã¯Â¿Â½Ã¦Ã§Ã¨Ã©Ã¼�]/g, ' ');

    // Remove multiple spaces and normalize
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Handle comma-separated prerequisites (comma means AND)
    if (cleaned.includes(',')) {
        const courses = cleaned.split(',').map(course => course.trim());
        if (courses.length === 2) {
            return `${courses[0]} AND ${courses[1]}`;
        } else if (courses.length > 2) {
            const lastCourse = courses.pop();
            return `${courses.join(', ')}, AND ${lastCourse}`;
        }
    }

    return cleaned.trim();
}

// Helper function to clean course descriptions
function cleanDescription(description: string): string {
    if (!description) return '';

    // Remove encoding artifacts (like Â, �, and other non-ASCII characters)
    let cleaned = description.replace(/[ÂâÃ£Ã€Ã¡Ã¢Ã¯Â¿Â½Ã¦Ã§Ã¨Ã©Ã¼�]/g, ' ');

    // Remove multiple spaces and normalize whitespace
    return cleaned.replace(/\s+/g, ' ').trim();
}

// Function to find course prerequisites and description
export async function getCourseDetails(courseCode: string): Promise<CourseDetails | null> {
    try {
        // Normalize course code (remove spaces, make uppercase)
        const normalizedCode = courseCode.replace(/\s+/g, '').toUpperCase();
        // Looking for course details

        // Load course details if not cached or cache is old (24 hours)
        if (!courseDetailsCache || Date.now() - courseDetailsCacheTimestamp > 24 * 60 * 60 * 1000) {
            console.log('🔄 [getCourseDetails] Loading course details cache...');
            await loadCourseDetails();
        }

        if (!courseDetailsCache) {
            console.error('❌ [getCourseDetails] No course details data available');
            return null;
        }

        // Searching through subjects

        // Search through all subjects for the course
        for (const [subject, courses] of Object.entries(courseDetailsCache)) {
            // Searching subject

            const course = courses.find(c => {
                const courseNormalized = c.courseCode.replace(/\s+/g, '').toUpperCase();
                const isMatch = courseNormalized === normalizedCode;



                return isMatch;
            });

            if (course) {
                // Clean up the course data
                const cleanedCourse: CourseDetails = {
                    ...course,
                    prerequisites: cleanPrerequisites(course.prerequisites),
                    description: cleanDescription(course.description)
                };

                console.log(`✅ [getCourseDetails] Found course details for ${courseCode}:`, cleanedCourse);
                return cleanedCourse;
            }
        }

        console.log(`❌ [getCourseDetails] No course details found for ${courseCode} (normalized: ${normalizedCode})`);



        return null;

    } catch (error) {
        console.error(`❌ [getCourseDetails] Error getting course details for ${courseCode}:`, error);
        return null;
    }
}

// Function to search courses by partial course code or title
export async function searchCourseDetails(query: string): Promise<CourseDetails[]> {
    try {
        const normalizedQuery = query.toLowerCase().trim();

        // Load course details if not cached
        if (!courseDetailsCache || Date.now() - courseDetailsCacheTimestamp > 24 * 60 * 60 * 1000) {
            await loadCourseDetails();
        }

        if (!courseDetailsCache) {
            return [];
        }

        const results: CourseDetails[] = [];

        // Search through all subjects
        for (const [subject, courses] of Object.entries(courseDetailsCache)) {
            for (const course of courses) {
                // Search in course code and title
                if (course.courseCode.toLowerCase().includes(normalizedQuery) ||
                    course.courseTitle.toLowerCase().includes(normalizedQuery)) {
                    results.push(course);
                }
            }
        }

        // Found matching courses
        return results.slice(0, 20); // Limit to 20 results

    } catch (error) {
        console.error(`❌ Error searching course details for "${query}":`, error);
        return [];
    }
}