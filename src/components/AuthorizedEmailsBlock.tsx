import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Pressable,
} from 'react-native';
import { Check, Cloud, Trash2, UserPlus } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { listAuthorizedEmails } from '../offline-first/sync/firebase/FirebaseGateway';
import {
  authorizedEmailRepository,
  type AuthorizedEmailListItem,
} from '../offline-first/repositories/AuthorizedEmailRepository';
import { pushPendingAuthorizedEmails } from '../offline-first/sync/syncAuthorizedEmails';
import { notifyDataChanged } from '../offline-first/sync/SyncEngine';
import { isAllowedAuthEmail, authEmailDomainErrorMessage, normalizeAuthEmail } from '../utils/normalizeAuthEmail';
import { PREMIUM } from '../theme/premium';
import { listEmailsWithE2eAccessLiberated } from '../services/supabase/teamE2eMemberWrapsCloud';
import {
  provisionAuthorizedMemberE2eAccess,
  removeMemberE2eWrap,
} from '../services/supabase/teamE2eSession';
import { isE2eKeyActive } from '../services/supabase/e2eCrypto';

export function AuthorizedEmailsBlock() {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const { user, isBoss } = useAuth();
  const [emails, setEmails] = useState<AuthorizedEmailListItem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingEmail, setTogglingEmail] = useState<string | null>(null);
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
      let items = await authorizedEmailRepository.listLocalWithCloudStatus(user.uid);
      try {
        const remote = await listAuthorizedEmails(user.uid);
        const remoteKeys = new Set(remote.map((e) => normalizeAuthEmail(e.email)));
        items = items.map((item) => ({
          ...item,
          cloudSynced: remoteKeys.has(normalizeAuthEmail(item.email)),
        }));
      } catch {
        /* offline: mantém status local */
      }
      try {
        const liberated = await listEmailsWithE2eAccessLiberated(user.uid);
        items = items.map((item) => ({
          ...item,
          e2eAccessLiberated: liberated.has(normalizeAuthEmail(item.email)),
        }));
      } catch {
        /* offline / tabela ausente */
      }
      setEmails(items);
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
    if (!isAllowedAuthEmail(email)) {
      setErro(authEmailDomainErrorMessage());
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
      const pushErrors = await pushPendingAuthorizedEmails(user.uid);
      setInput('');
      if (pushErrors.length > 0) {
        setMsg(
          `E-mail ${email} autorizado. Marque o checklist ao lado para liberar o acesso ao banco (escudo verde necessário).`,
        );
      } else if (isE2eKeyActive()) {
        const provisioned = await provisionAuthorizedMemberE2eAccess(user.uid, email);
        if (provisioned.ok) {
          setMsg(
            `E-mail ${email} autorizado e acesso liberado. O colega entra só com a senha dele.`,
          );
        } else {
          setMsg(
            `E-mail ${email} autorizado na nuvem. Marque o checklist ao lado para liberar o acesso ao banco.`,
          );
        }
      } else {
        setMsg(
          `E-mail ${email} autorizado. Com o escudo verde, marque o checklist ao lado para liberar o acesso.`,
        );
      }
      await recarregar();
      notifyDataChanged();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível autorizar o e-mail.');
    } finally {
      setSaving(false);
    }
  }, [input, recarregar, user?.email, user?.uid]);

  const handleToggleE2eAccess = useCallback(
    async (entry: AuthorizedEmailListItem) => {
      if (!user?.uid) return;
      const email = normalizeAuthEmail(entry.email);
      setTogglingEmail(email);
      setErro(null);
      setMsg(null);
      try {
        if (entry.e2eAccessLiberated) {
          await removeMemberE2eWrap(user.uid, email);
          setMsg(`Acesso ao banco removido para ${email}. O e-mail continua autorizado.`);
        } else {
          if (!isE2eKeyActive()) {
            setErro(
              'Escudo verde necessário. Entre com a senha da conta (criptografia ativa) e marque o checklist de novo.',
            );
            return;
          }
          // Garante e-mail na nuvem antes do wrap.
          if (!entry.cloudSynced) {
            await authorizedEmailRepository.addLocal(user.uid, email);
            await pushPendingAuthorizedEmails(user.uid);
          }
          const result = await provisionAuthorizedMemberE2eAccess(user.uid, email);
          if (!result.ok) {
            setErro(
              result.skipped === 'dek_locked'
                ? 'Escudo verde necessário. Desbloqueie a criptografia e tente de novo.'
                : result.error ?? 'Não foi possível liberar o acesso.',
            );
            return;
          }
          setMsg(`Acesso liberado para ${email}. O colega já pode entrar no seu banco.`);
        }
        await recarregar();
        notifyDataChanged();
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível alterar o acesso.');
      } finally {
        setTogglingEmail(null);
      }
    },
    [recarregar, user?.uid],
  );

  const handleRemove = useCallback(
    async (email: string) => {
      if (!user?.uid) return;
      setSaving(true);
      setErro(null);
      setMsg(null);
      try {
        await authorizedEmailRepository.removeLocal(user.uid, email);
        const pushErrors = await pushPendingAuthorizedEmails(user.uid);
        if (pushErrors.length > 0) {
          setMsg(
            `Acesso de ${email} removido localmente. Será aplicado na próxima sincronização.`,
          );
        } else {
          setMsg(`Acesso de ${email} removido na nuvem.`);
        }
        await recarregar();
        notifyDataChanged();
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
        Checklist marcado = colega entra só com a senha dele. Se o cadastro dele falhar com
        &quot;muitas tentativas&quot;, é limite de e-mail do Supabase: Authentication → Providers → Email →
        desative Confirm email (ou aguarde ~1 h).
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
          {emails.map((entry) => {
            const cloudColor = entry.cloudSynced ? theme.gain : theme.loss;
            const cloudLabel = entry.cloudSynced
              ? `${entry.email} sincronizado com o banco na nuvem`
              : `${entry.email} ainda não sincronizado com a nuvem`;
            const busy = togglingEmail === normalizeAuthEmail(entry.email);
            const checkLabel = entry.e2eAccessLiberated
              ? `Acesso liberado para ${entry.email}`
              : `Liberar acesso ao banco para ${entry.email}`;
            return (
              <View
                key={entry.email}
                style={[
                  styles.listItem,
                  { borderColor: theme.border, backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Pressable
                  onPress={() => void handleToggleE2eAccess(entry)}
                  disabled={saving || busy}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: entry.e2eAccessLiberated }}
                  accessibilityLabel={checkLabel}
                  style={[
                    styles.checkbox,
                    {
                      borderColor: entry.e2eAccessLiberated ? theme.gain : theme.border,
                      backgroundColor: entry.e2eAccessLiberated
                        ? theme.gain
                        : theme.background,
                    },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : entry.e2eAccessLiberated ? (
                    <Check size={14} color="#fff" strokeWidth={3} />
                  ) : null}
                </Pressable>
                <Text style={[ts.body, { color: theme.text, flex: 1 }]} numberOfLines={1}>
                  {entry.email}
                </Text>
                <View
                  accessibilityRole="image"
                  accessibilityLabel={cloudLabel}
                  style={styles.cloudIcon}
                >
                  <Cloud size={16} color={cloudColor} strokeWidth={2.2} />
                </View>
                <TouchableOpacity
                  onPress={() => void handleRemove(entry.email)}
                  disabled={saving || busy}
                  accessibilityLabel={`Remover ${entry.email}`}
                  style={styles.removeBtn}
                >
                  <Trash2 size={16} color={theme.loss} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            );
          })}
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
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cloudIcon: { padding: 6, marginLeft: 4 },
  removeBtn: { padding: 6, marginLeft: 2 },
  feedback: { marginTop: 10, textAlign: 'center', lineHeight: 18 },
});
