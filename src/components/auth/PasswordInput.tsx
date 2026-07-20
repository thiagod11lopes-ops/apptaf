import React, { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { PREMIUM } from '../../theme/premium';

type Props = Omit<TextInputProps, 'secureTextEntry'> & {
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

/** Campo de senha com botão de olho para mostrar/ocultar. */
export function PasswordInput({ containerStyle, inputStyle, style, ...rest }: Props) {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <View
      style={[
        styles.wrap,
        {
          borderColor: theme.border,
          backgroundColor: theme.backgroundSecondary,
        },
        containerStyle,
      ]}
    >
      <TextInput
        {...rest}
        style={[styles.input, { color: theme.text }, inputStyle, style]}
        secureTextEntry={!visible}
        autoCapitalize={rest.autoCapitalize ?? 'none'}
        autoCorrect={rest.autoCorrect ?? false}
        placeholderTextColor={rest.placeholderTextColor ?? theme.textMuted}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
        hitSlop={8}
        style={styles.eyeBtn}
      >
        {visible ? (
          <EyeOff size={20} color={theme.textMuted} />
        ) : (
          <Eye size={20} color={theme.textMuted} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingRight: 6,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  eyeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
});
