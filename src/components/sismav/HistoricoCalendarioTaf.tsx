import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, CalendarDays, Download, FlaskConical } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { SectionCard } from './SectionCard';
import { PressableScale } from '../premium/PressableScale';
import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import {
  tituloTipoProva,
  type SessaoAplicacaoTaf,
} from '../../services/resultadosAplicadosIndexedDb';
import type { ResultadoCorridaItem } from '../../navigation/types';
import { formatMsByModality } from '../../taf/tafTimeFormat';
import {
  dataBrDoDiaIso,
  diasComTestesIso,
  gradeCalendarioMes,
  isoHojeLocal,
  sessoesDoDiaIso,
  tituloMesAno,
} from '../../utils/historicoPorDia';
import { listarResultadosGeralFromHistorico } from '../../utils/resultadoGeralHistorico';
import { enriquecerLinhasComRubricas } from '../../utils/resultadoTafCadastro';
import { carregarRubricasDasSessoesPorNip } from '../../utils/rubricasDasSessoes';
import { exportResultadosTafPdf, PERMANENCIA_TEMPO_PDF_PADRAO } from '../../utils/exportResultadosTafPdf';
import { assinaturasUnicasDasSessoes } from '../../utils/assinaturaAplicadorDasSessoes';
import { buscarCadastroPorNomeOuNip } from '../../utils/buscarCadastroPorNomeOuNip';
import { RubricaCell } from '../RubricaThumb';
import { PREMIUM } from '../../theme/premium';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

type Props = {
  sessoes: SessaoAplicacaoTaf[];
  cadastros: CadastroItemPersist[];
  onAviso?: (msg: string | null) => void;
};

function tempoParticipante(tipo: SessaoAplicacaoTaf['tipoProva'], r: ResultadoCorridaItem): string {
  if (tipo === 'permanencia') return PERMANENCIA_TEMPO_PDF_PADRAO;
  const mod = tipo === 'natacao' ? 'natacao' : 'corrida';
  return formatMsByModality(mod, r.tempoMs) || '—';
}

function notaParticipante(r: ResultadoCorridaItem): string {
  const t = (r.notaTexto ?? r.noraTexto ?? '').trim();
  return t || '—';
}

function situacaoParticipante(r: ResultadoCorridaItem): string {
  if (r.reprovacaoTexto?.trim()) return r.reprovacaoTexto.trim();
  const nota = (r.notaTexto ?? '').trim();
  if (nota.toUpperCase() === 'REPROVADO') return 'Reprovado';
  if (tipoPermanenciaNota(nota)) return nota;
  if (nota) return 'Aprovado';
  return '—';
}

function tipoPermanenciaNota(nota: string): boolean {
  const n = nota.toLowerCase();
  return n === 'aprovado' || n === 'reprovado';
}

function rubricaSvgParticipante(
  tipoProva: SessaoAplicacaoTaf['tipoProva'],
  r: ResultadoCorridaItem,
  cadastros: CadastroItemPersist[],
): string | undefined {
  const svgSessao = r.rubricaCandidatoSvg?.trim();
  if (svgSessao) return svgSessao;

  const busca = buscarCadastroPorNomeOuNip(
    cadastros,
    (r.nip ?? '').trim() || (r.nome ?? '').trim(),
  );
  if (busca.kind !== 'found') return undefined;

  const prova = r.prova ?? tipoProva;
  const c = busca.cadastro;
  if (prova === 'caminhada') return c.rubricaCaminhadaSvg;
  if (prova === 'natacao') return c.rubricaNatacaoSvg;
  if (prova === 'permanencia') return c.rubricaPermanenciaSvg;
  return c.rubricaCorridaSvg;
}

export function HistoricoCalendarioTaf({ sessoes, cadastros, onAviso }: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const hoje = isoHojeLocal();
  const hojeDate = new Date();
  const [ano, setAno] = useState(hojeDate.getFullYear());
  const [mes, setMes] = useState(hojeDate.getMonth());
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const diasComTeste = useMemo(() => diasComTestesIso(sessoes), [sessoes]);
  const grade = useMemo(() => gradeCalendarioMes(ano, mes), [ano, mes]);
  const linhasGrade = useMemo(() => {
    const rows: (typeof grade)[] = [];
    for (let i = 0; i < grade.length; i += 7) {
      rows.push(grade.slice(i, i + 7));
    }
    return rows;
  }, [grade]);

  const sessoesDoDia = useMemo(() => {
    if (!diaSelecionado) return [];
    return sessoesDoDiaIso(sessoes, diaSelecionado);
  }, [sessoes, diaSelecionado]);

  const dataBrSelecionada = diaSelecionado ? dataBrDoDiaIso(diaSelecionado) : '';

  const mesAnterior = useCallback(() => {
    setMes((m) => {
      if (m === 0) {
        setAno((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const mesProximo = useCallback(() => {
    setMes((m) => {
      if (m === 11) {
        setAno((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const selecionarDia = useCallback(
    (iso: string) => {
      if (!diasComTeste.has(iso)) return;
      setDiaSelecionado((prev) => (prev === iso ? null : iso));
      onAviso?.(null);
    },
    [diasComTeste, onAviso],
  );

  const gerarPdfDoDia = useCallback(async () => {
    if (!diaSelecionado || sessoesDoDia.length === 0) return;
    setGerandoPdf(true);
    onAviso?.(null);
    try {
      const linhasBase = listarResultadosGeralFromHistorico(sessoesDoDia, cadastros);
      if (linhasBase.length === 0) {
        onAviso?.('Não há participantes para exportar neste dia.');
        return;
      }
      const rubSessoes = await carregarRubricasDasSessoesPorNip();
      const linhas = enriquecerLinhasComRubricas(linhasBase, cadastros, rubSessoes);
      const assinaturas = assinaturasUnicasDasSessoes(sessoesDoDia);
      await exportResultadosTafPdf(linhas, `Resultados do dia — ${dataBrSelecionada}`, assinaturas);
    } catch (e) {
      onAviso?.(e instanceof Error ? e.message : 'Falha ao gerar PDF.');
    } finally {
      setGerandoPdf(false);
    }
  }, [diaSelecionado, sessoesDoDia, cadastros, dataBrSelecionada, onAviso]);

  const totalParticipantesDia = useMemo(
    () => sessoesDoDia.reduce((acc, s) => acc + s.resultados.length, 0),
    [sessoesDoDia],
  );

  return (
    <SectionCard title="Calendário de aplicações" style={styles.section}>
      <View style={styles.navRow}>
        <PressableScale
          onPress={mesAnterior}
          style={[styles.navBtn, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
          accessibilityLabel="Mês anterior"
        >
          <ChevronLeft size={20} color={theme.text} strokeWidth={2.4} />
        </PressableScale>
        <View style={styles.navTituloWrap}>
          <CalendarDays size={18} color={theme.primary} strokeWidth={2.2} />
          <Text style={[ts.h2, styles.navTitulo, { color: theme.text }]}>{tituloMesAno(ano, mes)}</Text>
        </View>
        <PressableScale
          onPress={mesProximo}
          style={[styles.navBtn, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
          accessibilityLabel="Próximo mês"
        >
          <ChevronRight size={20} color={theme.text} strokeWidth={2.4} />
        </PressableScale>
      </View>

      <View style={styles.weekHeader}>
        {DIAS_SEMANA.map((d) => (
          <Text key={d} style={[styles.weekLabel, { color: theme.textMuted }]}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {linhasGrade.map((linha, rowIdx) => (
          <View key={`row-${rowIdx}`} style={styles.gridRow}>
            {linha.map((cel, colIdx) => {
              if (!cel.iso) {
                return <View key={`empty-${rowIdx}-${colIdx}`} style={styles.cellWrap} />;
              }

              const temTeste = diasComTeste.has(cel.iso);
              const selecionado = diaSelecionado === cel.iso;
              const ehHoje = cel.iso === hoje;

              const inner = (
                <>
                  <Text
                    style={[
                      styles.cellNum,
                      { color: selecionado ? '#FFFFFF' : temTeste ? theme.text : theme.textMuted },
                      ehHoje && !selecionado ? { fontWeight: '900' } : null,
                    ]}
                  >
                    {cel.dia}
                  </Text>
                  {temTeste ? (
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: selecionado ? '#FFFFFF' : theme.primary },
                      ]}
                    />
                  ) : (
                    <View style={styles.dotPlaceholder} />
                  )}
                </>
              );

              if (!temTeste) {
                return (
                  <View key={cel.iso} style={styles.cellWrap}>
                    <View
                      style={[
                        styles.cell,
                        styles.cellInativo,
                        ehHoje ? { borderColor: theme.border, borderWidth: 1 } : null,
                      ]}
                    >
                      {inner}
                    </View>
                  </View>
                );
              }

              if (selecionado) {
                return (
                  <PressableScale
                    key={cel.iso}
                    onPress={() => selecionarDia(cel.iso!)}
                    style={styles.cellWrap}
                  >
                    <LinearGradient
                      colors={[...theme.tokens.gradientPrimaryBtn]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[
                        styles.cell,
                        styles.cellAtivo,
                        Platform.OS === 'web'
                          ? ({ boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)' } as object)
                          : null,
                      ]}
                    >
                      {inner}
                    </LinearGradient>
                  </PressableScale>
                );
              }

              return (
                <PressableScale
                  key={cel.iso}
                  onPress={() => selecionarDia(cel.iso!)}
                  style={styles.cellWrap}
                >
                  <View
                    style={[
                      styles.cell,
                      styles.cellComTeste,
                      {
                        backgroundColor: 'rgba(37, 99, 235, 0.08)',
                        borderColor: ehHoje ? theme.primary : theme.border,
                      },
                      ehHoje ? { borderWidth: 2 } : { borderWidth: 1 },
                    ]}
                  >
                    {inner}
                  </View>
                </PressableScale>
              );
            })}
          </View>
        ))}
      </View>

      <Text style={[ts.caption, styles.legenda, { color: theme.textMuted }]}>
        Dias marcados tiveram testes aplicados. Toque para ver a relação.
      </Text>

      {diaSelecionado && sessoesDoDia.length > 0 ? (
        <View
          style={[
            styles.diaPainel,
            {
              borderColor: theme.border,
              backgroundColor: theme.backgroundSecondary,
            },
            Platform.OS === 'web' ? ({ boxShadow: theme.tokens.shadowSm } as object) : null,
          ]}
        >
          <View style={styles.diaPainelTop}>
            <View style={styles.diaPainelTituloWrap}>
              <FlaskConical size={18} color={theme.primary} strokeWidth={2.2} />
              <Text style={[ts.h2, { color: theme.text, fontSize: 17 }]}>
                Testes em {dataBrSelecionada}
              </Text>
            </View>
            <Text style={[ts.caption, { color: theme.textMuted }]}>
              {sessoesDoDia.length} sessão{sessoesDoDia.length !== 1 ? 'ões' : ''} ·{' '}
              {totalParticipantesDia} participante{totalParticipantesDia !== 1 ? 's' : ''}
            </Text>
          </View>

          {sessoesDoDia.map((sessao) => (
            <View
              key={sessao.id}
              style={[styles.sessaoCard, { borderColor: theme.border, backgroundColor: theme.surface }]}
            >
              <Text style={[ts.label, { color: theme.primary }]}>
                {tituloTipoProva(sessao.tipoProva)}
              </Text>
              <Text style={[ts.caption, { color: theme.textMuted, marginBottom: 8 }]}>
                {sessao.resultados.length} participante{sessao.resultados.length !== 1 ? 's' : ''}
              </Text>
              {sessao.resultados.map((r) => (
                <View key={`${sessao.id}-${r.corredor}`} style={[styles.partRow, { borderTopColor: theme.border }]}>
                  <View style={styles.partMain}>
                    <Text style={[ts.body, { color: theme.text, fontWeight: '700' }]} numberOfLines={1}>
                      {r.nome?.trim() || '—'}
                    </Text>
                    <Text style={[ts.caption, { color: theme.textMuted }]}>
                      NIP {r.nip?.trim() || '—'}
                    </Text>
                  </View>
                  <View style={styles.partMeta}>
                    <Text style={[ts.caption, { color: theme.textMuted }]}>Tempo</Text>
                    <Text style={[ts.caption, { color: theme.text, fontWeight: '700' }]}>
                      {tempoParticipante(sessao.tipoProva, r)}
                    </Text>
                    <Text style={[ts.caption, { color: theme.textMuted, marginTop: 4 }]}>Nota</Text>
                    <Text style={[ts.caption, { color: theme.text, fontWeight: '700' }]}>
                      {notaParticipante(r)}
                    </Text>
                    <Text
                      style={[
                        ts.caption,
                        {
                          marginTop: 2,
                          fontWeight: '700',
                          color:
                            situacaoParticipante(r) === 'Reprovado'
                              ? theme.loss
                              : situacaoParticipante(r) === 'Aprovado'
                                ? theme.gain
                                : theme.textMuted,
                        },
                      ]}
                    >
                      {situacaoParticipante(r)}
                    </Text>
                  </View>
                  <View style={styles.partRubrica}>
                    <Text style={[ts.caption, { color: theme.textMuted, marginBottom: 4 }]}>Rúbrica</Text>
                    <RubricaCell
                      svgUri={rubricaSvgParticipante(sessao.tipoProva, r, cadastros)}
                      maxWidth={120}
                      maxHeight={52}
                    />
                  </View>
                </View>
              ))}
            </View>
          ))}

          <PressableScale
            onPress={() => void gerarPdfDoDia()}
            disabled={gerandoPdf}
            style={[styles.btnPdfOuter, gerandoPdf ? { opacity: 0.7 } : null]}
          >
            <LinearGradient
              colors={[...theme.tokens.gradientPrimaryBtn]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.btnPdf,
                Platform.OS === 'web'
                  ? ({ boxShadow: '0 6px 16px rgba(37, 99, 235, 0.32)' } as object)
                  : null,
              ]}
            >
              {gerandoPdf ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Download size={18} color="#FFFFFF" strokeWidth={2.4} />
                  <Text style={styles.btnPdfText}>
                    Gerar Resultados do dia ({dataBrSelecionada})
                  </Text>
                </>
              )}
            </LinearGradient>
          </PressableScale>
        </View>
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 18 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTituloWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  navTitulo: { fontSize: 17, fontWeight: '800' },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  grid: {},
  gridRow: { flexDirection: 'row' },
  cellWrap: { flex: 1, padding: 3 },
  cell: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  cellInativo: { opacity: 0.45 },
  cellAtivo: {},
  cellComTeste: {},
  cellNum: { fontSize: 15, fontWeight: '700' },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 4,
  },
  dotPlaceholder: { height: 9 },
  legenda: { marginTop: 10, textAlign: 'center', lineHeight: 17 },
  diaPainel: {
    marginTop: 16,
    borderRadius: PREMIUM.radiusLg,
    borderWidth: 1,
    padding: 14,
  },
  diaPainelTop: { marginBottom: 12 },
  diaPainelTituloWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sessaoCard: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    padding: 12,
    marginBottom: 10,
  },
  partRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  partMain: { flex: 1, minWidth: 0 },
  partMeta: { alignItems: 'flex-end', minWidth: 72 },
  partRubrica: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 120,
    maxWidth: 130,
  },
  btnPdfOuter: { borderRadius: 12, overflow: 'hidden', marginTop: 4 },
  btnPdf: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  btnPdfText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    flexShrink: 1,
  },
});
