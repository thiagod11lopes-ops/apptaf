import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  /** Visual "vidro"/desfoque (compatível com web via backdrop-filter). */
  glass?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
  glass = false,
}: ButtonProps) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;
  const bg =
    glass
      ? variant === 'outline'
        ? 'transparent'
        : 'rgba(255, 255, 255, 0.18)'
      : variant === 'primary'
        ? theme.primary
        : variant === 'outline'
          ? 'transparent'
          : theme.backgroundSecondary;

  const borderWidth = glass ? 1 : variant === 'outline' ? 2 : 0;
  const borderColor = glass ? 'rgba(255, 255, 255, 0.45)' : variant === 'outline' ? theme.primary : 'transparent';
  const textColor = glass ? '#FFFFFF' : variant === 'primary' ? '#FFF' : theme.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[
        styles.btn,
        { backgroundColor: bg, borderWidth, borderColor },
        glass && Platform.OS === 'web'
          ? ({
              backdropFilter: 'blur(0.84px)',
              WebkitBackdropFilter: 'blur(0.84px)',
            } as any)
          : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[styles.text, { color: textColor }, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  text: { fontSize: 16, fontWeight: '600' },
});
