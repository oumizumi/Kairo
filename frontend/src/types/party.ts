export type PartyPhase = 'lobby' | 'playing' | 'reveal' | 'done'
export type PartyMode = 'duel' | 'ffa' | 'duos'

export interface PartyRoom {
  id: string
  mode: PartyMode
  host_player_id: string
  phase: PartyPhase
  round_index: number
  round_location_ids: string[]
  timer_setting: number | null
  reveal_deadline: string | null
  created_at: string
  expires_at: string
}

export interface PartyPlayer {
  id: string
  room_id: string
  display_name: string
  team: number | null
  hp: number | null
  joined_at: string
}

export interface PartyGuess {
  id: string
  room_id: string
  player_id: string
  round_index: number
  lat: number | null
  lng: number | null
  distance_m: number | null
  points: number
  submitted_at: string
}
