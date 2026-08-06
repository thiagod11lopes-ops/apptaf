import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from './types';
import HomeScreen from '../screens/HomeScreen';
import CadastroScreenModern from '../screens/CadastroScreenModern';
import AplicarTAFScreen from '../screens/AplicarTAFScreen';
import ResultadosScreen from '../screens/ResultadosScreen';
import EstatisticasScreen from '../screens/EstatisticasScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Abas principais sempre montadas (lazy: false) — troca de aba sem remount/re-scan.
 * A barra visual continua sendo GlassBottomBar / Sidebar (tabBar oculto).
 */
export function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={() => null}
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        lazy: false,
        freezeOnBlur: false,
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
