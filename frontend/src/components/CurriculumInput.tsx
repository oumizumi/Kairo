'use client';

import React, { useState } from 'react';
import { Sparkles, BookOpen, AlertCircle, CheckCircle2 } from 'lucide-react';
import { curriculumService, type MatchResult } from '@/lib/curriculumService';

interface CurriculumInputProps {
    onCoursesFound: (courses: string[], notes: string[], matchResult?: MatchResult) => void;
}

const CurriculumInput: React.FC<CurriculumInputProps> = ({ onCoursesFound }) => {
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<MatchResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const generatePlaceholderEvents = (courses: string[]) => {
        // Common time slots for courses
        const timeSlots = [
            { start: '09:30', end: '10:50' },
            { start: '11:00', end: '12:20' },
            { start: '13:00', end: '14:20' },
            { start: '14:30', end: '15:50' },
            { start: '16:00', end: '17:20' }
        ];

        // Days of the week for courses
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

        return courses.map((course, index) => {
            const timeSlot = timeSlots[index % timeSlots.length];
            const day = days[index % days.length];

            return {
                id: index + 1,
                title: course,
                startTime: timeSlot.start,
                endTime: timeSlot.end,
                day_of_week: day,
                description: 'Course from curriculum - placeholder times'
            };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const matchResult = await curriculumService.matchCurriculum(input.trim());

            if (matchResult) {
                setResult(matchResult);
                onCoursesFound(matchResult.courses, matchResult.notes, matchResult);
            } else {
                setError('Could not match your input to a program. Try phrases like "I\'m a first year fall Computer Science student" or "second year winter Mechanical Engineering".');
            }
        } catch (err) {
            setError('Error loading curriculum data. Please try again.');
            console.error('Curriculum matching error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const examples = [
        "I'm a first year fall Computer Science student",
        "second year winter Computer Science",
        "third year fall CS",
        "I'm in first year fall computer science"
    ];

    return (
        <div className="curriculum-input-container bg-white dark:bg-[#121212] rounded-xl border border-gray-200 dark:border-white/5 p-6 shadow-lg dark:shadow-[0_0_4px_rgba(255,255,255,0.05)]">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Load Your Curriculum
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Tell me your program, year, and term to see your courses
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        👤 Guest Mode - Changes won't be saved
                    </p>
                </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="curriculum-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Describe your academic status
                    </label>
                    <input
                        id="curriculum-input"
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="e.g., I'm a first year fall Computer Science student"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        disabled={isLoading}
                    />
                </div>

                <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-700 hover:via-blue-800 hover:to-indigo-800 disabled:from-gray-400 disabled:via-gray-500 disabled:to-gray-600 text-white rounded-lg transition-all duration-300 font-medium flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:shadow-blue-500/25 transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-md disabled:transform-none disabled:shadow-none disabled:cursor-not-allowed relative overflow-hidden group"
                >
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out"></div>

                    {/* Button content */}
                    <div className="relative flex items-center gap-2">
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Loading...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                                <span>Find My Courses</span>
                            </>
                        )}
                    </div>
                </button>
            </form>

            {/* Examples */}
            <div className="mt-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Try these examples:</p>
                <div className="flex flex-wrap gap-2">
                    {examples.map((example, index) => (
                        <button
                            key={index}
                            onClick={() => setInput(example)}
                            className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-md transition-colors"
                            disabled={isLoading}
                        >
                            {example}
                        </button>
                    ))}
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-700 dark:text-red-300">
                        {error}
                    </div>
                </div>
            )}

            {/* Success State */}
            {result && (
                <div className="mt-4 space-y-3">
                    {/* Match Summary */}
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-green-700 dark:text-green-300">
                            Found <strong>{result.program.program}</strong> - Year {result.year} {result.term}
                            <br />
                            <span className="text-xs text-green-600 dark:text-green-400">
                                {result.courses.length} courses loaded as placeholder events
                            </span>
                        </div>
                    </div>

                    {/* Courses List */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                            Courses for {result.term} {result.year}:
                        </h4>
                        <div className="space-y-1">
                            {result.courses.map((course, index) => (
                                <div key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0"></div>
                                    {course}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Program Notes */}
                    {result.notes.length > 0 && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                                Program Notes:
                            </h4>
                            <div className="space-y-1">
                                {result.notes.map((note, index) => (
                                    <div key={index} className="text-xs text-blue-800 dark:text-blue-300">
                                        • {note}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CurriculumInput; 