import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

/** Silhueta de corredor em movimento — estilo stroke moderno alinhado ao Lucide. */
export function CorridaRunnerIcon({
  size = 24,
  color = '#fff',
  strokeWidth = 2.3,
}: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="15.5" cy="4.5" r="2" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M13.5 6.8 L11.2 10.5 L9 14.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M11.2 10.5 L14.8 12.2 L17.5 17"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M11.2 10.5 L8.5 13.2 L6 17.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 14.5 L11.8 18.2 L13.5 21"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3.5 9.5 L5.8 9.5 M2.5 12.5 L5 12.5 M3.5 15.5 L5.8 15.5"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        opacity={0.65}
      />
    </Svg>
  );
}
