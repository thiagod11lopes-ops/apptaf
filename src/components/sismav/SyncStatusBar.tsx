import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useOfflineSyncState } from '../../contexts/OfflineSyncContext';
import { PressableScale } from '../premium/PressableScale';
import { PREMIUM } from '../../theme/premium';
import { SyncHistoryModal } from './SyncHistoryModal';
import { SyncQueueDetailModal } from './SyncQueueDetailModal';
import {
  formatDurationSeconds,
  formatLastSyncLabel,
  formatRecordsPerSecond,
} from '../../offline-first/sync/syncFormatters';
import { SYNC_AUTH_REQUIRED_MESSAGE } from '../../offline-first/sync/SyncManager';
import { stepLabel } from '../../offline-first/sync/syncSteps';
import type { SyncProgressState, SyncUiState } from '../../offline-first/sync/syncUiState';

function formatQueueCount(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('pt-BR');
}

function cloudConnectionLabel(syncUi: SyncUiState, loggedIn: boolean): string {
  if (!loggedIn) return 'Faça login para sincronizar';
  if (syncUi.phase === 'error') return 'Erro na sincronização';
  if (syncUi.isSyncing) return 'Sincronizando…';
  if (syncUi.phase === 'success' || syncUi.phase === 'already_up_to_date') return 'Sincronizado';
  return 'Dados locais · pronto para sync';
}

function PhaseProgressBar({
  title,
  progress,
  theme,
  active,
  done,
}: {
  title: string;
  progress: SyncProgressState;
  theme: ReturnType<typeof useTheme>['theme'];
  active: boolean;
  done: boolean;
}) {
  const ts = theme.textStyles;
  const percent = done ? 100 : progress.percent;
  const showDetail = progress.total > 0;

  return (
    <View style={styles.phaseBlock}>
      <View style={styles.phaseHeader}>
        <Text style={[styles.phaseTitle, { color: active || done ? theme.text : theme.textMuted }]}>
          {title}
        </Text>
        <Text style={[ts.caption, { color: theme.textSecondary, fontWeight: '700' }]}>{percent}%</Text>
      </View>
      <View style={[styles.track, { backgroundColor: theme.border }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${percent}%`,
              backgroundColor: done ? theme.gain : active ? theme.primary : theme.border,
            },
          ]}
        />
      </View>
      {active && progress.message ? (
        <Text style={[ts.caption, { color: theme.textSecondary, marginTop: 4 }]}>{progress.message}</Text>
      ) : null}
      {active && showDetail ? (
        <Text style={[ts.caption, { color: theme.textMuted, marginTop: 2 }]}>
          {progress.processed} / {progress.total} registros
        </Text>
      ) : null}
    </View>
  );
}

export function SyncStatusBar({ embedded = false }: { embedded?: boolean }) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const { firebaseEnabled, isAuthenticated, authReady } = useAuth();
  const { syncUi, retrySync } = useOfflineSyncState();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [queueDetail, setQueueDetail] = useState<'download' | 'upload' | null>(null);

  const loggedIn = authReady && isAuthenticated;
  const pendingUploads = syncUi.counters.pendingUploads;
  const pendingDownloads = syncUi.counters.pendingDownloads;
  const uploadBreakdown = syncUi.counters.uploadBreakdown;
  const downloadBreakdown = syncUi.counters.downloadBreakdown;

  const preparing =
    syncUi.isSyncing &&
    (syncUi.activeSyncDirection === 'preparing' || syncUi.activeSyncDirection === null);
  const downloadActive =
    syncUi.isSyncing &&
    (syncUi.activeSyncDirection === 'download' || preparing);
  const downloadDone =
    syncUi.isSyncing &&
    (syncUi.activeSyncDirection === 'upload' || syncUi.activeSyncDirection === 'finalize');
  const uploadActive = syncUi.isSyncing && syncUi.activeSyncDirection === 'upload';
  const uploadDone = syncUi.phase === 'success' || syncUi.phase === 'already_up_to_date';

  const openHistory = useCallback(() => {
    if (syncUi.isSyncing) return;
    if (Platform.OS === 'web') {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
    setHistoryOpen(true);
  }, [syncUi.isSyncing]);

  const openQueueDetail = useCallback(
    (direction: 'download' | 'upload') => {
      if (syncUi.isSyncing) return;
      if (Platform.OS === 'web') {
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
      setQueueDetail(direction);
    },
    [syncUi.isSyncing],
  );

  if (!firebaseEnabled) return null;

  const showProgress = syncUi.isSyncing && syncUi.phase !== 'success';
  const showSuccess = syncUi.phase === 'success' && syncUi.lastSync;
  const showUpToDate = syncUi.phase === 'already_up_to_date';
  const showError = syncUi.phase === 'error';

  return (
    <>
      <View
        style={[
          styles.wrap,
          embedded && styles.wrapEmbedded,
          !embedded && {
            backgroundColor: theme.backgroundSecondary,
            borderColor: theme.border,
          },
        ]}
      >
        {!embedded ? (
          <Text style={[ts.caption, { color: theme.textSecondary, fontWeight: '700', letterSpacing: 0.4 }]}>
            SINCRONIZAÇÃO COM A NUVEM
          </Text>
        ) : null}

        <View style={styles.controlRow}>
          <View style={styles.controlLabels}>
            <Text style={[styles.connectionLabel, { color: theme.text }]}>
              {cloudConnectionLabel(syncUi, loggedIn)}
            </Text>
            {!syncUi.isSyncing && syncUi.phase !== 'success' ? (
              <Text style={[ts.caption, { color: theme.textSecondary, marginTop: 2 }]}>
                Última sync: {formatLastSyncLabel(syncUi.lastSyncAt)}
              </Text>
            ) : null}
          </View>

          <View style={styles.statusCluster}>
            <View style={styles.queueBadges}>
              <PressableScale
                onPress={() => openQueueDetail('download')}
                disabled={syncUi.isSyncing}
                style={[
                  styles.queueBtn,
                  { backgroundColor: theme.cardBg, borderColor: theme.border, opacity: syncUi.isSyncing ? 0.55 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Receber da nuvem, ${formatQueueCount(pendingDownloads)} atualização(ões). Toque para ver detalhes`}
              >
                <Text style={[ts.caption, { color: theme.textSecondary }]}>⬇</Text>
                <Text style={[styles.queueValue, { color: theme.text }]}>
                  {formatQueueCount(pendingDownloads)}
                </Text>
              </PressableScale>
              <PressableScale
                onPress={() => openQueueDetail('upload')}
                disabled={syncUi.isSyncing}
                style={[
                  styles.queueBtn,
                  { backgroundColor: theme.cardBg, borderColor: theme.border, opacity: syncUi.isSyncing ? 0.55 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Enviar para a nuvem, ${formatQueueCount(pendingUploads)} alteração(ões). Toque para ver detalhes`}
              >
                <Text style={[ts.caption, { color: theme.textSecondary }]}>⬆</Text>
                <Text style={[styles.queueValue, { color: theme.text }]}>
                  {formatQueueCount(pendingUploads)}
                </Text>
              </PressableScale>
            </View>

            {syncUi.isSyncing ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : null}
          </View>
        </View>

        <Text style={[ts.caption, { color: theme.textMuted, textAlign: 'right' }]}>
          Toque nos números para ver o que será sincronizado (Cadastro, Corrida, Natação, etc.)
        </Text>

        {!loggedIn ? (
          <View style={[styles.blockedBanner, { backgroundColor: '#fef3c7', borderColor: '#ca8a04' }]}>
            <Text style={[ts.caption, { color: '#92400e', fontWeight: '700', lineHeight: 18 }]}>
              ⚠ Faça login com Google para sincronizar
            </Text>
            <Text style={[ts.caption, { color: '#92400e', lineHeight: 18, marginTop: 4 }]}>
              {SYNC_AUTH_REQUIRED_MESSAGE}
            </Text>
          </View>
        ) : null}

        {showProgress ? (
          <View style={styles.progressPanel}>
            <PhaseProgressBar
              title="1. Baixando da nuvem"
              progress={syncUi.downloadProgress}
              theme={theme}
              active={downloadActive}
              done={downloadDone}
            />
            <PhaseProgressBar
              title="2. Enviando alterações"
              progress={syncUi.uploadProgress}
              theme={theme}
              active={uploadActive}
              done={uploadDone}
            />
          </View>
        ) : null}

        {showUpToDate ? (
          <Text style={[styles.successTitle, { color: theme.gain }]}>
            ✅ Seu banco de dados já está atualizado.
          </Text>
        ) : null}

        {showSuccess && syncUi.lastSync ? (
          <View style={styles.resultBlock}>
            <Text style={[styles.successTitle, { color: theme.gain }]}>✅ Sincronização concluída</Text>
            <Text style={[ts.caption, { color: theme.textSecondary }]}>
              ⬇ {syncUi.lastSync.downloads} recebidos · ⬆ {syncUi.lastSync.uploads} enviados ·{' '}
              {formatDurationSeconds(syncUi.lastSync.durationMs)} ·{' '}
              {formatRecordsPerSecond(syncUi.lastSync.avgRecordsPerSecond)}
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

      <SyncQueueDetailModal
        visible={queueDetail === 'download'}
        direction="download"
        breakdown={downloadBreakdown}
        totalLabel={formatQueueCount(pendingDownloads)}
        onClose={() => setQueueDetail(null)}
      />
      <SyncQueueDetailModal
        visible={queueDetail === 'upload'}
        direction="upload"
        breakdown={uploadBreakdown}
        totalLabel={formatQueueCount(pendingUploads)}
        onClose={() => setQueueDetail(null)}
      />
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
    gap: 10,
    maxWidth: 720,
    alignSelf: 'stretch',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 14px rgba(15,23,42,0.06)' } as object)
      : {}),
  },
  wrapEmbedded: {
    borderWidth: 0,
    marginTop: 0,
    marginBottom: 0,
    padding: 0,
    maxWidth: undefined,
    ...(Platform.OS === 'web' ? ({ boxShadow: 'none' } as object) : {}),
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  controlLabels: {
    flex: 1,
    minWidth: 0,
  },
  connectionLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  statusCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  queueBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  queueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 52,
    justifyContent: 'center',
  },
  queueValue: {
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  progressPanel: {
    gap: 12,
    marginTop: 4,
  },
  phaseBlock: {
    gap: 4,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  phaseTitle: {
    fontSize: 13,
    fontWeight: '700',
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
  historyBtn: {
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  historyHint: {
    textAlign: 'center',
    fontWeight: '600',
  },
  blockedBanner: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
});
