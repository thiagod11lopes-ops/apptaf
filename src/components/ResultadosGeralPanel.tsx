import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Download } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { ResultadosGeralTable } from './ResultadosGeralTable';
import { getAllCadastros, type CadastroItemPersist } from '../services/cadastrosIndexedDb';
import {
  getAllSessoesAplicacao,
  type SessaoAplicacaoTaf,
} from '../services/resultadosAplicadosIndexedDb';
import { enriquecerLinhasComRubricas, type ResultadoGeralItem } from '../utils/resultadoTafCadastro';
import type { FiltroHistoricoMilitar } from '../utils/filtrarSessoesHistoricoMilitar';
import { listarResultadosGeralFromHistorico } from '../utils/resultadoGeralHistorico';
import { prepararDadosResultadosNorma, type NormaTafVista } from '../utils/normaTafResultados';
import { EditarResultadoTafModal } from './sismav/EditarResultadoTafModal';
import { ConfirmacaoExcluirResultadoGeralModal } from './sismav/ConfirmacaoExcluirResultadoGeralModal';
import { excluirTodosResultadosTafMilitar } from '../utils/atualizarResultadoTaf';
import { nipDigitos } from '../utils/nipFormat';
import { carregarRubricasDasSessoesPorNip } from '../utils/rubricasDasSessoes';
import { assinaturasUnicasDasSessoes } from '../utils/assinaturaAplicadorDasSessoes';
import { salvarResultadosTafPdfEmDownloads } from '../utils/exportResultadosTafPdf';
import { formatBrDateKey } from '../utils/backupNaming';
import { PREMIUM } from '../theme/premium';
import { tableFullWidthStyle } from '../theme/tableLayout';
import { getUiColors } from '../theme/uiColors';
import { getAplicarTafGlass } from './taf/aplicar/aplicarTafTheme';
import { TafGlassPanel } from './mobile/TafTabChrome';

const MIN_BUSCA = 3;

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
}: {
  normaTaf?: NormaTafVista;
  onVerHistoricoMilitar?: (filtro: FiltroHistoricoMilitar) => void;
}) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const glass = getAplicarTafGlass(theme);

  const [lista, setLista] = useState<ResultadoGeralItem[]>([]);
  const [cadastros, setCadastros] = useState<CadastroItemPersist[]>([]);
  const [sessoes, setSessoes] = useState<SessaoAplicacaoTaf[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroBusca, setFiltroBusca] = useState('');
  const [cadastroEmEdicao, setCadastroEmEdicao] = useState<CadastroItemPersist | null>(null);
  const [militarParaExcluir, setMilitarParaExcluir] = useState<ResultadoGeralItem | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [salvandoCompleto, setSalvandoCompleto] = useState(false);
  const [avisoPdf, setAvisoPdf] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setCarregando(true);
    Promise.all([getAllCadastros(), getAllSessoesAplicacao()])
      .then(([cadastrosLista, todasSessoes]) => {
        const { sessoesNorma, cadastrosNorma } = prepararDadosResultadosNorma(
          todasSessoes,
          cadastrosLista,
          normaTaf,
        );
        setCadastros(cadastrosNorma);
        setSessoes(sessoesNorma);
        setLista(listarResultadosGeralFromHistorico(sessoesNorma, cadastrosNorma));
      })
      .catch(() => {
        setCadastros([]);
        setSessoes([]);
        setLista([]);
      })
      .finally(() => setCarregando(false));
  }, [normaTaf]);

  const recarregarLista = useCallback(async () => {
    const [cadastrosLista, todasSessoes] = await Promise.all([
      getAllCadastros(),
      getAllSessoesAplicacao(),
    ]);
    const { sessoesNorma, cadastrosNorma } = prepararDadosResultadosNorma(
      todasSessoes,
      cadastrosLista,
      normaTaf,
    );
    setCadastros(cadastrosNorma);
    setSessoes(sessoesNorma);
    setLista(listarResultadosGeralFromHistorico(sessoesNorma, cadastrosNorma));
  }, [normaTaf]);

  const salvarArquivoCompleto = useCallback(async () => {
    if (salvandoCompleto || lista.length === 0) return;
    setSalvandoCompleto(true);
    setAvisoPdf(null);
    try {
      const rubSessoes = await carregarRubricasDasSessoesPorNip();
      const linhas = enriquecerLinhasComRubricas(lista, cadastros, rubSessoes);
      const assinaturas = assinaturasUnicasDasSessoes(sessoes);
      const normaLabel = normaTaf === 'cfn' ? 'CFN' : 'Armada';
      const subtitulo = `Resultado Geral completo — ${normaLabel} — ${formatBrDateKey(new Date())}`;
      const msg = await salvarResultadosTafPdfEmDownloads(linhas, subtitulo, assinaturas);
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

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const buscaLower = useMemo(() => {
    const q = filtroBusca.trim().toLowerCase();
    if (q.length > 0 && q.length < MIN_BUSCA) return '';
    return q;
  }, [filtroBusca]);

  const linhasVisiveis = useMemo(() => {
    const q = filtroBusca.trim().toLowerCase();
    if (!q || q.length < MIN_BUSCA) return lista;
    const qDigits = q.replace(/\D/g, '');
    return lista.filter((item) => linhaCombinaBusca(item, q, qDigits));
  }, [lista, filtroBusca]);

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

      {!carregando && lista.length > 0 && buscaAtiva && linhasVisiveis.length === 0 ? (
        <TafGlassPanel style={styles.emptyCard}>
          <Text style={[ts.body, { color: theme.text, textAlign: 'center' }]}>
            Nenhum resultado para &quot;{filtroBusca.trim()}&quot;.
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
});
