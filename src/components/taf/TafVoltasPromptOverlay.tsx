import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Platform,
  Pressable,
  TouchableOpacity,
  useWindowDimensions,
  type TextInput as TextInputType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RotateCw } from 'lucide-react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import { PREMIUM } from '../../theme/premium';
import type { TafProvaTempoModalProva } from './TafProvaTempoModal';

type Props = {
  visible: boolean;
  prova: Extract<TafProvaTempoModalProva, 'corrida' | 'caminhada'>;
  tituloProva: string;
  numeroVoltas: string;
  onChangeNumeroVoltas: (text: string) => void;
  onConfirm: () => void;
  confirmEnabled: boolean;
};

export function TafVoltasPromptOverlay({
  visible,
  prova,
  tituloProva,
  numeroVoltas,
  onChangeNumeroVoltas,
  onConfirm,
  confirmEnabled,
}: Props) {
  const { theme } = useTheme();
  const ui = getUiColors(theme);
  const { width: screenW } = useWindowDimensions();
  const cardW = Math.min(Math.max(screenW - 40, 280), 360);
  const inputRef = useRef<TextInputType>(null);
  const cardScale = useSharedValue(0.9);
  const cardOpacity = useSharedValue(0);
  const ringSpin = useSharedValue(0);
  const iconPulse = useSharedValue(1);

  useEffect(() => {
    if (!visible) return;
    cardOpacity.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) });
    cardScale.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    ringSpin.value = withRepeat(
      withTiming(360, { duration: 9000, easing: Easing.linear }),
      -1,
      false,
    );
    iconPulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(focusTimer);
  }, [visible, cardOpacity, cardScale, ringSpin, iconPulse]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringSpin.value}deg` }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconPulse.value }],
  }));

  if (!visible) return null;

  const provaLabel = prova === 'caminhada' ? 'Caminhada' : 'Corrida';

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Pressable style={styles.backdrop} accessibilityLabel="Informe o número de voltas" />

      <Animated.View style={[styles.cardWrap, { width: cardW }, cardStyle]}>
        <Animated.View
          style={[
            styles.glowRing,
            {
              width: cardW + 18,
              height: cardW * 0.72,
              borderRadius: (cardW + 18) / 2,
            },
            ringStyle,
            {
              borderTopColor: theme.primary,
              borderRightColor: '#6366f1',
              borderBottomColor: 'rgba(99,102,241,0.15)',
              borderLeftColor: 'rgba(56,189,248,0.2)',
            },
          ]}
        />

        <LinearGradient
          colors={
            theme.isDark
              ? ['rgba(15,23,42,0.98)', 'rgba(30,41,59,0.96)']
              : ['rgba(255,255,255,0.98)', 'rgba(248,250,252,0.96)']
          }
          style={[styles.card, { borderColor: theme.border }]}
        >
          <LinearGradient
            colors={
              theme.isDark
                ? ['rgba(56,189,248,0.22)', 'rgba(99,102,241,0.12)']
                : ['rgba(37,99,235,0.12)', 'rgba(14,165,233,0.08)']
            }
            style={styles.cardHeaderGlow}
          />

          <Animated.View
            style={[
              styles.iconShell,
              iconStyle,
              {
                backgroundColor: theme.isDark ? 'rgba(56,189,248,0.18)' : PREMIUM.accentMuted,
                borderColor: theme.isDark ? 'rgba(56,189,248,0.35)' : 'rgba(37,99,235,0.2)',
              },
            ]}
          >
            <RotateCw size={28} color={theme.primary} strokeWidth={2.4} />
          </Animated.View>

          <Text style={[styles.kicker, { color: theme.textMuted }]}>{provaLabel} preparada</Text>
          <Text style={[styles.title, { color: ui.text }]}>Número de voltas</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Informe quantas voltas serão marcadas na {tituloProva.toLowerCase()} e toque em OK para
            confirmar.
          </Text>

          <View
            style={[
              styles.inputShell,
              {
                borderColor: ui.inputBorder,
                backgroundColor: theme.backgroundSecondary,
              },
            ]}
          >
            <TextInput
              ref={inputRef}
              value={numeroVoltas}
              onChangeText={onChangeNumeroVoltas}
              onSubmitEditing={() => {
                if (confirmEnabled) onConfirm();
              }}
              placeholder="0"
              placeholderTextColor={ui.placeholder}
              keyboardType="number-pad"
              maxLength={4}
              autoFocus
              returnKeyType="done"
              style={[styles.input, { color: ui.text }]}
              autoCorrect={false}
              spellCheck={false}
              accessibilityLabel={
                prova === 'caminhada'
                  ? 'Número de voltas da caminhada'
                  : 'Número de voltas da corrida'
              }
            />
          </View>

          <TouchableOpacity
            accessibilityLabel="Confirmar número de voltas"
            accessibilityState={{ disabled: !confirmEnabled }}
            activeOpacity={0.88}
            onPress={onConfirm}
            disabled={!confirmEnabled}
            style={[styles.okBtnWrap, !confirmEnabled ? styles.okBtnDisabled : null]}
          >
            <LinearGradient
              colors={
                confirmEnabled
                  ? [theme.primary, '#6366f1']
                  : theme.isDark
                    ? ['rgba(51,65,85,0.9)', 'rgba(30,41,59,0.9)']
                    : ['rgba(203,213,225,0.95)', 'rgba(226,232,240,0.95)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.okBtn}
            >
              <Text
                style={[
                  styles.okBtnText,
                  { color: confirmEnabled ? theme.tokens.textOnPrimary : theme.textMuted },
                ]}
              >
                OK
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    elevation: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.52)',
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(10px)' } as object)
      : null),
  },
  cardWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ filter: 'drop-shadow(0 24px 48px rgba(15,23,42,0.28))' } as object)
      : {
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.28,
          shadowRadius: 28,
          elevation: 24,
        }),
  },
  glowRing: {
    position: 'absolute',
    borderWidth: 2,
    opacity: 0.55,
  },
  card: {
    width: '100%',
    borderRadius: PREMIUM.radiusLg,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    overflow: 'hidden',
    gap: 8,
  },
  cardHeaderGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  iconShell: {
    width: 58,
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  inputShell: {
    width: '100%',
    marginTop: 4,
    borderWidth: 1.5,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  input: {
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    paddingVertical: Platform.select({ ios: 12, default: 10 }),
    letterSpacing: 2,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  okBtnWrap: {
    width: '100%',
    marginTop: 6,
    borderRadius: PREMIUM.radiusMd,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 20px rgba(37,99,235,0.28)' } as object)
      : {
          shadowColor: '#2563eb',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.28,
          shadowRadius: 12,
          elevation: 6,
        }),
  },
  okBtnDisabled: {
    ...(Platform.OS === 'web' ? ({ boxShadow: 'none' } as object) : { elevation: 0, shadowOpacity: 0 }),
  },
  okBtn: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: PREMIUM.radiusMd,
  },
  okBtnText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
});
