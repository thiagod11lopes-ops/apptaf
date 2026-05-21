import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { FINTECH } from '../theme/fintech';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'gain' | 'loss';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  compact?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
  compact,
}: ButtonProps) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;

  let bg = theme.primary;
  let borderColor = 'transparent';
  let textColor = '#FFFFFF';
  const borderWidth = variant === 'outline' || variant === 'ghost' ? 1 : 0;

  switch (variant) {
    case 'secondary':
      bg = theme.backgroundSecondary;
      textColor = theme.text;
      borderColor = theme.borderSubtle;
      break;
    case 'outline':
      bg = 'transparent';
      textColor = theme.text;
      borderColor = theme.borderMuted;
      break;
    case 'ghost':
      bg = 'transparent';
      textColor = theme.textSecondary;
      borderColor = theme.borderSubtle;
      break;
    case 'gain':
      bg = theme.gainMuted;
      textColor = theme.gain;
      borderColor = theme.gain;
      break;
    case 'loss':
      bg = theme.lossMuted;
      textColor = theme.loss;
      borderColor = theme.loss;
      break;
    default:
      break;
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[
        styles.btn,
        compact && styles.btnCompact,
        { backgroundColor: bg, borderWidth, borderColor, opacity: isDisabled ? 0.45 : 1 },
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
    paddingHorizontal: 20,
    borderRadius: FINTECH.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    ...Platform.select({
      web: { transition: 'opacity 150ms ease' } as object,
    }),
  },
  btnCompact: {
    minHeight: 40,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  text: { fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
});
