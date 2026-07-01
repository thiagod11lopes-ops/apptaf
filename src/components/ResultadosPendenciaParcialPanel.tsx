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
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { PressableScale } from './premium/PressableScale';
import { getAllCadastros } from '../services/cadastrosIndexedDb';
import { getAllSessoesAplicacao } from '../services/resultadosAplicadosIndexedDb';
import {
  calcularContagemPendencias,
  filtrarPendencias,
  FILTRO_PENDENCIA_LABEL,
  montarListaPendencias,
  type FiltroPendenciaTaf,
  type PendenciaTafItem,
} from '../utils/pendenciasTafHistorico';
import {
  CFN_CHIP_LABELS,
  montarListaPendenciasCfn,
  type PendenciaCfnItem,
} from '../utils/pendenciasTafCfnHistorico';
import { prepararDadosResultadosNorma, type NormaTafVista } from '../utils/normaTafResultados';
import { exportPendenciasTafPdf } from '../utils/exportPendenciasTafPdf';
import { PREMIUM } from '../theme/premium';
import { tableFullWidthStyle } from '../theme/tableLayout';
import { getUiColors } from '../theme/uiColors';
import { getAplicarTafGlass } from './taf/aplicar/aplicarTafTheme';
import { TafGlassPanel } from './mobile/TafTabChrome';

const FILTROS: FiltroPendenciaTaf[] = ['total', 'corrida', 'natacao', 'permanencia'];

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

type FiltroBtnProps = {
  id: FiltroPendenciaTaf;
  count: number;
  active: boolean;
  onPress: () => void;
};

function FiltroPendenciaBtn({ id, count, active, onPress }: FiltroBtnProps) {
  const { theme } = useTheme();
  const t = theme.tokens;

  const inner = (
    <>
      <Text style={[styles.filtroCount, active && styles.filtroCountActive]}>{count}</Text>
      <Text
        style={[
          styles.filtroLabel,
          { color: active ? '#FFFFFF' : theme.textSecondary },
        ]}
        numberOfLines={2}
      >
        {FILTRO_PENDENCIA_LABEL[id]}
      </Text>
    </>
  );

  if (active) {
    return (
      <PressableScale onPress={onPress} style={styles.filtroBtnWrap} accessibilityState={{ selected: true }}>
        <LinearGradient
          colors={[...t.gradientPrimaryBtn]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.filtroBtn,
            Platform.OS === 'web'
              ? ({ boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)' } as object)
              : undefined,
          ]}
        >
          {inner}
        </LinearGradient>
      </PressableScale>
    );
  }

  return (
    <PressableScale
      onPress={onPress}
      style={[
        styles.filtroBtn,
        styles.filtroBtnInactive,
        { borderColor: theme.border, backgroundColor: theme.cardBg },
      ]}
      accessibilityState={{ selected: false }}
    >
      {inner}
    </PressableScale>
  );
}

export function ResultadosPendenciaParcialPanel({ normaTaf = 'armada' }: { normaTaf?: NormaTafVista }) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const t = theme.tokens;
  const glass = getAplicarTafGlass(theme);

  const [lista, setLista] = useState<PendenciaTafItem[]>([]);
  const [listaCfn, setListaCfn] = useState<PendenciaCfnItem[]>([]);
  const [contagem, setContagem] = useState<Record<FiltroPendenciaTaf, number>>({
    total: 0,
    corrida: 0,
    natacao: 0,
    permanencia: 0,
  });
  const [filtro, setFiltro] = useState<FiltroPendenciaTaf>('total');
  const [carregando, setCarregando] = useState(true);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const carregar = useCallback(() => {
    setCarregando(true);
    Promise.all([getAllCadastros(), getAllSessoesAplicacao()])
      .then(([cadastros, sessoes]) => {
        if (normaTaf === 'cfn') {
          setListaCfn(montarListaPendenciasCfn(sessoes, cadastros));
          setLista([]);
          setContagem({ total: 0, corrida: 0, natacao: 0, permanencia: 0 });
          return;
        }
        const { sessoesNorma, cadastrosNorma } = prepararDadosResultadosNorma(
          sessoes,
          cadastros,
          'armada',
        );
        const pendencias = montarListaPendencias(sessoesNorma, cadastrosNorma);
        setLista(pendencias);
        setListaCfn([]);
        setContagem(calcularContagemPendencias(sessoesNorma, cadastrosNorma));
      })
      .catch(() => {
        setLista([]);
        setListaCfn([]);
        setContagem({ total: 0, corrida: 0, natacao: 0, permanencia: 0 });
      })
      .finally(() => setCarregando(false));
  }, [normaTaf]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const listaFiltrada = useMemo(() => filtrarPendencias(lista, filtro), [lista, filtro]);
  const listaCfnVisivel = listaCfn;
  const totalVisivel = normaTaf === 'cfn' ? listaCfnVisivel.length : listaFiltrada.length;

  const gerarPdf = useCallback(async () => {
    if (normaTaf === 'cfn') {
      Alert.alert('PDF', 'Exportação PDF de pendências CFN em breve.');
      return;
    }
    if (listaFiltrada.length === 0) {
      Alert.alert('Sem dados', 'Não há militares com pendência neste filtro para gerar o PDF.');
      return;
    }
    setGerandoPdf(true);
    try {
      await exportPendenciasTafPdf(listaFiltrada, filtro);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não foi possível gerar o PDF.';
      Alert.alert('Erro ao gerar PDF', msg);
    } finally {
      setGerandoPdf(false);
    }
  }, [listaFiltrada, filtro, normaTaf]);

  return (
    <View style={styles.wrap}>
      <TafGlassPanel style={styles.filtrosPanel}>
        {carregando ? (
          <Text style={[ts.caption, { color: theme.textMuted, textAlign: 'center' }]}>
            Carregando…
          </Text>
        ) : normaTaf === 'cfn' ? (
          <View style={[styles.filtrosRow, { borderColor: glass.border }]}>
            <View
              style={[
                styles.filtroBtn,
                styles.filtroBtnInactive,
                styles.filtroCfnTotal,
                { borderColor: theme.border, backgroundColor: theme.cardBg },
              ]}
            >
              <Text style={styles.filtroCount}>{listaCfnVisivel.length}</Text>
              <Text style={[styles.filtroLabel, { color: theme.textSecondary }]}>
                Pendência Total CFN
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.filtrosRow, { borderColor: glass.border }]}>
            {FILTROS.map((id) => (
              <FiltroPendenciaBtn
                key={id}
                id={id}
                count={contagem[id]}
                active={filtro === id}
                onPress={() => setFiltro(id)}
              />
            ))}
          </View>
        )}
      </TafGlassPanel>

      {!carregando && totalVisivel > 0 && normaTaf !== 'cfn' ? (
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

      {!carregando && totalVisivel === 0 ? (
        <TafGlassPanel style={styles.emptyCard}>
          <Text style={[ts.body, { color: theme.text, textAlign: 'center' }]}>
            Nenhuma pendência neste filtro.
          </Text>
        </TafGlassPanel>
      ) : null}

      {normaTaf === 'cfn'
        ? listaCfnVisivel.map((item) => (
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
                </View>

                <Text style={[ts.label, { color: theme.primary }]}>Nome</Text>
                <Text style={[ts.body, { color: ui.text, fontWeight: '700', marginBottom: 4 }]}>
                  {item.nome}
                </Text>

                <Text style={[ts.caption, { color: theme.textSecondary, marginBottom: 10 }]}>
                  {item.postoGrad} · {item.categoria}
                </Text>

                <View style={styles.chipsRow}>
                  {CFN_CHIP_LABELS.map(({ key, label }) => (
                    <ChipModalidade key={key} label={label} ok={item.provas[key]} />
                  ))}
                </View>

                <Text style={[ts.caption, styles.faltaLabel, { color: theme.loss }]}>
                  Falta: {item.faltam.join(', ')}
                </Text>
              </TafGlassPanel>
            </View>
          ))
        : listaFiltrada.map((item) => (
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
            </View>

            <Text style={[ts.label, { color: theme.primary }]}>Nome</Text>
            <Text style={[ts.body, { color: ui.text, fontWeight: '700', marginBottom: 4 }]}>
              {item.nome}
            </Text>

            <Text style={[ts.caption, { color: theme.textSecondary, marginBottom: 10 }]}>
              {item.postoGrad} · {item.categoria}
            </Text>

            <View style={styles.chipsRow}>
              <ChipModalidade label="Corrida" ok={item.temCorrida} />
              <ChipModalidade label="Natação" ok={item.temNatacao} />
              <ChipModalidade label="Permanência" ok={item.temPermanencia} />
            </View>

            <Text style={[ts.caption, styles.faltaLabel, { color: theme.loss }]}>
              Falta: {item.faltam.join(', ')}
            </Text>
          </TafGlassPanel>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: tableFullWidthStyle,
  filtrosPanel: {
    marginBottom: 14,
  },
  filtrosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filtroBtnWrap: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 140,
    borderRadius: PREMIUM.radiusLg,
  },
  filtroBtn: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 140,
    borderRadius: PREMIUM.radiusLg,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 72,
  },
  filtroBtnInactive: {
    borderWidth: 1,
  },
  filtroCount: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  filtroCountActive: {
    color: '#FFFFFF',
  },
  filtroLabel: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 14,
  },
  filtroCfnTotal: {
    flexGrow: 1,
    minWidth: '100%',
  },
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
