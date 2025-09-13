'use client';

import React, { useState, useEffect } from 'react';
import { 
    ChevronDown, 
    ChevronUp, 
    Info, 
    GraduationCap, 
    Users, 
    BookOpen, 
    Award, 
    Target, 
    Calendar,
    Eye,
    EyeOff,
    Menu,
    X,
    Pin,
    PinOff
} from 'lucide-react';
import { ProgramSequence, YearSequence, TermSequence, CourseSequenceItem } from '@/services/programSequenceService';

interface ProgramSequenceDisplayProps {
    programSequence: ProgramSequence;
    yearRequested?: number;
    termRequested?: string;
    isFullSequence?: boolean;
}

const ProgramSequenceDisplay: React.FC<ProgramSequenceDisplayProps> = ({
    programSequence,
    yearRequested,
    termRequested,
    isFullSequence = false
}) => {
    // State management
    const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set([1]));
    const [expandedTerms, setExpandedTerms] = useState<Set<string>>(new Set());
    const [isCompactView, setIsCompactView] = useState<boolean>(false);
    const [showNotes, setShowNotes] = useState<boolean>(false);
    const [stickyYear, setStickyYear] = useState<number | null>(null);
    const [isMobile, setIsMobile] = useState<boolean>(false);

    // Mobile detection
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Mobile-specific: Collapse all by default, expand current year
    useEffect(() => {
        if (isMobile) {
            if (yearRequested) {
                setExpandedYears(new Set([yearRequested]));
            } else {
                setExpandedYears(new Set());
            }
        }
    }, [isMobile, yearRequested]);

    const toggleYear = (year: number) => {
        const newExpanded = new Set(expandedYears);
        if (newExpanded.has(year)) {
            newExpanded.delete(year);
        } else {
            newExpanded.add(year);
        }
        setExpandedYears(newExpanded);
    };

    const toggleTerm = (termKey: string) => {
        const newExpanded = new Set(expandedTerms);
        if (newExpanded.has(termKey)) {
            newExpanded.delete(termKey);
        } else {
            newExpanded.add(termKey);
        }
        setExpandedTerms(newExpanded);
    };

    const toggleCompactView = () => {
        setIsCompactView(!isCompactView);
        if (!isCompactView) {
            // When switching to compact, collapse all terms
            setExpandedTerms(new Set());
        }
    };

    const toggleStickyYear = (year: number) => {
        setStickyYear(stickyYear === year ? null : year);
    };

    const getTermColor = (term: string) => {
        // Term-specific accent; dark keeps translucent surfaces. Tailwind doesn't support directional border colors,
        // so we use global border color with only left width applied.
        switch (term) {
            case 'Winter':
                return 'border-l-2 border-violet-500 bg-white dark:bg-white/\[0.04\]';
            case 'Fall':
                return 'border-l-2 border-amber-400 bg-white dark:bg-white/\[0.04\]';
            case 'Summer':
                return 'border-l-2 border-emerald-500 bg-white dark:bg-white/\[0.04\]';
            case 'Spring':
                return 'border-l-2 border-lime-500 bg-white dark:bg-white/\[0.04\]';
            default:
                return 'border-l-2 border-indigo-400 bg-white dark:bg-white/\[0.04\]';
        }
    };

    // Rotate through a set of accent colors for year blocks to avoid repetition (deterministic by program)
    const YEAR_BORDER_CLASSES = ['border-indigo-500','border-violet-500','border-emerald-500','border-sky-500','border-amber-500','border-rose-500','border-fuchsia-500'];
    const YEAR_PILL_LIGHT = ['bg-indigo-600','bg-violet-600','bg-emerald-600','bg-sky-600','bg-amber-600','bg-rose-600','bg-fuchsia-600'];
    const YEAR_PILL_DARK = ['bg-indigo-500','bg-violet-500','bg-emerald-500','bg-sky-500','bg-amber-500','bg-rose-500','bg-fuchsia-500'];
    const hashSeed = `${programSequence.programName || ''}|${programSequence.academicYear || ''}`;
    const computeOffset = (s: string) => {
        let h = 0;
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return h % YEAR_BORDER_CLASSES.length;
    };
    const YEAR_OFFSET = computeOffset(hashSeed);
    const getYearAccentClass = (yearNumber: number) => YEAR_BORDER_CLASSES[(YEAR_OFFSET + (yearNumber % YEAR_BORDER_CLASSES.length)) % YEAR_BORDER_CLASSES.length];
    const getYearPillClasses = (yearNumber: number) => ({
        light: YEAR_PILL_LIGHT[(YEAR_OFFSET + (yearNumber % YEAR_PILL_LIGHT.length)) % YEAR_PILL_LIGHT.length],
        dark: YEAR_PILL_DARK[(YEAR_OFFSET + (yearNumber % YEAR_PILL_DARK.length)) % YEAR_PILL_DARK.length],
    });

    const getTermIcon = (term: string) => {
        switch (term) {
            case 'Fall': return '🍂';
            case 'Winter': return '❄️';
            case 'Summer': return '☀️';
            case 'Spring': return '🌸';
            default: return '📚';
        }
    };

    const getTermBadge = (term?: string) => {
        switch (term) {
            case 'Fall':
                return { label: 'Fall', lightBg: 'bg-amber-600', darkBg: 'bg-amber-600' };
            case 'Winter':
                return { label: 'Winter', lightBg: 'bg-violet-600', darkBg: 'bg-violet-500' };
            case 'Summer':
                return { label: 'Summer', lightBg: 'bg-emerald-600', darkBg: 'bg-emerald-600' };
            case 'Spring':
                return { label: 'Spring', lightBg: 'bg-lime-600', darkBg: 'bg-lime-600' };
            default:
                return { label: term || 'Term', lightBg: 'bg-indigo-600', darkBg: 'bg-[rgb(var(--accent-color))]' };
        }
    };

    const getProgramTypeInfo = (programName: string) => {
        const name = programName.toLowerCase();
        
        if (name.includes('joint')) {
            return {
                type: 'Joint Honours',
                icon: '🤝',
                color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200',
                description: 'Interdisciplinary Program'
            };
        }
        
        if (name.includes('option')) {
            return {
                type: 'Specialization',
                icon: '🎯',
                color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200',
                description: 'Focused Track'
            };
        }
        
        if (name.includes('co-op') || name.includes('coop')) {
            return {
                type: 'Co-op',
                icon: '💼',
                color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200',
                description: 'Work Experience'
            };
        }
        
        if (name.includes('honours')) {
            return {
                type: 'Honours',
                icon: '🏆',
                color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200',
                description: 'Advanced Study'
            };
        }
        
        return {
            type: 'Standard',
            color: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 border-gray-200',
            description: 'Degree Program'
        };
    };

    const renderCourse = (course: CourseSequenceItem, index: number, isCompact: boolean = false) => {
        const isElective = course.isElective || course.code.toLowerCase().includes('elective');
        
        if (isCompact) {
            return (
                <span
                    key={index}
                    className={`inline-flex items-center px-2 py-1 text-xs font-mono rounded-md transition-colors border ${
                        isElective 
                            ? 'border-amber-300 dark:border-white/10 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-white/5' 
                            : 'border-indigo-300 dark:border-white/10 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-white/5'
                    }`}
                    title={course.title || course.description}
                >
                    {course.code}
                </span>
            );
        }

        const compactPadding = isSpecificTermRequest ? 'p-3' : 'p-4';
        const compactGap = isSpecificTermRequest ? 'gap-2' : 'gap-3';
        const compactNumberSize = isSpecificTermRequest ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-xs';

        return (
            <article
                key={index}
                className={`group relative ${compactPadding} rounded-lg border transition-all duration-200 shadow-sm ${
                    isElective 
                        ? 'border-amber-300 dark:border-white/10 bg-amber-50 dark:bg-white/[0.04]' 
                        : 'border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04]'
                } hover:bg-gray-50 dark:hover:bg-white/[0.07]`}
                role="listitem"
            >
                <div className={`flex items-start ${compactGap}`}>
                    <div className={`flex-shrink-0 ${compactNumberSize} rounded-lg flex items-center justify-center font-bold border ${
                        isElective 
                            ? 'border-amber-300 dark:border-white/15 text-amber-700 dark:text-amber-300 bg-amber-100/60 dark:bg-white/10' 
                            : 'border-indigo-300 dark:border-white/15 text-indigo-700 dark:text-indigo-300 bg-indigo-100/60 dark:bg-white/10'
                    }`}>
                        {String(index + 1).padStart(2, '0')}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <code className="text-sm font-bold text-gray-900 dark:text-white">
                                {course.code}
                            </code>
                        </div>
                        
                        {course.title && (
                            <h4 className={`font-medium text-gray-800 dark:text-gray-200 leading-relaxed ${
                                isSpecificTermRequest ? 'text-xs' : 'text-sm'
                            }`}>
                                {course.title}
                            </h4>
                        )}
                        
                        {course.description && course.description !== course.title && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                                {course.description}
                            </p>
                        )}
                    </div>
                </div>
            </article>
        );
    };

    const renderTerm = (term: TermSequence, year: number) => {
        const termKey = `${year}-${term.term}`;
        const isExpanded = expandedTerms.has(termKey);
        const isRequestedTerm = yearRequested === year && termRequested === term.term;
        const shouldHighlight = isRequestedTerm && !isFullSequence;

        return (
            <section
                key={termKey}
                className={`rounded-lg transition-all duration-200 bg-white dark:bg-white/[0.04] ${getTermColor(term.term)} ${
                    shouldHighlight 
                        ? 'ring-2 ring-amber-300 shadow-md' 
                        : 'border border-gray-200 dark:border-white/10 shadow-sm'
                }`}
                role="region"
                aria-labelledby={`term-header-${termKey}`}
            >
                <header>
                    <button
                        onClick={() => toggleTerm(termKey)}
                        className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors rounded-t-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-white/20"
                        aria-expanded={isExpanded}
                        aria-controls={`term-content-${termKey}`}
                        id={`term-header-${termKey}`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-lg" role="img" aria-label={`${term.term} term`}>
                                {getTermIcon(term.term)}
                            </span>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                    {term.term} Term
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {term.courses.length} {term.courses.length === 1 ? 'course' : 'courses'}
                                </p>
                            </div>
                        </div>
                        <ChevronDown 
                            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180' : ''
                            }`} 
                        />
                    </button>
                </header>
                
                {(isExpanded || isCompactView) && (
                    <div 
                        id={`term-content-${termKey}`}
                        className="px-4 pb-4"
                        role="list"
                        aria-label={`${term.term} term courses`}
                    >
                        {isCompactView ? (
                            <div className="flex flex-wrap gap-2">
                                {term.courses.map((course, index) => renderCourse(course, index, true))}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {term.courses.map((course, index) => renderCourse(course, index, false))}
                            </div>
                        )}
                    </div>
                )}
            </section>
        );
    };

    const renderYear = (yearData: YearSequence) => {
        const isExpanded = expandedYears.has(yearData.year);
        const isRequestedYear = yearRequested === yearData.year;
        const shouldHighlight = isRequestedYear && !termRequested && !isFullSequence;
        const isSticky = stickyYear === yearData.year;

        // For specific term requests, render just the term content directly
        if (isSpecificTermRequest && yearData.terms.length === 1) {
            const term = yearData.terms[0];
            return (
                <div key={`${yearData.year}-${term.term}`} className="space-y-4">
                    {/* Direct term rendering for clean display */}
                    <div className="rounded-lg border shadow-sm bg-white dark:bg-white/[0.04] border-gray-200 dark:border-white/10">
                        <div className={`p-3 border-l-4 ${getTermColor(term.term)} rounded-lg`}> 
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg" role="img" aria-label={`${term.term} term`}>
                                        {getTermIcon(term.term)}
                                    </span>
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                            {term.courses.length} {term.courses.length === 1 ? 'Course' : 'Courses'}
                                        </h2>
                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                            Required for this term
                                        </p>
                                    </div>
                                </div>
                                {(() => { const b = getTermBadge(term.term); return (
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-white text-xs font-semibold ${b.lightBg} dark:${b.darkBg}`}>
                                        {b.label}
                                    </span>
                                ); })()}
                            </div>
                            {/* Course List */}
                            <div className="space-y-2">
                                {term.courses.map((course, index) => renderCourse(course, index))}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <section
                key={yearData.year}
                className={`rounded-lg border transition-all duration-200 bg-white dark:bg-white/[0.04] border-l-4 ${getYearAccentClass(yearData.year)} ${
                    shouldHighlight 
                        ? 'border-indigo-300 dark:border-white/12 shadow' 
                        : 'border-gray-200 dark:border-white/10'
                } ${isSticky ? 'sticky top-4 z-10 shadow' : ''}`}
                role="region"
                aria-labelledby={`year-header-${yearData.year}`}
            >
                <header>
                    <div className="flex items-center justify-between p-4">
                        <button
                            onClick={() => toggleYear(yearData.year)}
                            className="flex items-center gap-4 flex-1 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-lg p-2 -m-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-[rgb(var(--accent-color))]"
                            aria-expanded={isExpanded}
                            aria-controls={`year-content-${yearData.year}`}
                            id={`year-header-${yearData.year}`}
                        >
                            {(() => { const p = getYearPillClasses(yearData.year); return (
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-white text-xs font-semibold ${p.light} dark:${p.dark}`}>
                                    Year {yearData.year}
                                </span>
                            ); })()}
                            <div>
                                {!isMobile && (
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        {yearData.terms.length} {yearData.terms.length === 1 ? 'term' : 'terms'} • {yearData.terms.reduce((t, term) => t + term.courses.length, 0)} courses
                                    </p>
                                )}
                            </div>
                        </button>
                        
                        <ChevronDown 
                            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180' : ''
                            }`} 
                        />
                    </div>
                </header>
                
                {isExpanded && (
                    <div 
                        id={`year-content-${yearData.year}`}
                        className="px-4 pb-4 space-y-4"
                    >
                        {yearData.terms.map(term => renderTerm(term, yearData.year))}
                    </div>
                )}
            </section>
        );
    };

    const filteredYears = () => {
        if (yearRequested && termRequested) {
            // For specific term requests, filter to only that year and term
            const targetYear = programSequence.years.find(year => year.year === yearRequested);
            if (targetYear) {
                const targetTerm = targetYear.terms.find(term => term.term === termRequested);
                if (targetTerm) {
                    return [{
                        year: targetYear.year,
                        terms: [targetTerm]
                    }];
                }
            }
            return [];
        } else if (yearRequested) {
            return programSequence.years.filter(year => year.year === yearRequested);
        }
        return programSequence.years;
    };

    const getDisplayTitle = () => {
        if (yearRequested && termRequested) {
            return `${termRequested} Term - Year ${yearRequested}`;
        } else if (yearRequested) {
            return `Year ${yearRequested}`;
        } else {
            return 'Complete Program Sequence';
        }
    };

    // Check if this is a specific term request (cleaner UI)
    const isSpecificTermRequest = yearRequested && termRequested;

    const programTypeInfo = getProgramTypeInfo(programSequence.programName);

    return (
        <main className="max-w-4xl mx-auto bg-white dark:bg-[rgb(var(--secondary-bg))] rounded-xl shadow-lg overflow-hidden">
            {/* Enhanced Header */}
            <header className={`p-3 sm:p-4 bg-white dark:bg-[rgb(var(--secondary-bg))] text-gray-900 dark:text-white border-b border-gray-200 dark:border-[rgb(var(--border-color))]`}>
                {isSpecificTermRequest ? (
                // Clean, focused header for specific term requests
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-base sm:text-lg font-semibold dark:text-white">{getDisplayTitle()}</h1>
                        <div className="text-gray-600 dark:text-gray-300 text-sm font-normal">
                            {programSequence.programName}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                            {programSequence.faculty} • {programSequence.degree}
                        </div>
                    </div>
                    {(() => { const b = getTermBadge(termRequested); return (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-white text-xs font-semibold ${b.lightBg} dark:${b.darkBg}`}>
                            {b.label}
                        </span>
                    ); })()}
                </div>
                ) : (
                    // Full header for complete sequences
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex-1">
                            
                            
                            <h1 className="text-xl lg:text-2xl font-bold leading-tight mb-1 dark:text-white">
                                {programSequence.programName}
                            </h1>
                            
                            <p className="text-gray-600 dark:text-gray-300 mb-2 text-sm">{programTypeInfo.description}</p>
                            
                            <div className="flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-400">
                                <span>{programSequence.faculty}</span>
                                <span>•</span>
                                <span>{programSequence.degree}</span>
                                {programSequence.totalUnits && (
                                    <>
                                        <span>•</span>
                                        <span>{programSequence.totalUnits} units</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Control Panel */}
                        <div className="flex flex-col gap-3">
                            <h2 className="text-sm font-semibold dark:text-white">{getDisplayTitle()}</h2>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={toggleCompactView}
                                    className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 rounded-md transition-colors text-xs font-medium text-gray-700 dark:text-white"
                                    aria-pressed={isCompactView}
                                >
                                    {isCompactView ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    {isCompactView ? 'Detailed' : 'Compact'}
                                </button>
                                
                                {programSequence.notes && programSequence.notes.length > 0 && (
                                    <button
                                        onClick={() => setShowNotes(!showNotes)}
                                        className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 rounded-md transition-colors text-xs font-medium text-gray-700 dark:text-white"
                                        aria-pressed={showNotes}
                                    >
                                        <Info className="w-4 h-4" />
                                        Notes
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Important Notes Banner */}
            {showNotes && programSequence.notes && programSequence.notes.length > 0 && (
                <section 
                    className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800 p-4"
                    role="complementary"
                    aria-label="Important program notes"
                >
                    <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
                                Important Program Notes
                            </h3>
                            <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-300">
                                {programSequence.notes.map((note, index) => (
                                    <li key={index} className="leading-relaxed">• {note}</li>
                                ))}
                            </ul>
                        </div>
                        <button
                            onClick={() => setShowNotes(false)}
                            className="p-1 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/30 rounded transition-colors"
                            aria-label="Close notes"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </section>
            )}

            {/* Course Sequence */}
            <div className={`${isSpecificTermRequest ? 'p-4 space-y-4 bg-gray-50 dark:bg-[rgb(var(--secondary-bg))]' : 'p-6 space-y-6'}`}>
                {filteredYears().map(year => renderYear(year))}
            </div>

            {/* Footer */}
            <footer className="bg-gray-50 border-t border-gray-200 p-4">
                <div className="text-center">
                    <p className="text-sm text-gray-600 font-medium mb-1">
                        Always confirm course requirements with your academic advisor
                    </p>
                    <p className="text-xs text-gray-500">
                        Academic requirements may change • Data from {programSequence.academicYear}
                    </p>
                </div>
            </footer>
        </main>
    );
};

export default ProgramSequenceDisplay;