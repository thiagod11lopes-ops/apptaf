import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { User } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { AppHeader } from '../components/sismav/AppHeader';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { PREMIUM } from '../theme/premium';

export default function LoginScreen() {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const navigation = useNavigation();
  const { user, isAuthenticated, login, logout } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleLogin = useCallback(async () => {
    setErro(null);
    setLoading(true);
    try {
      await login(usuario, senha);
      setSenha('');
      navigation.goBack();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }, [login, navigation, senha, usuario]);

  const handleLogout = useCallback(async () => {
    setLoading(true);
    try {
      await logout();
      setUsuario('');
      setSenha('');
    } finally {
      setLoading(false);
    }
  }, [logout]);

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.tokens.inputBg,
      borderColor: theme.border,
      color: theme.text,
    },
  ];

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
            <View style={[styles.avatarCircle, { backgroundColor: theme.accentMuted, borderColor: theme.border }]}>
              <User size={28} color={theme.primary} strokeWidth={2.2} />
            </View>
            {isAuthenticated && user ? (
              <View style={styles.avatarText}>
                <Text style={ts.h2}>{user.usuario}</Text>
                <Text style={[ts.caption, { color: theme.textMuted, marginTop: 4 }]}>
                  Sessão ativa neste dispositivo
                </Text>
              </View>
            ) : (
              <View style={styles.avatarText}>
                <Text style={ts.h2}>Entrar</Text>
                <Text style={[ts.caption, { color: theme.textMuted, marginTop: 4 }]}>
                  Identifique-se para continuar
                </Text>
              </View>
            )}
          </View>

          {isAuthenticated ? (
            <Button title="Sair da conta" variant="outline" onPress={handleLogout} loading={loading} />
          ) : (
            <>
              <Text style={[ts.label, styles.fieldLabel]}>Usuário</Text>
              <TextInput
                value={usuario}
                onChangeText={setUsuario}
                placeholder="Nome de usuário"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={inputStyle}
                accessibilityLabel="Usuário"
              />

              <Text style={[ts.label, styles.fieldLabel]}>Senha</Text>
              <TextInput
                value={senha}
                onChangeText={setSenha}
                placeholder="Senha"
                placeholderTextColor={theme.textMuted}
                secureTextEntry
                style={inputStyle}
                accessibilityLabel="Senha"
                onSubmitEditing={handleLogin}
              />

              {erro ? (
                <Text style={[ts.caption, styles.erro, { color: theme.loss }]}>{erro}</Text>
              ) : null}

              <Button title="Entrar" onPress={handleLogin} loading={loading} style={styles.submitBtn} />
            </>
          )}
        </Card>

        <Text style={[ts.caption, styles.footer]}>
          Credenciais armazenadas apenas neste aparelho até você sair da conta.
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
  avatarText: { flex: 1 },
  fieldLabel: { marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  erro: { marginBottom: 8 },
  submitBtn: { marginTop: 8 },
  footer: { textAlign: 'center', marginTop: 16, lineHeight: 20, paddingHorizontal: 8 },
});
