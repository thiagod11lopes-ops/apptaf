import React from 'react';
import { View, Text, Platform } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { PressableScale } from './premium/PressableScale';

interface Props {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function Header({ title, onBack, right }: Props) {
  const { theme } = useTheme();

  return (
    <View
      className="flex-row items-center px-2 py-3 border-b border-zinc-200/80 dark:border-white/10 bg-white/70 dark:bg-zinc-900/50"
      style={
        Platform.OS === 'web'
          ? ({
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              paddingTop: 12,
            } as object)
          : { paddingTop: 48 }
      }
    >
      {onBack ? (
        <PressableScale
          onPress={onBack}
          className="min-w-[48px] min-h-[48px] items-center justify-center rounded-2xl"
          accessibilityLabel="Voltar"
        >
          <ChevronLeft size={22} color={theme.text} strokeWidth={2.5} />
        </PressableScale>
      ) : (
        <View className="w-12" />
      )}
      <Text
        className="flex-1 text-center text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        numberOfLines={1}
      >
        {title}
      </Text>
      <View className="min-w-[48px] items-end justify-center">{right}</View>
    </View>
  );
}
