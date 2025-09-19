"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from './ThemeProvider';
import Lights from './Seasonal/Lights';

type Snowflake = {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  driftX: number;
  opacity: number;
  fadeOut?: boolean; // For snow-light interaction
  fadeProgress?: number;
};

type ChristmasLight = {
  x: number;
  y: number;
  color: string;
  brightness: number;
  pulseSpeed: number;
  pulseOffset: number;
};

const Snowfall: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const flakesRef = useRef<Snowflake[]>([]);
  const lightsRef = useRef<ChristmasLight[]>([]);
  const densityRef = useRef<number>(0);

  const init = (canvas: HTMLCanvasElement) => {
    const { innerWidth, innerHeight } = window;
    canvas.width = innerWidth;
    canvas.height = innerHeight;

    const targetDensity = Math.min(300, Math.floor((innerWidth * innerHeight) / 10000));
    densityRef.current = targetDensity;
    
    // Enhanced snowflakes with opacity and interaction properties
    flakesRef.current = new Array(targetDensity).fill(0).map(() => ({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      radius: Math.random() * 3 + 1,
      speedY: Math.random() * 1.5 + 0.5,
      driftX: Math.random() * 0.8 - 0.4,
      opacity: Math.random() * 0.6 + 0.4,
      fadeOut: false,
      fadeProgress: 0,
    }));

    // Christmas lights along edges - Updated festive color palette
    const lightColors = ['#dc2626', '#16a34a', '#eab308', '#ffffff']; // Red, Green, Gold, White
    lightsRef.current = [];
    
    // Top edge lights with sagging effect
    const numTopLights = Math.floor(innerWidth / 80);
    for (let i = 0; i < numTopLights; i++) {
      const progress = i / (numTopLights - 1);
      const baseX = progress * innerWidth;
      // Create sagging effect with sine curve
      const sagAmount = 30; // Maximum sag in pixels
      const baseY = 15 + Math.sin(progress * Math.PI) * sagAmount;
      
      lightsRef.current.push({
        x: baseX + (Math.random() - 0.5) * 20, // Small random offset
        y: baseY + (Math.random() - 0.5) * 10,
        color: lightColors[Math.floor(Math.random() * lightColors.length)],
        brightness: Math.random() * 0.3 + 0.6, // Adjusted brightness to not overpower text
        pulseSpeed: Math.random() * 0.015 + 0.008, // Varied pulse speeds
        pulseOffset: Math.random() * Math.PI * 2,
      });
    }

    // Side lights with random spacing
    const baseSpacing = 100;
    let currentY = baseSpacing / 2;
    
    while (currentY < innerHeight - baseSpacing / 2) {
      // Left side with random spacing
      lightsRef.current.push({
        x: Math.random() * 15 + 10, // Random positioning within range
        y: currentY + (Math.random() - 0.5) * 40, // Random vertical offset
        color: lightColors[Math.floor(Math.random() * lightColors.length)],
        brightness: Math.random() * 0.3 + 0.6,
        pulseSpeed: Math.random() * 0.015 + 0.008,
        pulseOffset: Math.random() * Math.PI * 2,
      });

      // Right side with random spacing
      lightsRef.current.push({
        x: innerWidth - Math.random() * 15 - 10,
        y: currentY + (Math.random() - 0.5) * 40,
        color: lightColors[Math.floor(Math.random() * lightColors.length)],
        brightness: Math.random() * 0.3 + 0.6,
        pulseSpeed: Math.random() * 0.015 + 0.008,
        pulseOffset: Math.random() * Math.PI * 2,
      });
      
      // Random spacing between lights
      currentY += baseSpacing + (Math.random() - 0.5) * 30;
    }
  };

  const draw = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Christmas lights with enhanced effects
    for (const light of lightsRef.current) {
      const time = Date.now() * 0.001;
      const pulse = Math.sin(time * light.pulseSpeed * 10 + light.pulseOffset);
      const currentBrightness = light.brightness + pulse * 0.2;
      
      // Enhanced glow effect with multiple layers
      ctx.shadowBlur = 25;
      ctx.shadowColor = light.color;
      ctx.fillStyle = light.color;
      ctx.globalAlpha = currentBrightness;
      
      // Outer glow
      ctx.beginPath();
      ctx.arc(light.x, light.y, 6, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner bright core
      ctx.shadowBlur = 10;
      ctx.globalAlpha = Math.min(1, currentBrightness + 0.3);
      ctx.beginPath();
      ctx.arc(light.x, light.y, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Highlight
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.globalAlpha = currentBrightness * 0.6;
      ctx.beginPath();
      ctx.arc(light.x - 1, light.y - 1, 1, 0, Math.PI * 2);
      ctx.fill();
      
      // Reset
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // Draw enhanced snowflakes with light interaction
    for (const flake of flakesRef.current) {
      // Check for light collision (subtle snow melting effect)
      let nearLight = false;
      for (const light of lightsRef.current) {
        const distance = Math.sqrt((flake.x - light.x) ** 2 + (flake.y - light.y) ** 2);
        if (distance < 15) { // Within light's influence
          nearLight = true;
          if (!flake.fadeOut && Math.random() < 0.005) { // 0.5% chance to start fading
            flake.fadeOut = true;
            flake.fadeProgress = 0;
          }
          break;
        }
      }
      
      // Handle fading effect
      if (flake.fadeOut) {
        flake.fadeProgress = (flake.fadeProgress || 0) + 0.02;
        if (flake.fadeProgress >= 1) {
          // Reset snowflake
          flake.y = -5;
          flake.x = Math.random() * canvas.width;
          flake.opacity = Math.random() * 0.6 + 0.4;
          flake.fadeOut = false;
          flake.fadeProgress = 0;
        }
      }
      
      // Calculate final opacity
      const finalOpacity = flake.fadeOut 
        ? flake.opacity * (1 - flake.fadeProgress!) 
        : flake.opacity;
      
      ctx.globalAlpha = finalOpacity;
      
      // Create sparkly snowflake effect
      const gradient = ctx.createRadialGradient(flake.x, flake.y, 0, flake.x, flake.y, flake.radius * 2);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
      ctx.fill();

      // Add sparkle effect for larger flakes
      if (flake.radius > 2) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Update position (skip if fading)
      if (!flake.fadeOut) {
        flake.y += flake.speedY;
        flake.x += flake.driftX + Math.sin(flake.y * 0.01) * 0.3;
        
        if (flake.y > canvas.height + 5) {
          flake.y = -5;
          flake.x = Math.random() * canvas.width;
          flake.opacity = Math.random() * 0.6 + 0.4;
        }
        if (flake.x > canvas.width + 5) flake.x = -5;
        if (flake.x < -5) flake.x = canvas.width + 5;
      }
    }

    ctx.globalAlpha = 1;
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
      className="pointer-events-none"
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh',
        zIndex: 60
      }}
      aria-hidden="true"
    />
  );
};



// Enhanced Christmas Lights Component using improved Lights component  
const ChristmasLights: React.FC = () => {
  return (
    <Lights 
      sideEnabled={true} 
      topEnabled={true} 
      density="subtle" 
      colors={['#e74c3c', '#2ecc71', '#f1c40f', '#ecf0f1']} // Red, Green, Gold, White
    />
  );
};

// Christmas Decorative Elements
const ChristmasDecorations: React.FC = () => {
  return (
    <>
      {/* Christmas Lights around the screen borders */}
      <ChristmasLights />
    </>
  );
};


const SeasonalEffects: React.FC = () => {
  const { seasonalTheme } = useTheme();
  
  if (seasonalTheme === 'christmas') {
    return (
      <>
        <Snowfall />
        <ChristmasDecorations />
      </>
    );
  }
  
  return null;
};

export default SeasonalEffects;
