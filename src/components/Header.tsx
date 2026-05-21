import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { PressableScale } from './premium/PressableScale';
import { PREMIUM } from '../theme/premium';

interface Props {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function Header({ title, onBack, right }: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: theme.backgroundSecondary,
          borderBottomColor: theme.border,
        },
      ]}
    >
      {onBack ? (
        <PressableScale onPress={onBack} style={styles.backBtn} accessibilityLabel="Voltar">
          <View style={[styles.backCircle, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <ChevronLeft size={20} color={theme.text} strokeWidth={2.5} />
          </View>
        </PressableScale>
      ) : (
        <View style={styles.backPlaceholder} />
      )}
      <Text style={[ts.h2, styles.titleCenter]} numberOfLines={1}>
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
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'web' ? 14 : 48,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPlaceholder: { width: 48 },
  titleCenter: { flex: 1, textAlign: 'center' },
  right: {
    minWidth: 48,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
