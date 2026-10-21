import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FileDown, Search, ShieldAlert, Trash2, X } from 'lucide-react-native';
import { AppModal } from '../premium/AppModal';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import { PREMIUM } from '../../theme/premium';
import {
  modalidadeChaveFromLabelReprovado,
  montarListaReprovadosInicioTaf,
  type ReprovadoInicioTafItem,
} from '../../utils/resultadoGeralHistorico';
import { exportReprovadosTafPdf } from '../../utils/exportReprovadosTafPdf';
import { SalvarPdfFeedbackModal } from '../sismav/SalvarPdfFeedbackModal';
import { ConfirmacaoExcluirResultadoModal } from '../sismav/ConfirmacaoExcluirResultadoModal';
import { nipDigitos } from '../../utils/nipFormat';
import { buscarCadastroPorNomeOuNip } from '../../utils/buscarCadastroPorNomeOuNip';
import {
  limparResultadoModalidadeCadastro,
  type ModalidadeResultadoTaf,
} from '../../utils/limparResultadoModalidade';
import { removerParticipanteModalidadeDoHistorico } from '../../utils/registroModalidadeHistorico';
import { yieldToUi } from '../../utils/yieldToUi';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type ConfirmarExclusao = {
  item: ReprovadoInicioTafItem;
  modalidades: ModalidadeResultadoTaf[];
};

function modalidadesExclusao(item: ReprovadoInicioTafItem): ModalidadeResultadoTaf[] {
  const keys: ModalidadeResultadoTaf[] = [];
  const seen = new Set<ModalidadeResultadoTaf>();
  for (const m of item.modalidades) {
    const chave = m.chave ?? modalidadeChaveFromLabelReprovado(m.label);
    if (!chave || seen.has(chave)) continue;
    seen.add(chave);
    keys.push(chave);
  }
  return keys;
}

export function ReprovadosInicioModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const ui = getUiColors(theme);
  const ts = theme.textStyles;

  const [lista, setLista] = useState<ReprovadoInicioTafItem[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState<ConfirmarExclusao | null>(null);
  const [feedback, setFeedback] = useState<{
    tipo: 'ok' | 'erro';
    titulo: string;
    mensagem: string;
  } | null>(null);

  const recarregarLista = useCallback(async () => {
    const { getAllCadastros } = await import('../../services/cadastrosIndexedDb');
    const { getAllSessoesAplicacao, getDeletedSessoesAplicacao } = await import(
      '../../services/resultadosAplicadosIndexedDb'
    );
    const cadastros = await getAllCadastros({ includeDemo: false });
    await yieldToUi();
    const sessoes = await getAllSessoesAplicacao({ includeDemo: false });
    await yieldToUi();
    const sessoesExcluidas = await getDeletedSessoesAplicacao();
    return montarListaReprovadosInicioTaf(sessoes, cadastros, sessoesExcluidas);
  }, []);

  useEffect(() => {
    if (!visible) {
      setBusca('');
      setConfirmarExclusao(null);
      return;
    }
    let cancelled = false;
    setCarregando(true);
    void (async () => {
      try {
        const next = await recarregarLista();
        if (cancelled) return;
        setLista(next);
      } catch (error) {
        console.warn('[reprovados-modal] falha ao carregar:', error);
        if (!cancelled) {
          setLista([]);
          Alert.alert('Erro', 'Não foi possível carregar a lista de reprovados.');
        }
      } finally {
        if (!cancelled) setCarregando(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, recarregarLista]);

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qDigits = nipDigitos(busca);
    if (!q) return lista;
    return lista.filter((item) => {
      const nome = item.nome.toLowerCase();
      const nip = nipDigitos(item.nip);
      if (nome.includes(q)) return true;
      if (qDigits && nip.includes(qDigits)) return true;
      return false;
    });
  }, [lista, busca]);

  const gerarPdf = useCallback(async () => {
    if (lista.length === 0) {
      Alert.alert('Sem dados', 'Não há militares reprovados para gerar o PDF.');
      return;
    }
    setGerandoPdf(true);
    try {
      const msg = await exportReprovadosTafPdf(lista);
      setFeedback({ tipo: 'ok', titulo: 'PDF salvo', mensagem: msg });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não foi possível gerar o PDF.';
      if (/cancelad/i.test(msg)) return;
      setFeedback({ tipo: 'erro', titulo: 'Erro ao gerar PDF', mensagem: msg });
    } finally {
      setGerandoPdf(false);
    }
  }, [lista]);

  const pedirExclusao = useCallback((item: ReprovadoInicioTafItem) => {
    const modalidades = modalidadesExclusao(item);
    if (modalidades.length === 0) {
      Alert.alert('Erro', 'Não foi possível identificar a prova reprovada para exclusão.');
      return;
    }
    setConfirmarExclusao({ item, modalidades });
  }, []);

  const executarExclusao = useCallback(async () => {
    if (!confirmarExclusao || excluindo) return;
    setExcluindo(true);
    try {
      const { getAllCadastros, addCadastro } = await import('../../services/cadastrosIndexedDb');
      const cadastros = await getAllCadastros({ includeDemo: false });
      const { item, modalidades } = confirmarExclusao;
      const buscaCad = buscarCadastroPorNomeOuNip(cadastros, item.nip);

      if (buscaCad.kind === 'found') {
        let atualizado = buscaCad.cadastro;
        for (const modalidade of modalidades) {
          atualizado = limparResultadoModalidadeCadastro(atualizado, modalidade);
        }
        await addCadastro(atualizado);
        for (const modalidade of modalidades) {
          await removerParticipanteModalidadeDoHistorico(atualizado.nip, modalidade, atualizado);
        }
      } else {
        for (const modalidade of modalidades) {
          await removerParticipanteModalidadeDoHistorico(item.nip, modalidade);
        }
      }

      setConfirmarExclusao(null);
      const next = await recarregarLista();
      setLista(next);
    } catch (e) {
      Alert.alert(
        'Erro',
        e instanceof Error ? e.message : 'Não foi possível excluir o resultado de reprovado.',
      );
    } finally {
      setExcluindo(false);
    }
  }, [confirmarExclusao, excluindo, recarregarLista]);

  const modalidadeConfirmacao =
    confirmarExclusao && confirmarExclusao.modalidades.length === 1
      ? confirmarExclusao.modalidades[0]!
      : null;
  const rotuloProvaConfirmacao =
    confirmarExclusao && confirmarExclusao.modalidades.length > 1
      ? confirmarExclusao.item.modalidades.map((m) => m.label).join(', ')
      : undefined;

  return (
    <>
      <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <LinearGradient
            colors={['rgba(2,6,23,0.78)', 'rgba(69,10,10,0.55)', 'rgba(15,23,42,0.88)']}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(15, 23, 42, 0.96)'
                  : 'rgba(255, 255, 255, 0.97)',
                borderColor: theme.isDark
                  ? 'rgba(248, 113, 113, 0.35)'
                  : 'rgba(220, 38, 38, 0.28)',
              },
            ]}
          >
            <LinearGradient
              colors={['#dc2626', '#f43f5e', '#fb7185']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.header}
            >
              <View style={styles.headerIcon}>
                <ShieldAlert size={20} color="#FFFFFF" strokeWidth={2.4} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.headerKicker}>INICIAR · TAF</Text>
                <Text style={styles.headerTitle}>Reprovados</Text>
                <Text style={styles.headerSub}>
                  {carregando
                    ? 'Carregando lista…'
                    : `${lista.length.toLocaleString('pt-BR')} militar${lista.length !== 1 ? 'es' : ''} com reprovação em ao menos um teste`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                accessibilityLabel="Fechar"
                style={styles.closeBtn}
                hitSlop={10}
              >
                <X size={18} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
            </LinearGradient>

            <View style={styles.body}>
              {!carregando && lista.length > 0 ? (
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
                    placeholder="Localizar por nome ou NIP"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.buscaInput, { color: ui.text }]}
                    accessibilityLabel="Localizar militar por nome ou NIP"
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  {busca.trim() ? (
                    <TouchableOpacity
                      onPress={() => setBusca('')}
                      accessibilityLabel="Limpar busca"
                      hitSlop={8}
                    >
                      <X size={16} color={theme.textMuted} strokeWidth={2.2} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              {carregando ? (
                <View style={styles.centerBox}>
                  <ActivityIndicator color={theme.error} size="large" />
                </View>
              ) : lista.length === 0 ? (
                <View style={styles.centerBox}>
                  <Text style={[ts.body, { color: theme.textSecondary, textAlign: 'center' }]}>
                    Nenhum militar reprovado encontrado.
                  </Text>
                </View>
              ) : filtrada.length === 0 ? (
                <View style={styles.centerBox}>
                  <Text style={[ts.body, { color: theme.textSecondary, textAlign: 'center' }]}>
                    Nenhum militar encontrado para essa busca.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator
                  keyboardShouldPersistTaps="handled"
                >
                  {filtrada.map((item, index) => (
                    <View
                      key={item.id}
                      style={[
                        styles.item,
                        {
                          backgroundColor: theme.isDark
                            ? 'rgba(127, 29, 29, 0.18)'
                            : 'rgba(254, 242, 242, 0.9)',
                          borderColor: theme.isDark
                            ? 'rgba(248, 113, 113, 0.22)'
                            : 'rgba(252, 165, 165, 0.55)',
                        },
                      ]}
                    >
                      <View style={styles.itemTop}>
                        <Text style={[styles.itemIndex, { color: theme.error }]}>
                          #{String(index + 1).padStart(2, '0')}
                        </Text>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            style={[ts.body, { color: ui.text, fontWeight: '800' }]}
                            numberOfLines={2}
                          >
                            {item.nome}
                          </Text>
                          <Text style={[ts.caption, { color: theme.textMuted, marginTop: 2 }]}>
                            NIP {item.nip}
                            {item.postoGrad && item.postoGrad !== '—'
                              ? ` · ${item.postoGrad}`
                              : ''}
                            {item.categoria && item.categoria !== '—'
                              ? ` · ${item.categoria}`
                              : ''}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => pedirExclusao(item)}
                          disabled={excluindo}
                          accessibilityLabel={`Excluir resultado de reprovado de ${item.nome}`}
                          style={[
                            styles.deleteBtn,
                            {
                              borderColor: theme.isDark
                                ? 'rgba(248, 113, 113, 0.45)'
                                : 'rgba(252, 165, 165, 0.95)',
                              backgroundColor: theme.isDark
                                ? 'rgba(127, 29, 29, 0.35)'
                                : 'rgba(254, 226, 226, 1)',
                              opacity: excluindo ? 0.55 : 1,
                            },
                          ]}
                          hitSlop={8}
                        >
                          <Trash2 size={16} color={theme.error} strokeWidth={2.3} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.chips}>
                        {item.modalidades.map((m) => (
                          <View
                            key={`${item.id}-${m.label}`}
                            style={[
                              styles.chip,
                              {
                                backgroundColor: theme.isDark
                                  ? 'rgba(220, 38, 38, 0.28)'
                                  : 'rgba(254, 226, 226, 1)',
                                borderColor: theme.isDark
                                  ? 'rgba(248, 113, 113, 0.4)'
                                  : 'rgba(252, 165, 165, 0.9)',
                              },
                            ]}
                          >
                            <Text style={[styles.chipText, { color: theme.error }]}>
                              {m.label}: {m.detalhe}
                              {m.tempo ? ` · ${m.tempo}` : ''}
                              {m.tempoMinimo ? ` · mín. ${m.tempoMinimo}` : ''}
                              {m.data ? ` · ${m.data}` : ''}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={[styles.footer, { borderTopColor: theme.border }]}>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.ghostBtn, { borderColor: theme.border }]}
                accessibilityLabel="Fechar"
              >
                <Text style={[styles.ghostBtnText, { color: theme.textSecondary }]}>Fechar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void gerarPdf()}
                disabled={gerandoPdf || carregando || lista.length === 0}
                activeOpacity={0.88}
                style={[
                  styles.pdfBtnOuter,
                  { opacity: gerandoPdf || carregando || lista.length === 0 ? 0.65 : 1 },
                ]}
                accessibilityLabel="Gerar PDF dos reprovados"
              >
                <LinearGradient
                  colors={['#dc2626', '#e11d48']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.pdfBtn}
                >
                  {gerandoPdf ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <FileDown size={16} color="#FFFFFF" strokeWidth={2.4} />
                      <Text style={styles.pdfBtnText}>Gerar PDF</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </AppModal>

      <ConfirmacaoExcluirResultadoModal
        visible={confirmarExclusao != null}
        nome={confirmarExclusao?.item.nome ?? ''}
        nip={confirmarExclusao?.item.nip ?? ''}
        modalidade={modalidadeConfirmacao}
        rotuloProva={rotuloProvaConfirmacao}
        loading={excluindo}
        onClose={() => {
          if (!excluindo) setConfirmarExclusao(null);
        }}
        onConfirm={() => void executarExclusao()}
      />

      <SalvarPdfFeedbackModal
        visible={feedback != null}
        tipo={feedback?.tipo ?? 'ok'}
        titulo={feedback?.titulo ?? ''}
        mensagem={feedback?.mensagem ?? ''}
        onClose={() => setFeedback(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 1120,
    maxHeight: '96%',
    borderRadius: PREMIUM.radiusLg + 4,
    borderWidth: 1,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 28px 80px rgba(127, 29, 29, 0.35)' } as object)
      : {
          shadowColor: '#7f1d1d',
          shadowOffset: { width: 0, height: 18 },
          shadowOpacity: 0.28,
          shadowRadius: 28,
          elevation: 16,
        }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headerKicker: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 16,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  body: {
    minHeight: 360,
    maxHeight: Platform.OS === 'web' ? 840 : 720,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
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
  centerBox: {
    flex: 1,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 14,
    gap: 10,
  },
  item: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  itemIndex: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  deleteBtn: {
    width: PREMIUM.minTouch,
    height: PREMIUM.minTouch,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ghostBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  ghostBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  pdfBtnOuter: {
    flex: 1.4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  pdfBtn: {
    minHeight: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  pdfBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
