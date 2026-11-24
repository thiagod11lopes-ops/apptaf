import React from 'react';
import { View, Text, StyleSheet, TextInput, Platform } from 'react-native';

const GREEN_BG = '#ecfdf5';
const GREEN_BORDER = '#10b981';
const GREEN_TEXT = '#047857';

/** Mesmo tamanho tipográfico do input de NIP (`AplicarTafInput`). */
export const ID_MILITAR_FONT_SIZE_NIP_INPUT = 17;

type BadgeProps = {
  value: string;
  /**
   * Fonte do texto — deve ser a mesma do NIP ao lado.
   * Padrão: tamanho do input de NIP na lista.
   */
  fontSize?: number;
};

/** Chip verde do ID ao lado do NIP (prova / cards). */
export function IdMilitarBadge({
  value,
  fontSize = ID_MILITAR_FONT_SIZE_NIP_INPUT,
}: BadgeProps) {
  const t = (value || '').trim();
  if (!t) return null;
  const size = Math.max(9, fontSize);
  const textStyle = [
    styles.badgeText,
    {
      fontSize: size,
      lineHeight: Math.round(size * 1.2),
    },
  ];
  return (
    <View style={styles.badge} accessibilityLabel={`ID ${t}`}>
      <Text style={textStyle} numberOfLines={1}>
        ID
      </Text>
      <Text style={[textStyle, styles.badgeNumber]} numberOfLines={1}>
        {t}
      </Text>
    </View>
  );
}

type InputProps = {
  value: string;
  onChangeText: (text: string) => void;
  editable?: boolean;
  accessibilityLabel?: string;
  /** Campo em linha própria (pré-cadastro) — mais largo e visível. */
  wide?: boolean;
};

/** Campo de cadastro do ID (pré-cadastro) — mesma tipografia/altura do NIP. */
export function IdMilitarInput({
  value,
  onChangeText,
  editable = true,
  accessibilityLabel = 'ID do militar',
  wide = false,
}: InputProps) {
  return (
    <View style={wide ? styles.inputWrapWide : styles.inputWrap}>
      <View
        style={[
          styles.inputRow,
          wide ? styles.inputRowWide : null,
          !editable ? { opacity: 0.75 } : null,
        ]}
      >
        <Text style={styles.inputPrefix} accessibilityElementsHidden>
          ID
        </Text>
        <TextInput
          value={value}
          onChangeText={(t) => onChangeText(t.replace(/[^\dA-Za-z\-_.]/g, '').slice(0, 12))}
          placeholder="opcional"
          placeholderTextColor="#6ee7b7"
          editable={editable}
          keyboardType="default"
          autoCorrect={false}
          spellCheck={false}
          style={[styles.input, wide ? styles.inputWide : null]}
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled: !editable }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: GREEN_BG,
    borderWidth: 1.5,
    borderColor: GREEN_BORDER,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    flexShrink: 0,
    maxWidth: 140,
  },
  badgeText: {
    color: GREEN_TEXT,
    fontWeight: '800',
    letterSpacing: 0.2,
    flexShrink: 0,
    ...(Platform.OS === 'web' ? ({ fontVariant: ['tabular-nums'] } as object) : null),
  },
  badgeNumber: {
    fontWeight: '600',
    flexShrink: 1,
    minWidth: 0,
  },
  inputWrap: {
    width: 120,
    flexShrink: 0,
  },
  inputWrapWide: {
    width: '100%',
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: GREEN_BORDER,
    borderRadius: 14,
    backgroundColor: GREEN_BG,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  inputRowWide: {
    paddingHorizontal: 16,
  },
  inputPrefix: {
    color: GREEN_TEXT,
    fontSize: ID_MILITAR_FONT_SIZE_NIP_INPUT,
    fontWeight: '800',
    letterSpacing: 0.3,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    margin: 0,
    color: GREEN_TEXT,
    fontSize: ID_MILITAR_FONT_SIZE_NIP_INPUT,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'left',
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none', fontVariant: ['tabular-nums'] } as object)
      : null),
  },
  inputWide: {
    textAlign: 'left',
  },
});
