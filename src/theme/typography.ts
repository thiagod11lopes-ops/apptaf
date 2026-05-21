import { Platform, TextStyle } from 'react-native';

/** Nomes das fontes Inter (expo-google-fonts) */
export const FONT = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

const fallback = Platform.select({
  web: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  ios: 'System',
  android: 'sans-serif',
  default: 'sans-serif',
}) as string;

export function fontFamily(weight: keyof typeof FONT = 'regular', loaded: boolean): string {
  if (!loaded) return fallback;
  return FONT[weight];
}

export function createTextStyles(
  colors: { text: string; textSecondary: string; textMuted: string },
  loaded: boolean,
): Record<string, TextStyle> {
  const f = (w: keyof typeof FONT) => ({ fontFamily: fontFamily(w, loaded) });
  return {
    hero: {
      ...f('bold'),
      fontSize: 34,
      lineHeight: 40,
      letterSpacing: -0.8,
      color: colors.text,
    },
    h1: {
      ...f('bold'),
      fontSize: 22,
      lineHeight: 28,
      letterSpacing: -0.4,
      color: colors.text,
    },
    h2: {
      ...f('semibold'),
      fontSize: 17,
      lineHeight: 24,
      letterSpacing: -0.2,
      color: colors.text,
    },
    body: {
      ...f('regular'),
      fontSize: 16,
      lineHeight: 24,
      color: colors.text,
    },
    bodySecondary: {
      ...f('regular'),
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
    },
    caption: {
      ...f('medium'),
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    label: {
      ...f('semibold'),
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    mono: {
      fontFamily: Platform.select({
        web: 'ui-monospace, "SF Mono", Menlo, monospace',
        default: 'monospace',
      }),
      fontSize: 14,
      lineHeight: 20,
      color: colors.text,
    },
  };
}
