'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import ThemeToggle from '@/components/ThemeToggle'
import SchedulePanel from '@/components/schedule/SchedulePanel'
import type { Course, SectionInfo, AddedSection } from '@/types/course'

// ─── constants ────────────────────────────────────────────────────────────────

const DAY_MAP: Record<string, string> = {
  Mo: 'Mon', Tu: 'Tue', We: 'Wed', Th: 'Thu', Fr: 'Fri', Sa: 'Sat', Su: 'Sun',
}

const COURSE_COLORS = [
  '#8f001a', '#1d4ed8', '#15803d', '#b45309',
  '#7c3aed', '#be185d', '#0369a1', '#065f46',
]

const STATUS_COLOR: Record<string, string> = {
  Open: '#15803d',
  Closed: '#dc2626',
  Waitlist: '#b45309',
  Unknown: '#9ca3af',
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return h + m / 60
}

interface TimeBlock { day: string; start: number; end: number }

function parseTimeBlocks(time: string): TimeBlock[] {
  if (!time) return []
  const blocks: TimeBlock[] = []
  const segments = time.split(',').map(s => s.trim())
  for (const seg of segments) {
    const m = seg.match(/^([A-Z][a-z](?:[A-Z][a-z])*)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/)
    if (!m) continue
    const [, daysStr, startStr, endStr] = m
    const start = parseHHMM(startStr)
    const end = parseHHMM(endStr)
    for (let i = 0; i < daysStr.length; i += 2) {
      const day = DAY_MAP[daysStr.slice(i, i + 2)]
      if (day) blocks.push({ day, start, end })
    }
  }
  return blocks
}

function sectionBlocks(section: SectionInfo): TimeBlock[] {
  return parseTimeBlocks(section.time)
}

function allBlocksForAdded(added: AddedSection, courses: Course[]): TimeBlock[] {
  const course = courses.find(c => c.courseCode === added.courseCode)
  if (!course) return sectionBlocks(added.lecture)
  const group = course.sectionGroups[added.groupId]
  if (!group) return sectionBlocks(added.lecture)
  const all: TimeBlock[] = []
  if (group.lecture) all.push(...sectionBlocks(group.lecture))
  for (const lab of group.labs) all.push(...sectionBlocks(lab))
  for (const tut of group.tutorials) all.push(...sectionBlocks(tut))
  return all
}

function blocksOverlap(a: TimeBlock[], b: TimeBlock[]): boolean {
  for (const x of a) {
    for (const y of b) {
      if (x.day !== y.day) continue
      if (x.start < y.end && x.end > x.start && y.start < x.end && y.end > y.start) return true
    }
  }
  return false
}

function fmt(h: number): string {
  const hour = Math.floor(h)
  const min = Math.round((h - hour) * 60)
  const suffix = hour >= 12 ? 'pm' : 'am'
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return min === 0 ? `${display}${suffix}` : `${display}:${min.toString().padStart(2, '0')}${suffix}`
}

function shortTime(time: string): string {
  const blocks = parseTimeBlocks(time)
  if (!blocks.length) return '—'
  const { start, end } = blocks[0]
  return `${fmt(start)} – ${fmt(end)}`
}

// ─── CourseRow ────────────────────────────────────────────────────────────────

function CourseRow({
  course, addedSections, onAdd, onRemove,
}: {
  course: Course
  addedSections: AddedSection[]
  onAdd: (course: Course, groupId: string) => void
  onRemove: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const groupIds = Object.keys(course.sectionGroups)
  const addedIds = addedSections.filter(a => a.courseCode === course.courseCode).map(a => a.groupId)
  const hasAdded = addedIds.length > 0

  return (
    <div className={`border-b border-black/[0.05] dark:border-white/[0.05] last:border-0 transition-colors ${hasAdded ? 'bg-black/[0.015] dark:bg-white/[0.015]' : ''}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
      >
        {hasAdded && (
          <div className="w-1.5 h-1.5 rounded-full bg-[#8f001a] shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-[#111] dark:text-white">{course.courseCode}</p>
          <p className="text-[11px] text-[#777] dark:text-[#888] truncate mt-0.5 leading-snug">{course.courseTitle}</p>
        </div>
        <span className="text-[10px] text-[#bbb] dark:text-[#555] shrink-0 font-medium">
          {groupIds.length}G
        </span>
        <svg
          className={`w-3.5 h-3.5 text-[#ccc] dark:text-[#555] shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-3 flex flex-col gap-2">
          {groupIds.map((gid) => {
            const group = course.sectionGroups[gid]
            const isAdded = addedIds.includes(gid)
            const lec = group.lecture
            const extras = [...group.labs, ...group.tutorials]
            const status = lec?.status ?? 'Unknown'

            return (
              <div
                key={gid}
                className={`rounded-xl p-3 border transition-colors ${
                  isAdded
                    ? 'border-[#8f001a]/20 bg-[#8f001a]/[0.04]'
                    : 'border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-bold text-[#111] dark:text-white">Group {gid}</span>
                      <span
                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{
                          color: STATUS_COLOR[status],
                          backgroundColor: `${STATUS_COLOR[status]}18`,
                        }}
                      >
                        {status}
                      </span>
                    </div>

                    {lec && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] font-semibold text-[#8f001a] uppercase tracking-wide">LEC</span>
                        <span className="text-[10px] text-[#666] dark:text-[#888]">
                          {shortTime(lec.time)}
                          {lec.instructor && lec.instructor !== 'Staff' && lec.instructor !== 'TBA'
                            ? ` · ${lec.instructor.split(',')[0].split(' ').pop()}`
                            : ''}
                        </span>
                      </div>
                    )}

                    {extras.map((s, i) => {
                      const kind = s.section.includes('LAB') ? 'LAB' : 'TUT'
                      return (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="text-[9px] font-semibold text-[#888] uppercase tracking-wide">{kind}</span>
                          <span className="text-[10px] text-[#888] dark:text-[#666]">{shortTime(s.time)}</span>
                        </div>
                      )
                    })}
                  </div>

                  <button
                    onClick={() => {
                      if (isAdded) {
                        const a = addedSections.find(a => a.courseCode === course.courseCode && a.groupId === gid)
                        if (a) onRemove(a.id)
                      } else {
                        onAdd(course, gid)
                      }
                    }}
                    className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                      isAdded
                        ? 'bg-[#8f001a]/10 text-[#8f001a] hover:bg-[#8f001a]/20'
                        : 'bg-black/[0.04] dark:bg-white/[0.04] text-[#888] hover:bg-[#8f001a]/10 hover:text-[#8f001a]'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      {isAdded
                        ? <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                        : <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                      }
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const [term, setTerm] = useState<'summer2026' | 'fall2026' | 'winter2027'>('fall2026')
  const [query, setQuery] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [addedSections, setAddedSections] = useState<AddedSection[]>([])
  const [loading, setLoading] = useState(false)
  const [conflict, setConflict] = useState<string | null>(null)
  const colorRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchCourses = useCallback(async (t: string, q: string) => {
    if (!q.trim()) { setCourses([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/courses?term=${t}&q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setCourses(data.courses ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCourses(term, query) }, [term, fetchCourses])

  const handleQuery = (q: string) => {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchCourses(term, q), 300)
  }

  const handleAdd = (course: Course, groupId: string) => {
    const group = course.sectionGroups[groupId]
    if (!group?.lecture) return

    const newBlocks: TimeBlock[] = []
    newBlocks.push(...sectionBlocks(group.lecture))
    for (const lab of group.labs) newBlocks.push(...sectionBlocks(lab))
    for (const tut of group.tutorials) newBlocks.push(...sectionBlocks(tut))

    for (const existing of addedSections) {
      const existingBlocks = allBlocksForAdded(existing, courses)
      if (blocksOverlap(newBlocks, existingBlocks)) {
        setConflict(`Conflicts with ${existing.courseCode}`)
        setTimeout(() => setConflict(null), 3000)
        return
      }
    }

    const color = COURSE_COLORS[colorRef.current % COURSE_COLORS.length]
    colorRef.current++

    setAddedSections(prev => [...prev, {
      id: `${course.courseCode}-${groupId}-${Date.now()}`,
      courseCode: course.courseCode,
      courseTitle: course.courseTitle,
      groupId,
      lecture: group.lecture!,
      color,
    }])
  }

  const handleRemove = (id: string) => {
    setAddedSections(prev => prev.filter(a => a.id !== id))
  }

  // ─── search panel ──────────────────────────────────────────────────────────

  const searchPanel = (
    <div className="flex flex-col h-full">
      {/* term tabs */}
      <div className="shrink-0 px-3 pt-4 pb-1">
        <div className="relative flex p-1 rounded-xl bg-black/[0.05] dark:bg-white/[0.06]">
          {(['summer2026', 'fall2026', 'winter2027'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTerm(t)}
              className={`relative flex-1 py-2 px-1 text-[11px] font-semibold rounded-lg transition-all duration-150 ${
                term === t
                  ? 'bg-white dark:bg-[#2a2a2a] text-[#111] dark:text-white shadow-sm'
                  : 'text-[#888] dark:text-[#666] hover:text-[#333] dark:hover:text-[#aaa]'
              }`}
            >
              {t === 'summer2026' ? "Summer '26" : t === 'fall2026' ? "Fall '26" : "Winter '27"}
            </button>
          ))}
        </div>
      </div>

      {/* search */}
      <div className="px-3 py-3 shrink-0">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#bbb] dark:text-[#555]"
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search by code or name…"
            value={query}
            onChange={e => handleQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-[12px] bg-black/[0.04] dark:bg-white/[0.05] border border-transparent rounded-xl text-[#111] dark:text-white placeholder-[#bbb] dark:placeholder-[#555] focus:outline-none focus:border-[#8f001a]/30 focus:bg-white dark:focus:bg-[#1a1a1a] transition-all"
          />
        </div>
      </div>

      {/* added chips */}
      {addedSections.length > 0 && (
        <div className="px-3 pb-3 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {addedSections.map(a => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: a.color }}
              >
                {a.courseCode}
                <button onClick={() => handleRemove(a.id)} className="opacity-60 hover:opacity-100 transition-opacity ml-0.5">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
          <p className="text-[10px] text-[#bbb] dark:text-[#555] mt-2">
            {addedSections.length} course{addedSections.length !== 1 ? 's' : ''} added
          </p>
        </div>
      )}

      {/* conflict toast */}
      {conflict && (
        <div className="mx-3 mb-3 px-3 py-2.5 rounded-xl bg-[#8f001a]/08 border border-[#8f001a]/15 text-[#8f001a] text-[11px] font-medium shrink-0 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          {conflict}
        </div>
      )}

      {/* course list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-5 h-5 border-2 border-[#8f001a] border-t-transparent rounded-full animate-spin" />
            <p className="text-[11px] text-[#999] dark:text-[#666]">Loading courses…</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <svg className="w-8 h-8 text-[#ccc] dark:text-[#444]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
            </svg>
            <p className="text-[12px] font-medium text-[#999] dark:text-[#666]">
              {query ? 'No results' : 'Search for a course'}
            </p>
            {!query && (
              <p className="text-[11px] text-[#bbb] dark:text-[#555] text-center px-6">
                Try "CSI", "MAT", or "ENG"
              </p>
            )}
          </div>
        ) : (
          courses.map((c) => (
            <CourseRow
              key={`${c.courseCode}-${c.term}`}
              course={c}
              addedSections={addedSections}
              onAdd={handleAdd}
              onRemove={handleRemove}
            />
          ))
        )}
      </div>
    </div>
  )

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-[#111] transition-colors duration-200 overflow-hidden">
      {/* top bar */}
      <div className="shrink-0 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="px-4 h-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <a href="/" className="text-[#111] dark:text-white font-bold text-base tracking-tight hover:opacity-60 transition-opacity">
              uomap
            </a>
            <span className="text-[#e0e0e0] dark:text-[#2e2e2e]">/</span>
            <span className="text-[13px] font-medium text-[#999] dark:text-[#555]">Schedule</span>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Main content: search left + schedule right */}
      <div className="flex-1 overflow-hidden flex">
        {/* Search panel */}
        <div className="w-[300px] md:w-[360px] lg:w-[440px] xl:w-[540px] 2xl:w-[640px] shrink-0 border-r border-black/[0.06] dark:border-white/[0.06] flex flex-col overflow-hidden">
          {searchPanel}
        </div>
        {/* Schedule grid */}
        <SchedulePanel
          addedSections={addedSections}
          courses={courses}
          onRemove={handleRemove}
        />
      </div>
    </div>
  )
}
