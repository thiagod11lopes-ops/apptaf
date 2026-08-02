import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  /** Identificação do banco exibida dentro da chave (ex.: BNC 001). */
  bankLabel: string;
};

const TRACK_W = 92;
const THUMB_W = 58;
const THUMB_H = 24;
const TRACK_H = 30;
const PAD = 3;

/**
 * Interruptor: liga/desliga nuvem; o polegar mostra o código do banco.
 */
export function CloudLinkToggle({
  value,
  onValueChange,
  disabled = false,
  bankLabel,
}: Props) {
  const { theme } = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  const label = (bankLabel || 'BNC').trim() || 'BNC';

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
    outputRange: [PAD, TRACK_W - THUMB_W - PAD],
  });
  const glow = value ? 'rgba(16, 185, 129, 0.55)' : 'rgba(220, 38, 38, 0.45)';
  const accent = value ? theme.gain : theme.loss;

  return (
    <View accessibilityRole="switch" accessibilityState={{ checked: value, disabled }}>
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
          value
            ? `Desligar nuvem. Banco ${label}`
            : `Ligar nuvem. Banco ${label}`
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
          >
            <Text
              style={[styles.bankInThumb, { color: accent }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {label}
            </Text>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hit: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: 999,
    borderWidth: 1.5,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bankInThumb: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
});
