import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getAllAplicadores, type AplicadorItemPersist } from '../../services/aplicadoresIndexedDb';
import { verificarSenhaAplicador } from '../../utils/aplicadorSenha';
import {
  postoGradAplicador,
  type AplicadorAssinaturaResumo,
} from '../../types/aplicadorAssinatura';

function labelAplicador(item: AplicadorItemPersist): string {
  const posto = postoGradAplicador(item);
  const nip = item.nip?.trim();
  const nome = posto !== '—' ? `${posto} ${item.nome}` : item.nome;
  return nip ? `${nome} (${nip})` : nome;
}

type Props = {
  visible: boolean;
  onConcluir: (assinatura: AplicadorAssinaturaResumo) => void;
};

export function FluxoAssinaturaAplicadorModal({ visible, onConcluir }: Props) {
  const { theme } = useTheme();
  const [senha, setSenha] = useState('');
  const [erroSenha, setErroSenha] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [aplicadores, setAplicadores] = useState<AplicadorItemPersist[]>([]);
  const [carregandoAplicadores, setCarregandoAplicadores] = useState(false);
  const [aplicadorSelecionadoId, setAplicadorSelecionadoId] = useState('');

  const aplicadorSelecionado = useMemo(
    () => aplicadores.find((a) => a.id === aplicadorSelecionadoId) ?? null,
    [aplicadores, aplicadorSelecionadoId],
  );

  useEffect(() => {
    if (!visible) return;
    setSenha('');
    setErroSenha('');
    setVerificando(false);
    setAplicadorSelecionadoId('');

    setCarregandoAplicadores(true);
    void getAllAplicadores()
      .then((lista) => {
        const ordenados = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        setAplicadores(ordenados);
      })
      .catch(() => setAplicadores([]))
      .finally(() => setCarregandoAplicadores(false));
  }, [visible]);

  const selecionarAplicador = useCallback(
    (id: string) => {
      setAplicadorSelecionadoId(id);
      setErroSenha('');
      const item = aplicadores.find((a) => a.id === id);
      setSenha(item?.senha?.trim() ?? '');
    },
    [aplicadores],
  );

  const confirmarAssinatura = useCallback(async () => {
    if (!aplicadorSelecionado) {
      setErroSenha('Selecione o aplicador.');
      return;
    }
    if (!senha.trim()) {
      setErroSenha('Informe a senha do aplicador.');
      return;
    }
    if (!aplicadorSelecionado.senhaHash) {
      setErroSenha('Este aplicador não possui senha cadastrada. Atualize no menu Aplicador.');
      return;
    }

    setVerificando(true);
    setErroSenha('');
    try {
      const senhaOk = await verificarSenhaAplicador(senha, aplicadorSelecionado.senhaHash);
      if (!senhaOk) {
        setErroSenha('Senha incorreta para o aplicador selecionado.');
        return;
      }
      onConcluir({
        aplicadorId: aplicadorSelecionado.id,
        nome: aplicadorSelecionado.nome,
        nip: aplicadorSelecionado.nip,
        categoria: aplicadorSelecionado.categoria,
        postoGrad: postoGradAplicador(aplicadorSelecionado),
      });
    } finally {
      setVerificando(false);
    }
  }, [aplicadorSelecionado, onConcluir, senha]);

  const selectWebStyle = useMemo(
    () =>
      ({
        width: '100%',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: theme.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        marginBottom: 12,
        backgroundColor: theme.backgroundSecondary,
        color: theme.text,
      }) as object,
    [theme],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}} accessibilityViewIsModal>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <Text style={[styles.titulo, { color: theme.text }]}>Assinatura do aplicador</Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]}>
            Após as rúbricas dos militares, selecione o aplicador e confirme a senha cadastrada.
          </Text>

          <Text style={[styles.label, { color: theme.textSecondary }]}>Aplicador</Text>
          {carregandoAplicadores ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[styles.sub, { color: theme.textSecondary, marginBottom: 0 }]}>
                Carregando aplicadores…
              </Text>
            </View>
          ) : aplicadores.length === 0 ? (
            <Text style={[styles.erro, { color: theme.loss }]}>
              Nenhum aplicador cadastrado. Cadastre no menu Aplicador.
            </Text>
          ) : Platform.OS === 'web' ? (
            <select
              value={aplicadorSelecionadoId}
              onChange={(e) => selecionarAplicador(e.target.value)}
              style={selectWebStyle}
            >
              <option value="">Selecione o aplicador</option>
              {aplicadores.map((item) => (
                <option key={item.id} value={item.id}>
                  {labelAplicador(item)}
                </option>
              ))}
            </select>
          ) : (
            <ScrollView
              style={[
                styles.selectList,
                { borderColor: theme.border, backgroundColor: theme.backgroundSecondary },
              ]}
              nestedScrollEnabled
            >
              {aplicadores.map((item) => {
                const active = item.id === aplicadorSelecionadoId;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => selecionarAplicador(item.id)}
                    style={[
                      styles.selectOption,
                      active
                        ? { backgroundColor: theme.primary }
                        : { backgroundColor: theme.backgroundSecondary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.selectOptionText,
                        { color: active ? theme.text : theme.textSecondary },
                      ]}
                    >
                      {labelAplicador(item)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <Text style={[styles.label, { color: theme.textSecondary }]}>Senha</Text>
          <TextInput
            value={senha}
            onChangeText={(t) => {
              setSenha(t);
              setErroSenha('');
            }}
            placeholder="Senha do aplicador selecionado"
            placeholderTextColor={theme.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!!aplicadorSelecionadoId}
            style={[
              styles.input,
              {
                borderColor: theme.border,
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
                opacity: aplicadorSelecionadoId ? 1 : 0.6,
              },
              Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {},
            ]}
          />
          {erroSenha ? <Text style={[styles.erro, { color: theme.loss }]}>{erroSenha}</Text> : null}
          <TouchableOpacity
            onPress={() => void confirmarAssinatura()}
            disabled={verificando || aplicadores.length === 0}
            style={[
              styles.btnPrimary,
              {
                backgroundColor: theme.primary,
                opacity: verificando || aplicadores.length === 0 ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[styles.btnPrimaryText, { color: theme.text }]}>
              {verificando ? 'Verificando…' : 'Confirmar assinatura'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  titulo: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  sub: { fontSize: 13, lineHeight: 19, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  selectList: {
    maxHeight: 160,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
  },
  selectOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectOptionText: { fontSize: 15, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  erro: { fontSize: 13, fontWeight: '600', marginBottom: 10, textAlign: 'center' },
  btnPrimary: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnPrimaryText: { fontWeight: '800', fontSize: 15 },
});
