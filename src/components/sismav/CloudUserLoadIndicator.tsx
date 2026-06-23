import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useSmoothPercent } from '../../hooks/useSmoothPercent';

type Props = {
  label: string;
  percent: number;
  loading: boolean;
};

export function CloudUserLoadIndicator({ label, percent, loading }: Props) {
  const { theme } = useTheme();
  const smooth = useSmoothPercent(percent, loading);
  const showBar = loading || smooth < 100;
  const isOfflineLabel = label.trim().toLowerCase() === 'offline';

  return (
    <View style={styles.wrap}>
      <Text
        style={[
          styles.label,
          isOfflineLabel && styles.labelOffline,
          {
            color: loading
              ? theme.textMuted
              : isOfflineLabel
                ? theme.loss
                : theme.gain,
            fontWeight: isOfflineLabel ? '900' : '600',
          },
        ]}
      >
        {label}
        {loading ? ` · ${Math.round(smooth)}%` : null}
      </Text>
      {showBar && !isOfflineLabel ? (
        <View style={[styles.track, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.max(0, Math.min(100, smooth))}%`,
                backgroundColor: theme.gain,
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginTop: 4,
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  labelOffline: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  track: {
    width: '72%',
    maxWidth: 220,
    height: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
