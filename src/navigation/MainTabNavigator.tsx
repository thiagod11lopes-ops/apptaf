import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import type { MainTabParamList } from './types';
import HomeScreen from '../screens/HomeScreen';
import CadastroScreenModern from '../screens/CadastroScreenModern';
import AplicarTAFScreen from '../screens/AplicarTAFScreen';
import ResultadosScreen from '../screens/ResultadosScreen';
import EstatisticasScreen from '../screens/EstatisticasScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * No web, react-native-screens fica desligado por padrão → abas inativas só
 * recebem zIndex:-1 e vazam pelo fundo transparente. Este gate garante
 * display:none + sem conteúdo quando a aba não está focada.
 *
 * Importante: `screenLayout` é prop do Navigator (não de screenOptions).
 */
function TabSceneVisibilityGate({ children }: { children: React.ReactNode }) {
  const focused = useIsFocused();

  if (!focused) {
    return (
      <View
        style={styles.hiddenScene}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        {...(Platform.OS === 'web'
          ? ({ hidden: true, inert: true } as object)
          : null)}
      />
    );
  }

  return <View style={styles.visibleScene}>{children}</View>;
}

/**
 * Abas principais. A barra visual continua em GlassBottomBar / Sidebar.
 */
export function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={() => null}
      detachInactiveScreens
      screenLayout={({ children }) => (
        <TabSceneVisibilityGate>{children}</TabSceneVisibilityGate>
      )}
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
        // Reforço: cena inativa some mesmo se o Screen nativo falhar no web.
        sceneStyle: Platform.OS === 'web' ? styles.sceneWeb : undefined,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Cadastro" component={CadastroScreenModern} />
      <Tab.Screen name="AplicarTAF" component={AplicarTAFScreen} />
      <Tab.Screen name="Resultados" component={ResultadosScreen} />
      <Tab.Screen name="Estatisticas" component={EstatisticasScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  visibleScene: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  hiddenScene: {
    flex: 0,
    height: 0,
    width: 0,
    overflow: 'hidden',
    opacity: 0,
    ...(Platform.OS === 'web' ? ({ display: 'none' } as object) : null),
  },
  sceneWeb: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
