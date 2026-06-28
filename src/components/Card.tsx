import React from 'react';
import { View, ViewStyle, Platform, StyleSheet } from 'react-native';
import { PressableScale } from './premium/PressableScale';
import { useTheme } from '../contexts/ThemeContext';
import { getMobileAppGlass } from './mobile/mobileAppTheme';
import { isNativeMobileApp } from './mobile/MobileScreenScaffold';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  noPadding?: boolean;
  elevated?: boolean;
  /** Legado — ignorado; mantido para compatibilidade de props. */
  glass?: boolean;
}

export function Card({ children, style, onPress, noPadding, elevated }: CardProps) {
  const { theme } = useTheme();
  const t = theme.tokens;
  const glass = getMobileAppGlass(theme);
  const useGlass = isNativeMobileApp();

  const cardStyle = [
    styles.card,
    {
      backgroundColor: useGlass ? glass.bg : theme.surface,
      borderColor: useGlass ? glass.border : theme.border,
      padding: noPadding ? 0 : useGlass ? 16 : 18,
      borderRadius: useGlass ? t.radiusLg + 2 : t.radiusLg,
    },
    elevated &&
      (Platform.OS === 'web'
        ? ({ boxShadow: t.shadowCard, transition: 'box-shadow 0.18s ease, transform 0.15s ease' } as object)
        : {
            elevation: useGlass ? 8 : 3,
            shadowColor: '#0f172a',
            shadowOffset: { width: 0, height: useGlass ? 10 : 4 },
            shadowOpacity: useGlass ? 0.1 : 0.06,
            shadowRadius: useGlass ? 18 : 8,
          }),
    style,
  ];

  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={cardStyle}>
        {children}
      </PressableScale>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
});
