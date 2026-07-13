import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ShieldAlert, X } from 'lucide-react-native';
import { AppModal } from './premium/AppModal';
import { useTheme } from '../contexts/ThemeContext';
import { getUiColors } from '../theme/uiColors';
import {
  FATORES_RISCO_ITENS,
  type FatoresRiscoRegistro,
} from '../services/fatoresRiscoStorage';
import { classificarImc } from '../utils/imcFatoresRisco';
import { formatNipInput } from '../utils/nipFormat';
import { FATORES_RISCO_LARANJA } from './taf/aplicar/FatoresRiscoInfoModal';

type Props = {
  visible: boolean;
  nome: string;
  nip: string;
  registro: FatoresRiscoRegistro | null;
  onClose: () => void;
};

/** Modal com o cadastro completo de fatores de risco do militar (planilha de Cadastro). */
export function FatoresRiscoCadastroModal({ visible, nome, nip, registro, onClose }: Props) {
  const { theme } = useTheme();
  const ui = getUiColors(theme);
  const ts = theme.textStyles;

  const imcInfo = useMemo(() => {
    if (registro?.imc == null || !Number.isFinite(registro.imc)) return null;
    const classificacao = classificarImc(registro.imc);
    return {
      valor: registro.imc.toFixed(1).replace('.', ','),
      classificacao,
    };
  }, [registro?.imc]);

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.isDark ? 'rgba(139,92,246,0.4)' : 'rgba(139,92,246,0.28)',
            },
          ]}
        >
          <View style={styles.header}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: theme.isDark ? 'rgba(139,92,246,0.2)' : 'rgba(237,233,254,0.9)',
                },
              ]}
            >
              <ShieldAlert size={22} color="#8b5cf6" strokeWidth={2.4} />
            </View>
            <View style={styles.headerText}>
              <Text style={[ts.caption, styles.kicker, { color: '#8b5cf6' }]}>SAÚDE</Text>
              <Text style={[styles.title, { color: ui.text }]} numberOfLines={2}>
                Fatores de Risco
              </Text>
              <Text style={[ts.caption, { color: theme.textSecondary }]} numberOfLines={1}>
                {nome || 'Militar'}
                {nip ? ` · NIP ${formatNipInput(nip)}` : ''}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Fechar"
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.lista} nestedScrollEnabled>
            {!registro ? (
              <Text style={[ts.body, { color: theme.textMuted }]}>
                Nenhum fator de risco cadastrado para este militar.
              </Text>
            ) : (
              <>
                {FATORES_RISCO_ITENS.map((item) => {
                  const resp = registro.respostas[item.id];
                  const isSim = resp === 'sim';
                  const isNao = resp === 'nao';
                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.item,
                        {
                          borderColor: glassBorder(theme.isDark, isSim),
                          backgroundColor: isSim
                            ? theme.isDark
                              ? 'rgba(234,88,12,0.12)'
                              : 'rgba(255,247,237,0.95)'
                            : theme.isDark
                              ? 'rgba(2,6,23,0.35)'
                              : 'rgba(248,250,252,0.9)',
                        },
                      ]}
                    >
                      <Text style={[styles.itemLabel, { color: ui.text }]}>{item.label}</Text>
                      <Text
                        style={[
                          styles.itemValue,
                          {
                            color: isSim
                              ? FATORES_RISCO_LARANJA
                              : isNao
                                ? theme.textSecondary
                                : theme.textMuted,
                          },
                        ]}
                      >
                        {isSim ? 'Sim' : isNao ? 'Não' : '—'}
                      </Text>
                    </View>
                  );
                })}

                <View style={[styles.imcBox, { borderColor: theme.border }]}>
                  <Text style={[ts.caption, styles.imcTitle, { color: theme.textMuted }]}>
                    ANTROPOMETRIA / IMC
                  </Text>
                  <Text style={[styles.imcLine, { color: ui.text }]}>
                    Altura: {registro.altura?.trim() || '—'}
                  </Text>
                  <Text style={[styles.imcLine, { color: ui.text }]}>
                    Peso: {registro.peso?.trim() ? `${registro.peso.trim()} kg` : '—'}
                  </Text>
                  {imcInfo ? (
                    <>
                      <Text style={[styles.imcValor, { color: imcInfo.classificacao.corHex }]}>
                        IMC {imcInfo.valor} — {imcInfo.classificacao.titulo}
                      </Text>
                      <Text style={[ts.caption, { color: theme.textSecondary, marginTop: 4 }]}>
                        {imcInfo.classificacao.descricao}
                      </Text>
                    </>
                  ) : (
                    <Text style={[ts.caption, { color: theme.textMuted, marginTop: 4 }]}>
                      IMC não informado.
                    </Text>
                  )}
                </View>
              </>
            )}
          </ScrollView>

          <TouchableOpacity
            accessibilityLabel="Fechar fatores de risco"
            onPress={onClose}
            activeOpacity={0.88}
            style={[styles.okBtn, { backgroundColor: '#8b5cf6' }]}
          >
            <Text style={styles.okBtnText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AppModal>
  );
}

function glassBorder(isDark: boolean, isSim: boolean): string {
  if (isSim) return isDark ? 'rgba(234,88,12,0.4)' : 'rgba(234,88,12,0.28)';
  return isDark ? 'rgba(148,163,184,0.22)' : 'rgba(148,163,184,0.35)';
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '88%',
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  kicker: {
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  closeBtn: {
    padding: 4,
  },
  lista: {
    maxHeight: 420,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  itemLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  itemValue: {
    fontSize: 14,
    fontWeight: '900',
  },
  imcBox: {
    marginTop: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  imcTitle: {
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  imcLine: {
    fontSize: 14,
    fontWeight: '600',
  },
  imcValor: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '900',
  },
  okBtn: {
    marginTop: 12,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
