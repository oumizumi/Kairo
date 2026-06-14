'use client'

import { useEffect, useRef, useState } from 'react'
import WeeklyGrid from './WeeklyGrid'
import type { RmpEntry } from './RmpStars'
import type { AddedSection } from '@/types/course'

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setHours(0, 0, 0, 0)
  return date
}

function getMondayOfWeek(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  date.setHours(0, 0, 0, 0)
  return date
}

function addWeeks(d: Date, n: number): Date {
  const date = new Date(d)
  date.setDate(date.getDate() + n * 7)
  return date
}

function fmtWeekRange(monday: Date): string {
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  const mo = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const fr = friday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${mo} - ${fr}`
}

function fmtWeekRangeCompact(monday: Date): string {
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  const mo = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${mo}–${friday.getDate()}`
}

export default function SchedulePanel({
  addedSections,
  onRemove,
  termStart,
  rmp,
  compact,
}: {
  addedSections: AddedSection[]
  onRemove: (id: string) => void
  termStart?: string
  rmp?: Record<string, RmpEntry> | null
  compact?: boolean
}) {
  const [weekStart, setWeekStart] = useState(() =>
    termStart ? getMondayOfWeek(parseLocalDate(termStart)) : getMondayOfWeek(new Date())
  )
  const [gridAnim, setGridAnim] = useState<'enter' | 'exit' | null>(null)
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!termStart) return
    if (animTimer.current) clearTimeout(animTimer.current)
    setGridAnim('exit')
    animTimer.current = setTimeout(() => {
      setWeekStart(getMondayOfWeek(parseLocalDate(termStart)))
      setGridAnim('enter')
    }, 190)
    return () => { if (animTimer.current) clearTimeout(animTimer.current) }
  }, [termStart])

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      <style>{`
        @keyframes gridEnter {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes gridExit {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-14px) scale(0.97); }
        }
      `}</style>
      {/* Header */}
      <div className="shrink-0 h-[49px] flex items-center justify-between px-4 border-b border-black/[0.06] dark:border-white/[0.06] fall:border-black/[0.06]">

        {/* Week navigation */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setWeekStart(w => addWeeks(w, -1))}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-[#999] dark:text-[#666] fall:text-[#9A7050] hover:text-[#111] dark:hover:text-white fall:hover:text-[#1C0F05] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] fall:hover:bg-black/[0.05] transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-[11px] font-semibold text-[#555] dark:text-[#888] fall:text-[#7A5030] tabular-nums text-center">
            {compact ? fmtWeekRangeCompact(weekStart) : fmtWeekRange(weekStart)}
          </span>
          <button
            onClick={() => setWeekStart(w => addWeeks(w, 1))}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-[#999] dark:text-[#666] fall:text-[#9A7050] hover:text-[#111] dark:hover:text-white fall:hover:text-[#1C0F05] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] fall:hover:bg-black/[0.05] transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

      </div>

      {/* Grid area */}
      <div className="flex-1 overflow-hidden relative">
        <div
          className="h-full"
          style={{
            animation: gridAnim === 'exit'
              ? 'gridExit 190ms cubic-bezier(0.4,0,1,1) forwards'
              : gridAnim === 'enter'
              ? 'gridEnter 300ms cubic-bezier(0.34,1.56,0.64,1) forwards'
              : undefined,
          }}
        >
          <WeeklyGrid
            addedSections={addedSections}
            onRemove={onRemove}
            weekStart={weekStart}
            rmp={rmp}
            compact={compact}
          />
        </div>
      </div>
    </div>
  )
}
