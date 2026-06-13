'use client'

import { useEffect, useRef, useState } from 'react'

type Bolt = [number, number][]

function makeBolt(w: number, h: number, startX?: number): Bolt[] {
  const bolts: Bolt[] = []

  // main bolt — starts from a random point along the top, zig-zags down
  const main: Bolt = []
  let x = startX ?? (w * 0.05 + Math.random() * w * 0.9)
  let y = 0
  main.push([x, y])
  while (y < h * 0.65) {
    y += 15 + Math.random() * 25
    x += (Math.random() - 0.5) * 65
    x = Math.max(20, Math.min(w - 20, x))
    main.push([x, y])
  }
  bolts.push(main)

  // 1–3 branches splitting off the main bolt
  const numBranches = 1 + Math.floor(Math.random() * 3)
  for (let b = 0; b < numBranches; b++) {
    const from = Math.floor(main.length * (0.2 + Math.random() * 0.5))
    const branch: Bolt = [[main[from][0], main[from][1]]]
    let bx = main[from][0]
    let by = main[from][1]
    const len = 3 + Math.floor(Math.random() * 5)
    for (let i = 0; i < len; i++) {
      by += 15 + Math.random() * 20
      bx += (Math.random() - 0.5) * 50
      branch.push([bx, by])
    }
    bolts.push(branch)
  }

  return bolts
}

function drawBolts(ctx: CanvasRenderingContext2D, bolts: Bolt[], alpha: number) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  for (let bi = 0; bi < bolts.length; bi++) {
    const pts = bolts[bi]
    const isBranch = bi > 0
    if (pts.length < 2) continue

    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])

    // outer glow
    ctx.strokeStyle = `rgba(140,180,255,${(isBranch ? 0.15 : 0.3) * alpha})`
    ctx.lineWidth = isBranch ? 10 : 20
    ctx.stroke()

    // mid glow
    ctx.strokeStyle = `rgba(200,225,255,${(isBranch ? 0.45 : 0.65) * alpha})`
    ctx.lineWidth = isBranch ? 4 : 7
    ctx.stroke()

    // bright core
    ctx.strokeStyle = `rgba(255,255,255,${(isBranch ? 0.85 : 1) * alpha})`
    ctx.lineWidth = isBranch ? 1.5 : 2.5
    ctx.stroke()
  }
}

export default function Thunder() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [flashOpacity, setFlashOpacity] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const rafRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const add = (fn: () => void, ms: number) => {
      const t = setTimeout(fn, ms)
      timers.current.push(t)
    }

    const strike = (bolts: Bolt[]) => {
      cancelAnimationFrame(rafRef.current)
      const start = performance.now()
      const duration = 300
      const step = (now: number) => {
        const alpha = Math.max(0, 1 - (now - start) / duration)
        drawBolts(ctx, bolts, alpha)
        if (alpha > 0) rafRef.current = requestAnimationFrame(step)
        else ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
      rafRef.current = requestAnimationFrame(step)
    }

    const flash = (done: () => void) => {
      const x1 = canvas.width * 0.05 + Math.random() * canvas.width * 0.9
      strike(makeBolt(canvas.width, canvas.height, x1))
      setFlashOpacity(0.55)
      add(() => {
        setFlashOpacity(0)
        if (Math.random() > 0.4) {
          add(() => {
            // second strike on opposite side of screen
            const x2 = x1 < canvas.width / 2
              ? canvas.width * 0.5 + Math.random() * canvas.width * 0.45
              : canvas.width * 0.05 + Math.random() * canvas.width * 0.45
            strike(makeBolt(canvas.width, canvas.height, x2))
            setFlashOpacity(0.35)
            add(() => {
              setFlashOpacity(0)
              add(done, 80)
            }, 60 + Math.random() * 70)
          }, 70 + Math.random() * 90)
        } else {
          add(done, 60)
        }
      }, 60 + Math.random() * 80)
    }

    const schedule = () => {
      add(() => flash(schedule), 2500 + Math.random() * 6000)
    }
    schedule()

    return () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'rgba(210,230,255,1)',
          opacity: flashOpacity,
          transition: flashOpacity > 0 ? 'none' : 'opacity 180ms ease-out',
        }}
      />
    </>
  )
}
