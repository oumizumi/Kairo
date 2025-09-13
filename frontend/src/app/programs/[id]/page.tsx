'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ProgramSequenceDisplay from '@/components/ProgramSequenceDisplay';
import { programSequenceService, ProgramSequence, ProgramMeta } from '@/services/programSequenceService';

export default function ProgramPage() {
  const params = useParams();
  const programId = (params.id as string) || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sequence, setSequence] = useState<ProgramSequence | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const programs: ProgramMeta[] = await programSequenceService.getAllPrograms();
        const meta = programs.find(p => p.id === programId);
        if (!meta) {
          setError('Program not found.');
          return;
        }

        const s = await programSequenceService.loadProgramSequence(meta.file);
        // Ensure metadata from index is applied
        s.faculty = meta.faculty;
        s.degree = meta.degree;
        if (!s.programName || s.programName === 'Unknown Program') {
          // Prefer catalog name from index when missing
          (s as any).programName = meta.name;
        }
        setSequence(s);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load program');
      } finally {
        setLoading(false);
      }
    };

    if (programId) load();
  }, [programId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#121212] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-[#aaaaaa]">Loading program...</p>
        </div>
      </div>
    );
  }

  if (error || !sequence) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#121212] flex items-center justify-center">
        <p className="text-red-600 dark:text-red-400">{error || 'Program not available.'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#121212]">
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <ProgramSequenceDisplay programSequence={sequence} isFullSequence />
      </div>
    </div>
  );
}

