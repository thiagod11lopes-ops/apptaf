import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, ActivityIndicator, Platform } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useOfflineSyncState } from '../../contexts/OfflineSyncContext';
import { PressableScale } from '../premium/PressableScale';
import { PREMIUM } from '../../theme/premium';
import { SyncHistoryModal } from './SyncHistoryModal';
import {
  formatDurationSeconds,
  formatLastSyncLabel,
  formatRecordsPerSecond,
  formatRemainingSeconds,
} from '../../offline-first/sync/syncFormatters';
import { SYNC_AUTH_REQUIRED_MESSAGE } from '../../offline-first/sync/SyncManager';
import { stepIcon, stepLabel, type SyncStepState } from '../../offline-first/sync/syncSteps';
import type { SyncUiState } from '../../offline-first/sync/syncUiState';

function statusLabel(
  syncUi: SyncUiState,
  loggedIn: boolean,
): { emoji: string; label: string; color: string } {
  if (!loggedIn) {
    return { emoji: '🟡', label: 'Sem login', color: '#ca8a04' };
  }
  if (syncUi.phase === 'error') {
    return { emoji: '⚠', label: 'Erro', color: '#dc2626' };
  }
  if (syncUi.phase === 'success') {
    return { emoji: '✅', label: 'Concluído', color: '#16a34a' };
  }
  if (syncUi.phase === 'already_up_to_date') {
    return { emoji: '✅', label: 'Atualizado', color: '#16a34a' };
  }
  if (syncUi.isSyncing) {
    return { emoji: '🟡', label: 'Sincronizando', color: '#ca8a04' };
  }
  if (syncUi.isOnline && !syncUi.isOffline) {
    return { emoji: '🟢', label: 'Online', color: '#16a34a' };
  }
  return { emoji: '🔴', label: 'Offline', color: '#64748b' };
}

function CounterCell({
  emoji,
  label,
  value,
  theme,
}: {
  emoji: string;
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <View style={styles.counterCell}>
      <Text style={[styles.counterEmoji]}>{emoji}</Text>
      <Text style={[styles.counterLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.counterValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function StepRow({ step, theme }: { step: SyncStepState; theme: ReturnType<typeof useTheme>['theme'] }) {
  const icon = stepIcon(step.status);
  const color =
    step.status === 'done'
      ? '#16a34a'
      : step.status === 'running'
        ? '#ca8a04'
        : step.status === 'error'
          ? '#dc2626'
          : theme.textMuted;

  return (
    <View style={styles.stepRow}>
      <Text style={[styles.stepIcon, { color }]}>{icon}</Text>
      <Text style={[styles.stepLabel, { color: step.status === 'pending' ? theme.textMuted : theme.text }]}>
        {step.label}
      </Text>
    </View>
  );
}

export function SyncStatusBar() {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const { firebaseEnabled, isAuthenticated, authReady } = useAuth();
  const { syncUi, startSyncFromToggle, retrySync } = useOfflineSyncState();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [authBlockedHint, setAuthBlockedHint] = useState(false);

  const loggedIn = authReady && isAuthenticated;
  const sessionReady = loggedIn;

  useEffect(() => {
    if (sessionReady) setAuthBlockedHint(false);
  }, [sessionReady]);
  const status = statusLabel(syncUi, loggedIn);
  const switchOn =
    syncUi.isSyncing ||
    syncUi.phase === 'success' ||
    syncUi.phase === 'already_up_to_date' ||
    syncUi.isOnline;
  const showPanel = syncUi.isSyncing && syncUi.phase !== 'success' && syncUi.phase !== 'already_up_to_date';
  const showSuccess = syncUi.phase === 'success' && syncUi.lastSync;
  const showUpToDate = syncUi.phase === 'already_up_to_date';
  const showError = syncUi.phase === 'error';
  const showIdleCounters = !showPanel && !showSuccess && !showUpToDate && !showError;
  const showAuthBlocked = !loggedIn && !syncUi.isSyncing;

  const handleToggle = useCallback(
    async (next: boolean) => {
      if (!next) return;
      if (!sessionReady) {
        setAuthBlockedHint(true);
        return;
      }
      if (!syncUi.toggleEnabled) return;
      if (!firebaseEnabled) return;
      setAuthBlockedHint(false);
      await startSyncFromToggle();
    },
    [firebaseEnabled, sessionReady, startSyncFromToggle, syncUi.toggleEnabled],
  );

  const openHistory = useCallback(() => {
    if (syncUi.isSyncing) return;
    if (Platform.OS === 'web') {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
    setHistoryOpen(true);
  }, [syncUi.isSyncing]);

  if (!firebaseEnabled) return null;

  const downloadDisplay =
    syncUi.counters.pendingDownloads != null
      ? syncUi.counters.pendingDownloads.toLocaleString('pt-BR')
      : '—';

  return (
    <>
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
            <View style={styles.statusCol}>
              <View style={styles.statusRow}>
                <Text style={styles.statusEmoji}>{status.emoji}</Text>
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
              {!syncUi.isSyncing && syncUi.phase !== 'success' ? (
                <Text style={[ts.caption, { color: theme.textSecondary, marginTop: 2 }]}>
                  Última sincronização:{' '}
                  <Text style={{ color: theme.text, fontWeight: '600' }}>
                    {formatLastSyncLabel(syncUi.lastSyncAt)}
                  </Text>
                </Text>
              ) : null}
              {loggedIn && !syncUi.isSyncing && syncUi.phase !== 'success' ? (
                <Text style={[ts.caption, { color: theme.gain, marginTop: 2, fontWeight: '600' }]}>
                  Logado com Google · sync manual na chave
                </Text>
              ) : null}
              {syncUi.isSyncing && syncUi.syncMessage ? (
                <Text style={[ts.caption, { color: theme.primary, marginTop: 4, fontWeight: '600' }]}>
                  {syncUi.syncMessage}
                </Text>
              ) : null}
            </View>

            <View
              style={styles.switchRow}
              {...(Platform.OS === 'web'
                ? ({
                    title: sessionReady
                      ? 'Ativar sincronização manual'
                      : 'Faça login com Google antes de ativar sincronização',
                  } as object)
                : {})}
            >
              {syncUi.isSyncing ? (
                <ActivityIndicator size="small" color={theme.primary} style={styles.spinner} />
              ) : null}
              <Switch
                value={switchOn}
                onValueChange={(v) => void handleToggle(v)}
                disabled={!sessionReady || !syncUi.toggleEnabled}
                trackColor={{ false: '#cbd5e1', true: theme.primary }}
                thumbColor="#FFFFFF"
                accessibilityLabel={
                  sessionReady
                    ? 'Chave de sincronização'
                    : 'Chave bloqueada — faça login com Google antes de sincronizar'
                }
                accessibilityState={{ disabled: !sessionReady || !syncUi.toggleEnabled }}
              />
            </View>
          </View>

          {showAuthBlocked ? (
            <View style={[styles.blockedBanner, { backgroundColor: '#fef3c7', borderColor: '#ca8a04' }]}>
              <Text style={[ts.caption, { color: '#92400e', fontWeight: '700', lineHeight: 18 }]}>
                ⚠ Você precisa estar logado com Google para ativar a sincronização
              </Text>
              <Text style={[ts.caption, { color: '#92400e', lineHeight: 18, marginTop: 4 }]}>
                {SYNC_AUTH_REQUIRED_MESSAGE}
              </Text>
            </View>
          ) : null}

          {authBlockedHint && sessionReady === false ? (
            <Text style={[ts.caption, { color: theme.loss, fontWeight: '600' }]}>
              {SYNC_AUTH_REQUIRED_MESSAGE}
            </Text>
          ) : null}

          {showIdleCounters ? (
            <View style={styles.countersGrid}>
              <CounterCell
                emoji="⬆"
                label="Upload"
                value={syncUi.counters.pendingUploads.toLocaleString('pt-BR')}
                theme={theme}
              />
              <CounterCell emoji="⬇" label="Download" value={downloadDisplay} theme={theme} />
              <CounterCell
                emoji="✓"
                label="Sincronizados"
                value={syncUi.counters.syncedTotal.toLocaleString('pt-BR')}
                theme={theme}
              />
            </View>
          ) : null}

          {showPanel ? (
            <View style={styles.panel}>
              <Text style={[styles.panelTitle, { color: theme.text }]}>Status atual</Text>
              <View style={styles.stepsList}>
                {syncUi.syncSteps.map((step) => (
                  <StepRow key={step.id} step={step} theme={theme} />
                ))}
              </View>

              {syncUi.syncProgress.total > 0 ? (
                <View style={styles.progressBlock}>
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
                    <Text style={[ts.caption, { color: theme.text, fontWeight: '800' }]}>
                      {syncUi.syncProgress.percent}%
                    </Text>
                    <Text style={[ts.caption, { color: theme.textSecondary }]}>
                      {syncUi.syncProgress.processed} / {syncUi.syncProgress.total} registros
                    </Text>
                  </View>
                  <View style={styles.timingRow}>
                    <Text style={[ts.caption, { color: theme.textSecondary }]}>
                      Tempo restante: {formatRemainingSeconds(syncUi.syncProgress.remainingSeconds ?? 0)}
                    </Text>
                    <Text style={[ts.caption, { color: theme.textSecondary }]}>
                      {formatRecordsPerSecond(syncUi.syncProgress.recordsPerSecond)}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={[ts.caption, { color: theme.textSecondary, fontStyle: 'italic' }]}>
                  {syncUi.syncProgress.message || 'Preparando…'}
                </Text>
              )}

              <View style={styles.countersGridCompact}>
                <Text style={[ts.caption, { color: theme.text }]}>
                  ⬆ {syncUi.counters.pendingUploads.toLocaleString('pt-BR')}
                </Text>
                <Text style={[ts.caption, { color: theme.text }]}>
                  ⬇{' '}
                  {(syncUi.counters.pendingDownloads ?? 0).toLocaleString('pt-BR')}
                </Text>
                <Text style={[ts.caption, { color: theme.textSecondary }]}>
                  ✓ {syncUi.counters.syncedTotal.toLocaleString('pt-BR')}
                </Text>
              </View>
            </View>
          ) : null}

          {showUpToDate ? (
            <View style={styles.resultBlock}>
              <Text style={[styles.successTitle, { color: theme.gain }]}>✅ Seu banco de dados já está atualizado.</Text>
            </View>
          ) : null}

          {showSuccess && syncUi.lastSync ? (
            <View style={styles.resultBlock}>
              <Text style={[styles.successTitle, { color: theme.gain }]}>✅ Sincronização concluída</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={[ts.caption, { color: theme.textSecondary }]}>⬆ Uploads</Text>
                  <Text style={[styles.summaryValue, { color: theme.text }]}>{syncUi.lastSync.uploads}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[ts.caption, { color: theme.textSecondary }]}>⬇ Downloads</Text>
                  <Text style={[styles.summaryValue, { color: theme.text }]}>{syncUi.lastSync.downloads}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[ts.caption, { color: theme.textSecondary }]}>Ignorados</Text>
                  <Text style={[styles.summaryValue, { color: theme.text }]}>{syncUi.lastSync.ignored}</Text>
                </View>
              </View>
              <Text style={[ts.caption, { color: theme.textSecondary }]}>
                Tempo: {formatDurationSeconds(syncUi.lastSync.durationMs)}
              </Text>
              <Text style={[ts.caption, { color: theme.textSecondary }]}>
                Velocidade média: {formatRecordsPerSecond(syncUi.lastSync.avgRecordsPerSecond)}
              </Text>
              <Text style={[ts.caption, { color: theme.textSecondary }]}>
                Última sincronização: {formatLastSyncLabel(syncUi.lastSync.finishedAt)}
              </Text>
            </View>
          ) : null}

          {showError ? (
            <View style={styles.errorBlock}>
              <Text style={[styles.errorTitle, { color: theme.loss }]}>⚠ Erro durante sincronização</Text>
              {syncUi.errorStepId ? (
                <Text style={[ts.caption, { color: theme.textSecondary }]}>
                  Etapa: {stepLabel(syncUi.errorStepId)}
                </Text>
              ) : null}
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

          {!syncUi.isSyncing ? (
            <PressableScale
              onPress={openHistory}
              style={styles.historyBtn}
              accessibilityLabel="Ver histórico de sincronizações"
            >
              <Text style={[ts.caption, styles.historyHint, { color: theme.primary }]}>
                Ver histórico de sincronizações
              </Text>
            </PressableScale>
          ) : null}
        </View>

      <SyncHistoryModal visible={historyOpen} onClose={() => setHistoryOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    padding: 14,
    marginTop: 12,
    marginBottom: 4,
    gap: 12,
    maxWidth: 720,
    alignSelf: 'stretch',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 14px rgba(15,23,42,0.06)' } as object)
      : {}),
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusCol: {
    flex: 1,
    minWidth: 0,
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
    flexShrink: 0,
  },
  spinner: {
    marginRight: 2,
  },
  countersGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  countersGridCompact: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  counterCell: {
    flex: 1,
    minWidth: 88,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
  },
  counterEmoji: {
    fontSize: 16,
  },
  counterLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  counterValue: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  panel: {
    gap: 10,
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepsList: {
    gap: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepIcon: {
    width: 18,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  progressBlock: {
    gap: 6,
  },
  track: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 5,
  },
  progressMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  timingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  resultBlock: {
    gap: 6,
  },
  successTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  summaryItem: {
    gap: 2,
    minWidth: 72,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
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
  historyBtn: {
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  historyHint: {
    textAlign: 'center',
    fontWeight: '600',
  },
  resumeBanner: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  blockedBanner: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
});
