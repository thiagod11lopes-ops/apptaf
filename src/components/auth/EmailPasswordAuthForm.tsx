import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../Button';
import { PasswordInput } from './PasswordInput';
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
import {
  isKnownAuthEmailOnDevice,
  rememberKnownAuthEmailOnDevice,
  listRecentKnownAuthEmails,
  filterRecentAuthEmailSuggestions,
  RECENT_AUTH_EMAILS_SUGGEST_LIMIT,
} from '../../offline-first/auth/knownAuthEmails';
import {
  E2E_MEMBER_NEEDS_BOOTSTRAP,
  E2E_MEMBER_NEEDS_BOOTSTRAP_MESSAGE,
  E2E_MEMBER_WRAP_MISSING,
  E2E_MEMBER_WRAP_MISSING_MESSAGE,
} from '../../services/supabase/teamE2eSession';

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

function isBootstrapRequiredError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ((error as { code?: string }).code === E2E_MEMBER_NEEDS_BOOTSTRAP) return true;
  const message = error instanceof Error ? error.message : String(error);
  return message === E2E_MEMBER_NEEDS_BOOTSTRAP_MESSAGE
    || message.includes('senha de criptografia do chefe (campo extra)');
}

function isWrapMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ((error as { code?: string }).code === E2E_MEMBER_WRAP_MISSING) return true;
  const message = error instanceof Error ? error.message : String(error);
  return message === E2E_MEMBER_WRAP_MISSING_MESSAGE
    || message.includes('acesso ao banco ainda não foi liberado');
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
  const [bossCryptoPassword, setBossCryptoPassword] = useState('');
  const [needBossCryptoPassword, setNeedBossCryptoPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [recentEmails, setRecentEmails] = useState<string[]>([]);
  const [emailFocused, setEmailFocused] = useState(false);
  const emailWasAllowedRef = useRef(false);
  const blurHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (forceRecovery) setMode('recovery');
  }, [forceRecovery]);

  const refreshRecentEmails = useCallback(() => {
    void listRecentKnownAuthEmails(RECENT_AUTH_EMAILS_SUGGEST_LIMIT).then(setRecentEmails);
  }, []);

  useEffect(() => {
    refreshRecentEmails();
  }, [refreshRecentEmails]);

  useEffect(() => {
    return () => {
      if (blurHideTimerRef.current) clearTimeout(blurHideTimerRef.current);
    };
  }, []);

  const emailSuggestions = useMemo(
    () => filterRecentAuthEmailSuggestions(email, recentEmails),
    [email, recentEmails],
  );
  const showEmailSuggestions = emailFocused && emailSuggestions.length > 0;

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
      setBossCryptoPassword('');
      setNeedBossCryptoPassword(false);
      if (next === 'register') {
        if (!termsAccepted) setTermsModalVisible(true);
      } else if (next === 'login') {
        // Mantém pré-aceite se o usuário já leu os termos (fluxo "Já tenho conta").
        setTermsModalVisible(false);
        if (!termsAccepted) {
          clearDatabaseTermsPreAccepted();
        }
      } else {
        resetTermsState();
      }
    },
    [resetTermsState, termsAccepted],
  );

  const applyEmailText = useCallback(
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

  const handleEmailChange = useCallback(
    (text: string) => {
      applyEmailText(text);
    },
    [applyEmailText],
  );

  const selectSuggestedEmail = useCallback(
    (suggested: string) => {
      if (blurHideTimerRef.current) {
        clearTimeout(blurHideTimerRef.current);
        blurHideTimerRef.current = null;
      }
      applyEmailText(suggested);
      setEmailFocused(false);
      void rememberKnownAuthEmailOnDevice(suggested).then(refreshRecentEmails);
    },
    [applyEmailText, refreshRecentEmails],
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
      if (mode !== 'recovery') {
        await rememberKnownAuthEmailOnDevice(email);
        refreshRecentEmails();
      }
      if (mode === 'login') {
        try {
          await signInWithEmail(
            email,
            password,
            needBossCryptoPassword && bossCryptoPassword.trim()
              ? { bootstrapBossPassword: bossCryptoPassword.trim() }
              : undefined,
          );
          setNeedBossCryptoPassword(false);
          setBossCryptoPassword('');
          onSuccess?.();
          return;
        } catch (e) {
          if (isWrapMissingError(e)) {
            setNeedBossCryptoPassword(false);
            setInfo(E2E_MEMBER_WRAP_MISSING_MESSAGE);
            onError?.(E2E_MEMBER_WRAP_MISSING_MESSAGE);
            return;
          }
          if (isBootstrapRequiredError(e)) {
            setNeedBossCryptoPassword(true);
            setInfo(E2E_MEMBER_NEEDS_BOOTSTRAP_MESSAGE);
            onError?.(E2E_MEMBER_NEEDS_BOOTSTRAP_MESSAGE);
            return;
          }
          throw e;
        }
      }
      if (mode === 'register') {
        setDatabaseTermsPreAcceptedForEmail(email);
        try {
          const result = await signUpWithEmail(
            email,
            password,
            needBossCryptoPassword && bossCryptoPassword.trim()
              ? { bootstrapBossPassword: bossCryptoPassword.trim() }
              : undefined,
          );
          if (result.needsEmailConfirmation) {
            setInfo('Conta criada. Confirme o e-mail pelo link enviado e depois faça login.');
            setMode('login');
            setPassword('');
            setPassword2('');
            setBossCryptoPassword('');
            setNeedBossCryptoPassword(false);
            resetTermsState();
            return;
          }
          setNeedBossCryptoPassword(false);
          setBossCryptoPassword('');
          onSuccess?.();
          return;
        } catch (e) {
          if (isWrapMissingError(e)) {
            setNeedBossCryptoPassword(false);
            setInfo(E2E_MEMBER_WRAP_MISSING_MESSAGE);
            onError?.(E2E_MEMBER_WRAP_MISSING_MESSAGE);
            return;
          }
          if (isBootstrapRequiredError(e)) {
            setNeedBossCryptoPassword(true);
            setInfo(E2E_MEMBER_NEEDS_BOOTSTRAP_MESSAGE);
            onError?.(E2E_MEMBER_NEEDS_BOOTSTRAP_MESSAGE);
            return;
          }
          throw e;
        }
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
    bossCryptoPassword,
    email,
    mode,
    needBossCryptoPassword,
    onError,
    onRecoveryDone,
    onSuccess,
    password,
    password2,
    refreshRecentEmails,
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
        <View style={styles.emailField}>
          <TextInput
            value={email}
            onChangeText={handleEmailChange}
            onFocus={() => {
              if (blurHideTimerRef.current) {
                clearTimeout(blurHideTimerRef.current);
                blurHideTimerRef.current = null;
              }
              setEmailFocused(true);
            }}
            onBlur={() => {
              blurHideTimerRef.current = setTimeout(() => setEmailFocused(false), 180);
            }}
            placeholder="E-mail @marinha.mil.br"
            placeholderTextColor={theme.textMuted}
            style={inputStyle}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />
          {showEmailSuggestions ? (
            <View
              style={[
                styles.suggestions,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSecondary,
                },
              ]}
            >
              {emailSuggestions.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => selectSuggestedEmail(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Usar e-mail ${item}`}
                  style={({ pressed }) => [
                    styles.suggestionRow,
                    {
                      borderTopColor: theme.border,
                      backgroundColor: pressed ? theme.background : 'transparent',
                    },
                  ]}
                >
                  <Text style={[ts.body, { color: theme.text }]} numberOfLines={1}>
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {mode === 'recovery' ? (
        <Text style={[ts.caption, { color: theme.textSecondary, lineHeight: 18 }]}>
          Recuperação pelo link do e-mail. Para manter a criptografia, use o mesmo aparelho/navegador
          onde o escudo já estava verde. Se lembrar da senha, entre normalmente e use Conta → Trocar
          senha.
        </Text>
      ) : null}

      {mode === 'login' || mode === 'register' || mode === 'recovery' ? (
        <PasswordInput
          value={password}
          onChangeText={setPassword}
          placeholder={mode === 'recovery' ? 'Nova senha' : 'Senha'}
          autoComplete={mode === 'login' ? 'password' : 'new-password'}
          textContentType={mode === 'login' ? 'password' : 'newPassword'}
        />
      ) : null}

      {mode === 'register' || mode === 'recovery' ? (
        <PasswordInput
          value={password2}
          onChangeText={setPassword2}
          placeholder="Confirmar senha"
          autoComplete="new-password"
          textContentType="newPassword"
        />
      ) : null}

      {needBossCryptoPassword && (mode === 'login' || mode === 'register') ? (
        <>
          <Text style={[ts.caption, { color: theme.textSecondary, lineHeight: 18 }]}>
            E-mail autorizado: na 1ª vez informe a senha de criptografia do chefe. Depois use só a sua.
          </Text>
          <PasswordInput
            value={bossCryptoPassword}
            onChangeText={setBossCryptoPassword}
            placeholder="Senha de criptografia do chefe (1ª vez)"
            autoComplete="off"
            textContentType="password"
          />
        </>
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
  emailField: {
    position: 'relative',
    zIndex: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  suggestions: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    marginTop: 4,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    overflow: 'hidden',
    zIndex: 30,
    elevation: 6,
  },
  suggestionRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
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
