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
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { getAllCadastros } from '../services/cadastrosIndexedDb';
import { calcularEstatisticasTaf } from '../utils/estatisticasTaf';
import { StatSection } from '../components/estatisticas/StatSection';
import { StatBarChart } from '../components/estatisticas/StatBarChart';

const CORRIDA = '#15803D';
const NATACAO = '#0369A1';
const PERMANENCIA = '#7C3AED';

function KpiCard({
  label,
  value,
  hint,
  textColor,
  mutedColor,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  textColor: string;
  mutedColor: string;
  accent?: string;
}) {
  return (
    <View style={[styles.kpi, accent ? { borderLeftColor: accent, borderLeftWidth: 3 } : null]}>
      <Text style={[styles.kpiValue, { color: textColor }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color: mutedColor }]}>{label}</Text>
      {hint ? <Text style={[styles.kpiHint, { color: mutedColor }]}>{hint}</Text> : null}
    </View>
  );
}

export default function EstatisticasScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReturnType<typeof calcularEstatisticasTaf> | null>(null);

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
  const maxWidth = useMemo(
    () => (Platform.OS === 'web' ? { maxWidth: 960, alignSelf: 'center' as const, width: '100%' as const } : {}),
    [],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Estatísticas" onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, maxWidth]}
          showsVerticalScrollIndicator={false}
        >
          {!s || s.resumo.totalCadastros === 0 ? (
            <Card>
              <Text style={{ color: theme.text }}>
                Nenhum cadastro no sistema. Cadastre participantes e registre resultados de TAF para
                gerar estatísticas.
              </Text>
            </Card>
          ) : (
            <>
              <Text style={[styles.lead, { color: theme.textSecondary }]}>
                Métricas calculadas a partir de todos os cadastros e registros de corrida, natação e
                permanência. Notas recalculadas pela norma vigente (sexo, idade e tempo).
              </Text>

              <StatSection
                title="Resumo geral"
                textColor={theme.text}
                mutedColor={theme.textSecondary}
              >
                <View style={styles.kpiGrid}>
                  <KpiCard
                    label="Cadastros"
                    value={s.resumo.totalCadastros}
                    textColor={theme.text}
                    mutedColor={theme.textSecondary}
                  />
                  <KpiCard
                    label="Com registro TAF"
                    value={s.resumo.comQualquerRegistroTaf}
                    hint={`${Math.round((s.resumo.comQualquerRegistroTaf / s.resumo.totalCadastros) * 100)}% do total`}
                    textColor={theme.text}
                    mutedColor={theme.textSecondary}
                  />
                  <KpiCard
                    label="Idade média"
                    value={s.resumo.idadeMedia ?? '—'}
                    hint="anos (data de nascimento)"
                    textColor={theme.text}
                    mutedColor={theme.textSecondary}
                  />
                </View>
              </StatSection>

              <StatSection
                title="Registros por modalidade"
                subtitle="Quantidade de cadastros com resultado em cada prova"
                textColor={theme.text}
                mutedColor={theme.textSecondary}
              >
                <View style={styles.kpiGrid}>
                  <KpiCard
                    label="Corrida 2400 m"
                    value={s.resumo.comCorrida}
                    textColor={theme.text}
                    mutedColor={theme.textSecondary}
                    accent={CORRIDA}
                  />
                  <KpiCard
                    label="Natação 50 m"
                    value={s.resumo.comNatacao}
                    textColor={theme.text}
                    mutedColor={theme.textSecondary}
                    accent={NATACAO}
                  />
                  <KpiCard
                    label="Permanência"
                    value={s.resumo.comPermanencia}
                    textColor={theme.text}
                    mutedColor={theme.textSecondary}
                    accent={PERMANENCIA}
                  />
                </View>
                <StatBarChart
                  items={s.registrosModalidade}
                  barColor={theme.primary}
                  textColor={theme.text}
                  mutedColor={theme.textSecondary}
                />
              </StatSection>

              <StatSection
                title="Perfil dos cadastrados"
                textColor={theme.text}
                mutedColor={theme.textSecondary}
              >
                <Text style={[styles.subHeading, { color: theme.text }]}>Categoria</Text>
                <StatBarChart
                  items={s.porCategoria}
                  barColor="#4B5563"
                  textColor={theme.text}
                  mutedColor={theme.textSecondary}
                />
                <Text style={[styles.subHeading, { color: theme.text, marginTop: 14 }]}>Sexo</Text>
                <StatBarChart
                  items={s.porSexo}
                  barColor="#BE185D"
                  textColor={theme.text}
                  mutedColor={theme.textSecondary}
                />
                <Text style={[styles.subHeading, { color: theme.text, marginTop: 14 }]}>
                  Faixa etária (norma TAF)
                </Text>
                <StatBarChart
                  items={s.porFaixaEtaria}
                  barColor="#D97706"
                  textColor={theme.text}
                  mutedColor={theme.textSecondary}
                />
              </StatSection>

              {s.topPostosGrad.length > 0 ? (
                <StatSection
                  title="Postos e graduações"
                  subtitle="Top 10 entre cadastros com posto/graduação informado"
                  textColor={theme.text}
                  mutedColor={theme.textSecondary}
                >
                  <StatBarChart
                    items={s.topPostosGrad}
                    barColor="#4338CA"
                    textColor={theme.text}
                    mutedColor={theme.textSecondary}
                  />
                </StatSection>
              ) : null}

              <StatSection
                title="Distribuição de notas — Corrida"
                subtitle={
                  s.notaMediaCorrida != null
                    ? `Nota média numérica: ${s.notaMediaCorrida} · Aprovação (≠ reprovado): ${s.taxas.corridaSemReprovacaoPct ?? '—'}% · Nota ≥ 50: ${s.taxas.corridaNota50PlusPct ?? '—'}%`
                    : undefined
                }
                textColor={theme.text}
                mutedColor={theme.textSecondary}
              >
                <StatBarChart
                  items={s.notasCorrida}
                  barColor={CORRIDA}
                  textColor={theme.text}
                  mutedColor={theme.textSecondary}
                />
              </StatSection>

              <StatSection
                title="Distribuição de notas — Natação"
                subtitle={
                  s.notaMediaNatacao != null
                    ? `Nota média numérica: ${s.notaMediaNatacao} · Aprovação (≠ reprovado): ${s.taxas.natacaoSemReprovacaoPct ?? '—'}% · Nota ≥ 50: ${s.taxas.natacaoNota50PlusPct ?? '—'}%`
                    : undefined
                }
                textColor={theme.text}
                mutedColor={theme.textSecondary}
              >
                <StatBarChart
                  items={s.notasNatacao}
                  barColor={NATACAO}
                  textColor={theme.text}
                  mutedColor={theme.textSecondary}
                />
              </StatSection>

              <StatSection
                title="Tempos — Corrida"
                subtitle={`Amostra com tempo válido: ${s.temposCorrida.amostra}`}
                textColor={theme.text}
                mutedColor={theme.textSecondary}
              >
                <View style={styles.kpiGrid}>
                  <KpiCard
                    label="Média"
                    value={s.temposCorrida.mediaFmt}
                    textColor={theme.text}
                    mutedColor={theme.textSecondary}
                    accent={CORRIDA}
                  />
                  <KpiCard
                    label="Melhor"
                    value={s.temposCorrida.melhorFmt ?? '—'}
                    textColor={theme.text}
                    mutedColor={theme.textSecondary}
                    accent={CORRIDA}
                  />
                  <KpiCard
                    label="Pior"
                    value={s.temposCorrida.piorFmt ?? '—'}
                    textColor={theme.text}
                    mutedColor={theme.textSecondary}
                    accent={CORRIDA}
                  />
                </View>
              </StatSection>

              <StatSection
                title="Tempos — Natação"
                subtitle={`Amostra com tempo válido: ${s.temposNatacao.amostra}`}
                textColor={theme.text}
                mutedColor={theme.textSecondary}
              >
                <View style={styles.kpiGrid}>
                  <KpiCard
                    label="Média"
                    value={s.temposNatacao.mediaFmt}
                    textColor={theme.text}
                    mutedColor={theme.textSecondary}
                    accent={NATACAO}
                  />
                  <KpiCard
                    label="Melhor"
                    value={s.temposNatacao.melhorFmt ?? '—'}
                    textColor={theme.text}
                    mutedColor={theme.textSecondary}
                    accent={NATACAO}
                  />
                  <KpiCard
                    label="Pior"
                    value={s.temposNatacao.piorFmt ?? '—'}
                    textColor={theme.text}
                    mutedColor={theme.textSecondary}
                    accent={NATACAO}
                  />
                </View>
              </StatSection>

              <StatSection
                title="Permanência"
                subtitle={
                  s.taxas.permanenciaAprovadosPct != null
                    ? `Taxa de aprovação: ${s.taxas.permanenciaAprovadosPct}%`
                    : 'Sem resultados definidos (aprovado/reprovado)'
                }
                textColor={theme.text}
                mutedColor={theme.textSecondary}
              >
                <StatBarChart
                  items={s.permanencia}
                  barColor={PERMANENCIA}
                  textColor={theme.text}
                  mutedColor={theme.textSecondary}
                />
              </StatSection>

              {s.registrosPorData.length > 0 ? (
                <StatSection
                  title="Registros por data de aplicação"
                  subtitle="Contagem de eventos por data informada em cada modalidade"
                  textColor={theme.text}
                  mutedColor={theme.textSecondary}
                >
                  {s.registrosPorData.map((row) => (
                    <View key={row.data} style={styles.dataRow}>
                      <Text style={[styles.dataDate, { color: theme.text }]}>{row.data}</Text>
                      <Text style={[styles.dataCounts, { color: theme.textSecondary }]}>
                        C {row.corrida} · N {row.natacao} · P {row.permanencia} · Σ {row.total}
                      </Text>
                    </View>
                  ))}
                </StatSection>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lead: { fontSize: 13, lineHeight: 20, marginBottom: 14 },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  kpi: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 100,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  kpiValue: { fontSize: 22, fontWeight: '800' },
  kpiLabel: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  kpiHint: { fontSize: 11, marginTop: 2 },
  subHeading: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    gap: 8,
  },
  dataDate: { fontSize: 14, fontWeight: '600' },
  dataCounts: { fontSize: 12 },
});
