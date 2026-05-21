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
import { useNavigation, useNavigationState } from '@react-navigation/native';
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
  const routeName = useNavigationState((state) => {
    if (!state || state.index == null) return 'Home';
    return (state.routes[state.index]?.name ?? 'Home') as keyof RootStackParamList;
  });
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();

  if (!routeName || HIDDEN_ROUTES.includes(routeName)) {
    return null;
  }

  const bottomPad = Math.max(insets.bottom, 12);

  const BarWrap = ({ children }: { children: React.ReactNode }) => (
    <View
      className="absolute left-4 right-4 z-50 rounded-3xl overflow-hidden border border-white/10 shadow-xl"
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
          style={[
            { backgroundColor: isDark ? 'rgba(24, 24, 27, 0.92)' : 'rgba(255, 255, 255, 0.92)' },
            Platform.OS === 'web'
              ? ({
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                } as object)
              : undefined,
          ]}
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
                className="items-center justify-center"
                style={{ marginTop: -20 }}
                accessibilityLabel={tab.label}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    backgroundColor: theme.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={26} color="#FFFFFF" strokeWidth={2.2} />
                </View>
                <Text style={{ fontSize: 10, fontWeight: '600', color: theme.primary, marginTop: 4 }}>
                  {tab.label}
                </Text>
              </PressableScale>
            );
          }

          return (
            <PressableScale
              key={tab.id}
              onPress={() => navigation.navigate(tab.id)}
              style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}
              accessibilityLabel={tab.label}
            >
              <Icon size={22} color={color} strokeWidth={active ? 2.5 : 2} />
              <Text
                style={{
                  fontSize: 10,
                  marginTop: 4,
                  fontWeight: '500',
                  color: active ? theme.primary : theme.textMuted,
                }}
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
