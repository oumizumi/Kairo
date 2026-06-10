'use client'

// wing-up and wing-down silhouettes, same path structure so the browser can morph between them
const WINGS_UP =
  'M0 1.5 C4 0.2, 7.5 1.5, 10 5 C12.5 1.5, 16 0.2, 20 1.5 C16 2.8, 13 4.2, 10 7.2 C7 4.2, 4 2.8, 0 1.5 Z'
const WINGS_DOWN =
  'M0 8.6 C4 8.2, 7.5 6.2, 10 4.4 C12.5 6.2, 16 8.2, 20 8.6 C16 9.6, 13 8.4, 10 6.4 C7 8.4, 4 9.6, 0 8.6 Z'

interface BirdProps {
  size: number
  flapDur: number
  flapBegin: number
  opacity: number
}

// real flapping via SVG path morph between wing-up and wing-down
function Bird({ size, flapDur, flapBegin, opacity }: BirdProps) {
  return (
    <svg viewBox="0 0 20 10" width={size} height={size / 2} className="text-white" style={{ opacity }}>
      <path d={WINGS_UP} fill="currentColor">
        <animate
          attributeName="d"
          dur={`${flapDur}s`}
          begin={`${flapBegin}s`}
          repeatCount="indefinite"
          values={`${WINGS_UP};${WINGS_DOWN};${WINGS_UP}`}
          keyTimes="0;0.45;1"
          calcMode="spline"
          keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
        />
      </path>
    </svg>
  )
}

interface FlockBird {
  dx: number
  dy: number
  size: number
}

interface FlockProps {
  birds: FlockBird[]
  top: string
  dur: number
  delay: number
  reverse?: boolean
  baseOpacity?: number
}

// a group of birds gliding together: linear drift + per-bird bobbing + per-bird flap rhythm
function Flock({ birds, top, dur, delay, reverse = false, baseOpacity = 0.95 }: FlockProps) {
  return (
    <div
      className="absolute left-0 animate-bird-fly will-change-transform"
      style={{
        top,
        animationDuration: `${dur}s`,
        animationDelay: `${delay}s`,
        animationDirection: reverse ? 'reverse' : 'normal',
      }}
    >
      {birds.map((b, i) => (
        <div key={i} className="absolute" style={{ transform: `translate(${b.dx}px, ${b.dy}px)` }}>
          <div
            className="animate-bird-bob"
            style={{ animationDuration: `${3.2 + (i % 4) * 0.6}s`, animationDelay: `${-i * 0.9}s` }}
          >
            <Bird
              size={b.size}
              flapDur={0.38 + (i % 5) * 0.05}
              flapBegin={-i * 0.17}
              opacity={Math.max(0.3, baseOpacity - i * 0.06)}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// big V formation
const V_LARGE: FlockBird[] = [
  { dx: 0,    dy: 0,   size: 23 },
  { dx: -38,  dy: -17, size: 19 },
  { dx: -78,  dy: -34, size: 16 },
  { dx: -118, dy: -50, size: 13 },
  { dx: -40,  dy: 19,  size: 19 },
  { dx: -82,  dy: 38,  size: 16 },
  { dx: -124, dy: 56,  size: 13 },
]

// medium V, flies the other way
const V_MEDIUM: FlockBird[] = [
  { dx: 0,   dy: 0,   size: 17 },
  { dx: -32, dy: -14, size: 14 },
  { dx: -66, dy: -28, size: 12 },
  { dx: -34, dy: 16,  size: 14 },
  { dx: -70, dy: 31,  size: 12 },
]

// loose clusters
const CLUSTER_A: FlockBird[] = [
  { dx: 0,   dy: 0,   size: 14 },
  { dx: -28, dy: 12,  size: 12 },
  { dx: -24, dy: -13, size: 13 },
  { dx: -52, dy: 2,   size: 11 },
]

const CLUSTER_B: FlockBird[] = [
  { dx: 0,   dy: 0,  size: 12 },
  { dx: -26, dy: 10, size: 10 },
  { dx: -20, dy: -11, size: 11 },
]

const SOLO: FlockBird[] = [{ dx: 0, dy: 0, size: 13 }]
const SOLO_SMALL: FlockBird[] = [{ dx: 0, dy: 0, size: 10 }]

const V_SMALL: FlockBird[] = [
  { dx: 0,   dy: 0,   size: 13 },
  { dx: -26, dy: -11, size: 11 },
  { dx: -54, dy: -22, size: 9  },
  { dx: -28, dy: 13,  size: 11 },
  { dx: -58, dy: 25,  size: 9  },
]

const CLUSTER_C: FlockBird[] = [
  { dx: 0,   dy: 0,   size: 15 },
  { dx: -30, dy: -14, size: 13 },
  { dx: -22, dy: 15,  size: 12 },
  { dx: -58, dy: 3,   size: 11 },
  { dx: -46, dy: -20, size: 10 },
]

const SOLO_MED: FlockBird[] = [{ dx: 0, dy: 0, size: 16 }]

function Birds() {
  return (
    <div className="absolute inset-0 overflow-hidden motion-reduce:hidden">
      {/* main flocks */}
      <Flock birds={V_LARGE}   top="11%" dur={28} delay={-6} />
      <Flock birds={V_LARGE}   top="44%" dur={33} delay={-18} reverse baseOpacity={0.6} />
      <Flock birds={V_MEDIUM}  top="22%" dur={38} delay={-19} reverse baseOpacity={0.8} />
      <Flock birds={V_SMALL}   top="8%"  dur={31} delay={-24} reverse baseOpacity={0.7} />
      <Flock birds={V_SMALL}   top="35%" dur={41} delay={-36} baseOpacity={0.5} />
      {/* clusters */}
      <Flock birds={CLUSTER_A} top="30%" dur={46} delay={-31} baseOpacity={0.65} />
      <Flock birds={CLUSTER_B} top="6%"  dur={42} delay={-12} reverse baseOpacity={0.7} />
      <Flock birds={CLUSTER_B} top="45%" dur={39} delay={-28} baseOpacity={0.5} />
      <Flock birds={CLUSTER_C} top="18%" dur={54} delay={-41} reverse baseOpacity={0.6} />
      {/* solos */}
      <Flock birds={SOLO}      top="16%" dur={34} delay={-27} baseOpacity={0.7} />
      <Flock birds={SOLO}      top="38%" dur={52} delay={-44} baseOpacity={0.5} />
      <Flock birds={SOLO_MED}  top="25%" dur={37} delay={-8}  reverse baseOpacity={0.65} />
      <Flock birds={SOLO_MED}  top="48%" dur={45} delay={-39} baseOpacity={0.5} />
      <Flock birds={SOLO_SMALL} top="26%" dur={48} delay={-9}  reverse baseOpacity={0.45} />
      <Flock birds={SOLO_SMALL} top="3%"  dur={36} delay={-22} baseOpacity={0.55} />
      <Flock birds={SOLO_SMALL} top="42%" dur={41} delay={-30} baseOpacity={0.4} />
    </div>
  )
}

export default function GuessBackdrop({ dimmer = false }: { dimmer?: boolean }) {
  return (
    <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/guess/uoguessr-bg.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div
        className={`absolute inset-0 bg-gradient-to-b ${
          dimmer
            ? 'from-black/70 via-black/55 to-black/80'
            : 'from-black/55 via-black/25 to-black/70'
        }`}
      />
      <Birds />
    </div>
  )
}
