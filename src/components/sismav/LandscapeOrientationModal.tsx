import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Platform,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Smartphone, RotateCw } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { PressableScale } from '../premium/PressableScale';
import { useDeviceLayout } from '../../hooks/useDeviceLayout';

type Props = {
  visible: boolean;
  onContinue: () => void;
  onClose?: () => void;
};

export function LandscapeOrientationModal({ visible, onContinue, onClose }: Props) {
  const { theme, isDark } = useTheme();
  const t = theme.tokens;
  const { isLandscape } = useDeviceLayout();
  const pulse = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      fade.setValue(0);
      return;
    }
    Animated.timing(fade, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    const spin = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 2800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spin.start();

    return () => {
      loop.stop();
      spin.stop();
    };
  }, [visible, fade, pulse, rotate]);

  useEffect(() => {
    if (visible && isLandscape) {
      onContinue();
    }
  }, [visible, isLandscape, onContinue]);

  const phoneRotate = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const glowScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.75],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Animated.View style={[styles.root, { opacity: fade }]}>
        <Pressable
          style={[styles.overlay, { backgroundColor: t.overlayBg }]}
          onPress={onClose}
          accessibilityLabel="Fechar"
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={28} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : null}
        </Pressable>

        <View style={styles.center} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.shell,
              Platform.OS === 'web' ? ({ boxShadow: t.shadowModal } as object) : { elevation: 24 },
            ]}
          >
            <LinearGradient
              colors={[...t.gradientHeader]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerBand}
            >
              <View style={styles.headerIconRow}>
                <RotateCw size={20} color="rgba(255,255,255,0.85)" strokeWidth={2.2} />
                <Text style={styles.headerEyebrow}>Melhor experiência</Text>
              </View>
            </LinearGradient>

            <LinearGradient
              colors={[...t.gradientPanelBody]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.body}
            >
              <View style={styles.illustrationWrap}>
                <Animated.View
                  style={[
                    styles.glowRing,
                    {
                      opacity: glowOpacity,
                      transform: [{ scale: glowScale }],
                      borderColor: t.primary300,
                    },
                  ]}
                />
                <Animated.View style={{ transform: [{ rotate: phoneRotate }] }}>
                  <View style={[styles.phoneFrame, { borderColor: t.primary600 }]}>
                    <Smartphone size={42} color={t.primary600} strokeWidth={1.8} />
                  </View>
                </Animated.View>
              </View>

              <Text style={[styles.title, { color: theme.text }]}>Gire o celular</Text>
              <Text style={[styles.message, { color: theme.textMuted }]}>
                Para aplicar o TAF com conforto, deixe o aparelho na posição{' '}
                <Text style={{ color: t.primary600, fontWeight: '700' }}>horizontal (deitado)</Text>.
                O menu lateral será ocultado automaticamente nessa orientação.
              </Text>

              {isLandscape ? (
                <View style={[styles.readyBadge, { backgroundColor: theme.gainMuted }]}>
                  <Text style={[styles.readyText, { color: theme.success }]}>
                    Orientação detectada — pronto para continuar
                  </Text>
                </View>
              ) : (
                <Text style={[styles.hint, { color: theme.textMuted }]}>
                  Gire o dispositivo e toque em continuar
                </Text>
              )}

              <PressableScale onPress={onContinue} style={styles.ctaOuter}>
                <LinearGradient
                  colors={[...t.gradientPrimaryBtn]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.cta,
                    Platform.OS === 'web'
                      ? ({ boxShadow: '0 8px 20px rgba(37, 99, 235, 0.4)' } as object)
                      : undefined,
                  ]}
                >
                  <Text style={styles.ctaText}>
                    {isLandscape ? 'Continuar' : 'Entendi, vou girar o celular'}
                  </Text>
                </LinearGradient>
              </PressableScale>
            </LinearGradient>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  shell: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
  },
  headerBand: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerEyebrow: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  body: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 22,
    alignItems: 'center',
  },
  illustrationWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  glowRing: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 2,
  },
  phoneFrame: {
    width: 72,
    height: 72,
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 14,
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 18,
    fontStyle: 'italic',
  },
  readyBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  readyText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  ctaOuter: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  cta: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderRadius: 14,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
