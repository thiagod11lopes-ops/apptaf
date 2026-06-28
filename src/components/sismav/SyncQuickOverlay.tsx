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

const OUTER = 96;
const LOGO = 56;
const STROKE = 4;
const RADIUS = (OUTER - STROKE) / 2;
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

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  const trackColor = theme.isDark ? 'rgba(148,163,184,0.2)' : 'rgba(148,163,184,0.24)';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop} pointerEvents="none">
        <View style={styles.shell}>
          <Animated.View style={[styles.ringLayer, ringStyle]}>
            <Svg width={OUTER} height={OUTER}>
              <Circle
                cx={OUTER / 2}
                cy={OUTER / 2}
                r={RADIUS}
                stroke={trackColor}
                strokeWidth={STROKE}
                fill="none"
              />
              <Circle
                cx={OUTER / 2}
                cy={OUTER / 2}
                r={RADIUS}
                stroke={theme.primary}
                strokeWidth={STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${ARC_VISIBLE} ${ARC_GAP}`}
                transform={`rotate(-90 ${OUTER / 2} ${OUTER / 2})`}
              />
            </Svg>
          </Animated.View>

          <Animated.View
            style={[
              styles.logoWrap,
              logoStyle,
              Platform.OS === 'web'
                ? ({ filter: 'drop-shadow(0 0 20px rgba(56,189,248,0.35))' } as object)
                : {
                    shadowColor: '#38bdf8',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.45,
                    shadowRadius: 16,
                    elevation: 12,
                  },
            ]}
          >
            <View style={[styles.logoFrame, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Image
                source={logoMb}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel="Marinha do Brasil"
              />
            </View>
          </Animated.View>
        </View>
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
  shell: {
    width: OUTER,
    height: OUTER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: LOGO,
    height: LOGO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFrame: {
    width: LOGO,
    height: LOGO,
    borderRadius: LOGO / 2,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
});
