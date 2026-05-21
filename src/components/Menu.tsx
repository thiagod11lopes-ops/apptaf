import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { PressableScale } from './premium/PressableScale';
import { useTheme } from '../contexts/ThemeContext';

interface MenuOption {
  id: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

interface Props {
  options: MenuOption[];
  visible?: boolean;
}

export function Menu({ options, visible = true }: Props) {
  const { theme, isDark } = useTheme();
  if (!visible) return null;

  return (
    <View style={styles.wrap}>
      {options.map((opt) => (
        <PressableScale
          key={opt.id}
          onPress={opt.onPress}
          style={[
            styles.item,
            {
              backgroundColor: isDark ? 'rgba(24, 24, 27, 0.85)' : 'rgba(255, 255, 255, 0.9)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            },
          ]}
        >
          <View style={styles.textBlock}>
            <Text style={[styles.title, { color: theme.text }]}>{opt.title}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{opt.subtitle}</Text>
          </View>
          <ChevronRight size={20} color={theme.textMuted} strokeWidth={2} />
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  textBlock: { flex: 1, paddingRight: 8 },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
});
