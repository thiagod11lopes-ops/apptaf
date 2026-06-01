/**
 * Tokens SISMAV espelhados em JS para React Native StyleSheet.
 * Web usa themes.css; RN usa estes valores via ThemeContext.
 */

export type SismavScheme = {
  primary50: string;
  primary300: string;
  primary500: string;
  primary600: string;
  primary700: string;
  primary800: string;
  success: string;
  danger: string;
  warning500: string;
  text: string;
  textMuted: string;
  textOnPrimary: string;
  bg: string;
  bgSubtle: string;
  surface: string;
  border: string;
  borderStrong: string;
  inputBg: string;
  tableRowHover: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  chartGrid: string;
  chartAxis: string;
  overlayBg: string;
  gradientHeader: readonly [string, string, string];
  gradientSidebar: readonly [string, string, string];
  gradientAppBg: readonly [string, string, string];
  gradientPanelBody: readonly [string, string];
  gradientPrimaryBtn: readonly [string, string];
  gradientDangerBtn: readonly [string, string];
  shadowSm: string;
  shadowMd: string;
  shadowCard: string;
  shadowCardHover: string;
  shadowModal: string;
  radiusXl: number;
  radiusLg: number;
  radiusMd: number;
  radiusSm: number;
};

export const SISMAV_LIGHT: SismavScheme = {
  primary50: '#eff6ff',
  primary300: '#93c5fd',
  primary500: '#3b82f6',
  primary600: '#2563eb',
  primary700: '#1d4ed8',
  primary800: '#1e3a8a',
  success: '#059669',
  danger: '#dc2626',
  warning500: '#f59e0b',
  text: '#0f172a',
  textMuted: '#64748b',
  textOnPrimary: '#ffffff',
  bg: '#eef2f7',
  bgSubtle: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  inputBg: '#ffffff',
  tableRowHover: 'rgba(37, 99, 235, 0.06)',
  chart1: '#2563eb',
  chart2: '#059669',
  chart3: '#d97706',
  chart4: '#7c3aed',
  chart5: '#db2777',
  chartGrid: '#e2e8f0',
  chartAxis: '#64748b',
  overlayBg: 'rgba(15, 23, 42, 0.55)',
  gradientHeader: ['#0f172a', '#1e3a5f', '#1d4ed8'],
  gradientSidebar: ['#0f172a', '#1e3a5f', '#1d4ed8'],
  gradientAppBg: ['#eef2f7', '#f1f5f9', '#f8fafc'],
  gradientPanelBody: ['#f8fafc', '#ffffff'],
  gradientPrimaryBtn: ['#2563eb', '#1d4ed8'],
  gradientDangerBtn: ['#ef4444', '#dc2626'],
  shadowSm: '0 1px 2px rgba(15, 23, 42, 0.06)',
  shadowMd: '0 4px 12px rgba(15, 23, 42, 0.08)',
  shadowCard: '0 4px 16px rgba(15, 23, 42, 0.06)',
  shadowCardHover: '0 8px 24px rgba(15, 23, 42, 0.12)',
  shadowModal: '0 24px 48px rgba(15, 23, 42, 0.22)',
  radiusXl: 20,
  radiusLg: 16,
  radiusMd: 12,
  radiusSm: 8,
};

export const SISMAV_DARK: SismavScheme = {
  primary50: '#1e3a5f',
  primary300: '#60a5fa',
  primary500: '#3b82f6',
  primary600: '#2563eb',
  primary700: '#1d4ed8',
  primary800: '#93c5fd',
  success: '#34d399',
  danger: '#f87171',
  warning500: '#fbbf24',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textOnPrimary: '#ffffff',
  bg: '#0b1220',
  bgSubtle: '#111827',
  surface: '#1a2538',
  border: '#3d4f69',
  borderStrong: '#4b5f7a',
  inputBg: '#152030',
  tableRowHover: 'rgba(96, 165, 250, 0.1)',
  chart1: '#2563eb',
  chart2: '#34d399',
  chart3: '#fbbf24',
  chart4: '#a78bfa',
  chart5: '#f472b6',
  chartGrid: '#334155',
  chartAxis: '#94a3b8',
  overlayBg: 'rgba(2, 6, 23, 0.72)',
  gradientHeader: ['#0f172a', '#1e3a5f', '#1d4ed8'],
  gradientSidebar: ['#0f172a', '#1e3a5f', '#1d4ed8'],
  gradientAppBg: ['#0b1220', '#0f172a', '#111827'],
  gradientPanelBody: ['#111827', '#1a2538'],
  gradientPrimaryBtn: ['#2563eb', '#1d4ed8'],
  gradientDangerBtn: ['#ef4444', '#dc2626'],
  shadowSm: '0 1px 2px rgba(0, 0, 0, 0.35)',
  shadowMd: '0 4px 12px rgba(0, 0, 0, 0.4)',
  shadowCard: '0 4px 16px rgba(0, 0, 0, 0.35)',
  shadowCardHover: '0 8px 28px rgba(0, 0, 0, 0.45)',
  shadowModal: '0 24px 56px rgba(0, 0, 0, 0.55)',
  radiusXl: 20,
  radiusLg: 16,
  radiusMd: 12,
  radiusSm: 8,
};

export const THEME_STORAGE_KEY = 'taf-theme-mode';
