import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Cloud, CloudUpload } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useSmoothPercent } from '../../hooks/useSmoothPercent';

type Props = {
  label: string;
  percent: number;
  loading: boolean;
  /** Envio ativo para Firebase (tempo real). */
  uploading?: boolean;
  /** Download/reconciliação com Firebase. */
  syncing?: boolean;
  /** Última leitura confirmada com a nuvem. */
  syncedWithCloud?: boolean;
  statusHint?: string | null;
};

export function CloudUserLoadIndicator({
  label,
  percent,
  loading,
  uploading = false,
  syncing = false,
  syncedWithCloud = false,
  statusHint = null,
}: Props) {
  const { theme } = useTheme();
  const smooth = useSmoothPercent(percent, loading);
  const showBar = loading || smooth < 100;
  const isOfflineLabel = label.trim().toLowerCase() === 'offline';
  const showUploadPulse = uploading && !isOfflineLabel;
  const showSyncPulse = syncing && !isOfflineLabel;
  const hint = statusHint?.trim() || null;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        {showUploadPulse ? (
          <CloudUpload size={14} color={theme.primary} strokeWidth={2.4} />
        ) : showSyncPulse ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : syncedWithCloud && !isOfflineLabel ? (
          <Cloud size={14} color={theme.gain} strokeWidth={2.4} />
        ) : loading && !isOfflineLabel ? (
          <ActivityIndicator size="small" color={theme.gain} />
        ) : null}
        <Text
          style={[
            styles.label,
            isOfflineLabel && styles.labelOffline,
            (showUploadPulse || showSyncPulse) && styles.labelUploading,
            syncedWithCloud && !loading && styles.labelSynced,
            {
              color: showUploadPulse || showSyncPulse
                ? theme.primary
                : syncedWithCloud && !loading
                  ? theme.gain
                  : loading
                    ? theme.textMuted
                    : isOfflineLabel
                      ? theme.loss
                      : theme.gain,
              fontWeight: isOfflineLabel || showUploadPulse || showSyncPulse ? '800' : '600',
            },
          ]}
        >
          {label}
          {loadingInitialPercent(showSyncPulse, showUploadPulse, loading, isOfflineLabel, smooth)}
        </Text>
      </View>
      {showBar && !isOfflineLabel ? (
        <View style={[styles.track, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.max(0, Math.min(100, showUploadPulse ? 72 : showSyncPulse ? 48 : smooth))}%`,
                backgroundColor:
                  showUploadPulse || showSyncPulse ? theme.primary : theme.gain,
              },
            ]}
          />
        </View>
      ) : null}
      {hint ? (
        <Text
          style={[
            styles.hint,
            {
              color: syncedWithCloud && !loading ? theme.gain : theme.textMuted,
              fontWeight: syncedWithCloud && !loading ? '700' : '600',
            },
          ]}
        >
          {hint}
        </Text>
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
    paddingHorizontal: 12,
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
