import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Download } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { ResultadosGeralTable } from './ResultadosGeralTable';
import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import { type ResultadoGeralItem } from '../utils/resultadoTafCadastro';
import type { FiltroHistoricoMilitar } from '../utils/filtrarSessoesHistoricoMilitar';
import { listarResultadosGeralFromHistorico } from '../utils/resultadoGeralHistorico';
import { prepararDadosResultadosNorma, type NormaTafVista } from '../utils/normaTafResultados';
import { EditarResultadoTafModal } from './sismav/EditarResultadoTafModal';
import { ConfirmacaoExcluirResultadoGeralModal } from './sismav/ConfirmacaoExcluirResultadoGeralModal';
import { excluirTodosResultadosTafMilitar } from '../utils/atualizarResultadoTaf';
import { nipDigitos } from '../utils/nipFormat';
import { carregarRubricasDasSessoesPorNip } from '../utils/rubricasDasSessoes';
import { salvarResultadosTafPdfEmDownloads } from '../utils/exportResultadosTafPdf';
import { formatBrDateKey } from '../utils/backupNaming';
import { PREMIUM } from '../theme/premium';
import { tableFullWidthStyle } from '../theme/tableLayout';
import { getUiColors } from '../theme/uiColors';
import { getAplicarTafGlass } from './taf/aplicar/aplicarTafTheme';
import { TafGlassPanel } from './mobile/TafTabChrome';

const MIN_BUSCA = 3;

type FiltroModalidade = 'todos' | 'corrida' | 'natacao' | 'permanencia';

function temModalidadeItem(item: ResultadoGeralItem, filtro: FiltroModalidade): boolean {
  switch (filtro) {
    case 'corrida':
      return item.notaCorrida !== '—' || item.notaCaminhada !== '—';
    case 'natacao':
      return item.notaNatacao !== '—';
    case 'permanencia':
      return item.situacaoPermanencia !== '—';
    default:
      return true;
  }
}

function linhaCombinaBusca(item: ResultadoGeralItem, q: string, qDigits: string): boolean {
  const haystack = [
    item.postoGrad,
    item.nip,
    item.nome,
    item.statusTaf,
    item.notaCorrida,
    item.situacaoCorrida,
    item.notaCaminhada,
    item.situacaoCaminhada,
    item.notaNatacao,
    item.situacaoNatacao,
    item.permanenciaTempo,
    item.situacaoPermanencia,
  ]
    .join(' ')
    .toLowerCase();

  if (haystack.includes(q)) return true;
  if (qDigits) return nipDigitos(item.nip).includes(qDigits);
  return false;
}

export function ResultadosGeralPanel({
  normaTaf = 'armada',
  onVerHistoricoMilitar,
  cadastros: cadastrosDataset,
  sessoes: sessoesDataset,
  onDatasetRefresh,
  carregandoDataset = false,
}: {
  normaTaf?: NormaTafVista;
  onVerHistoricoMilitar?: (filtro: FiltroHistoricoMilitar) => void;
  /** Dataset SWR do ResultadosScreen — evita getAll* por painel. */
  cadastros: CadastroItemPersist[];
  sessoes: SessaoAplicacaoTaf[];
  onDatasetRefresh?: () => void | Promise<void>;
  carregandoDataset?: boolean;
}) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const glass = getAplicarTafGlass(theme);

  const [lista, setLista] = useState<ResultadoGeralItem[]>([]);
  const [cadastros, setCadastros] = useState<CadastroItemPersist[]>([]);
  const [sessoes, setSessoes] = useState<SessaoAplicacaoTaf[]>([]);
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroModalidade, setFiltroModalidade] = useState<FiltroModalidade>('todos');
  const [cadastroEmEdicao, setCadastroEmEdicao] = useState<CadastroItemPersist | null>(null);
  const [militarParaExcluir, setMilitarParaExcluir] = useState<ResultadoGeralItem | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [salvandoCompleto, setSalvandoCompleto] = useState(false);
  const [avisoPdf, setAvisoPdf] = useState<string | null>(null);

  useEffect(() => {
    const { sessoesNorma, cadastrosNorma } = prepararDadosResultadosNorma(
      sessoesDataset,
      cadastrosDataset,
      normaTaf,
      { jaUnificadas: true },
    );
    setCadastros(cadastrosNorma);
    setSessoes(sessoesNorma);
    setLista(
      listarResultadosGeralFromHistorico(sessoesNorma, cadastrosNorma, { jaUnificadas: true }),
    );
  }, [cadastrosDataset, sessoesDataset, normaTaf]);

  const carregando = carregandoDataset && lista.length === 0;

  const recarregarLista = useCallback(async () => {
    await onDatasetRefresh?.();
  }, [onDatasetRefresh]);

  const salvarArquivoCompleto = useCallback(async () => {
    if (salvandoCompleto || lista.length === 0) return;
    setSalvandoCompleto(true);
    setAvisoPdf(null);
    try {
      const { yieldToUi } = await import('../utils/yieldToUi');
      await yieldToUi();
      const nipsLista = lista.map((l) => l.nip);
      const rubSessoes = await carregarRubricasDasSessoesPorNip(nipsLista);
      const { montarBlocosResultadosTafPorAplicador } = await import(
        '../utils/resultadosTafPdfPorAplicador'
      );
      const { hydrateSessoesComRubricas } = await import('../utils/hydrateRubricas');
      const sessoesHydrated = await hydrateSessoesComRubricas(sessoes);
      const blocos = montarBlocosResultadosTafPorAplicador({
        sessoes: sessoesHydrated,
        cadastros,
        rubricasSessoes: rubSessoes,
        somenteSessoesInformadas: false,
      });
      if (blocos.length === 0) {
        setAvisoPdf('Não há resultados para exportar.');
        return;
      }
      const normaLabel = normaTaf === 'cfn' ? 'CFN' : 'Armada';
      const subtitulo = `Resultado Geral completo — ${normaLabel} — ${formatBrDateKey(new Date())}`;
      const msg = await salvarResultadosTafPdfEmDownloads(blocos, subtitulo);
      setAvisoPdf(msg);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao salvar o arquivo completo.';
      if (!/cancelad/i.test(msg)) setAvisoPdf(msg);
    } finally {
      setSalvandoCompleto(false);
    }
  }, [salvandoCompleto, lista, cadastros, sessoes, normaTaf]);

  const abrirEdicao = useCallback(
    (item: ResultadoGeralItem) => {
      const cadastro = cadastros.find((c) => c.id === item.id);
      if (cadastro) setCadastroEmEdicao(cadastro);
    },
    [cadastros],
  );

  const aoSalvarEdicao = useCallback(
    async (_atualizado: CadastroItemPersist) => {
      await recarregarLista();
    },
    [recarregarLista],
  );

  const abrirHistorico = useCallback(
    (item: ResultadoGeralItem) => {
      onVerHistoricoMilitar?.({
        id: item.id,
        nip: item.nip,
        nome: item.nome,
      });
    },
    [onVerHistoricoMilitar],
  );

  const executarExclusao = useCallback(async () => {
    if (!militarParaExcluir || excluindo) return;
    const cadastro = cadastros.find((c) => c.id === militarParaExcluir.id);
    if (!cadastro) return;

    setExcluindo(true);
    try {
      await excluirTodosResultadosTafMilitar(cadastro);
      setMilitarParaExcluir(null);
      await recarregarLista();
    } finally {
      setExcluindo(false);
    }
  }, [militarParaExcluir, excluindo, cadastros, recarregarLista]);

  const buscaLower = useMemo(() => {
    const q = filtroBusca.trim().toLowerCase();
    if (q.length > 0 && q.length < MIN_BUSCA) return '';
    return q;
  }, [filtroBusca]);

  const contagensModalidade = useMemo(() => ({
    todos: lista.length,
    corrida: lista.filter((i) => temModalidadeItem(i, 'corrida')).length,
    natacao: lista.filter((i) => temModalidadeItem(i, 'natacao')).length,
    permanencia: lista.filter((i) => temModalidadeItem(i, 'permanencia')).length,
  }), [lista]);

  const linhasVisiveis = useMemo(() => {
    let base = lista;
    if (filtroModalidade !== 'todos') {
      base = base.filter((item) => temModalidadeItem(item, filtroModalidade));
    }
    const q = filtroBusca.trim().toLowerCase();
    if (!q || q.length < MIN_BUSCA) return base;
    const qDigits = q.replace(/\D/g, '');
    return base.filter((item) => linhaCombinaBusca(item, q, qDigits));
  }, [lista, filtroBusca, filtroModalidade]);

  const buscaAtiva = filtroBusca.trim().length >= MIN_BUSCA;

  return (
    <View style={styles.wrap}>
      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchWrap,
            {
              borderColor: buscaAtiva ? theme.primary : glass.border,
              backgroundColor: glass.highlight,
            },
          ]}
        >
          <TextInput
            value={filtroBusca}
            onChangeText={setFiltroBusca}
            placeholder="Buscar NIP, nome ou resultado (mín. 3 caracteres)…"
            placeholderTextColor={theme.textMuted}
            style={[
              styles.searchInput,
              { color: ui.text, backgroundColor: 'transparent' },
              Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
            ]}
            autoCorrect={false}
            spellCheck={false}
            autoCapitalize="none"
            accessibilityLabel="Buscar na tabela de resultado geral"
          />
        </View>
      </View>

      {!carregando && lista.length > 0 ? (
        <TouchableOpacity
          onPress={() => void salvarArquivoCompleto()}
          disabled={salvandoCompleto}
          activeOpacity={0.88}
          accessibilityLabel="Salvar arquivo completo PDF com todos os resultados em Downloads"
          style={[styles.pdfBtnOuter, { opacity: salvandoCompleto ? 0.7 : 1 }]}
        >
          <LinearGradient
            colors={[...theme.tokens.gradientPrimaryBtn]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.pdfBtn,
              Platform.OS === 'web'
                ? ({ boxShadow: '0 6px 16px rgba(37, 99, 235, 0.32)' } as object)
                : null,
            ]}
          >
            {salvandoCompleto ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Download size={18} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.pdfBtnText}>Salvar Arquivo Completo</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      ) : null}

      {avisoPdf ? (
        <Text
          style={[
            ts.caption,
            styles.avisoPdf,
            {
              color: /falha|erro|não foi|indispon/i.test(avisoPdf) ? theme.loss : theme.gain,
            },
          ]}
        >
          {avisoPdf}
        </Text>
      ) : null}

      {lista.length > 0 ? (
        <View style={styles.filtrosWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtrosRow}
          >
            {(
              [
                { key: 'todos', label: 'Todos' },
                { key: 'corrida', label: 'Corrida' },
                { key: 'natacao', label: 'Natação' },
                { key: 'permanencia', label: 'Permanência' },
              ] as { key: FiltroModalidade; label: string }[]
            ).map(({ key, label }) => {
              const ativo = filtroModalidade === key;
              const count = contagensModalidade[key];
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setFiltroModalidade(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativo }}
                  style={[
                    styles.filtroChip,
                    ativo
                      ? { backgroundColor: theme.primary, borderColor: theme.primary }
                      : { backgroundColor: glass.highlight, borderColor: glass.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.filtroChipLabel,
                      { color: ativo ? '#FFFFFF' : theme.textSecondary },
                    ]}
                  >
                    {label}
                  </Text>
                  <View
                    style={[
                      styles.filtroChipBadge,
                      {
                        backgroundColor: ativo
                          ? 'rgba(255,255,255,0.25)'
                          : theme.primary + '22',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filtroChipBadgeText,
                        { color: ativo ? '#FFFFFF' : theme.primary },
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {filtroBusca.trim().length > 0 && filtroBusca.trim().length < MIN_BUSCA ? (
        <Text style={[ts.caption, styles.hintBusca, { color: theme.textMuted }]}>
          Digite pelo menos {MIN_BUSCA} caracteres para filtrar.
        </Text>
      ) : null}

      {carregando ? (
        <Text style={[ts.caption, { color: theme.textMuted, textAlign: 'center' }]}>
          Carregando…
        </Text>
      ) : null}

      {!carregando && lista.length === 0 ? (
        <TafGlassPanel style={styles.emptyCard}>
          <Text style={[ts.body, { color: theme.text, textAlign: 'center' }]}>
            Nenhum resultado consolidado ainda.
          </Text>
        </TafGlassPanel>
      ) : null}

      {!carregando && lista.length > 0 && linhasVisiveis.length === 0 ? (
        <TafGlassPanel style={styles.emptyCard}>
          <Text style={[ts.body, { color: theme.text, textAlign: 'center' }]}>
            {buscaAtiva
              ? `Nenhum resultado para "${filtroBusca.trim()}".`
              : 'Nenhum militar com esta modalidade registrada.'}
          </Text>
        </TafGlassPanel>
      ) : null}

      {!carregando && linhasVisiveis.length > 0 ? (
        <ResultadosGeralTable
          data={linhasVisiveis}
          buscaLower={buscaLower}
          onVerHistorico={abrirHistorico}
          onEditar={abrirEdicao}
          onExcluir={setMilitarParaExcluir}
        />
      ) : null}

      <EditarResultadoTafModal
        visible={!!cadastroEmEdicao}
        cadastro={cadastroEmEdicao}
        onClose={() => setCadastroEmEdicao(null)}
        onSalvo={(atualizado) => {
          setCadastroEmEdicao(null);
          void aoSalvarEdicao(atualizado);
        }}
      />

      <ConfirmacaoExcluirResultadoGeralModal
        militar={militarParaExcluir}
        loading={excluindo}
        onClose={() => {
          if (!excluindo) setMilitarParaExcluir(null);
        }}
        onConfirm={() => void executarExclusao()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: tableFullWidthStyle,
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  searchWrap: {
    flex: 1,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd + 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: Platform.select({ ios: 8, default: 6 }),
  },
  hintBusca: { marginBottom: 12, textAlign: 'center' },
  emptyCard: { marginBottom: 4 },
  pdfBtnOuter: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  pdfBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  avisoPdf: {
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  filtrosWrap: {
    marginBottom: 12,
  },
  filtrosRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 2,
  },
  filtroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
  },
  filtroChipLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  filtroChipBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  filtroChipBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
