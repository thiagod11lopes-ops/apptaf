import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { Database, Download, ShieldCheck, Sparkles } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
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

type GatePhase =
  | 'checking'
  | 'idle'
  | 'backing_up'
  | 'awaiting_download'
  | 'done'
  | 'error';

type Props = {
  children: React.ReactNode;
  enabled?: boolean;
};

export function DailyBackupGate({ children, enabled = true }: Props) {
  const { theme, isDark } = useTheme();
  const ts = theme.textStyles;
  const t = theme.tokens;

  const [phase, setPhase] = useState<GatePhase>('checking');
  const [progress, setProgress] = useState<DailyBackupProgress>({ percent: 0, label: 'Verificando…' });
  const [prepared, setPrepared] = useState<DailyBackupPrepared | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  const blocked = enabled && phase !== 'idle';

  const releaseApp = useCallback(async () => {
    await markDailyBackupComplete();
    setPhase('idle');
    setPrepared(null);
    setError(null);
    startedAtRef.current = null;
  }, []);

  const finishSuccess = useCallback(async () => {
    setProgress({ percent: 100, label: 'Backup concluído' });
    setPhase('done');
    setTimeout(() => {
      void releaseApp();
    }, 1200);
  }, [releaseApp]);

  const startBackupFlow = useCallback(async () => {
    setPhase('backing_up');
    setError(null);
    startedAtRef.current = Date.now();
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

  useEffect(() => {
    if (!enabled) {
      setPhase('idle');
      return;
    }

    let cancelled = false;

    void (async () => {
      setPhase('checking');
      try {
        const required = await isDailyBackupRequired();
        if (cancelled) return;
        if (!required) {
          setPhase('idle');
          return;
        }

        setPhase('backing_up');
        setError(null);
        startedAtRef.current = Date.now();

        if (Platform.OS === 'web') {
          const result = await prepareDailySystemBackup(setProgress);
          if (cancelled) return;
          setPrepared(result);
          setPhase('awaiting_download');
          return;
        }

        await runDailySystemBackup(setProgress);
        if (cancelled) return;
        setProgress({ percent: 100, label: 'Backup concluído' });
        setPhase('done');
        setTimeout(() => {
          void releaseApp();
        }, 1200);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Não foi possível gerar o backup diário.');
        setPhase('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, releaseApp]);

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
  const percent = phase === 'done' ? 100 : progress.percent;

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
                colors={['#2563eb', '#6366f1', '#38bdf8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.headerStripe}
              />

              <View style={styles.header}>
                <View style={styles.iconOrb}>
                  <LinearGradient
                    colors={['rgba(56,189,248,0.35)', 'rgba(99,102,241,0.45)']}
                    style={styles.iconOrbInner}
                  >
                    {phase === 'done' ? (
                      <ShieldCheck size={28} color="#FFFFFF" strokeWidth={2.2} />
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
                  <Text style={[styles.title, { color: theme.text }]}>
                    {phase === 'done'
                      ? 'Sistema liberado'
                      : phase === 'awaiting_download'
                        ? 'Backup pronto'
                        : 'Backup automático do dia'}
                  </Text>
                  <Text style={[ts.caption, styles.subtitle, { color: theme.textSecondary }]}>
                    {phase === 'checking'
                      ? 'Verificando se o backup de hoje já foi realizado…'
                      : phase === 'awaiting_download'
                        ? 'Baixe o arquivo para liberar o uso do AppTAF hoje.'
                        : phase === 'done'
                          ? 'Seus dados foram salvos. Você já pode continuar.'
                          : 'O AppTAF só é liberado após o backup diário de todos os dados.'}
                  </Text>
                </View>
              </View>

              <View style={styles.body}>
                <View style={[styles.progressCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
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
                  <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>{progress.label}</Text>
                  {prepared ? (
                    <Text style={[ts.caption, styles.filename, { color: theme.textMuted }]}>
                      Arquivo: {prepared.filename}
                    </Text>
                  ) : null}
                </View>

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

                {phase === 'backing_up' || phase === 'checking' ? (
                  <View style={styles.workingRow}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={[ts.caption, { color: theme.textSecondary, flex: 1 }]}>
                      Não feche o aplicativo até concluir o backup diário.
                    </Text>
                  </View>
                ) : null}

                {error ? <Text style={[styles.error, { color: theme.error }]}>{error}</Text> : null}
              </View>

              <View style={styles.footer}>
                {phase === 'awaiting_download' ? (
                  <PressableScale onPress={() => void confirmDownload()} style={styles.btnWrap}>
                    <LinearGradient
                      colors={[...t.gradientPrimaryBtn]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.btnPrimary}
                    >
                      <Download size={18} color="#FFFFFF" strokeWidth={2.4} />
                      <Text style={styles.btnPrimaryText}>Baixar backup e continuar</Text>
                    </LinearGradient>
                  </PressableScale>
                ) : null}

                {phase === 'error' ? (
                  <PressableScale
                    onPress={() => void startBackupFlow()}
                    style={[styles.btnRetry, { borderColor: theme.border }]}
                  >
                    <Text style={[styles.btnRetryText, { color: theme.text }]}>Tentar novamente</Text>
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
    gap: 8,
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
