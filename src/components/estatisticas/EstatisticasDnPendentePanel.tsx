import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { CalendarDays, CalendarCheck, Search, X } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuthDataReload } from '../../hooks/useAuthDataReload';
import { getUiColors } from '../../theme/uiColors';
import {
  addCadastro,
  getAllCadastros,
  type CadastroItemPersist,
} from '../../services/cadastrosIndexedDb';
import { dataNascimentoCadastroValida } from '../../utils/cadastroDadosTaf';
import { buscarCadastroPorNomeOuNip } from '../../utils/buscarCadastroPorNomeOuNip';
import { formatNipInput, nipDigitos } from '../../utils/nipFormat';
import { idadeFromDataNascimento } from '../../utils/idadeFromDataNascimento';
import { AppModal } from '../premium/AppModal';
import { PressableScale } from '../premium/PressableScale';
import { TafGlassPanel } from '../mobile/TafTabChrome';
import { LabelNip } from '../LabelNip';
import { PREMIUM } from '../../theme/premium';

type ModoModal = 'pendente' | 'ok';

function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function postoGrad(c: CadastroItemPersist): string {
  if (c.categoria === 'Oficiais') return (c.oficial || '').trim() || '—';
  return (c.praca || '').trim() || '—';
}

export function EstatisticasDnPendentePanel() {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const [cadastros, setCadastros] = useState<CadastroItemPersist[]>([]);
  const [loading, setLoading] = useState(true);
  const [modo, setModo] = useState<ModoModal | null>(null);
  const [nip, setNip] = useState('');
  const [encontrado, setEncontrado] = useState<CadastroItemPersist | null>(null);
  const [dataNascimento, setDataNascimento] = useState('');
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setCadastros(await getAllCadastros());
    } finally {
      setLoading(false);
    }
  }, []);

  useAuthDataReload(carregar);

  const { qtdPendente, qtdOk } = useMemo(() => {
    let pendente = 0;
    let ok = 0;
    for (const c of cadastros) {
      if (dataNascimentoCadastroValida(c.dataNascimento)) ok += 1;
      else pendente += 1;
    }
    return { qtdPendente: pendente, qtdOk: ok };
  }, [cadastros]);

  const fecharModal = useCallback(() => {
    if (salvando) return;
    setModo(null);
    setNip('');
    setEncontrado(null);
    setDataNascimento('');
    setAviso('');
    setErro('');
    setSucesso('');
  }, [salvando]);

  const abrirModal = useCallback((m: ModoModal) => {
    setModo(m);
    setNip('');
    setEncontrado(null);
    setDataNascimento('');
    setAviso('');
    setErro('');
    setSucesso('');
  }, []);

  const buscarPorNip = useCallback(() => {
    setErro('');
    setSucesso('');
    setAviso('');
    const nipFmt = formatNipInput(nip);
    if (nipDigitos(nipFmt).length < 8) {
      setEncontrado(null);
      setErro('Informe um NIP válido.');
      return;
    }
    const busca = buscarCadastroPorNomeOuNip(cadastros, nipFmt);
    if (busca.kind !== 'found') {
      setEncontrado(null);
      setErro('Militar não encontrado no cadastro.');
      return;
    }
    const c = busca.cadastro;
    const temDn = dataNascimentoCadastroValida(c.dataNascimento);
    if (modo === 'pendente' && temDn) {
      setEncontrado(null);
      setAviso('Este cadastro já possui data de nascimento. Use o card DN OK para editar.');
      return;
    }
    if (modo === 'ok' && !temDn) {
      setEncontrado(null);
      setAviso('Este cadastro está sem data de nascimento. Use o card DN Pendente.');
      return;
    }
    setEncontrado(c);
    setNip(c.nip || nipFmt);
    setDataNascimento(temDn ? c.dataNascimento.trim() : '');
  }, [nip, cadastros, modo]);

  const salvar = useCallback(async () => {
    if (!encontrado || !modo) return;
    const data = dataNascimento.trim();
    if (!dataNascimentoCadastroValida(data)) {
      setErro('Informe a data no formato DD/MM/AAAA.');
      return;
    }
    setSalvando(true);
    setErro('');
    setSucesso('');
    try {
      const atualizado: CadastroItemPersist = {
        ...encontrado,
        dataNascimento: data,
      };
      await addCadastro(atualizado);
      setCadastros((prev) => prev.map((c) => (c.id === atualizado.id ? atualizado : c)));
      setEncontrado(atualizado);
      setSucesso(
        modo === 'pendente'
          ? 'Data de nascimento adicionada com sucesso.'
          : 'Data de nascimento atualizada com sucesso.',
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  }, [encontrado, dataNascimento, modo]);

  useEffect(() => {
    if (!sucesso) return;
    const t = setTimeout(() => setSucesso(''), 2500);
    return () => clearTimeout(t);
  }, [sucesso]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const idadePreview = idadeFromDataNascimento(dataNascimento);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.lead, { color: theme.textSecondary }]}>
        Acompanhe cadastros sem data de nascimento e complete ou edite pelo NIP.
      </Text>

      <View style={styles.cardsRow}>
        <PressableScale
          onPress={() => abrirModal('pendente')}
          style={styles.cardPress}
          accessibilityLabel={`DN Pendente: ${qtdPendente} cadastros`}
        >
          <TafGlassPanel
            accent="violet"
            style={[
              styles.statCard,
              {
                borderColor: theme.isDark ? 'rgba(245,158,11,0.4)' : 'rgba(217,119,6,0.35)',
              },
            ]}
          >
            <View
              style={[
                styles.iconRing,
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(245,158,11,0.18)'
                    : 'rgba(254,243,199,0.9)',
                },
              ]}
            >
              <CalendarDays size={22} color={theme.tokens.warning500} strokeWidth={2.4} />
            </View>
            <Text style={[styles.cardLabel, { color: theme.textMuted }]}>DN PENDENTE</Text>
            <Text style={[styles.cardValue, { color: ui.text }]}>{qtdPendente}</Text>
            <Text style={[styles.cardHint, { color: theme.textSecondary }]}>
              Sem data de nascimento
            </Text>
          </TafGlassPanel>
        </PressableScale>

        <PressableScale
          onPress={() => abrirModal('ok')}
          style={styles.cardPress}
          accessibilityLabel={`DN OK: ${qtdOk} cadastros`}
        >
          <TafGlassPanel
            accent="cyan"
            style={[
              styles.statCard,
              {
                borderColor: theme.isDark ? 'rgba(34,197,94,0.4)' : 'rgba(22,163,74,0.3)',
              },
            ]}
          >
            <View
              style={[
                styles.iconRing,
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(34,197,94,0.18)'
                    : 'rgba(220,252,231,0.9)',
                },
              ]}
            >
              <CalendarCheck size={22} color={theme.gain} strokeWidth={2.4} />
            </View>
            <Text style={[styles.cardLabel, { color: theme.textMuted }]}>DN OK</Text>
            <Text style={[styles.cardValue, { color: ui.text }]}>{qtdOk}</Text>
            <Text style={[styles.cardHint, { color: theme.textSecondary }]}>
              Com data de nascimento
            </Text>
          </TafGlassPanel>
        </PressableScale>
      </View>

      <AppModal
        visible={modo != null}
        transparent
        animationType="fade"
        onRequestClose={fecharModal}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.isDark ? 'rgba(15,23,42,0.98)' : 'rgba(255,255,255,0.98)',
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.modalKicker, { color: theme.primary }]}>
                  {modo === 'pendente' ? 'DN PENDENTE' : 'DN OK'}
                </Text>
                <Text style={[styles.modalTitle, { color: ui.text }]}>
                  {modo === 'pendente'
                    ? 'Adicionar data de nascimento'
                    : 'Editar data de nascimento'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={fecharModal}
                style={[styles.closeBtn, { borderColor: theme.border }]}
                accessibilityLabel="Fechar"
              >
                <X size={18} color={theme.textSecondary} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            <LabelNip color={theme.textMuted} fontSize={11} fontWeight="800" />
            <View style={styles.nipRow}>
              <TextInput
                value={nip}
                onChangeText={(t) => {
                  setNip(formatNipInput(t));
                  setEncontrado(null);
                  setAviso('');
                  setErro('');
                  setSucesso('');
                }}
                placeholder="00000000"
                placeholderTextColor={theme.textMuted}
                keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
                style={[
                  styles.input,
                  styles.nipInput,
                  {
                    color: ui.text,
                    borderColor: theme.border,
                    backgroundColor: theme.isDark ? 'rgba(2,6,23,0.45)' : theme.backgroundSecondary,
                  },
                ]}
              />
              <TouchableOpacity
                onPress={buscarPorNip}
                style={[styles.searchBtn, { backgroundColor: theme.primary }]}
                accessibilityLabel="Buscar NIP"
              >
                <Search size={18} color={theme.tokens.textOnPrimary} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            {aviso ? (
              <Text style={[styles.feedback, { color: theme.tokens.warning500 }]}>{aviso}</Text>
            ) : null}
            {erro ? <Text style={[styles.feedback, { color: theme.loss }]}>{erro}</Text> : null}
            {sucesso ? (
              <Text style={[styles.feedback, { color: theme.gain }]}>{sucesso}</Text>
            ) : null}

            {encontrado ? (
              <View
                style={[
                  styles.cadastroBox,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.isDark
                      ? 'rgba(56,189,248,0.08)'
                      : 'rgba(239,246,255,0.9)',
                  },
                ]}
              >
                <Text style={[styles.cadastroNome, { color: ui.text }]} numberOfLines={2}>
                  {encontrado.nome || '—'}
                </Text>
                <Text style={[styles.cadastroMeta, { color: theme.textSecondary }]}>
                  {postoGrad(encontrado)} · {encontrado.categoria} · NIP {encontrado.nip || '—'}
                </Text>
                {modo === 'ok' && encontrado.dataNascimento?.trim() ? (
                  <Text style={[styles.cadastroMeta, { color: theme.textMuted }]}>
                    DN atual: {encontrado.dataNascimento}
                    {idadeFromDataNascimento(encontrado.dataNascimento) != null
                      ? ` · ${idadeFromDataNascimento(encontrado.dataNascimento)} anos`
                      : ''}
                  </Text>
                ) : null}

                <Text style={[styles.fieldLabel, { color: theme.textMuted, marginTop: 14 }]}>
                  DATA DE NASCIMENTO
                </Text>
                <TextInput
                  value={dataNascimento}
                  onChangeText={(t) => {
                    setDataNascimento(formatDateInput(t));
                    setErro('');
                    setSucesso('');
                  }}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor={theme.textMuted}
                  keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
                  maxLength={10}
                  style={[
                    styles.input,
                    {
                      color: ui.text,
                      borderColor: theme.border,
                      backgroundColor: theme.isDark
                        ? 'rgba(2,6,23,0.45)'
                        : '#FFFFFF',
                    },
                  ]}
                />
                {idadePreview != null ? (
                  <Text style={[styles.idadeHint, { color: theme.primary }]}>
                    Idade: {idadePreview} anos
                  </Text>
                ) : null}

                <TouchableOpacity
                  onPress={() => void salvar()}
                  disabled={salvando}
                  style={[
                    styles.saveBtn,
                    {
                      backgroundColor: theme.primary,
                      opacity: salvando ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.saveBtnText, { color: theme.tokens.textOnPrimary }]}>
                    {salvando ? 'Salvando…' : modo === 'pendente' ? 'Salvar data' : 'Atualizar data'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, gap: 12 },
  centered: { paddingVertical: 48, alignItems: 'center' },
  lead: { fontSize: 12, lineHeight: 18, marginBottom: 4 },
  cardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cardPress: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 150,
  },
  statCard: {
    padding: 18,
    gap: 8,
    alignItems: 'flex-start',
    minHeight: 150,
  },
  iconRing: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  cardValue: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 40,
  },
  cardHint: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 4,
  },
  modalKicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  nipRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 10 : 12,
    fontSize: 15,
    fontWeight: '700',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  nipInput: { flex: 1 },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedback: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  cadastroBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
  },
  cadastroNome: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  cadastroMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  idadeHint: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '800',
  },
  saveBtn: {
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '900',
  },
});
