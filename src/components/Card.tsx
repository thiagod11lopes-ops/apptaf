import React from 'react';
import { View, ViewStyle, Platform, StyleSheet } from 'react-native';
import { PressableScale } from './premium/PressableScale';
import { useTheme } from '../contexts/ThemeContext';
import { PREMIUM } from '../theme/premium';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  noPadding?: boolean;
  elevated?: boolean;
}

export function Card({ children, style, onPress, noPadding, elevated }: CardProps) {
  const { theme } = useTheme();
  const cardStyle = [
    styles.card,
    {
      backgroundColor: theme.cardBg,
      borderColor: theme.border,
      padding: noPadding ? 0 : 18,
    },
    elevated && styles.elevated,
    elevated && theme.isDark && styles.elevatedDark,
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
    borderRadius: PREMIUM.radiusLg,
    borderWidth: 1,
  },
  elevated: {
    borderRadius: PREMIUM.radiusXl,
    ...Platform.select({
      web: { boxShadow: '0 4px 24px rgba(15, 23, 42, 0.08)' } as object,
      default: { elevation: 3 },
    }),
  },
  elevatedDark: Platform.select({
    web: { boxShadow: '0 8px 28px rgba(0, 0, 0, 0.35)' } as object,
    default: { elevation: 6 },
  }),
});
