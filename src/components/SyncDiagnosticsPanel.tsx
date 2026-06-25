import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useOfflineSyncState } from '../contexts/OfflineSyncContext';
import { syncLogger } from '../offline-first/sync/SyncLogger';
import { getCloudActivityState } from '../services/offline/cloudSyncActivity';
import { SYSTEM_STATE } from '../offline-first/sync/SystemState';
import type { SyncLogEntry } from '../offline-first/types';

export function SyncDiagnosticsPanel() {
  const { theme } = useTheme();
  const {
    connectivity,
    pendingCount,
    systemMode,
    isForcedOffline,
    tryReturnToOnline,
  } = useOfflineSyncState();
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

  const onReturnOnline = async () => {
    setSyncing(true);
    try {
      await tryReturnToOnline();
      await reload();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: theme.text }]}>Diagnóstico de sincronização</Text>
      <Text style={[styles.meta, { color: theme.textMuted }]}>
        Modo: {systemMode === SYSTEM_STATE.FORCED_OFFLINE ? 'OFFLINE controlado' : 'ONLINE ativo'} ·
        Conectividade: {connectivity} · Pendentes: {pendingCount} · Nuvem pronta:{' '}
        {activity.cloudReady ? 'sim' : 'não'} · Tempo real:{' '}
        {activity.realtimeListening ? 'ativo' : 'inativo'}
      </Text>
      {isForcedOffline ? (
        <Pressable
          onPress={() => void onReturnOnline()}
          style={[styles.btn, { backgroundColor: theme.primary, opacity: syncing ? 0.6 : 1 }]}
          disabled={syncing}
        >
          <Text style={styles.btnText}>
            {syncing ? 'Verificando…' : 'Voltar ao modo online'}
          </Text>
        </Pressable>
      ) : null}
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
  logBox: { maxHeight: 200, marginTop: 4 },
  logLine: { fontSize: 11, lineHeight: 16, marginBottom: 4 },
});
