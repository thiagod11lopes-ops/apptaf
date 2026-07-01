import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Platform,
  type ModalProps,
} from 'react-native';
import { useDeviceLayout } from '../../hooks/useDeviceLayout';

/** Modal que permanece dentro da tela do tablet no desktop web. */
export function AppModal({ visible, children, ...rest }: ModalProps) {
  const { useTabletFrame } = useDeviceLayout();

  if (!visible) {
    return null;
  }

  if (useTabletFrame) {
    return (
      <View style={styles.tabletHost} pointerEvents="box-none">
        <View style={styles.tabletLayer} pointerEvents="box-none">
          {children}
        </View>
      </View>
    );
  }

  return (
    <Modal visible animationType="fade" {...rest}>
      {children}
    </Modal>
  );
}

const styles = StyleSheet.create({
  tabletHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8000,
    ...Platform.select({
      web: { isolation: 'isolate' } as object,
      default: { elevation: 80 },
    }),
  },
  tabletLayer: {
    flex: 1,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
});
