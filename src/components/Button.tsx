import React from 'react';
import { Text, ActivityIndicator, ViewStyle, TextStyle, StyleSheet, View, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale } from './premium/PressableScale';
import { useTheme } from '../contexts/ThemeContext';
import { fontFamily } from '../theme/typography';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
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
  const t = theme.tokens;

  const textColor =
    variant === 'primary' || variant === 'danger'
      ? t.textOnPrimary
      : variant === 'ghost'
        ? theme.primary
        : theme.text;

  const content = loading ? (
    <ActivityIndicator color={textColor} size="small" />
  ) : (
    <Text style={[styles.text, { color: textColor, fontFamily: font }, textStyle]}>{title}</Text>
  );

  if (variant === 'primary' || variant === 'danger') {
    const colors = variant === 'danger' ? t.gradientDangerBtn : t.gradientPrimaryBtn;
    return (
      <PressableScale
        onPress={onPress}
        disabled={isDisabled}
        style={[styles.outer, { opacity: isDisabled ? 0.55 : 1 }, style]}
      >
        <LinearGradient
          colors={[...colors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.btn,
            Platform.OS === 'web'
              ? ({
                  boxShadow:
                    variant === 'danger'
                      ? '0 4px 12px rgba(220, 38, 38, 0.35)'
                      : '0 4px 12px rgba(37, 99, 235, 0.35)',
                } as object)
              : undefined,
          ]}
        >
          {content}
        </LinearGradient>
      </PressableScale>
    );
  }

  const bg =
    variant === 'secondary' || variant === 'outline' ? theme.surface : 'transparent';
  const borderWidth = variant === 'outline' || variant === 'secondary' ? 1 : 0;
  const borderColor = theme.border;

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.btn,
        styles.outer,
        {
          backgroundColor: bg,
          borderWidth,
          borderColor,
          opacity: isDisabled ? 0.55 : 1,
        },
        variant === 'ghost' && Platform.OS === 'web' && ({ cursor: 'pointer' } as object),
        style,
      ]}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  text: { fontSize: 15, letterSpacing: 0.2 },
});
