import React from 'react';
import { View, ViewStyle, Platform, StyleSheet } from 'react-native';
import { PressableScale } from './premium/PressableScale';
import { useTheme } from '../contexts/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  className?: string;
  onPress?: () => void;
  noPadding?: boolean;
  glass?: boolean;
  elevated?: boolean;
}

export function Card({
  children,
  style,
  onPress,
  noPadding,
  elevated,
}: CardProps) {
  const { theme, isDark } = useTheme();
  const cardStyle = [
    styles.card,
    {
      backgroundColor: isDark ? 'rgba(24, 24, 27, 0.85)' : 'rgba(255, 255, 255, 0.9)',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
      padding: noPadding ? 0 : 16,
    },
    elevated && styles.elevated,
    style,
    Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        } as object)
      : undefined,
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
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 0,
  },
  elevated: {
    borderRadius: 20,
    ...Platform.select({
      web: { boxShadow: '0 8px 32px rgba(0,0,0,0.12)' } as object,
      default: { elevation: 4 },
    }),
  },
});
