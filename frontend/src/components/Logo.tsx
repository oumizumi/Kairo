import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 48, className = '' }) => {
  return (
    <div className={`flex items-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="text-black dark:text-white transition-all duration-700 ease-out hover:scale-110 hover:rotate-1"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        <defs>
          {/* Animation easing definitions */}
          <animate id="breatheEase" dur="5s" repeatCount="indefinite" 
                   calcMode="spline" keySplines="0.4,0,0.6,1;0.4,0,0.6,1" keyTimes="0;0.5;1" />
        </defs>
        
        {/* Premium K letter with sophisticated animations */}
        <g transform="translate(50, 50)">
          {/* Vertical left stem with subtle glow effect */}
          <rect
            x="-22"
            y="-30"
            width="5"
            height="60"
            fill="currentColor"
            rx="2.5"
          >
            <animate attributeName="opacity" 
                     values="0.95;1;0.95" 
                     dur="6s" 
                     repeatCount="indefinite"
                     calcMode="spline" 
                     keySplines="0.42,0,0.58,1;0.42,0,0.58,1" 
                     keyTimes="0;0.5;1" />
          </rect>
          
          {/* Upper diagonal arm with sophisticated fade */}
          <polygon
            points="-17,-5 18,-25 22,-22 -13,-2"
            fill="currentColor"
          >
            <animate attributeName="opacity" 
                     values="0.85;1;0.85" 
                     dur="5s" 
                     repeatCount="indefinite"
                     calcMode="spline"
                     keySplines="0.25,0.46,0.45,0.94;0.25,0.46,0.45,0.94"
                     keyTimes="0;0.5;1" />
            <animateTransform 
              attributeName="transform" 
              type="scale" 
              values="1;1.02;1" 
              dur="5s" 
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.25,0.46,0.45,0.94;0.25,0.46,0.45,0.94"
              keyTimes="0;0.5;1" />
          </polygon>
          
          {/* Lower diagonal arm with offset elegant motion */}
          <polygon
            points="-17,5 18,25 22,22 -13,2"
            fill="currentColor"
          >
            <animate attributeName="opacity" 
                     values="1;0.85;1" 
                     dur="5s" 
                     repeatCount="indefinite" 
                     begin="2.5s"
                     calcMode="spline"
                     keySplines="0.25,0.46,0.45,0.94;0.25,0.46,0.45,0.94"
                     keyTimes="0;0.5;1" />
            <animateTransform 
              attributeName="transform" 
              type="scale" 
              values="1;1.02;1" 
              dur="5s" 
              repeatCount="indefinite" 
              begin="2.5s"
              calcMode="spline"
              keySplines="0.25,0.46,0.45,0.94;0.25,0.46,0.45,0.94"
              keyTimes="0;0.5;1" />
          </polygon>
          
          {/* Connection point with premium heartbeat */}
          <circle
            cx="-17"
            cy="0"
            r="3"
            fill="currentColor"
          >
            <animate attributeName="r" 
                     values="3;3.8;3" 
                     dur="4s" 
                     repeatCount="indefinite"
                     calcMode="spline"
                     keySplines="0.34,1.56,0.64,1;0.34,1.56,0.64,1"
                     keyTimes="0;0.5;1" />
            <animate attributeName="opacity" 
                     values="1;0.8;1" 
                     dur="4s" 
                     repeatCount="indefinite"
                     calcMode="spline"
                     keySplines="0.25,0.46,0.45,0.94;0.25,0.46,0.45,0.94"
                     keyTimes="0;0.5;1" />
          </circle>
          
          {/* Floating accent dots with natural motion */}
          <circle cx="28" cy="-20" r="1.2" fill="currentColor" opacity="0.6">
            <animate attributeName="opacity" 
                     values="0.3;0.8;0.3" 
                     dur="4s" 
                     repeatCount="indefinite"
                     calcMode="spline"
                     keySplines="0.25,0.46,0.45,0.94;0.25,0.46,0.45,0.94"
                     keyTimes="0;0.5;1" />
            <animateTransform 
              attributeName="transform" 
              type="translateY" 
              values="0;-3;0" 
              dur="4s" 
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.42,0,0.58,1;0.42,0,0.58,1"
              keyTimes="0;0.5;1" />
            <animate attributeName="r" 
                     values="1.2;1.5;1.2" 
                     dur="4s" 
                     repeatCount="indefinite"
                     calcMode="spline"
                     keySplines="0.25,0.46,0.45,0.94;0.25,0.46,0.45,0.94"
                     keyTimes="0;0.5;1" />
          </circle>
          
          <circle cx="28" cy="20" r="1.2" fill="currentColor" opacity="0.6">
            <animate attributeName="opacity" 
                     values="0.8;0.3;0.8" 
                     dur="4s" 
                     repeatCount="indefinite"
                     calcMode="spline"
                     keySplines="0.25,0.46,0.45,0.94;0.25,0.46,0.45,0.94"
                     keyTimes="0;0.5;1" />
            <animateTransform 
              attributeName="transform" 
              type="translateY" 
              values="0;3;0" 
              dur="4s" 
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.42,0,0.58,1;0.42,0,0.58,1"
              keyTimes="0;0.5;1" />
            <animate attributeName="r" 
                     values="1.2;1.5;1.2" 
                     dur="4s" 
                     repeatCount="indefinite"
                     calcMode="spline"
                     keySplines="0.25,0.46,0.45,0.94;0.25,0.46,0.45,0.94"
                     keyTimes="0;0.5;1" />
          </circle>
          
          {/* Energy flow line with smooth wave motion */}
          <path d="M 22 0 L 30 0" stroke="currentColor" strokeWidth="0.8" opacity="0.5">
            <animate attributeName="stroke-dasharray" 
                     values="0 8;4 4;8 0;4 4;0 8" 
                     dur="3s" 
                     repeatCount="indefinite"
                     calcMode="spline"
                     keySplines="0.25,0.46,0.45,0.94;0.25,0.46,0.45,0.94;0.25,0.46,0.45,0.94;0.25,0.46,0.45,0.94"
                     keyTimes="0;0.25;0.5;0.75;1" />
            <animate attributeName="opacity" 
                     values="0.3;0.7;0.3" 
                     dur="3s" 
                     repeatCount="indefinite"
                     calcMode="spline"
                     keySplines="0.25,0.46,0.45,0.94;0.25,0.46,0.45,0.94"
                     keyTimes="0;0.5;1" />
          </path>
          
          {/* Smooth orbiting intelligence indicator */}
          <circle cx="26" cy="0" r="0.9" fill="currentColor" opacity="0.7">
            <animateTransform 
              attributeName="transform" 
              type="rotate" 
              values="0;360" 
              dur="12s" 
              repeatCount="indefinite" />
            <animate attributeName="opacity" 
                     values="0.4;0.9;0.4" 
                     dur="6s" 
                     repeatCount="indefinite"
                     calcMode="spline"
                     keySplines="0.25,0.46,0.45,0.94;0.25,0.46,0.45,0.94"
                     keyTimes="0;0.5;1" />
            <animate attributeName="r" 
                     values="0.9;1.1;0.9" 
                     dur="6s" 
                     repeatCount="indefinite"
                     calcMode="spline"
                     keySplines="0.25,0.46,0.45,0.94;0.25,0.46,0.45,0.94"
                     keyTimes="0;0.5;1" />
          </circle>
          
          {/* Subtle ambient particles */}
          <circle cx="32" cy="-8" r="0.5" fill="currentColor" opacity="0.4">
            <animate attributeName="opacity" 
                     values="0.2;0.6;0.2" 
                     dur="7s" 
                     repeatCount="indefinite"
                     calcMode="spline"
                     keySplines="0.25,0.46,0.45,0.94;0.25,0.46,0.45,0.94"
                     keyTimes="0;0.5;1" />
            <animateTransform 
              attributeName="transform" 
              type="translateX" 
              values="0;2;0" 
              dur="7s" 
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.42,0,0.58,1;0.42,0,0.58,1"
              keyTimes="0;0.5;1" />
          </circle>
          
          <circle cx="32" cy="8" r="0.5" fill="currentColor" opacity="0.4">
            <animate attributeName="opacity" 
                     values="0.6;0.2;0.6" 
                     dur="7s" 
                     repeatCount="indefinite"
                     calcMode="spline"
                     keySplines="0.25,0.46,0.45,0.94;0.25,0.46,0.45,0.94"
                     keyTimes="0;0.5;1" />
            <animateTransform 
              attributeName="transform" 
              type="translateX" 
              values="0;-2;0" 
              dur="7s" 
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.42,0,0.58,1;0.42,0,0.58,1"
              keyTimes="0;0.5;1" />
          </circle>
        </g>
      </svg>
    </div>
  );
};

export default Logo;