import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Platform,
  type ViewStyle,
  type ScrollViewProps,
} from 'react-native';
import { MobileGlassShell } from './MobileGlassShell';
import { useMobileLayout } from './useMobileLayout';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
};

export function isNativeMobileApp() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/** Padding responsivo; fundo global via AppBackdrop no AppNavigator. */
export function MobileScreenScaffold({
  children,
  scroll = true,
  style,
  contentContainerStyle,
  keyboardShouldPersistTaps = 'handled',
}: Props) {
  const { horizontalPad, scrollBottomPad } = useMobileLayout();

  const padStyle = {
    paddingHorizontal: horizontalPad,
    paddingBottom: scrollBottomPad,
  };

  const inner = scroll ? (
    <ScrollView
      style={[styles.flex, style]}
      contentContainerStyle={[padStyle, contentContainerStyle]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padStyle, contentContainerStyle, style]}>{children}</View>
  );

  return <MobileGlassShell>{inner}</MobileGlassShell>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
