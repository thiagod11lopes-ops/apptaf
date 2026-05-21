import React from 'react';
import { View, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import {
  Home,
  ClipboardList,
  PlayCircle,
  BarChart3,
  Settings,
} from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { PressableScale } from './PressableScale';
import { useTheme } from '../../contexts/ThemeContext';

type TabId = 'Home' | 'Cadastro' | 'AplicarTAF' | 'Estatisticas' | 'Configuracoes';

const TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'Home', label: 'Início', icon: Home },
  { id: 'Cadastro', label: 'Cadastro', icon: ClipboardList },
  { id: 'AplicarTAF', label: 'Aplicar', icon: PlayCircle },
  { id: 'Estatisticas', label: 'Stats', icon: BarChart3 },
  { id: 'Configuracoes', label: 'Ajustes', icon: Settings },
];

const HIDDEN_ROUTES: (keyof RootStackParamList)[] = ['CadastrarResultados'];

export function GlassBottomBar() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();

  const routeName = route.name as keyof RootStackParamList;
  if (HIDDEN_ROUTES.includes(routeName)) {
    return null;
  }

  const bottomPad = Math.max(insets.bottom, 12);

  const BarWrap = ({ children }: { children: React.ReactNode }) => (
    <View
      className="absolute left-4 right-4 z-50 rounded-3xl overflow-hidden border border-white/10 dark:border-white/10 shadow-xl"
      style={{ bottom: bottomPad }}
    >
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={isDark ? 48 : 72}
          tint={isDark ? 'dark' : 'light'}
          style={{ width: '100%' }}
        >
          {children}
        </BlurView>
      ) : (
        <View
          className="bg-white/80 dark:bg-zinc-900/75"
          style={
            Platform.OS === 'web'
              ? ({
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                } as object)
              : undefined
          }
        >
          {children}
        </View>
      )}
    </View>
  );

  return (
    <BarWrap>
      <View className="flex-row items-center justify-between px-2 py-2">
        {TABS.map((tab) => {
          const active = routeName === tab.id;
          const isCenter = tab.id === 'AplicarTAF';
          const Icon = tab.icon;
          const color = active ? theme.primary : theme.textMuted;

          if (isCenter) {
            return (
              <PressableScale
                key={tab.id}
                onPress={() => navigation.navigate(tab.id)}
                className="items-center justify-center -mt-6"
                accessibilityLabel={tab.label}
              >
                <View className="w-14 h-14 rounded-2xl bg-indigo-600 dark:bg-indigo-500 items-center justify-center shadow-lg border border-white/20">
                  <Icon size={26} color="#FFFFFF" strokeWidth={2.2} />
                </View>
                <Text className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 mt-1">
                  {tab.label}
                </Text>
              </PressableScale>
            );
          }

          return (
            <PressableScale
              key={tab.id}
              onPress={() => navigation.navigate(tab.id)}
              className="flex-1 min-h-[48px] items-center justify-center py-2"
              accessibilityLabel={tab.label}
            >
              <Icon size={22} color={color} strokeWidth={active ? 2.5 : 2} />
              <Text
                className={`text-[10px] mt-1 font-medium ${
                  active ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-500'
                }`}
              >
                {tab.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </BarWrap>
  );
}
