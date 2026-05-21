import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { FINTECH } from '../theme/fintech';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  noPadding?: boolean;
  glass?: boolean;
  /** Destaque tipo painel de trading */
  elevated?: boolean;
}

export function Card({ children, style, onPress, noPadding, glass, elevated }: CardProps) {
  const { theme } = useTheme();
  const cardStyle = [
    styles.card,
    {
      backgroundColor: glass
        ? 'rgba(17, 17, 19, 0.72)'
        : elevated
          ? theme.backgroundSecondary
          : theme.cardBg,
      borderColor: glass ? FINTECH.borderMuted : theme.borderSubtle,
      padding: noPadding ? 0 : 16,
    },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.75} onPress={onPress} style={cardStyle}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: FINTECH.radiusLg,
    borderWidth: 1,
    ...Platform.select({
      web: { boxShadow: '0 0 0 1px rgba(255,255,255,0.03)' },
      default: { elevation: 0 },
    }),
  },
});
