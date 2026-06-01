import React, { useMemo } from 'react';
import { Text, type TextStyle, type StyleProp } from 'react-native';

type Props = {
  text: string;
  queryLower: string;
  style?: StyleProp<TextStyle>;
  highlightStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

const defaultHighlight: TextStyle = { fontWeight: '900' };

/**
 * Exibe texto com trechos correspondentes à busca em negrito.
 * Suporta busca textual e por dígitos (ex.: NIP com pontuação).
 */
export function SearchHighlightText({
  text,
  queryLower,
  style,
  highlightStyle = defaultHighlight,
  numberOfLines = 1,
}: Props) {
  const nodes = useMemo(() => {
    const value = text || '—';
    const baseStyle = style;
    const q = queryLower.trim();
    if (!q) {
      return (
        <Text style={baseStyle} numberOfLines={numberOfLines}>
          {value}
        </Text>
      );
    }

    const qDigits = q.replace(/\D/g, '');
    const isDigitsOnlyQuery = qDigits.length > 0 && qDigits.length === q.length;

    if (isDigitsOnlyQuery) {
      const digitChars: string[] = [];
      const highlightDigit: boolean[] = [];
      let digitIndex = 0;
      for (let i = 0; i < value.length; i += 1) {
        const ch = value[i];
        if (/\d/.test(ch)) {
          digitChars.push(ch);
          highlightDigit[digitIndex] = false;
          digitIndex += 1;
        }
      }

      const digitString = digitChars.join('');
      let found = false;
      let start = 0;
      while (true) {
        const i = digitString.indexOf(qDigits, start);
        if (i === -1) break;
        found = true;
        for (let d = i; d < i + qDigits.length; d += 1) {
          highlightDigit[d] = true;
        }
        start = i + qDigits.length;
      }

      if (!found) {
        return (
          <Text style={baseStyle} numberOfLines={numberOfLines}>
            {value}
          </Text>
        );
      }

      const parts: React.ReactNode[] = [];
      let buffer = '';
      let bufferBold = false;
      let digitCounter = 0;

      const flush = () => {
        if (!buffer) return;
        parts.push(
          <Text key={`seg_${parts.length}`} style={bufferBold ? highlightStyle : undefined}>
            {buffer}
          </Text>,
        );
        buffer = '';
      };

      for (let i = 0; i < value.length; i += 1) {
        const ch = value[i];
        if (/\d/.test(ch)) {
          const bold = !!highlightDigit[digitCounter];
          digitCounter += 1;
          if (bufferBold !== bold) {
            flush();
            bufferBold = bold;
          }
          buffer += ch;
        } else {
          if (bufferBold) {
            flush();
            bufferBold = false;
          }
          buffer += ch;
        }
      }
      flush();

      return (
        <Text style={baseStyle} numberOfLines={numberOfLines}>
          {parts}
        </Text>
      );
    }

    const valueLower = value.toLowerCase();
    const parts: React.ReactNode[] = [];
    let pos = 0;
    while (true) {
      const i = valueLower.indexOf(q, pos);
      if (i === -1) break;
      if (i > pos) parts.push(<Text key={`t_${pos}`}>{value.slice(pos, i)}</Text>);
      parts.push(
        <Text key={`m_${i}`} style={highlightStyle}>
          {value.slice(i, i + q.length)}
        </Text>,
      );
      pos = i + q.length;
    }
    if (pos < value.length) parts.push(<Text key={`t_${pos}_end`}>{value.slice(pos)}</Text>);

    if (parts.length === 0) {
      return (
        <Text style={baseStyle} numberOfLines={numberOfLines}>
          {value}
        </Text>
      );
    }

    return (
      <Text style={baseStyle} numberOfLines={numberOfLines}>
        {parts}
      </Text>
    );
  }, [text, queryLower, style, highlightStyle, numberOfLines]);

  return nodes;
}
