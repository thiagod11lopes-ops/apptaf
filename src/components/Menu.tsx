import React from 'react';
import { View, Text } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { PressableScale } from './premium/PressableScale';
import { tw } from '../theme/premium';

interface MenuOption {
  id: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

interface Props {
  options: MenuOption[];
  visible?: boolean;
}

export function Menu({ options, visible = true }: Props) {
  if (!visible) return null;
  return (
    <View className="gap-2">
      {options.map((opt) => (
        <PressableScale
          key={opt.id}
          onPress={opt.onPress}
          className={`${tw.glassCard} flex-row items-center min-h-[56px] px-4 py-4 active:scale-[0.98]`}
        >
          <View className="flex-1 pr-2">
            <Text className={tw.textTitle}>{opt.title}</Text>
            <Text className={`${tw.textMuted} mt-0.5`}>{opt.subtitle}</Text>
          </View>
          <ChevronRight size={20} className="text-zinc-400" color="#A1A1AA" strokeWidth={2} />
        </PressableScale>
      ))}
    </View>
  );
}
