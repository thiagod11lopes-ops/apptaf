import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { AppHeader } from '../components/sismav/AppHeader';
import { Card } from '../components/Card';
import { getAllCadastros } from '../services/cadastrosIndexedDb';
import { calcularEstatisticasTaf } from '../utils/estatisticasTaf';
import { StatSection } from '../components/estatisticas/StatSection';
import { StatBarChart } from '../components/estatisticas/StatBarChart';
import { KpiCard } from '../components/fintech/KpiCard';
import { PillTabs } from '../components/fintech/PillTabs';
import { MonoValue } from '../components/fintech/MonoValue';

type ViewTab = 'geral' | 'modalidade' | 'notas';

export default function EstatisticasScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReturnType<typeof calcularEstatisticasTaf> | null>(null);
  const [tab, setTab] = useState<ViewTab>('geral');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const lista = await getAllCadastros();
      setStats(calcularEstatisticasTaf(lista));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const s = stats;
  const sparkTotais = useMemo(
    () => s?.registrosPorData.map((r) => r.total) ?? [],
    [s],
  );

  const maxWidth = useMemo(
    () =>
      Platform.OS === 'web'
        ? { maxWidth: 480, alignSelf: 'center' as const, width: '100%' as const }
        : {},
    [],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, maxWidth]}
        showsVerticalScrollIndicator={false}
      >
        <AppHeader title="Estatísticas" onBack={() => navigation.goBack()} />

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.gain} />
          </View>
        ) : !s || s.resumo.totalCadastros === 0 ? (
            <Card>
              <Text style={{ color: theme.text }}>
                Nenhum cadastro no sistema. Cadastre participantes e registre resultados de TAF para
                gerar estatísticas.
              </Text>
            </Card>
          ) : (
            <>
              <PillTabs<ViewTab>
                options={[
                  { id: 'geral', label: 'Geral' },
                  { id: 'modalidade', label: 'Provas' },
                  { id: 'notas', label: 'Notas' },
                ]}
                value={tab}
                onChange={setTab}
              />

              <Text style={[theme.textStyles.bodySecondary, styles.lead]}>
                Dashboard TAF · notas recalculadas pela norma (sexo, idade, tempo).
              </Text>

              {(tab === 'geral' || tab === 'modalidade') && (
                <StatSection title="Resumo geral">
                  <View style={styles.kpiGrid}>
                    <KpiCard
                      label="Cadastros"
                      value={s.resumo.totalCadastros}
                      sparkData={sparkTotais}
                      flashKey={s.resumo.totalCadastros}
                    />
                    <KpiCard
                      label="Com registro TAF"
                      value={s.resumo.comQualquerRegistroTaf}
                      hint={`${Math.round((s.resumo.comQualquerRegistroTaf / s.resumo.totalCadastros) * 100)}%`}
                      variant="gain"
                      flashKey={s.resumo.comQualquerRegistroTaf}
                    />
                    <KpiCard
                      label="Idade média"
                      value={s.resumo.idadeMedia ?? '—'}
                      hint="anos"
                    />
                  </View>
                </StatSection>
              )}

              {(tab === 'geral' || tab === 'modalidade') && (
                <StatSection
                  title="Registros por modalidade"
                  subtitle="Cadastros com resultado em cada prova"
                >
                  <View style={styles.kpiGrid}>
                    <KpiCard label="Corrida 2400 m" value={s.resumo.comCorrida} variant="gain" />
                    <KpiCard label="Natação 50 m" value={s.resumo.comNatacao} />
                    <KpiCard label="Permanência" value={s.resumo.comPermanencia} />
                  </View>
                  <StatBarChart items={s.registrosModalidade} barColor={theme.gain} />
                </StatSection>
              )}

              {tab === 'geral' && (
                <StatSection title="Perfil dos cadastrados">
                  <Text style={[theme.textStyles.label, styles.subHeading]}>Categoria</Text>
                  <StatBarChart items={s.porCategoria} barColor={theme.textMuted} />
                  <Text style={[theme.textStyles.label, styles.subHeading]}>Sexo</Text>
                  <StatBarChart items={s.porSexo} barColor={theme.primary} />
                  <Text style={[theme.textStyles.label, styles.subHeading]}>Faixa etária</Text>
                  <StatBarChart items={s.porFaixaEtaria} barColor={theme.gain} />
                </StatSection>
              )}

              {tab === 'notas' && (
                <>
                  <StatSection
                    title="Notas — Corrida"
                    subtitle={
                      s.notaMediaCorrida != null
                        ? `Média ${s.notaMediaCorrida} · OK ${s.taxas.corridaSemReprovacaoPct ?? '—'}%`
                        : undefined
                    }
                  >
                    <StatBarChart items={s.notasCorrida} barColor={theme.gain} />
                  </StatSection>
                  <StatSection
                    title="Notas — Natação"
                    subtitle={
                      s.notaMediaNatacao != null
                        ? `Média ${s.notaMediaNatacao} · OK ${s.taxas.natacaoSemReprovacaoPct ?? '—'}%`
                        : undefined
                    }
                  >
                    <StatBarChart items={s.notasNatacao} barColor={theme.primary} />
                  </StatSection>
                  <StatSection title="Permanência">
                    <StatBarChart
                      items={s.permanencia}
                      barColor={
                        (s.taxas.permanenciaAprovadosPct ?? 0) >= 50 ? theme.gain : theme.loss
                      }
                    />
                  </StatSection>
                </>
              )}

              {tab === 'modalidade' && (
                <>
                  <StatSection title="Tempos — Corrida" subtitle={`n=${s.temposCorrida.amostra}`}>
                    <View style={styles.kpiGrid}>
                      <KpiCard label="Média" value={s.temposCorrida.mediaFmt} variant="gain" />
                      <KpiCard label="Melhor" value={s.temposCorrida.melhorFmt ?? '—'} variant="gain" />
                      <KpiCard label="Pior" value={s.temposCorrida.piorFmt ?? '—'} variant="loss" />
                    </View>
                  </StatSection>
                  <StatSection title="Tempos — Natação" subtitle={`n=${s.temposNatacao.amostra}`}>
                    <View style={styles.kpiGrid}>
                      <KpiCard label="Média" value={s.temposNatacao.mediaFmt} />
                      <KpiCard label="Melhor" value={s.temposNatacao.melhorFmt ?? '—'} variant="gain" />
                      <KpiCard label="Pior" value={s.temposNatacao.piorFmt ?? '—'} variant="loss" />
                    </View>
                  </StatSection>
                </>
              )}

              {tab === 'geral' && s.topPostosGrad.length > 0 ? (
                <StatSection title="Postos e graduações (top 10)">
                  <StatBarChart items={s.topPostosGrad} />
                </StatSection>
              ) : null}

              {tab === 'geral' && s.registrosPorData.length > 0 ? (
                <StatSection title="Registros por data">
                  {s.registrosPorData.map((row) => (
                    <View
                      key={row.data}
                      style={[styles.dataRow, { borderBottomColor: theme.borderSubtle }]}
                    >
                      <Text style={[styles.dataDate, { color: theme.text }]}>{row.data}</Text>
                      <MonoValue size="sm" variant="muted">
                        C{row.corrida} N{row.natacao} P{row.permanencia} Σ{row.total}
                      </MonoValue>
                    </View>
                  ))}
                </StatSection>
              ) : null}
            </>
          )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32, gap: 4 },
  centered: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  lead: { fontSize: 12, lineHeight: 18, marginBottom: 12, marginTop: 4 },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  subHeading: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  dataDate: { fontSize: 13, fontWeight: '600' },
});
