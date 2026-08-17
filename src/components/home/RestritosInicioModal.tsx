import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ban, FileDown, X } from 'lucide-react-native';
import { AppModal } from '../premium/AppModal';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import { PREMIUM } from '../../theme/premium';
import {
  montarListaRestritosInicio,
  type RestritoInicioTafItem,
} from '../../utils/restritosInicioLista';
import { exportRestritosTafPdf } from '../../utils/exportRestritosTafPdf';
import { SalvarPdfFeedbackModal } from '../sismav/SalvarPdfFeedbackModal';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function RestritosInicioModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const ui = getUiColors(theme);
  const ts = theme.textStyles;

  const [lista, setLista] = useState<RestritoInicioTafItem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [feedback, setFeedback] = useState<{
    tipo: 'ok' | 'erro';
    titulo: string;
    mensagem: string;
  } | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setCarregando(true);
    void (async () => {
      try {
        const { getAllRestritos } = await import('../../services/restritosStorage');
        const { getAllCadastros } = await import('../../services/cadastrosIndexedDb');
        const [mapa, cadastros] = await Promise.all([
          getAllRestritos(),
          getAllCadastros({ includeDemo: false }),
        ]);
        if (cancelled) return;
        setLista(montarListaRestritosInicio(Object.values(mapa), cadastros));
      } catch (error) {
        console.warn('[restritos-modal] falha ao carregar:', error);
        if (!cancelled) {
          setLista([]);
          Alert.alert('Erro', 'Não foi possível carregar a lista de restritos.');
        }
      } finally {
        if (!cancelled) setCarregando(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const gerarPdf = useCallback(async () => {
    if (lista.length === 0) {
      Alert.alert('Sem dados', 'Não há militares restritos para gerar o PDF.');
      return;
    }
    setGerandoPdf(true);
    try {
      const msg = await exportRestritosTafPdf(lista);
      setFeedback({ tipo: 'ok', titulo: 'PDF salvo', mensagem: msg });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não foi possível gerar o PDF.';
      if (/cancelad/i.test(msg)) return;
      setFeedback({ tipo: 'erro', titulo: 'Erro ao gerar PDF', mensagem: msg });
    } finally {
      setGerandoPdf(false);
    }
  }, [lista]);

  return (
    <>
      <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <LinearGradient
            colors={['rgba(2,6,23,0.78)', 'rgba(120,53,15,0.48)', 'rgba(15,23,42,0.88)']}
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
                  ? 'rgba(251, 191, 36, 0.35)'
                  : 'rgba(217, 119, 6, 0.28)',
              },
            ]}
          >
            <LinearGradient
              colors={['#d97706', '#f59e0b', '#fbbf24']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.header}
            >
              <View style={styles.headerIcon}>
                <Ban size={20} color="#FFFFFF" strokeWidth={2.4} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.headerKicker}>INICIAR · TAF</Text>
                <Text style={styles.headerTitle}>Restritos</Text>
                <Text style={styles.headerSub}>
                  {carregando
                    ? 'Carregando lista…'
                    : `${lista.length.toLocaleString('pt-BR')} militar${lista.length !== 1 ? 'es' : ''} cadastrado${lista.length !== 1 ? 's' : ''} como restrito`}
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
              {carregando ? (
                <View style={styles.centerBox}>
                  <ActivityIndicator color="#d97706" size="large" />
                </View>
              ) : lista.length === 0 ? (
                <View style={styles.centerBox}>
                  <Text style={[ts.body, { color: theme.textSecondary, textAlign: 'center' }]}>
                    Nenhum militar cadastrado como restrito.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator
                >
                  {lista.map((item, index) => (
                    <View
                      key={item.nipKey}
                      style={[
                        styles.item,
                        {
                          backgroundColor: theme.isDark
                            ? 'rgba(120, 53, 15, 0.18)'
                            : 'rgba(255, 251, 235, 0.95)',
                          borderColor: theme.isDark
                            ? 'rgba(251, 191, 36, 0.22)'
                            : 'rgba(252, 211, 77, 0.7)',
                        },
                      ]}
                    >
                      <View style={styles.itemTop}>
                        <Text style={[styles.itemIndex, { color: '#d97706' }]}>
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
                          </Text>
                        </View>
                      </View>
                      <View style={styles.chips}>
                        <View
                          style={[
                            styles.chip,
                            {
                              backgroundColor: theme.isDark
                                ? 'rgba(217, 119, 6, 0.28)'
                                : 'rgba(254, 243, 199, 1)',
                              borderColor: theme.isDark
                                ? 'rgba(251, 191, 36, 0.4)'
                                : 'rgba(252, 211, 77, 0.95)',
                            },
                          ]}
                        >
                          <Text style={[styles.chipText, { color: '#b45309' }]}>
                            {item.dataInicio} a {item.dataFim}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.chip,
                            {
                              backgroundColor: item.ativa
                                ? theme.isDark
                                  ? 'rgba(217, 119, 6, 0.4)'
                                  : 'rgba(253, 230, 138, 1)'
                                : theme.isDark
                                  ? 'rgba(71, 85, 105, 0.35)'
                                  : 'rgba(241, 245, 249, 1)',
                              borderColor: item.ativa
                                ? theme.isDark
                                  ? 'rgba(251, 191, 36, 0.5)'
                                  : 'rgba(245, 158, 11, 0.7)'
                                : theme.isDark
                                  ? 'rgba(148, 163, 184, 0.35)'
                                  : 'rgba(203, 213, 225, 0.9)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: item.ativa ? '#b45309' : theme.textMuted },
                            ]}
                          >
                            {item.ativa ? 'Ativa' : 'Agendada'}
                          </Text>
                        </View>
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
                accessibilityLabel="Gerar PDF dos restritos"
              >
                <LinearGradient
                  colors={['#d97706', '#f59e0b']}
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
    maxWidth: 560,
    maxHeight: '92%',
    borderRadius: PREMIUM.radiusLg + 4,
    borderWidth: 1,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 28px 80px rgba(120, 53, 15, 0.32)' } as object)
      : {
          shadowColor: '#78350f',
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
    minHeight: 180,
    maxHeight: Platform.OS === 'web' ? 420 : 360,
  },
  centerBox: {
    flex: 1,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    padding: 14,
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
