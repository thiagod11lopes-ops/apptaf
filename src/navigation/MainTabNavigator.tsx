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
 * Item 1 — keep-alive das abas:
 * - Mantém `{children}` montados (estado, caches e prova ativa preservados).
 * - Aba sem foco: display:none / hidden (não empilha no fundo transparente).
 *
 * `screenLayout` deve ser prop do Navigator (não de screenOptions).
 * No web, App.tsx liga `enableScreens(true)` para o Screen.web também usar display:none.
 */
function TabSceneVisibilityGate({ children }: { children: React.ReactNode }) {
  const focused = useIsFocused();

  return (
    <View
      style={[styles.scene, focused ? null : styles.sceneHidden]}
      pointerEvents={focused ? 'auto' : 'none'}
      accessibilityElementsHidden={!focused}
      importantForAccessibility={focused ? 'auto' : 'no-hide-descendants'}
      collapsable={false}
      {...(Platform.OS === 'web' && !focused
        ? ({ hidden: true, inert: true, 'aria-hidden': true } as object)
        : null)}
    >
      {children}
    </View>
  );
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
        /** Primeira visita monta; depois a aba permanece viva (gate não desmonta). */
        lazy: true,
        freezeOnBlur: true,
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
  scene: {
    flex: 1,
  },
  sceneHidden: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
    overflow: 'hidden',
    zIndex: -1,
    ...(Platform.OS === 'web'
      ? ({ display: 'none', visibility: 'hidden' } as object)
      : null),
  },
});
