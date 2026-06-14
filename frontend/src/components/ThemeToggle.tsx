'use client'

import { useTheme } from 'next-themes'
import { useEffect, useRef, useState } from 'react'

const OPTIONS = [
  {
    value: 'light',
    label: 'Gee-Gees Light',
    icon: (
      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <circle cx="12" cy="12" r="4" />
        <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Gee-Gees Dark',
    icon: (
      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
    ),
  },
  {
    value: 'fall',
    label: 'Fall Campus',
    icon: (
      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C6 2 3 8 3 12c0 2.5 1 4.5 2.5 6M12 2c2 3 3 6 3 10M12 2c-2 3-3 6-3 10M3 18c2-1 5-1.5 9-1.5S18 17 20 18" />
        <path strokeLinecap="round" d="M7 22c1-2 3-3 5-3s4 1 5 3" />
      </svg>
    ),
  },
] as const

export default function ThemeToggle({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!mounted) return <div className="w-8 h-8" />

  const isLight = variant === 'light'
  const current = OPTIONS.find(o => o.value === theme) ?? OPTIONS[0]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
          isLight
            ? 'bg-white dark:bg-[#1a1a1a] fall:bg-[#F5E6CC] border border-black/15 dark:border-white/[0.06] fall:border-black/10 text-[#111] dark:text-white fall:text-[#1C0F05] hover:border-black/30 dark:hover:border-white/15 fall:hover:border-black/25'
            : 'bg-black/60 backdrop-blur border border-white/15 text-white hover:bg-black/80 hover:border-white/30'
        }`}
      >
        {current.icon}
        <span>{current.label}</span>
        <svg
          className={`w-3 h-3 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className={`absolute right-0 top-full mt-1.5 min-w-[160px] rounded-lg border shadow-lg overflow-hidden z-50 ${
          isLight
            ? 'bg-white dark:bg-[#1a1a1a] fall:bg-[#FDF4E3] border-black/10 dark:border-white/[0.08] fall:border-black/10'
            : 'bg-[#111]/95 backdrop-blur-xl border-white/15'
        }`}>
          {OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => { setTheme(o.value); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-left transition-colors ${
                theme === o.value
                  ? 'text-accent'
                  : isLight
                    ? 'text-[#111] dark:text-white fall:text-[#1C0F05] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] fall:hover:bg-black/[0.04]'
                    : 'text-white/80 hover:bg-white/[0.07]'
              }`}
            >
              {o.icon}
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
