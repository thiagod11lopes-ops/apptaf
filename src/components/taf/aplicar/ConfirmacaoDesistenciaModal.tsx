import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Flag, AlertTriangle } from 'lucide-react-native';
import { ModernModal } from '../../sismav/ModernModal';
import { PressableScale } from '../../premium/PressableScale';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatNipInput } from '../../../utils/nipFormat';

type Props = {
  visible: boolean;
  nip: string;
  nome: string;
  provaLabel: string;
  onClose: () => void;
  onConfirm: () => void;
};

/** Confirma desistência em corrida/natação → reprovado sem tempo/nota numérica. */
export function ConfirmacaoDesistenciaModal({
  visible,
  nip,
  nome,
  provaLabel,
  onClose,
  onConfirm,
}: Props) {
  const { theme } = useTheme();
  const t = theme.tokens;
  const nipFmt = formatNipInput(nip);
  const nomeExibir = nome.trim() || 'este militar';

  const footer = (
    <View style={styles.footerRow}>
      <PressableScale
        onPress={onClose}
        style={[styles.btnGhost, { borderColor: theme.border }]}
      >
        <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Cancelar</Text>
      </PressableScale>
      <PressableScale onPress={onConfirm} style={styles.btnDangerOuter}>
        <LinearGradient
          colors={[...t.gradientDangerBtn]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.btnDanger,
            Platform.OS === 'web'
              ? ({ boxShadow: '0 6px 16px rgba(220, 38, 38, 0.35)' } as object)
              : undefined,
          ]}
        >
          <Flag size={16} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.btnDangerText}>Confirmar desistência</Text>
        </LinearGradient>
      </PressableScale>
    </View>
  );

  return (
    <ModernModal
      visible={visible}
      onClose={onClose}
      title="Registrar desistência?"
      icon={<AlertTriangle size={20} color="#FFFFFF" strokeWidth={2.2} />}
      footer={footer}
    >
      <View style={styles.bodyInner}>
        <View style={[styles.warnBox, { backgroundColor: theme.lossMuted, borderColor: theme.loss }]}>
          <Flag size={28} color={theme.loss} strokeWidth={2} />
        </View>
        <Text style={[styles.message, { color: theme.text }]}>
          <Text style={styles.strong}>{nomeExibir}</Text>
          {nipFmt ? (
            <>
              {' '}
              (NIP <Text style={styles.strong}>{nipFmt}</Text>)
            </>
          ) : null}{' '}
          será marcado como <Text style={styles.strong}>REPROVADO</Text> na prova de{' '}
          <Text style={styles.strong}>{provaLabel}</Text>. Na corrida, a nota fica{' '}
          <Text style={styles.strong}>REP. (n VOLTA/VOLTAS)</Text> e o tempo do cronômetro no momento da
          confirmação é registrado.
        </Text>
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          O teste passa a contar como aplicado. Você poderá desmarcar a desistência antes de aplicar.
        </Text>
      </View>
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  btnGhost: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: {
    fontSize: 14,
    fontWeight: '700',
  },
  btnDangerOuter: {
    flex: 1.35,
  },
  btnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnDangerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  bodyInner: {
    alignItems: 'center',
    gap: 12,
  },
  warnBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  strong: {
    fontWeight: '800',
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
