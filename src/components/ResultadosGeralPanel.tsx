import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, Users } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Card } from './Card';
import { SearchHighlightText } from './SearchHighlightText';
import { getAllCadastros } from '../services/cadastrosIndexedDb';
import {
  listarResultadosGeral,
  type ResultadoGeralItem,
} from '../utils/resultadoTafCadastro';
import { nipDigitos } from '../utils/nipFormat';
import { PREMIUM } from '../theme/premium';
import { getUiColors } from '../theme/uiColors';

const MIN_BUSCA = 3;

function situacaoCor(situacao: string, theme: { gain: string; loss: string; textMuted: string }) {
  if (situacao === 'Aprovado') return theme.gain;
  if (situacao === 'Reprovado') return theme.loss;
  return theme.textMuted;
}

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

type ColDef = {
  key: string;
  label: string;
  flex: number;
  minWidth: number;
  align?: 'left' | 'center';
};

const COLUNAS: ColDef[] = [
  { key: 'nip', label: 'NIP', flex: 1, minWidth: 108 },
  { key: 'nome', label: 'Nome', flex: 1.6, minWidth: 140 },
  { key: 'status', label: 'TAF', flex: 0.75, minWidth: 72, align: 'center' },
  { key: 'notaC', label: 'Nota C', flex: 0.65, minWidth: 56, align: 'center' },
  { key: 'sitC', label: 'Sit. C', flex: 0.8, minWidth: 68, align: 'center' },
  { key: 'notaN', label: 'Nota N', flex: 0.65, minWidth: 56, align: 'center' },
  { key: 'sitN', label: 'Sit. N', flex: 0.8, minWidth: 68, align: 'center' },
  { key: 'perm', label: 'Perm.', flex: 0.85, minWidth: 72, align: 'center' },
  { key: 'sitP', label: 'Sit. P', flex: 0.8, minWidth: 68, align: 'center' },
];

function StatusBadge({ status }: { status: 'Completo' | 'Parcial' }) {
  const { theme } = useTheme();
  const completo = status === 'Completo';
  const warn = theme.tokens.warning500;
  return (
    <View
      style={[
        styles.statusBadge,
        {
          backgroundColor: completo ? theme.gainMuted : 'rgba(245, 158, 11, 0.14)',
          borderColor: completo ? theme.gain : warn,
        },
      ]}
    >
      <Text style={[styles.statusBadgeText, { color: completo ? theme.gain : warn }]}>
        {status}
      </Text>
    </View>
  );
}

export function ResultadosGeralPanel() {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const t = theme.tokens;

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
  const tableMinWidth = COLUNAS.reduce((s, c) => s + c.minWidth, 0);

  const cellBase = useMemo(
    () => [styles.cell, { color: ui.text }],
    [ui.text],
  );

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
        <Card
          elevated
          style={[
            styles.tableCard,
            Platform.OS === 'web' ? ({ boxShadow: t.shadowCard } as object) : undefined,
          ]}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'}>
            <View style={[styles.tableInner, { minWidth: Math.max(tableMinWidth, 720) }]}>
              <LinearGradient
                colors={[...t.gradientPrimaryBtn]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.headerGradient}
              >
                <View style={styles.headerRow}>
                  {COLUNAS.map((col) => (
                    <View
                      key={col.key}
                      style={[
                        styles.col,
                        { flex: col.flex, minWidth: col.minWidth },
                        col.align === 'center' ? styles.colCenter : null,
                      ]}
                    >
                      <Text style={styles.headerCell}>{col.label}</Text>
                    </View>
                  ))}
                </View>
              </LinearGradient>

              {linhasVisiveis.map((item, index) => {
                const zebra = index % 2 === 1;
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.dataRow,
                      {
                        backgroundColor: zebra ? theme.backgroundSecondary : 'transparent',
                        borderBottomColor: theme.border,
                      },
                    ]}
                  >
                    <View style={[styles.col, { flex: COLUNAS[0].flex, minWidth: COLUNAS[0].minWidth }]}>
                      <SearchHighlightText
                        text={item.nip}
                        queryLower={buscaLower}
                        style={[cellBase, styles.nipCell]}
                        numberOfLines={1}
                      />
                    </View>
                    <View style={[styles.col, { flex: COLUNAS[1].flex, minWidth: COLUNAS[1].minWidth }]}>
                      <SearchHighlightText
                        text={item.nome}
                        queryLower={buscaLower}
                        style={cellBase}
                        numberOfLines={2}
                      />
                    </View>
                    <View
                      style={[
                        styles.col,
                        styles.colCenter,
                        { flex: COLUNAS[2].flex, minWidth: COLUNAS[2].minWidth },
                      ]}
                    >
                      <StatusBadge status={item.statusTaf} />
                    </View>
                    <View
                      style={[
                        styles.col,
                        styles.colCenter,
                        { flex: COLUNAS[3].flex, minWidth: COLUNAS[3].minWidth },
                      ]}
                    >
                      <SearchHighlightText
                        text={item.notaCorrida}
                        queryLower={buscaLower}
                        style={cellBase}
                      />
                    </View>
                    <View
                      style={[
                        styles.col,
                        styles.colCenter,
                        { flex: COLUNAS[4].flex, minWidth: COLUNAS[4].minWidth },
                      ]}
                    >
                      <SearchHighlightText
                        text={item.situacaoCorrida}
                        queryLower={buscaLower}
                        style={[cellBase, { color: situacaoCor(item.situacaoCorrida, theme) }]}
                      />
                    </View>
                    <View
                      style={[
                        styles.col,
                        styles.colCenter,
                        { flex: COLUNAS[5].flex, minWidth: COLUNAS[5].minWidth },
                      ]}
                    >
                      <SearchHighlightText
                        text={item.notaNatacao}
                        queryLower={buscaLower}
                        style={cellBase}
                      />
                    </View>
                    <View
                      style={[
                        styles.col,
                        styles.colCenter,
                        { flex: COLUNAS[6].flex, minWidth: COLUNAS[6].minWidth },
                      ]}
                    >
                      <SearchHighlightText
                        text={item.situacaoNatacao}
                        queryLower={buscaLower}
                        style={[cellBase, { color: situacaoCor(item.situacaoNatacao, theme) }]}
                      />
                    </View>
                    <View
                      style={[
                        styles.col,
                        styles.colCenter,
                        { flex: COLUNAS[7].flex, minWidth: COLUNAS[7].minWidth },
                      ]}
                    >
                      <SearchHighlightText
                        text={item.permanenciaTempo}
                        queryLower={buscaLower}
                        style={cellBase}
                      />
                    </View>
                    <View
                      style={[
                        styles.col,
                        styles.colCenter,
                        { flex: COLUNAS[8].flex, minWidth: COLUNAS[8].minWidth },
                      ]}
                    >
                      <SearchHighlightText
                        text={item.situacaoPermanencia}
                        queryLower={buscaLower}
                        style={[cellBase, { color: situacaoCor(item.situacaoPermanencia, theme) }]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </Card>
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
  },
  loader: { marginVertical: 28 },
  emptyCard: { padding: 22 },
  emptyHint: { marginTop: 8, lineHeight: 18 },
  tableCard: {
    padding: 0,
    overflow: 'hidden',
    borderRadius: PREMIUM.radiusLg,
  },
  tableInner: { paddingBottom: 4 },
  headerGradient: {
    borderTopLeftRadius: PREMIUM.radiusLg - 2,
    borderTopRightRadius: PREMIUM.radiusLg - 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  headerCell: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  col: {
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  colCenter: { alignItems: 'center' },
  cell: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  nipCell: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, monospace' }),
    fontSize: 11,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
