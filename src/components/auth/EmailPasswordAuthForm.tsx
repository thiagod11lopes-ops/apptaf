import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../Button';
import { canUseEmailAuth } from '../../services/firebase/googleAuth';
import { PREMIUM } from '../../theme/premium';
import { isAllowedAuthEmail, authEmailDomainErrorMessage } from '../../utils/normalizeAuthEmail';

type Mode = 'login' | 'register' | 'forgot' | 'recovery';

type Props = {
  onSuccess?: () => void;
  onError?: (message: string) => void;
  /** Sessão veio do link de recuperação de senha. */
  forceRecovery?: boolean;
  onRecoveryDone?: () => void;
};

export function EmailPasswordAuthForm({
  onSuccess,
  onError,
  forceRecovery = false,
  onRecoveryDone,
}: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const { signInWithEmail, signUpWithEmail, requestPasswordReset, updatePassword } = useAuth();

  const [mode, setMode] = useState<Mode>(forceRecovery ? 'recovery' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  React.useEffect(() => {
    if (forceRecovery) setMode('recovery');
  }, [forceRecovery]);

  const inputStyle = [
    styles.input,
    {
      borderColor: theme.border,
      backgroundColor: theme.backgroundSecondary,
      color: theme.text,
    },
  ];

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setInfo(null);
    setPassword('');
    setPassword2('');
  }, []);

  const submit = useCallback(async () => {
    setInfo(null);

    if (mode !== 'recovery' && !isAllowedAuthEmail(email)) {
      onError?.(authEmailDomainErrorMessage());
      return;
    }

    if ((mode === 'login' || mode === 'register' || mode === 'recovery') && password.length < 6) {
      onError?.('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if ((mode === 'register' || mode === 'recovery') && password !== password2) {
      onError?.('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
        onSuccess?.();
        return;
      }
      if (mode === 'register') {
        const result = await signUpWithEmail(email, password);
        if (result.needsEmailConfirmation) {
          setInfo('Conta criada. Confirme o e-mail pelo link enviado e depois faça login.');
          setMode('login');
          setPassword('');
          setPassword2('');
          return;
        }
        onSuccess?.();
        return;
      }
      if (mode === 'forgot') {
        await requestPasswordReset(email);
        setInfo('Se o e-mail existir, enviaremos um link para redefinir a senha.');
        return;
      }
      if (mode === 'recovery') {
        await updatePassword(password);
        setInfo('Senha atualizada. Você já está conectado.');
        onRecoveryDone?.();
        onSuccess?.();
      }
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Não foi possível concluir.');
    } finally {
      setLoading(false);
    }
  }, [
    email,
    mode,
    onError,
    onRecoveryDone,
    onSuccess,
    password,
    password2,
    requestPasswordReset,
    signInWithEmail,
    signUpWithEmail,
    updatePassword,
  ]);

  if (!canUseEmailAuth()) {
    return (
      <View style={[styles.hintBox, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}>
        <Text style={[ts.caption, { color: theme.textMuted, lineHeight: 18 }]}>
          Configure o Supabase no arquivo .env (copie de .env.example) para habilitar o login.
        </Text>
      </View>
    );
  }

  const title =
    mode === 'login'
      ? 'Entrar'
      : mode === 'register'
        ? 'Criar conta'
        : mode === 'forgot'
          ? 'Recuperar senha'
          : 'Nova senha';

  return (
    <View style={styles.wrap}>
      {mode !== 'recovery' ? (
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="E-mail @marinha.mil.br"
          placeholderTextColor={theme.textMuted}
          style={inputStyle}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
      ) : null}

      {mode === 'login' || mode === 'register' || mode === 'recovery' ? (
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={mode === 'recovery' ? 'Nova senha' : 'Senha'}
          placeholderTextColor={theme.textMuted}
          style={inputStyle}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={mode === 'login' ? 'password' : 'new-password'}
          textContentType={mode === 'login' ? 'password' : 'newPassword'}
        />
      ) : null}

      {mode === 'register' || mode === 'recovery' ? (
        <TextInput
          value={password2}
          onChangeText={setPassword2}
          placeholder="Confirmar senha"
          placeholderTextColor={theme.textMuted}
          style={inputStyle}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
        />
      ) : null}

      <Button title={title} onPress={() => void submit()} loading={loading} style={styles.btn} />

      {info ? (
        <Text style={[ts.caption, styles.info, { color: theme.gain }]}>{info}</Text>
      ) : null}

      {mode === 'login' ? (
        <View style={styles.links}>
          <Pressable onPress={() => switchMode('forgot')} accessibilityRole="button">
            <Text style={[ts.caption, { color: theme.primary, fontWeight: '700' }]}>
              Esqueci a senha
            </Text>
          </Pressable>
          <Pressable onPress={() => switchMode('register')} accessibilityRole="button">
            <Text style={[ts.caption, { color: theme.primary, fontWeight: '700' }]}>
              Criar conta
            </Text>
          </Pressable>
        </View>
      ) : null}

      {mode === 'register' || mode === 'forgot' ? (
        <Pressable onPress={() => switchMode('login')} accessibilityRole="button" style={styles.backLink}>
          <Text style={[ts.caption, { color: theme.primary, fontWeight: '700', textAlign: 'center' }]}>
            Voltar ao login
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  input: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  btn: { marginTop: 4 },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  backLink: { marginTop: 10 },
  info: { marginTop: 8, textAlign: 'center', lineHeight: 18 },
  hintBox: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    padding: 12,
    marginTop: 4,
  },
});
