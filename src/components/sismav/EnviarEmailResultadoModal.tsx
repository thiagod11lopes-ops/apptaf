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
import { X, Send } from 'lucide-react-native';
import { AppModal } from '../premium/AppModal';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import type { ResultadoCorridaItem } from '../../navigation/types';
import type { AplicadorAssinaturaResumo } from '../../types/aplicadorAssinatura';
import {
  compartilharResultadosAnexo,
  prepararAnexoEmailResumo,
  type PdfResumoPronto,
} from '../../utils/enviarResumoAplicacaoEmail';

type Props = {
  visible: boolean;
  onClose: () => void;
  resultados: ResultadoCorridaItem[];
  textoColunaCadastro: string;
  aplicadorAssinatura?: AplicadorAssinaturaResumo;
  onAviso?: (msg: string) => void;
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
  const [preparandoAnexo, setPreparandoAnexo] = useState(false);
  const [anexo, setAnexo] = useState<PdfResumoPronto | null>(null);
  const [erroAnexo, setErroAnexo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  useEffect(() => {
    if (!visible) {
      setEnviando(false);
      setFeedback(null);
      setAnexo(null);
      setErroAnexo(null);
      setPreparandoAnexo(false);
      return;
    }

    let ativo = true;
    setPreparandoAnexo(true);
    setErroAnexo(null);
    setAnexo(null);
    setFeedback(null);

    void prepararAnexoEmailResumo(resultados, textoColunaCadastro, aplicadorAssinatura)
      .then((pdf) => {
        if (ativo) setAnexo(pdf);
      })
      .catch((e: unknown) => {
        if (ativo) {
          setErroAnexo(
            e instanceof Error ? e.message : 'Não foi possível preparar o anexo do e-mail.',
          );
        }
      })
      .finally(() => {
        if (ativo) setPreparandoAnexo(false);
      });

    return () => {
      ativo = false;
    };
  }, [aplicadorAssinatura, resultados, textoColunaCadastro, visible]);

  const enviar = useCallback(() => {
    if (enviando || preparandoAnexo) return;
    if (!anexo) {
      const msg = erroAnexo ?? 'Aguarde a preparação do anexo e tente de novo.';
      setFeedback({ tipo: 'erro', texto: msg });
      onAviso?.(msg);
      return;
    }

    setEnviando(true);
    setFeedback(null);

    void compartilharResultadosAnexo(anexo)
      .then((resultado) => {
        setFeedback({ tipo: 'ok', texto: resultado.mensagem });
        onAviso?.(resultado.mensagem);
      })
      .catch((e: unknown) => {
        const msg =
          e instanceof Error ? e.message : 'Não foi possível compartilhar o PDF.';
        setFeedback({ tipo: 'erro', texto: msg });
        onAviso?.(msg);
      })
      .finally(() => {
        setEnviando(false);
      });
  }, [anexo, enviando, erroAnexo, onAviso, preparandoAnexo]);

  const busy = enviando || preparandoAnexo;
  const podeEnviar = Boolean(anexo) && !preparandoAnexo && !enviando;

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
                    Envia o PDF do resumo e o CSV de backup para importar em outro dispositivo.
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

              {preparandoAnexo ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color={theme.primary} />
                  <Text style={[styles.loadingText, { color: ui.textMuted }]}>
                    Preparando PDF e CSV…
                  </Text>
                </View>
              ) : (
                <PressableScale
                  onPress={() => void enviar()}
                  disabled={!podeEnviar}
                  style={[styles.sendOuter, { opacity: podeEnviar || enviando ? 1 : 0.55 }]}
                  accessibilityLabel="Enviar Resultados"
                >
                  <LinearGradient
                    colors={['#0D9488', '#0F766E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.sendBtn}
                  >
                    {enviando ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Send size={20} color="#FFFFFF" strokeWidth={2.4} />
                    )}
                    <Text style={styles.sendBtnText}>
                      {enviando ? 'Abrindo compartilhar…' : 'Enviar Resultados'}
                    </Text>
                  </LinearGradient>
                </PressableScale>
              )}

              {erroAnexo && !preparandoAnexo ? (
                <View
                  style={[
                    styles.feedbackBox,
                    {
                      backgroundColor: theme.isDark ? 'rgba(239,68,68,0.18)' : '#FEF2F2',
                      borderColor: '#F87171',
                    },
                  ]}
                >
                  <Text style={[styles.feedbackText, { color: theme.loss }]}>{erroAnexo}</Text>
                </View>
              ) : null}

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
                  ? 'Vão anexados o relatório e o CSV. No outro aparelho: Configurações → Backup em CSV → Importar.'
                  : 'PDF + CSV anexados. No outro aparelho: Configurações → Backup em CSV → Importar.'}
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
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sendOuter: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  sendBtn: {
    minHeight: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
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
