import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { CalendarDays, CalendarCheck, Search, Trash2, X } from 'lucide-react-native';
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
import { compareByNomePtBr } from '../../utils/compareNomePtBr';
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

function matchBuscaNomeOuNip(c: CadastroItemPersist, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const nome = (c.nome || '').toLowerCase();
  const nip = nipDigitos(c.nip || '');
  const qDigits = nipDigitos(q);
  if (qDigits.length >= 2 && nip.includes(qDigits)) return true;
  return nome.includes(q);
}

export function EstatisticasDnPendentePanel() {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const [cadastros, setCadastros] = useState<CadastroItemPersist[]>([]);
  const [loading, setLoading] = useState(true);
  const [modo, setModo] = useState<ModoModal | null>(null);

  // Modal DN Pendente (adicionar por NIP)
  const [nip, setNip] = useState('');
  const [encontrado, setEncontrado] = useState<CadastroItemPersist | null>(null);
  const [dataNascimento, setDataNascimento] = useState('');
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState('');

  // Modal DN OK (lista + busca + editar/apagar)
  const [buscaOk, setBuscaOk] = useState('');
  const [dnDrafts, setDnDrafts] = useState<Record<string, string>>({});
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [erroOk, setErroOk] = useState('');
  const [sucessoOk, setSucessoOk] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setCadastros(await getAllCadastros());
    } finally {
      setLoading(false);
    }
  }, []);

  useAuthDataReload(carregar);

  const { qtdPendente, qtdOk, comDn } = useMemo(() => {
    const okList: CadastroItemPersist[] = [];
    let pendente = 0;
    for (const c of cadastros) {
      if (dataNascimentoCadastroValida(c.dataNascimento)) okList.push(c);
      else pendente += 1;
    }
    okList.sort(compareByNomePtBr);
    return { qtdPendente: pendente, qtdOk: okList.length, comDn: okList };
  }, [cadastros]);

  const listaOkFiltrada = useMemo(
    () => comDn.filter((c) => matchBuscaNomeOuNip(c, buscaOk)),
    [comDn, buscaOk],
  );

  const fecharModal = useCallback(() => {
    if (salvando || salvandoId) return;
    setModo(null);
    setNip('');
    setEncontrado(null);
    setDataNascimento('');
    setAviso('');
    setErro('');
    setSucesso('');
    setBuscaOk('');
    setDnDrafts({});
    setErroOk('');
    setSucessoOk('');
  }, [salvando, salvandoId]);

  const abrirModal = useCallback(
    (m: ModoModal) => {
      setModo(m);
      setNip('');
      setEncontrado(null);
      setDataNascimento('');
      setAviso('');
      setErro('');
      setSucesso('');
      setBuscaOk('');
      setErroOk('');
      setSucessoOk('');
      if (m === 'ok') {
        const drafts: Record<string, string> = {};
        for (const c of cadastros) {
          if (dataNascimentoCadastroValida(c.dataNascimento)) {
            drafts[c.id] = c.dataNascimento.trim();
          }
        }
        setDnDrafts(drafts);
      } else {
        setDnDrafts({});
      }
    },
    [cadastros],
  );

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
    if (dataNascimentoCadastroValida(c.dataNascimento)) {
      setEncontrado(null);
      setAviso('Este cadastro já possui data de nascimento. Use o card DN OK para editar.');
      return;
    }
    setEncontrado(c);
    setNip(c.nip || nipFmt);
    setDataNascimento('');
  }, [nip, cadastros]);

  const salvarPendente = useCallback(async () => {
    if (!encontrado) return;
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
      setEncontrado(null);
      setNip('');
      setDataNascimento('');
      setSucesso('Data de nascimento adicionada com sucesso.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  }, [encontrado, dataNascimento]);

  const salvarDnOk = useCallback(
    async (c: CadastroItemPersist) => {
      const data = (dnDrafts[c.id] ?? '').trim();
      if (data && !dataNascimentoCadastroValida(data)) {
        setErroOk(`NIP ${c.nip}: use DD/MM/AAAA ou apague a data.`);
        return;
      }
      setSalvandoId(c.id);
      setErroOk('');
      setSucessoOk('');
      try {
        const atualizado: CadastroItemPersist = {
          ...c,
          dataNascimento: data,
        };
        await addCadastro(atualizado);
        setCadastros((prev) => prev.map((row) => (row.id === atualizado.id ? atualizado : row)));
        if (!data) {
          setDnDrafts((prev) => {
            const next = { ...prev };
            delete next[c.id];
            return next;
          });
          setSucessoOk(`Data removida de ${c.nome || c.nip}.`);
        } else {
          setDnDrafts((prev) => ({ ...prev, [c.id]: data }));
          setSucessoOk(`Data atualizada: ${c.nome || c.nip}.`);
        }
      } catch (e) {
        setErroOk(e instanceof Error ? e.message : 'Falha ao salvar.');
      } finally {
        setSalvandoId(null);
      }
    },
    [dnDrafts],
  );

  const apagarDnOk = useCallback(
    async (c: CadastroItemPersist) => {
      setDnDrafts((prev) => ({ ...prev, [c.id]: '' }));
      setSalvandoId(c.id);
      setErroOk('');
      setSucessoOk('');
      try {
        const atualizado: CadastroItemPersist = {
          ...c,
          dataNascimento: '',
        };
        await addCadastro(atualizado);
        setCadastros((prev) => prev.map((row) => (row.id === atualizado.id ? atualizado : row)));
        setDnDrafts((prev) => {
          const next = { ...prev };
          delete next[c.id];
          return next;
        });
        setSucessoOk(`Data removida de ${c.nome || c.nip}.`);
      } catch (e) {
        setErroOk(e instanceof Error ? e.message : 'Falha ao apagar.');
        setDnDrafts((prev) => ({ ...prev, [c.id]: c.dataNascimento || '' }));
      } finally {
        setSalvandoId(null);
      }
    },
    [],
  );

  useEffect(() => {
    if (!sucesso) return;
    const t = setTimeout(() => setSucesso(''), 2500);
    return () => clearTimeout(t);
  }, [sucesso]);

  useEffect(() => {
    if (!sucessoOk) return;
    const t = setTimeout(() => setSucessoOk(''), 2500);
    return () => clearTimeout(t);
  }, [sucessoOk]);

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
        Acompanhe cadastros sem data de nascimento e complete ou edite as datas.
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

      {/* Modal DN Pendente — adicionar por NIP */}
      <AppModal
        visible={modo === 'pendente'}
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
                <Text style={[styles.modalKicker, { color: theme.primary }]}>DN PENDENTE</Text>
                <Text style={[styles.modalTitle, { color: ui.text }]}>
                  Adicionar data de nascimento
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
                      backgroundColor: theme.isDark ? 'rgba(2,6,23,0.45)' : '#FFFFFF',
                    },
                  ]}
                />
                {idadePreview != null ? (
                  <Text style={[styles.idadeHint, { color: theme.primary }]}>
                    Idade: {idadePreview} anos
                  </Text>
                ) : null}

                <TouchableOpacity
                  onPress={() => void salvarPendente()}
                  disabled={salvando}
                  style={[
                    styles.saveBtn,
                    { backgroundColor: theme.primary, opacity: salvando ? 0.6 : 1 },
                  ]}
                >
                  <Text style={[styles.saveBtnText, { color: theme.tokens.textOnPrimary }]}>
                    {salvando ? 'Salvando…' : 'Salvar data'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      </AppModal>

      {/* Modal DN OK — lista completa com busca, editar e apagar */}
      <AppModal
        visible={modo === 'ok'}
        transparent
        animationType="fade"
        onRequestClose={fecharModal}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCardWide,
              {
                backgroundColor: theme.isDark ? 'rgba(15,23,42,0.98)' : 'rgba(255,255,255,0.98)',
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.modalKicker, { color: theme.gain }]}>DN OK</Text>
                <Text style={[styles.modalTitle, { color: ui.text }]}>
                  Cadastros com data de nascimento
                </Text>
                <Text style={[styles.modalSub, { color: theme.textMuted }]}>
                  {listaOkFiltrada.length} de {qtdOk} · edite ou apague a DN
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

            <View
              style={[
                styles.searchWrap,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.isDark ? 'rgba(2,6,23,0.45)' : theme.backgroundSecondary,
                },
              ]}
            >
              <Search size={16} color={theme.textMuted} strokeWidth={2.4} />
              <TextInput
                value={buscaOk}
                onChangeText={(t) => {
                  setBuscaOk(t);
                  setErroOk('');
                }}
                placeholder="Buscar por nome ou NIP"
                placeholderTextColor={theme.textMuted}
                style={[styles.searchInput, { color: ui.text }]}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {buscaOk.trim() ? (
                <TouchableOpacity onPress={() => setBuscaOk('')} accessibilityLabel="Limpar busca">
                  <X size={16} color={theme.textMuted} strokeWidth={2.4} />
                </TouchableOpacity>
              ) : null}
            </View>

            {erroOk ? <Text style={[styles.feedback, { color: theme.loss }]}>{erroOk}</Text> : null}
            {sucessoOk ? (
              <Text style={[styles.feedback, { color: theme.gain }]}>{sucessoOk}</Text>
            ) : null}

            <ScrollView
              style={styles.listaScroll}
              contentContainerStyle={styles.listaContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {listaOkFiltrada.length === 0 ? (
                <Text style={[styles.vazioLista, { color: theme.textMuted }]}>
                  {qtdOk === 0
                    ? 'Nenhum cadastro com data de nascimento.'
                    : 'Nenhum resultado para a busca.'}
                </Text>
              ) : (
                listaOkFiltrada.map((c) => {
                  const draft = dnDrafts[c.id] ?? c.dataNascimento ?? '';
                  const idade = idadeFromDataNascimento(draft);
                  const busy = salvandoId === c.id;
                  return (
                    <View
                      key={c.id}
                      style={[
                        styles.listaItem,
                        {
                          borderColor: theme.border,
                          backgroundColor: theme.isDark
                            ? 'rgba(2,6,23,0.35)'
                            : 'rgba(248,250,252,0.95)',
                        },
                      ]}
                    >
                      <Text style={[styles.cadastroNome, { color: ui.text }]} numberOfLines={2}>
                        {c.nome || '—'}
                      </Text>
                      <Text style={[styles.cadastroMeta, { color: theme.textSecondary }]}>
                        {postoGrad(c)} · NIP {c.nip || '—'}
                        {idade != null ? ` · ${idade} anos` : ''}
                      </Text>

                      <Text style={[styles.fieldLabel, { color: theme.textMuted, marginTop: 10 }]}>
                        DATA DE NASCIMENTO
                      </Text>
                      <View style={styles.dnRow}>
                        <TextInput
                          value={draft}
                          onChangeText={(t) => {
                            setDnDrafts((prev) => ({ ...prev, [c.id]: formatDateInput(t) }));
                            setErroOk('');
                            setSucessoOk('');
                          }}
                          placeholder="DD/MM/AAAA"
                          placeholderTextColor={theme.textMuted}
                          keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
                          maxLength={10}
                          editable={!busy}
                          style={[
                            styles.input,
                            styles.dnInput,
                            {
                              color: ui.text,
                              borderColor: theme.border,
                              backgroundColor: theme.isDark ? 'rgba(2,6,23,0.45)' : '#FFFFFF',
                            },
                          ]}
                        />
                        <TouchableOpacity
                          onPress={() => void salvarDnOk(c)}
                          disabled={busy}
                          style={[
                            styles.miniBtn,
                            {
                              backgroundColor: theme.primary,
                              opacity: busy ? 0.55 : 1,
                            },
                          ]}
                          accessibilityLabel={`Salvar data de ${c.nome}`}
                        >
                          <Text
                            style={[styles.miniBtnText, { color: theme.tokens.textOnPrimary }]}
                          >
                            {busy ? '…' : 'Salvar'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => void apagarDnOk(c)}
                          disabled={busy}
                          style={[
                            styles.miniBtnIcon,
                            {
                              borderColor: theme.loss,
                              backgroundColor: theme.lossMuted,
                              opacity: busy ? 0.55 : 1,
                            },
                          ]}
                          accessibilityLabel={`Apagar data de ${c.nome}`}
                        >
                          <Trash2 size={16} color={theme.loss} strokeWidth={2.4} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
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
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  modalCardWide: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
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
  modalSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 8 : 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
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
  listaScroll: {
    flexGrow: 0,
    maxHeight: 420,
  },
  listaContent: {
    gap: 10,
    paddingBottom: 8,
  },
  vazioLista: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 24,
  },
  listaItem: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  dnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  dnInput: {
    flex: 1,
    minWidth: 0,
  },
  miniBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBtnText: {
    fontSize: 12,
    fontWeight: '900',
  },
  miniBtnIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
