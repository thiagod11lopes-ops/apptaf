import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Trash2, UserPlus } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import type { AuthorizedEmailEntry } from '../offline-first/sync/firebase/FirebaseGateway';
import { authorizedEmailRepository } from '../offline-first/repositories/AuthorizedEmailRepository';
import { isValidAuthEmail, normalizeAuthEmail } from '../utils/normalizeAuthEmail';
import { PREMIUM } from '../theme/premium';

export function AuthorizedEmailsBlock() {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const { user, isBoss } = useAuth();
  const [emails, setEmails] = useState<AuthorizedEmailEntry[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    if (!user?.uid || !isBoss) {
      setEmails([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      setEmails(await authorizedEmailRepository.listLocal(user.uid));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar os e-mails.');
    } finally {
      setLoading(false);
    }
  }, [isBoss, user?.uid]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const handleAdd = useCallback(async () => {
    if (!user?.uid) return;
    const email = normalizeAuthEmail(input);
    if (!isValidAuthEmail(email)) {
      setErro('Informe um e-mail válido.');
      return;
    }
    if (user.email && normalizeAuthEmail(user.email) === email) {
      setErro('O e-mail do chefe não precisa ser adicionado à lista.');
      return;
    }
    setSaving(true);
    setErro(null);
    setMsg(null);
    try {
      await authorizedEmailRepository.addLocal(user.uid, email);
      setInput('');
      setMsg(`E-mail ${email} autorizado localmente. Será enviado na próxima sincronização.`);
      await recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível autorizar o e-mail.');
    } finally {
      setSaving(false);
    }
  }, [input, recarregar, user?.email, user?.uid]);

  const handleRemove = useCallback(
    async (email: string) => {
      if (!user?.uid) return;
      setSaving(true);
      setErro(null);
      setMsg(null);
      try {
        await authorizedEmailRepository.removeLocal(user.uid, email);
        setMsg(`Acesso de ${email} removido localmente. Será aplicado na próxima sincronização.`);
        await recarregar();
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível remover o e-mail.');
      } finally {
        setSaving(false);
      }
    },
    [recarregar, user?.uid],
  );

  if (!isBoss) return null;

  return (
    <View>
      <Text style={[ts.caption, styles.hint, { color: theme.textSecondary }]}>
        Pessoas autorizadas entram com o Google delas e acessam seus cadastros e resultados TAF.
      </Text>

      <View style={styles.addRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="colega@unidade.gov.br"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={[
            styles.input,
            {
              color: theme.text,
              borderColor: theme.border,
              backgroundColor: theme.backgroundSecondary,
              fontFamily: theme.fontFamily,
            },
          ]}
        />
        <TouchableOpacity
          onPress={() => void handleAdd()}
          disabled={saving || !input.trim()}
          style={[
            styles.addBtn,
            {
              backgroundColor: theme.primary,
              opacity: saving || !input.trim() ? 0.55 : 1,
            },
          ]}
          accessibilityLabel="Autorizar e-mail"
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <UserPlus size={18} color="#fff" strokeWidth={2.2} />
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.primary} style={styles.loader} />
      ) : emails.length === 0 ? (
        <Text style={[ts.caption, { color: theme.textMuted, marginTop: 10 }]}>
          Nenhum e-mail autorizado ainda.
        </Text>
      ) : (
        <View style={styles.list}>
          {emails.map((entry) => (
            <View
              key={entry.email}
              style={[styles.listItem, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
            >
              <Text style={[ts.body, { color: theme.text, flex: 1 }]} numberOfLines={1}>
                {entry.email}
              </Text>
              <TouchableOpacity
                onPress={() => void handleRemove(entry.email)}
                disabled={saving}
                accessibilityLabel={`Remover ${entry.email}`}
                style={styles.removeBtn}
              >
                <Trash2 size={16} color={theme.loss} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {erro ? (
        <Text style={[ts.caption, styles.feedback, { color: theme.loss }]}>{erro}</Text>
      ) : null}
      {msg ? (
        <Text style={[ts.caption, styles.feedback, { color: theme.gain }]}>{msg}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { lineHeight: 18, marginBottom: 12 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 10 : 8,
    fontSize: 14,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: { marginTop: 14 },
  list: { marginTop: 12, gap: 8 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  removeBtn: { padding: 6, marginLeft: 4 },
  feedback: { marginTop: 10, textAlign: 'center', lineHeight: 18 },
});
