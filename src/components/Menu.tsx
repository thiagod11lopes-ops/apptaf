import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { FINTECH } from '../theme/fintech';

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
  const { theme } = useTheme();
  if (!visible) return null;
  return (
    <View style={styles.wrap}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.id}
          onPress={opt.onPress}
          activeOpacity={0.7}
          style={[
            styles.item,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.borderSubtle,
            },
          ]}
        >
          <View style={styles.textBlock}>
            <Text style={[styles.title, { color: theme.text }]}>{opt.title}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{opt.subtitle}</Text>
          </View>
          <ChevronRight size={20} color={theme.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: FINTECH.radiusLg,
    borderWidth: 1,
    ...Platform.select({
      web: { transition: 'background-color 150ms ease' } as object,
      default: {},
    }),
  },
  textBlock: { flex: 1, paddingRight: 8 },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});
