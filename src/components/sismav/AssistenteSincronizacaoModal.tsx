import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { CloudSync } from 'lucide-react-native';
import { ModernModal } from './ModernModal';
import { useTheme } from '../../contexts/ThemeContext';
import type { SyncAssistantProgress } from '../../offline-first/sync/syncAssistantSteps';

const STEP_LABELS: Record<string, string> = {
  CONNECTING: 'Conectando',
  LOGIN: 'Login Google',
  VALIDATING: 'Validando permissões',
  BACKUP: 'Backup local',
  CLOCK_CHECK: 'Verificando relógio',
  COMPARING: 'Comparando dados',
  REPORT: 'Relatório',
  SYNCING: 'Sincronizando',
  AUDIT: 'Auditoria',
  DONE: 'Concluído',
};

type Props = {
  visible: boolean;
  progress: SyncAssistantProgress | null;
  clockDriftWarning?: string | null;
};

export function AssistenteSincronizacaoModal({ visible, progress, clockDriftWarning }: Props) {
  const { theme } = useTheme();

  if (!visible || !progress) return null;

  const pct = Math.round((progress.stepIndex / progress.totalSteps) * 100);
  const stepLabel = STEP_LABELS[progress.step] ?? progress.step;

  return (
    <ModernModal
      visible={visible}
      onClose={() => {}}
      title="Assistente de sincronização"
      icon={<CloudSync size={20} color="#FFFFFF" strokeWidth={2.2} />}
    >
      <View style={styles.body}>
        <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${pct}%`, backgroundColor: theme.primary },
            ]}
          />
        </View>

        <Text style={[styles.stepMeta, { color: theme.textMuted }]}>
          Etapa {progress.stepIndex} de {progress.totalSteps} · {stepLabel}
        </Text>

        <View style={styles.row}>
          <ActivityIndicator color={theme.primary} size="small" />
          <Text style={[styles.message, { color: theme.text }]}>{progress.message}</Text>
        </View>

        {clockDriftWarning ? (
          <View style={[styles.warnBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.primary }]}>
            <Text style={[styles.warnText, { color: theme.text }]}>{clockDriftWarning}</Text>
          </View>
        ) : null}
      </View>
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  stepMeta: {
    fontSize: 12,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  warnBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  warnText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
});
