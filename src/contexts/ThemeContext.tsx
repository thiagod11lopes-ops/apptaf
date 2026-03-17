import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { COLORS } from '../theme/colors';

type Theme = {
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
};

const lightTheme: Theme = {
  primary: COLORS.primary,
  background: COLORS.background,
  cardBg: COLORS.cardBg,
  text: COLORS.text,
  textSecondary: COLORS.textSecondary,
  border: COLORS.border,
  error: COLORS.error,
  success: COLORS.success,
  shadow: COLORS.shadow,
  gradient: COLORS.gradient,
  backgroundSecondary: '#EBEEF2',
  surface: COLORS.cardBg,
};

const darkTheme: Theme = {
  primary: COLORS.primary,
  background: COLORS.backgroundDark,
  cardBg: COLORS.cardBgDark,
  text: COLORS.textDark,
  textSecondary: COLORS.textSecondaryDark,
  border: COLORS.borderDark,
  error: COLORS.error,
  success: COLORS.success,
  shadow: COLORS.shadow,
  gradient: COLORS.gradientDark,
  backgroundSecondary: '#2A2A2A',
  surface: COLORS.cardBgDark,
};

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const theme = useMemo(() => (isDark ? darkTheme : lightTheme), [isDark]);
  const value = useMemo(
    () => ({ theme, isDark, toggleTheme: () => setIsDark((d) => !d) }),
    [theme, isDark]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
