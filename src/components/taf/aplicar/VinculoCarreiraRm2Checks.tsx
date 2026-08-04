import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../../../contexts/ThemeContext';

export type VinculoMilitar = 'carreira' | 'rm2';

type Props = {
  value: VinculoMilitar | null;
  onChange: (next: VinculoMilitar | null) => void;
  /** Empilha verticalmente (padrão) ou em linha. */
  horizontal?: boolean;
};

/**
 * Checklists exclusivos Carreira / RM2 (mesmo padrão do formulário Realizar Cadastro).
 */
export function VinculoCarreiraRm2Checks({ value, onChange, horizontal = false }: Props) {
  const { theme } = useTheme();

  return (
    <View style={[styles.wrap, horizontal ? styles.wrapHorizontal : null]}>
      {(
        [
          { id: 'carreira' as const, label: 'Carreira' },
          { id: 'rm2' as const, label: 'RM2' },
        ] as const
      ).map((opt) => {
        const active = value === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => onChange(active ? null : opt.id)}
            style={styles.opt}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={opt.label}
          >
            <View
              style={[
                styles.check,
                {
                  borderColor: active ? theme.primary : theme.border,
                  backgroundColor: active
                    ? theme.primary
                    : theme.isDark
                      ? 'rgba(2,6,23,0.35)'
                      : '#fff',
                },
              ]}
            >
              {active ? <Check size={12} color="#fff" strokeWidth={3} /> : null}
            </View>
            <Text
              style={{
                color: active ? theme.primary : theme.textSecondary,
                fontWeight: '800',
                fontSize: 12,
              }}
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
    gap: 8,
    justifyContent: 'center',
  },
  wrapHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  check: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
