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
import { ChevronLeft } from 'lucide-react-native';
import { Card } from '../components/Card';
import { LabelNip } from '../components/LabelNip';
import { LabelSO } from '../components/LabelSO';
import { LabelSvgText } from '../components/LabelSvgText';
import { addCadastro, getAllCadastros } from '../services/cadastrosIndexedDb';

type Categoria = 'Oficiais' | 'Praças';

type CadastroItem = {
  id: string;
  nip: string;
  nome: string;
  dataNascimento: string;
  categoria: Categoria;
  oficial?: string;
  praca?: string;
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
  const [cadastros, setCadastros] = useState<CadastroItem[]>([]);
  const [faltantes, setFaltantes] = useState<string[]>([]);

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

    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const novoCadastro: CadastroItem = {
      id,
      // Reaplica a máscara/filtragem numérica para evitar que o corretor
      // injete texto (ex.: "Beliscar") no valor salvo.
      nip: formatNipInput(nip).trim(),
      nome: nome.trim(),
      dataNascimento: dataNascimento.trim(),
      categoria,
      // Se ainda não selecionou o oficial, mantém vazio (mostra '-' na tabela).
      oficial: categoria === 'Oficiais' ? oficialSelecionado : undefined,
      praca: categoria === 'Praças' ? pracaSelecionada : undefined,
    };

    setCadastros((prev) => [...prev, novoCadastro]);
    // Persistência: não trava a UX se IndexedDB falhar.
    addCadastro(novoCadastro).catch(() => undefined);
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
                        <Text style={active ? styles.segmentTextSelected : styles.segmentText}>{opt}</Text>
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
                          <LabelSO
                            color={active ? '#FFFFFF' : '#111827'}
                            fontSize={13}
                            fontWeight={800}
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
              <Text style={styles.warnText}>
                Atenção: faltam {faltantes.join(', ')}.
              </Text>
            ) : null}
          </Card>

          <View style={{ height: 16 }} />

          <Card glass={cardGlassEnabled} style={styles.tableCard}>
            <Text style={styles.tableTitle}>Cadastros</Text>

            {cadastros.length === 0 ? (
              <Text style={styles.tableEmpty}>Nenhum cadastro ainda.</Text>
            ) : (
              <View>
                <View style={styles.tableHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <LabelSvgText text="Categoria" color="#111827" fontSize={12} fontWeight={800} width={110} height={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <LabelSvgText
                      text="Posto/ Gradução"
                      color="#111827"
                      fontSize={12}
                      fontWeight={800}
                      width={160}
                      height={18}
                    />
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 4 }}>
                    <LabelNip color="#111827" fontSize={12} fontWeight={800} />
                  </View>
                  <View style={{ flex: 2 }}>
                    <LabelSvgText text="Nome" color="#111827" fontSize={12} fontWeight={800} width={90} height={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <LabelSvgText
                      text="Data de Nascimento"
                      color="#111827"
                      fontSize={12}
                      fontWeight={800}
                      width={170}
                      height={18}
                    />
                  </View>
                </View>

                {cadastros.map((c) => (
                  <View key={c.id} style={styles.tableRow}>
                    <View style={{ flex: 1, alignItems: 'flex-start' }}>
                      <Text style={styles.tableCell} numberOfLines={1}>
                        {c.categoria}
                      </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-start' }}>
                      {c.categoria === 'Oficiais' ? (
                        <Text style={styles.tableCell} numberOfLines={1}>
                          {c.oficial || '-'}
                        </Text>
                      ) : c.praca === 'SO' ? (
                        <LabelSO color="#111827" fontSize={12} fontWeight={900} />
                      ) : (
                        <Text style={styles.tableCell} numberOfLines={1}>
                          {c.praca || '-'}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.tableCell, { flex: 1 }]} numberOfLines={1}>
                      {c.nip ? c.nip : '-'}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>
                      {c.nome ? c.nome : '-'}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1 }]} numberOfLines={1}>
                      {c.dataNascimento ? c.dataNascimento : '-'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
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

  tableCard: {
    width: '100%',
    maxWidth: 720,
    padding: 14,
    borderRadius: 20,
  },
  tableTitle: { fontSize: 14, fontWeight: '800', color: '#111827', marginBottom: 10 },
  tableEmpty: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17,24,39,0.15)',
    paddingBottom: 10,
    marginBottom: 6,
  },
  tableHeaderCell: { fontSize: 12, fontWeight: '800', color: '#111827', paddingHorizontal: 4 },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17,24,39,0.08)',
  },
  tableCell: { fontSize: 12, fontWeight: '700', color: '#111827', paddingHorizontal: 4 },

  warnText: { marginTop: 8, fontSize: 12, fontWeight: '700', color: '#9CA3AF' },
});

