import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Switch, ActivityIndicator, Platform } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useOfflineSyncState } from '../../contexts/OfflineSyncContext';
import { PressableScale } from '../premium/PressableScale';
import { PREMIUM } from '../../theme/premium';

function statusLabel(syncUi: ReturnType<typeof useOfflineSyncState>['syncUi']): {
  emoji: string;
  label: string;
  color: string;
} {
  if (syncUi.phase === 'error') {
    return { emoji: '⚠', label: 'Erro', color: '#dc2626' };
  }
  if (syncUi.phase === 'success') {
    return { emoji: '✅', label: 'Concluído', color: '#16a34a' };
  }
  if (syncUi.isSyncing) {
    return { emoji: '🟡', label: 'Sincronizando', color: '#ca8a04' };
  }
  if (syncUi.isOnline && !syncUi.isOffline) {
    return { emoji: '🟢', label: 'Online', color: '#16a34a' };
  }
  return { emoji: '🔴', label: 'Offline', color: '#64748b' };
}

export function SyncStatusBar() {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const { firebaseEnabled } = useAuth();
  const { syncUi, startSyncFromToggle, retrySync } = useOfflineSyncState();

  const status = statusLabel(syncUi);
  const switchOn = syncUi.isSyncing || syncUi.phase === 'success' || syncUi.isOnline;
  const showProgress = syncUi.isSyncing && syncUi.phase !== 'success';
  const showSuccess = syncUi.phase === 'success' && syncUi.lastSync;
  const showError = syncUi.phase === 'error';

  const handleToggle = useCallback(
    async (next: boolean) => {
      if (!next || !syncUi.toggleEnabled) return;
      if (!firebaseEnabled) return;
      await startSyncFromToggle();
    },
    [firebaseEnabled, startSyncFromToggle, syncUi.toggleEnabled],
  );

  if (!firebaseEnabled) return null;

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: theme.backgroundSecondary,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.statusRow}>
          <Text style={styles.statusEmoji}>{status.emoji}</Text>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>

        <View style={styles.switchRow}>
          {syncUi.isSyncing ? (
            <ActivityIndicator size="small" color={theme.primary} style={styles.spinner} />
          ) : null}
          <Switch
            value={switchOn}
            onValueChange={(v) => void handleToggle(v)}
            disabled={!syncUi.toggleEnabled}
            trackColor={{ false: '#cbd5e1', true: theme.primary }}
            thumbColor="#FFFFFF"
            accessibilityLabel="Chave de sincronização"
          />
        </View>
      </View>

      {!showProgress && !showSuccess && !showError ? (
        <View style={styles.pendingRow}>
          <Text style={[ts.caption, { color: theme.textSecondary }]}>Modificações pendentes:</Text>
          <Text style={[styles.pendingCount, { color: theme.text }]}>
            {syncUi.pendingChanges.toLocaleString('pt-BR')}
          </Text>
        </View>
      ) : null}

      {showProgress ? (
        <View style={styles.progressBlock}>
          <Text style={[styles.progressTitle, { color: theme.text }]}>Sincronizando…</Text>
          <View style={[styles.track, { backgroundColor: theme.border }]}>
            <View
              style={[
                styles.fill,
                {
                  width: `${syncUi.syncProgress.percent}%`,
                  backgroundColor: theme.primary,
                },
              ]}
            />
          </View>
          <View style={styles.progressMeta}>
            <Text style={[ts.caption, { color: theme.textSecondary, flex: 1 }]}>
              {syncUi.syncProgress.message || 'Sincronização em andamento…'}
            </Text>
            <Text style={[ts.caption, { color: theme.text, fontWeight: '800' }]}>
              {syncUi.syncProgress.percent}%
            </Text>
          </View>
          {syncUi.syncProgress.total > 0 ? (
            <Text style={[ts.caption, { color: theme.textMuted, marginTop: 4 }]}>
              {syncUi.syncProgress.processed} de {syncUi.syncProgress.total} registros
            </Text>
          ) : null}
        </View>
      ) : null}

      {showSuccess && syncUi.lastSync ? (
        <View style={styles.resultBlock}>
          <Text style={[styles.successTitle, { color: theme.gain }]}>
            ✅ Sincronização concluída
          </Text>
          <Text style={[ts.caption, { color: theme.textSecondary }]}>
            Uploads: {syncUi.lastSync.uploads} · Downloads: {syncUi.lastSync.downloads} · Ignorados:{' '}
            {syncUi.lastSync.ignored}
          </Text>
          <Text style={[ts.caption, { color: theme.textSecondary }]}>
            Tempo: {Math.max(1, Math.round(syncUi.lastSync.durationMs / 1000))} segundos
          </Text>
        </View>
      ) : null}

      {showError ? (
        <View style={styles.errorBlock}>
          <Text style={[styles.errorTitle, { color: theme.loss }]}>⚠ Erro durante sincronização</Text>
          <Text style={[ts.caption, { color: theme.textSecondary, lineHeight: 18 }]}>
            {syncUi.syncError ?? 'Não foi possível sincronizar.'}
          </Text>
          <PressableScale
            onPress={() => void retrySync()}
            style={[styles.retryBtn, { borderColor: theme.primary }]}
          >
            <Text style={[styles.retryText, { color: theme.primary }]}>Tentar novamente</Text>
          </PressableScale>
        </View>
      ) : null}

      {syncUi.isSyncing ? (
        <Text style={[ts.caption, styles.syncHint, { color: theme.textMuted }]}>
          Sincronização em andamento…
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    padding: 14,
    marginTop: 12,
    marginBottom: 4,
    gap: 10,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 14px rgba(15,23,42,0.06)' } as object)
      : {}),
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusEmoji: {
    fontSize: 14,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '800',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spinner: {
    marginRight: 2,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  pendingCount: {
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  progressBlock: {
    gap: 8,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  progressMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultBlock: {
    gap: 4,
  },
  successTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  errorBlock: {
    gap: 8,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  retryBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  syncHint: {
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
