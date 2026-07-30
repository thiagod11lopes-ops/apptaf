import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  Cloud,
  CloudDownload,
  Database,
  Download,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useCloudSyncState } from '../contexts/OfflineSyncContext';
import { useAuth } from '../contexts/AuthContext';
import { AppModal } from './premium/AppModal';
import { PressableScale } from './premium/PressableScale';
import { PREMIUM } from '../theme/premium';
import {
  downloadPreparedDailyBackup,
  isDailyBackupRequired,
  markDailyBackupComplete,
  prepareDailySystemBackup,
  runDailySystemBackup,
  type DailyBackupPrepared,
  type DailyBackupProgress,
} from '../services/dailyBackupService';
import { formatElapsedClock } from '../offline-first/sync/syncFormatters';
import { getConnectivityState } from '../offline-first/sync/ConnectivityMonitor';
import { getFirebaseAuth } from '../config/firebase';
import {
  getSyncManagerState,
  SYNC_AUTH_REQUIRED_MESSAGE,
} from '../offline-first/sync/SyncManager';

type GatePhase =
  | 'checking'
  | 'idle'
  | 'syncing_cloud'
  | 'awaiting_backup'
  | 'backing_up'
  | 'awaiting_download'
  | 'done'
  | 'error';

type Props = {
  children: React.ReactNode;
  enabled?: boolean;
};

type CloudProgressBars = {
  verifyPercent: number;
  verifyLabel: string;
  updatePercent: number;
  updateLabel: string;
};

const INITIAL_CLOUD_BARS: CloudProgressBars = {
  verifyPercent: 0,
  verifyLabel: 'Aguardando verificação…',
  updatePercent: 0,
  updateLabel: 'Aguardando atualização…',
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ModernProgressBar({
  percent,
  label,
  accent,
  trackColor,
  textColor,
  mutedColor,
}: {
  percent: number;
  label: string;
  accent: readonly [string, string];
  trackColor: string;
  textColor: string;
  mutedColor: string;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(percent)));
  return (
    <View style={styles.modernBarBlock}>
      <View style={styles.modernBarTop}>
        <Text style={[styles.modernBarLabel, { color: textColor }]} numberOfLines={2}>
          {label}
        </Text>
        <Text style={[styles.modernBarPct, { color: textColor }]}>{pct}%</Text>
      </View>
      <View style={[styles.modernTrack, { backgroundColor: trackColor }]}>
        <LinearGradient
          colors={[...accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.modernFill, { width: `${pct}%` }]}
        />
        {pct > 0 && pct < 100 ? (
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.modernSheen, { left: `${Math.max(0, pct - 18)}%` }]}
          />
        ) : null}
      </View>
      <Text style={[styles.modernBarHint, { color: mutedColor }]}>
        {pct >= 100 ? 'Concluído' : 'Em andamento'}
      </Text>
    </View>
  );
}

export function DailyBackupGate({ children, enabled = true }: Props) {
  const { theme, isDark } = useTheme();
  const ts = theme.textStyles;
  const t = theme.tokens;
  const { isAuthenticated, authReady } = useAuth();
  const { syncUi, startSyncFromToggle, connectivity } = useCloudSyncState();

  const [phase, setPhase] = useState<GatePhase>('checking');
  const [progress, setProgress] = useState<DailyBackupProgress>({
    percent: 0,
    label: 'Verificando…',
  });
  const [cloudBars, setCloudBars] = useState<CloudProgressBars>(INITIAL_CLOUD_BARS);
  const [prepared, setPrepared] = useState<DailyBackupPrepared | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const syncStartedRef = useRef(false);
  const cancelledRef = useRef(false);

  const blocked = enabled && phase !== 'idle';

  const releaseApp = useCallback(async () => {
    await markDailyBackupComplete();
    setPhase('idle');
    setPrepared(null);
    setError(null);
    setCloudBars(INITIAL_CLOUD_BARS);
    startedAtRef.current = null;
    syncStartedRef.current = false;
  }, []);

  const finishSuccess = useCallback(async () => {
    setProgress({ percent: 100, label: 'Backup concluído' });
    setPhase('done');
    setTimeout(() => {
      void releaseApp();
    }, 1200);
  }, [releaseApp]);

  const runCloudSyncBeforeBackup = useCallback(async (): Promise<void> => {
    setPhase('syncing_cloud');
    setError(null);
    setCloudBars({
      verifyPercent: 8,
      verifyLabel: 'Verificando conexão e sessão…',
      updatePercent: 0,
      updateLabel: 'Aguardando atualizações da nuvem…',
    });
    startedAtRef.current = Date.now();
    syncStartedRef.current = true;

    const online =
      connectivity === 'ONLINE' ||
      getSyncManagerState().syncUi.isOnline ||
      (typeof navigator !== 'undefined' && navigator.onLine !== false) ||
      getConnectivityState() === 'ONLINE';
    const hasSession = Boolean(getFirebaseAuth()?.currentUser) && isAuthenticated;

    if (!authReady || !hasSession || !online) {
      setCloudBars({
        verifyPercent: 100,
        verifyLabel: !online
          ? 'Sem internet — verificação concluída com dados locais'
          : 'Sem sessão na nuvem — verificação concluída com dados locais',
        updatePercent: 100,
        updateLabel: 'Nenhuma atualização baixada (modo local)',
      });
      await wait(450);
      if (!cancelledRef.current) setPhase('awaiting_backup');
      syncStartedRef.current = false;
      return;
    }

    setCloudBars((prev) => ({
      ...prev,
      verifyPercent: 35,
      verifyLabel: 'Consultando atualizações na nuvem…',
    }));

    let result = await startSyncFromToggle();

    // Sync já em andamento (ex.: auto-sync ao abrir) — aguarda terminar.
    if (!result.ok && result.error === 'sync_in_progress') {
      setCloudBars((prev) => ({
        ...prev,
        verifyPercent: 55,
        verifyLabel: 'Sincronização já em andamento — aguardando…',
      }));
      const deadline = Date.now() + 180_000;
      while (Date.now() < deadline && !cancelledRef.current) {
        await wait(300);
        if (!getSyncManagerState().syncUi.isSyncing) break;
      }
      if (!cancelledRef.current && !getSyncManagerState().syncUi.isSyncing) {
        result = await startSyncFromToggle();
        if (!result.ok && result.error === 'sync_in_progress') {
          result = { ok: true };
        }
      } else if (!cancelledRef.current) {
        // Timeout ainda sincronizando — segue para não travar o backup.
        result = { ok: true };
      }
    }

    if (cancelledRef.current) return;

    if (!result.ok) {
      const msg = result.error?.trim() || 'Não foi possível sincronizar com a nuvem.';
      if (msg === SYNC_AUTH_REQUIRED_MESSAGE || msg.toLowerCase().includes('sessão')) {
        setCloudBars({
          verifyPercent: 100,
          verifyLabel: 'Sessão indisponível — seguindo com dados locais',
          updatePercent: 100,
          updateLabel: 'Atualização na nuvem ignorada',
        });
        await wait(400);
        if (!cancelledRef.current) setPhase('awaiting_backup');
        syncStartedRef.current = false;
        return;
      }
      if (msg.toLowerCase().includes('offline') || msg.toLowerCase().includes('internet')) {
        setCloudBars({
          verifyPercent: 100,
          verifyLabel: 'Sem conexão — verificação local concluída',
          updatePercent: 100,
          updateLabel: 'Atualização adiada (offline)',
        });
        await wait(400);
        if (!cancelledRef.current) setPhase('awaiting_backup');
        syncStartedRef.current = false;
        return;
      }

      setError(msg);
      setPhase('error');
      syncStartedRef.current = false;
      return;
    }

    const last = getSyncManagerState().syncUi.lastSync;
    setCloudBars({
      verifyPercent: 100,
      verifyLabel: 'Verificação na nuvem concluída',
      updatePercent: 100,
      updateLabel:
        last?.alreadyUpToDate || (last?.downloads === 0 && last?.uploads === 0)
          ? 'Dados já estavam atualizados'
          : 'Atualização da nuvem concluída',
    });
    await wait(350);
    if (!cancelledRef.current) setPhase('awaiting_backup');
    syncStartedRef.current = false;
  }, [authReady, connectivity, isAuthenticated, startSyncFromToggle]);

  // Espelha o progresso real do SyncManager nas barras modernas.
  useEffect(() => {
    if (phase !== 'syncing_cloud' || !syncStartedRef.current) return;

    const direction = syncUi.activeSyncDirection;
    const download = syncUi.downloadProgress;
    const upload = syncUi.uploadProgress;
    const overall = syncUi.syncProgress;

    let verifyPercent = 20;
    let verifyLabel = syncUi.syncMessage || 'Verificando nuvem…';
    let updatePercent = 0;
    let updateLabel = 'Aguardando atualizações…';

    if (direction === 'preparing' || syncUi.phase === 'preparing') {
      verifyPercent = Math.max(15, Math.min(95, overall.percent || 40));
      verifyLabel = overall.message || syncUi.syncMessage || 'Comparando local × nuvem…';
      updatePercent = 0;
      updateLabel = 'Fila de atualização em preparação…';
    } else if (direction === 'download' || download.total > 0 || download.percent > 0) {
      verifyPercent = 100;
      verifyLabel = 'Verificação concluída';
      updatePercent = Math.max(download.percent, overall.percent * 0.85);
      updateLabel =
        download.message ||
        syncUi.syncMessage ||
        (download.total > 0
          ? `Baixando ${download.processed}/${download.total}…`
          : 'Baixando atualizações da nuvem…');
    } else if (direction === 'upload' || upload.total > 0 || upload.percent > 0) {
      verifyPercent = 100;
      verifyLabel = 'Verificação concluída';
      // Upload também atualiza o estado remoto; mostra na barra de atualização.
      updatePercent = Math.max(55, upload.percent);
      updateLabel =
        upload.message || syncUi.syncMessage || 'Enviando alterações locais…';
    } else if (direction === 'finalize' || syncUi.phase === 'success' || syncUi.phase === 'already_up_to_date') {
      verifyPercent = 100;
      verifyLabel = 'Verificação concluída';
      updatePercent = 100;
      updateLabel =
        syncUi.phase === 'already_up_to_date'
          ? 'Nada novo na nuvem'
          : syncUi.syncMessage || 'Atualização finalizada';
    } else if (syncUi.isSyncing) {
      verifyPercent = Math.max(30, Math.min(90, overall.percent || 50));
      verifyLabel = overall.message || syncUi.syncMessage || 'Sincronizando…';
      updatePercent = Math.max(0, Math.min(90, overall.percent - 10));
      updateLabel = 'Processando alterações…';
    }

    setCloudBars({
      verifyPercent,
      verifyLabel,
      updatePercent,
      updateLabel,
    });
  }, [
    phase,
    syncUi.activeSyncDirection,
    syncUi.downloadProgress,
    syncUi.uploadProgress,
    syncUi.syncProgress,
    syncUi.syncMessage,
    syncUi.phase,
    syncUi.isSyncing,
  ]);

  const startBackupFlow = useCallback(async () => {
    setPhase('backing_up');
    setError(null);
    setPrepared(null);
    startedAtRef.current = Date.now();
    setProgress({ percent: 4, label: 'Iniciando backup diário…' });
    try {
      if (Platform.OS === 'web') {
        const result = await prepareDailySystemBackup(setProgress);
        setPrepared(result);
        setPhase('awaiting_download');
        return;
      }

      await runDailySystemBackup(setProgress);
      await finishSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível gerar o backup diário.');
      setPhase('error');
    }
  }, [finishSuccess]);

  const confirmDownload = useCallback(async () => {
    if (!prepared) return;
    setPhase('backing_up');
    setProgress({ percent: 96, label: 'Baixando arquivo…' });
    setError(null);
    try {
      await downloadPreparedDailyBackup(prepared);
      await finishSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível baixar o backup.');
      setPhase('awaiting_download');
    }
  }, [prepared, finishSuccess]);

  const retryFromError = useCallback(() => {
    setError(null);
    void runCloudSyncBeforeBackup();
  }, [runCloudSyncBeforeBackup]);

  const bootStartedRef = useRef(false);
  const runCloudSyncRef = useRef(runCloudSyncBeforeBackup);
  runCloudSyncRef.current = runCloudSyncBeforeBackup;

  useEffect(() => {
    if (!enabled) {
      setPhase('idle');
      bootStartedRef.current = false;
      return;
    }
    if (bootStartedRef.current) return;
    if (!authReady) return;
    bootStartedRef.current = true;
    cancelledRef.current = false;

    void (async () => {
      setPhase('checking');
      try {
        const required = await isDailyBackupRequired();
        if (cancelledRef.current) return;
        if (!required) {
          setPhase('idle');
          return;
        }

        await runCloudSyncRef.current();
      } catch (e) {
        if (cancelledRef.current) return;
        setError(e instanceof Error ? e.message : 'Não foi possível iniciar o fluxo diário.');
        setPhase('error');
      }
    })();
  }, [enabled, authReady]);

  useEffect(() => {
    if (!blocked || phase === 'done') return;
    const timer = setInterval(() => {
      if (startedAtRef.current != null) {
        setElapsedMs(Date.now() - startedAtRef.current);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [blocked, phase]);

  const modalVisible = enabled && phase !== 'idle';
  const percent = useMemo(() => {
    if (phase === 'done') return 100;
    if (phase === 'syncing_cloud') {
      return Math.round(cloudBars.verifyPercent * 0.45 + cloudBars.updatePercent * 0.55);
    }
    if (phase === 'awaiting_backup') return 100;
    return progress.percent;
  }, [phase, cloudBars, progress.percent]);

  const title = useMemo(() => {
    if (phase === 'done') return 'Sistema liberado';
    if (phase === 'syncing_cloud') return 'Atualizando com a nuvem';
    if (phase === 'awaiting_backup') return 'Pronto para o backup';
    if (phase === 'awaiting_download') return 'Backup pronto';
    if (phase === 'backing_up') return 'Gerando backup do dia';
    return 'Backup automático do dia';
  }, [phase]);

  const subtitle = useMemo(() => {
    if (phase === 'checking') return 'Verificando se o backup de hoje já foi realizado…';
    if (phase === 'syncing_cloud') {
      return 'Antes do backup, o AppTAF confere e baixa atualizações da nuvem automaticamente.';
    }
    if (phase === 'awaiting_backup') {
      return 'Dados locais atualizados. Toque para gerar e baixar o backup diário obrigatório.';
    }
    if (phase === 'awaiting_download') {
      return 'Baixe o arquivo para liberar o uso do AppTAF hoje.';
    }
    if (phase === 'done') return 'Seus dados foram salvos. Você já pode continuar.';
    if (phase === 'backing_up') return 'Coletando e gerando CSV, planilha e PDF…';
    return 'O AppTAF só é liberado após o backup diário de todos os dados.';
  }, [phase]);

  return (
    <>
      <View style={styles.childWrap} pointerEvents={blocked ? 'none' : 'auto'}>
        {children}
      </View>

      <AppModal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => undefined}
        accessibilityViewIsModal
      >
        <View style={styles.modalRoot}>
          <Pressable style={[styles.overlay, { backgroundColor: t.overlayBg }]}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={28} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            ) : null}
          </Pressable>

          <View style={styles.center} pointerEvents="box-none">
            <View
              style={[
                styles.shell,
                { backgroundColor: theme.surface, borderColor: theme.border },
                Platform.OS === 'web' ? ({ boxShadow: t.shadowModal } as object) : { elevation: 20 },
              ]}
            >
              <LinearGradient
                colors={
                  phase === 'syncing_cloud'
                    ? ['#0891b2', '#2563eb', '#6366f1']
                    : ['#2563eb', '#6366f1', '#38bdf8']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.headerStripe}
              />

              <View style={styles.header}>
                <View style={styles.iconOrb}>
                  <LinearGradient
                    colors={
                      phase === 'syncing_cloud'
                        ? ['rgba(56,189,248,0.45)', 'rgba(14,165,233,0.4)']
                        : ['rgba(56,189,248,0.35)', 'rgba(99,102,241,0.45)']
                    }
                    style={styles.iconOrbInner}
                  >
                    {phase === 'done' ? (
                      <ShieldCheck size={28} color="#FFFFFF" strokeWidth={2.2} />
                    ) : phase === 'syncing_cloud' ? (
                      <CloudDownload size={28} color="#FFFFFF" strokeWidth={2.2} />
                    ) : phase === 'awaiting_backup' ? (
                      <Cloud size={28} color="#FFFFFF" strokeWidth={2.2} />
                    ) : (
                      <Database size={28} color="#FFFFFF" strokeWidth={2.2} />
                    )}
                  </LinearGradient>
                </View>
                <View style={styles.headerText}>
                  <View style={styles.kickerRow}>
                    <Sparkles size={14} color={theme.primary} strokeWidth={2.2} />
                    <Text style={[styles.kicker, { color: theme.primary }]}>PROTEÇÃO DIÁRIA</Text>
                  </View>
                  <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
                  <Text style={[ts.caption, styles.subtitle, { color: theme.textSecondary }]}>
                    {subtitle}
                  </Text>
                </View>
              </View>

              <View style={styles.body}>
                {phase === 'syncing_cloud' || phase === 'awaiting_backup' ? (
                  <View
                    style={[
                      styles.progressCard,
                      {
                        backgroundColor: isDark ? 'rgba(15,23,42,0.55)' : 'rgba(248,250,252,0.95)',
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <View style={styles.progressTop}>
                      <Text style={[styles.percent, { color: theme.text }]}>{percent}%</Text>
                      <Text style={[ts.caption, { color: theme.textMuted }]}>
                        {startedAtRef.current ? formatElapsedClock(elapsedMs) : '—'}
                      </Text>
                    </View>

                    <ModernProgressBar
                      percent={cloudBars.verifyPercent}
                      label={cloudBars.verifyLabel}
                      accent={['#0891b2', '#38bdf8']}
                      trackColor={isDark ? 'rgba(148,163,184,0.22)' : 'rgba(148,163,184,0.28)'}
                      textColor={theme.text}
                      mutedColor={theme.textMuted}
                    />
                    <ModernProgressBar
                      percent={cloudBars.updatePercent}
                      label={cloudBars.updateLabel}
                      accent={['#2563eb', '#6366f1']}
                      trackColor={isDark ? 'rgba(148,163,184,0.22)' : 'rgba(148,163,184,0.28)'}
                      textColor={theme.text}
                      mutedColor={theme.textMuted}
                    />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.progressCard,
                      { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
                    ]}
                  >
                    <View style={styles.progressTop}>
                      <Text style={[styles.percent, { color: theme.text }]}>{percent}%</Text>
                      <Text style={[ts.caption, { color: theme.textMuted }]}>
                        {startedAtRef.current ? formatElapsedClock(elapsedMs) : '—'}
                      </Text>
                    </View>
                    <View style={[styles.track, { backgroundColor: theme.border }]}>
                      <LinearGradient
                        colors={phase === 'done' ? ['#059669', '#14b8a6'] : ['#2563eb', '#38bdf8']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.fill, { width: `${percent}%` }]}
                      />
                    </View>
                    <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>
                      {progress.label}
                    </Text>
                    {prepared ? (
                      <Text style={[ts.caption, styles.filename, { color: theme.textMuted }]}>
                        Arquivos: {prepared.filename} + {prepared.filenameOds} +{' '}
                        {prepared.filenamePdf}
                      </Text>
                    ) : null}
                  </View>
                )}

                {prepared && phase !== 'done' ? (
                  <View style={styles.statsWrap}>
                    <View style={[styles.statsRow, { borderColor: theme.border }]}>
                      <View style={styles.stat}>
                        <Text style={[styles.statN, { color: theme.text }]}>
                          {prepared.cadastros.toLocaleString('pt-BR')}
                        </Text>
                        <Text style={[ts.caption, { color: theme.textMuted }]}>Cadastros</Text>
                      </View>
                      <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                      <View style={styles.stat}>
                        <Text style={[styles.statN, { color: theme.text }]}>
                          {prepared.sessoes.toLocaleString('pt-BR')}
                        </Text>
                        <Text style={[ts.caption, { color: theme.textMuted }]}>Sessões TAF</Text>
                      </View>
                    </View>
                    <View style={[styles.statsRow, { borderColor: theme.border }]}>
                      <View style={styles.stat}>
                        <Text style={[styles.statN, { color: theme.text }]}>
                          {prepared.aplicadores.toLocaleString('pt-BR')}
                        </Text>
                        <Text style={[ts.caption, { color: theme.textMuted }]}>Aplicadores</Text>
                      </View>
                      <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                      <View style={styles.stat}>
                        <Text style={[styles.statN, { color: theme.text }]}>
                          {prepared.preCadastros.toLocaleString('pt-BR')}
                        </Text>
                        <Text style={[ts.caption, { color: theme.textMuted }]}>Pré-cadastros</Text>
                      </View>
                    </View>
                  </View>
                ) : null}

                {phase === 'backing_up' || phase === 'checking' || phase === 'syncing_cloud' ? (
                  <View style={styles.workingRow}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={[ts.caption, { color: theme.textSecondary, flex: 1 }]}>
                      {phase === 'syncing_cloud'
                        ? 'Não feche o aplicativo durante a atualização com a nuvem.'
                        : 'Não feche o aplicativo até concluir o backup diário.'}
                    </Text>
                  </View>
                ) : null}

                {error ? <Text style={[styles.error, { color: theme.error }]}>{error}</Text> : null}
              </View>

              <View style={styles.footer}>
                {phase === 'awaiting_backup' ? (
                  <PressableScale onPress={() => void startBackupFlow()} style={styles.btnWrap}>
                    <LinearGradient
                      colors={[...t.gradientPrimaryBtn]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.btnPrimary}
                    >
                      <Database size={18} color="#FFFFFF" strokeWidth={2.4} />
                      <Text style={styles.btnPrimaryText}>Iniciar backup diário</Text>
                    </LinearGradient>
                  </PressableScale>
                ) : null}

                {phase === 'awaiting_download' ? (
                  <PressableScale onPress={() => void confirmDownload()} style={styles.btnWrap}>
                    <LinearGradient
                      colors={[...t.gradientPrimaryBtn]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.btnPrimary}
                    >
                      <Download size={18} color="#FFFFFF" strokeWidth={2.4} />
                      <Text style={styles.btnPrimaryText}>
                        Baixar CSV + planilha + PDF e continuar
                      </Text>
                    </LinearGradient>
                  </PressableScale>
                ) : null}

                {phase === 'error' ? (
                  <PressableScale
                    onPress={retryFromError}
                    style={[styles.btnRetry, { borderColor: theme.border }]}
                  >
                    <Text style={[styles.btnRetryText, { color: theme.text }]}>
                      Tentar novamente
                    </Text>
                  </PressableScale>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      </AppModal>
    </>
  );
}

const styles = StyleSheet.create({
  childWrap: { flex: 1 },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  center: {
    width: '100%',
    maxWidth: 520,
    paddingHorizontal: 20,
  },
  shell: {
    borderRadius: PREMIUM.radiusLg + 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerStripe: {
    height: 5,
    width: '100%',
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 8,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  iconOrb: {
    width: 56,
    height: 56,
    borderRadius: 18,
    overflow: 'hidden',
  },
  iconOrbInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 4 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  subtitle: { lineHeight: 18, marginTop: 2 },
  body: {
    paddingHorizontal: 22,
    paddingBottom: 8,
    gap: 14,
  },
  progressCard: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd + 2,
    padding: 14,
    gap: 12,
  },
  progressTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  percent: {
    fontSize: 30,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  filename: { lineHeight: 18 },
  modernBarBlock: { gap: 6 },
  modernBarTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  modernBarLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  modernBarPct: {
    fontSize: 15,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  modernTrack: {
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
    position: 'relative',
  },
  modernFill: {
    height: '100%',
    borderRadius: 999,
  },
  modernSheen: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 48,
  },
  modernBarHint: {
    fontSize: 11,
    fontWeight: '600',
  },
  statsWrap: { gap: 8 },
  statsRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    overflow: 'hidden',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 2,
  },
  statN: {
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
  },
  workingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 22,
    paddingBottom: 22,
    paddingTop: 6,
    gap: 10,
  },
  btnWrap: {
    borderRadius: PREMIUM.radiusMd,
    overflow: 'hidden',
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: PREMIUM.radiusMd,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  btnRetry: {
    paddingVertical: 13,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
  },
  btnRetryText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
