import React, { useEffect, useMemo, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { ChevronLeft, X } from 'lucide-react-native';
import { Card } from '../components/Card';
import { CadastroPlanilhaBlock } from '../components/CadastroPlanilhaBlock';
import { LabelNip } from '../components/LabelNip';
import { LabelSO } from '../components/LabelSO';
import { LabelSvgText } from '../components/LabelSvgText';
import { addCadastro, deleteCadastro, getAllCadastros } from '../services/cadastrosIndexedDb';

type Categoria = 'Oficiais' | 'Praças';

type CadastroItem = {
  id: string;
  nip: string;
  nome: string;
  dataNascimento: string;
  categoria: Categoria;
  /** Gênero (formulário: Masculino/Feminino) — persiste como M/F. */
  sexo?: 'M' | 'F';
  oficial?: string;
  praca?: string;
  tempoCorrida?: string;
  tempoNatacao?: string;
  notaCorrida?: string;
  resultadoNatacao?: 'aprovado' | 'reprovado';
};

function formatDateInput(value: string) {
  // Mantém apenas dígitos e força no formato DD/MM/AAAA.
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);

  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}/${mm}`;
  return `${dd}/${mm}/${yyyy}`;
}

function formatNipInput(value: string) {
  // Formato: 00.0000.00
  const digits = value.replace(/\D/g, '').slice(0, 8); // 2 + 4 + 2
  const a = digits.slice(0, 2);
  const b = digits.slice(2, 6);
  const c = digits.slice(6, 8);

  if (digits.length <= 2) return a;
  if (digits.length <= 6) return `${a}.${digits.slice(2)}`;
  return `${a}.${b}.${c}`;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.labelText}>{children}</Text>;
}

export default function CadastroScreenModern() {
  const { theme } = useTheme();
  const navigation = useNavigation();

  const [categoria, setCategoria] = useState<Categoria | ''>('');
  const [oficialSelecionado, setOficialSelecionado] = useState<string>('');
  const [pracaSelecionada, setPracaSelecionada] = useState<string>('');

  const [nip, setNip] = useState<string>('');
  const [nome, setNome] = useState<string>('');
  const [dataNascimento, setDataNascimento] = useState<string>('');
  const [sexo, setSexo] = useState<'M' | 'F'>('M');
  const [cadastros, setCadastros] = useState<CadastroItem[]>([]);
  const [faltantes, setFaltantes] = useState<string[]>([]);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarTabela, setMostrarTabela] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [modalNipDuplicado, setModalNipDuplicado] = useState(false);
  const [modalCadastroSucesso, setModalCadastroSucesso] = useState(false);

  const datePlaceholder = useMemo(() => '00/00/0000', []);

  const grayBg = theme.background; // já é #F5F7FA no light
  const cardGlassEnabled = Platform.OS === 'web'; // em mobile mantém minimal, sem blur excessivo

  const selectedBg = '#111827'; // slate-900
  const unselectedBg = 'rgba(17,24,39,0.06)';
  const selectedText = '#FFFFFF';
  const unselectedText = '#374151'; // gray-700 (mesma cor dos FieldLabel)
  const inputBg = '#FFFFFF';
  const inputBorder = 'rgba(17,24,39,0.12)';

  function setCategoriaWithReset(next: Categoria) {
    setOficialSelecionado('');
    setPracaSelecionada('');
    setCategoria(next);
  }

  function handleCadastrar() {
    if (!categoria) return;

    const faltantesAgora: string[] = [];
    if (!nip.trim()) faltantesAgora.push('Nip');
    if (!nome.trim()) faltantesAgora.push('Nome');
    if (!dataNascimento.trim()) faltantesAgora.push('Data de nascimento');
    if (categoria === 'Oficiais' && !oficialSelecionado.trim()) faltantesAgora.push('Oficial');
    if (categoria === 'Praças' && !pracaSelecionada.trim()) faltantesAgora.push('Graduação');

    setFaltantes(faltantesAgora);
    if (faltantesAgora.length > 0) return;

    const nipFinal = formatNipInput(nip).trim();
    const nipDigits = nipFinal.replace(/\D/g, '');
    if (nipDigits.length > 0) {
      const jaExiste = cadastros.some((c) => {
        const outrosDigitos = (c.nip || '').replace(/\D/g, '');
        if (outrosDigitos !== nipDigits) return false;
        if (editandoId && c.id === editandoId) return false;
        return true;
      });
      if (jaExiste) {
        setModalNipDuplicado(true);
        return;
      }
    }

    const isEdicao = !!editandoId;

    const id = editandoId ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const anterior = editandoId ? cadastros.find((c) => c.id === editandoId) : undefined;
    const legacyTempo = anterior ? (anterior as CadastroItem & { tempo?: string }).tempo : undefined;
    const novoCadastro: CadastroItem = {
      id,
      // Reaplica a máscara/filtragem numérica para evitar que o corretor
      // injete texto (ex.: "Beliscar") no valor salvo.
      nip: nipFinal,
      nome: nome.trim(),
      dataNascimento: dataNascimento.trim(),
      sexo,
      categoria,
      // Se ainda não selecionou o oficial, mantém vazio (mostra '-' na tabela).
      oficial: categoria === 'Oficiais' ? oficialSelecionado : undefined,
      praca: categoria === 'Praças' ? pracaSelecionada : undefined,
      tempoCorrida: anterior?.tempoCorrida ?? legacyTempo,
      tempoNatacao: anterior?.tempoNatacao,
      notaCorrida: anterior?.notaCorrida,
      resultadoNatacao: anterior?.resultadoNatacao,
    };

    setCadastros((prev) => {
      if (editandoId) return prev.map((c) => (c.id === id ? novoCadastro : c));
      return [...prev, novoCadastro];
    });
    // Persistência: não trava a UX se IndexedDB falhar.
    addCadastro(novoCadastro).catch(() => undefined);

    setEditandoId(null);

    if (!isEdicao) {
      setModalCadastroSucesso(true);
      setNip('');
      setNome('');
      setDataNascimento('');
      setSexo('M');
      setOficialSelecionado('');
      setPracaSelecionada('');
      setCategoria('');
      setFaltantes([]);
    }
  }

  function handleEditar(item: CadastroItem) {
    setEditandoId(item.id);
    setExcluirId(null);
    setFaltantes([]);

    setMostrarFormulario(true);
    setMostrarTabela(false);

    setCategoria(item.categoria);
    if (item.categoria === 'Oficiais') {
      setOficialSelecionado(item.oficial || '');
      setPracaSelecionada('');
    } else {
      setOficialSelecionado('');
      setPracaSelecionada(item.praca || '');
    }

    setNip(item.nip || '');
    setNome(item.nome || '');
    setDataNascimento(item.dataNascimento || '');
    setSexo(item.sexo === 'F' ? 'F' : 'M');
  }

  async function handleConfirmarExcluir() {
    if (!excluirId) return;
    const id = excluirId;

    setExcluirId(null);
    // Atualiza a UI imediatamente para responsividade.
    setCadastros((prev) => prev.filter((c) => c.id !== id));

    await deleteCadastro(id);

    if (editandoId === id) setEditandoId(null);
  }

  useEffect(() => {
    let mounted = true;
    getAllCadastros()
      .then((items) => {
        if (!mounted) return;
        setCadastros(items as CadastroItem[]);
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!modalCadastroSucesso) return;
    const t = setTimeout(() => setModalCadastroSucesso(false), 2000);
    return () => clearTimeout(t);
  }, [modalCadastroSucesso]);

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
              <Text style={styles.pageTitle}>Cadastro</Text>
            </View>
          </View>

          <View style={styles.toggleStack}>
            <TouchableOpacity
              accessibilityLabel="Mostrar formulário"
              onPress={() => setMostrarFormulario((v) => !v)}
              style={[styles.toggleBtn, mostrarFormulario ? styles.toggleBtnActive : null]}
            >
              <Text
                style={[styles.toggleBtnText, mostrarFormulario ? styles.toggleBtnTextActive : null]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Realizar Cadastro
              </Text>
            </TouchableOpacity>
          </View>

          {mostrarFormulario ? (
            <Card glass={cardGlassEnabled} style={styles.formCard}>
              <View style={styles.section}>
                <FieldLabel>Categoria</FieldLabel>

                <View style={styles.segmented}>
                  <TouchableOpacity
                    onPress={() => setCategoriaWithReset('Oficiais')}
                    style={[
                      styles.segmentBtn,
                      categoria === 'Oficiais' ? { backgroundColor: selectedBg } : { backgroundColor: unselectedBg },
                    ]}
                  >
                    <Text style={categoria === 'Oficiais' ? styles.segmentTextSelected : styles.segmentText}>
                      Oficiais
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setCategoriaWithReset('Praças')}
                    style={[
                      styles.segmentBtn,
                      categoria === 'Praças' ? { backgroundColor: selectedBg } : { backgroundColor: unselectedBg },
                    ]}
                  >
                    <Text style={categoria === 'Praças' ? styles.segmentTextSelected : styles.segmentText}>
                      Praças
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {categoria === 'Oficiais' ? (
                <View style={styles.section}>
                  <FieldLabel>Oficial</FieldLabel>
                  <View style={styles.optionGrid}>
                    {['GM', '2°TEN', '1°TEN', 'CT', 'CC', 'CF', 'CMG'].map((opt) => {
                      const active = oficialSelecionado === opt;
                      return (
                        <TouchableOpacity
                          key={opt}
                          onPress={() => setOficialSelecionado(opt)}
                          style={[
                            styles.optionBtn,
                            active ? { backgroundColor: selectedBg } : { backgroundColor: unselectedBg },
                          ]}
                        >
                        {opt === 'CT' ? (
                          <LabelSvgText
                            text="CT"
                            color={active ? '#FFFFFF' : '#111827'}
                            fontSize={13}
                            fontWeight={800}
                            width={28}
                            height={18}
                          />
                        ) : (
                          <Text style={active ? styles.segmentTextSelected : styles.segmentText}>{opt}</Text>
                        )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {categoria === 'Praças' ? (
                <View style={styles.section}>
                  <FieldLabel>Graduação</FieldLabel>
                  <View style={styles.optionGrid}>
                    {['MN', 'CB', '3°SG', '2°SG', '1°SG', 'SO'].map((opt) => {
                      const active = pracaSelecionada === opt;
                      return (
                        <TouchableOpacity
                          key={opt}
                          onPress={() => setPracaSelecionada(opt)}
                          style={[
                            styles.optionBtn,
                            active ? { backgroundColor: selectedBg } : { backgroundColor: unselectedBg },
                          ]}
                        >
                          {opt === 'SO' ? (
                            <LabelSO color={active ? '#FFFFFF' : '#111827'} fontSize={13} fontWeight={800} />
                          ) : (
                            <Text style={active ? styles.segmentTextSelected : styles.segmentText}>{opt}</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <View style={styles.section}>
                {/* Nip label via SVG para evitar corretor automático do Chrome */}
                <View style={styles.labelRow}>
                  <View style={styles.labelSvgWrap}>
                    <LabelNip color={unselectedText} />
                  </View>
                </View>

                <TextInput
                  value={nip}
                  onChangeText={(t) => setNip(formatNipInput(t))}
                  placeholder=""
                  placeholderTextColor="rgba(17,24,39,0.35)"
                  style={[
                    styles.input,
                    {
                      borderColor: inputBorder,
                      backgroundColor: inputBg,
                      color: '#111827',
                    },
                  ]}
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="none"
                  name="nip"
                  textContentType="none"
                  keyboardType="numeric"
                  maxLength={10}
                  inputMode="numeric"
                />
              </View>

              <View style={styles.section}>
                <FieldLabel>Nome</FieldLabel>
                <TextInput
                  value={nome}
                  onChangeText={(t) => setNome(t)}
                  placeholder="Nome"
                  placeholderTextColor="rgba(17,24,39,0.35)"
                  style={[
                    styles.input,
                    {
                      borderColor: inputBorder,
                      backgroundColor: inputBg,
                      color: '#111827',
                    },
                  ]}
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="none"
                  textContentType="none"
                />
              </View>

              <View style={styles.section}>
                <FieldLabel>Data de nascimento</FieldLabel>
                <TextInput
                  value={dataNascimento}
                  onChangeText={(t) => setDataNascimento(formatDateInput(t))}
                  placeholder={datePlaceholder}
                  placeholderTextColor="rgba(17,24,39,0.35)"
                  style={[
                    styles.input,
                    {
                      borderColor: inputBorder,
                      backgroundColor: inputBg,
                      color: '#111827',
                    },
                  ]}
                  keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
                  inputMode="numeric"
                  maxLength={10}
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="none"
                  textContentType="none"
                />
              </View>

              <View style={styles.section}>
                <FieldLabel>Gênero</FieldLabel>
                <View style={styles.segmented}>
                  {(['M', 'F'] as const).map((sx) => {
                    const active = sexo === sx;
                    return (
                      <TouchableOpacity
                        key={sx}
                        accessibilityLabel={sx === 'M' ? 'Masculino' : 'Feminino'}
                        onPress={() => setSexo(sx)}
                        style={[
                          styles.segmentBtn,
                          { backgroundColor: active ? selectedBg : unselectedBg },
                        ]}
                      >
                        <Text style={active ? styles.segmentTextSelected : styles.segmentText}>
                          {sx === 'M' ? 'Masculino' : 'Feminino'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.btnRow}>
                <TouchableOpacity
                  accessibilityLabel="cadastrar"
                  onPress={handleCadastrar}
                  style={styles.btn}
                >
                  <Text style={styles.btnText}>cadastrar</Text>
                </TouchableOpacity>
              </View>

              {faltantes.length > 0 ? (
                <Text style={styles.warnText}>Atenção: faltam {faltantes.join(', ')}.</Text>
              ) : null}
            </Card>
          ) : null}

          <View style={styles.tableToggleStack}>
            <TouchableOpacity
              accessibilityLabel="Mostrar tabela"
              onPress={() => setMostrarTabela((v) => !v)}
              style={[styles.toggleBtn, mostrarTabela ? styles.toggleBtnActive : null]}
            >
              <Text
                style={[styles.toggleBtnText, mostrarTabela ? styles.toggleBtnTextActive : null]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Planilha de Cadastro
              </Text>
            </TouchableOpacity>
          </View>

          {mostrarTabela ? <View style={{ height: 16 }} /> : null}

          {mostrarTabela ? (
            <CadastroPlanilhaBlock
              cadastros={cadastros}
              cardGlassEnabled={cardGlassEnabled}
              showActions
              onEdit={handleEditar}
              onRequestDelete={(c) => setExcluirId(c.id)}
            />
          ) : null}
        </View>
      </ScrollView>

      {excluirId ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Excluir cadastro?</Text>
              <TouchableOpacity
                accessibilityLabel="Fechar modal"
                onPress={() => setExcluirId(null)}
                style={styles.modalCloseBtn}
              >
                <X size={18} color="#6B7280" strokeWidth={3} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>Tem certeza que deseja excluir esta linha?</Text>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                accessibilityLabel="Cancelar exclusao"
                onPress={() => setExcluirId(null)}
                style={[styles.modalBtn, styles.modalBtnCancel]}
              >
                <Text style={styles.modalBtnTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Confirmar exclusao"
                onPress={handleConfirmarExcluir}
                style={[styles.modalBtn, styles.modalBtnDanger]}
              >
                <Text style={styles.modalBtnTextDanger}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {modalCadastroSucesso ? (
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <View style={styles.modalCard}>
            <Text style={styles.modalTitleSuccess}>Militar Cadastrado com Sucesso</Text>
          </View>
        </View>
      ) : null}

      {modalNipDuplicado ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Militar já cadastrado</Text>
              <TouchableOpacity
                accessibilityLabel="Fechar aviso de NIP duplicado"
                onPress={() => setModalNipDuplicado(false)}
                style={styles.modalCloseBtn}
              >
                <X size={18} color="#6B7280" strokeWidth={3} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              O NIP informado já está cadastrado. Não é possível repetir o cadastro do mesmo militar.
            </Text>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                accessibilityLabel="Entendi"
                onPress={() => setModalNipDuplicado(false)}
                style={[styles.modalBtn, styles.modalBtnPrimary]}
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
  formCard: {
    width: '100%',
    maxWidth: 720,
    padding: 18,
    borderRadius: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(17,24,39,0.8)',
    marginBottom: 16,
  },
  section: { marginBottom: 16 },
  labelText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#374151', // gray-700
    marginBottom: 10,
  },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelSvgWrap: { marginBottom: 10 },

  // Botões para alternar Formulário/Tabela
  toggleRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
    padding: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.10)',
    backgroundColor: 'rgba(255,255,255,0.55)',
    marginBottom: 14,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 10px 30px rgba(17,24,39,0.10)',
        } as any)
      : {}),
  },
  toggleStack: {
    width: '100%',
    maxWidth: 720,
    alignItems: 'stretch',
    padding: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.10)',
    backgroundColor: 'rgba(255,255,255,0.55)',
    marginBottom: 14,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 10px 30px rgba(17,24,39,0.10)',
        } as any)
      : {}),
  },
  tableToggleStack: {
    width: '100%',
    maxWidth: 720,
    alignItems: 'stretch',
    padding: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.10)',
    backgroundColor: 'rgba(255,255,255,0.55)',
    marginTop: 8,
    marginBottom: 14,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 10px 30px rgba(17,24,39,0.10)',
        } as any)
      : {}),
  },
  toggleBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.08)',
    backgroundColor: 'rgba(17,24,39,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  toggleBtnText: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '800',
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
  },

  segmented: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.10)',
    overflow: 'hidden',
  },
  segmentBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  segmentText: { color: '#111827', fontSize: 13, fontWeight: '800' },
  segmentTextSelected: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  btnRow: { marginTop: 8 },
  btn: {
    marginTop: 6,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#374151', // gray-700 (minimal SaaS)
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

  warnText: { marginTop: 8, fontSize: 12, fontWeight: '700', color: '#9CA3AF' },

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
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#111827' },
  modalTitleSuccess: {
    fontSize: 17,
    fontWeight: '900',
    color: '#15803D',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 14 },
  modalCloseBtn: { padding: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(17,24,39,0.12)' },
  modalBtns: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
  modalBtnCancel: { borderColor: 'rgba(17,24,39,0.12)', backgroundColor: 'rgba(17,24,39,0.04)' },
  modalBtnTextCancel: { color: '#111827', fontSize: 13, fontWeight: '900' },
  modalBtnDanger: { borderColor: 'rgba(220,38,38,0.30)', backgroundColor: 'rgba(220,38,38,0.12)' },
  modalBtnTextDanger: { color: '#DC2626', fontSize: 13, fontWeight: '900' },
  modalBtnPrimary: {
    flex: 1,
    borderColor: 'rgba(17,24,39,0.12)',
    backgroundColor: '#111827',
  },
  modalBtnTextPrimary: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});

