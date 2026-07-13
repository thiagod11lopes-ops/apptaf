import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { AppModal } from '../../premium/AppModal';
import { useTheme } from '../../../contexts/ThemeContext';
import { getUiColors } from '../../../theme/uiColors';

const ACCENT = '#8b5cf6';

type Props = {
  visible: boolean;
  /** Duração em ms antes de chamar onDone (padrão 3000). */
  durationMs?: number;
  onDone: () => void;
};

/** Toast/modal curto após cadastrar fatores de risco. */
export function FatoresRiscoSalvoToast({ visible, durationMs = 3000, onDone }: Props) {
  const { theme } = useTheme();
  const ui = getUiColors(theme);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDone, durationMs);
    return () => clearTimeout(t);
  }, [visible, durationMs, onDone]);

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <View style={styles.overlay} pointerEvents="box-none">
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.isDark ? 'rgba(15,23,42,0.96)' : 'rgba(255,255,255,0.97)',
              borderColor: theme.isDark ? 'rgba(139,92,246,0.45)' : 'rgba(139,92,246,0.3)',
            },
          ]}
        >
          <View
            style={[
              styles.glow,
              {
                backgroundColor: theme.isDark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.12)',
              },
            ]}
          />
          <View style={[styles.iconRing, { backgroundColor: theme.isDark ? 'rgba(139,92,246,0.22)' : 'rgba(237,233,254,0.95)' }]}>
            <ShieldCheck size={28} color={ACCENT} strokeWidth={2.4} />
          </View>
          <Text style={[styles.title, { color: ui.text }]}>Fatores de risco Cadastrados</Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]}>
            Dados salvos com sucesso
          </Text>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    opacity: 0.9,
  },
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  sub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
