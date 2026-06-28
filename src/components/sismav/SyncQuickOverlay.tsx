import React, { useEffect } from 'react';
import { Modal, StyleSheet, View, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  visible: boolean;
};

const RING = 72;
const CORE = 48;

export function SyncQuickOverlay({ visible }: Props) {
  const { theme } = useTheme();
  const spin = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!visible) return;
    spin.value = 0;
    spin.value = withRepeat(
      withTiming(360, { duration: 1200, easing: Easing.linear }),
      -1,
      false,
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.96, { duration: 600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [visible, spin, pulse]);

  const shellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop} pointerEvents="none">
        <Animated.View style={[styles.shell, shellStyle]}>
          <Animated.View
            style={[
              styles.ring,
              ringStyle,
              {
                borderTopColor: theme.primary,
                borderRightColor: '#6366f1',
                borderBottomColor: 'rgba(99,102,241,0.2)',
                borderLeftColor: 'rgba(56,189,248,0.25)',
              },
            ]}
          />
          <View style={[styles.core, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <LinearGradient
              colors={
                theme.isDark
                  ? ['rgba(56,189,248,0.4)', 'rgba(99,102,241,0.25)']
                  : ['rgba(37,99,235,0.2)', 'rgba(14,165,233,0.14)']
              }
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.orbit, { backgroundColor: theme.primary }]} />
            <View style={[styles.orbit, styles.orbitB, { backgroundColor: '#6366f1' }]} />
            <View style={[styles.orbit, styles.orbitC, { backgroundColor: '#38bdf8' }]} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(12px)' } as object)
      : null),
  },
  shell: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ filter: 'drop-shadow(0 0 24px rgba(56,189,248,0.45))' } as object)
      : {
          shadowColor: '#38bdf8',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 18,
          elevation: 16,
        }),
  },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 4,
  },
  core: {
    width: CORE,
    height: CORE,
    borderRadius: CORE / 2,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbit: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    top: 12,
    left: 14,
  },
  orbitB: {
    top: 22,
    left: 26,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.85,
  },
  orbitC: {
    top: 16,
    left: 30,
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.65,
  },
});
