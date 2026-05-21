import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { PressableScale } from './premium/PressableScale';

interface Props {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function Header({ title, onBack, right }: Props) {
  const { theme, isDark } = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: isDark ? 'rgba(9, 9, 11, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        },
        Platform.OS === 'web'
          ? ({
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            } as object)
          : undefined,
      ]}
    >
      {onBack ? (
        <PressableScale onPress={onBack} style={styles.backBtn} accessibilityLabel="Voltar">
          <ChevronLeft size={22} color={theme.text} strokeWidth={2.5} />
        </PressableScale>
      ) : (
        <View style={styles.backPlaceholder} />
      )}
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    paddingTop: Platform.OS === 'web' ? 12 : 48,
    minHeight: 56,
    borderBottomWidth: 1,
  },
  backBtn: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  backPlaceholder: { width: 48 },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  right: {
    minWidth: 48,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
