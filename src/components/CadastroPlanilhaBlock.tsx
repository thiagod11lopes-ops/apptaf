import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform } from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';
import { Card } from './Card';
import { LabelNip } from './LabelNip';
import { LabelSO } from './LabelSO';
import { LabelSvgText } from './LabelSvgText';
import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { idadeDisplayFromDataNascimento } from '../utils/idadeFromDataNascimento';

type Categoria = 'Oficiais' | 'Praças';

/** Lê tempos TAF; campo legado `tempo` vira Corrida. */
function temposCorridaNatacao(c: CadastroItemPersist) {
  const x = c as CadastroItemPersist & { tempo?: string };
  return {
    corrida: (x.tempoCorrida ?? x.tempo ?? '').trim(),
    natacao: (x.tempoNatacao ?? '').trim(),
  };
}

/** Resultado do modal Permanência (persistido em `resultadoNatacao`). */
function permanenciaLabel(c: CadastroItemPersist): string {
  const r = c.resultadoNatacao;
  if (r === 'aprovado') return 'Aprovado';
  if (r === 'reprovado') return 'Reprovado';
  return '-';
}

export type CadastroPlanilhaVariant = 'cadastro' | 'aplicacaoTaf';

export type CadastroPlanilhaBlockProps = {
  cadastros: CadastroItemPersist[];
  cardGlassEnabled: boolean;
  /**
   * `cadastro`: coluna Categoria + sem coluna Tempo (planilha de Cadastro).
   * `aplicacaoTaf`: sem Categoria + coluna Tempo ao lado de Idade (Registrador de TAF).
   */
  variant?: CadastroPlanilhaVariant;
  /** Título do card da planilha */
  tableTitle?: string;
  /** Mensagem quando não há nenhum cadastro no sistema */
  emptyMessageWhenNoData?: string;
  /** Exibe coluna Ações (editar / excluir) */
  showActions?: boolean;
  onEdit?: (item: CadastroItemPersist) => void;
  onRequestDelete?: (item: CadastroItemPersist) => void;
};

export function CadastroPlanilhaBlock({
  cadastros,
  cardGlassEnabled,
  variant = 'cadastro',
  tableTitle = 'Cadastros',
  emptyMessageWhenNoData = 'Nenhum cadastro ainda.',
  showActions = false,
  onEdit,
  onRequestDelete,
}: CadastroPlanilhaBlockProps) {
  const isAplicacaoTaf = variant === 'aplicacaoTaf';
  const [filtroCategoria, setFiltroCategoria] = useState<'Todos' | Categoria | ''>('Todos');
  const [filtroPostoGrad, setFiltroPostoGrad] = useState<'Todos' | string>('Todos');
  const [filtroBusca, setFiltroBusca] = useState<string>('');

  const postoGradOptions = useMemo(() => {
    const oficiais = ['GM', '2°TEN', '1°TEN', 'CT', 'CC', 'CF', 'CMG'];
    const pracas = ['MN', 'CB', '3°SG', '2°SG', '1°SG', 'SO'];

    if (filtroCategoria === 'Oficiais') return ['Todos', ...oficiais];
    if (filtroCategoria === 'Praças') return ['Todos', ...pracas];
    return ['Todos', ...oficiais, ...pracas];
  }, [filtroCategoria]);

  useEffect(() => {
    if (filtroCategoria === 'Todos') {
      setFiltroPostoGrad('Todos');
      return;
    }
    if (filtroPostoGrad !== 'Todos' && !postoGradOptions.includes(filtroPostoGrad)) {
      setFiltroPostoGrad('Todos');
    }
  }, [filtroPostoGrad, postoGradOptions, filtroCategoria]);

  const cadastrosFiltrados = useMemo(() => {
    return cadastros.filter((c) => {
      const categoriaOk = filtroCategoria === 'Todos' || c.categoria === filtroCategoria;
      if (!categoriaOk) return false;

      if (filtroPostoGrad === 'Todos') return true;
      const postoGrad = c.categoria === 'Oficiais' ? c.oficial || '' : c.praca || '';
      return postoGrad === filtroPostoGrad;
    });
  }, [cadastros, filtroCategoria, filtroPostoGrad]);

  const cadastrosFiltradosComBusca = useMemo(() => {
    const q = filtroBusca.trim().toLowerCase();
    if (!q) return cadastrosFiltrados;

    const qDigits = q.replace(/\D/g, '');

    return cadastrosFiltrados.filter((c) => {
      const postoGrad = c.categoria === 'Oficiais' ? c.oficial || '' : c.praca || '';
      const idadeTxt = idadeDisplayFromDataNascimento(c.dataNascimento);
      const { corrida: tCorr, natacao: tNat } = temposCorridaNatacao(c);
      const nCor = (c.notaCorrida || '').trim();
      const nNat = (c.notaNatacao || '').trim();
      const perm = permanenciaLabel(c);
      const haystack = `${c.categoria} ${postoGrad} ${c.nip} ${c.nome} ${c.dataNascimento} ${idadeTxt} ${tCorr} ${tNat} ${nCor} ${nNat} ${perm} permanência aprovado reprovado`
        .toLowerCase()
        .trim();

      if (haystack.includes(q)) return true;
      if (qDigits) {
        const nipDigits = (c.nip || '').replace(/\D/g, '');
        return nipDigits.includes(qDigits);
      }
      return false;
    });
  }, [cadastrosFiltrados, filtroBusca]);

  const buscaLower = useMemo(() => filtroBusca.trim().toLowerCase(), [filtroBusca]);

  const highlightText = useCallback(
    (text: string, queryLower: string, cellStyle?: any, numberOfLines: number = 1) => {
      const value = text || '-';
      const baseStyle = cellStyle || styles.tableCell;
      const q = queryLower.trim();
      if (!q) {
        return (
          <Text style={baseStyle} numberOfLines={numberOfLines}>
            {value}
          </Text>
        );
      }

      const qDigits = q.replace(/\D/g, '');
      const isDigitsOnlyQuery = qDigits.length > 0 && qDigits.length === q.length;
      if (isDigitsOnlyQuery) {
        const digitChars: string[] = [];
        const highlightDigit = [] as boolean[];

        let digitIndex = 0;
        for (let i = 0; i < value.length; i += 1) {
          const ch = value[i];
          if (/\d/.test(ch)) {
            digitChars.push(ch);
            highlightDigit[digitIndex] = false;
            digitIndex += 1;
          }
        }

        const digitString = digitChars.join('');
        let found = false;
        let start = 0;
        while (true) {
          const i = digitString.indexOf(qDigits, start);
          if (i === -1) break;
          found = true;
          for (let d = i; d < i + qDigits.length; d += 1) {
            highlightDigit[d] = true;
          }
          start = i + qDigits.length;
        }

        if (!found) {
          return (
            <Text style={baseStyle} numberOfLines={numberOfLines}>
              {value}
            </Text>
          );
        }

        const nodes: React.ReactNode[] = [];
        let buffer = '';
        let bufferBold = false;
        let digitCounter = 0;

        const flush = () => {
          if (!buffer) return;
          nodes.push(
            <Text key={`seg_${nodes.length}`} style={bufferBold ? styles.highlightText : undefined}>
              {buffer}
            </Text>
          );
          buffer = '';
        };

        for (let i = 0; i < value.length; i += 1) {
          const ch = value[i];
          if (/\d/.test(ch)) {
            const bold = !!highlightDigit[digitCounter];
            digitCounter += 1;
            if (bufferBold !== bold) {
              flush();
              bufferBold = bold;
            }
            buffer += ch;
          } else {
            if (bufferBold) {
              flush();
              bufferBold = false;
            }
            buffer += ch;
          }
        }

        flush();
        return (
          <Text style={baseStyle} numberOfLines={numberOfLines}>
            {nodes}
          </Text>
        );
      }

      const valueLower = value.toLowerCase();
      const idx = valueLower.indexOf(q);
      if (idx === -1) {
        return (
          <Text style={baseStyle} numberOfLines={numberOfLines}>
            {value}
          </Text>
        );
      }

      const nodes: React.ReactNode[] = [];
      let start = 0;
      while (true) {
        const i = valueLower.indexOf(q, start);
        if (i === -1) break;
        if (i > start) nodes.push(<Text key={`t_${start}`}>{value.slice(start, i)}</Text>);
        nodes.push(
          <Text key={`m_${i}`} style={styles.highlightText}>
            {value.slice(i, i + q.length)}
          </Text>
        );
        start = i + q.length;
      }
      if (start < value.length) nodes.push(<Text key={`t_${start}_end`}>{value.slice(start)}</Text>);

      return (
        <Text style={baseStyle} numberOfLines={numberOfLines}>
          {nodes}
        </Text>
      );
    },
    []
  );

  const selectedBg = '#111827';
  const unselectedBg = 'rgba(17,24,39,0.06)';

  /** Borda esquerda entre colunas; em Registrador de TAF não separa Corrida|Nota nem Natação|Nota. */
  const colSep = (showLeftDivider: boolean) =>
    showLeftDivider ? ([styles.tableCol, styles.tableColDivider] as const) : styles.tableCol;

  return (
    <Card glass={cardGlassEnabled} style={styles.tableCard}>
      <Text style={styles.tableTitle}>{tableTitle}</Text>

      {cadastros.length === 0 ? (
        <Text style={styles.tableEmpty}>{emptyMessageWhenNoData}</Text>
      ) : (
        <View>
          <View style={styles.searchWrap}>
            <LabelSvgText
              text="Buscar"
              color="#374151"
              fontSize={12}
              fontWeight={800}
              width={60}
              height={18}
            />
            <TextInput
              value={filtroBusca}
              onChangeText={setFiltroBusca}
              placeholder="Digite para filtrar..."
              placeholderTextColor="rgba(17,24,39,0.35)"
              style={[styles.searchInput, { borderColor: 'rgba(17,24,39,0.12)' }]}
              autoCorrect={false}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="none"
              textContentType="none"
            />
          </View>

          <View style={styles.filtersWrap}>
            <View style={styles.filterBlock}>
              <LabelSvgText
                text="Categoria"
                color="#374151"
                fontSize={12}
                fontWeight={800}
                width={100}
                height={18}
              />
              <View style={styles.segmented}>
                {(['Todos', 'Oficiais', 'Praças'] as const).map((opt) => {
                  const active = filtroCategoria === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setFiltroCategoria(opt)}
                      style={[
                        styles.segmentBtn,
                        active ? { backgroundColor: selectedBg } : { backgroundColor: unselectedBg },
                      ]}
                    >
                      {opt === 'Todos' ? (
                        <LabelSvgText
                          text="Todos"
                          color={active ? '#FFFFFF' : '#111827'}
                          fontSize={12}
                          fontWeight={800}
                          width={70}
                          height={18}
                        />
                      ) : opt === 'Oficiais' ? (
                        <LabelSvgText
                          text="Oficiais"
                          color={active ? '#FFFFFF' : '#111827'}
                          fontSize={12}
                          fontWeight={800}
                          width={90}
                          height={18}
                        />
                      ) : (
                        <LabelSvgText
                          text="Praças"
                          color={active ? '#FFFFFF' : '#111827'}
                          fontSize={12}
                          fontWeight={800}
                          width={70}
                          height={18}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {filtroCategoria !== 'Todos' ? (
              <View style={styles.filterBlock}>
                <LabelSvgText
                  text="Posto / Graduação"
                  color="#374151"
                  fontSize={12}
                  fontWeight={800}
                  width={170}
                  height={18}
                />

                <View style={styles.filterOptionsGrid}>
                  {postoGradOptions.map((opt) => {
                    const active = filtroPostoGrad === opt;
                    return (
                      <TouchableOpacity
                        key={opt}
                        onPress={() => setFiltroPostoGrad(opt)}
                        style={[
                          styles.filterOptionBtn,
                          active ? { backgroundColor: selectedBg } : { backgroundColor: unselectedBg },
                        ]}
                      >
                        {opt === 'SO' ? (
                          <LabelSO color={active ? '#FFFFFF' : '#111827'} fontSize={12} fontWeight={900} />
                        ) : (
                          <LabelSvgText
                            text={opt}
                            color={active ? '#FFFFFF' : '#111827'}
                            fontSize={12}
                            fontWeight={800}
                            width={90}
                            height={18}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>

          {cadastrosFiltradosComBusca.length === 0 ? (
            <Text style={styles.tableEmpty}>Nenhum resultado encontrado.</Text>
          ) : (
            <View>
              <View style={styles.tableHeaderRow}>
                {!isAplicacaoTaf ? (
                  <View style={[colSep(false), { flex: 1 }]}>
                    <LabelSvgText text="Categoria" color="#111827" fontSize={12} fontWeight={800} width={110} height={18} />
                  </View>
                ) : null}
                <View style={[colSep(!isAplicacaoTaf), { flex: 1 }]}>
                  <LabelSvgText text="Posto / Graduação" color="#111827" fontSize={12} fontWeight={800} width={160} height={18} />
                </View>
                <View style={[colSep(true), { flex: 1, paddingHorizontal: 4 }]}>
                  <LabelNip color="#111827" fontSize={12} fontWeight={800} />
                </View>
                <View style={[colSep(true), { flex: 2 }]}>
                  <LabelSvgText text="Nome" color="#111827" fontSize={12} fontWeight={800} width={90} height={18} />
                </View>
                <View style={[colSep(true), { flex: 1 }]}>
                  <LabelSvgText text="Idade" color="#111827" fontSize={12} fontWeight={800} width={56} height={18} />
                </View>
                {isAplicacaoTaf ? (
                  <>
                    <View style={[colSep(true), { flex: 1 }]}>
                      <LabelSvgText text="Corrida" color="#111827" fontSize={12} fontWeight={800} width={80} height={18} />
                    </View>
                    <View style={[colSep(false), { flex: 0.85 }]}>
                      <LabelSvgText text="Nota" color="#111827" fontSize={12} fontWeight={800} width={50} height={18} />
                    </View>
                    <View style={[colSep(true), { flex: 1 }]}>
                      <LabelSvgText text="Natação" color="#111827" fontSize={12} fontWeight={800} width={90} height={18} />
                    </View>
                    <View style={[colSep(false), { flex: 0.85 }]}>
                      <LabelSvgText text="Nota" color="#111827" fontSize={12} fontWeight={800} width={50} height={18} />
                    </View>
                    <View style={[colSep(true), { flex: 1.1 }]}>
                      <LabelSvgText text="Permanência" color="#111827" fontSize={12} fontWeight={800} width={120} height={18} />
                    </View>
                  </>
                ) : null}
                {showActions ? (
                  <View style={[colSep(true), { flex: 1 }]}>
                    <LabelSvgText text="Ações" color="#111827" fontSize={12} fontWeight={800} width={55} height={18} />
                  </View>
                ) : null}
              </View>

              {cadastrosFiltradosComBusca.map((c) => {
                const tempos = temposCorridaNatacao(c);
                return (
                  <View key={c.id} style={styles.tableRow}>
                    {!isAplicacaoTaf ? (
                      <View style={[colSep(false), { flex: 1, alignItems: 'flex-start' }]}>
                        {highlightText(c.categoria, buscaLower, styles.tableCell, 1)}
                      </View>
                    ) : null}
                    <View style={[colSep(!isAplicacaoTaf), { flex: 1, alignItems: 'flex-start' }]}>
                      {c.categoria === 'Oficiais' ? (
                        highlightText(c.oficial || '-', buscaLower, styles.tableCell, 1)
                      ) : c.praca === 'SO' ? (
                        <LabelSO color="#111827" fontSize={12} fontWeight={900} />
                      ) : (
                        highlightText(c.praca || '-', buscaLower, styles.tableCell, 1)
                      )}
                    </View>
                    <View style={[colSep(true), { flex: 1 }]}>
                      {highlightText(c.nip ? c.nip : '-', buscaLower, styles.tableCell, 1)}
                    </View>
                    <View style={[colSep(true), { flex: 2 }]}>
                      {highlightText(c.nome ? c.nome : '-', buscaLower, styles.tableCell, 1)}
                    </View>
                    <View style={[colSep(true), { flex: 1 }]}>
                      {highlightText(
                        idadeDisplayFromDataNascimento(c.dataNascimento),
                        buscaLower,
                        styles.tableCell,
                        1
                      )}
                    </View>
                    {isAplicacaoTaf ? (
                      <>
                        <View style={[colSep(true), { flex: 1 }]}>
                          {highlightText(tempos.corrida || '-', buscaLower, styles.tableCell, 1)}
                        </View>
                        <View style={[colSep(false), { flex: 0.85 }]}>
                          {highlightText(
                            (c.notaCorrida || '').trim() || '-',
                            buscaLower,
                            styles.tableCell,
                            1
                          )}
                        </View>
                        <View style={[colSep(true), { flex: 1 }]}>
                          {highlightText(tempos.natacao || '-', buscaLower, styles.tableCell, 1)}
                        </View>
                        <View style={[colSep(false), { flex: 0.85 }]}>
                          {highlightText(
                            (c.notaNatacao || '').trim() || '-',
                            buscaLower,
                            styles.tableCell,
                            1
                          )}
                        </View>
                        <View style={[colSep(true), { flex: 1.1 }]}>
                          {highlightText(permanenciaLabel(c), buscaLower, styles.tableCell, 1)}
                        </View>
                      </>
                    ) : null}

                    {showActions && onEdit && onRequestDelete ? (
                      <View style={[colSep(true), styles.actionsCell, { flex: 1 }]}>
                        <TouchableOpacity
                          accessibilityLabel="Editar cadastro"
                          onPress={() => onEdit(c)}
                          style={[styles.iconBtn, styles.iconBtnEdit]}
                        >
                          <Pencil size={16} color="#111827" strokeWidth={3} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          accessibilityLabel="Excluir cadastro"
                          onPress={() => onRequestDelete(c)}
                          style={[styles.iconBtn, styles.iconBtnDelete]}
                        >
                          <Trash2 size={16} color="#DC2626" strokeWidth={3} />
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  tableCard: {
    width: '100%',
    maxWidth: 720,
    padding: 14,
    borderRadius: 20,
  },
  tableTitle: { fontSize: 14, fontWeight: '800', color: '#111827', marginBottom: 10 },
  tableEmpty: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17,24,39,0.15)',
    paddingBottom: 10,
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17,24,39,0.08)',
  },
  tableCol: {
    minWidth: 0,
    justifyContent: 'center',
  },
  tableColDivider: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(17,24,39,0.12)',
    paddingLeft: 6,
  },
  tableCell: { fontSize: 12, fontWeight: '700', color: '#111827', paddingHorizontal: 4 },
  highlightText: { fontWeight: '900' },

  filtersWrap: { marginBottom: 10, gap: 12 },
  filterBlock: { gap: 8 },
  filterOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterOptionBtn: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  segmented: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.10)',
    overflow: 'hidden',
  },
  segmentBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },

  searchWrap: {
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.70)',
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  actionsCell: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 4 },
  iconBtn: { padding: 6, borderRadius: 10, borderWidth: 1 },
  iconBtnEdit: { borderColor: 'rgba(17,24,39,0.12)', backgroundColor: 'rgba(17,24,39,0.04)' },
  iconBtnDelete: { borderColor: 'rgba(220,38,38,0.20)', backgroundColor: 'rgba(220,38,38,0.08)' },
});
