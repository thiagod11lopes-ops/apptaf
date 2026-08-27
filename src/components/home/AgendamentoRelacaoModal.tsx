import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { FileText, Search, Trash2, Users } from 'lucide-react-native';
import { ModernModal } from '../sismav/ModernModal';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import { PREMIUM } from '../../theme/premium';
import {
  MODALIDADE_AGENDAMENTO_LABELS,
  tipoTafDaModalidade,
  TIPO_TAF_AGENDAMENTO_LABELS,
  type SlotAgendamento,
} from '../../services/agendamentoStorage';
import {
  deleteReserva,
  getReservasBySlot,
  isTransporteInstitucional,
  labelTransporteAgendamento,
  syncReservasFromSupabase,
  type ReservaAgendamento,
} from '../../services/reservasAgendamentoStorage';
import { exportAgendamentoSlotPdf } from '../../utils/exportAgendamentoSlotPdf';
import { SalvamentoCanceladoError } from '../../utils/salvarArquivoNaPasta';
import { compararAntiguidadeMilitar } from '../../utils/ordemAntiguidadeMilitar';
import { formatNipInput, nipDigitos } from '../../utils/nipFormat';
import { nomeBareSemPosto } from '../../utils/formatNomeComPosto';
import { ConfirmacaoExcluirReservaAgendamentoModal } from './ConfirmacaoExcluirReservaAgendamentoModal';

type Props = {
  visible: boolean;
  slot: SlotAgendamento | null;
  onClose: () => void;
  /** Chamado após exclusão para atualizar contagens na lista de vagas. */
  onReservasAlteradas?: () => void;
};

function postoDaReserva(r: ReservaAgendamento): string {
  const direto = (r.posto || r.oficial || r.praca || '').trim();
  if (direto) return direto.toUpperCase();
  const parts = String(r.nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    const first = (parts[0] || '').toUpperCase();
    if (/[0-9°º]/.test(first) || first.length <= 6) return first;
  }
  return '—';
}

function nomeDaReserva(r: ReservaAgendamento): string {
  return nomeBareSemPosto(r.nome || '').trim() || (r.nome || '—').trim();
}

function nipFormatado(r: ReservaAgendamento): string {
  const digits = nipDigitos(r.nip);
  return digits ? formatNipInput(digits) : r.nip || '—';
}

export function AgendamentoRelacaoModal({
  visible,
  slot,
  onClose,
  onReservasAlteradas,
}: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);

  const [reservas, setReservas] = useState<ReservaAgendamento[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [reservaParaExcluir, setReservaParaExcluir] = useState<ReservaAgendamento | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const carregar = useCallback(async (slotId: string) => {
    setCarregando(true);
    setErro(null);
    try {
      await syncReservasFromSupabase(slotId);
      const lista = await getReservasBySlot(slotId);
      const ordenada = [...lista].sort((a, b) =>
        compararAntiguidadeMilitar(
          { posto: postoDaReserva(a), updatedAt: a.updatedAt },
          { posto: postoDaReserva(b), updatedAt: b.updatedAt },
        ),
      );
      setReservas(ordenada);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar os agendados.');
      setReservas([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!visible || !slot) {
      setReservas([]);
      setBusca('');
      setErro(null);
      setSucesso(null);
      setReservaParaExcluir(null);
      return;
    }
    void carregar(slot.id);
  }, [visible, slot, carregar]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qDigits = nipDigitos(busca);
    if (!q) return reservas;
    return reservas.filter((r) => {
      const nome = nomeDaReserva(r).toLowerCase();
      const nip = nipDigitos(r.nip);
      const posto = postoDaReserva(r).toLowerCase();
      if (nome.includes(q) || posto.includes(q)) return true;
      if (qDigits && nip.includes(qDigits)) return true;
      return false;
    });
  }, [reservas, busca]);

  const gerarPdf = useCallback(async () => {
    if (!slot) return;
    setGerandoPdf(true);
    setErro(null);
    setSucesso(null);
    try {
      await syncReservasFromSupabase(slot.id);
      const lista = await getReservasBySlot(slot.id);
      const msg = await exportAgendamentoSlotPdf(slot, lista);
      setSucesso(msg);
    } catch (e) {
      if (e instanceof SalvamentoCanceladoError) {
        setSucesso(null);
      } else {
        setErro(e instanceof Error ? e.message : 'Não foi possível gerar o PDF.');
      }
    } finally {
      setGerandoPdf(false);
    }
  }, [slot]);

  const confirmarExclusaoReserva = useCallback(async () => {
    if (!reservaParaExcluir || !slot) return;
    setExcluindoId(reservaParaExcluir.id);
    setErro(null);
    try {
      await deleteReserva(reservaParaExcluir.id);
      setReservaParaExcluir(null);
      setSucesso('Agendamento excluído.');
      await carregar(slot.id);
      onReservasAlteradas?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível excluir o agendamento.');
    } finally {
      setExcluindoId(null);
    }
  }, [reservaParaExcluir, slot, carregar, onReservasAlteradas]);

  const titulo = slot
    ? `${MODALIDADE_AGENDAMENTO_LABELS[slot.modalidade]} · ${slot.data}`
    : 'Relação de agendados';

  const qtdTransporteInstitucional = useMemo(
    () => reservas.filter((r) => isTransporteInstitucional(r.transporte)).length,
    [reservas],
  );

  return (
    <>
      <ModernModal
        visible={visible && !!slot}
        onClose={onClose}
        title="Relação de agendados"
        icon={<Users size={22} color={theme.primary} strokeWidth={2.2} />}
        fullScreen
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[ts.label, { color: theme.primary, marginBottom: 4 }]}>{titulo}</Text>
          <Text style={[ts.caption, { color: theme.textMuted, marginBottom: 14 }]}>
            {slot
              ? `${TIPO_TAF_AGENDAMENTO_LABELS[tipoTafDaModalidade(slot.modalidade)]} · ${reservas.length} agendado${reservas.length !== 1 ? 's' : ''} · máx. ${slot.maxParticipantes} · transporte institucional: ${qtdTransporteInstitucional}`
              : ''}
          </Text>

          <View
            style={[
              styles.buscaWrap,
              { backgroundColor: theme.cardBg, borderColor: ui.inputBorder },
            ]}
          >
            <Search size={16} color={theme.textMuted} strokeWidth={2.2} />
            <TextInput
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar por NIP ou nome"
              placeholderTextColor={theme.textMuted}
              style={[styles.buscaInput, { color: ui.text }]}
              accessibilityLabel="Buscar por NIP ou nome"
            />
          </View>

          <TouchableOpacity
            onPress={() => void gerarPdf()}
            disabled={gerandoPdf || carregando}
            style={[
              styles.btnPdf,
              {
                backgroundColor: gerandoPdf || carregando ? theme.textMuted : theme.primary,
              },
            ]}
            accessibilityLabel="Gerar PDF"
          >
            {gerandoPdf ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <FileText size={16} color="#fff" strokeWidth={2.4} />
            )}
            <Text style={styles.btnPdfText}>
              {gerandoPdf ? 'Gerando PDF...' : 'Gerar PDF'}
            </Text>
          </TouchableOpacity>

          {erro ? (
            <Text style={[ts.caption, { color: theme.error, marginBottom: 8 }]}>{erro}</Text>
          ) : null}
          {sucesso ? (
            <Text style={[ts.caption, { color: theme.success, marginBottom: 8 }]}>{sucesso}</Text>
          ) : null}

          {carregando ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={theme.primary} />
              <Text style={[ts.caption, { color: theme.textMuted, marginTop: 8 }]}>
                Carregando agendados...
              </Text>
            </View>
          ) : filtradas.length === 0 ? (
            <Text
              style={[
                ts.bodySecondary,
                { color: theme.textMuted, textAlign: 'center', marginTop: 24 },
              ]}
            >
              {reservas.length === 0
                ? 'Nenhum militar agendado nesta prova.'
                : 'Nenhum resultado para a busca.'}
            </Text>
          ) : (
            filtradas.map((r) => {
              const posto = postoDaReserva(r);
              const nome = nomeDaReserva(r);
              const nip = nipFormatado(r);
              const isExcluindo = excluindoId === r.id;
              const ordem = reservas.findIndex((x) => x.id === r.id) + 1;
              return (
                <View
                  key={r.id}
                  style={[
                    styles.row,
                    {
                      backgroundColor: theme.isDark
                        ? 'rgba(255,255,255,0.04)'
                        : 'rgba(0,0,0,0.03)',
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.ord, { color: theme.textMuted }]}>{ordem || '—'}</Text>
                  <View style={styles.rowInfo}>
                    <Text style={[ts.body, { color: ui.text, fontWeight: '700' }]} numberOfLines={2}>
                      {posto} {nome}
                    </Text>
                    <Text style={[ts.caption, { color: theme.textMuted }]}>
                      NIP {nip} · {labelTransporteAgendamento(r.transporte)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setSucesso(null);
                      setReservaParaExcluir(r);
                    }}
                    disabled={isExcluindo}
                    style={[
                      styles.acaoExcluir,
                      { borderColor: theme.loss, backgroundColor: theme.lossMuted },
                    ]}
                    accessibilityLabel={`Excluir agendamento de ${nome}`}
                  >
                    {isExcluindo ? (
                      <ActivityIndicator color={theme.loss} size="small" />
                    ) : (
                      <Trash2 size={16} color={theme.loss} strokeWidth={2.3} />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </ModernModal>

      <ConfirmacaoExcluirReservaAgendamentoModal
        reserva={reservaParaExcluir}
        loading={!!excluindoId && excluindoId === reservaParaExcluir?.id}
        onClose={() => {
          if (!excluindoId) setReservaParaExcluir(null);
        }}
        onConfirm={() => void confirmarExclusaoReserva()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 2, paddingTop: 4 },
  buscaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  buscaInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  btnPdf: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: PREMIUM.radiusMd,
    marginBottom: 14,
  },
  btnPdfText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
    gap: 10,
  },
  ord: {
    width: 28,
    textAlign: 'center',
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  acaoExcluir: {
    width: PREMIUM.minTouch,
    height: PREMIUM.minTouch,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
