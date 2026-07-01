import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, ArrowRightLeft } from 'lucide-react-native';
import { ModernModal } from './ModernModal';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';
import {
  labelModalidadeExcludente,
  type ModalidadeExcludenteSubstituta,
} from '../../utils/corridaCaminhadaExcludente';

export type ModalModalidadeExcludenteInfo = {
  index: number;
  nip: string;
  nome: string;
  /** Modalidade já registrada no cadastro. */
  modalidadeExistente: ModalidadeExcludenteSubstituta;
  /** Modalidade que será aplicada agora. */
  modalidadeNova: ModalidadeExcludenteSubstituta;
};

type Props = {
  info: ModalModalidadeExcludenteInfo | null;
  onProsseguir: () => void;
  onDesistir: () => void;
};

export function ModalModalidadeExcludente({ info, onProsseguir, onDesistir }: Props) {
  const { theme } = useTheme();
  const t = theme.tokens;

  const existenteLabel = info ? labelModalidadeExcludente(info.modalidadeExistente) : '';
  const novaLabel = info ? labelModalidadeExcludente(info.modalidadeNova) : '';

  const footer = (
    <View style={styles.footerCol}>
      <PressableScale
        onPress={onDesistir}
        style={[styles.btnGhost, { borderColor: theme.border }]}
      >
        <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Desistir</Text>
      </PressableScale>
      <PressableScale onPress={onProsseguir} style={styles.btnPrimaryOuter}>
        <LinearGradient
          colors={[...t.gradientPrimaryBtn]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btnPrimary}
        >
          <ArrowRightLeft size={16} color="#FFFFFF" strokeWidth={2.4} />
          <Text style={styles.btnPrimaryText}>Prosseguir e substituir</Text>
        </LinearGradient>
      </PressableScale>
    </View>
  );

  return (
    <ModernModal
      visible={!!info}
      onClose={onDesistir}
      title="Modalidade já registrada"
      icon={<AlertTriangle size={20} color="#FFFFFF" strokeWidth={2.2} />}
      footer={footer}
    >
      {info ? (
        <View style={styles.body}>
          <Text style={[styles.message, { color: theme.text }]}>
            {`O militar `}
            <Text style={styles.strong}>{info.nome}</Text>
            {` (NIP `}
            <Text style={styles.strong}>{info.nip}</Text>
            {`) já possui registro de `}
            <Text style={styles.strong}>{existenteLabel}</Text>
            {`.`}
          </Text>
          <Text style={[styles.message, { color: theme.text }]}>
            {`Se prosseguir com a `}
            <Text style={styles.strong}>{novaLabel}</Text>
            {`, ela `}
            <Text style={styles.strong}>substituirá</Text>
            {` a `}
            <Text style={styles.strong}>{existenteLabel}</Text>
            {`. O registro anterior de `}
            <Text style={styles.strong}>{existenteLabel}</Text>
            {` será `}
            <Text style={[styles.strong, { color: theme.loss }]}>apagado</Text>
            {` ao concluir esta prova.`}
          </Text>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Toque em Desistir para apagar o NIP desta linha e informar outro participante.
          </Text>
        </View>
      ) : null}
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  body: { paddingVertical: 4, gap: 12 },
  message: { fontSize: 15, lineHeight: 22 },
  strong: { fontWeight: '800' },
  hint: { fontSize: 13, lineHeight: 18, fontStyle: 'italic', textAlign: 'center' },
  footerCol: { flex: 1, width: '100%', gap: 10 },
  btnGhost: {
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  btnPrimaryOuter: { borderRadius: 12, overflow: 'hidden' },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 6px 16px rgba(37, 99, 235, 0.35)' } as object)
      : {}),
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
});
