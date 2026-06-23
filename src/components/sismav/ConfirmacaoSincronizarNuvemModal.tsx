import React from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CloudUpload, Wifi } from 'lucide-react-native';
import { ModernModal } from './ModernModal';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';
import type { PendingSyncSummary } from '../../services/offline/pendingOps';

type Props = {
  visible: boolean;
  summary: PendingSyncSummary | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmacaoSincronizarNuvemModal({
  visible,
  summary,
  loading = false,
  onClose,
  onConfirm,
}: Props) {
  const { theme } = useTheme();
  const t = theme.tokens;

  const footer = (
    <View style={styles.footerRow}>
      <PressableScale
        onPress={onClose}
        disabled={loading}
        style={[styles.btnGhost, { borderColor: theme.border, opacity: loading ? 0.5 : 1 }]}
      >
        <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Agora não</Text>
      </PressableScale>
      <PressableScale onPress={onConfirm} disabled={loading} style={styles.btnPrimaryOuter}>
        <LinearGradient
          colors={[...t.gradientPrimaryBtn]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.btnPrimary,
            Platform.OS === 'web'
              ? ({ boxShadow: '0 6px 16px rgba(37, 99, 235, 0.32)' } as object)
              : undefined,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <CloudUpload size={16} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.btnPrimaryText}>Atualizar nuvem</Text>
            </>
          )}
        </LinearGradient>
      </PressableScale>
    </View>
  );

  return (
    <ModernModal
      visible={visible}
      onClose={onClose}
      title="Sincronizar com a nuvem?"
      icon={<Wifi size={20} color="#FFFFFF" strokeWidth={2.2} />}
      footer={footer}
    >
      {summary ? (
        <View style={styles.body}>
          <Text style={[styles.message, { color: theme.text }]}>
            Este dispositivo registrou alterações enquanto estava offline (ou sem conexão com a
            nuvem). Deseja enviar essas atualizações para a sua conta na nuvem?
          </Text>

          <View style={[styles.statsCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
            <Text style={[styles.statsTitle, { color: theme.textSecondary }]}>
              {summary.total} alteração{summary.total !== 1 ? 'ões' : ''} pendente
              {summary.total !== 1 ? 's' : ''}
            </Text>
            {summary.cadastros > 0 ? (
              <Text style={[styles.statsLine, { color: theme.text }]}>
                · {summary.cadastros} cadastro{summary.cadastros !== 1 ? 's' : ''}
              </Text>
            ) : null}
            {summary.sessoes > 0 ? (
              <Text style={[styles.statsLine, { color: theme.text }]}>
                · {summary.sessoes} aplicação{summary.sessoes !== 1 ? 'ões' : ''} de TAF
              </Text>
            ) : null}
            {summary.exclusoes > 0 ? (
              <Text style={[styles.statsLine, { color: theme.text }]}>
                · {summary.exclusoes} exclusão{summary.exclusoes !== 1 ? 'ões' : ''}
              </Text>
            ) : null}
          </View>

          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Se escolher &quot;Agora não&quot;, os dados permanecem salvos neste dispositivo e você
            poderá sincronizar depois pelo aviso na tela inicial.
          </Text>
        </View>
      ) : null}
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14 },
  message: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  statsCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  statsTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  statsLine: {
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    flex: 1,
  },
  btnGhost: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  btnGhostText: {
    fontSize: 14,
    fontWeight: '700',
  },
  btnPrimaryOuter: { borderRadius: 12, overflow: 'hidden' },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
