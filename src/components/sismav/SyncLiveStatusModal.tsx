import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Cloud, CloudOff, Radio, RefreshCw, ShieldCheck } from 'lucide-react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { ModernModal } from './ModernModal';
import { SyncStatusBar } from './SyncStatusBar';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';
import { useOfflineSyncState } from '../../contexts/OfflineSyncContext';
import { useE2eEncryptionStatus } from '../../hooks/useE2eEncryptionStatus';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchLocalCloudCounts,
  formatLocalCloudRatio,
  localCloudAlignment,
  localCloudAlignmentLabel,
  type LocalCloudCountsSnapshot,
} from '../../services/localCloudCounts';

type Props = {
  visible: boolean;
  onClose: () => void;
};

function ratioColor(
  local: number,
  remote: number | null,
  theme: { gain: string; loss: string; tokens: { warning500: string }; textMuted: string },
): string {
  const a = localCloudAlignment(local, remote);
  if (a === 'aligned') return theme.gain;
  if (a === 'ahead' || a === 'behind') return theme.tokens.warning500;
  return theme.textMuted;
}

export function SyncLiveStatusModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const t = theme.tokens;
  const ts = theme.textStyles;
  const { syncUi, connectivity, pendingCount, retrySync } = useOfflineSyncState();
  const { e2eActive } = useE2eEncryptionStatus();
  const { dataOwnerUid } = useAuth();
  const [counts, setCounts] = useState<LocalCloudCountsSnapshot | null>(null);
  const [countsLoading, setCountsLoading] = useState(false);

  const spin = useSharedValue(0);
  useEffect(() => {
    if (!visible || !syncUi.isSyncing) {
      spin.value = 0;
      return;
    }
    spin.value = withRepeat(
      withTiming(360, { duration: 1400, easing: Easing.linear }),
      -1,
      false,
    );
  }, [visible, syncUi.isSyncing, spin]);

  useEffect(() => {
    if (!visible) return;
    const uid = dataOwnerUid?.trim();
    if (!uid) {
      setCounts(null);
      return;
    }
    let cancelled = false;
    setCountsLoading(true);
    void fetchLocalCloudCounts(uid)
      .then((snap) => {
        if (!cancelled) setCounts(snap);
      })
      .catch(() => {
        if (!cancelled) setCounts(null);
      })
      .finally(() => {
        if (!cancelled) setCountsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, dataOwnerUid, syncUi.phase, syncUi.lastSyncAt]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  const uploads = syncUi.counters.pendingUploads ?? pendingCount;
  const downloads = syncUi.counters.pendingDownloads ?? 0;
  const pendingTotal = uploads + (downloads || 0);
  const online = connectivity === 'ONLINE' || syncUi.isOnline;

  const cadAlign = counts
    ? localCloudAlignment(counts.cadastros.local, counts.cadastros.remote)
    : 'unknown';

  const statusTitle = syncUi.isSyncing
    ? 'Sincronizando em segundo plano'
    : syncUi.phase === 'error'
      ? 'Falha na sincronização'
      : syncUi.phase === 'success' || syncUi.phase === 'already_up_to_date'
        ? 'Nuvem atualizada'
        : pendingTotal > 0
          ? 'Atualizações pendentes'
          : cadAlign === 'behind' || cadAlign === 'ahead'
            ? 'Contagem diferente da nuvem'
            : 'Pronto';

  const statusHint = syncUi.isSyncing
    ? syncUi.syncMessage || 'Enviando e recebendo pela fila…'
    : !online
      ? 'Sem internet — as alterações ficam no aparelho até reconectar.'
      : !e2eActive
        ? 'Escudo vermelho: entre com e-mail e senha para liberar a sync automática.'
        : pendingTotal > 0
          ? 'Com internet, a sync roda sozinha. Você pode acompanhar aqui.'
          : counts
            ? `Cadastros: ${localCloudAlignmentLabel(cadAlign)}.`
            : 'Tudo alinhado com a nuvem.';

  const accent = syncUi.phase === 'error' ? theme.loss : syncUi.isSyncing ? theme.primary : theme.gain;

  return (
    <ModernModal
      visible={visible}
      onClose={onClose}
      title="Status da sincronização"
      dismissable
      maxBodyHeight={620}
      icon={
        syncUi.isSyncing ? (
          <Animated.View style={spinStyle}>
            <RefreshCw size={20} color="#FFFFFF" strokeWidth={2.4} />
          </Animated.View>
        ) : online ? (
          <Cloud size={20} color="#FFFFFF" strokeWidth={2.2} />
        ) : (
          <CloudOff size={20} color="#FFFFFF" strokeWidth={2.2} />
        )
      }
      footer={
        <View style={styles.footerRow}>
          {syncUi.phase === 'error' ? (
            <PressableScale onPress={() => void retrySync()} style={styles.btnPrimaryOuter}>
              <LinearGradient
                colors={[...t.gradientPrimaryBtn]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.btnPrimary}
              >
                <Text style={styles.btnPrimaryText}>Tentar novamente</Text>
              </LinearGradient>
            </PressableScale>
          ) : null}
          <PressableScale onPress={onClose} style={[styles.btnGhost, { borderColor: theme.border }]}>
            <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>
              {syncUi.isSyncing ? 'Continuar em segundo plano' : 'Fechar'}
            </Text>
          </PressableScale>
        </View>
      }
    >
      <View style={styles.body}>
        <LinearGradient
          colors={
            theme.isDark
              ? ['rgba(37,99,235,0.28)', 'rgba(15,23,42,0.55)']
              : ['rgba(37,99,235,0.12)', 'rgba(248,250,252,0.95)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.hero,
            { borderColor: accent },
            Platform.OS === 'web'
              ? ({ boxShadow: `0 12px 32px ${accent}33` } as object)
              : { elevation: 6 },
          ]}
        >
          <View style={styles.heroTop}>
            <View style={[styles.liveDot, { backgroundColor: accent }]} />
            <Text style={[styles.heroEyebrow, { color: accent }]}>
              {syncUi.isSyncing ? 'AO VIVO' : online ? 'ONLINE' : 'OFFLINE'}
            </Text>
          </View>
          <Text style={[styles.heroTitle, { color: theme.text }]}>{statusTitle}</Text>
          <Text style={[ts.caption, { color: theme.textSecondary, lineHeight: 20 }]}>{statusHint}</Text>

          <View style={styles.statRow}>
            <View style={[styles.statChip, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Text style={[styles.statValue, { color: theme.text }]}>{uploads}</Text>
              <Text style={[ts.caption, { color: theme.textMuted }]}>enviar</Text>
            </View>
            <View style={[styles.statChip, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {downloads == null ? '—' : downloads}
              </Text>
              <Text style={[ts.caption, { color: theme.textMuted }]}>receber</Text>
            </View>
            <View style={[styles.statChip, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              {e2eActive ? (
                <ShieldCheck size={18} color={theme.gain} strokeWidth={2.4} />
              ) : (
                <Radio size={18} color={theme.loss} strokeWidth={2.4} />
              )}
              <Text style={[ts.caption, { color: theme.textMuted }]}>
                {e2eActive ? 'E2E ok' : 'E2E off'}
              </Text>
            </View>
          </View>

          <View
            style={[styles.mirrorBox, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
          >
            <Text style={[styles.mirrorTitle, { color: theme.textSecondary }]}>Aparelho / nuvem</Text>
            {countsLoading && !counts ? (
              <ActivityIndicator color={theme.primary} size="small" />
            ) : counts ? (
              <>
                <Text
                  style={[
                    styles.mirrorLine,
                    {
                      color: ratioColor(counts.cadastros.local, counts.cadastros.remote, theme),
                    },
                  ]}
                  accessibilityLabel={`Cadastros ${formatLocalCloudRatio(counts.cadastros.local, counts.cadastros.remote)}`}
                >
                  Cadastros{' '}
                  {formatLocalCloudRatio(counts.cadastros.local, counts.cadastros.remote)}
                </Text>
                <Text
                  style={[
                    styles.mirrorSub,
                    {
                      color: ratioColor(counts.sessoes.local, counts.sessoes.remote, theme),
                    },
                  ]}
                >
                  Sessões {formatLocalCloudRatio(counts.sessoes.local, counts.sessoes.remote)}
                  {' · '}
                  Aplicadores{' '}
                  {formatLocalCloudRatio(counts.aplicadores.local, counts.aplicadores.remote)}
                </Text>
              </>
            ) : (
              <Text style={[ts.caption, { color: theme.textMuted }]}>
                Contagem indisponível neste momento.
              </Text>
            )}
          </View>
        </LinearGradient>

        <SyncStatusBar embedded />
      </View>
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14 },
  hero: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  statChip: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  mirrorBox: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  mirrorTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  mirrorLine: {
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  mirrorSub: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
  btnPrimaryOuter: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  btnPrimary: {
    minHeight: 44,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  btnGhost: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
