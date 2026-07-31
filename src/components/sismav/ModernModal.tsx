import React, { useEffect } from 'react';
import {
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

  return (
    <AppModal
      visible={visible}
      transparent={!fullScreen}
      animationType={fullScreen ? 'slide' : 'fade'}
      onRequestClose={dismissable ? onClose : undefined}
      accessibilityViewIsModal
    >
      <View
        style={[
          styles.modalRoot,
          fullScreen ? styles.modalRootFull : null,
          fullScreen ? { backgroundColor: theme.surface } : null,
        ]}
      >
        {!fullScreen ? (
          <Pressable
            style={[styles.overlay, { backgroundColor: t.overlayBg }]}
            onPress={dismissable ? onClose : undefined}
          >
            {Platform.OS === 'ios' ? (
              <BlurView intensity={24} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            ) : null}
          </Pressable>
        ) : null}
        <View
          style={
            fullScreen
              ? [
                  styles.shellFull,
                  { backgroundColor: theme.surface },
                  {
                    paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 12 : 0),
                    paddingBottom: Math.max(insets.bottom, 8),
                    paddingLeft: insets.left,
                    paddingRight: insets.right,
                  },
                ]
              : [styles.center]
          }
          pointerEvents="box-none"
        >
          <View
            style={
              fullScreen
                ? styles.shellInnerFull
                : [
                    styles.shell,
                    { backgroundColor: theme.surface },
                    Platform.OS === 'web'
                      ? ({ boxShadow: t.shadowModal } as object)
                      : { elevation: 16 },
                  ]
            }
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
              style={[
                styles.body,
                fullScreen ? styles.bodyFull : { maxHeight: maxBodyHeight },
              ]}
            >
              <ScrollView
                style={fullScreen ? styles.scrollFull : undefined}
                contentContainerStyle={fullScreen ? styles.scrollContentFull : undefined}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
            </LinearGradient>
            {footer ? (
              <View style={[styles.footer, { borderTopColor: theme.border }]}>{footer}</View>
            ) : null}
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
    height: '100%',
    alignSelf: 'stretch',
  },
  shellInnerFull: {
    flex: 1,
    width: '100%',
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
  bodyFull: {
    flex: 1,
    maxHeight: undefined,
    minHeight: 0,
  },
  scrollFull: {
    flex: 1,
  },
  scrollContentFull: {
    flexGrow: 1,
    paddingBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
