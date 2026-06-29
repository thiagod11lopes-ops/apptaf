import React, { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuthDataReload } from '../hooks/useAuthDataReload';
import { getAllCadastros } from '../services/cadastrosIndexedDb';
import { getAllSessoesAplicacao } from '../services/resultadosAplicadosIndexedDb';
import { calcularEstatisticasTaf, META_CONCLUSAO_TAF_PCT } from '../utils/estatisticasTaf';
import { StatSection } from '../components/estatisticas/StatSection';
import { StatBarChart } from '../components/estatisticas/StatBarChart';
import { KpiCard } from '../components/fintech/KpiCard';
import { PillTabs } from '../components/fintech/PillTabs';
import { MonoValue } from '../components/fintech/MonoValue';
import { MobileScreenScaffold } from '../components/mobile/MobileScreenScaffold';
import { TafCenteredTabHeader, TafGlassPanel } from '../components/mobile/TafTabChrome';
import { TopActionIcons } from '../components/premium/TopActionIcons';

type ViewTab = 'geral' | 'modalidade' | 'notas' | 'graficos';

const EstatisticasGraficosPanel = lazy(() =>
  import('../components/estatisticas/EstatisticasGraficosPanel').then((m) => ({
    default: m.EstatisticasGraficosPanel,
  })),
);

function pctHint(val: number | null, suffix = '%'): string | undefined {
  if (val == null) return undefined;
  return `${val}${suffix}`;
}

export default function EstatisticasScreen() {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReturnType<typeof calcularEstatisticasTaf> | null>(null);
  const [tab, setTab] = useState<ViewTab>('geral');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [lista, sessoes] = await Promise.all([getAllCadastros(), getAllSessoesAplicacao()]);
      setStats(calcularEstatisticasTaf(lista, sessoes));
    } finally {
      setLoading(false);
    }
  }, []);

  useAuthDataReload(carregar);

  const s = stats;
  const sparkTotais = useMemo(
    () => s?.registrosPorData.map((r) => r.total) ?? [],
    [s],
  );

  const maxWidth = useMemo(
    () =>
      Platform.OS === 'web'
        ? { maxWidth: 520, alignSelf: 'center' as const, width: '100%' as const }
        : {},
    [],
  );

  return (
    <MobileScreenScaffold contentContainerStyle={[styles.scroll, maxWidth]}>
      <TafCenteredTabHeader
        title="Estatísticas"
        subtitle="Dashboard TAF · notas e desempenho"
        footer={<TopActionIcons activeRoute="Estatisticas" inline centered />}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.gain} />
        </View>
      ) : !s || s.resumo.totalCadastros === 0 ? (
        <TafGlassPanel>
          <Text style={{ color: theme.text }}>
            Nenhum cadastro no sistema. Cadastre participantes e registre resultados de TAF para gerar
            estatísticas.
          </Text>
        </TafGlassPanel>
      ) : (
        <>
          <PillTabs<ViewTab>
            options={[
              { id: 'geral', label: 'Geral' },
              { id: 'modalidade', label: 'Provas' },
              { id: 'notas', label: 'Notas' },
              { id: 'graficos', label: 'Gráficos' },
            ]}
            value={tab}
            onChange={setTab}
            centered
          />

          {tab !== 'graficos' ? (
            <Text style={[ts.bodySecondary, styles.lead]}>
              Dashboard TAF · notas recalculadas pela norma (sexo, idade, tempo).
            </Text>
          ) : null}

          {tab === 'graficos' ? (
            <Suspense
              fallback={
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color={theme.gain} />
                </View>
              }
            >
              <EstatisticasGraficosPanel stats={s} />
            </Suspense>
          ) : null}

          {(tab === 'geral' || tab === 'modalidade') && (
            <StatSection title="Resumo geral" accent="cyan">
              <View style={styles.kpiGrid}>
                <KpiCard label="Cadastros" value={s.resumo.totalCadastros} sparkData={sparkTotais} flashKey={s.resumo.totalCadastros} />
                <KpiCard
                  label="Com registro TAF"
                  value={s.resumo.comQualquerRegistroTaf}
                  hint={pctHint(Math.round((s.resumo.comQualquerRegistroTaf / s.resumo.totalCadastros) * 100))}
                  variant="gain"
                  flashKey={s.resumo.comQualquerRegistroTaf}
                />
                <KpiCard label="TAF completo" value={s.resumo.tafCompleto} hint={pctHint(s.resumo.taxaConclusaoTafPct)} variant="gain" />
                <KpiCard label="TAF parcial" value={s.resumo.tafParcial} variant="default" />
                <KpiCard label="Sem teste" value={s.resumo.semNenhumTeste} />
                <KpiCard label="Idade média" value={s.resumo.idadeMedia ?? '—'} hint="anos" />
                <KpiCard
                  label="Média militares/dia"
                  value={s.resumo.mediaMilitaresPorDia}
                  hint={`${s.resumo.diasComAplicacao} dias c/ aplicação`}
                  variant="gain"
                />
              </View>
            </StatSection>
          )}

          {tab === 'geral' && (
            <>
              <StatSection title="Conclusão e meta" subtitle={`Meta ${META_CONCLUSAO_TAF_PCT}% de TAF completo`} accent="violet">
                <View style={styles.kpiGrid}>
                  <KpiCard label="Taxa conclusão" value={s.resumo.taxaConclusaoTafPct ?? '—'} hint="%" variant="gain" />
                  <KpiCard label="Meta atual" value={s.metaConclusao.atualPct} hint={`meta ${s.metaConclusao.metaPct}%`} />
                  <KpiCard label="Faltam p/ meta" value={s.metaConclusao.faltam} variant="loss" />
                  <KpiCard label="Aprovação global (3 provas)" value={s.taxas.taxaGlobalAprovacaoPct ?? '—'} hint="%" variant="gain" />
                  <KpiCard label="Reprov. 2+ modalidades" value={s.taxas.reprovados2PlusModalidadesPct ?? '—'} hint="%" variant="loss" />
                </View>
              </StatSection>

              <StatSection title="Pendências">
                <StatBarChart items={s.pendenciasModalidade} barColor={theme.loss} />
              </StatSection>

              <StatSection title="Operacional (histórico)">
                <View style={styles.kpiGrid}>
                  <KpiCard label="Sessões aplicadas" value={s.operacional.totalSessoes} />
                  <KpiCard label="Média particip./sessão" value={s.operacional.mediaParticipantesPorSessao} />
                  <KpiCard label="Prova + aplicada" value={s.operacional.provaMaisAplicada} />
                </View>
              </StatSection>

              <StatSection title="Qualidade dos dados">
                <View style={styles.kpiGrid}>
                  <KpiCard label="Cadastros incompletos" value={s.qualidade.cadastrosIncompletos} variant="loss" />
                  <KpiCard label="Notas inconsistentes" value={s.qualidade.notasInconsistentes} variant="loss" />
                  <KpiCard label="Idade inválida" value={s.qualidade.idadeInvalida} />
                </View>
              </StatSection>

              <StatSection title="Notas globais">
                <View style={styles.kpiGrid}>
                  <KpiCard label="Média geral" value={s.notaMediaGeral ?? '—'} variant="gain" />
                  <KpiCard label="Mediana" value={s.medianaNotas ?? '—'} />
                  <KpiCard label="Média corrida" value={s.notaMediaCorrida ?? '—'} />
                  <KpiCard label="Média caminhada" value={s.notaMediaCaminhada ?? '—'} />
                  <KpiCard label="Média natação" value={s.notaMediaNatacao ?? '—'} />
                </View>
              </StatSection>

              <StatSection title="Taxas de aprovação e nota ≥ 50">
                <View style={styles.kpiGrid}>
                  <KpiCard label="Corrida sem reprov." value={s.taxas.corridaSemReprovacaoPct ?? '—'} hint="%" variant="gain" />
                  <KpiCard label="Caminhada sem reprov." value={s.taxas.caminhadaSemReprovacaoPct ?? '—'} hint="%" variant="gain" />
                  <KpiCard label="Natação sem reprov." value={s.taxas.natacaoSemReprovacaoPct ?? '—'} hint="%" variant="gain" />
                  <KpiCard label="Permanência aprov." value={s.taxas.permanenciaAprovadosPct ?? '—'} hint="%" variant="gain" />
                  <KpiCard label="Corrida nota ≥ 50" value={s.taxas.corridaNota50PlusPct ?? '—'} hint="%" />
                  <KpiCard label="Caminhada nota ≥ 50" value={s.taxas.caminhadaNota50PlusPct ?? '—'} hint="%" />
                  <KpiCard label="Natação nota ≥ 50" value={s.taxas.natacaoNota50PlusPct ?? '—'} hint="%" />
                </View>
              </StatSection>

              <StatSection title="Aprovação por categoria">
                <StatBarChart items={s.aprovacaoPorCategoria} barColor={theme.gain} />
              </StatSection>

              {s.topPostosGrad.length > 0 ? (
                <StatSection title="Postos e graduações (top 10)">
                  <StatBarChart items={s.topPostosGrad} />
                </StatSection>
              ) : null}

              {s.desempenhoPorPosto.length > 0 ? (
                <StatSection title="Nota média por posto (top 12)">
                  <StatBarChart
                    items={s.desempenhoPorPosto.map((i) => ({ ...i, label: `${i.label} (${i.hint})` }))}
                    barColor={theme.primary}
                  />
                </StatSection>
              ) : null}

              <StatSection title="Perfil dos cadastrados">
                <Text style={[ts.label, styles.subHeading]}>Categoria</Text>
                <StatBarChart items={s.porCategoria} barColor={theme.textMuted} />
                <Text style={[ts.label, styles.subHeading]}>Sexo</Text>
                <StatBarChart items={s.porSexo} barColor={theme.primary} />
                <Text style={[ts.label, styles.subHeading]}>Faixa etária</Text>
                <StatBarChart items={s.porFaixaEtaria} barColor={theme.gain} />
              </StatSection>

              {s.registrosPorMes.length > 0 ? (
                <StatSection title="Registros por mês">
                  {s.registrosPorMes.map((row) => (
                    <View key={row.mes} style={[styles.dataRow, { borderBottomColor: theme.borderSubtle }]}>
                      <Text style={[styles.dataDate, { color: theme.text }]}>{row.mes}</Text>
                      <MonoValue size="sm" variant="muted">
                        C{row.corrida} Cam{row.caminhada} N{row.natacao} P{row.permanencia} Σ{row.total}
                      </MonoValue>
                    </View>
                  ))}
                </StatSection>
              ) : null}

              {s.registrosPorData.length > 0 ? (
                <StatSection title="Registros por data">
                  {s.registrosPorData.map((row) => (
                    <View key={row.data} style={[styles.dataRow, { borderBottomColor: theme.borderSubtle }]}>
                      <Text style={[styles.dataDate, { color: theme.text }]}>{row.data}</Text>
                      <MonoValue size="sm" variant="muted">
                        {row.militaresUnicos} mil. · C{row.corrida} Cam{row.caminhada} N{row.natacao} P{row.permanencia}
                      </MonoValue>
                    </View>
                  ))}
                </StatSection>
              ) : null}
            </>
          )}

          {(tab === 'geral' || tab === 'modalidade') && (
            <>
              <StatSection title="Registros por modalidade" subtitle="Cadastros com resultado em cada prova" accent="violet">
                <View style={styles.kpiGrid}>
                  <KpiCard label="Corrida 2400 m" value={s.resumo.comCorrida} variant="gain" />
                  <KpiCard label="Caminhada 4800 m" value={s.resumo.comCaminhada} variant="gain" />
                  <KpiCard label="Natação 50 m" value={s.resumo.comNatacao} />
                  <KpiCard label="Permanência" value={s.resumo.comPermanencia} />
                </View>
                <StatBarChart items={s.registrosModalidade} barColor={theme.gain} />
              </StatSection>

              <StatSection title="Corrida vs Caminhada">
                <StatBarChart items={s.corridaVsCaminhada} barColor={theme.primary} />
              </StatSection>
            </>
          )}

          {tab === 'modalidade' && (
            <>
              {(['Corrida', 'Caminhada', 'Natação', 'Permanência'] as const).map((nome, idx) => {
                const tempos = [s.temposCorrida, s.temposCaminhada, s.temposNatacao, s.temposPermanencia][idx];
                return (
                  <StatSection key={nome} title={`Tempos — ${nome}`} subtitle={`n=${tempos.amostra}`}>
                    <View style={styles.kpiGrid}>
                      <KpiCard label="Média" value={tempos.mediaFmt} variant="gain" />
                      <KpiCard label="Melhor" value={tempos.melhorFmt ?? '—'} variant="gain" />
                      <KpiCard label="Pior" value={tempos.piorFmt ?? '—'} variant="loss" />
                    </View>
                  </StatSection>
                );
              })}

              {s.rankingTempos.corrida.length > 0 ? (
                <StatSection title="Top 10 — Corrida (melhores tempos)">
                  {s.rankingTempos.corrida.map((r, i) => (
                    <View key={`${r.nip}-${i}`} style={[styles.dataRow, { borderBottomColor: theme.borderSubtle }]}>
                      <Text style={[styles.dataDate, { color: theme.text }]} numberOfLines={1}>
                        {i + 1}. {r.nome}
                      </Text>
                      <MonoValue size="sm" variant="gain">{r.tempoFmt}</MonoValue>
                    </View>
                  ))}
                </StatSection>
              ) : null}

              {s.rankingTempos.caminhada.length > 0 ? (
                <StatSection title="Top 10 — Caminhada">
                  {s.rankingTempos.caminhada.map((r, i) => (
                    <View key={`${r.nip}-${i}`} style={[styles.dataRow, { borderBottomColor: theme.borderSubtle }]}>
                      <Text style={[styles.dataDate, { color: theme.text }]} numberOfLines={1}>
                        {i + 1}. {r.nome}
                      </Text>
                      <MonoValue size="sm" variant="gain">{r.tempoFmt}</MonoValue>
                    </View>
                  ))}
                </StatSection>
              ) : null}

              {s.rankingTempos.natacao.length > 0 ? (
                <StatSection title="Top 10 — Natação">
                  {s.rankingTempos.natacao.map((r, i) => (
                    <View key={`${r.nip}-${i}`} style={[styles.dataRow, { borderBottomColor: theme.borderSubtle }]}>
                      <Text style={[styles.dataDate, { color: theme.text }]} numberOfLines={1}>
                        {i + 1}. {r.nome}
                      </Text>
                      <MonoValue size="sm" variant="gain">{r.tempoFmt}</MonoValue>
                    </View>
                  ))}
                </StatSection>
              ) : null}
            </>
          )}

          {tab === 'notas' && (
            <>
              <StatSection
                title="Notas — Corrida"
                subtitle={
                  s.notaMediaCorrida != null
                    ? `Média ${s.notaMediaCorrida} · OK ${s.taxas.corridaSemReprovacaoPct ?? '—'}% · ≥50 ${s.taxas.corridaNota50PlusPct ?? '—'}%`
                    : undefined
                }
              >
                <StatBarChart items={s.notasCorrida} barColor={theme.gain} />
              </StatSection>
              <StatSection
                title="Notas — Caminhada"
                subtitle={
                  s.notaMediaCaminhada != null
                    ? `Média ${s.notaMediaCaminhada} · OK ${s.taxas.caminhadaSemReprovacaoPct ?? '—'}% · ≥50 ${s.taxas.caminhadaNota50PlusPct ?? '—'}%`
                    : undefined
                }
              >
                <StatBarChart items={s.notasCaminhada} barColor={theme.primary} />
              </StatSection>
              <StatSection
                title="Notas — Natação"
                subtitle={
                  s.notaMediaNatacao != null
                    ? `Média ${s.notaMediaNatacao} · OK ${s.taxas.natacaoSemReprovacaoPct ?? '—'}% · ≥50 ${s.taxas.natacaoNota50PlusPct ?? '—'}%`
                    : undefined
                }
              >
                <StatBarChart items={s.notasNatacao} barColor={theme.primary} />
              </StatSection>
              <StatSection title="Permanência">
                <StatBarChart
                  items={s.permanencia}
                  barColor={(s.taxas.permanenciaAprovadosPct ?? 0) >= 50 ? theme.gain : theme.loss}
                />
              </StatSection>

              <StatSection title="Nota média por faixa etária">
                {Object.entries(s.notaMediaPorFaixaEtaria).map(([faixa, g]) => (
                  <View key={faixa} style={[styles.dataRow, { borderBottomColor: theme.borderSubtle }]}>
                    <Text style={[styles.dataDate, { color: theme.text }]}>{faixa}</Text>
                    <MonoValue size="sm" variant="muted">
                      C {g.corrida ?? '—'} · Cam {g.caminhada ?? '—'} · N {g.natacao ?? '—'}
                    </MonoValue>
                  </View>
                ))}
              </StatSection>

              <StatSection title="Nota média por sexo">
                {Object.entries(s.notaMediaPorSexo).map(([sexo, g]) => (
                  <View key={sexo} style={[styles.dataRow, { borderBottomColor: theme.borderSubtle }]}>
                    <Text style={[styles.dataDate, { color: theme.text }]}>{sexo}</Text>
                    <MonoValue size="sm" variant="muted">
                      C {g.corrida ?? '—'} · Cam {g.caminhada ?? '—'} · N {g.natacao ?? '—'}
                    </MonoValue>
                  </View>
                ))}
              </StatSection>

              {s.heatmapReprovacao.length > 0 ? (
                <StatSection title="Reprovação por faixa etária (%)">
                  {s.heatmapReprovacao.map((h) => (
                    <View key={h.faixa} style={[styles.dataRow, { borderBottomColor: theme.borderSubtle }]}>
                      <Text style={[styles.dataDate, { color: theme.text }]}>{h.faixa}</Text>
                      <MonoValue size="sm" variant="muted">
                        C {h.corridaPct}% · Cam {h.caminhadaPct}% · N {h.natacaoPct}%
                      </MonoValue>
                    </View>
                  ))}
                </StatSection>
              ) : null}
            </>
          )}
        </>
      )}
    </MobileScreenScaffold>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: 4, gap: 4 },
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
  dataDate: { fontSize: 13, fontWeight: '600', flex: 1 },
});
