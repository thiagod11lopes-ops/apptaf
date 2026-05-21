import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TextInput } from 'react-native';
import { Search } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { tw } from '../theme/premium';

type Props = {
  normContent: string;
};

export function NormsContentDisplay({ normContent }: Props) {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const highlightedContent = useMemo(() => {
    if (!searchQuery.trim()) {
      return (
        <Text
          className="text-[13px] leading-[22px] text-zinc-800 dark:text-zinc-200"
          style={{ fontFamily: theme.monoFont }}
        >
          {normContent}
        </Text>
      );
    }

    const q = searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${q})`, 'gi');
    const parts = normContent.split(regex);

    return (
      <Text
        className="text-[13px] leading-[22px] text-zinc-800 dark:text-zinc-200"
        style={{ fontFamily: theme.monoFont }}
      >
        {parts.map((part, index) =>
          regex.test(part) ? (
            <Text
              key={index}
              className="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-semibold"
            >
              {part}
            </Text>
          ) : (
            part
          ),
        )}
      </Text>
    );
  }, [normContent, searchQuery, theme.monoFont]);

  return (
    <View className="flex-1 px-4 select-none-touch">
      <View className={`${tw.input} flex-row items-center mb-4`}>
        <Search size={18} color={theme.textMuted} />
        <TextInput
          className="flex-1 ml-3 text-[15px] text-zinc-900 dark:text-zinc-100"
          style={{ fontFamily: theme.monoFont }}
          placeholder="Buscar na norma..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {highlightedContent}
      </ScrollView>
    </View>
  );
}
