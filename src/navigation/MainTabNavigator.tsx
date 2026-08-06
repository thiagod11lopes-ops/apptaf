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
 * Abas principais. Lazy padrão (só monta ao visitar) — evita empilhar telas
 * uma sobre a outra no web/PWA. A barra visual continua em GlassBottomBar / Sidebar.
 */
export function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
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
