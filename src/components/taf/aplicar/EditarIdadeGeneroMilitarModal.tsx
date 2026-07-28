import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { UserRound } from 'lucide-react-native';
import { ModernModal } from '../../sismav/ModernModal';
import { PressableScale } from '../../premium/PressableScale';
import { useTheme } from '../../../contexts/ThemeContext';
import { idadeFromDataNascimento } from '../../../utils/idadeFromDataNascimento';
import { dataNascimentoCadastroValida } from '../../../utils/cadastroDadosTaf';
import { AplicarTafInput } from './AplicarTafUi';

function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}/${mm}`;
  return `${dd}/${mm}/${yyyy}`;
}

type Props = {
  visible: boolean;
  nome: string;
  nip: string;
  dataNascimento: string;
  sexo?: 'M' | 'F';
  onClose: () => void;
  onSalvar: (dados: { dataNascimento: string; sexo: 'M' | 'F' }) => Promise<void>;
};

export function EditarIdadeGeneroMilitarModal({
  visible,
  nome,
  nip,
  dataNascimento: dataInicial,
  sexo: sexoInicial,
  onClose,
  onSalvar,
}: Props) {
  const { theme } = useTheme();
  const [dataNascimento, setDataNascimento] = useState(dataInicial);
  const [sexo, setSexo] = useState<'M' | 'F'>(sexoInicial === 'F' ? 'F' : 'M');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDataNascimento(dataInicial);
    setSexo(sexoInicial === 'F' ? 'F' : 'M');
    setErro('');
    setSalvando(false);
  }, [visible, dataInicial, sexoInicial]);

  const idade = useMemo(() => idadeFromDataNascimento(dataNascimento), [dataNascimento]);

  const salvar = async () => {
    const data = dataNascimento.trim();
    if (!dataNascimentoCadastroValida(data) || idade == null) {
      setErro('Informe a data de nascimento no formato DD/MM/AAAA.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await onSalvar({ dataNascimento: data, sexo });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
      setSalvando(false);
      return;
    }
    setSalvando(false);
  };

  return (
    <ModernModal
      visible={visible}
      onClose={() => {
        if (salvando) return;
        onClose();
      }}
      title="Idade e gênero"
      icon={<UserRound size={20} color="#FFFFFF" strokeWidth={2.2} />}
      footer={
        <View style={styles.footer}>
          <PressableScale
            onPress={onClose}
            disabled={salvando}
            style={[styles.btnGhost, { borderColor: theme.border, opacity: salvando ? 0.5 : 1 }]}
          >
            <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Cancelar</Text>
          </PressableScale>
          <PressableScale onPress={() => void salvar()} disabled={salvando} style={styles.btnPrimaryOuter}>
            <LinearGradient
              colors={[...theme.tokens.gradientPrimaryBtn]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btnPrimary}
            >
              {salvando ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>Salvar</Text>
              )}
            </LinearGradient>
          </PressableScale>
        </View>
      }
    >
      <View style={styles.body}>
        <Text style={[styles.nome, { color: theme.text }]} numberOfLines={2}>
          {nome}
        </Text>
        {nip ? (
          <Text style={[styles.nip, { color: theme.textSecondary }]}>NIP {nip}</Text>
        ) : null}

        <Text style={[styles.label, { color: theme.textMuted }]}>Data de nascimento</Text>
        <AplicarTafInput
          value={dataNascimento}
          onChangeText={(t) => setDataNascimento(formatDateInput(t))}
          placeholder="DD/MM/AAAA"
          keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
          inputMode="numeric"
          maxLength={10}
          accessibilityLabel="Data de nascimento"
        />
        <Text style={[styles.idadeHint, { color: theme.textSecondary }]}>
          {idade != null ? `Idade: ${idade} anos` : 'Informe a data para calcular a idade'}
        </Text>

        <Text style={[styles.label, { color: theme.textMuted }]}>Gênero</Text>
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
                  {
                    backgroundColor: active
                      ? theme.isDark
                        ? 'rgba(37,99,235,0.35)'
                        : 'rgba(37,99,235,0.12)'
                      : theme.backgroundSecondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? theme.primary : theme.textSecondary },
                  ]}
                >
                  {sx === 'M' ? 'Masculino' : 'Feminino'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {erro ? <Text style={[styles.erro, { color: theme.error }]}>{erro}</Text> : null}
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          Os dados serão atualizados no cadastro e usados no cálculo da nota.
        </Text>
      </View>
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: 8 },
  nome: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  nip: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 6 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  idadeHint: { fontSize: 13, fontWeight: '600' },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  segmentText: { fontSize: 13, fontWeight: '800' },
  erro: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  hint: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 4 },
  footer: { flexDirection: 'row', gap: 10, width: '100%' },
  btnGhost: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: { fontSize: 14, fontWeight: '700' },
  btnPrimaryOuter: { flex: 1 },
  btnPrimary: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
