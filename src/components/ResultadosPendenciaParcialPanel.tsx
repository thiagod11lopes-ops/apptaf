import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Trash2 } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import { montarListaPendencias, type PendenciaTafItem, filtrarPendenciasParciais, montarListaPendenciasTotais } from '../utils/pendenciasTafHistorico';
import {
  CFN_CHIP_LABELS,
  montarListaPendenciasCfn,
  filtrarPendenciasParciaisCfn,
  montarListaPendenciasTotaisCfn,
  type PendenciaCfnItem,
} from '../utils/pendenciasTafCfnHistorico';
import { prepararDadosResultadosNorma, type NormaTafVista } from '../utils/normaTafResultados';
import { exportPendenciasTafPdf } from '../utils/exportPendenciasTafPdf';
import { PREMIUM } from '../theme/premium';
import { tableFullWidthStyle } from '../theme/tableLayout';
import { getUiColors } from '../theme/uiColors';
import { TafGlassPanel } from './mobile/TafTabChrome';
import { formatNomeComPostoParts } from '../utils/formatNomeComPosto';
import type { CadastroParaExcluir } from './sismav/ConfirmacaoExcluirCadastroModal';

function ChipModalidade({ label, ok }: { label: string; ok: boolean }) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  return (
    <View
      style={[
        styles.chip,
        ok
          ? { backgroundColor: theme.gainMuted, borderColor: theme.gain }
          : { backgroundColor: theme.lossMuted, borderColor: theme.loss },
      ]}
    >
      <Text
        style={[
          ts.caption,
          { color: ok ? theme.gain : theme.loss, fontWeight: '700', fontSize: 11 },
        ]}
      >
        {label} {ok ? '✓' : '—'}
      </Text>
    </View>
  );
}

export type ModoPendenciaPainel = 'parcial' | 'total';

type Props = {
  normaTaf?: NormaTafVista;
  /** `parcial` = ao menos um teste; `total` = nenhum teste. */
  modo?: ModoPendenciaPainel;
  cadastros: CadastroItemPersist[];
  sessoes: SessaoAplicacaoTaf[];
  carregandoDataset?: boolean;
  onExcluirCadastro?: (item: CadastroParaExcluir) => void;
};

export function ResultadosPendenciaParcialPanel({
  normaTaf = 'armada',
  modo = 'parcial',
  cadastros,
  sessoes,
  carregandoDataset = false,
  onExcluirCadastro,
}: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const t = theme.tokens;

  const [gerandoPdf, setGerandoPdf] = useState(false);

  const { lista, listaCfn } = useMemo(() => {
    if (normaTaf === 'cfn') {
      return {
        lista: [] as PendenciaTafItem[],
        listaCfn:
          modo === 'total'
            ? montarListaPendenciasTotaisCfn(sessoes, cadastros, { jaUnificadas: true })
            : filtrarPendenciasParciaisCfn(
                montarListaPendenciasCfn(sessoes, cadastros, { jaUnificadas: true }),
              ),
      };
    }
    if (modo === 'total') {
      return {
        lista: montarListaPendenciasTotais(sessoes, cadastros, { jaUnificadas: true }),
        listaCfn: [] as PendenciaCfnItem[],
      };
    }
    const { sessoesNorma, cadastrosNorma } = prepararDadosResultadosNorma(
      sessoes,
      cadastros,
      'armada',
      { jaUnificadas: true },
    );
    return {
      lista: filtrarPendenciasParciais(
        montarListaPendencias(sessoesNorma, cadastrosNorma, { jaUnificadas: true }),
      ),
      listaCfn: [] as PendenciaCfnItem[],
    };
  }, [normaTaf, modo, cadastros, sessoes]);

  const listaVisivel = normaTaf === 'cfn' ? listaCfn : lista;
  const carregando = carregandoDataset && listaVisivel.length === 0;

  const gerarPdf = useCallback(async () => {
    if (normaTaf === 'cfn') {
      Alert.alert('PDF', 'Exportação PDF de pendências CFN em breve.');
      return;
    }
    if (lista.length === 0) {
      Alert.alert(
        'Sem dados',
        modo === 'total'
          ? 'Não há militares sem teste para gerar o PDF.'
          : 'Não há militares com pendência parcial para gerar o PDF.',
      );
      return;
    }
    setGerandoPdf(true);
    try {
      await exportPendenciasTafPdf(lista, modo === 'total' ? 'total' : 'parcial');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não foi possível gerar o PDF.';
      if (/cancelad/i.test(msg)) return;
      Alert.alert('Erro ao gerar PDF', msg);
    } finally {
      setGerandoPdf(false);
    }
  }, [lista, normaTaf, modo]);

  const tituloVazio =
    modo === 'total'
      ? 'Nenhum militar sem teste.'
      : 'Nenhuma pendência parcial registrada.';

  return (
    <View style={styles.wrap}>
      {carregando ? (
        <Text style={[ts.caption, { color: theme.textMuted, textAlign: 'center', marginBottom: 14 }]}>
          Carregando…
        </Text>
      ) : null}

      {!carregando && listaVisivel.length > 0 && normaTaf !== 'cfn' ? (
        <TouchableOpacity
          onPress={() => void gerarPdf()}
          disabled={gerandoPdf}
          activeOpacity={0.88}
          style={[styles.pdfBtnOuter, { opacity: gerandoPdf ? 0.7 : 1 }]}
        >
          <LinearGradient
            colors={[...t.gradientPrimaryBtn]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.pdfBtn,
              Platform.OS === 'web'
                ? ({ boxShadow: '0 6px 20px rgba(37, 99, 235, 0.32)' } as object)
                : undefined,
            ]}
          >
            {gerandoPdf ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.pdfBtnText}>Gerar PDF</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      ) : null}

      {!carregando && listaVisivel.length === 0 ? (
        <TafGlassPanel style={styles.emptyCard}>
          <Text style={[ts.body, { color: theme.text, textAlign: 'center' }]}>
            {tituloVazio}
          </Text>
        </TafGlassPanel>
      ) : null}

      {!carregando && normaTaf === 'cfn'
        ? listaCfn.map((item) => (
            <View key={item.id} style={styles.itemPress}>
              <TafGlassPanel style={styles.itemCard}>
                <View style={styles.itemTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[ts.label, { color: theme.primary }]}>NIP</Text>
                    <Text style={[ts.body, { color: ui.text, marginBottom: 4 }]}>{item.nip}</Text>
                  </View>
                  <View
                    style={[
                      styles.situacaoBadge,
                      {
                        backgroundColor:
                          item.situacao === 'Sem teste' ? theme.backgroundSecondary : theme.lossMuted,
                        borderColor: item.situacao === 'Sem teste' ? theme.border : theme.loss,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        ts.caption,
                        {
                          color: item.situacao === 'Sem teste' ? theme.textMuted : theme.loss,
                          fontWeight: '800',
                          fontSize: 10,
                        },
                      ]}
                    >
                      {item.situacao}
                    </Text>
                  </View>
                  {onExcluirCadastro ? (
                    <TouchableOpacity
                      onPress={() => onExcluirCadastro({ id: item.id, nome: item.nome, nip: item.nip })}
                      style={[styles.excluirBtn, { backgroundColor: theme.lossMuted, borderColor: theme.loss }]}
                      accessibilityLabel="Excluir militar do sistema"
                      hitSlop={8}
                    >
                      <Trash2 size={15} color={theme.loss} strokeWidth={2.4} />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <Text style={[ts.label, { color: theme.primary }]}>Nome</Text>
                <Text style={[ts.body, { color: ui.text, fontWeight: '700', marginBottom: 4 }]}>
                  {formatNomeComPostoParts(item.postoGrad, item.nome)}
                </Text>

                <Text style={[ts.caption, { color: theme.textSecondary, marginBottom: 10 }]}>
                  {item.categoria}
                </Text>

                <View style={styles.chipsRow}>
                  {CFN_CHIP_LABELS.map(({ key, label }) => (
                    <ChipModalidade key={key} label={label} ok={item.provas[key]} />
                  ))}
                </View>

                {item.faltam.length > 0 ? (
                  <Text style={[ts.caption, styles.faltaLabel, { color: theme.loss }]}>
                    Falta: {item.faltam.join(', ')}
                  </Text>
                ) : null}
              </TafGlassPanel>
            </View>
          ))
        : null}

      {!carregando && normaTaf !== 'cfn'
        ? lista.map((item) => (
            <View key={item.id} style={styles.itemPress}>
              <TafGlassPanel style={styles.itemCard}>
                <View style={styles.itemTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[ts.label, { color: theme.primary }]}>NIP</Text>
                    <Text style={[ts.body, { color: ui.text, marginBottom: 4 }]}>{item.nip}</Text>
                  </View>
                  <View
                    style={[
                      styles.situacaoBadge,
                      {
                        backgroundColor:
                          item.situacao === 'Sem teste' ? theme.backgroundSecondary : theme.lossMuted,
                        borderColor: item.situacao === 'Sem teste' ? theme.border : theme.loss,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        ts.caption,
                        {
                          color: item.situacao === 'Sem teste' ? theme.textMuted : theme.loss,
                          fontWeight: '800',
                          fontSize: 10,
                        },
                      ]}
                    >
                      {item.situacao}
                    </Text>
                  </View>
                  {onExcluirCadastro ? (
                    <TouchableOpacity
                      onPress={() => onExcluirCadastro({ id: item.id, nome: item.nome, nip: item.nip })}
                      style={[styles.excluirBtn, { backgroundColor: theme.lossMuted, borderColor: theme.loss }]}
                      accessibilityLabel="Excluir militar do sistema"
                      hitSlop={8}
                    >
                      <Trash2 size={15} color={theme.loss} strokeWidth={2.4} />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <Text style={[ts.label, { color: theme.primary }]}>Nome</Text>
                <Text style={[ts.body, { color: ui.text, fontWeight: '700', marginBottom: 4 }]}>
                  {formatNomeComPostoParts(item.postoGrad, item.nome)}
                </Text>

                <Text style={[ts.caption, { color: theme.textSecondary, marginBottom: 10 }]}>
                  {item.categoria}
                </Text>

                <View style={styles.chipsRow}>
                  <ChipModalidade label="Corrida" ok={item.temCorrida} />
                  <ChipModalidade label="Natação" ok={item.temNatacao} />
                  <ChipModalidade label="Permanência" ok={item.temPermanencia} />
                </View>

                {item.faltam.length > 0 ? (
                  <Text style={[ts.caption, styles.faltaLabel, { color: theme.loss }]}>
                    Falta: {item.faltam.join(', ')}
                  </Text>
                ) : null}
              </TafGlassPanel>
            </View>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: tableFullWidthStyle,
  pdfBtnOuter: {
    marginBottom: 14,
    borderRadius: PREMIUM.radiusLg,
    overflow: 'hidden',
  },
  pdfBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: PREMIUM.radiusLg,
  },
  pdfBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  emptyCard: { marginBottom: 4 },
  itemPress: { marginBottom: 12 },
  itemCard: tableFullWidthStyle,
  itemTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 4,
  },
  situacaoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  excluirBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
  },
  faltaLabel: {
    fontWeight: '700',
    lineHeight: 18,
  },
});
