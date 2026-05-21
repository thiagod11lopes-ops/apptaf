import React from 'react';
import { Text, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { PressableScale } from './premium/PressableScale';
import { tw } from '../theme/premium';
import { useTheme } from '../contexts/ThemeContext';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  className?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
  className = '',
}: ButtonProps) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;

  const variantClass =
    variant === 'primary'
      ? tw.btnPrimary
      : variant === 'outline' || variant === 'ghost'
        ? tw.btnGhost
        : `${tw.btnGhost} bg-zinc-100 dark:bg-zinc-800/50`;

  const textClass =
    variant === 'primary'
      ? 'text-white font-semibold text-[15px]'
      : 'text-zinc-900 dark:text-zinc-100 font-semibold text-[15px]';

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      className={`${variantClass} ${className} ${isDisabled ? 'opacity-45' : ''}`}
      style={style}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFF' : theme.primary} size="small" />
      ) : (
        <Text className={textClass} style={textStyle}>
          {title}
        </Text>
      )}
    </PressableScale>
  );
}
