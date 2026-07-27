import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { getUiColors } from '../../../theme/uiColors';
import { getAllCadastros, type CadastroItemPersist } from '../../../services/cadastrosIndexedDb';
import {
  deleteRestritoByNip,
  formatDataDispensaInput,
  getAllRestritos,
  getRestritoByNip,
  isDispensaAtiva,
  saveRestrito,
  type RestritoRegistro,
} from '../../../services/restritosStorage';
import { buscarCadastroPorNomeOuNip } from '../../../utils/buscarCadastroPorNomeOuNip';
import { formatNipInput, nipDigitos } from '../../../utils/nipFormat';
import { getAplicarTafGlass } from './aplicarTafTheme';
import {
  AplicarTafBackLink,
  AplicarTafGlassPanel,
  AplicarTafInput,
  AplicarTafPrimaryButton,
  AplicarTafSectionHeader,
} from './AplicarTafUi';
import { ConfirmacaoExcluirRestritoModal } from './ConfirmacaoExcluirRestritoModal';
import { LabelNip } from '../../LabelNip';
import { PREMIUM } from '../../../theme/premium';

type Props = {
  onVoltar: () => void;
  onSalvo?: () => void;
};

export function AplicarTafRestritosPanel({ onVoltar, onSalvo }: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const glass = getAplicarTafGlass(theme);

  const [cadastros, setCadastros] = useState<CadastroItemPersist[]>([]);
  const [lista, setLista] = useState<RestritoRegistro[]>([]);
  const [nip, setNip] = useState('');
  const [nome, setNome] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [editandoExistente, setEditandoExistente] = useState(false);
  const [restritoParaExcluir, setRestritoParaExcluir] = useState<RestritoRegistro | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [buscaLista, setBuscaLista] = useState('');

  const recarregarLista = useCallback(async () => {
    try {
      const map = await getAllRestritos();
      const itens = Object.values(map).sort((a, b) =>
        (a.nome || '').localeCompare(b.nome || '', 'pt-BR'),
      );
      setLista(itens);
    } catch {
      setLista([]);
    }
  }, []);

  useEffect(() => {
    void getAllCadastros()
      .then(setCadastros)
      .catch(() => setCadastros([]));
    void recarregarLista();
  }, [recarregarLista]);

  const limparFormulario = useCallback(() => {
    setNip('');
    setNome('');
    setDataInicio('');
    setDataFim('');
    setFeedback(null);
    setErroSalvar(null);
    setEditandoExistente(false);
  }, []);

  const aplicarRegistroNoFormulario = useCallback((reg: RestritoRegistro) => {
    setNip(formatNipInput(reg.nip));
    setNome(reg.nome?.trim() || '');
    setDataInicio(reg.dataInicio || '');
    setDataFim(reg.dataFim || '');
    setErroSalvar(null);
    setSucesso(null);
    setEditandoExistente(true);
    setFeedback(
      isDispensaAtiva(reg)
        ? 'Dispensa ativa. Altere as datas e confirme para atualizar.'
        : 'Dispensa fora do período atual. Altere as datas e confirme para atualizar.',
    );
  }, []);

  const editarDaLista = useCallback(
    (reg: RestritoRegistro) => {
      aplicarRegistroNoFormulario(reg);
      setFeedback('Editando dispensa selecionada. Altere e toque em Atualizar dispensa.');
    },
    [aplicarRegistroNoFormulario],
  );

  const pedirExclusao = useCallback((reg: RestritoRegistro) => {
    setRestritoParaExcluir(reg);
    setErroSalvar(null);
    setSucesso(null);
  }, []);

  const carregarRestritoSalvo = useCallback(
    async (nipValor: string) => {
      const key = nipDigitos(nipValor);
      if (key.length !== 8) return;
      try {
        const reg = await getRestritoByNip(key);
        if (reg) {
          aplicarRegistroNoFormulario(reg);
        } else {
          setDataInicio('');
          setDataFim('');
          setEditandoExistente(false);
        }
      } catch {
        // silencioso
      }
    },
    [aplicarRegistroNoFormulario],
  );

  const sincronizarCampoPar = useCallback(
    (origem: 'nip' | 'nome', valor: string) => {
      const v = valor.trim();
      if (!v) {
        if (origem === 'nip') setNome('');
        else setNip('');
        setFeedback(null);
        setDataInicio('');
        setDataFim('');
        setEditandoExistente(false);
        return;
      }

      const resultado = buscarCadastroPorNomeOuNip(cadastros, valor);
      if (resultado.kind === 'found') {
        const nipFmt = formatNipInput(resultado.cadastro.nip ?? '');
        if (origem === 'nip') {
          setNome(resultado.cadastro.nome?.trim() ?? '');
        } else {
          setNip(nipFmt);
        }
        setFeedback('Militar cadastrado no sistema.');
        void carregarRestritoSalvo(nipFmt);
        return;
      }

      if (resultado.kind === 'ambiguous') {
        setFeedback(
          origem === 'nome'
            ? 'Vários cadastros correspondem ao nome. Informe o NIP completo.'
            : 'Vários cadastros com este NIP. Verifique o cadastro.',
        );
        return;
      }

      const digitos = valor.replace(/\D/g, '');
      if (origem === 'nip') {
        if (digitos.length === 8) {
          setFeedback('NIP não encontrado no cadastro.');
          setNome('');
          setDataInicio('');
          setDataFim('');
          setEditandoExistente(false);
        } else {
          setFeedback(null);
        }
      } else {
        setFeedback('Nome não encontrado no cadastro. Informe o NIP.');
      }
    },
    [cadastros, carregarRestritoSalvo],
  );

  const onChangeNip = useCallback(
    (text: string) => {
      const fmt = formatNipInput(text);
      setNip(fmt);
      setSucesso(null);
      setErroSalvar(null);
      sincronizarCampoPar('nip', fmt);
    },
    [sincronizarCampoPar],
  );

  const onChangeNome = useCallback(
    (text: string) => {
      setNome(text);
      setSucesso(null);
      setErroSalvar(null);
      sincronizarCampoPar('nome', text);
    },
    [sincronizarCampoPar],
  );

  const salvar = useCallback(async () => {
    const key = nipDigitos(nip);
    if (key.length !== 8) {
      setErroSalvar('Informe um NIP válido de militar cadastrado.');
      return;
    }
    if (!nome.trim()) {
      setErroSalvar('Informe o nome do militar.');
      return;
    }
    const busca = buscarCadastroPorNomeOuNip(cadastros, key);
    if (busca.kind !== 'found') {
      setErroSalvar('Só é possível restringir militares já cadastrados no sistema.');
      return;
    }

    setSalvando(true);
    setErroSalvar(null);
    setSucesso(null);
    try {
      await saveRestrito({
        nip: key,
        nome: nome.trim() || busca.cadastro.nome || '',
        dataInicio,
        dataFim,
      });
      setSucesso(editandoExistente ? 'Dispensa atualizada.' : 'Dispensa registrada.');
      setEditandoExistente(true);
      await recarregarLista();
      onSalvo?.();
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }, [nip, nome, dataInicio, dataFim, cadastros, editandoExistente, recarregarLista, onSalvo]);

  const listaFiltrada = useMemo(() => {
    const q = buscaLista.trim().toLowerCase();
    if (!q) return lista;
    const qDigitos = q.replace(/\D/g, '');
    return lista.filter((reg) => {
      const nomeOk = (reg.nome || '').toLowerCase().includes(q);
      const nipOk =
        qDigitos.length > 0 &&
        nipDigitos(reg.nip).includes(qDigitos);
      return nomeOk || nipOk;
    });
  }, [lista, buscaLista]);

  const confirmarExclusao = useCallback(async () => {
    if (!restritoParaExcluir) return;
    setExcluindo(true);
    try {
      await deleteRestritoByNip(restritoParaExcluir.nip);
      const nipExcluido = nipDigitos(restritoParaExcluir.nip);
      setRestritoParaExcluir(null);
      if (nipDigitos(nip) === nipExcluido) {
        limparFormulario();
      }
      setSucesso('Dispensa excluída.');
      await recarregarLista();
      onSalvo?.();
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : 'Não foi possível excluir.');
    } finally {
      setExcluindo(false);
    }
  }, [restritoParaExcluir, nip, limparFormulario, recarregarLista, onSalvo]);

  return (
    <>
      <AplicarTafGlassPanel accent="cyan">
        <AplicarTafBackLink label="Voltar ao início" onPress={onVoltar} />
        <AplicarTafSectionHeader
          kicker="DISPENSA"
          title="Restritos"
          subtitle="Localize o militar pelo NIP ou nome e informe o período da dispensa."
        />

        <View style={styles.fieldBlock}>
          <LabelNip color={ui.label} fontSize={11} fontWeight="800" />
          <AplicarTafInput
            value={nip}
            onChangeText={onChangeNip}
            placeholder="00.0000.00"
            keyboardType="number-pad"
            autoCorrect={false}
            accessibilityLabel="NIP do militar restrito"
          />
        </View>

        <View style={styles.fieldBlock}>
          <Text style={[ts.caption, styles.label, { color: ui.label }]}>Nome</Text>
          <AplicarTafInput
            value={nome}
            onChangeText={onChangeNome}
            placeholder="Nome do militar"
            autoCorrect={false}
            accessibilityLabel="Nome do militar restrito"
          />
        </View>

        {feedback ? (
          <Text style={[ts.caption, { color: theme.textSecondary, marginBottom: 8 }]}>{feedback}</Text>
        ) : null}

        <View style={styles.datesRow}>
          <View style={styles.dateCol}>
            <Text style={[ts.caption, styles.label, { color: ui.label }]}>Início da dispensa</Text>
            <AplicarTafInput
              value={dataInicio}
              onChangeText={(t) => {
                setDataInicio(formatDataDispensaInput(t));
                setErroSalvar(null);
                setSucesso(null);
              }}
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              autoCorrect={false}
              accessibilityLabel="Data de início da dispensa"
            />
          </View>
          <View style={styles.dateCol}>
            <Text style={[ts.caption, styles.label, { color: ui.label }]}>Fim da dispensa</Text>
            <AplicarTafInput
              value={dataFim}
              onChangeText={(t) => {
                setDataFim(formatDataDispensaInput(t));
                setErroSalvar(null);
                setSucesso(null);
              }}
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              autoCorrect={false}
              accessibilityLabel="Data de fim da dispensa"
            />
          </View>
        </View>

        {erroSalvar ? (
          <Text style={[ts.caption, { color: theme.error, marginBottom: 8 }]}>{erroSalvar}</Text>
        ) : null}
        {sucesso ? (
          <Text style={[ts.caption, { color: theme.success, marginBottom: 8 }]}>{sucesso}</Text>
        ) : null}

        <AplicarTafPrimaryButton
          label={editandoExistente ? 'Atualizar dispensa' : 'Salvar dispensa'}
          onPress={() => void salvar()}
          loading={salvando}
        />

        {editandoExistente ? (
          <View style={{ marginTop: 10 }}>
            <AplicarTafPrimaryButton
              label="Excluir dispensa"
              onPress={() =>
                pedirExclusao({
                  nip: nipDigitos(nip),
                  nome: nome.trim(),
                  dataInicio,
                  dataFim,
                  updatedAt: Date.now(),
                })
              }
              variant="outline"
            />
          </View>
        ) : null}

        {lista.length > 0 ? (
          <View style={styles.listaWrap}>
            <Text style={[ts.label, { color: theme.primary, marginBottom: 8 }]}>
              Dispensas registradas (
              {buscaLista.trim()
                ? `${listaFiltrada.length} de ${lista.length}`
                : lista.length}
              )
            </Text>
            <View style={styles.fieldBlock}>
              <Text style={[ts.caption, styles.label, { color: ui.label }]}>
                Buscar na lista
              </Text>
              <AplicarTafInput
                value={buscaLista}
                onChangeText={setBuscaLista}
                placeholder="NIP ou nome"
                autoCorrect={false}
                accessibilityLabel="Buscar dispensas registradas por NIP ou nome"
              />
            </View>
            {listaFiltrada.length === 0 ? (
              <Text style={[ts.caption, { color: theme.textMuted, marginBottom: 8 }]}>
                Nenhuma dispensa encontrada para “{buscaLista.trim()}”.
              </Text>
            ) : (
              <ScrollView style={styles.listaScroll} nestedScrollEnabled>
                {listaFiltrada.map((reg) => {
                  const ativo = isDispensaAtiva(reg);
                  return (
                    <View
                      key={reg.nip}
                      style={[
                        styles.listaItem,
                        {
                          borderColor: glass.border,
                          backgroundColor: theme.isDark
                            ? 'rgba(2,6,23,0.35)'
                            : 'rgba(255,255,255,0.55)',
                        },
                      ]}
                    >
                      <View style={styles.listaItemRow}>
                        <View style={styles.listaItemText}>
                          <Text style={[ts.body, { color: ui.text, fontWeight: '700' }]}>
                            {reg.nome || 'Sem nome'}
                          </Text>
                          <Text style={[ts.caption, { color: theme.textMuted }]}>
                            NIP {formatNipInput(reg.nip)} · {reg.dataInicio} → {reg.dataFim}
                            {ativo ? ' · Ativa' : ' · Fora do período'}
                          </Text>
                        </View>
                        <View style={styles.listaAcoes}>
                          <TouchableOpacity
                            accessibilityLabel={`Editar dispensa de ${reg.nome || reg.nip}`}
                            accessibilityRole="button"
                            onPress={() => editarDaLista(reg)}
                            style={[
                              styles.acaoBtn,
                              {
                                borderColor: theme.primary,
                                backgroundColor: theme.accentMuted,
                              },
                            ]}
                          >
                            <Pencil size={18} color={theme.primary} strokeWidth={2.3} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            accessibilityLabel={`Excluir dispensa de ${reg.nome || reg.nip}`}
                            accessibilityRole="button"
                            onPress={() => pedirExclusao(reg)}
                            style={[
                              styles.acaoBtn,
                              {
                                borderColor: theme.loss,
                                backgroundColor: theme.lossMuted,
                              },
                            ]}
                          >
                            <Trash2 size={18} color={theme.loss} strokeWidth={2.3} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        ) : null}
      </AplicarTafGlassPanel>

      <ConfirmacaoExcluirRestritoModal
        visible={restritoParaExcluir != null}
        nip={restritoParaExcluir?.nip ?? ''}
        nome={restritoParaExcluir?.nome ?? ''}
        loading={excluindo}
        onClose={() => {
          if (!excluindo) setRestritoParaExcluir(null);
        }}
        onConfirm={() => void confirmarExclusao()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fieldBlock: { marginBottom: 12, gap: 6 },
  label: { fontWeight: '800', letterSpacing: 0.3 },
  datesRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  dateCol: { flex: 1, gap: 6 },
  listaWrap: { marginTop: 18 },
  listaScroll: { maxHeight: 280 },
  listaItem: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  listaItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listaItemText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  listaAcoes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  acaoBtn: {
    width: PREMIUM.minTouch,
    height: PREMIUM.minTouch,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
