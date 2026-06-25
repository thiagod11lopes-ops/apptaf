import React, { useCallback, useEffect, useState } from 'react';
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
import { useAuthDataReload } from '../hooks/useAuthDataReload';
import { X, Pencil, Trash2 } from 'lucide-react-native';
import { Card } from '../components/Card';
import { AppHeader } from '../components/sismav/AppHeader';
import { LabelNip } from '../components/LabelNip';
import { LabelSO } from '../components/LabelSO';
import { LabelSvgText } from '../components/LabelSvgText';
import {
  addAplicador,
  deleteAplicador,
  getAllAplicadores,
  type AplicadorItemPersist,
} from '../services/aplicadoresIndexedDb';
import { PREMIUM } from '../theme/premium';
import { fontFamily } from '../theme/typography';

type Categoria = 'Oficiais' | 'Praças';

function formatNipInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const a = digits.slice(0, 2);
  const b = digits.slice(2, 6);
  const c = digits.slice(6, 8);

  if (digits.length <= 2) return a;
  if (digits.length <= 6) return `${a}.${digits.slice(2)}`;
  return `${a}.${b}.${c}`;
}

function postoGradLabel(item: AplicadorItemPersist): string {
  if (item.categoria === 'Oficiais') return item.oficial || '-';
  return item.praca || '-';
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return <Text style={[theme.textStyles.label, styles.labelText]}>{children}</Text>;
}

export default function CadastroAplicadorScreen() {
  const { theme, fontsLoaded } = useTheme();
  const navigation = useNavigation();
  const ts = theme.textStyles;
  const regularFont = fontFamily('regular', fontsLoaded);

  const [categoria, setCategoria] = useState<Categoria | ''>('');
  const [oficialSelecionado, setOficialSelecionado] = useState('');
  const [pracaSelecionada, setPracaSelecionada] = useState('');
  const [nip, setNip] = useState('');
  const [nome, setNome] = useState('');
  const [sexo, setSexo] = useState<'M' | 'F'>('M');
  const [aplicadores, setAplicadores] = useState<AplicadorItemPersist[]>([]);
  const [faltantes, setFaltantes] = useState<string[]>([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarTabela, setMostrarTabela] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [modalNipDuplicado, setModalNipDuplicado] = useState(false);
  const [modalCadastroSucesso, setModalCadastroSucesso] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setMostrarFormulario(false);
      setMostrarTabela(false);
    }, []),
  );

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
    if (categoria === 'Oficiais' && !oficialSelecionado.trim()) faltantesAgora.push('Oficial');
    if (categoria === 'Praças' && !pracaSelecionada.trim()) faltantesAgora.push('Graduação');

    setFaltantes(faltantesAgora);
    if (faltantesAgora.length > 0) return;

    const nipFinal = formatNipInput(nip).trim();
    const nipDigits = nipFinal.replace(/\D/g, '');
    if (nipDigits.length > 0) {
      const jaExiste = aplicadores.some((a) => {
        const outrosDigitos = (a.nip || '').replace(/\D/g, '');
        if (outrosDigitos !== nipDigits) return false;
        if (editandoId && a.id === editandoId) return false;
        return true;
      });
      if (jaExiste) {
        setModalNipDuplicado(true);
        return;
      }
    }

    const isEdicao = !!editandoId;
    const id = editandoId ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const novo: AplicadorItemPersist = {
      id,
      nip: nipFinal,
      nome: nome.trim(),
      sexo,
      categoria,
      oficial: categoria === 'Oficiais' ? oficialSelecionado : undefined,
      praca: categoria === 'Praças' ? pracaSelecionada : undefined,
      updatedAt: Date.now(),
    };

    setAplicadores((prev) => {
      if (editandoId) return prev.map((a) => (a.id === id ? novo : a));
      return [...prev, novo];
    });
    addAplicador(novo).catch(() => undefined);

    setEditandoId(null);

    if (!isEdicao) {
      setModalCadastroSucesso(true);
      setNip('');
      setNome('');
      setSexo('M');
      setOficialSelecionado('');
      setPracaSelecionada('');
      setCategoria('');
      setFaltantes([]);
    }
  }

  function handleEditar(item: AplicadorItemPersist) {
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
    setSexo(item.sexo === 'F' ? 'F' : 'M');
  }

  async function handleConfirmarExcluir() {
    if (!excluirId) return;
    const id = excluirId;
    setExcluirId(null);
    setAplicadores((prev) => prev.filter((a) => a.id !== id));
    await deleteAplicador(id);
    if (editandoId === id) setEditandoId(null);
  }

  const recarregarAplicadores = useCallback(() => {
    getAllAplicadores()
      .then(setAplicadores)
      .catch(() => undefined);
  }, []);

  useAuthDataReload(recarregarAplicadores);

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
          <AppHeader
            title="Aplicador de TAF"
            subtitle="Cadastro de aplicador de teste físico"
            onBack={() => navigation.navigate('Home' as never)}
          />

          <View style={[styles.toggleStack, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <TouchableOpacity
              accessibilityLabel="Mostrar formulário de aplicador"
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
                  mostrarFormulario ? { color: selectedTextColor } : { color: unselectedTextColor },
                  styles.toggleBtnText,
                ]}
                numberOfLines={1}
              >
                Cadastrar Aplicador
              </Text>
            </TouchableOpacity>
          </View>

          {mostrarFormulario ? (
            <Card elevated style={styles.formCard}>
              <View style={styles.section}>
                <FieldLabel>Categoria</FieldLabel>
                <View style={[styles.segmented, { borderColor: theme.border }]}>
                  {(['Oficiais', 'Praças'] as const).map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setCategoriaWithReset(cat)}
                      style={[
                        styles.segmentBtn,
                        categoria === cat
                          ? { backgroundColor: selectedBgColor }
                          : { backgroundColor: unselectedBgColor },
                      ]}
                    >
                      <Text
                        style={[
                          ts.caption,
                          categoria === cat ? { color: selectedTextColor } : { color: unselectedTextColor },
                          styles.segmentText,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
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
                            active
                              ? { backgroundColor: selectedBgColor }
                              : { backgroundColor: unselectedBgColor, borderColor: theme.borderSubtle },
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
                            active
                              ? { backgroundColor: selectedBgColor }
                              : { backgroundColor: unselectedBgColor, borderColor: theme.borderSubtle },
                          ]}
                        >
                          {opt === 'SO' ? (
                            <LabelSO
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

              <View style={styles.section}>
                <View style={styles.labelSvgWrap}>
                  <LabelNip color={unselectedTextColor} />
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
                  keyboardType="numeric"
                  maxLength={10}
                  inputMode="numeric"
                />
              </View>

              <View style={styles.section}>
                <FieldLabel>Nome</FieldLabel>
                <TextInput
                  value={nome}
                  onChangeText={setNome}
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
                  autoCapitalize="words"
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
                  accessibilityLabel="cadastrar aplicador"
                  onPress={handleCadastrar}
                  style={[styles.btn, { backgroundColor: theme.primary }]}
                >
                  <Text style={[ts.body, styles.btnText]}>
                    {editandoId ? 'Salvar alterações' : 'Cadastrar'}
                  </Text>
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
              accessibilityLabel="Mostrar tabela de aplicadores"
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
                  mostrarTabela ? { color: selectedTextColor } : { color: unselectedTextColor },
                  styles.toggleBtnText,
                ]}
                numberOfLines={1}
              >
                Planilha de Aplicadores
              </Text>
            </TouchableOpacity>
          </View>

          {mostrarTabela ? (
            <Card elevated style={styles.formCard}>
              <Text style={[ts.h3, { color: theme.text, marginBottom: 12 }]}>Aplicadores cadastrados</Text>
              {aplicadores.length === 0 ? (
                <Text style={[ts.bodySecondary, { color: theme.textSecondary, textAlign: 'center' }]}>
                  Nenhum aplicador cadastrado ainda.
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View style={[styles.tabelaCard, { borderColor: theme.border }]}>
                    <View style={[styles.tabelaHeaderRow, { borderBottomColor: theme.border, backgroundColor: theme.backgroundSecondary }]}>
                      {['Posto/Grad.', 'NIP', 'Nome', 'Categoria', 'Gênero', 'Ações'].map((col) => (
                        <Text
                          key={col}
                          style={[styles.tabelaHeaderCell, { color: theme.textSecondary, width: col === 'Ações' ? 80 : col === 'Nome' ? 160 : 90 }]}
                        >
                          {col}
                        </Text>
                      ))}
                    </View>
                    {[...aplicadores]
                      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
                      .map((item) => (
                        <View
                          key={item.id}
                          style={[styles.tabelaDataRow, { borderBottomColor: theme.borderSubtle }]}
                        >
                          <Text style={[styles.tabelaCellText, { color: theme.text, width: 90 }]}>
                            {postoGradLabel(item)}
                          </Text>
                          <Text style={[styles.tabelaCellText, { color: theme.text, width: 90 }]}>
                            {item.nip || '-'}
                          </Text>
                          <Text style={[styles.tabelaCellText, { color: theme.text, width: 160 }]} numberOfLines={2}>
                            {item.nome}
                          </Text>
                          <Text style={[styles.tabelaCellText, { color: theme.text, width: 90 }]}>
                            {item.categoria}
                          </Text>
                          <Text style={[styles.tabelaCellText, { color: theme.text, width: 90 }]}>
                            {item.sexo === 'F' ? 'Feminino' : 'Masculino'}
                          </Text>
                          <View style={[styles.acoesRow, { width: 80 }]}>
                            <TouchableOpacity
                              accessibilityLabel="Editar aplicador"
                              onPress={() => handleEditar(item)}
                              style={styles.acaoBtn}
                            >
                              <Pencil size={16} color={theme.primary} strokeWidth={2} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              accessibilityLabel="Excluir aplicador"
                              onPress={() => setExcluirId(item.id)}
                              style={styles.acaoBtn}
                            >
                              <Trash2 size={16} color={dangerColor} strokeWidth={2} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                  </View>
                </ScrollView>
              )}
            </Card>
          ) : null}
        </View>
      </ScrollView>

      {excluirId ? (
        <View style={[styles.modalOverlay, { backgroundColor: theme.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.45)' }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[ts.h2, { color: theme.text }]}>Excluir aplicador?</Text>
              <TouchableOpacity
                accessibilityLabel="Fechar modal"
                onPress={() => setExcluirId(null)}
                style={[styles.modalCloseBtn, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
              >
                <X size={18} color={theme.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <Text style={[ts.bodySecondary, styles.modalSubtitle, { color: theme.textSecondary }]}>
              Tem certeza que deseja excluir este aplicador?
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                onPress={() => setExcluirId(null)}
                style={[styles.modalBtn, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
              >
                <Text style={[ts.caption, { color: theme.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
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
              Aplicador cadastrado com sucesso
            </Text>
          </View>
        </View>
      ) : null}

      {modalNipDuplicado ? (
        <View style={[styles.modalOverlay, { backgroundColor: theme.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.45)' }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[ts.h2, { color: theme.text }]}>NIP já cadastrado</Text>
              <TouchableOpacity
                onPress={() => setModalNipDuplicado(false)}
                style={[styles.modalCloseBtn, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
              >
                <X size={18} color={theme.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <Text style={[ts.bodySecondary, styles.modalSubtitle, { color: theme.textSecondary }]}>
              O NIP informado já está cadastrado como aplicador.
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
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
  centerWrap: { flex: 1, alignItems: 'stretch' },
  formCard: { width: '100%', maxWidth: 720, marginBottom: 20 },
  section: { marginBottom: 20 },
  labelText: { marginBottom: 8 },
  labelSvgWrap: { marginBottom: 8 },
  toggleStack: {
    width: '100%',
    maxWidth: 720,
    padding: 8,
    borderRadius: PREMIUM.radiusLg,
    borderWidth: 1,
    marginBottom: 20,
  },
  tableToggleStack: {
    width: '100%',
    maxWidth: '100%',
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
  toggleBtnText: { fontWeight: '700' },
  segmented: {
    flexDirection: 'row',
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    overflow: 'hidden',
  },
  segmentBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontWeight: '700' },
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
  btnText: { fontWeight: '700' },
  warnText: { marginTop: 8, textAlign: 'center' },
  tabelaCard: { borderRadius: PREMIUM.radiusMd, borderWidth: 1, overflow: 'hidden', minWidth: 670 },
  tabelaHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 8,
  },
  tabelaHeaderCell: { fontSize: 12, fontWeight: '700' },
  tabelaDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabelaCellText: { fontSize: 13, fontWeight: '500' },
  acoesRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  acaoBtn: { padding: 4 },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalSubtitle: { marginBottom: 20, textAlign: 'center' },
  modalCloseBtn: { padding: 8, borderRadius: PREMIUM.radiusMd, borderWidth: 1 },
  modalBtns: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalTitleSuccess: { textAlign: 'center', marginBottom: 12 },
});
