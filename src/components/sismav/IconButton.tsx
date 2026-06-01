import React from 'react';
import { StyleSheet, ViewStyle, Platform } from 'react-native';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  onPress: () => void;
  children: React.ReactNode;
  variant?: 'default' | 'edit' | 'danger';
  accessibilityLabel: string;
  style?: ViewStyle;
};

export function IconButton({
  onPress,
  children,
  variant = 'default',
  accessibilityLabel,
  style,
}: Props) {
  const { theme } = useTheme();
  const t = theme.tokens;

  const bg =
    variant === 'edit'
      ? 'rgba(245, 158, 11, 0.15)'
      : variant === 'danger'
        ? 'rgba(220, 38, 38, 0.12)'
        : theme.surface;

  const border =
    variant === 'edit' ? t.warning500 : variant === 'danger' ? t.danger : theme.border;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.btn,
        {
          backgroundColor: bg,
          borderColor: border,
        },
        Platform.OS === 'web' ? ({ boxShadow: t.shadowSm } as object) : { elevation: 2 },
        style,
      ]}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
