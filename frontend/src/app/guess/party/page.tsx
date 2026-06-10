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
    <div className="fixed inset-0 overflow-y-auto bg-[#0a0a0a]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_-5%,rgba(143,0,26,0.32),transparent)] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-6 pt-6">
        <a href="/guess" className="text-white/60 hover:text-white font-semibold text-sm transition-colors">
          ← uoguessr
        </a>
      </div>

      <main className="relative flex flex-col items-center justify-center px-6 pb-16 pt-10 min-h-[calc(100vh-72px)]">
        <p className="text-[#d4254a] font-bold text-xs tracking-[0.35em] uppercase mb-4">Multiplayer</p>
        <h1 className="text-6xl sm:text-7xl font-extrabold text-white tracking-tight mb-10">
          Party
        </h1>

        <div className="w-full max-w-sm flex flex-col gap-6">

          {/* tab toggle */}
          <div className="flex bg-white/[0.05] rounded-xl p-1">
            {(['create', 'join'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                  tab === t
                    ? 'bg-white/10 text-white'
                    : 'text-white/35 hover:text-white/60'
                }`}
              >
                {t === 'create' ? 'New Room' : 'Join Room'}
              </button>
            ))}
          </div>

          {tab === 'create' ? (
            <div className="flex flex-col gap-4">
              {/* mode */}
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-3 gap-2">
                  {MODES.map(m => (
                    <button
                      key={m.value}
                      onClick={() => setMode(m.value)}
                      className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                        mode === m.value
                          ? 'border-[#d4254a] text-white bg-[#8f001a]/25'
                          : 'border-white/[0.09] text-white/40 hover:border-white/20 hover:text-white/70'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-white/35 text-center">{selectedMode.desc}</p>
              </div>

              {/* timer */}
              <div className="grid grid-cols-3 gap-2">
                {([30, 60, null] as (number | null)[]).map(t => (
                  <button
                    key={String(t)}
                    onClick={() => setTimer(t)}
                    className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                      timer === t
                        ? 'border-[#d4254a] text-white bg-[#8f001a]/25'
                        : 'border-white/[0.09] text-white/40 hover:border-white/20 hover:text-white/70'
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
                  placeholder="Your name"
                  value={createName}
                  onChange={e => { setCreateName(e.target.value); setCreateError('') }}
                  onKeyDown={e => e.key === 'Enter' && createRoom()}
                  className={`w-full bg-white/[0.05] border rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm outline-none transition-colors ${
                    createError ? 'border-[#d4254a]/70 bg-[#d4254a]/[0.04]' : 'border-white/[0.1] focus:border-[#d4254a]/70'
                  }`}
                />
                {createError && (
                  <p className="text-[#d4254a] text-xs font-semibold px-1">{createError}</p>
                )}
              </div>

              <button
                onClick={createRoom}
                disabled={creating}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#8f001a] to-[#b3001f] text-white font-extrabold text-sm tracking-wide hover:from-[#a30020] hover:to-[#cc0024] transition-all disabled:opacity-50 shadow-[0_8px_28px_rgba(143,0,26,0.4)]"
              >
                {creating ? 'Creating…' : 'Create Room'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Room code"
                  value={joinCode}
                  onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError('') }}
                  className={`w-full bg-white/[0.05] border rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm font-mono font-bold tracking-[0.25em] uppercase outline-none transition-colors ${
                    joinError && joinError.toLowerCase().includes('code') ? 'border-[#d4254a]/70 bg-[#d4254a]/[0.04]' : 'border-white/[0.1] focus:border-[#d4254a]/70'
                  }`}
                />
                {joinError && joinError.toLowerCase().includes('code') && (
                  <p className="text-[#d4254a] text-xs font-semibold px-1">{joinError}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  maxLength={24}
                  placeholder="Your name"
                  value={joinName}
                  onChange={e => { setJoinName(e.target.value); setJoinError('') }}
                  onKeyDown={e => e.key === 'Enter' && joinRoom()}
                  className={`w-full bg-white/[0.05] border rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm outline-none transition-colors ${
                    joinError && joinError.toLowerCase().includes('name') ? 'border-[#d4254a]/70 bg-[#d4254a]/[0.04]' : 'border-white/[0.1] focus:border-[#d4254a]/70'
                  }`}
                />
                {joinError && joinError.toLowerCase().includes('name') && (
                  <p className="text-[#d4254a] text-xs font-semibold px-1">{joinError}</p>
                )}
              </div>

              {joinError && !joinError.toLowerCase().includes('code') && !joinError.toLowerCase().includes('name') && (
                <p className="text-[#d4254a] text-xs font-semibold px-1">{joinError}</p>
              )}

              <button
                onClick={joinRoom}
                disabled={joining}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#8f001a] to-[#b3001f] text-white font-extrabold text-sm tracking-wide hover:from-[#a30020] hover:to-[#cc0024] transition-all disabled:opacity-50 shadow-[0_8px_28px_rgba(143,0,26,0.4)]"
              >
                {joining ? 'Joining…' : 'Join Room'}
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
