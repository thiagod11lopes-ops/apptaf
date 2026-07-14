import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, X, Send, AtSign, Inbox } from 'lucide-react-native';
import { AppModal } from '../premium/AppModal';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import type { ResultadoCorridaItem } from '../../navigation/types';
import type { AplicadorAssinaturaResumo } from '../../types/aplicadorAssinatura';
import {
  enviarPdfResumoPorEmail,
  listarOpcoesEmailResultado,
  prepararPdfResumoAplicacao,
  type OpcaoEmailResultado,
  type ProvedorEmailResultado,
} from '../../utils/enviarResumoAplicacaoEmail';

type Props = {
  visible: boolean;
  onClose: () => void;
  resultados: ResultadoCorridaItem[];
  textoColunaCadastro: string;
  aplicadorAssinatura?: AplicadorAssinaturaResumo;
  onAviso?: (msg: string) => void;
};

const ICONE: Record<ProvedorEmailResultado, typeof Mail> = {
  gmail: Mail,
  zimbra: AtSign,
  outros: Inbox,
};

const ACCENT: Record<ProvedorEmailResultado, [string, string]> = {
  gmail: ['#EA4335', '#FBBC05'],
  zimbra: ['#0F766E', '#14B8A6'],
  outros: ['#1D4ED8', '#38BDF8'],
};

export function EnviarEmailResultadoModal({
  visible,
  onClose,
  resultados,
  textoColunaCadastro,
  aplicadorAssinatura,
  onAviso,
}: Props) {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const [opcoes, setOpcoes] = useState<OpcaoEmailResultado[]>([]);
  const [carregandoOpcoes, setCarregandoOpcoes] = useState(false);
  const [enviandoId, setEnviandoId] = useState<ProvedorEmailResultado | null>(null);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  useEffect(() => {
    if (!visible) {
      setEnviandoId(null);
      setFeedback(null);
      return;
    }
    let ativo = true;
    setCarregandoOpcoes(true);
    void listarOpcoesEmailResultado()
      .then((lista) => {
        if (ativo) setOpcoes(lista);
      })
      .catch(() => {
        if (ativo) {
          setOpcoes([
            {
              id: 'gmail',
              titulo: 'Gmail',
              subtitulo: 'Abrir Gmail com PDF anexado',
              disponivel: true,
            },
            {
              id: 'zimbra',
              titulo: 'Zimbra',
              subtitulo: 'Abrir Zimbra com PDF anexado',
              disponivel: true,
            },
            {
              id: 'outros',
              titulo: 'Outros',
              subtitulo: 'Escolher outro app de e-mail',
              disponivel: true,
            },
          ]);
        }
      })
      .finally(() => {
        if (ativo) setCarregandoOpcoes(false);
      });
    return () => {
      ativo = false;
    };
  }, [visible]);

  const enviar = useCallback(
    async (id: ProvedorEmailResultado) => {
      if (enviandoId) return;
      setEnviandoId(id);
      setFeedback(null);
      try {
        const pdf = await prepararPdfResumoAplicacao(
          resultados,
          textoColunaCadastro,
          aplicadorAssinatura,
        );
        const resultado = await enviarPdfResumoPorEmail(id, pdf);
        setFeedback({ tipo: 'ok', texto: resultado.mensagem });
        onAviso?.(resultado.mensagem);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Não foi possível abrir o e-mail com o PDF.';
        setFeedback({ tipo: 'erro', texto: msg });
        onAviso?.(msg);
      } finally {
        setEnviandoId(null);
      }
    },
    [aplicadorAssinatura, enviandoId, onAviso, resultados, textoColunaCadastro],
  );

  const busy = Boolean(enviandoId);

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlayRoot} pointerEvents="box-none">
        <LinearGradient
          colors={
            theme.isDark
              ? ['rgba(2,6,23,0.82)', 'rgba(15,23,42,0.94)']
              : ['rgba(15,23,42,0.55)', 'rgba(15,23,42,0.78)']
          }
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdropHit]}
          onPress={busy ? undefined : onClose}
          accessibilityLabel="Fechar modal"
        />

        <View style={styles.center} pointerEvents="box-none">
          <LinearGradient
            colors={['#38BDF8', '#2563EB', '#0EA5E9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardRing}
            pointerEvents="auto"
          >
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.isDark ? 'rgba(15,23,42,0.98)' : 'rgba(248,250,252,0.98)',
                  borderColor: theme.isDark ? 'rgba(148,163,184,0.2)' : 'rgba(226,232,240,0.9)',
                },
              ]}
              pointerEvents="auto"
            >
              <LinearGradient
                colors={['rgba(56,189,248,0.35)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sheen}
                pointerEvents="none"
              />

              <View style={styles.headerRow}>
                <View style={styles.headerIconWrap}>
                  <LinearGradient
                    colors={['#2563EB', '#0EA5E9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.headerIcon}
                  >
                    <Send size={20} color="#FFFFFF" strokeWidth={2.4} />
                  </LinearGradient>
                </View>
                <View style={styles.headerText}>
                  <Text style={[styles.kicker, { color: theme.primary }]}>ENVIO RÁPIDO</Text>
                  <Text style={[styles.title, { color: ui.text }]}>Enviar Resultado por Email</Text>
                  <Text style={[styles.subtitle, { color: ui.textSecondary }]}>
                    Escolha o app. O PDF do resumo será gerado e anexado automaticamente.
                  </Text>
                </View>
                <PressableScale
                  onPress={onClose}
                  disabled={busy}
                  style={[styles.closeBtn, { borderColor: theme.border, opacity: busy ? 0.5 : 1 }]}
                  accessibilityLabel="Fechar"
                >
                  <X size={18} color={ui.iconStrong} strokeWidth={2.4} />
                </PressableScale>
              </View>

              {carregandoOpcoes ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color={theme.primary} />
                </View>
              ) : (
                <View style={styles.options}>
                  {opcoes.map((opcao, index) => {
                    const Icon = ICONE[opcao.id];
                    const grads = ACCENT[opcao.id];
                    const loading = enviandoId === opcao.id;
                    return (
                      <PressableScale
                        key={opcao.id}
                        onPress={() => void enviar(opcao.id)}
                        disabled={busy || !opcao.disponivel}
                        style={[
                          styles.optionOuter,
                          { opacity: busy && !loading ? 0.55 : opcao.disponivel ? 1 : 0.45 },
                          Platform.OS === 'web'
                            ? ({
                                animationName: 'fadeInUp',
                                animationDuration: '420ms',
                                animationDelay: `${index * 60}ms`,
                                animationFillMode: 'both',
                              } as object)
                            : null,
                        ]}
                        accessibilityLabel={`Enviar por ${opcao.titulo}`}
                      >
                        <LinearGradient
                          colors={[...grads]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.optionAccent}
                        />
                        <View
                          style={[
                            styles.optionInner,
                            {
                              backgroundColor: theme.isDark
                                ? 'rgba(30,41,59,0.92)'
                                : 'rgba(255,255,255,0.96)',
                              borderColor: theme.border,
                            },
                          ]}
                        >
                          <LinearGradient
                            colors={[...grads]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.optionIcon}
                          >
                            {loading ? (
                              <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                              <Icon size={20} color="#FFFFFF" strokeWidth={2.4} />
                            )}
                          </LinearGradient>
                          <View style={styles.optionText}>
                            <Text style={[styles.optionTitle, { color: ui.text }]}>{opcao.titulo}</Text>
                            <Text style={[styles.optionSub, { color: ui.textMuted }]}>
                              {loading ? 'Gerando PDF e abrindo…' : opcao.subtitulo}
                            </Text>
                          </View>
                          <Text style={[styles.optionChevron, { color: theme.primary }]}>›</Text>
                        </View>
                      </PressableScale>
                    );
                  })}
                </View>
              )}

              {feedback ? (
                <View
                  style={[
                    styles.feedbackBox,
                    {
                      backgroundColor:
                        feedback.tipo === 'ok'
                          ? theme.isDark
                            ? 'rgba(16,185,129,0.18)'
                            : '#ECFDF5'
                          : theme.isDark
                            ? 'rgba(239,68,68,0.18)'
                            : '#FEF2F2',
                      borderColor: feedback.tipo === 'ok' ? '#34D399' : '#F87171',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.feedbackText,
                      { color: feedback.tipo === 'ok' ? '#059669' : theme.loss },
                    ]}
                  >
                    {feedback.texto}
                  </Text>
                </View>
              ) : null}

              <Text style={[styles.hint, { color: ui.textMuted }]}>
                {Platform.OS === 'web'
                  ? 'No navegador: abre o e-mail e baixa o relatório para você anexar. Em celular o PDF vai anexado.'
                  : 'Se o app não abrir com anexo, use Outros ou Salvar PDF na pasta.'}
              </Text>
            </View>
          </LinearGradient>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  backdropHit: {
    zIndex: 0,
  },
  center: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    zIndex: 10,
    elevation: 12,
  },
  cardRing: {
    borderRadius: 28,
    padding: 1.5,
  },
  card: {
    borderRadius: 26.5,
    borderWidth: 1,
    padding: 18,
    overflow: 'hidden',
  },
  sheen: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.55,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
  },
  headerIconWrap: { paddingTop: 2 },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  options: { gap: 10 },
  optionOuter: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  optionAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  optionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    paddingLeft: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1, minWidth: 0 },
  optionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  optionSub: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  optionChevron: {
    fontSize: 26,
    fontWeight: '300',
    marginTop: -2,
  },
  feedbackBox: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
  hint: {
    marginTop: 14,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
