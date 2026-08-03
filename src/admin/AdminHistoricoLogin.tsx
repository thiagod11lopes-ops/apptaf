import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { PREMIUM } from '../theme/premium';
import { signInAdminHistoricoBoss } from './adminHistoricoAuth';

type Props = {
  onSuccess: () => void;
};

export function AdminHistoricoLogin({ onSuccess }: Props) {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Informe e-mail e senha do chefe.');
      return;
    }
    setLoading(true);
    try {
      await signInAdminHistoricoBoss(email, password);
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>Admin — E-mails TAF</Text>
        <Text style={[styles.sub, { color: theme.textMuted }]}>
          Entre com o e-mail e a senha do chefe para abrir o painel.
        </Text>

        <Text style={[styles.label, { color: theme.textMuted }]}>E-mail</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          placeholder="chefe@marinha.mil.br"
          placeholderTextColor={theme.textMuted}
          editable={!loading}
          style={[
            styles.input,
            { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
          ]}
          onSubmitEditing={() => void submit()}
        />

        <Text style={[styles.label, { color: theme.textMuted }]}>Senha</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          placeholder="Senha"
          placeholderTextColor={theme.textMuted}
          editable={!loading}
          style={[
            styles.input,
            { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
          ]}
          onSubmitEditing={() => void submit()}
        />

        {error ? (
          <Text style={[styles.error, { color: theme.loss, borderColor: theme.loss }]}>{error}</Text>
        ) : null}

        <TouchableOpacity
          onPress={() => void submit()}
          disabled={loading}
          style={[styles.btn, { backgroundColor: theme.primary, opacity: loading ? 0.75 : 1 }]}
          accessibilityLabel="Entrar no painel admin"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Entrar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    minHeight: Platform.OS === 'web' ? ('100vh' as unknown as number) : undefined,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusLg,
    padding: 22,
    gap: 8,
  },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  sub: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 6 },
  input: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 12 : 10,
    fontSize: 16,
  },
  error: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    padding: 10,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  btn: {
    marginTop: 12,
    borderRadius: PREMIUM.radiusMd,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
