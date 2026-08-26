import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { QrCode, Share2 } from 'lucide-react-native';
import { ModernModal } from '../sismav/ModernModal';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';
import {
  URL_AGENDAMENTO_PUBLICO,
  URL_AGENDAMENTO_PUBLICO_HTML,
} from '../../constants/agendamentoPublico';

/** Preferência: URL sem .html (rota); fallback HTML estático no QR. */
export const AGENDAMENTO_QR_URL = URL_AGENDAMENTO_PUBLICO;

type Props = {
  visible: boolean;
  onClose: () => void;
};

function qrImageHttpUrl(url: string, size = 320): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=12&data=${encodeURIComponent(url)}`;
}

async function blobFromDataUrl(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

async function gerarQrDataUrlLocal(url: string, size = 320): Promise<string | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  try {
    type QrLib = {
      toDataURL: (
        text: string,
        opts?: { width?: number; margin?: number; errorCorrectionLevel?: string },
      ) => Promise<string>;
    };
    const w = window as Window & { QRCode?: QrLib };
    if (!w.QRCode) {
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>('script[data-qrcode-lib]');
        if (existing) {
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', () => reject(new Error('QR lib')));
          return;
        }
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js';
        s.async = true;
        s.dataset.qrcodeLib = '1';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('QR lib'));
        document.head.appendChild(s);
      });
    }
    const lib = (window as Window & { QRCode?: QrLib }).QRCode;
    if (!lib?.toDataURL) return null;
    return await lib.toDataURL(url, { width: size, margin: 2, errorCorrectionLevel: 'M' });
  } catch {
    return null;
  }
}

export function AgendamentoQrCodeModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const t = theme.tokens;
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQrUri(null);
      return;
    }
    let cancelled = false;
    setGerando(true);
    void (async () => {
      const local = await gerarQrDataUrlLocal(AGENDAMENTO_QR_URL, 320);
      if (cancelled) return;
      setQrUri(local ?? qrImageHttpUrl(AGENDAMENTO_QR_URL, 320));
      setGerando(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const compartilhar = useCallback(async () => {
    if (!qrUri || compartilhando) return;
    setCompartilhando(true);
    try {
      const title = 'Agendamento TAF';
      const text = `Acesse o agendamento do TAF:\n${AGENDAMENTO_QR_URL}`;

      if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        try {
          const blob = await blobFromDataUrl(qrUri);
          const file = new File([blob], 'agendamento-taf-qrcode.png', { type: 'image/png' });
          const nav = navigator as Navigator & {
            canShare?: (data: ShareData) => boolean;
          };
          if (typeof navigator.share === 'function') {
            if (nav.canShare?.({ files: [file] })) {
              await navigator.share({ files: [file], title, text, url: AGENDAMENTO_QR_URL });
              return;
            }
            await navigator.share({ title, text, url: AGENDAMENTO_QR_URL });
            return;
          }
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') return;
        }
        // Fallback: WhatsApp com o link
        const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(wa, '_blank', 'noopener,noreferrer');
        return;
      }

      // Nativo: baixar imagem e usar expo-sharing
      const Sharing = await import('expo-sharing');
      const FileSystem = await import('expo-file-system');
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Compartilhar', `Link do agendamento:\n${AGENDAMENTO_QR_URL}`);
        return;
      }
      const cacheDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!cacheDir) {
        Alert.alert('Compartilhar', AGENDAMENTO_QR_URL);
        return;
      }
      const dest = `${cacheDir}agendamento-taf-qrcode.png`;
      if (qrUri.startsWith('data:')) {
        const b64 = qrUri.replace(/^data:image\/\w+;base64,/, '');
        await FileSystem.writeAsStringAsync(dest, b64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else {
        await FileSystem.downloadAsync(qrUri, dest);
      }
      await Sharing.shareAsync(dest, {
        mimeType: 'image/png',
        dialogTitle: 'Compartilhar QR Code — Agendamento TAF',
        UTI: 'public.png',
      });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      Alert.alert(
        'Compartilhar',
        `Não foi possível compartilhar a imagem. Use o link:\n${AGENDAMENTO_QR_URL}\n\n(Alternativa: ${URL_AGENDAMENTO_PUBLICO_HTML})`,
      );
    } finally {
      setCompartilhando(false);
    }
  }, [qrUri, compartilhando]);

  const footer = (
    <View style={styles.footerCol}>
      <PressableScale
        onPress={() => void compartilhar()}
        disabled={!qrUri || gerando || compartilhando}
        style={[styles.btnOuter, { opacity: !qrUri || gerando || compartilhando ? 0.5 : 1 }]}
      >
        <LinearGradient
          colors={[...t.gradientPrimaryBtn]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btnShare}
        >
          {compartilhando ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Share2 size={16} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.btnShareText}>Compartilhar</Text>
            </>
          )}
        </LinearGradient>
      </PressableScale>
      <PressableScale
        onPress={onClose}
        style={[styles.btnGhost, { borderColor: theme.border }]}
      >
        <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Fechar</Text>
      </PressableScale>
    </View>
  );

  return (
    <ModernModal
      visible={visible}
      onClose={onClose}
      title="QR Code — Agendamento"
      icon={<QrCode size={20} color="#FFFFFF" strokeWidth={2.2} />}
      footer={footer}
      maxBodyHeight={520}
    >
      <View style={styles.body}>
        <Text style={[styles.intro, { color: theme.textSecondary }]}>
          Escaneie para abrir a página online de agendamento do TAF.
        </Text>
        <View
          style={[
            styles.qrFrame,
            {
              backgroundColor: '#FFFFFF',
              borderColor: theme.border,
            },
          ]}
        >
          {gerando || !qrUri ? (
            <ActivityIndicator color={theme.primary} size="large" />
          ) : (
            <Image
              source={{ uri: qrUri }}
              style={styles.qrImage}
              accessibilityLabel="QR Code do agendamento TAF"
            />
          )}
        </View>
        <Text style={[styles.url, { color: theme.textMuted }]} selectable>
          {AGENDAMENTO_QR_URL}
        </Text>
      </View>
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    gap: 14,
    width: '100%',
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  qrFrame: {
    width: 280,
    height: 280,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 12,
  },
  qrImage: {
    width: 256,
    height: 256,
  },
  url: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
  },
  footerCol: {
    width: '100%',
    gap: 10,
  },
  btnOuter: {
    width: '100%',
  },
  btnShare: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnShareText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  btnGhost: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
