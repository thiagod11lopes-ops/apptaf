import React from 'react';
import { View, ViewStyle, Platform } from 'react-native';
import { PressableScale } from './premium/PressableScale';
import { tw } from '../theme/premium';

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
  className = '',
  onPress,
  noPadding,
  glass,
  elevated,
}: CardProps) {
  const base = elevated ? tw.glassCardLg : glass ? tw.glassCard : tw.glassCard;
  const pad = noPadding ? '' : ' p-4';

  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        className={`${base}${pad} ${className}`}
        style={[
          style,
          Platform.OS === 'web'
            ? ({ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } as object)
            : undefined,
        ]}
      >
        {children}
      </PressableScale>
    );
  }

  return (
    <View
      className={`${base}${pad} ${className}`}
      style={[
        style,
        Platform.OS === 'web'
          ? ({ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } as object)
          : undefined,
      ]}
    >
      {children}
    </View>
  );
}
