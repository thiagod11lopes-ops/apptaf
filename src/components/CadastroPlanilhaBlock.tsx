import React, { useCallback, useEffect, useMemo, useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  FlatList,
  type ListRenderItem,
} from 'react-native';
import { Pencil, Trash2, Search, ListFilter, ShieldAlert } from 'lucide-react-native';
import { CorrigirNipCadastroModal } from './CorrigirNipCadastroModal';
import { FatoresRiscoCadastroModal } from './FatoresRiscoCadastroModal';
import { contarCadastrosComErroNip, nipChaveCadastro, nipDigitos } from '../utils/nipFormat';
import { Card } from './Card';
import { LabelNip } from './LabelNip';
import { LabelSO } from './LabelSO';
import { LabelSvgText } from './LabelSvgText';
import { TafGlassPanel, TafSectionHeader } from './mobile/TafTabChrome';
import { getAplicarTafGlass } from './taf/aplicar/aplicarTafTheme';
import { PREMIUM } from '../theme/premium';
import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import {
  getAllFatoresRisco,
  getFatoresRiscoByNip,
  type FatoresRiscoRegistro,
} from '../services/fatoresRiscoStorage';
import {
  cadastroIncompletoNascimentoOuFatores,
  fatoresRiscoRegistroPreenchido,
} from '../utils/cadastroIncompleto';
import { idadeDisplayFromDataNascimento } from '../utils/idadeFromDataNascimento';
import { textoNotaCorridaFromCadastro } from '../taf/corrida2400Nota';
import { textoNotaNatacaoFromCadastro } from '../taf/natacaoNota';
import { formatTempoNatacaoParaExibicao } from '../taf/tafTimeFormat';
import { stripPrefixoDesistenciaTempo } from '../utils/formatTempoColunaResultado';
import { TafPlanilhaFiltrosBar } from './TafPlanilhaFiltrosBar';
import { ResultadosGeralTable } from './ResultadosGeralTable';
import { useTheme } from '../contexts/ThemeContext';
import { getUiColors } from '../theme/uiColors';
import { tableFullWidthStyle } from '../theme/tableLayout';
import {
  cadastroComTafCompleto,
  cadastroParaLinhaResultado,
} from '../utils/resultadoTafCadastro';
import {
  type FiltroModalidadeTaf,
  temRegistroModalidade,
  dataRegistroCoincide,
  dataExibicaoRegistro,
} from '../utils/tafRegistro';
import { formatNomeComPosto } from '../utils/formatNomeComPosto';

type Categoria = 'Oficiais' | 'Praças';

/** Lê tempos TAF; campo legado `tempo` vira Corrida. */
function temposCorridaNatacao(c: CadastroItemPersist) {
  const x = c as CadastroItemPersist & { tempo?: string };
  return {
    corrida: stripPrefixoDesistenciaTempo((x.tempoCorrida ?? x.tempo ?? '').trim()),
    natacao: stripPrefixoDesistenciaTempo((x.tempoNatacao ?? '').trim()),
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

/** Altura máx. da lista virtualizada (scroll interno — evita montar todas as linhas). */
const PLANILHA_LIST_MAX_HEIGHT = Platform.OS === 'web' ? 640 : 520;
const PLANILHA_ROW_GAP = 10;
/** Estimativa p/ windowing (linha de card moderna + gap). */
const PLANILHA_ROW_ESTIMATED = 208;

type HighlightFn = (
  text: string,
  queryLower: string,
  cellStyle?: object,
  numberOfLines?: number,
) => React.ReactNode;

type ModernCadastroRowProps = {
  item: CadastroItemPersist;
  buscaLower: string;
  glassBorder: string;
  rowBg: string;
  primary: string;
  accentMuted: string;
  textColor: string;
  textMuted: string;
  loss: string;
  isDark: boolean;
  showActions: boolean;
  highlightText: HighlightFn;
  renderPostoGradCell: (c: CadastroItemPersist, textStyle: object) => React.ReactNode;
  onEdit?: (item: CadastroItemPersist) => void;
  onRequestDelete?: (item: CadastroItemPersist) => void;
  onAbrirFatores: (c: CadastroItemPersist) => void | Promise<void>;
  fatoresPreenchidos: boolean;
  cfnColor: string;
};

const ModernCadastroRow = memo(function ModernCadastroRow({
  item: c,
  buscaLower,
  glassBorder,
  rowBg,
  primary,
  accentMuted,
  textColor,
  textMuted,
  loss,
  isDark,
  showActions,
  highlightText,
  renderPostoGradCell,
  onEdit,
  onRequestDelete,
  onAbrirFatores,
  fatoresPreenchidos,
  cfnColor,
}: ModernCadastroRowProps) {
  const normaLabel = c.normaTaf === 'cfn' ? 'CFN' : 'ARMADA';
  const normaColor = c.normaTaf === 'cfn' ? cfnColor : primary;
  return (
    <View
      style={[
        styles.modernRow,
        {
          borderColor: glassBorder,
          backgroundColor: rowBg,
        },
      ]}
    >
      <View style={styles.modernRowHeader}>
        <View style={styles.modernRowHeaderText}>
          {highlightText(formatNomeComPosto(c), buscaLower, styles.modernName, 2)}
          <View style={styles.modernChipRow}>
            <View
              style={[
                styles.modernChip,
                { borderColor: primary, backgroundColor: accentMuted },
              ]}
            >
              <Text style={[styles.modernChipText, { color: primary }]}>{c.categoria}</Text>
            </View>
            <View style={[styles.modernChip, { borderColor: glassBorder }]}>
              {renderPostoGradCell(c, [styles.modernChipText, { color: textColor }])}
            </View>
            <View
              style={[
                styles.modernChip,
                { borderColor: normaColor + '55', backgroundColor: normaColor + '18' },
              ]}
            >
              <Text style={[styles.modernChipText, { color: normaColor }]}>{normaLabel}</Text>
            </View>
          </View>
        </View>
        {showActions && onEdit && onRequestDelete ? (
          <View style={styles.modernActions}>
            <TouchableOpacity
              accessibilityLabel="Editar cadastro"
              onPress={() => onEdit(c)}
              style={[styles.modernIconBtn, { borderColor: glassBorder }]}
            >
              <Pencil size={17} color={primary} strokeWidth={2.5} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Excluir cadastro"
              onPress={() => onRequestDelete(c)}
              style={[styles.modernIconBtn, styles.modernIconBtnDanger]}
            >
              <Trash2 size={17} color={loss} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
      <View style={[styles.modernDivider, { backgroundColor: glassBorder }]} />
      <View style={styles.modernMetaGrid}>
        <View style={styles.modernMetaItem}>
          <LabelNip color={textMuted} fontSize={9} fontWeight="800" />
          {highlightText(c.nip || '-', buscaLower, styles.modernMetaValue, 1)}
        </View>
        <View style={styles.modernMetaItem}>
          <Text style={[styles.modernMetaLabel, { color: textMuted }]}>IDADE</Text>
          {highlightText(
            idadeDisplayFromDataNascimento(c.dataNascimento),
            buscaLower,
            styles.modernMetaValue,
            1,
          )}
        </View>
        <View style={styles.modernMetaItem}>
          <Text style={[styles.modernMetaLabel, { color: textMuted }]}>GÊNERO</Text>
          {highlightText(generoPlanilhaLabel(c), buscaLower, styles.modernMetaValue, 1)}
        </View>
      </View>
      <TouchableOpacity
        accessibilityLabel="Fatores de Risco"
        accessibilityRole="button"
        activeOpacity={0.88}
        onPress={() => onAbrirFatores(c)}
        style={[
          styles.fatoresBtn,
          {
            borderColor: fatoresPreenchidos
              ? isDark
                ? 'rgba(234,88,12,0.45)'
                : 'rgba(234,88,12,0.35)'
              : glassBorder,
            backgroundColor: fatoresPreenchidos
              ? isDark
                ? 'rgba(234,88,12,0.14)'
                : 'rgba(255,247,237,0.95)'
              : isDark
                ? 'rgba(139,92,246,0.12)'
                : 'rgba(237,233,254,0.85)',
          },
        ]}
      >
        <ShieldAlert
          size={16}
          color={fatoresPreenchidos ? '#ea580c' : '#8b5cf6'}
          strokeWidth={2.4}
        />
        <Text
          style={[
            styles.fatoresBtnText,
            { color: fatoresPreenchidos ? '#ea580c' : '#8b5cf6' },
          ]}
        >
          Fatores de Risco
        </Text>
      </TouchableOpacity>
    </View>
  );
});

function ModernRowSeparator() {
  return <View style={styles.modernRowSep} />;
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
  /** Lista só militares sem data de nascimento e/ou sem fatores preenchidos. */
  somenteCadastroIncompleto?: boolean;
  /** Remove o filtro de cadastro incompleto (chip na planilha). */
  onLimparFiltroIncompleto?: () => void;
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
  somenteCadastroIncompleto = false,
  onLimparFiltroIncompleto,
}: CadastroPlanilhaBlockProps) {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const isAplicacaoTaf = variant === 'aplicacaoTaf';
  const [filtroNorma, setFiltroNorma] = useState<'Todos' | 'armada' | 'cfn'>('Todos');
  const [filtroCategoria, setFiltroCategoria] = useState<'Todos' | Categoria | ''>('Todos');
  const [filtroPostoGrad, setFiltroPostoGrad] = useState<'Todos' | string>('Todos');
  const [filtroBusca, setFiltroBusca] = useState<string>('');
  const [filtroModalidade, setFiltroModalidade] = useState<FiltroModalidadeTaf>('Todos');
  const [filtroData, setFiltroData] = useState<string>('');
  const [modalErrosNipAberto, setModalErrosNipAberto] = useState(false);
  const [fatoresPorNip, setFatoresPorNip] = useState<Record<string, FatoresRiscoRegistro>>({});
  const [modalFatores, setModalFatores] = useState<{
    nome: string;
    nip: string;
    registro: FatoresRiscoRegistro | null;
  } | null>(null);

  const errosNipCount = useMemo(() => contarCadastrosComErroNip(cadastros), [cadastros]);

  useEffect(() => {
    if (isAplicacaoTaf) return;
    void getAllFatoresRisco()
      .then(setFatoresPorNip)
      .catch(() => setFatoresPorNip({}));
  }, [isAplicacaoTaf, cadastros]);

  const nipsFatoresPreenchidos = useMemo(() => {
    const out = new Set<string>();
    for (const [nip, reg] of Object.entries(fatoresPorNip)) {
      if (!fatoresRiscoRegistroPreenchido(reg)) continue;
      const key = nipChaveCadastro(nip) || nipChaveCadastro(reg.nip);
      if (key) out.add(key);
    }
    return out;
  }, [fatoresPorNip]);

  const abrirFatoresRiscoCadastro = useCallback(async (c: CadastroItemPersist) => {
    const key = nipDigitos(c.nip ?? '');
    const nome = formatNomeComPosto({ ...c, nome: (c.nome || '').trim() || 'Militar' });
    let registro: FatoresRiscoRegistro | null = key ? fatoresPorNip[key] ?? null : null;
    try {
      if (key) {
        registro = (await getFatoresRiscoByNip(key)) ?? registro;
        if (registro) {
          setFatoresPorNip((prev) => ({ ...prev, [key]: registro! }));
        }
      }
    } catch {
      // mantém o que já estava em memória
    }
    setModalFatores({
      nome,
      nip: key || c.nip || '',
      registro,
    });
  }, [fatoresPorNip]);

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
      if (
        somenteCadastroIncompleto &&
        !cadastroIncompletoNascimentoOuFatores(c, nipsFatoresPreenchidos)
      ) {
        return false;
      }
      // Filtro de Norma TAF
      if (filtroNorma === 'cfn' && c.normaTaf !== 'cfn') return false;
      if (filtroNorma === 'armada' && (c.normaTaf ?? 'armada') !== 'armada') return false;

      const categoriaOk = filtroCategoria === 'Todos' || c.categoria === filtroCategoria;
      if (!categoriaOk) return false;

      if (filtroPostoGrad === 'Todos') return true;
      const postoGrad = c.categoria === 'Oficiais' ? c.oficial || '' : c.praca || '';
      return postoGrad === filtroPostoGrad;
    });
  }, [
    cadastros,
    filtroNorma,
    filtroCategoria,
    filtroPostoGrad,
    isAplicacaoTaf,
    filtroModalidade,
    filtroData,
    somenteCadastroIncompleto,
    nipsFatoresPreenchidos,
  ]);

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

  const registrosTafCards = useMemo(
    () =>
      cadastrosFiltradosComBusca.map((c) => ({
        ...cadastroParaLinhaResultado(c),
        statusTaf: cadastroComTafCompleto(c) ? ('Completo' as const) : ('Parcial' as const),
      })),
    [cadastrosFiltradosComBusca],
  );

  const totalRegistrosTaf = useMemo(
    () => cadastros.filter((c) => temRegistroModalidade(c, 'Todos')).length,
    [cadastros],
  );

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
  const CFN_COLOR = '#F59E0B';
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

  const modernRowBg = theme.isDark ? 'rgba(2,6,23,0.42)' : 'rgba(255,255,255,0.55)';

  const renderModernCadastroItem: ListRenderItem<CadastroItemPersist> = useCallback(
    ({ item: c }) => {
      const nipKey = nipDigitos(c.nip);
      const fatoresPreenchidos = Boolean(nipKey && fatoresPorNip[nipKey]);
      return (
        <ModernCadastroRow
          item={c}
          buscaLower={buscaLower}
          glassBorder={glass.border}
          rowBg={modernRowBg}
          primary={theme.primary}
          accentMuted={theme.accentMuted}
          textColor={ui.text}
          textMuted={theme.textMuted}
          loss={theme.loss}
          isDark={theme.isDark}
          showActions={showActions}
          highlightText={highlightText}
          renderPostoGradCell={renderPostoGradCell}
          onEdit={onEdit}
          onRequestDelete={onRequestDelete}
          onAbrirFatores={abrirFatoresRiscoCadastro}
          fatoresPreenchidos={fatoresPreenchidos}
          cfnColor={CFN_COLOR}
        />
      );
    },
    [
      CFN_COLOR,
      abrirFatoresRiscoCadastro,
      buscaLower,
      fatoresPorNip,
      glass.border,
      highlightText,
      modernRowBg,
      onEdit,
      onRequestDelete,
      renderPostoGradCell,
      showActions,
      theme.accentMuted,
      theme.isDark,
      theme.loss,
      theme.primary,
      theme.textMuted,
      ui.text,
    ],
  );

  const modernListKeyExtractor = useCallback((item: CadastroItemPersist) => item.id, []);

  const modernListGetItemLayout = useCallback(
    (_: ArrayLike<CadastroItemPersist> | null | undefined, index: number) => ({
      length: PLANILHA_ROW_ESTIMATED + PLANILHA_ROW_GAP,
      offset: (PLANILHA_ROW_ESTIMATED + PLANILHA_ROW_GAP) * index,
      index,
    }),
    [],
  );

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
            <View style={styles.normaFilterRow}>
              {(
                [
                  { id: 'Todos', label: 'Todos' },
                  { id: 'armada', label: 'ARMADA' },
                  { id: 'cfn', label: 'CFN' },
                ] as const
              ).map(({ id, label }) => {
                const active = filtroNorma === id;
                const cor = id === 'cfn' ? CFN_COLOR : theme.primary;
                const count =
                  id === 'Todos'
                    ? cadastros.length
                    : id === 'cfn'
                      ? cadastros.filter((c) => c.normaTaf === 'cfn').length
                      : cadastros.filter((c) => (c.normaTaf ?? 'armada') === 'armada').length;
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => setFiltroNorma(id)}
                    style={[
                      styles.normaChip,
                      {
                        borderColor: active ? cor : glass.border,
                        backgroundColor: active ? cor + '22' : glass.highlight,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.normaChipText,
                        { color: active ? cor : theme.textMuted },
                      ]}
                    >
                      {label}
                    </Text>
                    <View
                      style={[
                        styles.normaChipBadge,
                        { backgroundColor: active ? cor : theme.textMuted + '33' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.normaChipBadgeText,
                          { color: active ? '#fff' : theme.textMuted },
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {!isAplicacaoTaf && somenteCadastroIncompleto ? (
            <View style={styles.incompletoBanner}>
              <View
                style={[
                  styles.incompletoChip,
                  {
                    borderColor: theme.isDark ? 'rgba(217,119,6,0.5)' : 'rgba(217,119,6,0.4)',
                    backgroundColor: theme.isDark
                      ? 'rgba(217,119,6,0.16)'
                      : 'rgba(255,247,237,0.95)',
                  },
                ]}
              >
                <Text style={[styles.incompletoChipText, { color: '#d97706' }]}>
                  Cadastro incompleto — sem data de nascimento e/ou fatores de risco
                </Text>
                {onLimparFiltroIncompleto ? (
                  <TouchableOpacity
                    accessibilityLabel="Mostrar todos os cadastros"
                    onPress={onLimparFiltroIncompleto}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[styles.incompletoClear, { color: theme.primary }]}>Ver todos</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}

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
            <Text style={[styles.tableEmpty, { color: theme.textSecondary }]}>
              {somenteCadastroIncompleto
                ? 'Nenhum cadastro incompleto encontrado.'
                : 'Nenhum resultado encontrado.'}
            </Text>
          ) : isAplicacaoTaf ? (
            <ResultadosGeralTable data={registrosTafCards} buscaLower={buscaLower} />
          ) : useModernCadastro ? (
            <FlatList
              data={cadastrosFiltradosComBusca}
              keyExtractor={modernListKeyExtractor}
              renderItem={renderModernCadastroItem}
              style={[styles.modernList, { maxHeight: PLANILHA_LIST_MAX_HEIGHT }]}
              contentContainerStyle={styles.modernListContent}
              ItemSeparatorComponent={ModernRowSeparator}
              getItemLayout={modernListGetItemLayout}
              initialNumToRender={12}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              windowSize={7}
              removeClippedSubviews={Platform.OS !== 'web'}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            />
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
                      {highlightText(formatNomeComPosto(c), buscaLower, styles.tableCell, 1)}
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

      {!isAplicacaoTaf ? (
        <FatoresRiscoCadastroModal
          visible={modalFatores != null}
          nome={modalFatores?.nome ?? ''}
          nip={modalFatores?.nip ?? ''}
          registro={modalFatores?.registro ?? null}
          onClose={() => setModalFatores(null)}
        />
      ) : null}
    </>
  );

  if (useModernCadastro || isAplicacaoTaf) {
    const registroCount = isAplicacaoTaf ? totalRegistrosTaf : cadastros.length;
    const registroLabel = isAplicacaoTaf ? 'registro' : 'cadastro';
    return (
      <TafGlassPanel accent="cyan" style={styles.tableCardModern}>
        <TafSectionHeader
          kicker="PLANILHA"
          title={tableTitle}
          subtitle={`${registroCount} ${registroLabel}${registroCount !== 1 ? 's' : ''} no sistema`}
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
  incompletoBanner: {
    marginBottom: 10,
  },
  incompletoChip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  incompletoChipText: {
    flex: 1,
    minWidth: 160,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  incompletoClear: {
    fontSize: 12,
    fontWeight: '800',
  },
  modernList: {
    maxHeight: PLANILHA_LIST_MAX_HEIGHT,
  },
  modernListContent: {
    paddingBottom: 4,
  },
  modernRowSep: {
    height: PLANILHA_ROW_GAP,
  },
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
  fatoresBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  fatoresBtnText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
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

  normaFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  normaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  normaChipText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  normaChipBadge: {
    minWidth: 20,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  normaChipBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
});
