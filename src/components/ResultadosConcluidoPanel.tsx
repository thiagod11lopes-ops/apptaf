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
import { CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import { montarListaConcluidos, type ConcluidoTafItem } from '../utils/pendenciasTafHistorico';
import {
  CFN_CHIP_LABELS,
  montarListaConcluidosCfn,
  type ConcluidoCfnItem,
} from '../utils/pendenciasTafCfnHistorico';
import { prepararDadosResultadosNorma, type NormaTafVista } from '../utils/normaTafResultados';
import { exportConcluidosTafPdf } from '../utils/exportConcluidosTafPdf';
import { PREMIUM } from '../theme/premium';
import { tableFullWidthStyle } from '../theme/tableLayout';
import { getUiColors } from '../theme/uiColors';
import { TafGlassPanel } from './mobile/TafTabChrome';
import { formatNomeComPostoParts } from '../utils/formatNomeComPosto';

function ChipModalidade({ label, ok = true }: { label: string; ok?: boolean }) {
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
      <Text style={[ts.caption, { color: ok ? theme.gain : theme.loss, fontWeight: '700', fontSize: 11 }]}>
        {label} {ok ? '✓' : '—'}
      </Text>
    </View>
  );
}

export function ResultadosConcluidoPanel({
  normaTaf = 'armada',
  cadastros,
  sessoes,
  carregandoDataset = false,
}: {
  normaTaf?: NormaTafVista;
  cadastros: CadastroItemPersist[];
  sessoes: SessaoAplicacaoTaf[];
  carregandoDataset?: boolean;
}) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const t = theme.tokens;

  const [gerandoPdf, setGerandoPdf] = useState(false);

  const { lista, listaCfn } = useMemo(() => {
    if (normaTaf === 'cfn') {
      return {
        lista: [] as ConcluidoTafItem[],
        listaCfn: montarListaConcluidosCfn(sessoes, cadastros, { jaUnificadas: true }),
      };
    }
    const { sessoesNorma, cadastrosNorma } = prepararDadosResultadosNorma(
      sessoes,
      cadastros,
      'armada',
      { jaUnificadas: true },
    );
    return {
      lista: montarListaConcluidos(sessoesNorma, cadastrosNorma, { jaUnificadas: true }),
      listaCfn: [] as ConcluidoCfnItem[],
    };
  }, [normaTaf, cadastros, sessoes]);

  const listaVisivel = normaTaf === 'cfn' ? listaCfn : lista;
  const carregando = carregandoDataset && listaVisivel.length === 0;

  const gerarPdf = useCallback(async () => {
    if (normaTaf === 'cfn') {
      Alert.alert('PDF', 'Exportação PDF de concluídos CFN em breve.');
      return;
    }
    if (lista.length === 0) {
      Alert.alert('Sem dados', 'Não há militares com TAF concluído para gerar o PDF.');
      return;
    }
    setGerandoPdf(true);
    try {
      await exportConcluidosTafPdf(lista);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não foi possível gerar o PDF.';
      if (/cancelad/i.test(msg)) return;
      Alert.alert('Erro ao gerar PDF', msg);
    } finally {
      setGerandoPdf(false);
    }
  }, [lista, normaTaf]);

  return (
    <View style={styles.wrap}>
      <TafGlassPanel style={styles.resumoPanel}>
        {carregando ? (
          <Text style={[ts.caption, { color: theme.textMuted, textAlign: 'center' }]}>Carregando…</Text>
        ) : (
          <View style={styles.resumoRow}>
            <View style={[styles.resumoIcon, { backgroundColor: theme.gainMuted, borderColor: theme.gain }]}>
              <CheckCircle2 size={22} color={theme.gain} strokeWidth={2.2} />
            </View>
            <View style={styles.resumoTexto}>
              <Text style={[ts.label, { color: theme.gain }]}>TAF concluído</Text>
              <Text style={[ts.h2, { color: ui.text, marginTop: 2 }]}>
                {listaVisivel.length.toLocaleString('pt-BR')} militar{listaVisivel.length !== 1 ? 'es' : ''}
              </Text>
              <Text style={[ts.caption, { color: theme.textMuted, marginTop: 4 }]}>
                {normaTaf === 'cfn'
                  ? 'Todas as 7 provas CFN registradas'
                  : 'Corrida ou caminhada, natação e permanência registradas'}
              </Text>
            </View>
          </View>
        )}
      </TafGlassPanel>

      {!carregando && listaVisivel.length > 0 && normaTaf !== 'cfn' ? (
        <TouchableOpacity
          onPress={() => void gerarPdf()}
          disabled={gerandoPdf}
          activeOpacity={0.88}
          style={[styles.pdfBtnOuter, { opacity: gerandoPdf ? 0.7 : 1 }]}
        >
          <LinearGradient
            colors={['#059669', '#14b8a6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.pdfBtn,
              Platform.OS === 'web'
                ? ({ boxShadow: '0 6px 20px rgba(5, 150, 105, 0.32)' } as object)
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
            {normaTaf === 'cfn'
              ? 'Nenhum militar concluiu todas as provas do TAF CFN ainda.'
              : 'Nenhum militar concluiu todas as modalidades do TAF ainda.'}
          </Text>
        </TafGlassPanel>
      ) : null}

      {normaTaf === 'cfn'
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
                      { backgroundColor: theme.gainMuted, borderColor: theme.gain },
                    ]}
                  >
                    <Text style={[ts.caption, { color: theme.gain, fontWeight: '800', fontSize: 10 }]}>
                      Concluído
                    </Text>
                  </View>
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
              </TafGlassPanel>
            </View>
          ))
        : lista.map((item) => (
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
                  { backgroundColor: theme.gainMuted, borderColor: theme.gain },
                ]}
              >
                <Text style={[ts.caption, { color: theme.gain, fontWeight: '800', fontSize: 10 }]}>
                  Concluído
                </Text>
              </View>
            </View>

            <Text style={[ts.label, { color: theme.primary }]}>Nome</Text>
            <Text style={[ts.body, { color: ui.text, fontWeight: '700', marginBottom: 4 }]}>
              {formatNomeComPostoParts(item.postoGrad, item.nome)}
            </Text>

            <Text style={[ts.caption, { color: theme.textSecondary, marginBottom: 10 }]}>
              {item.categoria}
            </Text>

            <View style={styles.chipsRow}>
              <ChipModalidade label="Corrida" />
              <ChipModalidade label="Natação" />
              <ChipModalidade label="Permanência" />
            </View>
          </TafGlassPanel>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: tableFullWidthStyle,
  resumoPanel: { marginBottom: 14 },
  resumoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resumoIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumoTexto: { flex: 1 },
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
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
  },
});
