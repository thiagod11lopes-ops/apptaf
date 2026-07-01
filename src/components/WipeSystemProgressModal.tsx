import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Cloud, CloudOff, CheckCircle2, Trash2 } from 'lucide-react-native';
import { ModernModal } from './sismav/ModernModal';
import { PressableScale } from './premium/PressableScale';
import { useTheme } from '../contexts/ThemeContext';
import { formatElapsedClock } from '../offline-first/sync/syncFormatters';
import type { WipeProgressUpdate } from '../services/wipeSystemData';
import { PREMIUM } from '../theme/premium';

type Props = {
  visible: boolean;
  progress: WipeProgressUpdate | null;
  done: boolean;
  error: string | null;
  successMessage: string | null;
  onClose: () => void;
};

function cloudStatusLabel(progress: WipeProgressUpdate | null, done: boolean, error: string | null): string {
  if (error) return 'Falha na exclusão';
  if (done) return 'Nuvem e dispositivo limpos';
  if (!progress) return 'Iniciando…';
  if (!progress.cloudEnabled) return 'Somente dados locais';
  if (progress.phase === 'cloud_connecting') return 'Conectando à nuvem…';
  if (progress.cloudConnected) return 'Conectado · excluindo na nuvem';
  return 'Aguardando conexão…';
}

export function WipeSystemProgressModal({
  visible,
  progress,
  done,
  error,
  successMessage,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const [displayElapsed, setDisplayElapsed] = useState(0);

  useEffect(() => {
    if (!visible || done || error) {
      if (progress?.elapsedMs != null) setDisplayElapsed(progress.elapsedMs);
      return;
    }
    setDisplayElapsed(progress?.elapsedMs ?? 0);
    const timer = setInterval(() => {
      setDisplayElapsed((prev) => prev + 250);
    }, 250);
    return () => clearInterval(timer);
  }, [visible, done, error, progress?.elapsedMs]);

  const percent = done ? 100 : progress?.percent ?? 0;
  const dismissable = done || !!error;
  const cloudEnabled = progress?.cloudEnabled ?? false;
  const cloudConnected = progress?.cloudConnected ?? false;

  const footer =
    dismissable ? (
      <PressableScale
        onPress={onClose}
        style={[styles.btnClose, { backgroundColor: theme.primary }]}
      >
        <Text style={styles.btnCloseText}>{error ? 'Fechar' : 'Concluído'}</Text>
      </PressableScale>
    ) : undefined;

  return (
    <ModernModal
      visible={visible}
      onClose={onClose}
      title={error ? 'Erro na exclusão' : done ? 'Exclusão concluída' : 'Excluindo todos os dados'}
      icon={
        error ? (
          <Trash2 size={20} color="#FFFFFF" strokeWidth={2.2} />
        ) : done ? (
          <CheckCircle2 size={20} color="#FFFFFF" strokeWidth={2.2} />
        ) : (
          <Trash2 size={20} color="#FFFFFF" strokeWidth={2.2} />
        )
      }
      dismissable={dismissable}
      footer={footer}
      maxBodyHeight={480}
    >
      <View style={styles.body}>
        <View style={[styles.cloudRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          {cloudEnabled ? (
            cloudConnected || done ? (
              <Cloud size={22} color={theme.success} strokeWidth={2.2} />
            ) : (
              <ActivityIndicator size="small" color={theme.primary} />
            )
          ) : (
            <CloudOff size={22} color={theme.textSecondary} strokeWidth={2.2} />
          )}
          <View style={styles.cloudText}>
            <Text style={[styles.cloudTitle, { color: theme.text }]}>
              {cloudEnabled ? 'Nuvem Firebase' : 'Sem nuvem'}
            </Text>
            <Text style={[ts.caption, { color: theme.textSecondary }]}>
              {cloudStatusLabel(progress, done, error)}
            </Text>
          </View>
        </View>

        <View style={styles.progressBlock}>
          <View style={styles.progressHeader}>
            <Text style={[styles.percent, { color: theme.text }]}>{percent}%</Text>
            <Text style={[ts.caption, { color: theme.textSecondary }]}>
              {formatElapsedClock(displayElapsed)}
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: theme.border }]}>
            <View
              style={[
                styles.fill,
                {
                  width: `${percent}%`,
                  backgroundColor: error ? theme.error : done ? theme.success : theme.loss,
                },
                Platform.OS === 'web'
                  ? ({ transition: 'width 0.25s ease-out' } as object)
                  : undefined,
              ]}
            />
          </View>
          {!done && !error ? (
            <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>
              {progress?.label ?? 'Preparando…'}
            </Text>
          ) : null}
          {!done && !error && progress?.detail ? (
            <Text style={[ts.caption, styles.detail, { color: theme.textSecondary }]}>
              {progress.detail}
            </Text>
          ) : null}
        </View>

        {!done && !error ? (
          <View style={styles.workingRow}>
            <ActivityIndicator size="small" color={theme.loss} />
            <Text style={[ts.caption, { color: theme.textSecondary, flex: 1 }]}>
              Não feche o aplicativo até concluir. A sincronização está pausada durante a exclusão.
            </Text>
          </View>
        ) : null}

        {error ? (
          <Text style={[styles.feedback, { color: theme.error }]}>{error}</Text>
        ) : null}

        {done && successMessage ? (
          <Text style={[styles.feedback, { color: theme.success }]}>{successMessage}</Text>
        ) : null}
      </View>
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16 },
  cloudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
  },
  cloudText: { flex: 1, gap: 2 },
  cloudTitle: { fontSize: 15, fontWeight: '800' },
  progressBlock: { gap: 8 },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  percent: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
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
  detail: { lineHeight: 18 },
  workingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  feedback: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  btnClose: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCloseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
