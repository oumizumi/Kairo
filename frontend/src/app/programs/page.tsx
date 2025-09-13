'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { programSequenceService, ProgramMeta } from '@/services/programSequenceService';

export default function ProgramsIndexPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [programs, setPrograms] = useState<ProgramMeta[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const all = await programSequenceService.getAllPrograms();
        setPrograms(all);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load programs');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return programs;
    return programs.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.faculty.toLowerCase().includes(q) ||
      p.degree.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q)
    );
  }, [programs, query]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#121212] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-[#aaaaaa]">Loading programs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#121212] flex items-center justify-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#121212]">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Programs</h1>
          <p className="text-gray-600 dark:text-gray-400">Browse available program course sequences.</p>
          <div className="mt-4">
            <input
              type="text"
              placeholder="Search by program name, faculty, degree, or code"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full sm:w-96 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <Link key={p.id} href={`/programs/${p.id}`} className="block group">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-colors bg-white dark:bg-[#1b1b1b]">
                <div className="text-sm text-gray-500 dark:text-gray-400">{p.faculty} • {p.degree}</div>
                <div className="mt-1 font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600">
                  {p.name}
                </div>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{p.code}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

