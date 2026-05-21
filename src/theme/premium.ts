import { Platform } from 'react-native';

const monoFont = Platform.select({
  web: 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace',
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
}) as string;

/** Linear / Vercel / Apple — minimal, accent pontual */
export const PREMIUM = {
  accent: '#6366F1',
  accentMuted: 'rgba(99, 102, 241, 0.14)',

  dark: {
    bg: '#000000',
    elevated: '#09090B',
    surface: 'rgba(24, 24, 27, 0.65)',
    text: '#FAFAFA',
    textSecondary: '#A1A1AA',
    textMuted: '#71717A',
    border: 'rgba(255, 255, 255, 0.1)',
    borderSubtle: 'rgba(255, 255, 255, 0.06)',
  },
  light: {
    bg: '#FFFFFF',
    elevated: '#F4F4F5',
    surface: 'rgba(255, 255, 255, 0.72)',
    text: '#09090B',
    textSecondary: '#52525B',
    textMuted: '#71717A',
    border: 'rgba(0, 0, 0, 0.08)',
    borderSubtle: 'rgba(0, 0, 0, 0.05)',
  },

  fontMono: monoFont,
  radiusPhone: 40,
  minTouch: 48,
} as const;

export type AppTheme = {
  primary: string;
  background: string;
  cardBg: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderSubtle: string;
  borderMuted: string;
  error: string;
  success: string;
  shadow: string;
  gradient: [string, string];
  backgroundSecondary: string;
  surface: string;
  gain: string;
  loss: string;
  gainMuted: string;
  lossMuted: string;
  monoFont: string;
  accentMuted: string;
};

export function buildPremiumDarkTheme(): AppTheme {
  const d = PREMIUM.dark;
  return {
    primary: PREMIUM.accent,
    background: d.bg,
    cardBg: d.surface,
    text: d.text,
    textSecondary: d.textSecondary,
    textMuted: d.textMuted,
    border: d.border,
    borderSubtle: d.borderSubtle,
    borderMuted: d.border,
    error: '#F43F5E',
    success: '#10B981',
    shadow: '#000000',
    gradient: [d.elevated, d.bg],
    backgroundSecondary: d.elevated,
    surface: d.surface,
    gain: '#10B981',
    loss: '#F43F5E',
    gainMuted: 'rgba(16, 185, 129, 0.12)',
    lossMuted: 'rgba(244, 63, 94, 0.12)',
    monoFont: PREMIUM.fontMono,
    accentMuted: PREMIUM.accentMuted,
  };
}

export function buildPremiumLightTheme(): AppTheme {
  const l = PREMIUM.light;
  return {
    primary: PREMIUM.accent,
    background: l.bg,
    cardBg: l.surface,
    text: l.text,
    textSecondary: l.textSecondary,
    textMuted: l.textMuted,
    border: l.border,
    borderSubtle: l.borderSubtle,
    borderMuted: l.border,
    error: '#E11D48',
    success: '#059669',
    shadow: '#000000',
    gradient: [l.elevated, l.bg],
    backgroundSecondary: l.elevated,
    surface: l.surface,
    gain: '#059669',
    loss: '#E11D48',
    gainMuted: 'rgba(5, 150, 105, 0.1)',
    lossMuted: 'rgba(225, 29, 72, 0.1)',
    monoFont: PREMIUM.fontMono,
    accentMuted: PREMIUM.accentMuted,
  };
}

/** Classes Tailwind reutilizáveis (dark mode via `dark:` no web quando `class` no html) */
export const tw = {
  screen: 'flex-1 bg-white dark:bg-black select-none-touch',
  glassCard:
    'rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-white/70 dark:bg-zinc-900/60 shadow-md overflow-hidden',
  glassCardLg:
    'rounded-3xl border border-zinc-200/80 dark:border-white/10 bg-white/75 dark:bg-zinc-900/55 shadow-xl overflow-hidden',
  textTitle: 'text-zinc-900 dark:text-zinc-50 text-lg font-semibold tracking-tight',
  textMuted: 'text-zinc-500 dark:text-zinc-400 text-sm',
  textAccent: 'text-indigo-600 dark:text-indigo-400',
  btnPrimary:
    'min-h-[48px] rounded-2xl bg-indigo-600 dark:bg-indigo-500 px-5 py-3 items-center justify-center shadow-md active:scale-[0.98] transition-premium',
  btnGhost:
    'min-h-[48px] rounded-2xl border border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-zinc-900/40 px-5 py-3 items-center justify-center active:scale-[0.98] transition-premium',
  input:
    'min-h-[48px] rounded-2xl border border-zinc-200 dark:border-white/10 bg-white/80 dark:bg-zinc-900/50 px-4 text-zinc-900 dark:text-zinc-100',
} as const;
