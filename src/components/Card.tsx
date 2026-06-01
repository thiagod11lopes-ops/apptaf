import React from 'react';
import { View, ViewStyle, Platform, StyleSheet } from 'react-native';
import { PressableScale } from './premium/PressableScale';
import { useTheme } from '../contexts/ThemeContext';

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

  const cardStyle = [
    styles.card,
    {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      padding: noPadding ? 0 : 18,
      borderRadius: t.radiusLg,
    },
    elevated &&
      (Platform.OS === 'web'
        ? ({ boxShadow: t.shadowCard, transition: 'box-shadow 0.18s ease, transform 0.15s ease' } as object)
        : { elevation: 3 }),
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
