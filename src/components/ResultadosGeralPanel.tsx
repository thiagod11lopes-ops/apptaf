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

const W = {
  nip: 112,
  nome: 168,
  status: 88,
  nota: 62,
  situacao: 84,
  permanencia: 104,
} as const;

const LARGURA_CORRIDA = W.nota + W.situacao;
const LARGURA_NATACAO = W.nota + W.situacao;
const LARGURA_PERMANENCIA = W.permanencia + W.situacao;

const LARGURA_TABELA =
  W.nip +
  W.nome +
  W.status +
  LARGURA_CORRIDA +
  LARGURA_NATACAO +
  LARGURA_PERMANENCIA;

type ColDataKey =
  | 'nip'
  | 'nome'
  | 'status'
  | 'notaC'
  | 'sitC'
  | 'notaN'
  | 'sitN'
  | 'perm'
  | 'sitP';

const COLUNAS_DADOS: { key: ColDataKey; width: number; align?: 'left' | 'center' }[] = [
  { key: 'nip', width: W.nip },
  { key: 'nome', width: W.nome },
  { key: 'status', width: W.status, align: 'center' },
  { key: 'notaC', width: W.nota, align: 'center' },
  { key: 'sitC', width: W.situacao, align: 'center' },
  { key: 'notaN', width: W.nota, align: 'center' },
  { key: 'sitN', width: W.situacao, align: 'center' },
  { key: 'perm', width: W.permanencia, align: 'center' },
  { key: 'sitP', width: W.situacao, align: 'center' },
];

function colStyle(width: number, align?: 'left' | 'center') {
  return [styles.col, { width, flexShrink: 0, flexGrow: 0 }, align === 'center' ? styles.colCenter : null];
}

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
          noPadding
          elevated
          style={[
            styles.tableCard,
            Platform.OS === 'web' ? ({ boxShadow: t.shadowCard } as object) : undefined,
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            nestedScrollEnabled
            bounces={false}
            style={styles.tableScroll}
            contentContainerStyle={styles.tableScrollContent}
          >
            <View style={styles.tableFrame}>
              <LinearGradient
                colors={[...t.gradientPrimaryBtn]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.headerBlock}
              >
                <View style={styles.headerRow}>
                  <View style={colStyle(W.nip)}>
                    <Text style={styles.headerCell}>NIP</Text>
                  </View>
                  <View style={colStyle(W.nome)}>
                    <Text style={styles.headerCell}>Nome</Text>
                  </View>
                  <View style={colStyle(W.status, 'center')}>
                    <Text style={[styles.headerCell, styles.headerCellCenter]}>Status</Text>
                  </View>
                  <View style={colStyle(LARGURA_CORRIDA, 'center')}>
                    <Text style={[styles.headerCell, styles.headerCellCenter]}>Corrida</Text>
                  </View>
                  <View style={colStyle(LARGURA_NATACAO, 'center')}>
                    <Text style={[styles.headerCell, styles.headerCellCenter]}>Natação</Text>
                  </View>
                  <View style={colStyle(LARGURA_PERMANENCIA, 'center')}>
                    <Text style={[styles.headerCell, styles.headerCellCenter]}>Permanência</Text>
                  </View>
                </View>
                <View style={[styles.headerRow, styles.headerSubRow]}>
                  <View style={colStyle(W.nip)} />
                  <View style={colStyle(W.nome)} />
                  <View style={colStyle(W.status)} />
                  <View style={[colStyle(W.nota, 'center'), styles.colGroupDivider]}>
                    <Text style={[styles.headerSubCell, styles.headerCellCenter]}>Nota</Text>
                  </View>
                  <View style={colStyle(W.situacao, 'center')}>
                    <Text style={[styles.headerSubCell, styles.headerCellCenter]}>Situação</Text>
                  </View>
                  <View style={[colStyle(W.nota, 'center'), styles.colGroupDivider]}>
                    <Text style={[styles.headerSubCell, styles.headerCellCenter]}>Nota</Text>
                  </View>
                  <View style={colStyle(W.situacao, 'center')}>
                    <Text style={[styles.headerSubCell, styles.headerCellCenter]}>Situação</Text>
                  </View>
                  <View style={[colStyle(W.permanencia, 'center'), styles.colGroupDivider]}>
                    <Text style={[styles.headerSubCell, styles.headerCellCenter]}>Permanência</Text>
                  </View>
                  <View style={colStyle(W.situacao, 'center')}>
                    <Text style={[styles.headerSubCell, styles.headerCellCenter]}>Situação</Text>
                  </View>
                </View>
              </LinearGradient>

              {linhasVisiveis.map((item, index) => {
                const zebra = index % 2 === 1;
                const renderCelula = (colKey: ColDataKey) => {
                  switch (colKey) {
                    case 'nip':
                      return (
                        <SearchHighlightText
                          text={item.nip}
                          queryLower={buscaLower}
                          style={[cellBase, styles.nipCell]}
                          numberOfLines={1}
                        />
                      );
                    case 'nome':
                      return (
                        <SearchHighlightText
                          text={item.nome}
                          queryLower={buscaLower}
                          style={cellBase}
                          numberOfLines={2}
                        />
                      );
                    case 'status':
                      return <StatusBadge status={item.statusTaf} />;
                    case 'notaC':
                      return (
                        <SearchHighlightText text={item.notaCorrida} queryLower={buscaLower} style={cellBase} />
                      );
                    case 'sitC':
                      return (
                        <SearchHighlightText
                          text={item.situacaoCorrida}
                          queryLower={buscaLower}
                          style={[cellBase, { color: situacaoCor(item.situacaoCorrida, theme) }]}
                        />
                      );
                    case 'notaN':
                      return (
                        <SearchHighlightText text={item.notaNatacao} queryLower={buscaLower} style={cellBase} />
                      );
                    case 'sitN':
                      return (
                        <SearchHighlightText
                          text={item.situacaoNatacao}
                          queryLower={buscaLower}
                          style={[cellBase, { color: situacaoCor(item.situacaoNatacao, theme) }]}
                        />
                      );
                    case 'perm':
                      return (
                        <SearchHighlightText
                          text={item.permanenciaTempo}
                          queryLower={buscaLower}
                          style={cellBase}
                        />
                      );
                    case 'sitP':
                      return (
                        <SearchHighlightText
                          text={item.situacaoPermanencia}
                          queryLower={buscaLower}
                          style={[cellBase, { color: situacaoCor(item.situacaoPermanencia, theme) }]}
                        />
                      );
                    default:
                      return null;
                  }
                };

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
                    {COLUNAS_DADOS.map((col) => (
                      <View
                        key={col.key}
                        style={[
                          ...colStyle(col.width, col.align),
                          (col.key === 'notaC' || col.key === 'notaN' || col.key === 'perm') &&
                            styles.colGroupDividerBody,
                        ]}
                      >
                        {renderCelula(col.key)}
                      </View>
                    ))}
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
    width: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
    borderRadius: PREMIUM.radiusLg,
  },
  tableScroll: {
    width: '100%',
    overflow: 'hidden',
  },
  tableScrollContent: {
    flexGrow: 0,
  },
  tableFrame: {
    width: LARGURA_TABELA,
    overflow: 'hidden',
  },
  headerBlock: {
    width: LARGURA_TABELA,
    overflow: 'hidden',
    borderTopLeftRadius: PREMIUM.radiusLg - 2,
    borderTopRightRadius: PREMIUM.radiusLg - 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: LARGURA_TABELA,
    paddingVertical: 10,
  },
  headerSubRow: {
    paddingTop: 0,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  headerCell: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  headerSubCell: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  headerCellCenter: { textAlign: 'center', alignSelf: 'stretch' },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: LARGURA_TABELA,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  col: {
    justifyContent: 'center',
    overflow: 'hidden',
  },
  colCenter: { alignItems: 'center' },
  colGroupDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255,255,255,0.22)',
  },
  colGroupDividerBody: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(17,24,39,0.1)',
  },
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
