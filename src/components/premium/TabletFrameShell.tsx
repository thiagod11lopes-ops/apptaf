import React, { useEffect } from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDeviceLayout, computeTabletFrameSize } from '../../hooks/useDeviceLayout';
import { useTheme } from '../../contexts/ThemeContext';
import { AppBackdrop } from '../mobile/AppBackdrop';
import { DesktopTabletBackdrop } from './DesktopTabletBackdrop';

type Props = {
  children: React.ReactNode;
};

const OUTER_RADIUS = 36;
const SCREEN_RADIUS = 22;
const BEZEL = 14;
const CHASSIS_PAD = 3;
const DESKTOP_BG = '#07070d';

function TabletCamera() {
  return (
    <View style={styles.cameraRow} pointerEvents="none">
      <View style={styles.cameraDot} />
    </View>
  );
}

export function TabletFrameShell({ children }: Props) {
  const { useTabletFrame, isWeb, width, height } = useDeviceLayout();
  const { isDark, theme } = useTheme();

  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return;
    document.body.style.backgroundColor = useTabletFrame ? DESKTOP_BG : theme.tokens.bg;
  }, [isDark, isWeb, theme.tokens.bg, useTabletFrame]);

  if (!useTabletFrame) {
    return (
      <View style={styles.fill}>
        <AppBackdrop />
        <View style={[styles.fill, styles.fillAboveBackdrop]}>{children}</View>
      </View>
    );
  }

  const frameSize = computeTabletFrameSize(width, height);

  return (
    <View style={styles.desktopOuter}>
      <DesktopTabletBackdrop />

      <View style={[styles.tabletAssembly, frameSize]}>
        <View style={styles.tabletShadowLayer} />

        <LinearGradient
          colors={['#5a5a60', '#c8c8ce', '#8e8e94', '#4a4a50', '#a8a8ae', '#6e6e74']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.tabletChassis}
        >
          <View style={styles.chassisHighlight} />
          <View style={styles.bezelRing}>
            <View style={[styles.screenClip, { backgroundColor: 'transparent' }]}>
              <AppBackdrop />
              <TabletCamera />
              <View style={styles.screenContent}>{children}</View>
            </View>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: Platform.OS === 'web' ? ('100vh' as unknown as number) : undefined,
  },
  fillAboveBackdrop: {
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  desktopOuter: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? ('100vh' as unknown as number) : undefined,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingVertical: 24,
    paddingHorizontal: 28,
    position: 'relative',
  },
  tabletAssembly: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  tabletShadowLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: OUTER_RADIUS + 6,
    ...Platform.select({
      web: {
        boxShadow:
          '0 0 0 1px rgba(255,255,255,0.05), 0 40px 100px rgba(0,0,0,0.62), 0 12px 32px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.12)',
      } as object,
      default: { elevation: 28 },
    }),
  },
  tabletChassis: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: OUTER_RADIUS,
    padding: CHASSIS_PAD + 1,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow:
          'inset 0 2px 5px rgba(255,255,255,0.32), inset 0 -3px 8px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.18)',
      } as object,
      default: {},
    }),
  },
  chassisHighlight: {
    position: 'absolute',
    top: 10,
    left: 32,
    right: 32,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
    zIndex: 2,
  },
  bezelRing: {
    flex: 1,
    borderRadius: OUTER_RADIUS - CHASSIS_PAD,
    backgroundColor: '#0a0a0c',
    padding: BEZEL,
    overflow: 'hidden',
  },
  screenClip: {
    flex: 1,
    borderRadius: SCREEN_RADIUS,
    overflow: 'hidden',
    position: 'relative',
  },
  screenContent: {
    flex: 1,
    minHeight: 0,
    zIndex: 1,
  },
  cameraRow: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  cameraDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#121218',
    borderWidth: 1,
    borderColor: 'rgba(120,120,130,0.55)',
    ...Platform.select({
      web: { boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)' } as object,
      default: {},
    }),
  },
});
