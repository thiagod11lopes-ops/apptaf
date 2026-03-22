import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { Check, ChevronLeft, X } from 'lucide-react-native';
import { CadastroPlanilhaBlock } from '../components/CadastroPlanilhaBlock';
import { addCadastro, getAllCadastros, type CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { buscarCadastroPorNomeOuNip } from '../utils/buscarCadastroPorNomeOuNip';
import {
  formatMinutosSegundosInput,
  tempoMinutosSegundosValido,
  tempoParaExibicao,
} from '../utils/formatMinutosSegundos';

export default function AplicacaoTAFScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();

  const [cadastros, setCadastros] = useState<CadastroItemPersist[]>([]);
  const [modalBuscaAberto, setModalBuscaAberto] = useState(false);
  const [nomeOuNip, setNomeOuNip] = useState('');
  const [modalErroAberto, setModalErroAberto] = useState(false);
  const [mensagemErro, setMensagemErro] = useState('');

  const [modalTemposAberto, setModalTemposAberto] = useState(false);
  const [cadastroSelecionado, setCadastroSelecionado] = useState<CadastroItemPersist | null>(null);
  const [tempoCorrida, setTempoCorrida] = useState('');
  const [tempoNatacao, setTempoNatacao] = useState('');
  const [erroTempos, setErroTempos] = useState('');

  const [modalNatacaoAberto, setModalNatacaoAberto] = useState(false);
  const [cadastroAposTempos, setCadastroAposTempos] = useState<CadastroItemPersist | null>(null);
  const [resultadoNatacaoOpcao, setResultadoNatacaoOpcao] = useState<'aprovado' | 'reprovado' | null>(null);
  const [erroNatacao, setErroNatacao] = useState('');

  const grayBg = theme.background;
  const cardGlassEnabled = Platform.OS === 'web';
  const inputBorder = 'rgba(17,24,39,0.12)';

  const carregarCadastros = useCallback(() => {
    getAllCadastros()
      .then(setCadastros)
      .catch(() => undefined);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarCadastros();
    }, [carregarCadastros])
  );

  const abrirModalBusca = useCallback(() => {
    setNomeOuNip('');
    setModalBuscaAberto(true);
  }, []);

  const fecharModalBusca = useCallback(() => {
    setModalBuscaAberto(false);
  }, []);

  const fecharModalTempos = useCallback(() => {
    setModalTemposAberto(false);
    setCadastroSelecionado(null);
    setTempoCorrida('');
    setTempoNatacao('');
    setErroTempos('');
  }, []);

  const fecharModalNatacao = useCallback(() => {
    setModalNatacaoAberto(false);
    setCadastroAposTempos(null);
    setResultadoNatacaoOpcao(null);
    setErroNatacao('');
  }, []);

  const confirmarBusca = useCallback(async () => {
    const q = nomeOuNip.trim();
    if (!q) {
      setMensagemErro('Digite o nome ou o NIP do militar.');
      setModalBuscaAberto(false);
      setModalErroAberto(true);
      return;
    }

    const lista = await getAllCadastros();
    setCadastros(lista);

    const resultado = buscarCadastroPorNomeOuNip(lista, q);
    setModalBuscaAberto(false);
    setNomeOuNip('');

    if (resultado.kind === 'found') {
      const c = resultado.cadastro;
      const legacyTempo = (c as CadastroItemPersist & { tempo?: string }).tempo;
      setCadastroSelecionado(c);
      setTempoCorrida(tempoParaExibicao(c.tempoCorrida ?? legacyTempo));
      setTempoNatacao(tempoParaExibicao(c.tempoNatacao));
      setErroTempos('');
      setModalTemposAberto(true);
      return;
    }

    if (resultado.kind === 'ambiguous') {
      setMensagemErro(
        'Vários cadastros correspondem à busca. Informe o NIP completo (8 dígitos) ou o nome completo exatamente como está cadastrado.'
      );
    } else {
      setMensagemErro(
        'Nip ou Nome não encontrado. Cadastre o Militar antes de aplicar o TAF.'
      );
    }
    setModalErroAberto(true);
  }, [nomeOuNip]);

  const salvarTempos = useCallback(async () => {
    const c = cadastroSelecionado;
    if (!c) return;

    const tc = tempoCorrida.trim();
    const tn = tempoNatacao.trim();

    if (!tempoMinutosSegundosValido(tc)) {
      setErroTempos(
        'Corrida: use o formato MM:SS (ex.: 12:45). Minutos até 99 e segundos de 00 a 59. Deixe vazio se não for registrar.'
      );
      return;
    }
    if (!tempoMinutosSegundosValido(tn)) {
      setErroTempos(
        'Natação: use o formato MM:SS (ex.: 12:45). Minutos até 99 e segundos de 00 a 59. Deixe vazio se não for registrar.'
      );
      return;
    }

    setErroTempos('');

    const atualizado: CadastroItemPersist = {
      id: c.id,
      nip: c.nip,
      nome: c.nome,
      dataNascimento: c.dataNascimento,
      sexo: c.sexo,
      categoria: c.categoria,
      oficial: c.oficial,
      praca: c.praca,
      tempoCorrida: tc || undefined,
      tempoNatacao: tn || undefined,
      notaCorrida: c.notaCorrida,
      resultadoNatacao: c.resultadoNatacao,
    };

    await addCadastro(atualizado);
    const lista = await getAllCadastros();
    setCadastros(lista);

    setModalTemposAberto(false);
    setCadastroSelecionado(null);
    setTempoCorrida('');
    setTempoNatacao('');
    setErroTempos('');

    setCadastroAposTempos(atualizado);
    setResultadoNatacaoOpcao(atualizado.resultadoNatacao ?? null);
    setErroNatacao('');
    setModalNatacaoAberto(true);
  }, [cadastroSelecionado, tempoCorrida, tempoNatacao]);

  const salvarResultadoNatacao = useCallback(async () => {
    const base = cadastroAposTempos;
    if (!base) return;

    if (!resultadoNatacaoOpcao) {
      setErroNatacao('Marque Aprovado ou Reprovado.');
      return;
    }

    setErroNatacao('');

    const atualizado: CadastroItemPersist = {
      id: base.id,
      nip: base.nip,
      nome: base.nome,
      dataNascimento: base.dataNascimento,
      sexo: base.sexo,
      categoria: base.categoria,
      oficial: base.oficial,
      praca: base.praca,
      tempoCorrida: base.tempoCorrida,
      tempoNatacao: base.tempoNatacao,
      notaCorrida: base.notaCorrida,
      resultadoNatacao: resultadoNatacaoOpcao,
    };

    await addCadastro(atualizado);
    const lista = await getAllCadastros();
    setCadastros(lista);
    fecharModalNatacao();
  }, [cadastroAposTempos, resultadoNatacaoOpcao, fecharModalNatacao]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: grayBg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.centerWrap}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Home' as never)}
              style={styles.backBtn}
              accessibilityLabel="Voltar para Home"
            >
              <ChevronLeft size={26} color="#6B7280" strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.pageTitle}>Registrador de TAF</Text>
            </View>
          </View>

          <View style={styles.aplicarBtnWrap}>
            <TouchableOpacity
              accessibilityLabel="Registrar"
              activeOpacity={0.85}
              onPress={abrirModalBusca}
              style={styles.aplicarBtn}
            >
              <Text style={styles.aplicarBtnText} numberOfLines={1}>
                REGISTRAR
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 16 }} />

          <CadastroPlanilhaBlock
            variant="aplicacaoTaf"
            cadastros={cadastros}
            cardGlassEnabled={cardGlassEnabled}
            tableTitle="Cadastros"
            emptyMessageWhenNoData="Nenhum cadastro ainda. Cadastre militares na página de Cadastro."
            showActions={false}
          />
        </View>
      </ScrollView>

      {modalBuscaAberto ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nome ou NIP</Text>
              <TouchableOpacity
                accessibilityLabel="Fechar"
                onPress={fecharModalBusca}
                style={styles.modalCloseBtn}
              >
                <X size={18} color="#6B7280" strokeWidth={3} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Informe o nome completo ou o NIP do militar cadastrado.
            </Text>

            <TextInput
              value={nomeOuNip}
              onChangeText={setNomeOuNip}
              placeholder="Nome ou NIP"
              placeholderTextColor="rgba(17,24,39,0.35)"
              style={[styles.modalInput, { borderColor: inputBorder, color: '#111827' }]}
              autoCorrect={false}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="none"
              textContentType="none"
              keyboardType="default"
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity
                accessibilityLabel="Cancelar"
                onPress={fecharModalBusca}
                style={[styles.modalBtn, styles.modalBtnCancel]}
              >
                <Text style={styles.modalBtnTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Confirmar"
                onPress={confirmarBusca}
                style={[styles.modalBtn, styles.modalBtnPrimary]}
              >
                <Text style={styles.modalBtnTextPrimary}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {modalTemposAberto ? (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.modalCardTempos]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tempos</Text>
              <TouchableOpacity
                accessibilityLabel="Fechar tempos"
                onPress={fecharModalTempos}
                style={styles.modalCloseBtn}
              >
                <X size={18} color="#6B7280" strokeWidth={3} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Registre os tempos no formato MM:SS (minutos e segundos). Ex.: 12:45 para 12 minutos e 45 segundos.
            </Text>

            <Text style={styles.fieldLabel}>Corrida</Text>
            <TextInput
              value={tempoCorrida}
              onChangeText={(t) => {
                setErroTempos('');
                setTempoCorrida(formatMinutosSegundosInput(t));
              }}
              placeholder="MM:SS"
              placeholderTextColor="rgba(17,24,39,0.35)"
              style={[styles.modalInput, { borderColor: inputBorder, color: '#111827' }]}
              autoCorrect={false}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="none"
              textContentType="none"
              keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
              maxLength={5}
            />

            <Text style={styles.fieldLabel}>Natação</Text>
            <TextInput
              value={tempoNatacao}
              onChangeText={(t) => {
                setErroTempos('');
                setTempoNatacao(formatMinutosSegundosInput(t));
              }}
              placeholder="MM:SS"
              placeholderTextColor="rgba(17,24,39,0.35)"
              style={[styles.modalInput, { borderColor: inputBorder, color: '#111827' }]}
              autoCorrect={false}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="none"
              textContentType="none"
              keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
              maxLength={5}
            />

            {erroTempos ? <Text style={styles.erroTemposText}>{erroTempos}</Text> : null}

            <View style={styles.modalBtns}>
              <TouchableOpacity
                accessibilityLabel="Cancelar"
                onPress={fecharModalTempos}
                style={[styles.modalBtn, styles.modalBtnCancel]}
              >
                <Text style={styles.modalBtnTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Salvar tempos"
                onPress={salvarTempos}
                style={[styles.modalBtn, styles.modalBtnPrimary]}
              >
                <Text style={styles.modalBtnTextPrimary}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {modalNatacaoAberto ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Permanência</Text>
              <TouchableOpacity
                accessibilityLabel="Fechar resultado permanência"
                onPress={fecharModalNatacao}
                style={styles.modalCloseBtn}
              >
                <X size={18} color="#6B7280" strokeWidth={3} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Marque o resultado da prova de permanência.
            </Text>

            <TouchableOpacity
              accessibilityRole="checkbox"
              accessibilityState={{ checked: resultadoNatacaoOpcao === 'aprovado' }}
              onPress={() => {
                setErroNatacao('');
                setResultadoNatacaoOpcao('aprovado');
              }}
              style={styles.checkRow}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.checkBox,
                  resultadoNatacaoOpcao === 'aprovado' ? styles.checkBoxOn : styles.checkBoxOff,
                ]}
              >
                {resultadoNatacaoOpcao === 'aprovado' ? (
                  <Check size={16} color="#FFFFFF" strokeWidth={3} />
                ) : null}
              </View>
              <Text style={styles.checkLabel}>Aprovado</Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="checkbox"
              accessibilityState={{ checked: resultadoNatacaoOpcao === 'reprovado' }}
              onPress={() => {
                setErroNatacao('');
                setResultadoNatacaoOpcao('reprovado');
              }}
              style={styles.checkRow}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.checkBox,
                  resultadoNatacaoOpcao === 'reprovado' ? styles.checkBoxOn : styles.checkBoxOff,
                ]}
              >
                {resultadoNatacaoOpcao === 'reprovado' ? (
                  <Check size={16} color="#FFFFFF" strokeWidth={3} />
                ) : null}
              </View>
              <Text style={styles.checkLabel}>Reprovado</Text>
            </TouchableOpacity>

            {erroNatacao ? <Text style={styles.erroTemposText}>{erroNatacao}</Text> : null}

            <View style={[styles.modalBtns, { marginTop: 8 }]}>
              <TouchableOpacity
                accessibilityLabel="Cancelar"
                onPress={fecharModalNatacao}
                style={[styles.modalBtn, styles.modalBtnCancel]}
              >
                <Text style={styles.modalBtnTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Confirmar resultado"
                onPress={salvarResultadoNatacao}
                style={[styles.modalBtn, styles.modalBtnPrimary]}
              >
                <Text style={styles.modalBtnTextPrimary}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {modalErroAberto ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Atenção</Text>
              <TouchableOpacity
                accessibilityLabel="Fechar aviso"
                onPress={() => setModalErroAberto(false)}
                style={styles.modalCloseBtn}
              >
                <X size={18} color="#6B7280" strokeWidth={3} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>{mensagemErro}</Text>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                accessibilityLabel="Entendi"
                onPress={() => setModalErroAberto(false)}
                style={[styles.modalBtn, styles.modalBtnPrimary, { flex: 1 }]}
              >
                <Text style={styles.modalBtnTextPrimary}>Entendi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, position: 'relative' },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 10 },
  centerWrap: { flex: 1, alignItems: 'center' },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1 },
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  aplicarBtnWrap: {
    width: '100%',
    maxWidth: 720,
    marginBottom: 0,
  },
  aplicarBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.12)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 24px rgba(17,24,39,0.12)' } as object)
      : {}),
  },
  aplicarBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.10)',
  },
  modalCardTempos: {
    maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#111827' },
  modalSubtitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 12 },
  modalCloseBtn: { padding: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(17,24,39,0.12)' },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
  },
  modalBtns: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
  modalBtnCancel: { borderColor: 'rgba(17,24,39,0.12)', backgroundColor: 'rgba(17,24,39,0.04)' },
  modalBtnTextCancel: { color: '#111827', fontSize: 13, fontWeight: '900' },
  modalBtnPrimary: {
    borderColor: 'rgba(17,24,39,0.12)',
    backgroundColor: '#111827',
  },
  modalBtnTextPrimary: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  erroTemposText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B91C1C',
    marginBottom: 12,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  checkBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  checkBoxOff: {
    borderColor: 'rgba(17,24,39,0.25)',
    backgroundColor: '#FFFFFF',
  },
  checkBoxOn: {
    borderColor: '#111827',
    backgroundColor: '#111827',
  },
  checkLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
});
