'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { PartyMode } from '@/types/party'
import LanguageToggle from '@/components/LanguageToggle'
import { useLanguage } from '@/contexts/LanguageContext'

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

const MODES: { value: PartyMode; labelKey: 'party.mode.duel' | 'party.mode.ffa' | 'party.mode.duos'; descKey: 'party.mode.duelDesc' | 'party.mode.ffaDesc' | 'party.mode.duosDesc' }[] = [
  { value: 'duel', labelKey: 'party.mode.duel', descKey: 'party.mode.duelDesc' },
  { value: 'ffa',  labelKey: 'party.mode.ffa',  descKey: 'party.mode.ffaDesc'  },
  { value: 'duos', labelKey: 'party.mode.duos', descKey: 'party.mode.duosDesc' },
]

export default function PartyPage() {
  const { t } = useLanguage()
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
  const [joinErrorField, setJoinErrorField] = useState<'code' | 'name' | 'other' | null>(null)

  const setJoinErr = (msg: string, field: 'code' | 'name' | 'other') => {
    setJoinError(msg)
    setJoinErrorField(field)
  }

  const createRoom = async () => {
    if (!createName.trim()) { setCreateError(t('party.error.enterName')); return }
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
        setCreateError(t('party.error.notFound'))
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
    setCreateError(t('party.error.enterCode'))
    setCreating(false)
  }

  const joinRoom = async () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length !== 6) { setJoinErr(t('party.error.enterCode'), 'code'); return }
    if (!joinName.trim()) { setJoinErr(t('party.error.enterName'), 'name'); return }
    setJoining(true)
    setJoinError('')
    setJoinErrorField(null)
    const playerId = getOrCreatePlayerId()
    const { data: room, error } = await supabase.from('party_rooms').select('*').eq('id', code).single()
    if (error || !room) { setJoinErr(t('party.error.notFound'), 'other'); setJoining(false); return }
    if (room.phase !== 'lobby') { setJoinErr(t('party.error.inProgress'), 'other'); setJoining(false); return }
    const { data: existing } = await supabase.from('party_players').select('id').eq('room_id', code)
    const max = room.mode === 'duel' ? 2 : room.mode === 'duos' ? 4 : 5
    if ((existing?.length ?? 0) >= max && !(existing ?? []).some((p: { id: string }) => p.id === playerId)) {
      setJoinErr(t('party.error.full'), 'other'); setJoining(false); return
    }
    await supabase.from('party_players').upsert({
      id: playerId, room_id: code,
      display_name: joinName.trim().slice(0, 24),
      team: null, hp: room.mode === 'duel' ? 5000 : null,
    }, { onConflict: 'id' })
    router.push(`/guess/party/${code}`)
  }

  const selectedModeEntry = MODES.find(m => m.value === mode)!

  return (
    <div className="fixed inset-0 overflow-y-auto">
      <div className="relative z-20 max-w-5xl mx-auto px-6 pt-6 flex items-center justify-between">
        <a
          href="/guess"
          className="inline-flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/15 rounded-full px-4 py-2 text-sm font-semibold text-white/80 hover:text-white hover:border-white/30 transition-all"
        >
          {t('party.backGuess')}
        </a>
        <LanguageToggle variant="dark" />
      </div>

      <main className="relative z-10 min-h-screen flex flex-col items-center px-6 pt-[11vh] pb-16">
        <p className="text-white/70 font-bold text-xs sm:text-sm tracking-[0.45em] uppercase mb-3 text-center [text-shadow:0_2px_12px_rgba(0,0,0,0.85)] animate-fade-up">
          {t('party.multiplayer')}
        </p>
        <h1 className="text-[clamp(58px,10vw,120px)] leading-[0.85] font-extrabold italic uppercase tracking-[-0.04em] text-white mb-10 text-center drop-shadow-[0_10px_44px_rgba(0,0,0,0.7)] animate-fade-up [animation-delay:60ms]">
          Party
        </h1>

        <div className="w-full max-w-md flex flex-col gap-7 animate-fade-up [animation-delay:120ms]">

          {/* tab toggle */}
          <div className="flex gap-7 justify-center">
            {(['create', 'join'] as const).map(tabKey => (
              <button
                key={tabKey}
                onClick={() => setTab(tabKey)}
                className={`relative pb-2 text-xl font-extrabold italic uppercase tracking-tight transition-colors [text-shadow:0_2px_12px_rgba(0,0,0,0.8)] ${
                  tab === tabKey ? 'text-white' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {tabKey === 'create' ? t('party.newRoom') : t('party.joinRoom')}
                <span
                  className={`absolute bottom-0 left-0 h-[3px] rounded-full bg-[#ff465f] transition-all duration-300 ${
                    tab === tabKey ? 'w-full' : 'w-0'
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
                      {t(m.labelKey)}
                    </button>
                  ))}
                </div>
                <p className="text-xs font-semibold text-white/50 text-center [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">{t(selectedModeEntry.descKey)}</p>
              </div>

              {/* timer */}
              <div className="flex gap-2.5 flex-wrap justify-center">
                {([30, 60, null] as (number | null)[]).map(ts => (
                  <button
                    key={String(ts)}
                    onClick={() => setTimer(ts)}
                    className={`px-6 py-2.5 rounded-full text-sm font-extrabold uppercase tracking-wide border-2 backdrop-blur-sm transition-all ${
                      timer === ts
                        ? 'border-[#ff465f] text-white bg-[#8f001a]/50 shadow-[0_0_24px_rgba(143,0,26,0.5)]'
                        : 'border-white/25 text-white/60 bg-black/25 hover:border-white/50 hover:text-white'
                    }`}
                  >
                    {ts === null ? t('party.noLimit') : `${ts}s`}
                  </button>
                ))}
              </div>

              {/* name */}
              <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  maxLength={24}
                  placeholder={t('party.namePlaceholder')}
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
                  {creating ? t('party.creating') : t('party.create')}
                </span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  maxLength={6}
                  placeholder={t('party.codePlaceholder')}
                  value={joinCode}
                  onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError(''); setJoinErrorField(null) }}
                  className={`w-full bg-transparent border-0 border-b-2 rounded-none px-1 py-2.5 text-2xl font-mono font-extrabold tracking-[0.3em] uppercase text-white text-center placeholder-white/30 placeholder:text-lg placeholder:tracking-[0.15em] outline-none transition-colors [text-shadow:0_2px_8px_rgba(0,0,0,0.8)] ${
                    joinErrorField === 'code' ? 'border-[#ff465f]' : 'border-white/25 focus:border-[#ff465f]'
                  }`}
                />
                {joinErrorField === 'code' && (
                  <p className="text-[#ff465f] text-xs font-bold px-1 text-center [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">{joinError}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  maxLength={24}
                  placeholder={t('party.namePlaceholder')}
                  value={joinName}
                  onChange={e => { setJoinName(e.target.value); setJoinError(''); setJoinErrorField(null) }}
                  onKeyDown={e => e.key === 'Enter' && joinRoom()}
                  className={`w-full bg-transparent border-0 border-b-2 rounded-none px-1 py-2.5 text-lg font-extrabold italic tracking-wide text-white text-center placeholder-white/30 outline-none transition-colors [text-shadow:0_2px_8px_rgba(0,0,0,0.8)] ${
                    joinErrorField === 'name' ? 'border-[#ff465f]' : 'border-white/25 focus:border-[#ff465f]'
                  }`}
                />
                {joinErrorField === 'name' && (
                  <p className="text-[#ff465f] text-xs font-bold px-1 text-center [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">{joinError}</p>
                )}
              </div>

              {joinError && joinErrorField === 'other' && (
                <p className="text-[#ff465f] text-xs font-bold px-1 text-center [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">{joinError}</p>
              )}

              <button
                onClick={joinRoom}
                disabled={joining}
                className="group w-fit mx-auto py-1 disabled:opacity-50"
              >
                <span className="block text-center text-4xl sm:text-5xl font-extrabold italic uppercase tracking-tight text-[#ff465f] group-hover:scale-105 transition-all duration-200 drop-shadow-[0_6px_28px_rgba(0,0,0,0.7)]">
                  {joining ? t('party.joining') : t('party.join')}
                </span>
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
