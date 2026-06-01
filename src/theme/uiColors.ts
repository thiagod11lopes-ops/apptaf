import type { AppTheme } from './premium';

/** Tokens de UI derivados do tema — texto branco no modo escuro. */
export function getUiColors(theme: AppTheme) {
  const dark = theme.isDark;
  return {
    text: theme.text,
    textSecondary: theme.textSecondary,
    textMuted: theme.textMuted,
    icon: dark ? '#FFFFFF' : '#6B7280',
    iconStrong: dark ? '#FFFFFF' : '#111827',
    label: dark ? '#FFFFFF' : '#374151',
    ink: dark ? '#FFFFFF' : '#111827',
    placeholder: dark ? 'rgba(255,255,255,0.45)' : 'rgba(17,24,39,0.35)',
    inputBg: dark ? theme.cardBg : '#FFFFFF',
    inputBorder: theme.border,
    selectedBg: theme.primary,
    unselectedBg: dark ? theme.backgroundSecondary : theme.tokens.primary50,
    panelBg: dark ? theme.backgroundSecondary : 'rgba(255,255,255,0.55)',
    toggleInactiveBg: dark ? theme.backgroundSecondary : 'rgba(17,24,39,0.04)',
    tableHeaderBg: dark ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.04)',
    rowBorder: dark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.08)',
    headerBorder: dark ? 'rgba(255,255,255,0.12)' : 'rgba(17,24,39,0.15)',
    colDivider: dark ? 'rgba(255,255,255,0.12)' : 'rgba(17,24,39,0.12)',
    modalBg: theme.cardBg,
    btnPrimaryBg: theme.primary,
    btnDarkBg: theme.tokens.primary700,
    stroke: dark ? '#FFFFFF' : '#111827',
    searchIcon: dark ? 'rgba(255,255,255,0.55)' : 'rgba(17,24,39,0.45)',
    subtextFaded: dark ? 'rgba(255,255,255,0.75)' : 'rgba(17,24,39,0.65)',
    success: theme.success,
    error: theme.error,
  };
}

export type UiColors = ReturnType<typeof getUiColors>;
