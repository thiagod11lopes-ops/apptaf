import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../contexts/ThemeContext';

type Props = {
  /** 0 = menor · 1 = maior */
  value: number;
  onChange: (value: number) => void;
  /** Escala efetiva exibida (ex.: 1.05). */
  scaleLabel?: number;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Barra horizontal simples para ampliar/reduzir os campos dos militares.
 * Apenas a trilha + porcentagem à direita.
 */
export function ParticipantesEscalaScrollBar({ value, onChange, scaleLabel }: Props) {
  const { theme } = useTheme();
  const trackWidthRef = useRef(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const draggingRef = useRef(false);

  const progress = clamp01(value);
  const thumbPct = progress * 100;

  const updateFromX = useCallback(
    (locationX: number) => {
      const w = trackWidthRef.current;
      if (w <= 0) return;
      onChange(clamp01(locationX / w));
    },
    [onChange],
  );

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    trackWidthRef.current = w;
    setTrackWidth(w);
  }, []);

  const onGrant = useCallback(
    (e: GestureResponderEvent) => {
      draggingRef.current = true;
      updateFromX(e.nativeEvent.locationX);
    },
    [updateFromX],
  );

  const onMove = useCallback(
    (e: GestureResponderEvent) => {
      if (!draggingRef.current) return;
      updateFromX(e.nativeEvent.locationX);
    },
    [updateFromX],
  );

  const onRelease = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const pctLabel = useMemo(() => {
    if (scaleLabel != null && Number.isFinite(scaleLabel)) {
      return `${Math.round(scaleLabel * 100)}%`;
    }
    return `${Math.round(70 + progress * 65)}%`;
  }, [progress, scaleLabel]);

  const thumbLeft = trackWidth > 0 ? progress * trackWidth : 0;

  return (
    <View
      style={styles.row}
      accessibilityRole="adjustable"
      accessibilityLabel="Tamanho dos campos dos militares"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      accessibilityHint="Deslize para a esquerda para diminuir ou para a direita para aumentar"
    >
      <View
        style={styles.trackHit}
        onLayout={onTrackLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onGrant}
        onResponderMove={onMove}
        onResponderRelease={onRelease}
        onResponderTerminate={onRelease}
      >
        <View
          style={[
            styles.trackBase,
            {
              backgroundColor: theme.isDark
                ? 'rgba(51,65,85,0.85)'
                : 'rgba(226,232,240,0.95)',
            },
          ]}
        >
          <LinearGradient
            colors={['#22d3ee', '#38bdf8', '#6366f1']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.trackFill, { width: `${thumbPct}%` }]}
          />
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              left: Math.max(0, thumbLeft - 9),
              borderColor: theme.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.95)',
              backgroundColor: theme.isDark ? '#0f172a' : '#ffffff',
            },
            Platform.OS === 'web'
              ? ({
                  boxShadow: '0 2px 10px rgba(37,99,235,0.3)',
                } as object)
              : {
                  shadowColor: '#2563eb',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 3,
                },
          ]}
        />
      </View>

      <Text
        style={[
          styles.pct,
          { color: theme.isDark ? '#67e8f9' : theme.primary },
        ]}
      >
        {pctLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
    paddingVertical: 2,
  },
  trackHit: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
    position: 'relative',
    minWidth: 0,
  },
  trackBase: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    width: '100%',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
  },
  thumb: {
    position: 'absolute',
    top: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  pct: {
    fontSize: 12,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    minWidth: 40,
    textAlign: 'right',
    flexShrink: 0,
  },
});
