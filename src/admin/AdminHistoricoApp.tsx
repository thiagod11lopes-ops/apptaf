import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Plus, Pencil, Trash2, ExternalLink, RefreshCw } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { ConfirmacaoExcluirSessaoModal } from './ConfirmacaoExcluirSessaoModal';
import { SessaoHistoricoEditor, type SessaoDraft } from './SessaoHistoricoEditor';
import {
  addSessaoAplicacao,
  deleteSessaoAplicacao,
  getAllSessoesAplicacao,
  tituloTipoProva,
  updateSessaoAplicacao,
  type SessaoAplicacaoTaf,
} from '../services/resultadosAplicadosIndexedDb';
import { ADMIN_HISTORICO_PATH, adminHistoricoEntryUrls } from '../utils/adminHistoricoAccess';
import { persistirRubricasNoCadastro } from '../utils/persistirRubricaCadastro';
import { PREMIUM } from '../theme/premium';
import { getUiColors } from '../theme/uiColors';

type Modo = 'lista' | 'editar' | 'criar';

export function AdminHistoricoApp() {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const [sessoes, setSessoes] = useState<SessaoAplicacaoTaf[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modo, setModo] = useState<Modo>('lista');
  const [sessaoAtual, setSessaoAtual] = useState<SessaoAplicacaoTaf | null>(null);
  const [sessaoParaExcluir, setSessaoParaExcluir] = useState<SessaoAplicacaoTaf | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const entryUrls = useMemo(() => adminHistoricoEntryUrls(), []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const lista = await getAllSessoesAplicacao();
      setSessoes(lista);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Admin — Histórico TAF';
    }
  }, []);

  const voltarLista = useCallback(() => {
    setModo('lista');
    setSessaoAtual(null);
  }, []);

  const executarExclusao = useCallback(async () => {
    if (!sessaoParaExcluir) return;
    setExcluindo(true);
    setErroExclusao(null);
    try {
      await deleteSessaoAplicacao(sessaoParaExcluir.id);
      setSessaoParaExcluir(null);
      await carregar();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não foi possível excluir a sessão.';
      setErroExclusao(msg);
    } finally {
      setExcluindo(false);
    }
  }, [sessaoParaExcluir, carregar]);

  const salvarDraft = useCallback(
    async (draft: SessaoDraft) => {
      if (draft.id && draft.criadoEm) {
        const sessao: SessaoAplicacaoTaf = {
          id: draft.id,
          criadoEm: draft.criadoEm,
          dataAplicacao: draft.dataAplicacao,
          tipoProva: draft.tipoProva,
          resultados: draft.resultados,
        };
        await updateSessaoAplicacao(sessao);
      } else {
        await addSessaoAplicacao({
          dataAplicacao: draft.dataAplicacao,
          tipoProva: draft.tipoProva,
          resultados: draft.resultados,
        });
      }
      await persistirRubricasNoCadastro(
        draft.resultados.map((r) => ({ ...r, prova: r.prova ?? draft.tipoProva })),
      );
      await carregar();
      voltarLista();
    },
    [carregar, voltarLista],
  );

  const abrirAppPrincipal = useCallback(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const root = `${window.location.origin}/`;
    if (window.location.pathname !== '/') {
      window.location.href = root;
    } else {
      window.location.search = '';
      window.location.hash = '';
    }
  }, []);

  if (modo === 'editar' || modo === 'criar') {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <SessaoHistoricoEditor
          initial={modo === 'editar' ? sessaoAtual : null}
          onSave={salvarDraft}
          onCancel={voltarLista}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <View style={styles.topBarText}>
            <Text style={[styles.heading, { color: theme.text }]}>Admin — Histórico TAF</Text>
            <Text style={[styles.sub, { color: theme.textMuted }]}>
              Gerencie os cards exibidos em Resultados → Histórico (mesmo banco IndexedDB do app).
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

        <View style={[styles.urlBox, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Text style={[styles.urlTitle, { color: theme.textMuted }]}>Endereço deste painel (web)</Text>
          <Text style={[styles.urlPath, { color: theme.primary }]} selectable>
            {entryUrls[0] || ADMIN_HISTORICO_PATH}
          </Text>
          <Text style={[styles.urlHint, { color: theme.textMuted }]}>
            Alternativas: <Text selectable>{entryUrls[2]}</Text> ou <Text selectable>{entryUrls[1]}</Text>
          </Text>
        </View>

        <View style={styles.toolbar}>
          <TouchableOpacity
            onPress={() => void carregar()}
            style={[styles.toolBtn, { borderColor: theme.border }]}
            accessibilityLabel="Atualizar lista"
          >
            <RefreshCw size={18} color={ui.icon} strokeWidth={2.2} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setSessaoAtual(null);
              setModo('criar');
            }}
            style={[styles.toolBtnPrimary, { backgroundColor: theme.primary }]}
          >
            <Plus size={18} color="#fff" strokeWidth={2.5} />
            <Text style={styles.toolBtnPrimaryText}>Nova sessão</Text>
          </TouchableOpacity>
        </View>

        {carregando ? <ActivityIndicator color={theme.primary} style={styles.loader} /> : null}

        {!carregando && sessoes.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textMuted }]}>
            Nenhuma sessão no histórico. Crie uma nova ou aplique TAF no app principal.
          </Text>
        ) : null}

        {erroExclusao ? (
          <Text style={[styles.erroBox, { color: theme.loss, borderColor: theme.loss }]}>{erroExclusao}</Text>
        ) : null}

        {sessoes.map((sessao) => {
          const qtd = sessao.resultados.length;
          const aprovados = sessao.resultados.filter(
            (r) => r.notaTexto !== 'REPROVADO' && !r.reprovacaoTexto,
          ).length;

          return (
            <View
              key={sessao.id}
              style={[styles.card, { borderColor: theme.border, backgroundColor: theme.surface }]}
            >
              <View style={styles.cardBody}>
                <Text style={[styles.cardTipo, { color: theme.primary }]}>
                  {tituloTipoProva(sessao.tipoProva)}
                </Text>
                <Text style={[styles.cardData, { color: theme.text }]}>{sessao.dataAplicacao}</Text>
                <Text style={[styles.cardMeta, { color: theme.textMuted }]}>
                  {qtd} participante{qtd !== 1 ? 's' : ''}
                  {sessao.tipoProva === 'permanencia'
                    ? ` · ${aprovados} aprovado${aprovados !== 1 ? 's' : ''}`
                    : null}
                </Text>
                <Text style={[styles.cardId, { color: theme.textMuted }]} numberOfLines={1}>
                  ID: {sessao.id}
                </Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  onPress={() => {
                    setSessaoAtual(sessao);
                    setModo('editar');
                  }}
                  style={[styles.iconBtn, { borderColor: theme.border }]}
                  accessibilityLabel="Editar sessão"
                >
                  <Pencil size={18} color={ui.icon} strokeWidth={2.2} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setErroExclusao(null);
                    setSessaoParaExcluir(sessao);
                  }}
                  style={[styles.iconBtn, { borderColor: theme.loss }]}
                  accessibilityLabel="Excluir sessão"
                >
                  <Trash2 size={18} color={theme.loss} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <ConfirmacaoExcluirSessaoModal
        sessao={sessaoParaExcluir}
        loading={excluindo}
        onClose={() => {
          if (!excluindo) setSessaoParaExcluir(null);
        }}
        onConfirm={() => void executarExclusao()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', minHeight: Platform.OS === 'web' ? ('100vh' as unknown as number) : undefined },
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
  urlBox: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusLg,
    padding: 14,
    marginBottom: 16,
  },
  urlTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  urlPath: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  urlHint: { fontSize: 12, lineHeight: 18 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  toolBtn: {
    padding: 12,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
  },
  toolBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: PREMIUM.radiusMd,
  },
  toolBtnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  loader: { marginVertical: 24 },
  empty: { textAlign: 'center', fontSize: 14, marginTop: 12 },
  erroBox: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    padding: 10,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: PREMIUM.radiusLg,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  cardBody: { flex: 1, paddingRight: 8 },
  cardTipo: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  cardData: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  cardMeta: { fontSize: 13, marginTop: 6 },
  cardId: { fontSize: 10, marginTop: 6, fontFamily: Platform.select({ default: 'monospace' }) },
  cardActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    padding: 10,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
  },
});
