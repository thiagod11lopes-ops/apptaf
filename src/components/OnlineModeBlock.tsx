import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Cloud } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useOfflineSyncState } from '../contexts/OfflineSyncContext';
import { GoogleSignInButton } from './auth/GoogleSignInButton';
import { PressableScale } from './premium/PressableScale';
import {
  resolveMemberAccess,
  registerAuthorizedMemberLogin,
} from '../services/firebase/authorizedEmailsFirestore';
import { setAuthUidState, waitForAuthenticatedUid } from '../services/firebase/authUid';
import { getFirebaseAuth } from '../config/firebase';
import { migrateDeviceDataOnLogin, migrateLegacyToDexie } from '../offline-first/db/migration';
import { applyTeamWipeIfNeeded } from '../services/applyTeamWipeIfNeeded';
import { syncManager } from '../offline-first/sync/SyncManager';
import { mapFirebaseUser } from '../services/firebase/googleAuth';

export function OnlineModeBlock() {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const t = theme.tokens;
  const { isAuthenticated, firebaseEnabled, signInWithGoogle, syncLocalSessionFlags } = useAuth();
  const { appMode, enterOnlineMode, pendingCount } = useOfflineSyncState();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const prepararSessaoNuvem = useCallback(async (): Promise<boolean> => {
    const fbUser = getFirebaseAuth()?.currentUser;
    if (!fbUser) return false;
    const mapped = mapFirebaseUser(fbUser);
    const access = await resolveMemberAccess(mapped.uid, mapped.email);
    if (access.isAuthorizedMember && mapped.email) {
      await registerAuthorizedMemberLogin(access.dataOwnerUid, mapped.email, mapped.uid);
    }
    await applyTeamWipeIfNeeded(access.dataOwnerUid, mapped.uid);
    await migrateDeviceDataOnLogin(access.dataOwnerUid);
    await migrateLegacyToDexie(access.dataOwnerUid);
    setAuthUidState(mapped.uid, access.dataOwnerUid, true);
    syncLocalSessionFlags();
    await syncManager.bindSession(access.dataOwnerUid);
    return true;
  }, [syncLocalSessionFlags]);

  const handleEntrarOnline = useCallback(async () => {
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
      const ok = await prepararSessaoNuvem();
      if (!ok) {
        setErro('Faça login com Google antes de sincronizar.');
        return;
      }
      const result = await enterOnlineMode();
      if (!result.ok && result.error) {
        setErro(result.error);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível entrar em modo online.');
    } finally {
      setLoading(false);
    }
  }, [enterOnlineMode, firebaseEnabled, isAuthenticated, prepararSessaoNuvem, signInWithGoogle]);

  return (
    <View style={styles.wrap}>
      <Text style={[ts.caption, styles.hint, { color: theme.textSecondary }]}>
        O sistema funciona 100% offline. Use a sincronização manual apenas quando quiser enviar ou
        receber dados da nuvem.
      </Text>

      <View style={[styles.statusPill, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
        <Text style={[ts.caption, { color: theme.text, fontWeight: '700' }]}>
          Modo atual: {appMode === 'OFFLINE' ? 'Offline' : 'Online (sync)'}
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

      <PressableScale onPress={() => void handleEntrarOnline()} disabled={loading} style={styles.btnOuter}>
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
              <Cloud size={18} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.btnText}>Entrar em modo online</Text>
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
