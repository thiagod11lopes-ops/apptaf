import React from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { useDeviceLayout } from '../../hooks/useDeviceLayout';
import { getMobileAppGlass } from '../mobile/mobileAppTheme';
import { isNativeMobileApp } from '../mobile/MobileScreenScaffold';

type Props = {
  label: string;
  value: string | number;
  variant?: 'default' | 'positive' | 'negative' | 'primary' | 'warning';
  /** Quando definido, o card fica clicável. */
  onPress?: () => void;
  /** Preenche a altura do container (ex.: coluna lateral). */
  stretch?: boolean;
  accessibilityLabel?: string;
};

export function StatCard({
  label,
  value,
  variant = 'default',
  onPress,
  stretch = false,
  accessibilityLabel,
}: Props) {
  const { theme } = useTheme();
  const { usePhoneFrame, width } = useDeviceLayout();
  const compactGrid = usePhoneFrame || width < 420;
  const t = theme.tokens;
  const glass = getMobileAppGlass(theme);
  const useGlass = isNativeMobileApp();
  const valueColor =
    variant === 'positive'
      ? theme.success
      : variant === 'negative'
        ? theme.error
        : variant === 'primary'
          ? theme.primary
          : variant === 'warning'
            ? t.warning500
            : theme.text;

  const accentColors: [string, string] =
    variant === 'positive'
      ? ['#059669', '#14b8a6']
      : variant === 'negative'
        ? ['#dc2626', '#f87171']
        : variant === 'warning'
          ? ['#d97706', '#fbbf24']
          : variant === 'primary'
            ? ['#2563eb', '#38bdf8']
            : ['#64748b', '#94a3b8'];

  const body = (
    <>
      {useGlass ? (
        <LinearGradient colors={accentColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.stripe} />
      ) : null}
      <View style={[styles.content, stretch && styles.contentStretch]}>
        <Text
          style={[
            styles.label,
            compactGrid && !stretch && styles.labelCompact,
            stretch && styles.labelStretch,
            { color: theme.textMuted },
          ]}
          numberOfLines={stretch ? 2 : 1}
          adjustsFontSizeToFit={!stretch}
          minimumFontScale={0.7}
        >
          {label}
        </Text>
        <Text
          style={[
            styles.value,
            compactGrid && !stretch && styles.valueCompact,
            stretch && styles.valueStretch,
            { color: valueColor },
          ]}
        >
          {value}
        </Text>
      </View>
    </>
  );

  const cardStyle = [
    styles.card,
    compactGrid ? styles.cardCompact : styles.cardRegular,
    stretch && styles.cardStretch,
    {
      backgroundColor: useGlass ? glass.bg : theme.surface,
      borderColor: useGlass ? glass.border : theme.border,
    },
    Platform.OS === 'web'
      ? ({ boxShadow: t.shadowCard } as object)
      : {
          elevation: useGlass ? 6 : 2,
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: useGlass ? 8 : 3 },
          shadowOpacity: useGlass ? 0.12 : 0.06,
          shadowRadius: useGlass ? 16 : 6,
        },
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        onPress={onPress}
        style={({ pressed }) => [cardStyle, pressed && styles.cardPressed]}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{body}</View>;
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardStretch: {
    height: '100%',
    justifyContent: 'center',
  },
  cardPressed: {
    opacity: 0.88,
  },
  stripe: {
    height: 1,
    width: '100%',
  },
  content: {
    gap: 2,
  },
  contentStretch: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  cardRegular: {
    padding: 10,
  },
  cardCompact: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  labelStretch: {
    fontSize: 10,
    letterSpacing: 0.55,
    lineHeight: 13,
    textAlign: 'center',
  },
  valueStretch: {
    fontSize: 26,
    lineHeight: 30,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    lineHeight: 12,
  },
  labelCompact: {
    fontSize: 8,
    letterSpacing: 0.2,
    lineHeight: 10,
  },
  value: {
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: 18,
  },
  valueCompact: {
    fontSize: 13,
    lineHeight: 15,
  },
});
