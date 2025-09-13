// RMP Rating Color System (0-5 scale) - Updated to match status badge colors
export const RMP_RATING_COLORS = {
    0: { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
    1: { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
    2: { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
    3: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    4: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
    5: { bg: 'bg-emerald-200', text: 'text-emerald-800', border: 'border-emerald-400' }
};

// Dark mode colors - Updated to match status badge colors
export const RMP_RATING_COLORS_DARK = {
    0: { bg: 'dark:bg-transparent', text: 'dark:text-rose-400', border: 'dark:border-white/10' },
    1: { bg: 'dark:bg-transparent', text: 'dark:text-rose-400', border: 'dark:border-white/10' },
    2: { bg: 'dark:bg-transparent', text: 'dark:text-rose-400', border: 'dark:border-white/10' },
    3: { bg: 'dark:bg-amber-900/35', text: 'dark:text-amber-100', border: 'dark:border-amber-300/50' },
    4: { bg: 'dark:bg-transparent', text: 'dark:text-emerald-400', border: 'dark:border-white/10' },
    5: { bg: 'dark:bg-transparent', text: 'dark:text-emerald-400', border: 'dark:border-white/10' }
};

export interface RMPData {
    id: string;
    name: string;
    rating: number | null;
    difficulty: number | null;
    department: string | null;
    numRatings: number | null;
    wouldTakeAgain: number | null;
}

// Get rating color classes
export const getRatingColorClasses = (rating: number | null): string => {
    if (rating === null || rating === 0) {
        return `${RMP_RATING_COLORS[0].bg} ${RMP_RATING_COLORS[0].text} ${RMP_RATING_COLORS[0].border} ${RMP_RATING_COLORS_DARK[0].bg} ${RMP_RATING_COLORS_DARK[0].text} ${RMP_RATING_COLORS_DARK[0].border}`;
    }

    const roundedRating = Math.round(rating) as keyof typeof RMP_RATING_COLORS;
    const colorKey = Math.min(Math.max(roundedRating, 1), 5) as keyof typeof RMP_RATING_COLORS;

    return `${RMP_RATING_COLORS[colorKey].bg} ${RMP_RATING_COLORS[colorKey].text} ${RMP_RATING_COLORS[colorKey].border} ${RMP_RATING_COLORS_DARK[colorKey].bg} ${RMP_RATING_COLORS_DARK[colorKey].text} ${RMP_RATING_COLORS_DARK[colorKey].border}`;
};

// Would Take Again Color System (0-100 percentage scale) - Updated with percentage-based colors
export const WOULD_TAKE_AGAIN_COLORS = {
    low: { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },            // 0-49%
    medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },       // 50-79%
    high: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },  // 80-99%
    perfect: { bg: 'bg-emerald-200', text: 'text-emerald-800', border: 'border-emerald-400' } // 100%
};

export const WOULD_TAKE_AGAIN_COLORS_DARK = {
    low: { bg: 'dark:bg-transparent', text: 'dark:text-rose-400', border: 'dark:border-white/10' },
    medium: { bg: 'dark:bg-amber-900/35', text: 'dark:text-amber-100', border: 'dark:border-amber-300/50' },
    high: { bg: 'dark:bg-transparent', text: 'dark:text-emerald-400', border: 'dark:border-white/10' },
    perfect: { bg: 'dark:bg-transparent', text: 'dark:text-emerald-400', border: 'dark:border-white/10' }
};

// Get Would Take Again color classes based on percentage
export const getWouldTakeAgainColorClasses = (percentage: number | null): string => {
    if (percentage === null) {
        return `${WOULD_TAKE_AGAIN_COLORS.medium.bg} ${WOULD_TAKE_AGAIN_COLORS.medium.text} ${WOULD_TAKE_AGAIN_COLORS.medium.border} ${WOULD_TAKE_AGAIN_COLORS_DARK.medium.bg} ${WOULD_TAKE_AGAIN_COLORS_DARK.medium.text} ${WOULD_TAKE_AGAIN_COLORS_DARK.medium.border}`;
    }

    let colorKey: keyof typeof WOULD_TAKE_AGAIN_COLORS;
    
    if (percentage === 100) {
        colorKey = 'perfect';  // 100% gets special perfect green
    } else if (percentage >= 80) {
        colorKey = 'high';     // 80-99% gets good green
    } else if (percentage >= 50) {
        colorKey = 'medium';   // 50-79% gets yellow
    } else {
        colorKey = 'low';      // 0-49% gets red
    }

    return `${WOULD_TAKE_AGAIN_COLORS[colorKey].bg} ${WOULD_TAKE_AGAIN_COLORS[colorKey].text} ${WOULD_TAKE_AGAIN_COLORS[colorKey].border} ${WOULD_TAKE_AGAIN_COLORS_DARK[colorKey].bg} ${WOULD_TAKE_AGAIN_COLORS_DARK[colorKey].text} ${WOULD_TAKE_AGAIN_COLORS_DARK[colorKey].border}`;
};

// Format rating for display
export const formatRating = (rating: number | null): string => {
    if (rating === null) return 'N/A';
    return rating.toFixed(1);
};

// Format would take again percentage for display
export const formatWouldTakeAgain = (percentage: number | null): string => {
    if (percentage === null) return 'N/A';
    return `${Math.round(percentage)}%`;
};

// RMP API Service
class RMPService {
    private static readonly API_BASE = (() => {
        const base = (process.env.NEXT_PUBLIC_API_URL || '').trim();
        if (base) {
            return `${base.replace(/\/+$/, '')}/api`;
        }
        return process.env.NODE_ENV === 'development' ? 'http://localhost:8000/api' : '/api';
    })();
    private static professorCache = new Map<string, RMPData>();
    private static staticData: any[] | null = null;

    // Load static data as fallback
    private static async loadStaticData(): Promise<any[]> {
        if (this.staticData) {
            return this.staticData;
        }

        try {
            // Try backend aggregated list first in production
            const apiResp = await fetch(`${this.API_BASE}/professors/rmp/`);
            if (apiResp.ok) {
                const data = await apiResp.json();
                if (data && Array.isArray(data.professors)) {
                    this.staticData = data.professors;
                    return this.staticData || [];
                }
            }
        } catch (error) {
            // Failed to load static data
        }

        // Final fallback: public file if present (dev/local)
        try {
            const response = await fetch('/professors_enhanced.json');
            if (response.ok) {
                this.staticData = await response.json();
                return this.staticData || [];
            }
        } catch {}

        this.staticData = [];
        return [];
    }

    // Search in static data
    private static searchInStaticData(name: string, staticData: any[]): RMPData | null {
        const cleanName = name.toLowerCase().trim();

        // Try exact match first
        let match = staticData.find(prof =>
            prof.name.toLowerCase().trim() === cleanName
        );

        // If no exact match, try partial match
        if (!match) {
            match = staticData.find(prof =>
                prof.name.toLowerCase().includes(cleanName) ||
                cleanName.includes(prof.name.toLowerCase())
            );
        }

        if (match && match.has_rmp_data && (match.rmp_rating || match.rmp_would_take_again)) {
            // FORCE PARSE INCLUDING ZERO VALUES
            const wouldTakeAgain = match.rmp_would_take_again !== null && match.rmp_would_take_again !== undefined
                ? parseFloat(match.rmp_would_take_again.toString())
                : null;

            return {
                id: match.rmp_id?.toString() || '',
                name: match.name,
                rating: match.rmp_rating ? parseFloat(match.rmp_rating) : null,
                difficulty: match.rmp_difficulty ? parseFloat(match.rmp_difficulty) : null,
                department: match.rmp_department || null,
                numRatings: null,
                wouldTakeAgain: wouldTakeAgain
            };
        }

        return null;
    }

    // Search for professor by name
    static async searchProfessor(name: string): Promise<RMPData | null> {
        if (!name || name.trim() === '' || name.toLowerCase() === 'staff') {
            return null;
        }

        // Check cache first
        const cacheKey = name.toLowerCase().trim();
        if (this.professorCache.has(cacheKey)) {
            return this.professorCache.get(cacheKey) || null;
        }

        // Try API first (both development and production)
        try {
            const response = await fetch(`${this.API_BASE}/professors/search/?name=${encodeURIComponent(name)}`);

            if (response.ok) {
                const data = await response.json();

                if (data.professors && data.professors.length > 0) {
                    const professor = data.professors[0];
                    const rmpData: RMPData = {
                        id: professor.rmp_id?.toString() || '',
                        name: professor.name || name,
                        rating: professor.rmp_rating ? parseFloat(professor.rmp_rating) : null,
                        difficulty: professor.rmp_difficulty ? parseFloat(professor.rmp_difficulty) : null,
                        department: professor.rmp_department || professor.department || null,
                        numRatings: null,
                        wouldTakeAgain: professor.rmp_would_take_again ? parseFloat(professor.rmp_would_take_again) : null
                    };

                    this.professorCache.set(cacheKey, rmpData);
                    return rmpData;
                }
            }
        } catch (error) {
            // API error, will fall back to static data below
        }

        // Fallback to static data (for production or when API fails)
        try {
            const staticData = await this.loadStaticData();
            const result = this.searchInStaticData(name, staticData);

            if (result) {
                this.professorCache.set(cacheKey, result);
                return result;
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    // Get multiple professors at once
    static async searchProfessors(names: string[]): Promise<Map<string, RMPData>> {
        const results = new Map<string, RMPData>();

        // Filter out invalid names
        const validNames = names.filter(name => name && name.trim() !== '' && name.toLowerCase() !== 'staff');

        // Process in batches to avoid overwhelming the API
        const batchSize = 5;
        for (let i = 0; i < validNames.length; i += batchSize) {
            const batch = validNames.slice(i, i + batchSize);
            const promises = batch.map(name => this.searchProfessor(name));

            try {
                const batchResults = await Promise.all(promises);
                batch.forEach((name, index) => {
                    const result = batchResults[index];
                    if (result) {
                        results.set(name.toLowerCase().trim(), result);
                    }
                });
            } catch (error) {
                // Error in batch processing
            }
        }

        return results;
    }

    // Clear cache
    static clearCache(): void {
        this.professorCache.clear();
    }
}

export default RMPService; 