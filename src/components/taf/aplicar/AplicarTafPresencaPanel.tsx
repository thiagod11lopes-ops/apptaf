import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { getUiColors } from '../../../theme/uiColors';
import { getAllCadastros, type CadastroItemPersist } from '../../../services/cadastrosIndexedDb';
import {
  deletePresencaByNip,
  formatDataPresencaInput,
  getAllPresencas,
  getPresencaByNip,
  registrarPresenca,
  removerDataPresenca,
  type PresencaTfmRegistro,
} from '../../../services/presencaTfmStorage';
import { buscarCadastroPorNomeOuNip } from '../../../utils/buscarCadastroPorNomeOuNip';
import { formatNipInput, nipDigitos } from '../../../utils/nipFormat';
import { dataHojeBr } from '../../../utils/tafRegistro';
import { getAplicarTafGlass } from './aplicarTafTheme';
import {
  AplicarTafBackLink,
  AplicarTafGlassPanel,
  AplicarTafInput,
  AplicarTafPrimaryButton,
  AplicarTafSectionHeader,
} from './AplicarTafUi';
import { CadastroRapidoMilitarModal } from './CadastroRapidoMilitarModal';
import { LabelNip } from '../../LabelNip';
import { PREMIUM } from '../../../theme/premium';

type Props = {
  onVoltar: () => void;
};

export function AplicarTafPresencaPanel({ onVoltar }: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const glass = getAplicarTafGlass(theme);

  const [cadastros, setCadastros] = useState<CadastroItemPersist[]>([]);
  const [lista, setLista] = useState<PresencaTfmRegistro[]>([]);
  const [nip, setNip] = useState('');
  const [nome, setNome] = useState('');
  const [data, setData] = useState(dataHojeBr());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [buscaLista, setBuscaLista] = useState('');
  const [mostrarCadastroRapido, setMostrarCadastroRapido] = useState(false);
  const [nipNaoEncontrado, setNipNaoEncontrado] = useState(false);

  const recarregarLista = useCallback(async () => {
    try {
      const map = await getAllPresencas();
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
    setData(dataHojeBr());
    setFeedback(null);
    setErroSalvar(null);
    setSucesso(null);
    setNipNaoEncontrado(false);
  }, []);

  const carregarPresencaSalva = useCallback(async (nipValor: string) => {
    const key = nipDigitos(nipValor);
    if (key.length !== 8) return;
    try {
      const reg = await getPresencaByNip(key);
      if (reg) {
        setFeedback(
          `Militar com ${reg.datas.length} presença${reg.datas.length !== 1 ? 's' : ''} registrada${reg.datas.length !== 1 ? 's' : ''}. Informe a data e confirme para adicionar.`,
        );
      } else {
        setFeedback('Militar encontrado. Informe a data e registre a presença.');
      }
    } catch {
      // silencioso
    }
  }, []);

  const sincronizarCampoPar = useCallback(
    (origem: 'nip' | 'nome', valor: string) => {
      setNipNaoEncontrado(false);
      const v = valor.trim();
      if (!v) {
        if (origem === 'nip') setNome('');
        else setNip('');
        setFeedback(null);
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
        void carregarPresencaSalva(nipFmt);
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
          setNipNaoEncontrado(true);
        } else {
          setFeedback(null);
        }
      } else {
        setFeedback('Nome não encontrado no cadastro. Informe o NIP.');
      }
    },
    [cadastros, carregarPresencaSalva],
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
      setErroSalvar('Informe um NIP válido.');
      return;
    }
    if (!nome.trim()) {
      setErroSalvar('Informe o nome do militar.');
      return;
    }
    if (!data.trim()) {
      setErroSalvar('Informe a data da presença.');
      return;
    }

    setSalvando(true);
    setErroSalvar(null);
    setSucesso(null);
    try {
      await registrarPresenca({ nip: key, nome: nome.trim(), data: data.trim() });
      setSucesso(`Presença em ${data} registrada com sucesso.`);
      setData(dataHojeBr());
      await recarregarLista();
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : 'Não foi possível registrar.');
    } finally {
      setSalvando(false);
    }
  }, [nip, nome, data, recarregarLista]);

  const excluirMilitar = useCallback(
    async (reg: PresencaTfmRegistro) => {
      try {
        await deletePresencaByNip(reg.nip);
        const nipAtual = nipDigitos(nip);
        if (nipAtual === nipDigitos(reg.nip)) limparFormulario();
        setSucesso('Registros de presença excluídos.');
        await recarregarLista();
      } catch {
        setErroSalvar('Não foi possível excluir.');
      }
    },
    [nip, limparFormulario, recarregarLista],
  );

  const excluirData = useCallback(
    async (nipKey: string, dataAlvo: string) => {
      try {
        await removerDataPresenca(nipKey, dataAlvo);
        setSucesso(`Presença em ${dataAlvo} removida.`);
        await recarregarLista();
        // Recarrega feedback se ainda for o mesmo militar
        const key = nipDigitos(nip);
        if (key.length === 8 && key === nipDigitos(nipKey)) {
          await carregarPresencaSalva(nip);
        }
      } catch {
        setErroSalvar('Não foi possível remover a data.');
      }
    },
    [nip, recarregarLista, carregarPresencaSalva],
  );

  const onMilitarCadastrado = useCallback(
    async (cadastro: CadastroItemPersist) => {
      setMostrarCadastroRapido(false);
      const nipFmt = formatNipInput(cadastro.nip ?? '');
      setNip(nipFmt);
      setNome(cadastro.nome?.trim() ?? '');
      setFeedback('Militar cadastrado. Informe a data e registre a presença.');
      setNipNaoEncontrado(false);
      // Recarrega a lista de cadastros para que buscas futuras encontrem o novo militar
      try {
        const todos = await getAllCadastros();
        setCadastros(todos);
      } catch {
        // silencioso
      }
    },
    [],
  );

  const listaFiltrada = useMemo(() => {
    const q = buscaLista.trim().toLowerCase();
    if (!q) return lista;
    const qDigitos = q.replace(/\D/g, '');
    return lista.filter((reg) => {
      const nomeOk = (reg.nome || '').toLowerCase().includes(q);
      const nipOk = qDigitos.length > 0 && nipDigitos(reg.nip).includes(qDigitos);
      return nomeOk || nipOk;
    });
  }, [lista, buscaLista]);

  const totalPresencas = useMemo(
    () => lista.reduce((acc, r) => acc + (r.datas?.length ?? 0), 0),
    [lista],
  );

  return (
    <>
      <AplicarTafGlassPanel accent="cyan">
        <AplicarTafBackLink label="Voltar ao início" onPress={onVoltar} />
        <AplicarTafSectionHeader
          kicker="PRESENÇA"
          title="Presença TFM"
          subtitle="Localize o militar pelo NIP ou nome, informe a data e registre a presença. Caso o militar não esteja cadastrado, use o botão para cadastrá-lo rapidamente."
        />

        <View style={styles.fieldBlock}>
          <LabelNip color={ui.label} fontSize={11} fontWeight="800" />
          <AplicarTafInput
            value={nip}
            onChangeText={onChangeNip}
            placeholder="00.0000.00"
            keyboardType="number-pad"
            autoCorrect={false}
            accessibilityLabel="NIP do militar"
          />
        </View>

        <View style={styles.fieldBlock}>
          <Text style={[ts.caption, styles.label, { color: ui.label }]}>Nome</Text>
          <AplicarTafInput
            value={nome}
            onChangeText={onChangeNome}
            placeholder="Nome do militar"
            autoCorrect={false}
            accessibilityLabel="Nome do militar"
          />
        </View>

        {feedback ? (
          <Text style={[ts.caption, { color: theme.textSecondary, marginBottom: 8 }]}>
            {feedback}
          </Text>
        ) : null}

        {nipNaoEncontrado ? (
          <View style={{ marginBottom: 12 }}>
            <AplicarTafPrimaryButton
              label="Cadastrar militar"
              onPress={() => setMostrarCadastroRapido(true)}
              variant="outline"
            />
          </View>
        ) : null}

        <View style={styles.fieldBlock}>
          <Text style={[ts.caption, styles.label, { color: ui.label }]}>Data da presença</Text>
          <AplicarTafInput
            value={data}
            onChangeText={(t) => {
              setData(formatDataPresencaInput(t));
              setErroSalvar(null);
              setSucesso(null);
            }}
            placeholder="DD/MM/AAAA"
            keyboardType="number-pad"
            autoCorrect={false}
            accessibilityLabel="Data da presença"
          />
        </View>

        {erroSalvar ? (
          <Text style={[ts.caption, { color: theme.error, marginBottom: 8 }]}>{erroSalvar}</Text>
        ) : null}
        {sucesso ? (
          <Text style={[ts.caption, { color: theme.success, marginBottom: 8 }]}>{sucesso}</Text>
        ) : null}

        <AplicarTafPrimaryButton
          label="Registrar presença"
          onPress={() => void salvar()}
          loading={salvando}
        />

        {lista.length > 0 ? (
          <View style={styles.listaWrap}>
            <Text style={[ts.label, { color: theme.primary, marginBottom: 8 }]}>
              Presenças registradas —{' '}
              {buscaLista.trim()
                ? `${listaFiltrada.length} de ${lista.length} militar${lista.length !== 1 ? 'es' : ''}`
                : `${lista.length} militar${lista.length !== 1 ? 'es' : ''}`}{' '}
              · {totalPresencas} registro{totalPresencas !== 1 ? 's' : ''}
            </Text>

            <View style={styles.fieldBlock}>
              <Text style={[ts.caption, styles.label, { color: ui.label }]}>Buscar na lista</Text>
              <AplicarTafInput
                value={buscaLista}
                onChangeText={setBuscaLista}
                placeholder="NIP ou nome"
                autoCorrect={false}
                accessibilityLabel="Buscar presenças registradas"
              />
            </View>

            {listaFiltrada.length === 0 ? (
              <Text style={[ts.caption, { color: theme.textMuted, marginBottom: 8 }]}>
                Nenhum registro encontrado para "{buscaLista.trim()}".
              </Text>
            ) : (
              <ScrollView style={styles.listaScroll} nestedScrollEnabled>
                {listaFiltrada.map((reg) => (
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
                          NIP {formatNipInput(reg.nip)} ·{' '}
                          {reg.datas?.length ?? 0} presença{(reg.datas?.length ?? 0) !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        accessibilityLabel={`Excluir todas as presenças de ${reg.nome || reg.nip}`}
                        accessibilityRole="button"
                        onPress={() => void excluirMilitar(reg)}
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

                    {(reg.datas ?? []).length > 0 ? (
                      <View style={styles.datasWrap}>
                        {(reg.datas ?? []).map((d) => (
                          <View
                            key={d}
                            style={[
                              styles.dataChip,
                              {
                                backgroundColor: theme.isDark
                                  ? 'rgba(99,179,237,0.15)'
                                  : 'rgba(49,130,206,0.10)',
                                borderColor: theme.isDark
                                  ? 'rgba(99,179,237,0.35)'
                                  : 'rgba(49,130,206,0.25)',
                              },
                            ]}
                          >
                            <Text style={[ts.caption, { color: ui.text, fontWeight: '600' }]}>
                              {d}
                            </Text>
                            <TouchableOpacity
                              accessibilityLabel={`Remover presença em ${d} de ${reg.nome || reg.nip}`}
                              onPress={() => void excluirData(reg.nip, d)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <Text
                                style={[
                                  ts.caption,
                                  { color: theme.loss, fontWeight: '800', marginLeft: 6 },
                                ]}
                              >
                                ✕
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}
      </AplicarTafGlassPanel>

      <CadastroRapidoMilitarModal
        visible={mostrarCadastroRapido}
        nip={nipDigitos(nip)}
        onClose={() => setMostrarCadastroRapido(false)}
        onCadastrado={onMilitarCadastrado}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fieldBlock: { marginBottom: 12, gap: 6 },
  label: { fontWeight: '800', letterSpacing: 0.3 },
  listaWrap: { marginTop: 18 },
  listaScroll: { maxHeight: 320 },
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
  acaoBtn: {
    width: PREMIUM.minTouch,
    height: PREMIUM.minTouch,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datasWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  dataChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
