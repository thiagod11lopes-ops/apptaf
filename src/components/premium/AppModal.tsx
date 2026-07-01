import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Platform,
  type ModalProps,
} from 'react-native';
import { useDeviceLayout } from '../../hooks/useDeviceLayout';

export const APP_MODAL_HOST_ID = 'app-modal-host';

function portalToHost(node: React.ReactNode, target: Element): React.ReactPortal | null {
  if (Platform.OS !== 'web') return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createPortal } = require('react-dom') as typeof import('react-dom');
  return createPortal(node, target);
}

/** Modal que permanece dentro da tela do tablet no desktop web. */
export function AppModal({ visible, children, ...rest }: ModalProps) {
  const { useTabletFrame } = useDeviceLayout();
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !useTabletFrame) {
      setPortalTarget(null);
      return;
    }
    setPortalTarget(document.getElementById(APP_MODAL_HOST_ID));
  }, [useTabletFrame, visible]);

  if (!visible) {
    return null;
  }

  const tabletOverlay = (
    <View style={styles.tabletHost} pointerEvents="box-none">
      <View style={styles.tabletLayer} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );

  if (useTabletFrame) {
    if (Platform.OS === 'web') {
      if (!portalTarget) return null;
      return portalToHost(tabletOverlay, portalTarget);
    }
    return tabletOverlay;
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
