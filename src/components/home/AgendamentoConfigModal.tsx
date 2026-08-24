import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Platform,
} from 'react-native';
import { CalendarDays, ChevronDown, ExternalLink, Pencil, Plus, Trash2, X } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import { PREMIUM } from '../../theme/premium';
import { ModernModal } from '../sismav/ModernModal';
import {
  deleteSlot,
  getAllSlots,
  MODALIDADE_AGENDAMENTO_LABELS,
  MODALIDADES_POR_TIPO_TAF,
  pushAllSlotsToSupabase,
  saveSlot,
  tipoTafDaModalidade,
  TIPO_TAF_AGENDAMENTO_LABELS,
  type ModalidadeAgendamento,
  type SlotAgendamento,
  type TipoTafAgendamento,
} from '../../services/agendamentoStorage';
import { syncMilitarLookupComCadastros } from '../../services/agendamentoMilitarLookup';
import { contarReservasPorSlot } from '../../services/reservasAgendamentoStorage';
import { dataBrParaIso } from '../../utils/tafRegistro';

/** Página HTML standalone (não é a tela interna do app). */
const URL_AGENDAMENTO = 'https://thiagod11lopes-ops.github.io/apptaf/agendamento.html';

function formatDataInput(raw: string): string {
  const digitos = raw.replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function AgendamentoConfigModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);

  const [slots, setSlots] = useState<SlotAgendamento[]>([]);
  const [reservadosPorSlot, setReservadosPorSlot] = useState<Record<string, number>>({});
  const [editandoId, setEditandoId] = useState<string | null>(null);

  // Formulário
  const [data, setData] = useState('');
  const [tipoTaf, setTipoTaf] = useState<TipoTafAgendamento>('armada');
  const [modalidade, setModalidade] = useState<ModalidadeAgendamento>('corrida');
  const [modalidadeSelectAberto, setModalidadeSelectAberto] = useState(false);
  const [maxStr, setMaxStr] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  const modalidadesDoTipo = useMemo(
    () => MODALIDADES_POR_TIPO_TAF[tipoTaf],
    [tipoTaf],
  );

  const recarregar = useCallback(async () => {
    try {
      const lista = await getAllSlots();
      setSlots(lista);
      try {
        const contagem = await contarReservasPorSlot();
        setReservadosPorSlot(contagem);
      } catch {
        setReservadosPorSlot({});
      }
      try {
        const nSlots = await pushAllSlotsToSupabase();
        const { importados, publicados } = await syncMilitarLookupComCadastros();
        const partes: string[] = [];
        if (nSlots > 0) partes.push(`${nSlots} disponibilidade(s)`);
        if (importados > 0) partes.push(`${importados} militar(es) importado(s) ao cadastro`);
        if (publicados > 0) partes.push(`${publicados} militar(es) na busca pública`);
        if (partes.length > 0) {
          setSucesso(`${partes.join(' · ')}.`);
          setErro(null);
        }
      } catch (e) {
        setErro(
          e instanceof Error
            ? e.message
            : 'Não foi possível publicar na página pública. Confira o login e tente novamente.',
        );
      }
    } catch {
      setSlots([]);
      setReservadosPorSlot({});
    }
  }, []);

  useEffect(() => {
    if (visible) void recarregar();
  }, [visible, recarregar]);

  const limparFormulario = useCallback(() => {
    setData('');
    setTipoTaf('armada');
    setModalidade('corrida');
    setModalidadeSelectAberto(false);
    setMaxStr('');
    setErro(null);
    setSucesso(null);
    setEditandoId(null);
  }, []);

  const selecionarTipoTaf = useCallback((tipo: TipoTafAgendamento) => {
    setTipoTaf(tipo);
    const lista = MODALIDADES_POR_TIPO_TAF[tipo];
    setModalidade(lista[0]!);
    setModalidadeSelectAberto(false);
    setErro(null);
    setSucesso(null);
  }, []);

  const abrirEdicao = useCallback((slot: SlotAgendamento) => {
    setEditandoId(slot.id);
    setData(slot.data);
    const tipo = tipoTafDaModalidade(slot.modalidade);
    setTipoTaf(tipo);
    setModalidade(slot.modalidade);
    setModalidadeSelectAberto(false);
    setMaxStr(String(slot.maxParticipantes));
    setErro(null);
    setSucesso(null);
  }, []);

  const salvar = useCallback(async () => {
    const max = parseInt(maxStr.replace(/\D/g, ''), 10);
    if (!dataBrParaIso(data)) {
      setErro('Informe a data no formato DD/MM/AAAA.');
      return;
    }
    if (!Number.isFinite(max) || max < 1) {
      setErro('Informe o número máximo de participantes (mínimo 1).');
      return;
    }
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      await saveSlot({
        id: editandoId ?? undefined,
        data: data.trim(),
        modalidade,
        maxParticipantes: max,
      });
      setSucesso(editandoId ? 'Disponibilidade atualizada.' : 'Disponibilidade adicionada.');
      limparFormulario();
      await recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }, [data, modalidade, maxStr, editandoId, limparFormulario, recarregar]);

  const excluir = useCallback(
    async (id: string) => {
      setExcluindo(id);
      try {
        await deleteSlot(id);
        if (editandoId === id) limparFormulario();
        setSucesso('Disponibilidade removida.');
        await recarregar();
      } catch {
        setErro('Não foi possível remover.');
      } finally {
        setExcluindo(null);
      }
    },
    [editandoId, limparFormulario, recarregar],
  );

  // Agrupa slots por data
  const slotsPorData = useMemo(() => {
    const map: Record<string, SlotAgendamento[]> = {};
    for (const s of slots) {
      if (!map[s.data]) map[s.data] = [];
      map[s.data]!.push(s);
    }
    return map;
  }, [slots]);

  const datas = useMemo(
    () =>
      Object.keys(slotsPorData).sort((a, b) => {
        const ia = dataBrParaIso(a) ?? '';
        const ib = dataBrParaIso(b) ?? '';
        return ia.localeCompare(ib);
      }),
    [slotsPorData],
  );

  const abrirPaginaAgendamento = useCallback(() => {
    void Linking.openURL(`${URL_AGENDAMENTO}?v=${Date.now()}`);
  }, []);

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.cardBg,
      borderColor: ui.inputBorder,
      color: ui.text,
    },
  ];

  return (
    <ModernModal
      visible={visible}
      onClose={onClose}
      title="Disponibilidade de Vagas"
      icon={<CalendarDays size={22} color={theme.primary} strokeWidth={2.2} />}
      fullScreen
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Botão para abrir a página de agendamento */}
        <TouchableOpacity
          onPress={abrirPaginaAgendamento}
          style={[
            styles.urlCard,
            {
              backgroundColor: theme.isDark ? 'rgba(99,179,237,0.12)' : 'rgba(49,130,206,0.08)',
              borderColor: theme.isDark ? 'rgba(99,179,237,0.3)' : 'rgba(49,130,206,0.25)',
            },
          ]}
          accessibilityLabel="Abrir página de agendamento"
        >
          <ExternalLink size={16} color={theme.primary} strokeWidth={2.2} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={[ts.caption, { color: theme.primary, fontWeight: '700' }]}>
              Abrir página de agendamento
            </Text>
            <Text style={[ts.caption, { color: theme.textMuted, fontSize: 10 }]} numberOfLines={1}>
              {URL_AGENDAMENTO}
            </Text>
          </View>
        </TouchableOpacity>

        {/* ── Formulário ── */}
        <View
          style={[
            styles.formCard,
            { backgroundColor: theme.cardBg, borderColor: theme.border },
          ]}
        >
          <Text style={[ts.label, { color: theme.primary, marginBottom: 12 }]}>
            {editandoId ? 'Editar disponibilidade' : 'Adicionar disponibilidade'}
          </Text>

          {/* Data */}
          <Text style={[ts.caption, styles.fieldLabel, { color: ui.label }]}>Data</Text>
          <TextInput
            value={data}
            onChangeText={(t) => { setData(formatDataInput(t)); setErro(null); setSucesso(null); }}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={theme.textMuted}
            keyboardType="number-pad"
            style={[inputStyle, { marginBottom: 12 }]}
            accessibilityLabel="Data da disponibilidade"
          />

          {/* Tipo de TAF */}
          <Text style={[ts.caption, styles.fieldLabel, { color: ui.label }]}>Tipo de TAF</Text>
          <View style={styles.tipoTafRow}>
            {(['armada', 'cfn'] as const).map((tipo) => {
              const ativo = tipoTaf === tipo;
              return (
                <TouchableOpacity
                  key={tipo}
                  onPress={() => selecionarTipoTaf(tipo)}
                  style={[
                    styles.tipoTafBtn,
                    {
                      backgroundColor: ativo
                        ? theme.primary
                        : theme.isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.05)',
                      borderColor: ativo ? theme.primary : theme.border,
                    },
                  ]}
                  accessibilityLabel={TIPO_TAF_AGENDAMENTO_LABELS[tipo]}
                  accessibilityState={{ selected: ativo }}
                >
                  <Text
                    style={[
                      ts.caption,
                      {
                        color: ativo ? '#fff' : ui.text,
                        fontWeight: ativo ? '700' : '600',
                        textAlign: 'center',
                      },
                    ]}
                  >
                    {TIPO_TAF_AGENDAMENTO_LABELS[tipo]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Modalidade (select filtrado pelo tipo) */}
          <Text style={[ts.caption, styles.fieldLabel, { color: ui.label }]}>Modalidade</Text>
          {Platform.OS === 'web' ? (
            // @ts-expect-error select nativo web
            <select
              value={modalidade}
              onChange={(ev: { target: { value: string } }) => {
                setModalidade(ev.target.value as ModalidadeAgendamento);
                setErro(null);
                setSucesso(null);
              }}
              style={{
                width: '100%',
                height: 44,
                borderRadius: PREMIUM.radiusMd,
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: ui.inputBorder,
                backgroundColor: theme.cardBg,
                color: ui.text,
                paddingLeft: 12,
                paddingRight: 12,
                fontSize: 14,
                marginBottom: 12,
              }}
              aria-label="Modalidade"
            >
              {modalidadesDoTipo.map((m) => (
                <option key={m} value={m}>
                  {MODALIDADE_AGENDAMENTO_LABELS[m]}
                </option>
              ))}
            </select>
          ) : (
            <View style={{ marginBottom: 12 }}>
              <TouchableOpacity
                onPress={() => setModalidadeSelectAberto((v) => !v)}
                style={[
                  styles.selectTrigger,
                  {
                    backgroundColor: theme.cardBg,
                    borderColor: ui.inputBorder,
                  },
                ]}
                accessibilityLabel="Selecionar modalidade"
              >
                <Text style={[ts.body, { color: ui.text, flex: 1 }]}>
                  {MODALIDADE_AGENDAMENTO_LABELS[modalidade]}
                </Text>
                <ChevronDown size={18} color={theme.textMuted} strokeWidth={2.2} />
              </TouchableOpacity>
              {modalidadeSelectAberto ? (
                <View
                  style={[
                    styles.selectList,
                    { backgroundColor: theme.cardBg, borderColor: theme.border },
                  ]}
                >
                  {modalidadesDoTipo.map((m) => {
                    const ativo = modalidade === m;
                    return (
                      <TouchableOpacity
                        key={m}
                        onPress={() => {
                          setModalidade(m);
                          setModalidadeSelectAberto(false);
                          setErro(null);
                          setSucesso(null);
                        }}
                        style={[
                          styles.selectOption,
                          ativo
                            ? {
                                backgroundColor: theme.isDark
                                  ? 'rgba(99,179,237,0.15)'
                                  : 'rgba(49,130,206,0.08)',
                              }
                            : null,
                        ]}
                        accessibilityLabel={MODALIDADE_AGENDAMENTO_LABELS[m]}
                      >
                        <Text
                          style={[
                            ts.body,
                            { color: ui.text, fontWeight: ativo ? '700' : '500' },
                          ]}
                        >
                          {MODALIDADE_AGENDAMENTO_LABELS[m]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </View>
          )}

          {/* Máximo de participantes */}
          <Text style={[ts.caption, styles.fieldLabel, { color: ui.label, marginTop: 12 }]}>
            Máximo de participantes
          </Text>
          <TextInput
            value={maxStr}
            onChangeText={(t) => { setMaxStr(t.replace(/\D/g, '')); setErro(null); setSucesso(null); }}
            placeholder="Ex.: 30"
            placeholderTextColor={theme.textMuted}
            keyboardType="number-pad"
            style={[inputStyle, { marginBottom: 12 }]}
            accessibilityLabel="Máximo de participantes"
          />

          {erro ? (
            <Text style={[ts.caption, { color: theme.error, marginBottom: 8 }]}>{erro}</Text>
          ) : null}
          {sucesso ? (
            <Text style={[ts.caption, { color: theme.success, marginBottom: 8 }]}>{sucesso}</Text>
          ) : null}

          <View style={styles.formBtns}>
            <TouchableOpacity
              onPress={() => void salvar()}
              disabled={salvando}
              style={[
                styles.btnPrimary,
                { backgroundColor: salvando ? theme.textMuted : theme.primary },
              ]}
              accessibilityLabel={editandoId ? 'Atualizar disponibilidade' : 'Adicionar disponibilidade'}
            >
              <Plus size={16} color="#fff" strokeWidth={2.5} />
              <Text style={[ts.caption, { color: '#fff', fontWeight: '700', marginLeft: 6 }]}>
                {editandoId ? 'Atualizar' : 'Adicionar'}
              </Text>
            </TouchableOpacity>

            {editandoId ? (
              <TouchableOpacity
                onPress={limparFormulario}
                style={[styles.btnOutline, { borderColor: theme.border }]}
                accessibilityLabel="Cancelar edição"
              >
                <X size={15} color={ui.text} strokeWidth={2.2} />
                <Text style={[ts.caption, { color: ui.text, marginLeft: 5 }]}>Cancelar</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* ── Lista de slots ── */}
        {datas.length === 0 ? (
          <Text style={[ts.bodySecondary, { color: theme.textMuted, textAlign: 'center', marginTop: 24 }]}>
            Nenhuma disponibilidade configurada.{'\n'}Use o formulário acima para adicionar.
          </Text>
        ) : (
          datas.map((d) => (
            <View key={d} style={styles.dataGroup}>
              <View style={[styles.dataHeader, { borderColor: theme.border }]}>
                <CalendarDays size={15} color={theme.primary} strokeWidth={2.2} />
                <Text style={[ts.label, { color: theme.primary, marginLeft: 6 }]}>{d}</Text>
              </View>

              {(slotsPorData[d] ?? []).map((slot) => {
                const isEditing = editandoId === slot.id;
                const isExcluindo = excluindo === slot.id;
                return (
                  <View
                    key={slot.id}
                    style={[
                      styles.slotRow,
                      {
                        backgroundColor: isEditing
                          ? theme.isDark
                            ? 'rgba(99,179,237,0.12)'
                            : 'rgba(49,130,206,0.06)'
                          : theme.isDark
                            ? 'rgba(255,255,255,0.04)'
                            : 'rgba(0,0,0,0.03)',
                        borderColor: isEditing ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <View style={styles.slotInfo}>
                      <Text style={[ts.body, { color: ui.text, fontWeight: '600' }]}>
                        {MODALIDADE_AGENDAMENTO_LABELS[slot.modalidade]}
                      </Text>
                      <Text style={[ts.caption, { color: theme.textMuted }]}>
                        {TIPO_TAF_AGENDAMENTO_LABELS[tipoTafDaModalidade(slot.modalidade)]}
                        {' · '}Máx.: {slot.maxParticipantes} participante
                        {slot.maxParticipantes !== 1 ? 's' : ''}
                        {' · '}Agendados: {reservadosPorSlot[slot.id] ?? 0}
                      </Text>
                    </View>
                    <View style={styles.slotAcoes}>
                      <TouchableOpacity
                        onPress={() => abrirEdicao(slot)}
                        style={[
                          styles.acaoBtn,
                          { borderColor: theme.primary, backgroundColor: theme.accentMuted },
                        ]}
                        accessibilityLabel={`Editar ${MODALIDADE_AGENDAMENTO_LABELS[slot.modalidade]}`}
                      >
                        <Pencil size={16} color={theme.primary} strokeWidth={2.3} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => void excluir(slot.id)}
                        disabled={isExcluindo}
                        style={[
                          styles.acaoBtn,
                          { borderColor: theme.loss, backgroundColor: theme.lossMuted },
                        ]}
                        accessibilityLabel={`Excluir ${MODALIDADE_AGENDAMENTO_LABELS[slot.modalidade]}`}
                      >
                        <Trash2
                          size={16}
                          color={isExcluindo ? theme.textMuted : theme.loss}
                          strokeWidth={2.3}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 2, paddingTop: 4 },
  urlCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusLg,
    padding: 16,
    marginBottom: 20,
  },
  fieldLabel: {
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  tipoTafRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tipoTafBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectTrigger: {
    height: 44,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectList: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    overflow: 'hidden',
  },
  selectOption: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  formBtns: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dataGroup: {
    marginBottom: 16,
  },
  dataHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 8,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    padding: 10,
    marginBottom: 6,
  },
  slotInfo: {
    flex: 1,
    gap: 2,
  },
  slotAcoes: {
    flexDirection: 'row',
    gap: 6,
  },
  acaoBtn: {
    width: PREMIUM.minTouch,
    height: PREMIUM.minTouch,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
