import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, AlertTriangle, Trash2 } from 'lucide-react-native';
import { ModernModal } from '../../sismav/ModernModal';
import { PressableScale } from '../../premium/PressableScale';
import { useTheme } from '../../../contexts/ThemeContext';

type Props = {
  visible: boolean;
  provaLabel: string;
  participantesCount: number;
  onContinuar: () => void;
  onDescartar: () => void;
};

/** Aviso no cold start com prova ativa ainda não lançada pelo aplicador. */
export function ContinuidadeProvaAtivaModal({
  visible,
  provaLabel,
  participantesCount,
  onContinuar,
  onDescartar,
}: Props) {
  const { theme, isDark } = useTheme();
  const t = theme.tokens;
  const prova = provaLabel.trim() || 'esta prova';
  const qtd = Math.max(0, participantesCount);
  const participantesLabel =
    qtd === 1 ? '1 participante' : `${qtd} participantes`;

  const footer = (
    <View style={styles.footerRow}>
      <PressableScale
        onPress={onDescartar}
        style={[styles.btnGhost, { borderColor: theme.border }]}
      >
        <Trash2 size={15} color={theme.textSecondary} strokeWidth={2.2} />
        <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Descartar</Text>
      </PressableScale>
      <PressableScale onPress={onContinuar} style={styles.btnPrimaryOuter}>
        <LinearGradient
          colors={[...t.gradientPrimaryBtn]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.btnPrimary,
            Platform.OS === 'web'
              ? ({ boxShadow: '0 6px 16px rgba(37, 99, 235, 0.35)' } as object)
              : undefined,
          ]}
        >
          <Play size={16} color="#FFFFFF" strokeWidth={2.5} fill="#FFFFFF" />
          <Text style={styles.btnPrimaryText}>Continuar teste</Text>
        </LinearGradient>
      </PressableScale>
    </View>
  );

  return (
    <ModernModal
      visible={visible}
      onClose={onContinuar}
      title="Teste em andamento"
      icon={<AlertTriangle size={20} color="#FFFFFF" strokeWidth={2.2} />}
      footer={footer}
    >
      <View style={styles.bodyInner}>
        <View
          style={[
            styles.warnBox,
            {
              backgroundColor: isDark
                ? 'rgba(37, 99, 235, 0.18)'
                : 'rgba(37, 99, 235, 0.1)',
              borderColor: theme.primary,
            },
          ]}
        >
          <AlertTriangle size={28} color={theme.primary} strokeWidth={2} />
        </View>
        <Text style={[styles.message, { color: theme.text }]}>
          Há um teste de <Text style={styles.strong}>{prova}</Text> ({participantesLabel}) que não
          foi finalizado pela rúbrica do aplicador.
        </Text>
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          O andamento foi recuperado. Continue de onde parou ou descarte o teste para iniciar outro.
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
    flexDirection: 'row',
    gap: 6,
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
  btnPrimaryOuter: {
    flex: 1.35,
    borderRadius: 12,
    overflow: 'hidden',
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  bodyInner: {
    alignItems: 'center',
    gap: 14,
    paddingTop: 4,
  },
  warnBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
  },
  strong: {
    fontWeight: '800',
  },
  hint: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
});
