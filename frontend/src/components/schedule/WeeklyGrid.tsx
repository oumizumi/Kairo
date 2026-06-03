'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AddedSection, Course } from '@/types/course'

const GRID_START = 7
const GRID_END = 22
const TOTAL_HOURS = GRID_END - GRID_START
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const TIME_COL_W = 52

const DAY_ABBR: Record<string, string> = {
  Mo: 'Mon', Tu: 'Tue', We: 'Wed', Th: 'Thu', Fr: 'Fri',
}

const STATUS_COLOR: Record<string, string> = {
  Open: '#15803d',
  Closed: '#dc2626',
  Waitlist: '#b45309',
  Unknown: '#9ca3af',
}

function parseHours(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return h + m / 60
}

interface Block { day: string; start: number; end: number }

function parseBlocks(time: string): Block[] {
  if (!time) return []
  const out: Block[] = []
  for (const seg of time.split(',').map(s => s.trim())) {
    const m = seg.match(/^([A-Z][a-z](?:[A-Z][a-z])*)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/)
    if (!m) continue
    const start = parseHours(m[2])
    const end = parseHours(m[3])
    for (let i = 0; i < m[1].length; i += 2) {
      const day = DAY_ABBR[m[1].slice(i, i + 2)]
      if (day) out.push({ day, start, end })
    }
  }
  return out
}

interface EventBlock extends Block {
  key: string
  courseCode: string
  courseTitle: string
  type: string
  color: string
  addedId: string
  instructor: string
  status: string
  meetingStart: Date | null
  meetingEnd: Date | null
}

function normalizeInstructor(raw: string): string {
  if (!raw) return ''
  const t = raw.trim()
  if (['Staff', 'TBA', 'To Be Announced', ''].includes(t)) return ''
  if (t.includes(',')) {
    const [last, first] = t.split(',').map(s => s.trim())
    return first ? `${first} ${last}` : last
  }
  return t
}

function parseMeetingDate(s: string | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  d.setHours(0, 0, 0, 0)
  return isNaN(d.getTime()) ? null : d
}

function buildBlocks(addedSections: AddedSection[], courses: Course[]): EventBlock[] {
  const out: EventBlock[] = []
  for (const added of addedSections) {
    const group = courses.find(c => c.courseCode === added.courseCode)?.sectionGroups[added.groupId]
    const lec = group?.lecture ?? added.lecture
    for (const b of parseBlocks(lec.time)) {
      out.push({
        key: `${added.id}-lec-${b.day}`, ...b,
        courseCode: added.courseCode,
        courseTitle: added.courseTitle,
        type: 'LEC',
        color: added.color,
        addedId: added.id,
        instructor: normalizeInstructor(lec.instructor),
        status: lec.status ?? 'Unknown',
        meetingStart: parseMeetingDate(lec.meetingStartDate),
        meetingEnd:   parseMeetingDate(lec.meetingEndDate),
      })
    }
    if (group) {
      const selLab = added.selectedLabIdx !== null ? group.labs[added.selectedLabIdx] : null
      if (selLab) {
        const kind = selLab.section.includes('DGD') ? 'DGD' : 'LAB'
        for (const b of parseBlocks(selLab.time)) {
          out.push({
            key: `${added.id}-lab-${b.day}-${b.start}`, ...b,
            courseCode: added.courseCode,
            courseTitle: added.courseTitle,
            type: kind,
            color: added.color,
            addedId: added.id,
            instructor: normalizeInstructor(selLab.instructor),
            status: selLab.status ?? 'Unknown',
            meetingStart: parseMeetingDate(selLab.meetingStartDate),
            meetingEnd:   parseMeetingDate(selLab.meetingEndDate),
          })
        }
      }
      const selTut = added.selectedTutIdx !== null ? group.tutorials[added.selectedTutIdx] : null
      if (selTut) {
        const kind = selTut.section.includes('DGD') ? 'DGD' : 'TUT'
        for (const b of parseBlocks(selTut.time)) {
          out.push({
            key: `${added.id}-tut-${b.day}-${b.start}`, ...b,
            courseCode: added.courseCode,
            courseTitle: added.courseTitle,
            type: kind,
            color: added.color,
            addedId: added.id,
            instructor: normalizeInstructor(selTut.instructor),
            status: selTut.status ?? 'Unknown',
            meetingStart: parseMeetingDate(selTut.meetingStartDate),
            meetingEnd:   parseMeetingDate(selTut.meetingEndDate),
          })
        }
      }
    }
  }
  return out
}

function fmtLabel(h: number): string {
  if (h === 12) return '12 PM'
  return h > 12 ? `${h - 12} PM` : `${h} AM`
}

function fmtTime(h: number): string {
  const hour = Math.floor(h)
  const min = Math.round((h - hour) * 60)
  const suffix = hour >= 12 ? 'pm' : 'am'
  const disp = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return min === 0 ? `${disp}${suffix}` : `${disp}:${min.toString().padStart(2, '0')}${suffix}`
}

function gridBg(hh: number): string {
  return `repeating-linear-gradient(
    to bottom,
    rgba(128,128,128,0.13) 0px, rgba(128,128,128,0.13) 1px,
    transparent 1px, transparent ${hh - 1}px
  )`
}

interface TooltipData {
  x: number
  y: number
  flipX: boolean
  flipY: boolean
  addedId: string
  courseCode: string
  courseTitle: string
  type: string
  color: string
  instructor: string
  status: string
  startH: number
  endH: number
}

export default function WeeklyGrid({
  addedSections,
  courses,
  onRemove,
  weekStart,
}: {
  addedSections: AddedSection[]
  courses: Course[]
  onRemove: (id: string) => void
  weekStart?: Date
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hourHeight, setHourHeight] = useState(56)
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [visible, setVisible] = useState(false)
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set())
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => {
      const h = el.clientHeight
      if (h > 0) setHourHeight((h * 1.05) / TOTAL_HOURS)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // hide tooltip on scroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => { setVisible(false); setTooltip(null) }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  function showTooltip(e: React.MouseEvent, block: EventBlock) {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    if (showTimer.current) clearTimeout(showTimer.current)
    const r = e.currentTarget.getBoundingClientRect()
    const TOOLTIP_W = 224
    const TOOLTIP_H = 130
    const flipX = r.right + TOOLTIP_W + 10 > window.innerWidth
    const flipY = r.bottom + TOOLTIP_H > window.innerHeight
    setTooltip({
      x: flipX ? r.left - TOOLTIP_W - 6 : r.right + 6,
      y: flipY ? r.bottom - TOOLTIP_H : r.top,
      flipX, flipY,
      addedId: block.addedId,
      courseCode: block.courseCode,
      courseTitle: block.courseTitle,
      type: block.type,
      color: block.color,
      instructor: block.instructor,
      status: block.status,
      startH: block.start,
      endH: block.end,
    })
    showTimer.current = setTimeout(() => setVisible(true), 20)
  }

  function hideTooltip() {
    if (showTimer.current) clearTimeout(showTimer.current)
    setVisible(false)
    hideTimer.current = setTimeout(() => setTooltip(null), 200)
  }

  function handleRemove(addedId: string) {
    setTooltip(null)
    setLeavingIds(prev => new Set([...prev, addedId]))
    setTimeout(() => {
      onRemove(addedId)
      setLeavingIds(prev => { const n = new Set(prev); n.delete(addedId); return n })
    }, 190)
  }

  const gridHeight = hourHeight * TOTAL_HOURS
  const hourLabels = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => GRID_START + i)
  const blocks = buildBlocks(addedSections, courses)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <>
      <style>{`
        @keyframes blockEnter {
          0%   { opacity: 0; transform: translateX(-28px) scaleX(0.88); }
          60%  { opacity: 1; transform: translateX(4px) scaleX(1.02); }
          100% { opacity: 1; transform: translateX(0) scaleX(1); }
        }
        @keyframes blockExit {
          0%   { opacity: 1; transform: translateX(0) scaleX(1); }
          100% { opacity: 0; transform: translateX(28px) scaleX(0.88); }
        }
      `}</style>
      <div ref={scrollRef} className="h-full overflow-y-auto" style={{ overflowX: 'clip' }}>

        {/* Sticky day headers */}
        <div className="sticky top-0 z-10 flex border-b border-black/[0.07] dark:border-white/[0.07] bg-white dark:bg-[#111111]">
          <div className="shrink-0 border-r border-black/[0.07] dark:border-white/[0.07]" style={{ width: TIME_COL_W }} />
          {DAYS.map((day, di) => {
            const colDate = weekStart ? new Date(weekStart.getTime() + di * 86400000) : null
            const isToday = colDate ? colDate.getTime() === today.getTime() : false
            return (
              <div
                key={day}
                className="flex-1 py-2.5 flex flex-col items-center justify-center gap-0.5 border-l border-black/[0.07] dark:border-white/[0.07]"
              >
                <span className={`text-[10px] font-bold tracking-[0.15em] uppercase ${isToday ? 'text-[#8f001a]' : 'text-[#aaa] dark:text-[#555]'}`}>
                  {day}
                </span>
                {colDate && (
                  <span className={`text-[11px] font-semibold tabular-nums leading-none ${
                    isToday
                      ? 'w-5 h-5 flex items-center justify-center rounded-full bg-[#8f001a] text-white'
                      : 'text-[#bbb] dark:text-[#444]'
                  }`}>
                    {colDate.getDate()}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Content area */}
        <div className="relative pt-2 pb-10">

          {/* Vertical line overlay */}
          <div className="absolute inset-0 pointer-events-none flex" style={{ left: TIME_COL_W }}>
            {DAYS.map((day) => (
              <div key={day} className="flex-1 h-full border-l border-black/[0.07] dark:border-white/[0.07]" />
            ))}
          </div>
          <div
            className="absolute inset-y-0 pointer-events-none border-r border-black/[0.07] dark:border-white/[0.07]"
            style={{ left: TIME_COL_W }}
          />

          {/* Grid rows */}
          <div className="flex" style={{ height: gridHeight }}>

            {/* Time labels */}
            <div className="shrink-0 relative select-none pointer-events-none" style={{ width: TIME_COL_W }}>
              {hourLabels.map(h => (
                <div
                  key={h}
                  className="absolute inset-x-0 flex justify-end pr-2.5"
                  style={{ top: (h - GRID_START) * hourHeight }}
                >
                  <span className="text-[9px] font-semibold tabular-nums -translate-y-[6px] text-[#bbb] dark:text-[#444] leading-none">
                    {fmtLabel(h)}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            <div
              className="flex-1 flex"
              style={{
                backgroundImage: gridBg(hourHeight),
                backgroundSize: `100% ${hourHeight}px`,
                backgroundPosition: `0 ${hourHeight}px`,
              }}
            >
              {DAYS.map((day, di) => {
                const colDate = weekStart ? new Date(weekStart.getTime() + di * 86400000) : null
                const dayBlocks = blocks.filter(b => {
                  if (b.day !== day) return false
                  if (!colDate) return true
                  if (b.meetingStart && colDate < b.meetingStart) return false
                  if (b.meetingEnd) {
                    const endDay = new Date(b.meetingEnd); endDay.setHours(23, 59, 59, 999)
                    if (colDate > endDay) return false
                  }
                  return true
                })
                return (
                  <div key={day} className="flex-1 relative">
                    {dayBlocks.map(block => {
                      const top = (block.start - GRID_START) * hourHeight + 2
                      const height = Math.max((block.end - block.start) * hourHeight - 4, 20)
                      const isLec = block.type === 'LEC'
                      const isLeaving = leavingIds.has(block.addedId)

                      return (
                        <button
                          key={block.key}
                          onClick={(e) => showTooltip(e, block)}
                          onMouseEnter={(e) => showTooltip(e, block)}
                          onMouseLeave={hideTooltip}
                          className="absolute left-[2px] right-[2px] rounded overflow-hidden text-left focus:outline-none"
                          style={{
                            top, height,
                            backgroundColor: block.color + '55',
                            animation: isLeaving
                              ? 'blockExit 200ms cubic-bezier(0.55,0,1,0.45) forwards'
                              : 'blockEnter 380ms cubic-bezier(0.34,1.56,0.64,1) forwards',
                          }}
                        >
                          {/* left accent bar */}
                          <div className="absolute left-0 inset-y-0 w-[3px]" style={{ backgroundColor: block.color }} />
                          <div className="relative h-full flex flex-col justify-start pl-[9px] pr-2 py-1 gap-[3px]">
                            <span className="text-[11px] font-bold leading-none truncate" style={{ color: block.color }}>
                              {block.courseCode}
                            </span>
                            <span className="text-[9.5px] leading-none truncate font-medium" style={{ color: block.color + 'dd' }}>
                              {fmtTime(block.start)} - {fmtTime(block.end)}
                            </span>
                            {!isLec && (
                              <span className="text-[8px] leading-none font-semibold tracking-wide uppercase" style={{ color: block.color + 'bb' }}>
                                {block.type}
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>

          </div>
        </div>
      </div>

      {/* Tooltip portal — renders at document.body, no overflow clipping */}
      {tooltip && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none w-56"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transition: 'opacity 180ms ease, transform 180ms ease',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0) scale(1)' : 'translateY(4px) scale(0.97)',
            transformOrigin: tooltip.flipX ? 'right top' : 'left top',
          }}
        >
          <div className="bg-white dark:bg-[#1c1c1c] rounded-xl shadow-xl border border-black/[0.08] dark:border-white/[0.09] p-3 flex flex-col gap-2">

              {/* course code + type + status */}
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-bold text-[#111] dark:text-white leading-none">
                  {tooltip.courseCode}
                </span>
                <span className="text-[10px] font-semibold font-mono" style={{ color: tooltip.color }}>
                  {tooltip.type}
                </span>
                <span
                  className="ml-auto text-[10px] font-semibold"
                  style={{ color: STATUS_COLOR[tooltip.status] ?? STATUS_COLOR.Unknown }}
                >
                  {tooltip.status}
                </span>
              </div>

              {/* course title */}
              <p className="text-[11px] text-[#555] dark:text-[#aaa] leading-snug line-clamp-2">
                {tooltip.courseTitle}
              </p>

              <div className="border-t border-black/[0.06] dark:border-white/[0.06] pt-2 flex flex-col gap-1.5">

                {/* time */}
                <div className="flex items-center gap-2">
                  <svg className="w-3 h-3 shrink-0 text-[#bbb] dark:text-[#555]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" />
                  </svg>
                  <span className="text-[11px] font-medium text-[#333] dark:text-[#ccc]">
                    {fmtTime(tooltip.startH)} - {fmtTime(tooltip.endH)}
                  </span>
                </div>

                {/* instructor */}
                <div className="flex items-center gap-2">
                  <svg className="w-3 h-3 shrink-0 text-[#bbb] dark:text-[#555]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                  <span className="text-[11px] font-medium text-[#333] dark:text-[#ccc] truncate">
                    {tooltip.instructor || <span className="text-[#bbb] dark:text-[#555]">TBA</span>}
                  </span>
                </div>

              </div>

              <button
                onMouseEnter={() => { if (hideTimer.current) clearTimeout(hideTimer.current) }}
                onClick={() => handleRemove(tooltip.addedId)}
                className="pointer-events-auto mt-0.5 text-[10px] font-medium transition-colors text-left"
                style={{ color: '#dc262699' }}
                onMouseOver={e => (e.currentTarget.style.color = '#dc2626')}
                onMouseOut={e => (e.currentTarget.style.color = '#dc262699')}
              >
                Remove
              </button>
            </div>
        </div>,
        document.body
      )}
    </>
  )
}
