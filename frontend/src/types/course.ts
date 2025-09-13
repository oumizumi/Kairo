// Detailed section info for individual components
export interface DetailedSection {
    code: string;              // "A00-LEC", "A01-LAB", etc.
    type: string;              // "LEC", "LAB", "TUT"
    instructor: string;        // "Lucia Moura"
    time: string;              // "Tu 1:00 PM - 2:20 PM"
    days: string[];            // ["Tu", "Th"]
    status: string;            // "Open"
}

// Section interface for individual course sections
export interface Section {
    sectionCode: string;       // "A00"
    sectionType: string;       // "LEC", "LAB", "TUT"
    instructor: string;        // "Lucia Moura"
    schedule: {
        days: string[];        // ["Tu", "Th"]
        time: string;          // "Tu 1:00 PM - 2:20 PM, Th 11:30 AM - 12:50 PM"
        dates: string;         // "Sep 3, 2025 to Dec 2, 2025"
    };
    status: string;            // "Open"
    meetingDates: string;      // Raw meeting dates from scraper
    groupId?: string;          // "A", "B", "C" - section group identifier
    detailedSections?: DetailedSection[]; // Individual LEC/LAB/TUT sections within this group
}

// New JSON structure interfaces
export interface LectureSection {
    section: string;           // "A00-LEC"
    days: string[];            // ["Tu", "Th"]
    time: string;              // "Tu 13:00 - 14:20, Th 11:30 - 12:50"
    instructor: string;        // "Lucia Moura"
    meetingDates: string;      // "2025-09-03 - 2025-12-02"
    status: string;            // "Open"
}

export interface LabSection {
    section: string;           // "A01-LAB"
    days: string[];            // ["Tu"]
    time: string;              // "Tu 10:00 - 11:20"
    instructor: string;        // "Lucia Moura"
    meetingDates: string;      // "2025-09-03 - 2025-12-02"
    status: string;            // "Open"
}

export interface TutorialSection {
    section: string;           // "A03-TUT"
    days: string[];            // ["Fr"]
    time: string;              // "Fr 17:30 - 18:50"
    instructor: string;        // "Lucia Moura"
    meetingDates: string;      // "2025-09-03 - 2025-12-02"
    status: string;            // "Open"
}

export interface SectionGroup {
    groupId: string;           // "A"
    labs: LabSection[];
    tutorials: TutorialSection[];
    lecture: LectureSection;
}

// New grouped course interface matching JSON structure
export interface CourseGrouped {
    courseCode: string;        // "CSI 2110"
    courseTitle: string;       // "Data Structures and Algorithms"
    subjectCode: string;       // "CSI"
    term: string;              // "2025 Fall Term"
    sectionGroups: {
        [key: string]: SectionGroup; // "A", "B", "C", "D"
    };
}

// Legacy course interface with sections - University of Ottawa courses
export interface CourseLegacy {
    id: string;
    code: string;              // "CSI2110"
    name: string;              // "Data Structures and Algorithms"
    credits: number;
    description: string;
    prerequisites?: string[];
    faculty: string;
    term: string;
    sections: Section[];       // Array of all sections for this course
}

// Course type - can be either format
export type Course = CourseGrouped | CourseLegacy;

// Type guards
export function isCourseGrouped(course: Course): course is CourseGrouped {
    return 'courseCode' in course && 'sectionGroups' in course;
}

export function isCourseLegacy(course: Course): course is CourseLegacy {
    return 'code' in course && 'sections' in course;
}

// Available subjects
export const subjects = [
    "CSI",
    "ENG",
    "ITI"
];

// Available terms (kept for backward compatibility)
export const terms = [
    "2025 Fall Term",
    "2025 Spring/Summer Term",
    "2026 Winter Term"
];

// Available faculties
export const faculties = [
    "All Faculties",
    "Faculty of Engineering",
    "Faculty of Science",
    "Faculty of Arts",
    "Faculty of Social Sciences",
    "Faculty of Medicine",
    "Faculty of Education",
    "Telfer School of Management"
];

// Courses array - will be populated from scraped data
export let courses: Course[] = [];

// Function to update courses array
export function setCourses(newCourses: Course[]) {
    courses.length = 0; // Clear existing
    courses.push(...newCourses); // Add new courses
}