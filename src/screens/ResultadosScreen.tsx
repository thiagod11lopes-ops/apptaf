import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuthDataReload } from '../hooks/useAuthDataReload';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight, Trash2, X, ArrowLeftRight } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { ResultadosNavTabs } from '../components/resultados/ResultadosNavTabs';
import { ResultadosNormaLauncher } from '../components/resultados/ResultadosNormaLauncher';
import { ConfirmacaoExcluirSessaoModal } from '../components/sismav/ConfirmacaoExcluirSessaoModal';
import { HistoricoSessaoDetalheModal } from '../components/sismav/HistoricoSessaoDetalheModal';
import { HistoricoModoTesteStripe } from '../components/sismav/HistoricoModoTesteStripe';
import { PressableScale } from '../components/premium/PressableScale';
import { ResultadosConsultaPanel } from '../components/ResultadosConsultaPanel';
import { ResultadosPendenciaParcialPanel } from '../components/ResultadosPendenciaParcialPanel';
import { ResultadosConcluidoPanel } from '../components/ResultadosConcluidoPanel';
import { ResultadosGeralPanel } from '../components/ResultadosGeralPanel';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { getAllCadastros, deleteCadastro, type CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { excluirTodosResultadosTafMilitar } from '../utils/atualizarResultadoTaf';
import {
  ConfirmacaoExcluirCadastroModal,
  type CadastroParaExcluir,
} from '../components/sismav/ConfirmacaoExcluirCadastroModal';
import {
  getAllSessoesAplicacao,
  getDeletedSessoesAplicacao,
  deleteSessaoAplicacao,
  tituloTipoProva,
  type SessaoAplicacaoTaf,
} from '../services/resultadosAplicadosIndexedDb';
import {
  isCadastrosListCacheWarm,
  peekCadastrosListCache,
} from '../services/cadastrosListCache';
import {
  isSessoesListCacheWarm,
  peekSessoesListCache,
} from '../services/sessoesListCache';
import { isDemoSessaoId } from '../utils/gatherSystemBackupData';
import {
  deleteSessaoFromHistorico,
} from '../services/deleteSessaoHistorico';
import {
  agruparSessoesHistoricoPorTeste,
  idsSessaoHistoricoParaExcluir,
  type SessaoHistoricoAgrupada,
} from '../utils/agruparSessoesHistoricoPorTeste';
import {
  filtrarSessoesPorNorma,
  NORMA_TAF_LABEL,
  type NormaTafVista,
} from '../utils/normaTafResultados';
import {
  filtrarSessoesHistoricoMilitar,
  type FiltroHistoricoMilitar,
} from '../utils/filtrarSessoesHistoricoMilitar';
import {
  isSessaoPersistidaRegistrador,
  isSessaoVirtualRegistrador,
  unificarSessoesComCadastroRegistrador,
} from '../utils/sessoesUnificadasResultados';
import {
  isSessaoModoTeste,
} from '../utils/historicoSessoesModoTeste';
import { tableFullWidthStyle } from '../theme/tableLayout';
import { getUiColors } from '../theme/uiColors';
import { PREMIUM } from '../theme/premium';
import { MobileScreenScaffold } from '../components/mobile/MobileScreenScaffold';
import { TafCenteredTabHeader, TafGlassPanel } from '../components/mobile/TafTabChrome';
import { TopActionIcons } from '../components/premium/TopActionIcons';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Resultados'>,
  NativeStackNavigationProp<RootStackParamList>
>;
type AbaResultados =
  | 'historico'
  | 'consulta'
  | 'pendencia'
  | 'pendenciaTotal'
  | 'geral'
  | 'concluido';

export default function ResultadosScreen() {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const navigation = useNavigation<Nav>();
  const [aba, setAba] = useState<AbaResultados>('historico');
  const [normaVista, setNormaVista] = useState<NormaTafVista | null>(null);
  /** Sessões ativas (com demo) — fonte única SWR; histórico unifica a partir daqui. */
  const [sessoesRaw, setSessoesRaw] = useState<SessaoAplicacaoTaf[]>(
    () => peekSessoesListCache({ includeDemo: true }) ?? [],
  );
  const [cadastros, setCadastros] = useState<CadastroItemPersist[]>(
    () => peekCadastrosListCache() ?? [],
  );
  /** Unificação pesada fica no `carregar` (após yield), não no first paint. */
  const [sessoes, setSessoes] = useState<SessaoAplicacaoTaf[]>(
    () => peekSessoesListCache({ includeDemo: true }) ?? [],
  );
  const [historicoFiltroMilitar, setHistoricoFiltroMilitar] = useState<FiltroHistoricoMilitar | null>(
    null,
  );
  /** Só spinner no cold start sem peek — foco com dados já carregados não limpa a tela. */
  const [carregando, setCarregando] = useState(() => {
    const cad = peekCadastrosListCache();
    const sess = peekSessoesListCache({ includeDemo: true });
    return (cad?.length ?? 0) === 0 && (sess?.length ?? 0) === 0;
  });
  const hasLoadedOnceRef = useRef(false);
  const [sessaoParaExcluir, setSessaoParaExcluir] = useState<SessaoHistoricoAgrupada | null>(null);
  const [sessaoDetalhe, setSessaoDetalhe] = useState<SessaoHistoricoAgrupada | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const [cadastroParaExcluir, setCadastroParaExcluir] = useState<CadastroParaExcluir | null>(null);
  const [excluindoCadastro, setExcluindoCadastro] = useState(false);
  const ultimoToqueCardRef = useRef<{ id: string; at: number } | null>(null);

  /**
   * Painéis recebem sessões já unificadas (sem demo) — evita unificar de novo em
   * Geral/Pendência/Concluído/Consulta.
   */
  const sessoesParaPaineis = useMemo(
    () => sessoes.filter((s) => !isDemoSessaoId(s.id)),
    [sessoes],
  );

  const carregar = useCallback(async () => {
    const peekedCad = peekCadastrosListCache();
    const peekedSess = peekSessoesListCache({ includeDemo: true });

    // Cache quente + já carregou (incl. sessões excluídas): não re-unifica no foco.
    if (
      hasLoadedOnceRef.current &&
      isCadastrosListCacheWarm() &&
      isSessoesListCacheWarm()
    ) {
      setCarregando(false);
      return;
    }

    if (peekedCad) setCadastros(peekedCad);
    if (peekedSess) setSessoesRaw(peekedSess);

    const cold = !hasLoadedOnceRef.current;
    const hasPeek = (peekedCad?.length ?? 0) > 0 || (peekedSess?.length ?? 0) > 0;
    if (cold && !hasPeek) setCarregando(true);

    try {
      const [cadastrosLista, sessoesLista, sessoesExcluidas] = await Promise.all([
        getAllCadastros(),
        getAllSessoesAplicacao({ includeDemo: true }),
        getDeletedSessoesAplicacao(),
      ]);
      setCadastros(cadastrosLista);
      setSessoesRaw(sessoesLista);
      // Cede o frame antes da unificação (CPU-bound) para a UI não travar.
      const { yieldToUi } = await import('../utils/yieldToUi');
      await yieldToUi();
      setSessoes(
        unificarSessoesComCadastroRegistrador(sessoesLista, cadastrosLista, sessoesExcluidas),
      );
      hasLoadedOnceRef.current = true;
    } catch (error) {
      console.warn('[historico] falha ao carregar sessões:', error);
    } finally {
      setCarregando(false);
    }
  }, []);

  useAuthDataReload(carregar, {
    scopes: ['cadastros', 'sessoes', 'fatores', 'restritos'],
  });

  const sessoesPorNorma = useMemo(() => {
    if (!normaVista) return [];
    return filtrarSessoesPorNorma(sessoes, normaVista);
  }, [sessoes, normaVista]);

  const sessoesHistoricoVisiveis = useMemo(() => {
    if (!normaVista) return [];
    const base = sessoesPorNorma;
    const filtradas = historicoFiltroMilitar
      ? filtrarSessoesHistoricoMilitar(base, historicoFiltroMilitar, cadastros)
      : base;
    return agruparSessoesHistoricoPorTeste(filtradas);
  }, [sessoesPorNorma, historicoFiltroMilitar, cadastros, normaVista]);

  const abrirHistoricoMilitar = useCallback((filtro: FiltroHistoricoMilitar) => {
    setHistoricoFiltroMilitar(filtro);
    setAba('historico');
  }, []);

  const limparFiltroHistorico = useCallback(() => {
    setHistoricoFiltroMilitar(null);
  }, []);

  const mudarAba = useCallback((novaAba: AbaResultados) => {
    if (novaAba !== 'historico') {
      setHistoricoFiltroMilitar(null);
    }
    setAba(novaAba);
  }, []);

  const abrirDetalheSessao = useCallback((sessao: SessaoHistoricoAgrupada) => {
    setSessaoDetalhe(sessao);
  }, []);

  const abrirSessao = useCallback(
    (sessao: SessaoHistoricoAgrupada) => {
      navigation.navigate('CadastrarResultados', {
        resultados: sessao.resultados,
        aplicadorAssinatura: sessao.aplicadorAssinatura,
        returnTo: 'Resultados',
      });
    },
    [navigation],
  );

  /** Dois toques/cliques no card abrem a tabela do histórico. */
  const onPressCardHistorico = useCallback(
    (sessao: SessaoHistoricoAgrupada) => {
      const agora = Date.now();
      const ultimo = ultimoToqueCardRef.current;
      if (ultimo && ultimo.id === sessao.id && agora - ultimo.at < 320) {
        ultimoToqueCardRef.current = null;
        abrirDetalheSessao(sessao);
        return;
      }
      ultimoToqueCardRef.current = { id: sessao.id, at: agora };
    },
    [abrirDetalheSessao],
  );

  const executarExclusao = useCallback(async () => {
    if (!sessaoParaExcluir) return;
    setExcluindo(true);
    setErroExclusao(null);
    try {
      const ids = idsSessaoHistoricoParaExcluir(sessaoParaExcluir);
      await deleteSessaoFromHistorico(sessaoParaExcluir);
      for (const id of ids) {
        if (id === sessaoParaExcluir.id) continue;
        try {
          await deleteSessaoAplicacao(id);
        } catch {
          // Sessão já removida ou só virtual.
        }
      }
      setSessaoParaExcluir(null);
      await carregar();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não foi possível excluir a sessão.';
      setErroExclusao(msg);
    } finally {
      setExcluindo(false);
    }
  }, [sessaoParaExcluir, carregar]);

  const executarExclusaoCadastro = useCallback(async () => {
    if (!cadastroParaExcluir) return;
    setExcluindoCadastro(true);
    try {
      const cadastroCompleto = cadastros.find((c) => c.id === cadastroParaExcluir.id);
      if (cadastroCompleto) {
        await excluirTodosResultadosTafMilitar(cadastroCompleto);
      }
      await deleteCadastro(cadastroParaExcluir.id);
      setCadastroParaExcluir(null);
      await carregar();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não foi possível excluir o militar.';
      console.warn('[excluirCadastro]', msg);
    } finally {
      setExcluindoCadastro(false);
    }
  }, [cadastroParaExcluir, cadastros, carregar]);

  return (
    <>
    <MobileScreenScaffold contentContainerStyle={styles.scroll}>
        <TafCenteredTabHeader
          title="Resultados"
          subtitle={
            normaVista
              ? `${NORMA_TAF_LABEL[normaVista]} · histórico · gerenciar · geral · pendência parcial · pendência total · concluídos`
              : 'Selecione TAF Armada ou TAF CFN'
          }
          footer={<TopActionIcons activeRoute="Resultados" inline centered />}
        />

        {normaVista ? (
          <>
            <TafGlassPanel accent="cyan" style={styles.normaBanner}>
              <View style={styles.normaBannerRow}>
                <View style={styles.normaBannerTexto}>
                  <Text style={[ts.label, { color: theme.primary }]}>{NORMA_TAF_LABEL[normaVista]}</Text>
                  <Text style={[ts.caption, { color: theme.textMuted, marginTop: 4 }]}>
                    {normaVista === 'cfn'
                      ? 'Corrida 3200 m, natação 100 m, flexões, abdominais e permanência'
                      : 'Corrida, caminhada, natação e permanência'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setNormaVista(null)}
                  style={[styles.trocarNormaBtn, { borderColor: theme.border }]}
                  accessibilityLabel="Trocar norma TAF"
                  accessibilityRole="button"
                >
                  <ArrowLeftRight size={16} color={theme.textSecondary} strokeWidth={2.4} />
                  <Text style={[ts.caption, { color: theme.textSecondary, fontWeight: '700' }]}>
                    Trocar
                  </Text>
                </TouchableOpacity>
              </View>
            </TafGlassPanel>

            <ResultadosNavTabs value={aba} onChange={mudarAba} />

        {aba === 'historico' ? (
          <>
            {historicoFiltroMilitar ? (
              <TafGlassPanel accent="cyan" style={styles.filtroHistoricoBanner}>
                <View style={styles.filtroHistoricoRow}>
                  <View style={styles.filtroHistoricoTexto}>
                    <Text style={[ts.label, { color: theme.primary }]}>Histórico do militar</Text>
                    <Text style={[ts.body, { color: ui.text, marginTop: 4 }]}>
                      {historicoFiltroMilitar.nome}
                      {historicoFiltroMilitar.nip && historicoFiltroMilitar.nip !== '—'
                        ? ` · NIP ${historicoFiltroMilitar.nip}`
                        : ''}
                    </Text>
                    <Text style={[ts.caption, { color: theme.textMuted, marginTop: 4 }]}>
                      {sessoesHistoricoVisiveis.length} teste
                      {sessoesHistoricoVisiveis.length !== 1 ? 's' : ''} registrado
                      {sessoesHistoricoVisiveis.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={limparFiltroHistorico}
                    style={[styles.limparFiltroBtn, { borderColor: theme.border }]}
                    accessibilityLabel="Ver histórico completo"
                    accessibilityRole="button"
                  >
                    <X size={18} color={theme.textSecondary} strokeWidth={2.4} />
                  </TouchableOpacity>
                </View>
              </TafGlassPanel>
            ) : null}

            {carregando ? (
              <Text style={[ts.caption, { color: theme.textMuted, textAlign: 'center' }]}>
                Carregando…
              </Text>
            ) : null}

            {erroExclusao ? (
              <Text style={[ts.caption, styles.erroExclusao, { color: theme.loss }]}>
                {erroExclusao}
              </Text>
            ) : null}

            {!carregando && sessoesHistoricoVisiveis.length === 0 ? (
              <TafGlassPanel style={styles.emptyCard}>
                <Text style={[ts.body, { color: theme.text, textAlign: 'center' }]}>
                  {historicoFiltroMilitar
                    ? 'Nenhum teste registrado para este militar.'
                    : 'Nenhuma aplicação registrada ainda.'}
                </Text>
                <Text style={[ts.caption, styles.emptyHint, { color: theme.textMuted, textAlign: 'center' }]}>
                  {historicoFiltroMilitar
                    ? 'Use Aplicar TAF ou o Registrador de TAF para registrar novas provas.'
                    : 'Use Aplicar TAF ou o Registrador de TAF; os resultados aparecerão aqui.'}
                </Text>
              </TafGlassPanel>
            ) : null}

            {sessoesHistoricoVisiveis.map((sessao) => {
              const tituloProva = tituloTipoProva(sessao.tipoProva);
              const nomeAplicador = sessao.aplicadorAssinatura?.nome?.trim();
              const titulo = nomeAplicador
                ? `${tituloProva} - Aplicador (${nomeAplicador})`
                : tituloProva;
              const qtd = sessao.resultados.length;
              const virtualRegistrador = isSessaoVirtualRegistrador(sessao);
              const registradorPersistido = isSessaoPersistidaRegistrador(sessao);
              const aprovados = sessao.resultados.filter(
                (r) => r.notaTexto !== 'REPROVADO' && r.reprovacaoTexto == null,
              ).length;
              const modoTeste = isSessaoModoTeste(sessao);

              return (
                <View key={sessao.id} style={styles.itemPress}>
                  <TafGlassPanel style={styles.sessaoCard}>
                    <View style={styles.sessaoRow}>
                      <PressableScale
                        onPress={() => onPressCardHistorico(sessao)}
                        {...(Platform.OS === 'web'
                          ? ({
                              onClick: (e: { detail?: number }) => {
                                if (e?.detail === 2) abrirDetalheSessao(sessao);
                              },
                            } as object)
                          : null)}
                        style={styles.sessaoMain}
                        accessibilityHint="Toque duas vezes para ver a tabela de resultados"
                      >
                        <View style={styles.sessaoText}>
                          <Text style={[ts.label, { color: theme.primary }]}>{titulo}</Text>
                          <Text style={[ts.h2, { color: ui.text, marginTop: 4 }]}>
                            {sessao.dataAplicacao}
                          </Text>
                          <Text style={[ts.caption, { color: theme.textMuted, marginTop: 6 }]}>
                            {qtd} participante{qtd !== 1 ? 's' : ''}
                            {sessao.tipoProva === 'permanencia'
                              ? ` · ${aprovados} aprovado${aprovados !== 1 ? 's' : ''}`
                              : null}
                            {virtualRegistrador
                              ? registradorPersistido
                                ? ' · Cadastro manual'
                                : ' · Registrador de TAF'
                              : null}
                            {modoTeste ? ' · Exemplo' : null}
                          </Text>
                        </View>
                      </PressableScale>
                      <TouchableOpacity
                        onPress={() => abrirSessao(sessao)}
                        accessibilityLabel="Abrir resumo da aplicação"
                        accessibilityRole="button"
                        hitSlop={8}
                        style={styles.chevronBtn}
                      >
                        <ChevronRight size={22} color={ui.icon} strokeWidth={2.5} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setErroExclusao(null);
                          setSessaoParaExcluir(sessao);
                        }}
                        style={[styles.trashBtn, { borderColor: theme.loss }]}
                        accessibilityLabel="Excluir sessão do histórico"
                        accessibilityRole="button"
                      >
                        <Trash2 size={20} color={theme.loss} strokeWidth={2.2} />
                      </TouchableOpacity>
                    </View>
                    {modoTeste ? <HistoricoModoTesteStripe /> : null}
                  </TafGlassPanel>
                </View>
              );
            })}
          </>
        ) : aba === 'consulta' ? (
          <ResultadosConsultaPanel
            normaTaf={normaVista}
            cadastros={cadastros}
            sessoes={sessoesParaPaineis}
            onDatasetRefresh={carregar}
          />
        ) : aba === 'geral' ? (
          <ResultadosGeralPanel
            normaTaf={normaVista}
            onVerHistoricoMilitar={abrirHistoricoMilitar}
            cadastros={cadastros}
            sessoes={sessoesParaPaineis}
            onDatasetRefresh={carregar}
            carregandoDataset={carregando}
          />
        ) : aba === 'concluido' ? (
          <ResultadosConcluidoPanel
            normaTaf={normaVista}
            cadastros={cadastros}
            sessoes={sessoesParaPaineis}
            carregandoDataset={carregando}
            onExcluirCadastro={setCadastroParaExcluir}
          />
        ) : aba === 'pendenciaTotal' ? (
          <ResultadosPendenciaParcialPanel
            normaTaf={normaVista}
            modo="total"
            cadastros={cadastros}
            sessoes={sessoesParaPaineis}
            carregandoDataset={carregando}
            onExcluirCadastro={setCadastroParaExcluir}
          />
        ) : (
          <ResultadosPendenciaParcialPanel
            normaTaf={normaVista}
            modo="parcial"
            cadastros={cadastros}
            sessoes={sessoesParaPaineis}
            carregandoDataset={carregando}
            onExcluirCadastro={setCadastroParaExcluir}
          />
        )}
          </>
        ) : (
          <ResultadosNormaLauncher onArmada={() => setNormaVista('armada')} onCfn={() => setNormaVista('cfn')} />
        )}
    </MobileScreenScaffold>

      <ConfirmacaoExcluirSessaoModal
        sessao={sessaoParaExcluir}
        loading={excluindo}
        onClose={() => {
          if (!excluindo) setSessaoParaExcluir(null);
        }}
        onConfirm={() => void executarExclusao()}
      />

      <HistoricoSessaoDetalheModal
        sessao={sessaoDetalhe}
        onClose={() => setSessaoDetalhe(null)}
        onSessaoAtualizada={(atualizada) => {
          setSessaoDetalhe(atualizada);
          carregar();
        }}
      />

      <ConfirmacaoExcluirCadastroModal
        militar={cadastroParaExcluir}
        loading={excluindoCadastro}
        onClose={() => {
          if (!excluindoCadastro) setCadastroParaExcluir(null);
        }}
        onConfirm={() => void executarExclusaoCadastro()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: 8,
  },
  hero: {
    marginBottom: 16,
    paddingRight: 56,
  },
  title: {
    marginBottom: 6,
  },
  tabScroll: {
    ...tableFullWidthStyle,
    marginBottom: 20,
  },
  tabStack: {
    flexDirection: 'row',
    padding: 8,
    borderRadius: PREMIUM.radiusLg,
    borderWidth: 1,
    gap: 8,
    minWidth: '100%',
  },
  tabBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyCard: {
    marginBottom: 4,
  },
  emptyHint: {
    marginTop: 8,
    lineHeight: 18,
  },
  itemPress: {
    marginBottom: 12,
  },
  sessaoCard: {
    ...tableFullWidthStyle,
    overflow: 'hidden',
    position: 'relative',
  },
  sessaoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: PREMIUM.minTouch,
    gap: 10,
  },
  chevronBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessaoMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: PREMIUM.minTouch,
  },
  sessaoText: {
    flex: 1,
    paddingRight: 8,
  },
  trashBtn: {
    padding: 10,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
  },
  erroExclusao: {
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
  },
  filtroHistoricoBanner: {
    marginBottom: 14,
  },
  filtroHistoricoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  filtroHistoricoTexto: {
    flex: 1,
  },
  limparFiltroBtn: {
    padding: 8,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
  },
  normaBanner: {
    marginBottom: 14,
  },
  normaBannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  normaBannerTexto: {
    flex: 1,
  },
  trocarNormaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
  },
});
