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
import { getAllCadastros } from '../services/cadastrosIndexedDb';
import {
  listarResultadosGeral,
  type ResultadoGeralItem,
} from '../utils/resultadoTafCadastro';
import { nipDigitos } from '../utils/nipFormat';
import { PREMIUM } from '../theme/premium';
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
  const [carregando, setCarregando] = useState(true);
  const [filtroBusca, setFiltroBusca] = useState('');

  const carregar = useCallback(() => {
    setCarregando(true);
    getAllCadastros()
      .then((cadastros) => setLista(listarResultadosGeral(cadastros)))
      .catch(() => setLista([]))
      .finally(() => setCarregando(false));
  }, []);

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
        Visão consolidada de todos os militares que realizaram o TAF (prova completa ou em andamento).
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
            : `${lista.length} militar${lista.length !== 1 ? 'es' : ''} com TAF registrado`}
          {' · '}
          Toque no cabeçalho para ordenar
        </Text>
      </View>

      {carregando ? (
        <ActivityIndicator color={theme.primary} style={styles.loader} />
      ) : null}

      {!carregando && lista.length === 0 ? (
        <Card elevated style={styles.emptyCard}>
          <Text style={[ts.body, { color: theme.text, textAlign: 'center' }]}>
            Nenhum militar com TAF registrado ainda.
          </Text>
          <Text style={[ts.caption, styles.emptyHint, { color: theme.textMuted, textAlign: 'center' }]}>
            Os resultados aparecerão aqui após aplicar corrida, natação ou permanência.
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
        <ResultadosGeralTable data={linhasVisiveis} buscaLower={buscaLower} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 960, alignSelf: 'center' },
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
