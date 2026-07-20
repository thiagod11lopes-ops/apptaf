import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { User, KeyRound } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useOfflineSyncState } from '../contexts/OfflineSyncContext';
import { useCloudSyncHeaderStatus } from '../hooks/useCloudSyncHeaderStatus';
import { AppHeader } from '../components/sismav/AppHeader';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { EmailPasswordAuthForm } from '../components/auth/EmailPasswordAuthForm';
import { AlterarSenhaContaForm } from '../components/auth/AlterarSenhaContaForm';
import { AlterarSenhaAplicadorModal } from '../components/aplicador/AlterarSenhaAplicadorModal';
import { consumeLastRedirectAuthError } from '../services/firebase/googleAuth';
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
  const {
    user,
    isAuthenticated,
    isAuthorizedMember,
    isSessionLoading,
    passwordRecoveryPending,
    clearPasswordRecovery,
    firebaseEnabled,
    logout,
  } = useAuth();
  const { appMode, pendingCount } = useOfflineSyncState();
  const { statusHint } = useCloudSyncHeaderStatus();

  const statusConta = useMemo(() => {
    if (isSessionLoading) return 'Preparando conta…';
    if (passwordRecoveryPending) return 'Defina uma nova senha para continuar';
    if (!isAuthenticated) return 'Modo offline · dados locais';
    if (appMode !== 'OFFLINE') return statusHint ?? 'Sincronizando com a nuvem…';
    if (pendingCount > 0) {
      return `Conectado · ${pendingCount} alteração(ões) local(is) aguardando sync`;
    }
    return 'Conectado · use a chave na tela inicial para sincronizar';
  }, [
    appMode,
    isAuthenticated,
    isSessionLoading,
    passwordRecoveryPending,
    pendingCount,
    statusHint,
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
    // Home definitiva: AuthLoginRouteGate (quando isSessionLoading terminar).
    // Aqui só limpa erro; evita ir à Home e ser puxado de volta durante o prepare.
  }, []);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [senhaModalVisible, setSenhaModalVisible] = useState(false);
  const [trocarSenhaContaAberto, setTrocarSenhaContaAberto] = useState(false);

  useEffect(() => {
    const redirectError = consumeLastRedirectAuthError();
    if (redirectError) setErro(redirectError);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || passwordRecoveryPending) {
      setTrocarSenhaContaAberto(false);
    }
  }, [isAuthenticated, passwordRecoveryPending]);

  const aguardandoLogin = isSessionLoading && !passwordRecoveryPending;
  const showAuthForm = !isAuthenticated || passwordRecoveryPending;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: 'transparent' }]}
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
            {isAuthenticated && user && !passwordRecoveryPending ? (
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
                <Text style={ts.h2}>{passwordRecoveryPending ? 'Nova senha' : 'Entrar'}</Text>
                <Text style={[ts.caption, { color: theme.loss, marginTop: 4, fontWeight: '800' }]}>
                  {passwordRecoveryPending ? 'Recuperação' : 'Offline'}
                </Text>
                <Text style={[ts.caption, { color: theme.textMuted, marginTop: 4 }]}>
                  {passwordRecoveryPending
                    ? 'Escolha uma nova senha para a conta'
                    : 'Na nuvem: e-mail autorizado usa o banco do chefe; demais e-mails usam banco próprio'}
                </Text>
              </View>
            )}
          </View>

          {aguardandoLogin ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[ts.caption, { color: theme.textSecondary }]}>
                {isSessionLoading ? 'Concluindo login…' : 'Sincronizando…'}
              </Text>
            </View>
          ) : null}

          {showAuthForm ? (
            <>
              <EmailPasswordAuthForm
                forceRecovery={passwordRecoveryPending}
                onSuccess={onLoginSuccess}
                onError={setErro}
                onRecoveryDone={clearPasswordRecovery}
              />
              {erro ? (
                <Text style={[ts.caption, styles.erro, { color: theme.loss }]}>{erro}</Text>
              ) : null}
            </>
          ) : (
            <View style={styles.contaActions}>
              <Button title="Sair da conta" variant="outline" onPress={handleLogout} loading={loading} />
              <Button
                title={trocarSenhaContaAberto ? 'Ocultar trocar senha' : 'Trocar senha'}
                variant="secondary"
                onPress={() => {
                  setErro(null);
                  setTrocarSenhaContaAberto((open) => !open);
                }}
              />
              {trocarSenhaContaAberto ? (
                <View style={styles.trocarSenhaBox}>
                  <Text style={[ts.caption, { color: theme.textMuted, lineHeight: 18 }]}>
                    Senha de login da conta. Membro autorizado: entra no banco do chefe só com a
                    própria senha (acesso liberado na autorização).
                  </Text>
                  <AlterarSenhaContaForm
                    onSuccess={() => {
                      setErro(null);
                      setTrocarSenhaContaAberto(false);
                    }}
                    onError={setErro}
                  />
                  {erro ? (
                    <Text style={[ts.caption, styles.erro, { color: theme.loss }]}>{erro}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          )}
        </Card>

        {isAuthenticated && isAuthorizedMember && !passwordRecoveryPending ? (
          <Card elevated style={styles.senhaCard}>
            <View style={styles.senhaHeader}>
              <View
                style={[styles.senhaIcon, { backgroundColor: theme.accentMuted, borderColor: theme.border }]}
              >
                <KeyRound size={20} color={theme.primary} strokeWidth={2.2} />
              </View>
              <View style={styles.senhaHeaderText}>
                <Text style={ts.h2}>Senha de aplicador</Text>
                <Text style={[ts.caption, { color: theme.textMuted, marginTop: 2 }]}>
                  Escolha um aplicador e altere a senha informando a senha atual.
                </Text>
              </View>
            </View>
            <Button
              title="Alterar senha de aplicador"
              variant="secondary"
              onPress={() => setSenhaModalVisible(true)}
            />
          </Card>
        ) : null}

        <Text style={[ts.caption, styles.footer]}>
          {firebaseEnabled
            ? 'Após entrar, sua sessão permanece ativa. A sincronização é feita manualmente na tela inicial.'
            : 'Adicione as chaves do Supabase em .env para habilitar login e nuvem.'}
        </Text>
      </ScrollView>

      <AlterarSenhaAplicadorModal
        visible={senhaModalVisible}
        onClose={() => setSenhaModalVisible(false)}
      />
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
  contaActions: { gap: 10 },
  trocarSenhaBox: { gap: 10, marginTop: 4 },
  senhaCard: { marginTop: 16 },
  senhaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  senhaIcon: {
    width: 44,
    height: 44,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  senhaHeaderText: { flex: 1 },
});
