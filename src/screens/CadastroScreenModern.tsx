import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { ChevronLeft, X } from 'lucide-react-native';
import { Card } from '../components/Card';
import { CadastroPlanilhaBlock } from '../components/CadastroPlanilhaBlock';
const CarregarPlanilhaCadastro = React.lazy(() =>
  import('../components/CarregarPlanilhaCadastro').then((m) => ({
    default: m.CarregarPlanilhaCadastro,
  })),
);
import { LabelNip } from '../components/LabelNip';
import { LabelSO } from '../components/LabelSO';
import { LabelSvgText } from '../components/LabelSvgText';
import { addCadastro, deleteCadastro, getAllCadastros } from '../services/cadastrosIndexedDb';
import {
  notaCorridaParaPersistencia,
  textoNotaCorridaFromCadastro,
} from '../taf/corrida2400Nota';
import {
  notaNatacaoParaPersistencia,
  textoNotaNatacaoFromCadastro,
} from '../taf/natacaoNota';
import { PREMIUM } from '../theme/premium';
import { fontFamily } from '../theme/typography';

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
  notaNatacao?: string;
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
  const { theme } = useTheme();
  const ts = theme.textStyles;
  return <Text style={[ts.label, styles.labelText]}>{children}</Text>;
}

export default function CadastroScreenModern() {
  const { theme, fontsLoaded } = useTheme();
  const navigation = useNavigation();
  const ts = theme.textStyles;
  const regularFont = fontFamily('regular', fontsLoaded);
  const boldFont = fontFamily('bold', fontsLoaded);

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

  useFocusEffect(
    useCallback(() => {
      setMostrarFormulario(false);
      setMostrarTabela(false);
    }, []),
  );

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [modalNipDuplicado, setModalNipDuplicado] = useState(false);
  const [modalCadastroSucesso, setModalCadastroSucesso] = useState(false);

  const datePlaceholder = useMemo(() => '00/00/0000', []);

  function setCategoriaWithReset(next: Categoria) {
    setOficialSelecionado('');
    setPracaSelecionada('');
    setCategoria(next);
  }

  function handleCadastrar() {
    if (!categoria) return;

    const faltantesAgora: string[] = [];
    if (!nip.trim()) faltantesAgora.push('NIP');
    if (!nome.trim()) faltantesAgora.push('Nome');
    if (!dataNascimento.trim()) faltantesAgora.push('Data de Nascimento');
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
    const tempoCorridaSalvo = (anterior?.tempoCorrida ?? legacyTempo ?? '').trim();
    const tempoNatacaoSalvo = (anterior?.tempoNatacao ?? '').trim();
    const dataNasc = dataNascimento.trim();
    const novoCadastro: CadastroItem = {
      id,
      // Reaplica a máscara/filtragem numérica para evitar que o corretor
      // injete texto (ex.: "Beliscar") no valor salvo.
      nip: nipFinal,
      nome: nome.trim(),
      dataNascimento: dataNasc,
      sexo,
      categoria,
      // Se ainda não selecionou o oficial, mantém vazio (mostra '-' na tabela).
      oficial: categoria === 'Oficiais' ? oficialSelecionado : undefined,
      praca: categoria === 'Praças' ? pracaSelecionada : undefined,
      tempoCorrida: tempoCorridaSalvo || undefined,
      tempoNatacao: tempoNatacaoSalvo || undefined,
      notaCorrida: tempoCorridaSalvo
        ? notaCorridaParaPersistencia(
            textoNotaCorridaFromCadastro({
              tempoCorrida: tempoCorridaSalvo,
              dataNascimento: dataNasc,
              sexo,
            }),
          )
        : undefined,
      notaNatacao: tempoNatacaoSalvo
        ? notaNatacaoParaPersistencia(
            textoNotaNatacaoFromCadastro({
              tempoNatacao: tempoNatacaoSalvo,
              dataNascimento: dataNasc,
              sexo,
            }),
          )
        : undefined,
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

  const recarregarCadastros = useCallback(() => {
    getAllCadastros()
      .then((items) => setCadastros(items as CadastroItem[]))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    recarregarCadastros();
  }, [recarregarCadastros]);

  useEffect(() => {
    if (!modalCadastroSucesso) return;
    const t = setTimeout(() => setModalCadastroSucesso(false), 2000);
    return () => clearTimeout(t);
  }, [modalCadastroSucesso]);

  const selectedBgColor = theme.primary;
  const unselectedBgColor = theme.backgroundSecondary;
  const selectedTextColor = theme.text;
  const unselectedTextColor = theme.textSecondary;
  const inputTextColor = theme.text;
  const inputBgColor = theme.cardBg;
  const inputBorderColor = theme.border;
  const dangerColor = theme.loss;
  const successColor = theme.gain;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
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
              <ChevronLeft size={26} color={theme.text} strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={[ts.h2, styles.pageTitle]}>Cadastro</Text>
            </View>
          </View>

          <View style={[styles.toggleStack, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <TouchableOpacity
              accessibilityLabel="Mostrar formulário"
              onPress={() => setMostrarFormulario((v) => !v)}
              style={[
                styles.toggleBtn,
                mostrarFormulario
                  ? { backgroundColor: selectedBgColor, borderColor: selectedBgColor }
                  : { backgroundColor: unselectedBgColor, borderColor: theme.borderSubtle },
              ]}
            >
              <Text
                style={[
                  ts.caption,
                  mostrarFormulario
                    ? { color: selectedTextColor }
                    : { color: unselectedTextColor },
                  styles.toggleBtnText,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Realizar Cadastro
              </Text>
            </TouchableOpacity>
          </View>

          {mostrarFormulario ? (
            <Card elevated style={styles.formCard}>
              <View style={styles.section}>
                <FieldLabel>Categoria</FieldLabel>

                <View style={[styles.segmented, { borderColor: theme.border }]}>
                  <TouchableOpacity
                    onPress={() => setCategoriaWithReset('Oficiais')}
                    style={[
                      styles.segmentBtn,
                      categoria === 'Oficiais'
                        ? { backgroundColor: selectedBgColor }
                        : { backgroundColor: unselectedBgColor },
                    ]}
                  >
                    <Text
                      style={[
                        ts.caption,
                        categoria === 'Oficiais' ? { color: selectedTextColor } : { color: unselectedTextColor },
                        styles.segmentText,
                      ]}
                    >
                      Oficiais
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setCategoriaWithReset('Praças')}
                    style={[
                      styles.segmentBtn,
                      categoria === 'Praças'
                        ? { backgroundColor: selectedBgColor }
                        : { backgroundColor: unselectedBgColor },
                    ]}
                  >
                    <Text
                      style={[
                        ts.caption,
                        categoria === 'Praças' ? { color: selectedTextColor } : { color: unselectedTextColor },
                        styles.segmentText,
                      ]}
                    >
                      Praças
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {categoria === 'Oficiais' ? (
                <View style={styles.section}>
                  <FieldLabel>Oficial</FieldLabel>
                  <View style={styles.optionGrid}>
                    {['GM', '2°TEN', '1°TEN', 'CT', 'CC', 'CF', 'CMG', 'CALTE'].map((opt) => {
                      const active = oficialSelecionado === opt;
                      return (
                        <TouchableOpacity
                          key={opt}
                          onPress={() => setOficialSelecionado(opt)}
                          style={[
                            styles.optionBtn,
                            active ? { backgroundColor: selectedBgColor } : { backgroundColor: unselectedBgColor, borderColor: theme.borderSubtle },
                          ]}
                        >
                          {opt === 'CT' ? (
                            <LabelSvgText
                              text="CT"
                              color={active ? selectedTextColor : unselectedTextColor}
                              fontSize={13}
                              fontWeight={800}
                            />
                          ) : (
                            <Text
                              style={[
                                ts.caption,
                                active ? { color: selectedTextColor } : { color: unselectedTextColor },
                                styles.segmentText,
                              ]}
                            >
                              {opt}
                            </Text>
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
                            active ? { backgroundColor: selectedBgColor } : { backgroundColor: unselectedBgColor, borderColor: theme.borderSubtle },
                          ]}
                        >
                          {opt === 'SO' ? (
                            <LabelSO color={active ? selectedTextColor : unselectedTextColor} fontSize={13} fontWeight={800} />
                          ) : (
                            <Text
                              style={[
                                ts.caption,
                                active ? { color: selectedTextColor } : { color: unselectedTextColor },
                                styles.segmentText,
                              ]}
                            >
                              {opt}
                            </Text>
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
                    <LabelNip color={unselectedTextColor} />
                  </View>
                </View>

                <TextInput
                  value={nip}
                  onChangeText={(t) => setNip(formatNipInput(t))}
                  placeholder=""
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.input,
                    {
                      borderColor: inputBorderColor,
                      backgroundColor: inputBgColor,
                      color: inputTextColor,
                      fontFamily: regularFont,
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
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.input,
                    {
                      borderColor: inputBorderColor,
                      backgroundColor: inputBgColor,
                      color: inputTextColor,
                      fontFamily: regularFont,
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
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.input,
                    {
                      borderColor: inputBorderColor,
                      backgroundColor: inputBgColor,
                      color: inputTextColor,
                      fontFamily: regularFont,
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
                <View style={[styles.segmented, { borderColor: theme.border }]}>
                  {(['M', 'F'] as const).map((sx) => {
                    const active = sexo === sx;
                    return (
                      <TouchableOpacity
                        key={sx}
                        accessibilityLabel={sx === 'M' ? 'Masculino' : 'Feminino'}
                        onPress={() => setSexo(sx)}
                        style={[
                          styles.segmentBtn,
                          active
                            ? { backgroundColor: selectedBgColor }
                            : { backgroundColor: unselectedBgColor },
                        ]}
                      >
                        <Text
                          style={[
                            ts.caption,
                            active ? { color: selectedTextColor } : { color: unselectedTextColor },
                            styles.segmentText,
                          ]}
                        >
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
                  style={[styles.btn, { backgroundColor: theme.primary }]}
                >
                  <Text style={[ts.body, styles.btnText]}>Cadastrar</Text>
                </TouchableOpacity>
              </View>

              {faltantes.length > 0 ? (
                <Text style={[ts.caption, styles.warnText, { color: dangerColor }]}>
                  Atenção: faltam {faltantes.join(', ')}.
                </Text>
              ) : null}
            </Card>
          ) : null}

          <View style={[styles.tableToggleStack, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <TouchableOpacity
              accessibilityLabel="Mostrar tabela"
              onPress={() => setMostrarTabela((v) => !v)}
              style={[
                styles.toggleBtn,
                mostrarTabela
                  ? { backgroundColor: selectedBgColor, borderColor: selectedBgColor }
                  : { backgroundColor: unselectedBgColor, borderColor: theme.borderSubtle },
              ]}
            >
              <Text
                style={[
                  ts.caption,
                  mostrarTabela
                    ? { color: selectedTextColor }
                    : { color: unselectedTextColor },
                  styles.toggleBtnText,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Planilha de Cadastro
              </Text>
            </TouchableOpacity>
          </View>

          {mostrarTabela ? (
            <Suspense
              fallback={
                <View style={{ width: '100%', maxWidth: 720, paddingVertical: 12, alignItems: 'center' }}>
                  <ActivityIndicator color={theme.primary} />
                </View>
              }
            >
              <CarregarPlanilhaCadastro onImportComplete={recarregarCadastros} />
            </Suspense>
          ) : null}

          {mostrarTabela ? <View style={{ height: 16 }} /> : null}

          {mostrarTabela ? (
            <CadastroPlanilhaBlock
              cadastros={cadastros}
              cardGlassEnabled={false}
              showActions
              onEdit={handleEditar}
              onRequestDelete={(c) => setExcluirId(c.id)}
            />
          ) : null}
        </View>
      </ScrollView>

      {excluirId ? (
        <View style={[styles.modalOverlay, { backgroundColor: theme.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.45)' }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[ts.h2, styles.modalTitle, { color: theme.text }]}>Excluir cadastro?</Text>
              <TouchableOpacity
                accessibilityLabel="Fechar modal"
                onPress={() => setExcluirId(null)}
                style={[styles.modalCloseBtn, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
              >
                <X size={18} color={theme.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <Text style={[ts.bodySecondary, styles.modalSubtitle, { color: theme.textSecondary }]}>
              Tem certeza que deseja excluir esta linha?
            </Text>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                accessibilityLabel="Cancelar exclusao"
                onPress={() => setExcluirId(null)}
                style={[styles.modalBtn, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
              >
                <Text style={[ts.caption, { color: theme.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Confirmar exclusao"
                onPress={handleConfirmarExcluir}
                style={[styles.modalBtn, { borderColor: dangerColor, backgroundColor: theme.lossMuted }]}
              >
                <Text style={[ts.caption, { color: dangerColor }]}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {modalCadastroSucesso ? (
        <View style={[styles.modalOverlay, { backgroundColor: theme.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.45)' }]} pointerEvents="box-none">
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Text style={[ts.h2, styles.modalTitleSuccess, { color: successColor }]}>
              Militar Cadastrado com Sucesso
            </Text>
          </View>
        </View>
      ) : null}

      {modalNipDuplicado ? (
        <View style={[styles.modalOverlay, { backgroundColor: theme.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.45)' }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[ts.h2, styles.modalTitle, { color: theme.text }]}>Militar já cadastrado</Text>
              <TouchableOpacity
                accessibilityLabel="Fechar aviso de NIP duplicado"
                onPress={() => setModalNipDuplicado(false)}
                style={[styles.modalCloseBtn, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
              >
                <X size={18} color={theme.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <Text style={[ts.bodySecondary, styles.modalSubtitle, { color: theme.textSecondary }]}>
              O NIP informado já está cadastrado. Não é possível repetir o cadastro do mesmo militar.
            </Text>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                accessibilityLabel="Entendi"
                onPress={() => setModalNipDuplicado(false)}
                style={[styles.modalBtn, { borderColor: theme.border, backgroundColor: theme.primary }]}
              >
                <Text style={[ts.caption, { color: theme.text }]}>Entendi</Text>
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
  scrollContent: { paddingHorizontal: 16, paddingVertical: 16 },
  centerWrap: { flex: 1, alignItems: 'center' },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  backBtn: {
    width: PREMIUM.minTouch,
    height: PREMIUM.minTouch,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1 },
  pageTitle: {
    textAlign: 'center',
  },
  formCard: {
    width: '100%',
    maxWidth: 720,
    marginBottom: 20,
  },
  sectionTitle: {
    marginBottom: 14,
  },
  section: { marginBottom: 20 },
  labelText: {
    marginBottom: 8,
  },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelSvgWrap: { marginBottom: 8 },

  // Botões para alternar Formulário/Tabela
  toggleStack: {
    width: '100%',
    maxWidth: 720,
    alignItems: 'stretch',
    padding: 8,
    borderRadius: PREMIUM.radiusLg,
    borderWidth: 1,
    marginBottom: 20,
  },
  tableToggleStack: {
    width: '100%',
    maxWidth: 720,
    alignItems: 'stretch',
    padding: 8,
    borderRadius: PREMIUM.radiusLg,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 20,
  },
  toggleBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnText: {
    fontWeight: '700',
  },

  segmented: {
    flexDirection: 'row',
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    overflow: 'hidden',
    borderColor: 'transparent',
  },
  segmentBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  segmentText: {
    fontWeight: '700',
  },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  input: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '500',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  btnRow: { marginTop: 8 },
  btn: {
    marginTop: 6,
    width: '100%',
    paddingVertical: 14,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontWeight: '700',
  },

  warnText: { marginTop: 8, textAlign: 'center' },

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
    borderRadius: PREMIUM.radiusLg,
    padding: 20,
    borderWidth: 1,
    ...Platform.select({
      web: { boxShadow: '0 8px 32px rgba(0,0,0,0.12)' } as object,
      default: { elevation: 8 },
    }),
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: {},
  modalTitleSuccess: {
    textAlign: 'center',
    marginBottom: 12,
  },
  modalSubtitle: { marginBottom: 20, textAlign: 'center' },
  modalCloseBtn: {
    padding: 8,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
  },
  modalBtns: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: PREMIUM.radiusMd, borderWidth: 1, alignItems: 'center' },

  // Tabelas e feedback
  tabelaScrollHorizontal: {
    marginBottom: 8,
  },
  tabelaCard: {
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tabelaHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  tabelaHeaderCell: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabelaHeaderVolta: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0,
  },
  tabelaDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    minHeight: 48,
  },
  tabelaCell: {
    justifyContent: 'center',
  },
  tabelaCellText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tabelaColCorredor: {
    width: 60,
    paddingRight: 6,
  },
  tabelaColNome: {
    width: 160,
    maxWidth: 200,
    minWidth: 100,
    flexGrow: 0,
    flexShrink: 0,
    paddingRight: 4,
  },
  tabelaColMarcarChegada: {
    width: 100,
    minWidth: 100,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  tabelaColVolta: {
    width: 44,
    minWidth: 44,
    textAlign: 'center',
    paddingHorizontal: 0,
  },
  tabelaColTempo: {
    width: 72,
    minWidth: 72,
    textAlign: 'center',
  },
  tabelaColNota: {
    width: 64,
    minWidth: 64,
    textAlign: 'center',
  },
  tabelaNotaText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabelaNotaRepro: {
    fontSize: 9,
  },
  tabelaCelulaTempo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabelaCelulaCheck: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkVoltaOuter: {
    padding: 2,
  },
  checkVoltaBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  tabelaNumeroVerde: {
    fontSize: 22,
    fontWeight: '800',
  },
});
