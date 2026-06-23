import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { FileText, AlertCircle } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Card } from './Card';
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
import { exportPendenciasTafPdf } from '../utils/exportPendenciasTafPdf';
import { PREMIUM } from '../theme/premium';
import { tableFullWidthStyle } from '../theme/tableLayout';
import { getUiColors } from '../theme/uiColors';

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

export function ResultadosPendenciaParcialPanel() {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const t = theme.tokens;

  const [lista, setLista] = useState<PendenciaTafItem[]>([]);
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
        const pendencias = montarListaPendencias(sessoes, cadastros);
        setLista(pendencias);
        setContagem(calcularContagemPendencias(sessoes, cadastros));
      })
      .catch(() => {
        setLista([]);
        setContagem({ total: 0, corrida: 0, natacao: 0, permanencia: 0 });
      })
      .finally(() => setCarregando(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const listaFiltrada = useMemo(() => filtrarPendencias(lista, filtro), [lista, filtro]);

  const gerarPdf = useCallback(async () => {
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
  }, [listaFiltrada, filtro]);

  return (
    <View style={styles.wrap}>
      <Text style={[ts.bodySecondary, styles.intro, { color: theme.textSecondary }]}>
        Filtre as pendências por modalidade. Os números indicam quantos militares ainda não
        concluíram cada etapa do TAF (corrida, natação e permanência).
      </Text>

      <View
        style={[
          styles.filtrosShell,
          { borderColor: theme.border },
          Platform.OS === 'web' ? ({ boxShadow: t.shadowMd } as object) : undefined,
        ]}
      >
        <LinearGradient
          colors={theme.isDark ? ['#0f172a', '#1e293b'] : ['#f8fafc', '#eef2ff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.filtrosGradient}
        >
          <View style={styles.filtrosHeader}>
            <AlertCircle size={18} color={theme.primary} strokeWidth={2.5} />
            <Text style={[ts.label, styles.filtrosTitle, { color: ui.text }]}>Filtrar pendências</Text>
          </View>

          {carregando ? (
            <ActivityIndicator color={theme.primary} style={styles.loaderFiltros} />
          ) : (
            <View style={styles.filtrosGrid}>
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
        </LinearGradient>
      </View>

      {!carregando && listaFiltrada.length > 0 ? (
        <PressableScale
          onPress={() => void gerarPdf()}
          disabled={gerandoPdf}
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
              <>
                <FileText size={18} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.pdfBtnText}>Gerar PDF</Text>
                <Text style={styles.pdfBtnHint}>
                  {listaFiltrada.length} militar{listaFiltrada.length !== 1 ? 'es' : ''} ·{' '}
                  {FILTRO_PENDENCIA_LABEL[filtro]}
                </Text>
              </>
            )}
          </LinearGradient>
        </PressableScale>
      ) : null}

      {carregando ? <ActivityIndicator color={theme.primary} style={styles.loader} /> : null}

      {!carregando && listaFiltrada.length === 0 ? (
        <Card elevated style={styles.emptyCard}>
          <Text style={[ts.body, { color: theme.text, textAlign: 'center' }]}>
            Nenhuma pendência neste filtro.
          </Text>
          <Text style={[ts.caption, styles.emptyHint, { color: theme.textMuted, textAlign: 'center' }]}>
            {filtro === 'total'
              ? 'Todos os militares concluíram as três modalidades ou ainda não há cadastros.'
              : `Não há militares pendentes em ${FILTRO_PENDENCIA_LABEL[filtro].toLowerCase()}.`}
          </Text>
        </Card>
      ) : null}

      {!carregando && listaFiltrada.length > 0 ? (
        <Text style={[ts.caption, styles.contador, { color: theme.textMuted }]}>
          {listaFiltrada.length} militar{listaFiltrada.length !== 1 ? 'es' : ''} ·{' '}
          {FILTRO_PENDENCIA_LABEL[filtro]}
        </Text>
      ) : null}

      {listaFiltrada.map((item) => (
        <Card key={item.id} elevated style={styles.itemCard}>
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
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: tableFullWidthStyle,
  intro: { marginBottom: 14, lineHeight: 20 },
  filtrosShell: {
    borderRadius: PREMIUM.radiusXl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  filtrosGradient: {
    padding: 16,
  },
  filtrosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  filtrosTitle: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'none',
  },
  filtrosGrid: {
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
    minHeight: 88,
  },
  filtroBtnInactive: {
    borderWidth: 1,
  },
  filtroCount: {
    fontSize: 28,
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
  loaderFiltros: { marginVertical: 20 },
  pdfBtnOuter: {
    marginBottom: 14,
    borderRadius: PREMIUM.radiusLg,
    overflow: 'hidden',
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: PREMIUM.radiusLg,
  },
  pdfBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  pdfBtnHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
    width: '100%',
    textAlign: 'center',
  },
  loader: { marginVertical: 24 },
  emptyCard: { padding: 20 },
  emptyHint: { marginTop: 8, lineHeight: 18 },
  contador: { marginBottom: 10, textAlign: 'center', fontWeight: '700' },
  itemCard: { padding: 16, marginBottom: 12 },
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
