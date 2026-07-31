import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { PressableScale } from '../premium/PressableScale';
import { AppModal } from '../premium/AppModal';

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
  /** Ocupa toda a tela do dispositivo (sem card flutuante). */
  fullScreen?: boolean;
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
  fullScreen = false,
}: Props) {
  const { theme, isDark } = useTheme();
  const t = theme.tokens;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
  }, [visible]);

  const header = (
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
  );

  const footerBar = footer ? (
    <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.surface }]}>
      {footer}
    </View>
  ) : null;

  if (fullScreen) {
    return (
      <AppModal
        visible={visible}
        transparent={false}
        animationType="slide"
        onRequestClose={dismissable ? onClose : undefined}
        accessibilityViewIsModal
      >
        <KeyboardAvoidingView
          style={[styles.modalRoot, styles.modalRootFull, { backgroundColor: theme.surface }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            style={[
              styles.shellFull,
              {
                backgroundColor: theme.surface,
                paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 12 : 0),
                paddingBottom: Math.max(insets.bottom, 8),
                paddingLeft: insets.left,
                paddingRight: insets.right,
              },
            ]}
          >
            {header}
            <View style={styles.bodyFullWrap}>
              <LinearGradient
                colors={[...t.gradientPanelBody]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <ScrollView
                style={styles.scrollFull}
                contentContainerStyle={styles.scrollContentFull}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
              >
                {children}
              </ScrollView>
            </View>
            {footerBar}
          </View>
        </KeyboardAvoidingView>
      </AppModal>
    );
  }

  return (
    <AppModal
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
              Platform.OS === 'web'
                ? ({ boxShadow: t.shadowModal } as object)
                : { elevation: 16 },
            ]}
          >
            {header}
            <LinearGradient
              colors={[...t.gradientPanelBody]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={[styles.body, { maxHeight: maxBodyHeight }]}
            >
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {children}
              </ScrollView>
            </LinearGradient>
            {footerBar}
          </View>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        minHeight: '100%' as unknown as number,
        maxHeight: '100dvh' as unknown as number,
      } as object,
      default: {},
    }),
  },
  modalRootFull: {
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  shell: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '100%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  shellFull: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    alignSelf: 'stretch',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    flexShrink: 0,
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
  /** Área rolável entre header e footer — não pode “crescer” por cima dos botões. */
  bodyFullWrap: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  scrollFull: {
    flex: 1,
    minHeight: 0,
  },
  scrollContentFull: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
  },
});
