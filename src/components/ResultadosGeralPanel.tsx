import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { ResultadosGeralTable } from './ResultadosGeralTable';
import { getAllCadastros, type CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { getAllSessoesAplicacao } from '../services/resultadosAplicadosIndexedDb';
import type { ResultadoGeralItem } from '../utils/resultadoTafCadastro';
import type { FiltroHistoricoMilitar } from '../utils/filtrarSessoesHistoricoMilitar';
import { listarResultadosGeralFromHistorico } from '../utils/resultadoGeralHistorico';
import { EditarResultadoTafModal } from './sismav/EditarResultadoTafModal';
import { ConfirmacaoExcluirResultadoGeralModal } from './sismav/ConfirmacaoExcluirResultadoGeralModal';
import { excluirTodosResultadosTafMilitar } from '../utils/atualizarResultadoTaf';
import { nipDigitos } from '../utils/nipFormat';
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
  onVerHistoricoMilitar,
}: {
  onVerHistoricoMilitar?: (filtro: FiltroHistoricoMilitar) => void;
}) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const glass = getAplicarTafGlass(theme);

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
});
