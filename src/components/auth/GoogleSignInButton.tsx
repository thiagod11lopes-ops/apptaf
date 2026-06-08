import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Text, StyleSheet, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../Button';
import {
  canUseGoogleSignIn,
  isNativeGoogleSignIn,
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
  const [loading, setLoading] = useState(false);
  const native = isNativeGoogleSignIn();
  const [request, response, promptAsync] = useGoogleAuthRequest();

  const handleWebSignIn = useCallback(async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      onSuccess?.();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Não foi possível entrar com Google.');
    } finally {
      setLoading(false);
    }
  }, [onError, onSuccess, signInWithGoogle]);

  useEffect(() => {
    if (!native || response?.type !== 'success') return;
    const idToken = response.authentication?.idToken;
    if (!idToken) {
      onError?.('Resposta do Google sem token de autenticação.');
      return;
    }
    setLoading(true);
    signInWithGoogle(idToken)
      .then(() => onSuccess?.())
      .catch((e) =>
        onError?.(e instanceof Error ? e.message : 'Não foi possível entrar com Google.'),
      )
      .finally(() => setLoading(false));
  }, [native, onError, onSuccess, response, signInWithGoogle]);

  const handlePress = useCallback(async () => {
    if (Platform.OS === 'web') {
      await handleWebSignIn();
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
  }, [handleWebSignIn, onError, promptAsync, request]);

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
