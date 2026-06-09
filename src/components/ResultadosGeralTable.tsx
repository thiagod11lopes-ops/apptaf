import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type Header,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Trash2 } from 'lucide-react-native';
import { PressableScale } from './premium/PressableScale';
import { useTheme } from '../contexts/ThemeContext';
import { SearchHighlightText } from './SearchHighlightText';
import type { ResultadoGeralItem } from '../utils/resultadoTafCadastro';
import { PREMIUM } from '../theme/premium';
import { getUiColors } from '../theme/uiColors';

const COL = {
  nip: 112,
  nome: 168,
  status: 88,
  nota: 62,
  situacao: 84,
  permanencia: 104,
  acoes: 76,
} as const;

const columnHelper = createColumnHelper<ResultadoGeralItem>();

/** Largura real do cabeçalho (grupos = soma das colunas folha). */
function larguraHeader(header: Header<ResultadoGeralItem, unknown>): number {
  if (header.subHeaders.length > 0) {
    return header.subHeaders.reduce((sum, sub) => sum + sub.getSize(), 0);
  }
  return header.getSize();
}

function situacaoCor(situacao: string, theme: { gain: string; loss: string; textMuted: string }) {
  if (situacao === 'Aprovado') return theme.gain;
  if (situacao === 'Reprovado') return theme.loss;
  return theme.textMuted;
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

type Props = {
  data: ResultadoGeralItem[];
  buscaLower: string;
  onEditar?: (item: ResultadoGeralItem) => void;
  onExcluir?: (item: ResultadoGeralItem) => void;
};

export function ResultadosGeralTable({ data, buscaLower, onEditar, onExcluir }: Props) {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const [sorting, setSorting] = useState<SortingState>([]);

  const cellBase = useMemo(
    () => [styles.cell, { color: ui.text }],
    [ui.text],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('nip', {
        header: 'NIP',
        size: COL.nip,
        enableSorting: true,
        meta: { align: 'left' as const },
        cell: (info) => (
          <SearchHighlightText
            text={info.getValue()}
            queryLower={buscaLower}
            style={[cellBase, styles.nipCell]}
            numberOfLines={1}
          />
        ),
      }),
      columnHelper.accessor('nome', {
        header: 'Nome',
        size: COL.nome,
        enableSorting: true,
        meta: { align: 'left' as const },
        cell: (info) => (
          <SearchHighlightText
            text={info.getValue()}
            queryLower={buscaLower}
            style={cellBase}
            numberOfLines={2}
          />
        ),
      }),
      columnHelper.accessor('statusTaf', {
        header: 'Status',
        size: COL.status,
        enableSorting: true,
        meta: { align: 'center' as const },
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      columnHelper.group({
        id: 'corrida',
        header: 'Corrida',
        meta: { align: 'center' as const },
        columns: [
          columnHelper.accessor('notaCorrida', {
            header: 'Nota',
            size: COL.nota,
            enableSorting: true,
            meta: { align: 'center' as const, groupStart: true },
            cell: (info) => (
              <SearchHighlightText text={info.getValue()} queryLower={buscaLower} style={cellBase} />
            ),
          }),
          columnHelper.accessor('situacaoCorrida', {
            header: 'Situação',
            size: COL.situacao,
            enableSorting: true,
            meta: { align: 'center' as const },
            cell: (info) => (
              <SearchHighlightText
                text={info.getValue()}
                queryLower={buscaLower}
                style={[cellBase, { color: situacaoCor(info.getValue(), theme) }]}
              />
            ),
          }),
        ],
      }),
      columnHelper.group({
        id: 'natacao',
        header: 'Natação',
        meta: { align: 'center' as const },
        columns: [
          columnHelper.accessor('notaNatacao', {
            header: 'Nota',
            size: COL.nota,
            enableSorting: true,
            meta: { align: 'center' as const, groupStart: true },
            cell: (info) => (
              <SearchHighlightText text={info.getValue()} queryLower={buscaLower} style={cellBase} />
            ),
          }),
          columnHelper.accessor('situacaoNatacao', {
            header: 'Situação',
            size: COL.situacao,
            enableSorting: true,
            meta: { align: 'center' as const },
            cell: (info) => (
              <SearchHighlightText
                text={info.getValue()}
                queryLower={buscaLower}
                style={[cellBase, { color: situacaoCor(info.getValue(), theme) }]}
              />
            ),
          }),
        ],
      }),
      columnHelper.group({
        id: 'permanencia',
        header: 'Permanência',
        meta: { align: 'center' as const },
        columns: [
          columnHelper.accessor('permanenciaTempo', {
            header: 'Permanência',
            size: COL.permanencia,
            enableSorting: true,
            meta: { align: 'center' as const, groupStart: true },
            cell: (info) => (
              <SearchHighlightText text={info.getValue()} queryLower={buscaLower} style={cellBase} />
            ),
          }),
          columnHelper.accessor('situacaoPermanencia', {
            header: 'Situação',
            size: COL.situacao,
            enableSorting: true,
            meta: { align: 'center' as const },
            cell: (info) => (
              <SearchHighlightText
                text={info.getValue()}
                queryLower={buscaLower}
                style={[cellBase, { color: situacaoCor(info.getValue(), theme) }]}
              />
            ),
          }),
        ],
      }),
      columnHelper.display({
        id: 'acoes',
        header: 'Ações',
        size: COL.acoes,
        meta: { align: 'center' as const },
        cell: (info) => (
          <View style={styles.acoesRow}>
            <PressableScale
              onPress={() => onEditar?.(info.row.original)}
              style={[styles.acaoBtn, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
              accessibilityLabel={`Editar resultados de ${info.row.original.nome}`}
            >
              <Pencil size={15} color={theme.primary} strokeWidth={2.2} />
            </PressableScale>
            <PressableScale
              onPress={() => onExcluir?.(info.row.original)}
              style={[styles.acaoBtn, styles.acaoBtnDanger, { borderColor: theme.loss }]}
              accessibilityLabel={`Excluir resultados de ${info.row.original.nome}`}
            >
              <Trash2 size={15} color={theme.loss} strokeWidth={2.2} />
            </PressableScale>
          </View>
        ),
      }),
    ],
    [buscaLower, cellBase, theme, onEditar, onExcluir],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const tableWidth = table.getAllLeafColumns().reduce((sum, col) => sum + col.getSize(), 0);
  const headerGroups = table.getHeaderGroups();
  const isSubHeaderRow = (depth: number) => depth === headerGroups.length - 1;

  const renderSortIcon = (columnId: string, canSort: boolean) => {
    if (!canSort) return null;
    const col = table.getColumn(columnId);
    const sorted = col?.getIsSorted();
    const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown;
    return <Icon size={12} color="rgba(255,255,255,0.85)" strokeWidth={2.5} style={styles.sortIcon} />;
  };

  return (
    <View
      style={[
        styles.tableShell,
        {
          borderColor: theme.border,
          backgroundColor: theme.surface,
        },
        Platform.OS === 'web'
          ? ({ boxShadow: 'none', overflowX: 'hidden' } as object)
          : null,
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        nestedScrollEnabled
        bounces={false}
        style={styles.tableScroll}
        contentContainerStyle={[styles.tableScrollContent, { width: tableWidth }]}
      >
        <View style={[styles.tableFrame, { width: tableWidth }]}>
          <LinearGradient
            colors={[...theme.tokens.gradientPrimaryBtn]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.headerBlock, { width: tableWidth }]}
          >
            {headerGroups.map((headerGroup) => (
              <View
                key={headerGroup.id}
                style={[
                  styles.headerRow,
                  { width: tableWidth },
                  isSubHeaderRow(headerGroup.depth) ? styles.headerSubRow : null,
                ]}
              >
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as
                    | { align?: 'left' | 'center'; groupStart?: boolean }
                    | undefined;
                  const w = larguraHeader(header);
                  const isPlaceholder = header.isPlaceholder;
                  const subRow = isSubHeaderRow(headerGroup.depth);

                  return (
                    <Pressable
                      key={header.id}
                      onPress={
                        header.column.getCanSort()
                          ? () => header.column.toggleSorting()
                          : undefined
                      }
                      style={[
                        styles.headerCellWrap,
                        {
                          width: w,
                          flexShrink: 0,
                        },
                        meta?.align === 'center' ? styles.colCenter : null,
                        subRow && meta?.groupStart ? styles.colGroupDivider : null,
                      ]}
                      accessibilityRole={header.column.getCanSort() ? 'button' : undefined}
                    >
                      {isPlaceholder ? null : (
                        <View style={styles.headerLabelRow}>
                          <Text
                            style={subRow ? styles.headerSubCell : styles.headerCell}
                            numberOfLines={2}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </Text>
                          {!isPlaceholder && header.column.getCanSort()
                            ? renderSortIcon(header.column.id, true)
                            : null}
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </LinearGradient>

          {table.getRowModel().rows.map((row, index) => {
            const zebra = index % 2 === 1;
            return (
              <View
                key={row.id}
                style={[
                  styles.dataRow,
                  { width: tableWidth, borderBottomColor: theme.border },
                  zebra ? { backgroundColor: theme.backgroundSecondary } : null,
                ]}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as
                    | { align?: 'left' | 'center'; groupStart?: boolean }
                    | undefined;
                  return (
                    <View
                      key={cell.id}
                      style={[
                        styles.bodyCell,
                        {
                          width: cell.column.getSize(),
                          flexShrink: 0,
                        },
                        meta?.align === 'center' ? styles.colCenter : null,
                        meta?.groupStart ? styles.colGroupDividerBody : null,
                      ]}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tableShell: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: PREMIUM.radiusLg,
    borderWidth: 1,
  },
  tableScroll: {
    maxWidth: '100%',
    overflow: 'hidden',
  },
  tableScrollContent: {
    flexGrow: 0,
    flexShrink: 0,
  },
  tableFrame: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  headerBlock: {
    overflow: 'hidden',
    borderTopLeftRadius: PREMIUM.radiusLg - 1,
    borderTopRightRadius: PREMIUM.radiusLg - 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  headerSubRow: {
    paddingTop: 0,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  headerCellWrap: {
    justifyContent: 'center',
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  headerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  headerCell: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  headerSubCell: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  sortIcon: {
    marginLeft: 2,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bodyCell: {
    justifyContent: 'center',
    paddingHorizontal: 4,
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
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'ui-monospace, monospace',
    }),
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
  acoesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  acaoBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acaoBtnDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
});
