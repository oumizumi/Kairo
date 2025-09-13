"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Stat = { value: string; label: string };

const defaultStats: Stat[] = [
  { value: "2-3 min", label: "to first schedule" },
  { value: "0", label: "time conflicts" },
  { value: "10,000+", label: "courses indexed" },
  { value: "1-click", label: "calendar sync" },
];

type StatsMarqueeProps = {
  items?: Stat[];
  speed?: number; // seconds per loop for continuous variant
  variant?: "continuous" | "snap";
  autoPlayMs?: number; // ms per step for snap variant
  pauseOnHover?: boolean;
  respectReducedMotion?: boolean;
  // style overrides to reuse host container styles
  chipClassName?: string;
  valueClassName?: string;
  labelClassName?: string;
  rowClassName?: string;
  wrapperClassName?: string;
};

export default function StatsMarquee({
  items = defaultStats,
  speed = 26,
  variant = "continuous",
  autoPlayMs = 2400,
  pauseOnHover = true,
  respectReducedMotion = true,
  chipClassName,
  valueClassName,
  labelClassName,
  rowClassName,
  wrapperClassName,
}: StatsMarqueeProps) {
  if (variant === "snap") {
    return (
      <SnapCarousel
        items={items}
        autoPlayMs={autoPlayMs}
        pauseOnHover={pauseOnHover}
        chipClassName={chipClassName}
        valueClassName={valueClassName}
        labelClassName={labelClassName}
      />
    );
  }

  const row = useMemo(() => [...items, ...items], [items]);
  const prefersReducedMotion = usePrefersReducedMotion();
  const disableMotion = respectReducedMotion && prefersReducedMotion;

  return (
    <div className={`group relative w-full overflow-hidden ${wrapperClassName ?? ""}`} aria-label="Kairo stats">
      <style>{`
        @keyframes scroll-x {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        ${respectReducedMotion ? `@media (prefers-reduced-motion: reduce) { .marquee-animate { animation: none !important; } }` : ``}
        /* hide scrollbar for snap variant utility */
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div
        className="marquee-animate flex w-max select-none whitespace-nowrap"
        style={{
          animation: disableMotion ? "none" : "scroll-x linear infinite",
          animationDuration: `${Math.max(1, speed)}s`,
          willChange: "transform",
        }}
        onMouseEnter={(e) => {
          if (!pauseOnHover) return;
          (e.currentTarget as HTMLElement).style.animationPlayState = "paused";
        }}
        onMouseLeave={(e) => {
          if (!pauseOnHover) return;
          (e.currentTarget as HTMLElement).style.animationPlayState = "running";
        }}
      >
        <Row
          items={row.slice(0, row.length / 2)}
          chipClassName={chipClassName}
          valueClassName={valueClassName}
          labelClassName={labelClassName}
          rowClassName={rowClassName}
          padEnd
        />
        <Row
          items={row.slice(row.length / 2)}
          chipClassName={chipClassName}
          valueClassName={valueClassName}
          labelClassName={labelClassName}
          rowClassName={rowClassName}
          padStart
        />
      </div>
    </div>
  );
}

function Row({ items, chipClassName, valueClassName, labelClassName, rowClassName, padStart, padEnd }: { items: Stat[]; chipClassName?: string; valueClassName?: string; labelClassName?: string; rowClassName?: string; padStart?: boolean; padEnd?: boolean; }) {
  return (
    <div className={`flex shrink-0 ${padStart ? "pl-3 md:pl-4" : ""} ${padEnd ? "pr-3 md:pr-4" : ""} ${rowClassName ?? ""}`}>
      {items.map((s, i) => (
        <StatChip
          key={`${s.value}-${s.label}-${i}`}
          stat={s}
          chipClassName={chipClassName}
          valueClassName={valueClassName}
          labelClassName={labelClassName}
        />
      ))}
    </div>
  );
}

function StatChip({ stat, chipClassName, valueClassName, labelClassName }: { stat: Stat; chipClassName?: string; valueClassName?: string; labelClassName?: string; }) {
  return (
    <div className={chipClassName ?? "flex shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-4 backdrop-blur text-center"}>
      <div className="leading-tight flex flex-col items-center gap-2">
        <div className={valueClassName ?? "text-lg font-semibold text-black dark:text-white"}>{stat.value}</div>
        <div className={labelClassName ?? "text-xs text-gray-600 dark:text-white/60"}>{stat.label}</div>
      </div>
    </div>
  );
}

function SnapCarousel({
  items,
  autoPlayMs,
  pauseOnHover,
  respectReducedMotion = true,
  chipClassName,
  valueClassName,
  labelClassName,
}: {
  items: Stat[];
  autoPlayMs: number;
  pauseOnHover: boolean;
  respectReducedMotion?: boolean;
  chipClassName?: string;
  valueClassName?: string;
  labelClassName?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const disableMotion = respectReducedMotion && prefersReducedMotion;

  // Create multiple copies for truly seamless infinite loop
  const looped = useMemo(() => [...items, ...items, ...items, ...items], [items]);

  return (
    <div className="relative w-full overflow-hidden" aria-label="Kairo stats">
      <style jsx global>{`
        /* hide scrollbar */
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        @keyframes infinite-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }

        .marquee-content {
          animation: infinite-marquee linear infinite;
          animation-duration: ${Math.max(15, autoPlayMs * items.length / 1000)}s;
        }

        ${respectReducedMotion ? `@media (prefers-reduced-motion: reduce) { .marquee-content { animation: none !important; } }` : ``}

        .marquee-container:hover .marquee-content {
          animation-play-state: paused;
        }
      `}</style>
      <div
        ref={containerRef}
        className={`no-scrollbar flex w-full select-none gap-4 px-2 ${pauseOnHover ? 'marquee-container' : ''}`}
        onMouseEnter={pauseOnHover ? () => setIsHovered(true) : undefined}
        onMouseLeave={pauseOnHover ? () => setIsHovered(false) : undefined}
      >
        <div className={`marquee-content flex ${disableMotion ? '' : ''}`}>
          {looped.map((s, i) => (
            <div key={`${s.value}-${s.label}-${i}`} className="shrink-0">
              <StatChip stat={s} chipClassName={chipClassName} valueClassName={valueClassName} labelClassName={labelClassName} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mediaQuery.matches);
    update();
    mediaQuery.addEventListener?.("change", update);
    return () => mediaQuery.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

