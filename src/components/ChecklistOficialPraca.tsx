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
  /** Ajusta o visual para o estilo "glass" (mesma aparência da Home). */
  glass?: boolean;
}

export function ChecklistOficialPraca({ value, onValueChange, filterMode, glass = false }: ChecklistOficialPracaProps) {
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
              {
                borderColor: glass ? 'rgba(255, 255, 255, 0.7)' : theme.border,
                backgroundColor: selected
                  ? theme.primary
                  : glass
                    ? 'rgba(255, 255, 255, 0.18)'
                    : theme.cardBg,
              },
            ]}
            onPress={() => onValueChange(opt)}
            activeOpacity={0.8}
          >
            {(opt === 'Praça' || opt === 'Pç') ? (
              <RotuloPracaSvg color={selected ? '#FFF' : glass ? '#FFFFFF' : theme.text} />
            ) : (
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? '#FFF' : glass ? '#FFFFFF' : theme.text },
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
