'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { GUESS_LOCATIONS, type GuessLocation } from '@/data/guess_locations'
import type { MapPoint } from '@/components/guess/GuessMap'

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

function resultLabel(points: number) {
  if (points >= 950) return 'Perfect!'
  if (points >= 700) return 'Impressive!'
  if (points >= 400) return 'Nice one!'
  if (points >= 100) return 'Getting warmer…'
  return 'Were you even on campus?'
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
      <div className="fixed inset-0 overflow-y-auto bg-[#0a0a0a]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_-5%,rgba(143,0,26,0.38),transparent)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_35%_at_90%_105%,rgba(143,0,26,0.15),transparent)] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-6 pt-6">
          {soloConfig ? (
            <button
              onClick={() => setSoloConfig(false)}
              className="text-white/60 hover:text-white font-semibold text-sm transition-colors"
            >
              ← back
            </button>
          ) : (
            <a href="/" className="text-white/60 hover:text-white font-semibold text-sm transition-colors">
              ← uomap
            </a>
          )}
        </div>

        <main className="relative flex flex-col items-center justify-center px-6 pb-16 pt-10 min-h-[calc(100vh-80px)]">
          <p className="text-[#d4254a] font-bold text-xs tracking-[0.35em] uppercase mb-4">
            University of Ottawa
          </p>
          <h1 className="text-7xl sm:text-8xl font-extrabold text-white tracking-tight mb-12">
            uo<span className="text-[#d4254a]">guessr</span>
          </h1>

          {!soloConfig ? (
            /* mode cards */
            <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Solo */}
              <button
                onClick={() => setSoloConfig(true)}
                className="group text-left bg-white/[0.035] border border-white/[0.08] hover:border-[#d4254a]/50 hover:bg-[#8f001a]/[0.12] rounded-2xl p-7 flex flex-col gap-5 transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-xl bg-[#8f001a]/25 border border-[#d4254a]/25 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#d4254a]" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"/>
                    <circle cx="12" cy="10" r="3" fill="currentColor"/>
                  </svg>
                </div>

                <div>
                  <p className="text-white font-extrabold text-xl mb-2">Solo</p>
                  <p className="text-white/45 text-sm leading-relaxed">
                    5 rounds, one photo each. Drop your pin and score up to 1,000 points per round based on accuracy.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {['5 rounds', '5,000 pts max', 'campus only'].map(c => (
                    <span key={c} className="text-[11px] font-semibold text-white/30 border border-white/[0.1] rounded-full px-2.5 py-1">
                      {c}
                    </span>
                  ))}
                </div>

                <span className="text-sm font-bold text-[#d4254a] group-hover:underline underline-offset-4 mt-auto">
                  Play solo →
                </span>
              </button>

              {/* Party */}
              <a
                href="/guess/party"
                className="group text-left bg-white/[0.035] border border-white/[0.08] hover:border-[#d4254a]/50 hover:bg-[#8f001a]/[0.12] rounded-2xl p-7 flex flex-col gap-5 transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-xl bg-[#8f001a]/25 border border-[#d4254a]/25 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#d4254a]" viewBox="0 0 24 24" fill="none">
                    <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.75"/>
                    <path d="M3 20c0-3.31 2.69-6 6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                    <circle cx="17" cy="8" r="3" stroke="currentColor" strokeWidth="1.75" strokeOpacity="0.5"/>
                    <path d="M21 20c0-3.31-2.69-6-6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeOpacity="0.5"/>
                  </svg>
                </div>

                <div>
                  <p className="text-white font-extrabold text-xl mb-2">Party</p>
                  <p className="text-white/45 text-sm leading-relaxed">
                    Play live with friends. 1v1 duels with HP bars, free-for-all, or 2v2 team battles.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {['2–5 players', 'real-time', '3 modes'].map(c => (
                    <span key={c} className="text-[11px] font-semibold text-white/30 border border-white/[0.1] rounded-full px-2.5 py-1">
                      {c}
                    </span>
                  ))}
                </div>

                <span className="text-sm font-bold text-[#d4254a] group-hover:underline underline-offset-4 mt-auto">
                  Create or join →
                </span>
              </a>
            </div>
          ) : (
            /* solo timer config */
            <div className="w-full max-w-xs flex flex-col items-center gap-8">
              <div className="w-full">
                <p className="text-xs font-bold uppercase tracking-widest text-white/35 mb-4 text-center">
                  Time per round
                </p>
                <div className="grid grid-cols-3 gap-2.5">
                  {([30, 60, null] as TimerSetting[]).map((t) => (
                    <button
                      key={String(t)}
                      onClick={() => setTimerSetting(t)}
                      className={`py-3.5 rounded-xl text-sm font-bold border-2 transition-all ${
                        timerSetting === t
                          ? 'border-[#d4254a] text-white bg-[#8f001a]/30 shadow-[0_0_28px_rgba(143,0,26,0.45)]'
                          : 'border-white/[0.09] text-white/45 hover:border-white/25 hover:text-white/75'
                      }`}
                    >
                      {t === null ? 'None' : `${t}s`}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={startGame}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-[#8f001a] to-[#b3001f] text-white font-extrabold text-lg tracking-wide hover:from-[#a30020] hover:to-[#cc0024] transition-all shadow-[0_8px_36px_rgba(143,0,26,0.55)] hover:shadow-[0_10px_44px_rgba(143,0,26,0.7)] hover:-translate-y-0.5"
              >
                PLAY
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
      <div className="fixed inset-0 overflow-y-auto bg-[#0a0a0a]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(143,0,26,0.35),transparent)] pointer-events-none" />

        <main className="relative flex flex-col items-center px-6 py-16 min-h-screen justify-center">
          <p className="text-[#d4254a] font-bold text-sm tracking-[0.3em] uppercase mb-4">
            Game over
          </p>
          <p className="text-7xl sm:text-8xl font-extrabold text-white tabular-nums tracking-tight mb-2">
            {displayTotal.toLocaleString()}
          </p>
          <p className="text-[#888] text-sm mb-8">
            out of {(rounds.length * MAX_POINTS).toLocaleString()} points
          </p>

          <div className="w-full max-w-lg mb-10">
            <ScoreBar points={totalScore} max={rounds.length * MAX_POINTS} delayMs={300} />
          </div>

          <div className="w-full max-w-lg flex flex-col gap-2.5 mb-10">
            {results.map((r, i) => (
              <div
                key={r.location.id}
                className="bg-white/[0.04] border border-white/10 rounded-xl px-5 py-4 backdrop-blur"
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
                    {r.distance !== null ? formatDistance(r.distance) : 'no guess'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 w-full max-w-lg">
            <button
              onClick={startGame}
              className="flex-1 py-4 rounded-xl bg-gradient-to-r from-[#8f001a] to-[#b3001f] text-white font-extrabold text-base hover:from-[#a30020] hover:to-[#cc0024] transition-all shadow-[0_8px_32px_rgba(143,0,26,0.5)]"
            >
              Play again
            </button>
            <a
              href="/"
              className="flex-1 py-4 rounded-xl border-2 border-white/15 text-white/70 font-bold text-base text-center hover:border-white/40 hover:text-white transition-all"
            >
              Back home
            </a>
          </div>
        </main>
      </div>
    )
  }

  // ---------- playing / reveal ----------
  const isReveal = phase === 'reveal'

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] overflow-hidden">
      {/* full-screen photo */}
      <div className={`absolute inset-0 ${isReveal ? 'pointer-events-none' : ''}`}>
        {current && <PhotoViewer src={current.image} resetKey={roundIndex} />}
      </div>

      {/* top HUD */}
      <div className="absolute top-0 inset-x-0 p-3 sm:p-4 flex items-start justify-between gap-3 pointer-events-none z-[1100]">
        <a
          href="/"
          className="pointer-events-auto bg-black/60 backdrop-blur border border-white/15 rounded-full px-4 py-2 text-sm font-bold text-white hover:bg-black/80 transition-colors shadow-lg"
        >
          uo<span className="text-[#d4254a]">guessr</span>
        </a>

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
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Round</p>
              <p className="text-sm font-extrabold text-white tabular-nums">
                {roundIndex + 1} / {rounds.length}
              </p>
            </div>
            <div className="px-4 sm:px-5 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Score</p>
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
              : `rounded-xl overflow-hidden border-2 shadow-2xl transition-all duration-300 ease-out ${
                  mapHover || guess
                    ? 'sm:w-[520px] h-64 sm:h-[380px] border-white/30 opacity-100'
                    : 'sm:w-80 h-48 sm:h-56 border-white/15 opacity-80'
                }`
          }
        >
          <GuessMap
            phase={isReveal ? 'reveal' : 'playing'}
            guess={guess}
            actual={isReveal && current ? { lat: current.lat, lng: current.lng } : null}
            onPick={setGuess}
          />
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
            {guess ? 'GUESS' : 'PLACE YOUR PIN ON THE MAP'}
          </button>
        )}
      </div>

      {/* reveal banner */}
      {isReveal && lastResult && (
        <div className="absolute bottom-0 inset-x-0 z-[1100] flex justify-center px-4 pb-6 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-xl bg-[#111]/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl px-6 sm:px-10 py-6 animate-block-enter">
            <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-[#d4254a] mb-1">
              {lastResult.guess ? resultLabel(lastResult.points) : 'Time ran out'}
            </p>
            <p className="text-center text-5xl font-extrabold text-white tabular-nums mb-4">
              {displayPoints.toLocaleString()}
              <span className="text-lg font-bold text-white/40 ml-2">pts</span>
            </p>

            <div className="mb-4">
              <ScoreBar points={lastResult.points} max={MAX_POINTS} delayMs={800} />
            </div>

            <p className="text-center text-sm text-white/60 mb-5">
              {lastResult.distance !== null ? (
                <>
                  Your guess was{' '}
                  <span className="font-bold text-white">{formatDistance(lastResult.distance)}</span>{' '}
                  from the correct location
                </>
              ) : (
                'No pin placed, 0 points this round'
              )}
            </p>

            <button
              onClick={nextRound}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#8f001a] to-[#b3001f] text-white font-extrabold text-sm tracking-wide hover:from-[#a30020] hover:to-[#cc0024] transition-all shadow-[0_8px_28px_rgba(143,0,26,0.55)]"
            >
              {roundIndex + 1 >= rounds.length ? 'VIEW RESULTS' : 'NEXT ROUND'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
