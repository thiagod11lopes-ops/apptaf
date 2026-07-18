import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../Button';
import { TermosCriacaoBancoModal } from './TermosCriacaoBancoModal';
import { canUseEmailAuth } from '../../services/firebase/googleAuth';
import { readPersistedAuthProfile } from '../../services/firebase/authProfile';
import { PREMIUM } from '../../theme/premium';
import {
  isAllowedAuthEmail,
  authEmailDomainErrorMessage,
  normalizeAuthEmail,
} from '../../utils/normalizeAuthEmail';
import {
  clearDatabaseTermsPreAccepted,
  setDatabaseTermsPreAcceptedForEmail,
} from '../../offline-first/auth/databaseTerms';
import { isKnownAuthEmailOnDevice } from '../../offline-first/auth/knownAuthEmails';

type Mode = 'login' | 'register' | 'forgot' | 'recovery';

type Props = {
  onSuccess?: () => void;
  onError?: (message: string) => void;
  /** Sessão veio do link de recuperação de senha. */
  forceRecovery?: boolean;
  onRecoveryDone?: () => void;
};

function isReturningLocalEmail(email: string): boolean {
  const profile = readPersistedAuthProfile();
  if (!profile?.email?.trim()) return false;
  return normalizeAuthEmail(profile.email) === normalizeAuthEmail(email);
}

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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const emailWasAllowedRef = useRef(false);

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

  const resetTermsState = useCallback(() => {
    setTermsAccepted(false);
    setTermsModalVisible(false);
    clearDatabaseTermsPreAccepted();
  }, []);

  const switchMode = useCallback(
    (next: Mode) => {
      setMode(next);
      setInfo(null);
      setPassword('');
      setPassword2('');
      if (next === 'register') {
        if (!termsAccepted) setTermsModalVisible(true);
      } else {
        resetTermsState();
      }
    },
    [resetTermsState, termsAccepted],
  );

  const handleEmailChange = useCallback(
    (text: string) => {
      setEmail(text);
      if (forceRecovery || mode === 'recovery' || mode === 'forgot') {
        emailWasAllowedRef.current = isAllowedAuthEmail(text);
        return;
      }

      const allowed = isAllowedAuthEmail(text);
      const becameComplete = allowed && !emailWasAllowedRef.current;
      emailWasAllowedRef.current = allowed;

      if (becameComplete && !isReturningLocalEmail(text)) {
        // Só trata como novo banco se o e-mail nunca autenticou neste dispositivo.
        void (async () => {
          if (await isKnownAuthEmailOnDevice(text)) return;
          setMode('register');
          setInfo(null);
          setTermsAccepted(false);
          clearDatabaseTermsPreAccepted();
          setTermsModalVisible(true);
        })();
        return;
      }

      if (!allowed && mode === 'register') {
        setMode('login');
        resetTermsState();
      }
    },
    [forceRecovery, mode, resetTermsState],
  );

  const handleAcceptTerms = useCallback(() => {
    setTermsAccepted(true);
    setTermsModalVisible(false);
    setDatabaseTermsPreAcceptedForEmail(email);
  }, [email]);

  const handleDeclineTerms = useCallback(() => {
    setTermsModalVisible(false);
    setTermsAccepted(false);
    clearDatabaseTermsPreAccepted();
    setMode('login');
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

    if (mode === 'register' && !termsAccepted) {
      setTermsModalVisible(true);
      onError?.('Aceite os termos de criação do banco de dados para continuar.');
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
        setDatabaseTermsPreAcceptedForEmail(email);
        const result = await signUpWithEmail(email, password);
        if (result.needsEmailConfirmation) {
          setInfo('Conta criada. Confirme o e-mail pelo link enviado e depois faça login.');
          setMode('login');
          setPassword('');
          setPassword2('');
          resetTermsState();
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
        await updatePassword(password, { mode: 'recovery' });
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
    resetTermsState,
    signInWithEmail,
    signUpWithEmail,
    termsAccepted,
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
        ? 'Cadastrar'
        : mode === 'forgot'
          ? 'Recuperar senha'
          : 'Nova senha';

  return (
    <View style={styles.wrap}>
      {mode !== 'recovery' ? (
        <TextInput
          value={email}
          onChangeText={handleEmailChange}
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

      {mode === 'recovery' ? (
        <Text style={[ts.caption, { color: theme.textSecondary, lineHeight: 18 }]}>
          Recuperação pelo link do e-mail. Para manter a criptografia, use o mesmo aparelho/navegador
          onde o escudo já estava verde. Se lembrar da senha, entre normalmente e use Conta → Trocar
          senha.
        </Text>
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

      {mode === 'register' ? (
        <Pressable
          onPress={() => setTermsModalVisible(true)}
          accessibilityRole="button"
          style={[
            styles.termsChip,
            {
              borderColor: termsAccepted ? theme.gain : theme.border,
              backgroundColor: termsAccepted ? theme.gainMuted : theme.backgroundSecondary,
            },
          ]}
        >
          <Text style={[ts.caption, { color: termsAccepted ? theme.gain : theme.textSecondary, fontWeight: '700' }]}>
            {termsAccepted
              ? 'Termos de criação do banco aceitos'
              : 'Toque para ler e aceitar os termos do banco'}
          </Text>
        </Pressable>
      ) : null}

      <Button
        title={title}
        onPress={() => void submit()}
        loading={loading}
        disabled={mode === 'register' && !termsAccepted}
        style={styles.btn}
      />

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
        <Pressable
          onPress={() => switchMode('login')}
          accessibilityRole="button"
          style={styles.backLink}
        >
          <Text style={[ts.caption, { color: theme.primary, fontWeight: '700', textAlign: 'center' }]}>
            Já tenho conta — Entrar
          </Text>
        </Pressable>
      ) : null}

      <TermosCriacaoBancoModal
        visible={termsModalVisible}
        email={email}
        onAccept={handleAcceptTerms}
        onDecline={handleDeclineTerms}
      />
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
  termsChip: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
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
