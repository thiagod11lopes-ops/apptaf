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
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  HardDrive,
  Mail,
  RefreshCw,
  Users,
  Wand2,
} from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import {
  adminDatabaseSizeBytes,
  adminListAuthorizedEmails,
  adminListBossEmails,
  formatAdminDataSize,
  type AdminAuthorizedRow,
  type AdminBossRow,
} from '../services/supabase/adminDirectoryCloud';
import { isSupabaseConfigured } from '../config/supabase';
import { PREMIUM } from '../theme/premium';
import { AppModal } from '../components/premium/AppModal';
import {
  carregarResumoGeneroPlanilha,
  corrigirGeneroCadastrosPlanilha,
  generoMarcadoNoModal,
  salvarGeneroManualCadastro,
  salvarGenerosMarcadosEmLote,
  type CadastroNaoIdentificadoGenero,
  type ResultadoCorrecaoGenero,
} from '../utils/corrigirGeneroPorNome';
import { AdminHistoricoLogin } from './AdminHistoricoLogin';
import {
  ADMIN_E2E_NEEDS_PASSWORD,
  flushAdminHistoricoCadastrosToCloud,
  prepareAdminHistoricoCloudSession,
  resolveAdminHistoricoAccess,
  signOutAdminHistorico,
  type AdminHistoricoBossSession,
} from './adminHistoricoAuth';

type Page = 'bosses' | 'members';
type Gate = 'loading' | 'login' | 'ready';

export function AdminHistoricoApp() {
  const { theme } = useTheme();
  const [gate, setGate] = useState<Gate>('loading');
  const [bossSession, setBossSession] = useState<AdminHistoricoBossSession | null>(null);
  const [page, setPage] = useState<Page>('bosses');
  const [bosses, setBosses] = useState<AdminBossRow[]>([]);
  const [selectedBoss, setSelectedBoss] = useState<AdminBossRow | null>(null);
  const [members, setMembers] = useState<AdminAuthorizedRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dbSizeBytes, setDbSizeBytes] = useState<number | null>(null);
  const [dbSizeErro, setDbSizeErro] = useState<string | null>(null);
  const [carregandoDbSize, setCarregandoDbSize] = useState(false);

  const [corrigindoGenero, setCorrigindoGenero] = useState(false);
  const [resultadoGenero, setResultadoGenero] = useState<ResultadoCorrecaoGenero | null>(null);
  const [erroGenero, setErroGenero] = useState<string | null>(null);
  const [listaNaoIdAberta, setListaNaoIdAberta] = useState(false);
  const [editando, setEditando] = useState<CadastroNaoIdentificadoGenero | null>(null);
  const [sexoEdicao, setSexoEdicao] = useState<'M' | 'F'>('M');
  const [salvandoGenero, setSalvandoGenero] = useState(false);
  /** Gênero marcado por id (mesmo padrão do modal). */
  const [marcacoesNaoId, setMarcacoesNaoId] = useState<Record<string, 'M' | 'F'>>({});
  const [salvandoLote, setSalvandoLote] = useState(false);

  const verificarAcesso = useCallback(async () => {
    setGate('loading');
    const access = await resolveAdminHistoricoAccess();
    if (access.status === 'ok') {
      try {
        await prepareAdminHistoricoCloudSession(access.session);
        setBossSession(access.session);
        setGate('ready');
        return;
      } catch (e) {
        const needsPassword =
          e instanceof Error &&
          (e.name === ADMIN_E2E_NEEDS_PASSWORD || e.message === ADMIN_E2E_NEEDS_PASSWORD);
        if (!needsPassword) {
          console.warn('[admin-historico] prepare cloud:', e);
        }
        // Sessão Auth ok, mas sem chave E2E — pede senha de novo.
        setBossSession(null);
        setGate('login');
        return;
      }
    }
    if (access.status === 'not_boss') {
      await signOutAdminHistorico().catch(() => undefined);
    }
    setBossSession(null);
    setGate('login');
  }, []);

  const enviarGeneroParaNuvem = useCallback(async () => {
    const flush = await flushAdminHistoricoCadastrosToCloud();
    if (!flush.ok) {
      throw new Error(
        flush.error ||
          'Gênero salvo neste aparelho, mas não foi possível enviar à nuvem. Tente de novo.',
      );
    }
  }, []);

  const carregarTamanhoBanco = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setDbSizeBytes(null);
      setDbSizeErro(null);
      return;
    }
    setCarregandoDbSize(true);
    setDbSizeErro(null);
    try {
      const bytes = await adminDatabaseSizeBytes();
      setDbSizeBytes(bytes);
    } catch (e) {
      setDbSizeBytes(null);
      setDbSizeErro(
        e instanceof Error
          ? e.message
          : 'Falha ao ler o tamanho do banco. Execute supabase/admin_directory.sql no Supabase.',
      );
    } finally {
      setCarregandoDbSize(false);
    }
  }, []);

  const carregarBosses = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setErro(
        'Supabase não está configurado neste deploy. No Vercel: Project → Settings → Environment Variables → adicione EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY (iguais ao .env local) → Redeploy. No GitHub Pages: configure os mesmos nomes em Settings → Secrets and variables → Actions.',
      );
      setBosses([]);
      setCarregando(false);
      return;
    }
    const access = await resolveAdminHistoricoAccess();
    if (access.status !== 'ok') {
      setBossSession(null);
      setGate('login');
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const lista = await adminListBossEmails();
      setBosses(lista.filter((b) => b.email.includes('@')));
      void carregarTamanhoBanco();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao carregar chefes.';
      setErro(
        `${msg} Se a função ainda não existe, execute supabase/admin_directory.sql no SQL Editor do Supabase.`,
      );
      setBosses([]);
    } finally {
      setCarregando(false);
    }
  }, [carregarTamanhoBanco]);

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

  const sincronizarMarcacoes = useCallback((lista: CadastroNaoIdentificadoGenero[]) => {
    setMarcacoesNaoId((prev) => {
      const next: Record<string, 'M' | 'F'> = {};
      for (const item of lista) {
        next[item.id] = prev[item.id] ?? generoMarcadoNoModal(item.sexoAtual);
      }
      return next;
    });
  }, []);

  const atualizarResumoGenero = useCallback(async (persistir: boolean) => {
    setCorrigindoGenero(true);
    setErroGenero(null);
    try {
      const res = persistir
        ? await corrigirGeneroCadastrosPlanilha({ persistir: true })
        : await carregarResumoGeneroPlanilha();
      setResultadoGenero(res);
      sincronizarMarcacoes(res.naoIdentificados);
      setListaNaoIdAberta(res.naoIdentificados.length > 0);
      if (persistir && res.modificados > 0) {
        await enviarGeneroParaNuvem();
      }
    } catch (e) {
      setErroGenero(e instanceof Error ? e.message : 'Falha ao ler/corrigir gênero na Planilha.');
    } finally {
      setCorrigindoGenero(false);
    }
  }, [sincronizarMarcacoes, enviarGeneroParaNuvem]);

  const executarCorrecaoGenero = useCallback(() => {
    void atualizarResumoGenero(true);
  }, [atualizarResumoGenero]);

  const abrirEdicaoNaoId = useCallback(
    (item: CadastroNaoIdentificadoGenero) => {
      setEditando(item);
      setSexoEdicao(marcacoesNaoId[item.id] ?? generoMarcadoNoModal(item.sexoAtual));
    },
    [marcacoesNaoId],
  );

  const salvarEdicaoGenero = useCallback(async () => {
    if (!editando) return;
    setSalvandoGenero(true);
    setErroGenero(null);
    try {
      const ok = await salvarGeneroManualCadastro(editando.id, sexoEdicao);
      if (!ok) {
        setErroGenero('Cadastro não encontrado na Planilha.');
        return;
      }
      await enviarGeneroParaNuvem();
      setEditando(null);
      const res = await carregarResumoGeneroPlanilha();
      setResultadoGenero(res);
      sincronizarMarcacoes(res.naoIdentificados);
      setListaNaoIdAberta(res.naoIdentificados.length > 0);
    } catch (e) {
      setErroGenero(e instanceof Error ? e.message : 'Falha ao salvar gênero.');
    } finally {
      setSalvandoGenero(false);
    }
  }, [editando, sexoEdicao, sincronizarMarcacoes, enviarGeneroParaNuvem]);

  const salvarTodosGenerosMarcados = useCallback(async () => {
    const lista = resultadoGenero?.naoIdentificados ?? [];
    if (lista.length === 0) return;
    setSalvandoLote(true);
    setErroGenero(null);
    try {
      const itens = lista.map((item) => ({
        id: item.id,
        sexo: marcacoesNaoId[item.id] ?? generoMarcadoNoModal(item.sexoAtual),
      }));
      const n = await salvarGenerosMarcadosEmLote(itens);
      if (n === 0) {
        setErroGenero('Nenhum gênero foi gravado. Faça login e tente de novo.');
        return;
      }
      await enviarGeneroParaNuvem();
      const res = await carregarResumoGeneroPlanilha();
      setResultadoGenero(res);
      sincronizarMarcacoes(res.naoIdentificados);
      setListaNaoIdAberta(res.naoIdentificados.length > 0);
    } catch (e) {
      setErroGenero(e instanceof Error ? e.message : 'Falha ao salvar gêneros em lote.');
    } finally {
      setSalvandoLote(false);
    }
  }, [resultadoGenero, marcacoesNaoId, sincronizarMarcacoes, enviarGeneroParaNuvem]);

  useEffect(() => {
    void verificarAcesso();
  }, [verificarAcesso]);

  useEffect(() => {
    if (gate !== 'ready') return;
    void carregarBosses();
  }, [gate, carregarBosses]);

  // Ao abrir/atualizar a página, mostra o que já está gravado na Planilha.
  useEffect(() => {
    if (gate !== 'ready') return;
    void atualizarResumoGenero(false);
  }, [gate, atualizarResumoGenero]);

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

  const sair = useCallback(async () => {
    await signOutAdminHistorico().catch(() => undefined);
    setBossSession(null);
    setBosses([]);
    setMembers([]);
    setSelectedBoss(null);
    setPage('bosses');
    setGate('login');
  }, []);

  const homens = resultadoGenero?.homens ?? 0;
  const mulheres = resultadoGenero?.mulheres ?? 0;
  const naoIdCount = resultadoGenero?.naoIdentificados.length ?? 0;

  if (gate === 'loading') {
    return (
      <View style={[styles.root, styles.gateCenter, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (gate === 'login') {
    return <AdminHistoricoLogin onSuccess={() => void verificarAcesso()} />;
  }

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
            {bossSession?.email ? (
              <Text style={[styles.sessionHint, { color: theme.textMuted }]}>
                Logado como {bossSession.email}
              </Text>
            ) : null}
          </View>
          <View style={styles.topBarActions}>
            <TouchableOpacity
              onPress={() => void sair()}
              style={[styles.linkBtn, { borderColor: theme.border }]}
              accessibilityLabel="Sair do painel admin"
            >
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>Sair</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={abrirAppPrincipal}
              style={[styles.linkBtn, { borderColor: theme.border }]}
              accessibilityLabel="Abrir aplicativo principal"
            >
              <ExternalLink size={16} color={theme.primary} strokeWidth={2.2} />
              <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 12 }}>App TAF</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.dbSizePanel, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <View style={styles.dbSizeRow}>
            <HardDrive size={18} color={theme.primary} strokeWidth={2.2} />
            <View style={styles.dbSizeText}>
              <Text style={[styles.dbSizeLabel, { color: theme.textMuted }]}>
                Dados atuais no banco (Supabase)
              </Text>
              {carregandoDbSize ? (
                <ActivityIndicator color={theme.primary} style={{ alignSelf: 'flex-start' }} />
              ) : (
                <Text style={[styles.dbSizeValue, { color: theme.text }]}>
                  {dbSizeBytes != null ? formatAdminDataSize(dbSizeBytes) : '—'}
                </Text>
              )}
              {dbSizeErro ? (
                <Text style={[styles.dbSizeHint, { color: theme.loss }]}>{dbSizeErro}</Text>
              ) : (
                <Text style={[styles.dbSizeHint, { color: theme.textMuted }]}>
                  Tamanho total do banco Postgres do projeto (armazenamento atual, não é egress).
                </Text>
              )}
            </View>
          </View>
        </View>

        <View style={[styles.generoPanel, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Text style={[styles.generoTitle, { color: theme.text }]}>Gênero — Planilha de cadastro</Text>
          <Text style={[styles.generoHint, { color: theme.textMuted }]}>
            Identifica o primeiro nome de cada militar da Planilha e corrige o gênero pelo dicionário.
            Ao salvar, as alterações são enviadas para a nuvem do chefe.
          </Text>

          <TouchableOpacity
            onPress={() => void executarCorrecaoGenero()}
            disabled={corrigindoGenero}
            style={[
              styles.generoBtn,
              { backgroundColor: theme.primary, opacity: corrigindoGenero ? 0.7 : 1 },
            ]}
            accessibilityLabel="Corrigir gênero pelos nomes"
          >
            {corrigindoGenero ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Wand2 size={18} color="#fff" strokeWidth={2.2} />
            )}
            <Text style={styles.generoBtnText}>
              {corrigindoGenero ? 'Corrigindo…' : 'Corrigir gênero pelos nomes'}
            </Text>
          </TouchableOpacity>

          <View style={styles.statsRow}>
            <View style={[styles.statChip, { borderColor: theme.border, backgroundColor: theme.accentMuted }]}>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Homens</Text>
              <Text style={[styles.statValue, { color: theme.text }]}>{homens}</Text>
            </View>
            <View style={[styles.statChip, { borderColor: theme.border, backgroundColor: theme.accentMuted }]}>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Mulheres</Text>
              <Text style={[styles.statValue, { color: theme.text }]}>{mulheres}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setListaNaoIdAberta((v) => !v)}
              style={[styles.statChip, { borderColor: theme.border, backgroundColor: theme.accentMuted }]}
              accessibilityLabel="Ver nomes não identificados"
            >
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Não identificados</Text>
              <Text style={[styles.statValue, { color: theme.text }]}>{naoIdCount}</Text>
            </TouchableOpacity>
          </View>

          {resultadoGenero ? (
            <Text style={[styles.generoMeta, { color: theme.textMuted }]}>
              {resultadoGenero.total} na Planilha · {resultadoGenero.modificados} alterado
              {resultadoGenero.modificados !== 1 ? 's' : ''} nesta execução ·{' '}
              {resultadoGenero.jaCorretos} já com gênero salvo
              {resultadoGenero.jaCorretos !== 1 ? 's' : ''}
            </Text>
          ) : (
            <Text style={[styles.generoMeta, { color: theme.textMuted }]}>
              Carregando contadores da Planilha…
            </Text>
          )}

          {erroGenero ? (
            <Text style={[styles.erroBox, { color: theme.loss, borderColor: theme.loss }]}>{erroGenero}</Text>
          ) : null}

          {listaNaoIdAberta && resultadoGenero && resultadoGenero.naoIdentificados.length > 0 ? (
            <View style={styles.naoIdList}>
              <Text style={[styles.naoIdTitle, { color: theme.text }]}>
                Nomes não identificados ({resultadoGenero.naoIdentificados.length})
              </Text>
              <Text style={[styles.generoHint, { color: theme.textMuted }]}>
                O gênero marcado em cada linha é o mesmo do modal. Confirme todos de uma vez.
              </Text>
              <TouchableOpacity
                onPress={() => void salvarTodosGenerosMarcados()}
                disabled={salvandoLote || corrigindoGenero}
                style={[
                  styles.generoBtn,
                  { backgroundColor: theme.gain ?? theme.primary, opacity: salvandoLote ? 0.7 : 1 },
                ]}
                accessibilityLabel="Salvar todos os gêneros marcados"
              >
                {salvandoLote ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Wand2 size={18} color="#fff" strokeWidth={2.2} />
                )}
                <Text style={styles.generoBtnText}>
                  {salvandoLote
                    ? 'Salvando…'
                    : `Salvar todos os gêneros marcados (${resultadoGenero.naoIdentificados.length})`}
                </Text>
              </TouchableOpacity>
              {resultadoGenero.naoIdentificados.map((item) => {
                const marcado = marcacoesNaoId[item.id] ?? generoMarcadoNoModal(item.sexoAtual);
                return (
                  <View
                    key={item.id}
                    style={[styles.naoIdRow, { borderColor: theme.border }]}
                  >
                    <TouchableOpacity
                      onPress={() => abrirEdicaoNaoId(item)}
                      style={{ flex: 1 }}
                      accessibilityLabel={`Editar gênero de ${item.nome}`}
                    >
                      <Text style={[styles.cardEmail, { color: theme.text }]} numberOfLines={2}>
                        {item.nome}
                      </Text>
                      <Text style={[styles.cardMeta, { color: theme.textMuted }]}>
                        {item.nip ? `NIP ${item.nip} · ` : ''}
                        1º nome: {item.primeiroNome}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.sexoRowCompact}>
                      {(['M', 'F'] as const).map((sx) => {
                        const active = marcado === sx;
                        return (
                          <TouchableOpacity
                            key={sx}
                            onPress={() =>
                              setMarcacoesNaoId((prev) => ({ ...prev, [item.id]: sx }))
                            }
                            style={[
                              styles.sexoChip,
                              {
                                borderColor: active ? theme.primary : theme.border,
                                backgroundColor: active ? theme.accentMuted : 'transparent',
                              },
                            ]}
                          >
                            <Text style={{ color: theme.text, fontWeight: '800', fontSize: 12 }}>
                              {sx === 'M' ? 'M' : 'F'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <ChevronRight size={18} color={theme.textMuted} strokeWidth={2.2} />
                  </View>
                );
              })}
            </View>
          ) : null}
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
              else if (selectedBoss) {
                void abrirBoss(selectedBoss);
                void carregarTamanhoBanco();
              } else {
                void carregarTamanhoBanco();
              }
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

      <AppModal visible={editando != null} transparent animationType="fade" onRequestClose={() => setEditando(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Definir gênero</Text>
            <Text style={[styles.modalNome, { color: theme.text }]} numberOfLines={3}>
              {editando?.nome}
            </Text>
            {editando?.nip ? (
              <Text style={[styles.cardMeta, { color: theme.textMuted }]}>NIP {editando.nip}</Text>
            ) : null}

            <View style={styles.sexoRow}>
              {(['M', 'F'] as const).map((sx) => {
                const active = sexoEdicao === sx;
                return (
                  <TouchableOpacity
                    key={sx}
                    onPress={() => {
                      setSexoEdicao(sx);
                      if (editando) {
                        setMarcacoesNaoId((prev) => ({ ...prev, [editando.id]: sx }));
                      }
                    }}
                    style={[
                      styles.sexoBtn,
                      {
                        borderColor: active ? theme.primary : theme.border,
                        backgroundColor: active ? theme.accentMuted : 'transparent',
                      },
                    ]}
                  >
                    <Text style={{ color: theme.text, fontWeight: '800' }}>
                      {sx === 'M' ? 'Masculino' : 'Feminino'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setEditando(null)}
                style={[styles.modalBtn, { borderColor: theme.border }]}
                disabled={salvandoGenero}
              >
                <Text style={{ color: theme.text, fontWeight: '700' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void salvarEdicaoGenero()}
                style={[styles.modalBtnPrimary, { backgroundColor: theme.primary }]}
                disabled={salvandoGenero}
              >
                {salvandoGenero ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    minHeight: Platform.OS === 'web' ? ('100vh' as unknown as number) : undefined,
  },
  gateCenter: {
    alignItems: 'center',
    justifyContent: 'center',
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
  topBarActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  heading: { fontSize: 24, fontWeight: '800', marginBottom: 6 },
  sub: { fontSize: 14, lineHeight: 20 },
  sessionHint: { fontSize: 12, marginTop: 6, fontWeight: '600' },
  dbSizePanel: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusLg,
    padding: 16,
    marginBottom: 18,
  },
  dbSizeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dbSizeText: { flex: 1, gap: 4 },
  dbSizeLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  dbSizeValue: { fontSize: 28, fontWeight: '800' },
  dbSizeHint: { fontSize: 12, lineHeight: 16 },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
  },
  generoPanel: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusLg,
    padding: 16,
    marginBottom: 18,
    gap: 12,
  },
  generoTitle: { fontSize: 17, fontWeight: '800' },
  generoHint: { fontSize: 13, lineHeight: 18 },
  generoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: PREMIUM.radiusMd,
  },
  generoBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statChip: {
    flexGrow: 1,
    minWidth: 110,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  statLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  statValue: { fontSize: 22, fontWeight: '800' },
  generoMeta: { fontSize: 12, lineHeight: 16 },
  naoIdList: { gap: 8, marginTop: 4 },
  naoIdTitle: { fontSize: 14, fontWeight: '800' },
  naoIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    padding: 12,
    gap: 8,
  },
  sexoRowCompact: { flexDirection: 'row', gap: 6 },
  sexoChip: {
    minWidth: 36,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
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
    marginBottom: 4,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusLg,
    padding: 18,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalNome: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  sexoRow: { flexDirection: 'row', gap: 10 },
  sexoBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalBtnPrimary: {
    flex: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
});
