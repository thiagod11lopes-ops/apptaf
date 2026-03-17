import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { normalizePraça } from '../utils/displayNormalize';
import { RotuloPracaSvg } from './RotuloPracaSvg';
import type { CategoriaCadastro } from '../types/cadastro';

interface ChecklistOficialPracaProps {
  value: CategoriaCadastro | 'Todos' | null;
  onValueChange: (v: CategoriaCadastro | 'Todos') => void;
  filterMode?: boolean;
}

export function ChecklistOficialPraca({ value, onValueChange, filterMode }: ChecklistOficialPracaProps) {
  const { theme } = useTheme();
  const options: (CategoriaCadastro | 'Todos')[] = filterMode
    ? ['Todos', 'Oficial', 'Praça']
    : ['Oficial', 'Praça'];
  const current = value ?? (filterMode ? 'Todos' : 'Oficial');

  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const selected = current === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[
              styles.chip,
              { borderColor: theme.border, backgroundColor: selected ? theme.primary : theme.cardBg },
            ]}
            onPress={() => onValueChange(opt)}
            activeOpacity={0.8}
          >
            {(opt === 'Praça' || opt === 'Pç') ? (
              <RotuloPracaSvg color={selected ? '#FFF' : theme.text} />
            ) : (
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? '#FFF' : theme.text },
                ]}
              >
                {normalizePraça(opt)}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipText: { fontSize: 15, fontWeight: '600' },
});
