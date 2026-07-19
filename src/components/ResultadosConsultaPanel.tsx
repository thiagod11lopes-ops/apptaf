import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Search, Download, Trash2, Pencil } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Card } from './Card';
import { LabelNip } from './LabelNip';
import { PressableScale } from './premium/PressableScale';
import { ConfirmacaoExcluirResultadoModal } from './sismav/ConfirmacaoExcluirResultadoModal';
import { ConfirmacaoGerarResultadosPdfModal } from './sismav/ConfirmacaoGerarResultadosPdfModal';
import { EditarResultadoTafModal } from './sismav/EditarResultadoTafModal';
import { HistoricoCalendarioTaf } from './sismav/HistoricoCalendarioTaf';
import { addCadastro, getAllCadastros, type CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { getAllSessoesAplicacao, type SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import { unificarSessoesComCadastroRegistrador } from '../utils/sessoesUnificadasResultados';
import { ProvaComColunaRubrica } from './ProvaComColunaRubrica';
import { buscarCadastroPorNomeOuNip } from '../utils/buscarCadastroPorNomeOuNip';
import { formatNipInput, nipDigitos } from '../utils/nipFormat';
import {
  cadastroComAlgumResultadoTaf,
  cadastroParaLinhaResultado,
  filtrarCadastrosPorNipNome,
  mesclarRubricasNaLinha,
  temAvaliacaoCorrida,
  temAvaliacaoCaminhada,
  temAvaliacaoNatacao,
  temAvaliacaoPermanencia,
  type ResultadoTafLinha,
} from '../utils/resultadoTafCadastro';
import {
  carregarRubricasDasSessoesPorNip,
  mesclarRubricas,
  type RubricasPorNip,
} from '../utils/rubricasDasSessoes';
import { carregarRubricasCadastrosPorIds } from '../utils/carregarRubricasCadastro';
import {
  limparResultadoModalidadeCadastro,
  type ModalidadeResultadoTaf,
} from '../utils/limparResultadoModalidade';
import { removerParticipanteModalidadeDoHistorico } from '../utils/registroModalidadeHistorico';
import {
  exportResultadosTafPdf,
  estimarFolhasA4PdfResultadosTaf,
} from '../utils/exportResultadosTafPdf';
import { listarResultadosCompletosFromHistorico, enriquecerLinhasDistanciaMetaFromHistorico } from '../utils/resultadoGeralHistorico';
import { cadastroComResultadoNorma, prepararDadosResultadosNorma, type NormaTafVista } from '../utils/normaTafResultados';
import { modalidadeCorridaCaminhadaDispensavel } from '../utils/corridaCaminhadaExcludente';
import type { ConfirmacaoGerarResultadosPdfInfo } from './sismav/ConfirmacaoGerarResultadosPdfModal';
import { PREMIUM } from '../theme/premium';
import { tableFullWidthStyle } from '../theme/tableLayout';
import { getUiColors } from '../theme/uiColors';

function situacaoStyle(situacao: string, theme: { gain: string; loss: string; textMuted: string }) {
  if (situacao === 'Aprovado') return { color: theme.gain, fontWeight: '700' as const };
  if (situacao === 'Reprovado') return { color: theme.loss, fontWeight: '700' as const };
  return { color: theme.textMuted };
}

function linhaCombinaNipNome(l: ResultadoTafLinha, nipRaw: string, nomeRaw: string): boolean {
  const nipQ = nipDigitos(nipRaw);
  const nomeQ = nomeRaw.trim().toLowerCase();
  if (nipQ) {
    const d = nipDigitos(l.nip);
    if (nipQ.length >= 8) {
      if (d !== nipQ) return false;
    } else if (!d.startsWith(nipQ)) {
      return false;
    }
  }
  if (nomeQ.length >= 3) {
    return (l.nome || '').toLowerCase().includes(nomeQ);
  }
  if (nomeQ) {
    const n = (l.nome || '').toLowerCase();
    return n === nomeQ || n.startsWith(nomeQ);
  }
  return true;
}

function linhasCompletasHistoricoComRubricas(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: Awaited<ReturnType<typeof getAllCadastros>>,
  rubricasSessoes: Map<string, RubricasPorNip>,
  rubricasCadastros: Map<string, RubricasPorNip>,
): ResultadoTafLinha[] {
  return listarResultadosCompletosFromHistorico(sessoes, cadastros).map((linha) => {
    const key = nipDigitos(linha.nip);
    const rub = mesclarRubricas(
      rubricasCadastros.get(linha.id) ?? {},
      key ? rubricasSessoes.get(key) : undefined,
    );
    return mesclarRubricasNaLinha(linha, rub);
  });
}

function linhasComRubricasMescladas(
  cadastros: Awaited<ReturnType<typeof getAllCadastros>>,
  rubricasSessoes: Map<string, RubricasPorNip>,
  rubricasCadastros: Map<string, RubricasPorNip>,
  sessoes: SessaoAplicacaoTaf[] = [],
): ResultadoTafLinha[] {
  const linhas = cadastros
    .filter(cadastroComAlgumResultadoTaf)
    .map((c) => {
      const linha = cadastroParaLinhaResultado(c);
      const key = nipDigitos(c.nip);
      const rub = mesclarRubricas(
        rubricasCadastros.get(c.id) ?? {},
        key ? rubricasSessoes.get(key) : undefined,
      );
      return mesclarRubricasNaLinha(linha, rub);
    });
  return sessoes.length > 0
    ? enriquecerLinhasDistanciaMetaFromHistorico(linhas, sessoes, cadastros)
    : linhas;
}

export function ResultadosConsultaPanel({ normaTaf = 'armada' }: { normaTaf?: NormaTafVista }) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);

  const [nip, setNip] = useState('');
  const [nome, setNome] = useState('');
  const [linhas, setLinhas] = useState<ResultadoTafLinha[]>([]);
  const [buscou, setBuscou] = useState(false);
  const [mensagemBusca, setMensagemBusca] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregandoPdf, setCarregandoPdf] = useState(false);
  const [modalGerarPdf, setModalGerarPdf] = useState<
    (ConfirmacaoGerarResultadosPdfInfo & { linhas: ResultadoTafLinha[] }) | null
  >(null);
  const [todosCadastros, setTodosCadastros] = useState<Awaited<ReturnType<typeof getAllCadastros>>>([]);
  const [sessoesHistorico, setSessoesHistorico] = useState<SessaoAplicacaoTaf[]>([]);
  const [rubricasSessoes, setRubricasSessoes] = useState<Map<string, RubricasPorNip>>(new Map());
  const [excluindo, setExcluindo] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState<{
    cadastroId: string;
    nome: string;
    nip: string;
    modalidade: ModalidadeResultadoTaf;
  } | null>(null);
  const [cadastroEmEdicao, setCadastroEmEdicao] = useState<CadastroItemPersist | null>(null);

  const carregarBase = useCallback(async () => {
    const [lista, sessoes] = await Promise.all([
      getAllCadastros(),
      getAllSessoesAplicacao(),
    ]);
    // Lista completa para busca por NIP / Cadastrar Resultados (inclui quem ainda não tem TAF).
    // O filtro por norma vale só para o histórico de sessões exibido.
    const { sessoesNorma } = prepararDadosResultadosNorma(sessoes, lista, normaTaf);
    setTodosCadastros(lista);
    setSessoesHistorico(sessoesNorma);
    return lista;
  }, [normaTaf]);

  useFocusEffect(
    useCallback(() => {
      void carregarBase();
    }, [carregarBase]),
  );

  const sincronizarCampoPar = useCallback(
    (origem: 'nip' | 'nome', valor: string) => {
      const v = valor.trim();
      if (!v) {
        if (origem === 'nip') setNome('');
        else setNip('');
        return;
      }
      const resultado = buscarCadastroPorNomeOuNip(todosCadastros, valor);
      if (resultado.kind !== 'found') return;
      if (origem === 'nip') {
        setNome(resultado.cadastro.nome?.trim() ?? '');
      } else {
        setNip(formatNipInput(resultado.cadastro.nip ?? ''));
      }
    },
    [todosCadastros],
  );

  const onChangeNip = useCallback(
    (texto: string) => {
      const formatado = formatNipInput(texto);
      setNip(formatado);
      sincronizarCampoPar('nip', formatado);
    },
    [sincronizarCampoPar],
  );

  const onChangeNome = useCallback(
    (texto: string) => {
      setNome(texto);
      sincronizarCampoPar('nome', texto);
    },
    [sincronizarCampoPar],
  );

  const executarBusca = useCallback(async () => {
    setAviso(null);
    setMensagemBusca(null);
    const nipTrim = nip.trim();
    const nomeTrim = nome.trim();
    if (!nipTrim && !nomeTrim) {
      setLinhas([]);
      setBuscou(false);
      setAviso('Informe o NIP ou o nome para buscar.');
      return;
    }

    const lista = todosCadastros.length ? todosCadastros : await carregarBase();
    const cadastrados = filtrarCadastrosPorNipNome(lista, nipTrim, nomeTrim, {
      somenteComResultadoTaf: false,
    });
    const comResultado = cadastrados.filter((c) => cadastroComResultadoNorma(c, normaTaf));

    const [rubSessoes, rubCadastros] = await Promise.all([
      carregarRubricasDasSessoesPorNip(),
      carregarRubricasCadastrosPorIds(comResultado.map((c) => c.id)),
    ]);
    setRubricasSessoes(rubSessoes);

    setBuscou(true);
    const sessoes = sessoesHistorico.length
      ? sessoesHistorico
      : unificarSessoesComCadastroRegistrador(await getAllSessoesAplicacao(), lista);
    setLinhas(linhasComRubricasMescladas(comResultado, rubSessoes, rubCadastros, sessoes));

    if (cadastrados.length === 0) {
      setMensagemBusca('Dados não Encontrados no Sistema');
    } else if (comResultado.length === 0) {
      setMensagemBusca('Militar Cadastrado não realizou TAF');
    }
  }, [nip, nome, todosCadastros, carregarBase, sessoesHistorico, normaTaf]);

  const handleGerarResultados = useCallback(async () => {
    setAviso(null);

    const lista = todosCadastros.length ? todosCadastros : await carregarBase();
    const sessoesRaw = sessoesHistorico.length ? sessoesHistorico : await getAllSessoesAplicacao();
    const sessoes = unificarSessoesComCadastroRegistrador(sessoesRaw, lista);
    const baseLinhas = listarResultadosCompletosFromHistorico(sessoes, lista);
    const [rubSessoes, rubCadastros] = await Promise.all([
      rubricasSessoes.size > 0 ? Promise.resolve(rubricasSessoes) : carregarRubricasDasSessoesPorNip(),
      carregarRubricasCadastrosPorIds(baseLinhas.map((l) => l.id)),
    ]);
    let linhasPdf = linhasCompletasHistoricoComRubricas(sessoes, lista, rubSessoes, rubCadastros);

    let subtitulo =
      'Integrantes com TAF completo (corrida, natação e permanência) — Aplicar TAF e Registrador';

    const nipTrim = nip.trim();
    const nomeTrim = nome.trim();
    if (nipTrim || nomeTrim) {
      if (!buscou) {
        setAviso('Busque um militar antes de gerar o PDF filtrado.');
        return;
      }
      linhasPdf = linhasPdf.filter((l) => linhaCombinaNipNome(l, nipTrim, nomeTrim));
      if (linhasPdf.length === 0) {
        setAviso('Este militar não completou as três provas no histórico.');
        return;
      }
      subtitulo = `Filtro: ${[nipTrim && `NIP ${nipTrim}`, nomeTrim && `Nome ${nomeTrim}`]
        .filter(Boolean)
        .join(' · ')} · TAF completo`;
    } else if (linhasPdf.length === 0) {
      setAviso('Nenhum militar com TAF completo no histórico.');
      return;
    }

    setModalGerarPdf({
      linhas: linhasPdf,
      subtitulo,
      qtdMilitares: linhasPdf.length,
      folhasA4: estimarFolhasA4PdfResultadosTaf(linhasPdf.length),
    });
  }, [
    nip,
    nome,
    buscou,
    todosCadastros,
    sessoesHistorico,
    rubricasSessoes,
    carregarBase,
    getAllSessoesAplicacao,
  ]);

  const confirmarGerarPdf = useCallback(async () => {
    if (!modalGerarPdf) return;
    setCarregandoPdf(true);
    try {
      await exportResultadosTafPdf(modalGerarPdf.linhas, modalGerarPdf.subtitulo);
      setModalGerarPdf(null);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Falha ao gerar PDF.');
    } finally {
      setCarregandoPdf(false);
    }
  }, [modalGerarPdf]);

  const executarExclusaoModalidade = useCallback(async () => {
    if (!confirmarExclusao) return;
    setExcluindo(true);
    setAviso(null);
    try {
      const lista = todosCadastros.length ? todosCadastros : await carregarBase();
      const cadastro = lista.find((c) => c.id === confirmarExclusao.cadastroId);
      if (!cadastro) {
        setAviso('Cadastro não encontrado.');
        return;
      }
      const atualizado = limparResultadoModalidadeCadastro(cadastro, confirmarExclusao.modalidade);
      await addCadastro(atualizado);
      await removerParticipanteModalidadeDoHistorico(
        atualizado.nip,
        confirmarExclusao.modalidade,
        atualizado,
      );
      const sessoes = await getAllSessoesAplicacao();
      const novaBase = lista.map((c) => (c.id === atualizado.id ? atualizado : c));
      setTodosCadastros(novaBase);
      setSessoesHistorico(unificarSessoesComCadastroRegistrador(sessoes, novaBase));
      setLinhas((prev) => {
        if (!cadastroComAlgumResultadoTaf(atualizado)) {
          setMensagemBusca('Militar Cadastrado não realizou TAF');
          return prev.filter((l) => l.id !== atualizado.id);
        }
        const key = nipDigitos(atualizado.nip);
        const rubCadastro: RubricasPorNip = {
          corrida: atualizado.rubricaCorridaSvg,
          natacao: atualizado.rubricaNatacaoSvg,
          permanencia: atualizado.rubricaPermanenciaSvg,
        };
        const rub = mesclarRubricas(rubCadastro, key ? rubricasSessoes.get(key) : undefined);
        const linha = mesclarRubricasNaLinha(cadastroParaLinhaResultado(atualizado), rub);
        return prev.map((l) => (l.id === atualizado.id ? linha : l));
      });
      setConfirmarExclusao(null);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível excluir o resultado.');
    } finally {
      setExcluindo(false);
    }
  }, [confirmarExclusao, todosCadastros, rubricasSessoes, carregarBase]);

  const aoSalvarEdicao = useCallback(
    async (atualizado: CadastroItemPersist) => {
      setAviso(null);
      const novaBase = todosCadastros.map((c) => (c.id === atualizado.id ? atualizado : c));
      setTodosCadastros(novaBase);

      const sessoes = await getAllSessoesAplicacao();
      setSessoesHistorico(unificarSessoesComCadastroRegistrador(sessoes, novaBase));

      const key = nipDigitos(atualizado.nip);
      const [rubSessoes, rubCadastros] = await Promise.all([
        carregarRubricasDasSessoesPorNip(),
        carregarRubricasCadastrosPorIds([atualizado.id]),
      ]);
      setRubricasSessoes(rubSessoes);

      if (cadastroComAlgumResultadoTaf(atualizado)) {
        const rub = mesclarRubricas(
          rubCadastros.get(atualizado.id) ?? {},
          key ? rubSessoes.get(key) : undefined,
        );
        const linha = mesclarRubricasNaLinha(cadastroParaLinhaResultado(atualizado), rub);
        setLinhas((prev) => prev.map((l) => (l.id === atualizado.id ? linha : l)));
        setMensagemBusca(null);
      } else {
        setLinhas((prev) => prev.filter((l) => l.id !== atualizado.id));
        setMensagemBusca('Militar Cadastrado não realizou TAF');
      }
    },
    [todosCadastros],
  );

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.cardBg,
      borderColor: theme.border,
      color: theme.text,
    },
    Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {},
  ];

  return (
    <View style={styles.wrap}>
      <Text style={[ts.bodySecondary, styles.intro, { color: theme.textSecondary }]}>
        Calendário das aplicações registradas no histórico e busca por NIP ou nome para gerenciar
        resultados individuais.
      </Text>

      <HistoricoCalendarioTaf
        sessoes={sessoesHistorico}
        cadastros={todosCadastros}
        onAviso={setAviso}
        onResultadosCadastrados={() => {
          void carregarBase();
        }}
      />

      <Card elevated style={styles.formCard}>
        <View style={styles.field}>
          <LabelNip color={theme.text} fontSize={14} fontWeight={600} />
          <TextInput
            value={nip}
            onChangeText={onChangeNip}
            placeholder="00.0000.00"
            placeholderTextColor={theme.textMuted}
            style={inputStyle}
            keyboardType="numeric"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={[ts.label, styles.labelGap]}>Nome</Text>
          <TextInput
            value={nome}
            onChangeText={onChangeNome}
            placeholder="Nome do militar"
            placeholderTextColor={theme.textMuted}
            style={inputStyle}
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          accessibilityLabel="Buscar resultado"
          onPress={() => void executarBusca()}
          style={[styles.btnBuscar, { backgroundColor: theme.primary }]}
        >
          <Search size={18} color={theme.text} strokeWidth={2.2} />
          <Text style={[ts.caption, styles.btnBuscarText, { color: theme.text }]}>Buscar</Text>
        </TouchableOpacity>
      </Card>

      <TouchableOpacity
        accessibilityLabel="Gerar Resultados"
        disabled={carregandoPdf}
        onPress={() => void handleGerarResultados()}
        style={[
          styles.btnDownload,
          { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
          carregandoPdf ? { opacity: 0.7 } : null,
        ]}
      >
        {carregandoPdf ? (
          <ActivityIndicator color={theme.primary} size="small" />
        ) : (
          <>
            <Download size={18} color={theme.text} strokeWidth={2.2} />
            <Text style={[ts.caption, styles.btnDownloadText, { color: theme.text }]}>
              Gerar Resultados
            </Text>
          </>
        )}
      </TouchableOpacity>

      {aviso ? (
        <Text style={[ts.caption, styles.aviso, { color: theme.loss }]}>{aviso}</Text>
      ) : null}

      {buscou && mensagemBusca && linhas.length === 0 ? (
        <View style={[styles.infoBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
          <Text style={[ts.body, styles.infoText, { color: theme.text }]}>{mensagemBusca}</Text>
        </View>
      ) : null}

      {linhas.map((r) => {
        const cadastro = todosCadastros.find((c) => c.id === r.id);
        const podeExcluirCorrida = cadastro ? temAvaliacaoCorrida(cadastro) : r.notaCorrida !== '—';
        const podeExcluirCaminhada = cadastro
          ? temAvaliacaoCaminhada(cadastro)
          : r.notaCaminhada !== '—';
        const podeExcluirNatacao = cadastro ? temAvaliacaoNatacao(cadastro) : r.notaNatacao !== '—';
        const podeExcluirPermanencia = cadastro
          ? temAvaliacaoPermanencia(cadastro)
          : r.permanenciaTempo !== '—';

        const abrirExclusao = (modalidade: ModalidadeResultadoTaf) => {
          setConfirmarExclusao({
            cadastroId: r.id,
            nome: r.nome,
            nip: r.nip,
            modalidade,
          });
        };

        return (
          <Card key={r.id} elevated style={styles.resultCard}>
            <View style={styles.resultCardHeader}>
              <View style={styles.resultCardTitulo}>
                <Text style={[ts.label, { color: theme.primary }]}>NIP</Text>
                <Text style={[ts.body, { color: ui.text, marginBottom: 4 }]}>{r.nip}</Text>
                <Text style={[ts.label, { color: theme.primary }]}>Nome</Text>
                <Text style={[ts.h2, { color: ui.text, fontSize: 18 }]}>{r.nome}</Text>
              </View>
              {cadastro ? (
                <PressableScale
                  onPress={() => setCadastroEmEdicao(cadastro)}
                  style={[styles.editBtn, { borderColor: theme.border }]}
                  accessibilityLabel={`Editar resultados de ${r.nome}`}
                >
                  <Pencil size={18} color={theme.primary} strokeWidth={2.2} />
                </PressableScale>
              ) : null}
            </View>

            <ProvaComColunaRubrica
              titulo="Corrida"
              rubricaSvg={r.rubricaCorridaSvg}
              dispensavel={modalidadeCorridaCaminhadaDispensavel(r, 'corrida')}
              headerRight={
                podeExcluirCorrida ? (
                  <PressableScale
                    onPress={() => abrirExclusao('corrida')}
                    style={[styles.trashBtn, { borderColor: theme.border }]}
                    accessibilityLabel="Excluir resultado de corrida"
                  >
                    <Trash2 size={16} color={theme.loss} strokeWidth={2.2} />
                  </PressableScale>
                ) : null
              }
            >
              <View style={styles.provaRow}>
                <Text style={[ts.caption, { color: theme.textMuted }]}>Nota: </Text>
                <Text style={[ts.body, { color: ui.text, fontWeight: '700' }]}>{r.notaCorrida}</Text>
              </View>
              <Text style={[ts.caption, situacaoStyle(r.situacaoCorrida, theme)]}>
                {r.situacaoCorrida}
              </Text>
            </ProvaComColunaRubrica>

            <ProvaComColunaRubrica
              titulo="Caminhada"
              rubricaSvg={r.rubricaCaminhadaSvg}
              dispensavel={modalidadeCorridaCaminhadaDispensavel(r, 'caminhada')}
              headerRight={
                podeExcluirCaminhada ? (
                  <PressableScale
                    onPress={() => abrirExclusao('caminhada')}
                    style={[styles.trashBtn, { borderColor: theme.border }]}
                    accessibilityLabel="Excluir resultado de caminhada"
                  >
                    <Trash2 size={16} color={theme.loss} strokeWidth={2.2} />
                  </PressableScale>
                ) : null
              }
            >
              <View style={styles.provaRow}>
                <Text style={[ts.caption, { color: theme.textMuted }]}>Nota: </Text>
                <Text style={[ts.body, { color: ui.text, fontWeight: '700' }]}>{r.notaCaminhada}</Text>
              </View>
              <Text style={[ts.caption, situacaoStyle(r.situacaoCaminhada, theme)]}>
                {r.situacaoCaminhada}
              </Text>
            </ProvaComColunaRubrica>

            <ProvaComColunaRubrica
              titulo="Natação"
              rubricaSvg={r.rubricaNatacaoSvg}
              headerRight={
                podeExcluirNatacao ? (
                  <PressableScale
                    onPress={() => abrirExclusao('natacao')}
                    style={[styles.trashBtn, { borderColor: theme.border }]}
                    accessibilityLabel="Excluir resultado de natação"
                  >
                    <Trash2 size={16} color={theme.loss} strokeWidth={2.2} />
                  </PressableScale>
                ) : null
              }
            >
              <View style={styles.provaRow}>
                <Text style={[ts.caption, { color: theme.textMuted }]}>Nota: </Text>
                <Text style={[ts.body, { color: ui.text, fontWeight: '700' }]}>{r.notaNatacao}</Text>
              </View>
              <Text style={[ts.caption, situacaoStyle(r.situacaoNatacao, theme)]}>
                {r.situacaoNatacao}
              </Text>
            </ProvaComColunaRubrica>

            <ProvaComColunaRubrica
              titulo="Permanência"
              rubricaSvg={r.rubricaPermanenciaSvg}
              headerRight={
                podeExcluirPermanencia ? (
                  <PressableScale
                    onPress={() => abrirExclusao('permanencia')}
                    style={[styles.trashBtn, { borderColor: theme.border }]}
                    accessibilityLabel="Excluir resultado de permanência"
                  >
                    <Trash2 size={16} color={theme.loss} strokeWidth={2.2} />
                  </PressableScale>
                ) : null
              }
            >
              <View style={styles.provaRow}>
                <Text style={[ts.caption, { color: theme.textMuted }]}>Tempo: </Text>
                <Text style={[ts.body, { color: ui.text, fontWeight: '700' }]}>{r.permanenciaTempo}</Text>
              </View>
              <Text style={[ts.caption, situacaoStyle(r.situacaoPermanencia, theme)]}>
                {r.situacaoPermanencia}
              </Text>
            </ProvaComColunaRubrica>
          </Card>
        );
      })}

      <EditarResultadoTafModal
        visible={!!cadastroEmEdicao}
        cadastro={cadastroEmEdicao}
        onClose={() => setCadastroEmEdicao(null)}
        onSalvo={(atualizado) => void aoSalvarEdicao(atualizado)}
      />

      <ConfirmacaoExcluirResultadoModal
        visible={!!confirmarExclusao}
        nome={confirmarExclusao?.nome ?? ''}
        nip={confirmarExclusao?.nip ?? ''}
        modalidade={confirmarExclusao?.modalidade ?? null}
        loading={excluindo}
        onClose={() => {
          if (!excluindo) setConfirmarExclusao(null);
        }}
        onConfirm={() => void executarExclusaoModalidade()}
      />

      <ConfirmacaoGerarResultadosPdfModal
        info={
          modalGerarPdf
            ? {
                qtdMilitares: modalGerarPdf.qtdMilitares,
                folhasA4: modalGerarPdf.folhasA4,
                subtitulo: modalGerarPdf.subtitulo,
              }
            : null
        }
        loading={carregandoPdf}
        onClose={() => {
          if (!carregandoPdf) setModalGerarPdf(null);
        }}
        onConfirm={() => void confirmarGerarPdf()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: tableFullWidthStyle,
  intro: { marginBottom: 14, lineHeight: 20 },
  formCard: { padding: 16, marginBottom: 14 },
  field: { marginBottom: 14 },
  labelGap: { marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  btnBuscar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: PREMIUM.radiusMd,
    marginTop: 4,
  },
  btnBuscarText: { fontWeight: '800' },
  btnDownload: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    marginBottom: 16,
  },
  btnDownloadText: { fontWeight: '800' },
  aviso: { marginBottom: 12, textAlign: 'center' },
  infoBox: {
    padding: 18,
    borderRadius: PREMIUM.radiusLg,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoText: {
    textAlign: 'center',
    fontWeight: '700',
    lineHeight: 22,
  },
  resultCard: { padding: 16, marginBottom: 12 },
  resultCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  resultCardTitulo: {
    flex: 1,
    minWidth: 0,
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    flexShrink: 0,
  },
  trashBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  provaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 },
});
