import React from 'react';
import { View, Text, StyleSheet, TextInput, Platform } from 'react-native';

const GREEN_BG = '#ecfdf5';
const GREEN_BORDER = '#10b981';
const GREEN_TEXT = '#047857';

type BadgeProps = {
  value: string;
  /** Só exibe se houver valor. */
  compact?: boolean;
};

/** Chip verde do ID ao lado do NIP (prova / cards). */
export function IdMilitarBadge({ value, compact }: BadgeProps) {
  const t = (value || '').trim();
  if (!t) return null;
  return (
    <View
      style={[styles.badge, compact ? styles.badgeCompact : null]}
      accessibilityLabel={`ID ${t}`}
    >
      <Text style={[styles.badgeText, compact ? styles.badgeTextCompact : null]} numberOfLines={1}>
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

/** Campo de cadastro do ID (pré-cadastro). */
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
    maxWidth: 72,
    flexShrink: 0,
  },
  badgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    maxWidth: 56,
  },
  badgeText: {
    color: GREEN_TEXT,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
    ...(Platform.OS === 'web' ? ({ fontVariant: ['tabular-nums'] } as object) : null),
  },
  badgeTextCompact: {
    fontSize: 13,
  },
  inputWrap: {
    width: 64,
    flexShrink: 0,
    gap: 2,
  },
  inputWrapWide: {
    width: '100%',
    gap: 4,
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: GREEN_TEXT,
    letterSpacing: 0.4,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: GREEN_BORDER,
    borderRadius: 12,
    backgroundColor: GREEN_BG,
    color: GREEN_TEXT,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 4,
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none', fontVariant: ['tabular-nums'] } as object)
      : null),
  },
  inputWide: {
    textAlign: 'left',
    paddingHorizontal: 14,
    letterSpacing: 0.3,
  },
});
