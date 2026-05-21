import React, { useCallback } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { Menu } from '../components/Menu';
import { Card } from '../components/Card';
import { PressableScale } from '../components/premium/PressableScale';
import { tw } from '../theme/premium';
import { FileText, ChevronRight } from 'lucide-react-native';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();

  useFocusEffect(useCallback(() => {}, []));

  const goTo = useCallback(
    (screen: keyof RootStackParamList) => {
      navigation.navigate(screen as never);
    },
    [navigation],
  );

  const quickLinks = [
    {
      id: 'normas',
      title: 'Normas',
      subtitle: 'CGCFN-108 · busca integrada',
      onPress: () => goTo('Normas'),
    },
    {
      id: 'registro',
      title: 'Registrador de TAF',
      subtitle: 'Histórico e filtros',
      onPress: () => goTo('AplicacaoTAF'),
    },
  ];

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-black select-none-touch"
      contentContainerClassName="px-5 pt-6 pb-8"
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-8">
        <View className="self-start px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-4">
          <Text className="text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold tracking-wider uppercase">
            Premium · PWA
          </Text>
        </View>
        <Text className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          TAF
        </Text>
        <Text className={`${tw.textMuted} mt-1 text-base`}>
          Teste de Aptidão Física
        </Text>
      </View>

      <PressableScale onPress={() => goTo('AplicarTAF')} className="mb-6">
        <Card className="p-5 border-indigo-500/20 dark:border-indigo-400/25">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-xl font-bold text-zinc-900 dark:text-white">Aplicar TAF</Text>
              <Text className={`${tw.textMuted} mt-1`}>
                Corrida · Natação · Permanência
              </Text>
            </View>
            <View className="min-h-[48px] min-w-[48px] rounded-2xl bg-indigo-600 dark:bg-indigo-500 items-center justify-center shadow-md">
              <ChevronRight size={22} color="#FFF" strokeWidth={2.5} />
            </View>
          </View>
        </Card>
      </PressableScale>

      <Text className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-3">
        Acesso rápido
      </Text>
      <Menu options={quickLinks} />

      <PressableScale
        onPress={() => goTo('Cadastro')}
        className={`${tw.glassCard} mt-3 flex-row items-center min-h-[56px] px-4 py-4`}
      >
        <FileText size={20} color="#6366F1" strokeWidth={2} />
        <View className="flex-1 ml-3">
          <Text className={tw.textTitle}>Cadastro</Text>
          <Text className={tw.textMuted}>Participantes e planilha</Text>
        </View>
        <ChevronRight size={20} color="#A1A1AA" />
      </PressableScale>
    </ScrollView>
  );
}
