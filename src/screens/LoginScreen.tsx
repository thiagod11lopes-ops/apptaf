import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { User } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useOfflineSyncState } from '../contexts/OfflineSyncContext';
import { useCloudSyncHeaderStatus } from '../hooks/useCloudSyncHeaderStatus';
import { AppHeader } from '../components/sismav/AppHeader';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { PREMIUM } from '../theme/premium';

function userLabel(name: string | null, email: string | null): string {
  if (name?.trim()) return name.trim();
  if (email?.trim()) return email.trim();
  return 'Usuário';
}

export default function LoginScreen() {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const navigation = useNavigation();
  const { user, isAuthenticated, isSessionLoading, firebaseEnabled, logout } = useAuth();
  const { usingCloudData, online, syncing } = useOfflineSyncState();
  const { statusHint, syncedWithCloud } = useCloudSyncHeaderStatus();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const conectandoNuvem =
    isAuthenticated && !isSessionLoading && online && (syncing || !usingCloudData);

  const statusConta = useMemo(() => {
    if (isSessionLoading) return 'Preparando sua conta…';
    if (!isAuthenticated) return null;
    if (conectandoNuvem) return statusHint ?? 'Conectando com a nuvem…';
    if (syncedWithCloud || usingCloudData) {
      return 'Conectado · dados sincronizados com a nuvem';
    }
    if (!online) return 'Conectado · exibindo último snapshot (sem internet)';
    return statusHint ?? 'Conectado · finalizando sincronização…';
  }, [
    conectandoNuvem,
    isAuthenticated,
    isSessionLoading,
    online,
    statusHint,
    syncedWithCloud,
    usingCloudData,
  ]);

  const handleLogout = useCallback(async () => {
    setLoading(true);
    try {
      await logout();
      setErro(null);
    } finally {
      setLoading(false);
    }
  }, [logout]);

  const onLoginSuccess = useCallback(() => {
    setErro(null);
  }, []);

  const aguardandoLogin = isSessionLoading || conectandoNuvem;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppHeader title="Conta" subtitle="Acesso do usuário" onBack={() => navigation.goBack()} />

        <Card elevated>
          <View style={styles.avatarRow}>
            {isAuthenticated && user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatarPhoto} accessibilityLabel="Foto do usuário" />
            ) : (
              <View style={[styles.avatarCircle, { backgroundColor: theme.accentMuted, borderColor: theme.border }]}>
                <User size={28} color={theme.primary} strokeWidth={2.2} />
              </View>
            )}
            {isAuthenticated && user ? (
              <View style={styles.avatarText}>
                <Text style={ts.h2}>{userLabel(user.displayName, user.email)}</Text>
                {user.email ? (
                  <Text style={[ts.caption, { color: theme.textMuted, marginTop: 4 }]}>{user.email}</Text>
                ) : null}
                {statusConta ? (
                  <Text
                    style={[
                      ts.caption,
                      {
                        color: aguardandoLogin ? theme.textSecondary : theme.gain,
                        marginTop: 4,
                        fontWeight: aguardandoLogin ? '600' : '800',
                      },
                    ]}
                  >
                    {statusConta}
                  </Text>
                ) : null}
              </View>
            ) : (
              <View style={styles.avatarText}>
                <Text style={ts.h2}>Entrar</Text>
                <Text style={[ts.caption, { color: theme.loss, marginTop: 4, fontWeight: '800' }]}>
                  Offline
                </Text>
                <Text style={[ts.caption, { color: theme.textMuted, marginTop: 4 }]}>
                  Use sua conta Google para acessar os dados na nuvem
                </Text>
              </View>
            )}
          </View>

          {aguardandoLogin ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[ts.caption, { color: theme.textSecondary }]}>
                {isSessionLoading ? 'Concluindo login…' : 'Conectando à nuvem…'}
              </Text>
            </View>
          ) : null}

          {isAuthenticated ? (
            <Button title="Sair da conta" variant="outline" onPress={handleLogout} loading={loading} />
          ) : (
            <>
              <GoogleSignInButton onSuccess={onLoginSuccess} onError={setErro} />
              {erro ? (
                <Text style={[ts.caption, styles.erro, { color: theme.loss }]}>{erro}</Text>
              ) : null}
            </>
          )}
        </Card>

        <Text style={[ts.caption, styles.footer]}>
          {firebaseEnabled
            ? 'Após entrar com Google, permaneça nesta tela até a conexão com a nuvem ser concluída.'
            : 'Adicione as chaves do Firebase em .env para habilitar login Google e banco na nuvem.'}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPhoto: {
    width: 56,
    height: 56,
    borderRadius: PREMIUM.radiusMd,
  },
  avatarText: { flex: 1 },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  erro: { marginTop: 10, textAlign: 'center' },
  footer: { textAlign: 'center', marginTop: 16, lineHeight: 20, paddingHorizontal: 8 },
});
