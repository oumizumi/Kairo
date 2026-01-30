import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

interface Event {
    id?: number;
    title: string;
    term?: string;
    [key: string]: any;
}

interface TermFilterBadgeProps {
    events: Event[];
    selectedTerm: string;
    onTermChange: (term: string) => void;
    className?: string;
}

const TermFilterBadge: React.FC<TermFilterBadgeProps> = ({ 
    events, 
    selectedTerm, 
    onTermChange, 
    className = '' 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const badgeRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    // Compute term counts
    const termCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const e of events) {
            const term = e.term || 'Unknown Term';
            counts[term] = (counts[term] || 0) + 1;
        }
        const total = events.length;
        return { counts, total };
    }, [events]);

    // Sort terms chronologically
    const sortedTerms = useMemo(() => {
        const termOrder: Record<string, number> = {
            'Fall': 1,
            'Winter': 2,
            'Spring': 3,
            'Summer': 4
        };

        return Object.keys(termCounts.counts).sort((a, b) => {
            // Extract year and season from term strings like "Fall 2025", "Winter 2026"
            const aMatch = a.match(/(Fall|Winter|Spring|Summer)\s+(\d{4})/);
            const bMatch = b.match(/(Fall|Winter|Spring|Summer)\s+(\d{4})/);

            if (!aMatch || !bMatch) {
                return a.localeCompare(b);
            }

            const [, aSeason, aYear] = aMatch;
            const [, bSeason, bYear] = bMatch;

            // Compare years first
            const yearDiff = parseInt(aYear) - parseInt(bYear);
            if (yearDiff !== 0) return yearDiff;

            // Then compare seasons
            return (termOrder[aSeason] || 0) - (termOrder[bSeason] || 0);
        });
    }, [termCounts.counts]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                badgeRef.current && 
                panelRef.current &&
                !badgeRef.current.contains(event.target as Node) &&
                !panelRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen]);

    const handleToggle = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(!isOpen);
    };

    const handleTermSelect = (term: string) => {
        onTermChange(term);
        setIsOpen(false);
    };

    const badgeLabel = selectedTerm === 'All Terms' 
        ? `${termCounts.total} courses`
        : `${termCounts.total} courses • ${selectedTerm}`;

    return (
        <div className="relative inline-block" ref={badgeRef}>
            {/* Badge */}
            <button
                onClick={handleToggle}
                onMouseEnter={() => setIsOpen(true)}
                className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-gray-800 dark:bg-gray-700 text-white hover:opacity-80 transition-opacity cursor-pointer ${className}`}
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                <span className="tabular-nums">{badgeLabel}</span>
                <ChevronDown className={`ml-1 w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Hover Card / Dropdown Panel */}
            {isOpen && (
                <div
                    ref={panelRef}
                    onMouseLeave={() => setIsOpen(false)}
                    className="absolute top-full left-0 mt-2 min-w-[200px] bg-cream dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
                    role="menu"
                >
                    {/* All Terms option */}
                    <button
                        onClick={() => handleTermSelect('All Terms')}
                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${
                            selectedTerm === 'All Terms' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-200'
                        }`}
                        role="menuitem"
                    >
                        <span>All Terms</span>
                        <span className={`tabular-nums text-xs ${selectedTerm === 'All Terms' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            {termCounts.total}
                        </span>
                    </button>

                    {/* Divider */}
                    {sortedTerms.length > 0 && (
                        <div className="h-px bg-gray-200 dark:bg-gray-700" />
                    )}

                    {/* Individual terms */}
                    {sortedTerms.map((term) => (
                        <button
                            key={term}
                            onClick={() => handleTermSelect(term)}
                            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${
                                selectedTerm === term ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-200'
                            }`}
                            role="menuitem"
                        >
                            <span>{term}</span>
                            <span className={`tabular-nums text-xs ${selectedTerm === term ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                {termCounts.counts[term]}
                            </span>
                        </button>
                    ))}

                    {/* Empty state */}
                    {sortedTerms.length === 0 && (
                        <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                            No courses to display
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TermFilterBadge;

