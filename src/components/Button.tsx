import React from 'react';
import { Text, ActivityIndicator, ViewStyle, TextStyle, StyleSheet } from 'react-native';
import { PressableScale } from './premium/PressableScale';
import { useTheme } from '../contexts/ThemeContext';
import { PREMIUM } from '../theme/premium';
import { fontFamily } from '../theme/typography';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
}: ButtonProps) {
  const { theme, fontsLoaded } = useTheme();
  const isDisabled = disabled || loading;
  const font = fontFamily('semibold', fontsLoaded);

  let bg = theme.primary;
  let borderColor = 'transparent';
  let textColor = '#FFFFFF';
  const borderWidth = variant === 'outline' || variant === 'ghost' ? 1 : 0;

  if (variant === 'secondary' || variant === 'outline' || variant === 'ghost') {
    bg = theme.cardBg;
    textColor = theme.text;
    borderColor = theme.border;
  }

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.btn,
        {
          backgroundColor: bg,
          borderWidth,
          borderColor,
          opacity: isDisabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[styles.text, { color: textColor, fontFamily: font }, textStyle]}>{title}</Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: PREMIUM.minTouch,
  },
  text: { fontSize: 15, letterSpacing: 0.2 },
});
