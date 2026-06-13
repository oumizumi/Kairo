'use client'

import { useEffect, useRef } from 'react'

const NUM_FLAKES = 220

interface Flake {
  x: number
  y: number
  r: number        // radius — drives speed, sway, opacity
  speed: number
  swayAmp: number  // horizontal sway amplitude
  swayFreq: number // sway oscillation speed
  phase: number    // sway phase offset
  opacity: number
}

function makeFlake(w: number, h: number, randomY = true): Flake {
  // bias toward smaller flakes (feels more like real snow)
  const r = 0.8 + Math.pow(Math.random(), 2) * 3.2
  return {
    x:        Math.random() * w,
    y:        randomY ? Math.random() * h : -r - Math.random() * 40,
    r,
    speed:    0.4 + r * 0.55 + Math.random() * 0.4,
    swayAmp:  6 + (1 / r) * 14,     // smaller flakes sway more
    swayFreq: 0.004 + Math.random() * 0.007,
    phase:    Math.random() * Math.PI * 2,
    opacity:  0.25 + (r / 4) * 0.55, // larger = more opaque
  }
}

export default function Snow() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let w = 0
    let h = 0
    let flakes: Flake[] = []
    let t = 0
    // slow wind gust that drifts left/right over time
    let wind = 0
    let windTarget = (Math.random() - 0.5) * 0.6
    let windTimer = 0

    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width  = w
      canvas.height = h
      flakes = Array.from({ length: NUM_FLAKES }, () => makeFlake(w, h, true))
    }

    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      t += 1
      windTimer += 1

      // shift wind target every ~8–14 seconds
      if (windTimer > 480 + Math.random() * 360) {
        windTarget = (Math.random() - 0.5) * 0.7
        windTimer = 0
      }
      // lerp wind toward target
      wind += (windTarget - wind) * 0.003

      for (const f of flakes) {
        const sway = Math.sin(t * f.swayFreq + f.phase) * f.swayAmp * 0.015

        // soft glow on larger flakes
        if (f.r > 2.2) {
          ctx.shadowBlur  = f.r * 3
          ctx.shadowColor = `rgba(210,230,255,${f.opacity * 0.6})`
        } else {
          ctx.shadowBlur = 0
        }

        ctx.beginPath()
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(230,240,255,${f.opacity})`
        ctx.fill()

        f.x += wind + sway
        f.y += f.speed

        if (f.y > h + f.r) {
          Object.assign(f, makeFlake(w, h, false))
        }
        if (f.x > w + f.r)  f.x = -f.r
        if (f.x < -f.r)     f.x = w + f.r
      }

      ctx.shadowBlur = 0
      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
}
