import React from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CloudUpload, WifiOff } from 'lucide-react-native';
import { ModernModal } from './ModernModal';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';
import type { PendingSyncSummary } from '../../offline-first/sync/pendingSyncItems';

type Props = {
  visible: boolean;
  summary: PendingSyncSummary | null;
  loading?: boolean;
  /** Somente o chefe pode continuar online sem enviar pendentes. */
  allowSkipUploadOnline?: boolean;
  onUpload: () => void;
  onContinueOnline?: () => void;
  onWorkOffline?: () => void;
};

export function SincronizacaoNecessariaModal({
  visible,
  summary,
  loading = false,
  allowSkipUploadOnline = false,
  onUpload,
  onContinueOnline,
  onWorkOffline,
}: Props) {
  const { theme } = useTheme();
  const t = theme.tokens;

  const footer = (
    <View style={styles.footerCol}>
      <PressableScale onPress={onUpload} disabled={loading} style={styles.btnPrimaryOuter}>
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
              <Text style={styles.btnPrimaryText}>Enviar para nuvem</Text>
            </>
          )}
        </LinearGradient>
      </PressableScale>
      {allowSkipUploadOnline && onContinueOnline ? (
        <PressableScale
          onPress={onContinueOnline}
          disabled={loading}
          style={[styles.btnGhost, { borderColor: theme.border, opacity: loading ? 0.5 : 1 }]}
        >
          <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>
            Continuar online sem enviar
          </Text>
        </PressableScale>
      ) : null}
      {allowSkipUploadOnline && onWorkOffline ? (
        <PressableScale
          onPress={onWorkOffline}
          disabled={loading}
          style={[styles.btnGhost, { borderColor: theme.border, opacity: loading ? 0.5 : 1 }]}
        >
          <WifiOff size={16} color={theme.textSecondary} strokeWidth={2.2} />
          <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>
            Cancelar e trabalhar offline
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );

  return (
    <ModernModal
      visible={visible}
      onClose={() => undefined}
      dismissable={false}
      title="Sincronização necessária"
      icon={<CloudUpload size={20} color="#FFFFFF" strokeWidth={2.2} />}
      footer={footer}
    >
      <View style={styles.body}>
        <Text style={[styles.message, { color: theme.text }]}>
          Existem dados locais que precisam ser enviados para a nuvem antes de continuar.
        </Text>
        {summary && summary.total > 0 ? (
          <View style={[styles.statsCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
            <Text style={[styles.statsTitle, { color: theme.textSecondary }]}>
              {summary.total} registro{summary.total !== 1 ? 's' : ''} pendente
              {summary.total !== 1 ? 's' : ''}
            </Text>
            {summary.cadastros > 0 ? (
              <Text style={[styles.statsLine, { color: theme.text }]}>
                · {summary.cadastros} cadastro{summary.cadastros !== 1 ? 's' : ''}
              </Text>
            ) : null}
            {summary.sessoes > 0 ? (
              <Text style={[styles.statsLine, { color: theme.text }]}>
                · {summary.sessoes} sessão{summary.sessoes !== 1 ? 'ões' : ''} de TAF
              </Text>
            ) : null}
            {summary.aplicadores > 0 ? (
              <Text style={[styles.statsLine, { color: theme.text }]}>
                · {summary.aplicadores} aplicador{summary.aplicadores !== 1 ? 'es' : ''}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          {allowSkipUploadOnline
            ? 'Como chefe, você pode enviar agora ou continuar online e sincronizar depois. E-mails autorizados precisam enviar antes de continuar.'
            : 'Envie os dados locais para a nuvem antes de continuar. Apenas o e-mail chefe pode pular este envio e permanecer online.'}
        </Text>
      </View>
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
  footerCol: {
    flexDirection: 'column',
    gap: 10,
    width: '100%',
  },
  btnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
    justifyContent: 'center',
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
