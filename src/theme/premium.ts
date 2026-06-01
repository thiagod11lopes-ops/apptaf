import { Platform } from 'react-native';
import type { TextStyle } from 'react-native';
import { FONT, fontFamily, createTextStyles } from './typography';
import { SISMAV_DARK, SISMAV_LIGHT, type SismavScheme } from './sismavTokens';

const monoFont = Platform.select({
  web: 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace',
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
}) as string;

/** Compatibilidade com imports legados — valores espelham SISMAV. */
export const PREMIUM = {
  accent: SISMAV_LIGHT.primary600,
  accentLight: SISMAV_LIGHT.primary500,
  accentMuted: 'rgba(37, 99, 235, 0.12)',
  dark: {
    bg: SISMAV_DARK.bg,
    elevated: SISMAV_DARK.bgSubtle,
    card: SISMAV_DARK.surface,
    cardHover: '#22304a',
    text: SISMAV_DARK.text,
    textSecondary: '#cbd5e1',
    textMuted: SISMAV_DARK.textMuted,
    border: SISMAV_DARK.border,
    borderSubtle: 'rgba(61, 79, 105, 0.65)',
  },
  light: {
    bg: SISMAV_LIGHT.bg,
    elevated: SISMAV_LIGHT.bgSubtle,
    card: SISMAV_LIGHT.surface,
    cardHover: '#f1f5f9',
    text: SISMAV_LIGHT.text,
    textSecondary: '#334155',
    textMuted: SISMAV_LIGHT.textMuted,
    border: SISMAV_LIGHT.border,
    borderSubtle: 'rgba(226, 232, 240, 0.9)',
  },
  fontMono: monoFont,
  radiusSm: SISMAV_LIGHT.radiusSm,
  radiusMd: SISMAV_LIGHT.radiusMd,
  radiusLg: SISMAV_LIGHT.radiusLg,
  radiusXl: SISMAV_LIGHT.radiusXl,
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
  tokens: SismavScheme;
  chartColors: [string, string, string, string, string];
};

function buildTheme(scheme: SismavScheme, isDark: boolean, fontsLoaded: boolean): AppTheme {
  const colors = {
    text: scheme.text,
    textSecondary: isDark ? '#cbd5e1' : '#334155',
    textMuted: scheme.textMuted,
  };
  return {
    isDark,
    primary: scheme.primary600,
    background: scheme.bg,
    cardBg: scheme.surface,
    text: scheme.text,
    textSecondary: colors.textSecondary,
    textMuted: scheme.textMuted,
    border: scheme.border,
    borderSubtle: isDark ? 'rgba(61, 79, 105, 0.55)' : scheme.border,
    borderMuted: scheme.borderStrong,
    error: scheme.danger,
    success: scheme.success,
    shadow: '#0f172a',
    gradient: [scheme.gradientAppBg[0], scheme.gradientAppBg[2]],
    backgroundSecondary: scheme.bgSubtle,
    surface: scheme.surface,
    gain: scheme.success,
    loss: scheme.danger,
    gainMuted: isDark ? 'rgba(52, 211, 153, 0.14)' : 'rgba(5, 150, 105, 0.1)',
    lossMuted: isDark ? 'rgba(248, 113, 113, 0.14)' : 'rgba(220, 38, 38, 0.1)',
    monoFont: PREMIUM.fontMono,
    accentMuted: isDark ? 'rgba(37, 99, 235, 0.22)' : 'rgba(37, 99, 235, 0.1)',
    fonts: FONT,
    textStyles: createTextStyles(colors, fontsLoaded),
    tokens: scheme,
    chartColors: [scheme.chart1, scheme.chart2, scheme.chart3, scheme.chart4, scheme.chart5],
  };
}

export function buildPremiumDarkTheme(fontsLoaded = true): AppTheme {
  return buildTheme(SISMAV_DARK, true, fontsLoaded);
}

export function buildPremiumLightTheme(fontsLoaded = true): AppTheme {
  return buildTheme(SISMAV_LIGHT, false, fontsLoaded);
}
