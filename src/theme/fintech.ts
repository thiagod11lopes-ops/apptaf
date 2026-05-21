import { Platform } from 'react-native';

const monoFont = Platform.select({
  web: 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace',
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
}) as string;

/** Tokens visuais — dashboard alta performance (TradingView / Robinhood / DeFi). */
export const FINTECH = {
  bgOled: '#000000',
  bgElevated: '#0A0A0B',
  bgPanel: '#111113',
  bgPanelHover: '#161618',

  borderSubtle: 'rgba(255, 255, 255, 0.05)',
  borderMuted: 'rgba(255, 255, 255, 0.08)',
  borderFocus: 'rgba(255, 255, 255, 0.12)',

  textPrimary: '#F4F4F5',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',

  gain: '#34D399',
  gainMuted: 'rgba(52, 211, 153, 0.12)',
  gainBorder: 'rgba(52, 211, 153, 0.35)',
  loss: '#FB7185',
  lossMuted: 'rgba(251, 113, 133, 0.12)',
  lossBorder: 'rgba(251, 113, 133, 0.35)',

  accent: '#3B82F6',
  accentMuted: 'rgba(59, 130, 246, 0.15)',

  primary: '#2563EB',
  primaryGlow: 'rgba(37, 99, 235, 0.4)',

  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 20,

  durationFast: 150,
  durationNormal: 200,

  fontMono: monoFont,
} as const;

export type AppTheme = {
  primary: string;
  background: string;
  cardBg: string;
  text: string;
  textSecondary: string;
  border: string;
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
  borderSubtle: string;
  borderMuted: string;
  monoFont: string;
  textMuted: string;
};

export function buildFintechDarkTheme(): AppTheme {
  return {
    primary: FINTECH.primary,
    background: FINTECH.bgOled,
    cardBg: FINTECH.bgPanel,
    text: FINTECH.textPrimary,
    textSecondary: FINTECH.textSecondary,
    textMuted: FINTECH.textMuted,
    border: FINTECH.borderSubtle,
    borderSubtle: FINTECH.borderSubtle,
    borderMuted: FINTECH.borderMuted,
    error: FINTECH.loss,
    success: FINTECH.gain,
    shadow: '#000000',
    gradient: [FINTECH.bgElevated, FINTECH.bgPanel],
    backgroundSecondary: FINTECH.bgElevated,
    surface: FINTECH.bgPanel,
    gain: FINTECH.gain,
    loss: FINTECH.loss,
    gainMuted: FINTECH.gainMuted,
    lossMuted: FINTECH.lossMuted,
    monoFont: FINTECH.fontMono,
  };
}

export const fintechLightTheme: AppTheme = {
  primary: '#2563EB',
  background: '#F4F4F5',
  cardBg: '#FFFFFF',
  text: '#09090B',
  textSecondary: '#52525B',
  textMuted: '#71717A',
  border: 'rgba(0, 0, 0, 0.08)',
  borderSubtle: 'rgba(0, 0, 0, 0.06)',
  borderMuted: 'rgba(0, 0, 0, 0.1)',
  error: '#E11D48',
  success: '#059669',
  shadow: '#000000',
  gradient: ['#E4E4E7', '#F4F4F5'],
  backgroundSecondary: '#E4E4E7',
  surface: '#FFFFFF',
  gain: '#059669',
  loss: '#E11D48',
  gainMuted: 'rgba(5, 150, 105, 0.1)',
  lossMuted: 'rgba(225, 29, 72, 0.1)',
  monoFont: monoFont,
};
