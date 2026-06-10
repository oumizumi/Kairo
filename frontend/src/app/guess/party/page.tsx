'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { PartyMode } from '@/types/party'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode() {
  return Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
}

function getOrCreatePlayerId(): string {
  let id = sessionStorage.getItem('party_player_id')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('party_player_id', id)
  }
  return id
}

const MODES: { value: PartyMode; label: string; desc: string }[] = [
  { value: 'duel', label: 'Duel',    desc: '1v1, HP bars. First to zero loses.' },
  { value: 'ffa',  label: 'FFA',     desc: '2 to 5 players. Most points wins.' },
  { value: 'duos', label: 'Duos',    desc: '2v2 teams. Combined score wins.' },
]

export default function PartyPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'create' | 'join'>('create')

  const [mode, setMode] = useState<PartyMode>('ffa')
  const [timer, setTimer] = useState<number | null>(null)
  const [createName, setCreateName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [joinCode, setJoinCode] = useState('')
  const [joinName, setJoinName] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  const createRoom = async () => {
    if (!createName.trim()) { setCreateError('Enter your name'); return }
    setCreating(true)
    setCreateError('')
    const playerId = getOrCreatePlayerId()
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = generateCode()
      const { error: roomErr } = await supabase.from('party_rooms').insert({
        id: code, mode, host_player_id: playerId, phase: 'lobby',
        round_index: 0, round_location_ids: [], timer_setting: timer,
      })
      if (roomErr) {
        if (roomErr.code === '23505') continue
        setCreateError('Failed to create room.')
        setCreating(false)
        return
      }
      await supabase.from('party_players').insert({
        id: playerId, room_id: code,
        display_name: createName.trim().slice(0, 24),
        team: null, hp: mode === 'duel' ? 5000 : null,
      })
      router.push(`/guess/party/${code}`)
      return
    }
    setCreateError('Could not generate a unique code.')
    setCreating(false)
  }

  const joinRoom = async () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length !== 6) { setJoinError('Enter a 6-character code'); return }
    if (!joinName.trim()) { setJoinError('Enter your name'); return }
    setJoining(true)
    setJoinError('')
    const playerId = getOrCreatePlayerId()
    const { data: room, error } = await supabase.from('party_rooms').select('*').eq('id', code).single()
    if (error || !room) { setJoinError('Room not found'); setJoining(false); return }
    if (room.phase !== 'lobby') { setJoinError('Game already in progress'); setJoining(false); return }
    const { data: existing } = await supabase.from('party_players').select('id').eq('room_id', code)
    const max = room.mode === 'duel' ? 2 : room.mode === 'duos' ? 4 : 5
    if ((existing?.length ?? 0) >= max && !(existing ?? []).some((p: { id: string }) => p.id === playerId)) {
      setJoinError('Room is full'); setJoining(false); return
    }
    await supabase.from('party_players').upsert({
      id: playerId, room_id: code,
      display_name: joinName.trim().slice(0, 24),
      team: null, hp: room.mode === 'duel' ? 5000 : null,
    }, { onConflict: 'id' })
    router.push(`/guess/party/${code}`)
  }

  const selectedMode = MODES.find(m => m.value === mode)!

  return (
    <div className="fixed inset-0 overflow-y-auto">
      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-6">
        <a
          href="/guess"
          className="inline-flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/15 rounded-full px-4 py-2 text-sm font-semibold text-white/80 hover:text-white hover:border-white/30 transition-all"
        >
          ← uoguessr
        </a>
      </div>

      <main className="relative z-10 min-h-screen flex flex-col items-center px-6 pt-[11vh] pb-16">
        <p className="text-white/70 font-bold text-xs sm:text-sm tracking-[0.45em] uppercase mb-3 text-center [text-shadow:0_2px_12px_rgba(0,0,0,0.85)] animate-fade-up">
          Multiplayer
        </p>
        <h1 className="text-[clamp(58px,10vw,120px)] leading-[0.85] font-extrabold italic uppercase tracking-[-0.04em] text-white mb-10 text-center drop-shadow-[0_10px_44px_rgba(0,0,0,0.7)] animate-fade-up [animation-delay:60ms]">
          Party
        </h1>

        <div className="w-full max-w-md flex flex-col gap-7 animate-fade-up [animation-delay:120ms]">

          {/* tab toggle */}
          <div className="flex gap-7 justify-center">
            {(['create', 'join'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative pb-2 text-xl font-extrabold italic uppercase tracking-tight transition-colors [text-shadow:0_2px_12px_rgba(0,0,0,0.8)] ${
                  tab === t ? 'text-white' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {t === 'create' ? 'New Room' : 'Join Room'}
                <span
                  className={`absolute bottom-0 left-0 h-[3px] rounded-full bg-[#ff465f] transition-all duration-300 ${
                    tab === t ? 'w-full' : 'w-0'
                  }`}
                />
              </button>
            ))}
          </div>

          {tab === 'create' ? (
            <div className="flex flex-col gap-5">
              {/* mode */}
              <div className="flex flex-col gap-2">
                <div className="flex gap-2.5 flex-wrap justify-center">
                  {MODES.map(m => (
                    <button
                      key={m.value}
                      onClick={() => setMode(m.value)}
                      className={`px-6 py-2.5 rounded-full text-sm font-extrabold uppercase tracking-wide border-2 backdrop-blur-sm transition-all ${
                        mode === m.value
                          ? 'border-[#ff465f] text-white bg-[#8f001a]/50 shadow-[0_0_24px_rgba(143,0,26,0.5)]'
                          : 'border-white/25 text-white/60 bg-black/25 hover:border-white/50 hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs font-semibold text-white/50 text-center [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">{selectedMode.desc}</p>
              </div>

              {/* timer */}
              <div className="flex gap-2.5 flex-wrap justify-center">
                {([30, 60, null] as (number | null)[]).map(t => (
                  <button
                    key={String(t)}
                    onClick={() => setTimer(t)}
                    className={`px-6 py-2.5 rounded-full text-sm font-extrabold uppercase tracking-wide border-2 backdrop-blur-sm transition-all ${
                      timer === t
                        ? 'border-[#ff465f] text-white bg-[#8f001a]/50 shadow-[0_0_24px_rgba(143,0,26,0.5)]'
                        : 'border-white/25 text-white/60 bg-black/25 hover:border-white/50 hover:text-white'
                    }`}
                  >
                    {t === null ? 'No limit' : `${t}s`}
                  </button>
                ))}
              </div>

              {/* name */}
              <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  maxLength={24}
                  placeholder="YOUR NAME"
                  value={createName}
                  onChange={e => { setCreateName(e.target.value); setCreateError('') }}
                  onKeyDown={e => e.key === 'Enter' && createRoom()}
                  className={`w-full bg-transparent border-0 border-b-2 rounded-none px-1 py-2.5 text-lg font-extrabold italic tracking-wide text-white text-center placeholder-white/30 outline-none transition-colors [text-shadow:0_2px_8px_rgba(0,0,0,0.8)] ${
                    createError ? 'border-[#ff465f]' : 'border-white/25 focus:border-[#ff465f]'
                  }`}
                />
                {createError && (
                  <p className="text-[#ff465f] text-xs font-bold px-1 text-center [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">{createError}</p>
                )}
              </div>

              <button
                onClick={createRoom}
                disabled={creating}
                className="group w-fit mx-auto py-1 disabled:opacity-50"
              >
                <span className="block text-center text-4xl sm:text-5xl font-extrabold italic uppercase tracking-tight text-[#ff465f] group-hover:scale-105 transition-all duration-200 drop-shadow-[0_6px_28px_rgba(0,0,0,0.7)]">
                  {creating ? 'Creating…' : 'Create →'}
                </span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="ROOM CODE"
                  value={joinCode}
                  onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError('') }}
                  className={`w-full bg-transparent border-0 border-b-2 rounded-none px-1 py-2.5 text-2xl font-mono font-extrabold tracking-[0.3em] uppercase text-white text-center placeholder-white/30 placeholder:text-lg placeholder:tracking-[0.15em] outline-none transition-colors [text-shadow:0_2px_8px_rgba(0,0,0,0.8)] ${
                    joinError && joinError.toLowerCase().includes('code') ? 'border-[#ff465f]' : 'border-white/25 focus:border-[#ff465f]'
                  }`}
                />
                {joinError && joinError.toLowerCase().includes('code') && (
                  <p className="text-[#ff465f] text-xs font-bold px-1 text-center [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">{joinError}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  maxLength={24}
                  placeholder="YOUR NAME"
                  value={joinName}
                  onChange={e => { setJoinName(e.target.value); setJoinError('') }}
                  onKeyDown={e => e.key === 'Enter' && joinRoom()}
                  className={`w-full bg-transparent border-0 border-b-2 rounded-none px-1 py-2.5 text-lg font-extrabold italic tracking-wide text-white text-center placeholder-white/30 outline-none transition-colors [text-shadow:0_2px_8px_rgba(0,0,0,0.8)] ${
                    joinError && joinError.toLowerCase().includes('name') ? 'border-[#ff465f]' : 'border-white/25 focus:border-[#ff465f]'
                  }`}
                />
                {joinError && joinError.toLowerCase().includes('name') && (
                  <p className="text-[#ff465f] text-xs font-bold px-1 text-center [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">{joinError}</p>
                )}
              </div>

              {joinError && !joinError.toLowerCase().includes('code') && !joinError.toLowerCase().includes('name') && (
                <p className="text-[#ff465f] text-xs font-bold px-1 text-center [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">{joinError}</p>
              )}

              <button
                onClick={joinRoom}
                disabled={joining}
                className="group w-fit mx-auto py-1 disabled:opacity-50"
              >
                <span className="block text-center text-4xl sm:text-5xl font-extrabold italic uppercase tracking-tight text-[#ff465f] group-hover:scale-105 transition-all duration-200 drop-shadow-[0_6px_28px_rgba(0,0,0,0.7)]">
                  {joining ? 'Joining…' : 'Join →'}
                </span>
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
