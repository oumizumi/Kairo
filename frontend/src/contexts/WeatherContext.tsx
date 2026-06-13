'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const RAIN_CODES  = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99])
const SNOW_CODES  = new Set([71, 73, 75, 77, 85, 86])
const STORM_CODES = new Set([95, 96, 99])

type Override = 'rain' | 'sunny' | 'snow' | null

interface WeatherContextValue {
  isRaining: boolean
  isSnowing: boolean
  isStorming: boolean
  devOverride: Override
  setDevOverride: (o: Override) => void
}

const WeatherContext = createContext<WeatherContextValue>({
  isRaining: false,
  isSnowing: false,
  isStorming: false,
  devOverride: null,
  setDevOverride: () => {},
})

export function WeatherProvider({ children }: { children: React.ReactNode }) {
  const [fetchedRain, setFetchedRain]   = useState(false)
  const [fetchedSnow, setFetchedSnow]   = useState(false)
  const [fetchedStorm, setFetchedStorm] = useState(false)
  const [devOverride, setDevOverride]   = useState<Override>(null)

  useEffect(() => {
    fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=45.4215&longitude=-75.6919&current=weather_code,precipitation&timezone=America%2FToronto'
    )
      .then(r => r.json())
      .then(data => {
        const code: number   = data?.current?.weather_code ?? 0
        const precip: number = data?.current?.precipitation ?? 0
        setFetchedRain(RAIN_CODES.has(code) || precip > 0)
        setFetchedSnow(SNOW_CODES.has(code))
        setFetchedStorm(STORM_CODES.has(code))
      })
      .catch(() => {})
  }, [])

  const isStorming = fetchedStorm
  const isSnowing  = devOverride === 'snow' ? true : devOverride != null ? false : fetchedSnow
  const isRaining  = devOverride === 'sunny' ? false : devOverride === 'rain' ? true : isStorming || fetchedRain

  return (
    <WeatherContext.Provider value={{ isRaining, isSnowing, isStorming, devOverride, setDevOverride }}>
      {children}
    </WeatherContext.Provider>
  )
}

export function useWeather() {
  return useContext(WeatherContext)
}
