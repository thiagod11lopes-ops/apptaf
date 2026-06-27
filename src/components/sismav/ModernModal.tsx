import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { PressableScale } from '../premium/PressableScale';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  icon?: React.ReactNode;
  /** Quando false, overlay e botão X não fecham o modal. */
  dismissable?: boolean;
  maxBodyHeight?: number;
};

export function ModernModal({
  visible,
  onClose,
  title,
  children,
  footer,
  icon,
  dismissable = true,
  maxBodyHeight = 420,
}: Props) {
  const { theme, isDark } = useTheme();
  const t = theme.tokens;

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismissable ? onClose : undefined}
      accessibilityViewIsModal
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={[styles.overlay, { backgroundColor: t.overlayBg }]}
          onPress={dismissable ? onClose : undefined}
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={24} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : null}
        </Pressable>
        <View style={styles.center} pointerEvents="box-none">
        <View
          style={[
            styles.shell,
            { backgroundColor: theme.surface },
            Platform.OS === 'web' ? ({ boxShadow: t.shadowModal } as object) : { elevation: 16 },
          ]}
        >
          <LinearGradient
            colors={[...t.gradientHeader]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            {icon ? <View style={styles.iconBox}>{icon}</View> : null}
            <Text style={styles.headerTitle}>{title}</Text>
            {dismissable ? (
              <PressableScale onPress={onClose} style={styles.closeBtn} accessibilityLabel="Fechar">
                <X size={18} color="#FFFFFF" strokeWidth={2.5} />
              </PressableScale>
            ) : (
              <View style={styles.closeBtn} />
            )}
          </LinearGradient>
          <LinearGradient
            colors={[...t.gradientPanelBody]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[styles.body, { maxHeight: maxBodyHeight }]}
          >
            <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
          </LinearGradient>
          {footer ? (
            <View style={[styles.footer, { borderTopColor: theme.border }]}>{footer}</View>
          ) : null}
        </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  shell: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    maxHeight: 420,
    padding: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
