import { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getUiColors, type UiColors } from '../theme/uiColors';

export function useUiColors(): UiColors {
  const { theme } = useTheme();
  return useMemo(() => getUiColors(theme), [theme]);
}
