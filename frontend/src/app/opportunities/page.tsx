'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import ThemeToggle from '@/components/ThemeToggle'
import LanguageToggle from '@/components/LanguageToggle'
import { useLanguage } from '@/contexts/LanguageContext'

type Tab    = 'ta' | 'scholarships'
type Sort   = 'posted' | 'deadline' | 'pay'
type Role   = 'TA' | 'RA' | 'APTPUO' | 'Other'
type Filter = 'all' | 'TA' | 'RA'

interface TaPosition {
  job_req_id:      string
  title:           string
  course_code:     string | null
  faculty:         string | null
  supervisor:      string | null
  hourly_rate:     number | null
  total_hours:     number | null
  language:        string | null
  end_date:        string | null
  posted_on:       string | null
  external_url:    string
  work_start_date: string | null
  work_end_date:   string | null
  location:        string | null
  scraped_at:      string
}

function parseTitle(raw: string): { displayTitle: string; role: Role } {
  if (/^APTPUO\s*-/i.test(raw)) {
    const colonIdx = raw.indexOf(':')
    const displayTitle = colonIdx > 0
      ? raw.slice(colonIdx + 1).split(':')[0].trim()
      : raw
    return { displayTitle, role: 'APTPUO' }
  }
  if (/teaching\s+assistant/i.test(raw)) {
    return { displayTitle: cleanTitle(raw), role: 'TA' }
  }
  if (/research\s+assistant/i.test(raw)) {
    return { displayTitle: cleanTitle(raw), role: 'RA' }
  }
  return { displayTitle: raw, role: 'Other' }
}

function codeFromTitle(raw: string): string | null {
  const m = raw.match(/\b([A-Z]{2,4})\s*(\d{4}[A-Z]?)\b/)
  if (!m || m[1] === 'CUPE') return null
  return `${m[1]} ${m[2]}`
}

// Strip CUPE prefix, term, and role label — keep only the meaningful part
function cleanTitle(raw: string): string {
  const m = raw.match(/(?:teaching|research)\s+assistant\s*[-–—:]\s*(.+)$/i)
  if (m && m[1].trim()) {
    const after = m[1]
      .replace(/^(?:Spring[-\/]Summer|Fall|Winter|Summer|Spring)(?:\s*[&\/]\s*\w+)?\s+\d{4}\s*[-–—:]\s*/i, '')
      .trim()
    return after || m[1].trim()
  }
  return raw
    .replace(/^\d+\s*:?\s*/, '')
    .replace(/^CUPE\s*[-:]\s*/i, '')
    .replace(/^(?:Spring[-\/]Summer|Fall|Winter|Summer|Spring)(?:\s*[&\/]\s*\w+)?\s+\d{4}\s*[-–—:]\s*/i, '')
    .trim() || raw
}

// Extract just the faculty/school name — strip "Unit:..." Workday metadata suffix
function cleanFaculty(raw: string | null): string | null {
  if (!raw) return null
  const cleaned = raw.replace(/\s*Unit:.*/i, '').replace(/\s*Job\s+Classification:.*/i, '').trim()
  return cleaned || null
}

// Extract term from title (e.g. "Fall 2026", "Spring/Summer 2026")
function termFromTitle(raw: string): string | null {
  const m = raw.match(/\b(Fall|Winter|Summer|Spring[-\/]Summer|Spring)\s+(\d{4})\b/i)
  return m ? `${m[1]} ${m[2]}` : null
}

// Extract hours from title like "130h"
function hoursFromTitle(raw: string): number | null {
  const m = raw.match(/\b(\d+)\s*h\b/i)
  return m ? parseInt(m[1]) : null
}

// Trim Workday form HTML down to just the Requirements/qualifications section,
// cutting off the metadata fields at the top and the boilerplate at the bottom.
function extractDescription(raw: string): string {
  const lower = raw.toLowerCase()

  const startMarkers = [
    'requirements and nature of work',
    'exigences et nature du travail',
  ]
  const endMarkers = [
    'additional information',
    'all university of ottawa employees',
  ]

  let startIdx = -1
  for (const marker of startMarkers) {
    const i = lower.indexOf(marker)
    if (i !== -1) {
      startIdx = raw.lastIndexOf('<', i)
      if (startIdx === -1) startIdx = i
      break
    }
  }

  if (startIdx === -1) return raw

  let endIdx = raw.length
  for (const marker of endMarkers) {
    const i = lower.indexOf(marker, startIdx)
    if (i !== -1) {
      const tagStart = raw.lastIndexOf('<', i)
      endIdx = tagStart !== -1 ? tagStart : i
      break
    }
  }

  const result = raw.slice(startIdx, endIdx).trim()
  return result.length > 30 ? result : raw
}

// Hide dates that are clearly stale (old boilerplate years in job descriptions)
function validDate(s: string | null): string | null {
  if (!s) return null
  const d = new Date(s)
  if (!isNaN(d.getTime()) && d.getFullYear() < 2025) return null
  return s
}

function formatPay(rate: number | null, hours: number | null): string | null {
  if (rate == null && hours == null) return null
  const parts: string[] = []
  if (rate != null) parts.push(`$${rate.toFixed(2)}/hr`)
  if (hours != null) parts.push(`${hours} hrs total`)
  return parts.join(' · ')
}

const ROLE_CLS: Record<Role, string> = {
  TA:     'bg-[#f0fdf4] dark:bg-[#052e16] fall:bg-[#f0fdf4] text-[#166534] dark:text-[#86efac] fall:text-[#166534]',
  RA:     'bg-[#fdf4ff] dark:bg-[#2e1a3a] fall:bg-[#fdf4ff] text-[#7c3aed] dark:text-[#c4b5fd] fall:text-[#7c3aed]',
  APTPUO: 'bg-[#eff6ff] dark:bg-[#0f1f4a] fall:bg-[#eff6ff] text-[#1e40af] dark:text-[#93c5fd] fall:text-[#1e40af]',
  Other:  'bg-[#f3f4f6] dark:bg-[#1f2937] fall:bg-[#f3f4f6] text-[#6b7280] dark:text-[#9ca3af] fall:text-[#6b7280]',
}

const ROLE_LABEL_KEY: Record<Role, 'opps.role.ta' | 'opps.role.ra' | 'opps.role.aptpuo' | 'opps.role.other'> = {
  TA:     'opps.role.ta',
  RA:     'opps.role.ra',
  APTPUO: 'opps.role.aptpuo',
  Other:  'opps.role.other',
}

// helpers

function CourseBadge({ code }: { code: string }) {
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-md text-accent bg-accent/[0.08] dark:bg-accent/[0.15] fall:bg-accent/[0.08]">
      {code}
    </span>
  )
}

function RoleBadge({ role }: { role: Role }) {
  const { t } = useLanguage()
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-md shrink-0 ${ROLE_CLS[role]}`}>
      {t(ROLE_LABEL_KEY[role])}
    </span>
  )
}

function TaCard({ p, onClick }: { p: TaPosition; onClick: () => void }) {
  const { t } = useLanguage()
  const { displayTitle, role } = parseTitle(p.title)
  const courseCode = p.course_code ?? codeFromTitle(p.title)
  const faculty    = cleanFaculty(p.faculty)
  const hours      = p.total_hours ?? hoursFromTitle(p.title)
  const pay        = formatPay(p.hourly_rate, hours)
  const workPeriod = [validDate(p.work_start_date), validDate(p.work_end_date)].filter(Boolean).join(' – ') || null
  const term       = workPeriod ? null : termFromTitle(p.title)
  const postedText = validDate(p.end_date)
    ? `Closes ${p.end_date}`
    : p.posted_on
      ? (p.posted_on.toLowerCase().startsWith('posted') ? p.posted_on : `Posted ${p.posted_on}`)
      : ''

  return (
    <div
      onClick={onClick}
      className="group bg-[#f5f5f5] dark:bg-[#1a1a1a] fall:bg-[#F5E6CC] rounded-xl p-5 flex flex-col gap-2.5 border border-black/5 dark:border-white/5 fall:border-black/[0.06] hover:border-accent/30 dark:hover:border-accent/30 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <RoleBadge role={role} />
          {courseCode && <CourseBadge code={courseCode} />}
        </div>
        {(term || p.language) && (
          <div className="flex items-center gap-1.5 shrink-0">
            {term && (
              <span className="text-xs text-[#888] dark:text-[#666] fall:text-[#9A7050]">{term}</span>
            )}
            {p.language && (
              <span className="text-xs text-[#999] dark:text-[#666] fall:text-[#9A7050] border border-black/10 dark:border-white/10 fall:border-black/10 px-1.5 py-0.5 rounded">
                {p.language}
              </span>
            )}
          </div>
        )}
      </div>

      <h3 className="text-sm font-semibold text-[#111] dark:text-white fall:text-[#1C0F05] leading-snug line-clamp-2 group-hover:text-accent dark:group-hover:text-[#c0001f] fall:group-hover:text-accent transition-colors">
        {displayTitle}
      </h3>

      {(faculty || p.supervisor) && (
        <div className="flex flex-col gap-0.5">
          {faculty && <span className="text-xs text-[#666] dark:text-[#888] fall:text-[#9A7050]">{faculty}</span>}
          {p.supervisor && <span className="text-xs text-[#999] dark:text-[#666] fall:text-[#9A7050]">{p.supervisor}</span>}
        </div>
      )}

      {pay && (
        <p className="text-sm font-semibold text-[#111] dark:text-[#eee] fall:text-[#1C0F05]">{pay}</p>
      )}

      {workPeriod && (
        <p className="text-xs text-[#999] dark:text-[#666] fall:text-[#9A7050]">{workPeriod}</p>
      )}

      <div className="mt-auto pt-2.5 border-t border-black/[0.06] dark:border-white/[0.06] fall:border-black/[0.06] flex items-center justify-between gap-2">
        <span className="text-xs text-[#aaa] dark:text-[#555] fall:text-[#A07840] truncate">{postedText}</span>
        <span className="text-xs text-accent font-medium shrink-0">{t('opps.viewDetails')}</span>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-[#f5f5f5] dark:bg-[#1a1a1a] fall:bg-[#F5E6CC] rounded-xl p-5 border border-black/5 dark:border-white/5 fall:border-black/[0.06] animate-pulse flex flex-col gap-2.5">
      <div className="flex justify-between">
        <div className="h-5 bg-black/5 dark:bg-white/5 fall:bg-black/5 rounded-md w-16" />
        <div className="h-5 bg-black/5 dark:bg-white/5 fall:bg-black/5 rounded-md w-24" />
      </div>
      <div className="h-4 bg-black/5 dark:bg-white/5 fall:bg-black/5 rounded w-4/5" />
      <div className="h-4 bg-black/5 dark:bg-white/5 fall:bg-black/5 rounded w-2/5" />
      <div className="h-5 bg-black/5 dark:bg-white/5 fall:bg-black/5 rounded w-28 mt-1" />
      <div className="mt-auto pt-2.5 border-t border-black/[0.04] dark:border-white/[0.04] fall:border-black/[0.04] flex justify-between">
        <div className="h-3.5 bg-black/5 dark:bg-white/5 fall:bg-black/5 rounded w-28" />
        <div className="h-3.5 bg-black/5 dark:bg-white/5 fall:bg-black/5 rounded w-16" />
      </div>
    </div>
  )
}

function DescriptionModal({ p, onClose }: { p: TaPosition; onClose: () => void }) {
  const { t } = useLanguage()
  const [html, setHtml] = useState<string | null>(null)
  const [descLoading, setDescLoading] = useState(true)

  const { displayTitle, role } = parseTitle(p.title)
  const courseCode = p.course_code ?? codeFromTitle(p.title)
  const faculty    = cleanFaculty(p.faculty)
  const hours      = p.total_hours ?? hoursFromTitle(p.title)
  const pay        = formatPay(p.hourly_rate, hours)
  const workPeriod = [validDate(p.work_start_date), validDate(p.work_end_date)].filter(Boolean).join(' – ') || null
  const postedText = validDate(p.end_date)
    ? `Closes ${p.end_date}`
    : p.posted_on
      ? (p.posted_on.toLowerCase().startsWith('posted') ? p.posted_on : `Posted ${p.posted_on}`)
      : ''

  useEffect(() => {
    fetch(`/api/ta-jobs/description?url=${encodeURIComponent(p.external_url)}`)
      .then(r => r.json())
      .then(d => setHtml(d.html ? extractDescription(d.html) : null))
      .catch(() => setHtml(null))
      .finally(() => setDescLoading(false))
  }, [p.external_url])

  // close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // lock scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 fall:bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1a1a1a] fall:bg-[#FDF4E3] rounded-xl w-full max-w-2xl max-h-[88vh] flex flex-col border border-black/10 dark:border-white/10 fall:border-black/10 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div className="px-6 pt-5 pb-4 border-b border-black/[0.07] dark:border-white/[0.07] fall:border-black/[0.07] flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {courseCode && <CourseBadge code={courseCode} />}
              <RoleBadge role={role} />
              {p.language && (
                <span className="text-xs text-[#999] dark:text-[#666] fall:text-[#9A7050] border border-black/10 dark:border-white/10 fall:border-black/10 px-1.5 py-0.5 rounded">
                  {p.language}
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-[#111] dark:text-white fall:text-[#1C0F05] leading-snug">{displayTitle}</h2>
            {faculty && (
              <p className="text-sm text-[#666] dark:text-[#888] fall:text-[#9A7050] mt-0.5">{faculty}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-[#666] dark:text-[#888] fall:text-[#9A7050] hover:bg-black/[0.06] dark:hover:bg-white/[0.06] fall:hover:bg-black/[0.06] transition-colors text-base leading-none"
          >
            ✕
          </button>
        </div>

        {/* meta strip */}
        {(pay || p.supervisor || workPeriod) && (
          <div className="px-6 py-3 border-b border-black/[0.07] dark:border-white/[0.07] fall:border-black/[0.07] flex flex-wrap gap-x-5 gap-y-1">
            {pay && (
              <span className="text-sm font-semibold text-[#111] dark:text-[#eee] fall:text-[#1C0F05]">{pay}</span>
            )}
            {p.supervisor && (
              <span className="text-sm text-[#666] dark:text-[#888] fall:text-[#9A7050]">{t('opps.supervisor', { name: p.supervisor })}</span>
            )}
            {workPeriod && (
              <span className="text-sm text-[#666] dark:text-[#888] fall:text-[#9A7050]">{workPeriod}</span>
            )}
          </div>
        )}

        {/* description */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {descLoading ? (
            <div className="space-y-2.5 animate-pulse">
              {[1, 0.8, 0.9, 0.6, 0.85, 0.7, 0.95].map((w, i) => (
                <div key={i} className="h-4 bg-black/5 dark:bg-white/5 fall:bg-black/5 rounded" style={{ width: `${w * 100}%` }} />
              ))}
            </div>
          ) : html !== null ? (
            <div
              className="text-sm text-[#333] dark:text-[#ccc] fall:text-[#4A2E12] leading-relaxed [&_p]:mb-2 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:mb-3 [&_li]:mb-1 [&_ol]:pl-5 [&_ol]:list-decimal [&_ol]:mb-3 [&_strong]:font-semibold [&_b]:font-semibold [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1 [&_p:has(strong)]:mt-3 [&_p:has(b)]:mt-3 [&_table]:w-full [&_table]:mb-4 [&_td]:pr-4 [&_td]:py-1 [&_td]:align-top [&_td:first-child]:text-[#888] [&_td:first-child]:dark:text-[#666] [&_td:first-child]:fall:text-[#9A7050] [&_td:first-child]:w-48 [&_td:first-child]:shrink-0 [&_tr]:border-b [&_tr]:border-black/[0.04] dark:[&_tr]:border-white/[0.04] fall:[&_tr]:border-black/[0.04]"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <p className="text-sm text-[#aaa] dark:text-[#555] fall:text-[#A07840]">{t('opps.noDescription')}</p>
          )}
        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t border-black/[0.07] dark:border-white/[0.07] fall:border-black/[0.07] flex items-center justify-between gap-3">
          <span className="text-xs text-[#aaa] dark:text-[#555] fall:text-[#A07840]">{postedText}</span>
          <a
            href={p.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-accent hover:underline underline-offset-4"
          >
            {t('opps.applyWorkday')}
          </a>
        </div>
      </div>
    </div>
  )
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'ta',           label: 'TA Jobs'      },
  { id: 'scholarships', label: 'Scholarships' },
]

const ROLE_FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All'           },
  { id: 'TA',  label: 'Teaching Asst' },
  { id: 'RA',  label: 'Research Asst' },
]

export default function OpportunitiesPage() {
  const { t } = useLanguage()
  const [tab,        setTab]        = useState<Tab>('ta')
  const [positions,  setPositions]  = useState<TaPosition[]>([])
  const [loading,    setLoading]    = useState(true)
  const [query,      setQuery]      = useState('')
  const [sort,       setSort]       = useState<Sort>('posted')
  const [roleFilter, setRoleFilter] = useState<Filter>('all')
  const [selected,   setSelected]   = useState<TaPosition | null>(null)

  const closeModal = useCallback(() => setSelected(null), [])

  useEffect(() => {
    fetch('/api/ta-jobs')
      .then(r => r.json())
      .then(d => setPositions(d.positions ?? []))
      .catch(() => setPositions([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let list = positions.filter(p => {
      const r = parseTitle(p.title).role
      return r === 'TA' || r === 'RA'
    })

    if (roleFilter !== 'all') {
      list = list.filter(p => parseTitle(p.title).role === roleFilter)
    }

    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.course_code?.toLowerCase().includes(q) ||
        p.faculty?.toLowerCase().includes(q) ||
        p.supervisor?.toLowerCase().includes(q)
      )
    }

    if (sort === 'pay') {
      list.sort((a, b) => (b.hourly_rate ?? 0) - (a.hourly_rate ?? 0))
    } else if (sort === 'deadline') {
      list.sort((a, b) => {
        if (!a.end_date && !b.end_date) return 0
        if (!a.end_date) return 1
        if (!b.end_date) return -1
        return a.end_date.localeCompare(b.end_date)
      })
    }

    return list
  }, [positions, query, sort, roleFilter])

  const lastUpdated = positions[0]?.scraped_at
    ? new Date(positions[0].scraped_at).toLocaleDateString('en-CA', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : null

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#111] fall:bg-[#FDF4E3] transition-colors duration-200">

      <div className="max-w-6xl mx-auto w-full px-6 pt-6 flex items-center justify-between">
        <a href="/" className="text-[#111] dark:text-white fall:text-[#1C0F05] font-bold text-lg tracking-tight">uomap</a>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">

        <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-[#111] dark:text-white fall:text-[#1C0F05] mb-1">{t('opps.title')}</h1>
            <p className="text-[#666] dark:text-[#888] fall:text-[#9A7050] text-sm">{t('opps.subtitle')}</p>
          </div>
          {lastUpdated && (
            <span className="text-xs text-[#aaa] dark:text-[#555] fall:text-[#A07840]">{t('opps.updated', { date: lastUpdated })}</span>
          )}
        </div>

        <div className="flex gap-1 border-b border-black/10 dark:border-white/10 fall:border-black/10 mb-6">
          {TABS.map(tab_ => (
            <button
              key={tab_.id}
              onClick={() => setTab(tab_.id)}
              className={`px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition-colors ${
                tab === tab_.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-[#666] dark:text-[#888] fall:text-[#9A7050] hover:text-[#111] dark:hover:text-white fall:hover:text-[#1C0F05]'
              }`}
            >
              {tab_.id === 'ta' ? t('opps.taJobs') : t('opps.scholarships')}
            </button>
          ))}
        </div>

        {tab === 'ta' && (
          <div>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                type="text"
                placeholder={t('opps.search.placeholder')}
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="flex-1 px-4 py-2.5 text-sm bg-[#f5f5f5] dark:bg-[#1a1a1a] fall:bg-[#F5E6CC] border border-black/10 dark:border-white/10 fall:border-black/10 rounded-lg text-[#111] dark:text-white fall:text-[#1C0F05] placeholder-[#999] dark:placeholder-[#555] fall:placeholder-[#C4A06A] focus:outline-none focus:border-accent/40 dark:focus:border-accent/40 fall:focus:border-accent/40 transition-colors"
              />
              <select
                value={sort}
                onChange={e => setSort(e.target.value as Sort)}
                className="px-3 py-2.5 text-sm bg-[#f5f5f5] dark:bg-[#1a1a1a] fall:bg-[#F5E6CC] border border-black/10 dark:border-white/10 fall:border-black/10 rounded-lg text-[#111] dark:text-white fall:text-[#1C0F05] focus:outline-none focus:border-accent/40 dark:focus:border-accent/40 fall:focus:border-accent/40 transition-colors cursor-pointer"
              >
                <option value="posted">{t('opps.sort.recent')}</option>
                <option value="deadline">{t('opps.sort.deadline')}</option>
                <option value="pay">{t('opps.sort.pay')}</option>
              </select>
            </div>

            <div className="flex gap-2 mb-5 flex-wrap">
              {ROLE_FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setRoleFilter(f.id)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${
                    roleFilter === f.id
                      ? 'bg-[#111] dark:bg-white fall:bg-accent text-white dark:text-[#111] fall:text-white border-[#111] dark:border-white fall:border-accent'
                      : 'bg-transparent text-[#666] dark:text-[#888] fall:text-[#9A7050] border-black/10 dark:border-white/10 fall:border-black/10 hover:text-[#111] dark:hover:text-white fall:hover:text-[#1C0F05] hover:border-black/20 dark:hover:border-white/20 fall:hover:border-black/20'
                  }`}
                >
                  {f.id === 'all' ? t('opps.filter.all') : f.id === 'TA' ? t('opps.filter.ta') : t('opps.filter.ra')}
                </button>
              ))}
            </div>

            {!loading && (
              <p className="text-xs text-[#aaa] dark:text-[#555] fall:text-[#A07840] mb-4">
                {filtered.length} {t(filtered.length === 1 ? 'opps.positionSingular' : 'opps.positionPlural')}
                {query ? ' ' + t('opps.matching') : ''}
              </p>
            )}

            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="text-center py-20">
                <p className="text-[#999] dark:text-[#555] fall:text-[#9A7050] text-sm">{t('opps.noPositions')}</p>
                {positions.length === 0 && (
                  <p className="text-[#bbb] dark:text-[#444] fall:text-[#C4A06A] text-xs mt-1.5">
                    {t('opps.scraperNote')}
                  </p>
                )}
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(p => (
                  <TaCard key={p.job_req_id} p={p} onClick={() => setSelected(p)} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'scholarships' && (
          <div className="text-center py-20">
            <p className="text-[#999] dark:text-[#555] fall:text-[#9A7050] text-sm">{t('opps.comingSoon')}</p>
          </div>
        )}

      </main>

      <footer className="border-t border-black/[0.06] dark:border-white/[0.06] fall:border-black/[0.06] mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <span className="text-[#aaa] dark:text-[#555] fall:text-[#A07840] text-xs tracking-wide">{t('nav.independent')}</span>
          <a href="https://github.com" aria-label="GitHub" className="text-[#666] dark:text-[#888] fall:text-[#9A7050] hover:text-[#111] dark:hover:text-white fall:hover:text-[#1C0F05] transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/>
            </svg>
          </a>
        </div>
      </footer>

      {selected && <DescriptionModal p={selected} onClose={closeModal} />}

    </div>
  )
}
