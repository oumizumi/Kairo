'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import ThemeToggle from '@/components/ThemeToggle'
import SchedulePanel from '@/components/schedule/SchedulePanel'
import RmpStars, { normalizeName, rmpUrl, type RmpEntry } from '@/components/schedule/RmpStars'
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

// Most common meetingStartDate per term in the scraped data
const TERM_START: Record<string, string> = {
  summer2026: '2026-05-04',
  fall2026: '2026-09-09',
  winter2027: '2027-01-11',
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

function sectionBlocks(section: SectionInfo | null | undefined): TimeBlock[] {
  return section ? parseTimeBlocks(section.time) : []
}

// Blocks the schedule actually occupies: lecture + chosen lab + chosen tutorial
function chosenBlocks(added: AddedSection): TimeBlock[] {
  const all = [...sectionBlocks(added.lecture)]
  if (added.selectedLabIdx !== null) all.push(...sectionBlocks(added.labs[added.selectedLabIdx]))
  if (added.selectedTutIdx !== null) all.push(...sectionBlocks(added.tutorials[added.selectedTutIdx]))
  return all
}

function blocksOverlap(a: TimeBlock[], b: TimeBlock[]): boolean {
  for (const x of a) {
    for (const y of b) {
      if (x.day === y.day && x.start < y.end && y.start < x.end) return true
    }
  }
  return false
}

// A labelled set of occupied blocks, so conflicts can name their source
interface Obstacle { label: string; blocks: TimeBlock[] }

interface ConflictInfo { label: string; block: TimeBlock }

function obstaclesFor(addedSections: AddedSection[], excludeId?: string): Obstacle[] {
  const out: Obstacle[] = []
  for (const a of addedSections) {
    if (a.id === excludeId) continue
    out.push({ label: `${a.courseCode} LEC`, blocks: sectionBlocks(a.lecture) })
    if (a.selectedLabIdx !== null) {
      const s = a.labs[a.selectedLabIdx]
      if (s) out.push({ label: `${a.courseCode} ${sectionKind(s, 'LAB')} ${sectionNum(s)}`, blocks: sectionBlocks(s) })
    }
    if (a.selectedTutIdx !== null) {
      const s = a.tutorials[a.selectedTutIdx]
      if (s) out.push({ label: `${a.courseCode} ${sectionKind(s, 'TUT')} ${sectionNum(s)}`, blocks: sectionBlocks(s) })
    }
  }
  return out
}

function findConflict(blocks: TimeBlock[], obstacles: Obstacle[]): ConflictInfo | null {
  for (const o of obstacles) {
    for (const x of blocks) {
      for (const y of o.blocks) {
        if (x.day === y.day && x.start < y.end && y.start < x.end) return { label: o.label, block: y }
      }
    }
  }
  return null
}


function fmtClock(h: number): string {
  const hour = Math.floor(h)
  const min = Math.round((h - hour) * 60)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${display}:${min.toString().padStart(2, '0')} ${suffix}`
}

interface TimeLine { days: string; range: string }

// One clearly written line per meeting segment: "Tue / Thu" + "10:00 AM – 11:20 AM"
function timeLines(time: string): TimeLine[] {
  if (!time) return [{ days: 'TBA', range: '' }]
  const lines: TimeLine[] = []
  for (const seg of time.split(',').map(s => s.trim())) {
    const m = seg.match(/^([A-Z][a-z](?:[A-Z][a-z])*)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/)
    if (!m) continue
    const days: string[] = []
    for (let i = 0; i < m[1].length; i += 2) {
      const d = DAY_MAP[m[1].slice(i, i + 2)]
      if (d) days.push(d)
    }
    lines.push({
      days: days.join(' / '),
      range: `${fmtClock(parseHHMM(m[2]))} – ${fmtClock(parseHHMM(m[3]))}`,
    })
  }
  return lines.length ? lines : [{ days: 'TBA', range: '' }]
}

function sectionKind(s: SectionInfo, fallback: string): string {
  if (s.section.includes('DGD')) return 'DGD'
  if (s.section.includes('LAB')) return 'LAB'
  if (s.section.includes('TUT')) return 'TUT'
  return fallback
}

function sectionNum(s: SectionInfo): string {
  return s.section.split('-')[0] ?? s.section
}

function displayInstructor(raw: string | undefined): string {
  const t = (raw ?? '').trim()
  if (!t || t === 'Staff' || t === 'TBA' || t === 'To Be Announced') return 'TBA'
  return t.split(',')[0].trim()
}

// ─── ComponentBox — small selectable box for a lab / DGD / tutorial ───────────

function ComponentBox({
  section, fallbackKind, selected, conflict, onToggle, onConflictClick,
}: {
  section: SectionInfo
  fallbackKind: string
  selected: boolean
  conflict: ConflictInfo | null
  onToggle: () => void
  onConflictClick: (c: ConflictInfo) => void
}) {
  const kind = sectionKind(section, fallbackKind)
  const line = timeLines(section.time)[0]
  const blocked = conflict !== null && !selected

  return (
    <button
      onClick={() => blocked ? onConflictClick(conflict!) : onToggle()}
      className={`group w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
        selected
          ? 'bg-[#8f001a]/[0.07] dark:bg-[#8f001a]/[0.12]'
          : blocked
          ? 'opacity-55 hover:bg-[#dc2626]/[0.05] dark:hover:bg-[#dc2626]/[0.08]'
          : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
      }`}
    >
      <span className={`text-[9px] font-bold uppercase tracking-wide w-7 shrink-0 ${
        selected ? 'text-[#8f001a]' : 'text-[#888] dark:text-[#777]'
      }`}>
        {kind}
      </span>
      <span className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-[11px] font-bold text-[#111] dark:text-white shrink-0">{sectionNum(section)}</span>
        <span className="text-[11px] font-semibold text-[#444] dark:text-[#ccc] shrink-0">{line.days}</span>
        {line.range && (
          <span className="text-[11px] tabular-nums text-[#777] dark:text-[#999] truncate">{line.range}</span>
        )}
      </span>
      {blocked ? (
        <span className="ml-auto text-[8px] font-bold text-[#dc2626] uppercase tracking-wide shrink-0">conflict</span>
      ) : (
        <span className={`ml-auto w-3.5 h-3.5 rounded-[3px] border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
          selected
            ? 'bg-[#8f001a] border-[#8f001a]'
            : 'border-[#ccc] dark:border-[#555] group-hover:border-[#8f001a]'
        }`}>
          {selected && (
            <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth={4} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
      )}
    </button>
  )
}

// Small inline popup explaining what a conflicting row collides with
function ConflictPopup({ conflict }: { conflict: ConflictInfo }) {
  return (
    <div
      className="mx-2 my-1 px-3 py-2 rounded-lg bg-[#dc2626]/[0.05] dark:bg-[#dc2626]/[0.09] border border-[#dc2626]/20 flex items-start gap-2"
      style={{ animation: 'conflictPop 160ms cubic-bezier(0.34,1.4,0.64,1)' }}
    >
      <svg className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#dc2626]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[11px] leading-snug text-[#b91c1c] dark:text-[#f87171]">
          Conflicts with <span className="font-bold">{conflict.label}</span>
        </span>
        <span className="text-[10.5px] font-medium tabular-nums text-[#dc2626]/80 dark:text-[#f87171]/80">
          {conflict.block.day} · {fmtClock(conflict.block.start)} – {fmtClock(conflict.block.end)}
        </span>
      </div>
    </div>
  )
}

// ─── CourseRow ────────────────────────────────────────────────────────────────

function CourseRow({
  course, addedSections, rmp, onAdd, onRemove, onSelectLab, onSelectTut,
}: {
  course: Course
  addedSections: AddedSection[]
  rmp: Record<string, RmpEntry> | null
  onAdd: (course: Course, groupId: string, labIdx?: number | null, tutIdx?: number | null) => void
  onRemove: (id: string) => void
  onSelectLab: (id: string, idx: number | null) => void
  onSelectTut: (id: string, idx: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [popup, setPopup] = useState<{ key: string; conflict: ConflictInfo } | null>(null)
  const popupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const groupIds = Object.keys(course.sectionGroups)
  const addedForCourse = addedSections.filter(a => a.courseCode === course.courseCode)
  const hasAdded = addedForCourse.length > 0

  const showPopup = (key: string, c: ConflictInfo) => {
    if (popupTimer.current) clearTimeout(popupTimer.current)
    if (popup?.key === key) { setPopup(null); return }
    setPopup({ key, conflict: c })
    popupTimer.current = setTimeout(() => setPopup(null), 7000)
  }

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
          <p className="text-[13px] font-bold text-[#111] dark:text-white tracking-tight">{course.courseCode}</p>
          <p className="text-[12px] text-[#555] dark:text-[#aaa] truncate mt-0.5 leading-snug">{course.courseTitle}</p>
        </div>
        <svg
          className={`w-4 h-4 text-[#aaa] dark:text-[#666] shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-3 flex flex-col gap-2">
          {groupIds.map((gid) => {
            const group = course.sectionGroups[gid]
            const lec = group.lecture
            if (!lec) return null

            const added = addedForCourse.find(a => a.groupId === gid) ?? null
            const isAdded = added !== null
            const status = lec.status ?? 'Unknown'

            const instructor = displayInstructor(lec.instructor)
            const rmpEntry = instructor !== 'TBA' ? rmp?.[normalizeName(instructor)] ?? null : null
            const profUrl = rmpEntry ? rmpUrl(rmpEntry) : null

            // everything else occupying the schedule, labelled by source
            const otherObstacles = obstaclesFor(addedSections, added?.id)

            const lecBlocks = sectionBlocks(lec)
            const lecObstacle: Obstacle = { label: `${course.courseCode} LEC`, blocks: lecBlocks }
            const lecConflictInfo = !isAdded ? findConflict(lecBlocks, otherObstacles) : null
            const lecConflict = lecConflictInfo !== null

            const labConflict = (idx: number) => {
              const obstacles = [...otherObstacles, lecObstacle]
              if (added && added.selectedTutIdx !== null) {
                const s = added.tutorials[added.selectedTutIdx]
                if (s) obstacles.push({ label: `${course.courseCode} ${sectionKind(s, 'TUT')} ${sectionNum(s)}`, blocks: sectionBlocks(s) })
              }
              return findConflict(sectionBlocks(group.labs[idx]), obstacles)
            }
            const tutConflict = (idx: number) => {
              const obstacles = [...otherObstacles, lecObstacle]
              if (added && added.selectedLabIdx !== null) {
                const s = added.labs[added.selectedLabIdx]
                if (s) obstacles.push({ label: `${course.courseCode} ${sectionKind(s, 'LAB')} ${sectionNum(s)}`, blocks: sectionBlocks(s) })
              }
              return findConflict(sectionBlocks(group.tutorials[idx]), obstacles)
            }

            const toggleLab = (idx: number) => {
              if (added) {
                onSelectLab(added.id, added.selectedLabIdx === idx ? null : idx)
              } else {
                onAdd(course, gid, idx, null)
              }
            }
            const toggleTut = (idx: number) => {
              if (added) {
                onSelectTut(added.id, added.selectedTutIdx === idx ? null : idx)
              } else {
                onAdd(course, gid, null, idx)
              }
            }

            return (
              <div
                key={gid}
                className={`rounded-xl border transition-all ${
                  isAdded
                    ? 'border-[#8f001a]/40 bg-[#8f001a]/[0.03] dark:bg-[#8f001a]/[0.05]'
                    : 'border-black/[0.07] dark:border-white/[0.07] bg-white dark:bg-[#1a1a1a] hover:border-black/20 dark:hover:border-white/20'
                }`}
              >
                {/* group header: section + status + tick box */}
                <div className="flex items-center justify-between px-3.5 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[12px] font-bold text-[#111] dark:text-white">{lec.section}</span>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{ color: STATUS_COLOR[status], backgroundColor: `${STATUS_COLOR[status]}1a` }}
                    >
                      {status}
                    </span>
                    {lecConflict && (
                      <span className="text-[9px] font-bold text-[#dc2626] uppercase tracking-wide shrink-0">conflict</span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      if (lecConflict) { showPopup(`${gid}-lec`, lecConflictInfo!); return }
                      if (isAdded) onRemove(added!.id)
                      else onAdd(course, gid)
                    }}
                    title={lecConflict ? 'Lecture conflicts with your schedule' : undefined}
                    className={`w-4 h-4 rounded-[3px] flex items-center justify-center border-[1.5px] shrink-0 transition-colors ${
                      isAdded
                        ? 'bg-[#8f001a] border-[#8f001a]'
                        : lecConflict
                        ? 'border-[#dc2626]/30 hover:border-[#dc2626]/60'
                        : 'bg-transparent border-[#ccc] dark:border-[#555] hover:border-[#8f001a]'
                    }`}
                  >
                    {isAdded && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </div>

                {popup?.key === `${gid}-lec` && <ConflictPopup conflict={popup.conflict} />}

                {/* instructor + lecture times */}
                <div className="px-3.5 pb-2.5 flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {profUrl ? (
                      <a
                        href={profUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] font-semibold leading-snug text-[#222] dark:text-[#eee] hover:text-[#8f001a] dark:hover:text-[#ff8095] hover:underline underline-offset-2 transition-colors"
                        title="View on Rate My Professors"
                      >
                        {instructor}
                      </a>
                    ) : (
                      <p className={`text-[12px] font-semibold leading-snug ${
                        instructor === 'TBA' ? 'text-[#aaa] dark:text-[#666]' : 'text-[#222] dark:text-[#eee]'
                      }`}>
                        {instructor}
                      </p>
                    )}
                    {rmpEntry && <RmpStars entry={rmpEntry} />}
                  </div>
                  {timeLines(lec.time).map((l, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-[#8f001a] uppercase tracking-wide w-7 shrink-0">LEC</span>
                      <span className="text-[11px] font-semibold text-[#444] dark:text-[#ccc] shrink-0">{l.days}</span>
                      {l.range && (
                        <span className="text-[11px] tabular-nums text-[#777] dark:text-[#999]">{l.range}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* lab / tutorial selection rows */}
                {(group.labs.length > 0 || group.tutorials.length > 0) && (
                  <div className="px-1.5 pb-2 pt-1.5 border-t border-black/[0.05] dark:border-white/[0.05] flex flex-col divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                    {group.labs.length > 0 && (
                      <div className="flex flex-col divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                        {group.labs.map((lab, i) => (
                          <div key={lab.section + i} className="py-0.5">
                            <ComponentBox
                              section={lab}
                              fallbackKind="LAB"
                              selected={added?.selectedLabIdx === i}
                              conflict={labConflict(i)}
                              onToggle={() => toggleLab(i)}
                              onConflictClick={(c) => showPopup(`${gid}-lab-${i}`, c)}
                            />
                            {popup?.key === `${gid}-lab-${i}` && <ConflictPopup conflict={popup.conflict} />}
                          </div>
                        ))}
                      </div>
                    )}
                    {group.tutorials.length > 0 && (
                      <div className="flex flex-col divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                        {group.tutorials.map((tut, i) => (
                          <div key={tut.section + i} className="py-0.5">
                            <ComponentBox
                              section={tut}
                              fallbackKind="TUT"
                              selected={added?.selectedTutIdx === i}
                              conflict={tutConflict(i)}
                              onToggle={() => toggleTut(i)}
                              onConflictClick={(c) => showPopup(`${gid}-tut-${i}`, c)}
                            />
                            {popup?.key === `${gid}-tut-${i}` && <ConflictPopup conflict={popup.conflict} />}
                          </div>
                        ))}
                      </div>
                    )}
                    {isAdded && group.labs.length > 0 && added!.selectedLabIdx === null && (
                      <p className="px-2 pt-0.5 text-[10px] text-[#b45309] font-medium">Pick a lab section</p>
                    )}
                  </div>
                )}
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
  const [rmp, setRmp] = useState<Record<string, RmpEntry> | null>(null)
  const colorRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const conflictTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showConflict = (msg: string) => {
    setConflict(msg)
    if (conflictTimer.current) clearTimeout(conflictTimer.current)
    conflictTimer.current = setTimeout(() => setConflict(null), 3000)
  }

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

  // query changes are handled by the debounce in handleQuery
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchCourses(term, query) }, [term, fetchCourses])

  useEffect(() => {
    fetch('/api/rmp').then(r => r.json()).then(setRmp).catch(() => {})
  }, [])

  const handleQuery = (q: string) => {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchCourses(term, q), 300)
  }

  const handleAdd = (course: Course, groupId: string, labIdx: number | null = null, tutIdx: number | null = null) => {
    const group = course.sectionGroups[groupId]
    if (!group?.lecture) return

    const newBlocks = [...sectionBlocks(group.lecture)]
    if (labIdx !== null) newBlocks.push(...sectionBlocks(group.labs[labIdx]))
    if (tutIdx !== null) newBlocks.push(...sectionBlocks(group.tutorials[tutIdx]))

    for (const existing of addedSections) {
      if (blocksOverlap(newBlocks, chosenBlocks(existing))) {
        showConflict(`Conflicts with ${existing.courseCode}`)
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
      labs: group.labs,
      tutorials: group.tutorials,
      color,
      term: course.term,
      selectedLabIdx: labIdx,
      selectedTutIdx: tutIdx,
    }])
  }

  const handleRemove = (id: string) => {
    setAddedSections(prev => prev.filter(a => a.id !== id))
  }

  const handleSelectLab = (id: string, idx: number | null) => {
    const target = addedSections.find(a => a.id === id)
    if (!target) return
    if (idx !== null) {
      const labBlocks = sectionBlocks(target.labs[idx])
      const others = addedSections
        .filter(a => a.id !== id)
        .flatMap(chosenBlocks)
      const own = [...sectionBlocks(target.lecture)]
      if (target.selectedTutIdx !== null) own.push(...sectionBlocks(target.tutorials[target.selectedTutIdx]))
      if (blocksOverlap(labBlocks, [...others, ...own])) {
        showConflict(`${sectionNum(target.labs[idx])} conflicts with your schedule`)
        return
      }
    }
    setAddedSections(prev => prev.map(a => a.id === id ? { ...a, selectedLabIdx: idx } : a))
  }

  const handleSelectTut = (id: string, idx: number | null) => {
    const target = addedSections.find(a => a.id === id)
    if (!target) return
    if (idx !== null) {
      const tutBlocks = sectionBlocks(target.tutorials[idx])
      const others = addedSections
        .filter(a => a.id !== id)
        .flatMap(chosenBlocks)
      const own = [...sectionBlocks(target.lecture)]
      if (target.selectedLabIdx !== null) own.push(...sectionBlocks(target.labs[target.selectedLabIdx]))
      if (blocksOverlap(tutBlocks, [...others, ...own])) {
        showConflict(`${sectionNum(target.tutorials[idx])} conflicts with your schedule`)
        return
      }
    }
    setAddedSections(prev => prev.map(a => a.id === id ? { ...a, selectedTutIdx: idx } : a))
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
        <div className="mx-3 mb-3 px-3 py-2.5 rounded-xl bg-[#8f001a]/[0.08] border border-[#8f001a]/15 text-[#8f001a] text-[11px] font-medium shrink-0 flex items-center gap-2">
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
              rmp={rmp}
              onAdd={handleAdd}
              onRemove={handleRemove}
              onSelectLab={handleSelectLab}
              onSelectTut={handleSelectTut}
            />
          ))
        )}
      </div>
    </div>
  )

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-[#111] transition-colors duration-200 overflow-hidden">
      <style>{`
        @keyframes conflictPop {
          from { opacity: 0; transform: translateY(-4px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
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
          onRemove={handleRemove}
          termStart={TERM_START[term]}
          rmp={rmp}
        />
      </div>
    </div>
  )
}
