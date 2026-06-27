import React, { useEffect } from 'react';
import { View, Platform, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDeviceLayout } from '../../hooks/useDeviceLayout';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  children: React.ReactNode;
};

const PHONE_WIDTH = 393;
const PHONE_MAX_HEIGHT = 852;
const OUTER_RADIUS = 54;
const SCREEN_RADIUS = 46;
const BEZEL = 3;
const DESKTOP_BG = '#07070d';

function SideButton({ style }: { style: object }) {
  return (
    <LinearGradient
      colors={['#5c5c62', '#b8b8be', '#7a7a80', '#4a4a50']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.sideButton, style]}
    />
  );
}

function DynamicIsland() {
  return (
    <View style={styles.dynamicIsland} pointerEvents="none">
      <LinearGradient
        colors={['#0a0a0c', '#1a1a1e', '#0a0a0c']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.dynamicIslandPill}
      >
        <View style={styles.cameraLens}>
          <View style={styles.cameraLensInner} />
        </View>
      </LinearGradient>
    </View>
  );
}

function HomeIndicator({ dark }: { dark: boolean }) {
  return (
    <View style={styles.homeIndicatorWrap} pointerEvents="none">
      <View
        style={[
          styles.homeIndicator,
          { backgroundColor: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.28)' },
        ]}
      />
    </View>
  );
}

export function PhoneFrameShell({ children }: Props) {
  const { usePhoneFrame, isWeb } = useDeviceLayout();
  const { isDark, theme } = useTheme();

  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return;
    document.body.style.backgroundColor = usePhoneFrame ? DESKTOP_BG : theme.tokens.bg;
  }, [isDark, isWeb, theme.tokens.bg, usePhoneFrame]);

  if (!usePhoneFrame) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>{children}</View>
    );
  }

  return (
    <View style={styles.desktopOuter}>
      <LinearGradient
        colors={['#0c0c14', '#12121c', '#07070d', '#0a0a12']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.ambientGlow} />
      <View style={styles.ambientGlowSecondary} />

      <View style={styles.phoneAssembly}>
        <SideButton style={styles.buttonMute} />
        <SideButton style={styles.buttonVolumeUp} />
        <SideButton style={styles.buttonVolumeDown} />
        <SideButton style={styles.buttonPower} />

        <View style={styles.phoneShadowLayer} />

        <LinearGradient
          colors={['#6b6b72', '#d4d4da', '#98989e', '#5a5a60', '#b0b0b8', '#727278']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.titaniumChassis}
        >
          <View style={styles.titaniumHighlight} />
          <View style={styles.bezelRing}>
            <View style={[styles.screenClip, { backgroundColor: theme.background }]}>
              <DynamicIsland />
              <ScrollView
                style={styles.screenScroll}
                contentContainerStyle={styles.screenScrollContent}
                showsVerticalScrollIndicator
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                {...(Platform.OS === 'web' ? { className: 'phone-screen-scroll' as never } : {})}
              >
                <View style={styles.screenContent}>{children}</View>
              </ScrollView>
              <HomeIndicator dark={isDark} />
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
  desktopOuter: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? ('100vh' as unknown as number) : undefined,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingVertical: 28,
    paddingHorizontal: 32,
  },
  ambientGlow: {
    position: 'absolute',
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    top: '50%',
    left: '50%',
    marginTop: -260,
    marginLeft: -260,
    ...Platform.select({
      web: { filter: 'blur(80px)' } as object,
      default: {},
    }),
  },
  ambientGlowSecondary: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    top: '42%',
    left: '54%',
    marginTop: -180,
    marginLeft: -180,
    ...Platform.select({
      web: { filter: 'blur(60px)' } as object,
      default: {},
    }),
  },
  phoneAssembly: {
    width: '100%',
    maxWidth: PHONE_WIDTH,
    height: '88%',
    maxHeight: PHONE_MAX_HEIGHT,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneShadowLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: OUTER_RADIUS + 4,
    ...Platform.select({
      web: {
        boxShadow:
          '0 0 0 1px rgba(255,255,255,0.06), 0 32px 80px rgba(0,0,0,0.65), 0 8px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.15)',
      } as object,
      default: { elevation: 32 },
    }),
  },
  titaniumChassis: {
    flex: 1,
    width: '100%',
    borderRadius: OUTER_RADIUS,
    padding: BEZEL + 1,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow:
          'inset 0 2px 4px rgba(255,255,255,0.35), inset 0 -2px 6px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.2)',
      } as object,
      default: {},
    }),
  },
  titaniumHighlight: {
    position: 'absolute',
    top: 8,
    left: 24,
    right: 24,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
    zIndex: 2,
  },
  bezelRing: {
    flex: 1,
    borderRadius: OUTER_RADIUS - BEZEL,
    backgroundColor: '#000000',
    padding: BEZEL,
    overflow: 'hidden',
  },
  screenClip: {
    flex: 1,
    borderRadius: SCREEN_RADIUS,
    overflow: 'hidden',
    position: 'relative',
  },
  screenScroll: {
    flex: 1,
    minHeight: 0,
  },
  screenScrollContent: {
    flexGrow: 1,
  },
  screenContent: {
    flexGrow: 1,
    paddingTop: 52,
    paddingBottom: 28,
  },
  dynamicIsland: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  dynamicIslandPill: {
    width: 126,
    height: 37,
    borderRadius: 20,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 14,
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)' } as object,
      default: {},
    }),
  },
  cameraLens: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0d1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(80,120,200,0.4)',
  },
  cameraLensInner: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#1e3a5f',
  },
  homeIndicatorWrap: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  homeIndicator: {
    width: 134,
    height: 5,
    borderRadius: 3,
  },
  sideButton: {
    position: 'absolute',
    borderRadius: 3,
    zIndex: 5,
    ...Platform.select({
      web: { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 6px rgba(0,0,0,0.4)' } as object,
      default: {},
    }),
  },
  buttonMute: {
    left: -4,
    top: '18%',
    width: 4,
    height: 28,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
  },
  buttonVolumeUp: {
    left: -4,
    top: '28%',
    width: 4,
    height: 46,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
  },
  buttonVolumeDown: {
    left: -4,
    top: '38%',
    width: 4,
    height: 46,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
  },
  buttonPower: {
    right: -4,
    top: '32%',
    width: 4,
    height: 72,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
});
