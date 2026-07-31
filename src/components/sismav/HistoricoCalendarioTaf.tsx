import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ClipboardPlus,
  Download,
  FlaskConical,
  PenLine,
  Trash2,
} from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { SectionCard } from './SectionCard';
import { PressableScale } from '../premium/PressableScale';
import { CadastrarResultadosManualModal } from './CadastrarResultadosManualModal';
import { ConfirmacaoExcluirResultadoModal } from './ConfirmacaoExcluirResultadoModal';
import { RubricaCaptureModal } from '../RubricaCaptureModal';
import { addCadastro, type CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import {
  tituloTipoProva,
  type SessaoAplicacaoTaf,
  type TipoProvaAplicada,
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
import { agruparSessoesHistoricoPorTeste } from '../../utils/agruparSessoesHistoricoPorTeste';
import { listarResultadosGeralFromHistorico } from '../../utils/resultadoGeralHistorico';
import { enriquecerLinhasComRubricas } from '../../utils/resultadoTafCadastro';
import { carregarRubricasDasSessoesPorNip } from '../../utils/rubricasDasSessoes';
import {
  PERMANENCIA_TEMPO_PDF_PADRAO,
  salvarResultadosTafPdfEmDownloads,
} from '../../utils/exportResultadosTafPdf';
import { coletarAssinaturasAplicadorParaPdf } from '../../utils/assinaturaAplicadorDasSessoes';
import { buscarCadastroPorNomeOuNip } from '../../utils/buscarCadastroPorNomeOuNip';
import { formatNomeComPostoParts } from '../../utils/formatNomeComPosto';
import { postoGradFromCadastro } from '../../utils/resultadoTafCadastro';
import {
  limparResultadoModalidadeCadastro,
  type ModalidadeResultadoTaf,
} from '../../utils/limparResultadoModalidade';
import { removerParticipanteModalidadeDoHistorico } from '../../utils/registroModalidadeHistorico';
import { persistirRubricaModalidadeParticipante } from '../../utils/persistirRubricaCadastro';
import { RubricaCell } from '../RubricaThumb';
import { PREMIUM } from '../../theme/premium';

function modalidadeExcluivel(tipo: TipoProvaAplicada): ModalidadeResultadoTaf {
  return tipo;
}

function nomeResultadoComPosto(
  r: Pick<ResultadoCorridaItem, 'nome' | 'nip'>,
  cadastros: CadastroItemPersist[],
): string {
  const nome = (r.nome ?? '').trim() || '—';
  const busca = buscarCadastroPorNomeOuNip(cadastros, (r.nip ?? '').trim() || nome);
  if (busca.kind === 'found') {
    return formatNomeComPostoParts(postoGradFromCadastro(busca.cadastro), nome);
  }
  return nome;
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

type Props = {
  sessoes: SessaoAplicacaoTaf[];
  cadastros: CadastroItemPersist[];
  onAviso?: (msg: string | null) => void;
  onResultadosCadastrados?: () => void;
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

export function HistoricoCalendarioTaf({
  sessoes,
  cadastros,
  onAviso,
  onResultadosCadastrados,
}: Props) {
  const { theme, isDark } = useTheme();
  const ts = theme.textStyles;
  const hoje = isoHojeLocal();
  const hojeDate = new Date();
  const [ano, setAno] = useState(hojeDate.getFullYear());
  const [mes, setMes] = useState(hojeDate.getMonth());
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [modalCadastrar, setModalCadastrar] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [salvandoRubrica, setSalvandoRubrica] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState<{
    nome: string;
    nip: string;
    modalidade: ModalidadeResultadoTaf;
  } | null>(null);
  const [rubricaEdicao, setRubricaEdicao] = useState<{
    nome: string;
    nip: string;
    modalidade: TipoProvaAplicada;
  } | null>(null);

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
    return agruparSessoesHistoricoPorTeste(sessoesDoDiaIso(sessoes, diaSelecionado));
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
      setDiaSelecionado((prev) => (prev === iso ? null : iso));
      onAviso?.(null);
    },
    [onAviso],
  );

  const prepararLinhasPdfDoDia = useCallback(async () => {
    const linhasBase = listarResultadosGeralFromHistorico(sessoesDoDia, cadastros, {
      somenteSessoesInformadas: true,
    });
    if (linhasBase.length === 0) {
      throw new Error('Não há participantes para exportar neste dia.');
    }
    const rubSessoes = await carregarRubricasDasSessoesPorNip();
    const linhas = enriquecerLinhasComRubricas(linhasBase, cadastros, rubSessoes);
    let assinaturas = await coletarAssinaturasAplicadorParaPdf(sessoesDoDia);
    // Se o dia não trouxe rúbrica (sessões antigas), usa assinaturas do histórico geral.
    if (!assinaturas.some((a) => a.rubricaSvg?.trim())) {
      const gerais = await coletarAssinaturasAplicadorParaPdf();
      if (gerais.length > 0) assinaturas = gerais;
    }
    return { linhas, assinaturas };
  }, [sessoesDoDia, cadastros]);

  const gerarPdfDoDia = useCallback(async () => {
    if (!diaSelecionado || sessoesDoDia.length === 0 || gerandoPdf) return;
    setGerandoPdf(true);
    onAviso?.(null);
    try {
      const { linhas, assinaturas } = await prepararLinhasPdfDoDia();
      const msg = await salvarResultadosTafPdfEmDownloads(
        linhas,
        `Resultados do dia — ${dataBrSelecionada}`,
        assinaturas,
      );
      onAviso?.(msg);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao gerar PDF do dia.';
      if (!/cancelad/i.test(msg)) onAviso?.(msg);
    } finally {
      setGerandoPdf(false);
    }
  }, [
    diaSelecionado,
    sessoesDoDia.length,
    gerandoPdf,
    prepararLinhasPdfDoDia,
    dataBrSelecionada,
    onAviso,
  ]);

  const totalParticipantesDia = useMemo(
    () => sessoesDoDia.reduce((acc, s) => acc + s.resultados.length, 0),
    [sessoesDoDia],
  );

  const executarExclusao = useCallback(async () => {
    if (!confirmarExclusao || excluindo) return;
    setExcluindo(true);
    onAviso?.(null);
    try {
      const busca = buscarCadastroPorNomeOuNip(cadastros, confirmarExclusao.nip);
      if (busca.kind === 'found') {
        const atualizado = limparResultadoModalidadeCadastro(
          busca.cadastro,
          confirmarExclusao.modalidade,
        );
        await addCadastro(atualizado);
        await removerParticipanteModalidadeDoHistorico(
          atualizado.nip,
          confirmarExclusao.modalidade,
          atualizado,
        );
      } else {
        await removerParticipanteModalidadeDoHistorico(
          confirmarExclusao.nip,
          confirmarExclusao.modalidade,
        );
      }
      setConfirmarExclusao(null);
      onAviso?.('Resultado excluído do histórico.');
      onResultadosCadastrados?.();
    } catch (e) {
      onAviso?.(e instanceof Error ? e.message : 'Não foi possível excluir o resultado.');
    } finally {
      setExcluindo(false);
    }
  }, [confirmarExclusao, excluindo, cadastros, onAviso, onResultadosCadastrados]);

  const abrirEdicaoRubrica = useCallback(
    (r: ResultadoCorridaItem, tipoProva: TipoProvaAplicada) => {
      if (salvandoRubrica) return;
      onAviso?.(null);
      setRubricaEdicao({
        nome: nomeResultadoComPosto(r, cadastros),
        nip: (r.nip ?? '').trim(),
        modalidade: r.prova ?? tipoProva,
      });
    },
    [salvandoRubrica, onAviso, cadastros],
  );

  const participanteRubricaEdicao = useMemo((): ResultadoCorridaItem | null => {
    if (!rubricaEdicao) return null;
    return {
      corredor: 1,
      nome: rubricaEdicao.nome,
      nip: rubricaEdicao.nip,
      tempoMs: 0,
      prova: rubricaEdicao.modalidade,
    };
  }, [rubricaEdicao]);

  const confirmarRubricaEdicao = useCallback(
    async (svg: string) => {
      if (!rubricaEdicao || salvandoRubrica) return;
      setSalvandoRubrica(true);
      onAviso?.(null);
      try {
        const { cadastroOk, sessoesAtualizadas } = await persistirRubricaModalidadeParticipante(
          rubricaEdicao.nip,
          rubricaEdicao.nome,
          rubricaEdicao.modalidade,
          svg,
        );
        if (!cadastroOk && sessoesAtualizadas === 0) {
          onAviso?.('Não foi possível salvar a rúbrica. Verifique o NIP no cadastro.');
          return;
        }
        setRubricaEdicao(null);
        onAviso?.('Rúbrica salva com sucesso.');
        onResultadosCadastrados?.();
      } catch (e) {
        onAviso?.(e instanceof Error ? e.message : 'Não foi possível salvar a rúbrica.');
      } finally {
        setSalvandoRubrica(false);
      }
    },
    [rubricaEdicao, salvandoRubrica, onAviso, onResultadosCadastrados],
  );

  return (
    <>
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
                      temTeste ? styles.cellComTeste : styles.cellInativo,
                      {
                        backgroundColor: temTeste ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
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
        Dias marcados tiveram testes aplicados. Toque em qualquer dia para ver ou cadastrar
        resultados.
      </Text>

      {diaSelecionado ? (
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

          {sessoesDoDia.length > 0 ? (
            <PressableScale
              onPress={() => void gerarPdfDoDia()}
              disabled={gerandoPdf}
              style={[styles.btnPdfOuter, gerandoPdf ? { opacity: 0.7 } : null]}
              accessibilityLabel="Gerar PDF único com resultados do dia em Downloads"
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
          ) : null}

          {sessoesDoDia.length === 0 ? (
            <PressableScale
              onPress={() => setModalCadastrar(true)}
              style={styles.btnCadastrarOuter}
              accessibilityLabel="Cadastrar resultados manualmente pelo NIP"
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
                <ClipboardPlus size={18} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.btnPdfText}>Cadastrar Resultados</Text>
              </LinearGradient>
            </PressableScale>
          ) : (
            <PressableScale
              onPress={() => setModalCadastrar(true)}
              style={styles.btnCadastrarOuter}
              accessibilityLabel="Cadastrar resultados manualmente pelo NIP"
            >
              <View
                style={[
                  styles.btnCadastrar,
                  { borderColor: theme.primary, backgroundColor: theme.surface },
                ]}
              >
                <ClipboardPlus size={18} color={theme.primary} strokeWidth={2.4} />
                <Text style={[styles.btnCadastrarText, { color: theme.primary }]}>
                  Cadastrar Resultados
                </Text>
              </View>
            </PressableScale>
          )}

          {sessoesDoDia.length === 0 ? (
            <Text style={[ts.caption, { color: theme.textMuted, marginBottom: 8 }]}>
              Nenhum teste registrado neste dia. Use Cadastrar Resultados para lançar manualmente.
            </Text>
          ) : null}

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
              {sessao.resultados.map((r) => {
                const modalidade = modalidadeExcluivel(sessao.tipoProva);
                const svgRubrica = rubricaSvgParticipante(sessao.tipoProva, r, cadastros);
                const temRubrica = !!svgRubrica?.trim();
                return (
                  <View
                    key={`${sessao.id}-${r.corredor}`}
                    style={[styles.partRow, { borderTopColor: theme.border }]}
                  >
                    <View style={styles.partMain}>
                      <Text style={[ts.body, { color: theme.text, fontWeight: '700' }]} numberOfLines={1}>
                        {nomeResultadoComPosto(r, cadastros)}
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
                      <Text style={[ts.caption, { color: theme.textMuted, marginBottom: 4 }]}>
                        Rúbrica
                      </Text>
                      <TouchableOpacity
                        onPress={() => abrirEdicaoRubrica(r, sessao.tipoProva)}
                        activeOpacity={0.82}
                        disabled={salvandoRubrica}
                        accessibilityLabel={
                          temRubrica ? 'Alterar rúbrica' : 'Adicionar rúbrica'
                        }
                        accessibilityRole="button"
                        style={[
                          styles.rubricaBtn,
                          temRubrica
                            ? styles.rubricaBtnPreenchida
                            : {
                                borderColor: theme.border,
                                backgroundColor: isDark
                                  ? 'rgba(2,6,23,0.35)'
                                  : 'rgba(248,250,252,0.95)',
                              },
                          Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null,
                        ]}
                        {...(Platform.OS === 'web'
                          ? ({
                              onClick: (e: {
                                preventDefault?: () => void;
                                stopPropagation?: () => void;
                              }) => {
                                e?.preventDefault?.();
                                e?.stopPropagation?.();
                                abrirEdicaoRubrica(r, sessao.tipoProva);
                              },
                            } as object)
                          : null)}
                      >
                        {temRubrica ? (
                          <>
                            <RubricaCell
                              svgUri={svgRubrica}
                              maxWidth={120}
                              maxHeight={52}
                            />
                            <Text
                              style={[styles.rubricaHint, { color: theme.textMuted }]}
                              pointerEvents="none"
                            >
                              Toque para alterar
                            </Text>
                          </>
                        ) : (
                          <>
                            <View
                              pointerEvents="none"
                              style={[
                                styles.rubricaAddIcon,
                                {
                                  backgroundColor: isDark
                                    ? 'rgba(37,99,235,0.22)'
                                    : 'rgba(37,99,235,0.1)',
                                  borderColor: theme.primary,
                                },
                              ]}
                            >
                              <PenLine size={18} color={theme.primary} strokeWidth={2.4} />
                            </View>
                            <Text
                              style={[styles.rubricaAddLabel, { color: theme.primary }]}
                              pointerEvents="none"
                            >
                              Adicionar
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                    <PressableScale
                      onPress={() =>
                        setConfirmarExclusao({
                          nome: nomeResultadoComPosto(r, cadastros),
                          nip: (r.nip ?? '').trim(),
                          modalidade,
                        })
                      }
                      style={[styles.trashBtn, { borderColor: theme.border }]}
                      accessibilityLabel={`Excluir participante de ${tituloTipoProva(sessao.tipoProva)}`}
                    >
                      <Trash2 size={16} color={theme.loss} strokeWidth={2.2} />
                    </PressableScale>
                  </View>
                );
              })}
            </View>
          ))}

        </View>
      ) : null}

      <CadastrarResultadosManualModal
        visible={modalCadastrar}
        cadastros={cadastros}
        dataAplicacaoBr={dataBrSelecionada || dataBrDoDiaIso(hoje)}
        onClose={() => setModalCadastrar(false)}
        onSalvo={() => {
          setModalCadastrar(false);
          onAviso?.('Resultados cadastrados com sucesso.');
          onResultadosCadastrados?.();
        }}
      />

    </SectionCard>

    <ConfirmacaoExcluirResultadoModal
      visible={!!confirmarExclusao}
      nome={confirmarExclusao?.nome ?? ''}
      nip={confirmarExclusao?.nip ?? ''}
      modalidade={confirmarExclusao?.modalidade ?? null}
      loading={excluindo}
      onClose={() => {
        if (!excluindo) setConfirmarExclusao(null);
      }}
      onConfirm={() => void executarExclusao()}
    />

    <RubricaCaptureModal
      visible={!!rubricaEdicao}
      participante={participanteRubricaEdicao}
      indice={0}
      total={1}
      tipoProva={rubricaEdicao?.modalidade ?? 'corrida'}
      ultimo
      confirmLabel={salvandoRubrica ? 'Salvando…' : 'Salvar rúbrica'}
      onConfirm={(svg) => {
        if (!salvandoRubrica) void confirmarRubricaEdicao(svg);
      }}
      onSkip={() => {
        if (!salvandoRubrica) setRubricaEdicao(null);
      }}
      onCancel={() => {
        if (!salvandoRubrica) setRubricaEdicao(null);
      }}
    />
    </>
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
  cellInativo: { opacity: 0.85 },
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
    maxWidth: 140,
    zIndex: 2,
  },
  rubricaBtn: {
    width: '100%',
    minHeight: 64,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 4,
  },
  rubricaBtnPreenchida: {
    borderWidth: 0,
    borderStyle: 'solid',
  },
  rubricaAddIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rubricaAddLabel: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  rubricaHint: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  trashBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  btnPdfOuter: { borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
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
  btnCadastrarOuter: { borderRadius: 12, overflow: 'hidden', marginBottom: 14 },
  btnCadastrar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  btnCadastrarText: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    flexShrink: 1,
  },
});
