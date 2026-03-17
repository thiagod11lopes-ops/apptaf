import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { ChevronLeft } from 'lucide-react-native';

interface Props {
  title: string;
  onBack?: () => void;
}

export function Header({ title, onBack }: Props) {
  const { theme } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: theme.primary }]}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityLabel="Voltar">
          <ChevronLeft size={28} color="#FFF" strokeWidth={2.5} />
        </TouchableOpacity>
      ) : null}
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'web' ? 12 : 48,
    minHeight: 56,
  },
  backBtn: { padding: 8, marginRight: 4 },
  title: { flex: 1, color: '#FFF', fontSize: 20, fontWeight: '700' },
});
