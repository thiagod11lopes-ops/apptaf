import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  FlatList,
  type ListRenderItem,
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
import { addCadastro, type CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import { unificarSessoesComCadastroRegistrador } from '../utils/sessoesUnificadasResultados';
import { agruparSessoesHistoricoPorTeste } from '../utils/agruparSessoesHistoricoPorTeste';
import { ProvaComColunaRubrica } from './ProvaComColunaRubrica';
import { RubricaCaptureModal } from './RubricaCaptureModal';
import { buscarCadastroPorNomeOuNip } from '../utils/buscarCadastroPorNomeOuNip';
import { formatNipInput, nipDigitos } from '../utils/nipFormat';
import { persistirRubricaModalidadeParticipante } from '../utils/persistirRubricaCadastro';
import type { ResultadoCorridaItem } from '../navigation/types';
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
  estimarFolhasA4PdfResultadosTafBlocos,
} from '../utils/exportResultadosTafPdf';
import type { ResultadosTafPdfBloco } from '../utils/resultadosTafPdfPorAplicador';
import { listarResultadosCompletosFromHistorico, enriquecerLinhasDistanciaMetaFromHistorico } from '../utils/resultadoGeralHistorico';
import { cadastroComResultadoNorma, prepararDadosResultadosNorma, type NormaTafVista } from '../utils/normaTafResultados';
import { modalidadeCorridaCaminhadaDispensavel } from '../utils/corridaCaminhadaExcludente';
import { formatNomeComPostoParts } from '../utils/formatNomeComPosto';
import type { ConfirmacaoGerarResultadosPdfInfo } from './sismav/ConfirmacaoGerarResultadosPdfModal';
import { PREMIUM } from '../theme/premium';
import { tableFullWidthStyle } from '../theme/tableLayout';
import { getUiColors } from '../theme/uiColors';

/** Lista virtualizada de cards na consulta de resultados. */
const CONSULTA_LIST_MAX_HEIGHT = Platform.OS === 'web' ? 720 : 560;
const CONSULTA_ROW_GAP = 12;
const CONSULTA_ROW_ESTIMATED = 420;

function ConsultaRowSeparator() {
  return <View style={{ height: CONSULTA_ROW_GAP }} />;
}

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
  cadastros: CadastroItemPersist[],
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
  cadastros: CadastroItemPersist[],
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

export function ResultadosConsultaPanel({
  normaTaf = 'armada',
  cadastros: cadastrosDataset,
  sessoes: sessoesDataset,
  onDatasetRefresh,
}: {
  normaTaf?: NormaTafVista;
  cadastros: CadastroItemPersist[];
  sessoes: SessaoAplicacaoTaf[];
  onDatasetRefresh?: () => void | Promise<void>;
}) {
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
    (ConfirmacaoGerarResultadosPdfInfo & {
      blocos: ResultadosTafPdfBloco[];
    }) | null
  >(null);
  const [todosCadastros, setTodosCadastros] = useState<CadastroItemPersist[]>(cadastrosDataset);
  const [sessoesHistorico, setSessoesHistorico] = useState<SessaoAplicacaoTaf[]>(() => {
    const { sessoesNorma } = prepararDadosResultadosNorma(
      sessoesDataset,
      cadastrosDataset,
      normaTaf,
      { jaUnificadas: true },
    );
    return sessoesNorma;
  });
  const [rubricasSessoes, setRubricasSessoes] = useState<Map<string, RubricasPorNip>>(new Map());
  const [excluindo, setExcluindo] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState<{
    cadastroId: string;
    nome: string;
    nip: string;
    modalidade: ModalidadeResultadoTaf;
  } | null>(null);
  const [cadastroEmEdicao, setCadastroEmEdicao] = useState<CadastroItemPersist | null>(null);
  const [rubricaEdicao, setRubricaEdicao] = useState<{
    linhaId: string;
    nome: string;
    nip: string;
    modalidade: ModalidadeResultadoTaf;
  } | null>(null);
  const [salvandoRubrica, setSalvandoRubrica] = useState(false);

  useEffect(() => {
    const { sessoesNorma } = prepararDadosResultadosNorma(
      sessoesDataset,
      cadastrosDataset,
      normaTaf,
      { jaUnificadas: true },
    );
    // Lista completa para o autocomplete de NIP/nome; o gate de resultado
    // é feito por cadastroComResultadoNorma (que respeita c.normaTaf).
    setTodosCadastros(cadastrosDataset);
    setSessoesHistorico(sessoesNorma);
  }, [cadastrosDataset, sessoesDataset, normaTaf]);

  const carregarBase = useCallback(async () => {
    await onDatasetRefresh?.();
    return cadastrosDataset;
  }, [onDatasetRefresh, cadastrosDataset]);

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

    const lista = todosCadastros.length ? todosCadastros : cadastrosDataset;
    const cadastrados = filtrarCadastrosPorNipNome(lista, nipTrim, nomeTrim, {
      somenteComResultadoTaf: false,
    });
    const comResultado = cadastrados.filter((c) => cadastroComResultadoNorma(c, normaTaf));

    // UI: só marcadores nos cadastros/sessões (sem carregar imagens).
    setRubricasSessoes(new Map());

    setBuscou(true);
    const sessoes = sessoesHistorico.length
      ? sessoesHistorico
      : agruparSessoesHistoricoPorTeste(
          unificarSessoesComCadastroRegistrador(sessoesDataset, lista),
        );
    setLinhas(linhasComRubricasMescladas(comResultado, new Map(), new Map(), sessoes));

    if (cadastrados.length === 0) {
      setMensagemBusca('Dados não Encontrados no Sistema');
    } else if (comResultado.length === 0) {
      setMensagemBusca('Militar Cadastrado não realizou TAF');
    }
  }, [nip, nome, todosCadastros, cadastrosDataset, sessoesDataset, sessoesHistorico, normaTaf]);

  const handleGerarResultados = useCallback(async () => {
    setAviso(null);

    const lista = todosCadastros.length ? todosCadastros : cadastrosDataset;
    const sessoesRaw = sessoesHistorico.length ? sessoesHistorico : sessoesDataset;
    const sessoes = sessoesHistorico.length
      ? sessoesRaw
      : agruparSessoesHistoricoPorTeste(unificarSessoesComCadastroRegistrador(sessoesRaw, lista));
    // Filtra primeiro sem carregar imagens — rúbricas só sob demanda para o PDF.
    const baseLinhas = listarResultadosCompletosFromHistorico(sessoes, lista);

    let subtitulo =
      'Integrantes com TAF completo (corrida, natação e permanência) — Aplicar TAF e Registrador';

    const nipTrim = nip.trim();
    const nomeTrim = nome.trim();
    let alvoLinhas = baseLinhas;
    if (nipTrim || nomeTrim) {
      if (!buscou) {
        setAviso('Busque um militar antes de gerar o PDF filtrado.');
        return;
      }
      alvoLinhas = baseLinhas.filter((l) => linhaCombinaNipNome(l, nipTrim, nomeTrim));
      if (alvoLinhas.length === 0) {
        setAviso('Este militar não completou as três provas no histórico.');
        return;
      }
      subtitulo = `Filtro: ${[nipTrim && `NIP ${nipTrim}`, nomeTrim && `Nome ${nomeTrim}`]
        .filter(Boolean)
        .join(' · ')} · TAF completo`;
    } else if (alvoLinhas.length === 0) {
      setAviso('Nenhum militar com TAF completo no histórico.');
      return;
    }

    const { yieldToUi } = await import('../utils/yieldToUi');
    await yieldToUi();
    const [rubSessoes, rubCadastros] = await Promise.all([
      carregarRubricasDasSessoesPorNip(alvoLinhas.map((l) => l.nip)),
      carregarRubricasCadastrosPorIds(alvoLinhas.map((l) => l.id)),
    ]);
    const filtroLinhas = linhasCompletasHistoricoComRubricas(
      sessoes,
      lista.filter((c) => alvoLinhas.some((l) => l.id === c.id)),
      rubSessoes,
      rubCadastros,
    ).filter((l) => alvoLinhas.some((a) => a.id === l.id));
    if (filtroLinhas.length === 0) {
      setAviso('Nenhum militar com TAF completo no histórico.');
      return;
    }

    const { montarBlocosResultadosTafPorAplicador } = await import(
      '../utils/resultadosTafPdfPorAplicador'
    );
    const { hydrateSessoesComRubricas } = await import('../utils/hydrateRubricas');
    const idsCompletos = new Set(filtroLinhas.map((l) => l.id));
    const nipsCompletos = new Set(
      filtroLinhas.map((l) => nipDigitos(l.nip)).filter((d) => d.length >= 8),
    );
    // Hidrata só sessões que tocam os NIPs do PDF (evita carregar todas as imagens).
    const sessoesRelevantes = sessoes.filter((s) =>
      (s.resultados ?? []).some((r) => nipsCompletos.has(nipDigitos(r.nip))),
    );
    const sessoesHydrated = await hydrateSessoesComRubricas(
      sessoesRelevantes.length > 0 ? sessoesRelevantes : sessoes,
    );
    const blocos = montarBlocosResultadosTafPorAplicador({
      sessoes: sessoesHydrated,
      cadastros: lista,
      rubricasSessoes: rubSessoes,
      rubricasCadastros: rubCadastros,
      somenteSessoesInformadas: false,
    })
      .map((b) => ({
        ...b,
        linhas: b.linhas.filter(
          (l) => idsCompletos.has(l.id) || nipsCompletos.has(nipDigitos(l.nip)),
        ),
      }))
      .filter((b) => b.linhas.length > 0);

    if (blocos.length === 0) {
      setAviso('Nenhum militar com TAF completo no histórico.');
      return;
    }

    const totalLinhas = blocos.reduce((acc, b) => acc + b.linhas.length, 0);
    setModalGerarPdf({
      blocos,
      subtitulo,
      qtdMilitares: totalLinhas,
      folhasA4: estimarFolhasA4PdfResultadosTafBlocos(blocos),
    });
  }, [
    nip,
    nome,
    buscou,
    todosCadastros,
    cadastrosDataset,
    sessoesDataset,
    sessoesHistorico,
    rubricasSessoes,
  ]);

  const confirmarGerarPdf = useCallback(async () => {
    if (!modalGerarPdf) return;
    setCarregandoPdf(true);
    try {
      await exportResultadosTafPdf(modalGerarPdf.blocos, modalGerarPdf.subtitulo);
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
      const lista = todosCadastros.length ? todosCadastros : cadastrosDataset;
      const porId = lista.find((c) => c.id === confirmarExclusao.cadastroId);
      const porNip = buscarCadastroPorNomeOuNip(lista, confirmarExclusao.nip);
      const cadastro = porId ?? (porNip.kind === 'found' ? porNip.cadastro : undefined);
      if (!cadastro) {
        await removerParticipanteModalidadeDoHistorico(
          confirmarExclusao.nip,
          confirmarExclusao.modalidade,
        );
        await carregarBase();
        setConfirmarExclusao(null);
        setAviso('Resultado removido do histórico.');
        return;
      }
      const atualizado = limparResultadoModalidadeCadastro(cadastro, confirmarExclusao.modalidade);
      await addCadastro(atualizado);
      await removerParticipanteModalidadeDoHistorico(
        atualizado.nip,
        confirmarExclusao.modalidade,
        atualizado,
      );
      const novaBase = lista.map((c) => (c.id === atualizado.id ? atualizado : c));
      setTodosCadastros(novaBase);
      setSessoesHistorico(
        agruparSessoesHistoricoPorTeste(
          unificarSessoesComCadastroRegistrador(sessoesDataset, novaBase),
        ),
      );
      setLinhas((prev) => {
        if (!cadastroComAlgumResultadoTaf(atualizado)) {
          setMensagemBusca('Militar Cadastrado não realizou TAF');
          return prev.filter((l) => l.id !== atualizado.id);
        }
        const linha = cadastroParaLinhaResultado(atualizado);
        return prev.map((l) => (l.id === atualizado.id ? linha : l));
      });
      setConfirmarExclusao(null);
      await onDatasetRefresh?.();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível excluir o resultado.');
    } finally {
      setExcluindo(false);
    }
  }, [
    confirmarExclusao,
    todosCadastros,
    cadastrosDataset,
    sessoesDataset,
    carregarBase,
    onDatasetRefresh,
  ]);

  const aoSalvarEdicao = useCallback(
    async (atualizado: CadastroItemPersist) => {
      setAviso(null);
      const novaBase = todosCadastros.map((c) => (c.id === atualizado.id ? atualizado : c));
      setTodosCadastros(novaBase);

      setSessoesHistorico(
        agruparSessoesHistoricoPorTeste(
          unificarSessoesComCadastroRegistrador(sessoesDataset, novaBase),
        ),
      );

      if (cadastroComAlgumResultadoTaf(atualizado)) {
        const linha = cadastroParaLinhaResultado(atualizado);
        setLinhas((prev) => prev.map((l) => (l.id === atualizado.id ? linha : l)));
        setMensagemBusca(null);
      } else {
        setLinhas((prev) => prev.filter((l) => l.id !== atualizado.id));
        setMensagemBusca('Militar Cadastrado não realizou TAF');
      }
      await onDatasetRefresh?.();
    },
    [todosCadastros, sessoesDataset, onDatasetRefresh],
  );

  const abrirEdicaoRubrica = useCallback(
    (linha: ResultadoTafLinha, modalidade: ModalidadeResultadoTaf) => {
      if (salvandoRubrica) return;
      setAviso(null);
      setRubricaEdicao({
        linhaId: linha.id,
        nome: formatNomeComPostoParts(linha.postoGrad, (linha.nome ?? '').trim() || 'Militar'),
        nip: (linha.nip ?? '').trim(),
        modalidade,
      });
    },
    [salvandoRubrica],
  );

  const participanteRubricaEdicao = useMemo((): ResultadoCorridaItem | null => {
    if (!rubricaEdicao) return null;
    return {
      corredor: 1,
      nome: rubricaEdicao.nome,
      nip: rubricaEdicao.nip,
      tempoMs: 0,
      prova: rubricaEdicao.modalidade,
    };
  }, [rubricaEdicao]);

  const confirmarRubricaEdicao = useCallback(
    async (svg: string) => {
      if (!rubricaEdicao || salvandoRubrica) return;
      setSalvandoRubrica(true);
      setAviso(null);
      try {
        const { cadastroOk, sessoesAtualizadas } = await persistirRubricaModalidadeParticipante(
          rubricaEdicao.nip,
          rubricaEdicao.nome,
          rubricaEdicao.modalidade,
          svg,
        );
        if (!cadastroOk && sessoesAtualizadas === 0) {
          setAviso('Não foi possível salvar a rúbrica. Verifique o NIP no cadastro.');
          return;
        }

        const { RUBRICADO_DIGITALMENTE } = await import('../utils/rubricaPresence');
        const patchLinha = (l: ResultadoTafLinha): ResultadoTafLinha => {
          if (l.id !== rubricaEdicao.linhaId) return l;
          switch (rubricaEdicao.modalidade) {
            case 'caminhada':
              return { ...l, rubricaCaminhadaSvg: RUBRICADO_DIGITALMENTE };
            case 'natacao':
              return { ...l, rubricaNatacaoSvg: RUBRICADO_DIGITALMENTE };
            case 'permanencia':
              return { ...l, rubricaPermanenciaSvg: RUBRICADO_DIGITALMENTE };
            default:
              return { ...l, rubricaCorridaSvg: RUBRICADO_DIGITALMENTE };
          }
        };
        setLinhas((prev) => prev.map(patchLinha));
        setRubricasSessoes(new Map());
        await onDatasetRefresh?.();

        setRubricaEdicao(null);
        setAviso('Rúbrica salva com sucesso.');
      } catch (e) {
        setAviso(e instanceof Error ? e.message : 'Falha ao salvar a rúbrica.');
      } finally {
        setSalvandoRubrica(false);
      }
    },
    [rubricaEdicao, salvandoRubrica, onDatasetRefresh],
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

  const cadastrosById = useMemo(() => {
    const map = new Map<string, CadastroItemPersist>();
    for (const c of todosCadastros) map.set(c.id, c);
    return map;
  }, [todosCadastros]);

  const renderConsultaItem: ListRenderItem<ResultadoTafLinha> = useCallback(
    ({ item: r }) => {
      const porId = cadastrosById.get(r.id);
      const porNip = buscarCadastroPorNomeOuNip(todosCadastros, r.nip);
      const cadastro = porId ?? (porNip.kind === 'found' ? porNip.cadastro : undefined);
      const podeExcluirCorrida =
        (cadastro ? temAvaliacaoCorrida(cadastro) : false) || r.notaCorrida !== '—';
      const podeExcluirCaminhada =
        (cadastro ? temAvaliacaoCaminhada(cadastro) : false) || r.notaCaminhada !== '—';
      const podeExcluirNatacao =
        (cadastro ? temAvaliacaoNatacao(cadastro) : false) || r.notaNatacao !== '—';
      const podeExcluirPermanencia =
        (cadastro ? temAvaliacaoPermanencia(cadastro) : false) ||
        (r.situacaoPermanencia !== '—' && r.situacaoPermanencia !== '');

      const nomeComPosto = formatNomeComPostoParts(r.postoGrad, r.nome);

      const abrirExclusao = (modalidade: ModalidadeResultadoTaf) => {
        setConfirmarExclusao({
          cadastroId: cadastro?.id ?? r.id,
          nome: nomeComPosto,
          nip: r.nip,
          modalidade,
        });
      };

      return (
        <Card elevated style={styles.resultCard}>
          <View style={styles.resultCardHeader}>
            <View style={styles.resultCardTitulo}>
              <Text style={[ts.label, { color: theme.primary }]}>NIP</Text>
              <Text style={[ts.body, { color: ui.text, marginBottom: 4 }]}>{r.nip}</Text>
              <Text style={[ts.label, { color: theme.primary }]}>Nome</Text>
              <Text style={[ts.h2, { color: ui.text, fontSize: 18 }]}>{nomeComPosto}</Text>
            </View>
            {cadastro ? (
              <PressableScale
                onPress={() => setCadastroEmEdicao(cadastro)}
                style={[styles.editBtn, { borderColor: theme.border }]}
                accessibilityLabel={`Editar resultados de ${nomeComPosto}`}
              >
                <Pencil size={18} color={theme.primary} strokeWidth={2.2} />
              </PressableScale>
            ) : null}
          </View>

          <ProvaComColunaRubrica
            titulo="Corrida"
            data={r.dataTafCorrida}
            rubricaSvg={r.rubricaCorridaSvg}
            dispensavel={modalidadeCorridaCaminhadaDispensavel(r, 'corrida')}
            onPressRubrica={() => abrirEdicaoRubrica(r, 'corrida')}
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
            data={r.dataTafCaminhada}
            rubricaSvg={r.rubricaCaminhadaSvg}
            dispensavel={modalidadeCorridaCaminhadaDispensavel(r, 'caminhada')}
            onPressRubrica={() => abrirEdicaoRubrica(r, 'caminhada')}
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
            data={r.dataTafNatacao}
            rubricaSvg={r.rubricaNatacaoSvg}
            onPressRubrica={() => abrirEdicaoRubrica(r, 'natacao')}
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
            data={r.dataTafPermanencia}
            rubricaSvg={r.rubricaPermanenciaSvg}
            onPressRubrica={() => abrirEdicaoRubrica(r, 'permanencia')}
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
    },
    [abrirEdicaoRubrica, cadastrosById, theme, todosCadastros, ts, ui.text],
  );

  const consultaKeyExtractor = useCallback((item: ResultadoTafLinha) => item.id, []);

  const consultaGetItemLayout = useCallback(
    (_: ArrayLike<ResultadoTafLinha> | null | undefined, index: number) => ({
      length: CONSULTA_ROW_ESTIMATED + CONSULTA_ROW_GAP,
      offset: (CONSULTA_ROW_ESTIMATED + CONSULTA_ROW_GAP) * index,
      index,
    }),
    [],
  );

  return (
    <View style={styles.wrap}>
      <Text style={[ts.bodySecondary, styles.intro, { color: theme.textSecondary }]}>
        Calendário das aplicações registradas no histórico e busca por NIP ou nome para gerenciar
        resultados individuais.
      </Text>

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

      <HistoricoCalendarioTaf
        sessoes={sessoesHistorico}
        cadastros={todosCadastros}
        onAviso={setAviso}
        onResultadosCadastrados={() => {
          void onDatasetRefresh?.();
        }}
      />

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

      {linhas.length > 0 ? (
        <FlatList
          data={linhas}
          keyExtractor={consultaKeyExtractor}
          renderItem={renderConsultaItem}
          style={[styles.consultaList, { maxHeight: CONSULTA_LIST_MAX_HEIGHT }]}
          contentContainerStyle={styles.consultaListContent}
          ItemSeparatorComponent={ConsultaRowSeparator}
          getItemLayout={consultaGetItemLayout}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={50}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== 'web'}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        />
      ) : null}

      <EditarResultadoTafModal
        visible={!!cadastroEmEdicao}
        cadastro={cadastroEmEdicao}
        onClose={() => setCadastroEmEdicao(null)}
        onSalvo={(atualizado) => void aoSalvarEdicao(atualizado)}
      />

      <RubricaCaptureModal
        visible={!!rubricaEdicao}
        participante={participanteRubricaEdicao}
        indice={0}
        total={1}
        tipoProva={rubricaEdicao?.modalidade ?? 'corrida'}
        ultimo
        confirmLabel={salvandoRubrica ? 'Salvando…' : 'Salvar rúbrica'}
        onConfirm={(svg) => {
          if (!salvandoRubrica) void confirmarRubricaEdicao(svg);
        }}
        onSkip={() => {
          if (!salvandoRubrica) setRubricaEdicao(null);
        }}
        onCancel={() => {
          if (!salvandoRubrica) setRubricaEdicao(null);
        }}
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
  consultaList: {
    maxHeight: CONSULTA_LIST_MAX_HEIGHT,
    marginTop: 4,
  },
  consultaListContent: {
    paddingBottom: 4,
  },
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
  resultCard: { padding: 16 },
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
