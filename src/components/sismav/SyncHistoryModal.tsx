import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { History } from 'lucide-react-native';
import { ModernModal } from './ModernModal';
import { useTheme } from '../../contexts/ThemeContext';
import { listSyncAuditHistory } from '../../offline-first/sync/syncAudit';
import { getCachedDataOwnerUid } from '../../services/firebase/authUid';
import type { SyncAuditEntry } from '../../offline-first/types';
import {
  formatAuditDate,
  formatAuditTime,
  formatDurationSeconds,
} from '../../offline-first/sync/syncFormatters';

type Props = {
  visible: boolean;
  onClose: () => void;
};

function resultBadge(result: SyncAuditEntry['result']): { emoji: string; label: string; color: string } {
  if (result === 'SUCCESS') return { emoji: '✅', label: 'SUCCESS', color: '#16a34a' };
  if (result === 'PARTIAL_SUCCESS') return { emoji: '⚠', label: 'PARTIAL SUCCESS', color: '#ca8a04' };
  return { emoji: '⚠', label: 'FAILED', color: '#dc2626' };
}

function HistoryRow({ entry, theme }: { entry: SyncAuditEntry; theme: ReturnType<typeof useTheme>['theme'] }) {
  const ts = theme.textStyles;

  return (
    <View style={[styles.row, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}>
      <View style={styles.rowHeader}>
        <Text style={[ts.body, { color: theme.text, fontWeight: '700' }]}>
          {formatAuditDate(entry.finishedAt)} · {formatAuditTime(entry.finishedAt)}
        </Text>
        <Text style={[styles.badge, { color: resultBadge(entry.result).color }]}>
          {resultBadge(entry.result).emoji} {resultBadge(entry.result).label}
        </Text>
      </View>
      <Text style={[ts.caption, { color: theme.textSecondary }]}>
        {entry.userEmail ?? entry.userId ?? 'Usuário desconhecido'}
      </Text>
      <Text style={[ts.caption, { color: theme.textMuted }]}>Device: {entry.deviceId}</Text>
      <View style={styles.statsRow}>
        <Text style={[ts.caption, styles.stat, { color: theme.text }]}>⬆ {entry.uploads}</Text>
        <Text style={[ts.caption, styles.stat, { color: theme.text }]}>⬇ {entry.downloads}</Text>
        <Text style={[ts.caption, styles.stat, { color: theme.textSecondary }]}>⊘ {entry.ignored}</Text>
        <Text style={[ts.caption, styles.stat, { color: theme.textSecondary }]}>
          ⏱ {formatDurationSeconds(entry.durationMs)}
        </Text>
      </View>
    </View>
  );
}

export function SyncHistoryModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const [entries, setEntries] = useState<SyncAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    const ownerUid = getCachedDataOwnerUid();
    if (!ownerUid) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await listSyncAuditHistory(ownerUid, 10);
      setEntries(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void loadHistory();
  }, [visible, loadHistory]);

  return (
    <ModernModal
      visible={visible}
      onClose={onClose}
      title="Histórico de sincronização"
      icon={<History size={20} color="#FFFFFF" strokeWidth={2.5} />}
    >
      {loading ? (
        <Text style={[ts.body, { color: theme.textSecondary }]}>Carregando…</Text>
      ) : entries.length === 0 ? (
        <Text style={[ts.body, { color: theme.textSecondary }]}>
          Nenhuma sincronização registrada ainda.
        </Text>
      ) : (
        <View style={styles.list}>
          {entries.map((entry) => (
            <HistoryRow key={entry.id ?? `${entry.startedAt}`} entry={entry} theme={theme} />
          ))}
        </View>
      )}
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
    paddingBottom: 8,
  },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  stat: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
