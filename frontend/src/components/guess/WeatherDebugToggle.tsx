'use client'

import { useWeather } from '@/contexts/WeatherContext'

const OPTIONS = [
  { value: 'sunny', label: 'Sunny' },
  { value: 'rain',  label: 'Rain'  },
  { value: 'snow',  label: 'Snow'  },
] as const

export default function WeatherDebugToggle() {
  const { devOverride, setDevOverride } = useWeather()

  if (process.env.NODE_ENV !== 'development') return null

  return (
    <div className="flex items-center gap-0.5 bg-black/40 backdrop-blur-md border border-white/15 rounded-full px-1.5 py-1">
      {OPTIONS.map(o => (
        <button
          key={o.value}
          onClick={() => setDevOverride(devOverride === o.value ? null : o.value)}
          className={`px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide transition-all ${
            devOverride === o.value
              ? 'bg-white/20 text-white'
              : 'text-white/45 hover:text-white/75'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
