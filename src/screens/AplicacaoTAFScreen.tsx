import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, Anchor, Check, Ship, Sparkles, UserPlus, X } from 'lucide-react-native';
import { useAuthDataReload } from '../hooks/useAuthDataReload';
import { useTheme } from '../contexts/ThemeContext';
import { getUiColors } from '../theme/uiColors';
import { PREMIUM } from '../theme/premium';
import { MobileScreenScaffold } from '../components/mobile/MobileScreenScaffold';
import {
  TafBackLink,
  TafCenteredTabHeader,
  TafGlassPanel,
  TafPrimaryButton,
} from '../components/mobile/TafTabChrome';
import { TopActionIcons } from '../components/premium/TopActionIcons';
import { AplicarTafProvaSelector } from '../components/taf/aplicar/AplicarTafProvaSelector';
import { getAplicarTafGlass } from '../components/taf/aplicar/aplicarTafTheme';
import { useAplicarTafLayout } from '../components/taf/aplicar/useAplicarTafLayout';
import { RubricaCaptureModal } from '../components/RubricaCaptureModal';
import { FluxoAssinaturaAplicadorModal } from '../components/sismav/FluxoAssinaturaAplicadorModal';
import { ModernModal } from '../components/sismav/ModernModal';
import { PressableScale } from '../components/premium/PressableScale';
import {
  addCadastro,
  getAllCadastros,
  peekCadastrosListCache,
  type CadastroItemPersist,
} from '../services/cadastrosIndexedDb';
import type { ResultadoCorridaItem } from '../navigation/types';
import type { AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';
import type { TipoProvaTAF } from '../taf/tafProvaTypes';
import {
  isProvaComCronometro,
  isProvaComRepeticoes,
  tituloProvaTaf,
} from '../taf/tafProvaTypes';
import { formatMsByModality, parseTafPerformanceInput } from '../taf/tafTimeFormat';
import {
  calcularNotaLinhaReps,
  calcularNotaLinhaTempo,
  aplicarPermanenciaNoCadastro,
  aplicarResultadoNoCadastro,
} from './aplicarTafNotaHelpers';
import { buscarCadastroPorNomeOuNip } from '../utils/buscarCadastroPorNomeOuNip';
import { formatNipInput, nipDigitos } from '../utils/nipFormat';
import { dataBrParaIso, dataHojeBr } from '../utils/tafRegistro';
import { idadeFromDataNascimento } from '../utils/idadeFromDataNascimento';
import {
  formatMinutosSegundosInput,
  tempoMinutosSegundosValido,
} from '../utils/formatMinutosSegundos';
import { EditarIdadeGeneroMilitarModal } from '../components/taf/aplicar/EditarIdadeGeneroMilitarModal';
import { upsertParticipanteSessaoGrupoHistorico } from '../utils/upsertParticipanteSessaoGrupoHistorico';
import { navigateTab } from '../navigation/navigationRef';

type Etapa = 'norma' | 'prova' | 'form';
type NormaTaf = 'armada' | 'cfn';

const NAVAL_CAMO_GRADIENT = ['#2a3320', '#4a5c38', '#5c4a32', '#3d4a28', '#6b5c45'] as const;

function textoIdadeMilitar(dataNascimento: string): string {
  const idade = idadeFromDataNascimento(dataNascimento);
  return idade != null ? `${idade} anos` : 'Idade?';
}

function textoGeneroMilitar(sexo?: 'M' | 'F'): string {
  if (sexo === 'M') return 'Masculino';
  if (sexo === 'F') return 'Feminino';
  return 'Gênero?';
}

function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}/${mm}`;
  return `${dd}/${mm}/${yyyy}`;
}

function dataAplicacaoValida(value: string): boolean {
  return dataBrParaIso(value) != null;
}

function dataNascimentoValida(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(t)) return false;
  return idadeFromDataNascimento(t) != null;
}

export default function AplicacaoTAFScreen() {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const glass = getAplicarTafGlass(theme);
  const { isNarrowPhone } = useAplicarTafLayout();

  const [etapa, setEtapa] = useState<Etapa>('norma');
  const [normaTaf, setNormaTaf] = useState<NormaTaf>('armada');
  const [tipoProva, setTipoProva] = useState<TipoProvaTAF | null>(null);
  const modoNaval = normaTaf === 'cfn';

  const [cadastros, setCadastros] = useState<CadastroItemPersist[]>(
    () => peekCadastrosListCache() ?? [],
  );
  const [nip, setNip] = useState('');
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [cadastro, setCadastro] = useState<CadastroItemPersist | null>(null);
  const [avisoBusca, setAvisoBusca] = useState('');
  const [modalNaoCadastrado, setModalNaoCadastrado] = useState(false);
  const [modalEditarIdadeGenero, setModalEditarIdadeGenero] = useState(false);
  const [tempo, setTempo] = useState('');
  const [repeticoes, setRepeticoes] = useState('');
  const [permanencia, setPermanencia] = useState<'aprovado' | 'reprovado' | null>(null);
  const [dataTeste, setDataTeste] = useState(dataHojeBr());
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [rubricaMilitarAberto, setRubricaMilitarAberto] = useState(false);
  const [aplicadorAberto, setAplicadorAberto] = useState(false);
  const [resultadoPendente, setResultadoPendente] = useState<ResultadoCorridaItem | null>(null);
  const [cadastroPendente, setCadastroPendente] = useState<CadastroItemPersist | null>(null);

  const carregarCadastros = useCallback(() => {
    getAllCadastros()
      .then(setCadastros)
      .catch(() => undefined);
  }, []);

  useAuthDataReload(carregarCadastros, { scopes: ['cadastros'] });

  const resetForm = useCallback(() => {
    setNip('');
    setNome('');
    setDataNascimento('');
    setCadastro(null);
    setAvisoBusca('');
    setModalNaoCadastrado(false);
    setModalEditarIdadeGenero(false);
    setTempo('');
    setRepeticoes('');
    setPermanencia(null);
    setDataTeste(dataHojeBr());
    setErro('');
    setResultadoPendente(null);
    setCadastroPendente(null);
  }, []);

  const aplicarCadastroEncontrado = useCallback((encontrado: CadastroItemPersist) => {
    setCadastro(encontrado);
    setNip(formatNipInput(encontrado.nip));
    setNome((encontrado.nome ?? '').trim());
    setDataNascimento((encontrado.dataNascimento ?? '').trim());
    setAvisoBusca('');
    setModalNaoCadastrado(false);
    setErro('');
  }, []);

  const limparMilitar = useCallback(() => {
    setCadastro(null);
    setNome('');
    setDataNascimento('');
    setAvisoBusca('');
  }, []);

  const onChangeNip = useCallback(
    (raw: string) => {
      const formatado = formatNipInput(raw);
      setNip(formatado);
      setErro('');
      const digits = nipDigitos(formatado);
      if (!digits) {
        limparMilitar();
        return;
      }

      const res = buscarCadastroPorNomeOuNip(cadastros, formatado);
      if (res.kind === 'found') {
        aplicarCadastroEncontrado(res.cadastro);
        return;
      }

      if (digits.length >= 4 && digits.length < 8) {
        const prefixos = cadastros.filter((c) => nipDigitos(c.nip).startsWith(digits));
        if (prefixos.length === 1) {
          aplicarCadastroEncontrado(prefixos[0]);
          return;
        }
        limparMilitar();
        return;
      }

      limparMilitar();
      if (digits.length >= 8) {
        if (res.kind === 'ambiguous') {
          setAvisoBusca('Vários cadastros correspondem a este NIP.');
        } else {
          setModalNaoCadastrado(true);
        }
      }
    },
    [aplicarCadastroEncontrado, cadastros, limparMilitar],
  );

  const cadastroEfetivo = useMemo((): CadastroItemPersist | null => {
    if (!cadastro) return null;
    return {
      ...cadastro,
      dataNascimento: dataNascimento.trim(),
      nome: nome.trim() || cadastro.nome,
    };
  }, [cadastro, dataNascimento, nome]);

  const idadePreview = useMemo(() => {
    if (!dataNascimentoValida(dataNascimento)) return null;
    return idadeFromDataNascimento(dataNascimento);
  }, [dataNascimento]);

  const salvarEdicaoIdadeGenero = useCallback(
    async (dados: { dataNascimento: string; sexo: 'M' | 'F' }) => {
      if (!cadastro) return;
      const atualizado: CadastroItemPersist = {
        ...cadastro,
        dataNascimento: dados.dataNascimento,
        sexo: dados.sexo,
        nome: nome.trim() || cadastro.nome,
      };
      await addCadastro(atualizado);
      aplicarCadastroEncontrado(atualizado);
      setCadastros((prev) => {
        const idx = prev.findIndex((c) => c.id === atualizado.id);
        if (idx < 0) return prev;
        const next = [...prev];
        next[idx] = atualizado;
        return next;
      });
      setModalEditarIdadeGenero(false);
    },
    [aplicarCadastroEncontrado, cadastro, nome],
  );

  const voltar = useCallback(() => {
    if (salvando) return;
    setErro('');
    setSucesso('');
    if (etapa === 'form') {
      resetForm();
      setTipoProva(null);
      setEtapa('prova');
      return;
    }
    if (etapa === 'prova') {
      setTipoProva(null);
      setEtapa('norma');
    }
  }, [etapa, resetForm, salvando]);

  const iniciarNorma = useCallback((norma: NormaTaf) => {
    setNormaTaf(norma);
    setTipoProva(null);
    resetForm();
    setSucesso('');
    setEtapa('prova');
  }, [resetForm]);

  const selecionarProva = useCallback((id: TipoProvaTAF) => {
    setTipoProva(id);
    resetForm();
    setSucesso('');
    setEtapa('form');
  }, [resetForm]);

  const notaPreview = useMemo(() => {
    if (!cadastroEfetivo || !tipoProva || tipoProva === 'permanencia') return null;
    if (!dataNascimentoValida(dataNascimento)) return null;
    if (isProvaComRepeticoes(tipoProva)) {
      const n = parseInt(repeticoes.replace(/\D/g, ''), 10);
      if (!Number.isFinite(n) || n < 0) return null;
      return calcularNotaLinhaReps(
        tipoProva as 'flexao_barra' | 'flexao_solo' | 'abdominal_remador',
        n,
        cadastroEfetivo,
      );
    }
    if (isProvaComCronometro(tipoProva)) {
      if (!tempo.trim() || !tempoMinutosSegundosValido(tempo) || !tempo.includes(':')) return null;
      const modality = tipoProva === 'natacao' || tipoProva === 'abdominal_prancha' ? 'natacao' : 'corrida';
      const ms = parseTafPerformanceInput(modality, tempo);
      if (ms == null) return null;
      const nota = calcularNotaLinhaTempo(tipoProva, ms, cadastroEfetivo, modoNaval);
      return nota === '—' ? null : nota;
    }
    return null;
  }, [cadastroEfetivo, tipoProva, tempo, repeticoes, modoNaval, dataNascimento]);

  const montarResultadoECadastro = useCallback((): {
    resultado: ResultadoCorridaItem;
    cadastroAtualizado: CadastroItemPersist;
  } | null => {
    if (!cadastroEfetivo || !tipoProva) {
      setErro('Informe o NIP de um militar cadastrado.');
      return null;
    }
    if (!dataAplicacaoValida(dataTeste)) {
      setErro('Informe a data do teste no formato DD/MM/AAAA.');
      return null;
    }
    if (tipoProva !== 'permanencia' && !dataNascimentoValida(dataNascimento)) {
      setErro('Informe a data de nascimento (DD/MM/AAAA) para calcular a nota.');
      return null;
    }

    const base = cadastroEfetivo;

    if (tipoProva === 'permanencia') {
      if (!permanencia) {
        setErro('Selecione Aprovado ou Reprovado na permanência.');
        return null;
      }
      const cadastroAtualizado = aplicarPermanenciaNoCadastro(base, permanencia, {
        dataAplicacaoBr: dataTeste,
      });
      const resultado: ResultadoCorridaItem = {
        corredor: 1,
        nome: (base.nome ?? '').trim() || '—',
        nip: base.nip ?? '',
        tempoMs: 0,
        prova: 'permanencia',
        desempenhoTexto: permanencia === 'aprovado' ? 'Aprovado' : 'Reprovado',
        notaTexto: permanencia === 'aprovado' ? 'Aprovado' : 'REPROVADO',
        noraTexto: permanencia === 'aprovado' ? 'Aprovado' : 'REPROVADO',
        reprovacaoTexto: permanencia === 'reprovado' ? 'Reprovado' : undefined,
      };
      return { resultado, cadastroAtualizado };
    }

    if (isProvaComRepeticoes(tipoProva)) {
      const n = parseInt(repeticoes.replace(/\D/g, ''), 10);
      if (!Number.isFinite(n) || n < 0) {
        setErro('Informe o número de repetições.');
        return null;
      }
      const notaTexto = calcularNotaLinhaReps(
        tipoProva as 'flexao_barra' | 'flexao_solo' | 'abdominal_remador',
        n,
        base,
      );
      const cadastroAtualizado = aplicarResultadoNoCadastro(base, tipoProva, {
        repeticoes: n,
        modoTafNaval: modoNaval,
        dataAplicacaoBr: dataTeste,
      });
      const resultado: ResultadoCorridaItem = {
        corredor: 1,
        nome: (base.nome ?? '').trim() || '—',
        nip: base.nip ?? '',
        tempoMs: 0,
        prova: tipoProva,
        desempenhoTexto: String(n),
        notaTexto: notaTexto === '—' ? undefined : notaTexto,
        noraTexto: notaTexto === '—' ? undefined : notaTexto,
        reprovacaoTexto: notaTexto === 'REPROVADO' ? 'Reprovado' : undefined,
      };
      return { resultado, cadastroAtualizado };
    }

    if (!tempo.trim() || !tempoMinutosSegundosValido(tempo) || !tempo.includes(':')) {
      setErro('Informe o tempo no formato MM:SS.');
      return null;
    }
    const modality =
      tipoProva === 'natacao' || tipoProva === 'abdominal_prancha' ? 'natacao' : 'corrida';
    const tempoMs = parseTafPerformanceInput(modality, tempo);
    if (tempoMs == null) {
      setErro('Tempo inválido.');
      return null;
    }
    const notaTexto = calcularNotaLinhaTempo(tipoProva, tempoMs, base, modoNaval);
    const cadastroAtualizado = aplicarResultadoNoCadastro(base, tipoProva, {
      tempoMs,
      modoTafNaval: modoNaval,
      dataAplicacaoBr: dataTeste,
    });
    const resultado: ResultadoCorridaItem = {
      corredor: 1,
      nome: (base.nome ?? '').trim() || '—',
      nip: base.nip ?? '',
      tempoMs,
      prova: tipoProva,
      desempenhoTexto: formatMsByModality(modality, tempoMs),
      notaTexto: notaTexto === '—' ? undefined : notaTexto,
      noraTexto: notaTexto === '—' ? undefined : notaTexto,
      reprovacaoTexto: notaTexto === 'REPROVADO' ? 'Reprovado' : undefined,
    };
    return { resultado, cadastroAtualizado };
  }, [
    cadastroEfetivo,
    tipoProva,
    dataTeste,
    dataNascimento,
    permanencia,
    repeticoes,
    tempo,
    modoNaval,
  ]);

  const iniciarSalvar = useCallback(() => {
    setErro('');
    setSucesso('');
    const montado = montarResultadoECadastro();
    if (!montado) return;
    setResultadoPendente(montado.resultado);
    setCadastroPendente(montado.cadastroAtualizado);
    setRubricaMilitarAberto(true);
  }, [montarResultadoECadastro]);

  const commitFinal = useCallback(
    async (resultado: ResultadoCorridaItem, cadastroAtualizado: CadastroItemPersist, assinatura: AplicadorAssinaturaResumo) => {
      if (!tipoProva) return;
      setSalvando(true);
      setErro('');
      try {
        const svg = resultado.rubricaCandidatoSvg?.trim();
        let cadastroFinal = cadastroAtualizado;
        if (svg) {
          if (tipoProva === 'natacao') cadastroFinal = { ...cadastroFinal, rubricaNatacaoSvg: svg };
          else if (tipoProva === 'permanencia') cadastroFinal = { ...cadastroFinal, rubricaPermanenciaSvg: svg };
          else if (tipoProva === 'caminhada') cadastroFinal = { ...cadastroFinal, rubricaCaminhadaSvg: svg };
          else if (tipoProva === 'corrida') cadastroFinal = { ...cadastroFinal, rubricaCorridaSvg: svg };
        }

        await addCadastro(cadastroFinal);
        await upsertParticipanteSessaoGrupoHistorico({
          dataAplicacao: dataTeste,
          tipoProva,
          normaTaf,
          resultado,
          aplicadorAssinatura: assinatura,
        });

        setSucesso(
          `Teste de ${tituloProvaTaf(tipoProva, modoNaval)} registrado para ${(cadastroFinal.nome ?? '').trim() || 'militar'}.`,
        );
        resetForm();
        setEtapa('norma');
        setTipoProva(null);
        carregarCadastros();
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível salvar o registro.');
      } finally {
        setSalvando(false);
        setAplicadorAberto(false);
        setRubricaMilitarAberto(false);
        setResultadoPendente(null);
        setCadastroPendente(null);
      }
    },
    [tipoProva, dataTeste, normaTaf, modoNaval, resetForm, carregarCadastros],
  );

  const tituloHeader =
    etapa === 'norma'
      ? 'Registrador de TAF'
      : etapa === 'prova'
        ? normaTaf === 'cfn'
          ? 'TAF CFN'
          : 'TAF Armada'
        : tituloProvaTaf(tipoProva, modoNaval);

  const subHeader =
    etapa === 'norma'
      ? 'Lance resultados manuais no histórico e na nuvem'
      : etapa === 'prova'
        ? 'Escolha o tipo de teste'
        : 'Busque o militar, informe o desempenho e confirme as rúbricas';

  return (
    <MobileScreenScaffold scroll contentContainerStyle={styles.page}>
      <TafCenteredTabHeader
        title={tituloHeader}
        subtitle={subHeader}
        footer={<TopActionIcons activeRoute="AplicacaoTAF" />}
      />

      {etapa !== 'norma' ? <TafBackLink label="Voltar" onPress={voltar} /> : null}

      {etapa === 'norma' ? (
        <View style={styles.launcher}>
          <TouchableOpacity
            accessibilityLabel="Registrar TAF Armada"
            activeOpacity={0.92}
            onPress={() => iniciarNorma('armada')}
            style={[
              styles.tileWrap,
              Platform.OS === 'web' ? ({ boxShadow: '0 16px 40px rgba(37,99,235,0.28)' } as object) : null,
            ]}
          >
            <LinearGradient
              colors={[theme.primary, '#6366f1', '#4f46e5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tilePrimary}
            >
              <View style={styles.tileBody}>
                <View style={styles.iconRing}>
                  <Ship size={26} color="#fff" strokeWidth={2.4} />
                </View>
                <View style={styles.textCol}>
                  <Text style={[styles.tileTitlePrimary, isNarrowPhone ? styles.tileTitleCompact : null]}>
                    TAF Armada
                  </Text>
                  <Text style={styles.tileSubPrimary}>Corrida, natação, permanência e caminhada</Text>
                </View>
                <Sparkles size={18} color="rgba(255,255,255,0.5)" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityLabel="Registrar TAF CFN"
            activeOpacity={0.92}
            onPress={() => iniciarNorma('cfn')}
            style={styles.tileWrap}
          >
            <LinearGradient
              colors={[...NAVAL_CAMO_GRADIENT]}
              locations={[0, 0.22, 0.48, 0.72, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tileNaval}
            >
              <View style={styles.tileBody}>
                <View style={styles.iconRingNaval}>
                  <Anchor size={24} color="#f0ebe0" strokeWidth={2.4} />
                </View>
                <View style={styles.textCol}>
                  <Text style={[styles.tileTitleNaval, isNarrowPhone ? styles.tileTitleCompact : null]}>
                    TAF CFN
                  </Text>
                  <Text style={styles.tileSubNaval}>Corrida 3200, natação 100 e provas FN</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : null}

      {etapa === 'prova' ? (
        <AplicarTafProvaSelector variant={modoNaval ? 'naval' : 'padrao'} onSelect={selecionarProva} />
      ) : null}

      {etapa === 'form' && tipoProva ? (
        <TafGlassPanel accent={modoNaval ? 'violet' : 'cyan'} style={styles.formPanel}>
          <View style={styles.fieldBlock}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>NIP</Text>
            <TextInput
              value={nip}
              onChangeText={onChangeNip}
              placeholder="00.0000.00"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              maxLength={10}
              style={[
                styles.inputFull,
                {
                  color: ui.text,
                  borderColor: theme.border,
                  backgroundColor: ui.inputBg,
                },
              ]}
              accessibilityLabel="NIP do militar"
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Nome</Text>
            <TextInput
              value={nome}
              editable={false}
              placeholder="Preenchido automaticamente pelo NIP"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.inputFull,
                {
                  color: ui.text,
                  borderColor: theme.border,
                  backgroundColor: theme.isDark ? 'rgba(15,23,42,0.35)' : 'rgba(248,250,252,0.95)',
                  opacity: nome ? 1 : 0.85,
                },
              ]}
              accessibilityLabel="Nome do militar"
            />
            {cadastro ? (
              <View style={styles.metaRow}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Editar idade"
                  accessibilityHint="Abre edição de idade e gênero"
                  onPress={() => setModalEditarIdadeGenero(true)}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  style={[
                    styles.metaChip,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.isDark
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(15,23,42,0.04)',
                    },
                  ]}
                >
                  <Text style={[styles.metaChipText, { color: theme.textSecondary }]}>
                    {textoIdadeMilitar(dataNascimento)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Editar gênero"
                  accessibilityHint="Abre edição de idade e gênero"
                  onPress={() => setModalEditarIdadeGenero(true)}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  style={[
                    styles.metaChip,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.isDark
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(15,23,42,0.04)',
                    },
                  ]}
                >
                  <Text style={[styles.metaChipText, { color: theme.textSecondary }]}>
                    {textoGeneroMilitar(cadastro.sexo)}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {cadastro && idadePreview == null ? (
              <Text style={[styles.hint, { color: theme.tokens.warning500 }]}>
                Toque em idade ou gênero para informar a data de nascimento.
              </Text>
            ) : null}
          </View>

          {avisoBusca ? (
            <Text style={[styles.hint, { color: theme.error }]}>{avisoBusca}</Text>
          ) : null}
          {cadastro ? (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              {cadastro.categoria}
            </Text>
          ) : null}

          <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 14 }]}>
            Data do teste
          </Text>
          <TextInput
            value={dataTeste}
            onChangeText={(v) => setDataTeste(formatDateInput(v))}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={theme.textMuted}
            keyboardType="number-pad"
            maxLength={10}
            style={[
              styles.inputFull,
              {
                color: ui.text,
                borderColor: theme.border,
                backgroundColor: ui.inputBg,
              },
            ]}
          />

          {tipoProva === 'permanencia' ? (
            <>
              <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 14 }]}>
                Situação
              </Text>
              <View style={styles.permRow}>
                <TouchableOpacity
                  onPress={() => setPermanencia('aprovado')}
                  style={[
                    styles.permBtn,
                    {
                      borderColor: permanencia === 'aprovado' ? theme.success : theme.border,
                      backgroundColor:
                        permanencia === 'aprovado' ? theme.gainMuted : theme.surface,
                    },
                  ]}
                >
                  <Check size={16} color={theme.success} strokeWidth={2.5} />
                  <Text style={[styles.permText, { color: theme.success }]}>Aprovado</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPermanencia('reprovado')}
                  style={[
                    styles.permBtn,
                    {
                      borderColor: permanencia === 'reprovado' ? theme.error : theme.border,
                      backgroundColor:
                        permanencia === 'reprovado' ? theme.lossMuted : theme.surface,
                    },
                  ]}
                >
                  <X size={16} color={theme.error} strokeWidth={2.5} />
                  <Text style={[styles.permText, { color: theme.error }]}>Reprovado</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : isProvaComRepeticoes(tipoProva) ? (
            <>
              <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 14 }]}>
                Repetições
              </Text>
              <TextInput
                value={repeticoes}
                onChangeText={(v) => setRepeticoes(v.replace(/\D/g, '').slice(0, 4))}
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                keyboardType="number-pad"
                style={[
                  styles.inputFull,
                  {
                    color: ui.text,
                    borderColor: theme.border,
                    backgroundColor: ui.inputBg,
                  },
                ]}
              />
            </>
          ) : (
            <>
              <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 14 }]}>
                Tempo (MM:SS)
              </Text>
              <TextInput
                value={tempo}
                onChangeText={(v) => setTempo(formatMinutosSegundosInput(v))}
                placeholder="00:00"
                placeholderTextColor={theme.textMuted}
                keyboardType="number-pad"
                maxLength={5}
                style={[
                  styles.inputFull,
                  {
                    color: ui.text,
                    borderColor: theme.border,
                    backgroundColor: ui.inputBg,
                  },
                ]}
              />
            </>
          )}

          {notaPreview ? (
            <View style={[styles.notaBox, { borderColor: glass.border, backgroundColor: glass.bg }]}>
              <Text style={[styles.notaLabel, { color: theme.textMuted }]}>Nota automática</Text>
              <Text
                style={[
                  styles.notaValor,
                  {
                    color:
                      notaPreview === 'REPROVADO' || notaPreview === 'Reprovado'
                        ? theme.error
                        : theme.success,
                  },
                ]}
              >
                {notaPreview}
              </Text>
            </View>
          ) : null}

          {erro ? <Text style={[styles.hint, { color: theme.error }]}>{erro}</Text> : null}

          <View style={styles.saveBtn}>
            <TafPrimaryButton
              label={salvando ? 'Salvando…' : 'Continuar · Rúbricas'}
              onPress={iniciarSalvar}
              disabled={salvando || !cadastro}
              loading={salvando}
            />
          </View>
        </TafGlassPanel>
      ) : null}

      {sucesso ? (
        <Text style={[styles.sucesso, { color: theme.success }]}>{sucesso}</Text>
      ) : null}

      <ModernModal
        visible={modalNaoCadastrado}
        onClose={() => setModalNaoCadastrado(false)}
        title="Militar não cadastrado"
        icon={<AlertTriangle size={20} color="#FFFFFF" strokeWidth={2.2} />}
        footer={
          <View style={styles.modalFooter}>
            <PressableScale
              onPress={() => setModalNaoCadastrado(false)}
              style={[styles.modalGhost, { borderColor: theme.border }]}
            >
              <Text style={[styles.modalGhostText, { color: theme.textSecondary }]}>Fechar</Text>
            </PressableScale>
            <PressableScale
              onPress={() => {
                setModalNaoCadastrado(false);
                navigateTab('Cadastro');
              }}
              style={styles.modalPrimaryOuter}
            >
              <LinearGradient
                colors={[...theme.tokens.gradientPrimaryBtn]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalPrimary}
              >
                <UserPlus size={16} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.modalPrimaryText}>Ir para Cadastro</Text>
              </LinearGradient>
            </PressableScale>
          </View>
        }
      >
        <Text style={[styles.modalMsg, { color: theme.text }]}>
          Não há militar com o NIP {nip || 'informado'} no banco. Cadastre-o na aba Cadastro
          antes de registrar o teste.
        </Text>
      </ModernModal>

      <EditarIdadeGeneroMilitarModal
        visible={modalEditarIdadeGenero && cadastro != null}
        nome={nome || (cadastro?.nome ?? '')}
        nip={nip}
        dataNascimento={dataNascimento}
        sexo={cadastro?.sexo}
        onClose={() => setModalEditarIdadeGenero(false)}
        onSalvar={salvarEdicaoIdadeGenero}
      />

      <RubricaCaptureModal
        visible={rubricaMilitarAberto && resultadoPendente != null}
        participante={resultadoPendente}
        indice={0}
        total={1}
        tipoProva={tipoProva ?? 'corrida'}
        ultimo
        confirmLabel="Continuar · Aplicador"
        onConfirm={(svg) => {
          if (!resultadoPendente) return;
          setResultadoPendente({
            ...resultadoPendente,
            rubricaCandidato: 'Rúbrica capturada',
            rubricaCandidatoSvg: svg,
          });
          setRubricaMilitarAberto(false);
          setAplicadorAberto(true);
        }}
        onSkip={() => {
          setRubricaMilitarAberto(false);
          setAplicadorAberto(true);
        }}
        onCancel={() => {
          setRubricaMilitarAberto(false);
          setResultadoPendente(null);
          setCadastroPendente(null);
        }}
      />

      <FluxoAssinaturaAplicadorModal
        visible={aplicadorAberto}
        onCancelar={() => {
          if (salvando) return;
          setAplicadorAberto(false);
          setResultadoPendente(null);
          setCadastroPendente(null);
        }}
        onConcluir={(assinatura) => {
          if (!resultadoPendente || !cadastroPendente) return;
          void commitFinal(resultadoPendente, cadastroPendente, assinatura);
        }}
      />

      {salvando ? (
        <View style={styles.savingOverlay} pointerEvents="none">
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      ) : null}
    </MobileScreenScaffold>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 12,
    paddingBottom: 28,
  },
  launcher: {
    gap: 12,
  },
  tileWrap: {
    borderRadius: PREMIUM.radiusLg + 6,
    overflow: 'hidden',
  },
  tilePrimary: {
    padding: 18,
  },
  tileNaval: {
    padding: 18,
  },
  tileBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconRing: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRingNaval: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: 'rgba(240,235,224,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(240,235,224,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  tileTitlePrimary: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '900',
  },
  tileTitleNaval: {
    color: '#f0ebe0',
    fontSize: 21,
    fontWeight: '900',
  },
  tileTitleCompact: {
    fontSize: 19,
  },
  tileSubPrimary: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: '600',
  },
  tileSubNaval: {
    color: 'rgba(240,235,224,0.78)',
    fontSize: 13,
    fontWeight: '600',
  },
  formPanel: {
    gap: 8,
  },
  fieldBlock: {
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  metaChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inputFull: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 10 : 12,
    fontSize: 15,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  permRow: {
    flexDirection: 'row',
    gap: 10,
  },
  permBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
  },
  permText: {
    fontSize: 14,
    fontWeight: '800',
  },
  notaBox: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notaLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  notaValor: {
    fontSize: 20,
    fontWeight: '900',
  },
  saveBtn: {
    marginTop: 12,
  },
  sucesso: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.12)',
  },
  modalMsg: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  modalGhost: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalGhostText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalPrimaryOuter: {
    flex: 1,
  },
  modalPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
