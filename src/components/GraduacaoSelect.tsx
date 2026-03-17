import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { GRADUACOES, type Graduacao } from '../constants/graduacoes';
import { LabelGradSO } from './LabelGradSO';
import { normalizeSO } from '../utils/displayNormalize';

interface GraduacaoSelectProps {
  value: Graduacao | '';
  onValueChange: (v: Graduacao | '') => void;
  filterMode?: boolean;
}

export function GraduacaoSelect({ value, onValueChange, filterMode }: GraduacaoSelectProps) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const options: (Graduacao | '')[] = filterMode ? ['', ...GRADUACOES] : [...GRADUACOES];
  const label = value === '' && filterMode ? 'Todos' : normalizeSO(value || '') || (filterMode ? 'Todos' : 'Selecione');
  const showSO = label === 'SO';

  return (
    <View>
      <TouchableOpacity
        style={[styles.trigger, { borderColor: theme.border, backgroundColor: theme.cardBg }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        {showSO ? <LabelGradSO /> : <Text style={[styles.triggerText, { color: theme.text }]} numberOfLines={1}>{label}</Text>}
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={[styles.modalBox, { backgroundColor: theme.cardBg }]}>
            <FlatList
              data={options}
              keyExtractor={(item) => item || '__all__'}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, value === item && { backgroundColor: theme.backgroundSecondary }]}
                  onPress={() => {
                    onValueChange(item);
                    setOpen(false);
                  }}
                >
                  {normalizeSO(item || '') === 'SO' ? (
                    <LabelGradSO />
                  ) : (
                    <Text style={[styles.optionText, { color: theme.text }]}>
                      {item === '' ? 'Todos' : normalizeSO(item)}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: 'center',
  },
  triggerText: { fontSize: 16, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 320,
    maxHeight: 360,
    borderRadius: 12,
    overflow: 'hidden',
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  optionText: { fontSize: 16, fontWeight: '700' },
});
