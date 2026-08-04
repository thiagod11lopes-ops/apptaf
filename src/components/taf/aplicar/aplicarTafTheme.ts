import { Platform, StyleSheet } from 'react-native';
import type { AppTheme } from '../../../theme/premium';
import { IS_WEB } from '../../../utils/webVisualPerf';

export function getAplicarTafBackdrop(theme: AppTheme) {
  return theme.isDark
    ? (['#020617', '#0b1224', '#111827', '#1e1b4b'] as const)
    : (['#f8fafc', '#eef2ff', '#f0f9ff', '#faf5ff'] as const);
}

export function getAplicarTafGlass(theme: AppTheme) {
  // Web: fundo mais opaco (sem backdrop-blur) — menos composição por painel.
  if (IS_WEB) {
    return {
      bg: theme.isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)',
      border: theme.isDark ? 'rgba(148, 163, 184, 0.28)' : 'rgba(148, 163, 184, 0.4)',
      highlight: theme.isDark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(37, 99, 235, 0.06)',
    };
  }
  return {
    bg: theme.isDark ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 255, 255, 0.78)',
    border: theme.isDark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(148, 163, 184, 0.35)',
    highlight: theme.isDark ? 'rgba(56, 189, 248, 0.14)' : 'rgba(37, 99, 235, 0.08)',
  };
}

export const aplicarTafShared = StyleSheet.create({
  orb: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.9,
  },
  orbLarge: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    opacity: 0.85,
  },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
});
