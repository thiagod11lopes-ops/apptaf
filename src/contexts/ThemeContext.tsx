import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { buildPremiumDarkTheme, buildPremiumLightTheme, type AppTheme } from '../theme/premium';

export type Theme = AppTheme;

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(true);
  const theme = useMemo(() => (isDark ? buildPremiumDarkTheme() : buildPremiumLightTheme()), [isDark]);
  const value = useMemo(
    () => ({ theme, isDark, toggleTheme: () => setIsDark((d) => !d) }),
    [theme, isDark],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
