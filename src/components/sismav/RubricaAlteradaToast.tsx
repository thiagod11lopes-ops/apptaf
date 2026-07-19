import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PenLine, Sparkles } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';

type Props = {
  visible: boolean;
  durationMs?: number;
  onDone: () => void;
};

/** Toast ultramoderno ~3s após alterar a rúbrica do aplicador. */
export function RubricaAlteradaToast({ visible, durationMs = 3000, onDone }: Props) {
  const { theme } = useTheme();
  const ui = getUiColors(theme);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDone, durationMs);
    return () => clearTimeout(t);
  }, [visible, durationMs, onDone]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <View style={styles.overlay}>
        <LinearGradient
          colors={['rgba(2,6,23,0.55)', 'rgba(49,46,129,0.45)']}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.isDark ? 'rgba(15,23,42,0.98)' : 'rgba(255,255,255,0.98)',
              borderColor: theme.isDark ? 'rgba(167,139,250,0.5)' : 'rgba(124,58,237,0.35)',
              ...(Platform.OS === 'web'
                ? ({ boxShadow: '0 24px 60px rgba(91,33,182,0.35)' } as object)
                : null),
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(124,58,237,0.28)', 'rgba(99,102,241,0.08)', 'transparent']}
            style={styles.glow}
          />
          <View style={styles.iconStack}>
            <View style={styles.sparkle}>
              <Sparkles size={16} color="#a78bfa" strokeWidth={2.4} />
            </View>
            <LinearGradient
              colors={['#7c3aed', '#6366f1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconRing}
            >
              <PenLine size={26} color="#FFFFFF" strokeWidth={2.4} />
            </LinearGradient>
          </View>
          <Text style={[styles.kicker, { color: '#a78bfa' }]}>APLICADOR</Text>
          <Text style={[styles.title, { color: ui.text }]}>Rúbrica alterada com sucesso</Text>
          <View style={styles.barTrack}>
            <LinearGradient
              colors={['#7c3aed', '#38bdf8']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.barFill}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 30,
    paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    height: 140,
  },
  iconStack: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: {
    position: 'absolute',
    top: -6,
    right: -10,
    zIndex: 2,
  },
  iconRing: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  barTrack: {
    marginTop: 18,
    width: '72%',
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.25)',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    height: '100%',
  },
});
