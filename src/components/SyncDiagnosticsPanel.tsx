import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useDataStoreState } from '../offline-first/store/DataStoreContext';
import { syncLogger } from '../offline-first/sync/SyncLogger';
import { getCloudActivityState } from '../services/offline/cloudSyncActivity';
import type { SyncLogEntry } from '../offline-first/types';

export function SyncDiagnosticsPanel() {
  const { theme } = useTheme();
  const { connectivity, pendingCount, forceSync } = useDataStoreState();
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const activity = getCloudActivityState();

  const reload = useCallback(async () => {
    setLogs(await syncLogger.recentLogs(80));
  }, []);

  useEffect(() => {
    void reload();
    const timer = setInterval(() => void reload(), 4000);
    return () => clearInterval(timer);
  }, [reload]);

  const onForceSync = async () => {
    setSyncing(true);
    try {
      await forceSync();
      await reload();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: theme.text }]}>Diagnóstico de sincronização</Text>
      <Text style={[styles.meta, { color: theme.textMuted }]}>
        Conectividade: {connectivity} · Fila: {pendingCount} · Nuvem pronta:{' '}
        {activity.cloudReady ? 'sim' : 'não'} · Tempo real:{' '}
        {activity.realtimeListening ? 'ativo' : 'inativo'}
      </Text>
      <Pressable
        onPress={() => void onForceSync()}
        style={[styles.btn, { backgroundColor: theme.primary, opacity: syncing ? 0.6 : 1 }]}
        disabled={syncing}
      >
        <Text style={styles.btnText}>{syncing ? 'Sincronizando…' : 'Forçar sincronização'}</Text>
      </Pressable>
      <ScrollView style={styles.logBox} nestedScrollEnabled>
        {logs.map((log, i) => (
          <Text
            key={`${log.timestamp}-${i}`}
            style={[
              styles.logLine,
              {
                color:
                  log.level === 'error'
                    ? theme.loss
                    : log.level === 'warn'
                      ? theme.text
                      : theme.textMuted,
              },
            ]}
          >
            [{new Date(log.timestamp).toLocaleTimeString('pt-BR')}] {log.category}: {log.message}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 8 },
  title: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, lineHeight: 18 },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, alignSelf: 'flex-start' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  logBox: { maxHeight: 220, marginTop: 4 },
  logLine: { fontSize: 11, lineHeight: 16, marginBottom: 4 },
});
