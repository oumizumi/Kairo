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

export const GUESS_LOCATIONS: GuessLocation[] = [
  {
    id: 'tabaret-front',
    image: '/guess/tabaret-front.svg',
    lat: 45.4244,
    lng: -75.686,
    type: 'photo',
    difficulty: 'easy',
  },
  {
    id: 'morisset-entrance',
    image: '/guess/morisset-entrance.svg',
    lat: 45.423,
    lng: -75.6841,
    type: 'photo',
    difficulty: 'easy',
  },
  {
    id: 'ucu-terminal',
    image: '/guess/ucu-terminal.svg',
    lat: 45.4236,
    lng: -75.6833,
    type: 'photo',
    difficulty: 'medium',
  },
  {
    id: 'crx-hallway',
    image: '/guess/crx-hallway.svg',
    lat: 45.4227,
    lng: -75.6847,
    type: 'photo',
    difficulty: 'hard',
    indoor: true,
  },
  {
    id: 'stem-stairs',
    image: '/guess/stem-stairs.svg',
    lat: 45.4189,
    lng: -75.6831,
    type: 'photo',
    difficulty: 'medium',
    indoor: true,
  },
  {
    id: 'site-atrium',
    image: '/guess/site-atrium.svg',
    lat: 45.4209,
    lng: -75.6817,
    type: 'photo',
    difficulty: 'medium',
    indoor: true,
  },
  {
    id: 'tunnel-morisset',
    image: '/guess/tunnel-morisset.svg',
    lat: 45.4233,
    lng: -75.6843,
    type: 'photo',
    difficulty: 'hard',
    indoor: true,
  },
  {
    id: 'minto-entrance',
    image: '/guess/minto-entrance.svg',
    lat: 45.4178,
    lng: -75.68,
    type: 'photo',
    difficulty: 'hard',
  },
]
