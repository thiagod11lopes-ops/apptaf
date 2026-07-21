import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react-native';
import { ModernModal } from '../sismav/ModernModal';
import { PressableScale } from './PressableScale';
import { useTheme } from '../../contexts/ThemeContext';
import {
  getE2eUiStatusCopy,
  type E2eUiStatus,
} from '../../offline-first/sync/e2eUiStatus';

type Props = {
  visible: boolean;
  /** @deprecated Prefer `status`. Mantido para callers antigos. */
  e2eActive?: boolean;
  status?: E2eUiStatus;
  onClose: () => void;
};

function statusColorFor(
  status: E2eUiStatus,
  theme: { gain: string; loss: string; tokens: { warning500: string } },
): string {
  if (status === 'ready') return theme.gain;
  if (status === 'awaiting_boss_wrap' || status === 'key_mismatch') {
    return theme.tokens.warning500;
  }
  return theme.loss;
}

function statusMutedBg(status: E2eUiStatus, theme: { gainMuted: string }): string {
  if (status === 'ready') return theme.gainMuted;
  if (status === 'awaiting_boss_wrap' || status === 'key_mismatch') {
    return 'rgba(245, 158, 11, 0.14)';
  }
  return 'rgba(220, 38, 38, 0.12)';
}

export function E2eEncryptionStatusModal({ visible, e2eActive, status: statusProp, onClose }: Props) {
  const { theme } = useTheme();
  const t = theme.tokens;
  const status: E2eUiStatus =
    statusProp ?? (e2eActive ? 'ready' : 'inactive');
  const copy = getE2eUiStatusCopy(status);
  const statusColor = statusColorFor(status, theme);

  const Icon = status === 'ready' ? ShieldCheck : ShieldAlert;

  return (
    <ModernModal
      visible={visible}
      onClose={onClose}
      title="Criptografia dos cadastros"
      icon={<Icon size={22} color="#FFFFFF" strokeWidth={2.4} />}
      footer={
        <View style={styles.footerRow}>
          <PressableScale onPress={onClose} style={styles.btnPrimaryOuter}>
            <LinearGradient
              colors={[...t.gradientPrimaryBtn]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.btnPrimary,
                Platform.OS === 'web'
                  ? ({ boxShadow: '0 6px 16px rgba(37, 99, 235, 0.32)' } as object)
                  : undefined,
              ]}
            >
              <Text style={styles.btnPrimaryText}>Entendi</Text>
            </LinearGradient>
          </PressableScale>
        </View>
      }
    >
      <View style={styles.body}>
        <View
          style={[
            styles.statusChip,
            {
              backgroundColor: statusMutedBg(status, theme),
              borderColor: statusColor,
            },
          ]}
        >
          <Shield size={18} color={statusColor} strokeWidth={2.4} />
          <Text style={[styles.statusChipText, { color: statusColor }]}>{copy.chip}</Text>
        </View>

        {copy.body.map((paragraph) => (
          <Text key={paragraph.slice(0, 24)} style={[styles.paragraph, { color: theme.text }]}>
            {paragraph}
          </Text>
        ))}

        <Text style={[styles.footnote, { color: theme.textMuted }]}>{copy.footnote}</Text>
      </View>
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 14,
    paddingTop: 4,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  btnPrimaryOuter: {
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 120,
  },
  btnPrimary: {
    minHeight: 44,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
