import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { Search } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { FINTECH } from '../theme/fintech';

type Props = {
  normContent: string;
};

export function NormsContentDisplay({ normContent }: Props) {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const highlightedContent = useMemo(() => {
    if (!searchQuery.trim()) {
      return (
        <Text style={[styles.normText, { color: theme.text, fontFamily: theme.monoFont }]}>
          {normContent}
        </Text>
      );
    }

    const q = searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${q})`, 'gi');
    const parts = normContent.split(regex);

    return (
      <Text style={[styles.normText, { color: theme.text, fontFamily: theme.monoFont }]}>
        {parts.map((part, index) =>
          regex.test(part) ? (
            <Text
              key={index}
              style={{
                backgroundColor: theme.gainMuted,
                color: theme.gain,
                fontWeight: '700',
              }}
            >
              {part}
            </Text>
          ) : (
            part
          ),
        )}
      </Text>
    );
  }, [normContent, searchQuery, theme]);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: theme.cardBg,
            borderColor: theme.borderSubtle,
          },
        ]}
      >
        <Search size={18} color={theme.textMuted} style={styles.searchIcon} />
        <TextInput
          style={[
            styles.searchInput,
            { color: theme.text, fontFamily: theme.monoFont },
          ]}
          placeholder="Buscar na norma..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {highlightedContent}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: FINTECH.radiusMd,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  normText: {
    fontSize: 13,
    lineHeight: 22,
  },
});
