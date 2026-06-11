'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { GUESS_LOCATIONS, type GuessLocation } from '@/data/guess_locations'
import type { MapPoint } from '@/components/guess/GuessMap'
import LanguageToggle from '@/components/LanguageToggle'
import { useLanguage } from '@/contexts/LanguageContext'

// MapLibre touches window at import time, must skip SSR
const GuessMap = dynamic(() => import('@/components/guess/GuessMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
      <span className="text-sm text-[#888]">Loading map…</span>
    </div>
  ),
})

const ROUNDS_PER_GAME = 5
const MAX_POINTS = 1000

type Phase = 'start' | 'playing' | 'reveal' | 'done'
type TimerSetting = 30 | 60 | null

interface RoundResult {
  location: GuessLocation
  guess: MapPoint | null
  distance: number | null
  points: number
}

function distanceMeters(a: MapPoint, b: MapPoint) {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function scoreFor(distance: number) {
  return Math.round(MAX_POINTS * Math.exp(-distance / 150))
}

function drawRounds(): GuessLocation[] {
  const pool = [...GUESS_LOCATIONS]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.min(ROUNDS_PER_GAME, pool.length))
}

function formatDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`
}

function resultLabelKey(points: number): 'guess.result.perfect' | 'guess.result.impressive' | 'guess.result.nice' | 'guess.result.warmer' | 'guess.result.far' {
  if (points >= 950) return 'guess.result.perfect'
  if (points >= 700) return 'guess.result.impressive'
  if (points >= 400) return 'guess.result.nice'
  if (points >= 100) return 'guess.result.warmer'
  return 'guess.result.far'
}

// full-screen pan/zoom photo: wheel + drag + pinch + buttons, double-click to reset
function PhotoViewer({ src, resetKey }: { src: string; resetKey: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchDistRef = useRef<number | null>(null)
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [resetKey])

  useEffect(() => {
    setLoaded(false)
  }, [src])

  const clampOffset = useCallback((x: number, y: number, s: number) => {
    const el = containerRef.current
    if (!el) return { x, y }
    const maxX = (el.clientWidth * (s - 1)) / 2
    const maxY = (el.clientHeight * (s - 1)) / 2
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) }
  }, [])

  const zoomTo = useCallback(
    (next: number) => {
      const s = Math.min(5, Math.max(1, next))
      setScale(s)
      setOffset((o) => clampOffset(o.x, o.y, s))
    },
    [clampOffset],
  )

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#0a0a0a] select-none touch-none"
      style={{ cursor: isDragging ? 'grabbing' : scale > 1 ? 'grab' : 'zoom-in' }}
      onWheel={(e) => zoomTo(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15))}
      onDoubleClick={() => {
        if (scale > 1) {
          setScale(1)
          setOffset({ x: 0, y: 0 })
        } else {
          zoomTo(2.2)
        }
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (pointersRef.current.size === 1) {
          dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
          setIsDragging(true)
        } else {
          dragRef.current = null
          pinchDistRef.current = null
        }
      }}
      onPointerMove={(e) => {
        const pointers = pointersRef.current
        if (!pointers.has(e.pointerId)) return
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

        if (pointers.size === 2) {
          const [p1, p2] = [...pointers.values()]
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y)
          if (pinchDistRef.current !== null) {
            zoomTo(scale * (dist / pinchDistRef.current))
          }
          pinchDistRef.current = dist
          return
        }

        if (dragRef.current && scale > 1) {
          const { x, y, ox, oy } = dragRef.current
          setOffset(clampOffset(ox + (e.clientX - x), oy + (e.clientY - y), scale))
        }
      }}
      onPointerUp={(e) => {
        pointersRef.current.delete(e.pointerId)
        pinchDistRef.current = null
        dragRef.current = null
        setIsDragging(false)
      }}
      onPointerCancel={(e) => {
        pointersRef.current.delete(e.pointerId)
        pinchDistRef.current = null
        dragRef.current = null
        setIsDragging(false)
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        onLoad={() => setLoaded(true)}
        className="w-full h-full object-cover"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transition: isDragging ? 'none' : 'transform 120ms ease-out, opacity 200ms ease-out',
          opacity: loaded ? 1 : 0,
        }}
      />

      {/* zoom controls bottom-left, GeoGuessr style */}
      <div className="absolute bottom-6 left-4 flex flex-col gap-2 z-[1050]">
        <button
          onClick={(e) => {
            e.stopPropagation()
            zoomTo(scale * 1.5)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          aria-label="Zoom in"
          className="w-11 h-11 rounded-full bg-black/60 backdrop-blur border border-white/15 text-white text-xl font-bold hover:bg-black/80 hover:border-white/30 transition-all shadow-lg"
        >
          +
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            zoomTo(scale / 1.5)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          aria-label="Zoom out"
          className="w-11 h-11 rounded-full bg-black/60 backdrop-blur border border-white/15 text-white text-xl font-bold hover:bg-black/80 hover:border-white/30 transition-all shadow-lg"
        >
          −
        </button>
        {scale > 1 && (
          <span className="text-center text-[11px] font-semibold text-white/80 bg-black/60 backdrop-blur rounded-full px-2 py-1 tabular-nums">
            {scale.toFixed(1)}x
          </span>
        )}
      </div>
    </div>
  )
}

function ScoreBar({ points, max, delayMs = 0 }: { points: number; max: number; delayMs?: number }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setWidth((points / max) * 100), delayMs + 50)
    return () => clearTimeout(t)
  }, [points, max, delayMs])
  return (
    <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#8f001a] to-[#d4254a]"
        style={{ width: `${width}%`, transition: 'width 1100ms cubic-bezier(0.22, 1, 0.36, 1)' }}
      />
    </div>
  )
}

export default function GuessPage() {
  const { t } = useLanguage()
  const [phase, setPhase] = useState<Phase>('start')
  const [soloConfig, setSoloConfig] = useState(false)
  const [timerSetting, setTimerSetting] = useState<TimerSetting>(null)
  const [rounds, setRounds] = useState<GuessLocation[]>([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [guess, setGuess] = useState<MapPoint | null>(null)
  const [results, setResults] = useState<RoundResult[]>([])
  const [timeLeft, setTimeLeft] = useState(0)
  const [displayPoints, setDisplayPoints] = useState(0)
  const [displayTotal, setDisplayTotal] = useState(0)
  const [mapHover, setMapHover] = useState(false)

  const current = rounds[roundIndex]
  const totalScore = results.reduce((sum, r) => sum + r.points, 0)
  const lastResult = results[results.length - 1]

  const startGame = () => {
    setRounds(drawRounds())
    setRoundIndex(0)
    setResults([])
    setGuess(null)
    setMapHover(false)
    setPhase('playing')
  }

  // refs so the timer callback always submits with current values
  const phaseRef = useRef(phase)
  const roundsRef = useRef(rounds)
  const roundIndexRef = useRef(roundIndex)
  const guessRef = useRef(guess)
  useEffect(() => {
    phaseRef.current = phase
    roundsRef.current = rounds
    roundIndexRef.current = roundIndex
    guessRef.current = guess
  }, [phase, rounds, roundIndex, guess])

  const submitGuess = useCallback(() => {
    if (phaseRef.current !== 'playing') return
    const loc = roundsRef.current[roundIndexRef.current]
    if (!loc) return
    const g = guessRef.current
    const distance = g ? distanceMeters(g, { lat: loc.lat, lng: loc.lng }) : null
    const points = distance !== null ? scoreFor(distance) : 0
    setResults((prev) => [...prev, { location: loc, guess: g, distance, points }])
    setPhase('reveal')
  }, [])

  const nextRound = () => {
    if (roundIndex + 1 >= rounds.length) {
      setPhase('done')
    } else {
      setRoundIndex((i) => i + 1)
      setGuess(null)
      setMapHover(false)
      setPhase('playing')
    }
  }

  // countdown: expiry auto-submits whatever pin is down (no pin = 0 points)
  useEffect(() => {
    if (phase !== 'playing' || timerSetting === null) return
    setTimeLeft(timerSetting)
    const iv = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(iv)
          submitGuess()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [phase, roundIndex, timerSetting, submitGuess])

  // reveal: count the points up instead of snapping
  useEffect(() => {
    if (phase !== 'reveal' || !lastResult) return
    setDisplayPoints(0)
    const target = lastResult.points
    const start = performance.now()
    const delay = 800
    const duration = 1100
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - start - delay) / duration))
      const eased = 1 - Math.pow(1 - k, 3)
      setDisplayPoints(Math.round(target * eased))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, results.length])

  // end screen: count the total up
  useEffect(() => {
    if (phase !== 'done') return
    setDisplayTotal(0)
    const target = totalScore
    const start = performance.now()
    const duration = 1400
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - k, 3)
      setDisplayTotal(Math.round(target * eased))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ---------- start screen ----------
  if (phase === 'start') {
    return (
      <div key="start" className="fixed inset-0 overflow-y-auto animate-screen-enter">
        <div className="relative z-20 max-w-5xl mx-auto px-6 pt-6 flex items-center justify-between">
          {soloConfig ? (
            <button
              onClick={() => setSoloConfig(false)}
              className="inline-flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/15 rounded-full px-4 py-2 text-sm font-semibold text-white/80 hover:text-white hover:border-white/30 transition-all"
            >
              {t('guess.back')}
            </button>
          ) : (
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/15 rounded-full px-4 py-2 text-sm font-semibold text-white/80 hover:text-white hover:border-white/30 transition-all"
            >
              ← uomap
            </Link>
          )}
          <LanguageToggle variant="dark" />
        </div>

        <p className="absolute z-10 bottom-7 right-8 hidden sm:block text-[10px] font-bold tracking-[0.3em] uppercase text-white/40 [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">
          {t('guess.uomapPresents')}
        </p>

        <main className="relative z-10 min-h-screen flex flex-col items-center px-6 pt-[11vh] pb-16">
          <p className="text-white/70 font-bold text-xs sm:text-sm tracking-[0.45em] uppercase mb-3 text-center [text-shadow:0_2px_12px_rgba(0,0,0,0.85)] animate-fade-up">
            {t('guess.uottawa')}
          </p>
          <h1 className="text-[clamp(58px,10vw,120px)] leading-[0.85] font-extrabold italic uppercase tracking-[-0.04em] text-white mb-4 text-center drop-shadow-[0_10px_44px_rgba(0,0,0,0.7)] animate-fade-up [animation-delay:60ms]">
            UO<span className="text-[#ff465f]">GUESSR</span>
          </h1>
          <p className="text-white/65 text-base sm:text-lg font-medium mb-12 text-center [text-shadow:0_2px_12px_rgba(0,0,0,0.85)] animate-fade-up [animation-delay:120ms]">
            {t('guess.tagline')}
          </p>

          {!soloConfig ? (
            /* main menu */
            <nav className="flex flex-col items-center gap-2 animate-fade-up [animation-delay:180ms]">
              <button onClick={() => setSoloConfig(true)} className="group py-1">
                <span className="block text-center text-4xl sm:text-5xl font-extrabold italic uppercase tracking-tight text-white/70 group-hover:text-white group-hover:scale-105 transition-all duration-200 [text-shadow:0_4px_24px_rgba(0,0,0,0.75)]">
                  {t('guess.solo')}
                </span>
              </button>
              <Link href="/guess/party" className="group py-1">
                <span className="block text-center text-4xl sm:text-5xl font-extrabold italic uppercase tracking-tight text-white/70 group-hover:text-white group-hover:scale-105 transition-all duration-200 [text-shadow:0_4px_24px_rgba(0,0,0,0.75)]">
                  {t('guess.party')}
                </span>
              </Link>
            </nav>
          ) : (
            /* solo timer config */
            <div className="flex flex-col items-center gap-7 animate-fade-up">
              <div className="flex flex-col items-center">
                <p className="text-xs font-bold uppercase tracking-[0.35em] text-white/55 mb-4 [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">
                  {t('guess.timePerRound')}
                </p>
                <div className="flex gap-2.5">
                  {([30, 60, null] as TimerSetting[]).map((ts) => (
                    <button
                      key={String(ts)}
                      onClick={() => setTimerSetting(ts)}
                      className={`px-7 py-3 rounded-full text-sm font-extrabold uppercase tracking-wide border-2 backdrop-blur-sm transition-all ${
                        timerSetting === ts
                          ? 'border-[#ff465f] text-white bg-[#8f001a]/50 shadow-[0_0_28px_rgba(143,0,26,0.55)]'
                          : 'border-white/25 text-white/60 bg-black/25 hover:border-white/50 hover:text-white'
                      }`}
                    >
                      {ts === null ? t('guess.noTimer') : `${ts}s`}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={startGame} className="group py-1">
                <span className="block text-center text-5xl sm:text-6xl font-extrabold italic uppercase tracking-tight text-[#ff465f] group-hover:scale-105 transition-all duration-200 drop-shadow-[0_6px_28px_rgba(0,0,0,0.7)]">
                  {t('guess.start')}
                </span>
              </button>
            </div>
          )}
        </main>
      </div>
    )
  }

  // ---------- end screen ----------
  if (phase === 'done') {
    return (
      <div key="done" className="fixed inset-0 overflow-y-auto animate-screen-enter">
        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/30 to-black/10 pointer-events-none z-0" />
        <div className="relative z-20 max-w-5xl mx-auto px-6 pt-6 flex justify-end">
          <LanguageToggle variant="dark" />
        </div>

        <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-16">
          <p className="text-white/70 font-bold text-xs sm:text-sm tracking-[0.45em] uppercase mb-3 text-center [text-shadow:0_2px_12px_rgba(0,0,0,0.85)] animate-fade-up">
            {t('guess.finalScore')}
          </p>
          <p className="text-[clamp(64px,10vw,120px)] leading-[0.9] font-extrabold italic text-white tabular-nums tracking-[-0.03em] mb-2 text-center drop-shadow-[0_10px_44px_rgba(0,0,0,0.7)] animate-fade-up [animation-delay:60ms]">
            {displayTotal.toLocaleString()}
          </p>
          <p className="text-white/55 text-sm font-semibold mb-8 text-center [text-shadow:0_2px_8px_rgba(0,0,0,0.8)] animate-fade-up [animation-delay:120ms]">
            {t('guess.outOf', { max: (rounds.length * MAX_POINTS).toLocaleString() })}
          </p>

          <div className="w-full max-w-lg mb-10 animate-fade-up [animation-delay:160ms]">
            <ScoreBar points={totalScore} max={rounds.length * MAX_POINTS} delayMs={300} />
          </div>

          <div className="w-full max-w-lg flex flex-col gap-2.5 mb-10 animate-fade-up [animation-delay:200ms]">
            {results.map((r, i) => (
              <div
                key={r.location.id}
                className="bg-black/50 backdrop-blur-xl border border-white/10 rounded-xl px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-[#8f001a] text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold text-white capitalize truncate">
                      {r.location.id.replace(/-/g, ' ')}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-extrabold text-white tabular-nums">
                      {r.points.toLocaleString()}
                    </span>
                    <span className="text-xs text-white/40 ml-1">pts</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <ScoreBar points={r.points} max={MAX_POINTS} delayMs={400 + i * 150} />
                  </div>
                  <span className="text-xs text-white/40 tabular-nums shrink-0 w-20 text-right">
                    {r.distance !== null ? formatDistance(r.distance) : t('guess.noGuess')}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-1 animate-fade-up [animation-delay:240ms]">
            <button onClick={startGame} className="group py-1">
              <span className="block text-center text-3xl sm:text-4xl font-extrabold italic uppercase tracking-tight text-[#ff465f] group-hover:scale-105 transition-all duration-200 [text-shadow:0_4px_24px_rgba(0,0,0,0.75)]">
                {t('guess.playAgain')}
              </span>
            </button>
            <Link href="/" className="group py-1">
              <span className="block text-center text-3xl sm:text-4xl font-extrabold italic uppercase tracking-tight text-white/60 group-hover:text-white group-hover:scale-105 transition-all duration-200 [text-shadow:0_4px_24px_rgba(0,0,0,0.75)]">
                {t('guess.backHome')}
              </span>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  // ---------- playing / reveal ----------
  const isReveal = phase === 'reveal'

  return (
    <div key="game" className="fixed inset-0 bg-[#0a0a0a] overflow-hidden animate-screen-enter">
      {/* full-screen photo */}
      <div className={`absolute inset-0 ${isReveal ? 'pointer-events-none' : ''}`}>
        {current && <PhotoViewer src={current.image} resetKey={roundIndex} />}
      </div>

      {/* top HUD */}
      <div className="absolute top-0 inset-x-0 p-3 sm:p-4 flex items-start justify-between gap-3 pointer-events-none z-[1100]">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="pointer-events-auto bg-black/60 backdrop-blur border border-white/15 rounded-full px-4 py-2 text-sm font-bold text-white hover:bg-black/80 transition-colors shadow-lg"
          >
            uo<span className="text-[#d4254a]">guessr</span>
          </Link>
          <div className="pointer-events-auto">
            <LanguageToggle variant="dark" />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {timerSetting !== null && !isReveal && (
            <div
              className={`backdrop-blur border rounded-full px-4 py-2 shadow-lg flex items-center gap-2 ${
                timeLeft <= 10
                  ? 'bg-[#8f001a]/90 border-[#d4254a] animate-pulse'
                  : 'bg-black/60 border-white/15'
              }`}
            >
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="13" r="8" />
                <path d="M12 9v4l2.5 2.5" strokeLinecap="round" />
                <path d="M9 2h6" strokeLinecap="round" />
              </svg>
              <span className="text-sm font-extrabold text-white tabular-nums">
                0:{String(timeLeft).padStart(2, '0')}
              </span>
            </div>
          )}

          <div className="bg-black/60 backdrop-blur border border-white/15 rounded-2xl shadow-lg flex divide-x divide-white/15">
            <div className="px-4 sm:px-5 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{t('guess.round')}</p>
              <p className="text-sm font-extrabold text-white tabular-nums">
                {roundIndex + 1} / {rounds.length}
              </p>
            </div>
            <div className="px-4 sm:px-5 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{t('guess.score')}</p>
              <p className="text-sm font-extrabold text-white tabular-nums">
                {totalScore.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* map: corner overlay while playing, full screen on reveal */}
      <div
        className={
          isReveal
            ? 'absolute inset-0 z-[1050]'
            : 'absolute bottom-4 right-4 left-4 sm:left-auto z-[1050] flex flex-col gap-2'
        }
        onMouseEnter={() => setMapHover(true)}
        onMouseLeave={() => setMapHover(false)}
      >
        <div
          className={
            isReveal
              ? 'w-full h-full'
              : `relative rounded-xl overflow-hidden border-2 shadow-2xl transition-all duration-300 ease-out ${
                  mapHover || guess
                    ? 'sm:w-[520px] h-64 sm:h-[380px] border-white/30 opacity-100'
                    : 'sm:w-80 h-48 sm:h-56 border-white/15 opacity-80'
                }`
          }
        >
          {/* On desktop: map is always the full hover size, centered inside the clipping container.
              The container animates its visible region — Mapbox never resizes during the transition.
              On mobile: map fills the container normally (height-only change, negligible). */}
          <div className={isReveal ? 'w-full h-full' : 'w-full h-full sm:absolute sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[520px] sm:h-[380px]'}>
            <GuessMap
              phase={isReveal ? 'reveal' : 'playing'}
              guess={guess}
              actual={isReveal && current ? { lat: current.lat, lng: current.lng } : null}
              onPick={setGuess}
            />
          </div>
        </div>

        {!isReveal && (
          <button
            onClick={submitGuess}
            disabled={!guess}
            className={`w-full py-3.5 rounded-xl font-extrabold text-sm tracking-wide transition-all shadow-2xl ${
              guess
                ? 'bg-gradient-to-r from-[#8f001a] to-[#b3001f] text-white hover:from-[#a30020] hover:to-[#cc0024] shadow-[0_8px_28px_rgba(143,0,26,0.55)]'
                : 'bg-black/60 backdrop-blur border border-white/15 text-white/40 cursor-not-allowed'
            }`}
          >
            {guess ? t('guess.guess') : t('guess.placePin')}
          </button>
        )}
      </div>

      {/* reveal banner */}
      {isReveal && lastResult && (
        <div className="absolute bottom-0 inset-x-0 z-[1100] flex justify-center px-4 pb-6 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-xl bg-[#111]/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl px-6 sm:px-10 py-6 animate-block-enter">
            <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-[#d4254a] mb-1">
              {lastResult.guess ? t(resultLabelKey(lastResult.points)) : t('guess.timeRanOut')}
            </p>
            <p className="text-center text-5xl font-extrabold text-white tabular-nums mb-4">
              {displayPoints.toLocaleString()}
              <span className="text-lg font-bold text-white/40 ml-2">pts</span>
            </p>

            <div className="mb-4">
              <ScoreBar points={lastResult.points} max={MAX_POINTS} delayMs={800} />
            </div>

            <p className="text-center text-sm text-white/60 mb-5">
              {lastResult.distance !== null
                ? t('guess.distanceFrom', { dist: formatDistance(lastResult.distance) })
                : t('guess.noPin')}
            </p>

            <button
              onClick={nextRound}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#8f001a] to-[#b3001f] text-white font-extrabold text-sm tracking-wide hover:from-[#a30020] hover:to-[#cc0024] transition-all shadow-[0_8px_28px_rgba(143,0,26,0.55)]"
            >
              {roundIndex + 1 >= rounds.length ? t('guess.viewResults') : t('guess.nextRound')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
