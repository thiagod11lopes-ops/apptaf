import { Platform } from 'react-native';
import type { TextStyle } from 'react-native';
import { FONT, fontFamily, createTextStyles } from './typography';

const monoFont = Platform.select({
  web: 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace',
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
}) as string;

/**
 * Paleta legível — modo escuro suave (evita preto puro e texto apagado).
 */
export const PREMIUM = {
  accent: '#6B7CFF',
  accentLight: '#818CF8',
  accentMuted: 'rgba(107, 124, 255, 0.18)',

  dark: {
    bg: '#1C1C22',
    elevated: '#25252D',
    card: '#2E2E38',
    cardHover: '#363642',
    text: '#FFFFFF',
    textSecondary: '#FFFFFF',
    textMuted: '#FFFFFF',
    border: 'rgba(255, 255, 255, 0.12)',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
  },
  light: {
    bg: '#F8F9FC',
    elevated: '#FFFFFF',
    card: '#FFFFFF',
    cardHover: '#F4F4F8',
    text: '#12121A',
    textSecondary: '#4B4B5C',
    textMuted: '#6E6E80',
    border: 'rgba(15, 23, 42, 0.1)',
    borderSubtle: 'rgba(15, 23, 42, 0.06)',
  },

  fontMono: monoFont,
  radiusSm: 10,
  radiusMd: 14,
  radiusLg: 18,
  radiusXl: 22,
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
  isDark: boolean;
  fonts: typeof FONT;
  textStyles: Record<string, TextStyle>;
};

export function buildPremiumDarkTheme(fontsLoaded = true): AppTheme {
  const d = PREMIUM.dark;
  const colors = { text: d.text, textSecondary: d.textSecondary, textMuted: d.textMuted };
  return {
    isDark: true,
    primary: PREMIUM.accentLight,
    background: d.bg,
    cardBg: d.card,
    text: d.text,
    textSecondary: d.textSecondary,
    textMuted: d.textMuted,
    border: d.border,
    borderSubtle: d.borderSubtle,
    borderMuted: d.border,
    error: '#FB7185',
    success: '#4ADE80',
    shadow: '#000000',
    gradient: [d.elevated, d.bg],
    backgroundSecondary: d.elevated,
    surface: d.card,
    gain: '#4ADE80',
    loss: '#FB7185',
    gainMuted: 'rgba(74, 222, 128, 0.14)',
    lossMuted: 'rgba(251, 113, 133, 0.14)',
    monoFont: PREMIUM.fontMono,
    accentMuted: PREMIUM.accentMuted,
    fonts: FONT,
    textStyles: createTextStyles(colors, fontsLoaded),
  };
}

export function buildPremiumLightTheme(fontsLoaded = true): AppTheme {
  const l = PREMIUM.light;
  const colors = { text: l.text, textSecondary: l.textSecondary, textMuted: l.textMuted };
  return {
    isDark: false,
    primary: PREMIUM.accent,
    background: l.bg,
    cardBg: l.card,
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
    surface: l.card,
    gain: '#059669',
    loss: '#E11D48',
    gainMuted: 'rgba(5, 150, 105, 0.1)',
    lossMuted: 'rgba(225, 29, 72, 0.1)',
    monoFont: PREMIUM.fontMono,
    accentMuted: PREMIUM.accentMuted,
    fonts: FONT,
    textStyles: createTextStyles(colors, fontsLoaded),
  };
}
