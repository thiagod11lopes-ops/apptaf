import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { CloudSync } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useOfflineSyncState } from '../contexts/OfflineSyncContext';
import { GoogleSignInButton } from './auth/GoogleSignInButton';
import { PressableScale } from './premium/PressableScale';
import { waitForAuthenticatedUid } from '../services/firebase/authUid';
import { syncManager } from '../offline-first/sync/SyncManager';

export function OnlineModeBlock() {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const t = theme.tokens;
  const { isAuthenticated, firebaseEnabled, signInWithGoogle } = useAuth();
  const { appMode, enterOnlineMode, pendingCount } = useOfflineSyncState();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleIniciarSync = useCallback(async () => {
    if (!firebaseEnabled) {
      setErro('Configure o Firebase no .env antes de usar a sincronização.');
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      if (!isAuthenticated) {
        const redirect = await signInWithGoogle();
        if (redirect) return;
        await waitForAuthenticatedUid(20_000);
      }
      const result = await enterOnlineMode();
      if (!result.ok && result.error) {
        setErro(result.error);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível iniciar a sincronização.');
    } finally {
      setLoading(false);
    }
  }, [enterOnlineMode, firebaseEnabled, isAuthenticated, signInWithGoogle]);

  return (
    <View style={styles.wrap}>
      <Text style={[ts.caption, styles.hint, { color: theme.textSecondary }]}>
        O sistema funciona 100% offline. Use o assistente de sincronização apenas quando quiser enviar
        ou receber dados da nuvem.
      </Text>

      <View style={[styles.statusPill, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
        <Text style={[ts.caption, { color: theme.text, fontWeight: '700' }]}>
          Modo atual: {appMode === 'OFFLINE' ? 'Offline' : 'Sincronizando'}
        </Text>
        {pendingCount > 0 ? (
          <Text style={[ts.caption, { color: theme.textSecondary, marginTop: 4 }]}>
            {pendingCount} alteração(ões) local(is) aguardando sync
          </Text>
        ) : null}
      </View>

      {!isAuthenticated ? (
        <GoogleSignInButton onSuccess={() => setErro(null)} />
      ) : null}

      <PressableScale onPress={() => void handleIniciarSync()} disabled={loading} style={styles.btnOuter}>
        <LinearGradient
          colors={[...t.gradientPrimaryBtn]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btn}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <CloudSync size={18} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.btnText}>Assistente de sincronização</Text>
            </>
          )}
        </LinearGradient>
      </PressableScale>

      {erro ? (
        <Text style={[ts.caption, { color: theme.loss, lineHeight: 18 }]}>{erro}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14, marginTop: 8 },
  hint: { lineHeight: 18 },
  statusPill: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  btnOuter: { borderRadius: 12, overflow: 'hidden' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
