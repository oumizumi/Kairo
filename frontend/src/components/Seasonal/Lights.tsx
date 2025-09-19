"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useTheme } from '../ThemeProvider';

// Utility to calculate point along SVG path
const getPointAlongPath = (path: SVGPathElement, ratio: number) => {
  const length = path.getTotalLength();
  return path.getPointAtLength(length * ratio);
};

// Generate positions along path with jitter and minimum spacing
const generateBulbPositions = (pathRef: React.RefObject<SVGPathElement>, count: number): number[] => {
  if (!pathRef.current) return [];
  
  const positions: number[] = [];
  const MIN_GAP = 56; // Minimum 56px spacing
  const maxAttempts = count * 15;
  let attempts = 0;
  
  while (positions.length < count && attempts < maxAttempts) {
    // Base position with ±12% jitter
    const baseRatio = positions.length / (count - 1);
    const jitter = (Math.random() - 0.5) * 0.24; // ±12%
    const ratio = Math.max(0.05, Math.min(0.95, baseRatio + jitter));
    
    // Check minimum spacing
    let validPosition = true;
    const point = getPointAlongPath(pathRef.current, ratio);
    
    for (const existingRatio of positions) {
      const existingPoint = getPointAlongPath(pathRef.current, existingRatio);
      const distance = Math.sqrt((point.x - existingPoint.x) ** 2 + (point.y - existingPoint.y) ** 2);
      
      if (distance < MIN_GAP) {
        validPosition = false;
        break;
      }
    }
    
    if (validPosition) {
      positions.push(ratio);
    }
    
    attempts++;
  }
  
  return positions.sort((a, b) => a - b);
};

interface LightsProps {
  topEnabled?: boolean;
  density?: 'subtle' | 'festive';
}

interface BulbData {
  id: string;
  x: number;
  y: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
  nearHero: boolean;
}

const Lights: React.FC<LightsProps> = ({
  topEnabled = true,
  density = 'subtle'
}) => {
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const topPathRef = useRef<SVGPathElement>(null);
  const { seasonalTheme, actualTheme } = useTheme();

  // Fixed color sequence - no repeating patterns
  const colors = ['#e74c3c', '#2ecc71', '#f1c40f', '#ecf0f1']; // Red, Green, Gold, White

  // Check environment variable for theme toggle (fallback to seasonal theme)
  const isDecember = new Date().getMonth() === 11; // December
  const envToggle = process.env.NEXT_PUBLIC_CHRISTMAS_LIGHTS === 'true';
  const shouldShowLights = seasonalTheme === 'christmas' || isDecember || envToggle;

  // Don't render if lights are disabled
  if (!shouldShowLights) {
    return null;
  }

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Generate bulb data with hero proximity detection
  const generateBulbs = (pathRef: React.RefObject<SVGPathElement>, side: 'left' | 'right' | 'top', count: number): BulbData[] => {
    if (!pathRef.current) return [];

    const bulbs: BulbData[] = [];
    const isMobile = dimensions.width < 640;
    const baseSize = isMobile ? 8.5 : 10; // 8-9px mobile, 9-11px desktop
    const positions = generateBulbPositions(pathRef, count);

    // Hero text area for proximity detection (within 160px)
    const heroCenter = { x: dimensions.width / 2, y: dimensions.height * 0.4 };

    positions.forEach((ratio, i) => {
      const point = getPointAlongPath(pathRef.current!, ratio);
      const distanceToHero = Math.sqrt((point.x - heroCenter.x) ** 2 + (point.y - heroCenter.y) ** 2);
      
      // Randomize color sequence (no RYG repeating)
      const colorIndex = (i * 3 + Math.floor(Math.random() * 2)) % colors.length;
      
      bulbs.push({
        id: `${side}-${i}`,
        x: point.x,
        y: point.y,
        color: colors[colorIndex],
        delay: Math.random() * 2.0, // 0-2.0s delay
        duration: 1.8 + Math.random() * 1.0, // 1.8-2.8s duration
        size: baseSize + (Math.random() * 2), // 9-11px desktop, 8-9px mobile
        nearHero: distanceToHero < 160, // Within 160px of hero
      });
    });

    return bulbs;
  };


  // Generate shallow sagging top path
  const generateTopPath = (): string => {
    const startY = 20;
    const sagDepth = 20;
    
    return `M 0 ${startY} 
            Q ${dimensions.width * 0.25} ${startY + sagDepth * 0.7} 
            ${dimensions.width * 0.5} ${startY + sagDepth} 
            Q ${dimensions.width * 0.75} ${startY + sagDepth * 0.7} 
            ${dimensions.width} ${startY}`;
  };

  const isMobile = dimensions.width < 640;
  const isLarge = dimensions.width >= 1440;
  
  // Responsive bulb counts - exact specifications
  const topBulbCount = Math.floor(dimensions.width / (isMobile ? 100 : 120));

  return (
    <>
      {/* CSS Variables and Keyframes */}
      <style jsx>{`
        :root {
          --bulb-size: ${isMobile ? Math.round(10 * 0.85) + 'px' : '10px'}; /* 15% smaller on mobile */
          --bulb-glow: 0.35;
          --bulb-gap: 56px;
        }
        
        @keyframes twinkle {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 0.55; }
        }
        
        .bulb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          transform-origin: center;
          filter: drop-shadow(0 0 6px currentColor);
        }
        
        .bulb::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 200%;
          height: 200%;
          border-radius: 50%;
          pointer-events: none;
          z-index: -1;
          opacity: 0.15;
          filter: blur(10px);
          background: radial-gradient(circle, currentColor 0%, transparent 60%);
        }
        
        .bulb-near-hero::after {
          opacity: 0.12; /* 20% reduction for bulbs within 160px of hero */
        }
        
        .garland-wire {
          stroke: #9aa0a6;
          stroke-width: 1.25;
          opacity: 0.07;
          fill: none;
          pointer-events: none;
        }
        
        @media (prefers-reduced-motion: reduce) {
          .bulb {
            animation: none !important;
          }
        }
      `}</style>

      <div className="fixed inset-0 z-[45] pointer-events-none">
        {/* Blur overlay for top portion under navbar */}
        <div 
          className="absolute top-0 left-0 w-full pointer-events-none"
          style={{
            height: '80px', // Covers navbar area
            background: actualTheme === 'dark' 
              ? 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)'
              : 'linear-gradient(to bottom, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 1
          }}
        />
        <svg className="absolute inset-0 w-full h-full">
          {/* Top Sagging String Wire */}
          {topEnabled && (
            <path
              ref={topPathRef}
              d={generateTopPath()}
              className="garland-wire"
            />
          )}
        </svg>


        {/* Top String Bulbs - Consistent Styling */}
        {topEnabled && (() => {
          const topBulbs = generateBulbs(topPathRef, 'top', topBulbCount);
          
          return topBulbs.map((bulb) => (
            <div
              key={bulb.id}
              className={`bulb ${bulb.nearHero ? 'bulb-near-hero' : ''}`}
              style={{
                left: bulb.x - bulb.size / 2,
                top: bulb.y - bulb.size / 2,
                width: bulb.size,
                height: bulb.size,
                backgroundColor: bulb.color,
                color: bulb.color, // For currentColor in CSS
                border: bulb.color === '#ecf0f1' ? '1px solid #e5e5e5' : '1px solid rgba(255,255,255,0.1)',
                animation: !prefersReducedMotion ? 
                  `twinkle ${bulb.duration}s ease-in-out infinite ${bulb.delay}s` : 
                  'none',
              }}
            >
              {/* Minimal highlight */}
              <div
                style={{
                  position: 'absolute',
                  top: '20%',
                  left: '35%',
                  width: '30%',
                  height: '20%',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.25)',
                  pointerEvents: 'none',
                }}
              />
            </div>
          ));
        })()}
      </div>
    </>
  );
};

export default Lights;
