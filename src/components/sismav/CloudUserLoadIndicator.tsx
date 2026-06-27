import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Cloud } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useSmoothPercent } from '../../hooks/useSmoothPercent';

type Props = {
  /** Nome ou e-mail da conta (sem sufixo de sync). */
  accountName: string;
  /** Texto opcional após o nome (ex.: "sincronizando com a nuvem"). */
  statusSuffix?: string | null;
  percent: number;
  loading: boolean;
  /** Envio ativo para Firebase (tempo real). */
  uploading?: boolean;
  /** Download/reconciliação com Firebase. */
  syncing?: boolean;
  /** Dados exibidos vêm somente da nuvem (nuvem verde). */
  receivingFromCloudOnly?: boolean;
  statusHint?: string | null;
  /** Cronômetro regressivo até próxima comparação nuvem × local. */
  cloudDiffCountdownSec?: number | null;
  /** Mensagem temporária após comparação (Ok sincronizado / clique em salvar…). */
  cloudDiffFlashMessage?: string | null;
};

export function CloudUserLoadIndicator({
  accountName,
  statusSuffix = null,
  percent,
  loading,
  uploading = false,
  syncing = false,
  receivingFromCloudOnly = false,
  statusHint = null,
  cloudDiffCountdownSec = null,
  cloudDiffFlashMessage = null,
}: Props) {
  const { theme } = useTheme();
  const smooth = useSmoothPercent(percent, loading);
  const showBar = loading || smooth < 100;
  const isOfflineLabel = accountName.trim().toLowerCase() === 'offline';
  const showUploadPulse = uploading && !isOfflineLabel;
  const showSyncPulse = syncing && !isOfflineLabel;
  const hint = statusHint?.trim() || null;
  const flash = cloudDiffFlashMessage?.trim() || null;
  const showCountdown =
    cloudDiffCountdownSec != null && cloudDiffCountdownSec >= 0 && !flash;
  const cloudColor = receivingFromCloudOnly ? theme.gain : theme.loss;
  const cloudA11y = receivingFromCloudOnly
    ? 'Recebendo dados somente da nuvem'
    : 'Não está recebendo dados da nuvem';

  const suffix = statusSuffix?.trim() || null;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Cloud
          size={16}
          color={cloudColor}
          strokeWidth={2.4}
          accessibilityLabel={cloudA11y}
        />
        {showSyncPulse || (showUploadPulse && loading) ? (
          <ActivityIndicator size="small" color={theme.primary} style={styles.inlineSpinner} />
        ) : null}
        <Text
          style={[
            styles.label,
            isOfflineLabel && styles.labelOffline,
            (showUploadPulse || showSyncPulse) && styles.labelUploading,
            receivingFromCloudOnly && !loading && styles.labelSynced,
            {
              color: showUploadPulse || showSyncPulse
                ? theme.primary
                : receivingFromCloudOnly && !loading
                  ? theme.gain
                  : loading
                    ? theme.textMuted
                    : isOfflineLabel
                      ? theme.loss
                      : theme.text,
              fontWeight: isOfflineLabel || showUploadPulse || showSyncPulse ? '800' : '600',
            },
          ]}
        >
          {accountName}
          {suffix ? ` · ${suffix}` : ''}
          {loadingInitialPercent(showSyncPulse, showUploadPulse, loading, isOfflineLabel, smooth)}
        </Text>
      </View>
      {showBar && !isOfflineLabel ? (
        <View style={[styles.track, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.max(0, Math.min(100, smooth))}%`,
                backgroundColor:
                  showUploadPulse || showSyncPulse ? theme.primary : receivingFromCloudOnly ? theme.gain : theme.loss,
              },
            ]}
          />
        </View>
      ) : null}
      {hint || flash || showCountdown ? (
        <View style={styles.hintBlock}>
          {hint ? (
            <View style={styles.hintRow}>
              <Text
                style={[
                  styles.hint,
                  {
                    color: receivingFromCloudOnly && !loading ? theme.gain : theme.textMuted,
                    fontWeight: receivingFromCloudOnly && !loading ? '700' : '600',
                  },
                ]}
              >
                {hint}
              </Text>
              {showCountdown ? (
                <View style={[styles.countdownPill, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                  <Text style={[styles.countdownText, { color: theme.primary }]}>
                    {cloudDiffCountdownSec}s
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {flash ? (
            <Text
              style={[
                styles.flashMessage,
                {
                  color: flash === 'Ok sincronizado' ? theme.gain : theme.tokens.warning500,
                },
              ]}
            >
              {flash}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function loadingInitialPercent(
  showSyncPulse: boolean,
  showUploadPulse: boolean,
  loading: boolean,
  isOfflineLabel: boolean,
  smooth: number,
): string {
  if (!loading || showSyncPulse || showUploadPulse || isOfflineLabel) return '';
  return ` · ${Math.round(smooth)}%`;
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginTop: 4,
    alignItems: 'center',
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    paddingHorizontal: 8,
  },
  inlineSpinner: {
    marginLeft: -2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  labelSynced: {
    fontSize: 12,
  },
  labelUploading: {
    fontSize: 12,
    letterSpacing: 0.1,
  },
  labelOffline: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  hint: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
    lineHeight: 14,
  },
  hintBlock: {
    width: '100%',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  countdownPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 36,
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
  flashMessage: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.15,
    lineHeight: 15,
  },
  track: {
    width: '72%',
    maxWidth: 220,
    height: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
