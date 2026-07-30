import React from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../../navigation/types';
import { brasaoSource } from './brandAssets';

type Props = {
  activeRoute: keyof RootStackParamList;
};

const HIDE_ON: (keyof RootStackParamList)[] = ['Login'];

/** Brasão fixo no canto superior direito das páginas. */
export function PageBrasaoBadge({ activeRoute }: Props) {
  const insets = useSafeAreaInsets();

  if (HIDE_ON.includes(activeRoute)) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          top: Math.max(insets.top, 6) + 2,
          right: Math.max(insets.right, 10),
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        source={brasaoSource}
        style={styles.image}
        resizeMode="contain"
        accessibilityLabel="Brasão"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 180,
    width: 56,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
          filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.35))',
        } as object)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.28,
          shadowRadius: 6,
          elevation: 6,
        }),
  },
  image: {
    width: 52,
    height: 64,
  },
});
