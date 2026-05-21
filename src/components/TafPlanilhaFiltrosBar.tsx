import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform, Modal } from 'react-native';
import { Search, Calendar, X } from 'lucide-react-native';
import { LabelSvgText } from './LabelSvgText';
import type { FiltroModalidadeTaf } from '../utils/tafRegistro';
import { dataBrParaIso, dataIsoParaBr } from '../utils/tafRegistro';

type Props = {
  filtroBusca: string;
  onFiltroBuscaChange: (text: string) => void;
  filtroModalidade: FiltroModalidadeTaf;
  onFiltroModalidadeChange: (m: FiltroModalidadeTaf) => void;
  /** DD/MM/AAAA ou vazio = todas as datas */
  filtroData: string;
  onFiltroDataChange: (dataBr: string) => void;
};

const MODALIDADES: { id: FiltroModalidadeTaf; label: string }[] = [
  { id: 'Todos', label: 'Todas' },
  { id: 'corrida', label: 'Corrida' },
  { id: 'natacao', label: 'Natação' },
  { id: 'permanencia', label: 'Permanência' },
];

export function TafPlanilhaFiltrosBar({
  filtroBusca,
  onFiltroBuscaChange,
  filtroModalidade,
  onFiltroModalidadeChange,
  filtroData,
  onFiltroDataChange,
}: Props) {
  const [calendarioAberto, setCalendarioAberto] = useState(false);

  const isoData = useMemo(() => dataBrParaIso(filtroData) ?? '', [filtroData]);

  const onChangeIsoWeb = (iso: string) => {
    if (!iso) {
      onFiltroDataChange('');
      return;
    }
    onFiltroDataChange(dataIsoParaBr(iso));
  };

  const onChangeDataTexto = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    const dd = digits.slice(0, 2);
    const mm = digits.slice(2, 4);
    const yyyy = digits.slice(4, 8);
    if (digits.length <= 2) onFiltroDataChange(dd);
    else if (digits.length <= 4) onFiltroDataChange(`${dd}/${mm}`);
    else onFiltroDataChange(`${dd}/${mm}/${yyyy}`);
  };

  return (
    <View style={styles.root}>
      <View style={styles.searchRow}>
        <Search size={18} color="rgba(17,24,39,0.45)" strokeWidth={2.5} />
        <TextInput
          value={filtroBusca}
          onChangeText={onFiltroBuscaChange}
          placeholder="Buscar (mín. 3 caracteres)..."
          placeholderTextColor="rgba(17,24,39,0.35)"
          style={styles.searchInput}
          autoCorrect={false}
          spellCheck={false}
          autoCapitalize="none"
          accessibilityLabel="Buscar na planilha"
        />
      </View>

      <View style={styles.filterBlock}>
        <LabelSvgText text="Modalidade" color="#374151" fontSize={12} fontWeight={800} width={100} height={18} />
        <View style={styles.chipsRow}>
          {MODALIDADES.map((opt) => {
            const active = filtroModalidade === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                activeOpacity={0.85}
                onPress={() => onFiltroModalidadeChange(opt.id)}
                style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
              >
                <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.filterBlock}>
        <LabelSvgText text="Data" color="#374151" fontSize={12} fontWeight={800} width={56} height={18} />
        <View style={styles.dataRow}>
          <TouchableOpacity
            accessibilityLabel="Todas as datas"
            activeOpacity={0.85}
            onPress={() => onFiltroDataChange('')}
            style={[styles.chip, !filtroData ? styles.chipActive : styles.chipIdle]}
          >
            <Text style={[styles.chipText, !filtroData ? styles.chipTextActive : null]}>Todas</Text>
          </TouchableOpacity>

          {Platform.OS === 'web' ? (
            <View style={styles.dateWebWrap}>
              <Calendar size={16} color="rgba(17,24,39,0.5)" strokeWidth={2.5} />
              {/* @ts-expect-error input HTML no web */}
              <input
                type="date"
                value={isoData}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChangeIsoWeb(e.target.value)}
                style={{
                  border: '1px solid rgba(17,24,39,0.12)',
                  borderRadius: 10,
                  padding: '8px 10px',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#111827',
                  backgroundColor: 'rgba(255,255,255,0.85)',
                  flex: 1,
                  minWidth: 140,
                }}
              />
            </View>
          ) : (
            <>
              <TouchableOpacity
                accessibilityLabel="Abrir calendário"
                activeOpacity={0.85}
                onPress={() => setCalendarioAberto(true)}
                style={styles.dateBtn}
              >
                <Calendar size={18} color="#111827" strokeWidth={2.5} />
                <Text style={styles.dateBtnText}>{filtroData || 'Escolher data'}</Text>
              </TouchableOpacity>
              {filtroData ? (
                <TouchableOpacity
                  accessibilityLabel="Limpar data"
                  onPress={() => onFiltroDataChange('')}
                  style={styles.clearDateBtn}
                >
                  <X size={16} color="#6B7280" strokeWidth={2.5} />
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </View>

      {Platform.OS !== 'web' ? (
        <Modal visible={calendarioAberto} transparent animationType="fade" onRequestClose={() => setCalendarioAberto(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Data do registro</Text>
              <TextInput
                value={filtroData}
                onChangeText={onChangeDataTexto}
                placeholder="DD/MM/AAAA"
                placeholderTextColor="rgba(17,24,39,0.35)"
                keyboardType="number-pad"
                style={styles.modalDateInput}
                maxLength={10}
              />
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.modalBtnSec} onPress={() => setCalendarioAberto(false)}>
                  <Text style={styles.modalBtnSecText}>Fechar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalBtnPri}
                  onPress={() => setCalendarioAberto(false)}
                >
                  <Text style={styles.modalBtnPriText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12, marginBottom: 12 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.12)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.70)',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    paddingVertical: 8,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  filterBlock: { gap: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  chipIdle: {
    borderColor: 'rgba(17,24,39,0.1)',
    backgroundColor: 'rgba(17,24,39,0.04)',
  },
  chipActive: {
    borderColor: '#111827',
    backgroundColor: '#111827',
  },
  chipText: { fontSize: 12, fontWeight: '800', color: '#374151' },
  chipTextActive: { color: '#FFFFFF' },
  dataRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  dateWebWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 180,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.12)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  dateBtnText: { fontSize: 13, fontWeight: '700', color: '#111827' },
  clearDateBtn: { padding: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  modalDateInput: {
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.12)',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    fontWeight: '700',
  },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  modalBtnSec: { paddingVertical: 10, paddingHorizontal: 14 },
  modalBtnSecText: { fontWeight: '700', color: '#6B7280' },
  modalBtnPri: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  modalBtnPriText: { color: '#FFF', fontWeight: '800' },
});
