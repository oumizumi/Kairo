'use client';

import React from 'react';
import { Info } from 'lucide-react';

interface Course {
    code: string;
    title: string;
    isElective: boolean;
    electiveType?: string;
}

interface CurriculumDisplayProps {
    program: string;
    year: number | string;
    term: string;
    courses: string[];
    notes: string[];
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

const CurriculumDisplay: React.FC<CurriculumDisplayProps> = ({
    program,
    year,
    term,
    courses,
    notes,
    isFullYear = false,
    fallCourses = [],
    winterCourses = [],
    structuredData
}) => {
    // Parse course strings into objects
    const parseCourse = (courseStr: string): Course => {
        if (courseStr.toLowerCase().includes('elective')) {
            const parts = courseStr.split(' | ');

            // Extract specific elective type from the description
            let electiveCode = 'Elective';
            let electiveType = 'General Elective';

            if (parts.length > 1) {
                const description = parts[1];
                electiveType = description;

                // Extract specific course codes/types from common patterns
                if (description.includes('MAT 3000')) {
                    electiveCode = 'MAT 3000+';
                } else if (description.includes('CSI')) {
                    electiveCode = 'CSI Elective';
                } else if (description.includes('Free')) {
                    electiveCode = 'Free Elective';
                } else if (description.includes('General')) {
                    electiveCode = 'General Elective';
                } else if (description.includes('Science')) {
                    electiveCode = 'Science Elective';
                } else if (description.includes('Engineering')) {
                    electiveCode = 'Eng Elective';
                } else {
                    // Try to extract course prefix from description
                    const match = description.match(/([A-Z]{3,4})\s*(\d{4})/);
                    if (match) {
                        electiveCode = `${match[1]} ${match[2]}+`;
                    }
                }
            }

            return {
                code: electiveCode,
                title: parts.length > 1 ? parts[1] : 'Elective',
                isElective: true,
                electiveType: electiveType
            };
        } else {
            const parts = courseStr.split(' | ');
            return {
                code: parts[0] || courseStr,
                title: parts[1] || 'Course Title',
                isElective: false
            };
        }
    };

    // For full year display, use provided Fall and Winter courses or separate from all courses
    const separateTermCourses = (allCourses: string[]) => {
        // Use provided term-specific data if available
        if (fallCourses.length > 0 || winterCourses.length > 0) {
            return {
                fall: fallCourses,
                winter: winterCourses
            };
        }

        // Fallback: simplified separation for backward compatibility
        const midpoint = Math.ceil(allCourses.length / 2);
        return {
            fall: allCourses.slice(0, midpoint),
            winter: allCourses.slice(midpoint)
        };
    };

    const renderCourseTable = (termCourses: string[], termName: string, yearNum?: number) => {
        // Filter out fake rows (dashes, emojis, etc.)
        const cleanCourses = termCourses.filter(course =>
            !course.includes('---') &&
            !course.includes('Year ') &&
            !course.includes('Term:') &&
            !course.match(/^\s*\d+\.\s*$/) &&
            course.trim() !== ''
        );

        const parsedCourses = cleanCourses.map(parseCourse);

        const getTermEmoji = (term: string) => {
            switch (term) {
                case 'Fall': return '🍂';
                case 'Winter': return '❄️';
                case 'Summer': return '☀️';
                case 'Spring': return '🌸';
                default: return '📚';
            }
        };

        const headerText = yearNum
            ? `${getTermEmoji(termName)} Year ${yearNum} – ${termName} Term`
            : `${getTermEmoji(termName)} ${termName} Term`;

        return (
            <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    {headerText}
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 dark:border-gray-600 rounded-lg">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800">
                                <th className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                    #
                                </th>
                                <th className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                    Course Code
                                </th>
                                <th className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                    Course Title
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {parsedCourses.map((course, index) => {
                                // Calculate sequential number for this term (including electives)
                                const courseNumber = index + 1;

                                return (
                                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                        <td className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-sm text-gray-900 dark:text-white">
                                            {courseNumber}
                                        </td>
                                        <td className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                            {course.isElective ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-blue-600 dark:text-blue-400">{course.code}</span>
                                                    <div className="group relative">
                                                        <Info className="w-4 h-4 text-gray-400 hover:text-blue-500 cursor-help" />
                                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-[#1e1e1e] text-[#e0e0e0] text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10 shadow-[0_0_4px_rgba(255,255,255,0.05)]">
                                                            {course.electiveType}
                                                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-[#1e1e1e]"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                course.code
                                            )}
                                        </td>
                                        <td className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                                            {course.isElective ? (
                                                <span className="italic text-gray-500 dark:text-gray-400">
                                                    (User selects)
                                                </span>
                                            ) : (
                                                course.title
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderFullSequence = () => {
        if (!structuredData) return null;

        return (
            <div className="space-y-8">
                {structuredData.years.map((yearData, yearIndex) => (
                    <div key={yearIndex}>
                        {yearData.terms.map((termData, termIndex) => (
                            <div key={`${yearIndex}-${termIndex}`}>
                                {renderCourseTable(termData.courses, termData.term, yearData.year)}
                                {/* Add spacing between years, but not after the last term */}
                                {termIndex === yearData.terms.length - 1 && yearIndex < structuredData.years.length - 1 && (
                                    <div className="h-4"></div>
                                )}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        );
    };

    const renderNotes = () => {
        if (notes.length === 0) return null;

        return (
            <div className="mt-6 rounded-xl bg-[#1A1C20] border border-[#2A2D32] px-6 py-4 text-sm text-gray-300 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-base font-semibold text-white">
                    <span>⚠️ Important Notes</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                    {notes.map((note, index) => (
                        <li key={index} dangerouslySetInnerHTML={{
                            __html: note.replace(/\*\*(.*?)\*\*/g, '<span class="text-white font-medium">$1</span>')
                        }} />
                    ))}
                </ul>
            </div>
        );
    };

    const getYearDisplay = () => {
        if (typeof year === 'string' && year.startsWith('year')) {
            const yearNum = year.replace('year', '');
            return `${yearNum}${yearNum === '1' ? 'st' : yearNum === '2' ? 'nd' : yearNum === '3' ? 'rd' : 'th'} Year (Full Year)`;
        }
        return `${year}${year === 1 ? 'st' : year === 2 ? 'nd' : year === 3 ? 'rd' : 'th'} Year`;
    };

    return (
        <div className="curriculum-display bg-white dark:bg-[#121212] rounded-xl border border-gray-200 dark:border-white/5 p-6 shadow-lg dark:shadow-[0_0_4px_rgba(255,255,255,0.05)]">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    🎓 {program}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                    {getYearDisplay()} - {isFullYear ? 'Complete Academic Year' : `${term} Term`}
                </p>
            </div>

            {/* Course Tables */}
            {structuredData ? (
                // Full sequence display with clean separate tables
                renderFullSequence()
            ) : isFullYear ? (
                // Full year display with Fall and Winter tables
                (() => {
                    const { fall, winter } = separateTermCourses(courses);
                    return (
                        <>
                            {renderCourseTable(fall, 'Fall')}
                            {renderCourseTable(winter, 'Winter')}
                        </>
                    );
                })()
            ) : (
                // Single term display
                renderCourseTable(courses, term)
            )}

            {/* Notes */}
            {renderNotes()}

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    Please confirm with your academic advisor, as requirements may vary.
                </p>
            </div>
        </div>
    );
};

export default CurriculumDisplay; 