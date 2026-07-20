import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, CalendarDays, Save } from 'lucide-react-native';
import { ModernModal } from './ModernModal';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import { idadeFromDataNascimento } from '../../utils/idadeFromDataNascimento';

export type DataNascimentoAtencaoInfo = {
  linhaIdx: number;
  nome: string;
  nip: string;
  cadastroId: string;
};

type Props = {
  info: DataNascimentoAtencaoInfo | null;
  loading?: boolean;
  onClose: () => void;
  onSalvar: (dataNascimento: string) => void;
};

function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}/${mm}`;
  return `${dd}/${mm}/${yyyy}`;
}

function dataNascimentoValida(value: string): boolean {
  const t = value.trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(t)) return false;
  return idadeFromDataNascimento(t) != null;
}

/** Modal de atenção: militar sem DN — pede a data para salvar e calcular a nota. */
export function DataNascimentoAtencaoModal({
  info,
  loading = false,
  onClose,
  onSalvar,
}: Props) {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const t = theme.tokens;
  const [data, setData] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (info) {
      setData('');
      setErro('');
    }
  }, [info]);

  const visible = info != null;
  const idadePreview = dataNascimentoValida(data) ? idadeFromDataNascimento(data) : null;

  const confirmar = () => {
    const valor = data.trim();
    if (!dataNascimentoValida(valor)) {
      setErro('Informe uma data válida no formato DD/MM/AAAA.');
      return;
    }
    setErro('');
    onSalvar(valor);
  };

  const footer = (
    <View style={styles.footerRow}>
      <PressableScale
        onPress={onClose}
        disabled={loading}
        style={[styles.btnGhost, { borderColor: theme.border, opacity: loading ? 0.5 : 1 }]}
      >
        <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Agora não</Text>
      </PressableScale>
      <PressableScale onPress={confirmar} disabled={loading} style={styles.btnPrimaryOuter}>
        <LinearGradient
          colors={[...t.gradientPrimaryBtn]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btnPrimary}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Save size={16} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.btnPrimaryText}>Salvar data</Text>
            </>
          )}
        </LinearGradient>
      </PressableScale>
    </View>
  );

  return (
    <ModernModal
      visible={visible}
      onClose={loading ? () => {} : onClose}
      dismissable={!loading}
      title="Data de nascimento necessária"
      icon={<AlertTriangle size={20} color="#FFFFFF" strokeWidth={2.2} />}
      footer={footer}
    >
      <View style={styles.body}>
        <View style={[styles.warnBox, { backgroundColor: theme.lossMuted, borderColor: theme.loss }]}>
          <CalendarDays size={28} color={theme.loss} strokeWidth={2} />
        </View>

        <Text style={[styles.message, { color: theme.text }]}>
          O militar{' '}
          <Text style={styles.strong}>{(info?.nome || '').trim() || 'selecionado'}</Text>
          {info?.nip ? (
            <>
              {' '}
              (NIP <Text style={styles.strong}>{info.nip}</Text>)
            </>
          ) : null}{' '}
          não possui data de nascimento cadastrada.
        </Text>

        <Text style={[styles.hint, { color: theme.textMuted }]}>
          Sem essa informação não é possível calcular a nota e a situação pela tabela da norma.
          Informe a data abaixo para salvá-la no cadastro e liberar o cálculo automático.
        </Text>

        <Text style={[styles.label, { color: theme.textMuted }]}>Data de nascimento</Text>
        <TextInput
          value={data}
          onChangeText={(v) => {
            setData(formatDateInput(v));
            if (erro) setErro('');
          }}
          placeholder="DD/MM/AAAA"
          placeholderTextColor={theme.textMuted}
          keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
          maxLength={10}
          editable={!loading}
          style={[
            styles.input,
            {
              color: ui.text,
              borderColor: erro ? theme.loss : theme.border,
              backgroundColor: theme.isDark ? 'rgba(2,6,23,0.45)' : '#FFFFFF',
            },
          ]}
        />
        {idadePreview != null ? (
          <Text style={[styles.preview, { color: theme.gain }]}>Idade: {idadePreview} anos</Text>
        ) : null}
        {erro ? <Text style={[styles.erro, { color: theme.loss }]}>{erro}</Text> : null}
      </View>
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12 },
  warnBox: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
  },
  strong: { fontWeight: '900' },
  hint: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    textAlign: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 12 : 14,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  preview: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  erro: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  btnGhost: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  btnGhostText: { fontSize: 14, fontWeight: '800' },
  btnPrimaryOuter: { flex: 1.2 },
  btnPrimary: {
    minHeight: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
