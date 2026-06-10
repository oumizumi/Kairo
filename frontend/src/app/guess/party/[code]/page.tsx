'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { GUESS_LOCATIONS } from '@/data/guess_locations'
import type { MapPoint } from '@/components/guess/GuessMap'
import type { PlayerPin } from '@/components/guess/PartyGuessMap'
import type { PartyGuess, PartyPlayer, PartyRoom } from '@/types/party'

const PartyGuessMap = dynamic(() => import('@/components/guess/PartyGuessMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
      <span className="text-sm text-[#888]">Loading map…</span>
    </div>
  ),
})

const PARTY_COLORS = ['#d4254a', '#1d4ed8', '#15803d', '#b45309', '#7c3aed', '#be185d', '#0369a1', '#065f46']
const MAX_POINTS = 1000
const ROUNDS_PER_GAME = 5
const DUEL_STARTING_HP = 5000

// helpers
function getOrCreatePlayerId(): string {
  if (typeof window === 'undefined') return ''
  let id = sessionStorage.getItem('party_player_id')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('party_player_id', id)
  }
  return id
}

function distanceMeters(a: MapPoint, b: MapPoint) {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function scoreFor(dist: number) {
  return Math.round(MAX_POINTS * Math.exp(-dist / 150))
}

function formatDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`
}

function pickRoundIds(): string[] {
  const pool = [...GUESS_LOCATIONS]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.min(ROUNDS_PER_GAME, pool.length)).map(l => l.id)
}

// PhotoViewer, same as solo page
function PhotoViewer({ src, resetKey }: { src: string; resetKey: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchDistRef = useRef<number | null>(null)
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => { setScale(1); setOffset({ x: 0, y: 0 }) }, [resetKey])
  useEffect(() => { setLoaded(false) }, [src])

  const clampOffset = useCallback((x: number, y: number, s: number) => {
    const el = containerRef.current
    if (!el) return { x, y }
    const maxX = (el.clientWidth * (s - 1)) / 2
    const maxY = (el.clientHeight * (s - 1)) / 2
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) }
  }, [])

  const zoomTo = useCallback((next: number) => {
    const s = Math.min(5, Math.max(1, next))
    setScale(s)
    setOffset(o => clampOffset(o.x, o.y, s))
  }, [clampOffset])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#0a0a0a] select-none touch-none"
      style={{ cursor: isDragging ? 'grabbing' : scale > 1 ? 'grab' : 'zoom-in' }}
      onWheel={e => zoomTo(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15))}
      onDoubleClick={() => scale > 1 ? (setScale(1), setOffset({ x: 0, y: 0 })) : zoomTo(2.2)}
      onPointerDown={e => {
        e.currentTarget.setPointerCapture(e.pointerId)
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (pointersRef.current.size === 1) { dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }; setIsDragging(true) }
        else { dragRef.current = null; pinchDistRef.current = null }
      }}
      onPointerMove={e => {
        const pointers = pointersRef.current
        if (!pointers.has(e.pointerId)) return
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (pointers.size === 2) {
          const [p1, p2] = [...pointers.values()]
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y)
          if (pinchDistRef.current !== null) zoomTo(scale * (dist / pinchDistRef.current))
          pinchDistRef.current = dist
          return
        }
        if (dragRef.current && scale > 1) {
          const { x, y, ox, oy } = dragRef.current
          setOffset(clampOffset(ox + (e.clientX - x), oy + (e.clientY - y), scale))
        }
      }}
      onPointerUp={e => { pointersRef.current.delete(e.pointerId); pinchDistRef.current = null; dragRef.current = null; setIsDragging(false) }}
      onPointerCancel={e => { pointersRef.current.delete(e.pointerId); pinchDistRef.current = null; dragRef.current = null; setIsDragging(false) }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        onLoad={() => setLoaded(true)}
        className="w-full h-full object-cover"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transition: isDragging ? 'none' : 'transform 120ms ease-out, opacity 200ms ease-out', opacity: loaded ? 1 : 0 }}
      />
      <div className="absolute bottom-6 left-4 flex flex-col gap-2 z-[1050]">
        <button onClick={e => { e.stopPropagation(); zoomTo(scale * 1.5) }} onPointerDown={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()} aria-label="Zoom in" className="w-11 h-11 rounded-full bg-black/60 backdrop-blur border border-white/15 text-white text-xl font-bold hover:bg-black/80 hover:border-white/30 transition-all shadow-lg">+</button>
        <button onClick={e => { e.stopPropagation(); zoomTo(scale / 1.5) }} onPointerDown={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()} aria-label="Zoom out" className="w-11 h-11 rounded-full bg-black/60 backdrop-blur border border-white/15 text-white text-xl font-bold hover:bg-black/80 hover:border-white/30 transition-all shadow-lg">−</button>
        {scale > 1 && <span className="text-center text-[11px] font-semibold text-white/80 bg-black/60 backdrop-blur rounded-full px-2 py-1 tabular-nums">{scale.toFixed(1)}x</span>}
      </div>
    </div>
  )
}

// HP bar with CSS transition drain
function HpBar({ hp, maxHp, color }: { hp: number; maxHp: number; color: string }) {
  const [displayPct, setDisplayPct] = useState((hp / maxHp) * 100)
  useEffect(() => {
    const t = setTimeout(() => setDisplayPct(Math.max(0, (hp / maxHp) * 100)), 100)
    return () => clearTimeout(t)
  }, [hp, maxHp])
  return (
    <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${displayPct}%`, background: color, transition: 'width 1200ms cubic-bezier(0.22, 1, 0.36, 1)' }}
      />
    </div>
  )
}

// Round scores banner row
function ScoreRow({ name, points, distance, color }: { name: string; points: number; distance: number | null; color: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
      <span className="flex-1 text-sm font-semibold text-white truncate">{name}</span>
      <span className="text-xs text-white/50 shrink-0">{distance !== null ? formatDistance(distance) : 'no pin'}</span>
      <span className="text-sm font-extrabold text-white tabular-nums shrink-0 w-14 text-right">{points.toLocaleString()}</span>
    </div>
  )
}

export default function PartyRoomPage() {
  const params = useParams()
  const router = useRouter()
  const code = ((params.code as string) ?? '').toUpperCase()

  const [myPlayerId] = useState(() => getOrCreatePlayerId())

  const [room, setRoom] = useState<PartyRoom | null>(null)
  const [players, setPlayers] = useState<PartyPlayer[]>([])
  const [guesses, setGuesses] = useState<PartyGuess[]>([])
  const [myGuess, setMyGuess] = useState<MapPoint | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [hasJoined, setHasJoined] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joinName, setJoinName] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [mapHover, setMapHover] = useState(false)

  const hasTriggeredRevealRef = useRef(false)
  const hasAutoSubmittedRef = useRef(false)
  const myGuessRef = useRef<MapPoint | null>(null)

  // keep refs current
  const roomRef = useRef<PartyRoom | null>(null)
  const playersRef = useRef<PartyPlayer[]>([])
  const guessesRef = useRef<PartyGuess[]>([])
  useEffect(() => { roomRef.current = room }, [room])
  useEffect(() => { playersRef.current = players }, [players])
  useEffect(() => { guessesRef.current = guesses }, [guesses])
  useEffect(() => { myGuessRef.current = myGuess }, [myGuess])

  // derived
  const isHost = room?.host_player_id === myPlayerId
  const currentLocation = room
    ? GUESS_LOCATIONS.find(l => l.id === room.round_location_ids[room.round_index])
    : undefined
  const roundGuesses = guesses.filter(g => g.round_index === (room?.round_index ?? -1))
  const allSubmitted = players.length > 0 && players.every(p => roundGuesses.some(g => g.player_id === p.id))
  const myPlayer = players.find(p => p.id === myPlayerId)

  const playerColorMap = new Map(players.map((p, i) => [p.id, PARTY_COLORS[i % PARTY_COLORS.length]]))
  const myColor = playerColorMap.get(myPlayerId) ?? PARTY_COLORS[0]

  // all player pins for reveal
  const allPlayerPins: PlayerPin[] = players.map(p => ({
    playerId: p.id,
    displayName: p.display_name,
    guess: (() => {
      const g = roundGuesses.find(rg => rg.player_id === p.id)
      if (!g || g.lat === null || g.lng === null) return null
      return { lat: g.lat, lng: g.lng }
    })(),
    color: playerColorMap.get(p.id) ?? PARTY_COLORS[0],
  }))

  const myPin: PlayerPin = {
    playerId: myPlayerId,
    displayName: myPlayer?.display_name ?? '',
    guess: myGuess,
    color: myColor,
  }

  const mapPlayerPins = room?.phase === 'playing' ? [myPin] : allPlayerPins

  // initial data fetch
  useEffect(() => {
    const fetch = async () => {
      const [roomRes, playersRes, guessesRes] = await Promise.all([
        supabase.from('party_rooms').select('*').eq('id', code).single(),
        supabase.from('party_players').select('*').eq('room_id', code).order('joined_at'),
        supabase.from('party_guesses').select('*').eq('room_id', code),
      ])
      if (roomRes.error || !roomRes.data) {
        setError('Room not found.')
        setLoading(false)
        return
      }
      setRoom(roomRes.data as PartyRoom)
      const loadedPlayers = (playersRes.data as PartyPlayer[]) ?? []
      setPlayers(loadedPlayers)
      setGuesses((guessesRes.data as PartyGuess[]) ?? [])
      setHasJoined(loadedPlayers.some(p => p.id === myPlayerId))
      setLoading(false)
    }
    fetch()
  }, [code, myPlayerId])

  // realtime
  useEffect(() => {
    const channel = supabase.channel(`party:${code}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'party_rooms', filter: `id=eq.${code}` },
        ({ new: r }) => setRoom(r as PartyRoom))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'party_players', filter: `room_id=eq.${code}` },
        ({ new: p }) => setPlayers(prev => prev.some(x => x.id === (p as PartyPlayer).id) ? prev : [...prev, p as PartyPlayer]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'party_players', filter: `room_id=eq.${code}` },
        ({ new: p }) => setPlayers(prev => prev.map(x => x.id === (p as PartyPlayer).id ? p as PartyPlayer : x)))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'party_guesses', filter: `room_id=eq.${code}` },
        ({ new: g }) => setGuesses(prev => prev.some(x => x.id === (g as PartyGuess).id) ? prev : [...prev, g as PartyGuess]))
      .on('broadcast', { event: 'new_game' }, ({ payload }) => router.push(`/guess/party/${payload.code}`))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [code, router])

  // reset per-round state when round changes
  useEffect(() => {
    hasTriggeredRevealRef.current = false
    hasAutoSubmittedRef.current = false
    setMyGuess(null)
    setMapHover(false)
  }, [room?.round_index])

  // submit my guess to DB
  const submitMyGuess = useCallback(async (guess: MapPoint | null) => {
    const r = roomRef.current
    if (!r || r.phase !== 'playing') return
    const loc = GUESS_LOCATIONS.find(l => l.id === r.round_location_ids[r.round_index])
    if (!loc) return
    const dist = guess ? distanceMeters(guess, { lat: loc.lat, lng: loc.lng }) : null
    const points = dist !== null ? scoreFor(dist) : 0
    await supabase.from('party_guesses').upsert({
      room_id: code,
      player_id: myPlayerId,
      round_index: r.round_index,
      lat: guess?.lat ?? null,
      lng: guess?.lng ?? null,
      distance_m: dist,
      points,
    }, { onConflict: 'room_id,player_id,round_index' })
  }, [code, myPlayerId])

  // host: update duel HP after reveal
  const updateDuelHp = useCallback(async () => {
    const r = roomRef.current
    const ps = playersRef.current
    const gs = guessesRef.current
    if (!r || r.mode !== 'duel' || ps.length < 2) return
    const [p1, p2] = ps
    const rGuesses = gs.filter(g => g.round_index === r.round_index)
    const pts1 = rGuesses.find(g => g.player_id === p1.id)?.points ?? 0
    const pts2 = rGuesses.find(g => g.player_id === p2.id)?.points ?? 0
    const gap = Math.abs(pts1 - pts2)
    if (gap === 0) return
    const loserId = pts1 < pts2 ? p1.id : p2.id
    const loser = ps.find(p => p.id === loserId)
    if (!loser || loser.hp === null) return
    const newHp = Math.max(0, loser.hp - gap)
    await supabase.from('party_players').update({ hp: newHp }).eq('id', loserId)
    if (newHp <= 0) {
      await supabase.from('party_rooms').update({ phase: 'done' }).eq('id', code)
    }
  }, [code])

  // host: trigger reveal
  const triggerReveal = useCallback(async () => {
    const r = roomRef.current
    if (!r) return
    const { error } = await supabase.from('party_rooms')
      .update({ phase: 'reveal' })
      .eq('id', code)
      .eq('phase', 'playing')
    if (!error && r.mode === 'duel') {
      await updateDuelHp()
    }
  }, [code, updateDuelHp])

  // host: check all submitted after each new guess
  useEffect(() => {
    if (!isHost || room?.phase !== 'playing' || hasTriggeredRevealRef.current) return
    if (players.length === 0) return
    if (allSubmitted) {
      hasTriggeredRevealRef.current = true
      triggerReveal()
    }
  }, [guesses, players, room?.phase, isHost, allSubmitted, triggerReveal])

  // timer countdown using absolute deadline
  useEffect(() => {
    if (room?.phase !== 'playing' || !room.reveal_deadline) {
      setTimeLeft(0)
      return
    }
    const deadline = new Date(room.reveal_deadline).getTime()
    const iv = setInterval(() => {
      const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining <= 0) {
        clearInterval(iv)
        if (!hasAutoSubmittedRef.current) {
          hasAutoSubmittedRef.current = true
          submitMyGuess(myGuessRef.current)
        }
      }
    }, 500)
    return () => clearInterval(iv)
  }, [room?.phase, room?.reveal_deadline, room?.round_index, submitMyGuess])

  // host: advance to next round or end game
  const nextRound = async () => {
    if (!room || !isHost) return
    const nextIndex = room.round_index + 1
    if (nextIndex >= room.round_location_ids.length) {
      await supabase.from('party_rooms').update({ phase: 'done' }).eq('id', code)
      return
    }
    const deadline = room.timer_setting
      ? new Date(Date.now() + room.timer_setting * 1000).toISOString()
      : null
    await supabase.from('party_rooms').update({
      phase: 'playing',
      round_index: nextIndex,
      reveal_deadline: deadline,
    }).eq('id', code)
  }

  // host: start game
  const startGame = async () => {
    if (!room || !isHost) return
    const ids = pickRoundIds()
    const deadline = room.timer_setting
      ? new Date(Date.now() + room.timer_setting * 1000).toISOString()
      : null
    if (room.mode === 'duel') {
      for (const p of players) {
        await supabase.from('party_players').update({ hp: DUEL_STARTING_HP }).eq('id', p.id)
      }
    }
    await supabase.from('party_rooms').update({
      phase: 'playing',
      round_index: 0,
      round_location_ids: ids,
      reveal_deadline: deadline,
    }).eq('id', code)
  }

  // host: assign team in duos
  const assignTeam = async (playerId: string, team: number) => {
    await supabase.from('party_players').update({ team }).eq('id', playerId)
  }

  // host: play again (new room)
  const playAgain = async () => {
    if (!isHost) return
    const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const newCode = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
    const { error } = await supabase.from('party_rooms').insert({
      id: newCode,
      mode: room!.mode,
      host_player_id: myPlayerId,
      phase: 'lobby',
      round_index: 0,
      round_location_ids: [],
      timer_setting: room!.timer_setting,
    })
    if (error) return
    for (const p of players) {
      await supabase.from('party_players').insert({
        id: p.id,
        room_id: newCode,
        display_name: p.display_name,
        team: null,
        hp: room!.mode === 'duel' ? DUEL_STARTING_HP : null,
      })
    }
    await supabase.channel(`party:${code}`).send({
      type: 'broadcast',
      event: 'new_game',
      payload: { code: newCode },
    })
    router.push(`/guess/party/${newCode}`)
  }

  // join from direct URL
  const joinDirectly = async () => {
    if (!joinName.trim()) { setJoinError('Enter your name'); return }
    if (!room || room.phase !== 'lobby') { setJoinError('Game already started'); return }
    setJoining(true)
    await supabase.from('party_players').upsert({
      id: myPlayerId,
      room_id: code,
      display_name: joinName.trim().slice(0, 24),
      team: null,
      hp: room.mode === 'duel' ? DUEL_STARTING_HP : null,
    }, { onConflict: 'id' })
    setHasJoined(true)
    setJoining(false)
  }

  // total points per player across all rounds
  const totalPoints = (playerId: string) =>
    guesses.filter(g => g.player_id === playerId).reduce((sum, g) => sum + g.points, 0)

  // team total
  const teamTotal = (team: number) =>
    players.filter(p => p.team === team).reduce((sum, p) => sum + totalPoints(p.id), 0)

  // min players needed to start
  const minPlayers = room?.mode === 'duos' ? 4 : 2
  const canStart = players.length >= minPlayers

  // ── loading / error ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center">
        <span className="text-[#888] text-sm">Loading…</span>
      </div>
    )
  }

  if (error || !room) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center gap-4">
        <p className="text-white font-bold text-lg">{error ?? 'Room not found'}</p>
        <a href="/guess/party" className="text-[#d4254a] text-sm font-semibold hover:underline">Back to party</a>
      </div>
    )
  }

  // ── join form (direct URL access) ────────────────────────────────────────

  if (!hasJoined) {
    if (room.phase !== 'lobby') {
      return (
        <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center gap-4">
          <p className="text-white font-bold text-lg">Game already in progress</p>
          <a href="/guess/party" className="text-[#d4254a] text-sm font-semibold hover:underline">Back to party</a>
        </div>
      )
    }
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center px-6">
        <div className="w-full max-w-sm bg-white/[0.04] border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
          <p className="text-white font-bold text-lg text-center">Join room <span className="font-mono text-[#d4254a]">{code}</span></p>
          <input
            type="text"
            maxLength={24}
            placeholder="Display name"
            value={joinName}
            onChange={e => { setJoinName(e.target.value); setJoinError('') }}
            onKeyDown={e => e.key === 'Enter' && joinDirectly()}
            className="w-full bg-white/[0.06] border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm outline-none focus:border-[#d4254a] transition-colors"
          />
          {joinError && <p className="text-[#d4254a] text-sm">{joinError}</p>}
          <button
            onClick={joinDirectly}
            disabled={joining}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#8f001a] to-[#b3001f] text-white font-extrabold text-sm disabled:opacity-50"
          >
            {joining ? 'Joining…' : 'Join'}
          </button>
        </div>
      </div>
    )
  }

  // ── lobby ────────────────────────────────────────────────────────────────

  if (room.phase === 'lobby') {
    const modeLabel = room.mode === 'duel' ? 'Duel' : room.mode === 'ffa' ? 'Free for All' : 'Duos'
    const [copied, setCopied] = [false, (_: boolean) => {}]
    const copyCode = () => {
      navigator.clipboard?.writeText(code)
    }
    return (
      <div className="fixed inset-0 overflow-y-auto bg-[#0a0a0a]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_-5%,rgba(143,0,26,0.28),transparent)] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-6 pt-6">
          <a href="/guess/party" className="text-white/60 hover:text-white font-semibold text-sm transition-colors">← Party</a>
        </div>

        <main className="relative flex flex-col items-center px-6 pb-16 pt-10 min-h-[calc(100vh-72px)]">

          {/* code hero */}
          <p className="text-white/35 text-xs font-bold uppercase tracking-[0.3em] mb-3">Room code</p>
          <button
            onClick={copyCode}
            className="font-mono text-6xl sm:text-7xl font-extrabold text-white tracking-[0.15em] hover:text-[#d4254a] transition-colors mb-2"
          >
            {code}
          </button>
          <p className="text-white/25 text-xs mb-10">tap to copy · share with friends</p>

          <div className="w-full max-w-sm flex flex-col gap-6">

            {/* room info */}
            <div className="flex items-center justify-center gap-3">
              <span className="text-xs font-bold text-[#d4254a]/80 border border-[#d4254a]/25 bg-[#8f001a]/15 rounded-full px-3 py-1">{modeLabel}</span>
              <span className="text-xs text-white/30">{ROUNDS_PER_GAME} rounds</span>
              <span className="text-xs text-white/30">{room.timer_setting ? `${room.timer_setting}s` : 'no timer'}</span>
            </div>

            {/* players */}
            <div className="flex flex-col gap-2">
              {players.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PARTY_COLORS[i % PARTY_COLORS.length] }} />
                  <span className="flex-1 text-sm font-semibold text-white truncate">{p.display_name}</span>
                  {p.id === room.host_player_id && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">host</span>
                  )}
                  {p.id === myPlayerId && p.id !== room.host_player_id && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#d4254a]/60">you</span>
                  )}
                  {p.id === myPlayerId && p.id === room.host_player_id && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#d4254a]/60">you</span>
                  )}
                  {room.mode === 'duos' && isHost && (
                    <div className="flex gap-1.5">
                      {[1, 2].map(t => (
                        <button
                          key={t}
                          onClick={() => assignTeam(p.id, t)}
                          className={`text-xs font-bold px-2 py-0.5 rounded border transition-all ${
                            p.team === t
                              ? 'bg-[#8f001a]/30 border-[#d4254a]/60 text-[#d4254a]'
                              : 'border-white/15 text-white/35 hover:border-white/30 hover:text-white/60'
                          }`}
                        >
                          T{t}
                        </button>
                      ))}
                    </div>
                  )}
                  {room.mode === 'duos' && !isHost && p.team && (
                    <span className="text-xs text-white/30">Team {p.team}</span>
                  )}
                </div>
              ))}
            </div>

            {/* status / start */}
            {isHost ? (
              <div className="flex flex-col gap-2">
                {!canStart && (
                  <p className="text-white/30 text-xs text-center">
                    Waiting for {minPlayers - players.length} more player{minPlayers - players.length !== 1 ? 's' : ''}
                  </p>
                )}
                <button
                  onClick={startGame}
                  disabled={!canStart}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#8f001a] to-[#b3001f] text-white font-extrabold text-sm tracking-wide hover:from-[#a30020] hover:to-[#cc0024] transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_8px_28px_rgba(143,0,26,0.4)]"
                >
                  Start Game
                </button>
              </div>
            ) : (
              <p className="text-white/30 text-xs text-center">Waiting for host to start</p>
            )}

          </div>
        </main>
      </div>
    )
  }

  // ── done ─────────────────────────────────────────────────────────────────

  if (room.phase === 'done') {
    const sorted = [...players].sort((a, b) => totalPoints(b.id) - totalPoints(a.id))

    return (
      <div className="fixed inset-0 overflow-y-auto bg-[#0a0a0a]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(143,0,26,0.35),transparent)] pointer-events-none" />
        <main className="relative flex flex-col items-center px-6 py-16 min-h-screen justify-center">
          <p className="text-[#d4254a] font-bold text-sm tracking-[0.3em] uppercase mb-4">Game Over</p>

          {/* Duel result */}
          {room.mode === 'duel' && players.length === 2 && (() => {
            const [p1, p2] = players
            const winner = (p1.hp ?? 0) > 0 ? p1 : p2
            const loser = winner.id === p1.id ? p2 : p1
            const winnerColor = playerColorMap.get(winner.id) ?? PARTY_COLORS[0]
            return (
              <div className="w-full max-w-md mb-8">
                <p className="text-center text-2xl font-extrabold text-white mb-6">
                  <span style={{ color: winnerColor }}>{winner.display_name}</span> wins!
                </p>
                {[winner, loser].map((p, i) => (
                  <div key={p.id} className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-white">{p.display_name}{p.id === myPlayerId ? ' (you)' : ''}</span>
                      <span className="text-xs text-white/50 tabular-nums">{Math.max(0, p.hp ?? 0)} / {DUEL_STARTING_HP} HP</span>
                    </div>
                    <HpBar hp={Math.max(0, p.hp ?? 0)} maxHp={DUEL_STARTING_HP} color={playerColorMap.get(p.id) ?? PARTY_COLORS[i]} />
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Duos result */}
          {room.mode === 'duos' && (
            <div className="w-full max-w-md mb-8">
              {[1, 2].map(team => (
                <div key={team} className="bg-white/[0.04] border border-white/10 rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-white">Team {team}</span>
                    <span className="text-lg font-extrabold text-white tabular-nums">{teamTotal(team).toLocaleString()}</span>
                  </div>
                  {players.filter(p => p.team === team).map((p, i) => (
                    <div key={p.id} className="flex items-center gap-2 text-sm text-white/60 mt-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: playerColorMap.get(p.id) ?? PARTY_COLORS[i] }} />
                      <span>{p.display_name}</span>
                      <span className="ml-auto tabular-nums">{totalPoints(p.id).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* FFA leaderboard */}
          {room.mode === 'ffa' && (
            <div className="w-full max-w-md mb-8 flex flex-col gap-2">
              {sorted.map((p, i) => (
                <div key={p.id} className="bg-white/[0.04] border border-white/10 rounded-xl px-5 py-3 flex items-center gap-3">
                  <span className="text-lg font-extrabold text-white/40 w-7 text-center tabular-nums">#{i + 1}</span>
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: playerColorMap.get(p.id) ?? PARTY_COLORS[i] }} />
                  <span className="flex-1 text-sm font-semibold text-white">{p.display_name}{p.id === myPlayerId ? ' (you)' : ''}</span>
                  <span className="text-sm font-extrabold text-white tabular-nums">{totalPoints(p.id).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 w-full max-w-md">
            {isHost && (
              <button
                onClick={playAgain}
                className="flex-1 py-4 rounded-xl bg-gradient-to-r from-[#8f001a] to-[#b3001f] text-white font-extrabold text-base hover:from-[#a30020] hover:to-[#cc0024] transition-all shadow-[0_8px_28px_rgba(143,0,26,0.4)]"
              >
                Play Again
              </button>
            )}
            {!isHost && <p className="text-[#888] text-sm self-center">Waiting for host to start a new game…</p>}
            <a
              href="/guess/party"
              className="flex-1 py-4 rounded-xl border-2 border-white/15 text-white/70 font-bold text-base text-center hover:border-white/40 hover:text-white transition-all"
            >
              Back to Party
            </a>
          </div>
        </main>
      </div>
    )
  }

  // ── playing / reveal ─────────────────────────────────────────────────────

  const isReveal = room.phase === 'reveal'
  const actual = isReveal && currentLocation
    ? { lat: currentLocation.lat, lng: currentLocation.lng }
    : null

  const roundSortedPlayers = isReveal
    ? [...players].sort((a, b) => {
        const ga = roundGuesses.find(g => g.player_id === a.id)?.points ?? 0
        const gb = roundGuesses.find(g => g.player_id === b.id)?.points ?? 0
        return gb - ga
      })
    : players

  const isLastRound = room.round_index + 1 >= room.round_location_ids.length
  const hasMyGuess = roundGuesses.some(g => g.player_id === myPlayerId)

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] overflow-hidden">
      {/* full-screen photo */}
      <div className={`absolute inset-0 ${isReveal ? 'pointer-events-none' : ''}`}>
        {currentLocation && <PhotoViewer src={currentLocation.image} resetKey={room.round_index} />}
      </div>

      {/* top HUD */}
      <div className="absolute top-0 inset-x-0 p-3 sm:p-4 flex items-start justify-between gap-3 pointer-events-none z-[1100]">
        <a href="/guess/party" className="pointer-events-auto bg-black/60 backdrop-blur border border-white/15 rounded-full px-4 py-2 text-sm font-bold text-white hover:bg-black/80 transition-colors shadow-lg">
          uo<span className="text-[#d4254a]">guessr</span>
        </a>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          {room.timer_setting !== null && !isReveal && (
            <div className={`backdrop-blur border rounded-full px-4 py-2 shadow-lg flex items-center gap-2 ${timeLeft <= 10 ? 'bg-[#8f001a]/90 border-[#d4254a] animate-pulse' : 'bg-black/60 border-white/15'}`}>
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5" strokeLinecap="round" /><path d="M9 2h6" strokeLinecap="round" /></svg>
              <span className="text-sm font-extrabold text-white tabular-nums">0:{String(timeLeft).padStart(2, '0')}</span>
            </div>
          )}
          <div className="bg-black/60 backdrop-blur border border-white/15 rounded-2xl shadow-lg flex divide-x divide-white/15">
            <div className="px-4 sm:px-5 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Round</p>
              <p className="text-sm font-extrabold text-white tabular-nums">{room.round_index + 1} / {room.round_location_ids.length}</p>
            </div>
            <div className="px-4 sm:px-5 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Players</p>
              <p className="text-sm font-extrabold text-white tabular-nums">{roundGuesses.length} / {players.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* duel HP bars (top, playing phase) */}
      {room.mode === 'duel' && players.length === 2 && !isReveal && (
        <div className="absolute top-16 inset-x-0 px-4 z-[1090] pointer-events-none">
          <div className="max-w-sm mx-auto flex flex-col gap-2">
            {players.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-xs font-bold text-white/60 w-20 truncate text-right">{p.display_name}</span>
                <div className="flex-1">
                  <HpBar hp={Math.max(0, p.hp ?? 0)} maxHp={DUEL_STARTING_HP} color={PARTY_COLORS[i % PARTY_COLORS.length]} />
                </div>
                <span className="text-xs font-bold text-white/40 tabular-nums w-12">{Math.max(0, p.hp ?? 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* map */}
      <div
        className={isReveal ? 'absolute inset-0 z-[1050]' : 'absolute bottom-4 right-4 left-4 sm:left-auto z-[1050] flex flex-col gap-2'}
        onMouseEnter={() => setMapHover(true)}
        onMouseLeave={() => setMapHover(false)}
      >
        <div className={isReveal
          ? 'w-full h-full'
          : `rounded-xl overflow-hidden border-2 shadow-2xl transition-all duration-300 ease-out ${
              mapHover || myGuess
                ? 'sm:w-[520px] h-64 sm:h-[380px] border-white/30 opacity-100'
                : 'sm:w-80 h-48 sm:h-56 border-white/15 opacity-80'
            }`
        }>
          <PartyGuessMap
            phase={isReveal ? 'reveal' : 'playing'}
            playerPins={mapPlayerPins}
            actual={actual}
            onPick={p => { if (!hasMyGuess) setMyGuess(p) }}
          />
        </div>

        {!isReveal && (
          <button
            onClick={() => submitMyGuess(myGuess)}
            disabled={!myGuess || hasMyGuess}
            className={`w-full py-3.5 rounded-xl font-extrabold text-sm tracking-wide transition-all shadow-2xl ${
              myGuess && !hasMyGuess
                ? 'bg-gradient-to-r from-[#8f001a] to-[#b3001f] text-white hover:from-[#a30020] hover:to-[#cc0024] shadow-[0_8px_28px_rgba(143,0,26,0.55)]'
                : hasMyGuess
                  ? 'bg-black/60 backdrop-blur border border-white/15 text-[#d4254a]/70 cursor-default'
                  : 'bg-black/60 backdrop-blur border border-white/15 text-white/40 cursor-not-allowed'
            }`}
          >
            {hasMyGuess ? 'GUESS LOCKED IN' : myGuess ? 'GUESS' : 'PLACE YOUR PIN ON THE MAP'}
          </button>
        )}
      </div>

      {/* reveal banner */}
      {isReveal && (
        <div className="absolute bottom-0 inset-x-0 z-[1100] flex justify-center px-4 pb-6 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-xl bg-[#111]/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl px-6 sm:px-8 py-5 animate-block-enter">
            <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-[#d4254a] mb-3">Round {room.round_index + 1} results</p>

            {/* duel HP bars on reveal */}
            {room.mode === 'duel' && players.length === 2 && (
              <div className="flex flex-col gap-2 mb-4">
                {players.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white/60 w-20 truncate text-right">{p.display_name}</span>
                    <div className="flex-1">
                      <HpBar hp={Math.max(0, p.hp ?? 0)} maxHp={DUEL_STARTING_HP} color={PARTY_COLORS[i % PARTY_COLORS.length]} />
                    </div>
                    <span className="text-xs font-bold text-white/40 tabular-nums w-12">{Math.max(0, p.hp ?? 0)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* per-player scores */}
            <div className="divide-y divide-white/[0.06] mb-4">
              {roundSortedPlayers.map(p => {
                const g = roundGuesses.find(rg => rg.player_id === p.id)
                return (
                  <ScoreRow
                    key={p.id}
                    name={p.display_name + (p.id === myPlayerId ? ' (you)' : '')}
                    points={g?.points ?? 0}
                    distance={g?.distance_m ?? null}
                    color={playerColorMap.get(p.id) ?? PARTY_COLORS[0]}
                  />
                )
              })}
            </div>

            {/* duos team scores */}
            {room.mode === 'duos' && (
              <div className="flex gap-3 mb-4">
                {[1, 2].map(t => {
                  const teamRoundPts = players
                    .filter(p => p.team === t)
                    .reduce((sum, p) => sum + (roundGuesses.find(g => g.player_id === p.id)?.points ?? 0), 0)
                  return (
                    <div key={t} className="flex-1 bg-white/[0.04] rounded-lg px-3 py-2 text-center">
                      <p className="text-xs text-white/40 font-bold uppercase tracking-widest">Team {t}</p>
                      <p className="text-lg font-extrabold text-white tabular-nums">{teamRoundPts.toLocaleString()}</p>
                    </div>
                  )
                })}
              </div>
            )}

            {isHost ? (
              <button
                onClick={nextRound}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#8f001a] to-[#b3001f] text-white font-extrabold text-sm tracking-wide hover:from-[#a30020] hover:to-[#cc0024] transition-all shadow-[0_8px_28px_rgba(143,0,26,0.55)]"
              >
                {isLastRound ? 'VIEW RESULTS' : 'NEXT ROUND'}
              </button>
            ) : (
              <p className="text-center text-[#888] text-sm">Waiting for host…</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
