import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import { PREMIUM } from '../../theme/premium';
import { getAplicarTafBackdrop, getAplicarTafGlass } from './aplicar/aplicarTafTheme';
import { useAplicarTafLayout } from './aplicar/useAplicarTafLayout';
import { LogombWatermark } from '../mobile/LogombWatermark';

export type TafProvaRepeticoesModalProps = {
  visible: boolean;
  onClose: () => void;
  tituloProva: string;
  nParticipantes: number;
  nomesParticipantes: string[];
  valores: string[];
  onChangeValor: (index: number, text: string) => void;
  getNota: (index: number) => string;
  isNotaReprovado: (index: number) => boolean;
  podeAplicar: boolean;
  onAplicar: () => void;
  salvando: boolean;
  hint?: string;
};

export function TafProvaRepeticoesModal({
  visible,
  onClose,
  tituloProva,
  nParticipantes,
  nomesParticipantes,
  valores,
  onChangeValor,
  getNota,
  isNotaReprovado,
  podeAplicar,
  onAplicar,
  salvando,
  hint,
}: TafProvaRepeticoesModalProps) {
  const { theme } = useTheme();
  const ui = getUiColors(theme);
  const glass = getAplicarTafGlass(theme);
  const backdropColors = getAplicarTafBackdrop(theme);
  const { isNarrowPhone } = useAplicarTafLayout();

  const rows = useMemo(
    () => Array.from({ length: nParticipantes }, (_, i) => i),
    [nParticipantes],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <LinearGradient colors={[...backdropColors]} style={styles.backdrop}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={[styles.sheet, { backgroundColor: glass.bg, borderColor: glass.border }]}>
            <View style={styles.header}>
              <View style={styles.headerTextCol}>
                <Text style={[styles.kicker, { color: theme.primary }]}>TAF NAVAL</Text>
                <Text style={[styles.title, { color: ui.text }]}>{tituloProva}</Text>
                {hint ? (
                  <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text>
                ) : null}
              </View>
              <TouchableOpacity accessibilityLabel="Fechar" onPress={onClose} style={styles.closeBtn}>
                <X size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
              {rows.map((index) => {
                const nome = nomesParticipantes[index] ?? `Militar ${index + 1}`;
                const nota = getNota(index);
                const reprov = isNotaReprovado(index);
                return (
                  <View
                    key={`rep-row-${index}`}
                    style={[styles.row, { borderColor: glass.border, backgroundColor: theme.cardBg }]}
                  >
                    <View style={styles.rowHead}>
                      <Text style={[styles.rowNum, { color: theme.primary }]}>#{index + 1}</Text>
                      <Text style={[styles.rowNome, { color: ui.text }]} numberOfLines={2}>
                        {nome}
                      </Text>
                    </View>
                    <View style={styles.rowFields}>
                      <View style={styles.inputWrap}>
                        <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Repetições</Text>
                        <TextInput
                          value={valores[index] ?? ''}
                          onChangeText={(t) => onChangeValor(index, t.replace(/\D/g, ''))}
                          placeholder="0"
                          placeholderTextColor={theme.textMuted}
                          keyboardType="number-pad"
                          inputMode="numeric"
                          style={[
                            styles.input,
                            {
                              borderColor: theme.border,
                              color: ui.text,
                              backgroundColor: theme.backgroundSecondary,
                            },
                          ]}
                          accessibilityLabel={`Repetições do participante ${index + 1}`}
                        />
                      </View>
                      <View style={styles.notaWrap}>
                        <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Nota</Text>
                        <Text
                          style={[
                            styles.notaValue,
                            { color: reprov ? theme.loss : nota !== '—' ? theme.gain : theme.textSecondary },
                          ]}
                        >
                          {nota}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                accessibilityLabel="Aplicar resultados"
                disabled={!podeAplicar || salvando}
                onPress={onAplicar}
                style={[
                  styles.applyBtn,
                  {
                    backgroundColor: podeAplicar ? theme.primary : theme.border,
                    opacity: !podeAplicar || salvando ? 0.65 : 1,
                  },
                ]}
              >
                {salvando ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.applyBtnText}>Aplicar resultados</Text>
                )}
              </TouchableOpacity>
            </View>
            {!isNarrowPhone ? <LogombWatermark /> : null}
          </View>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  safe: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    flex: 1,
    maxHeight: '94%',
    borderTopLeftRadius: PREMIUM.radiusLg + 8,
    borderTopRightRadius: PREMIUM.radiusLg + 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
    gap: 12,
  },
  headerTextCol: { flex: 1, minWidth: 0, gap: 4 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  hint: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  closeBtn: { padding: 6 },
  scroll: { paddingHorizontal: 18, paddingBottom: 12, gap: 10 },
  row: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusLg,
    padding: 14,
    gap: 10,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowNum: { fontSize: 14, fontWeight: '900', width: 28 },
  rowNome: { flex: 1, fontSize: 16, fontWeight: '800' },
  rowFields: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  inputWrap: { flex: 1, gap: 4 },
  notaWrap: { minWidth: 72, gap: 4, alignItems: 'center' },
  fieldLabel: { fontSize: 11, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 10 : 12,
    fontSize: 18,
    fontWeight: '800',
  },
  notaValue: { fontSize: 22, fontWeight: '900', paddingVertical: 8 },
  footer: { padding: 18, paddingTop: 8 },
  applyBtn: {
    borderRadius: PREMIUM.radiusLg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
