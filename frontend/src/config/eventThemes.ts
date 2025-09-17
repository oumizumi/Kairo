export type EventTheme = {
  name: string;
  bg: string; // Tailwind background utility (same in light/dark)
  border: string; // Tailwind border utility
  text: string; // Tailwind text color utility
  hover: string; // Tailwind hover utility
  preview: string; // Tailwind preview swatch bg
  cssGradient: string; // Solid rgba background used in inline styles
};

// Unified event themes used across calendars. Colors are semi-transparent and
// identical in light and dark mode to keep appearance consistent.
export const EVENT_THEMES: Record<string, EventTheme> = {
  'halloween': {
    name: 'Halloween',
    bg: 'bg-orange-500/60',
    border: 'border-black/20',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-orange-500',
    cssGradient: 'rgba(249, 115, 22, 0.6)'
  },
  'christmas': {
    name: 'Christmas',
    bg: 'bg-emerald-500/60',
    border: 'border-white/20',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-emerald-500',
    cssGradient: 'rgba(16, 185, 129, 0.6)'
  },
  'lavender-peach': {
    name: 'Lavender Peach',
    bg: 'bg-purple-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-purple-400',
    cssGradient: 'rgba(168, 85, 247, 0.6)'
  },
  'indigo-sunset': {
    name: 'Indigo Sunset',
    bg: 'bg-indigo-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-indigo-400',
    cssGradient: 'rgba(99, 102, 241, 0.6)'
  },
  'cotton-candy': {
    name: 'Cotton Candy',
    bg: 'bg-pink-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-pink-400',
    cssGradient: 'rgba(244, 114, 182, 0.6)'
  },
  'blue-purple-magenta': {
    name: 'Blue Purple Magenta',
    bg: 'bg-blue-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-blue-400',
    cssGradient: 'rgba(96, 165, 250, 0.6)'
  },
  'deep-plum-coral': {
    name: 'Deep Plum Coral',
    bg: 'bg-rose-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-rose-400',
    cssGradient: 'rgba(251, 113, 133, 0.6)'
  },
  'classic-black-white': {
    name: 'Classic Black White',
    bg: 'bg-slate-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-slate-400',
    cssGradient: 'rgba(148, 163, 184, 0.6)'
  },
  'midnight-ivory': {
    name: 'Midnight Ivory',
    bg: 'bg-neutral-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-neutral-400',
    cssGradient: 'rgba(163, 163, 163, 0.6)'
  },
  'cosmic-galaxy': {
    name: 'Cosmic Galaxy',
    bg: 'bg-violet-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-violet-400',
    cssGradient: 'rgba(167, 139, 250, 0.6)'
  },
  'twilight-sunset': {
    name: 'Twilight Sunset',
    bg: 'bg-amber-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-amber-400',
    cssGradient: 'rgba(245, 158, 11, 0.6)'
  },
  'midnight-light-blue': {
    name: 'Midnight to Light Blue',
    bg: 'bg-sky-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-sky-400',
    cssGradient: 'rgba(56, 189, 248, 0.6)'
  },
  'midnight-indigo-blue-cyan': {
    name: 'Midnight to Indigo to Blue to Cyan',
    bg: 'bg-cyan-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-cyan-400',
    cssGradient: 'rgba(34, 211, 238, 0.6)'
  },
  'black-deep-bright': {
    name: 'Black to Deep to Bright Red',
    bg: 'bg-red-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-red-400',
    cssGradient: 'rgba(248, 113, 113, 0.6)'
  },
  'green-blue': {
    name: 'Green Blue',
    bg: 'bg-emerald-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-emerald-400',
    cssGradient: 'rgba(52, 211, 153, 0.6)'
  },
  'warm-brown': {
    name: 'Warm Brown',
    bg: 'bg-orange-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-orange-400',
    cssGradient: 'rgba(251, 146, 60, 0.6)'
  },
  'lime-green': {
    name: 'Lime Green',
    bg: 'bg-lime-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-lime-400',
    cssGradient: 'rgba(163, 230, 53, 0.6)'
  },
  'mint-teal': {
    name: 'Mint Teal',
    bg: 'bg-teal-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-teal-400',
    cssGradient: 'rgba(45, 212, 191, 0.6)'
  },
  // New additions
  'peach-mint': {
    name: 'Peach Mint',
    bg: 'bg-amber-300/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-amber-300',
    cssGradient: 'rgba(252, 211, 77, 0.6)'
  },
  'sky-lavender': {
    name: 'Sky Lavender',
    bg: 'bg-indigo-300/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-indigo-300',
    cssGradient: 'rgba(165, 180, 252, 0.6)'
  },
  'sunset-gold': {
    name: 'Sunset Gold',
    bg: 'bg-orange-300/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-orange-300',
    cssGradient: 'rgba(253, 186, 116, 0.6)'
  },
  'forest-moss': {
    name: 'Forest Moss',
    bg: 'bg-lime-500/40',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-lime-500',
    cssGradient: 'rgba(132, 204, 22, 0.4)'
  }
};

export const EVENT_THEME_KEYS: string[] = Object.keys(EVENT_THEMES);

