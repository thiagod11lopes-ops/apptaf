import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  data: number[];
  width?: number;
  height?: number;
  variant?: 'gain' | 'loss' | 'neutral';
};

export function Sparkline({ data, width = 72, height = 28, variant = 'neutral' }: Props) {
  const { theme } = useTheme();
  const color =
    variant === 'gain'
      ? theme.gain
      : variant === 'loss'
        ? theme.loss
        : theme.isDark
          ? '#FFFFFF'
          : theme.textSecondary;

  if (data.length < 2) {
    return <View style={{ width, height }} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * w;
      const y = pad + h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <View style={[styles.wrap, { width, height }]}>
      <Svg width={width} height={height}>
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    opacity: 0.9,
  },
});
