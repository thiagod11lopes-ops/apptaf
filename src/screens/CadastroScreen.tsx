import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
  Image,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Pencil, Trash2 } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { PostoSelect } from '../components/PostoSelect';
import { GraduacaoSelect } from '../components/GraduacaoSelect';
import { LabelNip } from '../components/LabelNip';
import { LabelGradSO } from '../components/LabelGradSO';
import { RotuloPracaSvg } from '../components/RotuloPracaSvg';
import { ChecklistOficialPraca } from '../components/ChecklistOficialPraca';
import { normalizePraça, normalizeSO, normalizeNIP, isCategoriaPraça, isGraduacaoSO } from '../utils/displayNormalize';
import { ModalExcluirCadastro } from './ModalExcluirCadastro';
import { getCadastros, addCadastro, updateCadastro, deleteCadastro } from '../services/cadastroStorage';
import type { CadastroItem, CategoriaCadastro } from '../types/cadastro';
import type { Posto } from '../constants/postos';
import type { Graduacao } from '../constants/graduacoes';

type FormPostoGrad = Posto | Graduacao | '';
const initialForm: {
  categoria: CategoriaCadastro;
  postoOuGraduacao: FormPostoGrad;
  nip: string;
  nome: string;
  data: string;
} = {
  categoria: 'Oficial',
  postoOuGraduacao: '',
  nip: '',
  nome: '',
  data: '',
};

export default function CadastroScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const scrollRef = useRef<ScrollView>(null);
  const { width, height } = useWindowDimensions();
  /** Id do cadastro a excluir (fixado no clique para não depender do state no confirmar). */
  const excluirIdRef = useRef<string | null>(null);

  const [formularioVisivel, setFormularioVisivel] = useState(false);
  const [listaCadastros, setListaCadastros] = useState<CadastroItem[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaCadastro | 'Todos' | null>('Todos');
  const [filtroPosto, setFiltroPosto] = useState<Posto | ''>('');
  const [filtroGraduacao, setFiltroGraduacao] = useState<Graduacao | ''>('');

  const [excluirModalRow, setExcluirModalRow] = useState<CadastroItem | null>(null);

  const carregarLista = useCallback(async () => {
    const data = await getCadastros();
    setListaCadastros(data.sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  useEffect(() => {
    carregarLista();
  }, [carregarLista]);

  const filtrada = listaCadastros.filter((c) => {
    if (filtroCategoria && filtroCategoria !== 'Todos' && c.categoria !== filtroCategoria) return false;
    if (filtroPosto && c.categoria === 'Oficial' && c.postoOuGraduacao !== filtroPosto) return false;
    if (filtroGraduacao && c.categoria === 'Praça' && c.postoOuGraduacao !== filtroGraduacao) return false;
    return true;
  });

  const setFormField = useCallback(<K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const handleSalvar = useCallback(async () => {
    if (!String(form.postoOuGraduacao).trim()) {
      if (Platform.OS === 'web') alert('Selecione Posto ou Graduação.');
      else Alert.alert('Atenção', 'Selecione Posto ou Graduação.');
      return;
    }
    if (!form.nome.trim()) {
      if (Platform.OS === 'web') alert('Informe o nome.');
      else Alert.alert('Atenção', 'Informe o nome.');
      return;
    }
    try {
      if (editingId) {
        await updateCadastro(editingId, {
          categoria: (normalizePraça(form.categoria) === 'Praça' ? 'Praça' : 'Oficial') as CategoriaCadastro,
          postoOuGraduacao: (form.categoria === 'Praça' ? normalizeSO(String(form.postoOuGraduacao)) : form.postoOuGraduacao) as Posto | Graduacao,
          nip: normalizeNIP(form.nip).trim() || form.nip.trim(),
          nome: form.nome.trim(),
          data: form.data.trim(),
        });
        setEditingId(null);
      } else {
        await addCadastro({
          categoria: (normalizePraça(form.categoria) === 'Praça' ? 'Praça' : 'Oficial') as CategoriaCadastro,
          postoOuGraduacao: (form.categoria === 'Praça' ? normalizeSO(String(form.postoOuGraduacao)) : form.postoOuGraduacao) as Posto | Graduacao,
          nip: normalizeNIP(form.nip).trim() || form.nip.trim(),
          nome: form.nome.trim(),
          data: form.data.trim(),
        });
      }
      setForm(initialForm);
      await carregarLista();
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch {
      if (Platform.OS === 'web') alert('Erro ao salvar.');
      else Alert.alert('Erro', 'Não foi possível salvar.');
    }
  }, [form, editingId, carregarLista]);

  const handleEditar = useCallback((row: CadastroItem) => {
    setForm({
      categoria: row.categoria,
      postoOuGraduacao: row.postoOuGraduacao,
      nip: row.nip,
      nome: row.nome,
      data: row.data,
    });
    setEditingId(row.id);
    setFormularioVisivel(true);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }, 100);
  }, []);

  const handleExcluir = useCallback((row: CadastroItem) => {
    excluirIdRef.current = row.id;
    setExcluirModalRow(row);
  }, []);

  const confirmarExcluir = useCallback(async () => {
    const idToExcluir = excluirIdRef.current;
    setExcluirModalRow(null);
    excluirIdRef.current = null;
    if (!idToExcluir) return;
    try {
      await deleteCadastro(idToExcluir);
      setListaCadastros((prev) => prev.filter((c) => c.id !== idToExcluir));
    } catch {
      if (Platform.OS === 'web') alert('Erro ao excluir.');
      else Alert.alert('Erro', 'Não foi possível excluir o cadastro.');
    }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[theme.gradient[0], theme.gradient[1]]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Image
        source={require('../../Fundo.png')}
        style={[styles.fundo, { width, height }]}
        resizeMode="cover"
      />
      <Header title="Cadastro" onBack={() => navigation.goBack()} />
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content}>
        {!formularioVisivel ? (
          <Card glass>
            <Text style={[styles.introTitle, { color: '#FFFFFF' }]}>Cadastro</Text>
            <Text style={[styles.introText, { color: 'rgba(255,255,255,0.92)' }]}>
              Toque em Iniciar cadastro para preencher os dados.
            </Text>
            <Button
              title="Iniciar cadastro"
              onPress={() => setFormularioVisivel(true)}
              style={styles.btn}
              glass
            />
          </Card>
        ) : (
          <Card glass>
            <Button
              title="Ocultar cadastro"
              variant="outline"
              onPress={() => {
                setFormularioVisivel(false);
                setEditingId(null);
                setForm(initialForm);
              }}
              style={styles.btnOcultar}
              glass
            />
            <Text style={[styles.label, { color: '#FFFFFF' }]}>Posto / Graduação</Text>
            <ChecklistOficialPraca
              value={form.categoria}
              onValueChange={(v) => v !== 'Todos' && setFormField('categoria', v)}
              glass
            />
            <View style={styles.field}>
              {form.categoria === 'Oficial' ? (
                <>
                  <Text style={[styles.label, { color: '#FFFFFF' }]}>Posto</Text>
                  <PostoSelect
                    value={(form.categoria === 'Oficial' ? form.postoOuGraduacao : '') as Posto | ''}
                    onValueChange={(v) => setFormField('postoOuGraduacao', v)}
                  />
                </>
              ) : (
                <>
                  <Text style={[styles.label, { color: '#FFFFFF' }]}>Graduação</Text>
                  <GraduacaoSelect
                    value={(form.categoria === 'Praça' ? form.postoOuGraduacao : '') as Graduacao | ''}
                    onValueChange={(v) => setFormField('postoOuGraduacao', v)}
                  />
                </>
              )}
            </View>
            <View style={styles.field}>
              <LabelNip />
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                value={form.nip}
                onChangeText={(t) => setFormField('nip', t)}
                placeholder=""
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                autoComplete="off"
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: '#FFFFFF' }]}>Nome</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                value={form.nome}
                onChangeText={(t) => setFormField('nome', t)}
                placeholder="Nome completo"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: '#FFFFFF' }]}>Data</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                value={form.data}
                onChangeText={(t) => setFormField('data', t)}
                placeholder="01/01/0001"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
            <Button
              title={editingId ? 'Atualizar cadastro' : 'Salvar cadastro'}
              onPress={handleSalvar}
              style={styles.btnSalvar}
              glass
            />
          </Card>
        )}

        {/* Filtros da planilha */}
        <View style={styles.filtrosWrap}>
          <Text style={[styles.planilhaTitle, { color: theme.text }]}>Lista de cadastros</Text>
          <View style={styles.filtros}>
            <ChecklistOficialPraca
              filterMode
              value={filtroCategoria}
              onValueChange={(v) => setFiltroCategoria(v)}
            />
            {filtroCategoria === 'Oficial' && (
              <View style={styles.filtroSelect}>
                <Text style={[styles.labelSmall, { color: theme.textSecondary }]}>Posto</Text>
                <PostoSelect filterMode value={filtroPosto} onValueChange={setFiltroPosto} />
              </View>
            )}
            {filtroCategoria === 'Praça' && (
              <View style={styles.filtroSelect}>
                <Text style={[styles.labelSmall, { color: theme.textSecondary }]}>Graduação</Text>
                <GraduacaoSelect filterMode value={filtroGraduacao} onValueChange={setFiltroGraduacao} />
              </View>
            )}
          </View>
        </View>

        {/* Planilha */}
        <View style={[styles.tableWrap, { borderColor: theme.border }]}>
          <View style={[styles.tableRow, styles.headerRow, { borderBottomColor: theme.border }]}>
            <Text style={[styles.th, styles.tdCat, { color: theme.text }]}>Categoria</Text>
            <Text style={[styles.th, styles.tdPg, { color: theme.text }]}>Posto/Grad</Text>
            <View style={styles.tdNip}>
              <LabelNip />
            </View>
            <Text style={[styles.th, styles.tdNome, { color: theme.text }]}>Nome</Text>
            <Text style={[styles.th, styles.tdData, { color: theme.text }]}>Data</Text>
            <View style={[styles.tdAcoes, { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]} />
          </View>
          {filtrada.length === 0 ? (
            <View style={[styles.tableRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.emptyCell, { color: theme.textSecondary }]} numberOfLines={1}>
                Nenhum cadastro encontrado.
              </Text>
            </View>
          ) : (
            filtrada.map((row) => (
              <View
                key={row.id}
                style={[styles.tableRow, { borderBottomColor: theme.border }]}
              >
                <View style={styles.tdCat}>
                  {isCategoriaPraça(row.categoria) ? (
                    <RotuloPracaSvg />
                  ) : (
                    <Text style={[styles.td, { color: theme.text }]}>{normalizePraça(row.categoria)}</Text>
                  )}
                </View>
                <View style={[styles.td, styles.tdPg]}>
                  {isGraduacaoSO(String(row.postoOuGraduacao)) ? (
                    <LabelGradSO />
                  ) : (
                    <Text style={{ color: theme.text }} numberOfLines={1}>{normalizeSO(String(row.postoOuGraduacao))}</Text>
                  )}
                </View>
                <View style={[styles.td, styles.tdNip]}>
                  {normalizeNIP(row.nip) === 'NIP' ? (
                    <LabelNip />
                  ) : (
                    <Text style={{ color: theme.text }} numberOfLines={1} ellipsizeMode="tail">
                      {normalizeNIP(row.nip)}
                    </Text>
                  )}
                </View>
                <Text style={[styles.td, styles.tdNome, { color: theme.text }]} numberOfLines={1}>
                  {row.nome}
                </Text>
                <Text style={[styles.td, styles.tdData, { color: theme.text }]} numberOfLines={1}>
                  {row.data}
                </Text>
                <View style={[styles.tdAcoes, { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
                  <TouchableOpacity
                    style={[styles.btnAcaoIcon, { borderColor: theme.border }]}
                    onPress={() => handleEditar(row)}
                  >
                    <Pencil size={18} color={theme.primary} strokeWidth={2} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnAcaoIcon, { borderColor: theme.border }]}
                    onPress={() => handleExcluir(row)}
                  >
                    <Trash2 size={18} color={theme.error} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <ModalExcluirCadastro
        visible={excluirModalRow !== null}
        nomeCadastro={excluirModalRow?.nome ?? ''}
        onConfirmar={confirmarExcluir}
        onCancelar={() => setExcluirModalRow(null)}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
    ...(Platform.OS === 'web' && { minHeight: '100vh' }),
  },
  scroll: { flex: 1 },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  fundo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: { padding: 20, paddingBottom: 40 },
  introTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  introText: { fontSize: 15, lineHeight: 22, marginBottom: 24 },
  btn: { marginTop: 4 },
  btnOcultar: { marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  labelSmall: { fontSize: 12, marginBottom: 4 },
  field: { marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  btnSalvar: { marginTop: 8 },
  filtrosWrap: { marginTop: 24, marginBottom: 12 },
  planilhaTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' },
  filtroSelect: { minWidth: 120 },
  tableWrap: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  headerRow: { backgroundColor: 'rgba(0,0,0,0.04)' },
  th: { fontSize: 13, fontWeight: '700' },
  td: { fontSize: 14 },
  tdCat: { width: 72 },
  tdPg: { width: 72 },
  tdNip: { width: 64 },
  tdNome: { flex: 1, minWidth: 80 },
  tdData: { width: 88 },
  tdAcoes: {
    width: 100,
    paddingVertical: 8,
    paddingHorizontal: 6,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnAcaoIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  emptyCell: { flex: 1, paddingVertical: 16, fontSize: 14 },
});
