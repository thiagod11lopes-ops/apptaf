import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { KeyRound } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { ModernModal } from '../sismav/ModernModal';
import { Button } from '../Button';
import {
  getAllAplicadores,
  alterarSenhaAplicador,
  type AplicadorItemPersist,
} from '../../services/aplicadoresIndexedDb';
import {
  verificarSenhaAplicador,
  formatSenhaAplicadorInput,
  isSenhaAplicadorValid,
} from '../../utils/aplicadorSenha';
import { postoGradAplicador } from '../../types/aplicadorAssinatura';
import { compareByNomePtBr } from '../../utils/compareNomePtBr';

type Props = {
  visible: boolean;
  onClose: () => void;
};

function labelAplicador(item: AplicadorItemPersist): string {
  const posto = postoGradAplicador(item);
  const nip = item.nip?.trim();
  const nome = posto !== '—' ? `${posto} ${item.nome}` : item.nome;
  return nip ? `${nome} (${nip})` : nome;
}

export function AlterarSenhaAplicadorModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;

  const [aplicadores, setAplicadores] = useState<AplicadorItemPersist[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [selecionadoId, setSelecionadoId] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [salvando, setSalvando] = useState(false);

  const selecionado = useMemo(
    () => aplicadores.find((a) => a.id === selecionadoId) ?? null,
    [aplicadores, selecionadoId],
  );

  useEffect(() => {
    if (!visible) return;
    setSelecionadoId('');
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmarSenha('');
    setErro('');
    setSucesso('');
    setSalvando(false);

    setCarregando(true);
    void getAllAplicadores()
      .then((lista) => setAplicadores([...lista].sort(compareByNomePtBr)))
      .catch(() => setAplicadores([]))
      .finally(() => setCarregando(false));
  }, [visible]);

  const selecionarAplicador = useCallback((id: string) => {
    setSelecionadoId(id);
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmarSenha('');
    setErro('');
    setSucesso('');
  }, []);

  const salvar = useCallback(async () => {
    if (!selecionado) {
      setErro('Selecione o aplicador.');
      return;
    }
    if (!selecionado.senhaHash) {
      setErro('Este aplicador não possui senha cadastrada. Solicite ao e-mail chefe.');
      return;
    }
    if (!isSenhaAplicadorValid(senhaAtual)) {
      setErro('Informe a senha atual (4 números).');
      return;
    }
    if (!isSenhaAplicadorValid(novaSenha)) {
      setErro('A nova senha deve ter exatamente 4 números.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErro('A confirmação não corresponde à nova senha.');
      return;
    }

    setSalvando(true);
    setErro('');
    setSucesso('');
    try {
      const atualOk = await verificarSenhaAplicador(senhaAtual, selecionado.senhaHash);
      if (!atualOk) {
        setErro('Senha atual incorreta.');
        return;
      }
      const ok = await alterarSenhaAplicador(selecionado.id, novaSenha);
      if (!ok) {
        setErro('Não foi possível alterar a senha. Tente novamente.');
        return;
      }
      setSucesso(`Senha de ${selecionado.nome} alterada com sucesso.`);
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
      setAplicadores((prev) =>
        prev.map((a) => (a.id === selecionado.id ? { ...a, senha: undefined } : a)),
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao alterar a senha.');
    } finally {
      setSalvando(false);
    }
  }, [confirmarSenha, novaSenha, selecionado, senhaAtual]);

  const inputStyle = useMemo(
    () => [
      styles.input,
      {
        borderColor: theme.border,
        backgroundColor: theme.isDark ? 'rgba(2,6,23,0.45)' : 'rgba(255,255,255,0.7)',
        color: theme.text,
      },
    ],
    [theme],
  );

  const selectWebStyle = useMemo(
    () =>
      ({
        width: '100%',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: theme.border,
        borderRadius: 12,
        paddingLeft: 14,
        paddingRight: 14,
        paddingTop: 13,
        paddingBottom: 13,
        fontSize: 16,
        marginBottom: 4,
        backgroundColor: theme.isDark ? 'rgba(2,6,23,0.45)' : 'rgba(255,255,255,0.7)',
        color: theme.text,
      }) as object,
    [theme],
  );

  const footer = (
    <>
      <Button title="Cancelar" variant="outline" onPress={onClose} style={styles.footerBtn} />
      <Button
        title={salvando ? 'Salvando…' : 'Alterar senha'}
        onPress={() => void salvar()}
        loading={salvando}
        disabled={salvando || aplicadores.length === 0}
        style={styles.footerBtn}
      />
    </>
  );

  return (
    <ModernModal
      visible={visible}
      onClose={onClose}
      title="Alterar senha de aplicador"
      icon={<KeyRound size={20} color="#FFFFFF" strokeWidth={2.2} />}
      footer={footer}
      maxBodyHeight={480}
    >
      <Text style={[ts.caption, { color: theme.textSecondary, marginBottom: 14 }]}>
        Selecione o aplicador, confirme a senha atual e defina a nova senha (4 números).
      </Text>

      <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Aplicador</Text>
      {carregando ? (
        <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 12 }} />
      ) : aplicadores.length === 0 ? (
        <Text style={[ts.caption, { color: theme.loss, marginBottom: 8 }]}>
          Nenhum aplicador cadastrado.
        </Text>
      ) : Platform.OS === 'web' ? (
        <select
          value={selecionadoId}
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
        <View style={[styles.selectList, { borderColor: theme.border }]}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ maxHeight: 180 }}>
            {aplicadores.map((item) => {
              const active = item.id === selecionadoId;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => selecionarAplicador(item.id)}
                  style={[
                    styles.selectRow,
                    { backgroundColor: active ? theme.primary : 'transparent' },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '600',
                      color: active ? theme.tokens.textOnPrimary : theme.textSecondary,
                    }}
                  >
                    {labelAplicador(item)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <Text style={[styles.fieldLabel, { color: theme.textMuted, marginTop: 14 }]}>Senha atual</Text>
      <TextInput
        value={senhaAtual}
        onChangeText={(t) => {
          setSenhaAtual(formatSenhaAplicadorInput(t));
          setErro('');
        }}
        placeholder="0000"
        placeholderTextColor={theme.textMuted}
        secureTextEntry
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={4}
        editable={!!selecionadoId}
        style={[inputStyle, { opacity: selecionadoId ? 1 : 0.6 }]}
      />

      <Text style={[styles.fieldLabel, { color: theme.textMuted, marginTop: 12 }]}>Nova senha</Text>
      <TextInput
        value={novaSenha}
        onChangeText={(t) => {
          setNovaSenha(formatSenhaAplicadorInput(t));
          setErro('');
        }}
        placeholder="Nova senha (4 números)"
        placeholderTextColor={theme.textMuted}
        secureTextEntry
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={4}
        editable={!!selecionadoId}
        style={[inputStyle, { opacity: selecionadoId ? 1 : 0.6 }]}
      />

      <Text style={[styles.fieldLabel, { color: theme.textMuted, marginTop: 12 }]}>
        Confirmar nova senha
      </Text>
      <TextInput
        value={confirmarSenha}
        onChangeText={(t) => {
          setConfirmarSenha(formatSenhaAplicadorInput(t));
          setErro('');
        }}
        placeholder="Repita a nova senha"
        placeholderTextColor={theme.textMuted}
        secureTextEntry
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={4}
        editable={!!selecionadoId}
        style={[inputStyle, { opacity: selecionadoId ? 1 : 0.6 }]}
      />

      {erro ? <Text style={[ts.caption, { color: theme.loss, marginTop: 12 }]}>{erro}</Text> : null}
      {sucesso ? (
        <Text style={[ts.caption, { color: theme.gain, marginTop: 12, fontWeight: '700' }]}>
          {sucesso}
        </Text>
      ) : null}
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
  },
  selectList: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  selectRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  footerBtn: { flex: 1 },
});
