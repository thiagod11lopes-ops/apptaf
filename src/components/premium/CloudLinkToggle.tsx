import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Cloud, CloudOff } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  /** Rótulo curto ao lado (opcional). */
  showLabel?: boolean;
};

/**
 * Interruptor ultra-moderno: liga/desliga conexão com a nuvem.
 */
export function CloudLinkToggle({
  value,
  onValueChange,
  disabled = false,
  showLabel = true,
}: Props) {
  const { theme } = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0,
      friction: 7,
      tension: 80,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const trackBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(220, 38, 38, 0.22)', 'rgba(16, 185, 129, 0.35)'],
  });
  const thumbX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 28],
  });
  const glow = value ? 'rgba(16, 185, 129, 0.55)' : 'rgba(220, 38, 38, 0.45)';
  const accent = value ? theme.gain : theme.loss;

  return (
    <View style={styles.wrap} accessibilityRole="switch" accessibilityState={{ checked: value, disabled }}>
      {showLabel ? (
        <Text style={[styles.label, { color: theme.textMuted }]}>
          {value ? 'Nuvem' : 'Local'}
        </Text>
      ) : null}
      <Pressable
        onPress={() => {
          if (!disabled) onValueChange(!value);
        }}
        disabled={disabled}
        style={({ pressed }) => [
          styles.hit,
          { opacity: disabled ? 0.45 : pressed ? 0.88 : 1 },
        ]}
        accessibilityLabel={
          value ? 'Desligar conexão com a nuvem' : 'Ligar conexão com a nuvem'
        }
      >
        <Animated.View
          style={[
            styles.track,
            {
              backgroundColor: trackBg,
              borderColor: accent,
              ...(Platform.OS === 'web'
                ? ({ boxShadow: `0 0 18px ${glow}` } as object)
                : { elevation: 4 }),
            },
          ]}
        >
          <View style={styles.iconLeft}>
            <CloudOff size={12} color={value ? 'rgba(255,255,255,0.35)' : accent} strokeWidth={2.4} />
          </View>
          <View style={styles.iconRight}>
            <Cloud size={12} color={value ? accent : 'rgba(255,255,255,0.35)'} strokeWidth={2.4} />
          </View>
          <Animated.View
            style={[
              styles.thumb,
              {
                transform: [{ translateX: thumbX }],
                backgroundColor: theme.isDark ? '#0B1220' : '#FFFFFF',
                borderColor: accent,
                ...(Platform.OS === 'web'
                  ? ({ boxShadow: `0 2px 10px ${glow}` } as object)
                  : { elevation: 6 }),
              },
            ]}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  hit: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  track: {
    width: 56,
    height: 28,
    borderRadius: 999,
    borderWidth: 1.5,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  iconLeft: {
    position: 'absolute',
    left: 7,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  iconRight: {
    position: 'absolute',
    right: 7,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
