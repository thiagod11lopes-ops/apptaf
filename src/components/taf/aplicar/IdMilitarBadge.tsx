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
  return (
    <View style={styles.badge} accessibilityLabel={`ID ${t}`}>
      <Text
        style={[
          styles.badgeText,
          {
            fontSize: size,
            lineHeight: Math.round(size * 1.2),
          },
        ]}
        numberOfLines={1}
      >
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
      <Text style={styles.inputLabel}>{wide ? 'ID do militar' : 'ID'}</Text>
      <TextInput
        value={value}
        onChangeText={(t) => onChangeText(t.replace(/[^\dA-Za-z\-_.]/g, '').slice(0, 12))}
        placeholder={wide ? 'id opcional' : 'ID'}
        placeholderTextColor="#6ee7b7"
        editable={editable}
        keyboardType="default"
        autoCorrect={false}
        spellCheck={false}
        style={[
          styles.input,
          wide ? styles.inputWide : null,
          !editable ? { opacity: 0.75 } : null,
        ]}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !editable }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: GREEN_BG,
    borderWidth: 1.5,
    borderColor: GREEN_BORDER,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    flexShrink: 0,
    maxWidth: 120,
  },
  badgeText: {
    color: GREEN_TEXT,
    fontWeight: '600',
    letterSpacing: 0.2,
    ...(Platform.OS === 'web' ? ({ fontVariant: ['tabular-nums'] } as object) : null),
  },
  inputWrap: {
    width: 96,
    flexShrink: 0,
    gap: 2,
  },
  inputWrapWide: {
    width: '100%',
    gap: 4,
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: GREEN_TEXT,
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: GREEN_BORDER,
    borderRadius: 14,
    backgroundColor: GREEN_BG,
    color: GREEN_TEXT,
    fontSize: ID_MILITAR_FONT_SIZE_NIP_INPUT,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none', fontVariant: ['tabular-nums'] } as object)
      : null),
  },
  inputWide: {
    textAlign: 'left',
  },
});
