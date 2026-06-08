import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { User } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
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
  const { user, isAuthenticated, firebaseEnabled, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
    navigation.goBack();
  }, [navigation]);

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
                <Text style={[ts.caption, { color: theme.gain, marginTop: 4 }]}>
                  Conectado · dados na nuvem (Firebase)
                </Text>
              </View>
            ) : (
              <View style={styles.avatarText}>
                <Text style={ts.h2}>Entrar</Text>
                <Text style={[ts.caption, { color: theme.textMuted, marginTop: 4 }]}>
                  Use sua conta Google para sincronizar cadastros e resultados
                </Text>
              </View>
            )}
          </View>

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
            ? 'Com login ativo, cadastros e histórico de TAF são salvos no Firestore (Firebase) vinculados à sua conta.'
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
  erro: { marginTop: 10, textAlign: 'center' },
  footer: { textAlign: 'center', marginTop: 16, lineHeight: 20, paddingHorizontal: 8 },
});
