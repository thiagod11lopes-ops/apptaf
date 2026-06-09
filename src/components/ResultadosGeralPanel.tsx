import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Search, Users } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Card } from './Card';
import { ResultadosGeralTable } from './ResultadosGeralTable';
import { getAllCadastros, type CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { getAllSessoesAplicacao } from '../services/resultadosAplicadosIndexedDb';
import type { ResultadoGeralItem } from '../utils/resultadoTafCadastro';
import { listarResultadosGeralFromHistorico } from '../utils/resultadoGeralHistorico';
import { EditarResultadoTafModal } from './sismav/EditarResultadoTafModal';
import { ConfirmacaoExcluirResultadoGeralModal } from './sismav/ConfirmacaoExcluirResultadoGeralModal';
import { excluirTodosResultadosTafMilitar } from '../utils/atualizarResultadoTaf';
import { nipDigitos } from '../utils/nipFormat';
import { PREMIUM } from '../theme/premium';
import { tableFullWidthStyle } from '../theme/tableLayout';
import { getUiColors } from '../theme/uiColors';

const MIN_BUSCA = 3;

function linhaCombinaBusca(item: ResultadoGeralItem, q: string, qDigits: string): boolean {
  const haystack = [
    item.nip,
    item.nome,
    item.statusTaf,
    item.notaCorrida,
    item.situacaoCorrida,
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

export function ResultadosGeralPanel() {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);

  const [lista, setLista] = useState<ResultadoGeralItem[]>([]);
  const [cadastros, setCadastros] = useState<CadastroItemPersist[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroBusca, setFiltroBusca] = useState('');
  const [cadastroEmEdicao, setCadastroEmEdicao] = useState<CadastroItemPersist | null>(null);
  const [militarParaExcluir, setMilitarParaExcluir] = useState<ResultadoGeralItem | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregar = useCallback(() => {
    setCarregando(true);
    Promise.all([getAllCadastros(), getAllSessoesAplicacao()])
      .then(([cadastrosLista, sessoes]) => {
        setCadastros(cadastrosLista);
        setLista(listarResultadosGeralFromHistorico(sessoes, cadastrosLista));
      })
      .catch(() => {
        setCadastros([]);
        setLista([]);
      })
      .finally(() => setCarregando(false));
  }, []);

  const recarregarLista = useCallback(async () => {
    const [cadastrosLista, sessoes] = await Promise.all([
      getAllCadastros(),
      getAllSessoesAplicacao(),
    ]);
    setCadastros(cadastrosLista);
    setLista(listarResultadosGeralFromHistorico(sessoes, cadastrosLista));
  }, []);

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

  const inputStyle = useMemo(
    () => [
      styles.searchInput,
      { color: ui.text },
      Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {},
    ],
    [ui.text],
  );

  return (
    <View style={styles.wrap}>
      <Text style={[ts.bodySecondary, styles.intro, { color: theme.textSecondary }]}>
        Visão consolidada das provas registradas no Aplicar TAF e no Registrador de TAF. Modalidades
        ausentes aparecem como &quot;—&quot;.
      </Text>

      <View
        style={[
          styles.searchShell,
          {
            backgroundColor: ui.inputBg,
            borderColor: buscaAtiva ? theme.primary : theme.border,
          },
          Platform.OS === 'web' && buscaAtiva
            ? ({ boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.18)' } as object)
            : undefined,
        ]}
      >
        <Search size={20} color={buscaAtiva ? theme.primary : ui.searchIcon} strokeWidth={2.4} />
        <TextInput
          value={filtroBusca}
          onChangeText={setFiltroBusca}
          placeholder="Buscar NIP, nome ou resultado (mín. 3 caracteres)…"
          placeholderTextColor={ui.placeholder}
          style={inputStyle}
          autoCorrect={false}
          spellCheck={false}
          autoCapitalize="none"
          accessibilityLabel="Buscar na tabela de resultado geral"
        />
      </View>

      {filtroBusca.trim().length > 0 && filtroBusca.trim().length < MIN_BUSCA ? (
        <Text style={[ts.caption, styles.hintBusca, { color: theme.textMuted }]}>
          Digite pelo menos {MIN_BUSCA} caracteres para filtrar a tabela.
        </Text>
      ) : null}

      <View style={styles.statsRow}>
        <Users size={16} color={theme.primary} strokeWidth={2.2} />
        <Text style={[ts.caption, { color: theme.textMuted }]}>
          {buscaAtiva
            ? `${linhasVisiveis.length} de ${lista.length} militar${lista.length !== 1 ? 'es' : ''}`
            : `${lista.length} militar${lista.length !== 1 ? 'es' : ''} no histórico`}
          {' · '}
          Toque no cabeçalho para ordenar · use os ícones para editar ou excluir
        </Text>
      </View>

      {carregando ? (
        <ActivityIndicator color={theme.primary} style={styles.loader} />
      ) : null}

      {!carregando && lista.length === 0 ? (
        <Card elevated style={styles.emptyCard}>
          <Text style={[ts.body, { color: theme.text, textAlign: 'center' }]}>
            Nenhuma sessão no histórico ainda.
          </Text>
          <Text style={[ts.caption, styles.emptyHint, { color: theme.textMuted, textAlign: 'center' }]}>
            Aplique provas em Aplicar TAF ou cadastre sessões no histórico; os dados consolidados
            aparecerão aqui.
          </Text>
        </Card>
      ) : null}

      {!carregando && lista.length > 0 && buscaAtiva && linhasVisiveis.length === 0 ? (
        <Card elevated style={styles.emptyCard}>
          <Text style={[ts.body, { color: theme.text, textAlign: 'center' }]}>
            Nenhum resultado para &quot;{filtroBusca.trim()}&quot;.
          </Text>
        </Card>
      ) : null}

      {!carregando && linhasVisiveis.length > 0 ? (
        <ResultadosGeralTable
          data={linhasVisiveis}
          buscaLower={buscaLower}
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
  intro: { marginBottom: 14, lineHeight: 20 },
  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: PREMIUM.radiusLg,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 0,
  },
  hintBusca: { marginBottom: 10, marginLeft: 4 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginLeft: 2,
    flexWrap: 'wrap',
  },
  loader: { marginVertical: 28 },
  emptyCard: { padding: 22 },
  emptyHint: { marginTop: 8, lineHeight: 18 },
});
