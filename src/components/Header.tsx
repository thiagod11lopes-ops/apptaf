import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { ChevronLeft } from 'lucide-react-native';
import { FINTECH } from '../theme/fintech';

interface Props {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function Header({ title, onBack, right }: Props) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: theme.backgroundSecondary,
          borderBottomColor: theme.borderSubtle,
        },
      ]}
    >
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityLabel="Voltar">
          <ChevronLeft size={24} color={theme.text} strokeWidth={2.5} />
        </TouchableOpacity>
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
  backBtn: { padding: 8, marginRight: 2 },
  backPlaceholder: { width: 40 },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  right: {
    minWidth: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
