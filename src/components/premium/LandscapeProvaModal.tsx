import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { PREMIUM } from '../../theme/premium';
import { LandscapeProvaButton } from './LandscapeProvaButton';

type Props = {
  visible: boolean;
  tituloProva: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function LandscapeProvaModal({
  visible,
  tituloProva,
  loading,
  onConfirm,
  onCancel,
}: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <View
        style={[
          styles.overlay,
          { backgroundColor: theme.isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.45)' },
        ]}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.border,
            },
          ]}
        >
          <LandscapeProvaButton
            tituloProva={tituloProva}
            loading={loading}
            onPress={onConfirm}
          />
          <TouchableOpacity
            accessibilityLabel="Cancelar modo paisagem"
            onPress={onCancel}
            disabled={loading}
            style={styles.cancelBtn}
          >
            <Text style={[ts.caption, { color: theme.textSecondary }]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: PREMIUM.radiusXl,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
});
