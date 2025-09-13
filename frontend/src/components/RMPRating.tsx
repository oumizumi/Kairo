import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { getRatingColorClasses, formatRating, getWouldTakeAgainColorClasses, formatWouldTakeAgain, RMPData } from '../utils/rmpUtils';
import RMPService from '../utils/rmpUtils';

interface RMPRatingProps {
    professorName: string;
    compact?: boolean;
    showDifficulty?: boolean;
    showWouldTakeAgain?: boolean;
}

const RMPRating: React.FC<RMPRatingProps> = ({
    professorName,
    compact = false,
    showDifficulty = false,
    showWouldTakeAgain = true
}) => {
    const [rmpData, setRmpData] = useState<RMPData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    // Fix hydration by only mounting on client
    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        const fetchRMPData = async () => {
            if (!professorName || professorName.toLowerCase() === 'staff') {
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const data = await RMPService.searchProfessor(professorName);
                setRmpData(data);
            } catch (err) {
                setError('Failed to load rating');
            } finally {
                setLoading(false);
            }
        };

        fetchRMPData();
    }, [professorName, mounted]);

    // Prevent hydration mismatch - only render on client
    if (!mounted) {
        return null;
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-gray-300 border-t-blue-600"></div>
            </div>
        );
    }

    if (error || !rmpData || (rmpData.rating === null && rmpData.wouldTakeAgain === null)) {
        // Show "N/A" for professors without any data instead of hiding completely
        if (professorName && professorName.toLowerCase() !== 'staff') {
            return (
                <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600">
                    N/A
                </div>
            );
        }
        return null; // Only hide for "Staff" or empty names
    }

    const colorClasses = getRatingColorClasses(rmpData.rating);

    if (compact) {
        const fullStars = rmpData.rating ? Math.round(rmpData.rating) : 0;
        const stars = Array.from({ length: 5 }, (_, i) => i < fullStars);
        const rmpUrl = rmpData.id ? `https://www.ratemyprofessors.com/professor/${rmpData.id}` : null;

        const content = (
            <div className="flex items-center gap-1">
                {/* RMP Rating - Keep exactly as is */}
                {rmpData.rating !== null && (
                    <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold">{formatRating(rmpData.rating)} RMP</span>
                        <div className="flex gap-0.5">
                            {stars.map((isFull, i) => (
                                <Star
                                    key={i}
                                    className="w-2 h-2"
                                    fill={isFull ? 'currentColor' : 'none'}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );

        // Separate Would Take Again component - with RMP link
        const wouldTakeAgainContent = rmpData.wouldTakeAgain !== null && rmpData.wouldTakeAgain !== undefined && (
            rmpUrl ? (
                <a
                    href={rmpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`px-1 py-0.5 rounded-full text-xs font-medium border ${colorClasses} hover:opacity-80 transition-opacity cursor-pointer whitespace-nowrap`}
                    onClick={(e) => e.stopPropagation()}
                >
                    Would take again: {formatWouldTakeAgain(rmpData.wouldTakeAgain)}
                </a>
            ) : (
                <div className={`px-1 py-0.5 rounded-full text-xs font-medium border ${colorClasses} whitespace-nowrap`}>
                    Would take again: {formatWouldTakeAgain(rmpData.wouldTakeAgain)}%
                </div>
            )
        );

        if (rmpUrl) {
            return (
                <div className="flex items-center gap-1 flex-nowrap">
                    {/* Would Take Again - Separate component */}
                    {wouldTakeAgainContent}

                    {/* RMP Rating - With link - more responsive sizing */}
                    <a
                        href={rmpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-1 rounded-full px-1 py-0.5 text-xs w-fit border ${colorClasses} hover:opacity-80 transition-opacity cursor-pointer whitespace-nowrap`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {content}
                    </a>
                </div>
            );
        }

        return (
            <div className="flex items-center gap-1 flex-nowrap">
                {/* Would Take Again - Separate component */}
                {wouldTakeAgainContent}

                {/* RMP Rating - Without link - more responsive sizing */}
                <div className={`flex items-center gap-1 rounded-full px-1 py-0.5 text-xs w-fit border ${colorClasses} whitespace-nowrap`}>
                    {content}
                </div>
            </div>
        );
    }

    return (
        <div className="inline-flex items-center gap-1 flex-nowrap">
            {/* Would Take Again - Separate component - fully responsive with RMP link */}
            {showWouldTakeAgain && rmpData.wouldTakeAgain !== null && (
                rmpData.id ? (
                    <a
                        href={`https://www.ratemyprofessors.com/professor/${rmpData.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center px-1 py-0.5 rounded-full border text-xs font-medium ${getWouldTakeAgainColorClasses(rmpData.wouldTakeAgain)} hover:opacity-80 transition-opacity cursor-pointer whitespace-nowrap`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        Would take again: {formatWouldTakeAgain(rmpData.wouldTakeAgain)}%
                    </a>
                ) : (
                    <div className={`inline-flex items-center px-1 py-0.5 rounded-full border text-xs font-medium ${getWouldTakeAgainColorClasses(rmpData.wouldTakeAgain)} whitespace-nowrap`}>
                        Would take again: {formatWouldTakeAgain(rmpData.wouldTakeAgain)}%
                    </div>
                )
            )}

            {/* RMP Rating - Keep exactly as is but fully responsive with RMP link */}
            {rmpData.rating !== null && (
                rmpData.id ? (
                    <a
                        href={`https://www.ratemyprofessors.com/professor/${rmpData.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center px-1 py-0.5 rounded-full border text-xs font-medium ${colorClasses} hover:opacity-80 transition-opacity cursor-pointer whitespace-nowrap`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {formatRating(rmpData.rating)} RMP
                    </a>
                ) : (
                    <div className={`inline-flex items-center px-1 py-0.5 rounded-full border text-xs font-medium ${colorClasses} whitespace-nowrap`}>
                        {formatRating(rmpData.rating)} RMP
                    </div>
                )
            )}
        </div>
    );
};

export default RMPRating; 