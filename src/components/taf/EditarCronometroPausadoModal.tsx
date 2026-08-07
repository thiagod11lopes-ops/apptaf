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
import { Timer } from 'lucide-react-native';
import { ModernModal } from '../sismav/ModernModal';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';
import {
  formatCronometroElapsedMs,
  parseFormatoElapsedParaMs,
} from '../../utils/formatRaceTime';

type Props = {
  visible: boolean;
  /** Tempo atual no formato MM:SS (ou MM:SS:CS legado). */
  tempoAtual: string;
  onClose: () => void;
  /** Confirma novo tempo MM:SS. */
  onConfirm: (tempoMmSs: string) => void;
};

function onlyDigits(value: string, maxLen: number): string {
  return value.replace(/\D/g, '').slice(0, maxLen);
}

function splitTempoParts(tempo: string): { mm: string; ss: string } {
  const parts = tempo.trim().split(':');
  if (parts.length >= 2) {
    return {
      mm: onlyDigits(parts[0] || '0', 4) || '0',
      ss: onlyDigits(parts[1] || '0', 2) || '0',
    };
  }
  return { mm: '0', ss: '0' };
}

export function EditarCronometroPausadoModal({
  visible,
  tempoAtual,
  onClose,
  onConfirm,
}: Props) {
  const { theme } = useTheme();
  const [minutos, setMinutos] = useState('0');
  const [segundos, setSegundos] = useState('0');
  const [erro, setErro] = useState('');
  const [aplicando, setAplicando] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const parts = splitTempoParts(tempoAtual);
    setMinutos(parts.mm.replace(/^0+(?=\d)/, '') || '0');
    setSegundos(parts.ss.replace(/^0+(?=\d)/, '') || '0');
    setErro('');
    setAplicando(false);
  }, [visible, tempoAtual]);

  const preview = useMemo(() => {
    const mm = parseInt(minutos || '0', 10);
    const ss = parseInt(segundos || '0', 10);
    if (!Number.isFinite(mm) || !Number.isFinite(ss)) return null;
    if (mm < 0 || ss < 0 || ss > 59) return null;
    return formatCronometroElapsedMs(mm * 60_000 + ss * 1000);
  }, [minutos, segundos]);

  const confirmar = () => {
    const mm = parseInt(minutos || '0', 10);
    const ss = parseInt(segundos || '0', 10);
    if (!Number.isFinite(mm) || mm < 0) {
      setErro('Informe os minutos (0 ou mais).');
      return;
    }
    if (!Number.isFinite(ss) || ss < 0 || ss > 59) {
      setErro('Segundos devem estar entre 0 e 59.');
      return;
    }
    const fmt = formatCronometroElapsedMs(mm * 60_000 + ss * 1000);
    if (parseFormatoElapsedParaMs(fmt) == null) {
      setErro('Tempo inválido.');
      return;
    }
    setAplicando(true);
    setErro('');
    onConfirm(fmt);
    setAplicando(false);
  };

  return (
    <ModernModal
      visible={visible}
      onClose={() => {
        if (aplicando) return;
        onClose();
      }}
      title="Editar tempo"
      icon={<Timer size={20} color="#FFFFFF" strokeWidth={2.2} />}
      maxBodyHeight={360}
    >
      <View style={styles.body}>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Ajuste minutos e segundos do cronômetro.
        </Text>

        <View style={styles.fieldsRow}>
          <View style={styles.fieldCol}>
            <Text style={[styles.label, { color: theme.textMuted }]}>Minutos</Text>
            <TextInput
              value={minutos}
              onChangeText={(t) => {
                setMinutos(onlyDigits(t, 4));
                setErro('');
              }}
              keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
              inputMode="numeric"
              maxLength={4}
              selectTextOnFocus
              accessibilityLabel="Minutos"
              placeholder="00"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSecondary,
                },
              ]}
            />
          </View>

          <Text style={[styles.sep, { color: theme.textMuted }]}>:</Text>

          <View style={styles.fieldCol}>
            <Text style={[styles.label, { color: theme.textMuted }]}>Segundos</Text>
            <TextInput
              value={segundos}
              onChangeText={(t) => {
                setSegundos(onlyDigits(t, 2));
                setErro('');
              }}
              keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
              inputMode="numeric"
              maxLength={2}
              selectTextOnFocus
              accessibilityLabel="Segundos"
              placeholder="00"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSecondary,
                },
              ]}
            />
          </View>
        </View>

        {preview ? (
          <Text style={[styles.preview, { color: theme.text }]}>Prévia: {preview}</Text>
        ) : null}

        {erro ? <Text style={[styles.erro, { color: theme.error }]}>{erro}</Text> : null}

        <View style={styles.footerInline}>
          <PressableScale
            onPress={onClose}
            disabled={aplicando}
            style={[
              styles.btnGhost,
              { borderColor: theme.border, opacity: aplicando ? 0.5 : 1 },
            ]}
          >
            <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Cancelar</Text>
          </PressableScale>
          <PressableScale
            onPress={confirmar}
            disabled={aplicando}
            style={styles.btnPrimaryOuter}
          >
            <LinearGradient
              colors={[...theme.tokens.gradientPrimaryBtn]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btnPrimary}
            >
              {aplicando ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>Aplicar</Text>
              )}
            </LinearGradient>
          </PressableScale>
        </View>
      </View>
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 14,
    paddingTop: 4,
  },
  hint: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  fieldsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  fieldCol: {
    flex: 1,
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.select({ web: 12, default: 10 }),
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    letterSpacing: 1,
  },
  sep: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  preview: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  erro: {
    fontSize: 13,
    fontWeight: '700',
  },
  footerInline: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btnGhost: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: {
    fontSize: 15,
    fontWeight: '800',
  },
  btnPrimaryOuter: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  btnPrimary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
