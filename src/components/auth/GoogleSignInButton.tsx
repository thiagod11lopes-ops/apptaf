import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Text, StyleSheet, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../Button';
import {
  canUseGoogleSignIn,
  clearOAuthParamsFromWindow,
  extractGoogleIdTokenFromAuthResponse,
  hasPendingGoogleOAuthReturn,
  isNativeGoogleSignIn,
  parseGoogleIdTokenFromWindow,
  parseGoogleOAuthErrorFromWindow,
  shouldUseExpoGoogleAuthOnWeb,
  startGoogleOAuthFullPageRedirect,
  useGoogleAuthRequest,
} from '../../services/firebase/googleAuth';
import { PREMIUM } from '../../theme/premium';

type Props = {
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

export function GoogleSignInButton({ onSuccess, onError }: Props) {
  const { theme } = useTheme();
  const { signInWithGoogle } = useAuth();
  const native = isNativeGoogleSignIn();
  const mobileSafariWeb = Platform.OS === 'web' && shouldUseExpoGoogleAuthOnWeb();
  const useExpoOAuth = native || mobileSafariWeb;
  const handledReturnRef = useRef(false);
  const [loading, setLoading] = useState(
    () => Platform.OS === 'web' && hasPendingGoogleOAuthReturn(),
  );
  const [request, response, promptAsync] = useGoogleAuthRequest();

  const finishWithIdToken = useCallback(
    (idToken: string) => {
      setLoading(true);
      return signInWithGoogle(idToken)
        .then(() => {
          clearOAuthParamsFromWindow();
          onSuccess?.();
        })
        .catch((e) =>
          onError?.(e instanceof Error ? e.message : 'Não foi possível entrar com Google.'),
        )
        .finally(() => setLoading(false));
    },
    [onError, onSuccess, signInWithGoogle],
  );

  useEffect(() => {
    if (!mobileSafariWeb || handledReturnRef.current) return;

    const oauthError = parseGoogleOAuthErrorFromWindow();
    if (oauthError) {
      handledReturnRef.current = true;
      clearOAuthParamsFromWindow();
      onError?.(oauthError);
      setLoading(false);
      return;
    }

    const idToken = parseGoogleIdTokenFromWindow();
    if (!idToken) {
      if (hasPendingGoogleOAuthReturn()) {
        handledReturnRef.current = true;
        clearOAuthParamsFromWindow();
        onError?.('Não foi possível concluir o login. Tente novamente.');
        setLoading(false);
      }
      return;
    }

    handledReturnRef.current = true;
    void finishWithIdToken(idToken);
  }, [finishWithIdToken, mobileSafariWeb, onError]);

  const handleWebPopupSignIn = useCallback(async () => {
    setLoading(true);
    let redirected = false;
    try {
      redirected = await signInWithGoogle();
      if (redirected) return;
      onSuccess?.();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Não foi possível entrar com Google.');
    } finally {
      if (!redirected) setLoading(false);
    }
  }, [onError, onSuccess, signInWithGoogle]);

  useEffect(() => {
    if (!useExpoOAuth || mobileSafariWeb || !response) return;

    if (response.type === 'error') {
      const msg =
        response.error?.message ||
        response.params?.error_description ||
        response.params?.error ||
        'Erro ao autenticar com Google.';
      onError?.(typeof msg === 'string' ? msg : 'Erro ao autenticar com Google.');
      setLoading(false);
      return;
    }

    if (response.type !== 'success') return;

    const idToken = extractGoogleIdTokenFromAuthResponse(response);
    if (!idToken) {
      onError?.('Resposta do Google sem token de autenticação.');
      setLoading(false);
      return;
    }

    void finishWithIdToken(idToken);
  }, [finishWithIdToken, mobileSafariWeb, onError, response, useExpoOAuth]);

  const handlePress = useCallback(async () => {
    if (mobileSafariWeb) {
      if (!request?.url) {
        onError?.('Aguarde o carregamento do login Google.');
        return;
      }
      setLoading(true);
      try {
        startGoogleOAuthFullPageRedirect(request.url);
      } catch (e) {
        onError?.(e instanceof Error ? e.message : 'Não foi possível abrir o Google.');
        setLoading(false);
      }
      return;
    }

    if (Platform.OS === 'web') {
      await handleWebPopupSignIn();
      return;
    }

    if (!request) {
      onError?.('Aguarde o carregamento do login Google ou verifique o .env.');
      return;
    }
    setLoading(true);
    try {
      await promptAsync();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Não foi possível abrir o Google.');
    } finally {
      setLoading(false);
    }
  }, [handleWebPopupSignIn, mobileSafariWeb, onError, promptAsync, request]);

  if (!canUseGoogleSignIn()) {
    return (
      <View style={[styles.hintBox, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}>
        <Text style={[theme.textStyles.caption, { color: theme.textMuted, lineHeight: 18 }]}>
          Configure Firebase e Google no arquivo .env (copie de .env.example) para habilitar o login.
        </Text>
      </View>
    );
  }

  return (
    <Button
      title="Entrar com Google"
      onPress={handlePress}
      loading={loading}
      style={styles.btn}
    />
  );
}

const styles = StyleSheet.create({
  btn: { marginTop: 4 },
  hintBox: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    padding: 12,
    marginTop: 4,
  },
});
