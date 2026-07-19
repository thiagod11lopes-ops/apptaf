import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuthDataReload } from '../hooks/useAuthDataReload';
import { useAuth } from '../contexts/AuthContext';
import { X } from 'lucide-react-native';
import { Card } from '../components/Card';
import { LabelNip } from '../components/LabelNip';
import { LabelSO } from '../components/LabelSO';
import { LabelSvgText } from '../components/LabelSvgText';
import {
  getAllAplicadores,
  salvarRubricaAplicadorSeVazia,
  type AplicadorItemPersist,
} from '../services/aplicadoresIndexedDb';
import { getAllSessoesAplicacao } from '../services/resultadosAplicadosIndexedDb';
import { aplicadorRepository } from '../offline-first/repositories/AplicadorRepository';
import { hashAplicadorSenha, formatSenhaAplicadorInput, isSenhaAplicadorValid } from '../utils/aplicadorSenha';
import { assinaturasUnicasDasSessoes } from '../utils/assinaturaAplicadorDasSessoes';
import { PREMIUM } from '../theme/premium';
import { fontFamily } from '../theme/typography';
import { AplicadoresCadastradosTable } from '../components/AplicadoresCadastradosTable';
import { MobileScreenScaffold } from '../components/mobile/MobileScreenScaffold';
import { TafCenteredTabHeader, TafGlassPanel } from '../components/mobile/TafTabChrome';
import { TopActionIcons } from '../components/premium/TopActionIcons';

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

function FieldLabel({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return <Text style={[theme.textStyles.label, styles.labelText]}>{children}</Text>;
}

export default function CadastroAplicadorScreen() {
  const { theme, fontsLoaded } = useTheme();
  const { isBoss } = useAuth();
  const ts = theme.textStyles;
  const regularFont = fontFamily('regular', fontsLoaded);

  const [categoria, setCategoria] = useState<Categoria | ''>('');
  const [oficialSelecionado, setOficialSelecionado] = useState('');
  const [pracaSelecionada, setPracaSelecionada] = useState('');
  const [nip, setNip] = useState('');
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [aplicadores, setAplicadores] = useState<AplicadorItemPersist[]>([]);
  const [faltantes, setFaltantes] = useState<string[]>([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarTabela, setMostrarTabela] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [modalNipDuplicado, setModalNipDuplicado] = useState(false);
  const [modalCadastroSucesso, setModalCadastroSucesso] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroNuvem, setErroNuvem] = useState<string | null>(null);

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

  async function handleCadastrar() {
    if (!categoria) return;

    const faltantesAgora: string[] = [];
    if (!nip.trim()) faltantesAgora.push('NIP');
    if (!nome.trim()) faltantesAgora.push('Nome');
    if (!editandoId && !senha.trim()) faltantesAgora.push('Senha');
    if (!editandoId && senha.trim() && !isSenhaAplicadorValid(senha)) {
      faltantesAgora.push('Senha (4 números)');
    }
    if (editandoId && senha.trim() && !isSenhaAplicadorValid(senha)) {
      faltantesAgora.push('Senha (4 números)');
    }
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
    const anterior = editandoId ? aplicadores.find((a) => a.id === editandoId) : undefined;
    let senhaHash = anterior?.senhaHash;
    let senhaPlano = anterior?.senha;
    if (senha.trim()) {
      senhaHash = await hashAplicadorSenha(senha);
      senhaPlano = formatSenhaAplicadorInput(senha);
    }

    const novo: AplicadorItemPersist = {
      id,
      nip: nipFinal,
      nome: nome.trim(),
      categoria,
      oficial: categoria === 'Oficiais' ? oficialSelecionado : undefined,
      praca: categoria === 'Praças' ? pracaSelecionada : undefined,
      senha: senhaPlano,
      senhaHash,
      rubricaSvg: anterior?.rubricaSvg,
      updatedAt: Date.now(),
    };

    setSalvando(true);
    setErroNuvem(null);
    try {
      await aplicadorRepository.save(novo);
      if (senha.trim() && senhaHash && senhaPlano) {
        try {
          const [{ setAplicadorSenhaFirestore }, { resolveStorageOwnerUid }] = await Promise.all([
            import('../services/firebase/aplicadorSenhasFirestore'),
            import('../services/firebase/authUid'),
          ]);
          const ownerUid = await resolveStorageOwnerUid();
          await setAplicadorSenhaFirestore(ownerUid, id, senhaPlano, senhaHash);
        } catch {
          // Senha em texto é complementar; a senhaHash já sincroniza normalmente.
        }
      }
      setAplicadores((prev) => {
        if (editandoId) return prev.map((a) => (a.id === id ? novo : a));
        return [...prev, novo];
      });

      setEditandoId(null);
      setSenha('');

      if (!isEdicao) {
        setModalCadastroSucesso(true);
        setNip('');
        setNome('');
        setOficialSelecionado('');
        setPracaSelecionada('');
        setCategoria('');
        setFaltantes([]);
      }
    } catch (err) {
      setErroNuvem(err instanceof Error ? err.message : 'Falha ao salvar aplicador.');
    } finally {
      setSalvando(false);
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
    setSenha(item.senha || '');
  }

  async function handleConfirmarExcluir() {
    if (!excluirId) return;

    const id = excluirId;
    setExcluirId(null);
    setSalvando(true);
    setErroNuvem(null);
    try {
      await aplicadorRepository.remove(id);
      try {
        const [{ deleteAplicadorSenhaFirestore }, { resolveStorageOwnerUid }] = await Promise.all([
          import('../services/firebase/aplicadorSenhasFirestore'),
          import('../services/firebase/authUid'),
        ]);
        const ownerUid = await resolveStorageOwnerUid();
        await deleteAplicadorSenhaFirestore(ownerUid, id);
      } catch {
        // Limpeza da senha em texto é complementar.
      }
      setAplicadores((prev) => prev.filter((a) => a.id !== id));
      if (editandoId === id) setEditandoId(null);
    } catch (err) {
      recarregarAplicadores();
      setErroNuvem(err instanceof Error ? err.message : 'Falha ao excluir aplicador.');
    } finally {
      setSalvando(false);
    }
  }

  const recarregarAplicadores = useCallback(() => {
    getAllAplicadores()
      .then(async (lista) => {
        // Recupera rúbricas já usadas em sessões e grava no card do aplicador.
        let comRubrica = lista;
        try {
          const semRubrica = lista.filter((a) => !a.rubricaSvg?.trim());
          if (semRubrica.length > 0) {
            const assinaturas = assinaturasUnicasDasSessoes(await getAllSessoesAplicacao());
            const porId = new Map(
              assinaturas
                .filter((a) => a.aplicadorId?.trim() && a.rubricaSvg?.trim())
                .map((a) => [a.aplicadorId, a.rubricaSvg!.trim()] as const),
            );
            await Promise.all(
              semRubrica.map(async (a) => {
                const svg = porId.get(a.id);
                if (svg) await salvarRubricaAplicadorSeVazia(a.id, svg);
              }),
            );
            comRubrica = lista.map((a) => {
              if (a.rubricaSvg?.trim()) return a;
              const svg = porId.get(a.id);
              return svg ? { ...a, rubricaSvg: svg } : a;
            });
          }
        } catch {
          comRubrica = lista;
        }

        if (!isBoss) {
          setAplicadores(comRubrica);
          return;
        }
        try {
          const [
            { getAplicadorSenhasMapFirestore, setAplicadorSenhaFirestore },
            { resolveStorageOwnerUid },
            { verificarSenhaAplicador },
          ] = await Promise.all([
            import('../services/firebase/aplicadorSenhasFirestore'),
            import('../services/firebase/authUid'),
            import('../utils/aplicadorSenha'),
          ]);
          const ownerUid = await resolveStorageOwnerUid();
          const cloudMap = await getAplicadorSenhasMapFirestore(ownerUid);
          const resolvido = await Promise.all(
            comRubrica.map(async (a) => {
              const cloud = cloudMap[a.id];
              // 1) Senha da nuvem que corresponde ao hash atual (mais confiável).
              if (cloud && a.senhaHash && cloud.senhaHash === a.senhaHash) {
                return { ...a, senha: cloud.senha };
              }
              // 2) Senha local válida do chefe — mantém. Só faz backfill quando NÃO há
              // senha na nuvem, para nunca sobrescrever uma troca mais recente de um membro.
              if (a.senha && a.senhaHash && (await verificarSenhaAplicador(a.senha, a.senhaHash))) {
                if (!cloud) {
                  void setAplicadorSenhaFirestore(ownerUid, a.id, a.senha, a.senhaHash).catch(() => {});
                }
                return a;
              }
              // 3) Qualquer senha da nuvem disponível.
              if (cloud && cloud.senha) {
                return { ...a, senha: cloud.senha };
              }
              // 4) Mantém o que houver localmente (a senha fica sempre visível).
              return a;
            }),
          );
          setAplicadores(resolvido);
        } catch {
          setAplicadores(comRubrica);
        }
      })
      .catch(() => undefined);
  }, [isBoss]);

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
    <>
      <MobileScreenScaffold contentContainerStyle={styles.scrollContent}>
        <TafCenteredTabHeader
          title="Aplicador"
          subtitle="Cadastro de aplicador de teste físico"
          footer={<TopActionIcons activeRoute="CadastroAplicador" inline centered />}
        />

          {isBoss && erroNuvem ? (
            <Text style={[ts.caption, styles.warnText, { color: dangerColor, marginBottom: 12 }]}>
              {erroNuvem}
            </Text>
          ) : null}

          {isBoss ? (
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
          ) : null}

          {isBoss && mostrarFormulario ? (
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
                <FieldLabel>{editandoId ? 'Senha (deixe vazio para manter)' : 'Senha (4 números)'}</FieldLabel>
                <TextInput
                  value={senha}
                  onChangeText={(t) => setSenha(formatSenhaAplicadorInput(t))}
                  placeholder={editandoId ? 'Nova senha (opcional)' : '0000'}
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={4}
                  style={[
                    styles.input,
                    {
                      borderColor: inputBorderColor,
                      backgroundColor: inputBgColor,
                      color: inputTextColor,
                      fontFamily: regularFont,
                    },
                  ]}
                />
              </View>

              <View style={styles.btnRow}>
                <TouchableOpacity
                  accessibilityLabel="cadastrar aplicador"
                  onPress={handleCadastrar}
                  disabled={salvando}
                  style={[
                    styles.btn,
                    {
                      backgroundColor: theme.primary,
                      opacity: salvando ? 0.55 : 1,
                    },
                  ]}
                >
                  <Text style={[ts.body, styles.btnText]}>
                    {salvando ? 'Salvando…' : editandoId ? 'Salvar alterações' : 'Cadastrar'}
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

          {!isBoss ? (
            <Card elevated style={styles.formCard}>
              <Text style={[ts.bodySecondary, { color: theme.textSecondary, textAlign: 'center' }]}>
                O cadastro de aplicadores é exclusivo do e-mail chefe. E-mails autorizados usam nome, posto,
                NIP e senha apenas ao finalizar provas.
              </Text>
            </Card>
          ) : null}

          {isBoss ? (
            <>
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
            <>
              {aplicadores.length === 0 ? (
                <TafGlassPanel style={styles.formCard}>
                  <Text style={[ts.body, { color: theme.text, textAlign: 'center' }]}>
                    Nenhum aplicador cadastrado ainda.
                  </Text>
                </TafGlassPanel>
              ) : (
                <AplicadoresCadastradosTable
                  data={aplicadores}
                  isBoss={isBoss}
                  onEditar={handleEditar}
                  onExcluir={(item) => setExcluirId(item.id)}
                />
              )}
            </>
          ) : null}
            </>
          ) : null}
      </MobileScreenScaffold>

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
                disabled={salvando}
                style={[
                  styles.modalBtn,
                  {
                    borderColor: dangerColor,
                    backgroundColor: theme.lossMuted,
                    opacity: salvando ? 0.55 : 1,
                  },
                ]}
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
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingTop: 4, gap: 4 },
  cloudHint: {
    width: '100%',
    maxWidth: 720,
    padding: 12,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    marginBottom: 16,
  },
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
