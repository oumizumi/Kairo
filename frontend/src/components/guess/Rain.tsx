'use client'

import { useEffect, useRef } from 'react'

const ANGLE = (14 * Math.PI) / 180
const SIN_A = Math.sin(ANGLE)
const COS_A = Math.cos(ANGLE)
const NUM_DROPS = 150

interface Drop {
  x: number
  y: number
  speed: number
  length: number
  opacity: number
  width: number
}

function makeDrop(w: number, h: number): Drop {
  return {
    x:       Math.random() * (w + 200) - 100,
    y:       Math.random() * h,
    speed:   7 + Math.random() * 10,
    length:  12 + Math.random() * 24,
    opacity: 0.06 + Math.random() * 0.2,
    width:   Math.random() < 0.25 ? 1.5 : 1,
  }
}

export default function Rain() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let w = 0
    let h = 0
    let drops: Drop[] = []

    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width  = w
      canvas.height = h
      drops = Array.from({ length: NUM_DROPS }, () => makeDrop(w, h))
    }

    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      ctx.clearRect(0, 0, w, h)

      for (const d of drops) {
        ctx.beginPath()
        ctx.moveTo(d.x, d.y)
        ctx.lineTo(d.x + d.length * SIN_A, d.y + d.length * COS_A)
        ctx.strokeStyle = `rgba(180,210,255,${d.opacity})`
        ctx.lineWidth = d.width
        ctx.stroke()

        d.x += d.speed * SIN_A
        d.y += d.speed * COS_A

        if (d.y > h + d.length || d.x > w + d.length) {
          d.x = Math.random() * w - 100
          d.y = -d.length - Math.random() * 120
        }
      }

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
