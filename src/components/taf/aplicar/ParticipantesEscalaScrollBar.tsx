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
import { Minus, Plus, Scaling } from 'lucide-react-native';
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
 * Barra horizontal ultra moderna (estilo scrollbar) para ampliar/reduzir
 * uniformemente os campos dos militares na prova ativa.
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
    return `${Math.round(70 + progress * 60)}%`;
  }, [progress, scaleLabel]);

  const thumbLeft = trackWidth > 0 ? progress * trackWidth : 0;

  return (
    <View
      style={[
        styles.shell,
        {
          borderColor: theme.isDark ? 'rgba(148,163,184,0.28)' : 'rgba(15,23,42,0.1)',
          backgroundColor: theme.isDark ? 'rgba(2,6,23,0.55)' : 'rgba(255,255,255,0.72)',
        },
        Platform.OS === 'web'
          ? ({ boxShadow: '0 8px 24px rgba(15,23,42,0.1)' } as object)
          : {
              shadowColor: '#0f172a',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 10,
              elevation: 3,
            },
      ]}
      accessibilityRole="adjustable"
      accessibilityLabel="Tamanho dos campos dos militares"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      accessibilityHint="Deslize para a esquerda para diminuir ou para a direita para aumentar"
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.iconBadge,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(56,189,248,0.18)'
                  : 'rgba(37,99,235,0.1)',
              },
            ]}
          >
            <Scaling
              size={14}
              color={theme.isDark ? '#7dd3fc' : theme.primary}
              strokeWidth={2.4}
            />
          </View>
          <Text style={[styles.title, { color: theme.textSecondary }]}>Tamanho dos campos</Text>
        </View>
        <Text style={[styles.pct, { color: theme.isDark ? '#67e8f9' : theme.primary }]}>
          {pctLabel}
        </Text>
      </View>

      <View style={styles.trackRow}>
        <Minus size={14} color={theme.textMuted} strokeWidth={2.4} />
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
            <LinearGradient
              colors={['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={[styles.trackSheen, { width: `${thumbPct}%` }]}
            />
          </View>
          <View
            pointerEvents="none"
            style={[
              styles.thumb,
              {
                left: Math.max(0, thumbLeft - 11),
                borderColor: theme.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.95)',
                backgroundColor: theme.isDark ? '#0f172a' : '#ffffff',
              },
              Platform.OS === 'web'
                ? ({
                    boxShadow: '0 4px 14px rgba(37,99,235,0.35), 0 0 0 1px rgba(56,189,248,0.35)',
                  } as object)
                : {
                    shadowColor: '#2563eb',
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.35,
                    shadowRadius: 6,
                    elevation: 5,
                  },
            ]}
          >
            <View style={styles.thumbGrip}>
              <View style={[styles.gripLine, { backgroundColor: theme.primary }]} />
              <View style={[styles.gripLine, { backgroundColor: theme.primary }]} />
              <View style={[styles.gripLine, { backgroundColor: theme.primary }]} />
            </View>
          </View>
        </View>
        <Plus size={14} color={theme.textMuted} strokeWidth={2.4} />
      </View>

      <View style={styles.hintRow}>
        <Text style={[styles.hint, { color: theme.textMuted }]}>← menor</Text>
        <Text style={[styles.hint, { color: theme.textMuted }]}>maior →</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flexShrink: 1,
  },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  pct: {
    fontSize: 12,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackHit: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBase: {
    height: 8,
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
  trackSheen: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 3,
    borderRadius: 999,
  },
  thumb: {
    position: 'absolute',
    top: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbGrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  gripLine: {
    width: 2,
    height: 8,
    borderRadius: 1,
    opacity: 0.85,
  },
  hintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  hint: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
