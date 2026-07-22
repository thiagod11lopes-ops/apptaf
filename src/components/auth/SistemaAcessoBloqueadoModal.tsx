import React, { useEffect, useRef } from 'react';
import {
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
import { ShieldBan, MailWarning } from 'lucide-react-native';
import { AppModal } from '../premium/AppModal';
import { PressableScale } from '../premium/PressableScale';
import { useTheme } from '../../contexts/ThemeContext';
import {
  SYSTEM_ACCESS_BLOCKED_MESSAGE,
  SYSTEM_EMAIL_UNREGISTERED_MESSAGE,
} from '../../services/supabase/systemAccessGate';
import { PREMIUM } from '../../theme/premium';

export type SistemaAcessoModalVariant = 'denied' | 'unregistered';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** denied = Criar conta (vermelho). unregistered = Entrar (laranja). */
  variant?: SistemaAcessoModalVariant;
  /** Texto do botão principal (padrão conforme a variante). */
  actionLabel?: string;
  onAction?: () => void;
};

const VARIANT_UI = {
  denied: {
    kicker: 'ACESSO NEGADO',
    message: SYSTEM_ACCESS_BLOCKED_MESSAGE,
    colors: ['#7f1d1d', '#dc2626', '#9f1239'] as const,
    shadow: '0 28px 64px rgba(127, 29, 29, 0.45)',
    actionDefault: 'Entendi',
    Icon: ShieldBan,
    btnTextLight: '#7f1d1d',
  },
  unregistered: {
    kicker: 'EMAIL NÃO CADASTRADO',
    message: SYSTEM_EMAIL_UNREGISTERED_MESSAGE,
    colors: ['#9a3412', '#ea580c', '#c2410c'] as const,
    shadow: '0 28px 64px rgba(154, 52, 18, 0.45)',
    actionDefault: 'Criar conta',
    Icon: MailWarning,
    btnTextLight: '#9a3412',
  },
} as const;

/** Modal de bloqueio / e-mail não cadastrado — visual forte, animações suaves. */
export function SistemaAcessoBloqueadoModal({
  visible,
  onClose,
  variant = 'denied',
  actionLabel,
  onAction,
}: Props) {
  const { theme, isDark } = useTheme();
  const scale = useRef(new Animated.Value(0.86)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const ui = VARIANT_UI[variant];
  const Icon = ui.Icon;

  useEffect(() => {
    if (!visible) {
      scale.setValue(0.86);
      opacity.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 84,
        useNativeDriver: true,
      }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, opacity, pulse, scale]);

  if (!visible) return null;

  const handleAction = () => {
    if (onAction) onAction();
    else onClose();
  };

  return (
    <AppModal visible transparent animationType="fade" onRequestClose={onClose} accessibilityViewIsModal>
      <View style={styles.root}>
        <Pressable style={styles.overlayPress} onPress={onClose}>
          <Animated.View style={[styles.overlay, { opacity }]}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={28} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            ) : null}
            <View style={[styles.overlayTint, { backgroundColor: 'rgba(15, 23, 42, 0.62)' }]} />
          </Animated.View>
        </Pressable>

        <Animated.View
          style={[
            styles.cardWrap,
            {
              opacity,
              transform: [{ scale }],
            },
          ]}
          pointerEvents="box-none"
        >
          <LinearGradient
            colors={[...ui.colors]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.card,
              Platform.OS === 'web'
                ? ({ boxShadow: ui.shadow } as object)
                : { elevation: 24 },
            ]}
          >
            <View style={styles.glowRing} />
            <Animated.View style={[styles.iconHalo, { transform: [{ scale: pulse }] }]}>
              <View style={styles.iconInner}>
                <Icon size={36} color="#FFFFFF" strokeWidth={2.2} />
              </View>
            </Animated.View>

            <Text style={styles.kicker}>{ui.kicker}</Text>
            <Text style={styles.title}>{ui.message}</Text>

            <PressableScale onPress={handleAction} style={styles.btnOuter}>
              <View
                style={[
                  styles.btn,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : '#FFFFFF',
                    borderColor: 'rgba(255,255,255,0.35)',
                  },
                ]}
              >
                <Text style={[styles.btnText, { color: isDark ? '#FFFFFF' : ui.btnTextLight }]}>
                  {actionLabel ?? ui.actionDefault}
                </Text>
              </View>
            </PressableScale>

            <Text style={[styles.footerHint, { color: 'rgba(255,255,255,0.72)' }]}>
              Conta · e-mail institucional @marinha.mil.br
            </Text>
          </LinearGradient>
        </Animated.View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  overlayPress: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTint: {
    ...StyleSheet.absoluteFillObject,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 420,
    zIndex: 2,
  },
  card: {
    borderRadius: PREMIUM.radiusLg + 6,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  glowRing: {
    position: 'absolute',
    top: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  iconHalo: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  iconInner: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.4,
    marginBottom: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 28,
    letterSpacing: 0.2,
  },
  btnOuter: {
    width: '100%',
    marginTop: 22,
  },
  btn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  footerHint: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
