import React from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';

export type SubTabOption<T extends string> = { id: T; label: string };

type Props<T extends string> = {
  options: SubTabOption<T>[];
  value: T;
  onChange: (id: T) => void;
};

export function SubTabs<T extends string>({ options, value, onChange }: Props<T>) {
  const { theme } = useTheme();
  const t = theme.tokens;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
        Platform.OS === 'web' ? ({ boxShadow: t.shadowSm } as object) : undefined,
      ]}
      accessibilityRole="tablist"
    >
      {options.map((opt) => {
        const active = opt.id === value;
        if (active) {
          return (
            <PressableScale
              key={opt.id}
              onPress={() => onChange(opt.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: true }}
              style={styles.btnWrap}
            >
              <LinearGradient
                colors={[...t.gradientPrimaryBtn]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.btn,
                  Platform.OS === 'web'
                    ? ({ boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)' } as object)
                    : undefined,
                ]}
              >
                <Text style={styles.btnTextActive}>{opt.label}</Text>
              </LinearGradient>
            </PressableScale>
          );
        }
        return (
          <PressableScale
            key={opt.id}
            onPress={() => onChange(opt.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: false }}
            style={[styles.btn, styles.btnInactive]}
          >
            <Text style={[styles.btnText, { color: theme.textMuted }]}>{opt.label}</Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginBottom: 16 },
  container: {
    flexDirection: 'row',
    gap: 6,
    padding: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  btnWrap: { borderRadius: 10 },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    minHeight: 40,
    justifyContent: 'center',
  },
  btnInactive: {
    backgroundColor: 'transparent',
  },
  btnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  btnTextActive: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
