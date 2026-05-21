import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export type PillOption<T extends string> = { id: T; label: string };

type Props<T extends string> = {
  options: PillOption<T>[];
  value: T;
  onChange: (id: T) => void;
};

export function PillTabs<T extends string>({ options, value, onChange }: Props<T>) {
  const { theme } = useTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: theme.backgroundSecondary, borderColor: theme.borderSubtle }]}>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => onChange(opt.id)}
            activeOpacity={0.7}
            style={[
              styles.pill,
              active && { backgroundColor: theme.cardBg, borderColor: theme.borderMuted },
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: active ? theme.text : theme.textSecondary },
                active && styles.labelActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  pill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  labelActive: {
    fontWeight: '700',
  },
});
