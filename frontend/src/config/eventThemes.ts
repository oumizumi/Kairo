export type EventTheme = {
  name: string;
  bg: string;
  border: string;
  text: string;
  hover: string;
  preview: string;
  cssGradient: string;
};

export const EVENT_THEMES: Record<string, EventTheme> = {
  'blue': {
    name: 'Blue',
    bg: 'bg-blue-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-blue-400',
    cssGradient: 'rgba(96, 165, 250, 0.6)'
  },
  'red': {
    name: 'Red',
    bg: 'bg-red-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-red-400',
    cssGradient: 'rgba(248, 113, 113, 0.6)'
  },
  'green': {
    name: 'Green',
    bg: 'bg-emerald-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-emerald-400',
    cssGradient: 'rgba(52, 211, 153, 0.6)'
  },
  'purple': {
    name: 'Purple',
    bg: 'bg-purple-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-purple-400',
    cssGradient: 'rgba(168, 85, 247, 0.6)'
  },
  'pink': {
    name: 'Pink',
    bg: 'bg-pink-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-pink-400',
    cssGradient: 'rgba(244, 114, 182, 0.6)'
  },
  'orange': {
    name: 'Orange',
    bg: 'bg-orange-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-orange-400',
    cssGradient: 'rgba(251, 146, 60, 0.6)'
  },
  'amber': {
    name: 'Amber',
    bg: 'bg-amber-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-amber-400',
    cssGradient: 'rgba(245, 158, 11, 0.6)'
  },
  'teal': {
    name: 'Teal',
    bg: 'bg-teal-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-teal-400',
    cssGradient: 'rgba(45, 212, 191, 0.6)'
  },
  'violet': {
    name: 'Violet',
    bg: 'bg-violet-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-violet-400',
    cssGradient: 'rgba(167, 139, 250, 0.6)'
  },
  'slate': {
    name: 'Slate',
    bg: 'bg-slate-400/60',
    border: 'border-white/10',
    text: 'text-black dark:text-white',
    hover: 'hover:brightness-110',
    preview: 'bg-slate-400',
    cssGradient: 'rgba(148, 163, 184, 0.6)'
  }
};

export const EVENT_THEME_KEYS: string[] = Object.keys(EVENT_THEMES);
