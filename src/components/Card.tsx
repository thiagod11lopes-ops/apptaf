import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  noPadding?: boolean;
  /** Visual "vidro"/desfoque (compatível com web via backdrop-filter). */
  glass?: boolean;
}

export function Card({ children, style, onPress, noPadding, glass }: CardProps) {
  const { theme } = useTheme();
  const cardStyle = [
    styles.card,
    glass ? styles.cardGlass : null,
    {
      // Tom igual ao "glass" do Menu da Home (mesmo blur/opacity).
      backgroundColor: glass ? 'rgba(255, 255, 255, 0.42)' : theme.cardBg,
      borderColor: glass ? 'rgba(255, 255, 255, 0.7)' : theme.border,
      padding: noPadding ? 0 : 16,
    },
    style,
  ];
  if (onPress) {
    return <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={cardStyle}>{children}</TouchableOpacity>;
  }
  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
      default: { elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
    }),
  },
  cardGlass: Platform.select({
    web: {
      backdropFilter: 'blur(0.84px)',
      WebkitBackdropFilter: 'blur(0.84px)',
      boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
    } as any,
    default: {},
  }),
});
