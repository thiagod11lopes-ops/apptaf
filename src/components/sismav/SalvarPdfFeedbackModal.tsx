import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { CheckCircle2, AlertCircle, X } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';

type Props = {
  visible: boolean;
  tipo: 'ok' | 'erro';
  titulo: string;
  mensagem: string;
  /** Só sucesso — some automaticamente. Erro permanece até fechar. */
  durationMs?: number;
  onClose: () => void;
};

const OK = '#059669';
const ERRO = '#DC2626';

/** Modal de feedback após Salvar PDF (sucesso ~3s; erro até o usuário fechar). */
export function SalvarPdfFeedbackModal({
  visible,
  tipo,
  titulo,
  mensagem,
  durationMs = 3000,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const ui = getUiColors(theme);
  const accent = tipo === 'ok' ? OK : ERRO;

  useEffect(() => {
    if (!visible || tipo !== 'ok') return;
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [visible, tipo, durationMs, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={tipo === 'erro' ? onClose : undefined}
          accessibilityLabel={tipo === 'erro' ? 'Fechar aviso' : undefined}
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.isDark ? 'rgba(15,23,42,0.98)' : 'rgba(255,255,255,0.98)',
              borderColor:
                tipo === 'ok'
                  ? theme.isDark
                    ? 'rgba(16,185,129,0.45)'
                    : 'rgba(16,185,129,0.35)'
                  : theme.isDark
                    ? 'rgba(248,113,113,0.45)'
                    : 'rgba(248,113,113,0.4)',
            },
          ]}
        >
          <View
            style={[
              styles.glow,
              {
                backgroundColor:
                  tipo === 'ok'
                    ? theme.isDark
                      ? 'rgba(16,185,129,0.2)'
                      : 'rgba(16,185,129,0.12)'
                    : theme.isDark
                      ? 'rgba(239,68,68,0.2)'
                      : 'rgba(239,68,68,0.12)',
              },
            ]}
          />

          {tipo === 'erro' ? (
            <Pressable
              onPress={onClose}
              style={[styles.closeBtn, { borderColor: theme.border }]}
              accessibilityLabel="Fechar"
            >
              <X size={16} color={ui.iconStrong ?? ui.icon} strokeWidth={2.4} />
            </Pressable>
          ) : null}

          <View
            style={[
              styles.iconRing,
              {
                backgroundColor:
                  tipo === 'ok'
                    ? theme.isDark
                      ? 'rgba(16,185,129,0.22)'
                      : 'rgba(209,250,229,0.95)'
                    : theme.isDark
                      ? 'rgba(239,68,68,0.22)'
                      : 'rgba(254,226,226,0.95)',
              },
            ]}
          >
            {tipo === 'ok' ? (
              <CheckCircle2 size={28} color={accent} strokeWidth={2.4} />
            ) : (
              <AlertCircle size={28} color={accent} strokeWidth={2.4} />
            )}
          </View>

          <Text style={[styles.title, { color: ui.text }]}>{titulo}</Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]}>{mensagem}</Text>

          {tipo === 'ok' ? (
            <Text style={[styles.hint, { color: ui.textMuted }]}>Fecha em alguns segundos…</Text>
          ) : (
            <Pressable
              onPress={onClose}
              style={[styles.okBtn, { backgroundColor: accent }]}
              accessibilityLabel="Entendi"
            >
              <Text style={styles.okBtnText}>Entendi</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 2,
  },
  glow: {
    position: 'absolute',
    top: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    opacity: 0.9,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  sub: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  hint: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  okBtn: {
    marginTop: 18,
    minWidth: 120,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
    alignItems: 'center',
  },
  okBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
