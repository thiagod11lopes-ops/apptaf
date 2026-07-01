import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { History, Pencil, Trash2 } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { SearchHighlightText } from './SearchHighlightText';
import { LabelNip } from './LabelNip';
import type { ResultadoGeralItem } from '../utils/resultadoTafCadastro';
import { modalidadeCorridaCaminhadaDispensavel } from '../utils/corridaCaminhadaExcludente';
import { PREMIUM } from '../theme/premium';
import { tableFullWidthStyle } from '../theme/tableLayout';
import { getUiColors } from '../theme/uiColors';
import { getAplicarTafGlass } from './taf/aplicar/aplicarTafTheme';
import { TafGlassPanel } from './mobile/TafTabChrome';

function situacaoCor(situacao: string, theme: { gain: string; loss: string; textMuted: string }) {
  if (situacao === 'Aprovado') return theme.gain;
  if (situacao === 'Reprovado') return theme.loss;
  return theme.textMuted;
}

function StatusChip({ status }: { status: 'Completo' | 'Parcial' }) {
  const { theme } = useTheme();
  const completo = status === 'Completo';
  const warn = theme.tokens.warning500;

  return (
    <View
      style={[
        styles.statusChip,
        {
          borderColor: completo ? theme.gain : warn,
          backgroundColor: completo ? theme.gainMuted : 'rgba(245, 158, 11, 0.12)',
        },
      ]}
    >
      <Text style={[styles.statusChipText, { color: completo ? theme.gain : warn }]}>{status}</Text>
    </View>
  );
}


function ModalityBlock({
  label,
  nota,
  situacao,
  buscaLower,
  dispensavel = false,
}: {
  label: string;
  nota: string;
  situacao: string;
  buscaLower: string;
  dispensavel?: boolean;
}) {
  const { theme } = useTheme();
  const ui = getUiColors(theme);
  const glass = getAplicarTafGlass(theme);

  return (
    <View
      style={[
        styles.modalityBlock,
        {
          borderColor: dispensavel ? theme.loss : glass.border,
          backgroundColor: dispensavel ? 'rgba(220, 38, 38, 0.1)' : undefined,
        },
      ]}
    >
      <Text
        style={[styles.modalityKicker, { color: dispensavel ? theme.loss : theme.primary }]}
      >
        {label}
      </Text>
      <View style={[styles.modalityValues, dispensavel && styles.modalityValuesFaded]}>
        <View style={styles.modalityValueRow}>
          <Text style={[styles.modalityLabel, { color: theme.textMuted }]}>NOTA</Text>
          <SearchHighlightText
            text={nota}
            queryLower={buscaLower}
            style={[styles.modalityValue, { color: dispensavel ? theme.loss : ui.text }]}
            numberOfLines={1}
          />
        </View>
        <View style={styles.modalityValueRow}>
          <Text style={[styles.modalityLabel, { color: theme.textMuted }]}>SIT.</Text>
          <SearchHighlightText
            text={situacao}
            queryLower={buscaLower}
            style={[
              styles.modalityValue,
              { color: dispensavel ? theme.loss : situacaoCor(situacao, theme) },
            ]}
            numberOfLines={1}
          />
        </View>
      </View>
      {dispensavel ? (
        <View style={styles.dispensavelOverlay} pointerEvents="none">
          <View style={[styles.dispensavelStripe, { backgroundColor: theme.loss }]}>
            <Text style={styles.dispensavelText}>Dispensável</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

type Props = {
  data: ResultadoGeralItem[];
  buscaLower: string;
  onEditar?: (item: ResultadoGeralItem) => void;
  onExcluir?: (item: ResultadoGeralItem) => void;
  onVerHistorico?: (item: ResultadoGeralItem) => void;
};

export function ResultadosGeralTable({
  data,
  buscaLower,
  onEditar,
  onExcluir,
  onVerHistorico,
}: Props) {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const glass = getAplicarTafGlass(theme);

  return (
    <View style={styles.modernList}>
      {data.map((item) => (
        <View key={item.id} style={styles.itemPress}>
          <TafGlassPanel style={styles.modernRow}>
          <View style={styles.modernRowHeader}>
            <View style={styles.modernRowHeaderText}>
              <SearchHighlightText
                text={item.nome}
                queryLower={buscaLower}
                style={[styles.modernName, { color: ui.text }]}
                numberOfLines={2}
              />
              <View style={styles.modernChipRow}>
                <View style={[styles.modernChip, { borderColor: glass.border }]}>
                  <SearchHighlightText
                    text={item.postoGrad}
                    queryLower={buscaLower}
                    style={[styles.modernChipText, { color: ui.text }]}
                    numberOfLines={1}
                  />
                </View>
                <StatusChip status={item.statusTaf} />
              </View>
            </View>
            {(onVerHistorico || onEditar || onExcluir) ? (
              <View style={styles.modernActions}>
                {onVerHistorico ? (
                  <TouchableOpacity
                    accessibilityLabel={`Ver histórico de ${item.nome}`}
                    onPress={() => onVerHistorico(item)}
                    style={[styles.modernIconBtn, { borderColor: glass.border }]}
                  >
                    <History size={17} color={theme.primary} strokeWidth={2.5} />
                  </TouchableOpacity>
                ) : null}
                {onEditar ? (
                  <TouchableOpacity
                    accessibilityLabel={`Editar resultados de ${item.nome}`}
                    onPress={() => onEditar(item)}
                    style={[styles.modernIconBtn, { borderColor: glass.border }]}
                  >
                    <Pencil size={17} color={theme.primary} strokeWidth={2.5} />
                  </TouchableOpacity>
                ) : null}
                {onExcluir ? (
                  <TouchableOpacity
                    accessibilityLabel={`Excluir resultados de ${item.nome}`}
                    onPress={() => onExcluir(item)}
                    style={[styles.modernIconBtn, styles.modernIconBtnDanger]}
                  >
                    <Trash2 size={17} color={theme.loss} strokeWidth={2.5} />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={[styles.modernDivider, { backgroundColor: glass.border }]} />

          <View style={styles.modernMetaGrid}>
            <View style={styles.modernMetaItem}>
              <LabelNip color={theme.textMuted} fontSize={9} fontWeight="800" />
              <SearchHighlightText
                text={item.nip}
                queryLower={buscaLower}
                style={[styles.modernMetaValue, { color: ui.text }]}
                numberOfLines={1}
              />
            </View>
            <View style={styles.modernMetaItem}>
              <Text style={[styles.modernMetaLabel, { color: theme.textMuted }]}>STATUS TAF</Text>
              <Text style={[styles.modernMetaValue, { color: ui.text }]}>{item.statusTaf}</Text>
            </View>
          </View>

          <View style={[styles.modernDivider, styles.modernDividerLight, { backgroundColor: glass.border }]} />

          <View style={styles.modalityGrid}>
            <ModalityBlock
              label="CORRIDA"
              nota={item.notaCorrida}
              situacao={item.situacaoCorrida}
              buscaLower={buscaLower}
              dispensavel={modalidadeCorridaCaminhadaDispensavel(item, 'corrida')}
            />
            <ModalityBlock
              label="CAMINHADA"
              nota={item.notaCaminhada}
              situacao={item.situacaoCaminhada}
              buscaLower={buscaLower}
              dispensavel={modalidadeCorridaCaminhadaDispensavel(item, 'caminhada')}
            />
            <ModalityBlock
              label="NATAÇÃO"
              nota={item.notaNatacao}
              situacao={item.situacaoNatacao}
              buscaLower={buscaLower}
            />
            <ModalityBlock
              label="PERMANÊNCIA"
              nota={item.permanenciaTempo}
              situacao={item.situacaoPermanencia}
              buscaLower={buscaLower}
            />
          </View>
          </TafGlassPanel>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  modernList: {},
  itemPress: {
    marginBottom: 12,
  },
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
  statusChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusChipText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
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
  modernDividerLight: { marginVertical: 10 },
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
  modalityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalityBlock: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 140,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    padding: 10,
    gap: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  modalityValuesFaded: {
    opacity: 0.32,
  },
  dispensavelOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
  },
  dispensavelStripe: {
    transform: [{ rotate: '-14deg' }],
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 4,
    minWidth: '88%',
    alignItems: 'center',
  },
  dispensavelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  modalityKicker: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  modalityValues: { gap: 4 },
  modalityValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalityLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    width: 32,
  },
  modalityValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    minWidth: 0,
  },
});
