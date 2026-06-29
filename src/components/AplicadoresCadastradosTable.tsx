import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { LabelNip } from './LabelNip';
import type { AplicadorItemPersist } from '../services/aplicadoresIndexedDb';
import { PREMIUM } from '../theme/premium';
import { tableFullWidthStyle } from '../theme/tableLayout';
import { getUiColors } from '../theme/uiColors';
import { getAplicarTafGlass } from './taf/aplicar/aplicarTafTheme';
import { TafGlassPanel } from './mobile/TafTabChrome';

function postoGradLabel(item: AplicadorItemPersist): string {
  if (item.categoria === 'Oficiais') return (item.oficial || '').trim() || '—';
  return (item.praca || '').trim() || '—';
}

function CategoriaChip({ categoria }: { categoria: AplicadorItemPersist['categoria'] }) {
  const { theme } = useTheme();
  const isOficial = categoria === 'Oficiais';

  return (
    <View
      style={[
        styles.chip,
        {
          borderColor: isOficial ? theme.primary : theme.tokens.warning500,
          backgroundColor: isOficial ? 'rgba(37,99,235,0.1)' : 'rgba(245,158,11,0.12)',
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: isOficial ? theme.primary : theme.tokens.warning500 },
        ]}
      >
        {categoria}
      </Text>
    </View>
  );
}

type Props = {
  data: AplicadorItemPersist[];
  isBoss: boolean;
  onEditar?: (item: AplicadorItemPersist) => void;
  onExcluir?: (item: AplicadorItemPersist) => void;
};

export function AplicadoresCadastradosTable({
  data,
  isBoss,
  onEditar,
  onExcluir,
}: Props) {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const glass = getAplicarTafGlass(theme);

  const sorted = useMemo(
    () => [...data].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [data],
  );

  return (
    <View style={styles.modernList}>
      {sorted.map((item) => (
        <View key={item.id} style={styles.itemPress}>
          <TafGlassPanel style={styles.modernRow}>
            <View style={styles.modernRowHeader}>
              <View style={styles.modernRowHeaderText}>
                <Text style={[styles.modernName, { color: ui.text }]} numberOfLines={2}>
                  {item.nome || '—'}
                </Text>
                <View style={styles.modernChipRow}>
                  <View style={[styles.modernChip, { borderColor: glass.border }]}>
                    <Text style={[styles.modernChipText, { color: ui.text }]} numberOfLines={1}>
                      {postoGradLabel(item)}
                    </Text>
                  </View>
                  <CategoriaChip categoria={item.categoria} />
                </View>
              </View>
              {isBoss ? (
                <View style={styles.modernActions}>
                  <TouchableOpacity
                    accessibilityLabel={`Editar aplicador ${item.nome}`}
                    onPress={() => onEditar?.(item)}
                    style={[styles.modernIconBtn, { borderColor: glass.border }]}
                  >
                    <Pencil size={17} color={theme.primary} strokeWidth={2.5} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityLabel={`Excluir aplicador ${item.nome}`}
                    onPress={() => onExcluir?.(item)}
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
                <Text style={[styles.modernMetaValue, { color: ui.text }]} numberOfLines={1}>
                  {item.nip || '—'}
                </Text>
              </View>
              <View style={styles.modernMetaItem}>
                <Text style={[styles.modernMetaLabel, { color: theme.textMuted }]}>CATEGORIA</Text>
                <Text style={[styles.modernMetaValue, { color: ui.text }]}>{item.categoria}</Text>
              </View>
              {isBoss ? (
                <View style={styles.modernMetaItem}>
                  <Text style={[styles.modernMetaLabel, { color: theme.textMuted }]}>SENHA</Text>
                  <Text
                    style={[styles.modernMetaValue, styles.senhaValue, { color: ui.text }]}
                    numberOfLines={1}
                  >
                    {item.senha?.trim() || '—'}
                  </Text>
                </View>
              ) : null}
            </View>
          </TafGlassPanel>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  modernList: {},
  itemPress: { marginBottom: 12 },
  modernRow: {
    ...tableFullWidthStyle,
    padding: 14,
    gap: 0,
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
  modernChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  modernChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  modernChipText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
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
    flexBasis: '40%',
    minWidth: 120,
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
  senhaValue: {
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
});
