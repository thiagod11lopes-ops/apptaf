import React, { useEffect } from 'react';
import { Modal, StyleSheet, View, Platform, Image } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
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

const logoMb = require('../../../Logomb.png');

const LOGO = 448;
const STROKE = 5;
/** Anel ~80% do quadro da logo — colado ao contorno visível da imagem. */
const RING_DIAMETER = LOGO * 0.8;
const RING_SIZE = LOGO;
const RADIUS = RING_DIAMETER / 2 - STROKE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_VISIBLE = CIRCUMFERENCE * 0.28;
const ARC_GAP = CIRCUMFERENCE - ARC_VISIBLE;

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
        withTiming(1.16, { duration: 650, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.88, { duration: 650, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [visible, spin, pulse]);

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  const trackColor = theme.isDark ? 'rgba(148,163,184,0.22)' : 'rgba(148,163,184,0.26)';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop} pointerEvents="none">
        <Animated.View
          style={[
            styles.core,
            coreStyle,
            Platform.OS === 'web'
              ? ({ filter: 'drop-shadow(0 0 28px rgba(56,189,248,0.35))' } as object)
              : {
                  shadowColor: '#38bdf8',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.45,
                  shadowRadius: 24,
                  elevation: 12,
                },
          ]}
        >
          <Animated.View style={[styles.ringLayer, ringStyle]} pointerEvents="none">
            <Svg width={RING_SIZE} height={RING_SIZE}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                stroke={trackColor}
                strokeWidth={STROKE}
                fill="none"
              />
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                stroke={theme.primary}
                strokeWidth={STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${ARC_VISIBLE} ${ARC_GAP}`}
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            </Svg>
          </Animated.View>

          <Image
            source={logoMb}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Marinha do Brasil"
          />
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
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(14px)' } as object)
      : null),
  },
  core: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  logo: {
    width: LOGO,
    height: LOGO,
  },
});
