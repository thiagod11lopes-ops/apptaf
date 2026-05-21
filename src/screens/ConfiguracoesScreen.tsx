import React from 'react';
import { View, Text, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { tw } from '../theme/premium';

export default function ConfiguracoesScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const navigation = useNavigation();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Header title="Configurações" onBack={() => navigation.goBack()} />
      <View className="p-4 gap-3">
        <Card elevated className="p-4">
          <View className="flex-row items-center justify-between min-h-[48px]">
            <View className="flex-1 pr-3">
              <Text className={tw.textTitle}>Aparência</Text>
              <Text className={`${tw.textMuted} mt-1`}>
                {isDark ? 'Escuro OLED · glassmorphism' : 'Claro · minimal'}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#E4E4E7', true: theme.accentMuted }}
              thumbColor={isDark ? theme.primary : '#FAFAFA'}
            />
          </View>
        </Card>
        <Text className={`${tw.textMuted} text-center px-4`}>
          No desktop, o app aparece dentro de um frame de smartphone. No celular, ocupa 100% da tela
          (PWA).
        </Text>
      </View>
    </View>
  );
}
