import React from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CloudUpload, Wifi } from 'lucide-react-native';
import { ModernModal } from './ModernModal';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';
import type { PendingSyncSummary } from '../../offline-first/sync/pendingSyncItems';

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

  const exclusoes =
    summary?.items.filter((item) => item.record.deleted === true).length ?? 0;

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
      onClose={loading ? () => {} : onClose}
      title="Alterações locais encontradas"
      icon={<Wifi size={20} color="#FFFFFF" strokeWidth={2.2} />}
      footer={footer}
    >
      {summary ? (
        <View style={styles.body}>
          <Text style={[styles.message, { color: theme.text }]}>
            Este dispositivo possui dados atualizados no armazenamento local enquanto estava sem
            conexão. Deseja enviar essas alterações para a nuvem?
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
            {summary.aplicadores > 0 ? (
              <Text style={[styles.statsLine, { color: theme.text }]}>
                · {summary.aplicadores} aplicador{summary.aplicadores !== 1 ? 'es' : ''}
              </Text>
            ) : null}
            {exclusoes > 0 ? (
              <Text style={[styles.statsLine, { color: theme.text }]}>
                · {exclusoes} exclusão{exclusoes !== 1 ? 'ões' : ''}
              </Text>
            ) : null}
          </View>

          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Enquanto não sincronizar, o app continuará exibindo os dados locais deste dispositivo.
            Com conexão e após o envio, passará a usar somente os dados da nuvem.
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
