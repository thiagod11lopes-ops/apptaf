import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform } from 'react-native';
import { Pencil, Trash2, Search, ListFilter } from 'lucide-react-native';
import { CorrigirNipCadastroModal } from './CorrigirNipCadastroModal';
import { contarCadastrosComErroNip } from '../utils/nipFormat';
import { Card } from './Card';
import { LabelNip } from './LabelNip';
import { LabelSO } from './LabelSO';
import { LabelSvgText } from './LabelSvgText';
import { TafGlassPanel, TafSectionHeader } from './mobile/TafTabChrome';
import { getAplicarTafGlass } from './taf/aplicar/aplicarTafTheme';
import { PREMIUM } from '../theme/premium';
import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { idadeDisplayFromDataNascimento } from '../utils/idadeFromDataNascimento';
import { textoNotaCorridaFromCadastro } from '../taf/corrida2400Nota';
import { textoNotaNatacaoFromCadastro } from '../taf/natacaoNota';
import { formatTempoNatacaoParaExibicao } from '../taf/tafTimeFormat';
import { TafPlanilhaFiltrosBar } from './TafPlanilhaFiltrosBar';
import { useTheme } from '../contexts/ThemeContext';
import { getUiColors } from '../theme/uiColors';
import { tableFullWidthStyle } from '../theme/tableLayout';
import {
  type FiltroModalidadeTaf,
  temRegistroModalidade,
  dataRegistroCoincide,
  dataExibicaoRegistro,
} from '../utils/tafRegistro';

type Categoria = 'Oficiais' | 'Praças';

/** Lê tempos TAF; campo legado `tempo` vira Corrida. */
function temposCorridaNatacao(c: CadastroItemPersist) {
  const x = c as CadastroItemPersist & { tempo?: string };
  return {
    corrida: (x.tempoCorrida ?? x.tempo ?? '').trim(),
    natacao: (x.tempoNatacao ?? '').trim(),
  };
}

/** Resultado da prova de permanência. */
function permanenciaLabel(c: CadastroItemPersist): string {
  const r = c.resultadoPermanencia ?? c.resultadoNatacao;
  if (r === 'aprovado') return 'Aprovado';
  if (r === 'reprovado') return 'Reprovado';
  return '-';
}

/** Gênero na planilha (M → Masculino, F → Feminino). */
function generoPlanilhaLabel(c: CadastroItemPersist): string {
  return c.sexo === 'F' ? 'Feminino' : 'Masculino';
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
  /** Chamado após corrigir NIP no modal de erros. */
  onCadastroCorrigido?: (item: CadastroItemPersist) => void;
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
  onCadastroCorrigido,
}: CadastroPlanilhaBlockProps) {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const isAplicacaoTaf = variant === 'aplicacaoTaf';
  const [filtroCategoria, setFiltroCategoria] = useState<'Todos' | Categoria | ''>('Todos');
  const [filtroPostoGrad, setFiltroPostoGrad] = useState<'Todos' | string>('Todos');
  const [filtroBusca, setFiltroBusca] = useState<string>('');
  const [filtroModalidade, setFiltroModalidade] = useState<FiltroModalidadeTaf>('Todos');
  const [filtroData, setFiltroData] = useState<string>('');
  const [modalErrosNipAberto, setModalErrosNipAberto] = useState(false);

  const errosNipCount = useMemo(() => contarCadastrosComErroNip(cadastros), [cadastros]);

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
    if (isAplicacaoTaf) {
      return cadastros.filter((c) => {
        if (!temRegistroModalidade(c, filtroModalidade)) return false;
        if (!dataRegistroCoincide(c, filtroModalidade, filtroData)) return false;
        return true;
      });
    }
    return cadastros.filter((c) => {
      const categoriaOk = filtroCategoria === 'Todos' || c.categoria === filtroCategoria;
      if (!categoriaOk) return false;

      if (filtroPostoGrad === 'Todos') return true;
      const postoGrad = c.categoria === 'Oficiais' ? c.oficial || '' : c.praca || '';
      return postoGrad === filtroPostoGrad;
    });
  }, [cadastros, filtroCategoria, filtroPostoGrad, isAplicacaoTaf, filtroModalidade, filtroData]);

  const cadastrosFiltradosComBusca = useMemo(() => {
    const q = filtroBusca.trim().toLowerCase();
    if (isAplicacaoTaf && q.length > 0 && q.length < 3) return cadastrosFiltrados;
    if (!q) return cadastrosFiltrados;

    const qDigits = q.replace(/\D/g, '');

    return cadastrosFiltrados.filter((c) => {
      const postoGrad = c.categoria === 'Oficiais' ? c.oficial || '' : c.praca || '';
      const idadeTxt = idadeDisplayFromDataNascimento(c.dataNascimento);
      const { corrida: tCorr, natacao: tNat } = temposCorridaNatacao(c);
      const nCor = textoNotaCorridaFromCadastro({
        tempoCorrida: tCorr,
        dataNascimento: c.dataNascimento,
        sexo: c.sexo,
      });
      const nNat = textoNotaNatacaoFromCadastro({
        tempoNatacao: tNat,
        dataNascimento: c.dataNascimento,
        sexo: c.sexo,
      });
      const perm = permanenciaLabel(c);
      const gen = generoPlanilhaLabel(c);
      const dataReg = `${c.dataTafCorrida || ''} ${c.dataTafNatacao || ''} ${c.dataTafPermanencia || ''}`;
      const haystack = `${c.categoria} ${postoGrad} ${c.nip} ${c.nome} ${gen} masculino feminino homem mulher gênero genero ${c.dataNascimento} ${idadeTxt} ${tCorr} ${nCor} ${tNat} ${nNat} ${perm} permanência corrida natação natacao aprovado reprovado ${dataReg}`
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

  const buscaLower = useMemo(() => {
    const q = filtroBusca.trim().toLowerCase();
    if (isAplicacaoTaf && q.length > 0 && q.length < 3) return '';
    return q;
  }, [filtroBusca, isAplicacaoTaf]);

  const cellTextStyle = useMemo(
    () => [styles.tableCell, { color: ui.text }],
    [ui.text],
  );

  const highlightText = useCallback(
    (text: string, queryLower: string, cellStyle?: any, numberOfLines: number = 1) => {
      const value = text || '-';
      const baseStyle = cellStyle ? [cellStyle, { color: ui.text }] : cellTextStyle;
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
    [ui.text, cellTextStyle],
  );

  const selectedBg = ui.selectedBg;
  const unselectedBg = ui.unselectedBg;
  const labelInk = ui.text;
  const segmentInk = (active: boolean) => (active ? '#FFFFFF' : ui.text);
  const glass = getAplicarTafGlass(theme);
  const useModernCadastro = !isAplicacaoTaf;

  const renderPostoGradCell = useCallback(
    (c: CadastroItemPersist, textStyle: object) => {
      if (c.categoria === 'Oficiais') {
        return highlightText(c.oficial || '-', buscaLower, textStyle, 1);
      }
      if (c.praca === 'SO') {
        return <LabelSO color={labelInk} fontSize={13} fontWeight={900} />;
      }
      return highlightText(c.praca || '-', buscaLower, textStyle, 1);
    },
    [buscaLower, highlightText, labelInk],
  );

  /** Borda esquerda entre colunas da planilha (Registrador TAF). */
  const colSep = (showLeftDivider: boolean) =>
    showLeftDivider
      ? ([styles.tableCol, styles.tableColDivider, { borderLeftColor: ui.colDivider }] as const)
      : styles.tableCol;

  const planilhaBody = (
    <>
      {cadastros.length === 0 ? (
        <Text style={[styles.tableEmpty, { color: theme.textSecondary }]}>{emptyMessageWhenNoData}</Text>
      ) : (
        <View>
          {isAplicacaoTaf ? (
            <TafPlanilhaFiltrosBar
              filtroBusca={filtroBusca}
              onFiltroBuscaChange={setFiltroBusca}
              filtroModalidade={filtroModalidade}
              onFiltroModalidadeChange={setFiltroModalidade}
              filtroData={filtroData}
              onFiltroDataChange={setFiltroData}
            />
          ) : (
            <View style={styles.searchRow}>
              <View
                style={[
                  styles.searchWrap,
                  useModernCadastro ? styles.searchWrapModern : null,
                  {
                    borderColor: useModernCadastro ? glass.border : theme.border,
                    backgroundColor: useModernCadastro ? glass.highlight : ui.inputBg,
                  },
                ]}
              >
                <Search size={18} color={theme.primary} strokeWidth={2.5} />
                <TextInput
                  value={filtroBusca}
                  onChangeText={setFiltroBusca}
                  placeholder="Buscar por nome, NIP ou posto..."
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.searchInput,
                    { color: ui.text, backgroundColor: 'transparent' },
                  ]}
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="none"
                  textContentType="none"
                  accessibilityLabel="Localizar na planilha de cadastro"
                />
              </View>
              <TouchableOpacity
                accessibilityLabel="Filtrar cadastros com erro de NIP"
                accessibilityHint={`${errosNipCount} cadastro(s) com erro de NIP`}
                onPress={() => setModalErrosNipAberto(true)}
                style={[
                  styles.filterBtn,
                  useModernCadastro ? styles.filterBtnModern : null,
                  {
                    borderColor: errosNipCount > 0 ? theme.loss : glass.border,
                    backgroundColor: errosNipCount > 0 ? 'rgba(220,38,38,0.08)' : glass.highlight,
                  },
                ]}
              >
                <ListFilter
                  size={20}
                  color={errosNipCount > 0 ? theme.loss : theme.textSecondary}
                  strokeWidth={2.5}
                />
                {errosNipCount > 0 ? (
                  <View style={[styles.filterBadge, { backgroundColor: theme.loss }]}>
                    <Text style={styles.filterBadgeText}>{errosNipCount}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>
          )}

          {!isAplicacaoTaf ? (
          <View style={[styles.filtersWrap, useModernCadastro ? styles.filtersWrapModern : null]}>
            <View style={styles.filterBlock}>
              <Text style={[styles.filterKicker, { color: theme.primary }]}>CATEGORIA</Text>
              <View style={[styles.segmented, { borderColor: glass.border }]}>
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
                      <Text
                        style={[
                          styles.segmentBtnText,
                          { color: segmentInk(active) },
                        ]}
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {filtroCategoria !== 'Todos' ? (
              <View style={styles.filterBlock}>
                <Text style={[styles.filterKicker, { color: theme.primary }]}>POSTO / GRADUAÇÃO</Text>
                <View style={styles.filterOptionsGrid}>
                  {postoGradOptions.map((opt) => {
                    const active = filtroPostoGrad === opt;
                    return (
                      <TouchableOpacity
                        key={opt}
                        onPress={() => setFiltroPostoGrad(opt)}
                        style={[
                          styles.filterOptionBtn,
                          useModernCadastro ? styles.filterOptionBtnModern : null,
                          {
                            borderColor: active ? theme.primary : glass.border,
                            backgroundColor: active ? selectedBg : glass.highlight,
                          },
                        ]}
                      >
                        {opt === 'SO' ? (
                          <LabelSO color={segmentInk(active)} fontSize={12} fontWeight={900} />
                        ) : (
                          <Text style={[styles.filterOptionText, { color: segmentInk(active) }]}>
                            {opt}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
          ) : null}

          {useModernCadastro ? (
            <Text style={[styles.resultCount, { color: theme.textMuted }]}>
              {cadastrosFiltradosComBusca.length} de {cadastros.length} cadastro
              {cadastros.length !== 1 ? 's' : ''}
            </Text>
          ) : null}

          {cadastrosFiltradosComBusca.length === 0 ? (
            <Text style={[styles.tableEmpty, { color: theme.textSecondary }]}>Nenhum resultado encontrado.</Text>
          ) : useModernCadastro ? (
            <View style={styles.modernList}>
              {cadastrosFiltradosComBusca.map((c) => (
                <View
                  key={c.id}
                  style={[
                    styles.modernRow,
                    {
                      borderColor: glass.border,
                      backgroundColor: theme.isDark ? 'rgba(2,6,23,0.42)' : 'rgba(255,255,255,0.55)',
                    },
                  ]}
                >
                  <View style={styles.modernRowHeader}>
                    <View style={styles.modernRowHeaderText}>
                      {highlightText(c.nome || '-', buscaLower, styles.modernName, 2)}
                      <View style={styles.modernChipRow}>
                        <View
                          style={[
                            styles.modernChip,
                            { borderColor: theme.primary, backgroundColor: theme.accentMuted },
                          ]}
                        >
                          <Text style={[styles.modernChipText, { color: theme.primary }]}>
                            {c.categoria}
                          </Text>
                        </View>
                        <View style={[styles.modernChip, { borderColor: glass.border }]}>
                          {renderPostoGradCell(c, [styles.modernChipText, { color: ui.text }])}
                        </View>
                      </View>
                    </View>
                    {showActions && onEdit && onRequestDelete ? (
                      <View style={styles.modernActions}>
                        <TouchableOpacity
                          accessibilityLabel="Editar cadastro"
                          onPress={() => onEdit(c)}
                          style={[styles.modernIconBtn, { borderColor: glass.border }]}
                        >
                          <Pencil size={17} color={theme.primary} strokeWidth={2.5} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          accessibilityLabel="Excluir cadastro"
                          onPress={() => onRequestDelete(c)}
                          style={[styles.modernIconBtn, styles.modernIconBtnDanger]}
                        >
                          <Trash2 size={17} color={theme.loss} strokeWidth={2.5} />
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                  <View style={[styles.modernDivider, { backgroundColor: glass.border }]} />
                  <View style={styles.modernMetaGrid}>
                    <View style={styles.modernMetaItem}>
                      <LabelNip color={theme.textMuted} fontSize={9} fontWeight="800" />
                      {highlightText(c.nip || '-', buscaLower, styles.modernMetaValue, 1)}
                    </View>
                    <View style={styles.modernMetaItem}>
                      <Text style={[styles.modernMetaLabel, { color: theme.textMuted }]}>IDADE</Text>
                      {highlightText(
                        idadeDisplayFromDataNascimento(c.dataNascimento),
                        buscaLower,
                        styles.modernMetaValue,
                        1,
                      )}
                    </View>
                    <View style={styles.modernMetaItem}>
                      <Text style={[styles.modernMetaLabel, { color: theme.textMuted }]}>GÊNERO</Text>
                      {highlightText(generoPlanilhaLabel(c), buscaLower, styles.modernMetaValue, 1)}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View>
              <View
                style={[
                  styles.tableHeaderRow,
                  { borderBottomColor: ui.headerBorder, backgroundColor: ui.tableHeaderBg },
                ]}
              >
                {!isAplicacaoTaf ? (
                  <View style={[colSep(false), { flex: 1 }]}>
                    <LabelSvgText text="Categoria" color={labelInk} fontSize={12} fontWeight={800} width={110} height={18} />
                  </View>
                ) : null}
                <View style={[colSep(!isAplicacaoTaf), { flex: 1 }]}>
                  <LabelSvgText text="Posto / Graduação" color={labelInk} fontSize={12} fontWeight={800} width={160} height={18} />
                </View>
                <View style={[colSep(true), { flex: 1, paddingHorizontal: 4 }]}>
                  <LabelNip color={labelInk} fontSize={12} fontWeight="800" />
                </View>
                <View style={[colSep(true), { flex: 2 }]}>
                  <LabelSvgText text="Nome" color={labelInk} fontSize={12} fontWeight={800} width={90} height={18} />
                </View>
                {!isAplicacaoTaf ? (
                  <View style={[colSep(true), { flex: 0.9 }]}>
                    <LabelSvgText text="Gênero" color={labelInk} fontSize={12} fontWeight={800} width={72} height={18} />
                  </View>
                ) : null}
                <View style={[colSep(true), { flex: 1 }]}>
                  <LabelSvgText text="Idade" color={labelInk} fontSize={12} fontWeight={800} width={56} height={18} />
                </View>
                {isAplicacaoTaf ? (
                  <>
                    <View style={[colSep(true), { flex: 0.85 }]}>
                      <LabelSvgText text="Data" color={labelInk} fontSize={12} fontWeight={800} width={48} height={18} />
                    </View>
                    <View style={[colSep(true), { flex: 1 }]}>
                      <LabelSvgText text="Corrida" color={labelInk} fontSize={12} fontWeight={800} width={80} height={18} />
                    </View>
                    <View style={[colSep(false), { flex: 0.75 }]}>
                      <LabelSvgText text="Nota" color={labelInk} fontSize={12} fontWeight={800} width={44} height={18} />
                    </View>
                    <View style={[colSep(true), { flex: 1 }]}>
                      <LabelSvgText text="Natação" color={labelInk} fontSize={12} fontWeight={800} width={90} height={18} />
                    </View>
                    <View style={[colSep(true), { flex: 1.1 }]}>
                      <LabelSvgText text="Permanência" color={labelInk} fontSize={12} fontWeight={800} width={120} height={18} />
                    </View>
                  </>
                ) : null}
                {showActions ? (
                  <View style={[colSep(true), { flex: 1 }]}>
                    <LabelSvgText text="Ações" color={labelInk} fontSize={12} fontWeight={800} width={55} height={18} />
                  </View>
                ) : null}
              </View>

              {cadastrosFiltradosComBusca.map((c) => {
                const tempos = temposCorridaNatacao(c);
                return (
                  <View key={c.id} style={[styles.tableRow, { borderBottomColor: ui.rowBorder }]}>
                    {!isAplicacaoTaf ? (
                      <View style={[colSep(false), { flex: 1, alignItems: 'flex-start' }]}>
                        {highlightText(c.categoria, buscaLower, styles.tableCell, 1)}
                      </View>
                    ) : null}
                    <View style={[colSep(!isAplicacaoTaf), { flex: 1, alignItems: 'flex-start' }]}>
                      {c.categoria === 'Oficiais' ? (
                        highlightText(c.oficial || '-', buscaLower, styles.tableCell, 1)
                      ) : c.praca === 'SO' ? (
                        <LabelSO color={labelInk} fontSize={12} fontWeight={900} />
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
                    {!isAplicacaoTaf ? (
                      <View style={[colSep(true), { flex: 0.9 }]}>
                        {highlightText(generoPlanilhaLabel(c), buscaLower, styles.tableCell, 1)}
                      </View>
                    ) : null}
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
                        <View style={[colSep(true), { flex: 0.85 }]}>
                          {highlightText(
                            dataExibicaoRegistro(c, filtroModalidade),
                            buscaLower,
                            styles.tableCell,
                            1,
                          )}
                        </View>
                        <View style={[colSep(true), { flex: 1 }]}>
                          {highlightText(tempos.corrida || '-', buscaLower, styles.tableCell, 1)}
                        </View>
                        <View style={[colSep(false), { flex: 0.75 }]}>
                          {highlightText(
                            (() => {
                              const n = textoNotaCorridaFromCadastro({
                                tempoCorrida: tempos.corrida,
                                dataNascimento: c.dataNascimento,
                                sexo: c.sexo,
                              });
                              return n === '—' ? '-' : n;
                            })(),
                            buscaLower,
                            styles.tableCell,
                            1,
                          )}
                        </View>
                        <View style={[colSep(true), { flex: 1 }]}>
                          {highlightText(
                            formatTempoNatacaoParaExibicao(tempos.natacao) || '-',
                            buscaLower,
                            styles.tableCell,
                            1,
                          )}
                        </View>
                        <View style={[colSep(false), { flex: 0.75 }]}>
                          {highlightText(
                            (() => {
                              const n = textoNotaNatacaoFromCadastro({
                                tempoNatacao: tempos.natacao,
                                dataNascimento: c.dataNascimento,
                                sexo: c.sexo,
                              });
                              return n === '—' ? '-' : n;
                            })(),
                            buscaLower,
                            styles.tableCell,
                            1,
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
                          <Pencil size={16} color={labelInk} strokeWidth={3} />
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

      {!isAplicacaoTaf ? (
        <CorrigirNipCadastroModal
          visible={modalErrosNipAberto}
          cadastros={cadastros}
          onClose={() => setModalErrosNipAberto(false)}
          onCorrigido={(atualizado) => onCadastroCorrigido?.(atualizado)}
        />
      ) : null}
    </>
  );

  if (useModernCadastro) {
    return (
      <TafGlassPanel accent="cyan" style={styles.tableCardModern}>
        <TafSectionHeader
          kicker="PLANILHA"
          title={tableTitle}
          subtitle={`${cadastros.length} cadastro${cadastros.length !== 1 ? 's' : ''} no sistema`}
        />
        {planilhaBody}
      </TafGlassPanel>
    );
  }

  return (
    <Card glass={cardGlassEnabled} style={styles.tableCard}>
      <Text style={[styles.tableTitle, { color: ui.text }]}>{tableTitle}</Text>
      {planilhaBody}
    </Card>
  );
}

const styles = StyleSheet.create({
  tableCard: {
    ...tableFullWidthStyle,
    padding: 14,
    borderRadius: 20,
  },
  tableCardModern: {
    ...tableFullWidthStyle,
    marginBottom: 8,
  },
  tableTitle: { fontSize: 14, fontWeight: '800', color: '#111827', marginBottom: 10 },
  tableEmpty: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  resultCount: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  modernList: { gap: 10 },
  modernRow: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusLg,
    padding: 14,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 24px rgba(15,23,42,0.06)' } as object)
      : {
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 14,
          elevation: 4,
        }),
  },
  modernRowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  modernRowHeaderText: { flex: 1, minWidth: 0, gap: 8 },
  modernName: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
    lineHeight: 21,
  },
  modernChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modernChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  modernChipText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  modernActions: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  modernIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernIconBtnDanger: {
    borderColor: 'rgba(220,38,38,0.25)',
    backgroundColor: 'rgba(220,38,38,0.08)',
  },
  modernDivider: { height: 1, marginVertical: 12, opacity: 0.85 },
  modernMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  modernMetaItem: {
    flexGrow: 1,
    flexBasis: '28%',
    minWidth: 96,
    gap: 4,
  },
  modernMetaLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  modernMetaValue: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
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
  filtersWrapModern: { marginBottom: 4 },
  filterBlock: { gap: 8 },
  filterKicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  filterOptionText: {
    fontSize: 12,
    fontWeight: '800',
  },
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterOptionBtnModern: {
    borderRadius: PREMIUM.radiusMd,
  },

  segmented: {
    flexDirection: 'row',
    borderRadius: PREMIUM.radiusMd + 2,
    borderWidth: 1,
    overflow: 'hidden',
  },
  segmentBtn: { flex: 1, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd + 2,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  searchWrapModern: {
    paddingVertical: 6,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: PREMIUM.radiusMd + 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterBtnModern: {
    width: 46,
    height: 46,
  },
  filterBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    paddingVertical: 8,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  actionsCell: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 4 },
  iconBtn: { padding: 6, borderRadius: 10, borderWidth: 1 },
  iconBtnEdit: { borderColor: 'rgba(17,24,39,0.12)', backgroundColor: 'rgba(17,24,39,0.04)' },
  iconBtnDelete: { borderColor: 'rgba(220,38,38,0.20)', backgroundColor: 'rgba(220,38,38,0.08)' },
});
