'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { MapPoint } from './GuessMap'

const CAMPUS_CENTER: [number, number] = [-75.6831, 45.4231]
const CAMPUS_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-75.6956, 45.4146],
  [-75.6704, 45.4314],
]

const esriTiles = (service: string) => [
  `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`,
]

const SATELLITE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    imagery: {
      type: 'raster',
      tiles: esriTiles('World_Imagery'),
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagery &copy; <a href="https://www.esri.com/">Esri</a>',
    },
    roads: { type: 'raster', tiles: esriTiles('Reference/World_Transportation'), tileSize: 256, maxzoom: 19 },
    places: { type: 'raster', tiles: esriTiles('Reference/World_Boundaries_and_Places'), tileSize: 256, maxzoom: 19 },
  },
  layers: [
    { id: 'imagery', type: 'raster', source: 'imagery' },
    { id: 'roads', type: 'raster', source: 'roads' },
    { id: 'places', type: 'raster', source: 'places' },
  ],
}

const CLEAN_STYLE = 'https://tiles.openfreemap.org/styles/bright'

export interface PlayerPin {
  playerId: string
  displayName: string
  guess: MapPoint | null
  color: string
}

interface PartyGuessMapProps {
  phase: 'playing' | 'reveal'
  playerPins: PlayerPin[]
  actual: MapPoint | null
  onPick: (p: MapPoint) => void
}

function lineGeoJSON(coords: [number, number][]): GeoJSON.Feature<GeoJSON.LineString> {
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }
}

function pinElement(color: string, zIndex: number) {
  const el = document.createElement('div')
  el.style.zIndex = String(zIndex)
  el.innerHTML = `<svg width="28" height="36" viewBox="0 0 28 36" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.4))"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z" fill="${color}"/><circle cx="14" cy="14" r="5.5" fill="white"/></svg>`
  return el
}

function labeledPinElement(color: string, name: string, zIndex: number) {
  const el = document.createElement('div')
  el.style.zIndex = String(zIndex)
  el.style.display = 'flex'
  el.style.flexDirection = 'column'
  el.style.alignItems = 'center'
  el.innerHTML = `<svg width="28" height="36" viewBox="0 0 28 36" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.4))"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z" fill="${color}"/><circle cx="14" cy="14" r="5.5" fill="white"/></svg><span style="background:${color};color:white;font-size:11px;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap;margin-top:2px;box-shadow:0 1px 3px rgba(0,0,0,0.3);max-width:120px;overflow:hidden;text-overflow:ellipsis">${name}</span>`
  return el
}

export default function PartyGuessMap({ phase, playerPins, actual, onPick }: PartyGuessMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const playerMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const actualMarkerRef = useRef<maplibregl.Marker | null>(null)
  const playerSourcesRef = useRef<Set<string>>(new Set())
  const [satellite, setSatellite] = useState(true)

  const phaseRef = useRef(phase)
  const onPickRef = useRef(onPick)
  const playerPinsRef = useRef(playerPins)
  useEffect(() => {
    phaseRef.current = phase
    onPickRef.current = onPick
    playerPinsRef.current = playerPins
  }, [phase, onPick, playerPins])

  const ensurePlayerLineLayer = (map: maplibregl.Map, playerId: string, color: string) => {
    const sourceId = `guess-line-${playerId}`
    if (map.getSource(sourceId)) return
    map.addSource(sourceId, { type: 'geojson', data: lineGeoJSON([]) })
    map.addLayer({
      id: sourceId,
      type: 'line',
      source: sourceId,
      paint: { 'line-color': color, 'line-width': 3, 'line-opacity': 0.9, 'line-dasharray': [1.5, 1.5] },
    })
    playerSourcesRef.current.add(playerId)
  }

  const removeAllPlayerLines = (map: maplibregl.Map) => {
    for (const playerId of playerSourcesRef.current) {
      const sourceId = `guess-line-${playerId}`
      if (map.getLayer(sourceId)) map.removeLayer(sourceId)
      if (map.getSource(sourceId)) map.removeSource(sourceId)
    }
    playerSourcesRef.current.clear()
  }

  // init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: SATELLITE_STYLE,
      center: CAMPUS_CENTER,
      zoom: 15,
      minZoom: 14,
      maxZoom: 19,
      maxBounds: CAMPUS_MAX_BOUNDS,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')
    map.touchPitch.disable()
    map.dragRotate.disable()
    map.on('click', (e) => {
      if (phaseRef.current !== 'playing') return
      onPickRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    })
    mapRef.current = map
    return () => {
      const markers = playerMarkersRef.current
      map.remove()
      mapRef.current = null
      markers.clear()
      actualMarkerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleStyle = () => {
    const map = mapRef.current
    if (!map) return
    const next = !satellite
    setSatellite(next)
    map.setStyle(next ? SATELLITE_STYLE : CLEAN_STYLE)
    map.once('idle', () => {
      playerSourcesRef.current.clear()
      for (const pin of playerPinsRef.current) {
        ensurePlayerLineLayer(map, pin.playerId, pin.color)
      }
    })
  }

  // Update player pins on map
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const currentIds = new Set(playerPins.map(p => p.playerId))
    const existingIds = new Set(playerMarkersRef.current.keys())

    for (const pin of playerPins) {
      if (pin.guess) {
        const existing = playerMarkersRef.current.get(pin.playerId)
        if (existing) {
          existing.setLngLat([pin.guess.lng, pin.guess.lat])
        } else {
          const el = phase === 'reveal'
            ? labeledPinElement(pin.color, pin.displayName, 100)
            : pinElement(pin.color, 100)
          const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([pin.guess.lng, pin.guess.lat])
            .addTo(map)
          playerMarkersRef.current.set(pin.playerId, marker)
        }
      } else {
        const existing = playerMarkersRef.current.get(pin.playerId)
        if (existing) {
          existing.remove()
          playerMarkersRef.current.delete(pin.playerId)
        }
      }
    }

    // Remove markers for players no longer in playerPins
    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        playerMarkersRef.current.get(id)?.remove()
        playerMarkersRef.current.delete(id)
      }
    }
  }, [playerPins, phase])

  // Reveal: actual pin + animated lines per player + fitBounds; reset on playing
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (phase === 'reveal' && actual) {
      if (!actualMarkerRef.current) {
        actualMarkerRef.current = new maplibregl.Marker({ element: pinElement('#111111', 200), anchor: 'bottom' })
          .setLngLat([actual.lng, actual.lat])
          .addTo(map)
      }

      let raf = 0
      const timeout = setTimeout(() => {
        map.resize()

        const pinsWithGuess = playerPinsRef.current.filter(p => p.guess)

        if (pinsWithGuess.length === 0) {
          map.flyTo({ center: [actual.lng, actual.lat], zoom: 16, duration: 900 })
        } else {
          const bounds = new maplibregl.LngLatBounds()
          bounds.extend([actual.lng, actual.lat])
          for (const pin of pinsWithGuess) {
            bounds.extend([pin.guess!.lng, pin.guess!.lat])
          }
          map.fitBounds(bounds, { padding: 90, duration: 900, maxZoom: 17 })
        }

        const start = performance.now()
        const duration = 900
        const delay = 500

        const step = (t: number) => {
          const k = Math.min(1, Math.max(0, (t - start - delay) / duration))
          const eased = 1 - Math.pow(1 - k, 3)

          for (const pin of playerPinsRef.current) {
            if (!pin.guess) continue
            if (!map.getSource(`guess-line-${pin.playerId}`)) {
              ensurePlayerLineLayer(map, pin.playerId, pin.color)
            }
            const src = map.getSource(`guess-line-${pin.playerId}`) as maplibregl.GeoJSONSource | undefined
            src?.setData(lineGeoJSON([
              [pin.guess.lng, pin.guess.lat],
              [
                pin.guess.lng + (actual.lng - pin.guess.lng) * eased,
                pin.guess.lat + (actual.lat - pin.guess.lat) * eased,
              ],
            ]))
          }

          if (k < 1) raf = requestAnimationFrame(step)
        }
        raf = requestAnimationFrame(step)
      }, 350)

      return () => {
        clearTimeout(timeout)
        cancelAnimationFrame(raf)
      }
    }

    if (phase === 'playing') {
      actualMarkerRef.current?.remove()
      actualMarkerRef.current = null
      if (map.isStyleLoaded()) removeAllPlayerLines(map)
      map.jumpTo({ center: CAMPUS_CENTER, zoom: 15 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, actual])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <button
        onClick={toggleStyle}
        className="absolute top-3 right-3 z-10 rounded-md border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-[#111111] shadow-md hover:bg-[#f5f5f5]"
      >
        {satellite ? 'Map' : 'Satellite'}
      </button>
    </div>
  )
}
