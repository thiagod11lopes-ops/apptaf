import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { ArrowLeft, ChevronRight, ExternalLink, Mail, RefreshCw, Users } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import {
  adminListAuthorizedEmails,
  adminListBossEmails,
  type AdminAuthorizedRow,
  type AdminBossRow,
} from '../services/supabase/adminDirectoryCloud';
import { isSupabaseConfigured } from '../config/supabase';
import { PREMIUM } from '../theme/premium';

type Page = 'bosses' | 'members';

export function AdminHistoricoApp() {
  const { theme } = useTheme();
  const [page, setPage] = useState<Page>('bosses');
  const [bosses, setBosses] = useState<AdminBossRow[]>([]);
  const [selectedBoss, setSelectedBoss] = useState<AdminBossRow | null>(null);
  const [members, setMembers] = useState<AdminAuthorizedRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregarBosses = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setErro(
        'Supabase não está configurado neste deploy. No Vercel: Project → Settings → Environment Variables → adicione EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY (iguais ao .env local) → Redeploy. No GitHub Pages: configure os mesmos nomes em Settings → Secrets and variables → Actions.',
      );
      setBosses([]);
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const lista = await adminListBossEmails();
      setBosses(lista.filter((b) => b.email.includes('@')));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao carregar chefes.';
      setErro(
        `${msg} Se a função ainda não existe, execute supabase/admin_directory.sql no SQL Editor do Supabase.`,
      );
      setBosses([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  const abrirBoss = useCallback(async (boss: AdminBossRow) => {
    setSelectedBoss(boss);
    setPage('members');
    setCarregando(true);
    setErro(null);
    try {
      const lista = await adminListAuthorizedEmails(boss.ownerUid);
      setMembers(lista);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar autorizados.');
      setMembers([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  const voltarBosses = useCallback(() => {
    setPage('bosses');
    setSelectedBoss(null);
    setMembers([]);
    setErro(null);
    void carregarBosses();
  }, [carregarBosses]);

  useEffect(() => {
    void carregarBosses();
  }, [carregarBosses]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Admin — E-mails TAF';
    }
  }, []);

  const abrirAppPrincipal = useCallback(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const path = window.location.pathname;
    const base = path.startsWith('/apptaf') ? '/apptaf/' : '/';
    window.location.href = `${window.location.origin}${base}`;
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <View style={styles.topBarText}>
            <Text style={[styles.heading, { color: theme.text }]}>Admin — E-mails TAF</Text>
            <Text style={[styles.sub, { color: theme.textMuted }]}>
              {page === 'bosses'
                ? 'E-mails chefe cadastrados no sistema. Toque para ver os autorizados.'
                : `Autorizados do chefe ${selectedBoss?.email ?? ''}.`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={abrirAppPrincipal}
            style={[styles.linkBtn, { borderColor: theme.border }]}
            accessibilityLabel="Abrir aplicativo principal"
          >
            <ExternalLink size={16} color={theme.primary} strokeWidth={2.2} />
            <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 12 }}>App TAF</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.toolbar}>
          {page === 'members' ? (
            <TouchableOpacity
              onPress={voltarBosses}
              style={[styles.toolBtn, { borderColor: theme.border }]}
              accessibilityLabel="Voltar aos chefes"
            >
              <ArrowLeft size={18} color={theme.text} strokeWidth={2.2} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => {
              if (page === 'bosses') void carregarBosses();
              else if (selectedBoss) void abrirBoss(selectedBoss);
            }}
            style={[styles.toolBtn, { borderColor: theme.border }]}
            accessibilityLabel="Atualizar"
          >
            <RefreshCw size={18} color={theme.text} strokeWidth={2.2} />
          </TouchableOpacity>
          <View style={[styles.countChip, { backgroundColor: theme.accentMuted, borderColor: theme.border }]}>
            {page === 'bosses' ? (
              <Mail size={16} color={theme.primary} strokeWidth={2.2} />
            ) : (
              <Users size={16} color={theme.primary} strokeWidth={2.2} />
            )}
            <Text style={[styles.countText, { color: theme.text }]}>
              {page === 'bosses'
                ? `${bosses.length} chefe${bosses.length !== 1 ? 's' : ''}`
                : `${members.length} autorizado${members.length !== 1 ? 's' : ''}`}
            </Text>
          </View>
        </View>

        {erro ? (
          <Text style={[styles.erroBox, { color: theme.loss, borderColor: theme.loss }]}>{erro}</Text>
        ) : null}

        {carregando ? <ActivityIndicator color={theme.primary} style={styles.loader} /> : null}

        {!carregando && page === 'bosses' && bosses.length === 0 && !erro ? (
          <Text style={[styles.empty, { color: theme.textMuted }]}>
            Nenhum e-mail chefe encontrado. Chefes aparecem após criarem banco / autorizarem e-mails e
            sincronizarem.
          </Text>
        ) : null}

        {!carregando && page === 'bosses'
          ? bosses.map((boss) => (
              <TouchableOpacity
                key={boss.ownerUid}
                onPress={() => void abrirBoss(boss)}
                style={[styles.card, { borderColor: theme.border, backgroundColor: theme.surface }]}
                accessibilityLabel={`Chefe ${boss.email}`}
              >
                <View style={styles.cardBody}>
                  <Text style={[styles.cardEmail, { color: theme.text }]}>{boss.email}</Text>
                  <Text style={[styles.cardMeta, { color: theme.textMuted }]}>
                    {boss.authorizedCount} autorizado{boss.authorizedCount !== 1 ? 's' : ''}
                  </Text>
                </View>
                <ChevronRight size={20} color={theme.textMuted} strokeWidth={2.2} />
              </TouchableOpacity>
            ))
          : null}

        {!carregando && page === 'members' && members.length === 0 && !erro ? (
          <Text style={[styles.empty, { color: theme.textMuted }]}>
            Este chefe ainda não autorizou nenhum e-mail.
          </Text>
        ) : null}

        {!carregando && page === 'members'
          ? members.map((m) => (
              <View
                key={m.email}
                style={[styles.card, { borderColor: theme.border, backgroundColor: theme.surface }]}
              >
                <View style={styles.cardBody}>
                  <Text style={[styles.cardEmail, { color: theme.text }]}>{m.email}</Text>
                  <Text
                    style={[
                      styles.cardMeta,
                      { color: m.ativo ? theme.gain : theme.textMuted, fontWeight: '700' },
                    ]}
                  >
                    {m.ativo ? 'Ativo' : 'Inativo'}
                  </Text>
                </View>
              </View>
            ))
          : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    minHeight: Platform.OS === 'web' ? ('100vh' as unknown as number) : undefined,
  },
  scroll: {
    padding: 20,
    paddingBottom: 48,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  topBarText: { flex: 1 },
  heading: { fontSize: 24, fontWeight: '800', marginBottom: 6 },
  sub: { fontSize: 14, lineHeight: 20 },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  toolBtn: {
    padding: 12,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
  },
  countChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
  },
  countText: { fontWeight: '800', fontSize: 13 },
  loader: { marginVertical: 24 },
  empty: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  erroBox: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    padding: 12,
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: PREMIUM.radiusLg,
    padding: 16,
    marginBottom: 10,
    gap: 12,
  },
  cardBody: { flex: 1, gap: 4 },
  cardEmail: { fontSize: 16, fontWeight: '700' },
  cardMeta: { fontSize: 13 },
});
