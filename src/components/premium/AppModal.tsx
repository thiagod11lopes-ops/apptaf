import React, { useLayoutEffect, useState } from 'react';
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

function readPortalHost(): Element | null {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  return document.getElementById(APP_MODAL_HOST_ID);
}

/** Modal que permanece dentro da tela do tablet no desktop web. */
export function AppModal({ visible, children, ...rest }: ModalProps) {
  const { useTabletFrame } = useDeviceLayout();
  const [portalTarget, setPortalTarget] = useState<Element | null>(() =>
    useTabletFrame ? readPortalHost() : null,
  );

  // useLayoutEffect: resolve o host antes do paint para não “sumir” o modal
  // ao trocar TafProvaTempoModal → rúbrica no mesmo clique.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || !useTabletFrame) {
      setPortalTarget(null);
      return;
    }
    setPortalTarget(readPortalHost());
  }, [useTabletFrame, visible]);

  if (!visible) {
    return null;
  }

  const content = (
    <View style={styles.modalFill} pointerEvents="box-none">
      {children}
    </View>
  );

  const tabletOverlay = (
    <View style={styles.tabletHost} pointerEvents="box-none">
      <View style={styles.tabletLayer} pointerEvents="box-none">
        {content}
      </View>
    </View>
  );

  const host = portalTarget ?? (useTabletFrame ? readPortalHost() : null);
  if (useTabletFrame && Platform.OS === 'web' && host) {
    return portalToHost(tabletOverlay, host);
  }

  // Fallback: Modal nativo (também quando o host do frame ainda não está no DOM).
  return (
    <Modal visible animationType="fade" {...rest}>
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalFill: {
    flex: 1,
    width: '100%',
    height: '100%',
    ...Platform.select({
      web: {
        minHeight: '100%' as unknown as number,
        maxHeight: '100dvh' as unknown as number,
      } as object,
      default: {},
    }),
  },
  tabletHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8000,
    ...Platform.select({
      web: { isolation: 'isolate' } as object,
      default: {},
    }),
  },
  tabletLayer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
