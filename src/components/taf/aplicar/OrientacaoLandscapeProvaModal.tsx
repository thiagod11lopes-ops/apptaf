import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Smartphone, RotateCw, Maximize2 } from 'lucide-react-native';
import { ModernModal } from '../sismav/ModernModal';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  onContinuar: () => void;
};

export function OrientacaoLandscapeProvaModal({ visible, onClose, onContinuar }: Props) {
  const { theme } = useTheme();
  const rotate = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const floatY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      rotate.setValue(0);
      pulse.setValue(1);
      floatY.setValue(0);
      return;
    }

    const rotateLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(rotate, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(420),
        Animated.timing(rotate, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(500),
      ]),
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -6,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    rotateLoop.start();
    pulseLoop.start();
    floatLoop.start();
    return () => {
      rotateLoop.stop();
      pulseLoop.stop();
      floatLoop.stop();
    };
  }, [visible, rotate, pulse, floatY]);

  const phoneRotate = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const footer = (
    <View style={styles.footer}>
      <PressableScale
        onPress={onClose}
        style={[styles.btnGhost, { borderColor: theme.border }]}
      >
        <Text style={[styles.btnGhostText, { color: theme.textSecondary }]}>Voltar</Text>
      </PressableScale>
      <PressableScale onPress={onContinuar} style={styles.btnPrimaryOuter}>
        <LinearGradient
          colors={[...theme.tokens.gradientPrimaryBtn]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.btnPrimary,
            Platform.OS === 'web'
              ? ({ boxShadow: '0 10px 28px rgba(37, 99, 235, 0.35)' } as object)
              : undefined,
          ]}
        >
          <Maximize2 size={16} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.btnPrimaryText}>Continuar para a prova</Text>
        </LinearGradient>
      </PressableScale>
    </View>
  );

  return (
    <ModernModal
      visible={visible}
      onClose={onClose}
      title="Melhor em tela lateral"
      icon={<RotateCw size={20} color="#FFFFFF" strokeWidth={2.2} />}
      footer={footer}
      maxBodyHeight={480}
    >
      <View style={styles.body}>
        <Animated.View
          style={[
            styles.heroOrb,
            {
              backgroundColor: theme.isDark
                ? 'rgba(56,189,248,0.12)'
                : 'rgba(14,165,233,0.1)',
              borderColor: theme.isDark
                ? 'rgba(56,189,248,0.28)'
                : 'rgba(14,165,233,0.28)',
              transform: [{ scale: pulse }, { translateY: floatY }],
            },
          ]}
        >
          <LinearGradient
            colors={
              theme.isDark
                ? ['rgba(14,165,233,0.35)', 'rgba(37,99,235,0.12)', 'transparent']
                : ['rgba(14,165,233,0.22)', 'rgba(37,99,235,0.08)', 'transparent']
            }
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View style={{ transform: [{ rotate: phoneRotate }] }}>
            <View
              style={[
                styles.phoneFrame,
                {
                  borderColor: theme.isDark ? 'rgba(226,232,240,0.55)' : 'rgba(15,23,42,0.35)',
                  backgroundColor: theme.isDark
                    ? 'rgba(15,23,42,0.85)'
                    : 'rgba(255,255,255,0.92)',
                },
              ]}
            >
              <Smartphone
                size={34}
                color={theme.isDark ? '#E2E8F0' : '#0F172A'}
                strokeWidth={2.1}
              />
            </View>
          </Animated.View>
          <View
            style={[
              styles.rotateBadge,
              {
                backgroundColor: theme.primary,
                borderColor: theme.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.55)',
              },
            ]}
          >
            <RotateCw size={14} color="#FFFFFF" strokeWidth={2.6} />
          </View>
        </Animated.View>

        <Text style={[styles.headline, { color: theme.text }]}>
          Lateralize a tela para acompanhar todos os participantes
        </Text>
        <Text style={[styles.sub, { color: theme.textSecondary }]}>
          Em modo paisagem, a prova ativa organiza os militares em duas colunas — visão ampla do
          cronômetro e da lista ao mesmo tempo.
        </Text>

        <View style={styles.previewRow}>
          <View
            style={[
              styles.previewCol,
              {
                borderColor: theme.border,
                backgroundColor: theme.isDark
                  ? 'rgba(15,23,42,0.55)'
                  : 'rgba(248,250,252,0.95)',
              },
            ]}
          >
            <View style={[styles.previewBar, { backgroundColor: theme.primary }]} />
            <View style={[styles.previewBar, { backgroundColor: theme.primary, opacity: 0.55 }]} />
            <View style={[styles.previewBar, { backgroundColor: theme.primary, opacity: 0.35 }]} />
          </View>
          <View
            style={[
              styles.previewCol,
              {
                borderColor: theme.border,
                backgroundColor: theme.isDark
                  ? 'rgba(15,23,42,0.55)'
                  : 'rgba(248,250,252,0.95)',
              },
            ]}
          >
            <View style={[styles.previewBar, { backgroundColor: theme.primary, opacity: 0.75 }]} />
            <View style={[styles.previewBar, { backgroundColor: theme.primary, opacity: 0.45 }]} />
            <View style={[styles.previewBar, { backgroundColor: theme.primary, opacity: 0.25 }]} />
          </View>
        </View>
      </View>
    </ModernModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14, alignItems: 'center' },
  heroOrb: {
    width: 132,
    height: 132,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 4,
  },
  phoneFrame: {
    width: 64,
    height: 64,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotateBadge: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontWeight: '600',
  },
  previewRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  previewCol: {
    flex: 1,
    gap: 6,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  previewBar: {
    height: 8,
    borderRadius: 999,
  },
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
  btnPrimaryOuter: { flex: 1.35 },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
