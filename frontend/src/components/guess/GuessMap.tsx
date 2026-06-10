'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// MapLibre zoom levels run ~1 lower than Leaflet's (512px vector tiles)
const CAMPUS_CENTER: [number, number] = [-75.6831, 45.4231]
const CAMPUS_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-75.6956, 45.4146],
  [-75.6704, 45.4314],
]

const esriTiles = (service: string) => [
  `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`,
]

// Esri World Imagery + label/road overlays, hybrid satellite, free, no API key
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

export interface MapPoint {
  lat: number
  lng: number
}

function pinElement(color: string, zIndex: number) {
  const el = document.createElement('div')
  el.style.zIndex = String(zIndex)
  el.innerHTML = `<svg width="28" height="36" viewBox="0 0 28 36" style="display:block; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4))"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z" fill="${color}"/><circle cx="14" cy="14" r="5.5" fill="white"/></svg>`
  return el
}

function lineGeoJSON(coords: [number, number][]): GeoJSON.Feature<GeoJSON.LineString> {
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }
}

interface GuessMapProps {
  phase: 'playing' | 'reveal'
  guess: MapPoint | null
  actual: MapPoint | null
  onPick: (p: MapPoint) => void
}

export default function GuessMap({ phase, guess, actual, onPick }: GuessMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const guessMarkerRef = useRef<maplibregl.Marker | null>(null)
  const actualMarkerRef = useRef<maplibregl.Marker | null>(null)
  const lineCoordsRef = useRef<[number, number][]>([])
  const [satellite, setSatellite] = useState(true)

  // refs so the click handler always sees current values without re-binding
  const phaseRef = useRef(phase)
  const onPickRef = useRef(onPick)
  useEffect(() => {
    phaseRef.current = phase
    onPickRef.current = onPick
  }, [phase, onPick])

  // line source/layer must be re-added after every style change
  const ensureLineLayer = (map: maplibregl.Map) => {
    if (map.getSource('guess-line')) return
    map.addSource('guess-line', { type: 'geojson', data: lineGeoJSON(lineCoordsRef.current) })
    map.addLayer({
      id: 'guess-line',
      type: 'line',
      source: 'guess-line',
      paint: { 'line-color': '#8f001a', 'line-width': 4, 'line-opacity': 0.95, 'line-dasharray': [1.5, 1.5] },
    })
  }

  const setLine = (coords: [number, number][]) => {
    lineCoordsRef.current = coords
    const map = mapRef.current
    const src = map?.getSource('guess-line') as maplibregl.GeoJSONSource | undefined
    src?.setData(lineGeoJSON(coords))
  }

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

    map.on('load', () => ensureLineLayer(map))
    map.on('click', (e) => {
      if (phaseRef.current !== 'playing') return
      onPickRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    })
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      guessMarkerRef.current = null
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
    map.once('idle', () => ensureLineLayer(map))
  }

  // guess pin
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (guess) {
      if (guessMarkerRef.current) {
        guessMarkerRef.current.setLngLat([guess.lng, guess.lat])
      } else {
        guessMarkerRef.current = new maplibregl.Marker({ element: pinElement('#8f001a', 100), anchor: 'bottom' })
          .setLngLat([guess.lng, guess.lat])
          .addTo(map)
      }
    } else if (guessMarkerRef.current) {
      guessMarkerRef.current.remove()
      guessMarkerRef.current = null
    }
  }, [guess])

  // reveal: actual pin + animated line draw + camera fly; cleanup on next round
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (phase === 'reveal' && actual) {
      actualMarkerRef.current = new maplibregl.Marker({ element: pinElement('#111111', 200), anchor: 'bottom' })
        .setLngLat([actual.lng, actual.lat])
        .addTo(map)

      // wait for the container to finish expanding to full screen before flying
      let raf = 0
      const timeout = setTimeout(() => {
        map.resize()

        if (!guess) {
          map.flyTo({ center: [actual.lng, actual.lat], zoom: 16, duration: 900 })
          return
        }

        const bounds = new maplibregl.LngLatBounds([guess.lng, guess.lat], [guess.lng, guess.lat])
        bounds.extend([actual.lng, actual.lat])
        map.fitBounds(bounds, { padding: 90, duration: 900, maxZoom: 17 })

        const start = performance.now()
        const duration = 900
        const delay = 500
        const step = (t: number) => {
          const k = Math.min(1, Math.max(0, (t - start - delay) / duration))
          const eased = 1 - Math.pow(1 - k, 3)
          setLine([
            [guess.lng, guess.lat],
            [guess.lng + (actual.lng - guess.lng) * eased, guess.lat + (actual.lat - guess.lat) * eased],
          ])
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
      setLine([])
      map.jumpTo({ center: CAMPUS_CENTER, zoom: 15 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, actual, guess])

  return (
    <div className="relative w-full h-full">
      {/* maplibre css forces position:relative on this element, size it explicitly, don't use inset */}
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
