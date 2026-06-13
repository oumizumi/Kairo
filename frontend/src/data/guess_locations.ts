// uoguessr location list — swap placeholder .svg images for real .webp photos
// in frontend/public/guess/ as they get shot (see UOGUESSR.md shooting guidelines)

export interface GuessLocation {
  id: string
  image: string
  lat: number
  lng: number
  type: 'photo' | 'pano'
  difficulty?: 'easy' | 'medium' | 'hard'
  indoor?: boolean
  season?: 'fall' | 'winter' | 'summer'
}

// add real photos to frontend/public/guess/ and list them here
export const GUESS_LOCATIONS: GuessLocation[] = []
