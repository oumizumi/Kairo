"use client";

import React, { useEffect, useRef } from 'react';
import { useTheme } from './ThemeProvider';

type Snowflake = {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  driftX: number;
};

const Snowfall: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const flakesRef = useRef<Snowflake[]>([]);
  const densityRef = useRef<number>(0);

  const init = (canvas: HTMLCanvasElement) => {
    const { innerWidth, innerHeight } = window;
    canvas.width = innerWidth;
    canvas.height = innerHeight;

    const targetDensity = Math.min(200, Math.floor((innerWidth * innerHeight) / 12000));
    densityRef.current = targetDensity;
    flakesRef.current = new Array(targetDensity).fill(0).map(() => ({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      radius: Math.random() * 2.2 + 0.8,
      speedY: Math.random() * 1.2 + 0.4,
      driftX: Math.random() * 0.6 - 0.3,
    }));
  };

  const draw = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';

    for (const flake of flakesRef.current) {
      ctx.beginPath();
      ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
      ctx.fill();
      flake.y += flake.speedY;
      flake.x += flake.driftX + Math.sin(flake.y * 0.01) * 0.2;
      if (flake.y > canvas.height + 5) {
        flake.y = -5;
        flake.x = Math.random() * canvas.width;
      }
      if (flake.x > canvas.width + 5) flake.x = -5;
      if (flake.x < -5) flake.x = canvas.width + 5;
    }
  };

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    draw(ctx, canvas);
    animationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    init(canvas);
    animate();

    const handleResize = () => {
      if (!canvas) return;
      init(canvas);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[60]"
      aria-hidden="true"
    />
  );
};

const SeasonalEffects: React.FC = () => {
  const { seasonalTheme } = useTheme();
  if (seasonalTheme !== 'christmas') return null;
  return <Snowfall />;
};

export default SeasonalEffects;


