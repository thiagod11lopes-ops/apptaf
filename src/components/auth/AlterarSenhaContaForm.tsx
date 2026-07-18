import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../Button';

type Props = {
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

/** Troca de senha com usuário já logado (pede senha atual para manter E2E). */
export function AlterarSenhaContaForm({ onSuccess, onError }: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const { updatePassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const inputStyle = [
    styles.input,
    {
      borderColor: theme.border,
      backgroundColor: theme.backgroundSecondary,
      color: theme.text,
    },
  ];

  const submit = useCallback(async () => {
    setInfo(null);
    if (!currentPassword.trim()) {
      onError?.('Informe a senha atual.');
      return;
    }
    if (password.length < 6) {
      onError?.('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== password2) {
      onError?.('As senhas novas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password, {
        mode: 'change',
        currentPasswordForE2e: currentPassword,
      });
      setCurrentPassword('');
      setPassword('');
      setPassword2('');
      setInfo('Senha alterada. A criptografia foi reprotegida com a nova senha.');
      onSuccess?.();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Não foi possível alterar a senha.');
    } finally {
      setLoading(false);
    }
  }, [currentPassword, onError, onSuccess, password, password2, updatePassword]);

  return (
    <View style={styles.wrap}>
      <Text style={[ts.caption, { color: theme.textSecondary, lineHeight: 18 }]}>
        Informe a senha atual e a nova. Assim o escudo verde continua ativo e NIP/nome seguem
        criptografados na nuvem.
      </Text>
      <TextInput
        value={currentPassword}
        onChangeText={setCurrentPassword}
        placeholder="Senha atual"
        placeholderTextColor={theme.textMuted}
        style={inputStyle}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="password"
        textContentType="password"
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Nova senha"
        placeholderTextColor={theme.textMuted}
        style={inputStyle}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextInput
        value={password2}
        onChangeText={setPassword2}
        placeholder="Confirmar nova senha"
        placeholderTextColor={theme.textMuted}
        style={inputStyle}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Button title="Trocar senha" onPress={() => void submit()} loading={loading} style={styles.btn} />
      {info ? <Text style={[ts.caption, styles.info, { color: theme.gain }]}>{info}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  btn: { marginTop: 4 },
  info: { textAlign: 'center', marginTop: 4, lineHeight: 18 },
});
