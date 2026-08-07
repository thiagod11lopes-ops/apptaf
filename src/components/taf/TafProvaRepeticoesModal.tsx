import React, { useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { AppModal } from '../premium/AppModal';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trash2 } from 'lucide-react-native';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import { PREMIUM } from '../../theme/premium';
import { getAplicarTafBackdrop, getAplicarTafGlass } from './aplicar/aplicarTafTheme';
import { useAplicarTafLayout } from './aplicar/useAplicarTafLayout';
import { LogombWatermark } from '../mobile/LogombWatermark';
import { formatNipInput } from '../../utils/nipFormat';

export type TafProvaRepeticoesModalProps = {
  visible: boolean;
  onClose: () => void;
  tituloProva: string;
  nParticipantes: number;
  nomesParticipantes: string[];
  nipsParticipantes?: string[];
  participantesComFatorRisco?: boolean[];
  onPressNomeParticipante?: (index: number) => void;
  onDoublePressNomeParticipante?: (index: number) => void;
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
  nipsParticipantes = [],
  participantesComFatorRisco = [],
  onPressNomeParticipante,
  onDoublePressNomeParticipante,
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
  const { isNarrowPhone, isLandscape } = useAplicarTafLayout();
  const ultimoToqueNomeRef = useRef<{ index: number; at: number } | null>(null);
  const singlePressNomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onPressNomeComDuplo = useCallback(
    (index: number) => {
      const agora = Date.now();
      const ultimo = ultimoToqueNomeRef.current;
      if (ultimo && ultimo.index === index && agora - ultimo.at < 320) {
        if (singlePressNomeTimerRef.current) {
          clearTimeout(singlePressNomeTimerRef.current);
          singlePressNomeTimerRef.current = null;
        }
        ultimoToqueNomeRef.current = null;
        onDoublePressNomeParticipante?.(index);
        return;
      }
      ultimoToqueNomeRef.current = { index, at: agora };
      if (singlePressNomeTimerRef.current) clearTimeout(singlePressNomeTimerRef.current);
      singlePressNomeTimerRef.current = setTimeout(() => {
        singlePressNomeTimerRef.current = null;
        if (participantesComFatorRisco[index] === true && onPressNomeParticipante) {
          onPressNomeParticipante(index);
        }
      }, 320);
    },
    [onDoublePressNomeParticipante, onPressNomeParticipante, participantesComFatorRisco],
  );

  const rows = useMemo(
    () => Array.from({ length: nParticipantes }, (_, i) => i),
    [nParticipantes],
  );

  return (
    <AppModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
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
            </View>

            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
              <View
                style={
                  isLandscape ? styles.rowsGridLandscape : styles.rowsStack
                }
              >
              {rows.map((index) => {
                const nome = nomesParticipantes[index] ?? `Militar ${index + 1}`;
                const nipExibicao = formatNipInput(nipsParticipantes[index] ?? '') || '—';
                const temFatorRisco = participantesComFatorRisco[index] === true;
                const nota = getNota(index);
                const reprov = isNotaReprovado(index);
                return (
                  <View
                    key={`rep-row-${index}`}
                    style={[
                      styles.row,
                      isLandscape ? styles.rowLandscape : null,
                      { borderColor: glass.border, backgroundColor: theme.cardBg },
                    ]}
                  >
                    <View style={styles.rowBody}>
                      <View style={styles.rowHead}>
                        <Text
                          accessibilityRole="button"
                          accessibilityHint="Toque duas vezes para excluir o participante da prova"
                          {...(Platform.OS === 'web'
                            ? ({
                                onClick: (e: { detail?: number }) => {
                                  if (e?.detail === 2) {
                                    onDoublePressNomeParticipante?.(index);
                                    return;
                                  }
                                  if (e?.detail === 1 && temFatorRisco && onPressNomeParticipante) {
                                    onPressNomeParticipante(index);
                                  }
                                },
                              } as object)
                            : {
                                onPress: () => onPressNomeComDuplo(index),
                              })}
                          style={[
                            styles.rowNome,
                            {
                              color: temFatorRisco ? '#ea580c' : ui.text,
                              textDecorationLine: temFatorRisco ? 'underline' : 'none',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {nome}
                        </Text>
                        <Text
                          style={[styles.rowNip, { color: theme.textMuted }]}
                          numberOfLines={1}
                          accessibilityLabel={`NIP ${nipExibicao}`}
                        >
                          {nipExibicao}
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
                    {onDoublePressNomeParticipante ? (
                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel={`Excluir participante ${index + 1} da prova`}
                        accessibilityHint="Abre confirmação para remover este militar da prova ativa"
                        onPress={() => onDoublePressNomeParticipante(index)}
                        style={styles.excluirParticipanteBtn}
                        hitSlop={6}
                      >
                        <View
                          style={[
                            styles.excluirParticipanteInner,
                            {
                              backgroundColor: theme.isDark
                                ? 'rgba(220,38,38,0.22)'
                                : 'rgba(254,226,226,0.95)',
                            },
                          ]}
                        >
                          <Trash2 size={16} color={theme.loss} strokeWidth={2.4} />
                        </View>
                      </PressableScale>
                    ) : null}
                    <View
                      style={[styles.rowNumSide, { backgroundColor: PREMIUM.accentMuted }]}
                      accessibilityLabel={`Participante ${index + 1}`}
                    >
                      <Text style={[styles.rowNumSideText, { color: theme.primary }]}>
                        {index + 1}
                      </Text>
                    </View>
                  </View>
                );
              })}
              </View>
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
    </AppModal>
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
  scroll: { paddingHorizontal: 18, paddingBottom: 12, gap: 10 },
  rowsStack: { gap: 10 },
  rowsGridLandscape: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderRadius: PREMIUM.radiusLg,
    paddingLeft: 12,
    paddingRight: 0,
    paddingVertical: 0,
    gap: 0,
    overflow: 'hidden',
  },
  rowLandscape: {
    width: '48.5%',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
    paddingVertical: 10,
    paddingRight: 8,
    justifyContent: 'center',
  },
  excluirParticipanteBtn: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 6,
    flexShrink: 0,
  },
  excluirParticipanteInner: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowHead: { flexDirection: 'column', alignItems: 'flex-start', gap: 2, minWidth: 0 },
  rowNumSide: {
    width: 32,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowNumSideText: { fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] },
  rowNome: { fontSize: 15, fontWeight: '800', lineHeight: 18, minWidth: 0 },
  rowNip: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 13,
    fontVariant: ['tabular-nums'],
    minWidth: 0,
  },
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
